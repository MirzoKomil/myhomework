// Moliya bo'limi interfeysi: Umumiy ko'rinish, Kassa, Operatsiyalar, Qarzlar, Hisobotlar,
// Solishtirish va audit, Sozlamalar. Barcha hisob-kitob serverda (FinanceEngine) bajariladi —
// bu yerda faqat ko'rsatish va kiritish. Raqam hech qachon brauzerda "taxmin qilinmaydi".
(function () {
    'use strict';
    const F = FinanceEngine;
    const SECTIONS = ['umumiy', 'kassa', 'operatsiyalar', 'qarzlar', 'hisobotlar', 'solishtirish', 'moliya-sozlamalar'];
    const state = {
        start: '', end: '', preset: 'month', consolidated: false, basis: 'cash', report: 'pnl', debtTab: 'receivables',
        overview: null, loadingKey: '', error: '', cashAccount: '', cashbook: null, txns: null, txFilter: { type: '', category: '', search: '' },
        recon: null, auditRows: null, auditChain: null, auditFilter: '', busy: false
    };
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const num = n => String(Math.abs(Math.round(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    // Buxgalteriya uslubi: manfiy summa qavs ichida (ustun sarlavhasida "so'm").
    const acc = n => (Number(n) < 0 ? '(' + num(n) + ')' : num(n));
    const money = n => (Number(n) < 0 ? '−' : '') + num(n) + ' so‘m';
    const pctText = v => (v == null ? '—' : String(v).replace('.', ',') + '%');
    const dateText = d => (d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '—');
    const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
    const monthName = m => { const [y, mm] = m.split('-'); return MONTHS[Number(mm) - 1] + ' ' + y.slice(2); };
    const reqKey = () => 'fin-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 14));
    const lang = () => (typeof _financeLang !== 'undefined' ? _financeLang : 'english');
    const scope = () => (state.consolidated ? 'all' : lang());
    const scopeLabel = () => (scope() === 'all' ? 'Konsolidatsiya (ikkala maktab + umumiy xarajatlar)' : F.ENTITIES[scope()]);
    const toast = msg => (typeof showMiniToast === 'function' ? showMiniToast(msg, 3500) : alert(msg));
    const catName = code => F.CATEGORY[code]?.name || code;
    const accountName = id => state.overview?.accountsList?.find(a => a.id === id)?.name || id;
    const isDirector = () => !!state.overview?.user?.director;
    const authHeaders = () => { const t = typeof getToken === 'function' ? getToken() : ''; return t ? { Authorization: 'Bearer ' + t } : {}; };
    const ICON = {
        ok: '<span class="fin-ico fin-ico--ok" aria-hidden="true"></span><span class="sr-only">Yaxshi:</span>',
        warning: '<span class="fin-ico fin-ico--warn" aria-hidden="true"></span><span class="sr-only">Diqqat:</span>',
        danger: '<span class="fin-ico fin-ico--danger" aria-hidden="true"></span><span class="sr-only">Muhim:</span>'
    };

    function presetRange(preset) {
        const today = F.today(), m = F.monthOf(today);
        if (preset === 'prev') { const pm = F.monthOf(F.addMonths(m + '-01', -1)); return [pm + '-01', F.monthEnd(pm)]; }
        if (preset === 'quarter') return [F.monthOf(F.addMonths(m + '-01', -2)) + '-01', today];
        if (preset === 'ytd') return [today.slice(0, 4) + '-01-01', today];
        if (preset === 'all') return [state.overview?.firstDate && state.overview.firstDate < today ? state.overview.firstDate : today.slice(0, 4) + '-01-01', today];
        return [m + '-01', today];
    }
    [state.start, state.end] = presetRange('month');

    async function api(path, body, method) {
        return apiFetch('/api/finance' + path, body === undefined ? { timeout: 30000 } : { method: method || 'POST', body: JSON.stringify(body), timeout: 60000 });
    }
    // Moliyaviy hujjat ommaviy papkaga emas, moliya bo'limining yopiq omboriga yuklanadi.
    async function uploadEvidenceFile(file) {
        if (!/\.(pdf|png|jpe?g|webp)$/i.test(file.name)) throw new Error('Hujjat PDF yoki rasm (PNG/JPG/WEBP) bo‘lishi kerak');
        const form = new FormData(); form.append('file', file);
        const res = await fetch('/api/finance/evidence', { method: 'POST', headers: authHeaders(), body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Hujjatni yuklab bo‘lmadi');
        return data.url;
    }
    async function upload(input) {
        const file = input?.files?.[0];
        if (!file) return '';
        if (input._uploaded?.file === file) return input._uploaded.url;
        const url = await uploadEvidenceFile(file);
        input._uploaded = { file, url };
        return url;
    }
    // Hujjat havolalari avtorizatsiya bilan ochiladi (oddiy havola token yubormaydi).
    document.addEventListener('click', async e => {
        const a = e.target.closest && e.target.closest('a[href^="/api/finance/evidence/"]');
        if (!a) return;
        e.preventDefault();
        const win = window.open('', '_blank');
        try {
            const res = await fetch(a.getAttribute('href'), { headers: authHeaders() });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Hujjatni ochib bo‘lmadi');
            const url = URL.createObjectURL(await res.blob());
            if (win) win.location.href = url; else window.open(url, '_blank', 'noopener');
            setTimeout(() => URL.revokeObjectURL(url), 120000);
        } catch (err) { win?.close(); toast(err.message); }
    }, true);

    // ---------- Ma'lumot yuklash ----------
    async function loadOverview(force) {
        const key = [scope(), state.start, state.end, state.basis].join('|');
        if (!force && state.overview && state.loadingKey === key) return state.overview;
        state.loadingKey = key; state.error = '';
        try {
            const data = await api(`/overview?scope=${scope()}&start=${state.start}&end=${state.end}&basis=${state.basis}`);
            if (state.loadingKey === key) state.overview = data;
        } catch (e) { state.error = e.message; state.overview = null; }
        return state.overview;
    }
    function invalidate() { state.overview = null; state.cashbook = null; state.txns = null; state.auditRows = null; state.loadingKey = ''; }

    // ---------- Umumiy elementlar ----------
    function toolbar(opts = {}) {
        const presets = [['month', 'Bu oy'], ['prev', 'O‘tgan oy'], ['quarter', 'Oxirgi 3 oy'], ['ytd', 'Yil boshidan'], ['all', 'Hammasi']];
        return `<div class="fin-toolbar">
            <div class="fin-presets" role="group" aria-label="Davr">${presets.map(([k, l]) => `<button type="button" class="fin-chip ${state.preset === k ? 'active' : ''}" aria-pressed="${state.preset === k}" data-fin-preset="${k}">${l}</button>`).join('')}</div>
            <div class="fin-dates">
                <label class="fin-field"><span>Dan</span><input type="date" lang="en-GB" class="form-control" data-fin-start value="${state.start}" max="${F.today()}"></label>
                <label class="fin-field"><span>Gacha</span><input type="date" lang="en-GB" class="form-control" data-fin-end value="${state.end}" max="${F.today()}"></label>
            </div>
            <label class="fin-switch" title="Ikkala maktab va umumiy xarajatlar birga"><input type="checkbox" data-fin-consolidated ${state.consolidated ? 'checked' : ''}><span>Konsolidatsiya</span></label>
            ${opts.basis ? `<div class="fin-seg" role="group" aria-label="Hisob usuli">
                <button type="button" class="${state.basis === 'cash' ? 'active' : ''}" aria-pressed="${state.basis === 'cash'}" data-fin-basis="cash" title="Pul kirgan va chiqqan kunida tan olinadi">Kassa usuli</button>
                <button type="button" class="${state.basis === 'accrual' ? 'active' : ''}" aria-pressed="${state.basis === 'accrual'}" data-fin-basis="accrual" title="Tushum kurs davomida, maosh hisoblangan oyida, xarajat hujjat sanasida (IFRS 15)">Hisoblash usuli</button></div>` : ''}
            ${opts.actions ? `<div class="fin-toolbar-actions">${opts.actions}</div>` : ''}
        </div>
        <p class="fin-scope">Ko‘rinish: <strong>${esc(scopeLabel())}</strong> · <strong>${dateText(state.start)} — ${dateText(state.end)}</strong>${state.overview?.closedThrough ? ` · <span class="fin-badge fin-badge--muted" title="Shu oygacha bo‘lgan davr yopilgan va muzlatilgan">${esc(state.overview.closedThrough)} gacha yopilgan</span>` : ''}</p>`;
    }
    function bindToolbar(root, rerender) {
        root.querySelectorAll('[data-fin-preset]').forEach(b => b.addEventListener('click', () => {
            state.preset = b.dataset.finPreset; [state.start, state.end] = presetRange(state.preset); invalidate(); rerender();
        }));
        const s = root.querySelector('[data-fin-start]'), e = root.querySelector('[data-fin-end]');
        const onDate = () => {
            if (!F.date(s.value) || !F.date(e.value) || s.value > e.value) { toast('Sana oralig‘ini to‘g‘ri kiriting'); return; }
            state.start = s.value; state.end = e.value; state.preset = 'custom'; invalidate(); rerender();
        };
        s?.addEventListener('change', onDate); e?.addEventListener('change', onDate);
        root.querySelector('[data-fin-consolidated]')?.addEventListener('change', ev => { state.consolidated = ev.target.checked; invalidate(); rerender(); });
        root.querySelectorAll('[data-fin-basis]').forEach(b => b.addEventListener('click', () => { state.basis = b.dataset.finBasis; invalidate(); rerender(); }));
    }
    function loading(root) { root.innerHTML = `<div class="fin-wrap">${toolbar()}<div class="fin-loading" role="status" aria-live="polite">Hisob-kitob qilinmoqda…</div></div>`; }
    function failed(root) {
        root.innerHTML = `<div class="fin-wrap"><div class="fin-alert fin-alert--danger" role="alert">${ICON.danger}<span><strong>Moliya ma’lumotini yuklab bo‘lmadi.</strong> ${esc(state.error)}</span>
            <button type="button" class="btn-ghost" data-fin-retry>Qayta urinish</button></div></div>`;
        root.querySelector('[data-fin-retry]').addEventListener('click', () => { invalidate(); render(currentSection()); });
    }
    function stat(label, value, sub, tone, hint) {
        return `<div class="fin-stat ${tone ? 'fin-stat--' + tone : ''}"><span class="fin-stat-label">${label}${hint ? ` <span class="fin-hint" tabindex="0" role="note" aria-label="${esc(hint)}" title="${esc(hint)}">?</span>` : ''}</span><strong class="fin-stat-value">${value}</strong>${sub ? `<span class="fin-stat-sub">${sub}</span>` : ''}</div>`;
    }
    function table(head, rows, opts = {}) {
        return `<div class="fin-table-wrap ${opts.cls || ''}" ${opts.label ? `role="region" aria-label="${esc(opts.label)}" tabindex="0"` : ''}><table class="fin-table">${opts.caption ? `<caption class="sr-only">${esc(opts.caption)}</caption>` : ''}<thead><tr>${head.map(h => `<th scope="col" ${h.num ? 'class="num"' : ''}>${h.label ?? h}</th>`).join('')}</tr></thead>
            <tbody>${rows.length ? rows.join('') : `<tr><td colspan="${head.length}" class="fin-empty">${opts.empty || 'Ma’lumot yo‘q'}</td></tr>`}</tbody>${opts.foot ? `<tfoot>${opts.foot}</tfoot>` : ''}</table></div>`;
    }
    function tabs(name, items, active, attr) {
        return `<div class="fin-seg fin-seg--tabs" role="tablist" aria-label="${esc(name)}">${items.map(([k, l]) => `<button type="button" role="tab" id="fin-tab-${attr}-${k}" aria-controls="fin-panel-${attr}" aria-selected="${k === active}" tabindex="${k === active ? 0 : -1}" class="${k === active ? 'active' : ''}" data-fin-tab-${attr}="${k}">${l}</button>`).join('')}</div>`;
    }
    function bindTabs(root, attr, onSelect) {
        const list = [...root.querySelectorAll(`[data-fin-tab-${attr}]`)];
        list.forEach((b, i) => {
            b.addEventListener('click', () => onSelect(b.getAttribute(`data-fin-tab-${attr}`)));
            b.addEventListener('keydown', e => {
                if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
                e.preventDefault();
                const next = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
                onSelect(list[next].getAttribute(`data-fin-tab-${attr}`), true);
            });
        });
    }
    function currentSection() { return typeof _tabContext !== 'undefined' ? _tabContext.financeSection : 'umumiy'; }
    function panelRoot(section) { return document.getElementById('finRoot-' + section); }
    function bindGo(root) {
        root.querySelectorAll('[data-fin-go]').forEach(b => b.addEventListener('click', () => {
            if (b.dataset.finReport) state.report = b.dataset.finReport;
            if (typeof switchFinanceSection === 'function') switchFinanceSection(b.dataset.finGo);
        }));
    }

    // ---------- Umumiy ko'rinish ----------
    function qualityAlerts(o) {
        const q = o.quality, items = [];
        if (!o.auditChain.ok) items.push(['danger', `Audit jurnali zanjiri ${o.auditChain.brokenAt}-yozuvda uzilgan — jurnal bazada to‘g‘ridan-to‘g‘ri o‘zgartirilgan`, 'solishtirish']);
        if (!o.balance.balanced) items.push(['danger', `Balans tenglamasi ${money(o.balance.imbalance)} ga mos kelmayapti`, 'hisobotlar', 'balance']);
        if (!o.cashflow.reconciled) items.push(['danger', `Pul oqimi hisob qoldiqlari bilan ${money(o.cashflow.difference)} farq qiladi`, 'hisobotlar', 'cashflow']);
        if (q.suspicious.length) items.push(['danger', `${q.suspicious.length} ta shubhali tushum (${money(q.suspicious.reduce((n, r) => n + r.amount, 0))}) reyestrda turibdi — test yoki xato yozuvga o‘xshaydi (barcha davrlar)`, 'solishtirish']);
        const diff = o.accounts.filter(a => a.check && a.check.difference !== 0);
        if (diff.length) items.push(['danger', `${diff.length} ta hisobda kitobdagi va haqiqiy qoldiq farq qiladi: ${diff.map(a => esc(a.name) + ' ' + money(a.check.difference)).join('; ')}`, 'kassa']);
        const unchecked = o.accounts.filter(a => a.active && a.equivalent && (a.inflow || a.outflow) && !a.check);
        if (unchecked.length) items.push(['warning', `${unchecked.length} ta hisob qoldig‘i haqiqiy bank/karta/kassa qoldig‘i bilan hali solishtirilmagan`, 'kassa']);
        if (o.balance.suspense) items.push(['warning', `${money(o.balance.suspense)} to‘lov usuli aniqlanmagan tushum “Aniqlanmagan” hisobida turibdi — qaysi hisobga tushganini aniqlash kerak`, 'kassa']);
        if (o.balance.uzumReceivable) items.push(['warning', `Uzum Nasiya’dan ${money(o.balance.uzumReceivable)} hali olinmagan — bu pul emas, olinadigan summa`, 'kassa']);
        if (q.paidSalaryWithoutCash.length) items.push(['warning', `${q.paidSalaryWithoutCash.length} ta “to‘landi” deb belgilangan maosh kassadan chiqim sifatida yozilmagan`, 'solishtirish']);
        const noExpenses = !['cost_of_services', 'marketing', 'sales_payroll', 'admin_payroll', 'rent', 'software', 'admin'].some(k => o.pnl[k]);
        if (noExpenses && o.pnl.net_revenue > 0) items.push(['warning', 'Bu davr uchun birorta ham xarajat kiritilmagan — foyda tushumga teng ko‘rinadi va haqiqatni aks ettirmaydi', 'operatsiyalar']);
        if (o.pnl.prior_adjustments) items.push(['warning', `Yopilgan oylardan keyin aniqlangan tuzatishlar: ${money(o.pnl.prior_adjustments)} (shu davr natijasiga kiritildi)`, 'hisobotlar', 'pnl']);
        if (o.closeCandidate?.issues && !o.closeCandidate.issues.length) items.push(['ok', `${o.closeCandidate.month} oyini yopishga tayyor`, 'moliya-sozlamalar']);
        if (!items.length) items.push(['ok', 'Ma’lumot sifati tekshiruvidan o‘tdi: balans, pul oqimi va qoldiqlar mos, shubhali yozuv yo‘q', null]);
        return `<div class="fin-alerts" role="list">${items.map(([tone, msg, go, report]) => `<div role="listitem" class="fin-alert fin-alert--${tone}">${ICON[tone]}<span>${msg}</span>${go ? `<button type="button" class="fin-link" data-fin-go="${go}" ${report ? `data-fin-report="${report}"` : ''}>Ko‘rish →</button>` : ''}</div>`).join('')}</div>`;
    }
    function trendChart(rows) {
        if (!rows.length) return '<p class="fin-empty">Ma’lumot yo‘q</p>';
        const W = 640, H = 220, P = 34, bw = Math.min(46, (W - P * 2) / rows.length / 2.6);
        const expenses = r => r.net_revenue - r.net_profit;
        const max = Math.max(1, ...rows.map(r => Math.max(r.net_revenue, expenses(r), r.net_profit)));
        const min = Math.min(0, ...rows.map(r => Math.min(r.net_profit, expenses(r))));
        const y = v => P + (H - P * 2) * (1 - (v - min) / (max - min));
        const x = i => P + (i + 0.5) * ((W - P * 2) / rows.length);
        const bar = (cx, v, cls) => `<rect x="${cx}" y="${y(Math.max(0, v))}" width="${bw}" height="${Math.max(0, Math.abs(y(0) - y(v)))}" rx="4" class="${cls}"/>`;
        const bars = rows.map((r, i) => `<g>${bar(x(i) - bw - 2, r.net_revenue, 'fin-bar-in')}${bar(x(i) + 2, expenses(r), 'fin-bar-out')}
            <text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="fin-axis">${monthName(r.month)}${r.closed ? ' •' : ''}</text></g>`).join('');
        const line = rows.map((r, i) => `${x(i)},${y(r.net_profit)}`).join(' ');
        return `<svg viewBox="0 0 ${W} ${H}" class="fin-chart" role="img" aria-labelledby="finChartTitle"><title id="finChartTitle">Oylik sof tushum, xarajatlar va sof foyda</title>
            <line x1="${P}" x2="${W - P}" y1="${y(0)}" y2="${y(0)}" class="fin-zero"/>${bars}
            <polyline points="${line}" class="fin-line"/>${rows.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.net_profit)}" r="3.5" class="fin-dot"/>`).join('')}</svg>
            <div class="fin-legend"><span><i class="fin-bar-in"></i>Sof tushum</span><span><i class="fin-bar-out"></i>Xarajatlar</span><span><i class="fin-line-key"></i>Sof foyda</span><span>• yopilgan oy</span></div>
            <details class="fin-details"><summary>Jadval ko‘rinishida</summary>${table(['Oy', { label: 'Sof tushum', num: true }, { label: 'Xarajatlar', num: true }, { label: 'Sof foyda', num: true }],
                rows.map(r => `<tr><td>${monthName(r.month)}${r.closed ? ' (yopilgan)' : ''}</td><td class="num">${acc(r.net_revenue)}</td><td class="num">${acc(expenses(r))}</td><td class="num">${acc(r.net_profit)}</td></tr>`))}</details>`;
    }
    function renderOverview(root) {
        const o = state.overview, k = o.kpis, p = o.pnl, b = o.balance;
        const cashNote = scope() === 'all' ? `naqd + karta + bank · ${dateText(o.period.end)}` : 'yo‘nalish ulushi (umumiy hisoblardagi oqim)';
        root.innerHTML = `<div class="fin-wrap">${toolbar({ basis: true })}
            ${qualityAlerts(o)}
            <div class="fin-stats">
                ${stat('Erkin pul mablag‘i', money(scope() === 'all' ? b.cashEquivalents : k.freeCash), cashNote, '', 'Naqd, karta va bank hisoblari. Uzum’dan olinadigan va “Aniqlanmagan” summalar bunga kirmaydi')}
                ${stat('Sof tushum', money(p.net_revenue), `qaytarishlar: ${money(p.refunds || 0)} · ${state.basis === 'cash' ? 'kassa usuli' : 'hisoblash usuli'}`, '', 'Kurs to‘lovlari minus qaytarilgan to‘lovlar')}
                ${stat('Yalpi foyda', money(p.gross_profit), 'marja ' + pctText(p.margins.gross), p.gross_profit < 0 ? 'danger' : '')}
                ${stat(scope() === 'all' ? 'Sof foyda' : 'Sof foyda (umumiy xarajat ulushi bilan)', money(p.net_profit), 'marja ' + pctText(p.margins.net), p.net_profit < 0 ? 'danger' : 'success', p.allocation ? `Umumiy xarajatlarning ${p.allocation.share}% i (sof tushum ulushi bo‘yicha) shu maktabga yuklangan` : '')}
                ${stat('O‘quvchilar to‘lashi kerak', money(o.receivables.total), `muddati o‘tgan: ${money(o.receivables.overdue)} · bugungi holat`, o.receivables.overdue ? 'warning' : '', 'O‘quvchi kartalaridagi joriy qarz (to‘lov jadvali). Balansga faqat o‘tilgan darslar uchun to‘lanmagan qism kiradi')}
                ${stat('Korxona qarzlari', money(o.payables.total), `maosh: ${money(o.payables.salaries)} · qarz: ${money(o.payables.loans)}`, o.payables.overdue ? 'warning' : '')}
                ${stat('Yangi o‘quvchilar', `${k.newClients} ta`, `kursni uzaytirgan: ${k.renewals} ta`, '', 'Davrda birinchi shartnomasi boshlangan o‘quvchilar va keyingi shartnomaga o‘tganlar')}
                ${stat('O‘rtacha shartnoma', k.averageContract ? money(k.averageContract) : '—', `o‘rtacha birinchi to‘lov: ${k.averageFirstPayment ? money(k.averageFirstPayment) : '—'}`, '', 'Yangi shartnomaning to‘liq qiymati (kurs narxi). Birinchi to‘lov alohida ko‘rsatilgan')}
                ${stat('Qarz undirildi', money(k.collections), `jami ${k.receiptCount} ta to‘lov`, '', 'Davr ichida boshlangan shartnomalarning birinchi to‘lovidan tashqari barcha kurs to‘lovlari')}
                ${stat('CAC', k.cac ? money(k.cac) : '—', k.fullCac ? 'sotuv maoshi bilan: ' + money(k.fullCac) : 'marketing xarajati kiritilmagan', '', 'Bitta yangi o‘quvchini jalb qilish narxi = marketing (umumiy reklama ulushi bilan) / yangi o‘quvchilar. Kassa usuli')}
                ${stat('Runway', k.runwayMonths != null ? k.runwayMonths + ' oy' : '—', k.averageMonthlyOperatingCashFlow < 0 ? 'o‘rtacha oylik operatsion oqim: ' + money(k.averageMonthlyOperatingCashFlow) : 'operatsion pul oqimi musbat', k.runwayMonths != null && k.runwayMonths < 3 ? 'danger' : '', 'Erkin pul oxirgi 3 to‘liq oydagi o‘rtacha manfiy operatsion oqimga necha oy yetadi')}
            </div>
            <div class="fin-grid">
                <section class="fin-card fin-card--wide" aria-labelledby="finTrendH"><header><h3 id="finTrendH">Oylik dinamika</h3><span class="fin-muted">${state.basis === 'cash' ? 'kassa usuli' : 'hisoblash usuli'}</span></header>${trendChart(o.monthly)}</section>
                <section class="fin-card" aria-labelledby="finAccH"><header><h3 id="finAccH">Pul qayerda</h3><button type="button" class="fin-link" data-fin-go="kassa">Kassa →</button></header>
                    <ul class="fin-list">${o.accounts.filter(a => a.active || a.balance).map(a => `<li><span>${esc(a.name)} ${a.check ? (a.check.difference ? `<span class="fin-badge fin-badge--danger" title="Oxirgi tekshiruv ${dateText(a.check.date)}">farq ${money(a.check.difference)}</span>` : `<span class="fin-badge fin-badge--ok" title="${dateText(a.check.date)} da tasdiqlangan">tasdiqlangan</span>`) : ''}${a.kind === 'clearing' ? ' <span class="fin-badge fin-badge--muted">pul emas</span>' : ''}</span><strong class="${a.balance < 0 ? 'neg' : ''}">${money(a.balance)}</strong></li>`).join('')}
                    <li class="fin-list-total"><span>Erkin pul (naqd, karta, bank)</span><strong>${money(o.accounts.filter(a => a.equivalent).reduce((n, a) => n + a.balance, 0))}</strong></li></ul>
                    ${scope() !== 'all' ? '<p class="fin-note">Yo‘nalish ko‘rinishida umumiy hisoblar bo‘yicha faqat shu maktabning pul oqimi ko‘rsatiladi. Haqiqiy qoldiq — Konsolidatsiyada.</p>' : ''}</section>
                <section class="fin-card" aria-labelledby="finCfH"><header><h3 id="finCfH">Pul oqimi (davr)</h3><button type="button" class="fin-link" data-fin-go="hisobotlar" data-fin-report="cashflow">Hisobot →</button></header>
                    <ul class="fin-list">
                        <li><span>Davr boshida</span><strong>${money(o.cashflow.openingCash + o.cashflow.openingInjection)}</strong></li>
                        <li><span>Operatsion faoliyat</span><strong class="${o.cashflow.net.operating < 0 ? 'neg' : 'pos'}">${money(o.cashflow.net.operating)}</strong></li>
                        <li><span>Investitsion faoliyat</span><strong class="${o.cashflow.net.investing < 0 ? 'neg' : ''}">${money(o.cashflow.net.investing)}</strong></li>
                        <li><span>Moliyaviy faoliyat</span><strong class="${o.cashflow.net.financing < 0 ? 'neg' : ''}">${money(o.cashflow.net.financing)}</strong></li>
                        <li class="fin-list-total"><span>Davr oxirida ${o.cashflow.reconciled ? '<span class="fin-badge fin-badge--ok">qoldiqlarga teng</span>' : '<span class="fin-badge fin-badge--danger">mos emas</span>'}</span><strong>${money(o.cashflow.closingCash)}</strong></li>
                    </ul>${o.cashflow.closingSuspense ? `<p class="fin-note">Shundan ${money(o.cashflow.closingSuspense)} “Aniqlanmagan” hisobda.</p>` : ''}</section>
            </div>
            <p class="fin-note">Tushum — Moliya reyestridan (to‘langan sana bo‘yicha), bekor qilingan yozuvlarsiz. Xarajatlar — “Operatsiyalar”da kiritilganlar va “Maoshlar” bo‘limi. Hisoblash usulida kurs ${o.settings.courseMonths.english} oy (ingliz) / ${o.settings.courseMonths.russian} oy (rus) davomida teng tan olinadi — bu sozlamadagi taxmin.</p>
        </div>`;
        bindToolbar(root, () => render('umumiy'));
        bindGo(root);
    }

    // ---------- Kassa va hisoblar ----------
    async function renderCash(root) {
        const o = state.overview, ckey = [scope(), state.start, state.end, state.cashAccount].join('|');
        if (!state.cashbook || state.cashbook._key !== ckey) {
            try { state.cashbook = await api(`/cashbook?scope=${scope()}&start=${state.start}&end=${state.end}&account=${encodeURIComponent(state.cashAccount)}`); state.cashbook._key = ckey; }
            catch (e) { state.cashbook = { error: e.message, days: [], _key: ckey }; }
        }
        const cb = state.cashbook;
        const cards = o.accounts.filter(a => a.active || a.balance).map(a => `<article class="fin-account" aria-label="${esc(a.name)}">
            <header><span class="fin-account-kind">${esc(F.ACCOUNT_KINDS[a.kind] || a.kind)}</span>${a.entity !== 'common' ? `<span class="fin-badge fin-badge--muted">${esc(F.ENTITIES[a.entity])}</span>` : ''}</header>
            <h4>${esc(a.name)}</h4><strong class="${a.balance < 0 ? 'neg' : ''}">${money(a.balance)}</strong>
            ${a.allocatedView ? '<p class="fin-check">Yo‘nalish ulushi — haqiqiy qoldiq Konsolidatsiyada</p>' : ''}
            <dl><div><dt>Kirim</dt><dd>${money(a.inflow)}</dd></div><div><dt>Chiqim</dt><dd>${money(a.outflow)}</dd></div>
            ${a.openingBalance ? `<div><dt>Boshlang‘ich (${dateText(a.openingDate)})</dt><dd>${money(a.openingBalance)}</dd></div>` : ''}</dl>
            ${a.check ? `<p class="fin-check ${a.check.difference ? 'bad' : 'good'}">${dateText(a.check.date)}: haqiqiy ${money(a.check.actual)}, kitobda ${money(a.check.book)}${a.check.difference ? ` — <b>farq ${money(a.check.difference)}</b>` : ' — mos'}</p>` : (a.equivalent ? '<p class="fin-check">Haqiqiy qoldiq bilan hali solishtirilmagan</p>' : '')}
            ${a.kind === 'clearing' && a.balance > 0 ? `<button type="button" class="btn-ghost btn-sm" data-fin-settle="${esc(a.id)}">Uzum’dan tushganini yozish</button>` : ''}
            ${a.equivalent && !a.allocatedView ? `<button type="button" class="btn-ghost btn-sm" data-fin-check="${esc(a.id)}">Haqiqiy qoldiqni kiritish</button>` : ''}
        </article>`).join('');
        const options = `<option value="">Barcha hisoblar</option>` + o.accountsList.map(a => `<option value="${esc(a.id)}" ${a.id === state.cashAccount ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
        const dayRows = (cb.days || []).slice().reverse().map(d => `<tr class="fin-day"><td><button type="button" class="fin-expand" aria-expanded="false" aria-controls="fin-day-${d.date}"><span aria-hidden="true">▸</span> ${dateText(d.date)}</button></td><td class="num">${acc(d.opening)}</td><td class="num pos">${num(d.inflow)}</td><td class="num neg">${d.outflow ? '(' + num(d.outflow) + ')' : '0'}</td><td class="num"><b>${acc(d.closing)}</b></td><td class="num">${d.entries.length}</td></tr>
            <tr class="fin-day-entries" id="fin-day-${d.date}" hidden><td colspan="6">${table(['Hisob', 'Turi', 'Kim / izoh', { label: 'Summa', num: true }],
                d.entries.map(m => `<tr class="${m.isReversal ? 'fin-reversal' : ''}"><td>${esc(accountName(m.account))}</td><td>${esc(m.source === 'receipt' ? (m.isReversal ? 'Tushum bekor qilindi' : 'Kurs to‘lovi') : catName(m.category))}${m.isReversal ? ' <span class="fin-badge fin-badge--muted">storno</span>' : ''}</td>
                <td>${esc(m.source === 'receipt' ? m.name + (m.managerName ? ' · ' + m.managerName : '') : [m.counterparty, m.description].filter(Boolean).join(' · '))}</td><td class="num ${m.sign < 0 ? 'neg' : 'pos'}">${m.sign < 0 ? '(' + num(m.amount) + ')' : num(m.amount)}</td></tr>`))}</td></tr>`);
        root.innerHTML = `<div class="fin-wrap">${toolbar({ actions: `<button type="button" class="btn-ghost" data-fin-new="transfer">O‘tkazma</button>` })}
            <div class="fin-accounts">${cards}</div>
            <section class="fin-card" aria-labelledby="finCbH"><header><h3 id="finCbH">Kunlik kassa daftari</h3><label class="fin-field fin-field--inline"><span>Hisob</span><select class="form-control" data-fin-cash-account>${options}</select></label></header>
            ${cb.error ? `<div class="fin-alert fin-alert--danger" role="alert">${ICON.danger}<span>${esc(cb.error)}</span></div>` : `<div class="fin-cash-summary">${stat('Davr boshiga', money(cb.openingBalance))}${stat('Kirim', money(cb.inflow), '', 'success')}${stat('Chiqim', money(cb.outflow), '', 'danger')}${stat('Davr oxiriga', money(cb.closingBalance))}</div>
            ${table(['Sana', { label: 'Kun boshiga', num: true }, { label: 'Kirim', num: true }, { label: 'Chiqim', num: true }, { label: 'Kun oxiriga', num: true }, { label: 'Yozuv', num: true }], dayRows, { empty: 'Bu davrda pul harakati yo‘q', cls: 'fin-cashbook', label: 'Kunlik kassa daftari' })}`}
            <p class="fin-note">Summalar so‘mda; qavs ichidagisi — chiqim. Bekor qilingan tushum yoki storno bekor qilingan kuni teskari yozuv bilan ko‘rinadi, asl yozuv o‘chirilmaydi.</p></section>
        </div>`;
        bindToolbar(root, () => render('kassa'));
        root.querySelector('[data-fin-cash-account]')?.addEventListener('change', e => { state.cashAccount = e.target.value; state.cashbook = null; render('kassa'); });
        root.querySelectorAll('.fin-expand').forEach(btn => btn.addEventListener('click', () => {
            const tr = document.getElementById(btn.getAttribute('aria-controls')), open = tr.hidden;
            tr.hidden = !open; btn.firstElementChild.textContent = open ? '▾' : '▸'; btn.setAttribute('aria-expanded', String(open));
        }));
        root.querySelectorAll('[data-fin-check]').forEach(b => b.addEventListener('click', () => openCheckModal(b.dataset.finCheck)));
        root.querySelectorAll('[data-fin-settle]').forEach(b => b.addEventListener('click', () => openTxnModal({ type: 'transfer', accountId: b.dataset.finSettle, toAccountId: 'acc-bank', settlement: true })));
        root.querySelector('[data-fin-new]')?.addEventListener('click', () => openTxnModal({ type: 'transfer' }));
    }

    // ---------- Operatsiyalar ----------
    async function renderOperations(root) {
        const tkey = [scope(), state.start, state.end].join('|');
        if (!state.txns || state.txns._key !== tkey) {
            try { state.txns = await api(`/transactions?scope=${scope()}&start=${state.start}&end=${state.end}`); state.txns._key = tkey; }
            catch (e) { state.txns = { error: e.message, rows: [], _key: tkey }; }
        }
        const t = state.txns, f = state.txFilter;
        const reversedIds = new Set((t.rows || []).filter(r => r.reversesId).map(r => r.reversesId));
        const rows = (t.rows || []).filter(r => (!f.type || r.type === f.type) && (!f.category || r.categoryCode === f.category)
            && (!f.search || [r.counterparty, r.description, catName(r.categoryCode)].join(' ').toLowerCase().includes(f.search.toLowerCase())));
        const isIn = r => ['income', 'capital', 'loan_in'].includes(r.type);
        const signed = r => (r.reversesId ? -1 : 1) * r.amount;
        const totalOut = rows.filter(r => !isIn(r) && r.type !== 'transfer').reduce((n, r) => n + signed(r), 0);
        const totalIn = rows.filter(isIn).reduce((n, r) => n + signed(r), 0);
        const byCat = {};
        for (const r of rows) if (r.type === 'expense') byCat[r.categoryCode] = (byCat[r.categoryCode] || 0) + signed(r);
        const catRows = Object.entries(byCat).filter(([, v]) => v).sort((a, b) => b[1] - a[1]);
        const catMax = Math.max(1, ...catRows.map(([, v]) => v));
        const quick = [['expense', '+ Xarajat'], ['income', '+ Boshqa tushum'], ['refund', 'Qaytarish'], ['capital', 'Ta’sischi kiritdi'], ['drawing', 'Ta’sischi oldi'], ['loan_in', 'Qarz olindi'], ['transfer', 'O‘tkazma']];
        root.innerHTML = `<div class="fin-wrap">${toolbar()}
            <div class="fin-quick" role="group" aria-label="Yangi operatsiya">${quick.map(([type, label]) => `<button type="button" class="fin-chip ${type === 'expense' ? 'fin-chip--primary' : ''}" data-fin-new="${type}">${label}</button>`).join('')}</div>
            <div class="fin-grid">
                <section class="fin-card fin-card--wide" aria-labelledby="finOpsH">
                    <header><h3 id="finOpsH">Operatsiyalar jurnali</h3>
                        <div class="fin-filters">
                            <label class="sr-only" for="finTxType">Tur</label><select id="finTxType" class="form-control" data-fin-tx-type><option value="">Barcha turlar</option>${Object.entries(F.TYPES).map(([k, l]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
                            <label class="sr-only" for="finTxCat">Toifa</label><select id="finTxCat" class="form-control" data-fin-tx-cat><option value="">Barcha toifalar</option>${F.CATEGORIES.filter(c => c.type !== 'receipt').map(c => `<option value="${c.code}" ${f.category === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
                            <label class="sr-only" for="finTxSearch">Qidirish</label><input id="finTxSearch" type="search" class="form-control" placeholder="Qidirish: kimga, izoh" data-fin-tx-search value="${esc(f.search)}">
                        </div></header>
                    ${t.error ? `<div class="fin-alert fin-alert--danger" role="alert">${ICON.danger}<span>${esc(t.error)}</span></div>` : table(['Sana', 'Turi / toifa', 'Kimga / izoh', 'Hisob', 'Yo‘nalish', { label: 'Summa', num: true }, ''],
                        rows.map(r => {
                            const v = (isIn(r) ? 1 : -1) * signed(r), reversed = reversedIds.has(r.id) || r.reversed;
                            return `<tr class="${r.reversesId ? 'fin-reversal' : reversed ? 'fin-reversed' : ''}">
                                <td>${dateText(r.date)}</td>
                                <td><b>${esc(F.TYPES[r.type])}</b><small>${esc(catName(r.categoryCode))}${r.usefulLifeMonths ? ` · ${r.usefulLifeMonths} oyda amortizatsiya` : ''}</small>${r.legacy ? '<span class="fin-badge fin-badge--warning" title="Eski Cash Flow bo‘limidan ko‘chirilgan — tekshiring">eski</span>' : ''}${r.reversesId ? '<span class="fin-badge fin-badge--muted">storno</span>' : ''}${reversed ? '<span class="fin-badge fin-badge--muted">bekor qilingan</span>' : ''}${r.salaryId ? '<span class="fin-badge fin-badge--muted">maosh</span>' : ''}${r.nonSalary ? '<span class="fin-badge fin-badge--muted">maosh tizimidan tashqari</span>' : ''}</td>
                                <td>${esc(r.counterparty)}<small>${esc(r.description)}</small>${r.receiptUrl ? `<a href="${esc(r.receiptUrl)}" class="fin-link">hujjat</a>` : ''}</td>
                                <td>${esc(accountName(r.accountId))}${r.toAccountId ? ' → ' + esc(accountName(r.toAccountId)) : ''}</td>
                                <td>${esc(F.ENTITIES[r.entity])}</td>
                                <td class="num ${r.type === 'transfer' ? '' : v < 0 ? 'neg' : 'pos'}">${r.type === 'transfer' ? num(r.amount) : v < 0 ? '(' + num(v) + ')' : num(v)}</td>
                                <td>${!r.reversesId && !reversed ? `<button type="button" class="fin-link fin-link--danger" data-fin-reverse="${esc(r.id)}" title="Teskari yozuv bilan bekor qilish (asl yozuv saqlanadi)">Storno</button>` : ''}</td></tr>`;
                        }), { empty: 'Bu davrda operatsiya kiritilmagan. Yuqoridagi tugmalar orqali xarajat va boshqa operatsiyalarni kiriting.', label: 'Operatsiyalar jurnali' })}
                    <div class="fin-totals"><span>Chiqimlar: <b class="neg">${money(totalOut)}</b></span><span>Kirimlar (kurs to‘lovidan tashqari): <b class="pos">${money(totalIn)}</b></span></div>
                </section>
                <section class="fin-card" aria-labelledby="finExpH"><header><h3 id="finExpH">Xarajatlar tarkibi</h3></header>
                    ${catRows.length ? `<ul class="fin-bars">${catRows.map(([code, v]) => `<li><span>${esc(catName(code))}</span><b>${money(v)}</b><div class="fin-bar-track" aria-hidden="true"><i style="width:${Math.max(2, Math.round(v / catMax * 100))}%"></i></div></li>`).join('')}</ul>` : '<p class="fin-empty">Xarajat kiritilmagan</p>'}
                    <p class="fin-note">Maoshlar “Maoshlar” bo‘limida hisoblanib, to‘langanda shu yerda paydo bo‘ladi.</p>
                </section>
            </div>
            <p class="fin-note">1 000 000 so‘mdan katta xarajat, har qanday qaytarish va ta’sischiga to‘lov uchun hujjat majburiy. Xato kiritilgan operatsiya o‘chirilmaydi — “Storno” teskari yozuv qo‘shadi va ikkalasi ham jurnalda qoladi.</p>
        </div>`;
        bindToolbar(root, () => render('operatsiyalar'));
        root.querySelectorAll('[data-fin-new]').forEach(b => b.addEventListener('click', () => openTxnModal({ type: b.dataset.finNew })));
        root.querySelector('[data-fin-tx-type]')?.addEventListener('change', e => { f.type = e.target.value; render('operatsiyalar'); });
        root.querySelector('[data-fin-tx-cat]')?.addEventListener('change', e => { f.category = e.target.value; render('operatsiyalar'); });
        const search = root.querySelector('[data-fin-tx-search]');
        search?.addEventListener('input', () => { clearTimeout(search._t); search._t = setTimeout(async () => { f.search = search.value; await render('operatsiyalar'); const s = panelRoot('operatsiyalar').querySelector('[data-fin-tx-search]'); s?.focus(); s?.setSelectionRange(s.value.length, s.value.length); }, 300); });
        root.querySelectorAll('[data-fin-reverse]').forEach(b => b.addEventListener('click', () => openReverseModal(b.dataset.finReverse)));
    }

    // ---------- Qarzlar ----------
    function renderDebts(root) {
        const o = state.overview, ar = o.receivables, ap = o.payables, tab = state.debtTab;
        const arView = `<div class="fin-aging">${ar.buckets.map(b => `<div class="fin-aging-cell fin-aging--${b.key}"><span>${b.label}</span><strong>${money(b.amount)}</strong><small>${b.count} ta · ${pctText(b.share)}</small></div>`).join('')}</div>
            ${table(['O‘quvchi', 'Telefon', 'Yo‘nalish', { label: 'Qarz', num: true }, 'To‘lov sanasi', { label: 'Kechikish', num: true }, 'Holat'],
                ar.rows.slice(0, 500).map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.phone || '')}</td><td>${esc(F.ENTITIES[r.entity])}</td><td class="num"><b>${num(r.debt)}</b></td><td>${dateText(r.dueDate)}</td>
                    <td class="num ${r.overdueDays > 30 ? 'neg' : ''}">${r.overdueDays ? r.overdueDays + ' kun' : '—'}</td><td>${r.frozen ? '<span class="fin-badge fin-badge--muted">muzlatilgan</span>' : esc(r.status || '')}</td></tr>`),
                { empty: 'Qarzdor o‘quvchi yo‘q', label: 'O‘quvchilar qarzi' })}
            <p class="fin-note">Bu — o‘quvchi kartalaridagi <b>bugungi</b> to‘lov jadvali (operatsion nazorat uchun). Balansga faqat o‘tilgan darslar uchun to‘lanmagan qism (shartnoma aktivi) kiradi, kelgusi oylar uchun kutilayotgan to‘lov aktiv emas. Kutilayotgan kredit zarari (ECL) zaxirasi Sozlamalardagi stavkalar bo‘yicha hisoblanadi.</p>`;
        const kindLabel = { salary: 'Maosh', bill: 'Hisob-faktura', loan: 'Olingan qarz', other: 'Boshqa' };
        const apView = `<div class="fin-stats fin-stats--compact">${stat('Jami', money(ap.total))}${stat('Maosh (hisoblangan, to‘lanmagan)', money(ap.salaries), ap.unreconciledSalaries ? `shundan “to‘landi” deb belgilangan, kassaga yozilmagan: ${money(ap.unreconciledSalaries)}` : '')}${stat('Hisob-fakturalar', money(ap.bills + ap.other))}${stat('Olingan qarzlar', money(ap.loans))}${stat('Muddati o‘tgan', money(ap.overdue), '', ap.overdue ? 'danger' : '')}</div>
            ${table(['Turi', 'Kimga', 'Izoh', 'Hujjat sanasi', 'Muddat', { label: 'Jami', num: true }, { label: 'To‘langan', num: true }, { label: 'Qoldiq', num: true }, ''],
                ap.rows.map(r => `<tr><td><span class="fin-badge fin-badge--${r.kind === 'loan' ? 'warning' : 'muted'}">${kindLabel[r.kind]}</span>${r.unreconciled ? ' <span class="fin-badge fin-badge--warning" title="Maoshlar bo‘limida to‘landi deb belgilangan, lekin kassadan chiqim yozilmagan">kassaga yozilmagan</span>' : ''}</td><td>${esc(r.counterparty)}</td><td>${esc(r.description)}<small>${esc(catName(r.categoryCode))}</small></td>
                    <td>${dateText(r.issueDate)}</td><td class="${r.overdueDays ? 'neg' : ''}">${dateText(r.dueDate)}${r.overdueDays ? ` <small>${r.overdueDays} kun o‘tgan</small>` : ''}</td>
                    <td class="num">${num(r.amount)}</td><td class="num">${num(r.paid)}</td><td class="num"><b>${num(r.outstanding)}</b></td>
                    <td>${r.kind === 'salary' ? (r.unreconciled ? `<button type="button" class="btn-ghost btn-sm" data-fin-salary="${esc(r.salaryId)}">Kassadan chiqim</button>` : '<span class="fin-muted">Maoshlar bo‘limida to‘lanadi</span>') : `<button type="button" class="btn-ghost btn-sm" data-fin-pay="${esc(r.id)}">To‘lash</button>${r.kind !== 'loan' && !r.paid ? ` <button type="button" class="fin-link fin-link--danger" data-fin-void-payable="${esc(r.id)}">Bekor</button>` : ''}`}</td></tr>`),
                { empty: 'Korxonaning to‘lanmagan qarzi yo‘q', label: 'Korxona qarzlari' })}
            <p class="fin-note">Maosh to‘lash muddati — davr tugagandan keyin ${o.settings.salaryDueDays} kun (sozlama). Hisob-faktura kiritilganda xarajat hisoblash usulida hujjat sanasida, kassa usulida to‘langanda tan olinadi.</p>`;
        root.innerHTML = `<div class="fin-wrap">${toolbar({ actions: `<button type="button" class="btn-primary-sm" data-fin-new-payable>+ Hisob-faktura</button><button type="button" class="btn-ghost" data-fin-new="loan_in">Qarz olindi</button>` })}
            ${tabs('Qarzlar', [['receivables', `Bizga qarzlar · ${money(ar.total)}`], ['payables', `Bizning qarzlarimiz · ${money(ap.total)}`]], tab, 'debt')}
            <section class="fin-card" role="tabpanel" id="fin-panel-debt" aria-labelledby="fin-tab-debt-${tab}">${tab === 'receivables' ? arView : apView}</section></div>`;
        bindToolbar(root, () => render('qarzlar'));
        bindTabs(root, 'debt', (v, focus) => { state.debtTab = v; render('qarzlar'); if (focus) panelRoot('qarzlar').querySelector(`[data-fin-tab-debt="${v}"]`)?.focus(); });
        root.querySelector('[data-fin-new-payable]')?.addEventListener('click', openPayableModal);
        root.querySelector('[data-fin-new]')?.addEventListener('click', () => openTxnModal({ type: 'loan_in' }));
        root.querySelectorAll('[data-fin-salary]').forEach(b => b.addEventListener('click', () => openSalaryModal(b.dataset.finSalary)));
        root.querySelectorAll('[data-fin-pay]').forEach(b => b.addEventListener('click', () => {
            const p = ap.rows.find(r => r.id === b.dataset.finPay);
            openTxnModal(p.kind === 'loan' ? { type: 'loan_repay', payableId: p.id, amount: p.outstanding, entity: p.entity, counterparty: p.counterparty }
                : { type: 'expense', payableId: p.id, categoryCode: p.categoryCode, amount: p.outstanding, entity: p.entity, counterparty: p.counterparty, description: p.description });
        }));
        root.querySelectorAll('[data-fin-void-payable]').forEach(b => b.addEventListener('click', () => openReasonModal('Hisob-fakturani bekor qilish', 'Bekor qilish', async reason => { await api('/payables/' + encodeURIComponent(b.dataset.finVoidPayable) + '/void', { reason }); })));
    }

    // ---------- Hisobotlar ----------
    const NEG_LINES = new Set(['refunds', 'cost_of_services', 'sales_payroll', 'marketing', 'admin_payroll', 'payroll_tax', 'rent', 'software', 'admin', 'payment_fees', 'turnover_tax', 'credit_losses', 'allocated_common', 'opex', 'depreciation', 'finance_cost', 'other_expense', 'income_tax']);
    const ALWAYS = new Set(['revenue', 'refunds', 'net_revenue', 'cost_of_services', 'gross_profit', 'opex', 'ebitda', 'depreciation', 'ebit', 'profit_before_tax', 'income_tax', 'net_profit']);
    function pnlTable(p, other) {
        const show = (key, v) => NEG_LINES.has(key) ? (v ? (v > 0 ? '(' + num(v) + ')' : num(v)) : '—') : acc(v);
        const rows = p.lines.filter(l => ALWAYS.has(l.key) || l.amount || other.lines.find(x => x.key === l.key)?.amount).map(l => {
            const ol = other.lines.find(x => x.key === l.key);
            const margin = { gross_profit: p.margins.gross, ebitda: p.margins.ebitda, net_profit: p.margins.net }[l.key];
            const share = margin != null ? pctText(margin) : l.key !== 'revenue' && l.amount ? pctText(F.pct(l.amount, p.net_revenue)) : '';
            return `<tr class="fin-pnl-${l.kind}"><th scope="row">${esc(l.label)}${l.key === 'allocated_common' && p.allocation ? ` <small>(${p.allocation.share}%)</small>` : ''}</th><td class="num">${show(l.key, l.amount)}</td><td class="num fin-muted">${share}</td><td class="num fin-muted">${show(l.key, ol?.amount || 0)}</td></tr>`;
        });
        const btl = p.belowTheLine, memo = (label, v, neg) => `<tr><th scope="row" class="fin-indent">${label}</th><td class="num">${v ? (neg ? '(' + num(v) + ')' : num(v)) : '—'}</td><td></td><td></td></tr>`;
        return `<div class="fin-table-wrap" role="region" aria-label="Foyda va zarar" tabindex="0"><table class="fin-table fin-report"><caption class="sr-only">Foyda va zarar hisoboti</caption><thead><tr><th scope="col">Ko‘rsatkich</th><th scope="col" class="num">${p.basis === 'cash' ? 'Kassa usuli' : 'Hisoblash usuli'}</th><th scope="col" class="num">Sof tushumga %</th><th scope="col" class="num">${other.basis === 'cash' ? 'Kassa usuli' : 'Hisoblash usuli'}</th></tr></thead><tbody>${rows.join('')}
            <tr class="fin-pnl-section"><td colspan="4">Foyda-zararga kirmaydigan pul harakatlari</td></tr>
            ${memo('Kapital xarajatlar (uskuna, aktivlar)', btl.capex, true)}${memo('Ta’sischiga to‘langan mablag‘', btl.ownerDrawings, true)}${memo('Ta’sischi kiritgan mablag‘', btl.ownerContributions)}${memo('Olingan qarzlar', btl.loansReceived)}${memo('Qaytarilgan qarzlar (asosiy qarz)', btl.loansRepaid, true)}
        </tbody></table></div>
        ${p.priorDetail?.length ? `<p class="fin-note">O‘tgan davr tuzatishi: ${p.priorDetail.map(d => `${monthName(d.month)}: ${money(d.amount)}`).join(', ')}. Yopilgan oy raqamlari o‘zgarmagan, farq shu davrga kiritildi.</p>` : ''}
        ${p.partialClosed ? '<p class="fin-note">Diqqat: tanlangan davr yopilgan oyning bir qismini o‘z ichiga oladi — u qism joriy ma’lumotdan hisoblandi. Muzlatilgan raqam uchun to‘liq oyni tanlang.</p>' : ''}
        ${p.allocation ? `<p class="fin-note">Umumiy xarajatlar (ijara, CRM, umumiy reklama va h.k.) maktablar o‘rtasida sof tushum ulushiga ko‘ra taqsimlandi: shu maktab ulushi ${p.allocation.share}%, umumiy natija ${money(p.allocation.commonResult)}.</p>` : ''}`;
    }
    function cashflowTable(cf) {
        const section = (title, lines, net) => `<tr class="fin-pnl-section"><td colspan="2">${title}</td></tr>${lines.map(l => `<tr><th scope="row" class="fin-indent">${esc(l.label)}</th><td class="num">${l.amount ? acc(l.amount) : '—'}</td></tr>`).join('')}<tr class="fin-pnl-subtotal"><th scope="row">${title} — sof pul oqimi</th><td class="num">${acc(net)}</td></tr>`;
        return `<div class="fin-table-wrap" role="region" aria-label="Pul oqimlari" tabindex="0"><table class="fin-table fin-report"><caption class="sr-only">Pul oqimlari hisoboti</caption><thead><tr><th scope="col">Moddalar (IAS 7, to‘g‘ridan-to‘g‘ri usul)</th><th scope="col" class="num">so‘m</th></tr></thead><tbody>
            ${section('Operatsion faoliyat', cf.operating, cf.net.operating)}${section('Investitsion faoliyat', cf.investing, cf.net.investing)}${section('Moliyaviy faoliyat', cf.financing, cf.net.financing)}
            <tr class="fin-pnl-total"><th scope="row">Pul mablag‘larining sof o‘zgarishi</th><td class="num">${acc(cf.netChange)}</td></tr>
            <tr><th scope="row">Davr boshidagi pul mablag‘lari</th><td class="num">${acc(cf.openingCash)}</td></tr>
            ${cf.openingInjection ? `<tr><th scope="row">Davr ichida ochilgan hisoblarning boshlang‘ich qoldig‘i</th><td class="num">${acc(cf.openingInjection)}</td></tr>` : ''}
            <tr class="fin-pnl-total"><th scope="row">Davr oxiridagi pul mablag‘lari ${cf.reconciled ? '<span class="fin-badge fin-badge--ok">hisob qoldiqlariga teng</span>' : `<span class="fin-badge fin-badge--danger">farq ${num(cf.difference)}</span>`}</th><td class="num">${acc(cf.closingCash)}</td></tr>
            ${cf.closingSuspense ? `<tr><th scope="row" class="fin-indent">shundan “Aniqlanmagan” hisobda</th><td class="num">${acc(cf.closingSuspense)}</td></tr>` : ''}
        </tbody></table></div>
        <p class="fin-note">Pul mablag‘lari — naqd, karta, bank va “Aniqlanmagan” hisob. Uzum Nasiya orqali sotuv Uzum pulni o‘tkazgan kuni “o‘quvchilardan olingan to‘lov” bo‘lib kiradi; Uzum komissiyasi pul oqimi emas (pul hech qachon kelmagan), lekin foyda-zararda xarajat.</p>`;
    }
    function balanceTable(b) {
        if (scope() !== 'all') return `<div class="fin-alert fin-alert--warning" role="status">${ICON.warning}<span>Balans faqat butun korxona bo‘yicha tuziladi: kassa, bank va qarzlar ikkala maktab uchun umumiy. Quyida butun korxona balansi ko‘rsatilgan.</span></div>` + balanceBody(b);
        return balanceBody(b);
    }
    function balanceBody(b) {
        const r = (label, v, cls = '', indent) => `<tr class="${cls}"><th scope="row" ${indent ? 'class="fin-indent"' : ''}>${label}</th><td class="num">${acc(v)}</td></tr>`;
        return `<div class="fin-table-wrap" role="region" aria-label="Balans" tabindex="0"><table class="fin-table fin-report"><caption class="sr-only">Boshqaruv balansi</caption><thead><tr><th scope="col">${dateText(b.asOf)} holatiga ${b.fromSnapshot ? '<span class="fin-badge fin-badge--muted">muzlatilgan</span>' : ''}</th><th scope="col" class="num">so‘m</th></tr></thead><tbody>
            <tr class="fin-pnl-section"><td colspan="2">Aktivlar</td></tr>
            ${r('Pul mablag‘lari (naqd, karta, bank)', b.cashEquivalents, '', true)}
            ${b.suspense ? r('Aniqlanmagan hisobdagi pul (tekshiruvda)', b.suspense, '', true) : ''}
            ${r('Uzum Nasiya’dan olinadigan summa', b.uzumReceivable, '', true)}
            ${r('O‘tilgan darslar uchun to‘lanmagan summa (shartnoma aktivi)', b.contractAssets, '', true)}
            ${b.ecl ? r('(−) Kutilayotgan kredit zarari zaxirasi (ECL)', -b.ecl, '', true) : ''}
            ${b.ppeCost ? r('Asosiy vositalar (boshlang‘ich qiymat)', b.ppeCost, '', true) + r('(−) Jamg‘arilgan amortizatsiya', -b.ppeDepreciation, '', true) : ''}
            ${r('Aktivlar jami', b.totalAssets, 'fin-pnl-total')}
            <tr class="fin-pnl-section"><td colspan="2">Majburiyatlar</td></tr>
            ${r('O‘quvchilardan oldindan olingan to‘lov (kelgusi darslar uchun)', b.contractLiabilities, '', true)}
            ${r('Hisoblangan, to‘lanmagan maosh', b.payables.salaries, '', true)}
            ${r('Yetkazib beruvchilarga qarz (hisob-fakturalar)', b.payables.bills + b.payables.other, '', true)}
            ${r('Olingan qarzlar', b.loans, '', true)}
            ${r('Majburiyatlar jami', b.totalLiabilities, 'fin-pnl-total')}
            ${r('Sof aktivlar', b.netAssets, 'fin-pnl-total fin-pnl-grand')}
            <tr class="fin-pnl-section"><td colspan="2">Kapital harakati (tekshiruv)</td></tr>
            ${r('Boshlang‘ich qoldiqlar (hisoblar ochilganda)', b.equity.opening, '', true)}
            ${r('Ta’sischi kiritgan mablag‘', b.equity.contributions, '', true)}
            ${r('(−) Ta’sischi olgan mablag‘', -b.equity.drawings, '', true)}
            ${r('Jamg‘arilgan foyda (hisoblash usulida)', b.equity.retained, '', true)}
            ${b.equity.preOpening ? r('(−) Hisob ochilishidan oldingi harakatlar (boshlang‘ich qoldiq ichida)', -b.equity.preOpening, '', true) : ''}
            <tr class="fin-pnl-total"><th scope="row">Kapital jami ${b.balanced ? '<span class="fin-badge fin-badge--ok">Sof aktivlarga teng</span>' : `<span class="fin-badge fin-badge--danger">farq ${num(b.imbalance)}</span>`}</th><td class="num">${acc(b.equity.total)}</td></tr>
        </tbody></table></div>
        <p class="fin-note">Shartnoma aktivi va majburiyati IFRS 15 bo‘yicha har bir o‘qish davri uchun sof holda: o‘tilgan dars qiymati minus olingan pul. Kelgusi oylar uchun hali kelmagan to‘lov aktiv sifatida ko‘rsatilmaydi. Balans tenglamasi har safar avtomatik tekshiriladi.</p>`;
    }
    function monthlyTable(rows) {
        const metrics = [['revenue', 'Kurs to‘lovlari'], ['refunds', 'Qaytarishlar'], ['net_revenue', 'Sof tushum'], ['cost_of_services', 'Xizmat tannarxi'], ['gross_profit', 'Yalpi foyda'], ['opex', 'Operatsion xarajatlar'], ['ebitda', 'EBITDA'], ['net_profit', 'Sof foyda']];
        const neg = k => ['refunds', 'cost_of_services', 'opex'].includes(k);
        const cell = (k, v) => neg(k) ? (v ? '(' + num(v) + ')' : '—') : acc(v);
        return `<div class="fin-table-wrap" role="region" aria-label="Oylik taqqoslash" tabindex="0"><table class="fin-table fin-report"><caption class="sr-only">Oylik taqqoslash</caption><thead><tr><th scope="col">Ko‘rsatkich</th>${rows.map(r => `<th scope="col" class="num">${monthName(r.month)}${r.closed ? ' •' : ''}</th>`).join('')}<th scope="col" class="num">Jami</th></tr></thead><tbody>
            ${metrics.map(([k, l]) => `<tr class="${['net_revenue', 'gross_profit', 'ebitda', 'net_profit'].includes(k) ? 'fin-pnl-total' : ''}"><th scope="row">${l}</th>${rows.map(r => `<td class="num">${cell(k, r[k])}</td>`).join('')}<td class="num">${cell(k, rows.reduce((n, r) => n + r[k], 0))}</td></tr>`).join('')}
            <tr><th scope="row">Sof foyda marjasi</th>${rows.map(r => `<td class="num fin-muted">${pctText(F.pct(r.net_profit, r.net_revenue))}</td>`).join('')}<td></td></tr>
        </tbody></table></div><p class="fin-note">• — yopilgan (muzlatilgan) oy.</p>`;
    }
    function renderReports(root) {
        const o = state.overview, r = state.report;
        const items = [['pnl', 'Foyda va zarar'], ['cashflow', 'Pul oqimlari'], ['balance', 'Balans'], ['monthly', 'Oylik taqqoslash']];
        const body = r === 'cashflow' ? cashflowTable(o.cashflow) : r === 'balance' ? balanceTable(o.balance) : r === 'monthly' ? monthlyTable(o.monthly) : pnlTable(o.pnl, o.pnlOther);
        root.innerHTML = `<div class="fin-wrap">${toolbar({ basis: r === 'pnl' || r === 'monthly', actions: `<button type="button" class="btn-ghost" data-fin-export>Excel</button><button type="button" class="btn-ghost" data-fin-print>PDF / chop etish</button>` })}
            ${tabs('Hisobot turi', items, r, 'report')}
            <section class="fin-card fin-print-area" role="tabpanel" id="fin-panel-report" aria-labelledby="fin-tab-report-${r}">
                <header class="fin-report-head"><div><h3>${items.find(t => t[0] === r)[1]}</h3><p class="fin-muted">${esc(r === 'balance' ? 'Butun korxona' : scopeLabel())} · ${r === 'balance' ? dateText(o.period.end) + ' holatiga' : dateText(o.period.start) + ' — ' + dateText(o.period.end)} · so‘mda</p></div></header>
                ${body}
                <footer class="fin-report-foot">Tayyorlandi: ${new Date().toLocaleString('uz-UZ')} · Manba: Myhomework CRM moliya reyestri · Storno va bekor qilingan yozuvlar hisobga olingan. ${o.closedThrough ? `${esc(o.closedThrough)} gacha bo‘lgan oylar yopilgan va muzlatilgan.` : 'Hali yopilgan oy yo‘q — raqamlar tuzatishlar bilan o‘zgarishi mumkin.'} Audit jurnali: ${o.auditChain.ok ? 'butun' : 'uzilgan!'} (${o.auditChain.count} ta yozuv).</footer>
            </section></div>`;
        bindToolbar(root, () => render('hisobotlar'));
        bindTabs(root, 'report', (v, focus) => { state.report = v; render('hisobotlar'); if (focus) panelRoot('hisobotlar').querySelector(`[data-fin-tab-report="${v}"]`)?.focus(); });
        root.querySelector('[data-fin-print]')?.addEventListener('click', () => { document.body.classList.add('fin-printing'); window.print(); setTimeout(() => document.body.classList.remove('fin-printing'), 500); });
        root.querySelector('[data-fin-export]')?.addEventListener('click', exportExcel);
    }
    async function exportExcel() {
        try {
            const XLSX = await loadXlsxLib(), o = state.overview, wb = XLSX.utils.book_new();
            const head = t => [[t], [scopeLabel()], [`${dateText(o.period.start)} — ${dateText(o.period.end)}`], []];
            const pnl = [...head('Foyda va zarar (' + (o.pnl.basis === 'cash' ? 'kassa usuli' : 'hisoblash usuli') + ')'), ['Ko‘rsatkich', 'so‘m', 'Sof tushumga %', o.pnlOther.basis === 'cash' ? 'Kassa usuli' : 'Hisoblash usuli'],
                ...o.pnl.lines.map(l => [l.label, l.amount, l.key === 'revenue' ? '' : F.pct(l.amount, o.pnl.net_revenue), o.pnlOther.lines.find(x => x.key === l.key)?.amount || 0]), [],
                ['Kapital xarajatlar', o.pnl.belowTheLine.capex], ['Ta’sischiga to‘langan', o.pnl.belowTheLine.ownerDrawings], ['Ta’sischi kiritgan', o.pnl.belowTheLine.ownerContributions],
                ['Olingan qarzlar', o.pnl.belowTheLine.loansReceived], ['Qaytarilgan qarzlar', o.pnl.belowTheLine.loansRepaid]];
            const cf = o.cashflow;
            const cfRows = [...head('Pul oqimlari hisoboti (IAS 7)'), ['Modda', 'so‘m'], ['Operatsion faoliyat'], ...cf.operating.map(l => ['  ' + l.label, l.amount]), ['Sof operatsion oqim', cf.net.operating],
                ['Investitsion faoliyat'], ...cf.investing.map(l => ['  ' + l.label, l.amount]), ['Sof investitsion oqim', cf.net.investing],
                ['Moliyaviy faoliyat'], ...cf.financing.map(l => ['  ' + l.label, l.amount]), ['Sof moliyaviy oqim', cf.net.financing], [],
                ['Sof o‘zgarish', cf.netChange], ['Davr boshida', cf.openingCash], ['Ochilgan hisoblarning boshlang‘ich qoldig‘i', cf.openingInjection], ['Davr oxirida', cf.closingCash], ['Hisob qoldiqlariga teng', cf.reconciled ? 'Ha' : 'Yo‘q: ' + cf.difference]];
            const b = o.balance;
            const bs = [[`Boshqaruv balansi ${dateText(b.asOf)} (butun korxona)${b.fromSnapshot ? ' — muzlatilgan' : ''}`], [], ['Modda', 'so‘m'], ['Pul mablag‘lari', b.cashEquivalents], ['Aniqlanmagan hisobda', b.suspense], ['Uzum’dan olinadigan', b.uzumReceivable], ['Shartnoma aktivi', b.contractAssets], ['ECL zaxirasi', -b.ecl],
                ['Asosiy vositalar (sof)', b.ppeNet], ['Aktivlar jami', b.totalAssets], [], ['Oldindan olingan to‘lov', b.contractLiabilities], ['To‘lanmagan maosh', b.payables.salaries], ['Hisob-fakturalar', b.payables.bills + b.payables.other],
                ['Olingan qarzlar', b.loans], ['Majburiyatlar jami', b.totalLiabilities], [], ['Sof aktivlar', b.netAssets], [], ['Boshlang‘ich qoldiqlar', b.equity.opening], ['Ta’sischi kiritgan', b.equity.contributions],
                ['Ta’sischi olgan', -b.equity.drawings], ['Jamg‘arilgan foyda', b.equity.retained], ['Hisob ochilishidan oldingi harakatlar', -b.equity.preOpening], ['Kapital jami', b.equity.total], ['Tenglama', b.balanced ? 'Mos' : 'Farq: ' + b.imbalance]];
            const monthly = [...head('Oylik taqqoslash'), ['Oy', 'Kurs to‘lovlari', 'Qaytarishlar', 'Sof tushum', 'Xizmat tannarxi', 'Yalpi foyda', 'Operatsion xarajatlar', 'EBITDA', 'Sof foyda', 'Yopilgan'],
                ...o.monthly.map(r => [r.month, r.revenue, r.refunds, r.net_revenue, r.cost_of_services, r.gross_profit, r.opex, r.ebitda, r.net_profit, r.closed ? 'ha' : ''])];
            const ar = [['Debitorlik (bugungi holat)'], [], ['O‘quvchi', 'Telefon', 'Yo‘nalish', 'Qarz', 'To‘lov sanasi', 'Kechikish (kun)'], ...o.receivables.rows.map(r => [r.name, r.phone, F.ENTITIES[r.entity], r.debt, r.dueDate, r.overdueDays])];
            const ap = [...head('Kreditorlik'), ['Turi', 'Kimga', 'Izoh', 'Hujjat sanasi', 'Muddat', 'Jami', 'To‘langan', 'Qoldiq'], ...o.payables.rows.map(r => [r.kind, r.counterparty, r.description, r.issueDate, r.dueDate, r.amount, r.paid, r.outstanding])];
            for (const [name, rows] of [['P&L', pnl], ['Cash Flow', cfRows], ['Balans', bs], ['Oylik', monthly], ['Debitorlik', ar], ['Kreditorlik', ap]]) {
                const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 52 }, ...Array(9).fill({ wch: 16 })];
                XLSX.utils.book_append_sheet(wb, ws, name);
            }
            XLSX.writeFile(wb, `Moliya_${scope()}_${o.period.start}_${o.period.end}.xlsx`);
        } catch (e) { toast('Excel faylni yaratib bo‘lmadi: ' + e.message); }
    }

    // ---------- Solishtirish va audit ----------
    async function readStatementFile(file) {
        if (/\.pdf$/i.test(file.name)) {
            await _ensurePdfJsLoaded();
            const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
            const lines = [];
            for (let p = 1; p <= doc.numPages; p++) {
                const tc = await (await doc.getPage(p)).getTextContent(), rows = {};
                for (const it of tc.items) { const y = Math.round(it.transform[5]); (rows[y] ||= []).push([it.transform[4], it.str]); }
                Object.keys(rows).map(Number).sort((a, b) => b - a).forEach(y => lines.push(rows[y].sort((a, b) => a[0] - b[0]).map(x => x[1]).filter(s => s.trim()).join(' | ')));
            }
            return lines.join('\n');
        }
        if (/\.(xlsx|xls)$/i.test(file.name)) {
            const XLSX = await loadXlsxLib();
            const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true });
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
            return rows.map(r => r.map(c => c instanceof Date ? `${String(c.getDate()).padStart(2, '0')}.${String(c.getMonth() + 1).padStart(2, '0')}.${c.getFullYear()}` : String(c)).join(' | ')).join('\n');
        }
        return file.text();
    }
    const STATUS = { match: ['Mos', 'ok'], split: ['Bo‘lib kiritilgan', 'ok'], date_diff: ['Sana farqi', 'warning'], amount_diff: ['Summa farqi', 'danger'], missing_in_crm: ['CRM’da yo‘q', 'danger'], extra_in_crm: ['Ro‘yxatda yo‘q', 'warning'] };
    function proposal(r, id) {
        const x = r.result.results[id], e = x.external, l = x.ledger, link = r.links[id];
        if (x.status === 'amount_diff' && x.ledgers.length === 1) return { kind: 'replace', replacesId: l.id, date: l.date, amount: e.amount, text: `Summani ${num(l.amount)} → ${num(e.amount)}` };
        if (x.status === 'date_diff') return { kind: 'replace', replacesId: l.id, date: e.date, amount: l.amount, text: `Sanani ${dateText(l.date)} → ${dateText(e.date)}` };
        if (x.status === 'extra_in_crm') return { kind: 'void', recordId: l.id, text: 'Bekor qilish (ro‘yxatda yo‘q)' };
        if (x.status === 'missing_in_crm' && link) return { kind: 'add', date: e.date, amount: e.amount, method: link.method, leadId: link.leadId, studentId: link.studentId, text: `Qo‘shish: ${link.name} (${PaymentLedger.METHODS[link.method]})` };
        return null;
    }
    function reconView() {
        const r = state.recon;
        if (!r) return '';
        if (!r.result) {
            const maxCols = Math.max(0, ...r.parsed.map(x => x.amounts.length));
            return `<section class="fin-card" aria-labelledby="finR2"><header><h3 id="finR2">2. Summa ustunini tanlang</h3><span class="fin-muted">${r.parsed.length} ta qator · ${esc(r.fileName || 'matn')}</span></header>
                ${maxCols ? `<fieldset class="fin-recon-cols"><legend class="sr-only">Summa ustuni</legend>${Array.from({ length: maxCols }, (_, i) => `<label class="fin-radio"><input type="radio" name="finCol" value="${i}" ${r.column === i ? 'checked' : ''}> ${i + 1}-summa ustuni</label>`).join('')}
                    <label class="fin-radio"><input type="radio" name="finCol" value="-1" ${r.column === -1 ? 'checked' : ''}> Har qatordagi oxirgi summa</label></fieldset>` : `<div class="fin-alert fin-alert--warning">${ICON.warning}<span>Summalar topilmadi</span></div>`}
                ${table(['Sana', 'Ism', 'Telefon', ...Array.from({ length: maxCols }, (_, i) => ({ label: (i + 1) + '-summa', num: true }))],
                    r.parsed.slice(0, 8).map(x => `<tr><td>${dateText(x.date)}</td><td>${esc(x.name)}</td><td>${esc(x.phone)}</td>${Array.from({ length: maxCols }, (_, i) => `<td class="num ${i === (r.column === -1 ? x.amounts.length - 1 : r.column) ? 'fin-pick' : ''}">${x.amounts[i] != null ? num(x.amounts[i]) : ''}</td>`).join('')}</tr>`))}
                <div class="fin-actions"><label class="fin-field fin-field--inline"><span>Ruxsat etilgan sana farqi (kun)</span><input type="number" min="0" max="10" value="${r.tolerance}" class="form-control fin-narrow" data-fin-recon-tol></label>
                <button type="button" class="btn-primary-sm" data-fin-recon-run>Solishtirish</button></div></section>`;
        }
        const res = r.result, filter = r.filter || 'problems';
        const ids = res.results.map((_, i) => i).filter(i => { const s = res.results[i].status; return filter === 'all' || (filter === 'problems' ? !['match', 'split'].includes(s) : s === filter); });
        const picked = [...r.picked].map(i => ({ i, p: proposal(r, i) })).filter(x => x.p);
        const ok = res.counts.match + res.counts.split;
        return `<section class="fin-card" aria-labelledby="finR3"><header><h3 id="finR3">3. Natija: ${ok} mos, ${res.results.length - ok} farq</h3><span class="fin-muted">${dateText(res.start)} — ${dateText(res.end)}</span></header>
            <div class="fin-stats fin-stats--compact">${stat('Tashqi ro‘yxat jami', money(res.totalExternal))}${stat('CRM reyestri jami', money(res.totalLedger))}${stat('Farq (CRM − ro‘yxat)', money(res.difference), '', res.difference ? 'danger' : 'success')}</div>
            <div class="fin-filter-chips" role="group" aria-label="Holat bo‘yicha filtr">${Object.entries(res.counts).map(([k, v]) => `<button type="button" class="fin-chip ${filter === k ? 'active' : ''}" aria-pressed="${filter === k}" data-fin-recon-filter="${k}"><span class="fin-dot-badge fin-dot-badge--${STATUS[k][1]}" aria-hidden="true"></span>${STATUS[k][0]}: ${v}</button>`).join('')}
                <button type="button" class="fin-chip ${filter === 'problems' ? 'active' : ''}" aria-pressed="${filter === 'problems'}" data-fin-recon-filter="problems">Faqat farqlar</button><button type="button" class="fin-chip ${filter === 'all' ? 'active' : ''}" aria-pressed="${filter === 'all'}" data-fin-recon-filter="all">Hammasi</button></div>
            ${table(['', 'Holat', 'Tashqi ro‘yxat', 'CRM reyestri', { label: 'Farq', num: true }, 'Taklif'],
                ids.map(id => {
                    const x = res.results[id], e = x.external, done = r.done[id], p = proposal(r, id);
                    const action = done ? `<span class="fin-badge fin-badge--ok">${esc(done)}</span>`
                        : x.status === 'missing_in_crm' ? `<button type="button" class="btn-ghost btn-sm" data-fin-link="${id}">${r.links[id] ? 'O‘zgartirish' : 'O‘quvchini tanlash'}</button>${p ? `<small>${esc(p.text)}</small>` : ''}`
                            : x.status === 'amount_diff' && !p ? '<small>Bir nechta yozuv — qo‘lda tekshiring</small>' : p ? `<small>${esc(p.text)}</small>` : '';
                    return `<tr><td>${p && !done ? `<input type="checkbox" data-fin-recon-pick="${id}" ${r.picked.has(id) ? 'checked' : ''} aria-label="Tuzatish uchun tanlash">` : ''}</td>
                        <td><span class="fin-badge fin-badge--${STATUS[x.status][1]}">${STATUS[x.status][0]}</span>${x.phoneMismatch ? '<small>telefon boshqacha — to‘liq ism va summa bo‘yicha</small>' : ''}</td>
                        <td>${e ? `${dateText(e.date)} · <b>${num(e.amount)}</b><small>${esc(e.name)} ${esc(e.phone || '')}</small>` : '—'}</td>
                        <td>${x.ledgers?.length ? x.ledgers.map(l => `<div>${dateText(l.date)} · <b>${num(l.amount)}</b><small>${esc(l.name)} ${esc(l.phone || '')}${l.managerName ? ' · ' + esc(l.managerName) : ''}</small></div>`).join('') : '—'}</td>
                        <td class="num ${x.difference < 0 ? 'neg' : x.difference > 0 ? 'pos' : ''}">${x.difference ? acc(x.difference) : '0'}</td><td>${action}</td></tr>`;
                }), { empty: 'Farq topilmadi — ro‘yxat va CRM to‘liq mos', label: 'Solishtirish natijasi' })}
            <div class="fin-evidence"><label class="fin-field"><span>Asos hujjat (majburiy)</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" data-fin-recon-evidence class="form-control"></label>
                <label class="fin-field fin-grow"><span>Tuzatish sababi</span><input type="text" class="form-control" data-fin-recon-reason value="${esc(r.reason || '')}" placeholder="Masalan: Sentyabr audit ro‘yxati (moliyachi tasdiqlagan)"></label>
                ${r.evidenceUrl ? '<span class="fin-badge fin-badge--ok">hujjat yuklangan</span>' : r.sourceFile && /\.pdf$/i.test(r.fileName) ? '<span class="fin-muted">Bo‘sh qoldirsangiz, solishtirilgan PDF asos sifatida biriktiriladi</span>' : ''}</div>
            ${picked.length ? `<div class="fin-preview" aria-live="polite"><b>Saqlanadigan tuzatishlar (${picked.length}):</b><ol>${picked.map(x => `<li>${esc(x.p.text)} — ${esc((res.results[x.i].external || res.results[x.i].ledger).name)}</li>`).join('')}</ol></div>` : ''}
            <div class="fin-actions"><button type="button" class="btn-primary-sm" data-fin-fix-picked ${picked.length ? '' : 'disabled'}>Tanlanganlarni bitta tranzaksiyada saqlash (${picked.length})</button>
                <button type="button" class="btn-ghost" data-fin-recon-reset>Yangi solishtirish</button></div>
            <p class="fin-note">Farq sifatida faqat telefon raqami yoki to‘liq ism-familiyasi mos kelgan yozuvlar juftlanadi; faqat ism mos kelsa — bu boshqa odam bo‘lishi mumkin, shuning uchun “CRM’da yo‘q” va “Ro‘yxatda yo‘q” deb alohida ko‘rsatiladi. Tuzatishlar hammasi birga saqlanadi yoki birortasi ham saqlanmaydi. Xato yozuv “bekor qilingan” deb belgilanadi, to‘g‘risi hujjat va sabab bilan qo‘shiladi.</p></section>`;
    }
    const AUDIT_LABELS = { 'transaction-create': 'Operatsiya kiritildi', 'transaction-reverse': 'Storno', 'payable-create': 'Hisob-faktura', 'payable-void': 'Hisob-faktura bekor qilindi',
        'salary-cash-out': 'Maosh kassadan to‘landi', 'receipt-void': 'Tushum bekor qilindi', 'receipt-manual': 'Tushum hujjat asosida kiritildi', 'receipt-batch': 'Tuzatishlar to‘plami',
        'account-create': 'Hisob ochildi', 'account-update': 'Hisob o‘zgartirildi', 'account-check': 'Qoldiq tekshiruvi', 'period-lock': 'Oy yopildi', 'period-unlock': 'Oy qayta ochildi',
        'settings-update': 'Sozlamalar', 'evidence-upload': 'Hujjat yuklandi' };
    function auditSummary(a) {
        const d = a.after_data || {};
        return [d.amount != null ? num(d.amount) + ' so‘m' : '', d.date || d.voidDate || '', d.reason || d.note || '', d.name || d.counterparty || '', d.type ? F.TYPES[d.type] || d.type : '', d.closedThrough ? 'gacha: ' + d.closedThrough : '', d.count ? d.count + ' ta' : ''].filter(Boolean).join(' · ');
    }
    async function renderAudit(root) {
        const o = state.overview, q = o.quality;
        if (!state.auditRows) { try { const a = await api('/audit?limit=300' + (state.auditFilter ? '&action=' + encodeURIComponent(state.auditFilter) : '')); state.auditRows = a.rows; state.auditChain = a.chain; } catch { state.auditRows = []; } }
        const entity = scope() === 'all' ? 'russian' : scope();
        root.innerHTML = `<div class="fin-wrap">${toolbar()}
            <section class="fin-card" aria-labelledby="finR1"><header><h3 id="finR1">Tashqi ro‘yxat bilan solishtirish</h3><span class="fin-muted">Audit fayli, bank ko‘chirmasi yoki moliyachi jadvali — ${esc(F.ENTITIES[entity])}</span></header>
                <div class="fin-recon-input">
                    <label class="fin-drop"><span><b>1. Faylni tanlang</b> (PDF, Excel, CSV) yoki matnni pastga joylashtiring</span><input type="file" accept=".pdf,.xlsx,.xls,.csv,.txt" data-fin-recon-file></label>
                    <label class="sr-only" for="finReconText">Nusxa olingan qatorlar</label><textarea id="finReconText" class="form-control" rows="4" data-fin-recon-text placeholder="PDF yoki Excel’dan nusxa olingan qatorlar: sana, ism, telefon, summa…"></textarea>
                    <div class="fin-actions"><button type="button" class="btn-ghost" data-fin-recon-parse>Matnni tahlil qilish</button>
                        ${scope() === 'all' ? '<span class="fin-muted">Konsolidatsiya rejimida rus tili reyestri bilan solishtiriladi. Ingliz tili uchun Konsolidatsiyani o‘chirib, tilni tanlang.</span>' : ''}</div>
                </div></section>
            ${reconView()}
            <section class="fin-card" aria-labelledby="finSuspH"><header><h3 id="finSuspH">Shubhali tushumlar</h3><span class="fin-muted">${q.suspicious.length} ta · ${money(q.suspicious.reduce((n, r) => n + r.amount, 0))} · barcha davrlar</span></header>
                ${table(['', 'Sana', 'Ism / telefon', 'Menejer', { label: 'Summa', num: true }, 'Sabab'], q.suspicious.map(r => `<tr><td><input type="checkbox" data-fin-susp="${esc(r.id)}" aria-label="Tanlash: ${esc(r.name)}"></td><td>${dateText(r.date)}</td><td>${esc(r.name)}<small>${esc(r.phone)}</small></td><td>${esc(r.managerName || '—')}</td><td class="num">${num(r.amount)}</td><td>${r.reasons.map(x => `<span class="fin-badge fin-badge--warning">${esc(x)}</span>`).join(' ')}</td></tr>`), { empty: 'Shubhali tushum yo‘q', label: 'Shubhali tushumlar' })}
                ${q.suspicious.length ? '<div class="fin-actions"><button type="button" class="btn-primary-sm" data-fin-void-susp disabled>Tanlanganlarni bekor qilish</button><span class="fin-muted">Faqat test, dublikat yoki haqiqatda bo‘lmagan to‘lovlarni bekor qiling (hujjat va sabab majburiy). Summasi xato bo‘lsa — solishtirish orqali tuzating.</span></div>' : ''}</section>
            <div class="fin-grid">
                <section class="fin-card" aria-labelledby="finSalH"><header><h3 id="finSalH">To‘langan, lekin kassaga yozilmagan maoshlar</h3></header>
                    ${table(['Xodim', 'Davr', { label: 'Summa', num: true }, ''], q.paidSalaryWithoutCash.map(s => `<tr><td>${esc(s.employeeName)}</td><td>${dateText(s.periodStart)} — ${dateText(s.periodEnd)}</td><td class="num">${num(s.amount)}</td><td><button type="button" class="btn-ghost btn-sm" data-fin-salary="${esc(s.id)}">Kassadan chiqim</button></td></tr>`), { empty: 'Hammasi yozilgan' })}</section>
                <section class="fin-card" aria-labelledby="finQH"><header><h3 id="finQH">Ma’lumot sifati</h3></header>
                    <ul class="fin-list">
                        <li><span>Reyestrdagi faol tushumlar</span><strong>${q.total}</strong></li>
                        <li><span>Chek (isbot) biriktirilmagan</span><strong class="${q.withoutProof ? 'neg' : ''}">${q.withoutProof}</strong></li>
                        <li><span>To‘lov usuli noma’lum</span><strong class="${q.unknownMethod ? 'neg' : ''}">${q.unknownMethod}</strong></li>
                        <li><span>Eski ko‘chirilgan, tekshiruv kerak</span><strong>${q.legacyReview}</strong></li>
                        <li><span>Bekor qilingan</span><strong>${q.voided}</strong></li>
                        <li><span>Audit jurnali zanjiri</span><strong class="${state.auditChain?.ok === false ? 'neg' : 'pos'}">${state.auditChain?.ok === false ? 'uzilgan (' + state.auditChain.brokenAt + ')' : 'butun · ' + (state.auditChain?.count || 0) + ' yozuv'}</strong></li>
                    </ul></section>
            </div>
            <section class="fin-card" aria-labelledby="finVoidH"><header><h3 id="finVoidH">Bekor qilingan tushumlar</h3></header>
                ${table(['Tushum sanasi', 'Bekor qilingan', 'Ism', { label: 'Summa', num: true }, 'Sabab'], q.voidedList.map(r => `<tr class="fin-reversed"><td>${dateText(r.date)}</td><td>${dateText(r.voidDate)}</td><td>${esc(r.name)}<small>${esc(r.phone)}</small></td><td class="num">${num(r.amount)}</td><td>${esc(r.voidReason)}</td></tr>`), { empty: 'Yo‘q' })}</section>
            <section class="fin-card" aria-labelledby="finAuditH"><header><h3 id="finAuditH">Audit jurnali</h3>
                <div class="fin-filters"><label class="sr-only" for="finAuditFilter">Amal</label><select id="finAuditFilter" class="form-control" data-fin-audit-filter><option value="">Barcha amallar</option>${Object.entries(AUDIT_LABELS).map(([k, l]) => `<option value="${k}" ${state.auditFilter === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
                <button type="button" class="btn-ghost" data-fin-audit-export>CSV</button></div></header>
                ${table(['Vaqt', 'Kim', 'Amal', 'Tafsilot'], (state.auditRows || []).map(a => `<tr><td>${new Date(a.created_at).toLocaleString('uz-UZ')}</td><td>${esc(a.actor_name)}</td><td>${esc(AUDIT_LABELS[a.action] || a.action)}</td><td><small>${esc(auditSummary(a))}</small></td></tr>`), { empty: 'Hali amal bajarilmagan', label: 'Audit jurnali' })}
                <p class="fin-note">Har bir yozuv oldingisining SHA-256 xeshiga bog‘langan: jurnal bazada o‘zgartirilsa, zanjir uziladi va bu yerda ko‘rinadi.</p></section>
        </div>`;
        bindToolbar(root, () => render('solishtirish'));
        bindAudit(root, entity);
    }
    function bindAudit(root, entity) {
        const parse = (textValue, fileName, file) => {
            const parsed = F.parseStatementText(textValue);
            if (!parsed.length) { toast('Sana bilan boshlanadigan to‘lov qatorlari topilmadi'); return; }
            state.recon = { parsed, fileName, sourceFile: file || null, column: 0, tolerance: 3, picked: new Set(), done: {}, links: {}, entity };
            render('solishtirish');
        };
        root.querySelector('[data-fin-recon-file]')?.addEventListener('change', async e => {
            const file = e.target.files[0]; if (!file) return;
            try { parse(await readStatementFile(file), file.name, file); } catch (err) { toast('Faylni o‘qib bo‘lmadi: ' + err.message); }
        });
        root.querySelector('[data-fin-recon-parse]')?.addEventListener('click', () => parse(root.querySelector('[data-fin-recon-text]').value, 'joylashtirilgan matn'));
        root.querySelectorAll('input[name="finCol"]').forEach(i => i.addEventListener('change', () => { state.recon.column = Number(i.value); render('solishtirish'); }));
        root.querySelector('[data-fin-recon-tol]')?.addEventListener('change', e => { state.recon.tolerance = Math.max(0, Math.min(10, Number(e.target.value) || 0)); });
        root.querySelector('[data-fin-recon-run]')?.addEventListener('click', async () => {
            const r = state.recon;
            const rows = r.parsed.map(x => ({ date: x.date, name: x.name, phone: x.phone, amount: r.column === -1 ? x.amounts.at(-1) : x.amounts[r.column] })).filter(x => x.amount);
            try { r.result = await api('/reconcile', { entity: r.entity, rows, tolerance: r.tolerance }); r.filter = 'problems'; render('solishtirish'); }
            catch (e) { toast(e.message); }
        });
        root.querySelectorAll('[data-fin-recon-filter]').forEach(b => b.addEventListener('click', () => { state.recon.filter = b.dataset.finReconFilter; render('solishtirish'); }));
        root.querySelectorAll('[data-fin-recon-pick]').forEach(c => c.addEventListener('change', () => {
            const id = Number(c.dataset.finReconPick); c.checked ? state.recon.picked.add(id) : state.recon.picked.delete(id); render('solishtirish');
        }));
        root.querySelectorAll('[data-fin-link]').forEach(b => b.addEventListener('click', () => openLinkModal(Number(b.dataset.finLink))));
        root.querySelector('[data-fin-recon-reason]')?.addEventListener('input', e => { state.recon.reason = e.target.value; });
        root.querySelector('[data-fin-recon-reset]')?.addEventListener('click', () => { state.recon = null; render('solishtirish'); });
        root.querySelector('[data-fin-fix-picked]')?.addEventListener('click', async () => {
            const r = state.recon;
            if (state.busy) return;
            try {
                state.busy = true;
                const input = root.querySelector('[data-fin-recon-evidence]');
                if (input?.files?.[0]) r.evidenceUrl = await upload(input);
                if (!r.evidenceUrl && r.sourceFile && /\.pdf$/i.test(r.fileName)) r.evidenceUrl = await uploadEvidenceFile(r.sourceFile);
                if (!r.evidenceUrl) throw new Error('Asos hujjatni (PDF yoki rasm) yuklang');
                if ((r.reason || '').trim().length < 5) throw new Error('Tuzatish sababini yozing (kamida 5 belgi)');
                const ids = [...r.picked].filter(i => proposal(r, i));
                const ops = ids.map(i => { const { text: _t, ...op } = proposal(r, i); return op; });
                if (!confirm(`${ops.length} ta tuzatish bitta tranzaksiyada saqlanadi va audit jurnaliga yoziladi. Davom etasizmi?`)) return;
                await api('/receipts/batch', { requestKey: r.batchKey || (r.batchKey = reqKey()), entity: r.entity, reason: r.reason.trim(), evidenceUrl: r.evidenceUrl, operations: ops });
                for (const i of ids) { r.done[i] = 'saqlandi'; r.picked.delete(i); }
                r.batchKey = null;
                invalidate(); await loadOverview(true); toast('Tuzatishlar saqlandi');
            } catch (err) { toast(err.message); } finally { state.busy = false; render('solishtirish'); }
        });
        const susp = () => [...root.querySelectorAll('[data-fin-susp]:checked')].map(c => c.dataset.finSusp);
        root.querySelectorAll('[data-fin-susp]').forEach(c => c.addEventListener('change', () => { root.querySelector('[data-fin-void-susp]').disabled = !susp().length; }));
        root.querySelector('[data-fin-void-susp]')?.addEventListener('click', () => {
            const ids = susp();
            openReasonModal(`${ids.length} ta tushumni bekor qilish`, 'Bekor qilish', async (reason, evidenceUrl) => { await api('/receipts/void', { recordIds: ids, reason, evidenceUrl }); }, { evidence: true, evidenceRequired: true, placeholder: 'Masalan: test yozuvi, haqiqiy to‘lov emas' });
        });
        root.querySelectorAll('[data-fin-salary]').forEach(b => b.addEventListener('click', () => openSalaryModal(b.dataset.finSalary)));
        root.querySelector('[data-fin-audit-filter]')?.addEventListener('change', e => { state.auditFilter = e.target.value; state.auditRows = null; render('solishtirish'); });
        root.querySelector('[data-fin-audit-export]')?.addEventListener('click', () => {
            const rows = [['Vaqt', 'Kim', 'Amal', 'Obyekt', 'Oldin', 'Keyin'], ...(state.auditRows || []).map(a => [new Date(a.created_at).toISOString(), a.actor_name, a.action, a.entity_id, JSON.stringify(a.before_data || ''), JSON.stringify(a.after_data || '')])];
            const csv = '﻿' + rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
            const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = 'moliya-audit-jurnali.csv'; link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 10000);
        });
    }

    // ---------- Sozlamalar ----------
    function renderSettings(root) {
        const o = state.overview, s = o.settings, dir = isDirector(), lock = dir ? '' : 'disabled';
        const cand = o.closeCandidate, canClose = cand && Array.isArray(cand.issues);
        root.innerHTML = `<div class="fin-wrap">
            ${dir ? '' : `<div class="fin-alert fin-alert--warning" role="status">${ICON.warning}<span>Oy yopish, sozlamalar va hisob raqamlarini faqat rahbar (admin/boshliq) o‘zgartira oladi.</span></div>`}
            <section class="fin-card" aria-labelledby="finAccSetH"><header><h3 id="finAccSetH">Hisob raqamlar</h3>${dir ? '<button type="button" class="btn-primary-sm" data-fin-account-new>+ Hisob</button>' : ''}</header>
                ${table(['Nomi', 'Turi', 'Kimga tegishli', 'To‘lov usullari', { label: 'Boshlang‘ich qoldiq', num: true }, 'Sana', 'Holat', ''],
                    o.accountsList.map(a => `<tr><td><b>${esc(a.name)}</b></td><td>${esc(F.ACCOUNT_KINDS[a.kind])}</td><td>${esc(F.ENTITIES[a.entity])}</td><td>${(a.methods || []).map(m => `<span class="fin-badge fin-badge--muted">${esc(PaymentLedger.METHODS[m] || m)}</span>`).join(' ') || '—'}</td>
                        <td class="num">${num(a.openingBalance)}</td><td>${dateText(a.openingDate)}</td><td>${a.active !== false ? 'faol' : '<span class="fin-muted">yopilgan</span>'}</td><td>${dir ? `<button type="button" class="fin-link" data-fin-account-edit="${esc(a.id)}">Tahrirlash</button>` : ''}</td></tr>`), { label: 'Hisob raqamlar' })}
                <p class="fin-note">CRM’dagi har bir tushum yozilgan paytdagi to‘lov usuli bo‘yicha hisobga biriktiriladi va keyin o‘zgarmaydi (masalan, Click/Payme → Karta). Boshlang‘ich qoldiq — hisobni kuzatishni boshlagan kundagi haqiqiy summa.</p></section>
            <div class="fin-grid">
                <section class="fin-card" aria-labelledby="finLockH"><header><h3 id="finLockH">Oyni yopish</h3></header>
                    <p>${o.closedThrough ? `<b>${esc(o.closedThrough)}</b> gacha bo‘lgan davr yopilgan va muzlatilgan. Bu davrga hech qanday yozuv tushmaydi, hisobotlari o‘zgarmaydi.` : 'Hali birorta oy yopilmagan.'}</p>
                    ${canClose ? `<div class="fin-close-check"><b>${esc(cand.month)} — yopishdan oldingi tekshiruv:</b>${cand.issues.length ? `<ul>${cand.issues.map(i => `<li class="neg">${esc(i)}</li>`).join('')}</ul>` : '<p class="pos">Hammasi tayyor: hisoblar tasdiqlangan, aniqlanmagan summa yo‘q.</p>'}</div>` : ''}
                    <div class="fin-actions">
                        ${canClose && dir ? `<button type="button" class="btn-primary-sm" data-fin-lock="${esc(cand.month)}" data-fin-issues="${cand.issues.length}">${esc(cand.month)} oyini yopish</button>` : ''}
                        ${o.closedThrough && dir ? `<button type="button" class="btn-ghost" data-fin-unlock="${esc(o.closedThrough)}">${esc(o.closedThrough)} ni qayta ochish</button>` : ''}</div>
                    <p class="fin-note">Yopishdan oldin har bir pul hisobi uchun oy oxiridagi (oxirgi 3 kun) haqiqiy qoldiqni kiriting va farqni bartaraf eting. Tekshiruvdan o‘tmagan oyni faqat rahbar sababini yozib yopadi — bu jurnalda ko‘rinadi. Qayta ochish faqat oxirgi yopilgan oy uchun mumkin.</p>
                    ${o.locks.length ? table(['Oy', 'Kim yopdi', 'Izoh'], o.locks.slice().reverse().map(l => `<tr><td>${esc(l.month)}</td><td>${esc(l.locked_by_name)}</td><td>${esc(l.note)}</td></tr>`)) : ''}</section>
                <section class="fin-card" aria-labelledby="finAssH"><header><h3 id="finAssH">Hisob-kitob taxminlari</h3></header>
                    <form data-fin-settings class="fin-form">
                        <div class="fin-form-row">${field('Ingliz tili kursi (oy)', `<input type="number" min="1" max="24" class="form-control" name="english" value="${s.courseMonths.english}" ${lock}>`)}${field('Rus tili kursi (oy)', `<input type="number" min="1" max="24" class="form-control" name="russian" value="${s.courseMonths.russian}" ${lock}>`)}</div>
                        <div class="fin-form-row">${field('Maosh to‘lash muddati (kun)', `<input type="number" min="0" max="60" class="form-control" name="salaryDueDays" value="${s.salaryDueDays}" ${lock}>`)}${field('Uskunaning foydalanish muddati (oy)', `<input type="number" min="1" max="240" class="form-control" name="usefulLifeMonths" value="${s.usefulLifeMonths}" ${lock}>`)}</div>
                        <div class="fin-form-row">${field('Rahbar tasdig‘i kerak bo‘lgan summa (so‘m)', `<input type="number" min="0" class="form-control" name="approvalLimit" value="${s.approvalLimit}" ${lock}>`, 'Bundan katta qaytarish va tushumni bekor qilishni faqat rahbar qiladi')}${field('Shubhali summa chegarasi (so‘m)', `<input type="number" min="0" class="form-control" name="suspiciousMin" value="${s.suspiciousMin}" ${lock}>`)}</div>
                        <fieldset class="fin-methods"><legend>Kutilayotgan kredit zarari (ECL) stavkalari, %</legend>${F.AGING.map(([k, l]) => `<label>${l} <input type="number" min="0" max="100" class="form-control fin-narrow" name="ecl_${k}" value="${s.eclRates[k]}" ${lock}></label>`).join('')}</fieldset>
                        ${dir ? '<button type="submit" class="btn-primary-sm">Saqlash</button>' : ''}
                    </form>
                    <p class="fin-note">Bu taxminlar faqat hisoblash usuli, balans va ECL uchun ishlatiladi. Kassa usuli raqamlariga ta’sir qilmaydi. Yopilgan oylar o‘zgarmaydi — farq birinchi ochiq oyda “o‘tgan davr tuzatishi” bo‘lib ko‘rinadi.</p></section>
            </div>
            <section class="fin-card" aria-labelledby="finCoaH"><header><h3 id="finCoaH">Hisoblar rejasi (toifalar)</h3><span class="fin-muted">qaysi toifa qaysi hisobotga tushadi</span></header>
                ${table(['Kod', 'Toifa', 'Pul oqimi bo‘limi (IAS 7)', 'Foyda-zarar qatori'], F.CATEGORIES.map(c => `<tr><td><code>${c.code}</code></td><td>${esc(c.name)}</td><td>${{ operating: 'Operatsion', investing: 'Investitsion', financing: 'Moliyaviy' }[c.cf] || '— (ichki o‘tkazma)'}</td><td>${c.pnl ? esc((F.PNL_LINES.find(l => l[0] === c.pnl) || [0, c.pnl])[1]) : '— (foyda-zararga kirmaydi)'}</td></tr>`), { label: 'Hisoblar rejasi' })}</section>
        </div>`;
        root.querySelector('[data-fin-account-new]')?.addEventListener('click', () => openAccountModal());
        root.querySelectorAll('[data-fin-account-edit]').forEach(b => b.addEventListener('click', () => openAccountModal(o.accountsList.find(a => a.id === b.dataset.finAccountEdit))));
        root.querySelector('[data-fin-lock]')?.addEventListener('click', e => {
            const m = e.currentTarget.dataset.finLock, issues = Number(e.currentTarget.dataset.finIssues);
            openReasonModal(`${m} oyini yopish`, 'Oyni yopish', async note => { await api('/periods', { month: m, note, override: issues > 0 }); },
                { optional: !issues, minLength: issues ? 10 : 0, placeholder: issues ? 'Tekshiruvdan o‘tmagan oyni nima uchun yopayotganingizni yozing (kamida 10 belgi)' : 'Izoh: masalan, qoldiqlar bank bilan solishtirildi',
                    note: issues ? `<b class="neg">Diqqat:</b> ${issues} ta tekshiruv bajarilmagan. Yopilgandan keyin bu oy raqamlari muzlatiladi.` : 'Yopilgandan keyin bu oy raqamlari muzlatiladi va o‘zgarmaydi.' });
        });
        root.querySelector('[data-fin-unlock]')?.addEventListener('click', e => { const m = e.currentTarget.dataset.finUnlock; openReasonModal(`${m} oyini qayta ochish`, 'Qayta ochish', async note => { await api('/periods', { month: m, locked: false, note }); }); });
        root.querySelector('[data-fin-settings]')?.addEventListener('submit', async e => {
            e.preventDefault();
            const f = new FormData(e.target), n = k => Number(f.get(k));
            try {
                await api('/settings', { revision: o.settingsRevision, data: { courseMonths: { english: n('english'), russian: n('russian') }, suspiciousMin: n('suspiciousMin'), salaryDueDays: n('salaryDueDays'),
                    usefulLifeMonths: n('usefulLifeMonths'), approvalLimit: n('approvalLimit'), eclRates: Object.fromEntries(F.AGING.map(([k]) => [k, n('ecl_' + k)])) } }, 'PUT');
                invalidate(); toast('Sozlamalar saqlandi'); render('moliya-sozlamalar');
            } catch (err) { toast(err.message); }
        });
    }

    // ---------- Modallar ----------
    function field(label, html, hint) { return `<label class="fin-field"><span>${label}</span>${html}${hint ? `<small>${hint}</small>` : ''}</label>`; }
    function submitModal(onSubmit) {
        const footer = document.getElementById('modalFooter'), body = document.getElementById('modalBody');
        const btn = footer.querySelector('[data-fin-submit]'), err = body.querySelector('[data-fin-error]');
        body.querySelector('input:not([type=hidden]),select,textarea')?.focus();
        btn.addEventListener('click', async () => {
            if (btn.disabled) return;
            btn.disabled = true; err.textContent = '';
            try { await onSubmit(body); closeModal(); invalidate(); toast('Saqlandi'); render(currentSection()); }
            catch (e) { err.textContent = e.message; btn.disabled = false; }
        });
        footer.querySelector('[data-fin-cancel]')?.addEventListener('click', closeModal);
    }
    const footerButtons = label => `<button type="button" class="btn-ghost" data-fin-cancel>Bekor</button><button type="button" class="btn-primary-sm" data-fin-submit>${label}</button>`;
    const moneyInput = (name, value) => `<input type="text" inputmode="numeric" class="form-control" name="${name}" value="${value ? num(value) : ''}" placeholder="0" autocomplete="off">`;
    function wireMoney(root) { root.querySelectorAll('input[inputmode="numeric"]').forEach(i => i.addEventListener('input', () => { const d = i.value.replace(/\D/g, ''); i.value = d ? num(d) : ''; })); }
    async function openTxnModal(preset = {}) {
        const o = state.overview || await loadOverview(true);
        if (!o) { toast(state.error || 'Ma’lumot yuklanmadi'); return; }
        const type = preset.type || 'expense';
        const accounts = o.accountsList.filter(a => a.active !== false && a.kind !== 'suspense' && a.kind !== 'clearing');
        const ent = preset.entity || (scope() === 'all' ? 'common' : scope());
        const cats = F.CATEGORIES.filter(c => c.type === type);
        const loans = (o.payables.rows || []).filter(p => p.kind === 'loan');
        let receipts = [];
        if (type === 'refund') {
            try { const l = ent === 'common' ? 'russian' : ent; receipts = (await apiFetch('/api/inflow?language=' + l)).records.slice(0, 500); } catch { receipts = []; }
        }
        const isIn = ['income', 'capital', 'loan_in'].includes(type);
        const fromAccounts = type === 'transfer' ? o.accountsList.filter(a => a.active !== false) : accounts;
        const body = `<div class="fin-form" data-fin-txn>
            ${field('Operatsiya turi', `<select class="form-control" name="type">${Object.entries(F.TYPES).map(([k, l]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
            <div class="fin-form-row">${field('Sana', `<input type="date" lang="en-GB" class="form-control" name="date" value="${F.today()}" max="${F.today()}">`)}
                ${field(preset.settlement ? 'Uzum o‘tkazgan summa (so‘m)' : 'Summa (so‘m)', moneyInput('amount', preset.amount))}</div>
            ${type === 'refund' ? field('Qaysi tushum qaytarilmoqda (majburiy)', `<input type="search" class="form-control" placeholder="Ism yoki telefon bo‘yicha qidirish" data-fin-receipt-search aria-label="Tushumni qidirish"><select class="form-control" name="paymentRecordId" size="6" aria-label="Tushum">${receipts.map(r => `<option value="${esc(r.id)}" data-search="${esc(((r.name || '') + ' ' + String(r.phone || '').replace(/\D/g, '')).toLowerCase())}">${dateText(r.paidDate)} · ${esc(r.name)} · ${num(r.amount)}</option>`).join('')}</select>`, 'Qaytarish tanlangan tushum summasidan oshmaydi; o‘quvchi shartnomasi shu kundan tugatiladi') : ''}
            ${type === 'loan_repay' ? field('Qaysi qarz', `<select class="form-control" name="payableId">${loans.map(p => `<option value="${esc(p.id)}" ${p.id === preset.payableId ? 'selected' : ''}>${esc(p.counterparty)} · qoldiq ${num(p.outstanding)}</option>`).join('')}</select>`, 'Foiz alohida “Qarz bo‘yicha foizlar” xarajati sifatida kiritiladi') : ''}
            ${!['refund', 'transfer'].includes(type) ? field('Yo‘nalish', `<select class="form-control" name="entity">${Object.entries(F.ENTITIES).map(([k, l]) => `<option value="${k}" ${k === ent ? 'selected' : ''}>${l}</option>`).join('')}</select>`, 'Ikkala maktabga tegishli xarajat (ijara, CRM) — “Umumiy”; hisobotda sof tushum ulushiga ko‘ra taqsimlanadi') : ''}
            ${type !== 'transfer' ? field('Toifa', `<select class="form-control" name="categoryCode">${cats.map(c => `<option value="${c.code}" ${c.code === preset.categoryCode ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`) : '<input type="hidden" name="categoryCode" value="TRANSFER">'}
            <div data-fin-payroll-flag hidden><label class="fin-switch"><input type="checkbox" name="nonSalary"><span>Maosh tizimidan tashqari bir martalik to‘lov (bonus, ustama)</span></label><small class="fin-muted">Oylik maoshlar “Maoshlar” bo‘limida hisoblanadi va to‘langanda avtomatik yoziladi — ikki marta kiritmang.</small></div>
            <div data-fin-capex hidden>${field('Foydalanish muddati (oy)', `<input type="number" min="1" max="240" class="form-control" name="usefulLifeMonths" value="${o.settings.usefulLifeMonths}">`, 'Shu muddat davomida teng amortizatsiya qilinadi')}</div>
            <div class="fin-form-row">${field(type === 'transfer' ? 'Qaysi hisobdan' : isIn ? 'Qaysi hisobga tushdi' : 'Qaysi hisobdan to‘landi', `<select class="form-control" name="accountId">${fromAccounts.map(a => `<option value="${esc(a.id)}" ${a.id === (preset.accountId || 'acc-card') ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>`)}
                ${type === 'transfer' ? field('Qaysi hisobga', `<select class="form-control" name="toAccountId">${accounts.map(a => `<option value="${esc(a.id)}" ${a.id === (preset.toAccountId || 'acc-cash') ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>`) : ''}</div>
            ${type === 'transfer' ? field('Komissiya (ixtiyoriy, so‘m)', moneyInput('feeAmount'), preset.settlement ? 'Uzum ushlab qolgan summa — “To‘lov tizimi va Uzum komissiyalari” xarajati bo‘ladi' : 'Bank yoki to‘lov tizimi ushlab qolgan summa — xarajat sifatida yoziladi') : ''}
            ${type !== 'transfer' ? field(isIn ? 'Kimdan' : 'Kimga', `<input type="text" class="form-control" name="counterparty" value="${esc(preset.counterparty || '')}" maxlength="200" placeholder="${type === 'expense' ? 'Masalan: Meta Ads, ijara egasi' : ''}">`) : ''}
            ${type === 'loan_in' ? field('Qaytarish muddati', '<input type="date" lang="en-GB" class="form-control" name="dueDate">') : ''}
            ${field('Izoh', `<textarea class="form-control" name="description" rows="2" maxlength="1000">${esc(preset.description || '')}</textarea>`)}
            ${type !== 'transfer' ? field('Chek / hujjat', '<input type="file" class="form-control" name="receipt" accept=".pdf,.png,.jpg,.jpeg,.webp">', ['refund', 'drawing'].includes(type) ? 'Majburiy' : type === 'expense' ? '1 000 000 so‘mdan katta xarajat uchun majburiy' : '') : ''}
            ${preset.payableId && type === 'expense' ? `<p class="fin-note">Bu to‘lov “${esc(preset.counterparty)}” hisob-fakturasini yopadi.</p>` : ''}
            <p class="fin-error" data-fin-error role="alert"></p></div>`;
        openModal(F.TYPES[type], body, footerButtons('Saqlash'));
        const root = document.querySelector('[data-fin-txn]');
        wireMoney(root);
        const catSel = root.querySelector('select[name="categoryCode"]');
        const syncCat = () => { const c = F.CATEGORY[catSel?.value]; root.querySelector('[data-fin-payroll-flag]').hidden = !c?.payroll; root.querySelector('[data-fin-capex]').hidden = c?.code !== 'CAPEX'; };
        catSel?.addEventListener('change', syncCat); syncCat();
        root.querySelector('[name="type"]').addEventListener('change', e => { closeModal(); openTxnModal({ ...preset, type: e.target.value, settlement: false }); });
        const rs = root.querySelector('[data-fin-receipt-search]');
        rs?.addEventListener('input', () => { const q = rs.value.trim().toLowerCase(), d = q.replace(/\D/g, ''); root.querySelectorAll('[name="paymentRecordId"] option').forEach(op => { op.hidden = !!q && !op.dataset.search.includes(q) && !(d.length >= 3 && op.dataset.search.includes(d)); }); });
        const key = reqKey();
        submitModal(async b => {
            const v = n => b.querySelector(`[name="${n}"]`)?.value || '';
            if (type === 'refund' && !v('paymentRecordId')) throw new Error('Qaytarilayotgan tushumni tanlang');
            const receiptUrl = await upload(b.querySelector('[name="receipt"]'));
            await api('/transactions', { requestKey: key, type, date: v('date'), amount: v('amount').replace(/\D/g, ''), entity: v('entity') || ent, categoryCode: v('categoryCode'),
                accountId: v('accountId'), toAccountId: v('toAccountId'), counterparty: v('counterparty'), description: v('description'), receiptUrl, feeAmount: v('feeAmount').replace(/\D/g, ''),
                paymentRecordId: v('paymentRecordId'), payableId: v('payableId') || preset.payableId || '', dueDate: v('dueDate'), nonSalary: !!b.querySelector('[name="nonSalary"]')?.checked,
                usefulLifeMonths: v('usefulLifeMonths') });
        });
    }
    function openPayableModal() {
        const ent = scope() === 'all' ? 'common' : scope();
        openModal('Hisob-faktura (korxona qarzi)', `<div class="fin-form">
            ${field('Kimga qarzmiz', '<input type="text" class="form-control" name="counterparty" maxlength="200" placeholder="Masalan: ijara egasi, reklama agentligi">')}
            <div class="fin-form-row">${field('Summa (so‘m)', moneyInput('amount'))}
            ${field('Yo‘nalish', `<select class="form-control" name="entity">${Object.entries(F.ENTITIES).map(([k, l]) => `<option value="${k}" ${k === ent ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
            ${field('Toifa', `<select class="form-control" name="categoryCode">${F.CATEGORIES.filter(c => c.type === 'expense' && !c.payroll && c.code !== 'CAPEX').map(c => `<option value="${c.code}">${esc(c.name)}</option>`).join('')}</select>`)}
            <div class="fin-form-row">${field('Hujjat sanasi', `<input type="date" lang="en-GB" class="form-control" name="issueDate" value="${F.today()}" max="${F.today()}">`)}${field('To‘lov muddati', '<input type="date" lang="en-GB" class="form-control" name="dueDate">')}</div>
            ${field('Izoh', '<textarea class="form-control" name="description" rows="2"></textarea>')}
            ${field('Hujjat (hisob-faktura, shartnoma)', '<input type="file" class="form-control" name="document" accept=".pdf,.png,.jpg,.jpeg,.webp">')}
            <p class="fin-error" data-fin-error role="alert"></p></div>`, footerButtons('Saqlash'));
        wireMoney(document.getElementById('modalBody'));
        const key = reqKey();
        submitModal(async b => {
            const v = n => b.querySelector(`[name="${n}"]`)?.value || '';
            await api('/payables', { requestKey: key, kind: 'bill', counterparty: v('counterparty'), amount: v('amount').replace(/\D/g, ''), entity: v('entity'), categoryCode: v('categoryCode'),
                issueDate: v('issueDate'), dueDate: v('dueDate'), description: v('description'), documentUrl: await upload(b.querySelector('[name="document"]')) });
        });
    }
    function openReverseModal(id) {
        const t = state.txns.rows.find(r => r.id === id);
        openReasonModal(`Storno: ${F.TYPES[t.type]} · ${num(t.amount)} so‘m`, 'Storno qilish', async (reason, _e, date) => { await api('/transactions/' + encodeURIComponent(id) + '/reverse', { reason, date }); },
            { date: true, note: 'Asl yozuv o‘chirilmaydi: teskari (storno) yozuv qo‘shiladi. Asl sana yopilgan oyda bo‘lsa, storno bugungi sana bilan yoziladi.' });
    }
    function openReasonModal(title, action, onSubmit, opts = {}) {
        openModal(title, `<div class="fin-form">
            ${field(opts.optional ? 'Izoh (ixtiyoriy)' : 'Sabab', `<textarea class="form-control" name="reason" rows="3" maxlength="1000" placeholder="${esc(opts.placeholder || '')}"></textarea>`)}
            ${opts.date ? field('Storno sanasi (ixtiyoriy)', `<input type="date" lang="en-GB" class="form-control" name="date" max="${F.today()}">`) : ''}
            ${opts.evidence ? field('Asos hujjat' + (opts.evidenceRequired ? ' (majburiy)' : ''), '<input type="file" class="form-control" name="evidence" accept=".pdf,.png,.jpg,.jpeg,.webp">') : ''}
            ${opts.note ? `<p class="fin-note">${opts.note}</p>` : ''}<p class="fin-error" data-fin-error role="alert"></p></div>`, footerButtons(action));
        submitModal(async b => {
            const reason = b.querySelector('[name="reason"]').value.trim();
            const min = opts.minLength || (opts.optional ? 0 : 5);
            if (reason.length < min) throw new Error(`Sababni batafsilroq yozing (kamida ${min} belgi)`);
            const ev = opts.evidence ? await upload(b.querySelector('[name="evidence"]')) : '';
            if (opts.evidenceRequired && !ev) throw new Error('Asos hujjatni yuklang');
            await onSubmit(reason, ev, b.querySelector('[name="date"]')?.value || '');
        });
    }
    function openSalaryModal(id) {
        const s = state.overview.quality.paidSalaryWithoutCash.find(x => x.id === id);
        if (!s) { toast('Maosh topilmadi — sahifani yangilang'); return; }
        const accounts = state.overview.accountsList.filter(a => a.active !== false && F.EQUIVALENT_KINDS.has(a.kind));
        openModal('Maoshni kassadan chiqim qilish', `<div class="fin-form"><p><b>${esc(s.employeeName)}</b> · ${dateText(s.periodStart)} — ${dateText(s.periodEnd)} · <b>${money(s.amount)}</b></p>
            ${field('To‘langan sana', `<input type="date" lang="en-GB" class="form-control" name="date" value="${s.paidAt || F.today()}" max="${F.today()}">`)}
            ${field('Qaysi hisobdan', `<select class="form-control" name="accountId">${accounts.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select>`)}
            <p class="fin-error" data-fin-error role="alert"></p></div>`, footerButtons('Saqlash'));
        submitModal(async b => { await api('/salaries/' + encodeURIComponent(id) + '/cash-out', { date: b.querySelector('[name="date"]').value, accountId: b.querySelector('[name="accountId"]').value }); });
    }
    function openCheckModal(accountId) {
        const a = state.overview.accounts.find(x => x.id === accountId);
        openModal('Haqiqiy qoldiqni kiritish', `<div class="fin-form"><p><b>${esc(a.name)}</b> — kitobdagi qoldiq: <b>${money(a.balance)}</b> (${dateText(state.overview.period.end)})</p>
            <div class="fin-form-row">${field('Sana', `<input type="date" lang="en-GB" class="form-control" name="date" value="${F.today()}" max="${F.today()}">`)}
            ${field('Haqiqiy qoldiq (so‘m)', '<input type="text" class="form-control" name="actual" inputmode="decimal" autocomplete="off">', 'Bank ilovasi, terminal yoki kassadagi aniq summa. Manfiy bo‘lsa “-” bilan')}</div>
            ${field('Izoh', '<input type="text" class="form-control" name="note" maxlength="500">')}
            <p class="fin-note">Farq chiqsa — kiritilmagan xarajat, tushum yoki xato bor. Sababini topib operatsiya kiriting; qoldiqni “to‘g‘rilash” uchun soxta yozuv qilinmaydi.</p>
            <p class="fin-error" data-fin-error role="alert"></p></div>`, footerButtons('Saqlash'));
        const key = reqKey();
        submitModal(async b => {
            const raw = b.querySelector('[name="actual"]').value.trim(), neg = raw.startsWith('-'), digits = raw.replace(/\D/g, '');
            if (!digits) throw new Error('Haqiqiy qoldiqni kiriting');
            await api('/accounts/' + encodeURIComponent(accountId) + '/checks', { requestKey: key, date: b.querySelector('[name="date"]').value, actualBalance: (neg ? -1 : 1) * Number(digits), note: b.querySelector('[name="note"]').value });
        });
    }
    function openAccountModal(a) {
        const methods = Object.entries(PaymentLedger.METHODS).filter(([k]) => k !== 'unknown');
        openModal(a ? 'Hisobni tahrirlash' : 'Yangi hisob', `<div class="fin-form">
            ${field('Nomi', `<input type="text" class="form-control" name="name" value="${esc(a?.name || '')}" maxlength="120">`)}
            <div class="fin-form-row">${field('Turi', `<select class="form-control" name="kind">${Object.entries(F.ACCOUNT_KINDS).map(([k, l]) => `<option value="${k}" ${a?.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
            ${field('Kimga tegishli', `<select class="form-control" name="entity">${Object.entries(F.ENTITIES).map(([k, l]) => `<option value="${k}" ${(a?.entity || 'common') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
            <fieldset class="fin-methods"><legend>Qaysi to‘lov usullari shu hisobga tushadi (yangi tushumlar uchun)</legend>${methods.map(([k, l]) => `<label><input type="checkbox" name="methods" value="${k}" ${(a?.methods || []).includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</fieldset>
            <div class="fin-form-row">${field('Boshlang‘ich qoldiq (so‘m)', moneyInput('openingBalance', a?.openingBalance))}
            ${field('Qoldiq sanasi', `<input type="date" lang="en-GB" class="form-control" name="openingDate" value="${a?.openingDate || ''}">`, 'Shu kundan boshlab harakatlar qoldiqqa qo‘shiladi')}</div>
            ${a ? `<label class="fin-switch"><input type="checkbox" name="active" ${a.active !== false ? 'checked' : ''}><span>Faol</span></label>` : ''}
            <p class="fin-error" data-fin-error role="alert"></p></div>`, footerButtons('Saqlash'));
        wireMoney(document.getElementById('modalBody'));
        const key = reqKey();
        submitModal(async b => {
            const v = n => b.querySelector(`[name="${n}"]`)?.value || '';
            await api('/accounts', { id: a?.id, requestKey: a ? undefined : key, name: v('name'), kind: v('kind'), entity: v('entity'), methods: [...b.querySelectorAll('[name="methods"]:checked')].map(c => c.value),
                openingBalance: v('openingBalance').replace(/\D/g, '') || 0, openingDate: v('openingDate'), active: a ? b.querySelector('[name="active"]').checked : true });
        });
    }
    // CRM'da yo'q to'lovni qo'shishdan oldin aniq o'quvchi/lid va to'lov usuli tanlanadi.
    function openLinkModal(id) {
        const r = state.recon, e = r.result.results[id].external;
        openModal('O‘quvchini tanlash', `<div class="fin-form"><p>${dateText(e.date)} · <b>${money(e.amount)}</b> · ${esc(e.name)} ${esc(e.phone || '')}</p>
            ${field('Qidirish (ism yoki telefon)', `<input type="search" class="form-control" data-fin-people-q value="${esc(e.phone || e.name)}">`)}
            <div class="fin-people" data-fin-people role="radiogroup" aria-label="Topilganlar" aria-live="polite"><p class="fin-muted">Qidirilmoqda…</p></div>
            ${field('To‘lov usuli', `<select class="form-control" name="method">${Object.entries(PaymentLedger.METHODS).filter(([k]) => k !== 'unknown').map(([k, l]) => `<option value="${k}" ${r.links[id]?.method === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`)}
            <p class="fin-error" data-fin-error role="alert"></p></div>`, footerButtons('Tanlash'));
        const body = document.getElementById('modalBody'), q = body.querySelector('[data-fin-people-q]'), list = body.querySelector('[data-fin-people]');
        let chosen = null;
        const search = async () => {
            try {
                const res = await api(`/people?entity=${r.entity}&q=${encodeURIComponent(q.value)}`);
                list.innerHTML = res.rows.length ? res.rows.map((p, i) => `<label class="fin-radio"><input type="radio" name="person" value="${i}"> ${esc(p.name)} · ${esc(p.phone || '')} <span class="fin-badge fin-badge--muted">${p.kind === 'student' ? 'o‘quvchi' : 'lid'}</span></label>`).join('') : '<p class="fin-muted">Topilmadi. Avval lidni CRM’ga kiriting.</p>';
                list.querySelectorAll('[name="person"]').forEach(inp => inp.addEventListener('change', () => { chosen = res.rows[Number(inp.value)]; }));
            } catch (err) { list.innerHTML = `<p class="neg">${esc(err.message)}</p>`; }
        };
        q.addEventListener('input', () => { clearTimeout(q._t); q._t = setTimeout(search, 300); });
        search();
        q.focus();
        const footer = document.getElementById('modalFooter');
        footer.querySelector('[data-fin-cancel]').addEventListener('click', closeModal);
        footer.querySelector('[data-fin-submit]').addEventListener('click', () => {
            if (!chosen) { body.querySelector('[data-fin-error]').textContent = 'O‘quvchi yoki lidni tanlang'; return; }
            r.links[id] = { ...chosen, method: body.querySelector('[name="method"]').value };
            r.picked.add(id); closeModal(); render('solishtirish');
        });
    }

    // ---------- Kirish nuqtasi ----------
    async function render(section) {
        if (!SECTIONS.includes(section)) return;
        const root = panelRoot(section);
        if (!root) return;
        if (!state.overview) { loading(root); await loadOverview(); }
        if (currentSection() !== section) return;
        if (!state.overview) { failed(root); return; }
        try {
            if (section === 'umumiy') renderOverview(root);
            else if (section === 'kassa') await renderCash(root);
            else if (section === 'operatsiyalar') await renderOperations(root);
            else if (section === 'qarzlar') renderDebts(root);
            else if (section === 'hisobotlar') renderReports(root);
            else if (section === 'solishtirish') await renderAudit(root);
            else if (section === 'moliya-sozlamalar') renderSettings(root);
        } catch (e) { console.error('[financeUI]', e); state.error = e.message; failed(root); }
    }
    function onLangChange() { if (!state.consolidated) invalidate(); render(currentSection()); }
    window.financeUI = { render, handles: s => SECTIONS.includes(s), onLangChange, invalidate };
})();
