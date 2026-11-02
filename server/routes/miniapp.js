'use strict';
// /api/miniapp — @Domworkuz_bot ichidagi "1-dars" mini ilovasi.
// Mehmon so'rovlari: X-Telegram-Init-Data sarlavhasi (Telegram imzosi) bilan. Xodim so'rovlari: CRM tokeni bilan.
const express = require('express');
const queue = require('../services/domworkBot/queue');
const miniapp = require('../services/domworkBot/miniapp');
const { configuration } = require('../services/domworkBot/config');

module.exports = function createRouter({ pool, authRequired, getSalesManagerIdForUser, token = configuration().token, transcribe = miniapp.transcribe }) {
    const router = express.Router();
    router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    const handle = fn => async (req, res) => {
        try { res.json(await fn(req)); }
        catch (error) {
            if (!error.status) console.error('[miniapp] route failed:', error.code || error.name);
            res.status(error.status || 500).json({ error: error.status ? error.message : 'Xatolik — birozdan keyin qayta urinib ko‘ring' });
        }
    };
    const auth = req => miniapp.verifyInitData(req.get('X-Telegram-Init-Data'), token);

    router.post('/open', handle(req => { const a = auth(req); return queue.transaction(pool, db => miniapp.open(db, a)); }));
    router.post('/state', handle(req => { const a = auth(req); return queue.transaction(pool, db => miniapp.state(db, a)); }));
    router.post('/event', handle(req => { const a = auth(req); return queue.transaction(pool, db => miniapp.track(db, a, req.body || {})); }));
    router.post('/request', handle(req => { const a = auth(req); return queue.transaction(pool, db => miniapp.request(db, a, req.body || {})); }));
    // Ovoz: xom baytlar (audio/*), kutilgan gap — ?expected=..., ism — ?skip=... (baholanmaydi).
    router.post('/voice', express.raw({ type: 'audio/*', limit: '1mb' }), handle(async req => {
        const a = auth(req), mime = req.get('Content-Type') || '';
        const saved = await queue.transaction(pool, db => miniapp.saveVoice(db, a, req.body, mime, req.query.expected));
        const stt = await transcribe(req.body, mime.split(';')[0]); // tranzaksiyadan tashqarida — tarmoq kutilishi qulfni ushlamaydi
        return queue.transaction(pool, db => miniapp.scoreVoice(db, a, saved.id, stt, { skip: [].concat(req.query.skip || []).slice(0, 3) }));
    }));

    // CRM: lid kartasida ovozni tinglash.
    router.get('/voice/:id', authRequired, async (req, res) => {
        try {
            if (!/^\d{1,15}$/.test(req.params.id)) throw Object.assign(Error('Topilmadi'), { status: 404 });
            const managerId = req.user?.role === 'sales_manager' ? await getSalesManagerIdForUser(req.user.id) : null;
            const v = await queue.transaction(pool, db => miniapp.voiceForStaff(db, req.params.id, req.user, managerId));
            res.set('Content-Type', v.mime).send(v.bytes);
        } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Xatolik' }); }
    });
    // express.raw cheklovi (1 MB) va buzuq tana — HTML emas, JSON xato.
    router.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        res.status(error.status === 413 ? 413 : 400).json({ error: error.status === 413 ? 'Ovoz juda uzun — 20 soniyagacha yozing' : 'Noto‘g‘ri so‘rov' });
    });
    return router;
};
