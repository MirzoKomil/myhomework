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
