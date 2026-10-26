'use strict';
// /api/academic — Akademik bo'lim → Darslik markazi.
// Xodimlar (admin, boshliq, rop, ustoz) uchun o'qish; materiallarni faqat
// admin/boshliq o'zgartiradi. /track — yangi o'quvchi ilovasidan vaqt va
// uy vazifasi natijalari (faqat o'quvchi tokeni bilan).
const express = require('express');
const hub = require('../services/academicHub');

module.exports = function createAcademicRouter({ pool, authRequired, studentAuthOptional }) {
    const router = express.Router();
    router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
    const handle = fn => async (req, res) => {
        try { res.json(await fn(req)); }
        catch (err) {
            if (!err.status) console.error('[academic]', req.method, req.path, err.code || err.message);
            res.status(err.status || 500).json({ error: err.status ? err.message : 'Darslik markazida server xatoligi' });
        }
    };

    router.post('/track', studentAuthOptional, handle(req => hub.recordTracking(pool, req.studentId, req.body || {})));

    router.use(authRequired);
    router.get('/hub', handle(req => hub.getHub(pool, req.user, { lang: req.query.lang, courseId: req.query.courseId })));
    router.get('/lessons/:no', handle(req => hub.getLesson(pool, req.user, { lang: req.query.lang, no: req.params.no, courseId: req.query.courseId })));
    router.get('/students', handle(req => hub.studentsOverview(pool, req.user, { lang: req.query.lang })));
    router.get('/students/:id', handle(req => hub.studentDetail(pool, req.user, req.params.id)));
    router.get('/materials', handle(async req => {
        const access = await hub.resolveAccess(pool, req.user);
        const lang = access.lang || (req.query.lang === 'russian' ? 'russian' : 'english');
        return { materials: await hub.listMaterials(pool, lang) };
    }));
    router.post('/materials', handle(async req => ({ material: await hub.saveMaterial(pool, req.user, null, req.body) })));
    router.put('/materials/:id', handle(async req => ({ material: await hub.saveMaterial(pool, req.user, req.params.id, req.body) })));
    router.delete('/materials/:id', handle(req => hub.archiveMaterial(pool, req.user, req.params.id)));
    return router;
};
