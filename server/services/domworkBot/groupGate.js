'use strict';
// 14-noy: yangi o'quvchi guruhi «darvozasi». Lid to'lovga o'tib, 5-qadamda Telegram guruh havolasi va nomi kiritilgach,
// bot shu NOM bo'yicha guruhni topadi va tekshiradi:
//  • bot guruhda to'liq admin (anonim emas, asosiy huquqlar bor);
//  • rahbar (admin), akademik rahbar va tanlangan yordamchi ustoz guruhda — oddiy a'zo bo'lsa bot ularni o'zi admin qiladi.
// Hammasi tayyor bo'lmaguncha shu lidning sotuv menejeri va ROP kabineti qulflanadi (js/groupGate.js).
// Faqat ishga tushgandan KEYIN havolasi kiritilgan guruhlarga amal qiladi: avvalgilari 'legacy' deb belgilanadi.
// Admin sabab yozib qulfni ochishi mumkin ('override').
const store = require('./store');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS domwork_group_gate (
 lead_id TEXT PRIMARY KEY, manager_id TEXT NOT NULL DEFAULT '', lead_name TEXT NOT NULL DEFAULT '',
 group_name TEXT NOT NULL DEFAULT '', group_link TEXT NOT NULL DEFAULT '', assistant_id TEXT NOT NULL DEFAULT '',
 chat_id TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT 'pending', items JSONB NOT NULL DEFAULT '[]',
 checked_at TIMESTAMPTZ, ready_at TIMESTAMPTZ, override_by TEXT NOT NULL DEFAULT '', override_reason TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`;
let ready = false;
async function init(db) { if (!ready) { await db.query(SCHEMA); ready = true; } }

const PAID = ['tolov-jarayonida', 'tolov-yopildi'];
const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
// Botga kerakli huquqlar (to'liq admin, anonim emas).
const BOT_RIGHTS = [['can_restrict_members', 'a’zolarni bloklash'], ['can_delete_messages', 'xabarlarni o‘chirish'],
    ['can_promote_members', 'admin tayinlash'], ['can_invite_users', 'taklif havolasi'], ['can_pin_messages', 'xabar qadash'], ['can_change_info', 'guruh ma’lumotini o‘zgartirish']];

// Yangi lidlarni navbatga olish. Birinchi ishga tushganda mavjud hammasi — 'legacy' (qulflanmaydi).
async function enroll(db) {
    const first = !(await db.query('SELECT 1 FROM domwork_group_gate LIMIT 1')).rows.length;
    const rows = (await db.query(`SELECT id,name,manager_id,status,extra_data->'paymentOnboarding' AS ob FROM leads
        WHERE language='russian' AND deleted_at IS NULL AND COALESCE(extra_data->'paymentOnboarding'->>'telegramGroupLink','')<>''
        AND NOT EXISTS(SELECT 1 FROM domwork_group_gate g WHERE g.lead_id=leads.id)`)).rows;
    for (const r of rows) {
        const ob = r.ob || {};
        const state = first || !PAID.includes(r.status) ? 'legacy' : 'pending';
        if (state === 'legacy' && !first) continue; // havola bor, lekin hali to'lov bosqichida emas — keyin olinadi
        await db.query(`INSERT INTO domwork_group_gate(lead_id,manager_id,lead_name,group_name,group_link,assistant_id,state)
            VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
            [r.id, r.manager_id || '', r.name || '', norm(ob.telegramGroupName), ob.telegramGroupLink || '', ob.assistantTeacherId || '', state]);
    }
}

async function people(db, assistantId) {
    const roles = await require('./scheduler').roles(db, ['admin', 'akademik', 'assistant', 'teacher']);
    const out = [];
    for (const p of roles.filter(p => p.role === 'admin')) out.push({ key: 'admin:' + p.telegramId, label: `${p.name} (rahbar)`, tid: p.telegramId });
    for (const p of roles.filter(p => p.role === 'akademik')) out.push({ key: 'akademik:' + p.telegramId, label: `${p.name} (akademik rahbar)`, tid: p.telegramId });
    if (assistantId) {
        const a = roles.find(p => p.employeeId === assistantId);
        const name = (await db.query('SELECT name FROM hr_employees WHERE id=$1', [assistantId])).rows[0]?.name || 'Yordamchi ustoz';
        out.push(a ? { key: 'assistant', label: `${a.name} (yordamchi ustoz)`, tid: a.telegramId }
            : { key: 'assistant', label: `${name} (yordamchi ustoz)`, tid: null });
    }
    return out;
}

async function checkOne(db, call, botId, g) {
    const items = [];
    let chatId = g.chat_id;
    if (!chatId) {
        const found = (await db.query('SELECT chat_id,title FROM domwork_bot_seen_chats ORDER BY observed_at DESC')).rows.filter(r => norm(r.title) === g.group_name);
        if (found.length === 1) chatId = found[0].chat_id;
    }
    if (!chatId) {
        // Bot qo'shilgandan keyin nom o'zgartirilgan bo'lishi mumkin — oxirgi 7 kunda ko'rilgan chatlar nomini yangilab qayta qidiramiz.
        for (const r of (await db.query("SELECT chat_id FROM domwork_bot_seen_chats WHERE observed_at>NOW()-INTERVAL '7 days' AND bot_status='administrator' LIMIT 30")).rows) {
            try { const c = await call('getChat', { chat_id: r.chat_id }); if (c?.title) await db.query('UPDATE domwork_bot_seen_chats SET title=$2 WHERE chat_id=$1', [r.chat_id, String(c.title).slice(0, 200)]);
                if (norm(c?.title) === g.group_name) { chatId = r.chat_id; break; } } catch {}
        }
    }
    if (!chatId) {
        items.push({ ok: false, kind: 'bot', text: `@domworkuz_bot «${g.group_name}» nomli guruhga qo‘shilmagan yoki guruh nomi CRMdagidan farq qiladi` });
    } else {
        let bot = null, chat = null;
        try { chat = await call('getChat', { chat_id: chatId }); bot = await call('getChatMember', { chat_id: chatId, user_id: botId }); } catch { bot = null; }
        if (chat && norm(chat.title) !== g.group_name) {
            items.push({ ok: false, kind: 'name', text: `Guruh nomi o‘zgargan: Telegramda «${norm(chat.title)}», CRMda «${g.group_name}» — harfma-harf bir xil qiling` });
        } else if (!bot || bot.status !== 'administrator') {
            items.push({ ok: false, kind: 'bot', text: 'Bot guruhda admin emas — @domworkuz_bot ni admin qiling' });
        } else {
            const miss = BOT_RIGHTS.filter(([k]) => bot[k] !== true).map(([, l]) => l);
            if (bot.is_anonymous) miss.push('anonim bo‘lmasin');
            items.push(miss.length ? { ok: false, kind: 'bot', text: `Bot admin, lekin huquq yetishmaydi: ${miss.join(', ')}` }
                : { ok: true, kind: 'bot', text: 'Bot guruhda, to‘liq admin' });
            items.push({ ok: true, kind: 'name', text: 'Guruh nomi to‘g‘ri' });
            for (const p of await people(db, g.assistant_id)) {
                if (!p.tid) { items.push({ ok: false, kind: 'person', text: `${p.label} — botga start bosmagan. Avval @domworkuz_bot ga /start bossin` }); continue; }
                let m; try { m = await call('getChatMember', { chat_id: chatId, user_id: Number(p.tid) }); } catch { m = null; }
                const status = m?.status;
                if (status === 'creator' || (status === 'administrator')) { items.push({ ok: true, kind: 'person', text: `${p.label} — admin` }); continue; }
                if (status === 'member' || (status === 'restricted' && m.is_member)) {
                    if (bot.can_promote_members) {
                        try {
                            await call('promoteChatMember', { chat_id: chatId, user_id: Number(p.tid), is_anonymous: false, can_manage_chat: true,
                                can_delete_messages: !!bot.can_delete_messages, can_restrict_members: !!bot.can_restrict_members, can_invite_users: !!bot.can_invite_users,
                                can_pin_messages: !!bot.can_pin_messages, can_change_info: !!bot.can_change_info, can_manage_video_chats: !!bot.can_manage_video_chats,
                                can_promote_members: false });
                            items.push({ ok: true, kind: 'person', text: `${p.label} — bot admin qildi` }); continue;
                        } catch { items.push({ ok: false, kind: 'person', text: `${p.label} — bot admin qila olmadi` }); continue; }
                    }
                    items.push({ ok: false, kind: 'person', text: `${p.label} — guruhda, lekin admin emas` }); continue;
                }
                items.push({ ok: false, kind: 'person', text: `${p.label} — guruhga qo‘shilmagan` });
            }
        }
    }
    const done = items.length && items.every(i => i.ok);
    await db.query(`UPDATE domwork_group_gate SET chat_id=$2,items=$3,checked_at=NOW(),state=$4,ready_at=CASE WHEN $4='ready' THEN NOW() ELSE ready_at END WHERE lead_id=$1`,
        [g.lead_id, chatId || '', JSON.stringify(items), done ? 'ready' : 'pending']);
    if (done && chatId) await db.query(`INSERT INTO domwork_bot_seen_chats(chat_id,title,bot_status) VALUES($1,$2,'administrator') ON CONFLICT(chat_id) DO NOTHING`, [chatId, g.group_name]);
}

async function processOne(pool, call, botId) {
    await require('./queue').transaction(pool, async db => {
        await init(db);
        await enroll(db);
        const list = (await db.query(`SELECT * FROM domwork_group_gate WHERE state='pending' ORDER BY checked_at NULLS FIRST LIMIT 5`)).rows;
        for (const g of list) await checkOne(db, call, botId, g);
    });
}

// CRM: shu foydalanuvchini qulflaydigan guruhlar (sotuv menejeri — o'z lidlari, ROP — hammasi).
async function blocking(db, user, managerId) {
    await init(db);
    const role = String(user?.role || '');
    if (!['rop', 'sales_manager'].includes(role)) return { items: [] };
    const rows = (await db.query(`SELECT g.lead_id AS "leadId",g.lead_name AS "leadName",g.group_name AS "groupName",g.group_link AS "groupLink",
        g.items,g.checked_at AS "checkedAt",g.created_at AS "createdAt",h.name AS "managerName" FROM domwork_group_gate g
        LEFT JOIN hr_employees h ON h.id=g.manager_id JOIN leads l ON l.id=g.lead_id AND l.deleted_at IS NULL
        WHERE g.state='pending' AND ($1::text IS NULL OR g.manager_id=$1) ORDER BY g.created_at`, [role === 'rop' ? null : String(managerId || '-')])).rows;
    return { items: rows };
}
async function override(db, user, leadId, reason) {
    await init(db);
    if (user?.role !== 'admin') throw Object.assign(Error('Faqat rahbar qulfni ocha oladi'), { status: 403 });
    const r = String(reason || '').trim();
    if (r.length < 3) throw Object.assign(Error('Sababini yozing'), { status: 400 });
    await db.query(`UPDATE domwork_group_gate SET state='override',override_by=$2,override_reason=$3 WHERE lead_id=$1 AND state='pending'`, [leadId, user.id, r.slice(0, 300)]);
    return { ok: true };
}
async function recheck(db) { await init(db); await db.query("UPDATE domwork_group_gate SET checked_at=NULL WHERE state='pending'"); return { ok: true }; }
async function adminList(db, user) {
    await init(db);
    if (user?.role !== 'admin') return { items: [] };
    return { items: (await db.query(`SELECT lead_id AS "leadId",lead_name AS "leadName",group_name AS "groupName",items FROM domwork_group_gate WHERE state='pending' ORDER BY created_at`)).rows };
}
module.exports = { init, processOne, blocking, override, recheck, adminList };
