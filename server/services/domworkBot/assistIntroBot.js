'use strict';
// 14-noy: tanishuv aloqasi bot xabarlari (services/school/assistIntro.js). Faqat rus tili (Domwork) o'quvchilari.
//  • yangi juftlik → yordamchi ustozga: "24 soat ichida tanishing";
//  • "Tanishdik" → sotuv menejeriga va Sotuv guruhiga: "O'quvchingiz ishonchli qo'llarda";
//  • 24 soat o'tib ham tanishilmasa → akademik rahbarga ogohlantirish (bir marta).
const T = require('./tone');
const intro = require('../school/assistIntro');

async function run(db) {
    await intro.enroll(db);
    const events = require('./events');
    const rows = (await db.query(`SELECT i.*, s.name AS sname, s.subject, s.extra_data->>'managerId' AS manager_id,
            a.name AS aname, t.name AS tname
        FROM school_assist_intros i JOIN students s ON s.id=i.student_id
        LEFT JOIN hr_employees a ON a.id=i.assistant_id LEFT JOIN hr_employees t ON t.id=s.teacher_id
        WHERE i.state IN ('pending','done') AND (NOT i.notified_new OR (i.state='done' AND NOT i.notified_done)
            OR (i.state='pending' AND NOT i.notified_late AND i.assigned_at < NOW() - INTERVAL '24 hours')) LIMIT 20`)).rows;
    for (const r of rows) {
        const ru = r.subject === 'russian', opts = { ...T.HTML, _expiresAt: new Date(Date.now() + 12 * 3600000).toISOString() };
        const aFirst = T.first(r.aname || 'Yordamchi ustoz');
        if (!r.notified_new) {
            if (ru && r.state === 'pending') await events.privateMessage(db, 'intro-new:' + r.id, await events.employee(db, r.assistant_id),
                `👋 <b>Yangi o‘quvchi: ${T.esc(r.sname)}</b>${r.tname ? `\nAsosiy ustoz: ${T.esc(r.tname)}` : ''}\n\n24 soat ichida qo‘ng‘iroq qilib o‘zingizni yordamchi ustoz deb tanishtiring va raqamingizni qoldiring. Keyin kabinetda <b>«Tanishdim»</b> ni bosing.\n\n<i>Bu aloqa davomatga kirmaydi — faqat tanishuv.</i>`, opts);
            await db.query('UPDATE school_assist_intros SET notified_new=TRUE WHERE id=$1', [r.id]);
        }
        if (r.state === 'done' && !r.notified_done) {
            if (ru) {
                const text = `🤝 <b>${T.esc(r.sname)} yordamchi ustozi bilan tanishdi!</b>\n\nYordamchi ustoz ${T.esc(aFirst)} bog‘lanib, o‘zini tanishtirdi va raqamini qoldirdi.\n\n<i>O‘quvchingiz ishonchli qo‘llarda 💙</i>`;
                if (r.manager_id) await events.privateMessage(db, 'intro-done:m:' + r.id, await events.employee(db, r.manager_id), text, opts);
                await events.groupMessage(db, 'intro-done:g:' + r.id, 'sales', text, opts);
            }
            await db.query('UPDATE school_assist_intros SET notified_done=TRUE WHERE id=$1', [r.id]);
        }
        if (r.state === 'pending' && !r.notified_late && Date.now() - new Date(r.assigned_at).getTime() > intro.DUE_MS) {
            if (ru) for (const p of await require('./scheduler').roles(db, ['akademik']))
                await events.privateMessage(db, 'intro-late:' + r.id + ':' + p.telegramId, p,
                    `⏰ <b>${T.esc(aFirst)} ${T.esc(r.sname)} bilan hali tanishmadi</b>\n\nYordamchi ustoz biriktirilganiga 24 soatdan oshdi${r.no_answer ? ` (${r.no_answer} marta javob bermadi)` : ''}. Iltimos, sababini bilib qo‘ying.`, opts);
            await db.query('UPDATE school_assist_intros SET notified_late=TRUE WHERE id=$1', [r.id]);
        }
    }
}
async function processOne(pool) { await require('./queue').transaction(pool, db => run(db)); }
module.exports = { run, processOne };
