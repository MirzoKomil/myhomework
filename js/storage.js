// Myhomework.uz — ma'lumotlar (API + cache)

const STORAGE_KEYS = {
    payrollRates: 'mh_payroll_rates',
    users: 'mh_users',
    currentUser: 'mh_currentUser',
    teachers: 'mh_teachers',
    salesManagers: 'mh_salesManagers',
    students: 'mh_students',
    timetable: 'mh_timetable',
    mainAttendance: 'mh_mainAttendance',
    assistantAttendance: 'mh_assistantAttendance',
    salary: 'mh_salary',
    payments: 'mh_payments',
    leads: 'mh_leads',
    salesLeadStats: 'mh_sales_lead_stats',
    hrEmployees: 'mh_hr_employees',
    bookRoadmap: 'mh_book_roadmap',
    mobileContent: 'mh_mobile_content',
    scripts: 'mh_scripts',
    bonusHistory: 'mh_bonus_history',
    bonusData: 'mh_bonus_data',
    salesPlan: 'mh_sales_plan',
    cashFlow: 'mh_cash_flow',
    orgChart: 'mh_org_chart',
    manualMetrics: 'mh_manual_metrics',
    liveGrades: 'mh_live_grades',
    demoStudentId: 'mh_demo_student_id',
    studentMessages: 'mh_student_messages',
    peerMessages: 'mh_peer_messages',
    studentActivity: 'mh_student_activity',
    shopOrders: 'mh_shop_orders',
    guides: 'mh_guides',
    individualSalesPlans: 'mh_individual_sales_plans',
    targetMonitoringPlan: 'mh_target_monitoring_plan',
    targetDailyAdSpend: 'mh_target_daily_ad_spend',
    archive: 'mh_archive',
    // Ustoz almashgan (o'tgan) o'quvchilar — faqat ustoz kabinetida, o'z davri Davomat/Reyting hisobi uchun (server stateForTeacher).
    pastStudents: 'mh_past_students'
};

const CACHE_KEY_MAP = {
    [STORAGE_KEYS.payrollRates]: 'payrollRates',
    [STORAGE_KEYS.teachers]: 'teachers',
    [STORAGE_KEYS.salesManagers]: 'salesManagers',
    [STORAGE_KEYS.students]: 'students',
    [STORAGE_KEYS.timetable]: 'timetable',
    [STORAGE_KEYS.mainAttendance]: 'mainAttendance',
    [STORAGE_KEYS.assistantAttendance]: 'assistantAttendance',
    [STORAGE_KEYS.payments]: 'payments',
    [STORAGE_KEYS.leads]: 'leads',
    [STORAGE_KEYS.salesLeadStats]: 'salesLeadStats',
    [STORAGE_KEYS.hrEmployees]: 'hrEmployees',
    [STORAGE_KEYS.bookRoadmap]: 'bookRoadmap',
    [STORAGE_KEYS.mobileContent]: 'mobileContent',
    [STORAGE_KEYS.scripts]: 'scripts',
    [STORAGE_KEYS.bonusHistory]: 'bonusHistory',
    [STORAGE_KEYS.bonusData]: 'bonusData',
    [STORAGE_KEYS.salesPlan]: 'salesPlan',
    [STORAGE_KEYS.cashFlow]: 'cashFlow',
    [STORAGE_KEYS.orgChart]: 'orgChart',
    [STORAGE_KEYS.manualMetrics]: 'manualMetrics',
    [STORAGE_KEYS.liveGrades]: 'liveGrades',
    [STORAGE_KEYS.demoStudentId]: 'demoStudentId',
    [STORAGE_KEYS.studentMessages]: 'studentMessages',
    [STORAGE_KEYS.peerMessages]: 'peerMessages',
    [STORAGE_KEYS.studentActivity]: 'studentActivity',
    [STORAGE_KEYS.shopOrders]: 'shopOrders',
    [STORAGE_KEYS.guides]: 'guides',
    [STORAGE_KEYS.individualSalesPlans]: 'individualSalesPlans',
    [STORAGE_KEYS.targetMonitoringPlan]: 'targetMonitoringPlan',
    [STORAGE_KEYS.targetDailyAdSpend]: 'targetDailyAdSpend',
    [STORAGE_KEYS.archive]: 'archive',
    [STORAGE_KEYS.pastStudents]: 'pastStudents'
};

const PATCH_KEY_MAP = Object.fromEntries(
    Object.entries(CACHE_KEY_MAP).map(([k, v]) => [v, k])
);

let _cache = {};
let _apiReady = false;

const SALARY_RATES = {
    60: 300000,
    30: 150000,
    15: 75000
};

const DAYS_UZ = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];

const SCHEDULE_PATTERNS = {
    mwf: { label: 'Dushanba, Chorshanba, Juma', days: [1, 3, 5] },
    tts: { label: 'Seshanba, Payshanba, Shanba', days: [2, 4, 6] }
};

const SUBJECTS = {
    english: { label: 'Ingliz tili', flag: '🇬🇧' },
    russian: { label: 'Rus tili', flag: '🇷🇺' }
};

function getItem(key, fallback) {
    if (key === STORAGE_KEYS.salesManagers) {
        const hremps = getItem(STORAGE_KEYS.hrEmployees, []);
        const merged = hremps.filter(e =>
            e.role === 'Sotuv menejeri' ||
            e.role === 'sotuv_menejeri' ||
            e.role === 'sotuv-menejeri'
        );
        return merged.length > 0 ? merged : fallback || [];
    }

    const cacheKey = CACHE_KEY_MAP[key];
    if (cacheKey && _cache[cacheKey] !== undefined) {
        // Buzilgan lidlar keshini hech qachon qaytarmaymiz — aks holda uni
        // o'qib-o'zgartirib-yozadigan kod bazadagi lidlarni yo'q qilardi.
        if (key === STORAGE_KEYS.leads && !isValidLeadsShape(_cache[cacheKey])) {
            console.error('[storage] Lidlar keshi buzilgan — saqlash bloklanadi');
            return fallback;
        }
        return _cache[cacheKey];
    }
    if (key === STORAGE_KEYS.currentUser) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }
    return fallback;
}

const SNAPSHOT_TABLE_KEYS = new Set(['students', 'hrEmployees', 'teachers', 'bookRoadmap']);

function setItem(key, value) {
    const cacheKey = CACHE_KEY_MAP[key];
    if (cacheKey) {
        const removedStudentIds = key === STORAGE_KEYS.students && Array.isArray(value)
            ? (_cache.students || []).filter(s => !value.some(next => next.id === s.id)).map(s => s.id) : [];
        // Server faqat SHU yerda aniq o'chirilgan qatorlarni o'chiradi. Ro'yxatda
        // ko'rinmagan boshqa qatorlar (boshqa oynada qo'shilgan yoki arxivdan
        // tiklangan) eski tab tufayli o'chib ketmaydi.
        // Faqat shu yerda holati (Active/Inactive) o'zgargan xodimlar — server boshqa
        // qatorlarning holatini eski keshdan qayta yozmaydi.
        const changedStatusIds = cacheKey === 'hrEmployees' && Array.isArray(value) && Array.isArray(_cache.hrEmployees)
            ? value.filter(n => { const o = _cache.hrEmployees.find(x => x && n && x.id === n.id); return o && String(o.status || 'active') !== String(n.status || 'active'); }).map(n => n.id) : [];
        const removedIds = SNAPSHOT_TABLE_KEYS.has(cacheKey) && Array.isArray(value) && Array.isArray(_cache[cacheKey])
            ? _cache[cacheKey].filter(old => old && old.id != null && !value.some(next => next && next.id === old.id)).map(old => old.id) : [];
        // Lidlar serverda "hammasini o'chirib, qaytadan yozish" tamoyili
        // bo'yicha saqlanadi — shu sabab noto'g'ri shakldagi qiymat butun
        // bazani yo'q qilishi mumkin. Bunday yozuvni umuman yo'ldan qaytaramiz.
        if (key === STORAGE_KEYS.leads && !isValidLeadsShape(value)) {
            console.error('[storage] Noto\'g\'ri shakldagi lidlar ro\'yxati — saqlash bekor qilindi', value);
            showSaveError('Lidlarni saqlab bo\'lmadi (ma\'lumot buzilgan). Sahifani yangilang.');
            return;
        }
        _cache[cacheKey] = value;
        // Lidlar generic /api/state snapshoti orqali yuborilmaydi. Har bir
        // lid apiSaveLead/apiDeleteLead bilan row-level saqlanadi.
        if (key === STORAGE_KEYS.leads) return;
        // Ustoz umumiy snapshotni yoza olmaydi (server 403) — davomat va boshqalar alohida endpointlar orqali.
        if (typeof getCurrentUser === 'function' && getCurrentUser()?.role === 'teacher') return;
        // Sotuv menejeri va ROP kitob yetkazishni umumiy snapshot orqali yozmaydi (server 403) — alohida yo'l:
        // sotuv faqat o'z kartochkalari, ROP faqat o'z tili; "to'lovdan oldin jo'natilmaydi" qoidasi serverda.
        if (cacheKey === 'bookRoadmap' && typeof getCurrentUser === 'function' && ['sales_manager', 'rop'].includes(getCurrentUser()?.role)) {
            if (_apiReady) return syncSalesBookRoadmap(value, removedIds);
            return;
        }
        if (_apiReady) {
            // Qaytarilgan promise — bir xil kalit (masalan "teachers") uchun
            // ketma-ket bir necha joyda saqlash chaqirilsa (initStorage
            // ichidagi migratsiyalar kabi), chaqiruvchi buni kutib, keyingi
            // yozuv avvalgisi tugagandan SO'NG yuborilishini ta'minlashi
            // mumkin — aks holda ikkita PATCH so'rovi tarmoqda bir-birini
            // "poyga" qilib, oxirgisi emas, tasodifan tezroq kelgani
            // g'olib chiqishi (eski qiymat yangisini bosib qo'yishi) mumkin
            // edi.
            return apiPatchState({ [cacheKey]: value, ...(key === STORAGE_KEYS.students ? { removedStudentIds } : {}),
                ...(SNAPSHOT_TABLE_KEYS.has(cacheKey) ? { removedIds: { [cacheKey]: removedIds } } : {}),
                ...(cacheKey === 'hrEmployees' ? { changedStatusIds: { hrEmployees: changedStatusIds } } : {}) }).catch(err => {
                console.error('Saqlash xatoligi:', err.message);
                showSaveError(err.message);
            });
        }
        return;
    }
    if (key === STORAGE_KEYS.currentUser) {
        if (value) localStorage.setItem(key, JSON.stringify(value));
        else localStorage.removeItem(key);
    }
}

// Sotuv menejeri va ROP: kitob yetkazish o'zgarishlari umumiy PATCH /api/state o'rniga (u 403 beradi va yozuv
// yo'qolardi) alohida endpointlarga yuboriladi. Server egalikni (o'z lidi / o'z kartochkasi) o'zi tekshiradi.
//  • yangi kartochka (liddan) yoki liddan olinadigan maydon o'zgargan → POST /api/state/book-roadmap/from-lead
//    (lidning o'zi saqlanib bo'lgach — server ma'lumotni bazadagi liddan oladi);
//  • bosqich / izoh / manzil → PATCH /api/state/book-roadmap/:id.
// O'chirish — faqat admin.
const BR_LEAD_FIELDS = ['name', 'studentId', 'phone', 'region', 'managerId'];
const BR_EDIT_FIELDS = ['status', 'comments', 'address'];
// Serverdagi holat nusxasi (id → yozuv). Kesh massivi joyida o'zgartiriladi (getItem o'sha massivni qaytaradi),
// shu sabab "avval qanday edi" — shu nusxadan. Server javobi va /api/state yuklanishida yangilanadi.
let _brShadow = null;
function resetBookRoadmapShadow(list) {
    _brShadow = new Map((Array.isArray(list) ? list : []).filter(x => x && x.id != null).map(x => [x.id, JSON.parse(JSON.stringify(x))]));
}
function syncSalesBookRoadmap(next, removedIds) {
    const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    if (!_brShadow) resetBookRoadmapShadow([]);
    const byId = _brShadow;
    const jobs = [];
    const replace = entry => {
        if (!entry?.id) return;
        const list = Array.isArray(_cache.bookRoadmap) ? _cache.bookRoadmap.slice() : [];
        const i = list.findIndex(x => x && (x.id === entry.id || (entry.leadRef && x.leadRef && x.leadRef.id === entry.leadRef.id && x.leadRef.lang === entry.leadRef.lang)));
        if (i >= 0) { if (list[i].id !== entry.id) _brShadow.delete(list[i].id); list[i] = { ...list[i], ...entry }; } else list.unshift(entry);
        _cache.bookRoadmap = list;
        _brShadow.set(entry.id, JSON.parse(JSON.stringify(entry)));
    };
    for (const item of next || []) {
        if (!item?.id) continue;
        const old = byId.get(item.id);
        if (item.leadRef?.id && (!old || BR_LEAD_FIELDS.some(k => !same(old[k], item[k])))) {
            const wait = typeof waitForLeadPersistence === 'function' ? waitForLeadPersistence(item.leadRef.id) : Promise.resolve();
            jobs.push(wait.then(() => apiFetch('/api/state/book-roadmap/from-lead', { method: 'POST', body: JSON.stringify({ leadId: item.leadRef.id, entryId: old ? undefined : item.id }) }))
                .then(r => { replace(r?.entry); return r; }));
            if (!old) continue;
        }
        if (old && BR_EDIT_FIELDS.some(k => !same(old[k], item[k]))) {
            const body = Object.fromEntries(BR_EDIT_FIELDS.filter(k => !same(old[k], item[k])).map(k => [k, item[k]]));
            jobs.push(apiFetch('/api/state/book-roadmap/' + encodeURIComponent(item.id), { method: 'PATCH', body: JSON.stringify(body) })
                .then(r => { replace(r?.entry); return r; }));
        }
    }
    if ((removedIds || []).length) jobs.push(Promise.reject(new Error('Kitob yetkazish yozuvini o\'chirishni admin bajaradi')));
    return Promise.allSettled(jobs).then(rs => {
        const bad = rs.find(r => r.status === 'rejected');
        if (bad) {
            console.error('Kitob yetkazish saqlash xatoligi:', bad.reason?.message);
            showSaveError(bad.reason?.message || 'Kitob yetkazish yozuvi saqlanmadi');
            // Keshni serverdagi holatga qaytarish (soxta "saqlandi" ko'rinish qolmasin).
            if (typeof apiFetch === 'function') apiFetch('/api/state', { fresh: true }).then(st => { if (Array.isArray(st?.bookRoadmap)) { _cache.bookRoadmap = st.bookRoadmap; resetBookRoadmapShadow(st.bookRoadmap); } if (typeof renderBookRoadmap === 'function' && document.getElementById('bookRoadmapKanban')?.offsetParent) renderBookRoadmap(); }).catch(() => {});
        }
        return rs;
    });
}

// Serverdagi maxsus endpoint muvaffaqiyatli tugagandan keyin ekrandagi
// ma'lumotni yangilash uchun. Bu funksiya PATCH /api/state yubormaydi.
function setCachedItem(key, value) {
    const cacheKey = CACHE_KEY_MAP[key];
    if (cacheKey) {
        _cache[cacheKey] = value;
        return;
    }
    if (key === STORAGE_KEYS.currentUser) {
        setItem(key, value);
    }
}

function showSaveError(msg) {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('saveErrorToast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'saveErrorToast';
        el.className = 'save-error-toast';
        document.body.appendChild(el);
    }
    el.textContent = 'Saqlash xatoligi: ' + msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// Lidlar obyekti haqiqiy ({english:[], russian:[]}) ko'rinishdami?
// Server `saveLeads` klient yuborgan ro'yxatni to'g'ridan-to'g'ri bazaga
// yozgani uchun, buzilgan (masalan `{}` yoki `null`) qiymat keshga tushib
// qolsa, keyingi har qanday saqlash bazadagi lidlarni o'chirib yuborishi
// mumkin edi. Shu sabab bunday qiymat na keshga yoziladi, na serverga.
function isValidLeadsShape(value) {
    return Boolean(value)
        && typeof value === 'object'
        && Array.isArray(value.english)
        && Array.isArray(value.russian);
}

async function refreshLeadsFromApi() {
    const leads = await apiFetchLeads();
    if (!isValidLeadsShape(leads)) {
        throw new Error('Serverdan lidlar ro\'yxati noto\'g\'ri formatda keldi');
    }
    _cache.leads = leads;
    return leads;
}

// Serverda arxivdan tiklash yoki xodimni ishdan bo'shatish kabi bir nechta
// jadvalga tegadigan amal tugagach — keshni serverdagi holat bilan yangilash.
// PATCH yubormaydi (eski keshdan qayta yozib, tiklangan yozuvni o'chirmaslik uchun).
async function reloadStateFromApi() {
    const state = await apiLoadState();
    _cache = { ..._cache, ...state };
    resetBookRoadmapShadow(_cache.bookRoadmap);
    return state;
}

async function initStorage() {
    try {
        const state = await apiLoadState();
        _cache = { ...state };
        resetBookRoadmapShadow(_cache.bookRoadmap);
        _apiReady = true;
        // Ketma-ket await qilinadi — bir nechtasi bir vaqtda "teachers" (yoki
        // boshqa) kalitiga PATCH yuborsa, tarmoqda poyga bo'lib, birining
        // natijasi ikkinchisinikini bosib qo'yishining oldi olinadi.
        // Eski ma'lumotni tozalash/migratsiya faqat to'liq huquqli rollarda. Boshqa rollar
        // serverdan o'z doirasidagi (qisqartirilgan) snapshotni oladi: ustozda HR ro'yxatida
        // faqat o'zi bor, cleanOrphanTeachers boshqa ustozlarni keshdan o'chirib yuborardi
        // ("asosiy ustoz —") va PATCH 403 bilan rad etilardi.
        const role = typeof getCurrentUser === 'function' ? getCurrentUser()?.role : null;
        if (['admin', 'boshliq'].includes(role)) {
            await migrateTeachers();
            await migrateStudents();
            await migrateSalesManagersHREmployees();
            await cleanOrphanTeachers();
        }
    } catch (err) {
        console.error('API ulanmadi:', err.message);
        _apiReady = false;
        if (err.status === 401 && !window.location.pathname.includes('login')) {
            clearSession();
            window.location.href = 'login.html';
        }
        throw err;
    }
}

function generateTimeSlots() {
    const slots = [];
    for (let h = 8; h <= 23; h++) {
        for (let m = 0; m < 60; m += 15) {
            if (h === 23 && m > 45) break;
            slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
    }
    return slots;
}

function getCurrentUser() {
    return getItem(STORAGE_KEYS.currentUser, null);
}

function setCurrentUser(user) {
    if (user) {
        setItem(STORAGE_KEYS.currentUser, user);
    } else {
        clearSession();
    }
}

function requireAuth() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    return user;
}

async function migrateSalesManagersHREmployees() {
    const sm = window.localStorage.getItem(STORAGE_KEYS.salesManagers);
    if (!sm) return;
    try {
        const parsedSM = JSON.parse(sm);
        if (Array.isArray(parsedSM) && parsedSM.length > 0) {
            let hr = getItem(STORAGE_KEYS.hrEmployees, []);
            for (const sp of parsedSM) {
                if (!hr.find(h => h.id === sp.id)) {
                    hr.push({
                        ...sp,
                        role: 'Sotuv menejeri',
                        status: 'Kompaniyada',
                        joinedDate: new Date().toLocaleDateString('uz-UZ'),
                        phone: ''
                    });
                }
            }
            await setItem(STORAGE_KEYS.hrEmployees, hr);
        }
        window.localStorage.removeItem(STORAGE_KEYS.salesManagers);
    } catch (e) { }
}

// Pul hamma joyda bir xil: "4 500 000 so'm" (bo'linmaydigan bo'shliq bilan).
function formatMoney(amount) {
    const n = Math.round(Number(amount) || 0);
    return `${n < 0 ? '−' : ''}${String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')} so'm`;
}

function getMonthKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

function slotKey(date, time, teacherId) {
    return `${date}_${time}_${teacherId || 'all'}`;
}

// Bir xil "teachers" kalitiga ketma-ket bir necha migratsiya funksiyasi
// yozishi mumkin (bu, cleanOrphanTeachers) — har biri await qilinib
// ketma-ket ishlatilishi kerak, aks holda ularning PATCH so'rovlari
// tarmoqda "poyga" qilib, birining natijasi ikkinchisinikini bosib
// qo'yishi mumkin edi (masalan boshqa joyda to'g'irlangan subject
// qiymati shu eski migratsiya yozuvi bilan qayta noto'g'irga aylanib
// qolardi).
async function migrateTeachers() {
    const teachers = getItem(STORAGE_KEYS.teachers, null);
    if (!teachers) return;
    let changed = false;
    teachers.forEach((t, i) => {
        if (!t.schedulePattern) { t.schedulePattern = i % 2 === 0 ? 'mwf' : 'tts'; changed = true; }
        if (!t.lessonDuration) { t.lessonDuration = 15; changed = true; }
        if (!t.subject) {
            t.subject = (t.name && t.name.includes('Rus')) || t.id === 't3' ? 'russian' : 'english';
            changed = true;
        }
    });
    if (changed) await setItem(STORAGE_KEYS.teachers, teachers);
}

// HR da yo'q eski ustoz yozuvlarini teachers jadvalidan o'chiradi
async function cleanOrphanTeachers() {
    const teachers = getItem(STORAGE_KEYS.teachers, null);
    if (!teachers || !teachers.length) return;
    const hrEmployees = getItem(STORAGE_KEYS.hrEmployees, []);
    const hrIds = new Set(hrEmployees.map(e => e.id));
    const cleaned = teachers.filter(t => hrIds.has(t.id));
    if (cleaned.length < teachers.length) {
        await setItem(STORAGE_KEYS.teachers, cleaned);
    }
}

async function migrateStudents() {
    const students = getItem(STORAGE_KEYS.students, null);
    if (!students) return;
    let changed = false;
    students.forEach(s => {
        if (!s.subject) {
            s.subject = normalizeSubject(s.group || s.subject);
            changed = true;
        }
    });
    if (changed) await setItem(STORAGE_KEYS.students, students);
}

function normalizeSubject(val) {
    if (!val) return 'english';
    const v = String(val).toLowerCase();
    if (v.includes('rus') || v === 'russian') return 'russian';
    return 'english';
}

function getSubjectLabel(key) {
    return SUBJECTS[key] ? `${SUBJECTS[key].flag} ${SUBJECTS[key].label}` : key;
}

function filterTeachersByTypeAndSubject(type, subject) {
    if (type === 'asosiy' || type === 'yordamchi') {
        return teacherRoles.pool(getItem(STORAGE_KEYS.hrEmployees, []), getItem(STORAGE_KEYS.teachers, []), type, subject);
    }
    const stored = getItem(STORAGE_KEYS.teachers, []).filter(t =>
        t.type === type && (t.subject || 'english') === subject
    );

    return stored;
}

function getLessonDaysInMonth(year, month, patternKey) {
    const pattern = SCHEDULE_PATTERNS[patternKey] || SCHEDULE_PATTERNS.mwf;
    const totalDays = getDaysInMonth(year, month);
    const lessonDays = [];
    for (let d = 1; d <= totalDays; d++) {
        const dow = new Date(year, month - 1, d).getDay();
        if (pattern.days.includes(dow)) lessonDays.push(d);
    }
    return lessonDays;
}

function isLessonDay(year, month, day, patternKey) {
    const dow = new Date(year, month - 1, day).getDay();
    const pattern = SCHEDULE_PATTERNS[patternKey] || SCHEDULE_PATTERNS.mwf;
    return pattern.days.includes(dow);
}

// 10-vazifa: yordamchi ustoz uchun dars kunlari qat'iy haftalik patternga
// (mwf/tts) bog'lanmagan — istalgan kunni belgilay oladi. Lekin maosh
// shu songa bog'liq bo'lgani uchun (calculateKpiSalary) oyiga qancha kun
// belgilash mumkinligiga baribir chegara kerak — bu chegara asosiy
// ustozning haftalik (3 kun/hafta) patterni o'sha oyda necha kun bersa,
// aynan shunga (taxminan 12-13) teng qilib avtomatik hisoblanadi.
function getFlexibleAttendanceCap(year, month) {
    return Math.round(getDaysInMonth(year, month) * 3 / 7);
}

function getMonthlyBaseSalary(duration, teacher = {}) {
    const config = getItem(STORAGE_KEYS.payrollRates, {})[teacher.subject || 'english'];
    if (teacher.type === 'yordamchi') return config?.assistant?.rate ?? 40000;
    const rates = config?.teacher?.rates || SALARY_RATES;
    return rates[duration] ?? rates[15];
}

function countStudentLessons(attBlock, studentId, lessonDays) {
    const sa = attBlock[studentId] || {};
    return lessonDays.filter(d => sa[d]).length;
}

function getStudentsForTeacher(teacher, role) {
    const subject = teacher.subject || 'english';
    const students = getItem(STORAGE_KEYS.students, []);
    const isAssistant = role === 'assistant' || teacher.type === 'yordamchi';
    if (isAssistant) {
        return students.filter(s =>
            s.assistantTeacherId === teacher.id && (s.subject || 'english') === subject
        );
    }
    return students.filter(s =>
        s.teacherId === teacher.id && (s.subject || 'english') === subject
    );
}

function calculateKpiSalary(teacher, monthVal, attendanceStore, students) {
    const [year, month] = monthVal.split('-').map(Number);
    const pattern = teacher.schedulePattern || 'mwf';
    const duration = teacher.lessonDuration || 15;
    const monthlyBase = getMonthlyBaseSalary(duration, teacher);
    // Both duties count actual lessons on any day. The timetable still sets
    // the primary monthly norm; assistants use their flexible monthly cap.
    // Paid salary snapshots keep their historical policy in the finance service.
    const isAssistant = teacher.type === 'yordamchi';
    const lessonDays = isAssistant ? null : getLessonDaysInMonth(year, month, pattern);
    const payrollConfig = getItem(STORAGE_KEYS.payrollRates, {})[teacher.subject || 'english'];
    const lessonLimit = (isAssistant ? payrollConfig?.assistant : payrollConfig?.teacher)?.maxLessons || 0;
    const calendarExpected = isAssistant ? getFlexibleAttendanceCap(year, month) : getLessonDaysInMonth(year, month, pattern).length;
    const expectedPerStudent = lessonLimit > 0 ? Math.min(calendarExpected, lessonLimit) : calendarExpected;
    const attBlock = attendanceStore[`${monthVal}_${teacher.id}`] || {};
    const perLesson = expectedPerStudent > 0 ? monthlyBase / expectedPerStudent : 0;

    const studentList = students || getStudentsForTeacher(teacher);
    const employee = getItem(STORAGE_KEYS.hrEmployees, []).find(e => e.id === teacher.id) || {};
    const hireDate = payrollEngine.date(employee.startDate || employee.joinDate);
    let total = 0;
    let totalLessons = 0;
    // Moliya bilan bir xil (payrollEngine 'approved-v1'): 2026-10 dan asosiy ustozga faqat o'quvchining dars kunidagi
    // "Keldi" + admin tasdiqlagan qoplash. Tasdiqlangan qoplashlar /api/school/makeups dan keshlanadi.
    const byMakeups = !isAssistant && monthVal >= '2026-10' && typeof payrollEngine.studentLessonDays === 'function';
    const approved = byMakeups ? (globalThis.__schoolMakeups || []).filter(m => m.status === 'approved' && m.teacher_id === teacher.id && String(m.held_date || '').slice(0, 7) === monthVal) : [];
    const perStudent = studentList.map(s => {
        const studentStart = payrollEngine.date(s.startDate || s.joinDate);
        const lessonSet = byMakeups ? new Set(payrollEngine.studentLessonDays(monthVal, s, pattern)) : null;
        const okDate = date => date && (!hireDate || date >= hireDate) && (!studentStart || date >= studentStart);
        const presentDays = Object.entries(attBlock[s.id] || {}).filter(([day, present]) => {
            const date = payrollEngine.date(monthVal + '-' + String(day).padStart(2, '0'));
            return (present === 1 || present === true) && okDate(date) && (!lessonSet || lessonSet.has(Number(day)));
        }).map(([day]) => Number(day));
        let extra = 0;
        if (byMakeups) {
            const seen = new Set(presentDays);
            for (const m of approved.filter(m => m.student_id === s.id)) {
                const day = Number(String(m.held_date).slice(8, 10));
                if (!okDate(payrollEngine.date(String(m.held_date).slice(0, 10)))) continue;
                if (m.kind === 'double') extra++; else if (!seen.has(day)) { seen.add(day); extra++; }
            }
        }
        const rawLessons = presentDays.length + extra;
        // payrollEngine bilan bir xil: 2026-10 dan reja — o'quvchining o'z dars kunlari soni (12–14).
        const planN = byMakeups ? (lessonLimit > 0 ? Math.min(lessonSet.size, lessonLimit) : lessonSet.size) : expectedPerStudent;
        const lessons = Math.min(rawLessons, planN);
        const studentBase = getMonthlyBaseSalary(s.lessonDuration || duration, teacher);
        const earned = planN > 0 ? Math.round(studentBase / planN * lessons) : 0;
        total += earned;
        totalLessons += lessons;
        return { id: s.id, name: s.name, lessons, expected: planN, earned, maxEarned: studentBase };
    });

    const maxPossible = perStudent.reduce((sum, s) => sum + s.maxEarned, 0);
    const kpiPercent = maxPossible > 0 ? Math.round((total / maxPossible) * 100) : 0;

    return {
        expected: expectedPerStudent,
        completed: totalLessons,
        studentCount: studentList.length,
        perLesson,
        monthlyBase,
        total,
        maxPossible,
        kpiPercent,
        perStudent,
        lessonDays: lessonDays || [],
        duration,
        pattern: isAssistant ? null : pattern,
        patternLabel: isAssistant ? `Istalgan kun (oyiga ${expectedPerStudent} tagacha)` : (SCHEDULE_PATTERNS[pattern]?.label || '')
    };
}

// Chaqiruvchilarning aksariyati bu promise'ni kutmaydi (fire-and-forget,
// avvalgidek) — lekin bootApp'dagi o'z-o'zini tuzatish kabi joylar endi
// await qilib, saqlash haqiqatan ham serverga yetganiga ishonch hosil
// qilishi mumkin.
async function updateTeacher(id, fields) {
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const idx = teachers.findIndex(t => t.id === id);
    if (idx >= 0) {
        teachers[idx] = { ...teachers[idx], ...fields };
        return setItem(STORAGE_KEYS.teachers, teachers);
    }
    // 3-vazifa: Xodimlar ro'yxatida bor, lekin STORAGE_KEYS.teachers'da hali
    // haqiqiy yozuvi yo'q "virtual" ustoz uchun (filterTeachersByTypeAndSubject
    // shu HR yozuvidan vaqtincha sintez qilib ko'rsatadigan, _fromHr belgili
    // yozuv) — bu funksiya avval hech narsa saqlamasdi, chunki faqat MAVJUD
    // yozuvni yangilar, yangisini hech qachon yaratmasdi. Shu sabab "Ustoz
    // ish jadvalini sozlash"da saqlash tashqi ko'rinishda ishlagandek
    // tuyulardi-yu, aslida hech narsa saqlanmasdi — keyin "Sinov darsi"
    // oynasida xuddi shu ustoz "topilmadi" deb chiqardi.
    const employees = getItem(STORAGE_KEYS.hrEmployees, []);
    const emp = employees.find(e => e.id === id);
    const inferredType = emp?.role === 'yordamchi' ? 'yordamchi' : 'asosiy';
    // Asosiy ustozda til HR lavozim satirining o'zida ("ingliz-oqituvchi"/
    // "rus-oqituvchi"), yordamchi ustozda esa alohida "lang" maydonida
    // saqlanadi (filterTeachersByTypeAndSubject'dagi kabi) — faqat
    // rol bo'yicha aniqlash yordamchi ustozlar uchun doim 'english'ga
    // tushib qolardi, garchi ular rus tilida ishlasa ham.
    const inferredSubject = emp?.role === 'rus-oqituvchi' ? 'russian'
        : emp?.role === 'ingliz-oqituvchi' ? 'english'
        : (emp?.lang === 'russian' ? 'russian' : 'english');
    teachers.push({
        id,
        name: emp?.name || '',
        type: inferredType,
        subject: inferredSubject,
        phone: emp?.phone || '',
        login: emp?.login || '',
        ...fields
    });
    return setItem(STORAGE_KEYS.teachers, teachers);
}

function updateStudent(id, fields) {
    const students = getItem(STORAGE_KEYS.students, []);
    const idx = students.findIndex(s => s.id === id);
    if (idx >= 0) {
        students[idx] = { ...students[idx], ...fields };
        setItem(STORAGE_KEYS.students, students);
    }
}
