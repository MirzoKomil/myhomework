'use strict';
// Qo'ng'iroq AI tahlili — statistika (Sotuv › Tahlil, Mening tahlilim, Bosh sahifa bloklari, targetolog lid sifati).
// Dizayn: "CRM — barcha dizaynlar" › qongiroq-komp/qongiroq-tel (QAT_K_umumiy, _menejerlar, _menejer, _men, _boshRop,
// _menBosh, _target; telefon T_rop, T_mening, T_target).
//
// Hammasi sof funksiyalar: kirish — analizlar (callAnalyses), lidlar, menejerlar, rejalar; chiqish — ekranga tayyor JSON.
// Qoidalar (HANDOFF-qongiroq-dizayn): ball 0–59 ZAIF / 60–79 O'RTA / 80–89 YAXSHI / 90+ A'LO. Menejer haftalik bali =
// 7 o'q (Ochilish, Ehtiyoj, Og'riq, Taqdimot, Narx, E'tiroz, Yopish) o'rtachasi × 10; 30 soniyadan qisqa va yozuvsiz
// qo'ng'iroqlar kirmaydi; "skript muammosi" ballni tushirmaydi. Qarzdorlik — taxminiy.

const AXES = ['ochilish', 'ehtiyoj', 'ogriq', 'taqdimot', 'narx', 'etiroz', 'yopish'];
const AXIS_LABEL = { ochilish: 'Ochilish', ehtiyoj: 'Ehtiyoj', ogriq: 'Ogʻriq', taqdimot: 'Taqdimot', narx: 'Narx', etiroz: 'Eʼtiroz', yopish: 'Yopish' };
// Skript bosqichlari (menejer profili): o'q → bosqich nomi.
const STAGE_LABEL = { ochilish: 'Ochilish va filtr', ehtiyoj: 'Ehtiyoj (vaziyat)', ogriq: 'Ogʻriq va jamlash', taqdimot: 'Taqdimot (≤90 son)', narx: 'Narx tartibi va jimlik', etiroz: 'Eʼtiroz va chegirma zinapoyasi', yopish: 'Aniq vaqt bilan yopish' };
const TYPE_LABEL = { birinchi: '1-qoʻngʻiroq', qayta: 'Qayta', sinovdan_keyin: 'Sinovdan keyin', tolov: 'Toʻlov', qarzdorlik: 'Qarzdorlik', eslatma: 'Eslatma' };
const VIOL_LABEL = { nasiyasiz_chegirma: 'Nasiyasiz chegirma', oylik_narx_oldindan: 'Oylik narxni oʻzi aytdi', boshida_chegirma: 'Boshida chegirma', ortiqcha_vada: 'Ortiqcha vaʼda' };
const LQ_LABEL = { yosh_talaba: 'Yoshi kichik / talaba', tasodifan: 'Tasodifan bosgan', bepul_deb: 'Bepul deb oʻylagan', rossiya_nasiya: 'Rossiyada, nasiya mos emas', notogri_raqam: 'Notoʻgʻri raqam', boshqa: 'Boshqa sabab' };
const STAGES = ['yangi-lidlar', 'boglanishga-urinilmoqda', 'boglanildi', 'sinov-darsida', 'qaror-jarayonida', 'tolov-jarayonida', 'tolov-yopildi'];
const SALE = new Set(['tolov-jarayonida', 'tolov-yopildi']);
const PACKAGE_DEFAULT = 2100000; // Standard paket — "qo'ldan ketgan" bahosi uchun (lidda tarif bo'lmasa)
const DAY = 86400000;

const tk = ms => new Date(ms + 5 * 3600000); // Toshkent vaqti (UTC+5) — getUTC* bilan o'qiladi
const dayKey = ms => tk(ms).toISOString().slice(0, 10);
// Hafta — dushanbadan (Toshkent).
function weekStart(ms) {
    const d = tk(ms); const wd = (d.getUTCDay() + 6) % 7;
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - wd) - 5 * 3600000;
}
const ddmm = ms => { const d = tk(ms); return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const round1 = v => Math.round(v * 10) / 10;
const avg = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const t = a => Date.parse(a.callAt || a.createdAt) || 0;

function gradeOf(s) {
    if (s == null) return null;
    if (s >= 90) return { key: 'alo', label: 'AʼLO' };
    if (s >= 80) return { key: 'yaxshi', label: 'YAXSHI' };
    if (s >= 60) return { key: 'orta', label: 'OʻRTA' };
    return { key: 'zaif', label: 'ZAIF' };
}
const graded = a => a && a.status === 'done' && a.result && a.result.gradable && a.result.score != null;

// O'qlar o'rtachasi (0–10, 1 kasr) va ball (o'rtacha × 10). O'qlari bo'lmagan eski natijada — ballar o'rtachasi.
function axesOf(list) {
    const ax = {};
    for (const k of AXES) {
        const v = list.map(a => a.result.axes?.[k]).filter(x => x != null && Number.isFinite(Number(x))).map(Number);
        ax[k] = v.length ? round1(avg(v)) : null;
    }
    const vals = AXES.map(k => ax[k]).filter(v => v != null);
    const score = vals.length ? Math.round(avg(vals) * 10) : (list.length ? Math.round(avg(list.map(a => a.result.score))) : null);
    return { axes: ax, score };
}
function weakest(ax) {
    let best = null;
    for (const k of AXES) if (ax[k] != null && (best == null || ax[k] < ax[best])) best = k;
    return best ? { key: best, label: AXIS_LABEL[best], value: ax[best] } : null;
}

// ── Lid holati ──────────────────────────────────────────────────────────────
const rank = l => Math.max(STAGES.indexOf(l?.status === 'new' ? 'yangi-lidlar' : l?.status), (Array.isArray(l?.stageHistory) ? l.stageHistory : []).reduce((m, h) => Math.max(m, STAGES.indexOf(h?.to)), -1));
const trialBooked = l => !!l && (rank(l) >= 3 || !!l.trialRequest || (Array.isArray(l.trialHistory) && l.trialHistory.length > 0));
const trialAttended = l => !!l && (l.trialRequest?.attended === true || (Array.isArray(l.trialHistory) && l.trialHistory.some(x => x && x.attended === true)) || rank(l) >= 4);
const paid = l => !!l && SALE.has(l.status);
const saleAmount = l => Number(l?.paymentClosedSurvey?.actualAmount || l?.paymentSurvey?.totalAmount || l?.paymentSurvey?.paidAmount) || 0;
const paidAt = l => { const h = (Array.isArray(l?.stageHistory) ? l.stageHistory : []).find(x => x && SALE.has(x.to)); return h ? Date.parse(h.at || h.changedAt || h.createdAt) || 0 : 0; };

// ── Asosiy hisob ────────────────────────────────────────────────────────────
// ctx: { analyses, leads: Map(id→lead), managers: Map(id→{name,avatar}), plans: [], from, to (ms), now, settings }
function inRange(list, from, to) { return list.filter(a => { const x = t(a); return x >= from && x < to; }); }

function teamKpis(list, leads, now) {
    const g = list.filter(graded);
    const done = list.filter(a => a.status === 'done' || a.status === 'skipped');
    const { axes, score } = axesOf(g);
    const first = g.filter(a => a.result.type === 'birinchi');
    const firstLeads = [...new Set(first.map(a => a.leadId))];
    const booked = firstLeads.filter(id => trialBooked(leads.get(id))).length;
    const attended = firstLeads.filter(id => trialAttended(leads.get(id))).length;
    const paidFirst = firstLeads.filter(id => paid(leads.get(id))).length;
    const calledLeads = [...new Set(g.map(a => a.leadId))];
    const sold = calledLeads.map(id => leads.get(id)).filter(paid);
    const viol = {};
    let violations = 0;
    g.forEach(a => (a.result.violations || []).forEach(v => { violations++; viol[v.kind || 'boshqa'] = (viol[v.kind || 'boshqa'] || 0) + 1; }));
    // Qo'ldan ketgan: qoida buzilgan yoki vaqtsiz yopilgan, 7 kun ichida to'lamagan lidlar · paket narxi × AI sotuv ehtimoli.
    let lost = 0;
    const seen = new Set();
    for (const a of g.slice().sort((x, y) => t(y) - t(x))) {
        if (seen.has(a.leadId)) continue; seen.add(a.leadId);
        const r = a.result, l = leads.get(a.leadId);
        const bad = (r.violations || []).length || (!r.nextStepAt && !['tolov', 'sinov_darsi'].includes(r.outcome));
        if (!bad || paid(l) || now - t(a) < 7 * DAY) continue;
        lost += (Number(l?.paymentSurvey?.totalAmount) || PACKAGE_DEFAULT) * (r.saleProbability != null ? r.saleProbability / 100 : 0.3);
    }
    return {
        analyzed: done.length, graded: g.length, score, grade: gradeOf(score), axes,
        firstCalls: firstLeads.length, trialBooked: booked, trialAttended: attended, paidFromFirst: paidFirst,
        trialPct: firstLeads.length ? Math.round(booked / firstLeads.length * 100) : null,
        sales: { count: sold.length, amount: sold.reduce((s, l) => s + saleAmount(l), 0) },
        violations, violationsByKind: Object.entries(viol).sort((a, b) => b[1] - a[1]).map(([kind, n]) => ({ kind, label: VIOL_LABEL[kind] || kind, count: n })),
        lost: Math.round(lost / 100000) * 100000,
    };
}

// Haftalik ballar (oxirgi n hafta, dushanbadan). byManager: { id: [ball|null…] }.
function weeklySeries(analyses, now, n = 6) {
    const cur = weekStart(now);
    const weeks = Array.from({ length: n }, (_, i) => cur - (n - i) * 7 * DAY); // tugagan haftalar
    const team = [], byManager = {};
    const g = analyses.filter(graded);
    weeks.forEach((w, i) => {
        const wl = g.filter(a => t(a) >= w && t(a) < w + 7 * DAY);
        team.push(axesOf(wl).score);
        const ids = [...new Set(wl.map(a => a.managerId).filter(Boolean))];
        ids.forEach(id => { (byManager[id] = byManager[id] || Array(n).fill(null))[i] = axesOf(wl.filter(a => a.managerId === id)).score; });
    });
    return { labels: weeks.map(ddmm), weeks, team, byManager };
}

function planLabel(plan) {
    if (!plan) return null;
    if (plan.status === 'pending') return { text: `${plan.kind === 'mini' ? 'Mini-reja' : 'Reja'}: ${plan.focusLabel || ''} · tasdiq kutilmoqda`, tone: 'o' };
    if (plan.status === 'active') {
        const w = plan.weeks?.findIndex(x => x.status === 'current');
        const failed = (plan.weeks || []).some(x => x.status === 'failed');
        return { text: `${plan.kind === 'mini' ? 'Mini-reja' : `${plan.cycle || 1}-tsikl`} · ${w >= 0 ? w + 1 : 1}/${plan.weeks?.length || 1}${failed ? ' · natijasiz hafta bor' : ''}`, tone: failed ? 'z' : 'y' };
    }
    if (plan.status === 'decision') return { text: `${plan.cycle || 2}-tsikl natijasiz · admin qarori`, tone: 'z' };
    return null;
}

function managerRows(analyses, leads, managers, plans, from, to, now, weekly) {
    const list = inRange(analyses, from, to);
    const prevList = inRange(analyses, from - (to - from), from);
    const ids = [...new Set(list.concat(prevList).map(a => a.managerId).filter(Boolean))];
    const rows = ids.map(id => {
        const mine = list.filter(a => a.managerId === id);
        const k = teamKpis(mine, leads, now);
        const prev = axesOf(prevList.filter(a => a.managerId === id && graded(a))).score;
        const plan = (plans || []).filter(p => p.managerId === id && ['pending', 'active', 'decision'].includes(p.status)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] || null;
        const m = managers.get(id) || {};
        return {
            id, name: m.name || 'Menejer', avatar: m.avatar || '', score: k.score, grade: k.grade, delta: k.score != null && prev != null ? k.score - prev : null,
            spark: weekly.byManager[id] || [], analyzed: k.graded, trialPct: k.trialPct, sales: k.sales, violations: k.violations,
            weakest: weakest(k.axes), axes: k.axes, plan: plan ? { id: plan.id, kind: plan.kind, status: plan.status, ...planLabel(plan) } : null,
            planHint: !plan && k.score != null && k.score < 70 ? { text: `Kuzatuvda · 1-hafta <70`, tone: 'y' } : null,
        };
    }).filter(r => r.analyzed > 0 || r.score != null);
    rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return rows;
}

const shortMgr = n => String(n || '').split(/\s+/)[0] || '';
const shortLead = n => { const w = String(n || '').trim().split(/\s+/); return w.length > 1 ? `${w[0]} ${w[1][0]}.` : (w[0] || 'Lid'); };
function alerts(analyses, leads, managers, plans, now) {
    const out = [];
    const recent = analyses.filter(a => now - t(a) < 14 * DAY);
    const latestByLead = new Map();
    recent.forEach(a => { const p = latestByLead.get(a.leadId); if (!p || t(a) > t(p)) latestByLead.set(a.leadId, a); });
    for (const a of latestByLead.values()) {
        if (!graded(a)) continue;
        const r = a.result, l = leads.get(a.leadId);
        if (paid(l)) continue;
        const mgr = shortMgr(managers.get(a.managerId)?.name);
        if ((r.outcome === 'tolov_vadasi' || r.type === 'tolov') && now - t(a) > DAY) {
            out.push({ kind: 'tolov', tone: 'z', label: 'Toʻlov', title: `${shortLead(l?.name)} · ${fmtMln(Number(l?.paymentSurvey?.totalAmount) || PACKAGE_DEFAULT)}${r.nextStepAt ? ` · vaʼda ${r.nextStepAt} oʻtdi` : ' · vaʼda oʻtdi'}`, sub: mgr, leadId: a.leadId, callId: a.id, at: t(a) });
        } else if (r.type === 'sinovdan_keyin' && (r.saleProbability || 0) >= 50 && now - t(a) > 5 * 3600000 && now - t(a) < 72 * 3600000) {
            out.push({ kind: 'sovuq', tone: 'y', label: 'Sovuyapti', title: `${shortLead(l?.name)} · ehtimol ${r.saleProbability}% · sinovdan ${Math.round((now - t(a)) / 3600000)} soat`, sub: mgr, leadId: a.leadId, callId: a.id, at: t(a) });
        }
    }
    analyses.filter(a => a.appeal?.status === 'pending').forEach(a => {
        const left = Math.max(0, Math.ceil((Date.parse(a.appeal.at) + 24 * 3600000 - now) / 3600000));
        out.push({ kind: 'etiroz', tone: 'p', label: 'Eʼtiroz', title: `${shortMgr(managers.get(a.managerId)?.name)} · ${shortLead(leads.get(a.leadId)?.name)} · ROP qaroriga ${left} soat`, callId: a.id, at: Date.parse(a.appeal.at) });
    });
    (plans || []).filter(p => p.status === 'pending').forEach(p => out.push({ kind: 'reja', tone: 'o', label: p.kind === 'mini' ? 'Mini-reja' : 'Reja', title: `${shortMgr(managers.get(p.managerId)?.name)} · tasdiqlash kutilmoqda`, planId: p.id, at: Date.parse(p.createdAt) }));
    const order = { tolov: 0, etiroz: 1, reja: 2, sovuq: 3 };
    return out.sort((a, b) => order[a.kind] - order[b.kind] || b.at - a.at);
}

const fmtMln = n => { n = Number(n) || 0; return n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',').replace(/,0$/, '')} mln` : `${Math.round(n / 1000)} ming`; };

// AI xulosa (hisobdan, model chaqirilmaydi): eng zaif 2 bosqich va 80+ / <60 qo'ng'iroqlardagi sinovga yozilish farqi.
function summary(list, leads, kpis) {
    const ax = kpis.axes;
    const weak = AXES.filter(k => ax[k] != null).sort((a, b) => ax[a] - ax[b]).slice(0, 2).map(k => AXIS_LABEL[k]);
    const first = list.filter(a => graded(a) && a.result.type === 'birinchi');
    const pct = arr => { const ids = [...new Set(arr.map(a => a.leadId))]; return ids.length ? Math.round(ids.filter(id => trialBooked(leads.get(id))).length / ids.length * 100) : null; };
    const hi = pct(first.filter(a => a.result.score >= 80)), lo = pct(first.filter(a => a.result.score < 60));
    return { weak, hiPct: hi, loPct: lo };
}

function team(ctx) {
    const { analyses, leads, managers, plans, from, to, now } = ctx;
    const list = inRange(analyses, from, to);
    const prev = inRange(analyses, from - (to - from), from);
    const k = teamKpis(list, leads, now);
    const kp = teamKpis(prev, leads, now);
    const weekly = weeklySeries(analyses, now);
    const rows = managerRows(analyses, leads, managers, plans, from, to, now, weekly);
    const heat = rows.map(r => ({ id: r.id, name: r.name, avatar: r.avatar, axes: r.axes, score: r.score, grade: r.grade }));
    return {
        kpis: { ...k, scoreDelta: k.score != null && kp.score != null ? k.score - kp.score : null },
        heat, teamAxes: k.axes, managers: rows, weekly,
        funnel: { first: k.firstCalls, booked: k.trialBooked, attended: k.trialAttended, paid: k.paidFromFirst },
        alerts: alerts(analyses, leads, managers, plans, now),
        summary: summary(list, leads, k),
        pendingAppeals: analyses.filter(a => a.appeal?.status === 'pending').length,
        pendingPlans: (plans || []).filter(p => p.status === 'pending').length,
    };
}

// Bitta menejer (ROP profili va "Mening tahlilim").
function manager(ctx, id) {
    const { analyses, leads, managers, plans, from, to, now } = ctx;
    const mine = analyses.filter(a => a.managerId === id);
    const list = inRange(mine, from, to), prev = inRange(mine, from - (to - from), from);
    const k = teamKpis(list, leads, now), kp = teamKpis(prev, leads, now);
    const teamK = teamKpis(inRange(analyses, from, to), leads, now);
    const weekly = weeklySeries(analyses, now);
    const all = managerRows(analyses, leads, managers, plans, from, to, now, weekly);
    const pos = all.findIndex(r => r.id === id);
    const g = list.filter(graded), gp = prev.filter(graded);
    // Bosqichlar: o'q × 10 = bajarilish %, o'tgan davrga nisbatan farq.
    const pa = axesOf(gp).axes;
    const stages = AXES.map(a => ({ key: a, label: STAGE_LABEL[a], pct: k.axes[a] != null ? Math.round(k.axes[a] * 10) : null, delta: k.axes[a] != null && pa[a] != null ? Math.round((k.axes[a] - pa[a]) * 10) : null }));
    // Takrorlanayotgan xatolar: vaqtsiz yopish, buzilishlar, og'riq so'ralmadi — misol bilan.
    const issues = [];
    const noTime = g.filter(a => !a.result.nextStepAt && !['tolov', 'sinov_darsi'].includes(a.result.outcome));
    if (noTime.length) issues.push({ kind: 'vaqtsiz', count: noTime.length, title: 'Vaqtsiz yopish', sub: `${g.length} dan ${noTime.length} tasida`, example: example(noTime[0], leads, 'yopish'), tone: 'r' });
    const vk = {};
    g.forEach(a => (a.result.violations || []).forEach(v => { (vk[v.kind] = vk[v.kind] || []).push({ a, v }); }));
    Object.entries(vk).sort((a, b) => b[1].length - a[1].length).slice(0, 2).forEach(([kind, arr]) => issues.push({ kind, count: arr.length, title: VIOL_LABEL[kind] || kind, sub: '', example: { ...example(arr[0].a, leads), t: arr[0].v.t || '' }, tone: 'o' }));
    const firstNoPain = g.filter(a => a.result.type === 'birinchi' && a.result.axes?.ogriq != null && a.result.axes.ogriq <= 4);
    if (firstNoPain.length) issues.push({ kind: 'ogriq', count: firstNoPain.length, title: 'Ogʻriq soʻralmadi', sub: `${g.filter(a => a.result.type === 'birinchi').length} ta 1-qoʻngʻiroqdan ${firstNoPain.length} tasida`, example: example(firstNoPain[0], leads, 'ogriq'), tone: 'b' });
    const best = g.slice().sort((a, b) => b.result.score - a.result.score)[0] || null;
    const byType = Object.keys(TYPE_LABEL).filter(x => x !== 'eslatma').map(tp => { const arr = g.filter(a => a.result.type === tp); const s = arr.length ? Math.round(avg(arr.map(a => a.result.score))) : null; return { type: tp, label: TYPE_LABEL[tp], count: arr.length, score: s, grade: gradeOf(s), approximate: tp === 'qarzdorlik' }; }).filter(x => x.count);
    const recent = mine.slice().sort((a, b) => t(b) - t(a)).slice(0, 6).map(a => callRow(a, leads, managers));
    // Radar solishtiruvi — jamoa o'rtachasi (dizayn izohi: bitta chiziq, "Jamoa").
    const lastQuote = g.slice().sort((a, b) => t(b) - t(a)).map(a => ({ a, q: (a.result.quotes || [])[0] })).find(x => x.q) || null;
    const m = managers.get(id) || {};
    return {
        id, name: m.name || 'Menejer', avatar: m.avatar || '', rank: pos >= 0 ? pos + 1 : null, of: all.length,
        kpis: { ...k, scoreDelta: k.score != null && kp.score != null ? k.score - kp.score : null }, teamAxes: teamK.axes,
        weakest: weakest(k.axes), stages, issues, byType, recent,
        best: best ? { ...callRow(best, leads, managers), summary: best.result.summary || '' } : null,
        weekly: { labels: weekly.labels, me: weekly.byManager[id] || weekly.labels.map(() => null), team: weekly.team },
        lastQuote: lastQuote ? { callId: lastQuote.a.id, at: t(lastQuote.a), lead: leads.get(lastQuote.a.leadId)?.name || '', ...lastQuote.q } : null,
        tip: tipFor(stages),
    };
}
function example(a, leads, axis) {
    if (!a) return null;
    const q = (a.result.quotes || []).find(x => !axis || new RegExp(axis === 'yopish' ? 'yop' : axis === 'ogriq' ? 'ogʻriq|og.riq' : '', 'i').test(x.criterion || '')) || (a.result.quotes || [])[0];
    return { callId: a.id, lead: leads.get(a.leadId)?.name || '', t: q?.t || '' };
}
function tipFor(stages) {
    const up = stages.filter(s => s.delta != null && s.delta > 0).sort((a, b) => b.delta - a.delta)[0];
    const low = stages.filter(s => s.pct != null).sort((a, b) => a.pct - b.pct)[0];
    if (!low) return '';
    return `${up ? `${up.label.split(' (')[0]} yaxshilandi (+${Math.round(up.delta / 10)}). ` : ''}Endi asosiy foyda — ${low.key === 'yopish' ? 'har qoʻngʻiroqni aniq vaqt bilan yopish: bu sinovga yozilishni oshiradi.' : `“${low.label}” bosqichi: rejangiz shunga qaratilgan.`}`;
}
function callRow(a, leads, managers) {
    const r = a.result || null, l = leads.get(a.leadId);
    return {
        id: a.id, at: t(a), leadId: a.leadId, lead: l?.name || 'Lid', managerId: a.managerId, manager: managers.get(a.managerId)?.name || a.managerName || '',
        type: r?.type || a.typeHint || '', typeLabel: TYPE_LABEL[r?.type || a.typeHint] || 'Qoʻngʻiroq', status: a.status, durationSec: a.durationSec || 0,
        score: graded(a) ? r.score : null, grade: graded(a) ? gradeOf(r.score) : null, approximate: !!r?.approximate,
        outcome: r ? outcomeText(r) : (a.status === 'skipped' ? a.error || '' : ''), probability: r?.saleProbability ?? null,
        violations: (r?.violations || []).map(v => VIOL_LABEL[v.kind] || v.kind), appeal: a.appeal?.status || null,
        appealLeft: a.appeal?.status === 'pending' ? Math.max(0, Math.ceil((Date.parse(a.appeal.at) + 24 * 3600000 - Date.now()) / 3600000)) : null,
        monologue: r && r.talkShareManager != null && r.talkShareManager >= 75,
    };
}
function outcomeText(r) {
    if (!r.gradable) return r.notGradableReason || 'Baholanmaydi';
    if (r.outcome === 'tolov') return 'Toʻladi';
    if (r.outcome === 'sinov_darsi') return r.nextStepAt ? `Sinov · ${r.nextStepAt}` : 'Sinovga yozildi';
    if (r.outcome === 'tolov_vadasi') return r.nextStepAt ? `Vaʼda ${r.nextStepAt}` : 'Toʻlov vaʼdasi';
    if (r.nextStepAt) return `Kelishildi: ${r.nextStepAt}`;
    return 'Vaqt kelishilmadi';
}

// Qo'ng'iroqlar ro'yxati (Sotuv › Tahlil › Qo'ng'iroqlar) — filtrlar serverda.
function calls(ctx, q = {}) {
    const { analyses, leads, managers, from, to } = ctx;
    let list = inRange(analyses, from, to);
    if (q.type) list = list.filter(a => (a.result?.type || a.typeHint) === q.type);
    if (q.manager) list = list.filter(a => a.managerId === q.manager);
    if (q.appeal) list = list.filter(a => a.appeal?.status === 'pending');
    if (q.violations) list = list.filter(a => (a.result?.violations || []).length);
    if (q.status === 'graded') list = list.filter(graded); else if (q.status === 'pending') list = list.filter(a => ['queued', 'transcribing', 'scoring'].includes(a.status)); else if (q.status === 'skipped') list = list.filter(a => a.status === 'skipped' || (a.status === 'done' && a.result && !a.result.gradable));
    list.sort((a, b) => t(b) - t(a));
    const page = Math.max(0, Number(q.page) || 0), size = 10;
    return { total: list.length, page, size, rows: list.slice(page * size, page * size + size).map(a => callRow(a, leads, managers)) };
}

// Targetolog: lid sifati — faqat 1-qo'ng'iroq natijasi (menejer ballari ko'rsatilmaydi).
function leadQuality(ctx) {
    const { analyses, leads, from, to } = ctx;
    const first = new Map();
    inRange(analyses, from, to).filter(a => a.result && a.result.leadQuality && (a.result.type === 'birinchi' || !a.result.gradable))
        .sort((a, b) => t(a) - t(b)).forEach(a => { if (!first.has(a.leadId)) first.set(a.leadId, a); });
    const rows = [...first.values()].map(a => ({ a, l: leads.get(a.leadId) || {}, q: a.result.leadQuality }));
    const sourceOf = l => {
        const ad = l.metaAdName || l.utmContent || l.metaCampaignName || l.utmCampaign || '';
        if (ad) return `${/insta|ig/i.test(l.utmSource || l.source || '') || l.metaAdName ? 'Instagram' : (l.source || 'Reklama')} · “${String(ad).slice(0, 60)}”`;
        const org = l.leadType === 'organic' || /organik/i.test(l.source || '');
        return org ? (l.source && !/organik/i.test(l.source) ? `Organik · ${l.source}` : 'Organik') : `Manba · ${l.source || '—'}`;
    };
    const young = x => (x.q.age != null ? x.q.age : Number(x.l.connectedSurvey?.age) || null);
    const groups = new Map();
    rows.forEach(x => { const k = sourceOf(x.l); (groups.get(k) || groups.set(k, []).get(k)).push(x); });
    const bySource = [...groups.entries()].map(([name, arr]) => {
        const ok = arr.filter(x => x.q.targeted).length;
        const reasons = {};
        arr.filter(x => !x.q.targeted).forEach(x => { reasons[x.q.reason] = (reasons[x.q.reason] || 0) + 1; });
        const top = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
        const yc = arr.filter(x => { const y = young(x); return y != null && y <= 21; }).length;
        return { name, leads: arr.length, targeted: ok, pct: arr.length ? Math.round(ok / arr.length * 100) : 0, youngPct: arr.length ? Math.round(yc / arr.length * 100) : 0, note: top ? `${LQ_LABEL[top[0]] || top[0]} ${Math.round(top[1] / arr.length * 100)}%` : (ok === arr.length ? 'Hammasi maqsadli' : '') };
    }).sort((a, b) => b.leads - a.leads);
    const bad = rows.filter(x => !x.q.targeted);
    const reasons = Object.entries(bad.reduce((m, x) => { m[x.q.reason] = (m[x.q.reason] || 0) + 1; return m; }, {}))
        .sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ key: k, label: LQ_LABEL[k] || k, count: n, pct: bad.length ? Math.round(n / bad.length * 100) : 0 }));
    const quotes = {};
    rows.filter(x => x.q.adQuote).forEach(x => { const k = x.q.adQuote.trim().slice(0, 120); quotes[k] = (quotes[k] || 0) + 1; });
    const days = {};
    rows.forEach(x => { const d = dayKey(t(x.a)); (days[d] = days[d] || { leads: 0, ok: 0 }).leads++; if (x.q.targeted) days[d].ok++; });
    const yc = rows.filter(x => { const y = young(x); return y != null && y <= 21; }).length;
    return {
        total: rows.length, targeted: rows.filter(x => x.q.targeted).length,
        targetedPct: rows.length ? Math.round(rows.filter(x => x.q.targeted).length / rows.length * 100) : null,
        young: yc, youngPct: rows.length ? Math.round(yc / rows.length * 100) : null,
        bySource, reasons, badTotal: bad.length,
        quotes: Object.entries(quotes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([text, n]) => ({ text, count: n })),
        days: Object.entries(days).sort().map(([d, v]) => ({ day: d, leads: v.leads, pct: v.leads ? Math.round(v.ok / v.leads * 100) : 0 })),
        youngBySource: bySource.map(s => ({ name: s.name, pct: s.youngPct })).sort((a, b) => b.pct - a.pct),
    };
}

module.exports = { AXES, AXIS_LABEL, STAGE_LABEL, TYPE_LABEL, VIOL_LABEL, LQ_LABEL, gradeOf, graded, axesOf, weakest, weekStart, weeklySeries, team, manager, calls, leadQuality, callRow, teamKpis, inRange, dayKey, ddmm, fmtMln };
