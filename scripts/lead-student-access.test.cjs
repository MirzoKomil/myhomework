const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const bcrypt = require('bcryptjs');
const access = require('../js/studentAccess');
const { provisionLeadStudent, STUDENT_PROVISION_LOCK } = require('../server/services/leadStudentProvisioning');
const root = path.join(__dirname, '..');
const courses = [{ id: 'en', lang: 'english' }, { id: 'ru', lang: 'russian' }, { id: 'en2', lang: 'english' }];
const leadFixture = (language = 'english', status = 'tolov-jarayonida') => ({
  id: 'test-lead', name: 'Test Student', phone: '+998 (90) 123-00-07', language, status,
  serialCode: 'AA001', managerId: 'test-manager', paymentSurvey: { paymentType: 'partial', paidAmount: 100,
    debtAmount: 200, nextPaymentDate: '2026-10-10' },
  paymentOnboarding: { studentFullName: 'Test Student', teacherId: 'test-teacher', lessonDayOfWeek: 1,
    lessonTime: '10:00', telegramGroupLink: 'https://example.test/group', contractNumber: 'test-contract' }
});
function fromRow(r) {
  return { ...r.extra_data, id: r.id, name: r.name, phone: r.phone, group: r.group_name,
    subject: r.subject, teacherId: r.teacher_id, assistantTeacherId: r.assistant_teacher_id,
    lessonDayOfWeek: r.lesson_day_of_week, lessonTime: r.lesson_time, lessonDuration: r.lesson_duration };
}
function row(s) {
  const { id, name, phone, group, subject, teacherId, assistantTeacherId, lessonDayOfWeek,
    lessonTime, lessonDuration, ...extra_data } = s;
  return { id, name, phone, group_name: group, subject, teacher_id: teacherId,
    assistant_teacher_id: assistantTeacherId, lesson_day_of_week: lessonDayOfWeek,
    lesson_time: lessonTime, lesson_duration: lessonDuration, extra_data };
}
function fakeDb(initial = [], content = courses) {
  const db = { rows: initial.map(row), calls: [] };
  db.query = async (sql, params) => {
    db.calls.push(sql);
    if (sql === STUDENT_PROVISION_LOCK) return { rows: [] };
    if (sql.startsWith('SELECT * FROM students')) return { rows: db.rows };
    if (sql.startsWith('SELECT data FROM mobile_content')) return { rows: [{ data: { courses: content } }] };
    if (sql === 'DELETE FROM students') { db.rows = []; return { rows: [] }; }
    if (sql.startsWith('INSERT INTO students')) {
      const [id, name, phone, group_name, subject, teacher_id, assistant_teacher_id, lesson_day_of_week,
        lesson_time, lesson_duration, extra] = params;
      const saved = { id, name, phone, group_name, subject, teacher_id, assistant_teacher_id,
        lesson_day_of_week, lesson_time, lesson_duration, extra_data: JSON.parse(extra) };
      db.rows = [...db.rows.filter(r => r.id !== id), saved];
      return { rows: [] };
    }
    throw new Error('Unexpected SQL: ' + sql);
  };
  return db;
}
function functionSource(file, name) {
  const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
  const start = source.search(new RegExp('(?:async )?function ' + name + '\\('));
  assert.notEqual(start, -1, name);
  const rest = source.slice(start);
  const next = rest.slice(1).search(/\n(?:async )?function |\nconst /);
  return next < 0 ? rest : rest.slice(0, next + 1);
}
function loadFunctions(file, names, globals) {
  const context = vm.createContext(globals);
  vm.runInContext(names.map(name => functionSource(file, name)).join('\n'), context);
  return context;
}

test('phone login accepts formatted, unprefixed and local Uzbek numbers; preserves leading-zero password suffix', () => {
  for (const number of ['+998 (90) 123-00-07', '998901230007', '90 123 00 07']) {
    assert.equal(access.phoneLogin(number), '+998901230007');
  }
  assert.equal(access.phoneLogin('1234'), '');
  assert.equal(access.phoneLogin('test@example.com'), '');
  assert.equal(access.loginKey('CustomLogin'), 'customlogin');
});
for (const lang of ['english', 'russian']) for (const stage of ['tolov-jarayonida', 'tolov-yopildi']) {
  test(`${lang}: ${stage} provisions correct course, phone login and bcrypt last-four password`, async () => {
    const db = fakeDb();
    const result = await provisionLeadStudent(db, leadFixture(lang, stage));
    const s = fromRow(db.rows[0]);
    assert.equal(s.subject, lang);
    assert.equal(s.platformCourseId, lang === 'russian' ? 'ru' : 'en');
    assert.equal(s.login, '+998901230007');
    assert.equal(bcrypt.compareSync('0007', s.passwordHash), true);
    assert.equal(s.teacherId, 'test-teacher');
    assert.equal(s.serialCode, 'AA001');
    assert.equal(s.contract.number, 'test-contract');
    assert.equal(s.debtAmount, stage === 'tolov-yopildi' ? 0 : 200);
    assert.equal(result.credentialsCreated, true);
    assert.equal(result.student.hasPassword, true);
    assert.equal('password' in result.student, false);
    assert.equal('passwordHash' in result.student, false);
    assert.equal(db.calls[0], STUDENT_PROVISION_LOCK);
  });
}
test('nonpayment stages never provision accounts', async () => {
  const db = fakeDb();
  assert.equal(await provisionLeadStudent(db, leadFixture('russian', 'sinov-darsida')), null);
  assert.equal(db.calls.length, 0);
});
test('repeated lead saves preserve ID, custom password, progress and independently recorded debt', async () => {
  const db = fakeDb();
  const lead = leadFixture();
  await provisionLeadStudent(db, lead);
  const old = db.rows[0];
  old.extra_data.passwordHash = bcrypt.hashSync('custom-secret', 4);
  old.extra_data.progress = { lesson5: 100 };
  old.extra_data.debtAmount = 75;
  const hash = old.extra_data.passwordHash;
  const result = await provisionLeadStudent(db, { ...lead, name: 'Renamed' });
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].id, old.id);
  assert.equal(db.rows[0].extra_data.passwordHash, hash);
  assert.deepEqual(db.rows[0].extra_data.progress, { lesson5: 100 });
  assert.equal(db.rows[0].extra_data.debtAmount, 75);
  assert.equal(result.credentialsCreated, false);
  await provisionLeadStudent(db, { ...lead, status: 'tolov-yopildi' });
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].extra_data.passwordHash, hash);
  assert.equal(db.rows[0].extra_data.debtAmount, 0);
});
test('legacy matching student is reused despite phone formatting or changed teacher', async () => {
  const lead = leadFixture('russian');
  const db = fakeDb([{ id: 'existing', name: lead.name, phone: '90 123 00 07', subject: 'russian',
    teacherId: 'old-teacher', login: 'customlogin', password: 'existing-password', platformCourseId: 'en' }]);
  const result = await provisionLeadStudent(db, lead);
  const s = fromRow(db.rows[0]);
  assert.equal(db.rows.length, 1);
  assert.equal(s.id, 'existing');
  assert.equal(s.platformCourseId, 'ru');
  assert.equal(s.login, 'customlogin');
  assert.equal(bcrypt.compareSync('existing-password', s.passwordHash), true);
  assert.equal('password' in s, false);
  assert.equal(result.credentialsCreated, false);
});
test('an existing same-language course assignment is retained', async () => {
  const lead = leadFixture();
  const db = fakeDb([{ id: 'existing', subject: 'english', leadRef: { id: lead.id, lang: 'english' },
    platformCourseId: 'en2', passwordHash: bcrypt.hashSync('keep', 4) }]);
  const result = await provisionLeadStudent(db, lead);
  assert.equal(result.student.platformCourseId, 'en2');
});
test('invalid phone, missing course, duplicate login and mismatched linked language cannot insert a student', async () => {
  for (const [db, lead, message] of [
    [fakeDb(), { ...leadFixture(), phone: '123' }, /telefon/],
    [fakeDb([], []), leadFixture(), /kurs mavjud emas/],
    [fakeDb([{ id: 'other', subject: 'english', login: '998901230007', name: 'Different' }]), leadFixture(), /boshqa/],
    [fakeDb([{ id: 'other', subject: 'russian', leadRef: { id: 'test-lead', lang: 'english' } }]), leadFixture(), /kurs tili/]
  ]) {
    const count = db.rows.length;
    await assert.rejects(provisionLeadStudent(db, lead), message);
    assert.equal(db.rows.length, count);
    assert.equal(db.calls.some(sql => sql.startsWith('INSERT')), false);
  }
});
test('lead save and account creation share one atomic transaction; failed provisioning rolls back the lead', async () => {
  const db = fakeDb();
  let savedLead;
  let committed = 0;
  const { upsertLead } = loadFunctions('server/db.js', ['upsertLead'], {
    provisionLeadStudent,
    inflow: { syncLead: async () => {} },
    upsertLeadWithClient: async (_client, lead, language) => (savedLead = { ...lead, language }),
    tx: async fn => {
      const before = { rows: structuredClone(db.rows), lead: savedLead };
      try { await fn(db); committed++; }
      catch (err) { db.rows = before.rows; savedLead = before.lead; throw err; }
    }
  });
  await assert.rejects(upsertLead({ ...leadFixture(), phone: 'bad' }, 'english'), /telefon/);
  assert.equal(savedLead, undefined);
  assert.equal(committed, 0);
  const result = await upsertLead(leadFixture(), 'english');
  assert.equal(result.lead.id, 'test-lead');
  assert.equal(result.platformAccess.student.subject, 'english');
  assert.equal(committed, 1);
});
test('stale CRM snapshots keep newly provisioned accounts; explicit deletion works and absent hashes are preserved', async () => {
  const db = fakeDb();
  await provisionLeadStudent(db, leadFixture());
  const hash = db.rows[0].extra_data.passwordHash;
  const s = fromRow(db.rows[0]);
  const { saveStudents } = loadFunctions('server/db.js', ['saveStudents'], {
    STUDENT_PROVISION_LOCK, rowToStudent: fromRow, isUsableList: Array.isArray,
    guardBulkDelete: async () => {}, BCRYPT_HASH_RE: /^\$2[aby]\$\d{2}\$/, bcrypt
  });
  await saveStudents(db, []);
  assert.equal(db.rows.length, 1);
  await saveStudents(db, [{ id: s.id, name: s.name, phone: s.phone, subject: s.subject }]);
  assert.equal(db.rows[0].extra_data.passwordHash, hash);
  assert.equal(db.rows[0].extra_data.login, s.login);
  assert.equal(db.rows[0].extra_data.autoProvisionedFromLead, true);
  await saveStudents(db, [], [s.id]);
  assert.equal(db.rows.length, 0);
});
test('student login normalizes phone input and refuses ambiguous accounts', async () => {
  const db = fakeDb([{ id: 'one', login: '+998901230007' }]);
  const { findStudentByLogin } = loadFunctions('server/db.js', ['findStudentByLogin'], {
    studentAccess: access, rowToStudent: fromRow, q: async () => db.rows
  });
  assert.equal((await findStudentByLogin('90 123 00 07')).id, 'one');
  db.rows.push(row({ id: 'two', login: '998901230007' }));
  assert.equal(await findStudentByLogin('+998901230007'), null);
});
for (const lang of ['english', 'russian']) {
  test(`${lang}: actual student-login handler accepts provisioned phone and suffix and returns the correct language`, async () => {
    const db = fakeDb();
    await provisionLeadStudent(db, leadFixture(lang));
    const { findStudentByLogin } = loadFunctions('server/db.js', ['findStudentByLogin'], {
      studentAccess: access, rowToStudent: fromRow, q: async () => db.rows
    });
    const handlers = new Map();
    let session;
    const router = { post: (url, ...callbacks) => handlers.set(url, callbacks.at(-1)), get() {}, delete() {}, patch() {}, put() {} };
    const context = { module: { exports: {} }, console, Buffer, process,
      require: id => {
        if (id === 'express') return { Router: () => router };
        if (id === 'bcryptjs') return bcrypt;
        if (id === '../db') return { DATA_DIR: path.join(root, 'test-unused-data'), findStudentByLogin, getStudentPublicId: async s => s.serialCode,
          createSession: async data => { session = data; } };
        if (id === '../middleware/auth') return { signToken: claims => ({ token: 'test-token', jti: 'test-jti', claims }),
          authRequired: () => {} };
        return require(id);
      }
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'server/routes/auth.js'), 'utf8'), context);
    let response;
    const res = { status: code => { assert.equal(code, 200); return res; }, json: body => { response = body; } };
    await handlers.get('/student-login')({ body: { login: '90 123 00 07', password: '0007' }, headers: {}, socket: {} }, res);
    assert.equal(response.token, 'test-token');
    assert.equal(response.student.lang, lang);
    assert.equal(response.student.login, '+998901230007');
    assert.equal(session.userId, response.student.id);
    assert.equal('passwordHash' in response.student, false);
  });
}
test('assigned course content cannot expose another language or course', () => {
  const { scopeMobileContentToStudentLanguage } = loadFunctions('server/db.js', ['scopeMobileContentToStudentLanguage'], {
    BONUS_ID_RE: /^bonus/, EXAM_ID_RE: /^exam/
  });
  const mc = { courses, lessons: [{ id: 'one', courseId: 'en' }, { id: 'two', courseId: 'ru' }, { id: 'three', courseId: 'en2' }],
    modules: [], moduleContents: [], lessonContents: { one: {}, two: {}, three: {} } };
  scopeMobileContentToStudentLanguage(mc, 'english', 'en2');
  assert.deepEqual(mc.courses.map(c => c.id), ['en2']);
  assert.deepEqual(mc.lessons.map(l => l.id), ['three']);
  assert.deepEqual(Object.keys(mc.lessonContents), ['three']);
});

test('CRM only caches server-confirmed students and sends no SMS before a successful lead save', async () => {
  let resolveSave;
  const pending = new Promise(resolve => { resolveSave = resolve; });
  const cache = { students: [], leads: { english: [leadFixture('english', 'sinov-darsida')], russian: [] } };
  const sent = [];
  const context = loadFunctions('js/app.js', ['persistLeadChange', 'updateLeadInStorage', 'cacheProvisionedStudent', 'ensureStudentLoginForLead'], {
    studentAccess: access, STORAGE_KEYS: { leads: 'leads', students: 'students' },
    getItem: key => cache[key], setItem: (key, value) => { assert.equal(key, 'leads'); cache[key] = value; },
    setCachedItem: (key, value) => { cache[key] = value; },
    apiSaveLead: async () => pending, normalizeLeadStatus: s => s, normalizeLeadExtras: s => s,
    _leadMutationTokens: new Map(), _leadMutationGeneration: 0, _leadWriteQueues: new Map(), _leadServerVersions: new Map(),
    newestLeadVersion: () => null, updateCachedLeadVersion: () => {},
    maybeSendAutoStageSms: (...args) => sent.push(args), LEAD_STATUSES_NEED_SERIAL: access.PAYMENT_STAGES,
    autoSyncLeadToBookRoadmap: () => {}, syncLeadManagerToBookRoadmap: () => {},
    document: { getElementById: () => null }, console, showSaveError: () => {}, refreshSingleLeadFromApi: async () => false
  });
  context.updateLeadInStorage('english', 'test-lead', l => ({ ...l, status: 'tolov-jarayonida' }));
  assert.equal(cache.students.length, 0);
  assert.equal(sent.length, 0);
  const db = fakeDb();
  const saved = cache.leads.english[0];
  const platformAccess = await provisionLeadStudent(db, saved);
  resolveSave({ lead: saved, platformAccess });
  await context._leadWriteQueues.get('test-lead');
  assert.equal(cache.students.length, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][4].credentialsCreated, true);
  assert.equal(context.ensureStudentLoginForLead('english', saved, platformAccess).password, '0007');
  assert.equal(context.ensureStudentLoginForLead('english', saved, { ...platformAccess, credentialsCreated: false }), null);
  context.cacheProvisionedStudent(platformAccess.student);
  assert.equal(cache.students.length, 1);
  context.apiSaveLead = async () => { throw new Error('Test save rejected'); };
  context.console = { error() {} };
  context.updateLeadInStorage('english', 'test-lead', l => ({ ...l, status: 'tolov-yopildi' }));
  await assert.rejects(context._leadWriteQueues.get('test-lead'), /save rejected/);
  assert.equal(sent.length, 1, 'no SMS is sent for a failed save');
  assert.equal(cache.students.length, 1, 'no optimistic account is created');
});

test('CRM deletion sends explicit IDs, while an ordinary edit does not claim deletion of unseen accounts', async () => {
  const payloads = [];
  const context = loadFunctions('js/storage.js', ['setItem'], {
    CACHE_KEY_MAP: { students: 'students' }, STORAGE_KEYS: { students: 'students', leads: 'leads' },
    _cache: { students: [{ id: 'one' }, { id: 'two' }] }, _apiReady: true,
    apiPatchState: async payload => { payloads.push(payload); }, console
  });
  await context.setItem('students', [{ id: 'one', name: 'Edited' }, { id: 'two' }]);
  assert.equal(payloads[0].removedStudentIds.length, 0);
  await context.setItem('students', [{ id: 'two' }]);
  assert.deepEqual(Array.from(payloads[1].removedStudentIds), ['one']);
});
