const express = require('express');
const {
    insertLead, getLeads, getDeletedLeads, getLeadById, getSalesManagerIdForUser,
    upsertLead, softDeleteLead, restoreLead
} = require('../db');
const { authRequired } = require('../middleware/auth');
const { webhookSecretRequired } = require('../middleware/webhook');
const { sendLeadToCapi } = require('../services/capiWebhook');
const { notifyLeadChannel } = require('../services/leadChannelNotify');
const ropScope = require('../services/ropScope');
const staleLeads = require('../services/staleLeads');
// ROP faqat HR'dagi o'z til yo'nalishi lidlarini ko'radi va o'zgartiradi (til belgilanmagan — cheklovsiz).
const ropLangs = req => ropScope.ropLangsFor(require('../db').pool, req.user);

const router = express.Router();

const ALLOWED_SOURCES = new Set(['domwork', 'homework', 'organik']);

function resolveSource(body, req) {
    const fromBody = (body.source || '').toLowerCase().trim();
    const fromHeader = (req.headers['x-lead-source'] || '').toLowerCase().trim();

    // 2-ish: domain (Referer/Origin) dan avtomatik aniqlash
    const referer = (
        req.headers['referer'] || req.headers['referrer'] || req.headers['origin'] || ''
    ).toLowerCase();
    let fromReferer = '';
    if (referer.includes('domwork.uz')) fromReferer = 'domwork';
    else if (referer.includes('homeworkuz.uz') || referer.includes('homework.uz')) fromReferer = 'homework';

    const raw = fromBody || fromHeader || fromReferer || 'organik';
    if (!ALLOWED_SOURCES.has(raw)) return { error: 'Manba domwork, homework yoki organik bo\'lishi kerak' };
    if (raw === 'domwork') return { value: 'Domwork' };
    if (raw === 'homework') return { value: 'Homework' };
    return { value: 'Organik' };
}

router.post('/', webhookSecretRequired, async (req, res) => {
    try {
        const body = req.body || {};
        const name = body.name || body.fullName || body.ism;
        const phone = body.phone || body.tel || body.telefon || '';
        const externalId = body.externalId || body.external_id || body.id || null;
        // Kelgan so'rov nima bo'lganini ko'rish uchun — maydonlar mos kelmasa
        // lid jimgina yo'qolib ketmasin.
        console.log('[leads] KELDI  maydonlar=' + JSON.stringify(Object.keys(body)) +
            ` ism=${name ? 'bor' : 'YO\'Q'} tel=${phone ? 'bor' : 'YO\'Q'}`);
        if (!name?.trim()) {
            console.warn('[leads] RAD: ism yo\'q. Yuborilgan tana:', JSON.stringify(body).slice(0, 300));
            return res.status(400).json({ error: 'Ism kiritilishi shart' });
        }
        const sourceResult = resolveSource(body, req);
        if (sourceResult.error) {
            console.warn('[leads] RAD: manba noto\'g\'ri.', sourceResult.error,
                'body.source=' + (body.source || '-'), 'referer=' + (req.headers['referer'] || '-'));
            return res.status(400).json({ error: sourceResult.error });
        }

        // 2-ish: Domen orqali til aniqlash (source='Organik' bo'lsa ham ishlaydi)
        // Referer/Origin header source fieldidan USTUN turadi
        const referer = (
            req.headers['referer'] || req.headers['referrer'] || req.headers['origin'] || ''
        ).toLowerCase();
        let language = body.language || body.lang || body.til || body.subject || null;
        if (referer.includes('domwork.uz')) language = 'russian';
        else if (referer.includes('homeworkuz.uz') || referer.includes('homework.uz')) language = 'english';

        // 3-ish: Bog'lanish uchun qulay vaqt
        const contactTime = String(
            body.contactTime || body.contact_time || body.qulay_vaqt ||
            body.preferredTime || body.preferred_time || ''
        ).trim();

        // CAPI.uz (Meta Conversions API) integratsiyasi uchun — "target"
        // (reklama) tomonidan yuborilsa, shu maydonlar orqali lid qaysi
        // reklamadan kelganini keyinchalik Meta'ga to'g'ri bog'lab
        // beramiz. Kelmasa ham lid oddiy yaratilaveradi.
        const utmSource = body.utmSource || body.utm_source;
        const utmCampaign = body.utmCampaign || body.utm_campaign;
        const utmContent = body.utmContent || body.utm_content;
        const fbclid = body.fbclid;
        const fbLeadId = body.fbLeadId || body.fb_lead_id || body.leadId || body.lead_id;
        const ctwaClid = body.ctwaClid || body.ctwa_clid;
        const igUsername = body.igUsername || body.ig_username;

        const result = await insertLead({
            name: name.trim(), phone: String(phone).trim(),
            email: String(body.email || body.mail || '').trim(),
            language, source: sourceResult.value, externalId,
            date: body.date, status: body.status,
            leadType: body.leadType || body.lead_type || body.type,
            contactTime,
            utmSource, utmCampaign, utmContent, fbclid, fbLeadId, ctwaClid, igUsername,
        });
        // Bot havolasi faqat domwork.uz landing arizasiga (boshqa webhooklar uchun token yaratilmaydi).
        const landing = sourceResult.value === 'Domwork' && /^domwork_[a-f0-9-]{36}$/i.test(String(externalId || ''));
        if (result.duplicate) {
            console.log(`[leads] DUBLIKAT  id=${result.id} manba=${sourceResult.value}`);
            const telegramUrl = landing ? await require('../services/domworkBot/leadLink').issueIfEnabled(require('../db').pool, result.id) : null;
            return res.status(200).json({ ok: true, id: result.id, duplicate: true, ...(telegramUrl ? { telegramUrl } : {}) });
        }
        console.log(`[leads] YARATILDI  id=${result.id} manba=${sourceResult.value} til=${language || '-'}`);
        // Rus tili lidiga @Domworkuz_bot shaxsiy havolasi (voronka yoqilgan bo'lsa) — landing "Rahmat" sahifasidagi tugma.
        const telegramUrl = landing ? await require('../services/domworkBot/leadLink').issueIfEnabled(require('../db').pool, result.id) : null;
        res.status(201).json({ ok: true, id: result.id, lead: result.lead, ...(telegramUrl ? { telegramUrl } : {}) });
        // Javobdan keyin — CAPI.uz sekin ishlasa ham landing page/webhook
        // javobi kechikmaydi (CRM'ning asosiy oqimiga bog'liq emas).
        if (result.lead) sendLeadToCapi(result.lead);
        // domwork.uz saytidan kelgan lid Telegram kanalga ham nusxa sifatida
        // tushadi (sozlanmagan bo'lsa hech narsa qilmaydi).
        if (sourceResult.value === 'Domwork') {
            notifyLeadChannel({
                id: result.id, name: name.trim(), phone: String(phone).trim(),
                contactTime, utmSource, utmCampaign, utmContent,
            }).catch(() => {});
        }
    } catch (err) {
        console.error('POST /api/leads', err);
        res.status(500).json({ error: 'Lidni saqlashda xatolik' });
    }
});

function leadMutationRequired(req, res, next) {
    if (!['admin', 'rop', 'boshliq', 'sales_manager'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Lidlarni o\'zgartirish uchun ruxsat yo\'q' });
    }
    next();
}

function leadReadRequired(req, res, next) {
    // 8-vazifa: Targetolog faqat KO'RISH huquqiga ega - shu sabab shu yerga
    // (o'qish) qo'shildi, lekin leadMutationRequired/leadArchiveRequired'ga
    // qo'shilmadi, shuning uchun har qanday yozish/o'chirish/tiklash
    // so'rovi serverda ham 403 bilan rad etiladi.
    if (!['admin', 'rop', 'boshliq', 'sales_manager', 'targetolog'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Lidlarni ko\'rish uchun ruxsat yo\'q' });
    }
    next();
}

async function leadOwnershipRequired(req, res, next) {
    try {
        if (req.user?.role === 'rop') {
            const langs = await ropLangs(req);
            if (langs) {
                const existing = await getLeadById(req.params.id);
                const bad = (existing && !langs.includes(ropScope.langOfLead(existing)))
                    || (req.method === 'PATCH' && req.body?.language && !langs.includes(req.body.language === 'russian' ? 'russian' : 'english'));
                if (bad) return res.status(403).json({ error: 'ROP faqat o\'z til yo\'nalishidagi lidlarni o\'zgartiradi' });
            }
            return next();
        }
        if (['admin', 'boshliq'].includes(req.user?.role)) return next();
        const managerId = await getSalesManagerIdForUser(req.user?.id);
        if (!managerId) {
            return res.status(403).json({ error: 'Sotuv menejeri CRM profiliga bog\'lanmagan' });
        }
        const existing = await getLeadById(req.params.id);
        if (existing) {
            if (existing.deletedAt || existing.managerId !== managerId) {
                return res.status(403).json({ error: 'Bu lid boshqa menejerga tegishli' });
            }
            if (req.method === 'PATCH' && Object.prototype.hasOwnProperty.call(req.body?.lead || {}, 'managerId')
                && String(req.body.lead.managerId || '') !== managerId) {
                return res.status(403).json({ error: 'Sotuv menejeri lid egasini o\'zgartira olmaydi' });
            }
            if (req.method === 'PATCH' && req.body?.language && req.body.language !== existing.language) {
                return res.status(403).json({ error: 'Sotuv menejeri lid tilini o\'zgartira olmaydi' });
            }
        } else if (req.method === 'PATCH') {
            // Sotuv menejeri yangi lid yarata olmaydi: lidlarni ROP taqsimlaydi.
            // Aks holda menejer istalgan odamni qo'shib, statistikani soxtalashtirishi mumkin edi.
            return res.status(403).json({ error: 'Yangi lidni faqat ROP yoki admin qoʻsha oladi' });
        } else {
            return res.status(404).json({ error: 'Lid topilmadi' });
        }
        req.salesManagerId = managerId;
        next();
    } catch (err) {
        console.error('Lid egasini tekshirishda xatolik', err);
        res.status(500).json({ error: 'Lid ruxsatini tekshirishda xatolik' });
    }
}

function leadArchiveRequired(req, res, next) {
    if (!['admin', 'rop', 'boshliq'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Lidlar arxiviga ruxsat yo\'q' });
    }
    next();
}

router.get('/deleted', authRequired, leadArchiveRequired, async (req, res) => {
    try {
        const langs = req.user.role === 'rop' ? await ropLangs(req) : null;
        const all = await getDeletedLeads();
        res.json({ leads: langs ? all.filter(l => langs.includes(ropScope.langOfLead(l))) : all });
    } catch (err) {
        console.error('GET /api/leads/deleted', err);
        res.status(500).json({ error: 'Lidlar arxivini olishda xatolik' });
    }
});

// "Qotib qolgan lidlar" qoidasi (necha kunda ogohlantirish / qulf) — til bo'yicha.
router.get('/stale-rule', authRequired, leadReadRequired, async (req, res) => {
    try { res.json({ rules: await staleLeads.getRules(require('../db').pool) }); }
    catch (err) { console.error('GET /api/leads/stale-rule', err); res.json({ rules: { english: staleLeads.DEFAULT_RULE, russian: staleLeads.DEFAULT_RULE } }); }
});
router.put('/stale-rule', authRequired, async (req, res) => {
    if (!['admin', 'rop', 'boshliq'].includes(req.user?.role)) return res.status(403).json({ error: 'Qoidani faqat ROP yoki admin oʻzgartiradi' });
    try {
        const langs = req.user.role === 'rop' ? await ropLangs(req) : null;
        res.json({ rules: await staleLeads.saveRules(require('../db').pool, req.body?.rules || {}, langs) });
    } catch (err) { console.error('PUT /api/leads/stale-rule', err); res.status(500).json({ error: 'Qoidani saqlab boʻlmadi' }); }
});

// CRM ichidagi barcha lid o'zgarishlari endi bitta qator bo'yicha yoziladi.
// Eski generic /api/state snapshot yo'li 200+ lidni yo'qotgan — bu endpoint
// boshqa lidlarning birortasiga tegmaydi.
router.patch('/:id', authRequired, leadMutationRequired, leadOwnershipRequired, async (req, res) => {
    try {
        const lead = req.body?.lead;
        const language = req.body?.language;
        if (!lead || typeof lead !== 'object') {
            return res.status(400).json({ error: 'Lid ma\'lumoti yuborilishi shart' });
        }
        if (Object.prototype.hasOwnProperty.call(lead, 'comments') && !Array.isArray(lead.comments)) {
            return res.status(400).json({ error: 'Lid izohlari massiv bo\'lishi kerak' });
        }
        if (Object.prototype.hasOwnProperty.call(lead, 'attachments') && !Array.isArray(lead.attachments)) {
            return res.status(400).json({ error: 'Lid fayllari massiv bo\'lishi kerak' });
        }
        if (!['english', 'russian'].includes(language)) {
            return res.status(400).json({ error: 'Til english yoki russian bo\'lishi kerak' });
        }
        if (req.user.role === 'sales_manager' && lead.status === 'sifatsiz-lidlar') {
            staleLeads.assertCallBeforeSifatsiz(await getLeadById(req.params.id), lead, req.user.role);
        }
        const { lead: saved, platformAccess } = await upsertLead({ ...lead, id: req.params.id }, language, req.user);
        res.json({ ok: true, lead: saved, platformAccess });
        // Har bir saqlashda yuboriladi (faqat status o'zgarganda emas) —
        // CAPI.uz bir xil externalId+stage takrorlansa ham xato bermaydi
        // (hujjatga qarang), shuning uchun bu yerda soddalik uchun har
        // qanday o'zgarishda (status, telefon, summa va h.k.) yuboriladi.
        sendLeadToCapi(saved);
    } catch (err) {
        console.error('PATCH /api/leads/:id', err);
        res.status(err.status || 400).json({ error: err.message || 'Lidni saqlashda xatolik', code: err.code });
    }
});

// O'chirish hard-delete emas: row yashiriladi, snapshot auditda qoladi va
// arxivdan qayta tiklash PATCH orqali deleted_at ni tozalaydi.
router.delete('/:id', authRequired, leadMutationRequired, leadOwnershipRequired, async (req, res) => {
    try {
        const deleted = await softDeleteLead(req.params.id, req.user);
        if (!deleted) return res.status(404).json({ error: 'Lid topilmadi' });
        res.json({ ok: true, lead: deleted });
    } catch (err) {
        console.error('DELETE /api/leads/:id', err);
        res.status(400).json({ error: err.message || 'Lidni o\'chirishda xatolik' });
    }
});

router.post('/:id/restore', authRequired, leadArchiveRequired, async (req, res) => {
    try {
        if (req.user.role === 'rop') {
            const langs = await ropLangs(req), existing = langs ? await getLeadById(req.params.id) : null;
            if (existing && !langs.includes(ropScope.langOfLead(existing))) return res.status(403).json({ error: 'ROP faqat o\'z til yo\'nalishidagi lidlarni tiklaydi' });
        }
        const restored = await restoreLead(req.params.id, req.user);
        if (!restored) return res.status(404).json({ error: 'Lid topilmadi' });
        res.json({ ok: true, lead: restored });
    } catch (err) {
        console.error('POST /api/leads/:id/restore', err);
        res.status(400).json({ error: err.message || 'Lidni tiklashda xatolik' });
    }
});

router.get('/', authRequired, leadReadRequired, async (req, res) => {
    try {
        if (req.user.role === 'sales_manager') {
            const managerId = await getSalesManagerIdForUser(req.user.id);
            if (!managerId) return res.json({ english: [], russian: [] });
            return res.json(await getLeads({ managerId }));
        }
        if (req.user.role === 'targetolog') {
            const langs = await require('../services/targetAds').targetologLangs(require('../db').pool, req.user);
            const all = await getLeads();
            return res.json(Object.fromEntries(['english', 'russian'].map(l => [l, langs.includes(l) ? (all[l] || []) : []])));
        }
        if (req.user.role === 'rop') return res.json(ropScope.scopeLeads(await getLeads(), await ropLangs(req)));
        res.json(await getLeads());
    } catch (err) {
        console.error('GET /api/leads', err);
        res.status(500).json({ error: 'Lidlarni yuklashda xatolik' });
    }
});

module.exports = router;
