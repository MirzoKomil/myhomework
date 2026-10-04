const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const roles = require('../js/teacherRoles');
const duties = require('../server/services/teacherDuties');
const engine = require('../js/payrollEngine');
const { functionSource, appContext } = require('./helpers/lead-workflow-fixture.cjs');
const own = { id: 'a', name: 'A', role: 'ingliz-oqituvchi', lang: 'english', dualRole: true, status: 'active' };

test('HR pool defaults to single role, respects language/inactivity and preserves one identity/settings', () => {
  const employees = [own, { ...own, id: 'b', dualRole: false }, { ...own, id: 'c', dualRole: 'true' },
    { ...own, id: 'ru', role: 'rus-oqituvchi' }, { ...own, id: 'off', status: 'inactive' },
    { id: 'assistant', name: 'Assistant', role: 'yordamchi', lang: 'english' }];
  const teachers = [{ id: 'a', type: 'asosiy', schedulePattern: 'tts', lessonDuration: 60 }];
  const before = structuredClone({ employees, teachers });
  assert.deepEqual(roles.pool(employees, teachers, 'yordamchi', 'english').map(t => t.id), ['a', 'assistant']);
  assert.deepEqual(roles.pool(employees, teachers, 'asosiy', 'english').map(t => t.id), ['a', 'b', 'c']);
  assert.deepEqual(roles.pool(employees, teachers, 'yordamchi', 'russian').map(t => t.id), ['ru']);
  assert.equal(roles.pool(employees, teachers, 'yordamchi', 'english')[0].schedulePattern, 'tts');
  assert.deepEqual({ employees, teachers }, before);
});

test('server allows cross-assignment but rejects self-assignment and inactive/wrong-language/non-enabled assistants', async () => {
  let row = { id: 'a', role: 'ingliz-oqituvchi', status: 'active', dual_role: true };
  const db = { query: async () => ({ rows: row ? [row] : [] }) };
  await duties.validateAssignment(db, { teacherId: 'b', assistantTeacherId: 'a', subject: 'english' });
  await assert.rejects(duties.validateAssignment(db, { teacherId: 'a', assistantTeacherId: 'a' }), /bir shaxs/);
  row.dual_role = false;
  await assert.rejects(duties.validateAssignment(db, { teacherId: 'b', assistantTeacherId: 'a' }), /HR/);
  // Disabling does not silently cancel established duties.
  await duties.validateAssignment(db, { teacherId: 'b', assistantTeacherId: 'a' }, { assistantTeacherId: 'a' });
  row.dual_role = true; row.status = 'inactive';
  await assert.rejects(duties.validateAssignment(db, { assistantTeacherId: 'a' }), /HR/);
  row.status = 'active'; row.role = 'rus-oqituvchi';
  await assert.rejects(duties.validateAssignment(db, { assistantTeacherId: 'a', subject: 'english' }), /HR/);
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

test('teacher state exposes only assigned contacts, own duty attendance and own main grades; no finance or credentials', () => {
  const state = { students: [
    { id: 'main', teacherId: 'a', assistantTeacherId: 'b', name: 'Main', phone: '111', paidAmount: 10, passwordHash: 'secret' },
    { id: 'assist', teacherId: 'b', assistantTeacherId: 'a', name: 'Assist', phone: '222', debtAmount: 20, login: 'secret' },
    { id: 'other', teacherId: 'b', name: 'Other', phone: 'private' }], teachers: [{ id: 'a', name: 'A', schedulePattern: 'mwf' },
      { id: 'b', name: 'B', salary: 100, schedulePattern: 'tts' }], hrEmployees: [own, { id: 'b', cardNumber: 'secret' }],
    payments: [{ paid: 1 }], cashFlow: [{ amount: 1 }],
    mainAttendance: { '2026-10_a': { main: { 1: 1 }, assist: { 1: 1 } }, '2026-10_b': { assist: { 1: 1 } } },
    assistantAttendance: { '2026-10_a': { assist: { 2: 1 } }, '2026-10_b': { main: { 2: 1 } } },
    liveGrades: { main: [{ teacherId: 'a' }, { teacherId: 'b' }], assist: [{ teacherId: 'b' }] },
    studentMessages: { assist: { 'main-teacher': [{ text: 'private' }], 'assistant-teacher': [{ text: 'own' }] } } };
  const before = structuredClone(state), safe = duties.stateForTeacher(state, own);
  assert.deepEqual(safe.students.map(s => s.id), ['main', 'assist']);
  assert.equal(JSON.stringify(safe).includes('secret'), false);
  assert.equal(JSON.stringify(safe).includes('private'), false);
  assert.equal(safe.students[1].debtAmount, undefined);
  assert.equal(safe.teachers[1].schedulePattern, undefined);
  assert.deepEqual(safe.mainAttendance, { '2026-10_a': { main: { 1: 1 } } });
  assert.deepEqual(safe.assistantAttendance, { '2026-10_a': { assist: { 2: 1 } } });
  assert.deepEqual(safe.liveGrades, { main: [{ teacherId: 'a' }] });
  assert.deepEqual(safe.payments, []); assert.deepEqual(safe.cashFlow, []);
  assert.deepEqual(state, before);
});

test('main and assistant pay share a single employee row with independent attendance/rates and historical policy', () => {
  const source = { academicPolicy: 'dual-role-v1', hrEmployees: [{ ...own, startDate: '2026-09-01' }],
    teachers: [{ id: 'a', schedulePattern: 'mwf' }], students: [
      { id: 'main', name: 'Main', teacherId: 'a', lessonDuration: 30 },
      { id: 'assist', name: 'Assist', teacherId: 'b', assistantTeacherId: 'a', lessonDuration: 60 }],
    mainAttendance: { '2026-10_a': { main: { 2: 1 }, assist: { 2: 1 } } },
    assistantAttendance: { '2026-10_a': { assist: { 1: 1, 2: 0 } } }, leads: {}, cashFlow: [], bonusHistory: [], salesPlan: {} };
  const p = engine.period('2026-10-01', '2026-10-31'), settings = engine.defaults();
  const result = engine.calculate(source, settings, p, 'english');
  assert.equal(result.rows.length, 1);
  const row = result.rows[0];
  assert.equal(row.mainTotal, Math.round(150000 / 13));
  assert.equal(row.assistantTotal, Math.round(50000 / 13));
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

test('actual assistant endpoint validates role ownership and assignment before writing an isolated attendance row', async () => {
  const calls = [];
  const db = { query: async (sql, args) => {
    calls.push(sql);
    if (sql.includes('FROM teachers t')) return { rows: [{ id: 'a', type: 'asosiy', subject: 'english' }] };
    if (sql.includes('FROM users u')) return { rows: [{ id: 'a', role: 'ingliz-oqituvchi', dual_role: true, status: 'active' }] };
    if (sql.includes('FROM students WHERE')) return { rows: args[0] === 'assist' && sql.includes('assistant_teacher_id') ? [{ id: 'assist', subject: 'english' }] : [] };
    if (sql.includes('FROM assistant_attendance') || sql.includes('FROM salary_kpi_settings')) return { rows: [] };
    if (sql.startsWith('INSERT INTO assistant_attendance') || sql.startsWith('INSERT INTO salary_audit')) return { rows: [] };
    throw Error('Unexpected SQL: ' + sql);
  } };
  const context = vm.createContext({ teacherDuties: duties, require: name => {
    if (name === '../js/teacherRoles') return roles; throw Error(name);
  }, tx: async fn => fn(db) });
  vm.runInContext(functionSource('server/db.js', 'recordTeacherAttendance'), context);
  const payload = { actor: { id: 'login', name: 'A', role: 'teacher' }, teacherId: 'a', studentId: 'assist', date: '2026-10-01', present: true, attendanceType: 'assistant' };
  const result = await context.recordTeacherAttendance(payload);
  assert.equal(result.attendanceType, 'assistant');
  assert.equal(calls.some(sql => /main_attendance|liveGrades/.test(sql)), false);
  await assert.rejects(context.recordTeacherAttendance({ ...payload, attendanceType: 'main' }), /biriktirilmagan/);
  await assert.rejects(context.recordTeacherAttendance({ ...payload, teacherId: 'b' }), /o'zingizga/);
  await assert.rejects(context.recordTeacherAttendance({ ...payload, date: '2026-02-30' }), /sana/);
  await assert.rejects(context.recordTeacherAttendance({ ...payload, present: 'true' }), /boolean/);
});
