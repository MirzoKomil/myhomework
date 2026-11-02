'use strict';
// /api/academic/head/* va /api/academic/problems* — Akademik rahbar kabineti (AKADEMIK-API.md).
// Faqat admin, boshliq va akademik; akademik — faqat HR'dagi o'z til yo'nalish(lar)i.
const express = require('express');
const H = require('../services/academicHead');
const { requireRoles } = require('../middleware/roles');

module.exports = function createAcademicHeadRouter({ db, authRequired }) {
    const { pool, tx } = db;
    const router = express.Router();
    // Faqat shu ikki yo'l — /api/academic ning qolgan qismi (Darslik markazi, o'quvchi /track) o'zgarmaydi.
    const PATHS = ['/head', '/problems'];
    router.use(PATHS, (req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
    router.use(PATHS, authRequired, requireRoles(...H.HEAD_ROLES));
    const handle = fn => async (req, res) => {
        try { res.json(await fn(req)); }
        catch (err) {
            if (!err.status) console.error('[akademik]', req.method, req.path, err.code || err.message);
            res.status(err.status || 500).json({ error: err.status ? err.message : 'Server xatoligi — qayta urinib koʻring' });
        }
    };
    const write = (req, fn) => tx(c => fn(c), req.user);

    router.get('/head/me', handle(req => H.me(pool, req.user)));
    router.get('/head/overview', handle(req => H.overview(pool, req.user, req.query)));
    router.get('/head/makeups', handle(req => H.listMakeups(pool, req.user, req.query)));
    router.post('/head/makeups/:id/check', handle(req => write(req, c => H.checkMakeup(c, req.user, req.params.id, req.body || {}))));
    router.get('/head/risk', handle(req => H.risk(pool, req.user, req.query)));
    router.get('/head/students/:id', handle(req => H.studentCard(pool, req.user, req.params.id)));
    router.get('/head/students/:id/transfer-options', handle(req => H.transferOptions(pool, req.user, req.params.id)));
    router.get('/head/teachers', handle(req => H.teachers(pool, req.user, req.query)));
    router.get('/head/teachers/:id', handle(req => H.teacherCard(pool, req.user, req.params.id)));
    router.get('/head/assistants', handle(req => H.assistants(pool, req.user, req.query)));
    router.get('/head/assistants/:id', handle(req => H.assistantCard(pool, req.user, req.params.id)));
    router.get('/head/late-contacts', handle(req => H.lateContacts(pool, req.user, req.query)));
    router.post('/head/late-contacts/:id/decide', handle(req => write(req, c => H.decideLate(c, req.user, req.params.id, req.body || {}))));

    router.get('/problems', handle(req => H.listProblems(pool, req.user, req.query)));
    router.post('/problems', handle(req => write(req, c => H.createProblem(c, req.user, req.body || {}))));
    router.get('/problems/:id', handle(req => H.getProblem(pool, req.user, req.params.id)));
    router.patch('/problems/:id', handle(req => write(req, c => H.patchProblem(c, req.user, req.params.id, req.body || {}))));
    router.post('/problems/:id/events', handle(req => write(req, c => H.problemEvent(c, req.user, req.params.id, req.body || {}))));
    router.post('/problems/:id/close', handle(req => write(req, c => H.closeProblem(c, req.user, req.params.id, req.body || {}))));
    return router;
};
