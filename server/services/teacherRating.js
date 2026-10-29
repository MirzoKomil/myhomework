// Ustozlar reytingi (Ustoz Bosh sahifasidagi "Ustozlar reytingi" kartochkasi
// va admin Akademik → Reyting uchun yagona hisob). Formula (2026-10-27):
// "Ball = davomat 60% + o'quvchilar o'zlashtirishi 40%". Baho/mezonlar endi yo'q.
//
// MUHIM (maxfiylik): teacherDuties.stateForTeacher() boshqa ustozlarning xom
// davomat/baho ma'lumotini ustozning o'z kabinet state'idan butunlay
// kesib tashlaydi (faqat {id,name,type,subject} qoladi). Shu izolyatsiyani
// buzmaslik uchun reyting FAQAT serverda (getFullState() orqali) hisoblanadi
// va mijozga yuboriladigan javobda xom davomat/baho qatorlari emas, faqat
// yakuniy hisoblangan (ism, ball, o'rin) ro'yxati bo'ladi.
const R = require('../../js/attendanceRules');

function expandLessonPatternDays(day) {
    const d = Number(day);
    if ([1, 3, 5].includes(d)) return [1, 3, 5];
    if ([2, 4, 6].includes(d)) return [2, 4, 6];
    return [d];
}

function tashkentNow() {
    const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
    return new Date(Date.now() + TASHKENT_OFFSET_MS);
}

function monthKeySuffix(now) {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

// main_attendance jadvali absent holatini saqlamaydi (present=false bo'lsa
// qator butunlay o'chiriladi), shu sabab "kelmadi" ni to'g'ridan-to'g'ri
// o'qib bo'lmaydi - "kutilgan" (shu oy boshidan/o'quvchi qo'shilgan kundan
// bugungacha, o'quvchining haftalik qolipiga mos kelgan kunlar soni) dan
// "kelgan" ni ayirib hisoblanadi.
function daysElapsedThisMonthFor(student, now) {
    if (student.lessonDayOfWeek == null || !student.lessonTime) return 0;
    if (!R.isActiveStudent(student)) return 0;
    const patternDays = expandLessonPatternDays(student.lessonDayOfWeek);
    const year = now.getUTCFullYear(), month = now.getUTCMonth();
    const todayDate = now.getUTCDate();
    let startDay = 1;
    const startStr = student.startDate || student.joinDate;
    if (startStr) {
        const sd = new Date(`${String(startStr).slice(0, 10)}T00:00:00Z`);
        if (!Number.isNaN(sd.getTime()) && sd.getUTCFullYear() === year && sd.getUTCMonth() === month) {
            startDay = Math.max(startDay, sd.getUTCDate());
        }
    }
    let count = 0;
    for (let d = startDay; d <= todayDate; d++) {
        const dow = new Date(Date.UTC(year, month, d)).getUTCDay();
        const iso = dow === 0 ? 7 : dow;
        if (patternDays.includes(iso)) count++;
    }
    return count;
}

// state: getFullState() natijasi. ownType: 'asosiy' | 'yordamchi' - faqat
// o'zi bilan bir xil turdagi ustozlar orasida solishtiriladi.
// opts.pastMonth — o'tgan oy uchun (now = prevMonthEnd()): o'sha oydan keyin boshlagan o'quvchilar kirmaydi.
// Joriy oy (opts berilmagan) hisobi avvalgidek.
function computeTeacherRating(state, ownType, now = tashkentNow(), learning = {}, opts = {}) {
    const monthSuffix = monthKeySuffix(now);
    const typeOf = (t) => (t.type === 'yordamchi' ? 'yordamchi' : 'asosiy');
    const teachers = (state.teachers || []).filter(t => typeOf(t) === ownType);
    const startedBy = s => { const d = String(s.startDate || s.joinDate || '').slice(0, 7); return !/^\d{4}-\d{2}$/.test(d) || d <= monthSuffix; };
    // Faqat faol o'quvchilar (js/attendanceRules.js — muzlatilgan, to'xtatilgan/tugatgan, demo kirmaydi).
    // Asosiy ustoz: oyning kamida bir kunida faol bo'lgan o'quvchi (AttendanceRules.inMonth, s.statusHistory — sana bo'yicha);
    // faol bo'lmagan KUNLAR monthTotals ichida chiqariladi. Muzlatishdan oldingi darslar Davomat %, Reyting va maoshda bir xil.
    // Yordamchi (eski davomat) — joriy holat.
    const students = (state.students || []).filter(s => (ownType === 'yordamchi' ? R.isActiveStudent(s) : R.inMonth(s, s.statusHistory, monthSuffix))
        && (!opts.pastMonth || startedBy(s)));
    const attStore = ownType === 'yordamchi' ? (state.assistantAttendance || {}) : (state.mainAttendance || {});
    const todayKey = now.toISOString().slice(0, 10);

    const rows = teachers.map((t) => {
        const ownStudents = students.filter(s => (ownType === 'yordamchi' ? s.assistantTeacherId : s.teacherId) === t.id);
        const attKey = `${monthSuffix}_${t.id}`;
        const presentDays = attStore[attKey] || {};
        let expected = 0, completed = 0;
        if (ownType !== 'yordamchi') {
            // Asosiy ustoz: UstozDavomat "Oktyabr" kartasi bilan AYNAN bitta formula (js/attendanceRules.js monthTotals):
            // dars kunidagi "Keldi" + tasdiqlangan qoplash, har o'quvchida oy rejasidan oshmaydi.
            const T = R.monthTotals({ id: t.id, month: monthSuffix, students: ownStudents, mainAtt: presentDays,
                makeups: opts.makeups || [], teacher: t, todayKey });
            expected = T.expected; completed = T.counted;
        } else {
            // Yordamchi (eski davomat bo'yicha) — avvalgidek; reyting UI'da yordamchilarga ko'rsatilmaydi.
            const strict = monthSuffix >= '2026-10';
            const year = now.getUTCFullYear(), month = now.getUTCMonth(), today = now.getUTCDate();
            ownStudents.forEach((s) => {
                const exp = daysElapsedThisMonthFor(s, now);
                expected += exp;
                const marks = Object.entries(presentDays[s.id] || {}).filter(([, v]) => v === 1 || v === true);
                if (!strict) { completed += marks.length; return; }
                const pattern = s.lessonDayOfWeek == null ? [] : expandLessonPatternDays(s.lessonDayOfWeek);
                const n = marks.filter(([d]) => {
                    const day = Number(d);
                    if (!(day >= 1 && day <= today)) return false;
                    const dow = new Date(Date.UTC(year, month, day)).getUTCDay();
                    return pattern.includes(dow === 0 ? 7 : dow);
                }).length;
                completed += Math.min(n, exp);
            });
        }

        const davomatPct = expected > 0 ? Math.min(100, (completed / expected) * 100) : 0;

        // O'zlashtirish: ustozning o'quvchilari ilovada uy vazifasini birinchi
        // urinishda o'rtacha necha foizga bajargani (student_part_results.first_percent).
        // Ilova ma'lumoti yo'q o'quvchilar hisobga olinmaydi; birortasida ham
        // bo'lmasa — ball faqat davomatdan (ustoz jazolanmaydi).
        const learnVals = ownStudents.map(s => learning[s.id]).filter(v => Number.isFinite(v));
        const learnPct = learnVals.length ? learnVals.reduce((a, b) => a + b, 0) / learnVals.length : null;
        const score = expected > 0
            ? (learnPct === null ? davomatPct : davomatPct * 0.6 + learnPct * 0.4)
            : null;
        return { id: t.id, name: t.name, score, davomatPct: Math.round(davomatPct), completed, expected,
            learnPct: learnPct === null ? null : Math.round(learnPct), learnStudents: learnVals.length, students: ownStudents.length };
    }).filter(r => r.score !== null);

    rows.sort((a, b) => b.score - a.score);
    // Ball bir xona aniqlikda (UstozBosh: "79.4", "2-o'ringa 0.6 ball qoldi"). Tartib xom ball bo'yicha — o'zgarmaydi.
    return rows.map((r, i) => ({
        id: r.id, name: r.name, score: Math.round(r.score * 10) / 10, rank: i + 1, total: rows.length,
        davomatPct: r.davomatPct, completed: r.completed, expected: r.expected,
        learnPct: r.learnPct, learnStudents: r.learnStudents, students: r.students
    }));
}

// Shu oy ichida yangilangan uy vazifasi natijalari bo'yicha har o'quvchining
// birinchi urinishdagi o'rtacha foizi: { [studentId]: number }.
// untilMonthEnd=true — faqat shu oy ichidagilar (o'tgan oy reytingi uchun: keyingi oy natijalari kirmaydi).
async function loadLearningByStudent(pool, now = tashkentNow(), { untilMonthEnd = false } = {}) {
    const from = `${monthKeySuffix(now)}-01`;
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const params = untilMonthEnd ? [from, `${monthKeySuffix(next)}-01`] : [from];
    const { rows } = await pool.query(
        `SELECT student_id, AVG(first_percent)::float AS pct
         FROM student_part_results
         WHERE total > 0 AND updated_at >= $1::date${untilMonthEnd ? ' AND updated_at < $2::date' : ''}
         GROUP BY student_id`, params);
    return Object.fromEntries(rows.map(r => [String(r.student_id), Number(r.pct)]).filter(([, v]) => Number.isFinite(v)));
}

// O'tgan oy uchun "now": o'tgan oyning oxirgi kuni 23:59 (tashkentNow kabi — Toshkent vaqti UTC maydonlarida).
// Shu bilan daysElapsedThisMonthFor va "Keldi" filtri butun oyni (oy oxirigacha) sanaydi; joriy oy hisobi o'zgarmaydi.
function prevMonthEnd(now = tashkentNow()) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 0));
}

// Joriy oy qatorlariga o'tgan oydagi o'rin va ball (▲/▼ uchun) — faqat o'rin/ball, xom davomat emas.
// O'tgan oyda reytingda bo'lmagan ustozda prevRank/prevScore = null.
function attachPrevious(rows, prevRows) {
    // O'tgan oyda birorta ham "Keldi" belgisi yo'q ustoz — o'sha oy ma'lumoti kiritilmagan (masalan, davomat
    // tizimga 2026-oktyabrdan kiritila boshlagan). Uni 0 ball deb solishtirsak ▲ butun ballni ko'rsatadi —
    // shuning uchun "ma'lumot yo'q" (prevScore = null, mijozda "—").
    const by = new Map((prevRows || []).filter(r => r.completed > 0).map(r => [r.id, r]));
    return rows.map(r => { const p = by.get(r.id); return { ...r, prevRank: p ? p.rank : null, prevScore: p ? p.score : null }; });
}

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
// Yangi davomat tizimi (faqat o'quvchining dars kunlaridagi "Keldi", ustozlar o'zlari kiritadi) 2026-oktyabrdan.
// Undan oldingi oylar davomati to'liq kiritilmagan — solishtirish (▲/▼) va oy almashtirgichi shu oydan boshlanadi.
const RATING_START = '2026-10';
// Oyning oxirgi kuni 23:59 (Toshkent vaqti UTC maydonlarida) — o'tgan oylar uchun "now".
function monthEnd(key) {
    const [, y, m] = key.match(MONTH_RE);
    return new Date(Date.UTC(Number(y), Number(m), 0, 23, 59, 0));
}
// Davomat qatorlari bor eng birinchi oy (kalitlar: "YYYY-MM_teacherId"). Oy almashtirgichining chap chegarasi.
function firstDataMonth(state, ownType) {
    const store = ownType === 'yordamchi' ? (state.assistantAttendance || {}) : (state.mainAttendance || {});
    const months = Object.keys(store).map(k => k.slice(0, 7)).filter(k => MONTH_RE.test(k) && k >= RATING_START).sort();
    return months[0] || RATING_START;
}

// Admin Reyting sahifasi va ustoz Bosh sahifasi uchun yagona javob.
// month: 'YYYY-MM' (ixtiyoriy, joriy oydan keyingisi bo'lmaydi). loadLearning(now, opts) -> { studentId: pct }.
// Javobda faqat yakuniy (ism, ball, foizlar, o'rin) — xom davomat yo'q.
async function ratingResponse({ state, ownType, month, loadLearning, makeups = [], now = tashkentNow() }) {
    const cur = monthKeySuffix(now);
    const key = month && MONTH_RE.test(month) && month < cur && month >= RATING_START ? month : cur;
    const isPast = key !== cur;
    const at = isPast ? monthEnd(key) : now;
    const learn = async (when, opts) => { try { return await loadLearning(when, opts); } catch (e) { console.error('teacher-rating: o\'zlashtirish yuklanmadi', e.message); return {}; } };
    let current = computeTeacherRating(state, ownType, at, await learn(at, isPast ? { untilMonthEnd: true } : undefined), isPast ? { pastMonth: true, makeups } : { makeups });
    // O'tgan oy tanlanganda: hech kimda "Keldi" bo'lmasa — o'sha oy ma'lumoti yo'q (bo'sh ro'yxat).
    if (isPast && !current.some(r => r.completed > 0)) current = [];
    const prevNow = prevMonthEnd(at);
    let prevRows = [];
    if (monthKeySuffix(prevNow) >= RATING_START) try { prevRows = computeTeacherRating(state, ownType, prevNow, await learn(prevNow, { untilMonthEnd: true }), { pastMonth: true, makeups }); }
    catch (err) { console.error('teacher-rating: o\'tgan oy hisoblanmadi', err.message); }
    return { month: key, currentMonth: cur, prevMonth: monthKeySuffix(prevNow), firstMonth: firstDataMonth(state, ownType),
        ownType, rows: attachPrevious(current, prevRows), formula: { attendance: 0.6, learning: 0.4 } };
}

module.exports = { computeTeacherRating, loadLearningByStudent, expandLessonPatternDays, daysElapsedThisMonthFor, monthKeySuffix, prevMonthEnd, attachPrevious, tashkentNow, ratingResponse, firstDataMonth, RATING_START };
