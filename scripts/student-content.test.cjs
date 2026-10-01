const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../student-app/node_modules/typescript');
const policy = require('../js/mobileContentPolicy');
const { migrateMobileContentPolicy } = require('../server/services/mobileContentMigration');
const root = path.join(__dirname, '..');

function loadTs(relativePath, mocks = {}, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports, require: id => {
    if (!(id in mocks)) throw new Error(`Unexpected dependency: ${id}`);
    return mocks[id];
  }, URLSearchParams, console, ...globals });
  return exports;
}
const { createSessionContentCache } = loadTs('student-app/services/sessionContentCache.ts');
const lessonPolicy = loadTs('student-app/services/lessonContentPolicy.ts');
const turn = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('all known URL formats reject only the confirmed football video', () => {
  for (const url of ['https://youtu.be/8JMOD5WsBDM?si=x', 'https://www.youtube.com/watch?v=8JMOD5WsBDM', 'https://youtube.com/embed/8JMOD5WsBDM', 'https://youtube.com/shorts/8JMOD5WsBDM']) {
    assert.equal(policy.isBlockedVideo(url), true);
    assert.equal(lessonPolicy.allowedVideoUrl(url), undefined);
  }
  assert.equal(policy.isBlockedVideo('https://youtu.be/yTRiBmSrdh4'), false);
  assert.equal(lessonPolicy.allowedVideoUrl('https://youtu.be/yTRiBmSrdh4'), 'https://youtu.be/yTRiBmSrdh4');
});

function contentFixture() {
  return { courses: [{ id: 'ru', lang: 'russian' }], lessons: [{ id: 'one', courseId: 'ru' }],
    lessonContents: { one: { videoUrl: 'https://youtu.be/8JMOD5WsBDM', konspekt: 'Authored Russian text', vocabulary: [{ id: 'v1' }],
      homeworkParts: [{ id: 'D', kind: 'matching', title: 'Talaffuz mashqi', pairs: [{ left: 'x', right: 'y' }] },
        { id: 'p', kind: 'pronunciation', title: 'PART C' }, { id: 'g', kind: 'multipleChoice', title: 'Gramatika mashqi', questions: [{ id: 'q' }] },
        { id: 'm', kind: 'matching', title: 'Jumlalarni birlashtirish', pairs: [{ left: 'a', right: 'b' }] }] } },
    moduleContents: [{ id: 'bad', type: 'video', url: 'https://youtube.com/embed/8JMOD5WsBDM' }, { id: 'good', type: 'video', url: 'https://youtu.be/yTRiBmSrdh4' }],
    extra: { preserve: true } };
}

test('cleanup preserves authored lessons, vocabulary, valid exercises and IDs; is idempotent', () => {
  const mc = contentFixture();
  policy.sanitizeMobileContent(mc);
  assert.equal(mc.lessonContents.one.videoUrl, '');
  assert.deepEqual(mc.lessonContents.one.homeworkParts.map(p => p.id), ['g', 'm']);
  assert.equal(mc.lessonContents.one.konspekt, 'Authored Russian text');
  assert.deepEqual(mc.lessons, [{ id: 'one', courseId: 'ru' }]);
  assert.deepEqual(mc.lessonContents.one.vocabulary, [{ id: 'v1' }]);
  assert.equal(mc.moduleContents[0].url, '');
  assert.equal(mc.moduleContents[1].url, 'https://youtu.be/yTRiBmSrdh4');
  const before = JSON.stringify(mc);
  assert.equal(JSON.stringify(policy.sanitizeMobileContent(mc)), before);
});

test('migration backs up original content under lock, never touches student results, and runs once', async () => {
  let data = contentFixture();
  const calls = [];
  const client = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith('SELECT')) return { rows: [{ data: structuredClone(data) }] };
    if (sql.startsWith('UPDATE')) data = JSON.parse(params[0]);
    return { rows: [] };
  } };
  const before = JSON.stringify(data);
  assert.equal(await migrateMobileContentPolicy(client), true);
  assert.match(calls[0].sql, /FOR UPDATE/);
  assert.match(calls[1].sql, /mobile_content_backups/);
  assert.equal(calls[1].params[1], before);
  assert.equal(await migrateMobileContentPolicy(client), false);
  assert.equal(calls.filter(c => c.sql.startsWith('UPDATE')).length, 1);
  assert.ok(calls.every(c => !/student_lesson_progress|students/i.test(c.sql)));
});

test('migration cannot update content if its backup fails', async () => {
  const calls = [];
  const client = { query: async sql => {
    calls.push(sql);
    if (sql.startsWith('SELECT')) return { rows: [{ data: contentFixture() }] };
    throw new Error('backup failed');
  } };
  await assert.rejects(migrateMobileContentPolicy(client), /backup failed/);
  assert.ok(calls.every(sql => !sql.startsWith('UPDATE')));
});

test('session switch cannot return or cache an old English response', async () => {
  let identity = 'guest';
  const guest = deferred(), russian = deferred();
  const cache = createSessionContentCache(() => identity, key => key === 'guest' ? guest.promise : russian.promise, 1000);
  const old = cache.get();
  await turn();
  identity = 'russian-student';
  const fresh = cache.get();
  russian.resolve('Russian lesson');
  assert.equal(await fresh, 'Russian lesson');
  guest.resolve('English demo');
  assert.equal(await old, 'Russian lesson');
  assert.equal(await cache.get(), 'Russian lesson');
});

test('invalidation does not share or accept old pending requests', async () => {
  const requests = [deferred(), deferred()];
  let count = 0;
  const cache = createSessionContentCache(() => 'same-account', () => requests[count++].promise, 1000);
  const old = cache.get();
  await turn();
  cache.invalidate();
  const fresh = cache.get();
  await turn();
  requests[0].resolve('stale');
  await turn();
  requests[1].resolve('updated');
  assert.equal(await old, 'updated');
  assert.equal(await fresh, 'updated');
  assert.equal(count, 2);
});

test('late session errors retry for the current identity instead of failing its screen', async () => {
  let identity = 'old';
  const oldRequest = deferred();
  const cache = createSessionContentCache(() => identity, key => key === 'old' ? oldRequest.promise : Promise.resolve('new'), 1000);
  const old = cache.get();
  await turn();
  identity = 'new';
  oldRequest.reject(new Error('old session expired'));
  assert.equal(await old, 'new');
});

test('cache keeps single-flight, expires, and does not cache failures', async () => {
  let time = 0, count = 0;
  const cache = createSessionContentCache(() => 'student', async () => { count++; return count; }, 1000, () => time);
  assert.deepEqual(await Promise.all([cache.get(), cache.get()]), [1, 1]);
  time = 1001;
  assert.equal(await cache.get(), 2);
  cache.invalidate();
  assert.equal(await cache.get(), 3);
  let failures = 0;
  const failed = createSessionContentCache(() => 'student', async () => { if (++failures === 1) throw new Error('offline'); return 'ok'; }, 1000);
  await assert.rejects(failed.get(), /offline/);
  assert.equal(await failed.get(), 'ok');
});

test('content API uses preview language, current token, and rejects wrong-language data', async () => {
  let token = null, student = null, search = '?course=russian';
  const requests = [];
  let responseLang = 'russian';
  const browser = { location: { get search() { return search; } }, self: {}, top: {} };
  const api = loadTs('student-app/services/contentApi.ts', {
    'react-native': { Platform: { OS: 'web' } },
    '@/services/studentAuthStore': { ready: async () => {}, getToken: () => token, getStudent: () => student },
    '@/services/sessionContentCache': { createSessionContentCache },
    '@/services/lessonContentPolicy': lessonPolicy,
  }, { window: browser, fetch: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ courses: [{ id: 'course', lang: responseLang }], lessonContents: {} }) };
  } });
  await api.fetchMobileContent();
  assert.match(requests[0].url, /\?course=russian$/);
  token = 'test-russian-session'; student = { lang: 'russian' };
  search = '?course=english';
  await api.fetchMobileContent();
  assert.equal(requests[1].url, '/api/state/mobile-content');
  assert.equal(requests[1].options.headers.Authorization, 'Bearer test-russian-session');
  assert.equal(requests[1].options.cache, 'no-store');
  api.invalidateCache(); responseLang = 'english';
  await assert.rejects(api.fetchMobileContent(), /Kurs tili/);
  token = null; browser.top = browser.self;
  await assert.rejects(api.fetchMobileContent(), /hisobingizga kiring/);
});

test('admin defaults never recreate pronunciation parts for either language or day', () => {
  const ctx = { mobileContentPolicy: policy };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/lessonDefaults.js'), 'utf8'), ctx);
  for (const lang of ['english', 'russian']) for (let day = 0; day < 72; day++) {
    const content = ctx.getDefaultLessonContent(`lesson-${day}`, day, lang);
    assert.ok(content.homeworkParts.every(p => !policy.isPronunciationPart(p)));
  }
});

test('removed pronunciation bookmarks redirect; video marks done only on explicit confirmation', () => {
  const list = fs.readFileSync(path.join(root, 'student-app/app/(tabs)/resources/pronunciation/index.tsx'), 'utf8');
  assert.match(list, /Redirect href="\/resources\/library"/);
  const watch = fs.readFileSync(path.join(root, 'student-app/app/(tabs)/homework/lesson/[lessonId]/video/watch.tsx'), 'utf8');
  assert.equal((watch.match(/markDone\(/g) || []).length, 1);
  assert.match(watch, /onPress=\{async \(\) => \{ await markDone/);
  assert.match(watch, /disabled=\{!materials\?\.videoUrl\}/);
});
