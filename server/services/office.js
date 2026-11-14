'use strict';
// "Jonli ofis" — xodimlar, ustozlar va o'quvchilar holatini bitta suratda beradi (GET /api/office/live).
// Faqat O'QIYDI: hech qanday jadvalga yozmaydi. Har bir bo'lim alohida try ichida — biror jadval hali
// yaratilmagan bo'lsa (42P01) yoki xato bersa, qolgan bo'limlar baribir qaytadi.
//
// Rol bo'yicha ko'rinish (Abdulloh, 2026-11-15):
//   admin, boshliq      — hammasi: summalar, kechikishlar.
//   rop                 — sotuv to'liq (summa bilan), o'z til yo'nalishi; sotuv xodimlari kechikishi.
//   akademik            — ustozlar, darslar, o'quvchilar, davomat; o'z til yo'nalishi; ustoz/yordamchi kechikishi.
//   qolganlar va TV     — odamlar va voqealar; summa, kechikish va jarima yo'q.
// Mijoz (lid/o'quvchi) telefoni hech kimga berilmaydi; ism faqat birinchi so'z.

const T = require('./school/time');
const workflow = require('../../js/trialWorkflow');

const MAIN_TEACHER = new Set(['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi', 'asosiy']);
const KIND = r => r === 'sotuv-menejeri' || r === 'sotuv_menejeri' ? 'mgr' : r === 'rop' ? 'rop'
    : r === 'head-of-teachers' ? 'akad' : r === 'yordamchi' ? 'yord' : r === 'hr' ? 'hr'
    : r === 'targetolog' ? 'target' : MAIN_TEACHER.has(r) ? 'teacher' : 'other';
const CALL_TYPES = new Set(['call-attempt', 'contact-fail']);
const LOST = new Set(['muvaffaqiyatsiz-sotuv', 'sifatsiz-lidlar']);
const LANGS = ['english', 'russian'];

const first = s => String(s || '').trim().split(/\s+/)[0] || '';
const iso = v => (v ? new Date(v).toISOString() : null);
const safe = async (fn, fallback) => { try { return await fn(); } catch (e) { if (e.code !== '42P01' && e.code !== '42703') console.warn('[office]', e.message); return fallback; } };
const parse = v => { if (!v) return {}; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return {}; } };
const langOk = (langs, l) => !langs || langs.includes(l === 'russian' ? 'russian' : 'english');

async function viewerFor(db, user, { tv = false, lang = null } = {}) {
    const role = user?.role || '';
    let scope = 'team', langs = null;
    if (!tv && (role === 'admin' || role === 'boshliq')) scope = 'full';
    else if (!tv && role === 'rop') { scope = 'sales'; langs = await safe(() => require('./ropScope').ropLangsFor(db, user), null); }
    else if (!tv && role === 'akademik') { scope = 'academic'; langs = await safe(() => require('./academicHead').langsFor(db, user), null); }
    if (LANGS.includes(lang)) langs = langs ? langs.filter(l => l === lang) : [lang];
    return { role, tv, scope, langs, money: scope === 'full' || scope === 'sales',
        lateFor: scope === 'full' ? 'all' : scope === 'sales' ? 'sales' : scope === 'academic' ? 'academic' : null };
}

async function staffList(db) {
    return (await db.query(`SELECT id, name, first_name, role, COALESCE(lang,'english') AS lang FROM hr_employees
        WHERE COALESCE(status,'active') NOT IN ('inactive','fired','left','archived') ORDER BY name`)).rows;
}

async function attendanceToday(db, list, date, now) {
    const att = require('./staffAttendance');
    const settings = await att.getSettings(db);
    const events = (await db.query(`SELECT employee_id, kind, occurred_at FROM staff_att_events WHERE work_date=$1 AND ok ORDER BY occurred_at`, [date])).rows;
    const out = new Map();
    for (const e of list) {
        const mine = events.filter(x => x.employee_id === e.id);
        const lastIn = [...mine].reverse().find(x => x.kind === 'in'), lastOut = [...mine].reverse().find(x => x.kind === 'out');
        const day = await safe(() => att.computeDay(db, e.id, date, settings, now), null);
        out.set(e.id, { inAt: iso(mine.find(x => x.kind === 'in')?.occurred_at), outAt: iso(lastOut?.occurred_at),
            inOffice: !!lastIn && (!lastOut || new Date(lastOut.occurred_at) < new Date(lastIn.occurred_at)),
            status: day?.status || null, lateMin: Number(day?.lateMinutes) || 0 });
    }
    return { map: out, events };
}

async function teacherBoard(db, teachers, students, date, nowMin) {
    const S = require('./school/schedule');
    const ctx = await S.loadContext(db, { teacherIds: teachers.map(t => t.id), from: date, to: date });
    const marks = (await safe(() => db.query('SELECT teacher_id, student_id FROM staff_att_lesson_marks WHERE lesson_date=$1', [date]), { rows: [] })).rows;
    const marked = new Set(marks.map(m => m.teacher_id + '|' + m.student_id));
    const names = new Map(students.map(s => [s.id, s.name]));
    return teachers.map(t => {
        const v = S.dayView(ctx, t.id, date);
        const now = v.items.filter(i => i.start <= nowMin && nowMin < i.end);
        const trial = now.find(i => i.kind === 'trial');
        const lessons = now.filter(i => i.kind === 'lesson' && i.studentId);
        const done = v.items.filter(i => i.kind === 'lesson' && i.studentId && i.end <= nowMin);
        const unmarked = done.filter(i => !marked.has(t.id + '|' + i.studentId)).length;
        const groupIds = [...new Set(v.items.filter(i => i.kind === 'lesson' && i.studentId).map(i => i.studentId))];
        return { id: t.id, name: first(t.first_name || t.name), lang: t.lang,
            status: trial ? 'trial' : lessons.length ? 'live' : 'free',
            nowStudents: lessons.map(i => ({ id: i.studentId, name: first(names.get(i.studentId) || i.studentName) })),
            todayStudents: groupIds.length, lessonsDone: done.length,
            dav: !done.length ? null : unmarked ? 'pending' : 'ok',
            next: (v.items.find(i => (i.kind === 'lesson' || i.kind === 'trial') && i.start > nowMin) || {}).start ?? null };
    });
}

async function activeStudents(db, langs, date) {
    const R = require('../../js/attendanceRules');
    const rows = (await db.query('SELECT id, name, subject, teacher_id, assistant_teacher_id, extra_data FROM students')).rows;
    const st = (await safe(() => db.query('SELECT * FROM school_student_status WHERE cancelled_at IS NULL'), { rows: [] })).rows;
    const by = new Map(); for (const r of st) { if (!by.has(r.student_id)) by.set(r.student_id, []); by.get(r.student_id).push(r); }
    const out = [];
    for (const r of rows) {
        const x = parse(r.extra_data); if (x.isStaffDemo === true) continue;
        if (!langOk(langs, r.subject)) continue;
        const s = by.get(r.id) || [];
        const state = s.length ? R.statusOn(s, date) : (R.isActiveStudent(r) ? 'active' : x.frozen === true ? 'frozen' : 'left');
        if (state !== 'active') continue;
        out.push({ id: r.id, name: first(r.name), teacherId: r.teacher_id || null, assistantId: r.assistant_teacher_id || null });
    }
    return out;
}

async function appActivity(db, ids, since) {
    if (!ids.length) return { online: [], lessons: 0, exams: [] };
    const online = (await safe(() => db.query(`SELECT student_id, MAX(updated_at) AS at, MAX(lesson_id) AS lesson FROM student_learning_time
        WHERE student_id = ANY($1::text[]) AND updated_at > NOW() - INTERVAL '10 minutes' GROUP BY student_id`, [ids]), { rows: [] })).rows;
    const parts = (await safe(() => db.query(`SELECT COUNT(*)::int AS n FROM student_part_results WHERE student_id = ANY($1::text[]) AND passed AND updated_at >= $2`, [ids, since]), { rows: [{ n: 0 }] })).rows[0].n;
    const exams = (await safe(() => db.query(`SELECT student_id, exam_id, last_percent, passed, updated_at FROM student_exam_results
        WHERE student_id = ANY($1::text[]) AND updated_at >= $2 ORDER BY updated_at`, [ids, since]), { rows: [] })).rows;
    return { online: online.map(o => ({ id: o.student_id, at: iso(o.at), lesson: o.lesson || '' })), lessons: parts, exams };
}

// Bugungi lid voqealari — lead_audit (oldin/keyin) dan.
async function leadEvents(db, since, langs) {
    const rows = (await db.query(`SELECT a.id, a.lead_id, a.action, a.actor_name, a.created_at, a.snapshot, l.language
        FROM lead_audit a JOIN leads l ON l.id = a.lead_id
        WHERE a.created_at >= $1 AND a.action IN ('created','updated') ORDER BY a.created_at, a.id LIMIT 3000`, [since])).rows;
    const ev = [];
    for (const r of rows) {
        if (!langOk(langs, r.language)) continue;
        const snap = parse(r.snapshot), after = r.action === 'created' ? (snap.after || snap) : (snap.after || {}), before = snap.before || {};
        const base = { at: iso(r.created_at), leadId: r.lead_id, lead: first(after.name), lang: r.language === 'russian' ? 'russian' : 'english' };
        if (r.action === 'created') { ev.push({ ...base, id: 'l' + r.id, type: 'lead_new', src: after.leadType === 'target' ? 'target' : 'organic', managerId: after.managerId || '' }); continue; }
        if (!before.managerId && after.managerId) ev.push({ ...base, id: 'a' + r.id, type: 'lead_assigned', managerId: after.managerId });
        const nb = (before.comments || []).length, na = (after.comments || []).length;
        for (const c of (after.comments || []).slice(nb, na)) {
            if (CALL_TYPES.has(c?.type)) ev.push({ ...base, id: 'c' + r.id + ':' + nb, type: c.type === 'contact-fail' ? 'call_fail' : 'call', managerId: after.managerId || '' });
        }
        if (before.status !== after.status && after.status) {
            const st = after.status, m = after.managerId || '';
            if (st === 'sinov-darsida') {
                const req = workflow.request(after);
                ev.push({ ...base, id: 's' + r.id, type: 'trial_booked', managerId: m, teacherId: req?.teacherId || '' });
            } else if (LOST.has(st)) ev.push({ ...base, id: 'x' + r.id, type: st === 'sifatsiz-lidlar' ? 'lead_junk' : 'lead_lost', managerId: m });
            else if (st === 'qaror-jarayonida') ev.push({ ...base, id: 'q' + r.id, type: 'decision', managerId: m });
            else if (st === 'boglanildi') ev.push({ ...base, id: 'b' + r.id, type: 'contacted', managerId: m });
        }
    }
    return ev;
}

async function payments(db, date, langs) {
    const rows = (await db.query(`SELECT p.id, p.lead_id, p.student_id, p.language, p.manager_id, p.amount, p.paid_at, p.created_at, p.form,
            COALESCE(l.name, s.name, '') AS who,
            (p.lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payment_records q WHERE q.student_id = p.student_id AND q.student_id IS NOT NULL
                AND (q.paid_date < p.paid_date OR (q.paid_date = p.paid_date AND q.created_at < p.created_at)))) AS is_new
        FROM payment_records p LEFT JOIN leads l ON l.id = p.lead_id LEFT JOIN students s ON s.id = p.student_id
        WHERE p.paid_date = $1 AND NOT EXISTS (SELECT 1 FROM payment_record_voids v WHERE v.record_id = p.id)
        ORDER BY p.created_at`, [date])).rows;
    return rows.filter(r => langOk(langs, r.language)).map(r => ({ id: 'p' + r.id, type: r.is_new ? 'sale' : 'debt_payment', at: iso(r.created_at),
        managerId: r.manager_id || '', lead: first(r.who), amount: Number(r.amount) || 0, lang: r.language }));
}

async function live(db, user, query = {}, now = new Date()) {
    const v = await viewerFor(db, user, { tv: query.tv === '1' || query.tv === 'true', lang: query.lang });
    const { date, min: minutes } = T.nowLocal(now);
    const dayStart = new Date(Date.parse(`${date}T00:00:00Z`) - T.TZ_OFFSET_MIN * 60000);

    const all = await safe(() => staffList(db), []);
    const inLang = e => !v.langs || v.langs.includes(String(e.lang || '').toLowerCase()) || String(e.lang || '').toLowerCase() === 'both';
    const office = all.filter(e => ['mgr', 'rop', 'akad', 'yord', 'hr'].includes(KIND(e.role)) && inLang(e));
    const teachers = all.filter(e => KIND(e.role) === 'teacher' && inLang(e));

    const att = await safe(() => attendanceToday(db, office, date, now), { map: new Map(), events: [] });
    const lateVisible = k => v.lateFor === 'all' || (v.lateFor === 'sales' && (k === 'mgr' || k === 'rop')) || (v.lateFor === 'academic' && (k === 'yord' || k === 'akad'));
    const staff = office.map(e => {
        const a = att.map.get(e.id) || {}, k = KIND(e.role);
        return { id: e.id, name: first(e.first_name || e.name), kind: k, lang: e.lang, inOffice: !!a.inOffice, inAt: a.inAt || null, outAt: a.outAt || null,
            late: lateVisible(k) && a.lateMin > 0 ? a.lateMin : null };
    });
    const names = new Map(all.map(e => [e.id, first(e.first_name || e.name)]));

    const students = await safe(() => activeStudents(db, v.langs, date), []);
    const board = await safe(() => teacherBoard(db, teachers, students, date, minutes), teachers.map(t => ({ id: t.id, name: first(t.name), status: 'free', nowStudents: [], todayStudents: 0, lessonsDone: 0, dav: null })));
    const app = await safe(() => appActivity(db, students.map(s => s.id), dayStart), { online: [], lessons: 0, exams: [] });
    const sName = new Map(students.map(s => [s.id, s]));

    const leadEv = await safe(() => leadEvents(db, dayStart, v.langs), []);
    const payEv = await safe(() => payments(db, date, v.langs), []);
    const counts = (await safe(() => db.query(`SELECT status, language, COUNT(*)::int AS n FROM leads WHERE deleted_at IS NULL
        AND (created_at >= $1 OR updated_at >= $1) GROUP BY status, language`, [dayStart]), { rows: [] })).rows;
    const col = {};
    for (const c of counts) if (langOk(v.langs, c.language)) col[c.status] = (col[c.status] || 0) + c.n;

    const events = [];
    for (const r of att.events) {
        const e = office.find(x => x.id === r.employee_id); if (!e) continue;
        const k = KIND(e.role), s = staff.find(x => x.id === e.id);
        events.push({ id: 'f' + e.id + r.kind + new Date(r.occurred_at).getTime(), type: r.kind === 'in' ? 'checkin' : 'checkout', at: iso(r.occurred_at), staffId: e.id,
            late: r.kind === 'in' && s?.late && s.inAt === iso(r.occurred_at) ? s.late : null, kind: k });
    }
    for (const e of leadEv) events.push(e);
    for (const p of payEv) {
        const ev = { ...p };
        if (!v.money) delete ev.amount;
        if (v.scope === 'academic' && ev.type === 'debt_payment') continue;
        events.push(ev);
    }
    for (const x of app.exams) {
        const s = sName.get(x.student_id); if (!s) continue;
        events.push({ id: 'e' + x.student_id + x.exam_id + new Date(x.updated_at).getTime(), type: 'exam', at: iso(x.updated_at), studentId: x.student_id, student: s.name,
            percent: Number(x.last_percent) || 0, passed: !!x.passed, teacherId: s.teacherId });
    }
    events.sort((a, b) => String(a.at).localeCompare(String(b.at)) || String(a.id).localeCompare(String(b.id)));
    const sinceAt = query.since ? new Date(query.since) : null;
    const outEvents = sinceAt && !Number.isNaN(sinceAt.getTime()) ? events.filter(e => new Date(e.at) > sinceAt) : events.slice(-60);

    const sales = payEv.filter(p => p.type === 'sale');
    const kpi = {
        inOffice: staff.filter(s => s.inOffice).length, staff: staff.length,
        leads: leadEv.filter(e => e.type === 'lead_new').length,
        target: leadEv.filter(e => e.type === 'lead_new' && e.src === 'target').length,
        calls: leadEv.filter(e => e.type === 'call' || e.type === 'call_fail').length,
        trials: leadEv.filter(e => e.type === 'trial_booked').length,
        sales: sales.length,
        live: board.filter(t => t.status === 'live').length, trialNow: board.filter(t => t.status === 'trial').length, freeTeachers: board.filter(t => t.status === 'free').length,
        students: students.length, online: app.online.length, appLessons: app.lessons, exams: app.exams.length
    };
    if (v.money) { kpi.money = sales.reduce((s, p) => s + p.amount, 0); kpi.debtMoney = payEv.filter(p => p.type === 'debt_payment').reduce((s, p) => s + p.amount, 0); }

    return {
        now: now.toISOString(), date, minutes,
        viewer: { role: v.role, scope: v.scope, tv: v.tv, money: v.money, langs: v.langs },
        staff, teachers: board,
        students: { online: app.online.map(o => ({ id: o.id, name: sName.get(o.id)?.name || '', teacherId: sName.get(o.id)?.teacherId || null, at: o.at })) },
        board: col, kpi, names: Object.fromEntries(names), events: outEvents
    };
}

// Bir xil so'rovlar ko'p ekrandan kelsa (TV + telefonlar), bazani 8 soniyada bir marta so'raymiz.
const cache = new Map();
async function liveCached(db, user, query = {}) {
    const key = [user?.role, user?.id, query.tv, query.lang, query.since ? 's' : ''].join('|');
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < 8000 && !query.since) return hit.v;
    const v = await live(db, user, query);
    if (!query.since) cache.set(key, { t: Date.now(), v });
    if (cache.size > 200) cache.clear();
    return v;
}

module.exports = { live, liveCached, viewerFor, KIND };
