const roles = require('../../js/teacherRoles');
const error = (status, message) => Object.assign(new Error(message), { status });
const ASSISTANT_ONLY = 'Asosiy ustoz yordamchi ustoz bo‘la olmaydi — yordamchi lavozimidagi xodimni tanlang';
// Yordamchi vazifasi (aloqalar, "yordamchi sifatida" o'quvchilar) faqat yordamchi lavozimida.
// Asosiy ustozga eski biriktirish qolgan bo'lsa ham u ko'rinmaydi (admin "Yordamchi kerak" ro'yxatida ko'radi).
const hasAssistantDuty = own => roles.isAssistant(own);
async function initSchema(db) {
    await db.query('ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS dual_role BOOLEAN NOT NULL DEFAULT FALSE');
}
function employee(row) {
    return { id: row.id, name: row.name, role: row.role, lang: row.lang,
        status: row.status, dualRole: row.dual_role === true };
}
async function teacherForActor(db, actor) {
    if (actor?.role !== 'teacher') throw error(403, 'Ustoz kabinetiga ruxsat yo‘q');
    const { rows } = await db.query(`SELECT he.* FROM users u JOIN hr_employees he
        ON LOWER(TRIM(he.login)) = LOWER(TRIM(u.email))
        WHERE u.id=$1 AND u.role='teacher'
          AND he.role IN ('oqituvchi','ingliz-oqituvchi','rus-oqituvchi','yordamchi')
          AND COALESCE(he.status,'active') <> 'inactive'`, [actor.id]);
    if (rows.length !== 1) throw error(403, 'Ustoz akkaunti bitta faol HR profiliga biriktirilishi kerak');
    return employee(rows[0]);
}
async function validateAssignment(db, student, before = {}) {
    before ||= {};
    if (roles.conflict(student.teacherId, student.assistantTeacherId)) {
        throw error(400, 'Bitta o‘quvchiga bir shaxs asosiy va yordamchi ustoz bo‘la olmaydi');
    }
    // Turning the switch off removes the employee from future assignments, not
    // existing students, attendance or earned salary. Unchanged legacy IDs survive.
    if (!student.assistantTeacherId) return;
    const existingDuty = student.assistantTeacherId === before.assistantTeacherId
        && (student.subject || 'english') === (before.subject || 'english');
    if (existingDuty && student.teacherId === before.teacherId) return;
    const { rows } = await db.query('SELECT * FROM hr_employees WHERE id=$1 FOR SHARE', [student.assistantTeacherId]);
    // 29-okt: yordamchi faqat yordamchi lavozimidagi xodim. Eski (o'zgarmagan) biriktirish saqlashni
    // buzmaydi — /api/state butun ro'yxatni qayta yuboradi; yangi biriktirish esa tekshiriladi.
    if (!existingDuty && rows.length === 1 && roles.isMain(employee(rows[0]))) {
        throw error(400, ASSISTANT_ONLY);
    }
    if (!existingDuty && (rows.length !== 1 || !roles.eligible(employee(rows[0]), 'yordamchi', student.subject || 'english'))) {
        throw error(400, 'Yordamchi ustoz faol, shu tilga mos va HR ro‘yxatida yordamchi lavozimida bo‘lishi kerak');
    }
    if (student.teacherId && rows[0]?.login) {
        const main = (await db.query('SELECT login FROM hr_employees WHERE id=$1 FOR SHARE', [student.teacherId])).rows[0];
        if (main?.login?.trim().toLowerCase() === rows[0].login.trim().toLowerCase()) {
            throw error(400, 'Bitta akkaunt asosiy va yordamchi ustoz sifatida biriktirilmaydi');
        }
    }
}
function stateForTeacher(state, own) {
    const mainIds = new Set(state.students.filter(s => s.teacherId === own.id).map(s => s.id));
    const assistantIds = new Set(hasAssistantDuty(own) ? state.students.filter(s => s.assistantTeacherId === own.id).map(s => s.id) : []);
    const assignedIds = new Set([...mainIds, ...assistantIds]);
    const safeFields = ['id','name','phone','phone2','group','subject','teacherId','assistantTeacherId',
        'lessonDayOfWeek','lessonTime','lessonDuration','startDate','joinDate','status','frozen','age','gender','serialCode',
        // statusHistory — [{status, from, to, at}] (sabab/izohsiz): Davomat % sana bo'yicha faollik (AttendanceRules.lessonCountsOn).
        'statusHistory'];
    // Telefon faqat asosiy ustozga o'z o'quvchisi uchun (JadvalQoidalar: "Telefon raqamini ko'rish — Ustoz ✓, Yordamchi:
    // yashirin · ☎ tugmasi"). Yordamchiga o'quvchi telefoni yuborilmaydi — qo'ng'iroq Telegram guruh orqali.
    // serialCode (#ID) — ustoz/yordamchi ro'yxatida ko'rinadi va ID bo'yicha qidiriladi (to'lov ma'lumoti emas).
    const PHONE_FIELDS = new Set(['phone', 'phone2']);
    const students = state.students.filter(s => assignedIds.has(s.id)).map(s =>
        Object.fromEntries(safeFields.filter(key => s[key] !== undefined && !(PHONE_FIELDS.has(key) && !mainIds.has(s.id))).map(key => [key, s[key]])));
    const teacherIds = new Set([own.id, ...students.map(s => s.teacherId), ...students.map(s => s.assistantTeacherId)]);
    const teachers = state.teachers.filter(t => teacherIds.has(t.id)).map(t => t.id === own.id ? t
        : { id: t.id, name: t.name, type: t.type, subject: t.subject });
    for (const e of state.hrEmployees.filter(e => teacherIds.has(e.id) && !teachers.some(t => t.id === e.id))) {
        teachers.push({ id: e.id, name: e.name, type: e.role === 'yordamchi' ? 'yordamchi' : 'asosiy', subject: roles.language(e) });
    }
    // Yordamchi — o'z o'quvchilarining asosiy ustozi bilan bog'lanishi uchun hamkasb Telegram'i ("Asosiy ustozga yozish";
    // telefon emas). Faqat yordamchi vazifasi bo'lgan xodimga va faqat o'z o'quvchilarining asosiy ustozlari. Telegram — db.getTeacherScopedState.
    const mainOfMine = new Set(students.filter(s => assistantIds.has(s.id)).map(s => s.teacherId).filter(id => id && id !== own.id));
    for (const t of teachers) if (mainOfMine.has(t.id)) t.colleagueContact = { telegram: '' };
    // Maosh sozlamalaridan faqat o'ziga kerakli qism: asosiy ustozga — ustoz tariflari, yordamchiga — yordamchi tarifi (o'z tilida).
    const lang = roles.language(own), rates = state.payrollRates?.[lang] || {};
    const payrollRates = { [lang]: { ...(roles.isMain(own) && rates.teacher ? { teacher: rates.teacher } : {}),
        ...(hasAssistantDuty(own) && rates.assistant ? { assistant: rates.assistant } : {}) } };
    const attendance = (store, ids) => Object.fromEntries(Object.entries(store || {})
        .filter(([key]) => key.slice(8) === own.id).map(([key, rows]) => [key,
            Object.fromEntries(Object.entries(rows).filter(([id]) => ids.has(id)))]));
    const grades = Object.fromEntries(Object.entries(state.liveGrades || {}).filter(([id]) => mainIds.has(id))
        .map(([id, entries]) => [id, entries.filter(g => g.teacherId === own.id)]));
    // Whitelist, not blacklist: no finance, credentials, colleagues' HR or grades.
    return { teachers, students, hrEmployees: state.hrEmployees.filter(e => e.id === own.id),
        mainAttendance: attendance(state.mainAttendance, mainIds),
        assistantAttendance: attendance(state.assistantAttendance, assistantIds), liveGrades: grades,
        leads: { english: [], russian: [] }, archive: [], payments: [], cashFlow: [],
        salesManagers: [], timetable: {}, bookRoadmap: [], bonusHistory: [], bonusData: {}, salesPlan: {},
        mobileContent: state.mobileContent, payrollRates,
        studentMessages: Object.fromEntries(Object.entries(state.studentMessages || {}).filter(([id]) => assignedIds.has(id))
            .map(([id, threads]) => [id, Object.fromEntries(Object.entries(threads || {}).filter(([slot]) =>
                (slot === 'main-teacher' && mainIds.has(id)) || (slot === 'assistant-teacher' && assistantIds.has(id))))])),
        peerMessages: {}, studentActivity: {}, shopOrders: [], demoStudentId: '', guides: state.guides || [],
        teacherDuty: { teacherId: own.id, language: roles.language(own), isMain: roles.isMain(own),
            hasAssistantStudents: assistantIds.size > 0, dualRole: false } };
}
async function recordAssistantAttendance(db, { actor, teacherId, studentId, date, present }) {
    const month = date.slice(0, 7), key = `${month}_${teacherId}`, day = Number(date.slice(8));
    const previous = (await db.query('SELECT day,present FROM assistant_attendance WHERE att_key=$1 AND student_id=$2', [key, studentId])).rows;
    const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
    const config = (await db.query('SELECT data FROM salary_kpi_settings WHERE language=(SELECT subject FROM students WHERE id=$1)', [studentId])).rows[0]?.data;
    const limit = config?.assistant?.maxLessons || 0;
    const cap = limit > 0 ? Math.min(Math.round(days * 3 / 7), limit) : Math.round(days * 3 / 7);
    if (present && !previous.some(r => r.day === day && r.present === 1)
        && previous.filter(r => r.present === 1).length >= cap) throw error(400, 'Yordamchi davomatning oylik dars chegarasi to‘lgan');
    if (present === null) {
        await db.query('DELETE FROM assistant_attendance WHERE att_key=$1 AND student_id=$2 AND day=$3', [key, studentId, day]);
    } else {
        await db.query(`INSERT INTO assistant_attendance(att_key,student_id,day,present) VALUES($1,$2,$3,$4)
            ON CONFLICT(att_key,student_id,day) DO UPDATE SET present=EXCLUDED.present`, [key, studentId, day, present ? 1 : 0]);
    }
    await require('./payroll').audit(db, actor, 'assistant-attendance', `${key}:${studentId}:${day}`,
        { present: previous.find(r => r.day === day)?.present ?? null }, { present: present === null ? null : present ? 1 : 0 });
    return { attendanceKey: key, attendanceType: 'assistant', teacherId, studentId, date, day, present, grade: null };
}
module.exports = { initSchema, employee, teacherForActor, validateAssignment, stateForTeacher, recordAssistantAttendance, hasAssistantDuty, ASSISTANT_ONLY };
