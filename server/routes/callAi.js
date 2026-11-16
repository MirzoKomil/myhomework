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
    if (!instance) instance = createCallAi({ db, uploadsDir: UPLOADS_DIR });
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

module.exports = { router, getCallAi, analysisFilter, STAFF, LEADS_ALL };
