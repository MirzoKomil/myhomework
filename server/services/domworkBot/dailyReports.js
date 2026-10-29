'use strict';
// Kunlik hisobotlar (sotuv, marketing, admin) — bitta to'g'ri manbadan, HTML ko'rinishda.
// Qoidalar: bekor qilingan (payment_record_voids) va tekshiruvdagi (legacy_review) tushumlar hisobga olinmaydi —
// maosh hisobi bilan bir xil. "Bugun" — Toshkent sanasi. Bosqich o'tishlari lead_audit snapshotlaridan olinadi
// (joriy holat emas), shuning uchun "bugun sinovga yozildi" haqiqatan bugungi o'zgarish.
const T = require('./tone');
const policy = require('./policy');
const R = require('../../../js/attendanceRules');
const SALES_ROLES = "('sotuv-menejeri','sotuv_menejeri','sotuv menejeri','sales_manager')";
async function validReceipt(db, alias = 'p') {
    const t = (await db.query(`SELECT to_regclass('payment_record_voids') AS v,
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='payment_records' AND column_name='legacy_review') AS l`)).rows[0];
    return [t.l ? `NOT ${alias}.legacy_review` : 'TRUE', t.v ? `NOT EXISTS (SELECT 1 FROM payment_record_voids v WHERE v.record_id=${alias}.id)` : ''].filter(Boolean).join(' AND ');
}
// Jamoa oylik rejasi: CRMda tasdiqlangan sotuv rejasi (Moliya → reja tasdig'i) bo'lsa — shu, aks holda menejerlarning shaxsiy rejalari yig'indisi.
async function confirmedPlan(db, date) {
    try {
        const period = policy.monthPeriod(new Date(date + 'T12:00:00Z'));
        const row = (await db.query(`SELECT amount FROM salary_plan_confirmations WHERE language='russian' AND period_start=$1::date AND period_end=$2::date`, [period.start, period.end])).rows[0];
        const current = require('../../../js/payrollEngine').salesPlan({ salesPlan: await json(db, 'salesPlan') }, 'russian', { ...period, days: Number(period.end.slice(8)) });
        return Number(row?.amount) === current ? Number(current) || 0 : 0;
    } catch { return 0; }
}
const shift = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// Oyning qolgan ish kunlari (dushanba–shanba), ertadan boshlab.
function workdaysLeft(date) {
    const end = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).toISOString().slice(0, 10);
    let n = 0; for (let d = shift(date, 1); d <= end; d = shift(d, 1)) if (new Date(d + 'T12:00:00Z').getUTCDay() !== 0) n++;
    return n;
}
async function json(db, key) {
    const raw = (await db.query('SELECT data FROM json_data WHERE key=$1', [key])).rows[0]?.data;
    if (typeof raw !== 'string') return raw || {};
    try { return JSON.parse(raw); } catch { return {}; }
}
async function managers(db) {
    return (await db.query(`SELECT id,name,login FROM hr_employees WHERE role IN ${SALES_ROLES}
        AND (lang='russian' OR lang='both') AND COALESCE(status,'active')<>'inactive' ORDER BY name`)).rows;
}
// Bugungi bosqich o'tishlari (lid shu bosqichga bugun o'tgan) — lead_audit bo'yicha.
async function transitions(db, date, managerId = null) {
    const rows = (await db.query(`SELECT COALESCE(a.snapshot->'after',a.snapshot)->>'status' AS status, COUNT(DISTINCT a.lead_id)::int AS n
        FROM lead_audit a JOIN leads l ON l.id=a.lead_id
        WHERE l.language='russian' AND (a.created_at AT TIME ZONE 'Asia/Tashkent')::date=$1::date
        AND COALESCE(a.snapshot->'after',a.snapshot)->>'status' IS DISTINCT FROM a.snapshot->'before'->>'status'
        AND ($2::text IS NULL OR COALESCE(a.snapshot->'after',a.snapshot)->>'managerId'=$2)
        GROUP BY 1`, [date, managerId])).rows;
    return Object.fromEntries(rows.map(r => [r.status, r.n]));
}
async function salesDay(db, date) {
    const ok = await validReceipt(db), month = date.slice(0, 7) + '-01';
    const mgrs = await managers(db);
    const pay = (await db.query(`SELECT p.id,p.manager_id,p.amount,p.source_key,
            (p.source_key LIKE 'lead:%' AND NOT EXISTS (SELECT 1 FROM payment_records q WHERE q.id<>p.id AND q.lead_id=p.lead_id AND q.source_key LIKE 'lead:%'
                AND NOT q.legacy_review AND (q.created_at<p.created_at OR (q.created_at=p.created_at AND q.id<p.id)))) AS is_sale,
            TO_CHAR(p.paid_date,'YYYY-MM-DD') AS d
        FROM payment_records p WHERE p.language='russian' AND ${ok} AND p.paid_date BETWEEN $1::date AND $2::date`, [month, date])).rows;
    const plans = await json(db, 'individualSalesPlans');
    const staff = require('./staff');
    const processed = new Map((await db.query(`SELECT h.id,COUNT(DISTINCT a.lead_id)::int AS n FROM hr_employees h
        JOIN users u ON LOWER(TRIM(u.email))=LOWER(TRIM(h.login)) OR u.id IN (SELECT user_id FROM user_sales_manager_links WHERE manager_id=h.id)
        JOIN lead_audit a ON a.actor_id=u.id JOIN leads l ON l.id=a.lead_id AND l.language='russian'
        WHERE h.role IN ${SALES_ROLES} AND (a.created_at AT TIME ZONE 'Asia/Tashkent')::date=$1::date GROUP BY h.id`, [date])).rows.map(r => [r.id, r.n]));
    const people = mgrs.map(m => {
        const mine = pay.filter(p => p.manager_id === m.id), today = mine.filter(p => p.d === date);
        const plan = Number(staff.personalPlan(plans, m.id, date.slice(0, 7))?.totalAmount) || 0;
        return { id: m.id, name: m.name, day: today.reduce((s, p) => s + Number(p.amount), 0), payments: today.length, sales: today.filter(p => p.is_sale).length,
            month: mine.reduce((s, p) => s + Number(p.amount), 0), plan, processed: processed.get(m.id) || 0 };
    }).sort((a, b) => b.day - a.day || b.month - a.month);
    const today = pay.filter(p => p.d === date);
    const plan = (await confirmedPlan(db, date)) || people.reduce((s, p) => s + p.plan, 0), monthSum = pay.reduce((s, p) => s + Number(p.amount), 0);
    const newLeads = Number((await db.query(`SELECT COUNT(*) AS n FROM leads WHERE language='russian' AND deleted_at IS NULL
        AND (created_at AT TIME ZONE 'Asia/Tashkent')::date=$1::date`, [date])).rows[0].n) || 0;
    const tr = await transitions(db, date);
    const trialsDone = (await db.query(`SELECT extra_data->'trialRequest' AS t FROM leads WHERE language='russian' AND deleted_at IS NULL
        AND LEFT(extra_data->'trialRequest'->>'completedAt',10) IS NOT NULL`)).rows
        .filter(r => r.t?.completedAt && policy.today(new Date(r.t.completedAt)) === date);
    const students = (await db.query(`SELECT extra_data FROM students WHERE subject='russian' AND COALESCE(extra_data->>'isStaffDemo','false')<>'true'`)).rows
        .filter(r => R.isActiveStudent(r));
    const overdue = students.filter(r => Number(r.extra_data?.debtAmount) > 0 && /^\d{4}-\d{2}-\d{2}/.test(r.extra_data?.paymentDueDate || '') && String(r.extra_data.paymentDueDate).slice(0, 10) < date);
    return { date, day: today.reduce((s, p) => s + Number(p.amount), 0), payments: today.length, sales: today.filter(p => p.is_sale).length,
        monthSum, plan, left: workdaysLeft(date), people, leads: { fresh: newLeads, contacted: tr['boglanildi'] || 0, trial: tr['sinov-darsida'] || 0,
            trialDone: trialsDone.filter(r => r.t.attended === true).length, trialMissed: trialsDone.filter(r => r.t.attended === false).length, won: tr['tolov-yopildi'] || 0 },
        overdue: { count: overdue.length, sum: overdue.reduce((s, r) => s + Number(r.extra_data.debtAmount), 0) } };
}
const MEDALS = ['🥇', '🥈', '🥉'];
const short = name => { const [a, b] = String(name || '').trim().split(/\s+/); return b ? `${a} ${b[0]}.` : (a || '—'); };
const pct = (a, b) => b > 0 ? Math.floor(a / b * 100) + '%' : '—';
function salesText(r, { group = false } = {}) {
    const lines = [`📊 <b>Sotuv bo‘limi — kun yakuni</b>`, `📅 ${T.when(r.date)}`, ''];
    lines.push(r.payments ? `💰 <b>Bugun: ${T.esc(T.sum(r.day))}</b> · ${r.payments} ta to‘lov` : '💰 <b>Bugun to‘lov bo‘lmadi</b>');
    if (r.payments) lines.push(`🆕 Yangi sotuv: ${T.b(r.sales)} · 💳 Bo‘lib to‘lash va qarz: ${r.payments - r.sales}`);
    lines.push(`📆 Oy: ${T.b(T.sum(r.monthSum))}${r.plan > 0 ? ` · reja ${T.b(pct(r.monthSum, r.plan))}` : ''}`);
    if (r.plan > r.monthSum) lines.push(`🎯 Qoldi ${T.esc(T.sum(r.plan - r.monthSum))}${r.left ? ` · kuniga ~${T.esc(T.sum(Math.ceil((r.plan - r.monthSum) / r.left / 1000) * 1000))} kerak (${r.left} ish kuni)` : ''}`);
    else if (r.plan > 0) lines.push('🎉 <b>Oylik reja bajarildi!</b>');
    const L = r.leads;
    lines.push('', `👥 <b>Lidlar bugun</b>`, `Yangi ${T.b(L.fresh)} · bog‘lanildi ${L.contacted} · sinovga yozildi ${L.trial}`,
        `Sinov o‘tdi ${L.trialDone}${L.trialMissed ? ` · kelmadi ${L.trialMissed}` : ''} · yopildi ${T.b(L.won)}`);
    if (r.people.length) {
        lines.push('', '🏆 <b>Menejerlar</b>');
        r.people.forEach((p, n) => lines.push(`${p.day > 0 ? (MEDALS[n] || `${n + 1}.`) : '▫️'} ${T.b(short(p.name))} — `
            + (p.day > 0 ? `${T.esc(T.sum(p.day))}${p.sales ? ` (${p.sales} sotuv)` : ''}` : '0')
            + (p.processed ? ` · ${p.processed} lid` : '') + (p.plan > 0 ? ` · oy ${pct(p.month, p.plan)}` : '')));
    }
    if (r.overdue.count) lines.push('', `⏳ Muddati o‘tgan qarz: ${T.b(r.overdue.count + ' o‘quvchi')}${group ? '' : ` · ${T.esc(T.sum(r.overdue.sum))}`}`);
    lines.push('', T.i(r.day > 0 ? 'Bugungi mehnat uchun rahmat! Ertaga yanada kuchliroq 💪' : 'Ertaga yangi imkoniyat — birinchi qo‘ng‘iroqni ertalab qilamiz 📞'));
    return lines.join('\n');
}
// Lid sifati — CRM "Sifatli lidlar statistikasi" (js/app.js isSifatsizLeadForQualityStats) bilan bir xil qoida:
// to'lovga o'tgan — sifatli; "Sifatsiz lidlar" ustuni yoki 21 yoshdan kichik — sifatsiz;
// "Bog'lanishga urinilmoqda"da 4 kundan kam turgan — sifatsiz; qolganlari sifatli.
function leadAge(x) {
    for (const v of [x?.connectedSurvey?.age, x?.survey?.age, x?.leadSurvey?.age, x?.age]) { const n = Number(v); if (Number.isFinite(n) && n > 0) return n; }
    return null;
}
function lowQuality(lead, today) {
    const st = lead.status;
    if (st === 'tolov-jarayonida' || st === 'tolov-yopildi') return false;
    if (st === 'sifatsiz-lidlar') return true;
    const age = leadAge(lead.extra);
    if (age !== null && age < 21) return true;
    if (st === 'boglanishga-urinilmoqda') { const days = Math.round((Date.parse(today) - Date.parse(lead.day)) / 86400000); return days < 4; }
    return false;
}
const isTarget = l => l.lead_type === 'target' || /target|reklama|ads/i.test(l.source || '');
function qualityOf(list, today) {
    const low = list.filter(l => lowQuality(l, today)).length;
    return { total: list.length, quality: list.length - low, low, fresh: list.filter(l => ['yangi-lidlar', 'boglanishga-urinilmoqda'].includes(l.status)).length,
        trial: list.filter(l => l.status === 'sinov-darsida').length, sold: list.filter(l => ['tolov-jarayonida', 'tolov-yopildi'].includes(l.status)).length };
}
async function marketingDay(db, date) {
    const month = date.slice(0, 7) + '-01', from = shift(date, -2);
    const rows = (await db.query(`SELECT id,status,lead_type,source,extra_data AS extra,
            TO_CHAR((created_at AT TIME ZONE 'Asia/Tashkent')::date,'YYYY-MM-DD') AS day
        FROM leads WHERE language='russian' AND deleted_at IS NULL
        AND (created_at AT TIME ZONE 'Asia/Tashkent')::date BETWEEN LEAST($1::date,$3::date)-1 AND $2::date`, [month, date, from])).rows;
    const target = rows.filter(isTarget), organic = rows.filter(l => !isTarget(l));
    const ads = require('../targetAds');
    const spendOf = a => a.known ? a.total : null;
    const entered = a => Object.keys(a.days || {}).length;
    const range = async (a, b) => ads.advertising(db, 'russian', a, b);
    const [dAds, d3Ads, mAds] = [await range(date, date), await range(from, date), await range(month, date)];
    const days = [from, shift(from, 1), date].map(d => ({ date: d, ...qualityOf(target.filter(l => l.day === d), date), spend: d3Ads.days[d] ? Number(d3Ads.days[d].budget) || 0 : null }));
    return { date, today: qualityOf(target.filter(l => l.day === date), date), yesterday: target.filter(l => l.day === shift(date, -1)).length,
        organic: organic.filter(l => l.day === date).length, cabinet: dAds.days[date]?.leadCount ?? null,
        spend: spendOf(dAds), three: { ...qualityOf(target.filter(l => l.day >= from && l.day <= date), date), spend: spendOf(d3Ads), days },
        month: { ...qualityOf(target.filter(l => l.day >= month && l.day <= date), date), spend: spendOf(mAds), plan: mAds.plan, from: month, days: Number(date.slice(8)), entered: entered(mAds) } };
}
function marketingText(m) {
    const usd = n => '$' + Number(n).toFixed(2);
    const q = (x, n) => x.total ? Math.round(n / x.total * 100) + '%' : '—';
    const cost = (spend, n) => spend != null && n ? usd(spend / n) : '—';
    const d = m.today, delta = m.yesterday ? Math.round((d.total - m.yesterday) / m.yesterday * 100) : null;
    const lines = ['📈 <b>Marketing — kun yakuni</b>', `📅 ${T.when(m.date)}`, '',
        `🎯 <b>Bugun: ${d.total} ta target lid</b>${delta != null ? ` (kecha ${m.yesterday}, ${delta >= 0 ? '▲' : '▼'}${Math.abs(delta)}%)` : ''}`,
        `✅ Sifatli: ${T.b(d.quality)} (${q(d, d.quality)}) · ❌ Sifatsiz: ${d.low} (${q(d, d.low)})`];
    if (d.fresh) lines.push(`⏳ Hali ishlanmagan: ${d.fresh} — sifat ertaga aniqlashadi`);
    lines.push(`💵 Reklamaga bugun: ${m.spend != null ? T.b(usd(m.spend)) : '<i>kiritilmagan</i>'}`, `💲 1 lid narxi: ${T.b(cost(m.spend, d.total))} · 1 sifatli lid: ${T.b(cost(m.spend, d.quality))}`);
    if (m.cabinet != null) lines.push(`📋 Reklama kabinetida: ${m.cabinet} lid → CRMga tushgani ${d.total}${m.cabinet > d.total ? ` (⚠️ ${m.cabinet - d.total} ta yo‘qolgan)` : ''}`);
    if (m.organic) lines.push(`🌐 Organik: ${m.organic}`);
    const t = m.three;
    lines.push('', '📊 <b>Oxirgi 3 kun</b>');
    for (const x of t.days) lines.push(`${T.dateOnly(x.date)}: ${x.total} lid · sifatli ${q(x, x.quality)}${x.spend != null ? ` · sarf ${usd(x.spend)}` : ''}${x.spend != null && x.total ? ` · 1 lid ${usd(x.spend / x.total)}` : ''}`);
    lines.push(`Jami: ${T.b(t.total)} lid · sifatli ${T.b(q(t, t.quality))}${t.spend != null ? ` · sarf ${usd(t.spend)}` : ''} · 1 lid ${T.b(cost(t.spend, t.total))} · 1 sifatli lid ${T.b(cost(t.spend, t.quality))}`);
    const miss3 = t.days.filter(x => x.spend == null).length;
    if (miss3 && t.spend != null) lines.push(`<i>⚠️ ${miss3} kun uchun sarf kiritilmagan — narxlar taxminan past chiqadi</i>`);
    const mo = m.month, plan = mo.plan;
    lines.push('', `📆 <b>Oy natijasi</b> (${T.dateOnly(mo.from)} — ${T.dateOnly(m.date)})`,
        `Target lidlar: ${T.b(mo.total)}${plan?.lidSoni ? ` / reja ${plan.lidSoni} (${Math.round(mo.total / plan.lidSoni * 100)}%)` : ''}`,
        `Sifatli: ${T.b(mo.quality)} (${q(mo, mo.quality)})${plan?.kvalLidPct != null ? ` · reja ${plan.kvalLidPct}%` : ''}`,
        `💵 Reklamaga jami: ${mo.spend != null ? T.b(usd(mo.spend)) : '<i>kiritilmagan</i>'}${plan?.budget ? ` / reja ${usd(plan.budget)}` : ''}${mo.spend != null ? ` · kuniga o‘rtacha ${usd(mo.spend / mo.days)}` : ''}`,
        `👥 Kuniga o‘rtacha ${(mo.total / mo.days).toFixed(1)} lid`,
        ...(mo.spend != null && mo.entered < mo.days ? [`<i>⚠️ Sarf ${mo.days} kundan ${mo.entered} tasiga kiritilgan</i>`] : []),
        `💲 1 lid narxi: ${T.b(cost(mo.spend, mo.total))} · 1 sifatli lid: ${T.b(cost(mo.spend, mo.quality))}`,
        `Sinovda: ${mo.trial} · Sotuvga yetdi: ${T.b(mo.sold)} (jami liddan ${q(mo, mo.sold)}, sifatlidan ${mo.quality ? Math.round(mo.sold / mo.quality * 100) + '%' : '—'})${mo.spend != null && mo.sold ? ` · 1 sotuv narxi ${T.b(usd(mo.spend / mo.sold))}` : ''}`);
    if (m.spend == null) lines.push('', '⚠️ Bugungi reklama sarfini CRM → Marketing → Target lidlar bo‘limiga kiriting — aks holda narxlar hisoblanmaydi.');
    return lines.join('\n');
}
async function adminText(db, date) {
    const s = await salesDay(db, date);
    const att = await require('./reports').attendance(db, 'main_attendance', date, date);
    const asst = await require('./reports').attendance(db, 'assistant_attendance', date, date);
    const lines = ['🧭 <b>Kun xulosasi — rahbar uchun</b>', `📅 ${T.when(date)}`, '',
        `💰 Tushum: ${T.b(T.sum(s.day))} · ${s.payments} to‘lov (${s.sales} yangi sotuv)`,
        `📆 Oy: ${T.b(T.sum(s.monthSum))}${s.plan > 0 ? ` · reja ${T.b(pct(s.monthSum, s.plan))}` : ''}`,
        `👥 Lidlar: yangi ${s.leads.fresh} · sinovga ${s.leads.trial} · yopildi ${T.b(s.leads.won)}`, '',
        `🎓 Asosiy darslar: qatnashdi ${T.b(att.attended)} · kelmadi ${att.absent}`,
        `🤝 Yordamchi aloqalar: ${T.b(asst.attended)}${asst.absent ? ` · bo‘lmadi ${asst.absent}` : ''}`];
    if (s.overdue.count) lines.push('', `⏳ Muddati o‘tgan qarz: ${T.b(s.overdue.count + ' o‘quvchi')} · ${T.esc(T.sum(s.overdue.sum))}`);
    const best = s.people.find(p => p.day > 0);
    if (best) lines.push('', `🏆 Kun yetakchisi: ${T.b(best.name)} — ${T.esc(T.sum(best.day))}`);
    return lines.join('\n');
}
module.exports = { validReceipt, workdaysLeft, salesDay, salesText, marketingDay, marketingText, adminText, transitions, lowQuality, qualityOf };
