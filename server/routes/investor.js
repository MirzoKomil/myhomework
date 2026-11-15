// Investor moduli: rahbar — sozlash, to'lov, tuzatish; investor roli — faqat o'z kabineti (faqat ko'rish).
const express = require('express');
const { authRequired } = require('../middleware/auth');
const { pool } = require('../db');
const service = require('../services/investor');
const router = express.Router();
router.use(authRequired);
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
const handle = fn => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (e) {
        console.error('[investor]', e.message);
        const status = e.status || (e.code === '23505' ? 409 : 500);
        res.status(status).json({ error: e.status ? e.message : status === 409 ? 'Ma’lumot bir vaqtda o‘zgardi. Qayta urinib ko‘ring' : 'Investor amalini bajarib bo‘lmadi' });
    }
};
router.get('/', handle(req => service.view(pool, req.user)));
router.get('/months/:month', handle(req => service.monthDetail(pool, req.user, req.params.month)));
router.put('/settings', handle(req => service.saveSettings(pool, req.user, req.body || {})));
router.post('/payments', handle(req => service.addPayment(pool, req.user, req.body || {})));
router.post('/payments/:id/reverse', handle(req => service.reversePayment(pool, req.user, req.params.id, req.body || {})));
router.post('/account', handle(req => service.saveAccount(pool, req.user, req.body || {})));
module.exports = router;
