'use strict';
// Xodimlar davomati API: /api/staff-attendance
const express = require('express');

module.exports = function staffAttendanceRouter({ pool, authRequired, analyzer = require('../services/staffAttendance/face') }) {
    const service = require('../services/staffAttendance');
    const router = express.Router();
    router.use(authRequired);
    router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
    const handle = fn => async (req, res) => {
        try { res.json(await fn(req)); }
        catch (e) {
            if (!e.status) console.error('[staff-attendance]', e.message);
            res.status(e.status || 500).json({ error: e.status ? e.message : 'Davomat amalini bajarib bo‘lmadi. Qayta urinib ko‘ring' });
        }
    };
    const meta = req => ({ ip: req.ip, userAgent: req.get('user-agent') });

    // Xodimning o'zi
    router.get('/me', handle(req => service.me(pool, req.user)));
    router.post('/me/challenge', handle(req => service.challenge(pool, req.user)));
    router.post('/me/face', handle(req => service.submitOwnFace(pool, analyzer, req.user, req.body)));
    router.post('/me/check', handle(req => service.check(pool, analyzer, req.user, req.body, meta(req))));
    router.get('/me/month', handle(req => service.myMonth(pool, req.user, String(req.query.month || ''))));
    router.get('/me/day', handle(req => service.teamRecord(pool, req.user, null, String(req.query.date || ''))));
    // Javob so'rash (DavRequest) va o'z so'rovlari (DavMy → Soʻrovlarim)
    router.get('/me/requests', handle(req => service.myRequests(pool, req.user)));
    router.post('/me/requests', handle(req => service.createRequest(pool, req.user, req.body)));
    router.post('/me/requests/:id/cancel', handle(req => service.cancelRequest(pool, req.user, req.params.id)));

    // Tasdiqlovchi: ROP (sotuv), akademik rahbar (yordamchilar), direktor (ROP, HR, akademik) — DavApprovals / DavRop / DavAkad
    router.get('/requests', handle(req => service.inbox(pool, req.user, req.query.tab === 'history' ? 'history' : 'pending')));
    router.post('/requests/:id/decide', handle(req => service.decideRequest(pool, req.user, req.params.id, req.body)));
    router.get('/team', handle(req => service.team(pool, req.user, String(req.query.date || ''))));
    router.get('/team/:id/day', handle(req => service.teamRecord(pool, req.user, req.params.id, String(req.query.date || ''))));
    router.put('/settings/office', handle(req => service.saveOffice(pool, req.user, req.body)));

    // HR / rahbar
    router.get('/settings', handle(async req => { const a = await service.actor(pool, req.user); if (!a.canView) throw Object.assign(new Error('Ruxsat yo‘q'), { status: 403 }); return { ...(await service.getSettings(pool)), yourIp: String(req.ip || '').replace(/^::ffff:/, '') }; }));
    router.put('/settings', handle(req => service.saveSettings(pool, req.user, req.body)));
    router.get('/employees', handle(req => service.employees(pool, req.user)));
    router.put('/employees/:id/schedule', handle(req => service.saveSchedule(pool, req.user, req.params.id, req.body)));
    router.post('/employees/:id/face', handle(req => service.enrollFor(pool, analyzer, req.user, req.params.id, req.body)));
    router.post('/employees/:id/face/review', handle(req => service.transaction(pool, db =>
        service.reviewFace(db, analyzer, req.user, req.params.id, req.body?.decision === 'approve' ? 'approve' : 'reject', String(req.body?.photoId || '')))));
    router.delete('/employees/:id/face', handle(req => service.deleteFace(pool, req.user, req.params.id)));
    router.get('/daily', handle(req => service.daily(pool, req.user, String(req.query.date || ''))));
    router.get('/monthly', handle(req => service.monthly(pool, req.user, String(req.query.month || ''))));
    router.get('/lessons', handle(req => service.lessonReport(pool, req.user, String(req.query.date || ''))));
    router.put('/override', handle(req => service.setOverride(pool, req.user, req.body)));

    router.get('/photos/:id', async (req, res) => {
        try {
            const row = await service.photo(pool, req.user, req.params.id);
            res.set('Content-Type', row.mime);
            res.set('Cache-Control', 'private, no-store'); // biometrik rasm umumiy kompyuter keshida qolmasin
            res.send(row.data);
        } catch (e) {
            res.status(e.status || 500).json({ error: e.status ? e.message : 'Rasmni ochib bo‘lmadi' });
        }
    });
    return router;
};
