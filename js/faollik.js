// Platformadagi faollik (dizayn FAO_* — «CRM — barcha dizaynlar», 16-noy, direktor tasdiqladi).
//  1) Hisoblagich: har bir xodim brauzerida FAOL daqiqalarni yozadi va har daqiqada /api/staff-activity/ping ga yuboradi.
//     Faol daqiqa = sahifa ko'rinib turibdi va so'nggi 2 daqiqada sichqoncha / klaviatura / teginish bo'lgan;
//     ochiq dars ekrani (body.lp-open) ham; qo'ng'iroq — tel: bosilgandan saytga qaytguncha (30 daqiqagacha).
//     Internet bo'lmasa — localStorage'da to'planadi (12 soatgacha), keyin yuboriladi.
//  2) Ko'rinishlar: jamoa sahifasi (Kun / Hafta / Oy reyting, hozir onlayn), xodim tafsiloti (00–24 chiziq,
//     bo'limlar, harakatlar, so'nggi harakatlar, qurilma), xodimning o'z kartasi.
//     Direktor — HR → Davomat → «Faollik»; ROP / akademik rahbar — o'z menyusidan (to'liq ekran oyna);
//     xodim — «Mening davomatim» ichida ([data-fa-my]). Bot havolasi: /?faollik=1.
// Maosh va jarimaga ta'sir qilmaydi.
(function () {
    'use strict';
    const API = '/api/staff-activity';
    const IDLE_MS = 2 * 60 * 1000, TICK_MS = 15000, SEND_MS = 60000, CALL_MAX_MS = 30 * 60 * 1000;
    const LS_KEY = 'fa_pending';
    const NO_TRACK = ['student', 'investor'];
    const TEAM_ROLES = ['admin', 'boshliq', 'rop', 'akademik'];
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const user = () => (typeof getCurrentUser === 'function' ? getCurrentUser() : null) || {};
    const token = () => { try { return localStorage.getItem('mh_token') || ''; } catch (e) { return ''; } };
    const toast = (m, ms) => (typeof showMiniToast === 'function' ? showMiniToast(m, ms || 3000) : console.log(m));
    const isPhone = () => window.matchMedia('(max-width: 900px)').matches || /Android|iPhone|iPad|DomworkTeam/i.test(navigator.userAgent);
    const tk = () => new Date(Date.now() + 5 * 3600000);
    const todayKey = () => tk().toISOString().slice(0, 10);
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const WD = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    const WD2 = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
    const dur = m => { m = Math.max(0, Math.round(Number(m) || 0)); const h = Math.floor(m / 60), r = m % 60; return h ? `${h} s ${String(r).padStart(2, '0')} daq` : `${r} daq`; };
    const durL = m => { m = Math.max(0, Math.round(Number(m) || 0)); const h = Math.floor(m / 60), r = m % 60; return h ? `${h} soat ${String(r).padStart(2, '0')} daq` : `${r} daq`; };
    const hm = m => (m == null ? '—' : `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    const fmtN = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const cf = v => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
    const ini = n => { const w = String(n || '').trim().split(/\s+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2)).toLocaleUpperCase('uz'); };
    const short = n => { const w = String(n || '').trim().split(/\s+/); return w.length > 1 ? `${w[0]} ${w[1][0]}.` : (w[0] || ''); };
    const dayLabel = d => { const x = new Date(d + 'T00:00:00Z'); return `${x.getUTCDate()}-${MON[x.getUTCMonth()]} · ${WD[x.getUTCDay()]}`; };
    const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
    const ic = (p, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
    const I = {
        close: '<path d="M18 6L6 18M6 6l12 12"/>', back: '<path d="M15 18l-6-6 6-6"/>', next: '<path d="M9 18l6-6-6-6"/>', cal: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 3v3M16 3v3"/>',
        dl: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>', desk: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>', phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/>',
        bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', alert: '<path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
    };
    async function api(path, body) {
        const r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', keepalive: !!body });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error(j.error || 'Maʼlumotni yuklab boʻlmadi'), { status: r.status });
        return j;
    }
    const tracks = () => { const u = user(); return !!(u.id && u.role && !NO_TRACK.includes(u.role) && token()); };
    const canTeam = () => TEAM_ROLES.includes(user().role);

    // ── 1. Hisoblagich ──────────────────────────────────────────────────────
    let lastAct = Date.now(), callAt = 0, sending = false;
    const marked = new Set();
    function load() { try { const v = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
    function save(list) { try { localStorage.setItem(LS_KEY, JSON.stringify(list.slice(-900))); } catch (e) { /* to'la */ } }
    function section() {
        if (document.body.classList.contains('lp-open')) return 'Dars';
        const pick = el => (el ? String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) : '');
        const cand = [...document.querySelectorAll('[aria-current="page"]')].find(el => el.offsetParent !== null && !el.closest('.fa-ov'));
        return pick(cand?.querySelector('.label, span:last-child') || cand) || pick(document.querySelector('#sidebarMenu .menu-item.active .label')) || 'Boshqa';
    }
    function mark(min, sec) {
        if (marked.has(min)) return;
        marked.add(min); if (marked.size > 2000) marked.clear();
        const list = load(); list.push([min, sec]); save(list);
    }
    function tick() {
        if (!tracks()) return;
        const now = Date.now(), vis = document.visibilityState === 'visible';
        const lesson = vis && document.body.classList.contains('lp-open');
        const inCall = callAt && now - callAt < CALL_MAX_MS;
        if ((vis && now - lastAct < IDLE_MS) || lesson) mark(Math.floor(now / 60000), section());
        else if (inCall) mark(Math.floor(now / 60000), 'Qoʻngʻiroq');
    }
    function endCall() {
        if (!callAt) return;
        const end = Math.min(Date.now(), callAt + CALL_MAX_MS);
        for (let m = Math.floor(callAt / 60000); m <= Math.floor(end / 60000); m++) mark(m, 'Qoʻngʻiroq');
        callAt = 0;
    }
    async function send() {
        if (sending || !tracks() || !navigator.onLine) return;
        const list = load();
        sending = true;
        try {
            await api('/ping', { device: isPhone() ? 'phone' : 'desk', section: section(), mins: list.slice(0, 900) });
            const rest = load().slice(list.length); save(rest);
        } catch (e) {
            if (e.status === 401 || e.status === 403) save([]);
        } finally { sending = false; }
    }
    function bootTracker() {
        const act = () => { lastAct = Date.now(); };
        ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(ev => window.addEventListener(ev, act, { passive: true, capture: true }));
        document.addEventListener('click', e => { if (e.target.closest?.('a[href^="tel:"]')) { callAt = Date.now(); } }, true);
        const back = () => { if (document.visibilityState === 'visible') { if (callAt && Date.now() - callAt > 15000) endCall(); lastAct = Date.now(); tick(); } else { tick(); send(); } };
        document.addEventListener('visibilitychange', back);
        window.addEventListener('focus', () => { if (callAt && Date.now() - callAt > 15000) endCall(); });
        window.addEventListener('online', send);
        setInterval(tick, TICK_MS);
        setInterval(send, SEND_MS);
        setTimeout(() => { tick(); send(); }, 5000);
    }

    // ── 2. Ko'rinishlar ─────────────────────────────────────────────────────
    const DEPTS = ['Sotuv', 'Akademik', 'Boshqa'];
    const S = { period: 'day', date: null, dept: 'all', sort: 'time', data: null, err: '', loading: false, host: null, seq: 0, timer: null };
    const legend = '<span class="fa-leg"><span><i class="fa-in"></i>ish vaqtida</span><span><i class="fa-out"></i>ish vaqtidan tashqari</span></span>';
    const FAOL = 'Faol vaqt — sayt ochiq va soʻnggi 2 daqiqada sichqoncha, klaviatura yoki teginish boʻlgan daqiqalar. Qoʻngʻiroq (tel: bosilgandan saytga qaytguncha, 30 daqiqagacha) va ochiq dars ekrani ham hisoblanadi. Kompyuter va telefon bir vaqtda ochiq boʻlsa — bir marta.';
    const info = `<button type="button" class="fa-info" aria-label="Faol vaqt qanday hisoblanadi" data-fa-info>i</button>`;
    const bar = (inH, out, mx) => `<span class="fa-bar" aria-hidden="true"><i class="fa-in" style="width:${mx ? (inH / mx * 100).toFixed(1) : 0}%"></i><i class="fa-out" style="width:${mx ? (out / mx * 100).toFixed(1) : 0}%"></i></span>`;
    const medal = i => (i < 3 ? `<span role="img" aria-label="${i + 1}-oʻrin">${['🥇', '🥈', '🥉'][i]}</span>` : String(i + 1));
    const nowNote = d => (d.period === 'day' && d.date === d.today ? `Hozir ${esc(d.nowClock)} · kun davom etmoqda` : '');
    function periodTitle(d) {
        if (d.period === 'day') return dayLabel(d.date);
        if (d.period === 'week') { const a = new Date(d.from + 'T00:00:00Z'), b = new Date(d.to + 'T00:00:00Z'); return `${a.getUTCDate()}–${b.getUTCDate()}-${MON[b.getUTCMonth()]}`; }
        const x = new Date(d.from + 'T00:00:00Z'); return `${MON[x.getUTCMonth()][0].toUpperCase() + MON[x.getUTCMonth()].slice(1)} ${x.getUTCFullYear()}`;
    }
    function shift(n) {
        const d = S.date || todayKey();
        let nd = S.period === 'day' ? addDays(d, n) : S.period === 'week' ? addDays(d, 7 * n) : (() => { const [y, m] = d.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1 + n, 1)); return x.toISOString().slice(0, 10); })();
        if (nd > todayKey()) nd = todayKey();
        S.date = nd; loadTeam();
    }
    async function loadTeam() {
        const seq = ++S.seq; S.loading = true; draw();
        try {
            const d = await api(`/team?period=${S.period}&date=${S.date || todayKey()}`);
            if (seq !== S.seq) return; S.data = d; S.err = '';
        } catch (e) { if (seq !== S.seq) return; S.err = e.message; }
        S.loading = false; draw();
    }
    function rowsOf(d) {
        let rows = (d.rows || []).slice();
        if (S.dept !== 'all') rows = rows.filter(r => r.dept === S.dept);
        const key = S.sort === 'actions' ? 'actions' : S.sort === 'outside' ? 'outside' : S.sort === 'inhours' ? 'inHours' : 'minutes';
        rows.sort((a, b) => (Number(b[key]) || 0) - (Number(a[key]) || 0) || b.minutes - a.minutes || a.name.localeCompare(b.name));
        return rows;
    }
    function sub(r) {
        const d = S.data || {}, today = d.period === 'day' && d.date === d.today;
        if (r.online && (today || d.to === d.today)) return `<span class="fa-on-t">onlayn · ${esc(r.online.section || '')}</span>`;
        if (r.dayStatus === 'leave') return 'taʼtilda';
        if (d.period !== 'day') return r.minutes ? `${fmtN(r.days?.filter(Boolean).length || 0)} kun faol` : 'faollik yoʻq';
        if (r.last != null) return today ? `oxirgi faollik ${hm(r.last)}` : `${hm(r.first)} – ${hm(r.last)}`;
        return r.dayStatus === 'off' && r.hasSchedule ? 'dam olish kuni' : today ? 'bugun saytga kirmadi' : 'saytga kirmagan';
    }
    const hrs = m => (m < 600 ? dur(m) : `${fmtN(Math.round(m / 60))} soat`);
    function teamHtml() {
        const d = S.data, admin = d?.scope?.kind === 'admin';
        const seg = `<div class="fa-seg" role="tablist" aria-label="Davr">${[['day', 'Kun'], ['week', 'Hafta'], ['month', 'Oy']].map(([k, l]) => `<button type="button" role="tab" aria-selected="${S.period === k}" class="${S.period === k ? 'on' : ''}" data-fa-period="${k}">${l}</button>`).join('')}</div>`;
        const atToday = !d || (S.period === 'day' ? (S.date || todayKey()) >= todayKey() : (d.to >= d.today));
        const nav = `<span class="fa-chip fa-chip-date">${ic(I.cal, 16)} ${d ? esc(periodTitle(d)) : '…'}</span><button type="button" class="fa-chip fa-sq" data-fa-shift="-1" aria-label="Oldingi">${ic(I.back, 16)}</button><button type="button" class="fa-chip fa-sq" data-fa-shift="1" aria-label="Keyingi"${atToday ? ' disabled' : ''}>${ic(I.next, 16)}</button>`;
        const top = `<div class="fa-toolbar">${seg}${nav}<span class="fa-note">${d ? nowNote(d) : ''}${S.data && S.data.scope?.kind !== 'admin' ? 'Faqat sizning jamoangiz' : ''}</span><span class="fa-sp"></span><button type="button" class="fa-btn" data-fa-xls${d?.rows?.length ? '' : ' disabled'}>${ic(I.dl, 16)} Excel</button></div>`;
        if (S.err) return `${top}<div class="fa-card fa-err" role="alert">${ic(I.alert, 22)}<div><b>Maʼlumotni yuklab boʻlmadi</b><p>${esc(S.err)}</p></div><button type="button" class="fa-btn" data-fa-reload>Qayta yuklash</button></div>`;
        if (!d) return `${top}<div class="fa-card"><div class="fa-sk"></div><div class="fa-sk"></div><div class="fa-sk"></div></div>`;
        const tt = d.totals;
        const kpi = (l, v, s, cls) => `<div class="fa-card fa-kpi"><span>${l}</span><b class="${cls || ''}">${v}</b><small>${s}</small></div>`;
        const avgDays = d.period === 'day' ? 1 : Math.max(1, d.workDays || 1);
        const kpis = d.period === 'day'
            ? kpi('Hozir onlayn', fmtN(tt.online), `jami ${tt.staff} xodimdan`, 'fa-grn') + kpi('Jamoa platformada', durL(tt.minutes), d.date === d.today ? 'bugun, faol vaqt' : 'faol vaqt', '') + kpi('Ish vaqtidan tashqari', dur(tt.outside), `${tt.outsideCount} kishi`, 'fa-vio') + kpi('Harakatlar', fmtN(tt.actions), 'lid, qoʻngʻiroq, toʻlov, izoh…', '')
            : kpi('Jamoa platformada', hrs(tt.minutes), d.period === 'week' ? 'hafta' : 'oy', '') + kpi('Ish vaqtidan tashqari', hrs(tt.outside), `${tt.outsideCount} kishi`, 'fa-vio') + kpi('Oʻrtacha ish kunida', `${cf(tt.staff ? tt.minutes / 60 / tt.staff / avgDays : 0)} soat`, 'bir xodimga', '') + kpi('Harakatlar', fmtN(tt.actions), d.period === 'week' ? 'hafta boʻyi' : 'oy boʻyi', '');
        const dc = d.totals.depts || {};
        const chips = (admin ? `<div class="fa-chips" role="group" aria-label="Boʻlim">${[['all', `Hammasi · ${tt.staff}`], ...DEPTS.map(x => [x, `${x} · ${dc[x] || 0}`])].map(([k, l]) => `<button type="button" class="fa-chip${S.dept === k ? ' on' : ''}" aria-pressed="${S.dept === k}" data-fa-dept="${k}">${esc(l)}</button>`).join('')}</div>` : '')
            + `<span class="fa-sp"></span><span class="fa-lbl">Saralash:</span><div class="fa-chips" role="group" aria-label="Saralash">${[['time', 'Vaqt'], ['actions', 'Harakatlar'], ['outside', 'Tashqari'], ['inhours', 'Ish vaqtida']].map(([k, l]) => `<button type="button" class="fa-chip${S.sort === k ? ' on' : ''}" aria-pressed="${S.sort === k}" data-fa-sort="${k}">${l}</button>`).join('')}</div>`;
        const rows = rowsOf(d), mx = Math.max(1, ...rows.map(r => r.minutes));
        const isDay = d.period === 'day';
        const spark = r => { const v = r.days || []; const m2 = Math.max(60, ...v); const lab = v.map((x, i) => `${WD2[new Date(d.dates[i] + 'T00:00:00Z').getUTCDay()]} ${dur(x)}`).join(', ');
            return `<span class="fa-spark" role="img" aria-label="${esc(lab)}" title="${esc(lab)}">${v.slice(-31).map(x => `<i style="height:${Math.max(2, Math.round(x / m2 * 26))}px"${x ? '' : ' class="z"'}></i>`).join('')}</span>`; };
        const tr = (r, i) => `<tr data-fa-person="${esc(r.userId)}" tabindex="0" aria-label="${esc(r.name)} — batafsil">
            <td class="fa-rank">${r.minutes ? medal(i) : '—'}</td>
            <td><span class="fa-who"><span class="fa-av">${esc(ini(r.name))}<i class="${r.online ? 'fa-dot-on' : 'fa-dot-off'}"></i></span><span><b>${esc(r.name)}</b><small>${sub(r)}</small></span></span></td>
            <td><span class="fa-tag">${esc(r.label)}</span>${r.deptRank ? `<small class="fa-dr">${esc(r.dept.toLowerCase())}da ${r.deptRank}-oʻrin</small>` : ''}</td>
            ${isDay ? '' : `<td>${spark(r)}</td>`}
            <td><span class="fa-tcell">${bar(r.minutes - r.outside, r.outside, mx)}<b>${dur(r.minutes)}</b></span>${r.hasSchedule ? '' : '<small class="fa-dr">grafik yoʻq</small>'}</td>
            ${isDay ? '' : `<td>${r.workDays ? cf(r.minutes / 60 / r.workDays) + ' soat' : '—'}</td>`}
            <td class="${r.outside ? 'fa-vio' : 'fa-mt'}">${r.outside ? dur(r.outside) : '—'}</td>
            <td><b>${fmtN(r.actions)}</b></td><td class="fa-chev">${ic(I.next, 18)}</td></tr>`;
        const table = rows.length ? `<div class="fa-tw"><table class="fa-tbl"><thead><tr><th>#</th><th>Xodim</th><th>Boʻlim</th>${isDay ? '' : `<th>${d.period === 'week' ? 'Du–Ya' : 'Kunlar'}</th>`}<th>Platformada (faol) ${info}</th>${isDay ? '' : '<th>Oʻrtacha / ish kuni</th>'}<th>Tashqarida</th><th>Harakat</th><th><span class="fa-sr">Batafsil</span></th></tr></thead><tbody>${rows.map(tr).join('')}</tbody></table></div>`
            : `<div class="fa-empty">${ic(I.clock, 28)}<b>${(d.rows || []).length ? 'Bu boʻlimda xodim yoʻq' : 'Hali maʼlumot yoʻq'}</b><p>${(d.rows || []).length ? '' : 'Faollik xodimlar saytni ochgandan boshlab yoziladi; oldingi kunlar hisoblanmagan.'}</p></div>`;
        const list = rows.length ? `<div class="fa-list">${rows.map((r, i) => `<button type="button" class="fa-li" data-fa-person="${esc(r.userId)}"><b class="fa-rank">${r.minutes ? medal(i) : '—'}</b><span class="fa-li-m"><b>${esc(short(r.name))}</b><small>${sub(r)} · ${fmtN(r.actions)} harakat</small></span><span class="fa-li-r"><b>${dur(r.minutes)}</b>${r.outside ? `<small class="fa-vio">+${dur(r.outside)} tashqari</small>` : ''}</span></button>`).join('')}</div>` : '';
        const online = (d.rows || []).filter(r => r.online);
        const onl = isDay && d.date === d.today ? `<aside class="fa-card fa-online"><div class="fa-card-h"><span class="fa-sec">Hozir onlayn</span><span class="fa-badge">${online.length}</span></div>
            ${online.length ? online.slice(0, 9).map(r => `<button type="button" class="fa-oli" data-fa-person="${esc(r.userId)}"><i class="fa-dot-on"></i><span><b>${esc(short(r.name))}</b><small>${esc(r.online.section || '')}</small></span><span class="fa-tag">${esc(r.online.device || '')}</span></button>`).join('') : '<p class="fa-mt">Hozir hech kim faol emas.</p>'}
            ${online.length > 9 ? `<p class="fa-mt">… yana ${online.length - 9} kishi</p>` : ''}<p class="fa-mt">Har 30 soniyada yangilanadi</p></aside>` : '';
        return `${top}<div class="fa-kpis">${kpis}</div><div class="fa-main"><section class="fa-card fa-rate"><div class="fa-card-h"><span class="fa-sec">${isDay ? (d.date === d.today ? 'Bugungi reyting' : 'Kun reytingi') : d.period === 'week' ? 'Haftalik reyting' : 'Oylik reyting'}</span>${legend}</div>
            <div class="fa-chiprow">${chips}</div>${table}${list}
            <p class="fa-mt">${isDay ? '' : `Oʻrtacha = jami ÷ grafikdagi ish kunlari. `}Ismni bosing — tafsilot. Faollik maoshga va jarimaga taʼsir qilmaydi.</p></section>${onl}</div>`;
    }
    function draw() {
        const h = S.host; if (!h || !h.isConnected) { stopAuto(); return; }
        // Boshqa bo'lim shu joyga chizilgan bo'lsa (HR → Davomat tablari) — tegmaymiz.
        if (h.firstElementChild && !h.firstElementChild.classList.contains('fa-page')) { stopAuto(); S.host = null; return; }
        h.innerHTML = `<div class="fa-page">${teamHtml()}</div>`;
    }
    function startAuto() { stopAuto(); S.timer = setInterval(() => { if (!S.host?.isConnected) return stopAuto(); if (document.visibilityState === 'visible' && S.period === 'day' && (S.date || todayKey()) === todayKey() && !document.querySelector('.fa-panel')) loadTeam(); }, 30000); }
    function stopAuto() { if (S.timer) clearInterval(S.timer); S.timer = null; }
    function bindHost(h) {
        if (h.dataset.faBound) return; h.dataset.faBound = '1';
        h.addEventListener('click', e => {
            const b = e.target.closest('[data-fa-period],[data-fa-shift],[data-fa-dept],[data-fa-sort],[data-fa-reload],[data-fa-xls],[data-fa-info],[data-fa-person]');
            if (!b || !h.contains(b)) return;
            if (b.dataset.faPeriod) { S.period = b.dataset.faPeriod; loadTeam(); }
            else if (b.dataset.faShift) shift(Number(b.dataset.faShift));
            else if (b.dataset.faDept) { S.dept = b.dataset.faDept; draw(); }
            else if (b.dataset.faSort) { S.sort = b.dataset.faSort; draw(); }
            else if (b.hasAttribute('data-fa-reload')) loadTeam();
            else if (b.hasAttribute('data-fa-xls')) excel();
            else if (b.hasAttribute('data-fa-info')) toast(FAOL, 7000);
            else if (b.dataset.faPerson) openPerson(b.dataset.faPerson);
        });
        h.addEventListener('keydown', e => { const r = e.target.closest?.('tr[data-fa-person]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPerson(r.dataset.faPerson); } });
    }
    function renderTeam(host) {
        if (!host) return;
        S.host = host; bindHost(host);
        if (!S.date) S.date = todayKey();
        draw(); loadTeam(); startAuto();
    }
    async function excel() {
        const d = S.data; if (!d) return;
        try { if (!window.XLSX && typeof loadXlsxLib === 'function') await loadXlsxLib(); } catch (e) { /* pastda */ }
        if (!window.XLSX) { toast('Excel kutubxonasi yuklanmadi'); return; }
        const rows = rowsOf(d).map((r, i) => ({ '#': i + 1, Xodim: r.name, 'Boʻlim': r.label, 'Platformada (daq)': r.minutes, 'Ish vaqtida (daq)': r.hasSchedule ? r.minutes - r.outside : '', 'Tashqarida (daq)': r.outside, Harakatlar: r.actions,
            ...(d.period === 'day' ? { Birinchi: hm(r.first), Oxirgi: hm(r.last) } : Object.fromEntries((r.days || []).map((x, j) => [d.dates[j], x]))) }));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Faollik');
        XLSX.writeFile(wb, `faollik-${d.period}-${d.from}.xlsx`);
    }

    // ── Xodim tafsiloti ─────────────────────────────────────────────────────
    const P = { userId: null, period: 'day', date: null, own: false };
    function timeline(segs, work) {
        const pos = m => (Math.max(0, Math.min(1440, m)) / 1440 * 100).toFixed(2);
        const bg = (work || []).map(([a, b]) => `<span class="fa-tl-w" style="left:${pos(a)}%;width:${(pos(Math.min(b, 1440)) - pos(a)).toFixed(2)}%"></span>`).join('');
        const sg = (segs || []).map(([a, b, o]) => `<i class="${o ? 'fa-out' : 'fa-in'}" style="left:${pos(a)}%;width:${Math.max(0.35, pos(b) - pos(a)).toFixed(2)}%"></i>`).join('');
        const lab = (segs || []).map(([a, b, o]) => `${hm(a)}–${hm(b)}${o ? ' (tashqari)' : ''}`).join(', ') || 'faollik yoʻq';
        return `<div class="fa-tl" role="img" aria-label="Kun davomida: ${esc(lab)}">${bg}${sg}</div><div class="fa-tl-x" aria-hidden="true">${[0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => `<span>${String(h).padStart(2, '0')}</span>`).join('')}</div>`;
    }
    function detailHtml(d) {
        const kv = (a, b) => `<div class="fa-kv"><span>${a}</span><b>${b}</b></div>`;
        const isDay = d.period === 'day';
        const head = `<div class="fa-p-h"><span class="fa-av fa-av-lg">${esc(ini(d.person.name))}</span><span class="fa-p-t"><strong>${esc(d.person.name)}</strong><small>${esc(d.person.label)}${d.person.schedule ? ' · grafik ' + esc(d.person.schedule) : ' · grafik yoʻq'}${d.online ? ` · <span class="fa-on-t">onlayn · ${esc(d.online.section || '')}</span>` : ''}</small></span><button type="button" class="fa-x" data-fa-close aria-label="Yopish">${ic(I.close, 20)}</button></div>`;
        const seg = `<div class="fa-seg">${[['day', 'Kun'], ['week', 'Hafta'], ['month', 'Oy']].map(([k, l]) => `<button type="button" class="${P.period === k ? 'on' : ''}" aria-pressed="${P.period === k}" data-fa-pp="${k}">${l}${P.period === k ? ' · ' + esc(periodTitle(d)) : ''}</button>`).join('')}</div>`;
        const sum = `<div class="fa-sum"><div><b>${dur(d.minutes)}</b><small>platformada</small></div><div><b>${d.inHours == null ? '—' : dur(d.inHours)}</b><small>ish vaqtida</small></div><div><b class="fa-vio">${d.inHours == null ? '—' : dur(d.outside)}</b><small>tashqarida</small></div><div><b>${fmtN(d.actions)}</b><small>harakat</small></div></div>`;
        const pre = d.segments?.length && d.work?.length ? d.segments.filter(s => s[2]) : [];
        const tl = isDay ? `<section class="fa-blk"><div class="fa-card-h"><span class="fa-sec">Kun davomida · 00–24</span>${legend}</div>${timeline(d.segments, d.work)}
            <p class="fa-mt">${d.work?.length ? `Och koʻk fon — ish vaqti ${esc(d.person.schedule || '')}. ` : d.work ? 'Bugun grafik boʻyicha dam olish kuni — hammasi «tashqari». ' : 'Grafik yoʻq — ish vaqti / tashqari ajratilmaydi. '}${d.first != null ? `Birinchi faollik ${hm(d.first)}, oxirgisi ${hm(d.last)}. ` : ''}Boʻshliqlar — sayt yopiq yoki 2 daqiqadan koʻp harakatsiz.${pre.length ? '' : ''}</p></section>`
            : `<section class="fa-blk"><span class="fa-sec">Kunlar boʻyicha</span><div class="fa-days">${(d.days || []).map(x => `<div title="${esc(x.date)}: ${dur(x.minutes)}"><i style="height:${Math.max(2, Math.round(x.minutes / Math.max(60, ...d.days.map(y => y.minutes)) * 60))}px"${x.minutes ? '' : ' class="z"'}></i><small>${new Date(x.date + 'T00:00:00Z').getUTCDate()}</small></div>`).join('')}</div>${d.workDays ? `<p class="fa-mt">Oʻrtacha ish kunida: ${cf(d.minutes / 60 / d.workDays)} soat (${d.workDays} ish kuni).</p>` : ''}</section>`;
        const secs = d.sections?.length ? d.sections.slice(0, 8).map(s => kv(esc(s.name), dur(s.minutes))).join('') : '<p class="fa-mt">Maʼlumot yoʻq</p>';
        const acts = d.actionKinds?.length ? d.actionKinds.slice(0, 8).map(a => kv(esc(a.name), fmtN(a.n))).join('') : '<p class="fa-mt">Harakat yoʻq</p>';
        const last = d.lastActions?.length ? d.lastActions.slice(0, 8).map(a => `<div class="fa-kv"><span class="fa-tm">${isDay ? '' : esc(a.date.slice(8)) + '.' + esc(a.date.slice(5, 7)) + ' '}${esc(a.clock)}</span><b class="fa-wrap">${esc(a.text)}</b></div>`).join('') : '<p class="fa-mt">Harakat yoʻq</p>';
        const devs = `${kv(ic(I.desk, 16) + ' Kompyuter', dur(d.devices?.desk || 0))}${kv(ic(I.phone, 16) + ' Telefon (Jamoa ilovasi)', dur(d.devices?.phone || 0))}${d.devices?.both ? `<p class="fa-mt">Ikkalasi bir vaqtda ochiq boʻlgan ${dur(d.devices.both)} bir marta hisoblandi.</p>` : ''}`;
        return `${head}${seg}${sum}${tl}<div class="fa-g2"><section class="fa-blk fa-box"><span class="fa-sec">Boʻlimlarda · ${dur(d.minutes)}</span>${secs}</section><section class="fa-blk fa-box"><span class="fa-sec">Harakatlar · ${fmtN(d.actions)}</span>${acts}</section></div>
            <section class="fa-blk fa-box"><span class="fa-sec">Soʻnggi harakatlar</span>${last}</section><section class="fa-blk fa-box"><span class="fa-sec">Qurilmalar</span>${devs}</section>
            <p class="fa-mt">${P.own ? 'Buni rahbaringiz va direktor ham koʻradi. ' : ''}Faollik maoshga ham, jarimaga ham taʼsir qilmaydi — faqat koʻrish uchun.${P.own ? '' : ' Xodim oʻz raqamlarini kabinetida koʻradi.'}</p>`;
    }
    let lastFocus = null;
    function panel() {
        let p = document.querySelector('.fa-panel-ov');
        if (!p) {
            lastFocus = document.activeElement;
            p = document.createElement('div'); p.className = 'fa-panel-ov';
            p.innerHTML = '<div class="fa-panel" role="dialog" aria-modal="true" aria-label="Xodim faolligi" tabindex="-1"></div>';
            p.addEventListener('click', e => {
                if (e.target === p || e.target.closest('[data-fa-close]')) return closePanel();
                const b = e.target.closest('[data-fa-pp]'); if (b) { P.period = b.dataset.faPp; loadPerson(); }
            });
            document.addEventListener('keydown', escPanel);
            document.body.appendChild(p); document.documentElement.classList.add('fa-lock');
        }
        return p.querySelector('.fa-panel');
    }
    function escPanel(e) { if (e.key === 'Escape') closePanel(); }
    function closePanel() { document.querySelector('.fa-panel-ov')?.remove(); document.removeEventListener('keydown', escPanel); if (!document.querySelector('.fa-ov')) document.documentElement.classList.remove('fa-lock'); try { lastFocus?.focus?.(); } catch (e) { /* */ } }
    async function loadPerson() {
        const box = panel();
        box.innerHTML = `<div class="fa-p-h"><span class="fa-sk" style="flex:1;height:44px"></span><button type="button" class="fa-x" data-fa-close aria-label="Yopish">${ic(I.close, 20)}</button></div><div class="fa-sk"></div><div class="fa-sk" style="height:120px"></div>`;
        try {
            const q = `period=${P.period}&date=${P.date || todayKey()}`;
            const d = await api(P.own ? `/me?${q}` : `/person/${encodeURIComponent(P.userId)}?${q}`);
            if (!document.querySelector('.fa-panel')) return;
            box.innerHTML = detailHtml(d); box.focus();
        } catch (e) {
            box.innerHTML = `<div class="fa-p-h"><strong>Xatolik</strong><button type="button" class="fa-x" data-fa-close aria-label="Yopish">${ic(I.close, 20)}</button></div><div class="fa-card fa-err" role="alert">${ic(I.alert, 22)}<div><b>Maʼlumotni yuklab boʻlmadi</b><p>${esc(e.message)}</p></div></div>`;
        }
    }
    function openPerson(userId) { P.userId = userId; P.own = false; P.period = S.period; P.date = S.date || todayKey(); loadPerson(); }
    function openMine() { P.own = true; P.userId = null; P.period = 'day'; P.date = todayKey(); loadPerson(); }

    // ── To'liq ekran oyna (ROP / akademik rahbar / telefon) ─────────────────
    function openOverlay() {
        if (!canTeam()) { openMine(); return; }
        let ov = document.querySelector('.fa-ov');
        if (!ov) {
            ov = document.createElement('div'); ov.className = 'fa-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Faollik');
            ov.innerHTML = `<header class="fa-ov-h"><button type="button" class="fa-x" data-fa-ovclose aria-label="Orqaga">${ic(I.back, 20)}</button><strong>Faollik</strong><button type="button" class="fa-btn fa-btn-s" data-fa-mine>Mening faolligim</button></header><div class="fa-ov-b"></div>`;
            ov.addEventListener('click', e => { if (e.target.closest('[data-fa-ovclose]')) closeOverlay(); else if (e.target.closest('[data-fa-mine]')) openMine(); });
            document.body.appendChild(ov); document.documentElement.classList.add('fa-lock');
            document.addEventListener('keydown', escOv);
        }
        renderTeam(ov.querySelector('.fa-ov-b'));
        ov.querySelector('[data-fa-ovclose]').focus();
    }
    function escOv(e) { if (e.key === 'Escape' && !document.querySelector('.fa-panel-ov')) closeOverlay(); }
    function closeOverlay() { document.querySelector('.fa-ov')?.remove(); document.removeEventListener('keydown', escOv); stopAuto(); if (!document.querySelector('.fa-panel-ov')) document.documentElement.classList.remove('fa-lock'); }

    // ── Xodimning o'z kartasi ([data-fa-my]) ────────────────────────────────
    const myCache = { at: 0, v: null };
    async function fillMy(el) {
        if (el.dataset.faDone) return; el.dataset.faDone = '1';
        el.innerHTML = '<section class="fa-my"><div class="fa-sk"></div></section>';
        try {
            if (!myCache.v || Date.now() - myCache.at > 60000) { myCache.v = await api(`/me?period=day&date=${todayKey()}`); myCache.at = Date.now(); }
            const d = myCache.v, mx = Math.max(1, d.minutes);
            el.innerHTML = `<button type="button" class="fa-my" data-fa-mine-open><span class="fa-card-h"><span class="fa-sec">Platformada bugun</span><span class="fa-link">Batafsil ›</span></span>
                <b class="fa-big">${durL(d.minutes)}</b>${bar(d.inHours == null ? d.minutes : d.inHours, d.inHours == null ? 0 : d.outside, mx)}
                ${d.inHours == null ? '' : `<span class="fa-kv"><span>Ish vaqtida</span><b>${dur(d.inHours)}</b></span><span class="fa-kv"><span class="fa-vio">Ish vaqtidan tashqari</span><b>${dur(d.outside)}</b></span>`}<span class="fa-kv"><span>Harakatlar</span><b>${fmtN(d.actions)}</b></span>
                <small class="fa-mt">Sayt ochiq va siz faol boʻlgan vaqt hisoblanadi — telefondan va ishdan tashqari ham. Buni rahbaringiz va direktor ham koʻradi; maoshga taʼsir qilmaydi.</small></button>`;
        } catch (e) { el.innerHTML = ''; }
    }
    function scanMy() { document.querySelectorAll('[data-fa-my]:not([data-fa-done])').forEach(fillMy); }

    // ── Menyu bandlari va global bosishlar ──────────────────────────────────
    document.addEventListener('click', e => {
        const o = e.target.closest?.('[data-fa-open]');
        if (o) { e.preventDefault(); e.stopPropagation(); openOverlay(); return; }
        const m = e.target.closest?.('[data-fa-mine-open]');
        if (m) { e.preventDefault(); openMine(); }
    }, true);
    // Akademik rahbar kompyuterda: sidebar'dagi «Davomat soʻrovlari» ostiga «Faollik» bandi.
    function menus() {
        const desk = !window.matchMedia('(max-width: 900px)').matches;
        let a = document.querySelector('#sidebarMenu [data-fa-menu]');
        const anchor = document.querySelector('#sidebarMenu .menu-item[data-akd="attreq"]') || document.querySelector('#sidebarMenu .menu-item[data-akd="att"]');
        if (user().role !== 'akademik' || !desk || !anchor) { if (a) a.style.display = 'none'; return; }
        if (!a) {
            a = document.createElement('a'); a.href = '#'; a.className = 'menu-item menu-item--akd'; a.dataset.faMenu = '1'; a.setAttribute('data-fa-open', '');
            a.innerHTML = `<svg viewBox="0 0 24 24">${I.bolt}</svg><span class="label">Faollik</span>`;
        }
        if (a.previousElementSibling !== anchor) anchor.after(a);
        a.style.display = '';
    }
    function deepLink() {
        try {
            const q = new URLSearchParams(location.search);
            if (q.get('faollik') !== '1' || !tracks()) return false;
            q.delete('faollik'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
            setTimeout(openOverlay, 1200);
            return true;
        } catch (e) { return false; }
    }
    let booted = false;
    function boot() {
        if (booted) { menus(); return; }
        if (!tracks()) return;
        booted = true;
        bootTracker(); menus(); deepLink();
        let q = 0; new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; scanMy(); }); }).observe(document.body, { childList: true, subtree: true });
        setInterval(menus, 5000);
        scanMy();
    }
    window.faollik = { renderTeam, openOverlay, openPerson, openMine, menus, canTeam, _section: section };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 800)); else setTimeout(boot, 800);
    // Kirish keyinroq bo'lsa (login → kabinet) — qayta urinamiz.
    let tries = 0; const iv = setInterval(() => { boot(); if (booted || ++tries > 40) clearInterval(iv); }, 3000);
})();
