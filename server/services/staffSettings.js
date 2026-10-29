'use strict';
// Xodim sozlamalari (Sozlamalar · Mening maoshim · Bildirishnomalar · Yo'riqnomalar).
// Faqat o'z jadvallariga yozadi (staff_*), mavjud users/hr_employees/students ma'lumotlarini
// o'zgartirmaydi. Maosh hisob-kitobi (services/payroll, js/payrollEngine) chaqiriladi, lekin
// o'zgartirilmaydi — bu yerda faqat xodimning o'z qatori ko'rsatish uchun ajratib olinadi.
const T = require('./school/time');
const S = require('./school/schedule');
const A = require('./school/assist');
const R = require('../../js/attendanceRules');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS staff_profile_extra (
 user_id TEXT PRIMARY KEY, telegram TEXT NOT NULL DEFAULT '', birthday TEXT NOT NULL DEFAULT '',
 ext TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS staff_notify_prefs (
 user_id TEXT PRIMARY KEY, prefs JSONB NOT NULL DEFAULT '{}', read_before TIMESTAMPTZ,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS staff_notify_reads (
 user_id TEXT NOT NULL, event_id TEXT NOT NULL, read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY (user_id, event_id)
);
CREATE TABLE IF NOT EXISTS staff_guide_acks (
 guide_id TEXT NOT NULL, user_id TEXT NOT NULL, user_name TEXT NOT NULL DEFAULT '', user_role TEXT NOT NULL DEFAULT '',
 acked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (guide_id, user_id)
);
`;
const state = { ready: false };
async function initSchema(db) { await db.query(SCHEMA); state.ready = true; }

const fail = (status, message) => Object.assign(new Error(message), { status });
const TEACHER_ROLES = ['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi', 'yordamchi'];
const FULL = new Set(['admin', 'boshliq']);

// ── Kim? ──────────────────────────────────────────────────────────────────────
// users ↔ hr_employees login (email) orqali. kind: teacher | assistant | sales | rop | admin | other.
async function identify(db, actor) {
    const u = (await db.query('SELECT id, name, email, role, phone, bio, avatar, created_at FROM users WHERE id=$1', [actor.id])).rows[0];
    if (!u) throw fail(401, 'Akkaunt topilmadi');
    const emp = (await db.query(`SELECT * FROM hr_employees WHERE LOWER(TRIM(login))=LOWER(TRIM($1)) AND COALESCE(status,'active') <> 'inactive'
        ORDER BY id LIMIT 1`, [u.email])).rows[0] || null;
    let kind = 'other';
    if (FULL.has(u.role)) kind = 'admin';
    else if (u.role === 'rop') kind = 'rop';
    else if (u.role === 'sales_manager') kind = 'sales';
    else if (u.role === 'teacher' && emp && TEACHER_ROLES.includes(emp.role)) kind = emp.role === 'yordamchi' ? 'assistant' : 'teacher';
    // 29-okt: yordamchi vazifasi faqat yordamchi lavozimida — asosiy ustozga eski biriktirish qolgan bo'lsa ham hisobga olinmaydi.
    let helped = 0;
    if (emp && kind === 'assistant') {
        helped = Number((await db.query(`SELECT COUNT(*)::int AS n FROM students WHERE assistant_teacher_id=$1`, [emp.id])).rows[0]?.n || 0);
    }
    let managerId = null;
    if (kind === 'sales') managerId = (await db.query('SELECT manager_id FROM user_sales_manager_links WHERE user_id=$1', [u.id]).catch(() => ({ rows: [] }))).rows[0]?.manager_id || null;
    const lang = !emp ? null : emp.role === 'rus-oqituvchi' ? 'russian' : emp.role === 'ingliz-oqituvchi' ? 'english' : (emp.lang === 'russian' || emp.lang === 'both' ? emp.lang : 'english');
    return { user: u, emp, kind, helped, assistantDuty: kind === 'assistant', mainDuty: kind === 'teacher', managerId, lang };
}

// Yo'riqnoma auditoriyasi (js/app.js resolveGuideAudienceTags bilan bir xil + yordamchi vazifasi bor ustoz).
function guideTags(me) {
    const r = me.user.role;
    if (r === 'sales_manager') return ['sales_manager'];
    if (r === 'rop') return ['rop'];
    if (r === 'hr') return ['hr'];
    if (me.kind === 'assistant') return ['teacher_assistant'];
    if (me.kind === 'teacher') return ['teacher_main'];
    if (r === 'employee' && me.emp?.role === 'marketolog') return ['marketolog'];
    if (r === 'employee' && me.emp?.role === 'head-of-teachers') return ['head_of_teachers'];
    return [];
}
async function guidesAll(db) {
    const row = (await db.query("SELECT data FROM json_data WHERE key='guides'").catch(() => ({ rows: [] }))).rows[0];
    let data = row?.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = []; } }
    return Array.isArray(data) ? data : [];
}
async function myGuides(db, me) {
    const tags = guideTags(me);
    return (await guidesAll(db)).filter(g => g && g.id && (g.targetRoles || []).some(t => tags.includes(t)));
}

// ── Profil ────────────────────────────────────────────────────────────────────
const TG_RE = /^@?[A-Za-z][A-Za-z0-9_]{3,31}$/;
const BDAY_RE = /^(\d{4}-)?\d{2}-\d{2}$/;
const ROLE_UZ = { 'ingliz-oqituvchi': 'Asosiy ustoz · Ingliz tili', 'rus-oqituvchi': 'Asosiy ustoz · Rus tili', oqituvchi: 'Asosiy ustoz', yordamchi: 'Yordamchi ustoz',
    'sotuv-menejeri': 'Sotuv menejeri', rop: 'ROP · sotuv bo\'limi rahbari' };
const shortName = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0] || ''; };

async function workInfo(db, me) {
    const e = me.emp || {};
    const joined = e.start_date || e.join_date || '';
    const langUz = me.lang === 'russian' ? 'Rus tili' : me.lang === 'both' ? 'Ingliz va rus tili' : 'Ingliz tili';
    const rows = [];
    if (me.kind === 'admin') {
        rows.push(['Lavozim', 'Administrator · to\'liq kirish']);
        rows.push(['Mas\'ul', 'Akademik bo\'lim, Dars jadvali, O\'quvchilar, Moliya tasdiqlari']);
        rows.push(['Tasdiqlaydi', 'sotuv tahrirlari (tarif, ustoz, 24 soatdan keyingi to\'lov) · qoplash · aloqa tuzatish · oy yakunini tasdiqlash']);
    } else if (me.kind === 'teacher' || me.kind === 'assistant') {
        const role = me.kind === 'assistant' ? `Yordamchi ustoz · ${langUz}` : `Asosiy ustoz · ${langUz}`;
        rows.push(['Lavozim', role]);
        const active = r => R.isActiveStudent(r);
        const helped = me.kind !== 'assistant' ? [] : (await db.query(`SELECT s.name, s.teacher_id, s.extra_data, he.name AS tname FROM students s LEFT JOIN hr_employees he ON he.id = s.teacher_id
            WHERE s.assistant_teacher_id=$1 ORDER BY s.name`, [e.id])).rows.filter(active);
        if (me.kind === 'assistant') {
            const by = new Map(); for (const r of helped) by.set(r.tname || '—', (by.get(r.tname || '—') || 0) + 1);
            rows.push(['O\'quvchilar', helped.length ? `${helped.length} ta · ${by.size} asosiy ustoz (${[...by].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${shortName(n)} ${c}`).join(', ')})` : 'hali biriktirilmagan']);
            rows.push(['Ish tartibi', 'har o\'quvchi bilan haftasiga 3 aloqa · kamida 5 daqiqa · vaqti erkin']);
        } else {
            const hours = (await db.query('SELECT weekday, start_min, end_min FROM school_teacher_hours WHERE teacher_id=$1 ORDER BY weekday, start_min', [e.id]).catch(() => ({ rows: [] }))).rows;
            // Jadval sarlavhasi bilan bitta formatlovchi (js/workHours.js: tutash oraliqlar birlashtiriladi, kunlar guruhlanadi).
            const text = require('../../js/workHours').text(hours);
            if (text) rows.push(['Ish vaqti', text]);
        }
    } else if (me.kind === 'sales') {
        rows.push(['Lavozim', 'Sotuv menejeri']);
        const rop = (await db.query(`SELECT name FROM hr_employees WHERE role='rop' AND COALESCE(status,'active') <> 'inactive' AND (lang=$1 OR lang='both') ORDER BY name LIMIT 1`, [me.lang || 'english'])).rows[0];
        if (rop) rows.push(['Rahbar', `${rop.name} (ROP)`]);
    } else if (me.kind === 'rop') {
        rows.push(['Lavozim', 'ROP · sotuv bo\'limi rahbari']);
        const team = (await db.query(`SELECT name FROM hr_employees WHERE role='sotuv-menejeri' AND COALESCE(status,'active') <> 'inactive' AND ($1::text IS NULL OR lang=$1 OR lang='both') ORDER BY name`,
            [me.lang === 'both' ? null : (me.lang || null)])).rows;
        if (team.length) rows.push(['Jamoa', `${team.length} menejer · ${team.map(t => t.name).join(', ')}`]);
        rows.push(['Tasdiqlaydi', 'menejerlarning tarif, ustoz va 24 soatdan keyingi to\'lov tahrirlari (admin bilan teng)']);
    } else if (e.role) rows.push(['Lavozim', ROLE_UZ[e.role] || e.role]);
    if (joined) rows.push(['Ishga kirgan', String(joined).slice(0, 10)]);
    return rows.map(([label, value]) => ({ label, value }));
}

async function getProfile(db, actor) {
    const me = await identify(db, actor);
    const x = (await db.query('SELECT telegram, birthday, ext FROM staff_profile_extra WHERE user_id=$1', [me.user.id])).rows[0] || {};
    const hrBirth = String(me.emp?.birth_date || '').slice(0, 10);
    return {
        kind: me.kind, assistantDuty: me.assistantDuty,
        user: { id: me.user.id, name: me.user.name, email: me.user.email, role: me.user.role, phone: me.user.phone || '', bio: me.user.bio || '', avatar: me.user.avatar || '' },
        extra: { telegram: x.telegram || '', birthday: x.birthday || (BDAY_RE.test(hrBirth) ? hrBirth : ''), ext: x.ext || '' },
        gender: me.emp?.gender || '',
        canEditName: FULL.has(me.user.role),
        work: await workInfo(db, me)
    };
}

async function saveProfile(db, actor, body = {}) {
    const me = await identify(db, actor);
    const fields = {};
    if (body.phone !== undefined) {
        const p = String(body.phone).trim();
        if (p && !/^\+?[0-9 ()-]{7,20}$/.test(p)) throw fail(400, 'Telefon raqami noto\'g\'ri');
        fields.phone = p;
    }
    if (body.bio !== undefined) fields.bio = String(body.bio).trim().slice(0, 300);
    if (body.name !== undefined && String(body.name).trim() !== me.user.name) {
        if (!FULL.has(me.user.role)) throw fail(403, 'Ism familiyani admin o\'zgartiradi');
        const n = String(body.name).trim();
        if (n.length < 2 || n.length > 80) throw fail(400, 'Ism familiya 2–80 belgi bo\'lsin');
        fields.name = n;
    }
    const extra = {};
    if (body.telegram !== undefined) {
        const t = String(body.telegram).trim();
        if (t && !TG_RE.test(t)) throw fail(400, 'Telegram: @username ko\'rinishida (5–32 belgi, lotin harf, raqam, _)');
        extra.telegram = t ? '@' + t.replace(/^@/, '') : '';
    }
    if (body.birthday !== undefined) {
        const b = String(body.birthday).trim();
        if (b && (!BDAY_RE.test(b) || Number.isNaN(Date.parse((b.length === 5 ? '2000-' + b : b) + 'T00:00:00Z')))) throw fail(400, 'Tug\'ilgan kun noto\'g\'ri');
        extra.birthday = b;
    }
    if (body.ext !== undefined) {
        if (!['admin', 'rop', 'sales'].includes(me.kind)) throw fail(403, 'Ichki raqam faqat ofis xodimlari uchun');
        const v = String(body.ext).trim();
        if (v && !/^\d{2,6}$/.test(v)) throw fail(400, 'Ichki raqam 2–6 xonali son');
        extra.ext = v;
    }
    const sets = Object.keys(fields);
    if (sets.length) await db.query(`UPDATE users SET ${sets.map((k, i) => `${k}=$${i + 2}`).join(', ')} WHERE id=$1`, [me.user.id, ...sets.map(k => fields[k])]);
    if (Object.keys(extra).length) {
        await db.query(`INSERT INTO staff_profile_extra (user_id, telegram, birthday, ext) VALUES ($1, COALESCE($2,''), COALESCE($3,''), COALESCE($4,''))
            ON CONFLICT (user_id) DO UPDATE SET telegram=COALESCE($2, staff_profile_extra.telegram), birthday=COALESCE($3, staff_profile_extra.birthday),
            ext=COALESCE($4, staff_profile_extra.ext), updated_at=NOW()`, [me.user.id, extra.telegram ?? null, extra.birthday ?? null, extra.ext ?? null]);
    }
    return getProfile(db, actor);
}

// ── Mening maoshim (faqat ko'rsatish) ─────────────────────────────────────────
// payroll.calculate o'zgartirilmaydi; xodimning o'z qatoridan o'quvchilar bo'yicha "rejada / hisobga o'tdi".
// Asosiy ustozlikda o'quvchi va dars turi bo'yicha summa berilmaydi (o'quvchi to'lovi ustozga yopiq).
async function salaryDetail(pool, actor, now = new Date()) {
    const payroll = require('./payroll');
    const engine = require('../../js/payrollEngine');
    const db = await pool.connect();
    try {
        await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const me = await identify(db, actor);
        if (!me.emp) { await db.query('COMMIT'); return { linked: false, kind: me.kind }; }
        const p = payroll.currentMonthPeriod(now), lang = engine.language(me.emp);
        const month = p.start.slice(0, 7), today = T.nowLocal(now).date;
        let row = null;
        try { row = (await payroll.calculate(db, p, lang, false)).rows.find(r => r.employeeId === me.emp.id) || null; }
        catch (e) { console.error('[staff/salary]', e.message); }
        // Maosh tarixi (salary_transactions) — "Sentyabr · berilgan" va YordamchiOyYopildi'dagi o'tgan oy qatori shu yerdan
        // (bitta manba). lessons/assistantLessons — Moliya hisobidagi dars/aloqa soni (calculation snapshot).
        const history = (await db.query(`SELECT TO_CHAR(period_start,'YYYY-MM-DD') AS start, amount, status, paid_at,
            calculation->>'lessons' AS lessons, calculation->>'assistantLessons' AS assistant_lessons FROM salary_transactions
            WHERE employee_id=$1 ORDER BY period_start DESC LIMIT 12`, [me.emp.id])).rows.map(r => ({ month: r.start.slice(0, 7), amount: Number(r.amount), status: r.status, paidAt: r.paid_at,
            lessons: r.lessons == null ? null : Number(r.lessons), assistantLessons: r.assistant_lessons == null ? null : Number(r.assistant_lessons) }));
        const card = String(me.emp.card_number || '').replace(/\D/g, '');
        const out = { linked: true, kind: me.kind, month, today, card4: card.length >= 4 ? card.slice(-4) : '', history,
            current: row ? payroll.ownView(row) : null, main: null, assist: null, missed: null, reviewMakeups: 0 };
        // Asosiy ustozlik: dars turi bo'yicha (15/30/60), o'quvchi ismi, rejada / hisobga o'tdi.
        const breakdown = Array.isArray(row?.breakdown) ? row.breakdown : [];
        const mainItems = breakdown.filter(b => b.dutyRole !== 'assistant' && b.unit !== 'contact');
        if (me.kind === 'teacher') {
            const ids = mainItems.map(b => b.studentId);
            const stRows = ids.length ? (await db.query('SELECT id, teacher_id, lesson_duration, extra_data FROM students WHERE id = ANY($1::text[])', [ids])).rows : [];
            const dur = new Map(stRows.map(r => [r.id, Number(r.lesson_duration) || 15]));
            // "Rejada" — faqat faol va hozir shu ustozdagi o'quvchilar (js/attendanceRules.js). Muzlatilgan / to'xtatilgan / tugatgan
            // yoki oy o'rtasida boshqa ustozga o'tgan o'quvchining shu ustoz bilan o'tgan darslari maoshda qoladi, rejaga faqat o'tgani qo'shiladi.
            const activeIds = new Set(stRows.filter(r => R.isActiveStudent(r) && r.teacher_id === me.emp.id).map(r => r.id));
            const review = (await db.query(`SELECT student_id FROM school_makeups WHERE teacher_id=$1 AND status='review'
                AND (to_char(held_date,'YYYY-MM')=$2 OR held_date IS NULL)`, [me.emp.id, month]).catch(() => ({ rows: [] }))).rows;
            out.reviewMakeups = review.length;
            const groups = new Map();
            for (const b of mainItems) {
                const isActive = activeIds.has(b.studentId);
                if (!isActive && !(Number(b.lessons) > 0)) continue;
                const d = dur.get(b.studentId) || 15;
                if (!groups.has(d)) groups.set(d, { duration: d, students: [], expected: 0, counted: 0, review: 0 });
                const g = groups.get(d);
                g.students.push(String(b.name || '').split(' ')[0]); g.expected += isActive ? Number(b.expected) || 0 : Number(b.lessons) || 0; g.counted += Number(b.lessons) || 0;
                g.review += review.filter(r => r.student_id === b.studentId).length;
            }
            out.main = { groups: [...groups.values()].sort((a, b) => b.duration - a.duration),
                total: row ? Number(row.mainTotal ?? (row.assistantTotal != null ? row.total - row.assistantTotal : row.total)) || 0 : 0,
                counted: row ? Number(row.mainLessons ?? row.lessons) || 0 : 0 };
            const missed = await S.missedLessons(db, me.emp.id, { from: `${month}-01`, to: today }).catch(() => []);
            const open = missed.filter(m => !m.makeup);
            const names = open.length ? new Map((await db.query('SELECT id, name FROM students WHERE id = ANY($1::text[])', [[...new Set(open.map(m => m.studentId))]])).rows.map(r => [r.id, r.name])) : new Map();
            const by = new Map(); for (const m of open) by.set(m.studentId, (by.get(m.studentId) || 0) + 1);
            out.missed = { open: open.length, planned: missed.filter(m => m.makeup?.status === 'planned').length,
                students: [...by].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ name: String(names.get(id) || '').split(' ')[0], count: n })),
                daysLeft: T.daysBetween(today, T.monthBounds(month).to) };
        }
        // Yordamchi ustozlik: aloqalar bo'yicha (assist/month bilan bir xil hisob).
        // Asosiy ustoz: yordamchi vazifasi yo'q, lekin shu oyda (masalan oktyabr) ilgari qilgan aloqalari bo'lsa —
        // ular maoshga kiradi (payroll o'zgarmagan), shuning uchun faqat o'sha aloqalar ko'rsatiladi.
        const pastRep = !me.assistantDuty && me.kind === 'teacher' ? await A.monthReport(db, me.emp.id, month) : null;
        const pastOnly = !!pastRep && pastRep.students.some(x => x.counted || x.noAnswer);
        if (me.assistantDuty || pastOnly) {
            const rep = pastRep || await A.monthReport(db, me.emp.id, month);
            // O'quvchilar ro'yxati va "oy oxirigacha ko'pi bilan" — A.possibleLeft (YordamchiBosh bilan bitta hisob).
            const pl = await A.possibleLeft(db, me.emp.id, month, rep, { pastOnly, now });
            const names = new Map((pl.students.length ? (await db.query('SELECT s.id, he.name AS tname FROM students s LEFT JOIN hr_employees he ON he.id=s.teacher_id WHERE s.id = ANY($1::text[])',
                [pl.students.map(x => x.studentId)])).rows : []).map(r => [r.id, r.tname]));
            const byId = new Map(rep.students.map(x => [x.studentId, x]));
            const list = pl.students.map(p => { const r = byId.get(p.studentId) || { counted: 0, noAnswer: 0, overCap: 0, amount: 0 };
                return { studentId: p.studentId, name: p.name, mainTeacher: shortName(names.get(p.studentId)), counted: r.counted, noAnswer: r.noAnswer, overCap: r.overCap,
                    amount: r.amount, possible: p.possible, adviceLeft: p.adviceLeft }; })
                .sort((a, b) => a.name.localeCompare(b.name));
            const prev = T.monthBounds(T.addDays(`${month}-01`, -1).slice(0, 7));
            const prevState = await db.query('SELECT * FROM school_assist_months WHERE month=$1', [prev.from.slice(0, 7)]).then(r => r.rows[0] || null).catch(() => null);
            // O'tgan oy ("Sentyabr · berilgan · 108 aloqa") — maosh tarixidagi Moliya hisobi (summa bilan bitta yozuv).
            const ph = history.find(h => h.month === prev.from.slice(0, 7));
            const prevCounted = ph ? (me.kind === 'assistant' ? ph.lessons : ph.assistantLessons) : null;
            out.assist = { pastOnly, month, rate: rep.rate, cap: rep.cap, counted: rep.counted, amount: rep.amount, students: list, prevCounted,
                possible: list.reduce((n, s) => n + s.possible, 0), possibleAmount: pl.possibleAmount, monthly: rep.monthly, daysLeft: T.daysBetween(today, T.monthBounds(month).to),
                prevMonth: prev.from.slice(0, 7), prevState: prevState ? { prelimAt: prevState.prelim_at, objectionUntil: S.dateStr(prevState.objection_until), finalAt: prevState.final_at, paidAt: prevState.paid_at } : null };
        }
        // Oy chegarasi (1–5-sana): yopilgan, hali to'lanmagan o'tgan oy — Bosh/Davomat (yordamchi: /assist/month?month=o'tgan oy)
        // bilan bir xil summa. To'langan bo'lsa — tarixdagi qator yetarli.
        if (Number(today.slice(8, 10)) <= 5) {
            const pm = T.addDays(`${month}-01`, -1).slice(0, 7), ph = history.find(h => h.month === pm);
            if (!ph || ph.status !== 'paid') {
                let closed = null;
                if (me.kind === 'assistant') {
                    const rep = await A.monthReport(db, me.emp.id, pm);
                    if (rep.counted || rep.state?.locked_at) closed = { month: pm, amount: ph ? ph.amount : rep.amount, counted: rep.counted, rate: rep.rate, monthly: rep.monthly, source: ph ? 'finance' : 'contacts',
                        state: rep.state ? { prelimAt: rep.state.prelim_at, objectionUntil: S.dateStr(rep.state.objection_until), finalAt: rep.state.final_at, paidAt: rep.state.paid_at } : null };
                } else if (me.kind === 'teacher') {
                    let prow = null;
                    try { const b = T.monthBounds(pm); prow = (await payroll.calculate(db, engine.period(b.from, b.to), lang, false)).rows.find(r => r.employeeId === me.emp.id) || null; }
                    catch (e) { console.error('[staff/salary closed]', e.message); }
                    if (prow) closed = { month: pm, amount: ph ? ph.amount : Number(prow.total) || 0, counted: Number(prow.lessons) || 0, source: ph ? 'finance' : 'payroll' };
                }
                if (closed) out.closed = closed;
            }
        }
        await db.query('COMMIT');
        return out;
    } catch (e) {
        await db.query('ROLLBACK').catch(() => {});
        throw e;
    } finally { db.release(); }
}

// ── Yo'riqnoma bilan tanishish ────────────────────────────────────────────────
async function ackGuide(db, actor, guideId) {
    const me = await identify(db, actor);
    const g = (await myGuides(db, me)).find(x => String(x.id) === String(guideId));
    if (!g) throw fail(404, 'Yo\'riqnoma topilmadi yoki sizga tegishli emas');
    const { rows } = await db.query(`INSERT INTO staff_guide_acks (guide_id, user_id, user_name, user_role) VALUES ($1,$2,$3,$4)
        ON CONFLICT (guide_id, user_id) DO UPDATE SET user_name=EXCLUDED.user_name RETURNING guide_id, acked_at`, [g.id, me.user.id, me.user.name, me.user.role]);
    return { guideId: rows[0].guide_id, ackedAt: rows[0].acked_at };
}
async function myAcks(db, actor) {
    const rows = (await db.query('SELECT guide_id, acked_at FROM staff_guide_acks WHERE user_id=$1', [actor.id])).rows;
    return rows.map(r => ({ guideId: r.guide_id, ackedAt: r.acked_at }));
}
// Admin / boshliq / HR: kim tanishgani (guideId bo'yicha).
async function allAcks(db, actor, guideId = null) {
    const u = (await db.query('SELECT role FROM users WHERE id=$1', [actor.id])).rows[0];
    if (!u || !['admin', 'boshliq', 'hr'].includes(u.role)) throw fail(403, 'Ruxsat yo\'q');
    const rows = (await db.query(`SELECT guide_id, user_id, user_name, user_role, acked_at FROM staff_guide_acks
        ${guideId ? 'WHERE guide_id=$1' : ''} ORDER BY acked_at DESC LIMIT 2000`, guideId ? [guideId] : [])).rows;
    return rows.map(r => ({ guideId: r.guide_id, userId: r.user_id, name: r.user_name, role: r.user_role, ackedAt: r.acked_at }));
}

module.exports = { SCHEMA, state, initSchema, identify, guideTags, myGuides, getProfile, saveProfile, salaryDetail, ackGuide, myAcks, allAcks, fail, FULL };
