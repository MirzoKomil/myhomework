const { test } = require('node:test');
const assert = require('node:assert/strict');
const inv = require('../server/services/investor');

test('investor share: percent of positive base, loss month gives 0 (not carried forward)', () => {
    assert.equal(inv.shareOf(15400000, 30), 4620000);
    assert.equal(inv.shareOf(-2000000, 30), 0);
    assert.equal(inv.shareOf(8707443, 30), 2612233);
    assert.deepEqual(Object.keys(inv.BASES), ['before_tax', 'after_tax']);
});
