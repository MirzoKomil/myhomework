const express = require('express');
const {
    insertLead, getLeads, getDeletedLeads, getLeadById, getSalesManagerIdForUser,
    upsertLead, softDeleteLead, restoreLead
} = require('../db');
const { authRequired } = require('../middleware/auth');
const { webhookSecretRequired } = require('../middleware/webhook');

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
        if (!name?.trim()) return res.status(400).json({ error: 'Ism kiritilishi shart' });
        const sourceResult = resolveSource(body, req);
        if (sourceResult.error) return res.status(400).json({ error: sourceResult.error });

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

        const result = await insertLead({
            name: name.trim(), phone: String(phone).trim(),
            email: String(body.email || body.mail || '').trim(),
            language, source: sourceResult.value, externalId,
            date: body.date, status: body.status,
            leadType: body.leadType || body.lead_type || body.type,
            contactTime
        });
        if (result.duplicate) return res.status(200).json({ ok: true, id: result.id, duplicate: true });
        res.status(201).json({ ok: true, id: result.id, lead: result.lead });
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
    if (!['admin', 'rop', 'boshliq', 'sales_manager'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Lidlarni ko\'rish uchun ruxsat yo\'q' });
    }
    next();
}

async function leadOwnershipRequired(req, res, next) {
    try {
        if (['admin', 'rop', 'boshliq'].includes(req.user?.role)) return next();
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
            if (String(req.body?.lead?.managerId || '') !== managerId) {
                return res.status(403).json({ error: 'Yangi lid faqat o\'zingizga biriktirilishi mumkin' });
            }
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

router.get('/deleted', authRequired, leadArchiveRequired, async (_req, res) => {
    try {
        res.json({ leads: await getDeletedLeads() });
    } catch (err) {
        console.error('GET /api/leads/deleted', err);
        res.status(500).json({ error: 'Lidlar arxivini olishda xatolik' });
    }
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
        const saved = await upsertLead({ ...lead, id: req.params.id }, language, req.user);
        res.json({ ok: true, lead: saved });
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
        res.json(await getLeads());
    } catch (err) {
        console.error('GET /api/leads', err);
        res.status(500).json({ error: 'Lidlarni yuklashda xatolik' });
    }
});

module.exports = router;
