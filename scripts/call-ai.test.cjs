// Qo'ng'iroq AI tahlili: navbat → Gemini → Claude → saqlash (soxta baza va soxta API bilan).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCallAi, normalizeResult, typeHintFromStatus, gradeOf, publicView } = require('../server/services/callAi');

function fakeDb(seed = {}) {
    const data = { callRecordings: [], scripts: [], ...seed };
    return {
        data,
        async getJsonData(k) { return JSON.parse(JSON.stringify(data[k] ?? [])); },
        async saveJsonData(_c, k, v) { data[k] = JSON.parse(JSON.stringify(v)); },
        async tx(fn) { return fn({}); },
        async getLeadById(id) { return id === 'L1' ? { id: 'L1', name: 'Dilnoza', status: 'sinov-darsida', managerId: 'm1' } : null; },
    };
}

function fakeFetch(calls, { claudeInput } = {}) {
    return async (url, opts) => {
        const body = JSON.parse(opts.body);
        calls.push({ url, body });
        if (url.includes('generativelanguage')) {
            const json = { segments: [{ t: '00:01', s: 'M', text: 'Assalomu alaykum, Domwork maktabidan.' }, { t: '00:40', s: 'C', text: 'Qimmat ekan.' }], durationSec: 410 };
            return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }) };
        }
        if (url.includes('anthropic')) {
            return { ok: true, status: 200, json: async () => ({ content: [{ type: 'tool_use', name: 'call_score', input: claudeInput }] }) };
        }
        throw new Error('kutilmagan url ' + url);
    };
}

const SCORED = {
    type: 'sinovdan_keyin', gradable: true, score: 99,
    axes: { ochilish: 8, ehtiyoj: 7, ogriq: 6, taqdimot: 8, narx: 6, etiroz: 6, yopish: 3 },
    criteria: [{ name: 'Taassurot', max: 15, got: 15 }, { name: 'Ehtiyojga bogʻlash', max: 25, got: 17 }, { name: 'Narx', max: 30, got: 15 }, { name: 'Yopish', max: 30, got: 14 }],
    quotes: [{ t: '04:52', said: '1,5 millionga qilib beraman', should: 'Uzum Nasiya orqali oyiga 350 mingdan' }],
    violations: [{ kind: 'nasiyasiz_chegirma', t: '04:52', text: 'Nasiyasiz chegirma' }],
    outcome: 'qayta_qongiroq', saleProbability: 55, summary: 'Yopish aniq vaqtsiz.', nextLines: ['Ertaga 12:00 mi yoki 18:00 mi?'],
};

async function waitFor(fn, ms = 2000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise(r => setTimeout(r, 10)); }
    return false;
}

test('recording goes through Gemini then Claude; score equals the criteria sum, not the model total', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cai-'));
    fs.writeFileSync(path.join(dir, 'a.m4a'), Buffer.from('audio'));
    const rec = { id: 'rec-1', lang: 'russian', leadId: 'L1', url: '/uploads/a.m4a', source: 'app', createdAt: '2026-11-16T09:32:00Z' };
    const db = fakeDb({ callRecordings: [rec], scripts: [{ lang: 'russian', title: 'Sotuv skripti', content: '<p>Narx: Standard 2,1 mln</p>' }, { lang: 'english', title: 'EN', content: 'x' }] });
    const calls = [];
    const ai = createCallAi({ db, uploadsDir: dir, env: { GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' }, fetchImpl: fakeFetch(calls, { claudeInput: SCORED }), log: { log() {}, error() {} } });
    await ai.enqueue(rec, { managerId: 'm1', managerName: 'Gulchehra' });
    assert.ok(await waitFor(async () => (await ai.all())[0]?.status === 'done'));
    const a = (await ai.all())[0];
    assert.equal(a.result.score, 61);
    assert.equal(a.result.grade.label, 'OʻRTA');
    assert.equal(a.result.typeLabel, 'Sinovdan keyin');
    const tr = await ai.loadTranscript(a.id);
    assert.equal(tr.segments.length, 2);
    assert.equal(a.transcript, undefined, 'transcript kept out of the list row');
    const claude = calls.find(c => c.url.includes('anthropic')).body;
    assert.ok(claude.messages[0].content.includes('Standard 2,1 mln'), 'script from CRM is sent');
    assert.ok(!claude.messages[0].content.includes('### EN'), 'other language script is not sent');
    assert.ok(claude.messages[0].content.includes('sinovdan_keyin'), 'CRM type hint is sent');
    assert.equal(claude.tool_choice.name, 'call_score');
    const view = publicView(a);
    assert.equal(view.transcript, undefined, 'list view has no transcript');
    assert.equal(publicView(a, { withTranscript: tr }).transcript.length, 2);
});

test('enqueue is idempotent per recording', async () => {
    const db = fakeDb();
    const ai = createCallAi({ db, uploadsDir: os.tmpdir(), env: {}, fetchImpl: async () => { throw new Error('no'); }, log: { log() {}, error() {} } });
    const rec = { id: 'rec-x', lang: 'russian', leadId: 'L1', url: '/uploads/none.m4a' };
    await ai.enqueue(rec); await ai.enqueue(rec);
    await waitFor(async () => (await ai.all()).every(x => x.status !== 'queued'));
    assert.equal((await ai.all()).length, 1);
});

test('missing keys keep the item waiting instead of failing', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cai-'));
    fs.writeFileSync(path.join(dir, 'b.m4a'), Buffer.from('audio'));
    const rec = { id: 'rec-2', lang: 'russian', leadId: 'L1', url: '/uploads/b.m4a' };
    const db = fakeDb({ callRecordings: [rec] });
    const ai = createCallAi({ db, uploadsDir: dir, env: {}, fetchImpl: async () => { throw new Error('should not call'); }, log: { log() {}, error() {} } });
    await ai.enqueue(rec);
    assert.ok(await waitFor(async () => (await ai.all())[0]?.status === 'nokey'));
});

test('short calls and reminder calls are not graded', async () => {
    const r = normalizeResult({ type: 'eslatma', gradable: true, score: 90, summary: 's' });
    assert.equal(r.gradable, false);
    assert.equal(r.score, null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cai-'));
    fs.writeFileSync(path.join(dir, 'c.m4a'), Buffer.from('audio'));
    const rec = { id: 'rec-3', lang: 'russian', leadId: 'L1', url: '/uploads/c.m4a' };
    const db = fakeDb({ callRecordings: [rec] });
    const short = async (url) => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ segments: [{ t: '00:01', s: 'M', text: 'Alo' }], durationSec: 12 }) }] } }] }) });
    const ai = createCallAi({ db, uploadsDir: dir, env: { GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' }, fetchImpl: short, log: { log() {}, error() {} } });
    await ai.enqueue(rec);
    assert.ok(await waitFor(async () => (await ai.all())[0]?.status === 'skipped'));
    assert.equal((await ai.all())[0].error, '30 soniyadan qisqa');
});

test('debt calls are marked approximate; grades follow 60/80/90 bands', () => {
    assert.equal(normalizeResult({ type: 'qarzdorlik', gradable: true, score: 70, summary: '' }).approximate, true);
    assert.deepEqual([59, 60, 79, 80, 89, 90].map(s => gradeOf(s).label), ['ZAIF', 'OʻRTA', 'OʻRTA', 'YAXSHI', 'YAXSHI', 'AʼLO']);
});

test('call type hint follows the lead column', () => {
    assert.equal(typeHintFromStatus('boglanishga-urinilmoqda', false), 'birinchi');
    assert.equal(typeHintFromStatus('boglanishga-urinilmoqda', true), 'qayta');
    assert.equal(typeHintFromStatus('sinov-darsida'), 'sinovdan_keyin');
    assert.equal(typeHintFromStatus('tolov-jarayonida'), 'tolov');
    assert.equal(typeHintFromStatus('qaror-jarayonida'), 'qayta');
});

test('forced type from ROP is sent to Claude and kept in the result', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cai-'));
    fs.writeFileSync(path.join(dir, 'd.m4a'), Buffer.from('audio'));
    const rec = { id: 'rec-4', lang: 'russian', leadId: 'L1', url: '/uploads/d.m4a' };
    const db = fakeDb({ callRecordings: [rec] });
    const calls = [];
    const ai = createCallAi({ db, uploadsDir: dir, env: { GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' }, fetchImpl: fakeFetch(calls, { claudeInput: SCORED }), log: { log() {}, error() {} } });
    const it = await ai.enqueue(rec);
    assert.ok(await waitFor(async () => (await ai.all())[0]?.status === 'done'));
    await ai.setType(it.id, 'tolov', 'Islom');
    assert.ok(await waitFor(async () => (await ai.all())[0]?.result?.type === 'tolov' && (await ai.all())[0]?.status === 'done'));
    assert.ok(calls.filter(c => c.url.includes('anthropic')).pop().body.messages[0].content.includes('ROP tomonidan belgilangan: tolov'));
});

test('a failed store write does not break later writes', async () => {
    const db = fakeDb();
    let fail = true;
    const save = db.saveJsonData;
    db.saveJsonData = async (c, k, v) => { if (fail && k === 'callAnalyses') { fail = false; throw new Error('db down'); } return save(c, k, v); };
    const ai = createCallAi({ db, uploadsDir: os.tmpdir(), env: {}, fetchImpl: async () => { throw new Error('no'); }, log: { log() {}, error() {} } });
    await assert.rejects(ai.enqueue({ id: 'r-a', lang: 'russian', leadId: 'L1', url: '/uploads/x.m4a' }));
    const it = await ai.enqueue({ id: 'r-b', lang: 'russian', leadId: 'L1', url: '/uploads/x.m4a' });
    assert.ok(it && it.recordingId === 'r-b');
});

test('appeal: once, within 48h; accept re-scores with the note and records before/after', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cai-'));
    fs.writeFileSync(path.join(dir, 'e.m4a'), Buffer.from('audio'));
    const rec = { id: 'rec-5', lang: 'russian', leadId: 'L1', url: '/uploads/e.m4a' };
    const db = fakeDb({ callRecordings: [rec] });
    const calls = [];
    const ai = createCallAi({ db, uploadsDir: dir, env: { GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' }, fetchImpl: fakeFetch(calls, { claudeInput: SCORED }), log: { log() {}, error() {} } });
    const it = await ai.enqueue(rec);
    assert.ok(await waitFor(async () => (await ai.all())[0]?.status === 'done'));
    await assert.rejects(ai.appeal(it.id, { criterion: 'Yopish', text: 'x', by: 'G' }), /sababni/);
    await assert.rejects(ai.appeal(it.id, { criterion: 'Yoʻq mezon', text: 'sabab yozildi', by: 'G' }), /mezon/);
    await ai.appeal(it.id, { criterion: 'Yopish', text: 'Mijoz oʻzi ertaga qoʻngʻiroq qilaman dedi', by: 'G' });
    await assert.rejects(ai.appeal(it.id, { criterion: 'Yopish', text: 'yana bir marta', by: 'G' }), /allaqachon/);
    const gem = calls.filter(c => c.url.includes('generativelanguage')).length;
    await ai.decideAppeal(it.id, { accept: true, by: 'Islom' });
    assert.ok(await waitFor(async () => { const a = (await ai.all())[0]; return a.status === 'done' && a.appeal.scoreAfter != null; }));
    const a = (await ai.all())[0];
    assert.equal(a.appeal.scoreBefore, 61);
    assert.equal(a.appeal.scoreAfter, 61);
    assert.equal(calls.filter(c => c.url.includes('generativelanguage')).length, gem, 'transcript reused, no second Gemini call');
    assert.ok(calls.filter(c => c.url.includes('anthropic')).pop().body.messages[0].content.includes('ROP QABUL QILGAN EʼTIROZ'));
});

test('appeal after 48h is refused; ROP task is stored and marked seen', async () => {
    const db = fakeDb({ callAnalyses: [{ id: 'ca-old', recordingId: 'r', status: 'done', analyzedAt: new Date(Date.now() - 49 * 3600e3).toISOString(), result: { score: 50 } }] });
    const ai = createCallAi({ db, uploadsDir: os.tmpdir(), env: {}, fetchImpl: async () => { throw new Error('no'); }, log: { log() {}, error() {} } });
    await assert.rejects(ai.appeal('ca-old', { criterion: 'Yopish', text: 'sabab yozildi', by: 'G' }), /48/);
    await ai.setTask('ca-old', { text: 'Bugun 18:00 gacha qayta qoʻngʻiroq', due: 'bugun 18:00', by: 'Islom' });
    await ai.taskSeen('ca-old');
    const a = (await ai.all())[0];
    assert.equal(a.task.due, 'bugun 18:00');
    assert.ok(a.task.seenAt);
});

test('accepted appeal changes only the appealed criterion', () => {
    const { mergeAppeal } = require('../server/services/callAi');
    const oldR = normalizeResult(SCORED);
    const newR = normalizeResult({ ...SCORED, criteria: [{ name: 'Taassurot', max: 15, got: 5 }, { name: 'Ehtiyojga bogʻlash', max: 25, got: 25 }, { name: 'Narx', max: 30, got: 30 }, { name: 'Yopish', max: 30, got: 24 }] });
    const m = mergeAppeal(oldR, newR, 'Yopish');
    assert.deepEqual(m.criteria.map(c => c.got), [15, 17, 15, 24]);
    assert.equal(m.score, 71);
    assert.equal(m.grade.label, 'OʻRTA');
});

test('a later re-run keeps the ROP-accepted criterion', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cai-'));
    fs.writeFileSync(path.join(dir, 'f.m4a'), Buffer.from('audio'));
    const rec = { id: 'rec-6', lang: 'russian', leadId: 'L1', url: '/uploads/f.m4a' };
    const db = fakeDb({ callRecordings: [rec] });
    let input = SCORED;
    const calls = [];
    const fetchImpl = async (url, opts) => fakeFetch(calls, { claudeInput: input })(url, opts);
    const ai = createCallAi({ db, uploadsDir: dir, env: { GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' }, fetchImpl, log: { log() {}, error() {} } });
    const it = await ai.enqueue(rec);
    assert.ok(await waitFor(async () => (await ai.all())[0]?.status === 'done'));
    await ai.appeal(it.id, { criterion: 'Yopish', text: 'mijoz vaqtni oʻzi aytmadi', by: 'G' });
    input = { ...SCORED, criteria: SCORED.criteria.map(c => (c.name === 'Yopish' ? { ...c, got: 28 } : c)) };
    await ai.decideAppeal(it.id, { accept: true, by: 'Islom' });
    assert.ok(await waitFor(async () => (await ai.all())[0]?.appeal?.scoreAfter === 75));
    input = SCORED; // keyingi qayta tahlil yana 14 beradi
    await ai.setType(it.id, 'sinovdan_keyin', 'Islom');
    assert.ok(await waitFor(async () => { const a = (await ai.all())[0]; return a.status === 'done' && a.typeChangedBy; }));
    const a = (await ai.all())[0];
    assert.equal(a.result.criteria.find(c => c.name === 'Yopish').got, 28);
    assert.equal(a.result.score, 75);
});

test('a scored call stays marked as scored while it is re-queued', async () => {
    const a = { id: 'x', status: 'queued', firstAnalyzedAt: '2026-11-16T09:40:00Z', result: null };
    assert.equal(publicView(a).scored, true);
    assert.equal(publicView({ id: 'y', status: 'queued' }).scored, false);
    const src = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'state.js'), 'utf8');
    assert.ok(src.includes("if (an || zapis.source === 'app') return res.status(403)"), 'manager cannot delete app or analysed recordings in any status');
});
