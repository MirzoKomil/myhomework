// 11-noyabr (direktor): Faol = holat belgisi; Qarzdor = faol + qarz > 0.
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/attendanceRules.js');
const past = '2026-01-01';

test('holat belgisi flaglardan ustun', () => {
    assert.equal(R.isActiveStudent({ status: 'active', statusHistory: [{ status: 'left', from: past }] }), false);
    assert.equal(R.isActiveStudent({ frozen: true, statusHistory: [{ status: 'frozen', from: past, to: '2026-02-01' }] }), true);
    assert.equal(R.studentStateNow({ statusHistory: [{ status: 'frozen', from: past }] }), 'frozen');
    assert.equal(R.studentStateNow({ statusHistory: [{ status: 'left', from: past }] }), 'left');
    assert.equal(R.isActiveStudent({ statusHistory: [{ status: 'left', from: '2999-01-01' }] }), true, 'kelajakdagi ketish hali faol');
});

test('yozuvsiz eski o\'quvchi — flaglar avvalgidek', () => {
    assert.equal(R.isActiveStudent({}), true);
    assert.equal(R.isActiveStudent({ frozen: true }), false);
    assert.equal(R.isActiveStudent({ status: 'inactive' }), false);
    assert.equal(R.isActiveStudent({ isStaffDemo: true }), false);
});

test('qarzdor = faol + qarz > 0', () => {
    assert.equal(R.isDebtor({ debtAmount: 300000 }), true);
    assert.equal(R.isDebtor({ debtAmount: 300000, statusHistory: [{ status: 'left', from: past }] }), false, 'ketgan — Ketganlar qarzi');
    assert.equal(R.isDebtor({ debtAmount: null, paymentDueDate: past }), false, 'summasi kiritilmagan');
    assert.equal(R.isDebtor({ debtAmount: 0 }), false);
});
