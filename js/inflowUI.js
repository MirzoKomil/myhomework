(function () {
    'use strict';
    const L = PaymentLedger, state = { rows: { english: [], russian: [] }, decisions: [], loaded: false, seq: 0, timer: null, issueLists: { english: [], russian: [] }, unscoped: 0 };
    const esc = value => escapeHtml(String(value ?? ''));
    const money = value => (typeof formatMoney === 'function' ? formatMoney(value) : Number(value || 0).toLocaleString('en-US').replaceAll(',', ' ') + " so'm");
    const opts = (items, all) => `<option value="">${all}</option>` + items.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join('');
    const dateText = value => L.displayDate(value);
    function monthDates(month) {
        if (!/^\d{4}-\d{2}$/.test(month)) return null;
        const [y, m] = month.split('-').map(Number);
        return { start: month + '-01', end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
    }
    function filters(root) {
        return Object.fromEntries(['start', 'end', 'search', 'manager', 'teacher', 'tariff', 'method', 'form', 'sort', 'review'].map(k => [k, root.querySelector(`[data-inflow="${k}"]`)?.value || '']));
    }
    function rows(root) {
        const f = filters(root);
        return L.filter(state.rows[_financeLang], f).sort((a, b) => f.sort === 'amount-up' ? a.amount - b.amount : f.sort === 'amount-down' ? b.amount - a.amount
            : f.sort === 'date-up' ? a.paidDate.localeCompare(b.paidDate) || a.paidTime.localeCompare(b.paidTime) : b.paidDate.localeCompare(a.paidDate) || b.paidTime.localeCompare(a.paidTime));
    }
    function draw(root) {
        const f = filters(root), invalid = L.rangeError(f), content = root.querySelector('[data-inflow-content]');
        const alert = root.querySelector('[data-inflow-validation]'); alert.textContent = invalid; alert.hidden = !invalid;
        root.querySelector('[data-inflow-export]').disabled = !!invalid || !state.loaded;
        root.querySelectorAll('[data-inflow="start"],[data-inflow="end"]').forEach(e => e.setAttribute('aria-invalid', String(!!invalid)));
        if (invalid) { root.querySelector('[data-inflow-kpis]').innerHTML = ''; root.querySelector('[data-inflow-issues]').innerHTML=''; content.innerHTML = '<p class="inflow-empty">Hisobni ko‘rish uchun sana oralig‘ini to‘g‘rilang.</p>'; return; }
        const list = rows(root), summary = L.summary(list);
        loadPeriodDebt(root);
        // Faol filtrlar soni (davr ham — doim tanlangan): "Filtrlar (n)".
        const nf = ['manager','teacher','tariff','method','form','review'].filter(k=>f[k]).length + (f.start && f.end ? 1 : 0);
        root.querySelector('[data-inflow-filter-count]').textContent = nf ? '(' + nf + ')' : '';
        const n0 = v => v == null || v === '' ? '—' : Number(v).toLocaleString('en-US').replaceAll(',', ' ');
        // Moliya xodimi: davr sotuvlaridan qolgan qarz (Umumiy bilan bir xil). Ruxsat bo'lmasa — ro'yxatdagi o'quvchilar qarzi, nomi aniq.
        const debtLabel = debtState.failed ? 'Ro‘yxatdagi o‘quvchilar qarzi' : 'Kutilayotgan qoldiq qarz', debtValue = debtState.failed ? summary.debt : debtState.value;
        root.querySelector('[data-inflow-sumline]').innerHTML = `Jami tushum (fakt) <b class="pos">${n0(summary.amount)}</b> · ${summary.count} ta · qoldiq qarz ${debtValue == null ? '…' : n0(debtValue)}`;
        root.querySelector('[data-inflow-kpis]').innerHTML = [['Jami tushum (fakt)', n0(summary.amount)], ['To‘lovlar soni', summary.count], [debtLabel, debtValue == null ? '…' : n0(debtValue)]]
            .map(([label, v]) => `<div class="inflow-stat"><span>${label}</span><strong>${v}</strong></div>`).join('');
        root.querySelector('[data-inflow-note]').textContent = 'Qoldiq qarz har bir o‘quvchi bo‘yicha bir marta sanaladi. Eski asl yozuvlar o‘zgartirilmaydi.';
        const issues = L.filterIssues(state.issueLists[_financeLang], _financeLang, f);
        const missing = list.filter(r => !r.managerId), legacy = list.filter(r => r.legacyReview);
        root.querySelector('[data-inflow-issues]').innerHTML = issues.length || missing.length || legacy.length || state.unscoped ? `<details class="inflow-review-box"><summary>Tekshirish: ${new Set([...legacy,...missing].map(r=>r.id)).size} ta tushum · ${issues.length} ta manba</summary>
            <p>Bu ro‘yxat tanlangan til va davrga mos. Sanasi noma’lum manbalar alohida belgilangan. Chek, usul yoki menejer taxmin bilan kiritilmaydi.</p>
            ${missing.length ? `<p class="inflow-review">Menejerga bog‘lanmagan: ${money(L.summary(missing).amount)}. Bu tushumlar kassada bor, lekin menejer KPI’siga taqsimlanmagan. Asl yozuvlarni o‘zgartirmasdan moliya aniqlashtirishi kerak.</p>` : ''}
            ${legacy.length ? '<p>Eski cheki/usuli yetishmayotgan tushumlarni «Qo‘shimcha filtrlar → Tekshirish» orqali ajrating.</p>' : ''}
            <ul>${issues.slice(0,100).map(r => `<li><strong>${esc(r.name || 'Nomi aniqlanmagan')}</strong> ${esc(r.phone)} · ${r.date ? dateText(r.date)+' (manba sanasi, tushum tasdiqlanmagan)' : 'Sana aniqlanmagan'} — ${esc(r.reason)}<small>${esc(r.source_key)}</small></li>`).join('')}</ul>
            ${issues.length>100 ? `<p>${issues.length} ta manbadan birinchi 100 tasi ko‘rsatildi.</p>` : ''}${state.unscoped ? `<p>Tilini aniqlab bo‘lmagan ${state.unscoped} ta manba bor; ular tilga taxmin bilan qo‘shilmadi.</p>` : ''}</details>` : '';
        const phoneText = p => esc(typeof formatPhoneDisplay === 'function' ? (formatPhoneDisplay(p) || p) : p);
        // Jadval (K_tolovlar): Sana/vaqt · O'quvchi · Telefon · Tarif · Summa · To'lov usuli · Qoldiq qarz · Menejer·ustoz · Chek · Holat.
        const kindChip = r => r.saleKind ? ` <span class="fin-dchip ${r.saleKind === 'new' ? 'fin-dchip--ok' : 'fin-dchip--muted'}">${r.saleKind === 'new' ? 'Yangi' : 'Qarzdor'}</span>` : '';
        const clip = r => r.receiptUrl ? `<a class="ifd-clip" href="${esc(r.receiptUrl)}" target="_blank" rel="noopener" title="Chekni ko‘rish" aria-label="Chekni ko‘rish"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m21 12-8.5 8.5a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8L15 7"/></svg></a>` : '<span class="ifd-clip is-none" title="Chek yo‘q">—</span>';
        const holat = r => r.legacyReview ? '<span class="ifx-badge ifx-badge--warn">Tekshirish kerak</span>' : r.form === 'full' ? '<span class="ifx-badge ifx-badge--ok">To‘liq</span>' : '<span class="ifx-badge ifx-badge--warn">Yarim (Zaklad)</span>';
        // Ustoz: yozuvdagi nom, bo'lmasa CRM'dagi ustoz/xodim ro'yxatidan (teacherId bo'yicha).
        const people = new Map([...(getItem(STORAGE_KEYS.teachers, []) || []), ...(getItem(STORAGE_KEYS.hrEmployees, []) || [])].map(x => [x.id, x.name]));
        const teacherOf = r => r.teacherName || (r.teacherId && people.get(r.teacherId)) || '';
        const who = r => `${esc(r.managerName || 'Biriktirilmagan')} · ${esc(teacherOf(r) || 'biriktirilmagan')}`;
        const nameBtn = r => r.studentId ? `<button type="button" class="ifd-name" data-inflow-hist="${esc(r.studentId)}">${esc(r.name)}</button>` : `<b>${esc(r.name)}</b>`;
        const tr = list.map(r => `<tr><td class="ifd-nowrap">${dateText(r.paidDate)} · ${esc(r.paidTime || '—')}</td><td>${nameBtn(r)}${kindChip(r)}</td><td>${phoneText(r.phone)}</td><td>${esc(L.TARIFFS[r.tariff] || '—')}</td>
            <td class="ifx-num">${n0(r.amount)}</td><td>${esc(r.method === 'unknown' ? 'Noma’lum' : L.METHODS[r.method] || '—')}</td><td class="ifx-num">${n0(r.debt)}</td><td class="ifd-who" title="${who(r)}">${who(r)}</td><td>${clip(r)}</td><td>${holat(r)}</td></tr>`).join('');
        const headings = ['Sana / vaqt', 'O‘quvchi', 'Telefon', 'Tarif', 'Summa', 'To‘lov usuli', 'Qoldiq qarz', 'Menejer · ustoz', 'Chek', 'Holat'];
        const sortCols = { 0: 'date', 4: 'amount' };
        const sortable = (label, key) => `<button type="button" data-inflow-sort="${key}" title="${label} bo‘yicha saralash">${label} <span aria-hidden="true">${f.sort.startsWith(key+'-') ? f.sort.endsWith('up') ? '↑' : '↓' : '↕'}</span></button>`;
        content.innerHTML = `<div class="inflow-table-wrap ifd-table"><table class="inflow-table ifx-table"><thead><tr>${headings.map((h, i) => `<th${i === 4 || i === 6 ? ' class="ifx-num"' : ''}${sortCols[i] ? ` aria-sort="${f.sort.startsWith(sortCols[i]+'-') ? f.sort.endsWith('up') ? 'ascending' : 'descending' : 'none'}"` : ''}>${sortCols[i] ? sortable(h, sortCols[i]) : h}</th>`).join('')}</tr></thead>
            <tbody>${tr || '<tr><td colspan="10">Tanlangan filtrlar bo‘yicha to‘lov yo‘q</td></tr>'}</tbody><tfoot><tr><td colspan="4">Jami: ${summary.count} ta</td><td class="ifx-num">${n0(summary.amount)}</td><td></td><td class="ifx-num">${debtValue == null ? '…' : n0(debtValue)}</td><td colspan="3">${esc(debtLabel)}</td></tr></tfoot></table></div>
            <div class="inflow-mobile ifd-cards">${list.map(r => `<article class="ifd-card"><span class="ifd-card-l"><span class="ifd-card-n">${nameBtn(r)}</span><small class="ifd-1l">${kindChip(r)} ${dateText(r.paidDate).slice(0, 5)} · ${who(r)}</small></span><span class="ifd-card-r"><b>${n0(r.amount)}</b><small>qoldiq ${n0(r.debt)}</small></span>${clip(r)}</article>`).join('') || '<p class="inflow-empty">To‘lov yo‘q</p>'}</div>`;
        content.querySelectorAll('[data-inflow-sort]').forEach(button => button.onclick = () => {
            root.querySelector('[data-inflow="sort"]').value = button.dataset.inflowSort + (f.sort === button.dataset.inflowSort+'-down' ? '-up' : '-down'); draw(root);
        });
        content.querySelectorAll('[data-inflow-hist]').forEach(b => b.onclick = () => openHistory(b.dataset.inflowHist, b.textContent));
    }
    // O'quvchi to'lov tarixi: Sana · Tushum · Usul · Chek · O'sha paytdagi qarz (renderHistory).
    function openHistory(id, name) {
        openModal(String(name || '') + ' — to‘lov tarixi', `<div data-inflow-history="${esc(id)}">Yuklanmoqda…</div>`, '<button type="button" class="btn-secondary-sm" onclick="closeModal()">Yopish</button>', { wide: true });
        const el = document.querySelector('#modalBody [data-inflow-history]'); el.dataset.inflowHistory = id; renderHistory(el, id);
    }
    function fillPeople(root) {
        for (const kind of ['manager', 'teacher']) {
            const el = root.querySelector(`[data-inflow="${kind}"]`), selected = el.value;
            const values = new Map(state.rows[_financeLang].filter(r => r[kind + 'Id']).map(r => [r[kind + 'Id'], r[kind + 'Name'] || r[kind + 'Id']]));
            if (kind === 'manager' && state.rows[_financeLang].some(r=>!r.managerId)) values.set('__unassigned','Menejer biriktirilmagan');
            el.innerHTML = opts([...values].sort((a, b) => a[1].localeCompare(b[1])), kind === 'manager' ? 'Barcha menejerlar' : 'Barcha ustozlar');
            if (values.has(selected)) el.value = selected;
        }
    }
    async function refresh(root) {
        ensureTimer();
        const seq = ++state.seq;
        const msg = root?.querySelector('[data-inflow-message]') || document.querySelector('[data-inflow-cash-message]');
        if (msg) msg.textContent = 'Serverdan yuklanmoqda…';
        try {
            const results = await Promise.all([...['english', 'russian'].map(language => apiFetch('/api/inflow?language=' + language)), apiFetch('/api/inflow/cash-reconciliation')]);
            if (seq !== state.seq) return;
            state.rows = { english: results[0].records, russian: results[1].records }; state.loaded = true;
            state.issueLists = { english: results[0].migrationIssues || [], russian: results[1].migrationIssues || [] }; state.unscoped = results[0].unscopedIssueCount || 0;
            state.decisions = results[2].decisions;
            setCachedItem(STORAGE_KEYS.cashFlow, results[2].manual);
            if (root) { fillPeople(root); draw(root); }
            if (msg) msg.textContent = '';
            renderReconciliation();
            if (document.querySelector('[data-finance-panel="cashflow"].active')) renderCashFlow();
        } catch (e) { if (seq === state.seq && msg) msg.textContent = 'Yuklashda xatolik: ' + e.message; }
    }
    function mount(root) {
        if (root.dataset.inflowMounted) return;
        root.dataset.inflowMounted = '1';
        const month = L.today().slice(0, 7), period = monthDates(month);
        // D dizayn (K_/T_tolovlar): amallar qatori, bitta qatorda qidiruv + Filtrlar + saralash; filtrlar — ochiluvchi oyna (telefonda pastki varaq).
        root.innerHTML = `<div class="ifd-period" data-inflow-periodrow></div><div class="inflow-toolbar ifd-actions"><button type="button" class="fin-qbtn fin-qbtn--pri" data-inflow-receive><span>+ Reyestrga to‘lov<span class="ifd-full"> qabul qilish</span></span></button>
                <span class="ifd-desk"><button type="button" class="fin-qbtn" data-inflow-recon>Solishtirish</button><button type="button" class="fin-qbtn" data-inflow-export aria-label="Excelga yuklash (.xlsx)">⤓ Excelga yuklash (.xlsx)</button><button type="button" class="fin-qbtn" data-inflow-refresh>↻ Yangilash</button></span>
                <button type="button" class="fin-qbtn ifd-phone" data-inflow-more aria-haspopup="dialog" aria-label="Amallar">⋯</button></div>
            <div class="ifd-search"><label class="inflow-search"><span class="sr-only">Ism yoki telefon</span><input type="search" class="form-control" aria-label="Ism yoki telefon" data-inflow="search" placeholder="Ism yoki telefon raqami" autocomplete="off" data-lpignore="true" data-1p-ignore="true"></label>
                <button type="button" class="fin-qbtn" data-inflow-filters aria-haspopup="dialog"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h18l-7 8v6l-4 2v-8z"/></svg><span class="ifd-full"> Filtrlar</span> <span data-inflow-filter-count></span></button>
                <label class="ifd-desk"><span class="sr-only">Saralash</span><select class="form-control" data-inflow="sort">${[['date-down', 'Sana: yangi → eski'], ['date-up', 'Sana: eski → yangi'], ['amount-down', 'Summa: katta → kichik'], ['amount-up', 'Summa: kichik → katta']].map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label></div>
            <p class="ifd-sumline" data-inflow-sumline></p>
            <div class="inflow-kpis" data-inflow-kpis></div>
            <div class="fin-psheet ifd-filter" data-inflow-filter-sheet hidden role="dialog" aria-label="Filtrlar"><div>
                <span class="fin-sheet-h" style="justify-content:space-between;align-items:center"><b>Filtrlar</b><button type="button" class="fin-sheet-x" data-inflow-filter-close aria-label="Yopish">×</button></span>
                <b class="ifd-lbl">Davr</b><div class="fin-pseg">${[['month', 'Joriy oy'], ['today', 'Bugun'], ['yesterday', 'Kecha']].map(([v, t]) => `<button type="button" data-inflow-quick="${v}">${t}</button>`).join('')}</div>
                <div class="inflow-filters"><label>Hisoblash oyi<div class="inflow-month-control"><button type="button" data-inflow-month-step="-1" aria-label="Oldingi oy">‹</button><input type="month" aria-label="Hisoblash oyi" data-inflow="month" value="${month}"><button type="button" data-inflow-month-step="1" aria-label="Keyingi oy">›</button></div></label>
                <label>Boshlanish<input type="date" class="form-control" data-inflow="start" value="${period.start}"></label><label>Tugash<input type="date" class="form-control" data-inflow="end" value="${period.end}"></label>
                <label>Menejer<select class="form-control" data-inflow="manager"></select></label><label>Tarif<select class="form-control" data-inflow="tariff">${opts(Object.entries(L.TARIFFS), 'Barcha tariflar')}</select></label>
                <label>Ustoz<select class="form-control" data-inflow="teacher"></select></label><label>To‘lov usuli<select class="form-control" data-inflow="method">${opts(Object.entries(L.METHODS), 'Barcha usullar')}</select></label>
                <label>To‘lov turi<select class="form-control" data-inflow="form">${opts([['full', 'To‘liq'], ['partial', 'Yarim (Zaklad)']], 'Barchasi')}</select></label>
                <label>Tekshirish<select class="form-control" data-inflow="review">${opts([['legacy','Chek/usulni tekshirish'],['missing-manager','Menejer biriktirilmagan']], 'Barcha yozuvlar')}</select></label></div>
                <div class="fin-actions"><button type="button" class="fin-qbtn" data-inflow-reset>Filtrlarni tozalash</button><button type="button" class="fin-qbtn fin-qbtn--pri" data-inflow-filter-close>Qo‘llash</button></div></div></div>
            <div class="fin-psheet" data-inflow-more-sheet hidden role="dialog" aria-label="Amallar"><div><span class="fin-sheet-h" style="justify-content:space-between;align-items:center"><b>Amallar</b><button type="button" class="fin-sheet-x" data-inflow-more-close aria-label="Yopish">×</button></span>
                <div class="fin-dlist ifd-menu"><button type="button" data-inflow-recon>☑ Solishtirish <span>›</span></button><button type="button" data-inflow-export2>⤓ Excelga yuklash (.xlsx) <span>›</span></button><button type="button" data-inflow-refresh2>↻ Yangilash <span>›</span></button></div></div></div>
            <p role="status" data-inflow-message></p><p role="alert" data-inflow-validation hidden></p><div data-inflow-content></div>
            <section class="fin-card ifd-check" aria-labelledby="ifdCheckH"><header><h3 id="ifdCheckH">Tekshiruv</h3></header>
                <b>Chek/usulni tekshirish</b><p class="fin-dnote">Chek yo‘q yoki usul mos emas — “Tekshirish kerak”. Moliya xodimi “Moliya tasdiqlaydi” tugmasi bilan tasdiqlaydi. Cash Flow kirimini tekshirish — Solishtirish oynasida (Reyestr tushumi · Joriy qarz · O‘sha paytdagi qarz).</p>
                <div class="fin-actions"><button type="button" class="fin-qbtn" data-inflow-review-legacy>Tekshirish</button></div>
                <p class="text-muted" data-inflow-note></p><div data-inflow-issues></div><div data-inflow-cash-review></div></section>`;
        root.querySelector('[data-inflow="month"]').onchange = e => { const p = monthDates(e.target.value); if (!p) return; root.querySelector('[data-inflow="start"]').value = p.start; root.querySelector('[data-inflow="end"]').value = p.end; draw(root); };
        root.querySelectorAll('[data-inflow]').forEach(el => { if (el.dataset.inflow !== 'month') el.addEventListener(el.type === 'search' ? 'input' : 'change', () => draw(root)); });
        root.querySelectorAll('[data-inflow="start"],[data-inflow="end"]').forEach(el=>el.addEventListener('change',()=>{root.querySelector('[data-inflow="month"]').value='';}));
        root.querySelectorAll('[data-inflow-month-step]').forEach(btn=>btn.onclick=()=>{
            const input=root.querySelector('[data-inflow="month"]'),current=input.value || root.querySelector('[data-inflow="start"]').value.slice(0,7) || L.today().slice(0,7);
            const [y,m]=current.split('-').map(Number),next=new Date(Date.UTC(y,m-1+Number(btn.dataset.inflowMonthStep),1));
            input.value=next.toISOString().slice(0,7);input.dispatchEvent(new Event('change',{bubbles:true}));
        });
        root.querySelector('[data-inflow-reset]').onclick=()=>{
            ['manager','teacher','tariff','method','form','search','review'].forEach(k=>root.querySelector(`[data-inflow="${k}"]`).value='');
            root.querySelector('[data-inflow="sort"]').value='date-down';root.querySelector('[data-inflow="month"]').value=L.today().slice(0,7);
            root.querySelector('[data-inflow="month"]').dispatchEvent(new Event('change',{bubbles:true}));
        };
        root.querySelectorAll('[data-inflow-quick]').forEach(btn => { btn.onclick = () => {
            const now = L.today(), d = new Date(now + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1);
            const p = btn.dataset.inflowQuick === 'month' ? monthDates(now.slice(0, 7)) : { start: btn.dataset.inflowQuick === 'today' ? now : d.toISOString().slice(0, 10), end: btn.dataset.inflowQuick === 'today' ? now : d.toISOString().slice(0, 10) };
            root.querySelector('[data-inflow="month"]').value = btn.dataset.inflowQuick === 'month' ? now.slice(0, 7) : '';
            root.querySelector('[data-inflow="start"]').value = p.start; root.querySelector('[data-inflow="end"]').value = p.end; draw(root);
        }; });
        root.querySelector('[data-inflow-refresh]').onclick = () => refresh(root);
        const sheet = sel => root.querySelector(sel);
        const toggle = (sel, open) => { sheet(sel).hidden = !open; };
        root.querySelector('[data-inflow-filters]').onclick = () => toggle('[data-inflow-filter-sheet]', true);
        root.querySelectorAll('[data-inflow-filter-close]').forEach(b => b.onclick = () => toggle('[data-inflow-filter-sheet]', false));
        root.querySelector('[data-inflow-more]').onclick = () => toggle('[data-inflow-more-sheet]', true);
        root.querySelector('[data-inflow-more-close]').onclick = () => toggle('[data-inflow-more-sheet]', false);
        root.querySelectorAll('[data-inflow-filter-sheet], [data-inflow-more-sheet]').forEach(el => el.addEventListener('click', e => { if (e.target === el) el.hidden = true; }));
        root.querySelector('[data-inflow-refresh2]').onclick = () => { toggle('[data-inflow-more-sheet]', false); refresh(root); };
        root.querySelector('[data-inflow-export2]').onclick = () => { toggle('[data-inflow-more-sheet]', false); root.querySelector('[data-inflow-export]').click(); };
        // Solishtirish: Cash Flow kirimini tekshirish oynasi (Reyestr tushumi · Joriy qarz · O'sha paytdagi qarz).
        root.querySelectorAll('[data-inflow-recon]').forEach(b => b.onclick = () => {
            toggle('[data-inflow-more-sheet]', false);
            const start = root.querySelector('[data-inflow-cash-review] button');
            if (start) { start.scrollIntoView({ block: 'center' }); start.click(); } else if (typeof switchFinanceSection === 'function') switchFinanceSection('solishtirish');
        });
        root.querySelector('[data-inflow-receive]').onclick = () => openStudentPayment();
        // "Tekshirish" — chek/usuli tekshirilishi kerak bo'lgan tushumlarni filtrlaydi.
        root.querySelector('[data-inflow-review-legacy]').onclick = () => { root.querySelector('[data-inflow="review"]').value = 'legacy'; draw(root); root.querySelector('[data-inflow-content]').scrollIntoView({ block: 'start' }); };
        root.querySelector('[data-inflow-export]').onclick = async () => {
            try {
                if (L.rangeError(filters(root))) throw Error(L.rangeError(filters(root)));
                if (!state.loaded) throw Error('Avval server ma’lumotlari yuklanishini kuting');
                await loadXlsxLib();
                const list = rows(root), sum = L.summary(list), str = v => /^[=+@-]/.test(String(v || '')) ? "'" + v : String(v || '');
                const sheet = XLSX.utils.aoa_to_sheet([['№', 'Sana', 'Vaqt', 'Ism Familiya', 'Telefon', 'Tarif', 'To‘lov usuli', 'To‘lov', 'To‘lov summasi (UZS)', 'Qoldiq qarz (UZS)', 'Keyingi to‘lov', 'Menejer', 'O‘qituvchi', 'Tekshirish', 'Chek'],
                    ...list.map((r, i) => [i + 1, dateText(r.paidDate), r.paidTime, str(r.name), str(r.phone), L.TARIFFS[r.tariff] || '', L.METHODS[r.method], r.form === 'full' ? 'To‘liq' : 'Yarim', r.amount, r.debt, dateText(L.nextDate(r.debt,r.nextPaymentDate)), str(r.managerName || 'Biriktirilmagan'), str(r.teacherName), r.legacyReview ? 'Tekshirish kerak' : '', r.receiptUrl]),
                    ['Jami (qarz o‘quvchi bo‘yicha 1 marta)', '', '', '', '', '', '', '', sum.amount, sum.debt]]);
                sheet['!cols'] = [6, 14, 10, 26, 20, 22, 18, 14, 23, 23, 16, 26, 26, 24, 40].map(wch => ({ wch }));
                for (let n=2;n<=list.length+2;n++) for (const column of ['I','J']) if(sheet[column+n]) sheet[column+n].z=L.excelMoneyFormat(sheet[column+n].v);
                const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'To‘lovlar'); XLSX.writeFile(book, `tolovlar-${_financeLang}-${filters(root).start || 'barchasi'}.xlsx`);
            } catch (e) { root.querySelector('[data-inflow-message]').textContent = e.message; }
        };
    }
    // Moliyaning umumiy davr qatori: davr tanlansa, ro'yxat shu davrga filtrlanadi.
    function applyPeriod(root, p) {
        if (!p?.start || !p?.end) return;
        root.querySelector('[data-inflow="start"]').value = p.start; root.querySelector('[data-inflow="end"]').value = p.end;
        root.querySelector('[data-inflow="month"]').value = p.preset === 'month' || p.preset === 'prev' ? p.start.slice(0, 7) : '';
    }
    // "Kutilayotgan qoldiq qarz" — davr sotuvlaridan qolgan qarz (Umumiy bilan bitta server funksiyasi).
    const debtState = { key: '', value: null, failed: false };
    async function loadPeriodDebt(root) {
        const f = filters(root), key = [_financeLang, f.start, f.end].join('|');
        if (!f.start || !f.end || debtState.key === key) return;
        debtState.key = key; debtState.value = null;
        try { const d = await apiFetch(`/api/finance/period-debt?scope=${_financeLang}&start=${f.start}&end=${f.end}`); if (debtState.key === key) { debtState.value = d.periodSales?.total ?? 0; debtState.failed = false; } }
        catch { debtState.failed = true; }
        if (root.isConnected) draw(root);
    }
    function render() {
        const root = document.getElementById('inflowRoot'); if (!root) return;
        mount(root);
        if (window.financeUI?.mountPeriodRow) {
            applyPeriod(root, window.financeUI.period());
            window.financeUI.mountPeriodRow(root.querySelector('[data-inflow-periodrow]'), p => { applyPeriod(root, p); draw(root); loadPeriodDebt(root); });
        }
        fillPeople(root); draw(root); refresh(root); loadPeriodDebt(root);
    }
    function ensureTimer() {
        if (!state.timer) state.timer = setInterval(() => {
            if (document.visibilityState === 'visible' && document.querySelector('[data-finance-panel="tolovlar"].active')) refresh(document.getElementById('inflowRoot'));
            else if (document.visibilityState === 'visible' && document.querySelector('[data-finance-panel="cashflow"].active')) refresh(null);
        }, 20000);
    }
    function paymentFields(prefix) {
        return `<div class="inflow-proof"><label>To‘lov usuli<select class="form-control" id="${prefix}Method">${opts(Object.entries(L.METHODS).filter(([v]) => v !== 'unknown'), 'Usulni tanlang')}</select></label><label>Chek (rasm yoki PDF)<input type="file" id="${prefix}Receipt" accept="image/jpeg,image/png,image/webp,application/pdf"></label><p class="text-muted">Faqat haqiqatan qabul qilingan tushum uchun majburiy. Kredit arizasi tushum emas.</p></div>`;
    }
    async function collectProof(root, prefix, required = true) {
        if (!required) return {};
        const paymentMethod = root.querySelector('#' + prefix + 'Method')?.value;
        const file = root.querySelector('#' + prefix + 'Receipt')?.files?.[0];
        if (!paymentMethod) throw Error('To‘lov usulini tanlang');
        if (!file || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) throw Error('Chekni rasm yoki PDF shaklida yuklang');
        const input = root.querySelector('#' + prefix + 'Receipt');
        // Retrying the same operation keeps its uploaded evidence and idempotency key.
        if (!input._uploaded || input._uploaded.file !== file) input._uploaded = { file, url: (await apiUploadFile(file)).url };
        return { paymentMethod, receiptUrl: input._uploaded.url };
    }
    // Reyestrga to'lov qabul qilish (K_tolovQabul → K_tolovQabul2): 1) o'quvchi, summa, usul, chek; 2) tasdiqlash.
    function debtors() { return getItem(STORAGE_KEYS.students, []).filter(s => Number(s.debtAmount) > 0 && (!s.subject || s.subject === _financeLang)); }
    async function openPayment(id, o = {}) {
        const picker = o.picker ? `<label>O‘quvchi<select class="form-control" id="ledgerPaymentStudent">${opts(debtors().map(x => [x.id, x.name + (x.phone ? ' · ' + x.phone : '')]), 'O‘quvchini tanlang')}</select></label>` : '';
        if (!id) {
            openModal('Reyestrga to‘lov qabul qilish', `<div class="inflow-proof">${picker}<p class="text-muted">Qarzi mavjud o‘quvchini tanlang. Kurs narxi yoki kitob narxini bu yerda tushum deb kiritmang.</p></div>`, '<button type="button" class="btn-secondary-sm" onclick="closeModal()">Bekor qilish</button><button type="button" class="btn-primary-sm" disabled>Davom etish</button>');
            document.getElementById('ledgerPaymentStudent').onchange = e => { if (e.target.value) openPayment(e.target.value, o); };
            return;
        }
        try {
            const { student: s } = await apiFetch('/api/inflow/students/' + encodeURIComponent(id)); cacheProvisionedStudent(s);
            const requestKey = crypto.randomUUID();
            const paidSoFar = Number(s.paidAmount || 0), debtNow = Number(s.debtAmount || 0);
            // Sarlavha textContent orqali chiqadi — escape kerak emas.
            openModal(o.picker ? 'Reyestrga to‘lov qabul qilish' : String(s.name || '') + ' — To‘lov qabul qilish', `<div class="inflow-proof" data-pay-step="1">${picker}<div class="ifx-pay-sum"><div><span>Joriy qarz</span><strong>${money(debtNow)}</strong></div><div><span>To‘langan</span><b>${money(paidSoFar)}</b></div>${s.paymentDueDate ? `<div><span>Kelishilgan sana</span><b>${dateText(s.paymentDueDate)}</b></div>` : ''}</div><div class="ifx-pay-quick"><button type="button" class="btn-secondary-sm" data-pay-fill="${debtNow}">Qarzni to‘liq: ${money(debtNow)}</button>${debtNow >= 2 ? `<button type="button" class="btn-secondary-sm" data-pay-fill="${Math.round(debtNow / 2)}">Yarmi: ${money(Math.round(debtNow / 2))}</button>` : ''}</div><label>To‘lov summasi (UZS)<input type="text" inputmode="numeric" class="form-control" id="inflowAmount" data-money-input></label><p class="ifx-pay-left" id="inflowLeft" aria-live="polite"></p><label>Tushgan sana<input type="date" class="form-control" id="inflowDate" value="${L.today()}" max="${L.today()}"></label><label>Vaqt (ma’lum bo‘lsa)<input type="time" class="form-control" id="inflowTime"></label>${paymentFields('debtInflow')}</div>
                <div class="inflow-proof" data-pay-step="2" hidden></div><p role="alert" id="inflowError"></p>`,
                '<button type="button" class="btn-secondary-sm" id="inflowCancel">Bekor qilish</button><button type="button" class="btn-primary-sm" id="inflowSave">Davom etish</button>');
            const body = document.getElementById('modalBody'); wireMoneyInputs(body);
            const sel = body.querySelector('#ledgerPaymentStudent'); if (sel) { sel.value = id; sel.onchange = e => { if (e.target.value) openPayment(e.target.value, o); }; }
            const amountInput = body.querySelector('#inflowAmount'), leftEl = body.querySelector('#inflowLeft');
            const showLeft = () => { const a = L.money(amountInput.value); leftEl.textContent = a ? (a > debtNow ? 'Summa qarzdan katta' : 'To‘lovdan keyin qoldiq: ' + money(debtNow - a)) : ''; leftEl.classList.toggle('is-bad', a > debtNow); };
            amountInput.addEventListener('input', showLeft);
            body.querySelectorAll('[data-pay-fill]').forEach(b => b.onclick = () => { amountInput.value = String(b.dataset.payFill); amountInput.dispatchEvent(new Event('input', { bubbles: true })); showLeft(); amountInput.focus(); });
            const step1 = body.querySelector('[data-pay-step="1"]'), step2 = body.querySelector('[data-pay-step="2"]'), saveBtn = document.getElementById('inflowSave'), cancelBtn = document.getElementById('inflowCancel');
            let pending = null;
            const back = () => { step1.hidden = false; step2.hidden = true; saveBtn.textContent = 'Davom etish'; cancelBtn.textContent = 'Bekor qilish'; };
            cancelBtn.onclick = () => (step2.hidden ? closeModal() : back());
            saveBtn.onclick = async e => {
                const btn = e.currentTarget; btn.disabled = true;
                const err = body.querySelector('#inflowError'); err.textContent = '';
                try {
                    if (step2.hidden) {
                        const amount = L.money(amountInput.value), paidDate = body.querySelector('#inflowDate').value;
                        if (!amount || amount > Number(s.debtAmount)) throw Error('Summa musbat bo‘lishi va qarzdan oshmasligi kerak');
                        if (typeof confirmSuspiciousPaymentAmount === 'function' && !confirmSuspiciousPaymentAmount(amount)) throw Error('Summani tekshiring');
                        if (!L.date(paidDate) || paidDate > L.today()) throw Error('Tushum sanasini to‘g‘ri tanlang');
                        const proof = await collectProof(body, 'debtInflow');
                        if (!pending || pending.amount !== amount || pending.paidDate !== paidDate || pending.receiptUrl !== proof.receiptUrl || pending.method !== proof.paymentMethod)
                            pending = { studentId: id, requestKey, amount, paidDate, paidTime: body.querySelector('#inflowTime').value, method: proof.paymentMethod, receiptUrl: proof.receiptUrl, expectedDebt: Number(s.debtAmount) };
                        step2.innerHTML = `<div class="ifx-pay-sum ifd-confirm"><div><span>O‘quvchi</span><b>${esc(s.name)}</b></div><div><span>Summa</span><b>${money(pending.amount)}</b></div><div><span>Usul</span><b>${esc(L.METHODS[pending.method] || '')}</b></div><div><span>To‘lovdan keyin qoldiq</span><b>${money(debtNow - pending.amount)}</b></div><div><span>Chek</span><b>biriktirilgan</b></div></div>`;
                        step1.hidden = true; step2.hidden = false; saveBtn.textContent = 'Qabul qilish'; cancelBtn.textContent = 'Orqaga'; btn.disabled = false;
                        return;
                    }
                    const result = await apiFetch('/api/inflow', { method: 'POST', body: JSON.stringify(pending) });
                    cacheProvisionedStudent(result.student); closeModal(); refreshAllDebtorViews();
                    // Refresh lead version/comment after a server-side payment; never overwrite that history with a stale snapshot.
                    apiFetch('/api/leads').then(leads => setCachedItem(STORAGE_KEYS.leads, leads)).catch(() => {});
                    showMiniToast('To‘lov serverga saqlandi');
                    if (document.querySelector('[data-finance-panel="tolovlar"].active')) render();
                    window.financeUI?.invalidate?.();
                } catch (er) { err.textContent = er.message + (pending && !step2.hidden ? ' Qayta urinish shu to‘lovni takroran yozmaydi.' : ''); btn.disabled = false; }
            };
        } catch (e) { alert(e.message); }
    }
    function cashProjection() {
        return L.projectCash(getItem(STORAGE_KEYS.cashFlow, []), [...state.rows.english, ...state.rows.russian], state.decisions);
    }
    function renderReconciliation() {
        const pending = cashProjection().pending;
        document.querySelectorAll('[data-inflow-cash-review]').forEach(root => {
            root.innerHTML = !pending.length ? '' : `<section class="inflow-review-box"><h3>Eski kirimlarni solishtirish: ${pending.length} ta</h3>
                <p role="alert">Balans vaqtinchalik: quyidagi shubhali qo‘lda kiritilgan kirimlar moliya tasdig‘igacha balans va Excel jami summasiga qo‘shilmagan. Asl yozuvlar saqlangan.</p>
                ${pending.slice(0, 100).map(({cash}) => `<div class="inflow-review-row"><span>${esc(cash.date)} · ${money(cash.amount)} · ${esc(cash.notes || cash.person || cash.id)}</span>
                <button type="button" class="btn-secondary-sm" data-reconcile-cash="${esc(cash.id)}">Solishtirish</button></div>`).join('')}</section>`;
            root.querySelectorAll('[data-reconcile-cash]').forEach(btn => { btn.onclick = () => openReconciliation(btn.dataset.reconcileCash); });
        });
    }
    function openReconciliation(id) {
        const pending = cashProjection().pending.find(p => p.cash.id === id); if (!pending) return;
        const { cash, candidates } = pending;
        openModal('Cash Flow kirimini tekshirish', `<div class="inflow-proof"><p>${esc(cash.date)} · ${money(cash.amount)} · ${esc(cash.notes || cash.person || '')}</p>
            <p>Haqiqiy chek va manbani tekshirib tanlang. Bir xil sana/summa ikki alohida to‘lov bo‘lishi ham mumkin.</p>
            <label>Qaror<select id="cashReviewDecision" class="form-control"><option value="">Tanlang</option><option value="linked">Reyestrdagi shu tushumning nusxasi</option><option value="independent">Bu boshqa, alohida kirim</option></select></label>
            <label id="cashReviewRecordWrap" hidden>Qaysi tushum?<select id="cashReviewRecord" class="form-control"><option value="">Tushumni tanlang</option>${candidates.map(r => `<option value="${esc(r.id)}">${esc(r.paidDate)} · ${esc(r.name)} · ${money(r.amount)} · ${esc(L.METHODS[r.method])} · ${esc(r.id)}</option>`).join('')}</select></label>
            <p id="cashReviewError" role="alert"></p></div>`, '<button type="button" class="btn-secondary-sm" id="cashReviewCancel">Bekor qilish</button><button type="button" class="btn-primary-sm" id="cashReviewSave">Moliya tasdiqlaydi</button>');
        document.getElementById('cashReviewDecision').onchange = e => { document.getElementById('cashReviewRecordWrap').hidden = e.target.value !== 'linked'; };
        document.getElementById('cashReviewCancel').onclick = closeModal;
        document.getElementById('cashReviewSave').onclick = async e => {
            const decision = document.getElementById('cashReviewDecision').value, recordId = document.getElementById('cashReviewRecord').value;
            const error = document.getElementById('cashReviewError');
            if (!decision || (decision === 'linked' && !recordId)) { error.textContent = 'Qaror va kerak bo‘lsa tushumni tanlang'; return; }
            const button = e.currentTarget; button.disabled = true;
            try {
                const payload = { cashId: cash.id, decision, recordId: decision === 'linked' ? recordId : '', snapshot: L.stable(cash) };
                await apiFetch('/api/inflow/cash-reconciliation', { method: 'POST', body: JSON.stringify(payload) });
                state.decisions = [...state.decisions.filter(d => d.cashId !== cash.id), payload];
                closeModal(); renderReconciliation(); renderCashFlow(); refresh(document.getElementById('inflowRoot')?.dataset.inflowMounted ? document.getElementById('inflowRoot') : null);
            } catch (err) { error.textContent = err.message; button.disabled = false; }
        };
    }
    async function renderHistory(root, id) {
        if (!root) return;
        try {
            const data = await apiFetch('/api/inflow/students/' + encodeURIComponent(id) + '/history');
            if (!root.isConnected || root.dataset.inflowHistory !== id) return;
            const proof = r => r.receiptUrl ? `<a href="${esc(r.receiptUrl)}" target="_blank" rel="noopener">Chek</a>` : '—';
            const when = r => `${L.date(r.date) ? dateText(r.date) : esc(r.date)} ${esc(r.time || '')}`;
            root.innerHTML = `<div class="ifx-pay-sum ifx-hist-sum"><div><span>Reyestr tushumi</span><b>${money(data.summary.amount)}</b></div><div><span>Toʻlovlar soni</span><b>${data.summary.count} ta</b></div><div><span>Joriy qarz</span>${data.summary.debt == null ? '<b>Aniqlanmagan</b>' : Number(data.summary.debt) > 0 ? `<strong>${money(data.summary.debt)}</strong>` : '<b class="ifx-ok">Qarz yoʻq</b>'}</div></div>
                <div class="inflow-table-wrap"><table class="inflow-table"><thead><tr><th>Sana</th><th>Tushum</th><th>Usul</th><th>O‘sha paytdagi qarz</th><th>Chek</th></tr></thead><tbody>${data.history.map(r => `<tr><td>${when(r)}</td><td class="inflow-amount">${money(r.paid)}</td><td>${esc(L.METHODS[r.method])}</td><td>${money(r.debt)}</td><td>${proof(r)}</td></tr>`).join('') || '<tr><td colspan="5">Reyestrda tushum yo‘q</td></tr>'}</tbody></table></div>
                <div class="inflow-mobile">${data.history.map(r => `<article class="inflow-payment"><header>${when(r)}</header><p class="inflow-amount">${money(r.paid)}</p><p>${esc(L.METHODS[r.method])} · Qoldiq: ${money(r.debt)}</p>${proof(r)}</article>`).join('') || '<p>Reyestrda tushum yo‘q</p>'}</div>
                ${data.legacyHistory.length ? `<details class="inflow-review-box"><summary>Tekshirilmagan eski arxiv: ${data.legacyHistory.length} ta</summary><p>Quyidagi yozuvlar yuqoridagi jami summaga qo‘shilmagan; takrorlanishi yoki sana/summasi aniqlashtirilishi mumkin.</p>${data.legacyHistory.map(r => `<p>${esc(r.date || 'Sana yo‘q')} · ${r.paid == null ? 'Summa yo‘q' : money(r.paid)} · ${esc(r.id)}</p>`).join('')}</details>` : ''}`;
        } catch (err) { if (root.isConnected) root.textContent = 'To‘lov tarixini yuklashda xatolik: ' + err.message; }
    }
    function openStudentPayment() { openPayment(null, { picker: true }); }
    window.inflowUI = { render, refreshCash: () => refresh(null), paymentFields, collectProof, openPayment,
        renderHistory, openStudentPayment, cashProjection, renderReconciliation,
        isCashLocked: id => state.decisions.some(d => d.cashId === id),
        cashRows: () => L.cashFlow([...state.rows.english, ...state.rows.russian]) };
})();
