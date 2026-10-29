'use strict';
// @Domworkuz_bot lid voronkasi (mehmon / prospect lidlar). Hujjat: "Domwork bot — lid voronkasi".
// Faqat settings.funnelEnabled === true bo'lganda ishlaydi; o'chiq bo'lsa eski oqim (telefon so'rash) o'zgarmaydi.
// O'quvchi/xodim ma'lumotlari bu yerda hech qachon ochilmaydi: mehmon faqat ochiq kontent va o'z lidini ko'radi.
const { randomUUID } = require('node:crypto');
const policy = require('./policy');
const store = require('./store');
const copy = require('./funnelCopy');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS domwork_bot_visitors (
 telegram_id TEXT PRIMARY KEY, first_name TEXT NOT NULL DEFAULT '', username TEXT NOT NULL DEFAULT '',
 source TEXT NOT NULL DEFAULT 'organic', lead_id TEXT, segment TEXT, field TEXT, variant TEXT NOT NULL DEFAULT 'A',
 score INTEGER NOT NULL DEFAULT 0, phone TEXT NOT NULL DEFAULT '', phone_purpose TEXT NOT NULL DEFAULT '',
 awaiting TEXT NOT NULL DEFAULT '', lesson_parts INTEGER NOT NULL DEFAULT 0, lesson_seen_at TIMESTAMPTZ,
 quiz JSONB NOT NULL DEFAULT '{}', quiz_done_at TIMESTAMPTZ, guide_at TIMESTAMPTZ, cta_at TIMESTAMPTZ,
 request JSONB, requested_at TIMESTAMPTZ, discount_until TIMESTAMPTZ, hot_at TIMESTAMPTZ,
 paused BOOLEAN NOT NULL DEFAULT FALSE, blocked_at TIMESTAMPTZ, price_at TIMESTAMPTZ, texted_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS domwork_bot_visitors_lead ON domwork_bot_visitors(lead_id);
CREATE TABLE IF NOT EXISTS domwork_bot_funnel_events (
 id BIGSERIAL PRIMARY KEY, telegram_id TEXT NOT NULL, event TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS domwork_bot_funnel_events_at ON domwork_bot_funnel_events(created_at);`;
async function init(db) {
    await db.query(SCHEMA);
    await db.query(`ALTER TABLE domwork_bot_visitors ADD COLUMN IF NOT EXISTS price_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS texted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS holdout BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN IF NOT EXISTS drip_sent JSONB NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS drip_last_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS ignored INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS outcome TEXT, ADD COLUMN IF NOT EXISTS outcome_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS monthly BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN IF NOT EXISTS drip_stopped BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS noans_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS bonus_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS drip_checked_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS bonus_checked_at TIMESTAMPTZ`);
    // Sotuv guruhidagi bot xabari → qaysi mehmonga tegishli (menejer "reply" qilib javob yozadi).
    await db.query(`CREATE TABLE IF NOT EXISTS domwork_bot_relay (chat_id TEXT NOT NULL, message_id BIGINT NOT NULL, telegram_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(chat_id,message_id))`);
    await db.query("DELETE FROM domwork_bot_relay WHERE created_at<NOW()-INTERVAL '90 days'");
    // 30-okt: voronkani ishga tushirish (bir marta). Keyin Bot boshqaruvidan o'chirilsa — o'chiq qoladi.
    await db.query(`UPDATE domwork_bot_settings SET data=data||'{"funnelEnabled":true,"dripEnabled":true,"funnelLaunch20261030":true}'::jsonb
        ||(CASE WHEN data ? 'discountPercent' THEN '{}'::jsonb ELSE '{"discountPercent":15,"discountHours":72}'::jsonb END)
        ||(CASE WHEN COALESCE(data->>'bonusChannel','')<>'' THEN '{}'::jsonb ELSE '{"bonusChannel":"@domwork"}'::jsonb END)
        WHERE singleton=1 AND NOT (data ? 'funnelLaunch20261030')`);
}

// Admin botga "#voronka <kalit>" izohi bilan fayl yuborib materialni almashtiradi.
const MEDIA_KEYS = ['sovga', 'dars1', 'dars2', 'dars3', 'menejer', 'shartnoma', 'asoschi', 'bonus',
    'qollanma_umumiy', ...Object.keys(copy.FIELDS).map(k => 'qollanma_' + k), 'promo1', 'promo2', 'promo3', 'promo4', 'promo5', 'promo6'];
const MEDIA_FIELD = { sendPhoto: 'photo', sendVideo: 'video', sendDocument: 'document', sendAudio: 'audio', sendVoice: 'voice' };
const GUEST_METHODS = ['sendMessage', 'sendPhoto', 'sendVideo', 'sendDocument', 'sendAudio', 'sendVoice', 'copyMessage', 'answerCallbackQuery'];

const clean = v => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120);
async function settings(db) { return (await store.settings(db)).data || {}; }
async function enabled(db) { return (await settings(db)).funnelEnabled === true; }
// Repodagi tayyor PDFlar: admin "#voronka <kalit>" bilan fayl yuklamagan bo'lsa ham material bor hisoblanadi.
const BUNDLED_NAMES = { sovga: 'Domwork — 40 ta eng kerakli gap.pdf', qollanma_umumiy: 'Domwork — Ishda kerak 50 ibora.pdf',
    qollanma_office: 'Domwork — Ish suhbati 15 savol.pdf', qollanma_bank: 'Domwork — Bank va moliya.pdf', qollanma_med: 'Domwork — Tibbiyot.pdf',
    qollanma_gov: 'Domwork — Davlat xizmati.pdf', qollanma_sales: 'Domwork — Savdo va mijozlar.pdf', qollanma_daily: 'Domwork — Kundalik suhbat.pdf',
    qollanma_smena: 'Domwork — Ish va smena.pdf', qollanma_hujjat: 'Domwork — Hujjat va patent.pdf', qollanma_kundalik: 'Domwork — Shifokor, politsiya, transport.pdf',
    oferta: 'Domwork — Ommaviy oferta shartnomasi.pdf', promo1: 'domwork-dars.png', promo2: 'domwork-ish.png', promo3: 'domwork-rossiya.png', bonus: 'Domwork — Ishda kerak 50 ibora.pdf' };
const BUNDLED_FILE = { bonus: 'qollanma_umumiy' }; // kanal bonusi — «Ishda kerak 50 ibora» (umumiy qo'llanma)
const bundledCache = new Map();
function bundledFile(key) {
    if (!BUNDLED_NAMES[key]) return null;
    if (!bundledCache.has(key)) {
        const image = /\.png$/.test(BUNDLED_NAMES[key]);
        const path = require('node:path').join(__dirname, '..', '..', 'data', 'funnel', (BUNDLED_FILE[key] || key) + (image ? '.png' : '.pdf'));
        bundledCache.set(key, require('node:fs').existsSync(path) ? { path, filename: BUNDLED_NAMES[key], image } : null);
    }
    return bundledCache.get(key);
}
function media(s, key) {
    const m = s.funnelMedia?.[key];
    if (m && MEDIA_FIELD[m.method] && /^[A-Za-z0-9_-]{10,1024}$/.test(m.fileId)) return m;
    const file = bundledFile(key);
    return file ? { method: file.image ? 'sendPhoto' : 'sendDocument', bundled: key } : null;
}
const inline = rows => ({ inline_keyboard: rows.map(r => r.map(([text, data]) => (/^https:\/\//.test(data) ? { text, url: data } : { text, callback_data: data }))) });
const replyKeyboard = () => ({ keyboard: [[{ text: copy.KEYBOARD.contact }], [{ text: copy.KEYBOARD.guides }, { text: copy.KEYBOARD.faq }]], resize_keyboard: true });
const track = v => ['russia', 'abroad'].includes(v.segment) ? 'A' : v.segment ? 'B' : String(v.phone).startsWith('7') ? 'A' : 'B';
function mask(phone) { const d = String(phone || ''); return d.length < 7 ? d : '+' + d.slice(0, d.length - 7) + ' *** ** ' + d.slice(-2); }
function clock(now = new Date()) { const t = new Date(now.getTime() + 5 * 3600000); return t.getUTCHours() * 60 + t.getUTCMinutes(); }
function salesHours(s) {
    const m = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/.exec(s.salesHours || '');
    return m ? { from: +m[1] * 60 + +m[2], to: +m[3] * 60 + +m[4], label: m[1] + ':' + m[2] } : { from: 540, to: 1260, label: '09:00' };
}
const inHours = (s, now) => { const h = salesHours(s), c = clock(now); return c >= h.from && c < h.to; };
const sla = s => Number.isInteger(s.salesSlaMinutes) ? s.salesSlaMinutes : 30;

// Har bir update uchun noyob outbox kalitlari.
function context(db, update, tid) { let n = 0; return { db, tid, key: () => `f:${update.update_id}:${n++}` }; }
async function send(c, method, payload, { delayMs = 0, unless = '', automation = false, key = '', expires = '' } = {}) {
    await store.enqueue(c.db, { key: key || c.key(), targetId: c.tid, method, notBefore: new Date(Date.now() + delayMs),
        payload: { chat_id: c.tid, ...payload, _guest: { tid: c.tid, ...(unless ? { unless } : {}) }, ...(automation || delayMs ? { _automation: true } : {}), ...(expires ? { _expiresAt: expires } : {}) } });
}
const say = (c, text, markup, opts) => send(c, 'sendMessage', { text, ...(markup ? { reply_markup: markup } : {}) }, opts);
async function sendMedia(c, m, caption, markup, opts) {
    const file = m.bundled ? { [MEDIA_FIELD[m.method]]: 'bundled', _bundled: m.bundled } : { [MEDIA_FIELD[m.method]]: m.fileId };
    await send(c, m.method, { ...file, ...(caption ? { caption } : {}), ...(markup ? { reply_markup: markup } : {}) }, opts);
}
async function answer(db, update, text = '') {
    const q = update.callback_query;
    await store.enqueue(db, { key: `u:${update.update_id}:callback`, targetId: String(q.from.id), method: 'answerCallbackQuery',
        payload: { callback_query_id: q.id, ...(text ? { text: text.slice(0, 180) } : {}) } });
}
async function event(db, tid, name, data = {}) {
    await db.query('INSERT INTO domwork_bot_funnel_events(telegram_id,event,data) VALUES($1,$2,$3)', [tid, name, JSON.stringify(data)]);
}

async function visitor(db, tid) { return (await db.query('SELECT * FROM domwork_bot_visitors WHERE telegram_id=$1 FOR UPDATE', [tid])).rows[0] || null; }
async function upsertVisitor(db, from, { source = 'organic', leadId = null, phone = '' } = {}) {
    const tid = policy.telegramId(from?.id);
    // 10% — nazorat guruhi: isitish xabarlari yuborilmaydi (isitishning haqiqiy foydasini o'lchash uchun).
    await db.query(`INSERT INTO domwork_bot_visitors(telegram_id,first_name,username,source,lead_id,phone,variant,holdout) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT(telegram_id) DO UPDATE SET first_name=EXCLUDED.first_name,username=EXCLUDED.username,paused=false,blocked_at=NULL,drip_stopped=false,
        lead_id=COALESCE(domwork_bot_visitors.lead_id,EXCLUDED.lead_id),
        phone=CASE WHEN domwork_bot_visitors.phone='' THEN EXCLUDED.phone ELSE domwork_bot_visitors.phone END,
        source=CASE WHEN EXCLUDED.source<>'organic' THEN EXCLUDED.source ELSE domwork_bot_visitors.source END,updated_at=NOW()`,
    [tid, clean([from.first_name, from.last_name].filter(Boolean).join(' ')), clean(from.username).slice(0, 64), source, leadId, phone,
        Math.random() < 0.5 ? 'A' : 'B', Math.random() < 0.1]);
    return visitor(db, tid);
}
async function patch(db, tid, fields) {
    const keys = Object.keys(fields); if (!keys.length) return;
    await db.query(`UPDATE domwork_bot_visitors SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(',')},updated_at=NOW() WHERE telegram_id=$1`,
        [tid, ...keys.map(k => (fields[k] && typeof fields[k] === 'object' && !(fields[k] instanceof Date) ? JSON.stringify(fields[k]) : fields[k]))]);
}

// ── CRM lid: topish / yaratish / izoh ──────────────────────────────────────
async function leadComment(db, leadId, text) {
    const row = (await db.query('SELECT comments FROM leads WHERE id=$1 FOR UPDATE', [leadId])).rows[0];
    if (!row) return;
    let list; try { list = JSON.parse(row.comments || '[]'); } catch { list = null; }
    if (!Array.isArray(list)) return; // Buzilgan izohlar ustiga yozilmaydi.
    list.push({ id: randomUUID(), type: 'note', text: String(text).slice(0, 1500), author: 'Bot', ts: Date.now(), date: new Date().toLocaleDateString('uz-UZ') });
    await db.query('UPDATE leads SET comments=$2,updated_at=NOW() WHERE id=$1', [leadId, JSON.stringify(list)]);
}
async function linkLead(db, tid, lead) {
    await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-bot-links'))");
    const occupied = (await db.query('SELECT account_kind FROM domwork_bot_links WHERE telegram_id=$1', [tid])).rows[0];
    const taken = (await db.query("SELECT telegram_id FROM domwork_bot_links WHERE account_kind='lead' AND account_id=$1", [lead.id])).rows[0];
    if (occupied || (taken && taken.telegram_id !== tid)) return false;
    await db.query("INSERT INTO domwork_bot_links(telegram_id,account_kind,account_id,phone) VALUES($1,'lead',$2,$3)", [tid, lead.id, policy.phone(lead.phone)]);
    await store.audit(db, tid, 'lead-telegram-linked', lead.id, { method: 'funnel' });
    return true;
}
async function ensureLead(db, v, { phone = '', intent = '' } = {}) {
    if (v.lead_id) return v.lead_id;
    let lead = phone ? (await db.query(`SELECT id,name,phone FROM leads WHERE language='russian' AND deleted_at IS NULL AND domwork_phone(phone)=$1
        ORDER BY created_at DESC LIMIT 1`, [phone])).rows[0] : null;
    if (!lead) {
        const id = randomUUID(), name = v.first_name || 'Telegram mehmon';
        const src = /^(ig|fb|tt|yt|ads):(.*)$/.exec(v.source || '');
        const [utmSource, utmCampaign] = src ? [{ ig: 'instagram', fb: 'facebook', tt: 'tiktok', yt: 'youtube', ads: 'ads' }[src[1]], src[2]] : ['telegram-bot', ''];
        const extra = { utmSource, ...(utmCampaign ? { utmCampaign } : {}), telegramId: v.telegram_id, ...(v.username ? { telegramUsername: v.username } : {}), botIntent: intent };
        const comments = [{ id: randomUUID(), type: 'note', author: 'Bot', ts: Date.now(), date: new Date().toLocaleDateString('uz-UZ'),
            text: `🤖 @Domworkuz_bot orqali keldi${v.username ? ' · @' + v.username : ''} · Telegram ID ${v.telegram_id}` }];
        await db.query(`INSERT INTO leads(id,name,phone,phone2,email,source,language,date,external_id,status,lead_type,comments,attachments,created_at,updated_at,extra_data)
            VALUES($1,$2,$3,'','','Telegram bot','russian',$4,$5,'yangi-lidlar','organic',$6,'[]',NOW(),NOW(),$7)`,
        [id, name, phone ? '+' + phone : '', new Date().toLocaleDateString('uz-UZ'), 'tg_' + v.telegram_id, JSON.stringify(comments), JSON.stringify(extra)]);
        await db.query("INSERT INTO lead_audit(lead_id,action,actor_id,actor_name,snapshot) VALUES($1,'created','','Bot',$2)",
            [id, JSON.stringify({ id, name, source: 'Telegram bot', language: 'russian', status: 'yangi-lidlar', ...extra })]);
        lead = { id, name, phone: phone ? '+' + phone : '' };
    }
    await linkLead(db, v.telegram_id, lead);
    await patch(db, v.telegram_id, { lead_id: lead.id });
    v.lead_id = lead.id;
    return lead.id;
}

// ── Sotuv bo'limiga xabar ─────────────────────────────────────────────────
function profile(v, lead) {
    const seg = copy.SEGMENTS[v.segment]?.label || 'segment tanlanmagan', field = copy.FIELDS[v.field]?.label || '';
    const quiz = v.quiz_done_at ? `test ${Object.values(v.quiz || {}).filter(x => x.ok).length}/3` : 'test yo‘q';
    return [`👤 ${lead?.name || v.first_name || 'Mehmon'}${v.username ? ' · @' + v.username : ''} · tg://user?id=${v.telegram_id}`,
        `📞 ${lead?.phone || (v.phone ? '+' + v.phone : 'raqam yo‘q — faqat Telegram')}`,
        `🎯 ${seg}${field ? ' · ' + field : ''}`,
        `📈 Ball ${v.score} · 1-dars: ${v.lesson_seen_at || v.lesson_parts >= 2 ? 'ko‘rdi' : v.lesson_parts ? 'ochdi' : 'yo‘q'} · ${quiz} · manba: ${v.source}`].join('\n');
}
async function salesGroup(db) { return (await db.query("SELECT id,chat_id FROM domwork_bot_groups WHERE type='sales' AND scope='' AND active")).rows[0] || null; }
const managerButtons = tid => ({ inline_keyboard: [[{ text: '📞 Gaplashdim', callback_data: `m:${tid}:talk` }, { text: '🔕 Javob yo‘q', callback_data: `m:${tid}:na` }],
    [{ text: '⏰ Keyinroq', callback_data: `m:${tid}:later` }, { text: '✅ Sinovga yozdim', callback_data: `m:${tid}:trial` }], [{ text: '❌ Rad etdi', callback_data: `m:${tid}:rej` }]] });
async function notifySales(db, key, title, v, extra = '', { buttons = false } = {}) {
    const lead = v.lead_id ? (await db.query('SELECT name,phone,manager_id FROM leads WHERE id=$1', [v.lead_id])).rows[0] : null;
    const text = `${title}\n${profile(v, lead)}${extra ? '\n' + extra : ''}\n↩️ Javob yozish: shu xabarga reply qiling — lidga bot orqali boradi.`;
    const events = require('./events');
    // Voronka xabarlari umumiy "guruh xabarlari" tugmasiga bog'liq emas — faqat funnelEnabled va faol "Sotuv" guruhi.
    const group = await salesGroup(db);
    if (group) await store.enqueue(db, { key: 'funnel:' + key + ':' + group.id, targetKind: 'group', targetId: group.chat_id,
        payload: { chat_id: group.chat_id, text: text.slice(0, 3500), ...(buttons ? { reply_markup: managerButtons(v.telegram_id) } : {}),
            _automation: true, _binding: group.id, _funnel: true, _relay: v.telegram_id } });
    if (lead?.manager_id) await events.privateMessage(db, 'funnel:' + key + ':m', await events.employee(db, lead.manager_id), text);
}
async function addScore(db, v, n, reason) {
    const before = v.score; v.score = before + n;
    await patch(db, v.telegram_id, { score: v.score });
    if (before < 6 && v.score >= 6 && !v.requested_at && !v.hot_at) {
        await patch(db, v.telegram_id, { hot_at: new Date() });
        await notifySales(db, 'hot:' + v.telegram_id, '🔥 Issiq lid (so‘rov qoldirmagan) — faqat Telegramda yumshoq yozing, qo‘ng‘iroq qilmang', v, 'Sabab: ' + reason, { buttons: true });
    }
}

// ── Qadamlar ──────────────────────────────────────────────────────────────
async function askSegment(c, opts) {
    await say(c, copy.text.segment, inline(Object.entries(copy.SEGMENTS).map(([k, s]) => [[s.label, 'f:seg:' + k]])), opts);
}
async function askField(c, v, opts) {
    const choices = copy.FIELD_CHOICES[v.segment] || copy.FIELD_CHOICES.career;
    await say(c, copy.text.field, inline([...choices.map(k => [[copy.FIELDS[k].label, 'f:fld:' + k]]), [[copy.text.later, 'f:fld:none']]]), opts);
}
function landingGoal(comments) {
    try { for (const c of JSON.parse(comments || '[]')) { const m = /Maqsad:\s*([^|]+)/.exec(c?.text || ''); if (m) return copy.LANDING_GOALS[m[1].trim()] || null; } } catch { /* izohsiz */ }
    return null;
}
async function start(db, update, message, { lead = null, payload = '' } = {}) {
    const from = message.from, c = context(db, update, String(from.id)), s = await settings(db);
    // Reklama manbalari: ig_<kampaniya> (Instagram/Chatplace), fb_<kampaniya> (Meta lid-forma "Rahmat" tugmasi), tt_, yt_, ads_.
    const ad = /^(ig|fb|tt|yt|ads)_([A-Za-z0-9_-]{1,40})$/.exec(payload) || (/^(fb|ads)$/.exec(payload) ? [payload, payload, 'form'] : null);
    const source = lead ? 'landing' : ad ? ad[1] + ':' + ad[2] : 'organic';
    // Landing raqami tasdiqlanmagan — mehmon raqami faqat Telegram kontakt tugmasi orqali olinadi.
    const v = await upsertVisitor(db, from, { source, leadId: lead?.id || null });
    if (lead && !v.segment) {
        const goal = landingGoal((await db.query('SELECT comments FROM leads WHERE id=$1', [lead.id])).rows[0]?.comments);
        if (goal) { await patch(db, v.telegram_id, { segment: goal }); v.segment = goal; }
    }
    await event(db, c.tid, 'start', { source, variant: v.variant });
    const name = clean(String(lead?.name || from.first_name || '').split(' ')[0]) || 'do‘st';
    await say(c, copy.text.greeting(name, !!lead), replyKeyboard());
    const gift = media(s, 'sovga'), hasLesson = !!media(s, 'dars1');
    const next = inline([hasLesson ? [[copy.text.lessonWatch, 'f:les']] : [[copy.KEYBOARD.contact, 'f:cta']]]);
    if (gift) { await sendMedia(c, gift, copy.text.gift + '\n\n' + (hasLesson ? copy.text.giftNext : ''), next); await event(db, c.tid, 'gift'); }
    else await say(c, hasLesson ? copy.text.giftNext : copy.text.lessonMissing, next);
    // Meta lid-formasidan kelgan (fb_/ads_) va hali CRM lidiga ulanmagan — arizasini topish uchun bir bosishda raqam.
    if (/^(fb|ads):/.test(v.source) && !v.lead_id && !v.phone) {
        await patch(db, c.tid, { awaiting: 'match' });
        await say(c, copy.text.matchAsk, { keyboard: [[{ text: copy.text.contactButton, request_contact: true }], [{ text: copy.text.later }]], resize_keyboard: true, one_time_keyboard: true });
    }
    // Segment savoli 2 daqiqadan keyin (shu orada tanlangan bo'lsa yuborilmaydi).
    // Qayta /start bosilsa ham bitta kechiktirilgan savol (barqaror kalit).
    if (!v.segment) await askSegment(c, { delayMs: 120000, unless: 'segment', key: 'f:seg-ask:' + c.tid });
    else if (!v.field) await askField(c, v, { delayMs: 120000, unless: 'field', key: 'f:fld-ask:' + c.tid });
}
async function lesson(c, v, part = 1) {
    const s = await settings(c.db), m = media(s, 'dars' + part);
    if (!m) { if (part === 1) await say(c, copy.text.lessonMissing, inline([[[copy.KEYBOARD.contact, 'f:cta']]])); return; }
    if (part === 1 && !v.phone) {
        await patch(c.db, c.tid, { awaiting: 'lesson' });
        await say(c, copy.text.lessonAsk, { keyboard: [[{ text: copy.text.contactButton, request_contact: true }], [{ text: copy.text.cancel }]], resize_keyboard: true, one_time_keyboard: true });
        await event(c.db, c.tid, 'lesson_phone_ask');
        return;
    }
    const more = media(s, 'dars' + (part + 1));
    await sendMedia(c, m, part === 1 ? copy.text.lesson1 : copy.text.lesson2, inline([more ? [[copy.text.lessonMore, 'f:les:' + (part + 1)]] : [[copy.text.lessonSeen, 'f:seen']]]));
    if (part > v.lesson_parts) {
        await patch(c.db, c.tid, { lesson_parts: part }); v.lesson_parts = part;
        if (part === 2) await addScore(c.db, v, 3, '1-darsning 2-qismini ochdi');
    }
    await event(c.db, c.tid, 'lesson_part', { part });
}
async function quizQuestion(c, i) {
    const q = copy.QUIZ[i];
    await say(c, (i === 0 ? copy.text.quizIntro + '\n\n' : '') + q.q, inline(q.options.map(([k, label]) => [[label, `f:q:${i}:${k}`]])));
}
async function cta(c, v) {
    const s = await settings(c.db), t = track(v);
    const percent = Number.isInteger(s.discountPercent) && s.discountPercent > 0 ? s.discountPercent : 0;
    let discount = null;
    if (percent) {
        if (!v.discount_until) { v.discount_until = new Date(Date.now() + (Number(s.discountHours) || 72) * 3600000); await patch(c.db, c.tid, { discount_until: v.discount_until }); }
        if (new Date(v.discount_until) > new Date()) discount = { percent, until: new Date(v.discount_until).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) };
    }
    const quote = s.funnelTestimonials?.[t];
    const body = copy.text.cta(t, discount) + (quote ? '\n\n' + copy.text.testimonial(quote) : '');
    const markup = inline([[[copy.text.ctaCall, 'f:call']], [[copy.text.ctaTelegram, 'f:tg'], [copy.text.ctaInfo, 'f:info']]]);
    const photo = media(s, 'menejer');
    if (photo && body.length <= 1000) await sendMedia(c, photo, body, markup); else await say(c, body, markup);
    if (!v.cta_at) await patch(c.db, c.tid, { cta_at: new Date() });
    await event(c.db, c.tid, 'cta', { discount: !!discount });
}
async function askWhen(c, method) {
    await patch(c.db, c.tid, { request: { method } });
    const keys = Object.keys(copy.WHEN);
    await say(c, copy.text.whenAsk, inline([[[copy.WHEN.now, 'f:w:now'], [copy.WHEN.eve, 'f:w:eve']], [[copy.WHEN.morn, 'f:w:morn'], [copy.WHEN.aft, 'f:w:aft']], [[copy.WHEN.wknd, 'f:w:wknd']]].map(r => r.filter(([, d]) => keys.includes(d.slice(4))))));
}
async function askContact(c, purpose) {
    await patch(c.db, c.tid, { awaiting: purpose });
    await say(c, purpose === 'call' ? copy.text.callAsk : copy.text.lessonAsk,
        { keyboard: [[{ text: copy.text.contactButton, request_contact: true }], [{ text: copy.text.cancel }]], resize_keyboard: true, one_time_keyboard: true });
}
async function finishRequest(c, v, whenKey) {
    const s = await settings(c.db), method = v.request?.method === 'telegram' ? 'telegram' : 'call';
    if (method === 'call' && !v.phone) return askContact(c, 'call');
    await ensureLead(c.db, v, { phone: v.phone, intent: 'call' });
    const first = !v.requested_at, same = v.requested_at && v.request?.when === whenKey && v.request?.method === method;
    await patch(c.db, c.tid, { request: { method, when: whenKey }, requested_at: new Date() }); v.requested_at = new Date();
    const whenText = copy.WHEN[whenKey];
    // Eski tugmani qayta bosish sotuvga takroriy xabar va izoh yubormaydi.
    if (!same) {
        await leadComment(c.db, v.lead_id, `🤖 Bot: menejer bilan bog‘lanishni so‘radi — ${method === 'call' ? 'qo‘ng‘iroq' : 'faqat Telegram'}, ${whenText}. Ball ${v.score}.`);
        await notifySales(c.db, `req:${c.tid}:${method}:${whenKey}:${new Date().toISOString().slice(0, 10)}`, `📞 Botdan so‘rov: ${method === 'call' ? 'qo‘ng‘iroq qiling' : 'Telegramda yozing'} — ${whenText}`, v, '', { buttons: true });
    }
    const now = new Date(), open = inHours(s, now);
    let reply = whenKey === 'now' ? (open ? copy.text.done.nowIn(sla(s)) : copy.text.done.offHours(salesHours(s).label)) : copy.text.done.later(whenText);
    if (method === 'telegram') reply += copy.text.done.telegram;
    const showLesson = !v.lesson_parts && media(s, 'dars1');
    await say(c, reply + (showLesson ? copy.text.done.andLesson : ''), showLesson ? inline([[[copy.text.lessonWatch, 'f:les']]]) : replyKeyboard());
    if (first) await event(c.db, c.tid, 'request', { method, when: whenKey });
}
async function guide(c, v, fieldKey) {
    const s = await settings(c.db), f = copy.FIELDS[fieldKey];
    if (f) await patch(c.db, c.tid, { field: fieldKey });
    const m = media(s, 'qollanma_' + fieldKey) || media(s, 'qollanma_umumiy');
    const buttons = [[[copy.KEYBOARD.contact, 'f:cta']], ...(!v.lesson_parts && media(s, 'dars1') ? [[[copy.text.lessonWatch, 'f:les']]] : [])];
    if (m) {
        if (f) await say(c, copy.text.promise(f));
        await sendMedia(c, m, copy.text.guide(f || { label: '📘 Umumiy' }), inline(buttons));
    } else await say(c, f ? copy.text.promise(f) : copy.text.askManager, inline(buttons)); // tayyor bo'lmagan qo'llanma ko'rsatilmaydi
    if (!v.guide_at) { await patch(c.db, c.tid, { guide_at: new Date() }); await addScore(c.db, v, 1, 'qo‘llanma oldi'); }
    await event(c.db, c.tid, 'guide', { field: fieldKey });
}
async function faqList(c, v) {
    await say(c, copy.text.faqTitle, inline(copy.FAQ_ORDER[track(v)].map(k => [[copy.FAQ[k][0], 'f:faq:' + k]])));
}

// ── Kirish nuqtalari (handlers.js chaqiradi) ─────────────────────────────
async function callback(db, update) {
    const q = update.callback_query, tid = policy.telegramId(q?.from?.id), data = String(q?.data || '');
    if (!tid || q.message?.chat?.type !== 'private' || !(await enabled(db))) return answer(db, update);
    const identity = await store.identity(db, tid);
    if (identity) { await answer(db, update, 'Menyudagi bo‘limlardan foydalaning.'); return; }
    const v = (await visitor(db, tid)) || await upsertVisitor(db, q.from);
    if (v.blocked_at) { await patch(db, tid, { blocked_at: null }); v.blocked_at = null; } // bosdi = bloklamagan (/stop esa saqlanadi)
    await patch(db, tid, { ignored: 0, last_seen_at: new Date() });
    const c = context(db, update, tid);
    await answer(db, update);
    let m;
    if ((m = /^f:seg:(career|russia|daily|abroad)$/.exec(data))) {
        await patch(db, tid, { segment: m[1] }); v.segment = m[1]; await event(db, tid, 'segment', { segment: m[1] });
        const choices = copy.FIELD_CHOICES[m[1]];
        if (choices.length === 1) return guide(c, v, choices[0]);
        return askField(c, v);
    }
    if ((m = /^f:fld:([a-z]+)$/.exec(data))) return guide(c, v, copy.FIELDS[m[1]] ? m[1] : 'none');
    if (data === 'f:les') return lesson(c, v, 1);
    if ((m = /^f:les:([2-3])$/.exec(data))) return lesson(c, v, Number(m[1]));
    if (data === 'f:seen') {
        if (!v.lesson_seen_at) {
            await patch(db, tid, { lesson_seen_at: new Date() });
            if (v.lesson_parts < 2) await addScore(db, v, 3, '1-darsni ko‘rdi');
            await event(db, tid, 'lesson_seen');
        }
        if (!v.quiz_done_at && !Object.keys(v.quiz || {}).length) return quizQuestion(c, 0);
        return cta(c, v);
    }
    if ((m = /^f:q:([0-2]):([abc])$/.exec(data))) {
        const i = Number(m[1]), quiz = v.quiz || {};
        if (quiz[i] || v.quiz_done_at) return;
        quiz[i] = { a: m[2], ok: copy.QUIZ[i].correct === m[2] };
        await patch(db, tid, { quiz });
        if (i < copy.QUIZ.length - 1) return quizQuestion(c, i + 1);
        await patch(db, tid, { quiz_done_at: new Date() }); v.quiz = quiz; v.quiz_done_at = new Date();
        const right = copy.QUIZ.filter((x, k) => quiz[k]?.ok), wrong = copy.QUIZ.filter((x, k) => !quiz[k]?.ok);
        await say(c, copy.text.quizSummary(right, wrong));
        await addScore(db, v, 2, `testni yechdi (${right.length}/3)`);
        await event(db, tid, 'quiz', { right: right.length });
        // Asosiy taklif testdan 2 daqiqa keyin (shu orada so'rov qoldirsa — yuborilmaydi).
        return ctaLater(c);
    }
    if (data === 'f:bonus') return bonus(c, v);
    if (data === 'f:faqlist') return faqList(c, v);
    if ((m = /^f:poll:(speak|listen|grammar|words)$/.exec(data))) {
        await event(db, tid, 'poll', { a: m[1] });
        return say(c, copy.POLL[m[1]][1], inline([[[copy.KEYBOARD.contact, 'f:cta']]]));
    }
    if ((m = /^f:react:(yes|no)$/.exec(data))) {
        await event(db, tid, 'react', { a: m[1] });
        if (m[1] === 'no') { await patch(db, tid, { drip_stopped: true }); return say(c, copy.drip.reactBye); }
        await patch(db, tid, { monthly: true }); // faqat aniq "Ha" — oylik iboralar
        return say(c, '👍');
    }
    if (data === 'f:cta') return cta(c, v);
    if (data === 'f:call') return v.phone ? say(c, copy.text.callConfirm(mask(v.phone)), inline([[[copy.text.yes, 'f:cok'], [copy.text.otherNumber, 'f:cnew']]])) : askContact(c, 'call');
    if (data === 'f:cnew') return askContact(c, 'call');
    if (data === 'f:cok') return askWhen(c, 'call');
    if (data === 'f:tg') return askWhen(c, 'telegram');
    if ((m = /^f:w:(now|eve|morn|aft|wknd)$/.exec(data))) { if (!v.request?.method) return askWhen(c, 'call'); return finishRequest(c, v, m[1]); }
    if (data === 'f:info') {
        const s = await settings(db);
        await say(c, copy.text.info(clean(s.companyInfo || '').slice(0, 300)), inline([[[copy.text.ctaCall, 'f:call']], [[copy.text.ctaTelegram, 'f:tg']]]));
        const doc = media(s, 'shartnoma'); if (doc) await sendMedia(c, doc, 'Shartnoma namunasi');
        return event(db, tid, 'info');
    }
    if ((m = /^f:faq:([a-z]+)$/.exec(data)) && copy.FAQ[m[1]]) {
        const k = m[1]; await event(db, tid, 'faq', { k });
        if (k === 'price') {
            if (!v.price_at) {
                await patch(db, tid, { price_at: new Date() });
                await addScore(db, v, 3, 'narxni so‘radi');
                await notifySales(db, 'price:' + tid, '💰 Narxni so‘radi — iloji boricha tez yozing', v, '', { buttons: true });
            }
            return say(c, copy.FAQ.price[1] + '\n\n' + copy.text.priceDone, inline([[[copy.text.ctaCall, 'f:call']], [[copy.text.ctaTelegram, 'f:tg']]]));
        }
        return say(c, copy.FAQ[k][1], inline([[[copy.KEYBOARD.contact, 'f:cta']]]));
    }
}
async function ctaLater(c) {
    // Kechiktirilgan taklif: alohida xabar emas, CTA tugmasi bilan qisqa matn — yetkazishda so'rov bo'lsa bekor.
    await say(c, copy.text.askManager, inline([[[copy.KEYBOARD.contact, 'f:cta']]]), { delayMs: 120000, unless: 'request' });
}
async function message(db, update) {
    const m = update.message, tid = String(m.from.id), text = String(m.text || '').trim();
    const st = /^\/start(?:@Domworkuz_bot)?(?:\s+(\S{1,64}))?$/i.exec(text);
    const v = await visitor(db, tid);
    if (st || !v) return start(db, update, m, { payload: st?.[1] || '' });
    if (v.blocked_at) await patch(db, tid, { blocked_at: null }); // yozdi = botni blokdan chiqargan
    await patch(db, tid, { ignored: 0, last_seen_at: new Date() });
    const c = context(db, update, tid);
    if (text === copy.KEYBOARD.contact) return cta(c, v);
    if (text === copy.KEYBOARD.guides) return v.segment ? askField(c, v) : askSegment(c);
    if (text === copy.KEYBOARD.faq) return faqList(c, v);
    if (text === copy.text.cancel || (text === copy.text.later && v.awaiting === 'match')) { await patch(db, tid, { awaiting: '' }); return say(c, '👌', replyKeyboard()); }
    // Erkin matn yoki ovoz → menejerga.
    const s = await settings(db);
    const snippet = text ? text.slice(0, 500) : m.voice ? '[ovozli xabar]' : m.photo ? '[rasm]' : '[xabar]';
    await notifySales(db, 'msg:' + update.update_id, `✉️ Lid botga yozdi: «${snippet}»`, v);
    // Ovoz/rasm/video — menejer eshitishi/ko'rishi uchun guruhga nusxa (unga ham reply qilish mumkin).
    const group = !text && (m.voice || m.photo || m.video || m.document || m.audio || m.video_note) ? await salesGroup(db) : null;
    if (group) await store.enqueue(db, { key: 'funnel:copy:' + update.update_id, targetKind: 'group', targetId: group.chat_id, method: 'copyMessage',
        payload: { chat_id: group.chat_id, from_chat_id: tid, message_id: m.message_id, _automation: true, _binding: group.id, _funnel: true, _relay: tid } });
    await event(db, tid, 'free_text');
    if (!v.texted_at) { await patch(db, tid, { texted_at: new Date() }); await addScore(db, v, 2, 'savol yozdi'); }
    return say(c, copy.text.freeText(inHours(s, new Date()), sla(s)), replyKeyboard());
}
// Telefon raqami CRMdagi o'quvchi/xodimga mos kelmadi — mehmon lid sifatida davom etadi.
async function contact(db, update, m) {
    const own = policy.contactIdentity(m); // faqat o'z kontakti
    const c = context(db, update, own.telegramId);
    const v = (await visitor(db, own.telegramId)) || await upsertVisitor(db, m.from);
    const purpose = v.awaiting || 'contact';
    await patch(db, own.telegramId, { phone: own.phone, phone_purpose: purpose === 'lesson' ? 'lesson' : purpose, awaiting: '' });
    v.phone = own.phone;
    await ensureLead(db, v, { phone: own.phone, intent: purpose === 'lesson' ? 'lesson' : 'call' });
    if (purpose === 'lesson') await leadComment(db, v.lead_id, '🤖 Bot: raqamni 1-darsni ko‘rish uchun berdi — qo‘ng‘iroq SHART EMAS. Faqat ball yig‘ilsa Telegramda yumshoq yozing.');
    await event(db, own.telegramId, 'contact', { purpose });
    await say(c, copy.text.contactSaved, replyKeyboard());
    if (purpose === 'lesson') return lesson(c, v, 1);
    if (purpose === 'call') return askWhen(c, 'call');
    if (purpose === 'match') {
        // Ariza topildi: menejerga lid botga ulangani haqida xabar (endi u bot orqali yoza oladi), mehmonga — menejer ismi.
        const lead = (await db.query('SELECT l.source,h.name AS manager FROM leads l LEFT JOIN hr_employees h ON h.id=l.manager_id WHERE l.id=$1', [v.lead_id])).rows[0];
        const found = lead && lead.source !== 'Telegram bot'; // bot o'zi yaratgan bo'lsa — ariza topilmagan (boshqa raqam)
        if (found) await notifySales(db, 'match:' + own.telegramId, '🔗 Arizachi botga ulandi — endi bot orqali ham yozishingiz mumkin', v);
        return say(c, found ? copy.text.matched(lead.manager ? String(lead.manager).split(' ')[0] : '') : copy.text.matchNew, replyKeyboard());
    }
    return cta(c, v);
}
async function pause(db, tid) { await db.query('UPDATE domwork_bot_visitors SET paused=true,updated_at=NOW() WHERE telegram_id=$1', [tid]); }
async function blocked(db, tid) { await db.query('UPDATE domwork_bot_visitors SET blocked_at=NOW() WHERE telegram_id=$1', [tid]); }

// Outbox yetkazishdan oldin (runtime.permitted): mehmon hali ochiqmi, shart bajarilganmi.
async function deliverable(db, row) {
    const g = row.payload._guest;
    if (!GUEST_METHODS.includes(row.method) || row.target_kind !== 'private' || g.tid !== row.target_id) return false;
    if (!(await enabled(db))) return false;
    const v = (await db.query('SELECT * FROM domwork_bot_visitors WHERE telegram_id=$1', [g.tid])).rows[0];
    if (!v || v.blocked_at || ((row.payload._automation || row.payload._relayOut) && v.paused)) return false;
    if (g.unless === 'segment' && v.segment) return false;
    if (g.unless === 'field' && (v.field || v.guide_at)) return false;
    if (g.unless === 'request' && v.requested_at) return false;
    if (row.payload._automation) { const identity = await store.identity(db, g.tid); if (identity) return false; }
    return true;
}

// Admin: "#voronka <kalit>" izohi bilan fayl → material saqlanadi; "#voronka" → ro'yxat.
async function adminMedia(db, identity, m) {
    if (identity?.role !== 'admin') throw policy.error(403, 'Faqat admin');
    const words = String(m.caption || m.text || '').trim().split(/\s+/);
    const key = (words[1] || '').toLowerCase();
    const row = (await db.query('SELECT data FROM domwork_bot_settings WHERE singleton=1 FOR UPDATE')).rows[0];
    const data = row.data, stored = data.funnelMedia || {};
    if (!key) return 'Voronka materiallari:\n' + MEDIA_KEYS.map(k => `${stored[k] ? '✅' : '▫️'} ${k}`).join('\n')
        + '\n\nAlmashtirish: faylni yuboring va izohga yozing: #voronka <kalit>\nO‘chirish: #voronka ochir <kalit>';
    if (key === 'ochir') {
        const k = (words[2] || '').toLowerCase();
        if (!MEDIA_KEYS.includes(k)) throw policy.error(400, 'Kalit noto‘g‘ri');
        delete stored[k];
    } else {
        if (!MEDIA_KEYS.includes(key)) throw policy.error(400, 'Kalit noto‘g‘ri. Ro‘yxat: #voronka');
        const file = m.photo?.at(-1) ? ['sendPhoto', m.photo.at(-1)] : m.video ? ['sendVideo', m.video] : m.audio ? ['sendAudio', m.audio]
            : m.voice ? ['sendVoice', m.voice] : m.document ? ['sendDocument', m.document] : null;
        if (!file) throw policy.error(400, 'Fayl (rasm, video, audio yoki hujjat) yuboring va izohga #voronka <kalit> yozing');
        stored[key] = { method: file[0], fileId: String(file[1].file_id), at: new Date().toISOString() };
    }
    data.funnelMedia = stored;
    await db.query('UPDATE domwork_bot_settings SET data=$1,revision=revision+1 WHERE singleton=1', [JSON.stringify(data)]);
    await store.audit(db, identity.id, 'funnel-media', key === 'ochir' ? words[2] : key);
    return key === 'ochir' ? `🗑 ${words[2]} o‘chirildi` : `✅ ${key} saqlandi`;
}

// CRM uchun voronka hisoboti (admin): bosqichlar bo'yicha unikal odamlar.
async function report(db, days = 30) {
    const rows = (await db.query(`SELECT event,COUNT(DISTINCT telegram_id)::int AS people FROM domwork_bot_funnel_events
        WHERE created_at>NOW()-($1::int*INTERVAL '1 day') GROUP BY event`, [days])).rows;
    const by = Object.fromEntries(rows.map(r => [r.event, r.people]));
    // Isitish: har xabar nechta odamga ketdi va undan keyin nechtasi botni blokladi (1.5% dan oshsa — xabarni qayta ko'rib chiqing).
    const drips = (await db.query(`WITH e AS (SELECT event,telegram_id,COALESCE(data->>'item',data->>'after') AS item FROM domwork_bot_funnel_events
            WHERE event IN ('drip','blocked') AND created_at>NOW()-($1::int*INTERVAL '1 day'))
        SELECT item,COUNT(DISTINCT telegram_id) FILTER(WHERE event='drip')::int AS sent,COUNT(DISTINCT telegram_id) FILTER(WHERE event='blocked')::int AS blocked
        FROM e WHERE item<>'' GROUP BY item HAVING COUNT(*) FILTER(WHERE event='drip')>0 ORDER BY item`, [days])).rows
        .map(r => ({ ...r, blockRate: r.sent ? Math.round(r.blocked / r.sent * 1000) / 10 : 0, alert: r.sent >= 20 && r.blocked / r.sent > 0.015 }));
    const outcomes = (await db.query(`SELECT data->>'action' AS action,COUNT(*)::int AS count FROM domwork_bot_funnel_events
        WHERE event='outcome' AND created_at>NOW()-($1::int*INTERVAL '1 day') GROUP BY 1`, [days])).rows;
    const st = await settings(db);
    // Tayyorlik: har material — yuklangan (Telegram fayli), tayyor (repodagi fayl) yoki yo'q.
    const materials = MEDIA_KEYS.map(k => ({ key: k, state: st.funnelMedia?.[k] ? 'uploaded' : bundledFile(k) ? 'bundled' : 'missing' }));
    return { materials, days, steps: ['start', 'gift', 'segment', 'guide', 'lesson_part', 'lesson_seen', 'quiz', 'cta', 'contact', 'request'].map(e => ({ event: e, people: by[e] || 0 })),
        faq: by.faq || 0, freeText: by.free_text || 0, bonus: by.bonus || 0, relays: by.relay_out || 0, drips, outcomes };
}

// ── Kanal bonusi: obunani Telegram orqali tekshiradi (bot kanalda admin bo'lishi kerak) ──
async function bonus(c, v) {
    const s = await settings(c.db), channel = s.bonusChannel, m = media(s, 'bonus');
    if (!channel || !m) return say(c, copy.text.askManager, inline([[[copy.KEYBOARD.contact, 'f:cta']]]));
    if (v.bonus_at) return sendMedia(c, m, copy.drip.bonusOk);
    // Tekshiruv bot navbatini ushlab turmasin: bir odamga 15 soniyada bir marta.
    if (v.bonus_checked_at && Date.now() - new Date(v.bonus_checked_at) < 15000) return say(c, copy.drip.bonusFail, inline([[[copy.drip.bonusCheck, 'f:bonus']]]));
    await patch(c.db, c.tid, { bonus_checked_at: new Date() });
    let member = null;
    try { member = await c.db.domworkTelegram?.('getChatMember', { chat_id: channel, user_id: Number(c.tid) }); } catch { member = null; }
    if (!member) return say(c, copy.drip.bonusFail, inline([[[copy.drip.bonusCheck, 'f:bonus']]]));
    if (!['member', 'administrator', 'creator'].includes(member.status) && !(member.status === 'restricted' && member.is_member)) {
        return say(c, copy.drip.bonusNo, inline([[[copy.drip.bonusJoin, 'https://t.me/' + channel.slice(1)]], [[copy.drip.bonusCheck, 'f:bonus']]]));
    }
    await patch(c.db, c.tid, { bonus_at: new Date() });
    await event(c.db, c.tid, 'bonus');
    await sendMedia(c, m, copy.drip.bonusOk, inline([[[copy.KEYBOARD.contact, 'f:cta']]]));
}

// ── Menejer Sotuv guruhida bot xabariga "reply" qiladi → javob lidga bot orqali ──
const SALES_ROLES = ['sales', 'rop', 'admin'];
async function relayFromGroup(db, update) {
    const m = update.message, chatId = String(m.chat.id), replyTo = m.reply_to_message;
    if (!replyTo?.from?.is_bot || m.from?.is_bot) return false;
    const link = (await db.query('SELECT telegram_id FROM domwork_bot_relay WHERE chat_id=$1 AND message_id=$2', [chatId, replyTo.message_id])).rows[0];
    if (!link) return false;
    const group = await salesGroup(db);
    if (!group || group.chat_id !== chatId) return false;
    const staff = await store.identity(db, policy.telegramId(m.from.id));
    const note = text => store.enqueue(db, { key: `u:${update.update_id}:relay-note`, targetKind: 'group', targetId: chatId,
        payload: { chat_id: chatId, text, reply_to_message_id: m.message_id, _automation: true, _binding: group.id, _funnel: true } });
    if (!staff || !SALES_ROLES.includes(staff.role)) {
        await note('Javob yuborilmadi: avval CRM → Sozlamalar → Bildirishnomalar → Telegram botni ulang.');
        return true;
    }
    const tid = link.telegram_id, c = context(db, update, tid);
    const header = `👩‍💼 ${clean(staff.name).split(' ')[0] || 'Menejer'} (Domwork):`;
    if (m.text) await send(c, 'sendMessage', { text: `${header}\n${String(m.text).slice(0, 3500)}`, _relayOut: true });
    else { await send(c, 'sendMessage', { text: header, _relayOut: true }); await send(c, 'copyMessage', { from_chat_id: chatId, message_id: m.message_id, _relayOut: true }); }
    const v = await visitor(db, tid);
    if (v?.lead_id) await leadComment(db, v.lead_id, `🤖 ${clean(staff.name)} bot orqali yozdi: ${m.text ? String(m.text).slice(0, 300) : '[media]'}`);
    await event(db, tid, 'relay_out', { by: staff.id });
    return true;
}

// ── Menejer tugmalari (Sotuv guruhidagi so'rov xabari ostida) ──
const OUTCOMES = { talk: '📞 Gaplashdi', na: '🔕 Javob yo‘q', later: '⏰ Keyinroq', trial: '✅ Sinovga yozildi',
    'r:price': '❌ Rad — narx', 'r:time': '❌ Rad — vaqt', 'r:think': '❌ O‘ylab ko‘radi', 'r:no': '❌ Qiziqmaydi' };
async function managerAction(db, update) {
    const q = update.callback_query, data = String(q.data || ''), m = /^m:(\d{1,16}):(talk|na|later|trial|rej|r:(?:price|time|think|no))$/.exec(data);
    const ack = text => store.enqueue(db, { key: `u:${update.update_id}:callback`, targetId: String(q.from.id), method: 'answerCallbackQuery',
        payload: { callback_query_id: q.id, ...(text ? { text: text.slice(0, 180), show_alert: false } : {}) } });
    if (!m) return ack();
    const staff = await store.identity(db, policy.telegramId(q.from.id));
    if (!staff || !SALES_ROLES.includes(staff.role)) return ack('Avval CRMda Telegramni ulang (Sozlamalar → Bildirishnomalar).');
    const group = await salesGroup(db), chatId = String(q.message?.chat?.id || '');
    if (!group || group.chat_id !== chatId) return ack();
    const tid = m[1], action = m[2];
    // Tugma aynan shu lid haqidagi bot xabarida bo'lishi shart (soxta callback boshqa lidga ta'sir qilmasin).
    if (!(await db.query('SELECT 1 FROM domwork_bot_relay WHERE chat_id=$1 AND message_id=$2 AND telegram_id=$3', [chatId, q.message?.message_id, tid])).rows.length) return ack('Xabar eskirgan');
    const v = await visitor(db, tid);
    if (!v) return ack('Lid topilmadi');
    const edit = markup => store.enqueue(db, { key: `u:${update.update_id}:mk`, targetKind: 'group', targetId: chatId, method: 'editMessageReplyMarkup',
        payload: { chat_id: chatId, message_id: q.message.message_id, reply_markup: markup, _automation: true, _binding: group.id, _funnel: true } });
    if (action === 'rej') {
        await edit({ inline_keyboard: [[{ text: 'Narx', callback_data: `m:${tid}:r:price` }, { text: 'Vaqt', callback_data: `m:${tid}:r:time` }],
            [{ text: 'O‘ylab ko‘radi', callback_data: `m:${tid}:r:think` }, { text: 'Qiziqmaydi', callback_data: `m:${tid}:r:no` }]] });
        return ack('Sababni tanlang');
    }
    const name = clean(staff.name).split(' ')[0] || 'Menejer';
    await patch(db, tid, { outcome: action.replace(':', '_'), outcome_at: new Date() });
    if (v.lead_id) await leadComment(db, v.lead_id, `🤖 ${clean(staff.name)}: ${OUTCOMES[action]}`);
    await edit({ inline_keyboard: [[{ text: `${OUTCOMES[action]} — ${name}`, callback_data: `m:${tid}:done` }]] });
    if (action === 'na') {
        // Lidga bir kunda bir marta: "qo'ng'iroq qildik, qachon qulay?"
        const day = new Date().toISOString().slice(0, 10);
        await store.enqueue(db, { key: `noans:${tid}:${day}`, targetId: tid,
            payload: { chat_id: tid, text: copy.drip.noAnswer(name), reply_markup: inline([[[copy.WHEN.eve, 'f:w:eve'], [copy.WHEN.morn, 'f:w:morn']], [[copy.text.ctaTelegram, 'f:tg']]]),
                _guest: { tid }, _automation: true } });
        await patch(db, tid, { noans_at: new Date(), ...(v.request?.method ? {} : { request: { method: 'call' } }) });
    }
    await event(db, tid, 'outcome', { action, by: staff.id });
    return ack('Saqlandi');
}

// ── Isitish (scheduler har 30 soniyada chaqiradi) ──
const DAY = 86400000;
function preItems(v, t) {
    // [kalit, kun, quruvchi]
    return [
        ['d1', 1, s => !v.lesson_parts && media(s, 'dars1') ? { text: copy.drip.lessonNudge(v.first_name.split(' ')[0] || 'Assalomu alaykum'), btn: [[copy.text.lessonWatch, 'f:les']] }
            : { text: copy.drip.phrases(t === 'A' ? 'smena' : 'meeting'), btn: [[copy.KEYBOARD.contact, 'f:cta']] }],
        ['d2', 2, s => ({ text: copy.drip.testimonial(s.funnelTestimonials?.[t]), btn: [[copy.KEYBOARD.contact, 'f:cta']] })],
        ['d3', 3, s => s.bonusChannel && media(s, 'bonus') && !v.bonus_at
            ? { text: copy.drip.bonus(s.bonusChannel), btn: [[copy.drip.bonusJoin, 'https://t.me/' + s.bonusChannel.slice(1)], [copy.drip.bonusCheck, 'f:bonus']] }
            : { text: copy.drip.poll, btn: Object.entries(copy.POLL).map(([k, [label]]) => [label, 'f:poll:' + k]) }],
        ['d4', 4, s => s.bonusChannel && media(s, 'bonus') && !v.bonus_at ? { text: copy.drip.poll, btn: Object.entries(copy.POLL).map(([k, [label]]) => [label, 'f:poll:' + k]) } : null],
        ['d5', 5, s => ({ text: copy.drip.lessonHow, media: media(s, 'promo1'), btn: [[copy.KEYBOARD.contact, 'f:cta']] })],
        ['d6', 6, s => ({ text: t === 'A' ? copy.drip.whereA : copy.drip.whereB, media: media(s, t === 'A' ? 'promo3' : 'promo2'), btn: [[copy.KEYBOARD.contact, 'f:cta']] })],
        ['d8', 8, s => discountItem(v, s)],
        ['d10', 10, () => ({ text: copy.drip.goodbye })]
    ];
}
function postItems(v, t) {
    const r = v.outcome;
    if (r === 'r_price') return [['p1', 1, () => ({ text: t === 'A' ? copy.drip.priceA : copy.drip.priceB, btn: [[copy.KEYBOARD.contact, 'f:cta']] })],
        ['p4', 4, s => ({ text: copy.drip.testimonial(s.funnelTestimonials?.[t]), btn: [[copy.KEYBOARD.contact, 'f:cta']] })], ['p8', 8, s => discountItem(v, s)]];
    if (r === 'r_time') return [['p1', 1, () => ({ text: copy.drip.timePlan, btn: [[copy.KEYBOARD.contact, 'f:cta']] })],
        ['p4', 4, () => ({ text: copy.drip.timeEvening, btn: [[copy.KEYBOARD.contact, 'f:cta']] })], ['p8', 8, s => discountItem(v, s)]];
    if (r === 'r_think') return [['p2', 2, s => ({ text: copy.drip.testimonial(s.funnelTestimonials?.[t]), btn: [[copy.KEYBOARD.contact, 'f:cta']] })],
        ['p5', 5, () => ({ text: copy.drip.think, btn: [[copy.KEYBOARD.faq, 'f:faqlist'], [copy.KEYBOARD.contact, 'f:cta']] })], ['p8', 8, s => discountItem(v, s)]];
    return [];
}
function discountItem(v, s) {
    const percent = Number.isInteger(s.discountPercent) && s.discountPercent > 0 ? s.discountPercent : 0;
    if (!percent || !v.discount_until || new Date(v.discount_until) <= new Date()) return null;
    const until = new Date(v.discount_until).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return { text: copy.drip.discount(percent, until), btn: [[copy.text.ctaCall, 'f:call'], [copy.text.ctaTelegram, 'f:tg']] };
}
// Keyingi yuboriladigan element yoki null.
function nextItem(v, s, now) {
    if (v.drip_stopped || v.paused || v.blocked_at || v.holdout) return null;
    const sent = new Set(Array.isArray(v.drip_sent) ? v.drip_sent : []), t = track(v);
    const gap = v.ignored >= 6 ? 7 * DAY : v.ignored >= 3 ? 3 * DAY : 20 * 3600000;
    if (v.drip_last_at && now - new Date(v.drip_last_at) < gap) return null;
    const pick = (items, base) => {
        const day = Math.floor((now - new Date(base)) / DAY);
        for (const [key, d, build] of items) {
            if (sent.has(key) || d > day) continue;
            const item = build(s);
            if (item?.need && !media(s, item.need)) continue;
            return item ? { key, ...item } : { key, skip: true };
        }
        return null;
    };
    if (v.outcome?.startsWith('r_')) {
        if (v.outcome === 'r_no') return monthly(v, sent, now);
        return pick(postItems(v, t), v.outcome_at);
    }
    if (v.outcome || v.requested_at) return null; // menejer ishlayapti
    const pre = pick(preItems(v, t), v.created_at);
    if (pre) return pre;
    if (!sent.has('d10')) return null;
    return weekly(v, sent, now);
}
function weekly(v, sent, now) {
    if (now - new Date(v.created_at) > 90 * DAY) return v.monthly ? monthly(v, sent, now) : null;
    const done = [...sent].filter(k => /^w\d+$/.test(k)).length;
    if (now - new Date(v.drip_last_at || 0) < 7 * DAY) return null;
    if (done < copy.WEEKLY.length) return { key: 'w' + done, text: copy.drip.weekly(copy.WEEKLY[done]), btn: [[copy.KEYBOARD.contact, 'f:cta']] };
    if (!sent.has('react') && now - new Date(v.created_at) <= 62 * DAY) return { key: 'react', text: copy.drip.reactivate, btn: [[copy.drip.reactYes, 'f:react:yes'], [copy.drip.reactNo, 'f:react:no']] };
    return v.monthly ? monthly(v, sent, now) : null;
}
function monthly(v, sent, now) {
    // Oxirgi xabar yoki menejer qarori — qaysi biri keyin bo'lsa, o'shandan 28 kun.
    const base = Math.max(new Date(v.drip_last_at || 0).getTime(), v.outcome === 'r_no' ? new Date(v.outcome_at || 0).getTime() : 0);
    if (now - new Date(v.created_at) > 180 * DAY || now - base < 28 * DAY) return null;
    const done = [...sent].filter(k => /^m\d+$/.test(k)).length;
    if (done >= copy.MONTHLY.length) return null;
    return { key: 'm' + done, text: copy.drip.weekly(copy.MONTHLY[done]), btn: [[copy.KEYBOARD.contact, 'f:cta']] };
}
// Yuborish oynasi (Toshkent): O'zbekiston 19:30–20:30, migrantlar 20:30–21:30 (Moskvada 18:30–19:30).
function inWindow(t, now) { const m = clock(now); return t === 'A' ? m >= 1230 && m < 1290 : m >= 1170 && m < 1230; }
// Oyna tugagach yetkazilmagan isitish xabari bekor bo'ladi (kechasi ketmasin).
function windowEnd(t, now) { const m = clock(now), end = t === 'A' ? 1290 : 1230; return new Date(now.getTime() + Math.max(0, end - m) * 60000).toISOString(); }
async function drip(db, now = new Date()) {
    const s = await settings(db);
    if (s.funnelEnabled !== true || s.dripEnabled !== true) return 0;
    const m = clock(now); if (m < 1170 || m >= 1290) return 0;
    // Faqat isitish yoqilgandan keyin kelganlar (eski baza birdaniga xabar olmaydi), 90 kundan yosh.
    // Menejer ishlayotganlar (so'rov/qaror, rad sababidan tashqari) va lidi ishlanayotgan/sotilganlar chiqariladi.
    // Ko'rib chiqilgan har qator drip_checked_at oladi — navbat "tiqilib" qolmaydi.
    const started = s.dripStartedAt ? new Date(s.dripStartedAt) : now;
    const rows = (await db.query(`SELECT v.* FROM domwork_bot_visitors v WHERE NOT v.paused AND v.blocked_at IS NULL AND NOT v.holdout AND NOT v.drip_stopped
        AND v.created_at>=$2 AND v.created_at>$1::timestamptz-INTERVAL '180 days' AND v.created_at<$1::timestamptz-INTERVAL '24 hours'
        AND (v.drip_last_at IS NULL OR v.drip_last_at<$1::timestamptz-INTERVAL '20 hours')
        AND (v.drip_checked_at IS NULL OR v.drip_checked_at<$1::timestamptz-INTERVAL '50 minutes')
        AND ((v.requested_at IS NULL AND v.outcome IS NULL) OR v.outcome LIKE 'r\\_%')
        AND (CASE WHEN v.segment IN ('russia','abroad') OR (v.segment IS NULL AND v.phone LIKE '7%') THEN $3::boolean ELSE $4::boolean END)
        AND (v.lead_id IS NULL OR EXISTS (SELECT 1 FROM leads l WHERE l.id=v.lead_id AND l.deleted_at IS NULL
            AND (CASE WHEN v.outcome IS NULL THEN COALESCE(l.status,'') IN ('','new','yangi-lidlar') ELSE COALESCE(l.status,'') NOT IN ('sinov-darsida','tolov-jarayonida','tolov-yopildi') END)))
        ORDER BY v.drip_checked_at NULLS FIRST LIMIT 40 FOR UPDATE OF v SKIP LOCKED`, [now, started, inWindow('A', now), inWindow('B', now)])).rows;
    let n = 0;
    for (const v of rows) {
        await patch(db, v.telegram_id, { drip_checked_at: now });
        const identity = await store.identity(db, v.telegram_id);
        if (identity) { await patch(db, v.telegram_id, { drip_stopped: true }); continue; } // o'quvchi/xodim bo'lib qolgan
        const item = nextItem(v, s, now);
        if (!item) continue;
        const sent = [...(Array.isArray(v.drip_sent) ? v.drip_sent : []), item.key];
        if (item.skip) { await patch(db, v.telegram_id, { drip_sent: sent }); continue; }
        const c = { db, tid: v.telegram_id, key: () => `drip:${v.telegram_id}:${item.key}:${n}` };
        const markup = item.btn ? inline(item.btn.map(b => [b])) : undefined;
        const guard = { automation: true, unless: v.outcome ? '' : 'request', key: `drip:${v.telegram_id}:${item.key}`, expires: windowEnd(track(v), now) };
        if (item.media && item.text.length <= 1000) await sendMedia(c, item.media, item.text, markup, guard);
        else await say(c, item.text, markup, guard);
        await patch(db, v.telegram_id, { drip_sent: sent, drip_last_at: now, ignored: v.ignored + 1 });
        await event(db, v.telegram_id, 'drip', { item: item.key });
        n++;
    }
    return n;
}

module.exports = { bundledFile, BUNDLED_NAMES, bonus, relayFromGroup, managerAction, drip, nextItem, SCHEMA, MEDIA_KEYS, init, enabled, start, message, contact, callback, deliverable, adminMedia, pause, blocked, report, track, mask, inHours };
