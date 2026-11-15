// "Yangi" ustunidagi lidlar: 12 ish soatlik qulf va 8 ish soatlik ogohlantirish (16-noy).
// Faqat ish vaqti (10:00–20:00, Toshkent) sanaladi; qoida ishga tushgan paytdan (newSince) oldingi soatlar sanalmaydi.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HOUR = 3600000, DAY = 24 * HOUR;
const NOW = Date.parse('2026-11-03T12:00:00Z'); // Toshkent 17:00
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'staleLeads.js'), 'utf8');
const iso = t => new Date(t).toISOString();

async function load(leads, newSince = '2026-10-01T00:00:00Z') {
    const store = { russian: leads, english: [] };
    const c = vm.createContext({
        document: { readyState: 'loading', addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], body: { children: [], classList: { add() {}, remove() {} } } },
        localStorage: { getItem: () => null, setItem() {} }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        Date: class extends Date { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static parse(x) { return Date.parse(x); } },
        Math, Number, Object, String, Array, Set, JSON, Map, Promise, Error, Infinity,
    });
    vm.runInContext('var window = this; ', c);
    Object.assign(c, {
        getCurrentUser: () => ({ id: 'u1', role: 'sales_manager', linkedManagerId: 'm1', linkedManagerLang: 'russian', name: 'Hamida' }),
        getItem: () => store, STORAGE_KEYS: { leads: 'leads' },
        normalizeLeadStatus: s => s, getLeadById: (lg, id) => store[lg].find(l => l.id === id),
        apiFetch: async () => ({ rules: { russian: {}, english: {}, newSince } }),
    });
    vm.runInContext(src, c);
    await c.staleLeads.loadRules(true);
    return c.staleLeads;
}
const lead = (id, assigned, extra = {}) => ({ id, name: id, managerId: 'm1', status: 'yangi-lidlar', managerAssignedAt: iso(assigned), comments: [], ...extra });
const ids = a => Array.from(a, l => l.id);

test('ish soatlari: kecha 15:00 da berilgan — 12 soat (qulf), kecha 19:00 — 8 soat (ogohlantirish), 1 soat oldin — hech narsa', async () => {
    const SL = await load([
        lead('lock', Date.parse('2026-11-02T10:00:00Z')),
        lead('warn', Date.parse('2026-11-02T14:00:00Z')),
        lead('fresh', NOW - HOUR),
    ]);
    const r = SL.compute(NOW);
    assert.deepEqual(ids(r.lock), ['lock']);
    assert.deepEqual(ids(r.warnNew), ['warn']);
    assert.equal(SL.newState(r.lock[0], NOW).ms, 12 * HOUR);
});

test('kechasi berilgan lid tunda sanalmaydi', async () => {
    // Kecha 22:00 (Toshkent) da berilgan: bugun 10:00–17:00 = 7 soat.
    const SL = await load([lead('n', Date.parse('2026-11-02T17:00:00Z'))]);
    assert.equal(SL.newState(SL.compute(NOW).warnNew[0] || { id: 'n', managerId: 'm1', status: 'yangi-lidlar', managerAssignedAt: '2026-11-02T17:00:00Z', comments: [] }, NOW).ms, 7 * HOUR);
    assert.deepEqual(ids(SL.compute(NOW).lock), []);
});

test('eski lidlar: soat qoida ishga tushgan paytdan sanaladi', async () => {
    const SL = await load([lead('old', NOW - 6 * DAY)], iso(NOW - 2 * HOUR));
    const r = SL.compute(NOW);
    assert.deepEqual(ids(r.lock), []);
    assert.deepEqual(ids(r.warnNew), []);
});

test('server qoidasi kelmagan bo\'lsa (newSince yo\'q) — Yangi lid qulflamaydi', async () => {
    const SL = await load([lead('x', NOW - 6 * DAY)], '');
    assert.deepEqual(ids(SL.compute(NOW).lock), []);
});

test('"keyinroq" kelishilgan Yangi lid — eski callback qoidasida (vaqt kelmagan — qulf yo\'q)', async () => {
    const cb = { id: 'c1', type: 'follow-up-reminder', callback: true, createdAt: iso(NOW - HOUR), reminderAt: iso(NOW + 3 * HOUR) };
    const SL = await load([lead('cb', Date.parse('2026-11-01T10:00:00Z'), { comments: [cb] })]);
    assert.deepEqual(ids(SL.compute(NOW).lock), []);
});

test('menejersiz yoki boshqa ustundagi lid hisobga olinmaydi', async () => {
    const SL = await load([lead('a', NOW - 5 * DAY, { managerId: '' }), lead('b', NOW - 5 * DAY, { status: 'boglanildi' })]);
    const r = SL.compute(NOW);
    assert.deepEqual(ids(r.lock), []);
});

test('server va klient bir xil hisoblaydi; qoida chegaralari', async () => {
    const S = require('../server/services/staleLeads');
    const SL = await load([]);
    for (const [a, b] of [[Date.parse('2026-11-02T10:00:00Z'), NOW], [NOW - 3 * DAY, NOW], [NOW - 30 * 60000, NOW]])
        assert.equal(S.workMs(a, b, S.DEFAULT_RULE), SL.workMs(a, b, SL.rule()));
    const c = S.cleanRule({ newWarnHours: 12, newLockHours: 8, workStart: 21, workEnd: 9 });
    assert.equal(c.newLockHours, 13);
    assert.deepEqual([c.workStart, c.workEnd], [10, 20]);
    const st = S.newLeadState({ status: 'yangi-lidlar', managerId: 'm1', managerAssignedAt: '2026-11-02T10:00:00Z' }, S.DEFAULT_RULE, '2026-10-01T00:00:00Z', NOW);
    assert.equal(st.k, 'lock');
});
