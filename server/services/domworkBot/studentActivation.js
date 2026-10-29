'use strict';
// O'quvchilarni botga ulash kampaniyasi (xodimlardagidek).
// Admin "O'quvchilarni ulash"ni yoqqanda: ulangan o'quvchilarga yangi xush kelibsiz xabari + yangi menyu boradi;
// ulanmagan faol rus tili o'quvchilariga ilovada yopilmaydigan oyna chiqadi (bot sog' bo'lsa).
const policy = require('./policy');
const queue = require('./queue');
async function campaign(db) {
    const c = (await require('./store').settings(db))?.data?.studentActivation || {};
    return { required: c.required === true, id: Number.isInteger(c.campaign) ? c.campaign : 0, startedAt: c.startedAt || null };
}
async function mandatory(db, linked) {
    if (linked) return false;
    return (await campaign(db)).required;
}
async function relaunch(pool, actor) {
    return queue.transaction(pool, async db => {
        const store = require('./store');
        await store.currentAdmin(db, actor);
        const prev = (await db.query('SELECT data FROM domwork_bot_settings WHERE singleton=1 FOR UPDATE')).rows[0].data?.studentActivation || {};
        if (prev.startedAt && Date.now() - new Date(prev.startedAt).getTime() < 10 * 60000)
            throw policy.error(429, 'Hozirgina ishga tushirilgan. 10 daqiqadan keyin qayta urinib ko‘ring');
        const next = { required: true, campaign: (Number.isInteger(prev.campaign) ? prev.campaign : 0) + 1, startedAt: new Date().toISOString() };
        await db.query("UPDATE domwork_bot_settings SET data=data||jsonb_build_object('studentActivation',$1::jsonb),revision=revision+1 WHERE singleton=1", [JSON.stringify(next)]);
        const { keyboard } = require('./handlers'), T = require('./tone');
        let sent = 0;
        for (const { telegram_id: tid } of (await db.query("SELECT telegram_id FROM domwork_bot_links WHERE account_kind='student' AND NOT paused")).rows) {
            const identity = await store.identity(db, tid);
            if (identity?.kind !== 'student') continue;
            await store.enqueue(db, { key: `student-activate:${next.campaign}:${identity.id}`, targetId: tid, role: identity.role, account: identity,
                payload: { chat_id: tid, ...T.HTML, reply_markup: keyboard(identity),
                    text: `Assalomu alaykum, ${T.esc(T.first(identity.name))}! 👋\n\nDomwork Yordamchisi yangilandi 🎉\n\nPastdagi menyuda endi hammasi bir joyda:\n🔑 login va parol · 📊 baholar · 📅 dars jadvali\n💳 to‘lov · 📄 shartnoma · ✅ davomat\n\n🔔 Darsdan 15 daqiqa oldin eslatma va jonli dars havolasi ham shu yerga keladi.\n\nYangi ilova: https://myhomework.uz/student/v2/` } });
            sent++;
        }
        await store.audit(db, actor.id, 'student-activation-relaunch', 'domwork', { campaign: next.campaign, sent });
        return { ok: true, sent };
    });
}
async function stop(pool, actor) {
    return queue.transaction(pool, async db => {
        const store = require('./store');
        await store.currentAdmin(db, actor);
        await db.query(`UPDATE domwork_bot_settings SET data=jsonb_set(data,'{studentActivation,required}','false'::jsonb),revision=revision+1
            WHERE singleton=1 AND data ? 'studentActivation'`);
        await store.audit(db, actor.id, 'student-activation-stop', 'domwork', {});
        return { ok: true };
    });
}
async function report(pool) {
    return queue.transaction(pool, async db => {
        const c = await campaign(db);
        const students = (await db.query("SELECT id,extra_data FROM students WHERE subject='russian' AND COALESCE(extra_data->>'isStaffDemo','false')<>'true'")).rows
            .filter(r => policy.activeStudent(r));
        const linked = new Set((await db.query("SELECT account_id FROM domwork_bot_links WHERE account_kind='student'")).rows.map(r => r.account_id));
        return { required: c.required, campaign: c.id, total: students.length, linked: students.filter(s => linked.has(s.id)).length };
    });
}
module.exports = { campaign, mandatory, relaunch, stop, report };
