(function () {
    'use strict';
    const L = PaymentLedger, state = { rows: { english: [], russian: [] }, decisions: [], loaded: false, seq: 0, timer: null, issueLists: { english: [], russian: [] }, unscoped: 0 };
    const esc = value => escapeHtml(String(value ?? ''));
    const money = value => Number(value || 0).toLocaleString('en-US').replaceAll(',', ' ') + ' UZS';
    const opts = (items, all) => `<option value="">${all}</option>` + items.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join('');
    const dateText = value => L.displayDate(value);
    const methodBadge = r => `<span class="inflow-method" title="${esc(L.METHODS[r.method] || 'Aniqlanmagan')}"><span aria-hidden="true">${({cash:'💵',bank:'🏦',card:'💳',uzum:'💳',paylater:'💳',payme:'🏦',click:'🏦',unknown:'?'})[r.method] || '?'}</span> ${esc(r.method==='unknown' ? 'Noma’lum' : L.METHODS[r.method] || 'Aniqlanmagan')}</span>`;
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
        root.querySelector('[data-inflow-filter-count]').textContent = ['manager','teacher','tariff','method','form','review'].filter(k=>f[k]).length ? '· '+['manager','teacher','tariff','method','form','review'].filter(k=>f[k]).length+' faol' : '';
        root.querySelector('[data-inflow-kpis]').innerHTML = [['Jami tushum (fakt)', money(summary.amount)], ['Kutilayotgan qoldiq qarz', money(summary.debt)], ['Tranzaksiyalar soni', summary.count]]
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
        const cell = (r,compact=false) => {
            const proof = r.receiptUrl ? `<a href="${esc(r.receiptUrl)}" target="_blank" rel="noopener" title="Chekni ko‘rish">${compact?'Ko‘rish':'Chekni ko‘rish'}</a>` : compact ? '<span title="Chek yo‘q">—</span>' : 'Chek yo‘q';
            return proof + (r.legacyReview ? `<small class="inflow-review" title="Eski ma’lumot — chek yoki usulni tekshirish kerak">${compact?'Tekshir':'Tekshirish kerak'}</small>` : '');
        };
        const tr = list.map((r, i) => `<tr><td>${i + 1}</td><td>${dateText(r.paidDate)}<small>${esc(r.paidTime || 'Vaqt noma’lum')}</small></td><td>${esc(r.name)}</td><td>${esc(r.phone)}</td><td>${esc(L.TARIFFS[r.tariff] || 'Aniqlanmagan')}</td><td>${methodBadge(r)}</td><td>${r.form === 'full' ? 'To‘liq' : 'Yarim (Zaklad)'}</td><td class="inflow-amount">${money(r.amount)}</td><td>${money(r.debt)}</td><td>${dateText(L.nextDate(r.debt,r.nextPaymentDate))}</td><td>${esc(r.managerName || 'Biriktirilmagan')}</td><td>${esc(r.teacherName || 'Aniqlanmagan')}</td><td>${cell(r,true)}</td></tr>`).join('');
        const headings = ['№','Sana / vaqt','Ism Familiya','Telefon','Tarif','To‘lov usuli','To‘lov shakli','To‘lov summasi','Qoldiq qarz','Keyingi to‘lov','Menejer','O‘qituvchi','Chek'];
        const focusFilters={2:'search',3:'search',4:'tariff',5:'method',6:'form',10:'manager',11:'teacher',12:'review'};
        const sortable = (label, key) => `<button type="button" data-inflow-sort="${key}" title="${label} bo‘yicha saralash">${label} <span aria-hidden="true">${f.sort.startsWith(key+'-') ? f.sort.endsWith('up') ? '↑' : '↓' : '↕'}</span></button>`;
        content.innerHTML = `<div class="inflow-table-wrap"><table class="inflow-table inflow-ledger-table"><colgroup>${[3,9,12,9,6,7,6,9,8,7,9,10,5].map(n=>`<col style="width:${n}%">`).join('')}</colgroup><thead><tr>${headings.map((h,i)=>`<th${i===1||i===7 ? ` aria-sort="${f.sort.startsWith((i===1?'date':'amount')+'-') ? f.sort.endsWith('up')?'ascending':'descending':'none'}"` : ''}>${i===1||i===7 ? sortable(h,i===1?'date':'amount') : focusFilters[i] ? `<button type="button" data-inflow-focus="${focusFilters[i]}" title="${h} bo‘yicha filtrlash">${h} <span aria-hidden="true">⌄</span></button>` : h}</th>`).join('')}</tr></thead><tbody>${tr || '<tr><td colspan="13">Tanlangan filtrlar bo‘yicha to‘lov yo‘q</td></tr>'}</tbody><tfoot><tr><td colspan="7">Jami: ${summary.count} ta</td><td>${money(summary.amount)}</td><td>${money(summary.debt)}</td><td colspan="4">Qarz o‘quvchi bo‘yicha bir marta</td></tr></tfoot></table></div>
            <div class="inflow-mobile">${list.map(r => `<article class="inflow-payment"><header><strong>${esc(r.name)}</strong><span>${dateText(r.paidDate)} ${esc(r.paidTime || 'Vaqt noma’lum')}</span></header><p>${esc(r.phone)}</p><div class="inflow-payment-total"><strong class="inflow-amount">${money(r.amount)}</strong>${methodBadge(r)}</div><dl><dt>Menejer</dt><dd>${esc(r.managerName || 'Biriktirilmagan')}</dd><dt>Ustoz</dt><dd>${esc(r.teacherName || '—')}</dd><dt>Tarif</dt><dd>${esc(L.TARIFFS[r.tariff] || '—')}</dd><dt>To‘lov</dt><dd>${r.form === 'full' ? 'To‘liq' : 'Yarim (Zaklad)'}</dd><dt>Qoldiq qarz</dt><dd>${money(r.debt)}</dd>${r.debt>0 ? `<dt>Keyingi to‘lov</dt><dd>${dateText(r.nextPaymentDate)}</dd>` : ''}</dl>${cell(r)}</article>`).join('') || '<p class="inflow-empty">To‘lovlar topilmadi</p>'}<div class="inflow-mobile-summary"><span>${summary.count} ta · Jami: <strong>${money(summary.amount)}</strong></span><span>Qarz: ${money(summary.debt)}</span></div></div>`;
        content.querySelectorAll('[data-inflow-sort]').forEach(button => button.onclick = () => {
            root.querySelector('[data-inflow="sort"]').value = button.dataset.inflowSort + (f.sort === button.dataset.inflowSort+'-down' ? '-up' : '-down'); draw(root);
        });
        content.querySelectorAll('[data-inflow-focus]').forEach(button=>button.onclick=()=>{
            if(button.dataset.inflowFocus!=='search')root.querySelector('.inflow-filter-panel').open=true;
            root.querySelector(`[data-inflow="${button.dataset.inflowFocus}"]`).focus();
        });
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
        root.innerHTML = `<div class="inflow-toolbar"><h2>To‘lovlar</h2><button type="button" class="btn-secondary-sm" data-inflow-refresh>Yangilash</button><button type="button" class="btn-primary-sm" data-inflow-export aria-label="Excelga yuklash (.xlsx)"><span class="inflow-export-full">Excelga yuklash (.xlsx)</span><span class="inflow-export-mobile">Excel (.xlsx)</span></button></div>
            <div class="inflow-kpis" data-inflow-kpis></div><div class="inflow-filters inflow-basic-filters">
            <label>Hisoblash oyi<div class="inflow-month-control"><button type="button" data-inflow-month-step="-1" aria-label="Oldingi oy">‹</button><input type="month" data-inflow="month" value="${month}"><button type="button" data-inflow-month-step="1" aria-label="Keyingi oy">›</button></div></label>
            <div class="inflow-quick">${[['today', 'Bugun'], ['yesterday', 'Kecha'], ['month', 'Joriy oy']].map(([v, t]) => `<button type="button" class="btn-secondary-sm" data-inflow-quick="${v}">${t}</button>`).join('')}</div>
            <label class="inflow-search"><span>Ism yoki telefon</span><input type="search" aria-label="Ism yoki telefon" data-inflow="search" placeholder="Ism yoki telefon raqami" autocomplete="off" data-lpignore="true" data-1p-ignore="true"></label></div>
            <details class="inflow-filter-panel"><summary>Qo‘shimcha filtrlar <span data-inflow-filter-count></span></summary><div class="inflow-filters inflow-filter-fields"><label>Boshlanish<input type="date" data-inflow="start" value="${period.start}"></label><label>Tugash<input type="date" data-inflow="end" value="${period.end}"></label>
            <label>Menejer<select data-inflow="manager"></select></label><label>Ustoz<select data-inflow="teacher"></select></label><label>Tarif<select data-inflow="tariff">${opts(Object.entries(L.TARIFFS), 'Barcha tariflar')}</select></label><label>Usul<select data-inflow="method">${opts(Object.entries(L.METHODS), 'Barcha usullar')}</select></label>
            <label>To‘lov shakli<select data-inflow="form">${opts([['full', 'To‘liq'], ['partial', 'Yarim (Zaklad)']], 'Barchasi')}</select></label><label>Saralash<select data-inflow="sort">${[['date-down', 'Sana: yangi → eski'], ['date-up', 'Sana: eski → yangi'], ['amount-down', 'Summa: katta → kichik'], ['amount-up', 'Summa: kichik → katta']].map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>
            <label>Tekshirish<select data-inflow="review">${opts([['legacy','Chek/usulni tekshirish'],['missing-manager','Menejer biriktirilmagan']], 'Barcha yozuvlar')}</select></label><button type="button" class="btn-secondary-sm" data-inflow-reset>Filtrlarni tozalash</button></div></details>
            <p class="text-muted" data-inflow-note></p><div data-inflow-issues></div><div data-inflow-cash-review></div><p role="status" data-inflow-message></p><p role="alert" data-inflow-validation hidden></p><div data-inflow-content></div>`;
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
    function render() {
        const root = document.getElementById('inflowRoot'); if (!root) return;
        mount(root); fillPeople(root); draw(root); refresh(root);
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
    async function openPayment(id) {
        try {
            const { student: s } = await apiFetch('/api/inflow/students/' + encodeURIComponent(id)); cacheProvisionedStudent(s);
            const requestKey = crypto.randomUUID();
            openModal(esc(s.name) + ' — To‘lov qabul qilish', `<div class="inflow-proof"><p>Joriy qarz: <strong>${money(s.debtAmount)}</strong></p><label>Qabul qilingan summa<input type="text" inputmode="numeric" class="form-control" id="inflowAmount" data-money-input></label><label>Tushgan sana<input type="date" class="form-control" id="inflowDate" value="${L.today()}" max="${L.today()}"></label><label>Vaqt (ma’lum bo‘lsa)<input type="time" class="form-control" id="inflowTime"></label>${paymentFields('debtInflow')}<p role="alert" id="inflowError"></p></div>`, '<button type="button" class="btn-secondary-sm" id="inflowCancel">Bekor qilish</button><button type="button" class="btn-primary-sm" id="inflowSave">Qabul qilish</button>');
            const body = document.getElementById('modalBody'); wireMoneyInputs(body);
            document.getElementById('inflowCancel').onclick = closeModal;
            let pending = null;
            document.getElementById('inflowSave').onclick = async e => {
                const btn = e.currentTarget; btn.disabled = true;
                try {
                    if (!pending) {
                        const amount = L.money(body.querySelector('#inflowAmount').value), paidDate = body.querySelector('#inflowDate').value;
                        if (!amount || amount > Number(s.debtAmount)) throw Error('Summa musbat bo‘lishi va qarzdan oshmasligi kerak');
                        if (!L.date(paidDate) || paidDate > L.today()) throw Error('Tushum sanasini to‘g‘ri tanlang');
                        const proof = await collectProof(body, 'debtInflow');
                        pending = { studentId: id, requestKey, amount, paidDate, paidTime: body.querySelector('#inflowTime').value, method: proof.paymentMethod, receiptUrl: proof.receiptUrl, expectedDebt: Number(s.debtAmount) };
                    }
                    const result = await apiFetch('/api/inflow', { method: 'POST', body: JSON.stringify(pending) });
                    cacheProvisionedStudent(result.student); closeModal(); refreshAllDebtorViews();
                    // Refresh lead version/comment after a server-side payment; never overwrite that history with a stale snapshot.
                    apiFetch('/api/leads').then(leads => setCachedItem(STORAGE_KEYS.leads, leads)).catch(() => {});
                    showMiniToast('To‘lov serverga saqlandi');
                    if (document.querySelector('[data-finance-panel="tolovlar"].active')) render();
                } catch (err) { body.querySelector('#inflowError').textContent = err.message + (pending ? ' Qayta urinish shu to‘lovni takroran yozmaydi.' : ''); btn.disabled = false; }
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
            root.innerHTML = `<p>Reyestr tushumi: <strong>${money(data.summary.amount)}</strong> · ${data.summary.count} ta. Joriy qarz: <strong>${data.summary.debt == null ? 'Aniqlanmagan' : money(data.summary.debt)}</strong></p>
                <div class="inflow-table-wrap"><table class="inflow-table"><thead><tr><th>Sana</th><th>Tushum</th><th>Usul</th><th>O‘sha paytdagi qarz</th><th>Chek</th></tr></thead><tbody>${data.history.map(r => `<tr><td>${esc(r.date)} ${esc(r.time)}</td><td>${money(r.paid)}</td><td>${esc(L.METHODS[r.method])}</td><td>${money(r.debt)}</td><td>${proof(r)}</td></tr>`).join('') || '<tr><td colspan="5">Reyestrda tushum yo‘q</td></tr>'}</tbody></table></div>
                <div class="inflow-mobile">${data.history.map(r => `<article class="inflow-payment"><header>${esc(r.date)} ${esc(r.time)}</header><p class="inflow-amount">${money(r.paid)}</p><p>${esc(L.METHODS[r.method])} · Qoldiq: ${money(r.debt)}</p>${proof(r)}</article>`).join('') || '<p>Reyestrda tushum yo‘q</p>'}</div>
                ${data.legacyHistory.length ? `<details class="inflow-review-box"><summary>Tekshirilmagan eski arxiv: ${data.legacyHistory.length} ta</summary><p>Quyidagi yozuvlar yuqoridagi jami summaga qo‘shilmagan; takrorlanishi yoki sana/summasi aniqlashtirilishi mumkin.</p>${data.legacyHistory.map(r => `<p>${esc(r.date || 'Sana yo‘q')} · ${r.paid == null ? 'Summa yo‘q' : money(r.paid)} · ${esc(r.id)}</p>`).join('')}</details>` : ''}`;
        } catch (err) { if (root.isConnected) root.textContent = 'To‘lov tarixini yuklashda xatolik: ' + err.message; }
    }
    function openStudentPayment() {
        const students = getItem(STORAGE_KEYS.students, []).filter(s => Number(s.debtAmount) > 0);
        openModal('Reyestrga to‘lov qabul qilish', `<p>Qarzi mavjud o‘quvchini tanlang. Kurs narxi yoki kitob narxini bu yerda tushum deb kiritmang.</p><select id="ledgerPaymentStudent" class="form-control">${opts(students.map(s => [s.id, s.name]), 'O‘quvchini tanlang')}</select>`, '<button type="button" class="btn-primary-sm" id="ledgerPaymentContinue">Davom etish</button>');
        document.getElementById('ledgerPaymentContinue').onclick = () => { const id = document.getElementById('ledgerPaymentStudent').value; if (id) openPayment(id); };
    }
    window.inflowUI = { render, refreshCash: () => refresh(null), paymentFields, collectProof, openPayment,
        renderHistory, openStudentPayment, cashProjection, renderReconciliation,
        isCashLocked: id => state.decisions.some(d => d.cashId === id),
        cashRows: () => L.cashFlow([...state.rows.english, ...state.rows.russian]) };
})();
