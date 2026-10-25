const express = require('express');
const multer = require('multer');
const { authRequired } = require('../middleware/auth');
const { pool } = require('../db');
const service = require('../services/finance');
const router = express.Router();
// Moliyaviy hujjatlar ommaviy /uploads papkasiga emas, faqat avtorizatsiya bilan o'qiladigan joyga saqlanadi.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });
router.use(authRequired);
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
const handle = fn => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (e) {
        console.error('[finance]', e.message);
        const status = e.status || (e.code === '23505' ? 409 : e.code === '40001' ? 409 : 500);
        res.status(status).json({ error: e.status ? e.message : status === 409 ? 'Ma’lumot bir vaqtda o‘zgardi. Sahifani yangilab qayta urinib ko‘ring' : 'Moliya amalini bajarib bo‘lmadi. Qayta urinib ko‘ring', issues: e.issues });
    }
};
router.get('/overview', handle(req => service.overview(pool, req.user, req.query)));
router.get('/cashbook', handle(req => service.cashbook(pool, req.user, req.query)));
router.get('/transactions', handle(req => service.listTransactions(pool, req.user, req.query)));
router.get('/people', handle(req => service.people(pool, req.user, req.query)));
router.get('/close-status', handle(req => service.closeStatus(pool, req.user, req.query)));
router.post('/transactions', handle(req => service.createTransaction(pool, req.user, req.body || {})));
router.post('/transactions/:id/reverse', handle(req => service.reverseTransaction(pool, req.user, req.params.id, req.body || {})));
router.post('/payables', handle(req => service.createPayable(pool, req.user, req.body || {})));
router.post('/payables/:id/void', handle(req => service.voidPayable(pool, req.user, req.params.id, req.body || {})));
router.post('/salaries/:id/cash-out', handle(req => service.recordSalaryPayment(pool, req.user, req.params.id, req.body || {})));
router.post('/receipts/void', handle(req => service.voidReceipts(pool, req.user, req.body || {})));
router.post('/receipts/manual', handle(req => service.manualReceipt(pool, req.user, req.body || {})));
router.post('/receipts/batch', handle(req => service.batchCorrections(pool, req.user, req.body || {})));
router.post('/reconcile', handle(req => service.reconcile(pool, req.user, req.body || {})));
router.post('/accounts', handle(req => service.saveAccount(pool, req.user, req.body || {})));
router.post('/accounts/:id/checks', handle(req => service.addAccountCheck(pool, req.user, req.params.id, req.body || {})));
router.post('/periods', handle(req => service.lockMonth(pool, req.user, req.body || {})));
router.put('/settings', handle(req => service.saveSettings(pool, req.user, req.body || {})));
router.get('/audit', handle(req => service.auditLog(pool, req.user, req.query)));
router.post('/evidence', (req, res, next) => upload.single('file')(req, res, err => err ? res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Fayl 15 MB dan oshmasin' : 'Faylni yuklab bo‘lmadi' }) : next()),
    handle(req => service.storeEvidence(pool, req.user, req.file)));
router.get('/evidence/:id', async (req, res) => {
    try {
        const file = await service.readEvidence(pool, req.user, req.params.id);
        res.set('Content-Type', file.mime);
        res.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
        res.set('X-Content-Type-Options', 'nosniff');
        res.sendFile(file.path);
    } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Hujjatni ochib bo‘lmadi' }); }
});
module.exports = router;
