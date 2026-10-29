// Paket A (admin dizayn): xodim demo akkauntlari maoshga/o'quvchi soniga kirmaydi; maosh bitta manbadan.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../js/payrollEngine');
const oct = engine.period('2026-10-01', '2026-10-31');
const employee = (id, role, extra = {}) => ({ id, name: id, role, lang: 'english', startDate: '2026-09-01', ...extra });
const source = extra => ({ hrEmployees: [], teachers: [], students: [], leads: { english: [], russian: [] }, mainAttendance: {}, assistantAttendance: {},
  bonusHistory: [], bonusData: {}, cashFlow: [], salesPlan: {}, ...extra });
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('isStaffDemo o\'quvchi ustoz maoshi va o\'quvchi soniga kirmaydi (davomati bo\'lsa ham)', () => {
  const days = engine.expectedDays('2026-10', 'mwf');
  const att = Object.fromEntries(days.map(d => [d, 1]));
  const s = source({ hrEmployees: [employee('t', 'ingliz-oqituvchi')], teachers: [{ id: 't', schedulePattern: 'mwf' }],
    students: [{ id: 's1', name: 'Real', subject: 'english', teacherId: 't', lessonDuration: 60 },
      { id: 'demo_t', name: 'DEMO', subject: 'english', teacherId: 't', lessonDuration: 60, isStaffDemo: true, demoForEmployeeId: 't' }],
    mainAttendance: { '2026-10_t': { s1: att, demo_t: att } } });
  const row = engine.calculate(s, engine.defaults(), oct, 'english').rows[0];
  assert.equal(row.studentCount, 1);
  assert.equal(row.total, 300000);
  assert.ok(!row.breakdown.some(b => b.studentId === 'demo_t'));
});

test('isStaffDemo o\'quvchi yordamchi maoshiga ham kirmaydi', () => {
  const s = source({ hrEmployees: [employee('a', 'yordamchi')], teachers: [{ id: 'a' }],
    students: [{ id: 's', subject: 'english', assistantTeacherId: 'a' }, { id: 'demo_a', subject: 'english', assistantTeacherId: 'a', isStaffDemo: true }],
    assistantAttendance: { '2026-10_a': { s: { 1: true }, demo_a: { 1: true } } } });
  const row = engine.calculate(s, engine.defaults(), oct, 'english').rows[0];
  assert.equal(row.studentCount, 1);
});

test('O\'quvchini tekshirish va Akademik → Davomat maoshni brauzerda hisoblamaydi (faqat /api/payroll/preview)', () => {
  const chk = read('js/schoolCheck.js'), nz = read('js/adminNazorat.js');
  assert.ok(!/calculateKpiSalary\s*\(/.test(chk), 'schoolCheck calculateKpiSalary chaqirmasin');
  assert.match(chk, /adminNazorat\.loadPayroll|N\.loadPayroll/);
  // Davomat sahifasi: maosh faqat moliya qatoridan (payKpi), xatoda LoadErr — local KPI'ga o'tib ketmaydi.
  const html = nz.slice(nz.indexOf('function davomatHtml'), nz.indexOf('function cellHtml'));
  assert.ok(!/kpiFor\(/.test(html), 'davomatHtml local KPI ishlatmasin');
  assert.match(html, /payErr/);
  const render = nz.slice(nz.indexOf('async function renderDavomat'), nz.indexOf('function davomatHtml'));
  assert.ok(!/\.catch\(\(\) => \[\]\)/.test(render), 'makeups/absences xatosi yutilmasin');
  assert.match(render, /LoadErr\.html/);
});

const vm = require('node:vm');
const { functionSource } = require('./helpers/lead-workflow-fixture.cjs');
function studentsCtx(store) {
  const ctx = { STORAGE_KEYS: { hrEmployees: 'hr', teachers: 't', students: 's' }, getItem: (k, d) => store[k] ?? d };
  vm.createContext(ctx);
  vm.runInContext(functionSource('js/app.js', 'isStaffDemoStudent') + '\n' + functionSource('js/app.js', 'studentsTeacherOptions'), ctx);
  return ctx;
}
test('O\'quvchilar → "Ustozlar bo\'yicha": har ustoz bir marta, yordamchi kirmaydi', () => {
  const ctx = studentsCtx({
    hr: [{ id: 'hr-dil', name: 'Dilnoza', role: 'ingliz-oqituvchi' }, { id: 'hr-san', name: 'Sanjar', role: 'yordamchi' }, { id: 'hr-ru', name: 'Olga', role: 'rus-oqituvchi' }],
    t: [{ id: 'hr-dil', name: 'Dilnoza', subject: 'english' }, { id: 'hr-san', name: 'Sanjar', subject: 'english', type: 'yordamchi' }, { id: 't-old', name: 'Eski', subject: 'english' }]
  });
  const ids = JSON.parse(JSON.stringify(ctx.studentsTeacherOptions('english').map(t => t.id)));
  assert.deepEqual(ids.sort(), ['hr-dil', 't-old']);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.studentsTeacherOptions('russian').map(t => t.id))), ['hr-ru']);
});
test('isStaffDemoStudent: isStaffDemo yoki demo_ id', () => {
  const ctx = studentsCtx({});
  assert.equal(ctx.isStaffDemoStudent({ id: 'demo_hr-dil' }), true);
  assert.equal(ctx.isStaffDemoStudent({ id: 'x', isStaffDemo: true }), true);
  assert.equal(ctx.isStaffDemoStudent({ id: 'st-1' }), false);
  // renderStudents ro'yxatni demo'siz sanaydi
  const src = functionSource('js/app.js', 'renderStudents');
  assert.match(src, /!isStaffDemoStudent\(s\)/);
});
