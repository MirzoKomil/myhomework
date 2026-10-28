'use strict';
// /api/academic — Akademik bo'lim → Darslik markazi.
// Xodimlar (admin, boshliq, rop, ustoz) uchun o'qish; materiallarni faqat
// admin/boshliq o'zgartiradi. /track — yangi o'quvchi ilovasidan vaqt va
// uy vazifasi natijalari (faqat o'quvchi tokeni bilan).
const express = require('express');
const hub = require('../services/academicHub');
const boards = require('../services/academicBoards');

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
    // "Darsni boshlash": o'quvchining navbatdagi jonli darsi (ruxsat etilgan o'quvchilar).
    router.get('/next-lessons', handle(req => hub.nextLessons(pool, req.user, req.query.ids)));
    // Elektron doska: ustoz — o'z doskalari, admin/boshliq/ROP — faqat ko'rish.
    router.get('/boards', handle(req => boards.listBoards(pool, req.user, { lang: req.query.lang, teacherId: req.query.teacherId })));
    router.get('/boards/:id', handle(req => boards.getBoard(pool, req.user, req.params.id)));
    router.post('/boards', handle(req => boards.createBoard(pool, req.user, req.body || {})));
    router.put('/boards/:id', handle(req => boards.updateBoard(pool, req.user, req.params.id, req.body || {})));
    router.delete('/boards/:id', handle(req => boards.archiveBoard(pool, req.user, req.params.id)));
    // "Darsni boshlash" → "Darsni tugatish" davomiyligi (Qoplashlar dalili).
    router.post('/sessions', handle(req => boards.recordSession(pool, req.user, req.body || {})));
    router.get('/sessions', handle(req => boards.listSessions(pool, req.user, { month: req.query.month, teacherId: req.query.teacherId })));
    return router;
};
