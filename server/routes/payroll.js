const express = require('express');
const { authRequired } = require('../middleware/auth');
const { pool } = require('../db');
const service = require('../services/payroll');
const engine = require('../../js/payrollEngine');
const router = express.Router();
router.use(authRequired);
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
const handle = fn => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (e) { console.error('[payroll]', e.message); res.status(e.status || (e.code === '40001' ? 409 : 500)).json({ error: e.status ? e.message : 'Maosh hisobini bajarib bo‘lmadi. Qayta urinib ko‘ring' }); }
};
router.get('/settings', handle(req => service.transaction(pool, async db => {
    await service.access(db, req.user);
    const lang = service.language(req.query.language);
    const config = await service.settings(db, lang);
    const history = (await db.query(`SELECT action,entity_id,actor_name,before_data,after_data,created_at
        FROM salary_audit ORDER BY id DESC LIMIT 100`)).rows;
    return { ...config, history };
})));
router.put('/settings', handle(req => service.saveSettings(pool, req.user, req.body?.language, req.body?.data, req.body?.revision)));
router.get('/preview', handle(req => service.preview(pool, req.user, req.query)));
router.post('/confirm-plan', handle(req => service.confirmPlan(pool, req.user, req.body || {})));
router.post('/accrue', handle(req => service.accrue(pool, req.user, req.body || {})));
router.post('/transactions/:id/paid', handle(req => service.markPaid(pool, req.user, req.params.id)));
router.get('/leaderboard', handle(req => service.transaction(pool, async db => {
    const actor = await service.access(db, req.user, 'leaderboard');
    const lang = service.language(req.query.language), p = engine.period(req.query.start, req.query.end);
    if (!actor.finance && lang !== (actor.employee_lang || 'english')) throw Object.assign(new Error('Boshqa til ma’lumotiga ruxsat yo‘q'), { status: 403 });
    const result = await service.calculate(db, p, lang);
    return { income: Object.fromEntries(result.rows.filter(r => r.role === 'sales').map(r => [r.employeeId, r.total])) };
})));
module.exports = router;
