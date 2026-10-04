const { test } = require('node:test');
const assert = require('node:assert/strict');
const workflow = require('../js/leadWorkflow');
const { appContext } = require('./helpers/lead-workflow-fixture.cjs');

const combined = () => ({
  connectedSurvey: { languageLevel: 'zero', applicant: 'self', age: 30, gender: 'male',
    residenceType: 'uz', region: 'toshkent-sh', learningGoal: 'work' },
  infoProvidedSurvey: ['platform', 'price', 'format', 'terms', 'trial'].map(id => ({ id, answer: 'yes' }))
});
const schedule = () => ({ teacherId: 'teacher', lessonDayOfWeek: 1, lessonTime: '10:00',
  telegramGroupLink: 'https://t.me/fixture' });
const functions = ['normalizeLeadStatus', 'getLeadColumnIndex', 'getSkippedSurveySteps',
  'getPendingSurveyStepsBeforePayment', 'getNextSurveyStepBeforePayment',
  'getPendingSurveyStepsBeforePaymentClosed', 'getNextSurveyStepBeforePaymentClosed',
  'openTolovYopildiFlow', 'leadHasTeacherSchedule', 'startMvCascade', 'continueMvCascade',
  'dispatchLeadTargetFlow', 'needsContactFailPrompt', 'needsSifatsizLidPrompt',
  'needsTrialLessonPrompt', 'needsConnectedSurveyPrompt', 'needsInfoProvidedPrompt',
  'needsDecisionPrompt', 'needsPaymentPrompt', 'needsPaymentClosedPrompt', 'needsFailedSalePrompt'];

function fixture(lang, extraFunctions = [], globals = {}) {
  let lead = { id: 'fixture', name: 'Fixture', status: 'yangi-lidlar', comments: [{ id: 'original' }],
    attachments: ['contract.pdf'], custom: 'keep' };
  const calls = [];
  const record = name => (...args) => {
    assert.equal(args[0], lang);
    assert.equal(args[1], 'fixture');
    calls.push({ name, options: args.at(-1) });
  };
  const context = appContext([...functions, ...extraFunctions], {
    _mvCascade: null, SURVEY_CASCADE_TARGETS: new Set(['sinov-darsida', 'tolov-yopildi']),
    getLeadById: () => lead,
    openConnectedSurveyModal: record('connected'), openContactFailModal: record('contact-fail'),
    openInfoProvidedModal: record('info'), openDecisionProcessModal: record('decision'),
    openPaymentTeacherScheduleModal: record('teacher'), openPaymentProcessModal: record('payment'),
    openPaymentOnboardingModal: record('onboarding'), openPaymentClosedModal: record('closed'),
    moveLeadToStatus: () => { throw new Error('Must not move before payment confirmation'); },
    ...globals
  });
  return { context, calls, get lead() { return lead; }, set lead(value) { lead = value; } };
}

test('direct payment closure has the same required preliminary survey as payment processing', () => {
  const { context } = fixture('russian');
  for (const status of ['new', 'yangi-lidlar', 'boglanishga-urinilmoqda']) {
    assert.deepEqual(Array.from(context.getPendingSurveyStepsBeforePaymentClosed(status)), ['connected']);
    assert.equal(context.getNextSurveyStepBeforePaymentClosed(status, {}), 'connected');
    assert.equal(context.getNextSurveyStepBeforePaymentClosed(status, combined()), 'payment-closed');
    assert.equal(context.getNextSurveyStepBeforePaymentClosed(status, {
      ...combined(), comments: [{ type: 'contact-fail' }], decisionSurvey: { reason: 'existing' }
    }), 'payment-closed');
  }
  for (const status of ['boglanildi', 'malumot-berildi', workflow.DEFERRED_STATUS]) {
    assert.equal(context.getNextSurveyStepBeforePaymentClosed(status, {}), 'connected');
    assert.equal(context.getNextSurveyStepBeforePaymentClosed(status, combined()), 'payment-closed');
  }
  for (const status of ['sinov-darsida', 'qaror-jarayonida', 'tolov-jarayonida']) {
    assert.deepEqual(Array.from(context.getPendingSurveyStepsBeforePaymentClosed(status)), []);
    assert.equal(context.getNextSurveyStepBeforePaymentClosed(status, combined()), 'payment-closed');
  }
});

for (const lang of ['english', 'russian']) {
  test(`${lang}: closure proceeds connected -> teacher -> payment -> onboarding -> closure without synthetic contact failure`, () => {
    const f = fixture(lang);
    const initial = structuredClone(f.lead);
    const open = () => f.context.openTolovYopildiFlow(lang, 'fixture', f.lead.status);
    open();
    assert.equal(f.calls.at(-1).name, 'connected');
    assert.deepEqual(f.lead, initial, 'Opening/cancelling must not write answers, comments or status');
    f.lead = { ...f.lead, ...combined() };
    open();
    assert.equal(f.calls.at(-1).name, 'teacher');
    f.lead.paymentOnboarding = schedule();
    open();
    assert.equal(f.calls.at(-1).name, 'payment');
    f.lead.paymentSurvey = { paidAmount: 600000, receipt: '/uploads/fixture.png' };
    open();
    assert.equal(f.calls.at(-1).name, 'onboarding');
    f.lead.paymentOnboarding.becomeStudent = true;
    open();
    assert.deepEqual(f.calls.map(c => c.name), ['connected', 'teacher', 'payment', 'onboarding', 'closed']);
    assert.ok(f.calls.slice(0, -1).every(c => c.options.chainTo === 'tolov-yopildi'));
    assert.equal(f.lead.status, 'yangi-lidlar');
    assert.deepEqual(f.lead.comments, initial.comments);
    assert.deepEqual(f.lead.attachments, initial.attachments);
    assert.equal(f.lead.custom, 'keep');
    assert.equal(f.lead.paymentSurvey.paidAmount, 600000);
  });

  for (const entry of ['menu', 'drag']) {
    test(`${lang}: actual ${entry} handler cascades only the combined survey, then resumes payment`, () => {
      let handler;
      const menuButton = { dataset: { leadMenuMove: lang, leadId: 'fixture', moveTo: 'tolov-yopildi' },
        addEventListener: (name, cb) => { if (name === 'click') handler = cb; } };
      const zone = { dataset: { dropStatus: 'tolov-yopildi' }, classList: { remove() {} },
        addEventListener: (name, cb) => { if (name === 'drop') handler = cb; } };
      const board = { querySelectorAll: selector => {
        if (entry === 'menu' && selector === '[data-lead-menu-move]') return [menuButton];
        if (entry === 'drag' && selector === '.lead-column-cards') return [zone];
        return [];
      } };
      const f = fixture(lang, [entry === 'menu' ? 'renderLeads' : 'initLeadDragDrop'], {
        document: { getElementById: id => id === 'leadsKanban' ? board : null, querySelectorAll: () => [] },
        getCurrentUser: () => ({ role: 'admin' }), isLeadsReadOnly: () => false,
        backfillMissingLeadSerials() {}, renderLeadsManagerFilter() {}, renderLeadsColumnsFilter() {},
        _leadsLangFilter: lang, _leadSearchQuery: '', STORAGE_KEYS: { leads: 'leads' },
        getItem: () => ({ [lang]: [] }), filterLeadsByManager: rows => rows,
        getVisibleLeadColumns: () => [{ id: 'yangi-lidlar', label: 'Yangi lidlar' }],
        updateLeadSearchStatus() {}, initLeadDragDrop() {}, wireLeadContactReasonFilter() {},
        refreshLeadRecordingCounts() {}, closeLeadCardMenus() {}
      });
      if (entry === 'menu') f.context.renderLeads();
      else f.context.initLeadDragDrop(board);
      handler({ stopPropagation() {}, preventDefault() {}, dataTransfer: {
        getData: () => JSON.stringify({ id: 'fixture', lang, fromStatus: 'yangi-lidlar' })
      } });
      assert.equal(f.calls.at(-1).name, 'connected');
      assert.equal(f.calls.at(-1).options.chainTo, '__cascade__');
      f.lead = { ...f.lead, ...combined() };
      f.context.continueMvCascade();
      assert.deepEqual(f.calls.map(c => c.name), ['connected', 'teacher']);
      assert.equal(f.lead.status, 'yangi-lidlar');
      // Existing combined answers must be reused when the menu/drop is opened again.
      handler({ stopPropagation() {}, preventDefault() {}, dataTransfer: {
        getData: () => JSON.stringify({ id: 'fixture', lang, fromStatus: 'yangi-lidlar' })
      } });
      assert.equal(f.calls.at(-1).name, 'teacher');
    });
  }
}

test('failed-contact reasons are still required only when moving a new lead to contact attempts', () => {
  const { context } = fixture('russian');
  assert.equal(context.needsContactFailPrompt('yangi-lidlar', 'boglanishga-urinilmoqda'), true);
  assert.equal(context.needsContactFailPrompt('yangi-lidlar', 'tolov-yopildi'), false);
  assert.equal(context.needsContactFailPrompt('yangi-lidlar', 'tolov-jarayonida'), false);
});
