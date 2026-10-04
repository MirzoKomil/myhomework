const express = require('express');
const { authRequired } = require('../middleware/auth');
const { pool } = require('../db');
const service = require('../services/inflow');
const history = require('../services/paymentHistory');
const cash = require('../services/paymentCash');
const router = express.Router();
router.use(authRequired);
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
const handle = fn => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (e) { console.error('[inflow]', e.message); res.status(e.status || 500).json({ error: e.status ? e.message : 'To‘lovni saqlab bo‘lmadi. Qayta urinib ko‘ring' }); }
};
router.get('/', handle(req => service.transaction(pool, db => service.list(db, req.user, req.query))));
router.get('/cash-reconciliation', handle(req => service.transaction(pool, db => cash.list(db, req.user))));
router.post('/cash-reconciliation', handle(req => cash.decide(pool, req.user, req.body || {})));
router.get('/students/:id/history', handle(req => service.transaction(pool, async db => {
    const { student } = await service.previewStudent(db, req.user, req.params.id);
    return { student, ...await history.forStudent(db, student) };
})));
router.get('/students/:id', handle(req => service.transaction(pool, db => service.previewStudent(db, req.user, req.params.id))));
router.post('/', handle(req => service.receive(pool, req.user, req.body || {})));
module.exports = router;
