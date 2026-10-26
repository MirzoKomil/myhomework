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
                assert.equal(v.ok, false, table); assert.match(v.reason, /imzo/);
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
        await t.test('segment cash flow: english + russian + common equals consolidated, line by line', async () => {
            await fresh(pool);
            const o = await finance.overview(pool, admin, { start: '2026-09-01', end: '2026-10-31', scope: 'all' });
            assert.equal(o.cashflowSegments.reconciled, true);
            assert.equal(o.cashflowSegments.totals.total, o.cashflow.netChange);
            assert.ok(o.cashflowSegments.totals.common < 0 && o.cashflowSegments.totals.russian > 0);
        });
    } finally { await pool.end(); }
});
