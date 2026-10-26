const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/financeEngine');

const ACC = [
    { id: 'acc-cash', entity: 'common', name: 'Kassa', kind: 'cash', methods: ['cash'], openingBalance: 1000000, openingDate: '2026-09-01' },
    { id: 'acc-card', entity: 'common', name: 'Karta', kind: 'card', methods: ['card', 'payme', 'click'], openingBalance: 0, openingDate: '2026-09-01' },
    { id: 'acc-bank', entity: 'common', name: 'Bank', kind: 'bank', methods: ['bank'], openingBalance: 0, openingDate: '2026-09-01' },
    { id: 'acc-uzum', entity: 'common', name: 'Uzum', kind: 'clearing', methods: ['uzum'], openingBalance: 0, openingDate: '2026-09-01' },
    { id: 'acc-suspense', entity: 'common', name: 'Aniqlanmagan', kind: 'suspense', methods: ['unknown'], openingBalance: 0, openingDate: '2026-09-01' }
];
const settings = { courseMonths: { english: 3, russian: 3 } };
const rc = (id, date, amount, o = {}) => ({ id, entity: 'russian', date, amount, method: 'card', name: 'Ali Valiyev', phone: '+998901234567', managerId: 'm1', leadId: 'l-' + id, ...o });
const tx = (id, date, type, categoryCode, amount, o = {}) => ({ id, entity: 'russian', date, type, categoryCode, accountId: 'acc-card', amount, ...o });
const data = o => ({ accounts: ACC, receipts: [], transactions: [], payables: [], salaries: [], receivables: [], settings, ...o });
const balanceOf = (d, asOf) => F.accountBalances(d, asOf).reduce((n, a) => n + a.balance, 0);

test('money, date and phone parsing are strict', () => {
    assert.equal(F.money('1 200 000 UZS'), 1200000);
    assert.equal(F.money("1 500 000 so'm"), 1500000);
    assert.equal(F.money('-5'), null); assert.equal(F.money('1.5'), null);
    assert.equal(F.date('30.09.2026'), '2026-09-30'); assert.equal(F.date('2026-02-30'), '');
});

test('voided receipt is reversed on its void date and removed from revenue', () => {
    const d = data({ receipts: [rc('a', '2026-10-07', 500000, { voidDate: '2026-10-08' })] });
    assert.deepEqual(F.movements(d).map(m => [m.date, m.sign]), [['2026-10-07', 1], ['2026-10-08', -1]]);
    assert.equal(F.profitAndLoss(d, { start: '2026-10-01', end: '2026-10-31' }).revenue || 0, 0);
    assert.equal(F.profitAndLoss(d, { start: '2026-10-01', end: '2026-10-31', basis: 'accrual' }).net_revenue, 0);
});

test('storno nets out in its own period', () => {
    const d = data({ transactions: [tx('t', '2026-10-09', 'expense', 'RENT', 1000000), tx('tr', '2026-10-10', 'expense', 'RENT', 1000000, { reversesId: 't' })] });
    assert.equal(F.profitAndLoss(d, { start: '2026-10-09', end: '2026-10-09' }).rent, 1000000);
    assert.equal(F.profitAndLoss(d, { start: '2026-10-10', end: '2026-10-10' }).rent, -1000000);
    assert.equal(F.profitAndLoss(d, { start: '2026-10-01', end: '2026-10-31' }).rent || 0, 0);
});

test('IAS 7: cash equals cash + card + bank + suspense; Uzum clearing is a receivable until settled', () => {
    const d = data({
        receipts: [rc('a', '2026-09-10', 2000000), rc('u', '2026-09-12', 2100000, { method: 'uzum' }), rc('x', '2026-09-14', 300000, { method: 'unknown' })],
        transactions: [
            tx('s', '2026-09-20', 'transfer', 'TRANSFER', 1890000, { accountId: 'acc-uzum', toAccountId: 'acc-bank', entity: 'common' }),
            tx('f', '2026-09-20', 'expense', 'BANK_FEES', 210000, { accountId: 'acc-uzum', counterparty: 'Uzum' }),
            tx('m', '2026-09-21', 'transfer', 'TRANSFER', 500000, { accountId: 'acc-card', toAccountId: 'acc-cash', entity: 'common' })
        ]
    });
    const cf = F.cashFlowStatement(d, { start: '2026-09-01', end: '2026-09-30' });
    assert.equal(cf.reconciled, true, String(cf.difference));
    // Uzum'ga tushgan 2.1M pul emas; bankka kelgan 1.89M — o'quvchidan olingan to'lov.
    assert.equal(cf.operating.find(l => l.key === 'receipts').amount, 2000000 + 300000 + 1890000);
    assert.equal(cf.operating.find(l => l.key === 'suppliers').amount, 0); // komissiya kliringdan, pul emas
    assert.equal(cf.closingCash, 1000000 + 2000000 + 300000 + 1890000);
    assert.equal(cf.closingSuspense, 300000);
    const cs = F.cashSummary(F.accountBalances(d, '2026-09-30'));
    assert.deepEqual([cs.equivalents, cs.suspense, cs.clearing], [1000000 + 2000000 + 1890000, 300000, 0]);
    // Komissiya P&L'da operatsion xarajat (EBITDA ichida).
    const p = F.profitAndLoss(d, { start: '2026-09-01', end: '2026-09-30' });
    assert.equal(p.payment_fees, 210000);
    assert.equal(p.ebitda, p.net_revenue - 210000);
});

test('receipt account is frozen at entry: changing the method mapping does not rewrite history', () => {
    const d = data({ receipts: [rc('a', '2026-09-10', 1000000, { accountId: 'acc-card' })] });
    const changed = { ...d, accounts: ACC.map(a => a.id === 'acc-card' ? { ...a, active: false, methods: [] } : a) };
    assert.equal(F.accountBalances(changed, '2026-09-30').find(a => a.id === 'acc-card').balance, 1000000);
});

test('accrual: each enrolment is its own contract — a renewal is not pushed back into the first course', () => {
    const d = data({ receipts: [rc('a', '2026-03-01', 3000000, { leadId: 'L', contractValue: 3000000 }), rc('b', '2026-09-01', 3000000, { leadId: 'L', contractValue: 3000000 })] });
    const cs = F.contracts(d);
    assert.equal(cs.length, 2);
    assert.equal(cs[1].start, '2026-09-01');
    const sep = F.profitAndLoss(d, { start: '2026-09-01', end: '2026-09-30', basis: 'accrual' });
    assert.ok(sep.revenue > 900000 && sep.revenue < 1100000, String(sep.revenue));
    const may = F.profitAndLoss(d, { start: '2026-05-01', end: '2026-05-31', basis: 'accrual' });
    assert.ok(may.revenue < 1100000, String(may.revenue));
});

test('accrual: a late installment after the course window stays in the same contract', () => {
    const d = data({ receipts: [rc('a', '2026-06-01', 1000000, { leadId: 'L', contractValue: 2100000 }), rc('b', '2026-09-20', 1100000, { leadId: 'L', contractValue: 2100000 })] });
    assert.equal(F.contracts(d).length, 1);
    assert.equal(F.contracts(d)[0].value, 2100000);
});

test('accrual: a full refund the next day releases the liability and leaves no phantom revenue', () => {
    const d = data({
        receipts: [rc('a', '2026-09-01', 3000000, { leadId: 'L', contractValue: 3000000 })],
        transactions: [tx('r', '2026-09-02', 'refund', 'REFUND', 3000000, { paymentRecordId: 'a' })]
    });
    const sep = F.profitAndLoss(d, { start: '2026-09-01', end: '2026-09-30', basis: 'accrual' });
    assert.equal(sep.net_revenue, 0);
    for (const m of ['2026-10', '2026-11']) assert.equal(F.profitAndLoss(d, { start: m + '-01', end: F.monthEnd(m), basis: 'accrual' }).net_revenue, 0);
    const bs = F.balanceSheet(d, '2026-09-30');
    assert.equal(bs.contractLiabilities, 0);
    assert.equal(bs.contractAssets, 0);
    assert.equal(bs.balanced, true, String(bs.imbalance));
});

test('accrual: a partial refund after two months keeps earned revenue and ends recognition', () => {
    const d = data({
        receipts: [rc('a', '2026-07-01', 3000000, { leadId: 'L', contractValue: 3000000 })],
        transactions: [tx('r', '2026-08-31', 'refund', 'REFUND', 1000000, { paymentRecordId: 'a', terminates: true })]
    });
    const c = F.contracts(d)[0];
    const at = F.earned(c, '2026-08-31');
    assert.equal(F.earned(c, '2026-12-31'), at);
    assert.ok(at <= 2000000);
    assert.equal(F.balanceSheet(d, '2026-12-31').balanced, true);
});

test('balance sheet identity holds across every movement type (IFRS 15 netting, PP&E, ECL, loans, salaries, bills)', () => {
    const d = data({
        receipts: [
            rc('a', '2026-09-10', 1000000, { leadId: 'A', contractValue: 3000000 }),
            rc('b', '2026-09-15', 2100000, { leadId: 'B', method: 'uzum' }),
            rc('c', '2026-10-01', 500000, { leadId: 'C', voidDate: '2026-10-05' }),
            rc('e', '2026-08-20', 700000, { leadId: 'E' }) // hisob ochilishidan oldin
        ],
        transactions: [
            tx('cap', '2026-09-05', 'expense', 'CAPEX', 3600000, { accountId: 'acc-cash', entity: 'common', usefulLifeMonths: 12 }),
            tx('own', '2026-09-01', 'capital', 'OWNER_IN', 5000000, { entity: 'common', accountId: 'acc-bank' }),
            tx('drw', '2026-10-03', 'drawing', 'OWNER_OUT', 400000, { entity: 'common', accountId: 'acc-bank' }),
            tx('ln', '2026-09-02', 'loan_in', 'LOAN_IN', 2000000, { entity: 'common', accountId: 'acc-bank', payableId: 'L1' }),
            tx('lr', '2026-10-02', 'loan_repay', 'LOAN_REPAY', 500000, { entity: 'common', accountId: 'acc-bank', payableId: 'L1' }),
            tx('int', '2026-10-02', 'expense', 'INTEREST', 40000, { entity: 'common', accountId: 'acc-bank' }),
            tx('sal', '2026-10-04', 'expense', 'COS_TEACHERS', 900000, { salaryId: 'S1' }),
            tx('bp', '2026-10-06', 'expense', 'RENT', 400000, { payableId: 'P1' }),
            tx('ads', '2026-09-25', 'expense', 'MKT_ADS', 800000),
            tx('set', '2026-10-01', 'transfer', 'TRANSFER', 1890000, { accountId: 'acc-uzum', toAccountId: 'acc-bank', entity: 'common' }),
            tx('fee', '2026-10-01', 'expense', 'BANK_FEES', 210000, { accountId: 'acc-uzum' }),
            tx('oth', '2026-10-07', 'income', 'REV_OTHER', 150000)
        ],
        payables: [{ id: 'P1', entity: 'russian', kind: 'bill', counterparty: 'Ijara', categoryCode: 'RENT', amount: 1200000, issueDate: '2026-09-30', dueDate: '2026-10-10' },
            { id: 'L1', entity: 'common', kind: 'loan', counterparty: 'Bank', categoryCode: 'LOAN_REPAY', amount: 2000000, issueDate: '2026-09-02' }],
        salaries: [{ id: 'S1', entity: 'russian', employeeName: 'Ustoz', amount: 900000, status: 'paid', periodStart: '2026-09-01', periodEnd: '2026-09-30', accrualDate: '2026-09-30', categoryCode: 'COS_TEACHERS' },
            { id: 'S2', entity: 'russian', employeeName: 'Ustoz', amount: 600000, status: 'unpaid', periodStart: '2026-10-01', periodEnd: '2026-10-15', accrualDate: '2026-10-15', categoryCode: 'COS_TEACHERS' }],
        receivables: [{ studentId: 'sa', leadId: 'A', entity: 'russian', debt: 2000000, dueDate: '2026-09-20' }]
    });
    for (const asOf of ['2026-09-01', '2026-09-15', '2026-09-30', '2026-10-05', '2026-10-31', '2026-12-31']) {
        const bs = F.balanceSheet(d, asOf);
        assert.equal(bs.balanced, true, `${asOf}: imbalance ${bs.imbalance}`);
        assert.equal(bs.totalAssets - bs.totalLiabilities, bs.netAssets);
    }
    const bs = F.balanceSheet(d, '2026-10-31');
    assert.equal(bs.loans, 1500000);
    assert.equal(bs.payables.salaries, 600000);
    assert.equal(bs.payables.bills, 800000);
    assert.ok(bs.ppeNet > 0 && bs.ppeNet < 3600000);
    assert.ok(bs.ecl > 0); // A: contract asset overdue 41 days
    assert.equal(bs.uzumReceivable, 0);
});

test('a student who has not paid the rest is not a balance-sheet asset beyond what was earned', () => {
    const d = data({ receipts: [rc('a', '2026-09-01', 1000000, { leadId: 'A', contractValue: 3000000 })],
        receivables: [{ studentId: 's', leadId: 'A', entity: 'russian', debt: 2000000, dueDate: '2026-10-01' }] });
    const bs = F.balanceSheet(d, '2026-09-02');
    assert.equal(bs.contractAssets, 0);
    assert.ok(bs.contractLiabilities > 900000); // to'langan, lekin hali o'tilmagan dars
    assert.equal(bs.balanced, true);
});

test('closed months are frozen: void, settings change and contract edits show up as prior-period adjustment', () => {
    const base = data({ receipts: [rc('a', '2026-09-01', 3000000, { leadId: 'A', contractValue: 3000000 })] });
    const snap = F.snapshotMonth(base, '2026-09');
    const closed = d => ({ ...d, closedThrough: '2026-09', snapshots: { '2026-09': snap } });
    const sepBefore = F.profitAndLoss(closed(base), { start: '2026-09-01', end: '2026-09-30', basis: 'accrual' }).net_profit;
    const variants = [
        { ...base, receipts: [{ ...base.receipts[0], voidDate: '2026-10-05' }] },
        { ...base, settings: { courseMonths: { english: 3, russian: 6 } } },
        { ...base, receipts: [{ ...base.receipts[0], contractValue: 4000000 }] }
    ];
    for (const v of variants) {
        const d = closed(v);
        assert.equal(F.profitAndLoss(d, { start: '2026-09-01', end: '2026-09-30', basis: 'accrual' }).net_profit, sepBefore);
        const oct = F.profitAndLoss(d, { start: '2026-10-01', end: '2026-10-31', basis: 'accrual' });
        const live = F.profitAndLoss({ ...v }, { start: '2026-09-01', end: '2026-09-30', basis: 'accrual' }).net_profit;
        assert.equal(oct.prior_adjustments, live - sepBefore);
        assert.equal(F.balanceSheet(d, '2026-09-30').fromSnapshot, true);
    }
});

test('salaries: paid-in-payroll but not cashed out stays a liability; due date drives overdue', () => {
    const d = data({ salaries: [{ id: 'S', entity: 'russian', employeeName: 'U', amount: 500000, status: 'paid', periodStart: '2026-09-01', periodEnd: '2026-09-30', accrualDate: '2026-09-30', categoryCode: 'PAY_SALES' }],
        settings: { ...settings, salaryDueDays: 10 } });
    const ap = F.payablesSummary(d, '2026-10-25');
    assert.equal(ap.salaries, 500000);
    assert.equal(ap.unreconciledSalaries, 500000);
    assert.equal(ap.rows[0].dueDate, '2026-10-10');
    assert.equal(ap.rows[0].overdueDays, 15);
});

test('entity P&L carries its share of common costs; CAC includes allocated marketing', () => {
    const d = data({
        receipts: [rc('r', '2026-10-01', 3000000, { leadId: 'R' }), rc('e', '2026-10-02', 1000000, { leadId: 'E', entity: 'english' })],
        transactions: [tx('rent', '2026-10-03', 'expense', 'RENT', 400000, { entity: 'common' }), tx('ads', '2026-10-03', 'expense', 'MKT_ADS', 800000, { entity: 'common' })]
    });
    const ru = F.profitAndLoss(d, { start: '2026-10-01', end: '2026-10-31', scope: 'russian' });
    assert.equal(ru.allocation.share, 75);
    assert.equal(ru.allocated_common, 900000);
    assert.equal(ru.net_profit, 3000000 - 900000);
    const all = F.profitAndLoss(d, { start: '2026-10-01', end: '2026-10-31', scope: 'all' });
    const en = F.profitAndLoss(d, { start: '2026-10-01', end: '2026-10-31', scope: 'english' });
    assert.equal(ru.net_profit + en.net_profit, all.net_profit);
    assert.equal(F.kpis(d, { start: '2026-10-01', end: '2026-10-31', scope: 'russian' }).cac, 600000);
});

test('kpis: new clients vs renewals, average contract vs first payment, collections, runway from free cash only', () => {
    const d = data({
        receipts: [rc('a', '2026-10-01', 1000000, { leadId: 'A', contractValue: 2100000 }), rc('a2', '2026-10-15', 1100000, { leadId: 'A', contractValue: 2100000 }),
            rc('b', '2026-10-05', 1500000, { leadId: 'B' }), rc('u', '2026-10-06', 9000000, { leadId: 'U', method: 'unknown' })]
    });
    const k = F.kpis(d, { start: '2026-10-01', end: '2026-10-31', scope: 'russian' });
    assert.equal(k.newClients, 3);
    assert.equal(k.averageFirstPayment, Math.round((1000000 + 1500000 + 9000000) / 3));
    assert.equal(k.averageContract, Math.round((2100000 + 1500000 + 9000000) / 3));
    assert.equal(k.collections, 1100000);
    assert.equal(k.freeCash, 1000000 + 1100000 + 1500000); // aniqlanmagan 9M va umumiy kassaning boshlang'ich qoldig'i (yo'nalish ko'rinishida) kirmaydi
});

test('suspicious detector flags test data but not real names', () => {
    for (const name of ['test', 'aaaaa', 'hvjh', 'mjlkmk', 'hjdbfjkkm', 'n mn nm']) assert.ok(F.suspiciousReasons({ name, phone: '901234567', amount: 500000, managerId: 'm' }).length, name);
    for (const name of ['Shohzod Saydazov', 'Ishpulatov Ulugbek', 'Зилолахон', 'Sevinch Ibrohimova', 'Abdurayimjonova Sarvinoz', 'Xolbek']) assert.deepEqual(F.suspiciousReasons({ name, phone: '901234567', amount: 500000, managerId: 'm' }), [], name);
    assert.ok(F.suspiciousReasons({ name: 'Bobojonova', phone: '902443056', amount: 300, managerId: 'm' }).some(r => /kichik/.test(r)));
});

test('reconcile: phone first, strong names, global best assignment, month-boundary tolerance, split payments', () => {
    const ledger = [
        { id: 'a', date: '2026-09-14', amount: 100000, name: 'Donyorbek', phone: '948634344' },
        { id: 'b', date: '2026-09-17', amount: 500000, name: 'Xolbek', phone: '930962529' },
        { id: 'c', date: '2026-09-23', amount: 500000, name: 'aaaaa', phone: '931112233' },
        { id: 'k', date: '2026-10-02', amount: 1200000, name: 'Ali Karimov', phone: '901111111' },
        { id: 'p1', date: '2026-10-10', amount: 600000, name: 'Laylo Usmonova', phone: '935555555' },
        { id: 'p2', date: '2026-10-10', amount: 400000, name: 'Laylo Usmonova', phone: '935555555' },
        { id: 'x', date: '2026-10-02', amount: 700000, name: 'Solijonova Xosiyatxon', phone: '907755958' },
        { id: 'o1', date: '2026-10-02', amount: 300000, name: 'Odil Rasulov', phone: '977777777' },
        { id: 'o2', date: '2026-10-08', amount: 300000, name: 'Odil Rasulov', phone: '977777777' }
    ];
    const external = [
        { date: '14.09.2026', name: 'Isroilov Doniyor', phone: '94 863 43 44', amount: '1 000 000' },
        { date: '17.09.2026', name: 'Shodmonov Xolbek', phone: '93 752 15 90', amount: 500000 },
        { date: '02.10.2026', name: 'Ali Valiyev', phone: '', amount: 900000 },
        { date: '10.10.2026', name: 'Usmonova Laylo', phone: '93 555 55 55', amount: 1000000 },
        { date: '30.09.2026', name: 'Solijonova Xosiyatxon', phone: '90 775 59 58', amount: 700000 },
        { date: '05.10.2026', name: 'Odil Rasulov', phone: '97 777 77 77', amount: 300000 },
        { date: '02.10.2026', name: 'Odil Rasulov', phone: '97 777 77 77', amount: 300000 }
    ];
    const r = F.reconcile(external, ledger, { start: '2026-09-01', end: '2026-10-31' });
    const st = id => r.results.find(x => x.ledger?.id === id || x.ledgers?.some(l => l.id === id))?.status;
    assert.equal(st('a'), 'amount_diff');                    // telefon mos
    assert.equal(st('b'), 'match');                          // telefon boshqa, lekin summa+sana+ism
    assert.equal(st('c'), 'extra_in_crm');
    assert.equal(st('k'), 'extra_in_crm');                   // faqat ism "Ali" bir xil — boshqa odam, tuzatilmaydi
    assert.equal(r.results.find(x => x.external?.name === 'Ali Valiyev').status, 'missing_in_crm');
    assert.equal(st('p1'), 'split'); assert.equal(st('p2'), 'split');
    assert.equal(st('x'), 'match');                          // 30.09 ↔ 02.10: oy chegarasi, tolerance ichida
    assert.equal(st('o1'), 'match'); assert.equal(st('o2'), 'match'); // tartibga bog'liq emas
    assert.ok(!r.results.some(x => x.status === 'missing_in_crm' && x.external?.name === 'Odil Rasulov'));
});

test('statement text from the audit PDF is parsed into rows with all amount columns', () => {
    const rows = F.parseStatementText([
        '№ | Sana | Ism Familiya | Telefon raqam | Tarif',
        '1 | 02.10.2026 | Qodirqulova Rano | 91 301 66 79 | Standart | Karta | Yarim | 1 200 000 UZS | 900 000 UZS | 900 000 UZS | Gulchehra',
        '14 | 13.10.2026 | Bobojonova Xosila | 90 244 30 56 | Standart | Karta | Yarim | 300 000 UZS | 1 500 000 UZS | 23.10.2026 | Hamidaxon',
        '15 | 14.10.2026 | Shartnoma №123456789 Karimov | 1 000 000 UZS',
        '7 500 000 UZS'
    ].join('\n'));
    assert.equal(rows.length, 3);
    assert.equal(rows[0].phone, '913016679');
    assert.deepEqual(rows[0].amounts, [1200000, 900000, 900000]);
    assert.deepEqual(rows[1].amounts, [300000, 1500000]);
    assert.equal(rows[2].phone, ''); // shartnoma raqami telefon emas
});

test('performance: 20k receipts and 3k transactions compute an overview in reasonable time', () => {
    const receipts = Array.from({ length: 20000 }, (_, i) => rc('r' + i, F.addDays('2025-01-01', i % 600), 500000 + (i % 7) * 100000, { leadId: 'L' + (i % 6000) }));
    const transactions = Array.from({ length: 3000 }, (_, i) => tx('t' + i, F.addDays('2025-01-01', i % 600), 'expense', 'MKT_ADS', 100000));
    const d = data({ receipts, transactions });
    const t0 = Date.now();
    F.profitAndLoss(d, { start: '2026-05-01', end: '2026-05-31', basis: 'accrual' });
    F.cashFlowStatement(d, { start: '2026-05-01', end: '2026-05-31' });
    F.balanceSheet(d, '2026-05-31');
    assert.ok(Date.now() - t0 < 8000, 'took ' + (Date.now() - t0) + 'ms');
});

// ---------- Auditor regressiyalari (2-bosqich) ----------
test('C1: a small non-terminating refund lowers the price; course continues and the liability fully clears', () => {
    const d = data({
        accounts: ACC.map(a => ({ ...a, openingDate: '2026-01-01' })),
        receipts: [rc('a', '2026-01-10', 3000000, { leadId: 'L', contractValue: 3000000 })],
        transactions: [tx('r', '2026-01-20', 'refund', 'REFUND', 200000, { paymentRecordId: 'a', terminates: false })]
    });
    const c = F.contracts(d)[0];
    assert.equal(c.terminatedAt, null);
    assert.equal(F.earned(c, '2026-04-30'), 2800000);
    assert.equal(F.contractPosition(c, '2026-04-30'), 0);
    assert.equal(F.contractPosition(c, '2027-12-31'), 0);
    const p = F.profitAndLoss(d, { start: '2026-01-01', end: '2026-12-31', basis: 'accrual' });
    assert.equal(p.net_revenue, 2800000);
    assert.equal(F.balanceSheet(d, '2026-04-30').balanced, true);
});

test('C1: a terminating refund releases the remaining liability (retained cash becomes revenue); storno of the refund reopens', () => {
    const base = { accounts: ACC.map(a => ({ ...a, openingDate: '2026-01-01' })), receipts: [rc('a', '2026-01-01', 3000000, { leadId: 'L', contractValue: 3000000 })] };
    const d = data({ ...base, transactions: [tx('r', '2026-01-31', 'refund', 'REFUND', 1500000, { paymentRecordId: 'a', terminates: true })] });
    const c = F.contracts(d)[0];
    assert.equal(c.terminatedAt, '2026-01-31');
    assert.equal(F.contractPosition(c, '2026-12-31'), 0);
    assert.equal(F.earned(c, '2026-12-31'), 1500000);
    const back = data({ ...base, transactions: [tx('r', '2026-01-31', 'refund', 'REFUND', 1500000, { paymentRecordId: 'a', terminates: true }),
        tx('rr', '2026-02-01', 'refund', 'REFUND', 1500000, { paymentRecordId: 'a', terminates: true, reversesId: 'r' })] });
    assert.equal(F.contracts(back)[0].terminatedAt, null);
    assert.equal(F.earned(F.contracts(back)[0], '2026-12-31'), 3000000);
});

test('C2: storno of an equipment purchase disposes the asset — no negative PP&E, depreciation stops, books balance', () => {
    const d = data({
        accounts: ACC.map(a => ({ ...a, openingDate: '2026-01-01', openingBalance: a.id === 'acc-bank' ? 10000000 : 0 })),
        transactions: [tx('cap', '2026-01-01', 'expense', 'CAPEX', 3600000, { entity: 'common', accountId: 'acc-bank', usefulLifeMonths: 36 }),
            tx('capr', '2026-07-01', 'expense', 'CAPEX', 3600000, { entity: 'common', accountId: 'acc-bank', usefulLifeMonths: 36, reversesId: 'cap' })]
    });
    for (const day of ['2026-07-01', '2026-12-31', '2028-06-30']) {
        const b = F.balanceSheet(d, day);
        assert.equal(b.ppeCost, 0); assert.equal(b.ppeNet, 0); assert.equal(b.balanced, true);
    }
    const before = F.balanceSheet(d, '2026-06-30');
    assert.ok(before.ppeNet > 0 && before.ppeNet < 3600000);
    const h2 = F.profitAndLoss(d, { start: '2026-07-01', end: '2026-12-31', basis: 'accrual' });
    assert.equal(h2.depreciation || 0, 0);
    const year = F.profitAndLoss(d, { start: '2026-01-01', end: '2026-12-31', basis: 'accrual' });
    assert.equal(year.depreciation, year.asset_result); // amortizatsiya chiqarish natijasi bilan yopiladi: sof 0
    assert.equal(year.net_profit, 0);
});

test('C3: allocation shares stay within 0–100% and add up exactly, even when one school has negative net revenue', () => {
    const d = data({
        receipts: [rc('e', '2026-03-02', 1000000, { entity: 'english', leadId: 'E' }), rc('r', '2026-02-10', 900000, { leadId: 'R' })],
        transactions: [tx('ref', '2026-03-05', 'refund', 'REFUND', 900000, { paymentRecordId: 'r', terminates: true }),
            tx('rent', '2026-03-01', 'expense', 'RENT', 1000001, { entity: 'common' }), tx('dep', '2026-03-01', 'expense', 'OTHER_EXP', 333, { entity: 'common' })],
        accounts: ACC.map(a => ({ ...a, openingDate: '2026-01-01' }))
    });
    const q = { start: '2026-03-01', end: '2026-03-31' };
    const en = F.profitAndLoss(d, { ...q, scope: 'english' }), ru = F.profitAndLoss(d, { ...q, scope: 'russian' }), all = F.profitAndLoss(d, { ...q, scope: 'all' });
    assert.ok(en.allocation.share >= 0 && en.allocation.share <= 100);
    assert.equal(en.allocation.share + ru.allocation.share, 100);
    assert.equal(en.net_profit + ru.net_profit, all.net_profit);
});

test('C3/M1: common depreciation and interest are allocated into their own lines, not into operating costs', () => {
    const d = data({
        accounts: ACC.map(a => ({ ...a, openingDate: '2026-01-01', openingBalance: 50000000 })),
        receipts: [rc('e', '2026-03-02', 1000000, { entity: 'english', leadId: 'E' }), rc('r', '2026-03-02', 3000000, { leadId: 'R' })],
        transactions: [tx('cap', '2026-03-01', 'expense', 'CAPEX', 3100000, { entity: 'common', usefulLifeMonths: 31 }), tx('int', '2026-03-10', 'expense', 'INTEREST', 400000, { entity: 'common' })]
    });
    const q = { start: '2026-03-01', end: '2026-03-31', basis: 'accrual' };
    const ru = F.profitAndLoss(d, { ...q, scope: 'russian' }), en = F.profitAndLoss(d, { ...q, scope: 'english' }), all = F.profitAndLoss(d, { ...q, scope: 'all' });
    assert.equal(ru.allocated_common || 0, 0);
    assert.equal(ru.depreciation + en.depreciation, all.depreciation);
    assert.equal(ru.finance_cost + en.finance_cost, all.finance_cost);
    assert.equal(ru.allocation.share, 75);
    assert.equal(ru.ebitda, ru.gross_profit);
});

test('C4: a late change to a closed month is shown once and frozen when the next month closes', () => {
    const base = data({ accounts: ACC.map(a => ({ ...a, openingDate: '2026-07-01' })), receipts: [rc('a', '2026-08-05', 1000000, { leadId: 'A', contractValue: 1000000 })] });
    const aug = F.snapshotMonth(base, '2026-08');
    const late = { ...base, salaries: [{ id: 'S', entity: 'russian', employeeName: 'U', amount: 500, status: 'unpaid', periodStart: '2026-08-01', periodEnd: '2026-08-31', accrualDate: '2026-08-31', categoryCode: 'PAY_ADMIN' }] };
    const c1 = { ...late, closedThrough: '2026-08', snapshots: { '2026-08': aug } };
    const sep = F.profitAndLoss(c1, { start: '2026-09-01', end: '2026-09-30', basis: 'accrual' });
    assert.equal(sep.prior_adjustments, -500);
    const sepSnap = F.snapshotMonth(c1, '2026-09');
    const c2 = { ...late, closedThrough: '2026-09', snapshots: { '2026-08': aug, '2026-09': JSON.parse(JSON.stringify(sepSnap)) } };
    assert.equal(F.profitAndLoss(c2, { start: '2026-09-01', end: '2026-09-30', basis: 'accrual' }).prior_adjustments, -500);
    assert.equal(F.profitAndLoss(c2, { start: '2026-10-01', end: '2026-10-31', basis: 'accrual' }).prior_adjustments || 0, 0);
    // jami davr bo'yicha tuzatish bir marta hisoblanadi
    assert.equal(F.profitAndLoss(c2, { start: '2026-08-01', end: '2026-10-31', basis: 'accrual' }).prior_adjustments, -500);
});

test('M2: a settings change applies only from its effective date (IAS 8), history keeps the old estimate', () => {
    const d = data({
        accounts: ACC.map(a => ({ ...a, openingDate: '2026-01-01' })),
        receipts: [rc('a', '2026-01-01', 3000000, { leadId: 'A', contractValue: 3000000 }), rc('b', '2026-06-01', 3000000, { leadId: 'B', contractValue: 3000000 })],
        settingsHistory: [{ from: '1900-01-01', data: { courseMonths: { english: 3, russian: 3 } } }, { from: '2026-05-01', data: { courseMonths: { english: 3, russian: 6 } } }]
    });
    const [a, b] = F.contracts(d);
    assert.equal(a.months, 3); assert.equal(b.months, 6);
});

test('M3: a frozen student stops revenue at the freeze date; a dropped-out student\'s unpaid earned part is fully impaired', () => {
    const base = { accounts: ACC.map(a => ({ ...a, openingDate: '2026-01-01' })), receipts: [rc('a', '2026-01-01', 900000, { leadId: 'A', studentId: 'S', contractValue: 3000000 })] };
    const frozen = data({ ...base, studentStatus: [{ studentId: 'S', frozenAt: '2026-01-31' }] });
    const c = F.contracts(frozen)[0];
    assert.equal(F.earned(c, '2026-03-31'), F.earned(c, '2026-01-31'));
    const left = data({ ...base, studentStatus: [{ studentId: 'S', inactive: true }] });
    const pos = F.contractPosition(F.contracts(left)[0], '2026-03-31');
    assert.ok(pos > 0);
    assert.equal(F.eclAt(left, '2026-03-31'), pos);
    assert.equal(F.balanceSheet(left, '2026-03-31').balanced, true);
});

test('M4: one definition of cash — balance sheet cash total equals the cash-flow closing figure', () => {
    const d = data({ receipts: [rc('a', '2026-09-10', 400000, { method: 'unknown' }), rc('b', '2026-09-11', 600000)] });
    const b = F.balanceSheet(d, '2026-09-30'), cf = F.cashFlowStatement(d, { start: '2026-09-01', end: '2026-09-30' });
    assert.equal(b.cashTotal, cf.closingCash);
    assert.equal(b.suspense, cf.closingSuspense);
});

test('reconcile: gender endings are not stripped — Aziza Karimova is not Aziz Karimov', () => {
    assert.equal(F.nameMatch('Aziza Karimova', 'Aziz Karimov'), 'none');
    assert.equal(F.nameMatch('Gulhayoxon Hoshimova', 'Hoshimova Gulhayo'), 'strong');
    assert.equal(F.nameMatch('Abdurahmonov Jasur', 'Abdurahmanov Jasur'), 'strong');
    const r = F.reconcile([{ date: '2026-09-10', name: 'Aziz Karimov', amount: 1800000 }],
        [{ id: 'x', date: '2026-09-10', name: 'Aziza Karimova', amount: 1800000 }, { id: 'y', date: '2026-09-11', name: 'Aziz Karimov', amount: 1800000 }]);
    const m = r.results.find(x => x.external);
    assert.equal(m.ledger.id, 'y');
});

// ---------- Auditor regressiyalari (3-bosqich) ----------
const ACC26 = ACC.map(a => ({ ...a, openingDate: '2026-01-01' }));
test('R3-C1: a reversed loan keeps its liability until the reversal date — balance sheet balances every day', () => {
    const d = data({ accounts: ACC26, transactions: [tx('L', '2026-02-01', 'loan_in', 'LOAN_IN', 10000000, { entity: 'common', accountId: 'acc-bank', payableId: 'P' }),
        tx('LR', '2026-04-10', 'loan_in', 'LOAN_IN', 10000000, { entity: 'common', accountId: 'acc-bank', payableId: 'P', reversesId: 'L' })],
        payables: [{ id: 'P', kind: 'loan', entity: 'common', amount: 10000000, issueDate: '2026-02-01', voided: true, voidDate: '2026-04-10', categoryCode: 'LOAN_REPAY' }] });
    for (const day of ['2026-02-01', '2026-03-31', '2026-04-09', '2026-04-10', '2026-06-30']) assert.equal(F.balanceSheet(d, day).balanced, true, day);
    assert.equal(F.balanceSheet(d, '2026-03-31').loans, 10000000);
    assert.equal(F.balanceSheet(d, '2026-04-10').loans, 0);
});

test('R3-C2: paying for the next course early opens a new contract that starts after the current one', () => {
    const d = data({ accounts: ACC26, receipts: [rc('a', '2026-01-01', 1000000, { leadId: 'L', contractValue: 1000000 }), rc('b', '2026-03-25', 1000000, { leadId: 'L', contractValue: 1000000 })] });
    const cs = F.contracts(d);
    assert.equal(cs.length, 2);
    assert.equal(cs[1].start, '2026-04-01'); assert.equal(cs[1].earlyRenewal, true);
    const q1 = F.profitAndLoss(d, { start: '2026-01-01', end: '2026-03-31', basis: 'accrual' });
    const q2 = F.profitAndLoss(d, { start: '2026-04-01', end: '2026-06-30', basis: 'accrual' });
    assert.equal(q1.net_revenue, 1000000); assert.equal(q2.net_revenue, 1000000);
    assert.equal(F.balanceSheet(d, '2026-03-31').contractLiabilities, 1000000);
    // To'liq to'lanmagan kursga oxirida kelgan to'lov — qarzni yopish, yangi kurs emas
    const debt = data({ accounts: ACC26, receipts: [rc('a', '2026-01-01', 500000, { leadId: 'L', contractValue: 1000000 }), rc('b', '2026-03-25', 500000, { leadId: 'L', contractValue: 1000000 })] });
    assert.equal(F.contracts(debt).length, 1);
});

test('R3-M4: cash-basis revenue counts Uzum sales only when Uzum pays (net + commission), matching cash receipts', () => {
    const d = data({ accounts: ACC26, receipts: [rc('u', '2026-03-05', 2000000, { method: 'uzum', entity: 'english', leadId: 'U' })],
        transactions: [tx('s', '2026-04-10', 'transfer', 'TRANSFER', 1800000, { entity: 'english', accountId: 'acc-uzum', toAccountId: 'acc-bank' }),
            tx('f', '2026-04-10', 'expense', 'BANK_FEES', 200000, { entity: 'english', accountId: 'acc-uzum' })] });
    assert.equal(F.profitAndLoss(d, { start: '2026-03-01', end: '2026-03-31', scope: 'english' }).revenue || 0, 0);
    const apr = F.profitAndLoss(d, { start: '2026-04-01', end: '2026-04-30', scope: 'english' });
    assert.equal(apr.revenue, 2000000); assert.equal(apr.payment_fees, 200000);
    assert.equal(F.cashFlowStatement(d, { start: '2026-04-01', end: '2026-04-30', scope: 'english' }).operating.find(l => l.key === 'receipts').amount, 1800000);
});

test('R3: dropout impairment starts at the dropout date (or course end if unknown), not retroactively', () => {
    const base = { accounts: ACC26, receipts: [rc('a', '2026-01-01', 900000, { leadId: 'A', studentId: 'S', contractValue: 3000000 })],
        settings: { ...settings, eclRates: { not_due: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90: 0, no_date: 0 } } };
    const dated = data({ ...base, studentStatus: [{ studentId: 'S', inactive: true, inactiveAt: '2026-02-15' }] });
    assert.equal(F.eclAt(dated, '2026-01-31'), 0);
    const undated = data({ ...base, studentStatus: [{ studentId: 'S', inactive: true }] });
    assert.equal(F.eclAt(undated, '2026-02-28'), 0);
    assert.ok(F.eclAt(undated, '2026-03-31') > 0);
});

test('R3: reconcile matches Cyrillic and Latin spellings; namesakes with different phones go to manual review', () => {
    assert.equal(F.nameMatch('Шохрух Алиев', 'Shohruh Aliyev'), 'strong');
    const r = F.reconcile([{ date: '2026-09-10', name: 'Ali Valiyev', phone: '901112233', amount: 500000 }], [{ id: 'x', date: '2026-09-10', name: 'Ali Valiyev', phone: '+998935556677', amount: 500000 }]);
    assert.equal(r.results[0].status, 'match'); assert.equal(r.results[0].review, true); assert.equal(r.review, 1);
});

test('R3: turnover tax is accrued on revenue at the effective rate and settled by payments', () => {
    const d = data({ accounts: ACC26, receipts: [rc('a', '2026-03-01', 1000000, { leadId: 'A', contractValue: 1000000 })],
        transactions: [tx('t', '2026-04-15', 'expense', 'TAX_TURNOVER', 40000, { entity: 'common' })],
        settingsHistory: [{ from: '1900-01-01', data: { courseMonths: { english: 3, russian: 3 } } }, { from: '2026-03-01', data: { courseMonths: { english: 3, russian: 3 }, turnoverTaxRate: 4 } }] });
    const q = F.profitAndLoss(d, { start: '2026-03-01', end: '2026-05-31', basis: 'accrual' });
    assert.equal(q.turnover_tax, 40000);
    assert.equal(F.balanceSheet(d, '2026-05-31').taxPayable, 0);
    assert.equal(F.balanceSheet(d, '2026-05-31').balanced, true);
});

test('R3: impairment lowers book value and later depreciation; a sale books the gain or loss', () => {
    const d = data({ accounts: ACC.map(a => ({ ...a, openingDate: '2026-01-01', openingBalance: 9000000 })),
        transactions: [tx('cap', '2026-01-01', 'expense', 'CAPEX', 3650000, { entity: 'common', accountId: 'acc-bank', usefulLifeMonths: 12 }),
            tx('sale', '2026-07-01', 'income', 'ASSET_SALE', 1000000, { entity: 'common', accountId: 'acc-bank', assetId: 'cap' })],
        assetEvents: [{ assetId: 'cap', kind: 'impairment', date: '2026-04-01', amount: 500000 }, { assetId: 'cap', kind: 'disposal', date: '2026-07-01', amount: 1000000 }] });
    const a = F.fixedAssets(d)[0];
    const nbvBefore = F.netBookValue(a, '2026-06-30');
    const y = F.profitAndLoss(d, { start: '2026-01-01', end: '2026-12-31', basis: 'accrual' });
    assert.equal(y.asset_result, -500000 + (1000000 - nbvBefore));
    for (const day of ['2026-03-31', '2026-04-01', '2026-06-30', '2026-07-01', '2026-12-31']) assert.equal(F.balanceSheet(d, day).balanced, true, day);
    assert.equal(F.balanceSheet(d, '2026-07-01').ppeNet, 0);
});
