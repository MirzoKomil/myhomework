const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const workflow = require('../js/trialWorkflow');
const service = require('../server/services/trialLessons');
const { source, functionSource, appContext } = require('./helpers/lead-workflow-fixture.cjs');
const actor = { id: 'teacher-account', role: 'teacher', email: 'teacher.test' };
const teacher = { id: 'teacher-profile', name: 'Test Ustoz' };
const now = '2026-10-02T10:00:00.000Z';
function fixture(language = 'english') {
    return { id: 'lead-' + language, name: 'Test Lid', phone: '+998900000000', language,
        status: 'sinov-darsida', trialLessonAt: '2026-10-03T10:00:00.000Z',
        paymentOnboarding: { teacherId: teacher.id, trialDaysCount: 1, isTrial: true },
        comments: [{ id: 'manager-comment', type: 'trial-lesson', author: 'Test Menejer', text: 'Dars belgilandi' },
            { id: 'private-comment', type: 'note', text: 'Unrelated private note' }],
        attachments: ['photo.png', 'document.pdf'], custom: { preserve: true } };
}
const convertContext = vm.createContext({});
vm.runInContext(['parseJsonArray', 'rowToLead'].map(name => functionSource('server/db.js', name)).join('\n'), convertContext);
const fromRow = row => convertContext.rowToLead(row);
function toRow(lead) {
    const { id, name, phone, language, status, comments, attachments, ...extra_data } = lead;
    return { id, name, phone, language, status, comments, attachments, extra_data,
        updated_at: now, deleted_at: null };
}
function fakeDb(leads = [fixture()]) {
    const db = { rows: leads.map(toRow), teachers: [teacher], calls: [], audits: [], updates: 0 };
    db.query = async (sql, params = []) => {
        db.calls.push(sql);
        if (sql.includes('SELECT he.id, he.name FROM users')) return { rows: db.teachers };
        if (sql.startsWith('SELECT * FROM leads WHERE status')) return { rows: db.rows.filter(r => r.status === 'sinov-darsida' && !r.deleted_at) };
        if (sql.startsWith('SELECT * FROM leads WHERE id')) return { rows: db.rows.filter(r => r.id === params[0]).map(row => structuredClone(row)) };
        if (sql.startsWith('UPDATE leads SET extra_data')) {
            const row = db.rows.find(r => r.id === params[0]);
            row.extra_data = JSON.parse(params[1]); row.comments = JSON.parse(params[2]);
            row.updated_at = '2026-10-02T10:01:00.000Z'; db.updates++;
            return { rows: [structuredClone(row)] };
        }
        if (sql.trimStart().startsWith('UPDATE leads SET')) {
            const [id, name, phone, phone2, email, manager_id, src, language, date, external_id, status, lead_type, comments, attachments, extra_data] = params;
            const row = db.rows.find(r => r.id === id);
            Object.assign(row, { name, phone, phone2, email, manager_id, source: src, language, date, external_id, status, lead_type,
                comments: JSON.parse(comments), attachments: JSON.parse(attachments), extra_data: JSON.parse(extra_data) });
            row.updated_at = '2026-10-02T10:02:00.000Z'; db.updates++;
            return { rows: [structuredClone(row)] };
        }
        if (sql.includes('INSERT INTO lead_audit')) { db.audits.push(JSON.parse(params[4])); return { rows: [] }; }
        throw new Error('Unexpected SQL ' + sql);
    };
    db.audit = async (...args) => db.audits.push(args);
    db.save = (id, payload, user = actor) => service.updateTrialLesson(db, user, id, payload, fromRow, db.audit);
    return db;
}
function upsertContext() {
    const context = vm.createContext({ leadWorkflow: require('../js/leadWorkflow'), trialWorkflow: workflow,
        randomUUID: () => 'server-request-id', resolveLeadCreatedAt: () => now });
    vm.runInContext(['parseJsonArray', 'rowToLead', 'normalizeStoredLeadLanguage', 'leadDbPayload', 'appendLeadAudit', 'upsertLeadWithClient']
        .map(name => functionSource('server/db.js', name)).join('\n'), context);
    return context;
}

test('legacy scheduled leads become pending requests without guessing attendance; missing booking is not shown as attended', () => {
    const lead = fixture();
    assert.equal(workflow.request(lead).state, 'pending');
    assert.equal(workflow.attended(lead), false);
    assert.equal(workflow.request({ status: 'sinov-darsida' }), null);
    assert.deepEqual(workflow.REASONS.map(r => r.id), ['teacher-late', 'student-missed', 'student-rescheduled', 'teacher-rescheduled', 'attended-wants-other-teacher']);
});
test('three-way filter includes pending, accepted and missed on the left, everybody in the middle, attended on the right', () => {
    const leads = ['pending', 'accepted', 'completed', 'completed'].map((state, i) => {
        const lead = fixture(); lead.trialRequest = { ...workflow.request(lead), state, attended: i === 3 }; return lead;
    });
    assert.equal(leads.filter(l => workflow.matchesFilter(l, 'not-attended')).length, 3);
    assert.equal(leads.filter(l => workflow.matchesFilter(l, 'all')).length, 4);
    assert.equal(leads.filter(l => workflow.matchesFilter(l, 'attended')).length, 1);
});
test('acceptance must precede result; stale request and malformed result are rejected', () => {
    const req = workflow.request(fixture());
    assert.throws(() => workflow.transition(req, { requestId: req.id, action: 'outcome', attended: true }, actor, now), e => e.status === 409);
    assert.throws(() => workflow.transition(req, { requestId: 'old', action: 'accept' }, actor, now), e => e.status === 409);
    const accepted = workflow.transition(req, { requestId: req.id, action: 'accept' }, actor, now);
    assert.equal(accepted.acceptedBy, actor.id);
    assert.equal(workflow.transition(accepted, { requestId: req.id, action: 'accept' }, actor, now), null);
    for (const payload of [{ action: 'outcome', attended: 'true' }, { action: 'outcome', attended: false },
        { action: 'outcome', attended: false, reasonId: 'unknown' }, { action: 'delete', attended: true }]) {
        assert.throws(() => workflow.transition(accepted, { ...payload, requestId: req.id }, actor, now), e => e.status === 400);
    }
});
test('all five reasons are preserved; wants-another-teacher counts as actual attendance; final result cannot be silently overwritten', () => {
    const accepted = { ...workflow.request(fixture()), state: 'accepted' };
    for (const reason of workflow.REASONS) {
        const outcome = workflow.transition(accepted, { action: 'outcome', requestId: accepted.id, attended: false, reasonId: reason.id }, actor, now);
        assert.equal(outcome.reasonLabel, reason.label);
        assert.equal(outcome.attended, reason.id === 'attended-wants-other-teacher');
        assert.throws(() => workflow.transition(outcome, { action: 'outcome', requestId: accepted.id, attended: true }, actor, now), e => e.status === 409);
    }
});
test('rescheduling resets acceptance and attendance, archives the prior attempt, and ignores forged CRM attendance', () => {
    const before = fixture();
    before.trialRequest = { ...workflow.request(before), state: 'completed', attended: true, reasonLabel: 'old reason' };
    const result = workflow.syncSchedule(before, { ...before, trialScheduleRevision: 'new', trialRequest: { state: 'completed', attended: true } }, () => 'new-request', now);
    assert.equal(result.trialRequest.id, 'new-request');
    assert.equal(result.trialRequest.state, 'pending');
    assert.equal(result.trialRequest.attended, undefined);
    assert.equal(result.trialHistory[0].attended, true);
    assert.equal(result.trialHistory[0].reasonLabel, 'old reason');
    const edited = workflow.syncSchedule(before, { ...before, trialRequest: { attended: false }, trialHistory: [] }, () => 'unused', now);
    assert.deepEqual(edited.trialRequest, before.trialRequest);
});
test('trial result survives moving to payment and assigning a different paid-course teacher', () => {
    const lead = fixture(); lead.trialRequest = { ...workflow.request(lead), state: 'completed', attended: true };
    const paid = { ...lead, status: 'tolov-jarayonida', paymentOnboarding: { teacherId: 'paid-teacher' } };
    const saved = workflow.syncSchedule(lead, paid, () => 'unused', now);
    assert.equal(workflow.attended({ ...paid, ...saved }), true);
});
test('ordinary edits of incomplete legacy trial leads do not block recovery; new bookings require teacher and date', () => {
    assert.equal(workflow.syncSchedule({ status: 'sinov-darsida' }, { status: 'sinov-darsida', name: 'edit' }, () => 'id', now).trialRequest, null);
    assert.throws(() => workflow.syncSchedule(null, { status: 'sinov-darsida' }, () => 'id', now), e => e.status === 400);
});
test('teacher inbox is ownership-scoped, excludes archives/other stages, and exposes only the necessary DTO', async () => {
    const ownEn = fixture(); const ownRu = fixture('russian');
    const other = { ...fixture(), id: 'other', paymentOnboarding: { teacherId: 'another-teacher' } };
    const paid = { ...fixture(), id: 'paid', status: 'tolov-yopildi' };
    const db = fakeDb([ownEn, ownRu, other, paid]);
    db.rows.push({ ...toRow(fixture()), id: 'archived', deleted_at: now });
    const lessons = await service.listTrialLessons(db, actor, fromRow);
    assert.deepEqual(lessons.map(l => l.id), [ownEn.id, ownRu.id]);
    assert.equal(lessons[0].attachments, undefined);
    assert.equal(lessons[0].custom, undefined);
    assert.equal(lessons[0].comments.length, 1);
    assert.equal(lessons[0].teacherName, teacher.name);
});
test('non-teachers, unlinked teachers and ambiguous identity mappings cannot access the teacher inbox', async () => {
    const db = fakeDb();
    for (const role of ['admin', 'rop', 'sales_manager', 'targetolog', 'student', 'employee']) {
        await assert.rejects(service.listTrialLessons(db, { ...actor, role }, fromRow), e => e.status === 403);
    }
    for (const identities of [[], [teacher, { id: 'duplicate', name: 'Duplicate' }]]) {
        db.teachers = identities;
        await assert.rejects(service.listTrialLessons(db, actor, fromRow), e => e.status === 403);
    }
});
for (const language of ['english', 'russian']) {
    test(`${language}: acceptance and result append teacher-authored comments without losing manager notes, files or custom data`, async () => {
        const lead = fixture(language); const db = fakeDb([lead]); const requestId = workflow.request(lead).id;
        await db.save(lead.id, { action: 'accept', requestId, author: 'Forged', name: 'Forged' });
        const accepted = fromRow(db.rows[0]);
        assert.equal(accepted.trialRequest.state, 'accepted');
        assert.equal(accepted.comments.at(-1).author, teacher.name);
        assert.equal(accepted.comments.at(-1).authorRole, 'teacher');
        const result = await db.save(lead.id, { action: 'outcome', requestId, attended: false, reasonId: 'student-missed', phone: 'tampered' });
        const saved = fromRow(db.rows[0]);
        assert.equal(result.trialRequest.attended, false);
        assert.match(result.comments.at(-1).text, /O'quvchi vaqtida qatnashmadi/);
        assert.equal(saved.comments[0].author, 'Test Menejer');
        assert.equal(saved.comments[1].text, 'Unrelated private note');
        assert.deepEqual(Array.from(saved.attachments), lead.attachments);
        assert.equal(saved.phone, lead.phone);
        assert.equal(saved.custom.preserve, true);
        assert.equal(db.audits.length, 2);
        const auditCount = db.audits.length;
        await assert.rejects(db.save(lead.id, { action: 'outcome', requestId, attended: true }), e => e.status === 409);
        assert.equal(db.audits.length, auditCount);
    });
}
test('teacher cannot change another teacher’s lead, an archived lead, a moved lead or an outdated request', async () => {
    for (const [change, code] of [
        [row => { row.extra_data.paymentOnboarding.teacherId = 'other'; }, 403],
        [row => { row.deleted_at = now; }, 404],
        [row => { row.status = 'qaror-jarayonida'; }, 409]
    ]) {
        const db = fakeDb(); const original = workflow.request(fixture()).id; change(db.rows[0]);
        await assert.rejects(db.save(fixture().id, { action: 'accept', requestId: original }), e => e.status === code);
        assert.equal(db.updates, 0);
    }
    const db = fakeDb();
    await assert.rejects(db.save(fixture().id, { action: 'accept', requestId: 'stale-id' }), e => e.status === 409);
    assert.equal(db.updates, 0);
});
test('retrying acceptance is idempotent and does not duplicate comments or audit', async () => {
    const lead = fixture(); const db = fakeDb([lead]); const payload = { action: 'accept', requestId: workflow.request(lead).id };
    await db.save(lead.id, payload); await db.save(lead.id, payload);
    assert.equal(db.updates, 1); assert.equal(db.audits.length, 1);
});
test('string JSON extra_data is parsed and preserved during a teacher result', async () => {
    const lead = fixture(); const db = fakeDb([lead]); db.rows[0].extra_data = JSON.stringify(db.rows[0].extra_data);
    await db.save(lead.id, { action: 'accept', requestId: workflow.request(lead).id });
    assert.equal(db.rows[0].extra_data.custom.preserve, true);
});
test('actual server upsert protects teacher state/history from CRM snapshots, rejects stale manager writes and creates a fresh request on reschedule', async () => {
    const lead = fixture(); lead.trialRequest = { ...workflow.request(lead), state: 'completed', attended: true };
    lead.trialHistory = [{ id: 'prior-history', attended: false }];
    const db = fakeDb([lead]); const context = upsertContext();
    const saved = await context.upsertLeadWithClient(db, { id: lead.id, updatedAt: now, trialRequest: { attended: false }, trialHistory: [] }, 'english');
    assert.equal(saved.trialRequest.attended, true); assert.equal(saved.trialHistory.length, 1);
    await assert.rejects(context.upsertLeadWithClient(db, { id: lead.id, updatedAt: now, comments: [] }, 'english'), e => e.status === 409);
    const rescheduled = await context.upsertLeadWithClient(db, { id: lead.id, updatedAt: db.rows[0].updated_at,
        trialScheduleRevision: 'new-attempt', paymentOnboarding: { ...lead.paymentOnboarding, teacherId: 'new-teacher' } }, 'english');
    assert.equal(rescheduled.trialRequest.teacherId, 'new-teacher');
    assert.equal(rescheduled.trialRequest.state, 'pending');
    assert.equal(rescheduled.trialHistory.length, 2);
    assert.equal(rescheduled.trialHistory[1].attended, true);
    assert.deepEqual(Array.from(rescheduled.attachments), lead.attachments);
});
test('teacher update and its audit roll back together if audit storage fails', async () => {
    const db = fakeDb(); const initial = structuredClone(db.rows);
    const regularQuery = db.query;
    db.query = async (sql, params) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
        if (sql === 'ROLLBACK') { db.rows = structuredClone(initial); return { rows: [] }; }
        return regularQuery(sql, params);
    };
    db.release = () => {};
    const context = vm.createContext({ pool: { connect: async () => db }, trialLessons: service,
        rowToLead: fromRow, appendLeadAudit: async () => { throw new Error('audit failure'); } });
    vm.runInContext(functionSource('server/db.js', 'tx') + '\n' + functionSource('server/db.js', 'saveTeacherTrialLesson'), context);
    await assert.rejects(context.saveTeacherTrialLesson(actor, fixture().id,
        { action: 'accept', requestId: workflow.request(fixture()).id }), /audit failure/);
    assert.deepEqual(db.rows, initial);
});

test('CRM cannot forge attended state or prior history on an unscheduled lead outside the trial stage', async () => {
    const lead = { ...fixture(), status: 'yangi-lidlar', trialLessonAt: null, paymentOnboarding: {} };
    const db = fakeDb([lead]); const context = upsertContext();
    const saved = await context.upsertLeadWithClient(db, { id: lead.id, updatedAt: now,
        trialRequest: { id: 'forged', attended: true }, trialHistory: [{ attended: true }] }, 'english');
    assert.equal(saved.trialRequest, null); assert.equal(saved.trialHistory.length, 0);
    assert.equal(workflow.attended(saved), false);
});
test('filter order and checkmark are rendered accessibly, and unset/missed attendance is not marked complete', () => {
    const context = appContext(['getTrialAttendanceFilter', 'renderTrialAttendanceFilter', 'renderTrialAttendanceBadge', 'renderLeadTrialStatus', 'normalizeLeadStatus'], {
        _trialAttendanceFilter: 'all', localStorage: { getItem: () => 'all' }, escapeHtml: s => String(s || '')
    });
    const html = context.renderTrialAttendanceFilter();
    assert.ok(html.indexOf('data-trial-filter="not-attended"') < html.indexOf('data-trial-filter="all"'));
    assert.ok(html.indexOf('data-trial-filter="all"') < html.indexOf('data-trial-filter="attended"'));
    assert.match(html, /data-trial-filter="all" aria-pressed="true"/);
    const lead = fixture();
    assert.equal(context.renderTrialAttendanceBadge(lead), '');
    lead.trialRequest = { ...workflow.request(lead), state: 'completed', attended: false };
    assert.equal(context.renderTrialAttendanceBadge(lead), '');
    assert.match(context.renderLeadTrialStatus(lead), /Qatnashmadi/);
    lead.trialRequest.attended = true;
    assert.match(context.renderTrialAttendanceBadge(lead), /aria-label="Sinov darsida qatnashdi"/);
});
test('teacher-only sidebar item is between academic/mobile, API remains ownership-scoped, and browser schedule saves manager attribution', () => {
    const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
    assert.ok(html.indexOf('id="menuItemAkademik"') < html.indexOf('id="menuItemTrialLessons"'));
    assert.ok(html.indexOf('id="menuItemTrialLessons"') < html.indexOf('data-tab="student-app"'));
    assert.match(source, /teacher:\s*\[[^\]]*'trial-lessons'/);
    assert.match(functionSource('js/app.js', 'openTrialScheduleModal'), /trialScheduleRevision: scheduleRevision/);
    assert.match(functionSource('js/app.js', 'openTrialScheduleModal'), /prevOutcome\.label/);
    assert.match(functionSource('js/app.js', 'renderLeadCommentItem'), /c\.type === 'trial-teacher'/);
    assert.match(functionSource('js/app.js', 'openTeacherTrialOutcome'), /const requestId = lesson.trialRequest.id/);
    assert.match(functionSource('js/app.js', 'openTeacherTrialOutcome'), /action: 'outcome', requestId/);
});

test('teacher browser save waits for the API, blocks duplicate clicks and leaves local attendance unchanged on failure', async () => {
    const lesson = { id: 'fixture', trialRequest: { id: 'current-request', state: 'accepted' } };
    let rejectSave; let refreshes = 0; const messages = []; const calls = [];
    const context = appContext(['saveTeacherTrialAction'], {
        _teacherTrialSaving: false, _teacherTrialLoadGeneration: 0, _teacherTrialLessons: [lesson],
        renderTeacherTrialLessons: () => { refreshes++; }, showMiniToast: m => messages.push(m),
        apiSaveTeacherTrialLesson: (id, payload) => { calls.push({ id, payload }); return new Promise((resolve, reject) => { rejectSave = reject; }); }
    });
    const button = { disabled: false };
    const save = context.saveTeacherTrialAction('fixture', { action: 'outcome', attended: true, requestId: 'modal-request' }, button);
    assert.equal(button.disabled, true); assert.equal(context._teacherTrialSaving, true);
    assert.equal(await context.saveTeacherTrialAction('fixture', { action: 'accept' }, button), false);
    assert.equal(calls.length, 1); assert.equal(calls[0].payload.requestId, 'modal-request');
    rejectSave(new Error('Network error'));
    assert.equal(await save, false); assert.equal(button.disabled, false); assert.equal(context._teacherTrialSaving, false);
    assert.equal(lesson.trialRequest.state, 'accepted'); assert.equal(lesson.trialRequest.attended, undefined);
    assert.deepEqual(messages, ['Network error']); assert.equal(refreshes, 1);
});

test('outcome modal requires a result and a missed reason, captures the original request ID, and closes only after confirmed save', async () => {
    let selected = null; let reason = null; let closes = 0; const validations = []; const writes = [];
    const elements = { cancelTeacherTrial: {}, confirmTeacherTrial: {}, teacherTrialReasonBlock: { hidden: true } };
    const radios = [{ addEventListener: (event, callback) => { elements.onChange = callback; } }];
    const body = { querySelector: selector => selector === '[data-trial-present]:checked' ? selected
        : selector === '[data-teacher-trial-reason]:checked' ? reason : elements.teacherTrialReasonBlock,
        querySelectorAll: () => radios };
    const lesson = { id: 'fixture', name: 'Test', trialRequest: { id: 'original-request', state: 'accepted' } };
    const context = appContext(['openTeacherTrialOutcome'], {
        _teacherTrialLessons: [lesson], _teacherTrialSaving: false,
        escapeHtml: s => String(s || ''), openModal: () => {}, wireLeadModalValidationClear: () => {},
        document: { getElementById: id => id === 'modalBody' ? body : elements[id] },
        closeModal: () => { closes++; }, showLeadModalValidation: (body, error) => validations.push(error),
        saveTeacherTrialAction: async (id, payload) => { writes.push({ id, payload }); return true; }
    });
    context.openTeacherTrialOutcome('fixture');
    await elements.confirmTeacherTrial.onclick(); assert.equal(writes.length, 0);
    selected = { value: 'no' }; elements.onChange(); assert.equal(elements.teacherTrialReasonBlock.hidden, false);
    await elements.confirmTeacherTrial.onclick(); assert.equal(writes.length, 0); assert.equal(validations.length, 2);
    reason = { value: 'student-missed' };
    // A background poll can replace the visible list, but this modal must not apply its answer to the new request.
    context._teacherTrialLessons = [{ ...lesson, trialRequest: { id: 'new-request', state: 'accepted' } }];
    await elements.confirmTeacherTrial.onclick();
    assert.equal(writes[0].payload.requestId, 'original-request');
    assert.equal(writes[0].payload.reasonId, 'student-missed'); assert.equal(closes, 1);
    selected = { value: 'yes' }; elements.onChange(); assert.equal(elements.teacherTrialReasonBlock.hidden, true);
});

test('trial API client uses the dedicated endpoint and encodes lead IDs', async () => {
    const calls = [];
    const context = vm.createContext({ apiFetch: async (path, options) => { calls.push({ path, options }); return { ok: true }; } });
    vm.runInContext(['apiFetchTeacherTrialLessons', 'apiSaveTeacherTrialLesson'].map(n => functionSource('js/api.js', n)).join('\n'), context);
    await context.apiFetchTeacherTrialLessons();
    await context.apiSaveTeacherTrialLesson('lead/one', { action: 'accept', requestId: 'req' });
    assert.equal(calls[0].path, '/api/trial-lessons');
    assert.equal(calls[1].path, '/api/trial-lessons/lead%2Fone');
    assert.equal(calls[1].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[1].options.body), { action: 'accept', requestId: 'req' });
});

test('actual Express trial router rejects missing auth and non-teachers, and forwards only authenticated teacher actions', async () => {
    const routeModule = { exports: {} }; const calls = [];
    const context = vm.createContext({ module: routeModule, require: name => {
        if (name === 'express') return require('express');
        if (name === '../middleware/auth') return { authRequired: (req, res, next) => req.user ? next() : res.status(401).json({ error: 'Auth required' }) };
        if (name === '../db') return {
            getTeacherTrialLessons: async user => { calls.push(user.id); return []; },
            saveTeacherTrialLesson: async (user, id, payload) => { calls.push({ user: user.id, id, payload }); return { id }; }
        };
        throw new Error(name);
    } });
    vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../server/routes/trialLessons.js'), 'utf8'), context);
    const dispatch = (method, url, user, body = {}) => new Promise((resolve, reject) => {
        const response = { code: 200, set() { return this; }, status(code) { this.code = code; return this; }, json(data) { resolve({ code: this.code, data }); } };
        routeModule.exports.handle({ method, url, headers: {}, user, body }, response, err => err ? reject(err) : reject(new Error('Unhandled route')));
    });
    assert.equal((await dispatch('GET', '/', null)).code, 401);
    assert.equal((await dispatch('POST', '/lead', { role: 'sales_manager' })).code, 403);
    assert.equal(calls.length, 0);
    assert.equal((await dispatch('GET', '/', actor)).code, 200);
    const result = await dispatch('POST', '/lead', actor, { action: 'accept', requestId: 'current' });
    assert.equal(result.code, 200); assert.equal(result.data.lesson.id, 'lead');
    assert.deepEqual(calls[1], { user: actor.id, id: 'lead', payload: { action: 'accept', requestId: 'current' } });
});
