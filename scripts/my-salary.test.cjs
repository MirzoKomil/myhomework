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

// Eski app.js summarizeMySalary olib tashlangan (Mening maoshim endi js/staffSettings.js, server /api/staff/salary).
// Shu yerda yangi ko'rinishning sof qismlari: o'tgan oy kartasi va 6 oylik tarix (1–5-sanada yopilgan, to'lanmagan oy).
function nestedFunction(file, name) {
    const text = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', file), 'utf8');
    const start = text.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('Missing function: ' + name);
    let depth = 0, i = text.indexOf('{', start);
    for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
    return text.slice(start, i + 1);
}
function salaryUi() {
    const fs = require('node:fs'), src = fs.readFileSync(require('node:path').join(__dirname, '..', 'js/staffSettings.js'), 'utf8');
    const helpers = src.split('\n').filter(l => /^    const (esc|num|MON|MON3|cap|monName|dShort|tzDate) = /.test(l)).join('\n');
    const c = vm.createContext({ Date, Map, Number, String, Array, Math });
    vm.runInContext(helpers + '\n' + nestedFunction('js/staffSettings.js', 'lastPaid') + '\n' + nestedFunction('js/staffSettings.js', 'chartAndHistory')
        + '\nthis.lastPaid = lastPaid; this.chart = chartAndHistory;', c);
    return c;
}
test('front-end Mening maoshim: paid history, closed unpaid month on 1–5, current estimate', () => {
    const ui = salaryUi();
    const base = { month: '2026-11', kind: 'assistant', card4: '2210', current: { total: 0 },
        history: [{ month: '2026-09', amount: 415368, status: 'paid', paidAt: '2026-10-05T08:00:00Z' }] };
    // Oy davomida — oxirgi to'langan oy.
    assert.match(ui.lastPaid({ ...base, month: '2026-10' }), /Sentyabr · berilgan<\/span><b>415 368 so'm/);
    // 2-noyabr: oktyabr yopilgan, hali to'lanmagan — u ko'rinadi (Bosh/Davomat bilan bir summa).
    const nov = { ...base, closed: { month: '2026-10', amount: 449228, counted: 146 } };
    const card = ui.lastPaid(nov);
    assert.match(card, /Oktyabr · yopildi<\/span><b>449 228 so'm/);
    assert.match(card, /146 aloqa · 5-noy to'lanadi · karta •••• 2210/);
    const hist = ui.chart(nov);
    assert.match(hist, /Oktyabr · yopildi · to'lanmagan<\/span><b>449 228/);
    assert.match(hist, /Sentyabr · berilgan<\/span><b>415 368/);
    assert.match(hist, /Noyabr · hozirgacha/);
});
