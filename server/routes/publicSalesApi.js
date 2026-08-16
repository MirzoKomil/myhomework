// "platformaga API chiqazib ber" — Sotuv bo'limining statistikasi
// (sotuv voronkasi) VA lidlar ro'yxatini tashqi tomonga (masalan Meta Ads
// tahlil qilish uchun) FAQAT O'QISH tartibida ochib beradigan API. Hech
// qanday yozish/o'zgartirish endpointi yo'q — atayin. Lidning ismi/telefoni
// (4-vazifa) foydalanuvchining aniq so'rovi bilan qaytariladi — izohlar
// (comments) va biriktirilgan fayllar esa hamon chiqarilmaydi (ichki
// muzokara tafsilotlari, tashqi tahlil uchun zarur emas).
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

// /funnel va /leads ikkalasi ham BIR XIL filtr qoidalaridan foydalanadi —
// CRM'dagi "Sotuv voronkasi"da o'rnatilgan filtr shu yerda ham aynan bir
// xil natija berishi shart.
function applyLeadFilters(leads, filters) {
    let filtered = leads;
    if (filters.managerIds) {
        filtered = filtered.filter(l => filters.managerIds.has(l.managerId));
    }
    if (filters.statusIds) {
        filtered = filtered.filter(l => filters.statusIds.has(normalizeLeadStatus(l.status)));
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
    return filtered;
}

function computeFunnel(leads, filters) {
    const filtered = applyLeadFilters(leads, filters);

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

const STAGE_LABEL_BY_ID = new Map([...FUNNEL_STAGES, ...EXTRA_STAGES].map(s => [s.id, s.label]));

const LEADS_PAGE_SIZE_DEFAULT = 100;
const LEADS_PAGE_SIZE_MAX = 500;

function clampPageSize(raw) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return LEADS_PAGE_SIZE_DEFAULT;
    return Math.min(n, LEADS_PAGE_SIZE_MAX);
}

function clampPage(raw) {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 1 ? n : 1;
}

// 4-vazifa: "Lidlar" bo'limining o'zi — ism/telefon ham qaytariladi
// (foydalanuvchining aniq so'rovi bo'yicha). Izohlar/fayllar chiqarilmaydi.
// Ko'p sonli lid bo'lgani uchun sahifalab (pagination) qaytariladi.
router.get('/leads', async (req, res) => {
    try {
        const allLeads = await getLeads();
        const employees = await getHrEmployeesData();
        const managerNameById = new Map(employees.map(e => [e.id, e.name]));

        const filters = {
            managerIds: parseCsvParam(req.query.managerIds),
            statusIds: parseCsvParam(req.query.status),
            assignedRange: resolveDateRange(req.query.assignedFrom, req.query.assignedTo),
            createdRange: resolveDateRange(req.query.createdFrom, req.query.createdTo),
        };

        const langParam = req.query.lang === 'russian' || req.query.lang === 'english' ? req.query.lang : null;
        const pool = langParam === 'russian' ? (allLeads.russian || [])
            : langParam === 'english' ? (allLeads.english || [])
                : [...(allLeads.english || []), ...(allLeads.russian || [])];

        const filtered = applyLeadFilters(pool, filters);
        const total = filtered.length;
        const pageSize = clampPageSize(req.query.pageSize);
        const page = clampPage(req.query.page);
        const start = (page - 1) * pageSize;
        const pageItems = filtered.slice(start, start + pageSize);

        const leads = pageItems.map(l => {
            const statusId = normalizeLeadStatus(l.status);
            return {
                id: l.id,
                name: l.name || '',
                phone: l.phone || '',
                phone2: l.phone2 || '',
                email: l.email || '',
                language: l.language,
                status: statusId,
                statusLabel: STAGE_LABEL_BY_ID.get(statusId) || statusId,
                source: l.source || '',
                leadType: l.leadType || '',
                managerId: l.managerId || null,
                managerName: l.managerId ? (managerNameById.get(l.managerId) || null) : null,
                date: l.date || null,
                createdAt: l.createdAt || null,
                managerAssignedAt: l.managerAssignedAt || null,
            };
        });

        res.json({
            generatedAt: new Date().toISOString(),
            filters: {
                lang: langParam || 'all',
                managerIds: filters.managerIds ? [...filters.managerIds] : null,
                status: filters.statusIds ? [...filters.statusIds] : null,
                assignedRange: filters.assignedRange,
                createdRange: filters.createdRange,
            },
            total,
            page,
            pageSize,
            pageCount: Math.max(1, Math.ceil(total / pageSize)),
            leads,
        });
    } catch (err) {
        console.error('GET /api/public/sales/leads', err);
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
