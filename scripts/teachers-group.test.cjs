process.env.TZ = 'Asia/Tashkent';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { functionSource } = require('./helpers/lead-workflow-fixture.cjs');
const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const payroll = fs.readFileSync(path.join(__dirname, '..', 'js', 'payrollUI.js'), 'utf8');

test('attendance header shows weekday and today', () => {
    const NOW = Date.parse('2026-10-20T12:00:00Z');
    const c = vm.createContext({ Date: class extends Date { constructor(...a) { super(...(a.length ? a : [NOW])); } } });
    vm.runInContext("const ATT_WD_SHORT = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];" + functionSource('js/app.js', 'attDayHeadInner') + functionSource('js/app.js', 'attIsToday') + 'this.h = attDayHeadInner; this.t = attIsToday;', c);
    assert.equal(c.h(2026, 10, 20), '20<small>Se</small>');
    assert.equal(c.h(2026, 10, 19), '19<small>Du</small>');
    assert.equal(c.t(2026, 10, 20), true);
    assert.equal(c.t(2026, 10, 21), false);
});

test('names in attendance and teacher cabinet are escaped', () => {
    assert.ok(!app.includes('<td class="sticky-col-2">${s.name}</td>'));
    assert.ok(!app.includes('<option value="${t.id}">${t.name}</option>'));
    assert.ok(!app.includes("<td>${student?.name || '—'}</td>"));
});

test('teacher lands on dashboard and does not see sales revenue rating', () => {
    assert.ok(app.includes("switchTab(restoreTab || 'dashboard', restoreCtx), 50);\n    } else if (role === 'targetolog')"));
    assert.ok(app.includes("${isTeacher ? '' : `<section class=\"card dashboard-panel\"><div class=\"dashboard-panel-head\"><h3>Sotuv menejerlari reytingi"));
});

test('payroll summary is display-only', () => {
    assert.ok(payroll.includes('pfx-tiles'));
    assert.ok(payroll.includes("api('accrue'"), 'accrual path unchanged');
});
