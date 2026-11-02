// Sotuv menejeri kompyuter kabineti — "Qarzdorlar" sahifasi va "Muddatni surish soʻrovi" oqimi. Dizayn: SotK_Debtors.
// Asl renderDebtorsTable / openDebtorMenu (js/app.js) mantiqi o'zgarmaydi: ro'yxat, filtrlar, tezkor filtr, To'lov qabul
// qilish (inflowUI) — hammasi asl funksiyalarda. Bu fayl faqat sotuv menejeri + >900px (body.sot-desk-v2) da:
//  · sahifa sarlavhasi (sotDeskPages), "Ustoz · dars · tarif" ustuni (menejer ustuni — hamma qatorda o'z ismi edi),
//    "Tozalash" tugmasi va noto'g'ri sana oralig'i ogohlantirishi;
//  · ⋯ menyusidagi "Qarz tahrirlash" o'rniga "Muddatni surish soʻrovi" — PATCH /api/state sotuv menejeridan hech narsa
//    qabul qilmaydi, shuning uchun yangi sana/izoh/eslatma POST /api/school/students/:id/edit orqali so'rov (kind='due')
//    bo'lib ketadi, ROP yoki admin tasdiqlaydi (server/services/school/studentOps.js);
//  · kutilayotgan so'rovlar GET /api/school/edit-requests (sotuv menejeriga faqat o'z so'rovlari) — qatorda
//    "Surish soʻrovi kutilmoqda" belgisi.
(function () {
    'use strict';
    const SP = window.sotDeskPages; if (!SP) return;
    const U = SP.U, esc = U.esc, g = U.g;
    window.sotDesk = window.sotDesk || {};
    const HOST_ID = 'salesPanel-debtors';
    const on = () => U.isSotDesk();
    const WD = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
    const p2 = n => String(n).padStart(2, '0');
    const todayIso = () => { const t = new Date(Date.now() + 5 * 3600000); return t.toISOString().slice(0, 10); };
    const todayTxt = () => { const d = new Date(); return `${WD[d.getDay()]}, ${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`; };
    const dShort = d => (d ? `${String(d).slice(8, 10)}.${String(d).slice(5, 7)}.${String(d).slice(0, 4)}` : '—');
    const TARIFF = { standard: 'Standard', premium: 'Premium', vip: 'VIP', start: 'Start' };
    const tariffLabel = t => TARIFF[String(t || 'standard').toLowerCase()] || String(t);
    const students = () => (g('getItem') ? getItem(STORAGE_KEYS.students, []) : []);
    const studentOf = id => students().find(s => String(s.id) === String(id)) || null;
    const teacherName = id => (window.schoolUI?.teacherName ? window.schoolUI.teacherName(id) : '—') || '—';
    const schoolApi = (path, opts) => (window.schoolUI?.api ? window.schoolUI.api(path, opts) : apiFetch('/api/school' + path, opts));

    // ---- Kutilayotgan "due" so'rovlar (o'quvchi id → so'rov) ----
    const REQ = { map: new Map(), at: 0, p: null };
    function loadRequests(force = false) {
        if (!on()) return Promise.resolve(REQ.map);
        if (REQ.p) return REQ.p;
        if (!force && Date.now() - REQ.at < 60000) return Promise.resolve(REQ.map);
        REQ.p = schoolApi('/edit-requests', { fresh: true }).then(r => {
            const m = new Map();
            for (const x of (r?.requests || [])) if (x.kind === 'due' && x.status === 'pending' && !m.has(x.student_id)) m.set(x.student_id, x);
            REQ.map = m; REQ.at = Date.now();
            return m;
        }).catch(e => { console.warn('[sotDesk debt] so\'rovlar yuklanmadi', e?.message); REQ.at = Date.now(); return REQ.map; })
            .finally(() => { REQ.p = null; });
        return REQ.p;
    }
    const changesOf = r => (typeof r?.changes === 'string' ? (() => { try { return JSON.parse(r.changes); } catch { return {}; } })() : r?.changes || {});

    // ---- Jadvalni bezash (har renderDebtorsTable dan keyin) ----
    function decorate() {
        const host = document.getElementById(HOST_ID);
        if (!host || !on()) return;
        const wrap = host.querySelector('.debtors-wrap'); if (!wrap) return;
        // Ustun: "Menejer · ustoz" → "Ustoz · dars · tarif" (sotuvda hamma qatorda o'z ismi — ma'nosiz edi).
        const th = wrap.querySelectorAll('.dbx-table thead th')[2];
        if (th) th.textContent = 'Ustoz · dars · tarif';
        wrap.querySelectorAll('.dbx-table tbody tr').forEach(tr => {
            const sid = tr.querySelector('.debtors-dot-menu-btn')?.dataset.sid;
            const st = sid && studentOf(sid); if (!st) return;
            tr.dataset.sid = sid;
            const td = tr.cells[2];
            if (td && !td.dataset.sdd) {
                td.dataset.sdd = '1';
                td.innerHTML = `<div class="stx-main">${esc(teacherName(st.teacherId))}</div><div class="stx-sub">${esc(String(st.lessonDuration || 15))} daq · ${esc(tariffLabel(st.tariff))}</div>`;
            }
            const menuBtn = tr.querySelector('.debtors-dot-menu-btn');
            if (menuBtn) { menuBtn.setAttribute('aria-label', `${st.name || ''} — amallar`); menuBtn.setAttribute('aria-haspopup', 'menu'); menuBtn.setAttribute('aria-expanded', 'false'); }
            paintPending(tr, sid);
        });
        // "Tozalash" va noto'g'ri sana oralig'i.
        const fl = wrap.querySelector('.debtors-filters');
        const anyF = (typeof _debtorsTeacherFilter !== 'undefined') && (_debtorsTeacherFilter !== 'all' || _debtorsTariffFilter !== 'all' || !!_debtorsDateFrom || !!_debtorsDateTo);
        if (fl) {
            fl.querySelectorAll('select:not([hidden])').forEach(s => s.classList.toggle('sdd-act', s.value !== 'all'));
            if (anyF && !fl.querySelector('.sdd-x')) {
                const b = document.createElement('button'); b.type = 'button'; b.className = 'sdd-x'; b.textContent = 'Tozalash';
                b.onclick = clearFilters; fl.append(b);
            }
        }
        const bad = typeof _debtorsDateFrom !== 'undefined' && _debtorsDateFrom && _debtorsDateTo && _debtorsDateFrom > _debtorsDateTo;
        if (bad && !wrap.querySelector('.sdd-range')) wrap.querySelector('.dbx-head')?.insertAdjacentHTML('afterend', '<p class="sdd-range" role="alert">“Sanadan” “Sanagacha”dan keyin — oraliqda sana yoʻq, roʻyxat boʻsh chiqadi.</p>');
        // Bo'sh ro'yxat: dizayndagi izoh va "Filtrlarni tozalash".
        const empty = wrap.querySelector('.dbx-table tbody td[colspan]');
        if (empty && !empty.dataset.sdd) {
            empty.dataset.sdd = '1';
            const quick = typeof _debtorsQuick !== 'undefined' ? _debtorsQuick : 'all';
            empty.innerHTML = `<div class="sdd-empty"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.8" aria-hidden="true"><path d="M2 6h20v13H2zM2 10h20"/></svg>
                <b>Bu filtr boʻyicha qarzdor oʻquvchilar yoʻq</b><span>${anyF || quick !== 'all' ? 'Filtrni oʻzgartiring yoki tozalang.' : 'Hamma oʻquvchilaringiz toʻlovni oʻz vaqtida qilgan.'}</span>
                ${anyF ? '<button type="button" class="sdd-btn2" data-sdd-clear>Filtrlarni tozalash</button>' : ''}</div>`;
            empty.querySelector('[data-sdd-clear]')?.addEventListener('click', clearFilters);
        }
        const foot = wrap.querySelector('.dbx-foot');
        if (foot) foot.textContent = '⋯ menyusida: Toʻlov qabul qilish, Muddatni surish soʻrovi (ROP tasdiqlaydi), SMS. Oʻquvchini oʻchirish — faqat oʻquvchi kartasidan (arxivga).';
        // So'rovlar keyin kelsa — belgilar qayta chiziladi (ro'yxat qayta chizilmaydi).
        loadRequests().then(() => { if (document.getElementById(HOST_ID) === host) host.querySelectorAll('.dbx-table tbody tr[data-sid]').forEach(tr => paintPending(tr, tr.dataset.sid)); });
    }
    function paintPending(tr, sid) {
        const r = REQ.map.get(sid);
        const cell = tr.cells[1]; if (!cell) return;
        const box = cell.querySelector(':scope > div:last-child'); if (!box) return;
        if (!box.dataset.sddOrig) box.dataset.sddOrig = box.innerHTML;
        if (!r) { if (box.dataset.sddPend) { box.innerHTML = box.dataset.sddOrig; delete box.dataset.sddPend; } return; }
        const ch = changesOf(r);
        const to = 'paymentDueDate' in ch ? (ch.paymentDueDate ? dShort(ch.paymentDueDate) : 'sanasiz') : '';
        box.dataset.sddPend = '1';
        box.innerHTML = `<span class="sdd-pend" title="${esc(`Soʻrov №${r.number || ''} · ROP yoki admin tasdigʻini kutmoqda${r.reason ? ' · sabab: ' + r.reason : ''}`)}">Surish soʻrovi kutilmoqda</span>${to ? `<div class="sdd-pend-to">yangi muddat → ${esc(to)}</div>` : ''}`;
    }
    function clearFilters() {
        _debtorsTeacherFilter = 'all'; _debtorsTariffFilter = 'all'; _debtorsDateFrom = ''; _debtorsDateTo = '';
        if (g('refreshAllDebtorViews')) refreshAllDebtorViews();
    }

    // ---- ⋯ menyusi: dizayndagi ko'rinish, "Qarz tahrirlash" → "Muddatni surish soʻrovi" ----
    function decorateMenu(studentId, trigger) {
        const menu = document.getElementById('debtorCtxMenu'); if (!menu || !on()) return;
        const st = studentOf(studentId); if (!st) return;
        menu.classList.add('sdd-mn');
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', `${st.name || ''} — amallar`);
        const LBL = { call: ['☏', 'Qoʻngʻiroq qilish'], sms: ['✉', 'SMS yuborish'], payment: ['＋', 'Toʻlov qabul qilish'], edit: ['✎', 'Muddatni surish soʻrovi'] };
        menu.querySelectorAll('.ctx-item').forEach(it => {
            const a = it.dataset.action;
            if (a === 'payment-off') { it.innerHTML = `<span><i aria-hidden="true">＋</i>Toʻlov qabul qilish</span><small>avval shartnoma summasini kiriting (Moliya)</small>`; it.setAttribute('role', 'menuitem'); it.setAttribute('aria-disabled', 'true'); return; }
            const l = LBL[a]; if (!l) return;
            const pend = a === 'edit' && REQ.map.get(studentId);
            it.innerHTML = `<span><i aria-hidden="true">${l[0]}</i>${esc(l[1])}</span>${pend ? '<small>soʻrov kutilmoqda — ROP koʻrib chiqadi</small>' : a === 'edit' ? '<small>ROP tasdiqlaydi</small>' : ''}`;
            it.setAttribute('role', 'menuitem'); it.tabIndex = -1;
            if (a === 'edit') it.onclick = () => { closeMenu(menu, trigger, false); openDue(studentId, trigger); };
            if (a === 'payment') it.before(Object.assign(document.createElement('hr'), { className: 'sdd-mn-hr' }));
        });
        // Klaviatura: ↑/↓, Enter/Probel, Esc (trigger'ga qaytadi).
        const items = () => [...menu.querySelectorAll('.ctx-item[role="menuitem"]:not([aria-disabled="true"])')];
        menu.addEventListener('keydown', e => {
            const its = items(), ix = its.indexOf(document.activeElement);
            if (e.key === 'Escape') { e.preventDefault(); closeMenu(menu, trigger, true); }
            else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); (its[(ix + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length] || its[0])?.focus(); }
            else if ((e.key === 'Enter' || e.key === ' ') && ix >= 0) { e.preventDefault(); its[ix].click(); }
        });
        if (trigger) {
            trigger.setAttribute('aria-expanded', 'true');
            new MutationObserver((_, ob) => { if (!menu.isConnected) { trigger.setAttribute('aria-expanded', 'false'); ob.disconnect(); } }).observe(document.body, { childList: true });
            // Pastki qatorlarda menyu ekrandan chiqmasin.
            const r = menu.getBoundingClientRect();
            if (r.bottom > window.innerHeight - 8) menu.style.top = Math.max(8, trigger.getBoundingClientRect().top - r.height - 6) + 'px';
        }
        setTimeout(() => items()[0]?.focus(), 0);
    }
    function closeMenu(menu, trigger, focus) { menu.remove(); trigger?.setAttribute('aria-expanded', 'false'); if (focus) trigger?.focus(); }

    // ---- "Muddatni surish soʻrovi" oynasi ----
    let dlg = null;
    function openDue(studentId, trigger) {
        const s = studentOf(studentId); if (!s) return;
        closeDue();
        const pend = REQ.map.get(studentId);
        const hist = (Array.isArray(s.paymentDueHistory) ? s.paymentDueHistory : []).slice(-4).reverse();
        const ro = (label, v) => `<label class="sdd-f sdd-ro">${esc(label)}<input type="text" readonly value="${esc(v)}"></label>`;
        const ov = document.createElement('div');
        ov.className = 'sdd-ov';
        ov.innerHTML = `<div class="sdd-dlg" role="dialog" aria-modal="true" aria-labelledby="sddDueH">
            <div class="sdd-dh"><h2 id="sddDueH">Muddatni surish soʻrovi — ${esc(s.name || '')}</h2><button type="button" class="sdd-ic" data-sdd-close aria-label="Yopish">✕</button></div>
            <div class="sdd-db">
              <p class="sdd-hint">Yangi toʻlov muddati, izoh va eslatma ROP’ga soʻrov sifatida yuboriladi — ROP tasdiqlaguncha oʻquvchi kartasida eski muddat qoladi. Yangi tushumni “Toʻlov qabul qilish” orqali kiriting.</p>
              ${pend ? `<p class="sdd-warn" role="status">Bu oʻquvchi boʻyicha soʻrov №${esc(pend.number || '')} allaqachon kutilmoqda${changesOf(pend).paymentDueDate ? ` (yangi muddat ${esc(dShort(changesOf(pend).paymentDueDate))})` : ''} — ROP qaror qilguncha yangisini yuborib boʻlmaydi.</p>` : ''}
              <div class="sdd-g2">
                ${ro('Toʻlangan summa (soʻm)', U.num(s.paidAmount || 0))}
                ${ro('Qarz miqdori (soʻm)', s.debtAmount == null ? 'Aniqlanmagan' : U.num(s.debtAmount || 0))}
                <label class="sdd-f">Yangi toʻlov muddati<input id="sddDue" type="date" lang="en-GB" value="${esc(s.paymentDueDate || '')}" min="${todayIso()}"></label>
                ${ro('Tarif', `${s.lessonDuration || 15} daq · ${tariffLabel(s.tariff)}`)}
                ${ro('Oxirgi toʻlov sanasi', s.lastPaymentDate ? dShort(s.lastPaymentDate) : '—')}
                ${ro('Toʻlovlar soni', String(s.paymentCount || 0))}
              </div>
              <p class="sdd-hint sdd-hint--sm">Joriy muddat: <b>${esc(s.paymentDueDate ? dShort(s.paymentDueDate) : 'kelishilmagan')}</b>. Toʻlangan summa, qarz, oxirgi toʻlov sanasi va toʻlovlar soni reyestrdan olinadi — bu yerda oʻzgarmaydi. Tarifni oʻzgartirish — oʻquvchi kartasidagi “Tarifni oʻzgartirish soʻrovi” orqali.</p>
              <label class="sdd-f"><span>Sabab <span class="sdd-req">· majburiy</span></span><textarea id="sddReason" rows="2" maxlength="500" placeholder="Masalan: oyligi 25-sanada tushadi — 1 haftaga surishni soʻradi" aria-required="true"></textarea></label>
              <label class="sdd-f">Izoh<textarea id="sddComment" rows="2" maxlength="500">${esc(s.comment || '')}</textarea></label>
              <label class="sdd-f">Eslatma<textarea id="sddNote" rows="2" maxlength="500">${esc(s.note || '')}</textarea></label>
              ${hist.length ? `<div class="sdd-hist"><span>Sana oʻzgarishlari</span><ul>${hist.map(h => `<li>${esc(dShort(h.from))} → ${esc(dShort(h.to))}${h.reason ? ` · ${esc(h.reason)}` : ''}${h.by ? ` · ${esc(h.by)}` : ''}</li>`).join('')}</ul></div>` : ''}
              <p class="sdd-err" role="alert" hidden></p>
            </div>
            <div class="sdd-df"><button type="button" class="sdd-btn2" data-sdd-close>Bekor qilish</button><button type="button" class="sdd-btnp" data-sdd-save>Soʻrovni ROP’ga yuborish</button></div>
          </div>`;
        document.body.appendChild(ov);
        dlg = { ov, studentId, trigger, busy: false };
        const $ = sel => ov.querySelector(sel);
        const err = $('.sdd-err');
        const showErr = (t, focusSel) => { err.textContent = t; err.hidden = !t; if (focusSel) $(focusSel)?.focus(); };
        ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-sdd-close]')) closeDue(true); });
        ov.addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.preventDefault(); closeDue(true); return; }
            if (e.key !== 'Tab') return;
            const f = [...ov.querySelectorAll('button,input:not([readonly]),select,textarea')].filter(el => !el.disabled);
            const ix = f.indexOf(document.activeElement);
            if ((e.shiftKey && ix <= 0) || (!e.shiftKey && ix === f.length - 1)) { e.preventDefault(); (e.shiftKey ? f[f.length - 1] : f[0]).focus(); }
        });
        ['#sddDue', '#sddReason', '#sddComment', '#sddNote'].forEach(sel => $(sel)?.addEventListener('input', () => { if (!err.hidden) showErr(''); $(sel).removeAttribute('aria-invalid'); }));
        $('[data-sdd-save]').onclick = async () => {
            if (dlg?.busy) return;
            const due = $('#sddDue').value || '', reason = $('#sddReason').value.trim(), comment = $('#sddComment').value, note = $('#sddNote').value;
            const changed = due !== (s.paymentDueDate || '') || comment.trim() !== String(s.comment || '').trim() || note.trim() !== String(s.note || '').trim();
            if (!changed) return showErr('Oʻzgarish yoʻq — yangi muddat yoki izoh kiriting', '#sddDue');
            if (due && due < todayIso() && due !== (s.paymentDueDate || '')) { $('#sddDue').setAttribute('aria-invalid', 'true'); return showErr('Yangi muddat bugundan oldin boʻlmasin', '#sddDue'); }
            if (reason.length < 5) { $('#sddReason').setAttribute('aria-invalid', 'true'); return showErr('Sababni yozing (kamida 5 belgi) — ROP koʻradi va tarixga yoziladi', '#sddReason'); }
            const btn = $('[data-sdd-save]');
            dlg.busy = true; btn.setAttribute('aria-disabled', 'true'); btn.textContent = 'Yuborilmoqda...'; showErr('');
            try {
                const changes = { paymentDueDate: due, comment, note };
                const r = await schoolApi(`/students/${encodeURIComponent(studentId)}/edit`, { method: 'POST', body: { changes, reason } });
                if (r?.request) REQ.map.set(studentId, r.request);
                closeDue(false);
                U.toast(`Soʻrov ROP’ga yuborildi · ${s.name}${due && due !== s.paymentDueDate ? ' — yangi muddat ' + dShort(due) : ''}. Tasdiqlangach muddat oʻzgaradi.`, 4200);
                if (g('refreshAllDebtorViews')) refreshAllDebtorViews();
                document.querySelector(`#${HOST_ID} .debtors-dot-menu-btn[data-sid="${CSS.escape(studentId)}"]`)?.focus();
                loadRequests(true).then(() => decorate());
            } catch (e) {
                if (!dlg || dlg.ov !== ov) return;
                dlg.busy = false; btn.removeAttribute('aria-disabled'); btn.textContent = 'Soʻrovni ROP’ga yuborish';
                const msg = e?.status === 409 ? `Bu oʻquvchi uchun muddatni surish soʻrovi allaqachon kutilmoqda — ROP qaror qilguncha yangisini yuborib boʻlmaydi.`
                    : e?.status === 403 ? `Ruxsat yoʻq: ${e.message}. Oʻquvchi boshqa menejerga oʻtkazilgan boʻlishi mumkin — roʻyxatni yangilang.`
                    : e?.status === 400 ? e.message : `Yuborib boʻlmadi: ${e?.message || 'server javob bermadi'}. Qayta urinib koʻring.`;
                showErr(msg);
                if (e?.status === 409) loadRequests(true).then(() => decorate());
            }
        };
        setTimeout(() => $('#sddDue')?.focus(), 30);
    }
    function closeDue(focus) {
        if (!dlg) return;
        const { ov, trigger } = dlg; dlg = null;
        ov.remove();
        if (focus && trigger?.isConnected) trigger.focus();
    }

    // ---- Ulash ----
    function boot() {
        U.wrap('renderDebtorsTable', id => { if (id === HOST_ID) decorate(); });
        U.wrap('openDebtorMenu', (id, btn) => decorateMenu(id, btn));
        // Sotuv kompyuterida eski "Qarz tahrirlash" oynasi (saqlanmaydigan) ochilmaydi — o'rniga so'rov oynasi.
        const origEdit = window.openDebtorEditModal;
        if (typeof origEdit === 'function' && !origEdit.__sdd) {
            const fn = function (id) { if (on()) return openDue(id); return origEdit.apply(this, arguments); };
            fn.__sdd = true; window.openDebtorEditModal = fn;
        }
    }
    SP.register('debt', {
        tab: 'sales',
        head: () => ({
            title: 'Qarzdorlar',
            sub: 'Roʻyxatda qoldigʻi bor barcha oʻquvchilar. <b>Muddati oʻtgan</b> — sotuv menejeri bilan kelishilgan sana oʻtib, qoldiq toʻlanmagan. Siz faqat oʻz oʻquvchilaringizni koʻrasiz.',
            right: `<span class="rdp-mt">Bugun: ${esc(todayTxt())}</span>`
        }),
        after() { decorate(); loadRequests(true).then(() => decorate()); }
    });
    window.sotDesk.debt = { openDue, reload: () => loadRequests(true).then(() => decorate()), pending: () => REQ.map };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
