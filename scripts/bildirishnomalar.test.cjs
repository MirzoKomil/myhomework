'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(students, extra = {}) {
    const store = { students, teachers: [], mainAttendance: {}, assistantAttendance: {}, leads: { english: [], russian: [] } };
    const ctx = {
        localStorage: { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = v; } },
        document: { getElementById: () => null, readyState: 'complete', addEventListener() {} },
        STORAGE_KEYS: Object.fromEntries(Object.keys(store).map(k => [k, k])),
        getItem: (k, d) => store[k] ?? d,
        getMonthKey: d => d.toISOString().slice(0, 7),
        formatMoney: n => `${n} so'm`,
        expandLessonPatternDays: d => [1, 3, 5].includes(Number(d)) ? [1, 3, 5] : [2, 4, 6].includes(Number(d)) ? [2, 4, 6] : [Number(d)],
        Intl, Date, Set, Map, Number, String, Math, JSON, ...extra
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/notifications.js'), 'utf8'), ctx);
    return ctx;
}
const now = new Date('2026-10-21T10:00:00+05:00'); // chorshanba
const students = [
    { id: 'a', name: 'Ali', debtAmount: 3000000, paymentDueDate: '2026-10-10', managerId: 'm1', subject: 'english', teacherId: 't1', lessonDayOfWeek: 1, lessonTime: '18:30' },
    { id: 'b', name: 'Vali', debtAmount: 1000000, paymentDueDate: '2026-10-21', managerId: 'm2', subject: 'russian', teacherId: 't1', lessonDayOfWeek: 3, lessonTime: '09:00' },
    { id: 'c', name: 'Soli', debtAmount: 500000, paymentDueDate: '2026-10-01', managerId: 'm2', subject: 'russian', frozen: true }
];

test('ustoz qarz/to‘lov xabarini olmaydi, faqat bugungi darslari', () => {
    const c = load(students, { getTeacherAssignmentIds: () => new Set(['t1']) });
    const list = c.buildRoleNotifications({ role: 'teacher', linkedTeacherId: 't1' }, now);
    assert.deepEqual(list.map(n => n.title), ['Bugungi darslar']);
    assert.match(list[0].message, /Bugun 2 ta darsingiz/);
});

test('admin: bitta umumiy "muddati o‘tgan" va "bugun to‘lov kuni"; muzlatilgan hisobga kirmaydi', () => {
    const c = load(students);
    const list = c.buildRoleNotifications({ role: 'admin' }, now);
    const overdue = list.find(n => n.title === "Muddati o'tgan to'lovlar");
    assert.match(overdue.message, /^1 ta o'quvchi · 3000000 so'm/);
    assert.match(list.find(n => n.title === "Bugun to'lov kuni").message, /Vali/);
    assert.equal(overdue.section, 'debtors');
});

test('ROP faqat o‘z tilidagi qarzdorlarni ko‘radi', () => {
    const c = load(students);
    const list = c.buildRoleNotifications({ role: 'rop', linkedRopLang: 'russian' }, now);
    assert.equal(list.some(n => n.title === "Muddati o'tgan to'lovlar"), false);
    assert.equal(list.length, 1);
});

test('vaqt saqlanadi, o‘qilmaganlar tepada; eski "jami lidlar" va "davomat eslatmasi" yo‘q', () => {
    const src = fs.readFileSync(path.join(__dirname, '../js/notifications.js'), 'utf8');
    assert.doesNotMatch(src, /leads_summary|Davomat eslatmasi|STORAGE_KEYS\.payments/);
    assert.match(src, /sort\(\(a, b\) => \(a\.read - b\.read\) \|\| \(b\.time - a\.time\)\)/);
});
