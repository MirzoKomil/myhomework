'use strict';
// Jarimalar API: /api/fines (dizayn J01–J09)
const express = require('express');

module.exports = function finesRouter({ pool, authRequired }) {
    const service = require('../services/fines');
    const att = require('../services/staffAttendance');
    const router = express.Router();
    router.use(authRequired);
    router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
    const handle = fn => async (req, res) => {
        try { res.json(await fn(req)); }
        catch (e) {
            if (!e.status) console.error('[fines]', e.message);
            res.status(e.status || 500).json({ error: e.status ? e.message : 'Jarima amalini bajarib boʻlmadi. Qayta urinib koʻring' });
        }
    };
    const tx = fn => req => att.transaction(pool, db => fn(db, req));

    router.get('/me', handle(req => service.mine(pool, req.user, String(req.query.month || ''))));
    router.get('/me/unseen', handle(req => service.unseen(pool, req.user)));
    router.post('/me/seen', handle(req => service.markSeen(pool, req.user, req.body?.ids)));
    router.post('/me/wash', handle(req => service.requestWash(pool, req.user, req.body || {})));
    router.get('/counts', handle(req => service.counts(pool, req.user)));
    router.get('/employee/:id', handle(req => service.mine(pool, req.user, String(req.query.month || ''), new Date(), { employeeId: req.params.id })));
    router.get('/team', handle(req => service.team(pool, req.user)));
    router.get('/appeals', handle(req => service.appeals(pool, req.user)));
    router.get('/:id', handle(req => service.detail(pool, req.user, req.params.id)));
    router.post('/:id/appeal', handle(req => service.appeal(pool, req.user, req.params.id, req.body?.text)));
    router.post('/:id/appeal/answer', handle(tx((db, req) => service.answerAppeal(db, req.user, req.params.id, req.body || {}))));
    router.post('/', handle(req => service.issue(pool, req.user, req.body || {})));
    router.get('/washes/inbox', handle(req => service.washInbox(pool, req.user, req.query.tab === 'history' ? 'history' : 'pending')));
    router.post('/washes/:id/decide', handle(tx((db, req) => service.decideWash(db, req.user, req.params.id, req.body || {}))));
    router.get('/admin/config', handle(req => service.getConfig(pool, req.user)));
    router.put('/admin/config', handle(tx((db, req) => service.saveConfig(db, req.user, req.body || {}))));
    router.post('/admin/totals', handle(req => service.monthTotals(pool, req.user, String(req.body?.month || ''), req.body?.salaries || {})));
    return router;
};
