// Rolga qarab /api/state javobidan maxfiy maydonlarni olib tashlash.
//
// Ilgari ROP, sotuv menejeri, targetolog va "employee" rollari serverdan
// BARCHA xodimlarning karta raqami, pasporti, PINFL'i, manzili va tug'ilgan
// sanasini, sotuv menejeri esa barcha o'quvchilarning telefonlari, eski
// to'lov jadvali va pul oqimini ham olardi — filtr faqat brauzerda edi.
// Bu modul shu ma'lumotlarni serverning o'zida kesadi. Funksiyalar sof
// (pure): faqat berilgan state nusxasini o'zgartiradi, bazaga yozmaydi.

const FULL_HR_ROLES = new Set(['admin', 'boshliq']);

// Xodimning shaxsiy (HR) maydonlari — faqat admin/boshliq va xodimning o'zi ko'radi.
const HR_PRIVATE_FIELDS = ['cardNumber', 'passportSeries', 'pinfl', 'address', 'birthDate'];

// O'quvchining aloqa/shaxsiy maydonlari va qarzi (extra_data ichida ham bo'lishi mumkin).
const STUDENT_CONTACT_RE = /phone|email|address|passport|pinfl|card|birth|telegram|parent|debt/i;

function sameLogin(a, b) {
    return String(a || '').trim().toLowerCase() !== ''
        && String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function maskHrEmployees(list, user) {
    if (!Array.isArray(list) || FULL_HR_ROLES.has(user?.role)) return list;
    return list.map(e => {
        if (sameLogin(e.login, user?.email)) return e; // o'z yozuvi to'liq qoladi
        const copy = { ...e };
        for (const key of HR_PRIVATE_FIELDS) delete copy[key];
        return copy;
    });
}

function stripStudentContacts(s) {
    const copy = {};
    for (const [key, value] of Object.entries(s || {})) {
        if (!STUDENT_CONTACT_RE.test(key)) copy[key] = value;
    }
    return copy;
}

function ownStudentIdsForManager(students, leads, managerId) {
    const ids = new Set();
    if (!managerId) return ids;
    const leadIds = new Set([...(leads?.english || []), ...(leads?.russian || [])]
        .filter(l => String(l.managerId || '') === String(managerId)).map(l => l.id));
    for (const s of students || []) {
        if (s.isStaffDemo) continue;
        if ((s.managerId && String(s.managerId) === String(managerId))
            || (s.leadRef && leadIds.has(s.leadRef.id))) ids.add(s.id);
    }
    return ids;
}

// state — getFullState() natijasi (sotuv menejeri uchun state.leads allaqachon
// faqat o'z lidlari bilan almashtirilgan bo'lishi kerak).
function scopeState(state, user, { managerId, financeEmployee = false } = {}) {
    const role = user?.role;
    state.hrEmployees = maskHrEmployees(state.hrEmployees, user);

    if (role === 'sales_manager') {
        const own = ownStudentIdsForManager(state.students, state.leads, managerId);
        // Boshqa menejerlarning o'quvchilari reyting/statistika uchun qoladi,
        // lekin telefon va boshqa aloqa maydonlarisiz.
        // Xodimlar demo hisoblari (isStaffDemo) sotuvga kelmaydi — ro'yxat/son/statistika
        // buzilmasin. Faqat menejerning o'z demo hisobi (ilovani ko'rish uchun) qoladi.
        state.students = (state.students || [])
            .filter(s => !s.isStaffDemo || (managerId && String(s.demoForEmployeeId || '') === String(managerId)))
            .map(s => own.has(s.id) ? s : stripStudentContacts(s));
        state.payments = (state.payments || []).filter(p => own.has(p.studentId));
        state.cashFlow = [];
        // Kitob yetkazish: faqat o'z kartochkalari (boshqa menejer mijozlarining manzili va telefoni kelmaydi).
        if (Array.isArray(state.bookRoadmap)) state.bookRoadmap = managerId ? state.bookRoadmap.filter(b => String(b.managerId || '') === String(managerId)) : [];
    } else if (role === 'employee' && !financeEmployee) {
        state.students = (state.students || []).map(stripStudentContacts);
        state.payments = [];
        state.cashFlow = [];
    } else if (role === 'targetolog' || role === 'hr') {
        // HR menejer: o'quvchi kontaktlari, to'lovlar va kassa kerak emas (moliya — faqat Moliya).
        state.students = (state.students || []).map(stripStudentContacts);
        state.payments = [];
        state.cashFlow = [];
    }
    return state;
}

// ROP kabi to'liq bo'lmagan rollar xodimlar ro'yxatini saqlaganda, ular
// ko'rmagan maxfiy maydonlar bo'sh qiymat bilan USTIDAN YOZILIB KETMASLIGI
// kerak: mavjud xodim uchun bazadagi qiymat saqlanadi.
function preserveHrPrivateFields(employees, oldRows, actor) {
    if (FULL_HR_ROLES.has(actor?.role) || !Array.isArray(employees)) return employees;
    const COLS = { cardNumber: 'card_number', passportSeries: 'passport_series', pinfl: 'pinfl', address: 'address', birthDate: 'birth_date' };
    const byId = new Map((oldRows || []).map(r => [r.id, r]));
    return employees.map(e => {
        const old = byId.get(e.id);
        // Moliya bo'limiga kirish huquqi bo'lim/login orqali beriladi — buni faqat admin/boshliq o'zgartiradi.
        const financeDept = d => ['moliya', 'finance'].includes(String(d || '').trim().toLowerCase());
        if (!old && financeDept(e.department)) throw Object.assign(new Error('Moliya bo‘limiga xodim qo‘shishni faqat admin bajaradi'), { status: 403 });
        if (old && (String(e.department ?? '') !== String(old.department ?? '') && (financeDept(e.department) || financeDept(old.department))))
            throw Object.assign(new Error('Xodimni moliya bo‘limiga o‘tkazish yoki undan chiqarishni faqat admin bajaradi'), { status: 403 });
        if (old && financeDept(old.department) && String(e.login ?? '').trim().toLowerCase() !== String(old.login ?? '').trim().toLowerCase())
            throw Object.assign(new Error('Moliya xodimining loginini faqat admin o‘zgartiradi'), { status: 403 });
        if (!old || sameLogin(old.login, actor?.email)) return e;
        const merged = { ...e };
        for (const [field, col] of Object.entries(COLS)) {
            const incoming = String(e[field] ?? '').trim();
            // Bo'sh qiymat = "ko'rmadim" (maskalangan) — bazadagi qiymat qoladi.
            // Bo'sh bo'lmagan, lekin bazadagidan farqli qiymat — jim
            // tashlab yubormasdan, aniq rad etamiz.
            if (incoming && incoming !== String(old[col] || '').trim()) {
                throw Object.assign(new Error('Xodimning karta, pasport, PINFL, manzil va tugʻilgan sanasini faqat admin oʻzgartira oladi'), { status: 403 });
            }
            merged[field] = old[col] || '';
        }
        return merged;
    });
}

module.exports = { scopeState, maskHrEmployees, stripStudentContacts, ownStudentIdsForManager, preserveHrPrivateFields, HR_PRIVATE_FIELDS };
