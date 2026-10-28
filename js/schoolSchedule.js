// Yagona dars jadvali — admin (kun · ustoz haftasi · so'rovlar · qoplash),
// sotuv/ROP ("Kim bo'sh?", sinov band qilish), ustoz (o'z haftasi, qoplash, so'rov).
// Ma'lumot faqat /api/school'dan; boshqa o'quvchi ismlari sotuvga kelmaydi (server kesadi).
(function () {
    'use strict';
    const U = () => window.schoolUI;
    // Ko'rinadigan oraliq: odatda 08–21, lekin kechki/erta darslar bo'lsa kengayadi (22:00 dagi dars chetga qisilmasin).
    let H0 = 8 * 60, H1 = 21 * 60;
    function fitRange(views) {
        let lo = 8 * 60, hi = 21 * 60;
        for (const v of views) for (const x of [...(v.items || []), ...(v.work || [])]) {
            if (Number.isFinite(x.start)) lo = Math.min(lo, Math.floor(x.start / 60) * 60);
            if (Number.isFinite(x.end)) hi = Math.max(hi, Math.ceil(x.end / 60) * 60);
        }
        H0 = Math.max(0, lo); H1 = Math.min(24 * 60, hi);
    }
    const KIND = { lesson: 'Dars', trial: 'Sinov', makeup: 'Qoplash', reserved: 'Muzlatilgan · sinovga ochiq', close: 'Yopiq', leave: 'Ta\'til', makeup_only: 'Faqat qoplash' };
    const STATUS = { hold: 'ushlab turilgan', pending: 'ustoz tasdig\'ida', confirmed: 'tasdiqlangan', done: 'o\'tkazildi', no_show: 'kelmadi' };
    const state = { date: null, view: null, teacherId: null, duration: 30, lang: null };
    // Ingliz va rus tili jadvali alohida: admin/ROP tanlaydi, sotuv menejeri faqat o'z tilini ko'radi (server ham cheklaydi).
    const ownLang = () => (typeof getUserOwnLang === 'function' && getUserOwnLang()) || 'english';
    // Admin/boshliq ikkala tilni tanlaydi; ROP faqat bitta tilga biriktirilmagan bo'lsa (server ham cheklaydi).
    const canPickLang = () => ['admin', 'boshliq'].includes(role()) || (role() === 'rop' && !(typeof getUserOwnLang === 'function' && getUserOwnLang()));
    const L = () => `&lang=${state.lang}`;
    const role = () => getCurrentUser()?.role || '';
    const isFull = () => ['admin', 'boshliq'].includes(role());
    const isSales = () => ['sales_manager', 'rop'].includes(role());

    function pct(m) { return ((Math.max(H0, Math.min(H1, m)) - H0) / (H1 - H0) * 100).toFixed(3); }
    function axis() {
        let s = '<div class="ss-axis" aria-hidden="true">';
        for (let h = H0 / 60; h <= H1 / 60; h++) s += `<span style="left:${pct(h * 60)}%">${String(h).padStart(2, '0')}</span>`;
        return s + '</div>';
    }
    function blocks(view, { sales = false, clickable = true } = {}) {
        const { esc, hm } = U();
        const free = (sales ? view.trialFree : view.free).map(f => `<i class="ss-free" style="left:${pct(f.start)}%;width:${pct(f.end) - pct(f.start)}%" title="Bo'sh ${hm(f.start)}–${hm(f.end)}"${sales ? ` data-free="${view.teacherId}|${view.date}|${f.start}|${f.end}"` : ''}></i>`).join('');
        const work = view.work.map(w => `<i class="ss-work" style="left:${pct(w.start)}%;width:${pct(w.end) - pct(w.start)}%"></i>`).join('');
        const items = view.items.map(i => {
            const k = sales && !i.mine && i.kind !== 'close' && i.kind !== 'leave' ? (i.kind === 'trial' && i.status === 'hold' ? 'held' : 'busy') : i.kind;
            const label = sales ? (i.mine ? 'Mening sinovim' : i.kind === 'trial' && i.status === 'hold' ? 'Ushlab turilgan' : '')
                : i.studentName || (i.kind === 'trial' ? 'Sinov' : KIND[i.kind] || '');
            const title = `${hm(i.start)}–${hm(i.end)} · ${KIND[i.kind] || i.kind}${i.status ? ' · ' + (STATUS[i.status] || i.status) : ''}${!sales && i.studentName ? ' · ' + i.studentName : ''}${i.reason ? ' · ' + i.reason : ''}`;
            const data = !sales && i.studentId ? ` data-st="${esc(i.studentId)}"` : i.bookingId ? ` data-bk="${esc(i.bookingId)}"` : i.overrideId && isFull() ? ` data-ov="${esc(i.overrideId)}"` : '';
            const st = !sales && i.studentId ? U().studentById(i.studentId) : null;
            const av = st ? U().studentAvatar(st, 24) : '';
            return `<button type="button" class="ss-b ss-b--${k}${i.status ? ' is-' + i.status : ''}${i.mine ? ' is-mine' : ''}${av ? ' has-av' : ''}" style="left:${pct(i.start)}%;width:${pct(i.end) - pct(i.start)}%"${data} title="${esc(title)}" aria-label="${esc(title)}"${clickable ? '' : ' tabindex="-1"'}>${av}<span>${esc(label)}</span></button>`;
        }).join('');
        return `<div class="ss-track">${work}${free}${items}</div>`;
    }
    function timeline(rows, opts) {
        fitRange(rows.map(r => r.view));
        const { esc } = U();
        const now = U().nowMin();
        const showNow = rows.some(r => r.view.date === U().today()) && now >= H0 && now <= H1;
        return `<div class="ss-tl" role="table">${axis()}${rows.map(r => `<div class="ss-row" role="row"><div class="ss-lab" role="rowheader">${r.label}</div>${blocks(r.view, opts)}</div>`).join('')}
            ${showNow ? `<i class="ss-now" style="left:calc(var(--ss-lab) + (100% - var(--ss-lab)) * ${pct(now) / 100})"></i>` : ''}</div>
            <div class="ss-legend">${opts?.sales ? '<span class="ss-lg ss-b--busy">Band</span><span class="ss-lg ss-b--held">Boshqa menejer ushlab turibdi</span>' : '<span class="ss-lg ss-b--lesson">Dars</span>'}${opts?.sales ? '<span class="ss-lg ss-b--trial">Mening sinovim</span>' : '<span class="ss-lg ss-b--trial">Sinov</span><span class="ss-lg ss-b--makeup">Qoplash</span><span class="ss-lg ss-b--reserved">Muzlatilgan</span>'}<span class="ss-lg ss-free">Bo'sh${opts?.sales ? ' · sinovga ochiq' : ''}</span><span class="ss-lg ss-b--close">Yopiq / ta'til</span></div>`;
    }
    function bindClicks(root, reload) {
        root.querySelectorAll('[data-st]').forEach(b => b.onclick = () => U().openStudent(b.dataset.st));
        root.querySelectorAll('[data-ov]').forEach(b => b.onclick = async () => {
            if (!confirm('Bu yopish/ochishni bekor qilasizmi?')) return;
            try { await U().api('/overrides/' + b.dataset.ov, { method: 'DELETE' }); U().toast('Bekor qilindi'); reload(); } catch (e) { U().toast(e.message, 4000); }
        });
    }

    // ── Asosiy kirish ────────────────────────────────────────────────────────
    async function render(root) {
        if (!root) return;
        await U().loadStaffAvatars();
        state.date ||= U().today();
        state.lang ||= ownLang();
        if (!canPickLang()) state.lang = ownLang();
        const r = role();
        const V2 = window.scheduleV2;
        state.view ||= V2 && r !== 'sales_manager' ? V2.defaultView() : r === 'teacher' ? 'mine' : isSales() ? 'free' : 'day';
        // Jadval v2 (js/scheduleV2.js): admin/ROP kun va ustoz haftasi, ustoz Kun/Hafta/Oy, yordamchi tavsiya jadvali.
        // Sotuv menejeri ("Kim bo'sh?") va qolgan ro'yxatlar shu fayldagi eski ko'rinishda qoladi.
        if (V2 && V2.owns(state.view)) return V2.render(root);
        const tabs = isFull() ? [['day', 'Kun · ustozlar'], ['week', 'Hafta · bitta ustoz'], ['requests', 'So\'rovlar'], ['makeups', 'Qoplash']]
            : r === 'rop' ? [['free', 'Kim bo\'sh?'], ['day', 'Kun · ustozlar'], ['week', 'Hafta · bitta ustoz']] : r === 'teacher' ? [['mine', V2 ? '← Jadval' : 'Mening haftam'], ['trials', 'Sinovlar va so\'rovlar']] : [['free', 'Kim bo\'sh?']];
        root.innerHTML = `<div class="sc-head"><div><h1>Dars jadvali</h1><p class="sc-sub">${r === 'teacher' ? 'Darslaringiz, sinovlar va qoplash · vaqtni so\'rov orqali o\'zgartirasiz' : isSales() ? 'Sinovga ochiq bo\'sh vaqtlar · boshqa o\'quvchilar ismi ko\'rinmaydi' : 'Bitta manba — hamma rolda bir xil · Asia/Tashkent'}</p></div>
            <div class="sc-row sc-wrap">${canPickLang() ? `<div class="sc-seg" role="group" aria-label="Yo'nalish"><button type="button" data-lang="english" aria-pressed="${state.lang === 'english'}">Ingliz tili</button><button type="button" data-lang="russian" aria-pressed="${state.lang === 'russian'}">Rus tili</button></div>` : r === 'teacher' ? '' : `<span class="sc-pill sc-pill--info">${state.lang === 'russian' ? 'Rus tili' : 'Ingliz tili'}</span>`}
            <div class="sc-seg" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-v="${k}" aria-pressed="${k === state.view}">${l}</button>`).join('')}</div></div></div><div data-body></div>`;
        root.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { state.view = b.dataset.v; render(root); });
        root.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { if (state.lang === b.dataset.lang) return; state.lang = b.dataset.lang; state.teacherId = null; render(root); });
        const body = root.querySelector('[data-body]');
        const fn = { day: dayView, week: weekView, requests: requestsView, makeups: makeupsView, free: freeView, mine: mineView, trials: teacherTrialsView }[state.view];
        try { await fn(body, () => render(root)); } catch (e) { body.innerHTML = `<div class="sc-err">${U().esc(e.message)}</div>`; }
    }
    function dateNav(label) {
        return `<div class="ss-nav"><button type="button" class="sc-btn sc-btn--sm" data-d="-1" aria-label="Oldingi">‹</button><b>${label}</b><button type="button" class="sc-btn sc-btn--sm" data-d="1" aria-label="Keyingi">›</button><button type="button" class="sc-btn sc-btn--sm" data-d="0">Bugun</button></div>`;
    }
    function bindNav(body, step, reload) {
        body.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const d = Number(b.dataset.d); state.date = d === 0 ? U().today() : U().addDays(state.date, d * step); reload(); });
    }

    // Admin/ROP: bir kun, barcha ustozlar.
    async function dayView(body, reload) {
        const { api, esc, fmtDate } = U();
        const d = await api(`/schedule?from=${state.date}&to=${state.date}${L()}`);
        const tmap = new Map((d.teachers || []).map(t => [t.id, t]));
        const views = d.views.filter(v => v.work.length || v.items.length).sort((a, b) => (tmap.get(a.teacherId)?.name || '').localeCompare(tmap.get(b.teacherId)?.name || ''));
        const s = d.summary;
        const trials = views.flatMap(v => v.items.filter(i => i.kind === 'trial'));
        body.innerHTML = `${dateNav(fmtDate(state.date))}
          ${s ? `<div class="sc-kpis"><div class="sc-kpi"><small>Darslar</small><b>${s.lessons}</b></div><div class="sc-kpi"><small>O'tildi</small><b>${s.done}</b></div><div class="sc-kpi"><small>Hozir</small><b>${s.now}</b></div><div class="sc-kpi sc-kpi--bad"><small>Qoldirildi</small><b>${s.missed}</b></div><div class="sc-kpi sc-kpi--warn"><small>Belgilanmagan</small><b>${s.unmarked}</b></div><div class="sc-kpi"><small>Sinovlar</small><b>${trials.length}</b><span>${trials.filter(t => t.status === 'pending').length} tasdiq kutmoqda</span></div></div>` : ''}
          <section class="sc-card sc-pad">${views.length ? timeline(views.map(v => ({ label: `${U().staffAvatar(tmap.get(v.teacherId) || { id: v.teacherId }, 30)}<span><button type="button" class="sc-link" data-t="${esc(v.teacherId)}">${esc(tmap.get(v.teacherId)?.name || U().teacherName(v.teacherId))}</button><small>${v.items.filter(i => i.kind === 'lesson').length} dars</small></span>`, view: v })), { sales: false })
            : '<p class="sc-mt">Bu kunda ish vaqti belgilangan ustoz yo\'q. Ustoz haftasi → "Ish vaqti" orqali kiriting.</p>'}</section>`;
        bindNav(body, 1, reload); bindClicks(body, reload);
        body.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { state.teacherId = b.dataset.t; state.view = 'week'; reload(); });
    }

    // Admin: bitta ustozning haftasi + vaqtni boshqarish.
    async function weekView(body, reload) {
        const { api, esc, fmtDate, weekStart, addDays, DAY } = U();
        const teachers = U().teachersForSubject(state.lang);
        if (!teachers.some(t => t.id === state.teacherId)) state.teacherId = teachers[0]?.id;
        const from = weekStart(state.date), to = addDays(from, 6);
        const d = state.teacherId ? await api(`/schedule?from=${from}&to=${to}&teacherId=${encodeURIComponent(state.teacherId)}${L()}`) : { views: [] };
        const lessons = d.views.reduce((n, v) => n + v.items.filter(i => i.kind === 'lesson').length, 0);
        const makeups = d.views.reduce((n, v) => n + v.items.filter(i => i.kind === 'makeup').length, 0);
        body.innerHTML = `<div class="sc-row sc-wrap">${dateNav(`${fmtDate(from, false)} – ${fmtDate(to, false)}`)}<span class="sc-grow"></span>
            <select data-tid aria-label="Ustoz">${teachers.map(t => `<option value="${esc(t.id)}"${t.id === state.teacherId ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
            <button type="button" class="sc-btn" data-hours>Ish vaqti</button><button type="button" class="sc-btn sc-btn--pri" data-ov-new>Vaqtni ochish / yopish</button></div>
          <p class="sc-mt">${lessons} dars · ${makeups} qoplash · yopiq yoki ochilgan vaqtni bosib bekor qilish mumkin</p>
          <section class="sc-card sc-pad">${timeline(d.views.map(v => ({ label: `<b>${DAY[U().wd(v.date) - 1]}</b><small>${esc(fmtDate(v.date, false))}</small>`, view: v })), {})}</section>`;
        bindNav(body, 7, reload); bindClicks(body, reload);
        body.querySelector('[data-tid]').onchange = e => { state.teacherId = e.target.value; reload(); };
        body.querySelector('[data-ov-new]').onclick = () => overrideDrawer(state.teacherId, reload);
        body.querySelector('[data-hours]').onclick = () => hoursDrawer(state.teacherId, reload);
    }
    function overrideDrawer(teacherId, done) {
        const { openDrawer, field, today, esc, DAY_FULL } = U();
        const box = openDrawer({ title: 'Vaqtni ochish / yopish', sub: esc(U().teacherName(teacherId)), body: `
            <div class="sc-sec"><h3>Tur</h3><div class="sc-chips">${[['close', 'Yopish'], ['open', 'Qo\'shimcha ochish'], ['makeup_only', 'Faqat qoplash'], ['leave', 'Ta\'til']].map(([k, l], i) => `<label class="sc-chip"><input type="radio" name="kind" value="${k}"${i === 0 ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
            <div class="sc-sec"><h3>Qachon</h3><div class="sc-chips"><label class="sc-chip"><input type="radio" name="rep" value="once" checked><span>Faqat shu sana</span></label><label class="sc-chip"><input type="radio" name="rep" value="weekly"><span>Har hafta</span></label></div>
              <div class="sc-g2 sc-mtop">${field('Sana', `<input type="date" name="date" value="${today()}" min="${today()}">`)}${field('Hafta kuni', `<select name="weekday" disabled>${DAY_FULL.map((d, i) => `<option value="${i + 1}">${d}</option>`).join('')}</select>`)}
              ${field('Boshlanish', '<input name="from" value="09:00">')}${field('Tugash', '<input name="to" value="11:00">', 'Butun kun: 00:00 – 24:00')}</div></div>
            ${field('Sabab', '<textarea name="reason" rows="2" placeholder="Masalan: shifokor"></textarea>')}
            <div class="sc-note">Yopilgan vaqtga yangi sinov qo'yilmaydi. Shu vaqtdagi mavjud darslar "qoplash kerak" bo'lib qoladi — ularni alohida ko'chiring.</div>`,
            foot: '<button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Saqlash</button>' });
        const rep = () => box.querySelector('[name=rep]:checked').value;
        box.querySelectorAll('[name=rep]').forEach(r => r.onchange = () => { box.querySelector('[name=date]').disabled = rep() === 'weekly'; box.querySelector('[name=weekday]').disabled = rep() !== 'weekly'; });
        box.querySelector('[data-save]').onclick = async e => {
            const v = n => box.querySelector(`[name=${n}]`).value;
            U().busy(e.target, true);
            try { await U().post('/overrides', { teacherId, kind: box.querySelector('[name=kind]:checked').value, repeat: rep(), date: v('date'), weekday: Number(v('weekday')), from: v('from'), to: v('to'), reason: v('reason') }); U().toast('Saqlandi'); U().closeDrawer(); done(); }
            catch (err) { U().busy(e.target, false); U().errBox(box, err.message); }
        };
    }
    async function hoursDrawer(teacherId, done) {
        const { openDrawer, esc, DAY_FULL, hm } = U();
        let hours = [];
        try { hours = (await U().api(`/teachers/${encodeURIComponent(teacherId)}/hours`)).hours; } catch (e) { return U().toast(e.message); }
        const row = d => { const h = hours.find(x => Number(x.weekday) === d); return `<div class="ss-hr"><label class="sc-chip"><input type="checkbox" name="on${d}"${h ? ' checked' : ''}><span>${DAY_FULL[d - 1]}</span></label>
            <input name="f${d}" value="${h ? hm(h.start_min) : '10:00'}" aria-label="Boshlanish"> – <input name="t${d}" value="${h ? hm(h.end_min) : '20:00'}" aria-label="Tugash">
            <label class="sc-chip"><input type="checkbox" name="tr${d}"${!h || h.trial_open ? ' checked' : ''}><span>sinovga ochiq</span></label></div>`; };
        const box = openDrawer({ title: 'Ish vaqti', sub: esc(U().teacherName(teacherId)) + ' · har hafta takrorlanadi', body: `${[1, 2, 3, 4, 5, 6, 7].map(row).join('')}<div class="sc-note">Sotuv menejerlari faqat "sinovga ochiq" bo'sh vaqtlarni ko'radi.</div>`,
            foot: '<button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Saqlash</button>' });
        box.querySelector('[data-save]').onclick = async e => {
            const q = n => box.querySelector(`[name=${n}]`);
            const slots = [1, 2, 3, 4, 5, 6, 7].filter(d => q('on' + d).checked).map(d => ({ weekday: d, from: q('f' + d).value, to: q('t' + d).value, trialOpen: q('tr' + d).checked }));
            U().busy(e.target, true);
            try { await U().api(`/teachers/${encodeURIComponent(teacherId)}/hours`, { method: 'PUT', body: { slots } }); U().toast('Ish vaqti saqlandi'); U().closeDrawer(); done(); }
            catch (err) { U().busy(e.target, false); U().errBox(box, err.message); }
        };
    }

    async function requestsView(body, reload) {
        if (window.adminNazorat) return window.adminNazorat.renderRequests(body); // AdminSorovlar dizayni
        const { api, esc, fmtDate } = U();
        const list = (await api('/requests')).requests.filter(r => r.type !== 'assist_late');
        const T = { leave: 'ta\'til', close: 'vaqtni yopish', open: 'qo\'shimcha ochish', student: 'o\'quvchi bo\'yicha' };
        const TOPIC = { freeze: 'muzlatish', teacher: 'ustozni almashtirish', schedule: 'jadvalni o\'zgartirish', other: 'boshqa' };
        body.innerHTML = `<section class="sc-card">${list.map(r => `<div class="sc-it"><span class="sc-grow"><b>${esc(r.requester_name)} · ${r.type === 'student' ? esc(TOPIC[r.payload?.topic] || 'o\'quvchi bo\'yicha') : T[r.type] || r.type}</b>
            <small>${r.type === 'student' ? `${r.payload?.studentId ? `<button type="button" class="sc-link" data-st="${esc(r.payload.studentId)}">${esc(r.payload.studentName || '')}</button>` : ''}` : `${r.payload?.date ? esc(fmtDate(r.payload.date)) : r.payload?.weekday ? 'har ' + esc(U().DAY_FULL[r.payload.weekday - 1]) : ''} ${esc(r.payload?.from || '')}${r.payload?.to ? '–' + esc(r.payload.to) : ''}`} · "${esc(r.reason)}"</small></span>
            ${r.status === 'new' ? `<button type="button" class="sc-btn sc-btn--sm" data-no="${esc(r.id)}">Rad etish</button><button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-yes="${esc(r.id)}">Tasdiqlash</button>` : `<span class="sc-pill ${r.status === 'approved' ? 'sc-pill--ok' : 'sc-pill--bad'}">${r.status === 'approved' ? 'Tasdiqlandi' : 'Rad etildi'}</span>`}</div>`).join('') || '<p class="sc-mt sc-pad">So\'rov yo\'q</p>'}</section>`;
        const decide = async (id, decision) => {
            const note = decision === 'approve' ? '' : prompt('Rad etish sababi:') || '';
            if (decision !== 'approve' && note.trim().length < 3) return;
            try { await U().post(`/requests/${id}/decide`, { decision, note }); U().toast('Saqlandi'); reload(); } catch (e) { U().toast(e.message, 4000); }
        };
        body.querySelectorAll('[data-yes]').forEach(b => b.onclick = () => decide(b.dataset.yes, 'approve'));
        body.querySelectorAll('[data-no]').forEach(b => b.onclick = () => decide(b.dataset.no, 'reject'));
        body.querySelectorAll('[data-st]').forEach(b => b.onclick = () => U().openStudent(b.dataset.st));
    }
    async function makeupsView(body, reload) {
        if (window.adminNazorat) return window.adminNazorat.renderMakeups(body, { lang: state.lang }); // AdminQoplash dizayni
        const { api, esc, fmtDate } = U();
        const list = (await api('/makeups')).makeups;
        const ST = { planned: ['Rejada', 'sc-pill--info'], review: ['Tekshiruvda', 'sc-pill--warn'], approved: ['Tasdiqlandi', 'sc-pill--ok'], rejected: ['Rad etildi', 'sc-pill--bad'], cancelled: ['Bekor', 'sc-pill--mute'] };
        body.innerHTML = `<div class="sc-note">Qoplash darsi ustoz maoshidan ayrilmasligi uchun: faqat haqiqiy kelmagan dars uchun, shu oy ichida. Tasdiqlangandan keyin maoshga qo'shiladi.</div>
          <section class="sc-card"><table class="sc-table"><thead><tr><th>O'quvchi</th><th>Ustoz</th><th>Qoldirilgan</th><th>Qoplangan</th><th>Tur</th><th>Holat</th><th></th></tr></thead><tbody>
          ${list.map(m => `<tr><td><button type="button" class="sc-link" data-st="${esc(m.student_id)}">${esc(U().studentById(m.student_id)?.name || m.student_id)}</button></td><td>${esc(U().teacherName(m.teacher_id, true))}</td><td>${esc(fmtDate(String(m.missed_date).slice(0, 10)))}</td><td>${m.held_date ? esc(fmtDate(String(m.held_date).slice(0, 10))) : '—'}</td><td>${m.kind === 'double' ? 'Qo\'shaloq' : 'Alohida'}</td>
            <td><span class="sc-pill ${ST[m.status][1]}">${ST[m.status][0]}</span></td><td>${m.status === 'review' ? `<button type="button" class="sc-btn sc-btn--sm" data-no="${esc(m.id)}">Rad</button> <button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-yes="${esc(m.id)}">Tasdiqlash</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="sc-mt">Qoplash yo\'q</td></tr>'}</tbody></table></section>`;
        bindClicks(body, reload);
        const decide = async (id, decision) => {
            const note = decision === 'approve' ? '' : prompt('Rad etish sababi:') || '';
            if (decision !== 'approve' && note.trim().length < 3) return;
            try { await U().post(`/makeups/${id}/decide`, { decision, note }); U().toast('Saqlandi'); reload(); } catch (e) { U().toast(e.message, 4000); }
        };
        body.querySelectorAll('[data-yes]').forEach(b => b.onclick = () => decide(b.dataset.yes, 'approve'));
        body.querySelectorAll('[data-no]').forEach(b => b.onclick = () => decide(b.dataset.no, 'reject'));
    }

    // ── Sotuv / ROP: "Kim bo'sh?" ────────────────────────────────────────────
    async function freeView(body, reload) {
        const { api, esc, fmtDate } = U();
        // ROP uchun ham "Kim bo'sh?" sotuvdagidek (ismlarsiz, "mening sinovim") — mode=free.
        const d = await api(`/schedule?from=${state.date}&to=${state.date}${L()}&mode=free`);
        const tmap = new Map((d.teachers || []).map(t => [t.id, t]));
        const views = d.views.filter(v => v.work.length).sort((a, b) => (tmap.get(a.teacherId)?.name || '').localeCompare(tmap.get(b.teacherId)?.name || ''));
        const mine = views.flatMap(v => v.items.filter(i => i.mine).map(i => ({ ...i, teacherId: v.teacherId, date: v.date })));
        body.innerHTML = `<div class="sc-row sc-wrap">${dateNav(fmtDate(state.date))}<span class="sc-grow"></span>
            <label class="sc-row">Davomiylik <select data-dur>${[15, 30, 45, 60].map(n => `<option value="${n}"${n === state.duration ? ' selected' : ''}>${n} daq</option>`).join('')}</select></label></div>
          ${mine.length ? `<section class="sc-card"><header class="sc-ch"><h2>Mening sinovlarim · ${esc(fmtDate(state.date, false))}</h2></header>${mine.map(i => `<div class="sc-it"><span class="sc-grow"><b>${U().hm(i.start)} · ${esc(tmap.get(i.teacherId)?.name || '')}${i.leadId ? ' · ' + esc(leadName(i.leadId)) : ''}</b><small>${STATUS[i.status] || i.status}${i.status === 'hold' && i.holdUntil ? ' · ' + esc(new Date(i.holdUntil).toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' })) + ' gacha' : ''}</small></span>${i.bookingId && ['hold', 'pending', 'confirmed'].includes(i.status) ? `<button type="button" class="sc-btn sc-btn--sm" data-cancel="${esc(i.bookingId)}">Bekor qilish</button>` : ''}</div>`).join('')}</section>` : ''}
          <section class="sc-card sc-pad">${views.length ? timeline(views.map(v => ({ label: `${U().staffAvatar(tmap.get(v.teacherId), 28)}<span><b>${esc(tmap.get(v.teacherId)?.name || '')}</b><small>${v.trialFree.reduce((n, f) => n + Math.max(0, f.end - f.start), 0) >= state.duration ? 'bo\'sh vaqt bor' : 'bo\'sh yo\'q'}</small></span>`, view: v })), { sales: true })
            : '<p class="sc-mt">Bu kunda sinovga ochiq vaqt yo\'q</p>'}<p class="sc-mt">Yashil oraliqni bosing — vaqt 10 daqiqa siz uchun ushlab turiladi, shu vaqt ichida lidni tanlab tasdiqlang.</p></section>`;
        bindNav(body, 1, reload);
        body.querySelector('[data-dur]').onchange = e => { state.duration = Number(e.target.value); reload(); };
        body.querySelectorAll('[data-free]').forEach(el => el.onclick = () => { const [tid, date, s, e] = el.dataset.free.split('|'); bookDrawer({ teacherId: tid, teacherName: tmap.get(tid)?.name, date, start: Number(s), end: Number(e) }, reload); });
        body.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => { try { await U().post(`/bookings/${b.dataset.cancel}/cancel`); U().toast('Bekor qilindi'); reload(); } catch (e) { U().toast(e.message, 4000); } });
    }
    function leadName(id) {
        const all = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
        return [...(all.english || []), ...(all.russian || [])].find(l => l.id === id)?.name || 'lid';
    }
    function myLeads() {
        const all = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
        const list = state.lang === 'russian' ? (all.russian || []) : (all.english || []);
        return list.filter(l => !['lost', 'yoqotilgan', 'tolov-qildi', 'oquvchi'].includes(l.status)).slice(0, 300);
    }
    function bookDrawer(slot, done) {
        const { openDrawer, field, esc, hm, fmtDate } = U();
        const times = []; for (let t = Math.ceil(slot.start / 15) * 15; t + state.duration <= slot.end; t += 15) times.push(t);
        const leads = myLeads();
        const box = openDrawer({ title: 'Sinov darsini band qilish', sub: `${esc(slot.teacherName || '')} · ${esc(fmtDate(slot.date))}`, body: `
            ${field('Vaqt', `<select name="time">${times.map(t => `<option value="${hm(t)}">${hm(t)} – ${hm(t + state.duration)}</option>`).join('')}</select>`)}
            ${field('Lid', `<select name="lead">${leads.map(l => `<option value="${esc(l.id)}">${esc(l.name)}${l.phone ? ' · ' + esc(String(l.phone).slice(-4)) : ''}</option>`).join('')}</select>`, 'Faqat sizning lidlaringiz')}
            ${field('Necha kun', '<select name="days"><option value="1">1 kun</option><option value="2">2 kun</option><option value="3">3 kun</option></select>', 'Ko\'p kunlik sinov ustozning shu hafta kunlari bo\'yicha')}
            <div class="sc-note">Vaqt avval 10 daqiqa siz uchun ushlab turiladi (boshqa menejerlarga "ushlab turilgan" bo'lib ko'rinadi), keyin lid "Sinov darsida" bosqichiga o'tadi va ustoz tasdig'iga boradi.</div>`,
            foot: '<button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Sinovga yozish</button>' });
        let held = null;
        box.querySelector('[data-save]').onclick = async e => {
            const v = n => box.querySelector(`[name=${n}]`).value;
            if (!v('lead')) return U().errBox(box, 'Lidni tanlang');
            const n = Number(v('days'));
            const dates = [slot.date]; const days = [1, 3, 5].includes(U().wd(slot.date)) ? [1, 3, 5] : [2, 4, 6];
            let d = slot.date; while (dates.length < n) { d = U().addDays(d, 1); if (days.includes(U().wd(d))) dates.push(d); }
            U().busy(e.target, true);
            try {
                const r = held || await U().post('/bookings', { kind: 'trial', teacherId: slot.teacherId, dates, time: v('time'), duration: state.duration, leadId: v('lead') });
                held = r;
                await U().post(`/bookings/group/${r.bookings[0].group_id}/attach-lead`, { leadId: v('lead') });
                await U().refreshCache();
                U().toast('Sinov belgilandi · lid "Sinov darsida" · ustoz tasdig\'iga yuborildi'); U().closeDrawer(); done();
            } catch (err) {
                U().busy(e.target, false);
                U().errBox(box, held ? `${err.message} — vaqt siz uchun 10 daqiqa ushlab turiladi. Lid oynasida so'rovnomani to'ldirib, qayta bosing.` : err.message);
            }
        };
    }

    // ── Ustoz: o'z haftasi ───────────────────────────────────────────────────
    async function mineView(body, reload) {
        const { api, esc, fmtDate, weekStart, addDays, DAY } = U();
        const from = weekStart(state.date), to = addDays(from, 6);
        const d = await api(`/schedule?from=${from}&to=${to}${L()}`);
        const n = k => d.views.reduce((a, v) => a + v.items.filter(i => i.kind === k).length, 0);
        body.innerHTML = `<div class="sc-row sc-wrap">${dateNav(`${fmtDate(from, false)} – ${fmtDate(to, false)}`)}<span class="sc-grow"></span>
            <button type="button" class="sc-btn" data-req>Vaqtimni o'zgartirish</button><button type="button" class="sc-btn sc-btn--pri" data-mk>+ Qoplash darsi</button></div>
          <p class="sc-mt">${n('lesson')} dars · ${n('makeup')} qoplash · ${n('trial')} sinov</p>
          <section class="sc-card sc-pad">${timeline(d.views.map(v => ({ label: `<b>${DAY[U().wd(v.date) - 1]}</b><small>${esc(fmtDate(v.date, false))}</small>`, view: v })), {})}</section>`;
        bindNav(body, 7, reload); bindClicks(body, reload);
        body.querySelector('[data-req]').onclick = () => teacherRequestDrawer(reload);
        body.querySelector('[data-mk]').onclick = () => makeupDrawer(reload);
    }
    function teacherRequestDrawer(done, type = 'leave') {
        const { openDrawer, field, today, DAY_FULL } = U();
        const box = openDrawer({ title: 'Vaqtimni o\'zgartirish', sub: 'So\'rov admin tasdig\'iga boradi', body: `
            <div class="sc-chips">${[['leave', 'Ta\'til / dam olish'], ['close', 'Vaqtni yopish'], ['open', 'Qo\'shimcha ochish']].map(([k, l]) => `<label class="sc-chip"><input type="radio" name="type" value="${k}"${k === type ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
            <div class="sc-g2 sc-mtop">${field('Sana', `<input type="date" name="date" value="${today()}" min="${today()}">`)}${field('Har hafta (ixtiyoriy)', `<select name="weekday"><option value="">— faqat shu sana —</option>${DAY_FULL.map((d, i) => `<option value="${i + 1}">${d}</option>`).join('')}</select>`)}
            ${field('Boshlanish', '<input name="from" value="00:00">')}${field('Tugash', '<input name="to" value="24:00">')}</div>
            ${field('Sabab', '<textarea name="reason" rows="2"></textarea>')}`,
            foot: '<button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Yuborish</button>' });
        box.querySelector('[data-save]').onclick = async e => {
            const v = n => box.querySelector(`[name=${n}]`).value;
            U().busy(e.target, true);
            try { await U().post('/requests', { type: box.querySelector('[name=type]:checked').value, date: v('weekday') ? undefined : v('date'), weekday: v('weekday') ? Number(v('weekday')) : undefined, repeat: v('weekday') ? 'weekly' : 'once', from: v('from'), to: v('to'), reason: v('reason') }); U().toast('So\'rov yuborildi'); U().closeDrawer(); done(); }
            catch (err) { U().busy(e.target, false); U().errBox(box, err.message); }
        };
    }
    // opts.studentId — o'quvchi kartasidan ochilganda shu o'quvchi oldindan tanlanadi.
    async function makeupDrawer(done, opts = {}) {
        const { openDrawer, field, today, esc, hm, fmtDate } = U();
        const me = getCurrentUser();
        const mine = getItem(STORAGE_KEYS.students, []).filter(s => !s.frozen && s.status !== 'inactive');
        if (opts.studentId && !mine.some(s => s.id === opts.studentId)) { const st = U().studentById(opts.studentId); if (st) mine.unshift(st); }
        const box = openDrawer({ title: 'Qoplash darsi', sub: 'Qoldirilgan darsni shu oy ichida o\'tib berish', body: `
            ${field('O\'quvchi', `<select name="st">${mine.map(s => `<option value="${esc(s.id)}"${s.id === opts.studentId ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select>`)}
            <div class="sc-chips"><label class="sc-chip"><input type="radio" name="kind" value="separate" checked><span>Alohida kunda</span></label><label class="sc-chip"><input type="radio" name="kind" value="double"><span>Qo'shaloq dars (keyingi darsda)</span></label></div>
            <div class="sc-g2 sc-mtop">${field('Qoldirilgan dars sanasi', `<input type="date" name="missed" max="${today()}">`)}${field('Qoplash sanasi', `<input type="date" name="date" value="${today()}" min="${today()}">`)}</div>
            <div data-times class="sc-slots"></div>
            <div class="sc-note">Faqat haqiqiy kelmagan dars uchun · oyiga rejadagi darslardan ortiq hisoblanmaydi · admin tasdiqlagach maoshga qo'shiladi.</div>`,
            foot: '<button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Saqlash</button>' });
        let pick = null;
        const load = async () => {
            const el = box.querySelector('[data-times]'); pick = null;
            if (box.querySelector('[name=kind]:checked').value === 'double') { el.innerHTML = '<p class="sc-mt">Keyingi darsda 2 × dars davomiyligi o\'tiladi — davomatda "Keldi · 2 dars" belgilanadi</p>'; return; }
            const st = U().studentById(box.querySelector('[name=st]').value); const date = box.querySelector('[name=date]').value;
            try {
                const d = await U().api(`/schedule?from=${date}&to=${date}${L()}`);
                const v = d.views[0]; const dur = st?.lessonDuration || 30; const t = [];
                for (const f of v?.makeupFree || []) for (let m = Math.ceil(f.start / 15) * 15; m + dur <= f.end; m += 15) t.push(m);
                el.innerHTML = t.length ? t.map(m => `<button type="button" class="sc-slot" data-m="${m}" aria-pressed="false">${hm(m)}</button>`).join('') : '<p class="sc-mt">Bu kunda bo\'sh vaqt yo\'q</p>';
                el.querySelectorAll('.sc-slot').forEach(b => b.onclick = () => { pick = Number(b.dataset.m); el.querySelectorAll('.sc-slot').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
            } catch (e) { el.textContent = e.message; }
        };
        box.querySelectorAll('[name=st],[name=date],[name=kind]').forEach(i => i.onchange = load); load();
        box.querySelector('[data-save]').onclick = async e => {
            const v = n => box.querySelector(`[name=${n}]`).value;
            if (!v('missed')) return U().errBox(box, 'Qoldirilgan dars sanasini tanlang');
            U().busy(e.target, true);
            try {
                const st = U().studentById(v('st'));
                if (box.querySelector('[name=kind]:checked').value === 'double') await U().post('/makeups/double', { studentId: v('st'), missedDate: v('missed'), heldDate: v('date') });
                else { if (pick == null) throw new Error('Vaqtni tanlang'); await U().post('/bookings', { kind: 'makeup', teacherId: st.teacherId, studentId: st.id, date: v('date'), time: hm(pick), duration: st.lessonDuration || 30, missedDate: v('missed') }); }
                U().toast('Qoplash rejalashtirildi'); U().closeDrawer(); done();
            } catch (err) { U().busy(e.target, false); U().errBox(box, err.message); }
        };
    }
    async function teacherTrialsView(body, reload) {
        const { api, esc, fmtDate, hm, today, addDays } = U();
        const d = await api(`/schedule?from=${today()}&to=${addDays(today(), 13)}${L()}`);
        const items = d.views.flatMap(v => v.items.filter(i => i.kind === 'trial' || i.kind === 'makeup').map(i => ({ ...i, date: v.date })));
        const reqs = (await api('/requests')).requests;
        const mk = (await api('/makeups')).makeups.filter(m => m.status === 'planned');
        body.innerHTML = `<section class="sc-card"><header class="sc-ch"><h2>Sinov va qoplash · 2 hafta</h2></header>${items.map(i => `<div class="sc-it"><span class="sc-grow"><b>${esc(fmtDate(i.date))} · ${hm(i.start)}</b><small>${i.kind === 'trial' ? 'Sinov' : 'Qoplash'} · ${STATUS[i.status] || i.status}</small></span>
            ${i.fromLead ? '<button type="button" class="sc-btn sc-btn--sm" data-trials>Sinov darslari bo\'limida</button>' : ''}
            ${!i.fromLead && i.kind === 'trial' && i.status === 'pending' ? `<button type="button" class="sc-btn sc-btn--sm" data-a="reject" data-id="${esc(i.bookingId)}">Rad etish</button><button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-a="accept" data-id="${esc(i.bookingId)}">Tasdiqlash</button>` : ''}
            ${!i.fromLead && i.kind === 'trial' && i.status === 'confirmed' && (i.date < today() || (i.date === today() && i.end <= U().nowMin())) ? `<button type="button" class="sc-btn sc-btn--sm" data-a="no_show" data-id="${esc(i.bookingId)}">Lid kelmadi</button><button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-a="done" data-id="${esc(i.bookingId)}">O'tkazildi</button>` : ''}
            ${i.kind === 'makeup' ? (() => { const m = mk.find(x => x.booking_id === i.bookingId); return m && (i.date < today() || (i.date === today() && i.end <= U().nowMin())) ? `<button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-held="${esc(m.id)}">O'tildi</button>` : ''; })() : ''}</div>`).join('') || '<p class="sc-mt sc-pad">Yo\'q</p>'}</section>
          <section class="sc-card"><header class="sc-ch"><h2>Mening so'rovlarim</h2></header>${reqs.map(r => `<div class="sc-it"><span class="sc-grow"><b>${esc(r.type)}</b><small>${esc(r.reason)}</small></span><span class="sc-pill ${r.status === 'approved' ? 'sc-pill--ok' : r.status === 'rejected' ? 'sc-pill--bad' : 'sc-pill--warn'}">${r.status === 'approved' ? 'Tasdiqlandi' : r.status === 'rejected' ? 'Rad etildi' : 'Kutilmoqda'}</span></div>`).join('') || '<p class="sc-mt sc-pad">So\'rov yo\'q</p>'}</section>`;
        body.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => { try { await U().post(`/bookings/${b.dataset.id}/${b.dataset.a}`); U().toast('Saqlandi'); reload(); } catch (e) { U().toast(e.message, 4000); } });
        body.querySelectorAll('[data-trials]').forEach(b => b.onclick = () => typeof switchTab === 'function' && switchTab('trial-lessons'));
        body.querySelectorAll('[data-held]').forEach(b => b.onclick = async () => { try { await U().post(`/makeups/${b.dataset.held}/held`); U().toast('Tekshiruvga yuborildi'); reload(); } catch (e) { U().toast(e.message, 4000); } });
    }

    window.schoolSchedule = { render, state, makeupDrawer, canPickLang, _: { overrideDrawer, hoursDrawer, teacherRequestDrawer } };
})();
