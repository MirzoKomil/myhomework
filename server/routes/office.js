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
    return router;
};
