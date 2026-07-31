const crypto = require('crypto');
const express = require('express');
const { insertLead } = require('../db');

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

function getLeadConfig() {
    return requireConfig({
        ...getWebhookConfig(),
        pageToken: process.env.META_PAGE_ACCESS_TOKEN,
        pageId: process.env.META_PAGE_ID,
    });
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
    });
    return result;
}

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
