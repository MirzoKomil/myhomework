'use strict';
const express = require('express');
const store = require('../services/domworkBot/store');
const queue = require('../services/domworkBot/queue');
const groups = require('../services/domworkGroups');
const controls = require('../services/domworkBot/controls');
const discovery = require('../services/domworkBot/discovery');
module.exports = function createRouter({ pool, runtime, authRequired }) {
    const router = express.Router();
    router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    const handle = fn => async (req, res) => {
        try { res.json(await fn(req)); }
        catch (error) {
            if (!error.status) console.error('[domwork-bot] route failed:', error.code || error.name);
            res.status(error.status || 500).json({ error: error.status ? error.message : 'Bot xizmatida xatolik' });
        }
    };
    // An acknowledged update is always durable; 503 makes Telegram retry safely.
    router.post('/webhook', handle(req => runtime.receive(req.body, req.get('X-Telegram-Bot-Api-Secret-Token'))));
    router.use(authRequired);
    router.use(async (req, res, next) => {
        try { await store.currentAdmin(pool, req.user); next(); }
        catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Bot xizmatida xatolik' }); }
    });
    router.get('/status', handle(() => runtime.status()));
    router.get('/discovery',handle(req=>discovery.list(pool,req.user)));
    router.post('/discovery/rescan',handle(req=>queue.transaction(pool,db=>discovery.rescan(db,req.user))));
    router.post('/discovery/confirm',handle(req=>discovery.confirm(pool,req.user,req.body?.items,(id,options)=>runtime.verifyChat(id,options))));
    router.get('/student-groups',handle(req=>discovery.studentCandidates(pool,req.user)));
    router.post('/student-groups/confirm',handle(req=>groups.assignStudents(pool,req.user,req.body?.items)));
    router.get('/my-telegram-link', handle(req => store.ownAdminLink(pool, req.user)));
    router.post('/my-telegram-link/unlink', handle(req => queue.transaction(pool, db => store.unlinkOwnAdmin(db, req.user, req.body))));
    router.get('/settings', handle(() => store.settings(pool)));
    router.put('/settings', handle(req => queue.transaction(pool,db => controls.saveSettings(db,req.user,req.body))));
    router.get('/bindings', handle(async () => ({groups:(await pool.query('SELECT id,type,chat_id,invite_link,active,revision,title FROM domwork_bot_groups ORDER BY type')).rows})));
    router.put('/bindings', handle(async req => {
        const input=controls.bindingInput(req.body);
        const verified=await runtime.verifyChat(input.chatId);
        return queue.transaction(pool,db=>controls.saveBinding(db,req.user,req.body,verified));
    }));
    router.post('/broadcasts/preview', handle(req => queue.transaction(pool,db=>controls.draft(db,req.user,req.body))));
    router.post('/broadcasts/:id/confirm', handle(req => queue.transaction(pool,db=>controls.confirmBroadcast(db,req.user,req.params.id,req.body?.fingerprint))));
    router.post('/broadcasts/:id/cancel', handle(req => queue.transaction(pool,db=>controls.confirmBroadcast(db,req.user,req.params.id,req.body?.fingerprint,true))));
    router.get('/broadcasts', handle(async()=>({broadcasts:(await pool.query(`SELECT b.id,b.actor_id,b.segment,b.state,b.scheduled_at,b.created_at,
        jsonb_array_length(b.recipients) AS recipient_count,
        (SELECT COUNT(*) FROM domwork_bot_outbox o WHERE o.payload->>'_broadcast'=b.id AND o.state='pending') AS pending
        FROM domwork_bot_broadcasts b ORDER BY b.created_at DESC LIMIT 30`)).rows})));
    router.get('/delivery-status', handle(async()=>({counts:(await pool.query('SELECT state,COUNT(*) AS count FROM domwork_bot_outbox GROUP BY state')).rows,
        failures:(await pool.query("SELECT id,state,last_error,created_at FROM domwork_bot_outbox WHERE state IN ('failed','uncertain') ORDER BY created_at DESC LIMIT 30")).rows})));
    router.get('/leave-requests', handle(async()=>({requests:(await pool.query(`SELECT l.id,l.reason,l.start_date,l.end_date,l.state,h.name
        FROM domwork_bot_leave_requests l LEFT JOIN hr_employees h ON h.id=l.employee_id ORDER BY l.created_at DESC LIMIT 100`)).rows})));
    router.post('/leave-requests/:id/review', handle(req=>queue.transaction(pool,db=>controls.reviewLeave(db,req.user,req.params.id,req.body?.state))));
    router.post('/webhook/setup', handle(req => runtime.setupWebhook(req.user, { replace: req.body?.replace === true })));
    router.get('/observed-chats', handle(async () => ({ chats: (await pool.query('SELECT chat_id,title,bot_status,observed_at FROM domwork_bot_seen_chats ORDER BY observed_at DESC LIMIT 100')).rows })));
    router.post('/learning-groups/:id/verify', handle(async req => {
        const before = (await pool.query('SELECT * FROM domwork_learning_groups WHERE id=$1 AND NOT archived', [req.params.id])).rows[0];
        if (!before?.chat_id) throw Object.assign(Error('Guruhning chat_id qiymatini avval kiriting'), { status: 400 });
        const verified = await runtime.verifyChat(before.chat_id, { trial: before.type === 'trial' });
        return queue.transaction(pool, async db => {
            await store.currentAdmin(db, req.user);
            const current = (await db.query('SELECT * FROM domwork_learning_groups WHERE id=$1 FOR UPDATE', [before.id])).rows[0];
            if (current?.revision !== before.revision || current.archived) throw Object.assign(Error('Guruh o‘zgartirilgan. Yangilang'), { status: 409 });
            const after = (await db.query('UPDATE domwork_learning_groups SET verified_at=NOW(),revision=revision+1,updated_by=$2,updated_at=NOW() WHERE id=$1 RETURNING *', [before.id,req.user.id])).rows[0];
            await store.audit(db, req.user.id, 'learning-group-verified', before.id, verified);
            return { group: groups.dto(after) };
        });
    }));
    return router;
};
