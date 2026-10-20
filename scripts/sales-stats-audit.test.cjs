process.env.TZ = 'Asia/Tashkent';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { functionSource } = require('./helpers/lead-workflow-fixture.cjs');
const { nextStageHistory } = require('../server/services/leadStageHistory');
const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const block = (start, end) => { const a = app.indexOf(start); return app.slice(a, app.indexOf(end, a) + end.length); };

function ctx() {
    const c = vm.createContext({ Date, Intl, Math, Number, String, Array, Object, Map, Set });
    vm.runInContext([block('const LEAD_COLUMNS = [', '];'), 'const LEAD_STATUS_IDS = new Set(LEAD_COLUMNS.map(c => c.id));',
        block('const SALES_MAIN_PATH', ';'),
        ...['normalizeLeadStatus', 'leadTashkentDayKey', 'leadCreatedMs', 'salesPathIndex', 'leadReachedStage', 'medianOf',
            'getFailedSaleReasonLabel', 'computeManagerPerformance'].map(n => functionSource('js/app.js', n)),
        'this.f = { leadTashkentDayKey, leadCreatedMs, leadReachedStage, medianOf, computeManagerPerformance };'].join('\n'), c);
    return c.f;
}

test('day keys follow Tashkent time and accept dotted / slashed dates', () => {
    const f = ctx();
    assert.equal(f.leadTashkentDayKey('2026-10-19T20:30:00Z'), '2026-10-20');
    assert.equal(f.leadTashkentDayKey('2026-10-20'), '2026-10-20');
    assert.equal(f.leadTashkentDayKey('20/10/2026'), '2026-10-20');
    assert.equal(f.leadTashkentDayKey('5.9.2026'), '2026-09-05');
    assert.equal(f.leadTashkentDayKey('x'), null);
    assert.equal(f.leadCreatedMs({ date: '20.10.2026' }), Date.parse('2026-10-20T00:00:00+05:00'));
});

test('reached stage uses history and counts every lead as at least new', () => {
    const f = ctx();
    assert.equal(f.leadReachedStage({ status: 'muvaffaqiyatsiz-sotuv', stageHistory: [{ to: 'boglanildi' }, { to: 'qaror-jarayonida' }, { to: 'muvaffaqiyatsiz-sotuv' }] }).idx, 4);
    assert.equal(f.leadReachedStage({ status: 'sifatsiz-lidlar' }).idx, 0);
    assert.equal(f.leadReachedStage({ status: 'keyin-sotib-olmoqchi' }).idx, 4);
});

test('manager performance: conversion, revenue, contact speed, missing reasons', () => {
    const f = ctx();
    const t0 = '2026-10-10T05:00:00Z';
    const leads = [
        { managerId: 'm1', status: 'tolov-yopildi', createdAt: t0, firstContactAt: Date.parse(t0) + 10 * 60000, paymentClosedSurvey: { totalAmount: 5850000 } },
        { managerId: 'm1', status: 'muvaffaqiyatsiz-sotuv', createdAt: t0, firstContactAt: Date.parse(t0) + 30 * 60000 },
        { managerId: 'm1', status: 'yangi-lidlar', createdAt: t0 },
        { managerId: '', status: 'yangi-lidlar', createdAt: t0 },
    ];
    const rows = f.computeManagerPerformance(leads, [{ id: 'm1', name: 'Aziza' }]);
    assert.equal(rows[0].name, 'Aziza'); assert.equal(rows[1].name, 'Biriktirilmagan');
    assert.equal(rows[0].closed, 1); assert.equal(Math.round(rows[0].conv), 33);
    assert.equal(rows[0].revenue, 5850000); assert.equal(rows[0].speed, 20);
    assert.equal(rows[0].waitingNew, 1); assert.equal(rows[0].noReason, 1);
});

test('server records stage history and ignores client-supplied history', () => {
    const at = '2026-10-21T00:00:00Z';
    const created = nextStageHistory(null, { status: 'yangi-lidlar', managerId: 'm1' }, { isNew: true, at });
    assert.deepEqual(created, [{ from: null, to: 'yangi-lidlar', at, managerId: 'm1', by: null }]);
    const before = { status: 'yangi-lidlar', stageHistory: created };
    const moved = nextStageHistory(before, { status: 'boglanildi', stageHistory: [{ to: 'tolov-yopildi' }] }, { at, actor: { id: 'u1' } });
    assert.equal(moved.length, 2); assert.equal(moved[1].to, 'boglanildi'); assert.equal(moved[1].by, 'u1');
    assert.ok(!moved.some(h => h.to === 'tolov-yopildi'), 'forged client history is ignored');
    assert.equal(nextStageHistory(before, { status: 'yangi-lidlar' }, { at }).length, 1, 'no entry without a change');
});

test('analytics first-contact speed no longer depends on the "date" text field', () => {
    assert.ok(!app.includes('new Date(l.date).getTime()) / 3600000'));
});
