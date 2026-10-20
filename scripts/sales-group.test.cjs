process.env.TZ = 'Asia/Tashkent';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { functionSource } = require('./helpers/lead-workflow-fixture.cjs');

const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const constSrc = (start, end) => { const a = appSrc.indexOf(start); assert.ok(a >= 0, start); return appSrc.slice(a, appSrc.indexOf(end, a) + end.length); };
const NOW = Date.parse('2026-10-20T12:00:00Z'); // 17:00 Toshkent

function ctx(store = {}, extra = {}) {
    const RealDate = Date;
    class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } }
    const c = vm.createContext({
        Date: FakeDate, Math, Number, Object, String, Array, Set, Map, JSON,
        STORAGE_KEYS: { leads: 'leads', students: 'students', salesManagers: 'salesManagers', hrEmployees: 'hrEmployees', salesPlan: 'salesPlan' },
        getItem: (k, d) => (k in store ? store[k] : d),
        escapeHtml: x => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
        ...extra,
    });
    const src = [
        constSrc('const LEAD_COLUMNS = [', '];'), 'const LEAD_STATUS_IDS = new Set(LEAD_COLUMNS.map(c => c.id));',
        constSrc('const LEAD_FOLLOWUP_CLOSED', ';'),
        constSrc('const UZ_MONTHS_SHORT', ';'),
        ...['normalizeLeadStatus', 'parseLeadSlaTime', 'normalizeLeadPhoneInput', 'findLeadPhoneDuplicates', 'getLeadNextFollowUp',
            'formatLeadFollowUpWhen', 'shortPersonName'].map(n => functionSource('js/app.js', n)),
        'this.f = { normalizeLeadPhoneInput, findLeadPhoneDuplicates, getLeadNextFollowUp, formatLeadFollowUpWhen, shortPersonName };',
    ].join('\n');
    vm.runInContext(src, c);
    return c.f;
}

test('phone input is normalized and validated', () => {
    const f = ctx();
    assert.equal(f.normalizeLeadPhoneInput('90 123 45 67'), '+998901234567');
    assert.equal(f.normalizeLeadPhoneInput('+998 (90) 123-45-67'), '+998901234567');
    assert.equal(f.normalizeLeadPhoneInput('998901234567'), '+998901234567');
    assert.equal(f.normalizeLeadPhoneInput('+7 916 123 45 67'), '+79161234567');
    assert.equal(f.normalizeLeadPhoneInput(''), '');
    assert.equal(f.normalizeLeadPhoneInput('0901234567'), '+998901234567');
    assert.equal(f.normalizeLeadPhoneInput('8 916 123 45 67'), '+79161234567');
    assert.equal(f.normalizeLeadPhoneInput('79161234567'), '+79161234567');
    assert.equal(f.normalizeLeadPhoneInput('90 123 45'), null);
    assert.equal(f.normalizeLeadPhoneInput('+998 90 123 45'), null);
});

test('duplicate phone found in leads and students', () => {
    const f = ctx({
        leads: { english: [{ id: 'l1', name: 'Jasur', phone: '+998 90 123 45 67', status: 'qaror-jarayonida', managerId: 'm1' }], russian: [{ id: 'l2', name: 'Olga', phone: '', phone2: '901234567' }] },
        students: [{ id: 's1', name: 'Ali', phone: '998901234567', group: 'A2' }, { id: 's2', name: 'Demo', phone: '+998901234567', isStaffDemo: true }],
        salesManagers: [{ id: 'm1', name: 'Aziza Tursunova' }],
    });
    const d = f.findLeadPhoneDuplicates('+998901234567');
    assert.equal(d.length, 3);
    assert.ok(d[0].extra.includes('Qaror jarayonida') && d[0].extra.includes('Aziza Tursunova'));
    assert.ok(d.some(x => x.kind === 'Oʻquvchi' && x.name === 'Ali'));
    assert.ok(!d.some(x => x.name === 'Demo'));
    assert.equal(f.findLeadPhoneDuplicates('+998931112233').length, 0);
});

test('next follow-up on the card', () => {
    const f = ctx();
    const rem = (id, created, at) => ({ id, type: 'follow-up-reminder', createdAt: created, reminderAt: at });
    const future = f.getLeadNextFollowUp({ status: 'qaror-jarayonida', comments: [rem('a', '2026-10-19T09:00:00Z', '2026-10-21T05:00:00Z')] });
    assert.equal(future.overdue, false);
    assert.equal(f.formatLeadFollowUpWhen(future.at), 'ertaga 10:00');
    const late = f.getLeadNextFollowUp({ status: 'boglanildi', comments: [rem('a', '2026-10-19T09:00:00Z', '2026-10-20T10:30:00Z')] });
    assert.equal(late.overdue, true);
    assert.equal(f.formatLeadFollowUpWhen(late.at), 'bugun 15:30');
    assert.equal(f.getLeadNextFollowUp({ status: 'boglanildi', comments: [rem('a', '2026-10-19T09:00:00Z', '2026-10-20T10:30:00Z'), { id: 'c', type: 'manual', createdAt: '2026-10-20T11:00:00Z' }] }), null, 'answered after the call time');
    assert.equal(f.getLeadNextFollowUp({ status: 'tolov-yopildi', comments: [rem('a', '2026-10-19T09:00:00Z', '2026-10-21T05:00:00Z')] }), null);
    const newest = f.getLeadNextFollowUp({ status: 'boglanildi', comments: [rem('a', '2026-10-18T09:00:00Z', '2026-10-19T05:00:00Z'), rem('b', '2026-10-20T09:00:00Z', '2026-10-23T05:00:00Z')] });
    assert.equal(f.formatLeadFollowUpWhen(newest.at), '23-oktabr 10:00');
    assert.equal(f.shortPersonName('Aziza Tursunova'), 'Aziza T.');
    assert.equal(f.shortPersonName('Bobur'), 'Bobur');
});

test('sales plan fact table compares with the mid plan up to today', () => {
    const c = vm.createContext({
        Date, Math, Number, Object, String, Array,
        escapeHtml: x => String(x), UZ_MONTHS_SHORT: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
        getSalesPlan: () => ({ managers: 4, leadsPerDay: 6, duration: 31, leadCost: 41600, avgCheck: 5850000, conversions: { min: 5.5, mid: 6.85, max: 8 } }),
        computeSalesPlanFactMetrics: () => ({ davr: { lidSoni: 412, sotuvSoni: 35, sotuvSumma: 192150000, konversiya: 8.5, avgCheck: 5490000, budjet: 17139200, romi: 1021, days: 20 } }),
        fmtMoney: n => `${Math.round(n)} so'm`, fmtPct1: n => `${Number(n).toFixed(1)}%`, fmtSignedPct: n => `${n >= 0 ? '+' : ''}${Math.round(n)}%`,
    });
    vm.runInContext([functionSource('js/app.js', 'computeSalesPlanMetrics'), functionSource('js/app.js', 'renderSalesPlanFactTable'), 'this.r = renderSalesPlanFactTable;'].join('\n'), c);
    const html = c.r('english');
    assert.ok(html.includes('Fakt · 1–20'));
    assert.ok(html.includes('>480<'), 'leads planned to date = 4*6*20');
    assert.ok(html.includes('86%'), '412/480');
    assert.ok(html.includes('spx-ok') && html.includes('rejadan'));
});
