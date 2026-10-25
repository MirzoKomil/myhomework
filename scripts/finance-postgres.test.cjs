const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Pool } = require('pg');
const inflow = require('../server/services/inflow');
const cash = require('../server/services/paymentCash');
const finance = require('../server/services/finance');
const F = require('../js/financeEngine');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url && (new URL(url).hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(new URL(url).pathname))) throw Error('Only disposable test DB allowed');

test('real PostgreSQL finance integration', { skip: !url }, async t => {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-test-uploads-'));
    fs.mkdirSync(path.join(process.env.DATA_DIR, 'uploads'));
    for (const name of ['audit.pdf', 'rent.png', 'big.pdf']) fs.writeFileSync(path.join(process.env.DATA_DIR, 'uploads', name), 'evidence');
    const pool = new Pool({ connectionString: url });
    const admin = { id: 'admin' }, accountant = { id: 'acc' }, manager = { id: 'manager' };
    let seq = 0;
    const key = () => 'test-request-key-' + String(++seq).padStart(6, '0');
    const expectError = async (promise, status, re) => {
        await assert.rejects(promise, e => (status ? e.status === status : true) && (!re || re.test(e.message)) || assert.fail(`${e.status} ${e.message}`));
    };
    try {
        await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,avatar TEXT);
        CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,role TEXT,lang TEXT,login TEXT,department TEXT,status TEXT,start_date TEXT,join_date TEXT);
        CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
        CREATE TABLE teachers(id TEXT PRIMARY KEY,name TEXT);
        CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,group_name TEXT,teacher_id TEXT,lesson_duration INTEGER,extra_data JSONB);
        CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,manager_id TEXT,status TEXT,language TEXT,deleted_at TIMESTAMPTZ,extra_data JSONB,comments TEXT DEFAULT '[]',updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE payments(id TEXT PRIMARY KEY,student_id TEXT,paid INTEGER,debt INTEGER,date TEXT);
        CREATE TABLE json_data(key TEXT PRIMARY KEY,data JSONB);
        CREATE TABLE salary_transactions(id TEXT PRIMARY KEY,employee_id TEXT,language TEXT,period_start DATE,period_end DATE,amount BIGINT,status TEXT,paid_at TIMESTAMPTZ,cash_expense_id TEXT);
        INSERT INTO users VALUES('admin','Admin','admin','admin',''),('acc','Buxgalter','acc','accountant',''),('manager','Sales','sales','sales_manager','');
        INSERT INTO hr_employees(id,name,role,lang,login,status) VALUES('m','Sales','sotuv-menejeri','russian','sales','active'),('t1','Ustoz','rus-oqituvchi','russian','t1','active');
        INSERT INTO user_sales_manager_links VALUES('manager','m');
        INSERT INTO json_data VALUES('cashFlow','[{"id":"cf1","type":"chiqim","category":"operatsion","purpose":"Target byudjeti","amount":300000,"date":"2026-09-05","paymentMethod":"Karta","person":"Meta"},{"id":"cf2","type":"chiqim","category":"operatsion","purpose":"CEO shaxsiy xarajati","amount":100000,"date":"2026-09-06","paymentMethod":"Naqd pul"}]');
        INSERT INTO students VALUES('s1','Ali','+998901112233','russian','g',NULL,30,'{"debtAmount":800000,"paymentDueDate":"2026-10-01","leadRef":{"id":"l1"}}');
        INSERT INTO salary_transactions VALUES('sal1','t1','russian','2026-09-01','2026-09-30',900000,'paid',NOW(),NULL),('sal2','t1','russian','2026-10-01','2026-10-15',400000,'unpaid',NULL,NULL);`);
        await inflow.initSchema(pool); await cash.initSchema(pool);
        await finance.initSchema(pool); await finance.initSchema(pool); // idempotent

        await t.test('legacy Cash Flow rows are migrated once, flagged, and mapped to proper categories', async () => {
            const rows = (await pool.query('SELECT type,category_code,account_id,amount,legacy FROM fin_transactions ORDER BY txn_date')).rows;
            assert.deepEqual(rows.map(r => [r.type, r.category_code, r.account_id, Number(r.amount), r.legacy]), [
                ['expense', 'MKT_ADS', 'acc-card', 300000, true], ['drawing', 'OWNER_OUT', 'acc-cash', 100000, true]]);
            assert.equal((await pool.query('SELECT COUNT(*) AS n FROM fin_accounts')).rows[0].n, '5');
        });

        // Ikki haqiqiy tushum va bitta test tushum
        const insertReceipt = (id, date, amount, o = {}) => pool.query(`INSERT INTO payment_records(id,source_key,lead_id,student_id,language,manager_id,paid_date,amount,method,receipt_url,form,debt_snapshot,snapshot,legacy_review,actor_id)
            VALUES($1,$2,$3,$4,'russian','m',$5,$6,$7,'',$8,0,$9,TRUE,'system')`, [id, 'lead:' + id + ':deposit', o.lead || 'l-' + id, o.student || null, date, amount, o.method || 'card', o.form || 'partial', JSON.stringify({ name: o.name || 'Ali', phone: o.phone || '+998901112233', managerName: 'Sales' })]);
        await insertReceipt('r1', '2026-09-14', 100000, { lead: 'l1', student: 's1' });
        await insertReceipt('r2', '2026-10-01', 1800000, { form: 'full', name: 'Vali', phone: '+998970280022' });
        await insertReceipt('rt', '2026-10-02', 500000, { name: 'test', phone: '800000000' });

        await t.test('only finance roles can read or write', async () => {
            await expectError(finance.overview(pool, manager, {}), 403);
            await expectError(finance.createTransaction(pool, manager, { requestKey: key() }), 403);
            const o = await finance.overview(pool, accountant, { start: '2026-09-01', end: '2026-10-31', scope: 'russian' });
            assert.equal(o.cashflow.reconciled, true);
            assert.equal(o.quality.suspicious.some(r => r.name === 'test'), true);
            assert.equal(o.quality.paidSalaryWithoutCash.map(s => s.id).join(), 'sal1');
            assert.equal(o.payables.salaries, 400000);
            assert.equal(o.receivables.total, 800000);
        });

        await t.test('expense validation: category/type, evidence for large amounts, no future dates, idempotent retries', async () => {
            const base = { entity: 'russian', type: 'expense', categoryCode: 'RENT', accountId: 'acc-card', amount: 1200000, date: '2026-10-03', counterparty: 'Ijarachi' };
            await expectError(finance.createTransaction(pool, accountant, { ...base, requestKey: key(), categoryCode: 'OWNER_IN' }), 400, /toifa/);
            await expectError(finance.createTransaction(pool, accountant, { ...base, requestKey: key() }), 400, /chek/);
            await expectError(finance.createTransaction(pool, accountant, { ...base, requestKey: key(), receiptUrl: '/uploads/missing.png' }), 400, /topilmadi/);
            await expectError(finance.createTransaction(pool, accountant, { ...base, requestKey: key(), date: F.addDays(F.today(), 2), receiptUrl: '/uploads/rent.png' }), 400, /kelajak/);
            const k = key();
            const a = await finance.createTransaction(pool, accountant, { ...base, requestKey: k, receiptUrl: '/uploads/rent.png' });
            const b = await finance.createTransaction(pool, accountant, { ...base, requestKey: k, receiptUrl: '/uploads/rent.png' });
            assert.equal(a.id, b.id); assert.equal(b.duplicate, true);
            assert.equal((await pool.query("SELECT COUNT(*) AS n FROM fin_audit WHERE action='transaction-create'")).rows[0].n, '1');
        });

        await t.test('refund cannot exceed the receipt and takes the receipt language', async () => {
            await expectError(finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'common', type: 'refund', categoryCode: 'REFUND', accountId: 'acc-card', amount: 1900000, date: '2026-10-04', paymentRecordId: 'r2', counterparty: 'Vali', receiptUrl: '/uploads/big.pdf' }), 409);
            const r = await finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'common', type: 'refund', categoryCode: 'REFUND', accountId: 'acc-card', amount: 300000, date: '2026-10-04', paymentRecordId: 'r2', counterparty: 'Vali' });
            assert.equal((await pool.query('SELECT entity FROM fin_transactions WHERE id=$1', [r.id])).rows[0].entity, 'russian');
            await expectError(finance.voidReceipts(pool, accountant, { recordIds: ['r2'], reason: 'Dublikat yozuv' }), 409, /qaytarish/);
        });

        await t.test('storno nets out, cannot be repeated, and keeps the original row untouched', async () => {
            const x = await finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'common', type: 'expense', categoryCode: 'SOFTWARE', accountId: 'acc-card', amount: 200000, date: '2026-10-05', counterparty: 'Hosting' });
            await expectError(finance.reverseTransaction(pool, accountant, x.id, { reason: 'x' }), 400, /sabab/);
            const rv = await finance.reverseTransaction(pool, accountant, x.id, { reason: 'Noto‘g‘ri kiritilgan' });
            await expectError(finance.reverseTransaction(pool, accountant, x.id, { reason: 'Yana bir bor' }), 409);
            await expectError(finance.reverseTransaction(pool, accountant, rv.id, { reason: 'Storno stornosi' }), 400);
            const o = await finance.overview(pool, accountant, { start: '2026-10-05', end: '2026-10-05', scope: 'all' });
            assert.equal(o.pnl.software || 0, 0);
            assert.equal((await pool.query('SELECT amount FROM fin_transactions WHERE id=$1', [x.id])).rows[0].amount, '200000');
        });

        await t.test('transfers and loans: balances move, loan becomes a payable and repayment is capped', async () => {
            await finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'common', type: 'transfer', categoryCode: 'TRANSFER', accountId: 'acc-card', toAccountId: 'acc-cash', amount: 50000, date: '2026-10-06' });
            const loan = await finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'common', type: 'loan_in', categoryCode: 'LOAN_IN', accountId: 'acc-bank', amount: 3000000, date: '2026-10-06', counterparty: 'Bank', dueDate: '2026-12-31' });
            const payable = (await pool.query('SELECT payable_id FROM fin_transactions WHERE id=$1', [loan.id])).rows[0].payable_id;
            await expectError(finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'common', type: 'loan_repay', categoryCode: 'LOAN_REPAY', accountId: 'acc-bank', amount: 3500000, date: '2026-10-07', payableId: payable, counterparty: 'Bank' }), 409);
            await finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'common', type: 'loan_repay', categoryCode: 'LOAN_REPAY', accountId: 'acc-bank', amount: 1000000, date: '2026-10-07', payableId: payable, counterparty: 'Bank' });
            const o = await finance.overview(pool, accountant, { start: '2026-10-01', end: '2026-10-31', scope: 'all' });
            assert.equal(o.payables.loans, 2000000);
            assert.equal(o.cashflow.reconciled, true);
            assert.equal(o.cashflow.net.financing, 3000000 - 1000000);
            await expectError(finance.reverseTransaction(pool, accountant, loan.id, { reason: 'Qarz bekor' }), 409);
        });

        await t.test('manual correction replaces a wrong receipt atomically, with evidence', async () => {
            await expectError(finance.manualReceipt(pool, accountant, { requestKey: key(), entity: 'russian', date: '2026-09-14', amount: 1000000, method: 'card', reason: 'Audit bo‘yicha', replacesId: 'r1' }), 400, /hujjat/);
            const c = await finance.manualReceipt(pool, accountant, { requestKey: key(), entity: 'russian', date: '2026-09-14', amount: 1000000, method: 'card', reason: 'Sentyabr audit ro‘yxati №4', replacesId: 'r1', evidenceUrl: '/uploads/audit.pdf' });
            const v = (await pool.query('SELECT * FROM payment_record_voids WHERE record_id=$1', ['r1'])).rows[0];
            assert.equal(v.replaced_by, c.id);
            const rec = (await pool.query('SELECT lead_id,student_id,amount FROM payment_records WHERE id=$1', [c.id])).rows[0];
            assert.deepEqual([rec.lead_id, rec.student_id, rec.amount], ['l1', 's1', '1000000']);
            const list = await inflow.list(pool, admin, { language: 'russian' });
            assert.equal(list.records.some(r => r.id === 'r1'), false);
            assert.equal(list.records.find(r => r.id === c.id).amount, 1000000);
        });

        await t.test('voiding test receipts removes them from ledger lists, payroll sources and revenue', async () => {
            await finance.voidReceipts(pool, accountant, { recordIds: ['rt'], reason: 'Test yozuv — haqiqiy to‘lov emas' });
            await expectError(finance.voidReceipts(pool, accountant, { recordIds: ['rt'], reason: 'Takroriy bekor qilish' }), 409);
            const list = await inflow.list(pool, admin, { language: 'russian' });
            assert.equal(list.records.some(r => r.id === 'rt'), false);
            const o = await finance.overview(pool, accountant, { start: '2026-10-01', end: '2026-10-31', scope: 'russian' });
            assert.equal(o.pnl.revenue, 1800000);
            assert.equal(o.quality.voidedList.length, 2);
        });

        await t.test('salary cash-out requires a paid payroll row and is recorded once', async () => {
            await expectError(finance.recordSalaryPayment(pool, accountant, 'sal2', { accountId: 'acc-card', date: '2026-10-16' }), 409);
            const a = await finance.recordSalaryPayment(pool, accountant, 'sal1', { accountId: 'acc-card', date: '2026-10-02' });
            const b = await finance.recordSalaryPayment(pool, accountant, 'sal1', { accountId: 'acc-card', date: '2026-10-02' });
            assert.equal(a.id, b.id);
            const row = (await pool.query('SELECT category_code,amount FROM fin_transactions WHERE id=$1', [a.id])).rows[0];
            assert.deepEqual([row.category_code, row.amount], ['COS_TEACHERS', '900000']);
            const o = await finance.overview(pool, accountant, { start: '2026-09-01', end: '2026-10-31', scope: 'russian', basis: 'accrual' });
            assert.equal(o.quality.paidSalaryWithoutCash.length, 0);
            assert.equal(o.pnl.cost_of_services, 900000 + 400000); // accrual: Sept paid + Oct unpaid, each counted once
            assert.equal(o.pnlOther.cost_of_services, 900000); // cash: only the recorded cash-out
        });

        await t.test('period close is cumulative, blocks every writer, and only a director can reopen the last month', async () => {
            await expectError(finance.lockMonth(pool, accountant, { month: F.monthOf(F.today()) }), 400);
            await finance.lockMonth(pool, accountant, { month: '2026-09' });
            await expectError(finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'russian', type: 'expense', categoryCode: 'ADMIN', accountId: 'acc-cash', amount: 10000, date: '2026-09-20', counterparty: 'Ofis' }), 409, /yopilgan/);
            await expectError(finance.manualReceipt(pool, accountant, { requestKey: key(), entity: 'russian', date: '2026-08-20', amount: 10000, method: 'card', reason: 'Eski oy', name: 'X', evidenceUrl: '/uploads/audit.pdf' }), 409);
            await expectError(inflow.insert(pool, { sourceKey: 'receipt:late', amount: 100000, paidDate: '2026-09-29', method: 'card', receiptUrl: '/uploads/audit.pdf', form: 'partial' },
                { language: 'english', name: 'Late', managerId: 'm' }, { id: 'admin', name: 'Admin' }), 409, /yopilgan/);
            // Yopilgan oydagi operatsiya storno qilinsa, storno ochiq kunga tushadi va sentyabr raqamlari o'zgarmaydi.
            const sepBefore = (await finance.overview(pool, accountant, { start: '2026-09-01', end: '2026-09-30', scope: 'all' })).pnl.net_profit;
            const legacy = (await pool.query("SELECT id FROM fin_transactions WHERE category_code='MKT_ADS' AND legacy")).rows[0].id;
            const rv = await finance.reverseTransaction(pool, accountant, legacy, { reason: 'Eski test yozuvi' });
            const rvDate = (await pool.query("SELECT TO_CHAR(txn_date,'YYYY-MM-DD') AS d FROM fin_transactions WHERE id=$1", [rv.id])).rows[0].d;
            assert.equal(rvDate, F.today());
            const sepAfter = (await finance.overview(pool, accountant, { start: '2026-09-01', end: '2026-09-30', scope: 'all' })).pnl.net_profit;
            assert.equal(sepAfter, sepBefore);
            await expectError(finance.lockMonth(pool, accountant, { month: '2026-09', locked: false, note: 'Tuzatish kerak' }), 403);
            await expectError(finance.lockMonth(pool, admin, { month: '2026-08', locked: false, note: 'Tuzatish kerak' }), 409);
            await finance.lockMonth(pool, admin, { month: '2026-09', locked: false, note: 'Auditor so‘rovi bilan' });
            assert.equal((await pool.query('SELECT COUNT(*) AS n FROM fin_period_locks')).rows[0].n, '0');
        });

        await t.test('reconcile compares an external list against the ledger without writing', async () => {
            const before = (await pool.query('SELECT COUNT(*) AS n FROM fin_audit')).rows[0].n;
            const r = await finance.reconcile(pool, accountant, { entity: 'russian', start: '2026-09-01', end: '2026-10-31', rows: [
                { date: '14.09.2026', name: 'Ali', phone: '90 111 22 33', amount: 1000000 },
                { date: '01.10.2026', name: 'Vali', phone: '97 028 00 22', amount: 1800000 },
                { date: '03.10.2026', name: 'Yangi', phone: '93 000 00 01', amount: 700000 }] });
            assert.deepEqual(r.counts, { match: 2, date_diff: 0, amount_diff: 0, missing_in_crm: 1, extra_in_crm: 0 });
            assert.equal((await pool.query('SELECT COUNT(*) AS n FROM fin_audit')).rows[0].n, before);
        });

        await t.test('account opening balance and bank-balance check expose the book-vs-actual difference', async () => {
            await finance.saveAccount(pool, accountant, { id: 'acc-card', name: 'Karta', kind: 'card', entity: 'common', methods: ['card', 'payme', 'click', 'paylater'], openingBalance: 500000, openingDate: '2026-09-01' });
            await expectError(finance.saveAccount(pool, accountant, { name: 'Ikkinchi karta', kind: 'card', entity: 'common', methods: ['card'] }), 409);
            await finance.addAccountCheck(pool, accountant, 'acc-card', { date: '2026-10-07', actualBalance: 1000000, note: 'Bank ilovasi' });
            const o = await finance.overview(pool, accountant, { start: '2026-10-01', end: '2026-10-31', scope: 'all' });
            const card = o.accounts.find(a => a.id === 'acc-card');
            assert.equal(card.check.actual, 1000000);
            assert.equal(card.check.difference, 1000000 - card.check.book);
            assert.equal(o.cashflow.reconciled, true);
        });
    } finally {
        await pool.end();
    }
});
