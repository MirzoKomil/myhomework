process.env.TZ = 'Asia/Tashkent';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { computeTeacherRating, expandLessonPatternDays, daysElapsedThisMonthFor, monthKeySuffix } = require('../server/services/teacherRating');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const stateRoutes = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'state.js'), 'utf8');

test('expandLessonPatternDays: MWF/TTS qolipi va yakka kun', () => {
    assert.deepEqual(expandLessonPatternDays(1), [1, 3, 5]);
    assert.deepEqual(expandLessonPatternDays(3), [1, 3, 5]);
    assert.deepEqual(expandLessonPatternDays(5), [1, 3, 5]);
    assert.deepEqual(expandLessonPatternDays(2), [2, 4, 6]);
    assert.deepEqual(expandLessonPatternDays(7), [7]);
});

test('daysElapsedThisMonthFor: faqat shu oy boshidan bugungacha, frozen/tark-etdi oʻquvchi hisobga olinmaydi', () => {
    const now = new Date(Date.UTC(2026, 9, 20)); // 2026-10-20, seshanba (UTC dow=2)
    // Dush/Chor/Juma qolipi, 2026-10-01 dan 20-gacha: 2,5,7,9,12,14,16,19 -> 8 kun
    const s = { lessonDayOfWeek: 1, lessonTime: '10:00' };
    assert.equal(daysElapsedThisMonthFor(s, now), 8);
    assert.equal(daysElapsedThisMonthFor({ ...s, frozen: true }, now), 0);
    assert.equal(daysElapsedThisMonthFor({ ...s, status: 'tark-etdi' }, now), 0);
    assert.equal(daysElapsedThisMonthFor({ lessonDayOfWeek: null, lessonTime: '10:00' }, now), 0);
    // Shu oyning 16-sidan qo'shilgan o'quvchi uchun faqat 17 va 19 hisoblanadi (2 kun)
    assert.equal(daysElapsedThisMonthFor({ ...s, startDate: '2026-10-16' }, now), 2);
});

test('monthKeySuffix: att_key prefiksiga mos YYYY-MM', () => {
    assert.equal(monthKeySuffix(new Date(Date.UTC(2026, 9, 20))), '2026-10');
    assert.equal(monthKeySuffix(new Date(Date.UTC(2026, 0, 3))), '2026-01');
});

test("computeTeacherRating: ball = davomat 60% + o'zlashtirish 40%, faqat bir xil turdagi ustozlar orasida, xom ma'lumot qaytmaydi", () => {
    const now = new Date(Date.UTC(2026, 9, 20));
    const state = {
        teachers: [
            { id: 't1', name: 'Zokir Ahmedov', type: 'asosiy' },
            { id: 't2', name: 'Madina Yusupova', type: 'asosiy' },
            { id: 't3', name: 'Yangi Ustoz', type: 'asosiy' }, // hali o'quvchisi yo'q - reytingda bo'lmaydi
            { id: 'y1', name: 'Yordamchi U', type: 'yordamchi' },
        ],
        students: [
            { id: 's1', teacherId: 't1', lessonDayOfWeek: 1, lessonTime: '10:00' }, // 8 kun
            { id: 's2', teacherId: 't2', lessonDayOfWeek: 2, lessonTime: '10:00' }, // 9 kun
            { id: 's3', assistantTeacherId: 'y1', lessonDayOfWeek: 1, lessonTime: '11:00' },
        ],
        mainAttendance: {
            '2026-10_t1': { s1: { 2: 1, 5: 1, 7: 1, 9: 1, 12: 1, 14: 1, 16: 1, 19: 1 } }, // 8/8 = 100%
            '2026-10_t2': { s2: { 1: 1, 3: 1, 6: 1 } }, // 3/9 = 33%
        },
        assistantAttendance: { '2026-10_y1': { s3: { 1: 1 } } },
        // Eski baholar endi reytingga ta'sir qilmaydi
        liveGrades: { s2: [{ teacherId: 't2', date: '2026-10-04', scores: { attendance: 5 } }] },
    };
    const rows = computeTeacherRating(state, 'asosiy', now, { s1: 80, s2: 60 });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].id, 't1');
    assert.equal(rows[0].score, Math.round(100 * 0.6 + 80 * 0.4));
    assert.equal(rows[0].learnPct, 80);
    assert.equal(rows[1].id, 't2');
    assert.equal(rows[1].score, Math.round((300 / 9) * 0.6 + 60 * 0.4));
    assert.equal(rows[0].total, 2);
    assert.ok(!rows.some(r => r.id === 'y1'));
    const json = JSON.stringify(rows);
    assert.ok(!json.includes('scores'));
    assert.ok(!json.includes('mainAttendance'));
});

test("computeTeacherRating: ilova ma'lumoti bo'lmasa ball faqat davomatdan (ustoz jazolanmaydi); yordamchilar alohida", () => {
    const now = new Date(Date.UTC(2026, 9, 20));
    const state = {
        teachers: [{ id: 'y1', name: 'Yordamchi Bir', type: 'yordamchi' }],
        students: [{ id: 's1', assistantTeacherId: 'y1', lessonDayOfWeek: 1, lessonTime: '10:00' }],
        mainAttendance: {},
        assistantAttendance: { '2026-10_y1': { s1: { 1: 1, 3: 1 } } },
    };
    const rows = computeTeacherRating(state, 'yordamchi', now);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].learnPct, null);
    assert.equal(rows[0].score, rows[0].davomatPct);
});

test('server/routes/state.js: /teacher-rating ustoz va rahbarlar uchun, getFullState va ilova natijalari orqali hisoblaydi', () => {
    assert.match(stateRoutes, /router\.get\('\/teacher-rating', authRequired, async \(req, res\) => \{/);
    const fn = stateRoutes.slice(stateRoutes.indexOf("router.get('/teacher-rating'"), stateRoutes.indexOf("router.get('/teacher-rating'") + 4000);
    assert.match(fn, /\['admin', 'rop', 'boshliq'\]\.includes\(role\)/);
    assert.match(fn, /teacherDuties\.teacherForActor\(pool, req\.user\)/);
    assert.match(fn, /await getFullState\(\)/);
    // O'tgan oy (?month=) va ▲/▼ solishtiruvi: ratingResponse; o'zlashtirish — loadLearningByStudent (sana/oy bo'yicha).
    assert.match(fn, /loadLearning: \(now, opts\) => loadLearningByStudent\(pool, now, opts\)/);
    assert.match(fn, /await ratingResponse\(\{ state, ownType, month: String\(req\.query\.month \|\| ''\), makeups,/);
    // Ustozga boshqalarning faqat ism/ball/o'rni.
    assert.match(fn, /\{ id: r\.id, name: r\.name, score: r\.score, rank: r\.rank, total: r\.total, prevRank: r\.prevRank, prevScore: r\.prevScore \}/);
});

// Ustoz Bosh sahifasida reyting kartochkasi serverdan alohida (/api/state/
// teacher-rating) olinadi va render qilingandan keyin to'ldiriladi -
// teacherHomeStats/renderTeacherTodayBlock state'ida boshqa ustozlarning
// davomat/baho ma'lumoti umuman bo'lmasligi buzilmaydi.
test('js/app.js: Ustoz Bosh sahifasi reyting kartochkasini apiFetchTeacherRating orqali alohida yuklaydi', () => {
    assert.match(app, /async function _loadTeacherHomeRating\(container\) \{/);
    const fn = app.slice(app.indexOf('async function _loadTeacherHomeRating('), app.indexOf('function renderTeacherHome('));
    assert.match(fn, /await apiFetchTeacherRating\(\);/);
    assert.match(fn, /Ball = davomat 60% \+ o'quvchilar o'zlashtirishi \(uy vazifasi, 1-urinish\) 40%/);
    assert.match(app, /data-thx-rating-kpi/);
    assert.match(app, /data-thx-rating-card/);
    assert.match(app, /_loadTeacherHomeRating\(container\);/);
});

test('js/app.js: UstozBosh "Bugun" — davomat Akademik → Davomat orqali (Bosh sahifada Keldi/Kelmadi yo\'q); yagona yozish yo\'li /api/state/teacher-attendance', () => {
    assert.match(app, /function bindTeacherHomeToday\(container, user\) \{/);
    const fn = app.slice(app.indexOf('function bindTeacherHomeToday('), app.indexOf('function isAdminHomeUser('));
    assert.doesNotMatch(fn, /data-thx-mark/, 'Bosh sahifada davomat tugmasi yo\'q (UstozBosh dizayni)');
    assert.match(fn, /data-thx-contact/, 'yordamchi aloqasi schoolTeacher.markDrawer orqali');
    assert.match(fn, /schoolTeacher\.markDrawer/);
    assert.match(app, /data-teacher-open-att/, '"Davomatni ochish →" Akademik → Davomatga');
    assert.doesNotMatch(app, /data-thx-grade="/, 'Mezonlar tugmasi yo\'q — o\'quvchiga baho qo\'yilmaydi');
    assert.match(app, /function _openLiveGradeModal\(studentName, dateStr, lessonOptions, onSave\) \{\s*onSave\(null\);/);
    assert.match(app, /async function saveTeacherAttendanceChange\(payload\) \{/);
    assert.match(fs.readFileSync(path.join(__dirname, '../js/api.js'), 'utf8'), /apiFetch\('\/api\/state\/teacher-attendance'/);
});
