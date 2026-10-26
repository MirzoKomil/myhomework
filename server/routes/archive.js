'use strict';
// Arxiv API: o'chirilgan yozuvlar ro'yxati, bitta yozuv nusxasi va tiklash.
const express = require('express');
const { authRequired } = require('../middleware/auth');
const db = require('../db');
const archive = require('../services/archive');
const router = express.Router();

// Rol tokendan emas, bazadan olinadi (eski tokendagi rolga ishonilmaydi).
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
        if (!e.status) console.error('[archive]', e);
        res.status(e.status || 500).json({ error: e.status ? e.message : 'Arxiv bilan ishlashda xatolik', code: e.code });
    }
};

async function tx(fn) {
    const client = await db.pool.connect();
    try { await client.query('BEGIN'); const r = await fn(client); await client.query('COMMIT'); return r; }
    catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
    finally { client.release(); }
}

router.get('/', authRequired, handle((req, actor) => archive.list(db.pool, actor, req.query)));
router.get('/:id', authRequired, handle((req, actor) => archive.get(db.pool, actor, req.params.id)));
router.post('/:id/restore', authRequired, handle((req, actor) =>
    tx(client => archive.restore(client, actor, req.params.id, {
        restoreLead: db.restoreLead,
        insertLead: (c, lead, lang) => db.insertRestoredLead(c, lead, lang, actor),
        validateStudent: (c, student) => require('../services/teacherDuties').validateAssignment(c, student, {})
    }))));

module.exports = router;
