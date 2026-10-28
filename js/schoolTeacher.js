// Ustoz va yordamchi kabineti: aloqa belgilash (yordamchi), faol bo'lmagan
// o'quvchilar, avatar tanlash (barcha xodimlar), o'quvchi oynasida aloqalar bloki.
(function () {
    'use strict';
    const U = () => window.schoolUI;
    const CH = { phone: 'Telefon', zoom: 'Zoom', meet: 'Google Meet', tg_video: 'Telegram video', tg_group: 'Telegram guruh videodars', tg_text: 'Telegram yozishma' };
    const ST = { counted: ['hisoblandi', 'sc-pill--ok'], no_answer: ['javob bermadi', 'sc-pill--mute'], short: ['5 daqiqadan qisqa', 'sc-pill--warn'], same_day: ['shu kuni 2-chi', 'sc-pill--mute'], extra_text: ['haftadagi 2-yozishma', 'sc-pill--mute'], over_cap: ['13 dan ortiq', 'sc-pill--mute'] };
    const me = () => getCurrentUser() || {};

    // ── Yordamchi: aloqalar ──────────────────────────────────────────────────
    async function renderContacts(root) {
        const { api, esc, today, fmtDate, studentAvatar, tgPill, teacherName, wd, weekStart, DAY } = U();
        await U().loadStaffAvatars();
        const month = root.dataset.month || today().slice(0, 7);
        const isNow = month === today().slice(0, 7);
        root.innerHTML = '<div class="sc-skel"></div>';
        let rep, groups;
        try { [rep, groups] = await Promise.all([api(`/assist/month?month=${month}`), api('/my-groups')]); }
        catch (e) { root.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        const gmap = new Map(groups.groups.map(g => [g.student_id, g]));
        const mine = getItem(STORAGE_KEYS.students, []).filter(s => s.assistantTeacherId === me().linkedTeacherId);
        const by = new Map(rep.students.map(s => [s.studentId, s]));
        const td = today(), wdNow = wd(td), ws = weekStart(td);
        const advice = s => s.status !== 'inactive' && ([1, 3, 5].includes(Number(s.lessonDayOfWeek)) ? [2, 4, 6] : [1, 3, 5]).includes(wdNow);
        const todayItems = s => (by.get(s.id)?.items || []).filter(i => i.day === td);
        const weekCount = s => (by.get(s.id)?.items || []).filter(i => i.day >= ws && i.status === 'counted').length;
        const st = rep.state || {};
        // O'tgan oy — yopilgan (faqat ko'rish); kelgusi oy — hali boshlanmagan.
        const closed = month < today().slice(0, 7), future = month > today().slice(0, 7);
        const steps = [['Oy yopildi', closed, '1-sana 00:00 · avtomatik'],
            ['Dastlabki tasdiq', !!st.prelim_at, st.prelim_at ? new Date(st.prelim_at).toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent' }) : 'kutilmoqda'],
            ['E\'tiroz muddati', !!st.final_at, st.objection_until ? String(st.objection_until).slice(0, 10) + ' gacha' : '—'],
            ['To\'lov', !!st.paid_at, st.paid_at ? new Date(st.paid_at).toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent' }) : '5-sana']];
        const gone = s => s.status === 'inactive';
        // Chiqib ketgan o'quvchi faqat shu oyda aloqasi bo'lsa ko'rinadi (o'qigan davri hisoblanadi).
        const rows = mine.filter(s => closed || gone(s) ? by.has(s.id) : true).sort((a, b) => gone(a) - gone(b) || advice(b) - advice(a) || a.name.localeCompare(b.name));
        const embedded = root.dataset.embedded === '1';
        root.innerHTML = `${embedded ? '<p class="sc-mt">Har o\'quvchi bilan haftasiga 3 ta aloqa · kamida 5 daqiqa · faqat shu kuni belgilanadi</p>' : `<div class="sc-head"><div><h1>Aloqalar</h1><p class="sc-sub">Har o'quvchi bilan haftasiga 3 ta aloqa · kamida 5 daqiqa · faqat shu kuni belgilanadi</p></div>
            <div class="sc-row"><input type="month" value="${month}" max="${today().slice(0, 7)}" data-month aria-label="Oy"></div></div>`}
          ${future ? `<div class="sc-note">${esc(month)} hali boshlanmagan — aloqalar shu oyda belgilanadi.</div>` : ''}
          ${closed ? `<div class="sc-note"><b>${esc(month)} yopilgan — faqat ko'rish uchun.</b> Aloqani qo'shish yoki o'zgartirish mumkin emas. Xato bo'lsa, e'tiroz muddatigacha Moliyaga murojaat qiling.</div>` : ''}
          <div class="sc-kpis"><div class="sc-kpi"><small>${closed ? 'Oy maoshi · yakuniy' : 'Hisoblangan maosh'}</small><b>${formatMoney(rep.amount)}</b><span>${rep.counted} aloqa × ${formatMoney(rep.rate)}</span></div>
            <div class="sc-kpi"><small>Javob bermadi</small><b>${rep.noAnswer}</b><span>hisoblanmaydi</span></div><div class="sc-kpi"><small>Limitdan ortiq</small><b>${rep.overCap}</b><span>13 tadan ortig'i</span></div>
            ${closed ? `<div class="sc-kpi"><small>To'lov holati</small><b class="sc-small">${steps.filter(x => x[1]).pop()?.[0] || 'Oy yopildi'}</b><span>${esc(steps.find(x => !x[1])?.[0] || 'to\'langan')}: ${esc(steps.find(x => !x[1])?.[2] || '')}</span></div>`
              : `<div class="sc-kpi"><small>Bugun tavsiya</small><b>${mine.filter(advice).length}</b><span>${DAY[wdNow - 1]} · ${mine.filter(s => todayItems(s).length).length} belgilandi</span></div>`}</div>
          <section class="sc-card"><table class="sc-table"><thead><tr><th>O'quvchi</th><th>Asosiy ustoz</th><th>Guruh</th>${closed ? '' : '<th>Bugun</th><th>Bu hafta</th>'}<th class="r">Oy</th><th></th></tr></thead><tbody>
          ${rows.map(s => { const r = by.get(s.id) || { counted: 0, noAnswer: 0 }; const t = todayItems(s); const frozen = s.frozen;
            return `<tr><td><span class="sc-row">${studentAvatar(s, 30)}<span><b>${esc(s.name)}</b>${!closed && advice(s) ? '<small class="sc-mt"> · tavsiya</small>' : ''}</span></span></td><td>${esc(teacherName(s.teacherId, true))}</td><td>${tgPill(gmap.get(s.id))}</td>
              ${closed ? '' : `<td>${frozen ? '<span class="sc-pill sc-pill--info">muzlatilgan</span>' : t.length ? t.map(i => `<span class="sc-pill ${ST[i.status][1]}">${CH[i.channel] || ''} ${i.minutes ? i.minutes + ' daq' : ''} · ${ST[i.status][0]}</span>`).join(' ') : '—'}</td><td>${weekCount(s)} / 3</td>`}
              <td class="r"><b>${r.counted}</b> / 13${r.noAnswer ? `<small class="sc-mt"> · ${r.noAnswer} javob bermadi</small>` : ''}</td>
              <td>${closed || future || frozen || gone(s) ? (gone(s) ? '<span class="sc-pill sc-pill--bad">chiqib ketgan</span>' : '') : `<button type="button" class="sc-btn sc-btn--sm${t.length ? '' : ' sc-btn--pri'}" data-mark="${esc(s.id)}">${t.length ? 'Yana' : 'Belgilash'}</button>`}</td></tr>`; }).join('') || `<tr><td colspan="7" class="sc-mt">${closed ? 'Bu oyda aloqa yo\'q' : 'Sizga yordamchi sifatida o\'quvchi biriktirilmagan'}</td></tr>`}
          </tbody><tfoot><tr><td colspan="${closed ? 3 : 5}">Jami</td><td class="r">${rep.counted}</td><td class="r">${formatMoney(rep.amount)}</td></tr></tfoot></table></section>
          ${closed || future ? '' : '<p class="sc-mt">O\'tgan kunni belgilamay qoldingizmi? <button type="button" class="sc-link" data-late>Admin orqali so\'rov yuborish</button></p>'}`;
        if (root.querySelector('[data-month]')) root.querySelector('[data-month]').onchange = e => { root.dataset.month = e.target.value; renderContacts(root); };
        root.querySelectorAll('[data-mark]').forEach(b => b.onclick = () => markDrawer(mine.find(s => s.id === b.dataset.mark), () => renderContacts(root)));
        root.querySelector('[data-late]')?.addEventListener('click', () => lateDrawer(mine, () => renderContacts(root)));
    }
    function channelSelect(name = 'ch') { return `<select name="${name}">${Object.entries(CH).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>`; }
    function markDrawer(s, done) {
        const { openDrawer, field, esc, tgPill } = U();
        const box = openDrawer({ title: 'Aloqani belgilash', sub: `${esc(s.name)} · bugun`, body: `
            <div class="sc-g2">${field('Usul', channelSelect())}${field('Davomiylik, daqiqa', '<input name="min" inputmode="numeric" placeholder="masalan 7">', 'Kamida 5 daqiqa · yozishmada shart emas')}</div>
            ${field('Izoh (ixtiyoriy)', '<textarea name="note" rows="2" placeholder="Nima ustida ishladingiz"></textarea>')}
            <div class="sc-note">Hisoblanmaydi: 5 daqiqadan qisqa, bir kundagi ikkinchi aloqa, haftadagi ikkinchi yozishma, oyiga 13 tadan ortig'i.</div>`,
            foot: '<button type="button" class="sc-btn" data-na>Javob bermadi</button><span class="sc-grow"></span><button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Saqlash</button>' });
        const send = async (btn, body) => {
            U().busy(btn, true);
            try { await U().post('/assist/contacts', { studentId: s.id, ...body }); U().toast(body.outcome === 'no_answer' ? 'Javob bermadi — yozildi' : 'Aloqa saqlandi'); U().closeDrawer(); done(); }
            catch (err) { U().busy(btn, false); U().errBox(box, err.message); }
        };
        box.querySelector('[data-save]').onclick = e => send(e.target, { channel: box.querySelector('[name=ch]').value, minutes: Number(box.querySelector('[name=min]').value) || 0, note: box.querySelector('[name=note]').value });
        box.querySelector('[data-na]').onclick = e => send(e.target, { outcome: 'no_answer', channel: box.querySelector('[name=ch]').value });
    }
    function lateDrawer(list, done) {
        const { openDrawer, field, esc, today, addDays } = U();
        const box = openDrawer({ title: 'Kechikib belgilash so\'rovi', sub: 'Admin tasdiqlasa hisobga qo\'shiladi', body: `
            ${field('O\'quvchi', `<select name="st">${list.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>`)}
            <div class="sc-g2">${field('Sana', `<input type="date" name="day" max="${addDays(today(), -1)}" min="${today().slice(0, 7)}-01">`)}${field('Usul', channelSelect())}${field('Davomiylik, daqiqa', '<input name="min" inputmode="numeric">')}</div>
            ${field('Nega o\'z vaqtida belgilanmadi', '<textarea name="reason" rows="2"></textarea>')}`,
            foot: '<button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Yuborish</button>' });
        box.querySelector('[data-save]').onclick = async e => {
            const v = n => box.querySelector(`[name=${n}]`).value;
            U().busy(e.target, true);
            try { await U().post('/assist/late-requests', { studentId: v('st'), day: v('day'), channel: v('ch'), minutes: Number(v('min')) || 0, reason: v('reason') }); U().toast('So\'rov yuborildi'); U().closeDrawer(); done(); }
            catch (err) { U().busy(e.target, false); U().errBox(box, err.message); }
        };
    }

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
        // Qoplanmagan darslar (≈ ustoz maoshidan) va "e'tibor kerak" — js/ustozHome.js, parallel yuklanadi.
        const extraP = window.UstozHome?.todoItems ? window.UstozHome.todoItems(user, mkP).catch(() => []) : Promise.resolve([]);
        const [rep, trials, makeups] = await Promise.all([
            helped.length ? api(`/assist/month?month=${td.slice(0, 7)}`).catch(() => null) : null,
            (typeof apiFetchTeacherTrialLessons === 'function' ? apiFetchTeacherTrialLessons() : Promise.resolve({ lessons: [] })).catch(() => ({ lessons: [] })),
            mkP
        ]);
        if (!alive()) return;
        globalThis.__schoolMakeups = makeups.makeups || [];
        const reviewing = (makeups.makeups || []).filter(m => m.status === 'review').length;

        // Maosh: asosiy (KPI) + yordamchi (aloqalar × 3 846).
        const sal = home.querySelector('[data-thx-sal]'), sub = home.querySelector('[data-thx-salsub]');
        if (sal) {
            // Oktyabrgacha (ASSIST_CONTACTS_FROM) yordamchi qismi eski davomatdan — bosh sahifa o'zi hisoblagan.
            const old = sal.dataset.oldAssist != null ? Number(sal.dataset.oldAssist) || 0 : null;
            const main = Number(sal.dataset.main) || 0, extra = old != null ? old : rep?.amount || 0;
            sal.textContent = num(main + extra);
            if (sub) sub.innerHTML = `${helped.length ? `asosiy ${num(main)} + yordamchi ${old != null || rep ? num(extra) : '—'}${old != null ? ' (davomat bo\'yicha)' : ''} · ` : ''}${reviewing ? `<b>+${reviewing} qoplash tekshiruvda</b> (admin tasdiqlasa qo'shiladi) · ` : ''}oy yopilganda Moliya tasdiqlaydi`;
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
        home.querySelectorAll('.tch-row--warn[data-thx-duty="main"]').forEach(row => {
            todo.push({ ic: 'warn', t: `${row.querySelector('strong')?.textContent || ''} · ${row.querySelector('.tch-time')?.textContent || ''} darsi belgilanmagan`, s: 'Belgilanmagan dars maoshga o\'tmaydi', btn: 'Belgilash', go: 'teachers-section' });
        });
        for (const l of lessons) {
            const d = at(l); if (!Number.isFinite(d.getTime())) continue;
            const when = `${localDate(d) === td ? 'bugun' : u.fmtDate(localDate(d), false)} ${hhmm(d)}`;
            if (l.trialRequest.state === 'pending' && d.getTime() <= Date.now()) todo.push({ ic: 'user', t: `${l.name || 'Lid'} · sinov darsi natijasi`, s: `${when} o'tdi, tasdiqlanmagan · muddati o'tdi, natijani yozing`, btn: 'Natijani yozish', go: 'trial-lessons' });
            else if (l.trialRequest.state === 'pending') todo.push({ ic: 'clock', t: `${l.name || 'Lid'} · ${when} sinov darsi`, s: 'Tasdiqlamaguningizcha lidga vaqt yuborilmaydi', btn: 'Tasdiqlash', go: 'trial-lessons' });
            else if (l.trialRequest.state === 'accepted' && d.getTime() < Date.now()) todo.push({ ic: 'user', t: `${l.name || 'Lid'} · sinov darsi natijasi`, s: `${when} o'tdi · natija sotuv menejeriga boradi`, btn: 'Natijani yozish', go: 'trial-lessons' });
        }
        todo.push(...(await extraP));
        if (!alive()) return;
        const box = home.querySelector('[data-thx-todo]');
        if (box) {
            const TI = { warn: '<path d="M12 3 2 21h20L12 3zM12 10v5M12 18h.01"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', sync: '<path d="M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5"/>' };
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

    // ── Ustoz: "O'quvchilar" (UstozOquvchiList) — o'z o'quvchilari, ilovadagi holat, davomat, Telegram ──
    // To'lov va sotuv ma'lumotlari ustozga ko'rsatilmaydi.
    let myState = { q: '', sel: '' };
    async function renderMyStudents(root) {
        const { api, esc, today, studentAvatar, tgPill, teacherName, pattern, DAY } = U();
        await U().loadStaffAvatars();
        const tid = me().linkedTeacherId;
        const td = today(), month = td.slice(0, 7), dayN = Number(td.slice(8));
        const all = getItem(STORAGE_KEYS.students, []).filter(s => !s.isStaffDemo && !s.frozen && s.status !== 'inactive');
        const mine = all.filter(s => s.teacherId === tid), helped = all.filter(s => s.assistantTeacherId === tid && s.teacherId !== tid);
        if (!root.dataset.loaded) root.innerHTML = '<div class="sc-skel"></div>';
        const lang = (typeof getUserOwnLang === 'function' && getUserOwnLang()) || 'english';
        const [acad, groups, mks, rep] = await Promise.all([
            apiFetch(`/api/academic/students?lang=${lang}`).catch(() => ({ students: [] })),
            api('/my-groups').catch(() => ({ groups: [] })),
            api('/makeups').catch(() => ({ makeups: [] })),
            helped.length ? api(`/assist/month?month=${month}`).catch(() => null) : null
        ]);
        root.dataset.loaded = '1';
        const ac = new Map((acad.students || []).map(x => [x.id, x]));
        const gmap = new Map((groups.groups || []).map(g => [g.student_id, g]));
        const cnt = new Map((rep?.students || []).map(x => [x.studentId, x]));
        const att = getItem(STORAGE_KEYS.mainAttendance, {})[`${month}_${tid}`] || {};
        const cal = window.teacherAttendanceCalendar;
        const own = (typeof resolveTeacherWithVirtual === 'function' && resolveTeacherWithVirtual(tid)) || {};
        const myMk = (mks.makeups || []).filter(m => m.teacher_id === tid && String(m.held_date || '').slice(0, 7) === month);
        const attOf = s => {
            const entries = att[s.id] || {};
            const cells = cal ? cal.cells(month, cal.weekdays(s, own, 'main')).filter(Boolean) : [];
            const plan = cells.filter(c => c.scheduled).length;
            const days = new Set(cells.filter(c => c.scheduled && cal.status(entries[c.day]) === 'present').map(c => c.day));
            let n = days.size;
            for (const m of myMk.filter(m => m.student_id === s.id && m.status === 'approved')) {
                const d = Number(String(m.held_date).slice(8, 10));
                if (m.kind === 'double') n++; else if (!days.has(d)) { days.add(d); n++; }
            }
            const absent = cells.filter(c => cal.status(entries[c.day]) === 'absent').length;
            const covered = new Set(myMk.filter(m => m.student_id === s.id).map(m => String(m.missed_date || '').slice(0, 10)));
            const openMissed = cells.filter(c => cal.status(entries[c.day]) === 'absent' && !covered.has(c.date)).map(c => c.day);
            return { counted: Math.min(n, plan), plan, absent, openMissed, review: myMk.filter(m => m.student_id === s.id && m.status === 'review').length,
                present: cells.filter(c => cal.status(entries[c.day]) === 'present').length };
        };
        const statusOf = (s, a, x) => {
            const f = new Set((x?.flags || []).map(f => f.key));
            if (a.absent >= 3) return ['Ko\'p kelmayapti', 'sc-pill--bad'];
            if (f.has('struggling')) return ['Qiynalyapti', 'sc-pill--warn'];
            if (f.has('idle')) return [x.flags.find(f => f.key === 'idle').label, 'sc-pill--warn'];
            if (f.has('behind')) return ['Rejadan orqada', 'sc-pill--warn'];
            return ['Rejada', 'sc-pill--ok'];
        };
        const q = myState.q.trim().toLowerCase();
        const match = s => !q || String(s.name || '').toLowerCase().includes(q) || String(s.serialCode || s.id || '').toLowerCase().includes(q);
        const adv = s => ([1, 3, 5].includes(Number(s.lessonDayOfWeek)) ? [2, 4, 6] : [1, 3, 5]).map(d => DAY[d - 1]).join('·');
        const prog = x => x ? `<b>${x.reached || 0}</b><small> / 72</small>` : '<small class="sc-mt">—</small>';
        const row = (s, kind) => {
            const x = ac.get(s.id), a = kind === 'main' ? attOf(s) : null, c = cnt.get(s.id);
            const st = kind === 'main' ? statusOf(s, a, x) : ['Yordamchi', 'sc-pill--info'];
            return `<tr class="ms-row${myState.sel === s.id ? ' is-sel' : ''}" data-ms="${esc(s.id)}" tabindex="0"><td><span class="sc-row">${studentAvatar(s, 32)}<span><b>${esc(s.name)}</b><small class="sc-mt">${kind === 'main' ? (s.serialCode ? '#' + esc(s.serialCode) : '') : 'asosiy: ' + esc(teacherName(s.teacherId, true))}</small></span></span></td>
              <td>${kind === 'main' ? `${esc(pattern(s.lessonDayOfWeek))} ${esc(s.lessonTime || '')}<small class="sc-mt"> · ${Number(s.lessonDuration) || 15} daq</small>` : `tavsiya ${adv(s)}<small class="sc-mt"> · darslari ${esc(pattern(s.lessonDayOfWeek))} ${esc(s.lessonTime || '')}</small>`}</td>
              <td>${prog(x)}</td>
              <td>${kind === 'main' ? `<b>${a.counted}</b><small> / ${a.plan}</small>${a.review ? ` <em class="duty-plus">+${a.review}</em>` : ''}` : `<b>${c?.counted || 0}</b><small> / 13 aloqa</small>`}</td>
              <td><span class="sc-pill ${st[1]}">${esc(st[0])}</span></td><td>${tgPill(gmap.get(s.id))}</td></tr>`;
        };
        const mainRows = mine.filter(match), helpRows = helped.filter(match);
        if (!myState.sel || ![...mine, ...helped].some(s => s.id === myState.sel)) myState.sel = (mainRows[0] || helpRows[0])?.id || '';
        const sel = [...mine, ...helped].find(s => s.id === myState.sel);
        const detail = () => {
            if (!sel) return '<p class="sc-mt">O\'quvchini tanlang</p>';
            const isMain = sel.teacherId === tid, x = ac.get(sel.id), a = isMain ? attOf(sel) : null, c = cnt.get(sel.id);
            return `<div class="sc-row">${studentAvatar(sel, 48)}<span><b class="ms-name">${esc(sel.name)}</b><small class="sc-mt">${isMain ? 'asosiy o\'quvchingiz' : 'yordamchi sifatida'}${sel.serialCode ? ' · #' + esc(sel.serialCode) : ''}</small></span></div>
              <div class="sc-row sc-wrap" style="margin:10px 0">${tgPill(gmap.get(sel.id))}${(x?.flags || []).map(f => `<span class="sc-pill sc-pill--warn">${esc(f.label)}</span>`).join('')}</div>
              <div class="ms-kpis"><div><small>Ilovada</small><b>${x ? x.reached + ' / 72' : '—'}</b></div><div><small>1-urinish</small><b>${x?.firstTryAvg != null ? x.firstTryAvg + '%' : '—'}</b></div>
                <div><small>${isMain ? 'Davomat · bu oy' : 'Aloqalar · bu oy'}</small><b>${isMain ? `${a.counted} / ${a.plan}${a.review ? ' · +' + a.review : ''}` : `${c?.counted || 0} / 13`}</b></div></div>
              <dl class="ms-dl"><dt>Jadval</dt><dd>${esc(pattern(sel.lessonDayOfWeek))} ${esc(sel.lessonTime || '')} · ${Number(sel.lessonDuration) || 15} daq</dd>
                ${isMain ? `<dt>Bu oy</dt><dd>${a.present} keldi · ${a.absent} kelmadi${a.review ? ` · ${a.review} qoplash tekshiruvda` : ''}</dd>
                <dt>Yordamchi ustoz</dt><dd>${sel.assistantTeacherId ? esc(teacherName(sel.assistantTeacherId)) : '—'}</dd>` : `<dt>Asosiy ustoz</dt><dd>${esc(teacherName(sel.teacherId))}</dd><dt>Aloqa tavsiyasi</dt><dd>${adv(sel)}</dd>`}
                ${isMain && a.openMissed.length ? `<dt>Qoplash mumkin</dt><dd class="duty-bad">${a.openMissed.length} dars · ${a.openMissed.join(', ')}-sana</dd>` : ''}</dl>
              <div class="ms-acts"><button type="button" class="sc-btn sc-btn--pri" data-open-card>O'quvchi kartasini ochish</button>
                ${isMain ? `<button type="button" class="sc-btn" data-go-att>${a.openMissed.length ? 'Qoplash darsi qo\'yish' : 'Davomat'}</button>` : '<button type="button" class="sc-btn" data-go-contacts>Aloqani belgilash</button>'}</div>
              <p class="sc-mt">Ustoz almashtirish, muzlatish va to'lovlar — admin bo'limida.</p>`;
        };
        root.innerHTML = `<div class="sc-head"><div><h1>O'quvchilar</h1><p class="sc-sub">Sizga biriktirilgan o'quvchilar · to'lov va sotuv ma'lumotlari ustozga ko'rsatilmaydi</p></div>
            <div class="sc-row sc-wrap"><input type="search" placeholder="Ism yoki ID bo'yicha qidirish" value="${esc(myState.q)}" data-q aria-label="Qidirish">
            <div class="sc-seg" role="group"><button type="button" aria-pressed="true">Faol · ${mine.length}${helped.length ? ' + ' + helped.length : ''}</button><button type="button" data-inactive aria-pressed="false">Faol emas</button></div></div></div>
          <div class="ms-grid"><section class="sc-card"><table class="sc-table ms-table"><thead><tr><th>O'quvchi</th><th>Jadval</th><th>Ilovada</th><th>Davomat · ${['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'][Number(month.slice(5)) - 1]}</th><th>Holat</th><th>Guruh</th></tr></thead><tbody>
            ${mine.length ? `<tr class="ms-sec"><td colspan="6">Asosiy ustozligingizda · ${mainRows.length}</td></tr>${mainRows.map(s => row(s, 'main')).join('')}` : ''}
            ${helped.length ? `<tr class="ms-sec"><td colspan="6">Yordamchi sifatida · ${helpRows.length} · haftasiga 3 aloqa, kamida 5 daqiqa</td></tr>${helpRows.map(s => row(s, 'help')).join('')}` : ''}
            ${!mainRows.length && !helpRows.length ? `<tr><td colspan="6" class="sc-mt">${q ? 'Hech kim topilmadi' : 'Sizga hali o\'quvchi biriktirilmagan'}</td></tr>` : ''}
          </tbody></table></section><aside class="sc-card sc-pad ms-detail">${detail()}</aside></div>`;
        const qi = root.querySelector('[data-q]');
        qi.oninput = () => { myState.q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => renderMyStudents(root).then(() => { const n = root.querySelector('[data-q]'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }), 200); };
        root.querySelector('[data-inactive]').onclick = () => openInactive(root, { active: mine.length + helped.length, title: mine.length ? 'Mening o\'quvchilarim' : 'O\'quvchilar', onBack: () => renderMyStudents(root) });
        root.querySelectorAll('[data-ms]').forEach(tr => { tr.onclick = () => { myState.sel = tr.dataset.ms; renderMyStudents(root); }; tr.onkeydown = e => { if (e.key === 'Enter') tr.click(); }; });
        root.querySelector('[data-open-card]')?.addEventListener('click', () => U().openStudent(sel.id));
        root.querySelector('[data-go-att]')?.addEventListener('click', () => switchTab('teachers-section'));
        root.querySelector('[data-go-contacts]')?.addEventListener('click', () => markDrawer(sel, () => renderMyStudents(root)));
    }

    // ── Yordamchi ustoz bosh sahifasi (YordamchiBosh, YordamchiOyYopildi) ──
    const CH_ICON = { phone: '☎', zoom: 'Z', meet: 'M', tg_video: '▶', tg_group: '▶', tg_text: '✉' };
    async function assistantHome(container, user) {
        const u = U(); if (!u || !container) return;
        const { api, esc, today, weekStart, wd, DAY, studentAvatar, teacherName, tgPill, pattern, addDays } = u;
        await u.loadStaffAvatars();
        const tid = user.linkedTeacherId, td = today(), month = td.slice(0, 7), wdNow = wd(td), ws = weekStart(td);
        const prevMonth = addDays(month + '-01', -1).slice(0, 7);
        const list = getItem(STORAGE_KEYS.students, []).filter(s => !s.isStaffDemo && s.status !== 'inactive' && s.assistantTeacherId === tid);
        const lang = (typeof getUserOwnLang === 'function' && getUserOwnLang()) || 'english';
        const [rep, prev, groups, acad] = await Promise.all([
            api(`/assist/month?month=${month}`).catch(() => null),
            Number(td.slice(8)) <= 6 ? api(`/assist/month?month=${prevMonth}`).catch(() => null) : null,
            api('/my-groups').catch(() => ({ groups: [] })),
            apiFetch(`/api/academic/students?lang=${lang}`).catch(() => ({ students: [] }))
        ]);
        if (!container.isConnected) return;
        const by = new Map((rep?.students || []).map(x => [x.studentId, x]));
        const gmap = new Map((groups.groups || []).map(g => [g.student_id, g]));
        const ac = new Map((acad.students || []).map(x => [x.id, x]));
        const rate = rep?.rate || 3846, cap = rep?.cap || 13;
        const advDays = s => ([1, 3, 5].includes(Number(s.lessonDayOfWeek)) ? [2, 4, 6] : [1, 3, 5]);
        const items = s => by.get(s.id)?.items || [];
        const todayOf = s => items(s).filter(i => i.day === td);
        const weekOf = s => items(s).filter(i => i.day >= ws && i.status === 'counted').length;
        const nowMin = u.nowMin();
        const tmin = s => u.toMin(s.lessonTime) ?? 24 * 60;
        const advised = list.filter(s => !s.frozen && advDays(s).includes(wdNow)).sort((a, b) => tmin(a) - tmin(b));
        const done = s => todayOf(s).some(i => i.status === 'counted' || i.outcome === 'contacted');
        const noAns = s => todayOf(s).length && todayOf(s).every(i => i.outcome === 'no_answer');
        const counted = rep?.counted || 0, amount = rep?.amount || 0;
        const possible = list.length * cap;
        const mains = new Set(list.map(s => s.teacherId).filter(Boolean)).size;
        const next = advised.find(s => !done(s) && tmin(s) >= nowMin) || advised.find(s => !done(s));
        const retry = advised.filter(noAns);
        const nearCap = list.map(s => [s, by.get(s.id)?.counted || 0]).filter(([, n]) => n >= cap - 2).sort((a, b) => b[1] - a[1]);
        const hour = Number(new Date(Date.now() + 5 * 3600000).getUTCHours());
        const greet = hour < 11 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';
        const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
        const mName = m => MON[Number(m.slice(5)) - 1];
        const state = prev?.state || {};
        const prevBlock = prev && (prev.counted || state.locked_at) && !state.paid_at ? `<section class="card ahx-card ya-prev"><div class="ahx-card-h"><h3>🔒 ${esc(mName(prevMonth))} yopildi — faqat ko'rish</h3><button type="button" class="ahx-link" data-go-contacts="${prevMonth}">Batafsil →</button></div>
            <p><b class="ya-big">${esc(formatMoney(prev.amount))}</b> · ${prev.counted} hisoblangan aloqa × ${esc(formatMoney(rate))}</p>
            <ol class="ya-steps">${[['Oy yopildi', true], ['Dastlabki tasdiq', !!state.prelim_at], [`E'tiroz${state.objection_until ? ' · ' + String(state.objection_until).slice(0, 10) + ' gacha' : ''}`, !!state.final_at], ['To\'lov · 5-sana', !!state.paid_at]].map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${esc(t)}</li>`).join('')}</ol>
            <p class="sc-mt">Aloqani qo'shish yoki tuzatish mumkin emas. Xato ko'rsangiz, e'tiroz muddatigacha Moliyaga murojaat qiling.</p></section>` : '';
        const nx = next ? (() => { const x = ac.get(next.id), r = by.get(next.id);
            const mins = tmin(next) - nowMin;
            return `<section class="kbx-next" aria-labelledby="yaNext"><span class="kbx-eyebrow">KEYINGI ALOQA · TAVSIYA ${esc(next.lessonTime || '')}${mins > 0 && mins < 24 * 60 ? ` · ${mins >= 60 ? Math.floor(mins / 60) + ' SOAT ' : ''}${mins % 60} DAQIQADAN KEYIN` : ''}</span>
              <h2 id="yaNext">${esc(next.name)}</h2><span class="kbx-dsub">asosiy ustoz ${esc(teacherName(next.teacherId, true))} · darslari ${esc(pattern(next.lessonDayOfWeek))} · bu hafta ${weekOf(next)}/3</span>
              <div class="kbx-dchips">${x ? `<span class="kbx-dchip">Ilovada ${x.reached}-dars</span>${x.firstTryAvg != null ? `<span class="kbx-dchip">1-urinish ${x.firstTryAvg}%</span>` : ''}` : ''}<span class="kbx-dchip">${r?.counted || 0} / ${cap} aloqa</span></div>
              <div class="kbx-next-actions"><button type="button" class="kbx-call" data-mark="${esc(next.id)}">Aloqani belgilash</button><button type="button" class="kbx-ghost" data-card="${esc(next.id)}">Karta</button></div></section>`; })()
            : `<section class="kbx-next"><span class="kbx-eyebrow">BUGUNGI ALOQALAR</span><h2>${advised.length ? 'Hammasi belgilandi' : 'Bugun tavsiya yo\'q'}</h2><span class="kbx-dsub">${advised.length ? `${advised.filter(done).length} / ${advised.length} aloqa` : 'Aloqani istalgan kuni qilish mumkin'}</span>
              <div class="kbx-next-actions"><button type="button" class="kbx-call" data-go-contacts="${month}">Aloqalar</button></div></section>`;
        const rowHtml = s => {
            const t = todayOf(s), last = t[t.length - 1];
            const st = last ? (last.outcome === 'no_answer' ? '<span class="sc-pill sc-pill--warn">Javob bermadi</span>' : `<span class="sc-pill sc-pill--ok">${CH_ICON[last.channel] || ''} ${last.minutes ? last.minutes + ' daq' : ''}</span>`)
                : s.frozen ? '<span class="sc-pill sc-pill--info">muzlatilgan</span>' : tmin(s) < nowMin ? '<span class="sc-pill sc-pill--warn">Belgilanmagan</span>' : '<span class="sc-pill sc-pill--mute">Rejada</span>';
            return `<li class="ya-row"><b class="ya-time">${esc(s.lessonTime || '—')}</b>${studentAvatar(s, 32)}<div class="ya-who"><strong>${esc(s.name)}</strong>
              <span class="mot-prize-note">asosiy ${esc(teacherName(s.teacherId, true))} · bu hafta ${weekOf(s)}/3${gmap.get(s.id) ? '' : ' · guruh yo\'q'}</span></div>${st}
              ${s.frozen ? '' : `<button type="button" class="sc-btn sc-btn--sm${done(s) ? '' : ' sc-btn--pri'}" data-mark="${esc(s.id)}">${done(s) ? 'Yana' : 'Belgilash'}</button>`}</li>`;
        };
        container.innerHTML = `<div class="ahx-head mhx-head"><div><h1>${greet}, ${esc(String(user.name || '').split(' ')[0])}</h1><p>${esc(u.fmtDate(td))} · yordamchi ustoz · ${list.length} o'quvchi · ${mains} asosiy ustoz bilan</p></div></div>
          ${prevBlock}
          <div class="kbx-top"><section class="card kbx-plan" aria-labelledby="yaPlan"><div class="kbx-plan-top"><div class="kbx-plan-main">
              <div class="kbx-plan-h"><h2 id="yaPlan">Hisoblangan maosh · ${esc(mName(month))}</h2><button type="button" class="ahx-link" data-go-contacts="${month}">Aloqalar →</button></div>
              <div class="kbx-plan-num"><b>${esc(String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '))}</b><span>so'm · hozirgacha</span></div>
              <span class="kbx-sub">${counted} hisoblangan aloqa × ${esc(formatMoney(rate))} · har o'quvchi bilan oyiga ${cap} tagacha</span></div></div>
              <div class="kbx-bar is-ok" role="img" aria-label="${counted} / ${possible}"><i style="width:${possible ? Math.min(100, counted / possible * 100) : 0}%"></i></div>
              <div class="kbx-bar-foot"><span><strong>${counted}</strong> / ${possible} mumkin bo'lgan aloqa</span><span>ko'pi bilan ${esc(formatMoney(possible * rate))}</span></div>
              <div class="kbx-tiles"><div><span>Bugun</span><b>${advised.filter(done).length} / ${advised.length} aloqa</b><small>${retry.length ? retry.length + ' javob bermadi · ' : ''}${advised.filter(s => !done(s)).length} qoldi</small></div>
                <div><span>Bu hafta</span><b>${list.reduce((n, s) => n + weekOf(s), 0)} / ${list.length * 3}</b><small>tavsiya jadvali bo'yicha</small></div>
                <div><span>Qayta urinish</span><b>${retry.length}</b><small>${retry.length ? esc(retry.map(s => String(s.name).split(' ')[0]).join(' · ')) : 'yo\'q'}</small></div></div></section>${nx}</div>
          <div class="thx-grid"><div class="thx-main"><section class="card dashboard-panel"><div class="dashboard-panel-head"><h3>Bugungi tavsiya · ${advised.length} o'quvchi</h3><span>${esc(DAY[wdNow - 1])} · tavsiya, majburiy emas</span></div>
              ${advised.length ? `<ul class="ya-list">${advised.map(rowHtml).join('')}</ul>` : '<p class="dashboard-empty">Bugun tavsiya qilingan aloqa yo\'q</p>'}</section></div>
            <aside class="thx-side">${nearCap.length ? `<section class="card ahx-card"><div class="ahx-card-h"><h3>${cap} ta limitga yaqinlar</h3></div>
                ${nearCap.map(([s, n]) => `<div class="thx-as-row"><div><b>${esc(s.name)}</b><small>${n >= cap ? 'limit to\'ldi — keyingisi hisoblanmaydi' : `yana ${cap - n} ta hisoblanadi`}</small></div><span><em><b>${n}</b> / ${cap}</em></span></div>`).join('')}
                <p class="mot-prize-note">Limitdan ortiq aloqa qilish mumkin, lekin maoshga qo'shilmaydi.</p></section>` : ''}
              <section class="card ahx-card"><div class="ahx-card-h"><h3>Qoidalar</h3></div><ul class="ya-rules"><li>Ovozli yoki video — kamida 5 daqiqa</li><li>Telegram yozishma — haftasiga 1 tagacha</li><li>"Javob bermadi" yoziladi, lekin hisoblanmaydi</li><li>Bir kunda ikki aloqa — bitta</li><li>Shu kuni belgilanadi, keyin faqat admin</li></ul></section></aside></div>`;
        const refresh = () => assistantHome(container, user);
        container.querySelectorAll('[data-mark]').forEach(b => b.onclick = () => { const s = list.find(x => x.id === b.dataset.mark); if (s) markDrawer(s, refresh); });
        container.querySelectorAll('[data-card]').forEach(b => b.onclick = () => u.openStudent(b.dataset.card));
        container.querySelectorAll('[data-go-contacts]').forEach(b => b.onclick = () => { switchTab('school-contacts'); setTimeout(() => { const r = document.getElementById('schoolContactsRoot') || document.querySelector('#tab-school-contacts .sc-root'); if (r && b.dataset.goContacts !== month) { r.dataset.month = b.dataset.goContacts; renderContacts(r); } }, 60); });
    }

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

    window.schoolTeacher = { renderContacts, contactsBlock, openInactive, renderAvatarPicker, markDrawer, homeExtras, renderMyStudents, assistantHome, renderSoldStudents };
})();
