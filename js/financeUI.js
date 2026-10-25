// Moliya bo'limi interfeysi: Umumiy ko'rinish, Kassa, Operatsiyalar, Qarzlar, Hisobotlar,
// Audit va solishtirish, Sozlamalar. Barcha hisob-kitob serverda (FinanceEngine) bajariladi,
// bu yerda faqat ko'rsatish va kiritish.
(function () {
    'use strict';
    const F = FinanceEngine;
    const SECTIONS = ['umumiy', 'kassa', 'operatsiyalar', 'qarzlar', 'hisobotlar', 'solishtirish', 'moliya-sozlamalar'];
    const state = {
        start: '', end: '', preset: 'month', consolidated: false, basis: 'cash', report: 'pnl', debtTab: 'receivables',
        overview: null, loadingKey: '', error: '', cashAccount: '', cashbook: null, txns: null, txFilter: { type: '', category: '', search: '' },
        recon: null, auditRows: null, busy: false
    };
    const esc = v => (typeof escapeHtml === 'function' ? escapeHtml(String(v ?? '')) : String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]));
    const num = n => String(Math.abs(Math.round(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    // Buxgalteriya uslubi: manfiy summa qavs ichida, so'm belgisiz (ustun sarlavhasida "so'm").
    const acc = n => (Number(n) < 0 ? '(' + num(n) + ')' : num(n));
    const money = n => (Number(n) < 0 ? '−' : '') + num(n) + ' so‘m';
    const pctText = v => (v == null ? '—' : String(v).replace('.', ',') + '%');
    const dateText = d => (d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '—');
    const monthName = m => { const [y, mm] = m.split('-'); return ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'][Number(mm) - 1] + ' ' + y.slice(2); };
    const reqKey = () => 'fin-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
    const scope = () => (state.consolidated ? 'all' : (typeof _financeLang !== 'undefined' ? _financeLang : 'english'));
    const scopeLabel = () => (scope() === 'all' ? 'Konsolidatsiya (ikkala yo‘nalish + umumiy)' : F.ENTITIES[scope()]);
    const toast = msg => (typeof showMiniToast === 'function' ? showMiniToast(msg) : alert(msg));
    const catName = code => F.CATEGORY[code]?.name || code;
    const accountName = id => state.overview?.accountsList?.find(a => a.id === id)?.name || id;

    function presetRange(preset) {
        const today = F.today(), m = F.monthOf(today);
        if (preset === 'prev') { const pm = F.monthOf(F.addMonths(m + '-01', -1)); return [pm + '-01', F.monthEnd(pm)]; }
        if (preset === 'quarter') return [F.monthOf(F.addMonths(m + '-01', -2)) + '-01', today];
        if (preset === 'ytd') return [today.slice(0, 4) + '-01-01', today];
        if (preset === 'all') return ['2026-01-01', today];
        return [m + '-01', today];
    }
    if (!state.start) [state.start, state.end] = presetRange('month');

    async function api(path, body, method) {
        return apiFetch('/api/finance' + path, body === undefined ? {} : { method: method || 'POST', body: JSON.stringify(body), timeout: 30000 });
    }
    async function upload(input) {
        const file = input?.files?.[0];
        if (!file) return '';
        if (!/\.(pdf|png|jpe?g|webp)$/i.test(file.name)) throw new Error('Hujjat PDF yoki rasm (PNG/JPG/WEBP) bo‘lishi kerak');
        if (input._uploaded?.file === file) return input._uploaded.url;
        const url = (await apiUploadFile(file)).url;
        input._uploaded = { file, url };
        return url;
    }

    // ---------- Ma'lumot yuklash ----------
    async function loadOverview(force) {
        const key = [scope(), state.start, state.end, state.basis].join('|');
        if (!force && state.overview && state.loadingKey === key) return state.overview;
        state.loadingKey = key; state.error = '';
        try {
            const data = await apiFetch(`/api/finance/overview?scope=${scope()}&start=${state.start}&end=${state.end}&basis=${state.basis}`, { timeout: 30000 });
            if (state.loadingKey === key) state.overview = data;
        } catch (e) { state.error = e.message; state.overview = null; }
        return state.overview;
    }
    function invalidate() { state.overview = null; state.cashbook = null; state.txns = null; state.auditRows = null; state.loadingKey = ''; }

    // ---------- Umumiy elementlar ----------
    function toolbar(opts = {}) {
        const presets = [['month', 'Bu oy'], ['prev', 'O‘tgan oy'], ['quarter', 'Oxirgi 3 oy'], ['ytd', 'Yil boshidan'], ['all', 'Hammasi']];
        return `<div class="fin-toolbar" data-fin-toolbar>
            <div class="fin-presets" role="group" aria-label="Davr">${presets.map(([k, l]) => `<button type="button" class="fin-chip ${state.preset === k ? 'active' : ''}" data-fin-preset="${k}">${l}</button>`).join('')}</div>
            <label class="fin-field"><span>Dan</span><input type="date" lang="en-GB" class="form-control" data-fin-start value="${state.start}" max="${F.today()}"></label>
            <label class="fin-field"><span>Gacha</span><input type="date" lang="en-GB" class="form-control" data-fin-end value="${state.end}" max="${F.today()}"></label>
            <label class="fin-switch" title="Ikkala yo‘nalish va umumiy xarajatlar birga"><input type="checkbox" data-fin-consolidated ${state.consolidated ? 'checked' : ''}><span>Konsolidatsiya</span></label>
            ${opts.basis ? `<div class="fin-seg" role="group" aria-label="Hisob usuli">
                <button type="button" class="${state.basis === 'cash' ? 'active' : ''}" data-fin-basis="cash" title="Pul kirgan va chiqqan kunida tan olinadi">Kassa usuli</button>
                <button type="button" class="${state.basis === 'accrual' ? 'active' : ''}" data-fin-basis="accrual" title="Tushum kurs davomida, maosh hisoblangan oyida, xarajat hujjat sanasida">Hisoblash usuli</button></div>` : ''}
            ${opts.actions || ''}
        </div>
        <p class="fin-scope">Ko‘rinish: <strong>${esc(scopeLabel())}</strong> · ${dateText(state.start)} — ${dateText(state.end)}${state.overview?.closedThrough ? ` · <span class="fin-badge fin-badge--muted" title="Shu oygacha bo‘lgan davr yopilgan, raqamlar o‘zgarmaydi">🔒 ${esc(state.overview.closedThrough)} gacha yopilgan</span>` : ''}</p>`;
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
    function loading(root) { root.innerHTML = `<div class="fin-wrap">${toolbar()}<div class="fin-loading" role="status">Hisob-kitob qilinmoqda…</div></div>`; }
    function failed(root) {
        root.innerHTML = `<div class="fin-wrap"><div class="fin-alert fin-alert--danger" role="alert"><strong>Moliya ma’lumotini yuklab bo‘lmadi.</strong> ${esc(state.error)}
            <button type="button" class="btn-ghost" data-fin-retry>Qayta urinish</button></div></div>`;
        root.querySelector('[data-fin-retry]').addEventListener('click', () => { invalidate(); render(currentSection()); });
    }
    function stat(label, value, sub, tone, hint) {
        return `<div class="fin-stat ${tone ? 'fin-stat--' + tone : ''}" ${hint ? `title="${esc(hint)}"` : ''}><span class="fin-stat-label">${label}</span><strong class="fin-stat-value">${value}</strong>${sub ? `<span class="fin-stat-sub">${sub}</span>` : ''}</div>`;
    }
    function table(head, rows, opts = {}) {
        return `<div class="fin-table-wrap ${opts.cls || ''}"><table class="fin-table"><thead><tr>${head.map(h => `<th ${h.num ? 'class="num"' : ''}>${h.label ?? h}</th>`).join('')}</tr></thead>
            <tbody>${rows.length ? rows.join('') : `<tr><td colspan="${head.length}" class="fin-empty">${opts.empty || 'Ma’lumot yo‘q'}</td></tr>`}</tbody>${opts.foot ? `<tfoot>${opts.foot}</tfoot>` : ''}</table></div>`;
    }
    function currentSection() { return typeof _tabContext !== 'undefined' ? _tabContext.financeSection : 'umumiy'; }
    function panelRoot(section) { return document.getElementById('finRoot-' + section); }

    // ---------- Umumiy ko'rinish ----------
    function qualityAlerts(o) {
        const q = o.quality, items = [];
        if (!o.cashflow.reconciled) items.push(['danger', `Pul oqimi hisob qoldiqlari bilan ${money(o.cashflow.difference)} farq qiladi`, 'hisobotlar']);
        if (q.suspicious.length) items.push(['danger', `${q.suspicious.length} ta shubhali tushum (${money(q.suspicious.reduce((n, r) => n + r.amount, 0))}) — test yoki xato yozuvga o‘xshaydi`, 'solishtirish']);
        const unchecked = o.accounts.filter(a => a.active && a.kind !== 'suspense' && (a.inflow || a.outflow) && !a.check);
        if (unchecked.length) items.push(['warning', `${unchecked.length} ta hisob qoldig‘i haqiqiy bank/karta qoldig‘i bilan hali solishtirilmagan`, 'kassa']);
        const diff = o.accounts.filter(a => a.check && a.check.difference !== 0);
        if (diff.length) items.push(['danger', `${diff.length} ta hisobda kitobiy va haqiqiy qoldiq farqi bor (${diff.map(a => esc(a.name) + ': ' + money(a.check.difference)).join('; ')})`, 'kassa']);
        const suspense = o.accounts.find(a => a.kind === 'suspense');
        if (suspense && suspense.balance) items.push(['warning', `${money(suspense.balance)} to‘lov usuli aniqlanmagan tushum "Aniqlanmagan" hisobida turibdi`, 'solishtirish']);
        if (q.paidSalaryWithoutCash.length) items.push(['warning', `${q.paidSalaryWithoutCash.length} ta to‘langan maosh kassadan chiqim sifatida yozilmagan`, 'solishtirish']);
        const noExpenses = !Object.keys(o.pnl).some(k => ['cost_of_services', 'marketing', 'sales_payroll', 'admin_payroll', 'rent', 'software', 'admin'].includes(k) && o.pnl[k]);
        if (noExpenses && o.pnl.net_revenue > 0) items.push(['warning', 'Bu davr uchun birorta ham xarajat kiritilmagan — foyda tushumga teng ko‘rinadi va haqiqatni aks ettirmaydi', 'operatsiyalar']);
        if (!items.length) items.push(['ok', 'Ma’lumot sifati tekshiruvidan o‘tdi: pul oqimi va qoldiqlar mos, shubhali yozuv yo‘q', null]);
        return `<div class="fin-alerts">${items.map(([tone, msg, go]) => `<div class="fin-alert fin-alert--${tone}">${tone === 'ok' ? '✓' : tone === 'danger' ? '!' : 'i'} <span>${msg}</span>${go ? `<button type="button" class="fin-link" data-fin-go="${go}">Ko‘rish →</button>` : ''}</div>`).join('')}</div>`;
    }
    function trendChart(rows) {
        if (!rows.length) return '<p class="fin-empty">Ma’lumot yo‘q</p>';
        const W = 640, H = 220, P = 34, bw = Math.min(46, (W - P * 2) / rows.length / 2.6);
        const expenses = r => r.net_revenue - r.net_profit;
        const max = Math.max(1, ...rows.map(r => Math.max(r.net_revenue, expenses(r), Math.abs(r.net_profit))));
        const min = Math.min(0, ...rows.map(r => r.net_profit));
        const y = v => P + (H - P * 2) * (1 - (v - min) / (max - min));
        const x = i => P + (i + 0.5) * ((W - P * 2) / rows.length);
        const bars = rows.map((r, i) => `<g><title>${monthName(r.month)}: tushum ${money(r.net_revenue)}, xarajat ${money(expenses(r))}, sof foyda ${money(r.net_profit)}</title>
            <rect x="${x(i) - bw - 2}" y="${y(Math.max(0, r.net_revenue))}" width="${bw}" height="${Math.abs(y(0) - y(r.net_revenue))}" rx="4" class="fin-bar-in"/>
            <rect x="${x(i) + 2}" y="${y(Math.max(0, expenses(r)))}" width="${bw}" height="${Math.abs(y(0) - y(expenses(r)))}" rx="4" class="fin-bar-out"/>
            <text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="fin-axis">${monthName(r.month)}</text></g>`).join('');
        const line = rows.map((r, i) => `${x(i)},${y(r.net_profit)}`).join(' ');
        return `<svg viewBox="0 0 ${W} ${H}" class="fin-chart" role="img" aria-label="Oylik tushum, xarajat va sof foyda">
            <line x1="${P}" x2="${W - P}" y1="${y(0)}" y2="${y(0)}" class="fin-zero"/>${bars}
            <polyline points="${line}" class="fin-line"/>${rows.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.net_profit)}" r="3.5" class="fin-dot"/>`).join('')}</svg>
            <div class="fin-legend"><span><i class="fin-bar-in"></i>Sof tushum</span><span><i class="fin-bar-out"></i>Xarajatlar</span><span><i class="fin-line-key"></i>Sof foyda</span></div>`;
    }
    function renderOverview(root) {
        const o = state.overview, k = o.kpis, p = o.pnl, b = o.balance;
        root.innerHTML = `<div class="fin-wrap">${toolbar({ basis: true })}
            ${qualityAlerts(o)}
            <div class="fin-stats">
                ${stat('Pul qoldig‘i', money(b.cash), `${o.accounts.filter(a => a.balance).length} ta hisobda · ${dateText(o.period.end)} holatiga`, b.cash < 0 ? 'danger' : '', 'Barcha hisob raqamlar: kassa, karta, bank, Uzum kliring')}
                ${stat('Sof tushum', money(p.net_revenue), `qaytarishlar: ${money(p.refunds || 0)}`, '', 'Kurs to‘lovlari minus mijozga qaytarilgan to‘lovlar')}
                ${stat('Yalpi foyda', money(p.gross_profit), 'marja ' + pctText(p.margins.gross), p.gross_profit < 0 ? 'danger' : '')}
                ${stat('Sof foyda', money(p.net_profit), 'marja ' + pctText(p.margins.net), p.net_profit < 0 ? 'danger' : 'success', state.basis === 'cash' ? 'Kassa usuli' : 'Hisoblash usuli')}
                ${stat('Debitorlik', money(o.receivables.total), `muddati o‘tgan: ${money(o.receivables.overdue)}`, o.receivables.overdue ? 'warning' : '', 'O‘quvchilarning joriy qarzi (CRM kartasi bo‘yicha)')}
                ${stat('Kreditorlik', money(o.payables.total), `maosh: ${money(o.payables.salaries)} · qarz: ${money(o.payables.loans)}`, o.payables.overdue ? 'warning' : '')}
                ${stat('Yangi sotuvlar', `${k.newSales} ta`, `o‘rtacha chek: ${k.averageCheck ? money(k.averageCheck) : '—'}`, '', 'Davr ichida birinchi to‘lovi tushgan yangi o‘quvchilar')}
                ${stat('Qarz undirildi', money(k.collections), `${k.receiptCount} ta to‘lov`, '', 'Avvalgi sotuvlar bo‘yicha qarz to‘lovlari')}
                ${stat('CAC', k.cac ? money(k.cac) : '—', k.fullCac ? 'sotuv maoshi bilan: ' + money(k.fullCac) : 'marketing xarajati kiritilmagan', '', 'Bitta yangi o‘quvchini jalb qilish narxi = marketing xarajati / yangi sotuvlar')}
                ${stat('Runway', k.runwayMonths != null ? k.runwayMonths + ' oy' : '—', k.averageMonthlyOperatingCashFlow < 0 ? 'o‘rtacha oylik operatsion oqim: ' + money(k.averageMonthlyOperatingCashFlow) : 'operatsion oqim musbat', k.runwayMonths != null && k.runwayMonths < 3 ? 'danger' : '', 'Joriy pul qoldig‘i oxirgi 3 oydagi o‘rtacha manfiy operatsion oqimga necha oy yetadi')}
            </div>
            <div class="fin-grid">
                <section class="fin-card fin-card--wide"><header><h3>Oylik dinamika</h3><span class="fin-muted">${state.basis === 'cash' ? 'kassa usuli' : 'hisoblash usuli'}</span></header>${trendChart(o.monthly)}</section>
                <section class="fin-card"><header><h3>Hisob raqamlar</h3><button type="button" class="fin-link" data-fin-go="kassa">Kassa →</button></header>
                    <ul class="fin-list">${o.accounts.filter(a => a.active || a.balance).map(a => `<li><span>${esc(a.name)} ${a.check ? (a.check.difference ? `<span class="fin-badge fin-badge--danger" title="Oxirgi tekshiruv ${dateText(a.check.date)}">farq ${money(a.check.difference)}</span>` : `<span class="fin-badge fin-badge--ok" title="${dateText(a.check.date)} da tasdiqlangan">✓</span>`) : ''}</span><strong class="${a.balance < 0 ? 'neg' : ''}">${money(a.balance)}</strong></li>`).join('')}
                    <li class="fin-list-total"><span>Jami</span><strong>${money(b.cash)}</strong></li></ul></section>
                <section class="fin-card"><header><h3>Pul oqimi (davr)</h3><button type="button" class="fin-link" data-fin-go="hisobotlar" data-fin-report="cashflow">Hisobot →</button></header>
                    <ul class="fin-list">
                        <li><span>Boshlang‘ich qoldiq</span><strong>${money(o.cashflow.openingCash + o.cashflow.openingInjection)}</strong></li>
                        <li><span>Operatsion faoliyat</span><strong class="${o.cashflow.net.operating < 0 ? 'neg' : 'pos'}">${money(o.cashflow.net.operating)}</strong></li>
                        <li><span>Investitsion faoliyat</span><strong class="${o.cashflow.net.investing < 0 ? 'neg' : ''}">${money(o.cashflow.net.investing)}</strong></li>
                        <li><span>Moliyaviy faoliyat</span><strong class="${o.cashflow.net.financing < 0 ? 'neg' : ''}">${money(o.cashflow.net.financing)}</strong></li>
                        <li class="fin-list-total"><span>Yakuniy qoldiq ${o.cashflow.reconciled ? '<span class="fin-badge fin-badge--ok" title="Hisob qoldiqlari yig‘indisiga teng">✓ mos</span>' : '<span class="fin-badge fin-badge--danger">mos emas</span>'}</span><strong>${money(o.cashflow.closingCash)}</strong></li>
                    </ul></section>
            </div>
            <p class="fin-note">Tushum — Moliya to‘lovlar reyestridan (to‘langan sana bo‘yicha), bekor qilingan va test yozuvlarsiz. Xarajatlar — “Operatsiyalar” bo‘limida kiritilganlar. Debitorlik — o‘quvchi kartalaridagi joriy qarz.
            ${state.basis === 'accrual' ? `Hisoblash usulida kurs to‘lovi ${o.settings.courseMonths.english} oy (ingliz) / ${o.settings.courseMonths.russian} oy (rus) davomida teng tan olinadi — bu sozlamadagi taxmin.` : ''}</p>
        </div>`;
        bindToolbar(root, () => render('umumiy'));
        bindGo(root);
    }
    function bindGo(root) {
        root.querySelectorAll('[data-fin-go]').forEach(b => b.addEventListener('click', () => {
            if (b.dataset.finReport) state.report = b.dataset.finReport;
            if (typeof switchFinanceSection === 'function') switchFinanceSection(b.dataset.finGo);
        }));
    }

    // ---------- Kassa va hisoblar ----------
    async function renderCash(root) {
        const o = state.overview;
        if (!state.cashbook || state.cashbook._key !== [scope(), state.start, state.end, state.cashAccount].join('|')) {
            try {
                state.cashbook = await apiFetch(`/api/finance/cashbook?scope=${scope()}&start=${state.start}&end=${state.end}&account=${encodeURIComponent(state.cashAccount)}`, { timeout: 30000 });
                state.cashbook._key = [scope(), state.start, state.end, state.cashAccount].join('|');
            } catch (e) { state.cashbook = { error: e.message, days: [] }; }
        }
        const cb = state.cashbook;
        const accountCards = o.accounts.filter(a => a.active || a.balance).map(a => `<article class="fin-account">
            <header><span class="fin-account-kind">${esc(F.ACCOUNT_KINDS[a.kind] || a.kind)}</span>${a.entity !== 'common' ? `<span class="fin-badge fin-badge--muted">${esc(F.ENTITIES[a.entity])}</span>` : ''}</header>
            <h4>${esc(a.name)}</h4><strong class="${a.balance < 0 ? 'neg' : ''}">${money(a.balance)}</strong>
            <dl><div><dt>Kirim</dt><dd>${money(a.inflow)}</dd></div><div><dt>Chiqim</dt><dd>${money(a.outflow)}</dd></div>
            ${a.openingBalance ? `<div><dt>Boshlang‘ich (${dateText(a.openingDate)})</dt><dd>${money(a.openingBalance)}</dd></div>` : ''}</dl>
            ${a.check ? `<p class="fin-check ${a.check.difference ? 'bad' : 'good'}">${dateText(a.check.date)} tekshiruv: haqiqiy ${money(a.check.actual)}, kitobda ${money(a.check.book)}${a.check.difference ? ` — <b>farq ${money(a.check.difference)}</b>` : ' — mos ✓'}</p>` : '<p class="fin-check">Haqiqiy qoldiq bilan hali solishtirilmagan</p>'}
            ${a.kind !== 'suspense' ? `<button type="button" class="btn-ghost btn-sm" data-fin-check="${esc(a.id)}">Haqiqiy qoldiqni kiritish</button>` : ''}
        </article>`).join('');
        const options = `<option value="">Barcha hisoblar</option>` + o.accountsList.map(a => `<option value="${esc(a.id)}" ${a.id === state.cashAccount ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
        const dayRows = (cb.days || []).slice().reverse().map(d => `<tr class="fin-day" data-fin-day="${d.date}"><td><button type="button" class="fin-expand" aria-expanded="false">▸</button> ${dateText(d.date)}</td><td class="num">${acc(d.opening)}</td><td class="num pos">${num(d.inflow)}</td><td class="num neg">${d.outflow ? '(' + num(d.outflow) + ')' : '0'}</td><td class="num"><b>${acc(d.closing)}</b></td><td class="num">${d.entries.length}</td></tr>
            <tr class="fin-day-entries" hidden><td colspan="6">${table(['Hisob', 'Turi', 'Kim / izoh', { label: 'Summa', num: true }],
                d.entries.map(m => `<tr class="${m.isReversal ? 'fin-reversal' : ''}"><td>${esc(accountName(m.account))}</td><td>${esc(m.source === 'receipt' ? (m.isReversal ? 'Tushum bekor qilindi' : 'Kurs to‘lovi') : catName(m.category))}${m.isReversal ? ' <span class="fin-badge fin-badge--muted">storno</span>' : ''}</td>
                <td>${esc(m.source === 'receipt' ? m.name + (m.managerName ? ' · ' + m.managerName : '') : [m.counterparty, m.description].filter(Boolean).join(' · '))}</td><td class="num ${m.sign < 0 ? 'neg' : 'pos'}">${m.sign < 0 ? '(' + num(m.amount) + ')' : num(m.amount)}</td></tr>`))}</td></tr>`);
        root.innerHTML = `<div class="fin-wrap">${toolbar({ actions: `<button type="button" class="btn-ghost" data-fin-new="transfer">⇄ O‘tkazma</button>` })}
            <div class="fin-accounts">${accountCards}</div>
            <section class="fin-card"><header><h3>Kunlik kassa daftari</h3><label class="fin-field fin-field--inline"><span>Hisob</span><select class="form-control" data-fin-cash-account>${options}</select></label></header>
            ${cb.error ? `<div class="fin-alert fin-alert--danger">${esc(cb.error)}</div>` : `<div class="fin-cash-summary">${stat('Boshlang‘ich', money(cb.openingBalance))}${stat('Kirim', money(cb.inflow), '', 'success')}${stat('Chiqim', money(cb.outflow), '', 'danger')}${stat('Yakuniy', money(cb.closingBalance))}</div>
            ${table(['Sana', { label: 'Kun boshiga', num: true }, { label: 'Kirim', num: true }, { label: 'Chiqim', num: true }, { label: 'Kun oxiriga', num: true }, { label: 'Yozuv', num: true }], dayRows, { empty: 'Bu davrda pul harakati yo‘q', cls: 'fin-cashbook' })}`}
            <p class="fin-note">Summalar so‘mda. Qavs ichidagi raqam — chiqim. Bekor qilingan tushum yoki storno o‘sha kunning o‘zida teskari yozuv bilan ko‘rinadi, asl yozuv o‘chirilmaydi.</p></section>
        </div>`;
        bindToolbar(root, () => render('kassa'));
        root.querySelector('[data-fin-cash-account]')?.addEventListener('change', e => { state.cashAccount = e.target.value; state.cashbook = null; render('kassa'); });
        root.querySelectorAll('[data-fin-day] .fin-expand').forEach(btn => btn.addEventListener('click', () => {
            const tr = btn.closest('tr').nextElementSibling, open = tr.hidden;
            tr.hidden = !open; btn.textContent = open ? '▾' : '▸'; btn.setAttribute('aria-expanded', String(open));
        }));
        root.querySelectorAll('[data-fin-check]').forEach(b => b.addEventListener('click', () => openCheckModal(b.dataset.finCheck)));
        root.querySelector('[data-fin-new]')?.addEventListener('click', () => openTxnModal({ type: 'transfer' }));
    }

    // ---------- Operatsiyalar (xarajat, qaytarish, kapital, qarz, o'tkazma) ----------
    async function renderOperations(root) {
        if (!state.txns || state.txns._key !== [scope(), state.start, state.end].join('|')) {
            try { state.txns = await apiFetch(`/api/finance/transactions?scope=${scope()}&start=${state.start}&end=${state.end}`, { timeout: 30000 }); state.txns._key = [scope(), state.start, state.end].join('|'); }
            catch (e) { state.txns = { error: e.message, rows: [] }; }
        }
        const t = state.txns, f = state.txFilter;
        const reversedIds = new Set((t.rows || []).filter(r => r.reversesId).map(r => r.reversesId));
        const rows = (t.rows || []).filter(r => (!f.type || r.type === f.type) && (!f.category || r.categoryCode === f.category)
            && (!f.search || [r.counterparty, r.description, catName(r.categoryCode)].join(' ').toLowerCase().includes(f.search.toLowerCase())));
        const out = r => !['income', 'capital', 'loan_in'].includes(r.type);
        const totalOut = rows.filter(r => out(r) && r.type !== 'transfer').reduce((n, r) => n + (r.reversesId ? -1 : 1) * r.amount, 0);
        const totalIn = rows.filter(r => !out(r)).reduce((n, r) => n + (r.reversesId ? -1 : 1) * r.amount, 0);
        const byCat = {};
        for (const r of rows) if (r.type === 'expense') byCat[r.categoryCode] = (byCat[r.categoryCode] || 0) + (r.reversesId ? -1 : 1) * r.amount;
        const catRows = Object.entries(byCat).filter(([, v]) => v).sort((a, b) => b[1] - a[1]);
        const catMax = Math.max(1, ...catRows.map(([, v]) => v));
        const quick = [['expense', '+ Xarajat'], ['income', '+ Boshqa tushum'], ['refund', '↩ Qaytarish'], ['capital', 'Ta’sischi kiritdi'], ['drawing', 'Ta’sischi oldi'], ['loan_in', 'Qarz olindi'], ['transfer', '⇄ O‘tkazma']];
        root.innerHTML = `<div class="fin-wrap">${toolbar({ actions: `<button type="button" class="btn-primary-sm" data-fin-new="expense">+ Xarajat</button>` })}
            <div class="fin-quick">${quick.map(([type, label]) => `<button type="button" class="fin-chip" data-fin-new="${type}">${label}</button>`).join('')}</div>
            <div class="fin-grid">
                <section class="fin-card fin-card--wide">
                    <header><h3>Operatsiyalar jurnali</h3>
                        <div class="fin-filters">
                            <select class="form-control" data-fin-tx-type><option value="">Barcha turlar</option>${Object.entries(F.TYPES).map(([k, l]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
                            <select class="form-control" data-fin-tx-cat><option value="">Barcha toifalar</option>${F.CATEGORIES.filter(c => c.type !== 'receipt').map(c => `<option value="${c.code}" ${f.category === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
                            <input type="search" class="form-control" placeholder="Qidirish: kimga, izoh" data-fin-tx-search value="${esc(f.search)}">
                        </div></header>
                    ${t.error ? `<div class="fin-alert fin-alert--danger">${esc(t.error)}</div>` : table(['Sana', 'Turi / toifa', 'Kimga / izoh', 'Hisob', 'Yo‘nalish', { label: 'Summa', num: true }, ''],
                        rows.map(r => {
                            const isOut = out(r), signed = (r.reversesId ? -1 : 1) * (isOut ? -1 : 1) * r.amount;
                            const canReverse = !r.reversesId && !reversedIds.has(r.id) && !r.reversed;
                            return `<tr class="${r.reversesId ? 'fin-reversal' : reversedIds.has(r.id) || r.reversed ? 'fin-reversed' : ''}">
                                <td>${dateText(r.date)}</td>
                                <td><b>${esc(F.TYPES[r.type])}</b><small>${esc(catName(r.categoryCode))}</small>${r.legacy ? '<span class="fin-badge fin-badge--warning" title="Eski Cash Flow bo‘limidan ko‘chirilgan — tekshiring">eski</span>' : ''}${r.reversesId ? '<span class="fin-badge fin-badge--muted">storno</span>' : ''}${reversedIds.has(r.id) || r.reversed ? '<span class="fin-badge fin-badge--muted">bekor qilingan</span>' : ''}${r.salaryId ? '<span class="fin-badge fin-badge--muted">maosh</span>' : ''}</td>
                                <td>${esc(r.counterparty)}<small>${esc(r.description)}</small>${r.receiptUrl ? `<a href="${esc(r.receiptUrl)}" target="_blank" rel="noopener" class="fin-link">chek</a>` : ''}</td>
                                <td>${esc(accountName(r.accountId))}${r.toAccountId ? ' → ' + esc(accountName(r.toAccountId)) : ''}</td>
                                <td>${esc(F.ENTITIES[r.entity])}</td>
                                <td class="num ${r.type === 'transfer' ? '' : signed < 0 ? 'neg' : 'pos'}">${r.type === 'transfer' ? num(r.amount) : signed < 0 ? '(' + num(signed) + ')' : num(signed)}</td>
                                <td>${canReverse ? `<button type="button" class="fin-link fin-link--danger" data-fin-reverse="${esc(r.id)}" title="Teskari yozuv bilan bekor qilish (asl yozuv saqlanadi)">Storno</button>` : ''}</td></tr>`;
                        }), { empty: 'Bu davrda operatsiya kiritilmagan. Yuqoridagi tugmalar orqali xarajat va boshqa operatsiyalarni kiriting.' })}
                    <div class="fin-totals"><span>Chiqimlar: <b class="neg">${money(totalOut)}</b></span><span>Tushumlar (kurs to‘lovidan tashqari): <b class="pos">${money(totalIn)}</b></span></div>
                </section>
                <section class="fin-card"><header><h3>Xarajatlar tarkibi</h3></header>
                    ${catRows.length ? `<ul class="fin-bars">${catRows.map(([code, v]) => `<li><span>${esc(catName(code))}</span><div class="fin-bar-track"><i style="width:${Math.max(2, Math.round(v / catMax * 100))}%"></i></div><b>${money(v)}</b></li>`).join('')}</ul>` : '<p class="fin-empty">Xarajat kiritilmagan</p>'}
                </section>
            </div>
            <p class="fin-note">1 000 000 so‘mdan katta chiqim uchun chek yoki hujjat majburiy. Xato kiritilgan operatsiya o‘chirilmaydi — “Storno” teskari yozuv qo‘shadi va ikkalasi ham jurnalda qoladi.</p>
        </div>`;
        bindToolbar(root, () => render('operatsiyalar'));
        root.querySelectorAll('[data-fin-new]').forEach(b => b.addEventListener('click', () => openTxnModal({ type: b.dataset.finNew })));
        root.querySelector('[data-fin-tx-type]')?.addEventListener('change', e => { f.type = e.target.value; render('operatsiyalar'); });
        root.querySelector('[data-fin-tx-cat]')?.addEventListener('change', e => { f.category = e.target.value; render('operatsiyalar'); });
        const search = root.querySelector('[data-fin-tx-search]');
        search?.addEventListener('input', () => { clearTimeout(search._t); search._t = setTimeout(() => { f.search = search.value; render('operatsiyalar'); setTimeout(() => { const s = panelRoot('operatsiyalar').querySelector('[data-fin-tx-search]'); s?.focus(); s?.setSelectionRange(s.value.length, s.value.length); }); }, 300); });
        root.querySelectorAll('[data-fin-reverse]').forEach(b => b.addEventListener('click', () => openReverseModal(b.dataset.finReverse)));
    }

    // ---------- Qarzlar: debitorlik va kreditorlik ----------
    function renderDebts(root) {
        const o = state.overview, ar = o.receivables, ap = o.payables, tab = state.debtTab;
        const arView = `<div class="fin-aging">${ar.buckets.map(b => `<div class="fin-aging-cell fin-aging--${b.key}"><span>${b.label}</span><strong>${money(b.amount)}</strong><small>${b.count} ta · ${pctText(b.share)}</small></div>`).join('')}</div>
            ${table(['O‘quvchi', 'Telefon', 'Yo‘nalish', { label: 'Qarz', num: true }, 'To‘lov sanasi', { label: 'Kechikish', num: true }, 'Holat'],
                ar.rows.slice(0, 300).map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.phone || '')}</td><td>${esc(F.ENTITIES[r.entity])}</td><td class="num"><b>${num(r.debt)}</b></td><td>${dateText(r.dueDate)}</td>
                    <td class="num ${r.overdueDays > 30 ? 'neg' : ''}">${r.overdueDays ? r.overdueDays + ' kun' : '—'}</td><td>${r.frozen ? '<span class="fin-badge fin-badge--muted">muzlatilgan</span>' : esc(r.status || '')}</td></tr>`),
                { empty: 'Qarzdor o‘quvchi yo‘q' })}
            <p class="fin-note">Manba: o‘quvchi kartasidagi joriy qarz va keyingi to‘lov sanasi (${esc(o.assumptions.receivablesSource)}). Muddati 90 kundan oshgan qarzlar undirilishi shubhali hisoblanadi.</p>`;
        const kindLabel = { salary: 'Maosh', bill: 'Hisob-faktura', loan: 'Olingan qarz', other: 'Boshqa' };
        const apView = `<div class="fin-stats fin-stats--compact">${stat('Jami kreditorlik', money(ap.total))}${stat('Maosh (hisoblangan, to‘lanmagan)', money(ap.salaries))}${stat('Hisob-fakturalar', money(ap.bills + ap.other))}${stat('Olingan qarzlar', money(ap.loans))}${stat('Muddati o‘tgan', money(ap.overdue), '', ap.overdue ? 'danger' : '')}</div>
            ${table(['Turi', 'Kimga', 'Izoh', 'Hujjat sanasi', 'Muddat', { label: 'Jami', num: true }, { label: 'To‘langan', num: true }, { label: 'Qoldiq', num: true }, ''],
                ap.rows.map(r => `<tr><td><span class="fin-badge fin-badge--${r.kind === 'loan' ? 'warning' : 'muted'}">${kindLabel[r.kind]}</span></td><td>${esc(r.counterparty)}</td><td>${esc(r.description)}<small>${esc(catName(r.categoryCode))}</small></td>
                    <td>${dateText(r.issueDate)}</td><td class="${r.overdueDays ? 'neg' : ''}">${dateText(r.dueDate)}${r.overdueDays ? ` <small>${r.overdueDays} kun o‘tgan</small>` : ''}</td>
                    <td class="num">${num(r.amount)}</td><td class="num">${num(r.paid)}</td><td class="num"><b>${num(r.outstanding)}</b></td>
                    <td>${r.kind === 'salary' ? '<span class="fin-muted" title="Avval Maoshlar bo‘limida “To‘landi” deb belgilang, keyin Audit bo‘limida kassadan chiqimini yozing">Maoshlar bo‘limida</span>' : `<button type="button" class="btn-ghost btn-sm" data-fin-pay="${esc(r.id)}">To‘lash</button>${r.kind !== 'loan' && !r.paid ? ` <button type="button" class="fin-link fin-link--danger" data-fin-void-payable="${esc(r.id)}">Bekor</button>` : ''}`}</td></tr>`),
                { empty: 'Korxonaning to‘lanmagan qarzi yo‘q' })}
            <p class="fin-note">Kreditorlik — hisob-faktura (ijara, reklama, servis) kiritilgan, lekin hali to‘lanmagan summalar, hisoblangan lekin to‘lanmagan maoshlar va olingan qarzlar qoldig‘i.</p>`;
        root.innerHTML = `<div class="fin-wrap">${toolbar({ actions: `<button type="button" class="btn-primary-sm" data-fin-new-payable>+ Hisob-faktura</button><button type="button" class="btn-ghost" data-fin-new="loan_in">Qarz olindi</button>` })}
            <div class="fin-seg fin-seg--tabs" role="tablist">
                <button type="button" role="tab" aria-selected="${tab === 'receivables'}" class="${tab === 'receivables' ? 'active' : ''}" data-fin-debt-tab="receivables">Debitorlik — bizga qarzlar · ${money(ar.total)}</button>
                <button type="button" role="tab" aria-selected="${tab === 'payables'}" class="${tab === 'payables' ? 'active' : ''}" data-fin-debt-tab="payables">Kreditorlik — bizning qarzlarimiz · ${money(ap.total)}</button></div>
            <section class="fin-card">${tab === 'receivables' ? arView : apView}</section></div>`;
        bindToolbar(root, () => render('qarzlar'));
        root.querySelectorAll('[data-fin-debt-tab]').forEach(b => b.addEventListener('click', () => { state.debtTab = b.dataset.finDebtTab; render('qarzlar'); }));
        root.querySelector('[data-fin-new-payable]')?.addEventListener('click', openPayableModal);
        root.querySelector('[data-fin-new]')?.addEventListener('click', () => openTxnModal({ type: 'loan_in' }));
        root.querySelectorAll('[data-fin-pay]').forEach(b => b.addEventListener('click', () => {
            const p = ap.rows.find(r => r.id === b.dataset.finPay);
            openTxnModal(p.kind === 'loan' ? { type: 'loan_repay', payableId: p.id, amount: p.outstanding, entity: p.entity, counterparty: p.counterparty }
                : { type: 'expense', payableId: p.id, categoryCode: p.categoryCode, amount: p.outstanding, entity: p.entity, counterparty: p.counterparty, description: p.description });
        }));
        root.querySelectorAll('[data-fin-void-payable]').forEach(b => b.addEventListener('click', () => openReasonModal('Hisob-fakturani bekor qilish', 'Bekor qilish', async reason => { await api('/payables/' + encodeURIComponent(b.dataset.finVoidPayable) + '/void', { reason }); })));
    }

    // ---------- Hisobotlar ----------
    function pnlTable(p, other) {
        const showOther = !!other;
        const rows = p.lines.map(l => {
            const neg = ['refunds', 'cost_of_services', 'sales_payroll', 'marketing', 'admin_payroll', 'rent', 'software', 'admin', 'opex', 'finance_cost', 'other_expense', 'tax'].includes(l.key);
            const show = v => neg ? (v ? '(' + num(v) + ')' : '—') : acc(v);
            const ol = showOther ? other.lines.find(x => x.key === l.key) : null;
            const margin = { gross_profit: p.margins.gross, ebitda: p.margins.ebitda, net_profit: p.margins.net }[l.key];
            return `<tr class="fin-pnl-${l.kind}"><td>${esc(l.label)}</td><td class="num">${show(l.amount)}</td><td class="num fin-muted">${margin != null ? pctText(margin) : l.kind !== 'line' || l.key === 'revenue' || !l.amount ? '' : pctText(F.pct(l.amount, p.net_revenue))}</td>${showOther ? `<td class="num fin-muted">${show(ol?.amount || 0)}</td>` : ''}</tr>`;
        });
        rows.push(`<tr class="fin-pnl-memo"><td colspan="${showOther ? 4 : 3}">P&L’ga kirmaydigan pul harakatlari</td></tr>`);
        rows.push(`<tr><td>Kapital xarajatlar (uskuna, aktivlar)</td><td class="num">${p.belowTheLine.capex ? '(' + num(p.belowTheLine.capex) + ')' : '—'}</td><td></td>${showOther ? '<td></td>' : ''}</tr>`);
        rows.push(`<tr><td>Ta’sischiga to‘langan mablag‘</td><td class="num">${p.belowTheLine.ownerDrawings ? '(' + num(p.belowTheLine.ownerDrawings) + ')' : '—'}</td><td></td>${showOther ? '<td></td>' : ''}</tr>`);
        rows.push(`<tr><td>Ta’sischi kiritgan mablag‘</td><td class="num">${p.belowTheLine.ownerContributions ? num(p.belowTheLine.ownerContributions) : '—'}</td><td></td>${showOther ? '<td></td>' : ''}</tr>`);
        if (p.unallocatedCommon) rows.push(`<tr><td>Umumiy (taqsimlanmagan) xarajatlar natijasi — konsolidatsiyada hisobga olinadi</td><td class="num">${acc(p.unallocatedCommon)}</td><td></td>${showOther ? '<td></td>' : ''}</tr>`);
        return `<div class="fin-table-wrap"><table class="fin-table fin-report"><thead><tr><th>Ko‘rsatkich</th><th class="num">${p.basis === 'cash' ? 'Kassa usuli' : 'Hisoblash usuli'}</th><th class="num">Sof tushumga nisbatan</th>${showOther ? `<th class="num">${other.basis === 'cash' ? 'Kassa usuli' : 'Hisoblash usuli'}</th>` : ''}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
    }
    function cashflowTable(cf) {
        const section = (title, lines, net) => `<tr class="fin-pnl-section"><td colspan="2">${title}</td></tr>${lines.map(l => `<tr><td class="fin-indent">${esc(l.label)}</td><td class="num">${l.amount ? acc(l.amount) : '—'}</td></tr>`).join('')}<tr class="fin-pnl-subtotal"><td>${title.replace('faoliyatdan', 'faoliyatdan sof pul oqimi')}</td><td class="num">${acc(net)}</td></tr>`;
        return `<div class="fin-table-wrap"><table class="fin-table fin-report"><thead><tr><th>Moddalar (IAS 7, to‘g‘ridan-to‘g‘ri usul)</th><th class="num">so‘m</th></tr></thead><tbody>
            ${section('Operatsion faoliyatdan', cf.operating, cf.net.operating)}
            ${section('Investitsion faoliyatdan', cf.investing, cf.net.investing)}
            ${section('Moliyaviy faoliyatdan', cf.financing, cf.net.financing)}
            <tr class="fin-pnl-total"><td>Pul mablag‘larining sof o‘zgarishi</td><td class="num">${acc(cf.netChange)}</td></tr>
            <tr><td>Davr boshidagi pul qoldig‘i</td><td class="num">${acc(cf.openingCash)}</td></tr>
            ${cf.openingInjection ? `<tr><td>Davr ichida kiritilgan boshlang‘ich qoldiq</td><td class="num">${acc(cf.openingInjection)}</td></tr>` : ''}
            ${cf.preOpeningExcluded ? `<tr><td>Hisob ochilish sanasidan oldingi harakatlar (qoldiqqa kirmaydi)</td><td class="num">${acc(-cf.preOpeningExcluded)}</td></tr>` : ''}
            <tr class="fin-pnl-total"><td>Davr oxiridagi pul qoldig‘i ${cf.reconciled ? '<span class="fin-badge fin-badge--ok">✓ hisob qoldiqlariga teng</span>' : `<span class="fin-badge fin-badge--danger">farq ${num(cf.difference)}</span>`}</td><td class="num">${acc(cf.closingCash)}</td></tr>
        </tbody></table></div>`;
    }
    function balanceTable(b) {
        return `<div class="fin-table-wrap"><table class="fin-table fin-report"><thead><tr><th>${dateText(b.asOf)} holatiga</th><th class="num">so‘m</th></tr></thead><tbody>
            <tr class="fin-pnl-section"><td colspan="2">Aktivlar</td></tr>
            ${b.accounts.filter(a => a.balance).map(a => `<tr><td class="fin-indent">${esc(a.name)}</td><td class="num">${acc(a.balance)}</td></tr>`).join('')}
            <tr class="fin-pnl-subtotal"><td>Pul mablag‘lari jami</td><td class="num">${acc(b.cash)}</td></tr>
            <tr><td class="fin-indent">O‘quvchilar qarzi (debitorlik)${b.receivablesOverdue ? ` <small>shundan muddati o‘tgan ${num(b.receivablesOverdue)}</small>` : ''}</td><td class="num">${acc(b.receivables)}</td></tr>
            <tr class="fin-pnl-total"><td>Aktivlar jami</td><td class="num">${acc(b.assets)}</td></tr>
            <tr class="fin-pnl-section"><td colspan="2">Majburiyatlar</td></tr>
            <tr><td class="fin-indent">Hisoblangan, to‘lanmagan maosh</td><td class="num">${acc(b.payables.salaries)}</td></tr>
            <tr><td class="fin-indent">Yetkazib beruvchilarga qarz (hisob-fakturalar)</td><td class="num">${acc(b.payables.bills + b.payables.other)}</td></tr>
            <tr><td class="fin-indent">Olingan qarzlar</td><td class="num">${acc(b.loans)}</td></tr>
            <tr><td class="fin-indent">Muddati kelmagan xizmat uchun olingan to‘lov (kelgusi davr daromadi)</td><td class="num">${acc(b.deferredRevenue)}</td></tr>
            <tr class="fin-pnl-total"><td>Majburiyatlar jami</td><td class="num">${acc(b.liabilities)}</td></tr>
            <tr class="fin-pnl-total fin-pnl-grand"><td>Sof aktivlar (kapital)</td><td class="num">${acc(b.netAssets)}</td></tr>
        </tbody></table></div>
        <p class="fin-note">Boshqaruv balansi: asosiy vositalar va soliq hisob-kitoblari kiritilmagan bo‘lsa, ular bu yerda ko‘rinmaydi. Kelgusi davr daromadi — o‘quvchi to‘lagan, lekin dars hali o‘tilmagan qism (kurs ${state.overview.settings.courseMonths.english}/${state.overview.settings.courseMonths.russian} oy deb olingan).</p>`;
    }
    function monthlyTable(rows) {
        const metrics = [['revenue', 'Kurs to‘lovlari'], ['refunds', 'Qaytarishlar'], ['net_revenue', 'Sof tushum'], ['cost_of_services', 'Xizmat tannarxi'], ['gross_profit', 'Yalpi foyda'], ['opex', 'Operatsion xarajatlar'], ['ebitda', 'EBITDA'], ['net_profit', 'Sof foyda']];
        return `<div class="fin-table-wrap"><table class="fin-table fin-report"><thead><tr><th>Ko‘rsatkich</th>${rows.map(r => `<th class="num">${monthName(r.month)}</th>`).join('')}<th class="num">Jami</th></tr></thead><tbody>
            ${metrics.map(([k, l]) => `<tr class="${['net_revenue', 'gross_profit', 'ebitda', 'net_profit'].includes(k) ? 'fin-pnl-total' : ''}"><td>${l}</td>${rows.map(r => `<td class="num">${['refunds', 'cost_of_services', 'opex'].includes(k) ? (r[k] ? '(' + num(r[k]) + ')' : '—') : acc(r[k])}</td>`).join('')}<td class="num">${acc(rows.reduce((n, r) => n + (['refunds', 'cost_of_services', 'opex'].includes(k) ? -1 : 1) * r[k], 0))}</td></tr>`).join('')}
            <tr><td>Sof foyda marjasi</td>${rows.map(r => `<td class="num fin-muted">${pctText(F.pct(r.net_profit, r.net_revenue))}</td>`).join('')}<td></td></tr>
        </tbody></table></div>`;
    }
    function renderReports(root) {
        const o = state.overview, r = state.report;
        const tabs = [['pnl', 'Foyda va zarar'], ['cashflow', 'Pul oqimlari'], ['balance', 'Balans'], ['monthly', 'Oylik taqqoslash']];
        const body = r === 'cashflow' ? cashflowTable(o.cashflow) : r === 'balance' ? balanceTable(o.balance) : r === 'monthly' ? monthlyTable(o.monthly) : pnlTable(o.pnl, o.pnlOther);
        root.innerHTML = `<div class="fin-wrap">${toolbar({ basis: r === 'pnl' || r === 'monthly', actions: `<button type="button" class="btn-ghost" data-fin-export>⬇ Excel</button><button type="button" class="btn-ghost" data-fin-print>🖨 PDF / chop etish</button>` })}
            <div class="fin-seg fin-seg--tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === r}" class="${k === r ? 'active' : ''}" data-fin-report-tab="${k}">${l}</button>`).join('')}</div>
            <section class="fin-card fin-print-area">
                <header class="fin-report-head"><div><h3>${tabs.find(t => t[0] === r)[1]}</h3><p class="fin-muted">${esc(scopeLabel())} · ${r === 'balance' ? dateText(o.period.end) + ' holatiga' : dateText(o.period.start) + ' — ' + dateText(o.period.end)} · so‘mda</p></div></header>
                ${body}
                <footer class="fin-report-foot">Tayyorlandi: ${new Date().toLocaleString('uz-UZ')} · Manba: Myhomework CRM moliya reyestri · Raqamlar storno va bekor qilingan yozuvlar hisobga olingan holda. ${o.closedThrough ? `Davr ${esc(o.closedThrough)} gacha yopilgan.` : 'Davr hali yopilmagan — raqamlar o‘zgarishi mumkin.'}</footer>
            </section></div>`;
        bindToolbar(root, () => render('hisobotlar'));
        root.querySelectorAll('[data-fin-report-tab]').forEach(b => b.addEventListener('click', () => { state.report = b.dataset.finReportTab; render('hisobotlar'); }));
        root.querySelector('[data-fin-print]')?.addEventListener('click', () => { document.body.classList.add('fin-printing'); window.print(); setTimeout(() => document.body.classList.remove('fin-printing'), 500); });
        root.querySelector('[data-fin-export]')?.addEventListener('click', exportExcel);
    }
    async function exportExcel() {
        try {
            const XLSX = await loadXlsxLib(), o = state.overview, wb = XLSX.utils.book_new();
            const head = t => [[t], [scopeLabel()], [`${dateText(o.period.start)} — ${dateText(o.period.end)}`], []];
            const pnl = [...head('Foyda va zarar (' + (o.pnl.basis === 'cash' ? 'kassa usuli' : 'hisoblash usuli') + ')'), ['Ko‘rsatkich', 'so‘m', 'Sof tushumga %'],
                ...o.pnl.lines.map(l => [l.label, l.amount, l.key === 'revenue' ? '' : F.pct(l.amount, o.pnl.net_revenue)]), [],
                ['Kapital xarajatlar', o.pnl.belowTheLine.capex], ['Ta’sischiga to‘langan', o.pnl.belowTheLine.ownerDrawings], ['Ta’sischi kiritgan', o.pnl.belowTheLine.ownerContributions]];
            const cf = o.cashflow;
            const cfRows = [...head('Pul oqimlari hisoboti (IAS 7)'), ['Modda', 'so‘m'], ['Operatsion faoliyat'], ...cf.operating.map(l => ['  ' + l.label, l.amount]), ['Operatsion faoliyatdan sof oqim', cf.net.operating],
                ['Investitsion faoliyat'], ...cf.investing.map(l => ['  ' + l.label, l.amount]), ['Investitsion faoliyatdan sof oqim', cf.net.investing],
                ['Moliyaviy faoliyat'], ...cf.financing.map(l => ['  ' + l.label, l.amount]), ['Moliyaviy faoliyatdan sof oqim', cf.net.financing], [],
                ['Sof o‘zgarish', cf.netChange], ['Davr boshidagi qoldiq', cf.openingCash], ['Kiritilgan boshlang‘ich qoldiq', cf.openingInjection], ['Davr oxiridagi qoldiq', cf.closingCash], ['Hisob qoldiqlari bilan mos', cf.reconciled ? 'Ha' : 'Yo‘q: ' + cf.difference]];
            const b = o.balance;
            const bs = [...head('Boshqaruv balansi ' + dateText(b.asOf)), ['Modda', 'so‘m'], ['Pul mablag‘lari', b.cash], ...b.accounts.filter(a => a.balance).map(a => ['  ' + a.name, a.balance]), ['Debitorlik', b.receivables], ['Aktivlar jami', b.assets], [],
                ['To‘lanmagan maosh', b.payables.salaries], ['Hisob-fakturalar', b.payables.bills + b.payables.other], ['Olingan qarzlar', b.loans], ['Kelgusi davr daromadi', b.deferredRevenue], ['Majburiyatlar jami', b.liabilities], [], ['Sof aktivlar', b.netAssets]];
            const monthly = [...head('Oylik taqqoslash'), ['Oy', 'Kurs to‘lovlari', 'Qaytarishlar', 'Sof tushum', 'Xizmat tannarxi', 'Yalpi foyda', 'Operatsion xarajatlar', 'EBITDA', 'Sof foyda'],
                ...o.monthly.map(r => [r.month, r.revenue, r.refunds, r.net_revenue, r.cost_of_services, r.gross_profit, r.opex, r.ebitda, r.net_profit])];
            const ar = [...head('Debitorlik'), ['O‘quvchi', 'Telefon', 'Yo‘nalish', 'Qarz', 'To‘lov sanasi', 'Kechikish (kun)'], ...o.receivables.rows.map(r => [r.name, r.phone, F.ENTITIES[r.entity], r.debt, r.dueDate, r.overdueDays])];
            const ap = [...head('Kreditorlik'), ['Turi', 'Kimga', 'Izoh', 'Hujjat sanasi', 'Muddat', 'Jami', 'To‘langan', 'Qoldiq'], ...o.payables.rows.map(r => [r.kind, r.counterparty, r.description, r.issueDate, r.dueDate, r.amount, r.paid, r.outstanding])];
            for (const [name, rows] of [['P&L', pnl], ['Cash Flow', cfRows], ['Balans', bs], ['Oylik', monthly], ['Debitorlik', ar], ['Kreditorlik', ap]]) {
                const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 52 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
                XLSX.utils.book_append_sheet(wb, ws, name);
            }
            XLSX.writeFile(wb, `Moliya_${scope()}_${o.period.start}_${o.period.end}.xlsx`);
        } catch (e) { toast('Excel faylni yaratib bo‘lmadi: ' + e.message); }
    }

    // ---------- Audit va solishtirish ----------
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
    function reconView() {
        const r = state.recon;
        if (!r) return '';
        if (r.parsed && !r.result) {
            const maxCols = Math.max(0, ...r.parsed.map(x => x.amounts.length));
            return `<section class="fin-card"><header><h3>2. Summa ustunini tanlang</h3><span class="fin-muted">${r.parsed.length} ta qator topildi · ${esc(r.fileName || 'matn')}</span></header>
                ${maxCols ? `<div class="fin-recon-cols">${Array.from({ length: maxCols }, (_, i) => `<label class="fin-radio"><input type="radio" name="finCol" value="${i}" ${r.column === i ? 'checked' : ''}> ${i + 1}-summa ustuni</label>`).join('')}
                    <label class="fin-radio"><input type="radio" name="finCol" value="-1" ${r.column === -1 ? 'checked' : ''}> Har qatordagi oxirgi summa</label></div>` : '<div class="fin-alert fin-alert--warning">Summalar topilmadi</div>'}
                ${table(['Sana', 'Ism', 'Telefon', ...Array.from({ length: maxCols }, (_, i) => ({ label: (i + 1) + '-summa', num: true }))],
                    r.parsed.slice(0, 8).map(x => `<tr><td>${dateText(x.date)}</td><td>${esc(x.name)}</td><td>${esc(x.phone)}</td>${Array.from({ length: maxCols }, (_, i) => `<td class="num ${i === (r.column === -1 ? x.amounts.length - 1 : r.column) ? 'fin-pick' : ''}">${x.amounts[i] != null ? num(x.amounts[i]) : ''}</td>`).join('')}</tr>`))}
                <div class="fin-actions"><label class="fin-field fin-field--inline"><span>Sana farqi (kun)</span><input type="number" min="0" max="10" value="${r.tolerance}" class="form-control" data-fin-recon-tol style="width:80px"></label>
                <button type="button" class="btn-primary-sm" data-fin-recon-run>Solishtirish</button></div></section>`;
        }
        const res = r.result, labels = { match: 'Mos', date_diff: 'Sana farqi', amount_diff: 'Summa farqi', missing_in_crm: 'CRM’da yo‘q', extra_in_crm: 'Ro‘yxatda yo‘q' };
        const tone = { match: 'ok', date_diff: 'warning', amount_diff: 'danger', missing_in_crm: 'danger', extra_in_crm: 'warning' };
        const filter = r.filter || 'problems';
        const rows = res.results.filter(x => filter === 'all' || (filter === 'problems' ? x.status !== 'match' : x.status === filter));
        return `<section class="fin-card"><header><h3>3. Natija: ${res.counts.match} mos, ${res.results.length - res.counts.match} farq</h3><span class="fin-muted">${dateText(res.start)} — ${dateText(res.end)}</span></header>
            <div class="fin-stats fin-stats--compact">${stat('Tashqi ro‘yxat jami', money(res.totalExternal))}${stat('CRM reyestri jami', money(res.totalLedger))}${stat('Farq (CRM − ro‘yxat)', money(res.difference), '', res.difference ? 'danger' : 'success')}
                ${Object.entries(res.counts).map(([k, v]) => `<button type="button" class="fin-chip ${filter === k ? 'active' : ''}" data-fin-recon-filter="${k}"><span class="fin-dot-badge fin-dot-badge--${tone[k]}"></span>${labels[k]}: ${v}</button>`).join('')}
                <button type="button" class="fin-chip ${filter === 'problems' ? 'active' : ''}" data-fin-recon-filter="problems">Faqat farqlar</button><button type="button" class="fin-chip ${filter === 'all' ? 'active' : ''}" data-fin-recon-filter="all">Hammasi</button></div>
            <div class="fin-evidence"><label class="fin-field"><span>Asos hujjat (tuzatishlar uchun majburiy)</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" data-fin-recon-evidence class="form-control"></label>
                <label class="fin-field fin-grow"><span>Tuzatish sababi</span><input type="text" class="form-control" data-fin-recon-reason value="${esc(r.reason || '')}" placeholder="Masalan: Sentyabr audit ro‘yxati (moliyachi tasdiqlagan)"></label>
                ${r.evidenceUrl ? `<span class="fin-badge fin-badge--ok">hujjat yuklangan</span>` : r.sourceFile && /\.pdf$/i.test(r.fileName) ? '<span class="fin-muted">Bo‘sh qoldirsangiz, yuklangan PDF asos sifatida biriktiriladi</span>' : ''}</div>
            ${table(['', 'Holat', 'Tashqi ro‘yxat', 'CRM reyestri', { label: 'Farq', num: true }, 'Taklif'],
                rows.map((x, i) => {
                    const id = res.results.indexOf(x), e = x.external, l = x.ledger, done = r.done?.[id];
                    const action = done ? `<span class="fin-badge fin-badge--ok">${esc(done)}</span>` : {
                        match: '', date_diff: `<button type="button" class="btn-ghost btn-sm" data-fin-fix="${id}">Sanani ${dateText(e.date)} ga tuzatish</button>`,
                        amount_diff: `<button type="button" class="btn-ghost btn-sm" data-fin-fix="${id}">Summani ${num(e.amount)} ga tuzatish</button>`,
                        missing_in_crm: `<button type="button" class="btn-ghost btn-sm" data-fin-fix="${id}">CRM’ga qo‘shish</button>`,
                        extra_in_crm: `<button type="button" class="btn-ghost btn-sm" data-fin-fix="${id}">Bekor qilish</button> <small class="fin-muted">yoki ro‘yxat to‘liq emas</small>`
                    }[x.status];
                    return `<tr><td>${x.status !== 'match' && !done ? `<input type="checkbox" data-fin-recon-pick="${id}" ${r.picked?.has(id) ? 'checked' : ''} aria-label="Tanlash">` : ''}</td>
                        <td><span class="fin-badge fin-badge--${tone[x.status]}">${labels[x.status]}</span>${x.phoneMismatch ? '<small>telefon boshqacha</small>' : ''}</td>
                        <td>${e ? `${dateText(e.date)} · <b>${num(e.amount)}</b><small>${esc(e.name)} ${esc(e.phone || '')}</small>` : '—'}</td>
                        <td>${l ? `${dateText(l.date)} · <b>${num(l.amount)}</b><small>${esc(l.name)} ${esc(l.phone || '')}${l.managerName ? ' · ' + esc(l.managerName) : ''}</small>` : '—'}</td>
                        <td class="num ${x.difference < 0 ? 'neg' : x.difference > 0 ? 'pos' : ''}">${x.difference ? acc(x.difference) : '0'}</td><td>${action}</td></tr>`;
                }), { empty: 'Farq topilmadi — ro‘yxat va CRM to‘liq mos' })}
            <div class="fin-actions"><button type="button" class="btn-primary-sm" data-fin-fix-picked ${r.picked?.size ? '' : 'disabled'}>Tanlanganlarni tuzatish (${r.picked?.size || 0})</button>
                <button type="button" class="btn-ghost" data-fin-recon-reset>Yangi solishtirish</button></div>
            <p class="fin-note">Har bir tuzatish o‘chirish emas: xato yozuv “bekor qilingan” deb belgilanadi, to‘g‘ri yozuv asos hujjat va sabab bilan qo‘shiladi. Ikkalasi ham audit jurnalida kim va qachon qilgani bilan saqlanadi. “Ro‘yxatda yo‘q” — ro‘yxat davri to‘liq bo‘lmasligi mumkin, shuning uchun bekor qilishdan oldin tekshiring.</p></section>`;
    }
    async function renderAudit(root) {
        const o = state.overview, q = o.quality;
        if (!state.auditRows) { try { state.auditRows = (await api('/audit?limit=60')).rows; } catch { state.auditRows = []; } }
        const lang = scope() === 'all' ? 'russian' : scope();
        root.innerHTML = `<div class="fin-wrap">${toolbar()}
            <section class="fin-card"><header><h3>Tashqi ro‘yxat bilan solishtirish</h3><span class="fin-muted">Audit fayli, bank ko‘chirmasi yoki moliyachi jadvali — ${esc(F.ENTITIES[lang])}</span></header>
                <div class="fin-recon-input">
                    <label class="fin-drop"><input type="file" accept=".pdf,.xlsx,.xls,.csv,.txt" data-fin-recon-file><span><b>1. Faylni tanlang</b> (PDF, Excel, CSV) yoki matnni pastga joylashtiring</span></label>
                    <textarea class="form-control" rows="4" data-fin-recon-text placeholder="PDF yoki Excel’dan nusxa olingan qatorlar: sana, ism, telefon, summa…"></textarea>
                    <div class="fin-actions"><button type="button" class="btn-ghost" data-fin-recon-parse>Matnni tahlil qilish</button>
                        ${scope() === 'all' ? '<span class="fin-muted">Konsolidatsiya rejimida rus tili reyestri bilan solishtiriladi. Boshqa yo‘nalish uchun yuqoridagi tildan tanlang.</span>' : ''}</div>
                </div></section>
            ${reconView()}
            <section class="fin-card"><header><h3>Shubhali tushumlar</h3><span class="fin-muted">${q.suspicious.length} ta · ${money(q.suspicious.reduce((n, r) => n + r.amount, 0))}</span></header>
                ${table(['', 'Sana', 'Ism / telefon', 'Menejer', { label: 'Summa', num: true }, 'Sabab'], q.suspicious.map(r => `<tr><td><input type="checkbox" data-fin-susp="${esc(r.id)}" aria-label="Tanlash"></td><td>${dateText(r.date)}</td><td>${esc(r.name)}<small>${esc(r.phone)}</small></td><td>${esc(r.managerName || '—')}</td><td class="num">${num(r.amount)}</td><td>${r.reasons.map(x => `<span class="fin-badge fin-badge--warning">${esc(x)}</span>`).join(' ')}</td></tr>`), { empty: 'Shubhali tushum yo‘q' })}
                ${q.suspicious.length ? '<div class="fin-actions"><button type="button" class="btn-primary-sm" data-fin-void-susp disabled>Tanlanganlarni bekor qilish</button><span class="fin-muted">Faqat test, dublikat yoki haqiqatda bo‘lmagan to‘lovlarni bekor qiling. Summasi xato bo‘lsa — yuqoridagi solishtirish orqali tuzating.</span></div>' : ''}</section>
            <div class="fin-grid">
                <section class="fin-card"><header><h3>To‘langan, lekin kassaga yozilmagan maoshlar</h3></header>
                    ${table(['Xodim', 'Davr', { label: 'Summa', num: true }, ''], q.paidSalaryWithoutCash.map(s => `<tr><td>${esc(s.employeeName)}</td><td>${dateText(s.periodStart)} — ${dateText(s.periodEnd)}</td><td class="num">${num(s.amount)}</td><td><button type="button" class="btn-ghost btn-sm" data-fin-salary="${esc(s.id)}">Kassadan chiqim</button></td></tr>`), { empty: 'Hammasi yozilgan' })}</section>
                <section class="fin-card"><header><h3>Ma’lumot sifati</h3></header>
                    <ul class="fin-list">
                        <li><span>Reyestrdagi faol tushumlar</span><strong>${q.total}</strong></li>
                        <li><span>Chek (isbot) biriktirilmagan</span><strong class="${q.withoutProof ? 'neg' : ''}">${q.withoutProof}</strong></li>
                        <li><span>To‘lov usuli noma’lum</span><strong class="${q.unknownMethod ? 'neg' : ''}">${q.unknownMethod}</strong></li>
                        <li><span>Eski ko‘chirilgan, tekshiruv kerak</span><strong>${q.legacyReview}</strong></li>
                        <li><span>Bekor qilingan</span><strong>${q.voided}</strong></li>
                    </ul></section>
            </div>
            <section class="fin-card"><header><h3>Bekor qilingan tushumlar</h3></header>
                ${table(['Tushum sanasi', 'Bekor qilingan', 'Ism', { label: 'Summa', num: true }, 'Sabab'], q.voidedList.map(r => `<tr class="fin-reversed"><td>${dateText(r.date)}</td><td>${dateText(r.voidDate)}</td><td>${esc(r.name)}<small>${esc(r.phone)}</small></td><td class="num">${num(r.amount)}</td><td>${esc(r.voidReason)}</td></tr>`), { empty: 'Yo‘q' })}</section>
            <section class="fin-card"><header><h3>Audit jurnali</h3><span class="fin-muted">kim, qachon, nima o‘zgartirdi</span></header>
                ${table(['Vaqt', 'Kim', 'Amal', 'Tafsilot'], (state.auditRows || []).map(a => `<tr><td>${new Date(a.created_at).toLocaleString('uz-UZ')}</td><td>${esc(a.actor_name)}</td><td>${esc(AUDIT_LABELS[a.action] || a.action)}</td><td><small>${esc(auditSummary(a))}</small></td></tr>`), { empty: 'Hali amal bajarilmagan' })}</section>
        </div>`;
        bindToolbar(root, () => render('solishtirish'));
        bindAudit(root, lang);
    }
    const AUDIT_LABELS = { 'transaction-create': 'Operatsiya kiritildi', 'transaction-reverse': 'Storno', 'payable-create': 'Hisob-faktura', 'payable-void': 'Hisob-faktura bekor qilindi',
        'salary-cash-out': 'Maosh kassadan to‘landi', 'receipt-void': 'Tushum bekor qilindi', 'receipt-manual': 'Tushum hujjat asosida kiritildi', 'account-create': 'Hisob ochildi', 'account-update': 'Hisob o‘zgartirildi',
        'account-check': 'Qoldiq tekshiruvi', 'period-lock': 'Oy yopildi', 'period-unlock': 'Oy qayta ochildi', 'settings-update': 'Sozlamalar' };
    function auditSummary(a) {
        const d = a.after_data || {};
        return [d.amount != null ? num(d.amount) + ' so‘m' : '', d.date || d.voidDate || '', d.reason || d.note || '', d.name || d.counterparty || '', d.type ? F.TYPES[d.type] || d.type : '', d.closedThrough ? 'gacha: ' + d.closedThrough : ''].filter(Boolean).join(' · ');
    }
    function bindAudit(root, lang) {
        const parse = async (text, fileName, file) => {
            const parsed = F.parseStatementText(text);
            if (!parsed.length) { toast('Sana bilan boshlanadigan to‘lov qatorlari topilmadi'); return; }
            state.recon = { parsed, fileName, sourceFile: file || null, column: 0, tolerance: 3, picked: new Set(), done: {}, lang };
            render('solishtirish');
        };
        root.querySelector('[data-fin-recon-file]')?.addEventListener('change', async e => {
            const file = e.target.files[0]; if (!file) return;
            try { await parse(await readStatementFile(file), file.name, file); } catch (err) { toast('Faylni o‘qib bo‘lmadi: ' + err.message); }
        });
        root.querySelector('[data-fin-recon-parse]')?.addEventListener('click', () => parse(root.querySelector('[data-fin-recon-text]').value, 'joylashtirilgan matn'));
        root.querySelectorAll('input[name="finCol"]').forEach(i => i.addEventListener('change', () => { state.recon.column = Number(i.value); render('solishtirish'); }));
        root.querySelector('[data-fin-recon-tol]')?.addEventListener('change', e => { state.recon.tolerance = Math.max(0, Math.min(10, Number(e.target.value) || 0)); });
        root.querySelector('[data-fin-recon-run]')?.addEventListener('click', async () => {
            const r = state.recon;
            const rows = r.parsed.map(x => ({ date: x.date, name: x.name, phone: x.phone, amount: r.column === -1 ? x.amounts.at(-1) : x.amounts[r.column] })).filter(x => x.amount);
            try { r.result = await api('/reconcile', { entity: r.lang, rows, tolerance: r.tolerance }); r.filter = 'problems'; render('solishtirish'); }
            catch (e) { toast(e.message); }
        });
        root.querySelectorAll('[data-fin-recon-filter]').forEach(b => b.addEventListener('click', () => { state.recon.filter = b.dataset.finReconFilter; render('solishtirish'); }));
        root.querySelectorAll('[data-fin-recon-pick]').forEach(c => c.addEventListener('change', () => {
            const id = Number(c.dataset.finReconPick); c.checked ? state.recon.picked.add(id) : state.recon.picked.delete(id);
            const btn = root.querySelector('[data-fin-fix-picked]'); btn.disabled = !state.recon.picked.size; btn.textContent = `Tanlanganlarni tuzatish (${state.recon.picked.size})`;
        }));
        root.querySelector('[data-fin-recon-reason]')?.addEventListener('input', e => { state.recon.reason = e.target.value; });
        root.querySelector('[data-fin-recon-reset]')?.addEventListener('click', () => { state.recon = null; render('solishtirish'); });
        const evidence = async () => {
            const r = state.recon, input = root.querySelector('[data-fin-recon-evidence]');
            if (input?.files?.[0]) r.evidenceUrl = await upload(input);
            if (!r.evidenceUrl && r.sourceFile && /\.pdf$/i.test(r.fileName)) r.evidenceUrl = (await apiUploadFile(r.sourceFile)).url;
            if (!r.evidenceUrl) throw new Error('Asos hujjatni (PDF yoki rasm) yuklang');
            if ((r.reason || '').trim().length < 5) throw new Error('Tuzatish sababini yozing');
            return r.evidenceUrl;
        };
        const fixOne = async (id, evidenceUrl) => {
            const r = state.recon, x = r.result.results[id], e = x.external, l = x.ledger, reason = r.reason.trim();
            if (x.status === 'extra_in_crm') { await api('/receipts/void', { recordIds: [l.id], reason, evidenceUrl }); return 'bekor qilindi'; }
            if (x.status === 'missing_in_crm') {
                await api('/receipts/manual', { requestKey: reqKey(), entity: r.lang, date: e.date, amount: e.amount, method: 'card', name: e.name, phone: e.phone, reason, evidenceUrl });
                return 'qo‘shildi';
            }
            await api('/receipts/manual', { requestKey: reqKey(), entity: r.lang, date: e.date, amount: e.amount, method: l.method === 'unknown' ? 'card' : l.method, form: l.form, reason, evidenceUrl, replacesId: l.id });
            return 'tuzatildi';
        };
        const runFixes = async ids => {
            if (state.busy) return;
            try {
                state.busy = true;
                const evidenceUrl = await evidence();
                if (!confirm(`${ids.length} ta yozuv tuzatiladi. Har biri audit jurnaliga yoziladi. Davom etasizmi?`)) return;
                for (const id of ids) {
                    try { state.recon.done[id] = await fixOne(id, evidenceUrl); state.recon.picked.delete(id); }
                    catch (err) { state.recon.done[id] = 'xato: ' + err.message; }
                }
                invalidate(); await loadOverview(true); toast('Tuzatishlar saqlandi');
            } catch (err) { toast(err.message); } finally { state.busy = false; render('solishtirish'); }
        };
        root.querySelectorAll('[data-fin-fix]').forEach(b => b.addEventListener('click', () => runFixes([Number(b.dataset.finFix)])));
        root.querySelector('[data-fin-fix-picked]')?.addEventListener('click', () => runFixes([...state.recon.picked]));
        const susp = () => [...root.querySelectorAll('[data-fin-susp]:checked')].map(c => c.dataset.finSusp);
        root.querySelectorAll('[data-fin-susp]').forEach(c => c.addEventListener('change', () => { root.querySelector('[data-fin-void-susp]').disabled = !susp().length; }));
        root.querySelector('[data-fin-void-susp]')?.addEventListener('click', () => {
            const ids = susp();
            openReasonModal(`${ids.length} ta tushumni bekor qilish`, 'Bekor qilish', async (reason, evidenceUrl) => { await api('/receipts/void', { recordIds: ids, reason, evidenceUrl }); }, { evidence: true, placeholder: 'Masalan: test yozuvi, haqiqiy to‘lov emas' });
        });
        root.querySelectorAll('[data-fin-salary]').forEach(b => b.addEventListener('click', () => openSalaryModal(b.dataset.finSalary)));
    }

    // ---------- Sozlamalar ----------
    function renderSettings(root) {
        const o = state.overview, s = o.settings;
        const lastClosed = o.closedThrough, nextMonth = lastClosed ? F.monthOf(F.addMonths(lastClosed + '-01', 1)) : F.monthOf(F.addMonths(F.today().slice(0, 7) + '-01', -1));
        const canClose = F.monthEnd(nextMonth) < F.today();
        root.innerHTML = `<div class="fin-wrap">
            <section class="fin-card"><header><h3>Hisob raqamlar</h3><button type="button" class="btn-primary-sm" data-fin-account-new>+ Hisob</button></header>
                ${table(['Nomi', 'Turi', 'Kimga tegishli', 'To‘lov usullari', { label: 'Boshlang‘ich qoldiq', num: true }, 'Sana', 'Holat', ''],
                    o.accountsList.map(a => `<tr><td><b>${esc(a.name)}</b></td><td>${esc(F.ACCOUNT_KINDS[a.kind])}</td><td>${esc(F.ENTITIES[a.entity])}</td><td>${(a.methods || []).map(m => `<span class="fin-badge fin-badge--muted">${esc(PaymentLedger.METHODS[m] || m)}</span>`).join(' ') || '—'}</td>
                        <td class="num">${num(a.openingBalance)}</td><td>${dateText(a.openingDate)}</td><td>${a.active ? 'faol' : '<span class="fin-muted">yopilgan</span>'}</td><td><button type="button" class="fin-link" data-fin-account-edit="${esc(a.id)}">Tahrirlash</button></td></tr>`))}
                <p class="fin-note">CRM’dagi har bir tushum to‘lov usuli bo‘yicha hisobga avtomatik tushadi (masalan, Click/Payme → Karta). Boshlang‘ich qoldiq — hisobni kuzatishni boshlagan kundagi haqiqiy summa. Uni kiritmaguncha qoldiq faqat CRM yozuvlaridan hisoblanadi.</p></section>
            <div class="fin-grid">
                <section class="fin-card"><header><h3>Oyni yopish</h3></header>
                    <p>${lastClosed ? `<b>${esc(lastClosed)}</b> oyigacha bo‘lgan davr yopilgan. Bu davrga yangi tushum, xarajat yoki tuzatish yozib bo‘lmaydi — raqamlar o‘zgarmaydi.` : 'Hali birorta oy yopilmagan.'}</p>
                    <div class="fin-actions">
                        <button type="button" class="btn-primary-sm" data-fin-lock="${nextMonth}" ${canClose ? '' : 'disabled'}>${esc(nextMonth)} oyini yopish</button>
                        ${lastClosed && o.user.canUnlock ? `<button type="button" class="btn-ghost" data-fin-unlock="${esc(lastClosed)}">${esc(lastClosed)} ni qayta ochish</button>` : ''}</div>
                    <p class="fin-note">Oyni yopishdan oldin: hisob qoldiqlarini haqiqiy qoldiq bilan solishtiring, audit ro‘yxatini solishtiring va barcha xarajatlarni kiriting. Qayta ochish faqat rahbar tomonidan, sabab bilan, va faqat oxirgi yopilgan oy uchun mumkin.</p>
                    ${o.locks.length ? table(['Oy', 'Kim yopdi', 'Izoh'], o.locks.slice().reverse().map(l => `<tr><td>${esc(l.month)}</td><td>${esc(l.locked_by_name)}</td><td>${esc(l.note)}</td></tr>`)) : ''}</section>
                <section class="fin-card"><header><h3>Hisob-kitob taxminlari</h3></header>
                    <form data-fin-settings class="fin-form">
                        <label class="fin-field"><span>Ingliz tili kursi davomiyligi (oy)</span><input type="number" min="1" max="24" class="form-control" name="english" value="${s.courseMonths.english}"></label>
                        <label class="fin-field"><span>Rus tili kursi davomiyligi (oy)</span><input type="number" min="1" max="24" class="form-control" name="russian" value="${s.courseMonths.russian}"></label>
                        <label class="fin-field"><span>Shubhali deb belgilanadigan summa chegarasi (so‘m)</span><input type="number" min="0" class="form-control" name="suspiciousMin" value="${s.suspiciousMin}"></label>
                        <button type="submit" class="btn-primary-sm">Saqlash</button>
                    </form>
                    <p class="fin-note">Kurs davomiyligi faqat “hisoblash usuli”dagi tushumni taqsimlash va kelgusi davr daromadini hisoblash uchun ishlatiladi. Kassa usuli raqamlariga ta’sir qilmaydi.</p></section>
            </div>
            <section class="fin-card"><header><h3>Hisoblar rejasi (toifalar)</h3><span class="fin-muted">qaysi toifa qaysi hisobotga tushadi</span></header>
                ${table(['Kod', 'Toifa', 'Pul oqimi bo‘limi (IAS 7)', 'Foyda-zarar qatori'], F.CATEGORIES.map(c => `<tr><td><code>${c.code}</code></td><td>${esc(c.name)}</td><td>${{ operating: 'Operatsion', investing: 'Investitsion', financing: 'Moliyaviy' }[c.cf] || '— (ichki o‘tkazma)'}</td><td>${c.pnl ? esc((F.PNL_LINES.find(l => l[0] === c.pnl) || [0, c.pnl])[1]) : '— (P&L’ga kirmaydi)'}</td></tr>`))}</section>
        </div>`;
        root.querySelector('[data-fin-account-new]').addEventListener('click', () => openAccountModal());
        root.querySelectorAll('[data-fin-account-edit]').forEach(b => b.addEventListener('click', () => openAccountModal(o.accountsList.find(a => a.id === b.dataset.finAccountEdit))));
        root.querySelector('[data-fin-lock]')?.addEventListener('click', e => openReasonModal(`${e.target.dataset.finLock} oyini yopish`, 'Oyni yopish', async note => { await api('/periods', { month: e.target.dataset.finLock, note }); }, { optional: true, placeholder: 'Izoh: masalan, qoldiqlar bank bilan solishtirildi' }));
        root.querySelector('[data-fin-unlock]')?.addEventListener('click', e => openReasonModal(`${e.target.dataset.finUnlock} oyini qayta ochish`, 'Qayta ochish', async note => { await api('/periods', { month: e.target.dataset.finUnlock, locked: false, note }); }));
        root.querySelector('[data-fin-settings]').addEventListener('submit', async e => {
            e.preventDefault();
            const f = new FormData(e.target);
            try { await api('/settings', { revision: o.settingsRevision, data: { courseMonths: { english: Number(f.get('english')), russian: Number(f.get('russian')) }, suspiciousMin: Number(f.get('suspiciousMin')) } }, 'PUT'); invalidate(); toast('Sozlamalar saqlandi'); render('moliya-sozlamalar'); }
            catch (err) { toast(err.message); }
        });
    }

    // ---------- Modallar ----------
    function field(label, html, hint) { return `<label class="fin-field"><span>${label}</span>${html}${hint ? `<small>${hint}</small>` : ''}</label>`; }
    function submitModal(onSubmit) {
        const footer = document.getElementById('modalFooter'), body = document.getElementById('modalBody');
        const btn = footer.querySelector('[data-fin-submit]'), err = body.querySelector('[data-fin-error]');
        btn.addEventListener('click', async () => {
            if (btn.disabled) return;
            btn.disabled = true; err.textContent = '';
            try { await onSubmit(body); closeModal(); invalidate(); toast('Saqlandi'); render(currentSection()); }
            catch (e) { err.textContent = e.message; btn.disabled = false; }
        });
        footer.querySelector('[data-fin-cancel]')?.addEventListener('click', closeModal);
    }
    const footerButtons = label => `<button type="button" class="btn-ghost" data-fin-cancel>Bekor</button><button type="button" class="btn-primary-sm" data-fin-submit>${label}</button>`;
    async function openTxnModal(preset = {}) {
        const o = state.overview || await loadOverview(true);
        const type = preset.type || 'expense';
        const accounts = o.accountsList.filter(a => a.active && a.kind !== 'suspense');
        const ent = preset.entity || (scope() === 'all' ? 'common' : scope());
        const cats = t => F.CATEGORIES.filter(c => c.type === (t === 'expense' ? 'expense' : t));
        const loans = (o.payables.rows || []).filter(p => p.kind === 'loan');
        let receipts = [];
        if (type === 'refund') {
            try { const lang = ent === 'common' ? 'russian' : ent; receipts = (await apiFetch('/api/inflow?language=' + lang)).records.slice(0, 300); } catch { receipts = []; }
        }
        const accountOpts = sel => accounts.map(a => `<option value="${esc(a.id)}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
        const body = `<div class="fin-form" data-fin-txn>
            ${field('Operatsiya turi', `<select class="form-control" name="type">${Object.entries(F.TYPES).map(([k, l]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
            <div class="fin-form-row">${field('Sana', `<input type="date" lang="en-GB" class="form-control" name="date" value="${F.today()}" max="${F.today()}">`)}
                ${field('Summa (so‘m)', `<input type="text" inputmode="numeric" class="form-control" name="amount" value="${preset.amount ? num(preset.amount) : ''}" placeholder="0">`)}</div>
            ${type === 'refund' ? field('Qaysi tushum qaytarilmoqda', `<select class="form-control" name="paymentRecordId"><option value="">— tushumni tanlang —</option>${receipts.map(r => `<option value="${esc(r.id)}">${dateText(r.paidDate)} · ${esc(r.name)} · ${num(r.amount)}</option>`).join('')}</select>`, 'Qaytarish tanlangan tushum summasidan oshmaydi') : ''}
            ${type === 'loan_repay' ? field('Qaysi qarz', `<select class="form-control" name="payableId">${loans.map(p => `<option value="${esc(p.id)}" ${p.id === preset.payableId ? 'selected' : ''}>${esc(p.counterparty)} · qoldiq ${num(p.outstanding)}</option>`).join('')}</select>`) : ''}
            ${type !== 'refund' ? field('Yo‘nalish', `<select class="form-control" name="entity">${Object.entries(F.ENTITIES).map(([k, l]) => `<option value="${k}" ${k === ent ? 'selected' : ''}>${l}</option>`).join('')}</select>`, 'Ikkala maktabga tegishli xarajat (ijara, CRM) — “Umumiy”') : ''}
            ${field('Toifa', `<select class="form-control" name="categoryCode">${cats(type).map(c => `<option value="${c.code}" ${c.code === preset.categoryCode ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`)}
            <div class="fin-form-row">${field(type === 'transfer' ? 'Qaysi hisobdan' : ['income', 'capital', 'loan_in'].includes(type) ? 'Qaysi hisobga tushdi' : 'Qaysi hisobdan to‘landi', `<select class="form-control" name="accountId">${accountOpts(type === 'transfer' ? 'acc-card' : 'acc-card')}</select>`)}
                ${type === 'transfer' ? field('Qaysi hisobga', `<select class="form-control" name="toAccountId">${accountOpts('acc-cash')}</select>`) : ''}</div>
            ${type !== 'transfer' ? field(['income', 'capital', 'loan_in'].includes(type) ? 'Kimdan' : 'Kimga', `<input type="text" class="form-control" name="counterparty" value="${esc(preset.counterparty || '')}" maxlength="200" placeholder="${type === 'expense' ? 'Masalan: Meta Ads, ijara egasi' : ''}">`) : ''}
            ${type === 'loan_in' ? field('Qaytarish muddati', `<input type="date" lang="en-GB" class="form-control" name="dueDate">`) : ''}
            ${field('Izoh', `<textarea class="form-control" name="description" rows="2" maxlength="1000">${esc(preset.description || '')}</textarea>`)}
            ${type !== 'transfer' ? field('Chek / hujjat', `<input type="file" class="form-control" name="receipt" accept=".pdf,.png,.jpg,.jpeg,.webp">`, '1 000 000 so‘mdan katta chiqim uchun majburiy') : ''}
            ${preset.payableId && type === 'expense' ? `<p class="fin-note">Bu to‘lov “${esc(preset.counterparty)}” hisob-fakturasini yopadi.</p>` : ''}
            <p class="fin-error" data-fin-error role="alert"></p></div>`;
        openModal(F.TYPES[type], body, footerButtons('Saqlash'));
        const root = document.querySelector('[data-fin-txn]');
        const amount = root.querySelector('[name="amount"]');
        amount.addEventListener('input', () => { const d = amount.value.replace(/\D/g, ''); amount.value = d ? num(d) : ''; });
        root.querySelector('[name="type"]').addEventListener('change', e => { closeModal(); openTxnModal({ ...preset, type: e.target.value }); });
        const key = reqKey();
        submitModal(async b => {
            const v = n => b.querySelector(`[name="${n}"]`)?.value || '';
            const receiptUrl = await upload(b.querySelector('[name="receipt"]'));
            await api('/transactions', { requestKey: key, type, date: v('date'), amount: v('amount').replace(/\D/g, ''), entity: v('entity') || ent, categoryCode: v('categoryCode'),
                accountId: v('accountId'), toAccountId: v('toAccountId'), counterparty: v('counterparty'), description: v('description'), receiptUrl,
                paymentRecordId: v('paymentRecordId'), payableId: v('payableId') || preset.payableId || '', dueDate: v('dueDate') });
        });
    }
    function openPayableModal() {
        const ent = scope() === 'all' ? 'common' : scope();
        openModal('Hisob-faktura (korxona qarzi)', `<div class="fin-form">
            ${field('Kimga qarzmiz', '<input type="text" class="form-control" name="counterparty" maxlength="200" placeholder="Masalan: ijara egasi, reklama agentligi">')}
            <div class="fin-form-row">${field('Summa (so‘m)', '<input type="text" inputmode="numeric" class="form-control" name="amount">')}
            ${field('Yo‘nalish', `<select class="form-control" name="entity">${Object.entries(F.ENTITIES).map(([k, l]) => `<option value="${k}" ${k === ent ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
            ${field('Toifa', `<select class="form-control" name="categoryCode">${F.CATEGORIES.filter(c => c.type === 'expense').map(c => `<option value="${c.code}">${esc(c.name)}</option>`).join('')}</select>`)}
            <div class="fin-form-row">${field('Hujjat sanasi', `<input type="date" lang="en-GB" class="form-control" name="issueDate" value="${F.today()}">`)}${field('To‘lov muddati', '<input type="date" lang="en-GB" class="form-control" name="dueDate">')}</div>
            ${field('Izoh', '<textarea class="form-control" name="description" rows="2"></textarea>')}
            ${field('Hujjat (hisob-faktura, shartnoma)', '<input type="file" class="form-control" name="document" accept=".pdf,.png,.jpg,.jpeg,.webp">')}
            <p class="fin-note">Hisob-faktura kiritilganda xarajat hisoblash usulidagi foyda-zararga hujjat sanasida tushadi; pul to‘langanda — kassa usuliga.</p>
            <p class="fin-error" data-fin-error role="alert"></p></div>`, footerButtons('Saqlash'));
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
            { date: true, note: 'Asl yozuv o‘chirilmaydi: teskari (storno) yozuv qo‘shiladi. Agar asl sana yopilgan oyda bo‘lsa, storno bugungi sana bilan yoziladi.' });
    }
    function openReasonModal(title, action, onSubmit, opts = {}) {
        openModal(title, `<div class="fin-form">
            ${field(opts.optional ? 'Izoh (ixtiyoriy)' : 'Sabab', `<textarea class="form-control" name="reason" rows="3" maxlength="500" placeholder="${esc(opts.placeholder || '')}"></textarea>`)}
            ${opts.date ? field('Storno sanasi (ixtiyoriy)', `<input type="date" lang="en-GB" class="form-control" name="date" max="${F.today()}">`) : ''}
            ${opts.evidence ? field('Asos hujjat (ixtiyoriy)', '<input type="file" class="form-control" name="evidence" accept=".pdf,.png,.jpg,.jpeg,.webp">') : ''}
            ${opts.note ? `<p class="fin-note">${opts.note}</p>` : ''}<p class="fin-error" data-fin-error role="alert"></p></div>`, footerButtons(action));
        submitModal(async b => {
            const reason = b.querySelector('[name="reason"]').value.trim();
            if (!opts.optional && reason.length < 5) throw new Error('Sababni batafsilroq yozing (kamida 5 belgi)');
            await onSubmit(reason, opts.evidence ? await upload(b.querySelector('[name="evidence"]')) : '', b.querySelector('[name="date"]')?.value || '');
        });
    }
    function openSalaryModal(id) {
        const s = state.overview.quality.paidSalaryWithoutCash.find(x => x.id === id);
        const accounts = state.overview.accountsList.filter(a => a.active && a.kind !== 'suspense');
        openModal('Maoshni kassadan chiqim qilish', `<div class="fin-form"><p><b>${esc(s.employeeName)}</b> · ${dateText(s.periodStart)} — ${dateText(s.periodEnd)} · <b>${money(s.amount)}</b></p>
            ${field('To‘langan sana', `<input type="date" lang="en-GB" class="form-control" name="date" value="${s.paidAt ? String(s.paidAt).slice(0, 10) : F.today()}" max="${F.today()}">`)}
            ${field('Qaysi hisobdan', `<select class="form-control" name="accountId">${accounts.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select>`)}
            <p class="fin-error" data-fin-error role="alert"></p></div>`, footerButtons('Saqlash'));
        submitModal(async b => { await api('/salaries/' + encodeURIComponent(id) + '/cash-out', { date: b.querySelector('[name="date"]').value, accountId: b.querySelector('[name="accountId"]').value }); });
    }
    function openCheckModal(accountId) {
        const a = state.overview.accounts.find(x => x.id === accountId);
        openModal('Haqiqiy qoldiqni kiritish', `<div class="fin-form"><p><b>${esc(a.name)}</b> — kitobdagi qoldiq: <b>${money(a.balance)}</b></p>
            <div class="fin-form-row">${field('Sana', `<input type="date" lang="en-GB" class="form-control" name="date" value="${F.today()}" max="${F.today()}">`)}
            ${field('Haqiqiy qoldiq (so‘m)', '<input type="text" inputmode="numeric" class="form-control" name="actual">', 'Bank ilovasi, terminal yoki kassadagi aniq summa')}</div>
            ${field('Izoh', '<input type="text" class="form-control" name="note" maxlength="500">')}
            <p class="fin-note">Farq chiqsa — demak kiritilmagan xarajat, tushum yoki xato bor. Farqni sababini topib, operatsiya kiriting; qoldiqni “to‘g‘rilash” uchun soxta yozuv qilinmaydi.</p>
            <p class="fin-error" data-fin-error role="alert"></p></div>`, footerButtons('Saqlash'));
        submitModal(async b => {
            const raw = b.querySelector('[name="actual"]').value.trim(), neg = raw.startsWith('-');
            await api('/accounts/' + encodeURIComponent(accountId) + '/checks', { date: b.querySelector('[name="date"]').value, actualBalance: (neg ? -1 : 1) * Number(raw.replace(/\D/g, '') || 'x'), note: b.querySelector('[name="note"]').value });
        });
    }
    function openAccountModal(a) {
        const methods = Object.entries(PaymentLedger.METHODS).filter(([k]) => k !== 'unknown');
        openModal(a ? 'Hisobni tahrirlash' : 'Yangi hisob', `<div class="fin-form">
            ${field('Nomi', `<input type="text" class="form-control" name="name" value="${esc(a?.name || '')}" maxlength="120">`)}
            <div class="fin-form-row">${field('Turi', `<select class="form-control" name="kind">${Object.entries(F.ACCOUNT_KINDS).map(([k, l]) => `<option value="${k}" ${a?.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
            ${field('Kimga tegishli', `<select class="form-control" name="entity">${Object.entries(F.ENTITIES).map(([k, l]) => `<option value="${k}" ${(a?.entity || 'common') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
            <fieldset class="fin-methods"><legend>Qaysi to‘lov usullari shu hisobga tushadi</legend>${methods.map(([k, l]) => `<label><input type="checkbox" name="methods" value="${k}" ${(a?.methods || []).includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</fieldset>
            <div class="fin-form-row">${field('Boshlang‘ich qoldiq (so‘m)', `<input type="text" inputmode="numeric" class="form-control" name="openingBalance" value="${a?.openingBalance ? num(a.openingBalance) : ''}">`)}
            ${field('Qoldiq sanasi', `<input type="date" lang="en-GB" class="form-control" name="openingDate" value="${a?.openingDate || ''}">`, 'Shu kundan boshlab harakatlar qoldiqqa qo‘shiladi')}</div>
            ${a ? `<label class="fin-switch"><input type="checkbox" name="active" ${a.active ? 'checked' : ''}><span>Faol</span></label>` : ''}
            <p class="fin-error" data-fin-error role="alert"></p></div>`, footerButtons('Saqlash'));
        submitModal(async b => {
            const v = n => b.querySelector(`[name="${n}"]`)?.value || '';
            await api('/accounts', { id: a?.id, name: v('name'), kind: v('kind'), entity: v('entity'), methods: [...b.querySelectorAll('[name="methods"]:checked')].map(c => c.value),
                openingBalance: v('openingBalance').replace(/\D/g, '') || 0, openingDate: v('openingDate'), active: a ? b.querySelector('[name="active"]').checked : true });
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
    window.financeUI = { render, handles: s => SECTIONS.includes(s), onLangChange, invalidate, _state: state };
})();
