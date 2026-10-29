'use strict';
// Xodim bildirishnomalari: serverda MAVJUD voqealardan har xodimga o'z ro'yxati yig'iladi
// (alohida "xabar" jadvali yo'q — davomat, sinov, qoplash, so'rov, aloqa, yo'riqnoma va maoshdan
// hisoblanadi). Saqlanadigani faqat: kim nimani o'qigani (staff_notify_reads, read_before) va
// sozlamalar (qaysi turlar yoqilgan — staff_notify_prefs). Har xodim faqat o'zinikini ko'radi.
// Telegram/push yuborilmaydi — "tg" tanlovi saqlanadi, bot ulanganda ishlatiladi.
const T = require('./school/time');
const S = require('./school/schedule');
const A = require('./school/assist');
const R = require('../../js/attendanceRules');
const workflow = require('../../js/trialWorkflow');
const ST = require('./staffSettings');

// Katalog: kind → guruhlar → turlar. live=true — panelga hozir serverdan chiqadi; false — sozlama saqlanadi,
// manba hali ulanmagan ("tez orada"). locked — o'chirib bo'lmaydi. d = [telegram, brauzer] standart (ROP/sotuv — RopSozBildirish/SotuvSozBildirish dizayni).
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
            ['student_inactive', 'O\'quvchi 3 kundan beri ilovada faol emas', 'kuniga bir marta, 09:00 da', [0, 0], true]]],
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
            ['student_assigned', 'Yangi o\'quvchi biriktirildi', 'admin biriktirganda', [1, 1], true]]],
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
            ['group_link_missing', 'Telegram guruh havolasi kiritilmagan', 'konvertatsiyadan 24 soat o\'tsa', [1, 0], true],
            ['student_followup', 'Qaytish oldidan eslatma · qayta jalb qo\'ng\'irog\'i', 'belgilangan kuni · "Faol emas" o\'quvchilar', [1, 1], true],
            ['student_status', 'O\'quvchim muzlatildi / to\'xtatildi / ustozi almashdi', 'admin yoki ROP qilganda', [1, 1], true],
            ['payment_due', 'To\'lov muddati yaqin / o\'tdi', '3 kun oldin va o\'tgan kuni', [1, 0], true],
            ['daily_plan', 'Kunlik reja', '20:00 da', [0, 1], true],
            ['guide_new', 'Yangi yo\'riqnoma', '', [0, 1], true]]]
    ],
    rop: [
        ['Tasdiqlash kerak', [
            ['edit_request', 'Sotuv menejeri tahriri — tarif yoki ustoz', 'kutilayotgan so\'rovlar', [1, 1], true],
            ['payment_edit', 'To\'lov tahriri 24 soatdan keyin', 'admin ham ko\'radi · kim birinchi', [1, 1], true]]],
        ['Sinov va lidlar', [
            ['trial_unassigned', 'Sinovga ustoz topilmadi', 'darhol', [1, 1], true],
            ['trial_outcome', 'Sinov natijasi: o\'tkazildi / kelmadi', 'jamoa bo\'yicha', [1, 0], true],
            ['hold_expired', 'Ushlab turish tugadi, band qilinmadi', '10 daqiqadan keyin', [0, 0], true]]],
        ['Jamoa', [
            ['daily_plan', 'Kunlik reja natijasi', '20:00 da · har menejer bo\'yicha', [1, 0], true],
            ['group_link_missing', 'Telegram guruh havolasi kiritilmagan', 'menejer nomi bilan', [1, 0], true],
            ['student_status', 'O\'quvchi muzlatildi / to\'xtatildi', 'jamoa o\'quvchilari', [1, 1], true],
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
            ['attendance_unmarked_all', 'Davomat belgilanmagan darslar', 'har kuni 21:00 da · ro\'yxat bilan', [1, 0], true],
            ['group_link_missing', 'Telegram guruh havolasi yo\'q', 'konvertatsiyadan 24 soat o\'tsa', [1, 0], true]]],
        ['Moliya', [
            ['month_close', 'Oy yopildi — yakunni tasdiqlash kerak', '1–5-sana · yordamchi aloqalari', [1, 1], true],
            ['payment_overdue', 'To\'lov muddati o\'tdi', 'kuniga bir marta · qarzdorlar soni', [1, 0], true]]]
    ],
    other: [['Boshqa', [['guide_new', 'Yangi yo\'riqnoma', '', [0, 1], true]]]]
};
// Panel o'zgarmaydi: Telegram tanlangan xabar ham panelda qoladi. Telegram — qo'shimcha kanal; bot ishlamasa yoki
// yetkazilmasa ham xodim xabarni yo'qotmaydi.
function shownInPanel(p) { return !p || p.web !== false || p.tg !== false; }
async function telegramLive(db, userId) {
    if (process.env.DOMWORK_BOT_ENABLED !== 'true') return false;
    try {
        const t = (await db.query("SELECT to_regclass('domwork_bot_settings') AS s, to_regclass('domwork_bot_links') AS l")).rows[0];
        if (!t?.s || !t?.l) return false;
        const on = (await db.query('SELECT data FROM domwork_bot_settings WHERE singleton=1')).rows[0]?.data?.staffNotifyEnabled === true;
        if (!on || !(await db.query("SELECT 1 FROM domwork_bot_links WHERE account_kind='user' AND account_id=$1 AND NOT paused", [userId])).rows.length) return false;
        // "Ulangan" faqat bot haqiqatan yuborib turgan bo'lsa (so'nggi 10 daqiqada shu xodim uchun ishlagan).
        if (!(await db.query("SELECT to_regclass('staff_notify_tg_state') AS t")).rows[0]?.t) return false;
        return (await db.query("SELECT 1 FROM staff_notify_tg_state WHERE user_id=$1 AND last_push_at>NOW()-INTERVAL '10 minutes'", [userId])).rows.length > 0;
    } catch { return false; }
}
// Tinch soatlarda ham keladigan shoshilinch turlar.
const URGENT = new Set(['hold_expiring', 'trial_confirm', 'trial_unassigned']);
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
    // @Domworkuz_bot'ga ulanganmi (CRM → Bildirishnomalar → "Ulash"). Jadval hali yaratilmagan bo'lsa — yo'q.
    const live = await telegramLive(db, me.user.id);
    const botLinked = !!(await db.query("SELECT to_regclass('domwork_bot_links') AS t")).rows[0]?.t
        && (await db.query("SELECT 1 FROM domwork_bot_links WHERE account_kind='user' AND account_id=$1", [me.user.id])).rows.length > 0;
    return { kind: me.kind, groups, prefs: effectivePrefs(groups, saved.types || {}), quiet: saved.quiet || QUIET_DEFAULT,
        channels: { telegram: { username: tg, botLinked, connected: live, note: live ? '' : 'Telegram orqali yuborish hali yoqilmagan — tanlovingiz saqlanadi, ungacha bu xabarlar qo\'ng\'iroqcha panelida chiqadi' }, browser: { connected: true } } };
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
        // ROP "Ustozga eslatish" (RopSinov) — natija hali yozilmagan bo'lsa, har eslatma yangi xabar.
        const rem = lead.trialRopReminder;
        if (rem?.at && (!rem.requestId || rem.requestId === t.id) && ['pending', 'accepted'].includes(t.state) && Date.parse(rem.at) > now.getTime() - 3 * 86400000)
            ev.push({ id: `trial:${r.id}:${t.id}:rop:${rem.at}`, type: 'trial_result', cat: 'sinov', tone: 'warn', title: `ROP eslatdi: ${first(r.name)} sinovi natijasini yozing`,
                sub: [rem.by ? first(rem.by) : 'ROP', local ? `${dm(local.date)} ${T.fromMin(local.min)}` : ''].filter(Boolean).join(' · '), at: iso(Date.parse(rem.at)), go: { tab: 'trial-lessons' } });
    }
    const since = new Date(now.getTime() - 14 * 86400000);
    const mk = (await db.query(`SELECT m.*, s.name FROM school_makeups m LEFT JOIN students s ON s.id=m.student_id
        WHERE m.teacher_id=$1 AND m.status IN ('approved','rejected') AND m.decided_at > $2`, [tid, since])).rows;
    for (const m of mk) ev.push({ id: `makeup:${m.id}:${m.status}`, type: 'makeup_decision', cat: 'davomat', tone: m.status === 'approved' ? 'ok' : 'bad',
        title: `Qoplash darsi ${m.status === 'approved' ? 'tasdiqlandi' : 'rad etildi'}`,
        sub: `${first(m.name)} · ${dm(S.dateStr(m.missed_date))} o'rniga${m.held_date ? ' ' + dm(S.dateStr(m.held_date)) : ''}${m.decision_note ? ' · ' + m.decision_note : ''}`, at: iso(m.decided_at), go: { tab: 'timetable' } });
    // O'quvchi ilovada 3 kundan beri faol emas (yoki hali kirmagan) — "E'tibor kerak" bilan bitta qoida (academicHub flags 'idle').
    // Kuniga bir marta, 09:00 da (undan oldin — kechagi eslatma). Faqat hozir shu ustozdagi faol o'quvchilar.
    const idleDay = nowMin >= 9 * 60 ? today : T.addDays(today, -1);
    const own = (await db.query('SELECT id, name, extra_data FROM students WHERE teacher_id=$1', [tid])).rows.filter(r => R.isActiveStudent(r));
    if (own.length) {
        let prog = {};
        try { prog = await require('./academicHub').progressForIds(db, own.map(r => r.id)); } catch (e) { if (e.code !== '42P01') throw e; }
        for (const r of own) {
            const idle = (prog[r.id]?.flags || []).find(f => f.key === 'idle');
            if (idle) ev.push({ id: `idle:${r.id}:${idleDay}`, type: 'student_inactive', cat: 'davomat', tone: 'warn', title: `${first(r.name)} ilovada faol emas`,
                sub: idle.label, at: atLocal(idleDay, 9 * 60), go: { tab: 'students' } });
        }
    }
    // Yordamchi bu hafta bog'lanmadi (o'z o'quvchilari, Juma 18:00 dan).
    const wd = T.weekday(today);
    if ((wd === 5 && nowMin >= 18 * 60) || wd > 5) {
        const ws = T.weekStart(today);
        const rows = (await db.query(`SELECT s.id, s.name, s.extra_data FROM students s WHERE s.teacher_id=$1 AND COALESCE(s.assistant_teacher_id,'') <> ''
            AND NOT EXISTS (SELECT 1 FROM school_assist_contacts c WHERE c.student_id=s.id AND c.day BETWEEN $2 AND $3 AND c.removed_at IS NULL AND c.outcome='contacted')`,
            [tid, ws, T.addDays(ws, 6)])).rows.filter(r => R.isActiveStudent(r));
        if (rows.length) ev.push({ id: `assistweek:${ws}:${rows.length}`, type: 'assistant_missed_week', cat: 'davomat', tone: 'warn', title: `Yordamchi bu hafta ${rows.length} o'quvchi bilan bog'lanmadi`,
            sub: rows.slice(0, 4).map(r => first(r.name)).join(', ') + (rows.length > 4 ? ` va yana ${rows.length - 4}` : ''), at: atLocal(T.addDays(ws, 4), 18 * 60) });
    }
}

// Ustoz: o'quvchi 3 kundan beri ilovaga kirmagan — kuniga bitta jamlangan xabar, 09:00 dan.
async function inactiveStudents(db, me, now, ev) {
    const { date: today, min } = T.nowLocal(now);
    if (min < 9 * 60) return;
    const rows = (await db.query(`SELECT s.id, s.name, s.extra_data, MAX(se.last_seen) AS seen FROM students s LEFT JOIN sessions se ON se.user_id = s.id
        WHERE s.teacher_id = $1 AND COALESCE(s.extra_data->>'isStaffDemo','false') <> 'true' GROUP BY s.id`, [me.emp.id])).rows
        .filter(r => R.isActiveStudent(r)).filter(r => !r.seen || new Date(r.seen).getTime() < now.getTime() - 3 * 86400000);
    if (rows.length) ev.push({ id: `inactive:${today}:${rows.length}`, type: 'student_inactive', cat: 'davomat', tone: 'warn', title: `${rows.length} o'quvchi 3 kundan beri ilovaga kirmagan`,
        sub: rows.slice(0, 5).map(r => first(r.name)).join(', ') + (rows.length > 5 ? ` va yana ${rows.length - 5}` : '') + ' · bir og\'iz so\'rab qo\'ying', at: atLocal(today, 9 * 60), go: { tab: 'teachers-section' } });
}

async function assistantEvents(db, me, now, ev) {
    const aid = me.emp.id, { date: today, min: nowMin } = T.nowLocal(now), month = today.slice(0, 7);
    const plan = await A.plan(db, { assistantIds: [aid], from: today, to: today, now });
    const advice = plan.items.filter(i => i.kind === 'advice');
    for (const i of advice) if (i.start - 15 <= nowMin)
        ev.push({ id: `advice:${i.studentId}:${today}`, type: 'assist_advice', cat: 'aloqa', tone: 'info', title: `Aloqa tavsiyasi · ${T.fromMin(i.start)}`,
            sub: `${first(i.studentName)} bilan bog'laning`, at: atLocal(today, Math.max(0, i.start - 15)), go: { tab: 'teachers-section', section: 'attendance' } });
    if (nowMin >= 20 * 60 && advice.length)
        ev.push({ id: `assistday:${today}`, type: 'assist_unmarked_day', cat: 'aloqa', tone: 'bad', title: `Bugun ${advice.length} ta aloqa belgilanmagan`,
            sub: `${advice.slice(0, 4).map(i => first(i.studentName)).join(', ')} · shu kuni belgilanmasa hisoblanmaydi`, at: atLocal(today, 20 * 60), go: { tab: 'teachers-section', section: 'attendance' } });
    const yday = T.addDays(today, -1);
    const na = (await db.query(`SELECT c.student_id, s.name FROM school_assist_contacts c JOIN students s ON s.id=c.student_id
        WHERE c.assistant_id=$1 AND c.day=$2 AND c.outcome='no_answer' AND c.removed_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM school_assist_contacts x WHERE x.assistant_id=$1 AND x.student_id=c.student_id AND x.day BETWEEN $2 AND $3 AND x.outcome='contacted' AND x.removed_at IS NULL)
        -- Shu o'quvchi uchun (kecha/bugun) ochiq "Admin orqali so'rov" bor — admin ko'rib chiqmoqda, "Qayta urinish" kerak emas.
        AND NOT EXISTS (SELECT 1 FROM school_requests r WHERE r.type='assist_late' AND r.status='new' AND r.teacher_id=$1
            AND r.payload->>'studentId'=c.student_id AND r.payload->>'day' BETWEEN $2::text AND $3::text)`,
        [aid, yday, today])).rows;
    for (const r of na) ev.push({ id: `noanswer:${r.student_id}:${yday}`, type: 'assist_no_answer', cat: 'aloqa', tone: 'warn', title: 'Qayta urinish kerak',
        sub: `${first(r.name)} · kecha javob bermadi`, at: atLocal(today, 9 * 60), go: { tab: 'teachers-section', section: 'attendance' } });
    const wd = T.weekday(today);
    if ((wd === 5 && nowMin >= 18 * 60) || wd > 5) {
        const ws = T.weekStart(today);
        // Haftalik reja — Bosh/Davomat/Dars jadvali bilan bitta ta'rif (AttendanceRules.weekPlanSlots: sana bo'yicha faol o'quvchining
        // shu haftadagi tavsiya kunlari). Muzlatilgan/chiqib ketgan kunlar rejaga kirmaydi; hisoblangan aloqalar — countMonth.
        const wp = await A.plan(db, { assistantIds: [aid], from: ws, to: T.addDays(ws, 6), now });
        const slots = R.weekPlanSlots(wp.items);
        const counted = new Map();
        for (const i of wp.items) if (i.kind === 'contact' && i.status === 'counted') counted.set(i.studentId, (counted.get(i.studentId) || 0) + 1);
        const names = new Map(wp.items.map(i => [i.studentId, i.studentName]));
        const low = [...slots].map(([sid, days]) => ({ id: sid, name: names.get(sid) || '', target: days.size, n: counted.get(sid) || 0 })).filter(x => x.n < x.target);
        if (low.length) ev.push({ id: `weeklow:${ws}:${low.length}`, type: 'assist_week_low', cat: 'aloqa', tone: 'warn', title: `Bu hafta ${low.length} o'quvchida rejadagidan kam aloqa`,
            sub: low.slice(0, 5).map(s => `${first(s.name)} ${s.n}/${s.target}`).join(', '), at: atLocal(T.addDays(ws, 4), 18 * 60), go: { tab: 'teachers-section', section: 'attendance' } });
    }
    const abs = (await db.query(`SELECT a.student_id, a.day, s.name FROM school_absences a JOIN students s ON s.id=a.student_id
        WHERE s.assistant_teacher_id=$1 AND a.absent AND a.day BETWEEN $2 AND $3`, [aid, yday, today])).rows;
    for (const r of abs) ev.push({ id: `absent:${r.student_id}:${S.dateStr(r.day)}`, type: 'student_absent', cat: 'aloqa', tone: 'bad',
        title: `${first(r.name)} asosiy darsga kelmadi`, sub: `${dm(S.dateStr(r.day))} · bog'lanib sababini bilib qo'ying`, at: atLocal(S.dateStr(r.day), 21 * 60) });
    const rep = await A.monthReport(db, aid, month);
    const near = rep.students.filter(s => s.counted >= rep.cap - 1);
    if (near.length) {
        const names = new Map((await db.query('SELECT id, name FROM students WHERE id = ANY($1::text[])', [near.map(s => s.studentId)])).rows.map(r => [r.id, r.name]));
        // Vaqt — limitga yetkazgan (oxirgi hisoblangan) aloqa vaqti, Toshkent bo'yicha (UTC yarim tun — 05:00 emas).
        for (const s of near) {
            const last = [...s.items].filter(x => x.status === 'counted').pop();
            ev.push({ id: `cap:${s.studentId}:${month}:${Math.min(s.counted, rep.cap)}`, type: 'assist_near_cap', cat: 'aloqa', tone: 'warn',
                title: `${first(names.get(s.studentId))} · ${Math.min(s.counted, rep.cap)}/${rep.cap} aloqa`, sub: s.counted >= rep.cap ? 'oylik limit to\'ldi — keyingisi hisoblanmaydi' : `${rep.cap}-chi oxirgisi, undan keyingisi hisoblanmaydi`,
                at: last ? atLocal(last.day, Number(last.at) || 0) : atLocal(today, 0) });
        }
    }
    // Yangi o'quvchi biriktirildi — o'quvchi audit yozuvi (school_student_audit: changes.assistantId.to = shu yordamchi; CRM'da
    // biriktirish, "Qayta tiklash" yoki ko'chirish yozadi). Oxirgi 14 kun, o'quvchi hali shu yordamchida bo'lsa.
    if ((await db.query("SELECT to_regclass('public.school_student_audit')::text AS t")).rows[0]?.t) {
        const asg = (await db.query(`SELECT a.id, a.student_id, a.created_at, s.name, he.name AS tname FROM school_student_audit a
            JOIN students s ON s.id=a.student_id LEFT JOIN hr_employees he ON he.id=s.teacher_id
            WHERE a.changes->'assistantId'->>'to' = $1 AND s.assistant_teacher_id = $1 AND a.created_at > $2`, [aid, new Date(now.getTime() - 14 * 86400000)])).rows;
        for (const r of asg) ev.push({ id: `assign:${r.id}`, type: 'student_assigned', cat: 'aloqa', tone: 'info', title: 'Yangi o\'quvchi biriktirildi',
            sub: `${first(r.name)}${r.tname ? ` · asosiy ustoz ${first(r.tname)}` : ''} · haftasiga 3 aloqa`, at: iso(r.created_at), go: { tab: 'students' } });
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


// ── Qo'shimcha manbalar (29-okt): to'lov muddati, o'quvchi holati, guruh havolasi, kunlik reja, jamoa nazorati ──
const money = n => `${Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/\s/g, ' ')} so'm`;
const ymd = v => { const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v || '')); return m ? m[1] : (v instanceof Date ? S.dateStr(v) : ''); };
// Menejerning haqiqiy o'quvchilari — CRM'dagi filterStudentsForSalesManager bilan bir xil (o'zi yoki lididan), demo xodimlarsiz.
async function managerStudents(db, managerIds, lang) {
    const rows = (await db.query(`SELECT s.id, s.name, s.subject, s.teacher_id, s.extra_data, COALESCE(NULLIF(s.extra_data->>'managerId',''), l.manager_id) AS manager_id
        FROM students s LEFT JOIN leads l ON l.id = s.extra_data->'leadRef'->>'id'
        WHERE COALESCE(s.extra_data->>'isStaffDemo','false') <> 'true' AND ($2::text IS NULL OR s.subject = $2)
        AND ($1::text[] IS NULL OR s.extra_data->>'managerId' = ANY($1::text[]) OR l.manager_id = ANY($1::text[]))`, [managerIds, lang || null])).rows;
    return rows.map(r => ({ ...r, extra: parseExtra(r.extra_data) })).filter(r => R.isActiveStudent ? R.isActiveStudent({ ...r, extra_data: r.extra }) : true);
}
function dueEvents(list, today, ev, own = true) {
    for (const st of list) {
        const debt = Number(st.extra.debtAmount) || 0, due = ymd(st.extra.paymentDueDate);
        if (debt <= 0 || !due) continue;
        if (due >= today && due <= T.addDays(today, 3))
            ev.push({ id: `due:${st.id}:${due}:soon`, type: 'payment_due', cat: 'jadval', tone: 'warn', title: own ? 'To\'lov muddati yaqin' : 'To\'lov muddati yaqin',
                sub: `${first(st.name)} · ${money(debt)} · ${dm(due)}${due === today ? ' (bugun)' : ''}`, at: atLocal(today, 9 * 60), go: { tab: 'students' } });
        else if (due < today && due >= T.addDays(today, -30))
            ev.push({ id: `due:${st.id}:${due}:over`, type: 'payment_due', cat: 'jadval', tone: 'bad', title: 'To\'lov muddati o\'tdi',
                sub: `${first(st.name)} · ${money(debt)} · ${dm(due)} edi — qo'ng'iroq qiling`, at: atLocal(T.addDays(due, 1), 9 * 60), go: { tab: 'students' } });
    }
}
async function statusEvents(db, list, now, ev, withManager = false) {
    if (!list.length) return;
    const ids = list.map(st => st.id), by = new Map(list.map(st => [st.id, st]));
    const since = new Date(now.getTime() - 3 * 86400000);
    const names = withManager ? new Map((await db.query('SELECT id, name FROM hr_employees')).rows.map(r => [r.id, r.name])) : new Map();
    const tag = st => withManager && names.get(st.manager_id) ? ` · ${first(names.get(st.manager_id))}` : '';
    for (const r of (await db.query(`SELECT * FROM school_student_status WHERE student_id = ANY($1::text[]) AND cancelled_at IS NULL AND created_at > $2`, [ids, since])).rows) {
        const st = by.get(r.student_id), W = { frozen: 'muzlatildi', left: 'to\'xtatdi', restored: 'darsga qaytdi' };
        ev.push({ id: `st:${r.id}`, type: 'student_status', cat: 'jadval', tone: r.status === 'restored' ? 'ok' : 'warn', title: `O'quvchi ${W[r.status] || r.status}`,
            sub: [first(st?.name) + tag(st), r.status === 'frozen' && r.to_date ? `${dm(S.dateStr(r.from_date))}–${dm(S.dateStr(r.to_date))}` : dm(S.dateStr(r.from_date)), r.reason].filter(Boolean).join(' · '),
            at: iso(r.created_at), go: { tab: 'students' } });
    }
    // Ustoz almashdi — birinchi biriktirish emas, keyingi o'zgarish.
    for (const r of (await db.query(`SELECT h.*, he.name AS tname FROM school_teacher_history h LEFT JOIN hr_employees he ON he.id = h.teacher_id
        WHERE h.student_id = ANY($1::text[]) AND h.created_at > $2
        AND EXISTS (SELECT 1 FROM school_teacher_history o WHERE o.student_id = h.student_id AND o.id <> h.id AND o.created_at < h.created_at)`, [ids, since])).rows) {
        const st = by.get(r.student_id);
        ev.push({ id: `tch:${r.id}`, type: 'student_status', cat: 'jadval', tone: 'info', title: 'O\'quvchining ustozi almashdi',
            sub: `${first(st?.name)}${tag(st)} · yangi ustoz: ${r.tname || '—'}${r.from_date ? ' · ' + dm(S.dateStr(r.from_date)) + ' dan' : ''}`, at: iso(r.created_at), go: { tab: 'students' } });
    }
}
// Konvertatsiyadan (liddan birinchi tushum) 24 soat o'tib ham Telegram dars guruhi biriktirilmagan o'quvchilar.
async function missingGroup(db, list, now) {
    if (!list.length) return [];
    const ids = list.map(st => st.id);
    const has = new Set((await db.query(`SELECT student_id FROM school_student_groups WHERE student_id = ANY($1::text[]) AND tg_link <> '' AND NOT archived`, [ids])).rows.map(r => r.student_id));
    try { for (const r of (await db.query('SELECT student_id FROM domwork_student_group_links WHERE student_id = ANY($1::text[])', [ids])).rows) has.add(r.student_id); } catch { /* jadval bo'lmasa */ }
    const leadIds = list.map(st => st.extra.leadRef?.id).filter(Boolean);
    const paidAt = new Map((await db.query(`SELECT lead_id, MIN(created_at) AS at FROM payment_records WHERE lead_id = ANY($1::text[]) AND source_key LIKE 'lead:%' GROUP BY lead_id`, [leadIds])).rows.map(r => [r.lead_id, new Date(r.at).getTime()]));
    const t = now.getTime();
    return list.filter(st => !has.has(st.id) && !String(st.extra.telegramGroupLink || '').trim()).map(st => ({ st, at: paidAt.get(st.extra.leadRef?.id) }))
        .filter(x => x.at && x.at <= t - 86400000 && x.at > t - 30 * 86400000);
}
async function dayTotals(db, managerIds, today) {
    const rows = (await db.query(`SELECT manager_id, COUNT(*) FILTER (WHERE paid_date = $2::date) AS n, COALESCE(SUM(amount) FILTER (WHERE paid_date = $2::date), 0) AS day,
        COALESCE(SUM(amount), 0) AS month FROM payment_records p WHERE ${await require('./domworkBot/dailyReports').validReceipt(db, 'p')} AND manager_id = ANY($1::text[]) AND paid_date BETWEEN $3::date AND $2::date GROUP BY manager_id`,
        [managerIds, today, today.slice(0, 7) + '-01'])).rows;
    const plans = (await db.query("SELECT data FROM json_data WHERE key='individualSalesPlans'")).rows[0]?.data;
    const plan = id => Number(require('./domworkBot/staff').personalPlan(typeof plans === 'string' ? JSON.parse(plans) : plans, id, today.slice(0, 7))?.totalAmount) || 0;
    return new Map(managerIds.map(id => { const r = rows.find(x => x.manager_id === id) || {}; return [id, { n: Number(r.n) || 0, day: Number(r.day) || 0, month: Number(r.month) || 0, plan: plan(id) }]; }));
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
        const mine = await managerStudents(db, [me.managerId], me.lang && me.lang !== 'both' ? me.lang : null);
        dueEvents(mine, today, ev);
        await statusEvents(db, mine, now, ev);
        for (const { st, at } of await missingGroup(db, mine, now))
            ev.push({ id: `glm:${st.id}`, type: 'group_link_missing', cat: 'jadval', tone: 'warn', title: 'Telegram guruh havolasi kiritilmagan',
                sub: `${first(st.name)} · o'quvchi darsga qaysi guruhda kirishini bilmaydi`, at: iso(at + 86400000), go: { tab: 'students' } });
        if (T.nowLocal(now).min >= 20 * 60) {
            const d = (await dayTotals(db, [me.managerId], today)).get(me.managerId);
            ev.push({ id: `plan:${me.managerId}:${today}`, type: 'daily_plan', cat: 'maosh', tone: d.n ? 'ok' : 'info', title: d.n ? `Bugun ${d.n} ta to'lov · ${money(d.day)}` : 'Bugun to\'lov bo\'lmadi',
                sub: `Oy: ${money(d.month)}${d.plan > 0 ? ` · reja ${Math.floor(d.month / d.plan * 100)}% · qoldi ${money(Math.max(0, d.plan - d.month))}` : ''}`, at: atLocal(today, 20 * 60), go: { tab: 'sales' } });
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
    const lang = me.kind === 'rop' && me.lang && me.lang !== 'both' ? me.lang : null;
    const team = await managerStudents(db, null, lang);
    const nowMin = T.nowLocal(now).min;
    if (me.kind === 'rop') {
        await statusEvents(db, team, now, ev, true);
        // Jamoa sinov natijalari (so'nggi 2 kun).
        const tl = (await db.query(`SELECT l.id, l.name, l.extra_data, he.name AS mname FROM leads l LEFT JOIN hr_employees he ON he.id = l.manager_id
            WHERE l.deleted_at IS NULL AND l.updated_at > $1 AND l.extra_data ? 'trialRequest' AND ($2::text IS NULL OR l.language = $2)`, [new Date(now.getTime() - 2 * 86400000), lang])).rows;
        for (const r of tl) {
            const t = workflow.request({ ...parseExtra(r.extra_data), id: r.id, name: r.name }); const done = t && Date.parse(t.completedAt);
            if (done > now.getTime() - 2 * 86400000) ev.push({ id: `to:${t.id}`, type: 'trial_outcome', cat: 'sinov', tone: t.attended ? 'ok' : 'warn', title: `Sinov ${t.attended ? 'o\'tkazildi' : 'o\'tmadi — kelmadi'}`,
                sub: [first(r.name), r.mname ? 'menejer ' + first(r.mname) : '', t.resultNote].filter(Boolean).join(' · '), at: iso(done), go: { tab: 'sales' } });
        }
        for (const b of (await db.query(`SELECT * FROM school_bookings WHERE status = 'hold' AND hold_until < $1 AND hold_until > $2`, [now, new Date(now.getTime() - 86400000)])).rows)
            ev.push({ id: `hx:${b.id}`, type: 'hold_expired', cat: 'sinov', tone: 'warn', title: 'Ushlab turish tugadi — band qilinmadi',
                sub: `${b.created_by_name || 'Menejer'} · ${dm(S.dateStr(b.date))} ${T.fromMin(Number(b.start_min))}`, at: iso(b.hold_until), go: { tab: 'timetable' } });
        if (nowMin >= 20 * 60) {
            const mgrs = (await db.query(`SELECT id, name FROM hr_employees WHERE role IN ('sotuv-menejeri','sotuv_menejeri','sotuv menejeri','sales_manager')
                AND COALESCE(status,'active') <> 'inactive' AND ($1::text IS NULL OR lang = $1 OR lang = 'both') ORDER BY name`, [lang])).rows;
            if (mgrs.length) {
                const tot = await dayTotals(db, mgrs.map(m => m.id), today);
                const sorted = mgrs.map(m => ({ ...m, ...tot.get(m.id) })).sort((a, b) => b.day - a.day);
                ev.push({ id: `teamplan:${today}`, type: 'daily_plan', cat: 'maosh', tone: 'info', title: `Bugun jamoa: ${sorted.reduce((x, m) => x + m.n, 0)} ta to'lov · ${money(sorted.reduce((x, m) => x + m.day, 0))}`,
                    sub: sorted.slice(0, 6).map(m => `${first(m.name)} ${m.n}${m.plan > 0 ? ` (${Math.floor(m.month / m.plan * 100)}%)` : ''}`).join(', '), at: atLocal(today, 20 * 60), go: { tab: 'sales' } });
            }
        }
    }
    const miss = await missingGroup(db, team, now);
    if (miss.length) {
        const names = new Map((await db.query('SELECT id, name FROM hr_employees')).rows.map(r => [r.id, r.name]));
        ev.push({ id: `glm-all:${today}:${miss.length}`, type: 'group_link_missing', cat: 'jadval', tone: 'warn', title: `${miss.length} o'quvchida Telegram guruh havolasi yo'q`,
            sub: miss.slice(0, 5).map(x => `${first(x.st.name)}${names.get(x.st.manager_id) ? ' (' + first(names.get(x.st.manager_id)) + ')' : ''}`).join(', ') + (miss.length > 5 ? ` va yana ${miss.length - 5}` : ''),
            at: atLocal(today, 9 * 60), go: { tab: 'students' } });
    }
    if (me.kind !== 'admin') return;
    // ROP "Admin ochsin" (RopSinov): lid istagan vaqtda sinovga ochiq ustoz yo'q — admin vaqt ochadi yoki ustoz biriktiradi.
    const ask = (await db.query(`SELECT id, name, extra_data FROM leads WHERE deleted_at IS NULL AND status='sinov-darsida' AND extra_data ? 'trialAdminOpen'`)).rows;
    for (const r of ask) {
        const x = parseExtra(r.extra_data), a = x.trialAdminOpen || {};
        const t = workflow.request({ ...x, id: r.id, name: r.name });
        if (!a.at || a.doneAt || (a.requestId && t && t.id !== a.requestId) || (t && t.teacherId && !x.trialUnassigned)) continue;
        ev.push({ id: `rop-open:${r.id}:${a.at}`, type: 'trial_unassigned', cat: 'sinov', tone: 'bad', title: `ROP so'radi: sinovga vaqt oching${a.time ? ' · ' + a.time : ''}`,
            sub: [first(r.name), a.date ? dm(a.date) + (a.time ? ' ' + a.time : '') : '', a.by ? 'ROP ' + first(a.by) : ''].filter(Boolean).join(' · '), at: iso(Date.parse(a.at)), go: { tab: 'timetable' } });
    }
    // To'lov muddati o'tganlar — kuniga bitta jamlangan xabar.
    const over = team.filter(st => Number(st.extra.debtAmount) > 0 && ymd(st.extra.paymentDueDate) && ymd(st.extra.paymentDueDate) < today);
    if (over.length) ev.push({ id: `overdue:${today}:${over.length}`, type: 'payment_overdue', cat: 'tasdiq', tone: 'bad', title: `To'lov muddati o'tgan: ${over.length} o'quvchi`,
        sub: `Jami qarz ${money(over.reduce((x, st) => x + Number(st.extra.debtAmount), 0))}`, at: atLocal(today, 9 * 60), go: { tab: 'students' } });
    // 21:00 — bugun davomati belgilanmagan darslar (ustozlar bo'yicha).
    if (nowMin >= 21 * 60) {
        const ctx = await S.loadContext(db, { from: today, to: today, now });
        const tids = [...new Set(ctx.students.map(st => st.teacherId).filter(Boolean))];
        const views = tids.map(tid => S.dayView(ctx, tid, today));
        await S.annotateViews(db, views, { from: today, to: today });
        const abs = new Set((await db.query('SELECT student_id FROM school_absences WHERE day = $1 AND absent', [today])).rows.map(r => r.student_id));
        const per = new Map();
        views.forEach((v, n) => { for (const i of v.items) if (i.kind === 'lesson' && i.studentId && !i.bookingId && i.end <= nowMin && i.att == null && !abs.has(i.studentId)) per.set(tids[n], (per.get(tids[n]) || 0) + 1); });
        if (per.size) {
            const names = new Map((await db.query('SELECT id, name FROM hr_employees WHERE id = ANY($1::text[])', [[...per.keys()]])).rows.map(r => [r.id, r.name]));
            const total = [...per.values()].reduce((a, b) => a + b, 0);
            ev.push({ id: `attall:${today}`, type: 'attendance_unmarked_all', cat: 'davomat', tone: 'bad', title: `Bugun ${total} ta dars davomati belgilanmagan`,
                sub: [...per].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, n]) => `${first(names.get(id)) || id} ${n}`).join(', '), at: atLocal(today, 21 * 60), go: { tab: 'teachers-section' } });
        }
    }
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

async function collect(db, actor, now) {
    const me = await ST.identify(db, actor);
    const groups = catalogFor(me), row = await loadPrefs(db, me.user.id);
    const prefs = effectivePrefs(groups, row.prefs?.types || {});
    const ev = [], errors = [];
    // Tranzaksiya ichida (bot scheduler) bitta bo'lim xatosi butun tranzaksiyani buzmasin — savepoint.
    const tx = typeof db.domworkAfterCommit === 'function';
    const run = async (name, fn) => {
        if (tx) await db.query('SAVEPOINT sn_' + name);
        try { await fn(db, me, now, ev); if (tx) await db.query('RELEASE SAVEPOINT sn_' + name); }
        catch (e) { if (tx) await db.query('ROLLBACK TO SAVEPOINT sn_' + name); errors.push(name); console.error('[staff-notify]', name, e.code || e.message); }
    };
    if (me.kind === 'teacher' && me.emp) await run('teacher', teacherEvents);
    if (me.kind === 'teacher' && me.emp) await run('inactive', inactiveStudents);
    if (me.assistantDuty && me.emp) await run('assistant', assistantEvents);
    if ((me.kind === 'teacher' || me.kind === 'assistant') && me.emp) await run('common', teacherCommon);
    if (me.kind === 'sales') await run('sales', salesEvents);
    if (me.kind === 'admin' || me.kind === 'rop') await run('manager', managerEvents);
    await run('guides', guideEvents);
    return { me, row, prefs, ev, errors };
}
async function feed(db, actor, now = new Date()) {
    const { me, row, prefs, ev, errors } = await collect(db, actor, now);
    const seen = new Set();
    const list = ev.filter(e => shownInPanel(prefs[e.type]) && !seen.has(e.id) && seen.add(e.id));
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

// ── Telegramga yuborish (@Domworkuz_bot scheduler'i har 2 daqiqada chaqiradi) ──
// Har xodim uchun shu panel voqealari hisoblanadi; "Telegram" tanlangan va hali yuborilmaganlari botga ketadi.
// Birinchi marta (yoki yoqilganda) mavjud voqealar "yuborilgan" deb belgilanadi — eski xabarlar to'planib kelmaydi.
const TG_SCHEMA = `CREATE TABLE IF NOT EXISTS staff_notify_tg_sent (user_id TEXT NOT NULL, event_id TEXT NOT NULL, sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(user_id,event_id));
CREATE TABLE IF NOT EXISTS staff_notify_tg_state (user_id TEXT PRIMARY KEY, telegram_id TEXT NOT NULL, baseline_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE staff_notify_tg_state ADD COLUMN IF NOT EXISTS last_push_at TIMESTAMPTZ;`;
function quietNow(quiet, now) {
    const q = quiet || QUIET_DEFAULT;
    if (q.off) return false; // xodim tinch soatlarni o'chirgan
    const toMin = v => { const [h, m] = String(v).split(':').map(Number); return h * 60 + m; };
    const t = new Date(now.getTime() + 5 * 3600000), c = t.getUTCHours() * 60 + t.getUTCMinutes(), a = toMin(q.from), b = toMin(q.to);
    return a <= b ? c >= a && c < b : c >= a || c < b;
}
// Bitta xodim — o'z qisqa tranzaksiyasida. Uzilish bo'lsa (to'xtatish, o'chirish, bot ishlamagan, qayta ulash —
// oxirgi yuborishdan 10 daqiqadan ko'p), mavjud xabarlar qayta "boshlang'ich" deb belgilanadi va ommaviy yuborilmaydi.
async function pushUser(db, link, now) {
    const store = require('./domworkBot/store');
    const identity = await store.identity(db, link.telegram_id);
    if (!identity || identity.kind !== 'user' || identity.id !== link.account_id) return 0;
    const { row, prefs, ev, errors } = await collect(db, { id: link.account_id }, now);
    const state = (await db.query('SELECT telegram_id,last_push_at FROM staff_notify_tg_state WHERE user_id=$1 FOR UPDATE', [link.account_id])).rows[0];
    const ids = [...new Set(ev.map(e => e.id))];
    const gap = !state || state.telegram_id !== link.telegram_id || !state.last_push_at || now - new Date(state.last_push_at) > 10 * 60000;
    if (gap) {
        if (errors.length) return 0; // to'liq bo'lmagan ro'yxat bilan boshlang'ich belgilanmaydi
        await db.query(`INSERT INTO staff_notify_tg_state(user_id,telegram_id,last_push_at) VALUES($1,$2,$3)
            ON CONFLICT(user_id) DO UPDATE SET telegram_id=EXCLUDED.telegram_id,baseline_at=NOW(),last_push_at=EXCLUDED.last_push_at`, [link.account_id, link.telegram_id, now]);
        if (ids.length) await db.query('INSERT INTO staff_notify_tg_sent(user_id,event_id) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING', [link.account_id, ids]);
        return 0;
    }
    await db.query('UPDATE staff_notify_tg_state SET last_push_at=$2 WHERE user_id=$1', [link.account_id, now]);
    const done = ids.length ? new Set((await db.query('SELECT event_id FROM staff_notify_tg_sent WHERE user_id=$1 AND event_id=ANY($2::text[])', [link.account_id, ids])).rows.map(r => r.event_id)) : new Set();
    const quiet = quietNow(row.prefs?.quiet, now), seen = new Set(), skip = [], out = [];
    for (const e of ev) {
        if (seen.has(e.id) || done.has(e.id)) continue; seen.add(e.id);
        if (!prefs[e.type]?.tg) { skip.push(e.id); continue; }
        if (quiet && !URGENT.has(e.type)) continue; // tinch soat tugagach (hali dolzarb bo'lsa)
        out.push(e);
    }
    if (skip.length) await db.query('INSERT INTO staff_notify_tg_sent(user_id,event_id) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING', [link.account_id, skip]);
    if (!out.length) return 0;
    const T = require('./domworkBot/tone');
    const line = e => `${T.b(String(e.title || '').slice(0, 200))}${e.sub ? ' — ' + T.esc(String(e.sub).slice(0, 200)) : ''}`;
    // Bir nechta bo'lsa — bitta jamlangan xabar (masalan tinch soatdan keyin).
    const text = out.length === 1 ? `🔔 ${T.b(String(out[0].title || '').slice(0, 300))}${out[0].sub ? '\n' + T.esc(String(out[0].sub).slice(0, 600)) : ''}`
        : `🔔 <b>${out.length} ta yangi xabar</b>\n\n` + out.slice(0, 12).map(e => '▫️ ' + line(e)).join('\n') + (out.length > 12 ? `\n\n… va yana ${out.length - 12} ta — CRM panelida` : '');
    const key = out.length === 1 ? `staff:${link.account_id}:${out[0].id}` : `staff:${link.account_id}:digest:${now.getTime()}`;
    await store.enqueue(db, { key: key.slice(0, 200), targetId: link.telegram_id, role: identity.role, account: identity,
        payload: { chat_id: link.telegram_id, ...T.fit(text, T.HTML).extra, text: T.fit(text, T.HTML).text, reply_markup: { inline_keyboard: [[{ text: '🖥 CRMda ochish', url: ['teacher','assistant'].includes(identity.role) ? 'https://myhomework.uz/teacher/' : 'https://myhomework.uz/' }]] },
            _automation: true, ...(quiet ? { disable_notification: true } : {}) } }); // tinch soatda shoshilinch xabar ovozsiz
    await db.query('INSERT INTO staff_notify_tg_sent(user_id,event_id) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING', [link.account_id, out.map(e => e.id)]);
    return out.length;
}
// Bot runtime'i alohida taymer bilan chaqiradi (har 2 daqiqa) — bot xabarlarini yetkazish to'xtab qolmaydi.
async function telegramPush(pool, now = new Date(), { budgetMs = 20000 } = {}) {
    const queue = require('./domworkBot/queue');
    const ready = await queue.transaction(pool, async db => {
        const settings = (await db.query('SELECT data FROM domwork_bot_settings WHERE singleton=1')).rows[0]?.data || {};
        if (settings.staffNotifyEnabled !== true || !(await db.query("SELECT to_regclass('staff_notify_prefs') AS t")).rows[0]?.t) return null;
        await db.query(TG_SCHEMA);
        await db.query("DELETE FROM staff_notify_tg_sent WHERE sent_at<NOW()-INTERVAL '60 days'");
        // Eng uzoq kutganlar birinchi — vaqt chegarasida ham hech kim doim navbatdan qolib ketmaydi.
        return (await db.query(`SELECT l.telegram_id,l.account_id FROM domwork_bot_links l LEFT JOIN staff_notify_tg_state s ON s.user_id=l.account_id
            WHERE l.account_kind='user' AND NOT l.paused ORDER BY s.last_push_at NULLS FIRST, l.account_id`)).rows;
    });
    if (!ready) return 0;
    const started = Date.now(); let sent = 0;
    for (const link of ready) {
        if (Date.now() - started > budgetMs) break; // qolganlari keyingi safar
        try { sent += await queue.transaction(pool, db => pushUser(db, link, now)); }
        catch (error) { console.error('[staff-notify] telegram push failed:', error.code || error.name); }
    }
    return sent;
}

module.exports = { CATALOG, catalogFor, effectivePrefs, getPrefs, savePrefs, feed, markRead, telegramPush, quietNow };
