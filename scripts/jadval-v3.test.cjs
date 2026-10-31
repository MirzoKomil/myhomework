// node --test scripts/jadval-v3.test.cjs
// Dars jadvali v3 (js/jadvalV3.js) — brauzersiz tekshiriladigan qismlar: keyingi ish kuni,
// Toq/Juft kunlar, "Shu vaqtga mos" istak qoidasi, uch kunni birlashtirish, sinov katagi holati.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(todayStr, role = 'sales_manager') {
    const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    const wd = d => { const x = new Date(d + 'T00:00:00Z').getUTCDay(); return x === 0 ? 7 : x; };
    const window = {
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        schoolUI: { today: () => todayStr, addDays, wd, nowMin: () => 10 * 60, hm: m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, esc: s => String(s) }
    };
    const ctx = vm.createContext({ window, getCurrentUser: () => ({ role }), document: {}, console });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/jadvalV3.js'), 'utf8'), ctx);
    return window.jadvalV3;
}

test('keyingi ish kuni: shanbadan keyin dushanba, "Ertaga" faqat ertangi kun', () => {
    const sat = load('2026-10-31');
    assert.equal(sat._test.nextWork('2026-10-31'), '2026-11-02');
    assert.equal(sat._test.nextName(), 'Dushanba');
    const tue = load('2026-11-03');
    assert.equal(tue._test.nextWork('2026-11-03'), '2026-11-04');
    assert.equal(tue._test.nextName(), 'Ertaga');
});

test('Toq / Juft kunlar: guruhning 3 sanasi', () => {
    const J = load('2026-10-31');
    assert.equal(J._test.patDate('toq'), '2026-11-02');
    assert.deepEqual([...J._test.patDates('2026-11-02')], ['2026-11-02', '2026-11-04', '2026-11-06']);
    assert.deepEqual([...J._test.patDates('2026-10-31')], ['2026-10-31', '2026-11-03', '2026-11-05']);
});

test('"Shu vaqtga mos": soat ±1, "... dan keyin", so\'z bilan', () => {
    const J = load('2026-10-31');
    const lead = t => ({ comments: [{ text: `Qo'ng'iroq\nLid istagi: ${t}` }] });
    assert.equal(J._test.isFit(lead('18:00'), 18 * 60 + 30), true);
    assert.equal(J._test.isFit(lead('18:00'), 20 * 60), false);
    assert.equal(J._test.isFit(lead('18:00 dan keyin'), 21 * 60), true);
    assert.equal(J._test.isFit(lead('18:00 dan keyin'), 17 * 60), false);
    assert.equal(J._test.isFit(lead('ertalab'), 10 * 60), true);
    assert.equal(J._test.isFit(lead('kechqurun'), 19 * 60), true);
    assert.equal(J._test.isFit(lead('kechqurun'), 10 * 60), false);
    assert.equal(J._test.isFit({ comments: [] }, 19 * 60), false);
    assert.equal(J._test.isFit(lead('18:00'), null), false);
});

test('uch kunni birlashtirish: dars takrorlanmaydi, bir kunlik ta\'til butun guruhga yoyilmaydi', () => {
    const J = load('2026-10-31');
    const L = (start, sid) => ({ kind: 'lesson', start, end: start + 30, studentId: sid });
    const leave = { kind: 'leave', start: 420, end: 1439 };
    const one = J._test.mergeDays([{ items: [L(1080, 'a'), leave] }, { items: [L(1080, 'a')] }, { items: [L(1080, 'a'), L(1140, 'b')] }], 3);
    assert.deepEqual([...one.items].map(i => i.kind + ':' + (i.studentId || '')), ['lesson:a', 'lesson:b']);
    const all = J._test.mergeDays([{ items: [leave] }, { items: [leave] }, { items: [leave] }], 3);
    assert.equal(all.items.filter(i => i.kind === 'leave').length, 1);
});
