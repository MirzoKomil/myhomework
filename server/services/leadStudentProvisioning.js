const bcrypt = require('bcryptjs');
const access = require('../../js/studentAccess');

const STUDENT_PROVISION_LOCK = "SELECT pg_advisory_xact_lock(hashtext('lead-student-provisioning'))";
function toStudent(row) {
    return { ...(row.extra_data || {}), id: row.id, name: row.name, phone: row.phone,
        subject: row.subject, group: row.group_name, teacherId: row.teacher_id,
        assistantTeacherId: row.assistant_teacher_id, lessonDayOfWeek: row.lesson_day_of_week,
        lessonTime: row.lesson_time, lessonDuration: row.lesson_duration };
}

function safeStudent(student) {
    const { password, passwordHash, ...safe } = student;
    return { ...safe, hasPassword: !!passwordHash };
}

async function provisionLeadStudent(client, lead) {
    if (!access.PAYMENT_STAGES.has(lead.status)) return null;
    const login = access.phoneLogin(lead.phone);
    if (!login) throw new Error('Platformaga ulash uchun lidning to‘liq telefon raqamini kiriting.');
    await client.query(STUDENT_PROVISION_LOCK);
    const { rows } = await client.query('SELECT * FROM students ORDER BY id FOR UPDATE');
    const students = rows.map(toStudent);
    const lang = lead.language === 'russian' ? 'russian' : 'english';
    const existing = access.findStudentForLead(students, lead, lang);
    if (existing && existing.subject !== lang) {
        throw new Error('Bog‘langan o‘quvchining kurs tili lidnikidan farq qiladi. Admin tekshirishi kerak.');
    }
    const result = await client.query('SELECT data FROM mobile_content WHERE singleton = 1');
    const courses = result.rows[0]?.data?.courses || [];
    const student = access.buildStudentForLead(lead, lang, existing, courses, new Date().toISOString().slice(0, 10));
    await require('./teacherDuties').validateAssignment(client, student, existing);
    if (!existing && students.some(s => s.id === student.id)) {
        throw new Error('O‘quvchi IDsi band. Admin bog‘langan lidni tekshirishi kerak.');
    }
    if (!access.courseForStudent(student, courses)) {
        throw new Error(`${lang === 'russian' ? 'Rus' : 'Ingliz'} tili platformasida kurs mavjud emas. Avval kurs yarating.`);
    }
    const collision = students.some(s => s.id !== student.id && s.login && access.loginKey(s.login) === access.loginKey(student.login));
    if (collision) throw new Error('Bu telefon boshqa o‘quvchi loginiga biriktirilgan. Admin dublikatni tekshirishi kerak.');
    const credentialsCreated = !student.passwordHash && !student.password;
    if (!student.passwordHash) student.passwordHash = bcrypt.hashSync(
        student.password || login.replace(/\D/g, '').slice(-4), 10);
    const { id, name, phone, group, subject, teacherId, assistantTeacherId, lessonDayOfWeek,
        lessonTime, lessonDuration, password, hasPassword, ...extra } = student;
    await client.query(`INSERT INTO students
        (id, name, phone, group_name, subject, teacher_id, assistant_teacher_id, lesson_day_of_week, lesson_time, lesson_duration, extra_data)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, phone=EXCLUDED.phone, group_name=EXCLUDED.group_name,
        subject=EXCLUDED.subject, teacher_id=EXCLUDED.teacher_id, assistant_teacher_id=EXCLUDED.assistant_teacher_id,
        lesson_day_of_week=EXCLUDED.lesson_day_of_week, lesson_time=EXCLUDED.lesson_time,
        lesson_duration=EXCLUDED.lesson_duration, extra_data=EXCLUDED.extra_data`,
    [id, name, phone, group, subject, teacherId, assistantTeacherId, lessonDayOfWeek, lessonTime, lessonDuration, JSON.stringify(extra)]);
    return { student: safeStudent(student), credentialsCreated };
}

module.exports = { provisionLeadStudent, STUDENT_PROVISION_LOCK };
