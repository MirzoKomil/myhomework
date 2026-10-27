'use strict';
// O'quvchi bilan amallar: tahrirlash (sabab + tarix), sotuv menejeri so'rovlari
// (admin yoki ROP tasdig'i), muzlatish, kursni to'xtatish, qayta tiklash,
// ustozni almashtirish, Telegram guruh. Hammasi tranzaksiya ichida (db = client)
// chaqiriladi. students jadvalidagi eski maydonlar (extra_data.frozen, status,
// frozenAt, inactiveAt, paymentDueDate) ham yangilanadi — moliya jurnali va
// eski CRM ekranlari bir xil holatni ko'rishi uchun.
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const T = require('./time');
const S = require('./schedule');
const { fail } = T;

const ADMIN_ROLES = new Set(['admin', 'boshliq']);
const APPROVER_ROLES = new Set(['admin', 'boshliq', 'rop']);
const FREEZE_MAX_DAYS = 30;

function reasonText(r, min = 5) {
    const s = String(r || '').trim();
    if (s.length < min) throw fail(400, 'Sababni yozing');
    return s.slice(0, 500);
}
async function lockStudent(db, id) {
    const row = (await db.query('SELECT * FROM students WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!row) throw fail(404, 'O\'quvchi topilmadi');
    return row;
}
const extraOf = row => ({ ...S.studentRow(row), extra: typeof row.extra_data === 'object' && row.extra_data ? { ...row.extra_data } : JSON.parse(row.extra_data || '{}') });

async function audit(db, studentId, action, changes, reason, actor, requestId = null) {
    await db.query(`INSERT INTO school_student_audit (student_id,action,changes,reason,actor_id,actor_name,actor_role,request_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [studentId, action, JSON.stringify(changes || {}), reason || '', actor.id, actor.name || '', actor.role || '', requestId]);
}
async function writeExtra(db, id, extra) {
    extra.schoolRev = Number(extra.schoolRev || 0) + 1;
    await db.query('UPDATE students SET extra_data=$2 WHERE id=$1', [id, JSON.stringify(extra)]);
}
async function bumpRev(db, id) {
    await db.query(`UPDATE students SET extra_data = COALESCE(extra_data,'{}'::jsonb) || jsonb_build_object('schoolRev', COALESCE((extra_data->>'schoolRev')::int,0)+1) WHERE id=$1`, [id]);
}
// db.saveStudents chaqiradi: CRM nusxasi eski bo'lsa (schoolRev kichik), server boshqaradigan maydonlar saqlanib qoladi.
const SCHOOL_EXTRA = ['frozen', 'frozenAt', 'status', 'inactiveAt', 'paymentDueDate', 'pendingTeacherChange', 'passwordHash', 'mustChangePassword',
    'login', 'parentPhone', 'tariff', 'monthlyPrice', 'freezeShiftDays', 'progressArchivedAt', 'pendingScheduleChange', 'schoolRev'];
function protectSchoolFields(incoming, extra, existing) {
    if (!existing) return;
    const have = Number(existing.schoolRev || 0), sent = Number(incoming.schoolRev || 0);
    if (!have || sent >= have) return;
    for (const k of SCHOOL_EXTRA) { if (existing[k] === undefined) delete extra[k]; else extra[k] = existing[k]; }
    incoming.name = existing.name; incoming.phone = existing.phone; incoming.teacherId = existing.teacherId;
    incoming.assistantTeacherId = existing.assistantTeacherId; incoming.lessonDayOfWeek = existing.lessonDayOfWeek;
    incoming.lessonTime = existing.lessonTime; incoming.lessonDuration = existing.lessonDuration;
}

// Sotuv menejeri o'quvchisi: o'zi sotganmi?
function soldBy(student, managerId) {
    return !!managerId && (String(student.managerId || '') === String(managerId));
}

// ── Tahrirlash ───────────────────────────────────────────────────────────────
// Maydonlar: name, phone, parentPhone, login, newPassword, lessonDay, lessonTime, lessonDuration,
// tariff, monthlyPrice. Ustoz almashtirish alohida (changeTeacher). To'lovlar — Moliya orqali.
const DIRECT_FIELDS = ['name', 'phone', 'parentPhone', 'login', 'newPassword'];
const SCHEDULE_FIELDS = ['lessonDay', 'lessonTime', 'lessonDuration'];
const TARIFF_FIELDS = ['tariff', 'monthlyPrice', 'lessonDuration'];

function cleanPhone(p) {
    const d = String(p || '').replace(/\D/g, '');
    if (!/^998\d{9}$/.test(d)) throw fail(400, 'Telefon +998 XX XXX XX XX ko\'rinishida bo\'lsin');
    return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
}

async function applyEdit(db, actor, studentId, changes, reason, { requestId = null, now = new Date() } = {}) {
    const row = await lockStudent(db, studentId);
    const { extra, ...st } = extraOf(row);
    const diff = {};
    const cols = {};
    if ('name' in changes) {
        const n = String(changes.name || '').trim().replace(/\s+/g, ' ');
        if (n.length < 3 || n.length > 80) throw fail(400, 'Ism familiya 3–80 belgi');
        if (n !== row.name) { diff.name = [row.name, n]; cols.name = n; }
    }
    if ('phone' in changes) {
        const p = cleanPhone(changes.phone);
        if (p !== row.phone) { diff.phone = [row.phone, p]; cols.phone = p; }
    }
    if ('parentPhone' in changes) {
        const p = changes.parentPhone ? cleanPhone(changes.parentPhone) : '';
        if (p !== (extra.parentPhone || '')) { diff.parentPhone = [extra.parentPhone || '', p]; extra.parentPhone = p; }
    }
    if ('login' in changes) {
        const l = String(changes.login || '').trim().toLowerCase();
        if (!/^[a-z0-9._+-]{3,40}$/.test(l)) throw fail(400, 'Login 3–40 belgi: harf, raqam, nuqta');
        const dup = await db.query("SELECT 1 FROM students WHERE id<>$1 AND LOWER(extra_data->>'login')=$2", [studentId, l]);
        if (dup.rows.length) throw fail(409, 'Bu login band');
        if (l !== (extra.login || '')) { diff.login = [extra.login || '', l]; extra.login = l; }
    }
    if ('newPassword' in changes && changes.newPassword) {
        const p = String(changes.newPassword);
        if (p.length < 6 || p.length > 64) throw fail(400, 'Vaqtinchalik parol 6–64 belgi');
        extra.passwordHash = bcrypt.hashSync(p, 10);
        extra.mustChangePassword = true;
        diff.password = ['•••', 'vaqtinchalik parol berildi'];
    }
    if ('tariff' in changes && changes.tariff !== (extra.tariff || '')) { diff.tariff = [extra.tariff || '', String(changes.tariff)]; extra.tariff = String(changes.tariff).slice(0, 40); }
    if ('monthlyPrice' in changes) {
        const m = Number(changes.monthlyPrice);
        if (!Number.isInteger(m) || m < 0 || m > 50000000) throw fail(400, 'Narx noto\'g\'ri');
        if (m !== Number(extra.monthlyPrice || 0)) { diff.monthlyPrice = [extra.monthlyPrice || 0, m]; extra.monthlyPrice = m; }
    }
    const day = 'lessonDay' in changes ? Number(changes.lessonDay) : st.day;
    const time = 'lessonTime' in changes ? String(changes.lessonTime) : st.time;
    const dur = 'lessonDuration' in changes ? Number(changes.lessonDuration) : st.duration;
    if (day !== st.day || time !== st.time || dur !== st.duration) {
        if (!T.patternDays(day).length || T.toMin(time) == null || !(dur >= 15 && dur <= 120)) throw fail(400, 'Dars kuni, vaqti yoki davomiyligi noto\'g\'ri');
        if (st.teacherId) await S.checkWeekly(db, { teacherId: st.teacherId, day, time, duration: dur, fromDate: changes.effectiveFrom, excludeStudentId: studentId, now });
        diff.schedule = [`${T.patternLabel(st.day)} ${st.time} · ${st.duration} daq`, `${T.patternLabel(day)} ${time} · ${dur} daq`];
        const from = changes.effectiveFrom && T.isDate(changes.effectiveFrom) ? changes.effectiveFrom : T.nowLocal(now).date;
        if (from > T.nowLocal(now).date) {
            // Kelajak sanadan: shu kungacha eski jadval, keyin yangisi (applyDue yozadi).
            extra.pendingScheduleChange = { day, time, duration: dur, from };
            diff.schedule[1] += ` · ${from} dan`;
        } else { cols.lesson_day_of_week = day; cols.lesson_time = time; cols.lesson_duration = dur; delete extra.pendingScheduleChange; }
    }
    if (!Object.keys(diff).length) return { changed: false };
    const sets = Object.keys(cols).map((k, i) => `${k}=$${i + 2}`);
    if (sets.length) await db.query(`UPDATE students SET ${sets.join(',')} WHERE id=$1`, [studentId, ...Object.values(cols)]);
    await writeExtra(db, studentId, extra);
    await audit(db, studentId, 'edit', diff, reason, actor, requestId);
    return { changed: true, diff };
}

// Admin/ROP to'g'ridan-to'g'ri; sotuv menejeri — faqat o'zi sotgan o'quvchida,
// shaxsiy maydonlar darhol, tarif/ustoz — so'rov orqali.
async function edit(db, actor, studentId, body, { managerId = null, now = new Date() } = {}) {
    const reason = reasonText(body.reason);
    const changes = body.changes || {};
    if (APPROVER_ROLES.has(actor.role)) return applyEdit(db, actor, studentId, changes, reason, { now });
    if (actor.role !== 'sales_manager') throw fail(403, 'Tahrirlashga ruxsat yo\'q');
    const row = await lockStudent(db, studentId);
    if (!soldBy(extraOf(row), managerId)) throw fail(403, 'Faqat o\'zingiz sotgan o\'quvchini tahrirlaysiz');
    const direct = Object.fromEntries(Object.entries(changes).filter(([k]) => DIRECT_FIELDS.includes(k)));
    const tariff = Object.fromEntries(Object.entries(changes).filter(([k]) => TARIFF_FIELDS.includes(k) || SCHEDULE_FIELDS.includes(k) || k === 'effectiveFrom'));
    if (Object.keys(tariff).length === 1 && tariff.effectiveFrom) delete tariff.effectiveFrom;
    const out = { applied: null, request: null };
    if (Object.keys(direct).length) out.applied = await applyEdit(db, actor, studentId, direct, reason, { now });
    if (Object.keys(tariff).length) out.request = await createRequest(db, actor, studentId, 'tariff', tariff, reason);
    if (changes.teacherId) out.request = await createRequest(db, actor, studentId, 'teacher',
        { teacherId: changes.teacherId, from: changes.teacherFrom, lessonDay: changes.lessonDay, lessonTime: changes.lessonTime }, reason);
    return out;
}

// ── So'rovlar (sotuv → admin / ROP) ──────────────────────────────────────────
async function createRequest(db, actor, studentId, kind, changes, reason) {
    const open = await db.query("SELECT id FROM school_edit_requests WHERE student_id=$1 AND kind=$2 AND status='pending'", [studentId, kind]);
    if (open.rows.length) throw fail(409, 'Bu o\'quvchi uchun shu turdagi so\'rov allaqachon kutilmoqda');
    const { rows } = await db.query(`INSERT INTO school_edit_requests (id,student_id,kind,changes,reason,requested_by,requester_name)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [randomUUID(), studentId, kind, JSON.stringify(changes), reason, actor.id, actor.name || '']);
    await audit(db, studentId, 'request-' + kind, changes, reason, actor, rows[0].id);
    return rows[0];
}
// Admin va ROP teng: kim birinchi qaror qilsa — ikkinchisida yopiladi (status='pending' sharti).
async function decideRequest(db, actor, requestId, { decision, note = '' }, hooks = {}) {
    if (!APPROVER_ROLES.has(actor.role)) throw fail(403, 'Faqat admin yoki ROP qaror qiladi');
    if (!['approve', 'reject', 'return'].includes(decision)) throw fail(400, 'Qarorni tanlang');
    if (decision !== 'approve' && String(note).trim().length < 3) throw fail(400, 'Rad etish yoki qaytarish sababini yozing');
    const req = (await db.query('SELECT * FROM school_edit_requests WHERE id=$1 FOR UPDATE', [requestId])).rows[0];
    if (!req) throw fail(404, 'So\'rov topilmadi');
    if (req.status !== 'pending') throw fail(409, `So'rov allaqachon hal qilingan: ${req.decided_by_name || ''}`.trim());
    const status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'returned';
    if (status === 'approved') {
        const ch = req.changes || {};
        if (req.kind === 'tariff') await applyEdit(db, actor, req.student_id, ch, `So'rov №${req.number}: ${req.reason}`, { requestId });
        else if (req.kind === 'teacher') await changeTeacher(db, actor, req.student_id, { teacherId: ch.teacherId, from: ch.from, lessonDay: ch.lessonDay, lessonTime: ch.lessonTime,
            reason: `So'rov №${req.number}: ${req.reason}` }, { requestId });
        else if (req.kind === 'payment') {
            if (!hooks.applyPayment) throw fail(500, 'To\'lov tuzatish Moliya orqali bajariladi');
            await hooks.applyPayment(req);
        }
    }
    const { rows } = await db.query(`UPDATE school_edit_requests SET status=$2, decided_by=$3, decided_by_name=$4, decided_by_role=$5, decided_at=NOW(), decision_note=$6
        WHERE id=$1 AND status='pending' RETURNING *`, [requestId, status, actor.id, actor.name || '', actor.role, String(note).slice(0, 500)]);
    await audit(db, req.student_id, 'request-' + status, { kind: req.kind }, note, actor, requestId);
    return rows[0];
}

// ── Holat: muzlatish / to'xtatish / qayta tiklash ────────────────────────────
async function statusRows(db, studentId) {
    return (await db.query('SELECT * FROM school_student_status WHERE student_id=$1 AND cancelled_at IS NULL ORDER BY from_date, created_at', [studentId])).rows;
}
function courseFreezes(rows, since) {
    return rows.filter(r => r.status === 'frozen' && (!since || S.dateStr(r.from_date) >= since));
}
function currentStatus(rows, date) { return S.statusOn(rows, date); }

async function freeze(db, actor, studentId, body, now = new Date()) {
    if (!APPROVER_ROLES.has(actor.role)) throw fail(403, 'Muzlatishni admin yoki ROP qiladi');
    const from = T.assertDate(body.from, 'Boshlanish'), to = T.assertDate(body.to, 'Tugash');
    const days = T.daysBetween(from, to) + 1;
    if (days < 1) throw fail(400, 'Oraliq noto\'g\'ri');
    if (days > FREEZE_MAX_DAYS) throw fail(400, `Muzlatish ${FREEZE_MAX_DAYS} kundan oshmaydi`);
    const today = T.nowLocal(now).date;
    if (from < today) throw fail(400, 'O\'tgan sanadan muzlatib bo\'lmaydi');
    const row = await lockStudent(db, studentId);
    const rows = await statusRows(db, studentId);
    if (currentStatus(rows, from) !== 'active') throw fail(409, 'O\'quvchi bu sanada faol emas');
    const st = extraOf(row);
    const restart = rows.filter(r => r.status === 'restored' && r.payload?.continueFrom === 'restart').pop();
    const courseStart = restart ? S.dateStr(restart.from_date) : (st.startDate ? String(st.startDate).slice(0, 10) : null);
    if (courseFreezes(rows, courseStart).length) throw fail(409, 'Kurs davomida faqat bir marta muzlatish mumkin');
    const reason = reasonText(body.reason, 3);
    const { rows: ins } = await db.query(`INSERT INTO school_student_status (id,student_id,status,from_date,to_date,reason_code,reason,payload,actor_id,actor_name,actor_role)
        VALUES ($1,$2,'frozen',$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [randomUUID(), studentId, from, to, String(body.reasonCode || ''), reason, JSON.stringify({ days }), actor.id, actor.name || '', actor.role]);
    // To'lov muddati va kurs oxiri muzlatish kunlariga suriladi.
    const extra = st.extra;
    const shift = {};
    if (extra.paymentDueDate && T.isDate(String(extra.paymentDueDate).slice(0, 10))) {
        const nd = T.addDays(String(extra.paymentDueDate).slice(0, 10), days); shift.paymentDueDate = [extra.paymentDueDate, nd]; extra.paymentDueDate = nd;
    }
    extra.freezeShiftDays = Number(extra.freezeShiftDays || 0) + days;
    await writeExtra(db, studentId, extra);
    await audit(db, studentId, 'freeze', { from, to, days, ...shift }, reason, actor);
    await syncLegacy(db, studentId, now);
    return ins[0];
}

async function stop(db, actor, studentId, body, now = new Date()) {
    if (!APPROVER_ROLES.has(actor.role)) throw fail(403, 'Kursni to\'xtatishni admin yoki ROP qiladi');
    const last = T.assertDate(body.lastLesson, 'Oxirgi dars sanasi');
    await lockStudent(db, studentId);
    const rows = await statusRows(db, studentId);
    if (currentStatus(rows, last) === 'left') throw fail(409, 'O\'quvchi allaqachon chiqib ketgan');
    const reason = reasonText(body.reason, 3);
    const from = T.addDays(last, 1);
    const { rows: ins } = await db.query(`INSERT INTO school_student_status (id,student_id,status,from_date,reason_code,reason,payload,actor_id,actor_name,actor_role)
        VALUES ($1,$2,'left',$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [randomUUID(), studentId, from, String(body.reasonCode || ''), reason, JSON.stringify({ lastLesson: last, refund: body.refund || null }), actor.id, actor.name || '', actor.role]);
    await db.query(`UPDATE school_bookings SET status='cancelled', updated_at=NOW() WHERE student_id=$1 AND date >= $2 AND status IN ('hold','pending','confirmed')`, [studentId, from]);
    await db.query(`UPDATE school_makeups SET status='cancelled' WHERE student_id=$1 AND status='planned'`, [studentId]);
    await db.query('UPDATE school_student_groups SET archived=TRUE, updated_by=$2, updated_at=NOW() WHERE student_id=$1', [studentId, actor.id]);
    await bumpRev(db, studentId);
    await audit(db, studentId, 'stop', { lastLesson: last }, reason, actor);
    await syncLegacy(db, studentId, now);
    return ins[0];
}

// Qayta tiklash: muzlatilgan (oldin qaytarish) yoki chiqib ketgan o'quvchi.
// Chiqib ketgan o'quvchining eski vaqti band bo'lsa — yangi vaqt (va ustoz) beriladi.
async function restore(db, actor, studentId, body, now = new Date()) {
    if (!APPROVER_ROLES.has(actor.role)) throw fail(403, 'Qayta tiklashni admin yoki ROP qiladi');
    const from = T.assertDate(body.from, 'Birinchi dars');
    const row = await lockStudent(db, studentId);
    const rows = await statusRows(db, studentId);
    const state = currentStatus(rows, T.addDays(from, -1));
    const reason = reasonText(body.reason, 3);
    const st = extraOf(row);
    // Hali boshlanmagan muzlatishni bekor qilish (to'lov sanasi siljishi qaytariladi).
    const future = rows.find(r => r.status === 'frozen' && S.dateStr(r.from_date) > T.nowLocal(now).date);
    if (state === 'active' && future) {
        await db.query('UPDATE school_student_status SET cancelled_at=NOW(), cancelled_by=$2 WHERE id=$1', [future.id, actor.id]);
        const extra = st.extra; const days = Number(future.payload?.days || 0);
        if (days && extra.paymentDueDate) extra.paymentDueDate = T.addDays(String(extra.paymentDueDate).slice(0, 10), -days);
        extra.freezeShiftDays = Math.max(0, Number(extra.freezeShiftDays || 0) - days);
        await writeExtra(db, studentId, extra);
        await audit(db, studentId, 'freeze-cancelled', { from: S.dateStr(future.from_date), to: S.dateStr(future.to_date) }, reason, actor);
        await syncLegacy(db, studentId, now);
        return { ok: true, cancelledFreeze: true };
    }
    if (state === 'active') throw fail(409, 'O\'quvchi faol — qayta tiklash kerak emas');
    if (state === 'frozen') {
        const fr = rows.filter(r => r.status === 'frozen').pop();
        const used = T.daysBetween(S.dateStr(fr.from_date), from);
        await db.query('UPDATE school_student_status SET to_date=$2 WHERE id=$1', [fr.id, T.addDays(from, -1)]);
        const extra = st.extra; const unused = Number(fr.payload?.days || 0) - used;
        if (unused > 0 && extra.paymentDueDate) extra.paymentDueDate = T.addDays(String(extra.paymentDueDate).slice(0, 10), -unused);
        if (unused > 0) extra.freezeShiftDays = Math.max(0, Number(extra.freezeShiftDays || 0) - unused);
        await writeExtra(db, studentId, extra);
        await audit(db, studentId, 'unfreeze-early', { from, unusedDays: Math.max(0, unused) }, reason, actor);
    } else {
        const teacherId = body.teacherId || st.teacherId;
        const day = body.lessonDay ?? st.day, time = body.lessonTime ?? st.time;
        await S.checkWeekly(db, { teacherId, day, time, duration: st.duration, fromDate: from, excludeStudentId: studentId, now });
        await db.query(`INSERT INTO school_student_status (id,student_id,status,from_date,reason_code,reason,payload,actor_id,actor_name,actor_role)
            VALUES ($1,$2,'restored',$3,$4,$5,$6,$7,$8,$9)`, [randomUUID(), studentId, from, String(body.reasonCode || ''), reason,
            JSON.stringify({ teacherId, day, time, continueFrom: body.continueFrom || 'next' }), actor.id, actor.name || '', actor.role]);
        await db.query('UPDATE students SET teacher_id=$2, lesson_day_of_week=$3, lesson_time=$4, assistant_teacher_id=COALESCE($5, assistant_teacher_id) WHERE id=$1',
            [studentId, teacherId, day, time, body.assistantId || null]);
        if (teacherId !== st.teacherId) await openTeacherPeriod(db, actor, studentId, teacherId, from, reason, st.teacherId);
        await db.query('UPDATE school_student_groups SET archived=FALSE, updated_by=$2, updated_at=NOW() WHERE student_id=$1', [studentId, actor.id]);
        const extra = (await lockStudent(db, studentId)).extra_data || {};
        const ex = typeof extra === 'object' ? { ...extra } : JSON.parse(extra);
        if (body.continueFrom === 'restart') ex.progressArchivedAt = from;
        ex.paymentDueDate = from; // yangi to'lov davri birinchi darsdan
        await writeExtra(db, studentId, ex);
        await audit(db, studentId, 'restore', { from, teacherId, schedule: `${T.patternLabel(day)} ${time}`, continueFrom: body.continueFrom || 'next' }, reason, actor);
    }
    await syncLegacy(db, studentId, now);
    return { ok: true };
}

// ── Ustozni almashtirish (sanadan boshlab, tarix saqlanadi) ───────────────────
async function openTeacherPeriod(db, actor, studentId, teacherId, from, reason, prevTeacherId) {
    const prev = (await db.query('SELECT * FROM school_teacher_history WHERE student_id=$1 AND to_date IS NULL ORDER BY from_date DESC LIMIT 1', [studentId])).rows[0];
    if (prev) await db.query('UPDATE school_teacher_history SET to_date=$2 WHERE id=$1', [prev.id, T.addDays(from, -1)]);
    else if (prevTeacherId) await db.query(`INSERT INTO school_teacher_history (id,student_id,teacher_id,from_date,to_date,reason,actor_id)
        VALUES ($1,$2,$3,'2000-01-01',$4,'boshlang''ich',$5)`, [randomUUID(), studentId, prevTeacherId, T.addDays(from, -1), actor.id]);
    await db.query(`INSERT INTO school_teacher_history (id,student_id,teacher_id,from_date,reason,actor_id) VALUES ($1,$2,$3,$4,$5,$6)`,
        [randomUUID(), studentId, teacherId, from, reason, actor.id]);
}
async function changeTeacher(db, actor, studentId, body, { requestId = null, now = new Date() } = {}) {
    if (!APPROVER_ROLES.has(actor.role)) throw fail(403, 'Ustozni admin yoki ROP almashtiradi');
    const from = T.assertDate(body.from, 'Yangi ustoz bilan birinchi dars');
    const row = await lockStudent(db, studentId);
    const st = extraOf(row);
    const teacherId = String(body.teacherId || '');
    if (!teacherId || teacherId === st.teacherId) throw fail(400, 'Yangi ustozni tanlang');
    if (teacherId === st.assistantId) throw fail(400, 'Yordamchi ustoz asosiy ustoz bo\'la olmaydi');
    const day = body.lessonDay ?? st.day, time = body.lessonTime ?? st.time;
    await S.checkWeekly(db, { teacherId, day, time, duration: st.duration, fromDate: from, excludeStudentId: studentId, now });
    const reason = reasonText(body.reason, 3);
    await openTeacherPeriod(db, actor, studentId, teacherId, from, reason, st.teacherId);
    // students.teacher_id sana kelganda almashtiriladi (applyDue) — bugungi sana bo'lsa darhol.
    if (from <= T.nowLocal(now).date) await db.query('UPDATE students SET teacher_id=$2, lesson_day_of_week=$3, lesson_time=$4 WHERE id=$1', [studentId, teacherId, day, time]);
    else await db.query('UPDATE students SET extra_data = extra_data || $2::jsonb WHERE id=$1',
        [studentId, JSON.stringify({ pendingTeacherChange: { teacherId, from, day, time } })]);
    // Qoplanmagan darslar: eski ustoz oxirgi kungacha qoplaydi, keyin yangisiga o'tadi.
    await db.query(`UPDATE school_makeups SET teacher_id=$2 WHERE student_id=$1 AND status='planned' AND (held_date IS NULL OR held_date >= $3)`, [studentId, teacherId, from]);
    await bumpRev(db, studentId);
    await audit(db, studentId, 'teacher-change', { from: st.teacherId, to: teacherId, date: from, schedule: `${T.patternLabel(day)} ${time}` }, reason, actor, requestId);
    return { ok: true, from, teacherId };
}

// Rejalashtirilgan o'zgarishlarni sanasi kelganda students'ga yozish (soatlik).
async function syncLegacy(db, studentId, now = new Date()) {
    const today = T.nowLocal(now).date;
    const row = (await db.query('SELECT * FROM students WHERE id=$1 FOR UPDATE', [studentId])).rows[0];
    if (!row) return;
    const extra = typeof row.extra_data === 'object' && row.extra_data ? { ...row.extra_data } : JSON.parse(row.extra_data || '{}');
    const rows = await statusRows(db, studentId);
    const state = S.statusOn(rows, today);
    const before = JSON.stringify(extra);
    if (state === 'frozen') { if (!extra.frozen) { extra.frozen = true; extra.frozenAt = today; } }
    else if (extra.frozen) { extra.frozen = false; extra.frozenAt = null; }
    if (state === 'left') { if (extra.status !== 'inactive') { extra.status = 'inactive'; extra.inactiveAt = S.dateStr(rows.filter(r => r.status === 'left').pop().from_date); } }
    else if (extra.status === 'inactive' && rows.some(r => r.status === 'restored')) { extra.status = 'active'; delete extra.inactiveAt; }
    const ps = extra.pendingScheduleChange;
    if (ps && ps.from <= today) {
        await db.query('UPDATE students SET lesson_day_of_week=$2, lesson_time=$3, lesson_duration=$4 WHERE id=$1', [studentId, ps.day, ps.time, ps.duration]);
        delete extra.pendingScheduleChange;
    }
    const pend = extra.pendingTeacherChange;
    if (pend && pend.from <= today) {
        await db.query('UPDATE students SET teacher_id=$2, lesson_day_of_week=$3, lesson_time=$4 WHERE id=$1', [studentId, pend.teacherId, pend.day, pend.time]);
        delete extra.pendingTeacherChange;
    }
    if (JSON.stringify(extra) !== before) await writeExtra(db, studentId, extra);
}
async function applyDue(db, now = new Date()) {
    const ids = (await db.query(`SELECT DISTINCT student_id FROM school_student_status WHERE cancelled_at IS NULL
        UNION SELECT id FROM students WHERE extra_data ? 'pendingTeacherChange' OR extra_data ? 'pendingScheduleChange'`)).rows.map(r => r.student_id);
    for (const id of ids) await syncLegacy(db, id, now);
    await db.query(`UPDATE school_bookings SET status='cancelled', updated_at=NOW() WHERE status='hold' AND hold_until < $1`, [now]);
    return ids.length;
}

// ── Telegram guruh ───────────────────────────────────────────────────────────
const GROUP_RE = /^https:\/\/t\.me\/(\+[A-Za-z0-9_-]{8,64}|joinchat\/[A-Za-z0-9_-]{8,64}|[A-Za-z0-9_]{5,32})$/;
function cleanGroup(link, name) {
    const l = String(link || '').trim();
    if (l && !GROUP_RE.test(l)) throw fail(400, 'Telegram guruh havolasi https://t.me/... ko\'rinishida bo\'lsin');
    const n = String(name || '').trim().replace(/\s+/g, ' ');
    if (n.length < 2 || n.length > 80) throw fail(400, 'Guruh nomini yozing');
    return { link: l, name: n };
}
async function lockGroupNames(db) { await db.query("SELECT pg_advisory_xact_lock(hashtext('school:group-names'))"); }
async function nextGroupName(db) {
    const { rows } = await db.query(`SELECT name FROM school_student_groups`);
    let max = 0;
    for (const r of rows) { const m = /^C(\d+)\b/i.exec(r.name); if (m) max = Math.max(max, Number(m[1])); }
    return `C${String(max + 1).padStart(2, '0')} | onlayn ingliz tili`;
}
async function setGroup(db, actor, studentId, body, { managerId = null } = {}) {
    const row = await lockStudent(db, studentId);
    const existing = (await db.query('SELECT * FROM school_student_groups WHERE student_id=$1 FOR UPDATE', [studentId])).rows[0];
    if (!APPROVER_ROLES.has(actor.role)) {
        // Sotuv menejeri faqat konversiyada (guruh hali yo'q) o'zi sotgan o'quvchiga kiritadi.
        if (actor.role !== 'sales_manager' || existing || !soldBy(extraOf(row), managerId)) throw fail(403, 'Guruhni admin yoki ROP o\'zgartiradi');
    }
    const g = cleanGroup(body.link, body.name);
    await lockGroupNames(db);
    if (!APPROVER_ROLES.has(actor.role) && !g.link) throw fail(400, 'Guruh havolasini kiriting');
    const dup = await db.query('SELECT student_id FROM school_student_groups WHERE LOWER(name)=LOWER($1) AND student_id<>$2', [g.name, studentId]);
    if (dup.rows.length) throw fail(409, 'Bu nom boshqa guruhda ishlatilgan');
    const { rows } = await db.query(`INSERT INTO school_student_groups (student_id,tg_link,name,name_source,updated_by) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (student_id) DO UPDATE SET tg_link=EXCLUDED.tg_link, name=EXCLUDED.name, name_source=EXCLUDED.name_source, updated_by=EXCLUDED.updated_by, updated_at=NOW()
        RETURNING *`, [studentId, g.link, g.name, body.auto ? 'auto' : 'manual', actor.id]);
    await audit(db, studentId, 'group', { before: existing ? { link: existing.tg_link, name: existing.name } : null, after: g }, String(body.reason || ''), actor);
    return rows[0];
}
// Eski guruhlarga avtomatik nom (havolasi bo'lganlarga, nomi yo'qlarga).
async function autoNameGroups(db, actor) {
    const { rows } = await db.query(`SELECT s.id, s.extra_data FROM students s LEFT JOIN school_student_groups g ON g.student_id=s.id
        WHERE g.student_id IS NULL ORDER BY s.id`);
    let n = 0;
    for (const r of rows) {
        const ex = typeof r.extra_data === 'object' && r.extra_data ? r.extra_data : JSON.parse(r.extra_data || '{}');
        const link = ex.telegramGroupLink || ex.telegramGroup || '';
        if (!link || !GROUP_RE.test(String(link).trim())) continue;
        await db.query(`INSERT INTO school_student_groups (student_id,tg_link,name,name_source,updated_by) VALUES ($1,$2,$3,'auto',$4)`,
            [r.id, String(link).trim(), await nextGroupName(db), actor.id]);
        n++;
    }
    return n;
}

// Lid o'quvchiga aylanganda (sotuv kiritgan havola va nom) — guruh yozuvi bir marta yaratiladi.
// Nom band bo'lsa yoki kiritilmagan bo'lsa — keyingi bo'sh nom, "avtomatik" belgisi bilan (admin/ROP tekshiradi).
async function ensureProvisionGroup(db, student, actor = { id: 'system' }) {
    if (!student?.id) return null;
    const link = String(student.telegramGroupLink || '').trim();
    if (!link || !GROUP_RE.test(link)) return null;
    await lockGroupNames(db);
    const existing = (await db.query('SELECT 1 FROM school_student_groups WHERE student_id=$1', [student.id])).rows[0];
    if (existing) return null;
    let name = String(student.telegramGroupName || '').trim().replace(/\s+/g, ' ');
    let source = 'manual';
    const dup = name ? (await db.query('SELECT 1 FROM school_student_groups WHERE LOWER(name)=LOWER($1)', [name])).rows[0] : true;
    if (!name || name.length < 2 || dup) { name = await nextGroupName(db); source = 'auto'; }
    const { rows } = await db.query(`INSERT INTO school_student_groups (student_id,tg_link,name,name_source,updated_by) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (student_id) DO NOTHING RETURNING *`, [student.id, link, name.slice(0, 80), source, actor.id || 'system']);
    return rows[0] || null;
}

async function history(db, studentId) {
    return (await db.query('SELECT * FROM school_student_audit WHERE student_id=$1 ORDER BY created_at DESC, id DESC LIMIT 200', [studentId])).rows;
}

module.exports = { ADMIN_ROLES, APPROVER_ROLES, FREEZE_MAX_DAYS, soldBy, applyEdit, edit, createRequest, decideRequest, freeze, stop, restore,
    changeTeacher, syncLegacy, protectSchoolFields, bumpRev, applyDue, setGroup, nextGroupName, autoNameGroups, ensureProvisionGroup, cleanGroup, history, statusRows, audit };
