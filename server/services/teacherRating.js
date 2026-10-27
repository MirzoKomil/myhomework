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
    if (student.frozen) return 0;
    if (student.status && ['tark-etdi', "to'xtatilgan", 'bekor'].includes(String(student.status))) return 0;
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
function computeTeacherRating(state, ownType, now = tashkentNow(), learning = {}) {
    const monthSuffix = monthKeySuffix(now);
    const typeOf = (t) => (t.type === 'yordamchi' ? 'yordamchi' : 'asosiy');
    const teachers = (state.teachers || []).filter(t => typeOf(t) === ownType);
    const students = state.students || [];
    const attStore = ownType === 'yordamchi' ? (state.assistantAttendance || {}) : (state.mainAttendance || {});

    const rows = teachers.map((t) => {
        const ownStudents = students.filter(s => (ownType === 'yordamchi' ? s.assistantTeacherId : s.teacherId) === t.id);
        let expected = 0;
        ownStudents.forEach((s) => { expected += daysElapsedThisMonthFor(s, now); });

        const attKey = `${monthSuffix}_${t.id}`;
        const presentDays = attStore[attKey] || {};
        let completed = 0;
        // Faqat "Keldi" (1/true) — "Kelmadi" (0) belgilari ham shu obyektda saqlanadi, ular hisoblanmaydi.
        Object.values(presentDays).forEach((daysObj) => { completed += Object.values(daysObj || {}).filter(v => v === 1 || v === true).length; });

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
    return rows.map((r, i) => ({
        id: r.id, name: r.name, score: Math.round(r.score), rank: i + 1, total: rows.length,
        davomatPct: r.davomatPct, completed: r.completed, expected: r.expected,
        learnPct: r.learnPct, learnStudents: r.learnStudents, students: r.students
    }));
}

// Shu oy ichida yangilangan uy vazifasi natijalari bo'yicha har o'quvchining
// birinchi urinishdagi o'rtacha foizi: { [studentId]: number }.
async function loadLearningByStudent(pool, now = tashkentNow()) {
    const from = `${monthKeySuffix(now)}-01`;
    const { rows } = await pool.query(
        `SELECT student_id, AVG(first_percent)::float AS pct
         FROM student_part_results
         WHERE total > 0 AND updated_at >= $1::date
         GROUP BY student_id`, [from]);
    return Object.fromEntries(rows.map(r => [String(r.student_id), Number(r.pct)]).filter(([, v]) => Number.isFinite(v)));
}

module.exports = { computeTeacherRating, loadLearningByStudent, expandLessonPatternDays, daysElapsedThisMonthFor, monthKeySuffix };
