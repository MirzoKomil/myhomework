const express = require('express');
const { authRequired } = require('../middleware/auth');
const { pool } = require('../db');
const service = require('../services/finance');
const router = express.Router();
router.use(authRequired);
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
const handle = fn => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (e) {
        console.error('[finance]', e.message);
        const status = e.status || (e.code === '23505' ? 409 : e.code === '40001' ? 409 : 500);
        res.status(status).json({ error: e.status ? e.message : status === 409 ? 'Ma’lumot bir vaqtda o‘zgardi. Sahifani yangilab qayta urinib ko‘ring' : 'Moliya amalini bajarib bo‘lmadi. Qayta urinib ko‘ring' });
    }
};
router.get('/overview', handle(req => service.overview(pool, req.user, req.query)));
router.get('/cashbook', handle(req => service.cashbook(pool, req.user, req.query)));
router.get('/transactions', handle(req => service.listTransactions(pool, req.user, req.query)));
router.post('/transactions', handle(req => service.createTransaction(pool, req.user, req.body || {})));
router.post('/transactions/:id/reverse', handle(req => service.reverseTransaction(pool, req.user, req.params.id, req.body || {})));
router.post('/payables', handle(req => service.createPayable(pool, req.user, req.body || {})));
router.post('/payables/:id/void', handle(req => service.voidPayable(pool, req.user, req.params.id, req.body || {})));
router.post('/salaries/:id/cash-out', handle(req => service.recordSalaryPayment(pool, req.user, req.params.id, req.body || {})));
router.post('/receipts/void', handle(req => service.voidReceipts(pool, req.user, req.body || {})));
router.post('/receipts/manual', handle(req => service.manualReceipt(pool, req.user, req.body || {})));
router.post('/reconcile', handle(req => service.reconcile(pool, req.user, req.body || {})));
router.post('/accounts', handle(req => service.saveAccount(pool, req.user, req.body || {})));
router.post('/accounts/:id/checks', handle(req => service.addAccountCheck(pool, req.user, req.params.id, req.body || {})));
router.post('/periods', handle(req => service.lockMonth(pool, req.user, req.body || {})));
router.put('/settings', handle(req => service.saveSettings(pool, req.user, req.body || {})));
router.get('/audit', handle(req => service.auditLog(pool, req.user, req.query)));
module.exports = router;
