'use strict';
// /api/school — yagona dars jadvali, o'quvchi holati va tahriri, sotuv
// so'rovlari tasdig'i, Telegram guruhlar, yordamchi aloqalari, oy yopish.
// Rol qoidalari:
//  • admin/boshliq — hammasi; rop — o'quvchi amallari va sotuv so'rovlari (admin bilan teng);
//  • sales_manager — "Kim bo'sh?" (ismlarsiz), sinov band qilish, o'z o'quvchilari, so'rov yuborish;
//  • teacher — o'z haftasi, qoplash, sinov natijasi, so'rovlar; yordamchi — aloqa belgilash.
// Ustoz va yordamchi hech qachon tarif/to'lov summasini olmaydi.
const express = require('express');
const T = require('../services/school/time');
const S = require('../services/school/schedule');
const O = require('../services/school/studentOps');
const A = require('../services/school/assist');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');

const FULL = new Set(['admin', 'boshliq']);
const MANAGE = new Set(['admin', 'boshliq', 'rop']);
const SALES = new Set(['sales_manager', 'rop']);
const MONEY_KEYS = /price|tariff|paid|debt|payment|amount|fee|discount|contract|card|passport|pinfl/i;

module.exports = function createSchoolRouter({ db, authRequired, findUserById }) {
    const { pool, tx } = db;
    const router = express.Router();
    router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
    router.use(authRequired);
    // Rol bazadagi joriy akkauntdan olinadi (eski token bilan ruxsat qolmasin).
    router.use(async (req, res, next) => {
        try {
            const u = await findUserById(req.user.id);
            if (!u) return res.status(401).json({ error: 'Akkaunt topilmadi' });
            req.user = { ...req.user, role: u.role, name: u.name, email: u.email };
            next();
        } catch { res.status(503).json({ error: 'Akkauntni tekshirib bo\'lmadi' }); }
    });
    const handle = fn => async (req, res) => {
        try { res.json(await fn(req)); }
        catch (err) {
            if (!err.status) console.error('[school]', req.method, req.path, err.code || err.message);
            res.status(err.status || 500).json({ error: err.status ? err.message : 'Server xatoligi — qayta urinib ko\'ring' });
        }
    };
    const need = (req, set, msg = 'Bu amalga ruxsat yo\'q') => { if (!set.has(req.user.role)) throw T.fail(403, msg); };
    const write = (req, fn) => tx(client => fn(client), req.user);
    const managerId = async req => req.user.role === 'sales_manager'
        ? (await pool.query('SELECT manager_id FROM user_sales_manager_links WHERE user_id=$1', [req.user.id])).rows[0]?.manager_id || null : null;
    const teacherOf = req => require('../services/teacherDuties').teacherForActor(pool, req.user);

    // ── Jadval ───────────────────────────────────────────────────────────────
    async function views(req, from, to, teacherIds) {
        const ctx = await S.loadContext(pool, { teacherIds, from, to });
        const ids = teacherIds || [...new Set([...ctx.hours.map(h => h.teacher_id), ...ctx.students.map(s => s.teacherId).filter(Boolean)])];
        const out = [];
        for (const d of T.dateRange(from, to, 31)) for (const id of ids) out.push(S.dayView(ctx, id, d));
        return out;
    }
    async function scopedViews(req, from, to, teacherId) {
        const role = req.user.role;
        if (role === 'teacher') {
            const me = await teacherOf(req);
            return { views: await views(req, from, to, [me.id]), scope: 'own' };
        }
        if (FULL.has(role)) return { views: await views(req, from, to, teacherId ? [teacherId] : null), scope: 'full' };
        if (SALES.has(role)) {
            const v = await views(req, from, to, teacherId ? [teacherId] : null);
            const mid = await managerId(req);
            return { views: v.map(x => S.redactForSales(x, req.user, mid)), scope: 'sales' };
        }
        throw T.fail(403, 'Jadvalga ruxsat yo\'q');
    }
    router.get('/schedule', handle(async req => {
        const from = T.assertDate(req.query.from || T.nowLocal().date);
        const to = T.assertDate(req.query.to || from);
        const r = await scopedViews(req, from, to, req.query.teacherId || null);
        const teachers = (await pool.query(`SELECT he.id, he.name, he.role, he.lang, he.status, COALESCE(u.avatar,'') AS avatar FROM hr_employees he
            LEFT JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(he.login))
            WHERE he.role IN ('oqituvchi','ingliz-oqituvchi','rus-oqituvchi') AND COALESCE(he.status,'active') <> 'inactive' ORDER BY he.name`)).rows;
        let summary = null;
        if (r.scope === 'full' && from === to) {
            const att = await pool.query(`SELECT student_id, present FROM main_attendance WHERE att_key LIKE $1 AND day=$2`, [from.slice(0, 7) + '\\_%', Number(from.slice(8))]);
            summary = S.daySummary(r.views, new Map(att.rows.map(a => [a.student_id, !!a.present])), from === T.nowLocal().date ? T.nowLocal().min : null);
        }
        return { from, to, scope: r.scope, teachers: r.scope === 'own' ? undefined : teachers, views: r.views, summary };
    }));
    // "Kim bo'sh?" — sotuv/ROP uchun: sinovga ochiq bo'sh oraliqlar, 30 daqiqa qadam bilan.
    router.get('/schedule/free', handle(async req => {
        need(req, new Set([...SALES, ...FULL]));
        const from = T.assertDate(req.query.from), to = T.assertDate(req.query.to || from);
        const duration = Math.min(120, Math.max(15, Number(req.query.duration) || 30));
        const purpose = req.query.purpose === 'lesson' ? 'lesson' : 'trial';
        const vs = await views(req, from, to, req.query.teacherId ? [req.query.teacherId] : null);
        const step = 30, list = [];
        for (const v of vs) {
            const src = purpose === 'trial' ? v.trialFree : v.free;
            for (const f of src) for (let t = Math.ceil(f.start / step) * step; t + duration <= f.end; t += step) list.push({ teacherId: v.teacherId, date: v.date, time: T.fromMin(t) });
        }
        const now = T.nowLocal();
        return { duration, purpose, slots: list.filter(s => s.date > now.date || T.toMin(s.time) > now.min) };
    }));
    router.post('/bookings', handle(req => write(req, async c => {
        const kind = req.body?.kind;
        if (kind === 'trial') {
            need(req, new Set([...SALES, ...FULL]));
            // Lid mavjud va (sotuv menejeri uchun) o'ziniki bo'lishi shart; sotuv faqat ushlab turadi.
            const lead = (await c.query('SELECT manager_id FROM leads WHERE id=$1 AND deleted_at IS NULL', [String(req.body?.leadId || '')])).rows[0];
            if (!lead) throw T.fail(404, 'Lid topilmadi');
            if (req.user.role === 'sales_manager' && String(lead.manager_id || '') !== String(await managerId(req) || '-')) throw T.fail(403, 'Faqat o\'z lidingiz uchun');
            if (SALES.has(req.user.role)) req.body.hold = true;
        }
        else if (kind === 'makeup') { if (req.user.role === 'teacher') { const me = await teacherOf(req); if (req.body.teacherId !== me.id) throw T.fail(403, 'Faqat o\'z jadvalingizga'); } else need(req, FULL); }
        else need(req, FULL);
        if (kind === 'makeup') {
            const st = (await c.query('SELECT teacher_id FROM students WHERE id=$1', [req.body.studentId])).rows[0];
            if (!st || st.teacher_id !== req.body.teacherId) throw T.fail(403, 'Bu o\'quvchi shu ustozniki emas');
            const missed = T.assertDate(req.body.missedDate, 'Qoldirilgan dars sanasi');
            if (missed.slice(0, 7) !== T.assertDate(req.body.date).slice(0, 7)) throw T.fail(400, 'Qoplash shu oy ichida bo\'ladi');
            const b = await S.book(c, req.user, req.body);
            const m = await c.query(`INSERT INTO school_makeups (id,student_id,teacher_id,missed_date,held_date,kind,booking_id,status,created_by)
                VALUES ($1,$2,$3,$4,$5,'separate',$6,'planned',$7) RETURNING *`, [randomUUID(), req.body.studentId, req.body.teacherId, missed, req.body.date, b[0].id, req.user.id])
                .catch(e => { if (e.code === '23505') throw T.fail(409, 'Bu dars uchun qoplash allaqachon bor'); throw e; });
            return { bookings: b, makeup: m.rows[0] };
        }
        return { bookings: await S.book(c, req.user, req.body) };
    })));
    router.post('/bookings/group/:group/confirm', handle(req => write(req, c => S.confirmHold(c, req.user, req.params.group).then(b => ({ bookings: b })))));
    // "Kim bo'sh?" → ushlab turilgan vaqtni lidga biriktirish: lid "Sinov darsida" bosqichiga o'tadi
    // (CRM lid oynasidagi bilan bir xil yo'l — lid tarixi, SLA, ustoz tasdig'i). Ushlab turish bekor bo'ladi.
    router.post('/bookings/group/:group/attach-lead', handle(async req => {
        need(req, new Set([...SALES, ...FULL]));
        const holds = (await pool.query(`SELECT * FROM school_bookings WHERE group_id=$1 AND status='hold' AND hold_until >= NOW() AND created_by=$2 ORDER BY date`, [req.params.group, req.user.id])).rows;
        if (!holds.length) throw T.fail(409, 'Ushlab turish muddati tugagan — vaqtni qaytadan tanlang');
        const row = (await pool.query('SELECT * FROM leads WHERE id=$1 AND deleted_at IS NULL', [String(req.body?.leadId || '')])).rows[0];
        if (!row) throw T.fail(404, 'Lid topilmadi');
        const mid = await managerId(req);
        if (req.user.role === 'sales_manager' && String(row.manager_id || '') !== String(mid || '')) throw T.fail(403, 'Faqat o\'z lidingizni sinovga yozasiz');
        const extra = typeof row.extra_data === 'object' && row.extra_data ? row.extra_data : JSON.parse(row.extra_data || '{}');
        const first = holds[0], date = S.dateStr(first.date), min = Number(first.start_min);
        const at = new Date(Date.parse(date + 'T00:00:00Z') + (min - T.TZ_OFFSET_MIN) * 60000).toISOString();
        const teacher = (await pool.query('SELECT name FROM hr_employees WHERE id=$1', [first.teacher_id])).rows[0];
        const lead = { id: row.id, updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined, status: 'sinov-darsida',
            paymentOnboarding: { ...(extra.paymentOnboarding || {}), teacherId: first.teacher_id, lessonDayOfWeek: T.weekday(date), lessonTime: T.fromMin(min),
                lessonDuration: Number(first.end_min) - Number(first.start_min), trialDaysCount: holds.length, isTrial: true },
            trialLessonAt: at, trialScheduleRevision: randomUUID(),
            comments: [...(Array.isArray(row.comments) ? row.comments : JSON.parse(row.comments || '[]')), { id: randomUUID(), type: 'trial-lesson', author: req.user.name || '', authorId: req.user.id,
                createdAt: new Date().toISOString(), text: `Sinov darsi belgilandi ("Kim bo'sh?"):\n• O'qituvchi: ${teacher?.name || '—'}\n• Kuni: ${date.split('-').reverse().join('.')}, ${T.fromMin(min)}\n• Davomiyligi: ${holds.length} kun` }] };
        const saved = await db.upsertLead(lead, row.language, req.user);
        return { lead: { id: saved.lead.id, status: saved.lead.status } };
    }));
    router.post('/bookings/:id/:action', handle(req => write(req, async c => {
        const action = req.params.action;
        let teacherId = null;
        if (req.user.role === 'teacher') { teacherId = (await teacherOf(req)).id; if (action === 'cancel') throw T.fail(403, 'Bekor qilishni admin qiladi'); }
        else if (SALES.has(req.user.role)) {
            if (action !== 'cancel') throw T.fail(403, 'Natijani ustoz yozadi');
            const b = (await c.query('SELECT created_by, kind FROM school_bookings WHERE id=$1', [req.params.id])).rows[0];
            if (!b || b.kind !== 'trial' || (b.created_by !== req.user.id && req.user.role !== 'rop')) throw T.fail(403, 'Faqat o\'zingiz band qilgan sinovni bekor qilasiz');
        } else need(req, FULL);
        return { booking: await S.transition(c, req.params.id, action, { teacherId }) };
    })));
    router.post('/overrides', handle(req => { need(req, FULL); return write(req, c => S.addOverride(c, req.user, req.body || {}).then(o => ({ override: o }))); }));
    router.delete('/overrides/:id', handle(req => { need(req, FULL); return write(req, c => S.removeOverride(c, req.user, req.params.id).then(o => ({ override: o }))); }));
    router.get('/teachers/:id/hours', handle(async req => {
        if (req.user.role === 'teacher' && (await teacherOf(req)).id !== req.params.id) throw T.fail(403, 'Faqat o\'z ish vaqtingiz');
        return { hours: (await pool.query('SELECT * FROM school_teacher_hours WHERE teacher_id=$1 ORDER BY weekday,start_min', [req.params.id])).rows };
    }));
    router.put('/teachers/:id/hours', handle(req => { need(req, FULL); return write(req, c => S.setHours(c, req.user, req.params.id, req.body?.slots).then(h => ({ hours: h }))); }));

    // Ustoz so'rovlari (ta'til, vaqt yopish/ochish) → admin.
    router.post('/requests', handle(req => write(req, async c => {
        const me = await teacherOf(req);
        const type = req.body?.type;
        if (!['leave', 'close', 'open'].includes(type)) throw T.fail(400, 'So\'rov turi noto\'g\'ri');
        const reason = String(req.body.reason || '').trim(); if (reason.length < 3) throw T.fail(400, 'Sababni yozing');
        const p = { date: req.body.date, weekday: req.body.weekday, repeat: req.body.repeat, from: req.body.from, to: req.body.to };
        if (p.date) T.assertDate(p.date);
        const { rows } = await c.query(`INSERT INTO school_requests (id,teacher_id,requester_id,requester_name,type,payload,reason) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [randomUUID(), me.id, req.user.id, me.name, type, JSON.stringify(p), reason.slice(0, 300)]);
        return { request: rows[0] };
    })));
    router.get('/requests', handle(async req => {
        if (req.user.role === 'teacher') { const me = await teacherOf(req); return { requests: (await pool.query('SELECT * FROM school_requests WHERE teacher_id=$1 ORDER BY created_at DESC LIMIT 100', [me.id])).rows }; }
        need(req, FULL);
        return { requests: (await pool.query(`SELECT * FROM school_requests WHERE ($1='' OR status=$1) ORDER BY created_at DESC LIMIT 200`, [req.query.status || ''])).rows };
    }));
    router.post('/requests/:id/decide', handle(req => { need(req, FULL); return write(req, async c => {
        const r = (await c.query('SELECT * FROM school_requests WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
        if (!r) throw T.fail(404, 'So\'rov topilmadi'); if (r.status !== 'new') throw T.fail(409, 'So\'rov allaqachon hal qilingan');
        const approve = req.body?.decision === 'approve';
        if (!approve && String(req.body?.note || '').trim().length < 3) throw T.fail(400, 'Rad etish sababini yozing');
        let override = null;
        if (approve && r.type !== 'assist_late') {
            const p = r.payload || {};
            override = await S.addOverride(c, req.user, { teacherId: r.teacher_id, kind: r.type, date: p.date, weekday: p.weekday, repeat: p.repeat,
                from: p.from || '00:00', to: p.to || '24:00', reason: r.reason });
        }
        const { rows } = await c.query(`UPDATE school_requests SET status=$2, decided_by=$3, decided_by_name=$4, decided_at=NOW(), decision_note=$5 WHERE id=$1 RETURNING *`,
            [r.id, approve ? 'approved' : 'rejected', req.user.id, req.user.name || '', String(req.body?.note || '').slice(0, 300)]);
        return { request: rows[0], override };
    }); }));
    // Qoplash: ustoz "Q" yoki "Keldi · 2 dars" belgilagach → tekshiruvga; admin tasdiqlaydi.
    router.post('/makeups/:id/held', handle(req => write(req, async c => {
        const me = await teacherOf(req);
        const { rows } = await c.query(`UPDATE school_makeups SET status='review' WHERE id=$1 AND teacher_id=$2 AND status='planned' RETURNING *`, [req.params.id, me.id]);
        if (!rows.length) throw T.fail(409, 'Qoplash topilmadi yoki allaqachon belgilangan');
        return { makeup: rows[0] };
    })));
    router.post('/makeups/double', handle(req => write(req, async c => {
        const me = await teacherOf(req);
        const st = (await c.query('SELECT teacher_id, lesson_duration FROM students WHERE id=$1', [req.body?.studentId])).rows[0];
        if (!st || st.teacher_id !== me.id) throw T.fail(403, 'Bu o\'quvchi sizniki emas');
        const missed = T.assertDate(req.body.missedDate), held = T.assertDate(req.body.heldDate);
        if (missed.slice(0, 7) !== held.slice(0, 7)) throw T.fail(400, 'Qoplash shu oy ichida bo\'ladi');
        const { rows } = await c.query(`INSERT INTO school_makeups (id,student_id,teacher_id,missed_date,held_date,kind,status,created_by)
            VALUES ($1,$2,$3,$4,$5,'double','review',$6) RETURNING *`, [randomUUID(), req.body.studentId, me.id, missed, held, req.user.id])
            .catch(e => { if (e.code === '23505') throw T.fail(409, 'Bu dars uchun qoplash allaqachon bor'); throw e; });
        return { makeup: rows[0] };
    })));
    router.get('/makeups', handle(async req => {
        if (req.user.role === 'teacher') { const me = await teacherOf(req); return { makeups: (await pool.query('SELECT * FROM school_makeups WHERE teacher_id=$1 ORDER BY created_at DESC LIMIT 200', [me.id])).rows }; }
        need(req, FULL);
        return { makeups: (await pool.query(`SELECT * FROM school_makeups WHERE ($1='' OR status=$1) ORDER BY created_at DESC LIMIT 300`, [req.query.status || ''])).rows };
    }));
    router.post('/makeups/:id/decide', handle(req => { need(req, FULL); return write(req, async c => {
        const approve = req.body?.decision === 'approve';
        if (!approve && String(req.body?.note || '').trim().length < 3) throw T.fail(400, 'Rad etish sababini yozing');
        const { rows } = await c.query(`UPDATE school_makeups SET status=$2, decided_by=$3, decided_by_name=$4, decided_at=NOW(), decision_note=$5
            WHERE id=$1 AND status='review' RETURNING *`, [req.params.id, approve ? 'approved' : 'rejected', req.user.id, req.user.name || '', String(req.body?.note || '').slice(0, 300)]);
        if (!rows.length) throw T.fail(409, 'Qoplash tekshiruvda emas');
        return { makeup: rows[0] };
    }); }));

    // ── O'quvchi kartasi va amallar ──────────────────────────────────────────
    async function canSee(req, row) {
        const role = req.user.role;
        if (MANAGE.has(role)) return 'full';
        if (role === 'sales_manager') { const mid = await managerId(req); return O.soldBy(S.studentRow(row), mid) ? 'sales' : null; }
        if (role === 'teacher') {
            const me = await teacherOf(req);
            if (row.teacher_id === me.id) return 'teacher';
            if (row.assistant_teacher_id === me.id) return 'assistant';
            const past = await pool.query('SELECT 1 FROM school_teacher_history WHERE student_id=$1 AND teacher_id=$2', [row.id, me.id]);
            return past.rows.length ? 'past' : null;
        }
        return null;
    }
    router.get('/students/:id/card', handle(async req => {
        const row = (await pool.query('SELECT * FROM students WHERE id=$1', [req.params.id])).rows[0];
        if (!row) throw T.fail(404, 'O\'quvchi topilmadi');
        const scope = await canSee(req, row);
        if (!scope) throw T.fail(403, 'Bu o\'quvchiga ruxsat yo\'q');
        const extra = typeof row.extra_data === 'object' && row.extra_data ? row.extra_data : JSON.parse(row.extra_data || '{}');
        const today = T.nowLocal().date;
        const statuses = await O.statusRows(pool, row.id);
        const group = (await pool.query('SELECT tg_link, name, archived FROM school_student_groups WHERE student_id=$1', [row.id])).rows[0] || null;
        const teachers = (await pool.query('SELECT teacher_id, from_date, to_date FROM school_teacher_history WHERE student_id=$1 ORDER BY from_date', [row.id])).rows;
        const card = { id: row.id, name: row.name, subject: row.subject, avatarUrl: extra.avatarUrl || '', teacherId: row.teacher_id, assistantId: row.assistant_teacher_id,
            schedule: { day: row.lesson_day_of_week, days: T.patternLabel(row.lesson_day_of_week), time: row.lesson_time, duration: row.lesson_duration },
            status: S.statusOn(statuses, today), statuses: statuses.map(s => ({ status: s.status, from: S.dateStr(s.from_date), to: S.dateStr(s.to_date), reason: s.reason })),
            group, teachers: teachers.map(t => ({ teacherId: t.teacher_id, from: S.dateStr(t.from_date), to: S.dateStr(t.to_date) })),
            pendingTeacherChange: extra.pendingTeacherChange || null, startDate: extra.startDate || null, scope };
        if (scope === 'full' || scope === 'sales') {
            Object.assign(card, { phone: row.phone, parentPhone: extra.parentPhone || '', login: extra.login || '', tariff: extra.tariff || '', monthlyPrice: extra.monthlyPrice || null,
                paymentDueDate: extra.paymentDueDate || null, debtAmount: extra.debtAmount ?? null, managerId: extra.managerId || null, schoolRev: extra.schoolRev || 0 });
            card.history = await O.history(pool, row.id);
            card.requests = (await pool.query('SELECT * FROM school_edit_requests WHERE student_id=$1 ORDER BY created_at DESC LIMIT 20', [row.id])).rows;
        }
        if (scope === 'past') { delete card.schedule; delete card.group; }
        for (const k of Object.keys(card)) if (scope !== 'full' && scope !== 'sales' && MONEY_KEYS.test(k)) delete card[k];
        return { card };
    }));
    router.post('/students/:id/edit', handle(async req => {
        const mid = await managerId(req);
        return write(req, c => O.edit(c, req.user, req.params.id, req.body || {}, { managerId: mid }));
    }));
    router.post('/students/:id/freeze', handle(req => write(req, c => O.freeze(c, req.user, req.params.id, req.body || {}).then(r => ({ status: r })))));
    router.post('/students/:id/stop', handle(req => write(req, c => O.stop(c, req.user, req.params.id, req.body || {}).then(r => ({ status: r })))));
    router.post('/students/:id/restore', handle(req => write(req, c => O.restore(c, req.user, req.params.id, req.body || {}))));
    router.post('/students/:id/teacher', handle(req => write(req, c => O.changeTeacher(c, req.user, req.params.id, req.body || {}))));
    router.get('/students/:id/history', handle(async req => {
        const row = (await pool.query('SELECT * FROM students WHERE id=$1', [req.params.id])).rows[0];
        const scope = row && await canSee(req, row);
        if (scope !== 'full' && scope !== 'sales') throw T.fail(403, 'Tarixni ko\'rishga ruxsat yo\'q');
        return { history: await O.history(pool, req.params.id) };
    }));
    // Faol bo'lmagan (muzlatilgan, chiqib ketgan, boshqa ustozga o'tgan) — o'z davri bilan.
    router.get('/inactive', handle(async req => {
        const today = T.nowLocal().date;
        const rows = (await pool.query('SELECT * FROM students')).rows;
        const statuses = (await pool.query('SELECT * FROM school_student_status WHERE cancelled_at IS NULL')).rows;
        const hist = (await pool.query('SELECT * FROM school_teacher_history')).rows;
        const by = new Map(); for (const s of statuses) { if (!by.has(s.student_id)) by.set(s.student_id, []); by.get(s.student_id).push(s); }
        let me = null, mid = null; const isSales = req.user.role === 'sales_manager';
        if (req.user.role === 'teacher') me = (await teacherOf(req)).id; else if (isSales) mid = await managerId(req); else need(req, MANAGE);
        const out = [];
        for (const r of rows) {
            const st = S.studentRow(r), state = S.statusOn(by.get(r.id) || [], today);
            const myPast = me ? hist.filter(h => h.student_id === r.id && h.teacher_id === me && h.to_date && S.dateStr(h.to_date) < today) : [];
            const mine = me ? (r.teacher_id === me || r.assistant_teacher_id === me || myPast.length) : isSales ? O.soldBy(st, mid) : true;
            if (!mine) continue;
            const moved = me && myPast.length && r.teacher_id !== me && r.assistant_teacher_id !== me;
            if (state === 'active' && !moved) continue;
            const last = (by.get(r.id) || []).slice(-1)[0];
            out.push({ id: r.id, name: r.name, avatarUrl: st.avatarUrl, state: moved && state === 'active' ? 'moved' : state,
                from: last ? S.dateStr(last.from_date) : myPast.length ? S.dateStr(myPast.slice(-1)[0].to_date) : null,
                to: last?.to_date ? S.dateStr(last.to_date) : null, reason: last?.reason || '' });
        }
        return { students: out };
    }));

    // ── Sotuv so'rovlari ─────────────────────────────────────────────────────
    router.get('/edit-requests', handle(async req => {
        if (req.user.role === 'sales_manager') return { requests: (await pool.query('SELECT * FROM school_edit_requests WHERE requested_by=$1 ORDER BY created_at DESC LIMIT 100', [req.user.id])).rows };
        need(req, MANAGE);
        const { rows } = await pool.query(`SELECT r.*, s.name AS student_name FROM school_edit_requests r LEFT JOIN students s ON s.id=r.student_id
            WHERE ($1='' OR r.status=$1) ORDER BY r.created_at DESC LIMIT 200`, [req.query.status || '']);
        const counts = (await pool.query('SELECT status, COUNT(*)::int AS n FROM school_edit_requests GROUP BY status')).rows;
        return { requests: rows, counts: Object.fromEntries(counts.map(c => [c.status, c.n])) };
    }));
    router.post('/edit-requests/:id/decide', handle(req => write(req, c => O.decideRequest(c, req.user, req.params.id, req.body || {}).then(r => ({ request: r })))));

    // ── Telegram guruhlar ────────────────────────────────────────────────────
    router.get('/groups', handle(async req => {
        need(req, MANAGE);
        return { groups: (await pool.query(`SELECT g.*, s.name AS student_name, s.teacher_id, s.assistant_teacher_id FROM school_student_groups g
            JOIN students s ON s.id=g.student_id ORDER BY g.name`)).rows, nextName: await O.nextGroupName(pool) };
    }));
    router.put('/students/:id/group', handle(async req => {
        const mid = await managerId(req);
        return write(req, c => O.setGroup(c, req.user, req.params.id, req.body || {}, { managerId: mid }).then(g => ({ group: g })));
    }));
    router.get('/groups/next-name', handle(async req => { need(req, new Set([...MANAGE, 'sales_manager'])); return { name: await O.nextGroupName(pool) }; }));
    router.post('/groups/auto-name', handle(req => { need(req, FULL); return write(req, c => O.autoNameGroups(c, req.user).then(n => ({ named: n }))); }));
    // Ustoz/yordamchi/sotuv: o'z o'quvchilari guruh nomi va havolasi (bosilsa Telegram ochiladi).
    router.get('/my-groups', handle(async req => {
        let rows;
        if (req.user.role === 'teacher') {
            const me = await teacherOf(req);
            rows = (await pool.query(`SELECT g.student_id, g.name, g.tg_link FROM school_student_groups g JOIN students s ON s.id=g.student_id
                WHERE NOT g.archived AND (s.teacher_id=$1 OR s.assistant_teacher_id=$1)`, [me.id])).rows;
        } else if (req.user.role === 'sales_manager') {
            const mid = await managerId(req);
            rows = (await pool.query(`SELECT g.student_id, g.name, g.tg_link FROM school_student_groups g JOIN students s ON s.id=g.student_id
                WHERE NOT g.archived AND s.extra_data->>'managerId' = $1`, [String(mid || '-')])).rows;
        } else { need(req, MANAGE); rows = (await pool.query('SELECT student_id, name, tg_link FROM school_student_groups WHERE NOT archived')).rows; }
        return { groups: rows };
    }));

    // ── Yordamchi aloqalari ──────────────────────────────────────────────────
    router.post('/assist/contacts', handle(req => write(req, c => A.mark(c, req.user, req.body || {}).then(x => ({ contact: x })))));
    router.delete('/assist/contacts/:id', handle(req => write(req, c => A.removeOwnToday(c, req.user, req.params.id).then(x => ({ contact: x })))));
    router.post('/assist/corrections', handle(req => write(req, c => A.adminCorrect(c, req.user, req.body || {}).then(x => ({ contact: x })))));
    router.post('/assist/late-requests', handle(req => write(req, async c => {
        const me = await teacherOf(req);
        const day = T.assertDate(req.body?.day);
        if (await A.isLocked(c, day.slice(0, 7))) throw T.fail(409, 'Oy yakuniy tasdiqlangan — o\'zgartirib bo\'lmaydi');
        const reason = String(req.body?.reason || '').trim(); if (reason.length < 5) throw T.fail(400, 'Sababni yozing');
        const { rows } = await c.query(`INSERT INTO school_requests (id,teacher_id,requester_id,requester_name,type,payload,reason) VALUES ($1,$2,$3,$4,'assist_late',$5,$6) RETURNING *`,
            [randomUUID(), me.id, req.user.id, me.name, JSON.stringify({ studentId: req.body.studentId, day, channel: req.body.channel, minutes: req.body.minutes, at: req.body.at }), reason]);
        return { request: rows[0] };
    })));
    router.get('/assist/month', handle(async req => {
        const month = req.query.month || T.nowLocal().date.slice(0, 7);
        let assistantId = req.query.assistantId;
        if (req.user.role === 'teacher') assistantId = (await teacherOf(req)).id;
        else need(req, MANAGE);
        if (!assistantId) throw T.fail(400, 'Yordamchini tanlang');
        return A.monthReport(pool, assistantId, month);
    }));
    // Asosiy ustoz, ROP, sotuv (o'z o'quvchilari) — o'quvchi bo'yicha aloqalar (faqat o'qish).
    router.get('/students/:id/contacts', handle(async req => {
        const row = (await pool.query('SELECT * FROM students WHERE id=$1', [req.params.id])).rows[0];
        if (!row) throw T.fail(404, 'O\'quvchi topilmadi');
        if (!await canSee(req, row)) throw T.fail(403, 'Ruxsat yo\'q');
        const month = req.query.month || T.nowLocal().date.slice(0, 7);
        const { from, to } = T.monthBounds(month);
        const rows = (await pool.query('SELECT * FROM school_assist_contacts WHERE student_id=$1 AND day BETWEEN $2 AND $3', [row.id, from, to])).rows;
        const r = A.countMonth(rows).students[0] || { counted: 0, noAnswer: 0, items: [] };
        return { month, cap: A.MONTH_CAP, counted: r.counted, noAnswer: r.noAnswer, items: r.items };
    }));
    router.post('/assist/months/:month/:step', handle(req => write(req, c => A.advanceMonth(c, req.user, req.params.month, req.params.step).then(m => ({ month: m })))));

    // ── Xodim: vaqtinchalik parol (parol hech kimga ko'rinmaydi) va avatar ───
    router.post('/staff/:userId/temp-password', handle(req => { need(req, FULL); return write(req, async c => {
        const pass = String(req.body?.password || '');
        if (pass.length < 12) throw T.fail(400, 'Vaqtinchalik parol kamida 12 belgi');
        const u = (await c.query('SELECT id, role FROM users WHERE id=$1 FOR UPDATE', [req.params.userId])).rows[0];
        if (!u) throw T.fail(404, 'Xodim topilmadi');
        await c.query('UPDATE users SET password_hash=$2 WHERE id=$1', [u.id, bcrypt.hashSync(pass, 10)]);
        await c.query('DELETE FROM sessions WHERE user_id=$1', [u.id]);
        await c.query(`INSERT INTO school_student_audit (student_id,action,changes,reason,actor_id,actor_name,actor_role) VALUES ($1,'staff-temp-password','{}',$2,$3,$4,$5)`,
            ['staff:' + u.id, String(req.body?.reason || 'vaqtinchalik parol'), req.user.id, req.user.name || '', req.user.role]);
        return { ok: true };
    }); }));
    // Xodim avatari: 72 ta 3D personajdan biri (/images/staff-avatars/f01..m36.webp) yoki o'z rasmi (/uploads/...).
    // Personaj ikki xodimda bir xil bo'lmaydi. Qiymat oddiy rasm manzili — eski ekranlar ham shu rasmni ko'radi.
    const PRESET_RE = /^\/images\/staff-avatars\/[fm](0[1-9]|[12]\d|3[0-6])\.webp$/;
    router.put('/me/avatar', handle(req => write(req, async c => {
        const v = String(req.body?.avatar || '');
        if (v && !PRESET_RE.test(v) && !/^\/uploads\/[A-Za-z0-9._-]{1,120}$/.test(v)) throw T.fail(400, 'Avatar noto\'g\'ri');
        if (PRESET_RE.test(v)) {
            await c.query("SELECT pg_advisory_xact_lock(hashtext('school:avatars'))");
            const taken = await c.query('SELECT 1 FROM users WHERE avatar=$1 AND id<>$2', [v, req.user.id]);
            if (taken.rows.length) throw T.fail(409, 'Bu personajni boshqa xodim tanlagan');
        }
        await c.query('UPDATE users SET avatar=$2 WHERE id=$1', [req.user.id, v]);
        return { avatar: v };
    })));
    // Xodim avatarlari (HR id → avatar) — CRM ro'yxatlarida 3D personaj yoki o'z rasmi.
    router.get('/staff-avatars', handle(async () => ({ avatars: Object.fromEntries((await pool.query(`SELECT he.id, u.avatar FROM hr_employees he
        JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(he.login)) WHERE COALESCE(u.avatar,'') <> ''`)).rows.map(r => [r.id, r.avatar])) })));
    router.get('/avatars/taken', handle(async req => ({ taken: (await pool.query("SELECT avatar FROM users WHERE avatar LIKE '/images/staff-avatars/%' AND id<>$1", [req.user.id])).rows.map(r => r.avatar) })));
    return router;
};
