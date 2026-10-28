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
        startDate: extra.startDate || extra.courseStart || null, legacyFrozen: extra.frozen === true,
        pendingSchedule: extra.pendingScheduleChange || null, pendingTeacher: extra.pendingTeacherChange || null };
}

// O'quvchining sana bo'yicha holati: 'active' | 'frozen' | 'left'.
// Yozuvlar vaqt bo'yicha qo'llanadi; bekor qilinganlar hisobga olinmaydi.
function statusOn(statusRows, date) {
    let state = 'active';
    // pg DATE ustunlari Date bo'lib keladi — sana satri va vaqt bo'yicha saralanadi.
    const ts = v => (v instanceof Date ? v.getTime() : Date.parse(v) || 0);
    const rows = [...statusRows].filter(r => !r.cancelled_at)
        .sort((a, b) => dateStr(a.from_date).localeCompare(dateStr(b.from_date)) || ts(a.created_at) - ts(b.created_at));
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
// Sotuvdagi sinov darslari (leads, status='sinov-darsida') ham jadvalni band qiladi —
// alohida nusxa saqlanmaydi: natija yozilsa, rad etilsa yoki lid boshqa bosqichga
// o'tsa, vaqt o'zi bo'shaydi. Sana va vaqt Asia/Tashkent bo'yicha.
function leadTrialSlots(lead) {
    const tr = lead.trialRequest;
    const ob = lead.paymentOnboarding || {};
    const teacherId = String(tr?.teacherId || ob.teacherId || '');
    const at = tr?.scheduledAt || lead.trialLessonAt;
    if (!teacherId || !at || (tr && !['pending', 'accepted'].includes(tr.state || 'pending'))) return [];
    const ms = Date.parse(at); if (!Number.isFinite(ms)) return [];
    const local = T.nowLocal(new Date(ms));
    const duration = parseInt(lead.paymentSurvey?.tariff, 10) || Number(ob.lessonDuration) || 30;
    const count = Math.max(1, Math.min(3, Number(tr?.daysCount || ob.trialDaysCount) || 1));
    const days = T.patternDays(ob.lessonDayOfWeek || T.weekday(local.date));
    const out = []; let d = local.date, guard = 0;
    while (out.length < count && guard++ < 21) {
        if (out.length === 0 || days.includes(T.weekday(d))) out.push(d);
        d = T.addDays(d, 1);
    }
    return out.map(date => ({ teacherId, date, start: local.min, end: local.min + duration,
        status: tr?.state === 'accepted' ? 'confirmed' : 'pending', leadId: lead.id, managerId: String(lead.managerId || '') }));
}
function parseLead(r) {
    const extra = parseExtra(r.extra_data);
    return { ...extra, id: r.id, status: r.status, managerId: r.manager_id || '' };
}

// Ustoz almashtirilgan bo'lsa — sana bo'yicha qaysi ustoz.
// Yopilgan davr (to_date bor) — o'sha ustoz. Ochiq davr faqat rejalashtirilgan (hali kuchga kirmagan)
// almashinuv uchun ishlatiladi; aks holda students.teacher_id manba (eski CRM orqali almashtirilsa ham).
function teacherOn(student, history, date) {
    const rows = history.filter(h => h.student_id === student.id && dateStr(h.from_date) <= date && (!h.to_date || date <= dateStr(h.to_date)))
        .sort((a, b) => dateStr(b.from_date).localeCompare(dateStr(a.from_date)));
    const r = rows[0];
    if (!r) return student.teacherId;
    if (r.to_date) return r.teacher_id;
    return student.pendingTeacher && student.pendingTeacher.teacherId === r.teacher_id ? r.teacher_id : student.teacherId;
}

async function loadContext(db, { teacherIds = null, from, to, now = new Date() }) {
    const tFilter = teacherIds ? teacherIds.map(String) : null;
    const [students, statuses, history, hours, overrides, bookings, leads] = await Promise.all([
        db.query('SELECT id,name,subject,teacher_id,assistant_teacher_id,lesson_day_of_week,lesson_time,lesson_duration,extra_data FROM students'),
        db.query('SELECT * FROM school_student_status WHERE cancelled_at IS NULL'),
        db.query('SELECT * FROM school_teacher_history'),
        db.query('SELECT * FROM school_teacher_hours' + (tFilter ? ' WHERE teacher_id = ANY($1)' : ''), tFilter ? [tFilter] : []),
        db.query(`SELECT * FROM school_overrides WHERE removed_at IS NULL AND (date IS NULL OR date BETWEEN $1 AND $2)`
            + (tFilter ? ' AND teacher_id = ANY($3)' : ''), tFilter ? [from, to, tFilter] : [from, to]),
        db.query(`SELECT * FROM school_bookings WHERE date BETWEEN $1 AND $2 AND status = ANY($3)
            AND NOT (status='hold' AND hold_until < $4)` + (tFilter ? ' AND teacher_id = ANY($5)' : ''),
            tFilter ? [from, to, ACTIVE_BOOKING, now, tFilter] : [from, to, ACTIVE_BOOKING, now]),
        db.query("SELECT id, status, manager_id, extra_data FROM leads WHERE status = 'sinov-darsida' AND deleted_at IS NULL")
    ]);
    const leadTrials = leads.rows.map(parseLead).flatMap(leadTrialSlots).filter(x => x.date >= from && x.date <= to && (!tFilter || tFilter.includes(x.teacherId)));
    const st = students.rows.map(studentRow).filter(s => !s.legacyInactive);
    const statusBy = new Map();
    for (const r of statuses.rows) { if (!statusBy.has(r.student_id)) statusBy.set(r.student_id, []); statusBy.get(r.student_id).push(r); }
    return { students: st, statusBy, history: history.rows, hours: hours.rows, overrides: overrides.rows,
        bookings: bookings.rows.map(b => ({ ...b, date: dateStr(b.date) })), leadTrials, from, to,
        teachersWithHours: new Set(hours.rows.map(h => h.teacher_id)), excludeLeads: new Set() };
}

// Bir ustozning bir kuni: ish vaqti, band joylar va bo'sh joylar.
function dayView(ctx, teacherId, date) {
    const wd = T.weekday(date);
    const ov = ctx.overrides.filter(o => o.teacher_id === teacherId && (dateStr(o.date) === date || (o.date == null && Number(o.weekday) === wd)));
    let work = ctx.hours.filter(h => h.teacher_id === teacherId && Number(h.weekday) === wd)
        .map(h => ({ start: Number(h.start_min), end: Number(h.end_min), trialOpen: h.trial_open !== false }));
    // Ish vaqti hali kiritilmagan ustoz: cheklov yo'q (faqat to'qnashuv tekshiriladi), admin "Ish vaqti"ni kiritgach aniqlashadi.
    const noHours = ctx.teachersWithHours && !ctx.teachersWithHours.has(teacherId);
    if (noHours) work = [{ start: 7 * 60, end: 22 * 60, trialOpen: true, assumed: true }];
    for (const o of ov.filter(o => o.kind === 'open')) work.push({ start: o.start_min, end: o.end_min, trialOpen: true, opened: true });
    const closed = ov.filter(o => o.kind === 'close' || o.kind === 'leave').map(o => ({ start: o.start_min, end: o.end_min, kind: o.kind, reason: o.reason, overrideId: o.id,
        by: o.created_by_name || '', at: o.created_at || null, weekly: o.date == null }));
    // Admin qo'shimcha ochgan vaqtlar (jadvalda "admin ochdi" bo'lib ko'rinadi, bosib bekor qilinadi).
    const opens = ov.filter(o => o.kind === 'open').map(o => ({ start: o.start_min, end: o.end_min, overrideId: o.id, reason: o.reason, by: o.created_by_name || '', at: o.created_at || null, weekly: o.date == null }));
    const makeupOnly = ov.filter(o => o.kind === 'makeup_only').map(o => ({ start: o.start_min, end: o.end_min, kind: 'makeup_only', overrideId: o.id, reason: o.reason, by: o.created_by_name || '', at: o.created_at || null, weekly: o.date == null }));
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
        const srows = ctx.statusBy.get(s.id) || [];
        // Eski CRM'da muzlatilgan (holat yozuvisiz) o'quvchi — joyi saqlanadi, faqat sinovga ochiq.
        const state = !srows.length && s.legacyFrozen ? 'frozen' : statusOn(srows, date);
        if (state === 'left') continue;
        const start = T.toMin(time); if (start == null) continue;
        items.push({ start, end: start + duration, kind: state === 'frozen' ? 'reserved' : 'lesson', studentId: s.id, studentName: s.name });
    }
    for (const b of ctx.bookings.filter(b => b.teacher_id === teacherId && b.date === date)) {
        items.push({ start: Number(b.start_min), end: Number(b.end_min), kind: b.kind === 'once' ? 'lesson' : b.kind, bookingId: b.id,
            status: b.status, studentId: b.student_id || null, leadId: b.lead_id || null, holdUntil: b.hold_until || null, createdBy: b.created_by });
    }
    for (const l of (ctx.leadTrials || []).filter(l => l.teacherId === teacherId && l.date === date && !ctx.excludeLeads?.has(l.leadId))) {
        items.push({ start: l.start, end: l.end, kind: 'trial', status: l.status, leadId: l.leadId, managerId: l.managerId, fromLead: true });
    }
    for (const c of closed) items.push(c);
    items.sort((a, b) => a.start - b.start);
    // Sinovga ochiq bo'sh joy: ish vaqti − (dars, sinov, qoplash, yopilgan, faqat-qoplash).
    // Muzlatilgan o'quvchi joyi ("reserved") faqat sinovga ochiq bo'ladi.
    const hard = items.filter(i => i.kind !== 'reserved');
    const free = T.subtract(T.merge(work.map(w => ({ start: w.start, end: w.end }))), [...items, ...makeupOnly]);
    const trialFree = T.subtract(work.filter(w => w.trialOpen).map(w => ({ start: w.start, end: w.end })), [...hard, ...makeupOnly]);
    const makeupFree = T.subtract(work.map(w => ({ start: w.start, end: w.end })), hard.filter(i => i.kind !== 'makeup_only'));
    return { teacherId, date, weekday: wd, work: T.merge(work), items, free, trialFree, makeupFree, makeupOnly, opens, noHours: !!noHours };
}

function fits(freeList, start, end) { return freeList.some(f => f.start <= start && end <= f.end); }

// Band qilishdan oldin: sinov uchun "sinovga ochiq", qoplash uchun ish vaqti
// ichida bo'sh, bir martalik dars uchun bo'sh bo'lishi kerak.
function checkSlot(view, kind, start, end) {
    const list = kind === 'trial' ? view.trialFree : kind === 'makeup' ? view.makeupFree : view.free;
    if (!fits(list, start, end)) {
        const clash = view.items.find(i => T.overlaps(i, { start, end }) && i.kind !== 'reserved');
        if (clash) throw fail(409, clash.kind === 'trial' && clash.status === 'hold'
            ? 'Bu vaqtni boshqa menejer hozir ushlab turibdi'
            // Ta'til/kasallik sababi (shaxsiy) sotuvga aytilmaydi — faqat "sinovga yopish" sababi.
            : clash.kind === 'close' ? `Bu vaqt yopilgan${clash.reason ? ` (${clash.reason})` : ''} — boshqa vaqt tanlang`
            : clash.kind === 'leave' ? 'Ustoz bu vaqtda ishlamaydi — boshqa vaqt tanlang' : 'Bu vaqt band — boshqa vaqt tanlang');
        if (kind === 'trial' && view.makeupOnly?.some(m => T.overlaps(m, { start, end }))) throw fail(409, 'Bu vaqt faqat qoplash darslari uchun — boshqa vaqt tanlang');
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
    // Sinov qayta qo'yilayotganda lidning hozirgi sinovi o'ziga xalaqit bermaydi (u yangi vaqt bilan almashadi).
    if (kind === 'trial' && input.leadId) ctx.excludeLeads.add(String(input.leadId));
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

// Ish vaqti / ochish-yopish faqat haqiqiy ustoz (yoki yordamchi) uchun kiritiladi.
const STAFF_TEACHER_ROLES = ['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi', 'yordamchi'];
async function assertTeacher(db, teacherId) {
    const t = (await db.query('SELECT id, name FROM hr_employees WHERE id=$1 AND role = ANY($2)', [String(teacherId || ''), STAFF_TEACHER_ROLES])).rows[0];
    if (!t) throw fail(404, 'Ustoz topilmadi');
    return t;
}
const IMPACT_DAYS = 28;
const conflictKey = c => `${c.date}|${c.start}|${c.kind}|${c.studentId || c.leadId || c.bookingId || ''}`;
// Bir kunning band yozuvlari (dars, qoplash, sinov) — muzlatilgan joy, yopilgan vaqt hisobga olinmaydi.
const busyItems = v => v.items.filter(i => ['lesson', 'makeup', 'trial'].includes(i.kind));
function conflictRow(v, i) {
    return { date: v.date, start: i.start, end: i.end, kind: i.kind, status: i.status || null, studentId: i.studentId || null,
        leadId: i.leadId || null, bookingId: i.bookingId || null, name: i.studentName || i.leadName || '' };
}
// Ta'sir ro'yxati: ismlar bilan (faqat admin/boshliq yo'liga qaytariladi). Ko'pi bilan 40 ta.
async function namedConflicts(db, views, list, { from, to }) {
    if (!list.length) return [];
    await annotateViews(db, views, { from, to });
    const by = new Map(views.flatMap(v => v.items.map(i => [`${v.date}|${i.start}|${i.kind}|${i.studentId || i.leadId || i.bookingId || ''}`, i])));
    return list.slice(0, 40).map(c => { const i = by.get(conflictKey(c)); return { ...c, name: i?.studentName || i?.leadName || c.name || '' }; });
}
function needConfirm(message, conflicts) {
    const e = fail(409, message);
    e.conflicts = conflicts; e.needConfirm = true;
    return e;
}
// Sanaga yopish / ta'til / faqat qoplash qaysi yozuvlarga tegadi:
// ta'til — dars, qoplash va sinov; sinovga yopish va faqat qoplash — sinovlar.
async function overrideImpact(db, o, now = new Date()) {
    if (o.kind === 'open') return [];
    const today = T.nowLocal(now);
    const from = o.date || today.date, to = o.date || T.addDays(today.date, IMPACT_DAYS - 1);
    const ctx = await loadContext(db, { teacherIds: [o.teacher_id], from, to, now });
    const views = [], out = [];
    for (const d of T.dateRange(from, to, 62)) {
        if (o.date == null && T.weekday(d) !== Number(o.weekday)) continue;
        const v = dayView(ctx, o.teacher_id, d); views.push(v);
        for (const i of busyItems(v)) {
            if (!T.overlaps(i, { start: o.start_min, end: o.end_min })) continue;
            if (o.kind !== 'leave' && i.kind !== 'trial') continue;
            if (d === today.date && i.end <= today.min) continue;
            out.push(conflictRow(v, i));
        }
    }
    return namedConflicts(db, views, out, { from, to });
}

// Admin: sanaga ochish / yopish / faqat qoplash / ta'til ("faqat shu sana" yoki "har hafta").
// Band vaqtga tegsa — ro'yxat qaytariladi (409, conflicts), admin "Baribir saqlash" (confirm) bilan tasdiqlaydi.
async function addOverride(db, actor, input, now = new Date()) {
    const kind = input.kind;
    if (!['open', 'close', 'makeup_only', 'leave'].includes(kind)) throw fail(400, 'Tur noto\'g\'ri');
    const reason = String(input.reason || '').trim();
    if (reason.length < 3) throw fail(400, 'Sabab yozing');
    const start = T.toMin(input.from ?? '00:00'), end = T.toMin(input.to ?? '24:00');
    if (start == null || end == null || end <= start || start < 0 || end > 1440) throw fail(400, 'Vaqt oralig\'i noto\'g\'ri');
    const weekly = input.repeat === 'weekly';
    const date = weekly ? null : T.assertDate(input.date);
    const weekday = weekly ? Number(input.weekday) : null;
    if (weekly && !(weekday >= 1 && weekday <= 7)) throw fail(400, 'Hafta kuni noto\'g\'ri');
    if (!weekly && date < T.nowLocal(now).date) throw fail(400, 'O\'tib ketgan sanani o\'zgartirib bo\'lmaydi');
    const teacher = await assertTeacher(db, input.teacherId);
    await lockTeacher(db, teacher.id);
    if (input.confirm !== true) {
        const conflicts = await overrideImpact(db, { teacher_id: teacher.id, kind, date, weekday, start_min: start, end_min: end }, now);
        if (conflicts.length) throw needConfirm(kind === 'leave'
            ? `Bu vaqtda ${conflicts.length} ta dars/sinov bor — ular "qoplash kerak" bo'lib qoladi`
            : `Bu vaqtda ${conflicts.length} ta sinov band qilingan — ular o'z joyida qoladi, yangi sinov qo'yilmaydi`, conflicts);
    }
    const { rows } = await db.query(`INSERT INTO school_overrides (id,teacher_id,date,weekday,start_min,end_min,kind,reason,created_by,created_by_name)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [randomUUID(), teacher.id, date, weekday, start, end, kind, reason.slice(0, 300), actor.id, actor.name || '']);
    return rows[0];
}
async function removeOverride(db, actor, id) {
    const { rows } = await db.query('UPDATE school_overrides SET removed_at=NOW(), removed_by=$2 WHERE id=$1 AND removed_at IS NULL RETURNING *', [id, actor.id]);
    if (!rows.length) throw fail(404, 'Topilmadi');
    return rows[0];
}
// Mavjud yozuvni tahrirlash (tur, vaqt, sabab, "faqat shu sana / har hafta"): eskisi bekor qilinadi,
// yangisi yoziladi — tarixda ikkalasi ham qoladi. Bitta tranzaksiyada.
async function updateOverride(db, actor, id, input, now = new Date()) {
    const cur = (await db.query('SELECT * FROM school_overrides WHERE id=$1 AND removed_at IS NULL FOR UPDATE', [id])).rows[0];
    if (!cur) throw fail(404, 'Topilmadi');
    await removeOverride(db, actor, id);
    return addOverride(db, actor, { ...input, teacherId: cur.teacher_id }, now);
}
// Admin: ustozning haftalik ish vaqti (to'liq almashtiriladi). Bir kunda bir nechta oraliq bo'lishi mumkin.
// Qisqartirilsa — kelgusi 4 haftada ish vaqtidan tashqarida qoladigan darslar ro'yxati qaytariladi (409),
// admin tasdiqlamaguncha saqlanmaydi. Har o'zgarish school_hours_log'ga yoziladi.
async function setHours(db, actor, teacherId, slots, { confirm = false, now = new Date() } = {}) {
    if (!Array.isArray(slots) || slots.length > 60) throw fail(400, 'Ish vaqti ro\'yxati noto\'g\'ri');
    const clean = slots.map(s => ({ weekday: Number(s.weekday), start: T.toMin(s.from), end: T.toMin(s.to), trialOpen: s.trialOpen !== false }));
    for (const s of clean) if (!(s.weekday >= 1 && s.weekday <= 7) || s.start == null || s.end == null || s.end <= s.start) throw fail(400, 'Ish vaqti noto\'g\'ri');
    for (const a of clean) for (const b of clean) if (a !== b && a.weekday === b.weekday && T.overlaps(a, b) && a.trialOpen !== b.trialOpen)
        throw fail(400, `${T.DAY_UZ[a.weekday - 1]}: oraliqlar ustma-ust tushmasin (${T.fromMin(a.start)}–${T.fromMin(a.end)} va ${T.fromMin(b.start)}–${T.fromMin(b.end)})`);
    const teacher = await assertTeacher(db, teacherId);
    teacherId = teacher.id;
    await lockTeacher(db, teacherId);
    const merged = T.merge(clean.map(c => ({ ...c, kind: c.weekday + ':' + c.trialOpen })));
    const before = (await db.query('SELECT weekday,start_min,end_min,trial_open FROM school_teacher_hours WHERE teacher_id=$1 ORDER BY weekday,start_min', [teacherId])).rows;
    if (!confirm) {
        const today = T.nowLocal(now), to = T.addDays(today.date, IMPACT_DAYS - 1);
        const ctx = await loadContext(db, { teacherIds: [teacherId], from: today.date, to, now });
        const outside = c => { const out = []; const views = [];
            for (const d of T.dateRange(today.date, to, 62)) { const v = dayView(c, teacherId, d); views.push(v);
                for (const i of busyItems(v)) if (!(d === today.date && i.end <= today.min) && !fits(v.work, i.start, i.end)) out.push(conflictRow(v, i)); }
            return { out, views }; };
        const was = new Set(outside(ctx).out.map(conflictKey));
        const next = { ...ctx, hours: merged.map(m => ({ teacher_id: teacherId, weekday: m.weekday, start_min: m.start, end_min: m.end, trial_open: m.trialOpen })),
            teachersWithHours: new Set(merged.length ? [teacherId] : []) };
        const r = outside(next);
        const fresh = r.out.filter(c => !was.has(conflictKey(c)));
        if (fresh.length) throw needConfirm(`Yangi ish vaqtidan tashqarida ${fresh.length} ta dars/sinov qoladi — ro'yxatni ko'rib tasdiqlang`,
            await namedConflicts(db, r.views, fresh, { from: today.date, to }));
    }
    await db.query('DELETE FROM school_teacher_hours WHERE teacher_id=$1', [teacherId]);
    for (const s of merged) {
        await db.query('INSERT INTO school_teacher_hours (teacher_id,weekday,start_min,end_min,trial_open,updated_by) VALUES ($1,$2,$3,$4,$5,$6)',
            [teacherId, s.weekday, s.start, s.end, s.trialOpen, actor.id]);
    }
    const after = (await db.query('SELECT weekday,start_min,end_min,trial_open FROM school_teacher_hours WHERE teacher_id=$1 ORDER BY weekday,start_min', [teacherId])).rows;
    await db.query('INSERT INTO school_hours_log (teacher_id,before,after,actor_id,actor_name) VALUES ($1,$2,$3,$4,$5)',
        [teacherId, JSON.stringify(before), JSON.stringify(after), actor.id, actor.name || '']);
    return (await db.query('SELECT * FROM school_teacher_hours WHERE teacher_id=$1 ORDER BY weekday,start_min', [teacherId])).rows;
}

// "O'zgarishlar tarixi" (AdminJadvalUstoz): ochish/yopish, ish vaqti shabloni, sinov band qilish, qoplash.
// Faqat admin/ROP yo'liga (lid va o'quvchi ismlari bor).
async function changes(db, teacherId, { days = 30, limit = 20 } = {}) {
    const since = new Date(Date.now() - days * 86400000);
    const role = new Map((await db.query('SELECT id, role, name FROM users')).rows.map(u => [u.id, u]));
    const ov = (await db.query(`SELECT * FROM school_overrides WHERE teacher_id=$1 AND (created_at >= $2 OR removed_at >= $2)`, [teacherId, since])).rows;
    const hl = (await db.query('SELECT * FROM school_hours_log WHERE teacher_id=$1 AND created_at >= $2', [teacherId, since])).rows;
    const bk = (await db.query(`SELECT b.*, s.name AS student_name FROM school_bookings b LEFT JOIN students s ON s.id=b.student_id
        WHERE b.teacher_id=$1 AND b.kind IN ('makeup','once') AND b.created_at >= $2`, [teacherId, since])).rows;
    const leads = (await db.query(`SELECT l.id, l.name, l.extra_data, m.name AS manager FROM leads l LEFT JOIN sales_managers m ON m.id = l.manager_id
        WHERE l.deleted_at IS NULL AND (l.extra_data->'trialRequest'->>'teacherId' = $1)`, [teacherId]).catch(() => ({ rows: [] }))).rows;
    const who = (id, name) => { const u = role.get(id); return { by: name || u?.name || '', role: u?.role || '' }; };
    const when = o => o.date ? { date: dateStr(o.date) } : { weekday: Number(o.weekday) };
    const ev = [];
    for (const o of ov) {
        ev.push({ at: o.created_at, type: 'override', action: 'add', kind: o.kind, ...when(o), start: o.start_min, end: o.end_min, reason: o.reason, ...who(o.created_by, o.created_by_name) });
        // Tahrirlash = eskisini bekor qilish + yangisini yozish (bir tranzaksiyada) — tarixda bitta yozuv bo'lib ko'rinadi.
        const edited = o.removed_at && ov.some(n => n.id !== o.id && n.created_by === o.removed_by && Math.abs(new Date(n.created_at) - new Date(o.removed_at)) < 3000);
        if (o.removed_at && o.removed_at >= since && !edited) ev.push({ at: o.removed_at, type: 'override', action: 'remove', kind: o.kind, ...when(o), start: o.start_min, end: o.end_min, reason: o.reason, ...who(o.removed_by) });
    }
    for (const h of hl) ev.push({ at: h.created_at, type: 'hours', before: h.before, after: h.after, ...who(h.actor_id, h.actor_name) });
    for (const b of bk) ev.push({ at: b.created_at, type: 'booking', kind: b.kind, status: b.status, date: dateStr(b.date), start: b.start_min, end: b.end_min, name: b.student_name || '', note: b.note || '', ...who(b.created_by, b.created_by_name) });
    for (const l of leads) {
        const tr = parseExtra(l.extra_data).trialRequest;
        const at = Date.parse(tr?.requestedAt || ''); if (!Number.isFinite(at) || at < since.getTime()) continue;
        const ms = Date.parse(tr.scheduledAt || ''); if (!Number.isFinite(ms)) continue;
        const local = T.nowLocal(new Date(ms));
        ev.push({ at: new Date(at), type: 'trial', state: tr.state || 'pending', date: local.date, start: local.min, name: l.name || '', by: l.manager || '', role: 'sales_manager' });
    }
    return ev.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit).map(e => ({ ...e, at: new Date(e.at).toISOString() }));
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
function redactForSales(view, actor, managerId = null) {
    const { opens, ...rest } = view;
    return { ...rest, makeupOnly: (view.makeupOnly || []).map(m => ({ start: m.start, end: m.end, kind: m.kind })), items: view.items.map(i => {
        const mine = i.createdBy === actor.id || (!!managerId && i.managerId === String(managerId)) || (actor.role === 'rop' && i.kind === 'trial');
        // "Sinovga yopish" sababi sotuvga ham ko'rinadi (AdminJadvalUstoz: "Sabab — ustoz va sotuv ko'radi"); ta'til sababi — yo'q.
        const why = i.kind === 'close' && i.reason ? { reason: i.reason } : {};
        return { start: i.start, end: i.end, kind: i.kind === 'reserved' ? 'lesson' : i.kind, status: i.status, mine, ...why,
            bookingId: mine ? i.bookingId : undefined, leadId: mine ? i.leadId : undefined, fromLead: i.fromLead || undefined, holdUntil: i.holdUntil || undefined };
    }) };
}

// Lid sinovga yozilayotganda (CRM lid oynasi yoki "Kim bo'sh?") — server shu yerda
// to'qnashuvni tekshiradi. Menejerning shu lid uchun ushlab turgani o'ziga xalaqit bermaydi.
async function checkLeadTrial(db, lead, { actorId = null, now = new Date() } = {}) {
    const slots = leadTrialSlots(lead);
    if (!slots.length) return [];
    const teacherId = slots[0].teacherId;
    await lockTeacher(db, teacherId);
    const ctx = await loadContext(db, { teacherIds: [teacherId], from: slots[0].date, to: slots[slots.length - 1].date, now });
    ctx.excludeLeads.add(lead.id);
    ctx.bookings = ctx.bookings.filter(b => !(b.kind === 'trial' && b.status === 'hold' && (b.lead_id === lead.id || (actorId && b.created_by === actorId))));
    for (const sl of slots) checkSlot(dayView(ctx, teacherId, sl.date), 'trial', sl.start, sl.end);
    // Shu lid uchun ushlab turilgan vaqt endi kerak emas.
    await db.query(`UPDATE school_bookings SET status='cancelled', updated_at=NOW() WHERE lead_id=$1 AND kind='trial' AND status='hold'`, [lead.id]);
    return slots;
}

// ── Jadval v2: darslar holati, qoplash, lid ismi (sotuvga yuborilmaydi) ────────
const monthsOf = (from, to) => [...new Set(T.dateRange(from, to, 62).map(d => d.slice(0, 7)))];
// Davomat (main_attendance: present 1 = keldi, 0 = kelmadi), qoplash bog'lanishi va sinov lidining ismi.
// Faqat ustoz (o'ziniki) va admin/ROP ko'rinishi uchun chaqiriladi — redactForSales'dan oldin emas.
async function annotateViews(db, views, { from, to }) {
    const ids = [...new Set(views.flatMap(v => v.items.filter(i => i.studentId).map(i => i.studentId)))];
    const bookingIds = [...new Set(views.flatMap(v => v.items.filter(i => i.kind === 'makeup' && i.bookingId).map(i => i.bookingId)))];
    const leadIds = [...new Set(views.flatMap(v => v.items.filter(i => i.kind === 'trial' && i.leadId).map(i => i.leadId)))];
    const months = monthsOf(from, to);
    const [att, mk, dbl, leads] = await Promise.all([
        ids.length ? db.query(`SELECT student_id, LEFT(att_key, 7) AS month, day, present FROM main_attendance
            WHERE student_id = ANY($1::text[]) AND LEFT(att_key, 7) = ANY($2::text[])`, [ids, months]) : { rows: [] },
        bookingIds.length ? db.query('SELECT booking_id, missed_date, status FROM school_makeups WHERE booking_id = ANY($1::text[])', [bookingIds]) : { rows: [] },
        ids.length ? db.query(`SELECT student_id, held_date, missed_date, status FROM school_makeups WHERE kind='double' AND student_id = ANY($1::text[])
            AND held_date BETWEEN $2 AND $3 AND status IN ('planned','review','approved')`, [ids, from, to]) : { rows: [] },
        leadIds.length ? db.query('SELECT id, name, manager_id FROM leads WHERE id = ANY($1::text[])', [leadIds]) : { rows: [] }
    ]);
    const mark = new Map();
    for (const a of att.rows) {
        const key = `${a.student_id}|${a.month}-${String(a.day).padStart(2, '0')}`;
        const p = Number(a.present) === 1 || a.present === true ? 1 : 0;
        mark.set(key, Math.max(mark.get(key) ?? 0, p));
    }
    const mkBy = new Map(mk.rows.map(m => [m.booking_id, m]));
    const dblBy = new Map(dbl.rows.map(m => [`${m.student_id}|${dateStr(m.held_date)}`, m]));
    const leadBy = new Map(leads.rows.map(l => [l.id, l]));
    // Qoplash / bir martalik dars (school_bookings) — o'quvchi ismi students'dan.
    const noName = [...new Set(views.flatMap(v => v.items.filter(i => i.studentId && !i.studentName).map(i => i.studentId)))];
    const names = noName.length ? new Map((await db.query('SELECT id, name FROM students WHERE id = ANY($1::text[])', [noName])).rows.map(r => [r.id, r.name])) : new Map();
    for (const v of views) for (const i of v.items) {
        if (i.studentId && !i.studentName && names.has(i.studentId)) i.studentName = names.get(i.studentId);
        if (i.studentId && (i.kind === 'lesson' || i.kind === 'makeup')) {
            const m = mark.get(`${i.studentId}|${v.date}`);
            if (m != null && i.kind === 'lesson') i.att = m;
            const d = i.kind === 'lesson' && dblBy.get(`${i.studentId}|${v.date}`);
            if (d) { i.double = true; i.missedDate = dateStr(d.missed_date); }
        }
        if (i.kind === 'makeup' && i.bookingId) {
            const m = mkBy.get(i.bookingId);
            if (m) { i.missedDate = dateStr(m.missed_date); i.makeupStatus = m.status; }
        }
        if (i.kind === 'trial' && i.leadId && leadBy.has(i.leadId)) { i.leadName = leadBy.get(i.leadId).name || ''; i.managerId ||= leadBy.get(i.leadId).manager_id || ''; }
    }
    return views;
}
// Ustozga hali biriktirilmagan sinovlar (lid "Sinov darsida", vaqt bor, ustoz yo'q) — admin/ROP kun ko'rinishi.
async function unassignedTrials(db, { from, to, lang = null }) {
    const { rows } = await db.query("SELECT id, name, manager_id, language, extra_data FROM leads WHERE status = 'sinov-darsida' AND deleted_at IS NULL");
    const out = [];
    for (const r of rows) {
        if (lang && (r.language === 'russian' ? 'russian' : 'english') !== lang) continue;
        const l = parseLead(r);
        const tr = l.trialRequest, ob = l.paymentOnboarding || {};
        if (String(tr?.teacherId || ob.teacherId || '')) continue;
        if (tr && !['pending', 'accepted'].includes(tr.state || 'pending')) continue;
        const ms = Date.parse(tr?.scheduledAt || l.trialLessonAt || ''); if (!Number.isFinite(ms)) continue;
        const local = T.nowLocal(new Date(ms));
        if (local.date < from || local.date > to) continue;
        const duration = parseInt(l.paymentSurvey?.tariff, 10) || Number(ob.lessonDuration) || 30;
        out.push({ leadId: r.id, leadName: r.name || '', managerId: r.manager_id || '', date: local.date, start: local.min, end: local.min + duration });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
}
// Ustozning shu oy(lar)dagi qoldirilgan darslari (kelmadi) va ularning qoplash holati — "Qoplash darsini rejalashtirish" uchun.
// Asosiy ustoz "Kelmadi" belgilari — bitta manba (GET /attendance/absences, qoplash ro'yxati, qoplash tekshiruvi):
// school_absences + eski yozuvlar (ustoz belgilagan, lekin "Keldi" bo'lmagan dars — staff_att_lesson_marks).
// main_attendance faqat "Keldi"ni saqlaydi (kelmadi bo'lsa qator o'chiriladi).
async function teacherAbsences(db, { from, to, teacherId = '' }) {
    const month = from.slice(0, 7);
    const own = (await db.query(`SELECT teacher_id, student_id, TO_CHAR(day,'YYYY-MM-DD') AS day, absent FROM school_absences
        WHERE day BETWEEN $1 AND $2 AND ($3='' OR teacher_id=$3)`, [from, to, teacherId])).rows;
    let marks = [];
    if ((await db.query("SELECT to_regclass('public.staff_att_lesson_marks')::text AS t")).rows[0]?.t) {
        marks = (await db.query(`SELECT m.teacher_id, m.student_id, TO_CHAR(m.lesson_date,'YYYY-MM-DD') AS day FROM staff_att_lesson_marks m
            WHERE m.duty='main' AND m.lesson_date BETWEEN $1 AND $2 AND ($3='' OR m.teacher_id=$3)
            AND NOT EXISTS (SELECT 1 FROM main_attendance a WHERE a.att_key = $4 || '_' || m.teacher_id AND a.student_id=m.student_id
                AND a.day = EXTRACT(DAY FROM m.lesson_date)::int AND a.present = 1)`, [from, to, teacherId, month])).rows;
    }
    const key = r => `${r.teacher_id}|${r.student_id}|${r.day}`;
    const explicit = new Map(own.map(r => [key(r), r.absent]));
    const out = own.filter(r => r.absent).map(r => ({ teacherId: r.teacher_id, studentId: r.student_id, day: r.day }));
    for (const m of marks) if (!explicit.has(key(m))) out.push({ teacherId: m.teacher_id, studentId: m.student_id, day: m.day });
    return out;
}

async function missedLessons(db, teacherId, { from, to }) {
    const months = monthsOf(from, to);
    // Eski yozuvlar (present = 0) + school_absences — faqat hozir shu ustozning o'quvchilari.
    const { rows: legacy } = await db.query(`SELECT a.student_id, LEFT(a.att_key, 7) AS month, a.day FROM main_attendance a JOIN students s ON s.id = a.student_id
        WHERE s.teacher_id = $1 AND a.present = 0 AND LEFT(a.att_key, 7) = ANY($2::text[])`, [teacherId, months]);
    const mine = new Set((await db.query('SELECT id FROM students WHERE teacher_id = $1', [teacherId])).rows.map(r => r.id));
    const abs = [];
    for (const m of months) {
        const b = T.monthBounds(m);
        abs.push(...(await teacherAbsences(db, { from: b.from, to: b.to, teacherId })).filter(a => mine.has(a.studentId)));
    }
    const mk = (await db.query(`SELECT student_id, missed_date, held_date, status FROM school_makeups WHERE teacher_id = $1
        AND status IN ('planned','review','approved') AND to_char(missed_date, 'YYYY-MM') = ANY($2::text[])`, [teacherId, months])).rows;
    const by = new Map(mk.map(m => [`${m.student_id}|${dateStr(m.missed_date)}`, m]));
    const seen = new Set();
    return [...legacy.map(r => ({ studentId: r.student_id, date: `${r.month}-${String(r.day).padStart(2, '0')}` })),
        ...abs.map(a => ({ studentId: a.studentId, date: a.day }))]
        .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.date) && !seen.has(x.studentId + x.date) && seen.add(x.studentId + x.date))
        .map(x => { const m = by.get(`${x.studentId}|${x.date}`); return { ...x, makeup: m ? { status: m.status, heldDate: dateStr(m.held_date) } : null }; })
        .sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = { annotateViews, unassignedTrials, missedLessons, teacherAbsences, HOLD_MINUTES, studentRow, statusOn, teacherOn, dateStr, loadContext, dayView, checkSlot, fits, book, confirmHold,
    transition, releaseLead, checkWeekly, addOverride, removeOverride, updateOverride, overrideImpact, setHours, changes, assertTeacher, daySummary, redactForSales, lockTeacher, leadTrialSlots, checkLeadTrial };
