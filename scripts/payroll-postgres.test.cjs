const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const service = require('../server/services/payroll');
const engine = require('../js/payrollEngine');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
// No fallback to DATABASE_URL. A live/remote database cannot be used accidentally.
if (url) {
  const parsed = new URL(url);
  if (parsed.hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(parsed.pathname)) throw Error('Only disposable loopback test databases are allowed');
}
test('real PostgreSQL payroll integration', { skip: !url }, async t => {
  const pool = new Pool({ connectionString: url });
  const actor = { id: 'admin' };
  const period = (start, end) => ({ start, end, language: 'english' });
  const oct = period('2026-10-01', '2026-10-31'), nov = period('2026-11-01', '2026-11-30'), dec = period('2026-12-01', '2026-12-31');
  try {
    await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,avatar TEXT);
      CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,role TEXT,lang TEXT,login TEXT,department TEXT,status TEXT,start_date TEXT,join_date TEXT);
      CREATE TABLE teachers(id TEXT PRIMARY KEY,schedule_pattern TEXT,lesson_duration INTEGER);
      CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,subject TEXT,teacher_id TEXT,assistant_teacher_id TEXT,lesson_duration INTEGER,extra_data JSONB);
      CREATE TABLE leads(id TEXT PRIMARY KEY,manager_id TEXT,status TEXT,language TEXT,deleted_at TIMESTAMPTZ,extra_data JSONB);
      CREATE TABLE main_attendance(att_key TEXT,student_id TEXT,day INTEGER,present INTEGER,PRIMARY KEY(att_key,student_id,day));
      CREATE TABLE assistant_attendance(LIKE main_attendance INCLUDING ALL);
      CREATE TABLE json_data(key TEXT PRIMARY KEY,data JSONB);
      INSERT INTO users VALUES('admin','Admin','admin','admin',''),('manager','Manager','sales','sales_manager',''),('teacher','Teacher','teacher','teacher','');`);
    await service.initSchema(pool);
    const reset = async () => {
      await pool.query(`TRUNCATE salary_adjustment_applications,salary_adjustments,salary_transactions,salary_audit,salary_plan_confirmations,
        hr_employees,teachers,students,leads,main_attendance,assistant_attendance,json_data;
        INSERT INTO hr_employees(id,name,role,lang,login,status,start_date,kpi_template_id)
          VALUES('sales','Sales','sotuv-menejeri','english','sales','active','2026-09-01','sales');`);
      await pool.query('UPDATE salary_kpi_settings SET data=$1,revision=1', [JSON.stringify(engine.defaults())]);
    };
    const sale = async (id, amount, closedDate) => {
      await pool.query(`INSERT INTO leads(id,manager_id,status,language,extra_data) VALUES($1,'sales','tolov-yopildi','english',$2)
        ON CONFLICT(id) DO UPDATE SET extra_data=EXCLUDED.extra_data`, [id, JSON.stringify({ paymentClosedSurvey: { actualAmount: amount, closedDate } })]);
    };
    const accrue = async p => {
      const preview = await service.preview(pool, actor, p);
      await service.accrue(pool, actor, { ...p, sourceHash: preview.sourceHash });
      return service.preview(pool, actor, p);
    };
    const pay = async p => { const result = await accrue(p); for (const r of result.rows) await service.markPaid(pool, actor, r.transactionId); return result; };
    const review = async (p, proposal, decision = 'approve') => service.reviewAdjustment(pool, actor, proposal.sourceTransactionId, { ...p, decision, reviewHash: proposal.reviewHash });
    const row = result => result.rows.find(r => r.employeeId === 'sales');

    await t.test('schema migrations are repeatable, with constraints and both language settings', async () => {
      await service.initSchema(pool);
      assert.equal((await pool.query('SELECT COUNT(*) FROM salary_kpi_settings')).rows[0].count, '2');
      assert.equal((await pool.query("SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'salary_%'")).rows[0].count, '6');
    });
    await t.test('positive correction is read-only until approval, paid exactly once and original remains frozen', async () => {
      await reset(); await sale('old', 20000000, '2026-10-10'); const paid = await pay(oct);
      const originalId = row(paid).transactionId;
      assert.ok((await pool.query('SELECT basis FROM salary_transactions WHERE id=$1', [originalId])).rows[0].basis.settings);
      await sale('old', 30000000, '2026-10-10');
      const pending = await service.preview(pool, actor, nov); assert.equal(pending.corrections[0].amount, 500000); assert.equal(row(pending).total, 0);
      assert.equal((await pool.query('SELECT COUNT(*) FROM salary_adjustments')).rows[0].count, '0');
      await review(nov, pending.corrections[0]); await review(nov, pending.corrections[0]);
      assert.equal(row(await service.preview(pool, actor, nov)).total, 500000);
      const next = await pay(nov); await service.markPaid(pool, actor, row(next).transactionId);
      assert.equal((await pool.query('SELECT COUNT(*) FROM salary_adjustment_applications')).rows[0].count, '1');
      assert.equal((await pool.query('SELECT amount,status FROM salary_transactions WHERE id=$1', [originalId])).rows[0].amount, '2000000');
      assert.equal((await service.preview(pool, actor, dec)).corrections.length, 0);
      assert.equal((await pool.query('SELECT status FROM salary_adjustments')).rows[0].status, 'settled');
    });
    await t.test('large negative correction carries over without negative cash payment or duplicate deduction', async () => {
      await reset(); await sale('old', 20000000, '2026-10-10'); await pay(oct); await sale('old', 10000000, '2026-10-10');
      const pending = await service.preview(pool, actor, nov); assert.equal(pending.corrections[0].amount, -1500000); await review(nov, pending.corrections[0]);
      await sale('nov', 10000000, '2026-11-10'); const november = await pay(nov);
      assert.equal(row(november).total, 0); assert.equal(row(november).adjustmentTotal, -500000);
      const left = await service.preview(pool, actor, dec); assert.equal(left.corrections[0].amount, -1000000); assert.equal(left.corrections[0].status, 'approved');
      await sale('dec', 20000000, '2026-12-10'); const december = await pay(dec);
      assert.equal(row(december).total, 1000000);
      assert.equal((await pool.query('SELECT SUM(amount) FROM salary_adjustment_applications')).rows[0].sum, '-1500000');
    });
    await t.test('later-dated refund is not counted in old period twice; zero-payment period carries its debt', async () => {
      await reset(); await sale('old', 20000000, '2026-10-10'); await pay(oct);
      await pool.query("INSERT INTO json_data(key,data) VALUES('cashFlow',$1)", [JSON.stringify([{ id: 'refund', leadId: 'old', language: 'english', type: 'chiqim', purpose: 'Pul qaytarish (Refund)', date: '2026-11-10', amount: 10000000 }])]);
      const n = await service.preview(pool, actor, nov); assert.equal(n.corrections.length, 0); assert.equal(row(n).unpaidDebt, 500000); assert.equal(row(n).total, 0);
      await pay(nov); const d = await service.preview(pool, actor, dec);
      assert.equal(d.corrections.length, 1); assert.equal(d.corrections[0].amount, -500000); await review(dec, d.corrections[0]);
      await sale('dec', 20000000, '2026-12-10'); assert.equal(row(await pay(dec)).total, 1500000);
    });
    await t.test('changed facts invalidate approval, old preview and previously accrued future salary', async () => {
      await reset(); await sale('old', 20000000, '2026-10-10'); await pay(oct); await sale('old', 30000000, '2026-10-10');
      const pending = await service.preview(pool, actor, nov); await review(nov, pending.corrections[0]); const accrued = await accrue(nov);
      await sale('old', 40000000, '2026-10-10');
      await assert.rejects(review(nov, pending.corrections[0]), { status: 409 });
      await assert.rejects(service.markPaid(pool, actor, row(accrued).transactionId), { status: 409 });
      const fresh = await service.preview(pool, actor, nov); assert.equal(fresh.corrections[0].amount, 2000000); assert.equal(fresh.corrections[0].status, 'pending');
      await review(nov, fresh.corrections[0]); assert.equal(row(await pay(nov)).total, 2000000);
      assert.equal((await pool.query("SELECT COUNT(*) FROM salary_adjustments WHERE status='superseded'")).rows[0].count, '1');
    });
    await t.test('current rate edits do not retroactively reprice historical paid sales', async () => {
      await reset(); await sale('old', 20000000, '2026-10-10'); await pay(oct);
      const settings = engine.defaults(); settings.sales.commission = 10;
      await service.saveSettings(pool, actor, 'english', settings, 1);
      assert.equal((await service.preview(pool, actor, nov)).corrections.length, 0);
      await sale('old', 30000000, '2026-10-10'); assert.equal((await service.preview(pool, actor, nov)).corrections[0].amount, 500000);
    });
    await t.test('teacher assignment changes preserve old ownership; actual attendance changes create corrections', async () => {
      await reset();
      await pool.query(`DELETE FROM hr_employees;
        INSERT INTO hr_employees(id,name,role,lang,login,status,start_date,kpi_template_id)
          VALUES('t','Teacher','ingliz-oqituvchi','english','teacher','active','2026-09-01','teacher');
        INSERT INTO teachers VALUES('t','mwf',30);
        INSERT INTO students VALUES('s','Student','english','t',NULL,30,'{}');
        INSERT INTO main_attendance VALUES('2026-10_t','s',2,1);`);
      await pay(oct);
      await pool.query("UPDATE students SET teacher_id='new-teacher',lesson_duration=60; DELETE FROM teachers; DELETE FROM hr_employees");
      assert.equal((await service.preview(pool, actor, nov)).corrections.length, 0);
      await pool.query("INSERT INTO main_attendance VALUES('2026-10_t','s',5,1)");
      const proposal = (await service.preview(pool, actor, nov)).corrections[0]; assert.equal(proposal.amount, 11539);
      await review(nov, proposal); const n = await service.preview(pool, actor, nov);
      assert.equal(n.rows[0].baseTotal, 0); assert.equal(n.rows[0].total, 11539);
      await pay(nov);
    });
    await t.test('legacy paid rows without historical basis are flagged, never guessed or mutated', async () => {
      await reset(); await sale('old', 20000000, '2026-10-10'); const original = await pay(oct);
      await pool.query('UPDATE salary_transactions SET basis=NULL WHERE id=$1', [row(original).transactionId]);
      const p = await service.preview(pool, actor, nov); assert.equal(p.corrections[0].legacy, true);
      await assert.rejects(review(nov, p.corrections[0]), { status: 409 });
      assert.equal((await pool.query('SELECT amount FROM salary_transactions')).rows[0].amount, '2000000');
    });
    await t.test('persisted role beats forged JWT claims; all review writes are audited atomically', async () => {
      await reset(); await sale('old', 20000000, '2026-10-10'); await pay(oct); await sale('old', 30000000, '2026-10-10');
      const p = await service.preview(pool, actor, nov);
      await assert.rejects(service.reviewAdjustment(pool, { id: 'manager', role: 'admin' }, p.corrections[0].sourceTransactionId, { ...nov, decision: 'approve', reviewHash: p.corrections[0].reviewHash }), { status: 403 });
      await pool.query(`CREATE FUNCTION payroll_test_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.action='adjustment-approve' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER payroll_test_audit_fail BEFORE INSERT ON salary_audit FOR EACH ROW EXECUTE FUNCTION payroll_test_audit_fail();`);
      await assert.rejects(review(nov, p.corrections[0]), /audit unavailable/);
      assert.equal((await pool.query('SELECT COUNT(*) FROM salary_adjustments')).rows[0].count, '0');
      await pool.query('DROP TRIGGER payroll_test_audit_fail ON salary_audit; DROP FUNCTION payroll_test_audit_fail()');
      await review(nov, p.corrections[0]); assert.equal((await pool.query("SELECT actor_name FROM salary_audit WHERE action='adjustment-approve'")).rows[0].actor_name, 'Admin');
    });
    await t.test('concurrent approval/payment is idempotent and cannot spend an adjustment twice', async () => {
      await reset(); await sale('old', 20000000, '2026-10-10'); await pay(oct); await sale('old', 30000000, '2026-10-10');
      const p = await service.preview(pool, actor, nov);
      await Promise.all([review(nov, p.corrections[0]), review(nov, p.corrections[0])]);
      assert.equal((await pool.query("SELECT COUNT(*) FROM salary_adjustments WHERE status='approved'")).rows[0].count, '1');
      const n = await accrue(nov); await Promise.all([service.markPaid(pool, actor, row(n).transactionId), service.markPaid(pool, actor, row(n).transactionId)]);
      assert.equal((await pool.query('SELECT COUNT(*) FROM salary_adjustment_applications')).rows[0].count, '1');
      assert.equal((await pool.query("SELECT COUNT(*) FROM salary_audit WHERE action='mark-paid' AND entity_id=$1", [row(n).transactionId])).rows[0].count, '1');
    });
    await t.test('dismissed corrections do not enter wages; zero delta cancels an obsolete approval', async () => {
      await reset(); await sale('old', 20000000, '2026-10-10'); await pay(oct); await sale('old', 30000000, '2026-10-10');
      const p = (await service.preview(pool, actor, nov)).corrections[0];
      await review(nov, p, 'dismiss'); await review(nov, p, 'dismiss');
      assert.equal((await service.preview(pool, actor, nov)).corrections[0].status, 'dismissed');
      assert.equal(row(await service.preview(pool, actor, nov)).total, 0);
      await review(nov, (await service.preview(pool, actor, nov)).corrections[0]);
      await sale('old', 20000000, '2026-10-10'); const zero = (await service.preview(pool, actor, nov)).corrections[0];
      assert.equal(zero.amount, 0); await review(nov, zero, 'dismiss');
      assert.equal((await service.preview(pool, actor, nov)).corrections.length, 0);
    });
    await t.test('manual legacy corrections require finance, reason and idempotency; no historical rate is guessed', async () => {
      await reset(); await sale('old', 20000000, '2026-10-10'); const paid = await pay(oct), id = row(paid).transactionId;
      await pool.query('UPDATE salary_transactions SET basis=NULL WHERE id=$1', [id]);
      const input = { ...nov, amount: -500000, reason: 'Moliya tekshirgan eski bonus xatosi', requestKey: 'manual-test-key-1234567890' };
      await assert.rejects(service.reviewManualAdjustment(pool, actor, id, { ...input, amount: 1.5 }), { status: 400 });
      await assert.rejects(service.reviewManualAdjustment(pool, actor, id, { ...input, reason: 'qisqa' }), { status: 400 });
      await assert.rejects(service.reviewManualAdjustment(pool, { id: 'teacher', role: 'admin' }, id, input), { status: 403 });
      await service.reviewManualAdjustment(pool, actor, id, input); await service.reviewManualAdjustment(pool, actor, id, input);
      await assert.rejects(service.reviewManualAdjustment(pool, actor, id, { ...input, amount: -1 }), { status: 409 });
      assert.equal((await pool.query('SELECT COUNT(*) FROM salary_adjustments')).rows[0].count, '1');
      await sale('nov', 10000000, '2026-11-10'); const n = await pay(nov);
      assert.equal(row(n).total, 0); assert.equal(row(n).adjustmentTotal, -500000);
      assert.equal((await pool.query("SELECT COUNT(*) FROM salary_audit WHERE action='manual-adjustment-approve'")).rows[0].count, '1');
    });
    await t.test('partially consumed correction can be revised without losing or repeating prior deductions', async () => {
      await reset(); await sale('old', 20000000, '2026-10-10'); await pay(oct); await sale('old', 10000000, '2026-10-10');
      await review(nov, (await service.preview(pool, actor, nov)).corrections[0]); await sale('nov', 10000000, '2026-11-10'); await pay(nov);
      await sale('old', 5000000, '2026-10-10'); const p = (await service.preview(pool, actor, dec)).corrections[0];
      assert.equal(p.amount, -1250000); assert.equal(p.applied, -500000); await review(dec, p);
      await sale('dec', 20000000, '2026-12-10'); assert.equal(row(await pay(dec)).total, 750000);
      assert.equal((await pool.query('SELECT SUM(amount) FROM salary_adjustment_applications')).rows[0].sum, '-1750000');
    });
    await t.test('two alternative unpaid periods cannot both consume the same approved correction', async () => {
      await reset(); await sale('old', 20000000, '2026-10-10'); await pay(oct); await sale('old', 30000000, '2026-10-10');
      await review(nov, (await service.preview(pool, actor, nov)).corrections[0]);
      const n = await accrue(nov), d = await accrue(dec);
      assert.equal(row(n).total, 500000); assert.equal(row(d).total, 500000);
      await service.markPaid(pool, actor, row(n).transactionId);
      await assert.rejects(service.markPaid(pool, actor, row(d).transactionId), { status: 409 });
      assert.equal((await pool.query('SELECT COUNT(*) FROM salary_adjustment_applications')).rows[0].count, '1');
    });
    await t.test('ROP historical plan/rates stay frozen while corrected sales wages affect its actual clean base', async () => {
      await reset();
      await pool.query(`INSERT INTO hr_employees(id,name,role,lang,login,status,start_date,kpi_template_id)
        VALUES('rop','ROP','rop','english','rop','active','2026-09-01','rop');`);
      await pool.query("INSERT INTO json_data(key,data) VALUES('salesPlan',$1)", [JSON.stringify({ english: { managers: 1, leadsPerDay: 1, avgCheck: 1000000, conversions: { mid: 100 } } })]);
      const settings = engine.defaults(); settings.targetMonthlySalary = 500000; await service.saveSettings(pool, actor, 'english', settings, 1);
      await sale('old', 40000000, '2026-10-10'); await service.confirmPlan(pool, actor, { ...oct, amount: 31000000 }); await pay(oct);
      await sale('old', 30000000, '2026-10-10');
      await pool.query("UPDATE json_data SET data='{}' WHERE key='salesPlan'");
      settings.rop.tiers.at(-1).rate = 1; await service.saveSettings(pool, actor, 'english', settings, 2);
      const proposals = (await service.preview(pool, actor, nov)).corrections;
      assert.equal(proposals.find(p => p.role === 'rop').amount, -680000);
      assert.equal(proposals.find(p => p.role === 'sales').amount, -1500000);
    });
    await t.test('real Express API authenticates, checks persisted roles and does not expose salary basis snapshots', async () => {
      await reset(); await sale('old', 20000000, '2026-10-10');
      const Module = require('node:module'), express = require('express'), jwt = require('jsonwebtoken');
      const routePath = require.resolve('../server/routes/payroll');
      const originalLoad = Module._load;
      let router;
      try {
        Module._load = function(request, parent, ...args) {
          if (parent?.filename === routePath && request === '../db') return { pool };
          return originalLoad.call(this, request, parent, ...args);
        };
        delete require.cache[routePath]; router = require(routePath);
      } finally { Module._load = originalLoad; }
      const app = express(); app.use(express.json()); app.use('/api/payroll', router);
      const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
      const base = 'http://127.0.0.1:' + server.address().port + '/api/payroll';
      const token = id => jwt.sign({ id, role: 'admin' }, process.env.JWT_SECRET || 'myhomework-dev-secret-change-in-production', { expiresIn: '1m' });
      try {
        assert.equal((await fetch(base + '/preview?' + new URLSearchParams(oct))).status, 401);
        assert.equal((await fetch(base + '/preview?' + new URLSearchParams(oct), { headers: { Authorization: 'Bearer ' + token('teacher') } })).status, 403);
        const response = await fetch(base + '/preview?' + new URLSearchParams(oct), { headers: { Authorization: 'Bearer ' + token('admin') } });
        assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
        const data = await response.json(); assert.equal(data.rows[0].total, 2000000); assert.equal(data._bases, undefined);
        const badReview = await fetch(base + '/adjustments/unknown/review', { method: 'POST', headers: { Authorization: 'Bearer ' + token('admin'), 'Content-Type': 'application/json' }, body: JSON.stringify({ ...nov, decision: 'approve', reviewHash: 'forged' }) });
        assert.equal(badReview.status, 409);
      } finally { await new Promise(resolve => server.close(resolve)); }
    });
  } finally { await pool.end(); }
});
