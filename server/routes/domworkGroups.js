'use strict';
const express = require('express');
const groups = require('../services/domworkGroups');
// Dependency injection allows route tests without importing the live application DB.
module.exports = function createRouter(pool, authRequired) {
    const router = express.Router();
    router.use(authRequired);
    router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    const handle = fn => async (req, res) => {
        try { res.json(await fn(req)); }
        catch (error) {
            if (!error.status) console.error('[domwork-groups] request failed:', error.code || error.name);
            res.status(error.status || 500).json({ error: error.status ? error.message : 'Guruhlarni saqlashda server xatoligi' });
        }
    };
    router.get('/', handle(req => groups.list(pool, req.user)));
    router.post('/', handle(async req => ({ group: await groups.save(pool, req.user, null, req.body) })));
    router.put('/:id', handle(async req => ({ group: await groups.save(pool, req.user, req.params.id, req.body) })));
    router.post('/:id/archive', handle(async req => ({ group: await groups.archive(pool, req.user, req.params.id, req.body) })));
    return router;
};
