// Ustoz ilovasi v2 — Bosh bo'limi: Bosh (Main), Bildirishnomalar, Jonli dars (Dars → DarsYakun → DarsTabrik),
// tabrik popuplari (YangiSinovdan, YangiBiriktirildi). Dizayn: kanvas "Ustoz · yakuniy", Motion qoidalari.
// Ma'lumot: window.DWT (teacher/app.js) — S.schedule, S.main, S.trials, S.salary, S.rating, S.progress, davomat qoidalari.
// "Darsni boshlash/tugatish" mantig'i — js/lessonStart.js bilan bir xil: navbatdagi jonli dars /api/academic/next-lessons,
// dars ma'lumoti /api/academic/lessons/:no, tugatishda POST /api/state/teacher-attendance (grade.lessonId, heldFrom/heldTo)
// va POST /api/academic/sessions. Bildirishnomalar — eski ilovadagi notifEvents() manbalari (shu yerda qayta yig'iladi).
(function () {
    'use strict';
    const U = window.U;
    if (!U) return;
    const D = () => window.DWT, S = () => window.DWT.S;
    const K = { live: 'dwt_v2_live', done: 'dwt_v2_done', welcome: 'dwt_v2_welcome_seen', seen: 'dwt_notif_seen', read: 'dwt_v2_notif_read' };
    const get = (k, d) => D().store.get(k, d), set = (k, v) => D().store.set(k, v);
    const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
    const P = {
        bell: '<path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"></path>',
        play: '<path d="M7 4.5v15l12-7.5z"></path>',
        tg: '<path d="M21 4L3 11l6 2 2 6 3-4 5 4z"></path><path d="M9 13l12-9"></path>',
        screen: '<rect x="3" y="4" width="18" height="12" rx="2"></rect><path d="M12 16v4M8 20h8"></path>',
        back: '<path d="M15 6l-6 6 6 6"></path>',
        clock: '<circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2.5 2M9 2h6"></path>',
        alert: '<path d="M12 9v4M12 17h.01"></path><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"></path>',
        calok: '<rect x="3" y="4.5" width="18" height="16" rx="3"></rect><path d="M3 9.5h18M8 3v3M16 3v3M9 15l2 2 4-4"></path>',
        money: '<rect x="2" y="6" width="20" height="13" rx="3"></rect><circle cx="12" cy="12.5" r="2.5"></circle>',
        cup: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"></path><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"></path>',
        userplus: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M20 8v6M23 11h-6"></path>',
        ok: '<circle cx="12" cy="12" r="9"></circle><path d="M8 12l3 3 5-6"></path>',
        no: '<circle cx="12" cy="12" r="9"></circle><path d="M9 9l6 6M15 9l-6 6"></path>',
        doc: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"></path><path d="M14 3v5h5M9 13h6M9 17h6"></path>',
        video: '<path d="M23 7l-7 5 7 5z"></path><rect x="1" y="5" width="15" height="14" rx="2"></rect>',
        book: '<path d="M2 4h7a3 3 0 013 3v14a2 2 0 00-2-2H2zM22 4h-7a3 3 0 00-3 3v14a2 2 0 012-2h8z"></path>',
        pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"></path>',
        info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 8v4M12 16h.01"></path>',
        x: '<path d="M6 6l12 12M18 6L6 18"></path>',
        tick: '<path d="M5 12l5 5L20 7"></path>',
        mug: '<path d="M17 8h1a4 4 0 010 8h-1"></path><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4z"></path><path d="M6 2v2M10 2v2M14 2v2"></path>',
        star: '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"></path>',
    };
    const svg = (k, size = 20, sw = 2) => U.svg(P[k], size, sw);
    const esc = s => D().esc(s);

    // ── Umumiy yordamchilar ────────────────────────────────────────────────
    const langOf = s => (s?.subject === 'russian' ? 'russian' : 'english');
    const durOf = s => Number(s?.lessonDuration) || 30;
    const minNow = () => D().now().min;
    const isoMin = iso => D().tz(iso)?.min ?? null;
    const fmtShort = date => { const d = D(); return `${+date.slice(8)}-${d.MON_S[+date.slice(5, 7) - 1].toLowerCase()}`; };
    const mln = n => { const v = Math.round(Number(n) || 0); return v >= 1e6 ? { v: (v / 1e6).toFixed(2).replace('.', ','), u: ' mln' } : v >= 1000 ? { v: String(Math.round(v / 1000)), u: ' ming' } : { v: String(v), u: " so'm" }; };
    const initials = name => esc(String(name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase());
    const ava = (s, size, extra = '') => D().avatar(s, 'av').replace('<img ', `<img style="width: ${size}px; height: ${size}px;${extra}" `);
    const meAvatar = () => {
        const S0 = S(), url = S0.me?.avatar || S0.user?.avatar || '';
        if (/^(\/|https:|data:image)/.test(url)) return `<img class="av" src="${esc(url)}" alt="" style="width: 46px; height: 46px; border: 2px solid #FFFFFF; box-shadow: 0 0 0 1px #CBD5E1">`;
        return `<span class="av" aria-hidden="true" style="width: 46px; height: 46px; border: 2px solid #FFFFFF; box-shadow: 0 0 0 1px #CBD5E1; background: #EAF3FF; color: #0057B8; display: grid; place-items: center; font-weight: 800; font-size: 16px">${initials(S0.me?.name || S0.user?.name)}</span>`;
    };
    const greet = () => { const h = Math.floor(minNow() / 60); return h < 11 ? 'Xayrli tong' : h < 18 ? 'Xayrli kun' : 'Xayrli kech'; };
    const relDay = date => { const d = D(), n = d.now(); return date === n.date ? 'bugun' : date === U.addDays(n.date, 1) ? 'ertaga' : date === U.addDays(n.date, -1) ? 'kecha' : fmtShort(date); };

    // Bugungi darslar: /api/school/schedule (S.schedule) — bo'lmasa o'quvchilar jadvali + sinovlar (eski todayItems bilan bir xil).
    function todayItems() {
        const d = D(), S0 = S(), n = d.now();
        const view = (S0.schedule?.views || [])[0];
        let items;
        if (view) items = view.items.filter(i => ['lesson', 'trial', 'makeup'].includes(i.kind)).map(i => ({ ...i }));
        else {
            items = S0.main.filter(s => !s.frozen && d.patternOf(s).includes(n.wd) && d.toMin(s.lessonTime) != null && !(s.startDate && String(s.startDate).slice(0, 10) > n.date))
                .map(s => ({ kind: 'lesson', start: d.toMin(s.lessonTime), end: d.toMin(s.lessonTime) + durOf(s), studentId: s.id, studentName: s.name }));
            for (const l of S0.trials || []) {
                const a = d.tAt(l), r = d.tReq(l);
                if (a && a.date === n.date && ['pending', 'accepted'].includes(r.state)) items.push({ kind: 'trial', start: a.min, end: a.min + (Number(l.durationMin) || 30), leadId: l.id, leadName: l.name });
            }
        }
        for (const i of items) if (i.kind === 'trial' && !i.leadName) i.leadName = (S0.trials || []).find(l => l.id === i.leadId)?.name || '';
        return items.sort((a, b) => a.start - b.start);
    }
    function markOfItem(i) {
        const s = i.studentId && D().stuOf(i.studentId);
        if (s) { const m = D().markOf(s, D().now().date); if (m !== 'empty') return m; }
        return i.att === 1 ? 'present' : i.att === 0 ? 'absent' : 'empty';
    }
    const liveOf = () => { const l = get(K.live, null); return l && l.date === D().now().date ? l : null; };
    function dayState() {
        const n = D().now(), items = todayItems(), live = liveOf();
        for (const i of items) { i.mark = i.studentId ? markOfItem(i) : 'empty'; i.live = !!(live && i.studentId === live.studentId && i.kind !== 'trial'); }
        const next = items.find(i => i.live) || items.find(i => i.studentId && i.kind !== 'trial' && i.mark === 'empty' && i.end > n.min) || null;
        const done = items.filter(i => i.mark !== 'empty' || (n.min >= i.end && !i.live)).length;
        return { items, next, done, total: items.length, live };
    }

    // ── Yuklanadigan ma'lumot (U.load keshi) ───────────────────────────────
    const api = (...a) => D().api(...a);
    const nextLessons = ids => { ids = [...new Set(ids.filter(Boolean))].sort(); return ids.length ? U.load(`bs:nx:${ids.join(',')}`, () => api(`/api/academic/next-lessons?ids=${encodeURIComponent(ids.join(','))}`).then(r => r.lessons || {}), { ttl: 300000 }) : { data: {} }; };
    const lessonData = (no, lang) => no ? U.load(`bs:les:${lang}:${no}`, () => api(`/api/academic/lessons/${encodeURIComponent(no)}?lang=${lang}`), { ttl: 600000 }) : { data: null };
    const groups = () => U.load('bs:grp', () => api('/api/school/my-groups').then(r => r.groups || []), { ttl: 600000 });
    const groupOf = sid => (groups().data || []).find(g => g.student_id === sid) || null;
    const sessions = () => U.load(`bs:ses:${D().now().month}`, () => api(`/api/academic/sessions?month=${D().now().month}`).then(r => r.sessions || []), { ttl: 120000 });
    const detail = sid => U.load(`bs:det:${sid}`, () => api(`/api/academic/students/${encodeURIComponent(sid)}`), { ttl: 300000 });
    // Kitob/ustoz kitobi sahifasi, slaydlar soni — js/lessonStart.js lessonFacts bilan bir xil.
    function facts(data) {
        const L = data?.lesson; if (!L) return null;
        const plain = s => String(s ?? '').replace(/́/g, '');
        const tb = (data.guides || []).find(g => g.kind === 'teacher_book' && !/yordamchi|assistant/i.test(g.title));
        const slides = (data.materials || []).filter(m => m.kind === 'live_slides' || m.kind === 'video_slides').length + (L.slides || []).length;
        return { no: L.no, type: L.type, name: plain(L.name), topic: plain(L.topic || ''), slides, teacherBook: tb ? `${tb.page}-bet` : '' };
    }
    function lessonInfo(sid) {
        const s = D().stuOf(sid), nx = nextLessons([sid, ...todayItems().map(i => i.studentId)]).data?.[sid] || null;
        const no = nx?.nextLive?.no || null, lang = nx?.lang || langOf(s), isNo = v => !v || /^\d+-dars$/i.test(String(v).trim());
        const f = no ? facts(lessonData(no, lang).data) : null;
        return { no, lessonId: nx?.nextLive?.id || '', name: [f?.topic, f?.name, nx?.nextLive?.name].find(v => !isNo(v)) || '', reached: nx?.reached ?? S().progress[sid]?.reached ?? null, f, lang };
    }
    const sessionToday = sid => (sessions().data || []).filter(x => x.studentId === sid && x.date === D().now().date).slice(-1)[0] || null;

    // ── Bildirishnomalar (eski notifEvents manbalari: jadval, davomat, sinov, qoplash, so'rov, maosh, yo'riqnoma) ──
    function welcomeCandidates() {
        const d = D(), S0 = S(), n = d.now(), meId = S0.me?.id, since = U.addDays(n.date, -14);
        return S0.main.filter(s => !s.frozen).map(s => {
            const h = (s.teacherHistory || []).filter(x => x.teacherId === meId && !x.to).map(x => String(x.from || '').slice(0, 10)).sort().slice(-1)[0];
            const at = h || String(s.startDate || '').slice(0, 10);
            const sd = String(s.startDate || '').slice(0, 10), first = /^\d{4}-\d{2}-\d{2}$/.test(sd) && sd > at ? sd : at;
            return /^\d{4}-\d{2}-\d{2}$/.test(at) && at >= since && at <= U.addDays(n.date, 14) ? { s, at, first } : null;
        }).filter(Boolean);
    }
    function firstLesson(s, from) {
        const d = D(), pat = d.patternOf(s);
        for (let k = 0; k < 14; k++) { const x = U.addDays(from, k); if (pat.includes(d.wdOf(x))) return x; }
        return null;
    }
    function notifEvents() {
        const d = D(), S0 = S(), n = d.now(), ev = [], since = Date.now() - 14 * 86400000;
        const at = (date, min = 0) => Date.parse(`${date}T00:00:00Z`) + (min - 300) * 60000;
        const st = dayState();
        if (st.next && !st.next.live && st.next.start - 15 <= n.min && n.min < st.next.start) {
            const i = st.next, s = d.stuOf(i.studentId), li = lessonInfo(i.studentId), g = groupOf(i.studentId);
            ev.push({ id: `soon:${i.studentId}:${n.date}:${i.start}`, cat: 'dars', tone: 'inf', ic: 'clock', title: `${esc(d.first(s?.name || i.studentName))} bilan dars ${i.start - n.min} daqiqadan keyin`,
                sub: [d.hm(i.start), li.no ? `${li.no}-dars` : '', g?.tg_link ? 'Telegram guruh' : ''].filter(Boolean).join(' · '), t: at(n.date, i.start - 15), go: { push: ['dars', i.studentId] } });
        }
        for (const s of S0.main) for (const date of d.monthStats(s, n.month).empty) {
            const end = (d.toMin(s.lessonTime) ?? 0) + durOf(s);
            ev.push({ id: `att:${s.id}:${date}`, cat: 'davomat', tone: 'bad', ic: 'alert', title: `${esc(d.first(s.name))} darsi belgilanmagan`,
                sub: `${date === n.date ? `${d.hm(end)} dars tugadi · bugun belgilang, aks holda ertaga ilova shu darsni so'raydi` : `${fmtShort(date)} · belgilanmasa maoshga o'tmaydi`}`, t: at(date, end), go: { att: [s.id, date] } });
        }
        for (const l of S0.trials || []) {
            const p = d.trialPhase(l), r = d.tReq(l), a = d.tAt(l), mgr = d.trialManager(l) || l.managerName || '';
            if (p === 'pending') ev.push({ id: `trial:${l.id}:${r.id}:new`, cat: 'sinov', tone: 'wa', ic: 'calok', title: `Yangi sinov darsi: ${esc(d.short(l.name))}`,
                sub: [a ? `${relDay(a.date)} ${d.hm(a.min)}` : '', `${Number(l.durationMin) || 30} daq`, mgr ? `menejer ${esc(d.first(mgr))}` : ''].filter(Boolean).join(' · '), t: Date.parse(r.requestedAt || r.createdAt) || (a ? a.t - 86400000 : Date.now()), go: { tab: 'jadval' } });
            if (p === 'result') ev.push({ id: `trial:${l.id}:${r.id}:res`, cat: 'sinov', tone: 'inf', ic: 'calok', title: `Sinov natijasini yozing: ${esc(d.short(l.name))}`,
                sub: a ? `${relDay(a.date)} ${d.hm(a.min)} · natija menejerga boradi` : 'natija menejerga boradi', t: a ? a.t + 30 * 60000 : Date.now(), go: { tab: 'jadval' } });
        }
        for (const m of S0.makeups || []) {
            const t = Date.parse(m.decided_at); if (!(t > since) || !['approved', 'rejected'].includes(m.status)) continue;
            if (m.status === 'approved' && !m.decided_by) continue; // o'zi kiritgan, tasdiqsiz hisobga o'tgan — hech kim "tasdiqlamagan"
            ev.push({ id: `mk:${m.id}:${m.status}`, cat: 'davomat', tone: m.status === 'approved' ? 'ok' : 'bad', ic: m.status === 'approved' ? 'ok' : 'no', title: `Qoplash ${m.status === 'approved' ? 'tasdiqlandi' : 'rad etildi'}`,
                sub: `${esc(d.first(d.stuOf(m.student_id)?.name || ''))} · ${fmtShort(d.day10(m.missed_date))} o'rniga${m.decision_note ? ' · ' + esc(m.decision_note) : ''}`, t, go: { tab: 'davomat' } });
        }
        for (const r of S0.requests || []) {
            const t = Date.parse(r.decided_at); if (!(t > since) || r.status === 'new') continue;
            const p = r.payload || {};
            const late = r.type === 'assist_late'; // yordamchi: kechikkan aloqa so'rovi
            ev.push({ id: `rq:${r.id}:${r.status}`, cat: 'dars', tone: r.status === 'approved' ? 'ok' : 'bad', ic: r.status === 'approved' ? 'ok' : 'no',
                title: `${late ? "Kechikkan aloqa so'rovi" : "Vaqt so'rovi"} ${r.status === 'approved' ? 'tasdiqlandi' : 'rad etildi'}`, sub: [p.date || p.day ? fmtShort(d.day10(p.date || p.day)) : '', p.from && r.type !== 'leave' ? `${p.from}–${p.to}` : '', esc(r.reason || ''), r.decision_note ? esc(r.decision_note) : ''].filter(Boolean).join(' · '), t, go: late ? { push: ['y-kech', ''] } : { tab: 'jadval' } });
        }
        for (const h of S0.salary?.history || []) {
            if (!h.end) continue;
            const closed = at(U.addDays(String(h.end).slice(0, 10), 1), 9 * 60), t = Date.parse(h.paidAt) || closed;
            if (t < since || t > Date.now()) continue;
            const m = +String(h.start).slice(5, 7) - 1, payM = (m + 1) % 12;
            ev.push({ id: `sal:${h.start}:${h.status}`, cat: 'maosh', tone: 'ok', ic: 'money', title: `${d.MON[m][0].toUpperCase()}${d.MON[m].slice(1)} ${h.paidAt ? "maoshi to'landi" : 'yopildi'} · ${d.money(h.amount)} so'm`,
                sub: h.paidAt ? `${fmtShort(d.tz(h.paidAt).date)} kartangizga` : `e'tiroz 4-${d.MON[payM]}gacha · to'lov 5-${d.MON[payM]}`, t, go: { push: ['maosh', ''] } });
        }
        const rt = S0.rating, mine = rt?.rows?.find(r => r.id === rt.selfId);
        if (mine?.prevRank) {
            const pm = d.shiftMonth(n.month, -1), nm = d.MON[+pm.slice(5) - 1];
            ev.push({ id: `rating:${pm}:${mine.prevRank}`, cat: 'boshqa', tone: 'wa', ic: 'cup', title: `${nm[0].toUpperCase()}${nm.slice(1)} reytingi: ${mine.prevRank}-o'rin`,
                sub: `${d.MON[+n.month.slice(5) - 1]}da hozir ${mine.rank}-o'rin${mine.score != null ? ` · ${mine.score} ball` : ''}`, t: at(`${n.month}-01`, 9 * 60), go: { push: ['reyting', ''] } });
        }
        for (const { s, at: from, first } of welcomeCandidates()) {
            const f = firstLesson(s, first);
            ev.push({ id: `new:${s.id}:${from}`, cat: 'dars', tone: 'vio', ic: 'userplus', title: `Yangi o'quvchi: ${esc(d.short(s.name))}`,
                sub: [`${d.patternLabel(s.lessonDayOfWeek)} ${esc(s.lessonTime || '')}`.trim(), `${durOf(s)} daq`, f ? `${+f.slice(8)}-${d.MON[+f.slice(5, 7) - 1]}dan ${f > n.date ? 'boshlaydi' : 'boshlagan'}` : ''].filter(Boolean).join(' · '), t: at(from, 9 * 60), go: { push: ['karta', s.id] } });
        }
        for (const g of d.myGuides()) {
            const t = Date.parse(g.createdAt); if (!(t > since)) continue;
            ev.push({ id: `guide:${g.id}`, cat: 'boshqa', tone: 'mu', ic: 'doc', title: "Yangi yo'riqnoma", sub: esc(g.title || ''), t, go: { push: ['maqola', g.id] } });
        }
        return ev.filter(e => e.t <= Date.now() + 60000).sort((a, b) => b.t - a.t);
    }
    const isUnread = (e, seen = get(K.seen, 0), read = get(K.read, [])) => e.t > seen && !read.includes(e.id);
    const unreadCount = () => { try { const seen = get(K.seen, 0), read = get(K.read, []); return notifEvents().filter(e => isUnread(e, seen, read)).length; } catch { return 0; } };
    function follow(go) {
        if (!go) return;
        if (go.att) { const [sid, date] = go.att; if (U.davomat?.openDay) { U.go('davomat'); setTimeout(() => U.davomat.openDay(sid, date), 0); } else U.go('davomat'); return; }
        if (go.tab) return U.go(go.tab);
        if (go.push) return U.push(go.push[0], go.push[1]);
    }

    // ── 01 · Bosh ──────────────────────────────────────────────────────────
    function heroCard(st) {
        const d = D(), n = d.now(), i = st.next, s = d.stuOf(i.studentId), li = lessonInfo(i.studentId), g = groupOf(i.studentId);
        const diff = i.start - n.min;
        const pill = i.live ? '<span class="pill" style="color: #FECDCA; background: rgba(240,68,56,.24)"><span class="dot live" style="background: #F97066"></span>JONLI</span>'
            : diff > 0 ? `<span class="pill" style="color: #FDE68A; background: rgba(247,144,9,.22)">${diff < 60 ? `${diff} daq qoldi` : `${Math.floor(diff / 60)} soat ${diff % 60 ? (diff % 60) + ' daq ' : ''}qoldi`}</span>`
            : '<span class="pill" style="color: #FDE68A; background: rgba(247,144,9,.22)">boshlash vaqti</span>';
        const sub = [`${i.end - i.start} daq`, s ? d.patternLabel(s.lessonDayOfWeek) : '', g?.tg_link ? 'Telegram guruh' : i.kind === 'makeup' ? 'qoplash darsi' : ''].filter(Boolean).join(' · ');
        const pills = [li.no ? `${li.no}-dars${li.name ? ' · ' + esc(li.name) : ''}` : '', li.reached ? `ilovada ${li.reached}-darsda` : ''].filter(Boolean);
        return `<section class="dark a1" aria-label="${i.live ? 'Jonli dars' : 'Keyingi dars'}">
      ${U.HEX('bsHex')}
      <div style="display: flex; align-items: center; justify-content: space-between"><span class="eb">${i.live ? 'JONLI DARS' : 'KEYINGI DARS'} · ${d.hm(i.start)}</span>${pill}</div>
      <a href="#" data-u-push="karta" data-arg="${esc(i.studentId)}" class="row" style="color: #FFFFFF">
        ${s ? ava(s, 48, ' border: 2px solid rgba(255,255,255,.7)') : ''}
        <div class="col"><strong style="font-size: 20px; font-weight: 800">${esc(s?.name || i.studentName)}</strong><span style="font-size: 13px; color: #C7D2E3">${esc(sub)}</span></div>
      </a>
      ${pills.length ? `<div style="display: flex; gap: 6px; flex-wrap: wrap">${pills.map(p => `<span class="pill" style="color: #FFFFFF; background: rgba(255,255,255,.14)">${p}</span>`).join('')}</div>` : ''}
      <div style="display: flex; gap: 8px">
        <button type="button" class="btn bs-btn p${i.live || reduced() ? '' : ' pulse'}" data-bs-start="${esc(i.studentId)}" style="flex: 1">${i.live ? svg('screen', 18) + 'Darsga qaytish' : U.svg(P.play, 18, 0).replace('fill="none"', 'fill="currentColor"') + 'Darsni boshlash'}</button>
        ${g?.tg_link ? `<a href="${esc(g.tg_link)}" target="_blank" rel="noopener" class="btn gh" aria-label="Telegram guruhini ochish" style="width: 48px; padding: 0; color: #FFFFFF">${svg('tg')}</a>` : ''}
        ${li.no ? `<a href="#" data-u-push="taqdimot" data-arg="${li.no}" class="btn gh" aria-label="${li.no}-dars slaydlarini ochish" style="width: 48px; padding: 0; color: #FFFFFF">${svg('screen')}</a>` : ''}
      </div>
    </section>`;
    }
    function nextDayInfo() {
        const d = D(), n = d.now();
        for (let k = 1; k <= 7; k++) {
            const date = U.addDays(n.date, k), wd = d.wdOf(date);
            const list = S().main.filter(s => !s.frozen && d.patternOf(s).includes(wd) && d.toMin(s.lessonTime) != null).sort((a, b) => d.toMin(a.lessonTime) - d.toMin(b.lessonTime));
            if (list.length) return { date, s: list[0] };
        }
        return null;
    }
    function emptyCard(st) {
        const d = D(), n = d.now(), nd = nextDayInfo();
        const finished = st.total > 0;
        const when = nd ? (nd.date === U.addDays(n.date, 1) ? 'Ertaga' : `${d.DAY_FULL[d.wdOf(nd.date) - 1]} kuni`) : '';
        const text = `${finished ? 'Barakalla!' : `${d.DAY_FULL[n.wd - 1]} — dam oling.`}${nd ? ` ${when} birinchi dars ${esc(nd.s.lessonTime)} da, ${esc(d.first(nd.s.name))} bilan.` : ''}`;
        return `<div class="card a1" style="align-items: center; text-align: center; gap: 8px; padding: 22px 16px">
      <div class="bs-flt" style="width: 96px; height: 96px; border-radius: 50%; background: ${finished ? '#ECFDF3' : '#EAF3FF'}; display: grid; place-items: center">${U.svg(finished ? P.tick : P.mug, 48, 1.6).replace('stroke="currentColor"', `stroke="${finished ? '#067647' : '#0065D6'}"`)}</div>
      <strong style="font-size: 18px; font-weight: 800">${finished ? 'Bugungi darslar tugadi' : "Bugun dars yo'q"}</strong>
      <span class="s">${text}</span>
      <a href="#" data-u-go="jadval" class="btn sm" style="margin-top: 4px; min-height: 44px; color: #0057B8">${nd && nd.date === U.addDays(n.date, 1) ? 'Ertangi jadval' : 'Jadval'}</a>
    </div>`;
    }
    function kpis(st) {
        const d = D(), n = d.now(), S0 = S();
        const pct = st.total ? Math.round(st.done / st.total * 100) : 0;
        // Sinov: eng yaqin tasdiqlangan sinov; bo'lmasa tasdiq yoki natija kutayotganlar (Jadval → Sinov darslari).
        const tr = (S0.trials || []).map(l => ({ l, p: d.trialPhase(l), a: d.tAt(l) })).filter(x => x.a);
        const up = tr.filter(x => x.p === 'upcoming').sort((a, b) => a.a.t - b.a.t)[0];
        const pend = tr.filter(x => x.p === 'pending').length, res = tr.filter(x => x.p === 'result').length;
        let sv;
        if (up) sv = [up.a.date === n.date ? 'Sinov' : `Sinov · ${relDay(up.a.date)}`, d.hm(up.a.min), `${esc(d.first(up.l.name))} · ${Number(up.l.durationMin) || 30} daq`];
        else if (pend) sv = ['Sinov', `${pend} ta`, 'tasdiqlang'];
        else if (res) sv = ['Sinov', `${res} ta`, 'natija yozing'];
        else sv = ['Sinov', '—', 'rejada yo\'q'];
        // Maosh: o'tgan oy (yopilgan, 5-sanada to'lanadi) — bo'lmasa joriy oy hozirgacha.
        const prevM = d.shiftMonth(n.month, -1), hist = (S0.salary?.history || []).find(h => String(h.start || '').slice(0, 7) === prevM);
        const cur = S0.salary?.current, curTotal = cur ? (cur.total ?? cur.amount ?? null) : (S0.salary?.total ?? null);
        let mv;
        if (hist) { const m = mln(hist.amount); mv = [hist.paidAt ? `${fmtShort(d.tz(hist.paidAt).date)} · to'landi` : `5-${d.MON[+n.month.slice(5) - 1]}`, m, `${d.MON[+prevM.slice(5) - 1]} maoshi`]; }
        else if (curTotal != null) { const m = mln(curTotal); mv = [`${d.MON[+n.month.slice(5) - 1]} · hozirgacha`, m, 'belgilangan darslar']; }
        else mv = ['Maosh', { v: '—', u: '' }, 'batafsil'];
        const sm = 'font-size: 13px; color: #4B5563; font-weight: 600';
        return `<div class="kp a2">
      <div class="k"><span>Bugun</span><strong>${st.done}<span style="${sm}"> / ${st.total} o'tdi</span></strong><div class="prog" aria-hidden="true"><i class="g" style="width: ${pct}%"></i></div></div>
      <a class="k" href="#" data-u-go="jadval" style="border-color: #E9D7FE" aria-label="Sinov darslari"><span>${sv[0]}</span><strong style="color: #6941C6">${sv[1]}</strong><span style="color: #6941C6">${sv[2]}</span></a>
      <a class="k" href="#" data-u-push="maosh" aria-label="Maosh"><span>${esc(mv[0])}</span><strong>${mv[1].v}<span style="${sm}">${mv[1].u}</span></strong><span style="color: #067647">${esc(mv[2])}</span></a>
    </div>`;
    }
    function rowOf(i, st) {
        const d = D(), n = d.now(), s = i.studentId && d.stuOf(i.studentId), dur = i.end - i.start;
        const isNext = st.next === i, past = n.min >= i.end;
        let pill, sub = `${dur} daq`;
        if (i.kind === 'trial') { pill = '<span class="pill vio">Sinov</span>'; sub = `sinov darsi · ${dur} daq`; }
        else if (i.live) pill = '<span class="pill bad"><span class="dot live" style="background: #D92D20"></span>Jonli</span>';
        else if (i.mark === 'present') pill = '<span class="pill ok">Keldi</span>';
        else if (i.mark === 'absent') pill = '<span class="pill bad">Kelmadi</span>';
        else if (i.kind === 'makeup') pill = `<span class="pill vio">Qoplash</span>`;
        else if (past) pill = '<span class="pill mu">O&#39;tdi</span>';
        else if (isNext) { const df = i.start - n.min; pill = `<span class="pill inf">${df <= 0 ? 'Hozir' : df < 60 ? df + ' daq' : d.hm(i.start)}</span>`; }
        else pill = '<span class="pill mu">Kutilmoqda</span>';
        if (i.kind === 'makeup') sub = `qoplash · ${dur} daq`;
        if (i.studentId && i.kind !== 'trial') {
            const ses = sessionToday(i.studentId);
            if (ses) { const m = isoMin(ses.startedAt); if (m != null) sub += m <= i.start + 5 ? " · o'z vaqtida boshlandi" : ` · ${m - i.start} daq kech boshlandi`; }
            if (isNext && !i.live) sub += ' · keyingi';
        }
        const tm = i.mark !== 'empty' || past ? '<span class="tm mut">' : isNext ? '<span class="tm" style="color: #0057B8">' : '<span class="tm">';
        const pic = i.kind === 'trial' ? `<span class="vio" style="width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 800; flex: none">${initials(i.leadName)}</span>` : s ? ava(s, 36) : '<span style="width: 36px; flex: none"></span>';
        const name = i.kind === 'trial' ? d.short(i.leadName || 'Sinov darsi') : d.short(s?.name || i.studentName || '');
        const attrs = i.kind === 'trial' ? 'data-u-go="jadval"' : s ? `data-u-push="karta" data-arg="${esc(s.id)}"` : '';
        return `<a class="li" href="#" ${attrs}>${tm}${d.hm(i.start)}</span>${pic}<div class="col g1"><span class="nm">${esc(name)}</span><span class="s">${esc(sub)}</span></div>${pill}</a>`;
    }
    U.tab('home', {
        render() {
            const d = D(), S0 = S(), n = d.now(), st = dayState(), unread = unreadCount();
            if (st.items.some(i => i.studentId)) { nextLessons(st.items.map(i => i.studentId)); groups(); sessions(); }
            return `<header class="hd">
    <a href="#" data-u-push="profil" aria-label="Profil" style="position: relative; flex: none">${meAvatar()}<span aria-hidden="true" style="position: absolute; right: 0; bottom: 0; width: 12px; height: 12px; border-radius: 50%; background: ${navigator.onLine === false ? '#94A3B8' : '#12B76A'}; border: 2px solid #F5F7FB"></span></a>
    <div class="t"><span class="date">${U.dateLong(n.date)}</span><h1>${greet()}, ${esc(d.first(S0.me?.name || S0.user?.name))}</h1></div>
    <a class="icb" href="#" data-u-push="bildirish" aria-label="Bildirishnomalar${unread ? `, ${unread} ta yangi` : ''}">${svg('bell')}${unread ? `<span class="n">${unread > 99 ? '99+' : unread}</span>` : ''}</a>
  </header>
  <div class="bd">
    ${U.offline()}
    ${st.next ? heroCard(st) : emptyCard(st)}
    ${kpis(st)}
    ${st.total ? `<section class="a3" style="display: flex; flex-direction: column; gap: 8px; flex: none">
      <div class="sh"><h2>Bugun · ${st.total}</h2><a href="#" data-u-go="jadval" style="min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: flex-end">Jadval</a></div>
      <div class="card l bs-today">${st.items.map(i => rowOf(i, st)).join('')}</div>
    </section>` : ''}
  </div>`;
        },
        bind(root) {
            root.querySelectorAll('[data-bs-start]').forEach(b => b.onclick = () => startLesson(b.dataset.bsStart));
        },
    });

    // ── Darsni boshlash ────────────────────────────────────────────────────
    const MARK_BEFORE = 15; // server: TEACHER_MARK_BEFORE_MIN — davomat dars boshlanishidan 15 daqiqa oldin ochiladi
    function startLesson(sid) {
        const d = D(), n = d.now(), live = liveOf();
        if (live && live.studentId === sid) return U.push('dars', sid);
        if (live && live.studentId !== sid) { U.toast(`Avval ${d.first(d.stuOf(live.studentId)?.name || '')} bilan darsni tugating`); return U.push('dars', live.studentId); }
        const item = todayItems().find(i => i.studentId === sid && i.kind !== 'trial');
        const s = d.stuOf(sid);
        if (!s) return U.toast("O'quvchi topilmadi");
        const start = item ? item.start : d.toMin(s.lessonTime);
        if (start != null && n.min < start - MARK_BEFORE) return U.toast(`Dars ${d.hm(start)} da — ${d.hm(start - MARK_BEFORE)} dan boshlash mumkin`);
        const li = lessonInfo(sid);
        set(K.live, { studentId: sid, date: n.date, startedAt: new Date().toISOString(), start: start ?? n.min, end: item ? item.end : (start ?? n.min) + durOf(s), lessonNo: li.no, lessonId: li.lessonId, lang: li.lang });
        U.push('dars', sid);
    }

    // ── 03 · Jonli dars ────────────────────────────────────────────────────
    const mmss = ms => { const t = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
    function livePage(sid) {
        const d = D(), s = d.stuOf(sid);
        if (!s) return `<div class="bar"><a class="back" href="#" data-u-back>${U.svg(P.back, 22, 2.2)}Bosh</a><span class="mid">Jonli dars</span><span style="width: 64px"></span></div>
      <div class="bd nb" style="padding-top: 10px"><div class="note w" role="alert"><span>O'quvchi topilmadi yoki sizga biriktirilmagan.</span></div></div>`;
        const live = liveOf(), on = live && live.studentId === sid;
        const done = get(K.done, null);
        if (!on && done && done.studentId === sid && done.date === d.now().date && done.present) return tabrikPage(done);
        const li = on && live.lessonNo ? { ...lessonInfo(sid), no: live.lessonNo } : lessonInfo(sid);
        const f = li.no ? facts(lessonData(li.no, li.lang).data) : null;
        const item = todayItems().find(i => i.studentId === sid && i.kind !== 'trial');
        const dur = item ? item.end - item.start : durOf(s);
        const g = groupOf(sid), pr = S().progress[sid];
        const startedMin = on ? isoMin(live.startedAt) : null, plan = on ? live.start : item ? item.start : d.toMin(s.lessonTime);
        const el = on ? Date.now() - Date.parse(live.startedAt) : 0;
        const endAt = (startedMin ?? plan ?? 0) + dur;
        const late = on && plan != null ? startedMin - plan : 0;
        const det = detail(sid), dd = det.data;
        const withRes = (dd?.lessons || []).filter(l => (l.results || []).length);
        const last = withRes.slice(-1)[0], steps = last?.steps || {};
        const upd = withRes.flatMap(l => (l.results || []).map(r => r.updatedAt)).filter(Boolean).sort().slice(-1)[0];
        const mk = withRes.slice(-6).reverse().flatMap(l => (l.results || []).flatMap(r => r.mistakes || []))[0];
        const ft = pr?.firstTryAvg != null ? Math.round(pr.firstTryAvg) : null;
        const hw = last ? (steps.homeworkTotal ? (steps.homeworkDone >= steps.homeworkTotal ? ['bajarildi', '#067647'] : [`${steps.homeworkDone}/${steps.homeworkTotal}`, '#93370D']) : [`${Math.round(last.percent ?? 0)}%`, (last.percent ?? 0) >= 100 ? '#067647' : '#93370D']) : null;
        const tile = (ic, icStyle, title, sub, attrs) => `<a class="bs-tl" href="#" ${attrs}><span class="bs-tic ${icStyle.cls || ''}"${icStyle.st ? ` style="${icStyle.st}"` : ''}>${svg(ic)}</span><b>${title}</b><span class="xs">${sub}</span></a>`;
        return `<div class="bar">
    <a class="back" href="#" data-u-back>${U.svg(P.back, 22, 2.2)}Bosh</a>
    <span class="mid">Jonli dars</span>
    ${on ? '<span class="pill bad" style="margin-right: 8px"><span class="dot live" style="background: #D92D20"></span>JONLI</span>' : '<span style="width: 64px"></span>'}
  </div>
  <div class="bd" style="padding-bottom: 104px; padding-top: 10px">
    ${U.offline()}
    <section class="dark a1">
      ${U.HEX('bsdHex')}
      <div class="row">
        ${ava(s, 52, ' border: 2px solid rgba(255,255,255,.7)')}
        <div class="col g1"><strong style="font-size: 19px; font-weight: 800">${esc(s.name)}</strong><span style="font-size: 13px; color: #C7D2E3">${esc([li.no ? `${li.no}-dars` : '', f?.topic || f?.name || li.name, `${dur} daq`].filter(Boolean).join(' · '))}</span></div>
      </div>
      <div style="display: flex; align-items: baseline; justify-content: space-between"><strong data-bs-timer style="font-size: 40px; font-weight: 800; letter-spacing: -.03em; font-variant-numeric: tabular-nums">${mmss(el)}</strong><span style="font-size: 13px; color: #C7D2E3">/ ${String(dur).padStart(2, '0')}:00 · ${d.hm(endAt)} da ${on ? 'tugaydi' : 'tugashi kerak'}</span></div>
      <div class="prog" style="background: rgba(255,255,255,.18)" aria-hidden="true"><i data-bs-prog style="width: ${Math.min(100, el / (dur * 600))}%; background: #3B8BEE"></i></div>
      ${on ? (late <= 5 ? `<span class="pill" style="align-self: flex-start; color: #ABEFC6; background: rgba(18,183,106,.18)">${d.hm(startedMin)} da boshlandi · o'z vaqtida</span>`
        : `<span class="pill" style="align-self: flex-start; color: #FDE68A; background: rgba(247,144,9,.22)">${d.hm(startedMin)} da boshlandi · ${late} daq kech</span>`)
        : `<span class="pill" style="align-self: flex-start; color: #C7D2E3; background: rgba(255,255,255,.12)">${plan != null ? `Dars ${d.hm(plan)} da · hali boshlanmagan` : 'Hali boshlanmagan'}</span>`}
    </section>

    <div class="a2" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; flex: none">
      ${g?.tg_link ? tile('video', { cls: 'inf' }, 'Telegram guruh', 'videochatga kirish', `href="${esc(g.tg_link)}" target="_blank" rel="noopener"`).replace('href="#" ', '')
        : tile('video', { cls: 'mu' }, 'Telegram guruh', groups().loading ? 'yuklanmoqda…' : "guruh havolasi yo'q", 'aria-disabled="true" data-bs-nogroup')}
      ${tile('screen', { st: 'background: #0065D6; color: #FFFFFF' }, 'Slaydlar', f?.slides ? `${f.slides} ta · ekranni ulashish` : 'ekranni ulashish', li.no ? `data-u-push="taqdimot" data-arg="${li.no}"` : 'aria-disabled="true"')}
      ${tile('book', { cls: 'wa' }, 'Ustoz kitobi', f?.teacherBook ? `${f.teacherBook} · dars rejasi` : 'dars rejasi', li.no ? `data-u-push="darshub" data-arg="${li.no}"` : 'aria-disabled="true"')}
      ${tile('pen', { cls: 'mu' }, 'Doska', 'yozish va chizish', li.no ? `data-u-push="taqdimot"` : 'aria-disabled="true"')}
    </div>

    <section class="card a3" aria-labelledby="bsHol">
      <div class="sh" style="padding: 0"><h2 id="bsHol" style="font-size: 16px">O'quvchi holati</h2><span class="xs">ilovadan${upd ? ' · ' + esc(d.stamp(upd)) : ''}</span></div>
      <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">
        <div class="col"><span class="xs b">Erishgan</span><strong style="font-size: 18px">${li.reached ?? pr?.reached ?? '—'}<span class="xs"> / 72</span></strong></div>
        <div class="col"><span class="xs b">1-urinish</span><strong style="font-size: 18px; color: ${ft == null ? '#0B1220' : ft >= 80 ? '#067647' : '#93370D'}">${ft != null ? ft + '%' : '—'}</strong></div>
        <div class="col"><span class="xs b">${last ? `${last.no}-vazifa` : 'Vazifa'}</span><strong style="font-size: 18px; color: ${hw ? hw[1] : '#0B1220'}">${hw ? hw[0] : det.loading && !dd ? '…' : '—'}</strong></div>
      </div>
      ${det.err && !dd ? U.err(det, `bs:det:${sid}`) : mk ? `<div class="note w" style="padding: 10px 12px">${U.svg(P.info, 18).replace('aria-hidden="true"', 'aria-hidden="true" style="flex: none; margin-top: 1px"')}<span><b>Ko'p xato:</b> ${esc(mk.question || mk.prompt || '')}${mk.correctAnswer ? ` — to'g'risi: "${esc(mk.correctAnswer)}"` : ''}. Darsning boshida 5 daqiqa takrorlang.</span></div>` : ''}
    </section>
  </div>
  <div class="bs-foot">
    ${on ? `<button type="button" class="btn bs-btn p" data-bs-finish style="flex: 1; height: 54px; font-size: 16px">${U.svg('<rect x="6" y="6" width="12" height="12" rx="2"></rect>', 18, 0).replace('fill="none"', 'fill="currentColor"')}Darsni tugatish</button>`
        : `<button type="button" class="btn bs-btn p" data-bs-start="${esc(sid)}" style="flex: 1; height: 54px; font-size: 16px">${U.svg(P.play, 18, 0).replace('fill="none"', 'fill="currentColor"')}Darsni boshlash</button>`}
  </div>`;
    }
    U.page('dars', {
        render: sid => livePage(sid),
        bind(root, sid) {
            root.querySelector('[data-bs-start]')?.addEventListener('click', () => { startLesson(sid); U.render(); });
            root.querySelector('[data-bs-finish]')?.addEventListener('click', () => openFinish(sid));
            root.querySelector('[data-bs-nogroup]')?.addEventListener('click', e => { e.preventDefault(); U.toast("Dars guruhi hali ochilmagan — admin bilan bog'laning"); });
            root.querySelectorAll('.bs-tl[aria-disabled="true"]:not([data-bs-nogroup])').forEach(a => a.onclick = e => e.preventDefault());
            bindTabrik(root);
        },
    });

    // ── 04 · Darsni tugatish — davomat ─────────────────────────────────────
    const REASONS = [['sick', 'Kasal'], ['travel', 'Safarda / band'], ['noanswer', 'Aloqaga chiqmadi'], ['other', 'Boshqa']];
    function openFinish(sid) {
        const d = D(), s = d.stuOf(sid), live = liveOf();
        if (!s || !live || live.studentId !== sid) return;
        const startedMin = isoMin(live.startedAt), endMin = minNow(), mins = Math.max(1, Math.round((Date.now() - Date.parse(live.startedAt)) / 60000));
        const delegate = typeof U.davomat?.openDay === 'function';
        U.sheet(`<div class="row">
      ${ava(s, 44)}
      <div class="col g1"><h2 id="bsYk" style="font-size: 20px; font-weight: 800">Darsni tugatasizmi?</h2><span class="s">${esc(d.first(s.name))} · ${d.hm(startedMin)}–${d.hm(endMin)} · ${mins} daqiqa</span></div>
    </div>
    <fieldset style="border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px">
      <legend class="xs b" style="padding: 0 0 8px; letter-spacing: .04em">DAVOMAT</legend>
      <button type="button" class="opt on" aria-pressed="true" data-p="1"><span class="rad" aria-hidden="true"></span><span class="col g1"><b style="font-size: 15px">Keldi</b><span class="xs">dars hisobga o'tadi</span></span><span class="pill ok">1 dars</span></button>
      <button type="button" class="opt" aria-pressed="false" data-p="0"><span class="rad" aria-hidden="true"></span><span class="col g1"><b style="font-size: 15px">Kelmadi</b><span class="xs">${delegate ? "sababi Davomat oynasida so'raladi" : "sababi so'raladi · shu oy ichida qoplash mumkin"}</span></span></button>
    </fieldset>
    <div class="bs-rs" data-reasons hidden><span class="xs b" style="letter-spacing: .04em">SABABI</span><div class="bs-rch">${REASONS.map(([k, l]) => `<button type="button" class="chip" data-r="${k}" aria-pressed="false">${l}</button>`).join('')}</div>
      <div class="fl"><label for="bsIz">Izoh · ixtiyoriy</label><textarea id="bsIz" maxlength="300" placeholder="Masalan: ota-onasi ogohlantirdi"></textarea></div></div>
    <button type="button" class="btn bs-btn p w" data-save style="height: 54px; font-size: 16px">Saqlash va tugatish</button>
    <span class="xs" data-msg role="status" style="text-align: center; min-height: 20px">Kerak bo'lsa, Davomat bo'limida shu oy ichida o'zgartirasiz</span>`,
        (el, close) => {
            let present = true, reason = '';
            const msg = el.querySelector('[data-msg]'), reasons = el.querySelector('[data-reasons]'), save = el.querySelector('[data-save]');
            el.setAttribute('aria-labelledby', 'bsYk');
            el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
                present = b.dataset.p === '1';
                el.querySelectorAll('[data-p]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
                reasons.hidden = present || delegate;
                save.textContent = present ? 'Saqlash va tugatish' : delegate ? 'Tugatish va sababini yozish' : 'Kelmadi — saqlash';
            });
            el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { reason = b.dataset.r; msg.style.color = ''; msg.textContent = ''; el.querySelectorAll('[data-r]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); });
            save.onclick = async () => {
                if (!present && delegate) { set(K.live, null); close(); U.go('home'); setTimeout(() => U.davomat.openDay(sid, live.date), 0); return; }
                if (!present && !reason) { msg.textContent = 'Sababini tanlang'; msg.style.color = '#B42318'; return; }
                el.querySelectorAll('button, textarea').forEach(x => { x.disabled = true; });
                msg.style.color = ''; msg.textContent = 'Saqlanmoqda…';
                const r = await saveAttendance(s, live, present, { reasonCode: reason, reasonNote: el.querySelector('#bsIz')?.value.trim() || '', heldFrom: d.hm(startedMin), heldTo: d.hm(Math.max(endMin, startedMin + 1)), mins });
                if (r.error) { msg.textContent = r.error; msg.style.color = '#B42318'; el.querySelectorAll('button, textarea').forEach(x => { x.disabled = false; }); return; }
                close();
                if (present) { U.render(); if (!r.queued) U.confetti(); }
                else { U.toast(r.queued ? "Internet yo'q — telefonda saqlandi, keyin yuboriladi" : `${d.first(s.name)} · Kelmadi · saqlandi`, { ok: !r.queued }); U.go('home'); }
            };
        }, { label: 'Darsni tugatish' });
    }
    async function saveAttendance(s, live, present, o) {
        const d = D(), S0 = S(), date = live.date;
        const body = { teacherId: S0.me.id, studentId: s.id, date, present, attendanceType: 'main', requireReason: true };
        if (present) { body.heldFrom = o.heldFrom; body.heldTo = o.heldTo; }
        else { body.reasonCode = o.reasonCode; if (o.reasonNote) body.reasonNote = o.reasonNote; }
        const before = S0.salary?.current?.total;
        let queued = false;
        try {
            // Shu dars aynan o'tilgan jonli dars sifatida (o'quvchi kursida bo'lmasa — server o'zi tanlaydi) — js/lessonStart.js.
            if (present && live.lessonId) {
                try { await api('/api/state/teacher-attendance', { method: 'POST', body: { ...body, grade: { lessonId: live.lessonId } } }); }
                catch (err) { if (/tegishli emas/i.test(err.message)) await api('/api/state/teacher-attendance', { method: 'POST', body }); else throw err; }
            } else await api('/api/state/teacher-attendance', { method: 'POST', body });
        } catch (err) {
            if (!err.network) return { error: err.message };
            // Internet yo'q — eski ilovadagi outbox (ulanganda flushOutbox yuboradi).
            const ob = d.outbox().filter(x => !(x.body.studentId === s.id && x.body.date === date));
            d.store.set(d.OUTBOX, [...ob, { body, label: `${d.first(s.name)} · ${fmtShort(date)} · ${present ? 'Keldi' : 'Kelmadi'}`, at: Date.now() }]);
            queued = true;
        }
        d.setAtt(s.id, date, present);
        set(K.live, null);
        if (!queued && present) api('/api/academic/sessions', { method: 'POST', body: { studentId: s.id, startedAt: live.startedAt, endedAt: new Date().toISOString(), lessonNo: live.lessonNo } })
            .then(() => U.drop('bs:ses:')).catch(() => {});
        U.drop('bs:nx:');
        if (present) {
            const done = { studentId: s.id, date, present, lessonNo: live.lessonNo, startedAt: live.startedAt, plan: live.start, mins: o.mins, queued, delta: null };
            set(K.done, done);
            if (!queued && before != null) api('/api/payroll/me').then(r => {
                S0.salary = r; const after = r?.current?.total;
                const cur = get(K.done, null);
                if (cur && cur.startedAt === done.startedAt && after != null) { cur.delta = Math.round(after - before); set(K.done, cur); U.render(); }
            }).catch(() => {});
        }
        return { ok: true, queued };
    }

    // ── 04b · Dars yakunlandi — tabrik ─────────────────────────────────────
    function tabrikPage(done) {
        const d = D(), S0 = S(), s = d.stuOf(done.studentId), n = d.now(), st = dayState();
        const ses = (sessions().data || []).filter(x => x.date === n.date);
        const started = st.items.filter(i => i.studentId && i.kind !== 'trial').map(i => {
            const x = ses.filter(y => y.studentId === i.studentId).slice(-1)[0] || (i.studentId === done.studentId ? { startedAt: done.startedAt } : null);
            return x ? (isoMin(x.startedAt) ?? 0) <= i.start + 5 : null;
        }).filter(v => v != null);
        const mine = S0.rating?.rows?.find(r => r.id === S0.rating.selfId);
        const nxt = st.items.find(i => i.start >= n.min && i.mark === 'empty' && !(i.studentId === done.studentId));
        const nxtName = nxt ? (nxt.kind === 'trial' ? nxt.leadName : d.stuOf(nxt.studentId)?.name || nxt.studentName) : '';
        const anim = c => reduced() ? '' : c;
        return `<div class="bs-tb">
    <div style="display: flex; justify-content: flex-end; padding: 12px 12px 0; position: relative; z-index: 2"><a href="#" data-bs-home class="icb" aria-label="Yopish" style="border: 0; background: #F1F5F9">${U.svg(P.x, 18, 2.4)}</a></div>
    <div class="bs-tbb">
      <div class="${anim('bs-pc')}" style="position: relative; width: 116px; height: 116px; border-radius: 50%; background: #ECFDF3; display: grid; place-items: center; flex: none">
        <span class="${anim('bs-halo')}" aria-hidden="true"></span>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#067647" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="${anim('bs-ck')}" d="M5 12.5l4.5 4.5L19 7.5"></path></svg>
      </div>
      <div class="col ${anim('bs-u1')}" style="align-items: center; gap: 6px">
        <h1 style="font-size: 28px; font-weight: 800; letter-spacing: -.02em">Barakalla, ${esc(d.first(S0.me?.name || S0.user?.name))}!</h1>
        <span class="s" style="font-size: 15px">${esc(d.first(s?.name || ''))} bilan ${done.lessonNo ? done.lessonNo + '-dars' : 'dars'} yakunlandi · Keldi</span>
      </div>
      ${done.queued ? `<div class="note w ${anim('bs-u2')}" style="width: 100%; text-align: left"><span>Internet yo'q — belgi telefonda saqlandi, ulanganda o'zi yuboriladi.</span></div>`
        : done.delta > 0 ? `<div class="${anim('bs-u2')}" style="background: #0B1220; color: #FFFFFF; border-radius: 20px; padding: 14px 18px; display: flex; align-items: center; gap: 12px; width: 100%">
        <span style="width: 44px; height: 44px; border-radius: 14px; background: rgba(18,183,106,.2); color: #6CE9A6; display: grid; place-items: center; flex: none">${svg('money', 22)}</span>
        <div class="col g1" style="align-items: flex-start"><strong style="font-size: 22px; font-weight: 800; color: #6CE9A6">+${d.money(done.delta)} so'm</strong><span style="font-size: 13px; color: #C7D2E3">${d.MON[+n.month.slice(5) - 1]} maoshiga qo'shildi</span></div>
      </div>` : ''}
      <div class="kp ${anim('bs-u3')}" style="width: 100%">
        <div class="k" style="align-items: center"><span>Bugun</span><strong>${st.done}<span style="font-size: 13px; color: #4B5563"> / ${st.total}</span></strong></div>
        <div class="k" style="align-items: center"><span>Vaqtida</span><strong style="color: ${started.length && started.every(Boolean) ? '#067647' : '#0B1220'}">${started.filter(Boolean).length} / ${started.length}</strong></div>
        <div class="k" style="align-items: center"><span>Reyting</span><strong>${mine ? `${mine.rank}-o'rin` : '—'}</strong></div>
      </div>
      ${nxt ? `<div class="card ${anim('bs-u3')}" style="width: 100%; flex-direction: row; align-items: center; text-align: left; margin-top: auto">
        ${nxt.kind === 'trial' ? `<span style="width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 800; background: #F4EBFF; color: #6941C6; flex: none">${initials(nxtName)}</span>` : ava(d.stuOf(nxt.studentId), 40)}
        <div class="col g1"><span class="xs b" style="color: ${nxt.kind === 'trial' ? '#6941C6' : '#0057B8'}">KEYINGI · ${d.hm(nxt.start)}${nxt.kind === 'trial' ? ' · SINOV DARSI' : nxt.kind === 'makeup' ? ' · QOPLASH' : ''}</span><span class="nm">${esc(nxtName)} · ${nxt.end - nxt.start} daq</span></div>
      </div>` : '<span style="margin-top: auto"></span>'}
      <a href="#" data-bs-home class="btn p w" style="height: 54px; font-size: 16px; color: #FFFFFF; flex: none">Bosh sahifaga</a>
    </div>
  </div>`;
    }
    function bindTabrik(root) {
        root.querySelectorAll('[data-bs-home]').forEach(a => a.onclick = e => { e.preventDefault(); set(K.done, null); U.go('home'); });
    }
    // Hash orqali to'g'ridan ko'rish uchun (#home~tabrik:<id>) — oxirgi yakunlangan dars.
    U.page('tabrik', {
        render() { const done = get(K.done, null); return done?.present ? tabrikPage(done) : '<div class="bar"><a class="back" href="#" data-u-back>Bosh</a><span class="mid">Dars</span><span style="width: 64px"></span></div><div class="bd nb"><div class="note i"><span>Yakunlangan dars yo\'q.</span></div></div>'; },
        bind: root => bindTabrik(root),
    });

    // ── 02 · Bildirishnomalar ──────────────────────────────────────────────
    const CATS = [['all', 'Hammasi'], ['dars', 'Darslar'], ['sinov', 'Sinov'], ['davomat', 'Davomat'], ['maosh', 'Maosh']];
    let cat = 'all', lastEv = [];
    U.page('bildirish', {
        render() {
            const seen = get(K.seen, 0), read = get(K.read, []);
            const all = notifEvents(); lastEv = all;
            const unread = all.filter(e => isUnread(e, seen, read));
            const list = all.filter(e => cat === 'all' || e.cat === cat);
            const fresh = list.filter(e => isUnread(e, seen, read)), old = list.filter(e => !isUnread(e, seen, read)).slice(0, 30);
            const today = D().now().date, allToday = fresh.every(e => D().tz(new Date(e.t).toISOString())?.date === today);
            const item = (e, isNew) => `<a class="bs-nt ${isNew ? 'new' : 'old'}" href="#" data-bs-ev="${esc(e.id)}"><span class="bs-ic ${e.tone}">${svg(e.ic)}</span><div class="col g1"${isNew ? ' style="padding-right: 16px"' : ''}><span class="bs-tt" style="font-size: 14px; font-weight: ${isNew ? 700 : 600}">${e.title}</span><span class="s">${e.sub}</span><span class="xs" style="margin-top: 4px">${esc(D().stamp(new Date(e.t).toISOString()).replace(/^bugun /, ''))}</span></div>${isNew ? '<span class="bs-un" aria-label="O\'qilmagan"></span>' : ''}</a>`;
            return `<div class="bar">
    <a class="back" href="#" data-u-back>${U.svg(P.back, 22, 2.2)}Bosh</a>
    <span class="mid">Bildirishnomalar</span>
    ${unread.length ? '<button type="button" class="bs-rdall" data-bs-readall>O\'qildi</button>' : '<span style="width: 64px"></span>'}
  </div>
  <div class="bd nb" style="padding-top: 10px">
    <div class="chips bs-chips" role="group" aria-label="Turi">${CATS.map(([k, l]) => { const c = k === 'all' ? unread.length : 0; return `<button type="button" class="chip${cat === k ? ' on' : ''}" data-bs-cat="${k}" aria-pressed="${cat === k}">${l}${c ? ` · ${c}` : ''}</button>`; }).join('')}</div>
    ${fresh.length ? `<div class="xs b" style="letter-spacing: .06em; padding: 4px 4px 0">${allToday ? 'BUGUN' : 'YANGI'}</div><div class="card l a1">${fresh.map(e => item(e, true)).join('')}</div>` : ''}
    ${old.length ? `<div class="xs b" style="letter-spacing: .06em; padding: 4px 4px 0">${fresh.length ? 'OLDINROQ' : "O'QILGAN"}</div><div class="card l a2">${old.map(e => item(e, false)).join('')}</div>` : ''}
    ${!list.length ? `<div class="card a1" style="align-items: center; text-align: center; gap: 8px; padding: 22px 16px">
      <div style="width: 96px; height: 96px; border-radius: 50%; background: #EAF3FF; display: grid; place-items: center; color: #0065D6">${svg('bell', 44, 1.6)}</div>
      <strong style="font-size: 18px; font-weight: 800">Hozircha xabar yo'q</strong>
      <span class="s">Dars, sinov, davomat va maosh xabarlari shu yerda chiqadi.</span></div>` : ''}
    <span class="xs" style="padding: 0 4px">Bu ro'yxat ilovani ochganingizda jadval, davomat, sinov va maoshdan yig'iladi.</span>
  </div>`;
        },
        bind(root) {
            root.querySelectorAll('[data-bs-cat]').forEach(b => b.onclick = () => { cat = b.dataset.bsCat; U.render(); });
            root.querySelector('[data-bs-readall]')?.addEventListener('click', () => { set(K.seen, Date.now()); set(K.read, []); U.render(); });
            root.querySelectorAll('[data-bs-ev]').forEach(a => a.onclick = e => {
                e.preventDefault();
                const ev = lastEv.find(x => x.id === a.dataset.bsEv); if (!ev) return;
                const read = get(K.read, []); if (!read.includes(ev.id)) set(K.read, [...read, ev.id].slice(-300));
                follow(ev.go);
            });
        },
    });

    // ── 08b / 08c · Yangi o'quvchi tabriklari (ilova ochilganda bir marta) ──
    // Manba: S.main — o'quvchining shu ustozga biriktirilgan sanasi (teacherHistory[].from, bo'lmasa startDate) oxirgi 14 kun ichida.
    // Sinovdan kelganmi: student.leadRef.id ustozning sinovlar tarixida (/api/trial-lessons/history) "qatnashdi" (phase:'done') bo'lsa.
    // Ko'rilganlar DWT.store ('dwt_v2_welcome_seen') da — har o'quvchi bir marta.
    function closeOverlay(ov, after) {
        ov.classList.add('out');
        setTimeout(() => { ov.remove(); after?.(); }, reduced() ? 0 : 180);
    }
    function showWelcome(queue) {
        const it = queue.shift(); if (!it) return;
        if (U.activeLock()) return; // qulf (sinov/davomat) ustun — keyingi ochilishda ko'rsatiladi
        const d = D(), s = it.s, n = d.now(), seen = get(K.welcome, []);
        set(K.welcome, [...seen, s.id].slice(-300));
        const g = it.group, fl = firstLesson(s, it.first || it.at);
        const flTxt = fl ? `${d.DAY[d.wdOf(fl) - 1]}, ${+fl.slice(8)}-${d.MON_S[+fl.slice(5, 7) - 1].toLowerCase()} · ${esc(s.lessonTime || '')}` : '—';
        const lang = langOf(s) === 'russian' ? 'Rus tili' : 'Ingliz tili', reached = S().progress[s.id]?.reached;
        const cnt = S().main.filter(x => !x.frozen).length;
        const r = reduced(), a = c => r ? '' : c;
        const facts2 = `<div class="${a('bs-v2')}" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; text-align: left">
        <div class="bs-fc"><span class="xs b">Birinchi dars</span><div style="font-size: 15px; font-weight: 800">${flTxt}</div><span class="xs">${d.patternLabel(s.lessonDayOfWeek)} · ${durOf(s)} daq</span></div>
        <div class="bs-fc"><span class="xs b">Dars guruhi</span><div style="font-size: 15px; font-weight: 800; color: ${g ? '#067647' : '#93370D'}">${g ? 'Tayyor' : 'Kutilmoqda'}</div><span class="xs">${g ? 'Telegram · havola kartada' : 'admin guruh ochadi'}</span></div>
      </div>`;
        let html;
        if (it.trial) {
            const ta = d.tz(it.trial.trialRequest?.scheduledAt);
            const conv = it.conversions;
            const rays = Array.from({ length: 12 }, (_, k) => `<path d="M100 100L95 0h10z"${k ? ` transform="rotate(${k * 30} 100 100)"` : ''}></path>`).join('');
            const burst = [['-120px', '-60px', '#FDB022'], ['118px', '-54px', '#6CE9A6'], ['-96px', '70px', '#FFFFFF'], ['104px', '66px', '#FDB022'], ['-30px', '-90px', '#F97066'], ['40px', '-86px', '#FFFFFF']];
            html = `<section class="bs-mdl ${a('bs-in')}" role="dialog" aria-modal="true" aria-labelledby="bsYs" style="top: 70px">
    <div style="position: relative; height: 188px; background: #0065D6; overflow: hidden; display: grid; place-items: center">
      <svg class="bs-rays${r ? ' still' : ''}" aria-hidden="true" viewBox="0 0 200 200"><g fill="#FFFFFF" opacity=".16">${rays}</g></svg>
      ${r ? '' : burst.map(([x, y, c]) => `<span aria-hidden="true" class="bs-bp" style="--x: ${x}; --y: ${y}; background: ${c}"></span>`).join('')}
      <div class="${a('bs-avp')}" style="position: relative; width: 104px; height: 104px; border-radius: 50%; background: #FFFFFF; display: grid; place-items: center; box-shadow: 0 0 0 8px rgba(255,255,255,.22)">
        <span style="font-size: 34px; font-weight: 800; color: #0057B8">${initials(s.name)}</span>
        <span style="position: absolute; right: -4px; bottom: 2px; width: 36px; height: 36px; border-radius: 50%; background: #12B76A; border: 4px solid #0065D6; display: grid; place-items: center; color: #FFFFFF">${U.svg(P.tick, 16, 3)}</span>
      </div>
    </div>
    <div style="padding: 20px 20px 22px; display: flex; flex-direction: column; gap: 14px; text-align: center">
      <div class="col ${a('bs-v1')}" style="gap: 6px; align-items: center">
        <span class="pill ok">Sinov darsingiz natija berdi</span>
        <h2 id="bsYs" style="font-size: 25px; font-weight: 800; letter-spacing: -.02em; line-height: 1.2">Tabriklaymiz!<br>${esc(d.first(s.name))} endi sizning o'quvchingiz</h2>
        <span class="s">${ta ? `${relDay(ta.date)[0].toUpperCase()}${relDay(ta.date).slice(1)} ${d.hm(ta.min)} dagi sinovdan keyin kursga yozildi` : 'Sinovdan keyin kursga yozildi'}</span>
      </div>
      ${facts2}
      ${conv ? `<div class="${a('bs-v3')}" style="background: #0B1220; color: #FFFFFF; border-radius: 18px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; text-align: left">
        <span style="width: 40px; height: 40px; border-radius: 12px; background: rgba(253,176,34,.2); color: #FDB022; display: grid; place-items: center; flex: none">${svg('cup')}</span>
        <div class="col g1"><b style="font-size: 15px">${d.MON[+n.month.slice(5) - 1][0].toUpperCase()}${d.MON[+n.month.slice(5) - 1].slice(1)}dagi <span class="${a('bs-cn')}" style="color: #FDB022">${conv}-</span>konversiyangiz</b><span style="font-size: 12px; color: #C7D2E3">sinov darsingizdan kursga yozilganlar</span></div>
      </div>` : ''}
      <div style="display: grid; grid-template-columns: 1fr 1.3fr; gap: 8px">
        <button type="button" class="btn bs-btn" data-bs-x style="color: #0057B8">Yopish</button>
        <button type="button" class="btn bs-btn p" data-bs-open="karta">Kartani ochish</button>
      </div>
    </div>
  </section>`;
        } else {
            const stars = [['left: 54px; top: 40px', 18, '#FDB022', 0], ['right: 64px; top: 34px', 12, '#FFFFFF', .5], ['right: 48px; bottom: 44px', 14, '#FDB022', .9], ['left: 70px; bottom: 36px', 10, '#9DC4F5', 1.2]];
            html = `<section class="bs-mdl ${a('bs-in2')}" role="dialog" aria-modal="true" aria-labelledby="bsYb" style="top: 64px">
    <div style="position: relative; height: 196px; background: #0B1220; overflow: hidden; display: grid; place-items: center">
      <span style="position: absolute; inset: 0; opacity: .07">${U.HEX('bsYbHex')}</span>
      ${stars.map(([pos, sz, c, dl]) => `<svg class="${a('bs-st')}" aria-hidden="true" width="${sz}" height="${sz}" viewBox="0 0 24 24" style="position: absolute; ${pos}; animation-delay: ${dl}s"><path d="${P.star.match(/d="([^"]+)"/)[1]}" fill="${c}"></path></svg>`).join('')}
      <div class="${a('bs-avp2')}" style="position: relative; width: 108px; height: 108px">
        <span class="${a('bs-rg')}" aria-hidden="true"></span>
        ${ava(s, 108, ' border: 4px solid #FFFFFF')}
        <span style="position: absolute; right: -6px; top: -4px; height: 28px; padding: 0 10px; border-radius: 999px; background: #FDB022; color: #0B1220; font-size: 13px; font-weight: 800; display: grid; place-items: center; border: 3px solid #0B1220">YANGI</span>
      </div>
    </div>
    <div style="padding: 20px 20px 22px; display: flex; flex-direction: column; gap: 14px; text-align: center">
      <div class="col ${a('bs-v1')}" style="gap: 6px; align-items: center">
        <span class="pill inf">Sizga yangi o'quvchi biriktirildi</span>
        <h2 id="bsYb" style="font-size: 25px; font-weight: 800; letter-spacing: -.02em; line-height: 1.2">${esc(s.name)}<br>sizning jamoangizda!</h2>
        <span class="s">${lang} · ${reached ? `ilovada ${reached}-darsda` : 'noldan boshlaydi'}</span>
      </div>
      ${facts2}
      <div class="${a('bs-v3')}" style="display: flex; align-items: center; justify-content: center; gap: 10px; background: #EAF3FF; border-radius: 18px; padding: 12px 14px">
        <span style="font-size: 15px; font-weight: 700; color: #0B3A73">Endi sizda</span>
        <span style="position: relative; display: inline-block; min-width: 40px; height: 34px; padding: 0 6px; overflow: hidden; background: #0065D6; color: #FFFFFF; border-radius: 10px; font-size: 22px; font-weight: 800; text-align: center; line-height: 34px">${r ? cnt : `<span class="bs-fo">${cnt - 1}</span><span class="bs-fi">${cnt}</span>&nbsp;`}</span>
        <span style="font-size: 15px; font-weight: 700; color: #0B3A73">o'quvchi</span>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1.3fr; gap: 8px">
        <button type="button" class="btn bs-btn" data-bs-x style="color: #0057B8">Yopish</button>
        <button type="button" class="btn bs-btn p" data-bs-open="darslik">${reached ? `${reached}-darsni ko'rish` : "1-darsni ko'rish"}</button>
      </div>
    </div>
  </section>`;
        }
        const ov = document.createElement('div');
        ov.className = 'bs-ov';
        ov.innerHTML = `<div class="bs-ovin"><div class="bs-scr" aria-hidden="true"></div>${html}</div>`;
        document.body.appendChild(ov);
        const next = () => setTimeout(() => showWelcome(queue), 250);
        const close = () => { document.removeEventListener('keydown', onKey); closeOverlay(ov, next); };
        const onKey = e => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        ov.querySelector('[data-bs-x]').onclick = close;
        ov.querySelector('.bs-scr').onclick = close;
        ov.querySelector('[data-bs-open]').onclick = e => {
            const to = e.currentTarget.dataset.bsOpen;
            document.removeEventListener('keydown', onKey); closeOverlay(ov);
            if (to === 'karta') U.push('karta', s.id); else U.push('darslik', reached || 1);
        };
        ov.querySelector('.btn.p').focus({ preventScroll: true, focusVisible: false });
        if (it.trial && !r) U.confetti();
    }
    async function checkWelcome() {
        const seen = get(K.welcome, []);
        const cand = welcomeCandidates().filter(x => !seen.includes(x.s.id));
        if (!cand.length) return;
        const d = D(), meId = S().me?.id, n = d.now();
        const [hist, grp] = await Promise.all([
            cand.some(x => x.s.leadRef?.id) ? api('/api/trial-lessons/history?days=60').then(r => r.history || []).catch(() => []) : Promise.resolve([]),
            api('/api/school/my-groups').then(r => r.groups || []).catch(() => []),
        ]);
        const done = hist.filter(h => h.phase === 'done' && (!h.trialRequest?.teacherId || h.trialRequest.teacherId === meId));
        const convMonth = S().main.filter(s => s.leadRef?.id && done.some(h => h.leadId === s.leadRef.id) && welcomeCandidates().some(c => c.s.id === s.id && c.at.slice(0, 7) <= n.month)).length;
        const queue = cand.map(x => ({ ...x, group: grp.find(g => g.student_id === x.s.id) || null, trial: x.s.leadRef?.id ? done.find(h => h.leadId === x.s.leadRef.id) || null : null }))
            .sort((a, b) => (b.trial ? 1 : 0) - (a.trial ? 1 : 0));
        let k = 0; for (const q of queue) if (q.trial) q.conversions = convMonth - (k++);
        for (const q of queue) if (q.trial && q.conversions < 1) q.conversions = null;
        showWelcome(queue);
    }
    U.onStart.push(() => { setTimeout(() => { checkWelcome().catch(err => console.error('[bosh]', err)); }, 400); });

    // ── Jonli soat va Bosh yangilanishi ────────────────────────────────────
    setInterval(() => {
        if (!window.UstozV2?.active) return;
        const cur = U.current();
        const app = document.getElementById('app');
        if (cur.id === 'dars') {
            const live = liveOf(), t = app?.querySelector('[data-bs-timer]');
            if (live && t && live.studentId === cur.arg) {
                const el = Date.now() - Date.parse(live.startedAt), s = D().stuOf(live.studentId);
                const dur = (live.end - live.start) || durOf(s);
                t.textContent = mmss(el);
                const p = app.querySelector('[data-bs-prog]'); if (p) p.style.width = `${Math.min(100, el / (dur * 600))}%`;
            }
        }
    }, 1000);
    let lastMin = -1;
    setInterval(() => {
        if (!window.UstozV2?.active) return;
        const m = minNow(); if (m === lastMin) return; lastMin = m;
        const cur = U.current();
        if ((cur.id === 'home' || cur.id === 'bildirish') && !document.querySelector('#app > .sheet')) U.render();
    }, 15000);
    // Yordamchi rejimi (yordamchi.js): Bosh va Menyu'dagi bildirishnoma soni — bitta manba.
    U.bs = { unreadCount };
})();
