'use strict';
// Botni xodimlar uchun "qayta ishga tushirish" (majburiy faollashtirish).
// Admin "Qayta ishga tushirish"ni bosganda:
//   • ulangan har bir xodimga rolga mos xush kelibsiz xabari + yangi menyu + "✅ Tayyorman" tugmasi yuboriladi;
//   • CRM/ustoz ilovasida mos xodimlarga yopilmaydigan oyna chiqadi: ulanmagan — botni ulaydi,
//     ulangan — botda "✅ Tayyorman"ni bosadi. Shundan keyingina oyna yopiladi.
// Bot yo'naltirilmagan xodimlar (rus tili bo'limidan tashqari) oynani ko'rmaydi; bot tayyor bo'lmasa oyna chiqmaydi.
const policy = require('./policy');
const queue = require('./queue');
const SCHEMA = `
CREATE TABLE IF NOT EXISTS domwork_staff_activation (
 user_id TEXT NOT NULL, campaign INTEGER NOT NULL, telegram_id TEXT,
 sent_at TIMESTAMPTZ, acknowledged_at TIMESTAMPTZ, PRIMARY KEY(user_id,campaign)
);`;
const CALLBACK = 'a:ok';
async function init(db) { await db.query(SCHEMA); }
const ROLE_LABEL = { admin: 'administrator', rop: 'ROP', sales: 'sotuv menejeri', marketing: 'marketing', teacher: 'ustoz', assistant: 'yordamchi ustoz' };

async function campaign(db) {
    const data = (await require('./store').settings(db))?.data || {};
    const c = data.staffActivation || {};
    return { required: c.required === true, id: Number.isInteger(c.campaign) ? c.campaign : 0, startedAt: c.startedAt || null, notify: data.staffNotifyEnabled === true };
}
// Ulanish haqiqatan ishlaydimi: link bor VA bot uni shu xodim sifatida taniydi (eskirgan/buzilgan ulanish = ulanmagan).
async function liveLink(db, userId) {
    const store = require('./store');
    const link = (await db.query("SELECT telegram_id FROM domwork_bot_links WHERE account_kind='user' AND account_id=$1", [userId])).rows[0];
    if (!link) return null;
    const identity = await store.identity(db, link.telegram_id);
    return identity?.kind === 'user' && identity.id === userId ? { telegramId: link.telegram_id, identity } : null;
}
async function acknowledged(db, userId, c) {
    if ((await db.query('SELECT 1 FROM domwork_staff_activation WHERE user_id=$1 AND campaign=$2 AND acknowledged_at IS NOT NULL', [userId, c.id])).rows.length) return true;
    // Qayta ishga tushirishdan keyin CRMda o'zi ulagan (Start + tasdiq) xodim allaqachon faol.
    if (!c.startedAt) return false;
    return (await db.query('SELECT 1 FROM domwork_staff_telegram_proofs WHERE user_id=$1 AND verified_at>=$2', [userId, c.startedAt])).rows.length > 0;
}
function welcomeText(identity, c) {
    const items = policy.menu(identity).map(([, label]) => '• ' + label).join('\n');
    return `Assalomu alaykum, ${String(identity.name || '').slice(0, 80)}! 👋\n\n`
        + 'Domwork Yordamchisi yangilandi va endi to‘liq ishga tushdi.\n\n'
        + `Siz uchun (${ROLE_LABEL[identity.role] || identity.role}) pastdagi menyuda:\n${items}\n\n`
        + (c.notify ? '🔔 CRMdagi muhim bildirishnomalar ham endi shu yerga keladi — CRMni ochmasdan ko‘rasiz.\n\n' : '')
        + 'Menyu yangilandi — istalgan tugmani bosib sinab ko‘ring.';
}
const okMarkup = () => ({ inline_keyboard: [[{ text: '✅ Tayyorman', callback_data: CALLBACK }]] });
const OK_TEXT = 'Bot ishlayotganini tasdiqlash uchun pastdagi tugmani bosing 👇\nShundan keyin CRMdagi oyna yopiladi.';
async function send(db, userId, link, c, suffix) {
    const store = require('./store'), { keyboard } = require('./handlers');
    const base = { targetId: link.telegramId, role: link.identity.role, account: link.identity };
    await store.enqueue(db, { ...base, key: `activate:${c.id}:${userId}:${suffix}:w`,
        payload: { chat_id: link.telegramId, text: welcomeText(link.identity, c), reply_markup: keyboard(link.identity) } });
    await store.enqueue(db, { ...base, key: `activate:${c.id}:${userId}:${suffix}:ok`,
        payload: { chat_id: link.telegramId, text: OK_TEXT, reply_markup: okMarkup() } });
    await db.query(`INSERT INTO domwork_staff_activation(user_id,campaign,telegram_id,sent_at) VALUES($1,$2,$3,NOW())
        ON CONFLICT(user_id,campaign) DO UPDATE SET telegram_id=EXCLUDED.telegram_id,sent_at=NOW()`, [userId, c.id, link.telegramId]);
}

// Xodimning o'z holati (CRM oynasi uchun). Mos bo'lmagan xodim → required:false.
async function status(pool, actor, botReady) {
    return queue.transaction(pool, async db => {
        const c = await campaign(db);
        if (!c.required || !botReady) return { required: false };
        let me;
        try { me = await require('./staffLink').owner(db, actor); }
        catch (error) { if (error.status === 403 || error.status === 409) return { required: false }; throw error; }
        const link = await liveLink(db, me.id);
        const done = !!link && await acknowledged(db, me.id, c);
        return { required: !done, linked: !!link, acknowledged: done, admin: me.role === 'admin', name: me.name || '' };
    });
}
// Xodim CRMdan "Xabarni qayta yuborish" — Telegramda xabar topilmasa (bot bloklangan, o'chirilgan va h.k.).
async function resend(pool, actor) {
    return queue.transaction(pool, async db => {
        const c = await campaign(db);
        if (!c.required) throw policy.error(409, 'Faollashtirish hozir talab qilinmaydi');
        const me = await require('./staffLink').owner(db, actor);
        const link = await liveLink(db, me.id);
        if (!link) throw policy.error(409, 'Avval Telegramni ulang');
        const last = (await db.query('SELECT sent_at>NOW()-INTERVAL \'30 seconds\' AS fast FROM domwork_staff_activation WHERE user_id=$1 AND campaign=$2', [me.id, c.id])).rows[0];
        if (last?.fast) throw policy.error(429, 'Xabar yuborildi. Telegramni tekshiring');
        // Xodimning o'zi so'radi — /stop bilan to'xtatilgan bo'lsa ham qayta yoqiladi.
        await db.query('UPDATE domwork_bot_links SET paused=false WHERE telegram_id=$1', [link.telegramId]);
        await send(db, me.id, link, c, 'r' + Date.now());
        return { ok: true };
    });
}
// Admin: yangi kampaniya — hamma ulangan xodimlarga xabar + majburiy rejim yoqiladi.
async function relaunch(pool, actor) {
    return queue.transaction(pool, async db => {
        const store = require('./store');
        await store.currentAdmin(db, actor);
        const before = (await db.query('SELECT data FROM domwork_bot_settings WHERE singleton=1 FOR UPDATE')).rows[0].data || {};
        const prev = before.staffActivation || {};
        const next = { required: true, campaign: (Number.isInteger(prev.campaign) ? prev.campaign : 0) + 1, startedAt: new Date().toISOString() };
        await db.query("UPDATE domwork_bot_settings SET data=data||jsonb_build_object('staffActivation',$1::jsonb),revision=revision+1 WHERE singleton=1", [JSON.stringify(next)]);
        const c = await campaign(db);
        const users = (await db.query("SELECT DISTINCT account_id FROM domwork_bot_links WHERE account_kind='user' ORDER BY account_id")).rows;
        let sent = 0;
        for (const { account_id: userId } of users) {
            const link = await liveLink(db, userId);
            if (!link) continue;
            await send(db, userId, link, c, 'w'); sent++;
        }
        await store.audit(db, actor.id, 'staff-activation-relaunch', 'domwork', { campaign: next.campaign, sent });
        return { ok: true, campaign: next.campaign, sent };
    });
}
async function stop(pool, actor) {
    return queue.transaction(pool, async db => {
        const store = require('./store');
        await store.currentAdmin(db, actor);
        await db.query(`UPDATE domwork_bot_settings SET data=jsonb_set(data,'{staffActivation,required}','false'::jsonb),revision=revision+1
            WHERE singleton=1 AND data ? 'staffActivation'`);
        await store.audit(db, actor.id, 'staff-activation-stop', 'domwork', {});
        return { ok: true };
    });
}
// Admin ro'yxati: mos xodimlar va ularning holati.
async function report(pool) {
    return queue.transaction(pool, async db => {
        const store = require('./store');
        const c = await campaign(db);
        const rows = (await db.query(store.USER_SQL + ' WHERE u.disabled_at IS NULL ORDER BY u.name')).rows;
        const seen = new Set(), people = [];
        for (const row of rows) {
            if (seen.has(row.id)) continue; seen.add(row.id);
            const me = store.staff(row, policy.phone(row.phone));
            if (!me) continue;
            const link = await liveLink(db, me.id);
            const done = !!link && await acknowledged(db, me.id, c);
            people.push({ id: me.id, name: me.name, role: me.role, linked: !!link, acknowledged: done });
        }
        return { required: c.required, campaign: c.id, startedAt: c.startedAt, people };
    });
}
// Botdagi "✅ Tayyorman".
async function callback(db, update) {
    const store = require('./store');
    const query = update.callback_query, sender = policy.telegramId(query?.from?.id);
    if (!sender || query.data !== CALLBACK) return;
    const answer = text => store.enqueue(db, { key: `u:${update.update_id}:callback`, targetId: sender, method: 'answerCallbackQuery',
        payload: { callback_query_id: query.id, text, show_alert: false } });
    const chat = query.message?.chat;
    const identity = await store.identity(db, sender);
    if (!identity || identity.kind !== 'user' || chat?.type !== 'private' || String(chat.id) !== sender) return answer('Akkaunt topilmadi. /start bosing');
    const c = await campaign(db);
    await db.query(`INSERT INTO domwork_staff_activation(user_id,campaign,telegram_id,acknowledged_at) VALUES($1,$2,$3,NOW())
        ON CONFLICT(user_id,campaign) DO UPDATE SET acknowledged_at=COALESCE(domwork_staff_activation.acknowledged_at,NOW()),telegram_id=EXCLUDED.telegram_id`,
        [identity.id, c.id, sender]);
    await answer('Rahmat! ✅');
    const base = { targetId: sender, role: identity.role, account: identity };
    if (query.message?.message_id) await store.enqueue(db, { ...base, key: `u:${update.update_id}:a-edit`, method: 'editMessageReplyMarkup',
        payload: { chat_id: sender, message_id: query.message.message_id, reply_markup: { inline_keyboard: [] } } });
    await store.enqueue(db, { ...base, key: `activate:${c.id}:${identity.id}:done`,
        payload: { chat_id: sender, text: '✅ Tasdiqlandi! CRMdagi oyna yopildi — ishda davom etavering. Menyu doim pastda.', reply_markup: require('./handlers').keyboard(identity) } });
}
// /start bosilganda: kampaniya faol va hali tasdiqlanmagan bo'lsa "Tayyorman" tugmasini qayta beradi.
async function onStart(db, update, identity) {
    if (identity?.kind !== 'user') return;
    const c = await campaign(db);
    if (!c.required || await acknowledged(db, identity.id, c)) return;
    await require('./store').enqueue(db, { key: `u:${update.update_id}:activate`, targetId: identity.telegramId || String(update.message.chat.id),
        role: identity.role, account: identity, payload: { chat_id: String(update.message.chat.id), text: OK_TEXT, reply_markup: okMarkup() } });
}
module.exports = { SCHEMA, CALLBACK, init, status, resend, relaunch, stop, report, callback, onStart, welcomeText };
