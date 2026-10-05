const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/paymentLedger');
const engine = require('../js/payrollEngine');
const access = require('../js/studentAccess');
const { appContext, functionSource } = require('./helpers/lead-workflow-fixture.cjs');
const lead = (overrides = {}) => ({ id: 'l', language: 'english', status: 'tolov-yopildi',
    paymentSurvey: { paymentType: 'partial', paidAmount: 600000, totalAmount: 2000000, debtAmount: 1400000, lastPaymentDate: '2026-09-30', tariff: '30' },
    paymentClosedSurvey: { actualAmount: 2000000, closedDate: '2026-10-04' }, ...overrides });
test('deposit and cumulative closing produce two exact receipts, not two full prices', () => {
    assert.deepEqual(L.leadEvents(lead()).events.map(e => [e.kind, e.amount, e.paidDate]), [['deposit', 600000, '2026-09-30'], ['closing', 1400000, '2026-10-04']]);
});
test('a contractual price alone does not prove cash received', () => {
    assert.equal(L.leadEvents(lead({ status: 'tolov-jarayonida', paymentSurvey: { paymentType: 'full', totalAmount: 2000000 }, paymentClosedSurvey: {} })).events.length, 0);
    assert.equal(L.leadEvents(lead({ paymentSurvey: { paymentType: 'full', totalAmount: 2000000 }, paymentClosedSurvey: { closedDate: '2026-10-04' } })).issues.length, 1);
});
test('lender approval without actual receipt does not create income', () => {
    assert.equal(L.leadEvents(lead({ paymentSurvey: { paymentType: 'installment' }, paymentClosedSurvey: { actualAmount: 2000000, closedDate: '2026-10-04', installmentReceived: 'no' } })).events.length, 0);
    assert.equal(L.leadEvents(lead({ paymentSurvey: { paymentType: 'installment' }, paymentClosedSurvey: { actualAmount: 2000000, closedDate: '2026-10-04', installmentReceived: 'yes', installmentReceivedDate: '2026-10-02' } })).events[0].paidDate, '2026-10-02');
});
test('missing amount/date and cumulative below deposit are reported, never invented', () => {
    for (const ps of [{ paymentType: 'partial', paidAmount: 1 }, { paymentType: 'partial', lastPaymentDate: '2026-10-04' }]) {
        const result = L.leadEvents(lead({ status: 'tolov-jarayonida', paymentSurvey: ps, paymentClosedSurvey: {} }));
        assert.equal(result.events.length, 0); assert.equal(result.issues.length, 1);
    }
    assert.equal(L.leadEvents(lead({ paymentClosedSurvey: { actualAmount: 1, closedDate: '2026-10-04' } })).issues.length, 1);
});
test('date and money parsing are exact and reject rollover, fractions, negatives and unsafe numbers', () => {
    assert.equal(L.date('30.09.2026'), '2026-09-30'); assert.equal(L.date('2026-10-04'), '2026-10-04');
    for (const d of ['2026-02-30', '01/02/26', '', '2026-13-01', '2026-10-4']) assert.equal(L.date(d), '');
    assert.equal(L.money('2 100 000'), 2100000); assert.equal(L.money(0), 0);
    for (const n of ['', null, -1, 1.5, '10abc', Number.MAX_SAFE_INTEGER + 1]) assert.equal(L.money(n), null);
});
test('receipt URLs cannot navigate to external, executable or traversed paths', () => {
    assert.equal(L.receipt('/uploads/abc-123.pdf'), '/uploads/abc-123.pdf');
    for (const path of ['javascript:alert(1)', 'https://evil/check.png', '/uploads/../private.png', '/uploads/x.html', '/uploads/a.png?x=1']) assert.equal(L.receipt(path), '');
});
const records = [
    { id: 'a', studentId: 's', name: 'Aziza', phone: '+998 90 123 45 67', paidDate: '2026-09-30', amount: 600000, debt: 0, method: 'card', managerId: 'm', teacherId: 't', tariff: 30, form: 'partial', language: 'english' },
    { id: 'b', studentId: 's', name: 'Aziza', phone: '+998901234567', paidDate: '2026-10-04', amount: 1400000, debt: 0, method: 'cash', managerId: 'm', teacherId: 't', tariff: 30, form: 'full', language: 'english' },
    { id: 'c', studentId: 's2', name: 'Komil', phone: '+998 91 765 43 21', paidDate: '2026-10-04', amount: 300000, debt: 1000000, method: 'uzum', managerId: 'm2', teacherId: 't2', tariff: 15, form: 'partial', language: 'russian' }
];
test('date presentation and next-payment display do not mutate historical receipt dates', () => {
    const old={debt:0,nextPaymentDate:'2026-09-30'};
    assert.equal(L.nextDate(old.debt,undefined,old.nextPaymentDate),'');
    assert.equal(L.nextDate(100000,'','2026-09-30'),'');
    assert.equal(L.nextDate(100000,undefined,'2026-09-30'),'2026-09-30');
    assert.equal(L.displayDate('2026-09-30'),'30.09.2026');
    assert.deepEqual(old,{debt:0,nextPaymentDate:'2026-09-30'});
});
test('invalid ranges are explicit, rather than a misleading zero-income report',()=>{
    assert.ok(L.rangeError({start:'2026-10-05',end:'2026-10-01'}));
    assert.ok(L.rangeError({start:'2026-02-30'}));
    assert.equal(L.rangeError({start:'2026-10-05',end:'2026-10-05'}),'');
});
test('Excel money stays numeric and renders every thousands group with a space',()=>{
    const X=require('../js/vendor/xlsx.full.min.js');
    for(const n of [0,999,1000,600000,2100000,21460000,Number.MAX_SAFE_INTEGER]) {
        assert.equal(X.SSF.format(L.excelMoneyFormat(n),n),n.toLocaleString('en-US').replaceAll(',',' ')+' UZS');
    }
    const ws=X.utils.aoa_to_sheet([[2100000]]);ws.A1.z=L.excelMoneyFormat(ws.A1.v);
    const book=X.utils.book_new();X.utils.book_append_sheet(book,ws,'Tushum');
    const roundtrip=X.read(X.write(book,{type:'buffer',bookType:'xlsx'}),{type:'buffer',cellNF:true});
    assert.equal(roundtrip.Sheets.Tushum.A1.t,'n');assert.equal(roundtrip.Sheets.Tushum.A1.v,2100000);
    assert.equal(roundtrip.Sheets.Tushum.A1.w,'2 100 000 UZS');
});
test('legacy review and unassigned-manager filters retain original receipts and amounts',()=>{
    const data=[...records,{...records[0],id:'unassigned',managerId:'',legacyReview:true}];
    const before=JSON.stringify(data);
    assert.equal(L.summary(L.filter(data,{manager:'__unassigned'})).amount,600000);
    assert.equal(L.filter(data,{review:'missing-manager'}).length,1);
    assert.equal(L.filter(data,{review:'legacy'}).length,1);
    assert.equal(JSON.stringify(data),before);
});
test('old issues are scoped by known language and reference date, undated facts stay explicit',()=>{
    const issues=[{language:'english',date:'2026-09-30',name:'Aziza'}, {language:'russian',date:'2026-09-30'},
        {language:'english',date:''}, {language:null,date:''}];
    assert.equal(L.filterIssues(issues,'english',{start:'2026-10-01',end:'2026-10-31'}).length,1);
    assert.equal(L.filterIssues(issues,'english',{start:'2026-09-01',end:'2026-09-30',search:'aziza'}).length,1);
    assert.equal(L.filterIssues(issues,'russian').length,1);
});
test('all filters compose and date end is inclusive', () => {
    assert.deepEqual(L.filter(records, { start: '2026-10-04', end: '2026-10-04', search: 'AZIZA', manager: 'm', teacher: 't', tariff: '30', method: 'cash', form: 'full' }).map(r => r.id), ['b']);
    assert.equal(L.filter(records, { search: '90 123 45' }).length, 2);
    assert.equal(L.filter(records, { method: 'bank' }).length, 0);
    assert.equal(L.filter(records,{search:'Komil 1'}).length,0); // A number in a name is not a phone query.
});
test('summary counts distinct student debts, not one debt per receipt', () => {
    const rs = records.map(r => ({ ...r, debt: r.studentId === 's' ? 100000 : r.debt }));
    assert.deepEqual(L.summary(rs), { count: 3, amount: 2300000, debt: 1100000 });
});
test('cash flow rows are derived read-only with stable transaction/account identity', () => {
    const cash = L.cashFlow(records);
    assert.equal(cash.length, 3); assert.equal(cash[0].id, 'inflow:a'); assert.equal(cash[1].paymentMethod, 'Naqd pul');
    assert.ok(cash.every(r => r.ledgerGenerated && r.paymentRecordId && r.type === 'kirim'));
});
test('KPI uses each receipt in its own period, counts deposits and never adds legacy closed total', () => {
    const src = { hrEmployees: [{ id: 'm', role: 'sotuv-menejeri', lang: 'english', startDate: '2026-09-01' }], students: [], teachers: [],
        leads: { english: [{ ...lead(), managerId: 'm' }] }, paymentRecords: records, mainAttendance: {}, assistantAttendance: {}, salesPlan: {}, bonusHistory: [] };
    const september = engine.calculate(src, engine.defaults(), engine.period('2026-09-01', '2026-09-30'), 'english');
    const october = engine.calculate(src, engine.defaults(), engine.period('2026-10-01', '2026-10-31'), 'english');
    assert.equal(september.turnover, 600000); assert.equal(september.rows[0].commission, 30000);
    assert.equal(october.turnover, 1400000); assert.equal(october.rows[0].commission, 70000);
    assert.equal(engine.calculate({ ...src, paymentRecords: [] }, engine.defaults(), engine.period('2026-10-01', '2026-10-31'), 'english').turnover, 0);
});
test('actual refund is subtracted once in receipt mode, including cancelled leads', () => {
    const src = { hrEmployees: [], students: [], teachers: [], leads: { english: [{ ...lead(), cancelled: true, managerId: 'm' }] },
        paymentRecords: records, cashFlow: [{ id: 'r', leadId: 'l', language: 'english', managerId: 'm', type: 'chiqim', purpose: 'Pul qaytarish (Refund)', amount: 100000, date: '2026-10-04' }] };
    assert.equal(engine.salesFacts(src, 'english', engine.period('2026-10-01', '2026-10-31'), engine.defaults()).turnover, 1300000);
});
test('student provisioning/backfill cannot reset canonical payment balances', () => {
    const old = { id: 's', name: 'A', subject: 'english', paymentLedgerManaged: true, paidAmount: 2000000, debtAmount: 0, paymentCount: 2, lastPaymentDate: '2026-10-04', paymentDueDate: '', paymentLedgerOpeningPaid: 0 };
    const s = access.buildStudentForLead(lead({ name: 'A', phone: '+998901234567', status: 'tolov-jarayonida' }), 'english', old, [], '2026-10-04');
    for (const key of ['paidAmount', 'debtAmount', 'paymentCount', 'lastPaymentDate', 'paymentDueDate', 'paymentLedgerOpeningPaid']) assert.equal(s[key], old[key]);
});
test('Cash Flow periods and trends use Tashkent accounting dates rather than browser timezone', () => {
    const c = appContext(['cfDateInPeriod', 'cfMonthKey', 'cfTrend'], { PaymentLedger: { ...L, today: () => '2026-10-05' } });
    assert.equal(c.cfDateInPeriod('2026-10-05', 'kunlik'), true);
    assert.equal(c.cfDateInPeriod('2026-10-04', 'kunlik'), false);
    assert.equal(c.cfDateInPeriod('2026-10-04', 'haftalik'), false);
    assert.equal(c.cfDateInPeriod('2026-10-05', 'haftalik'), true);
    assert.equal(c.cfMonthKey('2026-10-01'), '2026-10');
    const trend = c.cfTrend([{ date: '2026-10-05', type: 'kirim', amount: 42 }], 2);
    assert.equal(trend[0].date, '2026-10-04'); assert.equal(trend[1].kirim, 42);
});
test('derived cash receipts cannot be saved/deleted as independent manual cash rows', () => {
    let saved;
    const manual = [{ id: 'expense', type: 'chiqim', amount: 123 }, { id: 'duplicate', paymentRecordId: 'a', amount: 600000 }];
    const decisions = [{ cashId: 'duplicate', recordId: 'a', decision: 'linked', snapshot: L.stable(manual[1]) }];
    const c = appContext(['getCashFlowTx', 'saveCashFlowTx', 'deleteCashFlowTx'], { inflowUI: { cashProjection: () => L.projectCash(manual, records, decisions) },
        STORAGE_KEYS: { cashFlow: 'cash' }, getItem: () => manual, setItem: (_key, list) => { saved = list; } });
    assert.equal(c.getCashFlowTx().length, 4); // Three receipts + independent manual expense.
    c.saveCashFlowTx(c.getCashFlowTx()); assert.equal(saved.length, 2); assert.equal(saved[0].id, 'expense');
    assert.equal(saved[1].id, 'duplicate'); // Archival source survives, excluded from effective balance.
    saved = null; c.deleteCashFlowTx('inflow:a'); assert.equal(saved, null);
});

test('cash duplicates are quarantined until finance decides, independent income and unrelated accounts survive', () => {
    const old = { id: 'old', type: 'kirim', category: 'sotuv', purpose: "Kurs to'lovi", date: '2026-09-30', amount: 600000, paymentMethod: 'Karta' };
    const pending = L.projectCash([old], [records[0]]);
    assert.equal(pending.pending.length, 1);
    assert.equal(pending.rows.reduce((sum,r) => sum+r.amount, 0), 600000);
    for (const decision of ['linked','independent']) {
        const result = L.projectCash([old], [records[0]], [{ cashId:'old', decision, recordId:'a', snapshot:L.stable(old) }]);
        assert.equal(result.pending.length, 0);
        assert.equal(result.rows.reduce((sum,r) => sum+r.amount, 0), decision === 'linked' ? 600000 : 1200000);
    }
    assert.equal(L.projectCash([{ ...old, paymentMethod:'Naqd pul' }], [records[0]]).pending.length, 0);
    assert.equal(L.projectCash([{ ...old, lang:'russian' }], [records[0]]).pending.length, 0);
    assert.equal(L.projectCash([{ ...old, type:'chiqim' }], [records[0]]).pending.length, 0);
    const stale = [{ cashId:'old', decision:'independent', snapshot:L.stable({ ...old, notes:'old' }) }];
    assert.equal(L.projectCash([old], [records[0]], stale).pending.length, 1);
});

test('student payment history uses canonical receipts and keeps unmatched old rows outside the confirmed total', async () => {
    const history = require('../server/services/paymentHistory');
    const db = { query: async sql => ({ rows: sql.includes('FROM payment_records') ?
        [{ id:'receipt',source_key:'academic:p1',amount:'600000',method:'card',tariff:30,date:'2026-09-30',debt_snapshot:'1400000',receipt_url:'/uploads/a.png' }] :
        [{ id:'p1',paid:600000,date:'2026-09-30' },{ id:'ambiguous',paid:100000,date:'' }] }) };
    const result = await history.forStudent(db, { id:'s',subject:'english',debtAmount:1400000 });
    assert.equal(result.history.length, 1); assert.equal(result.summary.amount, 600000);
    assert.equal(result.legacyHistory.length, 1); assert.equal(result.legacyHistory[0].id, 'ambiguous');
    assert.equal(result.summary.debt, 1400000);
});

test('old payment screen redirects to the ledger and legacy payment writes fail before any state mutation', async () => {
    const visited = [];
    const c = appContext(['renderPayments'], { switchTab: value => visited.push(value), switchFinanceSection: value => visited.push(value),
        document: { getElementById: () => ({ addEventListener() {} }) } });
    c.renderPayments(); assert.deepEqual(visited, ['finance','tolovlar']);
    const vm = require('node:vm'), context = vm.createContext({});
    vm.runInContext(functionSource('server/db.js','patchState'), context);
    await assert.rejects(context.patchState({ payments: [] }, { role:'admin' }), { status:409 });
});
test('new zero-money closure of a paid-price course is rejected, without inserting a receipt', async () => {
    const service = require('../server/services/inflow'); let writes = 0;
    const db = { query: async sql => { if (/^(INSERT|UPDATE)/.test(sql)) writes++; return { rows: [] }; } };
    await assert.rejects(service.syncLead(db, lead({ paymentSurvey: { paymentType: 'full', totalAmount: 2000000 },
        paymentClosedSurvey: { actualAmount: 0, closedDate: '2026-10-04' } }), null, { id: 'admin', name: 'Admin' }), { status: 400 });
    assert.equal(writes, 0);
});
