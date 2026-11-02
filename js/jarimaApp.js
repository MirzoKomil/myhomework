// Jarimalar — Jamoa telefon ilovasi qatlami (dizayn "Jarimalar" J01–J09, mantiq J06).
//  • J01 Mening jarimalarim (maosh − jarimalar = qoʻlga tegadi, chegara, seriya), J02 roʻyxat, J03 yuvish,
//    J04 popup (jarima yozilganda), J07 tafsilot va eʼtiroz, J08 rahbar jarima yozadi, J09 yuvish soʻrovlari.
//  • Hamma rolda (admin'dan tashqari); rahbar sahifalari ROP, akademik rahbar va adminda.
// Uslublar: css/davomatApp.css (dv-*) + css/jarimaApp.css. API: /api/fines. Host ilovalar uchun: window.jarima.
(function () {
    'use strict';
    const API = '/api/fines';
    const MQ = window.matchMedia('(max-width: 900px)');
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const MON_S = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const WD = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } } };
    const token = () => ls.get('mh_token') || '';
    const user = () => { try { return (typeof getCurrentUser === 'function' ? getCurrentUser() : null) || JSON.parse(ls.get('mh_currentUser') || 'null') || {}; } catch (e) { return {}; } };
    const on = () => MQ.matches && !!token() && !!user().id && user().role !== 'student';
    const num = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const first = n => String(n || '').trim().split(/\s+/)[0] || '';
    const tkDate = () => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
    const dS = d => `${Number(d.slice(8))}-${MON_S[Number(d.slice(5, 7)) - 1]}`;
    const dL = d => `${Number(d.slice(8))}-${MON_S[Number(d.slice(5, 7)) - 1]}, ${WD[new Date(d + 'T00:00:00Z').getUTCDay()]}`;
    const monTitle = m => { const s = MON[Number(m.slice(5, 7)) - 1]; return s[0].toUpperCase() + s.slice(1) + ' ' + m.slice(0, 4); };
    const dG = d => `${Number(d.slice(8))}-${MON[Number(d.slice(5, 7)) - 1]}`;
    const P = {
        back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 6l6 6-6 6"/>', close: '<path d="M18 6L6 18M6 6l12 12"/>',
        drop: '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        task: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>', flame: '<path d="M12 2c1 3 4 4.5 4 8.5a4 4 0 01-8 0c0-1.5.5-2.5 1.5-3.5.2 1.5 1 2.5 2 2.5 0-3-.5-5 .5-7.5z"/><path d="M8 15a4 4 0 008 0"/>',
        book: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5"/>', cam: '<path d="M3 8.5A2.5 2.5 0 015.5 6h2l1.5-2h6L16.5 6h2A2.5 2.5 0 0121 8.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 17.5z"/><circle cx="12" cy="13" r="3.5"/>',
        receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>', check: '<path d="M5 12l5 5L20 7"/>', info: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/>', down: '<path d="M6 9l6 6 6-6"/>'
    };
    const ic = (n, s = 20, w = 2.2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
    const pill = (text, tone) => `<span class="dv-pill dv-${tone}">${esc(text)}</span>`;

    async function api(path, body, method) {
        const r = await fetch(API + path, { method: method || (body !== undefined ? 'POST' : 'GET'), headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' }, cache: 'no-store',
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }).catch(() => { throw new Error('Internet yoʻq. Qayta urinib koʻring'); });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error(j.error || 'Xatolik'), { status: r.status });
        return j;
    }

    // ---------- holat va sahifalar ----------
    const S = { pages: [], counts: null, month: tkDate().slice(0, 7), wash: null };
    let root = null, sheetEl = null, booted = false;
    const data = {};
    async function load(key, fn) {
        if (data[key]?.loading) return;
        data[key] = { ...(data[key] || {}), loading: true };
        try { data[key] = { v: await fn(), at: Date.now() }; } catch (e) { data[key] = { err: e }; }
        rerender();
    }
    const got = (key, fn, ttl = 20000) => { const d = data[key]; if (!d || (!d.loading && !d.err && Date.now() - (d.at || 0) > ttl)) load(key, fn); return data[key] || { loading: true }; };
    const invalidate = (...keys) => keys.forEach(k => { for (const x of Object.keys(data)) if (x.startsWith(k)) delete data[x]; });

    function mount() {
        if (root) return;
        root = document.createElement('div'); root.className = 'dv-root jr-root'; document.body.appendChild(root);
        root.addEventListener('click', onClick);
        root.addEventListener('submit', e => e.preventDefault());
        root.addEventListener('input', onInput);
    }
    function openPage(id, arg) {
        mount(); S.pages.push({ id, arg });
        try { history.pushState({ jrPage: S.pages.length }, ''); } catch (e) { /* */ }
        renderPage();
    }
    function closePage(fromPop) {
        S.pages.pop();
        if (!fromPop) { S.skipPop = true; try { history.back(); } catch (e) { S.skipPop = false; } }
        renderPage();
    }
    function renderPage() {
        let el = root.querySelector('.jr-page');
        const top = S.pages[S.pages.length - 1];
        if (!top) { el?.remove(); if (!sheetEl) document.body.classList.remove('dv-open'); return; }
        if (!el) { el = document.createElement('div'); el.className = 'dv-page jr-page'; root.prepend(el); }
        document.body.classList.add('dv-open');
        el.innerHTML = (PAGES[top.id] || (() => ''))(top.arg);
        el.scrollTop = 0;
    }
    function rerender() { if (!S.pages.length || !root) return; const el = root.querySelector('.jr-page'); const y = el?.scrollTop || 0; renderPage(); const e2 = root.querySelector('.jr-page'); if (e2) e2.scrollTop = y; }
    function openSheet(html) {
        mount(); closeSheet();
        sheetEl = document.createElement('div'); sheetEl.className = 'dv-sheet-wrap';
        sheetEl.innerHTML = `<div class="dv-dim" data-jr-close></div>${html}`;
        root.appendChild(sheetEl); document.body.classList.add('dv-open');
        setTimeout(() => sheetEl?.querySelector('button, a, textarea')?.focus({ preventScroll: true }), 60);
    }
    function closeSheet() { sheetEl?.remove(); sheetEl = null; if (!S.pages.length) document.body.classList.remove('dv-open'); }
    function toast(m, bad) { if (window.davomat?.toast) return davomat.toast(m, bad ? 'bad' : 'ok'); }
    const top = (title, sub) => `<header class="dv-top"><button type="button" class="dv-icon-btn" data-jr-back aria-label="Orqaga">${ic('back', 20)}</button><div class="dv-col"><h1>${esc(title)}</h1>${sub ? `<span>${esc(sub)}</span>` : ''}</div></header>`;
    const loading = () => `<div class="dv-body">${'<div class="dv-sk"></div>'.repeat(3)}</div>`;
    const errBox = e => `<div class="dv-body"><div class="dv-state"><strong>Yuklab boʻlmadi</strong><p>${esc(e?.message || '')}</p><button type="button" class="dv-btn dv-btn-primary" data-jr-reload>Qayta urinish</button></div></div>`;

    const STATUS = { active: ['Yozildi', 'amber'], partly: ['Qisman yuvildi', 'blue'], washed: ['Yuvildi', 'green'], warning: ['Ogohlantirish', 'gray'], appeal: ['Koʻrib chiqilmoqda', 'blue'], cancelled: ['Bekor qilindi', 'gray'] };
    const srcText = f => (f.warning ? 'Oyning 1-kechikishi' : f.source === 'attendance' ? 'Davomat · avtomatik' : `Rahbar yozdi${f.issuedBy ? ' · ' + f.issuedBy : ''}`);

    // ---------- J01 · Mening jarimalarim ----------
    function pageMy(arg) {
        const emp = arg?.employeeId || '';
        const key = 'my:' + (emp || 'me') + ':' + S.month;
        const d = got(key, () => api(emp ? `/employee/${encodeURIComponent(emp)}?month=${S.month}` : `/me?month=${S.month}`));
        const title = emp ? 'Xodim jarimalari' : 'Mening jarimalarim';
        if (d.err) return top(title) + errBox(d.err);
        if (!d.v) return top(title) + loading();
        const v = d.v;
        if (v.exempt) return top(title) + `<div class="dv-body"><div class="dv-empty">${ic('check', 26)}<strong>Sizga jarima qoidalari qoʻllanmaydi</strong><span>Admin uchun jarima yoʻq. Sozlamalar — Menyu → Jarima va ragʻbat sozlamalari</span></div></div>`;
        if (!v.linked) return top(title) + `<div class="dv-body"><div class="dv-empty">${ic('info', 26)}<strong>HR roʻyxatida topilmadingiz</strong><span>HR bilan bogʻlaning</span></div></div>`;
        const s = v.summary, mName = MON[Number(v.month.slice(5, 7)) - 1];
        const fineTotal = s.deducted;
        const washLeft = v.fines.filter(f => f.canWash).reduce((a, f) => a + f.washLeft, 0);
        const hours = washLeft && v.soft.washHour ? Math.round(washLeft / v.soft.washHour * 2) / 2 : 0;
        const pct = Math.min(100, Math.round((v.streak.progress || 0) / (v.streak.need || 10) * 100));
        const rows = v.fines.map(f => { const st = STATUS[f.status] || [f.status, 'gray'];
            return `<button type="button" class="jr-row" data-jr-fine="${esc(f.id)}"><span class="dv-col"><strong>${dS(f.date)} · ${esc(f.label)}</strong><em>${esc(srcText(f))}</em></span>
              <span class="jr-amt"><strong class="${f.status === 'washed' || f.status === 'cancelled' ? 'jr-strike' : ''}">${f.amount ? '−' + num(f.amount) : '0'}</strong>${pill(st[0], st[1])}</span>${ic('chev', 18)}</button>`; }).join('');
        return `${top(title, `${monTitle(v.month)} · ${v.name}`)}<div class="dv-body">
            <section class="jr-calc dv-s1"><span class="jr-eyebrow">${mName.toUpperCase()} HISOB-KITOBI · TOʻLOV ${Number(v.payDay.slice(8))}-${MON[Number(v.payDay.slice(5, 7)) - 1].toUpperCase()}</span>
              <div class="jr-lines"><div><span>Hisoblangan (oklad + bonus)</span><strong>${v.salary != null ? num(v.salary) : '—'}</strong></div>
                <div><span>Jarimalar</span><strong class="jr-neg">${fineTotal ? '−' + num(fineTotal) : '0'}</strong></div>
                ${s.bonus ? `<div><span>“Toza oy” bonusi</span><strong class="jr-pos">+${num(s.bonus)}</strong></div>` : ''}
                <i class="jr-hr"></i><div class="jr-take"><span>Qoʻlingizga tegadi</span><strong>${s.takeHome != null ? num(s.takeHome) : '—'}</strong></div></div>
              <div class="jr-capline"><span>${s.cap != null ? `Oylik chegara (${v.soft.capPercent}%): ${num(s.cap)} · ishlatildi ${num(fineTotal)}` : `Oylik chegara: maoshning ${v.soft.capPercent}%`}</span><span>${v.salary != null ? 'soʻm' : 'maosh hali hisoblanmagan'}</span></div></section>
            ${!emp ? `<button type="button" class="jr-wash dv-s2" data-jr-go="wash">
              <span class="jr-wash-h"><span class="jr-wash-ic">${ic('drop', 22)}</span><span class="dv-col"><strong>${washLeft ? num(washLeft) + ' soʻmni yuvish mumkin' : 'Yuviladigan jarima yoʻq'}</strong><em>${washLeft && hours ? `Masalan, ${String(hours).replace('.', ',')} soat qoʻshimcha ishlab` : 'Intizomni shu holda saqlang'}</em></span>${ic('chev', 18)}</span>
              <span class="jr-bar-l">Ketma-ket vaqtida: ${v.streak.progress}/${v.streak.need} kun</span><span class="jr-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
              <span class="jr-wash-n">${v.streak.need} kunda eng kichik jarima oʻzi yuviladi · yuvish ${dG(v.washDeadline)}gacha</span></button>` : ''}
            ${v.fines.length ? `<section class="dv-list jr-list dv-s3">${rows}</section>` : `<div class="dv-empty dv-s3">${ic('check', 26)}<strong>Bu oy jarima yoʻq</strong><span>${v.soft.cleanMonthOn ? `Oy oxirigacha shunday boʻlsa — “Toza oy” bonusi +${num(v.soft.cleanMonthBonus)}` : 'Zoʻr!'}</span></div>`}
            <div class="jr-two dv-s3"><button type="button" class="dv-btn dv-btn-outline" data-jr-go="rules">Jarimalar roʻyxati</button>${!emp ? `<button type="button" class="dv-btn dv-btn-outline" data-jr-go="wash">Jarima yuvish</button>` : '<span></span>'}</div>
            <div class="jr-monthnav"><button type="button" class="dv-link" data-jr-month="-1">‹ Oldingi oy</button>${S.month < tkDate().slice(0, 7) ? '<button type="button" class="dv-link" data-jr-month="1">Keyingi oy ›</button>' : ''}</div>
            ${!emp ? '<span class="dv-fine dv-center-t">Jarimaga eʼtirozingiz boʻlsa — ustiga bosing va 3 kun ichida yozing.</span>' : ''}</div>`;
    }

    // ---------- J02 · Jarimalar ro'yxati ----------
    function pageRules() {
        const d = data['my:me:' + S.month]?.v || data[Object.keys(data).find(k => k.startsWith('my:') && data[k].v)]?.v;
        if (!d) { const x = got('my:me:' + S.month, () => api('/me?month=' + S.month)); if (!x.v) return top('Jarimalar roʻyxati') + (x.err ? errBox(x.err) : loading()); }
        const v = d || data['my:me:' + S.month].v;
        const att = (v.rules || []).filter(r => r.kind && r.kind !== 'work'), work = (v.rules || []).filter(r => !r.kind || r.kind === 'work');
        const row = r => `<div class="jr-rule"><span class="dv-col"><strong>${esc(r.label)}</strong>${r.sub ? `<em>${esc(r.sub)}</em>` : ''}</span><strong class="jr-rule-a">${r.kind === 'late_streak' ? '+' : ''}${num(r.amount)}</strong></div>`;
        return `${top('Jarimalar roʻyxati', `${v.roleLabel || ''} uchun · admin belgilagan`)}<div class="dv-body">
            <div class="dv-info dv-blue dv-s1">${ic('info', 18)}<span>Har oy birinchi kechikish — faqat ogohlantirish. Ish boshlanishidan keyingi ${v.soft.graceMinutes} daqiqa hisoblanmaydi. Tasdiqlangan soʻrov boʻlsa jarima yozilmaydi.</span></div>
            ${att.length ? `<h3 class="jr-h3">DAVOMAT</h3><section class="dv-list dv-s2">${att.map(row).join('')}</section>` : ''}
            ${work.length ? `<h3 class="jr-h3">ISH</h3><section class="dv-list dv-s2">${work.map(row).join('')}</section>` : ''}
            <h3 class="jr-h3">RAGʻBAT</h3><section class="dv-list dv-s3">
              ${v.soft.cleanMonthOn ? `<div class="jr-rule"><span class="dv-col"><strong>Oy davomida bitta ham jarima yoʻq</strong><em>“Toza oy” bonusi</em></span><strong class="jr-rule-a jr-pos">+${num(v.soft.cleanMonthBonus)}</strong></div>` : ''}
              <div class="jr-rule"><span class="dv-col"><strong>10 ish kuni ketma-ket vaqtida</strong><em>Bitta jarima oʻzi yuviladi</em></span><strong class="jr-rule-a jr-pos">yuviladi</strong></div></section>
            <span class="dv-fine dv-center-t">Summalar soʻmda · admin oʻzgartiradi</span></div>`;
    }

    // ---------- J03 · Jarima yuvish ----------
    function pageWash() {
        const d = got('my:me:' + S.month, () => api('/me?month=' + S.month));
        if (d.err) return top('Jarima yuvish') + errBox(d.err);
        if (!d.v) return top('Jarima yuvish') + loading();
        const v = d.v, s = v.summary, soft = v.soft;
        const left = v.fines.filter(f => f.canWash).reduce((a, f) => a + f.washLeft, 0);
        const total = v.fines.filter(f => !f.warning && f.status !== 'cancelled').reduce((a, f) => a + f.amount, 0);
        const pct = total ? Math.round(s.washed / total * 100) : 0;
        const mName = MON[Number(v.month.slice(5, 7)) - 1];
        const pend = (v.washes || []).filter(w => w.state === 'pending');
        const learned = (v.washes || []).some(w => w.kind === 'learning' && w.state !== 'rejected');
        const sun = (() => { const n = new Date(Date.now() + 5 * 3600000); const add = (7 - n.getUTCDay()) % 7 || 7; n.setUTCDate(n.getUTCDate() + add); return n.toISOString().slice(0, 10); })();
        const hasOut = !!window.davomat?.state()?.today?.outClock;
        const way = (icon, tone, title, sub, price, action) => `<div class="jr-way"><div class="jr-way-h"><span class="jr-way-ic jr-${tone}">${ic(icon, 20)}</span><span class="dv-col"><strong>${title}</strong><em>${sub}</em></span><strong class="jr-price${/[a-zʻ]/i.test(price) && !/=/.test(price) ? ' jr-wrap' : ''}">${price}</strong></div>${action}</div>`;
        const end = window.davomat?.state()?.end;
        const kind = v.role === 'sales' ? 'ROPʼdan' : ['assistant', 'teacher'].includes(v.role) ? 'Akademik rahbardan' : 'Rahbardan';
        return `${top('Jarima yuvish', `Yuvilmagan: ${num(left)} soʻm`)}<div class="dv-body">
            <div class="jr-progress dv-s1"><div><strong>Bu oy yuvildi</strong><span>${num(s.washed)} / ${num(total)}</span></div><span class="jr-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
              <em>${mName[0].toUpperCase() + mName.slice(1)} jarimalarini ${dG(v.washDeadline)}gacha yuvish mumkin — ${dG(v.payDay)}da maosh hisoblanadi</em></div>
            ${pend.length ? `<div class="dv-info dv-blue">${ic('clock', 18)}<span>${pend.length} ta yuvish soʻrovi rahbar tasdigʻini kutmoqda</span></div>` : ''}
            <div class="jr-ways dv-s2">
              ${way('clock', 'blue', 'Qoʻshimcha soat', 'Ish vaqtidan keyin ofisda. Kelish-ketish yuz bilan belgilanadi.', `1 soat = ${num(soft.washHour)}`,
                  hasOut ? `<button type="button" class="dv-btn dv-btn-soft" data-jr-wreq="hours">Bugungi qoʻshimcha vaqtni yuborish</button>`
                  : `<button type="button" class="dv-btn dv-btn-soft" data-jr-hours>${end ? `Bugun ${esc(end)} dan keyin qolaman` : 'Bugun ish vaqtidan keyin qolaman'}</button>`)}
              ${way('sun', 'amber', 'Yakshanba navbatchiligi', '4 soat: qoʻngʻiroqlar, eski lidlar, saralash', num(soft.washSunday), `<button type="button" class="dv-btn dv-btn-soft" data-jr-wreq="sunday" data-date="${sun}">${dG(sun)}, yakshanbaga yozilish</button>`)}
              ${way('task', 'green', 'Qoʻshimcha vazifa', 'Rahbar beradi — masalan 20 ta eski lidni qayta qoʻngʻiroq qilish. Natija boʻlsa yuviladi.', 'rahbar belgilaydi', `<button type="button" class="dv-btn dv-btn-soft" data-jr-wreq="task">${kind} vazifa soʻrash</button>`)}
              ${way('flame', 'amber', `${v.streak.need} kun ketma-ket vaqtida`, 'Hech narsa qilish shart emas — intizomning oʻzi yuvadi', 'eng kichik jarima', `<span class="jr-way-n">Hozir: ${v.streak.progress} / ${v.streak.need} kun</span>`)}
              ${way('book', 'gray', 'Oʻrganish', 'Yangi skript yoki yoʻriqnomani oʻqib, qisqa testdan oʻtish', num(soft.washLearning), learned ? '<span class="jr-way-n">Bu oy ishlatilgan · oyiga 1 marta</span>' : `<button type="button" class="dv-btn dv-btn-soft" data-jr-wreq="learning">Testdan oʻtdim — tasdiqlashga yuborish</button>`)}
            </div>
            <span class="dv-fine dv-center-t">Qoʻshimcha soat va yakshanba rahbar tasdigʻidan keyin yuviladi.<br>Sababsiz kelmaslik jarimasini faqat ${soft.absentWashPercent === 50 ? 'yarmigacha' : soft.absentWashPercent + '% gacha'} yuvish mumkin.</span></div>`;
    }
    async function sendWash(kind, btn, extra = {}) {
        btn.disabled = true;
        try {
            const r = await api('/me/wash', { kind, month: S.month, ...extra });
            invalidate('my:'); toast(kind === 'hours' ? `${Math.floor(r.minutes / 60)} soat ${r.minutes % 60} daq · ${num(r.value)} soʻm — rahbarga yuborildi` : 'Soʻrov rahbarga yuborildi');
            rerender();
        } catch (e) { btn.disabled = false; toast(e.message, true); }
    }

    // ---------- J07 · Tafsilot va e'tiroz ----------
    function pageDetail(id) {
        const d = got('fine:' + id, () => api('/' + encodeURIComponent(id)), 10000);
        if (d.err) return top('Jarima tafsiloti') + errBox(d.err);
        if (!d.v) return top('Jarima tafsiloti') + loading();
        const f = d.v, st = STATUS[f.status] || [f.status, 'gray'];
        const rec = f.record, att = rec?.attempts?.find(a => a.kind === 'in') || rec?.attempts?.[0];
        const lastDay = f.appealUntil === tkDate();
        const kv = [['Sana', dL(f.date)], rec?.start ? ['Grafik', `${rec.start} · imtiyoz ${f.grace} daq`] : null, rec?.inClock ? ['Belgilangan', rec.inClock + (rec.outClock ? ' → ' + rec.outClock : '')] : null,
            f.rule ? ['Qoida', f.rule.label] : null, f.reason ? ['Sabab', f.reason] : null, f.evidence?.leadName ? ['Dalil — lid', f.evidence.leadName] : f.evidence?.text ? ['Dalil', f.evidence.text] : null,
            f.washed ? ['Yuvildi', num(f.washed) + ' soʻm'] : null].filter(Boolean);
        return `${top('Jarima tafsiloti', f.name)}<div class="dv-body dv-form">
            <section class="jr-detail dv-s1"><div class="jr-detail-h"><strong>${esc(f.label)}</strong>${pill(st[0], st[1])}</div><strong class="jr-big">${f.amount ? '−' + num(f.amount) + ' soʻm' : '0 soʻm'}</strong>
              <div class="dv-kv">${kv.map(([k, x]) => `<div><span>${k}</span><strong>${esc(x)}</strong></div>`).join('')}</div></section>
            ${att ? `<button type="button" class="jr-evid dv-s2" data-jr-rec="${esc(f.employeeId)}|${esc(f.date)}"><span class="jr-evid-ic">${ic('cam', 20)}</span><span class="dv-col"><strong>Dalil: selfie va joylashuv</strong><em>${esc([att.clock, att.distance != null ? 'ofisdan ' + att.distance + ' m' : '', att.faceScore != null ? 'yuz ' + att.faceScore + '%' : ''].filter(Boolean).join(' · '))}</em></span>${ic('chev', 18)}</button>` : ''}
            ${f.status === 'appeal' ? `<div class="dv-info dv-blue">${ic('clock', 18)}<span>Eʼtirozingiz: «${esc(f.appealText)}». Rahbar javobini kutyapti.</span></div>` : ''}
            ${f.appealAnswer ? `<div class="dv-info dv-gray">${ic('info', 18)}<span>Rahbar javobi: ${esc(f.appealAnswer)}</span></div>` : ''}
            ${f.mine && f.canAppeal ? `<section class="jr-appeal dv-s3"><div class="jr-detail-h"><h2>Eʼtiroz bildirish</h2><span class="${lastDay ? 'jr-red' : ''}">${lastDay ? 'Bugun oxirgi kun' : dG(f.appealUntil) + 'gacha'}</span></div>
              <label class="dv-field"><span>Nima notoʻgʻri?</span><textarea rows="3" id="jrAppeal" maxlength="600" placeholder="Masalan: 08:55 da keldim, ilova ochilmadi — rahbarim biladi"></textarea></label>
              <span class="dv-fine">Eʼtirozni rahbaringiz koʻradi. Javobgacha jarima “Koʻrib chiqilmoqda” boʻladi.</span><p class="dv-err" data-jr-err></p></section>` : ''}
            ${f.canManage && f.status === 'appeal' ? `<section class="jr-appeal"><label class="dv-field"><span>Javob (rad etsangiz — majburiy)</span><textarea rows="2" id="jrAnswer" maxlength="300"></textarea></label><p class="dv-err" data-jr-err></p></section>` : ''}
            <div class="dv-sticky">${f.mine && f.canAppeal ? `<div class="jr-two"><button type="button" class="dv-btn dv-btn-primary" data-jr-appeal="${esc(f.id)}">Eʼtiroz yuborish</button>${f.canWash ? '<button type="button" class="dv-btn dv-btn-outline" data-jr-go="wash">Buning oʻrniga yuvaman</button>' : ''}</div>`
                : f.canManage && f.status === 'appeal' ? `<div class="jr-two"><button type="button" class="dv-btn dv-btn-outline" data-jr-answer="${esc(f.id)}" data-accept="0">Rad etish</button><button type="button" class="dv-btn dv-btn-green" data-jr-answer="${esc(f.id)}" data-accept="1">Qabul — bekor qilish</button></div>`
                : f.mine && f.canWash ? '<button type="button" class="dv-btn dv-btn-primary dv-btn-xl" data-jr-go="wash">Yuvish yoʻllari</button>' : '<button type="button" class="dv-btn dv-btn-outline dv-btn-xl" data-jr-back>Orqaga</button>'}</div></div>`;
    }

    // ---------- J08 · Rahbar jarima yozadi ----------
    const issueForm = { emp: '', code: '', reason: '', evidence: '' };
    function pageIssue() {
        const d = got('team', () => api('/team'), 60000);
        if (d.err) return top('Jarima yozish') + errBox(d.err);
        if (!d.v) return top('Jarima yozish') + loading();
        const v = d.v, rows = v.rows;
        if (!rows.length) return top('Jarima yozish') + `<div class="dv-body"><div class="dv-empty">${ic('info', 26)}<strong>Xodim topilmadi</strong></div></div>`;
        if (!rows.some(r => r.id === issueForm.emp)) issueForm.emp = rows[0].id;
        const e = rows.find(r => r.id === issueForm.emp);
        if (!e.rules.some(r => r.code === issueForm.code)) issueForm.code = e.rules[0]?.code || '';
        const rule = e.rules.find(r => r.code === issueForm.code);
        const sub = v.kind === 'rop' ? 'ROP · faqat oʻz menejerlariga' : v.kind === 'academic' ? 'Akademik rahbar · faqat oʻz ustozlariga' : 'Admin';
        return `${top('Jarima yozish', sub)}<form class="dv-body dv-form" data-jr-issueform>
            <section class="jr-card dv-s1"><label class="dv-field"><span>Xodim <b>*</b></span><select class="dv-input" data-jr-f="emp">${rows.map(r => `<option value="${esc(r.id)}" ${r.id === e.id ? 'selected' : ''}>${esc(r.name)} · ${esc(r.roleLabel.toLowerCase())}</option>`).join('')}</select></label>
              <label class="dv-field"><span>Qoida <b>*</b></span><select class="dv-input" data-jr-f="code">${e.rules.map(r => `<option value="${esc(r.code)}" ${r.code === issueForm.code ? 'selected' : ''}>${esc(r.label)}</option>`).join('') || '<option value="">Bu rol uchun ish qoidasi yoʻq</option>'}</select></label>
              <div class="jr-sum"><span>Summa (admin belgilagan)</span><strong>${rule ? num(rule.amount) + ' soʻm' : '—'}</strong></div></section>
            <section class="jr-card dv-s1"><label class="dv-field"><span>Dalil${rule?.evidence === 'lead' ? ' — lid' : ''} <b>*</b></span><input class="dv-input" maxlength="300" data-jr-f="evidence" value="${esc(issueForm.evidence)}" placeholder="${rule?.evidence === 'lead' ? 'Lid ismi va telefon / ID' : 'Nima, qachon — tekshirsa boʻladigan dalil'}"></label>
              <label class="dv-field"><span>Sabab <b>*</b></span><textarea rows="3" maxlength="600" data-jr-f="reason" placeholder="Masalan: Qoʻngʻiroq tarixida bitta ham urinish yoʻq, lid 10 daqiqada “Sifatsiz”ga oʻtkazilgan.">${esc(issueForm.reason)}</textarea></label></section>
            <div class="dv-info dv-blue dv-s2">${ic('info', 18)}<span>${esc(first(e.name))}ga bot va push boradi: sabab, dalil va yuvish yoʻllari bilan. U 3 kun ichida eʼtiroz bildira oladi.</span></div>
            <p class="dv-err" data-jr-err></p>
            <div class="dv-sticky"><button type="submit" class="dv-btn dv-btn-red dv-btn-xl" data-jr-issue ${rule ? '' : 'disabled'}>Jarima yozish</button></div></form>`;
    }

    // ---------- J09 · Yuvish so'rovlari (rahbar) ----------
    const KIND = { hours: 'Qoʻshimcha soat', sunday: 'Yakshanba navbatchiligi', task: 'Qoʻshimcha vazifa', learning: 'Oʻrganish: yangi skript + test' };
    function pageWashOk() {
        const d = got('washinbox', () => api('/washes/inbox'), 10000);
        const ap = got('appeals', () => api('/appeals'), 10000);
        if (d.err) return top('Yuvish soʻrovlari') + errBox(d.err);
        if (!d.v) return top('Yuvish soʻrovlari') + loading();
        const rows = d.v.rows, apps = ap.v?.rows || [];
        const card = w => { const h = Math.floor(w.minutes / 60), m = w.minutes % 60;
            const what = w.kind === 'hours' ? `${KIND.hours} · ${h ? h + ' soat ' : ''}${m} daq` : KIND[w.kind];
            const ev = w.kind === 'hours' && w.evidence?.from ? `${dS(w.evidence.date)}: ${w.evidence.from} → ${w.evidence.to} yuz bilan belgilangan` : w.kind === 'sunday' && w.evidence?.date ? `${dG(w.evidence.date)}, yakshanba` : w.note || '';
            return `<article class="dv-req"><div class="dv-req-h"><span class="dv-ava jr-ava">${esc(w.name.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase())}</span><span class="dv-col"><strong>${esc(w.name)}</strong><em>${esc(what)}</em></span><strong class="jr-neg2">${w.kind === 'task' ? '' : '−' + num(w.value)}</strong></div>
              ${ev ? `<div class="dv-req-b"><span>${esc(ev)}</span></div>` : ''}
              ${w.kind === 'task' ? `<label class="dv-field"><span>Yuviladigan summa (soʻm)</span><input class="dv-input" inputmode="numeric" data-jr-taskamt="${esc(w.id)}" placeholder="masalan 20000"></label>` : ''}
              <div class="dv-req-a"><button type="button" class="dv-btn dv-btn-outline" data-jr-wrej="${esc(w.id)}">Rad etish</button><button type="button" class="dv-btn dv-btn-green" data-jr-wok="${esc(w.id)}">${ic('check', 16, 2.8)}Yuvildi deb tasdiqlash</button></div></article>`; };
        return `${top('Yuvish soʻrovlari', `${rows.length} ta kutmoqda${apps.length ? ` · ${apps.length} ta eʼtiroz` : ''}`)}<div class="dv-body">
            ${apps.length ? `<h3 class="jr-h3">EʼTIROZLAR</h3><section class="dv-list">${apps.map(f => `<button type="button" class="jr-row" data-jr-fine="${esc(f.id)}"><span class="dv-col"><strong>${esc(f.name)} · ${esc(f.label)}</strong><em>«${esc(f.appealText)}»</em></span><span class="jr-amt"><strong>−${num(f.amount)}</strong>${pill('Eʼtiroz', 'blue')}</span>${ic('chev', 18)}</button>`).join('')}</section>` : ''}
            ${rows.length ? `<section class="dv-reqs dv-s1">${rows.map(card).join('')}</section>` : `<div class="dv-empty">${ic('check', 26)}<strong>Kutayotgan soʻrov yoʻq</strong></div>`}
            <div class="dv-info dv-gray">${ic('info', 16)}<span>Qoʻshimcha soat va yakshanba — yuz bilan belgilangan vaqt avtomatik ilova qilinadi. Rad etilsa sabab yoziladi, jarima oʻz holida qoladi.</span></div></div>`;
    }

    const PAGES = { my: pageMy, rules: pageRules, wash: pageWash, detail: pageDetail, issue: pageIssue, washok: pageWashOk };

    // ---------- J04 · popup ----------
    async function checkUnseen() {
        if (!on() || sheetEl || document.querySelector('.dv-sheet-wrap, .dv-cam')) return;
        let r; try { r = await api('/me/unseen'); } catch (e) { return; }
        const f = r.rows?.[0]; if (!f) return;
        const late = /^late_[123]$/.test(f.code);
        const title = late ? `${f.date === tkDate() ? 'Bugun' : dS(f.date)} ${f.evidence?.minutes || ''} daqiqa kechikdingiz`.replace('  ', ' ') : f.label;
        const why = late ? `Bu oyning ${f.lateNo}-kechikishi, shuning uchun <strong>${num(f.amount)} soʻm</strong> jarima yozildi. Hammasi tuzatsa boʻladigan narsa.`
            : `<strong>${num(f.amount)} soʻm</strong> jarima yozildi${f.reason ? ': ' + esc(f.reason) : ''}. Hammasi tuzatsa boʻladigan narsa.`;
        const mins = Math.max(15, Math.ceil(f.amount / (r.washHour || 25000) * 60));
        const end = window.davomat?.state()?.end;
        openSheet(`<section class="dv-sheet" role="dialog" aria-modal="true" aria-labelledby="jrPopT"><div class="dv-head"><span class="jr-pop-ic">${ic('clock', 26)}</span><div class="dv-col"><h2 id="jrPopT">${esc(title)}</h2><p>${why}</p></div></div>
            <div class="jr-easy"><strong>Yuvishning eng oson yoʻli</strong><span>${end ? `Bugun ${esc(end)} dan keyin ${mins} daqiqa qoling — jarima oʻchadi.` : `${mins} daqiqa qoʻshimcha ishlang — jarima oʻchadi.`}</span></div>
            <button type="button" class="dv-btn dv-btn-primary dv-btn-lg" data-jr-popgo="wash">Yuvish yoʻllarini koʻrish</button>
            <div class="jr-two"><button type="button" class="dv-btn dv-btn-outline" data-jr-popgo="detail" data-id="${esc(f.id)}">Eʼtiroz bildirish</button><button type="button" class="dv-btn dv-btn-outline" data-jr-close>Tushunarli</button></div>
            <span class="dv-fine dv-center-t">Faqat oʻzingizga koʻrinadi · jamoa reytingida emas</span></section>`);
        api('/me/seen', { ids: r.rows.map(x => x.id) }).catch(() => {});
    }

    // ---------- hodisalar ----------
    function onInput(e) {
        const t = e.target;
        if (t.dataset.jrF) { issueForm[t.dataset.jrF] = t.value; if (t.tagName === 'SELECT') rerender(); }
    }
    function handle(t, e) {
        const d = t.dataset;
        if ('jrBack' in d) return closePage();
        if ('jrClose' in d) return closeSheet();
        if ('jrReload' in d) { invalidate(''); return rerender(); }
        if ('jrGo' in d) { closeSheet(); return openPage(d.jrGo); }
        if ('jrPopgo' in d) { closeSheet(); return openPage(d.jrPopgo, d.id); }
        if ('jrFine' in d) return openPage('detail', d.jrFine);
        if ('jrMonth' in d) { const [y, m] = S.month.split('-').map(Number); S.month = new Date(Date.UTC(y, m - 1 + Number(d.jrMonth), 1)).toISOString().slice(0, 7); return rerender(); }
        if ('jrRec' in d) { const [emp, date] = d.jrRec.split('|'); const own = data['fine:' + (S.pages[S.pages.length - 1]?.arg || '')]?.v?.mine; return window.davomat?.record?.(own ? null : emp, date); }
        if ('jrHours' in d) return toast('Ish tugagach odatdagidek “Ketdim” bilan belgilang — keyin shu yerda “Bugungi qoʻshimcha vaqtni yuborish” chiqadi');
        if ('jrWreq' in d) return sendWash(d.jrWreq, t, d.date ? { date: d.date } : {});
        if ('jrAppeal' in d) {
            const text = root.querySelector('#jrAppeal')?.value.trim() || '', er = root.querySelector('[data-jr-err]');
            if (text.length < 5) { if (er) er.textContent = 'Nima notoʻgʻri ekanini yozing'; return; }
            t.disabled = true;
            return api(`/${encodeURIComponent(d.jrAppeal)}/appeal`, { text }).then(() => { invalidate('fine:', 'my:'); toast('Eʼtiroz yuborildi — rahbaringiz koʻradi'); rerender(); })
                .catch(err => { t.disabled = false; if (er) er.textContent = err.message; });
        }
        if ('jrAnswer' in d) {
            const answer = root.querySelector('#jrAnswer')?.value.trim() || '', er = root.querySelector('[data-jr-err]');
            t.disabled = true;
            return api(`/${encodeURIComponent(d.jrAnswer)}/appeal/answer`, { accept: d.accept === '1', answer }).then(() => { invalidate('fine:', 'my:', 'appeals'); toast(d.accept === '1' ? 'Jarima bekor qilindi' : 'Eʼtiroz rad etildi'); closePage(); })
                .catch(err => { t.disabled = false; if (er) er.textContent = err.message; });
        }
        if ('jrIssue' in d) { e?.preventDefault(); return issueSend(t); }
        if ('jrWok' in d) {
            const amt = root.querySelector(`[data-jr-taskamt="${d.jrWok}"]`);
            if (amt && !(Number(String(amt.value).replace(/\D/g, '')) > 0)) { amt.focus(); return toast('Vazifa uchun yuviladigan summani kiriting', true); }
            t.disabled = true;
            return api(`/washes/${encodeURIComponent(d.jrWok)}/decide`, { decision: 'approve', ...(amt ? { amount: Number(String(amt.value).replace(/\D/g, '')) || 0 } : {}) })
                .then(r => { invalidate('washinbox'); toast(`Yuvildi: ${num(r.washed)} soʻm`); rerender(); }).catch(err => { t.disabled = false; toast(err.message, true); });
        }
        if ('jrWrej' in d) {
            const reason = window.prompt('Rad etish sababi'); if (!reason || !reason.trim()) return;
            t.disabled = true;
            return api(`/washes/${encodeURIComponent(d.jrWrej)}/decide`, { decision: 'reject', reason: reason.trim() })
                .then(() => { invalidate('washinbox'); toast('Rad etildi'); rerender(); }).catch(err => { t.disabled = false; toast(err.message, true); });
        }
    }
    async function issueSend(btn) {
        const er = root.querySelector('[data-jr-err]');
        if (issueForm.reason.trim().length < 10) { if (er) er.textContent = 'Sababni batafsil yozing'; return; }
        if (!issueForm.evidence.trim()) { if (er) er.textContent = 'Dalilni koʻrsating'; return; }
        btn.disabled = true;
        try {
            const r = await api('', { employeeId: issueForm.emp, code: issueForm.code, reason: issueForm.reason, evidence: { text: issueForm.evidence } });
            Object.assign(issueForm, { reason: '', evidence: '' });
            toast(`Jarima yozildi: ${num(r.amount)} soʻm`); closePage();
        } catch (err) { btn.disabled = false; if (er) er.textContent = err.message; }
    }
    function onClick(e) {
        const t = e.target.closest('button,[data-jr-close]');
        if (t) handle(t, e);
    }
    function onDocClick(e) {
        const t = e.target.closest('[data-jr-go],[data-jr-fine]');
        if (!t || (root && root.contains(t))) return;
        e.preventDefault(); e.stopPropagation();
        handle(t, e);
    }

    // ---------- menyu ma'lumoti va ishga tushirish ----------
    async function refreshCounts() { try { S.counts = await api('/counts'); } catch (e) { /* */ } return S.counts; }
    function boot() {
        if (booted || !on()) return;
        booted = true; mount();
        document.addEventListener('click', onDocClick, true);
        window.addEventListener('popstate', e => {
            if (S.skipPop) { S.skipPop = false; e.stopImmediatePropagation(); return; }
            if (sheetEl) { closeSheet(); e.stopImmediatePropagation(); try { history.pushState({ jr: 1 }, ''); } catch (er) { /* */ } return; }
            if (S.pages.length) { e.stopImmediatePropagation(); closePage(true); }
        }, true);
        refreshCounts();
        try { const q = new URLSearchParams(location.search); if (q.get('tab') === 'jarimalar') openPage('my'); } catch (e) { /* */ }
        setTimeout(checkUnseen, 4000);
        setInterval(() => { if (document.visibilityState === 'visible') checkUnseen(); }, 5 * 60 * 1000);
    }
    function start() { if (!on()) { setTimeout(start, 1500); return; } boot(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.jarima = {
        open: openPage, counts: () => S.counts, refresh: refreshCounts, checkUnseen,
        // Menyu bandlari (host ilovalar o'z ko'rinishida chizadi): [{go, title, sub, badge}]
        menuItems() {
            const c = S.counts || {};
            const out = [];
            if (!c.exempt) out.push({ go: 'my', title: 'Mening jarimalarim', sub: 'maosh va yuvish' });
            if (c.canIssue) out.push({ go: 'washok', title: 'Yuvish soʻrovlari', sub: c.appeals ? `${c.appeals} ta eʼtiroz` : '', badge: (c.washPending || 0) + (c.appeals || 0) },
                { go: 'issue', title: 'Jarima yozish', sub: 'oʻz xodimlaringizga' });
            return out;
        }
    };
})();
