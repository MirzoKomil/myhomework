// 30-okt direktor qarori: xodim paroli oddiy — kamida 4 belgi (standart: telefonning oxirgi 4 raqami), faqat eskisidan farqli.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const sec = require('../server/services/authSecurity');

test('xodim: 4 raqamli parol qabul qilinadi, 3 ta — yo\'q, eskisi bilan bir xil — yo\'q', () => {
    const staff = { role: 'teacher' };
    assert.equal(sec.STAFF_MIN, 4);
    assert.equal(sec.checkNewPassword(staff, '9382', '4497'), null);
    assert.match(sec.checkNewPassword(staff, '9382', '449'), /kamida 4/);
    assert.match(sec.checkNewPassword(staff, '4497', '4497'), /farqli/);
});
test('o\'quvchi: kamida 6 belgi o\'zgarmaydi', () => {
    assert.match(sec.checkNewPassword({ role: 'student' }, '1', '12345'), /kamida 6/);
    assert.equal(sec.checkNewPassword({ role: 'student' }, '1', '123456'), null);
});
