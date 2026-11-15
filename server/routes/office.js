'use strict';
// "Jonli ofis" — GET /api/office/live (faqat o'qish). Har bir xodim o'z roliga qarab ko'radi (services/office.js).
const express = require('express');

module.exports = ({ pool, authRequired }) => {
    const router = express.Router();
    const STAFF = new Set(['admin', 'boshliq', 'rop', 'sales_manager', 'teacher', 'employee', 'targetolog', 'hr', 'akademik']);
    router.get('/live', authRequired, async (req, res) => {
        if (!STAFF.has(req.user?.role)) return res.status(403).json({ error: 'Jonli ofis faqat jamoa a’zolari uchun' });
        try {
            res.set('Cache-Control', 'no-store');
            res.json(await require('../services/office').liveCached(pool, req.user, req.query || {}));
        } catch (e) {
            console.error('[office] live:', e);
            res.status(e.status || 500).json({ error: e.status ? e.message : 'Jonli ofis maʼlumotini olib boʻlmadi' });
        }
    });
    const handle = fn => async (req, res) => {
        if (!STAFF.has(req.user?.role)) return res.status(403).json({ error: 'Faqat jamoa a’zolari uchun' });
        try { res.set('Cache-Control', 'no-store'); res.json(await fn(req)); }
        catch (e) { if (!e.status) console.error('[office]', e); res.status(e.status || 500).json({ error: e.status ? e.message : 'Xatolik yuz berdi' }); }
    };
    const svc = () => require('../services/office');
    // TV e'loni: rahbar / ROP / HR yozadi, hamma ekranlarda katta banner bo'lib chiqadi.
    router.post('/announce', authRequired, express.json(), handle(req => svc().announce(pool, req.user, req.body || {})));
    router.delete('/announce', authRequired, handle(req => svc().removeAnnouncement(pool, req.user)));
    // Personaj: har xodim o'zinikini tanlaydi.
    router.get('/look', authRequired, handle(req => svc().myLook(pool, req.user)));
    router.put('/look', authRequired, express.json(), handle(req => svc().saveLook(pool, req.user, req.body || {})));
    return router;
};
