'use strict';
// Xodimni @Domworkuz_bot'ga telefon raqamisiz ulash (CRM → Profil → Bildirishnomalar → Telegram bot).
// O'quvchi ulanishi (studentLink.js) bilan bir xil xavfsiz sxema:
//   1) CRMga kirgan xodim bir martalik havola yaratadi (5 daqiqa, 256-bit, bazada faqat hash);
//   2) Telegramda Start bosadi — bot hisobni "da'vo qiladi", lekin hali hech narsa ochmaydi;
//   3) xodim CRMga qaytib, Telegram ismi/username'ini ko'rib, o'zi tasdiqlaydi.
// Telefon raqami mos kelishi shart emas: tasdiq domwork_staff_telegram_proofs'ga yoziladi.
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const policy = require('./policy');
const queue = require('./queue');
const SCHEMA = `
CREATE TABLE IF NOT EXISTS domwork_staff_telegram_requests (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_jti TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','claimed','confirmed','cancelled')),
 telegram_id TEXT, telegram_name TEXT NOT NULL DEFAULT '', telegram_username TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL,
 claimed_at TIMESTAMPTZ, confirmed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS domwork_staff_telegram_request_owner ON domwork_staff_telegram_requests(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS domwork_staff_telegram_proofs (
 user_id TEXT PRIMARY KEY, telegram_id TEXT NOT NULL UNIQUE, verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;
const PREFIX = 'ul_';
const hash = raw => createHash('sha256').update(raw).digest('hex');
async function init(db) { await db.query(SCHEMA); }

// Faqat joriy sessiyasi tirik, bloklanmagan va bot rollaridan biriga mos xodim.
async function owner(db, actor) {
    if (!actor || actor.role === 'student' || actor.studentId || typeof actor.id !== 'string' || !actor.jti)
        throw policy.error(403, 'Xodim akkauntingiz bilan CRMga kiring');
    if (!(await db.query('SELECT 1 FROM sessions WHERE user_id=$1 AND jti=$2 FOR SHARE', [actor.id, actor.jti])).rows.length)
        throw policy.error(401, 'Sessiya yakunlangan. Qayta kiring');
    const store = require('./store');
    const rows = (await db.query(store.USER_SQL + ' WHERE u.id=$1 AND u.disabled_at IS NULL', [actor.id])).rows;
    if (rows.length > 1) throw policy.error(409, 'Akkaunt bir nechta HR profiliga bog‘langan. Administrator tekshirsin');
    const identity = rows[0] && store.staff(rows[0], policy.phone(rows[0].phone));
    if (!identity) throw policy.error(403, 'Bot hozircha rus tili bo‘limi xodimlari va administratorlar uchun. HR profilingizni tekshiring');
    return identity;
}
async function existing(db, userId) {
    return (await db.query("SELECT telegram_id FROM domwork_bot_links WHERE account_kind='user' AND account_id=$1", [userId])).rows[0] || null;
}
function requestDto(row) {
    return row ? { id: row.id, state: row.state, expired: new Date(row.expires_at).getTime() <= Date.now(), expiresAt: row.expires_at,
        telegram: row.state === 'claimed' ? { id: row.telegram_id, name: row.telegram_name, username: row.telegram_username } : null } : null;
}
async function status(pool, actor) {
    return queue.transaction(pool, async db => {
        const me = await owner(db, actor);
        let link = await existing(db, me.id);
        if (link) { const live = await require('./store').identity(db, link.telegram_id); if (!(live?.kind === 'user' && live.id === me.id)) link = null; }
        const row = (await db.query('SELECT * FROM domwork_staff_telegram_requests WHERE user_id=$1 AND session_jti=$2 ORDER BY created_at DESC LIMIT 1',
            [me.id, actor.jti])).rows[0];
        let telegram = null;
        if (link) {
            const proof = (await db.query(`SELECT r.telegram_name,r.telegram_username FROM domwork_staff_telegram_requests r
                WHERE r.user_id=$1 AND r.telegram_id=$2 AND r.state='confirmed' ORDER BY r.confirmed_at DESC LIMIT 1`, [me.id, link.telegram_id])).rows[0];
            telegram = { name: proof?.telegram_name || '', username: proof?.telegram_username || '' };
        }
        return { linked: !!link, telegram, role: me.role, request: requestDto(row) };
    });
}
async function create(pool, actor) {
    return queue.transaction(pool, async db => {
        await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-bot-links'))");
        const me = await owner(db, actor);
        const before = await existing(db, me.id);
        if (before) {
            // Buzilgan ulanish (bot endi bu xodimni tanimaydi: raqam o'zgargan va h.k.) — ulanmagan deb hisoblanadi va yangilanadi.
            const live = await require('./store').identity(db, before.telegram_id);
            if (live?.kind === 'user' && live.id === me.id) throw policy.error(409, 'Telegram allaqachon ulangan. Almashtirish uchun avval uzing');
            await db.query("DELETE FROM domwork_bot_links WHERE account_kind='user' AND account_id=$1", [me.id]);
            await db.query('DELETE FROM domwork_staff_telegram_proofs WHERE user_id=$1', [me.id]);
            await require('./store').audit(db, me.id, 'staff-telegram-stale-link-removed', me.id, { telegramId: before.telegram_id });
        }
        const recent = (await db.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE created_at>NOW()-INTERVAL '10 seconds')::int AS fast
            FROM domwork_staff_telegram_requests WHERE user_id=$1 AND created_at>NOW()-INTERVAL '1 hour'`, [me.id])).rows[0];
        if (recent.fast || recent.total >= 20) throw policy.error(429, 'Biroz kutib qayta urinib ko‘ring');
        await db.query("UPDATE domwork_staff_telegram_requests SET state='cancelled' WHERE user_id=$1 AND state IN ('pending','claimed')", [me.id]);
        const raw = randomBytes(32).toString('base64url'), id = randomUUID();
        const row = (await db.query(`INSERT INTO domwork_staff_telegram_requests(id,user_id,session_jti,token_hash,expires_at)
            VALUES($1,$2,$3,$4,NOW()+INTERVAL '5 minutes') RETURNING *`, [id, me.id, actor.jti, hash(raw)])).rows[0];
        await require('./store').audit(db, me.id, 'staff-telegram-request', id);
        const url = 'https://t.me/Domworkuz_bot?start=' + PREFIX + raw;
        return { request: requestDto(row), url, qr: require('./qr').qrPath(url) };
    });
}
function startHash(command) {
    const raw = /^\/start(?:@Domworkuz_bot)? ul_([A-Za-z0-9_-]{43})$/i.exec(command || '');
    return raw ? hash(raw[1]) : null;
}
async function claim(db, message) {
    const telegramId = policy.telegramId(message?.from?.id);
    const tokenHash = /^[a-f0-9]{64}$/.test(message?._staffLinkHash || '') ? message._staffLinkHash : startHash(message?.text);
    if (!telegramId || message.chat?.type !== 'private' || String(message.chat.id) !== telegramId || message.from.is_bot || message.forward_origin || !tokenHash)
        throw policy.error(400, 'Ulash havolasini o‘z Telegramingizda oching');
    await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-bot-links'))");
    const row = (await db.query(`SELECT * FROM domwork_staff_telegram_requests WHERE token_hash=$1 AND state IN ('pending','claimed')
        AND expires_at>NOW() FOR UPDATE`, [tokenHash])).rows[0];
    if (!row) throw policy.error(410, 'Havola eskirgan. CRMdan yangi havola oling');
    await owner(db, { id: row.user_id, role: 'staff', jti: row.session_jti });
    if (row.state === 'claimed' && row.telegram_id !== telegramId) throw policy.error(409, 'Bu havola ishlatilgan. CRMdan yangi havola oling');
    const occupied = (await db.query('SELECT account_kind,account_id FROM domwork_bot_links WHERE telegram_id=$1', [telegramId])).rows[0];
    // Telegram avval lid sifatida ulangan bo'lsa (xodim botni oldin oddiy mehmon kabi ochgan) — tasdiqlashda xodimga o'tadi.
    if (occupied && occupied.account_kind !== 'lead' && !(occupied.account_kind === 'user' && occupied.account_id === row.user_id))
        throw policy.error(409, 'Bu Telegram hisobi boshqa CRM akkauntiga bog‘langan. Administrator ajratsin');
    if (row.state === 'pending') await db.query(`UPDATE domwork_staff_telegram_requests SET state='claimed',telegram_id=$2,telegram_name=$3,
        telegram_username=$4,claimed_at=NOW() WHERE id=$1`, [row.id, telegramId,
        String([message.from.first_name, message.from.last_name].filter(Boolean).join(' ')).slice(0, 160), String(message.from.username || '').slice(0, 64)]);
    // CRMda tasdiqlanmaguncha bot hech qanday xodim ma'lumotini ochmaydi.
    return { ok: true };
}
async function confirm(pool, actor, input = {}) {
    return queue.transaction(pool, async db => {
        await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-bot-links'))");
        const me = await owner(db, actor), telegramId = policy.telegramId(input.telegramId);
        if (typeof input.requestId !== 'string' || !telegramId) throw policy.error(400, 'Telegram hisobini tekshirib tasdiqlang');
        const row = (await db.query(`SELECT *,expires_at>NOW() AS valid FROM domwork_staff_telegram_requests
            WHERE id=$1 AND user_id=$2 AND session_jti=$3 FOR UPDATE`, [input.requestId, me.id, actor.jti])).rows[0];
        if (!row || row.state !== 'claimed' || !row.valid || row.telegram_id !== telegramId)
            throw policy.error(409, 'Ulash so‘rovi eskirgan yoki o‘zgargan. Qayta urinib ko‘ring');
        const occupied = (await db.query('SELECT account_kind,account_id FROM domwork_bot_links WHERE telegram_id=$1', [telegramId])).rows[0];
        if (await existing(db, me.id)) throw policy.error(409, 'Telegram allaqachon ulangan');
        if (occupied && occupied.account_kind !== 'lead') throw policy.error(409, 'Bu Telegram hisobi boshqa CRM akkauntiga bog‘langan');
        if (occupied) await db.query('DELETE FROM domwork_bot_links WHERE telegram_id=$1', [telegramId]);
        await db.query("INSERT INTO domwork_bot_links(telegram_id,account_kind,account_id,phone) VALUES($1,'user',$2,$3)", [telegramId, me.id, me.phone || '']);
        await db.query(`INSERT INTO domwork_staff_telegram_proofs(user_id,telegram_id) VALUES($1,$2)
            ON CONFLICT(user_id) DO UPDATE SET telegram_id=EXCLUDED.telegram_id,verified_at=NOW()`, [me.id, telegramId]);
        await db.query("UPDATE domwork_staff_telegram_requests SET state='confirmed',confirmed_at=NOW() WHERE id=$1", [row.id]);
        const store = require('./store');
        await store.audit(db, me.id, 'staff-telegram-confirmed', row.id, { telegramId, method: 'crm', replacedLead: occupied?.account_id || null });
        const identity = await store.identity(db, telegramId);
        if (identity) {
            const { keyboard } = require('./handlers');
            await store.enqueue(db, { key: 'staff-link:' + row.id, targetId: telegramId, role: identity.role, account: identity,
                payload: { chat_id: telegramId, text: `Assalomu alaykum, ${String(identity.name || '').slice(0, 80)}! Telegram CRM akkauntingizga ulandi. Kerakli bo‘limni tanlang.`, reply_markup: keyboard(identity) } });
        }
        return { ok: true };
    });
}
async function cancel(pool, actor, input = {}) {
    return queue.transaction(pool, async db => {
        const me = await owner(db, actor);
        if (typeof input.requestId !== 'string') throw policy.error(400, 'Ulash so‘rovini tanlang');
        await db.query(`UPDATE domwork_staff_telegram_requests SET state='cancelled' WHERE id=$1 AND user_id=$2 AND session_jti=$3
            AND state IN ('pending','claimed')`, [input.requestId, me.id, actor.jti]);
        return { ok: true };
    });
}
// Xodim o'z Telegramini o'zi uzadi (masalan, yangi telefon). Tarix auditda qoladi.
async function unlink(pool, actor) {
    return queue.transaction(pool, async db => {
        await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-bot-links'))");
        const me = await owner(db, actor);
        const before = (await db.query("DELETE FROM domwork_bot_links WHERE account_kind='user' AND account_id=$1 RETURNING telegram_id", [me.id])).rows[0];
        await db.query('DELETE FROM domwork_staff_telegram_proofs WHERE user_id=$1', [me.id]);
        if (before) await db.query('DELETE FROM domwork_bot_sessions WHERE telegram_id=$1', [before.telegram_id]);
        await require('./store').audit(db, me.id, 'staff-telegram-unlinked', me.id, { telegramId: before?.telegram_id || null });
        return { ok: true };
    });
}
module.exports = { SCHEMA, PREFIX, init, owner, status, create, startHash, claim, confirm, cancel, unlink };
