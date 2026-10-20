const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { functionSource } = require('./helpers/lead-workflow-fixture.cjs');

const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const constSrc = name => {
    const start = appSrc.indexOf(`const ${name} = [`);
    assert.ok(start >= 0, name);
    return appSrc.slice(start, appSrc.indexOf('];', start) + 2);
};

function render(lead, { alerts = [] } = {}) {
    const c = vm.createContext({
        Math, Number, Object, String, Array, Date,
        STORAGE_KEYS: { salesManagers: 'salesManagers' },
        getItem: k => (k === 'salesManagers' ? [{ id: 'm1', name: 'Aziza Tursunova' }] : []),
        escapeHtml: x => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
        getCurrentUser: () => ({ role: 'rop' }),
        getLeadSlaCardAlerts: () => alerts,
        formatPhoneDisplay: p => p || '',
        formatCommentTime: t => t,
        leadSourceName: s => s || 'Organik',
        leadKindLabel: () => 'Target',
        formatLeadTime: () => '19.10.2026',
    });
    const src = [constSrc('LEAD_COLUMNS'), "const LEAD_STATUS_IDS = new Set(LEAD_COLUMNS.map(c => c.id));", constSrc('LEAD_MAIN_PATH'),
        functionSource('js/app.js', 'normalizeLeadStatus'), functionSource('js/app.js', 'renderLeadCommentItem'),
        functionSource('js/app.js', 'renderLeadOverviewHtml'), 'this.r = renderLeadOverviewHtml;'].join('\n');
    vm.runInContext(src, c);
    return c.r(lead, 'english');
}

const lead = {
    id: 'l1', name: 'Dilnoza Karimova', phone: '+998901112233', phone2: '+998935556677', status: 'qaror-jarayonida',
    managerId: 'm1', source: 'Instagram target', serialCode: 'EN-0412',
    comments: [
        { id: 'c1', type: 'contact-fail', text: "Qo'ng'iroq qilindi, lekin: javob bermadi", author: 'Aziza Tursunova', createdAt: '2026-10-18T10:00:00Z' },
        { id: 'c2', type: 'connected-survey', text: 'Maqsad: IELTS 6.5', author: 'Aziza Tursunova', createdAt: '2026-10-18T12:00:00Z' },
        { id: 'c3', type: 'manual', text: 'Ertaga 18:00 da qayta qoʻngʻiroq <b>', author: 'Bobur Aliyev', createdAt: '2026-10-19T09:00:00Z' },
    ],
};

test('every comment, its author and the owning manager are shown', () => {
    const html = render(lead);
    for (const t of ['javob bermadi', 'Maqsad: IELTS 6.5', 'Ertaga 18:00', 'Bobur Aliyev', 'Aziza Tursunova', 'Masʼul sotuv menejeri',
        '+998901112233', '+998935556677', '#EN-0412', 'Qaror jarayonida', '3 ta izoh', "Bog'lanish sababi", 'Anketa']) {
        assert.ok(html.includes(t), 'missing: ' + t);
    }
    assert.ok(!html.includes('<b>'), 'comment text is escaped');
    assert.ok(html.indexOf('Ertaga 18:00') < html.indexOf('javob bermadi'), 'newest first');
});

test('unassigned lead says so clearly', () => {
    const html = render({ ...lead, managerId: '', comments: [] });
    assert.ok(html.includes('Menejer biriktirilmagan'));
    assert.ok(html.includes('Hozircha izoh'));
});

test('stage progress and SLA alerts', () => {
    const html = render(lead, { alerts: [{ type: 'danger', title: 'SLA buzildi', message: '24 soatdan oshdi' }] });
    assert.equal((html.match(/lov-step is-done/g) || []).length, 4);
    assert.equal((html.match(/lov-step is-now/g) || []).length, 1);
    assert.ok(html.includes('SLA buzildi') && html.includes('lov-alert--danger'));
    const failed = render({ ...lead, status: 'muvaffaqiyatsiz-sotuv' });
    assert.ok(failed.includes('lov-steps is-off'));
});
