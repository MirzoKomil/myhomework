process.env.TZ = 'Asia/Tashkent';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const inflow = fs.readFileSync(path.join(__dirname, '..', 'js', 'inflowUI.js'), 'utf8');
const fnBody = name => { const a = app.indexOf(`function ${name}(`); assert.ok(a >= 0, name); return app.slice(a, app.indexOf('\nfunction ', a + 10)); };

test('debtor menu can no longer hard-delete a student', () => {
    const menu = fnBody('openDebtorMenu');
    assert.ok(!menu.includes('data-action="delete"'));
});

test('debtors table escapes user text', () => {
    const body = fnBody('renderDebtorsTable');
    for (const raw of ['${s.name ||', '${s.comment ||', '${s.note ||', '>${m.name}<', '>${t.name}<']) assert.ok(!body.includes(raw), 'unescaped: ' + raw);
    assert.ok(body.includes('escapeHtml(st.name'));
    assert.ok(body.includes("Number(st.debtAmount || 0) > 0"), 'overdue requires a remaining debt');
});

test('students list keeps every field from the old 17-column table', () => {
    const body = fnBody('renderStudents');
    for (const key of ['serialCode', 'formatPhoneDisplay(s.phone)', 'ageStr', 'genderLabel', 's.region', 'startDate', 'teacher?.name', 'asst', 'manager?.name', 'endDate', 'attended', 's.grade', 'statusHtml', 'student-menu-btn', 'student-check']) {
        assert.ok(body.includes(key), 'missing: ' + key);
    }
});

test('payment modal keeps server-side save path and validation', () => {
    assert.ok(inflow.includes("apiFetch('/api/inflow', { method: 'POST'"));
    assert.ok(inflow.includes('amount > Number(s.debtAmount)'));
    assert.ok(inflow.includes("collectProof(body, 'debtInflow')"));
    assert.ok(inflow.includes('data-pay-fill'));
});
