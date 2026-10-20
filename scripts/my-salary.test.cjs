const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { functionSource } = require('./helpers/lead-workflow-fixture.cjs');
const service = require('../server/services/payroll');

function fakePool(handler) {
    const log = [];
    return { log, connect: async () => ({ query: async (sql, params) => { log.push(sql.trim().split(/\s+/).slice(0, 3).join(' ')); return handler(sql, params) || { rows: [] }; }, release() {} }) };
}

test('ownView never returns other employees or student breakdown', () => {
    const v = service.ownView({ employeeId: 'e1', name: 'X', total: 5, fixed: 1, breakdown: [{ name: 'Student' }], basis: {}, status: 'unpaid' });
    assert.deepEqual(v, { fixed: 1, total: 5, status: 'unpaid' });
});

test('current month period follows Tashkent date', () => {
    const p = service.currentMonthPeriod(new Date('2026-10-31T20:30:00Z')); // Toshkentda 1-noyabr
    assert.equal(p.start, '2026-11-01'); assert.equal(p.end, '2026-11-30');
});

test('unlinked account gets nothing', async () => {
    const pool = fakePool(sql => (/FROM users u/.test(sql) ? { rows: [] } : null));
    const r = await service.mySalary(pool, { id: 'u1' });
    assert.deepEqual(r, { linked: false, current: null, history: [] });
    assert.ok(pool.log.some(l => l.startsWith('BEGIN')) && pool.log.includes('COMMIT'));
});

test('linked account: only own history, read-only transaction, no payroll lock', async () => {
    let historyParams;
    const pool = fakePool((sql, params) => {
        if (/FROM users u/.test(sql)) { assert.deepEqual(params, ['u7']); return { rows: [{ id: 'e7', name: 'Aziza', role: 'sotuv-menejeri', lang: 'english' }] }; }
        if (/FROM salary_transactions WHERE employee_id=\$1/.test(sql)) { historyParams = params; return { rows: [{ start: '2026-09-01', end: '2026-09-30', amount: '7957500', status: 'paid', paid_at: null }] }; }
        if (/advisory/.test(sql)) throw new Error('must not lock');
        return null;
    });
    const r = await service.mySalary(pool, { id: 'u7' });
    assert.deepEqual(historyParams, ['e7']);
    assert.equal(r.linked, true);
    assert.deepEqual(r.history, [{ start: '2026-09-01', end: '2026-09-30', amount: 7957500, status: 'paid', paidAt: null }]);
    assert.equal(r.current, null, 'calculation unavailable (no KPI settings) -> null, not an error');
    assert.ok(pool.log.some(l => /READ/.test(l) || l.startsWith('BEGIN')));
});

test('front-end summary: paid history, current estimate and totals', () => {
    const c = vm.createContext({ Date, Map, Number, String, Array, Math });
    vm.runInContext(functionSource('js/app.js', 'summarizeMySalary') + '\nthis.f = summarizeMySalary;', c);
    const s = c.f({ period: { start: '2026-10-01' }, current: { total: 1200000 },
        history: [{ start: '2026-09-01', amount: 900000, status: 'paid' }, { start: '2026-08-01', amount: 800000, status: 'unpaid' }] }, new Date(2026, 9, 21));
    assert.equal(s.currentTotal, 1200000);
    assert.equal(s.paidTotal, 900000);
    const by = Object.fromEntries(s.last6.map(m => [m.key, m]));
    assert.equal(by['2026-10'].status, 'estimate'); assert.equal(by['2026-10'].amount, 1200000);
    assert.equal(by['2026-09'].status, 'paid'); assert.equal(by['2026-08'].status, 'pending');
    assert.equal(by['2026-05'].status, 'none');
});
