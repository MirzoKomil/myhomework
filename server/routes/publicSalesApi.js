// "platformaga API chiqazib ber" — Sotuv bo'limining statistikasini
// (sotuv voronkasi, bosqichlar bo'yicha taqsimot) tashqi tomonga (masalan
// Meta Ads tahlil qilish uchun) FAQAT O'QISH tartibida ochib beradigan API.
// Hech qanday yozish/o'zgartirish endpointi yo'q — atayin. Xom lidlar
// ro'yxati (ism/telefon) ham qaytarilmaydi, faqat yig'ma (aggregate)
// sonlar — bu tashqi tahlil uchun yetarli va shaxsiy ma'lumotni
// keraksiz oshkor qilmaydi.
const express = require('express');
const router = express.Router();

const { getLeads, getHrEmployeesData } = require('../db');
const { publicApiKeyRequired } = require('../middleware/publicApiKey');

router.use(publicApiKeyRequired);

// js/app.js'dagi FUNNEL_STAGES/normalizeLeadStatus bilan AYNAN bir xil
// bo'lishi shart — CRM'dagi "Sotuv voronkasi" bilan mos kelishi uchun.
const FUNNEL_STAGES = [
    { id: 'yangi-lidlar', label: 'Yangi lidlar' },
    { id: 'boglanishga-urinilmoqda', label: "Bog'lanishga urinilmoqda" },
    { id: 'boglanildi', label: "Bog'lanildi" },
    { id: 'malumot-berildi', label: "Ma'lumot berildi" },
    { id: 'qaror-jarayonida', label: 'Qaror jarayonida' },
    { id: 'sinov-darsida', label: 'Sinov darsida' },
    { id: 'tolov-jarayonida', label: "To'lov jarayonida" },
    { id: 'tolov-yopildi', label: "To'lov yopildi" },
];
const EXTRA_STAGES = [
    { id: 'muvaffaqiyatsiz-sotuv', label: 'Muvaffaqiyatsiz sotuv' },
    { id: 'sifatsiz-lidlar', label: 'Sifatsiz lidlar' },
];
const ALL_STAGE_IDS = new Set([...FUNNEL_STAGES, ...EXTRA_STAGES].map(s => s.id));

function normalizeLeadStatus(status) {
    if (!status || status === 'new') return 'yangi-lidlar';
    if (status === 'organic' || status === 'target') return 'yangi-lidlar';
    return ALL_STAGE_IDS.has(status) ? status : 'yangi-lidlar';
}

function parseCsvParam(raw) {
    if (!raw) return null;
    const ids = String(raw).split(',').map(s => s.trim()).filter(Boolean);
    return ids.length ? new Set(ids) : null;
}

function isValidIsoDate(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Ikkalasi ham bo'sh bo'lsa — filtr o'chiq. Faqat biri berilsa — bitta
// kunlik filtr sifatida ishlaydi (CRM'dagi Sotuv voronkasi filtri bilan
// bir xil qoida).
function resolveDateRange(fromRaw, toRaw) {
    const from = isValidIsoDate(fromRaw) ? fromRaw : (isValidIsoDate(toRaw) ? toRaw : null);
    const to = isValidIsoDate(toRaw) ? toRaw : (isValidIsoDate(fromRaw) ? fromRaw : null);
    return from ? { from, to } : null;
}

function computeFunnel(leads, filters) {
    let filtered = leads;

    if (filters.managerIds) {
        filtered = filtered.filter(l => filters.managerIds.has(l.managerId));
    }
    if (filters.assignedRange) {
        filtered = filtered.filter(l => {
            if (!l.managerAssignedAt) return false;
            const d = String(l.managerAssignedAt).slice(0, 10);
            return d >= filters.assignedRange.from && d <= filters.assignedRange.to;
        });
    }
    if (filters.createdRange) {
        filtered = filtered.filter(l => {
            const raw = l.createdAt || l.date;
            if (!raw) return false;
            const d = new Date(raw);
            if (Number.isNaN(d.getTime())) return false;
            const createdDate = d.toISOString().slice(0, 10);
            return createdDate >= filters.createdRange.from && createdDate <= filters.createdRange.to;
        });
    }

    const total = filtered.length;
    const stageCounts = new Map();
    filtered.forEach(l => {
        const stageId = normalizeLeadStatus(l.status);
        stageCounts.set(stageId, (stageCounts.get(stageId) || 0) + 1);
    });

    const toStageData = (defs) => defs.map(s => {
        const count = stageCounts.get(s.id) || 0;
        return { id: s.id, label: s.label, count, share: total > 0 ? Math.round((count / total) * 100) : 0 };
    });

    const converted = stageCounts.get('tolov-yopildi') || 0;
    const conversionRate = total > 0 ? Math.round((converted / total) * 1000) / 10 : 0;

    return {
        total,
        conversionRate,
        stages: toStageData(FUNNEL_STAGES),
        extraStages: toStageData(EXTRA_STAGES),
    };
}

// GET /api/public/sales/funnel
// Query: lang=english|russian (bo'lmasa — ikkalasi ham qaytadi)
//        managerIds=id1,id2 (bo'sh bo'lsa — hammasi)
//        assignedFrom, assignedTo (YYYY-MM-DD, lid biriktirilgan sana)
//        createdFrom, createdTo (YYYY-MM-DD, lid CRM'ga kelib tushgan sana)
router.get('/funnel', async (req, res) => {
    try {
        const allLeads = await getLeads();
        const filters = {
            managerIds: parseCsvParam(req.query.managerIds),
            assignedRange: resolveDateRange(req.query.assignedFrom, req.query.assignedTo),
            createdRange: resolveDateRange(req.query.createdFrom, req.query.createdTo),
        };

        const langParam = req.query.lang === 'russian' || req.query.lang === 'english' ? req.query.lang : null;
        const languages = {};
        if (!langParam || langParam === 'english') languages.english = computeFunnel(allLeads.english || [], filters);
        if (!langParam || langParam === 'russian') languages.russian = computeFunnel(allLeads.russian || [], filters);

        res.json({
            generatedAt: new Date().toISOString(),
            filters: {
                lang: langParam || 'all',
                managerIds: filters.managerIds ? [...filters.managerIds] : null,
                assignedRange: filters.assignedRange,
                createdRange: filters.createdRange,
            },
            languages,
        });
    } catch (err) {
        console.error('GET /api/public/sales/funnel', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

// GET /api/public/sales/managers — filtr uchun menejerlar ro'yxati (id+ism,
// tashqi tomon managerIds parametrini to'g'ri qurishi uchun).
router.get('/managers', async (req, res) => {
    try {
        const employees = await getHrEmployeesData();
        const managers = employees
            .filter(e => e.role === 'Sotuv menejeri' || e.role === 'sotuv-menejeri' || e.role === 'sotuv_menejeri')
            .map(e => ({ id: e.id, name: e.name, lang: e.lang || 'english', status: e.status || 'active' }));
        res.json({ managers });
    } catch (err) {
        console.error('GET /api/public/sales/managers', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

module.exports = router;
