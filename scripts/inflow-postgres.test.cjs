const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Pool } = require('pg');
const service = require('../server/services/inflow');
const cash = require('../server/services/paymentCash');
const history = require('../server/services/paymentHistory');
const payroll = require('../server/services/payroll');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url && (new URL(url).hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(new URL(url).pathname))) throw Error('Only disposable test DB allowed');
test('real PostgreSQL inflow integration', { skip: !url }, async t => {
    const oldDir = process.env.DATA_DIR;
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'inflow-test-uploads-'));
    fs.mkdirSync(path.join(process.env.DATA_DIR, 'uploads'));
    for (const name of ['test.pdf', 'check.png', 'close.pdf']) fs.writeFileSync(path.join(process.env.DATA_DIR, 'uploads', name), 'Disposable test evidence');
    const pool = new Pool({ connectionString: url }), admin = { id: 'admin' }, manager = { id: 'manager' };
    const receipt = (key, overrides = {}) => ({ studentId: 's', requestKey: key.padEnd(20, '0'), amount: 1400000, expectedDebt: 1400000,
        paidDate: '2026-10-04', paidTime: '12:00', method: 'card', receiptUrl: '/uploads/test.pdf', ...overrides });
    const lead = { id: 'l', name: 'Student', phone: '+998901234567', managerId: 'm', language: 'english', status: 'tolov-jarayonida',
        paymentSurvey: { paymentType: 'partial', paidAmount: 600000, debtAmount: 1400000, totalAmount: 2000000, tariff: '30', lastPaymentDate: '2026-09-30', nextPaymentDate: '2026-10-04' } };
    try {
        await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,avatar TEXT);
        CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,role TEXT,lang TEXT,login TEXT,department TEXT,status TEXT,start_date TEXT,join_date TEXT);
        CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
        CREATE TABLE teachers(id TEXT PRIMARY KEY,name TEXT,schedule_pattern TEXT,lesson_duration INTEGER);
        CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,group_name TEXT,teacher_id TEXT,assistant_teacher_id TEXT,lesson_duration INTEGER,extra_data JSONB);
        CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,manager_id TEXT,status TEXT,language TEXT,deleted_at TIMESTAMPTZ,extra_data JSONB,comments TEXT DEFAULT '[]',updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE payments(id TEXT PRIMARY KEY,student_id TEXT,paid INTEGER,debt INTEGER,date TEXT);
        CREATE TABLE main_attendance(att_key TEXT,student_id TEXT,day INTEGER,present INTEGER); CREATE TABLE assistant_attendance(LIKE main_attendance);
        CREATE TABLE json_data(key TEXT PRIMARY KEY,data JSONB);
        INSERT INTO users VALUES('admin','Admin','admin','admin',''),('manager','Sales','sales','sales_manager',''),('other','Other','other','sales_manager',''),('teacher','Teacher','teacher','teacher','');
        INSERT INTO hr_employees(id,name,role,lang,login,status,start_date) VALUES('m','Sales','sotuv-menejeri','english','sales','active','2026-09-01'),('m2','Other','sotuv-menejeri','russian','other','active','2026-09-01');
        INSERT INTO user_sales_manager_links VALUES('manager','m'),('other','m2'); INSERT INTO teachers VALUES('t','Teacher','mwf',30);`);
        await service.initSchema(pool); await cash.initSchema(pool); await payroll.initSchema(pool);
        const reset = async () => {
            await pool.query('TRUNCATE payment_cash_decisions,payment_records,payment_audit,payment_migration_issues,payment_migrations,leads,students,payments,salary_adjustment_applications,salary_adjustments,salary_transactions,salary_audit,salary_plan_confirmations');
            await pool.query("DELETE FROM json_data WHERE key='cashFlow'");
            await pool.query(`INSERT INTO leads(id,name,phone,manager_id,status,language,extra_data) VALUES('l','Student','+998901234567','m','tolov-jarayonida','english',$1)`, [JSON.stringify({ paymentSurvey: lead.paymentSurvey })]);
            await pool.query(`INSERT INTO students VALUES('s','Student','+998901234567','english','G','t',NULL,30,$1)`, [JSON.stringify({ managerId: 'm', leadRef: { id: 'l', lang: 'english' }, paidAmount: 600000, debtAmount: 1400000, paymentCount: 1, frozen: true, status: 'paused', passwordHash: 'never-return' })]);
        };
        const migrate = () => service.transaction(pool, service.migrate);
        await t.test('schema is repeatable and migration preserves exact receipts; unknown method/receipt is marked', async () => {
            await reset(); await service.initSchema(pool); const first = await migrate(); assert.equal(first.records, 1);
            assert.equal((await migrate()).skipped, true);
            const out = await service.transaction(pool, db => service.list(db, admin, { language: 'english' }));
            assert.equal(out.records[0].amount, 600000); assert.equal(out.records[0].paidDate, '2026-09-30'); assert.equal(out.records[0].legacyReview, true);
            assert.equal(out.summary.debt, 1400000);
        });
        await t.test('debt acceptance creates second receipt, activates academic access and is retry-safe', async () => {
            await reset(); await migrate();
            const out = await service.receive(pool, manager, receipt('debt'));
            assert.equal(out.student.paidAmount, 2000000); assert.equal(out.student.debtAmount, 0); assert.equal(out.student.frozen, false); assert.equal(out.student.status, 'active'); assert.equal('passwordHash' in out.student, false);
            assert.equal((await service.receive(pool, manager, receipt('debt'))).duplicate, true);
            const list = await service.transaction(pool, db => service.list(db, admin, { language: 'english' }));
            assert.equal(list.records.length, 2); assert.equal(list.summary.amount, 2000000); assert.equal(list.summary.debt, 0);
            assert.equal((await pool.query('SELECT COUNT(*) AS n FROM payment_audit')).rows[0].n, '2');
            const comments = JSON.parse((await pool.query("SELECT comments FROM leads WHERE id='l'")).rows[0].comments);
            assert.equal(comments[0].author, 'Sales'); assert.equal(comments.length, 1);
            const october = await payroll.preview(pool, admin, { language: 'english', start: '2026-10-01', end: '2026-10-31' });
            assert.equal(october.turnover, 1400000); assert.equal(october.rows.find(r => r.employeeId === 'm').commission, 70000);
        });
        await t.test('permissions use persisted role, manager link and language, not spoofed JWT/body', async () => {
            await reset(); await migrate();
            await assert.rejects(service.receive(pool, { id: 'other', role: 'admin' }, receipt('wrong-owner')), { status: 403 });
            await assert.rejects(service.receive(pool, { id: 'teacher', role: 'admin' }, receipt('wrong-role')), { status: 403 });
            await assert.rejects(service.transaction(pool, db => service.list(db, manager, { language: 'english' })), { status: 403 });
            const out = await service.receive(pool, manager, receipt('owner', { managerId: 'm2', language: 'russian' }));
            const row = (await pool.query('SELECT manager_id,language FROM payment_records WHERE id=$1', [out.id])).rows[0];
            assert.equal(row.manager_id, 'm'); assert.equal(row.language, 'english');
        });
        await t.test('stale balance, overpayment, invalid proof/date and idempotency collision are rejected atomically', async () => {
            await reset(); await migrate();
            for (const overrides of [{ expectedDebt: 1 }, { amount: 1400001 }, { amount: -1 }, { paidDate: '2026-02-30' }, { paidDate: '2099-01-01' }, { receiptUrl: 'https://evil/x.pdf' }, { method: 'unknown' }])
                await assert.rejects(service.receive(pool, manager, receipt('invalid', overrides)));
            assert.equal((await pool.query('SELECT COUNT(*) AS n FROM payment_records')).rows[0].n, '1');
            await service.receive(pool, manager, receipt('same'));
            await assert.rejects(service.receive(pool, manager, receipt('same', { amount: 500 })), { status: 409 });
        });
        await t.test('concurrent retries are one receipt; different competing payments cannot overpay', async () => {
            await reset(); await migrate(); const input = receipt('parallel');
            const result = await Promise.all([service.receive(pool, manager, input), service.receive(pool, manager, input)]);
            assert.equal(result.filter(r => !r.duplicate).length, 1);
            await reset(); await migrate();
            const outcomes = await Promise.allSettled([service.receive(pool, manager, receipt('first')), service.receive(pool, manager, receipt('second'))]);
            assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
            assert.equal((await pool.query('SELECT COUNT(*) AS n FROM payment_records')).rows[0].n, '2');
        });
        await t.test('closing after a debtor receipt does not re-record cumulative money, edits of recorded deposit are rejected', async () => {
            await reset(); await migrate(); const received = await service.receive(pool, manager, receipt('closing'));
            const closed = { ...lead, status: 'tolov-yopildi', paymentClosedSurvey: { actualAmount: 2000000, closedDate: '2026-10-04', noDebtConfirmed: true } };
            await service.transaction(pool, db => service.syncLead(db, closed, { student: received.student }, admin));
            assert.equal((await pool.query('SELECT COUNT(*) AS n FROM payment_records')).rows[0].n, '2');
            await assert.rejects(service.transaction(pool, db => service.syncLead(db, { ...lead, paymentSurvey: { ...lead.paymentSurvey, paidAmount: 700000 } }, { student: received.student }, admin)), { status: 409 });
        });
        await t.test('new deposit plus closing is immutable and repeats do not change income', async () => {
            await reset();
            const ps = { ...lead.paymentSurvey, paymentMethod: 'card', receiptUrl: '/uploads/check.png' };
            const s = service.student((await pool.query("SELECT * FROM students WHERE id='s'")).rows[0]), pa = { student: s };
            await service.transaction(pool, db => service.syncLead(db, { ...lead, paymentSurvey: ps }, pa, admin));
            const closed = { ...lead, paymentSurvey: ps, status: 'tolov-yopildi', paymentClosedSurvey: { actualAmount: 2000000, closedDate: '2026-10-04', paymentMethod: 'cash', receiptUrl: '/uploads/close.pdf', noDebtConfirmed: true } };
            await service.transaction(pool, db => service.syncLead(db, closed, pa, admin));
            await service.transaction(pool, db => service.syncLead(db, closed, pa, admin));
            assert.equal((await pool.query('SELECT SUM(amount) AS n FROM payment_records')).rows[0].n, '2000000');
        });
        await t.test('unknown dates/amounts are reported without guessing, ambiguous academic copies are not duplicated', async () => {
            await reset();
            await pool.query("UPDATE leads SET extra_data=$1 WHERE id='l'", [JSON.stringify({ paymentSurvey: { ...lead.paymentSurvey, lastPaymentDate: '' } })]);
            await pool.query("INSERT INTO payments VALUES('copy','s',600000,1400000,'2026-09-30')");
            const out = await migrate(); assert.equal(out.records, 0); assert.ok(out.issues >= 2);
            const result = await service.receive(pool, manager, receipt('opening'));
            assert.equal(result.student.paymentLedgerOpeningPaid, 600000);
            assert.equal((await pool.query('SELECT SUM(amount) AS n FROM payment_records')).rows[0].n, '1400000');
        });
        await t.test('unlinked academic receipt migrates, unknown date does not, and date range/search filters work', async () => {
            await reset();
            await pool.query(`INSERT INTO students VALUES('legacy','Komil','+998917654321','russian','G','t',NULL,15,'{"debtAmount":1000000}');
                INSERT INTO payments VALUES('exact','legacy',300000,1000000,'04.10.2026'),('unknown','legacy',400000,1000000,'');`);
            const out = await migrate(); assert.equal(out.records, 2);
            const list = await service.transaction(pool, db => service.list(db, admin, { language: 'russian', start: '2026-10-04', end: '2026-10-04', search: '91 765' }));
            assert.equal(list.records.length, 1); assert.equal(list.summary.amount, 300000); assert.equal(list.records[0].legacyReview, true);
        });
        await t.test('audit failure rolls back receipt, balance and lead comment together', async () => {
            await reset(); await migrate();
            await pool.query(`CREATE FUNCTION fail_payment_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit offline'; END $$;
                CREATE TRIGGER fail_payment_audit BEFORE INSERT ON payment_audit FOR EACH ROW EXECUTE FUNCTION fail_payment_audit();`);
            try { await assert.rejects(service.receive(pool, manager, receipt('atomic')), /audit offline/); }
            finally { await pool.query('DROP TRIGGER fail_payment_audit ON payment_audit; DROP FUNCTION fail_payment_audit()'); }
            assert.equal((await pool.query('SELECT COUNT(*) AS n FROM payment_records')).rows[0].n, '1');
            assert.equal((await pool.query("SELECT extra_data FROM students WHERE id='s'")).rows[0].extra_data.debtAmount, 1400000);
            assert.equal((await pool.query("SELECT comments FROM leads WHERE id='l'")).rows[0].comments, '[]');
        });
        await t.test('missing real evidence is rejected; a fresh full-price contract is not an accepted payment', async () => {
            await reset(); await migrate();
            await assert.rejects(service.receive(pool, manager, receipt('missing-proof', { receiptUrl: '/uploads/not-found.pdf' })), { status: 400 });
            const s = service.student((await pool.query("SELECT * FROM students WHERE id='s'")).rows[0]);
            s.paidAmount = 2000000; s.debtAmount = 0;
            await pool.query('TRUNCATE payment_cash_decisions,payment_records,payment_audit');
            const pa = { student: s, credentialsCreated: true };
            await service.transaction(pool, db => service.syncLead(db, { ...lead, paymentSurvey: { paymentType: 'full', totalAmount: 2000000 } }, pa, admin));
            assert.equal(pa.student.paidAmount, 0); assert.equal(pa.student.debtAmount, 2000000);
            assert.equal((await pool.query('SELECT COUNT(*) AS n FROM payment_records')).rows[0].n, '0');
        });
        await t.test('old paid KPI basis retains closed-deal policy after receipts ledger is introduced', async () => {
            await reset();
            const engine = require('../js/payrollEngine');
            const ps = { ...lead.paymentSurvey }, pc = { actualAmount: 2000000, closedDate: '2026-09-30' };
            await pool.query("UPDATE leads SET status='tolov-yopildi',extra_data=$1 WHERE id='l'", [JSON.stringify({ paymentSurvey: ps, paymentClosedSurvey: pc })]);
            const source = await payroll.sources(pool, engine.period('2026-09-01', '2026-09-30')); delete source.paymentRecords;
            const old = engine.calculate(source, engine.defaults(), engine.period('2026-09-01', '2026-09-30'), 'english').rows.find(r => r.employeeId === 'm');
            const basis = payroll.createBasis(source, { data: engine.defaults(), revision: 1 }, null, old, [old]);
            delete basis.paymentPolicy; basis.version = 1; // Actual pre-task-8 basis format.
            await pool.query(`INSERT INTO salary_transactions(id,employee_id,language,period_start,period_end,amount,calculation,source_hash,status,basis)
                VALUES('old-paid','m','english','2026-09-01','2026-09-30',$1,$2,'old','paid',$3)`, [old.total, JSON.stringify(old), JSON.stringify(basis)]);
            await migrate();
            assert.equal((await payroll.preview(pool, admin, { language: 'english', start: '2026-10-01', end: '2026-10-31' })).corrections.length, 0);
            assert.equal((await pool.query("SELECT amount,status FROM salary_transactions WHERE id='old-paid'")).rows[0].amount, String(old.total));
        });
        await t.test('archiving/deleting the CRM student does not delete historical money or multiply unresolved debt', async () => {
            await reset(); await migrate(); await service.receive(pool, manager, receipt('preserved'));
            await pool.query("DELETE FROM students WHERE id='s'; UPDATE leads SET deleted_at=NOW() WHERE id='l'");
            const out = await service.transaction(pool, db => service.list(db, admin, { language: 'english' }));
            assert.equal(out.summary.amount, 2000000); assert.equal(out.summary.debt, 0); assert.equal(out.records.length, 2);
        });
        await t.test('ordinary nonfinancial edits of incomplete legacy payment data remain possible without invented money', async () => {
            await reset();
            const old = { ...lead, paymentSurvey: { ...lead.paymentSurvey, lastPaymentDate: '' } };
            const s = service.student((await pool.query("SELECT * FROM students WHERE id='s'")).rows[0]);
            await service.transaction(pool, db => service.syncLead(db, { ...old, name: 'Corrected name' }, { student: s }, admin, false, old));
            assert.equal((await pool.query('SELECT COUNT(*) AS n FROM payment_records')).rows[0].n, '0');
            await assert.rejects(service.transaction(pool, db => service.syncLead(db, { ...old, paymentSurvey: { ...old.paymentSurvey, paidAmount: 700000 } }, { student: s }, admin, false, old)), { status: 400 });
        });
        await t.test('student history includes separate deposit/debt receipts without duplicating uncertain academic archive', async () => {
            await reset(); await migrate(); await service.receive(pool, manager, receipt('history'));
            await pool.query("INSERT INTO payments VALUES('old-copy','s',600000,1400000,'2026-09-30')");
            const s = service.student((await pool.query("SELECT * FROM students WHERE id='s'")).rows[0]);
            const out = await history.forStudent(pool, s);
            assert.equal(out.history.length, 2); assert.equal(out.summary.amount, 2000000); assert.equal(out.summary.debt, 0);
            assert.equal(out.legacyHistory.length, 1); assert.equal(out.legacyHistory[0].id, 'old-copy');
            const vm = require('node:vm'), { functionSource } = require('./helpers/lead-workflow-fixture.cjs');
            const context = vm.createContext({ pool, paymentHistory: history, resolveStudentId: async () => 's',
                rowToStudent: service.student, q: (sql,args) => pool.query(sql,args).then(r => r.rows),
                q1: (sql,args) => pool.query(sql,args).then(r => r.rows[0]) });
            vm.runInContext(functionSource('server/db.js','getDemoStudentPayments'), context);
            const mobile = await context.getDemoStudentPayments('s');
            assert.equal(mobile.history.length, 2); assert.equal(mobile.history[0].paid, 1400000);
            assert.equal(mobile.debtAmount, 0);
        });
        const oldCash = () => ({ id:'old-cash',type:'kirim',category:'sotuv',purpose:"Kurs to'lovi",date:'2026-09-30',amount:600000,paymentMethod:'Karta',notes:'Student' });
        const seedCash = async () => { await reset(); await migrate(); await pool.query("INSERT INTO json_data(key,data) VALUES('cashFlow',$1) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data", [JSON.stringify([oldCash()])]); };
        await t.test('cash review is read-only pending, finance-only, audited, immutable and retry-safe', async () => {
            await seedCash(); await cash.initSchema(pool);
            const view = await service.transaction(pool, db => cash.list(db, admin));
            assert.equal(view.pending.length, 1); assert.equal(view.decisions.length, 0);
            const body = { cashId:'old-cash',snapshot:require('../js/paymentLedger').stable(oldCash()),decision:'linked',recordId:view.pending[0].candidates[0].id };
            await assert.rejects(cash.decide(pool, manager, body), { status:403 });
            await assert.rejects(cash.decide(pool, admin, { ...body,snapshot:'stale' }), { status:409 });
            const pair = await Promise.all([cash.decide(pool,admin,body),cash.decide(pool,admin,body)]);
            assert.equal(pair.filter(r => !r.duplicate).length, 1);
            assert.equal((await service.transaction(pool,db => cash.list(db,admin))).pending.length, 0);
            assert.equal((await pool.query("SELECT COUNT(*) AS n FROM payment_audit WHERE action='cash-reconciled'")).rows[0].n, '1');
            assert.equal((await pool.query("SELECT data FROM json_data WHERE key='cashFlow'")).rows[0].data.length, 1);
            await assert.rejects(cash.decide(pool,admin,{...body,decision:'independent',recordId:''}), {status:409});
            await service.transaction(pool,db => cash.saveCash(db,[{id:'expense',type:'chiqim',amount:10}]));
            assert.equal((await pool.query("SELECT data FROM json_data WHERE key='cashFlow'")).rows[0].data.length, 2);
            await assert.rejects(service.transaction(pool,db => cash.saveCash(db,[{...oldCash(),amount:1}])), {status:409});
        });
        await t.test('independent same-day income is counted after confirmation; changed pending source cannot be forged by bulk save', async () => {
            await seedCash();
            await assert.rejects(service.transaction(pool,db => cash.saveCash(db,[{...oldCash(),amount:1}])), {status:409});
            await cash.decide(pool,admin,{cashId:'old-cash',snapshot:require('../js/paymentLedger').stable(oldCash()),decision:'independent'});
            const view = await service.transaction(pool,db => cash.list(db,admin)), facts = await cash.facts(pool);
            const projection = require('../js/paymentLedger').projectCash([oldCash()],facts.records,view.decisions);
            assert.equal(projection.rows.reduce((sum,r) => sum+r.amount,0), 1200000);
            assert.equal(projection.pending.length,0);
        });
        await t.test('cash decision and audit roll back atomically', async () => {
            await seedCash();
            await pool.query("CREATE FUNCTION reject_cash_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='cash-reconciled' THEN RAISE EXCEPTION 'Cash audit failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER reject_cash_audit BEFORE INSERT ON payment_audit FOR EACH ROW EXECUTE FUNCTION reject_cash_audit();");
            try {
                await assert.rejects(cash.decide(pool,admin,{cashId:'old-cash',snapshot:require('../js/paymentLedger').stable(oldCash()),decision:'independent'}),/Cash audit failure/);
                assert.equal((await pool.query('SELECT COUNT(*) AS n FROM payment_cash_decisions')).rows[0].n,'0');
            } finally { await pool.query('DROP TRIGGER reject_cash_audit ON payment_audit; DROP FUNCTION reject_cash_audit()'); }
        });
        await t.test('actual Express inflow router authenticates and enforces persisted ownership for reads and writes', async () => {
            await reset(); await migrate();
            const Module = require('node:module'), express = require('express'), jwt = require('jsonwebtoken');
            const routePath = require.resolve('../server/routes/inflow'), originalLoad = Module._load; let router;
            try {
                Module._load = function(request, parent, ...args) { return parent?.filename === routePath && request === '../db' ? { pool } : originalLoad.call(this, request, parent, ...args); };
                delete require.cache[routePath]; router = require(routePath);
            } finally { Module._load = originalLoad; }
            const app = express(); app.use(express.json()); app.use('/api/inflow', router);
            const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
            const base = 'http://127.0.0.1:' + server.address().port + '/api/inflow';
            const headers = id => ({ Authorization: 'Bearer ' + jwt.sign({ id, role: 'admin' }, process.env.JWT_SECRET || 'myhomework-dev-secret-change-in-production', { expiresIn: '1m' }), 'Content-Type': 'application/json' });
            try {
                assert.equal((await fetch(base + '?language=english')).status, 401);
                assert.equal((await fetch(base + '?language=english', { headers: headers('teacher') })).status, 403);
                assert.equal((await fetch(base + '/students/s', { headers: headers('other') })).status, 403);
                const response = await fetch(base + '?language=english', { headers: headers('admin') });
                assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
                assert.equal((await response.json()).summary.amount, 600000);
                assert.equal((await fetch(base + '/students/s/history', { headers:headers('other') })).status,403);
                const historyResponse = await fetch(base + '/students/s/history',{headers:headers('manager')});
                assert.equal(historyResponse.status,200); assert.equal((await historyResponse.json()).history.length,1);
                assert.equal((await fetch(base + '/cash-reconciliation',{headers:headers('manager')})).status,403);
                const result = await fetch(base, { method: 'POST', headers: headers('manager'), body: JSON.stringify(receipt('route')) });
                assert.equal(result.status, 200); assert.equal((await result.json()).student.debtAmount, 0);
            } finally { await new Promise(r => server.close(r)); }
        });
    } finally { await pool.end(); if (oldDir === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = oldDir; }
});
