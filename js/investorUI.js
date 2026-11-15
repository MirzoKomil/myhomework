// Moliya › Investor (15-noyabr, D dizayn K_investor / K_invKab): rahbar — sozlash, to'lov, tuzatish;
// investor roli — faqat ko'rish kabineti. Hamma raqam serverda (/api/investor) hisoblanadi.
(function () {
    'use strict';
    const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktabr', 'Noyabr', 'Dekabr'];
    const SHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
    const ENT = { russian: 'Rus tili', english: 'Ingliz tili', all: 'Ikkala maktab' };
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const num = n => (Number(n) < 0 ? '−' : '') + String(Math.abs(Math.round(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const mName = m => MONTHS[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4);
    const mShort = m => SHORT[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4);
    const dText = d => (d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '—');
    const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
    const toast = msg => (typeof showMiniToast === 'function' ? showMiniToast(msg, 3500) : alert(msg));
    const state = { data: null, error: '', preview: false, loading: false };
    const root = () => document.getElementById('investorRoot');
    const api = (path, body, method) => apiFetch('/api/investor' + path, body === undefined ? { timeout: 60000 } : { method: method || 'POST', body: JSON.stringify(body), timeout: 60000 });

    function statusChip(r) {
        if (r.status === 'future') return '<span class="fin-dchip fin-dchip--muted">kelajak</span>';
        if (r.status === 'estimate_open') return '<span class="fin-dchip">taxminiy · oy tugamagan</span>';
        if (r.status === 'estimate_unclosed') return '<span class="fin-dchip">taxminiy · oy yopilmagan</span>';
        const paidOn = (state.data?.payments || []).filter(p => p.month === r.month && !p.reversesId && !p.reversed).map(p => p.date).sort().at(-1);
        if (r.payState === 'overpaid') return `<span class="fin-dchip fin-dchip--bad">Ortiqcha to‘langan · ${num(r.overpaid)}</span>`;
        const pay = r.payState === 'paid' ? `<span class="fin-dchip fin-dchip--ok">To‘landi${paidOn ? ' · ' + paidOn.slice(8, 10) + '.' + paidOn.slice(5, 7) : ''}</span>` : r.payState === 'partial' ? `<span class="fin-dchip">Qisman · ${num(r.paid)}</span>`
            : r.payState === 'none' ? `<span class="fin-dchip fin-dchip--muted">${r.base < 0 ? 'Zarar' : 'Foyda yo‘q'} · ulush 0</span>` : '<span class="fin-dchip fin-dchip--info">Yopilgan · to‘lanmagan</span>';
        return pay;
    }
    function view(d, readOnly) {
        const inv = d.investor, t = d.totals, rows = d.rows;
        const last = rows.filter(r => r.status === 'final').at(-1), unpaid = rows.filter(r => r.status === 'final' && r.due > 0);
        const startR = rows[0]?.month, endR = rows.at(-1)?.month;
        const future = rows.filter(r => r.status === 'future');
        const visible = rows.filter(r => r.status !== 'future');
        const lastPaid = d.payments.filter(p => !p.reversesId && !p.reversed).at(-1);
        const tiles = `<div class="fin-dtile fin-inv-main" style="cursor:default"><span class="fin-dlbl">Investorga tegishli · yakuniy</span><span class="fin-dbig fin-inv-big">${num(t.finalShare)} so‘m</span><span class="fin-dnote">Taxminiy bilan (joriy oy): ${num(t.withEstimate)}</span></div>
            <div class="fin-inv4">
            <div class="fin-dtile" style="cursor:default"><span class="fin-dlbl">Ulush</span><span class="fin-dmid">${esc(String(inv.sharePct).replace('.', ','))}%</span><span class="fin-dnote">Sof foydadan har oy</span></div>
            <div class="fin-dtile" style="cursor:default"><span class="fin-dlbl">Muddat</span><span class="fin-dmid">${t.elapsed}/${inv.termMonths} oy</span><span class="fin-dnote">${startR ? mShort(startR) + ' – ' + mShort(endR) : ''} · yopilgan: ${t.closedCount}</span></div>
            <div class="fin-dtile" style="cursor:default"><span class="fin-dlbl">To‘langan</span><span class="fin-dmid">${num(t.paid)}</span><span class="fin-dnote">${lastPaid ? MONTHS[Number(lastPaid.month.slice(5, 7)) - 1] : last ? 'hali to‘lanmagan' : 'hali yopilgan oy yo‘q'}</span></div>
            <div class="fin-dtile" style="cursor:default"><span class="fin-dlbl">Qoldiq</span><span class="fin-dmid ${t.due ? 'neg' : ''}">${num(t.due)}</span><span class="fin-dnote">${unpaid.length ? unpaid.map(r => MONTHS[Number(r.month.slice(5, 7)) - 1] + (r.payState === 'partial' ? ' — qisman' : ' — to‘lanmagan')).join(', ') : 'qarz yo‘q'}</span></div></div>`;
        const head = ['Oy', { l: 'Sof foyda', n: 1 }, { l: `Ulush ${String(inv.sharePct).replace('.', ',')}%`, n: 1 }, { l: 'Holat' }, ...(readOnly ? [] : [{ l: 'Amal' }])];
        const trs = visible.map(r => `<tr><td><button type="button" class="fin-link" data-inv-month="${r.month}">${mName(r.month)}</button>${r.status === 'final' && r.closedOn ? `<small>Oy yopildi: ${dText(r.closedOn)}${r.closedBy ? ' · Tasdiqladi: ' + esc(r.closedBy) : ''}</small>` : ''}</td>
            <td class="num ${r.base < 0 ? 'neg' : ''}">${num(r.base)}</td><td class="num">${num(r.share)}</td><td>${statusChip(r)}</td>
            ${readOnly ? '' : `<td>${r.status === 'final' && r.due > 0 ? `<button type="button" class="btn-ghost btn-sm" data-inv-pay="${r.month}">To‘landi deb belgilash</button>` : ''}</td>`}</tr>`);
        if (future.length) trs.push(`<tr class="fin-inv-future"><td>${mShort(future[0].month)} – ${mShort(future.at(-1).month)} · ${future.length} oy</td><td class="num">—</td><td class="num">—</td><td><span class="fin-dchip fin-dchip--muted">kelajak</span></td>${readOnly ? '' : '<td></td>'}</tr>`);
        const table = `<div class="fin-table-wrap" role="region" aria-label="Oylar" tabindex="0"><table class="fin-table"><thead><tr>${head.map(h => `<th scope="col" ${h.n ? 'class="num"' : ''}>${esc(h.l || h)}</th>`).join('')}</tr></thead><tbody>${trs.join('')}</tbody></table></div>`;
        // Telefon (T_investor): oylar — kartalar ro'yxati.
        const plist = `<div class="fin-dcard" style="cursor:default">${visible.map(r => `<div class="fin-drow"><span><button type="button" class="fin-link" data-inv-month="${r.month}"><b>${mName(r.month)}</b></button>${r.status === 'final' && r.closedOn ? `<small>Oy yopildi: ${dText(r.closedOn)}${r.closedBy ? ' · Tasdiqladi: ' + esc(r.closedBy) : ''}</small>` : ''}<small>Sof foyda ${num(r.base)}</small>${statusChip(r)}</span><span><strong>${num(r.share)}</strong>${!readOnly && r.status === 'final' && r.due > 0 ? `<button type="button" class="fin-link" data-inv-pay="${r.month}">To‘landi deb belgilash</button>` : ''}</span></div>`).join('')}
            ${future.length ? `<div class="fin-drow"><span><b>${mShort(future[0].month)} – ${mShort(future.at(-1).month)}</b><small>${future.length} oy · kelajak</small></span><span>—</span></div>` : ''}</div>`;
        const pays = d.payments.filter(p => readOnly || (!p.reversesId));
        const payList = `<section class="fin-card"><header><h3>${readOnly ? 'To‘lovlar' : 'Investorga to‘lovlar'}</h3></header>${pays.length ? `<div class="fin-dlist">${pays.map(p => `<div class="fin-drow"><span><b>${mName(p.month).split(' ')[0]} ulushi</b><small>${dText(p.date)}${p.method ? ' · ' + esc(p.method) : ''}${p.reversed ? ' · <span class="fin-dchip fin-dchip--muted">bekor qilingan</span>' : ''}</small></span><span><strong>${num(p.amount)}</strong>${readOnly || p.reversed ? '' : `<button type="button" class="fin-link" data-inv-fix="${esc(p.id)}">Tuzatish / bekor qilish</button>`}</span></div>`).join('')}</div>` : '<p class="fin-dnote">Hali to‘lov yo‘q</p>'}
            ${!readOnly && d.payments.some(p => p.reversesId) ? `<details class="fin-details"><summary>Tuzatishlar tarixi</summary><div class="fin-dlist">${d.payments.filter(p => p.reversesId).map(p => `<div class="fin-drow"><span><b>Bekor qilindi · ${mName(p.month)}</b><small>${dText(p.date)} · ${esc(p.reason)} · ${esc(p.actorName || '')}</small></span><span><strong>−${num(p.amount)}</strong></span></div>`).join('')}</div></details>` : ''}</section>`;
        const note = readOnly ? '<p class="fin-note">Faqat ko‘rish. Joriy oy — taxminiy. Xodimlar maoshi, boshqa bo‘limlar ko‘rinmaydi.</p>'
            : `<p class="fin-note">Sof foyda = ${esc(inv.basisLabel)} (tushum − qaytarishlar − hisoblangan oylik − xarajat${inv.basis === 'before_tax' ? ', soliqlar qo‘shib qaytariladi' : ''}). Faqat yopilgan oylar yakuniy; joriy oy taxminiy. Zarar oyida ulush 0; zarar keyingi oyga o‘tkazilmaydi. Ulush har oy, oy yopilgandan keyin to‘lanadi.</p>`;
        return tiles + `<div class="fin-donly">${table}</div><div class="fin-ponly">${plist}</div>` + payList + note;
    }
    function render() {
        const r = root();
        if (!r) return;
        investorNav();
        if (!state.data && !state.loading) { load(); }
        if (!state.data) { r.innerHTML = state.error ? `<div class="fin-wrap"><div class="fin-alert fin-alert--danger" role="alert"><span>${esc(state.error)}</span><button type="button" class="btn-ghost" data-inv-retry>Qayta urinish</button></div></div>` : '<div class="fin-wrap"><div class="fin-loading" role="status">Hisob-kitob qilinmoqda…</div></div>'; r.querySelector('[data-inv-retry]')?.addEventListener('click', () => { state.error = ''; load(); }); return; }
        const d = state.data, readOnly = !!d.readOnly || state.preview || !d.user?.director, inv = d.investor;
        const curName = MONTHS[Number(today().slice(5, 7)) - 1] + ' ' + today().slice(0, 4);
        if (d.readOnly) {
            document.body.classList.add('inv-cabinet');
            // Telefon yuklanish oynasi (#teamSplash) pastki Jamoa menyusini kutadi — investorda u qurilmaydi, shu yerda yopamiz.
            const sp = document.getElementById('teamSplash');
            if (sp) { sp.classList.add('out'); setTimeout(() => sp.remove(), 300); }
        }
        r.innerHTML = `<div class="fin-wrap">${d.readOnly ? `<div class="fin-invcab-h"><small>Faqat ko‘rish · ${curName} · ${esc(ENT[inv.entity] || '')}</small><div class="fin-dtitle" role="heading" aria-level="1">Investor kabineti</div></div>` : '<div data-inv-periodrow></div>'}<div class="fin-dhead fin-invhead"${d.readOnly ? ' style="display:none"' : ''}><div class="fin-dtitle" role="heading" aria-level="2">${readOnly && d.readOnly ? 'Investor kabineti' : 'Investor · ' + esc(inv.name || '—')}${readOnly ? ' <span class="fin-dchip fin-dchip--muted">faqat ko‘rish</span>' : ''} <span class="fin-dchip fin-dchip--info">${esc(ENT[inv.entity] || '')}</span></div>
            <span style="flex:1"></span>${d.readOnly || !d.user?.director ? '' : `<span class="fin-invbtns"><button type="button" class="fin-qbtn" data-inv-settings>Shartnoma sozlamalari</button><button type="button" class="fin-qbtn" data-inv-preview aria-pressed="${state.preview}">${state.preview ? 'Rahbar ko‘rinishi' : 'Kabinetni ko‘rish'}</button></span>`}</div>
            ${view(d, readOnly)}</div>`;
        // Moliya davr qatori (K_investor): investor jadvali oylar bo'yicha, davr tanlovi faqat umumiy sarlavha uchun.
        window.financeUI?.mountPeriodRow?.(r.querySelector('[data-inv-periodrow]'));
        r.querySelector('[data-inv-settings]')?.addEventListener('click', openSettings);
        r.querySelector('[data-inv-preview]')?.addEventListener('click', () => { state.preview = !state.preview; render(); });
        r.querySelectorAll('[data-inv-month]').forEach(b => b.addEventListener('click', () => openMonth(b.dataset.invMonth)));
        r.querySelectorAll('[data-inv-pay]').forEach(b => b.addEventListener('click', () => openPay(b.dataset.invPay)));
        r.querySelectorAll('[data-inv-fix]').forEach(b => b.addEventListener('click', () => openFix(b.dataset.invFix)));
    }
    async function load() {
        state.loading = true;
        try { state.data = await api(''); state.error = ''; } catch (e) { state.error = e.message; state.data = null; }
        state.loading = false;
        if (typeof _tabContext === 'undefined' || _tabContext.financeSection === 'investor') render();
        if (typeof updateRdPageHead === 'function') updateRdPageHead('finance');
    }
    function reload() {
        state.data = null; load(); render();
        // To'lov kassadan chiqim yaratadi — Moliya raqamlari va Muammolar soni qayta hisoblanadi (son yo'qolmaydi).
        window.financeUI?.invalidate?.(); window.financeUI?.refreshProblemCount?.();
    }
    // Investor roli (telefon, T_invKab): pastki menyuda faqat "Investor".
    function investorNav() {
        if (document.querySelector('.inv-bottomnav') || getCurrentUser?.()?.role !== 'investor') return;
        const n = document.createElement('nav'); n.className = 'inv-bottomnav'; n.setAttribute('aria-label', 'Pastki menyu');
        n.innerHTML = '<button type="button" aria-current="page"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span>Investor</span></button>';
        document.body.appendChild(n);
    }
    const field = (label, html) => `<label class="fin-field"><span>${label}</span>${html}</label>`;
    function modal(title, body, action, onSubmit) {
        openModal(title, `<div class="fin-form">${body}<p class="fin-error" role="alert" data-inv-error></p></div>`,
            `<button type="button" class="btn-secondary-sm" data-inv-cancel>Bekor qilish</button><button type="button" class="btn-primary-sm" data-inv-ok>${action}</button>`);
        const mb = document.getElementById('modalBody'), foot = document.getElementById('modalFooter');
        foot.querySelector('[data-inv-cancel]')?.addEventListener('click', closeModal);
        const ok = foot.querySelector('[data-inv-ok]');
        ok?.addEventListener('click', async () => {
            ok.disabled = true;
            try { await onSubmit(n => mb.querySelector(`[name="${n}"]`)?.value ?? ''); closeModal(); reload(); }
            catch (e) { mb.querySelector('[data-inv-error]').textContent = e.message; }
            finally { ok.disabled = false; }
        });
    }
    function openSettings() {
        const inv = state.data.investor, acc = state.data.account;
        modal('Shartnoma sozlamalari', `
            ${field('Investor ismi', `<input class="form-control" name="name" maxlength="120" value="${esc(inv.name)}">`)}
            <div class="fin-form-row">${field('Ulush (%)', `<input type="number" class="form-control" name="sharePct" min="0" max="100" step="0.01" value="${inv.sharePct}">`)}
            ${field('Boshlanish oyi', `<input type="month" class="form-control" name="startMonth" value="${esc(inv.startMonth)}">`)}
            ${field('Muddat (oy)', `<input type="number" class="form-control" name="termMonths" min="1" max="120" value="${inv.termMonths}">`)}</div>
            <div class="fin-form-row">${field('Hisob asosi', `<select class="form-control" name="basis">${Object.entries(state.data.bases).map(([k, l]) => `<option value="${k}" ${k === inv.basis ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`)}
            ${field('Yo‘nalish', `<select class="form-control" name="entity">${Object.entries(ENT).map(([k, l]) => `<option value="${k}" ${k === inv.entity ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
            <p class="fin-note">Zarar oyida ulush 0; zarar keyingi oyga o‘tkazilmaydi. Yopilgan oylar natijasi o‘zgarmaydi.</p>
            <h4>Investor kabineti (kirish)</h4>${acc ? `<p class="fin-dnote">Hozirgi login: <b>${esc(acc.login)}</b>${acc.active ? '' : ' · faol emas'}</p>` : '<p class="fin-dnote">Kirish hisobi hali yaratilmagan.</p>'}
            <div class="fin-form-row">${field('Login (telefon)', `<input class="form-control" name="login" autocomplete="off" value="${esc(acc?.login || '')}">`)}${field(acc ? 'Yangi parol (ixtiyoriy)' : 'Parol', '<input type="password" class="form-control" name="password" autocomplete="new-password">')}</div>`,
        'Saqlash', async v => {
            await api('/settings', { name: v('name'), sharePct: Number(v('sharePct')), startMonth: v('startMonth'), termMonths: Number(v('termMonths')), basis: v('basis'), entity: v('entity'), revision: inv.revision }, 'PUT');
            if (v('login') && (v('login') !== acc?.login || v('password'))) await api('/account', { name: v('name'), login: v('login'), password: v('password') });
            toast('Sozlamalar saqlandi');
        });
    }
    // Investor to'lovi kassadan chiqim (OWNER_OUT) sifatida yoziladi: hisob va chek/hujjat majburiy.
    async function accountsHtml() {
        try {
            const o = await apiFetch('/api/finance/overview?lite=1');
            return `<select class="form-control" name="accountId">${(o.accounts || []).filter(a => a.active !== false && ['cash', 'card', 'bank', 'wallet'].includes(a.kind)).map(a => `<option value="${esc(a.id)}" data-balance="${Number(a.balance) || 0}">${esc(a.name)}</option>`).join('')}</select><p class="fin-error" data-inv-overdraft aria-live="polite"></p>`;
        } catch (e) { return `<p class="fin-error">${esc(e.message)}</p>`; }
    }
    async function uploadDoc(input) {
        const file = input?.files?.[0];
        if (!file) throw new Error('Chek yoki hujjatni yuklang (PDF yoki rasm)');
        const t = typeof getToken === 'function' ? getToken() : '';
        const form = new FormData(); form.append('file', file);
        const res = await fetch('/api/finance/evidence', { method: 'POST', headers: t ? { Authorization: 'Bearer ' + t } : {}, body: form });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || 'Hujjatni yuklab bo‘lmadi');
        return d.url;
    }
    // Hisobda pul yetmasa — to'lov bloklanmaydi (egasi qarori), faqat ogohlantiriladi va Muammolar'da "Hisob manfiy" chiqadi.
    function wireOverdraft() {
        const mb = document.getElementById('modalBody'), sel = mb.querySelector('[name="accountId"]'), amt = mb.querySelector('[name="amount"]'), out = mb.querySelector('[data-inv-overdraft]');
        if (!sel || !amt || !out) return;
        const check = () => {
            const bal = Number(sel.selectedOptions[0]?.dataset.balance || 0), a = Number(String(amt.value).replace(/\D/g, '')) || 0;
            out.textContent = a > bal ? `Kassada yetarli emas: qoldiq ${num(bal)} so‘m. To‘lov baribir yoziladi — hisob manfiy bo‘ladi (Muammolar’da ko‘rinadi).` : '';
        };
        sel.addEventListener('change', check); amt.addEventListener('input', check); check();
    }
    const docField = () => field('Chek / hujjat (majburiy)', '<input type="file" class="form-control" name="doc" accept=".pdf,.png,.jpg,.jpeg,.webp">');
    async function openPay(month) {
        const acc = await accountsHtml();
        const r = state.data.rows.find(x => x.month === month);
        modal(`To‘landi deb belgilash · ${mName(month)}`, `<p class="fin-dnote">Ulush: <b>${num(r.share)} so‘m</b> · to‘langan ${num(r.paid)} · qoldiq ${num(r.due)}</p>
            <div class="fin-form-row">${field('Summa (so‘m)', `<input class="form-control" name="amount" inputmode="numeric" value="${r.due}">`)}${field('Sana', `<input type="date" class="form-control" name="paidDate" value="${today()}" max="${today()}">`)}</div>
            ${field('Qaysi hisobdan', acc)}${field('Izoh', '<input class="form-control" name="note" maxlength="300">')}${docField()}
            <p class="fin-note">Qisman to‘lash mumkin — qolgani “Qoldiq”da turadi. Kassadan chiqim (ta’sischi/investorga to‘lov) avtomatik yoziladi.</p>`,
        'Saqlash', async v => {
            const sel = document.querySelector('#modalBody [name="accountId"]');
            await api('/payments', { month, amount: v('amount').replace(/\D/g, ''), paidDate: v('paidDate'), accountId: v('accountId'), method: sel?.selectedOptions[0]?.textContent || '', note: v('note'), receiptUrl: await uploadDoc(document.querySelector('#modalBody [name="doc"]')) });
            toast(`To‘lov saqlandi · ${num(v('amount').replace(/\D/g, ''))} so‘m`);
        });
        wireOverdraft();
    }
    async function openFix(id) {
        const p = state.data.payments.find(x => x.id === id), acc = await accountsHtml();
        modal(`Tuzatish / bekor qilish · ${mName(p.month)} · ${num(p.amount)}`, `
            ${field('Sabab (majburiy)', '<textarea class="form-control" name="reason" rows="2" placeholder="Masalan: summa xato kiritilgan"></textarea>')}
            ${field('To‘g‘ri summa (bo‘sh qoldirilsa — faqat bekor qilinadi)', '<input class="form-control" name="amount" inputmode="numeric">')}
            <div data-inv-fixnew hidden>${field('Qaysi hisobdan', acc)}${docField()}</div>
            <p class="fin-note">Yozuv o‘chirilmaydi — teskari yozuv qo‘shiladi va tarixda qoladi; kassadagi chiqim ham storno qilinadi. Tuzatish = bekor qilish + to‘g‘ri summa bilan yangi yozuv.</p>`,
        'Tasdiqlash', async v => {
            const amount = v('amount').replace(/\D/g, '');
            await api('/payments/' + encodeURIComponent(id) + '/reverse', { reason: v('reason'), amount: amount || null, accountId: amount ? v('accountId') : undefined,
                method: amount ? document.querySelector('#modalBody [name="accountId"]')?.selectedOptions[0]?.textContent || '' : undefined, receiptUrl: amount ? await uploadDoc(document.querySelector('#modalBody [name="doc"]')) : undefined });
            toast('Saqlandi');
        });
        const amt = document.querySelector('#modalBody [name="amount"]');
        amt?.addEventListener('input', () => { document.querySelector('#modalBody [data-inv-fixnew]').hidden = !amt.value.trim(); });
        wireOverdraft();
    }
    async function openMonth(month) {
        let d;
        try { d = await api('/months/' + month); } catch (e) { toast(e.message); return; }
        const r = d.row, inv = d.investor;
        const kv = (l, v, cls = '') => `<div class="fin-dkv"><span>${l}</span><strong class="${cls}">${v}</strong></div>`;
        openModal(mName(month), `<div class="fin-form">${statusChip(r)}
            ${r.status === 'future' ? '<p class="fin-dnote">Oy hali boshlanmagan</p>' : `
            ${kv('Jami tushum (qaytarishlar ayirilgan)', num(r.revenue))}${kv('− Hisoblangan oylik', num(r.payroll))}
            ${(r.groups || []).map(g => `<div class="fin-dkv"><span class="sub">└ ${esc(g.label)}</span><strong>${num(g.accrued)}</strong></div>`).join('')}
            ${kv('− Xarajatlar', num(r.expenses))}${inv.basis === 'before_tax' && r.taxes ? kv('+ Soliqlar (asosga kirmaydi)', num(r.taxes)) : ''}
            ${kv('Sof foyda (asos)', num(r.base), r.base < 0 ? 'neg' : '')}${kv(`Investor ulushi ${String(r.sharePct).replace('.', ',')}%`, num(r.share))}
            ${r.status === 'final' ? kv('To‘langan', num(r.paid)) : ''}`}
            <p class="fin-note">Hisoblangan oylik — guruhlar yig‘indisi; har bir xodim maoshi investorga ko‘rinmaydi. ${r.status === 'final' ? 'Oy yopilgan — natija yakuniy.' : 'Oy yopilgach yakuniy bo‘ladi.'} Zarar bo‘lsa ulush 0.</p></div>`,
        '<button type="button" class="btn-secondary-sm" onclick="closeModal()">Yopish</button>');
    }
    // Investor kabineti sarlavhasi uchun: biriktirilgan maktab (til almashtirgich investorda yo'q).
    const schoolLabel = () => (state.data ? ENT[state.data.investor.entity] || '' : '');
    window.investorUI = { render, reload, schoolLabel };
})();
