'use strict';
// /api/staff — xodimning o'z sozlamalari: profil (Telegram, tug'ilgan kun, ichki raqam), maosh tafsiloti,
// bildirishnomalar (ro'yxat, o'qilgan, sozlamalar) va yo'riqnoma bilan tanishish.
// Har so'rov faqat joriy foydalanuvchining o'z ma'lumotiga tegadi; rol bazadagi akkauntdan olinadi.
const express = require('express');
const ST = require('../services/staffSettings');
const N = require('../services/staffNotify');

module.exports = function createStaffRouter({ pool, authRequired, findUserById }) {
    const router = express.Router();
    router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
    router.use(authRequired);
    router.use(async (req, res, next) => {
        try {
            if (req.user?.studentId || req.user?.role === 'student') return res.status(403).json({ error: 'Faqat xodimlar uchun' });
            const u = await findUserById(req.user.id);
            if (!u) return res.status(401).json({ error: 'Akkaunt topilmadi' });
            req.user = { ...req.user, role: u.role, name: u.name, email: u.email };
            next();
        } catch { res.status(503).json({ error: 'Akkauntni tekshirib bo\'lmadi' }); }
    });
    const handle = fn => async (req, res) => {
        try {
            if (!ST.state.ready) return res.status(503).json({ error: 'Sozlamalar jadvali hali tayyor emas' });
            res.json(await fn(req));
        } catch (err) {
            if (!err.status) console.error('[staff]', req.method, req.path, err.code || err.message);
            res.status(err.status || 500).json({ error: err.status ? err.message : 'Server xatoligi — qayta urinib ko\'ring' });
        }
    };
    router.get('/profile', handle(req => ST.getProfile(pool, req.user)));
    router.put('/profile', handle(req => ST.saveProfile(pool, req.user, req.body || {})));
    router.get('/salary', handle(req => ST.salaryDetail(pool, req.user)));
    router.get('/notify/feed', handle(req => N.feed(pool, req.user)));
    router.post('/notify/read', handle(req => N.markRead(pool, req.user, req.body || {})));
    router.get('/notify/prefs', handle(req => N.getPrefs(pool, req.user)));
    router.put('/notify/prefs', handle(req => N.savePrefs(pool, req.user, req.body || {})));
    router.get('/guides/acks/mine', handle(async req => ({ acks: await ST.myAcks(pool, req.user) })));
    router.get('/guides/acks', handle(async req => ({ acks: await ST.allAcks(pool, req.user, req.query.guideId ? String(req.query.guideId) : null) })));
    router.post('/guides/:id/ack', handle(req => ST.ackGuide(pool, req.user, req.params.id)));
    return router;
};
