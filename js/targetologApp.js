// Domwork Team — targetolog telefon ilovasi (2026-11). Dizayn: "Domwork Team — Sotuv ilovasi" kanvasi, "Targetolog" sahifasi (T00–T12).
// Faqat role=targetolog. Telefonda (≤900px) — to'liq ilova; kompyuterda — faqat qulf oynasi (kechagi raqamlar kiritilmaguncha).
// Ma'lumot: lidlar — CRM holatidan (server targetolog uchun telefon/izoh/sotuvchini olib tashlagan), reklama raqamlari — /api/target-ads.
// Targetolog faqat o'z kunlik raqamlarini kiritadi; boshqa hamma narsa faqat ko'rish uchun (server ham tekshiradi).
// Uslublar: css/targetologApp.css.
(function () {
    'use strict';
    const MQ = window.matchMedia('(max-width: 900px)');
    const DAY = 86400000;
    const g = name => (typeof window[name] === 'function' ? window[name] : null);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const user = () => (g('getCurrentUser') ? getCurrentUser() : null) || {};
    const isTg = () => user().role === 'targetolog';
    const int = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const usd = n => (n == null || !Number.isFinite(n)) ? '—' : '$' + n.toFixed(2).replace('.', ',');
    const pct = (a, b, d = 0) => (b > 0 ? (a / b * 100).toFixed(d).replace('.', ',') + '%' : '—');
    const pctN = (a, b) => (b > 0 ? a / b * 100 : null);
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const WD = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    const WD2 = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const LANG_NAME = { russian: 'Rus tili', english: 'Ingliz tili' };
    const PENDING = new Set(['yangi-lidlar', 'boglanishga-urinilmoqda']);
    const SOLD = new Set(['tolov-yopildi']); // "Toʻladi" — faqat toʻlovi yopilgan lid

    // ---------- sana ----------
    // Intl formatterlarni bir marta yaratamiz — har chaqiruvda yangisini qurish telefonda juda sekin.
    const F_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' });
    const F_HOUR = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', hour12: false });
    const F_HM = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false });
    function todayKey() { return F_DAY.format(new Date()); }
    const addDays = (k, n) => new Date(Date.parse(k + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
    const dObj = k => new Date(k + 'T00:00:00Z');
    const dayLong = k => { const d = dObj(k); return `${WD[d.getUTCDay()]}, ${d.getUTCDate()}-${MON[d.getUTCMonth()]}`; };
    const dayShort = k => { const d = dObj(k); return `${d.getUTCDate()}-${MON[d.getUTCMonth()].slice(0, 3)}`; };
    const monthName = m => `${cap(MON[Number(m.slice(5, 7)) - 1])} ${m.slice(0, 4)}`;
    const monthOnly = m => cap(MON[Number(m.slice(5, 7)) - 1]);
    const prevMonth = m => { const [y, mo] = m.split('-').map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`; };
    const nextMonth = m => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; };
    const daysIn = m => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();
    function dayOfRaw(raw) {
        if (raw === null || raw === undefined || raw === '') return null;
        const t = String(raw).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
        const dm = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
        if (dm) return `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
        const d = new Date(typeof raw === 'number' ? raw : t);
        return Number.isNaN(d.getTime()) ? null : F_DAY.format(d);
    }
    const leadDay = l => dayOfRaw(l.createdAt || l.date);
    const ts = v => { const t = Date.parse(v || ''); return Number.isFinite(t) ? t : null; };
    const hourOf = t => Number(F_HOUR.format(new Date(t))) % 24;

    // ---------- ikonkalar ----------
    const P = {
        home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
        report: '<path d="M5 20V11M12 20V4M19 20v-7M3 20h18"/>',
        stats: '<path d="M21 12a9 9 0 11-9-9v9z"/><path d="M15 3.3A9 9 0 0120.7 9H15z"/>',
        leads: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/>',
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
        bell: '<path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>',
        back: '<path d="M15 6l-6 6 6 6"/>', next: '<path d="M9 6l6 6-6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
        check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', plus: '<path d="M12 5v14M5 12h14"/>',
        pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
        lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
        lockb: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 018 0v4"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/>',
        cal: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 3v3M16 3v3"/>',
        eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
        note: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
        megaphone: '<path d="M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1z"/><path d="M15 9a3 3 0 010 6M18 6a7 7 0 010 12"/>',
        book: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5"/>',
        tg: '<path d="M21 4L3 11l6 2 2 6 3-4 5 4z"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
        logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
        target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
        play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>'
    };
    const ic = (n, s = 20, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
    let hexN = 0;
    const hex = (op = .12) => { const id = 'tgHx' + (++hexN); return `<svg class="tg-hex" aria-hidden="true" style="opacity:${op}"><defs><pattern id="${id}" width="48" height="41.6" patternUnits="userSpaceOnUse"><path d="M12 0h24l12 20.8-12 20.8H12L0 20.8z" fill="none" stroke="#FFFFFF" stroke-width="1.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#${id})"/></svg>`; };

    // ---------- holat ----------
    const S = {
        screen: 'home', stack: [], lang: null, langs: [], month: null, statTab: 'quality', leadTab: 'all', leadQ: '', leadLimit: 40,
        reportAll: false, lead: null, entryDate: null, entryErr: '', saving: false,
        status: null, ads: {}, loading: {}
    };
    let root = null, nav = null, pop = null, inited = false, timer = null;

    // ---------- ma'lumot ----------
    function allLeads() {
        const all = g('getItem') && typeof STORAGE_KEYS !== 'undefined' ? getItem(STORAGE_KEYS.leads, null) : null;
        return all || { english: [], russian: [] };
    }
    const isTarget = l => (g('getLeadKind') ? getLeadKind(l) === 'target' : l.leadType === 'target');
    const stOf = l => (g('normalizeLeadStatus') ? normalizeLeadStatus(l.status) : (l.status || 'yangi-lidlar'));
    const quality = l => { const s = stOf(l); return PENDING.has(s) ? 'pending' : s === 'sifatsiz-lidlar' ? 'bad' : 'good'; };
    const sold = l => SOLD.has(stOf(l));
    const trialBooked = l => !!(l.trialRequest || l.trialLessonAt || (l.trialHistory || []).length || stOf(l) === 'sinov-darsida'
        || (l.stageHistory || []).some(h => h.to === 'sinov-darsida'));
    const trialCame = l => !!(l.trialRequest?.attended || (l.trialHistory || []).some(t => t.attended));
    // Lidlar indeksi: CRM lidlar ro'yxati o'zgarmaguncha (har 30 soniyada yangilanadi) bir marta hisoblanadi.
    // Har ekran va har tugma bosilishida minglab lidni qayta saralash ilovani qotirardi.
    const IDX = {};
    function leadsOf(lang, month) {
        const arr = allLeads()[lang] || [];
        let c = IDX[lang];
        if (!c || c.arr !== arr || c.len !== arr.length) {
            const all = [];
            for (const l of arr) { if (!l || l.deletedAt || !isTarget(l)) continue; const day = leadDay(l); if (day) all.push({ l, day }); }
            c = IDX[lang] = { arr, len: arr.length, all, byMonth: new Map(), agg: new Map() };
        }
        if (!month) return c.all;
        let m = c.byMonth.get(month);
        if (!m) { m = c.all.filter(x => x.day.slice(0, 7) === month); c.byMonth.set(month, m); }
        return m;
    }
    function sumQ(list) {
        const o = { n: list.length, good: 0, bad: 0, pending: 0, sold: 0, trial: 0, came: 0 };
        for (const x of list) { const l = x.l || x; o[quality(l)]++; if (sold(l)) o.sold++; if (trialBooked(l)) o.trial++; if (trialCame(l)) o.came++; }
        o.decided = o.good + o.bad;
        return o;
    }
    async function loadAds(lang, month, force) {
        const key = lang + '|' + month;
        if (S.ads[key] && !force) return S.ads[key];
        if (S.loading[key]) return S.loading[key];
        S.loading[key] = apiFetch(`/api/target-ads?language=${encodeURIComponent(lang)}&month=${encodeURIComponent(month)}`, { fresh: !!force })
            .then(r => { S.ads[key] = r; return r; }).catch(e => { S.ads[key] = { error: e.message, days: {} }; return S.ads[key]; })
            .finally(() => { delete S.loading[key]; });
        return S.loading[key];
    }
    const adsNow = (lang = S.lang, month = S.month) => S.ads[lang + '|' + month] || null;
    async function loadStatus() {
        try { S.status = await apiFetch('/api/target-ads/status', { fresh: true }); }
        catch (e) {
            S.status = S.status || { locked: false, missing: [], error: e.message };
            // Holatni olib bo'lmadi (internet) — qulf tekshiruvi keyinroq qayta uriniladi.
            clearTimeout(loadStatus._t); loadStatus._t = setTimeout(() => refresh(), 15000);
        }
        if (S.status?.langs?.length) { S.langs = S.status.langs; if (!S.langs.includes(S.lang)) S.lang = S.langs[0]; }
        return S.status;
    }
    function monthAgg(lang, month) {
        const ads = adsNow(lang, month);
        leadsOf(lang, null);
        const memo = IDX[lang]?.agg, hit = memo?.get(month);
        if (hit && hit.ads === ads) return hit.v;
        const v = monthAggRaw(lang, month, ads);
        memo?.set(month, { ads, v });
        return v;
    }
    function monthAggRaw(lang, month, ads) {
        const days = ads?.days || {};
        const list = leadsOf(lang, month); const q = sumQ(list);
        const budget = Object.values(days).reduce((s, d) => s + (Number(d.budget) || 0), 0);
        const meta = Object.values(days).reduce((s, d) => s + (Number(d.leadCount) || 0), 0);
        return { ads, days, list, q, budget, meta, cpl: q.n ? budget / q.n : null, cpq: q.good ? budget / q.good : null, cps: q.sold ? budget / q.sold : null };
    }

    // ---------- umumiy bo'laklar ----------
    function langSeg() {
        if (S.langs.length < 2) return '';
        return `<div role="tablist" aria-label="Til" class="tg-seg" style="grid-template-columns:repeat(${S.langs.length},minmax(0,1fr))">${S.langs.map(l =>
            `<button type="button" role="tab" aria-selected="${l === S.lang}" data-tg-lang="${l}">${LANG_NAME[l]}</button>`).join('')}</div>`;
    }
    function monthBar() {
        const cur = todayKey().slice(0, 7);
        return `<div class="tg-month"><button type="button" aria-label="Oldingi oy" data-tg-month="-1">${ic('back', 18, 2.2)}</button><strong>${monthName(S.month)}</strong>
            <button type="button" aria-label="Keyingi oy" data-tg-month="1" ${S.month >= cur ? 'disabled' : ''}>${ic('next', 18, 2.2)}</button></div>`;
    }
    function ring(p, size, r, sw, label, dark) {
        const C = 2 * Math.PI * r, off = C * (1 - Math.max(0, Math.min(100, p || 0)) / 100);
        return `<div class="tg-ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Sifatli lidlar ${p == null ? 'nomaʼlum' : Math.round(p) + '%'}">
            <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${dark ? 'rgba(255,255,255,.14)' : '#E2E8F0'}" stroke-width="${sw}"/>
            <circle class="tg-ring-v" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#3B8BEE" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>
            <div><strong style="font-size:${size > 96 ? 26 : 22}px;font-weight:800">${p == null ? '—' : Math.round(p) + '%'}</strong><span style="font-size:12px;font-weight:700;color:${dark ? '#C7D2E3' : '#4B5563'}">${label}</span></div></div>`;
    }
    function bar(w, color, h) { return `<div class="tg-bar"${h ? ` style="height:${h}px"` : ''}><i style="width:${Math.max(0, Math.min(100, w || 0)).toFixed(1)}%;background:${color}"></i></div>`; }
    const sk = (h, n = 1) => Array.from({ length: n }, () => `<div class="tg-sk" style="height:${h}px"></div>`).join('');
    function toast(msg) {
        document.querySelectorAll('.tg-toast').forEach(t => t.remove());
        const t = document.createElement('div'); t.className = 'tg-toast tg-app-font'; t.setAttribute('role', 'status'); t.textContent = msg;
        t.style.fontFamily = "'DW Jakarta','Plus Jakarta Sans',system-ui,sans-serif";
        document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
    }
    const back = (title, extra = '') => `<div class="tg-back"><button type="button" aria-label="Orqaga" data-tg-back>${ic('back', 22, 2.2)}</button><h1>${title}</h1>${extra}</div>`;

    // ---------- T01 Bosh ----------
    function screenHome() {
        const u = user(), today = todayKey(), y = addDays(today, -1);
        const name = String(u.name || '').trim().split(/\s+/)[0] || '';
        const h = Number(F_HOUR.format(new Date())) % 24;
        const hello = h < 11 ? 'Xayrli tong' : h < 18 ? 'Xayrli kun' : 'Xayrli kech';
        const month = today.slice(0, 7) === y.slice(0, 7) ? today.slice(0, 7) : y.slice(0, 7);
        const a = monthAgg(S.lang, month);
        const unread = g('getUnreadCount') ? getUnreadCount() : 0;
        const top = `<header class="tg-top"><button type="button" class="tg-av" aria-label="Menyu" data-tg-go="menu" style="border:2px solid #FFF">${esc(initials(u.name))}</button>
            <div class="tg-top-t"><span>${dayLong(today)}</span><h1>${hello}${name ? ', ' + esc(name) : ''}</h1></div>
            <button type="button" class="tg-ibtn" aria-label="Bildirishnomalar${unread ? ', ' + unread + ' ta yangi' : ''}" data-tg-go="notif">${ic('bell')}${unread ? `<span class="tg-badge-dot">${unread > 9 ? '9+' : unread}</span>` : ''}</button></header>`;
        if (!a.ads) return top + `<div class="tg-scr tg-scr--top">${sk(48)}${sk(124)}${sk(200)}</div>`;
        const entered = !!a.ads.days?.[y] || !!adsNow(S.lang, y.slice(0, 7))?.days?.[y];
        const okbar = entered ? `<div class="tg-okbar tg-s1">${ic('check', 18, 2.4)}<span>${dayShort(y)} kiritildi · keyingisi ertaga</span></div>` : '';
        const qp = pctN(a.q.good, a.q.decided);
        // oxirgi 7 kun sifati
        const all = leadsOf(S.lang, null);
        const days = Array.from({ length: 7 }, (_, i) => addDays(y, i - 6));
        const bars = days.map(d => { const q = sumQ(all.filter(x => x.day === d)); return { d, p: pctN(q.good, q.decided), q }; });
        const last = bars[6];
        const prevM = monthAgg(S.lang, prevMonth(month));
        const mom = prevM.cpl != null && a.cpl != null ? Math.round((a.cpl - prevM.cpl) / prevM.cpl * 100) : null;
        const weekStartQ = sumQ(a.list.filter(x => Number(x.day.slice(8)) <= 7)), weekEndQ = sumQ(a.list.filter(x => Number(x.day.slice(8)) >= daysIn(month) - 9));
        const trend = pctN(weekStartQ.good, weekStartQ.decided) != null && pctN(weekEndQ.good, weekEndQ.decided) != null ? Math.round(pctN(weekEndQ.good, weekEndQ.decided) - pctN(weekStartQ.good, weekStartQ.decided)) : null;
        return top + `<div class="tg-scr tg-scr--top">${langSeg()}${okbar}
            <button type="button" class="tg-dark tg-s2" data-tg-go="stats" style="display:flex;align-items:center;gap:16px;border:0;text-align:left;width:100%">${hex(.06)}
              ${ring(qp, 88, 36, 10, 'sifatli', true)}
              <div style="flex:1;display:flex;flex-direction:column;gap:4px"><span class="tg-cap" style="color:#9DC4F5">${MON[Number(month.slice(5)) - 1].toUpperCase()} · LID SIFATI</span>
                <strong style="font-size:17px;font-weight:800">${int(a.q.good)} sifatli lid</strong><span style="font-size:13px;color:#C7D2E3">Sifatli lid narxi ${usd(a.cpq)}</span>
                ${trend != null ? `<span class="tg-chip tg-chip--mint">${trend >= 0 ? '↑' : '↓'} ${Math.abs(trend)} punkt oy ichida</span>` : ''}</div></button>
            <div class="tg-grid2 tg-s3">
              <div class="tg-tile"><span>Lid narxi · ${MON[Number(month.slice(5)) - 1]}</span><strong>${usd(a.cpl)}</strong>${mom != null ? `<span class="tg-chip ${mom <= 0 ? 'tg-chip--g' : 'tg-chip--r'}">${mom <= 0 ? '↓' : '↑'} ${Math.abs(mom)}% ${MON[Number(prevMonth(month).slice(5)) - 1]}dan</span>` : '<em>—</em>'}</div>
              <div class="tg-tile"><span>Oʻquvchi narxi</span><strong>${usd(a.cps)}</strong><em>${int(a.q.sold)} ta toʻlov · ${usd(a.budget)}</em></div>
              <div class="tg-tile"><span>Target lidlar · CRM</span><strong>${int(a.q.n)}</strong><em>${MON[Number(month.slice(5)) - 1]}, CRM boʻyicha</em></div>
              <button type="button" class="tg-tile" data-tg-leads="pending"><span>Aniqlanmoqda</span><strong>${int(a.q.pending)}</strong><em style="color:#0057B8">Yangi va Urinilmoqda →</em></button>
            </div>
            <button type="button" class="tg-card tg-s4" data-tg-go="stats" style="text-align:left;width:100%">
              <div class="tg-card-h"><h2>Oxirgi 7 kun · sifatli %</h2><span>aniqlanganlardan</span></div>
              <div class="tg-bars7" role="img" aria-label="Kunlik sifatli lid foizi: ${bars.map(b => dayShort(b.d) + ' ' + (b.p == null ? 'yoʻq' : Math.round(b.p))).join(', ')}">${bars.map((b, i) =>
                `<div><b>${b.p == null ? '—' : Math.round(b.p)}</b><div style="height:64px;display:flex;align-items:flex-end"><i class="${i === 6 ? 'on' : ''}" style="height:${b.p == null ? 2 : Math.max(3, Math.round(b.p * .72))}px"></i></div><small style="${i === 6 ? 'color:#0B1220;font-weight:800' : ''}">${Number(b.d.slice(8))}</small></div>`).join('')}</div>
              <span style="font-size:13px;color:#3A4456">${dayShort(y)}: ${last.q.decided ? `${int(last.q.decided)} tadan ${int(last.q.good)} tasi sifatli` : 'aniqlangan lid yoʻq'}${last.q.pending ? `, yana ${int(last.q.pending)} tasi aniqlanmoqda` : ''} · <strong style="color:#0057B8">Statistika →</strong></span></button>
        </div>`;
    }
    const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?';

    // ---------- T02 Kiritish ----------
    function screenEntry(desk) {
        const date = S.entryDate, month = date.slice(0, 7), ads = adsNow(S.lang, month);
        if (!ads) return (desk ? '' : back('Kunlik raqamlar')) + `<div class="tg-scr">${sk(56)}${sk(300)}</div>`;
        const e = ads.days?.[date] || {};
        const perm = ads.permissions || {};
        const canPrev = perm.editFrom && addDays(date, -1) >= perm.editFrom, canNext = perm.editTo && addDays(date, 1) <= perm.editTo;
        const crm = sumQ(leadsOf(S.lang, null).filter(x => x.day === date));
        const v = k => (S.draft?.[k] ?? (e[k] != null ? String(e[k]).replace('.', ',') : ''));
        const b = parseNum(v('budget')), im = parseNum(v('impressions')), cl = parseNum(v('clicks')), ml = parseNum(v('leadCount'));
        const missDiff = ml != null && ml > crm.n ? ml - crm.n : 0;
        const rel = date === addDays(todayKey(), -1) ? 'Kecha' : dayShort(date);
        const field = (k, label, mode, pre) => `<label class="tg-field"><span>${label}</span><span class="tg-inp${S.entryErrKey === k ? ' err' : ''}">${pre ? `<b>${pre}</b>` : ''}<input data-tg-in="${k}" inputmode="${mode}" autocomplete="off" value="${esc(v(k))}" aria-label="${label}"></span></label>`;
        return (desk ? `<div class="tg-back"><h1>Kunlik raqamlar</h1>${S.langs.length > 1 ? `<span class="tg-chip tg-chip--b">${LANG_NAME[S.lang]}</span>` : ''}</div>`
            : back('Kunlik raqamlar', S.langs.length > 1 ? `<span class="tg-chip tg-chip--b">${LANG_NAME[S.lang]}</span>` : ''))
            + `<div class="tg-scr" style="padding-bottom:${desk ? 24 : 110}px">
            <div class="tg-month"><button type="button" aria-label="Oldingi kun" data-tg-eday="-1" ${canPrev ? '' : 'disabled'}>${ic('back', 18, 2.2)}</button>
              <span class="tg-month-t"><strong style="font-size:15px">${dayLong(date)}</strong><span>${rel}${e.revision ? ' · kiritilgan' : ''}</span></span>
              <button type="button" aria-label="Keyingi kun" data-tg-eday="1" ${canNext ? '' : 'disabled'}>${ic('next', 18, 2.2)}</button></div>
            <section class="tg-card">
              <div class="tg-sec-h"><i style="background:#EAF3FF;color:#0057B8">${ic('pen', 16, 2.2)}</i><h2>Siz kiritasiz</h2><span>Ads Manager'dan</span></div>
              <div class="tg-grid2">${field('budget', 'Xarajat', 'decimal', '$')}${field('impressions', 'Koʻrishlar', 'numeric')}${field('clicks', 'Kliklar', 'numeric')}${field('leadCount', 'Lidlar (forma)', 'numeric')}</div>
              <div class="tg-calc"><span><strong>${b != null && crm.n ? usd(b / crm.n) : '—'}</strong><small>lid narxi (CRM)</small></span><span><strong>${im && cl != null ? pct(cl, im, 1) : '—'}</strong><small>CTR</small></span><span><strong>${b != null && cl ? usd(b / cl) : '—'}</strong><small>klik narxi</small></span></div>
              <span class="tg-note">Lid narxi = xarajat ÷ CRM'ga kelgan lid · hamma ekranda bir xil</span>
              <label class="tg-inp" style="height:46px;border:1px dashed #CBD5E1">${ic('note', 18, 2)}<input data-tg-in="note" placeholder="Izoh (ixtiyoriy): yangi kreativ, byudjet…" aria-label="Izoh" value="${esc(v('note'))}" style="font-size:14px;font-weight:500"></label>
            </section>
            <section class="tg-crm">
              <div class="tg-sec-h"><i style="background:#FFF;color:#3A4456">${ic('lock', 15, 2.2)}</i><h2>CRM hisoblaydi</h2><span>oʻzgarmaydi</span></div>
              <div class="tg-crm4"><span><strong>${crm.n}</strong><small>keldi</small></span><span><strong>${crm.good}</strong><small>sifatli</small></span><span><strong>${crm.bad}</strong><small>sifatsiz</small></span><span><strong>${crm.pending}</strong><small>aniqlan&shy;moqda</small></span></div>
              ${ml == null ? '' : missDiff ? `<div class="tg-match" style="background:#FEF0C7;color:#93370D">${ic('note', 18, 2.2)}<span>Meta ${ml} · CRM ${crm.n} — ${missDiff} ta lid CRM'ga kelmagan</span></div>`
                : `<div class="tg-match" style="background:#ECFDF3;color:#067647">${ic('check', 18, 2.4)}<span>Meta ${ml} = CRM ${crm.n} · hammasi yetib keldi</span></div>`}
            </section>
            ${S.entryErr ? `<p class="tg-err" role="alert">${esc(S.entryErr)}</p>` : ''}
            ${desk ? `<button type="button" class="tg-btn" data-tg-save ${S.saving ? 'disabled' : ''}>${S.saving ? 'Saqlanmoqda…' : 'Saqlash'}</button>` : ''}
        </div>${desk ? '' : `<div class="tg-foot"><button type="button" class="tg-btn" data-tg-save ${S.saving ? 'disabled' : ''}>${S.saving ? 'Saqlanmoqda…' : 'Saqlash'}</button></div>`}`;
    }
    function parseNum(s) { const t = String(s ?? '').replace(/\s/g, '').replace(',', '.'); if (t === '') return null; const n = Number(t); return Number.isFinite(n) ? n : NaN; }
    async function saveEntry() {
        if (S.saving) return;
        const date = S.entryDate, ads = adsNow(S.lang, date.slice(0, 7)), e = ads?.days?.[date] || {};
        const d = S.draft || {};
        const val = k => parseNum(d[k] ?? (e[k] != null ? String(e[k]) : ''));
        const budget = val('budget'), leadCount = val('leadCount'), impressions = val('impressions'), clicks = val('clicks');
        const bad = (k, msg) => { S.entryErr = msg; S.entryErrKey = k; render(); return false; };
        if (budget == null || Number.isNaN(budget) || budget < 0) return bad('budget', 'Xarajatni kiriting (nol boʻlsa 0 yozing)');
        if (impressions == null || !Number.isInteger(impressions) || impressions < 0) return bad('impressions', 'Koʻrishlar sonini butun son bilan kiriting');
        if (clicks == null || !Number.isInteger(clicks) || clicks < 0) return bad('clicks', 'Kliklar sonini butun son bilan kiriting');
        if (clicks > impressions) return bad('clicks', 'Kliklar koʻrishlardan koʻp boʻlishi mumkin emas');
        if (leadCount == null || !Number.isInteger(leadCount) || leadCount < 0) return bad('leadCount', 'Forma lidlari sonini butun son bilan kiriting');
        S.saving = true; S.entryErr = ''; S.entryErrKey = ''; render();
        try {
            await apiFetch('/api/target-ads', { method: 'PUT', body: JSON.stringify({ language: S.lang, kind: 'day', date, revision: e.revision || 0,
                data: { budget, leadCount, impressions, clicks, kvalLeadCount: e.kvalLeadCount == null ? null : Math.min(e.kvalLeadCount, leadCount), note: String(d.note ?? e.note ?? '').trim() } }) });
            await loadAds(S.lang, date.slice(0, 7), true);
            const wasLocked = !!S.status?.locked;
            await loadStatus();
            S.saving = false; S.draft = null;
            const nextMiss = S.status?.missing?.[0];
            if (nextMiss) { S.lang = nextMiss.language; S.entryDate = nextMiss.date; await loadAds(S.lang, S.entryDate.slice(0, 7)); toast(`${dayShort(date)} saqlandi · yana ${S.status.missing.length} kun qoldi`); render(); return; }
            showSaved(date, wasLocked);
        } catch (err) {
            S.saving = false;
            if (err.status === 409) await loadAds(S.lang, date.slice(0, 7), true);
            S.entryErr = err.message || 'Saqlab boʻlmadi'; render();
        }
    }

    // ---------- T03 Saqlandi ----------
    function showSaved(date, unlocked) {
        const month = date.slice(0, 7), a = monthAgg(S.lang, month), days = a.days;
        const crmBy = d => leadsOf(S.lang, null).filter(x => x.day === d);
        const cplOf = d => { const n = crmBy(d).length; return n && days[d] ? Number(days[d].budget) / n : null; };
        const mine = cplOf(date);
        const best = mine != null && Object.keys(days).every(d => d === date || cplOf(d) == null || cplOf(d) >= mine);
        const q = sumQ(crmBy(date));
        closePop();
        const conf = ['#0065D6', '#F79009', '#12B76A', '#0065D6', '#FDB022', '#12B76A'].map((c, i) => `<span style="left:${12 + i * 15}%;background:${c};animation-delay:${[0, .5, .2, .7, .35, .6][i]}s"></span>`).join('');
        openPop(`<div class="tg-pop-dim" data-tg-popclose></div><section class="tg-sheet" role="dialog" aria-modal="true" aria-labelledby="tgSvT"><div class="tg-conf" aria-hidden="true">${conf}</div>
            <div class="tg-sheet-ico tg-pop-ico" style="background:#ECFDF3;color:#067647;box-shadow:0 12px 30px rgba(18,183,106,.25)">${ic('check', 42, 2.6)}</div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center"><h2 id="tgSvT">${Number(date.slice(8))}-${MON[Number(date.slice(5, 7)) - 1]} kiritildi</h2>
              <span style="font-size:14px;color:#4B5563">${unlocked ? 'Ilova ochildi · raqamlar ROP va adminga koʻrinadi' : 'Raqamlar ROP va adminga koʻrinadi'}</span></div>
            <div class="tg-dark" style="width:100%;display:flex;align-items:center;gap:14px;border-radius:22px"><div style="display:flex;flex-direction:column;gap:2px;flex:1"><span class="tg-cap" style="color:#9DC4F5">LID NARXI</span><strong style="font-size:32px;font-weight:800;letter-spacing:-.03em">${usd(mine)}</strong></div>
              ${best ? `<span style="font-size:13px;font-weight:800;color:#0B1220;background:#FDE68A;border-radius:14px;padding:8px 10px;text-align:center;line-height:1.3">${cap(MON[Number(month.slice(5)) - 1])}ning<br>eng arzon kuni</span>` : ''}</div>
            <div class="tg-grid2" style="width:100%"><span class="tg-cmp" style="background:#F5F7FB"><span>Oy boʻyicha lid narxi</span><strong>${usd(a.cpl)}</strong></span>
              <span class="tg-cmp" style="background:#ECFDF3"><span style="color:#067647">Shu kun sifatli</span><strong style="color:#067647">${q.decided ? q.good + ' / ' + q.decided : '—'}</strong></span></div>
            <div style="width:100%;display:flex;gap:8px"><button type="button" class="tg-btn2" style="flex:1" data-tg-popgo="home">Bosh sahifa</button><button type="button" class="tg-btn" style="flex:1.3;height:52px;box-shadow:none" data-tg-popgo="report">Hisobotni ochish</button></div></section>`);
    }

    // ---------- T00 Qulf ----------
    function showLock() {
        const miss = S.status?.missing || [];
        if (!miss.length) return;
        const rows = miss.slice(0, 6).map(m => `<div><span style="width:36px;height:36px;border-radius:12px;background:#FEF0C7;color:#93370D;display:grid;place-items:center;flex:none">${ic('cal', 18, 2.2)}</span>
            <span style="flex:1;display:flex;flex-direction:column"><strong style="font-size:15px">${dayLong(m.date)}</strong><span style="font-size:13px;color:#4B5563">${LANG_NAME[m.language]} · 4 ta raqam · 1 daqiqa</span></span>
            <span class="tg-chip tg-chip--a" style="align-self:center">Kiritilmagan</span></div>`).join('');
        openPop(`<div class="tg-pop-dim"></div><section class="tg-sheet" role="dialog" aria-modal="true" aria-labelledby="tgLkT">
            <div class="tg-sheet-ico tg-shake" style="background:#EAF3FF;color:#0057B8">${ic('lockb', 40, 2.2)}</div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center"><h2 id="tgLkT">${miss.length > 1 ? `Avval ${miss.length} kunlik raqamlar` : 'Avval kechagi raqamlar'}</h2>
              <span style="font-size:15px;color:#3A4456;line-height:1.5">${miss.length > 1 ? 'Raqamlarni kiritsangiz' : 'Kechagi raqamlarni kiritsangiz'}, ilova darhol ochiladi. Shu tufayli ROP va admin har kuni toʻliq hisobot koʻradi.</span></div>
            <div class="tg-miss">${rows}${miss.length > 6 ? `<div><span style="font-size:13px;color:#4B5563">yana ${miss.length - 6} kun…</span></div>` : ''}</div>
            <button type="button" class="tg-btn tg-pulse" data-tg-lockgo style="height:56px">${ic('plus', 18, 2.4)}Raqamlarni kiritish</button>
            <span style="font-size:13px;color:#4B5563;text-align:center;line-height:1.45">Har kuni 09:00 da eslatamiz. Bir necha kun kiritilmagan boʻlsa, hammasi shu roʻyxatda chiqadi.</span>
            <button type="button" class="tg-link" data-tg-logout style="color:#4B5563;font-size:13px;min-height:36px">Akkauntdan chiqish</button></section>`, true);
    }
    async function startLockEntry() {
        const m = S.status?.missing?.[0]; if (!m) { closePop(); return; }
        S.lang = m.language; S.entryDate = m.date; S.draft = null; S.entryErr = '';
        await loadAds(S.lang, S.entryDate.slice(0, 7));
        if (MQ.matches) { closePop(); go('entry', true); }
        else renderDeskEntry();
    }
    function renderDeskEntry() {
        openPop(`<div class="tg-pop-dim"></div><div class="tg-app" style="position:absolute;inset:40px auto 40px 50%;transform:translateX(-50%);width:440px;max-width:calc(100% - 32px);border-radius:28px;box-shadow:0 30px 80px rgba(11,18,32,.35)">${screenEntry(true)}</div>`, true, 'tg-pop--entry');
    }

    // ---------- T04 Hisobot ----------
    function screenReport() {
        const a = monthAgg(S.lang, S.month);
        const head = `<div class="tg-scr"><h1 class="tg-h1">Hisobot</h1>${langSeg()}${monthBar()}`;
        if (!a.ads) return head + sk(130) + sk(380) + '</div>';
        const perm = a.ads.permissions || {};
        const all = leadsOf(S.lang, S.month);
        const last = S.month === todayKey().slice(0, 7) ? addDays(todayKey(), -1) : `${S.month}-${String(daysIn(S.month)).padStart(2, '0')}`;
        const keys = []; for (let d = last; d.slice(0, 7) === S.month; d = addDays(d, -1)) keys.push(d);
        const cpls = keys.map(d => { const n = all.filter(x => x.day === d).length, e = a.days[d]; return e && n ? Number(e.budget) / n : null; }).filter(v => v != null);
        const best = cpls.length ? Math.min(...cpls) : null;
        const shown = S.reportAll ? keys : keys.slice(0, 7);
        const row = d => {
            const e = a.days[d], list = all.filter(x => x.day === d), q = sumQ(list);
            const cpl = e && list.length ? Number(e.budget) / list.length : null;
            const editable = perm.canEditDays && (!perm.editFrom || d >= perm.editFrom) && d <= (perm.editTo || d);
            const wd = WD2[dObj(d).getUTCDay()];
            const miss = e && e.leadCount != null && e.leadCount > list.length;
            return `<button type="button" class="tg-tr" ${editable ? `data-tg-edit="${d}" aria-label="${dayShort(d)} raqamlarini tuzatish"` : 'disabled aria-disabled="true"'} style="${editable ? '' : 'cursor:default'}">
                <span style="display:flex;flex-direction:column"><strong>${Number(d.slice(8))} ${wd}</strong></span>
                <span>${e ? usd(Number(e.budget)) : '<em style="font-style:normal;color:#93370D;font-weight:800">—</em>'}</span>
                <span>${e && e.leadCount != null ? `${e.leadCount} → ${miss ? `<b style="color:#93370D">${list.length}</b>` : list.length}` : `— → ${list.length}`}</span>
                <span>${q.decided ? `${q.good}/${q.decided}` : '—'}</span>
                <strong class="r" style="${cpl != null && cpl === best ? 'color:#067647' : ''}">${usd(cpl)}</strong>
                ${editable ? ic('pen', 16, 2) : '<span></span>'}</button>`;
        };
        const editTo = perm.editTo ? dayShort(perm.editTo) : '';
        return head + `
            <section class="tg-blue tg-s1" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 10px">${hex()}
              <span style="display:flex;flex-direction:column"><span style="font-size:12px;font-weight:700;color:#DCEBFF">Xarajat</span><strong style="font-size:22px;font-weight:800">${usd(a.budget)}</strong></span>
              <span style="display:flex;flex-direction:column"><span style="font-size:12px;font-weight:700;color:#DCEBFF">Lidlar · CRM</span><strong style="font-size:22px;font-weight:800">${int(a.q.n)} <span style="font-size:13px;font-weight:600;color:#DCEBFF">/ Meta ${int(a.meta)}</span></strong></span>
              <span style="display:flex;flex-direction:column"><span style="font-size:12px;font-weight:700;color:#DCEBFF">Lid narxi</span><strong style="font-size:22px;font-weight:800">${usd(a.cpl)}</strong></span>
              <span style="display:flex;flex-direction:column"><span style="font-size:12px;font-weight:700;color:#DCEBFF">Oʻquvchi narxi</span><strong style="font-size:22px;font-weight:800">${usd(a.cps)}</strong></span></section>
            <section class="tg-tbl"><div class="tg-tr tg-tr--h"><span>Kun</span><span>Xarajat</span><span>Meta → CRM</span><span>Sifatli</span><span class="r">Narx</span><span></span></div>
              ${keys.length ? shown.map(row).join('') : '<div class="tg-empty">Bu oyda hali kun yoʻq</div>'}
              ${!S.reportAll && keys.length > 7 ? `<button type="button" class="tg-more" data-tg-reportall>Yana ${keys.length - 7} kunni koʻrsatish</button>` : ''}</section>
            <div style="display:flex;gap:10px;align-items:flex-start;background:#FFF;border:1px solid #E6EAF2;border-radius:16px;padding:12px"><span style="flex:none;color:#3A4456;margin-top:1px">${ic('lock', 18, 2)}</span>
              <span style="font-size:13px;color:#3A4456;line-height:1.45">${perm.canEditDays && editTo ? `Oʻz raqamlaringizni tuzatish mumkin: <strong style="color:#0B1220">${dayShort(perm.editFrom)} – ${editTo}</strong>. ` : ''}CRM ustuni oʻzgarmaydi. <span style="color:#93370D;font-weight:800">Toʻq sariq raqam</span> — Meta'da bor, CRM'ga tushmagan lid; <span style="color:#067647;font-weight:800">yashil narx</span> — oyning eng arzon kuni.</span></div>
        </div>`;
    }

    // ---------- Statistika (T09–T11, T05) ----------
    function statTabs() {
        const T = [['quality', 'Sifat'], ['audience', 'Auditoriya'], ['campaigns', 'Kampaniya'], ['funnel', 'Voronka']];
        return `<div role="tablist" aria-label="Statistika boʻlimlari" class="tg-seg" style="grid-template-columns:repeat(4,minmax(0,1fr))">${T.map(([id, l]) =>
            `<button type="button" role="tab" aria-selected="${S.statTab === id}" data-tg-stat="${id}">${l}</button>`).join('')}</div>`;
    }
    function screenStats() {
        const a = monthAgg(S.lang, S.month);
        const head = `<div class="tg-scr"><h1 class="tg-h1">Statistika</h1>${langSeg()}${monthBar()}${statTabs()}`;
        if (!a.ads) return head + sk(200) + sk(200) + '</div>';
        if (!a.q.n) return head + `<div class="tg-card tg-empty">${monthOnly(S.month)}da target lid yoʻq</div></div>`;
        const body = S.statTab === 'audience' ? statAudience(a) : S.statTab === 'campaigns' ? statCampaigns(a) : S.statTab === 'funnel' ? statFunnel(a) : statQuality(a);
        return head + body + '</div>';
    }
    function statQuality(a) {
        const { q } = a, list = a.list.map(x => x.l), qp = pctN(q.good, q.decided);
        const prev = monthAgg(S.lang, prevMonth(S.month)).q, pp = pctN(prev.good, prev.decided);
        const diff = qp != null && pp != null ? Math.round(qp - pp) : null;
        // haftalar
        const dim = daysIn(S.month), W = [[1, 7], [8, 14], [15, 21], [22, dim]];
        const weeks = W.map(([f, t]) => { const s = sumQ(a.list.filter(x => { const d = Number(x.day.slice(8)); return d >= f && d <= t; })); return { f, t, p: pctN(s.good, s.decided) }; });
        // sabablar
        const R = new Map(); list.filter(l => quality(l) === 'bad').forEach(l => { const k = l.sifatsizReason?.label || 'Sabab koʻrsatilmagan'; R.set(k, (R.get(k) || 0) + 1); });
        const reasons = [...R.entries()].sort((x, y) => y[1] - x[1]);
        const RC = ['#F04438', '#F79009', '#94A3B8', '#94A3B8', '#CBD5E1', '#CBD5E1'];
        // qo'ng'iroq tezligi (umumiy, ismlarsiz)
        const firstCall = l => { const t0 = ts(l.createdAt); const c = (l.comments || []).map(c => ts(c.createdAt)).filter(t => t && t0 && t >= t0).sort((x, y) => x - y)[0]; return t0 && c ? (c - t0) / 60000 : null; };
        const G = [['5 daq gacha', m => m <= 5], ['5–30 daq', m => m > 5 && m <= 30], ['30 daq dan koʻp', m => m > 30]].map(([label, f]) => {
            const s = list.filter(l => quality(l) !== 'pending').filter(l => { const m = firstCall(l); return m != null && f(m); });
            const qq = sumQ(s); return { label, n: qq.decided, p: pctN(qq.good, qq.decided) };
        });
        const mins = list.map(firstCall).filter(m => m != null).sort((x, y) => x - y);
        const median = mins.length ? Math.round(mins[Math.floor(mins.length / 2)]) : null;
        // soatlar
        const H = [['06–12', h => h >= 6 && h < 12], ['12–18', h => h >= 12 && h < 18], ['18–24', h => h >= 18], ['00–06', h => h < 6]].map(([label, f]) => {
            const s = list.filter(l => ts(l.createdAt) && f(hourOf(ts(l.createdAt)))); const qq = sumQ(s); return { label, n: s.length, p: pctN(qq.good, qq.decided) };
        });
        const dup = list.filter(l => l.dupPhone).length;
        const decideDays = list.map(l => { const t0 = ts(l.createdAt); const h = (l.stageHistory || []).find(h => h.to && !PENDING.has(h.to)); const t1 = h && ts(h.at); return t0 && t1 ? (t1 - t0) / DAY : null; }).filter(v => v != null);
        const avgDecide = decideDays.length ? decideDays.reduce((s, v) => s + v, 0) / decideDays.length : null;
        return `<section class="tg-dark" style="display:flex;flex-direction:column;gap:14px">${hex(.06)}
              <div style="display:flex;align-items:center;gap:16px">${ring(qp, 104, 42, 11, 'sifatli', true)}
                <div style="flex:1;display:flex;flex-direction:column;gap:6px"><span class="tg-cap" style="color:#9DC4F5">LID SIFATI</span>
                  <strong style="font-size:20px;font-weight:800">${int(q.good)} <span style="font-size:14px;color:#C7D2E3;font-weight:600">/ ${int(q.decided)} aniqlangan</span></strong>
                  ${q.pending ? `<span style="font-size:12px;color:#C7D2E3;font-weight:600">+${int(q.pending)} aniqlanmoqda (Yangi, Urinilmoqda)</span>` : ''}
                  ${diff != null ? `<span class="tg-chip tg-chip--mint">${diff >= 0 ? '↑' : '↓'} ${Math.abs(diff)} punkt ${MON[Number(prevMonth(S.month).slice(5)) - 1]}dan</span>` : ''}</div></div>
              <div class="tg-grid2"><span style="background:rgba(255,255,255,.08);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column"><span style="font-size:12px;font-weight:700;color:#C7D2E3">Sifatli lid narxi</span><strong style="font-size:19px;font-weight:800">${usd(a.cpq)}</strong></span>
                <span style="background:rgba(255,255,255,.08);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column"><span style="font-size:12px;font-weight:700;color:#C7D2E3">Lid narxi</span><strong style="font-size:19px;font-weight:800">${usd(a.cpl)}</strong></span></div></section>
            <section class="tg-card"><div class="tg-card-h"><h2>Haftalar boʻyicha sifat</h2><span>sifatli %</span></div>
              <div class="tg-weeks" style="grid-template-columns:repeat(4,minmax(0,1fr))" role="img" aria-label="Haftalar: ${weeks.map(w => `${w.f}–${w.t}: ${w.p == null ? 'yoʻq' : Math.round(w.p) + '%'}`).join(', ')}">${weeks.map((w, i) =>
                `<div><strong style="font-size:13px;${i === 3 ? 'color:#0057B8' : ''}">${w.p == null ? '—' : Math.round(w.p) + '%'}</strong><i style="height:${w.p == null ? 2 : Math.max(4, Math.round(w.p * 1.05))}px;background:${['#B9D6FA', '#8BBCF5', '#3B8BEE', '#0065D6'][i]}"></i><span style="font-size:12px;font-weight:700;color:#4B5563">${w.f}–${w.t}</span></div>`).join('')}</div></section>
            <section class="tg-card"><div class="tg-card-h"><h2>Nega sifatsiz?</h2><span>${int(q.bad)} ta lid</span></div>
              ${reasons.length ? reasons.slice(0, 6).map(([k, n], i) => `<div class="tg-brow"><div><span style="font-weight:700">${esc(k)}</span><span><strong>${n}</strong> <small>· ${pct(n, q.bad)}</small></span></div>${bar(n / q.bad * 100, RC[i] || '#CBD5E1', 9)}</div>`).join('') : '<div class="tg-empty">Sifatsiz lid yoʻq</div>'}
              ${q.bad ? `<button type="button" class="tg-link" data-tg-leads="bad">Sifatsiz lidlarni koʻrish →</button>` : ''}</section>
            <section class="tg-card"><div style="display:flex;flex-direction:column;gap:2px"><h2>Qoʻngʻiroq tezligi va sifat</h2><span style="font-size:13px;color:#4B5563">Lid kelgandan birinchi qoʻngʻiroqqacha${median != null ? ` · mediana ${median} daq` : ''} · ismlarsiz</span></div>
              ${G.map((r, i) => `<div class="tg-speed"><span>${r.label}</span>${bar(r.p, ['#12B76A', '#3B8BEE', '#F79009'][i], 22)}<strong style="text-align:right;${i === 2 ? 'color:#93370D' : ''}">${r.p == null ? '—' : Math.round(r.p) + '%'}</strong></div>`).join('')}
              <span style="font-size:12px;color:#4B5563;line-height:1.45">Guruhlarda ${G.map(r => r.n).join(' · ')} aniqlangan lid.${G[0].p != null && G[2].p != null && G[2].p < G[0].p - 5 ? ' Kech qoʻngʻiroq qilingan lidlar sifatsizga koʻproq tushadi.' : ''}</span></section>
            <section class="tg-card"><div class="tg-card-h"><h2>Lid kelgan vaqt</h2><span>sifatli %</span></div>
              <div class="tg-hours">${H.map(h => `<span class="${h.p != null && qp != null && h.p < qp - 15 ? 'low' : ''}"><strong style="${h.p != null && qp != null && h.p < qp - 15 ? 'color:#93370D' : ''}">${h.p == null ? '—' : Math.round(h.p) + '%'}</strong><b>${h.label}</b><small>${h.n} lid</small></span>`).join('')}</div></section>
            <section class="tg-grid2">
              <span class="tg-tile"><strong style="font-size:20px">${dup}</strong><span style="line-height:1.3">takroriy lid (raqam bor edi)</span></span>
              <span class="tg-tile"><strong style="font-size:20px">${avgDecide == null ? '—' : (avgDecide < 1 ? Math.max(1, Math.round(avgDecide * 24)) + ' soat' : avgDecide.toFixed(1).replace('.', ',').replace(',0', '') + ' kun')}</strong><span style="line-height:1.3">oʻrtacha sifat aniqlanishi</span></span></section>`;
    }
    function statAudience(a) {
        const list = a.list.map(x => x.l).filter(l => l.connectedSurvey);
        if (!list.length) return `<div class="tg-card tg-empty">Bu oyda anketasi toʻldirilgan lid hali yoʻq</div>`;
        const payers = list.filter(sold).length;
        const groupBy = (keyFn) => { const m = new Map(); list.forEach(l => { const k = keyFn(l); if (!k) return; const o = m.get(k) || { n: 0, s: 0 }; o.n++; if (sold(l)) o.s++; m.set(k, o); }); return [...m.entries()].map(([k, o]) => ({ k, n: o.n, s: o.s, share: o.n / list.length * 100, pay: o.n ? o.s / o.n * 100 : 0 })); };
        const cs = l => l.connectedSurvey || {};
        const ageB = l => { const v = Number(cs(l).age); if (!Number.isFinite(v)) return ''; return v < 18 ? '18 gacha' : v <= 24 ? '18–24' : v <= 34 ? '25–34' : v <= 44 ? '35–44' : '45+'; };
        const ages = groupBy(ageB).sort((x, y) => ['18 gacha', '18–24', '25–34', '35–44', '45+'].indexOf(x.k) - ['18 gacha', '18–24', '25–34', '35–44', '45+'].indexOf(y.k));
        const goals = groupBy(l => cs(l).learningGoalLabel || cs(l).learningGoal).sort((x, y) => y.n - x.n);
        const who = groupBy(l => cs(l).applicantLabel || cs(l).applicant).sort((x, y) => y.n - x.n);
        const lvl = groupBy(l => cs(l).languageLevelLabel || cs(l).languageLevel).sort((x, y) => y.n - x.n);
        const gen = groupBy(l => cs(l).genderLabel || cs(l).gender).sort((x, y) => y.n - x.n);
        const reg = groupBy(l => cs(l).residenceType === 'foreign' ? (cs(l).countryLabel || cs(l).country || 'Xorij') : (cs(l).regionLabel || cs(l).region)).sort((x, y) => y.n - x.n);
        const top = arr => arr.filter(x => x.n >= 3).sort((x, y) => y.pay - x.pay)[0] || null;
        const tops = [top(ages), top(who), top(goals), top(reg)].filter(Boolean);
        const pf = v => (Math.round(v * 10) / 10).toString().replace('.', ',') + '%';
        const short = s => String(s).replace(/ viloyati$/, '').replace(/ qoldirgan$/, '');
        const block = (title, arr) => `<section class="tg-card"><div class="tg-seg3" style="min-height:0"><h2 style="grid-column:1/3;margin:0;font-size:16px;font-weight:800">${title}</h2><span class="r" style="font-size:12px;color:#4B5563;font-weight:700">ulush</span><span class="r" style="font-size:12px;color:#4B5563;font-weight:700">toʻlov %</span></div>
            ${arr.slice(0, 5).map(x => { const best = tops.some(t => t === x); return `<div class="tg-seg3"><span style="${best ? 'font-weight:800' : ''}" title="${esc(x.k)}">${esc(short(x.k))}</span>${bar(x.share, best ? '#0065D6' : '#8BBCF5', 10)}<span class="r">${pf(x.share)}</span><strong class="r" style="${best ? 'color:#067647' : x.pay === 0 ? 'color:#93370D' : ''}">${pf(x.pay)}</strong></div>`; }).join('')}</section>`;
        const stack = (title, arr) => `<div class="tg-tile" style="gap:8px"><span style="font-size:14px;font-weight:800;color:#0B1220">${title}</span>
            <div class="tg-stack" aria-hidden="true">${arr.slice(0, 3).map((x, i) => `<span style="width:${x.share}%;background:${['#0065D6', '#8BBCF5', '#CBD5E1'][i]}"></span>`).join('')}</div>
            <span style="font-size:13px;line-height:1.5">${arr.slice(0, 3).map(x => `<strong>${Math.round(x.share)}%</strong> ${esc(short(x.k).toLowerCase())} · ${pf(x.pay)}`).join('<br>')}</span></div>`;
        return `<section class="tg-blue" style="display:flex;flex-direction:column;gap:10px">${hex()}
              <span class="tg-cap" style="color:#DCEBFF">KOʻP TOʻLAYDIGAN MIJOZ</span><span style="font-size:13px;color:#FFF">Yosh, kim uchun, maqsad va viloyat boʻyicha toʻlov % eng yuqori segment</span>
              <div style="display:flex;flex-wrap:wrap;gap:6px">${tops.length ? tops.map(t => `<span style="font-size:14px;font-weight:800;background:rgba(11,18,32,.32);border-radius:999px;padding:6px 12px">${esc(short(t.k))} · ${pf(t.pay)}</span>`).join('') : '<span style="font-size:14px">Segmentlar uchun maʼlumot hali kam</span>'}</div>
              <span style="font-size:13px;color:#DCEBFF">Anketa: bogʻlanilgan ${int(list.length)} lid · ${int(payers)} toʻlovchi</span></section>
            ${block('Yoshi', ages)}${block('Maqsadi', goals)}
            <section class="tg-grid2">${stack('Kim uchun', who)}${stack('Til darajasi', lvl)}
              <div class="tg-tile" style="grid-column:1/-1;flex-direction:row;align-items:center;gap:12px"><span style="font-size:14px;font-weight:800;color:#0B1220;flex:none">Jinsi</span>
                <div class="tg-stack" aria-hidden="true" style="flex:1">${gen.slice(0, 2).map((x, i) => `<span style="width:${x.share}%;background:${['#0065D6', '#8BBCF5'][i]}"></span>`).join('')}</div>
                <span style="font-size:13px;flex:none">${gen.slice(0, 2).map(x => `<strong>${Math.round(x.share)}%</strong> ${esc(String(x.k).toLowerCase())}`).join(' · ')}</span></div></section>
            <section class="tg-rows"><div class="tg-card-h" style="padding:8px 0 4px"><h2 style="margin:0;font-size:16px;font-weight:800">Viloyatlar</h2><span style="font-size:12px;color:#4B5563;font-weight:700">ulush · toʻlov %</span></div>
              ${reg.slice(0, 6).map(x => `<div class="tg-rowi"><span style="flex:1;font-weight:700">${esc(short(x.k))}</span><span style="width:50px;text-align:right">${Math.round(x.share)}%</span><strong style="width:54px;text-align:right">${pf(x.pay)}</strong></div>`).join('')}</section>
            <span class="tg-note">Toʻlov % — shu guruhdagi lidlardan nechtasi toʻlagani. Anketa faqat bogʻlanilgan lidlardan olinadi, shuning uchun segmentlar lid sifati emas, toʻlov boʻyicha solishtiriladi; lid sifati — Sifat va Kampaniya tablarida.</span>`;
    }
    const campOf = l => l.metaCampaignName || l.utmCampaign || 'Kampaniya nomaʼlum';
    const adOf = l => l.metaAdName || l.utmContent || '';
    function statCampaigns(a) {
        const group = fn => { const m = new Map(); a.list.forEach(x => { const k = fn(x.l); if (!k) return; const arr = m.get(k) || []; arr.push(x); m.set(k, arr); }); return [...m.entries()].map(([k, arr]) => ({ k, q: sumQ(arr), camp: campOf(arr[0].l) })); };
        const camps = group(campOf).map(c => ({ ...c, p: pctN(c.q.good, c.q.decided) })).sort((x, y) => (y.p ?? -1) - (x.p ?? -1));
        const ads = group(adOf).map(c => ({ ...c, p: pctN(c.q.good, c.q.decided) })).sort((x, y) => (y.p ?? -1) - (x.p ?? -1));
        const avg = pctN(a.q.good, a.q.decided);
        const cards = camps.map((c, i) => {
            const low = c.p != null && avg != null && c.p < avg - 15 && c.q.decided >= 5;
            const best = i === 0 && c.p != null && camps.length > 1;
            return `<article class="tg-camp${low ? ' tg-camp--low' : ''}"><div style="display:flex;align-items:center;gap:8px"><strong style="flex:1;font-size:15px">${esc(c.k)}</strong>${best ? '<span class="tg-chip tg-chip--g">Eng sifatli</span>' : low ? '<span class="tg-chip tg-chip--a">Past sifat</span>' : ''}</div>
                <div style="display:flex;align-items:center;gap:10px"><div style="flex:1">${bar(c.p, low ? '#F79009' : best ? '#12B76A' : '#3B8BEE')}</div><strong style="font-size:15px;width:44px;text-align:right;${low ? 'color:#93370D' : ''}">${c.p == null ? '—' : Math.round(c.p) + '%'}</strong></div>
                <div class="tg-c3"><span>Lid <strong>${c.q.n}</strong></span><span>Sinovga <strong>${c.q.trial}</strong></span><span>Toʻlov <strong style="${c.q.sold ? 'color:#067647' : ''}">${c.q.sold}</strong></span></div></article>`;
        }).join('');
        const AD_BG = ['#0065D6', '#D1E6FD', '#0B1220', '#FEF0C7'], AD_FG = ['#FFF', '#0057B8', '#FFF', '#93370D'];
        const shownAds = ads.slice(0, 5);
        const rest = ads.slice(5), restN = rest.reduce((s, x) => s + x.q.n, 0);
        const noName = a.list.filter(x => !adOf(x.l)).length;
        return `<div class="tg-card-h" style="padding:4px 4px 0"><h2 style="margin:0;font-size:17px;font-weight:800">Kampaniyalar</h2><span style="font-size:12px;color:#4B5563;font-weight:600">sifatli % boʻyicha</span></div>${cards}
            <div class="tg-card-h" style="padding:8px 4px 0"><h2 style="margin:0;font-size:17px;font-weight:800">Kreativlar</h2><span style="font-size:12px;color:#4B5563;font-weight:600">sifatli % · lid · toʻlov</span></div>
            <section class="tg-rows" style="padding:4px 14px">${shownAds.length ? shownAds.map((c, i) => `<div class="tg-kr"><i style="background:${AD_BG[i % 4]};color:${AD_FG[i % 4]}">${ic('play', 22)}</i>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><strong style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.k)}</strong><span style="font-size:12px;color:#4B5563">${esc(c.camp)}</span></div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px"><strong style="font-size:15px">${c.p == null ? '—' : Math.round(c.p) + '%'}</strong><span style="font-size:12px;color:#4B5563;font-weight:600">${c.q.n} · ${c.q.sold} toʻlov</span></div></div>`).join('')
                : '<div class="tg-empty">Kreativ nomlari hali kelmagan</div>'}
              ${rest.length ? `<div class="tg-kr" style="min-height:52px;color:#4B5563;font-size:14px;font-weight:700">Yana ${rest.length} ta kreativ · ${restN} lid</div>` : ''}</section>
            <span class="tg-note">Kampaniya va kreativ nomi lid bilan birga Meta'dan avtomatik keladi${noName ? ` · ${noName} ta lidda nomi yoʻq (eski yoki saytdan kelgan)` : ''}</span>`;
    }
    function statFunnel(a) {
        const { q } = a, list = a.list.map(x => x.l);
        const conn = list.filter(l => !PENDING.has(stOf(l)) && (stOf(l) !== 'sifatsiz-lidlar' || (l.stageHistory || []).some(h => h.to === 'boglanildi'))).length;
        const rows = [['Yangi lid', q.n, null, '#0065D6'], ['Bogʻlanildi', conn, q.n, '#0065D6'], ['Sifatli', q.good, conn, '#0065D6'], ['Sinovga yozildi', q.trial, q.good, '#3B8BEE'], ['Sinovga keldi', q.came, q.trial, '#3B8BEE'], ['Toʻladi', q.sold, q.came, '#12B76A']];
        const sub = ['', 'yangi liddan', 'bogʻlanilganlardan', 'sifatlidan', 'yozilganlardan', 'sinovga kelganlardan'];
        const pm = monthAgg(S.lang, prevMonth(S.month)).q, pmn = MON[Number(prevMonth(S.month).slice(5)) - 1];
        const cmp = (label, a1, b1, fmt, unit) => { const d = a1 != null && b1 != null ? a1 - b1 : null; return `<span class="tg-cmp"><span>${label}</span><strong>${fmt(b1)} → ${fmt(a1)}</strong><em style="color:${d == null ? '#4B5563' : d >= 0 ? '#067647' : '#B42318'}">${d == null ? '—' : (d >= 0 ? '+' : '−') + unit(Math.abs(d))}</em></span>`; };
        const pf = v => v == null ? '—' : (Math.round(v * 10) / 10).toString().replace('.', ',') + '%';
        return `<section class="tg-card"><div class="tg-card-h"><h2>Bosqichlar</h2><span>ulush · oldingi bosqichdan</span></div>
              ${rows.map(([l, n, base, c], i) => `<div class="tg-brow"><div><span style="font-weight:${i === 5 ? 800 : 700};${i === 5 ? 'color:#067647' : ''}">${l}</span><span><strong style="${i === 5 ? 'color:#067647' : ''}">${int(n)}</strong> <small>· ${i === 0 ? '100%' : i === 2 ? pct(q.good, q.decided) + ' aniqlangandan' : pct(n, q.n, n / q.n < .1 ? 1 : 0)}</small></span></div>${bar(i === 2 ? pctN(q.good, q.decided) : n / q.n * 100, c)}${i ? `<small>↳ ${sub[i]} ${pct(n, base)}</small>` : ''}</div>`).join('')}</section>
            <section class="tg-card"><h2>${cap(pmn)} bilan solishtirish</h2><div class="tg-grid2">
              ${cmp('Lidlar', q.n, pm.n || null, v => v == null ? '—' : int(v), v => int(v) + ' ta')}
              ${cmp('Sifatli lid', pctN(q.good, q.decided), pctN(pm.good, pm.decided), pf, v => (Math.round(v * 10) / 10).toString().replace('.', ',') + ' punkt')}
              ${cmp('Toʻlov', q.sold, pm.n ? pm.sold : null, v => v == null ? '—' : int(v), v => int(v) + ' ta')}
              ${cmp('Liddan toʻlovga', pctN(q.sold, q.n), pctN(pm.sold, pm.n), pf, v => (Math.round(v * 10) / 10).toString().replace('.', ',') + ' punkt')}</div></section>
            <span class="tg-note">Hisob lid kelgan oy boʻyicha: ${monthOnly(prevMonth(S.month)).toLowerCase()} lidi ${monthOnly(S.month).toLowerCase()}da toʻlasa ham ${monthOnly(prevMonth(S.month)).toLowerCase()}da sanaladi</span>`;
    }

    // ---------- T06 Lidlar ----------
    function screenLeads() {
        // Saralangan ro'yxat indeksda saqlanadi (har harf yozilganda qayta saralanmaydi).
        const c = IDX[S.lang] || (leadsOf(S.lang, null), IDX[S.lang]);
        const all = c.sorted || (c.sorted = leadsOf(S.lang, null).map(x => ({ ...x, t: ts(x.l.createdAt) || 0 })).sort((x, y) => y.t - x.t));
        const q = S.leadQ.trim().toLowerCase();
        const f = all.filter(x => (S.leadTab === 'all' || quality(x.l) === S.leadTab)
            && (!q || [x.l.name, campOf(x.l), adOf(x.l)].some(s => String(s || '').toLowerCase().includes(q))));
        const cnt = k => all.filter(x => quality(x.l) === k).length;
        const T = [['all', 'Hammasi', all.length], ['good', 'Sifatli', cnt('good')], ['bad', 'Sifatsiz', cnt('bad')], ['pending', 'Aniqlanmoqda', cnt('pending')]];
        const today = todayKey();
        const rel = d => d === today ? 'Bugun' : d === addDays(today, -1) ? 'Kecha' : dayShort(d);
        const card = x => {
            const l = x.l, k = quality(l), s = stOf(l), cs = l.connectedSurvey || {};
            const badge = k === 'pending' ? ['Aniqlanmoqda', 'b'] : k === 'bad' ? ['Sifatsiz', 'r'] : [sold(l) ? 'Sifatli · toʻladi' : s === 'sinov-darsida' || trialBooked(l) && !trialCame(l) ? 'Sifatli · sinovda' : s === 'qaror-jarayonida' ? 'Sifatli · qaror jarayonida' : 'Sifatli', 'g'];
            const age = Number(cs.age);
            const meta = k === 'bad' ? `${rel(x.day)} · ${esc(l.sifatsizReason?.label || 'Sabab koʻrsatilmagan')}${l.dupPhone ? ' · takroriy' : ''}`
                : k === 'pending' ? `${rel(x.day)} · ${s === 'boglanishga-urinilmoqda' ? 'Urinilmoqda' : 'Yangi'}${(l.comments || []).length ? ' · ' + l.comments.length + ' urinish' : ''}`
                : [rel(x.day), Number.isFinite(age) && age ? age + ' yosh' : '', cs.learningGoalLabel || '', String(cs.regionLabel || cs.countryLabel || '').replace(/ viloyati$/, '')].filter(Boolean).map(esc).join(' · ');
            return `<button type="button" class="tg-lead" data-tg-lead="${esc(l.id)}"><div><strong>${esc(l.name || 'Ismsiz')}</strong><span class="tg-chip tg-chip--${badge[1]}">${badge[0]}</span></div>
                <span class="l2">${esc(campOf(l))}${adOf(l) ? ' · ' + esc(adOf(l)) : ''}</span><span class="l3${k === 'bad' ? ' bad' : ''}">${meta}</span></button>`;
        };
        return `<div class="tg-scr"><div class="tg-hrow"><h1 class="tg-h1" style="padding:0">Lidlar</h1><span class="tg-ro">${ic('eye', 14, 2.2)}Faqat koʻrish</span></div>${langSeg()}
            <div style="display:flex;gap:8px"><label class="tg-search">${ic('search', 18, 2.2)}<input data-tg-q placeholder="Ism, kampaniya, kreativ" aria-label="Qidirish" value="${esc(S.leadQ)}"></label></div>
            <div role="tablist" aria-label="Sifat boʻyicha" class="tg-seg" style="grid-template-columns:1fr 1fr 1fr 1.3fr">${T.map(([id, l, n]) => `<button type="button" role="tab" aria-selected="${S.leadTab === id}" data-tg-ltab="${id}" aria-label="${l}, ${n} ta">${l}</button>`).join('')}</div>
            <section style="display:flex;flex-direction:column;gap:8px">${f.length ? f.slice(0, S.leadLimit).map(card).join('') : `<div class="tg-card tg-empty">${q ? 'Hech narsa topilmadi' : 'Bu boʻlimda lid yoʻq'}</div>`}
              ${f.length > S.leadLimit ? `<button type="button" class="tg-btn2" data-tg-lmore>Yana ${Math.min(40, f.length - S.leadLimit)} ta koʻrsatish</button>` : ''}</section>
            <span class="tg-note">Telefon raqamlar targetologga koʻrsatilmaydi</span></div>`;
    }

    // ---------- T12 Lid kartasi ----------
    function screenLead() {
        const x = leadsOf(S.lang, null).find(x => String(x.l.id) === String(S.lead)) || Object.values(allLeads()).flat().map(l => ({ l, day: leadDay(l) })).find(x => String(x.l.id) === String(S.lead));
        if (!x) return back('Lid kartasi') + '<div class="tg-scr"><div class="tg-card tg-empty">Lid topilmadi</div></div>';
        const l = x.l, k = quality(l), cs = l.connectedSurvey || {}, s = stOf(l);
        const when = v => { const t = ts(v); if (!t) return ''; const d = new Date(t); const dk = dayOfRaw(v); return `${dk ? dayShort(dk) : ''}, ${F_HM.format(d)}`; };
        const STAGE = { 'yangi-lidlar': 'Lid keldi', 'boglanishga-urinilmoqda': 'Bogʻlanishga urinilmoqda', boglanildi: 'Bogʻlanildi · sifatli', 'qaror-jarayonida': 'Qaror jarayonida', 'sinov-darsida': 'Sinov darsiga yozildi', 'keyin-sotib-olmoqchi': 'Keyinroq oladi', 'tolov-jarayonida': 'Toʻlov jarayonida', 'tolov-yopildi': 'Toʻladi — oʻquvchi boʻldi', 'muvaffaqiyatsiz-sotuv': 'Sotuv boʻlmadi', 'sifatsiz-lidlar': 'Sifatsiz' };
        const hist = (l.stageHistory || []).filter(h => h.to && STAGE[h.to]);
        const items = hist.length ? hist.map(h => ({ t: STAGE[h.to], at: h.at, cls: h.to === 'tolov-yopildi' ? 'ok' : h.to === 'sifatsiz-lidlar' ? 'bad' : '' }))
            : [{ t: 'Lid keldi', at: l.createdAt, cls: '' }];
        if (trialCame(l) && !items.some(i => i.t === 'Sinov darsiga keldi')) { const tr = l.trialRequest?.attended ? l.trialRequest : (l.trialHistory || []).find(t => t.attended); items.splice(items.findIndex(i => i.cls === 'ok') >= 0 ? items.findIndex(i => i.cls === 'ok') : items.length, 0, { t: 'Sinov darsiga keldi', at: tr?.scheduledAt, cls: '' }); }
        if (k === 'bad' && l.sifatsizReason?.label) { const last = items[items.length - 1]; if (last.cls === 'bad') last.t = 'Sifatsiz · ' + l.sifatsizReason.label; }
        const paidDays = sold(l) ? (() => { const h = hist.find(h => SOLD.has(h.to)); const a = ts(l.createdAt), b = h && ts(h.at); return a && b ? Math.max(0, Math.round((b - a) / DAY)) : null; })() : null;
        const badge = k === 'pending' ? '<span class="tg-chip tg-chip--b">Aniqlanmoqda</span>' : k === 'bad' ? '<span class="tg-chip tg-chip--r">Sifatsiz</span>' : '<span class="tg-chip tg-chip--g">Sifatli</span>';
        const an = [['Yoshi', cs.age], ['Jinsi', cs.genderLabel || cs.gender], ['Kim uchun', String(cs.applicantLabel || cs.applicant || '').replace(/ qoldirgan$/, '')], ['Daraja', cs.languageLevelLabel || cs.languageLevel], ['Maqsadi', cs.learningGoalLabel || cs.learningGoal], ['Viloyat', String(cs.regionLabel || cs.countryLabel || cs.region || cs.country || '').replace(/ viloyati$/, '')]];
        return back('Lid kartasi', `<span class="tg-ro">${ic('eye', 14, 2.2)}Faqat koʻrish</span>`) + `<div class="tg-scr" style="padding-top:4px">
            <section class="tg-card" style="padding:16px"><div style="display:flex;align-items:center;gap:12px"><span style="width:52px;height:52px;border-radius:50%;background:#EAF3FF;color:#0057B8;display:grid;place-items:center;font-size:18px;font-weight:800;flex:none">${esc(initials(l.name))}</span>
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><strong style="font-size:19px;font-weight:800">${esc(l.name || 'Ismsiz')}</strong><span style="font-size:13px;color:#4B5563">${LANG_NAME[l.language] || ''} · Target</span></div></div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">${badge}${sold(l) ? `<span class="tg-chip tg-chip--g">Toʻladi${paidDays != null ? ' · ' + paidDays + ' kunda' : ''}</span>` : ''}${l.dupPhone ? '<span class="tg-chip tg-chip--a">Takroriy lid</span>' : ''}</div></section>
            <section class="tg-card" style="padding:6px 16px;gap:0"><h2 style="margin:10px 0 4px;font-size:15px">Qayerdan keldi</h2>
              <div class="tg-kv"><span>Kampaniya</span><strong>${esc(campOf(l))}</strong></div>
              <div class="tg-kv"><span>Kreativ</span><strong>${esc(adOf(l) || '—')}</strong></div>
              <div class="tg-kv"><span>Forma</span><strong>${esc(l.metaFormName || l.source || '—')}</strong></div>
              <div class="tg-kv"><span>Kelgan vaqt</span><strong>${esc(when(l.createdAt) || x.day || '—')}</strong></div></section>
            <section class="tg-card"><h2 style="font-size:15px">Anketa</h2>${l.connectedSurvey ? `<div class="tg-an">${an.map(([k, v]) => `<span><small>${k}</small><strong>${esc(v || '—')}</strong></span>`).join('')}</div>` : '<span style="font-size:13px;color:#4B5563">Sotuvchi bogʻlanganda toʻldiriladi</span>'}</section>
            <section class="tg-card"><h2 style="font-size:15px">Lid yoʻli</h2><ol class="tg-tl">${items.map(i => `<li><i class="${i.cls}"></i><span><strong style="${i.cls === 'ok' ? 'color:#067647' : i.cls === 'bad' ? 'color:#B42318' : ''}">${esc(i.t)}</strong><small>${esc(when(i.at) || '')}</small></span></li>`).join('')}</ol></section>
            <span class="tg-note">Telefon raqam, sotuvchi va suhbat izohlari targetologga koʻrsatilmaydi</span></div>`;
    }

    // ---------- T07 Tabrik ----------
    function checkWins() {
        let seen = null; const key = 'tg_seen_sold_' + (user().id || '');
        try { seen = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { seen = null; }
        const soldNow = S.langs.flatMap(lang => leadsOf(lang, null)).filter(x => stOf(x.l) === 'tolov-yopildi');
        const ids = soldNow.map(x => String(x.l.id));
        if (!Array.isArray(seen)) { try { localStorage.setItem(key, JSON.stringify(ids)); } catch (e) { /* xotira yo'q */ } return; }
        const fresh = soldNow.filter(x => !seen.includes(String(x.l.id)));
        try { localStorage.setItem(key, JSON.stringify(ids)); } catch (e) { /* */ }
        if (!fresh.length || pop) return;
        showWin(fresh[fresh.length - 1], soldNow);
    }
    function showWin(x, soldNow) {
        const l = x.l, month = x.day.slice(0, 7);
        const nth = soldNow.filter(y => y.day.slice(0, 7) === month).length;
        const h = (l.stageHistory || []).find(h => SOLD.has(h.to)); const a = ts(l.createdAt), b = h && ts(h.at);
        const days = a && b ? Math.max(0, Math.round((b - a) / DAY)) : null;
        const conf = ['#3B8BEE', '#FDB022', '#12B76A', '#FFFFFF', '#3B8BEE', '#FDB022', '#12B76A'].map((c, i) => `<span style="left:${8 + i * 13.5}%;background:${c};animation-delay:${[0, .6, .3, .9, .45, .15, .75][i]}s"></span>`).join('');
        const row = (k, v, last) => `<div style="display:flex;justify-content:space-between;align-items:center;min-height:46px;${last ? '' : 'border-bottom:1px solid rgba(255,255,255,.1)'}"><span style="font-size:14px;color:#C7D2E3">${k}</span><strong style="font-size:14px;text-align:right">${esc(v)}</strong></div>`;
        openPop(`<section class="tg-win" role="dialog" aria-modal="true" aria-labelledby="tgWnT"><div class="tg-conf" aria-hidden="true">${conf}</div>
            <div style="position:relative;width:200px;height:200px;display:grid;place-items:center;flex:none">
              <svg class="tg-rays" aria-hidden="true" width="200" height="200" viewBox="0 0 200 200" style="position:absolute;inset:0;opacity:.35"><g fill="#3B8BEE"><path d="M100 0l6 70h-12z"/><path d="M100 200l6-70h-12z"/><path d="M0 100l70-6v12z"/><path d="M200 100l-70-6v12z"/><path d="M29 29l53 46-8 8z"/><path d="M171 171l-53-46 8-8z"/><path d="M171 29l-46 53-8-8z"/><path d="M29 171l46-53 8 8z"/></g></svg>
              <div class="tg-pop-ico" style="position:relative;width:112px;height:112px;border-radius:36px;background:#0065D6;display:grid;place-items:center;box-shadow:0 20px 50px rgba(0,101,214,.55);color:#FFF">${ic('target', 56, 2)}</div></div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;margin-top:14px"><span class="tg-cap" style="color:#FDE68A;letter-spacing:.08em">NISHONGA TEGDI</span>
              <h2 id="tgWnT" style="margin:0;font-size:28px;font-weight:800;letter-spacing:-.02em;line-height:1.15">Sizning lidingiz<br>oʻquvchi boʻldi!</h2><span style="font-size:15px;color:#C7D2E3">${esc(l.name || '')} kursga toʻladi</span></div>
            <div style="width:100%;max-width:440px;margin-top:18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:6px 16px">
              ${row('Kampaniya', campOf(l))}${row('Kreativ', adOf(l) || '—')}${row('Liddan toʻlovgacha', days == null ? '—' : days + ' kun', true)}</div>
            <div style="width:100%;max-width:440px;margin-top:10px;display:flex;align-items:center;gap:12px;background:#FDE68A;color:#0B1220;border-radius:18px;padding:12px 14px"><strong style="font-size:26px;font-weight:800">${nth}</strong>
              <span style="font-size:14px;font-weight:700;line-height:1.35">${cap(MON[Number(month.slice(5)) - 1])} lidlaridan ${nth}-oʻquvchi — sizning reklamangizdan</span></div>
            <div style="margin-top:auto;padding-top:20px;width:100%;max-width:440px;display:flex;gap:8px"><button type="button" class="tg-btn2" style="flex:1;background:transparent;color:#FFF !important;border-color:rgba(255,255,255,.4)" data-tg-popclose>Yopish</button>
              <button type="button" class="tg-btn" style="flex:1.3;box-shadow:none" data-tg-popgo="lead:${esc(l.id)}">Lid yoʻlini koʻrish</button></div></section>`);
    }

    // ---------- Bildirishnomalar ----------
    function screenNotif() {
        const list = (g('getNotifications') ? getNotifications() : []).slice().sort((a, b) => (ts(b.createdAt || b.date) || 0) - (ts(a.createdAt || a.date) || 0)).slice(0, 60);
        const unread = list.filter(n => !n.read).length;
        return back('Bildirishnomalar', unread ? `<button type="button" class="tg-link" data-tg-nall style="font-size:13px">Hammasini oʻqildi</button>` : '') + `<div class="tg-scr" style="padding-top:4px">
            ${list.length ? `<div class="tg-list">${list.map(n => `<button type="button" data-tg-nitem="${esc(n.id)}" style="align-items:flex-start;padding:12px 0">
                <span style="width:10px;height:10px;border-radius:50%;margin-top:6px;flex:none;background:${n.read ? 'transparent' : '#0065D6'}"></span>
                <span style="display:flex;flex-direction:column;gap:2px;font-size:14px;font-weight:${n.read ? 500 : 700}">${esc(n.title || n.message || '')}${n.title && n.message ? `<small style="font-size:13px;color:#4B5563;font-weight:500">${esc(n.message)}</small>` : ''}<small style="font-size:12px;color:#6B7280;font-weight:500">${esc(n.time || n.date || '')}</small></span></button>`).join('')}</div>`
              : '<div class="tg-card tg-empty">Hozircha bildirishnoma yoʻq</div>'}</div>`;
    }

    // ---------- T08 Menyu ----------
    function screenMenu() {
        const u = user(), ads = adsNow(S.lang, addDays(todayKey(), -1).slice(0, 7));
        const m = addDays(todayKey(), -1).slice(0, 7), filled = Object.keys(ads?.days || {}).filter(d => d.slice(0, 7) === m).length, need = Number(addDays(todayKey(), -1).slice(8));
        const camps = new Set(leadsOf(S.lang, todayKey().slice(0, 7)).map(x => campOf(x.l))).size;
        const tile = (go, icon, bg, fg, t, s) => `<button type="button" data-tg-go="${go}"><i style="background:${bg};color:${fg}">${ic(icon, 20, 2)}</i><span><strong>${t}</strong><small>${s}</small></span></button>`;
        return `<div class="tg-scr" style="gap:14px"><h1 class="tg-h1">Menyu</h1>
            <button type="button" class="tg-blue" data-tg-crm="profile" style="display:flex;align-items:center;gap:14px;border:0;text-align:left;width:100%">${hex()}
              <span style="width:56px;height:56px;border-radius:50%;border:3px solid rgba(255,255,255,.85);background:#0B1220;display:grid;place-items:center;font-size:19px;font-weight:800;flex:none">${esc(initials(u.name))}</span>
              <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><strong style="font-size:18px;font-weight:800">${esc(u.name || '')}</strong><span style="font-size:13px;color:#DCEBFF">Targetolog · ${S.langs.map(l => LANG_NAME[l]).join(' va ') || '—'}</span>
                ${ads ? `<span style="align-self:flex-start;margin-top:4px;font-size:12px;font-weight:800;background:rgba(11,18,32,.32);border-radius:999px;padding:3px 10px">${monthOnly(m)}: ${filled} / ${need} kun kiritilgan</span>` : ''}</span>${ic('next', 20, 2.2)}</button>
            <nav aria-label="Boʻlimlar" class="tg-mgrid tg-s1">${tile('entry', 'pen', '#EAF3FF', '#0057B8', 'Kunlik kiritish', 'Ads Manager')}${tile('report', 'report', '#ECFDF3', '#067647', 'Hisobot', 'Oylar boʻyicha')}
              ${tile('stats', 'stats', '#EAF3FF', '#0057B8', 'Statistika', 'Lid sifati')}${tile('leads', 'leads', '#EAF3FF', '#0057B8', 'Lidlar', monthOnly(todayKey().slice(0, 7)) + ': ' + int(leadsOf(S.lang, todayKey().slice(0, 7)).length))}
              ${tile('campaigns', 'megaphone', '#FEF0C7', '#93370D', 'Kampaniyalar', camps + ' ta')}<button type="button" data-tg-crm="guides"><i style="background:#F1F5F9;color:#3A4456">${ic('book', 20, 2)}</i><span><strong>Yoʻriqnomalar</strong><small>Qoidalar</small></span></button>${window.jarima && !jarima.counts()?.exempt ? `<button type="button" data-jr-go="my"><i style="background:#FEF0C7;color:#93370D">${ic('report', 20, 2)}</i><span><strong>Mening jarimalarim</strong><small>Maosh va yuvish</small></span></button>` : ''}</nav>
            <div class="tg-list"><button type="button" data-tg-crm="profile">${ic('tg', 20, 2)}<span>Telegram bot va eslatma</span>${ic('next', 18, 2.2)}</button>
              <button type="button" data-tg-crm="profile">${ic('gear', 20, 2)}<span>Sozlamalar</span>${ic('next', 18, 2.2)}</button>
              <button type="button" data-tg-logout style="color:#B42318">${ic('logout', 20, 2)}<span style="font-weight:700">Chiqish</span></button></div></div>`;
    }

    // ---------- navigatsiya ----------
    const NAV = [['home', 'Bosh', 'home'], ['report', 'Hisobot', 'report'], ['stats', 'Statistika', 'stats'], ['leads', 'Lidlar', 'leads'], ['menu', 'Menyu', 'menu']];
    const TAB_OF = { notif: 'home', home: 'home', entry: 'home', report: 'report', stats: 'stats', leads: 'leads', lead: 'leads', menu: 'menu', crm: 'menu' };
    function buildNav() {
        nav = document.createElement('nav'); nav.className = 'tg-nav'; nav.setAttribute('aria-label', 'Pastki menyu');
        nav.innerHTML = NAV.map(([id, label, icon]) => `<button type="button" data-tg-nav="${id}"><span>${ic(icon, 20, 1.9)}</span>${label}</button>`).join('');
        nav.addEventListener('click', e => { const b = e.target.closest('[data-tg-nav]'); if (!b) return; if (S.status?.locked) { showLock(); return; } S.stack = []; go(b.dataset.tgNav, false, true); });
        document.body.appendChild(nav);
    }
    function syncNav() {
        if (!nav) return;
        const tab = TAB_OF[S.screen] || 'menu';
        nav.querySelectorAll('[data-tg-nav]').forEach(b => { const on = b.dataset.tgNav === tab; b.setAttribute('aria-current', on ? 'page' : 'false'); b.querySelector('svg')?.setAttribute('stroke-width', on ? '2.2' : '1.9'); });
        nav.hidden = S.screen === 'entry';
    }
    async function go(screen, push = true, reset) {
        if (screen === 'campaigns') { S.statTab = 'campaigns'; screen = 'stats'; }
        if (push && S.screen !== screen) S.stack.push({ screen: S.screen, lead: S.lead });
        if (screen === 'entry' && !S.entryDate) { S.entryDate = addDays(todayKey(), -1); S.draft = null; }
        if (reset && screen === 'stats') S.statTab = S.statTab || 'quality';
        S.screen = screen;
        if (screen !== 'lead' && screen !== 'leads' && reset) S.leadLimit = 40;
        leaveCrm();
        render(true);
        await ensureData();
        render(false);
    }
    function goBack() {
        const p = S.stack.pop();
        if (!p) { S.screen = 'home'; } else { S.screen = p.screen; S.lead = p.lead; }
        if (S.screen !== 'entry') { S.entryDate = null; S.draft = null; S.entryErr = ''; }
        render(true);
    }
    async function ensureData() {
        const today = todayKey(), y = addDays(today, -1);
        const need = new Set([S.lang + '|' + S.month, S.lang + '|' + prevMonth(S.month), S.lang + '|' + y.slice(0, 7), S.lang + '|' + today.slice(0, 7), S.lang + '|' + prevMonth(y.slice(0, 7))]);
        if (S.entryDate) need.add(S.lang + '|' + S.entryDate.slice(0, 7));
        await Promise.all([...need].map(k => { const [l, m] = k.split('|'); return loadAds(l, m); }));
    }
    function openCrm(tab) {
        S.stack.push({ screen: S.screen, lead: S.lead });
        S.screen = 'crm';
        document.body.classList.add('tg-crm');
        if (root) root.hidden = true;
        if (g('switchTab')) switchTab(tab);
        syncNav();
        window.scrollTo?.(0, 0);
    }
    function leaveCrm() { document.body.classList.remove('tg-crm'); if (root && S.screen !== 'crm') root.hidden = false; }

    // ---------- chizish ----------
    let rq = 0;
    function render(scrollTop) {
        if (!root || !isOn()) return;
        const keep = document.activeElement && root.contains(document.activeElement) && document.activeElement.matches('input') ? { k: document.activeElement.dataset.tgIn || (document.activeElement.hasAttribute('data-tg-q') ? 'q' : ''), s: document.activeElement.selectionStart } : null;
        const y = root.scrollTop;
        const html = S.screen === 'entry' ? screenEntry(false) : S.screen === 'report' ? screenReport() : S.screen === 'stats' ? screenStats()
            : S.screen === 'notif' ? screenNotif() : S.screen === 'leads' ? screenLeads() : S.screen === 'lead' ? screenLead() : S.screen === 'menu' ? screenMenu() : S.screen === 'crm' ? '' : screenHome();
        // Animatsiya faqat yangi ekran ochilganda; ma'lumot yangilanganda (har 30 s, harf yozilganda) qayta o'ynamaydi.
        root.classList.toggle('tg-still', !scrollTop);
        root.innerHTML = html;
        root.scrollTop = scrollTop ? 0 : y;
        if (keep?.k) { const el = keep.k === 'q' ? root.querySelector('[data-tg-q]') : root.querySelector(`[data-tg-in="${keep.k}"]`); if (el) { el.focus(); try { el.setSelectionRange(keep.s, keep.s); } catch (e) { /* raqamli input */ } } }
        syncNav();
    }
    const queueRender = () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(() => render(false)); };
    // CRM lidlarni yangilaganda (holat o'zgargan bo'lishi mumkin) — oylik yig'indilar qayta hisoblanadi.
    const invalidate = () => { Object.values(IDX).forEach(c => { c.agg.clear(); }); };

    function openPop(html, locked, extra) {
        closePop();
        pop = document.createElement('div'); pop.className = 'tg-pop' + (extra ? ' ' + extra : ''); pop.innerHTML = html;
        if (locked) pop.dataset.locked = '1';
        pop.addEventListener('click', onClick); pop.addEventListener('input', onInput);
        document.body.appendChild(pop);
        setTimeout(() => pop?.querySelector('input, button.tg-btn')?.focus?.({ preventScroll: true }), 50);
    }
    function closePop() { if (pop) { pop.remove(); pop = null; } }

    // ---------- hodisalar ----------
    function onInput(e) {
        const t = e.target;
        if (t.dataset.tgIn) { S.draft = { ...(S.draft || {}), [t.dataset.tgIn]: t.value }; S.entryErr = ''; S.entryErrKey = ''; if (t.dataset.tgIn !== 'note') { if (pop && !MQ.matches) refreshDeskEntry(); else queueRender(); } return; }
        if (t.hasAttribute('data-tg-q')) { S.leadQ = t.value; S.leadLimit = 40; queueRender(); }
    }
    function refreshDeskEntry() {
        const box = pop?.querySelector('.tg-app'); if (!box) return;
        const a = document.activeElement, k = a?.dataset?.tgIn, s = a?.selectionStart;
        box.innerHTML = screenEntry(true);
        if (k) { const el = box.querySelector(`[data-tg-in="${k}"]`); if (el) { el.focus(); try { el.setSelectionRange(s, s); } catch (er) { /* */ } } }
    }
    async function onClick(e) {
        const t = e.target.closest('[data-tg-go],[data-tg-back],[data-tg-lang],[data-tg-month],[data-tg-stat],[data-tg-ltab],[data-tg-lead],[data-tg-leads],[data-tg-lmore],[data-tg-edit],[data-tg-eday],[data-tg-save],[data-tg-reportall],[data-tg-nall],[data-tg-nitem],[data-tg-crm],[data-tg-logout],[data-tg-lockgo],[data-tg-popclose],[data-tg-popgo]');
        if (!t) return;
        const d = t.dataset;
        if ('tgLogout' in d) { closePop(); document.getElementById('profileLogoutBtn')?.click(); return; }
        if ('tgLockgo' in d) { startLockEntry(); return; }
        if ('tgSave' in d) {
            await saveEntry();
            if (pop?.classList.contains('tg-pop--entry')) { if (S.status?.locked) refreshDeskEntry(); else if (!pop.querySelector('.tg-sheet')) closePop(); }
            return;
        }
        if ('tgEday' in d) { const n = addDays(S.entryDate, Number(d.tgEday)); S.entryDate = n; S.draft = null; S.entryErr = ''; await loadAds(S.lang, n.slice(0, 7)); if (pop && !MQ.matches) refreshDeskEntry(); else render(false); return; }
        if ('tgPopclose' in d) { if (pop?.dataset.locked) return; closePop(); return; }
        if ('tgPopgo' in d) {
            closePop();
            if (!MQ.matches) return;
            S.entryDate = null; S.draft = null; S.stack = [];
            if (d.tgPopgo.startsWith('lead:')) { S.lead = d.tgPopgo.slice(5); go('lead', false); }
            else go(d.tgPopgo === 'report' ? 'report' : 'home', false, true);
            return;
        }
        if (S.status?.locked) { showLock(); return; }
        if ('tgBack' in d) { goBack(); return; }
        if ('tgGo' in d) { if (d.tgGo === 'entry') { S.entryDate = null; } go(d.tgGo, true, true); return; }
        if ('tgCrm' in d) { openCrm(d.tgCrm); return; }
        if ('tgLang' in d) { S.lang = d.tgLang; render(false); await ensureData(); render(false); return; }
        if ('tgMonth' in d) { const n = Number(d.tgMonth) < 0 ? prevMonth(S.month) : nextMonth(S.month); if (n > todayKey().slice(0, 7)) return; S.month = n; S.reportAll = false; render(false); await ensureData(); render(false); return; }
        if ('tgStat' in d) { S.statTab = d.tgStat; render(false); return; }
        if ('tgLtab' in d) { S.leadTab = d.tgLtab; S.leadLimit = 40; render(false); return; }
        if ('tgLeads' in d) { S.leadTab = d.tgLeads; S.leadQ = ''; S.leadLimit = 40; go('leads', true); return; }
        if ('tgLmore' in d) { S.leadLimit += 40; render(false); return; }
        if ('tgLead' in d) { S.lead = d.tgLead; go('lead', true); return; }
        if ('tgNall' in d) { if (g('markAllNotificationsRead')) markAllNotificationsRead(); render(false); return; }
        if ('tgNitem' in d) { if (g('markNotificationRead')) markNotificationRead(d.tgNitem); render(false); return; }
        if ('tgReportall' in d) { S.reportAll = true; render(false); return; }
        if ('tgEdit' in d) { S.entryDate = d.tgEdit; S.draft = null; S.entryErr = ''; go('entry', true); return; }
    }

    // ---------- yoqish ----------
    const isOn = () => isTg() && MQ.matches;
    async function refresh() {
        if (!isTg()) return;
        await loadStatus();
        S.ads = {}; invalidate(); await ensureData();
        if (S.status?.locked) { if (MQ.matches && S.screen === 'entry') render(false); else if (!pop || !pop.dataset.locked) showLock(); }
        else { if (pop?.dataset.locked && !pop.querySelector('.tg-sheet h2#tgSvT')) closePop(); checkWins(); }
        if (isOn() && S.screen !== 'entry') render(false);
    }
    function enable() {
        document.body.classList.add('tg-on'); document.body.classList.remove('tg-lock-desk');
        if (!root) { root = document.createElement('main'); root.className = 'tg-app'; root.id = 'tgApp'; document.body.appendChild(root); root.addEventListener('click', onClick); root.addEventListener('input', onInput); }
        if (!nav) buildNav();
        root.hidden = S.screen === 'crm'; nav.hidden = false;
        render(true);
    }
    function disable() {
        document.body.classList.remove('tg-on', 'tg-crm'); document.body.classList.add('tg-lock-desk');
        if (root) root.hidden = true; if (nav) nav.hidden = true;
    }
    function sync() { if (!isTg()) return; if (MQ.matches) enable(); else disable(); if (S.status?.locked && !pop) showLock(); }

    async function init() {
        if (inited || !isTg()) return;
        inited = true;
        const today = todayKey();
        S.month = addDays(today, -1).slice(0, 7);
        S.lang = 'russian';
        if (MQ.matches) enable(); else disable();
        if (root) root.innerHTML = `<div class="tg-scr">${sk(60)}${sk(120)}${sk(200)}</div>`;
        await loadStatus();
        await ensureData();
        sync();
        if (S.status?.locked) showLock(); else checkWins();
        render(true);
        MQ.addEventListener?.('change', sync);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
        // CRM 30 soniyada lidlarni yangilaydi — ekranimiz ham yangilansin (kiritish paytida emas).
        ['renderDashboard', 'renderLeads', 'renderSales'].forEach(name => {
            const orig = window[name]; if (typeof orig !== 'function' || orig._tg) return;
            const w = function () { const r = orig.apply(this, arguments); invalidate(); if (isOn() && S.screen !== 'entry' && S.screen !== 'crm') queueRender(); return r; };
            w._tg = true; window[name] = w;
        });
        clearInterval(timer);
        timer = setInterval(() => { if (document.visibilityState === 'visible' && isTg()) { if (S.screen !== 'entry') { checkWins(); queueRender(); } } }, 30000);
        // Kun almashsa (yarim tunda ilova ochiq qolsa) — qulf holatini qayta tekshiramiz.
        setInterval(() => { if (todayKey() !== S._day) { S._day = todayKey(); refresh(); } }, 60000); S._day = today;
        const orig = window.switchTab;
        if (typeof orig === 'function' && !orig._tg) {
            const w = function (tab) { const r = orig.apply(this, arguments); if (isOn() && S.screen !== 'crm' && ['dashboard', 'sales', 'leads'].includes(tab) && root?.hidden) { S.screen = 'home'; leaveCrm(); render(true); } return r; };
            w._tg = true; window.switchTab = w;
        }
    }

    window.targetologApp = { state: S, go, refresh, render: () => render(false) };
    const start = () => {
        const wait = (n = 0) => {
            const ready = g('getCurrentUser') && getCurrentUser()?.role && (g('getItem') && getItem(STORAGE_KEYS.leads, null) || n > 60);
            if (ready) { if (isTg()) init(); return; }
            setTimeout(() => wait(n + 1), 150);
        };
        wait();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 80));
    else setTimeout(start, 80);
})();
