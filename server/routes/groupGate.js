'use strict';
// 14-noy: yangi o'quvchi guruhi qulfi (services/domworkBot/groupGate.js) — CRM kabinetlari uchun.
const express = require('express');
const gate = require('../services/domworkBot/groupGate');
module.exports = function createRouter({ pool, authRequired, getSalesManagerIdForUser }) {
    const router = express.Router();
    router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    router.use(authRequired);
    const handle = fn => async (req, res) => {
        try { res.json(await fn(req)); }
        catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Guruh tekshiruvida xatolik' }); }
    };
    router.get('/mine', handle(async req => gate.blocking(pool, req.user,
        req.user?.role === 'sales_manager' ? await getSalesManagerIdForUser(req.user.id) : null)));
    router.get('/admin', handle(req => gate.adminList(pool, req.user)));
    // ROP/admin: Telegramdan avtomatik biriktirilgan lidlar oynasi.
    const claims = require('../services/domworkBot/claimReport');
    router.get('/claims', handle(req => claims.list(pool, req.user)));
    router.post('/claims/seen', handle(req => claims.markSeen(pool, req.user)));
    router.post('/recheck', handle(req => gate.recheck(pool)));
    router.post('/:leadId/override', handle(req => gate.override(pool, req.user, req.params.leadId, req.body?.reason)));
    return router;
};
