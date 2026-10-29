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
// Admin: nega o'quvchiga oyna chiqmayapti — ism/telefon/login bo'yicha qidirib, har bir shartni ko'rsatadi.
async function diagnose(pool, actor, query, botHealthy) {
    return queue.transaction(pool, async db => {
        await require('./store').currentAdmin(db, actor);
        const q = String(query || '').trim();
        if (q.length < 3) throw policy.error(400, 'Kamida 3 ta belgi kiriting (ism, telefon yoki login)');
        const digits = q.replace(/\D/g, '');
        const rows = (await db.query(`SELECT id,name,phone,subject,extra_data FROM students
            WHERE name ILIKE $1 OR extra_data->>'login' ILIKE $1 OR ($2<>'' AND regexp_replace(COALESCE(phone,''),'[^0-9]','','g') LIKE $3) ORDER BY name LIMIT 8`,
            [`%${q}%`, digits.length >= 5 ? digits : '', `%${digits}%`])).rows;
        const c = await campaign(db);
        const out = [];
        for (const r of rows) {
            const x = r.extra_data || {};
            const link = (await db.query("SELECT telegram_id,paused FROM domwork_bot_links WHERE account_kind='student' AND account_id=$1", [r.id])).rows[0];
            const sessions = (await db.query('SELECT COUNT(*)::int AS n, MAX(last_seen) AS seen FROM sessions WHERE user_id=$1', [r.id]).catch(() => ({ rows: [{ n: null }] }))).rows[0];
            const reasons = [];
            if (r.subject !== 'russian') reasons.push('rus tili o‘quvchisi emas');
            if (!x.passwordHash) reasons.push('ilovaga kirish paroli yo‘q');
            if (!(Number(x.paidAmount) > 0)) reasons.push(`to‘lov summasi CRMda 0 (paidAmount=${x.paidAmount ?? 'yo‘q'})`);
            if (x.isStaffDemo === true) reasons.push('xodim uchun demo akkaunt');
            if (x.frozen === true) reasons.push('muzlatilgan');
            if (x.status === 'inactive') reasons.push('faol emas');
            if (link) reasons.push('botga allaqachon ulangan' + (link.paused ? ' (/stop bosgan)' : ''));
            if (!c.required) reasons.push('kampaniya yoqilmagan');
            if (!botHealthy) reasons.push('bot hozir xabar qabul qilmayapti (webhook/Redis)');
            if (!sessions?.n) reasons.push('ilovaga kirgan sessiyasi yo‘q');
            out.push({ name: r.name, phone: r.phone, login: x.login || '', linked: !!link, sessions: sessions?.n ?? null, lastSeen: sessions?.seen || null,
                popup: reasons.length === 0, reasons });
        }
        return { students: out };
    });
}
module.exports = { campaign, mandatory, relaunch, stop, report, diagnose };
