'use strict';
// Landingdan ariza qoldirgan odamni @Domworkuz_bot'da telefon raqamisiz tanish.
// CRM lidni yaratganda bir martalik `ld_` havola beradi ("Rahmat" sahifasidagi tugma shu havolaga olib boradi).
// Havolani ochgan Telegram shu LIDGA ulanadi (faqat lid darajasi: hech qanday o'quvchi/xodim ma'lumoti yo'q).
// Bazada faqat SHA-256; 7 kun amal qiladi; bir marta ishlatiladi.
const { randomBytes, createHash } = require('node:crypto');
const policy = require('./policy');
const SCHEMA = `
CREATE TABLE IF NOT EXISTS domwork_lead_telegram_tokens (
 token_hash TEXT PRIMARY KEY, lead_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ, telegram_id TEXT
);
CREATE INDEX IF NOT EXISTS domwork_lead_telegram_tokens_lead ON domwork_lead_telegram_tokens(lead_id);`;
const PREFIX = 'ld_';
const hash = raw => createHash('sha256').update(raw).digest('hex');
async function init(db) { await db.query(SCHEMA); }
// Faqat rus tili lidlari uchun; jadval hali yo'q bo'lsa (bot o'chiq) — havola bermaydi.
async function issue(db, leadId) {
    if (!leadId || !(await db.query("SELECT to_regclass('domwork_lead_telegram_tokens') AS t")).rows[0]?.t) return null;
    const lead = (await db.query("SELECT id FROM leads WHERE id=$1 AND language='russian' AND deleted_at IS NULL", [leadId])).rows[0];
    if (!lead) return null;
    const raw = randomBytes(32).toString('base64url');
    await db.query("INSERT INTO domwork_lead_telegram_tokens(token_hash,lead_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '7 days')", [hash(raw), lead.id]);
    return 'https://t.me/Domworkuz_bot?start=' + PREFIX + raw;
}
function startHash(command) {
    const raw = /^\/start(?:@Domworkuz_bot)? ld_([A-Za-z0-9_-]{43})$/i.exec(command || '');
    return raw ? hash(raw[1]) : null;
}
// Natija: {lead} — ulandi yoki allaqachon shu lidga ulangan; null — havola eskirgan/ishlatilgan (mehmon sifatida davom etadi).
async function claim(db, message) {
    const telegramId = policy.telegramId(message?.from?.id);
    const tokenHash = /^[a-f0-9]{64}$/.test(message?._leadLinkHash || '') ? message._leadLinkHash : startHash(message?.text);
    if (!telegramId || message.chat?.type !== 'private' || String(message.chat.id) !== telegramId || message.from.is_bot || message.forward_origin || !tokenHash) return null;
    await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-bot-links'))");
    const row = (await db.query('SELECT * FROM domwork_lead_telegram_tokens WHERE token_hash=$1 FOR UPDATE', [tokenHash])).rows[0];
    if (!row || new Date(row.expires_at).getTime() <= Date.now()) return null;
    if (row.used_at && row.telegram_id !== telegramId) return null;
    const lead = (await db.query("SELECT id,name,phone,status FROM leads WHERE id=$1 AND language='russian' AND deleted_at IS NULL", [row.lead_id])).rows[0];
    if (!lead) return null;
    const occupied = (await db.query('SELECT account_kind,account_id FROM domwork_bot_links WHERE telegram_id=$1', [telegramId])).rows[0];
    // O'quvchi/xodim sifatida ulangan Telegram lidga tushirilmaydi.
    if (occupied && occupied.account_kind !== 'lead') return { lead, skipped: 'already-linked' };
    const taken = (await db.query("SELECT telegram_id FROM domwork_bot_links WHERE account_kind='lead' AND account_id=$1", [lead.id])).rows[0];
    if (taken && taken.telegram_id !== telegramId) return { lead, skipped: 'lead-has-other-telegram' };
    await db.query(`INSERT INTO domwork_bot_links(telegram_id,account_kind,account_id,phone) VALUES($1,'lead',$2,$3)
        ON CONFLICT(telegram_id) DO UPDATE SET account_kind='lead',account_id=EXCLUDED.account_id,phone=EXCLUDED.phone,updated_at=NOW()`,
        [telegramId, lead.id, policy.phone(lead.phone)]);
    await db.query('UPDATE domwork_lead_telegram_tokens SET used_at=COALESCE(used_at,NOW()),telegram_id=$2 WHERE token_hash=$1', [tokenHash, telegramId]);
    await require('./store').audit(db, telegramId, 'lead-telegram-linked', lead.id, { method: 'landing' });
    return { lead };
}
// Landing javobi uchun: bot va voronka yoqilgan bo'lsagina havola beriladi (aks holda "Rahmat" sahifasi eski tugmani ko'rsatadi).
async function issueIfEnabled(pool, leadId) {
    if (process.env.DOMWORK_BOT_ENABLED !== 'true') return null;
    try {
        if (!(await pool.query("SELECT to_regclass('domwork_bot_settings') AS t")).rows[0]?.t) return null;
        const settings = (await pool.query('SELECT data FROM domwork_bot_settings WHERE singleton=1')).rows[0]?.data;
        if (settings?.funnelEnabled !== true) return null;
        return await issue(pool, leadId);
    } catch (error) { console.error('[lead-link] issue failed:', error.code || error.name); return null; }
}
module.exports = { SCHEMA, PREFIX, init, issue, issueIfEnabled, startHash, claim };
