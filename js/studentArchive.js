// "Faol emas" kartalari — UstozOquvchiArxiv, YordamchiOquvchiArxiv, SotuvOquvchiArxiv.
// Muzlatilgan / boshqa ustozga o'tgan / chiqib ketgan o'quvchilar holat bo'yicha kartalarda.
// Ustoz va yordamchi — faqat o'z davri, pul yo'q (server ham bermaydi). Sotuv — o'zi sotganlar.
(function () {
    'use strict';
    const U = () => window.schoolUI;
    const role = () => (typeof getCurrentUser === 'function' ? getCurrentUser()?.role : '') || '';
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const ddmm = d => (d ? `${String(d).slice(8, 10)}.${String(d).slice(5, 7)}` : '');
    const dLong = d => (d ? `${Number(String(d).slice(8, 10))}-${MON[Number(String(d).slice(5, 7)) - 1]}` : '—');
    const adviceOf = day => ([1, 3, 5].includes(Number(day)) ? 'Se·Pa·Sh' : 'Du·Ch·Ju');

    // root — sahifa ichidagi konteyner; opts.active — "Faol" soni, opts.onBack — "Faol" tugmasi.
    async function render(root, opts = {}) {
        const u = U(); if (!u || !root) return;
        const { api, esc, studentAvatar, addDays, today, dShort, shortName } = u;
        const sales = role() === 'sales_manager';
        const td = today();
        root.innerHTML = '<div class="sc-skel"></div>';
        let data;
        try { data = await api('/inactive'); } catch (e) { root.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        if (!root.isConnected) return;
        const list = data.students || [], changed = sales ? (data.changed || []) : [];
        const assistant = list.length && list.every(s => s.role === 'assistant');
        const sched = s => `${esc(s.schedule?.days || '')} ${esc(s.schedule?.time || '')}`.trim();
        const lastDay = s => (s.from ? addDays(s.from, -1) : null);
        const conMonths = s => Object.entries(s.contacts?.byMonth || {}).sort().map(([m, n]) => `${MON[Number(m.slice(5)) - 1]} ${n} ta`);
        const rowsFor = s => {
            const r = [];
            const start = s.withMe?.from || s.startDate;
            if (sales) {
                if (s.state === 'frozen') {
                    const back = s.to ? addDays(s.to, 1) : null, left = back ? Math.round((Date.parse(back) - Date.parse(td)) / 864e5) : null;
                    r.push(['Ustoz', `${esc(shortName(s.teacherName))} · ${sched(s)}`]);
                    if (back) r.push(['Qaytadi', `${esc(dLong(back))}${left > 0 ? ` · ${left} kun qoldi` : left === 0 ? ' · bugun' : ''}`]);
                    if (s.paymentDueDate) r.push(['To\'lov', `keyingi ${esc(dShort(s.paymentDueDate))}`]);
                    if (s.reason) r.push(['Sabab', esc(s.reason)]);
                } else if (s.state === 'left') {
                    r.push(['O\'qigan', [start && `${ddmm(start)} → ${ddmm(lastDay(s))}`, s.lessons ? `${s.lessons} dars` : '', s.teacherName && esc(shortName(s.teacherName))].filter(Boolean).join(' · ') || '—']);
                    if (s.reason) r.push(['Sabab', esc(s.reason)]);
                } else r.push(['Hozir', `${esc(shortName(s.teacherName))} · ${sched(s)}`]);
                return r;
            }
            if (s.role === 'assistant') {
                r.push(['Asosiy', `${esc(shortName(s.teacherName))} · ${sched(s)}`]);
                const until = s.state === 'left' ? lastDay(s) : s.contacts?.last;
                r.push(['Siz bilan', `${start ? ddmm(start) + ' → ' : ''}${until ? ddmm(until) : ''}${s.contacts?.total ? ` · ${s.contacts.total} aloqa` : ''}` || '—']);
                if (s.state === 'frozen') {
                    r.push(['Holat', `aloqalar to'xtatilgan · ${MON[Number(td.slice(5, 7)) - 1]}da tavsiya yo'q`]);
                    if (s.to) r.push(['Qaytadi', `${esc(dLong(addDays(s.to, 1)))} · tavsiya ${adviceOf(s.schedule?.day)} ${esc(s.schedule?.time || '')} tiklanadi`]);
                } else if (s.state === 'left') {
                    const cm = conMonths(s); if (cm.length) r.push(['Aloqalar', esc(cm.join(' · '))]);
                }
                if (s.reason) r.push(['Sabab', esc(s.reason)]);
                return r;
            }
            if (s.state === 'moved') {
                r.push(['Siz bilan', `${s.withMe ? `${ddmm(s.withMe.from)} → ${ddmm(s.withMe.to)}` : ''}`]);
                r.push(['O\'tilgan', `${s.lessons || 0} dars siz bilan`]);
                if (s.reason) r.push(['Sabab', esc(s.reason)]);
                r.push(['Hozir', `${esc(shortName(s.teacherName))} · ma'lumotlari endi unda`]);
                return r;
            }
            r.push(['Siz bilan', `${start ? ddmm(start) + ' → ' : ''}${s.state === 'left' ? ddmm(lastDay(s)) : ''}${s.state === 'frozen' ? ' · ' + sched(s) : ''}`]);
            r.push(['O\'tilgan', `${s.lessons || 0} dars${s.reached != null && s.state === 'frozen' ? ` · ilovada ${s.reached} / 72` : ''}`]);
            if (s.reason) r.push(['Sabab', esc(s.reason)]);
            if (s.state === 'frozen' && s.to) r.push(['Qaytadi', `${esc(dLong(addDays(s.to, 1)))} · ${sched(s)} siz uchun saqlangan, hozircha faqat sinovlarga beriladi`]);
            return r;
        };
        const pill = s => s.state === 'frozen' ? `<span class="sc-pill sc-pill--info">Muzlatilgan · ${esc(dShort(s.from))}${s.to ? ' → ' + esc(dShort(s.to)) : ''}</span>`
            : s.state === 'left' ? `<span class="sc-pill sc-pill--bad">Chiqib ketgan${s.from ? ' · ' + esc(dShort(lastDay(s))) : ''}</span>`
            : `<span class="sc-pill sc-pill--mute">${esc(shortName(s.teacherName))}ga o'tdi · ${esc(dShort(s.from))}</span>`;
        const card = (s, top, rows, acts = '') => `<article class="ar-card"><div class="ar-top">${studentAvatar(s, 40)}<span><button type="button" class="sc-link ar-name" data-st="${esc(s.id)}">${esc(s.name)}</button>${top}</span></div>
            <dl class="ar-dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>${acts ? `<div class="ar-acts">${acts}</div>` : ''}</article>`;
        const sec = (title, items) => items.length ? `<h3 class="ar-sec">${title}</h3><div class="ar-grid">${items.join('')}</div>` : '';
        const by = st => list.filter(s => s.state === st).map(s => card(s, pill(s), rowsFor(s)));
        const chg = changed.map(s => card(s, `<span class="sc-pill sc-pill--warn">${esc(shortName(s.fromName))} → ${esc(shortName(s.teacherName))} · ${esc(dShort(s.date))}</span>`,
            [s.reason && ['Sabab', esc(s.reason)], ['Hozir', `${esc(shortName(s.teacherName))} · ${sched(s)} · faol`], s.group?.name && ['Guruh', esc(s.group.name)]].filter(Boolean),
            s.group?.link ? `<a class="sc-btn" href="${esc(s.group.link)}" target="_blank" rel="noopener">Guruhni ochish</a>` : ''));
        const total = list.length;
        const foot = sales ? 'Faol bo\'lmaganlar faol o\'quvchilar soni va konversiyaga qo\'shilmaydi. Muzlatilgan o\'quvchi qaytganda avtomatik "Faol"ga o\'tadi.'
            : assistant ? 'Muzlatilgan o\'quvchida aloqalar to\'xtaydi va tavsiya chiqmaydi; qaytganda o\'zi tiklanadi.'
            : 'To\'lov, tarif va sotuv ma\'lumotlari ko\'rsatilmaydi. Muzlatilgan o\'quvchi qaytganda avtomatik "Faol"ga o\'tadi.';
        root.innerHTML = `<section class="sc-card"><header class="ar-head"><h2>${esc(opts.title || 'Mening o\'quvchilarim')}</h2>
            <div class="sc-seg" role="group" aria-label="Ro'yxat">${opts.onBack ? `<button type="button" data-back aria-pressed="false">Faol${opts.active != null ? ' ' + opts.active : ''}</button>` : ''}<button type="button" aria-pressed="true">Faol emas ${total}</button></div></header>
          <div class="ar-body">${total || chg.length ? sec('Muzlatilgan', by('frozen')) + sec('Boshqa ustozga o\'tgan', by('moved')) + sec('Ustozi almashgan · faol, ma\'lumot uchun', chg) + sec('Chiqib ketgan', by('left'))
            : '<p class="sc-mt ar-empty">Faol bo\'lmagan o\'quvchi yo\'q</p>'}
            <p class="ar-foot">${foot}</p></div></section>`;
        root.querySelector('[data-back]')?.addEventListener('click', () => opts.onBack());
        root.querySelectorAll('[data-st]').forEach(b => b.onclick = () => u.openStudent(b.dataset.st));
    }

    // Eski chaqiriq (index.html "Faol emas" tugmasi va boshqalar): kartalar oynada.
    function openDrawer() {
        const u = U(); if (!u) return;
        const box = u.openDrawer({ title: 'Faol emas', sub: 'Muzlatilgan, chiqib ketgan va boshqa ustozga o\'tganlar · faqat siz bilan bo\'lgan davr', body: '<div data-ar></div>', wide: true });
        render(box.querySelector('[data-ar]'), { title: 'O\'quvchilar' });
    }

    window.studentArchive = { render, openDrawer };
})();
