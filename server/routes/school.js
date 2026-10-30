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
const R = require('../../js/attendanceRules');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const ropScope = require('../services/ropScope');

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
    // ROP faqat o'z til yo'nalishi (HR'dagi til) o'quvchilarini ko'radi va o'zgartiradi:
    // /students/:id/* (karta, to'lov, tarix, tahrir, muzlatish, ustoz…) — boshqa til → 403.
    const ropLangs = req => (req.user.role === 'rop' ? ropScope.ropLangsFor(pool, req.user) : Promise.resolve(null));
    const subjectOk = (langs, subject) => !langs || langs.includes(ropScope.langOfStudent({ subject }));
    router.use('/students/:id', async (req, res, next) => {
        try {
            const langs = await ropLangs(req);
            if (langs) {
                const row = (await pool.query('SELECT subject FROM students WHERE id=$1', [req.params.id])).rows[0];
                if (row && !subjectOk(langs, row.subject)) return res.status(403).json({ error: 'Bu o\'quvchi boshqa til yo\'nalishida — ROP faqat o\'z yo\'nalishini ko\'radi' });
            }
            next();
        } catch (err) { console.error('[school] rop til', err.message); res.status(503).json({ error: 'Ruxsatni tekshirib bo\'lmadi' }); }
    });
    const handle = fn => async (req, res) => {
        try { res.json(await fn(req)); }
        catch (err) {
            if (!err.status) console.error('[school]', req.method, req.path, err.code || err.message);
            // Bo'sh vaqt o'zgarishi band yozuvlarga tegsa — ro'yxat (faqat admin/boshliq yo'llari qaytaradi).
            res.status(err.status || 500).json({ error: err.status ? err.message : 'Server xatoligi — qayta urinib ko\'ring',
                ...(err.status && err.needConfirm ? { needConfirm: true, conflicts: err.conflicts || [] } : {}) });
        }
    };
    const need = (req, set, msg = 'Bu amalga ruxsat yo\'q') => { if (!set.has(req.user.role)) throw T.fail(403, msg); };
    const write = (req, fn) => tx(client => fn(client), req.user);
    const managerId = async req => req.user.role === 'sales_manager'
        ? (await pool.query('SELECT manager_id FROM user_sales_manager_links WHERE user_id=$1', [req.user.id])).rows[0]?.manager_id || null : null;
    const teacherOf = req => require('../services/teacherDuties').teacherForActor(pool, req.user);
    // 29-okt: "yordamchi sifatida" ko'rinish faqat yordamchi lavozimida; asosiy ustozda eski biriktirish e'tiborga olinmaydi.
    const assistOf = me => require('../services/teacherDuties').hasAssistantDuty(me) ? me.id : null;

    // ── Til (ingliz / rus) ──────────────────────────────────────────────────
    // Jadval til bo'yicha ajratiladi: ingliz ustozi rus lidiga (va aksincha) sinov qo'yilmaydi.
    const LANGS = new Set(['english', 'russian']);
    // Lavozim asosiy (bazada rus ustozlarining lang ustuni 'english' bo'lib qolgan), keyin lang ustuni.
    const langOf = e => !e ? null : e.lang === 'both' ? 'both' : e.role === 'rus-oqituvchi' ? 'russian' : e.role === 'ingliz-oqituvchi' ? 'english' : e.lang === 'russian' ? 'russian' : 'english';
    const fits = (teacherLang, lang) => !lang || teacherLang === 'both' || teacherLang === lang;
    async function teacherLangs() {
        const rows = (await pool.query(`SELECT id, role, lang FROM hr_employees WHERE role IN ('oqituvchi','ingliz-oqituvchi','rus-oqituvchi','yordamchi')`)).rows;
        return new Map(rows.map(r => [r.id, langOf(r)]));
    }
    // Sotuv menejeri faqat o'z tilini ko'radi (lidlari bo'yicha); admin/ROP ?lang= bilan tanlaydi.
    async function reqLang(req) {
        if (req.user.role === 'sales_manager') {
            const mid = await managerId(req);
            const rows = mid ? (await pool.query(`SELECT COALESCE(language,'english') AS l, COUNT(*)::int AS n FROM leads WHERE manager_id=$1 AND deleted_at IS NULL GROUP BY 1`, [mid])).rows : [];
            const ls = rows.map(r => (r.l === 'russian' ? 'russian' : 'english'));
            if (ls.length === 1) return ls[0];
        }
        // ROP o'z til yo'nalishini ko'radi (HR'dagi lang: english/russian; 'both' — tanlaydi).
        if (req.user.role === 'rop') {
            const own = await ropLang(req);
            if (own) return own;
        }
        return LANGS.has(req.query.lang) ? req.query.lang : null;
    }
    async function ropLang(req) {
        const rows = (await pool.query(`SELECT lang FROM hr_employees WHERE LOWER(TRIM(login)) = LOWER(TRIM($1))
            OR LOWER(TRIM(name)) = LOWER(TRIM($2)) ORDER BY (LOWER(TRIM(login)) = LOWER(TRIM($1))) DESC LIMIT 1`, [req.user.email || '', req.user.name || ''])).rows;
        const l = rows[0]?.lang;
        return LANGS.has(l) ? l : null;
    }
    // Guruh nomi tili: ?lang= → sotuv menejeri lidlari → xodimning HR'dagi tili.
    async function groupLang(req) {
        const l = await reqLang(req);
        if (l) return l;
        const e = (await pool.query(`SELECT he.role, he.lang FROM users u JOIN hr_employees he ON LOWER(TRIM(he.login))=LOWER(TRIM(u.email)) WHERE u.id=$1 LIMIT 1`, [req.user.id])).rows[0];
        const own = langOf(e);
        return own === 'russian' ? 'russian' : 'english';
    }
    async function checkLeadTeacherLang(c, leadLanguage, teacherId) {
        const t = (await c.query('SELECT role, lang FROM hr_employees WHERE id=$1', [teacherId])).rows[0];
        const leadLang = leadLanguage === 'russian' ? 'russian' : 'english';
        if (t && !fits(langOf(t), leadLang)) throw T.fail(400, `Lid ${leadLang === 'russian' ? 'rus' : 'ingliz'} tili bo'yicha — bu ustoz ${langOf(t) === 'russian' ? 'rus' : 'ingliz'} tili ustozi. Mos ustozni tanlang`);
    }

    // ── Jadval ───────────────────────────────────────────────────────────────
    async function views(req, from, to, teacherIds, lang = null, { excludeStudentId = null } = {}) {
        const ctx = await S.loadContext(pool, { teacherIds, from, to });
        // O'quvchi tahririda o'zining hozirgi darsi bo'sh vaqtni "band" qilmasin (checkWeekly bilan bir qoida).
        if (excludeStudentId) ctx.students = ctx.students.filter(s => s.id !== excludeStudentId);
        let ids = teacherIds || [...new Set([...ctx.hours.map(h => h.teacher_id), ...ctx.students.map(s => s.teacherId).filter(Boolean)])];
        // Xodimlar ro'yxatida yo'q (o'chirilgan/test) ustoz qatori nomsiz chiqmasin.
        if (lang) { const tl = await teacherLangs(); ids = ids.filter(id => tl.has(id) && fits(tl.get(id), lang)); }
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
        const lang = await reqLang(req);
        if (FULL.has(role)) return { views: await views(req, from, to, teacherId ? [teacherId] : null, lang), scope: 'full', lang };
        // ROP: hamma ustoz, o'quvchi ismlari va bugungi holat (o'z tilida) — "Kim bo'sh?" (mode=free) esa sotuvdagidek.
        if (role === 'rop' && req.query.mode !== 'free') return { views: await views(req, from, to, teacherId ? [teacherId] : null, lang), scope: 'manage', lang };
        if (SALES.has(role)) {
            const v = await views(req, from, to, teacherId ? [teacherId] : null, lang);
            const mid = await managerId(req);
            return { views: v.map(x => S.redactForSales(x, req.user, mid)), scope: 'sales', lang };
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
        if ((r.scope === 'full' || r.scope === 'manage') && from === to) {
            const att = await pool.query(`SELECT student_id, present FROM main_attendance WHERE att_key LIKE $1 AND day=$2`, [from.slice(0, 7) + '\\_%', Number(from.slice(8))]);
            summary = S.daySummary(r.views, new Map(att.rows.map(a => [a.student_id, !!a.present])), from === T.nowLocal().date ? T.nowLocal().min : null);
        }
        // Jadval v2: darslar holati (keldi/kelmadi), qoplash, sinov lidining ismi — sotuvga yuborilmaydi.
        let extra = {};
        if (r.scope !== 'sales') {
            await S.annotateViews(pool, r.views, { from, to });
            if (r.scope === 'own') {
                const me = await teacherOf(req);
                extra.missed = await S.missedLessons(pool, me.id, { from, to });
            } else {
                extra.unassigned = await S.unassignedTrials(pool, { from, to, lang: r.lang });
                extra.managers = (await pool.query('SELECT id, name FROM sales_managers').catch(() => ({ rows: [] }))).rows;
            }
        } else {
            // Sotuv (SotuvJadval "Biriktirilmagan" qatori): ustozsiz sinovlar vaqti; lid ismi faqat o'z lidida.
            const mid = await managerId(req);
            extra.unassigned = (await S.unassignedTrials(pool, { from, to, lang: r.lang })).map(u => {
                const mine = !!mid && String(u.managerId || '') === String(mid);
                return { date: u.date, start: u.start, end: u.end, mine, ...(mine ? { leadId: u.leadId, leadName: u.leadName } : {}) };
            });
        }
        const tl = r.lang ? teachers.filter(t => fits(langOf(t), r.lang)) : teachers;
        return { from, to, scope: r.scope, lang: r.lang || null, teachers: r.scope === 'own' ? undefined : tl, views: r.views, summary, ...extra };
    }));
    // "Kim bo'sh?" — sotuv/ROP uchun: sinovga ochiq bo'sh oraliqlar, 30 daqiqa qadam bilan.
    router.get('/schedule/free', handle(async req => {
        need(req, new Set([...SALES, ...FULL]));
        const from = T.assertDate(req.query.from), to = T.assertDate(req.query.to || from);
        const duration = Math.min(120, Math.max(15, Number(req.query.duration) || 30));
        const purpose = req.query.purpose === 'lesson' ? 'lesson' : 'trial';
        // excludeStudentId — faqat admin/ROP (o'quvchi tahriri); sotuv menejeriga ta'sir qilmaydi.
        let excl = String(req.query.excludeStudentId || '') || null;
        if (excl && !(FULL.has(req.user.role) || req.user.role === 'rop')) {
            // Sotuv menejeri — faqat o'zi sotgan o'quvchi uchun.
            const mid = req.user.role === 'sales_manager' ? await managerId(req) : null;
            const row = mid ? (await pool.query("SELECT 1 FROM students WHERE id=$1 AND extra_data->>'managerId'=$2", [excl, mid])).rows[0] : null;
            if (!row) excl = null;
        }
        const vs = await views(req, from, to, req.query.teacherId ? [req.query.teacherId] : null, await reqLang(req), { excludeStudentId: excl });
        const step = 30, list = [];
        for (const v of vs) {
            const src = purpose === 'trial' ? v.trialFree : v.free;
            for (const f of src) for (let t = Math.ceil(f.start / step) * step; t + duration <= f.end; t += step) list.push({ teacherId: v.teacherId, date: v.date, time: T.fromMin(t) });
        }
        const now = T.nowLocal();
        // Ish vaqti kiritilmagan ustoz (dayView.noHours — 07:00–22:00 taxmin): mijoz "bo'sh: 07:00" kabi taklif qilmasin (BAHO-6).
        const noHours = [...new Set(vs.filter(v => v.noHours).map(v => v.teacherId))];
        return { duration, purpose, slots: list.filter(s => s.date > now.date || T.toMin(s.time) > now.min), noHours };
    }));
    router.post('/bookings', handle(req => write(req, async c => {
        const kind = req.body?.kind;
        if (kind === 'trial') {
            need(req, new Set([...SALES, ...FULL]));
            // Lid mavjud va (sotuv menejeri uchun) o'ziniki bo'lishi shart; sotuv faqat ushlab turadi.
            const lead = (await c.query('SELECT manager_id, language FROM leads WHERE id=$1 AND deleted_at IS NULL', [String(req.body?.leadId || '')])).rows[0];
            if (!lead) throw T.fail(404, 'Lid topilmadi');
            await checkLeadTeacherLang(c, lead.language, String(req.body?.teacherId || ''));
            if (req.user.role === 'sales_manager' && String(lead.manager_id || '') !== String(await managerId(req) || '-')) throw T.fail(403, 'Faqat o\'z lidingiz uchun');
            if (!subjectOk(await ropLangs(req), lead.language)) throw T.fail(403, 'ROP faqat o\'z til yo\'nalishidagi lidga sinov qo\'yadi');
            if (SALES.has(req.user.role)) req.body.hold = true;
        }
        else if (kind === 'makeup') return planMakeup(req, c, req.body);
        else need(req, FULL);
        return { bookings: await S.book(c, req.user, req.body) };
    })));
    router.post('/bookings/group/:group/confirm', handle(req => write(req, c => S.confirmHold(c, req.user, req.params.group).then(b => ({ bookings: b })))));
    // "Kim bo'sh?" → ushlab turilgan vaqtni lidga biriktirish: lid "Sinov darsida" bosqichiga o'tadi
    // (CRM lid oynasidagi bilan bir xil yo'l — lid tarixi, SLA, ustoz tasdig'i). Ushlab turish bekor bo'ladi.
    router.post('/bookings/group/:group/attach-lead', handle(async req => {
        need(req, new Set([...SALES, ...FULL]));
        const holds = (await pool.query(`SELECT * FROM school_bookings WHERE group_id=$1 AND status='hold' AND hold_until >= $3 AND created_by=$2 ORDER BY date`, [req.params.group, req.user.id, new Date()])).rows;
        if (!holds.length) throw T.fail(409, 'Ushlab turish muddati tugagan — vaqtni qaytadan tanlang');
        const row = (await pool.query('SELECT * FROM leads WHERE id=$1 AND deleted_at IS NULL', [String(req.body?.leadId || '')])).rows[0];
        if (!row) throw T.fail(404, 'Lid topilmadi');
        const mid = await managerId(req);
        if (req.user.role === 'sales_manager' && String(row.manager_id || '') !== String(mid || '')) throw T.fail(403, 'Faqat o\'z lidingizni sinovga yozasiz');
        if (!subjectOk(await ropLangs(req), row.language)) throw T.fail(403, 'ROP faqat o\'z til yo\'nalishidagi lidga sinov qo\'yadi');
        await checkLeadTeacherLang(pool, row.language, holds[0].teacher_id);
        const extra = typeof row.extra_data === 'object' && row.extra_data ? row.extra_data : JSON.parse(row.extra_data || '{}');
        const first = holds[0], date = S.dateStr(first.date), min = Number(first.start_min);
        const at = new Date(Date.parse(date + 'T00:00:00Z') + (min - T.TZ_OFFSET_MIN) * 60000).toISOString();
        const teacher = (await pool.query('SELECT name FROM hr_employees WHERE id=$1', [first.teacher_id])).rows[0];
        // Sinov qo'yish oynasi (SotuvSinov): qayta qo'yishda avvalgi natija va lid istagi izohga yoziladi.
        const reschedule = req.body?.reschedule === true;
        const prevOutcome = String(req.body?.prevOutcome || '').trim().slice(0, 200);
        const wish = String(req.body?.wish || '').trim().slice(0, 300);
        const lead = { id: row.id, updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined, status: 'sinov-darsida',
            paymentOnboarding: { ...(extra.paymentOnboarding || {}), teacherId: first.teacher_id, lessonDayOfWeek: T.weekday(date), lessonTime: T.fromMin(min),
                lessonDuration: Number(first.end_min) - Number(first.start_min), trialDaysCount: holds.length, isTrial: true },
            trialLessonAt: at, trialScheduleRevision: randomUUID(), ...(extra.trialUnassigned ? { trialUnassigned: false } : {}),
            comments: [...(Array.isArray(row.comments) ? row.comments : JSON.parse(row.comments || '[]')), { id: randomUUID(), type: 'trial-lesson', author: req.user.name || '', authorId: req.user.id,
                createdAt: new Date().toISOString(), reason: prevOutcome,
                text: [`${reschedule ? 'Qayta sinov darsi tashkil qilindi' : 'Sinov darsi belgilandi'} ("Kim bo'sh?"):`, ...(prevOutcome ? [`• Avvalgi natija: ${prevOutcome}`] : []),
                    `• O'qituvchi: ${teacher?.name || '—'}`, `• Kuni: ${date.split('-').reverse().join('.')}, ${T.fromMin(min)}`, `• Davomiyligi: ${holds.length} kun`,
                    ...(wish ? [`• Lid istagi: ${wish}`] : [])].join('\n') }] };
        const saved = await db.upsertLead(lead, row.language, req.user);
        return { lead: { id: saved.lead.id, status: saved.lead.status } };
    }));
    router.post('/bookings/:id/:action', handle(req => write(req, async c => {
        const action = req.params.action;
        let teacherId = null;
        if (req.user.role === 'teacher') { teacherId = (await teacherOf(req)).id; if (action === 'cancel') throw T.fail(403, 'Bekor qilishni admin qiladi'); }
        else if (SALES.has(req.user.role)) {
            if (action !== 'cancel') throw T.fail(403, 'Natijani ustoz yozadi');
            const b = (await c.query('SELECT created_by, kind, lead_id, teacher_id FROM school_bookings WHERE id=$1', [req.params.id])).rows[0];
            if (!b || b.kind !== 'trial' || (b.created_by !== req.user.id && req.user.role !== 'rop')) throw T.fail(403, 'Faqat o\'zingiz band qilgan sinovni bekor qilasiz');
            // ROP faqat o'z til yo'nalishidagi sinovni bekor qiladi: til — lid tilidan, lid bo'lmasa ustoz tilidan.
            const rl = await ropLangs(req);
            if (rl) {
                const lead = b.lead_id ? (await c.query('SELECT language FROM leads WHERE id=$1', [b.lead_id])).rows[0] : null;
                const tl = lead?.language || (await teacherLangs()).get(b.teacher_id);
                if (tl !== 'both' && !subjectOk(rl, tl)) throw T.fail(403, 'ROP faqat o\'z til yo\'nalishidagi sinovni bekor qiladi');
            }
        } else need(req, FULL);
        return { booking: await S.transition(c, req.params.id, action, { teacherId }) };
    })));
    // Bo'sh vaqtni boshqarish (JadvalQoidalar: "Ish vaqti shabloni" va "Sanaga ochish / yopish" — faqat admin;
    // ustoz va yordamchi so'rov yuboradi, sotuv faqat bo'sh/band ko'radi). Ruxsat shu yerda tekshiriladi.
    router.post('/overrides', handle(req => { need(req, FULL); return write(req, c => S.addOverride(c, req.user, req.body || {}).then(o => ({ override: o }))); }));
    router.put('/overrides/:id', handle(req => { need(req, FULL); return write(req, c => S.updateOverride(c, req.user, req.params.id, req.body || {}).then(o => ({ override: o }))); }));
    router.delete('/overrides/:id', handle(req => { need(req, FULL); return write(req, c => S.removeOverride(c, req.user, req.params.id).then(o => ({ override: o }))); }));
    router.get('/teachers/:id/hours', handle(async req => {
        if (req.user.role === 'teacher' && (await teacherOf(req)).id !== req.params.id) throw T.fail(403, 'Faqat o\'z ish vaqtingiz');
        return { hours: (await pool.query('SELECT * FROM school_teacher_hours WHERE teacher_id=$1 ORDER BY weekday,start_min', [req.params.id])).rows };
    }));
    router.put('/teachers/:id/hours', handle(req => { need(req, FULL); return write(req, c => S.setHours(c, req.user, req.params.id, req.body?.slots, { confirm: req.body?.confirm === true }).then(h => ({ hours: h }))); }));
    // "O'zgarishlar tarixi": admin/boshliq — hamma ustoz; ROP — faqat o'z tilidagi ustoz.
    router.get('/teachers/:id/changes', handle(async req => {
        need(req, MANAGE);
        const t = await S.assertTeacher(pool, req.params.id);
        if (req.user.role === 'rop') {
            const own = await ropLang(req), tl = (await teacherLangs()).get(t.id);
            if (own && !fits(tl, own)) throw T.fail(403, 'Faqat o\'z tilingiz ustozlari');
        }
        return { changes: await S.changes(pool, t.id, { days: Math.min(90, Math.max(1, Number(req.query.days) || 30)) }) };
    }));

    // Ustoz so'rovlari (ta'til, vaqt yopish/ochish) → admin.
    router.post('/requests', handle(req => write(req, async c => {
        const me = await teacherOf(req);
        const type = req.body?.type;
        if (!['leave', 'close', 'open', 'student', 'assist_finance'].includes(type)) throw T.fail(400, 'So\'rov turi noto\'g\'ri');
        // Yordamchi: yopilgan oy bo'yicha Moliyaga murojaat (faqat o'z hisobi; admin/boshliq ko'radi va javob beradi).
        if (type === 'assist_finance') {
            const r = await A.financeRequest(c, me, req.body || {});
            const { rows } = await c.query(`INSERT INTO school_requests (id,teacher_id,requester_id,requester_name,type,payload,reason) VALUES ($1,$2,$3,$4,'assist_finance',$5,$6) RETURNING *`,
                [randomUUID(), me.id, req.user.id, me.name, JSON.stringify(r.payload), r.reason]);
            return { request: rows[0] };
        }
        const reason = String(req.body.reason || '').trim(); if (reason.length < 3) throw T.fail(400, 'Sababni yozing');
        let p = { date: req.body.date, weekday: req.body.weekday, repeat: req.body.repeat, from: req.body.from, to: req.body.to };
        // O'quvchi bo'yicha so'rov (muzlatish, ustoz yoki jadval) — faqat o'z o'quvchisi; admin qo'lda hal qiladi.
        if (type === 'student') {
            const st = (await c.query('SELECT id, name, teacher_id, assistant_teacher_id FROM students WHERE id=$1', [String(req.body.studentId || '')])).rows[0];
            if (!st || (st.teacher_id !== me.id && (!assistOf(me) || st.assistant_teacher_id !== me.id))) throw T.fail(403, 'Bu o\'quvchi sizga biriktirilmagan');
            const TOPICS = ['freeze', 'teacher', 'schedule', 'other'];
            p = { studentId: st.id, studentName: st.name, topic: TOPICS.includes(req.body.topic) ? req.body.topic : 'other' };
        }
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
    // So'rov ta'siri: qaysi darslarga ta'sir qiladi va har biriga taklif qilinadigan qoplash vaqti (faqat o'qish).
    router.get('/requests/:id/impact', handle(async req => {
        need(req, FULL);
        const r = (await pool.query('SELECT * FROM school_requests WHERE id=$1', [req.params.id])).rows[0];
        if (!r) throw T.fail(404, 'So\'rov topilmadi');
        return { impact: await require('../services/school/requestImpact').impact(pool, r) };
    }));
    router.post('/requests/:id/decide', handle(req => { need(req, FULL); return write(req, async c => {
        const r = (await c.query('SELECT * FROM school_requests WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
        if (!r) throw T.fail(404, 'So\'rov topilmadi'); if (r.status !== 'new') throw T.fail(409, 'So\'rov allaqachon hal qilingan');
        const approve = req.body?.decision === 'approve';
        if (!approve && String(req.body?.note || '').trim().length < 3) throw T.fail(400, 'Rad etish sababini yozing');
        let override = null;
        const p = r.payload || {};
        if (approve && !['assist_late', 'student', 'assist_finance'].includes(r.type)) {
            override = await S.addOverride(c, req.user, { teacherId: r.teacher_id, kind: r.type, date: p.date, weekday: p.weekday, repeat: p.repeat,
                from: p.from || '00:00', to: p.to || '24:00', reason: r.reason, confirm: true });
        }
        // "Tasdiqlash + qoplashlarni taklif qilish": ta'til/yopilgan vaqtdagi darslar uchun qoplash rejaga qo'yiladi
        // (jadvalda "rejada", ustoz o'tgach tekshiruvga, admin tasdiqlagach maoshga — mavjud qoplash yo'li).
        const makeups = [];
        const list = approve && ['leave', 'close'].includes(r.type) && Array.isArray(req.body?.makeups) ? req.body.makeups.slice(0, 40) : [];
        if (list.length) {
            const missed = require('../services/school/requestImpact').targetDate(p, T.nowLocal().date);
            if (!missed) throw T.fail(400, 'So\'rov sanasi aniqlanmadi');
            for (const m of list) {
                const st = (await c.query('SELECT id, name, teacher_id, lesson_duration FROM students WHERE id=$1', [String(m.studentId || '')])).rows[0];
                if (!st || st.teacher_id !== r.teacher_id) throw T.fail(400, 'O\'quvchi shu ustozniki emas');
                const date = T.assertDate(m.date);
                if (date.slice(0, 7) !== missed.slice(0, 7)) throw T.fail(400, `${st.name}: qoplash shu oy ichida bo'ladi`);
                const b = await S.book(c, req.user, { kind: 'makeup', teacherId: r.teacher_id, studentId: st.id, date, time: m.time, duration: Number(m.duration) || Number(st.lesson_duration) || 30,
                    note: `So'rov: ${r.reason}`.slice(0, 200) }).catch(e => { throw T.fail(e.status || 409, `${st.name}: ${e.message}`); });
                const row = await c.query(`INSERT INTO school_makeups (id,student_id,teacher_id,missed_date,held_date,kind,booking_id,status,created_by)
                    VALUES ($1,$2,$3,$4,$5,'separate',$6,'planned',$7) RETURNING *`, [randomUUID(), st.id, r.teacher_id, missed, date, b[0].id, req.user.id])
                    .catch(e => { if (e.code === '23505') throw T.fail(409, `${st.name}: bu dars uchun qoplash allaqachon bor`); throw e; });
                makeups.push(row.rows[0]);
            }
        }
        const { rows } = await c.query(`UPDATE school_requests SET status=$2, decided_by=$3, decided_by_name=$4, decided_at=NOW(), decision_note=$5 WHERE id=$1 RETURNING *`,
            [r.id, approve ? 'approved' : 'rejected', req.user.id, req.user.name || '', String(req.body?.note || '').slice(0, 300)]);
        return { request: rows[0], override, makeups };
    }); }));
    // Qoplash: ustoz "Q" yoki "Keldi · 2 dars" belgilagach → tekshiruvga; admin tasdiqlaydi.
    // Qoplash darsini rejaga qo'yish (Dars jadvali → bo'sh vaqt → "Qoplash darsi"). Yagona yo'l: POST /makeups/plan
    // (eski POST /bookings {kind:'makeup'} ham shu funksiyaga keladi — ustoz ilovasining eski versiyalari uchun).
    // Qoida (UstozYoriqnoma "Qoplash darsi qoidalari": "Alohida kunda — faqat o'quvchining dars kuni bo'lmagan kunga
    // qo'yiladi"): ustoz o'quvchining dars kuniga alohida qoplash qo'ya olmaydi — o'sha kuni "Keldi · 2 dars".
    // Qoldirilgan dars — barcha qoplash yo'llari (rejaga qo'yish, alohida kun, qo'shaloq; ustoz va admin) uchun bitta tekshiruv:
    //  • qoldirilgan sana kelajakda emas (hali o'tmagan dars "qoldirilgan" bo'lmaydi);
    //  • o'sha kuni "Keldi" bo'lsa (qaysi ustoz belgilaganidan qat'i nazar) — dars o'tilgan, qoplash kerak emas;
    //  • o'sha kuni o'quvchi faol bo'lgan (muzlatilgan / chiqib ketgan kunning darsi qoplanmaydi — AttendanceRules.activeOn).
    const cameOn = async (c, studentId, missed) => (await c.query('SELECT 1 FROM main_attendance WHERE LEFT(att_key, 7)=$1 AND student_id=$2 AND day=$3 AND present=1 LIMIT 1',
        [missed.slice(0, 7), studentId, Number(missed.slice(8))])).rows.length > 0;
    async function assertMissedLesson(c, studentId, missed) {
        if (missed > T.nowLocal().date) throw T.fail(400, 'Qoldirilgan dars sanasi kelajakda bo\'lmaydi');
        if (await cameOn(c, studentId, missed)) throw T.fail(400, 'Bu sanada o\'quvchi "Keldi" — qoplash kerak emas');
        const st = (await c.query('SELECT id, extra_data FROM students WHERE id=$1', [studentId])).rows[0];
        const statuses = (await c.query('SELECT * FROM school_student_status WHERE student_id=$1 AND cancelled_at IS NULL', [studentId])).rows;
        if (st && !require('../../js/attendanceRules').activeOn(st, statuses, missed)) throw T.fail(409, 'O\'sha kuni o\'quvchi faol emas (muzlatilgan yoki chiqib ketgan) — qoplash kerak emas');
    }
    async function planMakeup(req, c, body = {}) {
        if (req.user.role === 'teacher') { const me = await teacherOf(req); if (body.teacherId !== me.id) throw T.fail(403, 'Faqat o\'z jadvalingizga'); }
        else need(req, FULL);
        const st = (await c.query('SELECT teacher_id, lesson_day_of_week FROM students WHERE id=$1', [body.studentId])).rows[0];
        if (!st || st.teacher_id !== body.teacherId) throw T.fail(403, 'Bu o\'quvchi shu ustozniki emas');
        const missed = T.assertDate(body.missedDate, 'Qoldirilgan dars sanasi');
        const held = T.assertDate(body.date);
        if (missed.slice(0, 7) !== held.slice(0, 7)) throw T.fail(400, 'Qoplash shu oy ichida bo\'ladi');
        if (held < missed) throw T.fail(400, 'Qoplash darsi qoldirilgan darsdan keyin bo\'ladi');
        await assertMissedLesson(c, body.studentId, missed);
        if (req.user.role === 'teacher' && st.lesson_day_of_week != null && T.patternDays(st.lesson_day_of_week).includes(T.weekday(held)))
            throw T.fail(400, 'Qoplash darsi o\'quvchining dars kuni bo\'lmagan kunga qo\'yiladi — dars kunida "Keldi · 2 dars" ni tanlang');
        // Ustoz faqat "Kelmadi" deb belgilangan va hali qoplanmagan darsni tanlaydi (sana qo'lda kiritilmaydi).
        if (req.user.role === 'teacher') {
            const open = (await S.missedLessons(c, body.teacherId, { from: missed, to: missed }))
                .some(m => m.studentId === body.studentId && m.date === missed && !m.makeup);
            if (!open) throw T.fail(400, 'Bu sanada "Kelmadi" deb belgilangan, qoplanmagan dars yo\'q');
        }
        const b = await S.book(c, req.user, { ...body, kind: 'makeup' });
        const m = await c.query(`INSERT INTO school_makeups (id,student_id,teacher_id,missed_date,held_date,kind,booking_id,status,created_by)
            VALUES ($1,$2,$3,$4,$5,'separate',$6,'planned',$7) RETURNING *`, [randomUUID(), body.studentId, body.teacherId, missed, held, b[0].id, req.user.id])
            .catch(e => { if (e.code === '23505') throw T.fail(409, 'Bu dars uchun qoplash allaqachon bor'); throw e; });
        return { bookings: b, makeup: m.rows[0] };
    }
    router.post('/makeups/plan', handle(req => write(req, c => planMakeup(req, c, req.body || {}))));
    router.post('/makeups/:id/held', handle(req => write(req, async c => {
        const me = await teacherOf(req);
        // Rejadagi qoplash faqat o'tgandan keyin (bugun yoki oldin) "o'tkazildi" — tekshiruvga.
        const cur = (await c.query('SELECT student_id, missed_date, held_date FROM school_makeups WHERE id=$1 AND teacher_id=$2', [req.params.id, me.id])).rows[0];
        if (cur?.held_date && S.dateStr(cur.held_date) > T.nowLocal().date) throw T.fail(400, 'Qoplash darsi hali o\'tmagan — o\'tgan kuni belgilang');
        // Rejaga qo'yilgandan keyin qoldirilgan kunga "Keldi" qo'yilgan bo'lsa — dars o'tilgan, qoplash ikki marta sanalmaydi.
        if (cur?.missed_date && await cameOn(c, cur.student_id, S.dateStr(cur.missed_date))) throw T.fail(409, 'Qoldirilgan kunda endi "Keldi" — qoplash kerak emas (admin bekor qiladi)');
        const { rows } = await c.query(`UPDATE school_makeups SET status='review' WHERE id=$1 AND teacher_id=$2 AND status='planned' RETURNING *`, [req.params.id, me.id]);
        if (!rows.length) throw T.fail(409, 'Qoplash topilmadi yoki allaqachon belgilangan');
        return { makeup: rows[0] };
    })));
    // O'tib bo'lingan qoplash darsi (dars kuni bo'lmagan kunda) — darhol tekshiruvga; admin tasdiqlasa maoshga o'tadi.
    // Ustoz o'z o'quvchisi uchun yuboradi → "Tekshiruvda". Admin (Akademik → Davomat) o'quvchining asosiy ustozi
    // nomidan kiritadi — admin o'zi tasdiqlovchi bo'lgani uchun darhol "Tasdiqlandi" (kim kiritgani yoziladi).
    async function makeupOwner(req, c) {
        const st = (await c.query('SELECT teacher_id FROM students WHERE id=$1', [req.body?.studentId])).rows[0];
        if (FULL.has(req.user.role)) {
            if (!st?.teacher_id) throw T.fail(400, 'O\'quvchida asosiy ustoz yo\'q');
            return { teacherId: st.teacher_id, admin: true };
        }
        const me = await teacherOf(req);
        if (!st || st.teacher_id !== me.id) throw T.fail(403, 'Bu o\'quvchi sizniki emas');
        return { teacherId: me.id, admin: false };
    }
    // O'tib bo'lingan qoplash (alohida kun yoki "Keldi · 2 dars") tekshiruvi — planMakeup bilan bir qoida:
    //  • qoldirilgan dars sanasi ≤ qoplash sanasi, ikkalasi bir oyda; qoplash sanasi o'tgan (kelajakka "o'tkazildi" yo'q);
    //  • qoldirilgan sanada "Keldi" bo'lsa — qoplash yo'q (admin uchun ham);
    //  • ustoz: qoldirilgan dars haqiqatan "Kelmadi" deb belgilangan va hali qoplanmagan (S.missedLessons); oy yopilgan bo'lsa — yo'q;
    //    alohida kun — o'quvchining dars kuni bo'lmagan kun; qo'shaloq dars — o'quvchining dars kuni va shu kuni "Keldi" belgilangan.
    async function insertHeldMakeup(req, c, kind) {
        const own = await makeupOwner(req, c);
        const missed = T.assertDate(req.body.missedDate, 'Qoldirilgan dars sanasi'), held = T.assertDate(req.body.heldDate, 'Qoplash sanasi');
        const today = T.nowLocal().date;
        if (missed.slice(0, 7) !== held.slice(0, 7)) throw T.fail(400, 'Qoplash shu oy ichida bo\'ladi');
        // Qoplash qoldirilgan darsdan keyin (yoki shu kuni keyinroq) bo'ladi — oldingi sanaga emas.
        if (held < missed) throw T.fail(400, 'Qoplash darsi qoldirilgan darsdan keyin bo\'ladi');
        if (held > today) throw T.fail(400, kind === 'double' ? 'Qo\'shaloq dars hali o\'tmagan — dars kuni belgilanadi' : 'Qoplash darsi hali o\'tmagan');
        await assertMissedLesson(c, req.body.studentId, missed);
        if (!own.admin) {
            if (held.slice(0, 7) < today.slice(0, 7)) throw T.fail(409, 'Oy yopilgan — qoplashni admin orqali kiriting');
            const open = (await S.missedLessons(c, own.teacherId, { from: missed, to: missed })).some(m => m.studentId === req.body.studentId && m.date === missed && !m.makeup);
            if (!open) throw T.fail(400, 'Bu sanada "Kelmadi" deb belgilangan, qoplanmagan dars yo\'q');
            const ld = (await c.query('SELECT lesson_day_of_week FROM students WHERE id=$1', [req.body.studentId])).rows[0]?.lesson_day_of_week;
            const lessonDay = ld != null && T.patternDays(ld).includes(T.weekday(held));
            if (kind === 'separate' && lessonDay) throw T.fail(400, 'Qoplash darsi o\'quvchining dars kuni bo\'lmagan kunda bo\'ladi — dars kunida "Keldi · 2 dars" ni tanlang');
            if (kind === 'double') {
                if (ld != null && !lessonDay) throw T.fail(400, '"Keldi · 2 dars" faqat o\'quvchining dars kunida — boshqa kunga alohida qoplash darsi qo\'ying');
                const heldCame = (await c.query('SELECT 1 FROM main_attendance WHERE att_key=$1 AND student_id=$2 AND day=$3 AND present=1',
                    [`${held.slice(0, 7)}_${own.teacherId}`, req.body.studentId, Number(held.slice(8))])).rows.length;
                if (!heldCame) throw T.fail(400, 'Qo\'shaloq dars uchun avval shu kuni "Keldi" belgilang');
            }
        }
        const { rows } = await c.query(`INSERT INTO school_makeups (id,student_id,teacher_id,missed_date,held_date,kind,status,created_by,decided_by,decided_by_name,decided_at,decision_note)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [randomUUID(), req.body.studentId, own.teacherId, missed, held, kind, own.admin ? 'approved' : 'review', req.user.id,
            own.admin ? req.user.id : null, own.admin ? req.user.name || '' : null, own.admin ? new Date() : null, own.admin ? 'admin kiritdi (Akademik → Davomat)' : ''])
            .catch(e => { if (e.code === '23505') throw T.fail(409, 'Bu dars uchun qoplash allaqachon bor'); throw e; });
        return { makeup: rows[0] };
    }
    router.post('/makeups/separate', handle(req => write(req, c => insertHeldMakeup(req, c, 'separate'))));
    router.post('/makeups/double', handle(req => write(req, c => insertHeldMakeup(req, c, 'double'))));
    // ?month=YYYY-MM — qoldirilgan yoki qoplangan sanasi shu oyda. Rejadagi qoplash vaqti band (booking) dan.
    // ROP faqat o'qiydi va faqat o'z tilidagi o'quvchilar (Akademik → Davomat uchun).
    router.get('/makeups', handle(async req => {
        // missed_came — qoldirilgan kunida "Keldi" bor: dars o'tilgan, qoplash maoshga o'tmaydi ("Keldi" ustun; yozuv o'chirilmaydi).
        const CAME = `EXISTS (SELECT 1 FROM main_attendance a WHERE LEFT(a.att_key, 7) = TO_CHAR(m.missed_date, 'YYYY-MM') AND a.student_id = m.student_id
            AND a.day = EXTRACT(DAY FROM m.missed_date)::int AND a.present = 1) AS missed_came`;
        if (req.user.role === 'teacher') { const me = await teacherOf(req); return { makeups: (await pool.query(`SELECT m.*, ${CAME} FROM school_makeups m WHERE m.teacher_id=$1 ORDER BY m.created_at DESC LIMIT 200`, [me.id])).rows }; }
        need(req, MANAGE);
        const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : '';
        let lang = '';
        if (req.user.role === 'rop') {
            const e = (await pool.query(`SELECT he.role, he.lang FROM users u JOIN hr_employees he ON LOWER(TRIM(he.login))=LOWER(TRIM(u.email)) WHERE u.id=$1 LIMIT 1`, [req.user.id])).rows[0];
            const own = e ? langOf(e) : null;
            lang = own === 'both' || !own ? (LANGS.has(req.query.lang) ? req.query.lang : 'english') : own;
        }
        return { makeups: (await pool.query(`SELECT m.*, b.start_min, b.end_min, ${CAME} FROM school_makeups m
            LEFT JOIN school_bookings b ON b.id=m.booking_id
            ${lang ? 'JOIN students s ON s.id=m.student_id' : ''}
            WHERE ($1='' OR m.status=$1) AND ($2='' OR TO_CHAR(m.missed_date,'YYYY-MM')=$2 OR TO_CHAR(m.held_date,'YYYY-MM')=$2)
            ${lang ? "AND COALESCE(NULLIF(s.subject,''),'english')=$3" : ''}
            ORDER BY m.created_at DESC LIMIT ${month ? 1000 : 300}`, lang ? [req.query.status || '', month, lang] : [req.query.status || '', month])).rows };
    }));
    router.post('/makeups/:id/decide', handle(req => { need(req, FULL); return write(req, async c => {
        const approve = req.body?.decision === 'approve';
        if (!approve && String(req.body?.note || '').trim().length < 3) throw T.fail(400, 'Rad etish sababini yozing');
        if (approve) {
            const m = (await c.query('SELECT student_id, missed_date FROM school_makeups WHERE id=$1', [req.params.id])).rows[0];
            if (m?.missed_date && await cameOn(c, m.student_id, S.dateStr(m.missed_date))) throw T.fail(409, 'Qoldirilgan kunda "Keldi" bor — bu qoplashni tasdiqlab bo\'lmaydi (maoshga ikki marta o\'tadi), rad eting');
        }
        const { rows } = await c.query(`UPDATE school_makeups SET status=$2, decided_by=$3, decided_by_name=$4, decided_at=NOW(), decision_note=$5
            WHERE id=$1 AND status='review' RETURNING *`, [req.params.id, approve ? 'approved' : 'rejected', req.user.id, req.user.name || '', String(req.body?.note || '').slice(0, 300)]);
        if (!rows.length) throw T.fail(409, 'Qoplash tekshiruvda emas');
        // O'quvchi kartasi "O'zgarishlar tarixi": qoplash qarori (kim, qachon, qaysi kun uchun, sabab).
        const mk = rows[0];
        await O.audit(c, mk.student_id, approve ? 'makeup-approved' : 'makeup-rejected',
            { makeupId: mk.id, missedDate: S.dateStr(mk.missed_date), heldDate: mk.held_date ? S.dateStr(mk.held_date) : null, teacherId: mk.teacher_id, kind: mk.kind },
            mk.decision_note || '', req.user);
        return { makeup: mk };
    }); }));

    // Asosiy ustoz "Kelmadi" belgilari (oy bo'yicha): school_absences + eski yozuvlar uchun ustoz belgilagan, lekin
    // "Keldi" bo'lmagan dars (staff_att_lesson_marks). Ustoz — faqat o'zi; admin/ROP — hammasi. Pul ma'lumoti yo'q.
    router.get('/attendance/absences', handle(async req => {
        const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : T.nowLocal().date.slice(0, 7);
        let teacherId = req.query.teacherId ? String(req.query.teacherId) : '';
        if (req.user.role === 'teacher') teacherId = (await teacherOf(req)).id; else need(req, MANAGE);
        const { from, to } = T.monthBounds(month);
        return { month, absences: await S.teacherAbsences(pool, { from, to, teacherId }) };
    }));

    // Qoplanmagan (qoplash mumkin) darslar — bitta manba: S.missedLessons ("Keldi" ustun, faqat dars kuni, kurs boshlangandan keyin,
    // o'quvchi o'sha kuni faol, kelajak yo'q). Ustoz Bosh / Davomat / Dars jadvalidagi "Qoplash darsi" oynasi shu ro'yxatni ko'rsatadi,
    // qoplash yozish yo'llari (planMakeup, insertHeldMakeup) ham shu qoida bilan tekshiradi.
    // Ustoz — faqat o'zi; admin/ROP — ?teacherId= (bo'lmasa shu oyda o'quvchisi bor barcha asosiy ustozlar). Pul ma'lumoti yo'q.
    router.get('/attendance/missed', handle(async req => {
        const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : T.nowLocal().date.slice(0, 7);
        const { from, to } = T.monthBounds(month);
        let ids, lang = null;
        if (req.user.role === 'teacher') ids = [(await teacherOf(req)).id];
        else {
            need(req, MANAGE);
            lang = req.user.role === 'rop' ? await reqLang(req) : null;
            ids = req.query.teacherId ? [String(req.query.teacherId)]
                : (await pool.query(`SELECT DISTINCT teacher_id FROM students WHERE teacher_id IS NOT NULL
                    AND ($1::text IS NULL OR COALESCE(NULLIF(subject,''),'english')=$1)`, [lang])).rows.map(r => r.teacher_id);
        }
        const missed = [];
        for (const id of ids) for (const m of await S.missedLessons(pool, id, { from, to })) missed.push({ ...m, teacherId: id });
        // ROP — faqat o'z tilidagi o'quvchilar.
        const inLang = lang ? new Set((await pool.query(`SELECT id FROM students WHERE COALESCE(NULLIF(subject,''),'english')=$1`, [lang])).rows.map(r => r.id)) : null;
        return { month, missed: inLang ? missed.filter(m => inLang.has(m.studentId)) : missed };
    }));

    // ── O'quvchi kartasi va amallar ──────────────────────────────────────────
    async function canSee(req, row) {
        const role = req.user.role;
        if (MANAGE.has(role)) return 'full';
        if (role === 'sales_manager') { const mid = await managerId(req); return O.soldBy(S.studentRow(row), mid) ? 'sales' : null; }
        if (role === 'teacher') {
            const me = await teacherOf(req);
            if (row.teacher_id === me.id) return 'teacher';
            if (assistOf(me) && row.assistant_teacher_id === me.id) return 'assistant';
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
            status: S.statusOn(statuses, today), statuses: statuses.map(s => ({ status: s.status, from: S.dateStr(s.from_date), to: S.dateStr(s.to_date), reason: s.reason, ...(O.isFinishedRow(s) ? { finished: true } : {}) })),
            group, teachers: teachers.map(t => ({ teacherId: t.teacher_id, from: S.dateStr(t.from_date), to: S.dateStr(t.to_date) })),
            pendingTeacherChange: extra.pendingTeacherChange || null, startDate: extra.startDate || null, serialCode: extra.serialCode || '', scope };
        card.finished = card.status === 'left' && O.isFinishedRow(statuses.filter(s => s.status === 'left').pop());
        if (scope === 'full' || scope === 'sales') {
            Object.assign(card, { phone: row.phone, parentPhone: extra.parentPhone || '', login: extra.login || '', telegram: extra.telegramUsername || '', tariff: extra.tariff || '', monthlyPrice: extra.monthlyPrice || null,
                paymentDueDate: extra.paymentDueDate || null, debtAmount: extra.debtAmount ?? null, managerId: extra.managerId || null, schoolRev: extra.schoolRev || 0 });
            card.history = await O.history(pool, row.id);
            card.requests = (await pool.query('SELECT * FROM school_edit_requests WHERE student_id=$1 ORDER BY created_at DESC LIMIT 20', [row.id])).rows;
        }
        if (scope === 'past') { delete card.schedule; delete card.group; }
        // Yordamchi (faqat shu o'quvchining HOZIRGI yordamchisi — canSee 'assistant'): "Asosiy ustozga yozish" uchun hamkasb Telegram'i.
        // Telefon berilmaydi — faqat profildagi @username (Sozlamalar → Profil, staff_profile_extra.telegram).
        if (scope === 'assistant') card.mainTeacher = await mainTeacherContact(pool, row.teacher_id);
        for (const k of Object.keys(card)) if (scope !== 'full' && scope !== 'sales' && MONEY_KEYS.test(k)) delete card[k];
        return { card };
    }));
    async function mainTeacherContact(db, teacherId) {
        if (!teacherId) return null;
        const r = (await db.query(`SELECT he.id, he.name, COALESCE(x.telegram,'') AS telegram FROM hr_employees he
            LEFT JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(he.login)) LEFT JOIN staff_profile_extra x ON x.user_id = u.id
            WHERE he.id=$1 LIMIT 1`, [teacherId]).catch(() => ({ rows: [] }))).rows[0];
        if (!r) return null;
        const tg = String(r.telegram || '').trim().replace(/^@?/, '');
        return { id: r.id, name: r.name, telegram: /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(tg) ? '@' + tg : '' };
    }
    // ── Kartaning qo'shimcha bo'limlari: Davomat · O'zlashtirish · To'lovlar · Sotuv tarixi ──
    async function cardRow(req) {
        const row = (await pool.query('SELECT * FROM students WHERE id=$1', [req.params.id])).rows[0];
        if (!row) throw T.fail(404, 'O\'quvchi topilmadi');
        const scope = await canSee(req, row);
        if (!scope) throw T.fail(403, 'Bu o\'quvchiga ruxsat yo\'q');
        const extra = typeof row.extra_data === 'object' && row.extra_data ? row.extra_data : JSON.parse(row.extra_data || '{}');
        return { row, scope, extra };
    }
    router.get('/students/:id/attendance', handle(async req => {
        const { row, scope } = await cardRow(req);
        if (scope === 'past') throw T.fail(403, 'Faqat o\'z davringiz');
        const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : T.nowLocal().date.slice(0, 7);
        const { from, to } = T.monthBounds(month);
        const att = (await pool.query(`SELECT att_key, day, present FROM main_attendance WHERE student_id=$1 AND att_key LIKE $2`, [row.id, month + '\\_%'])).rows;
        const mks = (await pool.query(`SELECT kind, status, TO_CHAR(held_date,'YYYY-MM-DD') AS held, TO_CHAR(missed_date,'YYYY-MM-DD') AS missed FROM school_makeups
            WHERE student_id=$1 AND status IN ('planned','review','approved','rejected') AND (TO_CHAR(missed_date,'YYYY-MM')=$2 OR TO_CHAR(held_date,'YYYY-MM')=$2)`, [row.id, month])).rows;
        const days = T.patternDays(row.lesson_day_of_week || 1);
        const lessonDays = T.dateRange(from, to, 31).filter(d => days.includes(T.weekday(d)));
        const entries = {};
        for (const a of att) entries[Number(a.day)] = { present: Number(a.present) === 1, teacherId: a.att_key.slice(8) };
        // "Kelmadi" — school_absences (Davomat bilan bitta o'qish manbai); shu kuni "Keldi" bo'lsa, "Keldi" qoladi.
        for (const a of await S.teacherAbsences(pool, { from, to, studentIds: [row.id] })) {
            const d = Number(String(a.day).slice(8, 10));
            if (!entries[d]) entries[d] = { present: false, teacherId: a.teacherId };
        }
        // Oydan oldin o'tilgan jonli darslar soni — kunlik ro'yxatda dars raqami (2 × n) uchun.
        const before = (await pool.query(`SELECT COUNT(DISTINCT (LEFT(att_key, 7), day))::int AS n FROM main_attendance
            WHERE student_id=$1 AND LEFT(att_key, 7) < $2 AND present = 1`, [row.id, month])).rows[0]?.n || 0;
        const mkBefore = (await pool.query(`SELECT COUNT(*)::int AS n FROM school_makeups WHERE student_id=$1 AND status='approved' AND TO_CHAR(held_date,'YYYY-MM') < $2`, [row.id, month])).rows[0]?.n || 0;
        return { month, lessonDays, entries, makeups: mks, presentBefore: Number(before) + Number(mkBefore) };
    }));
    router.get('/students/:id/progress', handle(async req => {
        const { row, scope } = await cardRow(req);
        if (scope === 'past') throw T.fail(403, 'Faqat o\'z davringiz');
        let p = null, detail = null;
        const hub = require('../services/academicHub');
        try { p = (await hub.progressForIds(pool, [row.id], { perLesson: true }))[row.id] || null; }
        catch (e) { if (e.code !== '42P01') throw e; } // ilova jadvallari hali yo'q (yangi baza)
        // Darslar bo'yicha natija, xatolar, 14 kunlik faollik, imtihonlar (faqat o'qish).
        if (p) { try { detail = await hub.studentDetailById(pool, row.id); } catch (e) { if (e.code !== '42P01') throw e; } }
        return { progress: p, detail };
    }));
    router.get('/students/:id/payments', handle(async req => {
        const { row, scope, extra } = await cardRow(req);
        if (scope !== 'full' && scope !== 'sales') throw T.fail(403, 'To\'lovlar ustozga ko\'rsatilmaydi');
        const ready = (await pool.query("SELECT to_regclass('public.payment_records')::text AS t")).rows[0]?.t;
        const voids = ready && (await pool.query("SELECT to_regclass('public.payment_record_voids')::text AS t")).rows[0]?.t;
        const leadId = extra.leadRef?.id || null;
        const rows = ready ? (await pool.query(`SELECT r.id, r.amount, TO_CHAR(r.paid_date,'YYYY-MM-DD') AS paid_date, r.method, r.form, r.manager_id, r.receipt_url, u.name AS actor_name, u.role AS actor_role
            ${voids ? ", EXISTS (SELECT 1 FROM payment_record_voids v WHERE v.record_id=r.id) AS voided, (SELECT v.reason FROM payment_record_voids v WHERE v.record_id=r.id) AS void_reason" : ', false AS voided, NULL AS void_reason'}
            FROM payment_records r LEFT JOIN users u ON u.id=r.actor_id WHERE r.student_id=$1 OR ($2::text IS NOT NULL AND r.lead_id=$2) ORDER BY r.paid_date DESC, r.id`, [row.id, leadId])).rows : [];
        const names = new Map((await pool.query('SELECT id, name FROM hr_employees')).rows.map(r => [r.id, r.name]));
        // Shartnoma (lid so'rovnomasidan, faqat o'qish): raqam, turi, kurs summasi.
        let contract = null;
        if (leadId) {
            const lx = (await pool.query('SELECT extra_data FROM leads WHERE id=$1', [leadId])).rows[0]?.extra_data;
            const l = typeof lx === 'object' && lx ? lx : JSON.parse(lx || '{}'), ob = l.paymentOnboarding || {}, ps = l.paymentSurvey || {};
            const total = Number(ps.totalAmount) || null;
            if (ob.contractNumber || total) contract = { number: ob.contractNumber ? String(ob.contractNumber) : '', type: ob.contractTypeLabel || '', total, paymentType: ps.paymentTypeLabel || ps.paymentType || '' };
        }
        return { payments: rows.map(r => ({ id: r.id, amount: Number(r.amount), date: r.paid_date, method: r.method, form: r.form, voided: !!r.voided, voidReason: r.void_reason || '',
                receipt: /^\/uploads\/[\w-]+\.(?:png|jpe?g|webp|pdf)$/i.test(r.receipt_url || '') || /^\/api\/finance\/evidence\/[0-9a-f-]{36}$/.test(r.receipt_url || '') ? r.receipt_url : '', manager: names.get(r.manager_id) || '', actor: r.actor_name || '', actorRole: r.actor_role || '' })),
            tariff: extra.tariff || '', monthlyPrice: extra.monthlyPrice || null, paymentDueDate: extra.paymentDueDate || null, debtAmount: extra.debtAmount ?? null,
            paidAmount: extra.paidAmount ?? null, startDate: extra.startDate || null, contract };
    }));
    router.get('/students/:id/sales', handle(async req => {
        const { scope, extra } = await cardRow(req);
        if (scope !== 'full' && scope !== 'sales') throw T.fail(403, 'Sotuv tarixi ustozga ko\'rsatilmaydi');
        const leadId = extra.leadRef?.id || null;
        const lead = leadId ? (await pool.query('SELECT id, status, manager_id, language, created_at, extra_data, comments FROM leads WHERE id=$1', [leadId])).rows[0] : null;
        if (!lead) return { lead: null };
        const lx = typeof lead.extra_data === 'object' && lead.extra_data ? lead.extra_data : JSON.parse(lead.extra_data || '{}');
        const comments = Array.isArray(lead.comments) ? lead.comments : JSON.parse(lead.comments || '[]');
        const names = new Map((await pool.query('SELECT id, name FROM hr_employees')).rows.map(r => [r.id, r.name]));
        return { lead: { id: lead.id, status: lead.status, source: lx.source || '', manager: names.get(lead.manager_id) || '', saleManager: names.get(lx.saleManagerId) || '',
            createdAt: lead.created_at, trialLessonAt: lx.trialLessonAt || null, closedDate: lx.paymentClosedSurvey?.closedDate || lx.closedDate || null,
            comments: comments.slice(-40).reverse().map(c => ({ type: c.type || '', text: String(c.text || '').slice(0, 600), author: c.author || '', at: c.createdAt || c.at || null })) } };
    }));
    router.post('/students/:id/edit', handle(async req => {
        const mid = await managerId(req);
        return write(req, c => O.edit(c, req.user, req.params.id, req.body || {}, { managerId: mid }));
    }));
    router.post('/students/:id/freeze', handle(req => write(req, c => O.freeze(c, req.user, req.params.id, req.body || {}).then(r => ({ status: r })))));
    router.post('/students/:id/stop', handle(req => write(req, c => O.stop(c, req.user, req.params.id, req.body || {}).then(r => ({ status: r })))));
    // "Kursni tugatdi" (admin/ROP): 'left' + reason_code='finished' — /inactive da "Tugatgan".
    router.post('/students/:id/finish', handle(req => write(req, c => O.finish(c, req.user, req.params.id, req.body || {}).then(r => ({ status: r, finished: true })))));
    router.post('/students/:id/restore', handle(req => write(req, c => O.restore(c, req.user, req.params.id, req.body || {}))));
    router.post('/students/:id/teacher', handle(req => write(req, async c => {
        const st = (await c.query('SELECT subject FROM students WHERE id=$1', [req.params.id])).rows[0];
        if (st && req.body?.teacherId) await checkLeadTeacherLang(c, st.subject, String(req.body.teacherId)).catch(e => { throw T.fail(400, e.message.replace('Lid ', 'O\'quvchi ')); });
        return O.changeTeacher(c, req.user, req.params.id, req.body || {});
    })));
    router.get('/students/:id/history', handle(async req => {
        const row = (await pool.query('SELECT * FROM students WHERE id=$1', [req.params.id])).rows[0];
        const scope = row && await canSee(req, row);
        if (scope !== 'full' && scope !== 'sales') throw T.fail(403, 'Tarixni ko\'rishga ruxsat yo\'q');
        return { history: await O.history(pool, req.params.id) };
    }));
    // Faol bo'lmagan (muzlatilgan, chiqib ketgan, boshqa ustozga o'tgan) — o'z davri bilan.
    // Sotuv menejeri: o'zi sotgan faol o'quvchilar — asosiy ustoz davomati va yordamchi aloqalari (faqat o'qish).
    // Summalar yo'q. Davomat moliya qoidasida: dars kunidagi "Keldi" + tasdiqlangan qoplash.
    router.get('/sold-students', handle(async req => {
        need(req, new Set(['sales_manager', ...MANAGE]));
        const td = T.nowLocal().date, month = td.slice(0, 7), { from, to } = T.monthBounds(month);
        const mid = req.user.role === 'sales_manager' ? await managerId(req) : (req.query.managerId || null);
        if (!mid) return { month, students: [] };
        const rl = await ropLangs(req);
        const rows = (await pool.query('SELECT * FROM students')).rows.map(r => ({ row: r, st: S.studentRow(r) }))
            .filter(x => O.soldBy(x.st, mid) && !x.st.legacyInactive && !x.st.isStaffDemo && subjectOk(rl, x.row.subject));
        const ids = rows.map(x => x.row.id);
        if (!ids.length) return { month, students: [] };
        const names = new Map((await pool.query(`SELECT id, name FROM hr_employees`)).rows.map(r => [r.id, r.name]));
        const att = (await pool.query(`SELECT att_key, student_id, day, present FROM main_attendance WHERE student_id = ANY($1::text[]) AND att_key LIKE $2`, [ids, month + '\\_%'])).rows;
        const mks = (await pool.query(`SELECT m.student_id, m.teacher_id, m.kind, m.status, TO_CHAR(m.held_date,'YYYY-MM-DD') AS held, TO_CHAR(m.missed_date,'YYYY-MM-DD') AS missed,
            EXISTS (SELECT 1 FROM main_attendance a WHERE LEFT(a.att_key, 7) = TO_CHAR(m.missed_date, 'YYYY-MM') AND a.student_id = m.student_id
                AND a.day = EXTRACT(DAY FROM m.missed_date)::int AND a.present = 1) AS missed_came FROM school_makeups m
            WHERE m.student_id = ANY($1::text[]) AND m.status IN ('planned','review','approved') AND TO_CHAR(m.missed_date,'YYYY-MM')=$2`, [ids, month])).rows;
        const contacts = (await pool.query(`SELECT * FROM school_assist_contacts WHERE student_id = ANY($1::text[]) AND day BETWEEN $2 AND $3`, [ids, from, to])).rows;
        const statuses = (await pool.query('SELECT * FROM school_student_status WHERE student_id = ANY($1::text[]) AND cancelled_at IS NULL', [ids])).rows;
        // "Kelmadi" — school_absences (Davomat bilan bitta o'qish manbai).
        const absList = await S.teacherAbsences(pool, { from, to, studentIds: ids }).catch(() => []);
        let progress = {}; try { progress = await require('../services/academicHub').progressForIds(pool, ids); } catch { progress = {}; }
        const ws = T.weekStart(td);
        const out = [];
        for (const { row, st } of rows) {
            const state = !statuses.some(x => x.student_id === row.id) && st.legacyFrozen ? 'frozen' : S.statusOn(statuses.filter(x => x.student_id === row.id), td);
            if (state === 'left') continue;
            const days = T.patternDays(st.day || 1);
            const lessonDays = T.dateRange(from, to, 31).filter(d => days.includes(T.weekday(d)));
            const mine = att.filter(a => a.student_id === row.id && a.att_key.endsWith('_' + (st.teacherId || '')));
            const dayOf = n => `${month}-${String(n).padStart(2, '0')}`;
            const present = new Set(mine.filter(a => Number(a.present) === 1).map(a => dayOf(a.day)).filter(d => lessonDays.includes(d)));
            const absent = mine.filter(a => Number(a.present) === 0).map(a => dayOf(a.day));
            // Hisobga o'tgan — bitta manba (js/attendanceRules.js monthTotals): ustoz Davomati, karta va maosh bilan bir xil
            // (o'quvchining dars kuni va faol kuni, tasdiqlangan qoplash, qoldirilgan kunida "Keldi" bor qoplash sanalmaydi).
            const own = { id: row.id, teacherId: st.teacherId || '', lessonDayOfWeek: st.day || 1, lessonTime: st.time, startDate: A.studentStartOf(row.extra_data) || null,
                statusHistory: statuses.filter(x => x.student_id === row.id).map(x => ({ status: x.status, from: S.dateStr(x.from_date), to: x.to_date ? S.dateStr(x.to_date) : null, at: x.created_at })) };
            const marks = Object.fromEntries(mine.map(a => [Number(a.day), Number(a.present) === 1 ? 1 : 0]));
            for (const a of absList) if (a.studentId === row.id && a.teacherId === st.teacherId) { const d = Number(String(a.day).slice(8, 10)); if (marks[d] !== 1) marks[d] = 0; }
            const mt = R.monthTotals({ id: st.teacherId || '', month, students: [own], mainAtt: { [row.id]: marks }, teacher: {}, todayKey: td,
                makeups: mks.filter(m => m.student_id === row.id).map(m => ({ ...m, held_date: m.held, missed_date: m.missed })) }).rows[0];
            const counted = mt ? mt.counted : 0;
            const coveredN = mt ? mt.covered : 0;
            const passedPlan = lessonDays.filter(d => d <= td).length;
            const nextDay = lessonDays.find(d => d > td || (d === td && (T.toMin(st.time) ?? 0) > T.nowLocal().min)) || null;
            const cr = A.countMonth(contacts.filter(c => c.student_id === row.id && c.assistant_id === (row.assistant_teacher_id || '')).map(c => ({ ...c, day: S.dateStr(c.day) })),
                { starts: { [row.id]: A.studentStartOf(row.extra_data) } });
            const ci = cr.students[0]?.items || [];
            const last = ci[ci.length - 1] || null;
            const p = progress[row.id] || null;
            out.push({ id: row.id, name: row.name, state, schedule: { day: st.day, time: st.time, duration: st.duration },
                teacherId: row.teacher_id || '', teacherName: names.get(row.teacher_id) || '', assistantId: row.assistant_teacher_id || '', assistantName: names.get(row.assistant_teacher_id) || '',
                lessons: { counted: Math.min(counted, lessonDays.length), plan: mt ? mt.plan : lessonDays.length, passedPlan: mt ? mt.expected : passedPlan,
                    present: mt ? mt.came : mine.filter(a => Number(a.present) === 1).length, absent: mt ? mt.absent : absent.length, covered: coveredN, next: nextDay ? { date: nextDay, time: st.time } : null },
                contacts: row.assistant_teacher_id ? { counted: cr.counted, week: ci.filter(i => i.day >= ws && i.status === 'counted').length, noAnswer: cr.noAnswer, last: last ? { day: last.day, status: last.status, channel: last.channel } : null } : null,
                app: p ? { reached: p.reached, firstTryAvg: p.firstTryAvg, daysIdle: p.daysIdle, flags: (p.flags || []).map(f => f.key) } : null });
        }
        out.sort((a, b) => a.name.localeCompare(b.name));
        return { month, students: out };
    }));
    router.get('/inactive', handle(async req => {
        const today = T.nowLocal().date;
        const rows = (await pool.query('SELECT * FROM students')).rows;
        const statuses = (await pool.query('SELECT * FROM school_student_status WHERE cancelled_at IS NULL ORDER BY from_date, created_at')).rows;
        const hist = (await pool.query('SELECT * FROM school_teacher_history ORDER BY from_date, created_at')).rows;
        const by = new Map(); for (const s of statuses) { if (!by.has(s.student_id)) by.set(s.student_id, []); by.get(s.student_id).push(s); }
        let me = null, mid = null, meA = null; const isSales = req.user.role === 'sales_manager';
        if (req.user.role === 'teacher') { const own = await teacherOf(req); me = own.id; meA = assistOf(own); } else if (isSales) mid = await managerId(req); else need(req, MANAGE);
        const out = [], changed = [];
        const recent = T.addDays(today, -30);
        const rl = await ropLangs(req);
        for (const r of rows) {
            if (!subjectOk(rl, r.subject)) continue;
            const st = S.studentRow(r), state = S.statusOn(by.get(r.id) || [], today);
            const myPast = me ? hist.filter(h => h.student_id === r.id && h.teacher_id === me && h.to_date && S.dateStr(h.to_date) < today) : [];
            const asMine = !!meA && r.assistant_teacher_id === meA;
            const mine = me ? (r.teacher_id === me || asMine || myPast.length) : isSales ? O.soldBy(st, mid) : true;
            if (!mine) continue;
            const moved = me && myPast.length && r.teacher_id !== me && !asMine;
            // Sotuv: ustozi yaqinda (30 kun) almashgan faol o'quvchi — ma'lumot uchun, alohida bo'lim.
            if (state === 'active' && !moved) {
                const ch = !me && hist.filter(h => h.student_id === r.id && h.to_date && S.dateStr(h.to_date) >= recent && S.dateStr(h.to_date) <= today).slice(-1)[0];
                if (ch) changed.push({ id: r.id, from: ch.teacher_id, to: r.teacher_id, date: S.dateStr(T.addDays(S.dateStr(ch.to_date), 1)), reason: ch.reason || '' });
                continue;
            }
            const sr = by.get(r.id) || [];
            const last = sr.slice(-1)[0];
            const mv = moved && state === 'active', past = myPast.slice(-1)[0];
            // Kursni tugatgan: oxirgi 'left' yozuvi reason_code='finished' (admin "Kursni tugatdi" bilan qo'ygan).
            const finished = state === 'left' && O.isFinishedRow(sr.filter(x => x.status === 'left').pop());
            const shown = mv ? 'moved' : finished ? 'finished' : state;
            out.push({ id: r.id, name: r.name, avatarUrl: st.avatarUrl, state: shown, status: shown, finished,
                from: mv ? S.dateStr(past.to_date) : last ? S.dateStr(last.from_date) : past ? S.dateStr(past.to_date) : null,
                to: !mv && last?.to_date ? S.dateStr(last.to_date) : null, reason: mv ? past.reason || '' : last?.reason || '',
                role: me ? (r.teacher_id === me || (moved && myPast.length) ? 'main' : 'assistant') : null,
                withMe: me && myPast.length ? { from: S.dateStr(myPast[0].from_date), to: S.dateStr(myPast.slice(-1)[0].to_date) } : null });
        }
        // Kartalar uchun qo'shimcha (faqat o'qish): jadval, ustozlar, o'tilgan darslar, aloqalar, ilovadagi dars.
        // Ustoz/yordamchi — faqat o'z davri; summa va to'lov yo'q (sotuv/admin — to'lov sanasi).
        const ids = [...out.map(x => x.id), ...changed.map(x => x.id)];
        if (ids.length) {
            const names = new Map((await pool.query('SELECT id, name FROM hr_employees')).rows.map(r => [r.id, r.name]));
            const rowBy = new Map(rows.map(r => [r.id, r]));
            const att = (await pool.query(`SELECT student_id, att_key, COUNT(*)::int AS n FROM main_attendance WHERE student_id = ANY($1::text[]) AND present = 1 GROUP BY student_id, att_key`, [ids])).rows;
            const con = (await pool.query(`SELECT student_id, assistant_id, TO_CHAR(day,'YYYY-MM') AS m, COUNT(*)::int AS n, TO_CHAR(MIN(day),'YYYY-MM-DD') AS first, TO_CHAR(MAX(day),'YYYY-MM-DD') AS last FROM school_assist_contacts
                WHERE student_id = ANY($1::text[]) AND outcome <> 'no_answer' AND removed_at IS NULL GROUP BY student_id, assistant_id, TO_CHAR(day,'YYYY-MM')`, [ids])).rows;
            const grp = new Map((await pool.query('SELECT student_id, name, tg_link FROM school_student_groups WHERE student_id = ANY($1::text[])', [ids])).rows.map(g => [g.student_id, g]));
            let prog = {}; try { prog = await require('../services/academicHub').progressForIds(pool, ids); } catch { prog = {}; }
            const money = !me;
            const detail = id => {
                const r = rowBy.get(id), st = S.studentRow(r), x = {};
                x.teacherId = r.teacher_id || ''; x.teacherName = names.get(r.teacher_id) || '';
                x.assistantId = r.assistant_teacher_id || ''; x.assistantName = names.get(r.assistant_teacher_id) || '';
                x.schedule = { day: r.lesson_day_of_week, days: T.patternLabel(r.lesson_day_of_week || 1), time: r.lesson_time || '' };
                x.startDate = st.startDate || null;
                const mineAtt = att.filter(a => a.student_id === id && (!me || a.att_key.endsWith('_' + me)));
                x.lessons = mineAtt.reduce((n, a) => n + a.n, 0);
                const mineCon = con.filter(c => c.student_id === id && (!me || c.assistant_id === me));
                x.contacts = { total: mineCon.reduce((n, c) => n + c.n, 0), byMonth: Object.fromEntries(mineCon.map(c => [c.m, c.n])),
                    first: mineCon.map(c => c.first).sort()[0] || null, last: mineCon.map(c => c.last).sort().pop() || null };
                x.reached = prog[id]?.reached ?? null;
                if (!me || r.teacher_id === me || (meA && r.assistant_teacher_id === meA)) { const g = grp.get(id); x.group = g ? { name: g.name, link: g.tg_link || '' } : null; }
                if (money) { const ex = typeof r.extra_data === 'object' && r.extra_data ? r.extra_data : JSON.parse(r.extra_data || '{}'); x.paymentDueDate = ex.paymentDueDate || null; }
                return x;
            };
            for (const s of out) Object.assign(s, detail(s.id));
            // Kursni tugatgan: kurs davri (boshlanish → oxirgi dars).
            for (const s of out) if (s.finished) s.course = { from: s.withMe?.from || s.startDate || null, to: s.from ? T.addDays(s.from, -1) : null };
            // Sotuv / admin: muzlatishda to'lov sanasi qancha surilgani, eslatma va qayta jalb qo'ng'irog'i.
            if (!me) {
                const F = require('../services/school/followups');
                const fol = await F.forStudents(pool, out.map(s => s.id));
                for (const s of out) {
                    const f = fol.get(s.id);
                    if (s.state === 'frozen') {
                        const fr = (by.get(s.id) || []).filter(x => x.status === 'frozen').pop();
                        const days = Number(fr?.payload?.days || 0);
                        if (days && s.paymentDueDate) s.paymentShift = { from: T.addDays(String(s.paymentDueDate).slice(0, 10), -days), to: String(s.paymentDueDate).slice(0, 10), days };
                        s.reminder = f?.reminder || null;
                    }
                    if (s.state === 'left') { s.winback = F.winbackPlan(f, s.from); s.lastCall = f?.lastCall || null; s.calls = f?.calls || 0; }
                }
            }
            for (const c of changed) Object.assign(c, detail(c.id), { name: rowBy.get(c.id).name, avatarUrl: S.studentRow(rowBy.get(c.id)).avatarUrl, fromName: names.get(c.from) || '' });
        }
        return { students: out, changed };
    }));

    // ── Faol emas o'quvchi: "Qaytish oldidan eslatma" va "Qayta jalb · Qo'ng'iroq qildim" ──
    // Sotuv menejeri — faqat o'zi sotgan o'quvchi; admin/boshliq/ROP — hammasi; ustoz/yordamchi — yo'q.
    const F = require('../services/school/followups');
    async function followupStudent(req, id) {
        const row = (await pool.query('SELECT * FROM students WHERE id=$1', [id])).rows[0];
        if (!row) throw T.fail(404, 'O\'quvchi topilmadi');
        if (MANAGE.has(req.user.role)) return row;
        if (req.user.role === 'sales_manager' && O.soldBy(S.studentRow(row), await managerId(req))) return row;
        throw T.fail(403, 'Bu o\'quvchiga ruxsat yo\'q');
    }
    router.post('/students/:id/followups', handle(async req => {
        await followupStudent(req, req.params.id);
        return { followup: await F.create(pool, req.user, req.params.id, req.body || {}) };
    }));
    router.post('/students/:id/calls', handle(async req => {
        await followupStudent(req, req.params.id);
        return { call: await F.logCall(pool, req.user, req.params.id, req.body || {}) };
    }));
    router.delete('/followups/:id', handle(async req => {
        const f = await F.row(pool, req.params.id);
        if (!f) throw T.fail(404, 'Eslatma topilmadi');
        await followupStudent(req, f.student_id);
        return { followup: await F.cancel(pool, req.user, req.params.id, { manage: MANAGE.has(req.user.role) }) };
    }));

    // ── Sotuv so'rovlari ─────────────────────────────────────────────────────
    router.get('/edit-requests', handle(async req => {
        if (req.user.role === 'sales_manager') return { requests: (await pool.query('SELECT * FROM school_edit_requests WHERE requested_by=$1 ORDER BY created_at DESC LIMIT 100', [req.user.id])).rows };
        need(req, MANAGE);
        const rl = await ropLangs(req);
        const { rows } = await pool.query(`SELECT r.*, s.name AS student_name FROM school_edit_requests r LEFT JOIN students s ON s.id=r.student_id
            WHERE ($1='' OR r.status=$1) AND ($2::text[] IS NULL OR COALESCE(NULLIF(s.subject,''),'english') = ANY($2::text[]))
            ORDER BY r.created_at DESC LIMIT 200`, [req.query.status || '', rl]);
        const counts = (await pool.query(`SELECT r.status, COUNT(*)::int AS n FROM school_edit_requests r LEFT JOIN students s ON s.id=r.student_id
            WHERE ($1::text[] IS NULL OR COALESCE(NULLIF(s.subject,''),'english') = ANY($1::text[])) GROUP BY r.status`, [rl])).rows;
        return { requests: rows, counts: Object.fromEntries(counts.map(c => [c.status, c.n])) };
    }));
    // Tasdiqdan oldin server tekshiruvi (yozmaydi): bo'sh vaqt, tarif, to'lovga ta'sir.
    router.get('/edit-requests/:id/check', handle(async req => {
        need(req, MANAGE);
        const rl = await ropLangs(req);
        if (rl) {
            const r = (await pool.query('SELECT s.subject FROM school_edit_requests r LEFT JOIN students s ON s.id=r.student_id WHERE r.id=$1', [req.params.id])).rows[0];
            if (r && !subjectOk(rl, r.subject)) throw T.fail(403, 'Bu so\'rov boshqa til yo\'nalishidagi o\'quvchi bo\'yicha');
        }
        return write(req, c => O.checkRequest(c, req.params.id));
    }));
    router.post('/edit-requests/:id/decide', handle(async req => {
        const rl = await ropLangs(req);
        if (rl) {
            const r = (await pool.query('SELECT s.subject FROM school_edit_requests r LEFT JOIN students s ON s.id=r.student_id WHERE r.id=$1', [req.params.id])).rows[0];
            if (r && !subjectOk(rl, r.subject)) throw T.fail(403, 'Bu so\'rov boshqa til yo\'nalishidagi o\'quvchi bo\'yicha');
        }
        return write(req, c => O.decideRequest(c, req.user, req.params.id, req.body || {}).then(r => ({ request: r })));
    }));

    // ── Telegram guruhlar ────────────────────────────────────────────────────
    router.get('/groups', handle(async req => {
        need(req, MANAGE);
        const rl = await ropLangs(req);
        return { groups: (await pool.query(`SELECT g.*, s.name AS student_name, s.teacher_id, s.assistant_teacher_id, s.subject,
                COALESCE(s.extra_data->>'saleManagerId', s.extra_data->>'managerId', '') AS manager_id FROM school_student_groups g
            JOIN students s ON s.id=g.student_id WHERE COALESCE(s.extra_data->>'isStaffDemo', 'false') <> 'true'
              AND ($1::text[] IS NULL OR COALESCE(NULLIF(s.subject,''),'english') = ANY($1::text[])) ORDER BY g.name`, [rl])).rows, nextName: await O.nextGroupName(pool, await groupLang(req)) };
    }));
    router.put('/students/:id/group', handle(async req => {
        const mid = await managerId(req);
        return write(req, c => O.setGroup(c, req.user, req.params.id, req.body || {}, { managerId: mid }).then(g => ({ group: g })));
    }));
    router.put('/students/:id/group/members', handle(req => { need(req, MANAGE); return write(req, c => O.setGroupMembers(c, req.user, req.params.id, req.body || {}).then(g => ({ group: g }))); }));
    router.get('/groups/next-name', handle(async req => { need(req, new Set([...MANAGE, 'sales_manager'])); return { name: await O.nextGroupName(pool, await groupLang(req)) }; }));
    router.post('/groups/auto-name', handle(req => { need(req, FULL); return write(req, c => O.autoNameGroups(c, req.user).then(n => ({ named: n }))); }));
    // Ustoz/yordamchi/sotuv: o'z o'quvchilari guruh nomi va havolasi (bosilsa Telegram ochiladi).
    router.get('/my-groups', handle(async req => {
        let rows;
        if (req.user.role === 'teacher') {
            const me = await teacherOf(req);
            rows = (await pool.query(`SELECT g.student_id, g.name, g.tg_link FROM school_student_groups g JOIN students s ON s.id=g.student_id
                WHERE NOT g.archived AND (s.teacher_id=$1 OR s.assistant_teacher_id=$2::text)`, [me.id, assistOf(me)])).rows;
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
    // Bir yordamchining o'tgan kunlardagi aloqalarini bir martada kiritish (masalan oktyabr: belgilash tizimi 27-oktgacha yo'q edi).
    // Hammasi bitta tranzaksiyada; shu o'quvchi bilan shu kunda yozuv bor bo'lsa — o'tkazib yuboriladi.
    router.post('/assist/corrections/bulk', handle(req => write(req, async c => {
        need(req, FULL);
        const b = req.body || {};
        const items = Array.isArray(b.items) ? b.items.slice(0, 400) : [];
        if (!items.length) throw T.fail(400, 'Kamida bitta kun tanlang');
        let added = 0, skipped = 0;
        for (const it of items) {
            const day = T.assertDate(it.day);
            const dup = await c.query('SELECT 1 FROM school_assist_contacts WHERE student_id=$1 AND day=$2 AND removed_at IS NULL LIMIT 1', [it.studentId, day]);
            if (dup.rows.length) { skipped++; continue; }
            await A.adminCorrect(c, req.user, { studentId: it.studentId, assistantId: b.assistantId, day, channel: it.channel || b.channel, minutes: it.minutes || b.minutes, reason: b.reason });
            added++;
        }
        return { added, skipped };
    })));
    // Yordamchi: o'tgan kunni belgilamay qolgan aloqa uchun admin orqali so'rov. Server tekshiradi:
    //  • faqat yordamchi lavozimidagi xodim (asosiy ustoz — 403);
    //  • faqat o'quvchining HOZIRGI yordamchisi (boshqa yordamchining o'quvchisi — 403);
    //  • faqat o'tgan sana (bugun — o'zi belgilaydi, kelajak — yo'q), joriy yoki o'tgan oy, oy yakuniy tasdiqlanmagan;
    //  • o'sha kuni o'quvchi faol bo'lgan (muzlatilgan / chiqib ketgan kunga — yo'q).
    router.post('/assist/late-requests', handle(req => write(req, async c => {
        const me = await teacherOf(req);
        if (!assistOf(me)) throw T.fail(403, 'So\'rovni faqat yordamchi ustoz yuboradi');
        const st = (await c.query('SELECT id, assistant_teacher_id, extra_data FROM students WHERE id=$1', [String(req.body?.studentId || '')])).rows[0];
        if (!st || st.assistant_teacher_id !== me.id) throw T.fail(403, 'Bu o\'quvchi sizga biriktirilmagan');
        const day = T.assertDate(req.body?.day), today = T.nowLocal().date;
        if (day >= today) throw T.fail(400, day === today ? 'Bugungi aloqani o\'zingiz belgilaysiz' : 'Kelajak sanaga so\'rov yuborilmaydi');
        if (day.slice(0, 7) < T.addDays(today.slice(0, 7) + '-01', -1).slice(0, 7)) throw T.fail(409, 'Bu oy uchun so\'rov muddati o\'tgan');
        if (await A.isLocked(c, day.slice(0, 7))) throw T.fail(409, 'Oy yakuniy tasdiqlangan — o\'zgartirib bo\'lmaydi');
        const statuses = (await c.query('SELECT * FROM school_student_status WHERE student_id=$1 AND cancelled_at IS NULL', [st.id])).rows;
        if (S.statusOn(statuses, day) !== 'active') throw T.fail(409, 'O\'sha kuni o\'quvchi faol emas (muzlatilgan yoki chiqib ketgan)');
        // Kurs boshlanishidan oldingi kun — aloqa sanalmaydi (before_start), so'rov ham yo'q.
        const start = A.studentStartOf(st.extra_data);
        if (start && day < start) throw T.fail(400, `O'quvchi kursni ${start} dan boshlagan — undan oldingi kunga so'rov yuborilmaydi`);
        // Shu kuni hisoblangan aloqa bor bo'lsa — kuniga 1 ta sanaladi (same_day), so'rov keraksiz.
        {
            const { from, to } = T.monthBounds(day.slice(0, 7));
            const mine = (await c.query('SELECT * FROM school_assist_contacts WHERE assistant_id=$1 AND day BETWEEN $2 AND $3 AND removed_at IS NULL', [me.id, from, to])).rows;
            const rep = A.countMonth(mine, { starts: start ? new Map([[st.id, start]]) : undefined });
            const has = rep.students.some(x => x.studentId === st.id && x.items.some(i => i.status === 'counted' && S.dateStr(i.day) === day));
            if (has) throw T.fail(409, 'Bu kunda o\'quvchi bilan hisoblangan aloqa allaqachon bor — kuniga bitta aloqa sanaladi');
        }
        const reason = String(req.body?.reason || '').trim(); if (reason.length < 5) throw T.fail(400, 'Sababni yozing');
        // Bir o'quvchi + bir kun uchun bitta ochiq so'rov (parallel yuborishda ham — tranzaksiya qulfi).
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`assist_late:${st.id}:${day}`]);
        const dup = (await c.query(`SELECT 1 FROM school_requests WHERE type='assist_late' AND status='new' AND payload->>'studentId'=$1 AND payload->>'day'=$2 LIMIT 1`, [st.id, day])).rows.length;
        if (dup) throw T.fail(409, 'Bu o\'quvchi va kun uchun so\'rov allaqachon yuborilgan — admin ko\'rib chiqmoqda');
        const channel = A.CHANNELS[req.body?.channel] ? req.body.channel : 'phone';
        const minutes = Math.max(0, Math.min(180, Math.round(Number(req.body?.minutes) || 0)));
        const { rows } = await c.query(`INSERT INTO school_requests (id,teacher_id,requester_id,requester_name,type,payload,reason) VALUES ($1,$2,$3,$4,'assist_late',$5,$6) RETURNING *`,
            [randomUUID(), me.id, req.user.id, me.name, JSON.stringify({ studentId: st.id, day, channel, minutes, at: req.body?.at }), reason.slice(0, 500)]);
        return { request: rows[0] };
    })));
    router.get('/assist/month', handle(async req => {
        const month = req.query.month || T.nowLocal().date.slice(0, 7);
        let assistantId = req.query.assistantId, duty = true;
        if (req.user.role === 'teacher') { const own = await teacherOf(req); assistantId = own.id; duty = !!assistOf(own); }
        else need(req, MANAGE);
        if (!assistantId) throw T.fail(400, 'Yordamchini tanlang');
        const rep = await A.monthReport(pool, assistantId, month);
        // Joriy oy: "oy oxirigacha ko'pi bilan" va har o'quvchida qolgan tavsiya kunlari — Mening maoshim bilan bitta hisob.
        if (duty && String(month) === T.nowLocal().date.slice(0, 7)) {
            const pl = await A.possibleLeft(pool, assistantId, month, rep);
            rep.possible = pl.possible; rep.possibleAmount = pl.possibleAmount;
            // Joriy hafta rejasi (Bosh "Bu hafta 12 / 47") — Davomat va Dars jadvali bilan bitta hisob (AttendanceRules.weekPlanCount).
            const ws = T.weekStart(T.nowLocal().date), we = T.addDays(ws, 6);
            const wp = await A.plan(pool, { assistantIds: [assistantId], from: ws, to: we }).catch(() => null);
            if (wp) rep.week = { from: ws, to: we, planned: require('../../js/attendanceRules').weekPlanCount(wp.items) };
            rep.left = Object.fromEntries(pl.students.map(x => [x.studentId, { adviceLeft: x.adviceLeft, possible: x.possible }]));
        }
        return rep;
    }));
    // 29-okt: asosiy ustoz yordamchi bo'la olmaydi. Admin "Yordamchi aloqalari" uchun:
    //  • legacy — hali asosiy ustozga yordamchi sifatida biriktirilgan o'quvchilar ("yordamchi kerak" ogohlantirishi);
    //  • past — shu oyda aloqasi bor, lekin hozir yordamchi lavozimida bo'lmagan xodimlar (o'tgan aloqalar maoshda qoladi, admin ko'radi/tuzatadi).
    router.get('/assist/legacy', handle(async req => {
        need(req, MANAGE);
        const month = String(req.query.month || T.nowLocal().date.slice(0, 7));
        const { from, to } = T.monthBounds(month);
        const legacy = await require('../services/school/assistantSeparation').legacyAssignments(pool, req.user.role === 'rop' ? await reqLang(req) : null);
        const past = (await pool.query(`SELECT DISTINCT he.id, he.name FROM school_assist_contacts c JOIN hr_employees he ON he.id = c.assistant_id
            WHERE c.day BETWEEN $1 AND $2 AND c.removed_at IS NULL AND he.role <> 'yordamchi'`, [from, to])).rows;
        return { month, legacy, past };
    }));
    // Tavsiya jadvali va bajarilgan aloqalar (jadval v2). Saqlanmaydi — o'quvchi dars kunlaridan hisoblanadi.
    //  • ustoz/yordamchi — faqat o'zi yordamchi bo'lgan o'quvchilar;
    //  • admin/boshliq — hamma (yoki ?assistantId=); ROP — o'z tili bo'yicha; sotuvga yo'q.
    router.get('/assist/plan', handle(async req => {
        const from = T.assertDate(req.query.from || T.nowLocal().date);
        const to = T.assertDate(req.query.to || from);
        if (T.daysBetween(from, to) > 41) throw T.fail(400, 'Oraliq 6 haftadan oshmasin');
        let assistantIds = null, subject = null;
        if (req.user.role === 'teacher') { const own = await teacherOf(req); assistantIds = assistOf(own) ? [own.id] : []; }
        else {
            need(req, MANAGE);
            subject = await reqLang(req);
            if (req.query.assistantId) assistantIds = [String(req.query.assistantId)];
        }
        const r = await A.plan(pool, { assistantIds, from, to, subject });
        const names = r.assistantIds.length ? (await pool.query('SELECT id, name, role FROM hr_employees WHERE id = ANY($1::text[])', [r.assistantIds])).rows : [];
        return { ...r, assistants: names.map(n => ({ id: n.id, name: n.name, role: n.role })) };
    }));
    // Asosiy ustoz, ROP, sotuv (o'z o'quvchilari) — o'quvchi bo'yicha aloqalar (faqat o'qish).
    router.get('/students/:id/contacts', handle(async req => {
        const row = (await pool.query('SELECT * FROM students WHERE id=$1', [req.params.id])).rows[0];
        if (!row) throw T.fail(404, 'O\'quvchi topilmadi');
        if (!await canSee(req, row)) throw T.fail(403, 'Ruxsat yo\'q');
        const month = req.query.month || T.nowLocal().date.slice(0, 7);
        const { from, to } = T.monthBounds(month);
        const rows = (await pool.query('SELECT * FROM school_assist_contacts WHERE student_id=$1 AND day BETWEEN $2 AND $3', [row.id, from, to])).rows;
        // Har yordamchi o'z oyida alohida hisoblanadi (maosh bilan bir xil); kurs boshlanishidan oldingi aloqa — before_start.
        const starts = { [row.id]: A.studentStartOf(row.extra_data) };
        const byA = new Map(); for (const c of rows) { if (!byA.has(c.assistant_id)) byA.set(c.assistant_id, []); byA.get(c.assistant_id).push(c); }
        const parts = [...byA.values()].map(list => A.countMonth(list, { starts }).students[0]).filter(Boolean);
        const r = { counted: parts.reduce((n, x) => n + x.counted, 0), noAnswer: parts.reduce((n, x) => n + x.noAnswer, 0),
            items: parts.flatMap(x => x.items).sort((a, b) => String(a.day).localeCompare(String(b.day))) };
        return { month, cap: A.MONTH_CAP, counted: r.counted, noAnswer: r.noAnswer, items: r.items };
    }));
    // Yordamchi o'quvchilaridagi oy ichidagi o'zgarishlar (muzlatish, qaytish, chiqib ketish, asosiy ustoz almashishi) — faqat o'qish.
    //  • ustoz/yordamchi — faqat o'zi yordamchi bo'lgan o'quvchilar; admin/boshliq/ROP — ?assistantId= bilan.
    router.get('/assist/changes', handle(async req => {
        const month = req.query.month || T.nowLocal().date.slice(0, 7);
        let assistantId = req.query.assistantId;
        if (req.user.role === 'teacher') { const own = await teacherOf(req); if (!assistOf(own)) return { month, changes: [] }; assistantId = own.id; }
        else need(req, MANAGE);
        if (!assistantId) throw T.fail(400, 'Yordamchini tanlang');
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) throw T.fail(400, 'Oy noto\'g\'ri');
        return A.monthChanges(pool, String(assistantId), month);
    }));
    router.post('/assist/months/:month/:step', handle(req => write(req, c => A.advanceMonth(c, req.user, req.params.month, req.params.step).then(m => ({ month: m })))));

    // ── Xodim: vaqtinchalik parol (parol hech kimga ko'rinmaydi) va avatar ───
    router.post('/staff/:userId/temp-password', handle(req => { need(req, FULL); return write(req, async c => {
        const pass = String(req.body?.password || '');
        if (pass.length < 8) throw T.fail(400, 'Vaqtinchalik parol kamida 8 belgi');
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
