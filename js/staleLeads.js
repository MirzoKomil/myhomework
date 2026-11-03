// "Qotib qolgan lidlar" — sotuv menejeri uchun majburiy tozalash (telefon va kompyuter).
// Qaysi lid: "Bog'lanishga urinilmoqda"da turibdi va hech qachon "Bog'lanildi"ga chiqmagan (bir marta ham telefonni olmagan).
// Kun — menejerga berilgan sanadan (managerAssignedAt). warnDays — ogohlantirish, lockDays — ilova ochilganda qulf oynasi.
// "Sifatsiz"ga o'tkazishdan oldin oxirgi 24 soatda qo'ng'iroq qilingan bo'lishi shart (server ham tekshiradi: CALL_FIRST).
// Kuniga bir marta 5 daqiqalik "zarur ish" imtiyozi. Qoida (kunlar) ROP sozlamasida: /api/leads/stale-rule.
// "Oldi" (telefonni oldi) → "Suhbat qanday bo'ldi?": Gaplashdik → anketa; Keyinroq gaplashishni so'radi → faqat qayta
// qo'ng'iroq vaqti ("follow-up-reminder" + callback: true, 3 kungacha, ko'pi bilan 2 marta); Qiziqmaydi → Sifatsiz (sabab bilan).
// Kelishilgan vaqtdan 2 soat o'tib ham lid bog'lanishdan oldingi bosqichda tursa — yana shu qulf ro'yxatiga qaytadi.
(function () {
    'use strict';
    const g = n => typeof window[n] === 'function';
    const DAY = 86400000, CALL_WINDOW = DAY, GRACE_MS = 5 * 60000;
    // "Keyinroq gaplashamiz": ko'pi bilan CB_MAX marta, CB_MAX_DAYS kun ichidagi vaqtga; vaqt o'tib CB_GRACE ichida hal qilinmasa — qulf.
    const CB_MAX = 2, CB_MAX_DAYS = 3, CB_GRACE = 2 * 3600000;
    const DEFAULT = { warnDays: 3, lockDays: 5, callsPerDay: 30 };
    const CLOSED = new Set(['tolov-yopildi', 'muvaffaqiyatsiz-sotuv', 'sifatsiz-lidlar']);
    const PRE = new Set(['yangi-lidlar', 'boglanishga-urinilmoqda']);
    const AFTER = new Set(['boglanildi', 'malumot-berildi', 'sinov-darsida', 'qaror-jarayonida', 'keyin-sotib-olmoqchi', 'tolov-jarayonida', 'tolov-yopildi']);
    // Qo'ng'iroq DALILI (Sifatsizdan oldingi 24 soatlik tekshiruv, server CALL_EVIDENCE_TYPES bilan bir xil): ikkala tur.
    const CALL_TYPES = new Set(['call-attempt', 'contact-fail']);
    // URINISHLAR SONI: bitta qo'ng'iroq bitta urinish. tel: bosilganda "call-attempt" yoziladi (2 daqiqa ichidagi takror
    // bosish — bitta), "Javob bermadi" natijasi "contact-fail" bo'lib tarixga tushadi — u alohida urinish emas.
    // Faqat oldidan (PAIR_MS ichida) "call-attempt" bo'lmagan "contact-fail" (qo'lda belgilangan / eski yozuv) urinish sanaladi.
    const PAIR_MS = 2 * 3600000;
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
        chat: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>'
    };

    // ---------- qoida ----------
    let rules = { english: { ...DEFAULT }, russian: { ...DEFAULT } }, rulesAt = 0;
    const setRules = r => { rules = { english: { ...DEFAULT, ...(r.english || {}) }, russian: { ...DEFAULT, ...(r.russian || {}) } }; rulesAt = Date.now(); };
    // force=true (qoida sahifasi/oynasi): serverdan o'qib bo'lmasa xato tashlanadi — standart 3/5/30 ko'rsatilib,
    // keyin haqiqiy qoida ustiga saqlanib ketmasin. Fon tekshiruvi (force=false) eski/standart qoida bilan davom etadi.
    async function loadRules(force) {
        if (!force && Date.now() - rulesAt < 10 * 60000) return rules;
        try {
            const r = g('apiFetch') ? await apiFetch('/api/leads/stale-rule', { fresh: true }) : null;
            if (r?.rules) setRules(r.rules);
            else if (force) throw new Error('Qoida javobi boʻsh');
        } catch (e) { if (force) throw e; }
        return rules;
    }
    const ruleFor = lg => rules[lg === 'english' ? 'english' : 'russian'] || DEFAULT;

    // ---------- lidlar ----------
    const callsOf = l => (Array.isArray(l.comments) ? l.comments : []).filter(c => c && CALL_TYPES.has(c.type)).map(c => ({ t: ts(c.createdAt), type: c.type })).filter(c => c.t).sort((a, b) => a.t - b.t);
    // Urinish deb sanaladigan izohlar (vaqt bo'yicha): { t, type, failed } — failed: shu urinishdan keyin "javob yo'q" yozilgan.
    function attemptsOf(l) {
        const all = (Array.isArray(l?.comments) ? l.comments : []).filter(c => c && CALL_TYPES.has(c.type)).map(c => ({ t: ts(c.createdAt), type: c.type })).filter(c => c.t).sort((a, b) => a.t - b.t);
        const out = [];
        for (const c of all) {
            if (c.type === 'call-attempt') { out.push({ t: c.t, type: c.type, failed: false }); continue; }
            const prev = out[out.length - 1];
            if (prev && prev.type === 'call-attempt' && c.t - prev.t <= PAIR_MS && c.t >= prev.t) { prev.failed = true; continue; }
            out.push({ t: c.t, type: c.type, failed: true });
        }
        return out;
    }
    const hasRecentCall = (l, now = Date.now()) => callsOf(l).some(c => now - c.t <= CALL_WINDOW && c.t <= now + 60000);
    // "Keyinroq gaplashishni so'radi" yozuvlari (vaqt bo'yicha): { t — yozilgan, at — kelishilgan vaqt }.
    const callbacksOf = l => (Array.isArray(l?.comments) ? l.comments : []).filter(c => c && c.type === 'follow-up-reminder' && c.callback && ts(c.reminderAt))
        .map(c => ({ t: ts(c.createdAt), at: ts(c.reminderAt) })).sort((a, b) => a.t - b.t);
    const lastCallback = l => { const a = callbacksOf(l); return a.length ? a[a.length - 1] : null; };
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
            const s = st(l);
            if (!PRE.has(s)) continue;
            // Telefonni olgan, keyinroq gaplashishni so'ragan: "olmadi" kunlari endi sanalmaydi. Kelishilgan vaqtdan
            // CB_GRACE o'tib ham natija yozilmagan bo'lsa (lid hali bog'lanishdan oldingi bosqichda) — qulf.
            const cb = lastCallback(l);
            if (cb) { if (now - cb.at >= CB_GRACE) lock.push(l); continue; }
            if (s !== 'boglanishga-urinilmoqda' || !neverConnected(l)) continue;
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
        if (!l || CLOSED.has(st(l))) return; // yopilgan lidlarga qo'ng'iroq hisobga olinmaydi (kunlik qo'ng'iroqlar soni ochiq lidlar bo'yicha)
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
        try { await loadRules(reason === 'load'); } catch (e) { /* oldingi qoida bilan tekshiriladi */ }
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
        document.addEventListener('keydown', onKey, true);
        setInert(true);
        // Ilovaning boshqa pastki oynalari qulf ustida qolmasin (qo'ng'iroq natijasi oynasidan tashqari).
        document.querySelectorAll('.sa-sheet-wrap').forEach(w => { if (!w.querySelector('.sa-sheet--call')) { try { window.sotuvApp?.closeSheet?.(); } catch (e) { w.remove(); } } });
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
        document.removeEventListener('keydown', onKey, true);
        setInert(false);
    }
    // Fon (ilova, CRM) qulf paytida klaviatura/ekran o'quvchi uchun ham yopiq.
    const KEEP = el => el.classList?.contains('sl-wrap') || el.classList?.contains('sl-sheet-wrap') || el.classList?.contains('sl-pill')
        || el.classList?.contains('sa-sheet-wrap') || el.classList?.contains('sdc-wrap') || el.classList?.contains('sa-toast') || el.classList?.contains('dwact') || el.id === 'modalOverlay'
        || ['SCRIPT', 'STYLE', 'LINK'].includes(el.tagName);
    function setInert(on) {
        [...document.body.children].forEach(el => {
            if (on) { if (!KEEP(el) && !el.inert) { el.inert = true; el.dataset.slInert = '1'; } }
            else if (el.dataset.slInert) { el.inert = false; delete el.dataset.slInert; }
        });
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
        const sig = lock.map(l => `${l.id}:${callsOf(l).length}:${callbacksOf(l).length}:${hasRecentCall(l) ? 1 : 0}`).join('|') + '|' + graceUsed()
            + '|' + S.initial.map(id => { const x = g('getLeadById') ? getLeadById(lang(), id) : null; return x ? `${st(x)}:${callbacksOf(x).length}` : ''; }).join(',');
        if (sig === S.sig) return;
        S.sig = sig;
        S.initial = [...new Set([...S.initial, ...lock.map(l => l.id)])];
        const total = S.initial.length, solved = total - lock.length, pct = total ? Math.round(solved / total * 100) : 0;
        const r = ruleFor(lang());
        const rows = lock.map(l => {
            const cb = lastCallback(l);
            if (cb) return cbRow(l, cb);
            const called = hasRecentCall(l), calls = attemptsOf(l), last = callsOf(l).pop(), [bg, fg] = avc(l.id), ph = telOf(l.phone);
            const meta = called
                ? `<span class="sl-ok">${when(last.t)} qoʻngʻiroq qilindi — javob yoʻq</span>`
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
            const s = st(l), cb = PRE.has(s) ? lastCallback(l) : null, ok = AFTER.has(s) || !!cb;
            const txt = AFTER.has(s) ? 'Telefonni oldi — keyingi bosqichga oʻtdi' : cb ? `Keyinroq gaplashadi — ${when(cb.at)}` : s === 'sifatsiz-lidlar' ? 'Sifatsizga oʻtkazildi' : 'Hal qilindi';
            return `<li class="sl-row sl-row--done"><span class="sl-av" style="background:${ok ? '#D1FADF' : '#F1F5F9'};color:${ok ? '#067647' : '#3A4456'}" aria-hidden="true">${esc(initials(l.name))}</span><div class="sl-row-t"><strong>${esc(l.name || '')}</strong><span class="${ok ? 'sl-ok' : ''}">${esc(txt)}</span></div><span class="sl-tick">${ic(I.check, 20, 3)}</span></li>`;
        }).join('');
        const gate = S.el.querySelector('.sl-gate');
        const keepScroll = gate.querySelector('.sl-list')?.scrollTop || 0;
        const ae = document.activeElement, focusKey = ae && gate.contains(ae) ? [...ae.attributes].filter(a => a.name.startsWith('data-sl-')).map(a => `[${a.name}="${a.value}"]`).join('') : '';
        gate.innerHTML = `
          <span class="sl-handle" aria-hidden="true"></span>
          <div class="sl-head"><span class="sl-bell">${ic(I.bell, 26)}</span>
            <div><h2 id="slT">Avval shu ${lock.length} ta lidni hal qilaylik</h2>
            <p>${headText(lock, r)}</p></div></div>
          <div class="sl-prog"><div class="sl-bar" aria-hidden="true"><i style="width:${pct}%"></i></div><span>${solved} / ${total} hal qilindi</span></div>
          <ol class="sl-list">${rows}${solvedRows}</ol>
          <div class="sl-foot"><span>${ic(I.lock, 12, 2.6)} Shu lidlar hal boʻlguncha boshqa boʻlimlar vaqtincha yopiq</span>
            ${graceUsed() ? '<span class="sl-muted">Bugungi 5 daqiqalik imtiyoz ishlatilgan</span>' : '<button type="button" class="sl-link" data-sl-grace>Juda zarur ishim bor (5 daqiqa)</button>'}</div>`;
        const list = gate.querySelector('.sl-list'); if (list) list.scrollTop = keepScroll;
        if (!S.sheet) { const f = focusKey && gate.querySelector(focusKey); (f || gate).focus({ preventScroll: true }); }
    }

    function headText(lock, r) {
        const nCb = lock.filter(l => lastCallback(l)).length, nOld = lock.length - nCb;
        const a = nOld ? `${nCb ? `${nOld} tasi` : 'Ular'} ${r.lockDays} kundan beri “Urinilmoqda”da turibdi va hali bir marta ham telefonni olmadi. Yana bir bor qoʻngʻiroq qiling — olmasa, “Sifatsiz”ga oʻtkazing.` : '';
        const b = nCb ? `${nOld ? `${nCb} tasi bilan` : 'Bu mijozlar bilan'} qayta gaplashish vaqtini kelishgansiz, vaqt oʻtdi. Qoʻngʻiroq qilib, natijasini yozing.` : '';
        return [a, b].filter(Boolean).join(' ');
    }
    // Kelishilgan vaqti o'tgan lid qatori: qo'ng'iroq + "Natija" (Suhbat qanday bo'ldi? oynasi).
    function cbRow(l, cb) {
        const called = hasRecentCall(l) && callsOf(l).pop().t > cb.t, [bg, fg] = avc(l.id), ph = telOf(l.phone), n = callbacksOf(l).length;
        return `<li class="sl-row">
              <div class="sl-row-h"><span class="sl-av" style="background:${bg};color:${fg}" aria-hidden="true">${esc(initials(l.name))}</span>
                <div class="sl-row-t"><strong>${esc(l.name || 'Nomaʼlum')}</strong><span class="sl-bad">${esc(when(cb.at))} ga kelishgan edingiz · natija yozilmadi</span><span>${called ? `<span class="sl-ok">${esc(when(callsOf(l).pop().t))} qoʻngʻiroq qilindi</span>` : `Keyinga surilgan: ${n} / ${CB_MAX}`}</span></div></div>
              <div class="sl-acts${called ? ' is-called' : ''}">
                ${ph ? `<a class="sl-b ${called ? 'sl-b--out' : 'sl-b--pri sl-ring'}" href="tel:${esc(ph)}" data-sl-call="${esc(l.id)}">${ic(I.phone, called ? 16 : 18)}${called ? 'Yana' : 'Qoʻngʻiroq'}</a>` : `<span class="sl-b sl-b--off">Telefon raqami yoʻq</span>`}
                <button type="button" class="sl-b ${called ? 'sl-b--pri' : 'sl-b--ghost'}" data-sl-got="${esc(l.id)}">Natija</button>
              </div></li>`;
    }

    // ---------- ichki oynalar ----------
    function openSheet(html, cls = '') {
        closeSheet();
        S.sheet = document.createElement('div');
        S.sheet.className = 'sl-sheet-wrap';
        S.sheet.innerHTML = `<button type="button" class="sl-sdim" data-sl-sclose aria-label="Yopish"></button><section class="sl-sheet ${cls}" role="dialog" aria-modal="true" tabindex="-1"><span class="sl-handle" aria-hidden="true"></span>${html}</section>`;
        document.body.appendChild(S.sheet);
        S.sheet.addEventListener('click', onClick);
        if (!S.open) S.sheet.addEventListener('keydown', onKey2);
        S.sheet.querySelector('.sl-sheet')?.focus({ preventScroll: true });
    }
    function closeSheet() { S.sheet?.remove(); S.sheet = null; if (S.open && S.el && !S.done) S.el.querySelector('.sl-gate')?.focus({ preventScroll: true }); }
    // Qulf yo'q paytda (CRM'ning "Sifatsiz" o'rami) ochilgan oyna uchun klaviatura.
    function onKey2(e) { if (e.key === 'Escape') { e.preventDefault(); closeSheet(); } }

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
        const calls = attemptsOf(l).slice(-4);
        openSheet(`<div class="sl-sh-h"><span class="sl-ib sl-ib--red">${ic(I.nope, 22)}</span><div><h2>Sifatsizga oʻtkazish</h2><span>${esc(l.name || '')} · ${ageDays(l)} kun</span></div></div>
          <fieldset class="sl-fs"><legend>Sabab</legend>
            <label class="sl-radio"><input type="radio" name="slR" value="no-answer" checked><span><strong>Telefonni olmadi</strong><em>${ageDays(l)} kun · bir marta ham bogʻlanilmadi</em></span></label>
            <label class="sl-radio"><input type="radio" name="slR" value="wrong-phone"><span><strong>Raqam notoʻgʻri / oʻchirilgan</strong></span></label>
          </fieldset>
          <div class="sl-hist"><span class="sl-cap">QOʻNGʻIROQLAR TARIXI · AVTOMATIK</span>${calls.map(c => `<div><span class="sl-red">${ic(I.phone, 14, 2.4)}</span><span>${when(c.t)}</span><em>${c.failed ? 'javob yoʻq' : 'qoʻngʻiroq'}</em></div>`).join('') || '<div><em>—</em></div>'}</div>
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

    // ---------- "Oldi": Suhbat qanday bo'ldi? ----------
    const leadIn = (lg, id) => (g('getLeadById') ? getLeadById(lg, id) : null);
    function openPickedUp(id, lg = lang()) {
        const l = leadIn(lg, id);
        if (!l) return;
        const left = Math.max(0, CB_MAX - callbacksOf(l).length);
        S.pu = { id: String(l.id), lg };
        openSheet(`<div class="sl-sh-h"><span class="sl-ib sl-ib--green">${ic(I.chat, 22)}</span><div><h2 id="slPuT">Suhbat qanday boʻldi?</h2><span>${esc(l.name || 'Lid')}</span></div></div>
          <fieldset class="sl-fs" aria-labelledby="slPuT">
            <label class="sl-radio"><input type="radio" name="slPu" value="talked" checked><span><strong>Gaplashdik</strong><em>Anketa ochiladi — hudud, maqsad, kurs haqida</em></span></label>
            <label class="sl-radio${left ? '' : ' is-off'}"><input type="radio" name="slPu" value="later"${left ? '' : ' disabled'}><span><strong>Keyinroq gaplashishni soʻradi</strong><em>${left ? `Faqat qayta qoʻngʻiroq vaqti soʻraladi · yana ${left} marta mumkin` : `${CB_MAX} marta keyinga surilgan — endi “Gaplashdik” yoki “Qiziqmaydi”`}</em></span></label>
            <label class="sl-radio"><input type="radio" name="slPu" value="junk"><span><strong>Qiziqmaydi yoki notoʻgʻri odam</strong><em>Sabab bilan “Sifatsiz”ga oʻtadi</em></span></label>
          </fieldset>
          <button type="button" class="sl-b sl-b--pri sl-b--xl" data-sl-puok>Davom etish</button>
          <p class="sl-note">Mijoz telefonni oldi — “olmadi” kunlari endi sanalmaydi</p>`);
        S.sheet?.querySelector('section')?.setAttribute('aria-labelledby', 'slPuT');
    }
    function puNext() {
        const pu = S.pu; if (!pu) return;
        const v = S.sheet?.querySelector('input[name="slPu"]:checked')?.value;
        if (v === 'later') { openCallback(pu.id, pu.lg); return; }
        closeSheet(); S.pu = null;
        if (v === 'junk') { if (g('openSifatsizLidFlow')) openSifatsizLidFlow(pu.lg, pu.id); }
        else if (g('requestLeadStageChange')) requestLeadStageChange(pu.lg, pu.id, 'boglanildi', { talked: true });
        setTimeout(() => { S.sig = ''; render(); }, 600);
    }

    const localIso = t => { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
    function cbQuick(now = Date.now()) {
        const n = new Date(now), at = (dd, h) => new Date(n.getFullYear(), n.getMonth(), n.getDate() + dd, h, 0).getTime();
        const out = [['1 soatdan keyin', now + 3600000]];
        if (at(0, 18) > now + 30 * 60000) out.push(['Bugun 18:00', at(0, 18)]);
        out.push(['Ertaga 10:00', at(1, 10)], ['Ertaga 18:00', at(1, 18)]);
        return out;
    }
    // Qayta qo'ng'iroq vaqti (anketa so'ralmaydi). Qo'ng'iroq natijasi oynalaridan ("Keyinroq gaplashamiz") ham chaqiriladi.
    function openCallback(id, lg = lang()) {
        const l = leadIn(lg, id);
        if (!l) return;
        const n = callbacksOf(l).length;
        if (n >= CB_MAX) {
            openSheet(`<div class="sl-center"><span class="sl-lockbox sl-lockbox--amber">${ic(I.clock, 32, 2.2)}</span>
                <h2>${CB_MAX} marta keyinga surilgan</h2>
                <p>${esc(l.name || 'Bu mijoz')} bilan suhbat ${CB_MAX} marta keyinga qoldirildi. Endi natijani yozing: gaplashgan boʻlsangiz — anketa, qiziqmasa — “Sifatsiz”.</p></div>
              <button type="button" class="sl-b sl-b--pri sl-b--xl" data-sl-sclose>Tushunarli</button>`, 'sl-sheet--pop');
            return;
        }
        S.cb = { id: String(l.id), lg };
        const now = Date.now();
        openSheet(`<div class="sl-sh-h"><span class="sl-ib sl-ib--amber">${ic(I.clock, 22)}</span><div><h2 id="slCbT">Qachon qayta qoʻngʻiroq qilasiz?</h2><span>${esc(l.name || 'Lid')} · ${n + 1} / ${CB_MAX}-marta keyinga surish</span></div></div>
          <div class="sl-chips" role="group" aria-label="Tez vaqtlar">${cbQuick(now).map(q => `<button type="button" aria-pressed="false" data-sl-cbq="${localIso(q[1])}">${q[0]}</button>`).join('')}</div>
          <label class="sl-fld"><span>Yoki aniq kun va vaqt</span><input type="datetime-local" id="slCbAt" min="${localIso(now + 5 * 60000)}" max="${localIso(now + CB_MAX_DAYS * DAY)}"></label>
          <span class="sl-err" data-sl-cberr role="alert" hidden></span>
          <button type="button" class="sl-b sl-b--pri sl-b--xl" data-sl-cbok>Saqlash</button>
          <p class="sl-note">Shu vaqtda eslatma keladi. Vaqt oʻtib ${CB_GRACE / 3600000} soat ichida natija yozilmasa, lid yana roʻyxatga qaytadi.</p>`);
        S.sheet?.querySelector('section')?.setAttribute('aria-labelledby', 'slCbT');
        S.sheet?.querySelector('#slCbAt')?.addEventListener('input', e => {
            S.sheet.querySelectorAll('[data-sl-cbq]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.slCbq === e.target.value)));
            const er = S.sheet.querySelector('[data-sl-cberr]'); if (er) er.hidden = true;
        });
    }
    // Tekshiruv (test ham ishlatadi): xato matni yoki ''.
    function callbackError(l, at, now = Date.now()) {
        if (!Number.isFinite(at)) return 'Kun va vaqtni tanlang';
        if (at < now + 60000) return 'Vaqt hozirdan keyin boʻlsin';
        if (at > now + CB_MAX_DAYS * DAY + 60000) return `Eng koʻpi ${CB_MAX_DAYS} kun ichidagi vaqt`;
        if (callbacksOf(l).length >= CB_MAX) return `${CB_MAX} marta keyinga surilgan`;
        return '';
    }
    function saveCallback() {
        const cbs = S.cb; if (!cbs || !S.sheet) return;
        const l = leadIn(cbs.lg, cbs.id); if (!l) { closeSheet(); return; }
        const v = S.sheet.querySelector('#slCbAt')?.value || '';
        const at = v ? new Date(v).getTime() : NaN;
        const err = callbackError(l, at);
        const box = S.sheet.querySelector('[data-sl-cberr]');
        if (err) { if (box) { box.textContent = err; box.hidden = false; } S.sheet.querySelector('#slCbAt')?.focus(); return; }
        const whenTxt = g('formatCommentTime') ? formatCommentTime(new Date(at).toISOString()) : when(at);
        const u = user();
        if (g('updateLeadInStorage') && g('createLeadComment')) {
            updateLeadInStorage(cbs.lg, cbs.id, x => {
                const b = g('normalizeLeadExtras') ? normalizeLeadExtras(x) : x;
                const c = { ...createLeadComment({ text: `Telefonni oldi — keyinroq gaplashishni soʻradi. Qayta qoʻngʻiroq: ${whenTxt}`, author: u.name, type: 'follow-up-reminder' }),
                    reminderAt: new Date(at).toISOString(), callback: true };
                if ((b.comments || []).some(o => o && o.id === c.id)) c.id += '_' + Math.random().toString(36).slice(2, 6);
                return { ...b, comments: [...(b.comments || []), c] };
            });
        }
        S.cb = null; S.pu = null;
        closeSheet();
        S.sig = ''; render();
        try { if (g('renderLeads') && document.getElementById('leadsKanban')) renderLeads(); } catch (e) { /* keyin yangilanadi */ }
        try { window.sotuvApp?.render?.(); } catch (e) { /* ilova yo'q */ }
        try { window.sotDesk?.refreshQueue?.(); } catch (e) { /* kompyuter ko'rinishi yo'q */ }
        if (g('showMiniToast')) showMiniToast(`Eslatma qoʻyildi · ${g('formatLeadFollowUpWhen') ? formatLeadFollowUpWhen(at) : when(at)}`);
    }

    function applySifatsiz(id, reasonId) {
        const l = g('getLeadById') ? getLeadById(lang(), id) : null;
        if (!l || !g('updateLeadInStorage')) return;
        if (!hasRecentCall(l)) { sheetCallFirst(l); return; }
        const id2 = reasonId === 'wrong-phone' ? 'wrong-phone' : 'no-answer';
        // Yorliq CRM ro'yxatidan (statistika yorliq bo'yicha guruhlaydi — bir xil yozilishi shart).
        const crm = (typeof SIFATSIZ_LID_REASONS !== 'undefined' ? SIFATSIZ_LID_REASONS : []).find(r => r.id === id2);
        const reason = { reasonId: id2, label: crm?.label || (id2 === 'wrong-phone' ? "Noto'g'ri telefon raqami (mavjud emas)" : "Telefonni olmadi (bir marta ham bog'lanilmadi)") };
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
        const t = e.target.closest('[data-sl-call],[data-sl-sif],[data-sl-sifok],[data-sl-got],[data-sl-puok],[data-sl-cbq],[data-sl-cbok],[data-sl-grace],[data-sl-graceok],[data-sl-sclose],[data-sl-blocked]');
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
        if ('slGot' in d) { openPickedUp(d.slGot, lang()); return; }
        if ('slPuok' in d) { puNext(); return; }
        if ('slCbq' in d) { const i = S.sheet?.querySelector('#slCbAt'); if (i) { i.value = d.slCbq; i.dispatchEvent(new Event('input')); } return; }
        if ('slCbok' in d) { saveCallback(); return; }
        if ('slGrace' in d) { if (!graceUsed()) sheetGrace(); return; }
        if ('slGraceok' in d) { closeSheet(); startGrace(); return; }
        if ('slBlocked' in d) { sheetBlocked(); return; }
        if ('slSclose' in d) { closeSheet(); }
    }
    function onKey(e) {
        if (!S.open) return;
        // Ustida ilova oynasi (qo'ng'iroq natijasi — telefon .sa-sheet-wrap, kompyuter .sdc-wrap) yoki CRM oynasi ochiq — klaviatura o'shalarniki.
        const ov = document.getElementById('modalOverlay');
        if (document.querySelector('.sa-sheet-wrap, .sdc-wrap') || (ov && ov.style.display && ov.style.display !== 'none')) return;
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
        const left = Math.max(1, rule.lockDays - (warn.length ? ageDays(warn[0]) : rule.lockDays));
        return `<button type="button" class="sl-warn" data-sa-stalewarn>
          <span class="sl-warn-i">${ic(I.clock, 20)}</span>
          <span class="sl-warn-t"><strong>${list.length} ta lid ${rule.warnDays} kundan beri olmayapti</strong>
          <span>${lock.length ? 'Baʼzilarini hoziroq “Sifatsiz”ga oʻtkazish shart' : `<b>${left} kundan keyin</b> “Sifatsiz”ga oʻtkazish shart`}</span></span>
          <span class="sl-warn-c">${ic('<path d="M9 6l6 6-6 6"/>', 18, 2.4)}</span>
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
        try { await loadRules(true); } catch (e) {
            openModal('Qotib qolgan lidlar qoidasi', `<p class="sl-rule-err" role="alert">Qoidani serverdan yuklab boʻlmadi: ${esc(e.message || 'aloqa yoʻq')}. Saqlash oʻchirildi — notoʻgʻri qiymat yozilib ketmasin.</p>`,
                `<button type="button" class="btn-outline-sm" id="slRuleCancel">Yopish</button><button type="button" class="btn-primary-sm" id="slRuleRetry">Qayta urinish</button>`);
            document.getElementById('slRuleCancel')?.addEventListener('click', () => closeModal());
            document.getElementById('slRuleRetry')?.addEventListener('click', () => openRuleModal());
            return;
        }
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
              <label>Majburiy qulf (kun)<input type="number" min="2" max="90" value="${r.lockDays}" data-sl-rule="${lg}:lockDays"></label>
              <label>Kunlik qoʻngʻiroq maqsadi<input type="number" min="1" max="300" value="${r.callsPerDay}" data-sl-rule="${lg}:callsPerDay"></label></div>
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
                if (r?.rules) setRules(r.rules); // serverning tozalangan (cleanRule) qiymatlari
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

    window.staleLeads = { compute, check, logCall, hasRecentCall, attempts: attemptsOf, ageDays, homeCardHtml, openRuleModal, loadRules, rules: () => rules, rule: () => ruleFor(lang()),
        openPickedUp, openCallback, callbacks: callbacksOf, callbackError, CB_MAX, CB_MAX_DAYS, _state: S };
})();
