// BAHO-5 yordamchi: "Bugun · N bajarildi" faqat hisoblangan aloqa; summa formulasi bitta (round(oylik × n / 13)).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/attendanceRules');
const assist = require('../server/services/school/assist');

test('3 daqiqalik qo\'ng\'iroq "bajarildi" deb sanalmaydi (server status short → hisoblanmadi)', () => {
    const rep = assist.countMonth([{ id: 'c1', student_id: 'rav', day: '2026-10-27', at_min: 600, channel: 'phone', minutes: 3, outcome: 'contacted', created_at: '1' }], { monthly: 40000 });
    const items = rep.students[0].items;
    assert.equal(items[0].status, 'short');
    assert.equal(rep.counted, 0);
    assert.equal(R.assistDayState(items), 'nc', 'bog\'landi, lekin hisoblanmadi — yashil emas');
    assert.notEqual(R.assistDayState(items), 'ok');
});
test('kunlik holat: hisoblangan / javob bermadi / bo\'sh; qisqadan keyin 5+ daqiqa — hisoblanadi', () => {
    assert.equal(R.assistDayState([]), '');
    assert.equal(R.assistDayState([{ outcome: 'no_answer', status: 'no_answer' }]), 'na');
    const rep = assist.countMonth([
        { id: 'a', student_id: 's', day: '2026-10-27', at_min: 600, channel: 'phone', minutes: 3, outcome: 'contacted', created_at: '1' },
        { id: 'b', student_id: 's', day: '2026-10-27', at_min: 640, channel: 'phone', minutes: 7, outcome: 'contacted', created_at: '2' }], { monthly: 40000 });
    assert.deepEqual(rep.students[0].items.map(i => i.status), ['short', 'counted']);
    assert.equal(R.assistDayState(rep.students[0].items), 'ok');
});
test('summa: bitta formula round(oylik × n / 13) — server va brauzer zaxirasi teng (13 × 3077 = 40 001 emas)', () => {
    for (let n = 0; n <= 13; n++) assert.equal(R.assistAmount(40000, n), assist.contactAmount(40000, n));
    assert.equal(R.assistAmount(40000, 13), 40000);
    assert.equal(R.assistAmount(40000, 1), 3077);
    assert.equal(R.assistAmount(40000, 7), 21538);
    assert.equal(R.assistAmount(50000, 13), 50000);
});

// BAHO-5 yordamchi #9c: oy tarifi faqat YAKUNIY (to'langan yoki yakuniy tasdiqlangan) yozuvdan; qoralama — joriy qoida (2026-10 dan 40 000).
const rateDb = ({ status, rate = 50000, finalAt = null, settings = 40000 }) => ({ query: async sql => {
    if (/FROM salary_transactions/.test(sql)) return { rows: status ? [{ rate: String(rate), status }] : [] };
    if (/to_regclass\('public\.school_assist_months'\)/.test(sql)) return { rows: [{ t: 'school_assist_months' }] };
    if (/FROM school_assist_months/.test(sql)) return { rows: finalAt ? [{ final_at: finalAt }] : [] };
    if (/FROM hr_employees/.test(sql)) return { rows: [{ id: 'san', role: 'yordamchi', lang: 'english' }] };
    if (/FROM salary_kpi_settings/.test(sql)) return { rows: [{ data: { assistant: { rate: settings } } }] };
    return { rows: [] };
} });
test('oy tarifi: to\'lanmagan qoralama (50 000) eski tarifni saqlamaydi — oktyabr 40 000', async () => {
    const r = await assist.monthlyRate(rateDb({ status: 'unpaid' }), 'san', '2026-10');
    assert.equal(r.monthly, 40000); assert.equal(r.source, 'settings');
    assert.equal(await assist.contactRate(rateDb({ status: 'unpaid' }), 'san', '2026-10'), 3077);
});
test('oy tarifi: to\'langan yoki yakuniy tasdiqlangan oy o\'z tarifini saqlaydi; yozuvsiz eski oy — 50 000', async () => {
    assert.deepEqual(await assist.monthlyRate(rateDb({ status: 'paid' }), 'san', '2026-10'), { monthly: 50000, source: 'paid' });
    assert.deepEqual(await assist.monthlyRate(rateDb({ status: 'unpaid', finalAt: '2026-11-04' }), 'san', '2026-10'), { monthly: 50000, source: 'final' });
    assert.equal((await assist.monthlyRate(rateDb({}), 'san', '2026-09')).monthly, 50000);
    assert.equal((await assist.monthlyRate(rateDb({ status: 'unpaid' }), 'san', '2026-09')).monthly, 50000, 'sentyabr qoralamasi — eski qoida (legacy)');
});

test('materiallar: "javoblar (ustoz uchun)" yordamchiga yuborilmaydi; asosiy ustoz va admin ko\'radi', () => {
    const { visibleMaterials } = require('../server/services/academicHub');
    const list = [{ id: 'a', title: '2-modul imtihoni · javoblar (ustoz uchun)', meta: {} }, { id: 'b', title: '1-modul imtihoni · javoblar', meta: {} },
        { id: 'c', title: 'Colours — flashcards', meta: {} }, { id: 'd', title: 'Ish varag\'i', meta: { teacherOnly: true } }];
    assert.deepEqual(visibleMaterials(list, { teacher: { role: 'yordamchi' } }).map(m => m.id), ['c']);
    assert.equal(visibleMaterials(list, { teacher: { role: 'ingliz-oqituvchi' } }).length, 4);
    assert.equal(visibleMaterials(list, { role: 'admin', teacher: null }).length, 4);
});
