const express = require('express');
const { authRequired } = require('../middleware/auth');
const { getTeacherTrialLessons, saveTeacherTrialLesson } = require('../db');
const router = express.Router();
router.use(authRequired);
router.use((req, res, next) => {
    if (req.user?.role !== 'teacher') return res.status(403).json({ error: 'Bu bo‘lim ustoz uchun' });
    next();
});
router.get('/', async (req, res) => {
    try {
        res.set('Cache-Control', 'private, no-store');
        res.json({ lessons: await getTeacherTrialLessons(req.user) });
    } catch (err) { res.status(err.status || 500).json({ error: err.message || 'Sinov darslari yuklanmadi' }); }
});
router.post('/:id', async (req, res) => {
    try {
        const lesson = await saveTeacherTrialLesson(req.user, req.params.id, req.body || {});
        res.json({ ok: true, lesson });
    } catch (err) { res.status(err.status || 500).json({ error: err.message || 'Sinov darsi saqlanmadi' }); }
});
module.exports = router;
