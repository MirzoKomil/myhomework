// Telegram lid xabarlarini o'qish (server/routes/telegram.js) — ikkala format.
// Ishga tushirish: node scripts/telegram-lead-parse.test.cjs
const assert = require('assert');
// server/db.js DATABASE_URL'siz jarayonni to'xtatadi, capiWebhook esa taymer ochadi —
// parser ularga bog'liq emas, shuning uchun faqat shu marshrut uchun o'rinbosar beramiz.
const Module = require('module');
const routePath = require.resolve('../server/routes/telegram');
const originalLoad = Module._load;
let parseTelegramLeadMessage;
try {
  Module._load = function (request, parent, ...args) {
    if (parent?.filename === routePath && request === '../db') return { insertLead() { throw new Error('db stub'); } };
    if (parent?.filename === routePath && request === '../services/capiWebhook') return { sendLeadToCapi() {} };
    return originalLoad.call(this, request, parent, ...args);
  };
  ({ parseTelegramLeadMessage } = require(routePath));
} finally { Module._load = originalLoad; }

// 1-format (eski guruh)
const oldMsg = `#telegram

🧾 Nomi: RUS - FORMA LEAD 29/07 (Abdulloh Abdulaxadov)
📝 Ma'lumotlar:
    1. Ismingiz:: Manzura
    2. Telefon raqamingiz:: 99 913 06 04
    3. Phone number: +998942697174
ℹ️ Manba: Instagram
📆 Sana: 10-08-2026 12:06:15

✅ Telegram uchun tayyor`;
const a = parseTelegramLeadMessage(oldMsg);
assert.strictEqual(a.name, 'Manzura');
assert.strictEqual(a.phone, '+998942697174');
assert.strictEqual(a.phone2, '+998999130604');
assert.strictEqual(a.formName, 'RUS - FORMA LEAD 29/07 (Abdulloh Abdulaxadov)');
assert.strictEqual(a.sourceLabel, 'Instagram');

// 2-format ("Domwork leadlar" guruhi)
const newMsg = `🔔 Yangi lid — LOGIKA  - FORMA LEAD VES SROK

• Rus tilini o’rganishni xohlaydimi: ha
• Yoshi: 21_–_30_yosh
• Ismi: Atxam
• Telefon raqamingiz: +79201542803
• 2-Telefon raqami: +998953430377

🎯 Lead - cbo - winers interes - 20$ - 25.10.2026 (br) - RUS 18
🕒 25/10/2026, 21:37 · Instagram`;
const b = parseTelegramLeadMessage(newMsg);
assert.strictEqual(b.name, 'Atxam');
assert.strictEqual(b.phone, '+79201542803');
assert.strictEqual(b.phone2, '+998953430377');
assert.strictEqual(b.formName, 'LOGIKA  - FORMA LEAD VES SROK');
assert.strictEqual(b.sourceLabel, 'Instagram');
assert.strictEqual(b.adName, 'Lead - cbo - winers interes - 20$ - 25.10.2026 (br) - RUS 18');
assert.deepStrictEqual(b.extras, ['Rus tilini o’rganishni xohlaydimi: ha', 'Yoshi: 21 – 30 yosh']);

// 2-format: raqam +siz va ikkala raqam bir xil
const c = parseTelegramLeadMessage(`🔔 Yangi lid — LOGIKA - FORMA LEAD VES SROK
• Ismi: Шойим
• Telefon raqamingiz: 998991678476
• 2-Telefon raqami: +998991678476
🕒 25/10/2026, 21:52 · Instagram`);
assert.strictEqual(c.name, 'Шойим');
assert.strictEqual(c.phone, '+998991678476');
assert.strictEqual(c.phone2, '');

// Lid bo'lmagan oddiy xabar
assert.strictEqual(parseTelegramLeadMessage('Salom hammaga'), null);

console.log('telegram-lead-parse: OK');
