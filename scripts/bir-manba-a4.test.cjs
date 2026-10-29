// BAHO-4 "bir manba" tuzatishlari: Davomat %, belgilanmagan, tekshiruvda, reja va maosh — bitta formula
// (js/attendanceRules.js monthTotals + js/payrollEngine.js), ustozlar tarixi, bugungi boshlanmagan dars,
// tasdiqlab bo'lmaydigan qoplash (missed_came), yordamchi oylik rejasi, bildirishnoma manbalari, maxfiylik.
process.env.TZ = 'UTC';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../js/attendanceRules');
const engine = require('../js/payrollEngine');
const { computeTeacherRating } = require('../server/services/teacherRating');
const duties = require('../server/services/teacherDuties');
const trial = require('../server/services/trialLessons');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

// Oktyabr 2026: 1-okt payshanba. Du·Ch·Ju (1) — 2,5,7,9,12,14,16,19,21,23,26,28,30 (13); Se·Pa·Sh (2) — 14 kun.
const TODAY = '2026-10-27'; // seshanba
const base = { lessonDuration: 60, startDate: '2026-10-01', status: 'active' };

test('monthTotals: bugungi dars tugamaguncha "o\'tgan" ham, "belgilanmagan" ham emas; belgi qo\'yilsa yoki tugasa — o\'tgan', () => {
    const s = { ...base, id: 'a', teacherId: 't1', lessonDayOfWeek: 2, lessonTime: '18:00' };
    const args = { id: 't1', month: '2026-10', students: [s], mainAtt: {}, makeups: [], teacher: {}, todayKey: TODAY };
    const before = R.monthTotals({ ...args, nowMin: 17 * 60 + 27 });
    const during = R.monthTotals({ ...args, nowMin: 18 * 60 + 30 }); // dars davom etmoqda (60 daq)
    assert.equal(during.expected, 11); assert.equal(during.unmarked, 11);
    const after = R.monthTotals({ ...args, nowMin: 19 * 60 });
    assert.equal(before.expected, 11); // 1..24-okt Se·Pa·Sh = 11, 27-okt 18:00 hali boshlanmagan
    assert.equal(before.unmarked, 11);
    assert.equal(after.expected, 12);
    assert.equal(after.unmarked, 12);
    assert.deepEqual(after.rows[0].unmarkedDates.slice(-1), [TODAY]);
    // Davomat ochilgan (−15 daq) oynada "Keldi" qo'yildi — o'tgan va hisobga o'tgan.
    const marked = R.monthTotals({ ...args, mainAtt: { a: { 27: 1 } }, nowMin: 17 * 60 + 50 });
    assert.equal(marked.expected, 12); assert.equal(marked.came, 1); assert.equal(marked.counted, 1); assert.equal(marked.unmarked, 11);
    assert.equal(before.plan, 14);
});

test('monthTotals + payrollEngine: ustoz almashsa (school_teacher_history) dars o\'tgan ustozda — Davomat, Reyting va maosh bir xil', () => {
    const hist = [{ teacherId: 'old', from: '2026-09-01', to: '2026-10-14' }, { teacherId: 'new', from: '2026-10-15', to: null }];
    const s = { ...base, id: 'tem', teacherId: 'new', lessonDayOfWeek: 1, lessonTime: '18:00', startDate: '2026-09-01', teacherHistory: hist };
    const mainAtt = { old: { tem: { 2: 1, 5: 1, 7: 1, 9: 1, 12: 1, 14: 1 } }, new: { tem: { 16: 1, 19: 1, 21: 1 } } };
    const oldT = R.monthTotals({ id: 'old', month: '2026-10', students: R.withPast([], [s], 'old', '2026-10'), mainAtt: mainAtt.old, makeups: [], teacher: {}, todayKey: TODAY, nowMin: 600 });
    const newT = R.monthTotals({ id: 'new', month: '2026-10', students: [s], mainAtt: mainAtt.new, makeups: [], teacher: {}, todayKey: TODAY, nowMin: 600 });
    assert.equal(oldT.plan, 6); assert.equal(oldT.expected, 6); assert.equal(oldT.counted, 6); assert.equal(oldT.unmarked, 0);
    assert.equal(oldT.rows[0].past, true);
    // Yangi ustoz: 15-oktdan — 16,19,21,23,26 o'tgan (5), 3 keldi, 2 belgilanmagan; 2–14-okt unga "belgilanmagan" emas.
    assert.equal(newT.plan, 7); assert.equal(newT.expected, 5); assert.equal(newT.counted, 3); assert.equal(newT.unmarked, 2);
    // Maosh: payrollEngine o'sha tarix bilan — har ustozga o'z darslari, "Rejada" = shu ustoz davri.
    const source = { students: [{ id: 'tem', name: 'Temur', teacherId: 'new', lessonDayOfWeek: 1, lessonDuration: 60, subject: 'english', startDate: '2026-09-01' }],
        teachers: [], mainAttendance: { '2026-10_old': mainAtt.old, '2026-10_new': mainAtt.new }, makeups: [],
        makeupPolicy: 'approved-v1', makeupPolicyFrom: '2026-10', teacherHistory: hist.map(h => ({ studentId: 'tem', teacherId: h.teacherId, fromDate: h.from })) };
    const settings = engine.defaults(), p = engine.period('2026-10-01', '2026-10-31');
    const pOld = engine.teacherPay({ id: 'old', role: 'ingliz-oqituvchi' }, source, p, settings);
    const pNew = engine.teacherPay({ id: 'new', role: 'ingliz-oqituvchi' }, source, p, settings);
    assert.equal(pOld.lessons, oldT.counted); assert.equal(pNew.lessons, newT.counted);
    assert.equal(pOld.breakdown[0].plan, oldT.plan); assert.equal(pNew.breakdown[0].plan, newT.plan);
    assert.equal(pOld.breakdown[0].expected, 13); // maosh bo'luvchisi — o'quvchining oydagi darslari (o'zgarmaydi)
    // Server reytingi — xuddi shu tarix bilan.
    const state = { teachers: [{ id: 'old', name: 'Old' }, { id: 'new', name: 'New' }], students: [source.students[0]], mainAttendance: source.mainAttendance };
    const rows = computeTeacherRating(state, 'asosiy', new Date(Date.UTC(2026, 9, 27, 10, 0)), {}, { teacherHistory: source.teacherHistory });
    const by = Object.fromEntries(rows.map(r => [r.id, r]));
    assert.equal(by.old.completed, 6); assert.equal(by.old.expected, 6);
    assert.equal(by.new.completed, 3); assert.equal(by.new.expected, 5);
});

test('missed_came qoplash: "tekshiruvda" ham, "qoplandi" ham emas; reviewMakeups — Bosh, Davomat, Maosh uchun bitta ta\'rif', () => {
    const s = { ...base, id: 'b', teacherId: 't1', lessonDayOfWeek: 2, lessonTime: '11:00' };
    const mainAtt = { b: { 15: 1, 22: 1, 6: 0 } };
    const makeups = [
        { id: 'm1', teacher_id: 't1', student_id: 'b', kind: 'separate', status: 'review', missed_date: '2026-10-15', held_date: '2026-10-30', missed_came: true },
        { id: 'm2', teacher_id: 't1', student_id: 'b', kind: 'separate', status: 'approved', missed_date: '2026-10-22', held_date: '2026-10-23' },
        { id: 'm3', teacher_id: 't1', student_id: 'b', kind: 'separate', status: 'review', missed_date: '2026-10-06', held_date: '2026-10-07' }];
    const t = R.monthTotals({ id: 't1', month: '2026-10', students: [s], mainAtt, makeups, teacher: {}, todayKey: TODAY, nowMin: 720 });
    assert.equal(t.review, 1); assert.equal(t.approved, 0); assert.equal(t.counted, 2);
    assert.deepEqual(t.rows[0].noPay.map(m => m.id).sort(), ['m1', 'm2']);
    assert.equal(t.rows[0].coveredReview, 1); assert.equal(t.rows[0].covered, 0);
    assert.deepEqual(R.reviewMakeups(makeups, { id: 't1', month: '2026-10', mainAtt }).map(m => m.id), ['m3']);
});

test('monthTotals qatori: kelmagan kun "qoplandi" (tasdiqlangan) / "tekshiruvda" / "rejada" / ochiq — rejadagi qoplash "qoplandi" emas', () => {
    const s = { ...base, id: 'm', teacherId: 't1', lessonDayOfWeek: 2, lessonTime: '10:00' };
    const mainAtt = { m: { 6: 0, 13: 0, 15: 0, 17: 0, 24: 0, 1: 1 } };
    const mk = (id, status, missed, held) => ({ id, teacher_id: 't1', student_id: 'm', kind: 'separate', status, missed_date: missed, held_date: held });
    const t = R.monthTotals({ id: 't1', month: '2026-10', students: [s], mainAtt, teacher: {}, todayKey: TODAY, nowMin: 720,
        makeups: [mk('a', 'approved', '2026-10-06', '2026-10-07'), mk('b', 'approved', '2026-10-15', '2026-10-16'), mk('c', 'review', '2026-10-24', '2026-10-26'), mk('d', 'planned', '2026-10-13', '2026-10-28')] });
    const r = t.rows[0];
    assert.equal(r.absent, 5); assert.equal(r.covered, 2); assert.equal(r.coveredReview, 1); assert.equal(r.coveredPlanned, 1);
    assert.deepEqual(r.openMissed, ['2026-10-17']);
    assert.equal(r.counted, 3); assert.equal(r.review, 1);
});

test('stateForTeacher: o\'tgan o\'quvchi — telefonsiz, faqat o\'z blokidagi belgilar; hozirgilariga ustozlar tarixi', () => {
    const state = { students: [
        { id: 'tem', name: 'Temur', phone: '+998901', teacherId: 'gul', lessonDayOfWeek: 1, lessonTime: '18:00', status: 'active' },
        { id: 'mad', name: 'Madina', phone: '+998902', teacherId: 'dil', lessonDayOfWeek: 2, lessonTime: '10:00', status: 'active' },
        { id: 'x', name: 'Begona', phone: '+998903', teacherId: 'gul', lessonDayOfWeek: 1, lessonTime: '9:00', status: 'active' }],
        teachers: [{ id: 'dil', name: 'Dilnoza', type: 'asosiy' }, { id: 'gul', name: 'Gulnora Tursunova', type: 'asosiy' }],
        hrEmployees: [{ id: 'dil', name: 'Dilnoza', role: 'ingliz-oqituvchi' }, { id: 'gul', name: 'Gulnora Tursunova', role: 'ingliz-oqituvchi' }],
        mainAttendance: { '2026-10_dil': { tem: { 2: 1 }, mad: { 1: 1 }, x: { 3: 1 } }, '2026-10_gul': { tem: { 16: 1 }, x: { 5: 1 } } },
        assistantAttendance: {}, liveGrades: {}, payrollRates: {} };
    const teacherHistory = [{ student_id: 'tem', teacher_id: 'dil', from_date: '2026-09-01', to_date: '2026-10-14' }, { student_id: 'tem', teacher_id: 'gul', from_date: '2026-10-15', to_date: null }];
    const out = duties.stateForTeacher(state, { id: 'dil', role: 'ingliz-oqituvchi' }, { teacherHistory, today: TODAY });
    assert.deepEqual(out.students.map(s => s.id), ['mad']);
    assert.equal(out.pastStudents.length, 1);
    const p = out.pastStudents[0];
    assert.equal(p.id, 'tem'); assert.equal(p.past, true); assert.equal(p.phone, undefined);
    assert.deepEqual(p.teacherHistory.map(h => h.teacherId), ['dil', 'gul']);
    assert.deepEqual(Object.keys(out.mainAttendance), ['2026-10_dil']);
    assert.deepEqual(Object.keys(out.mainAttendance['2026-10_dil']).sort(), ['mad', 'tem']);
    // Yangi ustoz (Gulnora): Temur hozirgi o'quvchi — tarix bilan, o'tgan o'quvchi yo'q.
    const g = duties.stateForTeacher(state, { id: 'gul', role: 'ingliz-oqituvchi' }, { teacherHistory, today: TODAY });
    assert.deepEqual(g.pastStudents, []);
    assert.equal(g.students.find(s => s.id === 'tem').teacherHistory.length, 2);
    assert.equal(g.students.find(s => s.id === 'mad'), undefined);
});

test('yordamchi oylik rejasi: oy davomida faol — 13; muzlatishdan oy ichida qaytgan — faqat faol kunlardagi tavsiyalar', () => {
    const adv = [2, 4, 6]; // Du·Ch·Ju o'quvchisi uchun Se·Pa·Sh
    assert.equal(R.assistMonthPlan({ status: 'active' }, [], '2026-10', adv, 13), 13);
    const oysha = [{ status: 'frozen', from_date: '2026-09-28', to_date: '2026-10-27' }];
    assert.equal(R.assistMonthPlan({ frozen: true, status: 'active' }, oysha, '2026-10', adv, 13), 2); // 29 va 31-okt
    const bahrom = [{ status: 'left', from_date: '2026-10-13' }, { status: 'restored', from_date: '2026-11-04' }];
    assert.equal(R.assistMonthPlan({ status: 'inactive' }, bahrom, '2026-11', [1, 3, 5], 13), 12);
    assert.equal(R.assistMonthPlan({ status: 'inactive' }, [{ status: 'left', from_date: '2026-09-30' }], '2026-10', adv, 13), 0);
});

test('UI va server bir manbaga ulangan: O\'quvchilar ro\'yxati, Bosh "Bajarish kerak", sidebar, karta, Maosh, Jadval', () => {
    const y = read('js/yordamchi.js'), h = read('js/ustozHome.js'), nb = read('js/staffNavBadges.js'), ui = read('js/schoolUI.js'), du = read('js/teacherDutyUI.js');
    assert.match(y, /const MT = AttendanceRules\.monthTotals\(/);
    assert.doesNotMatch(y, /\['approved', 'planned'\]\.includes\(cov\.get/); // eski "rejadagi = qoplandi"
    assert.match(y, /monthPlanOf\(s, month, rep\.cap \|\| CAP\)|planM\(s\)/);
    assert.match(h, /function unmarkedPast\(user, m\) \{[\s\S]*?monthCalc\(tid, m\)/);
    assert.doesNotMatch(h, /d < todayDay && marks\[d\] !== 1/);
    assert.match(nb, /withPast/);
    assert.match(du, /const rowOf = new Map\(\(T\?\.rows/);
    assert.match(ui, /R\.missedCame\(/);
    const ss = read('server/services/staffSettings.js');
    assert.match(ss, /status='review'[\s\S]{0,200}NOT EXISTS \(SELECT 1 FROM main_attendance/);
    assert.match(ss, /hasPlan \? Number\(b\.plan\)/);
    const sch = read('server/services/school/schedule.js');
    assert.match(sch, /m\.lesson_date <= \$6::date/);
    assert.match(sch, /EXTRACT\(ISODOW FROM m\.lesson_date\)/);
    const as = read('server/services/school/assist.js');
    assert.match(as, /R\.isActiveStudent\(r\) \|\| left\.has\(r\.id\)/);
    assert.match(read('server/db.js'), /if \(teacherHistory\.has\(r\.id\)\) st\.teacherHistory = teacherHistory\.get\(r\.id\)/);
    assert.match(read('server/db.js'), /delete extra\.teacherHistory;/);
});

test('bildirishnomalar: "ilovada faol emas" va "yangi o\'quvchi biriktirildi" manbaga ulangan (tez orada emas)', () => {
    const n = read('server/services/staffNotify.js');
    assert.match(n, /\['student_inactive', [^\]]*\], true\]/);
    assert.match(n, /\['student_assigned', [^\]]*\], true\]/);
    assert.match(n, /type: 'student_inactive'/);
    assert.match(n, /type: 'student_assigned'/);
    assert.match(read('server/db.js'), /auditAssistantAssign\(client, s\.id, prevAsst, s\.assistantTeacherId\)/);
});

test('Doska: bir o\'quvchiga bir kunda bitta yorliq; kech so\'rov oynasi sana chegarasi server qoidasi bilan bir xil', () => {
    const wb = read('js/whiteboard.js'), y = read('js/yordamchi.js');
    assert.match(wb, /const byStudent = new Map\(\);[\s\S]*?const uniq = \[\.\.\.byStudent\.values\(\)\]/);
    assert.match(y, /let monthStart = prevMonth \+ '-01';/);
    assert.match(y, /\/assist\/month\?month=\$\{prevMonth\}[\s\S]{0,120}final_at/);
    assert.match(read('server/routes/school.js'), /T\.addDays\(today\.slice\(0, 7\) \+ '-01', -1\)\.slice\(0, 7\)/);
});

test('GET /api/trial-lessons: ustozga lid telefoni berilmaydi', () => {
    const lead = { id: 'l1', name: 'Lid', phone: '+998900000000', language: 'english', trialRequest: { id: 'r', teacherId: 't', scheduledAt: '2026-10-28T10:00:00Z', state: 'pending' }, comments: [] };
    const out = trial.summary(lead, { id: 't', name: 'Ustoz' });
    assert.equal(out.phone, undefined);
    assert.equal(out.name, 'Lid');
});
