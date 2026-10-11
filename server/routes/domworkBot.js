'use strict';
const express = require('express');
const store = require('../services/domworkBot/store');
const queue = require('../services/domworkBot/queue');
const groups = require('../services/domworkGroups');
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
