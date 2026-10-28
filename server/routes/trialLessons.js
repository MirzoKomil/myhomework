const express = require('express');
const { authRequired } = require('../middleware/auth');
const { getTeacherTrialLessons, getTeacherTrialHistory, saveTeacherTrialLesson } = require('../db');
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
// Ustozning o'z sinovlari tarixi (yakunlangan, rad etilgan, qayta qo'yilgan) — faqat o'ziga biriktirilganlari.
router.get('/history', async (req, res) => {
    try {
        res.set('Cache-Control', 'private, no-store');
        res.json({ history: await getTeacherTrialHistory(req.user, req.query.days) });
    } catch (err) { res.status(err.status || 500).json({ error: err.message || 'Sinovlar tarixi yuklanmadi' }); }
});
router.post('/:id', async (req, res) => {
    try {
        const lesson = await saveTeacherTrialLesson(req.user, req.params.id, req.body || {});
        res.json({ ok: true, lesson });
    } catch (err) { res.status(err.status || 500).json({ error: err.message || 'Sinov darsi saqlanmadi' }); }
});
module.exports = router;
