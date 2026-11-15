// Investor roli: index.js dagi har bir /api route guruhi investor tokeni bilan 403 qaytarishi (faqat /api/investor va o'z akkaunti ochiq).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { investorOnly } = require('../server/middleware/investorOnly');
const { JWT_SECRET } = require('../server/middleware/auth');

const users = { inv: { id: 'inv', role: 'investor' }, adm: { id: 'adm', role: 'admin' }, stale: { id: 'stale', role: 'investor' } };
const mw = investorOnly({ findUserById: async id => users[id] });
const run = (url, user, tokenRole) => new Promise(resolve => {
    const req = { originalUrl: url, baseUrl: '', path: url.split('?')[0], method: 'GET', headers: user ? { authorization: 'Bearer ' + jwt.sign({ id: user, role: tokenRole || users[user].role }, JWT_SECRET) } : {} };
    const res = { status(c) { this.code = c; return this; }, json() { resolve(this.code); } };
    mw(req, res, () => resolve('next'));
});
const prefixes = [...new Set([...fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8').matchAll(/app\.use\('(\/api\/[^']+)'/g)].map(m => m[1]))];

test('investor is denied on every API route group except /api/investor and own account', async () => {
    assert.ok(prefixes.length > 20, 'route groups found: ' + prefixes.length);
    for (const p of prefixes) {
        const url = p + '/x';
        const expected = /^\/api\/investor/.test(p) ? 'next' : 403;
        if (p === '/api/auth') continue;
        assert.equal(await run(url, 'inv'), expected, url);
        assert.equal(await run(url, 'adm'), 'next', url);
    }
    for (const u of ['/api/state', '/api/finance/overview', '/api/inflow?language=russian', '/api/payroll/preview', '/api/leads', '/api/hr/employees', '/api/auth/create-user', '/api/auth/staff-directory'])
        assert.equal(await run(u, 'inv'), 403, u);
    for (const u of ['/api/investor', '/api/investor/months/2026-09', '/api/auth/me', '/api/auth/logout']) assert.equal(await run(u, 'inv'), 'next', u);
    // Token eski rolda (masalan, employee) bo'lsa ham bazadagi rol hal qiladi.
    assert.equal(await run('/api/state', 'stale', 'employee'), 403);
    assert.equal(await run('/api/state'), 'next'); // tokensiz — route o'zi 401 qaytaradi
});

test('investor guard uses a normalized path (encoded, double-slash, dot segments)', async () => {
    for (const u of ['/api//state', '/api/%69nvestor/../state', '/api/investor/../state', '/api/investor/%2e%2e/state', '/api/investor/%252e%252e/state',
        '/api/investor/..%2fstate', '/api/auth/me/../../state', '/api/investor\\..\\state', '/api/%E0%A4%A'])
        assert.equal(await run(u, 'inv'), 403, u);
    for (const u of ['/api//investor', '/api/%69nvestor/months', '/api/investor/', '/api/auth//me']) assert.equal(await run(u, 'inv'), 'next', u);
    assert.equal(await run('/api//state', 'adm'), 'next');
});

test('invalid token is stripped; student-shaped and investor-role tokens cannot bypass the guard', async () => {
    // Yaroqsiz token: so'rov tokensiz davom etadi (sarlavha olib tashlanadi) — authRequired'siz route ham uni o'qiy olmaydi.
    const req = { baseUrl: '', path: '/api/public/x', headers: { authorization: 'Bearer ' + jwt.sign({ id: 'inv', role: 'investor' }, 'wrong-secret') } };
    const out = await new Promise(r => mw(req, { status() { return this; }, json() { r('blocked'); } }, () => r('next')));
    assert.equal(out, 'next'); assert.equal(req.headers.authorization, undefined);
    const tok = p => ({ baseUrl: '', path: '/api/state', headers: { authorization: 'Bearer ' + jwt.sign(p, JWT_SECRET) } });
    const go = req => new Promise(r => mw(req, { status(c) { this.code = c; return this; }, json() { r(this.code); } }, () => r('next')));
    assert.equal(await go(tok({ id: 'inv', studentId: 'inv' })), 403, 'studentId belgisi investorni o‘tkazib yubormaydi');
    assert.equal(await go(tok({ role: 'investor' })), 403, 'id’siz investor tokeni');
    assert.equal(await go(tok({ id: 's1', studentId: 's1', role: 'student' })), 'next');
    // Har qanday /api route (authRequired bormi-yo'qmi) — investor tokeni bilan 403, faqat ruxsat etilganlar ochiq.
    for (const u of ['/api/public/anything', '/api/telegram/webhook', '/api/leads/webhook', '/api/miniapp/x', '/api/unknown-route'])
        assert.equal(await run(u, 'inv'), 403, u);
});

test('investor role change takes effect: immediate on invalidateUser, otherwise after cache TTL', async () => {
    const { invalidateUser, CACHE_MS } = require('../server/middleware/investorOnly');
    let t = 1e12; const db = { u1: { id: 'u1', role: 'investor' } };
    const m = investorOnly({ findUserById: async id => db[id], now: () => t });
    const go = () => new Promise(r => m({ baseUrl: '', path: '/api/state', headers: { authorization: 'Bearer ' + jwt.sign({ id: 'u1', role: 'employee' }, JWT_SECRET) } },
        { status(c) { this.code = c; return this; }, json() { r(this.code); } }, () => r('next')));
    assert.equal(await go(), 403);
    db.u1.role = 'employee';                 // investor roli olib tashlandi
    assert.equal(await go(), 403, 'kesh ichida (invalidatsiyasiz)');
    invalidateUser('u1');
    assert.equal(await go(), 'next', 'invalidateUser darhol kuchga kiradi');
    db.u1.role = 'investor';                 // yana investor — invalidatsiyasiz, TTL dan keyin
    assert.equal(await go(), 'next');
    t += CACHE_MS + 1;
    assert.equal(await go(), 403, 'TTL dan keyin bazadagi rol');
    // db.updateUser rol o'zgarganda keshni tozalaydi (manba darajasida tekshiruv).
    assert.match(fs.readFileSync(path.join(__dirname, '../server/db.js'), 'utf8'), /fields\.role !== undefined\) require\('\.\/middleware\/investorOnly'\)\.invalidateUser\(id\)/);
});
