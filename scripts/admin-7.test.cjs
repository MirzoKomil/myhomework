// BAHO-7 (Admin) tuzatishlari: bitta ta'riflar (Faol, bugungi darslar, ustoz o'quvchilari), stavka KPI sozlamasidan,
// qoplash summasi maosh bilan so'mgacha, xato holatlari "Qayta urinish" bilan, soat formati, haqiqiy .xlsx.
process.env.TZ = 'UTC';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('O\'quvchilar → Faol ro\'yxati: admin ham isActiveStudent bilan (faqat ROP emas)', () => {
    const app = read('js/app.js');
    assert.ok(/if \(!isTeacherRole && window\.AttendanceRules\?\.isActiveStudent\) students = students\.filter/.test(app));
    assert.ok(!/currentUser\?\.role === 'rop' && window\.AttendanceRules\?\.isActiveStudent/.test(app));
    const home = app.slice(app.indexOf('function computeAdminHome('), app.indexOf('function computeAdminHome(') + 6000);
    assert.ok(/AttendanceRules\?\.isActiveStudent/.test(home), 'Bosh "Faol o\'quvchilar" ham shu qoida');
    assert.ok(/lessonCount = lessons\.reduce\(\(n, l\) => n \+ l\.count, 0\)/.test(home), 'bugungi darslar — har o\'quvchi darsi');
});

test('Davomat stavkasi KPI sozlamasidan (payrollRates), qattiq RATES yo\'q; qoplash summasi 100 ga yaxlitlanmaydi', () => {
    const src = read('js/adminNazorat.js');
    assert.ok(!/const RATES\s*=/.test(src));
    assert.ok(/getC\('payrollRates'/.test(src));
    assert.ok(!/\/ 100\) \* 100/.test(src));
});

test('Qoplash summasi = maoshdagi farq so\'mgacha (payrollEngine: round(T·n/E))', () => {
    // Madina: 300 000, 14 darsdan 10 tasi → 214 286; +1 qoplash → 235 714; farq 21 428 (100 ga yaxlitlangani 21 400 edi).
    const payAt = (p, n) => Math.round(p.tariff * n / p.expected);
    const p = { tariff: 300000, expected: 14, lessons: 10 };
    assert.equal(payAt(p, 10), 214286);
    assert.equal(payAt(p, 11) - payAt(p, 10), 21428);
    const engine = require('../js/payrollEngine');
    assert.equal(typeof engine.calculate, 'function');
    const src = read('js/adminNazorat.js');
    assert.ok(/const payAt = \(p, n\) => Math\.round\(p\.tariff \* n \/ p\.expected\)/.test(src));
});

test('Hafta · bitta ustoz va Kun: /hours, /changes, /assist/plan xatosi yutilmaydi', () => {
    const src = read('js/scheduleV2.js');
    assert.ok(!/\/hours`\)\.catch\(\(\) => \(\{ hours: \[\] \}\)\)/.test(src));
    assert.ok(!/\/changes`\)\.catch\(\(\) => \(\{ changes: \[\] \}\)\)/.test(src));
    assert.ok(!/\/assist\/plan[^\n]*\.catch\(\(\) => null\)\]\);\n        const tmap/.test(src));
    assert.ok((src.match(/planErr = e/g) || []).length >= 2 && /chgErr = e/.test(src));
});

test('Soat formati: "49 soat 20 daq" (kasr yo\'q)', () => {
    const src = read('js/scheduleV2.js');
    const line = src.split('\n').find(l => l.includes('const hours = m =>'));
    const hours = eval(line.trim().replace(/^const hours = /, '(').replace(/;$/, ')'));
    assert.equal(hours(2960), '49 soat 20 daq');
    assert.equal(hours(3825), '63 soat 45 daq');
    assert.equal(hours(120), '2 soat');
    assert.equal(hours(40), '40 daq');
    assert.equal(hours(0), '0 soat');
});

test('Davomat "Excel" — haqiqiy .xlsx (js/vendor/xlsx), CSV emas', () => {
    const src = read('js/adminNazorat.js');
    assert.ok(/async function exportXlsx\(/.test(src) && /X\.writeFile\(wb, `davomat-/.test(src));
    assert.ok(!/text\/csv/.test(src));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'js/vendor/xlsx.full.min.js')));
});

test('Karta "O\'zgarishlar tarixi": qoplash qarori va aloqa tuzatishi ko\'rsatiladi; bloklar xatosi "Qayta urinish" bilan', () => {
    const src = read('js/schoolUI.js');
    assert.ok(/'makeup-approved'/.test(src) && /'assist-correct'/.test(src));
    assert.ok(!/swap\('\[data-attcard\]', `<p class="sc-mt scc-pad">\$\{esc\(e\.message\)\}/.test(src));
    assert.ok(/fail\('\[data-attcard\]'/.test(src));
    assert.ok(/O\.audit\(c, mk\.student_id, approve \? 'makeup-approved' : 'makeup-rejected'/.test(read('server/routes/school.js')));
    assert.ok(/auditCorrection\(/.test(read('server/services/school/assist.js')));
});

test('Ustoz o\'quvchilari bitta ta\'rif: "N faol + M muzlatilgan" (Davomat, Hafta · ustoz, Tekshirish)', () => {
    assert.ok(/function studentCounts\(/.test(read('js/adminNazorat.js')));
    assert.ok(/N\.countsLabel\(N\.studentCounts\(tid, st\.lang\)\)/.test(read('js/scheduleV2.js')));
    assert.ok(/N\.studentCounts\(who\.id, lang\)/.test(read('js/schoolCheck.js')));
});

test('Sinov lid oynasi: "Zapis" so\'zi yo\'q, drawer uslubida', () => {
    const t = read('js/trialUI.js');
    assert.ok(/Qo'ng'iroq yozuvlari/.test(t) && !/Zapis/.test(t));
    const app = read('js/app.js');
    const ov = app.slice(app.indexOf('function openLeadOverview('), app.indexOf('function openLeadCommentsModal('));
    assert.ok(!/>Zapis</.test(ov));
});
