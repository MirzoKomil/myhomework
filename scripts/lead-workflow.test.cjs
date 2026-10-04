const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const workflow = require('../js/leadWorkflow');
const stages = require('../server/services/leadStages');
const { migrateMergedLeadStage } = require('../server/services/leadWorkflowMigration');
const { source, functionSource, appContext } = require('./helpers/lead-workflow-fixture.cjs');
const dates = { purchaseDate: '2026-11-15', contactDate: '2026-11-01' };
const deferred = (reasonId = 'no-money') => ({ reasonId, ...dates, otherReason: reasonId === 'other' ? 'Oilaviy sabab' : '' });
const connected = () => ({ languageLevel: 'zero', applicant: 'self', age: 30, gender: 'male',
  residenceType: 'uz', region: 'toshkent-sh', learningGoal: 'work' });
const info = () => ['platform', 'price', 'format', 'terms', 'trial'].map(id => ({ id, answer: 'yes' }));
const combinedLead = () => ({ connectedSurvey: connected(), infoProvidedSurvey: info() });

test('browser columns, dashboard funnel and public API share the requested order and legacy alias', () => {
  const expected = ['yangi-lidlar', 'boglanishga-urinilmoqda', 'boglanildi', 'sinov-darsida',
    'qaror-jarayonida', 'keyin-sotib-olmoqchi', 'tolov-jarayonida', 'tolov-yopildi'];
  const context = appContext(['normalizeLeadStatus']);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(FUNNEL_STAGES.map(s => s.id))', context)), expected);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(LEAD_COLUMNS.slice(0, 8).map(s => s.id))', context)), expected);
  assert.deepEqual(stages.FUNNEL_STAGES.map(s => s.id), expected);
  assert.equal(context.normalizeLeadStatus('malumot-berildi'), 'boglanildi');
  assert.equal(stages.normalizeLeadStatus('malumot-berildi'), 'boglanildi');
  assert.equal(stages.normalizeLeadStatus(workflow.DEFERRED_STATUS), workflow.DEFERRED_STATUS);
});
test('old column preferences reveal the new column and merge previously visible information column', () => {
  const saved = { boglanildi: false, 'malumot-berildi': true, 'sinov-darsida': false };
  const context = appContext(['getDefaultVisibleColumnIds', 'loadVisibleColumnIds'], {
    LEAD_COLUMNS_HIDDEN_BY_DEFAULT: new Set(['muvaffaqiyatsiz-sotuv', 'sifatsiz-lidlar']),
    LEADS_COLUMN_VISIBILITY_KEY: 'fixture', localStorage: { getItem: () => JSON.stringify(saved) }
  });
  const visible = Array.from(context.loadVisibleColumnIds());
  assert.ok(visible.includes('boglanildi'));
  assert.ok(visible.includes(workflow.DEFERRED_STATUS));
  assert.equal(visible.includes('sinov-darsida'), false);
  assert.equal(visible.includes('malumot-berildi'), false);
  saved[workflow.DEFERRED_STATUS] = false;
  assert.equal(context.loadVisibleColumnIds().includes(workflow.DEFERRED_STATUS), false);
});
test('all five postponement reasons are accepted only with both valid dates and mandatory Other text', () => {
  for (const reason of workflow.DEFERRED_REASONS) assert.equal(workflow.validateDeferredSurvey(deferred(reason.id)), null);
  for (const invalid of [null, {}, { ...deferred(), reasonId: 'unknown' }, { ...deferred('other'), otherReason: '   ' },
    { ...deferred(), purchaseDate: '' }, { ...deferred(), contactDate: '' },
    { ...deferred(), purchaseDate: '2026-02-30' }, { ...deferred(), contactDate: '01.11.2026' }]) {
    assert.ok(workflow.validateDeferredSurvey(invalid)?.error);
  }
  assert.equal(workflow.isDate('2028-02-29'), true);
  assert.equal(workflow.isDate('2026-02-29'), false);
  assert.equal(workflow.displayDate(dates.purchaseDate), '15.11.2026');
});
test('server requires both surveys on entering Connected, but does not invalidate legacy records on ordinary edits', () => {
  for (const incomplete of [{}, { connectedSurvey: connected() }, { infoProvidedSurvey: info() },
    { ...combinedLead(), infoProvidedSurvey: info().slice(1) },
    { ...combinedLead(), connectedSurvey: { ...connected(), age: 100 } }]) {
    assert.ok(workflow.validateStageChange({ status: 'new' }, { status: 'boglanildi', ...incomplete }));
  }
  assert.equal(workflow.validateStageChange({ status: 'new' }, { status: 'boglanildi', ...combinedLead() }), null);
  assert.equal(workflow.validateStageChange({ status: 'malumot-berildi' }, { status: 'boglanildi' }), null);
  assert.equal(workflow.validateStageChange({ status: 'boglanildi' }, { status: 'boglanildi', name: 'Edited' }), null);
  assert.ok(workflow.validateStageChange(null, { status: workflow.DEFERRED_STATUS }));
  assert.equal(workflow.validateStageChange(null, { status: workflow.DEFERRED_STATUS, deferredPurchaseSurvey: deferred() }), null);
});
test('actual server upsert rejects missing mandatory answers before any lead mutation', async () => {
  const context = vm.createContext({ leadWorkflow: workflow });
  vm.runInContext(functionSource('server/db.js', 'upsertLeadWithClient'), context);
  const calls = [];
  const client = { query: async sql => { calls.push(sql); return { rows: [] }; } };
  for (const status of ['boglanildi', workflow.DEFERRED_STATUS]) {
    await assert.rejects(context.upsertLeadWithClient(client, { id: 'fixture', status }, 'russian'), err =>
      err.code === 'LEAD_SURVEY_REQUIRED' && err.status === 400);
  }
  assert.equal(calls.length, 2);
  assert.ok(calls.every(sql => sql.startsWith('SELECT')));
});
function serverUpsertDb(initial = null) {
  const db = { row: initial, audit: [], calls: [] };
  db.query = async (sql, params) => {
    db.calls.push(sql);
    if (sql.startsWith('SELECT * FROM leads')) return { rows: db.row ? [structuredClone(db.row)] : [] };
    if (/^(INSERT INTO leads|UPDATE leads SET)/.test(sql.trimStart())) {
      const [id, name, phone, phone2, email, manager_id, source, language, date, external_id, status, lead_type,
        comments, attachments, extra] = params;
      db.row = { id, name, phone, phone2, email, manager_id, source, language, date, external_id, status, lead_type,
        comments, attachments, extra_data: JSON.parse(extra), created_at: db.row?.created_at || params[15],
        updated_at: '2026-10-02T00:00:00Z', deleted_at: null };
      return { rows: [structuredClone(db.row)] };
    }
    if (sql.includes('INSERT INTO lead_audit')) {
      db.audit.push(JSON.parse(params[4])); return { rows: [] };
    }
    throw new Error('Unexpected SQL: ' + sql);
  };
  const context = vm.createContext({ leadWorkflow: workflow,
    resolveLeadCreatedAt: (existing, incoming) => existing || incoming || '2026-10-02T00:00:00Z' });
  vm.runInContext(['parseJsonArray', 'rowToLead', 'normalizeStoredLeadLanguage', 'leadDbPayload', 'appendLeadAudit', 'upsertLeadWithClient']
    .map(name => functionSource('server/db.js', name)).join('\n'), context);
  db.save = lead => context.upsertLeadWithClient(db, lead, 'russian');
  return db;
}
test('actual server upsert persists deferred dates, reason and custom data without dropping comments or files', async () => {
  const db = serverUpsertDb();
  const saved = await db.save({ id: 'fixture', name: 'Fixture', status: workflow.DEFERRED_STATUS,
    deferredPurchaseSurvey: deferred('other'), custom: 'keep', comments: [{ text: 'Saved' }], attachments: ['photo.png', 'contract.pdf'] });
  assert.equal(saved.status, workflow.DEFERRED_STATUS);
  assert.equal(saved.deferredPurchaseSurvey.purchaseDate, dates.purchaseDate);
  assert.equal(saved.deferredPurchaseSurvey.contactDate, dates.contactDate);
  assert.equal(saved.custom, 'keep');
  assert.equal(saved.comments[0].text, 'Saved');
  assert.deepEqual(Array.from(saved.attachments), ['photo.png', 'contract.pdf']);
  const original = structuredClone(db.row);
  await assert.rejects(db.save({ id: 'fixture', updatedAt: db.row.updated_at, deferredPurchaseSurvey: null }), /kechiktirganini/);
  assert.deepEqual(db.row, original);
});
test('an ordinary edit of a migrated recovery lead does not falsely mark its historic stage as reviewed', async () => {
  const db = serverUpsertDb({ id: 'fixture', name: 'Fixture', status: 'boglanildi', language: 'russian',
    updated_at: '2026-10-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z', comments: '[]', attachments: '[]',
    extra_data: { recoveryPending: true, recoveryImportedStatus: 'malumot-berildi' } });
  const saved = await db.save({ id: 'fixture', name: 'Edited', status: 'malumot-berildi', updatedAt: db.row.updated_at });
  assert.equal(saved.status, 'boglanildi');
  assert.equal(saved.recoveryPending, true);
  assert.equal(saved.recoveryReviewedAt, undefined);
  assert.equal(saved.createdAt, '2026-09-01T00:00:00Z');
});
function migrationDb(rows, failAudit = false) {
  const db = { rows: structuredClone(rows), audit: [], calls: [], released: 0 };
  let backup;
  db.query = async (sql, params) => {
    db.calls.push(sql);
    if (sql === 'BEGIN') { backup = { rows: structuredClone(db.rows), audit: structuredClone(db.audit) }; return { rows: [] }; }
    if (sql === 'ROLLBACK') { db.rows = backup.rows; db.audit = backup.audit; return { rows: [] }; }
    if (sql === 'COMMIT' || sql.startsWith('SELECT pg_advisory')) return { rows: [] };
    if (sql.startsWith('SELECT * FROM leads')) return { rows: structuredClone(db.rows.filter(r => r.status === 'malumot-berildi' && !r.deleted_at)) };
    if (sql.startsWith('UPDATE leads')) {
      const item = db.rows.find(r => r.id === params[0]);
      item.status = params[1]; item.updated_at = '2026-10-02T00:00:00.000Z';
      return { rows: [structuredClone(item)] };
    }
    if (sql.startsWith('INSERT INTO lead_audit')) {
      if (failAudit) throw new Error('Fixture audit failure');
      db.audit.push({ id: params[0], action: params[1], snapshot: JSON.parse(params[4]) });
      return { rows: [] };
    }
    throw new Error('Unexpected query: ' + sql);
  };
  db.release = () => { db.released++; };
  const context = vm.createContext({ pool: { connect: async () => db } });
  vm.runInContext(functionSource('server/db.js', 'tx'), context);
  db.tx = context.tx;
  return db;
}
const migrationRows = () => ['english', 'russian'].map((language, i) => ({ id: 'fixture-' + i, status: 'malumot-berildi',
  language, name: 'Student', phone: '+998900000000', manager_id: 'manager', comments: '[{"text":"Saved comment"}]',
  attachments: '["photo.png","contract.pdf"]', extra_data: { ...combinedLead(), custom: { saved: true } },
  deleted_at: null, updated_at: '2026-09-01T00:00:00Z', created_at: '2026-08-01T00:00:00Z' }));
test('migration preserves all fields in both languages, audits originals, leaves archives unchanged and is idempotent', async () => {
  const before = [...migrationRows(), { id: 'unrelated', status: 'tolov-yopildi', extra_data: { result: 100 } },
    { id: 'archived', status: 'malumot-berildi', deleted_at: '2026-09-01', extra_data: { saved: true } }];
  const db = migrationDb(before);
  let count;
  await db.tx(async client => { count = await migrateMergedLeadStage(client); });
  assert.equal(count, 2);
  for (let i = 0; i < 2; i++) {
    const { status, updated_at, ...data } = db.rows[i];
    const { status: oldStatus, updated_at: oldUpdated, ...oldData } = before[i];
    assert.equal(status, 'boglanildi');
    assert.deepEqual(data, oldData);
    assert.deepEqual(db.audit[i].snapshot.beforeRow, before[i]);
  }
  assert.deepEqual(db.rows[2], before[2]);
  assert.deepEqual(db.rows[3], before[3]);
  await db.tx(async client => { count = await migrateMergedLeadStage(client); });
  assert.equal(count, 0);
  assert.equal(db.audit.length, 2);
  assert.equal(db.calls.some(sql => /\b(?:DELETE|students|sms)\b/i.test(sql)), false);
});
test('failed audit rolls back all stage changes in the actual transaction helper', async () => {
  const before = migrationRows();
  const db = migrationDb(before, true);
  await assert.rejects(db.tx(client => migrateMergedLeadStage(client)), /audit failure/);
  assert.deepEqual(db.rows, before);
  assert.equal(db.audit.length, 0);
  assert.equal(db.released, 1);
});
test('new deferred dates render only in their own column with safe date-only formatting', () => {
  const context = appContext(['normalizeLeadStatus', 'renderDeferredPurchaseDates'], { escapeHtml: s => s });
  const html = context.renderDeferredPurchaseDates({ status: workflow.DEFERRED_STATUS, deferredPurchaseSurvey: deferred() });
  assert.ok(html.includes('15.11.2026'));
  assert.ok(html.includes('01.11.2026'));
  assert.ok(html.includes('datetime="2026-11-15"'));
  assert.equal(context.renderDeferredPurchaseDates({ status: 'boglanildi', deferredPurchaseSurvey: deferred() }), '');
});
test('skipping the optional deferred column never asks its survey; deferred leads still cannot bypass missing connected answers before payment', () => {
  const context = appContext(['normalizeLeadStatus', 'getLeadColumnIndex', 'getSkippedSurveySteps',
    'getPendingSurveyStepsBeforePayment', 'getNextSurveyStepBeforePayment',
    'getPendingSurveyStepsBeforePaymentClosed', 'getNextSurveyStepBeforePaymentClosed']);
  assert.equal(context.getNextSurveyStepBeforePayment('qaror-jarayonida', combinedLead()), 'payment');
  assert.equal(context.getNextSurveyStepBeforePayment(workflow.DEFERRED_STATUS, {}), 'connected');
  assert.equal(context.getNextSurveyStepBeforePaymentClosed(workflow.DEFERRED_STATUS, {}), 'connected');
  assert.equal(context.getPendingSurveyStepsBeforePaymentClosed('sinov-darsida').includes('decision'), false);
  assert.deepEqual(Array.from(context.getSkippedSurveySteps('yangi-lidlar', 'sinov-darsida', {})), ['connected']);
  assert.deepEqual(Array.from(context.getSkippedSurveySteps('yangi-lidlar', 'sinov-darsida', combinedLead())), []);
});
test('drag-and-drop into Deferred opens its required modal, not a direct stage write', () => {
  let drop;
  let opened;
  const zone = { dataset: { dropStatus: workflow.DEFERRED_STATUS }, classList: { remove() {} },
    addEventListener: (name, handler) => { if (name === 'drop') drop = handler; } };
  const board = { querySelectorAll: selector => selector === '.lead-column-cards' ? [zone] : [] };
  const context = appContext(['initLeadDragDrop'], { isLeadsReadOnly: () => false, getCurrentUser: () => ({ role: 'admin' }),
    openDeferredPurchaseModal: (lang, id) => { opened = { lang, id }; }, getLeadById: () => ({ status: 'new' }) });
  context.initLeadDragDrop(board);
  drop({ preventDefault() {}, dataTransfer: { getData: () => JSON.stringify({ id: 'fixture', lang: 'russian', fromStatus: 'new' }) } });
  assert.deepEqual(opened, { lang: 'russian', id: 'fixture' });
  assert.ok(source.includes("if (toStatus === leadWorkflow.DEFERRED_STATUS) { openDeferredPurchaseModal(lang, leadId); return; }"));
});
test('normalizing a lead no longer drops extra files or custom fields', () => {
  const context = appContext(['normalizeLeadExtras']);
  const result = context.normalizeLeadExtras({ id: 'fixture', comments: [], attachments: ['photo.png', 'contract.pdf'], custom: 'keep' });
  assert.deepEqual(Array.from(result.attachments), ['photo.png', 'contract.pdf']);
  assert.equal(result.custom, 'keep');
});

test('Deferred is not a payment stage and never creates a student platform account', async () => {
  const { provisionLeadStudent } = require('../server/services/leadStudentProvisioning');
  const result = await provisionLeadStudent({ query: () => { throw new Error('Must not query students'); } },
    { status: workflow.DEFERRED_STATUS });
  assert.equal(result, null);
});

for (const lang of ['english', 'russian']) {
  for (const chainTo of [null, 'tolov-yopildi', '__cascade__']) {
  test(`${lang}: combined modal (${chainTo || 'direct'}) saves both surveys atomically and blocks missing information answers`, () => {
    let lead = { id: 'fixture', name: 'Fixture', status: 'yangi-lidlar', custom: 'keep', comments: [{ id: 'original' }],
      attachments: ['photo.png', 'contract.pdf'], connectedSurvey: { customAnswer: 'keep' } };
    let writes = 0;
    let html;
    let error;
    let continued = 0;
    let cancelled = 0;
    const answers = {};
    const fields = { languageLevel: 'zero', applicant: 'self', gender: 'male', learningGoal: 'work', residenceType: 'uz', uzRegion: 'toshkent-sh' };
    const age = { value: '27', min: '7', max: '70', style: { setProperty() {} }, addEventListener() {} };
    const modalBody = { addEventListener() {}, querySelectorAll: () => [], querySelector: selector => {
      if (selector === '#leadSurveyAge') return age;
      if (selector === '#leadSurveyAgeValue') return {};
      if (selector === '#surveyRegionBlock' || selector === '#surveyCountryBlock') return {};
      if (selector.includes('residenceType') && selector.includes('[value="uz"]')) return { checked: true };
      let match = selector.match(/\[data-survey-field="([^"]+)"\]:checked/);
      if (match) return fields[match[1]] ? { value: fields[match[1]] } : null;
      match = selector.match(/\[data-info-field="([^"]+)"\]:checked/);
      if (match) return answers[match[1]] ? { value: answers[match[1]] } : null;
      return null;
    } };
    const elements = { modalBody, confirmConnectedSurvey: {}, cancelConnectedSurvey: {} };
    const context = appContext(['normalizeLeadStatus', 'normalizeLeadExtras', 'openConnectedSurveyModal',
      'renderSurveyRadioGroup', 'renderSurveyCarousel', 'renderInfoProvidedQuestions', 'collectConnectedSurveyData',
      'getSurveyOptionLabel', 'collectInfoProvidedData', 'formatConnectedSurveyComment', 'formatInfoProvidedComment'], {
      getLeadById: () => lead, document: { getElementById: id => elements[id] }, escapeHtml: String,
      openModal: (_title, body) => { html = body; }, wireLeadModalValidationClear() {}, initSurveyCarousels() {},
      showLeadModalValidation: (_body, result) => { error = result.error; },
      showInfoProvidedValidation: (_body, result) => { error = result.error; },
      closeModal() { cancelled++; }, renderLeads() {}, getCurrentUser: () => ({ name: 'Fixture admin' }), createLeadComment: c => c,
      openTolovYopildiFlow(language, id, status) {
        assert.equal(language, lang); assert.equal(id, 'fixture'); assert.equal(status, 'yangi-lidlar');
        assert.equal(workflow.hasCombinedSurvey(lead), true); continued++;
      },
      continueMvCascade() { assert.equal(workflow.hasCombinedSurvey(lead), true); continued++; },
      updateLeadInStorage: (language, id, updater) => {
        assert.equal(language, lang); assert.equal(id, 'fixture'); writes++; lead = updater(lead); return lead;
      }
    });
    context.openConnectedSurveyModal(lang, 'fixture', chainTo ? 'tolov-yopildi' : 'boglanildi', { chainTo });
    assert.ok(html.includes('Til darajasi'));
    for (const question of ['platform', 'price', 'format', 'terms', 'trial']) assert.ok(html.includes(`data-info-question="${question}"`));
    elements.cancelConnectedSurvey.onclick();
    assert.equal(cancelled, 1);
    assert.equal(writes, 0);
    assert.equal(continued, 0);
    assert.equal(lead.status, 'yangi-lidlar');
    elements.confirmConnectedSurvey.onclick();
    assert.equal(writes, 0);
    assert.ok(error);
    for (const question of ['platform', 'price', 'format', 'terms', 'trial']) answers[question] = 'yes';
    elements.confirmConnectedSurvey.onclick();
    assert.equal(writes, 1);
    assert.equal(lead.status, chainTo ? 'yangi-lidlar' : 'boglanildi');
    assert.equal(continued, chainTo ? 1 : 0);
    assert.equal(workflow.hasCombinedSurvey(lead), true);
    assert.equal(lead.connectedSurvey.customAnswer, 'keep');
    assert.equal(lead.comments[0].id, 'original');
    assert.deepEqual(Array.from(lead.attachments), ['photo.png', 'contract.pdf']);
    assert.equal(lead.custom, 'keep');
    assert.equal(lead.comments.length, 3);
  });
  }

  test(`${lang}: deferred modal requires Other text and both dates, saves survey/history and can be cancelled`, () => {
    let lead = { id: 'fixture', name: 'Fixture', status: 'qaror-jarayonida', comments: [{ id: 'original' }] };
    let writes = 0;
    let error;
    const selected = { value: 'other' };
    const fields = { '#deferredOtherReason': { value: ' ' }, '#deferredOtherBlock': { hidden: true },
      '#deferredPurchaseDate': { value: '' }, '#deferredContactDate': { value: '' } };
    let change;
    const modalBody = { querySelector: selector => selector === '[data-deferred-reason]:checked' ? selected : fields[selector],
      querySelectorAll: () => [{ addEventListener: (_event, cb) => { change = cb; } }] };
    const elements = { modalBody, cancelDeferredPurchase: {}, confirmDeferredPurchase: {} };
    const context = appContext(['collectDeferredPurchaseData', 'openDeferredPurchaseModal', 'normalizeLeadExtras'], {
      getLeadById: () => lead, escapeHtml: String, openModal() {}, wireLeadModalValidationClear() {},
      document: { getElementById: id => elements[id] }, getCurrentUser: () => ({ name: 'Fixture manager' }),
      showLeadModalValidation: (_body, result) => { error = result.error; }, closeModal() {}, renderLeads() {}, createLeadComment: c => c,
      updateLeadInStorage: (language, id, updater) => {
        assert.equal(language, lang); assert.equal(id, 'fixture'); writes++; lead = updater(lead); return lead;
      }
    });
    context.openDeferredPurchaseModal(lang, 'fixture');
    assert.equal(fields['#deferredOtherBlock'].hidden, false);
    assert.equal(fields['#deferredOtherReason'].required, true);
    elements.confirmDeferredPurchase.onclick();
    assert.equal(writes, 0);
    assert.ok(error.includes('Boshqa'));
    fields['#deferredOtherReason'].value = ' Oilaviy sabab ';
    elements.confirmDeferredPurchase.onclick();
    assert.equal(writes, 0);
    assert.ok(error.includes('sanani'));
    fields['#deferredPurchaseDate'].value = dates.purchaseDate;
    elements.confirmDeferredPurchase.onclick();
    assert.equal(writes, 0);
    fields['#deferredContactDate'].value = dates.contactDate;
    elements.confirmDeferredPurchase.onclick();
    assert.equal(writes, 1);
    assert.equal(lead.status, workflow.DEFERRED_STATUS);
    assert.equal(lead.deferredPurchaseSurvey.otherReason, 'Oilaviy sabab');
    assert.equal(lead.comments[0].id, 'original');
    assert.equal(lead.comments[1].type, 'deferred-purchase');
    assert.ok(lead.comments[1].text.includes('15.11.2026'));
    context.openDeferredPurchaseModal(lang, 'fixture');
    selected.value = 'travelling'; change();
    assert.equal(fields['#deferredOtherBlock'].hidden, true);
    assert.equal(fields['#deferredOtherReason'].required, false);
    elements.cancelDeferredPurchase.onclick();
    assert.equal(writes, 1);
  });
}
