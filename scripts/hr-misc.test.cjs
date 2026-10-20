const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('user text is escaped in KPI summary, salary table and debt edit form', () => {
    for (const raw of ["<span>${ps.name} — ", '<td><strong>${teacher.name}</strong>', '<p class="text-muted">${ps.name}: ',
        "resize:vertical\">${s.comment || ''}</textarea>", "resize:vertical\">${s.note || ''}</textarea>"]) {
        assert.ok(!app.includes(raw), 'unescaped: ' + raw);
    }
});

test('HR card uses Uzbek status and month names', () => {
    const start = app.indexOf('function renderHrEmployeeCard(');
    const body = app.slice(start, app.indexOf('const TEACHER_ROLES', start));
    assert.ok(body.includes("'Faol' : 'Faol emas'"));
    assert.ok(body.includes('UZ_MONTHS_SHORT'));
});
