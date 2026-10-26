// Ma'lumot yaxlitligi: har bir buzish usuli toza bazada alohida tekshiriladi (bir buzilish boshqasini yashirmasligi uchun).
// Ishga tushirish: PAYROLL_TEST_DATABASE_URL=postgres://...@127.0.0.1/payroll_test_xxx node --test scripts/finance-integrity-postgres.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Pool } = require('pg');
const inflow = require('../server/services/inflow');
const cash = require('../server/services/paymentCash');
const finance = require('../server/services/finance');
const F = require('../js/financeEngine');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url && (new URL(url).hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(new URL(url).pathname))) throw Error('Only disposable test DB allowed');

// Oddiy SQL (triggerlar yoqilgan, ilova belgisi yo'q) — alohida psql sessiyasida.
const plainSql = sql => execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], { encoding: 'utf8' });
// Superuser triggerlarni o'chirib yashirin o'zgartirish.
const superSql = (table, sql) => plainSql(`ALTER TABLE ${table} DISABLE TRIGGER USER; ${sql}; ALTER TABLE ${table} ENABLE TRIGGER USER;`);
// Ilova nomidan: imzolangan belgi va tranzaksiya imzosi bilan (ilova COMMIT oldidan qiladigan ish).
let signPool = null;
const appSql = async (app, sql, user = '') => {
    const out = plainSql(`BEGIN; SELECT set_config('fin.ctx', '${require('../server/services/finCtx').token(app)}', true), set_config('app.user_id', '${user}', true); ${sql}; SET CONSTRAINTS ALL IMMEDIATE; SELECT 'XID:' || pg_current_xact_id(); COMMIT;`);
    await require('../server/services/finCtx').signXid(signPool, /XID:(\d+)/.exec(out)[1]);
};

async function fresh(pool) {
    signPool = pool;
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-int-'));
    await pool.query('DROP SCHEMA IF EXISTS evil CASCADE; DROP SCHEMA IF EXISTS shadow CASCADE; DROP SCHEMA IF EXISTS postgres CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,avatar TEXT);
        CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,role TEXT,lang TEXT,login TEXT,department TEXT,status TEXT,start_date TEXT,join_date TEXT);
        CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
        CREATE TABLE teachers(id TEXT PRIMARY KEY,name TEXT);
        CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,group_name TEXT,teacher_id TEXT,lesson_duration INTEGER,extra_data JSONB);
        CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,manager_id TEXT,status TEXT,language TEXT,deleted_at TIMESTAMPTZ,extra_data JSONB,comments TEXT DEFAULT '[]',updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE payments(id TEXT PRIMARY KEY,student_id TEXT,paid INTEGER,debt INTEGER,date TEXT);
        CREATE TABLE json_data(key TEXT PRIMARY KEY,data JSONB);
        CREATE TABLE salary_transactions(id TEXT PRIMARY KEY,employee_id TEXT,language TEXT,period_start DATE,period_end DATE,amount BIGINT,status TEXT,paid_at TIMESTAMPTZ,cash_expense_id TEXT);
        INSERT INTO users VALUES('admin','Admin','admin','admin',''),('acc','Buxgalter','acc','accountant',''),('acc2','Buxgalter 2','acc2','accountant','');
        INSERT INTO hr_employees(id,name,role,lang,login,status) VALUES('t1','Ustoz','rus-oqituvchi','russian','t1','active');
        INSERT INTO students VALUES('s1','Ali','+998901112233','russian','g',NULL,30,'{"debtAmount":0}');
        INSERT INTO salary_transactions VALUES('sal1','t1','russian','2026-09-01','2026-09-30',900000,'paid',NOW(),NULL);`);
    await inflow.initSchema(pool); await cash.initSchema(pool); await finance.initSchema(pool);
    await appSql('inflow', `INSERT INTO payment_records(id,source_key,lead_id,student_id,language,manager_id,paid_date,amount,method,receipt_url,form,debt_snapshot,snapshot,legacy_review,actor_id)
        VALUES('r1','k1','l1','s1','russian','m','2026-09-10',1000000,'card','','partial',0,'{"name":"Ali"}',TRUE,'system')`);
    await finance.createTransaction(pool, { id: 'admin' }, { requestKey: 'int-test-key-0000001', entity: 'common', type: 'expense', categoryCode: 'SOFTWARE', accountId: 'acc-card', amount: 100000, date: '2026-09-12', counterparty: 'Hosting' });
    assert.equal((await finance.verifySeals(pool)).ok, true, 'toza baza');
}
const scenarios = [
    ['plain-SQL fake receipt (triggers on)', () => plainSql(`INSERT INTO payment_records(id,source_key,language,paid_date,amount,method,form,snapshot,actor_id) VALUES('ghost','ghost','russian','2026-10-20',5000000,'uzum','full','{}','x')`), 'payment_records'],
    ['plain-SQL forged freeze in the student log', () => plainSql(`INSERT INTO fin_student_log(student_id,state) VALUES('s1','{"frozen":true,"frozenAt":"2026-10-01","status":null,"inactiveAt":null,"debtAmount":"0","paymentDueDate":null}')`), 'fin_student_log'],
    ['student state edited with triggers disabled', () => superSql('students', `UPDATE students SET extra_data=extra_data || '{"frozen":true,"frozenAt":"2026-09-15"}'::jsonb WHERE id='s1'`), 'fin_student_log'],
    ['plain-SQL salary amount change', () => plainSql("UPDATE salary_transactions SET amount=amount+5000000 WHERE id='sal1'"), 'salary_transactions'],
    ['plain-SQL approval limit change', () => plainSql(`UPDATE fin_settings SET data=jsonb_set(data,'{approvalLimit}','999999999999') WHERE id='main'`), 'fin_settings'],
    ['plain-SQL account mapping change', () => plainSql("UPDATE fin_accounts SET methods='{cash,card}' WHERE id='acc-cash'"), 'fin_accounts'],
    ['plain-SQL forged freeze followed by the real state (history rewrite)', () => plainSql(`INSERT INTO fin_student_log(student_id,state) VALUES('s1','{"frozen":true,"frozenAt":"2026-09-15","status":null,"inactiveAt":null,"debtAmount":"0","paymentDueDate":null}');
        INSERT INTO fin_student_log(student_id,state) SELECT 's1', fin_student_state(extra_data) FROM students WHERE id='s1'`), 'fin_student_log'],
    ['student deleted with triggers disabled (no exit record)', () => superSql('students', "DELETE FROM students WHERE id='s1'"), 'fin_student_log'],
    ['plain-SQL salary role snapshot', () => plainSql("INSERT INTO fin_salary_roles(salary_id,role,source) VALUES('salX','admin','insert')"), 'fin_salary_roles'],
    ['plain-SQL zero-cash termination', () => plainSql("INSERT INTO fin_contract_events(id,payment_record_id,kind,event_date,reason,actor_id,actor_name) VALUES('fx','r1','forfeit','2026-10-20','soxta tugatish','x','x')"), 'fin_contract_events'],
    ['transaction amount edited with triggers disabled', () => superSql('fin_transactions', "UPDATE fin_transactions SET amount=1 WHERE request_key='int-test-key-0000001'"), 'fin_transactions']
];

test('integrity: every tampering method is detected on its own', { skip: !url }, async t => {
    const pool = new Pool({ connectionString: url });
    try {
        for (const [name, tamper, table] of scenarios) {
            await t.test(name, async () => {
                await fresh(pool);
                tamper();
                const v = await finance.verifySeals(pool);
                assert.equal(v.ok, false, name);
                assert.equal(v.table, table, `${name}: ${v.reason}`);
                assert.equal((await finance.overview(pool, { id: 'admin' }, {})).seals.ok, false, 'bosh sahifada ham');
            });
        }
        await t.test('lock removed and re-inserted with triggers disabled; a back-dated expense in between is flagged', async () => {
            await fresh(pool);
            await finance.lockMonth(pool, { id: 'admin' }, { month: '2026-09', override: true, note: 'Test: sentyabr yopildi, keyin qulf chetlab o‘tiladi' });
            assert.equal((await finance.verifySeals(pool)).ok, true);
            const lock = (await pool.query("SELECT month,locked_by,locked_by_name,note,snapshot_hashes::text AS h,locked_at::text AS at FROM fin_period_locks")).rows[0];
            superSql('fin_period_locks', "DELETE FROM fin_period_locks WHERE month='2026-09'");
            await finance.createTransaction(pool, { id: 'admin' }, { requestKey: 'int-test-key-0000002', entity: 'common', type: 'expense', categoryCode: 'ADMIN', accountId: 'acc-card', amount: 400000, date: '2026-09-15', counterparty: 'Orqaga sanalangan' });
            const q = v => "'" + String(v).replace(/'/g, "''") + "'";
            superSql('fin_period_locks', `INSERT INTO fin_period_locks(month,locked_by,locked_by_name,note,snapshot_hashes,locked_at) VALUES(${q(lock.month)},${q(lock.locked_by)},${q(lock.locked_by_name)},${q(lock.note)},${q(lock.h)}::jsonb,${q(lock.at)}::timestamptz)`);
            const v = await finance.verifySeals(pool);
            assert.equal(v.ok, false); assert.equal(v.table, 'fin_transactions'); assert.match(v.reason, /qulfdan keyin/);
        });
        await t.test('a closed month lock cannot be deleted with plain SQL', async () => {
            await fresh(pool);
            await finance.lockMonth(pool, { id: 'admin' }, { month: '2026-09', override: true, note: 'Test: sentyabr yopildi (oddiy SQL bilan o‘chirishga urinish)' });
            assert.throws(() => plainSql("DELETE FROM fin_period_locks WHERE month='2026-09'"), /faqat moliya/);
        });
    } finally { await pool.end(); }
});

const pdf = () => ({ originalname: 'a.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nevidence ' + Math.random()) });
test('round 8: dropout from a controlled date, zero-cash termination, attribution, duplicates, limits, segments, salary roles', { skip: !url }, async t => {
    const pool = new Pool({ connectionString: url });
    const admin = { id: 'admin' }, acc = { id: 'acc' }, acc2 = { id: 'acc2' };
    try {
        await t.test('CRM bulk rewrite deletes a student: dated exit record, revenue stops, not treated as tampering', async () => {
            await fresh(pool);
            // CRM saqlashi: hammasi o'chiriladi va qolganlar qayta yoziladi (s1 ro'yxatda yo'q), crm: belgisi va foydalanuvchi bilan.
            await appSql('crm', `INSERT INTO students VALUES('s2','Vali','+998907770000','english','g',NULL,30,'{"debtAmount":0}');
                DELETE FROM students; INSERT INTO students VALUES('s2','Vali','+998907770000','english','g',NULL,30,'{"debtAmount":0}')`, 'rop1');
            const rows = (await pool.query("SELECT student_id,state,app_user,ctx FROM fin_student_log ORDER BY id")).rows;
            const del = rows.filter(r => r.state.deleted);
            assert.equal(del.length, 1, 'faqat haqiqatan o‘chirilgan o‘quvchi');
            assert.equal(del[0].student_id, 's1'); assert.equal(del[0].app_user, 'rop1'); assert.match(del[0].ctx, /^crm:/);
            assert.equal(rows.filter(r => r.student_id === 's2').length, 1, 'qayta yozilgan o‘quvchi uchun takroriy yozuv yo‘q');
            const v = await finance.verifySeals(pool);
            assert.equal(v.ok, true, v.reason);
            const data = await finance.load(pool);
            const st = data.studentStatus.find(x => x.studentId === 's1');
            assert.ok(st && st.deleted && st.inactive && st.inactiveAt === F.today(), JSON.stringify(st));
            const c = F.contracts(data).find(x => x.receipts.some(r => r.id === 'r1'));
            assert.equal(c.inactiveAt, F.today());
            const later = F.addDays(F.today(), 20);
            assert.equal(F.earned(c, later), F.earned(c, F.today()), 'ketgandan keyin tushum yo‘q');
            const o = await finance.overview(pool, admin, {});
            assert.equal(o.dropouts.length, 1); assert.ok(o.dropouts[0].liability > 0);
        });
        await t.test('zero-cash termination: director only, evidence, releases the liability to revenue, single use', async () => {
            await fresh(pool);
            await appSql('crm', `DELETE FROM students WHERE id='s1'`);
            const before = (await finance.overview(pool, admin, {})).dropouts[0];
            const body = async () => ({ paymentRecordId: 'r1', date: F.today(), reason: 'O‘quvchi ketdi, shartnoma 5.2-band: qaytarilmaydi', evidenceUrl: (await finance.storeEvidence(pool, admin, pdf())).url });
            await assert.rejects(finance.forfeitContract(pool, acc, await body()), e => e.status === 403);
            await assert.rejects(finance.forfeitContract(pool, admin, { ...(await body()), evidenceUrl: '' }), e => e.status === 400);
            await finance.forfeitContract(pool, admin, await body());
            await assert.rejects(finance.forfeitContract(pool, admin, await body()), e => e.status === 409);
            const data = await finance.load(pool);
            const c = F.contracts(data).find(x => x.receipts.some(r => r.id === 'r1'));
            assert.equal(c.terminatedAt, F.today());
            assert.equal(F.contractPosition(c, F.today()), 0, 'majburiyat qolmadi');
            assert.equal(F.earned(c, F.today()), 1000000);
            const o = await finance.overview(pool, admin, {});
            assert.equal(o.dropouts.length, 0); assert.ok(before.liability > 0);
            assert.equal(o.balance.balanced, true, String(o.balance.imbalance));
            assert.equal((await finance.verifySeals(pool)).ok, true);
        });
        await t.test('back-dated freeze from the CRM starts on the record date and is reported', async () => {
            await fresh(pool);
            await appSql('crm', `UPDATE students SET extra_data=extra_data || '{"frozen":true,"frozenAt":"2026-09-12"}'::jsonb WHERE id='s1'`);
            const data = await finance.load(pool);
            assert.equal(data.studentFreezes[0].from, F.today());
            assert.deepEqual(data.backdatedStatus.map(b => [b.studentId, b.claimed]), [['s1', '2026-09-12']]);
            assert.equal((await finance.verifySeals(pool)).ok, true);
        });
        await t.test('salary category uses the role frozen at accrual, not the current HR role', async () => {
            await fresh(pool);
            const cat = async () => (await finance.load(pool)).salaries.find(s => s.id === 'sal1').categoryCode;
            const before = await cat();
            await pool.query("UPDATE hr_employees SET role='sotuv-menejeri' WHERE id='t1'");
            assert.equal(await cat(), before);
            assert.equal((await finance.verifySeals(pool)).ok, true);
        });
        await t.test('duplicate receipts are reported and block a clean close', async () => {
            await fresh(pool);
            await appSql('inflow', `INSERT INTO payment_records(id,source_key,lead_id,student_id,language,manager_id,paid_date,amount,method,receipt_url,form,debt_snapshot,snapshot,legacy_review,actor_id)
                VALUES('r2','k2','l1','s1','russian','m','2026-09-11',1000000,'card','','partial',0,'{"name":"Ali"}',TRUE,'system')`);
            const o = await finance.overview(pool, admin, { start: '2026-09-01', end: '2026-09-30', scope: 'all' });
            assert.equal(o.quality.duplicates.length, 1);
            assert.equal(o.quality.duplicates[0].second.id, 'r2');
            assert.ok(finance.closeReadiness(await finance.load(pool), '2026-09').some(i => /Takroriy/.test(i)));
        });
        await t.test('team-wide daily outflow cap; evidence threshold; outflows without evidence reported', async () => {
            await fresh(pool);
            await finance.createTransaction(pool, admin, { requestKey: 'r8-capital-0000001', entity: 'common', type: 'capital', categoryCode: 'OWNER_IN', accountId: 'acc-card', amount: 50000000, date: '2026-09-20', counterparty: 'Ta’sischi' });
            const s = await finance.overview(pool, admin, {});
            await finance.saveSettings(pool, admin, { revision: s.settingsRevision, data: { approvalLimit: 5000000, dailyLimit: 4000000, teamDailyLimit: 6000000, evidenceMin: 500000 } });
            const exp = async (user, amount, extra = {}) => finance.createTransaction(pool, user, { requestKey: 'r8-' + Math.random().toString(36).slice(2) + '-key', entity: 'common', type: 'expense', categoryCode: 'ADMIN', accountId: 'acc-card', amount, date: F.today(), counterparty: 'Ofis', ...extra });
            await assert.rejects(exp(acc, 600000), e => e.status === 400 && /hujjat/i.test(e.message));
            await exp(acc, 3500000, { receiptUrl: (await finance.storeEvidence(pool, acc, pdf())).url });
            await exp(acc2, 400000);
            await assert.rejects(exp(acc2, 2200000, { receiptUrl: (await finance.storeEvidence(pool, acc2, pdf())).url }), e => e.status === 403 && /barcha xodimlar/.test(e.message));
            const o = await finance.overview(pool, admin, {});
            assert.equal(o.quality.outflowsWithoutProof, 1); assert.equal(o.quality.outflowsWithoutProofAmount, 400000);
        });
        const crmSql = (sql, user = 'rop1') => appSql('crm', sql, user);
        const contractOf = (data, id) => F.contracts(data).find(x => x.receipts.some(r => r.id === id));
        await t.test('round 9: student marked inactive in the CRM stops revenue on the record date and is listed as a dropout', async () => {
            await fresh(pool);
            await crmSql(`UPDATE students SET extra_data=extra_data || '{"status":"inactive"}'::jsonb WHERE id='s1'`);
            const data = await finance.load(pool);
            const st = data.studentStatus.find(x => x.studentId === 's1');
            assert.equal(st.inactiveAt, F.today());
            const c = contractOf(data, 'r1');
            assert.equal(F.earned(c, F.addDays(F.today(), 30)), F.earned(c, F.today()));
            const o = await finance.overview(pool, admin, {});
            assert.equal(o.dropouts.length, 1);
        });
        await t.test('round 9: forged crm: context (no signature) with a back-dated, backfill-flagged log row is caught; stamp columns are forced', async () => {
            await fresh(pool);
            plainSql(`BEGIN; SELECT set_config('fin.ctx','crm:00000000-0000-0000-0000-000000000000.0123456789abcdef0123456789abcdef',true);
                INSERT INTO fin_student_log(student_id,state,backfill,recorded_at) VALUES('s1','{"frozen":true,"frozenAt":"2026-09-11","status":null,"inactiveAt":null,"debtAmount":"0","paymentDueDate":null}',TRUE,'2026-09-11');
                INSERT INTO fin_student_log(student_id,state) SELECT 's1', fin_student_state(extra_data) FROM students WHERE id='s1'; COMMIT;`);
            const row = (await pool.query("SELECT backfill, TO_CHAR(recorded_at AT TIME ZONE 'Asia/Tashkent','YYYY-MM-DD') AS d FROM fin_student_log WHERE state->>'frozenAt'='2026-09-11'")).rows[0];
            assert.equal(row.backfill, false); assert.equal(row.d, F.today());
            const v = await finance.verifySeals(pool);
            assert.equal(v.ok, false); assert.match(v.reason, /imzosiz/);
        });
        await t.test('round 9: forfeit only for a recorded dropout, not before the exit date, not back-dated before this month', async () => {
            await fresh(pool);
            const ev = async () => (await finance.storeEvidence(pool, admin, pdf())).url;
            const reason = 'Shartnoma 5.2-band: ketganda qaytarilmaydi';
            await assert.rejects(finance.forfeitContract(pool, admin, { paymentRecordId: 'r1', date: F.today(), reason, evidenceUrl: await ev() }), e => e.status === 409 && /faol/.test(e.message));
            await crmSql(`UPDATE students SET extra_data=extra_data || '{"status":"inactive"}'::jsonb WHERE id='s1'`);
            await assert.rejects(finance.forfeitContract(pool, admin, { paymentRecordId: 'r1', date: '2026-09-10', reason, evidenceUrl: await ev() }), e => e.status === 400);
            await finance.forfeitContract(pool, admin, { paymentRecordId: 'r1', date: F.today(), reason, evidenceUrl: await ev() });
            const o = await finance.overview(pool, admin, { start: F.monthOf(F.today()) + '-01', end: F.today(), scope: 'all', basis: 'accrual' });
            assert.ok(o.pnl.breakage > 0, 'pulsiz tugatish alohida qatorda');
            assert.equal(o.balance.balanced, true);
        });
        await t.test('round 9: deleting a student does not taint the same lead re-enrolled as a new student', async () => {
            await fresh(pool);
            await crmSql(`UPDATE students SET extra_data=extra_data || '{"leadRef":{"id":"l1"}}'::jsonb WHERE id='s1'`);
            await crmSql(`DELETE FROM students WHERE id='s1'; INSERT INTO students VALUES('s9','Ali','+998901112233','russian','g',NULL,30,'{"debtAmount":0,"leadRef":{"id":"l1"}}')`);
            await appSql('inflow', `INSERT INTO payment_records(id,source_key,lead_id,student_id,language,manager_id,paid_date,amount,method,receipt_url,form,debt_snapshot,snapshot,legacy_review,actor_id)
                VALUES('r9','k9','l1','s9','russian','m',CURRENT_DATE,1200000,'card','','full',0,'{"name":"Ali"}',FALSE,'system')`);
            const data = await finance.load(pool);
            const c9 = contractOf(data, 'r9');
            assert.equal(c9.inactive, false); assert.equal(c9.inactiveAt, null);
        });
        await t.test('round 9: a genuine duplicate can be confirmed by another person and stops blocking the close', async () => {
            await fresh(pool);
            await appSql('inflow', `INSERT INTO payment_records(id,source_key,lead_id,student_id,language,manager_id,paid_date,amount,method,receipt_url,form,debt_snapshot,snapshot,legacy_review,actor_id)
                VALUES('r2','k2','l1','s1','russian','m','2026-09-11',1000000,'card','','partial',0,'{"name":"Ali"}',TRUE,'acc')`);
            await assert.rejects(finance.confirmNotDuplicate(pool, acc, 'r2', { reason: 'Ikki teng bo‘lib to‘lash, shartnoma bo‘yicha' }), e => e.status === 403);
            await finance.confirmNotDuplicate(pool, acc2, 'r2', { reason: 'Ikki teng bo‘lib to‘lash, shartnoma bo‘yicha' });
            const data = await finance.load(pool);
            assert.equal(F.duplicateReceipts(data.receipts).length, 0);
            assert.ok(!finance.closeReadiness(data, '2026-09').some(i => /Takroriy/.test(i)));
            assert.equal((await finance.verifySeals(pool)).ok, true);
        });
        await t.test('round 9: director-approved late exit date reaches into a closed month as a prior-period adjustment', async () => {
            await fresh(pool);
            await finance.lockMonth(pool, admin, { month: '2026-09', override: true, note: 'Test: sentyabr yopildi (holat tuzatish)' });
            const sepBefore = (await finance.overview(pool, admin, { start: '2026-09-01', end: '2026-09-30', scope: 'all', basis: 'accrual' })).pnl.revenue;
            await crmSql(`UPDATE students SET extra_data=extra_data || '{"status":"inactive"}'::jsonb WHERE id='s1'`);
            const ev = (await finance.storeEvidence(pool, admin, pdf())).url;
            await assert.rejects(finance.correctStudentStatus(pool, acc, { studentId: 's1', kind: 'inactive', from: '2026-09-20', reason: 'Davomat: 20-sentyabrdan kelmagan', evidenceUrl: ev }), e => e.status === 403);
            await finance.correctStudentStatus(pool, admin, { studentId: 's1', kind: 'inactive', from: '2026-09-20', reason: 'Davomat: 20-sentyabrdan kelmagan', evidenceUrl: ev });
            const data = await finance.load(pool);
            assert.equal(contractOf(data, 'r1').inactiveAt, '2026-09-20');
            const sep = await finance.overview(pool, admin, { start: '2026-09-01', end: '2026-09-30', scope: 'all', basis: 'accrual' });
            assert.equal(sep.pnl.revenue, sepBefore, 'yopilgan oy nusxasi o‘zgarmaydi');
            const oct = await finance.overview(pool, admin, { start: '2026-10-01', end: '2026-10-31', scope: 'all', basis: 'accrual' });
            assert.ok(oct.pnl.prior_adjustments < 0, 'farq oktyabrda o‘tgan davr tuzatishi');
            assert.equal(oct.balance.balanced, true);
            assert.equal((await finance.verifySeals(pool)).ok, true);
        });
        await t.test('round 9: a student deleted and later restored by a stale save is reported', async () => {
            await fresh(pool);
            await crmSql(`DELETE FROM students WHERE id='s1'`);
            await crmSql(`INSERT INTO students VALUES('s1','Ali','+998901112233','russian','g',NULL,30,'{"debtAmount":0}')`);
            const o = await finance.overview(pool, admin, {});
            assert.equal(o.restoredStudents.length, 1);
            assert.equal((await finance.verifySeals(pool)).ok, true);
        });
        await t.test('round 10: a copied (replayed) app token does not make an outside write look legitimate', async () => {
            for (const [table, sql] of [
                ['fin_transactions', tok => `BEGIN; SELECT set_config('fin.ctx','${tok}',true); INSERT INTO fin_transactions(id,entity,txn_date,type,category_code,account_id,amount,counterparty,actor_id,actor_name) VALUES('fake1','common','2026-10-20','expense','ADMIN','acc-card',3000000,'Soxta','admin','Admin'); COMMIT;`],
                ['payment_records', tok => `BEGIN; SELECT set_config('fin.ctx','${tok}',true); INSERT INTO payment_records(id,source_key,language,paid_date,amount,method,form,snapshot,actor_id) VALUES('ghost2','ghost2','russian','2026-10-20',5000000,'card','full','{}','system'); COMMIT;`]]) {
                await fresh(pool);
                const tok = (await pool.query(table === 'fin_transactions' ? "SELECT ctx FROM fin_row_seals WHERE ctx LIKE 'fin:%' LIMIT 1" : "SELECT ctx FROM fin_row_seals WHERE ctx LIKE 'inflow:%' LIMIT 1")).rows[0].ctx;
                plainSql(sql(tok));
                const v = await finance.verifySeals(pool);
                assert.equal(v.ok, false, table); assert.match(v.reason, /imzo|auditida/);
            }
        });
        await t.test('round 10: a hand-inserted seal under a signed transaction id breaks that transaction signature', async () => {
            await fresh(pool);
            const last = (await pool.query('SELECT xid, row_hash FROM fin_row_seals ORDER BY seq DESC LIMIT 1')).rows[0];
            superSql('fin_transactions', `INSERT INTO fin_transactions(id,entity,txn_date,type,category_code,account_id,amount,counterparty,actor_id,actor_name) VALUES('fake2','common','2026-10-20','expense','ADMIN','acc-card',1,'x','admin','Admin')`);
            const v0 = await finance.verifySeals(pool); assert.equal(v0.ok, false);
            const bh = (await pool.query("SELECT encode(sha256(convert_to(fin_row_text('fin_transactions', to_jsonb(t)),'UTF8')),'hex') AS h FROM fin_transactions t WHERE id='fake2'")).rows[0].h;
            const rh = require('crypto').createHash('sha256').update(last.row_hash + '|fin_transactions|fake2|I|' + bh + '|').digest('hex');
            superSql('fin_row_seals', `INSERT INTO fin_row_seals(table_name,row_id,op,body_hash,prev_hash,row_hash,ctx,xid) VALUES('fin_transactions','fake2','I','${bh}','${last.row_hash}','${rh}',NULL,'${last.xid}')`);
            const v = await finance.verifySeals(pool);
            assert.equal(v.ok, false);
        });
        await t.test('round 10: leaving before a course starts (early renewal or correction) keeps the whole prepayment as a liability', async () => {
            await fresh(pool);
            await crmSql(`UPDATE students SET extra_data=extra_data || '{"status":"inactive"}'::jsonb WHERE id='s1'`);
            const ev = (await finance.storeEvidence(pool, admin, pdf())).url;
            await finance.correctStudentStatus(pool, admin, { studentId: 's1', kind: 'inactive', from: '2026-09-01', reason: 'To‘lagan, lekin birorta darsga kelmagan (davomat)', evidenceUrl: ev });
            const data = await finance.load(pool), c = contractOf(data, 'r1');
            assert.equal(c.inactiveAt, F.addDays(c.start, -1));
            assert.equal(F.earned(c, F.today()), 0);
            assert.equal((await finance.overview(pool, admin, {})).dropouts[0].liability, 1000000);
            // Engine: kurs boshlanishidan oldingi chiqish sanasi null bo'lib ketmaydi.
            const c2 = F.contracts({ ...data, studentStatus: [{ studentId: 's1', inactive: true, inactiveAt: '2026-09-01', approvedExit: true }], closedThrough: '' }).find(x => x.receipts.some(r => r.id === 'r1'));
            assert.equal(c2.inactiveAt, F.addDays(c2.start, -1));
        });
        await t.test('round 10: subject switch on the same lead does not hide the exit from the old course', async () => {
            await fresh(pool);
            await crmSql(`UPDATE students SET extra_data=extra_data || '{"leadRef":{"id":"l1"}}'::jsonb WHERE id='s1'`);
            await crmSql(`DELETE FROM students WHERE id='s1'; INSERT INTO students VALUES('s5','Ali','+998901112233','english','g',NULL,30,'{"debtAmount":0,"leadRef":{"id":"l1"}}')`);
            const data = await finance.load(pool), c = contractOf(data, 'r1');
            assert.equal(c.inactiveAt, F.today());
            assert.equal((await finance.overview(pool, admin, {})).dropouts.length, 1);
        });
        await t.test('round 10: a same-subject recreate is reported and can still be corrected to a real exit by the director', async () => {
            await fresh(pool);
            await crmSql(`UPDATE students SET extra_data=extra_data || '{"leadRef":{"id":"l1"}}'::jsonb WHERE id='s1'`);
            await crmSql(`DELETE FROM students WHERE id='s1'; INSERT INTO students VALUES('s9','Ali','+998901112233','russian','g',NULL,30,'{"debtAmount":0,"leadRef":{"id":"l1"}}')`);
            let o = await finance.overview(pool, admin, {});
            assert.equal(o.dropouts.length, 0); assert.ok(o.restoredStudents.some(r => r.studentId === 's1' && r.recreated));
            const ev = (await finance.storeEvidence(pool, admin, pdf())).url;
            await finance.correctStudentStatus(pool, admin, { studentId: 's1', kind: 'inactive', from: F.today(), reason: 'Yangi yozuv boshqa odam (aka-uka), Ali ketgan', evidenceUrl: ev });
            o = await finance.overview(pool, admin, {});
            assert.equal(o.dropouts.length, 1);
            await assert.rejects(finance.correctStudentStatus(pool, admin, { studentId: 'nobody', kind: 'freeze', from: '2026-10-01', to: '2026-10-05', reason: 'Mavjud bo‘lmagan o‘quvchi uchun', evidenceUrl: (await finance.storeEvidence(pool, admin, pdf())).url }), e => e.status === 404);
        });
        await t.test('round 10: an inactive student switched back to active by a later save is reported', async () => {
            await fresh(pool);
            await crmSql(`UPDATE students SET extra_data=extra_data || '{"status":"inactive"}'::jsonb WHERE id='s1'`);
            await crmSql(`UPDATE students SET extra_data=extra_data - 'status' WHERE id='s1'`);
            const o = await finance.overview(pool, admin, {});
            assert.ok(o.restoredStudents.some(r => r.studentId === 's1' && r.reactivated));
        });
        await t.test('round 11: a hidden trigger that piggybacks on app writes, a modified finance function or a disabled guard is detected', async () => {
            await fresh(pool);
            plainSql(`CREATE FUNCTION evil() RETURNS trigger AS $$ BEGIN INSERT INTO fin_transactions(id,entity,txn_date,type,category_code,account_id,amount,counterparty,actor_id,actor_name)
                VALUES('evil-' || NEW.id,'common','2026-10-20','expense','ADMIN','acc-card',7777777,'Ghost LLC','admin','Admin'); RETURN NEW; END $$ LANGUAGE plpgsql;
                CREATE TRIGGER zz_audit_hook AFTER INSERT ON fin_audit FOR EACH ROW EXECUTE FUNCTION evil();`);
            // Ilova o'zi yozmagan qatorni ko'radi va tranzaksiyani imzolamasdan bekor qiladi; tekshiruv ham triggerni ko'rsatadi.
            await assert.rejects(finance.createTransaction(pool, admin, { requestKey: 'r11-evil-0000000001', entity: 'common', type: 'expense', categoryCode: 'ADMIN', accountId: 'acc-card', amount: 10000, date: '2026-10-20', counterparty: 'Ofis' }), /FIN_TAMPER/);
            assert.equal((await pool.query("SELECT COUNT(*)::int AS n FROM fin_transactions WHERE id LIKE 'evil-%'")).rows[0].n, 0);
            let v = await finance.verifySeals(pool);
            assert.equal(v.ok, false); assert.match(v.reason, /kutilmagan trigger/);
            plainSql('DROP TRIGGER zz_audit_hook ON fin_audit; DROP FUNCTION evil();');
            v = await finance.verifySeals(pool); assert.equal(v.ok, false, 'ogohlantirish qotirilgan'); assert.equal(v.latched, true);
            await assert.rejects(finance.acknowledgeIntegrityAlarm(pool, acc, { note: 'Buxgalter yopa olmaydi, faqat rahbar' }), e => e.status === 403);
            const r1 = await finance.acknowledgeIntegrityAlarm(pool, admin, { note: 'Trigger olib tashlandi, server paroli almashtirildi' });
            assert.equal(r1.pending, true); assert.equal((await finance.verifySeals(pool)).ok, false, 'bitta kishi yopa olmaydi');
            await assert.rejects(finance.acknowledgeIntegrityAlarm(pool, admin, { note: 'Yana o‘sha rahbar tasdiqlashga urinadi' }), e => e.status === 403);
            await finance.acknowledgeIntegrityAlarm(pool, acc, { note: 'Ikkinchi xodim: tekshirildi, tasdiqlayman' });
            v = await finance.verifySeals(pool); assert.equal(v.ok, true, v.reason);
            await fresh(pool);
            plainSql(`CREATE OR REPLACE FUNCTION fin_reject_change() RETURNS trigger AS $$ BEGIN RETURN COALESCE(NEW, OLD); END $$ LANGUAGE plpgsql;`);
            v = await finance.verifySeals(pool); assert.equal(v.ok, false); assert.match(v.reason, /funksiya/);
            await fresh(pool);
            plainSql('ALTER TABLE fin_transactions DISABLE TRIGGER fin_immutable_fin_transactions');
            v = await finance.verifySeals(pool); assert.equal(v.ok, false); assert.match(v.reason, /o‘chirilgan/);
        });
        await t.test('round 11: cutting off the newest entries is detected (server cache and offline certificate)', async () => {
            await fresh(pool);
            const cert = await finance.integrityCertificate(pool, admin);
            assert.equal(cert.integrity, true);
            assert.equal((await finance.verifyCertificate(pool, admin, cert)).ok, true);
            assert.equal((await finance.verifyCertificate(pool, admin, { ...cert, sealSeq: cert.sealSeq + 1 })).ok, false, 'soxta sertifikat');
            const drop = () => plainSql(`SET session_replication_role = replica;
                DELETE FROM fin_transactions WHERE request_key='int-test-key-0000001';
                DELETE FROM fin_row_seals WHERE seq >= (SELECT MIN(seq) FROM fin_row_seals WHERE row_id IN (SELECT entity_id FROM fin_audit WHERE action='transaction-create'));
                DELETE FROM fin_tx_signatures WHERE xid IN (SELECT xid FROM fin_audit WHERE action='transaction-create');
                DELETE FROM fin_checkpoints; DELETE FROM fin_audit WHERE action='transaction-create';`);
            drop();
            const v = await finance.verifySeals(pool);
            assert.equal(v.ok, false); assert.match(v.reason, /yo‘qolgan|o‘chirilgan/);
            assert.equal((await finance.verifyCertificate(pool, admin, cert)).ok, false);
        });
        await t.test('round 12: a trigger on an unmonitored table (payment_audit) adding a ghost receipt makes the app refuse to commit', async () => {
            await fresh(pool);
            const ev = (await finance.storeEvidence(pool, admin, pdf())).url;
            plainSql(`CREATE FUNCTION ghost() RETURNS trigger AS $$ BEGIN INSERT INTO payment_records(id,source_key,language,paid_date,amount,method,form,snapshot,actor_id)
                VALUES('ghost-' || NEW.record_id,'ghost-' || NEW.record_id,'russian','2026-10-20',5000000,'card','full','{}','system'); RETURN NEW; END $$ LANGUAGE plpgsql;
                CREATE TRIGGER zz_ghost AFTER INSERT ON payment_audit FOR EACH ROW EXECUTE FUNCTION ghost();`);
            await assert.rejects(finance.manualReceipt(pool, admin, { requestKey: 'r12-ghost-000000001', entity: 'russian', date: '2026-10-20', amount: 300000, method: 'cash', studentId: 's1',
                reason: 'Hujjat asosida kiritildi', evidenceUrl: ev }), /FIN_TAMPER/);
            assert.equal((await pool.query("SELECT COUNT(*)::int AS n FROM payment_records WHERE id LIKE 'ghost-%'")).rows[0].n, 0);
        });
        await t.test('round 12: an expected trigger name pointing to a same-named function in another schema is detected and its value change is refused', async () => {
            await fresh(pool);
            plainSql(`CREATE SCHEMA evil; CREATE FUNCTION evil.fin_guard_fin_transactions() RETURNS trigger AS $$ BEGIN NEW.amount := NEW.amount * 10; RETURN NEW; END $$ LANGUAGE plpgsql;
                DROP TRIGGER fin_guard_fin_transactions ON fin_transactions;
                CREATE TRIGGER fin_guard_fin_transactions BEFORE INSERT ON fin_transactions FOR EACH ROW EXECUTE FUNCTION evil.fin_guard_fin_transactions();`);
            let v = await finance.verifySeals(pool);
            assert.equal(v.ok, false); assert.match(v.reason, /boshqa sxema|o‘zgartirilgan/);
            await assert.rejects(finance.createTransaction(pool, admin, { requestKey: 'r12-schema-00000001', entity: 'common', type: 'expense', categoryCode: 'ADMIN', accountId: 'acc-card', amount: 50000, date: '2026-10-20', counterparty: 'Ofis' }), /FIN_TAMPER/);
            plainSql('DROP SCHEMA evil CASCADE');
        });
        await t.test('round 12: a re-created guard trigger with different events is detected by the signed trigger fingerprint', async () => {
            await fresh(pool);
            plainSql(`DROP TRIGGER fin_immutable_fin_transactions ON fin_transactions;
                CREATE TRIGGER fin_immutable_fin_transactions BEFORE DELETE ON fin_transactions FOR EACH ROW EXECUTE FUNCTION fin_reject_change();`);
            const v = await finance.verifySeals(pool);
            assert.equal(v.ok, false); assert.match(v.reason, /trigger/);
        });
        await t.test('round 12: search_path shadowing of built-ins cannot hide an edit made with triggers disabled', async () => {
            await fresh(pool);
            plainSql(`CREATE SCHEMA shadow; CREATE FUNCTION shadow.convert_to(text, name) RETURNS bytea AS $$ SELECT pg_catalog.convert_to(replace($1, '"amount": 1,', '"amount": 100000,'), $2) $$ LANGUAGE sql;
                ALTER DATABASE ${new URL(url).pathname.slice(1)} SET search_path = shadow, public;`);
            superSql('fin_transactions', "UPDATE fin_transactions SET amount=1 WHERE request_key='int-test-key-0000001'");
            const v = await finance.verifySeals(pool);
            plainSql(`ALTER DATABASE ${new URL(url).pathname.slice(1)} RESET search_path; DROP SCHEMA shadow CASCADE;`);
            assert.equal(v.ok, false);
        });
        await t.test('round 12: deleting the newest entries together with the newest checkpoint is caught by the server-disk head; the alarm stays red', async () => {
            await fresh(pool);
            await finance.createTransaction(pool, admin, { requestKey: 'r12-trunc-000000001', entity: 'common', type: 'expense', categoryCode: 'ADMIN', accountId: 'acc-card', amount: 20000, date: '2026-10-20', counterparty: 'Ofis' });
            // Yangi jarayon (kesh yo'q) holatini sinash uchun: faqat diskdagi zanjir boshi qoladi.
            plainSql(`SET session_replication_role = replica;
                DELETE FROM fin_transactions WHERE request_key='r12-trunc-000000001';
                DELETE FROM fin_row_seals WHERE row_id IN (SELECT entity_id FROM fin_audit WHERE action='transaction-create' AND after_data->>'counterparty'='Ofis' AND (after_data->>'amount')::int=20000);
                DELETE FROM fin_tx_signatures WHERE xid IN (SELECT xid FROM fin_audit WHERE (after_data->>'amount')::int=20000);
                DELETE FROM fin_checkpoints WHERE id = (SELECT MAX(id) FROM fin_checkpoints);
                DELETE FROM fin_audit WHERE (after_data->>'amount')::int=20000;`);
            const v1 = await finance.verifySeals(pool), v2 = await finance.verifySeals(pool);
            assert.equal(v1.ok, false); assert.equal(v2.ok, false, 'ikkinchi o‘qishda ham qizil');
            assert.equal((await finance.overview(pool, admin, {})).seals.ok, false);
        });
        await t.test('round 12: expense service period before the books start keeps the balance sheet balanced; a bill cannot be paid before its issue date', async () => {
            await fresh(pool);
            await finance.saveAccount(pool, admin, { id: 'acc-bank', name: 'Bank', kind: 'bank', entity: 'common', methods: ['bank'], openingBalance: 10000000, openingDate: '2026-09-01' });
            await finance.createTransaction(pool, admin, { requestKey: 'r12-rent-0000000001', entity: 'common', type: 'expense', categoryCode: 'RENT', accountId: 'acc-bank', amount: 3100000, date: '2026-09-05',
                counterparty: 'Ijara', serviceStart: '2026-08-01', serviceEnd: '2026-08-31', receiptUrl: (await finance.storeEvidence(pool, admin, pdf())).url });
            const o = await finance.overview(pool, admin, { start: '2026-09-01', end: '2026-09-30', scope: 'all', basis: 'accrual' });
            assert.equal(o.balance.balanced, true, String(o.balance.imbalance));
            const bill = await finance.createPayable(pool, admin, { requestKey: 'r12-bill-0000000001', kind: 'bill', entity: 'common', counterparty: 'Ijara', categoryCode: 'RENT', amount: 500000, issueDate: '2026-10-10' });
            // Kech kelgan hisob-faktura (sentyabr ijarasi oktyabrda): xizmat davrida hisoblangan majburiyat, balans teng.
            await finance.createPayable(pool, admin, { requestKey: 'r13-latebill-0000001', kind: 'bill', entity: 'common', counterparty: 'Ijara', categoryCode: 'RENT', amount: 3000000, issueDate: '2026-10-20',
                serviceStart: '2026-09-01', serviceEnd: '2026-09-30', documentUrl: (await finance.storeEvidence(pool, admin, pdf())).url });
            for (const end of ['2026-09-30', '2026-10-15', '2026-10-31']) {
                const b = (await finance.overview(pool, admin, { start: '2026-09-01', end, scope: 'all', basis: 'accrual' })).balance;
                assert.equal(b.balanced, true, end + ' ' + b.imbalance);
            }
            await assert.rejects(finance.createTransaction(pool, admin, { requestKey: 'r12-billpay-00000001', entity: 'common', type: 'expense', categoryCode: 'RENT', accountId: 'acc-bank', amount: 500000, date: '2026-10-05', payableId: bill.id, counterparty: 'Ijara' }), e => e.status === 400);
        });
        // Ilova tranzaksiya o'ramining o'zi (maosh bo'limi kabi): kuzatish + belgi + imzo.
        const appTx = async (prefix, fn) => {
            const fc = require('../server/services/finCtx'), db = await pool.connect(), untrack = fc.track(db);
            try { await db.query('BEGIN'); await db.query("SELECT set_config('fin.ctx', $1, true)", [fc.token(prefix)]); await fn(db); await fc.signTx(db); await db.query('COMMIT'); fc.commitHead(db); }
            catch (e) { await db.query('ROLLBACK'); throw e; } finally { untrack(); db.release(); }
        };
        const accrue = (db, id, emp, amount) => db.query(`INSERT INTO salary_transactions(id,employee_id,language,period_start,period_end,amount,status)
            VALUES($1,$2,$3,$4,$5,$6,'unpaid') ON CONFLICT(employee_id,period_start,period_end) DO UPDATE SET amount=EXCLUDED.amount WHERE salary_transactions.status='unpaid'`, [id, emp, 'russian', '2026-10-01', '2026-10-31', amount]);
        await t.test('round 13: payroll-style upsert and mark-paid pass; a hidden trigger changing another accrual in the same transaction is refused', async () => {
            await fresh(pool);
            plainSql("CREATE UNIQUE INDEX sal_period ON salary_transactions(employee_id,period_start,period_end); INSERT INTO hr_employees(id,name,role,lang,login,status) VALUES('t2','Ustoz 2','rus-oqituvchi','russian','t2','active')");
            await appTx('payroll', async db => { await accrue(db, 'oct1', 't1', 2000000); await accrue(db, 'oct2', 't2', 2000000); });
            await appTx('payroll', async db => { await accrue(db, 'oct1x', 't1', 2100000); });
            await appTx('payroll', async db => { await db.query("UPDATE salary_transactions SET status='paid',paid_at=NOW() WHERE id=$1", ['oct1']); });
            assert.equal((await finance.verifySeals(pool)).ok, true);
            assert.equal((await pool.query("SELECT amount FROM salary_transactions WHERE id='oct1'")).rows[0].amount, '2100000');
            plainSql(`CREATE TABLE side_log(x TEXT); CREATE FUNCTION bump() RETURNS trigger AS $$ BEGIN UPDATE salary_transactions SET amount=amount*5 WHERE id='oct2'; RETURN NEW; END $$ LANGUAGE plpgsql;
                CREATE TRIGGER zz_bump AFTER INSERT ON side_log FOR EACH ROW EXECUTE FUNCTION bump();`);
            // Maosh bo'limi ishi to'xtatilmaydi, lekin tranzaksiya imzolanmaydi va qotiriladigan ogohlantirish chiqadi.
            await appTx('payroll', async db => { await db.query("INSERT INTO side_log VALUES('x')"); await db.query("UPDATE salary_transactions SET status='paid',paid_at=NOW() WHERE id=$1", ['oct1']); });
            const v = await finance.verifySeals(pool); assert.equal(v.ok, false);
            assert.match(require('../server/services/finCtx').readAlarm().reason, /trigger|o‘zgartirmagan/);
            await assert.rejects(finance.createTransaction(pool, admin, { requestKey: 'r13-fin-0000000001', entity: 'common', type: 'expense', categoryCode: 'ADMIN', accountId: 'acc-card', amount: 1000, date: '2026-10-20', counterparty: 'x' }), /FIN_TAMPER/, 'moliya amali qat’iy');
        });
        await t.test('round 13: a hidden trigger marking a different student inactive during a CRM save is refused', async () => {
            await fresh(pool);
            plainSql(`INSERT INTO students VALUES('s2','Vali','+998907770000','russian','g',NULL,30,'{"debtAmount":0}');
                CREATE TABLE side_log(x TEXT); CREATE FUNCTION drop1() RETURNS trigger AS $$ BEGIN UPDATE students SET extra_data=extra_data || '{"status":"inactive"}'::jsonb WHERE id='s1'; RETURN NEW; END $$ LANGUAGE plpgsql;
                CREATE TRIGGER zz_drop AFTER INSERT ON side_log FOR EACH ROW EXECUTE FUNCTION drop1();`);
            await appTx('crm', async db => { await db.query("INSERT INTO side_log VALUES('x')"); await db.query("UPDATE students SET extra_data=extra_data || '{\"frozen\":true}'::jsonb WHERE id=$1", ['s2']); });
            assert.equal((await finance.verifySeals(pool)).ok, false); assert.ok(require('../server/services/finCtx').readAlarm(), 'ogohlantirish qotirildi');
        });
        await t.test('round 13: a changed column default is caught by the signed fingerprint', async () => {
            await fresh(pool);
            plainSql("ALTER TABLE fin_transactions ALTER COLUMN salary_id SET DEFAULT 'sal1'");
            const v = await finance.verifySeals(pool); assert.equal(v.ok, false); assert.match(v.reason, /o‘zgartirilgan/);
        });
        await t.test('round 13: after the newest transaction is deleted, a later legitimate write does not paper over it', async () => {
            await fresh(pool);
            await finance.createTransaction(pool, admin, { requestKey: 'r13-trunc-000000001', entity: 'common', type: 'expense', categoryCode: 'ADMIN', accountId: 'acc-card', amount: 30000, date: '2026-10-20', counterparty: 'Ofis' });
            plainSql(`SET session_replication_role = replica;
                DELETE FROM fin_row_seals WHERE xid IN (SELECT xid FROM fin_audit WHERE (after_data->>'amount')::int=30000);
                DELETE FROM fin_tx_signatures WHERE xid IN (SELECT xid FROM fin_audit WHERE (after_data->>'amount')::int=30000);
                DELETE FROM fin_checkpoints WHERE id = (SELECT MAX(id) FROM fin_checkpoints);
                DELETE FROM fin_transactions WHERE request_key='r13-trunc-000000001';
                DELETE FROM fin_audit WHERE (after_data->>'amount')::int=30000;`);
            // Yangi jarayon: keshlar bo'sh, faqat diskdagi zanjir boshi qoladi.
            for (const k of Object.keys(require.cache)) if (/server[\\/]services[\\/]finance\.js$/.test(k)) delete require.cache[k];
            const f2 = require('../server/services/finance');
            await f2.createTransaction(pool, admin, { requestKey: 'r13-after-000000001', entity: 'common', type: 'expense', categoryCode: 'ADMIN', accountId: 'acc-card', amount: 40000, date: '2026-10-21', counterparty: 'Ofis' }).catch(() => {});
            const v = await f2.verifySeals(pool);
            assert.equal(v.ok, false, 'kesish yashirilmadi');
        });
        await t.test('round 13: a session temp table cannot shadow the period guard', async () => {
            await fresh(pool);
            await finance.lockMonth(pool, admin, { month: '2026-09', override: true, note: 'Test: sentyabr yopildi (temp jadval)' });
            const db = await pool.connect();
            try {
                await db.query('CREATE TEMP TABLE fin_period_locks(month TEXT, locked_at TIMESTAMPTZ)');
                const fc = require('../server/services/finCtx'), untrack = fc.track(db);
                try {
                    await db.query('BEGIN'); await db.query("SELECT set_config('fin.ctx', $1, true), set_config('search_path', 'public, pg_temp', true)", [fc.token('fin')]);
                    await assert.rejects(db.query(`INSERT INTO fin_transactions(id,entity,txn_date,type,category_code,account_id,amount,counterparty,actor_id,actor_name) VALUES('tmp1','common','2026-09-15','expense','ADMIN','acc-card',1000,'x','admin','Admin')`), /yopilgan/);
                    await db.query('ROLLBACK');
                } finally { untrack(); }
            } finally { await db.query('DROP TABLE IF EXISTS pg_temp.fin_period_locks').catch(() => {}); db.release(); }
        });
        await t.test('round 14: any trigger present during an app write (BEFORE UPDATE/INSERT rewrite, earlier-firing override, row-swallowing) blocks the commit', async () => {
            const cases = [
                `CREATE FUNCTION t1() RETURNS trigger AS $$ BEGIN NEW.extra_data := NEW.extra_data || '{"status":"inactive","debtAmount":50000000}'::jsonb; RETURN NEW; END $$ LANGUAGE plpgsql;
                 CREATE TRIGGER a_rewrite BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION t1();`,
                `CREATE FUNCTION t2() RETURNS trigger AS $$ BEGIN RETURN NULL; END $$ LANGUAGE plpgsql;
                 CREATE TRIGGER a_swallow BEFORE INSERT ON fin_transactions FOR EACH ROW EXECUTE FUNCTION t2();`,
                `CREATE FUNCTION t3() RETURNS trigger AS $$ BEGIN NEW.account_id := 'acc-cash'; RETURN NEW; END $$ LANGUAGE plpgsql;
                 CREATE TRIGGER a_zz BEFORE INSERT ON payment_records FOR EACH ROW EXECUTE FUNCTION t3();`];
            for (const sql of cases) {
                await fresh(pool);
                plainSql(sql);
                await appTx('crm', async db => { await db.query("UPDATE students SET extra_data=extra_data || $2::jsonb WHERE id=$1", ['s1', JSON.stringify({ debtAmount: 1500000 })]); });
                assert.ok(require('../server/services/finCtx').readAlarm(), 'CRM amali bajarildi, ogohlantirish qotirildi');
                await assert.rejects(finance.createTransaction(pool, admin, { requestKey: 'r14-' + Math.random().toString(36).slice(2, 12) + '-k', entity: 'common', type: 'expense', categoryCode: 'ADMIN', accountId: 'acc-card', amount: 1000, date: '2026-10-20', counterparty: 'x' }), /FIN_TAMPER/);
            }
        });
        await t.test('round 14: without any trigger, a legitimate jsonb-merge update and a bulk student save pass the intent check', async () => {
            await fresh(pool);
            await appTx('crm', async db => { await db.query("UPDATE students SET extra_data=extra_data || $2::jsonb WHERE id=$1", ['s1', JSON.stringify({ debtAmount: 0, paymentDueDate: '2026-11-01' })]); });
            await appTx('crm', async db => {
                const rows = (await db.query('SELECT * FROM students')).rows;
                await db.query('DELETE FROM students');
                for (const r of rows) await db.query('INSERT INTO students (id,name,phone,subject,group_name,teacher_id,lesson_duration,extra_data) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [r.id, r.name, r.phone, r.subject, r.group_name, r.teacher_id, r.lesson_duration, JSON.stringify({ ...r.extra_data, frozen: r.id === 's1' })]);
            });
            assert.equal((await finance.verifySeals(pool)).ok, true);
            assert.equal((await finance.load(pool)).studentFreezes.length, 1);
        });
        await t.test('round 14: a shadow table in another schema or a role-level search_path is flagged, and app writes still land in the real table', async () => {
            await fresh(pool);
            plainSql('CREATE SCHEMA postgres; CREATE TABLE postgres.payment_records (LIKE public.payment_records INCLUDING ALL);');
            let v = await finance.verifySeals(pool); assert.equal(v.ok, false); assert.match(v.reason, /soya/);
            await assert.rejects(finance.createTransaction(pool, admin, { requestKey: 'r14-shadow-00000001', entity: 'common', type: 'expense', categoryCode: 'ADMIN', accountId: 'acc-card', amount: 1000, date: '2026-10-20', counterparty: 'x' }), /FIN_TAMPER/);
            plainSql('DROP SCHEMA postgres CASCADE');
            await fresh(pool);
            plainSql('ALTER ROLE postgres SET search_path = shadow, public');
            try { v = await finance.verifySeals(pool); } finally { plainSql('ALTER ROLE postgres RESET search_path'); }
            assert.equal(v.ok, false); assert.match(v.reason, /search_path/);
        });
        await t.test('round 14: salary paid before its accrual date is an advance (balance sheet balances); no movement before an account opens', async () => {
            await fresh(pool);
            plainSql("CREATE UNIQUE INDEX IF NOT EXISTS sal_period ON salary_transactions(employee_id,period_start,period_end)");
            await appTx('payroll', async db => { await db.query("INSERT INTO salary_transactions(id,employee_id,language,period_start,period_end,amount,status,paid_at) VALUES($1,$2,$3,$4,$5,$6,'paid',NOW())", ['jul', 't1', 'russian', '2026-10-01', '2026-10-31', 900000]); });
            await finance.createTransaction(pool, admin, { requestKey: 'r14-cap-0000000001', entity: 'common', type: 'capital', categoryCode: 'OWNER_IN', accountId: 'acc-card', amount: 5000000, date: '2026-10-01', counterparty: 'Ta’sischi' });
            await finance.recordSalaryPayment(pool, admin, 'jul', { accountId: 'acc-card', date: '2026-10-24', receiptUrl: (await finance.storeEvidence(pool, admin, pdf())).url });
            for (const end of ['2026-10-24', '2026-10-25', '2026-10-31']) {
                const b = (await finance.overview(pool, admin, { start: '2026-10-01', end, scope: 'all', basis: 'accrual' })).balance;
                assert.equal(b.balanced, true, end + ' ' + b.imbalance);
            }
            await finance.saveAccount(pool, admin, { id: 'acc-bank', name: 'Bank', kind: 'bank', entity: 'common', methods: ['bank'], openingBalance: 0, openingDate: '2026-10-25' });
            await assert.rejects(finance.createTransaction(pool, admin, { requestKey: 'r14-pre-0000000001', entity: 'common', type: 'transfer', categoryCode: 'TRANSFER', accountId: 'acc-card', toAccountId: 'acc-bank', amount: 700000, date: '2026-10-20' }), e => e.status === 400 && /ochilgan/.test(e.message));
        });
        await t.test('round 15: user-defined function overloads, casts, collations and rules anywhere are detected and block app writes', async () => {
            for (const [sql, undo] of [
                [`CREATE FUNCTION public.to_char(date, text) RETURNS text AS $$ SELECT pg_catalog.to_char($1::timestamp - interval '40 days', $2) $$ LANGUAGE sql;`, 'DROP FUNCTION public.to_char(date, text)'],
                [`CREATE FUNCTION evil_int(text) RETURNS bigint AS $$ SELECT 1000000::bigint $$ LANGUAGE sql; CREATE CAST (text AS bigint) WITH FUNCTION evil_int(text);`, 'DROP CAST (text AS bigint); DROP FUNCTION evil_int(text)'],
                [`CREATE COLLATION evil_coll (provider = icu, locale = 'und', deterministic = false);`, 'DROP COLLATION evil_coll'],
                [`CREATE RULE evil_rule AS ON INSERT TO json_data DO ALSO UPDATE students SET name = name;`, 'DROP RULE evil_rule ON json_data']]) {
                await fresh(pool);
                plainSql(sql);
                const v = await finance.verifySeals(pool);
                assert.equal(v.ok, false, sql.slice(0, 40)); 
                await assert.rejects(finance.createTransaction(pool, admin, { requestKey: 'r15-' + Math.random().toString(36).slice(2, 12) + '-k', entity: 'common', type: 'expense', categoryCode: 'ADMIN', accountId: 'acc-card', amount: 1000, date: '2026-10-20', counterparty: 'x' }), /FIN_TAMPER/);
                plainSql(undo);
            }
        });
        await t.test('round 15: an early-morning receipt time written by the app is not a false alarm when the database runs in UTC', async () => {
            await fresh(pool);
            await appTx('inflow', async db => {
                await db.query("SET LOCAL timezone = 'UTC'");
                await db.query(`INSERT INTO payment_records(id,source_key,lead_id,student_id,language,manager_id,paid_date,paid_at,amount,method,receipt_url,form,debt_snapshot,snapshot,legacy_review,actor_id)
                    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, ['rtz', 'ktz', 'l1', 's1', 'russian', 'm', '2026-10-20', '2026-10-20T01:30:00+05:00', 500000, 'card', '', 'partial', 0, JSON.stringify({ name: 'Ali' }), false, 'system']);
            });
            assert.equal((await finance.verifySeals(pool)).ok, true);
        });
        await t.test('segment cash flow: english + russian + common equals consolidated, line by line', async () => {
            await fresh(pool);
            const o = await finance.overview(pool, admin, { start: '2026-09-01', end: '2026-10-31', scope: 'all' });
            assert.equal(o.cashflowSegments.reconciled, true);
            assert.equal(o.cashflowSegments.totals.total, o.cashflow.netChange);
            assert.ok(o.cashflowSegments.totals.common < 0 && o.cashflowSegments.totals.russian > 0);
        });
    } finally { await pool.end(); }
});
