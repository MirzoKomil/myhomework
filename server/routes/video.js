'use strict';
// /api/video — ilova ichidagi video dars (LiveKit), 1-bosqich (pilot).
//  • GET  /api/video/status                      — video sozlanganmi (hamma uchun, tokensiz)
//  • POST /api/video/teacher/:studentId/join     — ustoz (o'z o'quvchisi) yoki admin/boshliq/akademik → LiveKit token
//  • POST /api/video/teacher/:studentId/link     — o'quvchining navbatdagi darsi uchun shaxsiy havola (ustoz yuboradi)
//  • GET  /api/video/link/:code                  — havola holati (ochiq/erta/eskirgan), ism, ustoz, vaqt (login shart emas)
//  • POST /api/video/link/:code/join             — havola orqali kirish: {deviceId, name, takeover} → LiveKit token
//  • POST /api/video/presence                    — xonaga kirdi/chiqdi belgisi (sahifa yuboradi) — davomat uchun dastlabki ma'lumot
const express = require('express');
const V = require('../services/videoLesson');

const WATCH = new Set(['admin', 'boshliq', 'akademik']);

module.exports = function createVideoRouter({ db, authRequired, findUserById }) {
    const { pool } = db;
    const router = express.Router();
    router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
    const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).then(out => { if (out !== undefined) res.json(out); })
        .catch(e => { if (!e.status) console.error('[video]', e); res.status(e.status || 500).json({ error: e.status ? e.message : 'Server xatoligi' }); });
    const fail = (status, message) => Object.assign(new Error(message), { status });
    const needConfigured = () => { if (!V.configured()) throw fail(503, 'Video dars hali sozlanmagan'); };

    router.get('/status', (req, res) => res.json({ configured: V.configured(), url: V.configured() ? V.cfg().url : null }));
    // Ustoz ilovasi uchun: men sinovdagi (pilot) ustozmanmi — "Video xona" tugmasi faqat shunda chiqadi.
    router.get('/me', authRequired, wrap(async req => {
        const u = await findUserById(req.user.id);
        if (!u) throw fail(401, 'Akkaunt topilmadi');
        if (u.role !== 'teacher') return { pilot: V.configured() && WATCH.has(u.role), role: u.role };
        let me = null; try { me = await require('../services/teacherDuties').teacherForActor(pool, { id: u.id, role: u.role }); } catch { /* HR profili yo'q */ }
        return { pilot: !!me && V.pilotOn(me.id), role: 'teacher' };
    }));

    // ── Xodim (ustoz / rahbariyat) ──────────────────────────────────────────
    async function staffContext(req, studentId) {
        const u = await findUserById(req.user.id);
        if (!u) throw fail(401, 'Akkaunt topilmadi');
        const st = (await pool.query('SELECT id, name, teacher_id, lesson_day_of_week, lesson_time, lesson_duration FROM students WHERE id=$1', [studentId])).rows[0];
        if (!st) throw fail(404, "O'quvchi topilmadi");
        let me = null;
        if (u.role === 'teacher') {
            me = await require('../services/teacherDuties').teacherForActor(pool, { id: u.id, role: u.role });
            if (String(me.id) !== String(st.teacher_id)) throw fail(403, "Faqat o'z o'quvchingiz darsiga");
        } else if (!WATCH.has(u.role)) throw fail(403, 'Ruxsat yoʻq');
        const teacherName = st.teacher_id ? ((await pool.query('SELECT name FROM hr_employees WHERE id=$1', [st.teacher_id])).rows[0]?.name || '') : '';
        return { u, st, me, teacherName };
    }
    function nextStart(st) {
        if (st.lesson_day_of_week == null || !st.lesson_time) throw fail(400, "O'quvchining dars vaqti kiritilmagan");
        return db.computeNextWeeklyOccurrence(st.lesson_day_of_week, st.lesson_time, st.lesson_duration);
    }

    router.post('/teacher/:studentId/join', authRequired, wrap(async req => {
        needConfigured();
        const { u, st, me, teacherName } = await staffContext(req, req.params.studentId);
        const startsAt = nextStart(st);
        const link = await V.ensureStudentLink(pool, { studentId: st.id, studentName: st.name, teacherId: st.teacher_id, teacherName, startsAt, durationMin: st.lesson_duration, createdBy: u.id });
        const asTeacher = !!me;
        const identity = asTeacher ? `t:${me.id}` : `w:${u.id}`;
        const token = V.accessToken({ identity, name: asTeacher ? (teacherName || u.name) : `${u.name} (kuzatuvchi)`, room: link.room,
            canPublish: asTeacher, metadata: { role: asTeacher ? 'teacher' : 'watcher', studentId: st.id } });
        return { url: V.cfg().url, token, room: link.room, studentName: st.name, teacherName, startsAt: link.starts_at, durationMin: link.duration_min,
            code: link.code, link: V.publicUrl(link.code), role: asTeacher ? 'teacher' : 'watcher' };
    }));

    router.post('/teacher/:studentId/link', authRequired, wrap(async req => {
        needConfigured();
        const { u, st, teacherName } = await staffContext(req, req.params.studentId);
        const link = await V.ensureStudentLink(pool, { studentId: st.id, studentName: st.name, teacherId: st.teacher_id, teacherName, startsAt: nextStart(st), durationMin: st.lesson_duration, createdBy: u.id });
        const w = V.windowOf(link);
        return { code: link.code, link: V.publicUrl(link.code), opensAt: new Date(w.opens).toISOString(), endsAt: new Date(w.ends).toISOString(), state: w.state };
    }));

    // ── Havola (login shart emas) ───────────────────────────────────────────
    async function linkRow(code) {
        await V.ensureSchema(pool);
        const c = V.normCode(code);
        if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) throw fail(404, 'Havola topilmadi');
        const row = (await pool.query('SELECT * FROM video_links WHERE code=$1', [c])).rows[0];
        if (!row) throw fail(404, 'Havola topilmadi');
        return row;
    }
    router.get('/link/:code', wrap(async req => {
        const row = await linkRow(req.params.code);
        const w = V.windowOf(row);
        return { code: row.code, kind: row.kind, name: row.display_name, teacherName: row.teacher_name, startsAt: row.starts_at, durationMin: row.duration_min,
            opensAt: new Date(w.opens).toISOString(), endsAt: new Date(w.ends).toISOString(), state: w.state, configured: V.configured() };
    }));

    router.post('/link/:code/join', wrap(async req => {
        needConfigured();
        const row = await linkRow(req.params.code);
        const w = V.windowOf(row);
        if (w.state === 'early') throw fail(425, `Xona ${new Date(w.opens + 5 * 3600000).toISOString().slice(11, 16)} da ochiladi`);
        if (w.state === 'expired') throw fail(410, 'Bu havola endi ishlamaydi');
        const deviceId = String(req.body?.deviceId || '').slice(0, 64);
        if (!deviceId) throw fail(400, 'Qurilma aniqlanmadi');
        const busy = row.device_id && row.device_id !== deviceId && row.device_seen && Date.now() - new Date(row.device_seen).getTime() < V.DEVICE_TTL_MS;
        if (busy && !req.body?.takeover) throw fail(409, 'Bu havola boshqa qurilmada ochiq');
        await pool.query('UPDATE video_links SET device_id=$2, device_seen=NOW() WHERE code=$1', [row.code, deviceId]);
        const name = String(req.body?.name || row.display_name || 'Mehmon').trim().slice(0, 60) || 'Mehmon';
        const identity = row.kind === 'student' && row.student_id ? `s:${row.student_id}` : `g:${row.code}`;
        const token = V.accessToken({ identity, name, room: row.room, metadata: { role: row.kind === 'trial' ? 'lead' : 'student', code: row.code, deviceId },
            ttlSec: Math.max(600, Math.round((w.ends - Date.now()) / 1000) + 600) });
        return { url: V.cfg().url, token, room: row.room, name, teacherName: row.teacher_name, startsAt: row.starts_at, durationMin: row.duration_min, endsAt: new Date(w.ends).toISOString(), kind: row.kind };
    }));

    // Sahifa har 60 soniyada "men shu yerdaman" yuboradi: qurilma band ekanini va kirish-chiqish vaqtini yozib boradi.
    // Xona va ishtirokchi so'rovdagi o'z LiveKit tokenidan olinadi (boshqa xonaga soxta belgi yozib bo'lmaydi).
    router.post('/presence', wrap(async req => {
        await V.ensureSchema(pool);
        if (!V.configured()) return { ok: false };
        let p;
        try { p = require('jsonwebtoken').verify(String(req.body?.token || ''), V.cfg().secret, { algorithms: ['HS256'], issuer: V.cfg().key }); }
        catch { throw fail(401, 'Token yaroqsiz'); }
        const room = p?.video?.room, identity = p?.sub;
        const kind = ['join', 'leave', 'beat'].includes(req.body?.kind) ? req.body.kind : null;
        if (!room || !identity || !kind) throw fail(400, "Noto'g'ri so'rov");
        let meta = {}; try { meta = JSON.parse(p.metadata || '{}'); } catch { /* bo'sh */ }
        if (meta.code && meta.deviceId) await pool.query('UPDATE video_links SET device_seen=NOW() WHERE code=$1 AND device_id=$2', [meta.code, meta.deviceId]);
        if (kind !== 'beat') await pool.query('INSERT INTO video_events (room, identity, kind) VALUES ($1,$2,$3)', [room, identity, kind]);
        return { ok: true };
    }));

    return router;
};
