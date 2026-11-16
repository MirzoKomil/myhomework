// SMS xarajati → Moliya: Eskiz balansidan yechilgan summa har kuni bitta avtomatik xarajat bo'lib yoziladi.
// Ishga tushirish: PAYROLL_TEST_DATABASE_URL=postgres://...@127.0.0.1/payroll_test_xxx node --test scripts/eskiz-finance-postgres.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Pool } = require('pg');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url && (new URL(url).hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(new URL(url).pathname))) throw Error('Only disposable test DB allowed');

test('Eskiz SMS expense flows into finance', { skip: !url }, async t => {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'eskiz-fin-'));
    fs.mkdirSync(path.join(process.env.DATA_DIR, 'uploads'));
    const eskiz = require('../server/services/eskiz');
    let live = 100000, fail = false; const alerts = [];
    // Telegram ogohlantirishi (bot + asosiy baza) testda soxta.
    const lsPath = require.resolve('../server/services/leadStageSms');
    require.cache[lsPath] = { id: lsPath, filename: lsPath, loaded: true, exports: { alertAdmin: async (kind, detail) => { alerts.push([kind, detail]); } } };
    eskiz.getBalance = async () => { if (fail) throw new Error('timeout'); return { data: { balance: live } }; };
    const inflow = require('../server/services/inflow'), cash = require('../server/services/paymentCash');
    const finance = require('../server/services/finance'), F = require('../js/financeEngine');
    const ef = require('../server/services/eskizFinance');
    const pool = new Pool({ connectionString: url });
    const admin = { id: 'admin' };
    // Kunni boshqarish: runDaily "kecha"ni yopadi.
    const realNow = Date.now;
    const setToday = d => { Date.now = () => Date.parse(d + 'T06:00:00Z'); };
    try {
        await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
        await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,avatar TEXT,created_at TIMESTAMPTZ DEFAULT NOW(),disabled_at TIMESTAMPTZ);
        CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,role TEXT,lang TEXT,login TEXT,department TEXT,status TEXT,start_date TEXT,join_date TEXT);
        CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
        CREATE TABLE teachers(id TEXT PRIMARY KEY,name TEXT);
        CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,group_name TEXT,teacher_id TEXT,lesson_duration INTEGER,extra_data JSONB);
        CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,manager_id TEXT,status TEXT,language TEXT,deleted_at TIMESTAMPTZ,extra_data JSONB,comments TEXT DEFAULT '[]',updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE payments(id TEXT PRIMARY KEY,student_id TEXT,paid INTEGER,debt INTEGER,date TEXT);
        CREATE TABLE json_data(key TEXT PRIMARY KEY,data JSONB);
        CREATE TABLE salary_transactions(id TEXT PRIMARY KEY,employee_id TEXT,language TEXT,period_start DATE,period_end DATE,amount BIGINT,status TEXT,paid_at TIMESTAMPTZ,cash_expense_id TEXT);
        INSERT INTO users(id,name,email,role) VALUES('admin','Admin','admin','admin'),('acc','Buxgalter','acc','accountant');`);
        await inflow.initSchema(pool); await cash.initSchema(pool); await finance.initSchema(pool); await ef.initSchema(pool);

        await t.test('first read opens the prepaid account, no expense', async () => {
            setToday('2026-10-17');
            const r = await ef.runDaily(pool, { force: true });
            assert.equal(r.opened, true);
            const a = (await pool.query("SELECT entity,kind,opening_balance,TO_CHAR(opening_date,'YYYY-MM-DD') d FROM fin_accounts WHERE id='acc-eskiz-sms'")).rows[0];
            assert.deepEqual([a.entity, a.kind, Number(a.opening_balance), a.d], ['russian', 'wallet', 100000, '2026-10-16']);
            assert.equal((await pool.query("SELECT COUNT(*)::int n FROM fin_transactions WHERE category_code='MKT_SMS'")).rows[0].n, 0);
            assert.deepEqual(await ef.runDaily(pool, { force: true }), { skipped: 'done' });
        });

        await t.test('daily spend = previous + top-ups − current, idempotent', async () => {
            setToday('2026-10-18'); live = 86500;
            const r = await ef.runDaily(pool, { force: true });
            assert.deepEqual([r.day, r.spent, r.topups], ['2026-10-17', 13500, 0]);
            // Shaxsiy kartadan to'ldirish (kapital) + ertasi kungi sarf.
            await finance.createTransaction(pool, admin, { requestKey: 'eskiz-topup-test-0001', type: 'capital', categoryCode: 'OWNER_IN', entity: 'russian', date: '2026-10-18', amount: 200000, accountId: 'acc-eskiz-sms', counterparty: 'Shaxsiy karta' });
            setToday('2026-10-19'); live = 272000;
            const r2 = await ef.runDaily(pool, { force: true });
            assert.deepEqual([r2.spent, r2.topups], [14500, 200000]);
            const rows = (await pool.query("SELECT amount,account_id,entity FROM fin_transactions WHERE category_code='MKT_SMS' ORDER BY txn_date")).rows;
            assert.deepEqual(rows.map(x => Number(x.amount)), [13500, 14500]);
            // Moliya'dagi Eskiz qoldig'i = haqiqiy Eskiz balansi; erkin pulga (kassa) kirmaydi.
            const data = await finance.load(pool);
            const bal = F.accountBalances(data).find(a => a.id === 'acc-eskiz-sms');
            assert.equal(bal.balance, 272000); assert.equal(bal.equivalent, false); assert.equal(bal.prepaid, true);
            // Balans hisobotida aktiv sifatida qoladi (balans mos keladi).
            const bs = F.balanceSheet(data, '2026-10-19');
            assert.equal(bs.netAssets, bs.equity.total);
        });

        await t.test('manual entry of auto category is rejected', async () => {
            await assert.rejects(finance.createTransaction(pool, admin, { requestKey: 'eskiz-manual-test-01', type: 'expense', categoryCode: 'MKT_SMS', entity: 'russian', date: '2026-10-18', amount: 1000, accountId: 'acc-card', counterparty: 'Eskiz' }), /avtomatik/);
        });

        await t.test('balance grew without recorded top-up → problem, day stays open', async () => {
            setToday('2026-10-20'); live = 400000;
            const r = await ef.runDaily(pool, { force: true });
            assert.equal(r.unrecorded, 128000);
            const st = await ef.status(pool, admin, {});
            assert.ok(st.problems.some(p => p.key === 'unrecorded' && p.amount === 128000));
            // Kartadan o'tkazma kiritilgach keyingi urinishda kun yopiladi.
            await finance.createTransaction(pool, admin, { requestKey: 'eskiz-topup-test-0002', type: 'transfer', categoryCode: 'TRANSFER', entity: 'russian', date: '2026-10-19', amount: 150000, accountId: 'acc-card', toAccountId: 'acc-eskiz-sms' });
            const r2 = await ef.runDaily(pool, { force: true });
            assert.equal(r2.spent, 22000);
            assert.equal((await ef.status(pool, admin, {})).problems.filter(p => p.key === 'unrecorded').length, 0);
        });

        await t.test('API failure → problem, missed days merge into next read', async () => {
            setToday('2026-10-21'); fail = true;
            assert.ok((await ef.runDaily(pool, { force: true })).error);
            assert.ok((await ef.status(pool, admin, {})).problems.some(p => p.key === 'api'));
            setToday('2026-10-22'); fail = false; live = 370000;
            const r = await ef.runDaily(pool, { force: true });
            assert.deepEqual([r.day, r.spent], ['2026-10-21', 30000]);
            const d = (await pool.query("SELECT description FROM fin_transactions WHERE request_key='eskiz-sms-day-2026-10-21'")).rows[0].description;
            assert.match(d, /2 kun/);
            const st = await ef.status(pool, admin, {});
            assert.equal(st.problems.filter(p => p.key === 'api').length, 0);
            assert.ok(st.avgDaily > 0 && st.daysLeft > 3);
        });

        await t.test('low runway (<3 days) → problem', async () => {
            setToday('2026-10-23'); live = 20000; // 350 000 sarf → o'rtacha katta, qoldiq kam
            await ef.runDaily(pool, { force: true });
            assert.ok((await ef.status(pool, admin, {})).problems.some(p => p.key === 'low'));
            assert.equal(alerts.at(-1)[0], 'low');
        });

        await t.test('finance integrity stays clean', async () => {
            const seals = await finance.verifySeals(pool);
            assert.ok(!seals || seals.ok !== false, JSON.stringify(seals).slice(0, 300));
        });
    } finally { Date.now = realNow; await pool.end(); }
});
