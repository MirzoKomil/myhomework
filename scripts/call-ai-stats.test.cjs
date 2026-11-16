// Qo'ng'iroq AI tahlili 2-bosqich: statistika, rejalar, lid sifati (soxta ma'lumot bilan).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../server/services/callAiStats');
const P = require('../server/services/callPlans');

const DAY = 86400000;
const NOW = Date.parse('2026-11-16T05:00:00Z'); // dushanba 10:00 Toshkent
const W0 = S.weekStart(NOW); // joriy hafta boshi
const ax = v => Object.fromEntries(S.AXES.map(k => [k, v[k] ?? v.all ?? 6]));
let n = 0;
function call(managerId, daysAgo, { score = 70, axes = {}, type = 'birinchi', viol = [], next = 'ertaga 12:00', outcome = 'qayta_qongiroq', leadId, lq, prob = 50, lang = 'russian' } = {}) {
    n++;
    return { id: 'ca' + n, recordingId: 'r' + n, lang, leadId: leadId || 'L' + n, managerId, managerName: managerId, callAt: new Date(W0 - daysAgo * DAY + 3600000 * 6).toISOString(), status: 'done', durationSec: 300,
        result: { type, gradable: true, score, axes: ax(axes), criteria: [], violations: viol.map(k => ({ kind: k, t: '04:52', text: k })), nextStepAt: next, outcome, saleProbability: prob, quotes: [{ t: '06:30', criterion: 'Yopish', said: 'oʻylab koʻring', should: 'ertaga 12:00 mi?' }], leadQuality: lq || null } };
}
function fixture() {
    const a = [];
    // Gulchehra: 2 hafta ketma-ket past (yopish 3), vaqtsiz yopish ko'p
    for (let w = 1; w <= 6; w++) for (let i = 0; i < 4; i++) a.push(call('gm', w * 7 - i, { score: 60, axes: { all: 7, yopish: w <= 2 ? 3 : 6, ogriq: 6 }, next: i < 3 && w <= 2 ? '' : 'ertaga 12:00' }));
    // Dildora: yaxshi
    for (let w = 1; w <= 6; w++) for (let i = 0; i < 4; i++) a.push(call('dm', w * 7 - i, { score: 88, axes: { all: 9, narx: 8 }, outcome: 'sinov_darsi' }));
    // Hamidaxon: o'tgan haftada 6 ta nasiyasiz chegirma
    for (let i = 0; i < 6; i++) a.push(call('hb', 1 + i, { score: 74, axes: { all: 8, narx: 5 }, viol: ['nasiyasiz_chegirma'] }));
    a.push(call('hb', 9, { score: 74, axes: { all: 8 } }));
    return a;
}
const managers = new Map([['gm', { name: 'Gulchehra' }], ['dm', { name: 'Dildora' }], ['hb', { name: 'Hamidaxon' }]]);

test('team KPIs: score = 7 axes average × 10, heat and ranking', () => {
    const analyses = fixture();
    const leads = new Map(analyses.map(x => [x.leadId, { id: x.leadId, name: 'Lid ' + x.leadId, status: x.managerId === 'dm' ? 'sinov-darsida' : 'boglanildi' }]));
    const res = S.team({ analyses, leads, managers, plans: [], from: W0 - 7 * DAY, to: W0, now: NOW });
    assert.equal(res.managers[0].name, 'Dildora');
    const dm = res.managers.find(m => m.id === 'dm');
    assert.equal(dm.score, Math.round((9 * 6 + 8) / 7 * 10));
    const gm = res.managers.find(m => m.id === 'gm');
    assert.equal(gm.weakest.key, 'yopish');
    assert.ok(res.kpis.trialPct > 0);
    assert.equal(res.kpis.violationsByKind[0].kind, 'nasiyasiz_chegirma');
    assert.equal(res.weekly.labels.length, 6);
    assert.ok(res.heat.every(h => h.axes));
});

test('manager profile: stages, repeated mistakes with an example, by type', () => {
    const analyses = fixture();
    const leads = new Map(analyses.map(x => [x.leadId, { id: x.leadId, name: 'Dilnoza' }]));
    const m = S.manager({ analyses, leads, managers, plans: [], from: W0 - 7 * DAY, to: W0, now: NOW }, 'gm');
    assert.equal(m.stages.length, 7);
    assert.equal(m.stages.find(s => s.key === 'yopish').pct, 30);
    assert.ok(m.issues.some(i => i.kind === 'vaqtsiz' && i.count === 3 && i.example.callId));
    assert.equal(m.byType[0].type, 'birinchi');
    assert.equal(m.rank, 3);
});

test('weekly job: low 2 weeks → full plan (pending), 5+ violations → mini-plan; approve → active', async () => {
    const store = {};
    const db = { async getJsonData(k) { return store[k] ?? []; }, async tx(fn) { return fn({}); }, async saveJsonData(_c, k, v) { store[k] = JSON.parse(JSON.stringify(v)); },
        async mutateJsonData(k, fn) { const l = Array.isArray(store[k]) ? store[k] : []; const out = await fn(l); store[k] = l; return out; } };
    const analyses = fixture();
    const r = await P.weekly(db, { analyses, managers, now: NOW, env: {}, force: true, log: { error() {} } });
    const plans = store.callPlans;
    const full = plans.find(p => p.managerId === 'gm');
    assert.equal(full.kind, 'full'); assert.equal(full.status, 'pending'); assert.equal(full.focus, 'yopish'); assert.equal(full.weeks.length, 3);
    assert.equal(full.goals[0].key, 'close');
    const mini = plans.find(p => p.managerId === 'hb');
    assert.equal(mini.kind, 'mini'); assert.equal(mini.violKind, 'nasiyasiz_chegirma'); assert.equal(mini.weeks.length, 1);
    assert.ok(!plans.some(p => p.managerId === 'dm'));
    assert.ok(r.changes.length >= 2);
    assert.ok(store.callWeeklyReports.length === 1 && store.callWeeklyReports[0].data.mistakes.length);
    const ap = await P.act(db, full.id, 'approve', {}, 'Islom');
    assert.equal(ap.status, 'active');
    await assert.rejects(P.act(db, full.id, 'task', { taskId: full.weeks[0].tasks.find(x => x.who === 'AI').id, done: true }, 'G'), /AI/);
    const t0 = full.weeks[0].tasks.find(x => x.who === 'Menejer');
    const done = await P.act(db, full.id, 'task', { taskId: t0.id, done: true, role: 'sales_manager' }, 'G');
    assert.ok(done.weeks[0].tasks.find(x => x.id === t0.id).done);
    // Bir hafta o'tdi, yopish yaxshilanmadi → 1-hafta bajarilmadi, 2-hafta fokus davom + 1:1.
    const later = analyses.concat([0, 1, 2].map(i => call('gm', -2 - i, { score: 58, axes: { all: 6, yopish: 3 }, next: '' })));
    await P.weekly(db, { analyses: later, managers, now: NOW + 7 * DAY, env: {}, force: true, log: { error() {} } });
    const p2 = store.callPlans.find(p => p.id === full.id);
    assert.equal(p2.weeks[0].status, 'failed');
    assert.equal(p2.weeks[1].status, 'current');
    assert.match(p2.weeks[1].title, /davom/);
    const v = P.view(p2, later, managers, NOW + 8 * DAY);
    assert.equal(v.current.label, '2-hafta');
});

test('lead quality: grouped by ad, reasons, under-21 share', () => {
    const a = [
        call('gm', 2, { lq: { targeted: true, reason: 'maqsadli', age: 30 }, leadId: 'A1' }),
        call('gm', 2, { lq: { targeted: false, reason: 'yosh_talaba', age: 17, adQuote: 'Videoda bepul dars deyilgan edi' }, leadId: 'A2' }),
        call('dm', 3, { lq: { targeted: false, reason: 'yosh_talaba', age: 19 }, leadId: 'A3' }),
        call('dm', 3, { lq: { targeted: true, reason: 'maqsadli' }, leadId: 'O1' }),
    ];
    const leads = new Map([['A1', { metaAdName: 'Mashina bola' }], ['A2', { metaAdName: 'Mashina bola' }], ['A3', { metaAdName: 'Mashina bola' }], ['O1', { source: 'domwork.uz', leadType: 'organic' }]]);
    const q = S.leadQuality({ analyses: a, leads, from: W0 - 7 * DAY, to: W0 });
    assert.equal(q.total, 4); assert.equal(q.targetedPct, 50);
    const mb = q.bySource.find(s => /Mashina/.test(s.name));
    assert.deepEqual([mb.leads, mb.pct, mb.youngPct], [3, 33, 67]);
    assert.equal(q.reasons[0].key, 'yosh_talaba');
    assert.equal(q.quotes[0].count, 1);
});

test('settings: only known keys, validated', async () => {
    const store = {};
    const db = { async getJsonData(k) { return store[k] ?? null; }, async tx(fn) { return fn({}); }, async saveJsonData(_c, k, v) { store[k] = v; } };
    const s = await P.saveSettings(db, { planThreshold: 65, hack: 1 }, 'Admin');
    assert.equal(s.planThreshold, 65); assert.equal(s.hack, undefined);
    await assert.rejects(P.saveSettings(db, { planThreshold: 150 }), /100/);
});
