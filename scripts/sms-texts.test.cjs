'use strict';
// Avtomatik SMS matnlari: Eskiz shartlari (1 SMS, oddiy apostrof) va bosqich mantig'i.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../server/services/smsTexts');
const S = require('../server/services/leadStageSms');

const vars = { name: 'Jasur', managerName: 'Muhammadyusuf', managerPhone: '901234567', link: 'https://t.me/+ct33Qc0D6Y44MGUy', when: 'ertaga 10:00', time: '19:00', date: '20-noyabr', login: '+998901234567', password: '4567' };

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

test('kirill ismlar lotinga o\'giriladi — SMS Unicode bo\'lib qolmasin', () => {
  assert.equal(T.toLatin('Жасур'), 'Jasur');
  assert.equal(T.toLatin('Ғайрат'), "G'ayrat");
  assert.equal(T.toLatin('Елена'), 'Yelena');
  const t = T.render('menejer-biriktirildi', { name: 'Шаҳзода', managerName: 'Дилноза', managerPhone: '901234567' });
  assert.equal(t, "Assalomu alaykum, Shahzoda! Arizangiz uchun rahmat. Domwork menejeri Dilnoza tez orada sizga +998901234567 raqamidan qo'ng'iroq qiladi.");
  assert.match(T.render('yangi-lid', { name: '😀' }), /^Assalomu alaykum! Domwork onlayn/);
});

test('menejer-biriktirildi faqat menejerning ismi va telefoni bo\'lsa', () => {
  assert.equal(T.render('menejer-biriktirildi', { name: 'Ali' }), '');
  assert.equal(T.render('menejer-biriktirildi', { name: 'Ali', managerName: 'Dilnoza' }), '');
});

test('yangi lid rejasi: 5 daqiqa, biriktirish, tun, eski lidlar', () => {
  const since = Date.parse('2026-11-17T08:00:00Z'), c = '2026-11-17T09:00:00Z', t0 = Date.parse(c);
  const L = x => ({ id: 'l1', language: 'russian', status: 'new', managerId: '', ...x });
  assert.equal(S.newLeadPlan(L(), c, t0 + 2 * 60000, since), null); // 5 daqiqa kutiladi
  assert.equal(S.newLeadPlan(L(), c, t0 + 6 * 60000, since).key, 'yangi-lid');
  assert.equal(S.newLeadPlan(L({ managerId: 'm1', managerAssignedAt: '2026-11-17T09:03:00Z' }), c, t0 + 6 * 60000, since).key, 'menejer-biriktirildi');
  assert.equal(S.newLeadPlan(L({ status: 'boglanildi' }), c, t0 + 6 * 60000, since), null);
  assert.equal(S.newLeadPlan(L({ language: 'english' }), c, t0 + 6 * 60000, since), null);
  assert.equal(S.newLeadPlan(L(), '2026-11-17T07:00:00Z', t0, since), null); // yoqilishidan oldingi lid
  assert.equal(S.newLeadPlan(L(), c, t0 + 15 * 3600000, since), null); // 14 soatdan eski
  // Eski lid (2 kun oldin tushgan) yangi menejerga qayta biriktirilib "Yangi"ga qaytsa — SMS yo'q
  assert.equal(S.newLeadPlan(L({ managerId: 'm2', managerAssignedAt: new Date(t0 + 48 * 3600000).toISOString() }), c, t0 + 48 * 3600000 + 60000, since), null);
  // Yangi lid (2 soat) boshqa menejerga o'tkazilsa — yangi menejer raqami bilan SMS ketadi
  assert.equal(S.newLeadPlan(L({ managerId: 'm2', managerAssignedAt: new Date(t0 + 2 * 3600000).toISOString() }), c, t0 + 2 * 3600000 + 60000, since).key, 'menejer-biriktirildi');
  assert.equal(S.inSmsHours(Date.parse('2026-11-17T17:00:00Z')), false); // 22:00 Toshkent
  assert.equal(S.inSmsHours(Date.parse('2026-11-17T04:30:00Z')), true); // 09:30
});
