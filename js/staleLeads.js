// "Qotib qolgan lidlar" — sotuv menejeri uchun majburiy tozalash (telefon va kompyuter).
// Qaysi lid: "Bog'lanishga urinilmoqda"da turibdi va hech qachon "Bog'lanildi"ga chiqmagan (bir marta ham telefonni olmagan).
// Kun — menejerga berilgan sanadan (managerAssignedAt). warnDays — ogohlantirish, lockDays — ilova ochilganda qulf oynasi.
// "Sifatsiz"ga o'tkazishdan oldin oxirgi 24 soatda qo'ng'iroq qilingan bo'lishi shart (server ham tekshiradi: CALL_FIRST).
// Kuniga bir marta 5 daqiqalik "zarur ish" imtiyozi. Qoida (kunlar) ROP sozlamasida: /api/leads/stale-rule.
(function () {
    'use strict';
    const g = n => typeof window[n] === 'function';
    const DAY = 86400000, CALL_WINDOW = DAY, GRACE_MS = 5 * 60000;
    const DEFAULT = { warnDays: 3, lockDays: 5 };
    const PRE = new Set(['yangi-lidlar', 'boglanishga-urinilmoqda']);
    const AFTER = new Set(['boglanildi', 'malumot-berildi', 'sinov-darsida', 'qaror-jarayonida', 'keyin-sotib-olmoqchi', 'tolov-jarayonida', 'tolov-yopildi']);
    const CALL_TYPES = new Set(['call-attempt', 'contact-fail']);
    const AV = [['#DCEBFF', '#0057B8'], ['#FEF0C7', '#93370D'], ['#ECFDF3', '#067647'], ['#F1E8FF', '#5B21B6'], ['#FFE4E8', '#9F1239'], ['#E0F2FE', '#075985']];
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const user = () => (g('getCurrentUser') ? getCurrentUser() : null) || {};
    const isSales = () => user().role === 'sales_manager' && !!user().linkedManagerId;
    const lang = () => user().linkedManagerLang || 'russian';
    const st = l => (g('normalizeLeadStatus') ? normalizeLeadStatus(l.status) : (l.status || 'yangi-lidlar'));
    const ts = v => { const t = typeof v === 'number' ? v : Date.parse(v || ''); return Number.isFinite(t) ? t : 0; };
    const telOf = v => String(v || '').replace(/[^\d+]/g, '');
    const phoneTxt = v => (g('formatPhoneDisplay') ? formatPhoneDisplay(v) : v);
    const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?';
    const avc = id => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AV[h % AV.length]; };
    const hm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    const MON = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const when = t => { const d = new Date(t), n = new Date(); const diff = Math.round((new Date(d.toDateString()) - new Date(n.toDateString())) / DAY);
        return `${diff === 0 ? 'Bugun' : diff === -1 ? 'Kecha' : `${d.getDate()}-${MON[d.getMonth()]}`} ${hm(t)}`; };
    const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
    const ic = (p, s = 20, w = 2.2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
    const I = {
        phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"/>',
        lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
        bell: '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>',
        check: '<path d="M5 12l5 5L20 7"/>', nope: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>'
    };

    // ---------- qoida ----------
    let rules = { english: { ...DEFAULT }, russian: { ...DEFAULT } }, rulesAt = 0;
    async function loadRules(force) {
        if (!force && Date.now() - rulesAt < 10 * 60000) return rules;
        try {
            const r = g('apiFetch') ? await apiFetch('/api/leads/stale-rule', { fresh: true }) : null;
            if (r?.rules) { rules = { english: { ...DEFAULT, ...r.rules.english }, russian: { ...DEFAULT, ...r.rules.russian } }; rulesAt = Date.now(); }
        } catch (e) { /* standart qoida bilan davom etiladi */ }
        return rules;
    }
    const ruleFor = lg => rules[lg === 'english' ? 'english' : 'russian'] || DEFAULT;

    // ---------- lidlar ----------
    const callsOf = l => (Array.isArray(l.comments) ? l.comments : []).filter(c => c && CALL_TYPES.has(c.type)).map(c => ({ t: ts(c.createdAt), type: c.type })).filter(c => c.t).sort((a, b) => a.t - b.t);
    const hasRecentCall = (l, now = Date.now()) => callsOf(l).some(c => now - c.t <= CALL_WINDOW && c.t <= now + 60000);
    const neverConnected = l => !(Array.isArray(l.stageHistory) && l.stageHistory.some(h => h && AFTER.has(h.to)))
        && !(l.connectedSurvey && Object.keys(l.connectedSurvey).length);
    const ageDays = (l, now = Date.now()) => { const t = ts(l.managerAssignedAt) || ts(l.createdAt); return t ? Math.floor((now - t) / DAY) : 0; };
    function myLeads() {
        if (!isSales() || !g('getItem')) return [];
        const all = getItem(STORAGE_KEYS.leads, { english: [], russian: [] }), m = String(user().linkedManagerId);
        return (all[lang()] || []).filter(l => !l.deletedAt && String(l.managerId) === m);
    }
    function compute(now = Date.now()) {
        const r = ruleFor(lang()), warn = [], lock = [];
        for (const l of myLeads()) {
            if (st(l) !== 'boglanishga-urinilmoqda' || !neverConnected(l)) continue;
            const d = ageDays(l, now);
            if (d >= r.lockDays) lock.push(l); else if (d >= r.warnDays) warn.push(l);
        }
        const byAge = (a, b) => ageDays(b, now) - ageDays(a, now);
        return { rule: r, warn: warn.sort(byAge), lock: lock.sort(byAge) };
    }

    // ---------- qo'ng'iroq dalili ----------
    function logCall(id) {
        if (!isSales() || !g('updateLeadInStorage') || !g('createLeadComment')) return;
        const l = g('getLeadById') ? getLeadById(lang(), id) : null;
        if (!l) return;
        const last = callsOf(l).filter(c => c.type === 'call-attempt').pop();
        if (last && Date.now() - last.t < 2 * 60000) return; // ketma-ket bosishlar bitta urinish
        const u = user();
        updateLeadInStorage(lang(), id, x => {
            const b = g('normalizeLeadExtras') ? normalizeLeadExtras(x) : x;
            const c = createLeadComment({ text: 'Qoʻngʻiroq qilindi', author: u.name, type: 'call-attempt' });
            if ((b.comments || []).some(o => o && o.id === c.id)) c.id += '_' + Math.random().toString(36).slice(2, 6);
            return { ...b, comments: [...(b.comments || []), c] };
        });
    }

    // ---------- holat ----------
    const S = { open: false, el: null, initial: [], sheet: null, timer: null, sig: '', pill: null, pillTimer: null, done: false };
    const graceKey = () => `dw_stale_grace_${user().id || user().login || 'u'}_${todayKey()}`;
    const graceUntil = () => { try { return Number(localStorage.getItem(graceKey())) || 0; } catch (e) { return 0; } };
    const graceUsed = () => graceUntil() > 0;
    const inGrace = () => Date.now() < graceUntil();

    async function check(reason) {
        if (!isSales()) return;
        await loadRules(reason === 'load');
        const { lock } = compute();
        if (!lock.length) { if (S.open && !S.done) finish(); return; }
        if (inGrace()) { showPill(); return; }
        openGate(lock);
    }

    // ---------- majburiy oyna ----------
    function openGate(lock) {
        if (S.open) { render(); return; }
        S.open = true; S.done = false;
        S.initial = lock.map(l => l.id);
        hidePill();
        S.el = document.createElement('div');
        S.el.className = 'sl-wrap';
        S.el.innerHTML = '<button type="button" class="sl-dim" data-sl-blocked aria-label="Boshqa boʻlimlar vaqtincha yopiq"></button><section class="sl-gate" role="dialog" aria-modal="true" aria-labelledby="slT" tabindex="-1"></section>';
        document.body.appendChild(S.el);
        document.body.classList.add('sl-locked');
        S.el.addEventListener('click', onClick);
        S.el.addEventListener('keydown', onKey);
        render();
        S.el.querySelector('.sl-gate')?.focus({ preventScroll: true });
        clearInterval(S.timer);
        S.timer = setInterval(() => { if (!S.sheet) render(); }, 1500);
    }
    function closeGate() {
        clearInterval(S.timer); S.timer = null;
        closeSheet();
        S.el?.remove(); S.el = null; S.open = false; S.sig = '';
        document.body.classList.remove('sl-locked');
    }
    function finish() {
        if (!S.el) { closeGate(); return; }
        S.done = true;
        const g2 = S.el.querySelector('.sl-gate');
        if (g2) g2.innerHTML = `<div class="sl-done"><span class="sl-done-i">${ic(I.check, 40, 3)}</span><h2 id="slT">Rahmat! Hammasi joyida</h2><p>Lidlar sifatini toʻgʻri oʻlchashga yordam berdingiz. Ishingizga omad!</p></div>`;
        setTimeout(closeGate, 1700);
    }
    function render() {
        if (!S.el || S.done) return;
        const { lock } = compute();
        if (!lock.length) { finish(); return; }
        const sig = lock.map(l => `${l.id}:${callsOf(l).length}:${hasRecentCall(l) ? 1 : 0}`).join('|') + '|' + graceUsed();
        if (sig === S.sig) return;
        S.sig = sig;
        S.initial = [...new Set([...S.initial, ...lock.map(l => l.id)])];
        const total = S.initial.length, solved = total - lock.length, pct = total ? Math.round(solved / total * 100) : 0;
        const r = ruleFor(lang());
        const rows = lock.map(l => {
            const called = hasRecentCall(l), calls = callsOf(l), last = calls[calls.length - 1], [bg, fg] = avc(l.id), ph = telOf(l.phone);
            const meta = called
                ? `<span class="sl-ok">Bugun ${hm(last.t)} qoʻngʻiroq qilindi — javob yoʻq</span>`
                : `<span>Urinishlar: ${calls.length} · bugun qoʻngʻiroq yoʻq</span>`;
            return `<li class="sl-row">
              <div class="sl-row-h"><span class="sl-av" style="background:${bg};color:${fg}" aria-hidden="true">${esc(initials(l.name))}</span>
                <div class="sl-row-t"><strong>${esc(l.name || 'Nomaʼlum')}</strong><span class="sl-bad">${ageDays(l)} kun · hali bir marta ham olmadi</span>${meta}</div></div>
              <div class="sl-acts${called ? ' is-called' : ''}">
                ${called
                    ? `${ph ? `<a class="sl-b sl-b--out" href="tel:${esc(ph)}" data-sl-call="${esc(l.id)}">${ic(I.phone, 16)}Yana</a>` : ''}<button type="button" class="sl-b sl-b--red" data-sl-sif="${esc(l.id)}">Sifatsizga oʻtkazish</button>`
                    : `${ph ? `<a class="sl-b sl-b--pri sl-ring" href="tel:${esc(ph)}" data-sl-call="${esc(l.id)}">${ic(I.phone, 18)}Qoʻngʻiroq</a>` : `<span class="sl-b sl-b--off">Telefon raqami yoʻq</span>`}<button type="button" class="sl-b sl-b--lock" data-sl-sif="${esc(l.id)}">${ic(I.lock, 14, 2.4)}Sifatsiz</button>`}
                <button type="button" class="sl-b sl-b--ghost" data-sl-got="${esc(l.id)}">Oldi</button>
              </div></li>`;
        }).join('');
        const solvedRows = S.initial.filter(id => !lock.some(l => l.id === id)).map(id => {
            const l = g('getLeadById') ? getLeadById(lang(), id) : null;
            if (!l) return '';
            const s = st(l), ok = AFTER.has(s);
            return `<li class="sl-row sl-row--done"><span class="sl-av" style="background:${ok ? '#D1FADF' : '#F1F5F9'};color:${ok ? '#067647' : '#3A4456'}" aria-hidden="true">${esc(initials(l.name))}</span><div class="sl-row-t"><strong>${esc(l.name || '')}</strong><span class="${ok ? 'sl-ok' : ''}">${ok ? 'Telefonni oldi — keyingi bosqichga oʻtdi' : s === 'sifatsiz-lidlar' ? 'Sifatsizga oʻtkazildi' : 'Hal qilindi'}</span></div><span class="sl-tick">${ic(I.check, 20, 3)}</span></li>`;
        }).join('');
        const gate = S.el.querySelector('.sl-gate');
        const keepScroll = gate.querySelector('.sl-list')?.scrollTop || 0;
        gate.innerHTML = `
          <span class="sl-handle" aria-hidden="true"></span>
          <div class="sl-head"><span class="sl-bell">${ic(I.bell, 26)}</span>
            <div><h2 id="slT">Avval shu ${lock.length} ta lidni hal qilaylik</h2>
            <p>Ular ${r.lockDays} kundan beri “Urinilmoqda”da turibdi va hali bir marta ham telefonni olmadi. Yana bir bor qoʻngʻiroq qiling — olmasa, “Sifatsiz”ga oʻtkazing.</p></div></div>
          <div class="sl-prog"><div class="sl-bar" aria-hidden="true"><i style="width:${pct}%"></i></div><span>${solved} / ${total} hal qilindi</span></div>
          <ol class="sl-list">${rows}${solvedRows}</ol>
          <div class="sl-foot"><span>${ic(I.lock, 12, 2.6)} Shu lidlar hal boʻlguncha boshqa boʻlimlar vaqtincha yopiq</span>
            ${graceUsed() ? '<span class="sl-muted">Bugungi 5 daqiqalik imtiyoz ishlatilgan</span>' : '<button type="button" class="sl-link" data-sl-grace>Juda zarur ishim bor (5 daqiqa)</button>'}</div>`;
        const list = gate.querySelector('.sl-list'); if (list) list.scrollTop = keepScroll;
    }

    // ---------- ichki oynalar ----------
    function openSheet(html, cls = '') {
        closeSheet();
        S.sheet = document.createElement('div');
        S.sheet.className = 'sl-sheet-wrap';
        S.sheet.innerHTML = `<button type="button" class="sl-sdim" data-sl-sclose aria-label="Yopish"></button><section class="sl-sheet ${cls}" role="dialog" aria-modal="true" tabindex="-1"><span class="sl-handle" aria-hidden="true"></span>${html}</section>`;
        document.body.appendChild(S.sheet);
        S.sheet.addEventListener('click', onClick);
        S.sheet.addEventListener('keydown', onKey);
        S.sheet.querySelector('.sl-sheet')?.focus({ preventScroll: true });
    }
    function closeSheet() { S.sheet?.remove(); S.sheet = null; }

    function sheetCallFirst(l) {
        const ph = telOf(l.phone), [bg, fg] = avc(l.id);
        openSheet(`<div class="sl-center"><span class="sl-callring">${ic(I.phone, 34, 2)}</span>
            <h2>Avval bir qoʻngʻiroq qilib koʻring</h2>
            <p>${esc(l.name || 'Bu lid')}ga bugun hali qoʻngʻiroq qilinmagan. Iltimos, avval qoʻngʻiroq qilib koʻring — olmasa, shu yerning oʻzida “Sifatsiz”ga oʻtkazasiz.</p></div>
          <div class="sl-card"><span class="sl-av" style="background:${bg};color:${fg}" aria-hidden="true">${esc(initials(l.name))}</span><div class="sl-row-t"><strong>${esc(l.name || '')}</strong><span>${esc(phoneTxt(l.phone) || '')}</span></div>${ageDays(l) ? `<span class="sl-pill-red">${ageDays(l)} kun</span>` : ''}</div>
          ${ph ? `<a class="sl-b sl-b--pri sl-b--xl" href="tel:${esc(ph)}" data-sl-call="${esc(l.id)}" data-sl-sclose>${ic(I.phone, 20)}Hozir qoʻngʻiroq qilish</a>` : ''}
          <p class="sl-note">Qoʻngʻiroqdan qaytganingizda natijani belgilaysiz</p>`);
    }
    function sheetSifatsiz(l) {
        const calls = callsOf(l).slice(-4);
        openSheet(`<div class="sl-sh-h"><span class="sl-ib sl-ib--red">${ic(I.nope, 22)}</span><div><h2>Sifatsizga oʻtkazish</h2><span>${esc(l.name || '')} · ${ageDays(l)} kun</span></div></div>
          <fieldset class="sl-fs"><legend>Sabab</legend>
            <label class="sl-radio"><input type="radio" name="slR" value="no-answer" checked><span><strong>Telefonni olmadi</strong><em>${ageDays(l)} kun · bir marta ham bogʻlanilmadi</em></span></label>
            <label class="sl-radio"><input type="radio" name="slR" value="wrong-phone"><span><strong>Raqam notoʻgʻri / oʻchirilgan</strong></span></label>
          </fieldset>
          <div class="sl-hist"><span class="sl-cap">QOʻNGʻIROQLAR TARIXI · AVTOMATIK</span>${calls.map(c => `<div><span class="sl-red">${ic(I.phone, 14, 2.4)}</span><span>${when(c.t)}</span><em>${c.type === 'contact-fail' ? 'javob yoʻq' : 'qoʻngʻiroq'}</em></div>`).join('') || '<div><em>—</em></div>'}</div>
          <button type="button" class="sl-b sl-b--red sl-b--xl" data-sl-sifok="${esc(l.id)}">Sifatsizga oʻtkazish</button>
          <p class="sl-note">Rahmat! Bu lidlar sifatini toʻgʻri oʻlchashga yordam beradi</p>`);
    }
    function sheetBlocked() {
        const { lock } = compute();
        openSheet(`<div class="sl-center"><span class="sl-lockbox">${ic(I.lock, 34, 2.2)}</span>
            <h2>Biroz kuting — avval ${lock.length} ta lid qoldi</h2>
            <p>Toʻgʻri tushuning: bu lidlar uzoq vaqt “Urinilmoqda”da tursa, korxona lidlar sifatini notoʻgʻri oʻlchaydi va keyin reklamani yaxshilash qiyinlashadi. Ularga yana bir bor qoʻngʻiroq qiling, olmasa — “Sifatsiz”ga oʻtkazing.</p></div>
          <button type="button" class="sl-b sl-b--pri sl-b--xl" data-sl-sclose>Lidlarga qaytish</button>
          <p class="sl-note">Taxminan 2–3 daqiqalik ish</p>`, 'sl-sheet--pop');
    }
    function sheetGrace() {
        openSheet(`<div class="sl-center"><span class="sl-lockbox sl-lockbox--amber">${ic(I.bolt, 32, 2.2)}</span>
            <h2>5 daqiqa erkin foydalanish</h2>
            <p>Bu imkon kuniga <b>faqat bir marta</b> beriladi — masalan, mijoz oʻzi qoʻngʻiroq qilsa yoki zudlik bilan sinovga yozish kerak boʻlsa. Juda zarur boʻlmasa, avval lidlaringizni toʻgʻrilab oling.</p></div>
          <button type="button" class="sl-b sl-b--pri sl-b--xl" data-sl-sclose>Avval lidlarni toʻgʻrilayman</button>
          <button type="button" class="sl-b sl-b--out sl-b--xl" data-sl-graceok>Ha, ishim zarur — 5 daqiqa</button>
          <p class="sl-note">5 daqiqadan keyin oyna yana ochiladi</p>`, 'sl-sheet--pop');
    }

    function applySifatsiz(id, reasonId) {
        const l = g('getLeadById') ? getLeadById(lang(), id) : null;
        if (!l || !g('updateLeadInStorage')) return;
        if (!hasRecentCall(l)) { sheetCallFirst(l); return; }
        const reason = reasonId === 'wrong-phone'
            ? { reasonId: 'wrong-phone', label: 'Notoʻgʻri telefon raqami (mavjud emas)' }
            : { reasonId: 'no-answer', label: 'Telefonni olmadi (bir marta ham bogʻlanilmadi)' };
        const u = user();
        updateLeadInStorage(lang(), id, x => {
            const b = g('normalizeLeadExtras') ? normalizeLeadExtras(x) : x;
            return { ...b, status: 'sifatsiz-lidlar', sifatsizReason: { reasonId: reason.reasonId, label: reason.label },
                comments: [...(b.comments || []), createLeadComment({ type: 'sifatsiz-lid', text: `Sifatsiz lid: ${reason.label}`, reason: reason.label, author: u.name })] };
        });
        closeSheet();
        S.sig = '';
        render();
        try { if (g('renderLeads')) renderLeads(); } catch (e) { /* ko'rinish keyin yangilanadi */ }
        try { window.sotuvApp?.render?.(); } catch (e) { /* ilova yo'q */ }
    }

    // ---------- imtiyoz ----------
    function startGrace() {
        try { localStorage.setItem(graceKey(), String(Date.now() + GRACE_MS)); } catch (e) { /* saqlab bo'lmasa ham ishlaydi */ }
        closeGate();
        showPill();
    }
    function showPill() {
        if (!S.pill) {
            S.pill = document.createElement('div');
            S.pill.className = 'sl-pill'; S.pill.setAttribute('role', 'status');
            document.body.appendChild(S.pill);
        }
        const tick = () => {
            const left = graceUntil() - Date.now();
            if (left <= 0) { hidePill(); check('grace-end'); return; }
            const m = Math.floor(left / 60000), s = Math.floor(left % 60000 / 1000);
            S.pill.innerHTML = `${ic(I.clock, 14, 2.4)}Erkin rejim · ${m}:${String(s).padStart(2, '0')}`;
        };
        tick();
        clearInterval(S.pillTimer); S.pillTimer = setInterval(tick, 1000);
    }
    function hidePill() { clearInterval(S.pillTimer); S.pillTimer = null; S.pill?.remove(); S.pill = null; }

    // ---------- hodisalar ----------
    function onClick(e) {
        const t = e.target.closest('[data-sl-call],[data-sl-sif],[data-sl-sifok],[data-sl-got],[data-sl-grace],[data-sl-graceok],[data-sl-sclose],[data-sl-blocked]');
        if (!t) return;
        const d = t.dataset;
        if ('slCall' in d) {
            logCall(d.slCall);
            try { window.sotuvApp?.markCall?.(d.slCall); } catch (er) { /* ilova yo'q */ }
            if ('slSclose' in d) setTimeout(closeSheet, 300);
            setTimeout(() => { S.sig = ''; render(); }, 400);
            return; // tel: havolasi o'zi ochiladi
        }
        e.preventDefault();
        const lead = id => (g('getLeadById') ? getLeadById(lang(), id) : null);
        if ('slSif' in d) { const l = lead(d.slSif); if (l) (hasRecentCall(l) ? sheetSifatsiz(l) : sheetCallFirst(l)); return; }
        if ('slSifok' in d) { const r = S.sheet?.querySelector('input[name="slR"]:checked')?.value; applySifatsiz(d.slSifok, r); return; }
        if ('slGot' in d) { if (g('requestLeadStageChange')) requestLeadStageChange(lang(), d.slGot, 'boglanildi'); setTimeout(() => { S.sig = ''; render(); }, 600); return; }
        if ('slGrace' in d) { if (!graceUsed()) sheetGrace(); return; }
        if ('slGraceok' in d) { closeSheet(); startGrace(); return; }
        if ('slBlocked' in d) { sheetBlocked(); return; }
        if ('slSclose' in d) { closeSheet(); }
    }
    function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); if (S.sheet) closeSheet(); else sheetBlocked(); return; }
        if (e.key !== 'Tab') return;
        const scope = S.sheet || S.el;
        const f = [...scope.querySelectorAll('a[href], button:not([disabled]), input')].filter(x => x.offsetParent !== null && !x.classList.contains('sl-dim') && !x.classList.contains('sl-sdim'));
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }

    // ---------- CRM'ning "Sifatsiz" oynasi: qo'ng'iroqsiz o'tkazilmaydi ----------
    function wrapSifatsiz() {
        const orig = window.openSifatsizLidFlow;
        if (typeof orig !== 'function' || orig._sl) return;
        const w = function (lg, leadId) {
            if (user().role === 'sales_manager' && g('getLeadById')) {
                const l = getLeadById(lg, leadId);
                if (l && PRE.has(st(l)) && !hasRecentCall(l)) {
                    try { if (g('closeModal')) closeModal(); } catch (e) { /* oyna yo'q */ }
                    sheetCallFirst(l);
                    try { if (g('renderLeads')) renderLeads(); } catch (e) { /* keyin yangilanadi */ }
                    return;
                }
            }
            return orig.apply(this, arguments);
        };
        w._sl = true;
        window.openSifatsizLidFlow = w;
    }

    // ---------- Bosh sahifa kartasi (ilova) ----------
    function homeCardHtml() {
        if (!isSales()) return '';
        const { warn, lock, rule } = compute();
        const list = warn.concat(lock);
        if (!list.length) return '';
        const left = Math.max(1, rule.lockDays - (warn.length ? ageDays(warn[warn.length - 1]) : rule.lockDays));
        return `<button type="button" class="sl-warn" data-sa-stalewarn>
          <span class="sl-warn-h"><span class="sl-warn-i">${ic(I.clock, 22)}</span><span class="sl-warn-t"><strong>${list.length} ta lid ${rule.warnDays} kundan beri telefonni olmayapti</strong>
          <span>Bugun yana qoʻngʻiroq qiling. ${lock.length ? 'Baʼzilari allaqachon “Sifatsiz”ga oʻtkazilishi shart.' : `<b>${left} kundan keyin</b> ular “Sifatsiz”ga oʻtkazilishi shart boʻladi.`}</span></span></span>
          <span class="sl-warn-f"><span class="sl-stack">${list.slice(0, 4).map(l => { const [bg, fg] = avc(l.id); return `<span class="sl-av sl-av--s" style="background:${bg};color:${fg}">${esc(initials(l.name))}</span>`; }).join('')}</span><span class="sl-warn-b">${ic(I.phone, 15)}Qoʻngʻiroq qilish</span></span>
        </button>`;
    }

    // ---------- ROP: qoida sozlamasi ----------
    function ropButton() {
        const r = user().role;
        if (!['rop', 'admin', 'boshliq'].includes(r)) return;
        const anchor = document.getElementById('addLeadBtn');
        if (!anchor || document.getElementById('slRuleBtn')) return;
        const b = document.createElement('button');
        b.type = 'button'; b.id = 'slRuleBtn'; b.className = 'btn-outline-sm sl-rule-btn';
        b.innerHTML = `${ic(I.clock, 15)}Qotgan lidlar qoidasi`;
        b.addEventListener('click', openRuleModal);
        anchor.parentNode.insertBefore(b, anchor);
    }
    async function openRuleModal() {
        if (!g('openModal')) return;
        await loadRules(true);
        const langs = [['russian', 'Rus tili'], ['english', 'Ingliz tili']];
        const all = g('getItem') ? getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) : {};
        const mgrs = g('getSalesManagers') ? getSalesManagers() : [];
        const now = Date.now(), monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
        const stats = langs.map(([lg, title]) => {
            const r = ruleFor(lg), byM = {};
            for (const l of all[lg] || []) {
                if (l.deletedAt) continue;
                const k = String(l.managerId || ''); if (!k) continue;
                const o = byM[k] || (byM[k] = { lock: 0, warn: 0, closed: 0 });
                if (st(l) === 'boglanishga-urinilmoqda' && neverConnected(l)) { const d = ageDays(l, now); if (d >= r.lockDays) o.lock++; else if (d >= r.warnDays) o.warn++; }
                if (st(l) === 'sifatsiz-lidlar' && (l.comments || []).some(c => c?.type === 'sifatsiz-lid' && /Telefonni olmadi/.test(c.text || '') && ts(c.createdAt) >= monthStart)) o.closed++;
            }
            const rows = Object.entries(byM).filter(([, o]) => o.lock || o.warn || o.closed).map(([id, o]) => `<tr><td>${esc((mgrs.find(m => String(m.id) === id) || {}).name || id)}</td><td>${o.warn}</td><td>${o.lock}</td><td>${o.closed}</td></tr>`).join('');
            return `<div class="sl-rule-lang"><h4>${title}</h4>
              <div class="sl-rule-in"><label>Ogohlantirish (kun)<input type="number" min="1" max="60" value="${r.warnDays}" data-sl-rule="${lg}:warnDays"></label>
              <label>Majburiy qulf (kun)<input type="number" min="2" max="90" value="${r.lockDays}" data-sl-rule="${lg}:lockDays"></label></div>
              ${rows ? `<table class="sl-rule-t"><thead><tr><th>Menejer</th><th>Ogohlantirish</th><th>Qulf</th><th>Bu oy majburan yopildi</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="text-muted" style="margin:6px 0 0">Hozir qotib qolgan lid yoʻq</p>'}</div>`;
        }).join('');
        openModal('Qotib qolgan lidlar qoidasi', `<p class="text-muted" style="margin:0 0 12px">“Bogʻlanishga urinilmoqda”da turib, bir marta ham telefonni olmagan lidlar — menejerga berilgan kundan hisoblanadi. Qulf kuni kelganda sotuv menejeri ilovani ochganda shu lidlarni hal qilmaguncha boshqa ishlarga oʻta olmaydi (kuniga bir marta 5 daqiqalik imtiyoz bor). “Sifatsiz”ga faqat qoʻngʻiroqdan keyin oʻtkaziladi.</p>${stats}`,
            `<button type="button" class="btn-outline-sm" id="slRuleCancel">Yopish</button><button type="button" class="btn-primary-sm" id="slRuleSave">Saqlash</button>`);
        document.getElementById('slRuleCancel')?.addEventListener('click', () => closeModal());
        document.getElementById('slRuleSave')?.addEventListener('click', async () => {
            const patch = {};
            document.querySelectorAll('[data-sl-rule]').forEach(i => { const [lg, k] = i.dataset.slRule.split(':'); (patch[lg] = patch[lg] || {})[k] = Number(i.value); });
            try {
                const r = await apiFetch('/api/leads/stale-rule', { method: 'PUT', body: JSON.stringify({ rules: patch }) });
                if (r?.rules) { rules = r.rules; rulesAt = Date.now(); }
                closeModal();
                if (g('showMiniToast')) showMiniToast('Qoida saqlandi');
            } catch (e) { if (g('showSaveError')) showSaveError(e.message || 'Saqlab boʻlmadi'); }
        });
    }

    // ---------- ishga tushirish ----------
    let started = false, hiddenAt = 0;
    function boot() {
        if (started) return;
        const u = user();
        if (!u.role) return;
        started = true;
        wrapSifatsiz();
        ropButton();
        if (u.role !== 'sales_manager') return;
        // Ilova ochilganda: lidlar yuklangach birinchi tekshiruv.
        let n = 0;
        const wait = () => {
            const ready = g('getItem') && (getItem(STORAGE_KEYS.leads, null)?.[lang()] || []).length > 0;
            if (ready || ++n > 40) { check('load'); return; }
            setTimeout(wait, 500);
        };
        wait();
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
            // Ilovaga qaytildi (qayta ochildi) — 30 soniyadan ko'p yo'q bo'lgan bo'lsa qayta tekshiriladi.
            if (hiddenAt && Date.now() - hiddenAt > 30000) check('resume');
            else if (S.open) { S.sig = ''; render(); }
            hiddenAt = 0;
        });
        if (graceUntil() > Date.now()) showPill();
    }
    const tryBoot = (k = 0) => { boot(); if (!started && k < 60) setTimeout(() => tryBoot(k + 1), 500); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => tryBoot());
    else tryBoot();

    window.staleLeads = { compute, check, logCall, hasRecentCall, homeCardHtml, openRuleModal, _state: S };
})();
