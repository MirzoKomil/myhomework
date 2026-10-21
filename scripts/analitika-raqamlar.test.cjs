'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('formatMoney: hamma joyda "4 500 000 so‘m"', () => {
    const ctx = {}; vm.createContext(ctx);
    vm.runInContext(read('js/storage.js').match(/function formatMoney[\s\S]*?\n\}/)[0], ctx);
    assert.equal(ctx.formatMoney(4500000), '4 500 000 so\'m');
    assert.equal(ctx.formatMoney(0), '0 so\'m');
    assert.equal(ctx.formatMoney(-1500), '−1 500 so\'m');
    assert.equal(ctx.formatMoney('abc'), '0 so\'m');
});

test('ma’lumot yo‘q bo‘lsa foiz "—", "Churn" endi muzlatilganlar ulushi deb nomlangan', () => {
    const app = read('js/app.js');
    const ctx = {}; vm.createContext(ctx);
    vm.runInContext(app.match(/function anPct[\s\S]*?\n\}/)[0], ctx);
    assert.equal(ctx.anPct(null), '—');
    assert.equal(ctx.anPct(12.345), '12.3%');
    assert.doesNotMatch(app, /'Churn Rate', \(100 - retention\)/);
    assert.doesNotMatch(app, /\$\{churnRate\.toFixed/);
    assert.match(app, /const cac = newCustomers > 0 && marketingSpend > 0/);
});
