'use strict';
// ROP faqat o'z til yo'nalishini ko'radi va o'zgartiradi (HR'dagi lang:
// english / russian / both). Til HR yozuvidan olinadi (login, keyin ism).
// HR'da til belgilanmagan ROP — eski xatti-harakat (cheklovsiz) qoladi,
// lekin bir marta ogohlantirish yoziladi, admin HR'da tilni belgilashi uchun.
//
// Moliya: ROP Cash Flow'ni umuman ko'rmaydi, sotuv rejasi va bonus
// natijalarini faqat KO'RADI — reja/bonus sozlamalari, kassa, to'lovlar
// faqat admin/boshliq tomonidan yoziladi (direktor qarori, 30-okt).

const LANGS = ['english', 'russian'];

// PATCH /api/state orqali ROP yoza olmaydigan kalitlar.
// bonusHistory (kimga qaysi bonus berilgani) — ROP ishi bo'lib qoladi (openAddBonusHistoryModal: admin va ROP).
const ROP_DENIED_STATE_KEYS = ['cashFlow', 'payments', 'bonusData', 'salesPlan', 'individualSalesPlans'];

const langOfStudent = s => (String(s?.subject || '').trim().toLowerCase() === 'russian' ? 'russian' : 'english');
const TEACHER_HR_ROLES = new Set(['rus-oqituvchi', 'ingliz-oqituvchi', 'yordamchi', 'oqituvchi']);
// js/app.js backfillAllTeacherSubjectsFromHr bilan bir xil qoida: lavozim, keyin HR'dagi lang.
const langOfTeacherHr = e => (e?.role === 'rus-oqituvchi' ? 'russian' : e?.role === 'ingliz-oqituvchi' ? 'english' : e?.lang === 'russian' ? 'russian' : 'english');
const langOfBookEntry = b => (String(b?.lang || '').trim().toLowerCase() === 'russian' ? 'russian' : 'english');
const langOfLead = l => (l?.language === 'russian' ? 'russian' : 'english');

const warned = new Set();
function normalizeLang(raw) {
    const l = String(raw || '').trim().toLowerCase();
    if (l === 'both') return [...LANGS];
    return LANGS.includes(l) ? [l] : null;
}

// null — cheklov yo'q (ROP emas yoki tili belgilanmagan).
async function ropLangsFor(db, user) {
    if (user?.role !== 'rop') return null;
    const rows = (await db.query(
        `SELECT lang FROM hr_employees WHERE LOWER(TRIM(login)) = LOWER(TRIM($1))
            OR ($2 <> '' AND LOWER(TRIM(name)) = LOWER(TRIM($2)))
         ORDER BY (LOWER(TRIM(login)) = LOWER(TRIM($1))) DESC LIMIT 1`,
        [user.email || '', String(user.name || '').trim()]
    )).rows;
    const langs = normalizeLang(rows[0]?.lang);
    if (!langs) {
        const key = String(user.id || user.email || user.name || '?');
        if (!warned.has(key)) {
            warned.add(key);
            console.warn(`[ropScope] ROP "${user.email || user.name || key}" uchun HR'da til yo'nalishi belgilanmagan — til cheklovi qo'llanmadi (ikkala til ko'rinadi). HR → xodim → til ni belgilang.`);
        }
    }
    return langs;
}

function scopeLeads(leads, langs) {
    if (!langs || !leads || typeof leads !== 'object') return leads;
    return Object.fromEntries(LANGS.map(l => [l, langs.includes(l) ? (leads[l] || []) : []]));
}

function filterAttendance(map, ownIds) {
    if (!map || typeof map !== 'object' || Array.isArray(map)) return map;
    const out = {};
    for (const [attKey, students] of Object.entries(map)) {
        const kept = {};
        for (const [sid, days] of Object.entries(students || {})) if (ownIds.has(sid)) kept[sid] = days;
        if (Object.keys(kept).length) out[attKey] = kept;
    }
    return out;
}

// GET /api/state ROP javobi: kassa yo'q; til berilgan bo'lsa — faqat o'z tilidagi
// lidlar, o'quvchilar, ustozlar, ularning to'lovlari va davomati.
function scopeStateForRop(state, langs, { ownEmployeeId = null } = {}) {
    state.cashFlow = [];
    // Xodimlar demo hisoblari (isStaffDemo) ROP'ga kelmaydi — faqat o'zining demo hisobi (ilovani ko'rish uchun).
    if (Array.isArray(state.students)) state.students = state.students.filter(s => !s?.isStaffDemo || (ownEmployeeId && String(s.demoForEmployeeId || '') === String(ownEmployeeId)));
    if (!langs) return state;
    state.leads = scopeLeads(state.leads, langs);
    state.students = (state.students || []).filter(s => langs.includes(langOfStudent(s)));
    const own = new Set(state.students.map(s => s.id));
    if (Array.isArray(state.teachers)) state.teachers = state.teachers.filter(t => langs.includes(langOfStudent(t)));
    // HR: boshqa til ustozlari ham ko'rinmaydi (aks holda brauzerning HR → ustozlar backfill'i ularni "yo'q" deb
    // har yuklanishda butun ro'yxatni qayta yuborardi). Ustoz bo'lmagan xodimlar o'zgarmaydi.
    if (Array.isArray(state.hrEmployees)) state.hrEmployees = state.hrEmployees.filter(e => !TEACHER_HR_ROLES.has(e?.role) || langs.includes(langOfTeacherHr(e)));
    if (Array.isArray(state.payments)) state.payments = state.payments.filter(p => own.has(p.studentId));
    // Kitob yetkazish kartalari (ism, telefon, manzil, lid havolasi) — faqat o'z tili.
    if (Array.isArray(state.bookRoadmap)) state.bookRoadmap = state.bookRoadmap.filter(b => langs.includes(langOfBookEntry(b)));
    state.mainAttendance = filterAttendance(state.mainAttendance, own);
    state.assistantAttendance = filterAttendance(state.assistantAttendance, own);
    return state;
}

function fail(message) { return Object.assign(new Error(message), { status: 403 }); }

// PATCH /api/state: ROP yozuvini tekshiradi va (davomat uchun) boshqa til
// ma'lumotini saqlab qolgan holda birlashtiradi. existing — getFullState()
// (faqat kerak bo'lganda). Qaytaradi: tozalangan partial yoki xato tashlaydi.
function guardRopPatch(partial, langs, existing = {}) {
    const denied = ROP_DENIED_STATE_KEYS.filter(k => partial[k] !== undefined);
    // Kitob yetkazish: ROP umumiy snapshot orqali yozmaydi — faqat /api/state/book-roadmap/:id
    // (til va "to'lovdan oldin jo'natilmaydi" qoidasi o'sha yerda tekshiriladi).
    if (partial.bookRoadmap !== undefined) throw fail("Kitob yetkazish yozuvi umumiy saqlash orqali o'zgartirilmaydi — kartaning o'zidan (bosqich, izoh, manzil) saqlang");
    if (denied.length) throw fail(`ROP moliya ma'lumotini (${denied.join(', ')}) o'zgartira olmaydi — sotuv rejasi va bonus sozlamalarini faqat ko'radi. Kassa, to'lov, reja va bonus sozlamalari — admin.`);
    if (!langs) return partial;
    const out = { ...partial };
    const langName = l => (l === 'russian' ? 'rus' : 'ingliz');
    const checkList = (key, label, removed) => {
        if (!Array.isArray(out[key]) && !removed.length) return;
        const before = new Map((existing[key] || []).map(x => [String(x.id), x]));
        for (const item of out[key] || []) {
            const old = before.get(String(item?.id));
            if ((old && !langs.includes(langOfStudent(old))) || !langs.includes(langOfStudent(item)))
                throw fail(`${label}: ROP faqat o'z til yo'nalishini (${langs.map(langName).join(', ')}) o'zgartiradi`);
        }
        for (const id of removed) {
            const old = before.get(String(id));
            if (old && !langs.includes(langOfStudent(old))) throw fail(`${label}: boshqa til yo'nalishidagi yozuvni o'chirib bo'lmaydi`);
        }
    };
    const rm = out.removedIds && typeof out.removedIds === 'object' ? out.removedIds : {};
    checkList('students', "O'quvchilar", [...(Array.isArray(out.removedStudentIds) ? out.removedStudentIds : []), ...(Array.isArray(rm.students) ? rm.students : [])]);
    // Ustozlar: ROP brauzeri yuklanishda HR'dan fan yo'nalishini avtomatik tuzatadi (backfillAllTeacherSubjectsFromHr)
    // va o'z tilida ko'rmagan ustozni "yangi" deb yuborishi mumkin. Boshqa til ustozlari xatosiz (jim) chiqarib
    // tashlanadi — ular bazadagidek qoladi, ROP sahifasida esa "Saqlash xatoligi" chiqmaydi.
    if (Array.isArray(out.teachers)) {
        const before = new Map((existing.teachers || []).map(x => [String(x.id), x]));
        const own = t => { const old = before.get(String(t?.id)); return (!old || langs.includes(langOfStudent(old))) && langs.includes(langOfStudent(t)); };
        const skipped = out.teachers.filter(t => !own(t)).map(t => t?.id);
        if (skipped.length) {
            const k = 'skip:' + skipped.join(',');
            if (!warned.has(k)) { warned.add(k); console.warn(`[ropScope] ROP ustozlar yozuvidan boshqa til yo'nalishidagilar o'tkazib yuborildi: ${skipped.join(', ')}`); }
            out.teachers = out.teachers.filter(own);
            if (!out.teachers.length) delete out.teachers;
        }
    }
    checkList('teachers', 'Ustozlar', Array.isArray(rm.teachers) ? rm.teachers : []);
    // Davomat serverda "hammasini o'chirib qayta yozish" bilan saqlanadi: ROP faqat
    // o'z tilidagi o'quvchilar qatorini yuboradi, qolganlari bazadagidek qoladi.
    const own = new Set((existing.students || []).filter(s => langs.includes(langOfStudent(s))).map(s => String(s.id)));
    for (const key of ['mainAttendance', 'assistantAttendance']) {
        if (!out[key] || typeof out[key] !== 'object' || Array.isArray(out[key])) continue;
        const merged = {};
        for (const [attKey, students] of Object.entries(existing[key] || {}))
            for (const [sid, days] of Object.entries(students || {})) if (!own.has(sid)) (merged[attKey] ||= {})[sid] = days;
        for (const [attKey, students] of Object.entries(out[key]))
            for (const [sid, days] of Object.entries(students || {})) if (own.has(sid)) (merged[attKey] ||= {})[sid] = days;
        out[key] = merged;
    }
    return out;
}

module.exports = { ropLangsFor, scopeLeads, scopeStateForRop, guardRopPatch, langOfStudent, langOfLead, langOfBookEntry, ROP_DENIED_STATE_KEYS, normalizeLang };
