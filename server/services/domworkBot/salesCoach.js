'use strict';
// 30-okt: «Sotuv murabbiyi» — sotuv menejerlarini lidlar bilan ishlashga yo'naltiruvchi iliq, aniq vazifali xabarlar.
//  • 10:00 — kunlik reja: kimga qayta qo'ng'iroq, qaysi lidni Sifatsizga chiqarish, kechagi sinovlar natijasi, kelishilgan qo'ng'iroqlar.
//  • Real vaqtda (09:00–20:00): yangi lid 15 daqiqa kutib qoldi; lid 3 kundan beri «Bog'lanishga urinilmoqda»da;
//    sinov darsi o'tdi, lekin lid hali «Sinov darsida» (natija nima bo'ldi?).
//  • Maqtov: eski lid bo'yicha qaror qilinsa — «Barakalla! Yana N ta qoldi…».
//  • 16:00 — kun yakunigacha qolgan eski lidlar; 10:05 — ROPga jamoa kesimi.
// Faqat o'qiydi; CRMdagi lidlarni o'zi o'zgartirmaydi. Sozlama: salesCoachEnabled.
const T = require('./tone');
const stages = require('../leadStages');
const workflow = require('../../../js/trialWorkflow');

const DAY = 86400000, HOUR = 3600000;
const STALE = { 'boglanishga-urinilmoqda': 3 * DAY };            // → qayta urinish, olmasa Sifatsiz
const SLOW = { boglanildi: 2 * DAY, 'qaror-jarayonida': 2 * DAY, 'tolov-jarayonida': DAY };
const label = s => stages.STAGE_LABEL_BY_ID.get(s) || s;

async function init(db) {
    await db.query("CREATE TABLE IF NOT EXISTS domwork_bot_live_cursor(name TEXT PRIMARY KEY, value BIGINT NOT NULL DEFAULT 0)");
    await db.query(`UPDATE domwork_bot_settings SET data=data||'{"salesCoachEnabled":true}'::jsonb WHERE singleton=1 AND NOT (data ? 'salesCoachEnabled')`);
}

function enteredAt(row) {
    const x = row.extra_data || {}, status = stages.normalizeLeadStatus(row.status);
    const hist = Array.isArray(x.stageHistory) ? x.stageHistory : [];
    for (let i = hist.length - 1; i >= 0; i--) if (stages.normalizeLeadStatus(hist[i]?.to) === status) {
        const t = Date.parse(hist[i].at); if (Number.isFinite(t)) return t; break;
    }
    for (const v of [x.slaStageEnteredAt, x.statusChangedAt, row.updated_at, row.created_at]) { const t = Date.parse(v); if (Number.isFinite(t)) return t; }
    return Date.now();
}
const ago = ms => { const h = Math.floor(ms / HOUR); return h >= 48 ? Math.floor(h / 24) + ' kun' : h >= 1 ? h + ' soat' : Math.max(1, Math.floor(ms / 60000)) + ' daqiqa'; };
const line = l => `${T.b(l.name)}${l.phone ? ' · ' + T.esc(l.phone) : ''}`;
const list = (items, fmt = line, max = 25) => items.slice(0, max).map(l => '• ' + fmt(l)).join('\n') + (items.length > max ? `\n• … yana ${items.length - max} ta (CRMda)` : '');

async function load(db, now) {
    const rows = (await db.query(`SELECT id,name,phone,status,manager_id,extra_data,created_at,updated_at FROM leads
        WHERE language='russian' AND deleted_at IS NULL AND COALESCE(manager_id,'')<>''`)).rows;
    const today = require('./policy').today(now);
    return rows.map(r => {
        const status = stages.normalizeLeadStatus(r.status), at = enteredAt(r), x = r.extra_data || {};
        const booking = status === 'sinov-darsida' ? workflow.request({ ...x, id: r.id, name: r.name, status: r.status }) : null;
        const lesson = status === 'sinov-darsida' ? Date.parse(booking?.scheduledAt || x.trialLessonAt || x.trialLesson?.date || '') : NaN;
        return { id: r.id, name: r.name || 'Nomsiz', phone: r.phone || '', status, manager: r.manager_id, at, age: now.getTime() - at,
            created: Date.parse(r.created_at), booking, lesson: Number.isFinite(lesson) ? lesson : null,
            contactDate: status === 'keyin-sotib-olmoqchi' ? x.deferredPurchaseSurvey?.contactDate || '' : '', today };
    });
}
const isStale = l => STALE[l.status] && l.age >= STALE[l.status];
const trialPassed = (l, now, after = 3 * HOUR) => l.status === 'sinov-darsida' && l.lesson && now.getTime() - l.lesson >= after;

async function managers(db) {
    return new Map((await db.query("SELECT id,name FROM hr_employees")).rows.map(r => [r.id, r.name]));
}
async function dm(db, key, managerId, text, now, hours = 2) {
    const person = await require('./events').employee(db, managerId);
    if (!person) return false;
    await require('./events').privateMessage(db, 'coach:' + key, person, text,
        { ...T.HTML, _setting: 'salesCoachEnabled', _expiresAt: new Date(now.getTime() + hours * HOUR).toISOString() });
    return true;
}
function byManager(leads) { const m = new Map(); for (const l of leads) { if (!m.has(l.manager)) m.set(l.manager, []); m.get(l.manager).push(l); } return m; }

const MORNING = ['Xayrli tong', 'Assalomu alaykum, xayrli kun', 'Yangi kun — yangi sotuvlar', 'Xayrli tong, chempion'];

function plan(leads, now) {
    const stale = leads.filter(isStale).sort((a, b) => b.age - a.age);
    const trying = leads.filter(l => l.status === 'boglanishga-urinilmoqda' && !isStale(l));
    const fresh = leads.filter(l => l.status === 'yangi-lidlar');
    const trials = leads.filter(l => trialPassed(l, now, HOUR));
    const slow = leads.filter(l => SLOW[l.status] && l.age >= SLOW[l.status]).sort((a, b) => b.age - a.age);
    const calls = leads.filter(l => l.contactDate && l.contactDate <= l.today);
    return { stale, trying, fresh, trials, slow, calls, total: stale.length + trying.length + fresh.length + trials.length + slow.length + calls.length };
}

async function morning(db, now, clock, once) {
    const names = await managers(db), all = await load(db, now), team = [];
    for (const [id, leads] of byManager(all)) {
        const p = plan(leads, now), name = T.first(names.get(id) || '');
        team.push({ id, name: names.get(id) || 'Menejer', p });
        if (!p.total) continue;
        await once(db, `coach-morning:${clock.date}:${id}`, async () => {
            const parts = [`☀️ <b>${T.pick(MORNING, clock.date + id)}, ${T.esc(name)}!</b>\nBugungi vazifalaringiz tayyor — birma-bir bajaramiz 👇`];
            if (p.fresh.length) parts.push(`🆕 <b>Yangi lidlar — birinchi qo‘ng‘iroq (${p.fresh.length} ta)</b>\nIssiq paytida qo‘ng‘iroq qiling — birinchi 15 daqiqa eng muhim:\n${list(p.fresh)}`);
            if (p.trials.length) parts.push(`🧪 <b>Sinov darsi o‘tgan, natija yozilmagan (${p.trials.length} ta)</b>\nGaplashdingizmi? Taassurotini so‘rang va CRMda keyingi bosqichga o‘tkazing:\n${list(p.trials, l => `${line(l)} — dars ${T.esc(T.when(new Date(l.lesson + 5 * HOUR).toISOString().slice(0, 16)))}`)}`);
            if (p.calls.length) parts.push(`📅 <b>Bugun qo‘ng‘iroq qilishga kelishilgan (${p.calls.length} ta)</b>\nVa’da qilgan edingiz — mijoz kutyapti:\n${list(p.calls)}`);
            if (p.trying.length) parts.push(`📞 <b>Qayta qo‘ng‘iroq qilish kerak (${p.trying.length} ta)</b>\n«Bog‘lanishga urinilmoqda»da — yana urinib ko‘ring, Telegramga ham yozing:\n${list(p.trying)}`);
            if (p.stale.length) parts.push(`🧹 <b>3 kundan oshgan lidlar (${p.stale.length} ta)</b>\nOxirgi marta qo‘ng‘iroq qiling. Olishmasa — <b>Sifatsiz lidlar</b>ga chiqaring, statistikani buzmasin:\n${list(p.stale, l => `${line(l)} — ${ago(l.age)}`)}`);
            if (p.slow.length) parts.push(`⏳ <b>Bir joyda turib qolganlar (${p.slow.length} ta)</b>\nKeyingi qadamni belgilang:\n${list(p.slow, l => `${line(l)} — ${T.esc(label(l.status))}, ${ago(l.age)}`)}`);
            parts.push(T.i(T.pick(['Kichik qadamlar — katta natija. Omad! 💪', 'Har bir qo‘ng‘iroq — sotuvga bir qadam 📈', 'Bugun kuchli kun bo‘ladi — boshladik! 🚀', 'Siz uddalaysiz — jamoa siz bilan 🤝'], clock.date + id + 'e')));
            await dm(db, `morning:${clock.date}:${id}`, id, parts.join('\n\n'), now, 6);
            // Ertalabki rejada aytilganlar real vaqt eslatmasida qayta takrorlanmaydi.
            const keys = [...p.stale.map(l => `coach-stale:${l.id}:${l.at}`), ...p.fresh.map(l => `coach-new:${l.id}`),
                ...p.trials.map(l => `coach-trial:${l.id}:${l.booking?.id || l.lesson}`)];
            for (const key of keys) await db.query('INSERT INTO domwork_bot_jobs(key) VALUES($1) ON CONFLICT DO NOTHING', [key]);
        });
    }
    return team;
}

async function ropDigest(db, now, clock, once) {
    await once(db, `coach-rop:${clock.date}`, async () => {
        const names = await managers(db), rows = [];
        for (const [id, leads] of byManager(await load(db, now))) {
            const p = plan(leads, now);
            if (p.stale.length || p.trials.length || p.fresh.length || p.slow.length) rows.push({ name: names.get(id) || 'Menejer', p });
        }
        const behind = pace((await require('./dailyReports').salesDay(db, clock.date)).people, clock.date);
        if (!rows.length && !behind.length) return;
        rows.sort((a, b) => (b.p.stale.length + b.p.trials.length) - (a.p.stale.length + a.p.trials.length));
        const text = `📋 <b>Sotuv jamoasi — bugungi nazorat</b>\n\n` + (behind.length ? `📉 <b>Oy rejasidan orqada:</b>\n${behind.map(p => `• ${T.b(p.name)} — ${Math.round(p.pct * 100)}% (shu kungacha ~${Math.round(p.expected * 100)}% bo‘lishi kerak edi)`).join('\n')}\nUlar bilan alohida gaplashib, bugungi aniq maqsadni kelishing 🎯\n\n` : '') + rows.map(r => `👤 ${T.b(r.name)}: yangi ${r.p.fresh.length} · 3+ kun ${T.b(r.p.stale.length)} · sinov natijasi yo‘q ${T.b(r.p.trials.length)} · turib qolgan ${r.p.slow.length}`).join('\n')
            + '\n\nMenejerlarga vazifalar 10:00 da yuborildi. Kim orqada qolsa — qo‘llab yuboring 🤝';
        const events = require('./events');
        for (const rop of await require('./scheduler').roles(db, ['rop']))
            await events.privateMessage(db, `coach:rop:${clock.date}:${rop.telegramId}`, rop, text, { ...T.HTML, _setting: 'salesCoachEnabled', _expiresAt: new Date(now.getTime() + 6 * HOUR).toISOString() });
    });
}

async function realtime(db, now, clock, once) {
    const all = await load(db, now), names = await managers(db), t = now.getTime();
    const fire = async (key, managerId, text) => {
        let sent = false;
        await once(db, key, async () => { sent = await dm(db, key, managerId, text, now); });
        return sent;
    };
    for (const [id, leads] of byManager(all)) {
        const name = T.esc(T.first(names.get(id) || ''));
        // Yangi lid 15 daqiqa kutyapti (faqat oxirgi 24 soatda tushganlar — eski zaxira ertalabki rejada).
        const waiting = [];
        for (const l of leads) if (l.status === 'yangi-lidlar' && l.age >= 15 * 60000 && t - l.created < DAY) {
            const key = `coach-new:${l.id}`;
            if (!(await db.query('SELECT 1 FROM domwork_bot_jobs WHERE key=$1', [key])).rows.length) { await db.query('INSERT INTO domwork_bot_jobs(key) VALUES($1) ON CONFLICT DO NOTHING', [key]); waiting.push(l); }
        }
        if (waiting.length) await dm(db, `new:${waiting[0].id}:${t}`, id, `⚡ ${name}, ${waiting.length === 1 ? 'yangi lid' : T.b(waiting.length + ' ta yangi lid')} qo‘ng‘iroqni kutyapti!\n\n${list(waiting, l => `${line(l)} — ${ago(l.age)}dan beri`)}\n\nTez qo‘ng‘iroq — yuqori sotuv: mijoz hali issiq, sizni kutyapti 📞`, now);
        // 3 kundan oshdi — yumshoq eslatma: yana bir urinib ko'ring, olmasa Sifatsizga.
        const stale = [];
        for (const l of leads) if (isStale(l)) {
            const key = `coach-stale:${l.id}:${l.at}`;
            if (!(await db.query('SELECT 1 FROM domwork_bot_jobs WHERE key=$1', [key])).rows.length) { await db.query('INSERT INTO domwork_bot_jobs(key) VALUES($1) ON CONFLICT DO NOTHING', [key]); stale.push(l); }
        }
        if (stale.length) await dm(db, `stale:${stale[0].id}:${t}`, id, stale.length === 1
            ? `🙂 ${name}, ${line(stale[0])} ${ago(stale[0].age)}dan beri «Bog‘lanishga urinilmoqda»da turibdi.\n\nYana bir qo‘ng‘iroq qilib ko‘ring — balki bu safar olar? Telegramga qisqa xabar ham qoldiring 📲\nOlishmasa — <b>Sifatsiz lidlar</b>ga chiqaring, statistikamiz toza bo‘lsin 🧹`
            : `🙂 ${name}, ${T.b(stale.length + ' ta')} lid 3 kundan beri «Bog‘lanishga urinilmoqda»da turibdi:\n\n${list(stale, l => `${line(l)} — ${ago(l.age)}`)}\n\nHar biriga oxirgi marta qo‘ng‘iroq qilib ko‘ring. Olishmasa — <b>Sifatsiz lidlar</b>ga chiqaring, statistikani buzmasin 🧹`, now, 6);
        // Sinov darsi o'tdi (3 soat), lid hamon «Sinov darsida».
        for (const l of leads) if (trialPassed(l, now) && t - l.lesson < 3 * DAY) {
            await fire(`coach-trial:${l.id}:${l.booking?.id || l.lesson}`, id,
                `🧪 ${name}, ${line(l)} sinov darsi ${ago(t - l.lesson)} oldin bo‘ldi — natija nima bo‘ldi?\n\n📞 Gaplashdingizmi? Taassurotini so‘rang, savollariga javob bering.\n✅ Keyin CRMda harakatlaning: <b>Qaror jarayonida</b> / <b>To‘lov jarayonida</b> / yoki sababi bilan yoping.\n\nIssiq paytida gaplashilgan mijoz ko‘proq sotib oladi 🔥`);
            if (t - l.lesson >= DAY) await once(db, `coach-trial-rop:${l.id}:${l.booking?.id || l.lesson}`, async () => {
                const events = require('./events');
                for (const rop of await require('./scheduler').roles(db, ['rop']))
                    await events.privateMessage(db, `coach:trial-rop:${l.id}:${l.lesson}:${rop.telegramId}`, rop,
                        `⚠️ <b>Sinovdan keyin 1 kundan oshdi, natija yo‘q</b>\n👤 ${line(l)}\n💼 Menejer: ${T.esc(names.get(id) || '—')}\n\nIssiq lid sovib ketmasin — menejer bilan gaplashing 🙏`,
                        { ...T.HTML, _setting: 'salesCoachEnabled', _expiresAt: new Date(now.getTime() + 2 * HOUR).toISOString() });
            });
        }
    }
}

async function afternoon(db, now, clock, once) {
    const names = await managers(db);
    for (const [id, leads] of byManager(await load(db, now))) {
        const p = plan(leads, now);
        if (!p.stale.length && !p.trials.length) continue;
        await once(db, `coach-pm:${clock.date}:${id}`, () => dm(db, `pm:${clock.date}:${id}`, id,
            `⏰ ${T.esc(T.first(names.get(id) || ''))}, kun yakunigacha ozgina qoldi!\n\n`
            + (p.stale.length ? `🧹 3 kundan oshgan lidlar hali ${T.b(p.stale.length + ' ta')}: qo‘ng‘iroq → olishmasa Sifatsizga.\n` : '')
            + (p.trials.length ? `🧪 Sinov natijasi yozilmagan: ${T.b(p.trials.length + ' ta')} — gaplashib, CRMda bosqichini o‘zgartiring.\n` : '')
            + `\nErtaga toza ro‘yxat bilan boshlaymiz — bugun yopib qo‘ying 💪`, now, 4));
    }
}

// Maqtov: menejer eski/turib qolgan lid bo'yicha qaror qildi → «Barakalla! Yana N ta qoldi».
async function praise(db, now) {
    const cursor = (await db.query("SELECT value FROM domwork_bot_live_cursor WHERE name='coach_audit'")).rows[0];
    if (!cursor) {
        const max = (await db.query('SELECT COALESCE(MAX(id),0) AS m FROM lead_audit')).rows[0].m;
        await db.query("INSERT INTO domwork_bot_live_cursor VALUES('coach_audit',$1) ON CONFLICT DO NOTHING", [max]);
        return;
    }
    const rows = (await db.query('SELECT id,lead_id,action,actor_name,snapshot FROM lead_audit WHERE id>$1 ORDER BY id LIMIT 300', [cursor.value])).rows;
    if (!rows.length) return;
    await db.query("UPDATE domwork_bot_live_cursor SET value=$1 WHERE name='coach_audit'", [rows[rows.length - 1].id]);
    const done = new Map(), given = new Map();
    for (const r of rows) {
        const before = r.snapshot?.before, after = r.snapshot?.after || (r.action === 'created' ? r.snapshot : null);
        if (!after || after.language && after.language !== 'russian') continue;
        // Yangi biriktirish (ROP/admin bergan yoki tizim taqsimlagan) — menejerga darhol xabar.
        if (after.managerId && after.managerId !== (before?.managerId || '') && !['tolov-yopildi', 'sifatsiz-lidlar', 'muvaffaqiyatsiz-sotuv'].includes(stages.normalizeLeadStatus(after.status))) {
            if (!given.has(after.managerId)) given.set(after.managerId, []);
            given.get(after.managerId).push({ id: r.lead_id, name: after.name || 'Nomsiz', phone: after.phone || '', status: stages.normalizeLeadStatus(after.status), actor: String(r.actor_name || '').trim() });
        }
        if (!before) continue;
        const from = stages.normalizeLeadStatus(before.status), to = stages.normalizeLeadStatus(after.status);
        if (from === to || !after.managerId) continue;
        if (!(from === 'boglanishga-urinilmoqda' || SLOW[from] || from === 'sinov-darsida')) continue;
        if (!done.has(after.managerId)) done.set(after.managerId, []);
        done.get(after.managerId).push({ name: after.name, to });
    }
    const clock = require('./scheduler').localClock(now), awake = clock.hour >= 8 && clock.hour < 21;
    if (awake) for (const [id, leads] of given) {
        const by = [...new Set(leads.map(l => l.actor).filter(Boolean))].join(', ');
        await dm(db, `given:${id}:${rows[0].id}`, id, `📥 <b>Sizga ${leads.length === 1 ? 'yangi lid' : leads.length + ' ta yangi lid'} biriktirildi</b>${by ? ' · ' + T.esc(by) : ''}\n\n`
            + list(leads, l => `${line(l)}${l.status !== 'yangi-lidlar' ? ' — ' + T.esc(label(l.status)) : ''}`, 30)
            + `\n\n📞 Darhol qo‘ng‘iroq qiling — mijoz hali issiq! Gaplashgach, CRMda bosqichini o‘zgartiring ✅`, now, 3);
        for (const l of leads) await db.query('INSERT INTO domwork_bot_jobs(key) VALUES($1) ON CONFLICT DO NOTHING', [`coach-given:${l.id}`]);
    }
    if (!done.size) return;
    const all = await load(db, now), names = await managers(db), bucket = Math.floor(now.getTime() / (15 * 60000));
    for (const [id, items] of done) {
        const mine = all.filter(l => l.manager === id), p = plan(mine, now);
        const left = [...p.stale, ...p.trials];
        const did = items.length === 1 ? `${T.b(items[0].name)} bo‘yicha qaror qildingiz (${T.esc(label(items[0].to))})` : `${T.b(items.length + ' ta')} lid bo‘yicha qaror qildingiz`;
        const text = `👏 <b>Barakalla, ${T.esc(T.first(names.get(id) || ''))}!</b> ${did}.\n\n`
            + (left.length
                ? `Yana shunday ${T.b(left.length + ' ta')} lid qoldi:\n${list(left, l => `${line(l)} — ${l.status === 'sinov-darsida' ? 'sinov natijasi' : ago(l.age)}`, 10)}\n\nQo‘ng‘iroq qiling va CRMda harakatlaning: olishmasa — Sifatsizga, gaplashsangiz — keyingi bosqichga. Siz uddalaysiz 💪`
                : `🏆 Barcha eski lidlar tozalandi — ro‘yxat toza! Shunday davom eting 🚀`);
        const key = `coach-praise:${id}:${bucket}`;
        const exists = (await db.query('SELECT 1 FROM domwork_bot_jobs WHERE key=$1', [key])).rows.length;
        if (exists) continue; // 15 daqiqada bir marta — har bosishda emas
        await db.query('INSERT INTO domwork_bot_jobs(key) VALUES($1) ON CONFLICT DO NOTHING', [key]);
        await dm(db, `praise:${id}:${bucket}`, id, text, now);
    }
}

// ── ROP uchun: jamoani boshqarish xabarlari ─────────────────────────────────
async function toRop(db, key, text, now, hours = 3) {
    const events = require('./events');
    for (const rop of await require('./scheduler').roles(db, ['rop']))
        await events.privateMessage(db, `coach:rop-${key}:${rop.telegramId}`, rop, text,
            { ...T.HTML, _setting: 'salesCoachEnabled', _expiresAt: new Date(now.getTime() + hours * HOUR).toISOString() });
}
// Bugungi ko'rsatkichlar menejerlar kesimida (dailyReports bilan bir xil manba): harakat, sinovga, sotuv, tushum.
async function team(db, now, clock) {
    const D = require('./dailyReports'), day = await D.salesDay(db, clock.date);
    const by = byManager(await load(db, now)), out = [];
    for (const person of day.people) {
        const tr = await D.transitions(db, clock.date, person.id).catch(() => ({}));
        const p = plan(by.get(person.id) || [], now);
        out.push({ ...person, trials: Number(tr?.['sinov-darsida']) || 0, waiting: p.fresh.length, stale: p.stale.length, noResult: p.trials.length });
    }
    return { day, people: out };
}
function weakest(people) {
    if (people.length < 2) return [];
    const avg = people.reduce((s, p) => s + p.processed, 0) / people.length;
    return people.filter(p => avg >= 4 && p.processed < avg * 0.5).map(p => ({ ...p, avg: Math.round(avg) }));
}
const row = p => `👤 ${T.b(p.name)}: ishlagan ${T.b(p.processed)} lid · sinovga ${p.trials} · sotuv ${T.b(p.sales)}${p.day ? ' (' + T.esc(T.sum(p.day)) + ')' : ''}${p.waiting ? ` · ⏳ kutyapti ${p.waiting}` : ''}${p.stale ? ` · 🧹 eski ${p.stale}` : ''}`;
function callToAction(w) {
    return w.map(p => `📣 ${T.b(p.name)} bilan gaplashing: bugun atigi ${T.b(p.processed + ' ta')} lid bilan ishladi (jamoada o‘rtacha ${p.avg}).`
        + (p.waiting ? ` Unda ${T.b(p.waiting + ' ta')} yangi lid qo‘ng‘iroq kutyapti.` : '') + (p.stale ? ` ${p.stale} ta eski lid tozalanmagan.` : '')
        + ' Nima to‘sqinlik qilyapti — so‘rab, birga reja tuzing 🤝').join('\n\n');
}
async function ropPulse(db, now, clock, once, tag) {
    await once(db, `coach-pulse:${clock.date}:${tag}`, async () => {
        const t = await team(db, now, clock);
        if (!t.people.length) return;
        const people = [...t.people].sort((a, b) => b.processed - a.processed || b.sales - a.sales);
        const w = weakest(people), best = people[0];
        const text = `📊 <b>Sotuv pulsi · soat ${tag}</b>\n\n${people.map(row).join('\n')}\n\n💰 Bugun: ${T.b(T.sum(t.day.day))} · ${t.day.sales} ta sotuv`
            + (best?.processed ? `\n🏅 Eng faol: ${T.b(best.name)} — ${best.processed} ta lid` : '')
            + (w.length ? `\n\n${callToAction(w)}` : people.every(p => !p.processed) ? `\n\n⚠️ Bugun jamoada hali CRMda harakat ko‘rinmayapti — menejerlarni bir tekshirib chiqing 📞` : `\n\n✅ Jamoa bir maromda ishlayapti — shunday davom!`);
        await toRop(db, `pulse:${clock.date}:${tag}`, text, now);
    });
}
// 11:30 — bugun CRMda bitta ham lid bilan ishlamagan menejer (ishi bor bo'lsa).
async function ropInactive(db, now, clock, once) {
    await once(db, `coach-idle:${clock.date}`, async () => {
        const t = await team(db, now, clock), idle = t.people.filter(p => !p.processed && (p.waiting || p.stale || p.noResult));
        if (!idle.length) return;
        await toRop(db, `idle:${clock.date}`, `🔕 <b>Soat 11:30 — hali CRMda harakat yo‘q</b>\n\n${idle.map(p => `👤 ${T.b(p.name)} — ${p.waiting} ta yangi lid kutyapti${p.stale ? `, ${p.stale} ta eski` : ''}${p.noResult ? `, ${p.noResult} ta sinov natijasi` : ''}`).join('\n')}\n\nIshga kirishdimi? Qo‘ng‘iroq qilib bilib oling 📞`, now);
    });
}
// Yangi lid 30 daqiqadan beri qo'ng'iroqsiz — ROPga (CRM SLA qoidasi bilan bir xil).
async function ropSpeed(db, now) {
    const t = now.getTime(), names = await managers(db), late = [];
    for (const l of await load(db, now)) if (l.status === 'yangi-lidlar' && l.age >= 30 * 60000 && t - l.created < DAY) {
        if ((await db.query('INSERT INTO domwork_bot_jobs(key) VALUES($1) ON CONFLICT DO NOTHING RETURNING key', [`coach-rop-speed:${l.id}`])).rows.length) late.push(l);
    }
    if (late.length) await toRop(db, `speed:${late[0].id}:${t}`, `🚨 <b>Yangi lid 30 daqiqadan beri qo‘ng‘iroqsiz</b>\n\n${list(late, l => `${line(l)} — ${T.esc(names.get(l.manager) || '—')}, ${ago(l.age)}`)}\n\nMenejerni tezlashtiring yoki lidni boshqasiga bering ⚡`, now, 2);
}
// ── Kunlik bonuslar (CRM Reyting → Bonuslar: Obed / Obed+30 / Obed+60, chegaralari bonusData'dan) ──
const DAILY = [{ id: 'obed', label: 'Obed', threshold: 1800000 }, { id: 'obed30', label: 'Obed + 30,000', threshold: 2500000 }, { id: 'obed60', label: 'Obed + 60,000', threshold: 3000000 }];
async function tiers(db) {
    let stored = (await db.query("SELECT data FROM json_data WHERE key='bonusData'")).rows[0]?.data || {};
    if (typeof stored === 'string') { try { stored = JSON.parse(stored); } catch { stored = {}; } }
    return DAILY.map(b => ({ ...b, ...(stored[b.id] || {}) })).filter(b => Number(b.threshold) > 0).sort((a, b) => a.threshold - b.threshold);
}
const PUSH = [
    'Siz lidlar bilan bog‘lanmay o‘tirgan har daqiqada raqobatchilar mijozlaringizga qo‘ng‘iroq qilib, sotib qo‘yishyapti. Birinchi bo‘lib siz qo‘ng‘iroq qiling! 📞',
    'Mijoz bugun qaror qiladi — siz bilanmi yoki boshqa maktab bilan? Telefonni oling 💪',
    'Bugungi yo‘lkira va obedni naqd qilib keting — o‘tirmang, harakat qilaylik! 🍽',
    'Har bir qo‘ng‘iroq — bonusga bir qadam. Kutib o‘tirgan lid sovib qoladi ❄️ — hozir isitib oling 🔥',
    'Raqobatchilar uxlamayapti — ular ham shu mijozlarga yozishyapti. Tezlik yutadi ⚡',
    'Bugun kamida bitta sotuv — va obed sizniki! Kim birinchi? 🏁',
    'Qo‘ng‘iroqdan qo‘rqmang: eng yomoni — «yo‘q» deyishadi. Eng yaxshisi — bonus 😉',
    'Kechqurun «bugun ko‘proq qo‘ng‘iroq qilganimda edi» demaylik. Hozir harakat qilamiz! 🚀'
];
async function bonus(db, now, clock, once) {
    const list = await tiers(db);
    if (!list.length) return;
    const day = await require('./dailyReports').salesDay(db, clock.date), slot = ['09:30', '12:00', '15:00', '17:30'].find(t => {
        const [h, m] = t.split(':').map(Number); return clock.hour === h && clock.minute >= m && clock.minute < m + 3; });
    for (const p of day.people) {
        const got = list.filter(b => p.day >= b.threshold), next = list.find(b => p.day < b.threshold), name = T.esc(T.first(p.name));
        // Chegarani bosib o'tdi — darhol tabrik va keyingi pog'ona.
        for (const b of got) await once(db, `coach-bonus:${clock.date}:${p.id}:${b.id}`, () => dm(db, `bonus:${clock.date}:${p.id}:${b.id}`, p.id,
            `🍽🎉 <b>${name}, «${T.esc(b.label)}» bonusi sizniki!</b>\nBugungi sotuv: ${T.b(T.sum(p.day))}\n\n`
            + (next ? `Keyingisi — «${T.esc(next.label)}»: yana ${T.b(T.sum(next.threshold - p.day))}. To‘xtamang! 🚀` : `Bugungi eng yuqori bonus olindi — siz bugun yulduz! ⭐`), now, 4));
        if (!slot || !next) continue;
        await once(db, `coach-bonus-push:${clock.date}:${p.id}:${slot}`, () => dm(db, `bonus-push:${clock.date}:${p.id}:${slot}`, p.id,
            (slot === '09:30'
                ? `☕ ${name}, bugungi bonuslar:\n${list.map(b => `🍽 ${T.b(b.label)} — ${T.esc(T.sum(b.threshold))} sotuv`).join('\n')}\n\n`
                : `⏱ ${name}, soat ${slot}. Bugun: ${T.b(T.sum(p.day))} · «${T.esc(next.label)}»gacha yana ${T.b(T.sum(next.threshold - p.day))}\n\n`)
            + T.pick(PUSH, clock.date + p.id + slot), now, 3));
    }
}
// Oy rejasi sur'ati: kunlar o'tishiga nisbatan sezilarli orqada qolganlar.
function pace(people, date) {
    const [y, m, d] = date.split('-').map(Number), days = new Date(Date.UTC(y, m, 0)).getUTCDate(), expected = d / days;
    return people.filter(p => p.plan > 0).map(p => ({ ...p, pct: p.month / p.plan, expected }))
        .filter(p => p.pct < expected * 0.7).sort((a, b) => a.pct - b.pct);
}

async function run(db, settings, clock, now, once) {
    if (!settings.salesCoachEnabled) return;
    await praise(db, now); // biriktirish xabari yakshanba ham ishlaydi (08–21)
    if (clock.day === 7) return; // yakshanba — dam
    const work = clock.hour >= 9 && clock.hour < 20;
    if (work) await ropSpeed(db, now);
    if (clock.hour >= 9 && clock.hour < 21 && clock.minute % 2 === 0) await bonus(db, now, clock, once);
    if (clock.hour === 11 && clock.minute >= 30 && clock.minute < 35) await ropInactive(db, now, clock, once);
    if (clock.hour === 13 && clock.minute < 5) await ropPulse(db, now, clock, once, '13:00');
    if (clock.hour === 18 && clock.minute < 5) await ropPulse(db, now, clock, once, '18:00');
    if (clock.hour === 10 && clock.minute < 5) await morning(db, now, clock, once);
    if (clock.hour === 10 && clock.minute >= 5 && clock.minute < 10) await ropDigest(db, now, clock, once);
    if (clock.hour === 16 && clock.minute < 5) await afternoon(db, now, clock, once);
    // Real vaqt eslatmalari 10:00 rejasidan keyin (ertalab bir xil narsa ikki marta kelmasin).
    if (work && (clock.hour > 10 || clock.minute >= 10)) await realtime(db, now, clock, once);
}

module.exports = { init, run, plan, load, enteredAt, morning, realtime, praise, afternoon, ropDigest, ropPulse, ropInactive, ropSpeed, team, weakest, pace, bonus, tiers };
