// Ustoz ilovasi v2 — "boshqa" bo'limi: O'quvchilar, O'quvchi kartasi, Adminga so'rov, Darslik (72 dars), Dars materiallari,
// Taqdimot (slaydlar + doska, yotiq), Maosh, Reyting, Menyu, Profil (sozlamalar, bildirishnomalar, kirish tarixi, parol), Yo'riqnomalar.
// Dizayn: kanvas "Ustoz · yakuniy" — Oquvchilar, Karta, Darslik, DarsHub, Taqdimot, Maosh, Reyting, Menyu, Profil, Holatlar.
// Mantiq manbasi — teacher/app.js (renderStudents, renderMainCard, renderDarslik/openLesson, maosh, reyting, sessiya, openPassword, yo'riqnomalar, sorov).
// Maxfiylik: to'lov, tarif, qarz va sotuv ma'lumoti hech qayerda ko'rsatilmaydi.
(function () {
    'use strict';
    const U = window.U;
    if (!U) return;
    const D = () => window.DWT;
    const S = () => window.DWT.S;
    const esc = s => D().esc(s);
    const api = (p, o) => D().api(p, o);
    const svg = U.svg;
    const P = {
        back: '<path d="M15 6l-6 6 6 6"></path>', chev: '<path d="M9 6l6 6-6 6"></path>', x: '<path d="M6 6l12 12M18 6L6 18"></path>',
        search: '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path>',
        tg: '<path d="M21 4L3 11l6 2 2 6 3-4 5 4z"></path>',
        msg: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"></path>',
        check: '<rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M8.5 12l2.5 2.5 4.5-5"></path>',
        flag: '<path d="M4 22V4a1 1 0 011-1h12l-2 4 2 4H5"></path>',
        info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path>',
        book: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"></path><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5"></path>',
        trial: '<rect x="3" y="4.5" width="18" height="16" rx="3"></rect><path d="M3 9.5h18M9 15l2 2 4-4"></path>',
        money: '<rect x="2" y="6" width="20" height="13" rx="3"></rect><circle cx="12" cy="12.5" r="2.5"></circle>',
        cup: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"></path><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"></path>',
        coffee: '<path d="M17 8h1a4 4 0 010 8h-1"></path><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4z"></path>',
        box: '<path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"></path>',
        pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"></path>',
        help: '<circle cx="12" cy="12" r="9"></circle><path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01"></path>',
        gear: '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"></path>',
        out: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"></path>',
        cam: '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"></path><circle cx="12" cy="13" r="4"></circle>',
        play: '<path d="M7 4.5v15l12-7.5z"></path>',
        bookOpen: '<path d="M2 4h7a3 3 0 013 3v14a2 2 0 00-2-2H2zM22 4h-7a3 3 0 00-3 3v14a2 2 0 012-2h8z"></path>',
        file: '<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"></path><path d="M14 3v6h6"></path>',
        task: '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>',
        marker: '<path d="M9 11l-6 6v3h9l3-3"></path><path d="M22 12l-4.6 4.6a2 2 0 01-2.8 0l-5.2-5.2a2 2 0 010-2.8L14 4"></path>',
        text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"></path>', eraser: '<path d="M20 20H8l-5-5 10-10 8 8-6 6"></path>',
        undo: '<path d="M3 7v6h6"></path><path d="M21 17a9 9 0 00-15-6.7L3 13"></path>',
        crown: '<path d="M2 8l4 10h12l4-10-6 4-4-7-4 7z"></path>',
        star: '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill="#FDB022" stroke="none"></path>',
        users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"></path>',
        mobile: '<rect x="6" y="2" width="12" height="20" rx="3"></rect><path d="M11 18h2"></path>',
        monitor: '<rect x="2" y="4" width="20" height="13" rx="2"></rect><path d="M8 21h8M12 17v4"></path>',
        alert: '<path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"></path><path d="M12 9v4M12 17h.01"></path>',
        audio: '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',
        ext: '<path d="M14 4h6v6M20 4l-9 9"></path><path d="M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"></path>'
    };
    const chevR = (c = '#94A3B8') => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">${P.chev}</svg>`;
    const LBL = { home: 'Bosh', jadval: 'Jadval', davomat: 'Davomat', oquvchilar: "O'quvchilar", menyu: 'Menyu', karta: "O'quvchi", darslik: 'Darslik', darshub: 'Dars', maosh: 'Maosh', reyting: 'Reyting', profil: 'Profil', yoriq: "Yo'riqnomalar", sorov: "So'rov", kirish: 'Kirish tarixi' };
    // Orqaga tugmasi yorlig'i — oldingi ekran nomi (hash: #tab~sahifa:arg~...).
    function prevLabel() {
        const parts = (location.hash || '').slice(1).split('~');
        const prev = (parts[parts.length - 2] || 'home').split(':')[0];
        return LBL[prev] || 'Orqaga';
    }
    const bar = (mid = '', right = '') => `<div class="bar"><a class="back" href="#" data-u-back>${svg(P.back, 22, 2.2)}${esc(prevLabel())}</a>${mid || right ? `<span class="mid">${mid}</span>${right}` : ''}</div>`;
    const MONTHS = () => D().MON;
    const cap1 = s => s ? s[0].toUpperCase() + s.slice(1) : '';
    const monName = m => MONTHS()[+m.slice(5) - 1];
    const dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
    const dur = s => Number(s?.lessonDuration) || 30;
    const sched = s => `${D().patternLabel(s.lessonDayOfWeek)} ${s.lessonTime || ''} · ${dur(s)} daq`.replace(/\s+·/, ' ·').trim();
    const prog = id => S().progress?.[id] || null;
    const flagKeys = id => (prog(id)?.flags || []).map(f => f.key);
    const reachedOf = id => Number(prog(id)?.reached) || 0;
    const fmt1 = v => String(Math.round(v * 10) / 10).replace('.', ',');
    const mln = v => { const x = (v / 1e6).toFixed(2).replace(/0$/, '').replace(/\.0?$/, ''); return x.replace('.', ','); };
    const empty = (icon, title, text, btn = '') => `<div class="card bq-empty"><div class="bq-flt">${svg(icon, 44, 1.6)}</div><strong>${title}</strong>${text ? `<span class="s">${text}</span>` : ''}${btn}</div>`;
    const sheetHead = (title, sub = '') => `<div class="row"><div class="col g1"><h2 class="bq-shh">${title}</h2>${sub ? `<span class="s">${sub}</span>` : ''}</div><button type="button" class="icb" data-u-close aria-label="Yopish">${svg(P.x, 20, 2.2)}</button></div>`;
    const loading = (e, key, n = 2, h = 72) => e.err && !e.data ? U.err(e, key) : U.skel(n, h);
    // Ustozning o'z rasmi (S.user.avatar — /images/staff-avatars/... yoki yuklangan rasm), bo'lmasa bosh harf.
    function meAvatar(size, style = '') {
        const u = S().user || {}, a = u.avatar;
        if (a && /^(\/|https:|data:image)/.test(a)) return `<img class="av" src="${esc(a)}" alt="" style="width: ${size}px; height: ${size}px; ${style}">`;
        return `<span class="av bq-ini" style="width: ${size}px; height: ${size}px; font-size: ${Math.round(size * 0.4)}px; ${style}">${esc((D().first(u.name || S().me?.name)[0] || '').toUpperCase())}</span>`;
    }
    const langOf = () => S().me?.lang === 'russian' || S().me?.role === 'rus-oqituvchi' ? 'Rus tili' : 'Ingliz tili';
    const ratingOf = r => { if (!r) return null; const mine = (r.rows || []).find(x => x.id === r.selfId); return mine || (r.rank ? { rank: r.rank, score: r.score } : null); };

    // ─────────────────────────────────────────────────────────────────────
    // O'quvchilar
    // ─────────────────────────────────────────────────────────────────────
    let stQ = '', stSeg = 'active', stF = 'all';
    // Holat yorlig'i (dizayn: Kelmayapti / Qiynalyapti / Ilovaga kirmadi · N kun / Orqada / Yangi / Oldinda / Rejada).
    function statusOf(s) {
        const n = D().now(), ms = D().monthStats(s, n.month), f = flagKeys(s.id), pr = prog(s.id);
        if (s.frozen) return { cls: 'inf', t: 'Muzlatilgan', w: 6 };
        if (ms.kelmadi >= 3) return { cls: 'bad', t: 'Kelmayapti', w: 0 };
        if (f.includes('struggling')) return { cls: 'wa', t: 'Qiynalyapti', w: 1 };
        if (f.includes('idle')) return { cls: 'wa', t: pr?.daysIdle != null ? `Ilovaga kirmadi · ${pr.daysIdle} kun` : 'Ilovaga kirmagan', w: 2 };
        if (f.includes('behind')) return { cls: 'wa', t: 'Orqada', w: 3 };
        const start = String(s.startDate || '').slice(0, 10);
        if (!reachedOf(s.id) && (!start || dayDiff(start, n.date) <= 14)) return { cls: 'inf', t: 'Yangi', w: 5 };
        if (pr?.expected && reachedOf(s.id) > pr.expected) return { cls: 'ok', t: 'Oldinda', w: 4 };
        return { cls: 'ok', t: 'Rejada', w: 4 };
    }
    const needsAttention = s => !s.frozen && (flagKeys(s.id).some(k => k !== 'frozen') || D().monthStats(s, D().now().month).kelmadi >= 3);
    const stRow = s => {
        const p = statusOf(s);
        return `<a class="li" href="#" data-u-push="karta" data-arg="${esc(s.id)}">${D().avatar(s, 'av bq-a42')}<div class="col g1"><span class="nm">${esc(s.name)}</span><span class="s">${esc(sched(s))}</span></div><div class="bq-mp"><span class="pill ${p.cls}">${esc(p.t)}</span><span class="xs b">${reachedOf(s.id)} / 72</span></div></a>`;
    };
    function renderInactive() {
        const list = S().inactive;
        if (list == null) return `<div class="note w" role="alert"><span>Faol bo'lmagan o'quvchilar yuklanmadi.</span><button type="button" class="btn sm" data-bq-reload style="margin-left: auto">Qayta urinish</button></div>`;
        if (!list.length) return empty(P.box, "Faol bo'lmagan o'quvchi yo'q", "Muzlatilgan, boshqa ustozga o'tgan yoki kursni tugatgan o'quvchilar shu yerda ko'rinadi.");
        const groups = [['frozen', 'Muzlatilgan', 'inf'], ['moved', "Boshqa ustozga o'tgan", 'vio'], ['left', 'Chiqib ketgan', 'mu'], ['finished', 'Kursni tugatganlar', 'ok']];
        const fd = d => d ? D().fmtDate(String(d).slice(0, 10)) : '';
        return groups.map(([k, label, tone]) => {
            const g = list.filter(x => x.state === k); if (!g.length) return '';
            return `<span class="bq-gh">${label.toUpperCase()} · ${g.length}</span><div class="card l">${g.map(x => {
                const s = D().stuOf(x.id);
                const sub = k === 'frozen' ? `${fd(x.from)}${x.to ? ' → ' + fd(x.to) : ''}${x.to ? ` · ${fd(U.addDays(String(x.to).slice(0, 10), 1))} qaytadi` : ''}`
                    : k === 'moved' ? `${fd(x.from)} dan` : k === 'finished' ? `${x.lessons || 0} dars siz bilan${x.reached != null ? ` · ilovada ${x.reached} / 72` : ''}`
                        : `${fd(x.from)}${x.lessons ? ` · ${x.lessons} dars siz bilan` : ''}${x.reason ? ' · ' + esc(x.reason) : ''}`;
                const inner = `${D().avatar(x, 'av bq-a42')}<div class="col g1"><span class="nm">${esc(x.name)}</span><span class="s">${sub}${s && s.lessonTime && k === 'frozen' ? ' · ' + esc(D().patternLabel(s.lessonDayOfWeek) + ' ' + s.lessonTime) : ''}</span></div><span class="pill ${tone}">${label.split(' ')[0]}</span>`;
                return s ? `<a class="li" href="#" data-u-push="karta" data-arg="${esc(x.id)}">${inner}</a>` : `<div class="li">${inner}</div>`;
            }).join('')}</div>`;
        }).join('') + `<span class="xs bq-foot">Bu o'quvchilar bugungi darslar, davomat, reyting va maoshga qo'shilmaydi. Muzlatilgan o'quvchi qaytganda avtomatik "Faol"ga o'tadi.</span>`;
    }
    U.tab('oquvchilar', {
        render() {
            const all = S().main || [], q = stQ.trim().toLowerCase();
            const has = (s, k) => k === 'att' ? needsAttention(s) : k === 'idle' ? flagKeys(s.id).includes('idle') && !s.frozen : flagKeys(s.id).includes(k);
            const cnt = k => all.filter(s => has(s, k)).length;
            const inN = S().inactive?.length ?? 0;
            const list = all.filter(s => (!q || s.name.toLowerCase().includes(q) || String(s.id).toLowerCase().includes(q)) && (stF === 'all' || has(s, stF)))
                .map(s => ({ s, p: statusOf(s) })).sort((a, b) => a.p.w - b.p.w || (D().toMin(a.s.lessonTime) ?? 9999) - (D().toMin(b.s.lessonTime) ?? 9999)).map(x => x.s);
            const chip = (k, l, n) => `<button type="button" class="chip${stF === k ? ' on' : ''}" data-st-f="${k}" aria-pressed="${stF === k}">${l}${n ? ` · ${n}` : ''}</button>`;
            return `<header class="hd" style="padding-bottom: 4px"><div class="t"><span class="date">Sizga biriktirilgan o'quvchilar</span><h1 style="font-size: 26px">O'quvchilarim</h1></div></header>
            <div class="bd" style="gap: 10px">
              ${U.offline()}
              ${stSeg === 'active' ? `<div class="bq-srch"><label for="bq-q" class="sr">Qidirish</label>${svg(P.search, 20, 2).replace('stroke="currentColor"', 'stroke="#4B5563"')}<input id="bq-q" type="search" placeholder="Ism yoki ID" value="${esc(stQ)}" autocomplete="off"></div>` : ''}
              <div class="seg bq-seg44" role="tablist"><button type="button" role="tab" data-st-seg="active" class="${stSeg === 'active' ? 'on' : ''}" aria-selected="${stSeg === 'active'}">Faol · ${all.length}</button><button type="button" role="tab" data-st-seg="inactive" class="${stSeg === 'inactive' ? 'on' : ''}" aria-selected="${stSeg === 'inactive'}">Faol emas · ${inN}</button></div>
              ${stSeg === 'inactive' ? renderInactive() : `
              <div class="chips bq-chips">${chip('all', 'Hammasi')}${chip('att', "E'tibor kerak", cnt('att'))}${chip('struggling', 'Qiynalyapti', cnt('struggling'))}${chip('idle', 'Ilovaga kirmayapti', 0)}</div>
              ${!all.length ? empty(P.users, "Sizga hali o'quvchi biriktirilmagan", "Admin o'quvchi biriktirganda shu yerda paydo bo'ladi.")
                : list.length ? `<div class="card l a1">${list.map(stRow).join('')}</div>` : empty(P.search, 'Topilmadi', q ? `"${esc(stQ)}" bo'yicha o'quvchi yo'q.` : "Bu filtrda o'quvchi yo'q.", `<button type="button" class="btn sm" data-st-f="all" style="margin-top: 4px; min-height: 44px">Hammasini ko'rsatish</button>`)}`}
            </div>`;
        },
        bind(root) {
            root.querySelectorAll('[data-st-seg]').forEach(b => b.onclick = () => { stSeg = b.dataset.stSeg; U.render(); });
            root.querySelectorAll('[data-st-f]').forEach(b => b.onclick = () => { stF = b.dataset.stF; U.render(); });
            root.querySelector('[data-bq-reload]')?.addEventListener('click', () => U.reload());
            const inp = root.querySelector('#bq-q');
            if (inp) inp.oninput = () => { stQ = inp.value; const pos = inp.selectionStart; U.render(); const a = root.querySelector('#bq-q'); if (a) { a.focus(); a.setSelectionRange(pos, pos); } };
        }
    });

    // ─────────────────────────────────────────────────────────────────────
    // O'quvchi kartasi: Umumiy · Davomat · O'zlashtirish
    // ─────────────────────────────────────────────────────────────────────
    const cardTab = {};
    const groupsE = () => U.load('bq:groups', () => api('/api/school/my-groups'), { ttl: 600000 });
    const detailE = id => U.load('bq:det:' + id, () => api(`/api/academic/students/${encodeURIComponent(id)}`), { ttl: 300000 });
    const hrsMin = sec => { const m = Math.round((Number(sec) || 0) / 60), h = Math.floor(m / 60); return h ? `${h} soat${m % 60 ? ` ${m % 60} daq` : ''}` : `${m} daq`; };
    function mistakesAgg(det, k = 3) {
        const by = new Map();
        for (const l of (det?.lessons || []).slice().reverse().slice(0, 8)) for (const r of l.results || []) for (const m of r.mistakes || []) {
            const q = String(m.question || m.prompt || '').trim(); if (!q) continue;
            const key = q + '|' + (m.correctAnswer || '');
            const x = by.get(key) || { q, your: m.yourAnswer || '', ok: m.correctAnswer || '', n: 0 }; x.n++; by.set(key, x);
        }
        return [...by.values()].sort((a, b) => b.n - a.n).slice(0, k);
    }
    // "He ___ like football" + do → does : "He ~~do~~ → does like football"
    const mistakeText = m => {
        const fix = `${m.your ? `<s>${esc(m.your)}</s> → ` : ''}${esc(m.ok)}`;
        return /_{2,}/.test(m.q) ? esc(m.q).replace(/_{2,}/, fix) : `${esc(m.q)}${m.ok ? ` · ${fix}` : ''}`;
    };
    function kartaOz(s, det, de) {
        const pr = prog(s.id) || det?.student || {}, reached = reachedOf(s.id) || det?.student?.reached || 0;
        const ft = pr.firstTryAvg != null ? Math.round(pr.firstTryAvg) : null;
        const flags = (pr.flags || []).filter(f => f.key !== 'frozen');
        const weak = (det?.lessons || []).filter(l => (l.results || []).length).slice(-3).sort((a, b) => Math.min(...a.results.map(r => r.firstPercent ?? 100)) - Math.min(...b.results.map(r => r.firstPercent ?? 100)))[0];
        const lastTitle = flags.length ? flags.map(f => f.key === 'struggling' ? 'Qiynalyapti' : f.key === 'idle' ? 'Ilovaga kirmayapti' : f.key === 'behind' ? 'Orqada' : f.label).join(' · ') : '';
        const exams = (det?.exams || []).filter(e => e.examId || e.label), passed = exams.filter(e => e.passed).length, lastEx = exams[0];
        const n = D().now(), days14 = Array.from({ length: 14 }, (_, k) => U.addDays(n.date, k - 13)), tbd = det?.timeByDay || {};
        const mins = days14.map(d => Math.round((tbd[d] || 0) / 60)), maxM = Math.max(...mins, 1), act = mins.filter(Boolean).length;
        const pct = Math.round(reached / 72 * 100), mk = mistakesAgg(det);
        const note = flags.length ? `<div class="note w a3">${svg(P.flag, 18, 2).replace('<svg', '<svg style="flex: none; margin-top: 1px"')}<span><b>${esc(lastTitle)}:</b> ${esc(flags.map(f => f.label).join('; '))}${ft != null ? `. 1-urinish o'rtacha ${ft}%` : ''}.${weak && flags.some(f => f.key === 'struggling') ? ` Tavsiya — darsni ${weak.no}-mavzu takroridan boshlang.` : ''}</span></div>` : '';
        return `${note}
        <section class="card a3" style="gap: 12px">
          <div class="bq-g2">
            <div class="col"><span class="xs b">Erishgan dars</span><strong class="bq-k22">${reached}<span class="xs"> / 72</span></strong></div>
            <div class="col"><span class="xs b">1-urinish</span><strong class="bq-k22"${ft != null && ft < 70 ? ' style="color: #93370D"' : ''}>${ft != null ? ft + '%' : '—'}</strong></div>
            <div class="col"><span class="xs b">Faol vaqt · hafta</span><strong class="bq-k22">${pr.time?.week != null ? hrsMin(pr.time.week) : det ? hrsMin(days14.slice(-7).reduce((a, d) => a + (tbd[d] || 0), 0)) : '—'}</strong></div>
            <div class="col"><span class="xs b">Imtihon</span><strong class="bq-k22">${passed}<span class="xs"> / 6${lastEx?.scorePercent != null ? ' · ' + Math.round(lastEx.scorePercent) + '%' : ''}</span></strong></div>
          </div>
          <div class="col" style="gap: 8px"><div class="sh" style="padding: 0"><span class="xs b">Kurs yo'li · jonli darslar va imtihonlar</span><span class="xs">${pct}%</span></div><div class="bq-path" role="img" aria-label="Kurs yo'li ${pct}%, ${reached}-dars"><i style="width: ${pct}%"></i>${[1, 2, 3, 4, 5].map(k => `<b style="left: ${(k / 6 * 100).toFixed(1)}%"></b>`).join('')}</div></div>
          <div class="col" style="gap: 8px"><span class="xs b">14 kunlik faollik</span>${det ? `<div class="bq-bars" role="img" aria-label="So'nggi 14 kunda ${act} kun faol">${mins.map((m, k) => m ? `<i style="height: ${Math.max(8, Math.round(m / maxM * 100))}%${k === 13 ? '; background: #0065D6' : ''}"></i>` : '<i class="z"></i>').join('')}</div>` : loading(de, 'bq:det:' + s.id, 1, 44)}</div>
        </section>
        ${mk.length ? `<section class="card" style="gap: 6px"><h3 class="bq-h3">Oxirgi xatolar</h3>${mk.map(m => `<div class="row" style="justify-content: space-between"><span class="s">${mistakeText(m)}</span><span class="pill bad">×${m.n}</span></div>`).join('')}</section>` : det ? `<section class="card" style="gap: 6px"><h3 class="bq-h3">Oxirgi xatolar</h3><span class="s">Ilovada hali xato yo'q.</span></section>` : ''}`;
    }
    function kartaGen(s, det) {
        const n = D().now(), ms = D().monthStats(s, n.month), pr = prog(s.id) || {};
        const flags = (pr.flags || []).filter(f => f.key !== 'frozen').map(f => f.label);
        const warn = [...flags, ...(ms.kelmadi >= 2 ? [`${monName(n.month)}da ${ms.kelmadi} dars qoldirgan`] : [])];
        const g = (groupsE().data?.groups || []).find(x => x.student_id === s.id);
        const pc = ms.plan ? Math.round(ms.counted / ms.plan * 100) : 0;
        return `${warn.length ? `<div class="note w a3">${svg(P.flag, 18, 2).replace('<svg', '<svg style="flex: none; margin-top: 1px"')}<span><b>E'tibor:</b> ${esc(warn.join(' · '))}.</span></div>` : ''}
        <div class="kp a3"><div class="k"><span>Ilovada</span><strong>${reachedOf(s.id) || det?.student?.reached || 0}<span class="xs"> / 72</span></strong></div><div class="k"><span>1-urinish</span><strong>${pr.firstTryAvg != null ? Math.round(pr.firstTryAvg) + '%' : '—'}</strong></div><div class="k"><span>Faol · 7 kun</span><strong>${pr.activeDays7 ?? '—'}<span class="xs"> kun</span></strong></div></div>
        <section class="card" style="gap: 8px"><div class="sh" style="padding: 0"><h3 class="bq-h3">Davomat · ${monName(n.month)}</h3><a href="#" data-u-push="dv-oy" data-arg="${esc(s.id)}" style="font-size: 14px; font-weight: 700; min-height: 44px; display: inline-flex; align-items: center">Oylik jadval</a></div>
          <div class="row" style="gap: 10px"><div class="prog g1"><i class="g" style="width: ${pc}%"></i></div><b style="font-size: 14px">${ms.counted} / ${ms.plan}</b></div>
          <span class="s">${ms.keldi} keldi · ${ms.kelmadi} kelmadi · ${ms.approved} qoplandi${ms.review ? ' · ' + ms.review + ' tekshiruvda' : ''}${ms.empty.length ? ' · ' + ms.empty.length + ' belgilanmagan' : ''}</span></section>
        <section class="card l">
          <div class="li"><span class="s g1">Jadval</span><b style="font-size: 14px">${esc(sched(s))}</b></div>
          ${g?.name || s.group ? `<div class="li"><span class="s g1">Guruh</span><b style="font-size: 14px">${esc(g?.name || s.group)}</b></div>` : ''}
          ${s.startDate ? `<div class="li"><span class="s g1">Boshlagan</span><b style="font-size: 14px">${D().fmtDate(String(s.startDate).slice(0, 10))}</b></div>` : ''}
          <div class="li"><span class="s g1">Til</span><b style="font-size: 14px">${s.subject === 'russian' ? 'Rus tili' : 'Ingliz tili'}</b></div>
        </section>
        <span class="xs bq-foot">To'lov va sotuv ma'lumotlari ustozga ko'rsatilmaydi.</span>`;
    }
    function kartaDav(s) {
        const n = D().now(), ms = D().monthStats(s, n.month), days = D().lessonDays(s, n.month).map(c => c.date);
        const nextFut = days.find(d => d > n.date);
        const mks = (S().makeups || []).filter(m => m.student_id === s.id && D().day10(m.held_date).slice(0, 7) === n.month && m.kind === 'separate' && m.status !== 'rejected');
        const items = [...days.filter(d => d <= n.date || d === nextFut).map(d => ({ date: d, k: 'l' })), ...mks.map(m => ({ date: D().day10(m.held_date), k: 'm', m }))].sort((a, b) => b.date.localeCompare(a.date));
        const stName = { planned: 'rejada', review: 'tekshiruvda', approved: 'hisobga o\'tdi' };
        const endMin = (D().toMin(s.lessonTime) ?? 0) + dur(s);
        const rows = items.map(it => {
            const dl = `${D().DAY[D().wdOf(it.date) - 1]} ${D().fmtDate(it.date)}`;
            if (it.k === 'm') return `<div class="li"><div class="col g1"><span class="nm">${dl}</span><span class="s">qoplash · ${D().fmtDate(D().day10(it.m.missed_date))} o'rniga</span></div><span class="pill inf">${stName[it.m.status] || 'qoplash'}</span></div>`;
            const mk = D().markOf(s, it.date), cov = mk === 'absent' ? D().coveredBy(s, it.date) : null;
            const fut = it.date > n.date || (it.date === n.date && n.min < endMin && mk === 'empty');
            const pill = fut ? '<span class="pill mu">kutilmoqda</span>' : mk === 'present' ? '<span class="pill ok">keldi</span>' : mk === 'absent' ? `<span class="pill bad">kelmadi</span>` : '<span class="pill wa">belgilanmagan</span>';
            const sub = fut ? `${it.date === n.date ? 'bugun ' : ''}${esc(s.lessonTime || '')}` : mk === 'absent' ? (cov ? `qoplash ${stName[cov.status] || ''}` : 'qoplanmagan') : mk === 'present' ? esc(s.lessonTime || '') : 'davomatni belgilang';
            return `<div class="li"><div class="col g1"><span class="nm">${dl}</span><span class="s">${sub}</span></div>${pill}</div>`;
        }).join('');
        return `<div class="kp a3"><div class="k"><span>Hisobga o'tdi</span><strong>${ms.counted}<span class="xs"> / ${ms.plan}</span></strong></div><div class="k"><span>Kelmadi</span><strong>${ms.kelmadi}</strong></div><div class="k"><span>Qoplandi</span><strong>${ms.approved}</strong></div></div>
        <section class="card l">${rows || `<div class="li"><span class="s">Bu oy dars yo'q</span></div>`}</section>
        <a href="#" class="btn w" data-u-push="dv-oy" data-arg="${esc(s.id)}">${svg(P.check, 20, 2)}Oylik davomat va qoplash</a>`;
    }
    U.page('karta', {
        render(id) {
            const s = D().stuOf(id);
            if (!s) return `${bar()}<div class="bd nb">${empty(P.users, "O'quvchi topilmadi", "O'quvchi sizga biriktirilmagan yoki ro'yxatdan chiqarilgan.", `<button type="button" class="btn sm" data-u-go="oquvchilar" style="margin-top: 4px; min-height: 44px">O'quvchilar</button>`)}</div>`;
            const tab = cardTab[id] || 'gen', de = tab === 'dav' ? null : detailE(id), det = de?.data;
            const g = (groupsE().data?.groups || []).find(x => x.student_id === id);
            const n = D().now(), start = String(s.startDate || '').slice(0, 10), kun = start && start <= n.date ? dayDiff(start, n.date) + 1 : null;
            const reached = reachedOf(id) || det?.student?.reached || 0;
            const tgOk = g?.tg_link && /^https:\/\//.test(g.tg_link);
            const seg = `<div class="seg bq-seg44" role="tablist">${[['gen', 'Umumiy'], ['dav', 'Davomat'], ['oz', "O'zlashtirish"]].map(([k, l]) => `<button type="button" role="tab" data-ct="${k}" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>`;
            return `${bar()}
            <div class="bd nb" style="padding-top: 4px; gap: 12px">
              ${U.offline()}
              <div class="row a1">${D().avatar(s, 'av bq-a64')}<div class="col g1"><strong class="bq-name">${esc(s.name)}</strong><span class="s">ID ${esc(s.id)} · ${esc(sched(s))}</span><span class="xs" style="margin-top: 2px">Kurs: ${kun ? `${kun}-kun · ` : ''}${reached ? `${reached}-dars` : 'hali boshlanmagan'}</span></div></div>
              <div class="bq-act a2">
                ${tgOk ? `<a href="${esc(g.tg_link)}" target="_blank" rel="noopener">${svg(P.tg, 20, 2)}Dars guruhi</a>` : `<a href="#" data-bq-nogroup aria-disabled="true" class="bq-off">${svg(P.tg, 20, 2)}Dars guruhi</a>`}
                <a href="#" data-u-push="sorov" data-arg="${esc(s.id)}">${svg(P.msg, 20, 2)}Adminga so'rov</a>
                <a href="#" data-u-push="dv-oy" data-arg="${esc(s.id)}">${svg(P.check, 20, 2)}Davomat</a>
              </div>
              ${seg}
              ${tab === 'oz' ? kartaOz(s, det, de) : tab === 'dav' ? kartaDav(s) : kartaGen(s, det)}
            </div>`;
        },
        bind(root, id) {
            root.querySelectorAll('[data-ct]').forEach(b => b.onclick = () => { cardTab[id] = b.dataset.ct; U.render(); });
            root.querySelector('[data-bq-nogroup]')?.addEventListener('click', e => { e.preventDefault(); U.toast(groupsE().loading ? 'Yuklanmoqda…' : "Guruh havolasi hali kiritilmagan — adminga yozing"); });
        }
    });

    // ─────────────────────────────────────────────────────────────────────
    // Adminga so'rov (POST /api/school/requests {type:'student', studentId, topic, reason})
    // ─────────────────────────────────────────────────────────────────────
    const SQ = [['schedule', 'Dars vaqti yoki kunlari', 'masalan 16:30 → 18:00 yoki Du·Ch·Ju → Se·Pa·Sh'], ['freeze', 'Muzlatish', "o'quvchi vaqtincha to'xtatmoqchi"], ['teacher', 'Ustoz almashtirish', "o'quvchi yoki ota-ona so'radi"], ['other', 'Boshqa', 'admin hal qiladi']];
    const SQL = Object.fromEntries(SQ.map(t => [t[0], t[1]]));
    let sqTopic = 'schedule', sqStu = '', sqBusy = false;
    const payOf = r => typeof r.payload === 'string' ? (() => { try { return JSON.parse(r.payload); } catch { return {}; } })() : (r.payload || {});
    const myReqs = () => (S().requests || []).filter(r => r.type === 'student');
    const waiting = () => myReqs().filter(r => !['approved', 'rejected'].includes(r.status));
    const reqPill = r => r.status === 'approved' ? '<span class="pill ok">Hal qilindi</span>' : r.status === 'rejected' ? '<span class="pill bad">Rad etildi</span>' : '<span class="pill wa">Kutilmoqda</span>';
    U.page('sorov', {
        render(id) {
            const sid = id || sqStu, s = sid ? D().stuOf(sid) : null;
            const mine = myReqs().filter(r => !id || payOf(r).studentId === id);
            return `${bar()}
            <div class="bd nb" style="padding-top: 0; gap: 12px">
              ${U.offline()}
              <div class="col" style="padding: 0 4px"><h1 class="ttl" style="padding: 0">Adminga so'rov</h1><span class="s">${s ? `${esc(s.name)} · ${esc(sched(s))}` : "O'quvchi bo'yicha — admin CRM'da hal qiladi"}</span></div>
              ${!id ? `<div class="fl"><label for="bq-sqs">O'quvchi</label><select id="bq-sqs" class="bq-sel"><option value="">Tanlang</option>${(S().main || []).map(x => `<option value="${esc(x.id)}"${x.id === sqStu ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>` : ''}
              <fieldset class="bq-fs"><legend class="bq-lg">Nima kerak?</legend>${SQ.map(([k, l, d]) => `<button type="button" class="opt${k === sqTopic ? ' on' : ''}" data-sq="${k}" aria-pressed="${k === sqTopic}"><span class="rad"></span><span class="col g1"><b style="font-size: 15px">${l}</b><span class="xs">${esc(d)}</span></span></button>`).join('')}</fieldset>
              <div class="fl"><label for="bq-sqz">Izoh</label><textarea id="bq-sqz" maxlength="300" placeholder="qisqacha: nima va qachondan"></textarea></div>
              <button type="button" class="btn p w" data-sqsend${sqBusy ? ' disabled' : ''}>Yuborish</button>
              <span class="xs bq-foot">O'z ish vaqtingizni yopish yoki sinovga tanaffus — Jadval bo'limida.</span>
              ${mine.length ? `<span class="bq-gh">YUBORILGANLAR · ${mine.length}</span><div class="card l">${mine.map(r => { const p = payOf(r), st = D().stuOf(p.studentId); return `<div class="li"><div class="col g1"><span class="nm">${esc(SQL[p.topic] || "So'rov")}${!id && st ? ' · ' + esc(D().first(st.name)) : ''}</span><span class="s" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${esc(r.reason || '')}${r.decision_note ? ' · ' + esc(r.decision_note) : ''}</span></div>${reqPill(r)}</div>`; }).join('')}</div>` : ''}
            </div>`;
        },
        bind(root, id) {
            root.querySelectorAll('[data-sq]').forEach(b => b.onclick = () => { sqTopic = b.dataset.sq; root.querySelectorAll('[data-sq]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); });
            const sel = root.querySelector('#bq-sqs'); if (sel) sel.onchange = () => { sqStu = sel.value; };
            const btn = root.querySelector('[data-sqsend]');
            btn.onclick = async () => {
                const sid = id || sqStu, note = root.querySelector('#bq-sqz').value.trim();
                if (!sid) return U.toast("O'quvchini tanlang");
                if (note.length < 3) return U.toast('Izohni yozing');
                sqBusy = true; btn.disabled = true;
                try {
                    const r = await api('/api/school/requests', { method: 'POST', body: { type: 'student', studentId: sid, topic: sqTopic, reason: note } });
                    S().requests = [r.request || { id: 'tmp' + Date.now(), type: 'student', status: 'new', reason: note, payload: { studentId: sid, topic: sqTopic } }, ...(S().requests || [])];
                    sqBusy = false; U.toast("So'rov adminga yuborildi", { ok: true }); U.render();
                } catch (err) { sqBusy = false; btn.disabled = false; U.toast(err.message); }
            };
        }
    });

    // ─────────────────────────────────────────────────────────────────────
    // Darslik (72 dars) — /api/academic/hub; bugungi jonli darslar — /api/academic/next-lessons
    // ─────────────────────────────────────────────────────────────────────
    const hubE = () => U.load('bq:hub', () => api('/api/academic/hub'), { ttl: 600000 });
    const nextE = () => { const ids = (S().main || []).filter(s => !s.frozen).map(s => s.id); return U.load('bq:next', () => ids.length ? api(`/api/academic/next-lessons?ids=${encodeURIComponent(ids.join(','))}`) : Promise.resolve({ lessons: {} }), { ttl: 300000 }); };
    // Bugun dars bor o'quvchilar (dars tugamagan) va ularning navbatdagi jonli darsi.
    function todayLive() {
        const n = D().now(), nx = nextE().data?.lessons || {};
        return (S().main || []).filter(s => !s.frozen && D().lessonDays(s, n.month).some(c => c.date === n.date))
            .map(s => ({ s, t: D().toMin(s.lessonTime) ?? 0, l: nx[s.id]?.nextLive || null }))
            .sort((a, b) => a.t - b.t);
    }
    const isExam = no => no % 12 === 0;
    const bookOf = no => Math.ceil(no / 24);
    let dkBook = 0, dkScrolled = false;
    const lessonSub = l => {
        if (isExam(l.no)) return 'ilovada avtomatik tekshiriladi';
        const c = l.counts || {};
        return [c.slides ? `${c.slides} slayd` : '', c.video ? 'video' : '', c.vocab ? `${c.vocab} so'z` : '', c.dialogs ? `${c.dialogs} audio` : ''].filter(Boolean).join(' · ') || (l.type === 'live' ? 'Jonli dars' : 'Videodars');
    };
    U.page('darslik', {
        render() {
            const he = hubE(), hub = he.data, n = D().now();
            const today = todayLive(), ahead = today.filter(x => x.t + dur(x.s) > n.min && x.l);
            const todayNos = new Set(today.map(x => x.l?.no).filter(Boolean));
            if (!dkBook) dkBook = ahead[0]?.l ? bookOf(ahead[0].l.no) : today.find(x => x.l) ? bookOf(today.find(x => x.l).l.no) : 1;
            const lessons = (hub?.syllabus || []).filter(l => bookOf(l.no) === dkBook);
            const tb = (hub?.courseMaterials || []).some(m => m.kind === 'teacher_book');
            return `${bar()}
            <div class="bd nb" style="padding-top: 0; gap: 10px">
              ${U.offline()}
              <div class="col" style="padding: 0 4px"><h1 class="ttl" style="padding: 0">Darslik</h1><span class="s">${esc(hub?.course?.name || langOf())} · ${hub?.syllabus?.length || 72} dars · 3 kitob${tb ? ' · Ustoz kitobi' : ''}</span></div>
              ${ahead.length ? `<section class="blue a1">${U.HEX('bqDkHex').replace('class="hex"', 'class="hex bq-hex12"')}
                <span class="bq-eb">BUGUN OLDINDA · ${ahead.length} DARS</span>
                <div class="bq-tcs">${ahead.map(x => `<a class="bq-tc" href="#" data-u-push="darshub" data-arg="${x.l.no}"><b style="font-size: 15px">${x.l.no} · ${esc(x.l.name || '')}</b><span style="font-size: 12px; color: #DCEBFF">${esc(D().first(x.s.name))} · ${esc(x.s.lessonTime || '')}</span></a>`).join('')}</div>
              </section>` : ''}
              <div class="seg bq-seg44" role="tablist">${[1, 2, 3].map(b => `<button type="button" role="tab" data-dk="${b}" class="${dkBook === b ? 'on' : ''}" aria-selected="${dkBook === b}">${b}-kitob${dkBook === b ? ` · ${(b - 1) * 24 + 1}–${b * 24}` : ''}</button>`).join('')}</div>
              ${!hub ? loading(he, 'bq:hub', 4, 58) : `<div class="card l a2">${lessons.map(l => {
                  const td = todayNos.has(l.no), ex = isExam(l.no);
                  return `<a class="li" href="#" data-u-push="darshub" data-arg="${l.no}"${td ? ' data-bq-today' : ''}><span class="bq-num${ex ? ' ex' : td ? ' td' : ''}">${l.no}</span><div class="col g1"><span class="nm">${esc(l.name || `${l.no}-dars`)}</span><span class="s">${esc(lessonSub(l))}</span></div>${td ? '<span class="pill inf">Bugun</span>' : ex ? '<span class="pill wa">Imtihon</span>' : chevR()}</a>`;
              }).join('')}</div>`}
            </div>`;
        },
        bind(root) {
            root.querySelectorAll('[data-dk]').forEach(b => b.onclick = () => { dkBook = +b.dataset.dk; dkScrolled = true; U.render(); });
            const t = root.querySelector('[data-bq-today]'), bd = root.querySelector('.bd');
            if (t && bd && !dkScrolled) { dkScrolled = true; requestAnimationFrame(() => { bd.scrollTop = Math.max(0, t.offsetTop - bd.offsetTop - 3 * t.offsetHeight - 260); }); }
        }
    });

    // Dars materiallari (DarsHub) — /api/academic/lessons/:no
    const lessonE = no => U.load('bq:les:' + no, () => api(`/api/academic/lessons/${encodeURIComponent(no)}`), { ttl: 600000 });
    const hubTab = {};
    const safeUrl = u => /^(\/|https:\/\/)/.test(String(u || '')) ? String(u) : '';
    U.page('darshub', {
        render(arg) {
            const no = Number(arg) || 1, le = lessonE(no), d = le.data, L = d?.lesson;
            const n = D().now(), today = todayLive().filter(x => x.l?.no === no);
            const hw = L?.homework || [], gram = (d?.materials || []).filter(m => m.kind === 'grammar_slides');
            const tab = hubTab[no] || 'sl';
            const chips = [['sl', 'Slaydlar', L?.slides?.length || 0], ['vd', 'Video', L?.videoUrl ? 1 : 0], ['gr', 'Grammatika', gram.length + (L?.konspekt ? 1 : 0)], ['sz', "So'zlar", L?.vocabulary?.length || 0], ['au', 'Audio', L?.audioDialogs?.length || 0], ['vz', 'Vazifa', hw.length]];
            const linkRow = (cls, icon, title, sub, url, attr = '') => `<a class="bq-doc li" ${url ? `href="${esc(url)}" target="_blank" rel="noopener"` : `href="#" ${attr}`}><span class="bq-ic ${cls}">${svg(icon, 20, 2)}</span><div class="col g1"><span class="nm">${title}</span><span class="s">${sub}</span></div></a>`;
            let body = '';
            if (L) {
                if (tab === 'sl') {
                    const sl = L.slides || [], show = sl.length > 9 ? sl.slice(0, 8) : sl;
                    body = sl.length ? `<div class="bq-sls a2">${show.map((x, i) => { const img = safeUrl(x.imageUrl); return `<a class="bq-sl${i === 0 && !img ? ' f' : ''}" href="#" data-u-push="taqdimot" data-arg="${no}-${i}"${img ? ` style="background-image: url('${esc(img)}')"` : ''}><i>${i + 1}</i>${img ? '' : esc(x.title || `${i + 1}-slayd`)}</a>`; }).join('')}${sl.length > 9 ? `<a class="bq-sl m" href="#" data-u-push="taqdimot" data-arg="${no}-8">+${sl.length - 8} slayd</a>` : ''}</div>`
                        : empty(P.file, "Ilovada slayd yo'q", 'Taqdimotda so\'z kartochkalari va toza doska ochiladi.');
                } else if (tab === 'vd') body = L.videoUrl ? `<section class="card l">${linkRow('inf', P.play, 'Dars videosi', 'yangi oynada ochiladi', safeUrl(L.videoUrl))}</section>` : empty(P.play, "Video yo'q", '');
                else if (tab === 'gr') body = `${L.konspekt ? `<section class="card"><h3 class="bq-h3">Konspekt</h3><span class="s" style="white-space: pre-line">${esc(L.konspekt)}</span></section>` : ''}${gram.length ? `<section class="card l">${gram.map(m => linkRow('vio', P.file, esc(m.title || m.kindLabel), esc(m.kindLabel || 'Grammatika'), safeUrl(m.url))).join('')}</section>` : ''}` || empty(P.file, "Grammatika materiali yo'q", '');
                else if (tab === 'sz') body = L.vocabulary?.length ? `<section class="card l">${L.vocabulary.map(v => `<div class="li"><div class="col g1"><span class="nm">${esc(v.word)}</span><span class="s">${esc(v.translation || '')}${v.transcript ? ' · ' + esc(v.transcript) : ''}</span></div></div>`).join('')}</section>` : empty(P.book, "So'zlar yo'q", '');
                else if (tab === 'au') body = L.audioDialogs?.length ? `<section class="card l">${L.audioDialogs.map(a => `<div class="li" style="flex-direction: column; align-items: stretch; gap: 6px"><span class="nm">${esc(a.title || 'Audio')}${a.durationSec ? ` · ${Math.floor(a.durationSec / 60)}:${String(a.durationSec % 60).padStart(2, '0')}` : ''}</span>${safeUrl(a.audioUrl) ? `<audio controls preload="none" src="${esc(safeUrl(a.audioUrl))}" style="width: 100%; height: 40px"></audio>` : ''}</div>`).join('')}</section>` : empty(P.audio, "Audio yo'q", '');
                else body = hw.length ? `<section class="card l">${hw.map((h, i) => `<div class="li"><span class="bq-num sm">${i + 1}</span><div class="col g1"><span class="nm">${esc(h.title || h.kind)}</span><span class="s">${h.questions ? h.questions + ' savol · ' : ''}${h.teacherGraded ? 'ustoz tekshiradi' : 'avtomatik tekshiriladi'}</span></div></div>`).join('')}</section>` : empty(P.task, "Uy vazifasi yo'q", '');
            }
            const guide = (d?.guides || []).find(g => g.kind === 'teacher_book') || (d?.guides || [])[0];
            const docs = L ? `<section class="card l a3">
                ${guide ? linkRow('wa', P.bookOpen, `Ustoz kitobi · ${esc(guide.page)}-bet`, 'dars rejasi va javoblar', safeUrl(guide.url)) : ''}
                ${d.book ? linkRow('inf', P.file, `Darslik PDF${d.book.page ? ` · ${esc(d.book.page)}-bet` : ''}`, "o'quvchi kitobi", safeUrl(d.book.url)) : ''}
                ${(d.materials || []).filter(m => m.kind !== 'grammar_slides').map(m => linkRow('mu', P.file, esc(m.title || m.fileName || ''), esc(m.kindLabel || m.kind || 'fayl'), safeUrl(m.url))).join('')}
                ${hw.length ? linkRow('ok', P.task, `Uy vazifasi · ${hw.length} ta mashq`, hw.some(h => h.teacherGraded) ? `${hw.filter(h => h.teacherGraded).length} tasini ustoz tekshiradi` : 'ilovada avtomatik tekshiriladi', '', 'data-bq-hw') : ''}
              </section>` : '';
            const plan = L?.plan;
            return `${bar('', `<span class="pill inf" style="margin-right: 8px">${bookOf(no)}-kitob${d?.book?.page ? ` · ${esc(d.book.page)}-bet` : ''}</span>`)}
            <div class="bd nb" style="padding-top: 0; gap: 12px">
              ${U.offline()}
              <div class="col" style="padding: 0 4px"><span class="xs b bq-ey">${no}-DARS · ${no % 2 ? 'VIDEODARS' : 'JONLI DARS'}</span><h1 class="ttl" style="padding: 0">${esc(L?.name || `${no}-dars`)}</h1>${today.length ? `<span class="s">Bugun: ${today.map(x => `${esc(D().first(x.s.name))} ${esc(x.s.lessonTime || '')}`).join(', ')}</span>` : L?.topic ? `<span class="s">${esc(L.topic)}</span>` : ''}</div>
              <a href="#" class="btn p w a1 bq-start" data-u-push="taqdimot" data-arg="${no}"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${P.play}</svg>Taqdimotni boshlash</a>
              ${!d ? loading(le, 'bq:les:' + no, 3, 72) : `
              <div class="chips bq-chips">${chips.map(([k, l, c]) => `<button type="button" class="chip${tab === k ? ' on' : ''}" data-ht="${k}" aria-pressed="${tab === k}">${l} <b class="bq-cb">${c}</b></button>`).join('')}</div>
              ${body}
              ${docs}
              ${plan?.blocks?.length ? `<section class="card" style="gap: 8px"><h3 class="bq-h3">Dars rejasi</h3>${plan.goal ? `<span class="s"><b>Maqsad:</b> ${esc(plan.goal)}</span>` : ''}${plan.blocks.map(b => `<div class="col" style="gap: 2px; padding-top: 6px; border-top: 1px solid #EEF2F8"><span class="xs b" style="color: #0057B8">${esc(b.when || '')}</span><b style="font-size: 14px">${esc(b.title || '')}</b>${(b.items || []).map(i => `<span class="s">· ${esc(i)}</span>`).join('')}${b.tip ? `<span class="xs">${esc(b.tip)}</span>` : ''}</div>`).join('')}</section>` : ''}`}
            </div>`;
        },
        bind(root, arg) {
            const no = Number(arg) || 1;
            root.querySelectorAll('[data-ht]').forEach(b => b.onclick = () => { hubTab[no] = b.dataset.ht; U.render(); });
            root.querySelector('[data-bq-hw]')?.addEventListener('click', e => { e.preventDefault(); hubTab[no] = 'vz'; U.render(); });
        }
    });

    // ─────────────────────────────────────────────────────────────────────
    // Taqdimot — slaydlar va doska (yotiq). Telefon tik bo'lsa ekran 90° buriladi.
    // ─────────────────────────────────────────────────────────────────────
    const TQ = { key: '', idx: 0, tool: 'pen', color: '#F04438', ink: {}, hist: {}, t0: 0, timer: null };
    function tqSlides(L) {
        const out = [];
        for (const s of L?.slides || []) out.push(safeUrl(s.imageUrl) ? { k: 'img', url: safeUrl(s.imageUrl), title: s.title || '' } : { k: 'text', title: s.title || '', body: s.body || '' });
        if (!out.length) for (const w of (L?.vocabulary || []).slice(0, 30)) out.push({ k: 'word', w });
        out.push({ k: 'blank', title: 'Toza doska' });
        return out;
    }
    function tqSlideHtml(x, L) {
        if (x.k === 'img') return `<img src="${esc(x.url)}" alt="${esc(x.title)}" class="bq-tq-img">`;
        if (x.k === 'word') return `<div class="bq-tq-word"><span class="bq-tq-ey">SO'Z</span><b>${esc(x.w.word)}</b>${x.w.transcript ? `<span>${esc(x.w.transcript)}</span>` : ''}<span class="bq-tq-tr">${esc(x.w.translation || '')}</span></div>`;
        if (x.k === 'blank') return '';
        const lines = String(x.body || '').split(/\n+/).map(t => t.trim()).filter(Boolean);
        return `<span class="bq-tq-ey">${L?.type === 'video' ? 'VIDEODARS' : 'JONLI DARS'}</span><h2 class="bq-tq-h">${esc(x.title)}</h2>${lines.length ? `<div class="bq-tq-grid${lines.length > 3 ? ' two' : ''}">${lines.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}`;
    }
    const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
    U.page('taqdimot', {
        render(arg) {
            const [noS, iS] = String(arg || '').split('-'), no = Number(noS) || 0;
            const key = String(no);
            if (TQ.key !== key) { TQ.key = key; TQ.idx = Number(iS) || 0; TQ.ink = {}; TQ.hist = {}; TQ.t0 = Date.now(); }
            const le = no ? lessonE(no) : null, L = le?.data?.lesson;
            const slides = no && !L ? [] : tqSlides(L);
            TQ.idx = Math.min(TQ.idx, Math.max(0, slides.length - 1));
            const x = slides[TQ.idx];
            const tools = [['pen', 'Qalam', P.pen], ['marker', 'Marker', P.marker], ['text', 'Matn', P.text], ['eraser', "O'chirg'ich", P.eraser]];
            const title = no ? `${no} · ${L?.name || `${no}-dars`}` : 'Doska';
            return `<div class="bq-tq" role="dialog" aria-modal="true" aria-label="${esc(title)}">
              <div class="bq-tq-main">
                <div class="bq-tq-top"><a href="#" class="bq-nb2" data-u-back aria-label="Taqdimotni yopish">${svg(P.x, 18, 2.4)}</a><b class="bq-tq-ttl">${esc(title)}</b><span class="bq-tq-cnt">${slides.length ? `${TQ.idx + 1} / ${slides.length}` : ''}</span><span style="flex: 1"></span>${navigator.onLine === false ? '<span class="pill bad">Internet yo\'q</span>' : ''}<b class="bq-tq-time" aria-label="Dars vaqti">${mmss(Date.now() - TQ.t0)}</b></div>
                <div class="bq-tq-stage${x?.k === 'blank' ? ' blank' : ''}">${no && !L ? (le.err ? `<div class="bq-tq-msg">${esc(le.err.message || 'Yuklanmadi')}<button type="button" class="btn sm" data-u-retry="bq:les:${no}">Qayta urinish</button></div>` : '<div class="bq-tq-msg">Yuklanmoqda…</div>') : `<div class="bq-tq-slide${x?.k === 'img' ? ' img' : ''}">${x ? tqSlideHtml(x, L) : ''}</div>`}<canvas class="bq-tq-ink" aria-hidden="true"></canvas></div>
                <div class="bq-tq-bot"><button type="button" class="bq-nb2" data-tq="-1" aria-label="Oldingi slayd"${TQ.idx <= 0 ? ' disabled' : ''}>${svg(P.back, 20, 2.4)}</button><div class="bq-tq-pr"><div style="width: ${slides.length ? Math.round((TQ.idx + 1) / slides.length * 100) : 0}%"></div></div><button type="button" class="bq-nb2 p" data-tq="1" aria-label="Keyingi slayd"${TQ.idx >= slides.length - 1 ? ' disabled' : ''}>${svg(P.chev, 20, 2.4)}</button></div>
              </div>
              <div role="toolbar" aria-label="Doska asboblari" class="bq-tq-tools">
                ${tools.map(([k, l, d]) => `<button type="button" class="bq-tb${TQ.tool === k ? ' on' : ''}" data-tool="${k}" aria-label="${l}" aria-pressed="${TQ.tool === k}">${svg(d, 20, 2)}</button>`).join('')}
                <span class="bq-tq-sep"></span>
                ${[['#F04438', 'Qizil rang'], ['#3B8BEE', "Ko'k rang"]].map(([c, l]) => `<button type="button" class="bq-tb" data-color="${c}" aria-label="${l}" aria-pressed="${TQ.color === c}"><span class="bq-sw" style="background: ${c}${TQ.color === c ? '; border-color: #FFFFFF' : ''}"></span></button>`).join('')}
                <span style="flex: 1"></span>
                <button type="button" class="bq-tb" data-undo aria-label="Bekor qilish">${svg(P.undo, 20, 2)}</button>
              </div>
            </div>`;
        },
        bind(root) {
            const el = root.querySelector('.bq-tq'); if (!el) return;
            const go = d => { TQ.idx += d; U.render(); };
            el.querySelectorAll('[data-tq]').forEach(b => b.onclick = () => go(+b.dataset.tq));
            el.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { TQ.tool = b.dataset.tool; U.render(); });
            el.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { TQ.color = b.dataset.color; if (TQ.tool === 'eraser') TQ.tool = 'pen'; U.render(); });
            // Vaqt (dars davomiyligi) — har soniya
            clearInterval(TQ.timer);
            TQ.timer = setInterval(() => { const t = document.querySelector('.bq-tq-time'); if (!t) return clearInterval(TQ.timer); t.textContent = mmss(Date.now() - TQ.t0); }, 1000);
            const onKey = e => { if (!document.querySelector('.bq-tq')) return document.removeEventListener('keydown', onKey); if (e.target.closest?.('input')) return; if (e.key === 'ArrowRight' && !el.querySelector('[data-tq="1"]').disabled) go(1); if (e.key === 'ArrowLeft' && !el.querySelector('[data-tq="-1"]').disabled) go(-1); };
            document.removeEventListener('keydown', TQ.onKey || (() => {})); TQ.onKey = onKey; document.addEventListener('keydown', onKey);
            // Doska qatlami: chiziqlar normallashtirilgan (0..1) koordinatada, har slayd uchun alohida.
            const stage = el.querySelector('.bq-tq-stage'), cv = el.querySelector('.bq-tq-ink');
            const ink = TQ.ink[TQ.idx] ||= [], hist = TQ.hist[TQ.idx] ||= [];
            const W = () => stage.offsetWidth, H = () => stage.offsetHeight;
            const size = () => { const dpr = window.devicePixelRatio || 1; cv.width = Math.round(W() * dpr); cv.height = Math.round(H() * dpr); cv.style.width = W() + 'px'; cv.style.height = H() + 'px'; draw(); };
            function draw() {
                const c = cv.getContext('2d'), dpr = window.devicePixelRatio || 1, w = W(), h = H();
                c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
                for (const s of ink) {
                    if (s.t === 'text') { c.globalAlpha = 1; c.fillStyle = s.c; c.font = "700 22px 'Plus Jakarta Sans', system-ui, sans-serif"; c.fillText(s.s, s.x * w, s.y * h); continue; }
                    c.globalAlpha = s.t === 'marker' ? 0.35 : 1; c.strokeStyle = s.c; c.lineWidth = s.t === 'marker' ? 18 : 4; c.lineCap = 'round'; c.lineJoin = 'round';
                    c.beginPath(); s.p.forEach(([px, py], i) => i ? c.lineTo(px * w, py * h) : c.moveTo(px * w, py * h)); if (s.p.length === 1) c.lineTo(s.p[0][0] * w + 0.1, s.p[0][1] * h); c.stroke();
                }
                c.globalAlpha = 1;
            }
            // Ekran 90° burilgan bo'lsa (tik telefon) ko'rsatkich koordinatasini qatlam koordinatasiga o'giramiz.
            const rotated = () => matchMedia('(orientation: portrait)').matches;
            const pt = e => { const r = cv.getBoundingClientRect(); return rotated() ? [(e.clientY - r.top) / r.height, (r.right - e.clientX) / r.width] : [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
            let cur = null;
            const erase = p => { const w = W(), h = H(); for (let i = ink.length - 1; i >= 0; i--) { const s = ink[i]; const pts = s.t === 'text' ? [[s.x, s.y]] : s.p; if (pts.some(([x, y]) => Math.hypot((x - p[0]) * w, (y - p[1]) * h) < 16)) { hist.push(ink.slice()); ink.splice(i, 1); draw(); } } };
            cv.onpointerdown = e => {
                e.preventDefault(); const p = pt(e);
                if (TQ.tool === 'text') return placeText(p);
                cv.setPointerCapture?.(e.pointerId);
                if (TQ.tool === 'eraser') { cur = { t: 'eraser' }; erase(p); return; }
                hist.push(ink.slice()); cur = { t: TQ.tool, c: TQ.color, p: [p] }; ink.push(cur); draw();
            };
            cv.onpointermove = e => { if (!cur) return; const p = pt(e); if (cur.t === 'eraser') erase(p); else { cur.p.push(p); draw(); } };
            cv.onpointerup = cv.onpointercancel = () => { cur = null; };
            function placeText(p) {
                const inp = document.createElement('input'); inp.className = 'bq-tq-in'; inp.setAttribute('aria-label', 'Doskaga matn');
                inp.style.left = (p[0] * 100) + '%'; inp.style.top = (p[1] * 100) + '%'; inp.style.color = TQ.color;
                stage.appendChild(inp); inp.focus();
                let done = false;
                const commit = () => { if (done) return; done = true; const v = inp.value.trim(); inp.remove(); if (v) { hist.push(ink.slice()); ink.push({ t: 'text', c: TQ.color, s: v, x: p[0], y: p[1] + 0.04 }); draw(); } };
                inp.onkeydown = ev => { if (ev.key === 'Enter') commit(); if (ev.key === 'Escape') { done = true; inp.remove(); } };
                inp.onblur = commit;
            }
            el.querySelector('[data-undo]').onclick = () => { if (!hist.length) return U.toast("Bekor qiladigan narsa yo'q"); const prev = hist.pop(); ink.splice(0, ink.length, ...prev); draw(); };
            requestAnimationFrame(size);
            window.removeEventListener('resize', TQ.onResize || (() => {})); TQ.onResize = () => { if (document.querySelector('.bq-tq')) size(); }; window.addEventListener('resize', TQ.onResize);
        }
    });

    // ─────────────────────────────────────────────────────────────────────
    // Maosh — /api/payroll/me. Qoida: stavka ÷ o'quvchining oylik darslari × o'tilgan darslar;
    // oy 1-sanada yopiladi, e'tiroz 4-sanagacha, 5-sanada to'lanadi.
    // ─────────────────────────────────────────────────────────────────────
    const RATE = { 15: 75000, 30: 150000, 60: 300000 };
    let msMonth = '';
    function payGroups(month) {
        const g = {};
        for (const s of S().main || []) {
            const m = D().monthStats(s, month); if (!m.plan) continue;
            const d = dur(s), x = g[d] ||= { d, n: 0, c: 0, p: 0, sum: 0 };
            x.n++; x.c += m.counted; x.p += m.plan; x.sum += Math.round((RATE[d] || 0) * m.counted / m.plan);
        }
        return Object.values(g).sort((a, b) => b.d - a.d);
    }
    const histOf = month => (S().salary?.history || []).find(h => String(h.start || '').slice(0, 7) === month) || null;
    function histSheet() {
        const h = S().salary?.history || [];
        U.sheet(`${sheetHead("Maosh tarixi", "So'nggi 12 oy")}<div class="card l" style="border: 0; padding: 0">${h.map(x => { const m = String(x.start).slice(0, 7), paid = x.paidAt || x.status === 'paid'; return `<div class="li"><div class="col g1"><span class="nm">${cap1(monName(m))} ${m.slice(0, 4)}</span><span class="s">${paid ? `to'langan${x.paidAt ? ' · ' + D().fmtDate(D().tz(x.paidAt).date) : ''}` : 'hisoblangan · to\'lov kutilmoqda'}</span></div><b style="font-size: 15px">${D().money(x.amount)}</b></div>`; }).join('') || '<div class="li"><span class="s">Hali to\'langan oy yo\'q</span></div>'}</div>`, null, { label: 'Maosh tarixi' });
    }
    U.page('maosh', {
        render() {
            const sal = S().salary, n = D().now(), cur = n.month, prev = D().shiftMonth(cur, -1);
            if (!msMonth) msMonth = n.day <= 5 ? prev : cur;
            const isCur = msMonth === cur, next = D().shiftMonth(msMonth, 1), nm = monName(next);
            const h = histOf(msMonth), paid = !!(h && (h.paidAt || h.status === 'paid'));
            const groups = payGroups(msMonth), tot = groups.reduce((a, g) => ({ c: a.c + g.c, p: a.p + g.p, sum: a.sum + g.sum }), { c: 0, p: 0, sum: 0 });
            const amount = isCur ? sal?.current?.total ?? null : h ? h.amount : tot.sum;
            const estimate = !isCur && !h;
            const prevAmt = isCur ? histOf(prev)?.amount : histOf(D().shiftMonth(msMonth, -1))?.amount;
            const delta = amount && prevAmt ? Math.round((amount - prevAmt) / prevAmt * 100) : null;
            const d1 = `${next}-01`, d4 = `${next}-04`, d5 = `${next}-05`, t = n.date;
            const pill = isCur ? `Oy yopilishiga ${Math.max(0, dayDiff(t, d1))} kun` : paid ? `To'landi${h.paidAt ? ' · ' + D().fmtDate(D().tz(h.paidAt).date) : ''}` : t < d5 ? `${dayDiff(t, d5)} kun qoldi` : t === d5 ? "Bugun to'lanadi" : 'Kutilmoqda';
            const st1 = t >= d1 ? 'd' : '', st2 = t > d4 ? 'd' : t >= d1 ? 'n' : '', st3 = paid ? 'd' : t >= d5 ? 'n' : '';
            const hist = (sal?.history || []).filter(x => String(x.start || '').slice(0, 7) < cur).slice(0, 5).reverse().map(x => ({ m: String(x.start).slice(0, 7), v: Number(x.amount) || 0 }));
            const pts = [...hist, ...(sal?.current?.total != null ? [{ m: cur, v: sal.current.total, cur: true }] : [])];
            const maxV = Math.max(...pts.map(p => p.v), 1), sel = pts.some(p => p.m === msMonth) ? msMonth : pts[pts.length - 1]?.m;
            const unc = isCur ? (S().main || []).reduce((a, s) => a + D().uncovered(s).length, 0) : 0;
            return `${bar()}
            <div class="bd nb" style="padding-top: 0; gap: 12px">
              ${U.offline()}
              <h1 class="ttl">Maosh</h1>
              <div class="seg bq-seg44" role="tablist"><button type="button" role="tab" data-ms="${prev}" class="${!isCur ? 'on' : ''}" aria-selected="${!isCur}">${cap1(monName(prev))} · ${histOf(prev)?.paidAt || histOf(prev)?.status === 'paid' ? "to'landi" : t >= `${cur}-01` ? 'yopildi' : 'joriy'}</button><button type="button" role="tab" data-ms="${cur}" class="${isCur ? 'on' : ''}" aria-selected="${isCur}">${cap1(monName(cur))} · joriy</button></div>
              ${!sal ? `<div class="note w" role="alert"><span>Maosh ma'lumoti yuklanmadi.</span><button type="button" class="btn sm" data-bq-reload style="margin-left: auto">Qayta urinish</button></div>`
                : sal.linked === false ? `<div class="note w"><span>Akkauntingiz HR profiliga biriktirilmagan — maosh ko'rinmaydi. Administratorga murojaat qiling.</span></div>` : `
              <section class="blue a1">
                <span class="bq-shn" aria-hidden="true"></span>${U.HEX('bqMsHex').replace('class="hex"', 'class="hex bq-hex12"')}
                <div class="bq-rel row" style="justify-content: space-between"><span class="bq-eb">${monName(msMonth).toUpperCase()} · ${isCur ? 'HOZIRGACHA' : estimate ? 'TAXMINIY' : 'YAKUNIY'}</span><span class="pill" style="background: rgba(255,255,255,.2); color: #FFFFFF">${pill}</span></div>
                <div class="bq-rel row" style="align-items: baseline; gap: 6px"><strong class="bq-amt">${amount != null ? D().money(amount) : '—'}</strong><span style="font-size: 15px; font-weight: 700; color: #DCEBFF">so'm</span></div>
                <span class="bq-rel" style="font-size: 13px; color: #DCEBFF">${tot.c} / ${tot.p} dars ${isCur ? "hisobga o'tdi" : "o'tildi"}${delta != null ? ` · ${monName(isCur ? prev : D().shiftMonth(msMonth, -1))}dan ${delta >= 0 ? '+' : ''}${delta}%` : ''}</span>
                <div class="bq-stp" style="margin-top: 4px">
                  <div><i class="${st1}"></i><b>${t >= d1 ? 'Oy yopildi' : 'Oy yopiladi'}</b>1-${nm}</div>
                  <div><i class="${st2}"></i><b>E'tiroz</b>4-${nm}gacha</div>
                  <div><i class="${st3}"></i><b>To'lov</b>5-${nm}</div>
                </div>
              </section>
              ${groups.length ? `<section class="card l a2">${groups.map(g => `<div class="li"><span class="pill inf bq-dpill">${g.d} daq</span><div class="col g1"><span class="nm">${g.n} o'quvchi</span><span class="s">${g.c} / ${g.p} dars</span></div><b style="font-size: 15px">${D().money(g.sum)}</b></div>`).join('')}</section>` : empty(P.money, "Bu oy dars yo'q", "Darslar belgilangach shu yerda hisob ko'rinadi.")}
              <div class="note i a3">${svg(P.info, 18, 2).replace('<svg', '<svg style="flex: none; margin-top: 1px"')}<span>Har o'quvchi uchun: oylik stavka ÷ oydagi darslari × o'tilgan darslar. Stavka: 15 daq — 75 000, 30 daq — 150 000, 60 daq — 300 000.${isCur ? " Qoplash darslari tasdiqsiz hisobga o'tadi." : ''}</span></div>
              ${unc ? `<div class="note w"><span><b>${unc} dars qoplanmagan.</b> Oy oxirigacha qoplasangiz maoshga qo'shiladi.</span><button type="button" class="btn sm" data-u-go="davomat" style="margin-left: auto">Davomat</button></div>` : ''}
              ${pts.length >= 2 ? `<section class="card a4" aria-labelledby="bq-ch">
                <div class="sh" style="padding: 0"><h3 id="bq-ch" class="bq-h3">So'nggi ${pts.length} oy · mln so'm</h3><a href="#" data-bq-hist class="bq-lnk">Tarix</a></div>
                <div role="img" aria-label="${pts.map(p => `${monName(p.m)} ${mln(p.v)}`).join(', ')} mln" class="bq-chart">${pts.map((p, i) => `<div class="col"><span class="xs b"${p.m === sel ? ' style="color: #0057B8"' : ''}>${mln(p.v)}</span><span class="bq-cb" style="height: ${Math.max(4, Math.round(p.v / maxV * 69))}px; ${p.m === sel ? 'background: #0065D6; ' : ''}animation-delay: ${(i + 1) * 0.05}s"></span><span class="xs${p.m === sel ? ' b' : ''}">${D().MON_S[+p.m.slice(5) - 1]}</span></div>`).join('')}</div>
              </section>` : ''}`}
            </div>`;
        },
        bind(root) {
            root.querySelectorAll('[data-ms]').forEach(b => b.onclick = () => { msMonth = b.dataset.ms; U.render(); });
            root.querySelector('[data-bq-hist]')?.addEventListener('click', e => { e.preventDefault(); histSheet(); });
            root.querySelector('[data-bq-reload]')?.addEventListener('click', () => U.reload());
        }
    });

    // ─────────────────────────────────────────────────────────────────────
    // Reyting — /api/state/teacher-rating[?month=YYYY-MM]
    // ─────────────────────────────────────────────────────────────────────
    let rtMonth = '';
    const rtE = () => U.load('bq:rt:' + rtMonth, () => api('/api/state/teacher-rating' + (rtMonth ? `?month=${rtMonth}` : '')).then(r => { if (!rtMonth) S().rating = r; return r; }), { ttl: 120000 });
    const ini = name => esc(String(name || '').trim().slice(0, 2));
    function rtMonthSheet(r) {
        const ms = []; for (let m = r.currentMonth || D().now().month; m >= (r.firstMonth || m) && ms.length < 12; m = D().shiftMonth(m, -1)) ms.push(m);
        U.sheet(`${sheetHead('Oyni tanlang')}<div class="col" style="gap: 8px">${ms.map(m => `<button type="button" class="opt${(rtMonth || r.currentMonth) === m ? ' on' : ''}" data-rm="${m}"><span class="rad"></span><span class="g1" style="font-size: 15px; font-weight: 700">${cap1(monName(m))} ${m.slice(0, 4)}${m === r.currentMonth ? ' · joriy' : ''}</span></button>`).join('')}</div>`,
            (el, close) => el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { rtMonth = b.dataset.rm === r.currentMonth ? '' : b.dataset.rm; close(); U.render(); }), { label: 'Oy' });
    }
    U.page('reyting', {
        render() {
            const e = rtE(), r = e.data, rows = r?.rows || [], mine = rows.find(x => x.id === r?.selfId);
            const m = r?.month || D().now().month;
            const top3 = [rows[1], rows[0], rows[2]];
            const podium = (x, place) => {
                if (!x) return '<div></div>';
                const me = x.id === r.selfId, h = { 1: 136, 2: 104, 3: 92 }[place];
                const bg = me ? 'background: #0065D6; color: #FFFFFF' : place === 1 ? 'background: #FEF0C7; color: #93370D' : 'background: #E9EEF6; color: #3A4456';
                const ic = me ? 'inf' : place === 1 ? 'wa' : 'mu';
                return `<div class="bq-pc"${place === 1 ? ' style="position: relative"' : ''}>${place === 1 ? `<svg class="bq-spk" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" style="top: -6px; left: 18px; animation-delay: .9s">${P.star}</svg><svg class="bq-spk" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" style="top: 10px; right: 16px; animation-delay: 1s">${P.star}</svg>` : ''}<span class="bq-ini2 ${ic}">${ini(x.name)}</span><span class="nm">${esc(D().first(x.name))}${me ? ' · siz' : ''}</span><div class="bq-blk" style="height: ${h}px; ${bg}; animation-delay: ${place === 1 ? 0 : place === 2 ? 0.15 : 0.3}s">${place === 1 ? svg(P.crown, 22, 2) : ''}<b>${x.rank}</b><span style="font-size: 12px; font-weight: 700${me ? '; color: #DCEBFF' : ''}">${fmt1(x.score)} ball</span></div></div>`;
            };
            let card = '';
            if (mine) {
                const above = rows[mine.rank - 2], wA = Math.round((r.formula?.attendance ?? 0.6) * 100), wL = Math.round((r.formula?.learning ?? 0.4) * 100);
                const mv = mine.prevRank ? mine.prevRank - mine.rank : 0;
                const strug = (S().main || []).filter(s => flagKeys(s.id).includes('struggling')).length;
                const gain = mine.davomatPct < 90 ? Math.round((90 - mine.davomatPct) * (mine.learnPct == null ? 1 : r.formula?.attendance ?? 0.6) * 10) / 10 : 0;
                const tip = [gain ? `davomatni 90% ga chiqarsangiz — +${fmt1(gain)} ball` : '', strug ? `qiynalayotgan ${strug} o'quvchiga darsdan oldin takror bering — o'zlashtirish tez ko'tariladi` : ''].filter(Boolean).join('; ');
                const bar2 = (l, v, c) => `<div class="col" style="gap: 4px"><div class="row" style="justify-content: space-between; font-size: 13px"><span>${l}</span><b>${v ?? '—'}</b></div><div class="prog" style="background: rgba(255,255,255,.15)"><i style="width: ${v || 0}%; background: ${c}"></i></div></div>`;
                card = `<section class="dark a2">${U.HEX('bqRtHex')}
                  <div class="row" style="justify-content: space-between"><span class="eb">SIZNING NATIJANGIZ</span>${mv ? `<span class="pill" style="${mv > 0 ? 'color: #ABEFC6; background: rgba(18,183,106,.2)' : 'color: #FECDCA; background: rgba(240,68,56,.2)'}">${mv > 0 ? '▲' : '▼'} ${Math.abs(mv)} pog'ona</span>` : ''}</div>
                  <span style="font-size: 15px; font-weight: 700">${above ? `${mine.rank - 1}-o'ringa <span style="color: #FDE68A">${fmt1(Math.max(0.1, above.score - mine.score))} ball</span> qoldi` : `Siz <span style="color: #FDE68A">1-o'rindasiz</span> · ${fmt1(mine.score)} ball`}</span>
                  <div class="col" style="gap: 6px">${mine.learnPct != null ? bar2(`O'zlashtirish · ${wL}%`, mine.learnPct, '#3B8BEE') : ''}${bar2(`Davomat · ${mine.learnPct != null ? wA : 100}%`, mine.davomatPct, '#12B76A')}</div>
                  <span style="font-size: 12px; color: #9DB0CC">Ball = ${mine.learnPct != null ? `${mine.learnPct}×${String(r.formula?.learning ?? 0.4).replace('.', ',')} + ${mine.davomatPct}×${String(r.formula?.attendance ?? 0.6).replace('.', ',')}` : `davomat ${mine.davomatPct}%`} = ${fmt1(mine.score)}.${tip ? ` Tavsiya: ${tip}.` : ''}</span>
                </section>`;
            }
            const rest = rows.filter(x => x.rank > 3);
            return `${bar('', `<button type="button" class="chip" data-bq-rm style="margin-right: 8px; min-height: 44px">${cap1(monName(m))} ▾</button>`)}
            <div class="bd nb" style="padding-top: 0; gap: 14px">
              ${U.offline()}
              <h1 class="ttl">Ustozlar reytingi</h1>
              ${!r ? loading(e, 'bq:rt:' + rtMonth, 3, 96) : !rows.length ? empty(P.cup, 'Reyting hali shakllanmagan', "Darslar belgilangach ustozlar reytingi shu yerda chiqadi.") : `
              <div class="bq-pod a1" style="margin-top: 6px">${podium(top3[0], 2)}${podium(top3[1], 1)}${podium(top3[2], 3)}</div>
              ${card || `<div class="note i"><span>Bu oy reytingda hali o'rningiz yo'q — darslar belgilangach paydo bo'ladi.</span></div>`}
              ${rest.length ? `<div class="card l a3">${rest.map(x => `<div class="li${x.id === r.selfId ? ' bq-me' : ''}"><b style="width: 22px">${x.rank}</b><span class="pill mu bq-ini3">${ini(x.name)}</span><span class="nm g1">${esc(D().first(x.name))}${x.id === r.selfId ? ' · siz' : ''}</span><b>${fmt1(x.score)}</b></div>`).join('')}</div>` : ''}
              <span class="xs bq-foot">Faqat "Keldi" belgilangan va qoplangan darslar hisoblanadi. Boshqa ustozlarning faqat ismi va bali ko'rinadi.</span>`}
            </div>`;
        },
        bind(root) {
            root.querySelector('[data-bq-rm]')?.addEventListener('click', () => { const r = rtE().data; if (r) rtMonthSheet(r); });
        }
    });

    // ─────────────────────────────────────────────────────────────────────
    // Menyu
    // ─────────────────────────────────────────────────────────────────────
    const prefsE = () => U.load('bq:prefs', () => api('/api/staff/notify/prefs'), { ttl: 300000 });
    const tgPill = () => { const p = prefsE(); if (!p.data) return p.err ? '' : '<span class="pill mu">…</span>'; const t = p.data.channels?.telegram || {}; return t.botLinked ? '<span class="pill ok">Ulangan</span>' : '<span class="pill wa">Ulanmagan</span>'; };
    U.tab('menyu', {
        render() {
            const s = S(), n = D().now(), me = s.me || {}, user = s.user || {};
            const rk = ratingOf(s.rating);
            const trialsToday = (s.trials || []).filter(l => { const a = D().tAt(l); return a && a.date === n.date && D().trialPhase(l) !== 'past'; }).length;
            const total = s.salary?.current?.total;
            const newG = D().myGuides().filter(D().guideIsNew).length;
            const wait = waiting().length;
            const tile = (attr, cls, icon, title, sub, subStyle = '') => `<a class="bq-tile" href="#" ${attr}><span class="bq-ic40 ${cls}">${svg(icon, 20, 2)}</span><span class="col"><strong>${title}</strong><span class="xs"${subStyle ? ` style="${subStyle}"` : ''}>${sub}</span></span></a>`;
            return `<div class="bd" style="padding-top: 16px; gap: 14px">
              ${U.offline()}
              <h1 class="ttl">Menyu</h1>
              <a href="#" data-u-push="profil" class="blue a1 bq-mcard">${U.HEX('bqMnHex').replace('class="hex"', 'class="hex bq-hex12"')}
                ${meAvatar(56, 'position: relative; border: 3px solid rgba(255,255,255,.85)')}
                <div class="col g1 bq-rel" style="gap: 2px"><strong style="font-size: 18px; font-weight: 800">${esc(D().first(user.name || me.name))}</strong><span style="font-size: 13px; color: #DCEBFF">Ustoz · ${langOf()} · ${(s.main || []).length} o'quvchi</span>${rk ? `<span class="bq-rkp">Reytingda ${rk.rank}-o'rin</span>` : ''}</div>
                <span class="bq-rel">${svg(P.chev, 20, 2.2)}</span>
              </a>
              <nav aria-label="Bo'limlar" class="a2 bq-tiles">
                ${tile('data-u-push="darslik"', 'inf', P.book, 'Darslik', '72 dars')}
                ${tile('data-u-go="jadval"', 'wa', P.trial, 'Sinov darslari', trialsToday ? `Bugun ${trialsToday} ta` : "bugun yo'q")}
                ${tile('data-u-push="maosh"', 'ok', P.money, 'Maosh', total != null ? `${mln(total)} mln` : 'hisob', total != null ? 'color: #067647; font-weight: 700' : '')}
                ${tile('data-u-push="reyting"', 'wa', P.cup, 'Reyting', rk ? `${rk.rank}-o'rin` : 'ustozlar')}
                ${tile('data-bq-break', 'bq-or', P.coffee, 'Tanaffus', 'sinovga tanaffus olish')}
                ${tile('data-bq-inactive', 'mu', P.box, 'Faol emas', `${s.inactive?.length ?? 0} o'quvchi`)}
                ${tile('data-u-push="sorov"', 'mu', P.msg, "Adminga so'rov", wait ? `${wait} javob kutmoqda` : "jadval, muzlatish")}
                ${tile('data-u-push="taqdimot"', 'mu', P.pen, 'Doska', "bo'sh doska")}
                ${tile('data-u-push="yoriq"', 'inf', P.help, "Yo'riqnomalar", newG ? `${newG} ta yangi` : 'qoidalar', newG ? 'color: #0057B8; font-weight: 700' : '')}
              </nav>
              <div class="card l a3">
                <a class="bq-ml" href="#" data-u-push="profil">${svg(P.tg, 20, 2).replace('currentColor', '#3A4456')}<span class="g1 bq-mlt">Telegram bot</span>${tgPill()}</a>
                <a class="bq-ml" href="#" data-u-push="profil">${svg(P.gear, 20, 2).replace('currentColor', '#3A4456')}<span class="g1 bq-mlt">Sozlamalar</span>${chevR('#4B5563')}</a>
                <button type="button" class="bq-ml bq-out" data-bq-logout>${svg(P.out, 20, 2)}<span class="g1 bq-mlt" style="font-weight: 700">Chiqish</span></button>
              </div>
            </div>`;
        },
        bind(root) {
            root.querySelector('[data-bq-break]')?.addEventListener('click', e => { e.preventDefault(); if (U.jadval?.openTanaffus) U.jadval.openTanaffus(); else U.go('jadval'); });
            root.querySelector('[data-bq-inactive]')?.addEventListener('click', e => { e.preventDefault(); stSeg = 'inactive'; U.go('oquvchilar'); });
            root.querySelector('[data-bq-logout]')?.addEventListener('click', () => {
                U.sheet(`${sheetHead('Chiqasizmi?', "Bu telefondan akkauntdan chiqasiz. Internet yo'qligida saqlangan davomat belgilari yo'qolmaydi.")}<button type="button" class="btn w" data-bq-out style="color: #B42318; border-color: #FECDCA">Chiqish</button><button type="button" class="btn w" data-u-close>Bekor qilish</button>`,
                    el => { el.querySelector('[data-bq-out]').onclick = () => { D().logout(false); location.replace('/'); }; }, { label: 'Chiqish' });
            });
        }
    });

    // ─────────────────────────────────────────────────────────────────────
    // Profil va sozlamalar
    // ─────────────────────────────────────────────────────────────────────
    const profE = () => U.load('bq:prof', () => api('/api/staff/profile'), { ttl: 300000 });
    const sessE = () => U.load('bq:ss', () => api('/api/auth/sessions'), { ttl: 60000 });
    const histE = () => U.load('bq:lh', () => api('/api/auth/login-history'), { ttl: 60000 });
    const NOTIF = [['lesson_soon', 'Darsdan oldin eslatma'], ['trial_confirm', 'Yangi sinov darsi'], ['attendance_unmarked', 'Belgilanmagan dars'], ['salary_ready', 'Maosh va reyting']];
    const maskPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.length >= 9 ? `+998 •• ••• •• ${d.slice(-2)}` : '—'; };
    function resizeImage(file) {
        return new Promise((ok, no) => {
            const r = new FileReader();
            r.onerror = () => no(new Error("Rasmni o'qib bo'lmadi"));
            r.onload = () => { const img = new Image(); img.onerror = () => no(new Error('Rasm formati noto\'g\'ri')); img.onload = () => {
                const k = Math.min(1, 320 / Math.max(img.width, img.height)), c = document.createElement('canvas');
                c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                ok(c.toDataURL('image/jpeg', 0.85)); }; img.src = r.result; };
            r.readAsDataURL(file);
        });
    }
    function openPassword() {
        const minLen = histE().data?.minLength || 4;
        U.sheet(`${sheetHead("Parolni o'zgartirish")}
            <div class="fl"><label for="bq-p0">Joriy parol</label><input id="bq-p0" type="password" autocomplete="current-password"></div>
            <div class="fl"><label for="bq-p1">Yangi parol</label><input id="bq-p1" type="password" autocomplete="new-password"></div>
            <div class="fl"><label for="bq-p2">Yangi parolni takrorlang</label><input id="bq-p2" type="password" autocomplete="new-password"></div>
            <div class="note i" id="bq-pr"><span>Kamida ${minLen} belgi, eski paroldan farqli.</span></div>
            <label class="row bq-chk"><span class="g1" style="font-size: 15px; font-weight: 600">Boshqa qurilmalardan chiqarish</span><input type="checkbox" id="bq-lo" checked></label>
            <button type="button" class="btn p w" data-save>Parolni saqlash</button>`,
        (el, close) => {
            const v = id => el.querySelector(id).value;
            const check = () => { const p = v('#bq-p1'), ok = p.length >= minLen; el.querySelector('#bq-pr').className = 'note ' + (p && !ok ? 'w' : 'i'); return ok; };
            el.querySelector('#bq-p1').oninput = check;
            el.querySelector('[data-save]').onclick = async e => {
                if (!v('#bq-p0')) return U.toast('Joriy parolni kiriting');
                if (!check()) return U.toast('Parol talablarga mos emas');
                if (v('#bq-p1') !== v('#bq-p2')) return U.toast('Yangi parollar mos emas');
                e.currentTarget.disabled = true;
                try { await api('/api/auth/change-password', { method: 'POST', body: { currentPassword: v('#bq-p0'), newPassword: v('#bq-p1'), logoutOthers: el.querySelector('#bq-lo').checked } }); U.drop('bq:ss'); close(); U.toast("Parol o'zgartirildi", { ok: true }); }
                catch (err) { e.currentTarget.disabled = false; U.toast(err.message); }
            };
        }, { label: "Parolni o'zgartirish" });
    }
    U.page('profil', {
        render() {
            const s = S(), pe = profE(), pf = pe.data, pr = prefsE(), ss = sessE(), user = s.user || {};
            const work = Object.fromEntries(pf?.work || []);
            const labelOf = k => pr.data?.groups?.flatMap(g => g.items || []).find(i => i.key === k)?.label;
            const sw = (k, l) => { const p = pr.data?.prefs?.[k], on = !!(p && (p.tg || p.web)); return `<div class="bq-rw"><span class="bq-kk">${esc(k === 'lesson_soon' && labelOf(k) ? labelOf(k) : l)}</span><button type="button" class="bq-sw${on ? ' on' : ''}" data-np="${k}" aria-label="${esc(l)}" aria-pressed="${on}"${pr.data ? '' : ' disabled'}></button></div>`; };
            const t = pr.data?.channels?.telegram;
            return `${bar('Profil', '<span style="width: 64px"></span>')}
            <div class="bd nb" style="padding-top: 6px; gap: 10px">
              ${U.offline()}
              <div class="col a1" style="align-items: center; gap: 6px">
                <div style="position: relative">${meAvatar(84, 'border: 3px solid #FFFFFF; box-shadow: 0 0 0 1px #CBD5E1')}<label class="bq-camb" aria-label="Rasmni almashtirish">${svg(P.cam, 16, 2.2)}<input type="file" accept="image/*" data-bq-av class="sr"></label></div>
                <strong style="font-size: 19px; font-weight: 800">${esc(D().first(user.name || s.me?.name))}</strong><span class="s" style="text-align: center">Ustoz · ${langOf()} · rasm o'quvchi ilovasida ko'rinadi</span>
              </div>
              <span class="bq-gh">ISH MA'LUMOTLARI</span>
              <div class="card l a2">
                <div class="bq-rw"><span class="bq-kk">Telefon</span><span class="bq-v">${maskPhone(pf?.user?.phone || user.email || s.me?.login)}</span></div>
                <div class="bq-rw"><span class="bq-kk">Ish vaqti</span><span class="bq-v">${pf ? esc(work['Ish vaqti'] || 'admin belgilaydi') : pe.err ? '—' : '…'}</span></div>
                <div class="bq-rw"><span class="bq-kk">Telegram bot</span>${tgPill()}</div>
              </div>
              ${t && !t.botLinked ? `<span class="xs bq-foot">Telegram botni ulash: kompyuterda CRM → Sozlamalar → Bildirishnomalar → "Ulash".</span>` : ''}
              <span class="bq-gh">BILDIRISHNOMALAR</span>
              <div class="card l a3">${pr.err && !pr.data ? `<div class="bq-rw">${U.err(pr, 'bq:prefs')}</div>` : NOTIF.map(([k, l]) => sw(k, l)).join('')}</div>
              <span class="bq-gh">XAVFSIZLIK</span>
              <div class="card l a4">
                <div class="bq-rw"><span class="bq-kk">Tungi rejim</span><span class="bq-v">tez orada</span><button type="button" class="bq-sw" aria-label="Tungi rejim" aria-pressed="false" disabled></button></div>
                <a class="bq-rw" href="#" data-bq-pwd><span class="bq-kk">Parolni o'zgartirish</span>${chevR('#4B5563')}</a>
                <a class="bq-rw" href="#" data-u-push="kirish" data-arg="tarix"><span class="bq-kk">Kirish tarixi</span><span class="bq-v">urinishlar</span>${chevR('#4B5563')}</a>
                <a class="bq-rw" href="#" data-u-push="kirish" data-arg="qurilma"><span class="bq-kk">Kirgan qurilmalar</span><span class="bq-v">${ss.data ? `${(ss.data.sessions || []).length} ta` : ''}</span>${chevR('#4B5563')}</a>
              </div>
              <span class="xs bq-foot" style="text-align: center">Domwork Team · Ustoz · 2.0</span>
            </div>`;
        },
        bind(root) {
            root.querySelector('[data-bq-pwd]')?.addEventListener('click', e => { e.preventDefault(); openPassword(); });
            root.querySelectorAll('[data-np]').forEach(b => b.onclick = async () => {
                const e = prefsE(); if (!e.data) return;
                const k = b.dataset.np, prevP = { ...(e.data.prefs[k] || {}) }, on = !(prevP.tg || prevP.web);
                e.data.prefs[k] = { tg: on, web: on }; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
                try { const r = await api('/api/staff/notify/prefs', { method: 'PUT', body: { types: { [k]: { tg: on, web: on } } } }); if (r?.prefs) e.data = r; U.toast('Saqlandi', { ok: true }); }
                catch (err) { e.data.prefs[k] = prevP; U.toast(err.message); U.render(); }
            });
            const f = root.querySelector('[data-bq-av]');
            if (f) f.onchange = async () => {
                const file = f.files?.[0]; if (!file) return;
                try {
                    const dataUrl = await resizeImage(file);
                    const r = await api('/api/auth/avatar', { method: 'POST', body: { dataUrl } });
                    const u = S().user; if (u) { u.avatar = r.url || dataUrl; D().store.set('mh_currentUser', u); }
                    U.toast('Rasm saqlandi', { ok: true }); U.render();
                } catch (err) { U.toast(err.message); }
            };
        }
    });

    // Kirish tarixi va qurilmalar (/api/auth/login-history, /api/auth/sessions)
    function uaLabel(ua) {
        const u = String(ua || '');
        const app = /DomworkTeacher|Domwork Teacher/i.test(u) ? 'Domwork Team' : /Telegram/i.test(u) ? 'Telegram' : /Edg\//.test(u) ? 'Edge' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : u ? 'Brauzer' : "Noma'lum";
        const os = /Android/i.test(u) ? 'Android' : /iPhone|iPad|iOS/i.test(u) ? 'iOS' : /Windows/i.test(u) ? 'Windows' : /Mac OS|Macintosh/i.test(u) ? 'macOS' : /Linux/i.test(u) ? 'Linux' : '';
        return { label: os ? `${app} · ${os}` : app, mobile: /Android|iPhone|iPad|Mobile/i.test(u) };
    }
    U.page('kirish', {
        render(arg) {
            const ss = sessE(), lh = histE();
            const sessions = (ss.data?.sessions || []).slice().sort((a, b) => (b.isCurrent - a.isCurrent) || String(b.lastSeen || '').localeCompare(String(a.lastSeen || '')));
            const ev = lh.data?.events || [], fails = ev.filter(e => !e.ok), lf = fails[0];
            const sesHtml = `<span class="bq-gh">KIRGAN QURILMALAR${ss.data ? ' · ' + sessions.length : ''}</span>
              <div class="card l">${!ss.data ? loading(ss, 'bq:ss', 2, 48) : sessions.map(s => { const u = uaLabel(s.userAgent); return `<div class="li"><span class="bq-ic mu">${svg(u.mobile ? P.mobile : P.monitor, 20, 2)}</span><div class="col g1"><span class="nm">${esc(u.label)}</span><span class="s">${s.ip ? esc(s.ip) + ' · ' : ''}${s.isCurrent ? 'hozir' : esc(D().stamp(s.lastSeen || s.createdAt))}</span></div>${s.isCurrent ? '<span class="pill inf">shu telefon</span>' : `<button type="button" class="btn sm" data-kill="${esc(s.id)}" style="color: #B42318">Chiqarish</button>`}</div>`; }).join('') || '<div class="li"><span class="s">Sessiya yo\'q</span></div>'}</div>
              ${sessions.filter(s => !s.isCurrent).length > 1 ? '<button type="button" class="btn w" data-killall style="color: #B42318">Boshqa hammasidan chiqish</button>' : ''}`;
            const histHtml = `<span class="bq-gh">KIRISHLAR · 30 KUN</span>
              <div class="card l">${!lh.data ? loading(lh, 'bq:lh', 2, 48) : ev.slice(0, 15).map(e => `<div class="li"><div class="col g1"><span class="nm">${esc(D().stamp(e.at))}</span><span class="s">${esc(uaLabel(e.userAgent).label)}${e.ip ? ' · ' + esc(e.ip) : ''}</span></div><span class="pill ${e.ok ? 'ok' : 'bad'}">${e.ok ? 'Kirdi' : 'Xato parol'}</span></div>`).join('') || '<div class="li"><span class="s">Yozuv yo\'q</span></div>'}</div>`;
            return `${bar(arg === 'qurilma' ? 'Qurilmalar' : 'Kirish tarixi', '<span style="width: 64px"></span>')}
            <div class="bd nb" style="padding-top: 6px; gap: 10px">
              ${U.offline()}
              ${fails.length ? `<div class="note w" role="alert">${svg(P.alert, 18, 2).replace('<svg', '<svg style="flex: none; margin-top: 1px"')}<span><b>${esc(D().stamp(lf.at))} — ${fails.length} marta noto'g'ri parol${lf.ip ? ' (' + esc(lf.ip) + ')' : ''}.</b> Siz bo'lmasangiz, parolni o'zgartiring. ${lh.data.failLimit || 5} xatodan keyin kirish ${lh.data.lockMinutes || 15} daqiqaga yopiladi.</span></div>` : ''}
              ${arg === 'qurilma' ? sesHtml + histHtml : histHtml + sesHtml}
              <button type="button" class="btn w" data-bq-pwd>Parolni o'zgartirish</button>
            </div>`;
        },
        bind(root) {
            root.querySelector('[data-bq-pwd]')?.addEventListener('click', openPassword);
            root.querySelectorAll('[data-kill]').forEach(b => b.onclick = async () => { b.disabled = true; try { await api(`/api/auth/sessions/${encodeURIComponent(b.dataset.kill)}`, { method: 'DELETE' }); U.drop('bq:ss'); U.toast('Qurilma chiqarildi', { ok: true }); U.render(); } catch (err) { U.toast(err.message); b.disabled = false; } });
            root.querySelector('[data-killall]')?.addEventListener('click', async e => { e.currentTarget.disabled = true; try { await api('/api/auth/sessions/others', { method: 'DELETE' }); U.drop('bq:ss'); U.toast('Boshqa qurilmalardan chiqildi', { ok: true }); U.render(); } catch (err) { U.toast(err.message); } });
        }
    });

    // ─────────────────────────────────────────────────────────────────────
    // Yo'riqnomalar (S.state.guides — lavozimga tegishli; "o'qilgan" telefonda saqlanadi)
    // ─────────────────────────────────────────────────────────────────────
    let gQ = '', gF = 'all';
    function safeHtml(html) {
        const doc = new DOMParser().parseFromString(`<div>${String(html || '')}</div>`, 'text/html');
        const OK = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'A', 'SPAN', 'DIV']);
        const walk = node => {
            for (const ch of [...node.childNodes]) {
                if (ch.nodeType === 3) continue;
                if (ch.nodeType !== 1 || !OK.has(ch.tagName)) { if (ch.nodeType === 1 && !['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT'].includes(ch.tagName)) { walk(ch); ch.replaceWith(...ch.childNodes); } else ch.remove(); continue; }
                const href = ch.getAttribute('href');
                for (const a of [...ch.attributes]) ch.removeAttribute(a.name);
                if (ch.tagName === 'A' && href && /^https:\/\//.test(href)) { ch.setAttribute('href', href); ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener'); }
                walk(ch);
            }
        };
        const body = doc.body.firstChild; walk(body);
        const out = body.innerHTML.trim();
        return /<\w/.test(out) ? out : out.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    }
    const readMin = g => Math.max(1, Math.round(String(g.content || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 180));
    U.page('yoriq', {
        render() {
            const all = D().myGuides(), q = gQ.toLowerCase(), isNew = D().guideIsNew;
            const cats = [...new Set(all.map(g => g.subtitle).filter(Boolean))].slice(0, 3);
            const unread = all.filter(isNew);
            const list = all.filter(g => (!q || `${g.title} ${g.subtitle || ''}`.toLowerCase().includes(q)) && (gF === 'all' || (gF === 'new' ? isNew(g) : g.subtitle === gF)));
            const chip = (k, l) => `<button type="button" class="chip${gF === k ? ' on' : ''}" data-gf="${esc(k)}" aria-pressed="${gF === k}">${l}</button>`;
            return `${bar()}
            <div class="bd nb" style="padding-top: 0; gap: 10px">
              ${U.offline()}
              <div class="col" style="padding: 0 4px"><h1 class="ttl" style="padding: 0">Yo'riqnomalar</h1><span class="s">Lavozimingizga tegishli · yangilari tepada</span></div>
              <div class="bq-srch"><label for="bq-gq" class="sr">Qidirish</label>${svg(P.search, 20, 2).replace('stroke="currentColor"', 'stroke="#4B5563"')}<input id="bq-gq" type="search" placeholder="Yo'riqnoma qidirish" value="${esc(gQ)}" autocomplete="off"></div>
              <div class="chips bq-chips">${chip('all', `Hammasi · ${all.length}`)}${chip('new', `O'qilmagan · ${unread.length}`)}${cats.map(c => chip(c, esc(c))).join('')}</div>
              ${list.length ? `<div class="card l a1">${list.map(g => `<a class="li" href="#" data-u-push="maqola" data-arg="${esc(g.id)}"><div class="col g1"><span class="nm">${esc(g.sticker ? g.sticker + ' ' : '')}${esc(g.title || 'Nomsiz')}</span><span class="s">${g.subtitle ? esc(g.subtitle) + ' · ' : ''}${g.createdAt ? D().fmtDate(D().tz(g.createdAt).date) + ' · ' : ''}${isNew(g) ? readMin(g) + ' daq' : "o'qilgan"}</span></div>${isNew(g) ? '<span class="pill inf">Yangi</span>' : chevR()}</a>`).join('')}</div>`
                : empty(P.help, all.length ? 'Topilmadi' : "Yo'riqnoma hali yo'q", all.length ? "Qidiruvni o'zgartiring." : "Admin yo'riqnoma qo'shganda shu yerda chiqadi.")}
              <span class="xs bq-foot">"O'qilgan" belgisi shu telefonda saqlanadi.</span>
            </div>`;
        },
        bind(root) {
            root.querySelectorAll('[data-gf]').forEach(b => b.onclick = () => { gF = b.dataset.gf; U.render(); });
            const inp = root.querySelector('#bq-gq');
            if (inp) inp.oninput = () => { gQ = inp.value; const pos = inp.selectionStart; U.render(); const a = root.querySelector('#bq-gq'); if (a) { a.focus(); a.setSelectionRange(pos, pos); } };
        }
    });
    U.page('maqola', {
        render(id) {
            const g = D().myGuides().find(x => x.id === id);
            if (!g) return `${bar()}<div class="bd nb">${empty(P.help, "Yo'riqnoma topilmadi", "U o'chirilgan yoki sizning lavozimingizga tegishli emas.")}</div>`;
            const wasNew = D().guideIsNew(g);
            const read = D().store.get('dwt_guides_read', []); if (!read.includes(g.id)) D().store.set('dwt_guides_read', [...read, g.id].slice(-200));
            return `${bar()}
            <div class="bd nb" style="padding-top: 0; gap: 10px">
              <div class="col" style="padding: 0 4px; gap: 6px">${wasNew || g.subtitle ? `<span class="pill ${wasNew ? 'inf' : 'mu'}" style="align-self: flex-start">${wasNew ? 'Yangi' : ''}${wasNew && g.subtitle ? ' · ' : ''}${esc(g.subtitle || '')}</span>` : ''}<h1 class="ttl" style="padding: 0; font-size: 24px">${esc(g.sticker ? g.sticker + ' ' : '')}${esc(g.title || '')}</h1><span class="s">${g.createdAt ? D().fmtDate(D().tz(g.createdAt).date) + ' · ' : ''}${readMin(g)} daq o'qish</span></div>
              <article class="card bq-art">${safeHtml(g.content) || '<p class="s">Matn yo\'q.</p>'}</article>
            </div>`;
        }
    });
})();
