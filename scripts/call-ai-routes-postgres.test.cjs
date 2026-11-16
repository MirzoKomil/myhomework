// Qo'ng'iroq AI 2-bosqich API: rollar, til doirasi, menejer faqat o'zini ko'radi.
// Toza baza kerak: createdb payroll_test_xxx && PAYROLL_TEST_DATABASE_URL=postgres://...@127.0.0.1/payroll_test_xxx node --test --test-force-exit scripts/call-ai-routes-postgres.test.cjs
const { test, after } = require('node:test');
// db.js fon taymerlari jarayonni ushlab qoladi — test tugagach chiqamiz.
after(() => { setTimeout(() => process.exit(process.exitCode || 0), 300); });
const assert = require('node:assert/strict');
const url = process.env.PAYROLL_TEST_DATABASE_URL;

test('call-ai phase 2 routes', { skip: !url && 'PAYROLL_TEST_DATABASE_URL yoʻq' }, async () => {
    process.env.DATABASE_URL = url;
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_SSL = 'false';
    process.env.DATA_DIR = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'cr-'));
    // Avtorizatsiya: test sarlavhasidagi foydalanuvchi.
    const authPath = require.resolve('../server/middleware/auth');
    require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { authRequired: (req, res, next) => { req.user = JSON.parse(req.headers['x-u'] || 'null'); next(); } } };
    const db = require('../server/db');
    await db.init();
    const p = db.pool;
    try {
    await p.query(`INSERT INTO sales_managers (id,name) VALUES ('gm','Gulchehra'),('dm','Dildora'),('em','Emma') ON CONFLICT DO NOTHING`);
    await p.query(`INSERT INTO users (id,name,email,role,password_hash) VALUES ('u-gm','Gulchehra','g@x','sales_manager','x'),('a','Admin','a@x','admin','x'),('t','Target','t@x','targetolog','x'),('r','Rop','r@x','rop','x') ON CONFLICT DO NOTHING`);
    await p.query(`INSERT INTO user_sales_manager_links (user_id,manager_id) VALUES ('u-gm','gm') ON CONFLICT DO NOTHING`);
    const W = Date.now() - 600000;
    const mk = (id, mid, lang, score, extra = {}) => ({ id, recordingId: 'r' + id, lang, leadId: 'L' + id, managerId: mid, callAt: new Date(W).toISOString(), status: 'done', durationSec: 200,
        result: { type: 'birinchi', gradable: true, score, axes: { ochilish: 8, ehtiyoj: 7, ogriq: 6, taqdimot: 8, narx: 6, etiroz: 7, yopish: score > 80 ? 9 : 3 }, criteria: [], violations: [], nextStepAt: '', outcome: 'qayta_qongiroq', saleProbability: 40,
            leadQuality: { targeted: score > 80, reason: score > 80 ? 'maqsadli' : 'yosh_talaba', age: 18 } }, ...extra });
    const list = [mk('1', 'gm', 'russian', 62, { task: { text: 'Qayta qoʻngʻiroq', at: new Date().toISOString(), done: false } }), mk('2', 'dm', 'russian', 88), mk('3', 'em', 'english', 75)];
    await db.tx(c => db.saveJsonData(c, 'callAnalyses', list));
    const express = require('express');
    const app = express(); app.use(express.json()); app.use('/api/call-ai', require('../server/routes/callAi').router);
    const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}/api/call-ai`;
    const as = (u, path, opt = {}) => fetch(base + path, { ...opt, headers: { 'content-type': 'application/json', 'x-u': JSON.stringify(u), ...(opt.headers || {}) } }).then(async r => ({ status: r.status, body: await r.json() }));
    const admin = { id: 'a', role: 'admin', name: 'Admin' }, mgr = { id: 'u-gm', role: 'sales_manager', name: 'Gulchehra' }, tg = { id: 't', role: 'targetolog' };
    try {
        const s = await as(admin, '/stats?per=week');
        assert.equal(s.status, 200, JSON.stringify(s.body));
        assert.equal(s.body.lang, 'russian');
        assert.deepEqual(s.body.managers.map(m => m.id), ['dm', 'gm']);
        const se = await as(admin, '/stats?per=week&lang=english');
        assert.deepEqual(se.body.managers.map(m => m.name), ['Emma']);
        assert.equal((await as(mgr, '/stats')).status, 403);
        const me = await as(mgr, '/me?per=week');
        assert.equal(me.status, 200, JSON.stringify(me.body));
        assert.equal(me.body.task.text, 'Qayta qoʻngʻiroq');
        assert.ok(!JSON.stringify(me.body).includes('Dildora'), 'menejer boshqa menejerni koʻrmaydi');
        const ct = await as(admin, '/calls-table?per=week');
        assert.equal(ct.body.total, 2);
        const mp = await as(admin, '/manager/gm?per=week');
        assert.equal(mp.status, 200); assert.equal(mp.body.stages.length, 7);
        const lq = await as(tg, '/lead-quality?per=week');
        assert.equal(lq.status, 200); assert.equal(lq.body.total, 2);
        assert.equal((await as(tg, '/calls-table')).status, 403);
        const st = await as(admin, '/settings', { method: 'POST', body: JSON.stringify({ planThreshold: 65 }) });
        assert.equal(st.body.planThreshold, 65);
        assert.equal((await as({ id: 'r', role: 'rop', name: 'R' }, '/settings', { method: 'POST', body: '{}' })).status, 403);
        const wk = await as(admin, '/weekly/run', { method: 'POST' });
        assert.equal(wk.status, 200, JSON.stringify(wk.body));
        const pl = await as(admin, '/plans');
        assert.equal(pl.status, 200);
        const w = await as(admin, '/weekly');
        assert.equal(w.status, 200); assert.equal(w.body.report, null); assert.ok(Array.isArray(w.body.weeks)); // o'tgan haftada qo'ng'iroq yo'q — hisobot yo'q
    } finally { srv.close(); }
    } finally { await p.end().catch(() => {}); }
});
