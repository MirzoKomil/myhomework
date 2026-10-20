process.env.TZ = 'Asia/Tashkent';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { functionSource } = require('./helpers/lead-workflow-fixture.cjs');
const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('lead date key uses createdAt in Tashkent time and understands dd/mm/yyyy', () => {
    const c = vm.createContext({ Date, Intl, String, Number });
    vm.runInContext(functionSource('js/app.js', 'anLeadDateKey') + '\nthis.k = anLeadDateKey;', c);
    assert.equal(c.k({ createdAt: '2026-10-19T20:30:00Z' }), '2026-10-20', 'after 19:00 UTC it is already the next day in Tashkent');
    assert.equal(c.k({ date: '20/10/2026' }), '20.10.2026');
    assert.equal(c.k({ date: '5.9.2026' }), '05.09.2026');
    assert.equal(c.k({ date: '2026-10-20' }), '2026-10-20');
    assert.equal(c.k({}), '');
});

test('analytics groups sources by lead kind and uses the shared failed-sale reason', () => {
    const body = app.slice(app.indexOf('function renderAnalitikaSotuvMarketing('), app.indexOf('function renderAnalitikaMoliyaviy('));
    assert.ok(body.includes("getLeadKind(l) === 'target' ? 'Target' : 'Organik'"));
    assert.ok(body.includes('getFailedSaleReasonLabel(l)'));
    assert.ok(body.includes('buildFunnelBars(stagesData)'));
});
