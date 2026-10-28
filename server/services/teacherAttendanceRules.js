'use strict';
// Ustoz davomati qoidalari (BAHOLASH-MEZONI "Asosiy ustoz davomati", 29-okt):
//  • oy 1-sanada yopiladi: ustoz faqat joriy oy davomatini kiritadi/o'zgartiradi (oktyabr — 31-oktgacha); o'tgan oyni admin tuzatadi;
//  • kelajak sanaga "Keldi/Kelmadi" yo'q; bugun — dars boshlanishidan 15 daqiqa oldindan (dars nazorati MARK_BEFORE bilan bir xil);
//  • o'quvchi kurs boshlagan kundan oldingi kunga yo'q;
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
    if (duty === 'main' && month >= '2026-10') {
        const cal = require('../../js/teacherAttendanceCalendar');
        const t = (await client.query("SELECT to_regclass('public.teachers')::text AS t")).rows[0]?.t
            ? (await client.query('SELECT schedule_pattern FROM teachers WHERE id=$1', [teacherId])).rows[0] || {} : {};
        const days = cal.weekdays({ lessonDayOfWeek: student.lesson_day_of_week }, { schedulePattern: t.schedule_pattern }, 'main');
        if (!days.includes(T.weekday(date))) bad(400, 'Bu kun o\'quvchining dars kuni emas — o\'tilgan darsni "Qoplash darsi" orqali kiriting (admin tasdiqlaydi)');
    }
}


module.exports = { assertTeacherAttendanceWindow, TEACHER_MARK_BEFORE_MIN };
