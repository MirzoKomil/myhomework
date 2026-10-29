'use strict';
// O'quvchining Telegram dars guruhi CRMda bor (school_student_groups.tg_link), lekin bot u guruhda emas yoki
// CRMda tasdiqlanmagan bo'lsa — ROPga eslatma. Yangi o'quvchilar (14 kun ichida) — ish vaqtida har 15 daqiqada,
// eskilari — kuniga bir marta 10:00 da jamlangan ro'yxat. Hal bo'lishi bilan (bot guruhda, tasdiqlangan) to'xtaydi.
const T = require('./tone');
const policy = require('./policy');
async function missing(db, now) {
    if (!(await db.query("SELECT to_regclass('school_student_groups') AS t")).rows[0]?.t) return [];
    const rows = (await db.query(`SELECT s.id,s.name,s.extra_data,g.name AS gname,g.tg_link,g.updated_at,h.name AS tname
        FROM school_student_groups g JOIN students s ON s.id=g.student_id LEFT JOIN hr_employees h ON h.id=s.teacher_id
        WHERE s.subject='russian' AND NOT g.archived AND g.tg_link<>''`)).rows.filter(r => policy.activeStudent(r));
    const groups = require('../domworkGroups'), seen = (await db.query('SELECT title,bot_status FROM domwork_bot_seen_chats')).rows;
    const out = new Map();
    for (const r of rows) {
        if (await groups.forStudent(db, r.id, { delivery: true })) continue;
        const key = r.tg_link;
        const chat = seen.find(c => c.title && r.gname && c.title.trim().toLowerCase() === r.gname.trim().toLowerCase());
        const state = !chat ? 'no-bot' : chat.bot_status === 'administrator' ? 'confirm' : 'not-admin';
        const fresh = now.getTime() - new Date(r.updated_at).getTime() < 14 * 86400000;
        const prev = out.get(key);
        if (prev) { prev.students.push(r.name); prev.fresh = prev.fresh || fresh; continue; }
        out.set(key, { name: r.gname, link: r.tg_link, teacher: r.tname || '', students: [r.name], state, fresh,
            since: new Date(r.updated_at).getTime() });
    }
    // Konvertatsiyadan keyin 15 daqiqa ROPga o'zi qo'shishga vaqt.
    return [...out.values()].filter(g => !g.fresh || now.getTime() - g.since > 15 * 60000);
}
const STATE = { 'no-bot': '🤖 bot qo‘shilmagan', 'not-admin': '⚠️ bot bor, lekin admin emas', confirm: '✅ bot admin — CRMda tasdiqlash kerak' };
function text(list, daily) {
    const lines = [daily ? '📋 <b>Bot yo‘q dars guruhlari — kunlik ro‘yxat</b>' : '🚨 <b>Yangi o‘quvchi guruhida bot yo‘q!</b>', ''];
    for (const g of list.slice(0, 15)) lines.push(`👥 ${T.b(g.name || 'Nomsiz guruh')}${g.teacher ? ` · ustoz ${T.esc(T.first(g.teacher))}` : ''}\n   ${T.esc(g.students.slice(0, 3).join(', '))}${g.students.length > 3 ? ` +${g.students.length - 3}` : ''}\n   ${STATE[g.state]} · ${T.esc(g.link)}`);
    if (list.length > 15) lines.push(`… va yana ${list.length - 15} ta guruh`);
    lines.push('', '❗ Bot guruhda bo‘lmasa, o‘quvchiga dars eslatmasi, jonli dars havolasi va xabarlar bormaydi — ertaga xizmatda muammo bo‘ladi.',
        '👉 @Domworkuz_bot ni guruhga qo‘shing → <b>admin</b> qiling → CRM → Telegram guruhlari → topilgan guruhni tasdiqlang.');
    if (!daily) lines.push('', T.i('Hal bo‘lmaguncha har 15 daqiqada eslatib turaman.'));
    return lines.join('\n');
}
async function run(db, settings, clock, now, once) {
    if (!settings.remindersEnabled) return;
    const slot = clock.minute % 15 < 2 && clock.hour >= 9 && clock.hour < 21;
    const daily = clock.hour === 10 && clock.minute < 2;
    if (!slot && !daily) return;
    const list = await missing(db, now);
    if (!list.length) return;
    const events = require('./events');
    const rops = await require('./scheduler').roles(db, ['rop']);
    const opts = { ...T.HTML, _setting: 'remindersEnabled', _expiresAt: new Date(now.getTime() + 15 * 60000).toISOString() };
    const fresh = list.filter(g => g.fresh);
    if (slot && fresh.length) {
        const key = `group-watch:${clock.date}:${clock.hour}:${Math.floor(clock.minute / 15)}`;
        await once(db, key, async () => { for (const r of rops) await events.privateMessage(db, `${key}:${r.telegramId}`, r, text(fresh, false), opts); });
    }
    const old = list.filter(g => !g.fresh);
    if (daily && old.length) await once(db, `group-watch-daily:${clock.date}`, async () => {
        for (const r of rops) await events.privateMessage(db, `group-watch-daily:${clock.date}:${r.telegramId}`, r, text(old, true), opts);
    });
}
module.exports = { missing, text, run };
