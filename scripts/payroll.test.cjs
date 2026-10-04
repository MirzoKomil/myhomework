const { test } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../js/payrollEngine');
const service = require('../server/services/payroll');
const vm = require('node:vm');
const { functionSource } = require('./helpers/lead-workflow-fixture.cjs');
const oct = engine.period('2026-10-01', '2026-10-31');
const employee = (id, role, extra = {}) => ({ id, name: id, role, lang: 'english', startDate: '2026-09-01', ...extra });
const deal = (amount, extra = {}) => ({ id: 'lead', status: 'tolov-yopildi', managerId: 'sales',
  paymentClosedSurvey: { actualAmount: amount, closedDate: '2026-10-10' }, ...extra });
const source = extra => ({ hrEmployees: [employee('sales', 'sotuv-menejeri')], teachers: [], students: [],
  leads: { english: [], russian: [] }, mainAttendance: {}, assistantAttendance: {},
  bonusHistory: [], bonusData: {}, cashFlow: [], salesPlan: {}, ...extra });
const clone = value => JSON.parse(JSON.stringify(value));
function calculate(s, config = engine.defaults(), p = oct, confirmation = null) { return engine.calculate(s, config, p, 'english', confirmation); }

test('salary adjustments consume positive credit first, cap deductions and leave inputs untouched', () => {
  const row = { employeeId: 'sales', total: 100 }, items = [{ id: 'debt', amount: -500 }, { id: 'credit', amount: 200 }];
  const before = clone({ row, items });
  const result = engine.withAdjustments(row, items);
  assert.equal(result.baseTotal, 100); assert.equal(result.total, 0); assert.equal(result.adjustmentTotal, -100);
  assert.deepEqual(result.adjustments, [{ id: 'credit', amount: 200 }, { id: 'debt', amount: -300 }]);
  assert.deepEqual({ row, items }, before);
});

test('multiple deductions are allocated in ledger order and never create a negative payment', () => {
  const result = engine.withAdjustments({ total: 100 }, [{ id: 'first', amount: -60 }, { id: 'second', amount: -70 }]);
  assert.deepEqual(result.adjustments, [{ id: 'first', amount: -60 }, { id: 'second', amount: -40 }]);
  assert.equal(result.total, 0); assert.equal(result.unpaidDebt, 0);
});

test('negative current-period earnings close at zero and expose remaining source debt', () => {
  const result = engine.withAdjustments({ total: -500 }, [{ id: 'credit', amount: 100 }, { id: 'debt', amount: -50 }]);
  assert.equal(result.total, 0); assert.equal(result.unpaidDebt, 400); assert.equal(result.adjustmentTotal, 100);
  assert.deepEqual(result.adjustments, [{ id: 'credit', amount: 100 }]);
});

test('ROP clean turnover uses the actual adjusted manager payment, not the unadjusted entitlement', () => {
  const s = source({ hrEmployees: [employee('sales', 'sotuv-menejeri'), employee('rop', 'rop')],
    leads: { english: [deal(20000000)], russian: [] },
    salesPlan: { english: { managers: 1, leadsPerDay: 1, avgCheck: 1000000, conversions: { mid: 100 } } } });
  const result = engine.calculate(s, engine.defaults(), oct, 'english', { amount: engine.salesPlan(s, 'english', oct) }, [],
    { sales: [{ id: 'prior-debt', amount: -3000000 }] });
  assert.equal(result.rows.find(r => r.employeeId === 'sales').total, 0);
  assert.equal(result.cleanTurnover, 20000000);
  assert.equal(result.rows.find(r => r.employeeId === 'rop').managerSalaries, 0);
});

test('already paid snapshots are not changed or charged again by pending adjustments', () => {
  const paid = { employeeId: 'sales', role: 'sales', total: 777, frozen: true };
  const result = engine.calculate(source(), engine.defaults(), oct, 'english', null, [paid],
    { sales: [{ id: 'debt', amount: -500 }] });
  assert.deepEqual(result.rows[0], paid);
});

test('invalid dates, reversed and overlong periods are rejected', () => {
  for (const [a, b] of [['2026-02-30', '2026-03-01'], ['bad', '2026-10-31'], ['2026-10-31', '2026-10-01'], ['2026-01-01', '2027-01-02']]) assert.throws(() => engine.period(a, b));
  assert.equal(engine.period('2024-02-01', '2024-02-29').days, 29);
});
test('fixed salary prorates hire date, leap years, future hires and cross-month periods', () => {
  assert.equal(engine.fixedPay(3100000, oct, { startDate: '2026-10-12' }), 2000000);
  assert.equal(engine.fixedPay(3100000, oct, { startDate: '2026-11-01' }), 0);
  assert.equal(engine.fixedPay(2900000, engine.period('2024-02-01', '2024-02-29'), { startDate: '2024-02-15' }), 1500000);
  assert.equal(engine.fixedPay(3100000, engine.period('2026-10-15', '2026-11-14')), Math.round(3100000 * (17 / 31 + 14 / 30)));
  assert.equal(engine.fixedPay(3100000, oct, { endDate: '2026-10-20' }), 2000000);
});
for (const [turnover, fixed] of [[0, 0], [19999999, 0], [20000000, 1000000], [39999999, 1000000], [40000000, 2000000], [59999999, 2000000], [60000000, 3000000]]) {
  test(`sales turnover ${turnover}: correct fixed tier plus unconditional 5%`, () => {
    const result = calculate(source({ leads: { english: [deal(turnover)], russian: [] } }));
    assert.equal(result.rows[0].fixed, fixed);
    assert.equal(result.rows[0].commission, Math.round(turnover * .05));
    assert.equal(result.rows[0].total, fixed + Math.round(turnover * .05));
  });
}
test('midmonth hire prorates tiered fixed pay but not earned sales commission', () => {
  const s = source({ hrEmployees: [employee('sales', 'sotuv-menejeri', { startDate: '2026-10-12' })],
    leads: { english: [deal(20000000)], russian: [] } });
  const row = calculate(s).rows[0];
  assert.equal(row.fixed, Math.round(1000000 * 20 / 31)); assert.equal(row.commission, 1000000);
});
test('only closed paid deals count; contractual fallback never overrides explicit zero', () => {
  const rows = [deal(5000000), deal(8000000, { id: 'partial', status: 'tolov-jarayonida' }), deal(3000000, { id: 'cancelled', cancelled: true }),
    deal(4000000, { id: 'refund', refunded: true }), deal(0, { id: 'zero', paymentClosedSurvey: { actualAmount: 0, totalAmount: 9000000, closedDate: '2026-10-10' } }),
    deal(1000000, { id: 'old', paymentClosedSurvey: { actualAmount: 1000000, closedDate: '2026-09-30' } })];
  assert.equal(calculate(source({ leads: { english: rows, russian: [] } })).turnover, 5000000);
});
test('same-period refunds are deducted exactly once even if stored on lead and cash-flow', () => {
  const s = source({ leads: { english: [deal(10000000, { refundAmount: 2000000 })], russian: [] },
    cashFlow: [{ id: 'refund', type: 'chiqim', purpose: 'Pul qaytarish (Refund)', leadId: 'lead', date: '2026-10-20', amount: 2000000 }] });
  assert.equal(calculate(s).turnover, 8000000); assert.equal(calculate(s).rows[0].commission, 400000);
});
test('later-period refund reverses commission in refund period rather than twice in sale period', () => {
  const s = source({ leads: { english: [deal(10000000, { refundAmount: 10000000, refunded: true })], russian: [] },
    cashFlow: [{ id: 'refund', type: 'chiqim', purpose: 'Pul qaytarish (Refund)', leadId: 'lead', date: '2026-11-20', amount: 10000000 }] });
  assert.equal(calculate(s).turnover, 10000000);
  const nov = engine.period('2026-11-01', '2026-11-30');
  assert.equal(calculate(s, undefined, nov).rows[0].commission, -500000);
});
test('dated cash bonuses use award snapshots; unknown non-cash prizes are warned, not guessed', () => {
  const s = source({ bonusHistory: [{ managerId: 'sales', bonusId: 'obed30', date: '2026-10-12' },
    { managerId: 'sales', bonusId: 'custom', amount: 100000, date: '2026-10-12' },
    { managerId: 'sales', bonusId: 'rank1', date: '2026-10-12' }, { managerId: 'sales', amount: 500000, date: '2026-09-01' }] });
  const result = calculate(s); assert.equal(result.rows[0].bonus, 130000);
  assert.ok(result.warnings.some(w => w.includes('rank1')));
});
test('configurable bonus override and cancellation work', () => {
  const s = source({ bonusHistory: [{ managerId: 'sales', bonusId: 'custom', date: '2026-10-12' },
    { managerId: 'sales', amount: 100000, date: '2026-10-12', cancelled: true }], bonusData: { custom: { amount: 50000 } } });
  assert.equal(calculate(s).rows[0].bonus, 50000);
});
for (const [completion, rate] of [[0, 0], [.9, 0], [1, 2], [30, 2], [30.1, 3], [40, 3], [40.1, 4], [50, 4], [50.1, 5], [70, 5], [70.1, 7], [80, 7], [80.1, 8], [100, 8], [150, 8]]) {
  test(`ROP ${completion}% completion uses ${rate}% clean-turnover rate`, () => {
    const p = engine.period('2026-10-10', '2026-10-10');
    const s = source({ hrEmployees: [employee('sales', 'sotuv-menejeri'), employee('rop', 'rop')],
      leads: { english: [deal(completion * 100000)], russian: [] },
      salesPlan: { english: { managers: 1, leadsPerDay: 10, avgCheck: 1000000, conversions: { mid: 100 } } } });
    const c = engine.defaults(); c.targetMonthlySalary = 310000;
    const result = calculate(s, c, p, { amount: 10000000 }); const row = result.rows.find(r => r.role === 'rop');
    assert.equal(row.rate, rate); assert.equal(row.targetSalary, 10000);
    assert.equal(row.cleanTurnover, Math.max(0, result.turnover - result.rows[0].total - 10000));
    assert.equal(row.commission, Math.round(row.cleanTurnover * rate / 100));
  });
}
test('ROP missing or changed plan confirmation blocks commission; optional fixed pay remains prorated', () => {
  const s = source({ hrEmployees: [employee('rop', 'rop', { startDate: '2026-10-12' })] });
  const c = engine.defaults(); c.rop.hasFixed = true; c.rop.fixed = 3100000;
  const row = calculate(s, c).rows[0]; assert.equal(row.fixed, 2000000); assert.equal(row.blocked, true); assert.equal(row.commission, 0);
});
for (const pattern of ['mwf', 'tts']) test(`teacher tariffs and ${pattern} schedule use calendar count and explicit present marks`, () => {
  const days = engine.expectedDays('2026-10', pattern);
  const attendance = Object.fromEntries(days.map(d => [d, 1]));
  const s = source({ hrEmployees: [employee('t', 'ingliz-oqituvchi')], teachers: [{ id: 't', schedulePattern: pattern }],
    students: [15, 30, 60].map(d => ({ id: 's' + d, name: 's' + d, subject: 'english', teacherId: 't', lessonDuration: d })),
    mainAttendance: { '2026-10_t': { s15: attendance, s30: attendance, s60: attendance } } });
  const row = calculate(s).rows[0]; assert.equal(row.total, 525000); assert.equal(row.lessons, days.length * 3);
  assert.equal(row.studentCount, 3);
});
test('assistant uses 50000 (not main teacher rate), independent day marks with monthly attendance cap', () => {
  const s = source({ hrEmployees: [employee('a', 'yordamchi')], teachers: [{ id: 'a', lessonDuration: 60 }],
    students: [{ id: 's', subject: 'english', assistantTeacherId: 'a', lessonDuration: 60 }],
    assistantAttendance: { '2026-10_a': { s: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [i + 1, true])) } } });
  const row = calculate(s).rows[0]; assert.equal(row.total, 50000); assert.equal(row.lessons, engine.expectedDays('2026-10').length);
});
test('absences, strings, invalid day marks, prehire and wrong teacher/student-language marks earn nothing', () => {
  const s = source({ hrEmployees: [employee('t', 'ingliz-oqituvchi', { startDate: '2026-10-12' })],
    students: [{ id: 's', subject: 'english', teacherId: 't', lessonDuration: 15 }, { id: 'ru', subject: 'russian', teacherId: 't' }],
    mainAttendance: { '2026-10_t': { s: { 2: 1, 12: 0, 14: 'false', 16: false, 19: 1, 32: 1 }, ru: { 19: 1 } } } });
  const row = calculate(s).rows[0]; assert.equal(row.lessons, 1); assert.equal(row.studentCount, 1); assert.equal(row.total, Math.round(75000 / 13));
});
test('cross-month teaching uses each month denominator and actual days within selected period', () => {
  const p = engine.period('2026-10-15', '2026-11-14');
  const s = source({ hrEmployees: [employee('t', 'ingliz-oqituvchi')], students: [{ id: 's', subject: 'english', teacherId: 't', lessonDuration: 30 }],
    mainAttendance: { '2026-10_t': { s: { 14: 1, 16: 1, 30: 1 } }, '2026-11_t': { s: { 2: 1, 13: 1, 16: 1 } } } });
  const row = calculate(s, undefined, p).rows[0];
  assert.equal(row.lessons, 4); assert.equal(row.total, Math.round(150000 * 2 / 13) + Math.round(150000 * 2 / 13));
});
test('language, incompatible template, future employee and no input mutation', () => {
  const s = source({ hrEmployees: [employee('sales', 'sotuv-menejeri'), employee('r', 'rus-oqituvchi'), employee('future', 'rop', { startDate: '2027-01-01' }),
    employee('bad', 'sotuv-menejeri', { kpiTemplateId: 'teacher' })] });
  const before = clone(s); const result = calculate(s); assert.deepEqual(s, before);
  assert.deepEqual(result.rows.map(r => r.employeeId), ['sales']); assert.ok(result.warnings.some(w => w.includes('bad')));
});
test('every dynamic percentage, threshold, tariff and bonus is validated server-side', () => {
  for (const change of [c => c.sales.commission = 101, c => c.sales.tiers[1].from = 0,
    c => c.rop.tiers[0].rate = -1, c => c.rop.tiers.at(-1).upTo = 100, c => c.rop.minCompletion = 100,
    c => c.teacher.rates[15] = '75000', c => c.assistant.rate = NaN, c => c.bonusAmounts.a = -1]) {
    const c = engine.defaults(); change(c); assert.throws(() => engine.validateSettings(c));
  }
  const c = engine.defaults(); c.sales.commission = 7; c.assistant.rate = 80000;
  assert.equal(engine.validateSettings(c).sales.commission, 7);
});

function database() {
  const calls = [], records = [], audits = [], confirmations = [];
  let config = { data: engine.defaults(), revision: 1 };
  const sourceRows = {
    employees: [{ id: 'sales', name: 'Sales', role: 'sotuv-menejeri', lang: 'english', start_date: '2026-09-01' }],
    leads: [{ id: 'lead', manager_id: 'sales', status: 'tolov-yopildi', language: 'english', extra_data: deal(20000000) }]
  };
  const db = { release() { calls.push(['release']); }, async query(sql, params = []) {
    calls.push([sql, params]);
    if (sql.startsWith('SELECT to_regclass')) return { rows: [{ ledger: null }] };
    if (/^SELECT u.id/.test(sql)) return { rows: [{ id: params[0], role: params[0] === 'teacher' ? 'teacher' : params[0] === 'manager' ? 'sales_manager' : 'admin', name: 'Admin' }] };
    if (sql.startsWith('SELECT he.*')) return { rows: sourceRows.employees };
    if (sql.startsWith('SELECT * FROM teachers') || sql.startsWith('SELECT * FROM students') || sql.startsWith('SELECT att_key')) return { rows: [] };
    if (sql.startsWith('SELECT * FROM leads')) return { rows: sourceRows.leads };
    if (sql.startsWith('SELECT key,data')) return { rows: [] };
    if (sql.startsWith('SELECT * FROM salary_kpi_settings')) return { rows: [clone(config)] };
    if (sql.startsWith('UPDATE salary_kpi_settings')) { config = { data: JSON.parse(params[1]), revision: config.revision + 1 }; return { rows: [] }; }
    if (sql.startsWith('SELECT * FROM salary_plan_confirmations')) return { rows: confirmations };
    if (sql.startsWith('SELECT * FROM salary_transactions WHERE language=')) return { rows: records };
    if (sql.startsWith('SELECT calculation FROM salary_transactions')) return { rows: records.filter(r => r.employee_id === params[0]).map(r => ({ calculation: r.calculation })) };
    if (sql.startsWith('SELECT id FROM salary_transactions')) return { rows: records.filter(r => r.employee_id === params[0] && r.status === 'paid') };
    if (sql.startsWith('INSERT INTO salary_transactions')) {
      const row = { id: params[0], employee_id: params[1], language: params[2], start_key: params[3], end_key: params[4], amount: params[5], calculation: JSON.parse(params[6]), source_hash: params[7], status: 'unpaid' };
      const old = records.findIndex(r => r.employee_id === row.employee_id); if (old >= 0) records[old] = row; else records.push(row);
      return { rows: [] };
    }
    if (sql.startsWith('SELECT *,TO_CHAR') && sql.includes("status='paid' AND period_end")) return { rows: records.filter(r => r.language === params[0] && r.status === 'paid' && r.end_key < params[1]) };
    if (sql.startsWith('SELECT *,TO_CHAR')) return { rows: records.filter(r => r.id === params[0]) };
    if (sql.startsWith('UPDATE salary_transactions SET status=')) { records.find(r => r.id === params[0]).status = 'paid'; return { rows: [] }; }
    if (sql.startsWith('INSERT INTO salary_audit')) { audits.push({ action: params[0], actor: params[2], before: params[4], after: params[5] }); return { rows: [] }; }
    if (sql.startsWith('BEGIN') || sql.startsWith('SELECT pg_advisory') || ['COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
    throw Error('Unhandled SQL: ' + sql);
  } };
  return { pool: { connect: async () => db }, calls, records, audits, sourceRows, db };
}
const actor = { id: 'admin', role: 'admin' }, input = { start: oct.start, end: oct.end, language: 'english' };
test('preview is read-only, checks persisted role, and does not trust client-side totals', async () => {
  const f = database(); const result = await service.preview(f.pool, actor, input);
  assert.equal(result.rows[0].total, 2000000); assert.equal(f.records.length, 0); assert.equal(f.audits.length, 0);
  await assert.rejects(service.preview(f.pool, { id: 'teacher', role: 'admin' }, input), { status: 403 });
  assert.ok(f.calls.some(([sql]) => sql === 'ROLLBACK'));
});
test('accrual is idempotent per employee/period, remains unpaid, audited and rejects stale preview', async () => {
  const f = database(); const result = await service.preview(f.pool, actor, input);
  await service.accrue(f.pool, actor, { ...input, sourceHash: result.sourceHash, amount: 999999999 });
  await service.accrue(f.pool, actor, { ...input, sourceHash: result.sourceHash });
  assert.equal(f.records.length, 1); assert.equal(f.records[0].amount, 2000000); assert.equal(f.records[0].status, 'unpaid');
  assert.equal(f.audits.filter(a => a.action === 'accrue').length, 2);
  f.sourceRows.leads[0].extra_data.paymentClosedSurvey.actualAmount = 30000000;
  await assert.rejects(service.accrue(f.pool, actor, { ...input, sourceHash: result.sourceHash }), { status: 409 });
});
test('payment is audited once, immutable/idempotent, and never writes to cashFlow', async () => {
  const f = database(); const result = await service.preview(f.pool, actor, input);
  await service.accrue(f.pool, actor, { ...input, sourceHash: result.sourceHash });
  const id = f.records[0].id;
  await service.markPaid(f.pool, actor, id);
  assert.equal((await service.markPaid(f.pool, actor, id)).alreadyPaid, true);
  assert.equal(f.audits.filter(a => a.action === 'mark-paid').length, 1);
  f.sourceRows.leads[0].extra_data.paymentClosedSurvey.actualAmount = 1000000;
  const updated = await service.preview(f.pool, actor, input);
  assert.equal(updated.rows[0].total, 2000000); assert.equal(updated.rows[0].frozen, true);
  await service.accrue(f.pool, actor, { ...input, sourceHash: updated.sourceHash }); assert.equal(f.records[0].amount, 2000000);
  assert.ok(!f.calls.some(([sql]) => /UPDATE json_data|INSERT INTO json_data/.test(sql)));
});
test('stale calculation cannot be paid, and overlapping paid periods cannot accrue', async () => {
  const f = database(); const result = await service.preview(f.pool, actor, input);
  await service.accrue(f.pool, actor, { ...input, sourceHash: result.sourceHash });
  f.sourceRows.leads[0].extra_data.paymentClosedSurvey.actualAmount = 30000000;
  await assert.rejects(service.markPaid(f.pool, actor, f.records[0].id), { status: 409 });
  f.records[0].status = 'paid'; f.records[0].language = 'russian';
  const fresh = await service.preview(f.pool, actor, input);
  // Hide the different-period transaction from the exact-period query, but keep overlap guard visible.
  const oldQuery = f.db.query;
  f.db.query = async (sql, params) => sql.startsWith('SELECT * FROM salary_transactions WHERE language=') ? { rows: [] } : oldQuery(sql, params);
  const exact = await service.preview(f.pool, actor, input);
  await assert.rejects(service.accrue(f.pool, actor, { ...input, sourceHash: exact.sourceHash }), { status: 409 });
});
test('settings use optimistic revision, role enforcement and atomic before/after audit', async () => {
  const f = database(); const c = engine.defaults(); c.sales.commission = 7;
  const saved = await service.saveSettings(f.pool, actor, 'english', c, 1);
  assert.equal(saved.revision, 2); assert.equal(f.audits[0].actor, 'admin'); assert.equal(JSON.parse(f.audits[0].before).sales.commission, 5);
  await assert.rejects(service.saveSettings(f.pool, actor, 'english', c, 1), { status: 409 });
  await assert.rejects(service.saveSettings(f.pool, { id: 'manager', role: 'admin' }, 'english', c, 2), { status: 403 });
});
test('failed writes roll back and release connection', async () => {
  const f = database(); const oldQuery = f.db.query;
  f.db.query = (sql, params) => sql.startsWith('INSERT INTO salary_audit') ? Promise.reject(Error('audit unavailable')) : oldQuery(sql, params);
  await assert.rejects(service.saveSettings(f.pool, actor, 'english', engine.defaults(), 1), /audit unavailable/);
  assert.equal(f.calls.at(-2)[0], 'ROLLBACK'); assert.equal(f.calls.at(-1)[0], 'release');
});
test('PostgreSQL JSONB key reordering does not falsely mark a saved salary stale', async () => {
  const f = database(); const result = await service.preview(f.pool, actor, input);
  await service.accrue(f.pool, actor, { ...input, sourceHash: result.sourceHash });
  const row = f.records[0]; row.calculation = Object.fromEntries(Object.entries(row.calculation).reverse());
  assert.equal((await service.preview(f.pool, actor, input)).rows[0].stale, false);
  await service.markPaid(f.pool, actor, row.id); assert.equal(row.status, 'paid');
});
test('ROP deducts actual frozen paid manager wages, not a newly edited commission estimate', () => {
  const s = source({ hrEmployees: [employee('sales', 'sotuv-menejeri'), employee('rop', 'rop')],
    leads: { english: [deal(40000000)], russian: [] }, salesPlan: { english: { managers: 1, leadsPerDay: 1, avgCheck: 1000000, conversions: { mid: 100 } } } });
  const paid = calculate(s).rows.find(r => r.role === 'sales');
  const c = engine.defaults(); c.sales.commission = 10;
  const result = engine.calculate(s, c, oct, 'english', { amount: 31000000 }, [paid]);
  assert.equal(result.rows.find(r => r.role === 'rop').managerSalaries, 4000000);
  assert.equal(result.rows.find(r => r.role === 'sales').total, 4000000);
});
test('editable monthly lesson cap and actual 14-day calendar both calculate full teacher tariff', () => {
  const days = engine.expectedDays('2026-10', 'tts'); assert.equal(days.length, 14);
  const s = source({ hrEmployees: [employee('t', 'ingliz-oqituvchi')], teachers: [{ id: 't', schedulePattern: 'tts' }],
    students: [{ id: 's', teacherId: 't', subject: 'english', lessonDuration: 15 }], mainAttendance: { '2026-10_t': { s: Object.fromEntries(days.map(d => [d, 1])) } } });
  const c = engine.defaults(); c.teacher.maxLessons = 13;
  assert.equal(calculate(s, c).rows[0].total, 75000); assert.equal(calculate(s, c).rows[0].lessons, 13);
  c.teacher.maxLessons = 0; assert.equal(calculate(s, c).rows[0].lessons, 14);
});
test('legacy refund manager language is inferred; unlinked refunds produce an explicit warning', () => {
  const s = source({ cashFlow: [
    { id: 'known', managerId: 'sales', type: 'chiqim', purpose: 'Pul qaytarish (Refund)', amount: 100000, date: '2026-10-20' },
    { id: 'unknown', type: 'chiqim', purpose: 'Pul qaytarish (Refund)', amount: 100000, date: '2026-10-20' }
  ] });
  const result = calculate(s); assert.equal(result.turnover, -100000); assert.ok(result.warnings.some(w => w.includes('unknown')));
});

test('audit resolves the actual employee name when the JWT contains only email', async () => {
  let inserted;
  await service.audit({ async query(sql, params) {
    if (sql.startsWith('SELECT name FROM users')) return { rows: [{ name: 'Moliya Xodimi' }] };
    inserted = params; return { rows: [] };
  } }, { id: 'account', email: 'phone-login' }, 'employee-kpi', 'employee', null, { kpiTemplateId: 'sales' });
  assert.equal(inserted[3], 'Moliya Xodimi');
});

test('HR creates login, KPI template and creation audit in the same transaction', async () => {
  const calls = []; let transactionCount = 0;
  const context = vm.createContext({ require: () => engine, randomUUID: () => 'new-account',
    tx: async fn => { transactionCount++; return fn({ query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } }); },
    findUserById: async id => ({ id }),
    payroll: { audit: async (_db, actor, action, id, before, after) => calls.push({ actor, action, id, before, after }) }
  });
  vm.runInContext(functionSource('server/db.js', 'createHrUserAccount'), context);
  const args = { employee: employee('sales', 'sotuv-menejeri', { kpiTemplateId: 'sales' }), login: 'phone',
    passwordHash: 'test-hash', userRole: 'sales_manager', actor: { id: 'admin' } };
  await context.createHrUserAccount(args);
  const hrInsert = calls.find(c => c.sql?.includes('INSERT INTO hr_employees'));
  assert.equal(hrInsert.params.length, 21); assert.equal(hrInsert.params[20], 'sales');
  assert.equal(calls.at(-1).action, 'employee-kpi'); assert.equal(calls.at(-1).actor.id, 'admin');
  assert.equal(transactionCount, 1);
  await assert.rejects(context.createHrUserAccount({ ...args, employee: { ...args.employee, kpiTemplateId: 'teacher' } }), { status: 400 });
  assert.equal(transactionCount, 1);
});

test('academic salary view agrees with finance rates, hire/student dates and assistant tariff', () => {
  const config = engine.defaults(); config.teacher.rates[30] = 180000; config.assistant.rate = 60000;
  for (const assistant of [false, true]) {
    const emp = employee('t', assistant ? 'yordamchi' : 'ingliz-oqituvchi', { startDate: '2026-10-05' });
    const teacher = { id: 't', type: assistant ? 'yordamchi' : 'asosiy', subject: 'english', schedulePattern: 'mwf', lessonDuration: 30 };
    const students = [{ id: 's', name: 'Student', subject: 'english', teacherId: 't', assistantTeacherId: 't', lessonDuration: 30, startDate: '2026-10-10' }];
    const attendance = { '2026-10_t': { s: { 2: 1, 5: 1, 9: 1, 12: 1, 14: 1, 16: true, 19: 0 } } };
    const context = vm.createContext({ payrollEngine: engine, SALARY_RATES: engine.defaults().teacher.rates, SCHEDULE_PATTERNS: {},
      STORAGE_KEYS: { payrollRates: 'rates', hrEmployees: 'hr' }, getItem: key => key === 'rates' ? { english: config } : [emp],
      getLessonDaysInMonth: (_year, _month, pattern) => engine.expectedDays('2026-10', pattern),
      getFlexibleAttendanceCap: () => 13 });
    vm.runInContext(['getMonthlyBaseSalary', 'calculateKpiSalary'].map(name => functionSource('js/storage.js', name)).join('\n'), context);
    const academic = context.calculateKpiSalary(teacher, '2026-10', attendance, students);
    const finance = calculate(source({ hrEmployees: [emp], teachers: [teacher], students,
      mainAttendance: attendance, assistantAttendance: attendance })).rows[0];
    // Use the same dynamically configured values on the server.
    const configured = calculate(source({ hrEmployees: [emp], teachers: [teacher], students,
      mainAttendance: attendance, assistantAttendance: attendance }), config).rows[0];
    assert.equal(academic.total, configured.total); assert.equal(academic.completed, configured.lessons);
    assert.equal(academic.completed, 3); assert.ok(academic.total > finance.total);
  }
});

test('serialization failures retry with a fresh transaction and release every connection', async () => {
  const events = []; let attempts = 0;
  const pool = { connect: async () => ({ query: async sql => events.push(sql), release: () => events.push('release') }) };
  const result = await service.transaction(pool, async () => {
    if (++attempts === 1) throw Object.assign(Error('concurrent update'), { code: '40001' });
    return 'success';
  });
  assert.equal(result, 'success'); assert.equal(attempts, 2);
  assert.equal(events.filter(e => e === 'ROLLBACK').length, 1);
  assert.equal(events.filter(e => e === 'COMMIT').length, 1);
  assert.equal(events.filter(e => e === 'release').length, 2);
});
