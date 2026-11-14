'use strict';
// 14-noy: ishdan bo'shatilgan xodimni bot admin bo'lgan BARCHA guruh/kanallardan avtomatik chiqarish.
//  • HRda offboarded_at qo'yilgan (yoki status='inactive') xodim → botga ulangan Telegram profili topiladi.
//  • Bot biladigan har bir chat (bo'lim guruhlari, sinov/dars guruhlari, bot ko'rgan boshqa guruhlar, bonus kanal):
//    a'zo bo'lsa — banChatMember (havola bilan qaytib kira olmaydi); chat admini bo'lsa — chiqarib bo'lmaydi, hisobotda.
//  • «Bot X ni chiqardi» xizmat xabari handlers.js orqali qayd etiladi va shu yerda o'chiriladi.
//  • Ogohlantirish: har doim admin; sotuv bo'limi → +ROP; ustoz/yordamchi ustoz → +akademik rahbar.
//  • Xodim qayta faollashtirilsa — blok olinadi (unban), guruhlarga havola orqali qayta qo'shilishi mumkin.
//  • Birinchi ishga tushganda va har dushanba adminga: bot qaysi chatlarda admin, qayerda emas.
const T = require('./tone');

const SALES = ['sotuv-menejeri', 'sotuv_menejeri', 'sotuv menejeri', 'sales_manager', 'rop', 'targetolog'];
const TEACH = ['oqituvchi', 'rus-oqituvchi', 'ingliz-oqituvchi', 'yordamchi', 'teacher'];
const SCHEMA = `
CREATE TABLE IF NOT EXISTS domwork_bot_offboard (employee_id TEXT PRIMARY KEY, telegram_id TEXT NOT NULL DEFAULT '',
 state TEXT NOT NULL DEFAULT 'done', result JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS domwork_bot_offboard_kicks (chat_id TEXT NOT NULL, telegram_id TEXT NOT NULL, employee_id TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(chat_id,telegram_id));
CREATE TABLE IF NOT EXISTS domwork_bot_kick_notices (chat_id TEXT NOT NULL, message_id BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(chat_id,message_id));`;
let ready = false;
async function init(db) { if (!ready) { await db.query(SCHEMA); ready = true; } }

// handlers.js chaqiradi: guruhdagi «chiqarildi» xizmat xabari bizning chiqarishimiz bo'lsa — o'chirish navbatiga.
async function notice(db, message) {
    const left = message?.left_chat_member;
    if (!left) return false;
    await init(db);
    const hit = (await db.query('SELECT 1 FROM domwork_bot_offboard_kicks WHERE chat_id=$1 AND telegram_id=$2',
        [String(message.chat.id), String(left.id)])).rows.length;
    if (hit) await db.query('INSERT INTO domwork_bot_kick_notices(chat_id,message_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [String(message.chat.id), message.message_id]);
    return !!hit;
}

async function telegramOf(db, employeeId) {
    const rows = (await db.query(`SELECT DISTINCT l.telegram_id FROM domwork_bot_links l JOIN users u ON u.id=l.account_id
        LEFT JOIN user_sales_manager_links m ON m.user_id=u.id
        JOIN hr_employees h ON (u.role='sales_manager' AND m.manager_id IS NOT NULL AND h.id=m.manager_id)
        OR ((u.role<>'sales_manager' OR m.manager_id IS NULL) AND LOWER(TRIM(h.login))=LOWER(TRIM(u.email)))
        WHERE l.account_kind='user' AND h.id=$1`, [employeeId])).rows;
    return rows.map(r => r.telegram_id);
}
// Bot biladigan barcha chatlar (takrorsiz).
async function chats(db) {
    const rows = (await db.query(`SELECT chat_id, title FROM domwork_bot_seen_chats
        UNION SELECT chat_id, '' FROM domwork_bot_groups WHERE chat_id<>''
        UNION SELECT chat_id, name FROM domwork_learning_groups WHERE chat_id<>'' AND NOT archived`)).rows;
    const map = new Map();
    for (const r of rows) if (/^-?\d+$/.test(r.chat_id) && (!map.has(r.chat_id) || r.title)) map.set(r.chat_id, r.title || map.get(r.chat_id) || '');
    const s = (await db.query('SELECT data FROM domwork_bot_settings WHERE singleton=1')).rows[0]?.data || {};
    if (/^@\w{4,}$/.test(s.bonusChannel || '')) map.set(s.bonusChannel, s.bonusChannel);
    return [...map].map(([id, title]) => ({ id, title }));
}
async function title(call, c) {
    if (c.title && !c.title.startsWith('@')) return c.title;
    try { const ch = await call('getChat', { chat_id: c.id }); return ch.title || c.title || c.id; } catch { return c.title || c.id; }
}
async function rolesTo(db, list) {
    return require('./scheduler').roles(db, list);
}
async function tell(db, key, people, text) {
    const events = require('./events');
    const seen = new Set();
    for (const p of people) if (!seen.has(p.telegramId)) { seen.add(p.telegramId);
        await events.privateMessage(db, key + ':' + p.telegramId, p, text, { ...T.HTML, _expiresAt: new Date(Date.now() + 24 * 3600000).toISOString() }); }
}

async function offboardOne(db, call, botId, emp) {
    const tids = await telegramOf(db, emp.id);
    await db.query(`INSERT INTO domwork_bot_offboard(employee_id,telegram_id,state) VALUES($1,$2,'working') ON CONFLICT(employee_id) DO NOTHING`, [emp.id, tids.join(',')]);
    const removed = [], admin = [], failed = [];
    if (tids.length) for (const c of await chats(db)) {
        let bot; try { bot = await call('getChatMember', { chat_id: c.id, user_id: botId }); } catch { continue; }
        for (const tid of tids) {
            let m; try { m = await call('getChatMember', { chat_id: c.id, user_id: Number(tid) }); } catch { continue; }
            if (!['member', 'restricted', 'administrator', 'creator'].includes(m.status)) continue;
            const name = await title(call, c);
            if (['administrator', 'creator'].includes(m.status)) { admin.push(name); continue; }
            if (bot.status !== 'administrator' || bot.can_restrict_members === false) { failed.push(name + ' (botda chiqarish huquqi yo‘q)'); continue; }
            await db.query('INSERT INTO domwork_bot_offboard_kicks(chat_id,telegram_id,employee_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [c.id, tid, emp.id]);
            try { await call('banChatMember', { chat_id: c.id, user_id: Number(tid), revoke_messages: false }); removed.push(name); }
            catch (e) { failed.push(name); }
        }
    }
    const result = { removed, admin, failed, telegram: tids.length > 0 };
    await db.query(`UPDATE domwork_bot_offboard SET state='done',result=$2 WHERE employee_id=$1`, [emp.id, JSON.stringify(result)]);
    const role = String(emp.role || '').toLowerCase();
    const dept = SALES.includes(role) ? 'sales' : TEACH.includes(role) ? 'teach' : 'other';
    const to = await rolesTo(db, ['admin', ...(dept === 'sales' ? ['rop'] : dept === 'teach' ? ['akademik'] : [])]);
    const lines = [`🚪 <b>Xodim guruhlardan chiqarildi</b>`, `👤 ${T.b(emp.name)}${emp.role ? ' · ' + T.esc(emp.role) : ''}`, ''];
    if (!tids.length) lines.push('⚠️ Bu xodim botga ulanmagan (start bosmagan) — Telegram profili noma’lum. Guruhlardan qo‘lda chiqaring.');
    else {
        lines.push(removed.length ? `✅ Chiqarildi (${removed.length}):\n${removed.map(n => '• ' + T.esc(n)).join('\n')}` : '✅ Bot admin bo‘lgan guruhlarning hech birida a’zo emas edi.');
        if (admin.length) lines.push('', `⚠️ U yerda <b>admin</b> — bot chiqara olmaydi, qo‘lda chiqaring:\n${admin.map(n => '• ' + T.esc(n)).join('\n')}`);
        if (failed.length) lines.push('', `❌ Chiqarib bo‘lmadi:\n${failed.map(n => '• ' + T.esc(n)).join('\n')}`);
        lines.push('', T.i('Bot admin bo‘lmagan guruhlarni bot ko‘rmaydi — ular bo‘lsa, qo‘lda tekshiring.'));
    }
    await tell(db, 'offboard:' + emp.id, to, lines.join('\n'));
}

// Qayta ishga olingan xodim — blokni olib tashlash.
async function restore(db, call) {
    const rows = (await db.query(`SELECT k.chat_id,k.telegram_id,k.employee_id FROM domwork_bot_offboard_kicks k JOIN hr_employees h ON h.id=k.employee_id
        WHERE h.offboarded_at IS NULL AND COALESCE(LOWER(h.status),'active')<>'inactive' LIMIT 20`)).rows;
    for (const r of rows) {
        try { await call('unbanChatMember', { chat_id: r.chat_id, user_id: Number(r.telegram_id), only_if_banned: true }); } catch {}
        await db.query('DELETE FROM domwork_bot_offboard_kicks WHERE chat_id=$1 AND telegram_id=$2', [r.chat_id, r.telegram_id]);
        await db.query('DELETE FROM domwork_bot_offboard WHERE employee_id=$1', [r.employee_id]);
    }
}

// Bot holati: qaysi chatlarda admin, qaysi huquqlar yo'q.
async function auditText(db, call, botId) {
    const ok = [], weak = [], no = [];
    for (const c of await chats(db)) {
        let m; try { m = await call('getChatMember', { chat_id: c.id, user_id: botId }); } catch { no.push(`${T.esc(c.title || c.id)} — bot chiqarilgan yoki chat yo‘q`); continue; }
        const name = T.esc(await title(call, c));
        if (m.status !== 'administrator') { no.push(`${name} — ${m.status === 'member' ? 'oddiy a’zo' : 'bot guruhda emas'}`); continue; }
        const miss = [m.can_restrict_members === false ? 'a’zolarni chiqarish' : '', m.can_delete_messages === false ? 'xabarlarni o‘chirish' : ''].filter(Boolean);
        (miss.length ? weak : ok).push(miss.length ? `${name} — yo‘q huquq: ${miss.join(', ')}` : name);
    }
    return [`🤖 <b>Bot qaysi guruh va kanallarda admin</b>`, '',
        `✅ <b>Admin, hamma huquq bor (${ok.length})</b>`, ...ok.map(n => '• ' + n), '',
        ...(weak.length ? [`🟡 <b>Admin, lekin huquq yetishmaydi (${weak.length})</b>`, ...weak.map(n => '• ' + n), ''] : []),
        ...(no.length ? [`❌ <b>Admin emas (${no.length})</b>`, ...no.map(n => '• ' + n), ''] : []),
        T.i('Xodimni avtomatik chiqarish uchun botga «A’zolarni bloklash» va «Xabarlarni o‘chirish» huquqi kerak.')].join('\n');
}

async function processOne(pool, call, botId) {
    const queue = require('./queue');
    await queue.transaction(pool, async db => {
        await init(db);
        // 1) «chiqarildi» xizmat xabarlarini o'chirish
        for (const n of (await db.query('SELECT chat_id,message_id FROM domwork_bot_kick_notices LIMIT 20')).rows) {
            try { await call('deleteMessage', { chat_id: n.chat_id, message_id: Number(n.message_id) }); } catch {}
            await db.query('DELETE FROM domwork_bot_kick_notices WHERE chat_id=$1 AND message_id=$2', [n.chat_id, n.message_id]);
        }
        // 2) yangi bo'shatilganlar (bot ishga tushgandan keyin bo'shatilganlar; eski arxiv qayta ishlanmaydi)
        await db.query(`INSERT INTO domwork_bot_offboard(employee_id,state) SELECT id,'skipped' FROM hr_employees
            WHERE (offboarded_at IS NOT NULL OR LOWER(COALESCE(status,''))='inactive') AND NOT EXISTS(SELECT 1 FROM domwork_bot_offboard)
            ON CONFLICT DO NOTHING`);
        const emp = (await db.query(`SELECT h.id,h.name,h.role FROM hr_employees h WHERE (h.offboarded_at IS NOT NULL OR LOWER(COALESCE(h.status,''))='inactive')
            AND NOT EXISTS(SELECT 1 FROM domwork_bot_offboard o WHERE o.employee_id=h.id) ORDER BY h.offboarded_at NULLS LAST LIMIT 1`)).rows[0];
        if (emp) await offboardOne(db, call, botId, emp);
        await restore(db, call);
        // 3) holat hisoboti adminga: birinchi ishga tushganda darhol, keyin har dushanba 10:00 dan keyin
        const clock = require('./scheduler').localClock(new Date());
        const first = !(await db.query("SELECT 1 FROM domwork_bot_jobs WHERE key LIKE 'bot-admin-audit:%' LIMIT 1")).rows.length;
        if (first || (clock.day === 1 && clock.hour >= 10)) await require('./scheduler').once(db, 'bot-admin-audit:' + clock.date, async () =>
            tell(db, 'bot-admin-audit:' + clock.date, await rolesTo(db, ['admin']), await auditText(db, call, botId)));
    });
}
module.exports = { init, notice, processOne, auditText };
