// "Faol emas" va "Tugatgan" kartalari — UstozOquvchiArxiv, YordamchiOquvchiArxiv, SotuvOquvchiArxiv.
// Muzlatilgan / boshqa ustozga o'tgan / chiqib ketgan o'quvchilar holat bo'yicha kartalarda; kursni
// tugatganlar (server: state='finished') — alohida "Tugatgan" yorlig'ida.
// Ustoz va yordamchi — faqat o'z davri, pul yo'q (server ham bermaydi). Sotuv — o'zi sotganlar:
// "O'zgarishlar" (ustozi almashgan) yorlig'i, "Qaytish oldidan eslatma" va "Qayta jalb · Qo'ng'iroq qildim".
(function () {
    'use strict';
    const U = () => window.schoolUI;
    const role = () => (typeof getCurrentUser === 'function' ? getCurrentUser()?.role : '') || '';
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const ddmm = d => (d ? `${String(d).slice(8, 10)}.${String(d).slice(5, 7)}` : '');
    const dLong = d => (d ? `${Number(String(d).slice(8, 10))}-${MON[Number(String(d).slice(5, 7)) - 1]}` : '—');
    const adviceOf = day => ([1, 3, 5].includes(Number(day)) ? 'Se·Pa·Sh' : 'Du·Ch·Ju');
    const COURSE = 72;

    // root — sahifa ichidagi konteyner; opts.active — "Faol" soni, opts.onBack — "Faol" tugmasi,
    // opts.tab — 'inactive' (standart) | 'finished' | 'changes' (faqat sotuv).
    async function render(root, opts = {}) {
        const u = U(); if (!u || !root) return;
        const { api, esc } = u;
        root.innerHTML = '<div class="sc-skel"></div>';
        let data;
        try { data = await api('/inactive'); } catch (e) { root.innerHTML = window.LoadErr.html({ title: 'Arxiv ro\'yxatini yuklab bo\'lmadi', err: e, note: '' }); window.LoadErr.bind(root, () => render(root, opts)); return; }
        if (!root.isConnected) return;
        draw(root, opts, data);
    }

    function draw(root, opts, data) {
        const u = U();
        const { esc, studentAvatar, addDays, today, dShort, shortName } = u;
        const sales = role() === 'sales_manager', manage = ['admin', 'boshliq', 'rop'].includes(role());
        const followups = sales || manage;
        const td = today();
        const all = data.students || [], changed = sales ? (data.changed || []) : [];
        const fin = all.filter(s => s.state === 'finished');
        const list = sales ? all : all.filter(s => s.state !== 'finished');
        const assistant = all.length && all.every(s => s.role === 'assistant');
        let tab = opts.tab === 'finished' && !sales ? 'finished' : opts.tab === 'changes' && sales ? 'changes' : 'inactive';
        const sched = s => `${esc(s.schedule?.days || '')} ${esc(s.schedule?.time || '')}`.trim();
        const lastDay = s => (s.from ? addDays(s.from, -1) : null);
        const conMonths = s => Object.entries(s.contacts?.byMonth || {}).sort().map(([m, n]) => `${MON[Number(m.slice(5)) - 1]} ${n} ta`);
        const finNote = s => String(s.reason || '').replace(/^Kursni tugatdi:?\s*/i, '').trim();
        const rowsFor = s => {
            const r = [];
            const start = s.withMe?.from || s.startDate;
            if (sales) {
                if (s.state === 'frozen') {
                    const back = s.to ? addDays(s.to, 1) : null, left = back ? Math.round((Date.parse(back) - Date.parse(td)) / 864e5) : null;
                    r.push(['Ustoz', `${esc(shortName(s.teacherName))} · ${sched(s)}`]);
                    if (back) r.push(['Qaytadi', `${esc(dLong(back))}${left > 0 ? ` · ${left} kun qoldi` : left === 0 ? ' · bugun' : ''}`]);
                    if (s.paymentShift) r.push(['To\'lov', `keyingi ${esc(dShort(s.paymentShift.from))} → ${esc(dShort(s.paymentShift.to))} ga surilgan`]);
                    else if (s.paymentDueDate) r.push(['To\'lov', `keyingi ${esc(dShort(s.paymentDueDate))}`]);
                    if (s.reason) r.push(['Sabab', esc(s.reason)]);
                    if (s.reminder) r.push(['Eslatma', `${esc(dLong(s.reminder.due))} · qo'ng'iroq qilasiz${s.reminder.note ? ' · ' + esc(s.reminder.note) : ''}`]);
                } else if (s.state === 'left' || s.state === 'finished') {
                    r.push([s.state === 'finished' ? 'Kurs' : 'O\'qigan', [(start || s.from) && `${start ? ddmm(start) + ' ' : ''}→ ${ddmm(lastDay(s))}`, s.lessons ? `${s.lessons} dars` : '', s.teacherName && esc(shortName(s.teacherName))].filter(Boolean).join(' · ') || '—']);
                    if (s.state === 'finished') { if (finNote(s)) r.push(['Izoh', esc(finNote(s))]); }
                    else if (s.reason) r.push(['Sabab', esc(s.reason)]);
                    if (s.state === 'left' && s.winback) {
                        const due = s.winback.due, late = due < td, now = due === td;
                        r.push(['Qayta jalb', `${esc(dLong(due))} qo'ng'iroq ${now ? 'bugun' : late ? 'kechikdi' : 'rejada'}${s.lastCall ? ` · oxirgisi ${esc(dShort(s.lastCall.day))}${s.lastCall.note ? ' — ' + esc(s.lastCall.note) : ''}` : ''}`]);
                    }
                } else r.push(['Hozir', `${esc(shortName(s.teacherName))} · ${sched(s)}`]);
                return r;
            }
            if (s.role === 'assistant') {
                // Chiqib ketgan / tugatgan o'quvchida "Asosiy" qatori yo'q (YordamchiOquvchiArxiv dizayni) — faqat muzlatilganda.
                if (s.state !== 'left' && s.state !== 'finished') r.push(['Asosiy', `${esc(shortName(s.teacherName))} · ${sched(s)}`]);
                const until = s.state === 'left' || s.state === 'finished' ? lastDay(s) : s.contacts?.last;
                r.push(['Siz bilan', `${start ? ddmm(start) + ' → ' : ''}${until ? ddmm(until) : ''}${s.contacts?.total ? ` · ${s.contacts.total} aloqa` : ''}` || '—']);
                if (s.state === 'frozen') {
                    // Shu oy ichida qaytsa — "qaytguncha", aks holda shu oyda tavsiya umuman yo'q.
                    const back = s.to ? addDays(s.to, 1) : null, monEnd = addDays(addDays(td.slice(0, 8) + '01', 32).slice(0, 8) + '01', -1);
                    r.push(['Holat', back && back <= monEnd ? 'aloqalar to\'xtatilgan · qaytguncha tavsiya yo\'q' : `aloqalar to'xtatilgan · ${MON[Number(td.slice(5, 7)) - 1]}da tavsiya yo'q`]);
                    if (s.to) r.push(['Qaytadi', `${esc(dLong(addDays(s.to, 1)))} · tavsiya ${adviceOf(s.schedule?.day)} ${esc(s.schedule?.time || '')} tiklanadi`]);
                } else if (s.state === 'left' || s.state === 'finished') {
                    const cm = conMonths(s); if (cm.length) r.push(['Aloqalar', esc(cm.join(' · '))]);
                }
                if (s.state === 'finished') { if (finNote(s)) r.push(['Izoh', esc(finNote(s))]); }
                else if (s.reason) r.push(['Sabab', esc(s.reason)]);
                return r;
            }
            if (s.state === 'moved') {
                // Dizayn: "01.09 → 14.10 · Du·Ch·Ju 18:00" — siz bilan davr va dars jadvali.
                r.push(['Siz bilan', `${s.withMe ? `${ddmm(s.withMe.from)} → ${ddmm(s.withMe.to)}` : ''}${s.schedule?.days ? ' · ' + sched(s) : ''}`]);
                r.push(['O\'tilgan', `${s.lessons || 0} dars siz bilan`]);
                if (s.reason) r.push(['Sabab', esc(s.reason)]);
                r.push(['Hozir', `${esc(shortName(s.teacherName))} · ma'lumotlari endi unda`]);
                return r;
            }
            if (s.state === 'finished') {
                r.push(['Siz bilan', `${start ? ddmm(start) + ' → ' : ''}${ddmm(lastDay(s))}${s.schedule?.days ? ' · ' + sched(s) : ''}`]);
                r.push(['O\'tilgan', `${s.lessons || 0} dars siz bilan${s.reached != null ? ` · ilovada ${s.reached} / ${COURSE}` : ''}`]);
                if (finNote(s)) r.push(['Izoh', esc(finNote(s))]);
                return r;
            }
            r.push(['Siz bilan', `${start ? ddmm(start) + ' → ' : ''}${s.state === 'left' ? ddmm(lastDay(s)) : ''}${s.state === 'frozen' ? ' · ' + sched(s) : ''}`]);
            r.push(['O\'tilgan', `${s.lessons || 0} dars${s.reached != null && s.state === 'frozen' ? ` · ilovada ${s.reached} / ${COURSE}` : ''}`]);
            if (s.reason) r.push(['Sabab', esc(s.reason)]);
            if (s.state === 'frozen' && s.to) r.push(['Qaytadi', `${esc(dLong(addDays(s.to, 1)))} · ${sched(s)} siz uchun saqlangan, hozircha faqat sinovlarga beriladi`]);
            return r;
        };
        const pill = s => s.state === 'frozen' ? `<span class="sc-pill sc-pill--info">Muzlatilgan · ${esc(dShort(s.from))}${s.to ? ' → ' + esc(dShort(s.to)) : ''}</span>`
            : s.state === 'left' ? `<span class="sc-pill sc-pill--bad">Chiqib ketgan${s.from ? ' · ' + esc(dShort(s.from)) : ''}</span>`
            : s.state === 'finished' ? `<span class="sc-pill sc-pill--ok">Kursni tugatgan${s.from ? ' · ' + esc(dShort(lastDay(s))) : ''}</span>`
            // O'tgan kun qoidasi: "X.ga o'tdi" sanasi — yangi ustoz boshlagan kun (siz bilan oxirgi kundan keyingi kun).
            : `<span class="sc-pill sc-pill--mute">${esc(shortName(s.teacherName))}ga o'tdi · ${esc(dShort(addDays(s.withMe?.to || s.from, 1)))}</span>`;
        // Sotuv/admin: eslatma va qo'ng'iroq tugmalari (serverda ham tekshiriladi — faqat o'zi sotgan o'quvchi).
        const actsFor = s => {
            if (!followups) return '';
            if (s.state === 'frozen' && s.to) return s.reminder
                ? `<button type="button" class="sc-btn" data-fu-cancel="${esc(s.reminder.id)}">Eslatmani bekor qilish</button>`
                : `<button type="button" class="sc-btn" data-fu-rem="${esc(s.id)}" data-due="${esc(addDays(s.to, 0) < td ? td : s.to)}">Qaytish oldidan eslatma</button>`;
            if (s.state === 'left') return `<button type="button" class="sc-btn sc-btn--pri" data-fu-call="${esc(s.id)}">Qo'ng'iroq qildim</button>`;
            return '';
        };
        const card = (s, top, rows, acts = '') => `<article class="ar-card" data-card="${esc(s.id)}"><div class="ar-top">${studentAvatar(s, 40)}<span><button type="button" class="sc-link ar-name" data-st="${esc(s.id)}">${esc(s.name)}</button>${top}</span></div>
            <dl class="ar-dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>${acts ? `<div class="ar-acts">${acts}</div>` : ''}</article>`;
        const sec = (title, items) => items.length ? `<h3 class="ar-sec">${title}</h3><div class="ar-grid">${items.join('')}</div>` : '';
        const by = st => list.filter(s => s.state === st).map(s => card(s, pill(s), rowsFor(s), actsFor(s)));
        const chg = changed.map(s => card(s, `<span class="sc-pill sc-pill--warn">${esc(shortName(s.fromName))} → ${esc(shortName(s.teacherName))} · ${esc(dShort(s.date))}</span>`,
            [s.reason && ['Sabab', esc(s.reason)], ['Hozir', `${esc(shortName(s.teacherName))} · ${sched(s)} · faol`], s.group?.name && ['Guruh', esc(s.group.name)]].filter(Boolean),
            s.group?.link ? `<a class="sc-btn" href="${esc(s.group.link)}" target="_blank" rel="noopener">Guruhni ochish</a>` : ''));
        const inN = list.length, finN = fin.length;
        const showFin = !sales && (finN > 0 || !assistant);
        const foot = sales ? (tab === 'changes' ? 'Ustozi oxirgi 30 kunda almashgan faol o\'quvchilar — ma\'lumot uchun. Guruhga yangi ustoz qo\'shilganini tekshiring.'
                : 'Faol bo\'lmaganlar faol o\'quvchilar soni va konversiyaga qo\'shilmaydi. Muzlatilgan o\'quvchi qaytganda avtomatik "Faol"ga o\'tadi. Eslatma kuni bildirishnomalarda chiqadi.')
            : tab === 'finished' ? (assistant ? 'Kursni tugatgan o\'quvchilar bilan aloqa belgilanmaydi. Aloqalar tarixi saqlanadi.' : 'Kursni tugatgan o\'quvchilar bugungi darslar, davomat foizi va reytingga qo\'shilmaydi. To\'lov, tarif va sotuv ma\'lumotlari ko\'rsatilmaydi.')
            : assistant ? 'Muzlatilgan o\'quvchida aloqalar to\'xtaydi va tavsiya chiqmaydi; qaytganda o\'zi tiklanadi.'
            : `To'lov, tarif va sotuv ma'lumotlari ko'rsatilmaydi.${finN ? ` Tugatgan ${finN} — alohida yorliqda.` : ''} Muzlatilgan o'quvchi qaytganda avtomatik "Faol"ga o'tadi.`;
        let body;
        if (tab === 'finished') body = finN ? sec('Kursni tugatgan', fin.map(s => card(s, pill(s), rowsFor(s)))) : '<p class="sc-mt ar-empty">Kursni tugatgan o\'quvchi hali yo\'q</p>';
        else if (tab === 'changes') body = chg.length ? sec('Ustozi almashgan · faol, ma\'lumot uchun', chg) : '<p class="sc-mt ar-empty">Oxirgi 30 kunda o\'zgarish yo\'q</p>';
        else body = inN || chg.length ? sec('Muzlatilgan', by('frozen')) + sec('Boshqa ustozga o\'tgan', by('moved')) + sec('Ustozi almashgan · faol, ma\'lumot uchun', chg) + sec('Chiqib ketgan', by('left')) + sec('Kursni tugatgan', by('finished'))
            : '<p class="sc-mt ar-empty">Faol bo\'lmagan o\'quvchi yo\'q</p>';
        const segBtn = (k, label) => `<button type="button" data-artab="${k}" aria-pressed="${tab === k}">${label}</button>`;
        if (opts.page === 'admin') return drawAdmin(root, opts, data);
        if (opts.page === 'teacher' || opts.page === 'assistant') {
            // UstozOquvchiArxiv / YordamchiOquvchiArxiv — sahifa sarlavhasi bilan (css/oquvchilar.css, .oq-*).
            const asg = opts.page === 'assistant';
            const pillO = s => pill(s).replace('sc-pill sc-pill--', 'oq-pill is-');
            const arc = s => `<div class="oq-arc"><div class="oq-who"><span class="oq-av" style="width:40px;height:40px">${studentAvatar(s, 40)}</span><div><button type="button" class="oq-nm" data-st="${esc(s.id)}">${esc(s.name)}</button>${pillO(s)}</div></div>
                <dl class="oq-kv8">${rowsFor(s).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>`;
            const sect = (title, items) => items.length ? `<div class="oq-sect2">${title}</div><div class="oq-arg">${items.map(arc).join('')}</div>` : '';
            const byO = st => list.filter(s => s.state === st);
            const bodyO = tab === 'finished' ? (finN ? sect('Kursni tugatgan', fin) : '<p class="oq-empty2">Kursni tugatgan o\'quvchi hali yo\'q</p>')
                : inN ? sect('Muzlatilgan', byO('frozen')) + sect('Boshqa ustozga o\'tgan', byO('moved')) + sect('Chiqib ketgan', byO('left')) + sect('Kursni tugatgan', byO('finished'))
                : '<p class="oq-empty2">Faol bo\'lmagan o\'quvchi yo\'q</p>';
            const seg = (k, label, n) => `<button type="button" data-artab="${k}" aria-pressed="${tab === k}">${label} <b>${n}</b></button>`;
            root.innerHTML = `<div class="oq"><div class="oq-head"><div><h1 class="oq-h1">${asg ? 'O\'quvchilarim' : 'O\'quvchilar'}</h1><p class="oq-sub">${asg
                    // Haftalik reja — AttendanceRules.weekPlanCount (Bosh/Davomat/Dars jadvali bilan bitta son); reja kelmasa — raqamsiz.
                    ? `Faol bo'lmaganlar · faqat siz bilan bo'lgan davr · faol bo'lmagan kunlari bugungi tavsiya, haftalik reja${opts.weekPlan != null ? ` (${Number(opts.weekPlan)})` : ''} va maoshga qo'shilmaydi`
                    : 'Faol bo\'lmagan o\'quvchilar · faqat siz bilan bo\'lgan davr · bugungi darslar, davomat foizi, reyting va maoshga qo\'shilmaydi'}</p></div></div>
              <section class="oq-card is-clip" aria-labelledby="oqArT"><div class="oq-ch"><h2 class="oq-ct" id="oqArT">${esc(opts.title || 'Mening o\'quvchilarim')}</h2>
                <div class="oq-seg" role="group" aria-label="Holat">${opts.onBack ? `<button type="button" data-back aria-pressed="false">Faol <b>${esc(String(opts.active ?? ''))}</b></button>` : ''}${seg('inactive', 'Faol emas', inN)}${showFin ? seg('finished', 'Tugatgan', finN) : ''}</div></div>
                <div class="oq-arb">${bodyO}</div><p class="oq-arfoot">${foot}</p></section></div>`;
            root.querySelector('[data-back]')?.addEventListener('click', () => opts.onBack());
            root.querySelectorAll('[data-artab]').forEach(b => b.onclick = () => draw(root, { ...opts, tab: b.dataset.artab }, data));
            root.querySelectorAll('[data-st]').forEach(b => b.onclick = () => u.openStudent(b.dataset.st));
            return;
        }
        root.innerHTML = `<section class="sc-card"><header class="ar-head"><h2>${esc(opts.title || 'Mening o\'quvchilarim')}</h2>
            <div class="sc-seg" role="group" aria-label="Ro'yxat">${opts.onBack ? `<button type="button" data-back aria-pressed="false">Faol${opts.active != null ? ' ' + opts.active : ''}</button>` : ''}${segBtn('inactive', `Faol emas ${inN}`)}${showFin ? segBtn('finished', `Tugatgan ${finN}`) : ''}${sales ? segBtn('changes', `O'zgarishlar ${chg.length}`) : ''}</div></header>
          <div class="ar-body">${body}<p class="ar-foot">${foot}</p></div></section>`;
        root.querySelector('[data-back]')?.addEventListener('click', () => opts.onBack());
        root.querySelectorAll('[data-artab]').forEach(b => b.onclick = () => draw(root, { ...opts, tab: b.dataset.artab }, data));
        root.querySelectorAll('[data-st]').forEach(b => b.onclick = () => u.openStudent(b.dataset.st));
        bindFollowups(root, opts, tab);
    }

    // ── Admin / ROP: O'quvchilar → "Tark etganlar" va "Tamomlaganlar" (11-noyabr, direktor tasdiqlagan) ──
    // Muzlatilganlar bu yerda takrorlanmaydi (o'z bo'limida). Har kartada: ustoz, o'qigan davr, sabab, kim belgilagan,
    // qarz qoldig'i va "Qayta tiklash" (o'quvchi kartasidagi holat oynasi). Tepada: bu oy, jami, qarz, eng ko'p sabablar.
    function drawAdmin(root, opts, data) {
        const u = U();
        const { esc, studentAvatar, addDays, today, dShort, shortName } = u;
        const td = today(), month = td.slice(0, 7);
        const fin = opts.mode === 'finished';
        const all = (data.students || []).filter(s => (fin ? s.state === 'finished' : s.state === 'left'));
        const q = String(opts.q || '').trim().toLowerCase();
        const list = q ? all.filter(s => String(s.name || '').toLowerCase().includes(q) || String(s.teacherName || '').toLowerCase().includes(q)) : all;
        const lastDay = s => (s.from ? addDays(s.from, -1) : null);
        const money = n => `${Math.round(Number(n) || 0).toLocaleString('en-US').replace(/,/g, ' ')} soʻm`;
        const sched = s => `${s.schedule?.days || ''} ${s.schedule?.time || ''}`.trim();
        const finNote = s => String(s.reason || '').replace(/^Kursni tugatdi:?\s*/i, '').trim();
        const ROLE = { admin: 'admin', boshliq: 'direktor', rop: 'ROP', academic_head: 'akademik', teacher: 'ustoz', sales_manager: 'sotuv' };
        const byTxt = s => s.by?.name ? `${esc(s.by.name)}${ROLE[s.by.role] ? ' · ' + ROLE[s.by.role] : ''}` : '—';
        const thisMonth = all.filter(s => String(s.from || '').startsWith(month)).length;
        const debtors = all.filter(s => Number(s.debtAmount) > 0), debtSum = debtors.reduce((n, s) => n + Number(s.debtAmount), 0);
        // Sabablar — formada tanlangan sabab turi bo'yicha (erkin matn emas); tanlanmaganlar hisoblanmaydi.
        const reasons = {}; if (!fin) all.forEach(s => { const r = String(s.reasonCode || '').trim(); if (r && r !== 'finished') reasons[r] = (reasons[r] || 0) + 1; });
        const top = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const tiles = fin
            ? [['Bu oy tugatdi', thisMonth, 'oxirgi dars shu oyda'], ['Jami tugatgan', all.length, 'kursni oxirigacha oʻqigan'],
               ['Ilovada oʻrtacha', all.filter(s => s.reached != null).length ? Math.round(all.reduce((n, s) => n + (Number(s.reached) || 0), 0) / all.filter(s => s.reached != null).length) + ` / ${COURSE}` : '—', 'oʻtilgan dars (ilova)']]
            : [['Bu oy ketdi', thisMonth, `${MON[Number(month.slice(5)) - 1]} oyida chiqib ketgan`], ['Jami chiqib ketgan', all.length, 'faol oʻquvchilar soniga kirmaydi'],
               ['Qarz qoldigʻi', debtSum ? money(debtSum) : '0 soʻm', `${debtors.length} ta oʻquvchida · Qarzdorlar → Ketganlar qarzi`]];
        const tile = ([k, v, h], red) => `<div class="sfx-tile"><small>${esc(k)}</small><b${red ? ' class="dbx-red"' : ''}>${esc(String(v))}</b><span>${esc(h)}</span></div>`;
        const rows = s => {
            const start = s.startDate, r = [];
            r.push(['Ustoz', s.teacherName ? `${esc(shortName(s.teacherName))}${sched(s) ? ' · ' + esc(sched(s)) : ''}` : '—']);
            r.push([fin ? 'Kurs' : 'Oʻqigan', [`${start ? ddmm(start) + ' ' : ''}→ ${ddmm(lastDay(s))}`, `${s.lessons || 0} dars`, s.reached != null ? `ilovada ${s.reached} / ${COURSE}` : ''].filter(Boolean).join(' · ')]);
            if (fin) { if (finNote(s)) r.push(['Izoh', esc(finNote(s))]); }
            else r.push(['Sabab', s.reason ? esc(s.reason) : '<span class="ar-mute">yozilmagan</span>']);
            r.push(['Belgilagan', `${byTxt(s)}${s.from ? ' · ' + esc(dShort(s.from)) : ''}`]);
            if (!fin && Number(s.debtAmount) > 0) r.push(['Qarz', `<b class="dbx-red">${esc(money(s.debtAmount))}</b>${s.paymentDueDate ? ' · muddat ' + esc(dShort(String(s.paymentDueDate).slice(0, 10))) : ''}`]);
            if (s.subject) r.push(['Til', s.subject === 'russian' ? 'Rus tili' : 'Ingliz tili']);
            return r;
        };
        const pill = s => fin ? `<span class="sc-pill sc-pill--ok">Kursni tugatgan · ${esc(dShort(lastDay(s)))}</span>`
            : `<span class="sc-pill sc-pill--bad">Chiqib ketgan · ${esc(dShort(s.from))}</span>`;
        const card = s => `<article class="ar-card" data-card="${esc(s.id)}"><div class="ar-top">${studentAvatar(s, 40)}<span><button type="button" class="sc-link ar-name" data-st="${esc(s.id)}">${esc(s.name)}</button>${pill(s)}</span></div>
            <dl class="ar-dl">${rows(s).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
            <div class="ar-acts"><button type="button" class="sc-btn" data-st="${esc(s.id)}">Kartani ochish</button>${fin ? '' : `<button type="button" class="sc-btn sc-btn--pri" data-restore="${esc(s.id)}">Qayta tiklash</button>`}</div></article>`;
        const groups = {}; [...list].sort((a, b) => String(b.from || '').localeCompare(String(a.from || ''))).forEach(s => { const k = String(s.from || '').slice(0, 7) || '—'; (groups[k] ||= []).push(s); });
        const monTitle = k => k === '—' ? 'Sanasiz' : `${MON[Number(k.slice(5)) - 1][0].toUpperCase()}${MON[Number(k.slice(5)) - 1].slice(1)} ${k.slice(0, 4)}`;
        const body = list.length ? Object.entries(groups).map(([k, items]) => `<h3 class="ar-sec">${esc(monTitle(k))} · ${items.length} ta</h3><div class="ar-grid">${items.map(card).join('')}</div>`).join('')
            : `<p class="sc-mt ar-empty">${q ? 'Qidiruv boʻyicha topilmadi' : fin ? 'Kursni tugatgan oʻquvchi hali yoʻq' : 'Chiqib ketgan oʻquvchi yoʻq'}</p>`;
        root.innerHTML = `<div class="debtors-wrap ar-admin">
            <p class="dbx-info">${fin ? 'Kursni oxirigacha oʻqiganlar (oʻquvchi kartasida <b>Holat → Kursni tugatdi</b>). Ular faol oʻquvchilar, bugungi darslar va reytingga qoʻshilmaydi.'
                : 'Chiqib ketgan oʻquvchilar (oʻquvchi kartasida <b>Holat → Kursni toʻxtatish</b>). Muzlatilganlar — <b>Muzlatilganlar</b> boʻlimida. <b>Qayta tiklash</b> oʻquvchini yana faol qiladi.'}</p>
            <div class="sfx-tiles">${tiles.map((t, i) => tile(t, !fin && i === 2 && debtSum > 0)).join('')}${top.length ? `<div class="sfx-tile"><small>Eng koʻp sabab</small><b style="font-size:15px">${esc(top[0][0])}</b><span>${top.map(([k, n]) => `${esc(k)} — ${n}`).join(' · ')}</span></div>` : ''}</div>
            <section class="sc-card"><header class="ar-head"><h2>${fin ? 'Tamomlaganlar' : 'Tark etganlar'} <small class="ar-mute">· ${list.length} ta</small></h2>
              <input type="search" class="form-control ar-q" data-arq placeholder="Ism yoki ustoz boʻyicha qidirish" value="${esc(opts.q || '')}" style="max-width:280px"></header>
              <div class="ar-body">${body}</div></section></div>`;
        const qi = root.querySelector('[data-arq]'); let t = null;
        qi.oninput = () => { clearTimeout(t); t = setTimeout(() => { draw(root, { ...opts, q: qi.value }, data); const n = root.querySelector('[data-arq]'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 180); };
        root.querySelectorAll('[data-st]').forEach(b => b.onclick = () => u.openStudent(b.dataset.st));
        root.querySelectorAll('[data-restore]').forEach(b => b.onclick = () => u.openCardForm(b.dataset.restore, 'holat', () => render(root, opts), { act: 'restore' }));
    }

    // ── Eslatma / qo'ng'iroq: karta ichida kichik forma ─────────────────────
    function bindFollowups(root, opts, tab) {
        const u = U(); const { esc, api, post, toast, busy, today, dShort, addDays } = u;
        const reload = () => render(root, { ...opts, tab });
        const inline = (btn, html, onSave) => {
            const acts = btn.closest('.ar-acts');
            const prev = acts.innerHTML;
            acts.innerHTML = `<div class="tgs-fu">${html}<div class="tgs-fu-b"><button type="button" class="sc-btn" data-x>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-ok>Saqlash</button></div><p class="tgs-fu-err" role="alert" hidden></p></div>`;
            acts.querySelector('input,textarea')?.focus();
            acts.querySelector('[data-x]').onclick = () => { acts.innerHTML = prev; bindFollowups(root, opts, tab); };
            acts.querySelector('[data-ok]').onclick = async e => {
                busy(e.currentTarget, true);
                try { await onSave(acts); reload(); }
                catch (err) { busy(e.currentTarget, false); const p = acts.querySelector('.tgs-fu-err'); p.hidden = false; p.textContent = err.message; }
            };
        };
        root.querySelectorAll('[data-fu-rem]').forEach(b => b.onclick = () => inline(b,
            `<label class="tgs-fu-f"><span>Qaysi kuni eslatilsin</span><input type="date" name="due" value="${esc(b.dataset.due)}" min="${today()}"></label>
             <label class="tgs-fu-f"><span>Izoh (ixtiyoriy)</span><input type="text" name="note" maxlength="200" placeholder="masalan: jadval o'zgarmaganini so'rash"></label>`,
            async acts => { const due = acts.querySelector('[name=due]').value; await post(`/students/${encodeURIComponent(b.dataset.fuRem)}/followups`, { kind: 'return_reminder', due, note: acts.querySelector('[name=note]').value }); toast(`Eslatma qo'yildi · ${dShort(due)}`); }));
        root.querySelectorAll('[data-fu-call]').forEach(b => b.onclick = () => inline(b,
            `<label class="tgs-fu-f"><span>Natija (ixtiyoriy)</span><input type="text" name="note" maxlength="200" placeholder="masalan: yanvarda qaytishni o'ylaydi"></label>`,
            async acts => { await post(`/students/${encodeURIComponent(b.dataset.fuCall)}/calls`, { note: acts.querySelector('[name=note]').value }); toast(`Qo'ng'iroq yozildi · keyingisi ${dShort(addDays(today(), 30))}`); }));
        root.querySelectorAll('[data-fu-cancel]').forEach(b => b.onclick = async () => {
            busy(b, true);
            try { await api(`/followups/${encodeURIComponent(b.dataset.fuCancel)}`, { method: 'DELETE' }); toast('Eslatma bekor qilindi'); reload(); }
            catch (err) { busy(b, false); toast(err.message, 4000); }
        });
    }

    // Eski chaqiriq (index.html "Faol emas" tugmasi va boshqalar): kartalar oynada.
    function openDrawer(opts = {}) {
        const u = U(); if (!u) return;
        const box = u.openDrawer({ title: 'Faol emas', sub: 'Muzlatilgan, chiqib ketgan, boshqa ustozga o\'tgan va kursni tugatganlar · faqat siz bilan bo\'lgan davr', body: '<div data-ar></div>', wide: true });
        render(box.querySelector('[data-ar]'), { title: 'O\'quvchilar', ...opts });
    }

    window.studentArchive = { render, openDrawer };
})();
