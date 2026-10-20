const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { functionSource } = require('./helpers/lead-workflow-fixture.cjs');

const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const block = (startText, endText) => { const a = appSrc.indexOf(startText); assert.ok(a >= 0, startText); return appSrc.slice(a, appSrc.indexOf(endText, a) + endText.length); };

const NOW = Date.parse('2026-10-20T15:00:00Z');
function ctx(user) {
    const c = vm.createContext({
        Date: class extends Date { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static parse(x) { return Date.parse(x); } },
        Math, Number, Object, String, Array, Set, JSON,
        STORAGE_KEYS: { salesManagers: 'salesManagers', leads: 'leads' },
        getItem: () => [], getCurrentUser: () => user,
        formatCommentTime: ts => ts.slice(0, 16),
        LEAD_SLA_MINUTE: 60000,
    });
    const src = [
        block('const LEAD_COLUMNS = [', '];'), 'const LEAD_STATUS_IDS = new Set(LEAD_COLUMNS.map(c => c.id));',
        block('const LEAD_SLA_RULES = {', '\n};'),
        block('const LEAD_FOLLOWUP_CLOSED', ';'),
        ...['normalizeLeadStatus', 'parseLeadSlaTime', 'getLeadSlaStageStartedAt', 'getLeadSlaBaseTime', 'getLeadSlaStageKey', 'getLeadSlaManagerName',
            'isLeadRecoveryPending', 'getLeadSlaManagerAlerts', 'getLeadFollowUpAlerts', 'getLeadSlaAlerts', 'getLeadSlaCardAlerts'].map(n => functionSource('js/app.js', n)),
        'this.f = getLeadFollowUpAlerts; this.a = getLeadSlaAlerts; this.card = getLeadSlaCardAlerts;',
    ].join('\n');
    vm.runInContext(src, c);
    return c;
}
const rem = (id, at, author = 'Aziza') => ({ id, type: 'follow-up-reminder', text: 'eslatma', author, createdAt: '2026-10-19T10:00:00Z', reminderAt: at });
const lead = extra => ({ id: 'l1', name: 'Dilnoza', status: 'qaror-jarayonida', managerId: 'm1', statusChangedAt: '2026-10-20T14:50:00Z', comments: [], ...extra });

test('due reminder becomes an alert; future one does not', () => {
    const c = ctx({ role: 'sales_manager', linkedManagerId: 'm1', name: 'Aziza' });
    const l = lead({ comments: [rem('r1', '2026-10-20T14:00:00Z'), rem('r2', '2026-10-21T09:00:00Z')] });
    const f = c.f(l);
    assert.equal(f.length, 1);
    assert.equal(f[0].id, 'lead-followup-l1-r1');
    assert.ok(f[0].message.includes('Dilnoza'));
    assert.ok(c.a(l, 'english').some(a => a.id === 'lead-followup-l1-r1'), 'assigned manager sees it');
});

test('a later comment or closed stage clears the reminder', () => {
    const c = ctx({ role: 'sales_manager', linkedManagerId: 'm1', name: 'Aziza' });
    const answered = lead({ comments: [rem('r1', '2026-10-20T14:00:00Z'), { id: 'c9', type: 'manual', text: 'gaplashdik', createdAt: '2026-10-20T14:30:00Z' }] });
    assert.equal(c.f(answered).length, 0);
    for (const status of ['tolov-yopildi', 'muvaffaqiyatsiz-sotuv', 'sifatsiz-lidlar']) {
        assert.equal(c.f(lead({ status, comments: [rem('r1', '2026-10-20T14:00:00Z')] })).length, 0, status);
    }
});

test('other managers do not see it; author sees it on an unassigned lead; admin sees it on the card', () => {
    const l = lead({ comments: [rem('r1', '2026-10-20T14:00:00Z')] });
    assert.ok(!ctx({ role: 'sales_manager', linkedManagerId: 'm2', name: 'Bobur' }).a(l, 'english').some(a => a.kind === 'follow-up'));
    const un = lead({ managerId: '', comments: [rem('r1', '2026-10-20T14:00:00Z', 'Rop Ali')] });
    assert.ok(ctx({ role: 'rop', name: 'Rop Ali', linkedRopLang: 'english' }).a(un, 'english').some(a => a.kind === 'follow-up'));
    assert.ok(ctx({ role: 'admin', name: 'Admin' }).card(l, 'english').some(a => a.kind === 'follow-up'));
    assert.ok(!ctx({ role: 'admin', name: 'Admin' }).a(l, 'english').some(a => a.kind === 'follow-up'), 'admin top panel stays clean');
});

test('reminder on a stage without SLA rule still fires', () => {
    const c = ctx({ role: 'sales_manager', linkedManagerId: 'm1', name: 'Aziza' });
    assert.equal(c.a(lead({ status: 'keyin-sotib-olmoqchi', comments: [rem('r1', '2026-10-20T14:00:00Z')] }), 'english').length, 1);
});

test('notification panel escapes lead names', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'notifications.js'), 'utf8');
    assert.ok(src.includes('${notifEsc(n.title)}') && src.includes('${notifEsc(n.message)}'));
    const c = vm.createContext({});
    vm.runInContext(functionSource('js/notifications.js', 'notifEsc') + '\nthis.e = notifEsc;', c);
    assert.equal(c.e('<img src=x onerror=1>'), '&lt;img src=x onerror=1&gt;');
});
