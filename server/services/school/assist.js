'use strict';
// Yordamchi ustoz aloqalari (assist contacts) va oylik hisob.
// Qoidalar (Abdulloh, 27–28-okt):
//  • aloqa kamida 5 daqiqa; yozishma (Telegram matn) haftasiga 1 tagacha hisoblanadi;
//  • "javob bermadi" yoziladi, lekin hisoblanmaydi;
//  • bir o'quvchi bilan bir kunda bittasi hisoblanadi;
//  • har o'quvchi bilan oyiga 13 tagacha, har biri 3 846 so'm (50 000 / 13);
//  • muzlagan kunlarda aloqa belgilanmaydi, chegara va narx o'zgarmaydi;
//  • oy o'rtasida chiqib ketgan o'quvchining o'qigan davridagi aloqalari ham hisoblanadi;
//  • aloqa faqat shu kuni belgilanadi — keyin admin tuzatadi (sabab bilan);
//  • oy 1-sanada 00:00 da qulflanadi → dastlabki tasdiq → e'tiroz 4-sanagacha → to'lov 5-sana.
const { randomUUID } = require('node:crypto');
const T = require('./time');
const S = require('./schedule');
const { fail } = T;

const RATE = 3846;
const MONTH_CAP = 13;
const MIN_MINUTES = 5;
const CHANNELS = { phone: 'Telefon', zoom: 'Zoom', meet: 'Google Meet', tg_video: 'Telegram video', tg_group: 'Telegram guruh videodars', tg_text: 'Telegram yozishma' };

// Sof hisob: bir yordamchining oy aloqalari → har o'quvchi bo'yicha hisoblangan soni.
function countMonth(contacts) {
    const byStudent = new Map();
    const rows = [...contacts].filter(c => !c.removed_at)
        .sort((a, b) => String(S.dateStr(a.day)).localeCompare(String(S.dateStr(b.day))) || String(a.created_at).localeCompare(String(b.created_at)));
    for (const c of rows) {
        const sid = c.student_id;
        if (!byStudent.has(sid)) byStudent.set(sid, { studentId: sid, counted: 0, noAnswer: 0, overCap: 0, short: 0, sameDay: 0, extraText: 0, days: new Set(), textWeeks: new Set(), items: [] });
        const s = byStudent.get(sid);
        const day = S.dateStr(c.day);
        let status = 'counted';
        if (c.outcome === 'no_answer') status = 'no_answer';
        else if (c.channel !== 'tg_text' && Number(c.minutes) < MIN_MINUTES) status = 'short';
        else if (s.days.has(day)) status = 'same_day';
        else if (c.channel === 'tg_text' && s.textWeeks.has(T.weekStart(day))) status = 'extra_text';
        else if (s.counted >= MONTH_CAP) status = 'over_cap';
        if (status === 'counted') { s.counted++; s.days.add(day); if (c.channel === 'tg_text') s.textWeeks.add(T.weekStart(day)); }
        else if (status === 'no_answer') s.noAnswer++;
        else if (status === 'over_cap') s.overCap++;
        else if (status === 'short') s.short++;
        else if (status === 'same_day') s.sameDay++;
        else s.extraText++;
        s.items.push({ id: c.id, day, at: c.at_min ?? null, channel: c.channel, minutes: c.minutes, outcome: c.outcome, status, note: c.note || '', corrected: !!c.correction_reason });
    }
    const students = [...byStudent.values()].map(({ days, textWeeks, ...rest }) => ({ ...rest, amount: rest.counted * RATE }));
    const counted = students.reduce((n, s) => n + s.counted, 0);
    return { students, counted, amount: counted * RATE, noAnswer: students.reduce((n, s) => n + s.noAnswer, 0),
        overCap: students.reduce((n, s) => n + s.overCap, 0) };
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

async function monthReport(db, assistantId, month) {
    const { from, to } = T.monthBounds(month);
    const contacts = (await db.query('SELECT * FROM school_assist_contacts WHERE assistant_id=$1 AND day BETWEEN $2 AND $3', [assistantId, from, to])).rows;
    const r = countMonth(contacts);
    const corrections = contacts.filter(c => c.correction_reason && !c.removed_at).length;
    return { month, assistantId, rate: RATE, cap: MONTH_CAP, ...r, corrections, state: await monthState(db, month) };
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
    const students = stRows.rows.map(S.studentRow).filter(s => !s.legacyInactive && s.assistantId && (!subject || (s.subject || 'english') === subject));
    const ids = assistantIds ? assistantIds.map(String) : [...new Set(students.map(s => s.assistantId))];
    const byId = new Map(students.map(s => [s.id, s]));
    const statusBy = new Map();
    for (const r of statuses.rows) { if (!statusBy.has(r.student_id)) statusBy.set(r.student_id, []); statusBy.get(r.student_id).push(r); }
    // Hisob holati (hisoblandi / javob bermadi / ...) oy bo'yicha — countMonth bilan bir xil qoida.
    const mFrom = T.monthBounds(from.slice(0, 7)).from, mTo = T.monthBounds(to.slice(0, 7)).to;
    const contacts = ids.length ? (await db.query(`SELECT * FROM school_assist_contacts WHERE assistant_id = ANY($1::text[]) AND day BETWEEN $2 AND $3 AND removed_at IS NULL`,
        [ids, mFrom, mTo])).rows.map(c => ({ ...c, day: S.dateStr(c.day) })) : [];
    const statusOf = new Map();
    for (const aid of ids) for (const m of new Set(contacts.map(c => c.day.slice(0, 7)))) {
        const r = countMonth(contacts.filter(c => c.assistant_id === aid && c.day.slice(0, 7) === m));
        for (const st of r.students) for (const it of st.items) statusOf.set(it.id, it.status);
    }
    const items = [];
    const done = new Set();
    for (const c of contacts.filter(c => c.day >= from && c.day <= to)) {
        const s = byId.get(c.student_id);
        if (!s && subject) continue;
        const at = c.at_min != null ? Number(c.at_min) : (T.toMin(s?.time) ?? 9 * 60);
        done.add(`${c.student_id}|${c.day}`);
        items.push({ kind: 'contact', id: c.id, assistantId: c.assistant_id, studentId: c.student_id, studentName: s?.name || '', date: c.day, start: at,
            end: at + Math.max(10, Number(c.minutes) || 0), channel: c.channel, minutes: Number(c.minutes) || 0, outcome: c.outcome, status: statusOf.get(c.id) || 'counted' });
    }
    const today = T.nowLocal(now).date;
    for (const d of T.dateRange(from, to, 62)) {
        const wd = T.weekday(d);
        for (const s of students) {
            if (s.day == null || !T.adviceDays(s.day).includes(wd) || done.has(`${s.id}|${d}`)) continue;
            if (s.startDate && d < String(s.startDate).slice(0, 10)) continue;
            const srows = statusBy.get(s.id) || [];
            if ((!srows.length && s.legacyFrozen) || S.statusOn(srows, d) !== 'active') continue;
            const start = T.toMin(s.time); if (start == null) continue;
            items.push({ kind: 'advice', assistantId: s.assistantId, studentId: s.id, studentName: s.name, date: d, start, end: start + 15, past: d < today });
        }
    }
    items.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
    return { from, to, assistantIds: ids, items };
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

module.exports = { financeRequest, monthChanges, FIN_KINDS, plan, RATE, MONTH_CAP, MIN_MINUTES, CHANNELS, countMonth, mark, removeOwnToday, adminCorrect, monthReport, advanceMonth, isLocked, adviceFor };
