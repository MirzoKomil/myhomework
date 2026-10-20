process.env.TZ = 'Asia/Tashkent';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { functionSource } = require('./helpers/lead-workflow-fixture.cjs');

function render(student, now = '2026-10-20T16:50:00+05:00') {
    const RealDate = Date;
    class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return new RealDate(now).getTime(); } }
    const store = {
        hrEmployees: [{ id: 't1', name: 'Zulayho Majitova', role: 'ingliz-oqituvchi' }, { id: 'y1', name: 'Nargiza Olimova', role: 'yordamchi' }, { id: 'm1', name: 'Bobur Aliyev', role: 'sotuv-menejeri' }],
        mainAttendance: { '2026-10_t1': { s1: { 2: 1, 5: 1, 7: 1, 9: 0, 12: 1 } } },
    };
    const c = vm.createContext({
        Date: FakeDate, Math, Number, Object, String,
        STORAGE_KEYS: { teachers: 'teachers', hrEmployees: 'hrEmployees', mainAttendance: 'mainAttendance' },
        getItem: k => store[k] || [], escapeHtml: x => String(x).replace(/</g, '&lt;'),
        formatMoney: n => n + " so'm", formatDateShort: d => d.split('-').reverse().join('.'), calculateAge: () => '18',
        addCourseDays: () => '30.12.2026', countStudentAttendance: () => 7,
        DAYS_UZ: ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'],
        expandLessonPatternDays: d => ([1, 3, 5].includes(+d) ? [1, 3, 5] : [2, 4, 6].includes(+d) ? [2, 4, 6] : [+d]),
        teacherAttendanceCalendar: require('../js/teacherAttendanceCalendar.js'),
    });
    vm.runInContext(functionSource('js/app.js', 'renderSdpProfile') + '\nthis.r = renderSdpProfile;', c);
    return c.r(student);
}
const base = { id: 's1', name: 'Abbos Normatov', phone: '+998900000065', teacherId: 't1', assistantTeacherId: 'y1', managerId: 'm1',
    subject: 'english', group: 'Elementary', startDate: '2026-10-01', lessonDayOfWeek: 1, lessonTime: '14:00',
    debtAmount: 1950000, paymentDueDate: '2026-10-15', paymentCount: 1, grade: '4,7', gender: 'erkak', region: 'Andijon' };

test('student card keeps every previous field', () => {
    const html = render(base);
    for (const text of ['Ism familiya', 'Abbos Normatov', 'Telefon', '+998900000065', 'Yoshi', 'Jinsi', 'Erkak', 'Viloyat', 'Andijon',
        'Fan', 'Ingliz tili', 'Dars boshlagan', '01.10.2026', 'Kurs tugash', '30.12.2026', 'Holati', "To'lov holati", 'Qarzdor: 1950000',
        'Asosiy ustoz', 'Zulayho Majitova', 'Yordamchi ustoz', 'Nargiza Olimova', 'Sotuv menejeri', 'Bobur Aliyev',
        'Kurs darajasi', 'Elementary', 'Dars kunlari', 'Dushanba, Chorshanba, Juma', 'Dars vaqti', '14:00', 'Baho', '4,7', 'Toʻlovlar soni']) {
        assert.ok(html.includes(text), 'missing: ' + text);
    }
});

test('agreed next payment date is shown and flagged when passed', () => {
    assert.match(render(base), /15\.10\.2026 · sana oʻtgan/);
    assert.doesNotMatch(render({ ...base, paymentDueDate: '2026-10-28' }), /sana oʻtgan/);
});

test('month attendance: scheduled Mon/Wed/Fri days with present/absent marks', () => {
    const html = render(base);
    assert.match(html, /<b>4 \/ 8<\/b>/, '4 came of 8 passed lesson days (2..19 Oct)');
    assert.match(html, /9-kun: kelmadi/);
    assert.match(html, /16-kun: belgilanmagan/);
    assert.match(html, /21-kun: dars kutilmoqda/);
});
