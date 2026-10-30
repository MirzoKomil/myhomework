'use strict';
// 30-okt: «Jonli kuzatuv» — CRM ichidagi harakatlar rahbarning (CRM admin) Telegram lichkasiga darhol boradi.
// Manbalar: lead_audit (biriktirish, o'tkazish + sabab, bosqich o'zgarishi, o'chirish, yangi lidlar),
// domwork_bot_events (sinov darsi, sotuv/to'lov, o'quvchi biriktirish, davomat) va scheduler nazorat nuqtalari
// (sinovni tasdiqlamayapti, davomat qilinmadi), har soatda ishlatilmagan yangi lidlar.
// Faqat o'qiydi — CRM yozuvlariga tegmaydi. Sozlama: liveFeedEnabled (Bot boshqaruvi).
const T = require('./tone');
const store = require('./store');
const stages = require('../leadStages');

const stage = s => stages.STAGE_LABEL_BY_ID.get(stages.normalizeLeadStatus(s)) || String(s || '—');
const FRESH = ['yangi-lidlar', 'new', 'organic', 'target', ''];

async function init(db) {
    await db.query('CREATE TABLE IF NOT EXISTS domwork_bot_live_cursor(name TEXT PRIMARY KEY, value BIGINT NOT NULL DEFAULT 0)');
    // Rejalashtiruvchi xatolari jurnali — Bot boshqaruvida ko'rinadi (hisobot nega bormaganini bilish uchun).
    await db.query('CREATE TABLE IF NOT EXISTS domwork_bot_errors(id BIGSERIAL PRIMARY KEY, part TEXT NOT NULL, message TEXT, created_at TIMESTAMPTZ DEFAULT NOW())');
    // Abdulloh so'ragan funksiya — bir marta yoqilgan holda boshlanadi; keyin Bot boshqaruvidan o'chirsa, o'chiq qoladi.
    await db.query(`UPDATE domwork_bot_settings SET data=data||'{"liveFeedEnabled":true}'::jsonb WHERE singleton=1 AND NOT (data ? 'liveFeedEnabled')`);
    await db.query(`UPDATE domwork_bot_settings SET data=data||'{"liveFeedRopEnabled":true}'::jsonb WHERE singleton=1 AND NOT (data ? 'liveFeedRopEnabled')`);
    // Jamoa kayfiyati (sotuv guruhiga 10:00 motivatsiya, 13:30 latifa, 18:00 qaynoq soat) hech qachon standart yoqilmagan edi.
    await db.query(`UPDATE domwork_bot_settings SET data=data||'{"teamVibesEnabled":true}'::jsonb WHERE singleton=1 AND NOT (data ? 'teamVibesEnabled')`);
}

async function send(db, key, text, { silent = false } = {}) {
    const settings = (await store.settings(db))?.data || {};
    if (!settings.liveFeedEnabled) return;
    const events = require('./events');
    // Cheklovsiz: kecha-kunduz, ovoz bilan; uzun ro'yxatlar Telegram chegarasidan oshmasligi uchun bo'laklarga bo'linadi.
    const parts = [];
    let chunk = '';
    for (const line of String(text).split('\n')) {
        if (chunk && chunk.length + line.length + 1 > 3300) { parts.push(chunk); chunk = ''; }
        chunk += (chunk ? '\n' : '') + line;
    }
    if (chunk) parts.push(chunk);
    // ROP ham sotuvga oid jonli voqealarni oladi (lidlar, sinov, sotuv, soatlik holat). O'chirish: liveFeedRopEnabled=false.
    // ROP: sotuv voqealari faqat 08:00–22:00 (Toshkent); soatlik holat — faqat rahbarga.
    const hour = new Date(Date.now() + 5 * 3600000).getUTCHours();
    const sales = /^(lead-|trial|pay)/.test(key) && settings.liveFeedRopEnabled !== false && hour >= 8 && hour < 22;
    for (const person of await require('./scheduler').roles(db, sales ? ['admin', 'rop'] : ['admin']))
        for (const [n, part] of parts.entries())
            await events.privateMessage(db, `live:${key}:${person.telegramId}${n ? ':p' + n : ''}`, person, part, {
                ...T.HTML, _setting: 'liveFeedEnabled', _expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
                ...(silent && settings.liveFeedSilent ? { disable_notification: true } : {})
            });
}

async function names(db) {
    const map = new Map();
    for (const r of (await db.query('SELECT id,name FROM hr_employees')).rows) map.set(r.id, r.name);
    return id => (id ? map.get(id) || 'Noma’lum xodim' : 'biriktirilmagan');
}

function newComments(before, after) {
    const old = new Set((before?.comments || []).map(c => c?.id || JSON.stringify(c)));
    return (after?.comments || []).filter(c => !old.has(c?.id || JSON.stringify(c)));
}
function reasonOf(before, after) {
    const fresh = newComments(before, after).reverse().find(c => c?.reason || c?.text);
    let reason = fresh ? String(fresh.reason || fresh.text) : '';
    if (!reason && after?.deferredPurchaseSurvey) {
        const s = after.deferredPurchaseSurvey;
        const label = require('../../../js/leadWorkflow').DEFERRED_REASONS?.find(r => r.id === s.reasonId)?.label;
        reason = s.reasonId === 'other' ? s.otherReason || '' : label || '';
    }
    if (!reason) {
        const r = after?.sifatsizReason || after?.unqualifiedReason || after?.lowQualityReason;
        reason = typeof r === 'string' ? r : r?.label || r?.reason || '';
    }
    reason = reason.replace(/\s+/g, ' ').trim();
    return reason.length > 220 ? reason.slice(0, 217) + '…' : reason;
}
const list = (items, max = Infinity) => items.slice(0, max).map(x => '• ' + x).join('\n') + (items.length > max ? `\n• … yana ${items.length - max} ta` : '');

async function leadFeed(db) {
    const cursor = (await db.query("SELECT value FROM domwork_bot_live_cursor WHERE name='lead_audit'")).rows[0];
    if (!cursor) { // birinchi ishga tushishda eski tarix qayta yuborilmaydi
        const max = (await db.query('SELECT COALESCE(MAX(id),0) AS m FROM lead_audit')).rows[0].m;
        await db.query("INSERT INTO domwork_bot_live_cursor VALUES('lead_audit',$1) ON CONFLICT DO NOTHING", [max]);
        return;
    }
    const rows = (await db.query('SELECT id,lead_id,action,actor_id,actor_name,snapshot FROM lead_audit WHERE id>$1 ORDER BY id LIMIT 300', [cursor.value])).rows;
    if (!rows.length) return;
    await db.query("UPDATE domwork_bot_live_cursor SET value=$1 WHERE name='lead_audit'", [rows[rows.length - 1].id]);
    const langs = new Map((await db.query('SELECT id,language FROM leads WHERE id=ANY($1)', [[...new Set(rows.map(r => r.lead_id))]])).rows.map(r => [r.id, r.language]));
    const who = await names(db);
    const created = [], assigned = new Map(), moved = new Map(), deleted = [];
    const push = (map, key, value) => { if (!map.has(key)) map.set(key, []); map.get(key).push(value); };
    for (const row of rows) {
        const snap = row.snapshot || {};
        const before = snap.before || null, after = snap.after || (row.action === 'created' ? snap : null);
        const lang = langs.get(row.lead_id) || after?.language || before?.language;
        if (lang !== 'russian') continue;
        const actor = String(row.actor_name || '').trim() || 'Tizim';
        const name = (after || before)?.name || 'Nomsiz lid';
        if (row.action === 'deleted') { deleted.push({ actor, name }); continue; }
        if (row.action === 'created' || !before) { created.push({ name, source: after?.source || '', manager: after?.managerId || '' }); continue; }
        if (!after) continue;
        if ((before.managerId || '') !== (after.managerId || ''))
            push(assigned, [actor, before.managerId || '', after.managerId || ''].join('|'), name);
        const from = stages.normalizeLeadStatus(before.status), to = stages.normalizeLeadStatus(after.status);
        if (from !== to) push(moved, [actor, from, to].join('|'), { name, reason: reasonOf(before, after) });
    }
    if (created.length) {
        const by = {};
        for (const c of created) by[c.source || 'Noma’lum manba'] = (by[c.source || 'Noma’lum manba'] || 0) + 1;
        await send(db, `lead-new:${rows[0].id}`, `🆕 <b>${created.length} ta yangi lid</b> · ${T.esc(Object.entries(by).map(([k, v]) => `${k}: ${v}`).join(', '))}\n`
            + list(created.map(c => `${T.esc(c.name)}${c.manager ? ' → ' + T.esc(who(c.manager)) : ''}`)), { silent: true });
    }
    for (const [key, leads] of assigned) {
        const [actor, from, to] = key.split('|');
        const head = from
            ? `🔁 <b>${T.esc(actor)}</b> ${T.b(leads.length + ' ta')} lidni ${T.b(who(from))}dan ${T.b(who(to))}ga o‘tkazdi`
            : `👥 <b>${T.esc(actor)}</b> ${T.b(who(to))}ga ${T.b(leads.length + ' ta')} lid biriktirdi`;
        await send(db, `lead-assign:${rows[0].id}:${key}`, `${head}\n${list(leads.map(T.esc))}`);
    }
    for (const [key, items] of moved) {
        const [actor, from, to] = key.split('|');
        const icon = { 'sifatsiz-lidlar': '🚫', 'muvaffaqiyatsiz-sotuv': '💔', 'tolov-yopildi': '🎉', 'sinov-darsida': '🧪', 'keyin-sotib-olmoqchi': '⏳' }[to] || '🔀';
        const text = items.length === 1
            ? `${icon} <b>${T.esc(actor)}</b>: ${T.b(items[0].name)}\n${T.esc(stage(from))} → ${T.b(stage(to))}${items[0].reason ? `\n📝 Sabab: ${T.i(items[0].reason)}` : ''}`
            : `${icon} <b>${T.esc(actor)}</b> ${T.b(items.length + ' ta')} lidni ${T.esc(stage(from))} → ${T.b(stage(to))}ga o‘tkazdi\n`
              + list(items.map(x => T.esc(x.name) + (x.reason ? ' — ' + T.i(x.reason) : '')));
        await send(db, `lead-move:${rows[0].id}:${key}`, text);
    }
    if (deleted.length) await send(db, `lead-del:${rows[0].id}`, `🗑 <b>Lid o‘chirildi</b>\n` + list(deleted.map(d => `${T.esc(d.actor)}: ${T.esc(d.name)}`)));
}

async function hourly(db, clock, once) {
    if (clock.minute > 1) return; // har soatda, kecha-kunduz
    await once(db, `live-hourly:${clock.date}:${clock.hour}`, async () => {
        const who = await names(db);
        const rows = (await db.query(`SELECT COALESCE(manager_id,'') AS manager, COUNT(*)::int AS n, MIN(created_at) AS oldest
            FROM leads WHERE language='russian' AND deleted_at IS NULL AND COALESCE(status,'') = ANY($1) GROUP BY 1 ORDER BY 2 DESC`, [FRESH])).rows;
        const lastHour = (await db.query(`SELECT COUNT(*)::int AS n FROM leads WHERE language='russian' AND deleted_at IS NULL AND created_at>NOW()-INTERVAL '1 hour'`)).rows[0].n;
        const total = rows.reduce((s, r) => s + r.n, 0);
        const age = d => { const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000); return h >= 48 ? Math.floor(h / 24) + ' kun' : h >= 1 ? h + ' soat' : '1 soatdan kam'; };
        const text = `🕐 <b>Soat ${String(clock.hour).padStart(2, '0')}:00 · lidlar holati</b>\n\n📥 So‘nggi 1 soatda tushgan: ${T.b(lastHour + ' ta')}\n`
            + (total ? `⚠️ Ishlatilmay turgan (Yangi lidlar bosqichida): ${T.b(total + ' ta')}\n` + list(rows.map(r => `${T.esc(who(r.manager))} — ${T.b(r.n + ' ta')} (eng eskisi ${age(r.oldest)})`))
                : '✅ Ishlatilmay turgan yangi lid yo‘q — zo‘r!');
        await send(db, `hourly:${clock.date}:${clock.hour}`, text, { silent: true });
    });
}

async function run(db, settings, clock, now, once) {
    if (!settings.liveFeedEnabled) return;
    await leadFeed(db);
    await hourly(db, clock, once);
}

module.exports = { init, send, run, leadFeed, hourly, reasonOf, stage };
