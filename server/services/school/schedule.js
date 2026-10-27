'use strict';
// Yagona dars jadvali — bitta manba (server). Doimiy darslar students
// jadvalidan (kun qolipi + vaqt + davomiylik), sinov/qoplash/bir martalik
// darslar school_bookings'dan, ustoz ish vaqti va sanaga ochish/yopish
// school_teacher_hours / school_overrides'dan olinadi. O'quvchi holati
// (muzlatilgan / chiqib ketgan) school_student_status'dan hisoblanadi —
// shuning uchun vaqt alohida "bo'shatilmaydi", holat o'zgarishi bilan o'zi bo'shaydi.
const { randomUUID } = require('node:crypto');
const T = require('./time');
const { fail } = T;

const HOLD_MINUTES = 10;
const ACTIVE_BOOKING = ['hold', 'pending', 'confirmed', 'done', 'no_show'];

function parseExtra(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return {}; }
}
function studentRow(r) {
    const extra = parseExtra(r.extra_data);
    return { id: r.id, name: r.name, subject: r.subject || 'english', teacherId: r.teacher_id || null,
        assistantId: r.assistant_teacher_id || null, day: r.lesson_day_of_week, time: r.lesson_time || '',
        duration: Number(r.lesson_duration) || 15, legacyInactive: extra.status === 'inactive' || extra.isStaffDemo === true,
        managerId: extra.managerId || null, leadRefId: extra.leadRef?.id || null, avatarUrl: extra.avatarUrl || '',
        startDate: extra.startDate || extra.courseStart || null,
        pendingSchedule: extra.pendingScheduleChange || null, pendingTeacher: extra.pendingTeacherChange || null };
}

// O'quvchining sana bo'yicha holati: 'active' | 'frozen' | 'left'.
// Yozuvlar vaqt bo'yicha qo'llanadi; bekor qilinganlar hisobga olinmaydi.
function statusOn(statusRows, date) {
    let state = 'active';
    const rows = [...statusRows].filter(r => !r.cancelled_at)
        .sort((a, b) => String(a.from_date).localeCompare(String(b.from_date)) || String(a.created_at).localeCompare(String(b.created_at)));
    for (const r of rows) {
        const from = dateStr(r.from_date), to = r.to_date ? dateStr(r.to_date) : null;
        if (from > date) continue;
        if (r.status === 'frozen') { if (!to || date <= to) state = 'frozen'; else if (state === 'frozen') state = 'active'; }
        else if (r.status === 'left') state = 'left';
        else if (r.status === 'restored') state = 'active';
    }
    return state;
}
function dateStr(v) {
    if (!v) return null;
    if (v instanceof Date) return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    return String(v).slice(0, 10);
}
// Ustoz almashtirilgan bo'lsa — sana bo'yicha qaysi ustoz.
function teacherOn(student, history, date) {
    const rows = history.filter(h => h.student_id === student.id && dateStr(h.from_date) <= date && (!h.to_date || date <= dateStr(h.to_date)))
        .sort((a, b) => dateStr(b.from_date).localeCompare(dateStr(a.from_date)));
    return rows[0]?.teacher_id || student.teacherId;
}

async function loadContext(db, { teacherIds = null, from, to, now = new Date() }) {
    const tFilter = teacherIds ? teacherIds.map(String) : null;
    const [students, statuses, history, hours, overrides, bookings] = await Promise.all([
        db.query('SELECT id,name,subject,teacher_id,assistant_teacher_id,lesson_day_of_week,lesson_time,lesson_duration,extra_data FROM students'),
        db.query('SELECT * FROM school_student_status WHERE cancelled_at IS NULL'),
        db.query('SELECT * FROM school_teacher_history'),
        db.query('SELECT * FROM school_teacher_hours' + (tFilter ? ' WHERE teacher_id = ANY($1)' : ''), tFilter ? [tFilter] : []),
        db.query(`SELECT * FROM school_overrides WHERE removed_at IS NULL AND (date IS NULL OR date BETWEEN $1 AND $2)`
            + (tFilter ? ' AND teacher_id = ANY($3)' : ''), tFilter ? [from, to, tFilter] : [from, to]),
        db.query(`SELECT * FROM school_bookings WHERE date BETWEEN $1 AND $2 AND status = ANY($3)
            AND NOT (status='hold' AND hold_until < $4)` + (tFilter ? ' AND teacher_id = ANY($5)' : ''),
            tFilter ? [from, to, ACTIVE_BOOKING, now, tFilter] : [from, to, ACTIVE_BOOKING, now])
    ]);
    const st = students.rows.map(studentRow).filter(s => !s.legacyInactive);
    const statusBy = new Map();
    for (const r of statuses.rows) { if (!statusBy.has(r.student_id)) statusBy.set(r.student_id, []); statusBy.get(r.student_id).push(r); }
    return { students: st, statusBy, history: history.rows, hours: hours.rows, overrides: overrides.rows,
        bookings: bookings.rows.map(b => ({ ...b, date: dateStr(b.date) })), from, to };
}

// Bir ustozning bir kuni: ish vaqti, band joylar va bo'sh joylar.
function dayView(ctx, teacherId, date) {
    const wd = T.weekday(date);
    const ov = ctx.overrides.filter(o => o.teacher_id === teacherId && (dateStr(o.date) === date || (o.date == null && Number(o.weekday) === wd)));
    let work = ctx.hours.filter(h => h.teacher_id === teacherId && Number(h.weekday) === wd)
        .map(h => ({ start: Number(h.start_min), end: Number(h.end_min), trialOpen: h.trial_open !== false }));
    for (const o of ov.filter(o => o.kind === 'open')) work.push({ start: o.start_min, end: o.end_min, trialOpen: true, opened: true });
    const closed = ov.filter(o => o.kind === 'close' || o.kind === 'leave').map(o => ({ start: o.start_min, end: o.end_min, kind: o.kind, reason: o.reason, overrideId: o.id }));
    const makeupOnly = ov.filter(o => o.kind === 'makeup_only').map(o => ({ start: o.start_min, end: o.end_min, kind: 'makeup_only', overrideId: o.id }));
    const items = [];
    for (const s of ctx.students) {
        // Rejalashtirilgan o'zgarish (sanadan boshlab yangi kun/vaqt) — shu sanadan hisobga olinadi.
        let day = s.day, time = s.time, duration = s.duration;
        const ps = s.pendingSchedule, pt = s.pendingTeacher;
        if (pt && pt.from <= date) { day = pt.day ?? day; time = pt.time ?? time; }
        if (ps && ps.from <= date) { day = ps.day; time = ps.time; duration = ps.duration; }
        if (time === '' || day == null) continue;
        if (!T.patternDays(day).includes(wd)) continue;
        if (teacherOn(s, ctx.history, date) !== teacherId) continue;
        if (s.startDate && date < s.startDate) continue;
        const state = statusOn(ctx.statusBy.get(s.id) || [], date);
        if (state === 'left') continue;
        const start = T.toMin(time); if (start == null) continue;
        items.push({ start, end: start + duration, kind: state === 'frozen' ? 'reserved' : 'lesson', studentId: s.id, studentName: s.name });
    }
    for (const b of ctx.bookings.filter(b => b.teacher_id === teacherId && b.date === date)) {
        items.push({ start: Number(b.start_min), end: Number(b.end_min), kind: b.kind === 'once' ? 'lesson' : b.kind, bookingId: b.id,
            status: b.status, studentId: b.student_id || null, leadId: b.lead_id || null, holdUntil: b.hold_until || null, createdBy: b.created_by });
    }
    for (const c of closed) items.push(c);
    items.sort((a, b) => a.start - b.start);
    // Sinovga ochiq bo'sh joy: ish vaqti − (dars, sinov, qoplash, yopilgan, faqat-qoplash).
    // Muzlatilgan o'quvchi joyi ("reserved") faqat sinovga ochiq bo'ladi.
    const hard = items.filter(i => i.kind !== 'reserved');
    const free = T.subtract(T.merge(work.map(w => ({ start: w.start, end: w.end }))), [...items, ...makeupOnly]);
    const trialFree = T.subtract(work.filter(w => w.trialOpen).map(w => ({ start: w.start, end: w.end })), [...hard, ...makeupOnly]);
    const makeupFree = T.subtract(work.map(w => ({ start: w.start, end: w.end })), hard.filter(i => i.kind !== 'makeup_only'));
    return { teacherId, date, weekday: wd, work: T.merge(work), items, free, trialFree, makeupFree, makeupOnly };
}

function fits(freeList, start, end) { return freeList.some(f => f.start <= start && end <= f.end); }

// Band qilishdan oldin: sinov uchun "sinovga ochiq", qoplash uchun ish vaqti
// ichida bo'sh, bir martalik dars uchun bo'sh bo'lishi kerak.
function checkSlot(view, kind, start, end) {
    const list = kind === 'trial' ? view.trialFree : kind === 'makeup' ? view.makeupFree : view.free;
    if (!fits(list, start, end)) {
        const clash = view.items.find(i => T.overlaps(i, { start, end }) && i.kind !== 'reserved');
        if (clash) throw fail(409, clash.kind === 'trial' && clash.status === 'hold'
            ? 'Bu vaqtni boshqa menejer hozir ushlab turibdi' : 'Bu vaqt band — boshqa vaqt tanlang');
        throw fail(409, kind === 'trial' ? 'Bu vaqt sinov darsiga ochiq emas' : 'Bu vaqt ustozning ish vaqtidan tashqarida');
    }
}

async function lockTeacher(db, teacherId) {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['school:' + teacherId]);
}

// Sinov / qoplash / bir martalik darsni band qilish. db — tranzaksiya ichidagi client.
async function book(db, actor, input, now = new Date()) {
    const kind = input.kind;
    if (!['trial', 'makeup', 'once'].includes(kind)) throw fail(400, 'Band turi noto\'g\'ri');
    const teacherId = String(input.teacherId || '');
    if (!teacherId) throw fail(400, 'Ustozni tanlang');
    const start = T.toMin(input.time ?? input.startMin);
    const duration = Number(input.duration) || 30;
    if (start == null || duration < 10 || duration > 180) throw fail(400, 'Vaqt yoki davomiylik noto\'g\'ri');
    const dates = (Array.isArray(input.dates) && input.dates.length ? input.dates : [input.date]).map(d => T.assertDate(d));
    if (dates.length > 3) throw fail(400, 'Sinov ko\'pi bilan 3 kun');
    const today = T.nowLocal(now);
    for (const d of dates) if (d < today.date || (d === today.date && start < today.min)) throw fail(400, 'O\'tib ketgan vaqtni band qilib bo\'lmaydi');
    if (kind === 'trial' && !input.leadId) throw fail(400, 'Lid tanlanmagan');
    if (kind !== 'trial' && !input.studentId) throw fail(400, 'O\'quvchi tanlanmagan');
    await lockTeacher(db, teacherId);
    const ctx = await loadContext(db, { teacherIds: [teacherId], from: dates[0], to: dates[dates.length - 1], now });
    for (const d of dates) checkSlot(dayView(ctx, teacherId, d), kind, start, start + duration);
    if (kind === 'trial') {
        const dup = await db.query(`SELECT 1 FROM school_bookings WHERE lead_id=$1 AND kind='trial' AND status IN ('hold','pending','confirmed')
            AND NOT (status='hold' AND hold_until < $2)`, [input.leadId, now]);
        if (dup.rows.length) throw fail(409, 'Bu lid uchun sinov allaqachon band qilingan');
    }
    const group = randomUUID();
    const status = kind === 'trial' ? (input.hold === false ? 'pending' : 'hold') : kind === 'makeup' ? 'confirmed' : 'confirmed';
    const holdUntil = status === 'hold' ? new Date(now.getTime() + HOLD_MINUTES * 60000) : null;
    const out = [];
    for (const d of dates) {
        const { rows } = await db.query(`INSERT INTO school_bookings (id,teacher_id,kind,student_id,lead_id,date,start_min,end_min,status,hold_until,group_id,note,created_by,created_by_name,created_by_role)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
            [randomUUID(), teacherId, kind, input.studentId || null, input.leadId || null, d, start, start + duration, status, holdUntil,
                group, String(input.note || '').slice(0, 500), actor.id, actor.name || '', actor.role || '']);
        out.push(rows[0]);
    }
    return out;
}

// Ushlab turilgan sinovni tasdiqlash (menejer lidni saqlaganda) → ustoz tasdig'iga.
async function confirmHold(db, actor, groupId, now = new Date()) {
    const { rows } = await db.query(`UPDATE school_bookings SET status='pending', hold_until=NULL, updated_at=NOW()
        WHERE group_id=$1 AND status='hold' AND hold_until >= $2 AND created_by=$3 RETURNING *`, [groupId, now, actor.id]);
    if (!rows.length) throw fail(409, 'Ushlab turish muddati tugagan — vaqtni qaytadan tanlang');
    return rows;
}
const TRANSITIONS = {
    accept: { from: ['pending'], to: 'confirmed' },
    reject: { from: ['pending'], to: 'rejected' },
    done: { from: ['confirmed', 'pending'], to: 'done' },
    no_show: { from: ['confirmed', 'pending'], to: 'no_show' },
    cancel: { from: ['hold', 'pending', 'confirmed'], to: 'cancelled' }
};
// Natija yozilsa yoki rad etilsa — ko'p kunlik sinovning qolgan kunlari ham bo'shaydi.
async function transition(db, bookingId, action, { teacherId = null } = {}) {
    const rule = TRANSITIONS[action]; if (!rule) throw fail(400, 'Amal noto\'g\'ri');
    const cur = (await db.query('SELECT * FROM school_bookings WHERE id=$1 FOR UPDATE', [bookingId])).rows[0];
    if (!cur) throw fail(404, 'Band topilmadi');
    if (teacherId && cur.teacher_id !== teacherId) throw fail(403, 'Bu band boshqa ustozga tegishli');
    if (!rule.from.includes(cur.status)) throw fail(409, 'Bu holatda amalni bajarib bo\'lmaydi');
    const updated = (await db.query('UPDATE school_bookings SET status=$2, updated_at=NOW() WHERE id=$1 RETURNING *', [bookingId, rule.to])).rows[0];
    if (cur.kind === 'trial' && ['rejected', 'done', 'no_show', 'cancelled'].includes(rule.to)) {
        await db.query(`UPDATE school_bookings SET status='cancelled', updated_at=NOW()
            WHERE group_id=$1 AND id<>$2 AND date > $3 AND status IN ('hold','pending','confirmed')`, [cur.group_id, bookingId, cur.date]);
    }
    return updated;
}
// Lid yo'qotilsa yoki o'quvchiga aylansa — uning sinov bandlari bo'shaydi.
async function releaseLead(db, leadId) {
    const { rowCount } = await db.query(`UPDATE school_bookings SET status='cancelled', updated_at=NOW()
        WHERE lead_id=$1 AND status IN ('hold','pending','confirmed')`, [leadId]);
    return rowCount;
}

// Doimiy (haftalik) darsni joylashtirish tekshiruvi: keyingi 4 hafta bo'yicha.
async function checkWeekly(db, { teacherId, day, time, duration, fromDate, excludeStudentId = null, now = new Date() }) {
    const start = T.toMin(time); if (start == null) throw fail(400, 'Vaqt noto\'g\'ri');
    const end = start + (Number(duration) || 30);
    const from = fromDate || T.nowLocal(now).date;
    const to = T.addDays(from, 27);
    await lockTeacher(db, teacherId);
    const ctx = await loadContext(db, { teacherIds: [teacherId], from, to, now });
    ctx.students = ctx.students.filter(s => s.id !== excludeStudentId);
    const days = T.patternDays(day);
    for (const d of T.dateRange(from, to)) {
        if (!days.includes(T.weekday(d))) continue;
        const v = dayView(ctx, teacherId, d);
        if (!fits(v.free, start, end)) {
            const clash = v.items.find(i => T.overlaps(i, { start, end }) && i.kind !== 'reserved');
            throw fail(409, `${d} (${T.DAY_UZ[T.weekday(d) - 1]}) ${T.fromMin(start)} — ${clash ? 'band' : 'ish vaqtidan tashqarida'}`);
        }
    }
    return true;
}

// Admin: sanaga ochish / yopish / faqat qoplash / ta'til ("faqat shu sana" yoki "har hafta").
async function addOverride(db, actor, input) {
    const kind = input.kind;
    if (!['open', 'close', 'makeup_only', 'leave'].includes(kind)) throw fail(400, 'Tur noto\'g\'ri');
    const reason = String(input.reason || '').trim();
    if (reason.length < 3) throw fail(400, 'Sabab yozing');
    const start = T.toMin(input.from ?? '00:00'), end = T.toMin(input.to ?? '24:00');
    if (start == null || end == null || end <= start) throw fail(400, 'Vaqt oralig\'i noto\'g\'ri');
    const weekly = input.repeat === 'weekly';
    const date = weekly ? null : T.assertDate(input.date);
    const weekday = weekly ? Number(input.weekday) : null;
    if (weekly && !(weekday >= 1 && weekday <= 7)) throw fail(400, 'Hafta kuni noto\'g\'ri');
    const { rows } = await db.query(`INSERT INTO school_overrides (id,teacher_id,date,weekday,start_min,end_min,kind,reason,created_by,created_by_name)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [randomUUID(), String(input.teacherId), date, weekday, start, end, kind, reason.slice(0, 300), actor.id, actor.name || '']);
    return rows[0];
}
async function removeOverride(db, actor, id) {
    const { rows } = await db.query('UPDATE school_overrides SET removed_at=NOW(), removed_by=$2 WHERE id=$1 AND removed_at IS NULL RETURNING *', [id, actor.id]);
    if (!rows.length) throw fail(404, 'Topilmadi');
    return rows[0];
}
// Admin: ustozning haftalik ish vaqti (to'liq almashtiriladi).
async function setHours(db, actor, teacherId, slots) {
    if (!Array.isArray(slots) || slots.length > 60) throw fail(400, 'Ish vaqti ro\'yxati noto\'g\'ri');
    const clean = slots.map(s => ({ weekday: Number(s.weekday), start: T.toMin(s.from), end: T.toMin(s.to), trialOpen: s.trialOpen !== false }));
    for (const s of clean) if (!(s.weekday >= 1 && s.weekday <= 7) || s.start == null || s.end == null || s.end <= s.start) throw fail(400, 'Ish vaqti noto\'g\'ri');
    await lockTeacher(db, teacherId);
    await db.query('DELETE FROM school_teacher_hours WHERE teacher_id=$1', [teacherId]);
    for (const s of T.merge(clean.map(c => ({ ...c, kind: c.weekday + ':' + c.trialOpen })))) {
        await db.query('INSERT INTO school_teacher_hours (teacher_id,weekday,start_min,end_min,trial_open,updated_by) VALUES ($1,$2,$3,$4,$5,$6)',
            [teacherId, s.weekday, s.start, s.end, s.trialOpen, actor.id]);
    }
    return (await db.query('SELECT * FROM school_teacher_hours WHERE teacher_id=$1 ORDER BY weekday,start_min', [teacherId])).rows;
}

// Kun bo'yicha umumiy ko'rinish (admin "Dars jadvali"): sanoqlar bilan.
function daySummary(views, attendance = new Map(), nowMin = null) {
    let lessons = 0, done = 0, now = 0, missed = 0, unmarked = 0;
    for (const v of views) for (const i of v.items) {
        if (i.kind !== 'lesson' && i.kind !== 'makeup') continue;
        lessons++;
        const mark = attendance.get(i.studentId);
        if (nowMin != null && i.start <= nowMin && nowMin < i.end) now++;
        else if (mark === true) done++;
        else if (mark === false) missed++;
        else if (nowMin != null && i.end <= nowMin) unmarked++;
    }
    return { lessons, done, now, missed, unmarked };
}

// Sotuv / ROP uchun maxfiylik: boshqa o'quvchi va lid ismlari ko'rinmaydi,
// boshqa menejer ushlab turgan vaqt "ushlab turilgan" bo'lib ko'rinadi.
function redactForSales(view, actor) {
    return { ...view, items: view.items.map(i => ({ start: i.start, end: i.end,
        kind: i.kind === 'reserved' ? 'lesson' : i.kind, status: i.status,
        mine: i.createdBy === actor.id, bookingId: i.createdBy === actor.id ? i.bookingId : undefined,
        leadId: i.createdBy === actor.id ? i.leadId : undefined, holdUntil: i.holdUntil || undefined })) };
}

module.exports = { HOLD_MINUTES, studentRow, statusOn, teacherOn, dateStr, loadContext, dayView, checkSlot, fits, book, confirmHold,
    transition, releaseLead, checkWeekly, addOverride, removeOverride, setHours, daySummary, redactForSales, lockTeacher };
