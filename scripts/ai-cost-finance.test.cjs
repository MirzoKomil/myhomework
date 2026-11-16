// AI qo'ng'iroq tahlili xarajati → Moliya: token × narx, Claude oylik krediti, kunlik avtomatik xarajat.
// PostgreSQL qismi: PAYROLL_TEST_DATABASE_URL=postgres://...@127.0.0.1/payroll_test_xxx node --test scripts/ai-cost-finance.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ac = require('../server/services/aiCostFinance');

test('token usage is priced from the official table; unknown model uses the expensive fallback', () => {
    // Gemini 3.1 Pro: 13 440 audio + 560 matn kirish, 3 000 chiqish + 1 000 fikrlash → 14 000×2 + 4 000×12 = 0.076 $
    const g = ac.costOf('gemini', 'gemini-3.1-pro-preview', { promptTokenCount: 14000, candidatesTokenCount: 3000, thoughtsTokenCount: 1000 }, {});
    assert.deepEqual([g.input, g.output, g.usd, g.priced], [14000, 4000, 0.076, true]);
    // Claude Sonnet 5.5: kesh o'qish arzon.
    const c = ac.costOf('claude', 'claude-sonnet-5-5', { input_tokens: 9000, output_tokens: 2500, cache_read_input_tokens: 3000 }, {});
    assert.equal(c.usd, (9000 * 2 + 2500 * 10 + 3000 * 0.1) / 1e6);
    const u = ac.costOf('gemini', 'gemini-9-ultra', { promptTokenCount: 1e6, candidatesTokenCount: 0 }, {});
    assert.deepEqual([u.usd, u.priced], [2, false]);
    // Env orqali yangi narx.
    const e = ac.costOf('gemini', 'gemini-9-ultra', { promptTokenCount: 1e6 }, { CALL_AI_PRICES: '{"gemini-9-ultra":{"in":0.5,"out":3}}' });
    assert.deepEqual([e.usd, e.priced], [0.5, true]);
});

test('call AI reports usage of both providers to onCost', async () => {
    const { createCallAi } = require('../server/services/callAi');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aic-'));
    fs.writeFileSync(path.join(dir, 'a.m4a'), Buffer.from('audio'));
    const rec = { id: 'r1', lang: 'russian', leadId: 'L1', url: '/uploads/a.m4a' };
    const data = { callRecordings: [rec], scripts: [] };
    const db = {
        async getJsonData(k) { return JSON.parse(JSON.stringify(data[k] ?? [])); },
        async saveJsonData(_c, k, v) { data[k] = JSON.parse(JSON.stringify(v)); },
        async tx(fn) { return fn({}); },
        async getLeadById() { return { id: 'L1', status: 'sinov-darsida' }; },
    };
    const fetchImpl = async url => (url.includes('generativelanguage')
        ? { ok: true, status: 200, json: async () => ({ usageMetadata: { promptTokenCount: 14000, candidatesTokenCount: 3000 }, candidates: [{ content: { parts: [{ text: JSON.stringify({ segments: [{ t: '00:01', s: 'M', text: 'Salom' }], durationSec: 300 }) }] } }] }) }
        : { ok: true, status: 200, json: async () => ({ usage: { input_tokens: 9000, output_tokens: 2000 }, content: [{ type: 'tool_use', name: 'call_score', input: { type: 'qayta', gradable: true, criteria: [{ name: 'A', max: 100, got: 70 }] } }] }) });
    const costs = [];
    const ai = createCallAi({ db, uploadsDir: dir, env: { GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' }, fetchImpl, log: { log() {}, error() {} }, onCost: c => { costs.push(c); } });
    const it = await ai.enqueue(rec);
    const t0 = Date.now();
    while (Date.now() - t0 < 2000 && !((await ai.all())[0]?.status === 'done')) await new Promise(r => setTimeout(r, 10));
    assert.deepEqual(costs.map(c => [c.analysisId, c.provider, c.model]), [[it.id, 'gemini', 'gemini-3.1-pro-preview'], [it.id, 'claude', 'claude-sonnet-5-5']]);
    assert.equal(costs[0].usage.promptTokenCount, 14000);
    assert.equal(costs[1].usage.output_tokens, 2000);
});

const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url && (new URL(url).hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(new URL(url).pathname))) throw Error('Only disposable test DB allowed');

test('daily AI expense: Gemini always, Claude only above the monthly credit; idempotent', { skip: !url }, async t => {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-fin-'));
    fs.mkdirSync(path.join(process.env.DATA_DIR, 'uploads'));
    const { Pool } = require('pg');
    const inflow = require('../server/services/inflow'), cash = require('../server/services/paymentCash');
    const finance = require('../server/services/finance'), F = require('../js/financeEngine');
    const pool = new Pool({ connectionString: url });
    const admin = { id: 'admin' };
    const realNow = Date.now;
    const setToday = d => { Date.now = () => Date.parse(d + 'T06:00:00Z'); };
    let rate = 12000, rateFail = false;
    const fetchImpl = async () => { if (rateFail) throw new Error('offline'); return { ok: true, json: async () => [{ Rate: String(rate) }] }; };
    const env = { ANTHROPIC_MONTHLY_CREDIT_USD: '1' };
    const rec = (provider, model, usage, id, lang = 'russian') => ac.record(pool, { analysisId: id, provider, model, usage, lang }, env);
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
        INSERT INTO users(id,name,email,role) VALUES('admin','Admin','admin','admin');`);
        await inflow.initSchema(pool); await cash.initSchema(pool); await finance.initSchema(pool); await ac.initSchema(pool);

        await t.test('nothing to close before the first call', async () => {
            setToday('2026-10-16');
            assert.deepEqual(await ac.runDaily(pool, { force: true, env, fetchImpl }), { skipped: 'no-costs' });
        });

        await t.test('a day closes into one expense on the AI account', async () => {
            setToday('2026-10-16');
            await rec('gemini', 'gemini-3.1-pro-preview', { promptTokenCount: 100000, candidatesTokenCount: 10000 }, 'ca-1'); // 0.32 $
            await rec('claude', 'claude-sonnet-5-5', { input_tokens: 200000, output_tokens: 20000 }, 'ca-1');           // 0.60 $ (kredit 1 $ ichida)
            setToday('2026-10-17');
            const r = await ac.runDaily(pool, { force: true, env, fetchImpl });
            assert.deepEqual(r.closed.map(d => [d.day, d.calls, d.claudePaid, d.amount]), [['2026-10-16', 1, 0, Math.round(0.32 * 12000)]]);
            const tx = (await pool.query("SELECT amount,account_id,category_code,entity FROM fin_transactions WHERE request_key='ai-calls-day-2026-10-16-russian'")).rows[0];
            assert.deepEqual([Number(tx.amount), tx.account_id, tx.category_code, tx.entity], [3840, 'acc-ai-services', 'AI_CALLS', 'russian']);
            assert.deepEqual((await ac.runDaily(pool, { force: true, env, fetchImpl })).closed, []);
        });

        await t.test('Claude above the monthly credit is charged; gap days are closed one by one', async () => {
            setToday('2026-10-17');
            await rec('claude', 'claude-sonnet-5-5', { input_tokens: 200000, output_tokens: 20000 }, 'ca-2'); // jami 1.20 $ → 0.20 $ pullik
            setToday('2026-10-19');
            const r = await ac.runDaily(pool, { force: true, env, fetchImpl });
            assert.equal(r.error, undefined);
            assert.deepEqual(r.closed.map(d => [d.day, Math.round(d.claudePaid * 100) / 100, d.amount]), [['2026-10-17', 0.2, 2400], ['2026-10-18', 0, 0]]);
            const st = await ac.status(pool, admin, { start: '2026-10-01', end: '2026-10-31' }, env);
            assert.ok(st.problems.some(p => p.key === 'credit_out'));
            assert.equal(st.month.calls, 1); // ca-2 — faqat qayta baho (Gemini'siz), yangi qo'ng'iroq emas
        });

        await t.test('English calls go to the English school; long Gemini prompts use the higher price', async () => {
            setToday('2026-10-20');
            await rec('gemini', 'gemini-3.1-pro-preview', { promptTokenCount: 250000 }, 'ca-en', 'english'); // >200k → 4 $/M = 1 $
            assert.equal(ac.costOf('gemini', 'gemini-3.1-pro-preview', { promptTokenCount: 250000 }, {}).usd, 1);
        });

        await t.test('rate failure keeps the day open and shows a problem; next run closes it', async () => {
            setToday('2026-10-19');
            await pool.query("DELETE FROM ai_call_costs WHERE analysis_id='ca-en'"); await rec('gemini', 'gemini-3.1-pro-preview', { promptTokenCount: 250000 }, 'ca-en', 'english');
            await pool.query("UPDATE ai_call_costs SET day='2026-10-20' WHERE analysis_id='ca-en'");
            await rec('gemini', 'gemini-3.1-pro-preview', { promptTokenCount: 50000 }, 'ca-3');
            setToday('2026-10-20'); rateFail = true;
            await pool.query("UPDATE ai_cost_state SET data = data - 'rate'");
            assert.ok((await ac.runDaily(pool, { force: true, env, fetchImpl })).error);
            assert.ok((await ac.status(pool, admin, {}, env)).problems.some(p => p.key === 'rate'));
            rateFail = false; rate = 12500;
            const r = await ac.runDaily(pool, { force: true, env, fetchImpl });
            assert.deepEqual(r.closed.map(d => [d.day, d.amount]), [['2026-10-19', 1250]]);
            setToday('2026-10-21');
            const r2 = await ac.runDaily(pool, { force: true, env, fetchImpl });
            assert.deepEqual(r2.closed.map(d => d.parts.map(p => [p.entity, p.amount])), [[['english', 12500]]]);
            assert.ok(!(await ac.status(pool, admin, {}, env)).problems.some(p => p.key === 'rate'));
        });

        await t.test('AI account is prepaid-like: not free cash; paying Google is a transfer, not an expense', async () => {
            await finance.createTransaction(pool, admin, { requestKey: 'ai-pay-test-0001', type: 'capital', categoryCode: 'OWNER_IN', entity: 'russian', date: '2026-10-20', amount: 19990, accountId: 'acc-ai-services', counterparty: 'Shaxsiy karta' });
            const data = await finance.load(pool);
            const bal = F.accountBalances(data).find(a => a.id === 'acc-ai-services');
            assert.deepEqual([bal.balance, bal.equivalent, bal.prepaid], [0, false, true]);
            await assert.rejects(finance.createTransaction(pool, admin, { requestKey: 'ai-manual-test-001', type: 'expense', categoryCode: 'AI_CALLS', entity: 'russian', date: '2026-10-20', amount: 1000, accountId: 'acc-card', counterparty: 'Google' }), /avtomatik/);
            const seals = await finance.verifySeals(pool);
            assert.ok(!seals || seals.ok !== false, JSON.stringify(seals).slice(0, 300));
        });
    } finally { Date.now = realNow; await pool.end(); }
});
