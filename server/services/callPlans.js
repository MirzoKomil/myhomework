'use strict';
// Rivojlanish rejalari + haftalik AI hisobot + sozlamalar (qo'ng'iroq AI tahlili, 2-bosqich).
// Dizayn: QAT_K_rejalar, QAT_K_reja, QAT_K_menReja, QAT_T_reja, QAT_T_ropMini, QAT_K_hafta, QAT_K_sozlama.
//
// Qoidalar (Sozlamalar'da admin o'zgartiradi):
//  * 2 hafta ketma-ket ball < 70 → 3 haftalik reja: AI tuzadi (status "pending"), ROP tasdiqlaydi → "active".
//  * Haftada 5+ qoida buzilishi → 1 haftalik mini-reja; faol reja bo'lsa, unga qo'shiladi (yangi reja ochilmaydi).
//  * Chiqish: 2 hafta ketma-ket ≥ 70 va asosiy maqsad bajarilgan → "done". Muddat tugab natija yo'q → keyingi tsikl;
//    2-tsikl ham natijasiz → "decision" (admin: lid ulushini kamaytirish / qayta o'qitish / yana 1 hafta).
//  * Haftalar dushanbadan (Toshkent). Har dushanba 09:00 dan keyin: tugagan hafta baholanadi, yangi rejalar taklif
//    qilinadi, haftalik hisobot (Claude Opus) yoziladi.
const S = require('./callAiStats');

const PLANS = 'callPlans';
const REPORTS = 'callWeeklyReports';
const SETTINGS = 'callAiSettings';
const DAY = 86400000, WEEK = 7 * DAY;
const DEFAULTS = { planThreshold: 70, consecutiveWeeks: 2, planWeeks: 3, exitWeeks: 2, miniViolations: 5, miniWeeks: 1, adminAfterCycle: 2, minSeconds: 30, appealHours: 48, ropHours: 24, audioDays: 90, goodFrom: 80, closeTarget: 60 };
const FOCUS = {
    yopish: { label: 'Yopish', goal: 'Aniq vaqt bilan yopilgan qoʻngʻiroqlar', task: 'Har qoʻngʻiroqni aniq vaqt bilan yoping', role: 'Rol oʻyini: “Oʻylab koʻraman” → aniq vaqt', step: 8 },
    narx: { label: 'Narx', goal: 'Narx tartibi va jimlik', task: 'Narxni skript tartibida ayting (avval qiymat, keyin narx, keyin jimlik)', role: 'Rol oʻyini 2×: “Qimmat ekan” → nasiya → zaklad', step: 6 },
    ehtiyoj: { label: 'Ehtiyoj', goal: 'Ehtiyoj savollari', task: 'Har 1-qoʻngʻiroqda 3 ta ehtiyoj savoli bering', role: 'Rol oʻyini: vaziyat savollari', step: 3 },
    ogriq: { label: 'Ogʻriq', goal: 'Ogʻriq va jamlash', task: 'Ogʻriqni soʻrang va mijoz soʻzlari bilan jamlang', role: 'Rol oʻyini: ogʻriqni ochish', step: 4 },
    taqdimot: { label: 'Taqdimot', goal: 'Taqdimot (≤90 son)', task: 'Taqdimotni 90 soniyada, mijoz ehtiyojiga bogʻlab ayting', role: 'Rol oʻyini: 3 modulli qisqa taqdimot', step: 5 },
    etiroz: { label: 'Eʼtiroz', goal: 'Eʼtiroz va chegirma zinapoyasi', task: 'Eʼtirozda zinapoya: bir yoʻla → nasiya → zaklad → chegirma', role: 'Rol oʻyini: 5 ta asosiy eʼtiroz', step: 7 },
    ochilish: { label: 'Ochilish', goal: 'Ochilish va filtr', task: 'Ochilishda ism, maqsad va ruxsatni soʻrang', role: 'Rol oʻyini: birinchi 30 soniya', step: 1 },
};
const now0 = () => Date.now();
const id = p => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const ddmm = S.ddmm;
const range = (a, b) => `${ddmm(a)}–${ddmm(b - DAY)}`;
const tkHour = ms => new Date(ms + 5 * 3600000).getUTCHours();

async function settings(db) {
    const s = await db.getJsonData(SETTINGS);
    return { ...DEFAULTS, ...(s && !Array.isArray(s) && typeof s === 'object' ? s : {}) };
}
async function saveSettings(db, patch, by) {
    const cur = await settings(db);
    const out = { ...cur };
    for (const [k, v] of Object.entries(patch || {})) {
        if (!(k in DEFAULTS)) continue;
        const n = Math.round(Number(v));
        if (!Number.isFinite(n) || n < 0 || n > 1000) throw new Error(`Notoʻgʻri qiymat: ${k}`);
        out[k] = n;
    }
    if (out.planThreshold > 100 || out.goodFrom > 100) throw new Error('Ball 100 dan oshmaydi');
    out.updatedBy = by || ''; out.updatedAt = new Date().toISOString();
    await db.tx(async c => { await db.saveJsonData(c, SETTINGS, out); });
    return out;
}

// ── Haftalik o'lchovlar (reja maqsadlari) ───────────────────────────────────
function weekCalls(analyses, managerId, from, to) {
    return analyses.filter(a => a.managerId === managerId && S.graded(a) && (Date.parse(a.callAt) || 0) >= from && (Date.parse(a.callAt) || 0) < to);
}
const closed = a => !!a.result.nextStepAt || ['tolov', 'sinov_darsi'].includes(a.result.outcome);
function measure(analyses, managerId, from, to, focus, violKind) {
    const g = weekCalls(analyses, managerId, from, to);
    const { axes, score } = S.axesOf(g);
    return {
        calls: g.length, score,
        closePct: g.length ? Math.round(g.filter(closed).length / g.length * 100) : null,
        closedToday: null,
        axis: axes[focus] ?? null,
        violations: g.reduce((n, a) => n + (a.result.violations || []).filter(v => !violKind || v.kind === violKind).length, 0),
        list: g.slice(-8).map(a => ({ id: a.id, at: Date.parse(a.callAt), closed: closed(a), next: a.result.nextStepAt || '' })),
    };
}

// ── Reja tuzish ─────────────────────────────────────────────────────────────
// Asosiy fokus — eng zaif o'q; 3-hafta — ikkinchi zaif o'q. Vazifalar shablondan; ROP tasdiqlashdan oldin tahrirlay oladi.
function draft({ managerId, lang, kind, cycle, axes, violKind, violCount, scores, startAt, cfg, bestCallId }) {
    const sorted = S.AXES.filter(k => axes?.[k] != null).sort((a, b) => axes[a] - axes[b]);
    const main = kind === 'mini' ? (violKind === 'nasiyasiz_chegirma' || violKind === 'boshida_chegirma' ? 'narx' : 'etiroz') : (sorted[0] || 'yopish');
    const second = sorted.find(k => k !== main) || 'narx';
    const F = FOCUS[main], F2 = FOCUS[second];
    const weeks = kind === 'mini' ? 1 : (cfg.planWeeks || 3);
    const mk = (i, focus, extra) => {
        const ff = FOCUS[focus];
        const tasks = [
            ...(i === 0 || extra ? [{ who: 'ROP', text: 'ROP bilan 1:1 uchrashuv', sub: i === 0 ? 'Reja va natijalarni kelishish' : 'Oʻtgan hafta natijasini koʻrib chiqish' }] : []),
            { who: 'Menejer', text: 'Namunaviy qoʻngʻiroqni tinglash', sub: 'Namuna · mijoz yashirin', callId: bestCallId || '' },
            { who: 'ROP', text: ff.role, sub: 'ROP bilan · 2×15 daqiqa' },
            { who: 'Menejer', text: `Ish boshida skriptning ${ff.step}-bosqichini oʻqish`, sub: 'Skriptlar › Sotuv skripti' },
            { who: 'AI', text: ff.task, sub: 'AI har qoʻngʻiroqdan oʻzi belgilaydi', auto: focus },
        ].map(x => ({ id: id('t'), done: false, ...x }));
        return { i, start: startAt + i * WEEK, end: startAt + (i + 1) * WEEK, focus, title: i === 0 ? ff.goal : (focus === main ? `${ff.label} (davom)` : ff.goal), tasks, status: i === 0 ? 'current' : 'future', result: '' };
    };
    const ws = Array.from({ length: weeks }, (_, i) => mk(i, kind === 'mini' || i < weeks - 1 ? main : second));
    const goals = kind === 'mini'
        ? [{ key: 'viol', label: S.VIOL_LABEL[violKind] || 'Qoida buzilishi', start: violCount || 0, target: 0, unit: '', lower: true }, { key: 'axis', axis: 'narx', label: 'Narx bosqichi (0–10)', start: axes?.narx ?? null, target: 7, unit: '' }]
        : [
            main === 'yopish' ? { key: 'close', label: 'Aniq vaqt bilan yopilgan qoʻngʻiroqlar', start: null, target: cfg.closeTarget || 60, unit: '%' } : { key: 'axis', axis: main, label: `${F.label} bosqichi (0–10)`, start: axes?.[main] ?? null, target: Math.min(10, Math.max(6, Math.ceil((axes?.[main] ?? 4) + 2))), unit: '' },
            ...(main === 'yopish' ? [{ key: 'axis', axis: 'yopish', label: 'Yopish bosqichi (0–10)', start: axes?.yopish ?? null, target: Math.min(10, Math.max(6, Math.ceil((axes?.yopish ?? 3) + 3))), unit: '' }] : []),
            { key: 'score', label: 'Haftalik ball', start: scores?.[scores.length - 1] ?? null, target: cfg.planThreshold, unit: '' },
        ];
    return {
        id: id('pl'), managerId, lang, kind, cycle: cycle || 1, status: 'pending', createdAt: new Date().toISOString(),
        focus: main, focusLabel: kind === 'mini' ? `${FOCUS[main].label} zinapoyasi` : `${F.label} → ${F2.label}`,
        reason: kind === 'mini' ? `${ddmm(startAt - WEEK)}–${ddmm(startAt - DAY)} da ${violCount} marta ${(S.VIOL_LABEL[violKind] || 'qoida buzilishi').toLowerCase()}` : `ball ${(scores || []).slice(-2).filter(x => x != null).join(', ')} — ${cfg.consecutiveWeeks} hafta ${cfg.planThreshold} dan past`,
        violKind: violKind || null, goals, weeks: ws, notes: [], reminders: [], author: 'AI',
    };
}

// Haftalik ish: tugagan haftani baholash, yangi rejalar, hisobot. Dushanba 09:00 dan keyin bir marta (kalit — hafta).
async function weekly(db, { analyses, managers, leads = null, now = now0(), env = process.env, fetchImpl = globalThis.fetch, force = false, log = console } = {}) {
    const cfg = await settings(db);
    const cur = S.weekStart(now);
    const state = (await db.getJsonData('callPlansState')) || {};
    if (!force && (state.lastWeek >= cur || tkHour(now) < 9 && now - cur < DAY)) return { skipped: true };
    const plans = await listPlans(db);
    const changes = [];
    // 1) Faol rejalar: tugagan haftani baholash.
    for (const p of plans.filter(x => x.status === 'active')) {
        const w = p.weeks.find(x => x.status === 'current');
        if (!w || w.end > now) continue;
        const m = measure(analyses, p.managerId, w.start, w.end, w.focus, p.violKind);
        const ok = goalMet(p, m, cfg);
        w.status = ok ? 'done' : 'failed';
        w.result = `${p.goals[0]?.key === 'close' ? `Natija: ${m.closePct ?? 0}% (maqsad ${p.goals[0].target}%)` : `Natija: ${m.axis ?? '—'}`}${m.score != null ? ` · ball ${m.score}` : ''} — ${ok ? 'bajarildi' : 'bajarilmadi'}`;
        const next = p.weeks.find(x => x.status === 'future');
        // Ketma-ket 2 hafta ≥ 70 va asosiy maqsad — reja muddatidan oldin ham yopiladi.
        const lastTwo = p.weeks.filter(x => x.status === 'done' || x.status === 'failed').slice(-cfg.exitWeeks);
        const exitOk = lastTwo.length >= cfg.exitWeeks && lastTwo.every(x => x.status === 'done') && (m.score ?? 0) >= cfg.planThreshold;
        if (exitOk || (!next && ok && p.kind === 'mini')) { p.status = 'done'; p.closedAt = new Date(now).toISOString(); }
        else if (next) {
            next.status = 'current';
            if (!ok && p.kind !== 'mini') { // natijasiz hafta → fokus davom etadi + ROP 1:1
                next.focus = w.focus; next.title = `${FOCUS[w.focus]?.label || ''} (davom) + ROP 1:1`;
                if (!next.tasks.some(x => /1:1/.test(x.text))) next.tasks.unshift({ id: id('t'), who: 'ROP', text: 'ROP bilan 1:1 uchrashuv', sub: `${S.ddmm(w.start)}-hafta natijasi koʻrildi`, done: false });
            }
        } else {
            p.status = p.cycle >= cfg.adminAfterCycle ? 'decision' : 'failed';
            p.closedAt = new Date(now).toISOString();
            if (p.status === 'failed' && p.kind !== 'mini') changes.push({ next: p });
        }
        changes.push({ plan: p.id, week: w.i, ok });
    }
    // 2) Yangi rejalar (faol/kutilayotgan rejasi yo'q menejerlar uchun).
    const ws = S.weeklySeries(analyses, now, Math.max(2, cfg.consecutiveWeeks));
    const best = analyses.filter(S.graded).sort((a, b) => b.result.score - a.result.score)[0];
    for (const [mid, series] of Object.entries(ws.byManager)) {
        const open = plans.find(x => x.managerId === mid && ['pending', 'active', 'decision'].includes(x.status));
        const lastW = cur - WEEK;
        const mm = measure(analyses, mid, lastW, cur, 'narx');
        const viol = {}; analyses.filter(a => a.managerId === mid && S.graded(a) && Date.parse(a.callAt) >= lastW && Date.parse(a.callAt) < cur).forEach(a => (a.result.violations || []).forEach(v => { viol[v.kind] = (viol[v.kind] || 0) + 1; }));
        const topViol = Object.entries(viol).sort((a, b) => b[1] - a[1])[0];
        const lang = analyses.find(a => a.managerId === mid)?.lang || 'russian';
        const low = series.slice(-cfg.consecutiveWeeks);
        const axes = S.axesOf(analyses.filter(a => a.managerId === mid && S.graded(a) && Date.parse(a.callAt) >= cur - 2 * WEEK && Date.parse(a.callAt) < cur)).axes;
        if (!open && low.length === cfg.consecutiveWeeks && low.every(x => x != null && x < cfg.planThreshold)) {
            const prevFull = plans.filter(x => x.managerId === mid && x.kind === 'full' && x.status === 'failed').sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
            const cycle = prevFull && now - Date.parse(prevFull.closedAt || prevFull.createdAt) < 30 * DAY ? (prevFull.cycle || 1) + 1 : 1;
            plans.push(draft({ managerId: mid, lang, kind: 'full', cycle, axes, scores: series, startAt: cur, cfg, bestCallId: best?.id }));
            changes.push({ new: mid, kind: 'full' });
        } else if (topViol && topViol[1] >= cfg.miniViolations && mm.calls) {
            if (open && open.status === 'active') {
                // Faol rejaga 1 haftalik mini-maqsad qo'shiladi.
                const w = open.weeks.find(x => x.status === 'current');
                if (w && !w.tasks.some(x => x.mini)) w.tasks.push({ id: id('t'), who: 'ROP', mini: topViol[0], text: FOCUS.narx.role, sub: `Mini-reja: ${topViol[1]} marta ${(S.VIOL_LABEL[topViol[0]] || '').toLowerCase()}`, done: false });
            } else if (!open) {
                plans.push(draft({ managerId: mid, lang, kind: 'mini', axes, violKind: topViol[0], violCount: topViol[1], scores: series, startAt: cur, cfg, bestCallId: best?.id }));
                changes.push({ new: mid, kind: 'mini' });
            }
        }
    }
    await savePlans(db, plans);
    // 3) Haftalik hisobot (har til uchun).
    for (const lang of ['russian', 'english']) {
        if (!analyses.some(a => a.lang === lang && S.graded(a) && Date.parse(a.callAt) >= cur - WEEK && Date.parse(a.callAt) < cur)) continue;
        try { await weeklyReport(db, { analyses: analyses.filter(a => a.lang === lang), lang, managers, leads, weekStart: cur - WEEK, env, fetchImpl, plans }); }
        catch (err) { log.error('[callPlans] hisobot', lang, err.message); }
    }
    await db.tx(async c => { await db.saveJsonData(c, 'callPlansState', { lastWeek: cur, at: new Date(now).toISOString() }); });
    return { changes };
}

function goalMet(p, m, cfg) {
    const g = p.goals[0];
    if (!g) return (m.score ?? 0) >= cfg.planThreshold;
    if (g.key === 'close') return (m.closePct ?? 0) >= g.target;
    if (g.key === 'viol') return m.violations <= g.target;
    if (g.key === 'axis') return (m.axis ?? 0) >= g.target;
    return (m.score ?? 0) >= g.target;
}

async function listPlans(db) { const a = await db.getJsonData(PLANS); return Array.isArray(a) ? a : []; }
async function savePlans(db, plans) { await db.tx(async c => { await db.saveJsonData(c, PLANS, plans.slice(-400)); }); }
async function mutatePlans(db, fn) {
    if (db.mutateJsonData) return db.mutateJsonData(PLANS, list => fn(list));
    const list = await listPlans(db); const out = await fn(list); await savePlans(db, list); return out;
}

// ROP/admin amallari.
async function act(db, planId, action, body = {}, by = '') {
    return mutatePlans(db, list => {
        const p = list.find(x => x.id === planId);
        if (!p) throw new Error('Reja topilmadi');
        const at = new Date().toISOString();
        if (action === 'approve') {
            if (p.status !== 'pending') throw new Error('Reja kutilayotgan holatda emas');
            // Kech tasdiqlansa — haftalar shu haftadan boshlanadi (o'tib ketgan hafta "bajarilmadi" bo'lmasin).
            const shift = S.weekStart(Date.now()) - p.weeks[0].start;
            if (shift > 0) p.weeks.forEach(w => { w.start += shift; w.end += shift; });
            p.status = 'active'; p.approvedBy = by; p.approvedAt = at;
        }
        else if (action === 'edit') {
            if (body.weeks && Array.isArray(body.weeks)) body.weeks.forEach((w, i) => {
                const pw = p.weeks[i]; if (!pw || !w) return;
                if (typeof w.title === 'string') pw.title = w.title.slice(0, 120);
                if (Array.isArray(w.tasks)) pw.tasks = w.tasks.slice(0, 10).map(x => ({ id: x.id || id('t'), who: ['ROP', 'Menejer', 'AI'].includes(x.who) ? x.who : 'Menejer', text: String(x.text || '').slice(0, 160), sub: String(x.sub || '').slice(0, 200), done: !!x.done, auto: x.auto || undefined, callId: x.callId || undefined })).filter(x => x.text);
            });
            if (Array.isArray(body.goals)) p.goals = body.goals.slice(0, 4).map(g => ({ ...g, label: String(g.label || '').slice(0, 120), target: Number(g.target) || 0 }));
            p.editedBy = by; p.editedAt = at;
        }
        else if (action === 'task') {
            const w = p.weeks.find(x => x.tasks.some(tk => tk.id === body.taskId));
            const tk = w?.tasks.find(x => x.id === body.taskId);
            if (!tk) throw new Error('Vazifa topilmadi');
            if (tk.who === 'AI') throw new Error('Bu vazifani AI qoʻngʻiroqlardan oʻzi belgilaydi');
            if (body.role === 'sales_manager' && tk.who === 'ROP') throw new Error('Bu vazifani ROP belgilaydi');
            tk.done = !!body.done; tk.doneAt = tk.done ? at : null; tk.doneBy = tk.done ? by : null;
        }
        else if (action === 'note') { const text = String(body.text || '').trim().slice(0, 600); if (text.length < 3) throw new Error('Izoh yozing'); p.notes.push({ at, by, text }); }
        else if (action === 'remind') { p.reminders.push({ at, by }); }
        else if (action === 'decision') {
            if (p.status !== 'decision') throw new Error('Qaror kutilmayapti');
            const ok = ['ulush', 'qayta_oqitish', 'yana_hafta'].includes(body.choice); if (!ok) throw new Error('Qaror tanlang');
            p.decision = { choice: body.choice, by, at };
            if (body.choice === 'yana_hafta') { p.status = 'active'; const last = p.weeks[p.weeks.length - 1]; p.weeks.push({ ...last, i: p.weeks.length, start: last.end, end: last.end + WEEK, status: 'current', result: '', tasks: last.tasks.map(x => ({ ...x, id: id('t'), done: false })) }); }
            else p.status = 'closed';
        }
        else if (action === 'cancel') { p.status = 'cancelled'; p.closedAt = at; p.cancelledBy = by; }
        else throw new Error('Notoʻgʻri amal');
        return { ...p };
    });
}

// Ekran uchun: reja + jonli o'lchovlar (joriy hafta maqsadlari, AI vazifa holati).
function view(p, analyses, managers, now = now0()) {
    if (!p) return null;
    const w = p.weeks.find(x => x.status === 'current') || p.weeks[p.weeks.length - 1];
    const m = w ? measure(analyses, p.managerId, w.start, Math.min(w.end, now + 1), w.focus, p.violKind) : null;
    const today = S.dayKey(now);
    const todayCalls = m ? m.list.filter(x => S.dayKey(x.at) === today) : [];
    const goals = p.goals.map(g => ({ ...g, cur: g.key === 'close' ? m?.closePct : g.key === 'viol' ? m?.violations : g.key === 'axis' ? (m ? S.axesOf(weekCalls(analyses, p.managerId, w.start, Math.min(w.end, now + 1))).axes[g.axis] : null) : m?.score }));
    const weeks = p.weeks.map(x => ({ ...x, label: `${x.i + 1}-hafta · ${range(x.start, x.end)}`, tasks: x.tasks.map(tk => tk.auto ? { ...tk, progress: `${todayCalls.filter(c => c.closed).length}/${todayCalls.length}` } : tk) }));
    const done = w ? w.tasks.filter(x => x.done).length : 0;
    return {
        ...p, weeks, goals, managerName: managers.get(p.managerId)?.name || '', managerAvatar: managers.get(p.managerId)?.avatar || '',
        current: w ? { i: w.i, label: `${w.i + 1}-hafta`, range: range(w.start, w.end), done, total: w.tasks.length, calls: m?.list || [] } : null,
        dayInWeek: w ? Math.min(7, Math.floor((now - w.start) / DAY) + 1) : null,
    };
}

// ── Haftalik hisobot (Claude Opus) ──────────────────────────────────────────
const REPORT_TOOL = {
    name: 'weekly_report', description: 'Sotuv boʻlimi qoʻngʻiroqlari boʻyicha haftalik xulosa',
    input_schema: { type: 'object', properties: {
        mistakes: { type: 'array', description: 'Eng koʻp takrorlangan 3 ta xato (jamoa boʻyicha)', items: { type: 'object', properties: { title: { type: 'string' }, count: { type: 'integer' }, detail: { type: 'string', description: 'Kim nechta, natijaga taʼsiri (1–2 gap)' } }, required: ['title', 'detail'] } },
        scriptIssues: { type: 'array', description: 'Skriptning oʻzidagi muammolar (ballga taʼsir qilmaydi)', items: { type: 'object', properties: { title: { type: 'string' }, detail: { type: 'string' } }, required: ['title', 'detail'] } },
        summary: { type: 'string' },
    }, required: ['mistakes', 'summary'] },
};
async function weeklyReport(db, { analyses, lang, managers, leads: leadMap = null, weekStart, env = process.env, fetchImpl = globalThis.fetch, plans = [] }) {
    const from = weekStart, to = weekStart + WEEK;
    const list = analyses.filter(a => (Date.parse(a.callAt) || 0) >= from && (Date.parse(a.callAt) || 0) < to);
    const leads = leadMap instanceof Map ? leadMap : new Map(); // sinov va sotuv foizlari uchun lid holatlari
    const k = S.teamKpis(list, leads, to);
    const g = list.filter(S.graded);
    const perM = {};
    g.forEach(a => { const m = perM[a.managerId] = perM[a.managerId] || { name: managers.get(a.managerId)?.name || a.managerName, calls: 0, noTime: 0, viol: {} }; m.calls++; if (!closed(a)) m.noTime++; (a.result.violations || []).forEach(v => { m.viol[v.kind] = (m.viol[v.kind] || 0) + 1; }); });
    const issues = {}; g.forEach(a => (a.result.scriptIssues || []).forEach(x => { issues[x] = (issues[x] || 0) + 1; }));
    let data = null, model = '', usage = null;
    if (env.ANTHROPIC_API_KEY) {
        model = /^[a-z0-9.-]{3,60}$/.test(env.CALL_AI_REPORT_MODEL || '') ? env.CALL_AI_REPORT_MODEL : 'claude-opus-5-5';
        const input = { davr: range(from, to), jamoa: { ball: k.score, tahlil: k.graded, sinovgaPct: k.trialPct, buzilishlar: k.violationsByKind }, menejerlar: Object.values(perM), skriptMuammolari: Object.entries(issues).sort((a, b) => b[1] - a[1]).slice(0, 20) };
        const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
            method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model, max_tokens: 3000, system: 'Sen Domwork sotuv boʻlimi uchun haftalik tahlilchisan. Faqat berilgan raqamlarga tayan, oʻzbek tilida (lotin), qisqa yoz. Natijani weekly_report vositasi orqali qaytar.', tools: [REPORT_TOOL], tool_choice: { type: 'tool', name: 'weekly_report' }, messages: [{ role: 'user', content: JSON.stringify(input) }] }),
        });
        if (res.ok) { const body = await res.json(); usage = body.usage || null; data = (body.content || []).find(c => c.type === 'tool_use')?.input || null; }
        if (usage) { try { await require('./aiCostFinance').record(db.pool, { analysisId: `report-${lang}-${S.dayKey(from)}`, provider: 'claude', model, usage, lang }); } catch { /* narx yozilmasa ham hisobot saqlanadi */ } }
    }
    if (!data) {
        // Model ulanmagan — hisobdan: eng ko'p xatolar.
        const noTime = Object.values(perM).reduce((n, m) => n + m.noTime, 0);
        data = { mistakes: [
            ...(noTime ? [{ title: 'Vaqtsiz yopish', count: noTime, detail: Object.values(perM).filter(m => m.noTime).sort((a, b) => b.noTime - a.noTime).map(m => `${m.name} ${m.noTime}`).join(', ') }] : []),
            ...k.violationsByKind.slice(0, 2).map(v => ({ title: v.label, count: v.count, detail: Object.values(perM).filter(m => m.viol[v.kind]).map(m => `${m.name} ${m.viol[v.kind]}`).join(', ') })),
        ], scriptIssues: Object.entries(issues).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([title, n]) => ({ title, detail: `${n} suhbatda` })), summary: '' };
        model = 'hisob';
    }
    const rep = { id: `wr-${lang}-${S.dayKey(from)}`, lang, weekStart: from, label: range(from, to), createdAt: new Date().toISOString(), model, kpis: { score: k.score, analyzed: k.graded, trialPct: k.trialPct, sales: k.sales, lost: k.lost }, data };
    const put = l => { const i = l.findIndex(x => x.id === rep.id); if (i >= 0) l[i] = rep; else l.push(rep); if (l.length > 120) l.splice(0, l.length - 120); };
    if (db.mutateJsonData) await db.mutateJsonData(REPORTS, put);
    else await db.tx(async c => { const l = await db.getJsonData(REPORTS); const arr = Array.isArray(l) ? l : []; put(arr); await db.saveJsonData(c, REPORTS, arr); });
    return rep;
}
async function reports(db, lang) { const l = await db.getJsonData(REPORTS); return (Array.isArray(l) ? l : []).filter(x => !lang || x.lang === lang).sort((a, b) => b.weekStart - a.weekStart); }

module.exports = { DEFAULTS, FOCUS, settings, saveSettings, measure, draft, weekly, goalMet, listPlans, savePlans, act, view, weeklyReport, reports };
