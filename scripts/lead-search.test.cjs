const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { appContext, source } = require('./helpers/lead-workflow-fixture.cjs');
const roles = new Set(['admin', 'rop', 'boshliq']);
const names = ['normalizeLeadSearchText', 'leadMatchesSearch', 'canSearchLeads', 'filterLeadsByManager'];
function context(extra = {}) {
  return appContext(names, { _leadSearchQuery: '', _leadsManagerFilter: 'all', FULL_ACCESS_ROLES: roles,
    getCurrentUser: () => ({ role: 'admin' }), ...extra });
}
const lead = { id: 'unchanged', name: "Ma’rufjon Aliyev", phone: '+998 (90) 123-45-67', phone2: '+7 999 555-44-33' };
for (const q of ['Ma’ruf', "MA'RUFJON", 'aliyev maʼruf', '  ALIYEV   ', '998901234567', '+998 90 123 45 67', '123-45-67', '(90) 123', '5554433', '+7 (999) 555-44-33']) {
  test(`name or either formatted phone matches: ${q}`, () => {
    const before = JSON.stringify(lead);
    assert.equal(context().leadMatchesSearch(lead, q), true);
    assert.equal(JSON.stringify(lead), before);
  });
}
for (const q of ['nothing', 'admin', '998 91 111 11 11', '+', '---', 'aliyev missing']) {
  test(`unrelated or empty phone characters do not match: ${q}`, () => assert.equal(context().leadMatchesSearch(lead, q), false));
}
test('blank query restores all, missing fields are safe and Cyrillic/full-width input works', () => {
  const c = context();
  assert.equal(c.leadMatchesSearch({}, '   '), true);
  assert.equal(c.leadMatchesSearch({}, 'name'), false);
  assert.equal(c.leadMatchesSearch({ name: 'Фотима Алиева' }, 'АЛИЕВА фот'), true);
  assert.equal(c.leadMatchesSearch({ phone: '12345' }, '１２３'), true);
  assert.equal(c.leadMatchesSearch({ name: 'Admin Aliyev' }, 'admin'), true);
});
test('search respects manager assignment even if a filter is set to all or another manager', () => {
  const rows = [{ id: 'mine', managerId: 'm1' }, { id: 'other', managerId: 'm2' }, { id: 'free' }];
  const manager = context({ getCurrentUser: () => ({ role: 'sales_manager', linkedManagerId: 'm1' }), _leadsManagerFilter: 'm2' });
  assert.deepEqual(Array.from(manager.filterLeadsByManager(rows), r => r.id), ['mine']);
  assert.equal(context({ getCurrentUser: () => ({ role: 'sales_manager' }) }).filterLeadsByManager(rows).length, 0);
  assert.deepEqual(Array.from(context({ _leadsManagerFilter: 'unassigned' }).filterLeadsByManager(rows), r => r.id), ['free']);
  assert.equal(context().filterLeadsByManager(rows).length, 3);
});
test('only roles with lead access can use the header search', () => {
  const c = context();
  for (const role of ['admin', 'boshliq', 'rop', 'sales_manager', 'targetolog']) assert.equal(c.canSearchLeads({ role }), true);
  for (const role of ['teacher', 'hr', 'employee', 'finance', 'student']) assert.equal(c.canSearchLeads({ role }), false);
  assert.equal(c.canSearchLeads(null), false);
});

function ui(user = { role: 'admin' }) {
  const callbacks = {}, windowCallbacks = {}, timers = new Map(); let seq = 0, renders = 0, switches = 0;
  const input = { value: 'admin', defaultValue: 'admin', readOnly: true, dataset: {},
    addEventListener: (event, fn) => { callbacks[event] = fn; } };
  const status = {};
  const document = { activeElement: null, getElementById: id => id === 'globalSearch' ? input : status,
    querySelector: () => ({}) };
  const c = appContext([...names, 'initLeadSearch', 'updateLeadSearchStatus'], {
    _leadSearchQuery: '', _tabContext: { salesSection: 'leads' }, FULL_ACCESS_ROLES: roles,
    getCurrentUser: () => user, document, window: { addEventListener: (event, fn) => { windowCallbacks[event] = fn; } },
    setTimeout: fn => { timers.set(++seq, fn); return seq; }, clearTimeout: id => timers.delete(id),
    renderLeads: () => renders++, switchTab: () => switches++
  });
  const flush = () => { for (const [key, fn] of [...timers]) { timers.delete(key); fn(); } };
  c.initLeadSearch();
  return { c, input, callbacks, document, status, windowCallbacks, flush, counts: () => ({ renders, switches }) };
}
test('initial and late login autofill are cleared without starting a lead search', () => {
  const u = ui(); assert.equal(u.input.value, ''); assert.equal(u.input.defaultValue, '');
  u.input.value = 'admin'; u.flush(); assert.equal(u.input.value, '');
  u.input.value = 'admin'; u.callbacks.input({}); assert.equal(u.input.value, '');
  u.input.value = 'admin'; u.windowCallbacks.pageshow(); assert.equal(u.input.value, '');
  assert.deepEqual(u.counts(), { renders: 0, switches: 0 });
});
test('focus unlocks, typing filters, Escape/native clear restores, and autofill cannot overwrite a real query', () => {
  const u = ui(); u.document.activeElement = u.input; u.callbacks.focus();
  assert.equal(u.input.readOnly, false);
  u.input.value = 'Aliyev'; u.callbacks.input({}); u.flush();
  assert.equal(u.c._leadSearchQuery, 'Aliyev'); assert.equal(u.counts().renders, 1);
  u.document.activeElement = null; u.callbacks.blur(); assert.equal(u.input.readOnly, true);
  u.input.value = 'admin'; u.callbacks.input({}); assert.equal(u.input.value, 'Aliyev');
  u.document.activeElement = u.input; u.callbacks.focus();
  u.callbacks.keydown({ key: 'Escape' }); assert.equal(u.c._leadSearchQuery, '');
  u.input.value = ''; u.callbacks.search(); assert.equal(u.c._leadSearchQuery, '');
});
test('last keystroke is kept on rapid blur; composition and duplicate init do not overwrite input', () => {
  const u = ui(); u.document.activeElement = u.input; u.callbacks.focus();
  u.input.value = 'Фотима'; u.callbacks.input({ isComposing: true }); u.flush();
  assert.equal(u.counts().renders, 0);
  u.callbacks.compositionend(); u.document.activeElement = null; u.callbacks.blur();
  assert.equal(u.c._leadSearchQuery, 'Фотима'); assert.equal(u.counts().renders, 1);
  u.c.initLeadSearch(); assert.equal(u.input.value, 'Фотима');
});
test('non-sales users cannot unlock/search; search from another tab opens leads once', () => {
  const teacher = ui({ role: 'teacher' }); teacher.callbacks.focus(); assert.equal(teacher.input.disabled, true);
  assert.equal(teacher.input.readOnly, true);
  const u = ui(); u.c._tabContext.salesSection = 'rating'; u.document.activeElement = u.input; u.callbacks.focus();
  u.input.value = '12345'; u.callbacks.input({}); u.flush();
  assert.equal(u.counts().switches, 1);
});
test('markup is a readonly search field, not a username; board composes search with existing filters', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const field = html.match(/<input[^>]*id="globalSearch"[^>]*>/)[0];
  assert.match(field, /type="search"/); assert.match(field, /readonly/); assert.match(field, /autocomplete="off"/);
  assert.doesNotMatch(field, /\bname=|\bvalue=/);
  assert.match(source, /\.filter\(l => leadMatchesSearch\(l\)\)/);
  assert.match(source, /LEAD_COLUMNS\.filter\(col => _leadsVisibleColumns\.has\(col.id\) \|\| tagged.some/);
});

test('actual kanban search preserves language, manager and stage visibility without writing lead data', () => {
  const rows = { english: [{ id: 'closed', name: 'Aliyev', managerId: 'm1', status: 'tolov-yopildi' },
    { id: 'other-manager', name: 'Aliyev', managerId: 'm2', status: 'yangi-lidlar' }],
    russian: [{ id: 'other-language', name: 'Aliyev', managerId: 'm1', status: 'yangi-lidlar' }] };
  const before = JSON.stringify(rows), visible = new Set(['yangi-lidlar']);
  const board = { innerHTML: '', querySelectorAll: () => [] }, status = {};
  const c = appContext([...names, 'renderLeads', 'updateLeadSearchStatus'], {
    _leadSearchQuery: 'aliyev', _leadsManagerFilter: 'm1', _leadsLangFilter: 'english', _leadsVisibleColumns: visible,
    FULL_ACCESS_ROLES: roles, STORAGE_KEYS: { leads: 'leads' }, getItem: () => rows,
    getCurrentUser: () => ({ role: 'admin' }), normalizeLeadStatus: s => s,
    document: { getElementById: id => id === 'leadsKanban' ? board : id === 'leadSearchStatus' ? status : null,
      querySelectorAll: () => [] },
    backfillMissingLeadSerials() {}, renderLeadsManagerFilter() {}, renderLeadsColumnsFilter() {},
    getVisibleLeadColumns: () => [{ id: 'yangi-lidlar', label: 'Yangi lidlar' }],
    renderLeadCard: l => `<article data-match="${l.id}"></article>`,
    initLeadDragDrop() {}, wireLeadContactReasonFilter() {}, refreshLeadRecordingCounts() {}
  });
  c.renderLeads(); assert.match(board.innerHTML, /data-match="closed"/);
  assert.doesNotMatch(board.innerHTML, /other-manager|other-language/);
  assert.match(status.textContent, /^1 ta lid/);
  assert.deepEqual([...visible], ['yangi-lidlar']); assert.equal(JSON.stringify(rows), before);
  c._leadSearchQuery = ''; c.renderLeads();
  assert.doesNotMatch(board.innerHTML, /data-status="tolov-yopildi"/); assert.equal(status.hidden, true);
});
