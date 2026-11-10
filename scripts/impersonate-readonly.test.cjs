// 11-noyabr (audit): "Kabinetiga kirish" rejimi faqat ko'rish uchun — server GET'dan boshqa so'rovni rad etadi.
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../server/middleware/auth');
const { readOnlyRoles } = require('../server/middleware/readOnlyRoles');

const mw = readOnlyRoles({ findUserById: async id => ({ id, role: 'rop' }) });
function run(method, url, payload) {
    return new Promise(resolve => {
        const token = jwt.sign(payload, JWT_SECRET);
        const req = { method, originalUrl: url, baseUrl: '', path: url, headers: { authorization: 'Bearer ' + token } };
        const res = { status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
        mw(req, res, () => resolve({ code: 'next' }));
    });
}

test('impersonation token: GET passes, writes blocked, logout allowed', async () => {
    const imp = { id: 7, role: 'rop', imp: { id: 1, name: 'Admin' } };
    assert.equal((await run('GET', '/api/leads', imp)).code, 'next');
    assert.equal((await run('POST', '/api/sms/send', imp)).code, 403);
    assert.equal((await run('PATCH', '/api/state', imp)).code, 403);
    assert.equal((await run('DELETE', '/api/leads/5', imp)).code, 403);
    assert.equal((await run('POST', '/api/auth/logout', imp)).code, 'next');
});

test('ordinary staff token is not affected', async () => {
    assert.equal((await run('POST', '/api/sms/send', { id: 7, role: 'rop' })).code, 'next');
});
