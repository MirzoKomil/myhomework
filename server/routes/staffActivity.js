'use strict';
// Platformadagi faollik — /api/staff-activity (services/staffActivity.js).
const express = require('express');

module.exports = ({ pool, authRequired }) => {
    const router = express.Router();
    const svc = () => require('../services/staffActivity');
    const handle = fn => async (req, res) => {
        try { res.set('Cache-Control', 'no-store'); res.json(await fn(req)); }
        catch (e) { if (!e.status) console.error('[faollik]', e); res.status(e.status || 500).json({ error: e.status ? e.message : 'Faollik maʼlumotini olib boʻlmadi' }); }
    };
    // Brauzer har daqiqada faol daqiqalarni yuboradi (js/faollik.js).
    router.post('/ping', express.json({ limit: '64kb' }), authRequired, handle(req => svc().ping(pool, req.user, req.body || {})));
    router.get('/me', authRequired, handle(req => svc().me(pool, req.user, req.query || {})));
    router.get('/team', authRequired, handle(req => svc().team(pool, req.user, req.query || {})));
    router.get('/person/:id', authRequired, handle(req => svc().person(pool, req.user, req.params.id, req.query || {})));
    return router;
};
