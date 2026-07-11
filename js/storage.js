// Myhomework.uz — ma'lumotlar (API + cache)

const STORAGE_KEYS = {
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
    peerMessages: 'mh_peer_messages'
};

const CACHE_KEY_MAP = {
    [STORAGE_KEYS.teachers]: 'teachers',
    [STORAGE_KEYS.salesManagers]: 'salesManagers',
    [STORAGE_KEYS.students]: 'students',
    [STORAGE_KEYS.timetable]: 'timetable',
    [STORAGE_KEYS.mainAttendance]: 'mainAttendance',
    [STORAGE_KEYS.assistantAttendance]: 'assistantAttendance',
    [STORAGE_KEYS.payments]: 'payments',
    [STORAGE_KEYS.leads]: 'leads',
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
    [STORAGE_KEYS.peerMessages]: 'peerMessages'
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
    if (cacheKey && _cache[cacheKey] !== undefined) return _cache[cacheKey];
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

function setItem(key, value) {
    const cacheKey = CACHE_KEY_MAP[key];
    if (cacheKey) {
        _cache[cacheKey] = value;
        if (_apiReady) {
            apiPatchState({ [cacheKey]: value }).catch(err => {
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

async function refreshLeadsFromApi() {
    const leads = await apiFetchLeads();
    _cache.leads = leads;
    return leads;
}

async function initStorage() {
    try {
        const state = await apiLoadState();
        _cache = { ...state };
        _apiReady = true;
        migrateTeachers();
        migrateStudents();
        migrateSalesManagersHREmployees();
        cleanOrphanTeachers();
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

function migrateSalesManagersHREmployees() {
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
            setItem(STORAGE_KEYS.hrEmployees, hr);
        }
        window.localStorage.removeItem(STORAGE_KEYS.salesManagers);
    } catch (e) { }
}

function formatMoney(amount) {
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
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

function migrateTeachers() {
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
    if (changed) setItem(STORAGE_KEYS.teachers, teachers);
}

// HR da yo'q eski ustoz yozuvlarini teachers jadvalidan o'chiradi
function cleanOrphanTeachers() {
    const teachers = getItem(STORAGE_KEYS.teachers, null);
    if (!teachers || !teachers.length) return;
    const hrEmployees = getItem(STORAGE_KEYS.hrEmployees, []);
    const hrIds = new Set(hrEmployees.map(e => e.id));
    const cleaned = teachers.filter(t => hrIds.has(t.id));
    if (cleaned.length < teachers.length) {
        setItem(STORAGE_KEYS.teachers, cleaned);
    }
}

function migrateStudents() {
    const students = getItem(STORAGE_KEYS.students, null);
    if (!students) return;
    let changed = false;
    students.forEach(s => {
        if (!s.subject) {
            s.subject = normalizeSubject(s.group || s.subject);
            changed = true;
        }
    });
    if (changed) setItem(STORAGE_KEYS.students, students);
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
    const stored = getItem(STORAGE_KEYS.teachers, []).filter(t =>
        t.type === type && (t.subject || 'english') === subject
    );

    // Faqat "Xodimlar ro'yxati"da bor ustozlarni ko'rsatamiz
    if (type === 'asosiy') {
        const hrRole = subject === 'russian' ? 'rus-oqituvchi' : 'ingliz-oqituvchi';
        const hrEmployees = getItem(STORAGE_KEYS.hrEmployees, [])
            .filter(e => e.role === hrRole && e.status !== 'inactive');
        const hrIds = new Set(hrEmployees.map(e => e.id));
        const storedInHr = stored.filter(t => hrIds.has(t.id));
        const storedIds = new Set(storedInHr.map(t => t.id));
        const hrTeachers = hrEmployees.map(e => ({
            id: e.id,
            name: e.name,
            type: 'asosiy',
            subject,
            phone: e.phone || '',
            login: e.login || '',
            _fromHr: true
        }));
        return [...storedInHr, ...hrTeachers.filter(t => !storedIds.has(t.id))];
    }

    if (type === 'yordamchi') {
        const hrEmployees = getItem(STORAGE_KEYS.hrEmployees, [])
            .filter(e => e.role === 'yordamchi' && e.status !== 'inactive');
        const hrIds = new Set(hrEmployees.map(e => e.id));
        const storedInHr = stored.filter(t => hrIds.has(t.id));
        const storedIds = new Set(storedInHr.map(t => t.id));
        const hrTeachers = hrEmployees.map(e => ({
            id: e.id,
            name: e.name,
            type: 'yordamchi',
            subject,
            phone: e.phone || '',
            login: e.login || '',
            _fromHr: true
        }));
        return [...storedInHr, ...hrTeachers.filter(t => !storedIds.has(t.id))];
    }

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

function getMonthlyBaseSalary(duration) {
    return SALARY_RATES[duration] || SALARY_RATES[15];
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
    const monthlyBase = getMonthlyBaseSalary(duration);
    const lessonDays = getLessonDaysInMonth(year, month, pattern);
    const expectedPerStudent = lessonDays.length;
    const attBlock = attendanceStore[`${monthVal}_${teacher.id}`] || {};
    const perLesson = expectedPerStudent > 0 ? monthlyBase / expectedPerStudent : 0;

    const studentList = students || getStudentsForTeacher(teacher);
    let total = 0;
    let totalLessons = 0;
    const perStudent = studentList.map(s => {
        const lessons = countStudentLessons(attBlock, s.id, lessonDays);
        const earned = Math.round(perLesson * lessons);
        total += earned;
        totalLessons += lessons;
        return { id: s.id, name: s.name, lessons, earned, maxEarned: monthlyBase };
    });

    const maxPossible = monthlyBase * studentList.length;
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
        lessonDays,
        duration,
        pattern,
        patternLabel: SCHEDULE_PATTERNS[pattern]?.label || ''
    };
}

function updateTeacher(id, fields) {
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const idx = teachers.findIndex(t => t.id === id);
    if (idx >= 0) {
        teachers[idx] = { ...teachers[idx], ...fields };
        setItem(STORAGE_KEYS.teachers, teachers);
    }
}

function updateStudent(id, fields) {
    const students = getItem(STORAGE_KEYS.students, []);
    const idx = students.findIndex(s => s.id === id);
    if (idx >= 0) {
        students[idx] = { ...students[idx], ...fields };
        setItem(STORAGE_KEYS.students, students);
    }
}
