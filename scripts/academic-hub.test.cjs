// node --test scripts/academic-hub.test.cjs
// Darslik markazi (server/services/academicHub.js) — bazasiz qismlar.
const test = require('node:test');
const assert = require('node:assert/strict');
const hub = require('../server/services/academicHub');

test('dars bajarilishi ilovadagi formula bilan bir xil', () => {
    assert.equal(hub.lessonPercent({ videoWatch: true, vocabList: true, vocabPractice: true, homeworkParts: { a: true, b: true } }, true, 2), 100);
    assert.equal(hub.lessonPercent({ slidesWatch: true, vocabList: true, homeworkParts: { a: true } }, false, 3), 61);
    assert.equal(hub.lessonPercent({ videoWatch: true }, false, 0), 0, 'jonli darsda video emas, slaydlar hisoblanadi');
    assert.equal(hub.lessonPercent(undefined, true, 4), 0);
});

test('kitob sahifalari xaritasi tozalanadi', () => {
    assert.deepEqual(hub.cleanPageMap('1:5, 2:9; 3=14\n99:1, x:2, 4:0'), { 1: 5, 2: 9, 3: 14 });
    assert.deepEqual(hub.cleanPageMap({ 5: '20', 6: 'a' }), { 5: 20 });
});

test('material tekshiruvi: tur, dars raqami, xavfsiz havola', () => {
    const ok = hub.cleanMaterial({ language: 'russian', lessonNo: 3, kind: 'live_slides', title: ' Slayd ', url: '/uploads/a-1.pdf' });
    assert.equal(ok.title, 'Slayd');
    assert.throws(() => hub.cleanMaterial({ language: 'russian', lessonNo: 3, kind: 'live_slides', title: 'x', url: 'javascript:alert(1)' }), /Havola/);
    assert.throws(() => hub.cleanMaterial({ language: 'russian', lessonNo: 3, kind: 'live_slides', title: 'x', url: 'http://a.uz/x' }), /Havola/);
    assert.throws(() => hub.cleanMaterial({ language: 'russian', lessonNo: 73, kind: 'live_slides', title: 'x', url: '/uploads/a.pdf' }), /1–72/);
    assert.throws(() => hub.cleanMaterial({ language: 'russian', lessonNo: null, kind: 'live_slides', title: 'x', url: '/uploads/a.pdf' }), /Kurs/);
    assert.throws(() => hub.cleanMaterial({ language: 'german', lessonNo: 1, kind: 'extra', title: 'x', url: '/uploads/a.pdf' }), /Til/);
    const book = hub.cleanMaterial({ language: 'english', lessonNo: null, kind: 'book', title: 'B', url: 'https://x.uz/b.pdf', meta: { lessonFrom: '25', lessonTo: '48', pageMap: '25:3' } });
    assert.deepEqual(book.meta, { lessonFrom: 25, lessonTo: 48, pageMap: { 25: 3 } });
});

test('dars rejasi: jonli dars 100% ulush, video — yo\'riqnoma', () => {
    const lesson = { type: 'live', name: 'Tanishuv', cando: 'Tanishtiraman', vocabulary: [{ word: 'приве́т' }], audioDialogs: [], dialog: null, text: null,
        konspekt: '1-DARS\nKirish matni\n* Я — men\n* Ты — sen', speaking: [{ ru: 'Как тебя́ зову́т?', uz: '' }], homework: [{ title: 'Test', kind: 'multipleChoice', questions: 5 }] };
    const live = hub.buildTeacherPlan(lesson, { prevReview: [{ q: 'Savol?' }] });
    assert.equal(live.mode, 'live');
    assert.equal(live.blocks.reduce((a, b) => a + b.share, 0), 100);
    assert.deepEqual(live.blocks.find(b => b.key === 'grammar').items, ['Я — men', 'Ты — sen'], 'sarlavhalar emas, qoidalar');
    assert.equal(live.blocks[0].items[0], 'Savol?');
    const video = hub.buildTeacherPlan({ ...lesson, type: 'video', slides: [], videoUrl: '' });
    assert.equal(video.mode, 'video');
    assert.equal(video.blocks.reduce((a, b) => a + b.share, 0), 100);
});

test('reja bo\'yicha kutilgan dars (haftasiga 6 dars)', () => {
    const now = new Date('2026-10-26T12:00:00Z');
    assert.equal(hub.expectedLesson('2026-10-26', now), 1);
    assert.equal(hub.expectedLesson('2026-10-05', now), 19);
    assert.equal(hub.expectedLesson('2025-01-01', now), 72);
    assert.equal(hub.expectedLesson('', now), null);
    assert.equal(hub.expectedLesson('2027-01-01', now), null);
});

test('tracking: o\'quvchi tokensiz rad etiladi, noto\'g\'ri yozuvlar tashlanadi', async () => {
    const queries = [];
    const pool = { query: async (sql, params) => { queries.push([sql, params]); return { rows: [] }; } };
    await assert.rejects(hub.recordTracking(pool, null, {}), /avtorizatsiya/);
    const now = new Date('2026-10-26T10:00:00Z');
    const res = await hub.recordTracking(pool, 's1', {
        time: [{ day: '2026-10-26', lessonId: 'l1', section: 'video', seconds: 5000 }, { day: '2026-10-27', section: 'x', seconds: 5 },
            { day: '2026-10-20', section: 'x', seconds: 5 }, { day: '2026-10-26', section: '../etc', seconds: 5 }, { day: '2026-10-26', section: 'vazifa', seconds: -3 }],
        parts: [{ lessonId: 'l1', partId: 'p', correct: 12, total: 10, mistakes: ['a', { question: 'b', yourAnswer: 'x' }] }, { lessonId: 'l1', partId: '', total: 3 }],
    }, now);
    assert.deepEqual(res, { ok: true, time: 1, parts: 1 });
    assert.equal(queries[0][1][4], 900, '15 daqiqa chegarasi');
    const partParams = queries[1][1];
    assert.equal(partParams[5], 10, "to'g'ri javob jami sondan oshmaydi");
    assert.equal(partParams[7], 100);
    assert.deepEqual(JSON.parse(partParams[9]), [{ question: 'a' }, { question: 'b', yourAnswer: 'x', correctAnswer: '' }]);
});
