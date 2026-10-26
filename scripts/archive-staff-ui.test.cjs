// Arxiv va ishdan bo'shatish — brauzer tomonidagi mantiq: sotuv egasi bo'yicha
// reyting, faol menejerlar ro'yxati, voronka jadvali, arxiv nusxasini ko'rsatish.
process.env.TZ = 'Asia/Tashkent';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { functionSource } = require('./helpers/lead-workflow-fixture.cjs');
const staffStatus = require('../js/staffStatus');
const lifecycle = require('../server/services/staffLifecycle');
const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const block = (start, end) => { const a = app.indexOf(start); return app.slice(a, app.indexOf(end, a) + end.length); };

test('staffStatus: faollik, sotuv egasi, ro‘yxat filtri', () => {
    assert.equal(staffStatus.isActive({ status: 'active' }), true);
    assert.equal(staffStatus.isActive({ status: 'inactive' }), false);
    assert.equal(staffStatus.isActive({ status: 'active', offboardedAt: '2026-10-25T10:00:00Z' }), false);
    assert.equal(staffStatus.isActive({}), true, 'holat yozilmagan eski yozuv faol hisoblanadi');
    assert.equal(staffStatus.saleOwner({ managerId: 'b', saleManagerId: 'a' }), 'a');
    assert.equal(staffStatus.saleOwner({ managerId: 'b' }), 'b');
    const list = [{ id: 'a', status: 'active' }, { id: 'b', status: 'inactive' }, { id: 'c', offboardedAt: 'x' }];
    assert.deepEqual(staffStatus.activeOnly(list).map(e => e.id), ['a']);
    assert.deepEqual(staffStatus.activeOnly(list, 'c').map(e => e.id), ['a', 'c'], 'joriy tanlov saqlanadi');
    assert.equal(staffStatus.label({ name: 'Ali', offboardedAt: 'x' }), 'Ali (ishdan ketgan)');
});

test('server: sotuv egasi bir marta muhrlanadi va lid berilsa o‘zgarmaydi', () => {
    const at = '2026-10-20T10:00:00Z';
    assert.deepEqual(lifecycle.nextSaleCredit({ status: 'qaror-jarayonida', managerId: 'a' }, { status: 'tolov-yopildi', managerId: 'a' }, at),
        { saleManagerId: 'a', saleManagerAt: at, saleManagerSource: 'status-change' });
    const sold = { status: 'tolov-yopildi', managerId: 'a', saleManagerId: 'a', saleManagerAt: at, saleManagerSource: 'status-change' };
    assert.equal(lifecycle.nextSaleCredit(sold, { ...sold, managerId: 'b', saleManagerId: 'b' }).saleManagerId, 'a', 'brauzer yuborgan qiymat e’tiborsiz');
    assert.equal(lifecycle.nextSaleCredit({ ...sold, status: 'tolov-jarayonida' }, { ...sold, status: 'tolov-yopildi', managerId: 'b' }).saleManagerId, 'a', 'qisman → to‘liq: egasi o‘sha');
    assert.equal(lifecycle.nextSaleCredit(sold, { ...sold, status: 'muvaffaqiyatsiz-sotuv' }).saleManagerId, null, 'sotuv bekor bo‘lsa kredit olib tashlanadi');
    assert.equal(lifecycle.nextSaleCredit(null, { status: 'tolov-jarayonida', managerId: 'c' }).saleManagerId, 'c', 'yangi lid darhol sotuvda');
    const life = lifecycle.preserveLifecycle({ status: 'active' }, { offboarded_at: 'x', end_date: '2026-10-25', offboard_reason: 'Ketdi' });
    assert.equal(life.status, 'inactive');
    assert.equal(life.endDate, '2026-10-25');
});

function rankingCtx(leads, employees) {
    const c = vm.createContext({
        Date, Math, Number, String, Array, Object, Set, Map, isNaN, staffStatus,
        STORAGE_KEYS: { hrEmployees: 'hrEmployees', leads: 'leads' },
        getItem: (k, f) => (k === 'hrEmployees' ? employees : f),
        getLeadStatsForRankings: () => leads,
        AVG_CHECK: 1_000_000,
        MONTH_KEY_RE: /^\d{4}-\d{2}$/,
    });
    vm.runInContext([block('const LEAD_COLUMNS = [', '];'), 'const LEAD_STATUS_IDS = new Set(LEAD_COLUMNS.map(c => c.id));',
        ...['normalizeLeadStatus', 'getSalesManagers', 'getActiveSalesManagers', '_isPartialInProgressLead', '_getLeadRankingAmount',
            '_getLeadRankingDate', '_getRankingLeadsInMonth', '_getClosedLeadsInMonth', 'getManagerSalesForMonth', 'getManagerDealsCountForMonth']
            .map(n => functionSource('js/app.js', n)),
        'this.f = { getSalesManagers, getActiveSalesManagers, getManagerSalesForMonth, getManagerDealsCountForMonth };'].join('\n'), c);
    return c.f;
}

test('reyting: lid boshqaga berilsa ham sotuv uni qilgan menejerda qoladi', () => {
    const employees = [
        { id: 'ali', name: 'Ali', role: 'sotuv-menejeri', lang: 'english', status: 'inactive', offboardedAt: '2026-10-25T10:00:00Z' },
        { id: 'vali', name: 'Vali', role: 'sotuv-menejeri', lang: 'english', status: 'active' },
    ];
    const leads = [
        { managerId: 'vali', saleManagerId: 'ali', status: 'tolov-yopildi', paymentClosedSurvey: { actualAmount: 1_500_000, closedDate: '2026-10-10' } },
        { managerId: 'vali', saleManagerId: 'ali', status: 'tolov-jarayonida', paymentSurvey: { paymentType: 'partial', paidAmount: 400_000, lastPaymentDate: '2026-10-12' } },
        { managerId: 'vali', saleManagerId: 'vali', status: 'tolov-yopildi', paymentClosedSurvey: { actualAmount: 2_000_000, closedDate: '2026-10-15' } },
        { managerId: 'vali', status: 'tolov-yopildi', paymentClosedSurvey: { actualAmount: 900_000, closedDate: '2026-10-16' } }, // eski yozuv: egasi = hozirgi menejer
    ];
    const f = rankingCtx(leads, employees);
    assert.equal(f.getManagerSalesForMonth('ali', '2026-10'), 1_900_000);
    assert.equal(f.getManagerDealsCountForMonth('ali', '2026-10'), 1);
    assert.equal(f.getManagerSalesForMonth('vali', '2026-10'), 2_900_000);
    assert.equal(f.getManagerSalesForMonth('all', '2026-10'), 4_800_000, 'jamoa jami o‘zgarmaydi');
    assert.deepEqual(f.getActiveSalesManagers('english').map(m => m.id), ['vali'], 'ketgan menejer reyting/taqsimotda yo‘q');
    assert.deepEqual(f.getSalesManagers('english').map(m => m.id), ['ali', 'vali'], 'tarix uchun to‘liq ro‘yxat saqlanadi');
});

test('voronka jadvali: sotuv egasi bo‘yicha guruhlanadi, ketgan menejer belgisi bilan', () => {
    const c = vm.createContext({ Date, Intl, Math, Number, String, Array, Object, Map, Set, staffStatus,
        STORAGE_KEYS: { hrEmployees: 'hrEmployees' },
        getItem: (k, f) => (k === 'hrEmployees' ? [{ id: 'ali', name: 'Ali', offboardedAt: 'x' }, { id: 'vali', name: 'Vali', status: 'active' }] : f) });
    vm.runInContext([block('const LEAD_COLUMNS = [', '];'), 'const LEAD_STATUS_IDS = new Set(LEAD_COLUMNS.map(c => c.id));',
        block('const SALES_MAIN_PATH', ';'),
        ...['normalizeLeadStatus', 'leadTashkentDayKey', 'leadCreatedMs', 'medianOf', 'getFailedSaleReasonLabel', 'computeManagerPerformance']
            .map(n => functionSource('js/app.js', n)), 'this.f = computeManagerPerformance;'].join('\n'), c);
    const rows = c.f([
        { managerId: 'vali', saleManagerId: 'ali', status: 'tolov-yopildi', paymentClosedSurvey: { actualAmount: 1_000_000 } },
        { managerId: 'vali', status: 'yangi-lidlar' },
    ], [{ id: 'vali', name: 'Vali' }]);
    const ali = rows.find(r => r.id === 'ali');
    assert.equal(ali.name, 'Ali (ishdan ketgan)');
    assert.equal(ali.closed, 1);
    assert.equal(ali.revenue, 1_000_000);
    assert.equal(rows.find(r => r.id === 'vali').closed, 0);
});

test('arxiv: nusxadan ko‘rsatiladigan maydonlar, maxfiylar yashirin', () => {
    global.window = global;
    require('../js/archiveCenter.js');
    const f = global.archiveCenter._flatten({ row: { id: 's1', name: 'Ali', phone: '901', password_hash: 'x', card_number: '8600', extra_data: { login: '901', passwordHash: 'y', paidAmount: 500 } } });
    const keys = Object.fromEntries(f);
    assert.equal(keys['Ism'], 'Ali');
    assert.equal(keys['Login'], '901');
    assert.equal(keys["To'langan"], '500');
    assert.ok(!f.some(([k, v]) => /password|card/i.test(k) || v === 'x' || v === 'y' || v === '8600'));
});

test('server arxiv: brauzer obyektidan qator va maxfiylarni yashirish', () => {
    const archive = require('../server/services/archive');
    const row = archive.legacyToRow('student', { id: 's1', name: 'Ali', group: 'A1', teacherId: 't1', password: 'p', paidAmount: 5 });
    assert.equal(row.group_name, 'A1');
    assert.equal(row.teacher_id, 't1');
    assert.equal(row.extra_data.paidAmount, 5);
    assert.ok(!('password' in row.extra_data));
    const red = archive.redact('employee', { row: { name: 'X', password_hash: 'h', extra_data: { passwordHash: 'z' } } });
    assert.equal(red.row.password_hash, undefined);
    assert.equal(red.row.extra_data.passwordHash, undefined);
    assert.equal(archive.canView({ role: 'rop' }, 'employee'), false);
    assert.equal(archive.canView({ role: 'rop' }, 'lead'), true);
    assert.equal(archive.canView({ role: 'sales_manager' }, 'lead'), false);
    assert.equal(archive.canView({ role: 'boshliq' }, 'candidate'), true);
});
