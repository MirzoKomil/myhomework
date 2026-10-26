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
        INSERT INTO users VALUES('admin','Admin','admin','admin',''),('acc','Buxgalter','acc','accountant',''),('acc2','Buxgalter 2','acc2','accountant','');
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
            plainSql(`BEGIN; SELECT set_config('fin.ctx','crm:test-del',true), set_config('app.user_id','rop1',true);
                INSERT INTO students VALUES('s2','Vali','+998907770000','english','g',NULL,30,'{"debtAmount":0}');
                DELETE FROM students; INSERT INTO students VALUES('s2','Vali','+998907770000','english','g',NULL,30,'{"debtAmount":0}'); COMMIT;`);
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
            plainSql(`BEGIN; SELECT set_config('fin.ctx','crm:test-del',true); DELETE FROM students WHERE id='s1'; COMMIT;`);
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
            plainSql(`BEGIN; SELECT set_config('fin.ctx','crm:test-fr',true); UPDATE students SET extra_data=extra_data || '{"frozen":true,"frozenAt":"2026-09-12"}'::jsonb WHERE id='s1'; COMMIT;`);
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
            appSql('inflow', `INSERT INTO payment_records(id,source_key,lead_id,student_id,language,manager_id,paid_date,amount,method,receipt_url,form,debt_snapshot,snapshot,legacy_review,actor_id)
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
        await t.test('segment cash flow: english + russian + common equals consolidated, line by line', async () => {
            await fresh(pool);
            const o = await finance.overview(pool, admin, { start: '2026-09-01', end: '2026-10-31', scope: 'all' });
            assert.equal(o.cashflowSegments.reconciled, true);
            assert.equal(o.cashflowSegments.totals.total, o.cashflow.netChange);
            assert.ok(o.cashflowSegments.totals.common < 0 && o.cashflowSegments.totals.russian > 0);
        });
    } finally { await pool.end(); }
});
