// BAHO-6 (Admin) tuzatishlari: qoplash summasi bitta manba (server payroll stavkasi) va "kutmoqda" faqat maoshga
// o'tadigan qoplashlar; "Namuna o'quvchi" Davomatdan Mobil ilovaga; Akademik tablari; dark tokenlar; sana/vaqt maydonlari.
process.env.TZ = 'UTC';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../js/attendanceRules');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const mk = (id, held, extra = {}) => ({ id, status: 'review', teacher_id: 't1', student_id: 's1', missed_date: '2026-10-10', held_date: held, ...extra });

test('pendingMakeupPay: tekshiruvdagi qoplash summasi = soni × server stavkasi', () => {
    const row = { plan: 14, counted: 10, reviewList: [mk('a', '2026-10-26')] };
    assert.deepEqual(R.pendingMakeupPay(row, 21400), { ids: ['a'], count: 1, sum: 21400, over: [] });
});

test('pendingMakeupPay: oy rejasidan oshgan qoplash "kutmoqda"ga kirmaydi', () => {
    const row = { plan: 14, counted: 13, reviewList: [mk('b', '2026-10-27'), mk('a', '2026-10-26')] };
    const r = R.pendingMakeupPay(row, 20000);
    assert.deepEqual(r.ids, ['a']); // birinchi o'tilgani sig'adi
    assert.deepEqual(r.over, ['b']);
    assert.equal(r.sum, 20000);
    assert.equal(R.pendingMakeupPay({ plan: 14, counted: 14, reviewList: [mk('a', '2026-10-26')] }, 20000).sum, 0);
});

test('pendingMakeupPay: stavka noma\'lum (Moliya yiqilgan) — summa null, soxta 0 emas', () => {
    const r = R.pendingMakeupPay({ plan: 14, counted: 10, reviewList: [mk('a', '2026-10-26')] }, null);
    assert.equal(r.sum, null); assert.equal(r.count, 1);
});

test('monthTotals + pendingMakeupPay: qoldirilgan kunda "Keldi" bor qoplash maoshga o\'tmaydi (kutmoqda yig\'indisiga kirmaydi)', () => {
    const s = { id: 's1', teacherId: 't1', lessonDayOfWeek: 2, lessonTime: '11:00', lessonDuration: 60, startDate: '2026-10-01', status: 'active' };
    const makeups = [
        { id: 'ok', status: 'review', teacher_id: 't1', student_id: 's1', missed_date: '2026-10-24', held_date: '2026-10-26' },
        { id: 'came', status: 'review', teacher_id: 't1', student_id: 's1', missed_date: '2026-10-15', held_date: '2026-10-29' }
    ];
    const t = R.monthTotals({ id: 't1', month: '2026-10', students: [s], mainAtt: { s1: { 15: 1, 24: 0 } }, makeups, teacher: {}, todayKey: '2026-10-30', nowMin: 660 });
    const row = t.rows[0];
    const p = R.pendingMakeupPay(row, 21400);
    assert.deepEqual(p.ids, ['ok']);
    assert.equal(p.sum, 21400);
});

test('Qoplash sahifasi va Davomat bitta stavka manbasidan (payRate / payroll), mijozdagi calculateKpiSalary emas', () => {
    const src = read('js/adminNazorat.js');
    assert.ok(!/function lessonRate\(/.test(src), 'eski mijoz stavkasi olib tashlangan');
    assert.ok(!/calculateKpiSalary/.test(src.replace(/\/\/.*$/gm, '')), 'calculateKpiSalary chaqirilmaydi');
    assert.ok(/payRate\(payKpi\(pays\.get/.test(src), 'Qoplash sahifasi payroll stavkasini oladi');
    assert.ok(/pendingPay\(/.test(src));
});

test('"Namuna o\'quvchi" Davomat sahifasida yo\'q — Mobil ilova → Ilovani ko\'rish ichida; ro\'yxat faqat faol, demosiz', () => {
    const html = read('index.html');
    const att = html.slice(html.indexOf('id="tpAttendance"'), html.indexOf('data-teachers-panel="trial"'));
    assert.ok(!att.includes('demoStudentSelect'));
    const view = html.slice(html.indexOf('id="mobileViewPanel"'), html.indexOf('id="studentAppFrame"'));
    assert.ok(view.includes('id="demoStudentSelect"'));
    const app = read('js/app.js');
    const fn = app.slice(app.indexOf('function _populateDemoStudentSelect'), app.indexOf('function _populateDemoStudentSelect') + 2500);
    assert.ok(/isStaffDemoStudent\(s\)/.test(fn) && /isActiveStudent/.test(fn));
});

test('Akademik tab qatori dizayndagidek 6 ta; Telegram guruhlar O\'quvchilar navigatsiyasida admin uchun ham', () => {
    const html = read('index.html');
    const nav = html.slice(html.indexOf('id="teachersSectionNav"'), html.indexOf('</nav>', html.indexOf('id="teachersSectionNav"')));
    assert.equal((nav.match(/<button/g) || []).length, 6);
    assert.ok(/data-go-tab="school-groups" data-go-roles="admin boshliq rop"/.test(html));
});

test('Dark: --surface-2 va --bg-secondary aniqlangan (drawer pastki paneli oq emas)', () => {
    const css = read('css/kobalt.css');
    const dark = css.slice(css.indexOf('html.rd[data-theme="dark"] {'), css.indexOf('}', css.indexOf('html.rd[data-theme="dark"] {')));
    assert.ok(/--surface-2:\s*#/.test(dark));
    assert.ok(/--bg-secondary:\s*#/.test(dark));
});

test('Drawer sana/vaqt maydonlari CRM sana maydoni (.team-date) bilan, 24 soatlik', () => {
    const src = read('js/schoolUI.js');
    assert.ok(/function uzFields\(/.test(src) && /watchFields\(wrap\)/.test(src));
    assert.ok(/'kk\.oo\.yyyy'/.test(src) && /'ss:dd'/.test(src));
});

test('Bo\'sh vaqt: ish vaqti kiritilmagan ustozga "bo\'sh: 07:00" taklif qilinmaydi', () => {
    assert.ok(/noHours/.test(read('server/routes/school.js')));
    const src = read('js/schoolUI.js');
    assert.ok(/alt: times\.noHours \? null : nearestTime\(/.test(src));
});
