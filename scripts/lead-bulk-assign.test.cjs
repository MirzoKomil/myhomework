const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { functionSource } = require('./helpers/lead-workflow-fixture.cjs');
const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const block = (start, end) => { const a = app.indexOf(start); return app.slice(a, app.indexOf(end, a) + end.length); };

function ctx() {
    const c = vm.createContext({ Object, Number, Set, Array });
    vm.runInContext([block('const LEAD_COLUMNS = [', '];'), 'const LEAD_STATUS_IDS = new Set(LEAD_COLUMNS.map(c => c.id));',
        block('const LEAD_OPEN_FOR_LOAD', ';'), functionSource('js/app.js', 'normalizeLeadStatus'),
        functionSource('js/app.js', 'leadLoadByManager'), functionSource('js/app.js', 'planEvenLeadSplit'),
        'this.load = leadLoadByManager; this.plan = planEvenLeadSplit;'].join('\n'), c);
    return c;
}

test('even split fills the least-loaded manager first and stays balanced', () => {
    const c = ctx();
    const plan = c.plan(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], ['m1', 'm2', 'm3', 'm4'], { m1: 11, m2: 9, m3: 14, m4: 9 });
    const per = {}; plan.forEach(p => { per[p.managerId] = (per[p.managerId] || 0) + 1; });
    assert.equal(plan.length, 8);
    assert.deepEqual(JSON.parse(JSON.stringify(per)), { m1: 2, m2: 3, m4: 3 });
    assert.equal(plan[0].managerId, 'm2');
    assert.equal(c.plan(['x'], [], {}).length, 0);
});

test('load counts only open leads of the given managers', () => {
    const c = ctx();
    const load = c.load([{ managerId: 'm1', status: 'yangi-lidlar' }, { managerId: 'm1', status: 'tolov-yopildi' },
        { managerId: 'm2', status: 'qaror-jarayonida' }, { managerId: 'm9', status: 'yangi-lidlar' }, { managerId: '', status: 'yangi-lidlar' }], ['m1', 'm2']);
    assert.deepEqual({ ...load }, { m1: 1, m2: 1 });
});

test('bulk manager list refreshes when the language changes', () => {
    assert.ok(app.includes('if (bulkSelect.dataset.populated !== bulkLang)'));
    assert.ok(!app.includes('if (!bulkSelect.dataset.populated)'));
});
