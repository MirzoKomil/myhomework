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
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url && (new URL(url).hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(new URL(url).pathname))) throw Error('Only disposable test DB allowed');

// Oddiy SQL (triggerlar yoqilgan, ilova belgisi yo'q) — alohida psql sessiyasida.
const plainSql = sql => execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], { encoding: 'utf8' });
// Superuser triggerlarni o'chirib yashirin o'zgartirish.
const superSql = (table, sql) => plainSql(`ALTER TABLE ${table} DISABLE TRIGGER USER; ${sql}; ALTER TABLE ${table} ENABLE TRIGGER USER;`);
const appSql = (app, sql) => plainSql(`BEGIN; SELECT set_config('fin.ctx', '${app}:test-' || md5(random()::text), true); ${sql}; COMMIT;`);

async function fresh(pool) {
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
        INSERT INTO users VALUES('admin','Admin','admin','admin','');
        INSERT INTO hr_employees(id,name,role,lang,login,status) VALUES('t1','Ustoz','rus-oqituvchi','russian','t1','active');
        INSERT INTO students VALUES('s1','Ali','+998901112233','russian','g',NULL,30,'{"debtAmount":0}');
        INSERT INTO salary_transactions VALUES('sal1','t1','russian','2026-09-01','2026-09-30',900000,'paid',NOW(),NULL);`);
    await inflow.initSchema(pool); await cash.initSchema(pool); await finance.initSchema(pool);
    appSql('inflow', `INSERT INTO payment_records(id,source_key,lead_id,student_id,language,manager_id,paid_date,amount,method,receipt_url,form,debt_snapshot,snapshot,legacy_review,actor_id)
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
