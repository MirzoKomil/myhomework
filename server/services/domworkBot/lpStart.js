'use strict';
// Targetolog landingi (domwork_lp_<uuid>) → botda START → sayt serveriga xabar → Meta'da `LessonStarted`.
// Botning o'z oqimiga tegmaydi: kod saqlanadi, so'rov FONDA ketadi (dars kutib qolmaydi), xato bo'lsa jim o'tadi.
// Bitta kod Meta'ga faqat BIR MARTA yuboriladi (qayta START hisobni buzmaydi).
// Muhit: LESSON_API_URL (https://<sayt>/api/lesson-started), BOT_SHARED_SECRET — ikkalasi bo'lmasa yuborilmaydi, faqat saqlanadi.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS domwork_lp_starts (
 code TEXT PRIMARY KEY, telegram_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 reported_at TIMESTAMPTZ, report_status INTEGER
);
CREATE INDEX IF NOT EXISTS domwork_lp_starts_tid ON domwork_lp_starts(telegram_id);`;
const RE = /^\/start(?:@Domworkuz_bot)?\s+(domwork_lp_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

async function init(db) { await db.query(SCHEMA); }
const codeOf = text => (RE.exec(String(text || '').trim()) || [])[1]?.toLowerCase() || null;

async function send(pool, code, telegramId) {
    const url = process.env.LESSON_API_URL, secret = process.env.BOT_SHARED_SECRET;
    if (!url || !secret) return;
    let status = 0;
    try {
        const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(5000),
            headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ externalId: code, telegramUserId: Number(telegramId) }) });
        status = res.status;
        if (!res.ok) console.warn(`[lp-start] sayt javobi HTTP=${status}` + (status === 401 ? ' (parol xato)' : status === 400 ? ' (kod formati)' : ''));
    } catch (error) { console.warn('[lp-start] sayt javob bermadi:', error.name); }
    try { await pool.query('UPDATE domwork_lp_starts SET reported_at=NOW(),report_status=$2 WHERE code=$1', [code, status || null]); } catch { /* jim */ }
}

// handlers.js'dan chaqiriladi. Hech qachon xato tashlamaydi va hech narsani kutmaydi.
async function track(db, message) {
    try {
        const code = codeOf(message?.text);
        if (!code || message.chat?.type !== 'private' || message.from?.is_bot) return;
        const telegramId = String(message.from.id);
        // Savepoint: jadval yo'q yoki xato bo'lsa ham asosiy tranzaksiya buzilmaydi.
        await db.query('SAVEPOINT lp_start');
        let fresh = false;
        try {
            fresh = (await db.query('INSERT INTO domwork_lp_starts(code,telegram_id) VALUES($1,$2) ON CONFLICT(code) DO NOTHING RETURNING code', [code, telegramId])).rows.length > 0;
            await db.query('RELEASE SAVEPOINT lp_start');
        } catch (error) { await db.query('ROLLBACK TO SAVEPOINT lp_start'); console.warn('[lp-start] saqlanmadi:', error.code || error.name); return; }
        if (fresh) setTimeout(() => send(require('../../db').pool, code, telegramId), 1500); // tranzaksiya yopilgach
    } catch (error) { console.warn('[lp-start]', error.name); }
}
module.exports = { SCHEMA, init, track, codeOf };
