const express = require('express');
const { getFullState, patchState, getMobileContentData } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Public endpoint — student app uchun, auth talab qilmaydi
router.get('/mobile-content', async (req, res) => {
    try {
        const mc = await getMobileContentData();
        res.json(mc);
    } catch (err) {
        console.error('GET /api/state/mobile-content', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

router.get('/', authRequired, async (req, res) => {
    try {
        res.json(await getFullState());
    } catch (err) {
        console.error('GET /api/state', err);
        res.status(500).json({ error: 'Ma\'lumotlarni yuklashda xatolik' });
    }
});

router.patch('/', authRequired, async (req, res) => {
    try {
        const body = req.body || {};
        const allowed = [
            'teachers', 'students', 'salesManagers', 'timetable',
            'mainAttendance', 'assistantAttendance', 'payments', 'leads', 'hrEmployees',
            'bookRoadmap', 'mobileContent',
            'scripts', 'bonusHistory', 'bonusData', 'salesPlan', 'cashFlow', 'orgChart'
        ];
        const partial = {};
        allowed.forEach(key => { if (body[key] !== undefined) partial[key] = body[key]; });
        if (!Object.keys(partial).length)
            return res.status(400).json({ error: 'Yangilash uchun ma\'lumot yuborilmadi' });
        await patchState(partial);
        res.json({ ok: true, state: await getFullState() });
    } catch (err) {
        console.error('PATCH /api/state', err);
        res.status(500).json({ error: 'Saqlashda xatolik' });
    }
});

module.exports = router;
