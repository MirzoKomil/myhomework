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
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-test-'));
    fs.mkdirSync(path.join(process.env.DATA_DIR, 'uploads'));
    fs.writeFileSync(path.join(process.env.DATA_DIR, 'uploads', 'late.pdf'), 'x');
    const pool = new Pool({ connectionString: url });
    const admin = { id: 'admin' }, accountant = { id: 'acc' }, manager = { id: 'manager' };
    let seq = 0;
    const key = () => 'test-request-key-' + String(++seq).padStart(6, '0');
    const rejects = async (promise, status, re) => {
        await assert.rejects(promise, e => ((status ? e.status === status : true) && (!re || re.test(e.message))) || assert.fail(`${e.status} ${e.message}`));
    };
    const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const body = name => name.endsWith('.png') ? Buffer.concat([PNG, Buffer.from('evidence ' + name + seq++)]) : Buffer.from('%PDF-1.4\nevidence ' + name + seq++);
    const evidence = async (name = 'audit.pdf') => (await finance.storeEvidence(pool, accountant, { originalname: name, mimetype: name.endsWith('.png') ? 'image/png' : 'application/pdf', buffer: body(name) })).url;
    try {
        // Har ishga tushirishda toza baza: testni bir xil bazada qayta-qayta ishlatish mumkin.
        await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
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
        INSERT INTO leads(id,name,phone,manager_id,status,language,extra_data) VALUES('l1','Ali Valiyev','+998901112233','m','tolov-jarayonida','russian','{"paymentSurvey":{"totalAmount":2100000}}'),('l9','Yangi O‘quvchi','+998930000001','m','tolov-jarayonida','russian','{}');
        INSERT INTO students VALUES('s1','Ali Valiyev','+998901112233','russian','g',NULL,30,'{"debtAmount":1100000,"paymentDueDate":"2026-10-01","leadRef":{"id":"l1"}}');
        INSERT INTO salary_transactions VALUES('sal1','t1','russian','2026-09-01','2026-09-30',900000,'paid',NOW(),NULL),('sal2','t1','russian','2026-10-01','2026-10-15',400000,'unpaid',NULL,NULL);`);
        await inflow.initSchema(pool); await cash.initSchema(pool);
        await finance.initSchema(pool); await finance.initSchema(pool); // idempotent

        await t.test('legacy Cash Flow rows are migrated once, flagged and mapped', async () => {
            const rows = (await pool.query('SELECT type,category_code,account_id,amount,legacy FROM fin_transactions ORDER BY txn_date')).rows;
            assert.deepEqual(rows.map(r => [r.type, r.category_code, r.account_id, Number(r.amount), r.legacy]), [
                ['expense', 'MKT_ADS', 'acc-card', 300000, true], ['drawing', 'OWNER_OUT', 'acc-cash', 100000, true]]);
        });

        const insertReceipt = (id, date, amount, o = {}) => pool.query(`INSERT INTO payment_records(id,source_key,lead_id,student_id,language,manager_id,paid_date,amount,method,receipt_url,form,debt_snapshot,snapshot,legacy_review,actor_id)
            VALUES($1,$2,$3,$4,'russian','m',$5,$6,$7,'',$8,0,$9,TRUE,'system')`, [id, 'lead:' + id + ':deposit', o.lead || 'l-' + id, o.student || null, date, amount, o.method || 'card', o.form || 'partial', JSON.stringify({ name: o.name || 'Ali', phone: o.phone || '+998901112233', managerName: 'Sales' })]);
        await insertReceipt('r1', '2026-09-14', 100000, { lead: 'l1', student: 's1', name: 'Ali Valiyev' });
        await insertReceipt('r2', '2026-10-01', 1800000, { form: 'full', name: 'Vali', phone: '+998970280022' });
        await insertReceipt('rt', '2026-10-02', 500000, { name: 'test', phone: '800000000' });
        await insertReceipt('ru', '2026-10-03', 700000, { method: 'uzum', name: 'Uzumchi' });

        await t.test('receipt account is assigned at insert and then frozen in the database', async () => {
            const rows = Object.fromEntries((await pool.query('SELECT id,account_id FROM payment_records')).rows.map(r => [r.id, r.account_id]));
            assert.deepEqual([rows.r1, rows.ru], ['acc-card', 'acc-uzum']);
            await rejects(pool.query("UPDATE payment_records SET account_id='acc-cash' WHERE id='r1'"), null, /o.zgartirib bo.lmaydi/);
            await rejects(pool.query("UPDATE payment_records SET amount=1 WHERE id='r1'"), null, /o.zgartirib bo.lmaydi/);
            await rejects(pool.query("DELETE FROM payment_records WHERE id='r1'"), null, /o.chirib bo.lmaydi/);
        });

        await t.test('roles: managers have no access; only directors manage locks, settings and accounts', async () => {
            await rejects(finance.overview(pool, manager, {}), 403);
            await rejects(finance.lockMonth(pool, accountant, { month: '2026-09' }), 403);
            await rejects(finance.saveSettings(pool, accountant, { revision: 1, data: {} }), 403);
            await rejects(finance.saveAccount(pool, accountant, { name: 'X', kind: 'cash', entity: 'common' }), 403);
            const o = await finance.overview(pool, accountant, { start: '2026-09-01', end: '2026-10-31', scope: 'all' });
            assert.equal(o.cashflow.reconciled, true);
            assert.equal(o.balance.balanced, true, String(o.balance.imbalance));
            assert.equal(o.balance.uzumReceivable, 700000);
            assert.equal(o.quality.suspicious.some(r => r.name === 'test'), true);
            assert.equal(o.payables.salaries, 900000 + 400000);
            assert.equal(o.payables.unreconciledSalaries, 900000);
        });

        await t.test('evidence: authenticated store only; arbitrary /uploads files are rejected', async () => {
            await rejects(finance.storeEvidence(pool, accountant, { originalname: 'x.exe', mimetype: 'application/octet-stream', buffer: Buffer.from('x') }), 400);
            await rejects(finance.storeEvidence(pool, accountant, { originalname: 'fake.pdf', mimetype: 'application/pdf', buffer: Buffer.from('<html>not a pdf') }), 400, /mazmuni/);
            const url = await evidence('rent.png');
            const f = await finance.readEvidence(pool, accountant, url.split('/').pop());
            assert.ok(fs.existsSync(f.path) && !f.path.includes(path.sep + 'uploads' + path.sep));
            assert.equal(fs.readdirSync(path.dirname(f.path)).some(n => n.endsWith('.tmp')), false);
            // Diskda almashtirilgan fayl berilmaydi (xesh tekshiruvi).
            const tampered = await evidence('tamper.pdf'), tf = await finance.readEvidence(pool, accountant, tampered.split('/').pop());
            fs.writeFileSync(tf.path, '%PDF-1.4 boshqa fayl');
            await rejects(finance.readEvidence(pool, accountant, tampered.split('/').pop()), 409, /xesh/);
            await rejects(finance.readEvidence(pool, manager, url.split('/').pop()), 403);
            await rejects(finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'russian', type: 'expense', categoryCode: 'RENT', accountId: 'acc-card', amount: 1200000, date: '2026-10-03', counterparty: 'Ijara', receiptUrl: '/uploads/late.pdf' }), 400, /moliya bo.limi orqali/);
        });

        await t.test('expenses: category/type, payroll guard, large-amount evidence, no future date, idempotent', async () => {
            const base = { entity: 'russian', type: 'expense', categoryCode: 'RENT', accountId: 'acc-card', amount: 1200000, date: '2026-10-03', counterparty: 'Ijarachi' };
            await rejects(finance.createTransaction(pool, accountant, { ...base, requestKey: key(), categoryCode: 'OWNER_IN' }), 400, /toifa/);
            await rejects(finance.createTransaction(pool, accountant, { ...base, requestKey: key() }), 400, /yuklang/);
            await rejects(finance.createTransaction(pool, accountant, { ...base, requestKey: key(), categoryCode: 'COS_TEACHERS', amount: 50000 }), 400, /Maoshlar/);
            await rejects(finance.createTransaction(pool, accountant, { ...base, requestKey: key(), date: F.addDays(F.today(), 2), receiptUrl: await evidence() }), 400, /kelajak/);
            const k = key(), receiptUrl = await evidence('rent.png');
            const a = await finance.createTransaction(pool, accountant, { ...base, requestKey: k, receiptUrl });
            const b = await finance.createTransaction(pool, accountant, { ...base, requestKey: k, receiptUrl });
            assert.equal(a.id, b.id); assert.equal(b.duplicate, true);
            await rejects(pool.query('UPDATE fin_transactions SET amount=1 WHERE id=$1', [a.id]), null, /o.zgartirib/);
            await rejects(pool.query('DELETE FROM fin_transactions WHERE id=$1', [a.id]), null, /o.chirib/);
        });

        await t.test('refunds must be linked to a receipt, carry evidence, respect the cap and the approval limit', async () => {
            const base = { entity: 'russian', type: 'refund', categoryCode: 'REFUND', accountId: 'acc-card', date: '2026-10-04', counterparty: 'Vali' };
            await rejects(finance.createTransaction(pool, accountant, { ...base, requestKey: key(), amount: 300000, receiptUrl: await evidence() }), 400, /tushum/);
            await rejects(finance.createTransaction(pool, accountant, { ...base, requestKey: key(), amount: 300000, paymentRecordId: 'r2' }), 400, /yuklang/);
            await rejects(finance.createTransaction(pool, accountant, { ...base, requestKey: key(), amount: 1900000, paymentRecordId: 'r2', receiptUrl: await evidence(), terminates: true }), 409);
            await rejects(finance.createTransaction(pool, accountant, { ...base, requestKey: key(), amount: 300000, paymentRecordId: 'r2', receiptUrl: await evidence() }), 400, /tugatiladimi/);
            const r = await finance.createTransaction(pool, accountant, { ...base, requestKey: key(), amount: 300000, paymentRecordId: 'r2', receiptUrl: await evidence(), terminates: false });
            assert.equal((await pool.query('SELECT terminates FROM fin_transactions WHERE id=$1', [r.id])).rows[0].terminates, false);
            assert.equal((await pool.query('SELECT entity FROM fin_transactions WHERE id=$1', [r.id])).rows[0].entity, 'russian');
            await rejects(finance.voidReceipts(pool, accountant, { recordIds: ['r2'], reason: 'Dublikat yozuv', evidenceUrl: await evidence() }), 409, /qaytarish/);
        });

        await t.test('Uzum settlement: net amount to bank and commission expense in one request', async () => {
            await finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'russian', type: 'transfer', categoryCode: 'TRANSFER', accountId: 'acc-uzum', toAccountId: 'acc-bank', amount: 630000, feeAmount: 70000, date: '2026-10-06', description: 'Uzum to‘lovi' });
            const o = await finance.overview(pool, accountant, { start: '2026-10-01', end: '2026-10-31', scope: 'all' });
            assert.equal(o.balance.uzumReceivable, 0);
            assert.equal(o.pnl.payment_fees, 70000);
            assert.equal(o.cashflow.reconciled, true);
            assert.equal(o.balance.balanced, true, String(o.balance.imbalance));
        });

        await t.test('storno nets out, cannot repeat, original row untouched', async () => {
            const x = await finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'common', type: 'expense', categoryCode: 'SOFTWARE', accountId: 'acc-card', amount: 200000, date: '2026-10-05', counterparty: 'Hosting' });
            await rejects(finance.reverseTransaction(pool, accountant, x.id, { reason: 'x' }), 400, /sabab/);
            const rv = await finance.reverseTransaction(pool, accountant, x.id, { reason: 'Noto‘g‘ri kiritilgan' });
            await rejects(finance.reverseTransaction(pool, accountant, x.id, { reason: 'Yana bir bor' }), 409);
            await rejects(finance.reverseTransaction(pool, accountant, rv.id, { reason: 'Storno stornosi' }), 400);
            const o = await finance.overview(pool, accountant, { start: '2026-10-05', end: '2026-10-05', scope: 'all' });
            assert.equal(o.pnl.software || 0, 0);
        });

        await t.test('loans: payable created, repayment capped, interest is a finance cost', async () => {
            const loan = await finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'common', type: 'loan_in', categoryCode: 'LOAN_IN', accountId: 'acc-bank', amount: 3000000, date: '2026-10-06', counterparty: 'Bank', dueDate: '2026-12-31' });
            const payable = (await pool.query('SELECT payable_id FROM fin_transactions WHERE id=$1', [loan.id])).rows[0].payable_id;
            await rejects(finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'common', type: 'loan_repay', categoryCode: 'LOAN_REPAY', accountId: 'acc-bank', amount: 3500000, date: '2026-10-07', payableId: payable, counterparty: 'Bank' }), 409);
            await finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'common', type: 'loan_repay', categoryCode: 'LOAN_REPAY', accountId: 'acc-bank', amount: 1000000, date: '2026-10-07', payableId: payable, counterparty: 'Bank' });
            await finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'common', type: 'expense', categoryCode: 'INTEREST', accountId: 'acc-bank', amount: 45000, date: '2026-10-07', counterparty: 'Bank' });
            const o = await finance.overview(pool, accountant, { start: '2026-10-01', end: '2026-10-31', scope: 'all' });
            assert.equal(o.payables.loans, 2000000);
            assert.equal(o.pnl.finance_cost, 45000);
            assert.equal(o.cashflow.financing.find(l => l.key === 'interest').amount, -45000);
            assert.equal(o.balance.balanced, true, String(o.balance.imbalance));
            await rejects(finance.reverseTransaction(pool, accountant, loan.id, { reason: 'Qarz bekor' }), 409);
        });

        await t.test('people search finds students and leads for linking corrections', async () => {
            const r = await finance.people(pool, accountant, { entity: 'russian', q: 'yangi' });
            assert.equal(r.rows[0].leadId, 'l9');
            const p = await finance.people(pool, accountant, { entity: 'russian', q: '90 111 22 33' });
            assert.equal(p.rows[0].studentId, 's1');
        });

        await t.test('batch corrections are atomic: one bad row rolls back every row', async () => {
            const ev = await evidence();
            const before = (await pool.query('SELECT COUNT(*) AS n FROM payment_records')).rows[0].n;
            await rejects(finance.batchCorrections(pool, accountant, { requestKey: key(), entity: 'russian', reason: 'Sentyabr audit ro‘yxati', evidenceUrl: ev, operations: [
                { kind: 'replace', replacesId: 'r1', date: '2026-09-14', amount: 1000000 },
                { kind: 'add', date: '2026-10-03', amount: 700000, method: 'card' } // o'quvchi tanlanmagan → xato
            ] }), 400, /2-tuzatish/);
            assert.equal((await pool.query('SELECT COUNT(*) AS n FROM payment_records')).rows[0].n, before);
            assert.equal((await pool.query("SELECT COUNT(*) AS n FROM payment_record_voids WHERE record_id='r1'")).rows[0].n, '0');
            const ok = await finance.batchCorrections(pool, accountant, { requestKey: key(), entity: 'russian', reason: 'Sentyabr audit ro‘yxati', evidenceUrl: ev, operations: [
                { kind: 'replace', replacesId: 'r1', date: '2026-09-14', amount: 1000000 },
                { kind: 'add', date: '2026-10-03', amount: 700000, method: 'card', leadId: 'l9' },
                { kind: 'void', recordId: 'rt' }
            ] });
            assert.equal(ok.results.length, 3);
            const list = await inflow.list(pool, admin, { language: 'russian' });
            assert.equal(list.records.some(r => r.id === 'r1' || r.id === 'rt'), false);
            assert.equal(list.records.find(r => r.id === ok.results[0].id).amount, 1000000);
            assert.equal(list.records.find(r => r.id === ok.results[1].id).name, 'Yangi O‘quvchi');
            // O'quvchi kartasi ham tuzatiladi: +1 000 000 qo'shildi, 100 000 bekor qilindi.
            const s1 = (await pool.query("SELECT extra_data FROM students WHERE id='s1'")).rows[0].extra_data;
            assert.equal(s1.paidAmount, 900000); assert.equal(s1.debtAmount, 200000);
            await rejects(pool.query("DELETE FROM payment_record_voids WHERE record_id='rt'"), null, /o.chirib/);
        });

        await t.test('large voids, replacements, manual adds and stornos need a director (no bypass)', async () => {
            await insertReceipt('big', '2026-10-08', 7000000, { name: 'Katta Summa' });
            await rejects(finance.voidReceipts(pool, accountant, { recordIds: ['big'], reason: 'Xato kiritilgan', evidenceUrl: await evidence() }), 403);
            // "Almashtirish" orqali chetlab o'tish yo'q
            await rejects(finance.batchCorrections(pool, accountant, { requestKey: key(), entity: 'russian', reason: 'Summani tuzatish', evidenceUrl: await evidence(),
                operations: [{ kind: 'replace', replacesId: 'big', date: '2026-10-08', amount: 1 }] }), 403);
            await rejects(finance.batchCorrections(pool, accountant, { requestKey: key(), entity: 'russian', reason: 'Katta tushum qo‘shish', evidenceUrl: await evidence(),
                operations: [{ kind: 'add', date: '2026-10-08', amount: 6000000, method: 'bank', leadId: 'l9' }] }), 403);
            await finance.voidReceipts(pool, admin, { recordIds: ['big'], reason: 'Xato kiritilgan', evidenceUrl: await evidence() });
            const big = await finance.createTransaction(pool, admin, { requestKey: key(), entity: 'common', type: 'expense', categoryCode: 'RENT', accountId: 'acc-bank', amount: 6000000, date: '2026-10-08', counterparty: 'Ijara', receiptUrl: await evidence() });
            await rejects(finance.reverseTransaction(pool, accountant, big.id, { reason: 'Xato kiritilgan' }), 403);
            await finance.reverseTransaction(pool, admin, big.id, { reason: 'Xato kiritilgan' });
            // Qaytarish limiti tushum bo'yicha jami: bo'laklab chetlab o'tib bo'lmaydi
            await insertReceipt('big3', '2026-10-09', 9000000, { name: 'Uch Bo‘lak' });
            const rf = { entity: 'russian', type: 'refund', categoryCode: 'REFUND', accountId: 'acc-bank', date: '2026-10-09', counterparty: 'Uch', paymentRecordId: 'big3', terminates: false };
            await finance.createTransaction(pool, accountant, { ...rf, requestKey: key(), amount: 4000000, receiptUrl: await evidence() });
            await rejects(finance.createTransaction(pool, accountant, { ...rf, requestKey: key(), amount: 4000000, receiptUrl: await evidence() }), 403, /jami/);
        });

        await t.test('contract value is frozen in finance at the first receipt; lead edits do not rewrite history', async () => {
            const before = (await pool.query("SELECT value FROM fin_contract_values WHERE record_id='r1'")).rows[0].value;
            assert.equal(Number(before), 2100000);
            await pool.query(`UPDATE leads SET extra_data=jsonb_set(extra_data,'{paymentSurvey,totalAmount}','9000000') WHERE id='l1'`);
            assert.equal(Number((await pool.query("SELECT value FROM fin_contract_values WHERE record_id='r1'")).rows[0].value), 2100000);
            await rejects(pool.query("UPDATE fin_contract_values SET value=1 WHERE record_id='r1'"), null, /o.zgartirib/);
            await rejects(pool.query('UPDATE fin_accounts SET opening_balance=5 WHERE id=$1', ['acc-card']), null, /boshlang/);
            await rejects(pool.query('TRUNCATE fin_audit'), null, /o.zgartirib/);
        });

        await t.test('salary cash-out requires a paid payroll row, is recorded once and clears the liability', async () => {
            await rejects(finance.recordSalaryPayment(pool, accountant, 'sal2', { accountId: 'acc-card', date: '2026-10-16' }), 409);
            const a = await finance.recordSalaryPayment(pool, accountant, 'sal1', { accountId: 'acc-card', date: '2026-10-02' });
            const b = await finance.recordSalaryPayment(pool, accountant, 'sal1', { accountId: 'acc-card', date: '2026-10-02' });
            assert.equal(a.id, b.id); assert.equal(b.duplicate, true);
            const o = await finance.overview(pool, accountant, { start: '2026-09-01', end: '2026-10-31', scope: 'russian', basis: 'accrual' });
            assert.equal(o.quality.paidSalaryWithoutCash.length, 0);
            assert.equal(o.pnl.cost_of_services, 900000 + 400000);
            assert.equal(o.pnlOther.cost_of_services, 900000);
            assert.equal(o.payables.unreconciledSalaries, 0);
        });

        await t.test('month close: readiness checks, snapshot, every writer blocked (incl. direct SQL), director-only reopen', async () => {
            await rejects(finance.lockMonth(pool, admin, { month: F.monthOf(F.today()) }), 400);
            await rejects(finance.lockMonth(pool, admin, { month: '2026-09' }), 409, /haqiqiy qoldiq/);
            await finance.lockMonth(pool, admin, { month: '2026-09', override: true, note: 'Bank ko‘chirmasi hali kelmagan, rahbar qarori bilan' });
            assert.equal((await pool.query("SELECT COUNT(*) AS n FROM fin_period_snapshots WHERE month='2026-09'")).rows[0].n, '1');
            await rejects(finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'russian', type: 'expense', categoryCode: 'ADMIN', accountId: 'acc-cash', amount: 10000, date: '2026-09-20', counterparty: 'Ofis' }), 409, /yopilgan/);
            await rejects(inflow.insert(pool, { sourceKey: 'receipt:late', amount: 100000, paidDate: '2026-09-29', method: 'card', receiptUrl: '/uploads/late.pdf', form: 'partial' },
                { language: 'english', name: 'Late', managerId: 'm' }, { id: 'admin', name: 'Admin' }), 409, /yopilgan/);
            await rejects(pool.query(`INSERT INTO payment_records(id,source_key,language,paid_date,amount,method,form,snapshot,actor_id) VALUES('sql1','sql1','english','2026-09-10',1000,'card','partial','{}','x')`), null, /yopilgan davrga/);
            await rejects(finance.addAccountCheck(pool, accountant, 'acc-card', { date: '2026-09-30', actualBalance: 0 }), 409);
            // Yopilgan oydagi raqamlar storno va sozlama o'zgarishidan keyin ham o'zgarmaydi; farq oktyabrda ko'rinadi.
            const sep = async basis => (await finance.overview(pool, accountant, { start: '2026-09-01', end: '2026-09-30', scope: 'all', basis })).pnl.net_profit;
            const [cashBefore, accBefore] = [await sep('cash'), await sep('accrual')];
            const legacy = (await pool.query("SELECT id FROM fin_transactions WHERE category_code='MKT_ADS' AND legacy")).rows[0].id;
            const rv = await finance.reverseTransaction(pool, accountant, legacy, { reason: 'Eski test yozuvi' });
            assert.equal((await pool.query("SELECT TO_CHAR(txn_date,'YYYY-MM-DD') AS d FROM fin_transactions WHERE id=$1", [rv.id])).rows[0].d, F.today());
            const s = await finance.overview(pool, admin, {});
            const saved = await finance.saveSettings(pool, admin, { revision: s.settingsRevision, data: { courseMonths: { english: 3, russian: 6 } } });
            assert.equal(saved.effectiveFrom, F.today());
            // Kech aniqlangan holat: o'quvchi sentyabrda muzlatilgan edi (yopilgan oyning hisoblash usuli natijasi o'zgaradi).
            await pool.query(`UPDATE students SET extra_data=extra_data || '{"frozen":true,"frozenAt":"2026-09-20T10:00:00Z"}'::jsonb WHERE id='s1'`);
            assert.equal(await sep('cash'), cashBefore);
            assert.equal(await sep('accrual'), accBefore);
            const oct = await finance.overview(pool, accountant, { start: '2026-10-01', end: '2026-10-31', scope: 'all', basis: 'accrual' });
            assert.ok(oct.pnl.prior_adjustments !== 0);
            // Maosh jadvali ham yopilgan davrga yozilmaydi; summasi o'zgarmaydi, holati (to'landi) o'zgarishi mumkin.
            await rejects(pool.query("UPDATE salary_transactions SET amount=1 WHERE id='sal1'"), null, /yopilgan/);
            await rejects(pool.query("INSERT INTO salary_transactions VALUES('sal9','t1','russian','2026-09-01','2026-09-15',100,'unpaid',NULL,NULL)"), null, /yopilgan/);
            await pool.query("UPDATE salary_transactions SET paid_at=NOW() WHERE id='sal1'");
            // Muzlatilgan nusxa o'zgarmaydi va xeshi audit jurnalida
            await rejects(pool.query("UPDATE fin_period_snapshots SET data='{}' WHERE month='2026-09'"), null, /nusxa/);
            await rejects(pool.query("DELETE FROM fin_period_snapshots WHERE month='2026-09'"), null, /nusxa/);
            const lockAudit = (await pool.query("SELECT after_data FROM fin_audit WHERE action='period-lock' ORDER BY id DESC LIMIT 1")).rows[0].after_data;
            const row = (await pool.query("SELECT sha256 FROM fin_period_snapshots WHERE month='2026-09'")).rows[0];
            assert.equal(lockAudit.snapshotSha256['2026-09'], row.sha256);
            assert.equal(oct.balance.balanced, true, String(oct.balance.imbalance));
            await rejects(finance.lockMonth(pool, accountant, { month: '2026-09', locked: false, note: 'Tuzatish kerak' }), 403);
            await finance.lockMonth(pool, admin, { month: '2026-09', locked: false, note: 'Auditor so‘rovi bilan' });
            assert.equal((await pool.query('SELECT COUNT(*) AS n FROM fin_period_snapshots')).rows[0].n, '0');
        });

        await t.test('reconcile is read-only and does not touch the audit trail', async () => {
            const before = (await pool.query('SELECT COUNT(*) AS n FROM fin_audit')).rows[0].n;
            const r = await finance.reconcile(pool, accountant, { entity: 'russian', start: '2026-09-01', end: '2026-10-31', rows: [
                { date: '14.09.2026', name: 'Ali Valiyev', phone: '90 111 22 33', amount: 1000000 },
                { date: '01.10.2026', name: 'Vali', phone: '97 028 00 22', amount: 1800000 },
                { date: '03.10.2026', name: 'Boshqa Odam', phone: '93 111 00 01', amount: 900000 }] });
            assert.equal(r.counts.match, 2);
            assert.equal(r.counts.missing_in_crm, 1);
            assert.equal((await pool.query('SELECT COUNT(*) AS n FROM fin_audit')).rows[0].n, before);
        });

        await t.test('audit log is hash-chained and tampering is detected', async () => {
            const ok = await finance.auditLog(pool, accountant, { limit: 5 });
            assert.equal(ok.chain.ok, true);
            assert.ok(ok.chain.count > 10);
            await pool.query('ALTER TABLE fin_audit DISABLE TRIGGER fin_immutable_fin_audit');
            await pool.query("UPDATE fin_audit SET after_data=jsonb_set(after_data,'{amount}','1') WHERE id=(SELECT MIN(id) FROM fin_audit WHERE action='transaction-create')");
            await pool.query('ALTER TABLE fin_audit ENABLE TRIGGER fin_immutable_fin_audit');
            const bad = await finance.auditLog(pool, accountant, { limit: 5 });
            assert.equal(bad.chain.ok, false);
        });
    } finally {
        await pool.end();
    }
});
