const crypto = require('crypto');
const express = require('express');
const { insertLead, getLeads } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0';

function getCsv(value) {
    return new Set(String(value || '').split(',').map(item => item.trim()).filter(Boolean));
}

function requireConfig(config) {
    const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
    if (missing.length) throw new Error(`Meta integratsiyasi sozlanmagan: ${missing.join(', ')}`);
    return config;
}

function getWebhookConfig() {
    return requireConfig({
        appSecret: process.env.META_APP_SECRET,
        verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
    });
}

// Meta Instant Forms tarixini o'qish uchun webhook maxfiy kalitlari kerak
// emas. Tiklash oqimini webhook konfiguratsiyasidan ajratib saqlaymiz:
// Page ID va Page Access Token tarixiy formalar/lidlarni o'qish uchun yetarli.
function getPageConfig() {
    return requireConfig({
        pageToken: process.env.META_PAGE_ACCESS_TOKEN,
        pageId: process.env.META_PAGE_ID,
    });
}

function getLeadConfig() {
    return {
        ...getWebhookConfig(),
        ...getPageConfig(),
    };
}

function verifyMetaSignature(req, appSecret) {
    const signature = String(req.headers['x-hub-signature-256'] || '');
    if (!signature.startsWith('sha256=') || !req.rawBody) return false;
    const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex')}`;
    const actual = Buffer.from(signature);
    const target = Buffer.from(expected);
    return actual.length === target.length && crypto.timingSafeEqual(actual, target);
}

function mapFieldData(fieldData = []) {
    const fields = new Map();
    for (const item of fieldData) {
        const name = String(item?.name || '').toLowerCase();
        const value = Array.isArray(item?.values) ? item.values[0] : '';
        if (name && value != null) fields.set(name, String(value).trim());
    }
    const firstName = fields.get('first_name') || '';
    const lastName = fields.get('last_name') || '';
    const name = fields.get('full_name') || fields.get('name') || `${firstName} ${lastName}`.trim();
    return {
        name: name || 'Meta lid',
        phone: fields.get('phone_number') || fields.get('phone') || fields.get('telefon') || '',
        email: fields.get('email') || '',
    };
}

function languageForForm(formId) {
    if (getCsv(process.env.META_RUSSIAN_FORM_IDS).has(String(formId))) return 'russian';
    if (getCsv(process.env.META_ENGLISH_FORM_IDS).has(String(formId))) return 'english';
    return process.env.META_DEFAULT_LANGUAGE === 'russian' ? 'russian' : 'english';
}

function recoveryLanguageForForm(form) {
    const id = String(form?.id || '');
    const russianIds = getCsv(process.env.META_RUSSIAN_FORM_IDS);
    const englishIds = getCsv(process.env.META_ENGLISH_FORM_IDS);
    if (russianIds.has(id) && englishIds.has(id)) {
        throw new Error(`Meta forma ${id} bir paytda rus va ingliz ro'yxatiga kiritilgan`);
    }
    if (russianIds.has(id)) return { language: 'russian', mappingSource: 'environment' };
    if (englishIds.has(id)) return { language: 'english', mappingSource: 'environment' };

    // Faqat admin preview oynasida qulay tavsiya. Apply paytida admin har
    // bir formani aniq tasdiqlaydi; bu taxmin o'z-o'zidan import qilmaydi.
    const name = String(form?.name || '').toLowerCase();
    if (/\b(rus|ru)\b|рус|domwork/.test(name)) return { language: 'russian', mappingSource: 'name-inference' };
    if (/\b(eng|en)\b|english|ingliz|homework/.test(name)) return { language: 'english', mappingSource: 'name-inference' };
    return { language: '', mappingSource: 'unmapped' };
}

async function fetchMetaLead(leadgenId, config) {
    const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(leadgenId)}`);
    url.searchParams.set('fields', 'id,created_time,ad_id,form_id,field_data');
    url.searchParams.set('access_token', config.pageToken);
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `Meta Lead API xatosi (HTTP ${response.status})`);
    return data;
}

async function importLead(leadgenId, expectedPageId, config) {
    const metaLead = await fetchMetaLead(leadgenId, config);
    if (config.pageId && String(expectedPageId || metaLead.page_id || '') !== String(config.pageId)) {
        throw new Error('Webhook boshqa Facebook Page uchun keldi');
    }
    const contact = mapFieldData(metaLead.field_data);
    const result = await insertLead({
        ...contact,
        language: languageForForm(metaLead.form_id),
        source: 'Target',
        externalId: metaLead.id || leadgenId,
        status: 'yangi-lidlar',
        leadType: 'target',
        createdAt: metaLead.created_time,
        date: formatMetaDate(metaLead.created_time),
    });
    return result;
}

function formatMetaDate(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString('uz-UZ');
    return new Intl.DateTimeFormat('uz-UZ', {
        timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(date);
}

function normalizePhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length >= 9 ? digits.slice(-9) : digits;
}

async function fetchGraphCollection(pathname, fields, token) {
    const first = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pathname}`);
    first.searchParams.set('fields', fields);
    first.searchParams.set('limit', '100');
    first.searchParams.set('access_token', token);
    const rows = [];
    const seenPages = new Set();
    let next = first.toString();
    let pageCount = 0;
    while (next) {
        if (++pageCount > 1000) throw new Error('Meta pagination xavfsizlik chegarasidan oshdi');
        if (seenPages.has(next)) throw new Error('Meta pagination takroriy manzil qaytardi');
        seenPages.add(next);
        const pageUrl = new URL(next);
        if (pageUrl.protocol !== 'https:' || pageUrl.hostname !== 'graph.facebook.com') {
            throw new Error('Meta pagination manzili xavfsiz emas');
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        let response;
        try {
            response = await fetch(pageUrl, { signal: controller.signal });
        } catch (err) {
            if (err.name === 'AbortError') throw new Error('Meta Graph API javob vaqti tugadi');
            throw err;
        } finally {
            clearTimeout(timer);
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error?.message || `Meta Graph API xatosi (HTTP ${response.status})`);
        if (Array.isArray(data.data)) rows.push(...data.data);
        if (rows.length > 100000) throw new Error('Meta lidlar soni xavfsizlik chegarasidan oshdi');
        next = data?.paging?.next || '';
    }
    return rows;
}

async function getRecoveryForms(config) {
    const configuredIds = new Set([
        ...getCsv(process.env.META_RUSSIAN_FORM_IDS),
        ...getCsv(process.env.META_ENGLISH_FORM_IDS),
    ]);
    let discovered = [];
    try {
        discovered = await fetchGraphCollection(
            `${encodeURIComponent(config.pageId)}/leadgen_forms`,
            'id,name,status',
            config.pageToken
        );
    } catch (err) {
        // Form IDlar Railway'da aniq berilgan bo'lsa discovery xatosi tiklashni
        // to'xtatmasin; aks holda xatoni yuqoriga chiqaramiz.
        if (!configuredIds.size) throw err;
        console.warn('[Meta recovery] Page formalari ro\'yxati olinmadi:', err.message);
    }
    const byId = new Map(discovered.map(form => [String(form.id), form]));
    configuredIds.forEach(id => {
        if (!byId.has(String(id))) byId.set(String(id), { id: String(id), name: `Form ${id}`, status: 'configured' });
    });
    if (!byId.size) throw new Error('Meta Lead Form topilmadi');
    return [...byId.values()];
}

async function fetchHistoricalMetaLeads(config, selectedFormIds = null) {
    const allForms = await getRecoveryForms(config);
    const selected = selectedFormIds ? new Set([...selectedFormIds].map(String)) : null;
    const forms = selected ? allForms.filter(form => selected.has(String(form.id))) : allForms;
    if (!forms.length) throw new Error('Tiklash uchun Meta forma tanlanmadi');
    const leads = [];
    const errors = [];
    // Meta limitlariga bosim bermaslik uchun bir vaqtda ko'pi bilan 4 forma.
    for (let i = 0; i < forms.length; i += 4) {
        const chunk = forms.slice(i, i + 4);
        const results = await Promise.all(chunk.map(async form => {
            try {
                const items = await fetchGraphCollection(
                    `${encodeURIComponent(form.id)}/leads`,
                    'id,created_time,ad_id,form_id,field_data',
                    config.pageToken
                );
                return { form, items };
            } catch (error) {
                return { form, error };
            }
        }));
        for (const result of results) {
            if (result.error) {
                errors.push({ formId: String(result.form.id), formName: result.form.name || '', error: result.error.message });
            } else {
                result.items.forEach(item => leads.push({ ...item, form_id: item.form_id || result.form.id }));
            }
        }
    }
    if (errors.length && selectedFormIds) {
        throw new Error(`Meta formalarning ayrimlari o'qilmadi: ${errors.map(item => `${item.formName || item.formId}: ${item.error}`).join('; ')}`);
    }
    return { forms, leads, errors };
}

async function buildRecoveryPreview(selectedFormIds = null) {
    const config = getPageConfig();
    const historical = await fetchHistoricalMetaLeads(config, selectedFormIds);
    const current = await getLeads();
    const allCurrent = [...(current.english || []), ...(current.russian || [])];
    const externalIds = new Set(allCurrent.map(lead => String(lead.externalId || '')).filter(Boolean));
    const phones = new Set(allCurrent.map(lead => normalizePhone(lead.phone)).filter(Boolean));
    const missing = [];
    const seenMetaIds = new Set();
    let matchedByExternalId = 0;
    let matchedByPhone = 0;
    for (const metaLead of historical.leads) {
        const externalId = String(metaLead.id || '');
        const contact = mapFieldData(metaLead.field_data);
        const phone = normalizePhone(contact.phone);
        if (externalId && (externalIds.has(externalId) || seenMetaIds.has(externalId))) {
            matchedByExternalId++;
            continue;
        }
        if (externalId) seenMetaIds.add(externalId);
        const phoneAlreadyExists = Boolean(phone && phones.has(phone));
        if (phoneAlreadyExists) matchedByPhone++;
        // Meta submission ID authoritative. Bir oilaning umumiy telefoni yoki
        // qayta arizasi haqiqiy lid bo'lishi mumkin, shu sabab telefon match
        // warning bo'ladi, avtomatik skip emas.
        missing.push({ metaLead, contact, phoneAlreadyExists });
    }
    return {
        config,
        ...historical,
        currentCount: allCurrent.length,
        matchedByExternalId,
        matchedByPhone,
        missing
    };
}

function recoveryAdminRequired(req, res, next) {
    if (!['admin', 'rop', 'boshliq'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Meta tiklash faqat admin yoki ROP uchun' });
    }
    next();
}

router.get('/recovery/preview', authRequired, recoveryAdminRequired, async (_req, res) => {
    try {
        const preview = await buildRecoveryPreview();
        const perForm = new Map(preview.forms.map(form => [String(form.id), {
            ...form,
            leadCount: 0,
            missingCount: 0,
            phoneMatchCount: 0
        }]));
        preview.leads.forEach(lead => {
            const stat = perForm.get(String(lead.form_id));
            if (stat) stat.leadCount++;
        });
        preview.missing.forEach(item => {
            const stat = perForm.get(String(item.metaLead.form_id));
            if (stat) {
                stat.missingCount++;
                if (item.phoneAlreadyExists) stat.phoneMatchCount++;
            }
        });
        preview.errors.forEach(item => {
            const stat = perForm.get(String(item.formId));
            if (stat) stat.error = item.error;
        });
        res.json({
            ok: true,
            forms: [...perForm.values()].map(form => ({
                id: String(form.id), name: form.name || '', status: form.status || '',
                ...recoveryLanguageForForm(form),
                leadCount: form.leadCount, missingCount: form.missingCount,
                phoneMatchCount: form.phoneMatchCount, error: form.error || ''
            })),
            formErrors: preview.errors,
            metaLeadCount: preview.leads.length,
            currentLeadCount: preview.currentCount,
            matchedByExternalId: preview.matchedByExternalId,
            matchedByPhone: preview.matchedByPhone,
            missingCount: preview.missing.length,
            sampleNames: preview.missing.slice(0, 8).map(item => item.contact.name)
        });
    } catch (err) {
        console.error('GET /api/meta/recovery/preview', err.message);
        res.status(400).json({ error: err.message || 'Meta lidlarni tekshirishda xatolik' });
    }
});

router.post('/recovery/apply', authRequired, recoveryAdminRequired, async (_req, res) => {
    try {
        const rawMappings = _req.body?.formLanguages;
        if (!rawMappings || typeof rawMappings !== 'object' || Array.isArray(rawMappings)) {
            return res.status(400).json({ error: 'Har bir Meta forma uchun til tanlanishi kerak' });
        }
        const formLanguages = {};
        Object.entries(rawMappings).forEach(([formId, language]) => {
            if (language === 'english' || language === 'russian') formLanguages[String(formId)] = language;
        });
        const selectedIds = new Set(Object.keys(formLanguages));
        if (!selectedIds.size) return res.status(400).json({ error: 'Tiklash uchun kamida bitta Meta forma tanlang' });
        const preview = await buildRecoveryPreview(selectedIds);
        const includePhoneMatches = _req.body?.includePhoneMatches === true;
        const candidates = includePhoneMatches
            ? preview.missing
            : preview.missing.filter(item => !item.phoneAlreadyExists);
        let inserted = 0;
        let duplicate = 0;
        let restored = 0;
        const errors = [];
        for (const item of candidates) {
            try {
                const metaLead = item.metaLead;
                const result = await insertLead({
                    ...item.contact,
                    language: formLanguages[String(metaLead.form_id)],
                    source: 'Target',
                    externalId: metaLead.id,
                    status: 'yangi-lidlar',
                    leadType: 'target',
                    createdAt: metaLead.created_time,
                    date: formatMetaDate(metaLead.created_time)
                });
                if (result.restored) restored++;
                else if (result.duplicate) duplicate++;
                else inserted++;
            } catch (err) {
                errors.push({ externalId: String(item.metaLead.id || ''), error: err.message });
            }
        }
        res.json({
            ok: true,
            inserted,
            restored,
            duplicate,
            failed: errors.length,
            skippedPhoneMatches: includePhoneMatches ? 0 : preview.missing.length - candidates.length,
            errors: errors.slice(0, 20)
        });
    } catch (err) {
        console.error('POST /api/meta/recovery/apply', err.message);
        res.status(400).json({ error: err.message || 'Meta lidlarni tiklashda xatolik' });
    }
});

// Meta webhook endpointini tasdiqlash. Meta `hub.challenge` qiymatini aynan qaytarishni kutadi.
router.get('/webhook', (req, res) => {
    try {
        const { verifyToken } = getWebhookConfig();
        if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === verifyToken) {
            return res.status(200).send(String(req.query['hub.challenge'] || ''));
        }
        return res.sendStatus(403);
    } catch (err) {
        console.error('GET /api/meta/webhook', err.message);
        return res.status(503).send('Meta webhook sozlanmagan');
    }
});

router.post('/webhook', async (req, res) => {
    try {
        const config = getLeadConfig();
        if (!verifyMetaSignature(req, config.appSecret)) return res.sendStatus(401);
        const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
        for (const entry of entries) {
            for (const change of entry?.changes || []) {
                if (change?.field !== 'leadgen' || !change?.value?.leadgen_id) continue;
                await importLead(change.value.leadgen_id, change.value.page_id || entry.id, config);
            }
        }
        return res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
        // Meta 5xx javobda webhookni qayta yuboradi; externalId dublikatlarni bloklaydi.
        console.error('POST /api/meta/webhook', err.message);
        return res.status(500).send('Meta lead import failed');
    }
});

module.exports = router;
