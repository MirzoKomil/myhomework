const { test } = require('node:test');
const assert = require('node:assert/strict');
const scope = require('../server/services/stateScope');

const hr = () => ([
    { id: 'e1', name: 'Bobur Aliyev', login: 'bobur@x.uz', phone: '+998901', cardNumber: '8600111122223333',
      passportSeries: 'AA1234567', pinfl: '12345678901234', address: 'Andijon', birthDate: '1995-01-01', role: 'sotuv-menejeri' },
    { id: 'e2', name: 'Aziza T', login: 'aziza@x.uz', phone: '+998902', cardNumber: '8600999988887777',
      passportSeries: 'AB7654321', pinfl: '43210987654321', address: 'Toshkent', birthDate: '1996-02-02', role: 'sotuv-menejeri' },
]);
const baseState = () => ({
    hrEmployees: hr(),
    students: [
        { id: 's1', name: 'Own', phone: '+99890111', managerId: 'm1', parentPhone: '+9989', debtAmount: 100 },
        { id: 's2', name: 'ViaLead', phone: '+99890222', leadRef: { id: 'l1' } },
        { id: 's3', name: 'Other', phone: '+99890333', managerId: 'm2', email: 'o@x.uz', subject: 'english', debtAmount: 50 },
        { id: 's4', name: 'Demo', phone: '+99890444', managerId: 'm1', isStaffDemo: true },
    ],
    leads: { english: [{ id: 'l1', managerId: 'm1' }], russian: [] },
    payments: [{ id: 'p1', studentId: 's1' }, { id: 'p3', studentId: 's3' }],
    cashFlow: [{ id: 'c1', amount: 1 }],
});

test('admin and boshliq keep full HR data', () => {
    for (const role of ['admin', 'boshliq']) {
        const st = scope.scopeState(baseState(), { role, email: 'x@x.uz' });
        assert.equal(st.hrEmployees[1].cardNumber, '8600999988887777');
        assert.equal(st.cashFlow.length, 1);
        assert.equal(st.students[2].phone, '+99890333');
    }
});

test('ROP loses colleagues HR private fields but keeps own and students/finance', () => {
    const st = scope.scopeState(baseState(), { role: 'rop', email: 'bobur@x.uz' });
    assert.equal(st.hrEmployees[0].cardNumber, '8600111122223333', 'own record stays full');
    for (const key of scope.HR_PRIVATE_FIELDS) assert.equal(st.hrEmployees[1][key], undefined, key);
    assert.equal(st.hrEmployees[1].phone, '+998902');
    assert.equal(st.students[2].phone, '+99890333');
    assert.equal(st.cashFlow.length, 1);
});

test('sales manager: own students full, others without contacts, own payments only, no cash flow', () => {
    const st = scope.scopeState(baseState(), { role: 'sales_manager', email: 'bobur@x.uz' }, { managerId: 'm1' });
    const byId = Object.fromEntries(st.students.map(s => [s.id, s]));
    assert.equal(byId.s1.phone, '+99890111');
    assert.equal(byId.s1.parentPhone, '+9989');
    assert.equal(byId.s2.phone, '+99890222', 'student linked via own lead');
    assert.equal(byId.s3.phone, undefined);
    assert.equal(byId.s3.email, undefined);
    assert.equal(byId.s3.debtAmount, undefined, 'other managers debts hidden');
    assert.equal(byId.s1.debtAmount, 100);
    assert.equal(byId.s3.managerId, 'm2', 'non-contact fields kept for statistics');
    assert.equal(byId.s4.phone, undefined, 'staff demo is never treated as own');
    assert.deepEqual(st.payments.map(p => p.id), ['p1']);
    assert.deepEqual(st.cashFlow, []);
    assert.equal(st.hrEmployees[1].pinfl, undefined);
});

test('sales manager without a linked manager id sees no contacts and no payments', () => {
    const st = scope.scopeState(baseState(), { role: 'sales_manager', email: 'z@x.uz' }, { managerId: null });
    assert.ok(st.students.every(s => s.phone === undefined));
    assert.deepEqual(st.payments, []);
});

test('employee: contacts, payments and cash flow removed unless finance department', () => {
    const st = scope.scopeState(baseState(), { role: 'employee', email: 'z@x.uz' });
    assert.ok(st.students.every(s => s.phone === undefined));
    assert.deepEqual(st.payments, []);
    assert.deepEqual(st.cashFlow, []);
    const fin = scope.scopeState(baseState(), { role: 'employee', email: 'z@x.uz' }, { financeEmployee: true });
    assert.equal(fin.students[0].phone, '+99890111');
    assert.equal(fin.cashFlow.length, 1);
    assert.equal(fin.hrEmployees[0].cardNumber, undefined, 'HR private fields stay admin-only');
});

test('targetolog: student contacts and payments removed', () => {
    const st = scope.scopeState(baseState(), { role: 'targetolog', email: 'z@x.uz' });
    assert.ok(st.students.every(s => s.phone === undefined));
    assert.deepEqual(st.payments, []);
});

test('saving HR list as ROP never wipes hidden private fields', () => {
    const old = [{ id: 'e2', login: 'aziza@x.uz', card_number: '8600999988887777', passport_series: 'AB7654321',
        pinfl: '43210987654321', address: 'Toshkent', birth_date: '1996-02-02' },
        { id: 'e1', login: 'bobur@x.uz', card_number: '1', passport_series: '', pinfl: '', address: '', birth_date: '' }];
    const incoming = [
        { id: 'e2', name: 'Aziza T', cardNumber: '' },          // ROP ko'rmagan maydon bo'sh keldi
        { id: 'e1', name: 'Bobur', cardNumber: '8600000000000000' }, // o'z yozuvi — o'zgartira oladi
        { id: 'e9', name: 'Yangi', cardNumber: '8600555566667777' },  // yangi xodim — kiritilgan qiymat
    ];
    const out = scope.preserveHrPrivateFields(incoming, old, { role: 'rop', email: 'bobur@x.uz' });
    assert.equal(out[0].cardNumber, '8600999988887777');
    assert.equal(out[0].pinfl, '43210987654321');
    assert.equal(out[1].cardNumber, '8600000000000000');
    assert.equal(out[2].cardNumber, '8600555566667777');
    assert.throws(() => scope.preserveHrPrivateFields([{ id: 'e2', cardNumber: '8600123412341234' }], old,
        { role: 'rop', email: 'bobur@x.uz' }), /faqat admin/);
    const adminOut = scope.preserveHrPrivateFields(incoming, old, { role: 'admin' });
    assert.equal(adminOut[0].cardNumber, '', 'admin edits are taken as is');
});
