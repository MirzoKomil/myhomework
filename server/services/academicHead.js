'use strict';
// Akademik rahbar (login roli 'akademik', HR lavozimi 'head-of-teachers') kabineti — server qismi.
// Kelishuv: AKADEMIK-API.md. Faqat mavjud manbalardan o'qiladi (students, main_attendance, school_absences,
// school_makeups, school_assist_contacts, school_requests, leads, ilova progressi, ustozlar reytingi, maosh).
// O'zi yozadigan jadvallar: academic_problems, academic_problem_events va school_makeups dagi tekshiruv ustunlari.
// Til: akademik faqat HR'dagi o'z yo'nalish(lar)ini ko'radi (hr_employees.lang: english | russian | both);
// admin/boshliq — hammasi (?lang= bilan tanlash mumkin).
const { randomUUID } = require('node:crypto');
const T = require('./school/time');
const S = require('./school/schedule');
const A = require('./school/assist');
const R = require('../../js/attendanceRules');
const workflow = require('../../js/trialWorkflow');
const { fail } = T;

const LANGS = ['english', 'russian'];
const FULL = new Set(['admin', 'boshliq']);
const HEAD_ROLES = ['admin', 'boshliq', 'akademik'];
const MAIN_TEACHER_ROLES = ['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi'];
const PROBLEM_TYPES = ['teacher', 'app', 'schedule', 'payment', 'other'];
const PROBLEM_SOURCES = ['student', 'teacher', 'assistant', 'sales', 'self'];
const PROBLEM_STAGES = ['logged', 'assigned', 'in_progress', 'closed'];
const PROBLEM_RESULTS = ['solved', 'teacher_changed', 'unsolved'];
const EVENT_KINDS = ['created', 'assigned', 'stage', 'comment', 'call', 'postponed', 'reminded', 'closed'];
// Qoidalar (kelishuv): onPlan — rejadan 3 tadan ko'p orqada emas; xavf: ilovaga 3+ kun kirmagan, 2+ ketma-ket kelmagan, 6+ dars orqada.
const ON_PLAN_MAX_BEHIND = 3;
const RISK_IDLE_DAYS = 3;
const RISK_ABSENT_STREAK = 2;
const RISK_BEHIND = 6;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS academic_problems (
 id TEXT PRIMARY KEY, lang TEXT NOT NULL DEFAULT 'english',
 student_id TEXT NOT NULL, student_name TEXT NOT NULL DEFAULT '', teacher_id TEXT, teacher_name TEXT NOT NULL DEFAULT '',
 type TEXT NOT NULL CHECK (type IN ('teacher','app','schedule','payment','other')),
 source TEXT NOT NULL CHECK (source IN ('student','teacher','assistant','sales','self')),
 title TEXT NOT NULL, details TEXT NOT NULL DEFAULT '',
 owner_id TEXT, owner_name TEXT NOT NULL DEFAULT '',
 stage TEXT NOT NULL DEFAULT 'logged' CHECK (stage IN ('logged','assigned','in_progress','closed')),
 due_at TIMESTAMPTZ NOT NULL,
 result TEXT CHECK (result IS NULL OR result IN ('solved','teacher_changed','unsolved')), result_note TEXT NOT NULL DEFAULT '',
 followup_at TIMESTAMPTZ,
 created_by TEXT NOT NULL, created_by_name TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 closed_at TIMESTAMPTZ, remind_count INTEGER NOT NULL DEFAULT 0, last_remind_at TIMESTAMPTZ, removed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS academic_problems_open ON academic_problems(stage, due_at) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS academic_problems_student ON academic_problems(student_id);
CREATE TABLE IF NOT EXISTS academic_problem_events (
 id TEXT PRIMARY KEY, problem_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('created','assigned','stage','comment','call','postponed','reminded','closed')),
 text TEXT NOT NULL DEFAULT '', actor_name TEXT NOT NULL DEFAULT '', at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS academic_problem_events_problem ON academic_problem_events(problem_id, at);
ALTER TABLE school_makeups ADD COLUMN IF NOT EXISTS check_status TEXT;
ALTER TABLE school_makeups ADD COLUMN IF NOT EXISTS check_note TEXT NOT NULL DEFAULT '';
ALTER TABLE school_makeups ADD COLUMN IF NOT EXISTS checked_by_name TEXT NOT NULL DEFAULT '';
ALTER TABLE school_makeups ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;
`;
const ready = { ok: false };
async function initSchema(pool) { await pool.query(SCHEMA); ready.ok = true; }

// ── Sof yordamchilar (scripts/akademik-role.test.cjs) ─────────────────────────
// HR'dagi til → ['english'] | ['russian'] | ikkalasi. Belgilanmagan / noma'lum — [] (hech narsa ko'rinmaydi).
function langsFromHr(raw) {
    const l = String(raw || '').trim().toLowerCase();
    if (l === 'both') return [...LANGS];
    if (l === 'russian' || l === 'rus') return ['russian'];
    if (l === 'english') return ['english'];
    return [];
}
const studentLang = subject => (String(subject || '').trim().toLowerCase() === 'russian' ? 'russian' : 'english');
// school.js langOf bilan bir xil: lavozim asosiy, keyin lang ustuni.
const teacherLang = e => !e ? null : e.lang === 'both' ? 'both' : e.role === 'rus-oqituvchi' ? 'russian' : e.role === 'ingliz-oqituvchi' ? 'english' : e.lang === 'russian' ? 'russian' : 'english';
const teacherFits = (e, langs) => !langs || (teacherLang(e) === 'both' ? langs.length > 0 : langs.includes(teacherLang(e)));
// Masʼul xodim akademikning tilidami: ustoz/yordamchi — lavozim tili; boshqa xodim — HR lang (bo'sh yoki 'both' — umumiy).
const LANG_ROLES = new Set(['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi', 'yordamchi']);
function ownerFits(e, langs) {
    if (!langs) return true;
    if (!e || !langs.length) return false;
    if (LANG_ROLES.has(e.role)) return teacherFits(e, langs);
    const l = langsFromHr(e.lang);
    return !l.length || l.some(x => langs.includes(x));
}
const shortLang = l => (l === 'russian' ? 'rus' : 'english');

// Reja bo'yicha: expected — kurs boshidan kutilgan dars, reached — ilovada yetgan dars.
function behindBy(expected, reached) {
    if (!Number.isFinite(Number(expected)) || expected == null) return 0;
    return Math.max(0, Number(expected) - (Number(reached) || 0));
}
function isOnPlan(expected, reached) { return behindBy(expected, reached) <= ON_PLAN_MAX_BEHIND; }
function onPlanPct(list) { return list.length ? Math.round(list.filter(x => x.onPlan).length / list.length * 100) : null; }

// Oxirgi darslardan ketma-ket "kelmadi" soni. lessons: [{date, status:'came'|'missed'|null}] (vaqt bo'yicha);
// belgilanmagan dars (null) zanjirni uzmaydi va sanalmaydi.
function absentStreak(lessons) {
    let n = 0;
    for (const l of [...(lessons || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)))) {
        if (l.status === 'missed') n++;
        else if (l.status === 'came') break;
    }
    return n;
}
// Bitta asosiy sabab: noapp > absent > behind. daysIdle null — ilovaga umuman kirmagan.
// startedDays — kurs boshlanganidan beri kun (yangi o'quvchi 3 kundan kam bo'lsa "ilovaga kirmagan" deb belgilanmaydi).
function riskReason({ daysIdle, streak = 0, behind = 0, frozen = false, startedDays = null } = {}) {
    if (frozen) return null;
    const fresh = startedDays != null && startedDays < RISK_IDLE_DAYS;
    if (!fresh && (daysIdle === null || daysIdle === undefined || daysIdle >= RISK_IDLE_DAYS))
        return { reason: 'noapp', reasonText: daysIdle == null ? 'Ilovaga hali kirmagan' : `${daysIdle} kundan beri ilovaga kirmagan` };
    if (streak >= RISK_ABSENT_STREAK) return { reason: 'absent', reasonText: `Oxirgi ${streak} darsga ketma-ket kelmadi` };
    if (behind >= RISK_BEHIND) return { reason: 'behind', reasonText: `Rejadan ${behind} dars orqada` };
    return null;
}
// Qoplashni rad etish oynasi (school.js /makeups/:id/decide bilan bir qoida): shu oy yoki o'tgan oy + keyingi oyning 4-sanasigacha.
function nextMonth(month) { const [y, m] = month.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; }
function makeupRejectWindow(heldDate, today) {
    const m = String(heldDate || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) return { deadline: null, canReject: false };
    const deadline = `${nextMonth(m)}-04`;
    return { deadline, canReject: String(today) <= deadline };
}
// Kechikkan aloqa qoidasi: faqat joriy oy; qo'ng'iroq ≥5 daqiqa (kuniga 1 ta o'quvchiga); yozishma haftasiga 1 ta.
function lateRuleCheck({ kind, minutes, day, today, countedThatDay = false, textThisWeek = false }) {
    if (!day || String(day).slice(0, 7) !== String(today).slice(0, 7)) return { ok: false, text: 'Faqat joriy oy uchun tasdiqlanadi' };
    if (countedThatDay) return { ok: false, text: 'Shu kuni hisoblangan aloqa bor — kuniga bittasi sanaladi' };
    if (kind === 'message') {
        if (textThisWeek) return { ok: false, text: 'Bu haftada yozishma allaqachon sanalgan — haftasiga bittasi' };
        return { ok: true, text: 'Yozishma · haftasiga 1 ta — qoidaga mos' };
    }
    if ((Number(minutes) || 0) < A.MIN_MINUTES) return { ok: false, text: `Qoʻngʻiroq ${Number(minutes) || 0} daqiqa — kamida ${A.MIN_MINUTES} daqiqa boʻlishi kerak` };
    return { ok: true, text: `Qoʻngʻiroq ${Number(minutes)} daqiqa — qoidaga mos` };
}
function scheduleText(day, time) {
    const p = T.patternDays(day).join();
    const days = p === '1,3,5' ? 'toq kunlar' : p === '2,4,6' ? 'juft kunlar' : T.patternLabel(day);
    return [days, time].filter(Boolean).join(' ');
}
const parseExtra = raw => { if (!raw) return {}; if (typeof raw === 'object') return raw; try { return JSON.parse(raw); } catch { return {}; } };
const atLocal = (date, min) => new Date(Date.parse(`${date}T00:00:00Z`) + (min - T.TZ_OFFSET_MIN) * 60000).toISOString();
const iso = v => (v ? new Date(v).toISOString() : null);
const daysAgo = (now, n) => new Date(now.getTime() - n * 86400000);

// ── Kirish va til ─────────────────────────────────────────────────────────────
async function hrRow(db, user) {
    if (!user?.email) return null;
    return (await db.query(`SELECT * FROM hr_employees WHERE LOWER(TRIM(login))=LOWER(TRIM($1)) AND COALESCE(status,'active') <> 'inactive'
        ORDER BY (role='head-of-teachers') DESC, id LIMIT 1`, [user.email])).rows[0] || null;
}
// null — cheklov yo'q (admin/boshliq), [] — hech narsa (akademikning HR yozuvi yo'q).
async function langsFor(db, user) {
    if (user?.role !== 'akademik') return null;
    return langsFromHr((await hrRow(db, user))?.lang);
}
async function scopeLangs(db, user, query = {}) {
    if (!HEAD_ROLES.includes(user?.role)) throw fail(403, 'Bu amalga ruxsat yoʻq');
    const own = await langsFor(db, user);
    const q = LANGS.includes(query.lang) ? query.lang : null;
    if (!own) return q ? [q] : null;
    return q && own.includes(q) ? [q] : own;
}
const inLangs = (langs, subject) => !langs || langs.includes(studentLang(subject));

async function me(db, user) {
    const emp = await hrRow(db, user);
    const langs = user.role === 'akademik' ? langsFromHr(emp?.lang) : [...LANGS];
    return { name: user.name || emp?.name || '', langs: langs.map(shortLang), role: user.role, employeeId: emp?.id || null };
}

// ── Umumiy ma'lumot (60 soniya keshlanadi) ────────────────────────────────────
const cache = new Map();
async function cached(key, ttlMs, fn) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.p;
    const p = fn(); cache.set(key, { at: Date.now(), p });
    p.catch(() => cache.delete(key));
    return p;
}
function invalidate() { cache.clear(); }

async function staffRows(db) {
    return (await db.query(`SELECT he.id, he.name, he.role, he.lang, he.status, he.phone, he.login FROM hr_employees he
        WHERE COALESCE(he.status,'active') <> 'inactive' ORDER BY he.name`)).rows;
}
// Til bo'yicha faol o'quvchilar, ilova progressi, ketma-ket kelmaslik va oxirgi darslar.
async function scopeData(db, langs, now = new Date()) {
    return cached('scope:' + (langs ? langs.join(',') : '*'), 60000, () => buildScope(db, langs, now));
}
async function buildScope(db, langs, now) {
    const today = T.nowLocal(now).date;
    const staff = await staffRows(db);
    const names = new Map(staff.map(e => [e.id, e.name]));
    const teachers = staff.filter(e => MAIN_TEACHER_ROLES.includes(e.role) && teacherFits(e, langs));
    const assistants = staff.filter(e => e.role === 'yordamchi' && teacherFits(e, langs));
    const rows = (await db.query(`SELECT id, name, phone, subject, teacher_id, assistant_teacher_id, lesson_day_of_week, lesson_time, lesson_duration, extra_data FROM students`)).rows
        .filter(r => inLangs(langs, r.subject));
    const ids = rows.map(r => r.id);
    const statusBy = new Map();
    if (ids.length) for (const r of (await db.query('SELECT * FROM school_student_status WHERE cancelled_at IS NULL AND student_id = ANY($1::text[])', [ids])).rows) {
        if (!statusBy.has(r.student_id)) statusBy.set(r.student_id, []); statusBy.get(r.student_id).push(r);
    }
    const students = [];
    for (const r of rows) {
        const x = parseExtra(r.extra_data);
        if (x.isStaffDemo === true) continue;
        const st = statusBy.get(r.id) || [];
        const state = st.length ? S.statusOn(st, today) : (R.isActiveStudent(r) ? 'active' : x.frozen === true ? 'frozen' : 'left');
        if (state === 'left') continue;
        students.push({ id: r.id, name: r.name, phone: r.phone || '', subject: studentLang(r.subject), teacherId: r.teacher_id || null, assistantId: r.assistant_teacher_id || null,
            day: r.lesson_day_of_week, time: r.lesson_time || '', duration: Number(r.lesson_duration) || 30, startDate: A.studentStartOf(x),
            state, frozen: state === 'frozen', statusRows: st, extra: x, teacherName: names.get(r.teacher_id) || '' });
    }
    const active = students.filter(s => !s.frozen);
    let progress = {};
    try { progress = await require('./academicHub').progressForIds(db, active.map(s => s.id)); } catch (e) { if (e.code !== '42P01') throw e; }
    const hub = require('./academicHub');
    const lessons = await recentLessons(db, active, now);
    for (const s of students) {
        const p = progress[s.id] || null;
        s.reached = p ? Number(p.reached) || 0 : 0;
        s.daysIdle = p ? p.daysIdle : null;
        // Muzlatish davrlari (bekor qilinmagan) — rejadan chiqariladi.
        const sd = s.startDate ? new Date(s.startDate) : null;
        const paused = (s.statusRows || []).filter(r => r.status === 'frozen').reduce((n, r) => {
            const a = new Date(r.from_date), b = r.to_date ? new Date(r.to_date) : now;
            const from = sd && sd > a ? sd : a, to = b < now ? b : now;
            return n + Math.max(0, Math.round((to - from) / 86400000));
        }, 0);
        s.expected = s.frozen ? null : hub.expectedLesson(s.startDate, now, paused);
        s.behind = behindBy(s.expected, s.reached);
        s.onPlan = isOnPlan(s.expected, s.reached);
        s.lessons = lessons.get(s.id) || [];
        s.streak = absentStreak(s.lessons);
        s.risk = riskReason({ daysIdle: s.daysIdle, streak: s.streak, behind: s.behind, frozen: s.frozen, startedDays: s.startDate ? T.daysBetween(s.startDate, today) : null });
    }
    return { langs, today, staff, names, teachers, assistants, students, active };
}
// So'nggi 35 kundagi dars kunlari (o'quvchi faol bo'lgan kunlar) va holati: came | missed | null.
async function recentLessons(db, students, now) {
    const out = new Map();
    if (!students.length) return out;
    const today = T.nowLocal(now).date, from = T.addDays(today, -35), to = T.addDays(today, -1);
    const ids = students.map(s => s.id);
    const months = [...new Set([from.slice(0, 7), to.slice(0, 7)])];
    const present = new Set((await db.query(`SELECT student_id, LEFT(att_key, 7) AS m, day FROM main_attendance WHERE present = 1 AND student_id = ANY($1::text[]) AND LEFT(att_key, 7) = ANY($2::text[])`,
        [ids, months])).rows.map(r => `${r.student_id}|${r.m}-${String(r.day).padStart(2, '0')}`));
    const absent = new Set();
    for (const m of months) {
        const b = T.monthBounds(m);
        for (const a of await S.teacherAbsences(db, { from: b.from > from ? b.from : from, to: b.to < to ? b.to : to, studentIds: ids }).catch(() => [])) absent.add(`${a.studentId}|${a.day}`);
    }
    const dates = T.dateRange(from, to, 40);
    for (const s of students) {
        const pd = T.patternDays(s.day);
        if (!pd.length || !s.time) { out.set(s.id, []); continue; }
        out.set(s.id, dates.filter(d => pd.includes(T.weekday(d)) && (!s.startDate || d >= s.startDate) && R.activeOn({ extra_data: s.extra }, s.statusRows, d))
            .map(d => ({ date: d, status: present.has(`${s.id}|${d}`) ? 'came' : absent.has(`${s.id}|${d}`) ? 'missed' : null })));
    }
    return out;
}
function nextLessonDate(s, now = new Date()) {
    const { date, min } = T.nowLocal(now);
    const pd = T.patternDays(s.day);
    if (!pd.length || !s.time) return null;
    for (let i = 0; i < 14; i++) {
        const d = T.addDays(date, i);
        if (!pd.includes(T.weekday(d))) continue;
        if (i === 0 && (T.toMin(s.time) ?? 0) + s.duration <= min) continue;
        return d;
    }
    return null;
}

// Ustozlar reytingi — /api/state/teacher-rating bilan bitta formula (davomat 60% + o'zlashtirish 40%).
async function ratingRows(db) {
    return cached('rating', 120000, async () => {
        const { getFullState } = require('../db');
        const { ratingResponse, loadLearningByStudent } = require('./teacherRating');
        const state = await getFullState();
        const makeups = (await db.query(`SELECT m.student_id, m.teacher_id, m.kind, m.status, TO_CHAR(m.held_date,'YYYY-MM-DD') AS held_date, TO_CHAR(m.missed_date,'YYYY-MM-DD') AS missed_date,
            EXISTS (SELECT 1 FROM main_attendance a WHERE LEFT(a.att_key, 7) = TO_CHAR(m.missed_date, 'YYYY-MM') AND a.student_id = m.student_id
                AND a.day = EXTRACT(DAY FROM m.missed_date)::int AND a.present = 1) AS missed_came
            FROM school_makeups m WHERE m.status='approved' AND m.held_date IS NOT NULL`)).rows;
        const data = await ratingResponse({ state, ownType: 'asosiy', month: '', makeups, loadLearning: (n, o) => loadLearningByStudent(db, n, o) });
        return new Map((data.rows || []).map(r => [r.id, r]));
    }).catch(err => { console.error('[akademik] reyting', err.message); return new Map(); });
}
// Dars vaqtida o'tdimi (staffAttendance/lessons: Telegram video chat yoki davomat vaqti) — 30 kun, 10 daqiqa kesh.
const ON_TIME = new Set(['on_time', 'marked']), LATE = new Set(['late_start', 'late_and_early', 'marked_late']), SKIP = new Set(['pending', 'live']);
async function lessonTiming(db, now = new Date()) {
    return cached('timing', 600000, async () => {
        const L = require('./staffAttendance/lessons');
        const today = T.nowLocal(now).date, by = new Map();
        const reports = [];
        for (let i = 1; i <= 30; i += 6) reports.push(...await Promise.all(Array.from({ length: Math.min(6, 31 - i) }, (_, k) => L.report(db, T.addDays(today, -(i + k)), now))));
        for (const r of reports) {
            for (const row of r.rows) {
                const t = by.get(row.teacherId) || { judged: 0, onTime: 0, late: 0 };
                for (const b of row.blocks) { if (SKIP.has(b.status)) continue; t.judged++; if (ON_TIME.has(b.status)) t.onTime++; if (LATE.has(b.status)) t.late++; }
                by.set(row.teacherId, t);
            }
        }
        return by;
    }).catch(() => new Map());
}
const pct = (a, b) => (b ? Math.round(a / b * 100) : null);
// "Ustoz appi qulfda" — teacher/v2/davomat.js lockItems bilan bir qoida: oraliq max(QULF_FROM, oy boshi) .. kecha,
// o'quvchi faol bo'lgan dars kuni, "Keldi" ham "Kelmadi" ham yo'q (cell === 'y').
const QULF_FROM = '2026-11-18';
function lockWindow(today) {
    const yest = T.addDays(today, -1), from = QULF_FROM > `${today.slice(0, 7)}-01` ? QULF_FROM : `${today.slice(0, 7)}-01`;
    return yest < from ? null : { from, to: yest };
}
async function unmarkedLessons(db, teacherIds, now = new Date()) {
    const out = new Map();
    const w = lockWindow(T.nowLocal(now).date);
    if (!teacherIds.length || !w) return out;
    const { from, to } = w;
    const ctx = await S.loadContext(db, { teacherIds, from, to, now });
    const views = [];
    for (const d of T.dateRange(from, to, 32)) for (const id of teacherIds) views.push(S.dayView(ctx, id, d));
    await S.annotateViews(db, views, { from, to });
    const abs = new Set((await db.query('SELECT teacher_id, student_id, day FROM school_absences WHERE day BETWEEN $1 AND $2 AND absent', [from, to])).rows
        .map(r => `${r.teacher_id}|${r.student_id}|${S.dateStr(r.day)}`));
    for (const v of views) for (const i of v.items) {
        if (i.kind !== 'lesson' || !i.studentId || i.bookingId || i.att != null || abs.has(`${v.teacherId}|${i.studentId}|${v.date}`)) continue;
        const cur = out.get(v.teacherId) || { count: 0, date: v.date };
        cur.count++; if (v.date > cur.date) cur.date = v.date;
        out.set(v.teacherId, cur);
    }
    return out;
}
async function teacherLocks(db, teacherIds, now) {
    return cached('locks:' + teacherIds.join(','), 120000, () => unmarkedLessons(db, teacherIds, now)).catch(() => new Map());
}
const lockOf = (locks, id) => { const l = locks.get(id); return l ? { reason: l.date === T.addDays(T.nowLocal().date, -1) ? 'Kechagi davomat belgilanmagan' : `${l.count} ta dars davomati belgilanmagan` } : null; };

// ── Muammolar ────────────────────────────────────────────────────────────────
function problemItem(r, now = new Date()) {
    if (!r) return null;
    return { id: r.id, lang: r.lang, studentId: r.student_id, studentName: r.student_name, teacherId: r.teacher_id, teacherName: r.teacher_name,
        type: r.type, source: r.source, title: r.title, details: r.details, ownerId: r.owner_id, ownerName: r.owner_name || null, stage: r.stage,
        dueAt: iso(r.due_at), result: r.result, resultNote: r.result_note, followupAt: iso(r.followup_at), createdBy: r.created_by, createdByName: r.created_by_name,
        createdAt: iso(r.created_at), closedAt: iso(r.closed_at), remindCount: Number(r.remind_count) || 0, lastRemindAt: iso(r.last_remind_at),
        overdue: r.stage !== 'closed' && new Date(r.due_at).getTime() < now.getTime() };
}
async function myOwnerId(db, user) { const e = await hrRow(db, user); return e?.id || `user:${user.id}`; }
async function addEvent(db, problemId, kind, text, actorName) {
    if (!EVENT_KINDS.includes(kind)) throw fail(400, 'Voqea turi notoʻgʻri');
    await db.query('INSERT INTO academic_problem_events (id,problem_id,kind,text,actor_name) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), problemId, kind, String(text || '').slice(0, 1000), actorName || '']);
}
async function resolveOwner(db, user, ownerId) {
    if (ownerId === undefined || ownerId === null || ownerId === '') return null;
    if (ownerId === 'self') return { id: await myOwnerId(db, user), name: user.name || '' };
    const e = (await db.query(`SELECT id, name, role, lang FROM hr_employees WHERE id=$1 AND COALESCE(status,'active') <> 'inactive'`, [String(ownerId)])).rows[0];
    if (!e) throw fail(400, 'Masʼul xodim topilmadi');
    if (!ownerFits(e, await langsFor(db, user))) throw fail(403, 'Masʼul xodim boshqa til yoʻnalishida');
    return { id: e.id, name: e.name };
}
async function loadProblem(db, user, id, { lock = false } = {}) {
    const r = (await db.query(`SELECT * FROM academic_problems WHERE id=$1 AND removed_at IS NULL${lock ? ' FOR UPDATE' : ''}`, [String(id)])).rows[0];
    const langs = await langsFor(db, user);
    if (!r || (langs && !langs.includes(r.lang))) throw fail(404, 'Muammo topilmadi');
    return r;
}
async function listProblems(db, user, query = {}, now = new Date()) {
    const langs = await scopeLangs(db, user, query);
    const owner = await myOwnerId(db, user);
    const q = String(query.q || '').trim().slice(0, 80);
    const rows = (await db.query(`SELECT * FROM academic_problems WHERE removed_at IS NULL AND ($1::text[] IS NULL OR lang = ANY($1::text[]))
        AND ($2 = '' OR title ILIKE '%'||$2||'%' OR student_name ILIKE '%'||$2||'%' OR teacher_name ILIKE '%'||$2||'%' OR owner_name ILIKE '%'||$2||'%')
        ORDER BY CASE WHEN stage='closed' THEN 1 ELSE 0 END, due_at ASC LIMIT 500`, [langs, q])).rows.map(r => problemItem(r, now));
    const open = rows.filter(p => p.stage !== 'closed');
    const status = ['open', 'mine', 'closed'].includes(query.status) ? query.status : 'open';
    const items = status === 'closed' ? rows.filter(p => p.stage === 'closed').sort((a, b) => String(b.closedAt).localeCompare(String(a.closedAt))).slice(0, 100)
        : status === 'mine' ? open.filter(p => p.ownerId === owner) : open;
    return { items, counts: { open: open.length, mine: open.filter(p => p.ownerId === owner).length, overdue: open.filter(p => p.overdue).length } };
}
async function createProblem(db, user, body = {}, now = new Date()) {
    const langs = await scopeLangs(db, user);
    const st = (await db.query('SELECT id, name, subject, teacher_id FROM students WHERE id=$1', [String(body.studentId || '')])).rows[0];
    if (!st) throw fail(404, 'Oʻquvchi topilmadi');
    if (!inLangs(langs, st.subject)) throw fail(403, 'Bu oʻquvchi boshqa til yoʻnalishida');
    const type = PROBLEM_TYPES.includes(body.type) ? body.type : null;
    if (!type) throw fail(400, 'Muammo turini tanlang');
    const source = PROBLEM_SOURCES.includes(body.source) ? body.source : null;
    if (!source) throw fail(400, 'Kim xabar berganini tanlang');
    const title = String(body.title || '').trim();
    if (title.length < 3) throw fail(400, 'Qisqa sarlavha yozing');
    const due = new Date(body.dueAt);
    if (Number.isNaN(due.getTime())) throw fail(400, 'Muddatni tanlang');
    const owner = await resolveOwner(db, user, body.ownerId);
    const teacher = st.teacher_id ? (await db.query('SELECT name FROM hr_employees WHERE id=$1', [st.teacher_id])).rows[0] : null;
    const id = randomUUID();
    const { rows } = await db.query(`INSERT INTO academic_problems (id,lang,student_id,student_name,teacher_id,teacher_name,type,source,title,details,owner_id,owner_name,stage,due_at,created_by,created_by_name)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [id, studentLang(st.subject), st.id, st.name, st.teacher_id || null, teacher?.name || '', type, source, title.slice(0, 200), String(body.details || '').trim().slice(0, 2000),
            owner?.id || null, owner?.name || '', owner ? 'assigned' : 'logged', due, String(user.id), user.name || '']);
    await addEvent(db, id, 'created', title.slice(0, 200), user.name);
    if (owner) await addEvent(db, id, 'assigned', `Masʼul: ${owner.name}`, user.name);
    invalidate();
    return { item: problemItem(rows[0], now) };
}
async function getProblem(db, user, id, now = new Date()) {
    const r = await loadProblem(db, user, id);
    const st = (await db.query('SELECT phone FROM students WHERE id=$1', [r.student_id])).rows[0];
    const t = r.teacher_id ? (await db.query('SELECT phone FROM hr_employees WHERE id=$1', [r.teacher_id])).rows[0] : null;
    const events = (await db.query('SELECT * FROM academic_problem_events WHERE problem_id=$1 ORDER BY at', [r.id])).rows
        .map(e => ({ id: e.id, kind: e.kind, text: e.text, actorName: e.actor_name, at: iso(e.at) }));
    return { item: { ...problemItem(r, now), studentPhone: st?.phone || '', teacherPhone: t?.phone || '' }, events };
}
const STAGE_UZ = { logged: 'Qayd etildi', assigned: 'Masʼulga berildi', in_progress: 'Ishlanmoqda', closed: 'Yopildi' };
async function patchProblem(db, user, id, body = {}, now = new Date()) {
    const r = await loadProblem(db, user, id, { lock: true });
    if (r.stage === 'closed') throw fail(409, 'Muammo yopilgan');
    const set = {}, ev = [];
    if (body.ownerId !== undefined) {
        const owner = await resolveOwner(db, user, body.ownerId);
        set.owner_id = owner?.id || null; set.owner_name = owner?.name || '';
        ev.push(['assigned', owner ? `Masʼul: ${owner.name}` : 'Masʼul olib tashlandi']);
        if (owner && r.stage === 'logged' && body.stage === undefined) set.stage = 'assigned';
    }
    if (body.stage !== undefined) {
        if (!PROBLEM_STAGES.includes(body.stage) || body.stage === 'closed') throw fail(400, 'Bosqich notoʻgʻri — yopish uchun “Yopish”');
        if (body.stage !== r.stage) { set.stage = body.stage; ev.push(['stage', STAGE_UZ[body.stage]]); }
    }
    if (body.dueAt !== undefined) {
        const due = new Date(body.dueAt);
        if (Number.isNaN(due.getTime())) throw fail(400, 'Muddat notoʻgʻri');
        const reason = String(body.reason || '').trim();
        if (reason.length < 3) throw fail(400, 'Muddatni surish sababini yozing');
        set.due_at = due;
        // Yangi muddat — eslatma hisobi qaytadan.
        set.last_remind_at = null;
        ev.push(['postponed', `Yangi muddat: ${T.nowLocal(due).date} ${T.fromMin(T.nowLocal(due).min)} · ${reason.slice(0, 300)}`]);
    }
    const keys = Object.keys(set);
    if (!keys.length) throw fail(400, 'Oʻzgarish yoʻq');
    const { rows } = await db.query(`UPDATE academic_problems SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(', ')} WHERE id=$1 RETURNING *`, [r.id, ...keys.map(k => set[k])]);
    for (const [k, t] of ev) await addEvent(db, r.id, k, t, user.name);
    invalidate();
    return { item: problemItem(rows[0], now) };
}
async function problemEvent(db, user, id, body = {}) {
    const r = await loadProblem(db, user, id);
    if (r.stage === 'closed') throw fail(409, 'Muammo yopilgan — izoh qoʻshib boʻlmaydi');
    const kind = ['comment', 'call'].includes(body.kind) ? body.kind : null;
    if (!kind) throw fail(400, 'Turi: izoh yoki qoʻngʻiroq');
    const text = String(body.text || '').trim();
    if (text.length < 2) throw fail(400, 'Matnni yozing');
    await addEvent(db, r.id, kind, text, user.name);
    if (r.stage === 'assigned' || r.stage === 'logged') await db.query(`UPDATE academic_problems SET stage='in_progress' WHERE id=$1 AND stage IN ('assigned','logged') AND owner_id IS NOT NULL`, [r.id]);
    return { ok: true };
}
async function closeProblem(db, user, id, body = {}, now = new Date()) {
    const r = await loadProblem(db, user, id, { lock: true });
    if (r.stage === 'closed') throw fail(409, 'Muammo allaqachon yopilgan');
    const result = PROBLEM_RESULTS.includes(body.result) ? body.result : null;
    if (!result) throw fail(400, 'Natijani tanlang');
    const note = String(body.note || '').trim();
    if (note.length < 3) throw fail(400, 'Yakuniy izohni yozing');
    const followup = body.followup === true ? new Date(now.getTime() + 7 * 86400000) : null;
    const { rows } = await db.query(`UPDATE academic_problems SET stage='closed', result=$2, result_note=$3, followup_at=$4, closed_at=NOW() WHERE id=$1 RETURNING *`,
        [r.id, result, note.slice(0, 1000), followup]);
    await addEvent(db, r.id, 'closed', `${{ solved: 'Hal qilindi', teacher_changed: 'Ustoz almashtirildi', unsolved: 'Hal boʻlmadi' }[result]} · ${note.slice(0, 500)}${followup ? ' · 7 kundan keyin qayta tekshiriladi' : ''}`, user.name);
    invalidate();
    return { item: problemItem(rows[0], now) };
}

// Kunlik eslatma (server/index.js soatlik taymer): 09:00 dan keyin, muddati o'tgan har ochiq muammoga kuniga bir marta
// remind_count +1 va 'reminded' voqeasi. GET va bildirishnoma lentasi faqat o'qiydi.
async function remindOverdue(db, now = new Date()) {
    const { date: today, min } = T.nowLocal(now);
    if (min < 9 * 60) return 0;
    const dayStart = atLocal(today, 0);
    const rows = (await db.query(`UPDATE academic_problems SET remind_count = remind_count + 1, last_remind_at = $1
        WHERE removed_at IS NULL AND stage <> 'closed' AND due_at < $1 AND (last_remind_at IS NULL OR last_remind_at < $2) RETURNING id, remind_count`, [now, dayStart])).rows;
    for (const r of rows) await addEvent(db, r.id, 'reminded', `${r.remind_count}-eslatma: muddat oʻtdi`, 'Bot');
    return rows.length;
}

// ── Bosh (A01) ────────────────────────────────────────────────────────────────
async function trialsOf(db, teacherIds) {
    if (!teacherIds.length) return [];
    return (await db.query(`SELECT id, name, status, extra_data FROM leads WHERE deleted_at IS NULL AND extra_data->'trialRequest'->>'teacherId' = ANY($1::text[])`, [teacherIds])).rows
        .map(r => ({ id: r.id, name: r.name, status: r.status, lead: { ...parseExtra(r.extra_data), id: r.id, status: r.status } }));
}
async function overview(db, user, query = {}, now = new Date()) {
    const langs = await scopeLangs(db, user, query);
    const sc = await scopeData(db, langs, now);
    const tIds = sc.teachers.map(t => t.id);
    const [rating, locks, probs, trials] = await Promise.all([ratingRows(db), teacherLocks(db, tIds, now), listProblems(db, user, query, now), trialsOf(db, tIds)]);
    const open = probs.items;
    const overdue = open.filter(p => p.overdue).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const ids = sc.students.map(s => s.id);
    const left30 = ids.length ? Number((await db.query(`SELECT COUNT(DISTINCT student_id)::int AS n FROM school_student_status WHERE status='left' AND cancelled_at IS NULL AND created_at > $1
        AND student_id IN (SELECT id FROM students WHERE ($2::text[] IS NULL OR COALESCE(NULLIF(subject,''),'english') = ANY($2::text[])))`, [daysAgo(now, 30), langs])).rows[0]?.n || 0) : 0;
    const mk = await makeupRows(db, langs, 'pending', now);
    const unaccepted = [];
    for (const t of trials) {
        const r = workflow.request(t.lead);
        if (!r || r.state !== 'pending' || t.status !== 'sinov-darsida') continue;
        const ms = Date.parse(r.scheduledAt);
        if (Number.isFinite(ms) && ms > now.getTime()) unaccepted.push({ time: new Date(ms).toISOString(), teacher: sc.names.get(r.teacherId) || '', teacherId: r.teacherId || null });
    }
    unaccepted.sort((a, b) => a.time.localeCompare(b.time));
    const risk = sc.active.filter(s => s.risk);
    let comp = 0, exp = 0;
    for (const id of tIds) { const r = rating.get(id); if (r) { comp += Number(r.completed) || 0; exp += Number(r.expected) || 0; } }
    const attention = sc.teachers.map(t => {
        const mine = sc.active.filter(s => s.teacherId === t.id);
        const p = onPlanPct(mine), lock = lockOf(locks, t.id), od = overdue.filter(x => x.teacherId === t.id).length;
        let reason = null, tone = null, w = 0;
        if (lock) { reason = `Appi qulfda · ${lock.reason.toLowerCase()}`; tone = 'red'; w = 3; }
        else if (od) { reason = `${od} ta muammo muddati oʻtdi`; tone = 'red'; w = 2.5; }
        else if (p != null && p < 60) { reason = `Rejada ${p}% oʻquvchi`; tone = 'amber'; w = 2; }
        else if (mine.some(s => s.risk)) { reason = `${mine.filter(s => s.risk).length} oʻquvchi xavfda`; tone = 'blue'; w = 1; }
        return { id: t.id, name: t.name, students: mine.length, onPlanPct: p, reason, tone, w };
    }).filter(x => x.reason).sort((a, b) => b.w - a.w || (a.onPlanPct ?? 100) - (b.onPlanPct ?? 100)).slice(0, 3).map(({ w, ...x }) => x);
    let unread = 0;
    try { unread = (await require('./staffNotify').feed(db, user, now)).unread; } catch { unread = 0; }
    const oldest = overdue[0];
    return {
        students: { total: sc.active.length, onPlan: sc.active.filter(s => s.onPlan).length, behind: sc.active.filter(s => !s.onPlan).length, left30, frozen: sc.students.filter(s => s.frozen).length },
        attendancePct: pct(comp, exp),
        tiles: { overdueProblems: overdue.length, oldestOverdueDays: oldest ? Math.max(0, Math.floor((now - new Date(oldest.dueAt)) / 86400000)) : 0,
            // Qoplash: "Qoplash" tabidagi pending soni bilan bir xil (canReject har qatorda alohida).
            oldestOverdueReminds: oldest ? oldest.remindCount : 0, makeupsPending: mk.length,
            risk: risk.length, riskNoApp: risk.filter(s => s.risk.reason === 'noapp').length, trialsUnaccepted: unaccepted.length, nextUnacceptedTrial: unaccepted[0] || null,
            // Yordamchilarning davomat so'rovlari — Face ID so'rovlari funksiyasi qo'shilguncha 0.
            attendanceRequests: 0 },
        teachersAttention: attention, teachersTotal: sc.teachers.length, unreadNotifications: unread,
    };
}

// ── Qoplash tekshiruvi (A06–A07) ──────────────────────────────────────────────
async function makeupRows(db, langs, status, now = new Date()) {
    const today = T.nowLocal(now).date;
    const since = `${T.addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
    const where = status === 'held' ? "m.check_status='held'" : status === 'not_held' ? "m.check_status='not_held'"
        : "m.status='approved' AND (m.check_status IS NULL OR m.check_status='no_answer')";
    const rows = (await db.query(`SELECT m.*, s.name AS student_name, s.phone AS student_phone, s.subject, he.name AS teacher_name,
        (SELECT COUNT(*)::int FROM main_attendance a WHERE a.student_id=m.student_id AND a.present=1 AND (LEFT(a.att_key,7)||'-'||LPAD(a.day::text,2,'0')) <= TO_CHAR(COALESCE(m.held_date,m.missed_date),'YYYY-MM-DD'))
          + (SELECT COUNT(*)::int FROM school_makeups x WHERE x.student_id=m.student_id AND x.status='approved' AND x.held_date <= COALESCE(m.held_date,m.missed_date)) AS lesson_no
        FROM school_makeups m JOIN students s ON s.id=m.student_id LEFT JOIN hr_employees he ON he.id=m.teacher_id
        WHERE ${where} AND COALESCE(m.held_date, m.missed_date) >= $1 AND ($2::text[] IS NULL OR COALESCE(NULLIF(s.subject,''),'english') = ANY($2::text[]))
        ORDER BY COALESCE(m.held_date, m.missed_date) ASC, m.created_at ASC LIMIT 300`, [status === 'pending' ? since : T.addDays(today, -60), langs])).rows;
    return rows.map(r => {
        const held = S.dateStr(r.held_date || r.missed_date);
        const w = makeupRejectWindow(held, today);
        return { id: r.id, studentId: r.student_id, studentName: r.student_name, studentPhone: r.student_phone || '', teacherName: r.teacher_name || '',
            heldAt: r.held_start_min != null ? atLocal(held, Number(r.held_start_min)) : held, heldDate: held, missedDate: S.dateStr(r.missed_date), kind: r.kind,
            lessonNo: Number(r.lesson_no) || null, enteredAt: iso(r.created_at), deadline: w.deadline, canReject: r.status === 'approved' && w.canReject,
            checkStatus: r.check_status || null, checkNote: r.check_note || '', checkedByName: r.checked_by_name || '', checkedAt: iso(r.checked_at), status: r.status };
    });
}
async function listMakeups(db, user, query = {}, now = new Date()) {
    const langs = await scopeLangs(db, user, query);
    const status = ['pending', 'held', 'not_held'].includes(query.status) ? query.status : 'pending';
    const items = await makeupRows(db, langs, status, now);
    const pending = status === 'pending' ? items : await makeupRows(db, langs, 'pending', now);
    return { items, counts: { pending: pending.length, noAnswer: pending.filter(m => m.checkStatus === 'no_answer').length } };
}
async function checkMakeup(db, user, id, body = {}, now = new Date()) {
    const langs = await scopeLangs(db, user);
    const result = ['held', 'not_held', 'no_answer'].includes(body.result) ? body.result : null;
    if (!result) throw fail(400, 'Natijani tanlang');
    const note = String(body.note || '').trim();
    const m = (await db.query(`SELECT m.*, s.subject, s.name AS student_name, he.name AS teacher_name FROM school_makeups m JOIN students s ON s.id=m.student_id
        LEFT JOIN hr_employees he ON he.id=m.teacher_id WHERE m.id=$1 FOR UPDATE OF m`, [String(id)])).rows[0];
    if (!m || !inLangs(langs, m.subject)) throw fail(404, 'Qoplash topilmadi');
    if (['held', 'not_held'].includes(m.check_status) || m.status === 'rejected') throw fail(409, 'Bu qoplash allaqachon tekshirilgan');
    if (m.status !== 'approved') throw fail(409, 'Qoplash hali hisobga oʻtmagan');
    let row = m;
    if (result === 'not_held') {
        if (note.length < 3) throw fail(400, 'Nima uchun dars boʻlmaganini yozing');
        const held = S.dateStr(m.held_date || m.missed_date), w = makeupRejectWindow(held, T.nowLocal(now).date);
        if (!w.canReject) throw fail(409, `${held.slice(0, 7)} oyi yopilgan — bu qoplashni endi rad etib boʻlmaydi`);
        // school.js /makeups/:id/decide (rad etish) bilan bir xil yozuv: status, kim, sabab, o'quvchi tarixi. Ustozga xabar — staffNotify makeup_decision.
        row = (await db.query(`UPDATE school_makeups SET status='rejected', decided_by=$2, decided_by_name=$3, decided_at=NOW(), decision_note=$4,
            check_status='not_held', check_note=$4, checked_by_name=$3, checked_at=NOW() WHERE id=$1 AND status='approved' RETURNING *`,
            [m.id, String(user.id), user.name || '', `Akademik tekshiruv: ${note}`.slice(0, 300)])).rows[0];
        if (!row) throw fail(409, 'Bu qoplash allaqachon tekshirilgan');
        await require('./school/studentOps').audit(db, row.student_id, 'makeup-rejected',
            { makeupId: row.id, missedDate: S.dateStr(row.missed_date), heldDate: row.held_date ? S.dateStr(row.held_date) : null, teacherId: row.teacher_id, kind: row.kind, check: 'not_held' },
            row.decision_note, user);
    } else {
        row = (await db.query(`UPDATE school_makeups SET check_status=$2, check_note=$3, checked_by_name=$4, checked_at=NOW() WHERE id=$1 RETURNING *`,
            [m.id, result, note.slice(0, 300), user.name || ''])).rows[0];
    }
    let problem = null;
    if (body.openProblem === true) {
        problem = (await createProblem(db, user, { studentId: m.student_id, type: 'teacher', source: 'self', ownerId: 'self',
            title: result === 'not_held' ? 'Qoplash darsi oʻtilmagan' : result === 'no_answer' ? 'Qoplashni tekshirib boʻlmadi — javob yoʻq' : 'Qoplash darsi boʻyicha savol',
            details: [`Ustoz: ${m.teacher_name || '—'}`, `Qoplash: ${S.dateStr(m.held_date || m.missed_date)}`, note].filter(Boolean).join('\n'),
            dueAt: new Date(now.getTime() + 2 * 86400000).toISOString() }, now)).item;
    }
    invalidate();
    return { makeup: { id: row.id, status: row.status, checkStatus: row.check_status, checkNote: row.check_note }, problem };
}

// ── O'quvchilar (A08–A10) ─────────────────────────────────────────────────────
async function risk(db, user, query = {}, now = new Date()) {
    const langs = await scopeLangs(db, user, query);
    const sc = await scopeData(db, langs, now);
    const all = sc.active.filter(s => s.risk);
    const reason = ['noapp', 'absent', 'behind'].includes(query.reason) ? query.reason : 'all';
    const order = { noapp: 0, absent: 1, behind: 2 };
    const items = all.filter(s => reason === 'all' || s.risk.reason === reason)
        .sort((a, b) => order[a.risk.reason] - order[b.risk.reason] || (b.daysIdle ?? 999) - (a.daysIdle ?? 999) || b.behind - a.behind)
        .map(s => ({ id: s.id, name: s.name, teacherId: s.teacherId, teacherName: s.teacherName, lessonNo: s.reached || null, reason: s.risk.reason, reasonText: s.risk.reasonText }));
    const c = k => all.filter(s => s.risk.reason === k).length;
    return { items, counts: { all: all.length, noapp: c('noapp'), absent: c('absent'), behind: c('behind') } };
}
async function studentRowChecked(db, user, id) {
    const langs = await scopeLangs(db, user);
    const r = (await db.query('SELECT * FROM students WHERE id=$1', [String(id)])).rows[0];
    if (!r) throw fail(404, 'Oʻquvchi topilmadi');
    if (!inLangs(langs, r.subject)) throw fail(403, 'Bu oʻquvchi boshqa til yoʻnalishida');
    return { r, langs };
}
async function studentCard(db, user, id, now = new Date()) {
    const { r, langs } = await studentRowChecked(db, user, id);
    const sc = await scopeData(db, langs, now);
    const s = sc.students.find(x => x.id === r.id) || null;
    const hub = require('./academicHub');
    let detail = null;
    try { detail = await hub.studentDetailById(db, r.id); } catch (e) { if (e.code !== '42P01' && e.status !== 404) throw e; }
    const counts = {};
    for (const l of detail?.lessons || []) for (const res of l.results || []) for (const mi of res.mistakes || []) {
        const q = String(mi?.question || mi || '').trim(); if (q) counts[q] = (counts[q] || 0) + 1;
    }
    const topMistake = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const lessons = (s?.lessons || []).slice(-6).map(l => ({ date: l.date, status: l.status === 'came' ? 'came' : l.status === 'missed' ? 'missed' : 'unmarked' }));
    const next = s ? nextLessonDate(s, now) : null;
    if (next) lessons.push({ date: next, status: 'next' });
    const pc = (await db.query(`SELECT COUNT(*) FILTER (WHERE stage<>'closed')::int AS open, COUNT(*) FILTER (WHERE stage='closed')::int AS closed FROM academic_problems
        WHERE student_id=$1 AND removed_at IS NULL`, [r.id])).rows[0] || {};
    const hist = (await db.query(`SELECT h.teacher_id, TO_CHAR(h.from_date,'YYYY-MM-DD') AS from_date, he.name FROM school_teacher_history h LEFT JOIN hr_employees he ON he.id=h.teacher_id
        WHERE h.student_id=$1 ORDER BY h.from_date`, [r.id])).rows;
    const st = detail?.student || {};
    return {
        id: r.id, name: r.name, phone: r.phone || '', teacher: r.teacher_id ? { id: r.teacher_id, name: sc.names.get(r.teacher_id) || '' } : null,
        schedule: scheduleText(r.lesson_day_of_week, r.lesson_time), totalLessons: hub.TOTAL_LESSONS || 72, lessonNo: s?.reached ?? st.reached ?? null, planLessonNo: s?.expected ?? st.expected ?? null,
        activity: { completionPct: st.avgPercent ?? null, weeklyMinutes: st.time ? Math.round((st.time.week || 0) / 60) : null, topMistake,
            attendancePct: detail?.attendance?.rate ?? null },
        lessons, problems: { open: Number(pc.open) || 0, closed: Number(pc.closed) || 0 },
        teacherHistory: hist.filter(h => h.from_date > '2000-01-01').map(h => ({ name: h.name || '', from: h.from_date })),
        risk: s?.risk ? { reasonText: s.risk.reasonText } : null, state: s?.state || 'left',
    };
}
async function transferOptions(db, user, id, now = new Date()) {
    const { r, langs } = await studentRowChecked(db, user, id);
    const lang = studentLang(r.subject);
    const sc = await scopeData(db, langs, now);
    const cands = sc.teachers.filter(t => t.id !== r.teacher_id && teacherFits(t, [lang]));
    const start = T.toMin(r.lesson_time), dur = Number(r.lesson_duration) || 30, days = T.patternDays(r.lesson_day_of_week);
    const from = T.nowLocal(now).date, to = T.addDays(from, 13);
    const free = new Map();
    if (cands.length && start != null && days.length) {
        const ctx = await S.loadContext(db, { teacherIds: cands.map(t => t.id), from, to, now });
        ctx.students = ctx.students.filter(s => s.id !== r.id);
        for (const t of cands) free.set(t.id, T.dateRange(from, to, 15).filter(d => days.includes(T.weekday(d)))
            .every(d => S.fits(S.dayView(ctx, t.id, d).free, start, start + dur)));
    }
    const open = new Map((await db.query(`SELECT teacher_id, COUNT(*)::int AS n FROM academic_problems WHERE stage<>'closed' AND removed_at IS NULL GROUP BY teacher_id`)).rows.map(x => [x.teacher_id, x.n]));
    const teachers = cands.map(t => { const mine = sc.active.filter(s => s.teacherId === t.id);
        return { id: t.id, name: t.name, students: mine.length, onPlanPct: onPlanPct(mine), free: free.get(t.id) === true, openProblems: open.get(t.id) || 0 }; })
        .sort((a, b) => Number(b.free) - Number(a.free) || (b.onPlanPct ?? 0) - (a.onPlanPct ?? 0));
    return { slot: scheduleText(r.lesson_day_of_week, r.lesson_time), teachers };
}

// ── Ustozlar (A11–A12) ────────────────────────────────────────────────────────
async function teacherFacts(db, sc, now) {
    const tIds = sc.teachers.map(t => t.id);
    const [rating, timing, locks] = await Promise.all([ratingRows(db), lessonTiming(db, now), teacherLocks(db, tIds, now)]);
    const probs = new Map((await db.query(`SELECT teacher_id, COUNT(*)::int AS open, COUNT(*) FILTER (WHERE due_at < NOW())::int AS overdue FROM academic_problems
        WHERE stage<>'closed' AND removed_at IS NULL GROUP BY teacher_id`)).rows.map(x => [x.teacher_id, x]));
    return { rating, timing, locks, probs };
}
async function teachers(db, user, query = {}, now = new Date()) {
    const langs = await scopeLangs(db, user, query);
    const sc = await scopeData(db, langs, now);
    const f = await teacherFacts(db, sc, now);
    const items = sc.teachers.map(t => {
        const mine = sc.active.filter(s => s.teacherId === t.id), rr = f.rating.get(t.id), tm = f.timing.get(t.id), lock = lockOf(f.locks, t.id), pr = f.probs.get(t.id);
        const p = onPlanPct(mine);
        const flag = lock ? { text: 'Qulfda · davomat', tone: 'red' } : pr?.overdue ? { text: `${pr.overdue} muammo muddati oʻtdi`, tone: 'red' }
            : p != null && p < 60 ? { text: `Rejada ${p}%`, tone: 'amber' } : pr?.open ? { text: `${pr.open} ochiq muammo`, tone: 'blue' } : null;
        return { id: t.id, name: t.name, score: rr ? rr.score : null, students: mine.length, onPlanPct: p, onTimePct: tm ? pct(tm.onTime, tm.judged) : null,
            attendancePct: rr?.davomatPct ?? null, masteryPct: rr?.learnPct ?? null, flag };
    }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    items.forEach((x, i) => { x.rank = x.score == null ? null : i + 1; });
    let on = 0, all = 0;
    for (const t of sc.teachers) { const tm = f.timing.get(t.id); if (tm) { on += tm.onTime; all += tm.judged; } }
    const tIds = sc.teachers.map(t => t.id);
    const breaks = tIds.length ? Number((await db.query(`SELECT COUNT(*)::int AS n FROM school_overrides WHERE kind='break' AND removed_at IS NULL AND date >= $1 AND teacher_id = ANY($2::text[])`,
        [T.nowLocal(now).date, tIds])).rows[0]?.n || 0) : 0;
    const rejects = (await trialsOf(db, tIds)).filter(t => { const r = workflow.request(t.lead); return r?.state === 'rejected' && Date.parse(r.rejectedAt || '') > daysAgo(now, 30).getTime(); }).length;
    // attendancePct / masteryPct — kompyuter jadvalidagi "Davomat" va "Oʻzlashtirish" ustunlari (ball tarkibi, kartadagi bilan bir manba).
    return { items: items.map(({ id, name, rank, score, students, onPlanPct: o, onTimePct, attendancePct, masteryPct, flag }) => ({ id, name, rank, score, students, onPlanPct: o, onTimePct, attendancePct, masteryPct, flag })),
        summary: { onTimePct: pct(on, all), breaksPlanned: breaks, trialRejects30: rejects } };
}
async function teacherSalary(db, emp, now = new Date()) {
    const payroll = require('./payroll'), engine = require('../../js/payrollEngine');
    const p = payroll.currentMonthPeriod(now), month = p.start.slice(0, 7);
    const makeups = Number((await db.query(`SELECT COUNT(*)::int AS n FROM school_makeups WHERE teacher_id=$1 AND status='approved' AND TO_CHAR(held_date,'YYYY-MM')=$2`, [emp.id, month])).rows[0]?.n || 0);
    let c = null;
    try {
        c = await require('../db').pool.connect();
        await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const row = (await payroll.calculate(c, p, engine.language(emp), false)).rows.find(r => r.employeeId === emp.id);
        await c.query('COMMIT');
        return { month, lessons: row ? Number(row.mainLessons ?? row.lessons) || 0 : null, makeups, amount: row ? Number(row.total) || 0 : null, status: row?.status || 'unpaid' };
    } catch (e) { if (c) await c.query('ROLLBACK').catch(() => {}); console.error('[akademik] maosh', e.message); return { month, lessons: null, makeups, amount: null, status: 'unknown' }; }
    finally { if (c) c.release(); }
}
async function teacherCard(db, user, id, now = new Date()) {
    const langs = await scopeLangs(db, user);
    const sc = await scopeData(db, langs, now);
    const t = sc.teachers.find(x => x.id === String(id));
    if (!t) throw fail(404, 'Ustoz topilmadi');
    const f = await teacherFacts(db, sc, now);
    // O'rin — shu tildagi ustozlar orasida reyting bali bo'yicha (teachers() bilan bir tartib, qayta hisoblamasdan).
    const scores = sc.teachers.map(x => f.rating.get(x.id)?.score).filter(v => v != null);
    const rr = f.rating.get(t.id), tm = f.timing.get(t.id), pr = f.probs.get(t.id) || {};
    const mine = sc.active.filter(s => s.teacherId === t.id);
    const left30 = Number((await db.query(`SELECT COUNT(DISTINCT st.student_id)::int AS n FROM school_student_status st JOIN students s ON s.id=st.student_id
        WHERE st.status='left' AND st.cancelled_at IS NULL AND st.created_at > $1 AND s.teacher_id=$2`, [daysAgo(now, 30), t.id])).rows[0]?.n || 0);
    const since = daysAgo(now, 30).getTime();
    const tr = (await trialsOf(db, [t.id])).map(x => ({ x, r: workflow.request(x.lead) })).filter(({ r }) => r && Date.parse(r.scheduledAt || r.requestedAt || '') > since);
    const rejected = tr.filter(({ r }) => r.state === 'rejected');
    const mk = (await db.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='approved' AND (check_status IS NULL OR check_status='no_answer'))::int AS review
        FROM school_makeups WHERE teacher_id=$1 AND status IN ('approved','rejected') AND COALESCE(held_date, missed_date) >= $2`, [t.id, T.addDays(T.nowLocal(now).date, -30)])).rows[0] || {};
    return {
        id: t.id, name: t.name, phone: t.phone || '', rank: rr?.score != null ? scores.filter(v => v > rr.score).length + 1 : null, score: rr?.score ?? null, prevScore: rr?.prevScore ?? null,
        attendancePct: rr?.davomatPct ?? null, masteryPct: rr?.learnPct ?? null, onTimePct: tm ? pct(tm.onTime, tm.judged) : null, lateLessons30: tm ? tm.late : 0,
        left30, studentsCount: mine.length, onPlanCount: mine.filter(s => s.onPlan).length, lock: lockOf(f.locks, t.id),
        trials30: { accepted: tr.filter(({ r }) => ['accepted', 'completed'].includes(r.state)).length, rejected: rejected.length,
            rejectReasons: [...new Set(rejected.map(({ r }) => r.reasonLabel || r.rejectNote).filter(Boolean))],
            converted: tr.filter(({ x, r }) => workflow.phase(r, { leadStatus: x.status, now: now.getTime() }) === 'sold').length },
        makeups30: { total: Number(mk.total) || 0, inReview: Number(mk.review) || 0 },
        salary: await teacherSalary(db, t, now), riskStudents: mine.filter(s => s.risk).length, problems: { open: Number(pr.open) || 0, overdue: Number(pr.overdue) || 0 },
    };
}

// ── Yordamchilar (A15–A16, A19) ───────────────────────────────────────────────
const counted = c => c.removed_at == null && c.outcome === 'contacted' && (c.channel === 'tg_text' || Number(c.minutes) >= A.MIN_MINUTES);
async function staffDay(db, empId, now) {
    try {
        const sa = require('./staffAttendance'), rules = require('./staffAttendance/rules');
        const d = await sa.computeDay(db, empId, T.nowLocal(now).date, await sa.getSettings(db), now);
        const tone = ['on_time', 'present'].includes(d.status) ? 'green' : d.status === 'late' ? 'amber' : d.status === 'absent' ? 'red' : 'grey';
        return { text: (rules.STATUS_LABELS[d.status] || d.status) + (d.inClock ? ` · ${d.inClock}` : ''), tone, status: d.status };
    } catch { return { text: '—', tone: 'grey', status: null }; }
}
async function assistantsData(db, sc, now) {
    const today = T.nowLocal(now).date, from = T.addDays(today, -6);
    const ids = sc.assistants.map(a => a.id);
    const contacts = ids.length ? (await db.query(`SELECT * FROM school_assist_contacts WHERE removed_at IS NULL AND day >= $1 AND assistant_id = ANY($2::text[])`,
        [T.addDays(today, -60), ids])).rows : [];
    return sc.assistants.map(a => {
        const mine = sc.active.filter(s => s.assistantId === a.id);
        const cs = contacts.filter(c => c.assistant_id === a.id && counted(c));
        const last = new Map();
        for (const c of cs) { const d = S.dateStr(c.day); if (!last.has(c.student_id) || last.get(c.student_id) < d) last.set(c.student_id, d); }
        const week = cs.filter(c => S.dateStr(c.day) >= from && mine.some(s => s.id === c.student_id));
        const silent = mine.map(s => { const l = last.get(s.id); const base = l || (s.startDate && s.startDate > T.addDays(today, -60) ? s.startDate : null);
            return { studentId: s.id, name: s.name, teacherName: s.teacherName, days: base ? T.daysBetween(base, today) : 60, last: l || null }; })
            .filter(x => x.days >= 5).sort((x, y) => y.days - x.days);
        return { a, mine, week, silent };
    });
}
async function assistants(db, user, query = {}, now = new Date()) {
    const langs = await scopeLangs(db, user, query);
    const sc = await scopeData(db, langs, now);
    const data = await assistantsData(db, sc, now);
    const items = [];
    for (const d of data) {
        const contacted7 = new Set(d.week.map(c => c.student_id)).size;
        const att = await staffDay(db, d.a.id, now);
        items.push({ id: d.a.id, name: d.a.name, students: d.mine.length, contacted7, silent5: d.silent.length, attendance: { text: att.text, tone: att.tone },
            note: d.silent.length ? `${d.silent.length} oʻquvchi 5+ kundan beri aloqasiz` : contacted7 < d.mine.length ? `${d.mine.length - contacted7} oʻquvchi bu hafta aloqasiz` : '' });
    }
    return { items, summary: { contacted7: items.reduce((n, x) => n + x.contacted7, 0), total: items.reduce((n, x) => n + x.students, 0), silent5: items.reduce((n, x) => n + x.silent5, 0) } };
}
async function assistantCard(db, user, id, now = new Date()) {
    const langs = await scopeLangs(db, user);
    const sc = await scopeData(db, langs, now);
    const d = (await assistantsData(db, sc, now)).find(x => x.a.id === String(id));
    if (!d) throw fail(404, 'Yordamchi topilmadi');
    const calls = d.week.filter(c => c.channel !== 'tg_text'), msgs = d.week.filter(c => c.channel === 'tg_text');
    const month = T.nowLocal(now).date.slice(0, 7);
    const snaps = (await db.query(`SELECT data->>'status' AS s, COUNT(*)::int AS n FROM staff_att_day_results WHERE employee_id=$1 AND TO_CHAR(work_date,'YYYY-MM')=$2 GROUP BY 1`,
        [d.a.id, month]).catch(() => ({ rows: [] }))).rows;
    const n = k => snaps.find(x => x.s === k)?.n || 0;
    const att = await staffDay(db, d.a.id, now);
    const pending = Number((await db.query(`SELECT COUNT(*)::int AS n FROM school_requests WHERE type='assist_late' AND status='new' AND teacher_id=$1`, [d.a.id])).rows[0]?.n || 0);
    let rep = null; try { rep = await A.monthReport(db, d.a.id, month); } catch (e) { console.error('[akademik] yordamchi oyi', e.message); }
    return {
        id: d.a.id, name: d.a.name, phone: d.a.phone || '', students: d.mine.length,
        last7: { contacted: new Set(d.week.map(c => c.student_id)).size, avgPerStudent: d.mine.length ? Math.round(d.week.length / d.mine.length * 10) / 10 : 0,
            calls: calls.length, avgCallMin: calls.length ? Math.round(calls.reduce((s, c) => s + Number(c.minutes || 0), 0) / calls.length) : 0, messages: msgs.length },
        silent: d.silent.map(({ studentId, name, teacherName, days }) => ({ studentId, name, teacherName, days })),
        attendance: { today: att.text, requests: 0, monthText: `${n('on_time') + n('present')} vaqtida · ${n('late')} kechikish · ${n('absent')} kelmadi` },
        lateContactsPending: pending,
        salary: { counted: rep?.counted ?? null, amount: rep ? (rep.computedAmount ?? rep.amount) : null, payDate: `${nextMonth(month)}-05` },
    };
}
async function lateItems(db, langs, status, now = new Date(), viewerId = null) {
    const today = T.nowLocal(now).date;
    const rows = (await db.query(`SELECT r.*, s.name AS student_name, s.subject, he.name AS teacher_name, s.extra_data FROM school_requests r
        LEFT JOIN students s ON s.id = r.payload->>'studentId' LEFT JOIN hr_employees he ON he.id = s.teacher_id
        WHERE r.type='assist_late' AND ${status === 'history' ? "r.status <> 'new' AND r.created_at > $1" : "r.status='new' AND r.created_at > $1"}
        ORDER BY r.created_at ${status === 'history' ? 'DESC' : 'ASC'} LIMIT 200`, [daysAgo(now, status === 'history' ? 60 : 90)])).rows
        .filter(r => r.student_name != null && r.subject != null && inLangs(langs, r.subject)); // o'quvchisi topilmagan so'rov — ko'rsatilmaydi
    const out = [];
    for (const r of rows) {
        const p = r.payload || {}, day = String(p.day || '');
        const kind = p.channel === 'tg_text' ? 'message' : 'call';
        let countedThatDay = false, textThisWeek = false;
        if (/^\d{4}-\d{2}-\d{2}$/.test(day) && status !== 'history') {
            const { from, to } = T.monthBounds(day.slice(0, 7));
            const list = (await db.query('SELECT * FROM school_assist_contacts WHERE assistant_id=$1 AND student_id=$2 AND day BETWEEN $3 AND $4 AND removed_at IS NULL', [r.teacher_id, p.studentId, from, to])).rows;
            const items = A.countMonth(list, { starts: { [p.studentId]: A.studentStartOf(r.extra_data) } }).students[0]?.items || [];
            countedThatDay = items.some(i => i.status === 'counted' && i.day === day);
            textThisWeek = items.some(i => i.status === 'counted' && i.channel === 'tg_text' && T.weekStart(i.day) === T.weekStart(day));
        }
        const atMin = T.toMin(p.at);
        out.push({ id: r.id, assistantId: r.teacher_id, assistantName: r.requester_name, studentId: p.studentId || null, studentName: r.student_name || '', teacherName: r.teacher_name || '',
            at: /^\d{4}-\d{2}-\d{2}$/.test(day) ? atLocal(day, atMin ?? 12 * 60) : null, day, kind, channel: p.channel || 'phone', minutes: Number(p.minutes) || 0, reason: r.reason,
            enteredAt: iso(r.created_at), ruleCheck: status === 'history' ? { ok: r.status === 'approved', text: r.status === 'approved' ? 'Tasdiqlangan' : 'Rad etilgan' }
                : lateRuleCheck({ kind, minutes: p.minutes, day, today, countedThatDay, textThisWeek }),
            status: r.status, decidedByName: r.decided_by_name || null, decidedBy: r.decided_by && String(r.decided_by) === String(viewerId) ? 'Siz' : (r.decided_by_name || null), decidedAt: iso(r.decided_at), decisionNote: r.decision_note || '' });
    }
    return out;
}
async function lateContacts(db, user, query = {}, now = new Date()) {
    const langs = await scopeLangs(db, user, query);
    return { items: await lateItems(db, langs, query.status === 'history' ? 'history' : 'pending', now, user.id) };
}
async function decideLate(db, user, id, body = {}, now = new Date()) {
    const langs = await scopeLangs(db, user);
    const r = (await db.query(`SELECT r.*, s.subject FROM school_requests r LEFT JOIN students s ON s.id = r.payload->>'studentId' WHERE r.id=$1 AND r.type='assist_late' FOR UPDATE OF r`, [String(id)])).rows[0];
    if (!r || r.subject == null || !inLangs(langs, r.subject)) throw fail(404, 'Soʻrov topilmadi');
    if (r.status !== 'new') throw fail(409, `Soʻrov allaqachon hal qilingan${r.decided_by_name ? ` (${r.decided_by_name})` : ''}`);
    const p = r.payload || {}, today = T.nowLocal(now).date;
    if (String(p.day || '').slice(0, 7) !== today.slice(0, 7)) throw fail(409, 'Kechikkan aloqa faqat joriy oy uchun hal qilinadi — oʻtgan oyni admin tuzatadi');
    const reason = String(body.reason || '').trim();
    if (body.approve !== true) {
        if (reason.length < 3) throw fail(400, 'Rad etish sababini yozing');
        const { rows } = await db.query(`UPDATE school_requests SET status='rejected', decided_by=$2, decided_by_name=$3, decided_at=NOW(), decision_note=$4 WHERE id=$1 AND status='new' RETURNING *`,
            [r.id, String(user.id), user.name || '', reason.slice(0, 300)]);
        if (!rows.length) throw fail(409, 'Soʻrov allaqachon hal qilingan');
        return { request: rows[0] };
    }
    // Mavjud yo'l: A.adminCorrect (requestId bilan) — aloqa so'rov yuborgan yordamchiga yoziladi, so'rov "approved", o'quvchi tarixida.
    const contact = await A.adminCorrect(db, user, { requestId: r.id, studentId: p.studentId, day: p.day, channel: p.channel || 'phone', minutes: p.minutes, at: p.at,
        reason: reason.length >= 5 ? reason : `Kechikkan aloqa tasdiqlandi: ${String(r.reason || '').slice(0, 200)}`.padEnd(5, '.') }, now, { viaHead: true });
    return { contact, request: (await db.query('SELECT * FROM school_requests WHERE id=$1', [r.id])).rows[0] };
}

module.exports = {
    SCHEMA, initSchema, ready, HEAD_ROLES, invalidate,
    langsFromHr, langsFor, scopeLangs, studentLang, teacherLang, teacherFits, behindBy, isOnPlan, onPlanPct, absentStreak, riskReason,
    makeupRejectWindow, lateRuleCheck, scheduleText, nextMonth, QULF_FROM, lockWindow, ownerFits, remindOverdue,
    me, overview, listProblems, createProblem, getProblem, patchProblem, problemEvent, closeProblem, addEvent, problemItem,
    listMakeups, makeupRows, checkMakeup, risk, scopeData, studentCard, transferOptions, teachers, teacherCard, teacherLocks, trialsOf,
    assistants, assistantCard, lateContacts, lateItems, decideLate,
};
