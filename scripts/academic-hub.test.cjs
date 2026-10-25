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
    const live = hub.buildTeacherPlan(lesson, { lang: 'russian', prevReview: [{ q: 'Savol?' }] });
    assert.equal(live.mode, 'live');
    assert.equal(live.blocks.reduce((a, b) => a + b.share, 0), 100);
    assert.deepEqual(live.blocks.find(b => b.key === 'grammar').items.slice(0, 2), ['Я — men', 'Ты — sen'], 'sarlavhalar emas, qoidalar');
    assert.equal(live.shortBlocks.reduce((a, b) => a + b.share, 0), 100);
    assert.ok(live.anticipated.length >= 3 && live.differentiation.length === 2);
    assert.equal(live.blocks[0].items[0], 'Savol?');
    const video = hub.buildTeacherPlan({ ...lesson, type: 'video', slides: [], videoUrl: '' });
    assert.equal(video.mode, 'video');
    assert.ok(video.blocks.every(b => b.when));
});

test('reja bo\'yicha kutilgan dars (haftasiga 6 dars)', () => {
    const now = new Date('2026-10-26T12:00:00Z');
    assert.equal(hub.expectedLesson('2026-10-26', now), 1);
    assert.equal(hub.expectedLesson('2026-10-05', now), 19);
    assert.equal(hub.expectedLesson('2025-01-01', now), 72);
    assert.equal(hub.expectedLesson('', now), null);
    assert.equal(hub.expectedLesson('2027-01-01', now), null);
});

test('xatolar tarixi: takrorlar sanaladi, to\'g\'ri javob saqlanadi', () => {
    const a = hub.mergeMistakes([], [{ question: 'Q1', yourAnswer: 'x', correctAnswer: 'y' }], '2026-10-25T10:00:00Z');
    const b = hub.mergeMistakes(a, [{ question: 'Q1', yourAnswer: 'z', correctAnswer: '' }, { question: 'Q2', yourAnswer: '', correctAnswer: '' }], '2026-10-26T10:00:00Z');
    assert.equal(b.length, 2);
    const q1 = b.find(m => m.question === 'Q1');
    assert.equal(q1.count, 2); assert.equal(q1.yourAnswer, 'z'); assert.equal(q1.correctAnswer, 'y');
});

test('konspektdan sarlavha emas, qoidalar olinadi', () => {
    assert.deepEqual(hub.konspektRules('2-DARS (jonli dars)\nBugun ustoz bilan...\n1. Rod\n2. Kelishik'), ['1. Rod', '2. Kelishik']);
    assert.deepEqual(hub.konspektRules('3-DARS: Sonlar\nBu darsdan keyin siz...\nоди́н — bir\nдва — ikki'), ['оди́н — bir', 'два — ikki']);
    assert.deepEqual(hub.konspektRules('Faqat sarlavha\nva oddiy matn'), []);
});

test('sana Toshkent vaqtida', () => {
    assert.equal(hub.tzDay(new Date('2026-10-26T20:30:00Z')), '2026-10-27');
    assert.equal(hub.tzDay(new Date('2026-10-26T18:59:00Z')), '2026-10-26');
});
