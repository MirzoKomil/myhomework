// Sayt lidini Telegram kanalga yuborish (server/services/leadChannelNotify.js).
// Ishga tushirish: node scripts/lead-channel-notify.test.cjs
const assert = require('assert');
const { notifyLeadChannel, buildLeadChannelMessage } = require('../server/services/leadChannelNotify');

const lead = { id: 'abcd1234-xxxx', name: 'Ali <Vali>', phone: '+998901234567',
  contactTime: '09:00–12:00 | Maqsad: Erkin muloqot | Telegram: @ali | Sayt: https://domwork.uz',
  utmSource: 'instagram' };
const text = buildLeadChannelMessage(lead);
assert.ok(text.includes('Ali &lt;Vali&gt;'));
assert.ok(text.includes('📞 Telefon: +998901234567'));
assert.ok(text.includes('🕒 Qulay vaqt: 09:00–12:00'));
assert.ok(text.includes('🎯 Maqsad: Erkin muloqot'));
assert.ok(text.includes('✈️ Telegram: @ali'));
assert.ok(!text.includes('Sayt:'));
assert.ok(text.includes('📣 UTM: instagram'));

(async () => {
  // Sozlanmagan — hech narsa yuborilmaydi
  let called = 0;
  assert.strictEqual(await notifyLeadChannel(lead, { env: {}, fetcher: () => { called++; } }), false);
  assert.strictEqual(called, 0);
  // Sozlangan — to'g'ri chat'ga yuboriladi
  let sent;
  const ok = await notifyLeadChannel(lead, {
    env: { DOMWORK_LEADS_CHANNEL_BOT_TOKEN: 't', DOMWORK_LEADS_CHANNEL_CHAT_ID: '-100123' },
    fetcher: async (url, opts) => { sent = { url, body: JSON.parse(opts.body) };
      return { ok: true, status: 200, json: async () => ({ ok: true }) }; } });
  assert.strictEqual(ok, true);
  assert.strictEqual(sent.url, 'https://api.telegram.org/bott/sendMessage');
  assert.strictEqual(sent.body.chat_id, '-100123');
  assert.strictEqual(sent.body.parse_mode, 'HTML');
  // Telegram xatosi lidni buzmaydi
  assert.strictEqual(await notifyLeadChannel(lead, {
    env: { DOMWORK_LEADS_CHANNEL_BOT_TOKEN: 't', DOMWORK_LEADS_CHANNEL_CHAT_ID: '-1' },
    fetcher: async () => { throw new Error('net'); } }), false);
  console.log('lead-channel-notify: OK');
})();
