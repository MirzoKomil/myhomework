process.env.TZ = 'Asia/Tashkent';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { functionSource } = require('./helpers/lead-workflow-fixture.cjs');

function render(student, mainAttendance, now = '2026-10-20T16:50:00+05:00') {
    const RealDate = Date;
    class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return new RealDate(now).getTime(); } }
    const store = { hrEmployees: [{ id: 't1', name: 'Zulayho Majitova', role: 'ingliz-oqituvchi' }], mainAttendance };
    const c = vm.createContext({
        Date: FakeDate, Math, Number, Object, String, Set, Array,
        STORAGE_KEYS: { teachers: 'teachers', hrEmployees: 'hrEmployees', mainAttendance: 'mainAttendance' },
        getItem: (k, d) => store[k] || d, escapeHtml: x => String(x).replace(/</g, '&lt;'),
        countStudentAttendance: () => 23,
        DAYS_UZ: ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'],
        teacherAttendanceCalendar: require('../js/teacherAttendanceCalendar.js'),
    });
    vm.runInContext(functionSource('js/app.js', 'sdpAttMark') + functionSource('js/app.js', 'renderSdpAttendance') + '\nthis.r = renderSdpAttendance;', c);
    return c.r(student);
}
const s = { id: 's1', teacherId: 't1', lessonDayOfWeek: 1, lessonTime: '14:00' };

test('summary, per-month counts and chips', () => {
    const html = render(s, {
        '2026-10_t1': { s1: { 2: 1, 5: 1, 7: 0, 9: 1 } },
        '2026-09_t1': { s1: { 1: 1, 3: 1, 4: 1 } },  // 4-sentabr (payshanba) jadvalda yo'q, lekin belgilangan
    });
    assert.ok(html.includes('Zulayho Majitova') && html.includes('14:00') && html.includes('Dushanba, Chorshanba, Juma'));
    assert.ok(html.includes('>23<'), 'total attended kept');
    assert.ok(/Keldi <b>3<\/b> · Kelmadi <b>1<\/b>/.test(html), 'october counts');
    assert.ok(html.includes('4-kun: keldi'), 'off-schedule mark still shown');
    assert.ok(!html.includes('2-kun: belgilanmagan') || html.indexOf('2-kun: belgilanmagan') < html.indexOf('sentabr'), 'changed-schedule month shows only marked days');
    assert.ok(!/8-kun: belgilanmagan/.test(html.slice(html.indexOf('sentabr'))));
    assert.ok(html.includes('86%'), '6 of 7 marked lessons');
    assert.ok(html.includes('joriy oy'));
    assert.ok(html.includes('23-kun: dars kutilmoqda'));
    assert.ok(html.includes('12-kun: belgilanmagan'));
});

test('current month shown even before first mark; no teacher → empty', () => {
    const html = render(s, {});
    assert.ok(html.includes('joriy oy') && html.includes('2-kun: belgilanmagan'));
    assert.ok(render({ id: 's2' }, {}).includes("Davomat ma'lumotlari yo'q"));
});

test('legacy truthy marks count as present', () => {
    const html = render(s, { '2026-10_t1': { s1: { 2: true, 5: '1', 7: false } } });
    assert.ok(/Keldi <b>2<\/b> · Kelmadi <b>1<\/b>/.test(html));
});
