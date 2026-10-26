// Server kaliti (FIN_SEAL_KEY) deploylar orasida o'zgarsa: moliya ishlatilmagan bo'lsa — bir martalik qabul, ishlatilgan bo'lsa — ogohlantirish.
// Ishga tushirish: PAYROLL_TEST_DATABASE_URL=postgres://...@127.0.0.1/payroll_test_xxx node --test scripts/finance-rekey-postgres.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url && (new URL(url).hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(new URL(url).pathname))) throw Error('Only disposable test DB allowed');
const root = path.join(__dirname, '..');
const psql = sql => execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], { encoding: 'utf8' });

// Har bir "deploy" alohida jarayon: kalit modul yuklanganda o'qiladi.
function run(key, dataDir, body) {
    const code = `const {Pool}=require('pg');const inflow=require('./server/services/inflow'),cash=require('./server/services/paymentCash'),finance=require('./server/services/finance');
        const pool=new Pool({connectionString:process.env.PAYROLL_TEST_DATABASE_URL});
        (async()=>{ ${body} })().then(r=>{process.stdout.write('\\nRESULT:'+JSON.stringify(r??null));return pool.end();}).catch(e=>{process.stdout.write('\\nRESULT:'+JSON.stringify({error:e.message}));return pool.end();});`;
    const out = execFileSync(process.execPath, ['-e', code], { cwd: root, encoding: 'utf8', env: { ...process.env, FIN_SEAL_KEY: key, DATA_DIR: dataDir } });
    return JSON.parse(out.split('\nRESULT:').pop());
}
const boot = 'await inflow.initSchema(pool); await cash.initSchema(pool); await finance.initSchema(pool);';
const verify = 'const v = await finance.verifySeals(pool); return { ok: v.ok, table: v.table, reason: v.reason };';

function fresh() {
    psql(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
        CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,avatar TEXT);
        CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,role TEXT,lang TEXT,login TEXT,department TEXT,status TEXT,start_date TEXT,join_date TEXT);
        CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
        CREATE TABLE teachers(id TEXT PRIMARY KEY,name TEXT);
        CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,group_name TEXT,teacher_id TEXT,lesson_duration INTEGER,extra_data JSONB);
        CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,manager_id TEXT,status TEXT,language TEXT,deleted_at TIMESTAMPTZ,extra_data JSONB,comments TEXT DEFAULT '[]',updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE payments(id TEXT PRIMARY KEY,student_id TEXT,paid INTEGER,debt INTEGER,date TEXT);
        CREATE TABLE json_data(key TEXT PRIMARY KEY,data JSONB);
        CREATE TABLE salary_transactions(id TEXT PRIMARY KEY,employee_id TEXT,language TEXT,period_start DATE,period_end DATE,amount BIGINT,status TEXT,paid_at TIMESTAMPTZ,cash_expense_id TEXT);
        INSERT INTO users VALUES('admin','Admin','admin','admin','');
        INSERT INTO students VALUES('s1','Ali','+998901112233','russian','g',NULL,30,'{"debtAmount":0}');`);
    return fs.mkdtempSync(path.join(os.tmpdir(), 'finance-rekey-'));
}

test('key change before finance is used: adopted once, tampering still detected', { skip: !url }, () => {
    const dir = fresh();
    run('key-A', dir, boot);
    assert.equal(run('key-A', dir, verify).ok, true, 'birinchi kalit');
    assert.equal(run('key-B', dir, verify).ok, false, 'yangi kalit bilan eski iz tekshirilmaydi (prod holati)');
    run('key-B', dir, boot);
    assert.deepEqual(run('key-B', dir, verify), { ok: true }, 'qayta ishga tushganda qabul qilinadi');
    assert.match(psql('SELECT note FROM fin_adoptions ORDER BY id DESC LIMIT 1'), /Server kaliti o‘zgargan/);
    run('key-B', dir, boot);
    assert.equal(Number(psql("SELECT count(*) FROM fin_adoptions WHERE note LIKE 'Server kaliti%'")), 1, 'kalit o‘zgarmasa yana qabul qilinmaydi');
    psql("UPDATE fin_accounts SET methods='{cash,card}' WHERE id='acc-cash'");
    const r = run('key-B', dir, verify);
    assert.equal(r.ok, false); assert.equal(r.table, 'fin_accounts');
});

test('key change after finance is used: no automatic adoption, alarm names the key change', { skip: !url }, () => {
    const dir = fresh();
    run('key-A', dir, boot + ` await finance.createTransaction(pool, { id: 'admin' }, { requestKey: 'rekey-test-key-00001', entity: 'common', type: 'expense', categoryCode: 'SOFTWARE', accountId: 'acc-card', amount: 100000, date: '2026-09-12', counterparty: 'Hosting' });`);
    assert.equal(run('key-A', dir, verify).ok, true);
    run('key-B', dir, boot);
    assert.equal(Number(psql("SELECT count(*) FROM fin_adoptions WHERE note LIKE 'Server kaliti%'")), 0);
    const r = run('key-B', dir, verify);
    assert.equal(r.ok, false);
    assert.match(r.reason, /server kaliti \(FIN_SEAL_KEY\) o‘zgargan/);
});
