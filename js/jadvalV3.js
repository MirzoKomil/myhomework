// Dars jadvali v3 (2026-10-31, dizayn: "Dars jadvali — 3 variant" kanvasi, tanlangan A).
// Admin, boshliq, ROP va sotuv menejeri uchun bitta sahifa, ikki rejim:
//   • "Sinov darsi" (standart): faqat Bugun va keyingi ish kuni, 30 daqiqalik qatorlar,
//     "shu soatda kim bo'sh?" → lid tanlash → 10 daqiqa ushlab turish → tasdiqlash.
//     Lid avtomatik "Sinov darsida" ustuniga o'tadi (server: /bookings + attach-lead).
//   • "Darslar": ustozlarning faqat o'qiyotgan o'quvchilari, 15 daqiqalik qatorlar,
//     Toq (Du·Ch·Ju) / Juft (Se·Pa·Sh) kunlar. Bo'sh vaqt ko'rsatilmaydi.
// Lidlar bo'limidagi sinov tugmalari ham shu sahifani lid bilan ochadi (openForLead).
// Maxfiylik serverda: sotuvga boshqa o'quvchi/lid ismlari kelmaydi (redactForSales),
// sotuv menejeri faqat o'zi sotgan o'quvchi ismini ko'radi. Bu fayl faqat ko'rsatadi.
(function () {
    'use strict';
    const U = () => window.schoolUI;
    const SS = () => window.schoolSchedule;
    const user = () => (typeof getCurrentUser === 'function' ? getCurrentUser() : null) || {};
    const role = () => user().role || '';
    const isFull = () => ['admin', 'boshliq'].includes(role());
    const canMove = () => ['admin', 'boshliq', 'rop'].includes(role());
    const enabled = () => !!window.schoolUI && ['admin', 'boshliq', 'rop', 'sales_manager'].includes(role());
    const ownLang = () => (typeof getUserOwnLang === 'function' && getUserOwnLang()) || '';
    const canPickLang = () => isFull() || (role() === 'rop' && !ownLang());
    const MOBILE = window.matchMedia('(max-width: 900px)');
    const DAY = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const DAYL = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
    const MON = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const TRIAL = 30;
    const TOQ = [1, 3, 5], JUFT = [2, 4, 6];
    // Sinovga qo'yiladigan lidlar — Lidlar bo'limidagi ustunlar (kanban tartibida). "Sinov darsida" kiritilmaydi.
    const COLS = [['yangi-lidlar', 'Yangi lidlar'], ['boglanishga-urinilmoqda', 'Bogʻlanishga urinilmoqda'], ['boglanildi', 'Bogʻlanildi'],
        ['qaror-jarayonida', 'Qaror jarayonida'], ['keyin-sotib-olmoqchi', 'Keyin sotib olmoqchi']];
    const COL_OF = s => (s === 'yangi' || !s ? 'yangi-lidlar' : s);
    const esc = s => U().esc(s);
    const hm = m => U().hm(m);
    const short = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : (p[0] || ''); };
    const dm = d => `${Number(d.slice(8))}-${MON[Number(d.slice(5, 7)) - 1]}`;
    const tashDate = ms => new Date(ms + 5 * 3600000).toISOString().slice(0, 10);
    const tashMin = ms => { const d = new Date(ms + 5 * 3600000); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
    const fits = (list, s, e) => (list || []).some(f => f.start <= s && e <= f.end);
    const toast = (m, ms) => U().toast(m, ms);
    const ICON = {
        user: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
        back: '<path d="M19 12H5M12 19l-7-7 7-7"/>'
    };
    const svg = (k, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

    // ── Holat ────────────────────────────────────────────────────────────────
    const J = { mode: 'sinov', day: 'today', pat: null, range: null, sel: null, mobT: null, tf: 'all', data: null, err: null, loading: false, seq: 0,
        lead: null, opts: {}, page: null, root: null, hold: null, busy: false, picker: null, timers: [] };

    // ── Sanalar ──────────────────────────────────────────────────────────────
    const today = () => U().today();
    function nextWork(d) { let x = U().addDays(d, 1); while (U().wd(x) === 7) x = U().addDays(x, 1); return x; }
    const sinovDate = () => (J.day === 'today' ? today() : nextWork(today()));
    function patDate(pat) { const days = pat === 'juft' ? JUFT : TOQ; let d = today(); for (let i = 0; i < 8 && !days.includes(U().wd(d)); i++) d = U().addDays(d, 1); return d; }
    const defaultPat = () => (JUFT.includes(U().wd(today())) ? 'juft' : 'toq');
    const curDate = () => (J.mode === 'sinov' ? sinovDate() : patDate(J.pat || defaultPat()));
    // "Ertaga" faqat haqiqatan ertangi kun bo'lsa; shanbadan keyin — "Dushanba".
    const nextName = () => { const n = nextWork(today()); return n === U().addDays(today(), 1) ? 'Ertaga' : DAYL[U().wd(n) - 1]; };
    const dayWord = d => (d === today() ? 'Bugun' : d === nextWork(today()) ? nextName() : DAYL[U().wd(d) - 1]);
    const dayLabel = d => `${DAY[U().wd(d) - 1]} · ${dm(d)}`;
    function lang() {
        if (J.lead) return J.lead._lang;
        if (!canPickLang()) return ownLang() || 'english';
        const st = SS()?.state; return st?.lang || ownLang() || 'english';
    }

    // ── Ma'lumot ─────────────────────────────────────────────────────────────
    async function load() {
        const seq = ++J.seq, date = curDate(), L = lang();
        J.loading = true;
        try {
            // Darslar: kunlar guruhining 3 kuni (masalan Du, Ch, Ju) birga yuklanadi va birlashtiriladi.
            const dates = J.mode === 'sinov' ? [date] : patDates(date);
            const r = await U().api(`/schedule?from=${dates[0]}&to=${dates[dates.length - 1]}&lang=${L}${J.mode === 'sinov' ? '&mode=free' : ''}`);
            if (seq !== J.seq) return;
            const views = new Map();
            if (J.mode === 'sinov') for (const v of r.views || []) { if (v.date === date) views.set(v.teacherId, v); }
            else {
                const by = new Map();
                for (const v of r.views || []) if (dates.includes(v.date)) { if (!by.has(v.teacherId)) by.set(v.teacherId, []); by.get(v.teacherId).push(v); }
                for (const [tid, vs] of by) views.set(tid, mergeDays(vs, dates.length));
            }
            const teachers = (r.teachers || []).filter(t => views.has(t.id));
            J.data = { date, lang: L, mode: J.mode, teachers, views, unassigned: r.unassigned || [], scope: r.scope };
            J.err = null;
        } catch (e) { if (seq === J.seq) { J.err = e; J.data = null; } }
        if (seq === J.seq) { J.loading = false; draw(); }
    }
    // Darslar: guruhdagi kunlar ro'yxati (birinchi sanadan boshlab, 7 kun ichida).
    function patDates(d0) {
        const days = TOQ.includes(U().wd(d0)) ? TOQ : JUFT, out = [];
        for (let d = d0, i = 0; i < 7 && out.length < 3; i++, d = U().addDays(d, 1)) if (days.includes(U().wd(d))) out.push(d);
        return out;
    }
    // Uch kunni bitta ko'rinishga: darslar birlashtiriladi (takrorlanmaydi); ta'til/yopiq faqat hamma kunda bo'lsa ko'rsatiladi.
    function mergeDays(vs, n) {
        const seen = new Set(), items = [];
        for (const v of vs) for (const i of v.items || []) {
            if (i.kind === 'leave' || i.kind === 'close') continue;
            const k = `${i.kind}|${i.studentId || i.bookingId || ''}|${i.start}`;
            if (!seen.has(k)) { seen.add(k); items.push(i); }
        }
        const lv = (vs[0].items || []).filter(i => i.kind === 'leave');
        for (const l of lv) if (vs.length === n && vs.every(v => (v.items || []).some(x => x.kind === 'leave' && x.start <= l.start && x.end >= l.end))) items.push(l);
        return { ...vs[0], items: items.sort((a, b) => a.start - b.start), days: vs };
    }
    const lessonItems = v => (v?.items || []).filter(i => i.kind === 'lesson' && !i.bookingId && !i.frozen);
    const lessonsOf = v => lessonItems(v).length;

    // Sinov katagining holati (30 daqiqa).
    function slotState(v, m) {
        if (!v) return { k: 'off' };
        const s = m, e = m + TRIAL;
        if (J.data.date === today() && s < U().nowMin()) return { k: 'past' };
        if (fits(v.trialFree, s, e)) return { k: 'free' };
        const hit = (v.items || []).filter(i => i.start < e && i.end > s && !(i.kind === 'reserved' || i.frozen));
        const tr = hit.find(i => i.kind === 'trial');
        // ROP'ga server barcha sinovlarni "mine" deb yuboradi (o'z tilidagi sinovlarni boshqaradi) — "Mening" yorlig'i faqat sotuv menejeriga.
        const mine = tr && tr.mine && role() === 'sales_manager';
        if (tr) return { k: tr.status === 'hold' ? (mine ? 'mine' : 'hold') : mine ? 'mineTrial' : 'trial' };
        if (hit.some(i => i.kind === 'leave')) return { k: 'leave' };
        if (hit.some(i => i.kind === 'close')) return { k: 'closed' };
        if (hit.length) return { k: 'busy' };
        if (fits(v.work, s, e)) return { k: 'notrial' };
        return { k: 'off' };
    }
    const CELL = { free: 'Boʻsh', busy: 'Band', trial: 'Sinov', mineTrial: 'Mening sinovim', hold: 'Ushlab turilgan', mine: 'Siz ushlab turibsiz',
        leave: 'Taʼtil', closed: 'Yopiq', notrial: 'Sinovga yopiq', off: 'Ish vaqti emas', past: '—' };

    function freeAt(m) {
        const out = [];
        for (const t of J.data.teachers) if (slotState(J.data.views.get(t.id), m).k === 'free') out.push(t);
        return out.sort((a, b) => lessonsOf(J.data.views.get(a.id)) - lessonsOf(J.data.views.get(b.id)) || a.name.localeCompare(b.name));
    }
    function rangeMins() {
        const r = J.range || 'eve';
        // Sinov: 30 daqiqalik oxirgi qator 23:00 (ish vaqti 23:59 gacha — 23:30–24:00 sig'maydi). Darslar: 24:00 gacha.
        const [a, b] = r === 'morn' ? [7 * 60, 14 * 60] : [14 * 60, J.mode === 'sinov' ? 23 * 60 + 30 : 24 * 60];
        return { a, b };
    }

    // ── Kirish nuqtalari ─────────────────────────────────────────────────────
    function render(root) {
        if (!enabled()) return false;
        J.root = root; J.page = null;
        if (!J.pat) J.pat = defaultPat();
        mount();
        return true;
    }
    // Lidlar bo'limidagi "Sinov darsi" tugmalari: jadval shu lid bilan, alohida sahifa bo'lib ochiladi.
    function openForLead(opts = {}) {
        if (!enabled() || !opts.leadId) return false;
        const lead = findLead(opts.lang || 'english', opts.leadId);
        if (!lead) return false;
        closePage({ silent: true });
        if (typeof closeModal === 'function') { try { closeModal(); } catch { /* yopiq */ } }
        const el = document.createElement('div');
        el.id = 'jvPage'; el.className = 'jv-page';
        el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Sinov darsini qoʻyish');
        (document.querySelector('.content-main') || document.body).appendChild(el);
        document.body.classList.add('jv-page-open');
        J.page = el; J.root = el; J.lead = lead; J.opts = opts; J.mode = 'sinov'; J.sel = null; J.mobT = null; J.data = null;
        mount();
        return true;
    }
    function mount() {
        U().loadStaffAvatars?.();
        J.timers.forEach(clearInterval); J.timers = [];
        J.timers.push(setInterval(tick, 1000));
        // Boshqa menejerlar band qilganini ko'rish uchun jim yangilash (input/oyna ochiq bo'lmasa).
        J.timers.push(setInterval(() => { if (!J.busy && !J.picker && !J.hold && J.root && document.body.contains(J.root) && J.root.offsetParent) load(); }, 30000));
        J.root.innerHTML = '<div class="sc-skel"></div>';
        load();
    }
    function closePage({ silent = false, saved = false } = {}) {
        const page = J.page;
        if (J.hold) releaseHold();
        closeOverlay();
        J.timers.forEach(clearInterval); J.timers = [];
        if (!page) { J.lead = null; J.opts = {}; return; }
        const opts = J.opts;
        page.remove(); document.body.classList.remove('jv-page-open');
        J.page = null; J.lead = null; J.opts = {}; J.root = null; J.data = null;
        if (silent) return;
        if (opts.onClose) opts.onClose(saved);
        else if (typeof renderLeads === 'function') renderLeads();
    }

    // ── Chizish ──────────────────────────────────────────────────────────────
    function draw() {
        const root = J.root;
        if (!root || !document.body.contains(root)) { J.timers.forEach(clearInterval); J.timers = []; return; }
        if (J.err && !J.data) {
            root.innerHTML = header() + `<div data-err></div>`;
            const box = root.querySelector('[data-err]');
            box.innerHTML = window.LoadErr ? window.LoadErr.html({ title: 'Jadvalni yuklab boʻlmadi', err: J.err, note: '' }) : `<p class="sc-err">${esc(J.err.message)}</p>`;
            window.LoadErr?.bind(box, () => load());
            bindHead(root); return;
        }
        if (!J.data) return;
        const mob = MOBILE.matches;
        root.innerHTML = `<div class="jv${mob ? ' jv--m' : ''}">${header()}${leadBanner()}${toolbar()}${J.mode === 'sinov' ? (mob ? sinovMobile() : sinovDesktop()) : (mob ? darsMobile() : darsDesktop())}</div>`;
        bind(root);
        if (!mob) stick(root);
    }
    // Aylantirganda filtrlar, ustozlar qatori va o'ng panel tepada qotib turadi (solishtirish uchun).
    let stickRO = null;
    function stick(root) {
        const jv = root.querySelector('.jv'), tb = root.querySelector('.jv-tb');
        if (!jv || !tb) return;
        const set = () => jv.style.setProperty('--jv-st', `${tb.offsetHeight + 18}px`);
        set();
        stickRO?.disconnect();
        if (window.ResizeObserver) { stickRO = new ResizeObserver(set); stickRO.observe(tb); }
        const sc = root.querySelector('.jv-scroll'), gh = root.querySelector('.jv-ghw');
        if (sc && gh) sc.addEventListener('scroll', () => { gh.scrollLeft = sc.scrollLeft; }, { passive: true });
    }
    function header() {
        const L = lang();
        const sub = J.mode === 'sinov'
            ? `Sinov darsi uchun boʻsh vaqt · faqat bugun va keyingi ish kuni · ${L === 'russian' ? 'Rus' : 'Ingliz'} tili · Toshkent vaqti`
            : `Ustozlarning asosiy darslari · faqat oʻqiyotgan oʻquvchilar · ${L === 'russian' ? 'Rus' : 'Ingliz'} tili`;
        const back = J.page ? `<button type="button" class="jv-back" data-close-page>${svg('back', 16)} Lidlar</button>` : '';
        const langSeg = !J.lead && canPickLang() ? `<div class="jv-seg jv-seg--sm" role="group" aria-label="Yoʻnalish"><button type="button" data-lang="english" aria-pressed="${L === 'english'}">Ingliz</button><button type="button" data-lang="russian" aria-pressed="${L === 'russian'}">Rus</button></div>` : '';
        const modes = J.page ? '' : `<div class="jv-seg" role="group" aria-label="Jadval">${[['sinov', 'Sinov darsi'], ['darslar', 'Darslar']].map(([k, l]) =>
            `<button type="button" data-mode="${k}" aria-pressed="${J.mode === k}">${l}</button>`).join('')}</div>`;
        const extra = !J.page && isFull() ? `<button type="button" class="jv-link" data-admin-week>Ustoz ish vaqti →</button>` : '';
        return `<div class="jv-head">${back}<div class="jv-title"><h1>${J.page ? 'Sinov darsini qoʻyish' : 'Dars jadvali'}</h1><p>${esc(sub)}</p></div>
            <div class="jv-headr">${extra}${langSeg}${modes}</div></div>`;
    }
    function leadBanner() {
        if (!J.lead || J.mode !== 'sinov') return '';
        const l = J.lead, w = wishOf(l);
        const col = COLS.find(c => c[0] === COL_OF(l.status))?.[1] || '';
        return `<div class="jv-lead"><span class="jv-lead-ic">${svg('user', 20)}</span><div><div class="jv-eyebrow">Lidlar boʻlimidan · sinov qoʻyilyapti</div>
            <div class="jv-lead-n">${esc(l.name || '—')}<span>${col ? ' · ' + esc(col) : ''}${w.text ? ' · istagi: ' + esc(w.text) : ''}</span></div></div>
            <button type="button" class="jv-lead-ch" data-change-lead>Lidni almashtirish</button></div>`;
    }
    function toolbar() {
        const chip = (on, attrs, label, sub = '') => `<button type="button" class="jv-chip${on ? ' is-on' : ''}" ${attrs} aria-pressed="${on}">${label}${sub ? `<small>${sub}</small>` : ''}</button>`;
        const days = J.mode === 'sinov'
            ? chip(J.day === 'today', 'data-day="today"', 'Bugun', dayLabel(today())) + chip(J.day === 'next', 'data-day="next"', nextName(), dayLabel(nextWork(today())))
            : chip(J.pat === 'toq', 'data-pat="toq"', 'Toq kunlar', 'Du · Ch · Ju') + chip(J.pat === 'juft', 'data-pat="juft"', 'Juft kunlar', 'Se · Pa · Sh');
        const r = J.range || 'eve';
        const ranges = MOBILE.matches ? '' : `<div class="jv-tb-g"><span class="jv-tb-l">Vaqt:</span>${chip(r === 'morn', 'data-range="morn"', '07:00 – 14:00')}${chip(r === 'eve', 'data-range="eve"', '14:00 – 24:00')}</div>`;
        const hint = MOBILE.matches ? '' : `<span class="jv-pill">${J.mode === 'sinov' ? 'Har bir sinov 30 daqiqa' : 'Har qator 15 daqiqa'}</span>`;
        return `<div class="jv-tb"><div class="jv-tb-g">${days}</div>${ranges ? `<i class="jv-tb-sep"></i>${ranges}` : ''}${hint}</div>`;
    }

    // ── Sinov darsi · kompyuter ──────────────────────────────────────────────
    function sinovDesktop() {
        const { a, b } = rangeMins();
        const T = J.data.teachers, now = U().nowMin(), isToday = J.data.date === today();
        const nowRow = isToday ? Math.floor(now / 30) * 30 : -1;
        const cols = `72px repeat(${Math.max(1, T.length)}, minmax(104px, 1fr)) 76px`;
        const head = `<div class="jv-gh" style="grid-template-columns:${cols}"><div class="jv-gh-t">Soat</div>${T.map(t => `<div class="jv-gh-c">${U().staffAvatar(t, 30)}<b>${esc(short(t.name))}</b><small>${lessonsOf(J.data.views.get(t.id))} dars</small></div>`).join('')}<div class="jv-gh-t jv-c">Boʻsh</div></div>`;
        let rows = '';
        // Bugun: o'tgan soatlar bitta yig'ma qatorda (jadval hozirgi vaqtdan boshlanadi).
        const firstLive = isToday ? Math.max(a, Math.ceil((now + 1) / 30) * 30) : a;
        if (firstLive > a && firstLive < b) rows += `<div class="jv-gr is-past jv-gr--fold" style="grid-template-columns:${cols}"><div class="jv-gt"></div><div class="jv-fold" style="grid-column: 2 / -1">${hm(a)}–${hm(firstLive)} · oʻtgan vaqt yashirildi</div></div>`;
        for (let m = Math.min(firstLive, b); m < b; m += 30) {
            let free = 0;
            const cells = T.map(t => {
                const st = slotState(J.data.views.get(t.id), m);
                if (st.k === 'free') free++;
                const on = J.sel && J.sel.t === t.id && J.sel.m === m;
                const lab = st.k === 'free' && on ? '✓ Tanlandi' : CELL[st.k];
                return `<div class="jv-cell"><button type="button" class="jv-s jv-s--${st.k}${on ? ' is-on' : ''}"${st.k === 'free' ? ` data-slot="${esc(t.id)}|${m}"` : ' tabindex="-1" aria-disabled="true"'} aria-label="${esc(t.name)} · ${hm(m)} · ${lab}">${lab}</button></div>`;
            }).join('');
            const past = isToday && m < now;
            const cnt = past ? '<span class="jv-cnt is-past">oʻtdi</span>' : `<span class="jv-cnt jv-cnt--${free >= 4 ? 'ok' : free >= 2 ? 'mid' : free === 1 ? 'low' : 'none'}">${free} ta</span>`;
            rows += `<div class="jv-gr${m === nowRow ? ' is-now' : ''}${past ? ' is-past' : ''}" style="grid-template-columns:${cols}"><div class="jv-gt">${hm(m)}</div>${cells}<div class="jv-gc">${cnt}</div></div>`;
        }
        const over = isToday && firstLive >= b;
        const empty = !T.length ? `<div class="jv-empty">Bu tilda ustoz topilmadi.</div>`
            : over ? `<div class="jv-empty">Bugun bu oraliqda boʻsh vaqt qolmadi.<br><button type="button" class="jv-btn jv-btn--soft jv-inl" data-day="next">${esc(nextName())}ni koʻrish</button></div>` : '';
        return `<div class="jv-body"><div class="jv-card jv-grid"><div class="jv-ghw">${head}</div><div class="jv-scroll">${rows}</div>${empty}</div>${sinovPanel()}</div>`;
    }
    function sinovPanel() {
        const legend = `<div class="jv-card jv-legend"><div class="jv-eyebrow">Belgilar</div>
            <div><i class="jv-sw jv-s--free"></i>Boʻsh — bosib tanlang</div><div><i class="jv-sw jv-s--busy"></i>Band — darsi bor</div>
            <div><i class="jv-sw jv-s--trial"></i>Boshqa sinov qoʻyilgan</div><div><i class="jv-sw jv-s--hold"></i>Boshqa menejer ushlab turibdi</div>
            ${role() === 'sales_manager' ? '<div><i class="jv-sw jv-s--mineTrial"></i>Mening sinovim</div>' : ''}<div><i class="jv-sw jv-s--notrial"></i>Taʼtil / yopiq / ish vaqti emas</div></div>`;
        const un = (isFull() || role() === 'rop') && J.data.unassigned?.length
            ? `<div class="jv-card jv-note"><b>Ustoz biriktirilmagan sinovlar · ${J.data.unassigned.length}</b><p>Lid istagan vaqtda hech kim boʻsh boʻlmagan.</p><button type="button" class="jv-btn jv-btn--soft" data-goto-trials>Sinov darslarini ochish</button></div>` : '';
        if (!J.sel) {
            return `<aside class="jv-side"><div class="jv-card jv-pn"><div class="jv-eyebrow">Sinov darsi · 30 daqiqa</div><h2>Vaqtni tanlang</h2>
                <p class="jv-mt">Jadvaldan yashil “Boʻsh” katakni bosing. ${J.lead ? `Sinov <b>${esc(J.lead.name)}</b> uchun qoʻyiladi.` : 'Keyin lidni tanlaysiz.'}</p></div>${un}${legend}</aside>`;
        }
        const m = J.sel.m, list = freeAt(m);
        const pick = list.find(t => t.id === J.sel.t) || list[0];
        const rows = list.map((t, i) => `<button type="button" class="jv-opt${pick && t.id === pick.id ? ' is-on' : ''}" data-pick-t="${esc(t.id)}">${U().staffAvatar(t, 36)}<span><b>${esc(t.name)}</b><small>${lessonsOf(J.data.views.get(t.id))} dars bu kuni</small></span><em class="jv-tag${i === 0 ? ' jv-tag--ok' : ''}">${i === 0 ? 'Tavsiya' : 'Boʻsh'}</em></button>`).join('');
        const btn = pick ? (J.lead ? `${esc(short(J.lead.name))} → ${esc(short(pick.name))} · sinovni qoʻyish` : `${esc(short(pick.name))} ga sinov qoʻyish`) : '';
        return `<aside class="jv-side"><div class="jv-card jv-pn"><div class="jv-eyebrow">Sinov darsi · 30 daqiqa</div><h2>${hm(m)} – ${hm(m + TRIAL)}</h2>
            <p class="jv-mt">${esc(dayWord(J.data.date))} · ${esc(dayLabel(J.data.date))} · bu vaqtda ${list.length} ta ustoz boʻsh</p>
            <div class="jv-sub">Kim boʻsh — kam yuklangani birinchi</div><div class="jv-opts">${rows || '<p class="jv-warn">Bu vaqt endi boʻsh emas — boshqa vaqtni tanlang.</p>'}</div>
            ${pick ? `<button type="button" class="jv-btn" data-book="${esc(pick.id)}|${m}"${J.busy ? ' disabled' : ''}>${btn}</button>` : ''}
            <p class="jv-mt">${J.lead ? 'Lid avtomatik “Sinov darsida” ustuniga oʻtadi. Ustoz tasdiqlagach sizga xabar keladi.' : 'Bosilganda lid tanlash oynasi ochiladi. Vaqt 10 daqiqa siz uchun ushlab turiladi.'}</p></div>${un}${legend}</aside>`;
    }

    // ── Sinov darsi · telefon ────────────────────────────────────────────────
    function sinovMobile() {
        const now = U().nowMin(), isToday = J.data.date === today();
        const start = isToday ? Math.max(7 * 60, Math.ceil((now + 1) / 30) * 30) : 7 * 60;
        const hours = [];
        for (let m = start; m < 23 * 60 + 30; m += 30) hours.push(m);
        if (!hours.length) return `<div class="jv-mb"><div class="jv-empty">Bugun boʻsh vaqt qolmadi.<br><button type="button" class="jv-btn jv-btn--soft jv-inl" data-day="next">${esc(nextName())}ni koʻrish</button></div></div>`;
        if (J.mobT == null || J.mobT < start) J.mobT = hours.find(m => freeAt(m).length) ?? start;
        const sel = J.mobT;
        const chips = hours.map(m => { const n = slotFreeCount(m), past = isToday && m < now, on = m === sel;
            return `<button type="button" class="jv-hr${on ? ' is-on' : ''}${past ? ' is-past' : ''}" data-hour="${m}"${past ? ' disabled' : ''}><b>${hm(m)}</b><small class="jv-hr-n jv-hr-n--${n >= 3 ? 'ok' : n >= 1 ? 'low' : 'none'}">${past ? '—' : n + ' boʻsh'}</small></button>`; }).join('');
        const rank = { free: 0, mineTrial: 1, busy: 2, trial: 3, hold: 4, mine: 4, notrial: 5, closed: 5, leave: 6, off: 7, past: 8 };
        const list = J.data.teachers.map(t => ({ t, st: slotState(J.data.views.get(t.id), sel), n: lessonsOf(J.data.views.get(t.id)) }))
            .sort((x, y) => rank[x.st.k] - rank[y.st.k] || x.n - y.n);
        const free = list.filter(x => x.st.k === 'free').length;
        const rows = list.map(({ t, st, n }) => `<div class="jv-mrow">${U().staffAvatar(t, 40)}<span><b>${esc(t.name)}</b><small>${n} dars bu kuni</small></span>${st.k === 'free'
            ? `<button type="button" class="jv-act" data-book="${esc(t.id)}|${sel}"${J.busy ? ' disabled' : ''}>${J.lead ? 'Tanlash' : 'Sinov qoʻyish'}</button>`
            : `<em class="jv-act jv-act--${st.k}">${CELL[st.k]}</em>`}</div>`).join('');
        return `<div class="jv-mb"><div class="jv-eyebrow jv-pad">Soatni tanlang</div><div class="jv-hours">${chips}</div>
            <div class="jv-sum"><span class="jv-sum-n">${free}</span><div><b>${hm(sel)} da ${free} ta ustoz boʻsh</b><small>${hm(sel)}–${hm(sel + TRIAL)} · kam yuklangan ustoz birinchi</small></div></div>
            <div class="jv-mlist">${rows || '<div class="jv-empty">Bu tilda ustoz topilmadi.</div>'}</div>
            <p class="jv-mt jv-pad">Sinov qoʻyilganda vaqt 10 daqiqa siz uchun ushlab turiladi.</p></div>`;
    }
    const slotFreeCount = m => J.data.teachers.reduce((n, t) => n + (slotState(J.data.views.get(t.id), m).k === 'free' ? 1 : 0), 0);

    // ── Darslar · kompyuter ──────────────────────────────────────────────────
    const RH = 30;
    function lessonName(i) {
        if (i.studentName) return i.studentName;
        return 'Band';
    }
    const durTone = d => (d <= 15 ? 15 : d <= 30 ? 30 : 60);
    function teacherMeta(v) {
        const ls = lessonItems(v), mins = ls.reduce((a, x) => a + (x.end - x.start), 0);
        if (!ls.length) return 'dars yoʻq';
        const h = Math.floor(mins / 60), mm = mins % 60;
        return `${ls.length} dars · ${h ? h + ' s ' : ''}${mm ? mm + ' daq' : ''}`.trim();
    }
    function darsDesktop() {
        const { a, b } = rangeMins();
        const T = J.data.teachers;
        const cols = `64px repeat(${Math.max(1, T.length)}, minmax(120px, 1fr))`;
        const head = `<div class="jv-gh" style="grid-template-columns:${cols}"><div class="jv-gh-t">Soat</div>${T.map(t => `<div class="jv-gh-c">${U().staffAvatar(t, 30)}<b>${esc(short(t.name))}</b><small>${esc(teacherMeta(J.data.views.get(t.id)))}</small></div>`).join('')}</div>`;
        let ticks = '';
        for (let m = a; m < b; m += 15) {
            const k = m % 60 === 0 ? 'h' : m % 60 === 30 ? 'half' : 'q';
            ticks += `<div class="jv-tk jv-tk--${k}${(m + 15) % 60 === 0 ? ' is-last' : ''}">${hm(m)}</div>`;
        }
        const H = (b - a) / 15 * RH;
        const colsHtml = T.map(t => {
            const v = J.data.views.get(t.id);
            const its = (v?.items || []).filter(i => i.end > a && i.start < b && ((i.kind === 'lesson' && !i.bookingId && !i.frozen) || i.kind === 'leave')).sort((x, y) => x.start - y.start);
            lanes(its);
            const blocks = its.map(i => {
                const lane = i._n > 1 ? `left:calc(5px + (100% - 10px) * ${(i._l / i._n).toFixed(4)});right:auto;width:calc((100% - 10px) / ${i._n} - 2px);` : '';
                const top = (Math.max(i.start, a) - a) / 15 * RH, h = (Math.min(i.end, b) - Math.max(i.start, a)) / 15 * RH;
                if (i.kind === 'leave') return `<div class="jv-blk jv-blk--leave" style="top:${top + 2}px;height:${h - 4}px;${lane}"><b>Taʼtil</b></div>`;
                const d = i.end - i.start, tone = durTone(d), named = !!i.studentName;
                const click = (canMove() || i.ownStudent) && i.studentId;
                const on = J.sel?.sid && J.sel.sid === i.studentId && J.sel.t === t.id;
                const time = d <= 15 ? `${d} daq` : `${hm(i.start)}–${hm(i.end)}`;
                return `<${click ? 'button type="button"' : 'div'} class="jv-blk jv-blk--d${tone}${d <= 15 ? ' is-row' : ''}${named ? '' : ' is-anon'}${on ? ' is-on' : ''}" style="top:${top + 2}px;height:${h - 4}px;${lane}"${click ? ` data-lesson="${esc(t.id)}|${esc(i.studentId)}|${i.start}|${i.end}"` : ''} title="${esc(`${lessonName(i)} · ${hm(i.start)}–${hm(i.end)}`)}"><b>${esc(lessonName(i))}</b><small>${time}</small></${click ? 'button' : 'div'}>`;
            }).join('');
            return `<div class="jv-col" style="height:${H}px">${blocks}</div>`;
        }).join('');
        const empty = !T.length ? `<div class="jv-empty">Bu tilda ustoz topilmadi.</div>` : '';
        return `<div class="jv-body"><div class="jv-card jv-grid"><div class="jv-ghw">${head}</div><div class="jv-scroll"><div class="jv-tl" style="grid-template-columns:${cols}"><div class="jv-ticks">${ticks}</div>${colsHtml}</div></div>${empty}</div>${darsPanel()}</div>`;
    }
    function darsPanel() {
        const legend = `<div class="jv-card jv-legend"><div class="jv-eyebrow">Belgilar</div>
            <div><i class="jv-sw jv-blk--d15 jv-sw--s"></i>15 daqiqalik dars</div><div><i class="jv-sw jv-blk--d30"></i>30 daqiqalik dars</div>
            <div><i class="jv-sw jv-blk--d60 jv-sw--l"></i>60 daqiqalik dars</div><div><i class="jv-sw jv-blk--leave"></i>Ustoz taʼtilda</div>
            ${role() === 'sales_manager' ? '<p class="jv-mt">Faqat siz sotgan oʻquvchilar ismi koʻrinadi, qolganlari “Band”.</p>' : ''}</div>`;
        const total = J.data.teachers.reduce((n, t) => n + lessonsOf(J.data.views.get(t.id)), 0);
        const sel = J.sel?.sid ? findLesson(J.sel) : null;
        if (!sel) {
            return `<aside class="jv-side"><div class="jv-card jv-pn"><div class="jv-eyebrow">${J.pat === 'toq' ? 'Toq kunlar · Du·Ch·Ju' : 'Juft kunlar · Se·Pa·Sh'}</div><h2>${total} ta dars</h2>
                <p class="jv-mt">${canMove() ? 'Darsni bossangiz, tafsilotlar va koʻchirish chiqadi.' : 'Jadval faqat koʻrish uchun.'}</p></div>${legend}</aside>`;
        }
        const { i, t } = sel, d = i.end - i.start;
        // Ko'chirish mumkin: guruhning har 3 kunida shu vaqt ish vaqti ichida va darsi/sinovi/ta'tili yo'q (server ham tekshiradi).
        const cand = canMove() ? J.data.teachers.filter(x => { const xv = J.data.views.get(x.id); return x.id !== t.id && xv && (xv.days || [xv]).every(dv => fits(dv.work, i.start, i.end)
            && !(dv.items || []).some(o => o.start < i.end && o.end > i.start && o.kind !== 'reserved' && !o.frozen)); })
            .sort((x, y) => lessonsOf(J.data.views.get(x.id)) - lessonsOf(J.data.views.get(y.id))) : [];
        const facts = [['Vaqti', `${hm(i.start)} – ${hm(i.end)}`], ['Davomiyligi', `${d} daqiqa`], ['Kunlari', J.pat === 'toq' ? 'Du · Ch · Ju' : 'Se · Pa · Sh'], ['Ustoz', short(t.name)]];
        return `<aside class="jv-side"><div class="jv-card jv-pn"><div class="jv-eyebrow">Tanlangan dars</div><h2>${esc(i.studentName || 'Band')}</h2>
            <p class="jv-mt">${esc(t.name)}</p><div class="jv-facts">${facts.map(([k, v]) => `<div><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>
            ${canMove() ? `<div class="jv-sub">Shu vaqtda darsi yoʻq ustozlar · ${cand.length} ta</div><div class="jv-opts">${cand.map((x, n) => `<button type="button" class="jv-opt" data-move-to="${esc(i.studentId)}|${esc(x.id)}">${U().staffAvatar(x, 36)}<span><b>${esc(x.name)}</b><small>${lessonsOf(J.data.views.get(x.id))} dars bu kuni${n === 0 ? ' · tavsiya' : ''}</small></span><em class="jv-tag${n === 0 ? ' jv-tag--ok' : ''}">Koʻchirish</em></button>`).join('') || '<p class="jv-mt">Bu vaqtda hamma ustozda dars bor.</p>'}</div>` : ''}
            <button type="button" class="jv-btn" data-open-st="${esc(i.studentId)}">Oʻquvchi kartasini ochish</button>
            ${canMove() ? `<button type="button" class="jv-btn jv-btn--soft" data-move-st="${esc(i.studentId)}">Boshqa ustozga koʻchirish</button><p class="jv-mt">“Ustozni almashtirish” oynasi ochiladi: sana va sabab yoziladi, server 3 kunni tekshiradi, tarix saqlanadi, eski vaqt oʻzi boʻshaydi.</p>` : ''}
            </div>${legend}</aside>`;
    }
    // Ustma-ust darslar (bir ustozda bir vaqtda ikki o'quvchi) yonma-yon chiziladi.
    function lanes(list) {
        let group = [], end = -1;
        const flush = () => { const n = Math.max(1, ...group.map(x => x._l + 1)); group.forEach(x => { x._n = n; }); group = []; };
        for (const it of list) {
            if (it.start >= end && group.length) flush();
            const used = new Set(group.filter(x => x.end > it.start).map(x => x._l));
            let l = 0; while (used.has(l)) l++;
            it._l = l; group.push(it); end = Math.max(end, it.end);
        }
        if (group.length) flush();
    }
    function findLesson(sel) {
        const t = J.data.teachers.find(x => x.id === sel.t); if (!t) return null;
        const i = lessonItems(J.data.views.get(t.id)).find(x => x.studentId === sel.sid && x.start === sel.start);
        return i ? { i, t } : null;
    }

    // ── Darslar · telefon ────────────────────────────────────────────────────
    function darsMobile() {
        const T = J.data.teachers;
        const chips = [['all', 'Hammasi'], ...T.map(t => [t.id, short(t.name)])].map(([k, l]) => `<button type="button" class="jv-fc${J.tf === k ? ' is-on' : ''}" data-tf="${esc(k)}">${esc(l)}</button>`).join('');
        const cards = T.filter(t => J.tf === 'all' || t.id === J.tf).map(t => {
            const v = J.data.views.get(t.id), ls = lessonItems(v).sort((x, y) => x.start - y.start);
            const leave = (v?.items || []).some(i => i.kind === 'leave');
            const rows = ls.map(i => { const d = i.end - i.start, click = (canMove() || i.ownStudent) && i.studentId;
                return `<${click ? 'button type="button"' : 'div'} class="jv-ml jv-blk--d${durTone(d)}"${click ? ` data-open-st="${esc(i.studentId)}"` : ''}><b>${hm(i.start)}–${hm(i.end)}</b><span>${esc(lessonName(i))}</span><em>${d} daq</em></${click ? 'button' : 'div'}>`; }).join('');
            return `<div class="jv-card jv-tc"><div class="jv-tc-h">${U().staffAvatar(t, 36)}<span><b>${esc(t.name)}</b><small>${esc(leave ? 'taʼtilda' : teacherMeta(v))}</small></span></div>
                <div class="jv-tc-l">${rows || `<p class="jv-mt">${leave ? 'Ustoz taʼtilda' : 'Bu kunlarda darsi yoʻq'}</p>`}</div></div>`;
        }).join('');
        const note = role() === 'sales_manager' ? '<p class="jv-mt">Faqat siz sotgan oʻquvchilar ismi koʻrinadi, qolganlari “Band”.</p>' : '';
        return `<div class="jv-mb"><div class="jv-fchips">${chips}</div>${note}<div class="jv-cards">${cards || '<div class="jv-empty">Bu tilda ustoz topilmadi.</div>'}</div></div>`;
    }

    // ── Bog'lash ─────────────────────────────────────────────────────────────
    function bindHead(root) {
        root.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { if (J.mode === b.dataset.mode) return; J.mode = b.dataset.mode; J.sel = null; J.mobT = null; J.data = null; draw(); load(); });
        root.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { const st = SS()?.state; if (!st || st.lang === b.dataset.lang) return; st.lang = b.dataset.lang; st.teacherId = null; J.sel = null; J.tf = 'all'; load(); });
        root.querySelector('[data-close-page]')?.addEventListener('click', () => closePage());
        root.querySelector('[data-admin-week]')?.addEventListener('click', () => { const st = SS()?.state; if (!st) return; st.view = 'week'; J.timers.forEach(clearInterval); J.timers = []; SS().render(J.root); });
    }
    function bind(root) {
        bindHead(root);
        root.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { if (J.day === b.dataset.day) return; J.day = b.dataset.day; J.sel = null; J.mobT = null; load(); });
        root.querySelectorAll('[data-pat]').forEach(b => b.onclick = () => { if (J.pat === b.dataset.pat) return; J.pat = b.dataset.pat; J.sel = null; load(); });
        root.querySelectorAll('[data-range]').forEach(b => b.onclick = () => { J.range = b.dataset.range; draw(); });
        root.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { const [t, m] = b.dataset.slot.split('|'); J.sel = { t, m: Number(m) }; draw(); });
        root.querySelectorAll('[data-pick-t]').forEach(b => b.onclick = () => { J.sel = { ...J.sel, t: b.dataset.pickT }; draw(); });
        root.querySelectorAll('[data-hour]').forEach(b => b.onclick = () => { J.mobT = Number(b.dataset.hour); draw(); });
        root.querySelectorAll('[data-book]').forEach(b => b.onclick = () => { const [t, m] = b.dataset.book.split('|'); startBooking(t, Number(m)); });
        root.querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => { const [t, sid, s] = b.dataset.lesson.split('|'); J.sel = { t, sid, start: Number(s) }; draw(); });
        root.querySelectorAll('[data-open-st]').forEach(b => b.onclick = () => U().openStudent(b.dataset.openSt));
        const move = (sid, tid) => (U().openCardForm ? U().openCardForm(sid, 'holat', () => { J.sel = null; load(); }, { act: 'teacher', teacherId: tid || null }) : U().openStudent(sid));
        root.querySelectorAll('[data-move-st]').forEach(b => b.onclick = () => move(b.dataset.moveSt));
        root.querySelectorAll('[data-move-to]').forEach(b => b.onclick = () => { const [sid, tid] = b.dataset.moveTo.split('|'); move(sid, tid); });
        root.querySelector('[data-change-lead]')?.addEventListener('click', () => openPicker(null, null));
        root.querySelectorAll('[data-tf]').forEach(b => b.onclick = () => { J.tf = b.dataset.tf; draw(); });
        root.querySelector('[data-goto-trials]')?.addEventListener('click', () => { if (typeof switchTab === 'function') switchTab('trial-lessons'); });
        if (MOBILE.matches) root.querySelector('.jv-hr.is-on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
    MOBILE.addEventListener?.('change', () => { if (J.root && document.body.contains(J.root) && J.data) draw(); });

    // ── Lidlar (CRM keshi; server ham egasini tekshiradi) ────────────────────
    function allLeads() {
        const all = typeof getItem === 'function' && typeof STORAGE_KEYS !== 'undefined' ? getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) : { english: [], russian: [] };
        return [...(all.english || []).map(l => ({ ...l, _lang: 'english' })), ...(all.russian || []).map(l => ({ ...l, _lang: 'russian' }))];
    }
    function findLead(lang, id) {
        if (typeof getLeadById === 'function') { const l = getLeadById(lang, id); if (l) return { ...l, _lang: lang }; }
        return allLeads().find(l => l.id === id) || null;
    }
    function pickableLeads() {
        const mid = String(user().linkedManagerId || ''), L = lang();
        return allLeads().filter(l => l._lang === L && !l.deletedAt && COLS.some(c => c[0] === COL_OF(l.status))
            && (role() !== 'sales_manager' || (mid && String(l.managerId || '') === mid)));
    }
    function wishOf(l) {
        const cs = Array.isArray(l?.comments) ? l.comments : [];
        for (let i = cs.length - 1; i >= 0; i--) {
            const m = /Lid istagi:\s*([^\n]+)/.exec(String(cs[i]?.text || ''));
            if (m) { const t = /(\d{1,2}):(\d{2})/.exec(m[1]); return { text: m[1].trim(), min: t ? Number(t[1]) * 60 + Number(t[2]) : null }; }
        }
        return { text: '', min: null };
    }
    function lastTouch(l) {
        let ms = 0;
        for (const c of Array.isArray(l.comments) ? l.comments : []) { const x = Date.parse(c?.createdAt || ''); if (Number.isFinite(x) && x > ms) ms = x; }
        for (const k of ['statusChangedAt', 'lastContactAt', 'updatedAt']) { const x = Date.parse(l[k] || ''); if (Number.isFinite(x) && x > ms) ms = x; }
        return ms || null;
    }
    function touchLabel(ms) {
        if (!ms) return '—';
        const d = tashDate(ms), t = today();
        if (d === t) return `bugun ${hm(tashMin(ms))}`;
        if (d === U().addDays(t, -1)) return `kecha ${hm(tashMin(ms))}`;
        return dm(d);
    }
    const phoneTail = l => { const p = String(l.phone || '').replace(/\D/g, ''); return p ? '··· ' + p.slice(-4, -2) + ' ' + p.slice(-2) : '—'; };
    function matches(l, q) {
        if (!q) return true;
        if (typeof leadMatchesSearch === 'function') return leadMatchesSearch(l, q);
        const s = q.toLowerCase(); return String(l.name || '').toLowerCase().includes(s) || String(l.phone || '').replace(/\D/g, '').includes(s.replace(/\D/g, '') || '§');
    }

    // ── Band qilish oqimi ────────────────────────────────────────────────────
    function startBooking(teacherId, m) {
        if (J.busy) return;
        J.sel = { t: teacherId, m };
        if (J.lead) return hold(teacherId, m, J.lead);
        openPicker(teacherId, m);
    }
    async function hold(teacherId, m, lead) {
        J.busy = true; draw();
        try {
            const r = await U().post('/bookings', { kind: 'trial', teacherId, dates: [J.data.date], time: hm(m), duration: TRIAL, leadId: lead.id });
            const b = r.bookings || [];
            if (!b.length) throw new Error('Vaqtni ushlab boʻlmadi');
            J.hold = { ids: b.map(x => x.id), group: b[0].group_id, until: Date.parse(b[0].hold_until) || Date.now() + 600000, t: teacherId, m, date: J.data.date, lead };
            J.busy = false;
            openSheet();
        } catch (e) {
            J.busy = false;
            // Lidda faol sinov bor: avval "Sinov darslari"da natija yoziladi yoki bekor qilinadi, keyin qayta qo'yiladi.
            if (/allaqachon/i.test(e.message || '')) toast(`${lead.name}: sinov allaqachon qoʻyilgan. Uni “Sinov darslari” boʻlimida bekor qiling yoki natijasini yozing, keyin qayta qoʻying.`, 6500);
            else toast(e.message || 'Vaqtni ushlab boʻlmadi', 4500);
            J.sel = null; await load();
        }
    }
    function releaseHold() {
        const h = J.hold; J.hold = null;
        if (h) U().post(`/bookings/${encodeURIComponent(h.ids[0])}/cancel`).catch(() => {});
    }
    async function confirmHold() {
        const h = J.hold; if (!h || J.busy) return;
        J.busy = true; drawSheet();
        const isOwnReschedule = J.opts.leadId === h.lead.id && (J.opts.isReschedule || h.lead.status === 'sinov-darsida');
        try {
            await U().post(`/bookings/group/${encodeURIComponent(h.group)}/attach-lead`, { leadId: h.lead.id, reschedule: !!isOwnReschedule,
                prevOutcome: isOwnReschedule ? String(J.opts.prevOutcome?.label || '') : '', wish: wishOf(h.lead).text });
            J.hold = null; J.busy = false;
            closeOverlay();
            await U().refreshCache();
            const t = J.data?.teachers.find(x => x.id === h.t);
            toast(`${h.lead.name} sinovga yozildi · ${short(t?.name || '')} tasdiqlagach xabar keladi · Lidlar → “Sinov darsida”`, 4500);
            if (J.page) return closePage({ saved: true });
            J.sel = null; load();
        } catch (e) {
            J.busy = false;
            if (/muddati tugagan/i.test(e.message)) { J.hold = null; closeOverlay(); toast('Ushlab turish muddati tugadi — vaqtni qaytadan tanlang', 4500); J.sel = null; load(); return; }
            sheetError(e.message);
        }
    }

    // ── Oynalar: lid tanlash va tasdiqlash ───────────────────────────────────
    function overlay(cls, html) {
        closeOverlay(true);
        const wrap = document.createElement('div');
        wrap.className = 'jv-dim'; wrap.id = 'jvOverlay';
        wrap.innerHTML = `<div class="jv-modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
        document.body.appendChild(wrap);
        wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-x]')) cancelOverlay(); });
        document.addEventListener('keydown', onKey);
        return wrap.querySelector('.jv-modal');
    }
    function onKey(e) { if (e.key === 'Escape') cancelOverlay(); }
    function cancelOverlay() { if (J.busy) return; if (J.hold) releaseHold(); closeOverlay(); draw(); }
    function closeOverlay(keep) {
        document.getElementById('jvOverlay')?.remove();
        document.removeEventListener('keydown', onKey);
        if (!keep) J.picker = null;
    }
    function slotLine(teacherId, m, date) {
        if (!teacherId) return { t: null, text: 'Avval lidni tanlang, keyin jadvaldan vaqtni belgilaysiz' };
        const t = J.data.teachers.find(x => x.id === teacherId);
        return { t, text: `${short(t?.name || '')} · ${dayWord(date)}, ${dayLabel(date)} · ${hm(m)}–${hm(m + TRIAL)}` };
    }
    function openPicker(teacherId, m) {
        J.picker = { t: teacherId, m, date: J.data.date, q: '', tab: 'fit', col: 'all', sel: null };
        const leads = pickableLeads();
        if (m == null || !leads.some(l => isFit(l, m))) J.picker.tab = leads.some(isToday) ? 'today' : 'all';
        drawPicker(true);
    }
    // "Shu vaqtga mos": istakdagi soatdan ±1 soat; "… dan keyin" — o'sha soatdan kech; so'z bilan: ertalab / tushlik / kechqurun.
    const isFit = (l, m) => {
        if (m == null) return false;
        const w = wishOf(l), t = w.text.toLowerCase();
        if (w.min != null) return /keyin/.test(t) ? m >= w.min : /gacha|oldin/.test(t) ? m + TRIAL <= w.min : Math.abs(w.min - m) <= 60;
        if (/ertalab|ertal/.test(t)) return m < 12 * 60;
        if (/tushdan keyin|kunduzi|tushlik/.test(t)) return m >= 12 * 60 && m < 17 * 60;
        if (/kechqurun|kech|oqshom/.test(t)) return m >= 17 * 60;
        return false;
    };
    const isToday = l => { const ms = lastTouch(l); return !!ms && tashDate(ms) === today(); };
    function drawPicker(first) {
        const P = J.picker; if (!P) return;
        const all = pickableLeads(), q = P.q.trim();
        const tabs = [...(P.m == null ? [] : [['fit', 'Shu vaqtga mos', all.filter(l => isFit(l, P.m))]]), ['today', 'Bugun gaplashilgan', all.filter(isToday)], ['all', 'Hammasi', all]];
        const base = q ? all.filter(l => matches(l, q)) : tabs.find(t => t[0] === P.tab)[2];
        const list = (P.col === 'all' ? base : base.filter(l => COL_OF(l.status) === P.col))
            .sort((a, b) => (isFit(b, P.m) - isFit(a, P.m)) || ((lastTouch(b) || 0) - (lastTouch(a) || 0)));
        const shown = list.slice(0, 150);
        if (!P.sel && shown[0] && P.tab === 'fit' && !q) P.sel = shown[0].id;
        const selLead = all.find(l => l.id === P.sel);
        const { t, text } = slotLine(P.t, P.m, P.date);
        const cols = [['all', 'Barcha ustunlar', base.length], ...COLS.map(([k, l]) => [k, l, base.filter(x => COL_OF(x.status) === k).length])];
        const rows = shown.map(l => { const w = wishOf(l), fit = isFit(l, P.m), col = COLS.find(c => c[0] === COL_OF(l.status));
            return `<button type="button" class="jv-lr${l.id === P.sel ? ' is-on' : ''}" data-lead="${esc(l.id)}"><i class="jv-radio"></i><span class="jv-lr-b"><span class="jv-lr-t"><b>${esc(l.name || '—')}</b><em class="jv-st jv-st--${esc(COL_OF(l.status))}">${esc(col?.[1] || '')}</em></span>
                <small>Tel: ${esc(phoneTail(l))} · oxirgi: ${esc(touchLabel(lastTouch(l)))}</small>${w.text ? `<small class="${fit ? 'is-fit' : ''}">Istagi: ${esc(w.text)}</small>` : ''}</span>${fit ? '<em class="jv-tag jv-tag--ok">Mos</em>' : ''}</button>`; }).join('');
        const more = list.length > shown.length ? `<p class="jv-mt jv-c">Yana ${list.length - shown.length} ta — qidiruvdan foydalaning</p>` : '';
        const emptyTxt = q ? `“${esc(q)}” boʻyicha lid topilmadi. Telefonning oxirgi 4 raqamini yozib koʻring.` : P.tab === 'fit' ? 'Bu vaqtga istagi mos lid yoʻq. “Bugun gaplashilgan” yoki “Hammasi”ni oching.' : 'Bu roʻyxatda lid yoʻq.';
        const html = `<header class="jv-mh"><div class="jv-mh-r"><h2>Sinov uchun lidni tanlang</h2><button type="button" class="jv-x" data-x aria-label="Yopish">✕</button></div>
            <div class="jv-slot">${t ? U().staffAvatar(t, 28) : ''}<b>${esc(text)}</b></div>
            <label class="jv-q">${svg('search', 18)}<input id="jvLeadQ" type="search" autocomplete="off" placeholder="Ism yoki telefonning oxirgi 4 raqami" value="${esc(P.q)}" aria-label="Lid qidirish"></label>
            ${q ? '' : `<div class="jv-tabs">${tabs.map(([k, l, arr]) => `<button type="button" class="jv-tab${P.tab === k ? ' is-on' : ''}" data-ptab="${k}">${l} <b>${arr.length}</b></button>`).join('')}</div>`}
            ${`<div class="jv-colf"><span>Lidlar ustuni:</span>${cols.map(([k, l, n]) => `<button type="button" class="jv-cf${P.col === k ? ' is-on' : ''}" data-pcol="${k}">${esc(l)} · ${n}</button>`).join('')}</div>`}</header>
            <div class="jv-mlb">${rows || `<p class="jv-empty">${emptyTxt}</p>`}${more}</div>
            <footer class="jv-mf"><div><small>Tanlangan lid</small><b>${esc(selLead?.name || '—')}</b></div><button type="button" class="jv-btn" data-pick-go${selLead ? '' : ' disabled'}>${P.t ? 'Sinovni qoʻyish' : 'Shu lidni tanlash'}</button></footer>`;
        let box = document.querySelector('#jvOverlay .jv-picker');
        const focused = document.activeElement?.id === 'jvLeadQ', caret = focused ? document.activeElement.selectionStart : null;
        if (!box || first) box = overlay('jv-picker', html); else box.innerHTML = html;
        const inp = box.querySelector('#jvLeadQ');
        inp.oninput = () => { P.q = inp.value; P.sel = null; drawPicker(); };
        trapFocus(box);
        if (first || focused) { inp.focus(); if (caret != null) try { inp.setSelectionRange(caret, caret); } catch { /* */ } }
        box.querySelectorAll('[data-ptab]').forEach(b => b.onclick = () => { P.tab = b.dataset.ptab; P.sel = null; drawPicker(); });
        box.querySelectorAll('[data-pcol]').forEach(b => b.onclick = () => { P.col = b.dataset.pcol; P.sel = null; drawPicker(); });
        box.querySelectorAll('[data-lead]').forEach(b => b.onclick = () => { P.sel = b.dataset.lead; drawPicker(); });
        box.querySelector('[data-pick-go]')?.addEventListener('click', () => {
            const lead = all.find(l => l.id === P.sel); if (!lead) return;
            const { t: tid, m } = P; closeOverlay();
            if (!tid) { J.lead = lead; J.opts = { ...J.opts, leadId: lead.id }; J.sel = null; J.data && J.data.lang !== lead._lang ? load() : draw(); return; }
            hold(tid, m, lead);
        });
    }
    // Oyna ichida Tab bilan aylanish (fokus tashqariga chiqmaydi).
    function trapFocus(box) {
        box.onkeydown = e => {
            if (e.key !== 'Tab') return;
            const f = [...box.querySelectorAll('button:not([disabled]),input,[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent);
            if (!f.length) return;
            if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
            else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        };
    }
    function openSheet() {
        overlay('jv-sheet', '');
        drawSheet();
    }
    function drawSheet(err) {
        const h = J.hold, box = document.querySelector('#jvOverlay .jv-sheet'); if (!h || !box) return;
        const t = J.data?.teachers.find(x => x.id === h.t);
        const left = Math.max(0, Math.round((h.until - Date.now()) / 1000));
        box.innerHTML = `<header class="jv-mh"><div class="jv-mh-r"><h2>Sinov darsini qoʻyish</h2><button type="button" class="jv-x" data-x aria-label="Bekor qilish">✕</button></div><p class="jv-mt">Tekshirib, “Sinovni qoʻyish”ni bosing</p></header>
            <div class="jv-kv"><div><small>Lid</small><b>${esc(h.lead.name || '—')}</b></div><div><small>Ustoz</small><b>${esc(t?.name || '—')}</b></div>
            <div><small>Kun</small><b>${esc((h.date === today() ? 'Bugun · ' : '') + DAYL[U().wd(h.date) - 1] + ', ' + dm(h.date))}</b></div><div><small>Vaqt</small><b>${hm(h.m)} – ${hm(h.m + TRIAL)} · ${TRIAL} daq</b></div></div>
            <div class="jv-timer" data-timer>${svg('clock', 18)} Vaqt siz uchun ushlab turilibdi · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} qoldi</div>
            ${err ? `<p class="jv-warn">${esc(err)}</p>` : ''}
            <div class="jv-mf jv-mf--col"><button type="button" class="jv-btn" data-confirm${J.busy ? ' disabled' : ''}>${J.busy ? 'Saqlanmoqda…' : 'Sinovni qoʻyish'}</button><button type="button" class="jv-btn jv-btn--soft" data-x>Boshqa vaqt tanlash</button></div>
            <p class="jv-mt">Ustoz tasdiqlagach sizga bildirishnoma keladi. Lid holati “Sinov darsida”ga oʻtadi.</p>`;
        box.querySelector('[data-confirm]').onclick = confirmHold;
        trapFocus(box); if (!err) box.querySelector('[data-confirm]')?.focus();
        box.querySelectorAll('[data-x]').forEach(b => b.onclick = cancelOverlay);
    }
    const sheetError = msg => drawSheet(msg);
    function tick() {
        const h = J.hold; if (!h) return;
        const left = Math.round((h.until - Date.now()) / 1000);
        if (left <= 0) { J.hold = null; closeOverlay(); toast('Ushlab turish muddati tugadi — vaqtni qaytadan tanlang', 4500); J.sel = null; load(); return; }
        const el = document.querySelector('#jvOverlay [data-timer]');
        if (el) el.innerHTML = `${svg('clock', 18)} Vaqt siz uchun ushlab turilibdi · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} qoldi`;
    }

    window.jadvalV3 = { enabled, render, openForLead, close: closePage, _state: J,
        _test: { slotState, nextWork, patDate, patDates, mergeDays, wishOf, nextName, isFit: (l, m) => isFit(l, m), COLS } };
})();
