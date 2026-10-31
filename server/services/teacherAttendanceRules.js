'use strict';
// Ustoz davomati qoidalari (BAHOLASH-MEZONI "Asosiy ustoz davomati", 29-okt):
//  • oy 1-sanada yopiladi: ustoz faqat joriy oy davomatini kiritadi/o'zgartiradi (oktyabr — 31-oktgacha); o'tgan oyni admin tuzatadi;
//  • kelajak sanaga "Keldi/Kelmadi" yo'q; bugun — dars boshlanishidan 15 daqiqa oldindan (dars nazorati MARK_BEFORE bilan bir xil);
//  • o'quvchi kurs boshlagan kundan oldingi kunga yo'q;
//  • o'quvchi o'sha kuni faol bo'lmasa (muzlatilgan / chiqib ketgan — school_student_status, js/attendanceRules.activeOn) — 409;
//    moliya va Davomat % bunday kunni sanamaydi (AttendanceRules.lessonCountsOn) — bitta qoida;
//  • 2026-10 dan asosiy ustoz o'quvchining dars kuni bo'lmagan kunga "Keldi/Kelmadi" qo'ymaydi — qoplash darsi makeups/* orqali.
// Belgini olib tashlash (present=null) faqat oy yopilishi bilan cheklanadi.
const TEACHER_MARK_BEFORE_MIN = 15;
async function assertTeacherAttendanceWindow(client, { student, teacherId, date, present, duty, now = new Date() }) {
    const T = require('./school/time');
    const bad = (status, message) => { throw Object.assign(new Error(message), { status }); };
    const local = T.nowLocal(now), month = date.slice(0, 7);
    if (month < local.date.slice(0, 7)) bad(409, `${month} oyi yopilgan — davomatni endi admin orqali tuzatish mumkin`);
    if (present === null) return;
    if (date > local.date) bad(400, 'Kelajakdagi sanaga davomat qo\'yib bo\'lmaydi');
    if (date === local.date) {
        const start = T.toMin(student.lesson_time);
        if (start != null && local.min < start - TEACHER_MARK_BEFORE_MIN) bad(400, `Dars hali boshlanmagan — davomat ${T.fromMin(Math.max(0, start - TEACHER_MARK_BEFORE_MIN))} dan qo'yiladi`);
    }
    let extra = student.extra_data || {};
    if (typeof extra === 'string') { try { extra = JSON.parse(extra); } catch (_) { extra = {}; } }
    const startDate = String(extra.startDate || extra.joinDate || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate) && date < startDate) bad(400, `O'quvchi kursni ${startDate} dan boshlagan — undan oldingi kunga davomat qo'yilmaydi`);
    // O'sha kuni faolmi: holat yozuvlari bo'yicha (sana), yozuv yo'q bo'lsa — joriy belgilar (muzlatilgan/faol emas).
    const R = require('../../js/attendanceRules');
    const hasStatus = (await client.query("SELECT to_regclass('public.school_student_status')::text AS t")).rows[0]?.t;
    const statusRows = hasStatus ? (await client.query('SELECT * FROM school_student_status WHERE student_id=$1 AND cancelled_at IS NULL', [student.id])).rows : [];
    if (!R.activeOn(student, statusRows, date)) {
        const st = statusRows.length ? R.statusOn(statusRows, date) : (R.isActiveStudent(student) ? 'active' : 'inactive');
        bad(409, st === 'frozen' ? 'O\'sha kuni o\'quvchi muzlatilgan — davomat qo\'yilmaydi' : 'O\'sha kuni o\'quvchi faol emas (chiqib ketgan) — davomat qo\'yilmaydi');
    }
    if (duty === 'main' && month >= '2026-10') {
        const cal = require('../../js/teacherAttendanceCalendar');
        const t = (await client.query("SELECT to_regclass('public.teachers')::text AS t")).rows[0]?.t
            ? (await client.query('SELECT schedule_pattern FROM teachers WHERE id=$1', [teacherId])).rows[0] || {} : {};
        const days = cal.weekdays({ lessonDayOfWeek: student.lesson_day_of_week }, { schedulePattern: t.schedule_pattern }, 'main');
        if (!days.includes(T.weekday(date))) bad(400, 'Bu kun o\'quvchining dars kuni emas — o\'tilgan darsni "Qoplash darsi" orqali kiriting');
    }
}

// Ustozlar tarixi (school_teacher_history, BAHO-5 #6): asosiy ustoz faqat o'quvchi O'ZIGA biriktirilgan davrdagi kunni belgilaydi.
//  • yangi ustoz eski ustoz davridagi kunga — 403 (ilgari students.teacher_id bo'yicha o'tib ketardi va eski ustoz kuniga dars yozilardi);
//  • eski ustoz o'z davridagi kunni (oy yopilmagan bo'lsa — assertTeacherAttendanceWindow) tuzata oladi, o'quvchi hozir boshqa ustozda bo'lsa ham;
//  • tarixda yo'q, hozir ham biriktirilmagan o'quvchi — 403.
// Qaysi kun kimniki — AttendanceRules.taughtOn (maosh, Davomat, Reyting bilan bitta qoida). student — students qatori (teacher_id).
async function assertTeacherOwnsDay(client, { student, teacherId, date }) {
    const R = require('../../js/attendanceRules');
    const deny = message => { throw Object.assign(new Error(message), { status: 403 }); };
    const hasHist = (await client.query("SELECT to_regclass('public.school_teacher_history')::text AS t")).rows[0]?.t;
    const rows = hasHist ? (await client.query(
        `SELECT teacher_id, TO_CHAR(from_date,'YYYY-MM-DD') AS from_date, TO_CHAR(to_date,'YYYY-MM-DD') AS to_date
         FROM school_teacher_history WHERE student_id=$1 ORDER BY from_date, created_at`, [student.id])).rows : [];
    const current = String(student.teacher_id || '');
    const mine = current === teacherId || rows.some(h => h.teacher_id === teacherId);
    if (!mine) deny("Bu o'quvchi ushbu ustozga biriktirilmagan");
    const s = { teacherId: current, teacherHistory: rows.map(h => ({ teacherId: h.teacher_id, from: h.from_date, to: h.to_date || null })) };
    if (R.taughtOn(s, teacherId, date)) return;
    const who = R.teacherOn(s, date);
    const mineFrom = rows.filter(h => h.teacher_id === teacherId).map(h => h.from_date).sort()[0];
    if (current === teacherId && who && who !== teacherId) deny(`${date} kuni o'quvchi boshqa ustozda edi — bu kun uning davomatiga kiradi${mineFrom ? ` (sizda ${mineFrom} dan)` : ''}`);
    deny(`${date} kuni o'quvchi sizga biriktirilmagan edi — davomatni faqat o'z davringizdagi kunlarga qo'yasiz`);
}

// Xodim tuzatishi (BAHO-5 #7): yopilgan oyni va kelajak sanani FAQAT admin/boshliq o'zgartiradi (29-okt qarori).
// ROP (va kelajakda boshqa "to'liq ruxsatli" xodim) — joriy oy, bugungacha: yopilgan oy 409, kelajak 400 (olib tashlash — faqat yopilgan oy cheklovi).
const CLOSED_MONTH_EDITORS = ['admin', 'boshliq'];
function assertStaffAttendanceWindow({ actor, date, present, now = new Date() }) {
    if (CLOSED_MONTH_EDITORS.includes(actor?.role)) return;
    const T = require('./school/time');
    const local = T.nowLocal(now), month = String(date).slice(0, 7);
    const bad = (status, message) => { throw Object.assign(new Error(message), { status }); };
    if (month < local.date.slice(0, 7)) bad(409, `${month} oyi yopilgan — yopilgan oy davomatini faqat admin yoki boshliq o'zgartiradi`);
    if (present !== null && date > local.date) bad(400, 'Kelajakdagi sanaga davomat qo\'yib bo\'lmaydi — faqat admin yoki boshliq');
}

module.exports = { assertTeacherAttendanceWindow, assertTeacherOwnsDay, assertStaffAttendanceWindow, CLOSED_MONTH_EDITORS, TEACHER_MARK_BEFORE_MIN };
