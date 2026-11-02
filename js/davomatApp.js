// Davomat (yuz + joylashuv) — Jamoa telefon ilovasi qatlami (dizayn: "Davomat" D00–D18, DavRules v2).
// Hamma kuzatiladigan rollarda bir xil: sotuv menejeri, ROP, HR, akademik rahbar, yordamchi ustoz.
//  • Bosh sahifa kartasi "Bugungi ish kuni" (D04/D04b/D04c) — host ilova davomat.homeCard() ni joylaydi
//  • Ish boshlanganda qulf (D02 · DavB) → kamera (D01 · DavA) → tabrik (D03 · DavDone)
//  • Ofisda emasman (D05), ish tugaganda ketish oynasi (D06 · DavLeave, "Hali ishlayapman" 30 daq)
//  • Mening davomatim (D07), Javob so'rash (D11), So'rovlar (D12/D13), Xodimlar/Yordamchilar davomati (D08),
//    Kun yozuvi (D09 · DavRecord), Ofis joylashuvi (D15), APK ruxsatlari (D00), holatlar (D17)
// Server: /api/staff-attendance (server/routes/staffAttendance.js). Faqat telefon (≤900px) va login qilingan xodim.
// Uslublar: css/davomatApp.css. Host ilovalar uchun API: window.davomat.
(function () {
    'use strict';
    const API = '/api/staff-attendance';
    const MQ = window.matchMedia('(max-width: 900px)');
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const MON_S = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const WD = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    const DAYS = [['1', 'Du', 'Dushanba'], ['2', 'Se', 'Seshanba'], ['3', 'Ch', 'Chorshanba'], ['4', 'Pa', 'Payshanba'], ['5', 'Ju', 'Juma'], ['6', 'Sh', 'Shanba'], ['7', 'Ya', 'Yakshanba']];
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ls = {
        get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* xotira yopiq */ } }
    };
    const token = () => ls.get('mh_token') || '';
    const user = () => { try { return (typeof getCurrentUser === 'function' ? getCurrentUser() : null) || JSON.parse(ls.get('mh_currentUser') || 'null') || {}; } catch (e) { return {}; } };
    const first = n => String(n || '').trim().split(/\s+/)[0] || '';
    const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?';
    const AVA = [['#DCEBFF', '#0057B8'], ['#FCE7F3', '#9D174D'], ['#F1E8FF', '#5B21B6'], ['#ECFDF3', '#067647'], ['#FEF0C7', '#93370D'], ['#FFE4E8', '#9F1239']];
    const ava = (name, size = 40) => { let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0; const [bg, fg] = AVA[h % AVA.length];
        return `<span class="dv-ava" aria-hidden="true" style="width:${size}px;height:${size}px;background:${bg};color:${fg};font-size:${Math.round(size * .35)}px">${esc(initials(name))}</span>`; };
    // Toshkent vaqti (UTC+5)
    const tk = () => { const d = new Date(Date.now() + 5 * 3600000); return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), wd: d.getUTCDay(), d }; };
    const pm = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '')); return m ? +m[1] * 60 + +m[2] : null; };
    const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const durL = m => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), r = m % 60; return h ? `${h} soat${r ? ' ' + r + ' daq' : ''}` : `${r} daq`; };
    const durS = m => { m = Math.max(0, Math.round(m)); return `${Math.floor(m / 60)} s ${m % 60} d`; };
    const dayLong = date => { const d = new Date(date + 'T00:00:00Z'); return `${WD[d.getUTCDay()]}, ${d.getUTCDate()}-${MON[d.getUTCMonth()]}`; };
    const dayShort = date => `${Number(date.slice(8))}-${MON_S[Number(date.slice(5, 7)) - 1]}`;
    const km = m => (m == null ? '' : m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`);
    const haversine = (a, b) => { const R = 6371000, r = x => x * Math.PI / 180; const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

    const P = {
        back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 6l6 6-6 6"/>', close: '<path d="M18 6L6 18M6 6l12 12"/>',
        sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
        face: '<path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2"/><circle cx="12" cy="11" r="3"/><path d="M8 17a4.5 4.5 0 018 0"/>',
        cam: '<path d="M3 8.5A2.5 2.5 0 015.5 6h2l1.5-2h6L16.5 6h2A2.5 2.5 0 0121 8.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 17.5z"/><circle cx="12" cy="13" r="3.5"/>',
        check: '<path d="M5 12l5 5L20 7"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
        bell: '<path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>', info: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/>',
        moon: '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>', flame: '<path d="M12 2c1 3 4 4.5 4 8.5a4 4 0 01-8 0c0-1.5.5-2.5 1.5-3.5.2 1.5 1 2.5 2 2.5 0-3-.5-5 .5-7.5z"/><path d="M8 15a4 4 0 008 0"/>',
        door: '<path d="M14 3h5a2 2 0 012 2v14a2 2 0 01-2 2h-5"/><path d="M10 17l5-5-5-5M15 12H3"/>', late: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
        absent: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M9 14l6 4M15 14l-6 4"/>', early: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 012 2v14a2 2 0 01-2 2h-5"/>',
        cal: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 3v3M16 3v3"/>', wifi: '<path d="M1 1l22 22M16.7 11.1A10.9 10.9 0 0119 12.6M5 12.6a10.9 10.9 0 015.2-2.5M10.7 5A16 16 0 0122.6 9M1.4 9a16 16 0 014.3-2.7M8.5 16.1a5 5 0 016.9 0M12 20h.01"/>',
        users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/>',
        office: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/>'
    };
    const ic = (n, s = 20, w = 2.2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

    // ---------- holat ----------
    const S = { me: null, loadedAt: 0, flow: null, pages: [], sheet: null, leaveShown: '', permsDone: ls.get('dv_perms_done') === '1', attempts: 0 };
    let root = null, sheetEl = null, toastEl = null, booted = false, timer = null;

    async function api(path, body, method) {
        const opts = { method: method || (body !== undefined ? 'POST' : 'GET'), headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' }, cache: 'no-store' };
        if (body !== undefined) opts.body = JSON.stringify(body);
        let r;
        try { r = await fetch(API + path, opts); }
        catch (e) { throw Object.assign(new Error('Internet yoʻq. Ulanishni tekshirib qayta urinib koʻring'), { offline: true }); }
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error(j.error || 'Xatolik'), { status: r.status });
        return j;
    }
    const native = () => window.DomworkNative || null;
    const safe = (fn, d) => { try { return fn(); } catch (e) { return d; } };
    const on = () => MQ.matches && !!token() && !!user().id && user().role !== 'student';
    const me = () => S.me;
    const tracked = () => !!(S.me && S.me.tracked);
    const ready = () => tracked() && S.me.face === 'approved';
    const approverRole = () => S.me?.approverName?.role || 'rahbaringiz';

    async function refresh(force) {
        if (!on()) return null;
        if (!force && Date.now() - S.loadedAt < 15000) return S.me;
        try { S.me = await api('/me'); S.loadedAt = Date.now(); }
        catch (e) { if (!S.me) return null; }
        evaluate();
        paintHome();
        return S.me;
    }

    // ---------- qulf / ketish oynasi ----------
    const snooze = () => { try { const v = JSON.parse(ls.get('dv_snooze') || 'null'); return v && v.date === tk().date && v.until > Date.now() ? v.until : 0; } catch (e) { return 0; } };
    function livePhase() {
        const m = S.me; if (!m || !m.tracked) return null;
        // Server holati daqiqasiga yangilanadi; oraliqda boshlanish vaqti kelsa — darhol qulf.
        const now = tk().min, start = pm(m.unlockAt || m.start);
        if (m.phase === 'before' && start != null && now >= start) return 'lock';
        if (m.phase === 'late_ok' && start != null && now >= start) return 'lock';
        const leaveAt = pm(m.leaveAt || m.end);
        if (m.phase === 'working' && leaveAt != null && now >= leaveAt) return 'leave';
        return m.phase;
    }
    function lateNow() { const u = pm(S.me?.unlockAt || S.me?.start); return u == null ? 0 : Math.max(0, tk().min - u); }
    function evaluate() {
        if (!ready() || S.flow) return;
        if (window.DomworkNative && !S.permsDone && safe(() => typeof native().cameraGranted === 'function', false)) { showPerms(); return; }
        const ph = livePhase();
        if (ph === 'lock') { if (S.sheet !== 'lock') showLock(); return; }
        if (S.sheet === 'lock') closeSheet(true);
        if (ph === 'leave' && !snooze() && S.sheet !== 'leave' && S.leaveShown !== tk().date + ':' + Math.floor(Date.now() / 1800000)) showLeave();
    }
    function leadLocked() { return ready() && livePhase() === 'leave' && !snooze() && S.me?.kind === 'sales'; }
    // Sotuv ilovasi: yangi lid harakatidan oldin chaqiradi. true — harakat to'xtatildi (ketish oynasi ochildi).
    function guardLead() { if (!leadLocked()) return false; showLeave(); return true; }

    // ---------- bosh sahifa kartasi ----------
    function homeCard() { return on() && tracked() ? `<div class="dv-home-host" data-dv-home>${cardHtml()}</div>` : '<div class="dv-home-host" data-dv-home></div>'; }
    function paintHome() { document.querySelectorAll('[data-dv-home]').forEach(el => { const h = on() && tracked() ? cardHtml() : ''; if (el.innerHTML !== h) el.innerHTML = h; }); }
    function cardHtml() {
        const m = S.me; if (!m || !m.tracked) return '';
        if (m.face !== 'approved') {
            const pend = m.face === 'pending';
            return `<section class="dv-card dv-s1"><div class="dv-card-h"><span class="dv-card-t">Bugungi ish kuni</span>${pill(pend ? 'HR tasdiqlaydi' : 'Yuz namunasi kerak', pend ? 'blue' : 'amber')}</div>
                <p class="dv-p">${pend ? 'Yuz namunangiz HRʼga yuborildi. Tasdiqlangach davomat shu yerda belgilanadi.' : m.face === 'rejected' ? 'Avvalgi namunangiz rad etildi. Yorugʻ joyda, koʻzoynaksiz qayta yuboring.' : 'Davomatni boshlash uchun yuz namunangizni yuboring — HR tasdiqlaydi.'}</p>
                ${pend ? '' : `<button type="button" class="dv-btn dv-btn-primary" data-dv-enroll>${ic('cam', 18)}Yuz namunasini yuborish</button>`}</section>`;
        }
        const ph = livePhase(), t = m.today || {}, now = tk().min;
        const reqRow = `<button type="button" class="dv-row-card dv-s2" data-dv-go="request"><span class="dv-blue-ic">${ic('clock', 20)}</span><span class="dv-col"><strong>Javob soʻrash</strong><em>Kech qolaman · kelmayman · erta ketaman</em></span>${ic('chev', 18)}</button>`;
        if (ph === 'before' || ph === 'off') {
            const start = pm(m.start);
            const head = ph === 'off' ? 'Bugun dam olish kuni' : `Ish vaqtingiz ${esc(m.start)} da boshlanadi`;
            const sub = ph === 'off' ? 'Face ID shart emas · ilova toʻliq ochiq' : `${durL(start - now)} qoldi · Face ID hozir shart emas`;
            return `<section class="dv-dark dv-s1"><div class="dv-dark-h"><span class="dv-dark-ic">${ic(ph === 'off' ? 'moon' : 'sun', 24)}</span><span class="dv-col"><strong>${head}</strong><em>${sub}</em></span></div>
                <button type="button" class="dv-btn dv-btn-white" data-dv-checkin>${ic('cam', 18)}Ofisdaman — hozir belgilash</button>
                <span class="dv-dark-n">${ph === 'off' ? 'Dam olish kuni ofisga kelgan boʻlsangiz, belgilang — alohida yoziladi.' : `Ofisga erta kelgan boʻlsangiz, belgilang — erta kelganingiz yoziladi. ${esc(m.start)} da belgilash majburiy boʻladi.`}</span></section>${reqRow}`;
        }
        if (ph === 'late_ok') {
            const la = m.lateApproval || {};
            return `<section class="dv-card dv-card-ok dv-s1"><div class="dv-dark-h"><span class="dv-ok-ic">${ic('check', 24)}</span><span class="dv-col"><strong class="dv-big">${esc(m.unlockAt)} gacha ruxsatingiz bor</strong><em>${esc([la.by ? la.by + ' tasdiqladi' : 'Tasdiqlangan', (la.reason || '').toLowerCase()].filter(Boolean).join(' · '))}</em></span></div>
                <button type="button" class="dv-btn dv-btn-primary" data-dv-checkin>${ic('cam', 18)}Ofisdaman — belgilash</button>
                <span class="dv-note-s">${esc(m.unlockAt)} gacha ilova ochiq va kechikish yozilmaydi. ${esc(m.unlockAt)} dan keyin belgilash majburiy boʻladi.</span></section>`;
        }
        if (ph === 'lock') return `<section class="dv-card dv-s1"><div class="dv-card-h"><span class="dv-card-t">Bugungi ish kuni</span>${pill(lateNow() > 0 ? `Kechikyapsiz · ${lateNow()} daq` : 'Ish boshlandi', lateNow() > 0 ? 'red' : 'amber')}</div>
            <p class="dv-p">Ish ${esc(m.unlockAt || m.start)} da boshlandi. Ofisda ekaningizni yuz va joylashuv bilan tasdiqlang.</p>
            <button type="button" class="dv-btn dv-btn-primary" data-dv-checkin>${ic('cam', 18)}Keldim — kamerani ochish</button></section>`;
        if (ph === 'outside') return `<section class="dv-card dv-s1" data-dv-go="my" role="button" tabindex="0"><div class="dv-card-h"><span class="dv-card-t">Bugungi ish kuni</span>${pill('Kutilmoqda', 'blue')}</div>
            <p class="dv-p">“Ofisda emasman” yuborildi — ${esc(approverRole())} tasdiqlaydi. Kechikish yozilmaydi.</p></section>`;
        if (ph === 'excused') return `<section class="dv-card dv-s1" data-dv-go="my" role="button" tabindex="0"><div class="dv-card-h"><span class="dv-card-t">Bugungi ish kuni</span>${pill('Sababli', 'blue')}</div>
            <p class="dv-p">Bugun uchun “Kelmayman” soʻrovingiz tasdiqlangan.</p></section>`;
        if (ph === 'missed') return `<section class="dv-card dv-s1" data-dv-go="my" role="button" tabindex="0"><div class="dv-card-h"><span class="dv-card-t">Bugungi ish kuni</span>${pill(t.status === 'pending' ? 'Kutilmoqda' : 'Belgilanmadi', t.status === 'pending' ? 'blue' : 'red')}</div>
            <p class="dv-p">Bugun kelish belgilanmadi. Sabab boʻlsa — rahbaringizga “Javob soʻrash” orqali yozing.</p></section>${reqRow}`;
        // ishda / ketish / ketdi
        const inM = pm(t.inClock), outM = pm(t.outClock), start = pm(m.start), end = pm(m.leaveAt || m.end);
        const worked = inM == null ? 0 : (outM != null ? outM : now) - inM;
        const statusPill = t.status === 'late' ? pill(`Keldingiz ${t.inClock} · kechikdi ${t.lateMinutes} daq`, 'amber')
            : t.status === 'excused' ? pill(`Keldingiz ${t.inClock} · sababli`, 'blue')
            : t.status === 'pending' ? pill(`${t.inClock} · ofisda emas · kutilmoqda`, 'blue') : pill(`Keldingiz ${t.inClock} · oʻz vaqtida`, 'green');
        const pct = start != null && end != null && end > start ? Math.max(0, Math.min(100, Math.round(((outM != null ? outM : now) - start) / (end - start) * 100))) : 0;
        const foot = outM != null ? `<span>Ketdingiz ${esc(t.outClock)}</span><span>Jami ${durS(worked)}</span>`
            : end != null ? `<span>${esc(m.start || '')}</span><span>${now >= end ? `Ketish ${hm(end)} · vaqti boʻldi` : `Ketish ${hm(end)} · ${durL(end - now)} qoldi`}</span>` : `<span>Dam olish kunida ishlayapsiz</span>`;
        return `<section class="dv-card dv-s1" data-dv-go="my" role="button" tabindex="0" aria-label="Mening davomatim">
            <div class="dv-card-h"><span class="dv-card-t">Bugungi ish kuni</span>${statusPill}</div>
            <div class="dv-worked"><strong>${durL(worked)}</strong><span>ishladingiz</span></div>
            <div class="dv-bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
            <div class="dv-foot">${foot}</div>
            ${ph === 'leave' ? `<button type="button" class="dv-btn dv-btn-primary" data-dv-checkout>${ic('cam', 18)}Ketdim — belgilash</button>` : ''}</section>`;
    }
    const pill = (text, tone) => `<span class="dv-pill dv-${tone}">${esc(text)}</span>`;

    // ---------- umumiy oynalar ----------
    function mount() {
        if (root) return;
        root = document.createElement('div'); root.className = 'dv-root'; root.id = 'dvRoot';
        document.body.appendChild(root);
        root.addEventListener('click', onClick);
        document.addEventListener('click', onDocClick, true); // host ilova tugmalaridan oldin (karta, menyu bandlari)
        root.addEventListener('submit', e => e.preventDefault());
    }
    function toast(msg, kind = 'ok') {
        toastEl?.remove();
        toastEl = document.createElement('div'); toastEl.className = 'dv-toast dv-toast-' + kind; toastEl.setAttribute('role', 'status'); toastEl.textContent = msg;
        document.body.appendChild(toastEl);
        const el = toastEl; setTimeout(() => { if (toastEl === el) { el.remove(); toastEl = null; } }, 3400);
    }
    function openSheet(kind, html, { locked = false } = {}) {
        mount(); closeSheet(true);
        S.sheet = kind;
        sheetEl = document.createElement('div');
        sheetEl.className = 'dv-sheet-wrap' + (locked ? ' dv-locked' : '');
        sheetEl.innerHTML = `<div class="dv-dim" ${locked ? '' : 'data-dv-close'}></div>${html}`;
        root.appendChild(sheetEl);
        document.body.classList.add('dv-open');
        setTimeout(() => sheetEl?.querySelector('[data-dv-focus], button, a, textarea, input')?.focus({ preventScroll: true }), 60);
        return sheetEl;
    }
    function closeSheet(silent) {
        if (sheetEl) { sheetEl.remove(); sheetEl = null; }
        S.sheet = null;
        if (!S.pages.length && !S.flow) document.body.classList.remove('dv-open');
        if (!silent) setTimeout(evaluate, 0);
    }
    // Sahifalar (to'liq ekran, orqaga tugmasi bilan). Android "orqaga" — popstate orqali yopiladi.
    function openPage(id, arg) {
        mount();
        S.pages.push({ id, arg });
        try { history.pushState({ dvPage: S.pages.length }, ''); } catch (e) { /* tarix yo'q */ }
        renderPage();
    }
    function closePage(fromPop) {
        S.pages.pop();
        if (!fromPop) { S.skipPop = true; try { history.back(); } catch (e) { S.skipPop = false; } }
        renderPage();
    }
    function renderPage() {
        let el = root.querySelector('.dv-page');
        const top = S.pages[S.pages.length - 1];
        if (!top) { el?.remove(); if (!sheetEl && !S.flow) document.body.classList.remove('dv-open'); paintHome(); return; }
        if (!el) { el = document.createElement('div'); el.className = 'dv-page'; root.prepend(el); }
        document.body.classList.add('dv-open');
        const fn = PAGES[top.id];
        el.dataset.page = top.id;
        el.innerHTML = fn ? fn(top.arg) : '';
        el.scrollTop = 0;
        hydratePhotos(el);
    }
    const rerender = () => { if (S.pages.length) { const el = root.querySelector('.dv-page'); const y = el?.scrollTop || 0; renderPage(); if (el) el.scrollTop = y; } };
    const top = (title, sub, { back = true } = {}) => `<header class="dv-top">${back ? `<button type="button" class="dv-icon-btn" data-dv-back aria-label="Orqaga">${ic('back', 20)}</button>` : ''}
        <div class="dv-col"><h1>${esc(title)}</h1>${sub ? `<span>${esc(sub)}</span>` : ''}</div></header>`;
    const loading = () => `<div class="dv-body">${'<div class="dv-sk"></div>'.repeat(3)}</div>`;
    const errBox = (e, retry) => `<div class="dv-body"><div class="dv-state"><strong>${e?.offline ? 'Internet yoʻq' : 'Yuklab boʻlmadi'}</strong><p>${esc(e?.message || '')}</p><button type="button" class="dv-btn dv-btn-primary" data-dv-reload="${esc(retry)}">Qayta urinish</button></div></div>`;

    // ---------- rasmlar ----------
    const photoCache = new Map();
    function hydratePhotos(el) {
        el.querySelectorAll('img[data-dv-photo]').forEach(async img => {
            const id = img.dataset.dvPhoto; if (!id) return;
            if (!photoCache.has(id)) photoCache.set(id, fetch(`${API}/photos/${encodeURIComponent(id)}`, { headers: { Authorization: 'Bearer ' + token() } })
                .then(r => (r.ok ? r.blob() : null)).then(b => (b ? URL.createObjectURL(b) : '')).catch(() => ''));
            const url = await photoCache.get(id);
            if (url) img.src = url; else img.closest('.dv-photo')?.classList.add('dv-photo-none');
        });
    }

    // ---------- D02 · ish boshlanganda qulf ----------
    function locate() {
        return new Promise(resolve => {
            if (!navigator.geolocation) return resolve({ error: 'Joylashuvni aniqlab boʻlmaydi', code: 'none' });
            navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
                e => resolve({ error: e.code === 1 ? 'Joylashuvga ruxsat berilmagan' : 'Joylashuv aniqlanmadi. GPS yoqilganini tekshiring', code: e.code === 1 ? 'denied' : 'fail' }),
                { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
        });
    }
    const distOf = loc => (S.me?.office?.lat != null && loc && loc.lat != null ? haversine(S.me.office, loc) : null);
    function locRow(loc) {
        if (!loc) return `<li class="dv-step"><span class="dv-step-ic">${ic('pin', 20)}</span><span class="dv-col"><strong>Joylashuv</strong><em>Aniqlanmoqda…</em></span></li>`;
        if (loc.error) return `<li class="dv-step dv-step-warn"><span class="dv-step-ic">${ic('pin', 20)}</span><span class="dv-col"><strong>Joylashuv</strong><em>${esc(loc.error)}</em></span></li>`;
        const d = distOf(loc), inside = d != null && d <= (S.me.office.radius || 150) + Math.min(loc.accuracy || 0, 50);
        return inside ? `<li class="dv-step dv-step-ok"><span class="dv-step-ic">${ic('pin', 20)}</span><span class="dv-col"><strong>Joylashuv</strong><em>Ofisdasiz · ${km(d)}</em></span><span class="dv-ok-t">${ic('check', 22, 3)}</span></li>`
            : `<li class="dv-step dv-step-warn"><span class="dv-step-ic">${ic('pin', 20)}</span><span class="dv-col"><strong>Joylashuv</strong><em>Ofisdan ${km(d)} uzoqdasiz</em></span></li>`;
    }
    function showLock() {
        const m = S.me, late = lateNow();
        const el = openSheet('lock', `<section class="dv-sheet dv-sheet-tall" role="dialog" aria-modal="true" aria-labelledby="dvLockT">
            <div class="dv-center dv-u1"><span class="dv-sun">${ic('sun', 36, 2)}</span><h2 id="dvLockT">Ish kuningizni boshlaymiz</h2>
              <p>Bugun <strong>${esc(m.start)} – ${esc(m.end)}</strong>. Ofisda ekaningizni yuz va joylashuv bilan tasdiqlang — 10 soniya.</p>
              ${late > 0 ? `<span class="dv-pill dv-red dv-pill-lg">Kechikyapsiz · ${late} daqiqa</span>` : ''}</div>
            <ol class="dv-steps dv-u2" data-dv-steps>${locRow(S.loc)}<li class="dv-step dv-step-now"><span class="dv-step-ic dv-blue-ic">${ic('face', 20)}</span><span class="dv-col"><strong>Yuz rasmi</strong><em>Old kamera bilan bitta selfie</em></span><span class="dv-pill dv-blue">Navbatda</span></li></ol>
            <div class="dv-sheet-foot dv-u3"><button type="button" class="dv-btn dv-btn-primary dv-btn-xl dv-ring" data-dv-checkin data-dv-focus>${ic('cam', 20)}Keldim — kamerani ochish</button>
              <button type="button" class="dv-link" data-dv-outside>Ofisda emasman</button>
              <p class="dv-fine">${ic('lock', 12, 2.6)} Tasdiqlaguncha boshqa boʻlimlar vaqtincha yopiq</p></div></section>`, { locked: true });
        locate().then(loc => { S.loc = loc; const ol = el.querySelector('[data-dv-steps]'); if (ol && S.sheet === 'lock') ol.firstElementChild.outerHTML = locRow(loc); });
    }

    // ---------- D06 · ish tugaganda ----------
    function showLeave() {
        const m = S.me, t = m.today || {}, now = tk().min, inM = pm(t.inClock);
        S.leaveShown = tk().date + ':' + Math.floor(Date.now() / 1800000);
        openSheet('leave', `<section class="dv-sheet" role="dialog" aria-modal="true" aria-labelledby="dvLeaveT"><span class="dv-grab" aria-hidden="true"></span>
            <div class="dv-head dv-u1"><span class="dv-moon">${ic('moon', 26)}</span><div class="dv-col"><h2 id="dvLeaveT">Ish kuni tugadi</h2><p>Ketishingizni yuz va joylashuv bilan tasdiqlang. Rahmat, bugun yaxshi ishladingiz!</p></div></div>
            <div class="dv-stats3 dv-u2"><div><span>Keldi</span><strong>${esc(t.inClock || '—')}</strong></div><div><span>Hozir</span><strong>${hm(now)}</strong></div><div class="dv-ok-box"><span>Jami</span><strong>${inM != null ? durS(now - inM) : '—'}</strong></div></div>
            <button type="button" class="dv-btn dv-btn-primary dv-btn-xl" data-dv-checkout data-dv-focus>${ic('cam', 20)}Ketdim — kamerani ochish</button>
            <button type="button" class="dv-btn dv-btn-outline" data-dv-snooze>Hali ishlayapman · 30 daqiqadan keyin eslat</button>
            <div class="dv-info dv-gray">${ic('lock', 18)}<span>${m.kind === 'sales' ? 'Tasdiqlaguncha yangi lid harakatlari yopiq. Qoʻngʻiroq qilish va lidlarni koʻrish ochiq qoladi. ' : ''}20:00 gacha belgilanmasa — “ketish belgilanmagan” deb yoziladi.</span></div></section>`, { locked: true });
    }

    // ---------- D05 · Ofisda emasman ----------
    const OUT_REASONS = ['Mijoz bilan uchrashuv', 'Kasalman', 'Oilaviy sabab', 'Boshqa'];
    function showOutside() {
        const back = S.sheet === 'lock' || S.flow ? 'lock' : null;
        if (S.flow) stopFlow();
        const d = distOf(S.loc);
        const el = openSheet('outside', `<section class="dv-sheet" role="dialog" aria-modal="true" aria-labelledby="dvOutT"><span class="dv-grab" aria-hidden="true"></span>
            <div class="dv-head"><div class="dv-col"><h2 id="dvOutT">Ofisda emasman</h2><span class="dv-sub">Sabab rahbaringizga boradi · u tasdiqlaydi</span></div><button type="button" class="dv-x" data-dv-outclose="${back || ''}" aria-label="Yopish">${ic('close', 18)}</button></div>
            ${d != null ? `<div class="dv-warnbar">${ic('pin', 18)}<span>Siz ofisdan ${km(d)} uzoqdasiz</span></div>` : ''}
            <fieldset class="dv-fs"><legend>Sabab <b>*</b></legend><div class="dv-grid2">${OUT_REASONS.map((r, i) => `<label class="dv-radio"><input type="radio" name="dvOutR" value="${esc(r)}" ${i === 0 ? 'checked' : ''}><span>${esc(r)}</span></label>`).join('')}</div></fieldset>
            <label class="dv-field"><span>Izoh</span><textarea rows="2" id="dvOutNote" maxlength="500" placeholder="Masalan: Bobur aka bilan Navoiy koʻchasida, 11:00 da qaytaman"></textarea></label>
            <div class="dv-info dv-blue">${ic('info', 18)}<span>Yuz rasmi baribir olinadi va joylashuv bilan saqlanadi. Yuborilgach ilova ochiladi — holat “Kutilmoqda”, kechikish yozilmaydi.</span></div>
            <button type="button" class="dv-btn dv-btn-primary dv-btn-xl" data-dv-outsend>${ic('cam', 20)}Selfie olib yuborish</button></section>`, { locked: livePhase() === 'lock' });
        if (!S.loc) locate().then(loc => { S.loc = loc; });
        return el;
    }

    // ---------- D01 · kamera ----------
    const CW = 360, CH = 480;
    async function startCamera(video) {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('Bu qurilmada kamera ishlamaydi'), { code: 'perm' });
        let stream;
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } } }); }
        catch (e) {
            if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw Object.assign(new Error('Kameraga ruxsat berilmagan'), { code: 'perm' });
            throw new Error('Kamerani ochib boʻlmadi. Boshqa ilova kamerani band qilmaganini tekshiring');
        }
        video.srcObject = stream;
        await new Promise(r => { if (video.readyState >= 2) r(); else video.onloadeddata = r; setTimeout(r, 3000); });
        await video.play().catch(() => {});
        return () => stream.getTracks().forEach(t => t.stop());
    }
    function grab(video) {
        const c = document.createElement('canvas'); c.width = CW; c.height = CH;
        const vw = video.videoWidth || 640, vh = video.videoHeight || 480, ratio = CW / CH;
        let sw = vw, sh = vh, sx = 0, sy = 0;
        if (vw / vh > ratio) { sw = vh * ratio; sx = (vw - sw) / 2; } else { sh = vw / ratio; sy = (vh - sh) / 2; }
        c.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, CW, CH);
        return c.toDataURL('image/png');
    }
    const wait = ms => new Promise(r => setTimeout(r, ms));
    function stopFlow() { if (S.flow) { S.flow.cancelled = true; S.flow.stop?.(); S.flow.el?.remove(); S.flow = null; } }
    async function openCamera(kind, outside) {
        closeSheet(true); stopFlow(); mount();
        const m = S.me, late = kind === 'in' && livePhase() === 'lock' ? lateNow() : 0;
        const badge = kind === 'out' ? 'ISH KUNI TUGADI' : livePhase() === 'lock' ? 'ISH VAQTI BOSHLANDI' : outside ? 'OFISDA EMASMAN' : 'OFISGA KELDINGIZMI?';
        const sub = kind === 'out' ? `Ish ${esc(m.leaveAt || m.end)} da tugadi` : livePhase() === 'lock' ? `Ish ${esc(m.unlockAt || m.start)} da boshlandi${late > 0 ? ` · <strong>${late} daqiqa kechikyapsiz</strong>` : ''}`
            : m.start ? `Ish ${esc(m.start)} da boshlanadi` : 'Bugun dam olish kuni';
        const now = new Date(); const greet = now.getHours() < 12 ? 'Xayrli tong' : now.getHours() < 18 ? 'Xayrli kun' : 'Xayrli kech';
        const el = document.createElement('div'); el.className = 'dv-cam'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Kamera');
        el.innerHTML = `<video class="dv-video" playsinline muted autoplay></video>
            <div class="dv-oval" aria-hidden="true"><i class="dv-scan"></i></div>
            <header class="dv-cam-h dv-s1"><span class="dv-cam-badge">${ic('lock', 12, 2.6)}${badge}</span><h1>${greet}, ${esc(first(user().name))}</h1><span class="dv-cam-sub">${sub}</span></header>
            <div class="dv-cam-mid dv-s2"><span class="dv-cam-prompt" aria-live="polite">Yuzingizni ramkaga joylang</span><div class="dv-cam-chips" data-dv-chips></div><div class="dv-count" aria-live="assertive"></div><div class="dv-turn" hidden></div></div>
            <div class="dv-cam-foot dv-s3"><button type="button" class="dv-shutter dv-pulse" data-dv-shoot aria-label="${kind === 'out' ? 'Ketdim' : 'Keldim'} — rasmga olish va tasdiqlash"><span>${ic('cam', 28)}</span></button>
              <strong>${outside ? 'Selfie olib yuborish' : kind === 'out' ? 'Ketdim' : 'Keldim'}</strong>
              ${kind === 'in' && !outside ? '<button type="button" class="dv-link dv-link-light" data-dv-outside>Ofisda emasman</button>' : '<button type="button" class="dv-link dv-link-light" data-dv-camclose>Bekor qilish</button>'}
              <span class="dv-cam-fine">Rasm faqat shu kamerada olinadi — galereyadan yuklab boʻlmaydi.${livePhase() === 'lock' ? '<br>Tasdiqlaguncha ilovaning boshqa boʻlimlari yopiq.' : ''}</span></div>`;
        root.appendChild(el);
        document.body.classList.add('dv-open');
        const flow = S.flow = { el, kind, outside, cancelled: false };
        const chips = el.querySelector('[data-dv-chips]');
        const chip = (icon, text, ok) => `<span class="dv-cam-chip${ok ? '' : ' dv-cam-chip-w'}">${ic(icon, 14, 2.4)}${esc(text)}</span>`;
        flow.geo = locate().then(loc => { S.loc = loc; if (flow.cancelled) return loc; const d = distOf(loc);
            chips.insertAdjacentHTML('afterbegin', loc.error ? chip('pin', loc.error, false) : d != null && d <= (m.office.radius || 150) + 50 ? chip('pin', 'Ofisdasiz · ' + km(d), true) : chip('pin', 'Ofisdan ' + km(d), false)); return loc; });
        try {
            flow.stop = await startCamera(el.querySelector('video'));
            if (flow.cancelled) { flow.stop(); return; }
            chips.insertAdjacentHTML('beforeend', chip('check', 'Kamera tayyor', true));
        } catch (e) { stopFlow(); return showState(e.code === 'perm' ? 'perm' : 'error', { message: e.message, kind, outside }); }
    }
    async function shoot() {
        const flow = S.flow; if (!flow || flow.busy) return;
        flow.busy = true;
        const el = flow.el, video = el.querySelector('video'), prompt = el.querySelector('.dv-cam-prompt'), count = el.querySelector('.dv-count');
        el.querySelector('[data-dv-shoot]').disabled = true;
        const tickDown = async (n, text) => { prompt.textContent = text; for (let s = n; s > 0; s--) { count.textContent = s; await wait(1000); if (flow.cancelled) throw Object.assign(new Error('x'), { cancelled: true }); } count.textContent = ''; el.classList.add('dv-flash'); setTimeout(() => el.classList.remove('dv-flash'), 220); };
        try {
            const ch = await api('/me/challenge', {});
            await tickDown(2, 'Kameraga toʻgʻri qarang');
            const front = grab(video);
            const turn = el.querySelector('.dv-turn'); turn.hidden = false; turn.textContent = ch.direction === 'left' ? '⟵' : '⟶'; turn.dataset.dir = ch.direction;
            await tickDown(2, ch.direction === 'left' ? 'Endi boshingizni sekin CHAPGA buring' : 'Endi boshingizni sekin OʻNGGA buring');
            const turned = grab(video);
            flow.stop?.(); turn.hidden = true;
            prompt.textContent = 'Tekshirilmoqda — 10–20 soniya';
            el.classList.add('dv-busy');
            const loc = await flow.geo;
            const body = { kind: flow.kind, challenge: ch.id, frame: front, turned, location: loc && !loc.error ? loc : null,
                ...(flow.outside ? { outside: flow.outside } : {}) };
            let res;
            for (let n = 0; ; n++) {
                try { res = await api('/me/check', body); break; }
                catch (e) { if (e.status !== 503 || n >= 4) throw e; prompt.textContent = 'Navbat band — bir necha soniyada qayta tekshiriladi…'; await wait(5000 + n * 3000); if (flow.cancelled) return; }
            }
            if (flow.cancelled) return;
            stopFlow();
            if (!res.ok) { S.attempts++; return showState(res.reason, { message: res.message, distance: res.distance, kind: flow.kind, outside: flow.outside }); }
            S.attempts = 0;
            S.loadedAt = 0; await refresh(true);
            showDone(res, front, flow);
        } catch (e) {
            if (e.cancelled) return;
            const k = flow.kind, o = flow.outside;
            stopFlow();
            showState(e.offline ? 'offline' : 'error', { message: e.message, kind: k, outside: o });
        }
    }

    // ---------- D03 · tabrik / D17 · holatlar ----------
    function showDone(res, selfie, flow) {
        const t = res.today || {}, late = flow.kind === 'in' && t.lateMinutes > 0;
        const conf = late || flow.outside ? '' : ['#12B76A', '#F79009', '#3B8BEE', '#F04438', '#12B76A', '#FDB022'].map((c, i) => `<i class="dv-conf" style="left:${10 + i * 15}%;background:${c};animation-delay:${[.1, .5, .2, .7, .35, .05][i]}s"></i>`).join('');
        if (late) return showState('late', { minutes: t.lateMinutes, clock: res.clock });
        let title, pills, box = '';
        if (flow.outside) {
            title = 'Yuborildi';
            pills = `${pill(`${res.clock} · kutilmoqda`, 'blue')}${res.distance != null ? `<span class="dv-pill dv-gray dv-pill-lg">Ofisdan ${km(res.distance)}</span>` : ''}`;
            box = `<div class="dv-streak dv-streak-blue">${ic('clock', 20)}<span class="dv-col"><strong>${esc(approverRole())} tasdiqlaydi</strong><em>Javob bot va bildirishnoma orqali keladi. Kechikish yozilmaydi.</em></span></div>`;
        } else if (flow.kind === 'out') {
            const inM = pm(t.inClock), outM = pm(t.outClock);
            title = `Xayr, ${esc(first(user().name))}!`;
            pills = `${pill(`Ketdingiz ${res.clock}`, 'green')}${inM != null && outM != null ? `<span class="dv-pill dv-gray dv-pill-lg">Jami ${durS(outM - inM)}</span>` : ''}`;
            if (t.earlyMinutes) box = `<div class="dv-streak">${ic('clock', 20)}<span class="dv-col"><strong>${t.earlyMinutes} daqiqa erta ketdingiz</strong><em>Keyingi safar oldindan “Javob soʻrash” orqali yozing.</em></span></div>`;
        } else {
            title = `Xush kelibsiz, ${esc(first(user().name))}!`;
            const early = pm(S.me?.start) != null && pm(res.clock) < pm(S.me.start);
            pills = `${pill(`${res.clock} · ${t.status === 'excused' ? 'ruxsat bilan' : early ? 'erta keldingiz' : 'oʻz vaqtida'}`, 'green')}${res.distance != null ? `<span class="dv-pill dv-gray dv-pill-lg">Ofisda · ${km(res.distance)}</span>` : ''}`;
            if (res.streak > 0) box = `<div class="dv-streak">${ic('flame', 20)}<span class="dv-col"><strong>${res.streak} kun ketma-ket vaqtida</strong><em>${res.monthLate ? `Shu oyda ${res.monthLate} marta kechikdingiz` : 'Shu oyda bitta ham kechikish yoʻq'}</em></span></div>`;
        }
        openSheet('done', `${conf}<section class="dv-pop" role="dialog" aria-modal="true" aria-labelledby="dvDoneT">
            <div class="dv-selfie"><img src="${esc(selfie)}" alt="Bugungi selfie"><span class="dv-selfie-ok">${ic('check', 20, 3)}</span></div>
            <h2 id="dvDoneT">${title}</h2><div class="dv-pills">${pills}</div>${box}
            <button type="button" class="dv-btn dv-btn-primary dv-btn-xl" data-dv-close data-dv-focus>${flow.kind === 'out' ? 'Yopish' : 'Ishni boshlash'}</button>
            ${flow.kind === 'in' && !flow.outside ? '<span class="dv-fine">Kechiksangiz shu yerda nechchi daqiqa ekani koʻrinadi</span>' : ''}</section>`);
    }
    function showState(code, o = {}) {
        const again = `data-dv-again="${o.kind || 'in'}"${o.outside ? ` data-dv-again-out='${esc(JSON.stringify(o.outside))}'` : ''}`;
        const lockNow = livePhase() === 'lock';
        const V = {
            mismatch: ['amber', 'face', 'Yuz toʻliq mos kelmadi', 'Yorugʻroq joyda, yuzni ramka markazida tutib qayta urinib koʻring. 2-urinishdan keyin rasm HRʼga yuboriladi — vaqtingiz saqlanadi.',
                `<button type="button" class="dv-btn dv-btn-primary" ${again}>Qayta urinish</button>${S.attempts >= 2 ? '<button type="button" class="dv-link" data-dv-tohr>HRʼga yuborish</button>' : ''}`],
            outside: ['red', 'pin', 'Siz ofis hududidan tashqaridasiz', `${o.distance != null ? `Ofisgacha taxminan ${km(o.distance)}. ` : ''}Ofisga kelgach qayta tekshiring yoki «Ofisda emasman» orqali sabab yozing.`,
                `<button type="button" class="dv-btn dv-btn-primary" ${again}>Qayta tekshirish</button><button type="button" class="dv-link" data-dv-outside>Ofisda emasman</button>`],
            low_accuracy: ['red', 'pin', 'Joylashuv ishonchsiz', 'GPS aniqligi past yoki soxta joylashuv ilovasi yoqilgan. Uni oʻchiring, derazaga yaqinroq turing yoki «Ofisda emasman» orqali sabab yozing.',
                `<button type="button" class="dv-btn dv-btn-primary" ${again}>Qayta tekshirish</button><button type="button" class="dv-link" data-dv-outside>Ofisda emasman</button>`],
            perm: ['blue', 'shield', 'Kamera yoki joylashuvga ruxsat yoʻq', 'Ruxsatsiz davomat belgilanmaydi. Telefon sozlamalarida Jamoa ilovasiga kamera va joylashuvni yoqing.',
                `<button type="button" class="dv-btn dv-btn-primary" data-dv-settings>Sozlamalarni ochish</button><button type="button" class="dv-link" ${again}>Qayta urinish</button>`],
            offline: ['gray', 'wifi', 'Internet yoʻq', 'Belgilash yuborilmadi. Internetga ulanib qayta urinib koʻring — vaqt server boʻyicha yoziladi, shuning uchun imkon qadar tezroq yuboring.',
                `<button type="button" class="dv-btn dv-btn-primary" ${again}>Qayta urinish</button>`],
            late: ['amber', 'clock', `Kechikdingiz · ${o.minutes} daqiqa`, `Bugun ${esc(o.clock || '')} da belgiladingiz. Keyingi safar kech qolsangiz, oldindan «Javob soʻrash» orqali rahbaringizga yozing.`,
                '<button type="button" class="dv-btn dv-btn-primary" data-dv-close>Ishni boshlash</button>'],
        };
        if (code === 'no_location') code = 'low_accuracy';
        if (code === 'low_accuracy_phone') code = 'low_accuracy';
        const v = V[code] || ['amber', 'info', 'Belgilanmadi', o.message || 'Qayta urinib koʻring.', `<button type="button" class="dv-btn dv-btn-primary" ${again}>Qayta urinish</button>${o.kind !== 'out' ? '<button type="button" class="dv-link" data-dv-outside>Ofisda emasman</button>' : ''}`];
        openSheet('state', `<section class="dv-sheet" role="dialog" aria-modal="true" aria-labelledby="dvStT"><span class="dv-grab" aria-hidden="true"></span>
            <div class="dv-state-h"><span class="dv-state-ic dv-${v[0]}">${ic(v[1], 22)}</span><strong id="dvStT">${v[2]}</strong></div>
            <p class="dv-p">${v[3]}</p>${code !== 'late' && o.message && V[code] ? `<p class="dv-fine">${esc(o.message)}</p>` : ''}
            <div class="dv-stack">${v[4]}</div></section>`, { locked: lockNow && code !== 'late' });
    }

    // ---------- D00 · APK ruxsatlari ----------
    function permState() {
        const N = native();
        return { cam: safe(() => N.cameraGranted(), false), loc: safe(() => N.locationGranted(), false), notif: safe(() => N.notifGranted(), false) };
    }
    function showPerms() {
        const p = permState(), n = [p.cam, p.loc, p.notif].filter(Boolean).length;
        if (n === 3) { S.permsDone = true; ls.set('dv_perms_done', '1'); if (S.sheet === 'perms') closeSheet(); return; }
        const next = !p.cam ? 'cam' : !p.loc ? 'loc' : 'notif';
        const row = (k, icon, title, sub, okv) => `<li class="dv-perm${okv ? ' dv-perm-ok' : next === k ? ' dv-perm-now' : ''}"><span class="dv-step-ic dv-blue-ic">${ic(icon, 22)}</span>
            <span class="dv-col"><strong>${title}</strong><em>${sub}</em></span>${okv ? `<span class="dv-ok-t dv-perm-g">${ic('check', 16, 2.8)}Berildi</span>`
            : `<button type="button" class="dv-btn ${next === k ? 'dv-btn-primary' : 'dv-btn-outline'} dv-btn-sm" data-dv-perm="${k}">Ruxsat berish</button>`}</li>`;
        openSheet('perms', `<section class="dv-full" role="dialog" aria-modal="true" aria-labelledby="dvPermT">
            <div class="dv-center dv-s1"><span class="dv-shield">${ic('shield', 36, 2)}</span><h1 id="dvPermT">Davomat uchun 3 ta ruxsat</h1><p>Ish kunini yuz va joylashuv bilan belgilaysiz. Ruxsatlar faqat belgilash paytida ishlatiladi.</p></div>
            <ol class="dv-steps dv-s2">${row('cam', 'cam', 'Kamera', 'Faqat old kamera, belgilash paytida bitta selfie', p.cam)}${row('loc', 'pin', 'Joylashuv', 'Ofisdaligingizni tekshirish uchun. Fonda kuzatilmaydi', p.loc)}${row('notif', 'bell', 'Bildirishnomalar', 'Ish boshlanishi va tugashida eslatma, ilova yopiq boʻlsa ham', p.notif)}</ol>
            <div class="dv-full-foot"><div class="dv-info dv-gray">${ic('shield', 16)}<span>Ruxsat bermasangiz, davomatni belgilab boʻlmaydi va ish vaqtida ilova ochilmaydi. Keyin telefon sozlamalaridan yoqish mumkin.</span></div>
              <button type="button" class="dv-btn dv-btn-xl ${n === 3 ? 'dv-btn-primary' : 'dv-btn-off'}" ${n === 3 ? 'data-dv-close' : 'disabled aria-disabled="true"'}>Davom etish · ${n} / 3</button></div></section>`, { locked: true });
    }
    window.dwNativeChangedDv = () => { if (S.sheet === 'perms') showPerms(); };

    // ---------- Sahifalar ----------
    const data = {};
    async function load(key, fn) {
        if (data[key]?.loading) return;
        data[key] = { ...(data[key] || {}), loading: true, err: null };
        try { data[key] = { v: await fn(), at: Date.now() }; } catch (e) { data[key] = { err: e }; }
        rerender();
    }
    const got = (key, fn, ttl = 20000) => { const d = data[key]; if (!d || (!d.loading && Date.now() - (d.at || 0) > ttl && !d.err)) load(key, fn); return data[key] || { loading: true }; };
    const invalidate = (...keys) => keys.forEach(k => { for (const x of Object.keys(data)) if (x.startsWith(k)) delete data[x]; });

    const ST = { on_time: ['Vaqtida', 'green', 'g'], present: ['Vaqtida', 'green', 'g'], late: ['Kechikdi', 'amber', 'y'], absent: ['Kelmadi', 'red', 'r'], excused: ['Sababli', 'blue', 'b'],
        leave: ['Taʼtilda', 'blue', 'b'], pending: ['Kutilmoqda', 'blue', 'b'], waiting: ['Kutilmoqda', 'blue', ''], upcoming: ['Hali erta', 'gray', ''], off: ['Dam olish', 'gray', 'o'],
        extra: ['Dam kunida keldi', 'blue', 'g'], before: ['Hisob boshlanmagan', 'gray', ''], not_ready: ['Yuz tasdiqlanmagan', 'gray', ''] };
    const stPill = (d) => { const s = ST[d.status] || [d.status, 'gray']; return pill(d.status === 'late' && d.lateMinutes ? `Kechikdi ${d.lateMinutes} daq` : s[0], s[1]); };
    const schedText = days => { const g = {}; for (const [k, l] of DAYS) if (days?.[k]) { const v = `${days[k].start}–${days[k].end}`; (g[v] ||= []).push(l); }
        return Object.entries(g).map(([v, ds]) => `${ds.length > 2 && DAYS.findIndex(d => d[1] === ds[ds.length - 1]) - DAYS.findIndex(d => d[1] === ds[0]) === ds.length - 1 ? ds[0] + '–' + ds[ds.length - 1] : ds.join(', ')} ${v}`).join(' · ') || 'kiritilmagan'; };

    // D07 · Mening davomatim
    const myState = { month: tk().date.slice(0, 7) };
    function pageMy() {
        const mo = got('month:' + myState.month, () => api('/me/month?month=' + myState.month));
        const rq = got('myreq', () => api('/me/requests'));
        const sched = S.me?.days ? schedText(S.me.days) : '';
        const [y, mm] = myState.month.split('-').map(Number);
        let body = '';
        const reqs = (rq.v?.rows || []).slice(0, 6);
        const reqSec = reqs.length ? `<section class="dv-list dv-s1"><h2>Soʻrovlarim</h2>${reqs.map(r => `<div class="dv-li"><span class="dv-col"><strong>${esc(r.day)} · ${esc(r.typeLabel.toLowerCase())}${r.time && r.type !== 'outside' ? ', ' + esc(r.time) : ''}</strong>
            <em>${esc(r.reason)}${r.state === 'pending' ? ` · ${esc(rq.v.approver?.name || r.approverRole)}ga yuborildi ${esc(r.createdClock)}` : r.state === 'rejected' && r.decisionReason ? ' · ' + esc(r.decisionReason) : r.decidedBy ? ' · ' + esc(r.decidedBy) : ''}</em></span>
            ${pill(r.state === 'pending' ? 'Kutilmoqda' : r.state === 'approved' ? 'Tasdiqlandi' : 'Rad etildi', r.state === 'pending' ? 'amber' : r.state === 'approved' ? 'green' : 'red')}
            ${r.state === 'pending' ? `<button type="button" class="dv-link dv-link-red" data-dv-cancel="${esc(r.id)}">Bekor qilish</button>` : ''}</div>`).join('')}</section>` : '';
        if (mo.err) body = errBox(mo.err, 'my');
        else if (!mo.v) body = `<div class="dv-sk"></div><div class="dv-sk dv-sk-tall"></div>`;
        else {
            const v = mo.v, tt = v.totals;
            const firstWd = (new Date(Date.UTC(y, mm - 1, 1)).getUTCDay() + 6) % 7;
            const cells = Array(firstWd).fill('<span class="dv-c dv-c-e"></span>').concat(v.days.map(d => { const cls = (ST[d.status] || [])[2] || ''; const today = d.date === tk().date;
                return `<button type="button" class="dv-c ${cls ? 'dv-c-' + cls : ''}${today ? ' dv-c-today' : ''}" ${d.inClock || d.status === 'excused' ? `data-dv-day="${d.date}"` : 'tabindex="-1"'} aria-label="${Number(d.date.slice(8))}-${MON[mm - 1]}: ${esc((ST[d.status] || [d.status])[0])}">${Number(d.date.slice(8))}</button>`; }));
            const recent = v.days.filter(d => d.date <= tk().date && (d.inClock || ['excused', 'absent', 'late'].includes(d.status))).reverse().slice(0, 8);
            body = `<div class="dv-monthbar dv-s1"><button type="button" class="dv-icon-btn dv-ghost" data-dv-month="-1" aria-label="Oldingi oy">${ic('back', 18)}</button><strong>${MON[mm - 1][0].toUpperCase() + MON[mm - 1].slice(1)} ${y}</strong>
                <button type="button" class="dv-icon-btn dv-ghost" data-dv-month="1" aria-label="Keyingi oy" ${myState.month >= tk().date.slice(0, 7) ? 'disabled' : ''}>${ic('chev', 18)}</button></div>
              <div class="dv-tot3 dv-s1"><div><span class="dv-t-g">Vaqtida</span><strong>${tt.on_time}</strong></div><div><span class="dv-t-y">Kechikdi</span><strong>${tt.late}${tt.lateMinutes ? ` <small>· ${tt.lateMinutes} daq</small>` : ''}</strong></div><div><span class="dv-t-b">Sababli</span><strong>${tt.excused}</strong></div></div>
              <section class="dv-cal dv-s2" aria-label="${MON[mm - 1]} kalendari"><div class="dv-cal-h" aria-hidden="true">${DAYS.map(d => `<span>${d[1]}</span>`).join('')}</div><div class="dv-cal-g">${cells.join('')}</div>
                <div class="dv-legend">${[['g', 'Vaqtida'], ['y', 'Kechikdi'], ['r', 'Kelmadi'], ['b', 'Sababli'], ['o', 'Dam olish']].map(([c, l]) => `<span><i class="dv-c-${c}"></i>${l}</span>`).join('')}</div></section>
              ${recent.length ? `<section class="dv-list dv-s3">${recent.map(d => `<button type="button" class="dv-li dv-li-btn" data-dv-day="${d.date}"><span class="dv-col"><strong>${dayShort(d.date).replace(/-(\w+)$/, (x, s) => '-' + s)}, ${WD[new Date(d.date + 'T00:00:00Z').getUTCDay()]}</strong>
                <em>${d.inClock ? `${esc(d.inClock)} → ${esc(d.outClock || '…')}${d.workedMinutes ? ' · ' + durS(d.workedMinutes) : ''}` : esc(d.note || '')}${d.approvedBy ? ' · ' + esc(d.approvedBy) + ' tasdiqladi' : ''}</em></span>${stPill(d)}</button>`).join('')}</section>
              <span class="dv-fine dv-center-t">Kunni bossangiz — selfie va vaqtlar ochiladi</span>` : ''}`;
        }
        return `${top('Mening davomatim', sched ? 'Grafik: ' + sched : '')}<div class="dv-body">
            <button type="button" class="dv-btn dv-btn-primary dv-btn-lg dv-s1" data-dv-go="request">${ic('clock', 20)}Javob soʻrash</button>${reqSec}${body}</div>`;
    }

    // D11 · Javob so'rash
    const RQ_REASONS = ['Shifokor', 'Kasallik', 'Oilaviy', 'Transport', 'Boshqa'];
    const rqForm = { type: 'late', day: 'today', date: '', time: '', reason: '', comment: '' };
    function pageRequest() {
        const m = S.me || {}, today = tk().date;
        const tomorrow = new Date(Date.parse(today + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
        const date = rqForm.day === 'today' ? today : rqForm.day === 'tomorrow' ? tomorrow : rqForm.date;
        const wd = date ? String(new Date(date + 'T00:00:00Z').getUTCDay() || 7) : null;
        const dsch = wd && m.days ? m.days[wd] : null;
        const tLabel = rqForm.type === 'late' ? 'Qachon kelasiz' : 'Qachon ketasiz';
        let hint = '';
        if (dsch && rqForm.time && pm(rqForm.time) != null) {
            hint = rqForm.type === 'late' ? `Ish ${dsch.start} da boshlanadi · ${durL(pm(rqForm.time) - pm(dsch.start))}` : `Ish ${dsch.end} da tugaydi · ${durL(pm(dsch.end) - pm(rqForm.time))} erta`;
        } else if (dsch) hint = rqForm.type === 'late' ? `Ish ${dsch.start} da boshlanadi` : `Ish ${dsch.end} da tugaydi`;
        else if (date) hint = 'Bu kun grafikda dam olish kuni';
        const ap = m.approverName || {};
        const type = (k, icon, t, s) => `<label class="dv-type${rqForm.type === k ? ' is-on' : ''}"><input type="radio" name="dvRqT" value="${k}" ${rqForm.type === k ? 'checked' : ''} data-dv-rq="type">${ic(icon, 22)}<strong>${t}</strong><span>${s}</span></label>`;
        const chip = (name, val, label, onv) => `<label class="dv-chip${onv ? ' is-on' : ''}"><input type="radio" name="${name}" value="${esc(val)}" ${onv ? 'checked' : ''} data-dv-rq="${name === 'dvRqD' ? 'day' : 'reason'}">${onv ? ic('check', 14, 2.6) : ''}${esc(label)}</label>`;
        return `${top('Javob soʻrash', 'Rahbaringiz tasdiqlaydi')}<form class="dv-body dv-form" data-dv-rqform novalidate>
            <fieldset class="dv-fs dv-s1"><legend>Nima boʻldi? <b>*</b></legend><div class="dv-types">${type('late', 'late', 'Kech qolaman', 'vaqtni yozasiz')}${type('absent', 'absent', 'Kelmayman', 'butun kun')}${type('early_leave', 'early', 'Erta ketaman', 'vaqtni yozasiz')}</div></fieldset>
            <fieldset class="dv-fs dv-s2"><legend>Qaysi kun <b>*</b></legend><div class="dv-chips">${chip('dvRqD', 'today', `Bugun · ${dayShort(today)}`, rqForm.day === 'today')}${chip('dvRqD', 'tomorrow', `Ertaga · ${dayShort(tomorrow)}`, rqForm.day === 'tomorrow')}${chip('dvRqD', 'pick', rqForm.day === 'pick' && rqForm.date ? dayShort(rqForm.date) : 'Sana tanlash', rqForm.day === 'pick')}</div>
              ${rqForm.day === 'pick' ? `<input type="date" class="dv-input dv-input-date" min="${today}" max="${new Date(Date.parse(today + 'T12:00:00Z') + 60 * 86400000).toISOString().slice(0, 10)}" value="${esc(rqForm.date)}" data-dv-rq="date" aria-label="Sana">` : ''}</fieldset>
            ${rqForm.type !== 'absent' ? `<label class="dv-field dv-s2"><span>${tLabel} <b>*</b></span><input type="time" class="dv-input dv-input-time" value="${esc(rqForm.time)}" data-dv-rq="time" required${dsch ? ` min="${esc(dsch.start)}" max="${esc(dsch.end)}"` : ''}>${hint ? `<em>${esc(hint)}</em>` : ''}</label>` : hint ? `<span class="dv-fine">${esc(hint)}</span>` : ''}
            <fieldset class="dv-fs dv-s3"><legend>Sabab <b>*</b></legend><div class="dv-chips">${RQ_REASONS.map(r => chip('dvRqR', r, r, rqForm.reason === r)).join('')}</div></fieldset>
            <label class="dv-field dv-s3"><span>Izoh</span><textarea rows="2" maxlength="500" data-dv-rq="comment" placeholder="Masalan: Bolani shifokorga olib boraman, 10:30 da ofisda boʻlaman">${esc(rqForm.comment)}</textarea></label>
            <div class="dv-to">${ava(ap.name || ap.role || 'R', 40)}<span class="dv-col"><em>Soʻrov boradi</em><strong>${esc([ap.name, ap.role].filter(Boolean).join(' · ') || 'Rahbaringiz')}</strong></span></div>
            <div class="dv-info dv-blue">${ic('info', 18)}<span>${rqForm.type === 'late' ? `Tasdiqlansa, kechikish yozilmaydi va ${esc(rqForm.time || 'shu vaqtda')} kelganingizda Face ID odatdagidek soʻraladi.` : rqForm.type === 'absent' ? 'Tasdiqlansa, kun “Sababli” deb yoziladi.' : 'Tasdiqlansa, erta ketish yozilmaydi.'} Rad etilsa, odatdagi qoida ishlaydi.</span></div>
            <p class="dv-err" role="alert" data-dv-rqerr></p>
            <div class="dv-sticky"><button type="submit" class="dv-btn dv-btn-primary dv-btn-xl" data-dv-rqsend>Soʻrov yuborish</button></div></form>`;
    }
    async function sendRequest(btn) {
        const today = tk().date, tomorrow = new Date(Date.parse(today + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
        const date = rqForm.day === 'today' ? today : rqForm.day === 'tomorrow' ? tomorrow : rqForm.date;
        const errEl = root.querySelector('[data-dv-rqerr]');
        const fail = m => { if (errEl) errEl.textContent = m; };
        if (!date) return fail('Kunni tanlang');
        if (rqForm.type !== 'absent' && pm(rqForm.time) == null) return fail(rqForm.type === 'late' ? 'Qachon kelishingizni yozing' : 'Qachon ketishingizni yozing');
        if (!rqForm.reason) return fail('Sababni tanlang');
        btn.disabled = true;
        try {
            const r = await api('/me/requests', { type: rqForm.type, date, time: rqForm.time, reason: rqForm.reason, comment: rqForm.comment });
            Object.assign(rqForm, { type: 'late', day: 'today', date: '', time: '', reason: '', comment: '' });
            invalidate('myreq', 'month:');
            closePage();
            toast(`Soʻrov yuborildi — ${r.approver?.name || r.approver?.role || 'rahbaringiz'} tasdiqlaydi`);
            refresh(true);
        } catch (e) { btn.disabled = false; fail(e.message); }
    }

    // D12 · Davomat so'rovlari / D13 · rad etish
    const apState = { tab: 'pending' };
    const KIND_TONE = { late: 'amber', absent: 'red', early_leave: 'blue', outside: 'red' };
    function scopeSub(sc) {
        const l = !sc?.langs || sc.langs.length > 1 ? '' : sc.langs[0] === 'russian' ? ' · Rus tili' : ' · Ingliz tili';
        return sc?.kind === 'rop' ? 'Sotuv menejerlari' + l : sc?.kind === 'academic' ? 'Yordamchi ustozlar' + l : sc?.kind === 'admin' ? 'ROP, HR va akademik rahbar' : '';
    }
    function pageApprovals() {
        const d = got('inbox:' + apState.tab, () => api('/requests?tab=' + apState.tab), 10000);
        const pn = data['inbox:pending']?.v?.pending ?? d.v?.pending;
        let list;
        if (d.err) return `${top('Davomat soʻrovlari')}${errBox(d.err, 'approvals')}`;
        if (!d.v) list = '<div class="dv-sk dv-sk-tall"></div><div class="dv-sk dv-sk-tall"></div>';
        else if (!d.v.rows.length) list = `<div class="dv-empty">${ic('check', 26)}<strong>${apState.tab === 'pending' ? 'Kutayotgan soʻrov yoʻq' : 'Tarix boʻsh'}</strong><span>Yangi soʻrov kelsa bot va bildirishnoma orqali xabar beramiz</span></div>`;
        else list = d.v.rows.map(r => {
            const what = r.type === 'late' ? `${r.day} · ${r.time} da keladi` : r.type === 'early_leave' ? `${r.day} · ${r.time} da ketadi` : r.type === 'absent' ? `${r.day} · kelmaydi` : `${r.day} ${r.time}${r.distance != null ? ' · ofisdan ' + km(r.distance) : ''}`;
            const decided = r.state !== 'pending';
            return `<article class="dv-req"><div class="dv-req-h">${ava(r.name)}<span class="dv-col"><strong>${esc(r.name)}</strong><em>${esc(r.role)} · ${r.type === 'outside' ? 'belgilashda' : esc(r.createdClock) + ' da'}</em></span>${pill(r.typeLabel, KIND_TONE[r.type])}</div>
                <div class="dv-req-b"><strong>${esc(what)}</strong><span>${esc(r.reason)}${r.comment ? `: «${esc(r.comment)}»` : ''}</span>${r.type === 'outside' && r.photoId ? `<span class="dv-fine">Selfie va joylashuv saqlangan · <button type="button" class="dv-link-in" data-dv-rec="${esc(r.employeeId)}|${esc(r.date)}">koʻrish</button></span>` : ''}</div>
                ${decided ? `<div class="dv-req-d">${pill(r.state === 'approved' ? 'Tasdiqlandi' : 'Rad etildi', r.state === 'approved' ? 'green' : 'red')}<span>${esc(r.decidedBy)}${r.decisionReason ? ' · ' + esc(r.decisionReason) : ''}</span></div>`
                : `<div class="dv-req-a"><button type="button" class="dv-btn dv-btn-outline" data-dv-reject="${esc(r.id)}">Rad etish</button><button type="button" class="dv-btn dv-btn-green" data-dv-approve="${esc(r.id)}">${ic('check', 16, 2.8)}Tasdiqlash</button></div>`}</article>`;
        }).join('');
        return `${top('Davomat soʻrovlari', scopeSub(d.v?.scope))}<div class="dv-body">
            <div class="dv-tabs dv-s1" role="tablist" aria-label="Holat"><button type="button" role="tab" aria-selected="${apState.tab === 'pending'}" class="${apState.tab === 'pending' ? 'is-on' : ''}" data-dv-aptab="pending">Kutilmoqda${pn != null ? ' · ' + pn : ''}</button>
              <button type="button" role="tab" aria-selected="${apState.tab === 'history'}" class="${apState.tab === 'history' ? 'is-on' : ''}" data-dv-aptab="history">Tarix</button></div>
            <section class="dv-reqs dv-s2">${list}</section>
            <div class="dv-info dv-gray">${ic('info', 16)}<span>Bu ekran hamma tasdiqlovchida bir xil: ROP — sotuv menejerlari soʻrovlari, akademik rahbar — yordamchi ustozlar, admin — ROP, HR va akademik rahbar. Javobingiz xodimga bot va push orqali boradi.</span></div></div>`;
    }
    const REJ = ['Bugun ish koʻp', 'Oldindan aytilmadi', 'Boshqa'];
    function showReject(id) {
        const r = (data['inbox:pending']?.v?.rows || []).find(x => x.id === id); if (!r) return;
        const day = r.day.toLowerCase();
        const effect = r.type === 'early_leave' ? `Rad etilsa, ${esc(first(r.name))} odatdagidek ketadi. Erta ketsa — «erta ketdi» deb yoziladi.`
            : r.type === 'late' ? `Rad etilsa, ${esc(first(r.name))} odatdagidek vaqtida kelishi kerak. Kech kelsa — «kechikdi» deb yoziladi.`
            : r.type === 'absent' ? `Rad etilsa, kelmasa — «kelmadi» deb yoziladi.` : `Rad etilsa, bugungi kun odatdagi qoida boʻyicha hisoblanadi.`;
        openSheet('reject', `<section class="dv-sheet" role="dialog" aria-modal="true" aria-labelledby="dvRjT"><span class="dv-grab" aria-hidden="true"></span>
            <div class="dv-head"><div class="dv-col"><h2 id="dvRjT">Soʻrovni rad etish</h2><span class="dv-sub">${esc(r.name)} · ${esc(r.typeLabel.toLowerCase())} · ${esc(day)}${r.time && r.type !== 'absent' ? ' ' + esc(r.time) : ''}</span></div><button type="button" class="dv-x dv-x-sq" data-dv-close aria-label="Bekor qilish">${ic('close', 18)}</button></div>
            <fieldset class="dv-fs"><legend>Sabab <b>*</b></legend><div class="dv-chips">${REJ.map((x, i) => `<label class="dv-chip${i === 0 ? ' is-on' : ''}"><input type="radio" name="dvRj" value="${esc(x)}" ${i === 0 ? 'checked' : ''} data-dv-rjr>${i === 0 ? ic('check', 14, 2.6) : ''}${esc(x)}</label>`).join('')}</div></fieldset>
            <label class="dv-field"><span>Xodimga izoh</span><textarea rows="2" id="dvRjNote" maxlength="500" placeholder="Masalan: Bugun 17:00 da jamoa yigʻilishi bor, iltimos qoling"></textarea></label>
            <div class="dv-info dv-gray">${ic('info', 16)}<span>${effect}</span></div>
            <p class="dv-err" role="alert" data-dv-rjerr></p>
            <button type="button" class="dv-btn dv-btn-red dv-btn-xl" data-dv-rjsend="${esc(id)}">Rad etish</button></section>`);
    }
    async function decide(id, decision, reason, note, btn) {
        if (btn) btn.disabled = true;
        try {
            await api(`/requests/${encodeURIComponent(id)}/decide`, { decision, reason, note });
            if (S.sheet === 'reject') closeSheet(true);
            invalidate('inbox:', 'team:');
            toast(decision === 'approve' ? 'Tasdiqlandi — xodimga xabar yuborildi' : 'Rad etildi — xodimga xabar yuborildi');
            rerender(); refresh(true);
        } catch (e) {
            if (btn) btn.disabled = false;
            const errEl = sheetEl?.querySelector('[data-dv-rjerr]'); if (errEl) errEl.textContent = e.message; else toast(e.message, 'bad');
        }
    }

    // D08 · Xodimlar davomati (ROP) / Yordamchilar davomati (akademik) / Barcha xodimlar (admin)
    function pageTeam() {
        const date = tk().date;
        const d = got('team:' + date, () => api('/team?date=' + date), 30000);
        const kind = d.v?.scope?.kind || S.me?.approver?.kind;
        const title = kind === 'academic' ? 'Yordamchilar davomati' : kind === 'admin' ? 'Barcha xodimlar davomati' : 'Xodimlar davomati';
        if (d.err) return `${top(title)}${errBox(d.err, 'team')}`;
        if (!d.v) return `${top(title, dayLong(date))}${loading()}`;
        const v = d.v, s = v.summary || {};
        const who = kind === 'academic' ? 'yordamchi ustozlar' : kind === 'admin' ? 'kuzatiladigan xodimlar' : 'sotuv jamoasi';
        const tiles = kind === 'academic' ? [['g', s.on_time || 0, 'Vaqtida'], ['y', s.late || 0, 'Kechikdi'], ['o', s.upcoming || 0, 'Hali erta'], ['b', (s.waiting || 0) + (s.pending || 0), 'Kutilmoqda']]
            : [['g', (s.on_time || 0) + (s.present || 0), 'Vaqtida'], ['y', s.late || 0, 'Kechikdi'], ['r', s.absent || 0, 'Kelmadi'], ['b', (s.waiting || 0) + (s.pending || 0), 'Kutilmoqda']];
        const prev = v.pendingPreview || [];
        const short = r => `${first(r.name)} — ${r.type === 'outside' ? 'ofisda emas' : r.type === 'late' ? `${r.day.toLowerCase().split(',')[0]} kech qoladi${kind === 'academic' ? ', ' + r.time : ''}` : r.type === 'absent' ? `${r.day.toLowerCase().split(',')[0]} kelmaydi` : 'erta ketadi'}`;
        const sub = r => { const parts = [r.inClock ? 'keldi ' + r.inClock : r.start ? 'grafik ' + r.start + ' dan' : 'dam olish']; if (kind === 'academic' && r.lang) parts.push(r.lang === 'russian' ? 'Rus tili' : r.lang === 'english' ? 'Ingliz tili' : 'Ikkala til'); if (kind === 'admin') parts.push(r.role); return parts.join(' · '); };
        return `${top(title, `${dayLong(date)} · ${who}, ${v.rows.length} kishi`)}<div class="dv-body">
            <div class="dv-tiles4 dv-s1">${tiles.map(([c, n, l]) => `<div class="dv-t4 dv-t4-${c}"><strong>${n}</strong><span>${l}</span></div>`).join('')}</div>
            ${v.pending ? `<button type="button" class="dv-banner dv-s2 dv-pulse2" data-dv-go="approvals"><span class="dv-blue-ic">${ic('clock', 20)}</span><span class="dv-col"><strong>Davomat soʻrovlari · ${v.pending} ta kutmoqda</strong><em>${esc(prev.slice(0, 3).map(short).join(' · '))}</em></span>${ic('chev', 18)}</button>` : ''}
            ${v.rows.length ? `<section class="dv-list dv-s3">${v.rows.map(r => `<button type="button" class="dv-li dv-li-btn" data-dv-rec="${esc(r.employeeId)}|${date}">${ava(r.name)}<span class="dv-col"><strong>${esc(r.name)}</strong><em>${esc(sub(r))}</em></span>${stPill(r)}</button>`).join('')}</section>`
            : `<div class="dv-empty">${ic('users', 26)}<strong>Kuzatiladigan xodim yoʻq</strong><span>HR xodimga grafik va “Davomat kuzatiladi”ni yoqqanda shu yerda chiqadi</span></div>`}
            <span class="dv-fine dv-center-t">${kind === 'academic' ? 'Faqat oʻz yordamchilaringiz koʻrinadi' : kind === 'admin' ? 'Hamma kuzatiladigan xodimlar' : 'Faqat oʻz menejerlaringiz koʻrinadi'}. Tuzatishni HR qiladi.</span></div>`;
    }

    // D09 · Kun yozuvi (selfie va 3×4, xarita)
    async function showRecord(empId, date) {
        openSheet('record', `<section class="dv-sheet dv-sheet-tall" role="dialog" aria-modal="true" aria-label="Davomat yozuvi"><span class="dv-grab" aria-hidden="true"></span>${'<div class="dv-sk"></div>'.repeat(3)}</section>`);
        let r;
        try { r = await api(empId ? `/team/${encodeURIComponent(empId)}/day?date=${date}` : `/me/day?date=${date}`); }
        catch (e) { if (S.sheet === 'record') sheetEl.querySelector('section').innerHTML = `<div class="dv-state"><strong>Ochib boʻlmadi</strong><p>${esc(e.message)}</p><button type="button" class="dv-btn dv-btn-outline" data-dv-close>Yopish</button></div>`; return; }
        if (S.sheet !== 'record') return;
        const ins = r.attempts.filter(a => a.ok && a.kind === 'in'), att = ins[0] || r.attempts.filter(a => a.photoId).pop() || null;
        const dateTxt = `${Number(date.slice(8))}-${MON[Number(date.slice(5, 7)) - 1]}`;
        const line = [dateTxt, r.inClock ? 'keldi ' + r.inClock : '', r.status === 'late' ? `kechikdi ${r.lateMinutes} daq` : (ST[r.status] || [r.status])[0].toLowerCase()].filter(Boolean).join(' · ');
        const tone = r.status === 'late' ? 'amber' : r.status === 'absent' ? 'red' : r.status === 'on_time' ? 'green' : 'blue';
        const radius = r.office?.radius || 100, dist = att?.distance;
        const scale = 64 / Math.max(radius, dist || 0, 1);
        const px = dist != null ? Math.min(150, Math.max(0, dist * scale * (radius / Math.max(radius, 1)))) : null;
        const photos = `<div class="dv-photos"><figure class="dv-photo"><div>${r.facePhotoId ? `<img data-dv-photo="${esc(r.facePhotoId)}" alt="HRdagi asl 3×4 rasm">` : ''}</div><figcaption>Asl rasm (3×4, HR)</figcaption></figure>
            <figure class="dv-photo"><div>${att?.photoId ? `<img data-dv-photo="${esc(att.photoId)}" alt="Selfie, ${esc(att.clock)}">` : ''}${att ? `<span class="dv-photo-t">${esc(att.clock)}</span>` : ''}</div><figcaption>${date === tk().date ? 'Bugungi selfie' : 'Selfie'}</figcaption></figure></div>`;
        const chips = att ? `<div class="dv-pills dv-pills-l">${att.faceScore != null ? pill(`Yuz mos keldi · ${att.faceScore}%`, att.faceScore >= 80 ? 'green' : 'amber') : ''}${att.method === 'ip' ? pill('Ofis interneti', 'green') : dist != null ? pill(att.method === 'outside' ? `Ofisdan ${km(dist)} · ofisda emas` : `Ofisdan ${km(dist)}`, att.method === 'outside' ? 'amber' : 'green') : ''}<span class="dv-pill dv-gray dv-pill-lg">Jonli kamera</span></div>` : '<p class="dv-p">Bu kuni belgilash yoʻq.</p>';
        const map = dist != null ? `<div class="dv-map" role="img" aria-label="Xarita: ofis atrofida ${radius} metr doira, xodim ${km(dist)} uzoqlikda"><svg viewBox="0 0 358 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="358" height="190" fill="#EEF2F7"/><path d="M0 50h358M0 130h358M70 0v190M260 0v190" stroke="#FFFFFF" stroke-width="12"/><path d="M0 95l358-30" stroke="#FFFFFF" stroke-width="18"/><circle cx="179" cy="95" r="64" fill="rgba(0,101,214,.12)" stroke="#0065D6" stroke-width="2" stroke-dasharray="6 5"/><circle cx="179" cy="95" r="5" fill="#0065D6"/></svg>
            <span class="dv-pin" style="left:${179 + Math.round(px * .71) - 11}px;top:${95 - Math.round(px * .71) - 22}px"></span><span class="dv-map-l">Ofis · ${radius} m doira</span></div>` : '';
        sheetEl.querySelector('section').innerHTML = `<span class="dv-grab" aria-hidden="true"></span>
            <div class="dv-head"><div class="dv-col"><h2>${esc(r.name)}</h2><span class="dv-sub dv-t-${tone}">${esc(line)}</span></div><button type="button" class="dv-x" data-dv-close aria-label="Yopish">${ic('close', 18)}</button></div>
            ${photos}${chips}${map}
            <div class="dv-kv"><div><span>Grafik</span><strong>${r.scheduled ? `${esc(r.start)} – ${esc(r.end)}` : 'Dam olish kuni'}</strong></div><div><span>Keldi</span><strong>${esc(r.inClock || '—')}</strong></div><div><span>Ketdi</span><strong class="${r.outClock ? '' : 'dv-mut'}">${esc(r.outClock || (r.inClock && date === tk().date ? 'hali ishda' : '—'))}</strong></div></div>
            <span class="dv-fine dv-center-t">${empId ? `${S.me?.approver?.kind === 'academic' ? 'Akademik rahbar' : S.me?.approver?.kind === 'admin' ? 'Direktor' : 'ROP'} koʻradi · tuzatishni faqat HR va admin qiladi` : 'Tuzatish kerak boʻlsa — HRʼga murojaat qiling'}</span>`;
        hydratePhotos(sheetEl);
    }

    // D15 · Ofis joylashuvi (admin)
    const offState = { draft: null };
    function pageOffice() {
        const d = got('settings', () => api('/settings'), 60000);
        if (d.err) return `${top('Ofis joylashuvi')}${errBox(d.err, 'office')}`;
        if (!d.v) return `${top('Ofis joylashuvi', 'Admin · davomat uchun')}${loading()}`;
        const o = offState.draft || (offState.draft = { ...d.v.office });
        const rads = [50, 100, 200];
        return `${top('Ofis joylashuvi', 'Admin · davomat uchun')}<form class="dv-body dv-form" data-dv-offform novalidate>
            <div class="dv-map dv-map-lg dv-s1" role="img" aria-label="Xarita: ofis nuqtasi va ${o.radius} metrli radius"><svg viewBox="0 0 358 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="358" height="300" fill="#EEF2F7"/><path d="M0 70h358M0 170h358M0 250h358M60 0v300M180 0v300M290 0v300" stroke="#FFFFFF" stroke-width="14"/><path d="M0 120l358-40" stroke="#FFFFFF" stroke-width="22"/><circle cx="180" cy="150" r="${Math.round(40 + Math.min(o.radius, 300) / 300 * 70)}" fill="rgba(0,101,214,.12)" stroke="#0065D6" stroke-width="2" stroke-dasharray="6 5"/></svg>
              <span class="dv-bigpin">${ic('pin', 40, 1.5)}</span><span class="dv-map-l">Radius ${o.radius} m</span>
              <a class="dv-map-a" href="https://yandex.uz/maps/?pt=${o.lng},${o.lat}&z=17&l=map" target="_blank" rel="noopener">Xaritada ochish</a></div>
            <button type="button" class="dv-btn dv-btn-soft dv-s1" data-dv-here>${ic('pin', 18)}Hozir turgan joyimni olish</button>
            <span class="dv-fine" data-dv-offmsg>${o.lat.toFixed(6)}, ${o.lng.toFixed(6)}</span>
            <label class="dv-field dv-s2"><span>Ofis nomi <b>*</b></span><input class="dv-input" maxlength="120" value="${esc(o.name)}" data-dv-off="name"></label>
            <label class="dv-field dv-s2"><span>Manzil</span><input class="dv-input" maxlength="200" placeholder="Koʻcha, uy raqami" value="${esc(o.address || '')}" data-dv-off="address"></label>
            <fieldset class="dv-fs dv-s3"><legend>Ruxsat etilgan masofa <b>*</b></legend><div class="dv-chips">${rads.concat(rads.includes(o.radius) ? [] : [o.radius]).map(r => `<label class="dv-chip${o.radius === r ? ' is-on' : ''}"><input type="radio" name="dvRad" value="${r}" ${o.radius === r ? 'checked' : ''} data-dv-off="radius">${o.radius === r ? ic('check', 14, 2.6) : ''}${r} m</label>`).join('')}</div></fieldset>
            <div class="dv-info dv-gray">${ic('pin', 16)}<span>Ofisda turib «Hozir turgan joyimni olish»ni bosing — eng aniq yoʻl. Bu radiusdan tashqarida belgilagan xodimdan «Ofisda emasman» sababi soʻraladi.</span></div>
            <p class="dv-err" role="alert" data-dv-offerr></p>
            <div class="dv-sticky"><button type="submit" class="dv-btn dv-btn-primary dv-btn-xl" data-dv-offsave>${ic('check', 18, 2.4)}Saqlash</button></div></form>`;
    }

    // HR: ish grafigi (HrSchedule2) — HR telefon ilovasidan
    function pageSchedule(emp) {
        const e = emp || {}, days = e.days || {};
        return `${top('Ish grafigi', `${e.name || ''}${e.roleLabel ? ' · ' + e.roleLabel : ''}`)}<form class="dv-body dv-form" data-dv-schform="${esc(e.id)}" novalidate>
            <div class="dv-switch-row dv-s1"><span class="dv-col"><strong>Davomat kuzatiladi</strong><em>Yuz + joylashuv</em></span>${sw('dvTracked', e.tracked !== false, 'Davomat kuzatiladi')}</div>
            <section class="dv-sched dv-s2">${DAYS.map(([k, , full]) => `<div class="dv-sched-r">${sw('on' + k, !!days[k], full)}<span class="dv-sched-d">${full}</span>
              <span class="dv-sched-t"><input type="time" class="dv-input dv-input-hm" name="s${k}" value="${esc(days[k]?.start || '09:00')}" aria-label="${full} boshlanishi" ${days[k] ? '' : 'disabled'}><span aria-hidden="true">–</span><input type="time" class="dv-input dv-input-hm" name="e${k}" value="${esc(days[k]?.end || '18:00')}" aria-label="${full} tugashi" ${days[k] ? '' : 'disabled'}></span></div>`).join('')}</section>
            <div class="dv-info dv-gray">${ic('info', 16)}<span>10 daqiqadan ortiq kechiksa — direktor va rahbariga Telegram xabar</span></div>
            <p class="dv-err" role="alert" data-dv-scherr></p>
            <div class="dv-sticky"><button type="submit" class="dv-btn dv-btn-primary dv-btn-xl">Saqlash</button></div></form>`;
    }
    const sw = (name, onv, label) => `<label class="dv-sw"><input type="checkbox" role="switch" name="${name}" ${onv ? 'checked' : ''} aria-label="${esc(label)}"><span aria-hidden="true"></span></label>`;

    const PAGES = { my: pageMy, request: pageRequest, approvals: pageApprovals, team: pageTeam, office: pageOffice, schedule: pageSchedule };

    // ---------- hodisalar ----------
    function onDocClick(e) {
        // Host ilova ichidagi karta va menyu tugmalari
        const fa = e.target.closest('[data-dv-fines-admin]');
        if (fa) { e.preventDefault(); if (document.body.classList.contains('sidebar-open')) document.getElementById('sidebarToggle')?.click();
            if (typeof switchTab === 'function') { switchTab('finance'); if (typeof switchFinanceSection === 'function') switchFinanceSection('jarimalar'); } return; }
        const t = e.target.closest('[data-dv-go],[data-dv-checkin],[data-dv-checkout],[data-dv-enroll]');
        if (!t || (root && root.contains(t))) return;
        e.preventDefault(); e.stopPropagation();
        handle(t);
    }
    function onClick(e) {
        const t = e.target.closest('button,[data-dv-go],[data-dv-close],[data-dv-day],label.dv-chip,label.dv-type,label.dv-radio,a[data-dv-rec]');
        if (!t) return;
        handle(t, e);
    }
    function handle(t, e) {
        const d = t.dataset;
        if ('dvBack' in d) return closePage();
        if ('dvClose' in d) { if (S.sheet === 'perms') { S.permsDone = true; ls.set('dv_perms_done', '1'); } return closeSheet(); }
        if ('dvGo' in d) { closeSheet(true); return openPage(d.dvGo); }
        if ('dvCheckin' in d) return openCamera('in');
        if ('dvCheckout' in d) return openCamera('out');
        if ('dvEnroll' in d) return enroll();
        if ('dvShoot' in d) return shoot();
        if ('dvCamclose' in d) { stopFlow(); document.body.classList.remove('dv-open'); return evaluate(); }
        if ('dvOutside' in d) return showOutside();
        if ('dvOutclose' in d) { closeSheet(true); return d.dvOutclose === 'lock' || livePhase() === 'lock' ? showLock() : evaluate(); }
        if ('dvOutsend' in d) {
            const reason = sheetEl?.querySelector('input[name="dvOutR"]:checked')?.value || '';
            return openCamera('in', { reason, comment: sheetEl?.querySelector('#dvOutNote')?.value.trim() || '' });
        }
        if ('dvAgain' in d) { let o = null; try { o = d.dvAgainOut ? JSON.parse(d.dvAgainOut) : null; } catch (er) { o = null; } return openCamera(d.dvAgain || 'in', o); }
        if ('dvSnooze' in d) { ls.set('dv_snooze', JSON.stringify({ date: tk().date, until: Date.now() + 30 * 60000 })); closeSheet(true); return toast('30 daqiqadan keyin yana eslatamiz'); }
        if ('dvTohr' in d) { closeSheet(); return toast('Rasm HRʼga yuborildi — HR → Davomat boʻlimida koʻrinadi'); }
        if ('dvSettings' in d) { const N = native(); if (N && typeof N.openAppSettings === 'function') N.openAppSettings(); else toast('Telefon sozlamalari → Ilovalar → Jamoa → Ruxsatlar', 'info'); return; }
        if ('dvPerm' in d) { const N = native(); if (!N) return; if (d.dvPerm === 'cam') safe(() => N.requestCamera()); else if (d.dvPerm === 'loc') safe(() => N.requestLocation()); else safe(() => N.requestNotif()); return; }
        if ('dvReload' in d) { invalidate(''); return rerender(); }
        if ('dvMonth' in d) { const [y, m] = myState.month.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1 + Number(d.dvMonth), 1)); myState.month = dt.toISOString().slice(0, 7); return rerender(); }
        if ('dvDay' in d) return showRecord(null, d.dvDay);
        if ('dvRec' in d) { const [id, date] = d.dvRec.split('|'); return showRecord(id, date); }
        if ('dvCancel' in d) { t.disabled = true; return api(`/me/requests/${encodeURIComponent(d.dvCancel)}/cancel`, {}).then(() => { invalidate('myreq', 'month:'); toast('Soʻrov bekor qilindi'); rerender(); refresh(true); }).catch(er => { t.disabled = false; toast(er.message, 'bad'); }); }
        if ('dvAptab' in d) { apState.tab = d.dvAptab; return rerender(); }
        if ('dvApprove' in d) return decide(d.dvApprove, 'approve', '', '', t);
        if ('dvReject' in d) return showReject(d.dvReject);
        if ('dvRjsend' in d) { const reason = sheetEl?.querySelector('input[name="dvRj"]:checked')?.value || ''; const note = sheetEl?.querySelector('#dvRjNote')?.value.trim() || '';
            if (reason === 'Boshqa' && !note) { const er = sheetEl.querySelector('[data-dv-rjerr]'); if (er) er.textContent = '“Boshqa” tanlansa — izohda sababni yozing'; return; }
            return decide(d.dvRjsend, 'reject', reason === 'Boshqa' ? note.slice(0, 120) : reason, note, t); }
        if ('dvHere' in d) {
            const msg = root.querySelector('[data-dv-offmsg]'); if (msg) msg.textContent = 'Joylashuv aniqlanmoqda…';
            return locate().then(loc => { if (loc.error) { if (msg) msg.textContent = loc.error; return; } offState.draft.lat = +loc.lat.toFixed(6); offState.draft.lng = +loc.lng.toFixed(6); rerender();
                const m2 = root.querySelector('[data-dv-offmsg]'); if (m2) m2.textContent = `Joylashuv olindi (aniqlik ±${Math.round(loc.accuracy)} m). Saqlashni unutmang.`; });
        }
        if ('dvOffsave' in d) { e?.preventDefault(); return saveOffice(t); }
        if (t.matches('label.dv-chip, label.dv-type, label.dv-radio')) {
            setTimeout(() => { const inp = t.querySelector('input'); if (!inp) return;
                if (inp.dataset.dvRq) { rqSet(inp.dataset.dvRq, inp.value); return; }
                if (inp.dataset.dvOff === 'radius') { offState.draft.radius = Number(inp.value); rerender(); return; }
                t.parentElement.querySelectorAll('label').forEach(l => { const on2 = l.querySelector('input').checked; l.classList.toggle('is-on', on2); }); }, 0);
            return;
        }
        if ('dvRqsend' in d) { e?.preventDefault(); return sendRequest(t); }
    }
    function rqSet(k, v) { rqForm[k] = v; if (k === 'day' && v === 'pick' && !rqForm.date) rqForm.date = tk().date; rerender(); }
    function onInput(e) {
        const t = e.target;
        if (t.dataset.dvRq && ['time', 'comment', 'date'].includes(t.dataset.dvRq)) { rqForm[t.dataset.dvRq] = t.value; if (t.dataset.dvRq !== 'comment' && e.type === 'change') rerender(); }
        if (t.dataset.dvOff && offState.draft && t.dataset.dvOff !== 'radius') offState.draft[t.dataset.dvOff] = t.value;
        const f = t.closest('[data-dv-schform]');
        if (f && /^on\d$/.test(t.name)) { const k = t.name.slice(2); f[`s${k}`].disabled = !t.checked; f[`e${k}`].disabled = !t.checked; }
    }
    async function saveOffice(btn) {
        const o = offState.draft, er = root.querySelector('[data-dv-offerr]');
        if (!String(o.name || '').trim()) { if (er) er.textContent = 'Ofis nomini yozing'; return; }
        btn.disabled = true;
        try { await api('/settings/office', { name: o.name, address: o.address || '', lat: o.lat, lng: o.lng, radius: o.radius }, 'PUT'); invalidate('settings'); offState.draft = null; toast('Ofis joylashuvi saqlandi'); closePage(); }
        catch (e) { btn.disabled = false; if (er) er.textContent = e.message; }
    }
    async function onSubmit(e) {
        const f = e.target;
        if (f.matches('[data-dv-rqform]')) { e.preventDefault(); return sendRequest(f.querySelector('[data-dv-rqsend]')); }
        if (f.matches('[data-dv-offform]')) { e.preventDefault(); return saveOffice(f.querySelector('[data-dv-offsave]')); }
        if (f.matches('[data-dv-schform]')) {
            e.preventDefault();
            const out = {};
            DAYS.forEach(([k]) => { if (f['on' + k].checked) out[k] = { start: f['s' + k].value, end: f['e' + k].value }; });
            const er = f.querySelector('[data-dv-scherr]');
            try { await api(`/employees/${encodeURIComponent(f.dataset.dvSchform)}/schedule`, { tracked: f.dvTracked.checked, days: out }, 'PUT'); toast('Grafik saqlandi'); closePage(); S.onScheduleSaved?.(); }
            catch (err) { if (er) er.textContent = err.message; }
        }
    }

    // Yuz namunasi (xodimning o'zi) — 2 ta to'g'ri qaragan rasm, HR tasdiqlaydi.
    async function enroll() {
        closeSheet(true); stopFlow(); mount();
        const el = document.createElement('div'); el.className = 'dv-cam';
        el.innerHTML = `<video class="dv-video" playsinline muted autoplay></video><div class="dv-oval" aria-hidden="true"><i class="dv-scan"></i></div>
            <header class="dv-cam-h"><span class="dv-cam-badge">YUZ NAMUNASI</span><h1>Yuzingizni ramkaga joylang</h1><span class="dv-cam-sub">Yorugʻ joyda, koʻzoynaksiz — 2 ta rasm olinadi</span></header>
            <div class="dv-cam-mid"><span class="dv-cam-prompt" aria-live="polite"></span><div class="dv-count" aria-live="assertive"></div></div>
            <div class="dv-cam-foot"><button type="button" class="dv-link dv-link-light" data-dv-camclose>Bekor qilish</button></div>`;
        root.appendChild(el); document.body.classList.add('dv-open');
        const flow = S.flow = { el, cancelled: false };
        try {
            flow.stop = await startCamera(el.querySelector('video'));
            const count = el.querySelector('.dv-count'), prompt = el.querySelector('.dv-cam-prompt');
            const tickDown = async (n, text) => { prompt.textContent = text; for (let s = n; s > 0; s--) { count.textContent = s; await wait(1000); if (flow.cancelled) throw Object.assign(new Error('x'), { cancelled: true }); } count.textContent = ''; };
            await tickDown(3, 'Kameraga toʻgʻri qarang'); const a = grab(el.querySelector('video'));
            await tickDown(2, 'Yana bir marta, qimirlamang'); const b = grab(el.querySelector('video'));
            flow.stop(); prompt.textContent = 'Tekshirilmoqda…';
            await api('/me/face', { frames: [a, b] });
            stopFlow(); document.body.classList.remove('dv-open'); toast('Namuna HRʼga yuborildi — tasdiqlangach davomat ishlaydi'); refresh(true);
        } catch (e) { if (e.cancelled) return; stopFlow(); showState(e.code === 'perm' ? 'perm' : 'error', { message: e.message, kind: 'enroll' }); }
    }

    // ---------- menyu bandlari (host ilovalar uchun) ----------
    // kind: 'my' | 'team' | 'approvals' | 'office'
    function menuInfo() {
        const m = S.me || {};
        return { tracked: tracked(), approver: m.approver?.kind || null, pending: m.approver?.pending || 0, kind: m.kind || null };
    }

    // CRM drawer (admin / akademik rahbar telefonda — alohida ilovasi yo'q): "Davomat" bo'limi
    function drawerLinks() {
        const nav = document.getElementById('sidebarMenu'); if (!nav || !on()) return;
        const mi = menuInfo();
        const items = [];
        if (mi.approver) items.push(['approvals', 'Davomat soʻrovlari', mi.pending], ['team', mi.approver === 'academic' ? 'Yordamchilar davomati' : mi.approver === 'admin' ? 'Barcha xodimlar davomati' : 'Xodimlar davomati', 0]);
        if (mi.tracked) items.push(['my', 'Mening davomatim', 0]);
        if (mi.approver === 'admin') items.push(['office', 'Ofis joylashuvi', 0]);
        // ROP / sotuv / HR / yordamchi o'z ilovasining menyusidan foydalanadi
        if (['rop', 'sales_manager', 'hr', 'teacher'].includes(user().role)) items.length = 0;
        let box = nav.querySelector('.dv-drawer');
        // Jarimalar (js/jarimaApp.js): admin — sozlamalar (Moliya → Jarimalar) va yuvish so'rovlari; akademik — o'zi + ustozlari.
        const jr = (window.jarima && !['rop', 'sales_manager', 'hr', 'teacher', 'targetolog'].includes(user().role)) ? jarima.menuItems() : [];
        if (!items.length && !jr.length) { box?.remove(); return; }
        const html = (items.length ? `<div class="dv-drawer-h">DAVOMAT</div>${items.map(([id, l, n]) => `<a href="#" class="menu-item dv-drawer-a" data-dv-go="${id}">${ic(id === 'office' ? 'office' : id === 'team' ? 'users' : id === 'approvals' ? 'clock' : 'cal', 20)}<span class="label">${esc(l)}</span>${n ? `<b class="dv-badge">${n}</b>` : ''}</a>`).join('')}` : '')
            + (jr.length || mi.approver === 'admin' ? `<div class="dv-drawer-h">JARIMALAR</div>${mi.approver === 'admin' ? `<a href="#" class="menu-item dv-drawer-a" data-dv-fines-admin>${ic('info', 20)}<span class="label">Jarima va ragʻbat sozlamalari</span></a>` : ''}${jr.map(x => `<a href="#" class="menu-item dv-drawer-a" data-jr-go="${x.go}">${ic(x.go === 'washok' ? 'check' : x.go === 'issue' ? 'info' : 'cal', 20)}<span class="label">${esc(x.title)}</span>${x.badge ? `<b class="dv-badge">${x.badge}</b>` : ''}</a>`).join('')}` : '');
        if (!box) { box = document.createElement('div'); box.className = 'dv-drawer'; nav.prepend(box); }
        if (box.innerHTML !== html) box.innerHTML = html;
        if (!document.querySelector('#tab-dashboard [data-dv-home]') && mi.tracked) {
            const dash = document.getElementById('tab-dashboard');
            if (dash && !document.body.classList.contains('sa-on') && !document.body.classList.contains('ra-on') && !document.body.classList.contains('hra-on')) dash.insertAdjacentHTML('afterbegin', homeCard());
        }
        paintHome();
    }

    // ---------- ishga tushirish ----------
    function handleDeepLink() {
        try {
            const q = new URLSearchParams(location.search), tab = q.get('tab');
            if (tab === 'davomat') openPage('my');
            else if (tab === 'davomat-sorov') openPage('approvals');
        } catch (e) { /* yo'q */ }
    }
    function boot() {
        if (booted || !on()) return;
        booted = true;
        mount();
        document.addEventListener('input', onInput, true);
        document.addEventListener('change', onInput, true);
        document.addEventListener('submit', e => { if (root.contains(e.target)) onSubmit(e); }, true);
        // Android "orqaga": avval davomat sahifasi/oynasi yopiladi (host ilova orqaga ishlovi ishlamaydi).
        window.addEventListener('popstate', e => {
            if (S.skipPop) { S.skipPop = false; e.stopImmediatePropagation(); return; }
            if (S.flow && !S.flow.busy) { stopFlow(); e.stopImmediatePropagation(); try { history.pushState({ dv: 1 }, ''); } catch (er) { /* */ } evaluate(); return; }
            if (sheetEl && !sheetEl.classList.contains('dv-locked')) { closeSheet(); e.stopImmediatePropagation(); try { history.pushState({ dv: 1 }, ''); } catch (er) { /* */ } return; }
            if (sheetEl) { e.stopImmediatePropagation(); try { history.pushState({ dv: 1 }, ''); } catch (er) { /* */ } return; } // qulf — orqaga bilan yopilmaydi
            if (S.pages.length) { e.stopImmediatePropagation(); closePage(true); }
        }, true);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(true); });
        const prevNative = window.dwNativeChanged;
        window.dwNativeChanged = function () { try { prevNative && prevNative.apply(this, arguments); } catch (e) { /* */ } window.dwNativeChangedDv(); };
        refresh(true).then(() => { drawerLinks(); handleDeepLink(); });
        setTimeout(() => window.jarima?.refresh?.().then(drawerLinks), 2500); // jarima nishonlari
        timer = setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            if (Date.now() - S.loadedAt > 60000) refresh(true).then(drawerLinks); else { evaluate(); paintHome(); }
        }, 20000);
    }
    function start() {
        if (!on()) { setTimeout(start, 1500); return; } // login sahifasidan keyin
        boot();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    MQ.addEventListener?.('change', () => { if (on()) boot(); });

    window.davomat = {
        homeCard, refresh: () => refresh(true), guardLead, record: (empId, date) => showRecord(empId || null, date), leadLocked, open: openPage, menuInfo, state: () => S.me,
        openSchedule: (emp, onSaved) => { S.onScheduleSaved = onSaved || null; openPage('schedule', emp); }, toast
    };
})();
