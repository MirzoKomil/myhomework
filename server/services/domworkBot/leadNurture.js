'use strict';
// 30-okt: CRMdagi lid bosqichi o'zgarganda — botga ulangan mijozga (voronka mehmoni) mos, iliq xabar.
// Manba: lead_audit (o'z kursori), faqat rus tili lidlari va domwork_bot_visitors.lead_id orqali ulangan mijozlar.
// Xabarlar 09:00–21:00 (Toshkent) oralig'ida; kechasi o'zgarsa — ertalab 09:30 da. Har lid × bosqich — bir marta.
// Sinov darsi bosqichidagi xabarlar events.js (sinov) va scheduler (eslatmalar) orqali boradi — bu yerda takrorlanmaydi.
const store = require('./store');
const stages = require('../leadStages');
const copy = require('./funnelCopy');

const first = s => String(s || '').trim().split(/\s+/)[0] || '';
const inline = rows => ({ inline_keyboard: rows.map(r => r.map(([text, data]) => (/^https:\/\//.test(data) ? { text, url: data } : { text, callback_data: data }))) });

function sendAt(now, delayMs = 0) {
    const t = new Date(now.getTime() + delayMs), local = new Date(t.getTime() + 5 * 3600000), m = local.getUTCHours() * 60 + local.getUTCMinutes();
    if (m >= 540 && m < 1260) return t;
    const next = new Date(local); if (m >= 1260) next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(9, 30, 0, 0);
    return new Date(next.getTime() - 5 * 3600000);
}
async function queue(db, key, tid, method, payload, at) {
    await store.enqueue(db, { key, targetId: tid, method, notBefore: at,
        payload: { chat_id: tid, ...payload, _guest: { tid }, _automation: true, _expiresAt: new Date(at.getTime() + 12 * 3600000).toISOString() } });
}

const TEXT = {
    trying: m => `${m ? m + ' — menejerimiz' : 'Menejerimiz'} sizga qo‘ng‘iroq qildi, lekin ulanmadi 📞\nQachon qulay? Tanlang — aynan o‘sha vaqtda bog‘lanamiz.`,
    talked: (name, m) => `${name ? name + ', ' : ''}${m ? m + ' bilan' : 'menejerimiz bilan'} suhbat uchun rahmat! 🤝\n\nKeyingi qadam — ustoz bilan jonli sinov darsi: darajangizni ko‘rasiz, ustoz bilan tanishasiz va dars qanday o‘tishini o‘zingiz his qilasiz.\n\nSavollaringiz bo‘lsa — shu yerga yozing, menejer javob beradi.`,
    deciding: name => `${name ? name + ', ' : ''}qaror qilish oson bo‘lishi uchun — eng ko‘p beriladigan savollarga javoblar 👇\n\n✅ ${copy.FAQ.refund[1]}\n\n💳 ${copy.FAQ.install[1]}\n\n⭐ O‘quvchilarimiz natijalari: @domwork_natijalari`,
    decidingNudge: name => `${name ? name + ', ' : ''}o‘ylab ko‘rdingizmi? 🙂\nYana savol qolgan bo‘lsa — yozing yoki menejerga «qo‘ng‘iroq qiling» deb bosing.`,
    later: (name, date) => `Tushunarli${name ? ', ' + name : ''} 👍${date ? `\n${date} kuni menejerimiz eslatib bog‘lanadi.` : ''}\nUngacha haftada bir-ikki marta foydali iboralar yuborib turamiz — tilingiz «sovib» qolmasin.`,
    laterDay: name => `${name ? name + ', ' : ''}assalomu alaykum! 🙂 Kelishganimizdek, bugun menejerimiz siz bilan bog‘lanadi.\nQulay vaqtni tanlab qo‘ying 👇`,
    paying: name => `${name ? name + ', ' : ''}to‘lov bo‘yicha ma’lumot 💳\n\n• Click / Payme — «Homework» (Domwork ta’lim loyihasi)\n• Bo‘lib to‘lash — Uzum Nasiya yoki PayLater\n\n📄 Shartnoma — ommaviy oferta, quyida ilova qilindi.\n🗓 To‘lovdan keyin darslar uzog‘i bilan 3 ish kunida boshlanadi.\n\nSavol bo‘lsa — shu yerga yozing, menejer javob beradi.`
};

async function run(db, now = new Date()) {
    const s = (await store.settings(db))?.data || {};
    if (s.funnelEnabled !== true) return;
    if (!(await db.query("SELECT to_regclass('domwork_bot_visitors') AS t")).rows[0]?.t) return;
    await db.query("CREATE TABLE IF NOT EXISTS domwork_bot_live_cursor(name TEXT PRIMARY KEY, value BIGINT NOT NULL DEFAULT 0)");
    const cursor = (await db.query("SELECT value FROM domwork_bot_live_cursor WHERE name='nurture_audit'")).rows[0];
    if (!cursor) {
        const max = (await db.query('SELECT COALESCE(MAX(id),0) AS m FROM lead_audit')).rows[0].m;
        await db.query("INSERT INTO domwork_bot_live_cursor VALUES('nurture_audit',$1) ON CONFLICT DO NOTHING", [max]);
        return;
    }
    const rows = (await db.query(`SELECT a.id,a.lead_id,a.snapshot FROM lead_audit a WHERE a.id>$1 ORDER BY a.id LIMIT 300`, [cursor.value])).rows;
    if (rows.length) await db.query("UPDATE domwork_bot_live_cursor SET value=$1 WHERE name='nurture_audit'", [rows[rows.length - 1].id]);
    for (const r of rows) {
        const before = r.snapshot?.before, after = r.snapshot?.after;
        if (!before || !after) continue;
        const from = stages.normalizeLeadStatus(before.status), to = stages.normalizeLeadStatus(after.status);
        if (from === to) continue;
        const v = (await db.query(`SELECT v.* FROM domwork_bot_visitors v JOIN leads l ON l.id=v.lead_id AND l.language='russian' AND l.deleted_at IS NULL
            WHERE v.lead_id=$1 AND v.blocked_at IS NULL ORDER BY v.updated_at DESC LIMIT 1`, [r.lead_id])).rows[0];
        if (!v) continue;
        const tid = v.telegram_id, name = first(after.name || v.first_name);
        const manager = after.managerId ? first((await db.query('SELECT name FROM hr_employees WHERE id=$1', [after.managerId])).rows[0]?.name) : '';
        const key = `nurture:${r.lead_id}:${to}`;
        const once = async fn => { if ((await db.query('INSERT INTO domwork_bot_jobs(key) VALUES($1) ON CONFLICT DO NOTHING RETURNING key', [key])).rows.length) await fn(); };
        if (to === 'boglanishga-urinilmoqda') await once(async () => {
            // Menejerning «Javob yo'q» tugmasi bilan bir xil kalit — bir kunda bitta.
            const at = sendAt(now, 5 * 60000);
            await queue(db, `noans:${tid}:${at.toISOString().slice(0, 10)}`, tid, 'sendMessage', { text: TEXT.trying(manager),
                reply_markup: inline([[[copy.WHEN.now, 'f:w:now'], [copy.WHEN.eve, 'f:w:eve']], [[copy.WHEN.morn, 'f:w:morn'], [copy.text.ctaTelegram, 'f:tg']]]) }, at);
            await db.query("UPDATE domwork_bot_visitors SET request=COALESCE(request,'{\"method\":\"call\"}'::jsonb),updated_at=NOW() WHERE telegram_id=$1", [tid]);
        });
        if (to === 'boglanildi') await once(() => queue(db, key, tid, 'sendMessage', { text: TEXT.talked(name, manager),
            reply_markup: inline([[[copy.KEYBOARD.faq, 'f:faqlist']]]) }, sendAt(now, 20 * 60000)));
        if (to === 'qaror-jarayonida') await once(async () => {
            await queue(db, key, tid, 'sendMessage', { text: TEXT.deciding(name), reply_markup: inline([[[copy.text.ctaCall, 'f:call'], [copy.text.ctaTelegram, 'f:tg']]]) }, sendAt(now, 2 * 3600000));
            await queue(db, key + ':d2', tid, 'sendMessage', { text: TEXT.decidingNudge(name), reply_markup: inline([[[copy.text.ctaCall, 'f:call']], [[copy.KEYBOARD.faq, 'f:faqlist']]]) }, sendAt(now, 2 * 86400000));
        });
        if (to === 'keyin-sotib-olmoqchi') await once(async () => {
            const date = after.deferredPurchaseSurvey?.contactDate || '';
            const human = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('.') : '';
            await queue(db, key, tid, 'sendMessage', { text: TEXT.later(name, human) }, sendAt(now, 30 * 60000));
            if (human) {
                const at = new Date(date + 'T10:00:00+05:00');
                if (at > now) await queue(db, key + ':day', tid, 'sendMessage', { text: TEXT.laterDay(name),
                    reply_markup: inline([[[copy.WHEN.now, 'f:w:now'], [copy.WHEN.eve, 'f:w:eve']], [[copy.text.ctaTelegram, 'f:tg']]]) }, at);
            }
            // Isitish «o'ylab ko'raman» treki bo'yicha davom etadi (o'quvchi fikri, savollar, chegirma eslatmasi).
            await db.query("UPDATE domwork_bot_visitors SET outcome='r_think',outcome_at=NOW(),updated_at=NOW() WHERE telegram_id=$1 AND (outcome IS NULL OR outcome NOT LIKE 'r\\_%')", [tid]);
        });
        if (to === 'tolov-jarayonida') await once(async () => {
            const at = sendAt(now, 10 * 60000);
            await queue(db, key, tid, 'sendMessage', { text: TEXT.paying(name) }, at);
            const file = require('./funnel').bundledFile('oferta');
            if (file) await queue(db, key + ':oferta', tid, 'sendDocument', { document: 'bundled', _bundled: 'oferta', caption: '📄 Ommaviy oferta shartnomasi' }, new Date(at.getTime() + 2000));
        });
        if (to === 'muvaffaqiyatsiz-sotuv') await db.query("UPDATE domwork_bot_visitors SET outcome='r_no',outcome_at=NOW(),updated_at=NOW() WHERE telegram_id=$1", [tid]);
        if (['sifatsiz-lidlar', 'tolov-yopildi'].includes(to)) await db.query('UPDATE domwork_bot_visitors SET drip_stopped=true,updated_at=NOW() WHERE telegram_id=$1', [tid]);
    }
}
module.exports = { run, sendAt, TEXT };
