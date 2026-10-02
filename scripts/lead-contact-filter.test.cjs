const { test } = require('node:test');
const assert = require('node:assert/strict');
const { appContext } = require('./helpers/lead-workflow-fixture.cjs');

const names = ['resolveLeadContactReason', 'getLeadContactReason', 'normalizeLeadContactReasonFilters',
  'getLeadContactReasonFilter', 'setLeadContactReasonFilter', 'leadMatchesContactReasonFilter',
  'renderLeadContactReasonBadge', 'renderLeadContactReasonFilter', 'normalizeLeadStatus'];
const labels = { 'no-answer': 'Javob bermadi', busy: "Band bo'ldi", 'phone-off': "Telefoni o'chiq",
  'call-later': "Keyinroq gaplashishni so'radi" };
const plain = value => JSON.parse(JSON.stringify(value));
const attempt = (reasonId, createdAt = '2026-10-02T10:00:00Z', rest = {}) =>
  ({ id: 'call-' + reasonId, type: 'contact-fail', reasonId, createdAt, ...rest });
const lead = (...comments) => ({ id: 'fixture', status: 'boglanishga-urinilmoqda', comments });
function context(extraNames = [], globals = {}) {
  const storage = new Map();
  return appContext([...names, ...extraNames], {
    _leadContactReasonFilters: {}, _leadContactFilterOpen: false, _leadContactFilterDismissBound: false,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll("'", '&#39;').replaceAll('<', '&lt;'),
    ...globals
  });
}

for (const [id, label] of Object.entries(labels)) {
  test(`${id}: IDs, legacy labels and Uzbek apostrophes resolve`, () => {
    const c = context();
    for (const value of [id, label, '  ' + label.toUpperCase() + '  ', label.replaceAll("'", '‘'), label.replaceAll("'", 'ʻ')]) {
      assert.equal(c.resolveLeadContactReason(value).id, id);
    }
    assert.equal(c.getLeadContactReason(lead(attempt(id))).label, label);
  });
}
test('unknown and non-string reasons do not become known categories', () => {
  const c = context();
  for (const value of [null, undefined, {}, 0, 'Barchasi', '<script>', 'other']) assert.equal(c.resolveLeadContactReason(value), null);
});
test('newest call wins even when comments are not sorted; ordinary comments are ignored', () => {
  const c = context();
  assert.equal(c.getLeadContactReason(lead(attempt('busy', '2026-10-02'),
    { type: 'note', reasonId: 'phone-off', createdAt: '2026-10-05' }, attempt('no-answer', '2026-10-01'))).id, 'busy');
  assert.equal(c.getLeadContactReason(lead(attempt('busy'), attempt('phone-off'))).id, 'phone-off');
  assert.equal(c.getLeadContactReason(lead(attempt('busy', 'invalid'), attempt('call-later', undefined))).id, 'call-later');
});
test('latest unrecognized outcome is not incorrectly classified by an older call', () => {
  assert.equal(context().getLeadContactReason(lead(attempt('busy', '2026-10-01'), attempt('unknown', '2026-10-02'))), null);
});
test('legacy raw fields and label/text comments are supported without mutating the lead', () => {
  const c = context();
  const rows = [
    { ...lead(), contactFailReasons: ["Band bo'ldi"] },
    lead(attempt(undefined, undefined, { reason: "Telefoni o‘chiq" })),
    lead(attempt(undefined, undefined, { text: "Qo‘ng‘iroq qilindi, lekin: Javob bermadi" }))
  ];
  const expected = ['busy', 'phone-off', 'no-answer'];
  rows.forEach((row, index) => {
    row.attachments = [{ id: 'file', url: '/existing.pdf' }];
    const before = JSON.stringify(row);
    assert.equal(c.getLeadContactReason(row).id, expected[index]);
    c.renderLeadContactReasonBadge(row);
    assert.equal(JSON.stringify(row), before);
  });
});
test('synthetic legacy migration notes cannot override genuine call attempts', () => {
  const c = context();
  for (const rest of [{ id: 'cf-123' }, { legacyContactFail: true }]) {
    const migration = attempt('no-answer', '2030-01-01', rest);
    assert.equal(c.getLeadContactReason(lead(attempt('busy'), migration)).id, 'busy');
    assert.equal(c.getLeadContactReason(lead(migration)).id, 'no-answer');
  }
});
test('multi-selection uses OR; empty selection includes unknown outcomes', () => {
  const c = context();
  assert.deepEqual(plain(c.normalizeLeadContactReasonFilters(['busy', 'unknown', 'no-answer', 'busy'])), ['no-answer', 'busy']);
  assert.deepEqual(plain(c.normalizeLeadContactReasonFilters('busy')), []);
  for (const id of ['no-answer', 'busy']) assert.equal(c.leadMatchesContactReasonFilter(lead(attempt(id)), ['no-answer', 'busy']), true);
  assert.equal(c.leadMatchesContactReasonFilter(lead(attempt('phone-off')), ['busy']), false);
  assert.equal(c.leadMatchesContactReasonFilter(lead(), ['busy']), false);
  assert.equal(c.leadMatchesContactReasonFilter(lead(), []), true);
});
test('language-specific filter choices persist and are normalized on restore', () => {
  const c = context();
  c.setLeadContactReasonFilter('english', ['busy', 'busy', 'invalid']);
  c.setLeadContactReasonFilter('russian', ['phone-off']);
  assert.deepEqual(plain(c.getLeadContactReasonFilter('english')), ['busy']);
  assert.deepEqual(plain(c.getLeadContactReasonFilter('russian')), ['phone-off']);
  c.localStorage.setItem('mh_contact_reason_filter_v1_english', JSON.stringify(['call-later', '<script>']));
  assert.deepEqual(plain(c.getLeadContactReasonFilter('english')), ['call-later']);
});
test('storage rejection or malformed JSON cannot break the filter', () => {
  const c = context([], { localStorage: { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } } });
  c.setLeadContactReasonFilter('english', ['busy']);
  assert.deepEqual(plain(c.getLeadContactReasonFilter('english')), ['busy']);
  c.localStorage.getItem = () => '{bad json';
  assert.deepEqual(plain(c.getLeadContactReasonFilter('english')), ['busy']);
});
test('dropdown displays all five options, unfiltered per-outcome counts and visible/total summary', () => {
  const c = context();
  const rows = [lead(attempt('busy')), lead(attempt('busy')), lead(attempt('no-answer')), lead()];
  c.setLeadContactReasonFilter('english', ['busy']);
  const html = c.renderLeadContactReasonFilter(rows, 2, 'english');
  assert.equal((html.match(/type="checkbox"/g) || []).length, 5);
  assert.match(html, /data-contact-reason-filter="busy" checked/);
  assert.match(html, /Band bo&#39;ldi<\/span><b>2<\/b>/);
  assert.match(html, /Barchasi<\/span><b>4<\/b>/);
  assert.match(html, /2 \/ 4 ta lid/);
  assert.match(html, /data-contact-reason-filter="phone-off"[\s\S]*?Telefoni o&#39;chiq<\/span><b>0<\/b>/);
});
test('reason badge appears only in contact-attempt stage and escapes labels', () => {
  const c = context();
  assert.match(c.renderLeadContactReasonBadge(lead(attempt('busy'))), /Band bo&#39;ldi/);
  assert.equal(c.renderLeadContactReasonBadge({ ...lead(attempt('busy')), status: 'boglanildi' }), '');
  assert.equal(c.renderLeadContactReasonBadge(lead()), '');
});

test('dropdown handlers support combinations, all/reset, outside dismissal and one global listener pair', () => {
  const listeners = {};
  const button = { addEventListener: (name, fn) => { button[name] = fn; }, setAttribute(name, value) { this[name] = value; }, focus() {} };
  const panel = { hidden: true };
  const inputs = ['all', ...Object.keys(labels)].map(id => ({ dataset: { contactReasonFilter: id }, checked: false,
    addEventListener(name, fn) { this[name] = fn; }, focus() {} }));
  const document = { getElementById: id => id === 'leadContactFilterPanel' ? panel : button,
    querySelector: () => inputs[0], addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); } };
  const board = { querySelector: () => button, querySelectorAll: () => inputs };
  let renders = 0;
  const c = context(['wireLeadContactReasonFilter', 'setLeadContactFilterOpen'], { document, renderLeads: () => renders++ });
  c.wireLeadContactReasonFilter(board, 'english');
  c.wireLeadContactReasonFilter(board, 'english');
  assert.equal(listeners.pointerdown.length, 1);
  assert.equal(listeners.keydown.length, 1);
  button.click({ stopPropagation() {} });
  assert.equal(panel.hidden, false);
  for (const input of inputs.slice(1, 3)) { input.checked = true; input.change(); }
  assert.deepEqual(plain(c.getLeadContactReasonFilter('english')), ['no-answer', 'busy']);
  inputs[0].change();
  assert.deepEqual(plain(c.getLeadContactReasonFilter('english')), []);
  inputs[1].checked = true; inputs[1].change();
  inputs[1].checked = false; inputs[1].change();
  assert.deepEqual(plain(c.getLeadContactReasonFilter('english')), []);
  assert.equal(renders, 5);
  listeners.keydown[0]({ key: 'Escape' }); assert.equal(panel.hidden, true);
  button.click({ stopPropagation() {} });
  listeners.pointerdown[0]({ target: { closest: () => true } }); assert.equal(panel.hidden, false);
  listeners.pointerdown[0]({ target: { closest: () => null } }); assert.equal(panel.hidden, true);
});

for (const lang of ['english', 'russian']) {
  test(`${lang}: saved call outcome keeps history/files and stable reasonId; cancel and missing selection do not write`, () => {
    let row = { ...lead(), status: 'yangi-lidlar', comments: [{ id: 'old', type: 'note', text: 'Existing' }],
      attachments: [{ id: 'file' }], custom: 'preserved' };
    let selection = 'busy', writes = 0, error;
    const elements = { cancelContactFail: {}, confirmContactFail: {}, modalBody: {
      querySelector: () => selection ? { value: selection } : null
    } };
    const c = context(['openContactFailModal', 'createLeadComment', 'normalizeLeadExtras'], {
      getLeadById: () => row, document: { getElementById: id => elements[id] },
      openModal() {}, closeModal() {}, renderLeads() {}, wireLeadModalValidationClear() {},
      showLeadModalValidation: (_el, value) => { error = value; }, getCurrentUser: () => ({ name: 'Manager' }),
      updateLeadInStorage: (language, id, update) => {
        assert.equal(language, lang); assert.equal(id, row.id); writes++; row = update(row); return row;
      }
    });
    c.openContactFailModal(lang, row.id, 'boglanishga-urinilmoqda');
    elements.cancelContactFail.onclick(); assert.equal(writes, 0);
    selection = null; elements.confirmContactFail.onclick(); assert.equal(writes, 0);
    assert.equal(error.error, 'Bitta variant tanlang');
    selection = 'busy'; elements.confirmContactFail.onclick();
    assert.equal(writes, 1); assert.equal(row.status, 'boglanishga-urinilmoqda');
    assert.equal(row.comments[0].id, 'old'); assert.equal(row.comments[1].reasonId, 'busy');
    assert.equal(row.comments[1].reason, labels.busy); assert.equal(row.comments[1].author, 'Manager');
    assert.deepEqual(plain(row.attachments), [{ id: 'file' }]); assert.equal(row.custom, 'preserved');
    assert.equal(c.getLeadContactReason(row).id, 'busy');
  });
}
