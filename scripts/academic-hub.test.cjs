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

test('dars daqiqalari: jami aynan davomiylik, har blok minimumidan kam emas', () => {
    const plan = hub.buildTeacherPlan({ type: 'live', name: 'X', cando: '', vocabulary: [], audioDialogs: [], dialog: null, text: null, konspekt: '', speaking: [], homework: [] }, { lang: 'russian' });
    for (const [set, durations] of [[plan.blocks, [36, 45, 60, 80, 90]], [plan.mediumBlocks, [21, 25, 30, 35]], [plan.shortBlocks, [10, 15, 20]]]) {
        for (const d of durations) {
            const mins = hub.allocateMinutes(set, d);
            assert.equal(mins.reduce((a, b) => a + b, 0), d, `jami ${d}`);
            if (set.reduce((a, b) => a + (b.min || 1), 0) <= d) set.forEach((b, i) => assert.ok(mins[i] >= (b.min || 1), `${b.key} ${d} daqiqada ${mins[i]}`));
        }
    }
    assert.ok(hub.allocateMinutes(plan.mediumBlocks, 30).at(-1) >= 4, 'xato tuzatishga kamida 4 daqiqa');
});

test('jadval bo\'yicha kutilgan jonli darslar (1/3/5)', () => {
    const now = new Date('2026-10-26T09:00:00Z'); // dushanba
    assert.equal(hub.expectedLiveLessons({ lessonDayOfWeek: 1, lessonTime: '18:00', startDate: '2026-10-19' }, now), 3, 'bugungi dars (18:00) hali bo\'lmagan');
    assert.equal(hub.expectedLiveLessons({ lessonDayOfWeek: 1, lessonTime: '10:00', startDate: '2026-10-19' }, now), 4, 'du, chor, ju, du (14:00 da)');
    assert.equal(hub.expectedLiveLessons({ lessonDayOfWeek: 1, lessonTime: '10:00', startDate: '2025-01-01' }, now), 36, '36 jonli darsdan oshmaydi');
    assert.equal(hub.expectedLiveLessons({ lessonDayOfWeek: 1, lessonTime: '', startDate: '2026-10-19' }, now), null);
    assert.equal(hub.expectedLiveLessons({ lessonDayOfWeek: 2, lessonTime: '18:00', startDate: '2026-11-01' }, now), null);
});

// /track — soxta pool bilan: kurs tekshiruvi, bo'lim, savollar soni, vaqt budjeti, kunlik chegara, 429.
function fakePool({ todayUsed = 0 } = {}) {
    const mc = { courses: [{ id: 'c1', lang: 'russian' }], lessons: [{ id: 'L1', courseId: 'c1' }, { id: 'L2', courseId: 'c1' }],
        lessonContents: { L1: { homeworkParts: [{ id: 'p1', kind: 'fillBlank', title: "Bo'sh joy", blanks: [{ sentence: 'Я ___', answer: 'студент' }, { sentence: 'Ты ___', answer: 'врач' }] }] },
            'bonus-2-russian': { homeworkParts: [{ id: 'b1', kind: 'multipleChoice', questions: [{ question: 'Q', options: ['a'], correctIndex: 0 }] }] } },
        examContents: { 'interval-1-russian': { questions: [] } } };
    const log = [];
    return { log, query: async (sql, params = []) => {
        log.push([sql.replace(/\s+/g, ' ').trim(), params]);
        if (/FROM students WHERE id=\$1/.test(sql)) return { rows: params[0] === 's1' ? [{ id: 's1', subject: 'russian', extra: {} }] : [] };
        if (/FROM mobile_content/.test(sql)) return { rows: [{ data: mc }] };
        if (/SUM\(seconds\)/.test(sql)) return { rows: todayUsed ? [{ day: params[1][0], s: todayUsed }] : [] };
        return { rows: [] };
    } };
}

test('/track: tekshiruvlar va chegaralar', async () => {
    hub._resetCache();
    const now = new Date('2026-10-26T10:00:00Z');
    const pool = fakePool();
    await assert.rejects(hub.recordTracking(pool, null, {}), /avtorizatsiya/);
    await assert.rejects(hub.recordTracking(pool, 'ghost', {}, now), /topilmadi/);
    const r = await hub.recordTracking(pool, 's1', {
        time: [{ day: '2026-10-26', lessonId: 'L1', section: 'video', seconds: 600 }, { day: '2026-10-26', lessonId: 'L1', section: 'video', seconds: 600 },
            { day: '2026-10-26', lessonId: 'BEGONA', section: '../x', seconds: 60 }, { day: '2026-10-10', section: 'video', seconds: 60 }],
        parts: [{ lessonId: 'L1', partId: 'p1', correct: 99, total: 999, mistakes: [{ question: 'Я ___', yourAnswer: 'врач' }, 'Я ___'] },
            { lessonId: 'L1', partId: 'yoq', correct: 1 }, { lessonId: 'BEGONA', partId: 'p1', correct: 1 }, { lessonId: 'bonus-2', partId: 'b1', correct: 1 }],
        exams: [{ examId: 'interval-1', scorePercent: 72, passed: true }, { examId: 'interval-99', scorePercent: 50 }, { examId: 'final; DROP', scorePercent: 1 }],
    }, now);
    assert.equal(r.parts, 2, 'p1 va rus bonus darsi');
    assert.equal(r.exams, 1);
    assert.equal(r.skipped, 5);
    const ins = pool.log.find(([q]) => q.startsWith('INSERT INTO student_learning_time'));
    // birinchi yuborish: 900 soniya budjet; L1/video jamlanadi, begona dars '' va bo'lim 'boshqa' bo'ladi
    assert.deepEqual(ins[1], ['s1', '2026-10-26', 'L1', 'video', 900]);
    assert.ok(/\(\$1, \$2::date, \$3, \$4, \$5::int\)$/.test(ins[0].split('VALUES ')[1].split(' ON')[0]), 'parametr raqamlari');
    assert.equal(r.skippedSeconds, 1200 + 60 - 900);
    const part = pool.log.find(([q, p]) => q.startsWith('INSERT INTO student_part_results') && p[2] === 'p1')[1];
    assert.equal(part[6], 2, 'savollar soni serverdan'); assert.equal(part[5], 2, "to'g'ri javob jamidan oshmaydi");
    const pm = JSON.parse(part[9]);
    assert.equal(pm.length, 1); assert.equal(pm[0].correctAnswer, 'студент'); assert.equal(pm[0].yourAnswer, 'врач');
    // darhol ikkinchi yuborish: haqiqatda o'tgan vaqtdan (0 s) ko'p hisoblanmaydi
    const pool2 = fakePool();
    const r2 = await hub.recordTracking(pool2, 's1', { time: [{ day: '2026-10-26', section: 'mashq', seconds: 300 }] }, new Date(now.getTime() + 1000));
    assert.equal(r2.time, 1);
    assert.equal(pool2.log.find(([q]) => q.startsWith('INSERT INTO student_learning_time'))[1][4], 1);
    // oflayn navbat (kecha) — budjet emas, kunlik 8 soat chegarasi ishlaydi
    const pool3 = fakePool({ todayUsed: 8 * 3600 - 100 });
    const r3 = await hub.recordTracking(pool3, 's1', { time: [{ day: '2026-10-25', section: 'video', seconds: 3000 }] }, new Date(now.getTime() + 2000));
    assert.equal(pool3.log.find(([q]) => q.startsWith('INSERT INTO student_learning_time'))[1][4], 100);
    assert.equal(r3.skippedSeconds, 2900);
    // so'rovlar chegarasi
    for (let i = 0; i < 20; i++) await hub.recordTracking(fakePool(), 's1', {}, now).catch(() => {});
    await assert.rejects(hub.recordTracking(fakePool(), 's1', {}, now), /juda ko'p/);
    hub._resetCache();
});
