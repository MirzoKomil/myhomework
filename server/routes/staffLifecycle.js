'use strict';
// Xodimni ishdan bo'shatish va qayta ishga olish.
const express = require('express');
const { authRequired } = require('../middleware/auth');
const db = require('../db');
const lifecycle = require('../services/staffLifecycle');
const router = express.Router();

async function actorFrom(req) {
    const user = await db.findUserById(req.user.id);
    if (!user || user.disabled_at) throw Object.assign(new Error('Akkaunt topilmadi yoki bloklangan'), { status: 401 });
    // ROP arxivda faqat o'z til yo'nalishini ko'radi — HR yozuvidagi tili.
    let langs = [];
    if (user.role === 'rop') {
        const hr = (await db.pool.query('SELECT lang FROM hr_employees WHERE LOWER(TRIM(login)) = LOWER(TRIM($1)) LIMIT 1', [user.email || ''])).rows[0];
        langs = hr?.lang === 'both' ? ['english', 'russian'] : [hr?.lang === 'russian' ? 'russian' : 'english'];
    }
    return { id: user.id, role: user.role, email: user.email, name: user.name, langs };
}

const handle = fn => async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { res.json(await fn(req, await actorFrom(req))); }
    catch (e) {
        if (!e.status) console.error('[staff-lifecycle]', e);
        res.status(e.status || 500).json({ error: e.status ? e.message : 'Amalni bajarishda xatolik', code: e.code });
    }
};

async function tx(fn) {
    const client = await db.pool.connect();
    try { await client.query('BEGIN'); const r = await fn(client); await client.query('COMMIT'); return r; }
    catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
    finally { client.release(); }
}

router.get('/:employeeId/preview', authRequired, handle((req, actor) => lifecycle.preview(db.pool, actor, req.params.employeeId)));
router.post('/offboard', authRequired, handle((req, actor) => tx(client => lifecycle.offboard(client, actor, req.body || {}))));
router.post('/reinstate', authRequired, handle((req, actor) => tx(client => lifecycle.reinstate(client, actor, req.body || {}))));

module.exports = router;
