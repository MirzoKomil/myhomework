'use strict';
// Avtomatik SMS matnlari: Eskiz shartlari (1 SMS, oddiy apostrof) va bosqich mantig'i.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../server/services/smsTexts');
const S = require('../server/services/leadStageSms');

const vars = { name: 'Jasur', link: 'https://t.me/+ct33Qc0D6Y44MGUy', when: 'ertaga 10:00', time: '19:00', date: '20-noyabr', login: '+998901234567', password: '4567' };

test('har bir matn 160 belgidan oshmaydi va faqat GSM-7 lotin (Unicode emas)', () => {
  for (const key of Object.keys(T.TEXTS)) {
    for (const name of ['Muhammadamin', '']) {
      const text = T.render(key, { ...vars, name });
      assert.ok(text.length <= 160, `${key} ${text.length}: ${text}`);
      assert.match(text, /^[\x20-\x7E\n]+$/, `${key} faqat ASCII bo'lishi kerak: ${text}`);
    }
  }
});

test('ism tozalanadi, yaroqsiz bo\'lsa ismsiz variant', () => {
  assert.equal(T.cleanName('jasur aliyev'), 'Jasur');
  assert.equal(T.cleanName("G'ayrat"), "G'ayrat");
  assert.equal(T.cleanName('.'), '');
  assert.equal(T.cleanName('𝓝𝓪𝓻𝓰𝓲𝔃𝓪'), '');
  assert.equal(T.cleanName('53ешдаман'), 'Ешдаман');
  assert.match(T.render('boglanildi', { name: '.' }), /^Suhbat uchun rahmat!/);
  assert.match(T.render('boglanildi', { name: 'Jasur', managerName: 'dilnoza', managerPhone: '90 123 45 67' }), /Menejer: Dilnoza \+998901234567$/);
});

test('sana/vaqt Toshkent bo\'yicha', () => {
  const now = new Date('2026-11-15T05:00:00Z'); // 10:00 Toshkent
  assert.equal(T.uzWhen('2026-11-15T14:00:00Z', now), 'bugun 19:00');
  assert.equal(T.uzWhen('2026-11-16T05:00:00Z', now), 'ertaga 10:00');
  assert.equal(T.uzDate('2026-11-20T00:00:00Z'), '20-noyabr');
});

test('faqat O\'zbekiston raqami, phone2 zaxira', () => {
  assert.equal(S.uzPhoneOf({ phone: '+79661026477', phone2: '90 123 45 67' }), '998901234567');
  assert.equal(S.uzPhoneOf({ phone: '+79661026477' }), '');
});

test('bosqich mantig\'i', async () => {
  const lead = { id: 'l1', name: 'Jasur', language: 'russian', phone: '+998901234567', status: 'boglanildi' };
  let m = await S.buildMessages({ status: 'boglanishga-urinilmoqda' }, lead, null);
  assert.deepEqual(m.map(x => x[0]), ['boglanildi']);
  m = await S.buildMessages({ status: 'boglanildi' }, lead, null);
  assert.equal(m.length, 0, 'bosqich o\'zgarmasa SMS yo\'q');
  m = await S.buildMessages({ status: 'sinov-darsida' }, { ...lead, status: 'tolov-jarayonida', paymentSurvey: { paymentType: 'partial', nextPaymentDate: '2026-11-20' } },
    { credentialsCreated: true, student: { login: '+998901234567' } });
  assert.deepEqual(m.map(x => x[0]), ['tolov-qisman', 'ilova-login']);
  assert.match(m[1][1], /Parol: 4567\n/);
  assert.equal(S.errorKind('Please, fill the balance'), 'balance');
  assert.equal(S.errorKind('Этот смс текст еще не прошёл модерацию'), 'moderation');
});

test('sinov SMS: sana va soat, menejer kontakti, eslatmalar 2 ta (1 soat, boshlanish)', async () => {
  const at = new Date(Date.now() + 26 * 3600000).toISOString();
  const lead = { id: 'l2', name: 'Jasur', language: 'russian', phone: '+998901234567', status: 'sinov-darsida', trialLessonAt: at, paymentOnboarding: { teacherId: '' } };
  const m = await S.buildMessages({ status: 'boglanildi' }, lead, null, { managerName: 'Dilnoza', managerPhone: '901234567' });
  assert.equal(m.length, 0, 'ustozsiz sinovga SMS yo\'q');
  const u = await S.buildMessages({ status: 'sinov-darsida' }, { ...lead, status: 'qaror-jarayonida' }, null, { managerName: 'Dilnoza', managerPhone: '901234567' });
  assert.match(u[0][1], /Menejer: Dilnoza \+998901234567$/);
  const src = require('fs').readFileSync(require('path').join(__dirname, '../server/db.js'), 'utf8');
  assert.match(src, /TRIAL_SMS_REMINDER_RULES = \[\s*\{ id: '1h', minutes: 60 \},\s*\{ id: 'start', minutes: 0 \},\s*\]/);
});
