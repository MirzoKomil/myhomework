'use strict';
const policy = require('./policy');

function validUpdate(update) {
    if (!update || !Number.isSafeInteger(update.update_id) || update.update_id < 0 || JSON.stringify(update).length > 131072)
        throw policy.error(400, 'Telegram update noto‘g‘ri');
    if (!update.message && !update.callback_query && !update.my_chat_member && !update.chat_member)
        throw policy.error(400, 'Telegram update turi qo‘llanmaydi');
    return update;
}
async function receive(db, update) {
    validUpdate(update);
    const result = await db.query(`INSERT INTO domwork_bot_updates(update_id,payload) VALUES($1,$2)
        ON CONFLICT(update_id) DO NOTHING RETURNING update_id`, [update.update_id, JSON.stringify(require('./studentLink').redact(update))]);
    return { accepted: true, duplicate: result.rows.length === 0 };
}
async function transaction(pool, fn) {
    const db = await pool.connect();
    const postCommit=[];
    db.domworkCommitTasks=postCommit;
    db.domworkAfterCommit=fn=>postCommit.push(fn);
    try { await db.query('BEGIN'); const result = await fn(db); await db.query('COMMIT');
        for(const work of postCommit) { try {await work();} catch { /* Cache failure cannot undo a committed CRM transaction. */ } }
        return result; }
    catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { delete db.domworkAfterCommit; delete db.domworkRedis; delete db.domworkCommitTasks; db.release(); }
}
// A single session advisory lock serializes all inbound updates across replicas.
// The claim, CRM changes, session state and response outbox commit together.
async function processOne(pool, handler) {
    return transaction(pool, async db => {
        const lock = (await db.query("SELECT pg_try_advisory_xact_lock(hashtext('domwork-bot-inbox')) AS locked")).rows[0];
        if (!lock.locked) return false;
        const row = (await db.query(`SELECT * FROM domwork_bot_updates WHERE state='pending' AND next_attempt<=NOW()
            ORDER BY update_id LIMIT 1 FOR UPDATE SKIP LOCKED`)).rows[0];
        if (!row) return false;
        // Roll back all handler writes on retry, including callbacks and replies.
        await db.query('SAVEPOINT bot_handler');
        const cacheTasks=db.domworkCommitTasks.length;
        try {
            await handler(db, row.payload);
            await db.query("UPDATE domwork_bot_updates SET state='done',payload='{}',attempts=attempts+1 WHERE update_id=$1", [row.update_id]);
        } catch (error) {
            await db.query('ROLLBACK TO SAVEPOINT bot_handler');
            db.domworkCommitTasks.splice(cacheTasks);
            const failed = row.attempts >= 4;
            await db.query(`UPDATE domwork_bot_updates SET attempts=attempts+1,state=$2,
                next_attempt=NOW()+INTERVAL '30 seconds',payload=CASE WHEN $2='failed' THEN '{}'::jsonb ELSE payload END
                WHERE update_id=$1`, [row.update_id, failed ? 'failed' : 'pending']);
            // Do not log payload, phone, message content, URL or exception.message.
            if (failed) console.error('[domwork-bot] inbox failed:', error.code || error.name);
        }
        return true;
    });
}
async function claimOutbox(pool) {
    return transaction(pool, async db => {
        // A transport timeout/crash can mean Telegram already sent the message.
        // Never retry such rows automatically (Telegram has no idempotency key).
        await db.query("UPDATE domwork_bot_outbox SET state='uncertain',last_error='lease-expired' WHERE state='working' AND lease_until<NOW()");
        return (await db.query(`UPDATE domwork_bot_outbox SET state='working',attempts=attempts+1,lease_until=NOW()+INTERVAL '60 seconds'
            WHERE id=(SELECT id FROM domwork_bot_outbox WHERE state='pending' AND not_before<=NOW()
                ORDER BY not_before,created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`)).rows[0] || null;
    });
}
function failure(error) {
    const code = Number(error?.response?.error_code);
    const retryAfter = Number(error?.response?.parameters?.retry_after);
    if (code === 429 && Number.isFinite(retryAfter) && retryAfter > 0) return { state: 'pending', seconds: Math.min(retryAfter, 86400), reason: 'telegram-rate-limit' };
    if (code >= 400 && code < 500) return { state: 'failed', seconds: 0, reason: 'telegram-rejected-' + code };
    return { state: 'uncertain', seconds: 0, reason: 'transport-outcome-unknown' };
}
async function settle(db, id, state, reason = '', seconds = 0) {
    await db.query(`UPDATE domwork_bot_outbox SET state=$2,last_error=$3,lease_until=NULL,
        not_before=NOW()+($4::int*INTERVAL '1 second'),sent_at=CASE WHEN $2='sent' THEN NOW() ELSE sent_at END,
        payload=CASE WHEN $2 IN ('sent','failed','cancelled') THEN '{}'::jsonb ELSE payload END
        WHERE id=$1 AND state='working'`, [id, state, reason, seconds]);
}
module.exports = { validUpdate, receive, transaction, processOne, claimOutbox, failure, settle };
