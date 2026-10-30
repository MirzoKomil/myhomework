// Ustoz va yordamchi kabineti: faol bo'lmagan o'quvchilar, avatar tanlash (barcha xodimlar),
// o'quvchi oynasida aloqalar bloki, sotuvchining "O'quvchilar" sahifasi.
// Yordamchi aloqalari (belgilash oynasi, Davomat, Bosh sahifa) — js/yordamchi.js.
(function () {
    'use strict';
    const U = () => window.schoolUI;
    const CH = { phone: 'Telefon', zoom: 'Zoom', meet: 'Google Meet', tg_video: 'Telegram video', tg_group: 'Telegram guruh videodars', tg_text: 'Telegram yozishma' };
    // Sabab matnlari — js/schoolUI.js CST (bitta manba); bu yerda faqat pill rangi.
    const CST = (window.schoolUI && window.schoolUI.CST) || {};
    const ST = { counted: ['hisoblandi', 'sc-pill--ok'], no_answer: ['javob bermadi', 'sc-pill--mute'], short: [CST.short, 'sc-pill--warn'], same_day: [CST.same_day, 'sc-pill--mute'], extra_text: [CST.extra_text, 'sc-pill--mute'], over_cap: [CST.over_cap, 'sc-pill--mute'], before_start: [CST.before_start, 'sc-pill--mute'] };

    // ── O'quvchi oynasida: yordamchi aloqalari (asosiy ustoz, ROP, sotuv — faqat o'qish) ──
    async function contactsBlock(studentId, el) {
        const { api, esc, fmtDate } = U();
        try {
            const r = await api(`/students/${encodeURIComponent(studentId)}/contacts`);
            el.innerHTML = `<h3>Yordamchi aloqalari · ${esc(r.month)}</h3><p><b>${r.counted}</b> / ${r.cap} hisoblandi${r.noAnswer ? ` · ${r.noAnswer} javob bermadi` : ''}</p>
              <ul class="sc-hist">${r.items.slice(-6).reverse().map(i => `<li>${esc(fmtDate(i.day))} · ${esc(CH[i.channel] || i.channel)}${i.minutes ? ' ' + i.minutes + ' daq' : ''} · <span class="sc-pill ${ST[i.status][1]}">${ST[i.status][0]}</span></li>`).join('') || '<li class="sc-mt">Bu oy aloqa yo\'q</li>'}</ul>
              <p class="sc-mt">Faqat ko'rish uchun · aloqani yordamchi belgilaydi</p>`;
        } catch (e) { el.remove(); }
    }

    // ── Faol bo'lmagan o'quvchilar (ustoz, sotuv): o'z davri, faollar bilan aralashmaydi ──
    // Sahifa ichida (root berilsa) — holat bo'yicha kartalar (js/studentArchive.js); aks holda eski oyna.
    async function openInactive(root, opts) {
        // Sotuv: arxiv — O'quvchilar sahifasining o'zida (SotuvOquvchiArxiv, bo'limli kartalar), yon oyna emas.
        const isSales = typeof getCurrentUser === 'function' && getCurrentUser()?.role === 'sales_manager';
        if (isSales && !(root && root.nodeType === 1) && typeof switchTab === 'function') {
            soldState.tab = 'inactive';
            const r = document.getElementById('schoolMyStudents');
            if (document.getElementById('tab-students')?.classList.contains('active') && r && !r.hidden) return renderSoldStudents(r);
            switchTab('students', { studentsSection: 'faol' });
            return;
        }
        if (window.studentArchive) return root && root.nodeType === 1 ? window.studentArchive.render(root, opts || {}) : window.studentArchive.openDrawer();
        const { api, esc, openDrawer, fmtDate, studentAvatar } = U();
        const box = openDrawer({ title: 'Faol emas', sub: 'Muzlatilgan, chiqib ketgan va boshqa ustozga o\'tganlar · faqat siz bilan bo\'lgan davr', body: '<div class="sc-skel"></div>', wide: true });
        try {
            const { students } = await api('/inactive');
            const L = { frozen: ['Muzlatilgan', 'sc-pill--info'], left: ['Chiqib ketgan', 'sc-pill--bad'], moved: ['Boshqa ustozga o\'tgan', 'sc-pill--mute'] };
            box.querySelector('.sc-db').innerHTML = students.length ? `<table class="sc-table"><thead><tr><th>O'quvchi</th><th>Holat</th><th>Sana</th><th>Sabab</th></tr></thead><tbody>${students.map(s => `<tr><td><span class="sc-row">${studentAvatar(s, 28)}<button type="button" class="sc-link" data-st="${esc(s.id)}">${esc(s.name)}</button></span></td><td><span class="sc-pill ${L[s.state][1]}">${L[s.state][0]}</span></td><td>${s.state === 'left' && s.from ? 'oxirgi dars ' + esc(fmtDate(U().addDays(s.from, -1), false)) : s.from ? esc(fmtDate(s.from, false)) : '—'}${s.to ? ' – ' + esc(fmtDate(s.to, false)) : ''}</td><td class="sc-mt">${esc(s.reason || '')}</td></tr>`).join('')}</tbody></table>`
                : '<p class="sc-mt">Faol bo\'lmagan o\'quvchi yo\'q</p>';
            box.querySelectorAll('[data-st]').forEach(b => b.onclick = () => U().openStudent(b.dataset.st));
        } catch (e) { U().errBox(box, e.message); }
    }

    // ── Avatar tanlash (barcha xodimlar): 36 ayol + 36 erkak, band personaj tanlanmaydi ──
    async function renderAvatarPicker(el, { current = '', onSaved } = {}) {
        const { api, esc } = U();
        let taken = [];
        try { taken = (await api('/avatars/taken')).taken; } catch { /* ko'rsatiladi, server baribir tekshiradi */ }
        let set = el.dataset.set || (/\/m\d\d\.webp$/.test(current) ? 'm' : 'f');
        const draw = () => {
            const items = Array.from({ length: 36 }, (_, i) => `/images/staff-avatars/${set}${String(i + 1).padStart(2, '0')}.webp`);
            el.innerHTML = `<div class="sc-row sc-wrap"><div class="sc-seg" role="group" aria-label="To'plam"><button type="button" data-set="f" aria-pressed="${set === 'f'}">Ayollar · 36</button><button type="button" data-set="m" aria-pressed="${set === 'm'}">Erkaklar · 36</button></div>
              <span class="sc-mt">"band" — boshqa xodim tanlagan · CRM va xodimlar chatida ko'rinadi</span></div>
              <div class="sc-avg">${items.map(u => { const tk = taken.includes(u); const on = u === current; return `<button type="button" class="sc-avb${on ? ' on' : ''}${tk ? ' tk' : ''}" data-u="${esc(u)}"${tk ? ' disabled aria-disabled="true" title="Band"' : ''} aria-pressed="${on}"><img src="${esc(u.slice(1))}" alt="" loading="lazy">${tk ? '<i>band</i>' : ''}</button>`; }).join('')}</div>`;
            el.querySelectorAll('[data-set]').forEach(b => b.onclick = () => { set = el.dataset.set = b.dataset.set; draw(); });
            el.querySelectorAll('.sc-avb:not(.tk)').forEach(b => b.onclick = async () => {
                try { const r = await api('/me/avatar', { method: 'PUT', body: { avatar: b.dataset.u } }); current = r.avatar; U().toast('Avatar saqlandi'); draw(); onSaved?.(r.avatar); }
                catch (e) { U().toast(e.message, 4000); }
            });
        };
        draw();
    }

    // ── Ustoz bosh sahifasi: "Bajarish kerak", bugungi sinovlar ──
    // renderTeacherHome sinxron chiziladi; bu yerda serverdan kelgan qismlar keyin qo'shiladi.
    // Ustozga to'lov/tarif summalari ko'rsatilmaydi — faqat o'z maoshi.
    const num = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    async function homeExtras(container, user) {
        const u = U(); if (!u || !container) return;
        const { api, esc, today } = u;
        const tid = user?.linkedTeacherId; if (!tid) return;
        // Bosh sahifa qayta chizilsa (renderDashboardOverview ikki marta), eski chaqiruv yangi ro'yxatga qo'shmasin —
        // aks holda bugungi sinov qatori ikki marta chiqadi.
        const home = container.querySelector('#teacherHome') || container;
        const alive = () => container.isConnected && home.isConnected;
        const td = today();
        // /makeups xatosi bo'sh ro'yxatga aylantirilmaydi (BAHO-5 #3): aks holda har "Kelmadi" qoplanmagan deb sanalib,
        // "Bajarish kerak"da soxta "9 ta qoplanmagan dars · ≈174 700 so'm" chiqardi. todoItems rad etilgan va'dani oladi,
        // o'zi qayta so'raydi; yana xato bo'lsa — xato kartasi + "Qayta urinish".
        const mkP = api('/makeups');
        mkP.catch(() => { /* quyida ishlanadi */ });
        const payP = window.UstozHome?.myPay ? window.LoadErr.settle(window.UstozHome.myPay()) : Promise.resolve({ ok: true, value: null });
        // Qoplanmagan darslar (≈ ustoz maoshidan) va "e'tibor kerak" — js/ustozHome.js, parallel yuklanadi.
        const extraP = window.UstozHome?.todoItems ? window.UstozHome.todoItems(user, mkP).catch(() => []) : Promise.resolve([]);
        // 29-okt: asosiy ustoz yordamchi bo'la olmaydi. O'tgan yordamchi aloqalari maoshga kiradi — /api/payroll/me (maosh kartasi).
        const [trials, makeups, abs] = await Promise.all([
            (typeof apiFetchTeacherTrialLessons === 'function' ? apiFetchTeacherTrialLessons() : Promise.resolve({ lessons: [] })).catch(() => ({ lessons: [] })),
            mkP.catch(() => null),
            api(`/attendance/absences?month=${td.slice(0, 7)}`).catch(() => null)
        ]);
        if (!alive()) return;
        // "Kelmadi" (school_absences) — Davomat va Dars jadvali bilan bitta manba: bugungi qatorlar va hisoblar shundan.
        if (abs) {
            globalThis.__schoolAbsences = { month: td.slice(0, 7), list: abs.absences || [] };
            const gone = new Set((abs.absences || []).filter(a => String(a.day).slice(0, 10) === td).map(a => a.studentId));
            for (const row of home.querySelectorAll('[data-thx-today] > li[data-thx-duty="main"]')) {
                if (!gone.has(row.dataset.thxSid) || row.dataset.thxSt === 'ok' || row.dataset.thxSt === 'bad') continue;
                row.dataset.thxSt = 'bad'; row.className = row.className.replace(/tch-row--\w+/, 'tch-row--bad');
                const acts = row.querySelector('.tch-row-actions');
                if (acts) acts.innerHTML = '<span class="uhb-pill uhb-pill--bad">Kelmadi</span>';
                const sub = row.querySelector('.mot-prize-note'); if (sub) sub.textContent = sub.textContent.replace(' · dars tugagan', '');
            }
        }
        else {
            // "Kelmadi" ro'yxati yuklanmadi — tugagan darsni "Belgilanmagan" deb ko'rsatmaymiz (kelmagan bo'lishi mumkin); xabar "Bajarish kerak"da.
            for (const row of home.querySelectorAll('[data-thx-today] > li[data-thx-duty="main"][data-thx-st="warn"]')) {
                row.dataset.thxSt = 'unk'; row.className = row.className.replace(/tch-row--\w+/, 'tch-row--wait');
                const acts = row.querySelector('.tch-row-actions');
                if (acts) acts.innerHTML = '<span class="uhb-pill uhb-pill--mute" title="Davomat ma\'lumoti yuklanmadi">—</span>';
            }
        }
        if (makeups) globalThis.__schoolMakeups = makeups.makeups || [];
        // "+N qoplash tekshiruvda" — shu oyda o'tilgan va tasdiqlab bo'ladigan (missed_came emas) qoplashlar: Davomat va
        // Mening maoshim bilan bitta ta'rif (AttendanceRules.reviewMakeups).
        const reviewing = !makeups ? 0 : window.AttendanceRules?.reviewMakeups
            ? window.AttendanceRules.reviewMakeups(makeups.makeups, { id: tid, month: td.slice(0, 7), mainAtt: (getItem(STORAGE_KEYS.mainAttendance, {}) || {})[`${td.slice(0, 7)}_${tid}`] }).length
            : (makeups.makeups || []).filter(m => m.status === 'review' && m.missed_came !== true).length;

        // Maosh — server payroll (/api/payroll/me): Davomat va "Mening maoshim" bilan bitta manba (brauzerda hisoblanmaydi).
        const sal = home.querySelector('[data-thx-sal]'), sub = home.querySelector('[data-thx-salsub]');
        // Xato bo'lsa — bitta naqsh (js/loadError.js): "—" va sabab + "Qayta urinish" (faqat shu karta qayta so'raladi).
        const fillSal = async pr => {
            const res = await pr;
            if (!alive()) return;
            const pay = res.ok ? res.value : null, c = pay?.linked ? pay.current : null;
            if (!res.ok) {
                sal.textContent = '—';
                if (sub) { sub.innerHTML = window.LoadErr.html({ title: 'Maosh hisobini yuklab bo\'lmadi', err: res.err, note: '', compact: true, cls: 'thx-sal-err' });
                    window.LoadErr.bind(sub, () => fillSal(window.LoadErr.settle(window.UstozHome.myPay(true)))); }
            } else if (!c) { sal.textContent = '—'; if (sub) sub.textContent = 'maosh hisobi bog\'lanmagan · oy yopilganda Moliya tasdiqlaydi'; }
            else {
                const main = Number(c.mainTotal ?? c.total) || 0, extra = Number(c.assistantTotal) || 0;
                sal.textContent = num(Number(c.total) || 0);
                if (sub) sub.innerHTML = `${extra ? `asosiy ${num(main)} + o'tgan yordamchi aloqalari ${num(extra)} · ` : ''}${reviewing ? `<b>+${reviewing} qoplash tekshiruvda</b> (admin tasdiqlasa qo'shiladi) · ` : ''}oy yopilganda Moliya tasdiqlaydi`;
            }
        };
        if (sal) await fillSal(payP);

        // Bugungi sinov darslari — bugungi ro'yxatga qo'shiladi (UstozBosh: "30 daq · sinov darsi" + holat pill'i).
        const lessons = (trials.lessons || []).filter(l => l.trialRequest);
        const at = l => new Date(l.trialRequest.scheduledAt);
        const localDate = d => new Date(d.getTime() + 5 * 3600000).toISOString().slice(0, 10);
        const hhmm = d => new Date(d.getTime() + 5 * 3600000).toISOString().slice(11, 16);
        const list = home.querySelector('[data-thx-today]');
        const todayTrials = lessons.filter(l => Number.isFinite(at(l).getTime()) && localDate(at(l)) === td && ['pending', 'accepted'].includes(l.trialRequest.state));
        if (list && todayTrials.length) {
            const rows = [...list.children];
            for (const l of todayTrials) {
                const key = l.trialRequest.id || l.id;
                if (list.querySelector(`[data-thx-trial="${CSS.escape(String(key))}"]`)) continue;
                const t = hhmm(at(l)), past = at(l).getTime() < Date.now(), pending = l.trialRequest.state === 'pending';
                const dur = Number(l.trialRequest.duration || l.duration) || 30;
                const pill = past ? `<span class="uhb-pill uhb-pill--warn">${pending ? 'Muddati o\'tdi · natija kerak' : 'Natija kutilmoqda'}</span>`
                    : pending ? '<span class="uhb-pill uhb-pill--warn">Tasdiq kutilmoqda</span>' : '<span class="uhb-pill uhb-pill--mute">Kutilmoqda</span>';
                const li = document.createElement('li');
                li.className = `tch-row tch-row--${past ? 'warn' : 'wait'}`;
                li.dataset.thxTrial = key; li.dataset.thxT = t;
                li.innerHTML = `<b class="tch-time">${esc(t)}</b><div class="uhb-inf"><strong>${esc(l.name || 'Lid')}</strong><span class="mot-prize-note">${dur} daq · sinov darsi</span></div><div class="tch-row-actions">${pill}</div>`;
                const before = rows.find(r => (r.dataset.thxT || r.querySelector('.tch-time')?.textContent || '99') > t);
                list.insertBefore(li, before || null);
            }
            home.querySelector('[data-thx-today-empty]')?.remove();
        }
        // Sarlavha: "Bugun · N dars + N sinov"; plitka: "+N sinov · N belgilanmagan".
        const cnt = home.querySelector('[data-thx-today-count]');
        if (cnt) { const l = Number(cnt.dataset.l) || 0, t = todayTrials.length; cnt.textContent = `${l} dars${t ? ` + ${t} sinov` : ''}`; }

        // Bajarish kerak — har biri maosh yoki o'quvchi natijasiga ta'sir qiladi.
        const todo = [];
        // "Keldi" desangiz ilovada ochiladigan dars — /api/academic/next-lessons (Davomat sahifasi bilan bir manba).
        const unmarkedRows = [...home.querySelectorAll('.tch-row--warn[data-thx-duty="main"]')];
        const nextL = unmarkedRows.length && typeof apiFetch === 'function'
            ? await apiFetch(`/api/academic/next-lessons?ids=${encodeURIComponent(unmarkedRows.map(r => r.dataset.thxSid).join(','))}`, { timeout: 30000 }).then(r => r.lessons || {}).catch(() => ({})) : {};
        if (!alive()) return;
        unmarkedRows.forEach(row => {
            const no = nextL[row.dataset.thxSid]?.nextLive?.no;
            todo.push({ ic: 'warn', t: `${row.querySelector('strong')?.textContent || ''} · ${row.querySelector('.tch-time')?.textContent || ''} darsi belgilanmagan`, s: `Belgilanmagan dars maoshga o'tmaydi.${no ? ` "Keldi" desangiz ${no}-dars ilovada ochiladi.` : ''}`, btn: 'Belgilash', go: 'teachers-section' });
        });
        // Tartib: avval o'tgan (natija kerak), keyin kelgusi sinovlar — vaqt bo'yicha.
        const tomorrow = u.addDays(td, 1);
        for (const l of [...lessons].sort((a, b) => at(a) - at(b))) {
            const d = at(l); if (!Number.isFinite(d.getTime())) continue;
            const day = localDate(d), when = `${day === td ? 'bugun' : day === tomorrow ? 'ertaga' : u.fmtDate(day, false)} ${hhmm(d)}`;
            const When = when.charAt(0).toUpperCase() + when.slice(1);
            const mgr = l.managerName ? `sotuv menejeri ${l.managerName}ga` : 'sotuv menejeriga';
            if (l.trialRequest.state === 'pending' && d.getTime() <= Date.now()) todo.push({ ic: 'user', t: `${l.name || 'Lid'} · sinov darsi natijasi`, s: `${When} o'tdi, tasdiqlanmagan · muddati o'tdi, natijani yozing`, btn: 'Natijani yozish', go: 'trial-lessons' });
            else if (l.trialRequest.state === 'pending') todo.push({ ic: 'clock', t: `${l.name || 'Lid'} · ${when} sinov darsi`, s: 'Tasdiqlamaguningizcha lidga vaqt yuborilmaydi', btn: 'Tasdiqlash', go: 'trial-lessons' });
            else if (l.trialRequest.state === 'accepted' && d.getTime() < Date.now()) todo.push({ ic: 'user', t: `${l.name || 'Lid'} · sinov darsi natijasi`, s: `${When} o'tdi · natija ${mgr} boradi`, btn: 'Natijani yozish', go: 'trial-lessons' });
        }
        todo.push(...(await extraP));
        if (!alive()) return;
        const box = home.querySelector('[data-thx-todo]');
        if (box) {
            const TI = { warn: '<path d="M12 3 2 21h20L12 3zM12 10v5M12 18h.01"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>', att: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', sync: '<path d="M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5"/>' };
            const ico = k => TI[k] ? `<span class="thx-ti thx-ti--${k}" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TI[k]}</svg></span>` : '';
            box.innerHTML = todo.length ? `<section class="card dashboard-panel thx-todo"><div class="dashboard-panel-head"><h3>Bajarish kerak · ${todo.filter(x => !x.err).length}</h3><span>Har biri maoshingiz yoki o'quvchi natijasiga ta'sir qiladi</span></div>
                <ul>${todo.map((x, i) => x.err ? `<li class="thx-lerr">${window.LoadErr.html({ title: x.t, err: x.err, note: x.s, compact: true })}</li>` : `<li>${ico(x.ic)}<div><b>${esc(x.t)}</b><small>${esc(x.s)}</small></div><button type="button" class="sc-btn sc-btn--sm" ${x.act ? `data-act="${i}"` : `data-go="${x.go}"`}>${esc(x.btn)}</button></li>`).join('')}</ul></section>` : '';
            box.querySelectorAll('[data-go]').forEach(b => b.onclick = () => switchTab(b.dataset.go));
            box.querySelectorAll('[data-act]').forEach(b => b.onclick = () => todo[Number(b.dataset.act)]?.act?.());
            window.LoadErr.bind(box, () => { if (typeof renderDashboardOverview === 'function') renderDashboardOverview(typeof _lastDashboardOverviewArgs !== 'undefined' ? _lastDashboardOverviewArgs || {} : {}); });
        }
        // Plitka "Bugun": "N dars + N aloqa" / "+N sinov · N belgilanmagan" (dizayndagidek).
        const tile = home.querySelector('.kbx-tiles > div:first-child');
        if (tile && cnt) {
            const l = Number(cnt.dataset.l) || 0, un = home.querySelectorAll('.tch-row--warn[data-thx-duty="main"]').length;
            const b = tile.querySelector('b'), sm = tile.querySelector('small');
            if (b) b.textContent = `${l} dars`;
            const bits = [todayTrials.length ? `+${todayTrials.length} sinov` : '', un ? `${un} belgilanmagan` : ''].filter(Boolean);
            if (sm && bits.length) sm.innerHTML = `<span class="${un ? 'kbx-bad' : ''}">${esc(bits.join(' · '))}</span>`;
            else if (sm && /belgilanmagan/.test(sm.textContent)) sm.textContent = 'hammasi belgilangan';
        }


    }

    // Ustoz/yordamchi "O'quvchilar" sahifasi (renderMyStudents) — js/yordamchi.js.

    // ── Sotuv menejeri: "O'quvchilar" (SotuvOquvchilar + SotuvOquvchiArxiv) — o'zi sotganlar, ustoz davomati va yordamchi aloqalari ──
    // Bitta "Mening o'quvchilarim" kartasi: Hammasi · E'tibor kerak · Faol emas (arxiv shu kartada, oyna emas); ostida tanlangan
    // o'quvchining ikki kartasi. 390px'da jadval qatorlari kartaga aylanadi (css/rop-sotuv-dizayn.css).
    let soldState = { tab: 'all', sel: '' };
    const TG_ICO = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.5 4.3 2.9 11.5l4.8 1.5 1.8 5.6 3.2-2.7 4.7 3.5 3.1-14.6z"/></svg>';
    async function renderSoldStudents(root) {
        const { api, esc, fmtDate, pattern, studentAvatar } = U();
        if (!root.dataset.loaded) root.innerHTML = '<div class="sc-skel"></div>';
        const [r, inact] = await Promise.all([api('/sold-students'), window.LoadErr.settle(api('/inactive'))]);
        root.dataset.loaded = '1';
        const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
        const mName = MON[Number(r.month.slice(5)) - 1], mCap = mName[0].toUpperCase() + mName.slice(1);
        const short = n => { const p = String(n || '').trim().split(/\s+/); return p[0] ? p[0] + (p[1] ? ' ' + p[1][0] + '.' : '') : '—'; };
        const local = new Map(getItem(STORAGE_KEYS.students, []).map(s => [s.id, s]));
        const inN = inact.ok ? (inact.value.students || []).length : null;
        const head = sub => `<div class="sc-head rs-sh"><div><h1>O'quvchilar</h1><p class="sc-sub">${sub}</p></div><span class="sc-pill sc-pill--mute rs-pillr">Boshqa menejerlar o'quvchilari ko'rinmaydi</span></div>`;
        if (soldState.tab === 'inactive') {
            root.innerHTML = `${head('Siz sotgan o\'quvchilar · faol bo\'lmaganlar alohida · faol o\'quvchilar soni va konversiyaga qo\'shilmaydi')}<div data-arch></div>`;
            window.studentArchive.render(root.querySelector('[data-arch]'), { title: 'Mening o\'quvchilarim', active: r.students.length, onBack: () => { soldState.tab = 'all'; renderSoldStudents(root); } });
            return;
        }
        const attention = x => x.lessons.absent >= 3 || (x.contacts && x.contacts.noAnswer >= 2) || (x.app?.flags || []).some(f => f === 'idle' || f === 'struggling');
        const status = x => x.state === 'frozen' ? ['Muzlatilgan', 'sc-pill--info'] : x.lessons.absent >= 3 ? ['Ko\'p kelmayapti', 'sc-pill--warn']
            : (x.app?.flags || []).includes('struggling') ? ['Qiynalyapti', 'sc-pill--warn'] : (x.app?.flags || []).includes('idle') ? ['Ilovaga kirmayapti', 'sc-pill--warn']
            : attention(x) ? ['E\'tibor kerak', 'sc-pill--warn'] : ['Yaxshi', 'sc-pill--ok'];
        const list = r.students.filter(x => soldState.tab === 'all' || attention(x));
        if (!list.some(x => x.id === soldState.sel)) soldState.sel = (list.find(attention) || list[0])?.id || '';
        const sel = r.students.find(x => x.id === soldState.sel);
        const lastTxt = l => !l ? '—' : `${U().DAY[U().wd(l.day) - 1]} ${Number(String(l.day).slice(8, 10))} · ${l.status === 'counted' ? '✓' : l.status === 'no_answer' ? '✕' : '—'}`;
        const tg = x => { const link = local.get(x.id)?.telegramGroupLink; return link ? `<a class="rs-tg" href="${esc(link)}" target="_blank" rel="noopener" aria-label="${esc(x.name)} · Telegram guruh" title="Telegram guruh">${TG_ICO}</a>` : `<span class="rs-tg is-off" title="Telegram guruh havolasi kiritilmagan" aria-label="Telegram guruh havolasi yo'q">${TG_ICO}</span>`; };
        const note = x => [x.lessons.absent >= 3 ? `${mCap}da ${x.lessons.absent} dars qoldirgan.` : '', x.contacts?.noAnswer >= 2 ? 'Yordamchi qo\'ng\'irog\'iga javob bermayapti.' : '',
            (x.app?.flags || []).includes('idle') ? `Ilovaga ${x.app.daysIdle ?? ''} kundan beri kirmagan.` : ''].filter(Boolean).join(' ');
        const cards = !sel ? '' : `<div class="rs-two">
            <section class="sc-card rs-dc"><header class="rs-dch"><h2>${esc(sel.name)} · asosiy darslar</h2><span class="sc-pill sc-pill--info">${esc(short(sel.teacherName))}</span></header>
              <div class="rs-k4"><div><small>Keldi</small><b>${sel.lessons.present}</b></div><div><small>Kelmadi</small><b class="${sel.lessons.absent >= 3 ? 'duty-bad' : ''}">${sel.lessons.absent}</b></div><div><small>Qoplandi</small><b>${sel.lessons.covered}</b></div>
                <div><small>Keyingi</small><b>${sel.lessons.next ? esc(U().DAY[U().wd(sel.lessons.next.date) - 1] + ' ' + Number(sel.lessons.next.date.slice(8))) + ' · ' + esc(sel.lessons.next.time || '') : '—'}</b></div></div>
              <p class="sc-mt rs-dn">${attention(sel) && note(sel) ? esc(note(sel)) + ' Ota-onasi bilan gaplashish tavsiya etiladi.' : `${esc(pattern(sel.schedule.day))} ${esc(sel.schedule.time || '')} · davomatni ustoz belgilaydi.`}</p></section>
            <section class="sc-card rs-dc"><header class="rs-dch"><h2>${esc(sel.name)} · yordamchi aloqalari</h2>${sel.contacts ? `<span class="sc-pill sc-pill--info">${esc(short(sel.assistantName))}</span>` : ''}</header>
              ${sel.contacts ? `<div class="rs-k4"><div><small>${esc(mCap)}</small><b>${sel.contacts.counted} / 13</b></div><div><small>Bu hafta</small><b>${sel.contacts.week} / 3</b></div><div><small>Oxirgi</small><b>${esc(lastTxt(sel.contacts.last))}</b></div></div>
              <p class="sc-mt rs-dn">Faqat o'qish uchun. Aloqani yordamchi ustoz belgilaydi.</p>` : '<p class="sc-mt rs-dn">Yordamchi ustoz biriktirilmagan.</p>'}
              <div class="rs-dact"><button type="button" class="sc-btn sc-btn--pri" data-open-card>O'quvchi kartasini ochish</button></div></section></div>`;
        const seg = `<div class="sc-seg" role="group" aria-label="Ro'yxat"><button type="button" data-tab="all" aria-pressed="${soldState.tab === 'all'}">Hammasi ${r.students.length}</button><button type="button" data-tab="att" aria-pressed="${soldState.tab === 'att'}">E'tibor kerak ${r.students.filter(attention).length}</button><button type="button" data-inactive aria-pressed="false">Faol emas${inN != null ? ' ' + inN : ''}</button></div>`;
        const td = (label, html, cls = '') => `<td data-l="${label}"${cls ? ` class="${cls}"` : ''}>${html}</td>`;
        root.innerHTML = `${head(`Siz sotgan o'quvchilar · asosiy ustoz davomati va yordamchi aloqalari · ${esc(mName)}`)}
          <section class="sc-card rs-mine"><header class="rs-mh"><h2>Mening o'quvchilarim</h2>${seg}</header>
            <div class="rs-tw"><table class="sc-table ms-table rs-mt"><thead><tr><th class="rs-c1">O'quvchi</th><th>Asosiy ustoz</th><th>Darslar · o'tgan / reja</th><th>Kelmadi</th><th>Yordamchi</th><th>Aloqalar · oy</th><th>Bu hafta</th><th>Ilovada</th><th>Holat</th></tr></thead><tbody>
            ${list.map(x => { const st = status(x), ls = local.get(x.id) || { id: x.id };
              return `<tr class="ms-row${soldState.sel === x.id ? ' is-sel' : ''}" data-ms="${esc(x.id)}" tabindex="0" aria-selected="${soldState.sel === x.id}"><td class="rs-c1"><span class="rs-who">${studentAvatar(ls, 30)}<span class="rs-nm"><b>${esc(x.name)}</b><small class="sc-mt">${esc(pattern(x.schedule.day))} ${esc(x.schedule.time || '')}</small></span>${tg(x)}</span></td>
                ${td('Asosiy ustoz', esc(short(x.teacherName)))}${td('Darslar', `<b>${x.lessons.counted}</b><small> / ${x.lessons.plan}</small>`)}${td('Kelmadi', x.lessons.absent >= 3 ? `<b class="duty-bad">${x.lessons.absent}</b>` : String(x.lessons.absent))}
                ${td('Yordamchi', x.contacts ? esc(short(x.assistantName)) : '—')}${td('Aloqalar · oy', x.contacts ? `<b>${x.contacts.counted}</b><small> / 13</small>` : '—')}${td('Bu hafta', x.contacts ? `${x.contacts.week} / 3` : '—')}
                ${td('Ilovada', x.app ? `<b>${x.app.reached}</b><small> / 72</small>` : '—')}${td('Holat', `<span class="sc-pill ${st[1]}">${esc(st[0])}</span>`, 'rs-st')}</tr>`; }).join('') || `<tr><td colspan="9" class="sc-mt">${soldState.tab === 'att' ? 'E\'tibor kerak o\'quvchi yo\'q' : 'Siz sotgan faol o\'quvchi yo\'q'}</td></tr>`}
          </tbody></table></div><p class="sc-mt rs-foot">Qatorni bosing → pastda asosiy darslar va yordamchi aloqalari · "O'quvchi kartasini ochish" (Davomat va aloqalar, O'zlashtirish faqat o'qish uchun)</p></section>
          ${cards}`;
        root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { soldState.tab = b.dataset.tab; renderSoldStudents(root); });
        root.querySelector('[data-inactive]').onclick = () => { soldState.tab = 'inactive'; renderSoldStudents(root); };
        root.querySelectorAll('[data-ms]').forEach(tr => { tr.onclick = e => { if (e.target.closest('a')) return; soldState.sel = tr.dataset.ms; renderSoldStudents(root); }; tr.onkeydown = e => { if (e.key === 'Enter') tr.click(); }; });
        root.querySelector('[data-open-card]')?.addEventListener('click', () => U().openStudent(sel.id));
    }

    // renderContacts, markDrawer, lateDrawer, assistantHome, renderMyStudents — js/yordamchi.js qo'shadi (shu obyektga).
    window.schoolTeacher = { contactsBlock, openInactive, renderAvatarPicker, homeExtras, renderSoldStudents };
})();
