const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/financeEngine');

const accounts = [
    { id: 'acc-cash', entity: 'common', name: 'Kassa', kind: 'cash', methods: ['cash'], openingBalance: 1000000, openingDate: '2026-09-01' },
    { id: 'acc-card', entity: 'common', name: 'Karta', kind: 'card', methods: ['card', 'payme', 'click'], openingBalance: 0, openingDate: '2026-09-01' },
    { id: 'acc-uzum', entity: 'common', name: 'Uzum', kind: 'clearing', methods: ['uzum'], openingBalance: 0, openingDate: '2026-09-01' },
    { id: 'acc-suspense', entity: 'common', name: 'Aniqlanmagan', kind: 'suspense', methods: ['unknown'], openingBalance: 0, openingDate: '2026-09-01' }
];
const receipt = (id, date, amount, o = {}) => ({ id, entity: 'russian', date, amount, method: 'card', name: 'Ali Valiyev', phone: '+998901234567', managerId: 'm1', leadId: 'l-' + id, newSale: true, ...o });
const txn = (id, date, type, categoryCode, amount, o = {}) => ({ id, entity: 'russian', date, type, categoryCode, accountId: 'acc-card', amount, ...o });
const base = () => ({
    accounts,
    receipts: [
        receipt('r1', '2026-09-10', 2000000, { contractValue: 2000000 }),
        receipt('r2', '2026-09-20', 600000, { contractValue: 2100000 }),
        receipt('r3', '2026-10-05', 1500000, { leadId: 'l-r2', newSale: false }),
        receipt('r4', '2026-10-06', 500000, { method: 'cash' }),
        receipt('rx', '2026-10-07', 500000, { name: 'test', phone: '800000000', voidDate: '2026-10-08', voidReason: 'Test' })
    ],
    transactions: [
        txn('t1', '2026-09-30', 'expense', 'MKT_ADS', 800000),
        txn('t2', '2026-10-01', 'expense', 'COS_TEACHERS', 900000, { salaryId: 's1' }),
        txn('t3', '2026-10-02', 'refund', 'REFUND', 200000, { paymentRecordId: 'r1' }),
        txn('t4', '2026-10-03', 'drawing', 'OWNER_OUT', 300000),
        txn('t5', '2026-10-04', 'transfer', 'TRANSFER', 400000, { accountId: 'acc-card', toAccountId: 'acc-cash' }),
        txn('t6', '2026-10-09', 'expense', 'RENT', 1000000),
        txn('t6r', '2026-10-10', 'expense', 'RENT', 1000000, { reversesId: 't6' }),
        txn('t7', '2026-10-11', 'capital', 'OWNER_IN', 5000000, { entity: 'common' }),
        txn('t8', '2026-10-12', 'expense', 'CAPEX', 2500000, { entity: 'common' })
    ],
    payables: [{ id: 'p1', entity: 'russian', kind: 'bill', counterparty: 'Ijara', categoryCode: 'RENT', amount: 1200000, issueDate: '2026-10-01', dueDate: '2026-10-10' }],
    salaries: [
        { id: 's1', entity: 'russian', employeeName: 'Ustoz', amount: 900000, status: 'paid', periodStart: '2026-09-01', periodEnd: '2026-09-30', accrualDate: '2026-09-30', categoryCode: 'COS_TEACHERS' },
        { id: 's2', entity: 'russian', employeeName: 'Menejer', amount: 700000, status: 'unpaid', periodStart: '2026-10-01', periodEnd: '2026-10-15', accrualDate: '2026-10-15', categoryCode: 'PAY_SALES' }
    ],
    receivables: [
        { studentId: 'a', entity: 'russian', name: 'A', debt: 1000000, dueDate: '2026-10-20' },
        { studentId: 'b', entity: 'russian', name: 'B', debt: 500000, dueDate: '2026-09-01' },
        { studentId: 'c', entity: 'english', name: 'C', debt: 300000, dueDate: '' }
    ],
    settings: { courseMonths: { english: 3, russian: 3 }, suspiciousMin: 10000 }
});

test('money and date parsing are strict', () => {
    assert.equal(F.money('1 200 000 UZS'), 1200000);
    assert.equal(F.money("1 500 000 so'm"), 1500000);
    assert.equal(F.money('-5'), null); assert.equal(F.money('1.5'), null); assert.equal(F.money(''), null);
    assert.equal(F.date('30.09.2026'), '2026-09-30'); assert.equal(F.date('2026-02-30'), '');
});

test('voided receipt is cancelled on its void date, not silently deleted', () => {
    const d = base();
    const mv = F.movements(d).filter(m => m.receiptId === 'rx');
    assert.deepEqual(mv.map(m => [m.date, m.sign, m.amount]), [['2026-10-07', 1, 500000], ['2026-10-08', -1, 500000]]);
    const oct7 = F.cashFlowStatement(d, { start: '2026-10-07', end: '2026-10-07' });
    assert.equal(oct7.operating.find(l => l.key === 'receipts').amount, 500000);
    const oct = F.cashFlowStatement(d, { start: '2026-10-01', end: '2026-10-31' });
    assert.equal(oct.operating.find(l => l.key === 'receipts').amount, 2000000);
});

test('reversal (storno) nets the original to zero and never edits it', () => {
    const d = base();
    const cf = F.cashFlowStatement(d, { start: '2026-10-01', end: '2026-10-31' });
    assert.equal(cf.operating.find(l => l.key === 'suppliers').amount, 0);
    const p9 = F.profitAndLoss(d, { start: '2026-10-09', end: '2026-10-09' });
    assert.equal(p9.rent, 1000000);
    const p10 = F.profitAndLoss(d, { start: '2026-10-10', end: '2026-10-10' });
    assert.equal(p10.rent, -1000000);
});

test('cash flow statement reconciles exactly with account balances (IAS 7)', () => {
    const d = base();
    for (const [start, end] of [['2026-09-01', '2026-09-30'], ['2026-10-01', '2026-10-31'], ['2026-09-01', '2026-10-31'], ['2026-10-04', '2026-10-04']]) {
        const cf = F.cashFlowStatement(d, { start, end });
        assert.equal(cf.reconciled, true, `${start}..${end} diff ${cf.difference}`);
        assert.equal(cf.closingCash, F.accountBalances(d, end).reduce((n, a) => n + a.balance, 0));
    }
    const all = F.cashFlowStatement(d, { start: '2026-09-01', end: '2026-10-31' });
    // 1 000 000 boshlang'ich + 4 600 000 tushum - 800k - 900k - 200k - 300k + 5 000 000 - 2 500 000
    assert.equal(all.openingInjection, 1000000);
    assert.equal(all.closingCash, 1000000 + 4600000 - 800000 - 900000 - 200000 - 300000 + 5000000 - 2500000);
    assert.equal(all.net.investing, -2500000);
    assert.equal(all.net.financing, 5000000 - 300000);
});

test('transfers move money between accounts without touching P&L or cash flow totals', () => {
    const d = base();
    const bal = Object.fromEntries(F.accountBalances(d, '2026-10-31').map(a => [a.id, a.balance]));
    assert.equal(bal['acc-cash'], 1000000 + 500000 + 400000);
    const cf = F.cashFlowStatement(d, { start: '2026-10-04', end: '2026-10-04' });
    assert.equal(cf.netChange, 0);
});

test('cash P&L: refunds are contra-revenue, owner drawings and capex are below the line', () => {
    const d = base();
    const p = F.profitAndLoss(d, { start: '2026-10-01', end: '2026-10-31', scope: 'russian' });
    assert.equal(p.revenue, 2000000);
    assert.equal(p.refunds, 200000);
    assert.equal(p.net_revenue, 1800000);
    assert.equal(p.cost_of_services, 900000);
    assert.equal(p.gross_profit, 900000);
    assert.equal(p.net_profit, 900000); // rent reversed, drawing excluded
    assert.equal(p.belowTheLine.ownerDrawings, 300000);
    const all = F.profitAndLoss(d, { start: '2026-10-01', end: '2026-10-31', scope: 'all' });
    assert.equal(all.belowTheLine.capex, 2500000);
    assert.equal(all.belowTheLine.ownerContributions, 5000000);
    assert.equal(p.unallocatedCommon, 0);
});

test('accrual P&L spreads tuition over the course and books salaries in the accrual period', () => {
    const d = base();
    const sep = F.profitAndLoss(d, { start: '2026-09-01', end: '2026-09-30', scope: 'russian', basis: 'accrual' });
    // r1: 2 000 000 over 2026-09-10..2026-12-09 (91 days): 21 days in Sept
    const c1 = F.contractSchedule(d, 'russian').find(c => c.key === 'russian:l-r1');
    assert.equal(c1.end, '2026-12-09');
    assert.equal(F.recognized(c1, '2026-09-30'), Math.floor(2000000 * 21 / 91));
    assert.equal(sep.cost_of_services, 900000); // accrued in Sept, paid in Oct
    const octCash = F.profitAndLoss(d, { start: '2026-10-01', end: '2026-10-31', scope: 'russian', basis: 'cash' });
    const octAcc = F.profitAndLoss(d, { start: '2026-10-01', end: '2026-10-31', scope: 'russian', basis: 'accrual' });
    assert.equal(octCash.cost_of_services, 900000);
    assert.equal(octAcc.cost_of_services || 0, 0);
    assert.equal(octAcc.sales_payroll, 700000);
    assert.equal(octAcc.rent, 1200000); // bill issued in Oct
    // Over the full contract the recognised revenue equals contract value
    assert.equal(F.recognized(c1, '2027-01-01'), 2000000);
});

test('deferred revenue equals cash received minus revenue earned', () => {
    const d = base();
    const asOf = '2026-09-30';
    const exp = F.contractSchedule(d, 'russian').reduce((n, c) => n + Math.max(0, c.cash(asOf) - F.recognized(c, asOf)), 0);
    assert.equal(F.deferredRevenue(d, asOf, 'russian'), exp);
    assert.ok(exp > 0);
});

test('receivables aging buckets and payables include unpaid salaries and bills', () => {
    const d = base();
    const ar = F.receivablesAging(d.receivables, '2026-10-25', 'russian');
    assert.equal(ar.total, 1500000);
    assert.equal(ar.buckets.find(b => b.key === 'd31_60').amount, 500000);
    assert.equal(ar.buckets.find(b => b.key === 'd1_30').amount, 1000000);
    const ap = F.payablesSummary(d, '2026-10-25', 'russian');
    assert.equal(ap.salaries, 700000);
    assert.equal(ap.bills, 1200000);
    assert.equal(ap.overdue, 1200000);
    const bs = F.balanceSheet(d, '2026-10-25', 'russian');
    assert.equal(bs.assets, bs.cash + bs.receivables);
    assert.equal(bs.netAssets, bs.assets - bs.liabilities);
});

test('kpis: new sales vs collections, average check and CAC', () => {
    const d = base();
    const k = F.kpis(d, { start: '2026-09-01', end: '2026-10-31', scope: 'russian' });
    assert.equal(k.newSales, 3); // r1, r2, r4 (rx voided)
    assert.equal(k.collections, 1500000);
    assert.equal(k.averageCheck, Math.round((2000000 + 600000 + 500000) / 3));
    assert.equal(k.cac, Math.round(800000 / 3));
});

test('suspicious detector flags test data but not real names', () => {
    const bad = ['test', 'aaaaa', 'hvjh', 'mjlkmk', 'hjdbfjkkm', 'n mn nm'];
    for (const name of bad) assert.ok(F.suspiciousReasons({ name, phone: '901234567', amount: 500000, managerId: 'm' }).length, name);
    const good = ['Shohzod Saydazov', 'Ishpulatov Ulugbek', 'Зилолахон', 'Sevinch Ibrohimova', 'Abdurayimjonova Sarvinoz', 'Malika malika', 'Xolbek'];
    for (const name of good) assert.deepEqual(F.suspiciousReasons({ name, phone: '901234567', amount: 500000, managerId: 'm' }), [], name);
    assert.ok(F.suspiciousReasons({ name: 'Bobojonova', phone: '902443056', amount: 300, managerId: 'm' }).some(r => /kichik/.test(r)));
    assert.ok(F.suspiciousReasons({ name: 'Ali', phone: '6131', amount: 500000 }).length >= 2);
});

test('reconcile matches by phone, then name, and classifies every difference', () => {
    const ledger = [
        { id: 'a', date: '2026-09-14', amount: 100000, name: 'Donyorbek', phone: '948634344' },
        { id: 'b', date: '2026-09-17', amount: 500000, name: 'Xolbek', phone: '930962529' },
        { id: 'c', date: '2026-09-23', amount: 500000, name: 'aaaaa', phone: '931112233' },
        { id: 'd', date: '2026-10-01', amount: 1800000, name: 'Sadullayev Xumorbek', phone: '+998970280022' },
        { id: 'e', date: '2026-10-05', amount: 700000, name: 'Solijonova', phone: '907755958' }
    ];
    const external = [
        { date: '14.09.2026', name: 'Isroilov Doniyor', phone: '94 863 43 44', amount: '1 000 000' },
        { date: '17.09.2026', name: 'Shodmonov Xolbek', phone: '93 752 15 90', amount: 500000 },
        { date: '27.09.2026', name: 'Raximov', phone: '97 703 91 02', amount: 500000 },
        { date: '01.10.2026', name: 'Sadullayev Xumorbek', phone: '97 028 00 22', amount: 1800000 },
        { date: '30.09.2026', name: 'Solijonova Xosiyatxon', phone: '90 775 59 58', amount: 700000 }
    ];
    const r = F.reconcile(external, ledger, { start: '2026-09-01', end: '2026-10-31' });
    const by = s => r.results.filter(x => x.status === s);
    assert.equal(by('match').length, 2);
    assert.ok(by('match').some(x => x.ledger.id === 'b' && x.phoneMismatch));
    assert.equal(by('amount_diff')[0].difference, -900000);
    assert.equal(by('missing_in_crm')[0].external.name, 'Raximov');
    assert.equal(by('extra_in_crm')[0].ledger.id, 'c');
    assert.equal(by('date_diff')[0].ledger.id, 'e');
    assert.equal(r.difference, 3600000 - 4500000);
});

test('statement text from the audit PDF is parsed into rows with all amount columns', () => {
    const rows = F.parseStatementText([
        '№ | Sana | Ism Familiya | Telefon raqam | Tarif',
        '1 | 02.10.2026 | Qodirqulova Rano | 91 301 66 79 | Standart | Karta | Yarim | 1 200 000 UZS | 900 000 UZS | 900 000 UZS | Gulchehra',
        '14 | 13.10.2026 | Bobojonova Xosila | 90 244 30 56 | Standart | Karta | Yarim | 300 000 UZS | 1 500 000 UZS | 23.10.2026 | Hamidaxon',
        '7 500 000 UZS'
    ].join('\n'));
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], { date: '2026-10-02', name: 'Qodirqulova Rano', phone: '913016679', amounts: [1200000, 900000, 900000], line: rows[0].line });
    assert.deepEqual(rows[1].amounts, [300000, 1500000]);
});

test('scope isolates entities; common costs appear only in consolidation and as unallocated', () => {
    const d = base();
    const ru = F.cashFlowStatement(d, { start: '2026-10-01', end: '2026-10-31', scope: 'russian' });
    assert.equal(ru.net.investing, 0);
    assert.equal(ru.reconciled, true);
    const en = F.profitAndLoss(d, { start: '2026-10-01', end: '2026-10-31', scope: 'english' });
    assert.equal(en.net_revenue, 0);
});
