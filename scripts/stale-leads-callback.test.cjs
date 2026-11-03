// "Oldi" → "Keyinroq gaplashishni so'radi": qayta qo'ng'iroq vaqti qotgan lidlar qulfini qanday o'zgartiradi
// (js/staleLeads.js klient hisobi va server/services/staleLeads.js tekshiruvlari).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HOUR = 3600000, DAY = 24 * HOUR;
const NOW = Date.parse('2026-11-03T12:00:00Z');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'staleLeads.js'), 'utf8');

function load(leads) {
    const store = { russian: leads, english: [] };
    const window = {};
    const document = { readyState: 'loading', addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], body: { children: [], classList: { add() {}, remove() {} } } };
    const c = vm.createContext({
        window, document, localStorage: { getItem: () => null, setItem() {} }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        Date: class extends Date { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static parse(x) { return Date.parse(x); } },
        Math, Number, Object, String, Array, Set, JSON, Map,
    });
    // window.* funksiyalar global sifatida ham ko'rinsin (brauzerdagidek).
    vm.runInContext('var window = this; ', c);
    Object.assign(c, {
        getCurrentUser: () => ({ id: 'u1', role: 'sales_manager', linkedManagerId: 'm1', linkedManagerLang: 'russian', name: 'Hamida' }),
        getItem: () => store, STORAGE_KEYS: { leads: 'leads' },
        normalizeLeadStatus: s => s, getLeadById: (lg, id) => store[lg].find(l => l.id === id),
    });
    vm.runInContext(src, c);
    return c.staleLeads;
}
const ids = r => Array.from(r.lock, l => l.id);
const iso = t => new Date(t).toISOString();
const lead = (id, extra = {}) => ({ id, name: id, managerId: 'm1', status: 'boglanishga-urinilmoqda', managerAssignedAt: iso(NOW - 6 * DAY), comments: [], ...extra });
const cb = (createdAt, reminderAt) => ({ id: 'c' + createdAt, type: 'follow-up-reminder', callback: true, createdAt: iso(createdAt), reminderAt: iso(reminderAt) });

test('5 kunlik lid qulfda; "keyinroq" vaqti kelmagan bo\'lsa — qulfdan chiqadi', () => {
    const SL = load([lead('a'), lead('b', { comments: [cb(NOW - HOUR, NOW + 5 * HOUR)] })]);
    assert.deepEqual(ids(SL.compute(NOW)), ['a']);
});

test('kelishilgan vaqtdan 2 soat o\'tsa — lid yana qulfga qaytadi (kunidan qat\'i nazar)', () => {
    const fresh = { managerAssignedAt: iso(NOW - DAY) };
    const SL = load([
        lead('due', { ...fresh, comments: [cb(NOW - 5 * HOUR, NOW - 2 * HOUR - 1000)] }),
        lead('soon', { ...fresh, comments: [cb(NOW - 5 * HOUR, NOW - HOUR)] }),
    ]);
    assert.deepEqual(ids(SL.compute(NOW)), ['due']);
});

test('oxirgi kelishuv hisoblanadi; bosqichdan o\'tgan lid qulfga tushmaydi', () => {
    const SL = load([
        lead('re', { comments: [cb(NOW - 30 * HOUR, NOW - 26 * HOUR), cb(NOW - HOUR, NOW + HOUR)] }),
        lead('ok', { status: 'boglanildi', comments: [cb(NOW - 30 * HOUR, NOW - 26 * HOUR)] }),
    ]);
    assert.deepEqual(ids(SL.compute(NOW)), []);
});

test('vaqt va limit tekshiruvi', () => {
    const SL = load([]);
    const l0 = lead('x'), l2 = lead('y', { comments: [cb(NOW - 9 * HOUR, NOW - 8 * HOUR), cb(NOW - HOUR, NOW - HOUR)] });
    assert.equal(SL.callbackError(l0, NaN, NOW), 'Kun va vaqtni tanlang');
    assert.equal(SL.callbackError(l0, NOW - 1000, NOW), 'Vaqt hozirdan keyin boʻlsin');
    assert.match(SL.callbackError(l0, NOW + 4 * DAY, NOW), /3 kun/);
    assert.equal(SL.callbackError(l0, NOW + 2 * HOUR, NOW), '');
    assert.match(SL.callbackError(l2, NOW + 2 * HOUR, NOW), /2 marta/);
});

test('server: limit, muddat va qotgan holat', () => {
    const S = require('../server/services/staleLeads');
    const existing = { comments: [cb(NOW - 9 * HOUR, NOW - 8 * HOUR)] };
    assert.doesNotThrow(() => S.assertCallbackRules(existing, { comments: [...existing.comments, cb(NOW, NOW + DAY)] }, 'sales_manager', NOW));
    assert.throws(() => S.assertCallbackRules(existing, { comments: [...existing.comments, cb(NOW, NOW + 5 * DAY)] }, 'sales_manager', NOW), e => e.code === 'CALLBACK_RANGE');
    const two = { comments: [...existing.comments, cb(NOW - HOUR, NOW)] };
    assert.throws(() => S.assertCallbackRules(two, { comments: [...two.comments, cb(NOW, NOW + DAY)] }, 'sales_manager', NOW), e => e.code === 'CALLBACK_LIMIT');
    assert.doesNotThrow(() => S.assertCallbackRules(two, { comments: [...two.comments, cb(NOW, NOW + DAY)] }, 'admin', NOW));
    assert.doesNotThrow(() => S.assertCallbackRules(two, two, 'sales_manager', NOW)); // yangi yozuv yo'q — eski holat saqlanadi
    assert.equal(S.callbackState({ comments: [] }, NOW), null);
    assert.equal(S.callbackState({ comments: [cb(NOW - HOUR, NOW - HOUR)] }, NOW), 'waiting');
    assert.equal(S.callbackState({ comments: [cb(NOW - 5 * HOUR, NOW - 3 * HOUR)] }, NOW), 'overdue');
});
