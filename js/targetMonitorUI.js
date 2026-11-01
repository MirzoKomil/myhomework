// Marketing → "Target lidlar" oynasi.
// Ma'lumot: /api/target-ads (targetolog kiritgani + oylik reja) va CRM lidlari
// (faqat "Target" manbali). Hisob-kitob js/targetSheet.js'da.
(function () {
    'use strict';
    const S = () => window.TargetSheet;
    const state = { month: null, lang: 'english', data: null, gen: 0, showDetail: false };
    const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

    const esc = v => (typeof escapeHtml === 'function' ? escapeHtml(String(v ?? '')) : String(v ?? ''));
    const usd = v => {
        if (v == null || !Number.isFinite(v)) return '—';
        const d = Math.abs(v) >= 1000 ? 0 : 2; // katta summalar butun, kichiklari sentgacha
        return '$' + v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    };
    const som = v => (v == null || !Number.isFinite(v) || !v ? '—' : Math.round(v).toLocaleString('uz-UZ') + ' soʻm');
    const times = v => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(2).replace('.', ',') + '×');
    const int = v => (v == null ? '—' : Number(v).toLocaleString('uz-UZ'));
    const pct = v => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(1).replace('.', ',') + '%');
    const dayLabel = key => `${Number(key.slice(8))}-${MONTHS[Number(key.slice(5, 7)) - 1]}`;

    function tashkentToday() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    }

    // Foydalanuvchi ko'ra oladigan til yo'nalishlari (server ham alohida tekshiradi)
    function allowedLangs(user = getCurrentUser()) {
        if (!user) return [];
        if (['admin', 'boshliq'].includes(user.role)) return ['english', 'russian'];
        if (user.role === 'rop') return [user.linkedRopLang === 'russian' ? 'russian' : 'english'];
        if (user.role === 'targetolog') return user.linkedTargetLangs || [];
        return [];
    }

    function responsibleName(lang) {
        const list = (typeof getHrEmployees === 'function' ? getHrEmployees() : []) || [];
        const names = list.filter(e => e.role === 'targetolog' && e.status !== 'inactive' && (e.lang === lang || e.lang === 'both'
            || (!e.lang && lang === 'english'))).map(e => e.name).filter(Boolean);
        return names.length ? names.join(', ') : 'Targetolog';
    }

    function crmLeads(lang) {
        const all = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
        return (all[lang] || []).map(l => ({
            kind: getLeadKind(l),
            status: normalizeLeadStatus(l.status),
            dayKey: leadTashkentDayKey(l.createdAt || l.date),
            trial: !!l.trialLessonAt,
            // Shu liddan haqiqatda tushgan pul (Moliya reyestri qoidalari bilan)
            paid: typeof PaymentLedger !== 'undefined' ? PaymentLedger.leadEvents(l).events.reduce((a, e) => a + (Number(e.amount) || 0), 0) : 0
        }));
    }

    async function load(month, lang) {
        return apiFetch(`/api/target-ads?language=${encodeURIComponent(lang)}&month=${encodeURIComponent(month)}`);
    }

    function monthOptions(selected) {
        const cur = tashkentToday().slice(0, 7);
        const set = new Set([selected, cur]);
        const [y, m] = cur.split('-').map(Number);
        for (let i = -12; i <= 1; i++) { const x = new Date(Date.UTC(y, m - 1 + i, 1)); set.add(x.toISOString().slice(0, 7)); }
        return [...set].sort().reverse().map(k => `<option value="${k}" ${k === selected ? 'selected' : ''}>${esc(monthKeyLabel(k))}${k === cur ? ' (joriy)' : ''}</option>`).join('');
    }

    function canEditDay(key) {
        const p = state.data?.permissions;
        if (!p?.canEditDays || key > p.editTo) return false;
        return !p.editFrom || key >= p.editFrom;
    }

    const cls = g => (g ? ` tsx-${g}` : '');
    // Rang bilan birga belgi ham (rangni ajrata olmaydiganlar uchun)
    const MARK = { good: ['✓', 'yaxshi'], warn: ['!', 'eʼtibor'], bad: ['✕', 'yomon'] };
    // O'tgan oyga nisbatan o'zgarish: narxda pasayish — yaxshi, ROAS/soni o'sishi — yaxshi
    function mom(cur, prev, fmt, lowerIsBetter, label = '') {
        if (cur == null || prev == null || !prev) return prev != null ? `<span class="tsx-mom">o‘tgan oy: ${fmt(prev)}</span>` : '';
        const ch = (cur - prev) / prev * 100;
        const good = lowerIsBetter ? ch <= 0 : ch >= 0;
        return `<span class="tsx-mom ${Math.abs(ch) < 0.5 ? '' : good ? 'tsx-good' : 'tsx-bad'}">o‘tgan oy${label ? ' ' + label : ''}: ${fmt(prev)} · ${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(0)}%</span>`;
    }

    // Joriy oy hali tugamagan bo'lsa, o'tgan oyning SHU KUNGACHA bo'lgan lidlari bilan solishtiriladi
    function prevLeadsSameDay(sh, prev) {
        if (!prev) return null;
        const curMonth = sh.today.slice(0, 7) === sh.monthKey;
        const upTo = curMonth ? Number(sh.today.slice(8, 10)) : 31;
        return prev.days.filter(d => d.day <= upTo).reduce((a, d) => a + d.crm.leads, 0);
    }

    function kpis(sh, prev) {
        const t = sh.totals, p = sh.plan || {}, g = sh.grades, pt = prev?.totals || null;
        const card = (label, fakt, plan, gr, sub, momHtml = '') => `<div class="tsx-kpi${cls(gr)}">
            <span class="tsx-kpi-label">${label}</span>
            <b class="tsx-kpi-val">${fakt}</b>
            <span class="tsx-kpi-sub">${plan != null ? 'Reja: ' + plan + (sub ? ' · ' : '') : ''}${sub || ''}</span>${momHtml}</div>`;
        return `<div class="tsx-kpis">
            ${card('Reklama sarfi', usd(t.budget), usd(p.budget), g.budget, sh.paceDays && p.budget ? 'kutilgan ' + usd(p.budget * sh.pace) : '')}
            ${card('Lid soni · CRM', int(t.crm.leads), int(p.lidSoni), g.crmLeads, 'kabinetda ' + int(t.adLeads), mom(t.crm.leads, prevLeadsSameDay(sh, prev), int, false, sh.today.slice(0, 7) === sh.monthKey ? `(${Number(sh.today.slice(8, 10))}-kungacha)` : ''))}
            ${card('Lid narxi · CRM', usd(t.crmCpl), usd(p.lidNarxi), g.crmCpl, 'kabinetda ' + usd(t.adCpl), mom(t.crmCpl, pt?.crmCpl, usd, true))}
            ${card('Sifatli lid · CRM', int(t.crm.qualified), int(p.kvalLidSoni), g.crmKval, t.crm.pending ? int(t.crm.pending) + ' ta hali ishlanmagan' : 'hammasi ishlangan')}
            ${card('Sifatli lid narxi · CRM', usd(t.crmKvalCpl), usd(p.kvalNarxi), g.crmKvalCpl, '', mom(t.crmKvalCpl, pt?.crmKvalCpl, usd, true))}
            ${card('Lid → Sifatli % · CRM', pct(t.crmKvalPct), pct(p.kvalPct), g.crmKvalPct, t.crmKvalPctWorked != null ? 'ishlanganlar ichida ' + pct(t.crmKvalPctWorked) : '')}
            ${card('Sotuv narxi · CRM', usd(t.saleCost), p.targetCpa ? usd(p.targetCpa) : null, g.saleCost, int(t.crm.sold) + ' ta sotuv shu oy lidlaridan', mom(t.saleCost, pt?.saleCost, usd, true))}
            ${card('ROAS · kiritilgan kunlar', times(t.roas), p.targetRoas ? times(p.targetRoas) : null,
                p.targetRoas ? g.roas : (t.roas == null ? '' : t.roas >= 1 ? 'good' : t.roas >= 0.7 ? 'warn' : 'bad'),
                t.usdRate ? 'tushum ÷ (sarf + fixed) · lidlar toʻlagan sari oshadi' : 'oylik rejada $ kursi kiritilmagan', mom(t.roas, pt?.roas, times, false))}
        </div>`;
    }

    // Jadval modeli — HTML jadval, telefon kartochkalari va Excel eksporti shu bitta ro'yxatdan quriladi.
    // Qator nomlari va tartibi Google Sheet'dagidek; har bir ko'rsatkich ostida 🔒 CRM qiymati.
    function sheetModel(sh) {
        const t = sh.totals, p = sh.plan || {}, g = sh.grades;
        const owner = responsibleName(state.lang);
        const V = (v, f) => ({ v: v == null || (typeof v === 'number' && !Number.isFinite(v)) ? null : v, f });
        const P = (fakt, plan, gr) => (fakt == null || !plan ? null : { v: fakt / plan * 100, g: gr });
        const future = (d, v) => (d.isFuture ? null : v);
        const cost = d => (d.entry ? d.budget + (d.fixed || 0) : null);
        const signed = v => (v > 0 ? '+' : '') + v;
        const rows = [
            { label: 'Budget', hint: 'reklama sarfi', who: owner, plan: V(p.budget, usd), fakt: V(t.budget, usd), pct: P(t.budget, p.budget, g.budget),
                day: d => ({ v: d.budget, f: usd, cls: d.missing ? 'tsx-missing' : '', note: d.entry?.note }) },
            { label: 'Fixed', hint: 'doimiy, oy boshidan', who: 'Admin', plan: V(p.fixed || null, usd), fakt: V(t.fixed, usd), day: d => ({ v: d.fixed || null, f: usd }) },
            { label: 'Lid soni', hint: 'reklama kabineti', who: owner, plan: V(p.lidSoni, int), fakt: V(t.adLeads, int), pct: P(t.adLeads, p.lidSoni, g.adLeads),
                day: d => ({ v: d.adLeads, f: int, cls: d.missing ? 'tsx-missing' : '' }) },
            { sub: true, crm: true, label: 'CRM', plan: V(p.lidSoni, int), fakt: V(t.crm.leads, int), pct: P(t.crm.leads, p.lidSoni, g.crmLeads), day: d => ({ v: future(d, d.crm.leads), f: int }) },
            { sub: true, crm: true, label: 'Farq: kabinet − CRM', fakt: V(t.diff, signed),
                day: d => { const lv = S().diffLevel(d.diff, d.crm.leads); return { v: d.diff, f: signed, cls: lv ? 'tsx-' + lv : '' }; } },
            { label: 'Lid narxi', who: owner, plan: V(p.lidNarxi, usd), fakt: V(t.adCpl, usd), pct: P(t.adCpl, p.lidNarxi, g.adCpl), day: d => ({ v: d.adCpl, f: usd }) },
            { sub: true, crm: true, label: 'CRM', plan: V(p.lidNarxi, usd), fakt: V(t.crmCpl, usd), pct: P(t.crmCpl, p.lidNarxi, g.crmCpl), day: d => ({ v: d.crmCpl, f: usd }) },
            { label: 'Kval lid soni', hint: 'sifatli', who: owner, plan: V(p.kvalLidSoni, int), fakt: V(t.adKval, int), pct: P(t.adKval, p.kvalLidSoni, g.adKval), day: d => ({ v: d.adKval, f: int }) },
            { sub: true, crm: true, label: 'CRM', plan: V(p.kvalLidSoni, int), fakt: V(t.crm.qualified, int), pct: P(t.crm.qualified, p.kvalLidSoni, g.crmKval), day: d => ({ v: future(d, d.crm.qualified), f: int }) },
            { label: 'Kval lid narxi', who: owner, plan: V(p.kvalNarxi, usd), fakt: V(t.adKvalCpl, usd), pct: P(t.adKvalCpl, p.kvalNarxi, g.adKvalCpl), day: d => ({ v: d.adKvalCpl, f: usd }) },
            { sub: true, crm: true, label: 'CRM', plan: V(p.kvalNarxi, usd), fakt: V(t.crmKvalCpl, usd), pct: P(t.crmKvalCpl, p.kvalNarxi, g.crmKvalCpl), day: d => ({ v: d.crmKvalCpl, f: usd }) },
            { label: 'Lid → Maqsadli lid %', who: owner, plan: V(p.kvalPct, pct), fakt: V(t.adKvalPct, pct), pct: P(t.adKvalPct, p.kvalPct, g.adKvalPct), day: d => ({ v: d.adKvalPct, f: pct }) },
            { sub: true, crm: true, label: 'CRM', plan: V(p.kvalPct, pct), fakt: V(t.crmKvalPct, pct), pct: P(t.crmKvalPct, p.kvalPct, g.crmKvalPct), day: d => ({ v: d.crmKvalPct, f: pct }) },
            { crm: true, label: 'Sotuv narxi (CPA)', who: 'CRM', plan: V(p.targetCpa || null, usd), fakt: V(t.saleCost, usd), pct: P(t.saleCost, p.targetCpa, g.saleCost), day: d => ({ v: d.saleCost, f: usd }) },
            { crm: true, label: 'ROAS', hint: 'kiritilgan kunlar', who: 'CRM', plan: V(p.targetRoas || null, times), fakt: V(t.roas, times), pct: P(t.roas, p.targetRoas, g.roas),
                day: d => ({ v: t.usdRate && cost(d) > 0 ? (d.crm.revenue / t.usdRate) / cost(d) : null, f: times }) },
            { group: true, title: 'Batafsil: sifat taqsimoti va sotuvgacha', note: 'shu kuni kelgan target lidlar keyin qayergacha yetgani · 🔒 CRM' },
            { detail: true, crm: true, label: 'Sifatsiz', who: 'CRM', fakt: V(t.crm.unqualified, int), day: d => ({ v: future(d, d.crm.unqualified), f: int }) },
            { detail: true, crm: true, label: 'Hali ishlanmagan', who: 'CRM', fakt: V(t.crm.pending, int), day: d => ({ v: future(d, d.crm.pending), f: int, cls: d.crm.pending ? 'tsx-warn' : '' }) },
            { detail: true, crm: true, label: 'Sifat % ishlanganlar ichida', who: 'CRM', fakt: V(t.crmKvalPctWorked, pct), day: d => ({ v: d.crmKvalPctWorked, f: pct }) },
            { detail: true, crm: true, label: 'Sinovga yozilgan', who: 'CRM', fakt: V(t.crm.trial, int), day: d => ({ v: future(d, d.crm.trial), f: int }) },
            { detail: true, crm: true, label: 'Sinov narxi', who: 'CRM', fakt: V(t.trialCost, usd), day: d => ({ v: d.trialCost, f: usd }) },
            { detail: true, crm: true, label: 'Sotuv', who: 'CRM', fakt: V(t.crm.sold, int), day: d => ({ v: future(d, d.crm.sold), f: int }) },
            { detail: true, crm: true, label: 'Tushum', hint: 'shu oy lidlaridan, soʻm', who: 'CRM', fakt: V(t.revenue || null, som), day: d => ({ v: d.isFuture || !d.crm.revenue ? null : d.crm.revenue, f: som }) },
            { detail: true, crm: true, label: 'Toʻliq xarajat', hint: 'sarf + fixed, kiritilgan kunlar', who: 'CRM', plan: V(p.budget != null ? p.budget + (p.fixed || 0) : null, usd), fakt: V(t.totalCost, usd), day: d => ({ v: cost(d), f: usd }) },
            { detail: true, crm: true, label: 'Toʻliq lid narxi', who: 'CRM', fakt: V(t.fullCpl, usd), day: d => ({ v: d.entry && d.crm.leads ? cost(d) / d.crm.leads : null, f: usd }) }
        ];
        return rows;
    }

    const lockHtml = '<span class="tsx-lock" title="CRM avtomatik hisoblaydi — oʻzgartirib boʻlmaydi">🔒 CRM</span>';
    function pctCell(pc) {
        if (!pc) return '<td class="tsx-pct">—</td>';
        const m = MARK[pc.g];
        return `<td class="tsx-pct${cls(pc.g)}"${m ? ` aria-label="${pct(pc.v)} — ${m[1]}"` : ''}>${m ? `<span aria-hidden="true">${m[0]}</span> ` : ''}${pct(pc.v)}</td>`;
    }

    function sheetTable(sh) {
        const days = sh.days, rows = sheetModel(sh);
        const head = days.map(d => {
            const edit = canEditDay(d.key);
            return `<th class="tsx-day${d.isToday ? ' tsx-today' : ''}${d.isFuture ? ' tsx-future' : ''}${d.missing ? ' tsx-missing' : ''}" scope="col">
                ${edit ? `<button type="button" class="tsx-day-btn" data-tsx-day="${d.key}" title="${esc(dayLabel(d.key))} — kiritish/tahrirlash">` : '<span class="tsx-day-btn is-static">'}
                <span>${String(d.day).padStart(2, '0')}.${d.key.slice(5, 7)}</span><small>${d.weekday}${d.missing ? ' · ⚠' : ''}</small>
                ${edit ? '</button>' : '</span>'}</th>`;
        }).join('');
        const dayCell = c => {
            const body = c.v == null ? '<span class="tsx-dash">—</span>' : c.f(c.v);
            return c.note ? `<td class="tsx-num" title="${esc(c.note)}">${body} <span class="tsx-note" aria-label="Izoh: ${esc(c.note)}">📝</span></td>`
                : `<td class="tsx-num${c.cls ? ' ' + c.cls : ''}">${body}</td>`;
        };
        const body = rows.map(r => {
            if (r.group) return `<tr class="tsx-group"><th colspan="5" class="tsx-sticky tsx-group-cell">
                <button type="button" class="tsx-toggle" data-tsx-toggle aria-expanded="${state.showDetail ? 'true' : 'false'}">${state.showDetail ? '▾' : '▸'} ${r.title}</button><small>${r.note}</small></th>${days.map(() => '<td></td>').join('')}</tr>`;
            const label = r.sub ? `<span class="tsx-sub">↳ ${r.label}</span>` : `${r.label}${r.hint ? `<small class="tsx-hint">${r.hint}</small>` : ''}`;
            const who = r.crm ? lockHtml : esc(r.who || '');
            const fmt = x => (x && x.v != null ? x.f(x.v) : '—');
            return `<tr class="${r.crm ? 'tsx-crm' : ''}${r.sub ? ' tsx-subrow' : ''}${r.detail ? ' tsx-detail' : ''}"${r.detail && !state.showDetail ? ' hidden' : ''}>
                <th scope="row" class="tsx-sticky tsx-c1">${label}</th>
                <td class="tsx-sticky tsx-c2">${who}</td>
                <td class="tsx-sticky tsx-c3 tsx-num">${fmt(r.plan)}</td>
                <td class="tsx-sticky tsx-c4 tsx-num tsx-fakt">${fmt(r.fakt)}</td>
                ${pctCell(r.pct)}
                ${days.map(d => dayCell(r.day(d))).join('')}</tr>`;
        }).join('');
        return `<div class="tsx-table-wrap tsx-main-wrap" tabindex="0" aria-label="Target lidlar kunlik jadvali">
        <table class="tsx-table">
            <thead><tr>
                <th class="tsx-sticky tsx-c1" scope="col">Koʻrsatkich</th>
                <th class="tsx-sticky tsx-c2" scope="col">Masʼul</th>
                <th class="tsx-sticky tsx-c3" scope="col">Reja (oylik)</th>
                <th class="tsx-sticky tsx-c4" scope="col">Fakt (oylik)</th>
                <th class="tsx-sticky tsx-c5" scope="col">%</th>
                ${head}
            </tr></thead>
            <tbody>${body}</tbody>
        </table></div>`;
    }

    // Telefon uchun: keng jadval o'rniga kunlik kartochkalar (yangi kun yuqorida)
    function dayCards(sh) {
        const list = sh.days.filter(d => !d.isFuture).reverse();
        return `<div class="tsx-daycards" aria-label="Kunlik maʼlumot">${list.map(d => {
            const lv = S().diffLevel(d.diff, d.crm.leads);
            const edit = canEditDay(d.key);
            return `<article class="tsx-daycard${d.missing ? ' is-missing' : ''}">
                <header><b>${esc(dayLabel(d.key))}</b><span>${d.weekday}${d.missing ? ' · ⚠ kiritilmagan' : ''}</span>
                    ${edit ? `<button type="button" class="btn-ghost" data-tsx-day="${d.key}">${d.entry ? 'Tahrirlash' : 'Kiritish'}</button>` : ''}</header>
                <dl>
                    <div><dt>Budget</dt><dd>${usd(d.budget)}</dd></div>
                    <div><dt>Lid (kabinet)</dt><dd>${int(d.adLeads)}</dd></div>
                    <div><dt>Lid (🔒 CRM)</dt><dd>${int(d.crm.leads)}</dd></div>
                    <div><dt>Farq</dt><dd class="${lv ? 'tsx-' + lv : ''}">${d.diff == null ? '—' : (d.diff > 0 ? '+' : '') + d.diff}</dd></div>
                    <div><dt>Kval (🔒 CRM)</dt><dd>${int(d.crm.qualified)}</dd></div>
                    <div><dt>Lid narxi (CRM)</dt><dd>${usd(d.crmCpl)}</dd></div>
                </dl>${d.entry?.note ? `<p class="tsx-daycard-note">📝 ${esc(d.entry.note)}</p>` : ''}</article>`;
        }).join('')}</div>`;
    }

    // Excel (CSV, ";" ajratgich, UTF-8 BOM) — Google Sheet bilan katakma-katak solishtirish uchun
    function exportCsv(sh) {
        const rows = sheetModel(sh).filter(r => !r.group);
        const num = v => (v == null || !Number.isFinite(Number(v)) ? '' : String(Math.round(Number(v) * 100) / 100).replace('.', ','));
        const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = [['Koʻrsatkich', 'Masʼul', 'Reja (oylik)', 'Fakt (oylik)', '%', ...sh.days.map(d => d.key.slice(8) + '.' + d.key.slice(5, 7) + '.' + d.key.slice(0, 4))].map(q).join(';')];
        let parent = '';
        for (const r of rows) {
            if (!r.sub) parent = r.label;
            lines.push([q(r.sub ? `${parent} — ${r.label}` : r.label + (r.hint ? ` (${r.hint})` : '')), q(r.crm ? 'CRM (avtomatik)' : r.who || ''),
                num(r.plan?.v), num(r.fakt?.v), num(r.pct?.v), ...sh.days.map(d => num(r.day(d).v))].join(';'));
        }
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `target-lidlar-${state.lang === 'russian' ? 'rus' : 'ingliz'}-${sh.monthKey}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    function managersTable(lang, monthKey) {
        if (typeof computeTargetManagerStats !== 'function' || typeof getSalesManagers !== 'function') return '';
        // Targetologga lidlar sotuvchisiz keladi (maxfiylik) — menejerlar jadvali faqat admin/ROP uchun.
        if (typeof getCurrentUser === 'function' && getCurrentUser()?.role === 'targetolog') return '';
        const all = getItem(STORAGE_KEYS.leads, { english: [], russian: [] })[lang] || [];
        const managers = getSalesManagers(lang).filter(m => m.login).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'uz'));
        if (!managers.length) return '';
        const rows = managers.map(m => {
            const leadsCount = all.filter(l => getLeadKind(l) === 'target' && l.managerId === m.id && (l.createdAt || l.date)
                && leadTashkentDayKey(l.createdAt || l.date)?.slice(0, 7) === monthKey).length;
            const s = computeTargetManagerStats(m.id, all, monthKey);
            return `<tr><th scope="row">${esc(m.name)}</th><td>${int(leadsCount)}</td><td>${int(s.kval)}</td><td>${int(s.sinov)}</td>
                <td>${int(s.sotuv)}${s.planSotuv != null ? ` <small>/ ${int(s.planSotuv)}</small>` : ''}</td><td>${s.summaM ? s.summaM + ' mln' : '—'}</td><td>${s.kvalPct ? pct(s.kvalPct) : '—'}</td></tr>`;
        }).join('');
        return `<details class="tsx-managers"><summary>Sotuv menejerlari · faqat target lidlar natijasi</summary>
            <div class="tsx-table-wrap"><table class="tsx-mini">
            <thead><tr><th>Menejer</th><th>Target lid</th><th>Sifatli</th><th>Sinov</th><th>Sotuv / reja</th><th>Summa</th><th>Sifatli → sotuv</th></tr></thead>
            <tbody>${rows}</tbody></table></div></details>`;
    }

    // [1,2,3,5,7,8] → "1–3, 5, 7–8"
    function ranges(nums) {
        const out = [];
        for (let i = 0; i < nums.length; i++) {
            let j = i;
            while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
            out.push(j > i ? `${nums[i]}–${nums[j]}` : String(nums[i]));
            i = j;
        }
        return out.join(', ');
    }

    function alerts(sh) {
        const out = [];
        const p = state.data?.permissions || {};
        const y = sh.yesterday;
        if (y.slice(0, 7) === sh.monthKey && !state.data.days[y]) {
            out.push(`<div class="tsx-alert is-warn">⚠ Kecha (${esc(dayLabel(y))}) uchun reklama maʼlumoti kiritilmagan.
                ${p.canEditDays && canEditDay(y) ? `<button type="button" class="btn-primary-sm" data-tsx-day="${y}">Hozir kiritish</button>` : ''}</div>`);
        }
        const missing = sh.totals.missingDays.filter(k => k !== y);
        if (missing.length) out.push(`<div class="tsx-alert">Kiritilmagan kunlar: ${ranges(missing.map(k => Number(k.slice(8))))} (${missing.length} kun). Bu kunlarning CRM lidlari narx hisobiga qoʻshilmaydi.</div>`);
        if (!sh.plan) out.push(`<div class="tsx-alert">Bu oy uchun reja kiritilmagan — % ustuni boʻsh qoladi.${p.canEditPlan ? ' <button type="button" class="btn-ghost" data-tsx-plan>Rejani kiritish</button>' : ''}</div>`);
        const bigDiff = sh.days.filter(d => S().diffLevel(d.diff, d.crm.leads) === 'bad');
        if (bigDiff.length) out.push(`<div class="tsx-alert is-bad">Kabinet va CRM lid soni sezilarli farq qilgan kunlar: ${bigDiff.map(d => `${d.day} (${d.diff > 0 ? '+' : ''}${d.diff})`).join(', ')}. Lidlar CRM'ga yetib kelmayotgan yoki ikki marta sanalgan boʻlishi mumkin.</div>`);
        return out.join('');
    }

    function legend() {
        return `<details class="tsx-legend"><summary>Qanday hisoblanadi?</summary><ul>
            <li><b>Targetolog kiritadi</b> — har kuni kechagi kun uchun (bugungi kun tugagach): reklama sarfi ($), reklama kabinetidagi lid soni, oʻzi sanagan sifatli lid soni. Targetolog joriy oy kunlarini (oy tugagach yana 1 kun) kirita/tuzata oladi, eski kunlarni admin tuzatadi. Kechagi kun kiritilmaguncha targetolog kabineti qulflanadi. Har bir oʻzgarish kim/qachon bilan tarixga yoziladi.</li>
            <li><b>🔒 CRM</b> — shu kuni CRM'ga tushgan “Target” manbali lidlar (Tashkent vaqti bilan). Organik lidlar kirmaydi. Bu qatorlarni hech kim qoʻlda oʻzgartira olmaydi.</li>
            <li><b>Sifatli lid (CRM)</b> — “Bogʻlanildi” va undan keyingi bosqichdagi lidlar (sinov, qaror, toʻlov, muvaffaqiyatsiz sotuv ham). <b>Sifatsiz</b> — “Sifatsiz lidlar” ustuni. <b>Hali ishlanmagan</b> — “Yangi lidlar” va “Bogʻlanishga urinilmoqda”; ular ishlanganda sifat raqamlari oʻzgaradi.</li>
            <li><b>Lid narxi</b> = reklama sarfi ÷ lid soni. CRM narxida faqat sarfi kiritilgan kunlarning lidlari olinadi. <b>Toʻliq lid narxi</b> va <b>ROAS</b>da fixed ham hisobga olinadi (oylik fixed ÷ oy kunlari, har kunga).</li>
            <li><b>Lid → Sifatli %</b> = sifatli ÷ barcha target lidlar (rejadagi foiz bilan bir xil). <b>Ishlanganlar ichida</b> — hali ishlanmaganlarsiz, maʼlumot uchun.</li>
            <li><b>Natija</b> qatorlari shu kuni kelgan target lidlar keyinchalik sinovga, sotuvga va toʻlovga yetganini koʻrsatadi (kogorta). Tushum — Moliya reyestri qoidalari bilan shu lidlardan haqiqatda kelgan pul. <b>ROAS</b> = tushum ($, oylik rejadagi kurs boʻyicha) ÷ toʻliq xarajat; 1× dan yuqori — reklama oʻzini qoplagan. ROAS va toʻliq xarajat faqat sarfi kiritilgan kunlar boʻyicha (bir xil asos); “Fixed” qatori esa oy boshidan oʻtgan barcha kunlar ulushini koʻrsatadi. ROAS yakuniy emas: yaqinda kelgan lidlar keyinroq toʻlaydi, shuning uchun soʻnggi kunlar vaqt oʻtishi bilan yaxshilanadi.</li>
            <li><b>Rang</b>: sarf va soni — oyning <i>kechagacha</i> oʻtgan qismiga nisbatan kutilgan temp (yashil ≥100%, sariq ≥80%; sarfda ±10% yashil, ±25% sariq); narx — rejadan past/teng yashil, 15% gacha qimmat sariq; foiz — rejaga nisbatan.</li>
            <li><b>Farq</b> = kabinetdagi lid soni − CRM'dagi target lid soni. 2 tadan va 10% dan ortiq farq qizil.</li>
        </ul></details>`;
    }

    async function render(el, lang) {
        if (!el || !window.TargetSheet) return;
        const langs = allowedLangs();
        if (!langs.length) { el.innerHTML = '<div class="tsx-empty">Sizga hali til yoʻnalishi biriktirilmagan. Admin HR boʻlimida targetolog uchun Ingliz / Rus / Ikkalasini tanlashi kerak.</div>'; return; }
        state.lang = langs.includes(lang) ? lang : langs[0];
        if (!MONTH_KEY_RE.test(String(state.month || ''))) state.month = currentMonthKey();
        const gen = ++state.gen, month = state.month, selLang = state.lang;
        if (!state.data || state.data.month !== month || state.data.language !== selLang) el.innerHTML = '<div class="tsx-empty">Yuklanmoqda…</div>';
        const [py, pm] = month.split('-').map(Number);
        const prevMonth = new Date(Date.UTC(py, pm - 2, 1)).toISOString().slice(0, 7);
        let data, prevData = null;
        try { [data, prevData] = await Promise.all([load(month, selLang), load(prevMonth, selLang).catch(() => null)]); }
        catch (e) { if (gen === state.gen) el.innerHTML = `<div class="tsx-empty is-bad">${esc(e.message || 'Maʼlumotni yuklab boʻlmadi')}</div>`; return; }
        if (gen !== state.gen) return;
        state.data = data;
        const leads = crmLeads(selLang);
        const today = data.today || tashkentToday();
        const sh = S().buildSheet({ monthKey: month, today, entries: data.days || {}, plan: data.plan, leads });
        const prev = prevData ? S().buildSheet({ monthKey: prevMonth, today, entries: prevData.days || {}, plan: prevData.plan, leads }) : null;
        const p = data.permissions || {};
        const y = sh.yesterday;
        el.innerHTML = `<div class="tsx-wrap">
            <div class="tsx-toolbar">
                <div class="tsx-toolbar-left">
                    <select id="tsxMonth" class="form-control-sm" aria-label="Oy">${monthOptions(month)}</select>
                    <span class="tsx-meta">${sh.lastEntered ? 'Oxirgi kiritilgan: ' + esc(dayLabel(sh.lastEntered)) : 'Bu oyda hali kiritilmagan'} · ${sh.totals.enteredDays}/${sh.paceDays || 0} kun</span>
                </div>
                <div class="tsx-toolbar-right">
                    ${p.canEditDays && y.slice(0, 7) === month && canEditDay(y) ? `<button type="button" class="btn-primary-sm" data-tsx-day="${y}">${data.days[y] ? 'Kechagini tahrirlash' : '+ Kechagi kunni kiritish'}</button>` : ''}
                    ${p.canEditPlan ? '<button type="button" class="btn-ghost" data-tsx-plan>Oylik reja</button>' : ''}
                    <button type="button" class="btn-ghost" data-tsx-export title="Google Sheet bilan bir xil tartibda, Excel'da ochiladi">⬇ Excel</button>
                </div>
            </div>
            ${alerts(sh)}
            ${kpis(sh, prev)}
            ${sheetTable(sh)}
            ${dayCards(sh)}
            ${legend()}
            ${managersTable(selLang, month)}
        </div>`;
        el.querySelector('#tsxMonth')?.addEventListener('change', e => { state.month = e.target.value; render(el, state.lang); });
        el.querySelectorAll('[data-tsx-day]').forEach(b => b.addEventListener('click', () => openDay(el, b.dataset.tsxDay, sh)));
        el.querySelectorAll('[data-tsx-plan]').forEach(b => b.addEventListener('click', () => openPlan(el)));
        el.querySelector('[data-tsx-export]')?.addEventListener('click', () => exportCsv(sh));
        el.querySelector('[data-tsx-toggle]')?.addEventListener('click', e => {
            state.showDetail = !state.showDetail;
            e.currentTarget.setAttribute('aria-expanded', String(state.showDetail));
            e.currentTarget.textContent = (state.showDetail ? '▾ ' : '▸ ') + e.currentTarget.textContent.replace(/^[▾▸]\s*/, '');
            el.querySelectorAll('.tsx-detail').forEach(r => { r.hidden = !state.showDetail; });
        });
        // Bugungi kun ustuniga avtomatik surish
        const wrap = el.querySelector('.tsx-table-wrap');
        const todayTh = el.querySelector('.tsx-today') || el.querySelector(`[data-tsx-day="${y}"]`)?.closest('th');
        if (wrap && todayTh) wrap.scrollLeft = Math.max(0, todayTh.offsetLeft - wrap.clientWidth * 0.6);
    }

    function openDay(el, key, sh) {
        const e = state.data.days[key] || {};
        const d = sh.days.find(x => x.key === key);
        const c = d?.crm || { leads: 0, qualified: 0, unqualified: 0, pending: 0 };
        const changed = e.updatedAt ? `<p class="tsx-modal-note">Oxirgi oʻzgartirgan: ${esc(e.updatedBy || '—')}, ${esc(new Date(e.updatedAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }))}</p>` : '';
        openModal(`${dayLabel(key)} — target maʼlumoti`, `
            <div class="tsx-modal">
                <div class="tsx-modal-form">
                    <label class="form-group"><span>Reklama sarfi ($)</span><input type="number" id="tsxBudget" class="form-control" min="0" step="0.01" inputmode="decimal" value="${e.budget ?? ''}"></label>
                    <label class="form-group"><span>Reklama kabinetidagi lid soni</span><input type="number" id="tsxLeads" class="form-control" min="0" step="1" inputmode="numeric" value="${e.leadCount ?? ''}"></label>
                    <label class="form-group"><span>Siz sanagan sifatli lid soni <small>(ixtiyoriy)</small></span><input type="number" id="tsxKval" class="form-control" min="0" step="1" inputmode="numeric" value="${e.kvalLeadCount ?? ''}"></label>
                    <label class="form-group"><span>Izoh <small>(ixtiyoriy)</small></span><input type="text" id="tsxNote" class="form-control" maxlength="300" value="${esc(e.note || '')}" placeholder="masalan: yangi kreativ ishga tushdi"></label>
                    <div class="tsx-preview" id="tsxPreview"></div>
                    <p class="tsx-form-error" id="tsxError" role="alert" hidden></p>
                    ${changed}
                    ${e.revision ? '<button type="button" class="btn-ghost tsx-history-btn" id="tsxHistoryBtn">Oʻzgarishlar tarixi</button><div id="tsxHistory"></div>' : ''}
                </div>
                <aside class="tsx-crm-box" aria-label="CRM maʼlumoti">
                    <b>🔒 CRM shu kuni</b>
                    <dl>
                        <div><dt>Target lidlar</dt><dd>${int(c.leads)}</dd></div>
                        <div><dt>Sifatli</dt><dd>${int(c.qualified)}</dd></div>
                        <div><dt>Sifatsiz</dt><dd>${int(c.unqualified)}</dd></div>
                        <div><dt>Hali ishlanmagan</dt><dd>${int(c.pending)}</dd></div>
                    </dl>
                    <small>Bu raqamlar Sotuv boʻlimidan avtomatik olinadi va oʻzgarmaydi.</small>
                </aside>
            </div>`,
            `<button type="button" class="btn-ghost" id="tsxCancel">Bekor qilish</button>
             <button type="button" class="btn-primary-sm" id="tsxSave">Saqlash</button>`, { wide: true });
        const val = id => document.getElementById(id).value.trim();
        const preview = () => {
            const b = Number(val('tsxBudget')), n = Number(val('tsxLeads')), k = val('tsxKval') === '' ? null : Number(val('tsxKval'));
            const parts = [];
            if (val('tsxBudget') !== '' && n > 0) parts.push(`Lid narxi: <b>${usd(b / n)}</b>`);
            if (val('tsxBudget') !== '' && c.leads > 0) parts.push(`CRM boʻyicha: <b>${usd(b / c.leads)}</b>`);
            if (val('tsxLeads') !== '') {
                const diff = n - c.leads, lv = S().diffLevel(diff, c.leads);
                parts.push(`<span class="${lv ? 'tsx-' + lv : ''}">Farq (kabinet − CRM): <b>${diff > 0 ? '+' : ''}${diff}</b></span>`);
            }
            if (k != null && val('tsxLeads') !== '' && k > n) parts.push('<span class="tsx-bad">Sifatli lid jami liddan koʻp boʻlishi mumkin emas</span>');
            document.getElementById('tsxPreview').innerHTML = parts.join(' · ');
        };
        ['tsxBudget', 'tsxLeads', 'tsxKval'].forEach(id => document.getElementById(id).addEventListener('input', preview));
        preview();
        document.getElementById('tsxBudget').focus();
        document.getElementById('tsxCancel').onclick = closeModal;
        const showError = msg => { const el2 = document.getElementById('tsxError'); el2.textContent = msg; el2.hidden = !msg; };
        document.getElementById('tsxHistoryBtn')?.addEventListener('click', () => loadHistory('day', key, 'tsxHistory'));
        document.getElementById('tsxSave').onclick = async () => {
            showError('');
            if (val('tsxBudget') === '' || val('tsxLeads') === '') { showError('Reklama sarfi va lid sonini kiriting. Nol boʻlsa 0 yozing.'); return; }
            if (val('tsxKval') !== '' && Number(val('tsxKval')) > Number(val('tsxLeads'))) { showError('Sifatli lid soni jami lid sonidan oshmasligi kerak.'); return; }
            const body = { language: state.lang, kind: 'day', date: key, revision: e.revision || 0,
                data: { budget: Number(val('tsxBudget')), leadCount: Number(val('tsxLeads')), kvalLeadCount: val('tsxKval') === '' ? null : Number(val('tsxKval')), note: val('tsxNote') } };
            const btn = document.getElementById('tsxSave'); btn.disabled = true;
            try {
                await apiFetch('/api/target-ads', { method: 'PUT', body: JSON.stringify(body) });
                closeModal(); showMiniToast('Saqlandi'); render(el, state.lang);
            } catch (err) { showError(err.message); if (btn.isConnected) btn.disabled = false; }
        };
    }

    async function loadHistory(kind, date, targetId) {
        const box = document.getElementById(targetId);
        if (!box) return;
        box.innerHTML = '<p class="tsx-modal-note">Yuklanmoqda…</p>';
        const f = d => !d ? '—' : kind === 'day'
            ? `${usd(Number(d.budget))} · ${d.leadCount == null ? '—' : int(d.leadCount)} lid${d.kvalLeadCount != null ? ' · ' + int(d.kvalLeadCount) + ' sifatli' : ''}${d.note ? ' · “' + esc(d.note) + '”' : ''}`
            : `${usd(Number(d.budget))} · fixed ${usd(Number(d.fixed || 0))} · ${int(d.lidSoni)} lid · ${int(d.kvalLidSoni)} sifatli${d.usdRate ? ' · kurs ' + int(d.usdRate) : ''}${d.targetCpa ? ' · CPA ' + usd(Number(d.targetCpa)) : ''}${d.targetRoas ? ' · ROAS ' + times(Number(d.targetRoas)) : ''}`;
        try {
            const r = await apiFetch(`/api/target-ads/history?language=${state.lang}&kind=${kind}&date=${encodeURIComponent(date)}`);
            box.innerHTML = r.history.length ? `<ol class="tsx-history">${r.history.map(h => `<li><b>${esc(h.by || '—')}</b>, ${esc(new Date(h.at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }))}<br><span>${h.before ? f(h.before) + ' → ' : ''}${f(h.after)}</span></li>`).join('')}</ol>` : '<p class="tsx-modal-note">Tarix yoʻq (eski tizimdan koʻchirilgan).</p>';
        } catch (e) { box.innerHTML = `<p class="tsx-form-error">${esc(e.message)}</p>`; }
    }

    function openPlan(el) {
        const p = state.data.plan || {};
        openModal(`Oylik reja — ${monthKeyLabel(state.month)} · ${state.lang === 'russian' ? 'Rus tili' : 'Ingliz tili'}`, `
            <div style="display:flex;flex-direction:column;gap:12px">
                <label class="form-group"><span>Reklama byudjeti ($)</span><input type="number" id="tsxPBudget" class="form-control" min="0" step="0.01" value="${p.budget ?? ''}"></label>
                <label class="form-group"><span>Fixed — doimiy oylik xarajat ($) <small>(masalan, targetolog xizmati)</small></span><input type="number" id="tsxPFixed" class="form-control" min="0" step="0.01" value="${p.fixed ?? ''}"></label>
                <label class="form-group"><span>Lid soni</span><input type="number" id="tsxPLeads" class="form-control" min="0" step="1" value="${p.lidSoni ?? ''}"></label>
                <label class="form-group"><span>Sifatli lid soni</span><input type="number" id="tsxPKval" class="form-control" min="0" step="1" value="${p.kvalLidSoni ?? ''}"></label>
                <label class="form-group"><span>1 $ kursi (soʻm) <small>(ROAS — tushumni dollarga oʻtkazish uchun)</small></span><input type="number" id="tsxPRate" class="form-control" min="0" step="1" value="${p.usdRate ?? ''}" placeholder="masalan, 12800"></label>
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                    <label class="form-group" style="flex:1;min-width:140px"><span>Maqsadli sotuv narxi, $ <small>(ixtiyoriy)</small></span><input type="number" id="tsxPCpa" class="form-control" min="0" step="0.01" value="${p.targetCpa ?? ''}"></label>
                    <label class="form-group" style="flex:1;min-width:140px"><span>Maqsadli ROAS, × <small>(ixtiyoriy)</small></span><input type="number" id="tsxPRoas" class="form-control" min="0" step="0.1" value="${p.targetRoas ?? ''}" placeholder="masalan, 3"></label>
                </div>
                <div class="tsx-preview" id="tsxPPreview"></div>
                <p class="tsx-form-error" id="tsxPError" role="alert" hidden></p>
                ${p.updatedAt ? `<p class="tsx-modal-note">Oxirgi oʻzgartirgan: ${esc(p.updatedBy || '—')}, ${esc(new Date(p.updatedAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }))}</p>` : ''}
                ${p.revision ? '<button type="button" class="btn-ghost tsx-history-btn" id="tsxPHistoryBtn">Oʻzgarishlar tarixi</button><div id="tsxPHistory"></div>' : ''}
            </div>`,
            `<button type="button" class="btn-ghost" id="tsxPCancel">Bekor qilish</button><button type="button" class="btn-primary-sm" id="tsxPSave">Saqlash</button>`);
        const v = id => document.getElementById(id).value.trim();
        const preview = () => {
            const b = Number(v('tsxPBudget')), n = Number(v('tsxPLeads')), k = Number(v('tsxPKval'));
            document.getElementById('tsxPPreview').innerHTML = [
                n ? `Lid narxi: <b>${usd(b / n)}</b>` : '', k ? `Sifatli lid narxi: <b>${usd(b / k)}</b>` : '', n ? `Sifat %: <b>${pct(k / n * 100)}</b>` : ''
            ].filter(Boolean).join(' · ');
        };
        ['tsxPBudget', 'tsxPLeads', 'tsxPKval'].forEach(id => document.getElementById(id).addEventListener('input', preview));
        preview();
        document.getElementById('tsxPCancel').onclick = closeModal;
        const showError = msg => { const e2 = document.getElementById('tsxPError'); e2.textContent = msg; e2.hidden = !msg; };
        document.getElementById('tsxPHistoryBtn')?.addEventListener('click', () => loadHistory('plan', state.month, 'tsxPHistory'));
        document.getElementById('tsxPSave').onclick = async () => {
            showError('');
            if (['tsxPBudget', 'tsxPLeads', 'tsxPKval'].some(id => v(id) === '')) { showError('Byudjet, lid soni va sifatli lid sonini kiriting. Nol boʻlsa 0 yozing.'); return; }
            if (Number(v('tsxPKval')) > Number(v('tsxPLeads'))) { showError('Sifatli lid rejasi jami lid rejasidan oshmasligi kerak.'); return; }
            const body = { language: state.lang, kind: 'plan', date: state.month, revision: p.revision || 0,
                data: { budget: Number(v('tsxPBudget')), fixed: v('tsxPFixed') === '' ? 0 : Number(v('tsxPFixed')), lidSoni: Number(v('tsxPLeads')), kvalLidSoni: Number(v('tsxPKval')), usdRate: v('tsxPRate') === '' ? null : Number(v('tsxPRate')),
                    targetCpa: v('tsxPCpa') === '' ? null : Number(v('tsxPCpa')), targetRoas: v('tsxPRoas') === '' ? null : Number(v('tsxPRoas')) } };
            const btn = document.getElementById('tsxPSave'); btn.disabled = true;
            try {
                await apiFetch('/api/target-ads', { method: 'PUT', body: JSON.stringify(body) });
                closeModal(); showMiniToast('Reja saqlandi'); render(el, state.lang);
            } catch (err) { showError(err.message); if (btn.isConnected) btn.disabled = false; }
        };
    }

    window.targetMonitorUI = { render, allowedLangs };
})();
