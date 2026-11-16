// Qo'ng'iroq AI tahlili — API (server/services/callAi.js).
// POST /api/call-ai/upload      — Jamoa ilovasi qo'ng'iroqdan keyin telefonning o'z yozuvini yuklaydi
// POST /api/call-ai/missing     — ilova yozuvni topa olmadi (sozlamalar ekranida ogohlantirish uchun)
// GET  /api/call-ai/list        — tahlillar ro'yxati (ROP/admin — hammasi, menejer — o'ziniki)
// GET  /api/call-ai/:id/transcript — suhbat matni
// POST /api/call-ai/:id/retry   — qayta tahlil (ROP/admin)
// POST /api/call-ai/:id/type    — qo'ng'iroq turini o'zgartirish (faqat ROP/admin) → qayta baholanadi
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { authRequired } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const db = require('../db');
const { createCallAi, publicView, TYPES } = require('../services/callAi');

const router = express.Router();
const UPLOADS_DIR = path.join(db.DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

let instance = null;
function getCallAi() {
    if (!instance) {
        const costs = require('../services/aiCostFinance');
        instance = createCallAi({ db, uploadsDir: UPLOADS_DIR, onCost: db.pool ? c => costs.record(db.pool, c) : null });
    }
    return instance;
}

// Yuklash — sotuv xodimlari; o'qish — faqat ROP/admin/boshliq va o'z qo'ng'iroqlari bo'yicha menejer.
const UPLOADERS = ['admin', 'boshliq', 'rop', 'sales_manager', 'employee'];
const STAFF = ['admin', 'boshliq', 'rop', 'sales_manager'];
const LEADS_ALL = ['admin', 'boshliq', 'rop'];

const AUDIO_EXT = new Set(['.mp3', '.m4a', '.mp4', '.aac', '.wav', '.ogg', '.opus', '.amr', '.3gp', '.webm', '.flac']);
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, UPLOADS_DIR),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname || '').toLowerCase();
            cb(null, randomUUID() + (AUDIO_EXT.has(ext) ? ext : '.m4a'));
        },
    }),
    limits: { fileSize: 60 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (String(file.mimetype || '').startsWith('audio/') || AUDIO_EXT.has(ext)) return cb(null, true);
        cb(new Error('Faqat audio fayl'));
    },
});

const digits = v => String(v || '').replace(/\D/g, '');

// Raqam bo'yicha lid: oxirgi 9 raqam (998 kodisiz ham, bilan ham mos keladi).
// Avval shu menejerga biriktirilgan lidlar, keyin qolganlari; eng yangisi.
async function findLeadByPhone(phone, managerId) {
    const tail = digits(phone).slice(-9);
    if (tail.length < 7) return null;
    const { rows } = await db.pool.query(
        `SELECT id, language, manager_id, status FROM leads
         WHERE deleted_at IS NULL
           AND (right(regexp_replace(phone, '\\D', '', 'g'), 9) = $1 OR right(regexp_replace(phone2, '\\D', '', 'g'), 9) = $1)
         ORDER BY (COALESCE(manager_id, '') = $2) DESC, updated_at DESC NULLS LAST
         LIMIT 1`,
        [tail, String(managerId || '')]
    );
    return rows[0] || null;
}

async function userName(req) {
    if (req.user?.name) return req.user.name;
    const u = await db.findUserById(req.user.id).catch(() => null);
    return u?.name || req.user?.email || '';
}

// Multer xatosi (turi/hajmi) — 4xx: ilova qayta-qayta yubormasin.
const uploadFile = (req, res, next) => upload.single('file')(req, res, err => {
    if (!err) return next();
    const big = err.code === 'LIMIT_FILE_SIZE';
    res.status(big ? 413 : 415).json({ error: big ? 'Fayl juda katta' : (err.message || 'Fayl qabul qilinmadi') });
});

router.post('/upload', authRequired, requireRoles(UPLOADERS), uploadFile, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Fayl kelmadi' });
        const { phone = '', startedAt = '', leadId = '', durationSec = '' } = req.body || {};
        const callAt = !Number.isNaN(Date.parse(startedAt)) ? new Date(startedAt).toISOString() : new Date().toISOString();
        const url = `/uploads/${req.file.filename}`;
        const name = await userName(req);
        const managerId = req.user.role === 'sales_manager' ? await db.getSalesManagerIdForUser(req.user.id) : '';


        let lead = null;
        if (leadId) {
            // Til doim lidning o'zidan (sahifadagi filtr boshqa bo'lishi mumkin).
            const r = await db.pool.query('SELECT id, language, manager_id, status FROM leads WHERE id = $1 AND deleted_at IS NULL', [String(leadId)]);
            lead = r.rows[0] || null;
            // Menejer faqat o'z lidiga biriktira oladi; aks holda raqam bo'yicha qidiriladi.
            if (lead && req.user.role === 'sales_manager' && (!managerId || lead.manager_id !== managerId)) lead = null;
        }
        if (!lead) lead = await findLeadByPhone(phone, managerId);

        if (!lead) {
            const item = { id: 'lr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), url, phone: String(phone).slice(0, 32), callAt,
                durationSec: Number(durationSec) || 0, uploadedBy: name, userId: req.user.id, createdAt: new Date().toISOString() };
            const dupL = await db.mutateJsonData('callRecordingsLidsiz', list => {
                if (list.some(x => x.callAt === item.callAt && digits(x.phone).slice(-9) === digits(item.phone).slice(-9))) return true;
                list.push(item); if (list.length > 1000) list.splice(0, list.length - 1000);
                return false;
            });
            if (dupL) fs.unlink(req.file.path, () => {});
            return res.json({ ok: true, matched: false });
        }

        const recording = await db.addCallRecording({
            lang: lead.language, leadId: lead.id, url, fileName: req.file.originalname || '', duration: Number(durationSec) || 0,
            uploadedBy: name, source: 'app', callAt, phone,
        });
        if (recording.duplicate) { fs.unlink(req.file.path, () => {}); return res.json({ ok: true, matched: true, duplicate: true, recordingId: recording.id }); }
        // Qo'ng'iroqni kim qilgan bo'lsa, o'sha menejerga yoziladi (boshqa menejerning lidiga qilgan bo'lsa ham).
        // Qo'ng'iroqni menejer qilgan bo'lsa — unga; ROP/admin/boshqa xodim qilgan bo'lsa — hech bir menejerga yozilmaydi
        // (menejer statistikasi va rejalariga boshqa odamning suhbati qo'shilmasin), tahlil esa lid kartasida ko'rinadi.
        const analysis = await getCallAi().enqueue(recording, { managerId, managerName: name, callAt });
        res.json({ ok: true, matched: true, recordingId: recording.id, analysisId: analysis?.id || null });
    } catch (err) {
        console.error('POST /api/call-ai/upload', err);
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

router.post('/missing', authRequired, requireRoles(UPLOADERS), async (req, res) => {
    try {
        const { phone = '', startedAt = '', leadId = '', reason = '', durationSec = 0 } = req.body || {};
        // Javob berilmagan / juda qisqa qo'ng'iroqlar "yozuv topilmadi" deb ko'rsatilmaydi.
        if (Number(durationSec) > 0 && Number(durationSec) < 30) return res.json({ ok: true, ignored: true });
        const item = { id: 'ms-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), phone: String(phone).slice(0, 32), leadId: String(leadId).slice(0, 64), reason: String(reason).slice(0, 120),
            callAt: !Number.isNaN(Date.parse(startedAt)) ? new Date(startedAt).toISOString() : new Date().toISOString(),
            durationSec: Number(durationSec) || 0, userId: req.user.id, uploadedBy: await userName(req), createdAt: new Date().toISOString() };
        await db.mutateJsonData('callRecordingsMissing', list => {
            if (list.some(x => x.callAt === item.callAt && digits(x.phone).slice(-9) === digits(item.phone).slice(-9))) return; // takroriy xabar
            list.push(item); if (list.length > 1000) list.splice(0, list.length - 1000);
        });
        res.json({ ok: true });
    } catch (err) {
        console.error('POST /api/call-ai/missing', err);
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

// Menejer faqat o'zining qo'ng'iroqlarini ko'radi; ROP/admin/boshliq — hammasini.
router.get('/list', authRequired, requireRoles(STAFF), async (req, res) => {
    try {
        const from = Date.parse(req.query.from || '') || 0;
        const to = Date.parse(req.query.to || '') || Infinity;
        const lang = req.query.lang === 'russian' || req.query.lang === 'english' ? req.query.lang : null;
        const onlyAppeals = req.query.appeal === 'pending';
        let list = (await getCallAi().all()).filter(a => {
            const t = Date.parse(a.callAt) || 0;
            return t >= from && t <= to && (!lang || a.lang === lang) && (!onlyAppeals || a.appeal?.status === 'pending');
        });
        if (!LEADS_ALL.includes(req.user.role)) {
            const mid = req.user.role === 'sales_manager' ? await db.getSalesManagerIdForUser(req.user.id) : '';
            list = list.filter(a => mid && a.managerId === mid);
        } else if (req.user.role === 'rop') {
            const langs = await require('../services/ropScope').ropLangsFor(db.pool, req.user);
            if (langs) list = list.filter(a => langs.includes(a.lang));
        }
        list.sort((a, b) => (Date.parse(b.callAt) || 0) - (Date.parse(a.callAt) || 0));
        res.json(list.slice(0, 2000).map(a => ({ ...publicView(a), lang: a.lang, leadId: a.leadId, recordingId: a.recordingId })));
    } catch (err) {
        console.error('GET /api/call-ai/list', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

async function findAccessible(req, id) {
    const a = (await getCallAi().all()).find(x => x.id === id);
    if (!a) return null;
    if (req.user.role === 'rop') {
        // ROP — faqat o'z til yo'nalishi (HR'da belgilangan); belgilanmagan bo'lsa cheklovsiz.
        const langs = await require('../services/ropScope').ropLangsFor(db.pool, req.user);
        return !langs || langs.includes(a.lang) ? a : null;
    }
    if (LEADS_ALL.includes(req.user.role)) return a;
    if (req.user.role === 'sales_manager') {
        const mid = await db.getSalesManagerIdForUser(req.user.id);
        const lead = await db.getLeadById(a.leadId).catch(() => null);
        if (mid && (a.managerId === mid || lead?.managerId === mid)) return a;
        // Namunaviy qo'ng'iroq: menejerning o'z rejasidagi vazifada ko'rsatilgan — mijoz yashirin holda.
        if (mid && (await Plans.listPlans(db)).some(pl => pl.managerId === mid && ['active', 'decision'].includes(pl.status) && pl.weeks.some(w => w.tasks.some(t => t.callId === id)))) return { ...a, sample: true };
    }
    return null;
}

router.get('/:id/transcript', authRequired, requireRoles(STAFF), async (req, res) => {
    try {
        const a = await findAccessible(req, req.params.id);
        if (!a) return res.status(404).json({ error: 'Topilmadi' });
        const lead = await db.getLeadById(a.leadId).catch(() => null);
        const recs = await db.getJsonData('callRecordings');
        const rec = (Array.isArray(recs) ? recs : []).find(r => r.id === a.recordingId);
        if (req.user.role === 'sales_manager' && a.task && !a.task.seenAt) getCallAi().taskSeen(a.id).catch(() => {});
        const tr = (await getCallAi().loadTranscript(a.id)) || { segments: [] };
        const myMid = req.user.role === 'sales_manager' ? await db.getSalesManagerIdForUser(req.user.id) : '';
        if (a.sample) return res.json({ ...publicView(a, { withTranscript: tr }), sample: true, mine: false, leadId: '', lang: a.lang, leadName: 'Namunaviy qoʻngʻiroq · mijoz yashirin', leadPhone: '', recordingId: a.recordingId, audioUrl: rec?.url || '', task: null, appeal: null, managerName: '' });
        res.json({ ...publicView(a, { withTranscript: tr }), mine: !!myMid && a.managerId === myMid, leadId: a.leadId, lang: a.lang, leadName: lead?.name || '', leadPhone: lead?.phone || '', recordingId: a.recordingId, audioUrl: rec?.url || '' });
    } catch (err) {
        console.error('GET /api/call-ai/:id/transcript', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

// Lid bo'yicha "yozuv topilmadi" qatorlari (lid modalida ko'rinadi). Telefon raqami bo'yicha ham bog'lanadi.
router.get('/missing', authRequired, requireRoles(STAFF), async (req, res) => {
    try {
        const leadId = String(req.query.leadId || '');
        const lead = leadId ? await db.getLeadById(leadId).catch(() => null) : null;
        if (!lead) return res.json([]);
        if (req.user.role === 'rop') {
            const langs = await require('../services/ropScope').ropLangsFor(db.pool, req.user);
            const ll = (await db.pool.query('SELECT language FROM leads WHERE id = $1', [lead.id])).rows[0]?.language;
            if (langs && !langs.includes(ll)) return res.json([]);
        }
        if (!LEADS_ALL.includes(req.user.role)) {
            const mid = await db.getSalesManagerIdForUser(req.user.id);
            if (!mid || lead.managerId !== mid) return res.json([]);
        }
        const tails = [lead.phone, lead.phone2].map(p => digits(p).slice(-9)).filter(t => t.length >= 7);
        const all = await db.getJsonData('callRecordingsMissing');
        res.json((Array.isArray(all) ? all : []).filter(m => !m.resolvedAt && (m.leadId === leadId || tails.includes(digits(m.phone).slice(-9))))
            .map(m => ({ id: m.id, callAt: m.callAt, reason: m.reason, uploadedBy: m.uploadedBy, durationSec: m.durationSec || 0 })));
    } catch (err) {
        console.error('GET /api/call-ai/missing', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

router.post('/missing/:id/resolve', authRequired, requireRoles(LEADS_ALL), async (req, res) => {
    try {
        const langs = req.user.role === 'rop' ? await require('../services/ropScope').ropLangsFor(db.pool, req.user) : null;
        let allowed = true;
        if (langs) {
            const all = await db.getJsonData('callRecordingsMissing');
            const m = (Array.isArray(all) ? all : []).find(x => x.id === req.params.id);
            let ll = m?.leadId ? (await db.pool.query('SELECT language FROM leads WHERE id = $1', [m.leadId])).rows[0]?.language : null;
            if (!ll && m?.phone) ll = (await findLeadByPhone(m.phone, ''))?.language || null;
            allowed = !!m && (!ll || langs.includes(ll));
        }
        if (!allowed) return res.status(403).json({ error: 'Bu sizning yoʻnalishingizda emas' });
        await db.mutateJsonData('callRecordingsMissing', list => { const m = list.find(x => x.id === req.params.id); if (m) m.resolvedAt = new Date().toISOString(); });
        res.json({ ok: true });
    } catch (err) {
        console.error('POST /api/call-ai/missing/:id/resolve', err);
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

// E'tiroz (menejer, 48 soat) va ROP qarori (24 soat ichida kutiladi; qabul — shu mezon qayta baholanadi).
router.post('/:id/appeal', authRequired, requireRoles(['sales_manager']), async (req, res) => {
    try {
        const a = await findAccessible(req, req.params.id);
        if (!a) return res.status(404).json({ error: 'Topilmadi' });
        const mid = await db.getSalesManagerIdForUser(req.user.id);
        if (!mid || a.managerId !== mid) return res.status(403).json({ error: 'Faqat oʻz qoʻngʻirogʻingizga eʼtiroz bildirasiz' });
        await getCallAi().appeal(a.id, { criterion: req.body?.criterion, text: req.body?.text, by: await userName(req) });
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

router.post('/:id/appeal/decide', authRequired, requireRoles(LEADS_ALL), async (req, res) => {
    try {
        if (!(await findAccessible(req, req.params.id))) return res.status(404).json({ error: 'Topilmadi' });
        const it = await getCallAi().decideAppeal(req.params.id, { accept: !!req.body?.accept, note: req.body?.note, by: await userName(req) });
        if (!it) return res.status(404).json({ error: 'Topilmadi' });
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

// ROP topshirig'i: qayta qo'ng'iroq bo'yicha aniq ko'rsatma (menejer kabinetida va lid kartasida ko'rinadi).
router.post('/:id/task', authRequired, requireRoles(LEADS_ALL), async (req, res) => {
    try {
        if (!(await findAccessible(req, req.params.id))) return res.status(404).json({ error: 'Topilmadi' });
        const it = await getCallAi().setTask(req.params.id, { text: req.body?.text, due: req.body?.due, by: await userName(req) });
        if (!it) return res.status(404).json({ error: 'Topilmadi' });
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

router.post('/:id/task/seen', authRequired, requireRoles(['sales_manager']), async (req, res) => {
    try {
        const a = await findAccessible(req, req.params.id);
        if (!a) return res.status(404).json({ error: 'Topilmadi' });
        await getCallAi().taskSeen(a.id);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

router.post('/:id/retry', authRequired, requireRoles(LEADS_ALL), async (req, res) => {
    try {
        if (!(await findAccessible(req, req.params.id))) return res.status(404).json({ error: 'Topilmadi' });
        const it = await getCallAi().retry(req.params.id);
        if (!it) return res.status(404).json({ error: 'Topilmadi' });
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

router.post('/:id/type', authRequired, requireRoles(LEADS_ALL), async (req, res) => {
    try {
        const type = String(req.body?.type || '');
        if (!TYPES[type]) return res.status(400).json({ error: 'Notoʻgʻri tur' });
        if (!(await findAccessible(req, req.params.id))) return res.status(404).json({ error: 'Topilmadi' });
        const it = await getCallAi().setType(req.params.id, type, await userName(req));
        if (!it) return res.status(404).json({ error: 'Topilmadi' });
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

// ── 2-bosqich: statistika, rejalar, haftalik hisobot, sozlamalar, lid sifati ──
// Dizayn: Sotuv › Tahlil (Umumiy, Menejerlar, Qo'ng'iroqlar, Rivojlanish rejalari, Haftalik hisobot, Sozlamalar),
// "Mening tahlilim", Bosh sahifa bloklari, Marketing › Lid sifati (AI). Hisob: server/services/callAiStats.js.
const Stats = require('../services/callAiStats');
const Plans = require('../services/callPlans');
const DIRECTORS = ['admin', 'boshliq'];
const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
// Davr: from/to (YYYY-MM-DD, Toshkent, to — shu kun ham kiradi). Standart — o'tgan hafta (dushanba–yakshanba).
function period(q, now = Date.now()) {
    if (isDay(q.from) && isDay(q.to)) {
        const from = Date.parse(q.from + 'T00:00:00+05:00'), to = Date.parse(q.to + 'T00:00:00+05:00') + 86400000;
        if (to > from && to - from <= 400 * 86400000) return { from, to };
    }
    if (q.per === 'today2') { const d = Date.parse(Stats.dayKey(now) + 'T00:00:00+05:00'); return { from: d - 86400000, to: d + 86400000 }; }
    if (q.per === 'week') { const w = Stats.weekStart(now); return { from: w, to: now + 1 }; }
    if (q.per === 'month') { const d = Stats.dayKey(now); return { from: Date.parse(d.slice(0, 8) + '01T00:00:00+05:00'), to: now + 1 }; }
    const w = Stats.weekStart(now);
    return { from: w - 7 * 86400000, to: w };
}
async function langScope(req) {
    const want = req.query.lang === 'english' ? 'english' : req.query.lang === 'russian' ? 'russian' : null;
    if (req.user.role === 'rop') {
        const langs = await require('../services/ropScope').ropLangsFor(db.pool, req.user);
        if (langs && want && !langs.includes(want)) return langs[0];
        return want || (langs ? langs[0] : 'russian');
    }
    return want || 'russian';
}
async function loadCtx(lang, q) {
    const all = (await getCallAi().all()).filter(a => !lang || a.lang === lang);
    const leads = new Map((await db.getLeadsByIds(all.map(a => a.leadId).slice(-6000))).map(l => [l.id, l]));
    const managers = await db.getSalesManagersMap();
    const plans = (await Plans.listPlans(db)).filter(p => !lang || p.lang === lang);
    return { analyses: all, leads, managers, plans, now: Date.now(), ...period(q || {}) };
}
const wrap = fn => async (req, res) => {
    try { res.json(await fn(req, res)); }
    catch (err) { console.error('call-ai', req.path, err.message); res.status(err.status || 400).json({ error: err.message || 'Xatolik' }); }
};
const deny = msg => Object.assign(new Error(msg || 'Ruxsat yoʻq'), { status: 403 });

// Sotuv › Tahlil › Umumiy / Menejerlar (+ Bosh sahifa bloki).
router.get('/stats', authRequired, requireRoles(LEADS_ALL), wrap(async req => {
    const lang = await langScope(req);
    const ctx = await loadCtx(lang, req.query);
    return { lang, from: ctx.from, to: ctx.to, settings: await Plans.settings(db), ...Stats.team(ctx) };
}));
router.get('/calls-table', authRequired, requireRoles(LEADS_ALL), wrap(async req => {
    const lang = await langScope(req);
    const ctx = await loadCtx(lang, req.query);
    const managers = [...new Set(ctx.analyses.map(a => a.managerId).filter(Boolean))].map(id => ({ id, name: ctx.managers.get(id)?.name || id }));
    return { lang, from: ctx.from, to: ctx.to, managers, pendingAppeals: ctx.analyses.filter(a => a.appeal?.status === 'pending').length, ...Stats.calls(ctx, req.query) };
}));
router.get('/manager/:id', authRequired, requireRoles(LEADS_ALL), wrap(async req => {
    const lang = await langScope(req);
    const ctx = await loadCtx(lang, req.query);
    const plan = ctx.plans.filter(p => p.managerId === req.params.id && ['pending', 'active', 'decision'].includes(p.status)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    return { lang, from: ctx.from, to: ctx.to, ...Stats.manager(ctx, req.params.id), plan: Plans.view(plan, ctx.analyses, ctx.managers) };
}));
// Sotuv menejeri: "Mening tahlilim" (o'zi + jamoa chizig'i). Mijoz/menejer nomlari boshqa menejerlardan ko'rsatilmaydi.
router.get('/me', authRequired, requireRoles(['sales_manager']), wrap(async req => {
    const mid = await db.getSalesManagerIdForUser(req.user.id);
    if (!mid) throw deny('Sotuv menejeri profili bogʻlanmagan');
    const ctx = await loadCtx(null, req.query);
    const lang = ctx.analyses.find(a => a.managerId === mid)?.lang || 'russian';
    const scoped = { ...ctx, analyses: ctx.analyses.filter(a => a.lang === lang), plans: ctx.plans.filter(p => p.lang === lang) };
    const me = Stats.manager(scoped, mid);
    const plan = scoped.plans.filter(p => p.managerId === mid && ['active', 'decision'].includes(p.status)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    const mine = scoped.analyses.filter(a => a.managerId === mid);
    const task = mine.filter(a => a.task && !a.task.done).sort((a, b) => Date.parse(b.task.at) - Date.parse(a.task.at))[0];
    const appeal = mine.filter(a => a.appeal?.status === 'pending')[0];
    delete me.best; // boshqa menejerning mijozi ko'rinmasin (namunaviy qo'ng'iroq — rejada, mijoz yashirin)
    return { lang, from: ctx.from, to: ctx.to, ...me, plan: Plans.view(plan, scoped.analyses, scoped.managers),
        task: task ? { callId: task.id, lead: ctx.leads.get(task.leadId)?.name || '', leadId: task.leadId, text: task.task.text, due: task.task.due } : null,
        appeal: appeal ? { callId: appeal.id, lead: ctx.leads.get(appeal.leadId)?.name || '', left: Math.max(0, Math.ceil((Date.parse(appeal.appeal.at) + 24 * 3600000 - Date.now()) / 3600000)) } : null };
}));
// Menejerning o'z qo'ng'iroqlari ro'yxati ("Qo'ng'iroqlarim"), 10 tadan.
router.get('/me/calls', authRequired, requireRoles(['sales_manager']), wrap(async req => {
    const mid = await db.getSalesManagerIdForUser(req.user.id);
    if (!mid) throw deny('Sotuv menejeri profili bogʻlanmagan');
    const ctx = await loadCtx(null, req.query);
    return { from: ctx.from, to: ctx.to, ...Stats.calls({ ...ctx, analyses: ctx.analyses.filter(a => a.managerId === mid) }, { page: req.query.page, type: req.query.type }) };
}));
router.get('/plans', authRequired, requireRoles(LEADS_ALL), wrap(async req => {
    const lang = await langScope(req);
    const ctx = await loadCtx(lang, req.query);
    const list = ctx.plans.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const weekly = Stats.weeklySeries(ctx.analyses, ctx.now);
    const rows = Stats.team(ctx).managers;
    return { lang, plans: list.map(p => Plans.view(p, ctx.analyses, ctx.managers)), managers: rows, weeklyLabels: weekly.labels };
}));
router.get('/plans/:id', authRequired, requireRoles(STAFF), wrap(async req => {
    const p = (await Plans.listPlans(db)).find(x => x.id === req.params.id);
    if (!p) throw Object.assign(new Error('Reja topilmadi'), { status: 404 });
    if (req.user.role === 'sales_manager' && p.managerId !== await db.getSalesManagerIdForUser(req.user.id)) throw deny();
    if (req.user.role === 'rop') { const langs = await require('../services/ropScope').ropLangsFor(db.pool, req.user); if (langs && !langs.includes(p.lang)) throw deny(); }
    const ctx = await loadCtx(p.lang, req.query);
    // Shu menejerning boshqa rejalari: o'tgan mini-rejalar soni va hozir faol to'liq reja.
    const others = ctx.plans.filter(x => x.managerId === p.managerId && x.id !== p.id);
    const history = { pastMini: others.filter(x => x.kind === 'mini' && !['pending', 'active'].includes(x.status)).length, activeFull: others.some(x => x.kind === 'full' && x.status === 'active') };
    return { plan: Plans.view(p, ctx.analyses, ctx.managers), manager: Stats.manager(ctx, p.managerId), history };
}));
router.post('/plans/:id/:action', authRequired, requireRoles(STAFF), wrap(async req => {
    const p = (await Plans.listPlans(db)).find(x => x.id === req.params.id);
    if (!p) throw Object.assign(new Error('Reja topilmadi'), { status: 404 });
    const action = req.params.action;
    if (req.user.role === 'sales_manager') {
        if (action !== 'task' || p.managerId !== await db.getSalesManagerIdForUser(req.user.id)) throw deny();
    } else if (req.user.role === 'rop') {
        const langs = await require('../services/ropScope').ropLangsFor(db.pool, req.user); if (langs && !langs.includes(p.lang)) throw deny();
        if (action === 'decision') throw deny('2-tsikldan keyingi qarorni admin qiladi');
    }
    const by = await userName(req);
    const out = await Plans.act(db, p.id, action, { ...(req.body || {}), role: req.user.role }, by);
    if (action === 'remind') await notifyManager(p.managerId, `Rivojlanish rejangiz: ${out.weeks.find(w => w.status === 'current')?.title || ''} — vazifalarni bajaring`).catch(() => {});
    return { ok: true, plan: out };
}));
router.get('/weekly', authRequired, requireRoles(LEADS_ALL), wrap(async req => {
    const lang = await langScope(req);
    const list = await Plans.reports(db, lang);
    const ctx = await loadCtx(lang, req.query);
    const rep = list.find(r => req.query.week ? Stats.dayKey(r.weekStart) === req.query.week : true) || null;
    const team = Stats.team({ ...ctx, ...(rep ? { from: rep.weekStart, to: rep.weekStart + 7 * 86400000 } : {}) });
    const cost = await aiCostFor(rep ? rep.weekStart : ctx.from, rep ? rep.weekStart + 7 * 86400000 : ctx.to, lang);
    return { lang, report: rep, weeks: list.map(r => ({ week: Stats.dayKey(r.weekStart), label: r.label })), team, plans: ctx.plans.filter(p => ['pending', 'active', 'decision'].includes(p.status)).map(p => Plans.view(p, ctx.analyses, ctx.managers)), aiCostUsd: cost };
}));
router.post('/weekly/run', authRequired, requireRoles(DIRECTORS), wrap(async () => runWeekly(true)));
router.get('/settings', authRequired, requireRoles(STAFF.concat(['targetolog'])), wrap(async () => Plans.settings(db)));
router.post('/settings', authRequired, requireRoles(DIRECTORS), wrap(async req => Plans.saveSettings(db, req.body || {}, await userName(req))));
// Targetolog: faqat lid sifati (menejer ballari va Sotuv › Tahlil ko'rinmaydi).
router.get('/lead-quality', authRequired, requireRoles(['admin', 'boshliq', 'rop', 'targetolog']), wrap(async req => {
    const lang = await langScope(req);
    const ctx = await loadCtx(lang, req.query);
    const lq = Stats.leadQuality(ctx);
    // Maqsadli lid narxi: shu davr reklama xarajati (targetolog kiritgan) ÷ maqsadli lidlar.
    const spend = await adSpendUsd(lang, ctx.from, ctx.to).catch(() => null);
    return { lang, from: ctx.from, to: ctx.to, ...lq, adSpendUsd: spend, costPerTargeted: spend != null && lq.targeted ? Math.round(spend / lq.targeted * 100) / 100 : null };
}));

async function aiCostFor(from, to, lang) {
    try {
        const { rows } = await db.pool.query(`SELECT COALESCE(SUM(usd),0)::float AS usd FROM ai_call_costs WHERE at >= to_timestamp($1/1000.0) AND at < to_timestamp($2/1000.0) AND COALESCE(lang,'russian') = $3`, [from, to, lang]);
        return Math.round(rows[0].usd * 100) / 100;
    } catch { return null; }
}
// Targetolog kiritgan kunlik reklama sarfi ($) — target_ad_entries (kind='day', data.budget).
async function adSpendUsd(lang, from, to) {
    const { rows } = await db.pool.query(`SELECT COALESCE(SUM((data->>'budget')::numeric),0)::float AS usd, COUNT(*)::int AS n FROM target_ad_entries WHERE language=$1 AND kind='day' AND date >= $2 AND date <= $3`,
        [lang, Stats.dayKey(from), Stats.dayKey(to - 1)]);
    return rows[0].n ? Math.round(rows[0].usd * 100) / 100 : null;
}
// Menejerga push (Jamoa ilovasi): "Menejerga eslatish".
async function notifyManager(managerId, text) {
    const fcm = require('../services/fcm');
    if (!fcm.configured?.()) return;
    const { rows } = await db.pool.query(`SELECT t.token FROM staff_push_tokens t JOIN user_sales_manager_links l ON l.user_id = t.user_id WHERE l.manager_id = $1`, [managerId]);
    for (const r of rows) await fcm.send(r.token, { title: 'Rivojlanish rejasi', body: text, tag: 'call-plan', id: `plan:${Date.now()}`, url: '/?tab=call-ai-me' }).catch(() => {});
}
// Har soat: dushanba 09:00 dan keyin bir marta — rejalar va haftalik hisobot.
let weeklyRunning = false;
async function runWeekly(force = false) {
    if (weeklyRunning) return { busy: true };
    weeklyRunning = true;
    try {
        const analyses = await getCallAi().all();
        const managers = await db.getSalesManagersMap();
        const leads = new Map((await db.getLeadsByIds(analyses.slice(-6000).map(a => a.leadId))).map(l => [l.id, l]));
        return await Plans.weekly(db, { analyses, managers, leads, force });
    } finally { weeklyRunning = false; }
}
function startWeekly() {
    if (process.env.NODE_ENV === 'test') return;
    const tick = () => runWeekly(false).catch(err => console.error('[callPlans]', err.message));
    setInterval(tick, 3600 * 1000).unref?.();
    setTimeout(tick, 120 * 1000).unref?.();
}

// Lid modalidagi yozuvlarga tahlil qo'shishda: kim qaysi tahlilni ko'ra oladi.
async function analysisFilter(user) {
    if (user?.role === 'rop') {
        const langs = await require('../services/ropScope').ropLangsFor(db.pool, user);
        return a => !langs || langs.includes(a.lang);
    }
    if (LEADS_ALL.includes(user?.role)) return () => true;
    if (user?.role !== 'sales_manager') return () => false;
    const mid = await db.getSalesManagerIdForUser(user.id);
    return (a, lead) => !!mid && (a.managerId === mid || lead?.managerId === mid);
}

module.exports = { router, getCallAi, analysisFilter, STAFF, LEADS_ALL, startWeekly, runWeekly, period };
