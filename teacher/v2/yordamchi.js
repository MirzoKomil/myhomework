// Yordamchi ustoz — v2 (1-noyabr 2026 dizayni, kanvas "Domwork Team — Ustoz ilovasi" → sahifa "Yordamchi ustoz", Y01–Y13).
// Ramka, oyna, toast — core.js (U). Ma'lumot — window.DWT (teacher/app.js): S.helped, S.assist (oy hisobi), S.requests, S.progress.
// Aloqa qoidalari serverda (server/services/school/assist.js countMonth) — bu yerda faqat ko'rsatiladi:
//   oyiga 13 tagacha, kamida 5 daqiqa, kuniga 1 ta, yozishma haftasiga 1 ta, "javob bermadi" hisoblanmaydi, shu kuni belgilanadi.
// Abdulloh qarorlari (1-noy): yozishmada daqiqa so'ralmaydi; yordamchida qulf yo'q; kechikkan aloqa faqat shu oy uchun;
//   "haftasiga 3" — faqat ko'rsatkich; yangi o'quvchi biriktirilganda tabrik.
(function () {
    'use strict';
    const U = window.U; if (!U) return;
    const D = () => window.DWT, S = () => D().S;
    const Y = 'yordamchi';
    const esc = s => D().esc(s);
    const svg = (d, n = 20, w = 2) => U.svg(d, n, w);
    const CAP = 13;
    const P = {
        phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z"></path>',
        tg: '<path d="M21 4L3 11l6 2 2 6 3-4 5 4z"></path><path d="M9 13l12-9"></path>',
        tick: '<path d="M5 12l5 5L20 7"></path>',
        x: '<path d="M6 6l12 12M18 6L6 18"></path>',
        bell: '<path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"></path>',
        video: '<path d="M23 7l-7 5 7 5z"></path><rect x="1" y="5" width="15" height="14" rx="2"></rect>',
        group: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path><circle cx="9" cy="7" r="4"></circle>',
        zoom: '<rect x="2" y="5" width="20" height="14" rx="3"></rect><path d="M8 10h8M8 14h5"></path>',
        meet: '<rect x="2" y="5" width="20" height="14" rx="3"></rect><circle cx="12" cy="12" r="3"></circle>',
        msg: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"></path>',
        info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path>',
        warn: '<circle cx="12" cy="12" r="9"></circle><path d="M12 8v5M12 16h.01"></path>',
        clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
        money: '<rect x="2" y="6" width="20" height="13" rx="3"></rect><circle cx="12" cy="12.5" r="2.5"></circle>',
        book: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"></path><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5"></path>',
        box: '<path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"></path>',
        pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"></path>',
        rules: '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>',
        help: '<circle cx="12" cy="12" r="9"></circle><path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01"></path>',
        gear: '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"></path>',
        out: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"></path>',
        chev: '<path d="M9 6l6 6-6 6"></path>', prev: '<path d="M15 6l-6 6 6 6"></path>', down: '<path d="M6 9l6 6 6-6"></path>',
        search: '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path>',
        star: '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"></path>',
    };
    // Belgilash oynasidagi tartib (dizayn Y04: 3 ustun × 2 qator).
    const CH = [['phone', 'Telefon', P.phone], ['tg_video', 'TG video', P.video], ['tg_group', 'Guruh dars', P.group], ['zoom', 'Zoom', P.zoom], ['meet', 'Meet', P.meet], ['tg_text', 'Yozishma', P.msg]];
    const CH_FULL = { phone: 'Telefon', zoom: 'Zoom', meet: 'Google Meet', tg_video: 'Telegram video', tg_group: 'Guruh videodars', tg_text: 'Telegram yozishma' };
    const ST_TXT = { counted: 'Hisoblandi', no_answer: 'Javob bermadi', short: '5 daqiqadan kam', same_day: 'Shu kuni boshqasi hisoblangan', extra_text: 'Haftada 2-yozishma', over_cap: '13 tadan ortiq', before_start: 'Kurs boshlanmagan' };

    // ── Sana va ro'yxat yordamchilari ──
    const now = () => D().now();
    const wd = date => D().wdOf(date);
    const monName = m => D().MON[+m.slice(5) - 1];
    const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
    const days = month => D().cal.cells(month, []).filter(Boolean).map(c => c.date);
    const weekStart = date => U.addDays(date, 1 - wd(date));
    const adviceDays = dow => { const d = Number(dow); if ([1, 3, 5].includes(d)) return [2, 4, 6]; if ([2, 4, 6].includes(d)) return [1, 3, 5]; return [1, 2, 3, 4, 5, 6].filter(x => x !== d); };
    const adviceLabel = s => adviceDays(s.lessonDayOfWeek).map(x => D().DAY[x - 1]).join('·');
    const startOf = s => { const v = String(s?.startDate || s?.joinDate || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; };
    const inPattern = (s, date) => wd(date) !== 7 && adviceDays(s.lessonDayOfWeek).includes(wd(date)) && !(startOf(s) && date < startOf(s));
    const ava = (s, n) => D().avatar(s, `av" style="width: ${n}px; height: ${n}px`);
    const helped = () => (S().helped || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const money = v => D().money(v);
    const thousand = v => `${Math.round((Number(v) || 0) / 1000)}`;
    // Yordamchiga o'quvchi telefoni berilmaydi (server teacherDuties: "qo'ng'iroq Telegram guruh orqali") — bog'lanish dars guruhi orqali.
    const groupsE = () => U.load('yd:grp', () => U.api('/api/school/my-groups').then(r => r.groups || []), { ttl: 600000 });
    const groupLink = s => { const g = (groupsE().data || []).find(x => x.student_id === s.id); return g?.tg_link && /^https:\/\//.test(g.tg_link) ? g.tg_link : ''; };
    // Asosiy ustoz ismi — state.teachers (server faqat o'z o'quvchilarining ustozlarini beradi).
    const teacherOf = s => D().first((S().state?.teachers || []).find(t => t.id === s?.teacherId)?.name || '');
    const capOf = month => Number(repOf(month).data?.cap) || CAP;
    const monthlyOf = month => Number(repOf(month).data?.monthly) || 0;
    // Muzlatish oralig'i (statusHistory yoki Faol emas ro'yxati) — "24-noyabrgacha", "10–24-noy".
    function freezeOf(s) {
        const n = now().date;
        const h = (s.statusHistory || []).filter(x => x.status === 'frozen' && String(x.from || '').slice(0, 10) <= n && (!x.to || String(x.to).slice(0, 10) >= n)).slice(-1)[0]
            || (S().inactive || []).find(x => x.id === s.id && x.state === 'frozen');
        if (!h) return null;
        return { from: String(h.from || '').slice(0, 10), to: h.to ? String(h.to).slice(0, 10) : '' };
    }
    const shortDate = d => `${+d.slice(8)}-${D().MON_S[+d.slice(5, 7) - 1].toLowerCase()}`;
    const longDate = d => `${+d.slice(8)}-${D().MON[+d.slice(5, 7) - 1]}`;
    const greet = () => { const h = now().hour; return h < 11 ? 'Xayrli tong' : h < 18 ? 'Xayrli kun' : 'Xayrli kech'; };

    // ── Oy hisobi (S.assist — joriy, S.assistPrev — o'tgan; boshqalari yuklanadi) ──
    function repOf(month) {
        const n = now();
        if (month === n.month) return { data: S().assist, err: S().assist ? null : 'x' };
        if (month === D().shiftMonth(n.month, -1) && S().assistPrev) return { data: S().assistPrev };
        return U.load(`yd:rep:${month}`, () => U.api(`/api/school/assist/month?month=${month}`), { ttl: 120000 });
    }
    const stuRep = (month, sid) => (repOf(month).data?.students || []).find(x => x.studentId === sid) || { counted: 0, noAnswer: 0, items: [] };
    const itemsOn = (month, sid, date) => (stuRep(month, sid).items || []).filter(i => i.day === date);
    const weekCount = sid => { const ws = weekStart(now().date); return (stuRep(now().month, sid).items || []).filter(i => i.day >= ws && i.status === 'counted').length; };
    // Tavsiya jadvali (server: /assist/plan) — muzlatish, chiqib ketish, kurs boshlanishi hisobga olingan, dars vaqti bilan.
    const planE = (from, to) => U.load(`yd:plan:${from}:${to}`, () => U.api(`/api/school/assist/plan?from=${from}&to=${to}`), { ttl: 60000 });
    const monthPlan = month => { const ds = days(month); return planE(ds[0], ds[ds.length - 1]); };
    function adviceSet(month) {
        const e = monthPlan(month); if (!e.data) return null;
        const m = new Map();
        for (const it of e.data.items || []) if (it.kind === 'advice' || it.advice) { if (!m.has(it.studentId)) m.set(it.studentId, new Map()); m.get(it.studentId).set(it.date, it.start); }
        return m;
    }
    const lessonMin = s => D().toMin(s.lessonTime);
    // Kunning kartasi: hisoblandi (g) · hisoblanmadi (n) · javob bermadi (r) · bugun (y) · oldinda (f) · faol emas/muzlagan (x).
    function cellOf(s, date, month, adv) {
        const n = now(), its = itemsOn(month, s.id, date);
        if (its.some(i => i.status === 'counted')) return 'g';
        if (its.some(i => i.outcome === 'contacted')) return 'n';
        if (its.some(i => i.outcome === 'no_answer')) return 'r';
        const active = !adv || adv.get(s.id)?.has(date);
        if (!active) return 'x';
        if (date === n.date) return 'y';
        return 'f';
    }
    const CELL_T = { g: 'Hisoblandi', n: 'Hisoblanmadi', r: 'Javob bermadi', y: 'Bugun — belgilang', f: 'Oldinda', x: 'Muzlagan yoki faol emas' };
    // Tavsiya qilinmagan kundagi hisoblangan aloqa — eng yaqin oldingi tavsiya katagiga "+1".
    function extras(s, month) {
        const cols = days(month).filter(d => inPattern(s, d)), out = new Map();
        for (const i of stuRep(month, s.id).items || []) {
            if (i.status !== 'counted' || inPattern(s, i.day)) continue;
            const at = cols.filter(d => d < i.day).slice(-1)[0] || cols.find(d => d > i.day); if (!at) continue;
            out.set(at, (out.get(at) || 0) + 1);
        }
        return out;
    }

    // ── Bugungi tavsiyalar (Bosh, Aloqalar pastki kartasi) ──
    function todayList() {
        const n = now(), adv = adviceSet(n.month);
        return helped().filter(s => {
            if (adv) return adv.get(s.id)?.has(n.date) || itemsOn(n.month, s.id, n.date).length && inPattern(s, n.date);
            return !s.frozen && inPattern(s, n.date);
        }).map(s => ({ s, t: adv?.get(s.id)?.get(n.date) ?? lessonMin(s) ?? 9 * 60 })).sort((a, b) => a.t - b.t);
    }
    function todayState(s) {
        const its = itemsOn(now().month, s.id, now().date);
        const c = its.find(i => i.status === 'counted');
        if (c) return { k: 'ok', c };
        const o = its.find(i => i.outcome === 'contacted');
        if (o) return { k: 'n', c: o };
        if (its.some(i => i.outcome === 'no_answer')) return { k: 'r' };
        return { k: 'wait' };
    }
    const doneToday = list => list.filter(x => todayState(x.s).k === 'ok').length;

    // ─────────────────────────────────────────────────────────────────────
    // Y01 · Bosh
    // ─────────────────────────────────────────────────────────────────────
    // O'z avatari: rasm bo'lsa rasm, bo'lmasa ism va familiya bosh harflari ("AA").
    function meAvatar(n, style = '', light = false) {
        const u = S().user || {}, a = u.avatar;
        if (a && /^(\/|https:|data:image)/.test(a)) return `<img class="av" src="${esc(a)}" alt="" style="width: ${n}px; height: ${n}px; ${style}">`;
        const ini = String(u.name || S().me?.name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
        return `<span class="av yd-ini${light ? ' l' : ''}" style="width: ${n}px; height: ${n}px; font-size: ${Math.round(n * 0.36)}px; ${style}">${esc(ini)}</span>`;
    }
    const unread = () => { try { return U.bs?.unreadCount?.() || 0; } catch { return 0; } };
    function homeRender() {
        const n = now(), s0 = S(), user = s0.user || {}, rep = s0.assist;
        const list = todayList(), done = doneToday(list);
        const pend = list.filter(x => ['wait', 'r'].includes(todayState(x.s).k));
        const next = pend.find(x => todayState(x.s).k === 'wait') || pend[0] || null;
        const max = helped().length * capOf(n.month); // muzlaganda ham chegara o'zgarmaydi
        let hero;
        if (next) {
            const s = next.s, sr = stuRep(n.month, s.id), pr = s0.progress?.[s.id]?.reached;
            const g = groupLink(s), tn = teacherOf(s);
            hero = `<section class="dark a1" aria-label="Keyingi aloqa">${U.HEX('ydHex')}
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px"><span class="eb">KEYINGI ALOQA · ${D().hm(next.t)}</span>${todayState(s).k === 'r' ? '<span class="pill" style="color: #FDE68A; background: rgba(247,144,9,.22)">javob bermagan · qayta</span>' : `<span class="pill" style="color: #A6F4C5; background: rgba(18,183,106,.2)">odatdagi vaqti ${esc(s.lessonTime || '—')}</span>`}</div>
              <a href="#" class="row" data-u-push="y-karta" data-arg="${esc(s.id)}" style="color: #FFFFFF">${ava(s, 48).replace('style="', 'style="border: 2px solid rgba(255,255,255,.7); ')}<div class="col"><strong style="font-size: 20px; font-weight: 800">${esc(s.name)}</strong><span style="font-size: 13px; color: #C7D2E3">Dars ${esc(D().patternLabel(s.lessonDayOfWeek))} ${esc(s.lessonTime || '')}${tn ? ' · ustoz ' + esc(tn) : ''}</span></div></a>
              <div style="display: flex; gap: 6px; flex-wrap: wrap"><span class="pill yd-pw">${monName(n.month)} ${sr.counted} / ${capOf(n.month)}</span><span class="pill yd-pw">bu hafta ${weekCount(s.id)} / 3</span>${pr ? `<span class="pill yd-pw">ilovada ${pr}-darsda</span>` : ''}</div>
              <div style="display: flex; gap: 8px">
                <button type="button" class="btn p pulse" data-yd-mark="${esc(s.id)}" style="flex: 1">${svg(P.tick, 18, 2.6)}Aloqani belgilash</button>
                ${g ? `<a href="${esc(g)}" target="_blank" rel="noopener" class="btn gh" aria-label="${esc(D().first(s.name))} dars guruhini ochish (Telegram)" style="width: 48px; padding: 0">${svg(P.tg)}</a>` : ''}
              </div></section>`;
        } else if (list.length) {
            hero = `<section class="dark a1" aria-label="Bugun">${U.HEX('ydHex')}<span class="eb">BUGUN</span><strong style="font-size: 20px; font-weight: 800">Bugungi aloqalar bajarildi</strong><span style="font-size: 13px; color: #C7D2E3">${list.length} o'quvchining hammasi bilan gaplashdingiz. Ertangi tavsiyalar Jadvalda.</span><a href="#jadval" data-u-go="jadval" class="btn gh" style="align-self: flex-start">Jadvalni ochish</a></section>`;
        } else {
            hero = `<section class="dark a1" aria-label="Bugun">${U.HEX('ydHex')}<span class="eb">BUGUN</span><strong style="font-size: 20px; font-weight: 800">Bugun tavsiya yo'q</strong><span style="font-size: 13px; color: #C7D2E3">${helped().length ? "Xohlasangiz istalgan o'quvchi bilan bog'lanishingiz mumkin — Aloqalar bo'limida." : "Sizga hali o'quvchi biriktirilmagan."}</span></section>`;
        }
        const row = x => {
            const s = x.s, st = todayState(s), isNext = next && next.s.id === s.id;
            const sub = st.k === 'ok' || st.k === 'n' ? `${esc(CH_FULL[st.c.channel] || '')}${st.c.minutes && st.c.channel !== 'tg_text' ? ` · ${st.c.minutes} daq` : ''}` : st.k === 'r' ? "qayta urinib ko'ring" : [teacherOf(s) ? `ustoz ${esc(teacherOf(s))}` : '', isNext ? 'keyingi' : ''].filter(Boolean).join(' · ') || esc(D().patternLabel(s.lessonDayOfWeek)) + ' darslari';
            const pill = st.k === 'ok' ? '<span class="pill ok">Hisoblandi</span>' : st.k === 'n' ? '<span class="pill mu">Hisoblanmadi</span>' : st.k === 'r' ? '<span class="pill wa">Javob bermadi</span>' : isNext ? '<span class="pill inf">Keyingi</span>' : '<span class="pill mu">Kutilmoqda</span>';
            const attr = st.k === 'ok' ? `data-u-push="y-karta" data-arg="${esc(s.id)}"` : `data-yd-mark="${esc(s.id)}"`;
            return `<a class="li" href="#" ${attr}><span class="tm${st.k === 'ok' || st.k === 'n' || st.k === 'r' ? ' mut' : ''}"${isNext ? ' style="color: #0057B8"' : ''}>${D().hm(x.t)}</span>${ava(s, 36)}<div class="col g1"><span class="nm">${esc(D().short(s.name))}</span><span class="s">${sub}</span></div>${pill}</a>`;
        };
        return `<header class="hd">
            <a href="#" data-u-push="profil" aria-label="Profil" style="position: relative; flex: none">${meAvatar(46, 'border: 2px solid #FFFFFF; box-shadow: 0 0 0 1px #CBD5E1')}<span aria-hidden="true" style="position: absolute; right: 0; bottom: 0; width: 12px; height: 12px; border-radius: 50%; background: #12B76A; border: 2px solid #F5F7FB"></span></a>
            <div class="t"><span class="date">${esc(U.dateLong(n.date))}</span><h1>${greet()}, ${esc(D().first(user.name || s0.me?.name))}</h1></div>
            <a class="icb" href="#" data-u-push="bildirish" aria-label="Bildirishnomalar${unread() ? `, ${unread()} ta yangi` : ''}">${svg(P.bell)}${unread() ? `<span class="n">${unread() > 99 ? '99+' : unread()}</span>` : ''}</a>
          </header>
          <div class="bd">${U.offline()}
            ${hero}
            <div class="kp a2">
              <div class="k"><span>Bugun</span><strong>${done}<span class="yd-ks"> / ${list.length} bo'ldi</span></strong><div class="prog" aria-hidden="true"><i class="g" style="width: ${list.length ? Math.round(done / list.length * 100) : 0}%"></i></div></div>
              <a class="k" href="#davomat" data-u-go="davomat"><span>${cap(monName(n.month))}</span><strong>${rep?.counted ?? 0}<span class="yd-ks"> / ${max}</span></strong><span>hisobga o'tdi</span></a>
              <a class="k" href="#" data-u-push="y-maosh"><span>Hozircha</span><strong>${rep ? thousand(rep.amount) : '—'}<span class="yd-ks"> ming</span></strong><span style="color: #067647">${monName(n.month)} maoshi</span></a>
            </div>
            <section class="a3" style="display: flex; flex-direction: column; gap: 8px; flex: none">
              <div class="sh"><h2>Bugun · ${list.length} tavsiya</h2><a href="#jadval" data-u-go="jadval" class="yd-shl">Jadval</a></div>
              ${list.length ? `<div class="card l">${list.map(row).join('')}</div>` : `<div class="card"><span class="s">Bugun tavsiya qilingan o'quvchi yo'q.</span></div>`}
            </section>
            ${!rep ? `<div class="note w" role="alert"><span>Aloqa hisobi yuklanmadi.</span><button type="button" class="btn sm" data-yd-reload style="margin-left: auto">Qayta urinish</button></div>` : ''}
          </div>`;
    }
    function bindCommon(root) {
        root.querySelectorAll('[data-yd-mark]').forEach(b => b.onclick = e => { e.preventDefault(); openMark(b.dataset.ydMark); });
        root.querySelectorAll('[data-yd-reload]').forEach(b => b.onclick = async () => { b.disabled = true; try { await U.reload(); } catch (err) { U.toast(err.message); b.disabled = false; } });
    }
    U.tab('home', { render: homeRender, bind: bindCommon }, Y);

    // ─────────────────────────────────────────────────────────────────────
    // Y02 · Jadval — aloqa tavsiyalari (faqat ko'rish)
    // ─────────────────────────────────────────────────────────────────────
    let jDay = null;
    function jadvalRender() {
        const n = now();
        // Joriy hafta (yakshanba — keyingi hafta); hafta almashtirgich dizaynda yo'q.
        const cw = weekStart(wd(n.date) === 7 ? U.addDays(n.date, 1) : n.date);
        if (!jDay || jDay < cw || jDay > U.addDays(cw, 5)) jDay = wd(n.date) === 7 ? U.addDays(n.date, 1) : n.date;
        const ws = weekStart(jDay), ds = Array.from({ length: 6 }, (_, k) => U.addDays(ws, k));
        const e = planE(ws, U.addDays(ws, 5));
        const items = e.data?.items || [];
        const cnt = d => new Set(items.filter(i => i.date === d && (i.kind === 'advice' || i.advice)).map(i => i.studentId)).size;
        const list = items.filter(i => i.date === jDay && (i.kind === 'advice' || i.kind === 'contact')).sort((a, b) => a.start - b.start);
        const seen = new Set(), M = jDay.slice(0, 7);
        const uniq = list.filter(i => { if (seen.has(i.studentId)) return false; seen.add(i.studentId); return true; });
        const st = i => { const its = items.filter(x => x.studentId === i.studentId && x.date === jDay && x.kind === 'contact'); return { c: its.find(x => x.status === 'counted'), o: its.find(x => x.outcome === 'contacted'), na: its.find(x => x.outcome === 'no_answer') }; };
        const nextId = jDay === n.date ? (uniq.find(i => { const x = st(i); return !x.c && !x.o && !x.na; }) || {}).studentId : null;
        const rows = uniq.map(i => {
            const s = D().stuOf(i.studentId), { c, o, na } = st(i), isNext = i.studentId === nextId, tn = teacherOf(s);
            const pill = c ? '<span class="pill ok">Hisoblandi</span>' : o ? '<span class="pill mu">Hisoblanmadi</span>' : na ? '<span class="pill wa">Javob bermadi</span>' : `<span class="pill ${isNext ? 'inf' : 'mu'}">${stuRep(M, i.studentId).counted}/${capOf(M)}</span>`;
            const attr = jDay === n.date && !c ? `data-yd-mark="${esc(i.studentId)}"` : `data-u-push="y-karta" data-arg="${esc(i.studentId)}"`;
            return `<a class="li" href="#" ${attr}><span class="tm${c || na ? ' mut' : ''}"${isNext ? ' style="color: #0057B8"' : ''}>${D().hm(i.start)}</span>${s ? ava(s, 36) : ''}<div class="col g1"><span class="nm">${esc(s?.name || i.studentName || '')}</span><span class="s">${s ? `dars ${esc(D().patternLabel(s.lessonDayOfWeek))} ${esc(s.lessonTime || '')}${tn ? ' · ' + esc(tn) : ''}` : ''}</span></div>${pill}</a>`;
        });
        return `<header class="hd" style="padding-bottom: 4px"><div class="t"><span class="date">Aloqa tavsiyalari · ${+ds[0].slice(8)}–${+ds[5].slice(8)}-${monName(ds[5].slice(0, 7))}</span><h1 style="font-size: 26px">Jadval</h1></div></header>
          <div class="bd" style="gap: 10px">${U.offline()}
            <nav class="yd-wk a1" aria-label="Hafta kunlari">${ds.map(d => `<button type="button" data-yd-day="${d}" class="${d === jDay ? 'on' : ''}"${d === n.date ? ' aria-current="date"' : ''}>${D().DAY[wd(d) - 1]}<b>${+d.slice(8)}</b><i>${e.data ? `${cnt(d)} ta` : '…'}</i></button>`).join('')}</nav>
            <div class="note i a2">${svg(P.info, 18, 2).replace('<svg', '<svg style="flex: none; margin-top: 1px"')}<span>${jDay === n.date ? 'Bugun' : 'Shu kuni'} darsi <b>yo'q</b> o'quvchilar, ularning odatdagi dars vaqti bo'yicha. Majburiy emas — istalgan vaqt aloqa qilsangiz bo'ladi.</span></div>
            ${e.err ? U.err(e, `yd:plan:${ws}:${U.addDays(ws, 5)}`) : !e.data ? U.skel(3, 56) : rows.length ? `<div class="card l a3">${rows.join('')}</div>` : `<div class="card"><span class="s">Bu kunga tavsiya yo'q.</span></div>`}
            ${rows.length ? '<span class="xs" style="padding: 0 4px">Yorliqdagi son — shu oy hisobga o\'tgan aloqalar</span>' : ''}
          </div>`;
    }
    U.tab('jadval', {
        render: jadvalRender,
        bind(root) {
            bindCommon(root);
            root.querySelectorAll('[data-yd-day]').forEach(b => b.onclick = () => { jDay = b.dataset.ydDay; U.render(); });
        }
    }, Y);

    // ─────────────────────────────────────────────────────────────────────
    // Y03 · Aloqalar — oy jadvali (ustoz davomati H1 bilan bir xil ko'rinish)
    // ─────────────────────────────────────────────────────────────────────
    const FLT_KEY = 'dwt_v2_yd_flt';
    let aMonth = null, aFlt = null; const aScroll = {};
    // Dizayn Y03: har guruh alohida jadval — "Toq kunlar · Du Ch Ju" va "Juft kunlar · Se Pa Sh" (har birida faqat o'z kunlari).
    const GROUPS = [['odd', 'Toq kunlar · Du Ch Ju', [1, 3, 5]], ['even', 'Juft kunlar · Se Pa Sh', [2, 4, 6]], ['other', 'Boshqa kunlar', null]];
    const groupOfStu = s => { const p = adviceDays(s.lessonDayOfWeek).join(); return p === '1,3,5' ? 'odd' : p === '2,4,6' ? 'even' : 'other'; };
    const colsOf = (month, wds) => days(month).filter(x => { const w = wd(x); return wds ? wds.includes(w) : w !== 7; });
    function aloqaRender() {
        const n = now();
        aMonth ||= n.month; aFlt ||= D().store.get(FLT_KEY, 'all');
        const rep = repOf(aMonth), adv = adviceSet(aMonth), isCur = aMonth === n.month, M = cap(monName(aMonth));
        const all = helped();
        let g = 0, r = 0, y = 0, b = 0;
        for (const s of all) {
            const sr = stuRep(aMonth, s.id); g += sr.counted; r += sr.noAnswer;
            for (const v of extras(s, aMonth).values()) b += v;
            if (isCur && inPattern(s, n.date) && cellOf(s, n.date, aMonth, adv) === 'y') y++;
        }
        if (rep.data) { g = rep.data.counted ?? g; r = rep.data.noAnswer ?? r; }
        const cp = capOf(aMonth);
        const table = (gid, title, wds) => {
            const rows = all.filter(s => groupOfStu(s) === gid), cols = colsOf(aMonth, wds);
            if (!rows.length) return '';
            const nx = cols.find(x => x >= n.date);
            const note = !isCur ? "oy yopilgan · faqat ko'rish" : nx === n.date ? 'bugun qora halqada' : nx ? `${nx === U.addDays(n.date, 1) ? 'ertaga' : 'keyingi'} — ${+nx.slice(8)}` : 'oy tugadi';
            const ti = isCur ? Math.max(0, cols.findIndex(x => x >= n.date)) : cols.length - 1;
            const grid = rows.map(s => {
                const sr = stuRep(aMonth, s.id), ex = extras(s, aMonth);
                return `<div class="dv-tr${s.frozen ? ' out' : ''}"><a class="dv-nmc" href="#" data-u-push="yd-oy" data-arg="${esc(s.id)}" aria-label="${esc(s.name)} — oylik aloqalar">${D().avatar(s, '')}<span class="nn">${esc(D().first(s.name))}<small>${sr.counted} / ${cp}</small></span></a>${cols.map(x => {
                    if (!inPattern(s, x)) return '<span class="dv-cw"></span>';
                    const c = cellOf(s, x, aMonth, adv), k = c === 'n' ? 'f yd-n' : c, plus = ex.get(x);
                    return `<button type="button" class="dv-cw" data-yd-cell="${esc(s.id)}|${x}" aria-label="${esc(D().first(s.name))}, ${+x.slice(8)}-${monName(aMonth)} · ${CELL_T[c]}${plus ? ` · yana ${plus} ta boshqa kunda` : ''}"><i class="dv-k2 ${k}${x === n.date ? ' now' : ''}">${+x.slice(8)}${plus ? `<span class="dv-pq">+${plus}</span>` : ''}</i></button>`;
                }).join('')}</div>`;
            }).join('');
            return `<div class="dv-tbw a2" style="--cw: 46px"><div class="dv-mh"><b style="font-size: 14px">${title}</b><span class="xs">${note}</span></div><span class="dv-fade" aria-hidden="true"></span><div class="dv-sc" data-ti="${ti}" data-gid="${gid}">${grid}</div></div>`;
        };
        const tables = GROUPS.filter(([gid]) => aFlt === 'all' || aFlt === gid || gid === 'other') // aralash kunli o'quvchilar har filtrda ko'rinadi.map(([gid, t, w]) => table(gid, t, w)).join('');
        const empty = `<div class="dv-tbw a2"><div class="dv-empty">${all.length ? (aFlt === 'odd' ? "Toq kunlarda (Du·Ch·Ju) aloqa qilinadigan o'quvchi yo'q" : "Juft kunlarda (Se·Pa·Sh) aloqa qilinadigan o'quvchi yo'q") : "Sizga hali o'quvchi biriktirilmagan"}</div></div>`;
        const prevM = D().shiftMonth(aMonth, -1), nextM = D().shiftMonth(aMonth, 1);
        return `<header class="hd" style="padding-bottom: 4px"><div class="t"><span class="date">${esc(U.dateLong(n.date))}</span><h1 style="font-size: 26px">Aloqalar · ${M}</h1></div>
            <div style="display: flex; gap: 6px"><button type="button" class="icb" data-yd-mon="-1" aria-label="${cap(monName(prevM))}">${svg(P.prev, 18, 2.2)}</button><button type="button" class="icb" data-yd-mon="1" aria-label="${cap(monName(nextM))}"${isCur ? ' disabled style="opacity: .4"' : ''}>${svg(P.chev, 18, 2.2)}</button></div></header>
          <div class="bd" style="gap: 12px; padding-bottom: 110px">${U.offline()}
            ${!rep.data && !rep.loading ? (isCur ? `<div class="note w" role="alert"><span>Aloqa hisobi yuklanmadi.</span><button type="button" class="btn sm" data-yd-reload style="margin-left: auto">Qayta urinish</button></div>` : U.err(rep, `yd:rep:${aMonth}`)) : ''}
            <div class="sm2 a1"><div><b style="color: #067647">${g}</b><span>hisoblandi</span></div><div><b style="color: #B42318">${r}</b><span>javob bermadi</span></div><div${y ? ' style="border-color: #FEC84B; background: #FFFAEB"' : ''}><b style="color: ${y ? '#B54708' : '#0B1220'}">${y}</b><span>belgilang</span></div><div><b style="color: #1570EF">${b}</b><span>boshqa kuni</span></div></div>
            <nav class="dv-flt" aria-label="Kunlar filtri">${[['all', 'Hammasi'], ['odd', 'Toq kunlar'], ['even', 'Juft kunlar']].map(([k, l]) => `<button type="button" data-yd-flt="${k}" class="${aFlt === k ? 'on' : ''}" aria-pressed="${aFlt === k}">${l}</button>`).join('')}</nav>
            ${tables || empty}
            <div class="dv-lgd2"><span><i style="background: #12B76A"></i>Hisoblandi</span><span><i style="background: #F04438"></i>Javob bermadi</span><span><i style="background: #FFFFFF; box-shadow: inset 0 0 0 2px #F79009"></i>Belgilang</span><span><i style="background: #2E90FA; border-radius: 999px"></i>+1 boshqa kuni</span><span><i style="background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E2E8F0"></i>Oldinda</span><span><i style="background: repeating-linear-gradient(135deg, #E2E8F0 0 3px, #F8FAFC 3px 6px)"></i>Muzlagan</span></div>
            ${isCur ? todayCard() : ''}
          </div>`;
    }
    function todayCard() {
        const n = now(), list = todayList();
        const row = x => {
            const s = x.s, st = todayState(s), due = st.k === 'wait' && x.t <= n.min;
            const pill = st.k === 'ok' ? '<span class="pill ok">Hisoblandi</span>' : st.k === 'n' ? '<span class="pill mu">Hisoblanmadi</span>' : st.k === 'r' ? '<span class="pill bad">Javob bermadi</span>' : due ? '<span class="pill wa">Belgilang</span>' : '<span class="pill mu">Kutilmoqda</span>';
            const inner = `<span class="tm">${D().hm(x.t)}</span><span class="nm g1">${esc(D().first(s.name))}</span>${pill}`;
            return st.k === 'ok' ? `<a class="li" href="#" data-u-push="y-karta" data-arg="${esc(s.id)}" style="color: #0B1220">${inner}</a>` : `<a class="li${due ? ' dv-due' : ''}" href="#" data-yd-mark="${esc(s.id)}"${due ? '' : ' style="color: #0B1220"'}>${inner}</a>`;
        };
        return `<section class="card l a3"><div class="sh" style="padding: 12px 0 2px"><h2 style="font-size: 16px">Bugun · ${list.length} tavsiya</h2><a href="#jadval" data-u-go="jadval" class="yd-shl" style="font-size: 13px">Jadval</a></div>
          ${list.length ? list.map(row).join('') : '<div class="li"><span class="s">Bugun tavsiya yo\'q</span></div>'}</section>`;
    }
    function onCell(sid, date) {
        const n = now(), s = D().stuOf(sid); if (!s) return;
        if (date > n.date) return U.toast("Bu kun hali kelmagan — aloqa o'sha kuni belgilanadi");
        if (date === n.date) return openMark(sid);
        const its = itemsOn(date.slice(0, 7), sid, date);
        if (its.some(i => i.status === 'counted')) return U.push('y-karta', sid);
        if (date.slice(0, 7) !== n.month) return U.toast(`${cap(monName(date.slice(0, 7)))} yopilgan — o'zgartirishni admin qiladi`);
        U.push('y-kech', `${sid}|${date}`);
    }
    U.tab('davomat', {
        render: aloqaRender,
        bind(root) {
            const n = now();
            bindCommon(root);
            root.querySelectorAll('[data-yd-flt]').forEach(b => b.onclick = () => { aFlt = b.dataset.ydFlt; D().store.set(FLT_KEY, aFlt); U.render(); });
            root.querySelectorAll('[data-yd-mon]').forEach(b => b.onclick = () => { if (b.disabled) return; const v = D().shiftMonth(aMonth, +b.dataset.ydMon); if (v <= n.month) { aMonth = v; U.render(); } });
            root.querySelectorAll('[data-yd-cell]').forEach(b => b.onclick = () => { const [sid, date] = b.dataset.ydCell.split('|'); onCell(sid, date); });
            root.querySelectorAll('.dv-sc').forEach(sc => {
                const key = `${aMonth}|${sc.dataset.gid}`;
                sc.scrollLeft = aScroll[key] != null ? aScroll[key] : Math.max(0, (+sc.dataset.ti - 3) * 46); // ustoz Davomati bilan bir xil: bugungi ustun chapdan 4-o'rinda
                sc.onscroll = () => { aScroll[key] = sc.scrollLeft; };
            });
        }
    }, Y);

    // ── Y03b · O'quvchining oylik aloqalari (pastdan oyna ko'rinishida) ──
    U.page('yd-oy', {
        render(sid) {
            const n = now(), s = D().stuOf(sid), month = aMonth || n.month, M = cap(monName(month));
            const hd = `<header class="hd"><div class="t"><span class="date">${esc(U.dateLong(n.date))}</span><h1 style="font-size: 26px">Aloqalar · ${M}</h1></div></header>`;
            if (!s) return `<div class="dv-oyw">${hd}<div class="scrim" data-u-back></div><section class="sheet dv-oy" role="dialog" aria-modal="true" aria-label="O'quvchi"><span class="grab" aria-hidden="true"></span><div class="note w"><span>O'quvchi topilmadi.</span></div><button type="button" class="btn w" data-u-back>Orqaga</button></section></div>`;
            const adv = adviceSet(month), sr = stuRep(month, sid), cells = D().cal.cells(month, []);
            const lead = cells.findIndex(Boolean), prevEnd = +days(D().shiftMonth(month, -1)).slice(-1)[0].slice(8);
            const out = [];
            for (let i = 0; i < lead; i++) out.push(`<span class="dv-dc o">${prevEnd - lead + 1 + i}</span>`);
            for (const c of cells.slice(lead)) {
                const its = itemsOn(month, sid, c.date), t = c.date === n.date ? ' t' : '';
                const cnt = its.find(i => i.status === 'counted') || its.find(i => i.outcome === 'contacted');
                const sm = cnt ? (cnt.channel === 'tg_text' ? 'yozishma' : cnt.channel === 'phone' ? `${cnt.minutes} daq` : (CH.find(x => x[0] === cnt.channel)?.[1] || '')) : '';
                if (inPattern(s, c.date) || its.length) {
                    const k = cellOf(s, c.date, month, adv);
                    const cls = k === 'n' ? 'f yd-n' : k;
                    const tm = k === 'y' && adv?.get(sid)?.get(c.date) != null ? D().hm(adv.get(sid).get(c.date)) : '';
                    out.push(`<button type="button" class="dv-dc ${cls}${t}" data-yd-cell="${esc(sid)}|${c.date}" aria-label="${c.day}-${monName(month)} · ${CELL_T[k] || ''}">${c.day}${sm || tm ? `<small>${esc(sm || tm)}</small>` : ''}</button>`);
                } else out.push(`<button type="button" class="dv-dc yd-od${t}" data-yd-cell="${esc(sid)}|${c.date}" aria-label="${c.day}-${monName(month)} · tavsiya qilinmagan kun">${c.day}</button>`);
            }
            for (let i = 1; out.length % 7; i++) out.push(`<span class="dv-dc o">${i}</span>`);
            const left = Math.max(0, capOf(month) - sr.counted), amt = Number(sr.amount) || 0; // summa — serverdan (bitta manba)
            return `<div class="dv-oyw">${hd}<div class="scrim" data-u-back aria-hidden="true"></div>
              <section class="sheet dv-oy" role="dialog" aria-modal="true" aria-labelledby="yd-oyh"><span class="grab" aria-hidden="true"></span>
                <div class="row">${ava(s, 44)}<div class="col g1"><h2 id="yd-oyh" style="font-size: 19px; font-weight: 800">${esc(s.name)}</h2><span class="s">Aloqa ${esc(adviceLabel(s))} · odatdagi vaqti ${esc(s.lessonTime || '—')}${s.frozen ? ' · muzlatilgan' : ''}</span></div><button type="button" class="icb" data-u-back aria-label="Yopish" style="border: 0; background: #F1F5F9">${svg(P.x, 18, 2.4)}</button></div>
                <div class="sm2"><div><b style="color: #067647">${sr.counted}</b><span>hisoblandi</span></div><div><b style="color: #B42318">${sr.noAnswer}</b><span>javob bermadi</span></div><div><b>${left}</b><span>qoldi</span></div><div><b style="color: #1570EF">${money(amt)}</b><span>so'm</span></div></div>
                <div class="dv-cg">${D().DAY.map(x => `<span class="dv-wd">${x}</span>`).join('')}${out.join('')}</div>
                <div class="dv-cgl"><span><i style="background: #12B76A"></i>Hisoblandi</span><span><i style="background: #F04438"></i>Javob bermadi</span><span><i style="background: #FFFFFF; box-shadow: inset 0 0 0 2px #F79009"></i>Bugun</span><span><i style="background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E2E8F0"></i>Tavsiya kuni</span><span><i style="background: #F8FAFC; box-shadow: inset 0 0 0 1px #E2E8F0"></i>Boshqa kun</span></div>
                <div class="note i" style="padding: 10px 12px"><span>${month < n.month ? `<b>${M} yopilgan</b> — o'zgartirish admin orqali.` : `<b>Bugun</b> — bosib belgilaysiz, tavsiya kuni bo'lmasa ham bo'ladi. <b>O'tgan kun</b> esdan chiqqan bo'lsa — <a href="#" data-yd-late="${esc(sid)}" style="font-weight: 800">adminga so'rov</a>.`}</span></div>
              </section></div>`;
        },
        bind(root, sid) {
            bindCommon(root);
            root.querySelectorAll('[data-yd-cell]').forEach(b => b.onclick = () => { const [id, date] = b.dataset.ydCell.split('|'); onCell(id, date); });
            root.querySelector('[data-yd-late]')?.addEventListener('click', e => { e.preventDefault(); U.push('y-kech', sid); });
        },
        nav: false
    });

    // ─────────────────────────────────────────────────────────────────────
    // Y04 / Y04b / Y05 · Aloqani belgilash (pastdan oyna)
    // ─────────────────────────────────────────────────────────────────────
    function openMark(sid) {
        const n = now(), s = D().stuOf(sid); if (!s) return;
        const sr = stuRep(n.month, sid), wk = weekCount(sid), CP = capOf(n.month);
        const st = { out: 'contacted', ch: 'phone', min: 10, naCh: 'phone' };
        const ws = weekStart(n.date);
        const textDone = (sr.items || []).find(i => i.day >= ws && i.channel === 'tg_text' && i.status === 'counted');
        const todayDone = (sr.items || []).find(i => i.day === n.date && i.status === 'counted');
        const dch = () => `<span class="dv-dch ${st.out === 'no_answer' ? 'r' : 'y'}"><b>${n.day}</b><small>${D().DAY[n.wd - 1]}</small></span>`;
        const head = () => `<div class="row">${dch()}<div class="col g1"><h2 style="font-size: 19px; font-weight: 800">${esc(D().first(s.name))}</h2><span class="s">Bugun · ${monName(n.month)} ${sr.counted}/${CP} · hafta ${wk}/3</span></div>${ava(s, 40)}</div>`;
        // Y05 — shu hafta yozishma hisoblangan: alohida varaq (sarlavha + ×, to'liq nomli usullar, "Usulni o'zgartirish").
        const y05 = () => st.out === 'contacted' && st.ch === 'tg_text' && !!textDone && !todayDone;
        const outBtns = () => `<div class="dv-bg2"><button type="button" data-o="contacted" class="${st.out === 'contacted' ? 'og' : ''}" aria-pressed="${st.out === 'contacted'}">${svg(P.tick, 18, 3.5)}Gaplashdik</button><button type="button" data-o="no_answer" class="${st.out === 'no_answer' ? 'orr' : ''}" aria-pressed="${st.out === 'no_answer'}">${svg(P.x, 18, 3.5)}Javob bermadi</button></div>`;
        const warn = () => {
            if (st.out === 'no_answer') return `<div class="note i" style="padding: 10px 12px"><span>Tarixga yoziladi, lekin hisobga o'tmaydi. Bugun qayta bog'lansangiz, katak <b style="color: #067647">yashil</b> bo'ladi.</span></div>`;
            if (todayDone) return `<div class="note w">${svg(P.warn, 18, 2).replace('<svg', '<svg style="flex: none; margin-top: 1px"')}<span>Bugun ${esc(D().first(s.name))} bilan aloqa <b>hisoblangan</b>. Bu ham yoziladi, lekin kuniga 1 ta hisoblanadi.</span></div>`;
            if (st.ch === 'tg_text' && textDone) return `<div class="note w">${svg(P.warn, 18, 2).replace('<svg', '<svg style="flex: none; margin-top: 1px"')}<span>Bu hafta ${esc(D().first(s.name))} bilan yozishma <b>${+textDone.day.slice(8)}-${monName(textDone.day.slice(0, 7))}da</b> hisoblangan. Bu yozishma tarixga yoziladi, lekin <b>hisobga o'tmaydi</b>. Qo'ng'iroq yoki video aloqa hisoblanadi.</span></div>`;
            if (sr.counted >= CP) return `<div class="note w">${svg(P.warn, 18, 2).replace('<svg', '<svg style="flex: none; margin-top: 1px"')}<span>Bu oy ${CP} ta aloqa to'lgan — yoziladi, lekin maoshga qo'shilmaydi.</span></div>`;
            return '';
        };
        const body = () => st.out === 'no_answer' ? `
            <span class="dv-st">QAYERDA URINDINGIZ?</span>
            <div class="chips" style="flex-wrap: wrap">${[['phone', 'Telefon'], ['tg_video', "Telegram qo'ng'iroq"], ['tg_text', 'Telegram yozdim']].map(([k, l]) => `<button type="button" class="chip${st.naCh === k ? ' on' : ''}" data-na="${k}" aria-pressed="${st.naCh === k}">${l}</button>`).join('')}</div>`
            : `<span class="dv-st">QANDAY?</span>
            <div class="yd-ug" role="radiogroup" aria-label="Usul">${CH.map(([k, l, ic]) => `<button type="button" role="radio" aria-checked="${st.ch === k}" data-ch="${k}" class="${st.ch === k ? 'on' : ''}">${svg(ic, 18, 2)}${l}</button>`).join('')}</div>
            ${st.ch === 'tg_text' ? '' : `<span class="dv-st">NECHA DAQIQA?</span>
            <div class="yd-dm" role="radiogroup" aria-label="Davomiylik">${[5, 10, 15, 20, 30].map(v => `<button type="button" role="radio" aria-checked="${st.min === v}" data-min="${v}" class="${st.min === v ? 'on' : ''}">${v === 30 ? '30+' : v}</button>`).join('')}</div>`}`;
        const saveTxt = () => st.out === 'contacted' && (todayDone || sr.counted >= CP) ? 'Baribir saqlash' : 'Saqlash';
        const izoh = ph => `<div class="fl"><label for="yd-nt">Izoh <span class="yd-opt">· ixtiyoriy</span></label><textarea id="yd-nt" placeholder="${ph}"></textarea></div>`;
        const CH_LONG = [['phone', 'Telefon', P.phone], ['tg_video', 'Telegram video', P.video], ['tg_group', 'Guruh videodars', P.group], ['zoom', 'Zoom', P.zoom], ['meet', 'Google Meet', P.meet], ['tg_text', 'Yozishma', P.msg]];
        const html = () => {
            if (y05()) return `<div class="row">${ava(s, 44)}<div class="col g1"><h2 style="font-size: 18px; font-weight: 800">${esc(D().first(s.name))} bilan aloqa</h2><span class="s">Bugun · ${monName(n.month)} ${sr.counted}/${CP} · hafta ${wk}/3</span></div><button type="button" class="yd-x" data-u-close aria-label="Yopish">${svg(P.x, 18, 2.4)}</button></div>
                <span class="yd-lb">Qanday bog'landingiz?</span>
                <div class="yd-ug2" role="radiogroup" aria-label="Usul">${CH_LONG.map(([k, l, ic]) => `<button type="button" role="radio" aria-checked="${st.ch === k}" data-ch="${k}" class="${st.ch === k ? 'on' : ''}">${svg(ic, 18, 2)}${l}</button>`).join('')}</div>
                ${warn()}
                ${izoh('Nima haqida yozishdingiz?')}
                <div class="yd-b2"><button type="button" class="btn" data-ch="phone" style="color: #0057B8">Usulni o'zgartirish</button><button type="button" class="btn p" data-save>Baribir saqlash</button></div>
                <span class="xs" style="text-align: center">Yozishma haftasiga 1 ta hisoblanadi</span>`;
            if (st.out === 'no_answer') return `${head()}${outBtns()}${body()}
                ${izoh("Masalan: 2 marta qo'ng'iroq qildim")}
                ${warn()}
                <button type="button" class="btn p w yd-save" data-save>Saqlash</button>`;
            return `${head()}${outBtns()}${body()}${warn()}
                ${izoh("Masalan: 21-dars so'zlarini takrorladik")}
                <button type="button" class="btn p w yd-save" data-save>${saveTxt()}</button>
                <span class="xs" style="text-align: center">${st.ch === 'tg_text' ? 'Yozishma haftasiga 1 ta hisoblanadi · ertaga faqat admin o\'zgartiradi' : "Kamida 5 daqiqa · kuniga 1 ta hisoblanadi · ertaga faqat admin o'zgartiradi"}</span>`;
        };
        U.sheet(`<div class="yd-mk">${html()}</div>`, (el, close) => {
            const box = el.querySelector('.yd-mk');
            const draw = () => { const note = box.querySelector('#yd-nt')?.value || ''; box.innerHTML = html(); box.querySelector('#yd-nt').value = note; box.querySelectorAll('[data-u-close]').forEach(b => b.onclick = close); wire(); };
            const wire = () => {
                box.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { st.out = b.dataset.o; draw(); });
                box.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { st.ch = b.dataset.ch; draw(); });
                box.querySelectorAll('[data-min]').forEach(b => b.onclick = () => { st.min = +b.dataset.min; draw(); });
                box.querySelectorAll('[data-na]').forEach(b => b.onclick = () => { st.naCh = b.dataset.na; draw(); });
                box.querySelector('[data-save]').onclick = async e => {
                    const btn = e.currentTarget; btn.disabled = true;
                    const t = now(), outcome = st.out, channel = outcome === 'no_answer' ? st.naCh : st.ch;
                    const minutes = outcome === 'no_answer' || channel === 'tg_text' ? 0 : st.min;
                    try {
                        await U.api('/api/school/assist/contacts', { method: 'POST', body: { studentId: s.id, outcome, channel, minutes, note: box.querySelector('#yd-nt').value.trim(), at: D().hm(t.min) } });
                        const before = doneToday(todayList()), total = todayList().length;
                        S().assist = await U.api(`/api/school/assist/month?month=${t.month}`).catch(() => S().assist);
                        U.drop('yd:plan:');
                        close();
                        const after = doneToday(todayList());
                        if (outcome === 'no_answer') U.toast('Javob bermadi — yozildi', { ok: true });
                        else {
                            const it = (stuRep(t.month, s.id).items || []).filter(i => i.day === t.date).slice(-1)[0];
                            U.toast(it?.status === 'counted' ? `Aloqa saqlandi · ${stuRep(t.month, s.id).counted}/${capOf(t.month)}` : `Saqlandi · ${ST_TXT[it?.status] || 'hisoblanmadi'}`, { ok: it?.status === 'counted' });
                        }
                        U.render();
                        if (total && after === total && before < total) setTimeout(() => dayDone(after), 450);
                    } catch (err) { U.toast(err.message); btn.disabled = false; }
                };
            };
            wire();
        }, { label: `${s.name} bilan aloqa` });
    }

    // ── Y06 · Bugungi aloqalar tugadi — tabrik (kuniga bir marta) ──
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    function overlay(html, onOpen) {
        const ov = document.createElement('div'); ov.className = 'bs-ov';
        ov.innerHTML = `<div class="bs-ovin"><div class="bs-scr" aria-hidden="true"></div>${html}</div>`;
        document.body.appendChild(ov);
        const close = () => { document.removeEventListener('keydown', onKey); ov.classList.add('out'); setTimeout(() => ov.remove(), reduced() ? 0 : 180); };
        const onKey = e => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        ov.querySelector('.bs-scr').onclick = close;
        ov.querySelectorAll('[data-ov-x]').forEach(b => b.onclick = close);
        onOpen?.(ov, close);
        ov.querySelector('.btn.p')?.focus({ preventScroll: true, focusVisible: false });
        return close;
    }
    // Bugun qo'shilgan summa — server oy hisobidan (rep.today: bugungi aloqalarsiz hisob bilan farq).
    const gainToday = () => Number(S().assist?.today?.amount) || 0;
    function dayDone(count) {
        const n = now(), key = 'dwt_v2_yd_daydone';
        if (D().store.get(key, '') === n.date) return;
        D().store.set(key, n.date);
        document.querySelector('#app > .u-toast')?.remove();
        const list = todayList();
        const tom = U.addDays(n.date, wd(n.date) === 6 ? 2 : 1), tomN = helped().filter(s => !s.frozen && inPattern(s, tom)).length;
        const a = c => reduced() ? '' : c;
        overlay(`<section class="bs-mdl ${a('yd-in')}" role="dialog" aria-modal="true" aria-labelledby="ydTb" style="top: 120px; padding: 24px 18px 18px; display: flex; flex-direction: column; gap: 14px">
            <span class="${a('yd-pop')}" style="width: 80px; height: 80px; border-radius: 26px; background: #ECFDF3; color: #067647; display: grid; place-items: center; align-self: center">${svg(P.tick, 42, 2.6)}</span>
            <div class="col" style="gap: 6px; align-items: center; text-align: center"><h2 id="ydTb" style="font-size: 23px; font-weight: 800; letter-spacing: -.02em">Bugungi aloqalar tugadi!</h2><span class="s" style="font-size: 14px; line-height: 1.5">${count} o'quvchining hammasi bilan gaplashdingiz. O'quvchilar buni sezadi.</span></div>
            <div class="yd-avs" aria-hidden="true">${list.slice(0, 3).map(x => ava(x.s, 36)).join('')}${list.length > 3 ? `<span class="yd-more">+${list.length - 3}</span>` : ''}</div>
            <div class="yd-st3"><div><b>${count}</b><span>bugun</span></div><div><b style="color: #067647">+${money(gainToday())}</b><span>so'm</span></div><div><b>${S().assist?.counted ?? 0}</b><span>${monName(n.month)}da</span></div></div>
            <button type="button" class="btn p w" data-ov-x>Rahmat!</button>
            <span class="xs" style="text-align: center">${tomN ? `Ertaga ${tomN} ta tavsiya bor · ${D().DAY_FULL[wd(tom) - 1]}` : 'Ertaga tavsiya yo\'q'}</span>
          </section>`);
        U.confetti();
    }

    // ── Y06b · Yangi o'quvchi biriktirildi — tabrik ──
    // Ko'rilganlar DWT.store ('dwt_v2_yd_seen'). Birinchi ochilishda hozirgi o'quvchilar jimgina "ko'rilgan" bo'ladi.
    const SEEN = 'dwt_v2_yd_seen';
    function checkNew() {
        if (U.mode() !== Y || !S().state) return;
        const ids = (S().helped || []).map(s => s.id), seen = D().store.get(SEEN, null);
        if (!Array.isArray(seen)) { D().store.set(SEEN, ids); return; }
        const fresh = (S().helped || []).filter(s => !seen.includes(s.id));
        if (!fresh.length || document.querySelector('.bs-ov')) return;
        D().store.set(SEEN, [...seen, ...fresh.map(s => s.id)].slice(-500));
        const q = fresh.slice();
        const next = () => { const s = q.shift(); if (s) welcome(s, next); };
        next();
    }
    function welcome(s, after) {
        const n = now(), a = c => reduced() ? '' : c, cnt = (S().helped || []).length;
        let first = n.date; for (let k = 0; k < 14 && !inPattern(s, first); k++) first = U.addDays(first, 1);
        const firstTxt = `${D().DAY[wd(first) - 1]}, ${+first.slice(8)}-${D().MON_S[+first.slice(5, 7) - 1].toLowerCase()}`;
        const lang = U.bq?.langOf ? U.bq.langOf() : '';
        const stars = [['left: 54px; top: 40px', 18, '#FDB022', 0], ['right: 64px; top: 34px', 12, '#FFFFFF', .5], ['right: 48px; bottom: 44px', 14, '#FDB022', .9], ['left: 70px; bottom: 36px', 10, '#9DC4F5', 1.2]];
        const starD = P.star.match(/d="([^"]+)"/)[1];
        const monthly = monthlyOf(n.month);
        overlay(`<section class="bs-mdl ${a('bs-in2')}" role="dialog" aria-modal="true" aria-labelledby="ydYb" style="top: 64px">
            <div style="position: relative; height: 196px; background: #0B1220; overflow: hidden; display: grid; place-items: center">
              <span style="position: absolute; inset: 0; opacity: .07">${U.HEX('ydYbHex')}</span>
              ${stars.map(([pos, sz, c, dl]) => `<svg class="${a('bs-st')}" aria-hidden="true" width="${sz}" height="${sz}" viewBox="0 0 24 24" style="position: absolute; ${pos}; animation-delay: ${dl}s"><path d="${starD}" fill="${c}"></path></svg>`).join('')}
              <div class="${a('bs-avp2')}" style="position: relative; width: 108px; height: 108px">
                <span class="${a('bs-rg')}" aria-hidden="true"></span>
                ${ava(s, 108).replace('style="', 'style="border: 4px solid #FFFFFF; ')}
                <span class="yd-new">YANGI</span>
              </div>
            </div>
            <div style="padding: 20px 20px 22px; display: flex; flex-direction: column; gap: 14px; text-align: center">
              <div class="col ${a('bs-v1')}" style="gap: 6px; align-items: center">
                <span class="pill inf">Sizga yangi o'quvchi biriktirildi</span>
                <h2 id="ydYb" style="font-size: 25px; font-weight: 800; letter-spacing: -.02em; line-height: 1.2">${esc(s.name)}<br>endi siz bilan!</h2>
                <span class="s">${teacherOf(s) ? `Asosiy ustoz ${esc(teacherOf(s))} · ` : ''}${lang}${S().progress?.[s.id]?.reached ? ` · ilovada ${S().progress[s.id].reached}-darsda` : ' · noldan boshlaydi'}</span>
              </div>
              <div class="${a('bs-v2')}" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; text-align: left">
                <div class="bs-fc"><span class="xs b">Birinchi aloqa</span><div style="font-size: 15px; font-weight: 800">${first === n.date ? 'Bugun' : esc(firstTxt)}</div><span class="xs">odatdagi vaqti ${esc(s.lessonTime || '—')}</span></div>
                <div class="bs-fc"><span class="xs b">Darslari</span><div style="font-size: 15px; font-weight: 800">${esc(D().patternLabel(s.lessonDayOfWeek) || '—')}</div><span class="xs">${esc(s.lessonTime || '')} · aloqa ${esc(adviceLabel(s))}</span></div>
              </div>
              <div class="${a('bs-v3')}" style="display: flex; align-items: center; justify-content: center; gap: 10px; background: #EAF3FF; border-radius: 18px; padding: 12px 14px; flex-wrap: wrap">
                <span style="font-size: 15px; font-weight: 700; color: #0B3A73">Endi sizda</span>
                <span style="position: relative; display: inline-block; min-width: 40px; height: 34px; padding: 0 6px; overflow: hidden; background: #0065D6; color: #FFFFFF; border-radius: 10px; font-size: 22px; font-weight: 800; text-align: center; line-height: 34px">${reduced() ? cnt : `<span class="bs-fo">${cnt - 1}</span><span class="bs-fi">${cnt}</span>&nbsp;`}</span>
                <span style="font-size: 15px; font-weight: 700; color: #0B3A73">o'quvchi</span>
                ${monthly ? `<span class="xs" style="width: 100%; color: #0B3A73">oyiga yana ${money(monthly)} so'mgacha</span>` : ''}
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1.3fr; gap: 8px">
                <button type="button" class="btn bs-btn" data-ov-x style="color: #0057B8">Yopish</button>
                <button type="button" class="btn bs-btn p" data-ov-open>Kartani ochish</button>
              </div>
            </div>
          </section>`, (ov, close) => {
            ov.querySelector('[data-ov-x]').onclick = () => { close(); setTimeout(() => after?.(), 250); };
            ov.querySelector('.bs-scr').onclick = () => { close(); setTimeout(() => after?.(), 250); };
            ov.querySelector('[data-ov-open]').onclick = () => { close(); U.push('y-karta', s.id); };
        });
    }
    U.onStart.push(() => setTimeout(() => { try { checkNew(); } catch (err) { console.error('[yordamchi]', err); } }, 500));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(() => { try { checkNew(); } catch { /* */ } }, 3000); });

    // ─────────────────────────────────────────────────────────────────────
    // Y07 · O'quvchilarim
    // ─────────────────────────────────────────────────────────────────────
    let oQ = '', oSeg = 'active', oF = 'all';
    function oquvRender() {
        const n = now(), all = helped();
        const noWeek = s => !s.frozen && weekCount(s.id) === 0;
        const q = oQ.trim().toLowerCase();
        const list = all.filter(s => (!q || String(s.name).toLowerCase().includes(q) || String(s.serialCode || '').toLowerCase().includes(q)) && (oF === 'all' || (oF === 'week' ? noWeek(s) : s.frozen)));
        const cp = capOf(n.month);
        const order = s => s.frozen ? 3 : weekCount(s.id) === 0 ? 0 : stuRep(n.month, s.id).counted >= cp ? 2 : 1;
        list.sort((a, b) => order(a) - order(b) || stuRep(n.month, a.id).counted - stuRep(n.month, b.id).counted);
        const inact = S().inactive || [];
        const pill = s => s.frozen ? '<span class="pill mu">Muzlagan</span>' : stuRep(n.month, s.id).counted >= cp ? "<span class=\"pill ok\">To'ldi</span>" : weekCount(s.id) === 0 ? `<span class="pill wa">Hafta 0/3</span>` : '<span class="pill ok">Rejada</span>';
        const row = s => `<a class="li" href="#" data-u-push="y-karta" data-arg="${esc(s.id)}">${ava(s, 42)}<div class="col g1"><span class="nm">${esc(s.name)}</span><span class="s">${teacherOf(s) ? esc(teacherOf(s)) + ' · ' : ''}${s.frozen && freezeOf(s)?.to ? `${longDate(freezeOf(s).to)}gacha` : `${esc(D().patternLabel(s.lessonDayOfWeek))} ${esc(s.lessonTime || '')}`}</span></div><div class="yd-mp">${pill(s)}<span class="xs b">${stuRep(n.month, s.id).counted} / ${cp}</span></div></a>`;
        const inRow = x => `<div class="li">${D().avatar(x, 'av" style="width: 42px; height: 42px')}<div class="col g1"><span class="nm">${esc(x.name)}</span><span class="s">${x.state === 'frozen' ? 'muzlatilgan' : x.state === 'moved' ? "boshqa yordamchiga o'tgan" : x.state === 'finished' ? 'kursni tugatgan' : 'chiqib ketgan'}${x.contacts?.total ? ` · ${x.contacts.total} aloqa` : ''}</span></div><span class="pill mu">Faol emas</span></div>`;
        return `<header class="hd" style="padding-bottom: 4px"><div class="t"><span class="date">Yordamchi sifatida biriktirilganlar</span><h1 style="font-size: 26px">O'quvchilarim</h1></div></header>
          <div class="bd bq" style="gap: 10px">${U.offline()}
            ${oSeg === 'active' ? `<div class="bq-srch"><label for="yd-q" class="sr">Qidirish</label>${svg(P.search, 20, 2).replace('stroke="currentColor"', 'stroke="#4B5563"')}<input id="yd-q" type="search" placeholder="Ism yoki ID" value="${esc(oQ)}" autocomplete="off"></div>` : ''}
            <div class="seg bq-seg44" role="tablist"><button type="button" role="tab" data-yd-seg="active" class="${oSeg === 'active' ? 'on' : ''}" aria-selected="${oSeg === 'active'}">Faol · ${all.length}</button><button type="button" role="tab" data-yd-seg="inactive" class="${oSeg === 'inactive' ? 'on' : ''}" aria-selected="${oSeg === 'inactive'}">Faol emas · ${inact.length}</button></div>
            ${oSeg === 'active' ? `<div class="chips yd-chips">${[['all', 'Hammasi'], ['week', `Bu hafta aloqa yo'q · ${all.filter(noWeek).length}`], ['frozen', `Muzlagan · ${all.filter(s => s.frozen).length}`]].map(([k, l]) => `<button type="button" class="chip${oF === k ? ' on' : ''}" data-yd-f="${k}" aria-pressed="${oF === k}">${l}</button>`).join('')}</div>
            ${list.length ? `<div class="card l a1">${list.map(row).join('')}</div>` : `<div class="card"><span class="s">${all.length ? 'Topilmadi' : "Sizga hali o'quvchi biriktirilmagan"}</span></div>`}`
            : inact.length ? `<div class="card l a1">${inact.map(inRow).join('')}</div><span class="xs" style="padding: 0 4px">Bu o'quvchilar bilan aloqa belgilanmaydi va maoshga qo'shilmaydi. Oldingi aloqalar o'sha oy maoshida qoladi.</span>` : `<div class="card"><span class="s">Faol bo'lmagan o'quvchi yo'q.</span></div>`}
          </div>`;
    }
    U.tab('oquvchilar', {
        render: oquvRender,
        bind(root) {
            bindCommon(root);
            root.querySelectorAll('[data-yd-seg]').forEach(b => b.onclick = () => { oSeg = b.dataset.ydSeg; U.render(); });
            root.querySelectorAll('[data-yd-f]').forEach(b => b.onclick = () => { oF = b.dataset.ydF; U.render(); });
            const inp = root.querySelector('#yd-q');
            if (inp) inp.oninput = () => { oQ = inp.value; const pos = inp.selectionStart; U.render(); const i2 = document.querySelector('#yd-q'); if (i2) { i2.focus(); try { i2.setSelectionRange(pos, pos); } catch { /* */ } } };
        }
    }, Y);

    // ── Y08 · O'quvchi kartasi (yordamchi ko'rinishi: Umumiy · Aloqalar · O'zlashtirish) ──
    let kTab = 'aloqa';
    U.page('y-karta', {
        render(sid) {
            const n = now(), s = D().stuOf(sid);
            const bar = `<div class="bar"><a class="back" href="#" data-u-back>${svg(P.prev, 22, 2.2)}${esc(U.tabLabel())}</a></div>`;
            if (!s) return `${bar}<div class="bd nb"><div class="note w" role="alert"><span>O'quvchi topilmadi yoki sizga biriktirilmagan.</span></div></div>`;
            const sr = stuRep(n.month, sid), pr = S().progress?.[sid] || {}, g = groupLink(s), tn = teacherOf(s), cp = capOf(n.month);
            const todayOk = (sr.items || []).some(i => i.day === n.date && i.status === 'counted');
            let content;
            if (kTab === 'aloqa') {
                const its = (sr.items || []).slice().reverse();
                content = `<section class="card a3" style="gap: 12px"><div class="yd-g2">
                    <div class="col"><span class="xs b">${cap(monName(n.month))}</span><strong class="yd-big">${sr.counted}<span class="xs"> / ${cp} aloqa</span></strong></div>
                    <div class="col"><span class="xs b">Bu hafta</span><strong class="yd-big"${weekCount(sid) === 0 ? ' style="color: #B54708"' : ''}>${weekCount(sid)}<span class="xs"> / 3</span></strong></div>
                    <div class="col"><span class="xs b">Odatdagi vaqti</span><strong style="font-size: 16px">${esc(s.lessonTime || '—')}</strong></div>
                    <div class="col"><span class="xs b">Aloqa kunlari</span><strong style="font-size: 16px">${esc(adviceLabel(s).replace(/·/g, ' · '))}</strong></div></div></section>
                  <section class="card l a4">${its.length ? its.map(i => `<div class="yd-hi"><span class="yd-dt"><b>${+i.day.slice(8)}</b><small>${D().DAY[wd(i.day) - 1]}</small></span><div class="col g1"><span class="nm">${i.outcome === 'no_answer' ? esc(CH_FULL[i.channel] || 'Telefon') : esc(CH_FULL[i.channel] || '') + (i.minutes && i.channel !== 'tg_text' ? ` · ${i.minutes} daq` : '')}</span><span class="s">${esc(i.note || (i.outcome === 'no_answer' ? 'javob bermadi' : '—'))}</span></div><span class="pill ${i.status === 'counted' ? 'ok' : i.outcome === 'no_answer' ? 'wa' : 'mu'}">${i.status === 'counted' ? 'Hisoblandi' : esc(ST_TXT[i.status] || 'Hisoblanmadi')}</span></div>`).join('') : `<div class="yd-hi"><span class="s">${cap(monName(n.month))}da hali aloqa yo'q</span></div>`}</section>`;
            } else if (kTab === 'oz') {
                content = `<section class="card a3" style="gap: 12px"><div class="yd-g2">
                    <div class="col"><span class="xs b">Erishgan dars</span><strong class="yd-big">${pr.reached ?? '—'}<span class="xs"> / 72</span></strong></div>
                    <div class="col"><span class="xs b">1-urinish</span><strong class="yd-big">${pr.firstTryAvg != null ? Math.round(pr.firstTryAvg) + '%' : '—'}</strong></div></div>
                    <span class="xs">Batafsil o'zlashtirishni asosiy ustoz kuzatadi. Aloqada shu darslar ustida ishlang.</span></section>`;
            } else {
                content = `<section class="card l a3">
                    <div class="li"><span class="s g1">Darslari</span><b style="font-size: 14px">${esc(D().patternLabel(s.lessonDayOfWeek))} ${esc(s.lessonTime || '')}</b></div>
                    ${tn ? `<div class="li"><span class="s g1">Asosiy ustoz</span><b style="font-size: 14px">${esc(tn)}</b></div>` : ''}
                    ${startOf(s) ? `<div class="li"><span class="s g1">Kursni boshlagan</span><b style="font-size: 14px">${D().fmtDate(startOf(s))}</b></div>` : ''}
                    <div class="li"><span class="s g1">Holati</span><b style="font-size: 14px">${s.frozen ? `Muzlatilgan${freezeOf(s)?.to ? ' · ' + longDate(freezeOf(s).to) + 'gacha' : ''}` : 'Faol'}</b></div></section>`;
            }
            return `${bar}<div class="bd nb" style="padding-top: 4px; gap: 12px">
                <div class="row a1">${ava(s, 64).replace('style="', 'style="border: 3px solid #FFFFFF; box-shadow: 0 0 0 1px #CBD5E1; ')}<div class="col g1"><strong style="font-size: 21px; font-weight: 800">${esc(s.name)}</strong><span class="s">${s.serialCode ? `ID ${esc(s.serialCode)} · ` : ''}dars ${esc(D().patternLabel(s.lessonDayOfWeek))} ${esc(s.lessonTime || '')}</span><span class="xs" style="margin-top: 2px">${tn ? `Asosiy ustoz: ${esc(tn)} · ` : ''}${pr.reached ? `${pr.reached}-dars` : 'hali boshlanmagan'}</span></div></div>
                <div class="yd-act a2">
                  ${g ? `<a href="${esc(g)}" target="_blank" rel="noopener">${svg(P.tg)}Dars guruhi</a>` : `<span class="yd-dis" aria-disabled="true">${svg(P.tg)}Guruh yo'q</span>`}
                  <a href="#" data-u-push="sorov" data-arg="${esc(sid)}">${svg(P.msg)}Adminga so'rov</a>
                  ${s.frozen ? `<span class="yd-dis" aria-disabled="true">${svg(P.tick, 20, 2.4)}Muzlagan</span>` : `<a href="#" class="pr" data-yd-mark="${esc(sid)}">${svg(P.tick, 20, 2.4)}${todayOk ? 'Yana belgilash' : 'Belgilash'}</a>`}
                </div>
                <div class="seg bq-seg44" role="tablist">${[['gen', 'Umumiy'], ['aloqa', 'Aloqalar'], ['oz', "O'zlashtirish"]].map(([k, l]) => `<button type="button" role="tab" data-yd-kt="${k}" class="${kTab === k ? 'on' : ''}" aria-selected="${kTab === k}">${l}</button>`).join('')}</div>
                ${content}
              </div>`;
        },
        bind(root) {
            bindCommon(root);
            root.querySelectorAll('[data-yd-kt]').forEach(b => b.onclick = () => { kTab = b.dataset.ydKt; U.render(); });
        }
    });

    // ─────────────────────────────────────────────────────────────────────
    // Y09 · Maosh
    // ─────────────────────────────────────────────────────────────────────
    let mPrev = false, mAll = false;
    U.page('y-maosh', {
        render() {
            const n = now(), prevM = D().shiftMonth(n.month, -1), month = mPrev ? prevM : n.month;
            const e = repOf(month), rep = e.data, nm = D().shiftMonth(month, 1), NM = monName(nm);
            const monthly = Number(rep?.monthly) || 0, cp = capOf(month), all = helped().length; // muzlaganda ham chegara o'zgarmaydi
            const bar = `<div class="bar"><a class="back" href="#" data-u-back>${svg(P.prev, 22, 2.2)}${esc(U.tabLabel())}</a></div>`;
            const seg = `<div class="seg bq-seg44"><button type="button" data-yd-mp="1" class="${mPrev ? 'on' : ''}">${cap(monName(prevM))} · ${S().assistPrev?.state?.paid_at ? "to'landi" : 'yopildi'}</button><button type="button" data-yd-mp="0" class="${mPrev ? '' : 'on'}">${cap(monName(n.month))} · joriy</button></div>`;
            if (!rep) return `${bar}<div class="bd nb" style="padding-top: 0; gap: 12px"><h1 class="ttl">Maosh</h1>${seg}${e.err && e.err !== 'x' ? U.err(e, `yd:rep:${month}`) : e.err === 'x' ? '<div class="note w"><span>Aloqa hisobi yuklanmadi.</span></div>' : U.skel(2, 120)}</div>`;
            const lastDay = days(n.month).slice(-1)[0], left = Math.max(0, (Date.parse(lastDay) - Date.parse(n.date)) / 86400000);
            const st = rep.state || {};
            const pill = !mPrev ? `${left} kun qoldi` : st.paid_at ? "To'landi" : st.final_at ? 'Yakuniy tasdiqlandi' : st.prelim_at ? "E'tiroz muddati" : 'Moliya tekshiradi';
            const rows = helped().map(s => { const r = stuRep(month, s.id); return { s, c: r.counted, a: Number(r.amount) || 0 }; }).filter(x => x.c || !mPrev).sort((a, b) => b.c - a.c);
            const shown = mAll ? rows : rows.slice(0, 5);
            const step = (cls, t, sub) => `<div><i class="${cls}"></i><b>${t}</b>${sub}</div>`;
            return `${bar}<div class="bd nb" style="padding-top: 0; gap: 12px">
              <h1 class="ttl">Maosh</h1>${seg}
              <section class="blue a1">${U.HEX('ydMsHex').replace('class="hex"', 'class="hex bq-hex12"')}
                <div class="bq-rel" style="display: flex; justify-content: space-between; align-items: center"><span class="yd-eb">${monName(month).toUpperCase()} · ${mPrev ? (st.final_at ? 'YAKUNIY' : st.prelim_at ? 'DASTLABKI' : 'TEKSHIRUVDA') : 'HOZIRCHA'}</span><span class="pill" style="background: rgba(255,255,255,.2); color: #FFFFFF">${pill}</span></div>
                <div class="bq-rel" style="display: flex; align-items: baseline; gap: 6px"><strong class="yd-amt">${money(rep.amount)}</strong><span style="font-size: 15px; font-weight: 700; color: #DCEBFF">so'm</span></div>
                <span class="bq-rel" style="font-size: 13px; color: #DCEBFF">${rep.counted} ${mPrev ? '' : `/ ${all * cp} `}aloqa${mPrev ? ` · ${rep.students?.length || 0} o'quvchi` : monthly ? ` · to'liq bajarilsa ${money(all * monthly)}` : ''}</span>
                <div class="yd-stp" style="margin-top: 4px">
                  ${step(mPrev ? 'd' : 'n', mPrev ? 'Oy yopildi' : 'Oy davom etmoqda', mPrev ? `1-${NM}` : `${+lastDay.slice(8)}-${monName(n.month)}gacha`)}
                  ${step(mPrev ? (st.final_at ? 'd' : 'n') : '', "E'tiroz", `4-${NM}gacha`)}
                  ${step(mPrev && st.paid_at ? 'd' : '', "To'lov", `5-${NM}`)}
                </div>
              </section>
              <div class="sh" style="flex: none"><h2 style="font-size: 15px">O'quvchilar bo'yicha</h2>${rows.length > 5 ? `<button type="button" class="yd-link" data-yd-all>${mAll ? 'Kamroq' : `Hammasi · ${rows.length}`}</button>` : ''}</div>
              ${shown.length ? `<section class="card l a2">${shown.map(x => `<div class="li">${ava(x.s, 36)}<div class="col g1"><span class="nm">${esc(D().short(x.s.name))}</span><span class="s">${x.c} / ${cp}${x.c >= cp ? " · to'ldi" : ''}${x.s.frozen ? (freezeOf(x.s) ? ` · ${+freezeOf(x.s).from.slice(8)}–${freezeOf(x.s).to ? shortDate(freezeOf(x.s).to) : ''} muzlagan` : ' · muzlagan') : ''}</span></div><b style="font-size: 15px">${money(x.a)}</b></div>`).join('')}</section>` : `<div class="card"><span class="s">Bu oy hali aloqa yo'q.</span></div>`}
              <div class="note i a3">${svg(P.info, 18, 2).replace('<svg', '<svg style="flex: none; margin-top: 1px"')}<span>Har o'quvchi uchun: ${money(monthly)} so'm × aloqa ÷ ${cp}. Oyiga ${cp} tadan ortig'i hisoblanmaydi. Muzlagan kunlarda aloqa belgilanmaydi, chegara esa o'zgarmaydi.</span></div>
            </div>`;
        },
        bind(root) {
            root.querySelectorAll('[data-yd-mp]').forEach(b => b.onclick = () => { mPrev = b.dataset.ydMp === '1'; mAll = false; U.render(); });
            root.querySelector('[data-yd-all]')?.addEventListener('click', () => { mAll = !mAll; U.render(); });
        }
    });

    // ─────────────────────────────────────────────────────────────────────
    // Y10 · Menyu
    // ─────────────────────────────────────────────────────────────────────
    function rulesSheet() {
        const L = [['Har o\'quvchi bilan oyiga 13 tagacha aloqa maoshga o\'tadi', ''], ['Kamida 5 daqiqa', 'yozishmada daqiqa so\'ralmaydi'], ['Kuniga 1 ta hisoblanadi', 'bir kunda ikkita bo\'lsa — bittasi'], ['Yozishma haftasiga 1 ta', 'qo\'ng\'iroq va video cheklanmagan'], ['"Javob bermadi" yoziladi, hisoblanmaydi', 'shu kuni qayta urinsangiz bo\'ladi'], ['Aloqa o\'sha kuni belgilanadi', 'esdan chiqsa — shu oy uchun adminga so\'rov'], ['Haftasiga 3 ta — maqsad', 'maoshga ta\'sir qilmaydi']];
        U.sheet(`<div class="row"><div class="col g1"><h2 style="font-size: 19px; font-weight: 800">Aloqa qoidalari</h2><span class="s">Nima hisobga o'tadi</span></div><button type="button" class="icb" data-u-close aria-label="Yopish" style="border: 0; background: #F1F5F9">${svg(P.x, 18, 2.4)}</button></div>
          <div class="card l" style="border: 0; padding: 0">${L.map(([t, s]) => `<div class="li"><span class="yd-rk">${svg(P.tick, 16, 3)}</span><div class="col g1"><span class="nm" style="white-space: normal">${t}</span>${s ? `<span class="s">${s}</span>` : ''}</div></div>`).join('')}</div>`, null, { label: 'Aloqa qoidalari' });
    }
    U.tab('menyu', {
        render() {
            const s = S(), n = now(), user = s.user || {}, rep = s.assist;
            const late = (s.requests || []).filter(r => r.type === 'assist_late' && r.status === 'new').length;
            const newG = D().myGuides().filter(D().guideIsNew).length;
            const tile = (attr, cls, icon, title, sub, subStyle = '') => `<a class="bq-tile" href="#" ${attr}><span class="bq-ic40 ${cls}">${svg(icon)}</span><span class="col"><strong>${title}</strong><span class="xs"${subStyle ? ` style="${subStyle}"` : ''}>${sub}</span></span></a>`;
            const lang = U.bq?.langOf ? U.bq.langOf() : '';
            return `<div class="bd bq" style="padding-top: 16px; gap: 14px">${U.offline()}
              <h1 class="ttl">Menyu</h1>
              <a href="#" data-u-push="profil" class="blue a1 bq-mcard">${U.HEX('ydMnHex').replace('class="hex"', 'class="hex bq-hex12"')}
                ${meAvatar(56, 'position: relative; border: 3px solid rgba(255,255,255,.85)', true)}
                <div class="col g1 bq-rel" style="gap: 2px"><strong style="font-size: 18px; font-weight: 800">${esc(D().first(user.name || s.me?.name))}</strong><span style="font-size: 13px; color: #DCEBFF">Yordamchi ustoz${lang ? ' · ' + lang : ''} · ${helped().length} o'quvchi</span><span class="bq-rkp">${cap(monName(n.month))}: ${rep?.counted ?? 0} aloqa</span></div>
                <span class="bq-rel">${svg(P.chev, 20, 2.2)}</span>
              </a>
              <nav aria-label="Bo'limlar" class="a2 bq-tiles">
                ${tile('data-u-push="y-maosh"', 'ok', P.money, 'Maosh', rep ? `${thousand(rep.amount)} ming` : 'hisob', rep ? 'color: #067647; font-weight: 700' : '')}
                ${tile('data-u-push="darslik"', 'inf', P.book, 'Darslik', "72 dars · ko'rish")}
                ${tile('data-u-push="y-kech"', 'wa', P.clock, 'Kechikkan aloqa', late ? `${late} kutilmoqda` : "adminga so'rov")}
                ${tile('data-yd-inactive', 'mu', P.box, 'Faol emas', `${s.inactive?.length ?? 0} o'quvchi`)}
                ${tile('data-u-push="taqdimot"', 'mu', P.pen, 'Doska', "bo'sh doska")}
                ${tile('data-u-push="sorov"', 'mu', P.msg, "Adminga so'rov", 'yangi yozish')}
                ${tile('data-yd-rules', 'inf', P.rules, 'Aloqa qoidalari', 'nima hisoblanadi')}
                ${tile('data-u-push="yoriq"', 'inf', P.help, "Yo'riqnomalar", newG ? `${newG} ta yangi` : 'qoidalar', newG ? 'color: #0057B8; font-weight: 700' : '')}
                ${tile('data-u-push="bildirish"', 'mu', P.bell, 'Xabarlar', unread() ? `${unread()} ta yangi` : 'bildirishnomalar', unread() ? 'color: #0057B8; font-weight: 700' : '')}
              </nav>
              <div class="card l a3">
                <a class="bq-ml" href="#" data-u-push="profil">${svg(P.tg).replace('currentColor', '#3A4456')}<span class="g1 bq-mlt">Telegram bot</span>${U.bq?.tgPill ? U.bq.tgPill() : ''}</a>
                <a class="bq-ml" href="#" data-u-push="profil">${svg(P.gear).replace('currentColor', '#3A4456')}<span class="g1 bq-mlt">Sozlamalar</span>${svg(P.chev, 18, 2.2).replace('currentColor', '#4B5563')}</a>
                <button type="button" class="bq-ml bq-out" data-yd-logout>${svg(P.out)}<span class="g1 bq-mlt" style="font-weight: 700">Chiqish</span></button>
              </div>
            </div>`;
        },
        bind(root) {
            bindCommon(root);
            root.querySelector('[data-yd-inactive]')?.addEventListener('click', e => { e.preventDefault(); oSeg = 'inactive'; U.go('oquvchilar'); });
            root.querySelector('[data-yd-rules]')?.addEventListener('click', e => { e.preventDefault(); rulesSheet(); });
            root.querySelector('[data-yd-logout]')?.addEventListener('click', () => {
                U.sheet(`<div class="row"><div class="col g1"><h2 style="font-size: 19px; font-weight: 800">Chiqasizmi?</h2><span class="s">Bu telefondan akkauntdan chiqasiz.</span></div></div><button type="button" class="btn w" data-yd-out style="color: #B42318; border-color: #FECDCA">Chiqish</button><button type="button" class="btn w" data-u-close>Bekor qilish</button>`,
                    el => { el.querySelector('[data-yd-out]').onclick = () => { D().logout(false); location.replace('/'); }; }, { label: 'Chiqish' });
            });
        }
    }, Y);

    // ─────────────────────────────────────────────────────────────────────
    // Y11 · Kechikkan aloqa — adminga so'rov (faqat shu oy kunlari)
    // ─────────────────────────────────────────────────────────────────────
    const kf = { sid: '', day: '', ch: 'phone', min: 10, why: '' };
    function lateDays(sid) {
        const n = now(), s = D().stuOf(sid); if (!s) return [];
        const counted = new Set((stuRep(n.month, sid).items || []).filter(i => i.status === 'counted').map(i => i.day));
        const pend = new Set((S().requests || []).filter(r => r.type === 'assist_late' && r.status === 'new' && r.payload?.studentId === sid).map(r => D().day10(r.payload.day)));
        // Shu oyning o'quvchi faol bo'lgan istalgan o'tgan kuni (tavsiya kuni bo'lmasa ham — server ham shunday qabul qiladi).
        // Muzlagan / chiqib ketgan kunlar statusHistory bo'yicha chiqariladi (server ularga 409 qaytaradi).
        const off = (s.statusHistory || []).filter(h => h.status && h.status !== 'active');
        const inactive = d => off.some(h => String(h.from || '').slice(0, 10) <= d && (!h.to || String(h.to).slice(0, 10) >= d));
        return days(n.month).filter(d => d < n.date && !counted.has(d) && !pend.has(d) && !(startOf(s) && d < startOf(s)) && !inactive(d)).reverse();
    }
    U.page('y-kech', {
        render(arg) {
            const n = now(), [aSid, aDay] = String(arg || '').split('|');
            if (aSid && kf._arg !== arg) { kf.sid = aSid; kf.day = aDay || ''; kf._arg = arg; }
            const list = helped();
            if (!kf.sid || !list.some(s => s.id === kf.sid)) kf.sid = list[0]?.id || '';
            const ds = kf.sid ? lateDays(kf.sid) : [];
            // Kalendardan bosilgan kun ro'yxatda bo'lmasa — jimgina almashtirilmaydi, sababi aytiladi.
            const askedBad = aSid === kf.sid && aDay && kf.day === aDay && !ds.includes(aDay) ? aDay : '';
            if (!ds.includes(kf.day)) kf.day = askedBad ? '' : ds.find(d => inPattern(D().stuOf(kf.sid), d)) || ds[0] || '';
            const locked = !!S().assist?.state?.final_at;
            const mine = (S().requests || []).filter(r => r.type === 'assist_late' && D().day10(r.payload?.day || '').slice(0, 7) === n.month);
            const stName = { new: ['wa', 'Kutilmoqda'], approved: ['ok', 'Tasdiqlandi'], rejected: ['bad', 'Rad etildi'] };
            const sel = (id, label, opts, val, lead = '') => `<div class="col" style="gap: 6px"><label class="yd-lb" for="${id}">${label}</label><div class="yd-sel${lead ? ' av' : ''}">${lead}<select id="${id}">${opts.map(([v, t]) => `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>${svg(P.down, 18, 2.2).replace('currentColor', '#4B5563')}</div></div>`;
            // Dizayn Y11: usul va daqiqa — bitta tanlov ("Telefon · 10"); yozishmada daqiqa yo'q.
            const UM = D().CHANNELS.flatMap(([k, l]) => k === 'tg_text' ? [[`${k}|0`, CH.find(c => c[0] === k)[1]]] : [5, 10, 15, 20, 30].map(m => [`${k}|${m}`, `${CH.find(c => c[0] === k)?.[1] || l} · ${m === 30 ? '30+' : m}`]));
            const umVal = `${kf.ch}|${kf.ch === 'tg_text' ? 0 : kf.min}`, ks = D().stuOf(kf.sid);
            return `<div class="bar"><a class="back" href="#" data-u-back>${svg(P.prev, 22, 2.2)}${esc(U.tabLabel())}</a></div>
              <div class="bd nb" style="padding-top: 0; gap: 12px">
                <h1 class="ttl">Kechikkan aloqa</h1>
                <div class="note i a1">${svg(P.clock, 18, 2).replace('<svg', '<svg style="flex: none; margin-top: 1px"')}<span>Aloqa o'sha kuni belgilanadi. Esdan chiqqan bo'lsa — shu yerdan yozing, admin tasdiqlasa hisobga o'tadi. Faqat <b>shu oy</b> kunlari uchun.</span></div>
                ${askedBad ? `<div class="note w" role="alert"><span><b>${longDate(askedBad)}</b> uchun so'rov yuborib bo'lmaydi: o'sha kuni hisoblangan aloqa yoki ochiq so'rov bor, yoki o'quvchi faol bo'lmagan. Boshqa kunni tanlang.</span></div>` : ''}
                ${locked ? `<div class="note w"><span><b>${cap(monName(n.month))} yakuniy tasdiqlangan</b> — so'rov yuborib bo'lmaydi.</span></div>` : list.length ? `<section class="card a2" style="gap: 12px">
                  ${sel('yd-ks', "O'quvchi", list.map(s => [s.id, s.name]), kf.sid, ks ? ava(ks, 32).replace('class="av"', 'class="av yd-sav"') : '')}
                  <div class="yd-g2" style="gap: 8px">
                    ${ds.length ? sel('yd-kd', 'Qachon', ds.map(d => [d, `${+d.slice(8)}-${D().MON_S[+d.slice(5, 7) - 1].toLowerCase()}, ${D().DAY[wd(d) - 1]}`]), kf.day) : '<div class="col" style="gap: 6px"><span class="yd-lb">Qachon</span><span class="s" style="min-height: 52px; display: flex; align-items: center">Belgilanmagan kun yo\'q</span></div>'}
                    ${sel('yd-kc', 'Usul · daqiqa', UM, umVal)}
                  </div>
                  <div class="fl"><label for="yd-kw">Nega o'sha kuni belgilanmadi? <span style="color: #B42318">*</span></label><textarea id="yd-kw" placeholder="Masalan: internet yo'q edi">${esc(kf.why)}</textarea></div>
                  <button type="button" class="btn p w" data-yd-send${!kf.day ? ' disabled' : ''}>Adminga yuborish</button>
                </section>` : `<div class="card"><span class="s">Sizga hali o'quvchi biriktirilmagan.</span></div>`}
                ${mine.length ? `<div class="sh" style="flex: none"><h2 style="font-size: 15px">So'rovlarim</h2><span class="xs">shu oy</span></div>
                <section class="card l a3">${mine.map(r => { const p = r.payload || {}, s = D().stuOf(p.studentId), [cls, t] = stName[r.status] || ['mu', r.status]; return `<div class="li">${s ? ava(s, 36) : ''}<div class="col g1"><span class="nm">${esc(s ? D().short(s.name) : '')} · ${+String(p.day).slice(8, 10)}-${monName(n.month).slice(0, 3)}</span><span class="s">${esc(CH_FULL[p.channel] || '')}${p.minutes && p.channel !== 'tg_text' ? ` · ${p.minutes} daq` : ''}${r.decision_note ? ' · ' + esc(r.decision_note) : ''}</span></div><span class="pill ${cls}">${t}</span></div>`; }).join('')}</section>` : ''}
              </div>`;
        },
        bind(root) {
            const keep = () => { kf.why = root.querySelector('#yd-kw')?.value || kf.why; };
            root.querySelector('#yd-ks')?.addEventListener('change', e => { keep(); kf.sid = e.target.value; kf.day = ''; U.render(); });
            root.querySelector('#yd-kd')?.addEventListener('change', e => { kf.day = e.target.value; });
            root.querySelector('#yd-kc')?.addEventListener('change', e => { const [c, m] = e.target.value.split('|'); kf.ch = c; if (+m) kf.min = +m; });
            root.querySelector('[data-yd-send]')?.addEventListener('click', async e => {
                keep();
                const reason = kf.why.trim();
                if (reason.length < 5) return U.toast('Sababni yozing (kamida 5 belgi)');
                const btn = e.currentTarget; btn.disabled = true;
                try {
                    const r = await U.api('/api/school/assist/late-requests', { method: 'POST', body: { studentId: kf.sid, day: kf.day, channel: kf.ch, minutes: kf.ch === 'tg_text' ? 0 : kf.min, reason } });
                    if (r.request) S().requests = [r.request, ...(S().requests || [])];
                    kf.why = ''; kf.day = '';
                    U.toast("So'rov adminga yuborildi", { ok: true }); U.render();
                } catch (err) { U.toast(err.message); btn.disabled = false; }
            });
        }
    });

    // Daqiqa o'tishi bilan Bosh/Aloqalar yangilansin (Belgilang / Keyingi holatlari).
    let lastMin = -1;
    setInterval(() => {
        if (!window.UstozV2?.active || U.mode() !== Y) return;
        const m = Math.floor(Date.now() / 60000); if (m === lastMin) return; lastMin = m;
        const cur = U.current();
        if ((cur.id === 'home' || cur.id === 'davomat') && !document.querySelector('#app > .sheet')) U.render();
    }, 20000);
})();
