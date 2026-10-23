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

test('computeTeacherRating: ball = davomat 60% + mezonlar 40%, faqat bir xil turdagi ustozlar orasida, xom ma\'lumot qaytmaydi', () => {
    const now = new Date(Date.UTC(2026, 9, 20));
    const state = {
        teachers: [
            { id: 't1', name: 'Zokir Ahmedov', type: 'asosiy' },
            { id: 't2', name: 'Madina Yusupova', type: 'asosiy' },
            { id: 't3', name: 'Yangi Ustoz', type: 'asosiy' }, // hali o'quvchisi yo'q - reytingda bo'lmaydi
            { id: 'y1', name: 'Yordamchi U', type: 'yordamchi' },
        ],
        students: [
            { id: 's1', teacherId: 't1', lessonDayOfWeek: 1, lessonTime: '10:00' }, // Dush/Chor/Juma -> 8 kun (2..19) 20-gacha
            { id: 's2', teacherId: 't2', lessonDayOfWeek: 2, lessonTime: '10:00' }, // Sesh/Pay/Shan -> 9 kun (1..20) 20-gacha
            { id: 's3', assistantTeacherId: 'y1', lessonDayOfWeek: 1, lessonTime: '11:00' },
        ],
        mainAttendance: {
            '2026-10_t1': { s1: { 2: 1, 5: 1, 7: 1, 9: 1, 12: 1, 14: 1, 16: 1, 19: 1 } }, // 8/8 = 100%
            '2026-10_t2': { s2: { 1: 1, 3: 1, 6: 1 } }, // 3/9 = 33%
        },
        assistantAttendance: { '2026-10_y1': { s3: { 1: 1 } } },
        liveGrades: {
            s1: [{ teacherId: 't1', date: '2026-10-19', scores: { attendance: 5, activity: 5, speaking: 5, understanding: 5, discipline: 5 } }], // 100%
            s2: [{ teacherId: 't2', date: '2026-10-04', scores: { attendance: 3, activity: 3, speaking: 3, understanding: 3, discipline: 3 } }], // 60%
        },
    };
    const rows = computeTeacherRating(state, 'asosiy', now);
    assert.equal(rows.length, 2); // t3 - kutilgan 0, reytingda yo'q
    assert.equal(rows[0].id, 't1');
    assert.equal(rows[0].rank, 1);
    assert.equal(rows[0].score, 100); // 100*0.6 + 100*0.4
    assert.equal(rows[1].id, 't2');
    assert.equal(rows[1].rank, 2);
    assert.equal(rows[1].score, Math.round(33 * 0.6 + 60 * 0.4));
    assert.equal(rows[0].total, 2);
    // Boshqa turdagi (yordamchi) ustozlar bu ro'yxatga kirmaydi
    assert.ok(!rows.some(r => r.id === 'y1'));
    // Javobda faqat yakuniy (ism, ball, o'rin) - xom davomat/baho qatorlari yo'q
    const json = JSON.stringify(rows);
    assert.ok(!json.includes('scores'));
    assert.ok(!json.includes('mainAttendance'));
});

test('computeTeacherRating: bir xil turdagi (yordamchi) ustozlar orasida alohida hisoblanadi', () => {
    const now = new Date(Date.UTC(2026, 9, 20));
    const state = {
        teachers: [{ id: 'y1', name: 'Yordamchi Bir', type: 'yordamchi' }],
        students: [{ id: 's1', assistantTeacherId: 'y1', lessonDayOfWeek: 1, lessonTime: '10:00' }],
        mainAttendance: {},
        assistantAttendance: { '2026-10_y1': { s1: { 1: 1, 3: 1 } } },
        liveGrades: {},
    };
    const rows = computeTeacherRating(state, 'yordamchi', now);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'y1');
    // Mezon yo'q -> mezonPct=0, faqat davomat*0.6 qo'shiladi
    assert.equal(rows[0].score, Math.round(rows[0].davomatPct * 0.6));
});

// Yangi /api/state/teacher-rating endpoint faqat ustoz roli uchun ochiq va
// getFullState()'dan foydalanadi (boshqa ustozlarning xom state'iga bog'liq
// emas) - routes/state.js'da to'g'ri ulanganini manba kodidan tekshiradi.
test('server/routes/state.js: /teacher-rating faqat ustoz uchun, getFullState orqali hisoblaydi, faqat yakuniy roʻyxat qaytaradi', () => {
    assert.match(stateRoutes, /router\.get\('\/teacher-rating', authRequired, async \(req, res\) => \{/);
    const fn = stateRoutes.slice(stateRoutes.indexOf("router.get('/teacher-rating'"), stateRoutes.indexOf("router.get('/teacher-rating'") + 900);
    assert.match(fn, /req\.user\?\.role !== 'teacher'/);
    assert.match(fn, /teacherDuties\.teacherForActor\(pool, req\.user\)/);
    assert.match(fn, /await getFullState\(\)/);
    assert.match(fn, /computeTeacherRating\(state, ownType\)/);
});

// Ustoz Bosh sahifasida reyting kartochkasi serverdan alohida (/api/state/
// teacher-rating) olinadi va render qilingandan keyin to'ldiriladi -
// teacherHomeStats/renderTeacherTodayBlock state'ida boshqa ustozlarning
// davomat/baho ma'lumoti umuman bo'lmasligi buzilmaydi.
test('js/app.js: Ustoz Bosh sahifasi reyting kartochkasini apiFetchTeacherRating orqali alohida yuklaydi', () => {
    assert.match(app, /async function _loadTeacherHomeRating\(container\) \{/);
    const fn = app.slice(app.indexOf('async function _loadTeacherHomeRating('), app.indexOf('function renderTeacherHome('));
    assert.match(fn, /await apiFetchTeacherRating\(\);/);
    assert.match(fn, /Ball = davomat 60% \+ mezonlar 40%/);
    assert.match(app, /data-thx-rating-kpi/);
    assert.match(app, /data-thx-rating-card/);
    assert.match(app, /_loadTeacherHomeRating\(container\);/);
});

test('js/app.js: "Bugungi darslar"da Keldi/Kelmadi va Mezonlar tugmalari mavjud davomat-saqlash oqimidan foydalanadi', () => {
    assert.match(app, /function bindTeacherHomeToday\(container, user\) \{/);
    const fn = app.slice(app.indexOf('function bindTeacherHomeToday('), app.length);
    assert.match(fn, /data-thx-mark/);
    assert.match(fn, /data-thx-as-mark/);
    assert.match(fn, /data-thx-grade/);
    assert.match(fn, /saveTeacherAttendanceChange\(\{ teacherId, studentId: sid, date: dateStr, present: true, grade \}\)/);
    assert.match(fn, /saveTeacherAttendanceChange\(\{ teacherId, studentId: sid, date: dateStr, present \}\)/);
});
