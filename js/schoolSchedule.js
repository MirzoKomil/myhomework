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
        // Sotuv menejeri: SotuvJadval (js/sotuvSinov.js) — KPI, ustozlar bo'yicha kun, "+ Sinov darsi qo'yish".
        if (r === 'sales_manager' && window.sotuvSinov && state.view === 'free') return window.sotuvSinov.renderJadval(root);
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
        try { await fn(body, () => render(root)); } catch (e) { body.innerHTML = window.LoadErr.html({ title: 'Ma\'lumotni yuklab bo\'lmadi', err: e, note: '' }); window.LoadErr.bind(body, () => render(root)); }
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
    // Bo'sh vaqt o'zgarishi band yozuvlarga tegsa server 409 + conflicts qaytaradi: ro'yxat ko'rsatiladi,
    // tugma "Baribir saqlash" bo'ladi (JadvalQoidalar: "Ish vaqti qisqartirilsa — darslar ro'yxati, tasdiqsiz saqlanmaydi").
    const KIND_L = { lesson: 'dars', makeup: 'qoplash', trial: 'sinov' };
    function showConflicts(host, err, btn) {
        const list = err?.data?.conflicts;
        if (!err?.data?.needConfirm || !Array.isArray(list)) return false;
        const { esc, hm, fmtDate } = U();
        host.querySelector('.sc-err')?.setAttribute('hidden', '');
        let el = host.querySelector('[data-conf]');
        if (!el) { el = document.createElement('div'); el.dataset.conf = ''; el.className = 'sc-note sc-note--warn ss-conf'; el.setAttribute('role', 'alert'); (host.querySelector('.sc-db') || host).prepend(el); }
        el.innerHTML = `<b>${esc(err.message)}</b><ul>${list.slice(0, 12).map(c => `<li>${esc(fmtDate(c.date))} ${hm(c.start)}–${hm(c.end)} · ${esc(c.name || '—')} · ${KIND_L[c.kind] || c.kind}</li>`).join('')}${list.length > 12 ? `<li>yana ${list.length - 12} ta</li>` : ''}</ul>`;
        if (btn) { btn.disabled = false; btn.textContent = 'Baribir saqlash'; btn.dataset.label = 'Baribir saqlash'; }
        el.scrollIntoView({ block: 'nearest' });
        return true;
    }
    function overrideDrawer(teacherId, done) {
        const { openDrawer, field, today, esc, DAY_FULL } = U();
        const box = openDrawer({ title: 'Vaqtni ochish / yopish', sub: esc(U().teacherName(teacherId)), body: `
            <div class="sc-sec"><h3>Tur</h3><div class="sc-chips">${[['close', 'Sinovga yopish'], ['open', 'Qo\'shimcha ochish'], ['makeup_only', 'Faqat qoplash'], ['leave', 'Ish vaqtidan chiqarish']].map(([k, l], i) => `<label class="sc-chip"><input type="radio" name="kind" value="${k}"${i === 0 ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
            <div class="sc-sec"><h3>Qachon</h3><div class="sc-chips"><label class="sc-chip"><input type="radio" name="rep" value="once" checked><span>Faqat shu sana</span></label><label class="sc-chip"><input type="radio" name="rep" value="weekly"><span>Har hafta</span></label></div>
              <div class="sc-g2 sc-mtop">${field('Sana', `<input type="date" name="date" value="${today()}" min="${today()}">`)}${field('Hafta kuni', `<select name="weekday" disabled>${DAY_FULL.map((d, i) => `<option value="${i + 1}">${d}</option>`).join('')}</select>`)}
              ${field('Boshlanish', '<input name="from" inputmode="numeric" maxlength="5" pattern="[0-2][0-9]:[0-5][0-9]" placeholder="00:00" value="09:00">')}${field('Tugash', '<input name="to" inputmode="numeric" maxlength="5" pattern="[0-2][0-9]:[0-5][0-9]" placeholder="00:00" value="11:00">', 'Butun kun: 00:00 – 24:00')}</div></div>
            ${field('Sabab (ustoz va sotuv ko\'radi)', '<textarea name="reason" rows="2" placeholder="Masalan: metodik seminar"></textarea>')}
            <div class="sc-note">Yopilgan vaqtga yangi sinov qo'yilmaydi. Shu vaqtda dars yoki sinov bo'lsa — ro'yxati ko'rsatiladi, tasdiqlasangiz saqlanadi.</div>`,
            foot: '<button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Saqlash</button>' });
        const rep = () => box.querySelector('[name=rep]:checked').value;
        let confirm = false;
        const reset = () => { if (!confirm) return; confirm = false; box.querySelector('[data-conf]')?.remove(); const b = box.querySelector('[data-save]'); b.textContent = 'Saqlash'; b.dataset.label = 'Saqlash'; };
        box.querySelectorAll('input,select,textarea').forEach(el => el.addEventListener('change', reset));
        box.querySelectorAll('[name=rep]').forEach(r => r.onchange = () => { reset(); box.querySelector('[name=date]').disabled = rep() === 'weekly'; box.querySelector('[name=weekday]').disabled = rep() !== 'weekly'; });
        box.querySelector('[data-save]').onclick = async e => {
            const v = n => box.querySelector(`[name=${n}]`).value;
            U().busy(e.target, true);
            try { await U().post('/overrides', { teacherId, kind: box.querySelector('[name=kind]:checked').value, repeat: rep(), date: v('date'), weekday: Number(v('weekday')), from: v('from'), to: v('to'), reason: v('reason'), confirm }); U().toast('Saqlandi'); U().closeDrawer(); done(); }
            catch (err) { U().busy(e.target, false); if (showConflicts(box, err, e.target)) confirm = true; else U().errBox(box, err.message); }
        };
    }
    // Ish vaqti shabloni ("Tahrirlash"): har hafta kuni uchun bir nechta oraliq, har biri sinovga ochiq / yopiq.
    // Mavjud oraliqlar to'liq saqlanadi (avval faqat birinchisi ko'rinardi va saqlashda qolganlari o'chib ketardi).
    async function hoursDrawer(teacherId, done) {
        const { openDrawer, esc, DAY_FULL, hm } = U();
        let hours = [];
        try { hours = (await U().api(`/teachers/${encodeURIComponent(teacherId)}/hours`)).hours; } catch (e) { return U().toast(e.message); }
        const iv = (d, h) => `<div class="ss-iv" data-iv="${d}"><input inputmode="numeric" maxlength="5" pattern="[0-2][0-9]:[0-5][0-9]" placeholder="00:00" name="f" value="${h ? hm(h.start_min) : '10:00'}" aria-label="${DAY_FULL[d - 1]}: boshlanish"> – <input inputmode="numeric" maxlength="5" pattern="[0-2][0-9]:[0-5][0-9]" placeholder="00:00" name="t" value="${h ? hm(h.end_min) : '20:00'}" aria-label="${DAY_FULL[d - 1]}: tugash">
            <label class="sc-chip"><input type="checkbox" name="tr"${!h || h.trial_open !== false ? ' checked' : ''}><span>sinovga ochiq</span></label><button type="button" class="sc-btn sc-btn--sm" data-rm aria-label="Oraliqni o'chirish">×</button></div>`;
        const row = d => { const hs = hours.filter(x => Number(x.weekday) === d); return `<div class="ss-hr ss-hday" data-day="${d}"><label class="sc-chip"><input type="checkbox" name="on${d}"${hs.length ? ' checked' : ''}><span>${DAY_FULL[d - 1]}</span></label>
            <div class="ss-ivs">${(hs.length ? hs : [null]).map(h => iv(d, h)).join('')}<button type="button" class="sc-link" data-add="${d}">+ oraliq</button></div></div>`; };
        const box = openDrawer({ title: 'Ish vaqti shabloni', sub: esc(U().teacherName(teacherId)) + ' · har hafta takrorlanadi', body: `${[1, 2, 3, 4, 5, 6, 7].map(row).join('')}
            <div class="sc-note">Belgilanmagan kun — dam olish. Sotuv menejerlari faqat "sinovga ochiq" bo'sh vaqtlarni ko'radi. Tanaffus uchun kunni ikki oraliqqa bo'ling.</div>`,
            foot: '<button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Saqlash</button>' });
        let confirm = false;
        const reset = () => { if (!confirm) return; confirm = false; box.querySelector('[data-conf]')?.remove(); const b = box.querySelector('[data-save]'); b.textContent = 'Saqlash'; b.dataset.label = 'Saqlash'; };
        const sync = () => box.querySelectorAll('[data-day]').forEach(r => { const on = r.querySelector('[name^=on]').checked; r.querySelectorAll('.ss-iv input, .ss-iv button, [data-add]').forEach(x => { x.disabled = !on; }); r.classList.toggle('is-off', !on); });
        box.addEventListener('change', reset); box.addEventListener('change', sync);
        box.addEventListener('click', e => {
            const add = e.target.closest('[data-add]'), rm = e.target.closest('[data-rm]');
            if (add) { add.insertAdjacentHTML('beforebegin', iv(Number(add.dataset.add), { start_min: 17 * 60, end_min: 20 * 60, trial_open: true })); reset(); }
            if (rm) { const list = rm.closest('.ss-ivs'); if (list.querySelectorAll('.ss-iv').length > 1) rm.closest('.ss-iv').remove(); else list.closest('[data-day]').querySelector('[name^=on]').checked = false; reset(); sync(); }
        });
        sync();
        box.querySelector('[data-save]').onclick = async e => {
            const slots = [];
            for (const r of box.querySelectorAll('[data-day]')) {
                if (!r.querySelector('[name^=on]').checked) continue;
                for (const x of r.querySelectorAll('.ss-iv')) { slots.push({ weekday: Number(r.dataset.day), from: x.querySelector('[name=f]').value, to: x.querySelector('[name=t]').value, trialOpen: x.querySelector('[name=tr]').checked }); }
            }
            U().busy(e.target, true);
            try { await U().api(`/teachers/${encodeURIComponent(teacherId)}/hours`, { method: 'PUT', body: { slots, confirm } }); U().toast('Ish vaqti saqlandi'); U().closeDrawer(); done(); }
            catch (err) { U().busy(e.target, false); if (showConflicts(box, err, e.target)) confirm = true; else U().errBox(box, err.message); }
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
          ${list.map(m => `<tr><td><button type="button" class="sc-link" data-st="${esc(m.student_id)}">${esc(U().studentById(m.student_id)?.name || m.student_id)}</button></td><td>${esc(U().teacherName(m.teacher_id, true))}</td><td>${esc(fmtDate(String(m.missed_date).slice(0, 10)))}${U().missedCamePill(m)}</td><td>${m.held_date ? esc(fmtDate(String(m.held_date).slice(0, 10))) : '—'}</td><td>${m.kind === 'double' ? 'Qo\'shaloq' : 'Alohida'}</td>
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
    // ── Qoplash darsi (Oynalar: USTOZ · DARS JADVALI → QOPLASH DARSI) — markazdagi oyna ──
    // Qoldirilgan dars faqat "Kelmadi" deb belgilangan, hali qoplanmagan darslar ro'yxatidan tanlanadi
    // (sana qo'lda kiritilmaydi). Ustozga faqat o'z o'quvchilari (server ham tekshiradi: POST /bookings).
    // opts.studentId — kartadan/ro'yxatdan; opts.date + opts.start — Dars jadvalidagi bo'sh joy.
    // Vaqt berilmasa shu oydagi eng yaqin bo'sh vaqt taklif qilinadi, boshqasini Dars jadvalidan tanlash mumkin.
    const MON3 = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const dMon = d => `${Number(d.slice(8, 10))}-${MON3[Number(d.slice(5, 7)) - 1]}`;
    async function makeupDrawer(done, opts = {}) {
        const u = U(); const { esc, today, hm, DAY_FULL, pattern, addDays, wd, nowMin } = u;
        const me = getCurrentUser() || {};
        const teacher = me.role === 'teacher';
        const pool = (getItem(STORAGE_KEYS.students, []) || []).filter(s => !s.isStaffDemo && !s.frozen && s.status !== 'inactive' && s.teacherId
            && (!teacher || s.teacherId === me.linkedTeacherId));
        const dlg = u.openDialog({ title: 'Qoplash darsi', sub: 'Yuklanmoqda…', body: '<p class="oqm-mt">Yuklanmoqda…</p>',
            foot: '<button type="button" class="oqm-btn" data-close>Bekor</button><button type="button" class="oqm-btn is-pri" data-save disabled>Rejaga qo\'yish</button>' });
        const body = dlg.querySelector('.oqm-db'), save = dlg.querySelector('[data-save]');
        const fail = msg => { body.innerHTML = `<div class="oqm-err" role="alert">${esc(msg)}</div>`; dlg.querySelector('[data-dsub]').textContent = ''; };
        const month = (opts.date || today()).slice(0, 7);
        const monthEnd = addDays(addDays(month + '-01', 32).slice(0, 7) + '-01', -1);
        try {
            // "Kelmadi" belgilari va qoplashlar — server rol bo'yicha cheklaydi (ustoz — faqat o'ziniki).
            const sid0 = opts.studentId && pool.find(s => s.id === opts.studentId);
            if (opts.studentId && !sid0) return fail('Bu o\'quvchi sizga biriktirilmagan — qoplash faqat o\'z o\'quvchilaringiz uchun');
            const tq = !teacher && sid0 ? `&teacherId=${encodeURIComponent(sid0.teacherId)}` : '';
            // Qoplanmagan darslar — server /attendance/missed (S.missedLessons: "Keldi" ustun, faqat dars kuni, o'quvchi faol kun,
            // kelajak yo'q) — Bosh sahifa va qoplash yozish tekshiruvi bilan bitta manba (xom "Kelmadi" ro'yxati emas).
            const [ms, mk] = await Promise.all([u.api(`/attendance/missed?month=${month}${tq}`), u.api(teacher ? '/makeups' : `/makeups?month=${month}`)]);
            const covered = new Map((mk.makeups || []).filter(m => ['planned', 'review', 'approved'].includes(m.status)).map(m => [`${m.student_id}|${String(m.missed_date || '').slice(0, 10)}`, m]));
            const missedOf = sid => [...new Set((ms.missed || []).filter(a => a.studentId === sid && a.date <= today()).map(a => a.date))].sort()
                .map(day => ({ day, mk: covered.get(`${sid}|${day}`) || null }));
            const st = sid0 || pool.find(s => missedOf(s.id).some(m => !m.mk)) || null;
            if (!st) return fail(`Bu oyda qoplanmagan dars yo'q — "Kelmadi" deb belgilangan dars bo'lsa, shu yerda chiqadi`);
            const dur = Number(st.lessonDuration) || 30;
            // Faqat qoplash mumkin bo'lganlar (dizayndagidek); qoplangan/rejalashtirilganlar ro'yxatda chiqmaydi.
            const list = missedOf(st.id).filter(m => !m.mk);
            // Vaqt: jadvaldan berilgan bo'sh joy yoki shu oydagi eng yaqin bo'sh vaqt.
            let slot = opts.date && opts.start != null ? { date: opts.date, start: Number(opts.start), picked: true } : null;
            const [att] = await Promise.all([
                u.api(`/students/${encodeURIComponent(st.id)}/attendance?month=${month}`).catch(() => null),
                slot ? null : (async () => {
                    const from = today() > month + '-01' ? today() : month + '-01';
                    if (from > monthEnd) return;
                    const d = await u.api(`/schedule?from=${from}&to=${monthEnd}${teacher ? '' : `&teacherId=${encodeURIComponent(st.teacherId)}${L()}`}`);
                    // Qoplash faqat o'quvchining dars kuni bo'lmagan kunga (UstozYoriqnoma "Qoplash darsi qoidalari"; server ham tekshiradi).
                    const ld = Number(st.lessonDayOfWeek), lessonWd = [1, 3, 5].includes(ld) ? [1, 3, 5] : [2, 4, 6].includes(ld) ? [2, 4, 6] : [ld];
                    for (const v of (d.views || []).filter(x => x.teacherId === st.teacherId && !lessonWd.includes(wd(x.date))).sort((a, b) => a.date.localeCompare(b.date))) {
                        const lo = v.date === today() ? nowMin() + 15 : 0;
                        for (const f of v.makeupFree || []) {
                            const s = Math.ceil(Math.max(f.start, lo) / 15) * 15;
                            if (s + dur <= f.end) { slot = { date: v.date, start: s, picked: false }; return; }
                        }
                    }
                })()
            ]);
            // Bu oy: rejada · hisobga o'tgan (+ tekshiruvda) — davomat qoidasi bilan bir xil (rejadan oshmaydi).
            let plan = 0, counted = 0, review = 0;
            if (att) {
                plan = (att.lessonDays || []).length;
                const present = new Set((att.lessonDays || []).filter(d => att.entries?.[Number(d.slice(8))]?.present).map(d => d));
                counted = present.size;
                for (const m of att.makeups || []) {
                    if (m.status === 'review') review++;
                    if (m.status !== 'approved' || String(m.held || '').slice(0, 7) !== month) continue;
                    if (m.kind === 'double') counted++; else if (!present.has(m.held)) { present.add(m.held); counted++; }
                }
                counted = Math.min(counted, plan);
            }
            const head = slot ? `Qoplash darsi · ${dMon(slot.date)}, ${DAY_FULL[wd(slot.date) - 1]}` : 'Qoplash darsi';
            dlg.querySelector('#oqmTitle').textContent = head;
            dlg.querySelector('[data-dsub]').textContent = `${st.name} · ${pattern(st.lessonDayOfWeek)} ${st.lessonTime || ''} · ${dur} daq`.replace(/\s+·/g, ' ·');
            const firstOpen = list.find(m => !m.mk);
            const mkTxt = m => m.mk.status === 'approved' ? 'allaqachon qoplangan' : m.mk.status === 'review' ? 'qoplangan · tekshiruvda'
                : `allaqachon rejalashtirilgan${m.mk.held_date ? ' · ' + dMon(String(m.mk.held_date).slice(0, 10)) : ''}`;
            const opt = m => `<label class="oqm-opt${m.mk ? ' is-off' : ''}"><input type="radio" name="miss" value="${esc(m.day)}"${m === firstOpen ? ' checked' : ''}${m.mk ? ' disabled' : ''}><span class="oqm-radio" aria-hidden="true"></span>
                <span class="oqm-tx"><span class="oqm-nm">${dMon(m.day)}, ${DAY_FULL[wd(m.day) - 1]}</span><span class="oqm-mt">${m.mk ? esc(mkTxt(m)) : 'kelmagan · hali qoplanmagan'}</span></span>${m.mk ? '' : '<span class="oqm-pill is-teal">Qoplash mumkin</span>'}</label>`;
            const timeTxt = slot ? `Vaqt: <b>${hm(slot.start)}–${hm(slot.start + dur)}</b> (bo'sh, sotuvga yopiladi).` : `Vaqt: <b>${esc(MON3[Number(month.slice(5)) - 1])} oxirigacha bo'sh vaqt yo'q</b>.`;
            const statTxt = att ? ` Bu oy: rejada ${plan} · hisobga o'tgan ${counted}${review ? ` (+${review} tekshiruvda)` : ''} · ko'pi bilan <b>${plan}</b> gacha.` : '';
            const other = !opts.date ? ` <button type="button" class="oqm-link" data-other>${slot ? 'Boshqa vaqt' : 'Vaqtni'} — Dars jadvalidan tanlash</button>` : '';
            body.innerHTML = `<div class="oqm-fl">Qaysi qoldirilgan dars o'rniga?</div>
                ${list.length ? list.map(opt).join('') : '<div class="oqm-box">Bu oyda qoplanmagan dars yo\'q — qoplash faqat "Kelmadi" deb belgilangan dars uchun.</div>'}
                <div class="oqm-box">${timeTxt}${statTxt}${other}</div>
                <div class="oqm-rule">Dars o'tgach "Keldi" desangiz holati <b>"Tekshiruvda"</b> bo'ladi. Admin tasdiqlagach dars maoshga qo'shiladi; rad etilsa — qo'shilmaydi.</div>`;
            save.disabled = !slot || !firstOpen;
            body.querySelector('[data-other]')?.addEventListener('click', () => {
                state.makeupFor = st.id; u.closeDrawer();
                if (typeof switchTab === 'function') switchTab('timetable');
            });
            save.onclick = async () => {
                const missedDate = body.querySelector('[name=miss]:checked')?.value;
                if (!missedDate) return u.errBox(dlg, 'Qaysi dars o\'rniga ekanini tanlang');
                u.busy(save, true);
                try {
                    await u.post('/makeups/plan', { kind: 'makeup', teacherId: st.teacherId, studentId: st.id, date: slot.date, time: hm(slot.start), duration: dur, missedDate });
                    state.makeupFor = null; u.toast('Qoplash rejaga qo\'yildi'); u.closeDrawer(); done?.();
                } catch (err) { u.busy(save, false); u.errBox(dlg, err.message); }
            };
        } catch (e) { fail(e.message); }
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

    window.schoolSchedule = { render, state, makeupDrawer, canPickLang, _: { overrideDrawer, hoursDrawer, teacherRequestDrawer, showConflicts } };
})();
