const express = require('express');
const { insertLead, getLeads } = require('../db');
const { authRequired } = require('../middleware/auth');
const { webhookSecretRequired } = require('../middleware/webhook');

const router = express.Router();

const ALLOWED_SOURCES = new Set(['domwork', 'homework', 'organik']);

function resolveSource(body, req) {
    const fromBody = (body.source || '').toLowerCase().trim();
    const fromHeader = (req.headers['x-lead-source'] || '').toLowerCase().trim();
    const raw = fromBody || fromHeader || 'organik';
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
        const language = body.language || body.lang || body.til || body.subject;
        if (!name?.trim()) return res.status(400).json({ error: 'Ism kiritilishi shart' });
        const sourceResult = resolveSource(body, req);
        if (sourceResult.error) return res.status(400).json({ error: sourceResult.error });
        const result = await insertLead({
            name: name.trim(), phone: String(phone).trim(),
            email: String(body.email || body.mail || '').trim(),
            language, source: sourceResult.value, externalId,
            date: body.date, status: body.status,
            leadType: body.leadType || body.lead_type || body.type
        });
        if (result.duplicate) return res.status(200).json({ ok: true, id: result.id, duplicate: true });
        res.status(201).json({ ok: true, id: result.id, lead: result.lead });
    } catch (err) {
        console.error('POST /api/leads', err);
        res.status(500).json({ error: 'Lidni saqlashda xatolik' });
    }
});

router.get('/', authRequired, async (req, res) => {
    try {
        res.json(await getLeads());
    } catch (err) {
        console.error('GET /api/leads', err);
        res.status(500).json({ error: 'Lidlarni yuklashda xatolik' });
    }
});

module.exports = router;
