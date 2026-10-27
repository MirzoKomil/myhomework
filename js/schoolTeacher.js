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
    async function openInactive() {
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
        const td = today();
        const all = getItem(STORAGE_KEYS.students, []).filter(s => !s.isStaffDemo && s.status !== 'inactive');
        const helped = all.filter(s => String(s.assistantTeacherId || '') === String(tid));
        const [rep, trials, makeups] = await Promise.all([
            helped.length ? api(`/assist/month?month=${td.slice(0, 7)}`).catch(() => null) : null,
            (typeof apiFetchTeacherTrialLessons === 'function' ? apiFetchTeacherTrialLessons() : Promise.resolve({ lessons: [] })).catch(() => ({ lessons: [] })),
            api('/makeups').catch(() => ({ makeups: [] }))
        ]);
        if (!container.isConnected) return;
        globalThis.__schoolMakeups = makeups.makeups || [];
        const reviewing = (makeups.makeups || []).filter(m => m.status === 'review').length;

        // Maosh: asosiy (KPI) + yordamchi (aloqalar × 3 846).
        const sal = container.querySelector('[data-thx-sal]'), sub = container.querySelector('[data-thx-salsub]');
        if (sal) {
            // Oktyabrgacha (ASSIST_CONTACTS_FROM) yordamchi qismi eski davomatdan — bosh sahifa o'zi hisoblagan.
            const old = sal.dataset.oldAssist != null ? Number(sal.dataset.oldAssist) || 0 : null;
            const main = Number(sal.dataset.main) || 0, extra = old != null ? old : rep?.amount || 0;
            sal.textContent = num(main + extra);
            if (sub) sub.innerHTML = `${helped.length ? `asosiy ${num(main)} + yordamchi ${old != null || rep ? num(extra) : '—'}${old != null ? ' (davomat bo\'yicha)' : ''} · ` : ''}${reviewing ? `<b>+${reviewing} qoplash tekshiruvda</b> (admin tasdiqlasa qo'shiladi) · ` : ''}oy yopilganda Moliya tasdiqlaydi`;
        }

        // Bugungi sinov darslari — bugungi ro'yxatga qo'shiladi.
        const lessons = (trials.lessons || []).filter(l => l.trialRequest);
        const at = l => new Date(l.trialRequest.scheduledAt);
        const localDate = d => new Date(d.getTime() + 5 * 3600000).toISOString().slice(0, 10);
        const hhmm = d => new Date(d.getTime() + 5 * 3600000).toISOString().slice(11, 16);
        const list = container.querySelector('[data-thx-today]');
        const todayTrials = lessons.filter(l => Number.isFinite(at(l).getTime()) && localDate(at(l)) === td && ['pending', 'accepted'].includes(l.trialRequest.state));
        if (list && todayTrials.length) {
            const rows = [...list.children];
            for (const l of todayTrials) {
                const t = hhmm(at(l)), past = at(l).getTime() < Date.now();
                const li = document.createElement('li');
                li.className = `tch-row tch-row--${past ? 'warn' : 'wait'}`;
                li.innerHTML = `<b class="tch-time">${esc(t)}</b><div style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1"><strong>${esc(l.name || 'Lid')}</strong>
                    <span class="mot-prize-note">sinov darsi · ${l.trialRequest.state === 'pending' ? 'tasdiqlanmagan' : past ? 'natija kutilmoqda' : 'tasdiqlangan'}</span></div>
                    <div class="tch-row-actions"><button type="button" class="tch-row-btn" data-thx-trials>${l.trialRequest.state === 'pending' ? 'Tasdiqlash' : past ? 'Natijani yozish' : 'Ochish'}</button></div>`;
                const before = rows.find(r => (r.querySelector('.tch-time')?.textContent || '99') > t);
                list.insertBefore(li, before || null);
            }
            container.querySelector('[data-thx-today-empty]')?.remove();
            const cnt = container.querySelector('[data-thx-today-count]');
            if (cnt) cnt.insertAdjacentText('beforeend', ` · +${todayTrials.length} sinov`);
        }

        // Bajarish kerak — har biri maosh yoki o'quvchi natijasiga ta'sir qiladi.
        const todo = [];
        container.querySelectorAll('.tch-row--warn [data-thx-mark="1"]').forEach(b => {
            const row = b.closest('.tch-row');
            todo.push({ t: `${row.querySelector('strong')?.textContent || ''} · ${row.querySelector('.tch-time')?.textContent || ''} darsi belgilanmagan`, s: 'Belgilanmagan dars maoshga o\'tmaydi', btn: 'Belgilash', go: 'teachers-section' });
        });
        for (const l of lessons) {
            const d = at(l); if (!Number.isFinite(d.getTime())) continue;
            const when = `${localDate(d) === td ? 'bugun' : u.fmtDate(localDate(d), false)} ${hhmm(d)}`;
            if (l.trialRequest.state === 'pending') todo.push({ t: `${l.name || 'Lid'} · ${when} sinov darsi`, s: 'Tasdiqlamaguningizcha lidga vaqt yuborilmaydi', btn: 'Tasdiqlash', go: 'trial-lessons' });
            else if (l.trialRequest.state === 'accepted' && d.getTime() < Date.now()) todo.push({ t: `${l.name || 'Lid'} · sinov darsi natijasi`, s: `${when} o'tdi · natija sotuv menejeriga boradi`, btn: 'Natijani yozish', go: 'trial-lessons' });
        }
        const box = container.querySelector('[data-thx-todo]');
        if (box) {
            box.innerHTML = todo.length ? `<section class="card dashboard-panel thx-todo"><div class="dashboard-panel-head"><h3>Bajarish kerak · ${todo.length}</h3><span>Har biri maoshingiz yoki o'quvchi natijasiga ta'sir qiladi</span></div>
                <ul>${todo.map((x, i) => `<li><div><b>${esc(x.t)}</b><small>${esc(x.s)}</small></div><button type="button" class="sc-btn sc-btn--sm${i ? '' : ' sc-btn--pri'}" data-go="${x.go}">${esc(x.btn)}</button></li>`).join('')}</ul></section>` : '';
            box.querySelectorAll('[data-go]').forEach(b => b.onclick = () => switchTab(b.dataset.go));
        }
        container.querySelectorAll('[data-thx-trials]').forEach(b => b.onclick = () => switchTab('trial-lessons'));

        // Yordamchi ustozlik — aloqalar soni (oyiga 13 tagacha).
        const as = container.querySelector('[data-thx-assist]');
        if (as && helped.length && rep) {
            const by = new Map((rep.students || []).map(s => [s.studentId, s]));
            const ws = weekStart(td);
            const adv = s => ([1, 3, 5].includes(Number(s.lessonDayOfWeek)) ? [2, 4, 6] : [1, 3, 5]);
            as.hidden = false;
            as.innerHTML = `<div class="ahx-card-h"><h3>Yordamchi ustozlik</h3><button type="button" class="ahx-link" data-go-contacts>Aloqalar →</button></div>
                <p class="sc-mt">oyiga 13 tagacha · haftasiga 3 ta</p>
                ${helped.map(s => { const r = by.get(s.id) || { counted: 0, items: [] }; const wk = (r.items || []).filter(i => i.day >= ws && i.status === 'counted').length;
                    return `<div class="thx-as-row"><div><b>${esc(s.name)}</b><small>tavsiya ${adv(s).map(d => DAY[d - 1]).join('·')}${s.lessonTime ? ' ' + esc(s.lessonTime) : ''} · asosiy ustoz ${esc(u.teacherName(s.teacherId, true))}${s.frozen ? ' · muzlatilgan' : ''}</small>
                      <i class="thx-as-bar"><i style="width:${Math.min(100, r.counted / 13 * 100)}%"></i></i></div><span><em><b>${r.counted}</b> / 13</em><small>bu hafta ${wk}/3</small></span></div>`; }).join('')}
                <p class="mot-prize-note">Har bir aloqa ${num(rep.rate || 3846)} so'm · kamida 5 daqiqa · usul va daqiqa kiritiladi.</p>`;
            as.querySelector('[data-go-contacts]').onclick = () => switchTab('school-contacts');
        }
    }

    window.schoolTeacher = { renderContacts, contactsBlock, openInactive, renderAvatarPicker, markDrawer, homeExtras };
})();
