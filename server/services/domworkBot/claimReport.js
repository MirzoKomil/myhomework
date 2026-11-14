'use strict';
// 15-noy: ROP/admin — Telegram guruhidan menejerga avtomatik biriktirilgan lidlar (funnel.claimLead → extra_data.botClaim).
// Kabinetga kirganda bir marta oyna; «Tushundim» — shu foydalanuvchi uchun ko'rildi.
const HOW = { talk: '📞 Gaplashdi', na: '🔕 Javob yo‘q', later: '⏰ Keyinroq', trial: '✅ Sinovga yozdi', rej: '❌ Rad etdi', reply: '↩️ Bot orqali yozdi' };
let ready = null;
const init = db => ready || (ready = db.query(`CREATE TABLE IF NOT EXISTS domwork_bot_claim_seen (user_id TEXT PRIMARY KEY, seen_at TIMESTAMPTZ NOT NULL)`).catch(e => { ready = null; throw e; }));
function allowed(user) { if (!['rop', 'admin'].includes(user?.role)) { const e = new Error('Ruxsat yo‘q'); e.status = 403; throw e; } }
async function list(db, user) {
    allowed(user); await init(db);
    const seen = (await db.query('SELECT seen_at FROM domwork_bot_claim_seen WHERE user_id=$1', [String(user.id)])).rows[0]?.seen_at;
    const rows = (await db.query(`SELECT l.id,l.name,l.source,l.lead_type,l.status,l.extra_data->'botClaim' AS c,l.extra_data->>'utmSource' AS utm,l.extra_data->>'country' AS country
        FROM leads l WHERE l.language='russian' AND l.deleted_at IS NULL AND l.extra_data ? 'botClaim'
        AND (l.extra_data->'botClaim'->>'at')::timestamptz > COALESCE($1::timestamptz, NOW()-INTERVAL '2 days')
        ORDER BY (l.extra_data->'botClaim'->>'at')::timestamptz DESC LIMIT 100`, [seen || null])).rows;
    return { items: rows.map(r => ({ id: r.id, name: r.name, manager: r.c?.name || '', how: HOW[r.c?.how] || r.c?.how || '', at: r.c?.at,
        moved: r.c?.from === 'yangi-lidlar' && r.c?.how !== 'na', source: r.utm || r.source || '', target: r.lead_type === 'target', ru: r.country === 'ru' })) };
}
async function markSeen(db, user) {
    allowed(user); await init(db);
    await db.query(`INSERT INTO domwork_bot_claim_seen(user_id,seen_at) VALUES($1,NOW()) ON CONFLICT(user_id) DO UPDATE SET seen_at=NOW()`, [String(user.id)]);
    return { ok: true };
}
module.exports = { list, markSeen };
