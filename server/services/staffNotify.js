'use strict';
// Xodim bildirishnomalari: serverda MAVJUD voqealardan har xodimga o'z ro'yxati yig'iladi
// (alohida "xabar" jadvali yo'q — davomat, sinov, qoplash, so'rov, aloqa, yo'riqnoma va maoshdan
// hisoblanadi). Saqlanadigani faqat: kim nimani o'qigani (staff_notify_reads, read_before) va
// sozlamalar (qaysi turlar yoqilgan — staff_notify_prefs). Har xodim faqat o'zinikini ko'radi.
// Telegram/push yuborilmaydi — "tg" tanlovi saqlanadi, bot ulanganda ishlatiladi.
const T = require('./school/time');
const S = require('./school/schedule');
const A = require('./school/assist');
const workflow = require('../../js/trialWorkflow');
const ST = require('./staffSettings');

// Katalog: kind → guruhlar → turlar. live=true — panelga hozir serverdan chiqadi; false — sozlama saqlanadi,
// manba hali ulanmagan ("tez orada"). locked — o'chirib bo'lmaydi. d = [telegram, brauzer] standart.
const CATALOG = {
    teacher: [
        ['Dars', [
            ['lesson_soon', 'Darsdan 15 daqiqa oldin', 'bugungi dars boshlanishidan oldin', [1, 1], true],
            ['attendance_unmarked', 'Davomat belgilanmay qolsa', 'dars tugagach 30 daqiqada', [1, 1], true],
            ['makeup_decision', 'Qoplash darsi tasdiqlandi / rad etildi', 'admin qarori', [1, 1], true]]],
        ['Sinov darsi', [
            ['trial_confirm', 'Sinov band qilindi — tasdiqlash kerak', 'darhol', [1, 1], true],
            ['trial_result', 'Sinov natijasi yozilmagan', 'dars tugagach', [1, 0], true]]],
        ['O\'quvchilar', [
            ['assistant_missed_week', 'Yordamchi bu hafta bog\'lanmadi', 'o\'z o\'quvchingiz · Juma 18:00 da', [1, 0], true],
            ['student_inactive', 'O\'quvchi 3 kundan beri ilovada faol emas', 'kuniga bir marta, 09:00 da', [0, 0], false]]],
        ['Boshqa', [
            ['request_decision', 'Vaqt so\'roviga javob', 'admin ochdi / yopdi', [1, 1], true],
            ['guide_new', 'Yangi yo\'riqnoma', '', [0, 1], true],
            ['salary_ready', 'Oylik maosh hisoblandi', 'oy oxirida', [1, 0], true]]]
    ],
    assistant: [
        ['Aloqa', [
            ['assist_advice', 'Tavsiya vaqtidan 15 daqiqa oldin', 'bugungi tavsiya', [1, 1], true],
            ['assist_unmarked_day', 'Kun oxirida belgilanmagan aloqa', '20:00 da · shu kuni belgilanmasa hisoblanmaydi', [1, 1], true],
            ['assist_no_answer', 'Javob bermagan o\'quvchi', 'ertasi kuni qayta urinish eslatmasi', [1, 0], true],
            ['assist_week_low', 'Haftada 3 tadan kam', 'Juma 18:00 da · kimlar qolgani bilan', [1, 0], true]]],
        ['O\'quvchilar', [
            ['student_absent', 'Asosiy darsga kelmadi', 'o\'quvchingiz · dars tugagach', [1, 0], true],
            ['assist_near_cap', 'Limitga yaqin · 12/13', 'oyda 13 tadan ortig\'i hisoblanmaydi', [1, 0], true],
            ['student_assigned', 'Yangi o\'quvchi biriktirildi', 'admin biriktirganda', [1, 1], false]]],
        ['Boshqa', [
            ['assist_corrected', 'Admin aloqani tuzatdi', 'sabab bilan', [1, 1], true],
            ['guide_new', 'Yangi yo\'riqnoma', '', [0, 1], true],
            ['salary_ready', 'Oylik maosh hisoblandi', 'oy oxirida', [1, 0], true]]]
    ],
    sales: [
        ['Sinov darslari', [
            ['hold_expiring', 'Ushlab turish tugashiga 2 daqiqa', '10 daqiqalik band', [1, 1], true, true],
            ['trial_teacher_decision', 'Ustoz sinovni tasdiqladi / rad etdi', 'darhol', [1, 1], true],
            ['trial_result_written', 'Sinov natijasi yozildi', 'ustoz yozganda', [1, 1], true]]],
        ['Mening so\'rovlarim', [
            ['edit_decision', 'Tahrir tasdiqlandi / rad etildi / qaytarildi', 'admin yoki ROP · sabab bilan', [1, 1], true]]],
        ['O\'quvchilarim', [
            ['group_link_missing', 'Telegram guruh havolasi kiritilmagan', 'konvertatsiyadan 24 soat o\'tsa', [1, 1], false],
            ['student_followup', 'Qaytish oldidan eslatma · qayta jalb qo\'ng\'irog\'i', 'belgilangan kuni · "Faol emas" o\'quvchilar', [1, 1], true],
            ['student_status', 'O\'quvchim muzlatildi / to\'xtatildi / ustozi almashdi', 'admin yoki ROP qilganda', [1, 1], false],
            ['payment_due', 'To\'lov muddati yaqin / o\'tdi', '3 kun oldin va o\'tgan kuni', [1, 1], false],
            ['daily_plan', 'Kunlik reja', '20:00 da', [1, 0], false],
            ['guide_new', 'Yangi yo\'riqnoma', '', [0, 1], true]]]
    ],
    rop: [
        ['Tasdiqlash kerak', [
            ['edit_request', 'Sotuv menejeri tahriri — tarif yoki ustoz', 'kutilayotgan so\'rovlar', [1, 1], true],
            ['payment_edit', 'To\'lov tahriri 24 soatdan keyin', 'admin ham ko\'radi · kim birinchi', [1, 1], true]]],
        ['Sinov va lidlar', [
            ['trial_unassigned', 'Sinovga ustoz topilmadi', 'darhol', [1, 1], true],
            ['trial_outcome', 'Sinov natijasi: o\'tkazildi / kelmadi', 'jamoa bo\'yicha', [0, 1], false],
            ['hold_expired', 'Ushlab turish tugadi, band qilinmadi', '10 daqiqadan keyin', [1, 0], false]]],
        ['Jamoa', [
            ['daily_plan', 'Kunlik reja natijasi', '20:00 da · har menejer bo\'yicha', [1, 0], false],
            ['group_link_missing', 'Telegram guruh havolasi kiritilmagan', 'menejer nomi bilan', [1, 1], false],
            ['student_status', 'O\'quvchi muzlatildi / to\'xtatildi', 'jamoa o\'quvchilari', [0, 1], false],
            ['guide_new', 'Yangi yo\'riqnoma', '', [0, 1], true]]]
    ],
    admin: [
        ['Tasdiqlash kerak', [
            ['edit_request', 'Sotuv menejeri tahriri — tarif yoki ustoz', 'kutilayotgan so\'rovlar', [1, 1], true],
            ['payment_edit', 'To\'lov tahriri 24 soatdan keyin', 'sabab bilan · ROP ham ko\'radi', [1, 1], true],
            ['makeup_review', 'Qoplash darsi tekshiruvda', 'ustoz belgilaganda', [1, 1], true],
            ['assist_late', 'Aloqani tuzatish so\'rovi', 'yordamchi ustozdan', [1, 1], true]]],
        ['Jadval va o\'quvchilar', [
            ['trial_unassigned', 'Sinovga ustoz topilmadi', 'darhol · "Ustoz biriktirilmagan"', [1, 1], true],
            ['freeze_ending', 'Muzlatish tugaydi — o\'quvchi qaytadi', '1 kun oldin', [1, 1], true],
            ['attendance_unmarked_all', 'Davomat belgilanmagan darslar', 'har kuni 21:00 da · ro\'yxat bilan', [1, 0], false],
            ['group_link_missing', 'Telegram guruh havolasi yo\'q', 'konvertatsiyadan 24 soat o\'tsa', [1, 0], false]]],
        ['Moliya', [
            ['month_close', 'Oy yopildi — yakunni tasdiqlash kerak', '1–5-sana · yordamchi aloqalari', [1, 1], true],
            ['payment_overdue', 'To\'lov muddati o\'tdi', 'kuniga bir marta · qarzdorlar soni', [1, 0], false]]]
    ],
    other: [['Boshqa', [['guide_new', 'Yangi yo\'riqnoma', '', [0, 1], true]]]]
};
function catalogFor(me) {
    const kinds = me.kind === 'teacher' && me.assistantDuty ? ['teacher', 'assistant'] : [me.kind in CATALOG ? me.kind : 'other'];
    const seen = new Set(), groups = [];
    for (const [n, k] of kinds.entries()) for (const [title, items] of CATALOG[k]) {
        const list = items.filter(i => !seen.has(i[0])).map(([key, label, sub, d, live, locked]) => { seen.add(key); return { key, label, sub, tg: !!d[0], web: !!d[1], live: !!live, locked: !!locked }; });
        if (!list.length) continue;
        // Asosiy ustozning yordamchi vazifasi: guruhlar "Yordamchi · ..." bo'lib, "Boshqa" bittaga qo'shiladi.
        const same = groups.find(g => g.title === title);
        if (n > 0 && same && title === 'Boshqa') same.items.push(...list);
        else groups.push({ title: n > 0 ? `Yordamchi ustozlik · ${title.toLowerCase()}` : title, items: list });
    }
    return groups;
}
function effectivePrefs(groups, saved = {}) {
    const out = {};
    for (const g of groups) for (const i of g.items) {
        const s = saved[i.key] || {};
        out[i.key] = { tg: i.locked ? true : typeof s.tg === 'boolean' ? s.tg : i.tg, web: i.locked ? true : typeof s.web === 'boolean' ? s.web : i.web };
    }
    return out;
}
const QUIET_DEFAULT = { from: '22:00', to: '08:00' };

async function loadPrefs(db, userId) {
    return (await db.query('SELECT prefs, read_before FROM staff_notify_prefs WHERE user_id=$1', [userId])).rows[0] || { prefs: {}, read_before: null };
}
async function getPrefs(db, actor) {
    const me = await ST.identify(db, actor);
    const groups = catalogFor(me), row = await loadPrefs(db, me.user.id);
    const saved = row.prefs || {};
    const tg = (await db.query('SELECT telegram FROM staff_profile_extra WHERE user_id=$1', [me.user.id])).rows[0]?.telegram || '';
    return { kind: me.kind, groups, prefs: effectivePrefs(groups, saved.types || {}), quiet: saved.quiet || QUIET_DEFAULT,
        channels: { telegram: { username: tg, connected: false, note: 'Telegram orqali yuborish hali ulanmagan — tanlovingiz saqlanadi' }, browser: { connected: true } } };
}
async function savePrefs(db, actor, body = {}) {
    const me = await ST.identify(db, actor);
    const groups = catalogFor(me), keys = new Set(groups.flatMap(g => g.items.map(i => i.key)));
    const row = await loadPrefs(db, me.user.id), saved = row.prefs || {};
    let types = { ...(saved.types || {}) };
    if (body.reset) types = {};
    for (const [k, v] of Object.entries(body.types || {})) {
        if (!keys.has(k) || !v || typeof v !== 'object') continue;
        types[k] = { ...(types[k] || {}), ...(typeof v.tg === 'boolean' ? { tg: v.tg } : {}), ...(typeof v.web === 'boolean' ? { web: v.web } : {}) };
    }
    let quiet = saved.quiet || QUIET_DEFAULT;
    if (body.quiet) {
        const f = String(body.quiet.from || ''), t = String(body.quiet.to || '');
        if (T.toMin(f) == null || T.toMin(t) == null) throw ST.fail(400, 'Tinch soatlar vaqti noto\'g\'ri');
        quiet = { from: f, to: t, off: body.quiet.off === true };
    }
    await db.query(`INSERT INTO staff_notify_prefs (user_id, prefs) VALUES ($1,$2)
        ON CONFLICT (user_id) DO UPDATE SET prefs=EXCLUDED.prefs, updated_at=NOW()`, [me.user.id, JSON.stringify({ types, quiet })]);
    return getPrefs(db, actor);
}

// ── Voqealar ──────────────────────────────────────────────────────────────────
const dm = d => { const [, m, day] = String(d).split('-'); return `${Number(day)}-${['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'][Number(m) - 1]}`; };
const first = n => String(n || '').trim().split(/\s+/)[0] || '';
const atLocal = (date, min) => new Date(Date.parse(`${date}T00:00:00Z`) + (min - T.TZ_OFFSET_MIN) * 60000).toISOString();
const iso = v => (v instanceof Date ? v : new Date(v)).toISOString();
const parseExtra = raw => { if (!raw) return {}; if (typeof raw === 'object') return raw; try { return JSON.parse(raw); } catch { return {}; } };

async function teacherEvents(db, me, now, ev) {
    const tid = me.emp.id, { date: today, min: nowMin } = T.nowLocal(now);
    const from = T.addDays(today, -6) < `${today.slice(0, 7)}-01` ? `${today.slice(0, 7)}-01` : T.addDays(today, -6);
    // Bugungi va o'tgan 6 kun darslari: belgilanmagan davomat, darsdan 15 daqiqa oldin.
    const ctx = await S.loadContext(db, { teacherIds: [tid], from, to: today, now });
    const views = T.dateRange(from, today, 31).map(d => S.dayView(ctx, tid, d));
    await S.annotateViews(db, views, { from, to: today });
    const abs = new Set((await db.query('SELECT student_id, day FROM school_absences WHERE teacher_id=$1 AND day BETWEEN $2 AND $3 AND absent',
        [tid, from, today])).rows.map(r => `${r.student_id}|${S.dateStr(r.day)}`));
    for (const v of views) for (const i of v.items) {
        if (i.kind !== 'lesson' || !i.studentId || i.bookingId) continue;
        const ended = v.date < today || i.end + 30 <= nowMin;
        if (ended && i.att == null && !abs.has(`${i.studentId}|${v.date}`)) {
            ev.push({ id: `att:${i.studentId}:${v.date}`, type: 'attendance_unmarked', cat: 'davomat', tone: 'bad', title: `${first(i.studentName)} · ${T.fromMin(i.start)} darsi belgilanmagan`,
                sub: `${dm(v.date)} · belgilanmasa maoshga o'tmaydi`, at: atLocal(v.date, i.end + 30), go: { tab: 'teachers-section' } });
        }
        if (v.date === today && i.start - 15 <= nowMin && nowMin < i.start) {
            ev.push({ id: `soon:${i.studentId}:${v.date}:${i.start}`, type: 'lesson_soon', cat: 'davomat', tone: 'info', title: `${first(i.studentName)} · ${T.fromMin(i.start)} darsi`,
                sub: `${i.start - nowMin} daqiqadan keyin boshlanadi`, at: atLocal(v.date, i.start - 15), go: { tab: 'timetable' } });
        }
    }
    // Sinovlar (lid "Sinov darsida", trialRequest shu ustozga).
    const leads = (await db.query(`SELECT id, name, extra_data FROM leads WHERE status='sinov-darsida' AND deleted_at IS NULL
        AND extra_data->'trialRequest'->>'teacherId' = $1`, [tid])).rows;
    for (const r of leads) {
        const lead = { ...parseExtra(r.extra_data), id: r.id, name: r.name };
        const t = workflow.request(lead); if (!t) continue;
        const ms = Date.parse(t.scheduledAt); const local = Number.isFinite(ms) ? T.nowLocal(new Date(ms)) : null;
        const passed = Number.isFinite(ms) && ms <= now.getTime();
        if (t.state === 'pending' && !passed) ev.push({ id: `trial:${r.id}:${t.id}:confirm`, type: 'trial_confirm', cat: 'sinov', tone: 'warn', title: `Sinov band qilindi — tasdiqlang`,
            sub: `${first(r.name)}${local ? ` · ${dm(local.date)} ${T.fromMin(local.min)}` : ''}`, at: iso(t.requestedAt || t.createdAt || now), go: { tab: 'trial-lessons' } });
        if ((t.state === 'pending' && passed) || (t.state === 'accepted' && Number.isFinite(ms) && ms + 30 * 60000 <= now.getTime()))
            ev.push({ id: `trial:${r.id}:${t.id}:result`, type: 'trial_result', cat: 'sinov', tone: 'info', title: `${first(r.name)} sinovi natijasi kutilmoqda`,
                sub: local ? `${dm(local.date)} ${T.fromMin(local.min)} · natijani yozing` : 'natijani yozing', at: iso(ms + 30 * 60000), go: { tab: 'trial-lessons' } });
    }
    const since = new Date(now.getTime() - 14 * 86400000);
    const mk = (await db.query(`SELECT m.*, s.name FROM school_makeups m LEFT JOIN students s ON s.id=m.student_id
        WHERE m.teacher_id=$1 AND m.status IN ('approved','rejected') AND m.decided_at > $2`, [tid, since])).rows;
    for (const m of mk) ev.push({ id: `makeup:${m.id}:${m.status}`, type: 'makeup_decision', cat: 'davomat', tone: m.status === 'approved' ? 'ok' : 'bad',
        title: `Qoplash darsi ${m.status === 'approved' ? 'tasdiqlandi' : 'rad etildi'}`,
        sub: `${first(m.name)} · ${dm(S.dateStr(m.missed_date))} o'rniga${m.held_date ? ' ' + dm(S.dateStr(m.held_date)) : ''}${m.decision_note ? ' · ' + m.decision_note : ''}`, at: iso(m.decided_at), go: { tab: 'timetable' } });
    // Yordamchi bu hafta bog'lanmadi (o'z o'quvchilari, Juma 18:00 dan).
    const wd = T.weekday(today);
    if ((wd === 5 && nowMin >= 18 * 60) || wd > 5) {
        const ws = T.weekStart(today);
        const rows = (await db.query(`SELECT s.id, s.name, s.extra_data FROM students s WHERE s.teacher_id=$1 AND COALESCE(s.assistant_teacher_id,'') <> ''
            AND NOT EXISTS (SELECT 1 FROM school_assist_contacts c WHERE c.student_id=s.id AND c.day BETWEEN $2 AND $3 AND c.removed_at IS NULL AND c.outcome='contacted')`,
            [tid, ws, T.addDays(ws, 6)])).rows.filter(r => parseExtra(r.extra_data).status !== 'inactive');
        if (rows.length) ev.push({ id: `assistweek:${ws}:${rows.length}`, type: 'assistant_missed_week', cat: 'davomat', tone: 'warn', title: `Yordamchi bu hafta ${rows.length} o'quvchi bilan bog'lanmadi`,
            sub: rows.slice(0, 4).map(r => first(r.name)).join(', ') + (rows.length > 4 ? ` va yana ${rows.length - 4}` : ''), at: atLocal(T.addDays(ws, 4), 18 * 60) });
    }
}

async function assistantEvents(db, me, now, ev) {
    const aid = me.emp.id, { date: today, min: nowMin } = T.nowLocal(now), month = today.slice(0, 7);
    const plan = await A.plan(db, { assistantIds: [aid], from: today, to: today, now });
    const advice = plan.items.filter(i => i.kind === 'advice');
    for (const i of advice) if (i.start - 15 <= nowMin)
        ev.push({ id: `advice:${i.studentId}:${today}`, type: 'assist_advice', cat: 'aloqa', tone: 'info', title: `Aloqa tavsiyasi · ${T.fromMin(i.start)}`,
            sub: `${first(i.studentName)} bilan bog'laning`, at: atLocal(today, Math.max(0, i.start - 15)), go: { tab: 'school-contacts' } });
    if (nowMin >= 20 * 60 && advice.length)
        ev.push({ id: `assistday:${today}`, type: 'assist_unmarked_day', cat: 'aloqa', tone: 'bad', title: `Bugun ${advice.length} ta aloqa belgilanmagan`,
            sub: `${advice.slice(0, 4).map(i => first(i.studentName)).join(', ')} · shu kuni belgilanmasa hisoblanmaydi`, at: atLocal(today, 20 * 60), go: { tab: 'school-contacts' } });
    const yday = T.addDays(today, -1);
    const na = (await db.query(`SELECT c.student_id, s.name FROM school_assist_contacts c JOIN students s ON s.id=c.student_id
        WHERE c.assistant_id=$1 AND c.day=$2 AND c.outcome='no_answer' AND c.removed_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM school_assist_contacts x WHERE x.assistant_id=$1 AND x.student_id=c.student_id AND x.day BETWEEN $2 AND $3 AND x.outcome='contacted' AND x.removed_at IS NULL)`,
        [aid, yday, today])).rows;
    for (const r of na) ev.push({ id: `noanswer:${r.student_id}:${yday}`, type: 'assist_no_answer', cat: 'aloqa', tone: 'warn', title: 'Qayta urinish kerak',
        sub: `${first(r.name)} · kecha javob bermadi`, at: atLocal(today, 9 * 60), go: { tab: 'school-contacts' } });
    const wd = T.weekday(today);
    if ((wd === 5 && nowMin >= 18 * 60) || wd > 5) {
        const ws = T.weekStart(today);
        const c = (await db.query(`SELECT * FROM school_assist_contacts WHERE assistant_id=$1 AND day BETWEEN $2 AND $3`, [aid, `${month}-01`, today])).rows;
        const counted = new Map();
        for (const s of A.countMonth(c).students) counted.set(s.studentId, s.items.filter(x => x.status === 'counted' && x.day >= ws).length);
        const mine = (await db.query('SELECT id, name, extra_data FROM students WHERE assistant_teacher_id=$1', [aid])).rows.filter(r => parseExtra(r.extra_data).status !== 'inactive');
        const low = mine.filter(s => (counted.get(s.id) || 0) < 3);
        if (low.length) ev.push({ id: `weeklow:${ws}:${low.length}`, type: 'assist_week_low', cat: 'aloqa', tone: 'warn', title: `Bu hafta ${low.length} o'quvchida 3 tadan kam aloqa`,
            sub: low.slice(0, 5).map(s => `${first(s.name)} ${counted.get(s.id) || 0}/3`).join(', '), at: atLocal(T.addDays(ws, 4), 18 * 60), go: { tab: 'school-contacts' } });
    }
    const abs = (await db.query(`SELECT a.student_id, a.day, s.name FROM school_absences a JOIN students s ON s.id=a.student_id
        WHERE s.assistant_teacher_id=$1 AND a.absent AND a.day BETWEEN $2 AND $3`, [aid, yday, today])).rows;
    for (const r of abs) ev.push({ id: `absent:${r.student_id}:${S.dateStr(r.day)}`, type: 'student_absent', cat: 'aloqa', tone: 'bad',
        title: `${first(r.name)} asosiy darsga kelmadi`, sub: `${dm(S.dateStr(r.day))} · bog'lanib sababini bilib qo'ying`, at: atLocal(S.dateStr(r.day), 21 * 60) });
    const rep = await A.monthReport(db, aid, month);
    const near = rep.students.filter(s => s.counted >= rep.cap - 1);
    if (near.length) {
        const names = new Map((await db.query('SELECT id, name FROM students WHERE id = ANY($1::text[])', [near.map(s => s.studentId)])).rows.map(r => [r.id, r.name]));
        for (const s of near) ev.push({ id: `cap:${s.studentId}:${month}:${Math.min(s.counted, rep.cap)}`, type: 'assist_near_cap', cat: 'aloqa', tone: 'warn',
            title: `${first(names.get(s.studentId))} · ${Math.min(s.counted, rep.cap)}/${rep.cap} aloqa`, sub: s.counted >= rep.cap ? 'oylik limit to\'ldi — keyingisi hisoblanmaydi' : `${rep.cap}-chi oxirgisi, undan keyingisi hisoblanmaydi`,
            at: iso(now.getTime() - (now.getTime() % 86400000)) });
    }
    const corr = (await db.query(`SELECT c.*, s.name FROM school_assist_contacts c LEFT JOIN students s ON s.id=c.student_id
        WHERE c.assistant_id=$1 AND c.correction_reason <> '' AND COALESCE(c.removed_at, c.created_at) > $2`, [aid, new Date(now.getTime() - 7 * 86400000)])).rows;
    for (const c of corr) ev.push({ id: `corr:${c.id}:${c.removed_at ? 'rm' : 'add'}`, type: 'assist_corrected', cat: 'sorov', tone: c.removed_at ? 'bad' : 'ok',
        title: `Admin aloqani ${c.removed_at ? 'olib tashladi' : 'qo\'shdi'}`, sub: `${first(c.name)} · ${dm(S.dateStr(c.day))} · ${c.correction_reason}`, at: iso(c.removed_at || c.created_at) });
}

async function teacherCommon(db, me, now, ev) {
    const since = new Date(now.getTime() - 14 * 86400000);
    const rq = (await db.query(`SELECT * FROM school_requests WHERE (teacher_id=$1 OR requester_id=$2) AND status IN ('approved','rejected') AND decided_at > $3`,
        [me.emp.id, me.user.id, since])).rows;
    for (const r of rq) {
        const p = r.payload || {}, ok = r.status === 'approved';
        const what = r.type === 'assist_late' ? 'Kechikib belgilash' : r.type === 'student' ? 'O\'quvchi bo\'yicha so\'rovingiz' : 'So\'rovingiz';
        ev.push({ id: `req:${r.id}:${r.status}`, type: 'request_decision', cat: 'sorov', tone: ok ? 'ok' : 'bad', title: `${what} ${ok ? 'tasdiqlandi' : 'rad etildi'}`,
            sub: [p.date ? dm(String(p.date).slice(0, 10)) : '', p.from && p.to ? `${p.from}–${p.to}` : '', r.reason, r.decided_by_name, r.decision_note].filter(Boolean).join(' · '), at: iso(r.decided_at) });
    }
    const sal = (await db.query(`SELECT id, period_start, amount, status, created_at, paid_at FROM salary_transactions WHERE employee_id=$1 AND (created_at > $2 OR paid_at > $2)`,
        [me.emp.id, new Date(now.getTime() - 20 * 86400000)])).rows;
    const MON = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    for (const s of sal) {
        const m = MON[Number(S.dateStr(s.period_start).slice(5, 7)) - 1];
        ev.push({ id: `sal:${s.id}:${s.status}`, type: 'salary_ready', cat: 'maosh', tone: s.status === 'paid' ? 'ok' : 'info',
            title: s.status === 'paid' ? `${m} maoshi berildi` : `${m} maoshi hisoblandi`, sub: `${Number(s.amount).toLocaleString('ru-RU').replace(/ /g, ' ')} so'm`, at: iso(s.paid_at || s.created_at),
            go: { tab: 'profile', section: 'salary' } });
    }
}

async function salesEvents(db, me, now, ev) {
    if (me.managerId) {
        const holds = (await db.query(`SELECT * FROM school_bookings WHERE status='hold' AND created_by=$1 AND hold_until BETWEEN $2 AND $3`,
            [me.user.id, now, new Date(now.getTime() + 2 * 60000)])).rows;
        for (const b of holds) ev.push({ id: `hold:${b.id}`, type: 'hold_expiring', cat: 'sinov', tone: 'warn', title: 'Ushlab turish tugayapti',
            sub: `${S.dateStr(b.date)} ${T.fromMin(Number(b.start_min))} · 2 daqiqadan kam qoldi`, at: iso(now), go: { tab: 'timetable' } });
        const leads = (await db.query(`SELECT id, name, extra_data FROM leads WHERE manager_id=$1 AND deleted_at IS NULL AND updated_at > $2
            AND extra_data ? 'trialRequest'`, [me.managerId, new Date(now.getTime() - 3 * 86400000)])).rows;
        const since = now.getTime() - 3 * 86400000;
        for (const r of leads) {
            const t = workflow.request({ ...parseExtra(r.extra_data), id: r.id, name: r.name }); if (!t) continue;
            const acc = Date.parse(t.acceptedAt), rej = Date.parse(t.rejectedAt), done = Date.parse(t.completedAt);
            if (acc > since) ev.push({ id: `tt:${t.id}:acc`, type: 'trial_teacher_decision', cat: 'sinov', tone: 'ok', title: 'Ustoz sinovni tasdiqladi', sub: first(r.name), at: iso(acc), go: { tab: 'sales' } });
            if (rej > since) ev.push({ id: `tt:${t.id}:rej`, type: 'trial_teacher_decision', cat: 'sinov', tone: 'bad', title: 'Ustoz sinovni rad etdi', sub: `${first(r.name)} · boshqa vaqt yoki ustoz tanlang`, at: iso(rej), go: { tab: 'sales' } });
            if (done > since) ev.push({ id: `tt:${t.id}:done`, type: 'trial_result_written', cat: 'sinov', tone: t.attended ? 'ok' : 'warn', title: `Sinov natijasi: ${t.attended ? 'o\'tkazildi' : 'kelmadi'}`,
                sub: [first(r.name), t.resultNote].filter(Boolean).join(' · '), at: iso(done), go: { tab: 'sales' } });
        }
        // "Faol emas" o'quvchilar: eslatma va qayta jalb qo'ng'irog'i kuni keldi (js/studentArchive.js).
        const today = T.nowLocal(now).date;
        for (const f of await require('./school/followups').dueForManager(db, me.managerId, today)) {
            ev.push({ id: `fu:${f.id}`, type: 'student_followup', cat: 'jadval', tone: 'warn',
                title: f.kind === 'winback' ? 'Qayta jalb · qo\'ng\'iroq kuni' : 'Qaytish oldidan eslatma',
                sub: `${first(f.name)} · ${f.kind === 'winback' ? 'chiqib ketgan o\'quvchiga qo\'ng\'iroq qiling' : 'muzlatishdan qaytadi — qo\'ng\'iroq qiling'}`,
                at: iso(new Date(`${f.due}T04:00:00Z`)), go: { tab: 'students' } });
        }
    }
    const er = (await db.query(`SELECT r.*, s.name FROM school_edit_requests r LEFT JOIN students s ON s.id=r.student_id
        WHERE r.requested_by=$1 AND r.status <> 'pending' AND r.decided_at > $2`, [me.user.id, new Date(now.getTime() - 14 * 86400000)])).rows;
    const W = { approved: 'tasdiqlandi', rejected: 'rad etildi', returned: 'qaytarildi' }, K = { tariff: 'Tarif', teacher: 'Ustoz', payment: 'To\'lov' };
    for (const r of er) ev.push({ id: `er:${r.id}:${r.status}`, type: 'edit_decision', cat: 'sorov', tone: r.status === 'approved' ? 'ok' : 'bad',
        title: `${K[r.kind] || 'Tahrir'} so'rovi ${W[r.status] || r.status}`, sub: [first(r.name), r.decided_by_name, r.decision_note].filter(Boolean).join(' · '), at: iso(r.decided_at) });
}

async function managerEvents(db, me, now, ev) {
    const er = (await db.query(`SELECT r.*, s.name, s.subject FROM school_edit_requests r LEFT JOIN students s ON s.id=r.student_id WHERE r.status='pending'`)).rows
        .filter(r => me.kind === 'admin' || !me.lang || me.lang === 'both' || (r.subject || 'english') === me.lang);
    const K = { tariff: 'tarif', teacher: 'ustoz' };
    for (const r of er) ev.push({ id: `erp:${r.id}`, type: r.kind === 'payment' ? 'payment_edit' : 'edit_request', cat: 'tasdiq', tone: 'warn',
        title: r.kind === 'payment' ? 'To\'lov tahriri — tasdiqlash kerak' : `Menejer tahriri — ${K[r.kind] || r.kind}`,
        sub: [r.requester_name, first(r.name), r.reason].filter(Boolean).join(' · '), at: iso(r.created_at), go: { tab: 'teachers-section' } });
    const today = T.nowLocal(now).date;
    const un = await S.unassignedTrials(db, { from: today, to: T.addDays(today, 2), lang: me.kind === 'rop' && me.lang !== 'both' ? me.lang : null });
    for (const u of un) ev.push({ id: `una:${u.leadId}:${u.date}:${u.start}`, type: 'trial_unassigned', cat: 'sinov', tone: 'bad', title: 'Sinovga ustoz biriktirilmagan',
        sub: `${first(u.leadName)} · ${dm(u.date)} ${T.fromMin(u.start)}`, at: iso(now.getTime() - 60000), go: { tab: 'timetable' } });
    if (me.kind !== 'admin') return;
    const mk = (await db.query(`SELECT m.*, s.name, he.name AS tname FROM school_makeups m LEFT JOIN students s ON s.id=m.student_id
        LEFT JOIN hr_employees he ON he.id=m.teacher_id WHERE m.status='review'`)).rows;
    for (const m of mk) ev.push({ id: `mkr:${m.id}`, type: 'makeup_review', cat: 'tasdiq', tone: 'warn', title: 'Qoplash darsi tekshiruvda',
        sub: `${first(m.tname)} · ${first(m.name)} · ${dm(S.dateStr(m.missed_date))} o'rniga`, at: iso(m.created_at), go: { tab: 'teachers-section' } });
    const late = (await db.query(`SELECT * FROM school_requests WHERE type='assist_late' AND status='new'`)).rows;
    for (const r of late) ev.push({ id: `late:${r.id}`, type: 'assist_late', cat: 'tasdiq', tone: 'warn', title: 'Aloqani tuzatish so\'rovi',
        sub: [r.requester_name, r.reason].filter(Boolean).join(' · '), at: iso(r.created_at), go: { tab: 'teachers-section' } });
    const fr = (await db.query(`SELECT st.*, s.name FROM school_student_status st JOIN students s ON s.id=st.student_id
        WHERE st.status='frozen' AND st.cancelled_at IS NULL AND st.to_date BETWEEN $1 AND $2`, [today, T.addDays(today, 1)])).rows;
    for (const f of fr) ev.push({ id: `frz:${f.id}`, type: 'freeze_ending', cat: 'jadval', tone: 'info', title: 'Muzlatish tugaydi',
        sub: `${first(f.name)} · ${dm(T.addDays(S.dateStr(f.to_date), 1))} dan darsga qaytadi`, at: atLocal(T.addDays(S.dateStr(f.to_date), -1), 9 * 60) });
    const day = Number(today.slice(8));
    if (day <= 5) {
        const prev = T.addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
        const st = (await db.query('SELECT * FROM school_assist_months WHERE month=$1', [prev])).rows[0];
        const step = !st?.prelim_at ? 'dastlabki tasdiq' : !st.final_at ? 'yakuniy tasdiq (e\'tiroz 4-sanagacha)' : !st.paid_at ? 'to\'lov (5-sana)' : null;
        if (step) ev.push({ id: `mclose:${prev}:${step}`, type: 'month_close', cat: 'maosh', tone: 'warn', title: 'Oy yopildi — yordamchi aloqalari',
            sub: `${prev} · keyingi bosqich: ${step}`, at: atLocal(`${today.slice(0, 7)}-01`, 9 * 60), go: { tab: 'teachers-section' } });
    }
}

async function guideEvents(db, me, now, ev) {
    const acked = new Set((await db.query('SELECT guide_id FROM staff_guide_acks WHERE user_id=$1', [me.user.id])).rows.map(r => r.guide_id));
    for (const g of await ST.myGuides(db, me)) {
        const t = Date.parse(g.createdAt);
        if (!(t > now.getTime() - 14 * 86400000) || acked.has(g.id)) continue;
        ev.push({ id: `guide:${g.id}`, type: 'guide_new', cat: 'boshqa', tone: 'info', title: 'Yangi yo\'riqnoma', sub: String(g.title || ''), at: iso(t), go: { tab: 'guides', guideId: g.id } });
    }
}

async function feed(db, actor, now = new Date()) {
    const me = await ST.identify(db, actor);
    const groups = catalogFor(me), row = await loadPrefs(db, me.user.id);
    const prefs = effectivePrefs(groups, row.prefs?.types || {});
    const ev = [], errors = [];
    const run = async (name, fn) => { try { await fn(db, me, now, ev); } catch (e) { errors.push(name); console.error('[staff-notify]', name, e.code || e.message); } };
    if (me.kind === 'teacher' && me.emp) await run('teacher', teacherEvents);
    if (me.assistantDuty && me.emp) await run('assistant', assistantEvents);
    if ((me.kind === 'teacher' || me.kind === 'assistant') && me.emp) await run('common', teacherCommon);
    if (me.kind === 'sales') await run('sales', salesEvents);
    if (me.kind === 'admin' || me.kind === 'rop') await run('manager', managerEvents);
    await run('guides', guideEvents);
    const seen = new Set();
    const list = ev.filter(e => prefs[e.type]?.web !== false && !seen.has(e.id) && seen.add(e.id));
    const ids = list.map(e => e.id);
    const reads = ids.length ? new Set((await db.query('SELECT event_id FROM staff_notify_reads WHERE user_id=$1 AND event_id = ANY($2::text[])', [me.user.id, ids])).rows.map(r => r.event_id)) : new Set();
    const before = row.read_before ? new Date(row.read_before).getTime() : 0;
    for (const e of list) e.read = reads.has(e.id) || Date.parse(e.at) <= before;
    list.sort((a, b) => (a.read - b.read) || Date.parse(b.at) - Date.parse(a.at));
    const CATS = { davomat: 'Davomat', sinov: 'Sinov', aloqa: 'Aloqa', sorov: 'So\'rov', maosh: 'Maosh', tasdiq: 'Tasdiq', jadval: 'Jadval', boshqa: 'Boshqa' };
    const cats = [...new Set(list.map(e => e.cat))].map(k => ({ key: k, label: CATS[k] || k }));
    return { kind: me.kind, now: now.toISOString(), unread: list.filter(e => !e.read).length, events: list.slice(0, 80), cats, partial: errors.length ? errors : undefined };
}

async function markRead(db, actor, body = {}) {
    if (body.all) {
        await db.query(`INSERT INTO staff_notify_prefs (user_id, read_before) VALUES ($1, NOW())
            ON CONFLICT (user_id) DO UPDATE SET read_before=NOW()`, [actor.id]);
        // "Hammasi o'qildi" vaqtida mavjud bo'lgan (vaqti kelajakdagi) voqealar ham o'qilgan bo'lsin.
    }
    const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).filter(x => x.length > 0 && x.length <= 200).slice(0, 200);
    for (const id of ids) await db.query('INSERT INTO staff_notify_reads (user_id, event_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [actor.id, id]);
    await db.query(`DELETE FROM staff_notify_reads WHERE user_id=$1 AND read_at < NOW() - INTERVAL '60 days'`, [actor.id]);
    return { ok: true };
}

module.exports = { CATALOG, catalogFor, effectivePrefs, getPrefs, savePrefs, feed, markRead };
