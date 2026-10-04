(function () {
    'use strict';
    const L = PaymentLedger, state = { rows: { english: [], russian: [] }, loaded: false, seq: 0, timer: null, issues: 0, issueList: [] };
    const esc = value => escapeHtml(String(value ?? ''));
    const money = value => Number(value || 0).toLocaleString('en-US').replaceAll(',', ' ') + ' UZS';
    const opts = (items, all) => `<option value="">${all}</option>` + items.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join('');
    function monthDates(month) {
        if (!/^\d{4}-\d{2}$/.test(month)) return null;
        const [y, m] = month.split('-').map(Number);
        return { start: month + '-01', end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
    }
    function filters(root) {
        return Object.fromEntries(['start', 'end', 'search', 'manager', 'teacher', 'tariff', 'method', 'form', 'sort'].map(k => [k, root.querySelector(`[data-inflow="${k}"]`)?.value || '']));
    }
    function rows(root) {
        const f = filters(root);
        return L.filter(state.rows[_financeLang], f).sort((a, b) => f.sort === 'amount-up' ? a.amount - b.amount : f.sort === 'amount-down' ? b.amount - a.amount
            : f.sort === 'date-up' ? a.paidDate.localeCompare(b.paidDate) || a.paidTime.localeCompare(b.paidTime) : b.paidDate.localeCompare(a.paidDate) || b.paidTime.localeCompare(a.paidTime));
    }
    function draw(root) {
        const list = rows(root), summary = L.summary(list), content = root.querySelector('[data-inflow-content]');
        root.querySelector('[data-inflow-kpis]').innerHTML = [['Jami tushum (fakt)', money(summary.amount)], ['Kutilayotgan qoldiq qarz', money(summary.debt)], ['Tranzaksiyalar soni', summary.count]]
            .map(([label, v]) => `<div class="inflow-stat"><span>${label}</span><strong>${v}</strong></div>`).join('');
        root.querySelector('[data-inflow-note]').textContent = 'Har bir tushum alohida. Qoldiq qarz har bir o‘quvchi bo‘yicha bir marta sanaladi.' + (state.issues ? ` Jami ${state.issues} ta eski manba bo‘yicha aniq ma’lumot yetishmaydi yoki takrorlanish ehtimoli bor; moliya tekshirishi kerak.` : '');
        root.querySelector('[data-inflow-issues]').innerHTML = state.issueList.length ? `<details><summary>Tekshirish kerak bo‘lgan eski yozuvlar (${state.issueList.length} tasi)</summary><ul>${state.issueList.map(r => `<li><code>${esc(r.source_key)}</code> — ${esc(r.reason)}</li>`).join('')}</ul><p>Summa/sana taxmin qilinmagan. Manbani tasdiqlamasdan qayta to‘lov kiritmang.</p></details>` : '';
        const cell = r => {
            const proof = r.receiptUrl ? `<a href="${esc(r.receiptUrl)}" target="_blank" rel="noopener">Chekni ko‘rish</a>` : 'Chek yo‘q';
            return proof + (r.legacyReview ? '<small class="inflow-review">Eski ma’lumot — tekshirish kerak</small>' : '');
        };
        const tr = list.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.paidDate)}<small>${esc(r.paidTime || 'Vaqt qayd etilmagan')}</small></td><td>${esc(r.name)}</td><td>${esc(r.phone)}</td><td>${esc(L.TARIFFS[r.tariff] || 'Aniqlanmagan')}</td><td>${esc(L.METHODS[r.method])}</td><td>${r.form === 'full' ? 'To‘liq' : 'Yarim (Zaklad)'}</td><td class="inflow-amount">${money(r.amount)}</td><td>${money(r.debt)}</td><td>${esc(r.nextPaymentDate || '—')}</td><td>${esc(r.managerName || 'Aniqlanmagan')}</td><td>${esc(r.teacherName || 'Aniqlanmagan')}</td><td>${cell(r)}</td></tr>`).join('');
        content.innerHTML = `<div class="inflow-table-wrap"><table class="inflow-table"><thead><tr>${['№', 'Sana / vaqt', 'Ism Familiya', 'Telefon', 'Tarif', 'To‘lov usuli', 'To‘lov shakli', 'To‘lov summasi', 'Qoldiq qarz', 'Keyingi to‘lov', 'Menejer', 'O‘qituvchi', 'Chek'].map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${tr || '<tr><td colspan="13">Tanlangan filtrlar bo‘yicha to‘lov yo‘q</td></tr>'}</tbody><tfoot><tr><td colspan="7">Jami (filtrlangan): ${summary.count} ta</td><td>${money(summary.amount)}</td><td>${money(summary.debt)}</td><td colspan="4">Qarz takroran sanalmaydi</td></tr></tfoot></table></div>
            <div class="inflow-mobile">${list.map(r => `<article class="inflow-payment"><header><strong>${esc(r.name)}</strong><span>${esc(r.paidDate)} ${esc(r.paidTime)}</span></header><p>${esc(r.phone)}</p><div class="inflow-amount">${money(r.amount)} <span>${esc(L.METHODS[r.method])}</span></div><dl><dt>Menejer</dt><dd>${esc(r.managerName || '—')}</dd><dt>Ustoz</dt><dd>${esc(r.teacherName || '—')}</dd><dt>Tarif</dt><dd>${esc(L.TARIFFS[r.tariff] || '—')}</dd><dt>To‘lov</dt><dd>${r.form === 'full' ? 'To‘liq' : 'Yarim (Zaklad)'}</dd><dt>Qoldiq qarz</dt><dd>${money(r.debt)}</dd><dt>Keyingi to‘lov</dt><dd>${esc(r.nextPaymentDate || '—')}</dd></dl>${cell(r)}</article>`).join('') || '<p>To‘lovlar topilmadi</p>'}<div class="inflow-mobile-summary">Jami: ${money(summary.amount)} · Qarz: ${money(summary.debt)} · ${summary.count} ta</div></div>`;
    }
    function fillPeople(root) {
        for (const kind of ['manager', 'teacher']) {
            const el = root.querySelector(`[data-inflow="${kind}"]`), selected = el.value;
            const values = new Map(state.rows[_financeLang].filter(r => r[kind + 'Id']).map(r => [r[kind + 'Id'], r[kind + 'Name'] || r[kind + 'Id']]));
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
            const results = await Promise.all(['english', 'russian'].map(language => apiFetch('/api/inflow?language=' + language)));
            if (seq !== state.seq) return;
            state.rows = { english: results[0].records, russian: results[1].records }; state.loaded = true; state.issues = results[0].migrationIssueCount; state.issueList = results[0].migrationIssues || [];
            if (root) { fillPeople(root); draw(root); }
            if (msg) msg.textContent = '';
            if (document.querySelector('[data-finance-panel="cashflow"].active')) renderCashFlow();
        } catch (e) { if (seq === state.seq && msg) msg.textContent = 'Yuklashda xatolik: ' + e.message; }
    }
    function mount(root) {
        if (root.dataset.inflowMounted) return;
        root.dataset.inflowMounted = '1';
        const month = L.today().slice(0, 7), period = monthDates(month);
        root.innerHTML = `<div class="inflow-toolbar"><h2>To‘lovlar</h2><button type="button" class="btn-secondary-sm" data-inflow-refresh>Yangilash</button><button type="button" class="btn-primary-sm" data-inflow-export>Excelga yuklash (.xlsx)</button></div>
            <div class="inflow-kpis" data-inflow-kpis></div><div class="inflow-filters">
            <label>Oy<input type="month" data-inflow="month" value="${month}"></label><label>Boshlanish<input type="date" data-inflow="start" value="${period.start}"></label><label>Tugash<input type="date" data-inflow="end" value="${period.end}"></label>
            <div class="inflow-quick">${[['today', 'Bugun'], ['yesterday', 'Kecha'], ['month', 'Joriy oy']].map(([v, t]) => `<button type="button" class="btn-secondary-sm" data-inflow-quick="${v}">${t}</button>`).join('')}</div>
            <label class="inflow-search">Ism yoki telefon<input type="search" data-inflow="search" placeholder="Ism yoki telefon raqami" autocomplete="off" data-lpignore="true" data-1p-ignore="true"></label>
            <label>Menejer<select data-inflow="manager"></select></label><label>Ustoz<select data-inflow="teacher"></select></label><label>Tarif<select data-inflow="tariff">${opts(Object.entries(L.TARIFFS), 'Barcha tariflar')}</select></label><label>Usul<select data-inflow="method">${opts(Object.entries(L.METHODS), 'Barcha usullar')}</select></label>
            <label>To‘lov shakli<select data-inflow="form">${opts([['full', 'To‘liq'], ['partial', 'Yarim (Zaklad)']], 'Barchasi')}</select></label><label>Saralash<select data-inflow="sort">${[['date-down', 'Sana: yangi → eski'], ['date-up', 'Sana: eski → yangi'], ['amount-down', 'Summa: katta → kichik'], ['amount-up', 'Summa: kichik → katta']].map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label></div>
            <p class="text-muted" data-inflow-note></p><div data-inflow-issues></div><p role="status" data-inflow-message></p><div data-inflow-content></div>`;
        root.querySelector('[data-inflow="month"]').onchange = e => { const p = monthDates(e.target.value); if (!p) return; root.querySelector('[data-inflow="start"]').value = p.start; root.querySelector('[data-inflow="end"]').value = p.end; draw(root); };
        root.querySelectorAll('[data-inflow]').forEach(el => { if (el.dataset.inflow !== 'month') el.addEventListener(el.type === 'search' ? 'input' : 'change', () => draw(root)); });
        root.querySelectorAll('[data-inflow-quick]').forEach(btn => { btn.onclick = () => {
            const now = L.today(), d = new Date(now + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1);
            const p = btn.dataset.inflowQuick === 'month' ? monthDates(now.slice(0, 7)) : { start: btn.dataset.inflowQuick === 'today' ? now : d.toISOString().slice(0, 10), end: btn.dataset.inflowQuick === 'today' ? now : d.toISOString().slice(0, 10) };
            root.querySelector('[data-inflow="month"]').value = btn.dataset.inflowQuick === 'month' ? now.slice(0, 7) : '';
            root.querySelector('[data-inflow="start"]').value = p.start; root.querySelector('[data-inflow="end"]').value = p.end; draw(root);
        }; });
        root.querySelector('[data-inflow-refresh]').onclick = () => refresh(root);
        root.querySelector('[data-inflow-export]').onclick = async () => {
            try {
                await loadXlsxLib();
                const list = rows(root), sum = L.summary(list), str = v => /^[=+@-]/.test(String(v || '')) ? "'" + v : String(v || '');
                const sheet = XLSX.utils.aoa_to_sheet([['№', 'Sana', 'Vaqt', 'Ism Familiya', 'Telefon', 'Tarif', 'To‘lov usuli', 'To‘lov', 'To‘lov summasi (UZS)', 'Qoldiq qarz (UZS)', 'Keyingi to‘lov', 'Menejer', 'O‘qituvchi', 'Tekshirish', 'Chek'],
                    ...list.map((r, i) => [i + 1, r.paidDate, r.paidTime, str(r.name), str(r.phone), L.TARIFFS[r.tariff] || '', L.METHODS[r.method], r.form === 'full' ? 'To‘liq' : 'Yarim', r.amount, r.debt, r.nextPaymentDate, str(r.managerName), str(r.teacherName), r.legacyReview ? 'Tekshirish kerak' : '', r.receiptUrl]),
                    ['Jami (qarz o‘quvchi bo‘yicha 1 marta)', '', '', '', '', '', '', '', sum.amount, sum.debt]]);
                sheet['!cols'] = [6, 14, 10, 26, 20, 22, 18, 14, 23, 23, 16, 26, 26, 24, 40].map(wch => ({ wch }));
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
    window.inflowUI = { render, refreshCash: () => refresh(null), paymentFields, collectProof, openPayment,
        cashRows: () => L.cashFlow([...state.rows.english, ...state.rows.russian]) };
})();
