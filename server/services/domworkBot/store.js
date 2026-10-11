'use strict';
const { randomUUID } = require('node:crypto');
const policy = require('./policy');
const SCHEMA = `
CREATE OR REPLACE FUNCTION domwork_phone(value TEXT) RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
 SELECT CASE WHEN TRIM(COALESCE(value,'')) !~ '^[+]?[0-9[:space:]().-]+$' THEN ''
 WHEN LENGTH(digits)=9 AND LEFT(TRIM(COALESCE(value,'')),1)<>'+' THEN '998'||digits ELSE digits END
 FROM (SELECT REGEXP_REPLACE(COALESCE(value,''),'[^0-9]','','g') AS digits) p
$$;
CREATE TABLE IF NOT EXISTS domwork_bot_links (
 telegram_id TEXT PRIMARY KEY, account_kind TEXT NOT NULL CHECK(account_kind IN ('user','student','lead')),
 account_id TEXT NOT NULL, phone TEXT NOT NULL, paused BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(account_kind,account_id)
);
CREATE TABLE IF NOT EXISTS domwork_bot_groups (
 id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('trial','classroom','sales','marketing','teachers','family','beacon')),
 scope TEXT NOT NULL DEFAULT '', chat_id TEXT NOT NULL UNIQUE, invite_link TEXT NOT NULL DEFAULT '',
 active BOOLEAN NOT NULL DEFAULT TRUE, created_by TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(type,scope)
);
CREATE TABLE IF NOT EXISTS domwork_bot_settings (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), data JSONB NOT NULL, revision INTEGER NOT NULL DEFAULT 1
);
INSERT INTO domwork_bot_settings VALUES(1,'{"promotionsEnabled":false,"promotionIntervalMinutes":1440,"trialRemovalEnabled":false,"groupNotificationsEnabled":false,"courseText":"","platformText":"","resultsText":"","officialChannel":""}',1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS domwork_bot_updates (
 update_id BIGINT PRIMARY KEY, payload JSONB NOT NULL, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','working','done','failed')),
 attempts INTEGER NOT NULL DEFAULT 0, lease_until TIMESTAMPTZ, next_attempt TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS domwork_bot_sessions (
 telegram_id TEXT PRIMARY KEY, state JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS domwork_bot_callbacks (
 id TEXT PRIMARY KEY, data JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS domwork_bot_outbox (
 id TEXT PRIMARY KEY, unique_key TEXT NOT NULL UNIQUE, target_kind TEXT NOT NULL CHECK(target_kind IN ('private','group')),
 target_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', method TEXT NOT NULL, payload JSONB NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','working','sent','failed','uncertain','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0, lease_until TIMESTAMPTZ, not_before TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 last_error TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS domwork_outbox_pending ON domwork_bot_outbox(state,not_before);
CREATE INDEX IF NOT EXISTS domwork_updates_pending ON domwork_bot_updates(state,next_attempt,update_id);
CREATE TABLE IF NOT EXISTS domwork_bot_seen_chats (
 chat_id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', bot_status TEXT NOT NULL,
 observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS domwork_bot_events (
 event_key TEXT PRIMARY KEY, type TEXT NOT NULL, reference_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}',
 state TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS domwork_bot_audit (
 id BIGSERIAL PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL,
 data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS domwork_bot_leave_requests (
 id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, user_id TEXT NOT NULL, reason TEXT NOT NULL,
 start_date DATE NOT NULL, end_date DATE NOT NULL, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected')),
 reviewed_by TEXT, reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS domwork_bot_face_logs (
 event_id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('in','out')),
 occurred_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS domwork_bot_penalties (
 id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, amount BIGINT NOT NULL CHECK(amount>=0), reason TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
async function initSchema(db) { await db.query(SCHEMA); }
const USER_SQL = `SELECT u.id,u.name,u.email,u.role,u.phone,he.id AS employee_id,he.role AS employee_role,
 he.status AS employee_status,he.lang,he.dual_role,COALESCE(link.manager_id,he.id) AS manager_id
 FROM users u LEFT JOIN hr_employees he ON LOWER(TRIM(he.login))=LOWER(TRIM(u.email))
 LEFT JOIN user_sales_manager_links link ON link.user_id=u.id`;
function staff(row, number) {
    const role = policy.staffRole(row);
    const language = row.employee_role === 'rus-oqituvchi' ? 'russian' : row.employee_role === 'ingliz-oqituvchi' ? 'english' : row.lang;
    if (!role || (role !== 'admin' && (!row.employee_id || language !== 'russian'))) return null;
    return { id: row.id, kind: 'user', role, name: row.name, employeeId: row.employee_id,
        managerId: row.manager_id, dualRole: row.dual_role === true, phone: number, language: 'russian' };
}
function student(row, number) {
    return row.subject === 'russian' && policy.activeStudent(row)
        ? { id: row.id, kind: 'student', role: 'student', name: row.name, phone: number, language: 'russian' } : null;
}
async function phoneCandidates(db, number, includeStaff = true) {
    const candidates = [];
    if (includeStaff) {
        const rows = (await db.query(USER_SQL + ` WHERE domwork_phone(u.phone)=$1 OR domwork_phone(u.email)=$1 OR domwork_phone(he.phone)=$1`, [number])).rows;
        const employeeIds = new Map();
        for (const row of rows) {
            const ids = employeeIds.get(row.id) || new Set(); ids.add(row.employee_id || ''); employeeIds.set(row.id, ids);
            const identity = staff(row, number); if (identity) candidates.push(identity);
        }
        if ([...employeeIds.values()].some(ids => ids.size > 1)) throw policy.error(409, 'Xodim akkaunti bir nechta HR profiliga bog‘langan');
    }
    for (const row of (await db.query("SELECT id,name,phone,subject,extra_data FROM students WHERE subject='russian' AND domwork_phone(phone)=$1", [number])).rows) {
        const identity = student(row, number); if (identity) candidates.push(identity);
    }
    for (const row of (await db.query("SELECT id,name,phone FROM leads WHERE language='russian' AND status='sinov-darsida' AND deleted_at IS NULL AND domwork_phone(phone)=$1", [number])).rows) {
        candidates.push({ id: row.id, kind: 'lead', role: 'trial', name: row.name, phone: number, language: 'russian' });
    }
    return candidates;
}
async function audit(db, actorId, action, entityId, data = {}) {
    await db.query('INSERT INTO domwork_bot_audit(actor_id,action,entity_id,data) VALUES($1,$2,$3,$4)', [String(actorId), action, String(entityId), JSON.stringify(data)]);
}
async function linkContact(db, message) {
    const contact = policy.contactIdentity(message);
    // One lock covers phone and Telegram identity races, including lead upgrades.
    await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-bot-links'))");
    const existing = (await db.query('SELECT * FROM domwork_bot_links WHERE telegram_id=$1 FOR UPDATE', [contact.telegramId])).rows[0];
    const identity = policy.choose(await phoneCandidates(db, contact.phone));
    if (existing && (existing.account_kind !== identity.kind || existing.account_id !== identity.id)) {
        const upgrade = existing.account_kind === 'lead' && identity.kind === 'student' && existing.phone === contact.phone;
        if (!upgrade) throw policy.error(409, 'Telegram akkaunti boshqa CRM profiliga bog‘langan. Administrator ajratsin');
    }
    const used = (await db.query('SELECT telegram_id FROM domwork_bot_links WHERE account_kind=$1 AND account_id=$2', [identity.kind, identity.id])).rows[0];
    if (used && used.telegram_id !== contact.telegramId) throw policy.error(409, 'CRM akkaunti boshqa Telegram hisobiga bog‘langan');
    await db.query(`INSERT INTO domwork_bot_links(telegram_id,account_kind,account_id,phone) VALUES($1,$2,$3,$4)
        ON CONFLICT(telegram_id) DO UPDATE SET account_kind=EXCLUDED.account_kind,account_id=EXCLUDED.account_id,phone=EXCLUDED.phone,paused=false,updated_at=NOW()`,
        [contact.telegramId, identity.kind, identity.id, contact.phone]);
    await audit(db, contact.telegramId, 'contact-link', identity.id, { kind: identity.kind, role: identity.role });
    return { ...identity, telegramId: contact.telegramId, paused: false };
}
async function identity(db, telegramId) {
    if (!policy.telegramId(telegramId)) return null;
    const link = (await db.query('SELECT * FROM domwork_bot_links WHERE telegram_id=$1', [String(telegramId)])).rows[0];
    if (!link) return null;
    let current;
    if (link.account_kind === 'user') {
        const rows = (await db.query(USER_SQL + ' WHERE u.id=$1', [link.account_id])).rows;
        if (rows.length !== 1) return null;
        const matches = (await db.query(`SELECT u.id FROM users u LEFT JOIN hr_employees he ON LOWER(TRIM(he.login))=LOWER(TRIM(u.email))
            WHERE u.id=$1 AND (domwork_phone(u.phone)=$2 OR domwork_phone(u.email)=$2 OR domwork_phone(he.phone)=$2)`, [link.account_id, link.phone])).rows;
        if (!matches.length) return null;
        current = staff(rows[0], link.phone);
    } else if (link.account_kind === 'student') {
        const row = (await db.query('SELECT id,name,phone,subject,extra_data FROM students WHERE id=$1 AND domwork_phone(phone)=$2', [link.account_id, link.phone])).rows[0];
        current = row && student(row, link.phone);
    } else {
        // Lead -> paid student is the only automatic identity migration; no staff escalation.
        const candidates = await phoneCandidates(db, link.phone, false);
        const own = candidates.filter(c => c.kind === 'student' || c.id === link.account_id);
        if (!own.length) return null;
        current = policy.choose(own);
        if (current.kind === 'student') {
            await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-bot-links'))");
            const occupied = (await db.query('SELECT telegram_id FROM domwork_bot_links WHERE account_kind=$1 AND account_id=$2', ['student', current.id])).rows[0];
            if (occupied && occupied.telegram_id !== String(telegramId)) return null;
            await db.query("UPDATE domwork_bot_links SET account_kind='student',account_id=$2,updated_at=NOW() WHERE telegram_id=$1", [String(telegramId), current.id]);
            await audit(db, telegramId, 'trial-to-student', current.id);
        }
    }
    return current ? { ...current, telegramId: String(telegramId), paused: link.paused } : null;
}
async function session(db, telegramId) {
    return (await db.query('SELECT state FROM domwork_bot_sessions WHERE telegram_id=$1 AND expires_at>NOW()', [String(telegramId)])).rows[0]?.state || null;
}
async function setSession(db, telegramId, state) {
    if (!state) return db.query('DELETE FROM domwork_bot_sessions WHERE telegram_id=$1', [String(telegramId)]);
    await db.query(`INSERT INTO domwork_bot_sessions VALUES($1,$2,NOW()+INTERVAL '30 minutes')
        ON CONFLICT(telegram_id) DO UPDATE SET state=EXCLUDED.state,expires_at=EXCLUDED.expires_at`, [String(telegramId), JSON.stringify(state)]);
}
async function enqueue(db, { key, targetKind = 'private', targetId, role = '', method = 'sendMessage', payload, account, notBefore = new Date() }) {
    if (!['sendMessage','sendPhoto','sendVideo','sendVoice','sendDocument','answerCallbackQuery','editMessageReplyMarkup','unbanChatMember'].includes(method)) throw policy.error(400, 'Bot usuli noto‘g‘ri');
    if (!['private','group'].includes(targetKind) || !key || key.length > 200) throw policy.error(400, 'Xabar manzili noto‘g‘ri');
    if (targetKind === 'private' && !policy.telegramId(String(targetId))) throw policy.error(400, 'Telegram foydalanuvchisi noto‘g‘ri');
    const envelope = { ...payload, ...(account ? { _account: { kind: account.kind, id: account.id } } : {}) };
    await db.query(`INSERT INTO domwork_bot_outbox(id,unique_key,target_kind,target_id,role,method,payload,not_before)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(unique_key) DO NOTHING`, [randomUUID(), key, targetKind, String(targetId), role, method, JSON.stringify(envelope), notBefore]);
}
async function callback(db, data) {
    const id = randomUUID();
    await db.query("INSERT INTO domwork_bot_callbacks VALUES($1,$2,NOW()+INTERVAL '7 days')", [id, JSON.stringify(data)]);
    return 'dw:' + id;
}
async function settings(db) { return (await db.query('SELECT data,revision FROM domwork_bot_settings WHERE singleton=1')).rows[0]; }
async function currentAdmin(db, actor) {
    const row = (await db.query('SELECT id,role FROM users WHERE id=$1', [actor?.id])).rows[0];
    if (row?.role !== 'admin') throw policy.error(403, 'Faqat CRM administratori');
    return row;
}
module.exports = { SCHEMA, initSchema, staff, student, phoneCandidates, audit, linkContact, identity, session, setSession, enqueue, callback, settings, currentAdmin };
