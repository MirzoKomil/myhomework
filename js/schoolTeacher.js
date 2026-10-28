// Ustoz va yordamchi kabineti: faol bo'lmagan o'quvchilar, avatar tanlash (barcha xodimlar),
// o'quvchi oynasida aloqalar bloki, sotuvchining "O'quvchilar" sahifasi.
// Yordamchi aloqalari (belgilash oynasi, Davomat, Bosh sahifa) — js/yordamchi.js.
(function () {
    'use strict';
    const U = () => window.schoolUI;
    const CH = { phone: 'Telefon', zoom: 'Zoom', meet: 'Google Meet', tg_video: 'Telegram video', tg_group: 'Telegram guruh videodars', tg_text: 'Telegram yozishma' };
    const ST = { counted: ['hisoblandi', 'sc-pill--ok'], no_answer: ['javob bermadi', 'sc-pill--mute'], short: ['5 daqiqadan qisqa', 'sc-pill--warn'], same_day: ['shu kuni 2-chi', 'sc-pill--mute'], extra_text: ['haftadagi 2-yozishma', 'sc-pill--mute'], over_cap: ['13 dan ortiq', 'sc-pill--mute'] };

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

    // ── Ustoz bosh sahifasi: "Bajarish kerak", bugungi sinovlar, yordamchi ustozlik (aloqalar) ──
    // renderTeacherHome sinxron chiziladi; bu yerda serverdan kelgan qismlar keyin qo'shiladi.
    // Ustozga to'lov/tarif summalari ko'rsatilmaydi — faqat o'z maoshi.
    const num = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    async function homeExtras(container, user) {
        const u = U(); if (!u || !container) return;
        const { api, esc, today, wd, weekStart, DAY } = u;
        const tid = user?.linkedTeacherId; if (!tid) return;
        // Bosh sahifa qayta chizilsa (renderDashboardOverview ikki marta), eski chaqiruv yangi ro'yxatga qo'shmasin —
        // aks holda bugungi sinov qatori ikki marta chiqadi.
        const home = container.querySelector('#teacherHome') || container;
        const alive = () => container.isConnected && home.isConnected;
        const td = today();
        const all = getItem(STORAGE_KEYS.students, []).filter(s => !s.isStaffDemo && s.status !== 'inactive');
        const helped = all.filter(s => String(s.assistantTeacherId || '') === String(tid));
        const mkP = api('/makeups').catch(() => ({ makeups: [] }));
        const payP = window.UstozHome?.myPay ? window.UstozHome.myPay().catch(() => null) : Promise.resolve(null);
        // Qoplanmagan darslar (≈ ustoz maoshidan) va "e'tibor kerak" — js/ustozHome.js, parallel yuklanadi.
        const extraP = window.UstozHome?.todoItems ? window.UstozHome.todoItems(user, mkP).catch(() => []) : Promise.resolve([]);
        const [rep, trials, makeups] = await Promise.all([
            // Asosiy ustoz ham so'raydi: shu oyda ilgari (yordamchi bo'lgan paytda) qilgan aloqalari maoshga kiradi (29-okt).
            api(`/assist/month?month=${td.slice(0, 7)}`).catch(() => null),
            (typeof apiFetchTeacherTrialLessons === 'function' ? apiFetchTeacherTrialLessons() : Promise.resolve({ lessons: [] })).catch(() => ({ lessons: [] })),
            mkP
        ]);
        if (!alive()) return;
        globalThis.__schoolMakeups = makeups.makeups || [];
        const reviewing = (makeups.makeups || []).filter(m => m.status === 'review').length;

        // Maosh — server payroll (/api/payroll/me): Davomat va "Mening maoshim" bilan bitta manba (brauzerda hisoblanmaydi).
        const sal = home.querySelector('[data-thx-sal]'), sub = home.querySelector('[data-thx-salsub]');
        if (sal) {
            const pay = await payP;
            if (!alive()) return;
            const c = pay?.linked ? pay.current : null;
            if (!c) { sal.textContent = '—'; if (sub) sub.textContent = 'hisob yuklanmadi · oy yopilganda Moliya tasdiqlaydi'; }
            else {
                const main = Number(c.mainTotal ?? c.total) || 0, extra = Number(c.assistantTotal) || 0;
                sal.textContent = num(Number(c.total) || 0);
                if (sub) sub.innerHTML = `${extra ? `asosiy ${num(main)} + ${helped.length ? 'yordamchi' : 'o\'tgan yordamchi aloqalari'} ${num(extra)} · ` : ''}${reviewing ? `<b>+${reviewing} qoplash tekshiruvda</b> (admin tasdiqlasa qo'shiladi) · ` : ''}oy yopilganda Moliya tasdiqlaydi`;
            }
        }

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
        // Sarlavha: "Bugun · N dars + N sinov + N aloqa"; plitka: "+N sinov · N belgilanmagan".
        const cnt = home.querySelector('[data-thx-today-count]');
        if (cnt) { const l = Number(cnt.dataset.l) || 0, c = Number(cnt.dataset.c) || 0, t = todayTrials.length; cnt.textContent = `${l} dars${t ? ` + ${t} sinov` : ''}${c ? ` + ${c} aloqa` : ''}`; }

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
            box.innerHTML = todo.length ? `<section class="card dashboard-panel thx-todo"><div class="dashboard-panel-head"><h3>Bajarish kerak · ${todo.length}</h3><span>Har biri maoshingiz yoki o'quvchi natijasiga ta'sir qiladi</span></div>
                <ul>${todo.map((x, i) => `<li>${ico(x.ic)}<div><b>${esc(x.t)}</b><small>${esc(x.s)}</small></div><button type="button" class="sc-btn sc-btn--sm" ${x.act ? `data-act="${i}"` : `data-go="${x.go}"`}>${esc(x.btn)}</button></li>`).join('')}</ul></section>` : '';
            box.querySelectorAll('[data-go]').forEach(b => b.onclick = () => switchTab(b.dataset.go));
            box.querySelectorAll('[data-act]').forEach(b => b.onclick = () => todo[Number(b.dataset.act)]?.act?.());
        }
        // Plitka "Bugun": "N dars + N aloqa" / "+N sinov · N belgilanmagan" (dizayndagidek).
        const tile = home.querySelector('.kbx-tiles > div:first-child');
        if (tile && cnt) {
            const l = Number(cnt.dataset.l) || 0, c = Number(cnt.dataset.c) || 0, un = home.querySelectorAll('.tch-row--warn[data-thx-duty="main"]').length;
            const b = tile.querySelector('b'), sm = tile.querySelector('small');
            if (b) b.textContent = `${l} dars${c ? ` + ${c} aloqa` : ''}`;
            const bits = [todayTrials.length ? `+${todayTrials.length} sinov` : '', un ? `${un} belgilanmagan` : ''].filter(Boolean);
            if (sm && bits.length) sm.innerHTML = `<span class="${un ? 'kbx-bad' : ''}">${esc(bits.join(' · '))}</span>`;
        }

        const ws = weekStart(td);
        // Bugungi yordamchi aloqasi qatorlari: "bu hafta N/3", bugun bog'langan bo'lsa — "Aloqa belgilandi".
        if (rep) for (const row of home.querySelectorAll('[data-thx-today] > li[data-thx-duty="assistant"]')) {
            const r = (rep.students || []).find(x => x.studentId === row.dataset.thxSid), items = r?.items || [];
            const wk = items.filter(i => i.day >= ws && i.status === 'counted').length;
            const note = row.querySelector('.mot-prize-note'); if (note && !note.dataset.wk) { note.dataset.wk = '1'; note.insertAdjacentText('beforeend', ` · bu hafta ${wk}/3`); }
            if (items.some(i => i.day === td && i.outcome !== 'no_answer')) row.querySelector('.tch-row-actions').innerHTML = '<span class="uhb-pill uhb-pill--ok">Aloqa belgilandi</span>';
        }

        // Yordamchi ustozlik — aloqalar soni (oyiga 13 tagacha), UstozBosh dizayni (.asr).
        const as = home.querySelector('[data-thx-assist]');
        if (as && helped.length && rep) {
            const by = new Map((rep.students || []).map(s => [s.studentId, s]));
            const adv = s => ([1, 3, 5].includes(Number(s.lessonDayOfWeek)) ? [2, 4, 6] : [1, 3, 5]);
            as.hidden = false;
            as.innerHTML = `<div class="ahx-card-h"><h3>Yordamchi ustozlik</h3><span>oyiga 13 tagacha</span></div>
                <div class="uhb-as">${helped.map(s => { const r = by.get(s.id) || { counted: 0 };
                    return `<div class="uhb-asr"><div class="uhb-r1"><span class="uhb-nm">${esc(s.name)}</span><span><b>${r.counted}</b> / 13 aloqa</span></div><i class="uhb-bar" role="img" aria-label="${r.counted} / 13"><i style="width:${Math.min(100, r.counted / 13 * 100)}%"></i></i>
                      <small>tavsiya ${adv(s).map(d => DAY[d - 1]).join('·')}${s.lessonTime ? ' ' + esc(s.lessonTime) : ''} · asosiy ustoz ${esc(u.teacherName(s.teacherId))}${s.frozen ? ' · muzlatilgan' : ''}</small></div>`; }).join('')}
                <small>Har bir aloqa ${num(rep.rate || 3846)} so'm · kamida 5 daqiqa · usul va daqiqa kiritiladi.</small></div>`;
        }
    }

    // Ustoz/yordamchi "O'quvchilar" sahifasi (renderMyStudents) — js/yordamchi.js.

    // ── Sotuv menejeri: "O'quvchilar" (SotuvOquvchilar) — o'zi sotganlar, ustoz davomati va yordamchi aloqalari ──
    let soldState = { tab: 'all', sel: '' };
    async function renderSoldStudents(root) {
        const { api, esc, fmtDate, pattern, studentAvatar } = U();
        if (!root.dataset.loaded) root.innerHTML = '<div class="sc-skel"></div>';
        const r = await api('/sold-students');
        root.dataset.loaded = '1';
        const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
        const mName = MON[Number(r.month.slice(5)) - 1];
        const short = n => { const p = String(n || '').trim().split(/\s+/); return p[0] ? p[0] + (p[1] ? ' ' + p[1][0] + '.' : '') : '—'; };
        const local = new Map(getItem(STORAGE_KEYS.students, []).map(s => [s.id, s]));
        const attention = x => x.lessons.absent >= 3 || (x.contacts && x.contacts.noAnswer >= 2) || (x.app?.flags || []).some(f => f === 'idle' || f === 'struggling');
        const status = x => x.state === 'frozen' ? ['Muzlatilgan', 'sc-pill--info'] : x.lessons.absent >= 3 ? ['Ko\'p kelmayapti', 'sc-pill--bad']
            : (x.app?.flags || []).includes('struggling') ? ['Qiynalyapti', 'sc-pill--warn'] : (x.app?.flags || []).includes('idle') ? ['Ilovaga kirmayapti', 'sc-pill--warn']
            : attention(x) ? ['E\'tibor kerak', 'sc-pill--warn'] : ['Yaxshi', 'sc-pill--ok'];
        const list = r.students.filter(x => soldState.tab === 'all' || attention(x));
        if (!list.some(x => x.id === soldState.sel)) soldState.sel = (list.find(attention) || list[0])?.id || '';
        const sel = r.students.find(x => x.id === soldState.sel);
        const lastTxt = l => !l ? '—' : `${fmtDate(l.day)} · ${l.status === 'counted' ? '✓' : l.status === 'no_answer' ? '✕ javob bermadi' : 'hisoblanmadi'}`;
        const detail = !sel ? '<p class="sc-mt">O\'quvchini tanlang</p>' : `
            <h3>${esc(sel.name)} · asosiy darslar</h3><p class="sc-mt">${esc(short(sel.teacherName))} · ${esc(pattern(sel.schedule.day))} ${esc(sel.schedule.time || '')}</p>
            <div class="ms-kpis"><div><small>Keldi</small><b>${sel.lessons.present}</b></div><div><small>Kelmadi</small><b class="${sel.lessons.absent >= 3 ? 'duty-bad' : ''}">${sel.lessons.absent}</b></div><div><small>Qoplandi</small><b>${sel.lessons.covered}</b></div></div>
            <p class="sc-mt">Keyingi dars: <b>${sel.lessons.next ? esc(fmtDate(sel.lessons.next.date)) + ' · ' + esc(sel.lessons.next.time || '') : '—'}</b></p>
            ${sel.contacts ? `<h3 style="margin-top:14px">${esc(sel.name)} · yordamchi aloqalari</h3><p class="sc-mt">${esc(short(sel.assistantName))}</p>
            <div class="ms-kpis"><div><small>${esc(mName[0].toUpperCase() + mName.slice(1))}</small><b>${sel.contacts.counted} / 13</b></div><div><small>Bu hafta</small><b>${sel.contacts.week} / 3</b></div><div><small>Oxirgi</small><b class="ms-small">${esc(lastTxt(sel.contacts.last))}</b></div></div>` : '<p class="sc-mt">Yordamchi ustoz biriktirilmagan</p>'}
            ${attention(sel) ? `<div class="sc-note">${sel.lessons.absent >= 3 ? `${esc(mName[0].toUpperCase() + mName.slice(1))}da ${sel.lessons.absent} dars qoldirgan. ` : ''}${sel.contacts?.noAnswer >= 2 ? 'Yordamchi qo\'ng\'irog\'iga javob bermayapti. ' : ''}${(sel.app?.flags || []).includes('idle') ? `Ilovaga ${sel.app.daysIdle ?? ''} kundan beri kirmagan. ` : ''}Ota-onasi bilan gaplashish tavsiya etiladi.</div>` : ''}
            <button type="button" class="sc-btn sc-btn--pri" data-open-card>O'quvchi kartasini ochish</button>
            <p class="sc-mt">Faqat o'qish uchun · davomatni ustoz, aloqani yordamchi belgilaydi.</p>`;
        root.innerHTML = `<div class="sc-head"><div><h1>O'quvchilar</h1><p class="sc-sub">Siz sotgan o'quvchilar · asosiy ustoz davomati va yordamchi aloqalari · ${esc(mName)} · boshqa menejerlar o'quvchilari ko'rinmaydi</p></div>
            <div class="sc-seg" role="group"><button type="button" data-tab="all" aria-pressed="${soldState.tab === 'all'}">Hammasi ${r.students.length}</button><button type="button" data-tab="att" aria-pressed="${soldState.tab === 'att'}">E'tibor kerak ${r.students.filter(attention).length}</button><button type="button" data-inactive aria-pressed="false">Faol emas</button></div></div>
          <div class="ms-grid"><section class="sc-card"><table class="sc-table ms-table"><thead><tr><th>O'quvchi</th><th>Asosiy ustoz</th><th>Darslar · o'tgan / reja</th><th>Kelmadi</th><th>Yordamchi</th><th>Aloqalar · oy</th><th>Bu hafta</th><th>Ilovada</th><th>Holat</th></tr></thead><tbody>
            ${list.map(x => { const st = status(x), ls = local.get(x.id) || { id: x.id };
              return `<tr class="ms-row${soldState.sel === x.id ? ' is-sel' : ''}" data-ms="${esc(x.id)}" tabindex="0"><td><span class="sc-row">${studentAvatar(ls, 30)}<span><b>${esc(x.name)}</b><small class="sc-mt">${esc(pattern(x.schedule.day))} ${esc(x.schedule.time || '')}</small></span></span></td>
                <td>${esc(short(x.teacherName))}</td><td><b>${x.lessons.counted}</b><small> / ${x.lessons.plan}</small></td><td>${x.lessons.absent >= 3 ? `<b class="duty-bad">${x.lessons.absent}</b>` : x.lessons.absent}</td>
                <td>${x.contacts ? esc(short(x.assistantName)) : '—'}</td><td>${x.contacts ? `<b>${x.contacts.counted}</b><small> / 13</small>` : '—'}</td><td>${x.contacts ? `${x.contacts.week} / 3` : '—'}</td>
                <td>${x.app ? `<b>${x.app.reached}</b><small> / 72</small>` : '—'}</td><td><span class="sc-pill ${st[1]}">${esc(st[0])}</span></td></tr>`; }).join('') || `<tr><td colspan="9" class="sc-mt">${soldState.tab === 'att' ? 'E\'tibor kerak o\'quvchi yo\'q' : 'Siz sotgan faol o\'quvchi yo\'q'}</td></tr>`}
          </tbody></table></section><aside class="sc-card sc-pad ms-detail">${detail}</aside></div>
          <p class="sc-mt">Ismni bosing → o'quvchi kartasi (Davomat va aloqalar, O'zlashtirish faqat o'qish uchun)</p>`;
        root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { soldState.tab = b.dataset.tab; renderSoldStudents(root); });
        root.querySelector('[data-inactive]').onclick = () => openInactive(root, { active: r.students.length, onBack: () => renderSoldStudents(root) });
        root.querySelectorAll('[data-ms]').forEach(tr => { tr.onclick = () => { soldState.sel = tr.dataset.ms; renderSoldStudents(root); }; tr.onkeydown = e => { if (e.key === 'Enter') tr.click(); }; });
        root.querySelector('[data-open-card]')?.addEventListener('click', () => U().openStudent(sel.id));
    }

    // renderContacts, markDrawer, lateDrawer, assistantHome, renderMyStudents — js/yordamchi.js qo'shadi (shu obyektga).
    window.schoolTeacher = { contactsBlock, openInactive, renderAvatarPicker, homeExtras, renderSoldStudents };
})();
