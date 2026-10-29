'use strict';
// Yordamchi ustoz aloqalari (assist contacts) va oylik hisob.
// Qoidalar (Abdulloh, 27–28-okt):
//  • aloqa kamida 5 daqiqa; yozishma (Telegram matn) haftasiga 1 tagacha hisoblanadi;
//  • "javob bermadi" yoziladi, lekin hisoblanmaydi;
//  • bir o'quvchi bilan bir kunda bittasi hisoblanadi;
//  • har o'quvchi bilan oyiga 13 tagacha, har biri = yordamchi oylik tarifi ÷ 13 (KPI sozlamasi; 29-okt: 40 000 → 3 077 so'm),
//    o'quvchi tarifiga bog'liq emas;
//  • muzlagan kunlarda aloqa belgilanmaydi, chegara va narx o'zgarmaydi;
//  • oy o'rtasida chiqib ketgan o'quvchining o'qigan davridagi aloqalari ham hisoblanadi;
//  • aloqa faqat shu kuni belgilanadi — keyin admin tuzatadi (sabab bilan);
//  • oy 1-sanada 00:00 da qulflanadi → dastlabki tasdiq → e'tiroz 4-sanagacha → to'lov 5-sana.
const { randomUUID } = require('node:crypto');
const T = require('./time');
const S = require('./schedule');
const { fail } = T;

// Zaxira qiymat — haqiqiy narx salary_kpi_settings (Moliya → KPI sozlamalari, "Yordamchi tarifi") dan olinadi (contactRate).
const MONTHLY_DEFAULT = 40000;
const RATE = Math.round(MONTHLY_DEFAULT / 13);
const MONTH_CAP = 13;
// Aloqalar bo'yicha hisob shu oydan (payroll.js ham shu qiymatni oladi — bitta manba).
const CONTACTS_FROM = process.env.ASSIST_CONTACTS_FROM || '2026-10';
// 29-okt qaroridan oldingi yordamchi oylik tarifi (sentyabr va undan oldin: 50 000 → 3 846 so'm × aloqa).
const LEGACY_MONTHLY = 50000;
// Summa = round(oylik tarif × hisoblangan aloqalar / 13): 13 aloqa aniq oylik tarif (40 000, 40 001 emas).
// payrollEngine contacts-v1 bilan bir xil formula (har o'quvchi bo'yicha yaxlitlanadi).
// Bitta formula — js/attendanceRules.assistAmount (brauzer zaxirasi ham shu): round(oylik × aloqa / 13).
function contactAmount(monthly, counted) { return require('../../../js/attendanceRules').assistAmount(monthly, counted, MONTH_CAP); }
// O'quvchi kurs boshlagan sana — payrollEngine bilan bir xil (extra_data.startDate || joinDate).
function studentStartOf(extra) {
    let x = extra;
    if (typeof x === 'string') { try { x = JSON.parse(x); } catch { x = {}; } }
    const v = String(x?.startDate || x?.joinDate || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
async function studentStarts(db, ids) {
    const list = [...new Set((ids || []).filter(Boolean).map(String))];
    if (!list.length) return new Map();
    const rows = (await db.query('SELECT id, extra_data FROM students WHERE id = ANY($1::text[])', [list])).rows;
    return new Map(rows.map(r => [r.id, studentStartOf(r.extra_data)]).filter(([, d]) => d));
}
const MIN_MINUTES = 5;
const CHANNELS = { phone: 'Telefon', zoom: 'Zoom', meet: 'Google Meet', tg_video: 'Telegram video', tg_group: 'Telegram guruh videodars', tg_text: 'Telegram yozishma' };

// Sof hisob: bir yordamchining oy aloqalari → har o'quvchi bo'yicha hisoblangan soni.
// opts.monthly — yordamchi oylik tarifi (summa = round(monthly × hisoblangan / 13)); eski chaqiruv (2-argument son) — bir aloqa narxi.
// opts.starts — o'quvchi kurs boshlagan sana (Map yoki obyekt): undan oldingi aloqa "before_start" — sanalmaydi
// va oylik chegarani band qilmaydi (maosh hisobi bilan bir xil).
function countMonth(contacts, opts = {}) {
    if (typeof opts === 'number') opts = { monthly: opts === RATE ? MONTHLY_DEFAULT : opts * MONTH_CAP };
    const monthly = Number(opts.monthly) > 0 ? Number(opts.monthly) : MONTHLY_DEFAULT;
    const rate = Math.round(monthly / MONTH_CAP);
    const startOf = sid => (opts.starts instanceof Map ? opts.starts.get(sid) : opts.starts?.[sid]) || null;
    const byStudent = new Map();
    const rows = [...contacts].filter(c => !c.removed_at)
        .sort((a, b) => String(S.dateStr(a.day)).localeCompare(String(S.dateStr(b.day))) || String(a.created_at).localeCompare(String(b.created_at)));
    for (const c of rows) {
        const sid = c.student_id;
        if (!byStudent.has(sid)) byStudent.set(sid, { studentId: sid, counted: 0, noAnswer: 0, overCap: 0, short: 0, sameDay: 0, extraText: 0, beforeStart: 0, days: new Set(), textWeeks: new Set(), items: [] });
        const s = byStudent.get(sid);
        const day = S.dateStr(c.day);
        const start = startOf(sid);
        let status = 'counted';
        if (start && day < start) status = 'before_start';
        else if (c.outcome === 'no_answer') status = 'no_answer';
        else if (c.channel !== 'tg_text' && Number(c.minutes) < MIN_MINUTES) status = 'short';
        else if (s.days.has(day)) status = 'same_day';
        else if (c.channel === 'tg_text' && s.textWeeks.has(T.weekStart(day))) status = 'extra_text';
        else if (s.counted >= MONTH_CAP) status = 'over_cap';
        if (status === 'counted') { s.counted++; s.days.add(day); if (c.channel === 'tg_text') s.textWeeks.add(T.weekStart(day)); }
        else if (status === 'no_answer') s.noAnswer++;
        else if (status === 'over_cap') s.overCap++;
        else if (status === 'short') s.short++;
        else if (status === 'same_day') s.sameDay++;
        else if (status === 'before_start') s.beforeStart++;
        else s.extraText++;
        s.items.push({ id: c.id, day, at: c.at_min ?? null, channel: c.channel, minutes: c.minutes, outcome: c.outcome, status, note: c.note || '', corrected: !!c.correction_reason });
    }
    const students = [...byStudent.values()].map(({ days, textWeeks, ...rest }) => ({ ...rest, amount: contactAmount(monthly, rest.counted) }));
    const counted = students.reduce((n, s) => n + s.counted, 0);
    return { students, counted, rate, monthly, amount: students.reduce((n, s) => n + s.amount, 0), noAnswer: students.reduce((n, s) => n + s.noAnswer, 0),
        overCap: students.reduce((n, s) => n + s.overCap, 0), beforeStart: students.reduce((n, s) => n + s.beforeStart, 0) };
}

async function assistantForActor(db, actor) {
    return require('../teacherDuties').teacherForActor(db, actor);
}
async function monthState(db, month) {
    return (await db.query('SELECT * FROM school_assist_months WHERE month=$1', [month])).rows[0] || null;
}
// Yordamchi uchun o'tgan oy 1-sana 00:00 da qulflanadi (faqat bugun belgilanadi). Admin tuzatishi
// va kechikib belgilash so'rovi e'tiroz davrida ham ishlaydi — yakuniy tasdiqdan (final_at) keyin yopiladi.
async function isLocked(db, month) {
    const st = await monthState(db, month);
    return !!st?.final_at;
}

// Yordamchi belgilaydi — faqat bugungi kun uchun.
async function mark(db, actor, body, now = new Date()) {
    const me = await assistantForActor(db, actor);
    const today = T.nowLocal(now).date;
    const day = body.day ? T.assertDate(body.day) : today;
    if (day !== today) throw fail(409, 'Aloqa faqat shu kuni belgilanadi — o\'tgan kun uchun admin orqali so\'rov yuboring');
    const st = (await db.query('SELECT id, assistant_teacher_id FROM students WHERE id=$1', [body.studentId])).rows[0];
    if (!require('../teacherDuties').hasAssistantDuty(me)) throw fail(403, 'Aloqani yordamchi ustoz belgilaydi — asosiy ustoz yordamchi bo\'la olmaydi');
    if (!st || st.assistant_teacher_id !== me.id) throw fail(403, 'Bu o\'quvchi sizga biriktirilmagan');
    const statuses = await db.query('SELECT * FROM school_student_status WHERE student_id=$1 AND cancelled_at IS NULL', [body.studentId]);
    const state = S.statusOn(statuses.rows, day);
    if (state !== 'active') throw fail(409, state === 'frozen' ? 'O\'quvchi muzlatilgan — bu kunlarda aloqa belgilanmaydi' : 'O\'quvchi faol emas');
    const outcome = body.outcome === 'no_answer' ? 'no_answer' : 'contacted';
    const channel = String(body.channel || '');
    if (outcome === 'contacted' && !CHANNELS[channel]) throw fail(400, 'Aloqa usulini tanlang');
    const minutes = outcome === 'no_answer' ? 0 : Math.round(Number(body.minutes) || 0);
    if (outcome === 'contacted' && channel !== 'tg_text' && (minutes < 1 || minutes > 180)) throw fail(400, 'Davomiylikni daqiqada kiriting');
    const atMin = T.toMin(body.at) ?? T.nowLocal(now).min;
    const { rows } = await db.query(`INSERT INTO school_assist_contacts (id,student_id,assistant_id,day,at_min,channel,minutes,note,outcome,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [randomUUID(), body.studentId, me.id, day, atMin, outcome === 'no_answer' ? (channel || 'phone') : channel, minutes, String(body.note || '').slice(0, 500), outcome, actor.id]);
    return rows[0];
}
// Yordamchi o'z bugungi yozuvini o'chirishi mumkin (xato kiritgan bo'lsa).
async function removeOwnToday(db, actor, id, now = new Date()) {
    const me = await assistantForActor(db, actor);
    const today = T.nowLocal(now).date;
    const { rows } = await db.query(`UPDATE school_assist_contacts SET removed_at=NOW(), removed_by=$3
        WHERE id=$1 AND assistant_id=$2 AND day=$4 AND removed_at IS NULL RETURNING *`, [id, me.id, actor.id, today]);
    if (!rows.length) throw fail(409, 'Faqat bugungi o\'z yozuvingizni o\'chirasiz');
    return rows[0];
}
// Admin tuzatishi: o'tgan kunga qo'shish yoki o'chirish, sabab bilan. Qulflangan oyda — yo'q.
async function adminCorrect(db, actor, body, now = new Date()) {
    if (!['admin', 'boshliq'].includes(actor.role)) throw fail(403, 'Aloqani faqat admin tuzatadi');
    const reason = String(body.reason || '').trim();
    if (reason.length < 5) throw fail(400, 'Tuzatish sababini yozing');
    if (body.removeId) {
        const c = (await db.query('SELECT * FROM school_assist_contacts WHERE id=$1 FOR UPDATE', [body.removeId])).rows[0];
        if (!c) throw fail(404, 'Yozuv topilmadi');
        if (await isLocked(db, S.dateStr(c.day).slice(0, 7))) throw fail(409, 'Oy yakuniy tasdiqlangan — o\'zgartirib bo\'lmaydi');
        return (await db.query('UPDATE school_assist_contacts SET removed_at=NOW(), removed_by=$2, correction_reason=$3 WHERE id=$1 RETURNING *', [c.id, actor.id, reason])).rows[0];
    }
    // Qatordan tuzatish (usul, vaqt, daqiqa yoki sana): eski yozuv o'chiriladi (tarixda qoladi), o'rniga yangisi — bitta tranzaksiyada.
    let prev = null;
    if (body.editId) {
        prev = (await db.query('SELECT * FROM school_assist_contacts WHERE id=$1 AND removed_at IS NULL FOR UPDATE', [body.editId])).rows[0];
        if (!prev) throw fail(404, 'Yozuv topilmadi yoki allaqachon tuzatilgan');
        if (await isLocked(db, S.dateStr(prev.day).slice(0, 7))) throw fail(409, 'Oy yakuniy tasdiqlangan — o\'zgartirib bo\'lmaydi');
        body = { ...body, studentId: prev.student_id, assistantId: prev.assistant_id, day: body.day || S.dateStr(prev.day) };
    }
    // Yordamchining "admin orqali so'rov"i tasdiqlansa — aloqa so'rovni yuborgan yordamchiga yoziladi
    // (o'quvchining hozirgi yordamchisi boshqa bo'lib qolgan bo'lsa ham), o'quvchi so'rovdagi bilan bir xil.
    let lateReq = null;
    if (body.requestId) {
        lateReq = (await db.query("SELECT * FROM school_requests WHERE id=$1 AND type='assist_late' FOR UPDATE", [body.requestId])).rows[0] || null;
        if (!lateReq) throw fail(404, 'So\'rov topilmadi');
        if (lateReq.status !== 'new') throw fail(409, 'So\'rov allaqachon hal qilingan');
        const p = lateReq.payload || {};
        if (p.studentId && body.studentId && String(body.studentId) !== String(p.studentId)) throw fail(400, 'O\'quvchi so\'rovdagi bilan bir xil bo\'lsin');
        body = { ...body, studentId: p.studentId || body.studentId, assistantId: lateReq.teacher_id };
    }
    const day = T.assertDate(body.day);
    if (await isLocked(db, day.slice(0, 7))) throw fail(409, 'Oy yakuniy tasdiqlangan — o\'zgartirib bo\'lmaydi');
    if (day > T.nowLocal(now).date) throw fail(400, 'Kelajak sanaga yozib bo\'lmaydi');
    const st = (await db.query('SELECT assistant_teacher_id FROM students WHERE id=$1', [body.studentId])).rows[0];
    if (!prev && !st?.assistant_teacher_id) throw fail(400, 'O\'quvchida yordamchi yo\'q');
    const noAnswer = body.outcome === 'no_answer';
    if (!noAnswer && !CHANNELS[body.channel]) throw fail(400, 'Aloqa usulini tanlang');
    if (prev) await db.query('UPDATE school_assist_contacts SET removed_at=NOW(), removed_by=$2, correction_reason=$3 WHERE id=$1', [prev.id, actor.id, reason]);
    const { rows } = await db.query(`INSERT INTO school_assist_contacts (id,student_id,assistant_id,day,at_min,channel,minutes,note,outcome,created_by,correction_reason)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [randomUUID(), body.studentId, body.assistantId || st?.assistant_teacher_id, day, T.toMin(body.at), noAnswer ? (CHANNELS[body.channel] ? body.channel : 'phone') : body.channel,
            noAnswer ? 0 : Math.round(Number(body.minutes) || 0), String(body.note ?? prev?.note ?? '').slice(0, 500), noAnswer ? 'no_answer' : 'contacted', actor.id, reason]);
    if (body.requestId) await db.query(`UPDATE school_requests SET status='approved', decided_by=$2, decided_by_name=$3, decided_at=NOW() WHERE id=$1 AND status='new'`,
        [body.requestId, actor.id, actor.name || '']);
    return rows[0];
}

// Yordamchi oylik tarifi shu oy uchun — maosh hisobi (payrollEngine contacts-v1: round(tarif × aloqa / 13)) bilan bitta manba:
//  • shu oy uchun Moliya hisoblagan/to'lagan yozuv (salary_transactions.basis.settings) bo'lsa — o'sha sozlama (keyin o'zgartirilsa ham);
//  • aks holda: CONTACTS_FROM (2026-10) dan oldingi oylar — eski tarif 50 000 (3 846 so'm), keyingilar — joriy KPI sozlamasi.
async function monthlyRate(db, assistantId, month = null) {
    const engine = require('../../../js/payrollEngine');
    try {
        if (month) {
            const { from, to } = T.monthBounds(month);
            // Faqat YAKUNIY oy (to'langan yozuv yoki oy yakuniy tasdiqlangan — school_assist_months.final_at) o'z tarifini saqlaydi.
            // To'lanmagan qoralama (masalan, 29-oktgacha 50 000 bilan hisoblangan oktyabr) joriy qoida bo'yicha qayta hisoblanadi (BAHO-5 yordamchi #9c).
            const t = (await db.query(`SELECT basis->'settings'->'assistant'->>'rate' AS rate, status FROM salary_transactions
                WHERE employee_id=$1 AND period_start <= $3 AND period_end >= $2 AND basis IS NOT NULL ORDER BY (status='paid') DESC, period_start LIMIT 1`, [assistantId, from, to])).rows[0];
            const snap = Number(t?.rate);
            const hasMonths = t && t.status !== 'paid' ? (await db.query("SELECT to_regclass('public.school_assist_months')::text AS t")).rows[0]?.t : null;
            const final = t && (t.status === 'paid' || (hasMonths && !!(await db.query('SELECT final_at FROM school_assist_months WHERE month=$1', [month])).rows[0]?.final_at));
            if (final && Number.isFinite(snap) && snap > 0) return { monthly: snap, source: t.status === 'paid' ? 'paid' : 'final' };
            if (month < CONTACTS_FROM) return { monthly: LEGACY_MONTHLY, source: 'legacy' };
        }
        const emp = (await db.query('SELECT * FROM hr_employees WHERE id=$1', [assistantId])).rows[0] || {};
        const row = (await db.query('SELECT data FROM salary_kpi_settings WHERE language=$1', [engine.language(emp)])).rows[0];
        const monthly = Number(row?.data?.assistant?.rate);
        return { monthly: Number.isFinite(monthly) && monthly > 0 ? monthly : MONTHLY_DEFAULT, source: 'settings' };
    } catch { return { monthly: month && month < CONTACTS_FROM ? LEGACY_MONTHLY : MONTHLY_DEFAULT, source: 'default' }; }
}
// Bir aloqa narxi (ko'rsatish uchun: 3 077 / eski oylar 3 846).
async function contactRate(db, assistantId, month = null) {
    return Math.round((await monthlyRate(db, assistantId, month)).monthly / MONTH_CAP);
}
// Oyning "faollar" ro'yxati — o'sha oy holati bo'yicha (bugungi flaglar emas), yopilgan oyda o'zgarmaydi:
//  • chiqib ketgan — shu oy ichida "left" bo'lgan va oy oxirida ham chiqib ketgan;
//  • faol — kurs shu oy oxirigacha boshlangan, chiqib ketmagan va oyning yarmidan ko'pida faol bo'lgan
//    (yoki shu oyda hisoblangan aloqasi bor). Muzlatilgan oyning ko'p qismini o'tkazgan o'quvchi kirmaydi.
async function monthRoster(db, assistantId, month, report) {
    const R = require('../../../js/attendanceRules');
    const { from, to } = T.monthBounds(month);
    const had = new Set(report.students.filter(x => x.counted || x.noAnswer).map(x => x.studentId));
    const studs = (await db.query(`SELECT id, extra_data FROM students WHERE assistant_teacher_id=$1 OR id = ANY($2::text[])`, [assistantId, [...had]])).rows;
    if (!studs.length) return { active: [], left: [] };
    const statuses = (await db.query('SELECT * FROM school_student_status WHERE cancelled_at IS NULL AND student_id = ANY($1::text[])', [studs.map(s => s.id)])).rows;
    const by = new Map(); for (const r of statuses) { if (!by.has(r.student_id)) by.set(r.student_id, []); by.get(r.student_id).push(r); }
    const counted = new Map(report.students.map(x => [x.studentId, x.counted]));
    const active = [], left = [];
    for (const s of studs) {
        let x = s.extra_data; if (typeof x === 'string') { try { x = JSON.parse(x); } catch { x = {}; } }
        if (x?.isStaffDemo === true) continue;
        const rows = by.get(s.id) || [];
        const start = studentStartOf(x);
        if (start && start > to) continue;
        const span = T.dateRange(start && start > from ? start : from, to, 32);
        const state = d => rows.length ? R.statusOn(rows, d) : (R.isActiveStudent(x) ? 'active' : 'left');
        const leftIn = rows.some(r => r.status === 'left' && S.dateStr(r.from_date) >= from && S.dateStr(r.from_date) <= to) && state(to) === 'left';
        if (leftIn) { left.push(s.id); continue; }
        const activeDays = span.filter(d => state(d) === 'active').length;
        if ((counted.get(s.id) || 0) > 0 || activeDays * 2 > span.length) active.push(s.id);
    }
    return { active, left };
}
async function monthReport(db, assistantId, month) {
    const { from, to } = T.monthBounds(month);
    const contacts = (await db.query('SELECT * FROM school_assist_contacts WHERE assistant_id=$1 AND day BETWEEN $2 AND $3', [assistantId, from, to])).rows;
    const mr = await monthlyRate(db, assistantId, month);
    const starts = await studentStarts(db, contacts.map(c => c.student_id));
    const r = countMonth(contacts, { monthly: mr.monthly, starts });
    const corrections = contacts.filter(c => c.correction_reason && !c.removed_at).length;
    // Shu oy uchun to'langan maosh bo'lsa — "yakuniy" summa o'sha to'langan summa (Mening maoshim tarixi bilan bir xil).
    const paidRow = (await db.query(`SELECT amount, paid_at FROM salary_transactions WHERE employee_id=$1 AND status='paid'
        AND period_start <= $3 AND period_end >= $2 ORDER BY period_start LIMIT 1`, [assistantId, from, to]).catch(() => ({ rows: [] }))).rows[0];
    const paid = paidRow ? { amount: Number(paidRow.amount), paidAt: paidRow.paid_at } : null;
    const roster = await monthRoster(db, assistantId, month, r).catch(() => null);
    const people = await monthPeople(db, month, [...r.students.map(x => x.studentId), ...(roster?.active || []), ...(roster?.left || [])], roster).catch(() => ({}));
    return { month, assistantId, rate: r.rate, monthly: mr.monthly, rateSource: mr.source, policy: month < CONTACTS_FROM ? 'legacy' : 'contacts-v1', cap: MONTH_CAP, ...r,
        computedAmount: r.amount, amount: paid ? paid.amount : r.amount, paid, roster, people, corrections, state: await monthState(db, month) };
}
// Oy hisobotidagi o'quvchilar — o'sha oy holati bo'yicha (joriy biriktirishdan emas; yopilgan oyda keyin o'zgarmaydi):
//  { [studentId]: { name, teacherId, teacherName, left } } — asosiy ustoz oy oxiridagi ustozlar tarixidan (school_teacher_history),
//  tarix yo'q bo'lsa — students.teacher_id; left — shu oyda chiqib ketgan (monthRoster). O'quvchi keyin yordamchidan ajratilsa,
//  boshqa yordamchiga yoki ustozga o'tsa ham shu oy jadvali avvalgidek ko'rinadi.
async function monthPeople(db, month, ids, roster) {
    const list = [...new Set((ids || []).filter(Boolean).map(String))];
    if (!list.length) return {};
    const { to } = T.monthBounds(month);
    const studs = (await db.query('SELECT id, name, teacher_id, extra_data FROM students WHERE id = ANY($1::text[])', [list])).rows;
    const hist = (await db.query("SELECT to_regclass('public.school_teacher_history')::text AS t")).rows[0]?.t
        ? (await db.query('SELECT student_id, teacher_id, from_date FROM school_teacher_history WHERE student_id = ANY($1::text[]) AND from_date <= $2 ORDER BY from_date, created_at', [list, to])).rows : [];
    const lastTeacher = new Map(); for (const h of hist) lastTeacher.set(h.student_id, h.teacher_id);
    const tIds = [...new Set(studs.map(s => lastTeacher.get(s.id) || s.teacher_id).filter(Boolean))];
    const names = new Map();
    if (tIds.length) {
        const hasTeachers = (await db.query("SELECT to_regclass('public.teachers')::text AS t")).rows[0]?.t;
        for (const r of (await db.query(`SELECT id, name FROM hr_employees WHERE id = ANY($1::text[])
            ${hasTeachers ? 'UNION ALL SELECT id, name FROM teachers WHERE id = ANY($1::text[]) AND id NOT IN (SELECT id FROM hr_employees)' : ''}`, [tIds])).rows) names.set(r.id, r.name);
    }
    const left = new Set(roster?.left || []);
    return Object.fromEntries(studs.map(s => { const tid = lastTeacher.get(s.id) || s.teacher_id || null;
        return [s.id, { name: s.name || '', teacherId: tid, teacherName: tid ? names.get(tid) || '' : '', left: left.has(s.id) }]; }));
}

// Oyni yopish bosqichlari (admin / moliya).
async function advanceMonth(db, actor, month, step, now = new Date()) {
    if (!['admin', 'boshliq'].includes(actor.role)) throw fail(403, 'Oyni admin tasdiqlaydi');
    T.monthBounds(month);
    if (T.nowLocal(now).date.slice(0, 7) <= month) throw fail(409, 'Oy hali tugamagan');
    await db.query(`INSERT INTO school_assist_months (month, locked_at) VALUES ($1, NOW()) ON CONFLICT (month) DO NOTHING`, [month]);
    const st = await monthState(db, month);
    if (step === 'prelim') {
        if (st.prelim_at) throw fail(409, 'Dastlabki tasdiq berilgan');
        const next = T.addDays(T.monthBounds(month).to, 4);
        return (await db.query('UPDATE school_assist_months SET prelim_by=$2, prelim_at=NOW(), objection_until=$3 WHERE month=$1 RETURNING *', [month, actor.id, next])).rows[0];
    }
    if (step === 'final') {
        if (!st.prelim_at) throw fail(409, 'Avval dastlabki tasdiq');
        if (T.nowLocal(now).date <= S.dateStr(st.objection_until)) throw fail(409, 'E\'tiroz muddati hali tugamagan');
        return (await db.query('UPDATE school_assist_months SET final_at=NOW() WHERE month=$1 RETURNING *', [month])).rows[0];
    }
    if (step === 'paid') {
        if (!st.final_at) throw fail(409, 'Avval yakuniy tasdiq');
        return (await db.query('UPDATE school_assist_months SET paid_at=NOW() WHERE month=$1 RETURNING *', [month])).rows[0];
    }
    throw fail(400, 'Bosqich noto\'g\'ri');
}

// Yordamchining bugungi tavsiya ro'yxati: asosiy dars kunlari oralig'i, faol o'quvchilar.
function adviceFor(students, statusBy, date) {
    const wd = T.weekday(date);
    return students.filter(s => T.adviceDays(s.day).includes(wd) && S.statusOn(statusBy.get(s.id) || [], date) === 'active').map(s => s.id);
}

// Tavsiya jadvali (saqlanmaydi — har safar hisoblanadi): har faol o'quvchiga asosiy dars kunlari
// oralig'ida (Se·Pa·Sh → Du·Ch·Ju) o'z dars vaqtida aloqa tavsiyasi. Belgilangan aloqa o'z vaqtida
// ko'rinadi va shu kungi tavsiyaning o'rnini oladi. Jadvalni band qilmaydi, maosh hisobini o'zgartirmaydi.
async function plan(db, { assistantIds = null, from, to, subject = null, now = new Date() }) {
    const where = assistantIds ? 'assistant_teacher_id = ANY($1::text[])' : "COALESCE(assistant_teacher_id,'') <> ''";
    const [stRows, statuses] = await Promise.all([
        db.query(`SELECT id,name,subject,teacher_id,assistant_teacher_id,lesson_day_of_week,lesson_time,lesson_duration,extra_data FROM students WHERE ${where}`, assistantIds ? [assistantIds] : []),
        db.query('SELECT * FROM school_student_status WHERE cancelled_at IS NULL')
    ]);
    const statusBy = new Map();
    for (const r of statuses.rows) { if (!statusBy.has(r.student_id)) statusBy.set(r.student_id, []); statusBy.get(r.student_id).push(r); }
    // Holat yozuvlari bor o'quvchida faollik SANA bo'yicha (masalan 13-okt chiqib ketgan, 4-noy qaytadigan — eski "inactive" belgisi
    // qaytish kunigacha turadi): qaytgan kunidan tavsiya chiqadi. Yozuvsiz eski "inactive" va xodim demo — hech qachon.
    const extraOf = r => (typeof r.extra_data === 'object' && r.extra_data ? r.extra_data : (() => { try { return JSON.parse(r.extra_data || '{}'); } catch { return {}; } })());
    const demo = new Set(stRows.rows.filter(r => extraOf(r).isStaffDemo === true).map(r => r.id));
    const byDate = s => (statusBy.get(s.id) || []).length > 0;
    const students = stRows.rows.map(S.studentRow).filter(s => !demo.has(s.id) && (!s.legacyInactive || byDate(s)) && s.assistantId && (!subject || (s.subject || 'english') === subject));
    // startDate — maosh bilan bir xil (extra_data.startDate || joinDate).
    for (const s of students) { const r = stRows.rows.find(x => x.id === s.id); s.startDate = studentStartOf(r?.extra_data) || s.startDate; }
    const ids = assistantIds ? assistantIds.map(String) : [...new Set(students.map(s => s.assistantId))];
    const byId = new Map(students.map(s => [s.id, s]));
    // Hisob holati (hisoblandi / javob bermadi / ...) oy bo'yicha — countMonth bilan bir xil qoida.
    const mFrom = T.monthBounds(from.slice(0, 7)).from, mTo = T.monthBounds(to.slice(0, 7)).to;
    const contacts = ids.length ? (await db.query(`SELECT * FROM school_assist_contacts WHERE assistant_id = ANY($1::text[]) AND day BETWEEN $2 AND $3 AND removed_at IS NULL`,
        [ids, mFrom, mTo])).rows.map(c => ({ ...c, day: S.dateStr(c.day) })) : [];
    const statusOf = new Map();
    const planStarts = await studentStarts(db, contacts.map(c => c.student_id));
    for (const aid of ids) for (const m of new Set(contacts.map(c => c.day.slice(0, 7)))) {
        const r = countMonth(contacts.filter(c => c.assistant_id === aid && c.day.slice(0, 7) === m), { starts: planStarts });
        for (const st of r.students) for (const it of st.items) statusOf.set(it.id, it.status);
    }
    const items = [];
    const done = new Set();
    // Tavsiya kuni: o'quvchining asosiy darslari oralig'i, kurs boshlangan va o'quvchi shu kuni faol (js/attendanceRules.activeOn — bitta ta'rif).
    const R = require('../../../js/attendanceRules');
    const adviceOn = (s, d) => !!s && s.day != null && T.adviceDays(s.day).includes(T.weekday(d)) && !(s.startDate && d < String(s.startDate).slice(0, 10))
        && R.activeOn({ legacyInactive: s.legacyInactive && !byDate(s), frozen: s.legacyFrozen }, statusBy.get(s.id) || [], d);
    for (const c of contacts.filter(c => c.day >= from && c.day <= to)) {
        const s = byId.get(c.student_id);
        if (!s && subject) continue;
        const at = c.at_min != null ? Number(c.at_min) : (T.toMin(s?.time) ?? 9 * 60);
        done.add(`${c.student_id}|${c.day}`);
        items.push({ kind: 'contact', id: c.id, assistantId: c.assistant_id, studentId: c.student_id, studentName: s?.name || '', date: c.day, start: at,
            end: at + Math.max(10, Number(c.minutes) || 0), channel: c.channel, minutes: Number(c.minutes) || 0, outcome: c.outcome, status: statusOf.get(c.id) || 'counted',
            advice: adviceOn(s, c.day) && T.toMin(s.time) != null });
    }
    const today = T.nowLocal(now).date;
    for (const d of T.dateRange(from, to, 62)) {
        for (const s of students) {
            if (done.has(`${s.id}|${d}`) || !adviceOn(s, d)) continue;
            const start = T.toMin(s.time); if (start == null) continue;
            items.push({ kind: 'advice', assistantId: s.assistantId, studentId: s.id, studentName: s.name, date: d, start, end: start + 15, past: d < today });
        }
    }
    items.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
    return { from, to, assistantIds: ids, items };
}

// "Oy oxirigacha ko'pi bilan" — YordamchiBosh va Sozlamalar → Mening maoshim uchun yagona hisob:
// har o'quvchida min(oylik chegara, hisoblangan + bugundan oy oxirigacha qolgan tavsiya kunlari).
// O'quvchilar: hozir shu yordamchiga biriktirilgan faollar (js/attendanceRules.js) + shu oyda hisoblangan aloqasi borlar.
// rep — monthReport() natijasi. Faqat o'qish.
async function possibleLeft(db, assistantId, month, rep, { pastOnly = false, now = new Date() } = {}) {
    const R = require('../../../js/attendanceRules');
    const today = T.nowLocal(now).date, { from, to } = T.monthBounds(month);
    const left = new Map();
    if (!pastOnly && today <= to) {
        const p = await plan(db, { assistantIds: [assistantId], from: today < from ? from : today, to, now }).catch(() => ({ items: [] }));
        for (const i of p.items) if (i.kind === 'advice' && !i.past) left.set(i.studentId, (left.get(i.studentId) || 0) + 1);
    }
    const had = new Set(rep.students.filter(x => x.counted || x.noAnswer).map(x => x.studentId));
    const rows = (await db.query(`SELECT id, name, teacher_id, lesson_day_of_week, extra_data FROM students WHERE ($3 AND assistant_teacher_id=$1) OR id = ANY($2::text[])`,
        [assistantId, [...had], !pastOnly])).rows
        // Hozir faol yoki shu oyda hali tavsiyasi bor (masalan muzlatishdan oy ichida qaytadigan) o'quvchi ham "ko'pi bilan" hisobiga kiradi —
        // qaytgan kunidan keyingi tavsiyalar (plan faqat faol kunlarga tavsiya beradi).
        .filter(r => had.has(r.id) || (!pastOnly && (R.isActiveStudent(r) || left.has(r.id))));
    const byId = new Map(rep.students.map(x => [x.studentId, x]));
    // Oylik reja (maxraj) — AttendanceRules.assistMonthPlan: YordamchiBosh "mumkin bo'lgan aloqa" va Davomat "oy" ustuni bilan bir xil.
    const stRows = new Map();
    if (rows.length && (await db.query("SELECT to_regclass('public.school_student_status')::text AS t")).rows[0]?.t)
        for (const r of (await db.query('SELECT * FROM school_student_status WHERE student_id = ANY($1::text[]) AND cancelled_at IS NULL', [rows.map(r => r.id)])).rows) {
            if (!stRows.has(r.student_id)) stRows.set(r.student_id, []); stRows.get(r.student_id).push(r);
        }
    const students = rows.map(r => {
        const counted = byId.get(r.id)?.counted || 0, adviceLeft = left.get(r.id) || 0, cap = rep.cap || MONTH_CAP;
        const extra = typeof r.extra_data === 'object' && r.extra_data ? r.extra_data : (() => { try { return JSON.parse(r.extra_data || '{}'); } catch { return {}; } })();
        const plan = R.assistMonthPlan({ ...extra, id: r.id }, stRows.get(r.id) || [], month, T.adviceDays(r.lesson_day_of_week), cap);
        return { studentId: r.id, name: r.name, teacherId: r.teacher_id, counted, adviceLeft, plan, possible: R.assistPossible(counted, adviceLeft, cap) };
    });
    // Summa har o'quvchi bo'yicha round(oylik tarif × aloqa / 13) — maosh hisobi bilan bir xil yaxlitlash.
    return { students, possible: students.reduce((n, x) => n + x.possible, 0),
        possibleAmount: students.reduce((n, x) => n + contactAmount(rep.monthly || MONTHLY_DEFAULT, x.possible), 0) };
}

// Moliyaga murojaat (yordamchi, yopilgan oy bo'yicha): faqat o'z hisobi, yakuniy tasdiqdan oldin.
// Hisobni o'zgartirmaydi — admin ko'rib chiqadi va kerak bo'lsa "Aloqalar"da tuzatadi (adminCorrect).
const FIN_KINDS = { missing: 'Aloqa ro\'yxatda yo\'q', not_counted: 'Aloqa hisoblanmagan', wrong_sum: 'Summa noto\'g\'ri', other: 'Boshqa' };
async function financeRequest(db, me, body, now = new Date()) {
    const month = String(body.month || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw fail(400, 'Oyni tanlang');
    const { from, to } = T.monthBounds(month);
    const cur = T.nowLocal(now).date.slice(0, 7);
    if (month >= cur) throw fail(409, 'Murojaat faqat yopilgan oy bo\'yicha yuboriladi');
    if (month < T.addDays(cur + '-01', -62).slice(0, 7)) throw fail(409, 'Bu oy uchun murojaat muddati o\'tgan');
    const st = await monthState(db, month);
    if (st?.final_at) throw fail(409, 'Oy yakuniy tasdiqlangan — murojaat qabul qilinmaydi');
    const kind = FIN_KINDS[body.kind] ? body.kind : 'other';
    const reason = String(body.reason || '').trim();
    if (reason.length < 5) throw fail(400, 'Nima noto\'g\'ri ekanini yozing');
    // Faqat o'z yordamchi hisobi: shu oyda aloqasi bo'lgan yoki hozir yordamchi bo'lgan xodim.
    const mine = (await db.query(`SELECT 1 FROM school_assist_contacts WHERE assistant_id=$1 AND day BETWEEN $2 AND $3
        UNION ALL SELECT 1 FROM students WHERE assistant_teacher_id=$1 LIMIT 1`, [me.id, from, to])).rows.length;
    if (!mine) throw fail(403, 'Bu oy bo\'yicha sizda yordamchi hisobi yo\'q');
    const p = { month, kind, proof: String(body.proof || '').trim().slice(0, 300) };
    if (body.studentId) {
        const sid = String(body.studentId);
        const row = (await db.query('SELECT id, name, assistant_teacher_id FROM students WHERE id=$1', [sid])).rows[0];
        const had = row && (row.assistant_teacher_id === me.id
            || (await db.query('SELECT 1 FROM school_assist_contacts WHERE student_id=$1 AND assistant_id=$2 AND day BETWEEN $3 AND $4 LIMIT 1', [sid, me.id, from, to])).rows.length);
        if (!had) throw fail(403, 'Bu o\'quvchi bo\'yicha sizning hisobingiz yo\'q');
        p.studentId = row.id; p.studentName = row.name;
    }
    if (body.day) {
        const day = T.assertDate(String(body.day));
        if (day.slice(0, 7) !== month) throw fail(400, 'Kun shu oy ichida bo\'lsin');
        p.day = day;
    }
    return { payload: p, reason: reason.slice(0, 500) };
}

// Oy ichidagi o'zgarishlar (o'quvchi tarixi): muzlatish, qaytish, chiqib ketish, asosiy ustoz almashishi. Faqat o'qish.
async function monthChanges(db, assistantId, month) {
    const { from, to } = T.monthBounds(month);
    const studs = (await db.query('SELECT id, name, teacher_id FROM students WHERE assistant_teacher_id=$1', [assistantId])).rows;
    if (!studs.length) return { month, changes: [] };
    const ids = studs.map(s => s.id), by = new Map(studs.map(s => [s.id, s]));
    const [statuses, hist] = await Promise.all([
        db.query('SELECT * FROM school_student_status WHERE cancelled_at IS NULL AND student_id = ANY($1::text[]) ORDER BY from_date', [ids]),
        db.query('SELECT * FROM school_teacher_history WHERE student_id = ANY($1::text[]) ORDER BY from_date', [ids])
    ]);
    const names = new Map((await db.query('SELECT id, name FROM hr_employees')).rows.map(r => [r.id, r.name]));
    const out = [];
    for (const r of statuses.rows) {
        const f = S.dateStr(r.from_date), t = r.to_date ? S.dateStr(r.to_date) : null, s = by.get(r.student_id);
        if (r.status === 'frozen' && f <= to && (!t || t >= from)) out.push({ kind: 'frozen', studentId: s.id, name: s.name, from: f, to: t, reason: r.reason || '' });
        else if (r.status === 'left' && f >= from && f <= to) out.push({ kind: 'left', studentId: s.id, name: s.name, from: f, reason: r.reason || '' });
        else if (r.status === 'restored' && f >= from && f <= to) out.push({ kind: 'restored', studentId: s.id, name: s.name, from: f });
    }
    const hs = new Map(); for (const h of hist.rows) { if (!hs.has(h.student_id)) hs.set(h.student_id, []); hs.get(h.student_id).push(h); }
    for (const [sid, rows] of hs) rows.forEach((h, i) => {
        const f = S.dateStr(h.from_date);
        if (i > 0 && f >= from && f <= to && h.teacher_id !== rows[i - 1].teacher_id) out.push({ kind: 'teacher', studentId: sid, name: by.get(sid).name, from: f,
            teacherId: h.teacher_id, teacherName: names.get(h.teacher_id) || '', prevTeacherName: names.get(rows[i - 1].teacher_id) || '' });
    });
    out.sort((a, b) => a.from.localeCompare(b.from));
    return { month, changes: out };
}

module.exports = { contactRate, monthlyRate, contactAmount, studentStarts, studentStartOf, monthRoster, CONTACTS_FROM, LEGACY_MONTHLY, MONTHLY_DEFAULT, possibleLeft, financeRequest, monthChanges, FIN_KINDS, plan, RATE, MONTH_CAP, MIN_MINUTES, CHANNELS, countMonth, mark, removeOwnToday, adminCorrect, monthReport, advanceMonth, isLocked, adviceFor };
