'use strict';
// Targetolog ilovasi: tuzatish oynasi, qulf (kiritilmagan kunlar), yangi maydonlar va lidlar maxfiyligi.
// Ishga tushirish: node scripts/target-ads.test.cjs
const assert = require('assert');
const t = require('../server/services/targetAds');

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };

test('tuzatish oynasi: oy tugagach yana 1 kun', () => {
    assert.deepStrictEqual(t.editRange('2026-11-01'), { from: '2026-10-01', to: '2026-10-31' });
    assert.deepStrictEqual(t.editRange('2026-11-02'), { from: '2026-11-01', to: '2026-11-01' });
    assert.deepStrictEqual(t.editRange('2026-11-15'), { from: '2026-11-01', to: '2026-11-14' });
    assert.deepStrictEqual(t.editRange('2027-01-01'), { from: '2026-12-01', to: '2026-12-31' });
});

test('qulf: hech qachon kiritmagan targetolog — faqat kecha (qulf boshlanganidan keyin)', () => {
    assert.deepStrictEqual(t.missingDays('2026-11-01', [], null), []); // 31-oktyabr qulf boshlanishidan oldin
    assert.deepStrictEqual(t.missingDays('2026-11-02', [], null), ['2026-11-01']);
    assert.deepStrictEqual(t.missingDays('2026-11-01', [], null, '2026-10-01'), ['2026-10-31']);
});

test('qulf: birinchi kiritilgan kundan keyingi bo‘shliqlar talab qilinadi', () => {
    assert.deepStrictEqual(t.missingDays('2026-11-05', ['2026-11-02'], '2026-09-01'), ['2026-11-01', '2026-11-03', '2026-11-04']);
    assert.deepStrictEqual(t.missingDays('2026-11-01', ['2026-10-28', '2026-10-30'], '2026-10-28', '2026-10-01'), ['2026-10-29', '2026-10-31']);
    assert.deepStrictEqual(t.missingDays('2026-11-02', ['2026-11-01'], '2026-09-01'), []);
});

test('kunlik yozuv: ko‘rishlar va kliklar (ixtiyoriy) saqlanadi', () => {
    assert.deepStrictEqual(t.cleanData('day', { budget: 18.9, leadCount: 12, impressions: 8420, clicks: 276 }),
        { budget: 18.9, leadCount: 12, kvalLeadCount: null, impressions: 8420, clicks: 276, note: '' });
    assert.deepStrictEqual(t.cleanData('day', { budget: 5, leadCount: 1 }).impressions, null);
    assert.throws(() => t.cleanData('day', { budget: 1, leadCount: 1, impressions: 5, clicks: 9 }), /oshmasligi/);
    assert.throws(() => t.cleanData('day', { budget: 1, leadCount: 1, clicks: -1 }), /manfiy/);
});

test('targetologga lid: telefon, izoh, sotuvchi, to‘lov kelmaydi', () => {
    const lead = {
        id: 'L1', name: 'Madina', phone: '+998901234567', phone2: '+998', email: 'm@x.uz', managerId: 'M7', managerName: 'Hamidaxon',
        language: 'russian', source: 'Target', leadType: 'target', status: 'tolov-yopildi', createdAt: '2026-10-28T16:14:00Z',
        telegramUsername: 'madina', paymentSurvey: { totalAmount: '1200000' }, metaCampaignName: 'Kuz aksiya', metaAdName: '3 oyda rus tili',
        connectedSurvey: { age: 27, gender: 'female', applicant: 'self', learningGoal: 'work', languageLevel: 'zero', residenceType: 'uz', region: 'Andijon', phone: 'x' },
        comments: [{ type: 'call-attempt', createdAt: '2026-10-28T16:18:00Z', text: 'gaplashdik', author: 'Hamidaxon' }, { type: 'note', text: 'maxfiy izoh' }],
        stageHistory: [{ from: null, to: 'yangi-lidlar', at: '2026-10-28T16:14:00Z', managerId: 'M7', by: 'U1' }],
        trialRequest: { state: 'completed', attended: true, scheduledAt: '2026-10-31T11:00:00Z', teacherId: 'T1', resultNote: 'yaxshi' },
        sifatsizReason: null
    };
    const r = t.redactLeadForTargetolog(lead);
    assert.strictEqual(r.phone, ''); assert.strictEqual(r.phone2, ''); assert.strictEqual(r.email, ''); assert.strictEqual(r.managerId, '');
    assert.strictEqual(r.managerName, undefined); assert.strictEqual(r.telegramUsername, undefined);
    assert.deepStrictEqual(r.paymentSurvey, { paymentType: '', paidAmount: null, lastPaymentDate: '', totalAmount: '1200000', tariff: null }); // ROAS uchun faqat summa
    assert.deepStrictEqual(r.comments, [{ type: 'call-attempt', createdAt: '2026-10-28T16:18:00Z' }]);
    assert.strictEqual(r.connectedSurvey.phone, undefined); assert.strictEqual(r.connectedSurvey.region, 'Andijon');
    assert.deepStrictEqual(r.stageHistory, [{ from: '', to: 'yangi-lidlar', at: '2026-10-28T16:14:00Z' }]);
    assert.deepStrictEqual(r.trialRequest, { state: 'completed', attended: true, scheduledAt: '2026-10-31T11:00:00Z' });
    assert.strictEqual(r.metaCampaignName, 'Kuz aksiya');
    assert.ok(!JSON.stringify(r).includes('maxfiy') && !JSON.stringify(r).includes('Hamidaxon') && !JSON.stringify(r).includes('998'));
    const by = t.redactLeadsForTargetolog({ russian: [lead], english: [] });
    assert.strictEqual(by.russian[0].phone, ''); assert.deepStrictEqual(by.english, []);
});

test('takroriy lid belgisi: raqam yuborilmaydi, faqat keyingi lidda dupPhone', () => {
    const a = { id: 'A', phone: '+998 90 123-45-67', createdAt: '2026-10-01T10:00:00Z', status: 'yangi-lidlar' };
    const b = { id: 'B', phone: '901234567', createdAt: '2026-10-20T10:00:00Z', status: 'yangi-lidlar' };
    const c = { id: 'C', phone: '+998911112233', createdAt: '2026-10-21T10:00:00Z', status: 'yangi-lidlar' };
    const r = t.redactLeadsForTargetolog({ russian: [b, c], english: [a] });
    assert.strictEqual(r.english[0].dupPhone, undefined);
    assert.strictEqual(r.russian[0].dupPhone, true);
    assert.strictEqual(r.russian[1].dupPhone, undefined);
    assert.strictEqual(r.russian[0].phone, '');
});

console.log(`target-ads: ${n}/${n} o'tdi`);
