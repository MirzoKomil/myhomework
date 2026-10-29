'use strict';
// /api/domwork/staff-telegram — xodim o'z Telegramini @Domworkuz_bot'ga telefon raqamisiz ulaydi.
// Faqat joriy sessiyadagi xodimning o'zi; boshqa akkaunt ID'si hech qachon so'rovdan olinmaydi.
const express = require('express');
const link = require('../services/domworkBot/staffLink');
const activation = require('../services/domworkBot/staffActivation');
module.exports = function ({ pool, runtime, authRequired }) {
    const router = express.Router();
    router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer'); next(); });
    router.use(authRequired);
    const handle = fn => async (req, res) => {
        try { res.json(await fn(req)); }
        catch (error) {
            if (!error.status) console.error('[staff-telegram]', error.code || error.name);
            res.status(error.status || 500).json({ error: error.status ? error.message : 'Telegram ulanishida xatolik' });
        }
    };
    const ready = () => { if (runtime.status().state !== 'ready') throw Object.assign(Error('Bot hozir tayyor emas. Keyinroq urinib ko‘ring'), { status: 503 }); };
    router.get('/', handle(async req => ({ ...await link.status(pool, req.user), available: runtime.status().state === 'ready' })));
    router.post('/', handle(req => { ready(); return link.create(pool, req.user); }));
    router.post('/confirm', handle(req => link.confirm(pool, req.user, req.body || {})));
    router.post('/cancel', handle(req => link.cancel(pool, req.user, req.body || {})));
    // Majburiy faollashtirish oynasi (CRM va ustoz ilovasi). Bot tayyor bo'lmasa oyna chiqmaydi.
    router.get('/activation', handle(req => activation.status(pool, req.user, () => runtime.healthy ? runtime.healthy() : runtime.status().state === 'ready')));
    router.post('/activation/resend', handle(req => { ready(); return activation.resend(pool, req.user); }));
    router.post('/unlink', handle(req => link.unlink(pool, req.user)));
    return router;
};
