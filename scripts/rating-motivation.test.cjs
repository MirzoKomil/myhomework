process.env.TZ = 'Asia/Tashkent';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { functionSource } = require('./helpers/lead-workflow-fixture.cjs');

const src = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const constBlock = name => src.match(new RegExp('const ' + name + ' = [\\s\\S]*?\\n\\];'))[0];
const prizeMap = src.match(/const PRIZE_IMAGES = \{[\s\S]*?\n\};/)[0];

function ctx(now) {
    const RealDate = Date;
    class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return new RealDate(now).getTime(); } }
    const context = vm.createContext({
        Date: FakeDate, Math,
        escapeHtml: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]),
        fmtMoney: n => new Intl.NumberFormat('uz-UZ').format(n) + " so'm",
        getMergedBonus: b => b,
    });
    vm.runInContext(['DAILY_BONUSES', 'WEEKLY_BONUSES', 'MONTHLY_BONUSES'].map(constBlock).join('\n') + '\n' + prizeMap + '\n'
        + ['_prizeImg', '_monthDaysLeft', '_firstName', 'renderRatingMotivation'].map(n => functionSource('js/app.js', n)).join('\n')
        + '\nthis.render = renderRatingMotivation;', context);
    return context;
}
const ranked = [
    { name: 'Aziza Tursunova', sales: 72_800_000, target: 74_534_850 },
    { name: 'Bobur Aliyev', sales: 55_250_000, target: 74_534_850 },
    { name: '<b>X</b> Y', sales: 0, target: 74_534_850 },
];

test('monthly: leader gap to the next prize and per-day pace', () => {
    const html = ctx('2026-10-21T10:00:00+05:00').render(ranked, 'oylik');
    assert.match(html, /Oy poygasi · 11 kun qoldi/);
    assert.match(html, /Aziza iPhone 17 Pro sovgʻasiga/);
    assert.match(html, /images\/prizes\/prize-phone\.png/);
    assert.match(html, /images\/prizes\/prize-umra\.png/);
    assert.ok(!html.includes('<b>X</b>'), 'names are escaped');
});

test('daily: obed tiers and who reached them', () => {
    const daily = [{ name: 'Aziza T', sales: 3_150_000, target: 0 }, { name: 'Bobur A', sales: 1_950_000, target: 0 }, { name: 'Shoira K', sales: 0, target: 0 }];
    const html = ctx('2026-10-20T12:00:00+05:00').render(daily, 'kunlik');
    assert.match(html, /Bugun 2 ta menejer obed oldi/);
    assert.match(html, /Oldi: Aziza, Bobur/);
    assert.match(html, /prize-obed\.png/);
});

test('weekly: current holders of 1–3 places', () => {
    const html = ctx('2026-10-20T12:00:00+05:00').render(ranked, 'haftalik');
    assert.match(html, /Hafta lideri — Aziza/);
    assert.match(html, /prize-book\.png/);
    assert.match(html, /prize-restaurant\.png/);
});

test('empty list renders nothing', () => {
    assert.equal(ctx('2026-10-20T12:00:00+05:00').render([], 'oylik'), '');
});

test('manager home: gap to the next monthly prize, rank and today obed', () => {
    const c = ctx('2026-10-21T10:00:00+05:00');
    const sales = { a: { oylik: 72_800_000, kunlik: 3_150_000 }, b: { oylik: 55_250_000, kunlik: 1_950_000 } };
    c.getManagerSalesForPeriod = (id, p) => sales[id][p];
    c.getSalesManagers = () => [{ id: 'a', name: 'Aziza Tursunova' }, { id: 'b', name: 'Bobur Aliyev' }];
    c.getActiveSalesManagers = c.getSalesManagers;
    vm.runInContext(functionSource('js/app.js', 'renderManagerGoalBlock') + '\nthis.goal = renderManagerGoalBlock;', c);
    const html = c.goal('b', 'english');
    assert.match(html, /iPhone 17 Pro uchun yana 64\s750\s000/);
    assert.match(html, /reytingda 2-oʻrin, Azizadan 17\s550\s000/);
    assert.match(html, /✓ Obed/);
    assert.match(html, /uchun yana 550\s000/);
    assert.equal(c.goal('', 'english'), '');
});

test('ROP home: open escalations (unacknowledged only) and team plan', () => {
    const now = new Date('2026-10-20T16:50:00+05:00').getTime();
    const c = ctx('2026-10-20T16:50:00+05:00');
    Object.assign(c, {
        LEAD_SLA_MINUTE: 60000,
        parseLeadSlaTime: v => (v ? new Date(v).getTime() : 0),
        getLeadSlaManagerName: l => l.managerName || '—',
        getLeadSlaNotificationsForCurrentUser: () => [
            { audience: 'rop', leadLang: 'english', leadId: 'l1', stageKey: 's1', message: 'Muzlayapti', time: now - 25 * 3600000 },
            { audience: 'rop', leadLang: 'english', leadId: 'l2', stageKey: 's1', message: 'Koʻrilgan', time: now - 3600000 },
            { audience: 'rop', leadLang: 'russian', leadId: 'l3', stageKey: 's1', message: 'Boshqa til', time: now - 3600000 },
        ],
        getItem: () => ({ english: [{ id: 'l1', name: 'Islom V', managerName: 'Bobur' }, { id: 'l2', name: 'Madina', slaRopAcknowledged: { s1: '2026-10-20T12:00:00Z' } }], russian: [] }),
        STORAGE_KEYS: { leads: 'leads' },
        getSalesManagers: () => [{ id: 'a', name: 'Aziza' }, { id: 'b', name: 'Bobur' }],
        getActiveSalesManagers: () => [{ id: 'a', name: 'Aziza' }, { id: 'b', name: 'Bobur' }],
        getReportSalesManagers: () => [{ id: 'a', name: 'Aziza' }, { id: 'b', name: 'Bobur' }],
        staffStatus: require('../js/staffStatus'),
        getManagerSalesForPeriod: id => ({ a: 72_800_000, b: 55_250_000 })[id],
        getManagerPeriodTarget: () => 74_534_850,
        pctToPlanColor: () => '#000',
    });
    vm.runInContext(functionSource('js/app.js', 'renderRopDashboardBlock') + '\nthis.rop = renderRopDashboardBlock;', c);
    const html = c.rop({ role: 'rop', linkedRopLang: 'english' });
    assert.match(html, /1 ta ochiq/);
    assert.match(html, /Islom V/);
    assert.ok(!html.includes('Madina'), 'acknowledged escalation hidden');
    assert.ok(!html.includes('Boshqa til'), 'other direction hidden');
    assert.match(html, /24 soatdan oshdi/);
    assert.match(html, /86% · /);
    assert.equal(c.rop({ role: 'admin' }), '');
});

test('teacher home: today lessons by time with attendance state, no phones', () => {
    const c = ctx('2026-10-20T16:50:00+05:00'); // seshanba
    Object.assign(c, {
        STORAGE_KEYS: { students: 'students', mainAttendance: 'att', assistantAttendance: 'asatt' },
        getTeacherAssignmentIds: () => new Set(['t1']),
        resolveTeacherWithVirtual: () => ({ id: 't1', type: 'asosiy', subject: 'english' }),
        calculateKpiSalary: (t, m, store, list) => ({ total: 278_571, completed: 0, expected: 14 }),
        fmtMoney: n => n + " so'm",
        expandLessonPatternDays: d => ([1, 3, 5].includes(+d) ? [1, 3, 5] : [2, 4, 6].includes(+d) ? [2, 4, 6] : [+d]),
        getItem: k => k === 'students' ? [
            { id: 's2', name: 'Doniyor', phone: '+99890', teacherId: 't1', lessonDayOfWeek: 2, lessonTime: '16:00', lessonDuration: 30 },
            { id: 's1', name: 'Shohruh', teacherId: 't1', lessonDayOfWeek: 4, lessonTime: '15:30', lessonDuration: 15 },
            { id: 's3', name: 'Kamila', teacherId: 't1', lessonDayOfWeek: 6, lessonTime: '17:15', lessonDuration: 15 },
            { id: 's4', name: 'Boshqa', teacherId: 't9', lessonDayOfWeek: 2, lessonTime: '10:00' },
            { id: 's5', name: 'Juma', teacherId: 't1', lessonDayOfWeek: 1, lessonTime: '10:00' },
        ] : k === 'att' ? { '2026-10_t1': { s1: { 20: 1, 15: 1 }, s2: { 15: 1 } } } : {},
    });
    vm.runInContext(functionSource('js/app.js', 'renderTeacherTodayBlock') + '\nthis.t = renderTeacherTodayBlock;', c);
    const html = c.t({ role: 'teacher', linkedTeacherId: 't1' });
    assert.match(html, /3 dars · 1 tasi belgilanmagan/);
    assert.ok(html.indexOf('Shohruh') < html.indexOf('Doniyor') && html.indexOf('Doniyor') < html.indexOf('Kamila'), 'sorted by time');
    assert.match(html, /✓ Keldi/);
    assert.match(html, /Dars tugadi · davomat belgilanmagan/);
    assert.match(html, /Kutilmoqda/);
    assert.ok(!html.includes('Boshqa') && !html.includes('Juma') && !html.includes('+99890'));
    assert.match(html, /data-thx-todo/, '"Bajarish kerak" bloki serverdan keyin to\'ldiriladi');
    assert.ok(!html.includes('Yordamchi ustozlik') && !html.includes('aloqa'));
    assert.equal(c.t({ role: 'rop' }), '');
});

test('assistant home: contacts suggested on the opposite days, no old attendance buttons', () => {
    const c = ctx('2026-10-20T16:50:00+05:00'); // seshanba
    Object.assign(c, {
        STORAGE_KEYS: { students: 'students', mainAttendance: 'att', assistantAttendance: 'asatt' },
        getTeacherAssignmentIds: () => new Set(['y1']),
        expandLessonPatternDays: d => ([1, 3, 5].includes(+d) ? [1, 3, 5] : [2, 4, 6].includes(+d) ? [2, 4, 6] : [+d]),
        resolveTeacherWithVirtual: id => ({ id, name: id === 'z' ? 'Kamola Mirzayeva' : 'Yordamchi', type: 'yordamchi', subject: 'english' }),
        getItem: k => k === 'students' ? [
            { id: 'a', name: 'Abbos', teacherId: 'z', assistantTeacherId: 'y1', lessonDayOfWeek: 1, lessonTime: '19:00' },
            { id: 'b', name: 'Ilyos', teacherId: 'z', assistantTeacherId: 'y1', lessonDayOfWeek: 2, lessonTime: '18:00' },
            { id: 'c', name: 'Boshqa', teacherId: 'z', assistantTeacherId: 'y9', lessonDayOfWeek: 1, lessonTime: '10:00' },
            { id: 'd', name: 'Ketgan', teacherId: 'z', assistantTeacherId: 'y1', lessonDayOfWeek: 1, lessonTime: '11:00', status: 'inactive' },
        ] : {},
    });
    vm.runInContext(['_assistAdviceDays', '_thxTeacherShort', 'renderTeacherTodayBlock'].map(n => functionSource('js/app.js', n)).join('\n') + '\nthis.t = renderTeacherTodayBlock;', c);
    const html = c.t({ role: 'teacher', linkedTeacherId: 'y1' });
    assert.match(html, /Abbos[\s\S]*yordamchi aloqasi · asosiy ustoz Kamola M\./, 'Du·Ch·Ju o\'quvchisi — seshanba aloqa tavsiya');
    assert.ok(!html.includes('Ilyos'), 'Se·Pa·Sh o\'quvchisi seshanba kuni tavsiya qilinmaydi');
    assert.ok(!html.includes('Boshqa') && !html.includes('Ketgan'));
    assert.match(html, /data-thx-contact="a"/);
    assert.ok(!html.includes('data-thx-as-mark') && !html.includes('mashgʻulot'));
    assert.match(html, /0 dars \+ 1 aloqa/);
});
