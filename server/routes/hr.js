// HR Vakansiya voronkasi API'si + @Homework_HR_bot webhooki (18-vazifa).
const express = require('express');
const router = express.Router();

const { authRequired, JWT_SECRET } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const {
    listCandidates, getCandidateById, updateCandidate, deleteCandidate,
    getMedia, insertCandidate,
} = require('../services/hrCandidates');
const { HR_STAGES, normalizeHrStage, VACANCIES } = require('../services/hrStages');
const { VACANCY_QUESTIONS } = require('../services/hrQuestions');
const hrBot = require('../services/hrBot');

// ── Telegram bot webhooki ───────────────────────────────────────────────────
// Telegram javobni tez kutadi (aks holda o'sha update'ni qayta-qayta
// yuboraveradi), shu sabab HAR DOIM darhol 200 qaytariladi va ish fonda
// bajariladi. Xatolar faqat logga tushadi.
router.post('/bot-webhook', (req, res) => {
    const expected = process.env.TELEGRAM_HR_WEBHOOK_SECRET || '';
    if (expected && req.headers['x-telegram-bot-api-secret-token'] !== expected) {
        console.warn('[hr-bot] RAD: secret_token mos kelmadi');
        return res.sendStatus(401);
    }
    res.sendStatus(200);
    Promise.resolve(hrBot.handleUpdate(req.body || {}))
        .catch(err => console.error('[hr-bot] Update qayta ishlanmadi:', err.message));
});

// Sozlanish holati — maxfiy qiymatlar hech qachon qaytarilmaydi, faqat
// "bor/yo'q" bayrog'i.
router.get('/bot-webhook/status', authRequired, (req, res) => {
    if (!['admin', 'boshliq'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Faqat admin korishi mumkin' });
    }
    const bor = v => Boolean(v);
    res.json({
        webhookUrl: 'https://myhomework.uz/api/hr/bot-webhook',
        env: {
            TELEGRAM_HR_BOT_TOKEN: bor(process.env.TELEGRAM_HR_BOT_TOKEN),
            TELEGRAM_HR_WEBHOOK_SECRET: bor(process.env.TELEGRAM_HR_WEBHOOK_SECRET),
            HR_BOT_CHANNEL_URL: bor(process.env.HR_BOT_CHANNEL_URL),
            HR_BOT_CONTACT_USERNAME: bor(process.env.HR_BOT_CONTACT_USERNAME),
            HR_BOT_ABOUT_VIDEO_URL: bor(process.env.HR_BOT_ABOUT_VIDEO_URL),
        },
    });
});

// Webhookni Telegram'da ro'yxatdan o'tkazish — bir marta bosiladi.
router.post('/bot-webhook/setup', authRequired, async (req, res) => {
    if (!['admin', 'boshliq'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Faqat admin qila oladi' });
    }
    if (!hrBot.hasToken()) {
        return res.status(503).json({ error: 'TELEGRAM_HR_BOT_TOKEN o\'rnatilmagan' });
    }
    const url = 'https://myhomework.uz/api/hr/bot-webhook';
    const result = await hrBot.setWebhook(url, process.env.TELEGRAM_HR_WEBHOOK_SECRET);
    if (!result?.ok) {
        return res.status(502).json({ error: result?.description || 'Telegram rad etdi' });
    }
    res.json({ ok: true, url });
});

// ── CRM: voronka ma'lumotlari ───────────────────────────────────────────────

// Ustunlar ta'rifi + vakansiyalar ro'yxati — frontend ularni qattiq
// yozmasin, serverdagi bitta manbadan olsin.
router.get('/meta', authRequired, (req, res) => {
    // Savol matnlari ham beriladi: nomzod kartochkasida javob yonida
    // "sales_experience" emas, haqiqiy savol ko'rinsin. Frontend ularni
    // qattiq yozib qo'ymasligi uchun manba bitta joyda qoladi.
    const questionLabels = {};
    for (const v of VACANCIES) {
        for (const q of (VACANCY_QUESTIONS[v.id] || [])) {
            questionLabels[q.key] = q.text.split('\n')[0];
        }
    }
    res.json({ stages: HR_STAGES, vacancies: VACANCIES, questionLabels });
});

router.get('/candidates', authRequired, async (req, res) => {
    try {
        res.json({ candidates: await listCandidates() });
    } catch (err) {
        console.error('GET /api/hr/candidates', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

router.get('/candidates/:id', authRequired, async (req, res) => {
    try {
        const candidate = await getCandidateById(req.params.id);
        if (!candidate) return res.status(404).json({ error: 'Nomzod topilmadi' });
        res.json({ candidate });
    } catch (err) {
        console.error('GET /api/hr/candidates/:id', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

router.patch('/candidates/:id', authRequired, async (req, res) => {
    try {
        const body = req.body || {};
        if (body.stage !== undefined && normalizeHrStage(body.stage) !== body.stage) {
            return res.status(400).json({ error: 'Bosqich noto\'g\'ri' });
        }
        if (body.comments !== undefined && !Array.isArray(body.comments)) {
            return res.status(400).json({ error: 'Izohlar massiv bo\'lishi kerak' });
        }
        const candidate = await updateCandidate(req.params.id, body);
        if (!candidate) return res.status(404).json({ error: 'Nomzod topilmadi' });
        res.json({ ok: true, candidate });
    } catch (err) {
        console.error('PATCH /api/hr/candidates/:id', err);
        res.status(400).json({ error: 'Saqlashda xatolik' });
    }
});

router.delete('/candidates/:id', authRequired, async (req, res) => {
    if (!['admin', 'boshliq'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Faqat admin o\'chira oladi' });
    }
    try {
        const ok = await deleteCandidate(req.params.id);
        if (!ok) return res.status(404).json({ error: 'Nomzod topilmadi' });
        res.json({ ok: true });
    } catch (err) {
        console.error('DELETE /api/hr/candidates/:id', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

// ── Media (rasm / ovoz / video) ─────────────────────────────────────────────
// <img src> va <audio src> maxsus sarlavha yubora olmaydi, shuning uchun
// token query-parametr sifatida ham qabul qilinadi — server/routes/state.js
// dagi shartnoma PDF havolasi bilan bir xil yondashuv.
const MEDIA_KINDS = new Set(['photo', 'voice', 'video']);

router.get('/candidates/:id/media/:kind', async (req, res) => {
    const header = req.headers.authorization || '';
    let token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token && typeof req.query.token === 'string') token = req.query.token;
    if (!token) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
    try {
        jwt.verify(token, JWT_SECRET);
    } catch {
        return res.status(401).json({ error: 'Token yaroqsiz' });
    }

    if (!MEDIA_KINDS.has(req.params.kind)) {
        return res.status(400).json({ error: 'Media turi noto\'g\'ri' });
    }
    try {
        const media = await getMedia(req.params.id, req.params.kind);
        if (!media) return res.status(404).json({ error: 'Fayl topilmadi' });
        res.setHeader('Content-Type', media.mime || 'application/octet-stream');
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.send(media.bytes);
    } catch (err) {
        console.error('GET /api/hr/candidates/:id/media', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

// ── Tashqi webhook: bot boshqa serverda ishlasa ham ariza qabul qilinadi ────
// (TZ, 5.1-band). Ichki bot bilan bir xil natija beradi.
router.post('/candidates', async (req, res) => {
    const expected = process.env.HR_WEBHOOK_SECRET || '';
    if (!expected) return res.status(503).json({ error: 'HR_WEBHOOK_SECRET o\'rnatilmagan' });
    const got = req.headers['x-webhook-secret']
        || (req.headers.authorization || '').replace(/^Bearer\s+/, '');
    if (got !== expected) {
        console.warn('[hr] Tashqi ariza RAD ETILDI: kalit mos kelmadi');
        return res.status(401).json({ error: 'Kalit noto\'g\'ri' });
    }
    try {
        const b = req.body || {};
        if (!String(b.full_name || '').trim()) {
            return res.status(400).json({ error: 'full_name majburiy' });
        }
        const candidate = await insertCandidate({
            telegramUserId: b.telegram_user_id,
            telegramUsername: b.telegram_username,
            fullName: b.full_name,
            telegramPhone: b.telegram_phone,
            contactPhone: b.contact_phone,
            address: b.address,
            birthYear: b.birth_year,
            hasLaptop: typeof b.has_laptop === 'boolean' ? b.has_laptop : undefined,
            readyForOffice: typeof b.ready_for_office === 'boolean' ? b.ready_for_office : undefined,
            vacancyName: b.vacancy_name,
            answers: b.answers || {},
            utmSource: b.utm_source,
        });
        console.log(`[hr] Tashqi ariza qabul qilindi id=${candidate.id} ism="${candidate.fullName}"`);
        res.json({ ok: true, id: candidate.id });
    } catch (err) {
        console.error('POST /api/hr/candidates', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

module.exports = router;
