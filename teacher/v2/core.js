// Ustoz ilovasi v2 — yadro (1-noyabr 2026 dizayni, kanvas "Ustoz · yakuniy").
// Ma'lumot va qoidalar eski ilova bilan BITTA manba: window.DWT (teacher/app.js) — loadAll, davomat, sinov bosqichlari.
// Bu fayl: ramka (pastki menyu, sahifalar steki, hash), pastdan chiquvchi oyna, toast, tabrik konfetti, qulflar.
// Bo'limlar (bosh.js, jadval.js, davomat.js, boshqa.js) shu yerga ro'yxatdan o'tadi:
//   U.tab(id, { render(), bind(el) })           — pastki menyu bo'limi (home | jadval | davomat | oquvchilar | menyu)
//   U.page(id, { render(arg), bind(el, arg), nav })  — ichki sahifa (orqaga tugmasi bilan); nav:true — pastki menyu ko'rinadi
//   U.lock(id, { priority, active(), render(), bind(el) }) — butun ilovani yopuvchi oyna (sinov=1, davomat=2)
//   U.badge(tabId, fn)                          — pastki menyudagi qizil son
(function () {
    'use strict';
    const U = window.U = window.U || {};
    const TABS = [
        ['home', 'Bosh', '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"></path>'],
        ['jadval', 'Jadval', '<rect x="3" y="4.5" width="18" height="16" rx="3"></rect><path d="M3 9.5h18M8 3v3M16 3v3"></path>'],
        ['davomat', 'Davomat', '<rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M8.5 12l2.5 2.5 4.5-5"></path>'],
        ['oquvchilar', "O'quvchilar", '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"></path>'],
        ['menyu', 'Menyu', '<path d="M4 7h16M4 12h16M4 17h16"></path>']
    ];
    // Rol bo'yicha alohida ro'yxat: asosiy ustoz ('ustoz') va yordamchi ustoz ('yordamchi', teacher/v2/yordamchi.js).
    // Ichki sahifalar umumiy (id lar farqli); pastki menyu, qulf va qizil sonlar — faqat o'z rolida.
    const REG = { ustoz: { tabs: {}, locks: {}, badges: {} }, yordamchi: { tabs: {}, locks: {}, badges: {} } };
    const pages = {};
    let MODE = 'ustoz';
    const tabs = new Proxy({}, { get: (_, k) => REG[MODE].tabs[k], has: (_, k) => k in REG[MODE].tabs });
    const locks = () => REG[MODE].locks, badges = () => REG[MODE].badges;
    U.tab = (id, def, mode = 'ustoz') => { REG[mode].tabs[id] = def; };
    U.page = (id, def) => { pages[id] = def; };
    U.lock = (id, def, mode = 'ustoz') => { REG[mode].locks[id] = def; };
    U.badge = (id, fn, mode = 'ustoz') => { REG[mode].badges[id] = fn; };
    U.mode = () => MODE;
    // Yordamchida 3-bo'lim "Aloqalar" (telefon belgisi) — id o'zgarmaydi ('davomat'), hash va bog'lanishlar bir xil qoladi.
    const tabList = () => MODE === 'yordamchi' ? TABS.map(t => t[0] === 'davomat' ? ['davomat', 'Aloqalar', '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z"></path>'] : t) : TABS;

    let root = null, R = { tab: 'home', stack: [] }, started = false;
    const D = () => window.DWT;
    U.svg = (d, size = 20, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    U.HEX = id => `<svg class="hex" aria-hidden="true" width="100%" height="100%"><defs><pattern id="${id}" width="48" height="41.6" patternUnits="userSpaceOnUse"><path d="M12 0h24l12 20.8-12 20.8H12L0 20.8z" fill="none" stroke="#FFFFFF" stroke-width="1.5"></path></pattern></defs><rect width="100%" height="100%" fill="url(#${id})"></rect></svg>`;
    U.esc = s => D().esc(s);

    // ── Navigatsiya: #tab~sahifa:arg~... (orqaga tugmasi history bilan ishlaydi) ──
    const hash = () => '#' + [R.tab, ...R.stack.map(p => p.arg ? `${p.id}:${encodeURIComponent(p.arg)}` : p.id)].join('~');
    function parse() {
        const [t, ...rest] = (location.hash || '').slice(1).split('~');
        return { tab: tabs[t] ? t : 'home', stack: rest.map(x => { const i = x.indexOf(':'); return i < 0 ? { id: x, arg: '' } : { id: x.slice(0, i), arg: decodeURIComponent(x.slice(i + 1)) }; }).filter(p => pages[p.id]) };
    }
    U.go = tab => {
        if (!tabs[tab]) return;
        if (R.stack.length) { const n = R.stack.length; R.pendingTab = tab; history.go(-n); return; }
        R.tab = tab; history.replaceState({ r: { tab, stack: [] } }, '', hash()); U.render(true);
    };
    U.push = (id, arg = '') => {
        if (!pages[id]) return;
        R.stack = [...R.stack, { id, arg: String(arg || '') }];
        history.pushState({ r: { tab: R.tab, stack: R.stack } }, '', hash()); U.render(true);
    };
    U.back = () => { if (R.stack.length) history.back(); };
    U.current = () => R.stack[R.stack.length - 1] || { id: R.tab, arg: '', tab: true };
    window.addEventListener('popstate', e => {
        if (!started) return;
        const r = e.state?.r || parse();
        R.stack = r.stack || [];
        if (R.pendingTab && !R.stack.length) { R.tab = R.pendingTab; R.pendingTab = null; history.replaceState({ r: { tab: R.tab, stack: [] } }, '', hash()); }
        else R.tab = r.tab || R.tab;
        closeSheet(true); U.render(true);
    });

    // ── Chizish ──
    function nav() {
        return `<nav class="nav" aria-label="Pastki menyu">${tabList().map(([id, label, d]) => {
            const b = badges()[id], on = R.tab === id, n = b ? Number(b()) || 0 : 0;
            return `<a href="#${id}" data-u-tab="${id}"${on ? ' class="on" aria-current="page"' : ''}><span class="i">${U.svg(d, 20, on ? 2.2 : 1.9)}${n ? `<span class="bdg">${n}</span>` : ''}</span>${label}</a>`;
        }).join('')}</nav>`;
    }
    U.activeLock = () => Object.entries(locks()).sort((a, b) => (a[1].priority || 9) - (b[1].priority || 9)).find(([, l]) => { try { return l.active(); } catch { return false; } }) || null;
    U.render = (top = false) => {
        if (!root) return;
        if (root.querySelector(':scope > .sheet') && !top) { R.dirty = true; return; }
        const lock = U.activeLock();
        const cur = R.stack[R.stack.length - 1], pg = cur && pages[cur.id], tb = tabs[R.tab];
        const scroller = root.querySelector('.bd'), y = scroller ? scroller.scrollTop : 0, same = R.last === hash();
        let html;
        try { html = pg ? pg.render(cur.arg) : tb ? tb.render() : ''; }
        catch (err) { console.error('[ustoz]', err); html = errorBox(err); }
        const showNav = !pg || pg.nav;
        const keep = [...root.querySelectorAll(':scope > .u-toast, :scope > .u-cf')];
        root.innerHTML = `${html}${showNav ? nav() : ''}${lock ? `<div class="u-lock" data-lock="${lock[0]}">${lock[1].render()}</div>` : ''}`;
        keep.forEach(x => root.append(x)); // toast va konfetti qayta chizishda yo'qolmasin
        root.classList.toggle('u-locked', !!lock);
        root.querySelectorAll('[data-u-tab]').forEach(a => a.onclick = e => {
            e.preventDefault();
            if (lock && lock[1].onBlocked) return lock[1].onBlocked(a.dataset.uTab);
            U.go(a.dataset.uTab);
        });
        root.querySelectorAll('[data-u-back]').forEach(a => a.onclick = e => { e.preventDefault(); U.back(); });
        root.querySelectorAll('[data-u-push]').forEach(a => a.onclick = e => { e.preventDefault(); U.push(a.dataset.uPush, a.dataset.arg || ''); });
        root.querySelectorAll('[data-u-go]').forEach(a => a.onclick = e => { e.preventDefault(); U.go(a.dataset.uGo); });
        try { if (pg) pg.bind?.(root, cur.arg); else tb?.bind?.(root); if (lock) lock[1].bind?.(root.querySelector('.u-lock')); }
        catch (err) { console.error('[ustoz]', err); }
        const bd = root.querySelector('.bd'); if (bd) bd.scrollTop = same && !top ? y : 0;
        R.last = hash(); R.dirty = false;
    };
    function errorBox(err) {
        return `<div class="bd nb" style="padding-top: 48px"><div class="note w" role="alert"><span><b>Ekran ochilmadi.</b> ${U.esc(err?.message || '')}</span></div><button type="button" class="btn w" onclick="location.reload()">Qayta yuklash</button></div>`;
    }

    // ── Pastdan chiquvchi oyna (dizayndagi .scrim + .sheet) ──
    let sheetClose = null;
    function closeSheet(silent) {
        const s = root?.querySelector(':scope > .sheet'); if (!s) return;
        root.querySelectorAll(':scope > .scrim, :scope > .sheet').forEach(x => x.remove());
        sheetClose = null;
        if (!silent && R.dirty) U.render();
    }
    U.sheet = (html, bind, { label = '', dismiss = true } = {}) => {
        closeSheet(true);
        const scrim = document.createElement('div'); scrim.className = 'scrim';
        const sh = document.createElement('section'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
        if (label) sh.setAttribute('aria-label', label);
        sh.innerHTML = `<span class="grab" aria-hidden="true"></span>${html}`;
        root.append(scrim, sh);
        const close = () => closeSheet(false);
        sheetClose = close;
        if (dismiss) scrim.onclick = close;
        sh.querySelectorAll('[data-u-close]').forEach(b => b.onclick = close);
        try { bind?.(sh, close); } catch (err) { console.error('[ustoz]', err); }
        sh.querySelector('button, a, input')?.focus({ preventScroll: true });
        return close;
    };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetClose) sheetClose(); });

    // ── Toast ("Saqlandi · Qaytarish") ──
    let toastT = null;
    U.toast = (msg, { ok = false, undo = null, ms = 3200 } = {}) => {
        root?.querySelector('.u-toast')?.remove(); clearTimeout(toastT);
        const t = document.createElement('div'); t.className = 'u-toast' + (ok ? ' ok' : ''); t.setAttribute('role', 'status');
        t.innerHTML = `${ok ? U.svg('<path d="M5 12l5 5L20 7"></path>', 18, 2.6) : ''}<span>${U.esc(msg)}</span>${undo ? '<button type="button">Qaytarish</button>' : ''}`;
        if (undo) t.querySelector('button').onclick = () => { t.remove(); undo(); };
        root?.append(t); toastT = setTimeout(() => t.remove(), undo ? 5000 : ms);
    };

    // ── Tabrik (konfetti) — prefers-reduced-motion'da ko'rsatilmaydi ──
    U.confetti = () => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const c = document.createElement('div'); c.className = 'u-cf'; c.setAttribute('aria-hidden', 'true');
        const col = ['#FDB022', '#12B76A', '#2E90FA', '#F04438', '#9E77ED'];
        c.innerHTML = Array.from({ length: 28 }, (_, i) => `<i style="left:${(i * 37) % 100}%;background:${col[i % 5]};width:${6 + (i % 4)}px;height:${8 + (i % 6)}px;animation-delay:${(i % 9) * 0.08}s"></i>`).join('');
        root?.append(c); setTimeout(() => c.remove(), 2800);
    };

    // ── Ma'lumot ──
    U.reload = async () => { await D().loadAll(); U.render(); };
    U.today = () => D().now();
    U.S = () => D().S;
    U.api = (...a) => D().api(...a);
    // Kun bo'yicha dars jadvali (S2 "Darslar" va Bosh) — /api/school/schedule, bir marta yuklanadi.
    const cache = new Map();
    U.load = (key, fn, { ttl = 60000 } = {}) => {
        const c = cache.get(key);
        if (c && (c.loading || Date.now() - c.at < ttl)) return c;
        const e = { loading: true, at: Date.now(), data: c?.data, err: null };
        cache.set(key, e);
        fn().then(d => { e.data = d; e.err = null; }).catch(err => { e.err = err; }).finally(() => { e.loading = false; e.at = Date.now(); U.render(); });
        return e;
    };
    U.drop = prefix => { for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k); };
    U.skel = (n = 2, h = 72) => Array.from({ length: n }, () => `<div class="u-sk" style="height: ${h}px; flex: none"></div>`).join('');
    U.err = (e, key) => `<div class="note w" role="alert"><span>${U.esc(e?.err?.message || 'Yuklanmadi')}</span><button type="button" class="btn sm" data-u-retry="${U.esc(key)}" style="margin-left: auto">Qayta urinish</button></div>`;
    document.addEventListener('click', e => { const b = e.target.closest?.('[data-u-retry]'); if (b) { U.drop(b.dataset.uRetry); U.render(); } });
    U.offline = () => navigator.onLine === false
        ? `<div class="u-off" role="status"><span style="color: #FDB022; display: inline-flex">${U.svg('<path d="M1 1l22 22M16.7 11.1A10.9 10.9 0 0119 12.6M5 12.6a10.9 10.9 0 015.2-2.5M10.7 5A16 16 0 0122.6 9M1.4 9a16 16 0 014.3-2.7M8.5 16.1a5 5 0 016.9 0M12 20h.01"></path>', 20)}</span><div class="col g1"><b style="font-size: 14px">Internet yo'q</b><span style="font-size: 12px; color: #C7D2E3">${(D().outbox() || []).length ? `${D().outbox().length} ta davomat belgisi saqlandi · ulanganda o'zi yuboriladi` : 'Oxirgi yuklangan ma\'lumot ko\'rsatilmoqda'}</span></div></div>` : '';
    // Sana yozuvlari: "Dushanba, 16-noyabr"
    U.dateLong = date => { const d = D(); const [, m, dd] = date.split('-'); return `${d.DAY_FULL[d.wdOf(date) - 1]}, ${+dd}-${d.MON[+m - 1]}`; };
    U.addDays = (date, n) => { const t = new Date(`${date}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

    window.addEventListener('online', () => { if (started) { D().flushOutbox(); U.render(); } });
    window.addEventListener('offline', () => { if (started) U.render(); });

    const V = '20261101y';
    window.UstozV2 = {
        css: ['ustoz', 'bosh', 'jadval', 'davomat', 'boshqa', 'yordamchi'].map(n => `/teacher/v2/${n}.css?v=${V}`),
        start() {
            MODE = D().isAssistantOnly() ? 'yordamchi' : 'ustoz';
            document.title = MODE === 'yordamchi' ? 'Domwork Team — Yordamchi ustoz' : 'Domwork Team — Ustoz';
            root = document.getElementById('app');
            root.className = MODE === 'yordamchi' ? 'ph u-y' : 'ph';
            const p = parse();
            R.tab = p.tab; R.stack = [];
            history.replaceState({ r: { tab: R.tab, stack: [] } }, '', hash());
            for (const s of p.stack) { R.stack = [...R.stack, s]; history.pushState({ r: { tab: R.tab, stack: R.stack } }, '', hash()); }
            started = true; window.UstozV2.active = true;
            U.render(true);
            U.onStart?.forEach(fn => { try { fn(); } catch (err) { console.error('[ustoz]', err); } });
        }
    };
    U.onStart = U.onStart || [];
})();
