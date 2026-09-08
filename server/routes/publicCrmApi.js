// CRM'ning BARCHA bo'limlarini (va har bir bo'limning barcha ustunlarini)
// tashqi tomonga FAQAT O'QISH tartibida ochib beradigan API.
// /api/public/sales/* ning kengaytmasi: u faqat Sotuv voronkasini bergan
// edi, bu esa qolgan hamma narsani — O'quvchilar, Dars jadvali, Davomat,
// Moliya, HR, Marketing, Analitika — bitta bir xil shaklda beradi.
//
// Hech qanday yozish/o'zgartirish endpointi YO'Q — atayin.
//
// ── Javob shakli ────────────────────────────────────────────────────────────
// Har bir bo'lim bir xil "jadval" ko'rinishida qaytadi:
//     { section, label, crmPath, total, page, pageSize, pageCount,
//       columns: [{ name, type, label }], rows: [ {...}, ... ] }
// Shu sabab tashqi tomon bitta universal parser yozib, barcha bo'limni
// o'qiy oladi — har biriga alohida kod kerak emas.
//
// ── MAXFIY MA'LUMOT (foydalanuvchi qaroriga ko'ra CHIQARILMAYDI) ────────────
// Quyidagilar javobga UMUMAN qo'shilmaydi (pastdagi HIDDEN_FIELDS):
//   • hr_employees: passportSeries, pinfl, cardNumber, address, birthDate,
//     phone, email, login, avatar
//   • students / teachers: phone (shaxsiy telefon)
//   • book_roadmap: phone va address (mijozning uy manzili)
//   • cash_flow: "Oylik (xodim maoshi)" turidagi tranzaksiyalarda
//     employeeId va person — ya'ni "falonchi shuncha maosh oldi" bog'lanishi.
//     Summaning o'zi qoladi (kompaniyaning umumiy chiqimi sifatida), lekin
//     u endi konkret xodimga ulanmaydi.
// Kerak bo'lsa HIDDEN_FIELDS'dagi bitta ro'yxatni o'zgartirish kifoya —
// boshqa hech qayerga tegish shart emas.
//
// Butunlay ochilmaydigan guruhlar (EXCLUDED_GROUPS): o'quvchilarning shaxsiy
// yozishmalari va faoliyat jurnali — bular hisobot uchun emas, shaxsiy.
const express = require('express');
const router = express.Router();

const { pool } = require('../db');
const { publicCrmApiKeyRequired } = require('../middleware/publicApiKey');
const { normalizeLeadStatus, STAGE_LABEL_BY_ID } = require('../services/leadStages');

router.use(publicCrmApiKeyRequired);

// ── Maxfiylik ────────────────────────────────────────────────────────────────

const HIDDEN_FIELDS = {
    teachers: ['phone'],
    students: ['phone'],
    'hr-employees': ['phone', 'email', 'login', 'avatar', 'birthDate',
        'cardNumber', 'passportSeries', 'pinfl', 'address'],
    'book-roadmap': ['phone', 'address'],
};

const CASH_FLOW_SALARY_PURPOSE = 'Oylik (xodim maoshi)';

const EXCLUDED_GROUPS = [
    { key: 'studentMessages', reason: "O'quvchi ↔ ustoz shaxsiy yozishmalari" },
    { key: 'peerMessages', reason: "O'quvchilarning o'zaro shaxsiy yozishmalari" },
    { key: 'studentActivity', reason: "O'quvchining ilovadagi shaxsiy faoliyat jurnali" },
];

function stripHidden(sectionId, row) {
    const hidden = HIDDEN_FIELDS[sectionId];
    if (!hidden || !row || typeof row !== 'object') return row;
    const out = { ...row };
    hidden.forEach(f => { delete out[f]; });
    return out;
}

// ── Umumiy yordamchilar ──────────────────────────────────────────────────────

const PAGE_SIZE_DEFAULT = 100;
const PAGE_SIZE_MAX = 500;

function clampPageSize(raw) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return PAGE_SIZE_DEFAULT;
    return Math.min(n, PAGE_SIZE_MAX);
}

function clampPage(raw) {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 1 ? n : 1;
}

function isValidIsoDate(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// /api/public/sales bilan bir xil qoida: faqat biri berilsa — bitta kunlik filtr.
function resolveDateRange(fromRaw, toRaw) {
    const from = isValidIsoDate(fromRaw) ? fromRaw : (isValidIsoDate(toRaw) ? toRaw : null);
    const to = isValidIsoDate(toRaw) ? toRaw : (isValidIsoDate(fromRaw) ? fromRaw : null);
    return from ? { from, to } : null;
}

function parseCsvParam(raw) {
    if (!raw) return null;
    const ids = String(raw).split(',').map(s => s.trim()).filter(Boolean);
    return ids.length ? new Set(ids) : null;
}

function jsType(v) {
    if (v === null || v === undefined) return 'null';
    if (Array.isArray(v)) return 'array';
    if (typeof v === 'object') return 'object';
    return typeof v;   // string | number | boolean
}

// JSON bo'limlarining ustunlari oldindan qat'iy emas (CRM ularni erkin
// shaklda saqlaydi) — shuning uchun ustunlar ro'yxati haqiqiy ma'lumotdan
// chiqariladi: barcha qatorlardagi kalitlar birlashmasi.
function deriveColumns(rows) {
    const seen = new Map();
    for (const row of rows.slice(0, PAGE_SIZE_MAX)) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
        for (const [k, v] of Object.entries(row)) {
            const t = jsType(v);
            if (!seen.has(k)) seen.set(k, t);
            else if (seen.get(k) === 'null' && t !== 'null') seen.set(k, t);
        }
    }
    return [...seen.entries()].map(([name, type]) => ({ name, type, label: name }));
}

// json_data'dagi qiymat massiv bo'lmasligi ham mumkin (obyekt — masalan
// bonusData bonus id bo'yicha, targetMonitoringPlan oy bo'yicha kalitlangan).
// Ikkalasini ham bir xil "qatorlar" ko'rinishiga keltiramiz.
function normalizeToRows(data) {
    if (Array.isArray(data)) return data.filter(r => r && typeof r === 'object');
    if (data && typeof data === 'object') {
        return Object.entries(data).map(([key, value]) => (
            value && typeof value === 'object' && !Array.isArray(value)
                ? { key, ...value }
                : { key, value }
        ));
    }
    return [];
}

async function loadJsonGroup(key) {
    const { rows } = await pool.query('SELECT data FROM json_data WHERE key = $1', [key]);
    return normalizeToRows(rows[0]?.data);
}

async function sqlRows(text, params = []) {
    const { rows } = await pool.query(text, params);
    return rows;
}

// ── Bo'limlar ro'yxati ───────────────────────────────────────────────────────
// `columns` berilgan bo'lsa — qat'iy sxema (SQL jadvallari). Berilmasa
// (null) — ma'lumotdan chiqariladi (json_data guruhlari).
// `dateField` / `langField` — ?from/?to va ?lang filtrlari qaysi maydonga
// tegishli ekanini bildiradi; yo'q bo'lsa o'sha filtr shunchaki e'tiborsiz.

function col(name, type, label) { return { name, type, label: label || name }; }

const SECTIONS = [
    // ── Akademik bo'lim ─────────────────────────────────────────────────────
    {
        id: 'teachers',
        label: 'Ustozlar',
        crmPath: "Akademik bo'lim",
        source: 'teachers',
        langField: 'subject',
        columns: [
            col('id', 'string', 'ID'), col('name', 'string', 'Ism'),
            col('type', 'string', 'Turi (asosiy/yordamchi)'),
            col('subject', 'string', 'Kurs tili'),
            col('schedulePattern', 'string', 'Dars kunlari'),
            col('lessonDuration', 'number', 'Dars davomiyligi (daq.)'),
        ],
        load: async () => (await sqlRows('SELECT * FROM teachers ORDER BY name')).map(r => ({
            id: r.id, name: r.name, type: r.type, subject: r.subject,
            schedulePattern: r.schedule_pattern, lessonDuration: r.lesson_duration,
        })),
    },
    {
        id: 'students',
        label: "O'quvchilar",
        crmPath: "O'quvchilar",
        source: 'students',
        langField: 'subject',
        columns: [
            col('id', 'string', 'ID'), col('name', 'string', 'Ism'),
            col('group', 'string', 'Guruh'), col('subject', 'string', 'Kurs tili'),
            col('teacherId', 'string', 'Asosiy ustoz'),
            col('assistantTeacherId', 'string', 'Yordamchi ustoz'),
            col('lessonDayOfWeek', 'number', 'Dars kuni (0-6)'),
            col('lessonTime', 'string', 'Dars vaqti'),
            col('lessonDuration', 'number', 'Dars davomiyligi (daq.)'),
        ],
        load: async () => (await sqlRows('SELECT * FROM students ORDER BY name')).map(r => ({
            id: r.id, name: r.name, group: r.group_name || '', subject: r.subject,
            teacherId: r.teacher_id || null, assistantTeacherId: r.assistant_teacher_id || null,
            lessonDayOfWeek: r.lesson_day_of_week != null ? r.lesson_day_of_week : null,
            lessonTime: r.lesson_time || '', lessonDuration: r.lesson_duration || 15,
        })),
    },
    {
        id: 'timetable',
        label: 'Dars jadvali',
        crmPath: 'Dars jadvali',
        source: 'timetable',
        dateField: 'date',
        columns: [
            col('slotKey', 'string', 'Slot kaliti'), col('date', 'string', 'Sana'),
            col('time', 'string', 'Vaqt'), col('viewKey', 'string', "Ko'rinish"),
            col('teacherId', 'string', 'Ustoz'),
            col('salesManagerId', 'string', 'Sotuv menejeri'),
            col('studentId', 'string', "O'quvchi"),
            col('completed', 'boolean', "O'tkazilgan"),
        ],
        load: async () => (await sqlRows('SELECT * FROM timetable ORDER BY date, time')).map(r => ({
            slotKey: r.slot_key, date: r.date || '', time: r.time || '',
            viewKey: r.view_key || '', teacherId: r.teacher_id || '',
            salesManagerId: r.sales_manager_id || '', studentId: r.student_id || '',
            completed: !!r.completed,
        })),
    },
    {
        id: 'attendance-main',
        label: 'Davomat — asosiy ustoz',
        crmPath: "Akademik bo'lim → Davomat",
        source: 'main_attendance',
        columns: [
            col('attKey', 'string', 'Davomat kaliti'),
            col('studentId', 'string', "O'quvchi"),
            col('day', 'number', 'Kun'), col('present', 'boolean', 'Kelgan'),
        ],
        load: async () => (await sqlRows(
            'SELECT att_key, student_id, day, present FROM main_attendance ORDER BY att_key, student_id, day'
        )).map(r => ({ attKey: r.att_key, studentId: r.student_id, day: r.day, present: !!r.present })),
    },
    {
        id: 'attendance-assistant',
        label: 'Davomat — yordamchi ustoz',
        crmPath: "Akademik bo'lim → Davomat",
        source: 'assistant_attendance',
        columns: [
            col('attKey', 'string', 'Davomat kaliti'),
            col('studentId', 'string', "O'quvchi"),
            col('day', 'number', 'Kun'), col('present', 'boolean', 'Kelgan'),
        ],
        load: async () => (await sqlRows(
            'SELECT att_key, student_id, day, present FROM assistant_attendance ORDER BY att_key, student_id, day'
        )).map(r => ({ attKey: r.att_key, studentId: r.student_id, day: r.day, present: !!r.present })),
    },
    {
        id: 'live-grades',
        label: 'Baholar (jonli)',
        crmPath: "Akademik bo'lim → Reyting",
        source: 'json_data:liveGrades',
        columns: null,
        load: () => loadJsonGroup('liveGrades'),
    },

    // ── Sotuv bo'limi ───────────────────────────────────────────────────────
    {
        id: 'sales-managers',
        label: 'Sotuv menejerlari',
        crmPath: "Sotuv bo'limi",
        source: 'sales_managers',
        columns: [col('id', 'string', 'ID'), col('name', 'string', 'Ism')],
        load: async () => (await sqlRows('SELECT id, name FROM sales_managers ORDER BY name'))
            .map(r => ({ id: r.id, name: r.name })),
    },
    {
        id: 'leads',
        label: 'Lidlar',
        crmPath: "Sotuv bo'limi → Lidlar",
        source: 'leads',
        dateField: 'date',
        langField: 'language',
        columns: [
            col('id', 'string', 'ID'), col('name', 'string', 'Ism'),
            col('phone', 'string', 'Telefon'), col('phone2', 'string', "Qo'shimcha telefon"),
            col('email', 'string', 'Email'), col('language', 'string', 'Kurs tili'),
            col('status', 'string', 'Bosqich (id)'), col('statusLabel', 'string', 'Bosqich'),
            col('source', 'string', 'Manba'), col('leadType', 'string', 'Turi'),
            col('managerId', 'string', 'Menejer'), col('date', 'string', 'Sana'),
            col('externalId', 'string', 'Tashqi ID'),
            col('createdAt', 'string', 'Yaratilgan'), col('updatedAt', 'string', "O'zgartirilgan"),
        ],
        load: async () => (await sqlRows(
            'SELECT * FROM leads WHERE deleted_at IS NULL ORDER BY created_at DESC, date DESC'
        )).map(r => {
            const status = normalizeLeadStatus(r.status);
            return {
                id: r.id, name: r.name, phone: r.phone || '', phone2: r.phone2 || '',
                email: r.email || '',
                language: r.language === 'russian' ? 'russian' : 'english',
                status, statusLabel: STAGE_LABEL_BY_ID.get(status) || status,
                source: r.source || 'Organik', leadType: r.lead_type || 'organic',
                managerId: r.manager_id || '', date: r.date || '',
                externalId: r.external_id || null,
                createdAt: r.created_at || null, updatedAt: r.updated_at || null,
            };
        }),
    },
    {
        id: 'book-roadmap',
        label: 'Kitob yetkazish',
        crmPath: "Sotuv bo'limi → Kitob yetkazish",
        source: 'book_roadmap',
        dateField: 'date',
        langField: 'lang',
        columns: [
            col('id', 'string', 'ID'), col('name', 'string', 'Ism'),
            col('studentId', 'string', "O'quvchi"), col('region', 'string', 'Hudud'),
            col('managerId', 'string', 'Menejer'), col('kind', 'string', 'Turi'),
            col('status', 'string', 'Bosqich'), col('date', 'string', 'Sana'),
            col('lang', 'string', 'Kurs tili'),
            col('dispatchedAt', 'string', "Jo'natilgan"),
            col('deliveredAt', 'string', 'Yetkazilgan'),
            col('createdAt', 'string', 'Yaratilgan'),
        ],
        load: async () => (await sqlRows('SELECT * FROM book_roadmap ORDER BY created_at DESC')).map(r => ({
            id: r.id, name: r.name, studentId: r.student_id || '',
            region: r.region || '', managerId: r.manager_id || '',
            kind: r.kind || 'organik', status: r.status || 'yangi-oquvchi',
            date: r.date || '', lang: r.lang || 'english',
            dispatchedAt: r.dispatched_at || '', deliveredAt: r.delivered_at || '',
            createdAt: r.created_at || null,
        })),
    },
    {
        id: 'scripts',
        label: 'Skriptlar',
        crmPath: "Sotuv bo'limi → Skriptlar",
        source: 'json_data:scripts',
        columns: null,
        load: () => loadJsonGroup('scripts'),
    },
    {
        id: 'sales-plan',
        label: 'Sotuv rejasi (jamoaviy)',
        crmPath: "Sotuv bo'limi → Sotuv rejasi",
        source: 'json_data:salesPlan',
        columns: null,
        load: () => loadJsonGroup('salesPlan'),
    },
    {
        id: 'individual-sales-plans',
        label: 'Sotuv rejasi (individual)',
        crmPath: "Sotuv bo'limi → Sotuv rejasi",
        source: 'json_data:individualSalesPlans',
        columns: null,
        load: () => loadJsonGroup('individualSalesPlans'),
    },
    {
        id: 'bonus-history',
        label: 'Berilgan bonuslar tarixi',
        crmPath: "Sotuv bo'limi → Reyting",
        source: 'json_data:bonusHistory',
        dateField: 'date',
        columns: null,
        load: () => loadJsonGroup('bonusHistory'),
    },
    {
        id: 'bonus-data',
        label: "Bonus ta'riflari",
        crmPath: "Sotuv bo'limi → Reyting",
        source: 'json_data:bonusData',
        columns: null,
        load: () => loadJsonGroup('bonusData'),
    },

    // ── Marketing bo'limi ───────────────────────────────────────────────────
    {
        id: 'target-monitoring-plan',
        label: 'Target monitoringi rejasi',
        crmPath: "Marketing bo'limi → Target Monitoringi",
        source: 'json_data:targetMonitoringPlan',
        columns: null,
        load: () => loadJsonGroup('targetMonitoringPlan'),
    },
    {
        id: 'target-daily-ad-spend',
        label: 'Kunlik reklama xarajati',
        crmPath: "Marketing bo'limi → Target Monitoringi",
        source: 'json_data:targetDailyAdSpend',
        columns: null,
        load: () => loadJsonGroup('targetDailyAdSpend'),
    },

    // ── Moliya bo'limi ──────────────────────────────────────────────────────
    {
        id: 'payments',
        label: "To'lovlar",
        crmPath: "Moliya → To'lovlar",
        source: 'payments',
        dateField: 'date',
        columns: [
            col('id', 'string', 'ID'), col('studentId', 'string', "O'quvchi"),
            col('platform', 'number', 'Platforma'), col('book', 'number', 'Kitob'),
            col('paid', 'number', "To'langan"), col('debt', 'number', 'Qarz'),
            col('date', 'string', 'Sana'),
        ],
        load: async () => (await sqlRows('SELECT * FROM payments ORDER BY date DESC')).map(r => ({
            id: r.id, studentId: r.student_id, platform: r.platform,
            book: r.book, paid: r.paid, debt: r.debt, date: r.date,
        })),
    },
    {
        id: 'cash-flow',
        label: 'Cash Flow',
        crmPath: 'Moliya → Cash Flow',
        source: 'json_data:cashFlow',
        dateField: 'date',
        columns: null,
        // Maosh tranzaksiyalarida xodim bog'lanishi olib tashlanadi (fayl
        // boshidagi izohga qarang) — summa qoladi, "kim" qismi ketadi.
        load: async () => (await loadJsonGroup('cashFlow')).map(t => {
            if (t?.purpose !== CASH_FLOW_SALARY_PURPOSE) return t;
            const { employeeId, person, ...rest } = t;
            return { ...rest, employeeId: null, person: '', salaryRecipientHidden: true };
        }),
    },
    {
        id: 'manual-metrics',
        label: "Qo'lda kiritilgan ko'rsatkichlar",
        crmPath: 'Analitika → Xodimlar analitikasi',
        source: 'json_data:manualMetrics',
        dateField: 'date',
        columns: null,
        load: () => loadJsonGroup('manualMetrics'),
    },

    // ── HR bo'limi ──────────────────────────────────────────────────────────
    {
        id: 'hr-employees',
        label: 'Xodimlar',
        crmPath: 'HR → Xodimlar',
        source: 'hr_employees',
        langField: 'lang',
        columns: [
            col('id', 'string', 'ID'), col('name', 'string', "To'liq ism"),
            col('firstName', 'string', 'Ism'), col('lastName', 'string', 'Familiya'),
            col('role', 'string', 'Lavozim'), col('department', 'string', "Bo'lim"),
            col('status', 'string', 'Holati'), col('joinDate', 'string', 'Qabul sanasi'),
            col('startDate', 'string', 'Ish boshlagan sana'),
            col('gender', 'string', 'Jinsi'), col('lang', 'string', 'Kurs tili'),
        ],
        load: async () => (await sqlRows('SELECT * FROM hr_employees ORDER BY name')).map(r => ({
            id: r.id, name: r.name, firstName: r.first_name || '', lastName: r.last_name || '',
            role: r.role, department: r.department || '', status: r.status || 'active',
            joinDate: r.join_date || '', startDate: r.start_date || '',
            gender: r.gender || '', lang: r.lang || 'english',
        })),
    },
    {
        id: 'org-chart',
        label: 'Org struktura',
        crmPath: 'HR → Org Struktura',
        source: 'json_data:orgChart',
        columns: null,
        load: () => loadJsonGroup('orgChart'),
    },
    {
        id: 'guides',
        label: "Yo'riqnomalar",
        crmPath: "Yo'riqnomalar",
        source: 'json_data:guides',
        columns: null,
        load: () => loadJsonGroup('guides'),
    },

    // ── Mobil ilova ─────────────────────────────────────────────────────────
    {
        id: 'shop-orders',
        label: "Do'kon buyurtmalari",
        crmPath: "Mobil ilova → Do'kon",
        source: 'json_data:shopOrders',
        columns: null,
        load: () => loadJsonGroup('shopOrders'),
    },
    {
        id: 'mobile-content',
        label: 'Mobil ilova kontenti',
        crmPath: 'Mobil ilova → Tahrirlash',
        source: 'mobile_content',
        columns: [
            col('group', 'string', 'Kontent guruhi'),
            col('count', 'number', 'Elementlar soni'),
        ],
        // To'liq kontent juda katta (megabaytlar) — bu yerda faqat guruhlar
        // va ularning hajmi qaytariladi. To'liq nusxa CRM'ning o'z
        // /api/state/mobile-content endpointida.
        load: async () => {
            const { rows } = await pool.query('SELECT data FROM mobile_content WHERE singleton = 1');
            const data = rows[0]?.data || {};
            return Object.entries(data).map(([group, value]) => ({
                group,
                count: Array.isArray(value) ? value.length
                    : (value && typeof value === 'object' ? Object.keys(value).length : 1),
            }));
        },
    },

    // ── Sozlamalar ──────────────────────────────────────────────────────────
    {
        id: 'archive',
        label: 'Arxiv',
        crmPath: 'Sozlamalar → Arxiv',
        source: 'json_data:archive',
        columns: null,
        load: () => loadJsonGroup('archive'),
    },
];

const SECTION_BY_ID = new Map(SECTIONS.map(s => [s.id, s]));

// ── Filtrlash ────────────────────────────────────────────────────────────────

function applyFilters(section, rows, query) {
    let out = rows;

    if (section.langField) {
        const lang = query.lang === 'russian' || query.lang === 'english' ? query.lang : null;
        if (lang) out = out.filter(r => (r[section.langField] || 'english') === lang);
    }

    if (section.dateField) {
        const range = resolveDateRange(query.from, query.to);
        if (range) {
            out = out.filter(r => {
                const raw = r[section.dateField];
                if (!raw) return false;
                const d = String(raw).slice(0, 10);
                if (!isValidIsoDate(d)) return false;
                return d >= range.from && d <= range.to;
            });
        }
    }

    const ids = parseCsvParam(query.ids);
    if (ids) out = out.filter(r => ids.has(String(r.id)));

    return out;
}

// ?fields=a,b,c — faqat kerakli ustunlarni qaytarish.
function projectFields(rows, columns, fieldsRaw) {
    const wanted = parseCsvParam(fieldsRaw);
    if (!wanted) return { rows, columns };
    const keep = columns.filter(c => wanted.has(c.name));
    if (!keep.length) return { rows, columns };
    const keepNames = keep.map(c => c.name);
    return {
        columns: keep,
        rows: rows.map(r => {
            const o = {};
            keepNames.forEach(n => { o[n] = r[n]; });
            return o;
        }),
    };
}

// ── Endpointlar ──────────────────────────────────────────────────────────────

// GET /api/public/crm/sections
// Barcha bo'limlar va ularning ustunlari — "katalog". Tashqi tomon avval
// shuni o'qib, keyin kerakli bo'limni so'raydi.
// ?counts=1 bo'lsa har bir bo'limdagi qatorlar soni ham hisoblanadi
// (sekinroq — hamma bo'lim yuklanadi).
router.get('/sections', async (req, res) => {
    try {
        const wantCounts = req.query.counts === '1' || req.query.counts === 'true';

        const sections = await Promise.all(SECTIONS.map(async s => {
            const base = {
                id: s.id,
                label: s.label,
                crmPath: s.crmPath,
                source: s.source,
                path: `/api/public/crm/${s.id}`,
                filters: {
                    lang: !!s.langField,
                    dateRange: s.dateField ? s.dateField : null,
                    ids: true,
                },
                hiddenFields: HIDDEN_FIELDS[s.id] || [],
            };
            if (!wantCounts && s.columns) {
                return {
                    ...base, columns: s.columns, columnCount: s.columns.length,
                    columnsSource: 'fixed',
                };
            }
            // Ustunlar dinamik bo'lsa (yoki soni so'ralgan bo'lsa) — yuklaymiz.
            const rows = (await s.load()).map(r => stripHidden(s.id, r));
            const columns = s.columns || deriveColumns(rows);
            return {
                ...base,
                columns,
                columnCount: columns.length,
                // 'fixed' — SQL jadvali, ustunlar doim bir xil.
                // 'derived' — json_data guruhi, ustunlar HAQIQIY ma'lumotdan
                // chiqariladi. Guruh hali bo'sh bo'lsa columns ham bo'sh
                // bo'ladi — bu xato emas, shunchaki hali yozuv yo'q.
                columnsSource: s.columns ? 'fixed' : 'derived',
                ...(wantCounts ? { rowCount: rows.length } : {}),
            };
        }));

        res.json({
            generatedAt: new Date().toISOString(),
            sectionCount: sections.length,
            sections,
            excludedGroups: EXCLUDED_GROUPS,
            notes: [
                "Faqat o'qish (read-only) — hech qanday yozish endpointi yo'q.",
                "Har bir bo'lim: GET /api/public/crm/<id>?page=1&pageSize=100",
                'Umumiy filtrlar: ?lang=english|russian, ?from=YYYY-MM-DD&to=YYYY-MM-DD, ?ids=a,b, ?fields=a,b',
                'hiddenFields — maxfiylik sababli javobdan chiqarilgan ustunlar.',
            ],
        });
    } catch (err) {
        console.error('GET /api/public/crm/sections', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

// GET /api/public/crm/:section — bitta bo'limning ustunlari va qatorlari.
router.get('/:section', async (req, res) => {
    const section = SECTION_BY_ID.get(req.params.section);
    if (!section) {
        return res.status(404).json({
            error: "Bunday bo'lim yo'q",
            available: SECTIONS.map(s => s.id),
        });
    }

    try {
        const all = (await section.load()).map(r => stripHidden(section.id, r));
        const filtered = applyFilters(section, all, req.query);

        const total = filtered.length;
        const pageSize = clampPageSize(req.query.pageSize);
        const page = clampPage(req.query.page);
        const start = (page - 1) * pageSize;
        const pageItems = filtered.slice(start, start + pageSize);

        const baseColumns = section.columns || deriveColumns(all);
        const { rows, columns } = projectFields(pageItems, baseColumns, req.query.fields);

        res.json({
            generatedAt: new Date().toISOString(),
            section: section.id,
            label: section.label,
            crmPath: section.crmPath,
            source: section.source,
            columnsSource: section.columns ? 'fixed' : 'derived',
            hiddenFields: HIDDEN_FIELDS[section.id] || [],
            filters: {
                lang: section.langField && (req.query.lang === 'russian' || req.query.lang === 'english')
                    ? req.query.lang : 'all',
                dateRange: section.dateField ? resolveDateRange(req.query.from, req.query.to) : null,
                ids: req.query.ids ? String(req.query.ids).split(',').map(s => s.trim()).filter(Boolean) : null,
            },
            total,
            page,
            pageSize,
            pageCount: Math.max(1, Math.ceil(total / pageSize)),
            columns,
            rows,
        });
    } catch (err) {
        console.error(`GET /api/public/crm/${req.params.section}`, err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

module.exports = router;
