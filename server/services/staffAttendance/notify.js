'use strict';
// Davomat xabarlari — @Domworkuz_bot orqali direktor (admin/boshliq) va ROP'ga.
// Xabarlar bot navbatiga (outbox) yoziladi; bir xil hodisa uchun kalit takrorlanmaydi,
// shuning uchun bir nechta server nusxasi bo'lsa ham xabar ikki marta ketmaydi.
// role bo'sh: bot buni oddiy xizmat xabari sifatida yuboradi (15 daqiqada yetkazilmasa bekor bo'ladi —
// bot o'chirilgan bo'lsa eskirgan xabarlar keyin to'planib ketmaydi).
const t = require('./time');

const RECIPIENT_ROLES = ['admin', 'boshliq', 'rop'];
const MANAGERS = ['admin', 'boshliq']; // HR bo'limiga havola beruvchi xabarlar — ROP u yerga kira olmaydi
const esc = v => String(v ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])).slice(0, 120);

async function recipients(db) {
    const ok = (await db.query("SELECT to_regclass('public.domwork_bot_links') AS a, to_regclass('public.domwork_bot_outbox') AS b")).rows[0];
    if (!ok?.a || !ok?.b) return [];
    return (await db.query(`SELECT l.telegram_id,u.id AS user_id,u.role FROM domwork_bot_links l JOIN users u ON u.id=l.account_id
        WHERE l.account_kind='user' AND NOT l.paused AND u.role=ANY($1::text[])`, [RECIPIENT_ROLES])).rows;
}

async function send(db, key, text, settings, roles = RECIPIENT_ROLES) {
    if (settings && settings.notifyTelegram === false) return 0;
    const list = (await recipients(db)).filter(r => roles.includes(r.role));
    if (!list.length) return 0;
    const store = require('../domworkBot/store');
    let sent = 0;
    for (const r of list) {
        try {
            await store.enqueue(db, { key: `${key}:${r.telegram_id}`.slice(0, 200), targetId: r.telegram_id,
                payload: { chat_id: r.telegram_id, text, parse_mode: 'HTML', disable_web_page_preview: true } });
            sent++;
        } catch (e) {
            console.error('[staff-attendance] xabarni navbatga qo‘yib bo‘lmadi:', e.message);
        }
    }
    return sent;
}

async function late(db, { employeeId, name, date, status, settings }) {
    // "Kelmadi" xabari allaqachon ketgan bo'lsa — buni tuzatish sifatida yozamiz.
    const prior = (await db.query("SELECT to_regclass('public.domwork_bot_outbox') AS t")).rows[0]?.t
        && (await db.query('SELECT 1 FROM domwork_bot_outbox WHERE unique_key LIKE $1 LIMIT 1', [`att:absent:${employeeId}:${date}:%`])).rows[0];
    const head = prior ? `✅ <b>${esc(name)}</b> keldi (avval “kelmadi” deb xabar berilgan edi)` : `⏰ <b>${esc(name)}</b> kechikdi`;
    return send(db, `att:late:${employeeId}:${date}`,
        `${head}\nKeldi: ${status.inClock} (ish ${status.start} da boshlanadi)\nKechikish: <b>${status.lateMinutes} daqiqa</b>`, settings);
}

const absent = (db, { employeeId, name, date, status, settings }) => send(db, `att:absent:${employeeId}:${date}`,
    `❌ <b>${esc(name)}</b> bugun ishga kelganini belgilamadi\nIsh boshlanishi: ${status.start}\nSana: ${date}`, settings);

const earlyLeave = (db, { employeeId, name, date, status, settings }) => send(db, `att:early:${employeeId}:${date}`,
    `🚪 <b>${esc(name)}</b> ishdan erta ketdi\nKetdi: ${status.outClock} (ish ${status.end} da tugaydi)\nErta: <b>${status.earlyMinutes} daqiqa</b>`, settings);

const mismatch = (db, { employeeId, name, date, at, settings }) => send(db, `att:mismatch:${employeeId}:${date}`,
    `❗ <b>${esc(name)}</b> akkauntidan belgilashda yuz mos kelmadi (${t.tashkentClock(at)}).\nRasmni CRM → HR → Davomat bo‘limida ko‘ring.`, settings, MANAGERS);

const replay = (db, { employeeId, name, date, at, settings }) => send(db, `att:replay:${employeeId}:${date}`,
    `⚠️ <b>${esc(name)}</b> belgilashda avvalgi rasmga juda o‘xshash rasm yubordi (${t.tashkentClock(at)}). Odatda bu qayta yuborilgan rasm bo‘ladi.\nCRM → HR → Davomat bo‘limida tekshiring.`, settings, MANAGERS);

const facePending = (db, { employeeId, name }) => send(db, `att:face:${employeeId}:${t.tashkentDate()}`,
    `🙂 <b>${esc(name)}</b> yuz namunasini yubordi. CRM → HR → Davomat bo‘limida tasdiqlang.`, null, MANAGERS);

module.exports = { late, absent, earlyLeave, mismatch, replay, facePending, recipients, RECIPIENT_ROLES };
