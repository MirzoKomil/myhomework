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
const { execFileSync } = require('node:child_process');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url && (new URL(url).hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(new URL(url).pathname))) throw Error('Only disposable test DB allowed');

test('real PostgreSQL finance integration', { skip: !url }, async t => {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-test-'));
    fs.mkdirSync(path.join(process.env.DATA_DIR, 'uploads'));
    fs.writeFileSync(path.join(process.env.DATA_DIR, 'uploads', 'late.pdf'), 'x');
    const pool = new Pool({ connectionString: url });
    const admin = { id: 'admin' }, accountant = { id: 'acc' }, manager = { id: 'manager' }, acc2 = { id: 'acc2' }, acc3 = { id: 'acc3' };
    let seq = 0;
    const key = () => 'test-request-key-' + String(++seq).padStart(6, '0');
    const rejects = async (promise, status, re) => {
        await assert.rejects(promise, e => ((status ? e.status === status : true) && (!re || re.test(e.message))) || assert.fail(`${e.status} ${e.message}`));
    };
    const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const body = name => name.endsWith('.png') ? Buffer.concat([PNG, Buffer.from('evidence ' + name + seq++)]) : Buffer.from('%PDF-1.4\nevidence ' + name + seq++);
    // Superuser sifatida alohida sessiyada "yashirin" o'zgartirish (triggerlarni o'chirib) — buzilishni aniqlash testlari uchun.
    const accN3 = () => ({ id: 'acc3' });
    const appSql = (app, sql) => execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', `BEGIN; SELECT set_config('fin.ctx', '${require('../server/services/finCtx').token(app)}', true); ${sql}; COMMIT;`], { encoding: 'utf8' });
    const superSql = (table, sql) => execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', `ALTER TABLE ${table} DISABLE TRIGGER USER; ${sql}; ALTER TABLE ${table} ENABLE TRIGGER USER;`], { encoding: 'utf8' });
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
        INSERT INTO users VALUES('admin','Admin','admin','admin',''),('acc','Buxgalter','acc','accountant',''),('acc2','Buxgalter 2','acc2','accountant',''),('acc3','Buxgalter 3','acc3','accountant',''),('manager','Sales','sales','sales_manager','');
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

        // Tushumlar CRM (inflow) tranzaksiyasi nomidan yoziladi — ilova belgisi bilan (oddiy SQL kiritish buzilish hisoblanadi).
        const lit = v => v == null ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";
        const insertReceipt = async (id, date, amount, o = {}) => appSql('inflow', `INSERT INTO payment_records(id,source_key,lead_id,student_id,language,manager_id,paid_date,amount,method,receipt_url,form,debt_snapshot,snapshot,legacy_review,actor_id)
            VALUES(${lit(id)},${lit('lead:' + id + ':deposit')},${lit(o.lead || 'l-' + id)},${lit(o.student || null)},'russian','m',${lit(date)},${Number(amount)},${lit(o.method || 'card')},'',${lit(o.form || 'partial')},0,${lit(JSON.stringify({ name: o.name || 'Ali', phone: o.phone || '+998901112233', managerName: 'Sales' }))},TRUE,'system')`);
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
            await rejects(finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'common', type: 'loan_repay', categoryCode: 'LOAN_REPAY', accountId: 'acc-bank', amount: 3500000, date: '2026-10-07', payableId: payable, counterparty: 'Bank', receiptUrl: await evidence() }), 409);
            await finance.createTransaction(pool, accountant, { requestKey: key(), entity: 'common', type: 'loan_repay', categoryCode: 'LOAN_REPAY', accountId: 'acc-bank', amount: 1000000, date: '2026-10-07', payableId: payable, counterparty: 'Bank', receiptUrl: await evidence() });
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
            await insertReceipt('big3', '2026-10-09', 9000000, { name: 'Uch Bo‘lak', method: 'bank' });
            await insertReceipt('big4', '2026-10-09', 9000000, { name: 'Uch Bo‘lak', method: 'bank', lead: 'l-big3' });
            const rf = { entity: 'russian', type: 'refund', categoryCode: 'REFUND', accountId: 'acc-bank', date: '2026-10-09', counterparty: 'Uch', paymentRecordId: 'big3', terminates: false };
            await finance.createTransaction(pool, acc2, { ...rf, requestKey: key(), amount: 4000000, receiptUrl: await evidence() });
            await rejects(finance.createTransaction(pool, acc2, { ...rf, requestKey: key(), amount: 4000000, receiptUrl: await evidence() }), 403, /jami/);
            // Shu o'quvchining boshqa tushumi orqali ham chetlab o'tib bo'lmaydi
            await rejects(finance.createTransaction(pool, acc3, { ...rf, paymentRecordId: 'big4', requestKey: key(), amount: 2000000, receiptUrl: await evidence() }), 403, /o.quvchi/);
            // Kunlik jami: boshqa o'quvchiga kichik qaytarish ham bugungi chegarani oshirsa — rahbar
            await rejects(finance.createTransaction(pool, acc2, { ...rf, paymentRecordId: 'r2', requestKey: key(), amount: 1500000, receiptUrl: await evidence() }), 403, /kunlik/);
            // To'plam jami: 3 × 2 mln qo'shish (har biri limitdan kichik) — rahbar
            await rejects(finance.batchCorrections(pool, acc3, { requestKey: key(), entity: 'russian', reason: 'Uchta tushum qo‘shish', evidenceUrl: await evidence(),
                operations: [1, 2, 3].map(() => ({ kind: 'add', date: '2026-10-09', amount: 2000000, method: 'bank', leadId: 'l9' })) }), 403, /jami/);
            // Katta chiqim, qarz olish, o'tkazma — rahbar; qoldiq manfiyga tushmaydi
            const ex = { entity: 'common', type: 'expense', categoryCode: 'RENT', accountId: 'acc-cash', date: '2026-10-09', counterparty: 'Ijara' };
            await rejects(finance.createTransaction(pool, acc3, { ...ex, requestKey: key(), amount: 6000000, receiptUrl: await evidence() }), 403, /rahbar/);
            await rejects(finance.createTransaction(pool, acc3, { ...ex, requestKey: key(), amount: 4900000, receiptUrl: await evidence() }), 403, /manfiy/);
            // Hujjat qayta ishlatilmaydi; so'rov identifikatori boshqa ma'lumot bilan — rad
            const once = await evidence();
            await finance.createTransaction(pool, admin, { ...rf, paymentRecordId: 'r2', requestKey: key(), amount: 100000, receiptUrl: once });
            await rejects(finance.createTransaction(pool, admin, { ...rf, paymentRecordId: 'r2', requestKey: key(), amount: 100000, receiptUrl: once }), 409, /hujjat/);
            const k2 = key(), small = { ...ex, accountId: 'acc-bank', amount: 100000, requestKey: k2 };
            await finance.createTransaction(pool, admin, small);
            await rejects(finance.createTransaction(pool, admin, { ...small, amount: 900000 }), 409, /identifikatori/);
            // Uzum to'lovi maktabsiz kiritilmaydi
            await rejects(finance.createTransaction(pool, admin, { requestKey: key(), entity: 'common', type: 'transfer', categoryCode: 'TRANSFER', accountId: 'acc-uzum', toAccountId: 'acc-bank', amount: 1000, date: '2026-10-09' }), 400, /maktab/);
        });

        await t.test('a reversed loan keeps the liability until the reversal date; a voided bill reverses on its void date', async () => {
            const loan = await finance.createTransaction(pool, admin, { requestKey: key(), entity: 'common', type: 'loan_in', categoryCode: 'LOAN_IN', accountId: 'acc-bank', amount: 2000000, date: '2026-10-11', counterparty: 'Do‘st' });
            await finance.reverseTransaction(pool, admin, loan.id, { reason: 'Qarz qaytarib berildi', date: '2026-10-13' });
            for (const day of ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-20']) {
                const o = await finance.overview(pool, admin, { start: '2026-10-01', end: day, scope: 'all' });
                assert.equal(o.balance.balanced, true, day + ' ' + o.balance.imbalance);
            }
            const bill = await finance.createPayable(pool, accountant, { requestKey: key(), kind: 'bill', entity: 'common', counterparty: 'Reklama', categoryCode: 'MKT_OTHER', amount: 300000, issueDate: '2026-10-02' });
            await finance.voidPayable(pool, accountant, bill.id, { reason: 'Xizmat ko‘rsatilmadi', date: '2026-10-15' });
            const early = await finance.overview(pool, admin, { start: '2026-10-01', end: '2026-10-14', scope: 'all', basis: 'accrual' });
            assert.equal(early.payables.rows.some(r => r.id === bill.id), true);
            const late = await finance.overview(pool, admin, { start: '2026-10-15', end: '2026-10-20', scope: 'all', basis: 'accrual' });
            assert.equal(late.balance.balanced, true);
        });

        await t.test('fixed assets: sale with gain/loss, write-off and impairment (director); prepaid rent spreads over its period', async () => {
            const cap = await finance.createTransaction(pool, admin, { requestKey: key(), entity: 'common', type: 'expense', categoryCode: 'CAPEX', accountId: 'acc-bank', amount: 3600000, date: '2026-10-01', counterparty: 'Proyektor', usefulLifeMonths: 36, receiptUrl: await evidence() });
            await rejects(finance.impairAsset(pool, accountant, cap.id, { date: '2026-10-10', amount: 100000, reason: 'Shikastlandi, baholandi' }), 403);
            await finance.impairAsset(pool, admin, cap.id, { date: '2026-10-10', amount: 500000, reason: 'Shikastlandi, mustaqil baholash', evidenceUrl: await evidence() });
            await finance.disposeAsset(pool, admin, cap.id, { date: '2026-10-20', proceeds: 2000000, accountId: 'acc-bank', reason: 'Sotildi', evidenceUrl: await evidence() });
            await rejects(finance.disposeAsset(pool, admin, cap.id, { date: '2026-10-21', reason: 'Yana sotish' }), 409);
            await rejects(finance.reverseTransaction(pool, admin, cap.id, { reason: 'Xaridni bekor qilish' }), 409);
            const o = await finance.overview(pool, admin, { start: '2026-10-01', end: '2026-10-25', scope: 'all', basis: 'accrual' });
            const a = o.assets.find(x => x.transactionId === cap.id);
            assert.equal(a.nbv, 0); assert.equal(a.disposalKind, 'sale');
            assert.ok(o.pnl.asset_result < 0); // qadrsizlanish + sotishdagi zarar
            assert.equal(o.balance.ppeNet, 0);
            assert.equal(o.cashflow.investing.find(l => l.key === 'asset_sale').amount, 2000000);
            assert.equal(o.balance.balanced, true, String(o.balance.imbalance));
            const rentBefore = (await finance.overview(pool, admin, { start: '2026-10-01', end: '2026-10-31', scope: 'all', basis: 'accrual' })).pnl.rent || 0;
            const rent = await finance.createTransaction(pool, admin, { requestKey: key(), entity: 'common', type: 'expense', categoryCode: 'RENT', accountId: 'acc-bank', amount: 1200000, date: '2026-10-01', counterparty: 'Ijara (yillik)', serviceStart: '2026-10-01', serviceEnd: '2027-09-30', receiptUrl: await evidence() });
            const oct = await finance.overview(pool, admin, { start: '2026-10-01', end: '2026-10-31', scope: 'all', basis: 'accrual' });
            assert.equal(oct.pnl.rent - rentBefore, Math.round(1200000 * 31 / 365)); // faqat oktyabr ulushi
            assert.ok(oct.balance.prepaidExpenses > 1000000);
            assert.equal(oct.balance.balanced, true, String(oct.balance.imbalance));
            await finance.reverseTransaction(pool, admin, rent.id, { reason: 'Shartnoma bekor qilindi', date: '2026-10-20' });
            const after = await finance.overview(pool, admin, { start: '2026-10-01', end: '2026-10-31', scope: 'all', basis: 'accrual' });
            assert.equal(after.balance.prepaidExpenses, 0); assert.equal(after.balance.balanced, true);
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
            // CRM ilovasi orqali (crm: belgisi bilan); orqaga sanalangan muzlatish jurnal sanasidan kuchga kiradi va tekshiruvga chiqadi.
            appSql('crm', `UPDATE students SET extra_data=extra_data || '{"frozen":true,"frozenAt":"2026-09-20T10:00:00Z"}'::jsonb WHERE id='s1'`);
            assert.equal(await sep('cash'), cashBefore);
            assert.equal(await sep('accrual'), accBefore);
            const oct = await finance.overview(pool, accountant, { start: '2026-10-01', end: '2026-10-31', scope: 'all', basis: 'accrual' });
            assert.ok(oct.backdatedStatus.some(b => b.studentId === 's1' && b.claimed === '2026-09-20' && b.recorded === F.today()), 'orqaga sanalash aniqlandi');
            assert.equal(oct.pnl.prior_adjustments || 0, 0, 'orqaga sanalangan muzlatish yopilgan oyni o‘zgartirmaydi');
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
            // Nusxani bazada yashirincha o'zgartirish: hisobotda ishlatilmaydi, ogohlantiriladi, oy yopish bloklanadi
            const original = (await pool.query("SELECT data::text AS d FROM fin_period_snapshots WHERE month='2026-09'")).rows[0].d;
            superSql('fin_period_snapshots', `UPDATE fin_period_snapshots SET data=jsonb_set(data,'{pnl,all,accrual,revenue}','123456789') WHERE month='2026-09'`);
            const tampered = await finance.overview(pool, admin, { start: '2026-09-01', end: '2026-09-30', scope: 'all', basis: 'accrual' });
            assert.notEqual(tampered.pnl.revenue, 123456789);
            assert.equal(tampered.pnl.usedSnapshot, false);
            assert.deepEqual(tampered.seals.badSnapshots, ['2026-09']);
            await rejects(finance.lockMonth(pool, admin, { month: '2026-10', override: true, note: 'Buzilgan nusxa bilan yopishga urinish' }), null, /yaxlitligi|tugagan/);
            superSql('fin_period_snapshots', `UPDATE fin_period_snapshots SET data='${original.replace(/'/g, "''")}'::jsonb WHERE month='2026-09'`);
            assert.deepEqual((await finance.overview(pool, admin, {})).seals.badSnapshots, []);
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

        await t.test('round 4: batch resend must match, split expenses hit the daily limit, salary/clearing controls', async () => {
            const k = key(), ev = await evidence();
            await finance.batchCorrections(pool, acc3, { requestKey: k, entity: 'russian', reason: 'Bitta tuzatish', evidenceUrl: ev, operations: [{ kind: 'add', date: '2026-10-09', amount: 100000, method: 'bank', leadId: 'l9' }] });
            await rejects(finance.batchCorrections(pool, acc3, { requestKey: k, entity: 'russian', reason: 'Bitta tuzatish', evidenceUrl: ev, operations: [{ kind: 'add', date: '2026-10-09', amount: 100000, method: 'bank', leadId: 'l9' }, { kind: 'void', recordId: 'r2' }] }), 409, /boshqa tuzatishlar/);
            const same = await finance.batchCorrections(pool, acc3, { requestKey: k, entity: 'russian', reason: 'Bitta tuzatish', evidenceUrl: ev, operations: [{ kind: 'add', date: '2026-10-09', amount: 100000, method: 'bank', leadId: 'l9' }] });
            assert.equal(same.results[0].duplicate, true);
            // Bo'lib kiritilgan katta xarajat: kunlik chiqim chegarasi (standart 3 × limit)
            const accN = { id: 'accN' };
            await pool.query("INSERT INTO users VALUES('accN','Buxgalter N','accN','accountant','') ON CONFLICT DO NOTHING");
            await finance.createTransaction(pool, admin, { requestKey: key(), entity: 'common', type: 'capital', categoryCode: 'OWNER_IN', accountId: 'acc-bank', amount: 50000000, date: '2026-10-09', counterparty: 'Ta’sischi' });
            const ex = { entity: 'common', type: 'expense', categoryCode: 'ADMIN', accountId: 'acc-bank', date: '2026-10-09', counterparty: 'Bir xil yetkazuvchi', amount: 4900000 };
            for (let i = 0; i < 3; i++) await finance.createTransaction(pool, accN, { ...ex, requestKey: key(), receiptUrl: await evidence() });
            await rejects(finance.createTransaction(pool, accN, { ...ex, requestKey: key(), receiptUrl: await evidence() }), 403, /kunlik/);
            // Bitta hujjat bilan ikkinchi xarajat — rad
            const doc = await evidence();
            await finance.createTransaction(pool, admin, { ...ex, amount: 1000000, requestKey: key(), receiptUrl: doc });
            await rejects(finance.createTransaction(pool, admin, { ...ex, amount: 1000000, requestKey: key(), receiptUrl: doc }), 409, /hujjat/);
            // Qaytarish Uzum kliring hisobidan emas
            await rejects(finance.createTransaction(pool, admin, { requestKey: key(), entity: 'russian', type: 'refund', categoryCode: 'REFUND', accountId: 'acc-uzum', amount: 1000, date: '2026-10-09', counterparty: 'U', paymentRecordId: 'ru', terminates: false, receiptUrl: await evidence() }), 400, /Uzum/);
            // Katta maosh to'lovi — rahbar; qoldiqdan katta — rad
            // Maosh bo'limi (payroll) tranzaksiyasi nomidan kiritiladi — ilova belgisi bilan
            appSql('payroll', "INSERT INTO salary_transactions VALUES('salBig','t1','russian','2026-10-01','2026-10-15',60000000,'paid',NOW(),NULL)");
            await rejects(finance.recordSalaryPayment(pool, accountant, 'salBig', { accountId: 'acc-cash', date: '2026-10-16' }), 403, /rahbar/);
        });

        await t.test('row seals cover opening balances, contract values, settings, locks and snapshots', async () => {
            assert.equal((await finance.verifySeals(pool)).ok, true);
            // Har bir jadvalda: yashirin o'zgartirish aniqlanadi, asl qiymat qaytarilgach zanjir yana butun.
            const tamper = async (table, bad, restore) => {
                superSql(table, bad);
                const v = await finance.verifySeals(pool); assert.equal(v.ok, false, table); assert.equal(v.table, table);
                superSql(table, restore);
                assert.equal((await finance.verifySeals(pool)).ok, true, table + ' restored');
            };
            await tamper('fin_accounts', "UPDATE fin_accounts SET opening_balance=opening_balance+7000000 WHERE id='acc-cash'", "UPDATE fin_accounts SET opening_balance=opening_balance-7000000 WHERE id='acc-cash'");
            const cv = (await pool.query("SELECT value FROM fin_contract_values WHERE record_id='r1'")).rows[0].value;
            await tamper('fin_contract_values', "UPDATE fin_contract_values SET value=99000000 WHERE record_id='r1'", `UPDATE fin_contract_values SET value=${cv} WHERE record_id='r1'`);
            const sh = (await pool.query('SELECT id,data::text AS d FROM fin_settings_history ORDER BY id LIMIT 1')).rows[0];
            await tamper('fin_settings_history', `UPDATE fin_settings_history SET data=jsonb_set(data,'{courseMonths,russian}','1') WHERE id=${sh.id}`, `UPDATE fin_settings_history SET data='${sh.d.replace(/'/g, "''")}'::jsonb WHERE id=${sh.id}`);
            await tamper('salary_transactions', "UPDATE salary_transactions SET amount=1 WHERE id='sal1'", "UPDATE salary_transactions SET amount=900000 WHERE id='sal1'");
            // Qulfni yashirincha o'chirish (davrni "ochish") ham aniqlanadi
            await finance.lockMonth(pool, admin, { month: '2026-08', override: true, note: 'Test: avgust yopildi, keyin yashirin o‘chirish' }).catch(() => {});
            if ((await pool.query("SELECT 1 FROM fin_period_locks WHERE month='2026-08'")).rows.length) {
                const lk = (await pool.query("SELECT * FROM fin_period_locks WHERE month='2026-08'")).rows[0];
                superSql('fin_period_locks', "DELETE FROM fin_period_locks WHERE month='2026-08'");
                const v = await finance.verifySeals(pool); assert.equal(v.ok, false); assert.equal(v.table, 'fin_period_locks');
                superSql('fin_period_locks', `INSERT INTO fin_period_locks(month,locked_by,locked_by_name,note,locked_at) VALUES('2026-08','${lk.locked_by}','${lk.locked_by_name}','${lk.note.replace(/'/g, "''")}',NOW())`);
                assert.equal((await finance.verifySeals(pool)).ok, true);
            }
        });

        await t.test('round 5: number-driving columns are sealed; clearing, reversal, void and bill controls; student log', async () => {
            // To'lanmagan hisob-faktura voided_at orqali "yashirincha bekor" qilinmaydi: holat void_date'dan, voided_at esa ta'sir qilmaydi
            const bill = await finance.createPayable(pool, admin, { requestKey: key(), kind: 'bill', entity: 'common', counterparty: 'Ijara', categoryCode: 'RENT', amount: 4000000, issueDate: '2026-10-03', documentUrl: await evidence() });
            const before = (await finance.overview(pool, admin, { start: '2026-10-01', end: '2026-10-31', scope: 'all', basis: 'accrual' })).payables.total;
            superSql('fin_payables', `UPDATE fin_payables SET voided_at=NOW() WHERE id='${bill.id}'`);
            assert.equal((await finance.overview(pool, admin, { start: '2026-10-01', end: '2026-10-31', scope: 'all', basis: 'accrual' })).payables.total, before);
            superSql('fin_payables', `UPDATE fin_payables SET void_date='2026-10-04' WHERE id='${bill.id}'`);
            const o = await finance.overview(pool, admin, {});
            assert.equal(o.seals.ok, false); assert.equal(o.seals.table, 'fin_payables');
            superSql('fin_payables', `UPDATE fin_payables SET void_date=NULL, voided_at=NULL WHERE id='${bill.id}'`);
            assert.equal((await finance.overview(pool, admin, {})).seals.ok, true);
            // student_id ham muhrlangan
            superSql('payment_records', "UPDATE payment_records SET student_id='hacked' WHERE id='r2'");
            assert.equal((await finance.overview(pool, admin, {})).seals.ok, false);
            superSql('payment_records', "UPDATE payment_records SET student_id=NULL WHERE id='r2'");
            assert.equal((await finance.overview(pool, admin, {})).seals.ok, true);
            // Kliring hisobiga o'tkazma yo'q, Uzum qarzidan ortiq hisob-kitob yo'q
            await rejects(finance.createTransaction(pool, admin, { requestKey: key(), entity: 'russian', type: 'transfer', categoryCode: 'TRANSFER', accountId: 'acc-bank', toAccountId: 'acc-uzum', amount: 5000000, date: '2026-10-10' }), 400, /kliring/);
            await rejects(finance.createTransaction(pool, admin, { requestKey: key(), entity: 'russian', type: 'transfer', categoryCode: 'TRANSFER', accountId: 'acc-uzum', toAccountId: 'acc-bank', amount: 4000000, date: '2026-10-10' }), 409, /qarzdor/);
            // Katta hisob-faktura — rahbar; 1 mln dan katta — hujjat bilan
            await rejects(finance.createPayable(pool, accountant, { requestKey: key(), kind: 'bill', entity: 'common', counterparty: 'X', categoryCode: 'RENT', amount: 90000000, issueDate: '2026-10-03' }), 403);
            await rejects(finance.createPayable(pool, accountant, { requestKey: key(), kind: 'bill', entity: 'common', counterparty: 'X', categoryCode: 'RENT', amount: 2000000, issueDate: '2026-10-03' }), 400, /hujjat/i);
            // Tushumni bekor qilish qoldiqni manfiyga tushirsa — rahbar
            await insertReceipt('cashR', '2026-10-10', 4000000, { method: 'cash', name: 'Naqd O‘quvchi' });
            await finance.createTransaction(pool, admin, { requestKey: key(), entity: 'common', type: 'expense', categoryCode: 'ADMIN', accountId: 'acc-cash', amount: 3900000, date: '2026-10-10', counterparty: 'Ofis', receiptUrl: await evidence() });
            await rejects(finance.voidReceipts(pool, accN3(), { recordIds: ['cashR'], reason: 'Xato kiritilgan', evidenceUrl: await evidence() }), 403, /manfiy/);
            // O'quvchi holati o'zgarishi jurnalga yoziladi
            appSql('crm', `UPDATE students SET extra_data=extra_data || '{"status":"inactive"}'::jsonb WHERE id='s1'`);
            const log = (await pool.query("SELECT state FROM fin_student_log WHERE student_id='s1' ORDER BY id DESC LIMIT 1")).rows[0];
            assert.equal(log.state.status, 'inactive');
            await rejects(pool.query("UPDATE fin_student_log SET state='{}' WHERE student_id='s1'"), null, /o.zgartirib/);
        });

        await t.test('round 6: ordinary SQL changes (triggers on) are detected; lock rows cannot be deleted; limits come from sealed history', async () => {
            const plainSql = sql => execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], { encoding: 'utf8' });
            assert.equal((await finance.verifySeals(pool)).ok, true);
            // Yopilgan oy qulfini oddiy SQL bilan o'chirib bo'lmaydi
            await finance.lockMonth(pool, admin, { month: '2026-08', override: true, note: 'Test: avgust yopildi (6-bosqich)' }).catch(() => {});
            if ((await pool.query("SELECT 1 FROM fin_period_locks WHERE month='2026-08'")).rows.length)
                assert.throws(() => plainSql("DELETE FROM fin_period_locks WHERE month='2026-08'"), /faqat moliya/);
            // Sozlamadagi limitni oddiy SQL bilan o'chirish: aniqlanadi va amaldagi limitga ta'sir qilmaydi
            plainSql(`UPDATE fin_settings SET data=jsonb_set(data,'{approvalLimit}','999999999999') WHERE id='main'`);
            const v1 = await finance.verifySeals(pool);
            assert.equal(v1.ok, false); assert.equal(v1.table, 'fin_settings');
            await rejects(finance.createTransaction(pool, { id: 'acc3' }, { requestKey: key(), entity: 'common', type: 'expense', categoryCode: 'RENT', accountId: 'acc-bank', amount: 6000000, date: '2026-10-10', counterparty: 'X', receiptUrl: await evidence() }), 403);
            // Xizmat davri asosiy vosita uchun rad etiladi
            await rejects(finance.createTransaction(pool, admin, { requestKey: key(), entity: 'common', type: 'expense', categoryCode: 'CAPEX', accountId: 'acc-bank', amount: 1000000, date: '2026-10-10', counterparty: 'X', usefulLifeMonths: 12, serviceStart: '2026-10-10', serviceEnd: '2027-10-09', receiptUrl: await evidence() }), 400, /operatsion/);
        });

        await t.test('round 7: plain-SQL receipt, forged freeze log and lock bypass are detected', async () => {
            const plainSql = sql => execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], { encoding: 'utf8' });
            const freshCheck = async (sql, table) => { plainSql(sql); const v = await finance.verifySeals(pool); assert.equal(v.ok, false); return v; };
            // Bu bazada avvalgi testlar allaqachon buzilish qoldirgan; har bir tekshiruv alohida funksiya bilan
            const ghost = `INSERT INTO payment_records(id,source_key,language,paid_date,amount,method,form,snapshot,actor_id) VALUES('ghost','ghost','russian','2026-10-20',5000000,'uzum','full','{}','x')`;
            plainSql(ghost);
            const seals = await pool.query("SELECT ctx FROM fin_row_seals WHERE table_name='payment_records' AND row_id='ghost'");
            assert.equal(seals.rows[0].ctx, null);
            await freshCheck(`INSERT INTO fin_student_log(student_id,state) VALUES('s1','{"frozen":true,"frozenAt":"2026-10-01"}')`);
        });

        await t.test('row seals detect edits and unsealed inserts made with triggers disabled', async () => {
            superSql('fin_transactions', "UPDATE fin_transactions SET amount=amount+1 WHERE id=(SELECT id FROM fin_transactions ORDER BY created_at LIMIT 1)");
            const v = await finance.verifySeals(pool);
            assert.equal(v.ok, false);
            await rejects(finance.lockMonth(pool, admin, { month: '2026-09', override: true, note: 'Yaxlitlik buzilgan holda yopishga urinish' }), 409, /yaxlitligi/);
        });
    } finally {
        await pool.end();
    }
});
