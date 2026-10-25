'use strict';
const express = require('express');
const { authRequired } = require('../middleware/auth');
const { pool } = require('../db');
const service = require('../services/targetAds');
const router = express.Router();

const handle = fn => async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { res.json(await fn(req)); }
    catch (e) {
        if (!e.status) console.error('[target-ads]', e);
        res.status(e.status || 500).json({ error: e.status ? e.message : 'Target ma’lumotlarini qayta ishlashda xatolik' });
    }
};
async function tx(fn) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const r = await fn(client); await client.query('COMMIT'); return r; }
    catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
    finally { client.release(); }
}

router.get('/', authRequired, handle(req => service.month(pool, req.user, req.query)));
router.get('/history', authRequired, handle(req => service.history(pool, req.user, req.query)));
router.put('/', authRequired, handle(req => tx(db => service.save(db, req.user, req.body || {}))));

module.exports = router;
