const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const roles = require('../js/teacherRoles');
const duties = require('../server/services/teacherDuties');
const engine = require('../js/payrollEngine');
const { functionSource, appContext } = require('./helpers/lead-workflow-fixture.cjs');
const own = { id: 'a', name: 'A', role: 'ingliz-oqituvchi', lang: 'english', dualRole: true, status: 'active' };

// 29-okt qarori: yordamchi ustoz — alohida lavozim (HR role 'yordamchi'); asosiy ustoz yordamchi bo'la olmaydi
// (eski dual_role bayrog'i hisobga olinmaydi). Testlar shu qoidaga moslab yangilangan.
test('HR pool: yordamchi faqat yordamchi lavozimidan, asosiy — asosiy ustozlar; til/faollik hisobga olinadi', () => {
  const employees = [own, { ...own, id: 'b', dualRole: false }, { ...own, id: 'c', dualRole: 'true' },
    { ...own, id: 'ru', role: 'rus-oqituvchi' }, { ...own, id: 'off', status: 'inactive' },
    { id: 'assistant', name: 'Assistant', role: 'yordamchi', lang: 'english' },
    { id: 'ruA', name: 'RuAssistant', role: 'yordamchi', lang: 'russian' },
    { id: 'offA', name: 'Off', role: 'yordamchi', lang: 'english', status: 'inactive' }];
  const teachers = [{ id: 'a', type: 'asosiy', schedulePattern: 'tts', lessonDuration: 60 }];
  const before = structuredClone({ employees, teachers });
  // dualRole: true bo'lgan asosiy ustoz ('a', 'c') ham yordamchi ro'yxatiga kirmaydi.
  assert.deepEqual(roles.pool(employees, teachers, 'yordamchi', 'english').map(t => t.id), ['assistant']);
  assert.deepEqual(roles.pool(employees, teachers, 'asosiy', 'english').map(t => t.id), ['a', 'b', 'c']);
  assert.deepEqual(roles.pool(employees, teachers, 'yordamchi', 'russian').map(t => t.id), ['ruA']);
  assert.deepEqual(roles.pool(employees, teachers, 'asosiy', 'russian').map(t => t.id), ['ru']);
  assert.equal(roles.pool(employees, teachers, 'asosiy', 'english')[0].schedulePattern, 'tts');
  assert.equal(roles.pool(employees, teachers, 'yordamchi', 'english')[0].dualRole, false);
  assert.deepEqual({ employees, teachers }, before);
});

test('server: yangi yordamchi biriktirish faqat faol, shu tildagi yordamchi lavozimiga; asosiy ustoz — rad; eski biriktirish saqlanadi', async () => {
  let row = { id: 'a', role: 'ingliz-oqituvchi', status: 'active', dual_role: true };
  const db = { query: async () => ({ rows: row ? [row] : [] }) };
  // Asosiy ustoz (dual_role yoqilgan bo'lsa ham) yordamchi bo'la olmaydi.
  await assert.rejects(duties.validateAssignment(db, { teacherId: 'b', assistantTeacherId: 'a', subject: 'english' }), /yordamchi ustoz bo‘la olmaydi/);
  await assert.rejects(duties.validateAssignment(db, { teacherId: 'a', assistantTeacherId: 'a' }), /bir shaxs/);
  // O'zgarmagan eski biriktirish (CRM butun ro'yxatni qayta yuboradi) saqlashni buzmaydi.
  await duties.validateAssignment(db, { teacherId: 'b', assistantTeacherId: 'a' }, { teacherId: 'b', assistantTeacherId: 'a' });
  row = { id: 'y', role: 'yordamchi', lang: 'english', status: 'active' };
  await duties.validateAssignment(db, { teacherId: 'b', assistantTeacherId: 'y', subject: 'english' });
  row.status = 'inactive';
  await assert.rejects(duties.validateAssignment(db, { assistantTeacherId: 'y' }), /HR/);
  row.status = 'active'; row.lang = 'russian';
  await assert.rejects(duties.validateAssignment(db, { assistantTeacherId: 'y', subject: 'english' }), /HR/);
  row = null;
  await assert.rejects(duties.validateAssignment(db, { assistantTeacherId: 'missing' }), /HR/);
});

test('teacher identity is server-resolved and ambiguous, unlinked and non-teacher actors fail closed', async () => {
  const db = { query: async () => ({ rows: [] }) };
  await assert.rejects(duties.teacherForActor(db, { role: 'admin' }), /ruxsat/);
  await assert.rejects(duties.teacherForActor(db, { role: 'teacher', id: 'login' }), /HR/);
  db.query = async () => ({ rows: [{ id: 'a' }, { id: 'b' }] });
  await assert.rejects(duties.teacherForActor(db, { role: 'teacher', id: 'login' }), /HR/);
});

test('changing the primary teacher cannot reuse the same account through a different HR identity', async () => {
  const db = { query: async sql => ({ rows: sql.includes('SELECT login')
    ? [{ login: ' shared-login ' }]
    : [{ id: 'a', login: 'SHARED-LOGIN', role: 'ingliz-oqituvchi', dual_role: false }] }) };
  await assert.rejects(duties.validateAssignment(db, { teacherId: 'duplicate', assistantTeacherId: 'a' },
    { teacherId: 'old-main', assistantTeacherId: 'a' }), /Bitta akkaunt/);
});

test('teacher state: asosiy ustozga faqat o\'z o\'quvchilari va asosiy davomati; yordamchiga — o\'z o\'quvchilari, baho yo\'q; moliya/parol yo\'q', () => {
  const state = { students: [
    { id: 'main', teacherId: 'a', assistantTeacherId: 'y', name: 'Main', phone: '111', paidAmount: 10, passwordHash: 'secret',
      statusHistory: [{ status: 'frozen', from: '2026-10-20', to: '2026-11-10', at: '2026-10-19T10:00:00Z' }] },
    { id: 'assist', teacherId: 'b', assistantTeacherId: 'a', name: 'Assist', phone: '222', debtAmount: 20, login: 'secret' },
    { id: 'other', teacherId: 'b', assistantTeacherId: 'y', name: 'Other', phone: 'private' }], teachers: [{ id: 'a', name: 'A', schedulePattern: 'mwf' },
      { id: 'b', name: 'B', salary: 100, schedulePattern: 'tts' }], hrEmployees: [own, { id: 'b', cardNumber: 'secret' }, { id: 'y', name: 'Y', role: 'yordamchi' }],
    payments: [{ paid: 1 }], cashFlow: [{ amount: 1 }],
    mainAttendance: { '2026-10_a': { main: { 1: 1 }, assist: { 1: 1 } }, '2026-10_b': { assist: { 1: 1 } } },
    assistantAttendance: { '2026-10_a': { assist: { 2: 1 } }, '2026-10_b': { main: { 2: 1 } }, '2026-10_y': { other: { 3: 1 } } },
    liveGrades: { main: [{ teacherId: 'a' }, { teacherId: 'b' }], assist: [{ teacherId: 'b' }] },
    studentMessages: { assist: { 'main-teacher': [{ text: 'private' }], 'assistant-teacher': [{ text: 'own' }] } } };
  const before = structuredClone(state), safe = duties.stateForTeacher(state, own);
  // Asosiy ustozga eski "yordamchi sifatida" biriktirish ('assist') ko'rinmaydi (29-okt).
  assert.deepEqual(safe.students.map(s => s.id), ['main']);
  assert.equal(JSON.stringify(safe).includes('secret'), false);
  assert.equal(JSON.stringify(safe).includes('private'), false);
  assert.equal(safe.students[0].paidAmount, undefined);
  // Holat tarixi (sana bo'yicha faollik — Davomat % va maosh bitta qoida) beriladi, sababsiz.
  assert.deepEqual(safe.students[0].statusHistory, state.students[0].statusHistory);
  assert.deepEqual(safe.mainAttendance, { '2026-10_a': { main: { 1: 1 } } });
  assert.deepEqual(Object.values(safe.assistantAttendance).flatMap(Object.keys), []);
  assert.deepEqual(safe.liveGrades, { main: [{ teacherId: 'a' }] });
  assert.deepEqual(safe.payments, []); assert.deepEqual(safe.cashFlow, []);
  assert.equal(safe.teacherDuty.hasAssistantStudents, false);
  const asst = duties.stateForTeacher(state, { id: 'y', name: 'Y', role: 'yordamchi', lang: 'english', status: 'active' });
  assert.deepEqual(asst.students.map(s => s.id), ['main', 'other']);
  // Yordamchiga o'quvchi telefoni va asosiy ustoz baholari berilmaydi.
  assert.equal(asst.students.some(s => s.phone), false);
  assert.deepEqual(asst.liveGrades, {});
  assert.deepEqual(asst.assistantAttendance, { '2026-10_y': { other: { 3: 1 } } });
  assert.deepEqual(asst.mainAttendance, {});
  assert.deepEqual(state, before);
});

test('main and assistant pay share a single employee row with independent attendance/rates and historical policy', () => {
  const source = { academicPolicy: 'dual-role-v1', hrEmployees: [{ ...own, startDate: '2026-09-01' }],
    teachers: [{ id: 'a', schedulePattern: 'mwf' }], students: [
      { id: 'main', name: 'Main', teacherId: 'a', lessonDuration: 30 },
      { id: 'assist', name: 'Assist', teacherId: 'b', assistantTeacherId: 'a', lessonDuration: 60 }],
    mainAttendance: { '2026-10_a': { main: { 2: 1 }, assist: { 2: 1 } } },
    assistantAttendance: { '2026-10_a': { assist: { 1: 1, 2: 0 } } }, leads: {}, cashFlow: [], bonusHistory: [], salesPlan: {},
    // "assist" o'quvchisining asosiy ustozi butun oy 'b' (tarix): 'a' blokidagi asosiy belgi unga to'lanmaydi (29-okt: kim o'tgan — tarix bo'yicha).
    teacherHistory: [{ studentId: 'assist', teacherId: 'b', fromDate: '2026-09-01' }] };
  const p = engine.period('2026-10-01', '2026-10-31'), settings = engine.defaults();
  const result = engine.calculate(source, settings, p, 'english');
  assert.equal(result.rows.length, 1);
  const row = result.rows[0];
  assert.equal(row.mainTotal, Math.round(150000 / 13));
  // 29-okt: yordamchi tarifi 40 000 (o'quvchi tarifidan qat'i nazar).
  assert.equal(row.assistantTotal, Math.round(40000 / 13));
  assert.equal(row.total, row.mainTotal + row.assistantTotal);
  assert.equal(row.studentCount, 2);
  assert.deepEqual(row.breakdown.map(b => b.dutyRole), ['main', 'assistant']);
  source.students[0].assistantTeacherId = 'a';
  source.assistantAttendance['2026-10_a'].main = { 1: 1 };
  assert.equal(engine.calculate(source, settings, p, 'english').rows[0].total, row.total);
  // Existing assignments are earned even when the pool switch is disabled later.
  source.hrEmployees[0].dualRole = false;
  assert.equal(engine.calculate(source, settings, p, 'english').rows[0].total, row.total);
  // Old historical salary bases retain their old calculation policy.
  delete source.academicPolicy;
  assert.equal(engine.calculate(source, settings, p, 'english').rows[0].total, row.mainTotal);
  assert.equal(engine.calculate(source, settings, p, 'english', null, [row]).rows[0].total, row.total);
});

test('assistant absence caches independently and never deletes or writes a main teacher grade', () => {
  const cache = { assistant: {}, grades: { s: [{ date: '2026-10-01', teacherId: 'b' }] } };
  const c = appContext(['applyTeacherAttendanceResult'], {
    STORAGE_KEYS: { assistantAttendance: 'assistant', mainAttendance: 'main', liveGrades: 'grades' },
    getItem: key => cache[key] || {}, setCachedItem: (key, value) => { cache[key] = value; }
  });
  c.applyTeacherAttendanceResult({ attendanceType: 'assistant', attendanceKey: '2026-10_a', studentId: 's', day: 1,
    date: '2026-10-01', present: false, grade: null });
  assert.equal(cache.assistant['2026-10_a'].s[1], 0);
  assert.equal(cache.grades.s[0].teacherId, 'b');
  assert.equal(cache.main, undefined);
});

test('actual state router blocks teacher bulk writes, scopes reads and ignores forged body actor', async () => {
  const calls = [], route = { exports: {} }, actor = { id: 'login', role: 'teacher' };
  const context = vm.createContext({ module: route, console, require: name => {
    if (name === 'express') return require('express');
    if (name === '../services/stateScope') return require('../server/services/stateScope');
    if (name === '../services/ropScope') return require('../server/services/ropScope');
    if (name === '../services/teacherDuties') return require('../server/services/teacherDuties');
    if (name === '../services/teacherRating') return require('../server/services/teacherRating');
    if (name === '../middleware/auth') return { studentAuthOptional: (_req, _res, next) => next(),
      authRequired: (req, res, next) => req.user ? next() : res.status(401).json({ error: 'Auth' }) };
    if (name === '../db') return { findUserById: async () => actor,
      getTeacherScopedState: async user => { calls.push(['read', user]); return { payments: [] }; },
      recordTeacherAttendance: async payload => { calls.push(['write', payload]); return { present: true }; },
      patchState: () => { throw Error('Bulk must not run'); } };
    throw Error(name);
  } });
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../server/routes/state.js'), 'utf8'), context);
  const dispatch = (method, url, user, body = {}) => new Promise((resolve, reject) => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { resolve({ code: this.code, data }); } };
    route.exports.handle({ method, url, headers: {}, user, body }, res, reject);
  });
  assert.equal((await dispatch('GET', '/', null)).code, 401);
  assert.equal((await dispatch('GET', '/', actor)).code, 200);
  assert.equal(calls[0][1].id, actor.id);
  assert.equal((await dispatch('PATCH', '/', actor, { mainAttendance: {} })).code, 403);
  await dispatch('POST', '/teacher-attendance', actor, { actor: { id: 'admin', role: 'admin' }, attendanceType: 'assistant' });
  assert.equal(calls[1][1].actor.id, actor.id);
  assert.equal(calls[1][1].actor.role, 'teacher');
  assert.equal(calls[1][1].attendanceType, 'assistant');
  assert.equal((await dispatch('GET', '/', { ...actor, role: 'admin' })).code, 200);
  assert.equal(calls.at(-1)[0], 'read');
  assert.equal(calls.at(-1)[1].role, 'teacher');
});

test('actual attendance endpoint: asosiy ustoz yordamchi davomatini, yordamchi asosiy davomatni belgilamaydi; yordamchi o\'z o\'quvchisiga alohida yozadi', async () => {
  const calls = [];
  let hr = { id: 'a', role: 'ingliz-oqituvchi', status: 'active' };
  const db = { query: async (sql, args) => {
    calls.push(sql);
    if (sql.includes('FROM teachers t')) return { rows: [{ id: hr.id, type: hr.role === 'yordamchi' ? 'yordamchi' : 'asosiy', subject: 'english' }] };
    if (sql.includes('FROM users u')) return { rows: [hr] };
    if (sql.includes('to_regclass')) return { rows: [{ t: 'x' }] };
    if (sql.includes('FROM school_student_status')) return { rows: [] };
    if (sql.includes('FROM students WHERE')) return { rows: args[0] === 'assist' && sql.includes('assistant_teacher_id') && args[1] === 'y' ? [{ id: 'assist', subject: 'english', extra_data: {} }] : [] };
    if (sql.includes('FROM assistant_attendance') || sql.includes('FROM salary_kpi_settings')) return { rows: [] };
    if (sql.startsWith('INSERT INTO assistant_attendance') || sql.startsWith('INSERT INTO salary_audit')) return { rows: [] };
    throw Error('Unexpected SQL: ' + sql);
  } };
  const rules = require('../server/services/teacherAttendanceRules');
  // Davomat oynasi — qotirilgan "bugun" (2026-10-15) bilan (oy yopilishi testni sanaga bog'lamasin).
  const context = vm.createContext({ teacherDuties: duties, require: name => {
    if (name === './services/domworkBot/events') return require('../server/services/domworkBot/events');
    if (name === '../js/teacherRoles') return roles; throw Error(name);
  }, tx: async fn => fn(db), assertTeacherAttendanceWindow: (c, o) => rules.assertTeacherAttendanceWindow(c, { ...o, now: new Date('2026-10-15T10:00:00Z') }) });
  vm.runInContext(functionSource('server/db.js', 'recordTeacherAttendance'), context);
  const payload = { actor: { id: 'login', name: 'A', role: 'teacher' }, teacherId: 'a', studentId: 'assist', date: '2026-10-01', present: true, attendanceType: 'assistant' };
  await assert.rejects(context.recordTeacherAttendance(payload), /Asosiy ustoz yordamchi davomatini belgilamaydi/);
  hr = { id: 'y', role: 'yordamchi', lang: 'english', status: 'active' };
  const ok = { ...payload, teacherId: 'y' };
  calls.length = 0;
  const result = await context.recordTeacherAttendance(ok);
  assert.equal(result.attendanceType, 'assistant');
  assert.equal(calls.some(sql => /main_attendance|liveGrades/.test(sql)), false);
  await assert.rejects(context.recordTeacherAttendance({ ...ok, attendanceType: 'main' }), /asosiy davomatni o‘zgartira olmaydi/);
  await assert.rejects(context.recordTeacherAttendance({ ...ok, teacherId: 'a' }), /o'zingizga/);
  await assert.rejects(context.recordTeacherAttendance({ ...ok, date: '2026-02-30' }), /sana/);
  await assert.rejects(context.recordTeacherAttendance({ ...ok, present: 'true' }), /boolean/);
});
