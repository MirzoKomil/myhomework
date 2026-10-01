const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8').replace(/\r\n/g, '\n');
const label = "Telefonini olmay qo'ydi";
function constant(name) {
  const match = source.match(new RegExp('const ' + name + ' = [\\s\\S]*?\\n(?:\\];|\\};)'));
  assert.ok(match, name);
  return match[0];
}
const start = source.indexOf('function openMuvaffaqiyatsizSotuvFlow(');
const end = source.indexOf('\nfunction ', start + 1);
const code = constant('FAILED_SALE_REASON_GROUPS') + '\n' + constant('FAILED_SALE_FROM_COLUMN_MAP') + '\n' + source.slice(start, end);

function fixture(lang, status, selected = true) {
  let lead = { id: 'fixture-lead', status, comments: [{ id: 'old-comment', text: 'Existing' }] };
  let modal;
  let validation;
  let writes = 0;
  const elements = { cancelFailedSale: {}, confirmFailedSale: {}, modalBody: {
    querySelector: () => selected ? { value: 'stopped-answering', dataset: { group: groupId } } : null
  } };
  const context = vm.createContext({
    getLeadById: () => lead,
    LEAD_COLUMNS: [{ id: status, label: status }], escapeHtml: text => text,
    openModal: (title, body, footer) => { modal = { title, body, footer }; },
    document: { getElementById: id => elements[id] }, wireLeadModalValidationClear() {},
    showLeadModalValidation: (_el, error) => { validation = error; },
    closeModal() {}, renderLeads() {}, getCurrentUser: () => ({ name: 'Fixture manager' }),
    normalizeLeadExtras: l => l, createLeadComment: c => c,
    updateLeadInStorage: (language, id, updater) => {
      assert.equal(language, lang); assert.equal(id, lead.id);
      writes++; lead = updater(lead); return lead;
    }
  });
  vm.runInContext(code, context);
  const groupId = vm.runInContext(`FAILED_SALE_FROM_COLUMN_MAP[${JSON.stringify(status)}]?.[0] || 'qaror-tolov'`, context);
  context.openMuvaffaqiyatsizSotuvFlow(lang, lead.id, status);
  return { confirm: () => elements.confirmFailedSale.onclick(), cancel: () => elements.cancelFailedSale.onclick(),
    get lead() { return lead; }, get modal() { return modal; }, get validation() { return validation; },
    get writes() { return writes; }, groupId };
}

for (const lang of ['english', 'russian']) {
  for (const status of ['yangi-lidlar', 'boglanishga-urinilmoqda', 'boglanildi', 'malumot-berildi',
    'sinov-darsida', 'qaror-jarayonida', 'tolov-jarayonida', 'tolov-yopildi']) {
    test(`${lang}: new failed-sale reason is displayed and saved from ${status}`, () => {
      const f = fixture(lang, status);
      assert.ok(f.modal.body.includes(label));
      assert.equal((f.modal.body.match(/value="stopped-answering"/g) || []).length, 1);
      f.confirm();
      assert.equal(f.writes, 1);
      assert.equal(f.lead.status, 'muvaffaqiyatsiz-sotuv');
      assert.equal(f.lead.failedSaleReason.reasonId, 'stopped-answering');
      assert.equal(f.lead.failedSaleReason.groupId, f.groupId);
      assert.equal(f.lead.failedSaleReason.label, label);
      assert.equal(f.lead.comments[0].id, 'old-comment');
      assert.equal(f.lead.comments[1].type, 'failed-sale');
      assert.equal(f.lead.comments[1].reason, label);
    });
  }
}
test('no selection and cancellation leave the lead unchanged', () => {
  const f = fixture('english', 'qaror-jarayonida', false);
  f.confirm();
  assert.equal(f.validation.error, 'Bitta sabab tanlang');
  f.cancel();
  assert.equal(f.writes, 0);
  assert.equal(f.lead.status, 'qaror-jarayonida');
});
test('existing decision/payment reasons remain intact', () => {
  const f = fixture('russian', 'qaror-jarayonida');
  for (const oldId of ['no-money', 'debt-unpaid', 'installment-refused']) {
    assert.ok(f.modal.body.includes(`value="${oldId}"`));
  }
});
