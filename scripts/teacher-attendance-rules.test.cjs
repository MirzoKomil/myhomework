// Ustoz davomati yozish qoidalari (server/services/teacherAttendanceRules.js) — bazasiz, soxta client bilan.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertTeacherAttendanceWindow: check } = require('../server/services/teacherAttendanceRules');
const client = { query: async sql => (/to_regclass/.test(sql) ? { rows: [{ t: null }] } : { rows: [] }) };
const now = new Date('2026-10-27T12:27:00Z'); // Se 27-okt, 17:27 Toshkent
const sevara = { lesson_day_of_week: 2, lesson_time: '19:30', extra_data: { startDate: '2026-09-01' } }; // Se·Pa·Sh
const jasur = { lesson_day_of_week: 1, lesson_time: '16:30', extra_data: { startDate: '2026-10-02' } }; // Du·Ch·Ju
const run = (student, date, present, extra = {}) => check(client, { student, teacherId: 't', date, present, duty: 'main', now, ...extra });

test('kelajak sanaga Keldi/Kelmadi — 400 (maosh oshmaydi)', async () => {
    await assert.rejects(run(sevara, '2026-10-31', true), e => e.status === 400 && /Kelajak/.test(e.message));
    await assert.rejects(run(sevara, '2026-10-29', false), e => e.status === 400);
});
test('bugun — dars boshlanishidan 15 daqiqa oldin ochiladi', async () => {
    await assert.rejects(run(sevara, '2026-10-27', true), e => e.status === 400 && /19:15/.test(e.message));
    await run({ ...sevara, lesson_time: '17:40' }, '2026-10-27', true); // 17:25 dan ochiq
    await run({ ...sevara, lesson_time: '11:00' }, '2026-10-27', false);
});
test('2026-10 dan dars kuni bo\'lmagan kunga asosiy ustoz belgi qo\'ymaydi (qoplash orqali)', async () => {
    await assert.rejects(run(sevara, '2026-10-21', true), e => e.status === 400 && /dars kuni emas/.test(e.message));
    await run(sevara, '2026-10-24', true); // Sh — dars kuni
    await run(jasur, '2026-10-26', true);  // Du
    // Yordamchi davomati (eski) — dars kuni cheklovi yo'q.
    await run(sevara, '2026-10-21', true, { duty: 'assistant' });
});
test('kurs boshlanishidan oldingi kun — 400', async () => {
    await assert.rejects(run(jasur, '2026-10-01', true), e => e.status === 400 && /2026-10-02/.test(e.message));
});
test('oy yopilgan: o\'tgan oyni ustoz o\'zgartirmaydi (olib tashlash ham) — 409; oktyabr 31-oktgacha ochiq', async () => {
    await assert.rejects(run(sevara, '2026-09-29', false), e => e.status === 409);
    await assert.rejects(run(sevara, '2026-09-29', null), e => e.status === 409);
    await run(sevara, '2026-10-31', null); // belgini olib tashlash joriy oyda — mumkin
    const nov1 = new Date('2026-10-31T19:30:00Z'); // Toshkentda 1-noyabr 00:30
    await assert.rejects(check(client, { student: sevara, teacherId: 't', date: '2026-10-31', present: true, duty: 'main', now: nov1 }), e => e.status === 409);
    await check(client, { student: sevara, teacherId: 't', date: '2026-10-31', present: true, duty: 'main', now: new Date('2026-10-31T15:00:00Z') });
});

// Haftalik reja — bitta ta'rif (Bosh "12 / N", Davomat, Dars jadvali "N tavsiya", "3 tadan kam" bildirishnomasi).
test('AttendanceRules: sana bo\'yicha faol va haftalik tavsiya soni', () => {
    const R = require('../js/attendanceRules');
    const oysha = [{ status: 'frozen', from_date: '2026-09-28', to_date: '2026-10-27' }];
    assert.equal(R.activeOn({ extra_data: { frozen: true } }, oysha, '2026-10-27'), false);
    assert.equal(R.activeOn({ extra_data: { frozen: true } }, oysha, '2026-10-28'), true, 'holat yozuvi sanasi flagdan ustun');
    assert.equal(R.activeOn({ extra_data: { frozen: true } }, [], '2026-10-28'), false, 'yozuv yo\'q — flag');
    assert.equal(R.activeOn({ extra_data: { isStaffDemo: true } }, [], '2026-10-28'), false);
    const items = [{ kind: 'advice', studentId: 'a', date: '2026-10-27' }, { kind: 'contact', studentId: 'a', date: '2026-10-29', advice: true },
        { kind: 'contact', studentId: 'a', date: '2026-10-29', advice: true }, { kind: 'contact', studentId: 'a', date: '2026-10-30', advice: false },
        { kind: 'advice', studentId: 'oys', date: '2026-10-28' }, { kind: 'advice', studentId: 'oys', date: '2026-10-30' }];
    assert.equal(R.weekPlanCount(items), 4);
    assert.equal(R.weekPlanSlots(items).get('a').size, 2);
});

// BAHO-5 #6: ustozlar tarixi — kun o'sha kungi ustozniki (school_teacher_history; AttendanceRules.taughtOn).
const { assertTeacherOwnsDay: owns, assertStaffAttendanceWindow: staffWin } = require('../server/services/teacherAttendanceRules');
const histClient = rows => ({ query: async sql => (/to_regclass/.test(sql) ? { rows: [{ t: 'school_teacher_history' }] } : /school_teacher_history/.test(sql) ? { rows } : { rows: [] }) });
// Temur: 1-sentyabrdan Dilnoza (hr-dil), 15-oktyabrdan Gul (hr-gul) — hozir Gul'da.
const temurHist = [{ teacher_id: 'hr-dil', from_date: '2026-09-01', to_date: '2026-10-14' }, { teacher_id: 'hr-gul', from_date: '2026-10-15', to_date: null }];
const temur = { id: 'st-tem', teacher_id: 'hr-gul' };
test('tarix: yangi ustoz eski ustoz davridagi kunga belgi qo\'ya olmaydi — 403', async () => {
    await assert.rejects(owns(histClient(temurHist), { student: temur, teacherId: 'hr-gul', date: '2026-10-05' }), e => e.status === 403 && /boshqa ustozda edi/.test(e.message) && /2026-10-15/.test(e.message));
    await owns(histClient(temurHist), { student: temur, teacherId: 'hr-gul', date: '2026-10-15' });
    await owns(histClient(temurHist), { student: temur, teacherId: 'hr-gul', date: '2026-10-27' });
});
test('tarix: eski ustoz o\'z davridagi kunni tuzatadi, keyingi davrga — 403', async () => {
    await owns(histClient(temurHist), { student: temur, teacherId: 'hr-dil', date: '2026-10-05' });
    await owns(histClient(temurHist), { student: temur, teacherId: 'hr-dil', date: '2026-10-14' });
    await assert.rejects(owns(histClient(temurHist), { student: temur, teacherId: 'hr-dil', date: '2026-10-16' }), e => e.status === 403 && /biriktirilmagan edi/.test(e.message));
});
test('tarix: hech qachon biriktirilmagan ustoz — 403; tarixsiz hozirgi ustoz — ruxsat', async () => {
    await assert.rejects(owns(histClient(temurHist), { student: temur, teacherId: 'hr-boshqa', date: '2026-10-20' }), e => e.status === 403 && /biriktirilmagan/.test(e.message));
    await owns(histClient([]), { student: { id: 'st-x', teacher_id: 'hr-dil' }, teacherId: 'hr-dil', date: '2026-10-20' });
    await assert.rejects(owns(histClient([]), { student: { id: 'st-x', teacher_id: 'hr-dil' }, teacherId: 'hr-gul', date: '2026-10-20' }), e => e.status === 403);
    // Jadval yo'q (eski baza) — hozirgi biriktirish.
    await owns(client, { student: { id: 'st-x', teacher_id: 'hr-dil' }, teacherId: 'hr-dil', date: '2026-10-20' });
});
// BAHO-5 #7: yopilgan oy va kelajak — faqat admin/boshliq.
test('xodim tuzatishi: ROP yopilgan oyni va kelajakni o\'zgartirmaydi; admin/boshliq — ruxsat', () => {
    const rop = { role: 'rop' };
    assert.throws(() => staffWin({ actor: rop, date: '2026-09-29', present: true, now }), e => e.status === 409 && /admin yoki boshliq/.test(e.message));
    assert.throws(() => staffWin({ actor: rop, date: '2026-09-29', present: null, now }), e => e.status === 409);
    assert.throws(() => staffWin({ actor: rop, date: '2026-10-29', present: true, now }), e => e.status === 400);
    staffWin({ actor: rop, date: '2026-10-29', present: null, now }); // kelajakdagi xato belgini olib tashlash — mumkin
    staffWin({ actor: rop, date: '2026-10-26', present: false, now });
    for (const role of ['admin', 'boshliq']) {
        staffWin({ actor: { role }, date: '2026-09-29', present: true, now });
        staffWin({ actor: { role }, date: '2026-10-29', present: true, now });
    }
});
