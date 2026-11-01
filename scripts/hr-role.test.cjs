// HR menejer roli (2026-11): til bo'yicha nomzod ko'rinishi, state cheklovi, rol ro'yxatlari.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const { HR_STAGES, candidateLang, candidateVisible, normalizeHrStage } = require('../server/services/hrStages');

test('ishga-olindi bosqichi yakuniy suhbatdan keyin, rad bosqichlaridan oldin', () => {
    const ids = HR_STAGES.map(s => s.id);
    assert.ok(ids.indexOf('ishga-olindi') === ids.indexOf('yakuniy-suhbat') + 1);
    assert.ok(ids.indexOf('ishga-olindi') < ids.indexOf('rad-javobi'));
    assert.strictEqual(normalizeHrStage('ishga-olindi'), 'ishga-olindi');
});

test('nomzod tili vakansiyadan; umumiy vakansiya ikkala yo‘nalishga ko‘rinadi', () => {
    assert.strictEqual(candidateLang({ vacancyId: 'rus-oqituvchi' }), 'russian');
    assert.strictEqual(candidateLang({ vacancyId: 'ingliz-yordamchi' }), 'english');
    assert.strictEqual(candidateLang({ vacancyId: 'sotuv-menejeri' }), null);
    assert.strictEqual(candidateVisible({ vacancyId: 'ingliz-oqituvchi' }, ['russian']), false);
    assert.strictEqual(candidateVisible({ vacancyId: 'rus-oqituvchi' }, ['russian']), true);
    assert.strictEqual(candidateVisible({ vacancyId: 'rop' }, ['english']), true);
    assert.strictEqual(candidateVisible({ vacancyId: 'rop' }, []), false, 'HR yozuvi yo‘q — hech narsa');
    assert.strictEqual(candidateVisible({ vacancyId: 'ingliz-oqituvchi' }, null), true, 'admin/rop — cheklov yo‘q');
});

test('hr roli server va mijozda ro‘yxatdan o‘tgan', () => {
    const auth = read('server/routes/auth.js');
    assert.strictEqual((auth.match(/'targetolog', 'hr'\]/g) || []).length, 2);
    assert.match(read('server/routes/state.js'), /'employee', 'targetolog', 'hr'\]\.includes\(req\.user\?\.role\)/);
    assert.match(read('js/teamLogin.js'), /hr: 'HR menejer'/);
    const app = read('js/app.js');
    assert.ok((app.match(/=== 'hr' \? 'hr'/g) || []).length >= 3, 'uchta rol xaritasida hr');
    assert.match(app, /role === 'hr'\) \{\n\s+setTimeout\(\(\) => switchTab\(restoreTab \|\| 'hr'/);
    assert.match(read('index.html'), /js\/hrApp\.js\?v=/);
});

test('hr uchun state: o‘quvchi kontaktlari, to‘lov va kassa kesiladi', () => {
    const { scopeState } = require('../server/services/stateScope');
    const state = { students: [{ id: 's1', phone: '+998901112233', name: 'A' }], payments: [{ id: 'p' }], cashFlow: [{ id: 'c' }], hrEmployees: [{ id: 'e', login: 'x', cardNumber: '8600', passportSeries: 'AA1' }] };
    const out = scopeState(state, { role: 'hr', email: 'hr@x' }, {});
    assert.deepStrictEqual(out.payments, []);
    assert.deepStrictEqual(out.cashFlow, []);
    assert.ok(!out.students[0].phone);
    assert.ok(!out.hrEmployees[0].cardNumber && !out.hrEmployees[0].passportSeries);
});
