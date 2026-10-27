// Akademik bo'lim va yagona dars jadvali — CRM ko'rinishlari (/api/school bilan).
// Bitta manba: hamma amal serverda bajariladi, keyin kesh qayta yuklanadi.
// Ustoz va yordamchiga tarif/to'lov summasi hech qachon chizilmaydi.
(function () {
    'use strict';
    const DAY = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const DAY_FULL = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
    const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const STUDENT_AVATARS = ['tulki', 'mushuk', 'ayiq', 'boyqush', 'panda', 'quyon', 'sher', 'pingvin', 'kuchukcha', 'toshbaqa'];

    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const role = () => (typeof getCurrentUser === 'function' ? getCurrentUser()?.role : '') || '';
    const isFull = () => ['admin', 'boshliq'].includes(role());
    const isManager = () => ['admin', 'boshliq', 'rop'].includes(role());
    const toast = (m, ms = 2600) => (typeof showMiniToast === 'function' ? showMiniToast(m, ms) : alert(m));
    async function api(path, opts = {}) {
        const o = { ...opts };
        if (o.body && typeof o.body !== 'string') o.body = JSON.stringify(o.body);
        return apiFetch('/api/school' + path, o);
    }
    const post = (p, body) => api(p, { method: 'POST', body: body || {} });
    async function refreshCache() { try { if (typeof reloadStateFromApi === 'function') await reloadStateFromApi(); } catch (e) { console.warn('[school] kesh yangilanmadi', e.message); } }

    // ── Sana / vaqt (Toshkent) ───────────────────────────────────────────────
    function today() { const t = new Date(Date.now() + 5 * 3600000); return t.toISOString().slice(0, 10); }
    function nowMin() { const t = new Date(Date.now() + 5 * 3600000); return t.getUTCHours() * 60 + t.getUTCMinutes(); }
    function addDays(d, n) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
    function wd(d) { const x = new Date(d + 'T00:00:00Z').getUTCDay(); return x === 0 ? 7 : x; }
    function weekStart(d) { return addDays(d, 1 - wd(d)); }
    function fmtDate(d, withDay = true) { if (!d) return '—'; const [y, m, dd] = d.split('-').map(Number); return `${withDay ? DAY[wd(d) - 1] + ', ' : ''}${dd}-${MONTHS[m - 1]}`; }
    const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    const toMin = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    const pattern = d => ([1, 3, 5].includes(Number(d)) ? 'Du·Ch·Ju' : [2, 4, 6].includes(Number(d)) ? 'Se·Pa·Sh' : DAY[Number(d) - 1] || '—');

    // ── Avatarlar: o'quvchi — ilovadagi rasm yoki standart tulki; xodim — 3D personaj ──
    function studentAvatar(s, size = 32) {
        const url = s?.avatarUrl && /^(\/|https:)/.test(s.avatarUrl) ? s.avatarUrl : `images/student-avatars/${STUDENT_AVATARS[0]}.webp`;
        return `<img class="sc-av" src="${esc(url)}" width="${size}" height="${size}" alt="" loading="lazy" onerror="this.src='images/student-avatars/tulki.webp'">`;
    }
    function staffAvatarUrl(avatar) {
        const m = /^preset:st-([fm]\d\d)$/.exec(avatar || '');
        if (m) return `images/staff-avatars/${m[1]}.webp`;
        if (avatar && /^(\/|https:|data:image\/)/.test(avatar)) return avatar;
        return '';
    }
    let _avatars = {};
    let _avP = null;
    function loadStaffAvatars() { return (_avP ||= api('/staff-avatars').then(r => { _avatars = r.avatars || {}; }).catch(() => { _avP = null; })); }
    function staffAvatar(person, size = 32) {
        const url = staffAvatarUrl(person?.avatar || _avatars[person?.id]);
        return url ? `<img class="sc-av" src="${esc(url)}" width="${size}" height="${size}" alt="" loading="lazy">`
            : `<span class="sc-av sc-av--blank" style="width:${size}px;height:${size}px" aria-hidden="true"></span>`;
    }

    // ── Keshdan ma'lumot ─────────────────────────────────────────────────────
    const cache = key => (typeof getItem === 'function' && typeof STORAGE_KEYS !== 'undefined' ? getItem(STORAGE_KEYS[key], []) : []);
    const students = () => cache('students');
    const studentById = id => students().find(s => s.id === id) || null;
    function staffList() { return cache('hrEmployees'); }
    function teacherName(id, short = false) {
        const e = staffList().find(x => x.id === id) || cache('teachers').find(x => x.id === id);
        if (!e) return '—';
        if (!short) return e.name;
        const p = String(e.name || '').split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : e.name;
    }
    function teachersForSubject(subject = 'english') {
        return staffList().filter(e => ['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi'].includes(e.role) && (e.status || 'active') !== 'inactive'
            && (!e.lang || e.lang === subject || e.lang === 'both' || e.role === 'oqituvchi'));
    }
    function assistants() { return staffList().filter(e => e.role === 'yordamchi' && (e.status || 'active') !== 'inactive'); }
    function tgPill(group) {
        if (!group?.name) return '<span class="sc-pill sc-pill--mute">Telegram guruh yo\'q</span>';
        const inner = `<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M21.5 4.3 2.9 11.5c-1.3.5-1.2 1.3-.2 1.6l4.8 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.4-1.5Z"/></svg>${esc(group.name)}`;
        return group.tg_link || group.link ? `<a class="sc-tg" href="${esc(group.tg_link || group.link)}" target="_blank" rel="noopener" title="Telegram guruhni ochish">${inner}</a>`
            : `<span class="sc-tg sc-tg--nolink">${inner}</span>`;
    }

    // ── Umumiy oyna (drawer) ─────────────────────────────────────────────────
    let _drawer = null;
    function openDrawer({ title, sub = '', body = '', foot = '', wide = false, onClose = null }) {
        closeDrawer();
        const wrap = document.createElement('div');
        wrap.className = 'sc-dim';
        wrap.innerHTML = `<aside class="sc-drw${wide ? ' sc-drw--wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="scDrwTitle">
            <header class="sc-dh"><div><h2 id="scDrwTitle">${esc(title)}</h2>${sub ? `<p class="sc-mt">${sub}</p>` : ''}</div>
            <button type="button" class="sc-x" data-close aria-label="Yopish">✕</button></header>
            <div class="sc-db">${body}</div>${foot ? `<footer class="sc-df">${foot}</footer>` : ''}</aside>`;
        document.body.appendChild(wrap);
        wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) closeDrawer(); });
        const onKey = e => { if (e.key === 'Escape') closeDrawer(); };
        document.addEventListener('keydown', onKey);
        _drawer = { el: wrap, onKey, onClose };
        setTimeout(() => wrap.querySelector('input,select,textarea,button:not([data-close])')?.focus(), 30);
        return wrap.querySelector('.sc-drw');
    }
    function closeDrawer() {
        if (!_drawer) return;
        document.removeEventListener('keydown', _drawer.onKey);
        _drawer.el.remove();
        const cb = _drawer.onClose; _drawer = null; cb?.();
    }
    function busy(btn, on) { if (!btn) return; btn.disabled = on; btn.dataset.label ||= btn.textContent; btn.textContent = on ? 'Saqlanmoqda…' : btn.dataset.label; }
    function errBox(root, msg) {
        let el = root.querySelector('.sc-err');
        if (!el) { el = document.createElement('div'); el.className = 'sc-err'; el.setAttribute('role', 'alert'); root.querySelector('.sc-db')?.prepend(el) || root.prepend(el); }
        el.textContent = msg; el.hidden = !msg; if (msg) el.scrollIntoView({ block: 'nearest' });
    }
    const field = (label, inner, hint = '') => `<label class="sc-fd"><span>${label}</span>${inner}${hint ? `<small>${hint}</small>` : ''}</label>`;
    const chips = (name, list, sel) => `<div class="sc-chips" role="radiogroup">${list.map(([v, l]) => `<label class="sc-chip"><input type="radio" name="${name}" value="${esc(v)}"${v === sel ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
    const impact = items => `<ul class="sc-imp">${items.map(([i, t]) => `<li><span class="sc-ic" aria-hidden="true">${i}</span><span>${t}</span></li>`).join('')}</ul>`;

    // ── O'quvchi kartasi va amallar ──────────────────────────────────────────
    async function openStudent(studentId, tab = 'umumiy') {
        loadStaffAvatars();
        const box = openDrawer({ title: 'O\'quvchi', sub: 'Yuklanmoqda…', body: '<div class="sc-skel"></div>', wide: true });
        let card;
        try { card = (await api(`/students/${encodeURIComponent(studentId)}/card`)).card; }
        catch (e) { errBox(box, e.message); return; }
        renderStudent(box, card, tab);
    }
    function statusPill(card) {
        const st = card.status;
        if (st === 'frozen') { const f = card.statuses.filter(s => s.status === 'frozen').pop(); return `<span class="sc-pill sc-pill--info">Muzlatilgan${f?.to ? ' · ' + esc(fmtDate(f.to, false)) + ' gacha' : ''}</span>`; }
        if (st === 'left') { const l = card.statuses.filter(s => s.status === 'left').pop(); return `<span class="sc-pill sc-pill--bad">Chiqib ketgan${l ? ' · ' + esc(fmtDate(addDays(l.from, -1), false)) : ''}</span>`; }
        const fr = card.statuses.find(s => s.status === 'frozen' && s.from > today());
        return `<span class="sc-pill sc-pill--ok">Faol</span>${fr ? ` <span class="sc-pill sc-pill--info">Muzlatiladi: ${esc(fmtDate(fr.from, false))}–${esc(fmtDate(fr.to, false))}</span>` : ''}`;
    }
    function renderStudent(box, card, tab) {
        const canAct = isManager();
        const canEdit = canAct || (role() === 'sales_manager' && card.scope === 'sales');
        box.querySelector('#scDrwTitle').innerHTML = `${studentAvatar(card, 36)} ${esc(card.name)}`;
        box.querySelector('.sc-dh .sc-mt')?.remove();
        box.querySelector('.sc-dh > div').insertAdjacentHTML('beforeend', `<p class="sc-mt sc-row">${statusPill(card)} ${tgPill(card.group)}</p>`);
        const tabs = [['umumiy', 'Umumiy']];
        if (canEdit) tabs.push(['tahrir', 'Tahrirlash']);
        if (canAct) tabs.push(['holat', 'Holatni o\'zgartirish']);
        if (card.history) tabs.push(['tarix', 'O\'zgarishlar tarixi']);
        const db = box.querySelector('.sc-db');
        db.innerHTML = `<div class="sc-tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" class="sc-tab" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div><div class="sc-tabbody"></div>`;
        const body = db.querySelector('.sc-tabbody');
        const show = k => {
            db.querySelectorAll('.sc-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === k)));
            box.querySelector('.sc-df')?.remove();
            if (k === 'umumiy') body.innerHTML = cardSummary(card);
            else if (k === 'tahrir') editForm(box, body, card);
            else if (k === 'holat') statusForm(box, body, card);
            else if (k === 'tarix') body.innerHTML = historyList(card);
        };
        db.querySelectorAll('.sc-tab').forEach(b => b.onclick = () => show(b.dataset.tab));
        show(tabs.some(t => t[0] === tab) ? tab : 'umumiy');
    }
    function cardSummary(c) {
        const money = c.scope === 'full' || c.scope === 'sales';
        const teachers = (c.teachers || []).filter(t => t.from > '2001-01-01');
        return `<div class="sc-grid3">
            <section class="sc-card"><h3>O'qish</h3><dl class="sc-kv">
              <dt>Asosiy ustoz</dt><dd>${esc(teacherName(c.teacherId))}</dd>
              <dt>Yordamchi</dt><dd>${c.assistantId ? esc(teacherName(c.assistantId)) : '—'}</dd>
              ${c.schedule ? `<dt>Jadval</dt><dd>${esc(c.schedule.days)} ${esc(c.schedule.time || '')} · ${esc(c.schedule.duration)} daq</dd>` : ''}
              ${c.startDate ? `<dt>Boshlagan</dt><dd>${esc(fmtDate(String(c.startDate).slice(0, 10), false))}</dd>` : ''}
              ${c.pendingTeacherChange ? `<dt>Ustoz almashadi</dt><dd>${esc(teacherName(c.pendingTeacherChange.teacherId))} · ${esc(fmtDate(c.pendingTeacherChange.from))}</dd>` : ''}
            </dl></section>
            ${money ? `<section class="sc-card"><h3>Aloqa va to'lov</h3><dl class="sc-kv">
              <dt>Telefon</dt><dd>${esc(c.phone || '—')}</dd><dt>Ota-ona</dt><dd>${esc(c.parentPhone || '—')}</dd><dt>Login</dt><dd>${esc(c.login || '—')}</dd>
              <dt>Tarif</dt><dd>${esc(c.tariff || '—')}${c.monthlyPrice ? ' · ' + esc(formatMoney(c.monthlyPrice)) + '/oy' : ''}</dd>
              <dt>Keyingi to'lov</dt><dd>${c.paymentDueDate ? esc(fmtDate(String(c.paymentDueDate).slice(0, 10), false)) : '—'}</dd>
            </dl></section>` : ''}
            <section class="sc-card"><h3>Ustozlar tarixi</h3>${teachers.length ? `<ul class="sc-hist">${teachers.map(t => `<li${!t.to ? ' class="now"' : ''}>${esc(teacherName(t.teacherId))} · ${esc(fmtDate(t.from, false))} → ${t.to ? esc(fmtDate(t.to, false)) : ''}</li>`).join('')}</ul>` : '<p class="sc-mt">Almashtirilmagan</p>'}</section>
          </div>
          ${(c.requests || []).filter(r => r.status === 'pending').map(r => `<div class="sc-note sc-note--warn">So'rov №${esc(r.number)} (${esc(REQ_KIND[r.kind])}) — admin yoki ROP tasdig'ini kutmoqda</div>`).join('')}`;
    }
    const REQ_KIND = { tariff: 'tarif', teacher: 'ustoz', payment: 'to\'lov' };

    function editForm(box, body, c) {
        const sales = role() === 'sales_manager';
        const dur = c.schedule?.duration || 30;
        body.innerHTML = `
          ${sales ? '<div class="sc-note">Ism, telefon, login va parol darhol saqlanadi. Tarif, jadval va ustoz o\'zgarishi admin yoki ROP tasdig\'iga boradi.</div>' : ''}
          <div class="sc-sec"><h3>Shaxsiy va ilova</h3><div class="sc-g2">
            ${field('Ism familiya', `<input name="name" value="${esc(c.name)}" maxlength="80" required>`)}
            ${field('Telefon', `<input name="phone" value="${esc(c.phone || '')}" inputmode="tel">`)}
            ${field('Ota-ona telefoni', `<input name="parentPhone" value="${esc(c.parentPhone || '')}" inputmode="tel">`)}
            ${field('Ilova logini', `<input name="login" value="${esc(c.login || '')}" autocomplete="off">`)}
            ${field('Yangi vaqtinchalik parol', `<input name="newPassword" type="text" autocomplete="new-password" placeholder="o'zgartirilmaydi">`, 'Birinchi kirishda o\'quvchi almashtiradi')}
          </div></div>
          <div class="sc-sec"><h3>O'qish${sales ? ' · tasdiq bilan' : ''}</h3><div class="sc-g2">
            ${field('Tarif', `<input name="tariff" value="${esc(c.tariff || '')}" maxlength="40">`)}
            ${field('Oylik narx, so\'m', `<input name="monthlyPrice" value="${esc(c.monthlyPrice ?? '')}" inputmode="numeric">`)}
            ${field('Dars kunlari', `<select name="lessonDay"><option value="1"${[1, 3, 5].includes(Number(c.schedule?.day)) ? ' selected' : ''}>Du·Ch·Ju</option><option value="2"${[2, 4, 6].includes(Number(c.schedule?.day)) ? ' selected' : ''}>Se·Pa·Sh</option></select>`)}
            ${field('Dars vaqti', `<input name="lessonTime" value="${esc(c.schedule?.time || '')}" placeholder="16:30" pattern="\\d{1,2}:\\d{2}">`)}
            ${field('Davomiylik', `<select name="lessonDuration">${[15, 30, 45, 60, 90].map(d => `<option value="${d}"${d === dur ? ' selected' : ''}>${d} daq</option>`).join('')}</select>`)}
            ${field('Qachondan', `<input name="effectiveFrom" type="date" value="${today()}">`, 'Server bo\'sh vaqtni qayta tekshiradi')}
          </div></div>
          <div class="sc-sec"><h3>Telegram guruh</h3>${isManager() ? `<div class="sc-g2">
            ${field('Guruh nomi', `<input name="groupName" value="${esc(c.group?.name || '')}" placeholder="C40 | onlayn ingliz tili">`)}
            ${field('Havola', `<input name="groupLink" value="${esc(c.group?.tg_link || '')}" placeholder="https://t.me/+…">`)}</div>` : `<p class="sc-mt">${tgPill(c.group)} · nom va havolani admin yoki ROP o'zgartiradi</p>`}</div>
          <div class="sc-sec">${field('Sabab (majburiy)', '<textarea name="reason" rows="2" required placeholder="Masalan: telefon raqamida 2 raqam almashgan"></textarea>', 'O\'zgarishlar tarixiga yoziladi')}</div>`;
        box.insertAdjacentHTML('beforeend', `<footer class="sc-df"><span class="sc-mt">O'zgarish ilova, ustoz, sotuv va moliyada birdek yangilanadi</span><div class="sc-row"><button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Saqlash</button></div></footer>`);
        box.querySelector('[data-save]').onclick = async e => {
            const v = n => body.querySelector(`[name="${n}"]`)?.value?.trim() ?? '';
            const changes = {};
            if (v('name') !== c.name) changes.name = v('name');
            if (v('phone') && v('phone') !== (c.phone || '')) changes.phone = v('phone');
            if (v('parentPhone') !== (c.parentPhone || '')) changes.parentPhone = v('parentPhone');
            if (v('login') && v('login') !== (c.login || '')) changes.login = v('login');
            if (v('newPassword')) changes.newPassword = v('newPassword');
            if (v('tariff') !== (c.tariff || '')) changes.tariff = v('tariff');
            if (v('monthlyPrice') !== String(c.monthlyPrice ?? '') && v('monthlyPrice') !== '') changes.monthlyPrice = Number(v('monthlyPrice').replace(/\D/g, ''));
            const sameDay = pattern(v('lessonDay')) === c.schedule?.days;
            if (!sameDay || v('lessonTime') !== (c.schedule?.time || '') || Number(v('lessonDuration')) !== Number(c.schedule?.duration)) {
                Object.assign(changes, { lessonDay: Number(v('lessonDay')), lessonTime: v('lessonTime'), lessonDuration: Number(v('lessonDuration')), effectiveFrom: v('effectiveFrom') });
            }
            const groupChanged = isManager() && (v('groupName') !== (c.group?.name || '') || v('groupLink') !== (c.group?.tg_link || ''));
            if (!Object.keys(changes).length && !groupChanged) return errBox(box, 'O\'zgarish yo\'q');
            if (v('reason').length < 5) return errBox(box, 'Sababni yozing (kamida 5 belgi)');
            busy(e.target, true); errBox(box, '');
            try {
                let msg = 'Saqlandi';
                if (Object.keys(changes).length) {
                    const r = await post(`/students/${encodeURIComponent(c.id)}/edit`, { changes, reason: v('reason') });
                    if (r.request) msg = r.applied?.changed ? 'Saqlandi · tarif/jadval o\'zgarishi tasdiqqa yuborildi' : 'Tasdiqqa yuborildi';
                }
                if (groupChanged) await api(`/students/${encodeURIComponent(c.id)}/group`, { method: 'PUT', body: { name: v('groupName'), link: v('groupLink'), reason: v('reason') } });
                toast(msg); await refreshCache(); window.dispatchEvent(new CustomEvent('school:changed'));
                openStudent(c.id, 'umumiy');
            } catch (err) { busy(e.target, false); errBox(box, err.message); }
        };
    }

    // Holat: muzlatish / ustozni almashtirish / qayta tiklash / kursni to'xtatish — alohida bitta oyna.
    function statusForm(box, body, c) {
        const st = c.status;
        const acts = [
            ['freeze', 'Muzlatish', 'vaqtincha · kursda 1 marta, 30 kungacha', st !== 'active' || c.statuses.some(s => s.status === 'frozen')],
            ['teacher', 'Ustozni almashtirish', 'yangi ustoz va sana · tarix saqlanadi', st === 'left'],
            ['restore', 'Qayta tiklash', 'faqat muzlatilgan yoki chiqib ketgan o\'quvchi uchun', st === 'active'],
            ['stop', 'Kursni to\'xtatish', 'o\'quvchi chiqib ketadi', st === 'left']
        ];
        const first = acts.find(a => !a[3])?.[0] || 'freeze';
        body.innerHTML = `<div class="sc-sec"><h3>Amal</h3><div class="sc-alst" role="radiogroup">${acts.map(([k, l, h, off]) =>
            `<label class="sc-ai${k === 'stop' ? ' sc-ai--dg' : ''}${off ? ' is-off' : ''}"><input type="radio" name="act" value="${k}"${off ? ' disabled' : ''}${k === first ? ' checked' : ''}><span><b>${l}</b><small>${h}</small></span></label>`).join('')}</div></div><div class="sc-actbody"></div>`;
        const ab = body.querySelector('.sc-actbody');
        const render = k => { box.querySelector('.sc-df')?.remove(); ({ freeze: freezeForm, teacher: teacherForm, restore: restoreForm, stop: stopForm })[k](box, ab, c); };
        body.querySelectorAll('input[name="act"]').forEach(r => r.onchange = () => render(r.value));
        render(first);
    }
    function footer(box, label, danger, onSave) {
        box.insertAdjacentHTML('beforeend', `<footer class="sc-df"><span class="sc-mt">Admin va ROP · sabab tarixga yoziladi</span><div class="sc-row"><button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="${danger ? 'sc-btn sc-btn--dg' : 'sc-btn sc-btn--pri'}" data-save>${label}</button></div></footer>`);
        box.querySelector('[data-save]').onclick = async e => {
            busy(e.target, true); errBox(box, '');
            try { await onSave(); await refreshCache(); window.dispatchEvent(new CustomEvent('school:changed')); }
            catch (err) { busy(e.target, false); errBox(box, err.message); }
        };
    }
    const reasonBlock = (opts, sel) => `<div class="sc-sec"><h3>Sabab</h3>${chips('rcode', opts, sel)}<textarea name="reason" rows="2" class="sc-mtop" placeholder="Batafsil yozing"></textarea></div>`;
    const val = (root, n) => root.querySelector(`[name="${n}"]`)?.value?.trim() ?? '';
    const radio = (root, n) => root.querySelector(`[name="${n}"]:checked`)?.value || '';
    const fullReason = root => [radio(root, 'rcode'), val(root, 'reason')].filter(Boolean).join(': ');

    function freezeForm(box, ab, c) {
        const from = addDays(today(), 1);
        ab.innerHTML = `<div class="sc-sec"><h3>Muddat</h3><div class="sc-g2">${field('Qaysi sanadan', `<input type="date" name="from" value="${from}" min="${today()}">`)}${field('Qaysi sanagacha', `<input type="date" name="to" value="${addDays(from, 13)}">`)}</div><p class="sc-mt" data-days></p></div>
          ${reasonBlock([['Kasallik', 'Kasallik'], ['Safar', 'Safar'], ['Imtihonlar', 'Imtihonlar'], ['Boshqa', 'Boshqa']], 'Safar')}
          <div class="sc-sec"><h3>Saqlansa nima bo'ladi</h3>${impact([
            ['▦', `${esc(teacherName(c.teacherId, true))} jadvali: ${esc(c.schedule?.days || '')} ${esc(c.schedule?.time || '')} — shu davrda faqat sinov darslariga ochiladi, vaqt o'quvchi uchun saqlanadi`],
            ['◷', 'Yordamchi aloqalari shu kunlarda belgilanmaydi · chegara va narx o\'zgarmaydi'],
            ['₪', 'Keyingi to\'lov sanasi va kurs oxiri muzlatish kunlariga suriladi'],
            ['▣', 'Ilova: o\'tgan darslar ochiq · Telegram guruh qoladi'],
            ['↻', 'Tugash sanasidan keyingi kuni avtomatik faollashadi — oldin qaytarish ham mumkin']])}</div>`;
        const upd = () => { const a = val(ab, 'from'), b = val(ab, 'to'); const n = a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1 : 0; ab.querySelector('[data-days]').textContent = n > 0 ? `${n} kun${n > 30 ? ' — 30 kundan oshmaydi' : ''} · qaytadi: ${fmtDate(addDays(b, 1))}` : ''; };
        ab.querySelectorAll('input[type=date]').forEach(i => i.oninput = upd); upd();
        footer(box, 'Muzlatish', false, async () => { await post(`/students/${encodeURIComponent(c.id)}/freeze`, { from: val(ab, 'from'), to: val(ab, 'to'), reasonCode: radio(ab, 'rcode'), reason: fullReason(ab) }); toast('Muzlatildi'); openStudent(c.id); });
    }
    function stopForm(box, ab, c) {
        ab.innerHTML = `<div class="sc-sec"><h3>Oxirgi dars</h3>${field('Oxirgi dars sanasi', `<input type="date" name="last" value="${today()}">`)}</div>
          ${reasonBlock([['Vaqti yo\'q', 'Vaqti yo\'q'], ['Moliyaviy', 'Moliyaviy'], ['Boshqa markaz', 'Boshqa markaz'], ['Natijadan norozi', 'Natijadan norozi'], ['Boshqa', 'Boshqa']], 'Vaqti yo\'q')}
          <div class="sc-sec"><h3>Saqlansa nima bo'ladi</h3>${impact([
            ['▦', `${esc(teacherName(c.teacherId, true))} jadvalida ${esc(c.schedule?.days || '')} ${esc(c.schedule?.time || '')} keyingi kundan bo'shaydi → sinovga ochiladi`],
            ['◷', 'Yordamchi ro\'yxatidan chiqadi · tarix arxivda qoladi'],
            ['✈', 'Telegram guruh arxivlanadi'],
            ['▣', 'Ilova: faqat o\'tgan darslar · yangi dars ochilmaydi'],
            ['☎', 'Sotuv menejerining "Faol emas" ro\'yxatiga tushadi'],
            ['▤', 'Faol o\'quvchilar, davomat va reytingdan chiqadi · qoplanmagan darslar bekor bo\'ladi']])}</div>
          <div class="sc-note sc-note--bad">Qaytarib bo'lmaydigan amal emas — "Qayta tiklash" bilan qaytariladi, vaqti band bo'lsa yangi vaqt tanlanadi.</div>`;
        footer(box, 'Kursni to\'xtatish', true, async () => { await post(`/students/${encodeURIComponent(c.id)}/stop`, { lastLesson: val(ab, 'last'), reasonCode: radio(ab, 'rcode'), reason: fullReason(ab) }); toast('Kurs to\'xtatildi'); openStudent(c.id); });
    }
    async function freeSlotsFor(teacherId, from, duration, day) {
        const to = addDays(from, 13);
        const r = await api(`/schedule/free?purpose=lesson&teacherId=${encodeURIComponent(teacherId)}&from=${from}&to=${to}&duration=${duration}`);
        const days = [1, 3, 5].includes(Number(day)) ? [1, 3, 5] : [2, 4, 6];
        // Haftalik dars: shu vaqt naqshdagi uchala kunda ham bo'sh bo'lishi kerak.
        const byTime = new Map();
        for (const s of r.slots) { if (!days.includes(wd(s.date))) continue; const k = s.time; byTime.set(k, (byTime.get(k) || new Set()).add(s.date)); }
        return [...byTime.entries()].filter(([, set]) => set.size >= 5).map(([t]) => t).sort();
    }
    function restoreForm(box, ab, c) {
        const frozen = c.status === 'frozen';
        const from = addDays(today(), 1);
        ab.innerHTML = frozen ? `<div class="sc-sec"><h3>Muzlatishdan oldin qaytarish</h3>${field('Birinchi dars', `<input type="date" name="from" value="${from}" min="${today()}">`, 'Ishlatilmagan kunlar to\'lov sanasidan qaytarib olinadi')}</div>${reasonBlock([['Erta qaytdi', 'Erta qaytdi'], ['Boshqa', 'Boshqa']], 'Erta qaytdi')}`
            : `<div class="sc-sec"><h3>Qachondan</h3><div class="sc-g2">${field('Birinchi dars', `<input type="date" name="from" value="${from}" min="${today()}">`)}${field('Kurs', `<select name="cont"><option value="next">To'xtagan joyidan davom</option><option value="restart">Boshidan (progress arxivga)</option></select>`)}</div></div>
              <div class="sc-sec"><h3>Ustoz va vaqt</h3><div class="sc-g2">${field('Ustoz', `<select name="teacher">${teachersForSubject(c.subject).map(t => `<option value="${esc(t.id)}"${t.id === c.teacherId ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`)}
                ${field('Dars kunlari', `<select name="day"><option value="1"${[1, 3, 5].includes(Number(c.schedule?.day)) ? ' selected' : ''}>Du·Ch·Ju</option><option value="2"${[2, 4, 6].includes(Number(c.schedule?.day)) ? ' selected' : ''}>Se·Pa·Sh</option></select>`)}</div>
                <div class="sc-old" data-old></div><p class="sc-mt sc-mtop">Bo'sh vaqtlar · ${esc(c.schedule?.duration || 30)} daq</p><div class="sc-slots" data-slots><span class="sc-mt">Yuklanmoqda…</span></div></div>
              ${reasonBlock([['Qayta yozildi', 'Qayta yozildi'], ['Sabab bartaraf etildi', 'Sabab bartaraf etildi'], ['Boshqa', 'Boshqa']], 'Qayta yozildi')}
              <div class="sc-sec"><h3>Saqlansa nima bo'ladi</h3>${impact([['▦', 'Tanlangan vaqt ustoz jadvalida band bo\'ladi'], ['◷', 'Yordamchi ro\'yxatiga qaytadi'], ['✈', 'Telegram guruh arxivdan qaytadi'], ['₪', 'Yangi to\'lov davri birinchi darsdan · sotuv menejeriga vazifa'], ['▣', 'Ilova: eski login ishlaydi']])}</div>`;
        let pick = null;
        const load = async () => {
            if (frozen) return;
            const slotsEl = ab.querySelector('[data-slots]'); slotsEl.innerHTML = '<span class="sc-mt">Yuklanmoqda…</span>';
            const tid = val(ab, 'teacher'), day = val(ab, 'day');
            try {
                const times = await freeSlotsFor(tid, val(ab, 'from'), c.schedule?.duration || 30, day);
                const old = c.schedule?.time; const oldFree = tid === c.teacherId && pattern(day) === c.schedule?.days && times.includes(old);
                ab.querySelector('[data-old]').innerHTML = old && tid === c.teacherId ? (oldFree ? `<div class="sc-note sc-note--ok">Eski vaqt bo'sh: ${esc(c.schedule.days)} ${esc(old)}</div>` : `<div class="sc-note sc-note--bad"><b>Eski vaqt band: ${esc(c.schedule.days)} ${esc(old)}</b> — yangi vaqt tanlang</div>`) : '';
                pick = oldFree ? old : null;
                slotsEl.innerHTML = times.length ? times.map(t => `<button type="button" class="sc-slot" aria-pressed="${t === pick}" data-t="${t}">${esc(pattern(day))} ${t}</button>`).join('') : '<span class="sc-mt">Bu ustozda 2 hafta ichida bo\'sh doimiy vaqt yo\'q — boshqa ustozni tanlang</span>';
                slotsEl.querySelectorAll('.sc-slot').forEach(b => b.onclick = () => { pick = b.dataset.t; slotsEl.querySelectorAll('.sc-slot').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
            } catch (e) { slotsEl.textContent = e.message; }
        };
        ab.querySelectorAll('select[name=teacher],select[name=day],input[name=from]').forEach(i => i.onchange = load); load();
        footer(box, 'Qayta tiklash', false, async () => {
            if (!frozen && !pick) throw new Error('Bo\'sh vaqtni tanlang');
            await post(`/students/${encodeURIComponent(c.id)}/restore`, frozen ? { from: val(ab, 'from'), reason: fullReason(ab) }
                : { from: val(ab, 'from'), teacherId: val(ab, 'teacher'), lessonDay: Number(val(ab, 'day')), lessonTime: pick, continueFrom: val(ab, 'cont'), reasonCode: radio(ab, 'rcode'), reason: fullReason(ab) });
            toast('Qayta tiklandi'); openStudent(c.id);
        });
    }
    function teacherForm(box, ab, c) {
        const from = addDays(today(), 1);
        const list = teachersForSubject(c.subject).filter(t => t.id !== c.teacherId && t.id !== c.assistantId);
        ab.innerHTML = `<div class="sc-sec"><h3>Yangi ustoz</h3><p class="sc-mt">${esc(c.schedule?.days || '')} ${esc(c.schedule?.time || '')} · ${esc(c.schedule?.duration || '')} daq bo'yicha tekshiriladi</p><div class="sc-tch" data-tch><span class="sc-mt">Tekshirilmoqda…</span></div></div>
          <div class="sc-sec"><h3>Sana</h3>${field('Yangi ustoz bilan birinchi dars', `<input type="date" name="from" value="${from}" min="${today()}">`, 'Shu kungacha eski ustoz dars o\'tadi va qoplaydi')}</div>
          ${reasonBlock([['Ota-ona so\'radi', 'Ota-ona so\'radi'], ['Ustoz yuklamasi', 'Ustoz yuklamasi'], ['Ustoz ketmoqda', 'Ustoz ketmoqda'], ['Boshqa', 'Boshqa']], 'Ota-ona so\'radi')}
          <div class="sc-sec"><h3>Saqlansa nima bo'ladi</h3>${impact([['▦', 'Eski ustozda vaqt bo\'shaydi → sinovga ochiladi · yangi ustozda band'], ['✈', 'Telegram guruh: yangi ustozni qo\'shing, eskisini chiqaring'], ['↺', 'Qoplanmagan darslar oxirgi kungacha eski ustozda, keyin yangisiga o\'tadi'], ['₪', 'Ustozlar maoshi dars bo\'yicha bo\'linadi · o\'quvchi to\'lovi o\'zgarmaydi'], ['▣', 'Ilova: progress saqlanadi · yangi ustoz rasmi va ismi']])}</div>`;
        let pick = null;
        const load = async () => {
            const el = ab.querySelector('[data-tch]');
            const rows = await Promise.all(list.map(async t => {
                try { const times = await freeSlotsFor(t.id, val(ab, 'from'), c.schedule?.duration || 30, c.schedule?.day); return { t, ok: times.includes(c.schedule?.time), alt: times[0] || null }; }
                catch { return { t, ok: false, alt: null }; }
            }));
            rows.sort((a, b) => (b.ok - a.ok) || (!!b.alt - !!a.alt));
            pick = rows.find(r => r.ok)?.t.id || null;
            el.innerHTML = rows.map(r => `<label class="sc-tc${!r.ok && !r.alt ? ' is-off' : ''}"><input type="radio" name="tch" value="${esc(r.t.id)}"${r.t.id === pick ? ' checked' : ''}${!r.ok && !r.alt ? ' disabled' : ''}>${staffAvatar(r.t, 34)}<span class="sc-grow"><b>${esc(r.t.name)}</b><small>${r.ok ? 'vaqt o\'zgarmaydi' : r.alt ? 'shu vaqt band · bo\'sh: ' + esc(r.alt) : 'mos bo\'sh vaqt yo\'q'}</small></span><span class="sc-pill ${r.ok ? 'sc-pill--ok' : r.alt ? 'sc-pill--warn' : 'sc-pill--mute'}">${r.ok ? esc(c.schedule?.time) + ' bo\'sh' : r.alt ? 'band' : '—'}</span></label>`).join('') || '<span class="sc-mt">Boshqa ustoz yo\'q</span>';
            el.querySelectorAll('input[name=tch]').forEach(i => i.onchange = () => { pick = i.value; });
            el._rows = rows;
        };
        ab.querySelector('input[name=from]').onchange = load; load();
        footer(box, 'Almashtirish', false, async () => {
            if (!pick) throw new Error('Yangi ustozni tanlang');
            const r = ab.querySelector('[data-tch]')._rows?.find(x => x.t.id === pick);
            await post(`/students/${encodeURIComponent(c.id)}/teacher`, { teacherId: pick, from: val(ab, 'from'), lessonTime: r && !r.ok ? r.alt : undefined, reason: fullReason(ab) });
            toast('Ustoz almashtirildi'); openStudent(c.id);
        });
    }
    const ACTION_LABEL = { edit: 'Tahrir', freeze: 'Muzlatildi', stop: 'Kurs to\'xtatildi', restore: 'Qayta tiklandi', 'unfreeze-early': 'Muzlatishdan erta qaytdi',
        'teacher-change': 'Ustoz almashtirildi', group: 'Telegram guruh', 'request-tariff': 'So\'rov: tarif', 'request-teacher': 'So\'rov: ustoz',
        'request-approved': 'So\'rov tasdiqlandi', 'request-rejected': 'So\'rov rad etildi', 'request-returned': 'So\'rov qaytarildi' };
    const FIELD_LABEL = { name: 'Ism', phone: 'Telefon', parentPhone: 'Ota-ona', login: 'Login', password: 'Parol', tariff: 'Tarif', monthlyPrice: 'Narx', schedule: 'Jadval' };
    function historyList(c) {
        if (!c.history?.length) return '<p class="sc-mt">Hali o\'zgarish yo\'q</p>';
        return `<ol class="sc-tl">${c.history.map(h => {
            const ch = h.changes || {};
            let diff = Object.entries(ch).filter(([, v]) => Array.isArray(v)).map(([k, [a, b]]) => `<div class="sc-diff"><span>${esc(FIELD_LABEL[k] || k)}</span><s>${esc(a)}</s> → <b>${esc(b)}</b></div>`).join('');
            if (h.action === 'group') diff = `<div class="sc-diff"><span>Guruh</span>${ch.before ? `<s>${esc(ch.before.name)}</s> → ` : ''}<b>${esc(ch.after?.name || '')}</b></div>`;
            if (h.action === 'teacher-change') diff = `<div class="sc-diff"><span>Ustoz</span><s>${esc(teacherName(ch.from))}</s> → <b>${esc(teacherName(ch.to))}</b> · ${esc(fmtDate(ch.date))}</div>`;
            if (h.action === 'freeze') diff = `<div class="sc-diff"><span>Muddat</span><b>${esc(fmtDate(ch.from, false))} – ${esc(fmtDate(ch.to, false))}</b> · ${esc(ch.days)} kun</div>`;
            if (h.action === 'stop') diff = `<div class="sc-diff"><span>Oxirgi dars</span><b>${esc(fmtDate(ch.lastLesson))}</b></div>`;
            if (h.action === 'restore') diff = `<div class="sc-diff"><span>Qaytdi</span><b>${esc(fmtDate(ch.from))} · ${esc(ch.schedule || '')}</b></div>`;
            return `<li><div class="sc-tl-h"><b>${esc(ACTION_LABEL[h.action] || h.action)}</b><span class="sc-mt">${esc(new Date(h.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))} · ${esc(h.actor_name)}</span></div>${diff}${h.reason ? `<p class="sc-mt">${esc(h.reason)}</p>` : ''}</li>`;
        }).join('')}</ol>`;
    }

    // ── Sotuv tahrirlari · tasdiq (admin va ROP) ─────────────────────────────
    async function renderApprovals(root) {
        await loadStaffAvatars();
        root.innerHTML = '<div class="sc-skel"></div>';
        let data, filter = root.dataset.filter || 'pending';
        try { data = await api('/edit-requests'); } catch (e) { root.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        const counts = data.counts || {};
        const list = data.requests.filter(r => filter === 'all' || r.status === filter);
        root.innerHTML = `<div class="sc-head"><div><h1>Sotuv tahrirlari · tasdiq</h1><p class="sc-sub">Admin va ROP teng · kim birinchi qaror qilsa, ikkinchisida yopiladi</p></div>
            <div class="sc-seg" role="group">${[['pending', 'Kutilmoqda'], ['approved', 'Tasdiqlangan'], ['rejected', 'Rad etilgan'], ['returned', 'Qaytarilgan'], ['all', 'Hammasi']].map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${k === filter}">${l}${k !== 'all' && counts[k] ? ' ' + counts[k] : ''}</button>`).join('')}</div></div>
          <div class="sc-note">Tasdiq so'raydi: tarif yoki narx · jadval · asosiy ustoz. Ism, telefon, login va parolni menejer o'zi tuzatadi — faqat tarixga yoziladi.</div>
          <div class="sc-lay2"><section class="sc-card sc-inbox">${list.map((r, i) => `<button type="button" class="sc-it" data-i="${i}"><span class="sc-grow"><b>${esc(r.requester_name)} · ${esc(REQ_KIND[r.kind])}</b><small>${esc(r.student_name || '')}</small><small>${esc(new Date(r.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))} · №${esc(r.number)}</small></span>${reqPill(r)}</button>`).join('') || '<p class="sc-mt sc-pad">So\'rov yo\'q</p>'}</section>
          <section class="sc-card" data-detail><p class="sc-mt sc-pad">So'rovni tanlang</p></section></div>`;
        root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { root.dataset.filter = b.dataset.f; renderApprovals(root); });
        const open = i => { root.querySelectorAll('.sc-it').forEach(x => x.classList.toggle('sel', x.dataset.i === String(i))); approvalDetail(root, list[i]); };
        root.querySelectorAll('.sc-it').forEach(b => b.onclick = () => open(Number(b.dataset.i)));
        if (list.length) open(0);
    }
    const reqPill = r => `<span class="sc-pill ${{ pending: 'sc-pill--warn', approved: 'sc-pill--ok', rejected: 'sc-pill--bad', returned: 'sc-pill--mute' }[r.status]}">${{ pending: 'Kutilmoqda', approved: 'Tasdiqlandi', rejected: 'Rad etildi', returned: 'Qaytarildi' }[r.status]}</span>`;
    function approvalDetail(root, r) {
        const el = root.querySelector('[data-detail]');
        const s = studentById(r.student_id) || {};
        const ch = r.changes || {};
        const rows = [];
        if (r.kind === 'teacher') rows.push(['Asosiy ustoz', teacherName(s.teacherId), teacherName(ch.teacherId)], ['Qachondan', '—', ch.from ? fmtDate(ch.from) : '—']);
        if ('tariff' in ch) rows.push(['Tarif', s.tariff || '—', ch.tariff]);
        if ('monthlyPrice' in ch) rows.push(['Oylik narx', s.monthlyPrice ? formatMoney(s.monthlyPrice) : '—', formatMoney(ch.monthlyPrice)]);
        if ('lessonDuration' in ch || 'lessonTime' in ch) rows.push(['Jadval', `${pattern(s.lessonDayOfWeek)} ${s.lessonTime || ''} · ${s.lessonDuration || ''} daq`, `${pattern(ch.lessonDay ?? s.lessonDayOfWeek)} ${ch.lessonTime || s.lessonTime} · ${ch.lessonDuration || s.lessonDuration} daq`]);
        if (ch.effectiveFrom && r.kind !== 'teacher') rows.push(['Qachondan', '—', fmtDate(ch.effectiveFrom)]);
        const pending = r.status === 'pending';
        el.innerHTML = `<header class="sc-ch"><h2>${esc(r.student_name || s.name || '')} · ${r.kind === 'teacher' ? 'ustozni almashtirish' : 'tarif o\'zgarishi'}</h2><span class="sc-mt">№${esc(r.number)} · ${esc(r.requester_name)}</span></header>
          <div class="sc-pad">
            <div class="sc-row sc-req"><span class="sc-grow"><b>${esc(r.requester_name)}</b><span class="sc-mt"> · o'z sotgan o'quvchisi · ${esc(new Date(r.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}</span></span><button type="button" class="sc-btn" data-card>Kartani ochish</button></div>
            <h3>Nima o'zgaradi</h3><table class="sc-df-t"><thead><tr><th></th><th>Hozir</th><th></th><th>So'ralgan</th></tr></thead><tbody>${rows.map(([l, a, b]) => `<tr${String(a) === String(b) ? ' class="same"' : ''}><td>${esc(l)}</td><td>${esc(a)}</td><td>${String(a) === String(b) ? '=' : '→'}</td><td><b>${esc(b)}</b></td></tr>`).join('')}</tbody></table>
            <h3>Menejer sababi</h3><blockquote class="sc-quote">${esc(r.reason)}</blockquote>
            ${pending ? `<h3>Qaror</h3><div class="sc-dec" role="radiogroup">
              <label class="sc-dc sc-dc--ok"><input type="radio" name="dec" value="approve"><b>Tasdiqlash</b><small>server bo'sh vaqtni qayta tekshiradi</small></label>
              <label class="sc-dc sc-dc--no"><input type="radio" name="dec" value="reject"><b>Rad etish</b><small>sabab majburiy</small></label>
              <label class="sc-dc"><input type="radio" name="dec" value="return"><b>Qaytarish</b><small>menejer tuzatib qayta yuboradi</small></label></div>
              <textarea name="note" rows="2" class="sc-mtop" placeholder="Izoh (rad etish va qaytarishda majburiy)"></textarea>`
            : `<div class="sc-note">${reqPill(r)} ${esc(r.decided_by_name || '')} · ${r.decided_at ? esc(new Date(r.decided_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })) : ''}${r.decision_note ? ' — ' + esc(r.decision_note) : ''}</div>`}
          </div>
          ${pending ? `<footer class="sc-df"><span class="sc-mt">Avval qarorni tanlang</span><button type="button" class="sc-btn sc-btn--pri" data-save disabled>Qarorni saqlash</button></footer>` : ''}`;
        el.querySelector('[data-card]').onclick = () => openStudent(r.student_id);
        if (!pending) return;
        const save = el.querySelector('[data-save]');
        const note = el.querySelector('[name=note]');
        el.querySelectorAll('[name=dec]').forEach(i => i.onchange = () => { save.disabled = false; note.placeholder = i.value === 'approve' ? 'Izoh (ixtiyoriy)' : 'Sabab (majburiy) — menejerga boradi'; note.required = i.value !== 'approve'; });
        save.onclick = async () => {
            const decision = el.querySelector('[name=dec]:checked')?.value;
            if (decision !== 'approve' && note.value.trim().length < 3) { note.focus(); return toast('Sababni yozing'); }
            busy(save, true);
            try { await post(`/edit-requests/${r.id}/decide`, { decision, note: note.value.trim() }); toast('Qaror saqlandi'); await refreshCache(); renderApprovals(root); }
            catch (e) { busy(save, false); toast(e.message, 4000); }
        };
    }

    // ── Telegram guruhlar (admin, ROP) ───────────────────────────────────────
    async function renderGroups(root) {
        await loadStaffAvatars();
        root.innerHTML = '<div class="sc-skel"></div>';
        let d; try { d = await api('/groups'); } catch (e) { root.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        const q = (root.dataset.q || '').toLowerCase();
        const list = d.groups.filter(g => !q || g.name.toLowerCase().includes(q) || String(g.student_name).toLowerCase().includes(q));
        const noLink = d.groups.filter(g => !g.tg_link && !g.archived).length, auto = d.groups.filter(g => g.name_source === 'auto').length;
        root.innerHTML = `<div class="sc-head"><div><h1>Telegram guruhlar</h1><p class="sc-sub">Har o'quvchining individual guruhi · a'zolar: o'quvchi, ustoz, yordamchi, ROP, sotuv menejeri · nomni bosing — Telegram ochiladi</p></div>
          ${isFull() ? '<button type="button" class="sc-btn" data-auto>Eski guruhlarga nom berish</button>' : ''}</div>
          <div class="sc-kpis"><div class="sc-kpi"><small>Guruhlar</small><b>${d.groups.length}</b></div><div class="sc-kpi"><small>Avtomatik nom</small><b>${auto}</b><span>nomini tekshiring</span></div><div class="sc-kpi"><small>Havolasiz</small><b>${noLink}</b></div><div class="sc-kpi"><small>Keyingi nom</small><b class="sc-small">${esc(d.nextName)}</b></div></div>
          <section class="sc-card"><div class="sc-pad"><input type="search" placeholder="Guruh nomi yoki o'quvchi" value="${esc(root.dataset.q || '')}" data-q></div>
          <table class="sc-table"><thead><tr><th>Guruh</th><th>O'quvchi</th><th>Asosiy ustoz</th><th>Yordamchi</th><th>Nom</th><th></th></tr></thead><tbody>
          ${list.map(g => `<tr${g.archived ? ' class="is-muted"' : ''}><td>${tgPill(g)}</td><td><button type="button" class="sc-link" data-st="${esc(g.student_id)}">${esc(g.student_name)}</button></td><td>${esc(teacherName(g.teacher_id, true))}</td><td>${g.assistant_teacher_id ? esc(teacherName(g.assistant_teacher_id, true)) : '—'}</td>
            <td>${g.archived ? '<span class="sc-pill sc-pill--mute">arxiv</span>' : g.name_source === 'auto' ? '<span class="sc-pill sc-pill--warn">avtomatik</span>' : '<span class="sc-pill sc-pill--ok">qo\'lda</span>'}</td><td><button type="button" class="sc-btn sc-btn--sm" data-edit="${esc(g.student_id)}">Tahrirlash</button></td></tr>`).join('')}
          </tbody></table></section>`;
        const s = root.querySelector('[data-q]'); s.oninput = () => { root.dataset.q = s.value; clearTimeout(s._t); s._t = setTimeout(() => renderGroups(root).then(() => root.querySelector('[data-q]')?.focus()), 300); };
        root.querySelectorAll('[data-st]').forEach(b => b.onclick = () => openStudent(b.dataset.st));
        root.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openStudent(b.dataset.edit, 'tahrir'));
        root.querySelector('[data-auto]')?.addEventListener('click', async e => { busy(e.target, true); try { const r = await post('/groups/auto-name'); toast(`${r.named} ta guruhga nom berildi`); renderGroups(root); } catch (err) { busy(e.target, false); toast(err.message); } });
    }

    // ── Yordamchi aloqalari: admin ko'rinishi (tuzatish, kech belgilash, oy yopish) ──
    async function renderAssistAdmin(root) {
        await loadStaffAvatars();
        const month = root.dataset.month || today().slice(0, 7);
        const list = assistants();
        const aid = root.dataset.aid || list[0]?.id || '';
        root.innerHTML = '<div class="sc-skel"></div>';
        let rep = null, reqs = [];
        try {
            if (aid) rep = await api(`/assist/month?assistantId=${encodeURIComponent(aid)}&month=${month}`);
            reqs = (await api('/requests?status=new')).requests.filter(r => r.type === 'assist_late');
        } catch (e) { root.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        const st = rep?.state || {};
        const locked = month < today().slice(0, 7);
        const step = !locked ? 'Oy davom etmoqda' : !st.prelim_at ? 'Qulflangan · dastlabki tasdiq kutilmoqda' : !st.final_at ? `Dastlabki tasdiq · e'tiroz ${st.objection_until ? fmtDate(String(st.objection_until).slice(0, 10), false) + ' gacha' : ''}` : !st.paid_at ? 'Yakuniy tasdiq · to\'lov kutilmoqda' : 'To\'langan';
        root.innerHTML = `<div class="sc-head"><div><h1>Yordamchi aloqalari</h1><p class="sc-sub">Har o'quvchi bilan oyiga 13 tagacha × 3 846 so'm · kamida 5 daqiqa · "javob bermadi" hisoblanmaydi</p></div>
            <div class="sc-row"><select data-aid>${list.map(a => `<option value="${esc(a.id)}"${a.id === aid ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select><input type="month" value="${month}" data-month></div></div>
          ${reqs.length ? `<section class="sc-card"><header class="sc-ch"><h2>Kechikib belgilash so'rovlari · ${reqs.length}</h2></header>${reqs.map(r => `<div class="sc-it"><span class="sc-grow"><b>${esc(r.requester_name)} · ${esc(studentById(r.payload?.studentId)?.name || '')}</b><small>${esc(fmtDate(r.payload?.day))} · ${esc(r.payload?.channel || '')} ${esc(r.payload?.minutes || '')} daq — ${esc(r.reason)}</small></span><button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-late="${esc(r.id)}">Qo'shish</button></div>`).join('')}</section>` : ''}
          ${rep ? `<div class="sc-kpis"><div class="sc-kpi"><small>Hisoblangan</small><b>${rep.counted}</b><span>${formatMoney(rep.amount)}</span></div><div class="sc-kpi"><small>Javob bermadi</small><b>${rep.noAnswer}</b></div><div class="sc-kpi"><small>Limitdan ortiq</small><b>${rep.overCap}</b></div><div class="sc-kpi"><small>Holat</small><b class="sc-small">${esc(step)}</b></div></div>
          <section class="sc-card"><header class="sc-ch"><h2>O'quvchilar bo'yicha</h2>${isFull() && locked ? `<div class="sc-row">${!st.prelim_at ? '<button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-step="prelim">Dastlabki tasdiq</button>' : !st.final_at ? '<button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-step="final">Yakuniy tasdiq</button>' : !st.paid_at ? '<button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-step="paid">To\'landi</button>' : ''}</div>` : isFull() ? '<button type="button" class="sc-btn sc-btn--sm" data-add>+ Aloqani tuzatish</button>' : ''}</header>
          <table class="sc-table"><thead><tr><th>O'quvchi</th><th class="r">Hisoblangan</th><th class="r">Summa</th><th>Izoh</th></tr></thead><tbody>${rep.students.map(s => `<tr><td>${studentAvatar(studentById(s.studentId), 26)} ${esc(studentById(s.studentId)?.name || s.studentId)}</td><td class="r"><b>${s.counted}</b> / 13</td><td class="r">${formatMoney(s.amount)}</td><td class="sc-mt">${[s.noAnswer && `${s.noAnswer} javob bermadi`, s.overCap && `${s.overCap} ta limitdan ortiq`, s.short && `${s.short} ta 5 daqiqadan qisqa`].filter(Boolean).join(' · ') || '—'}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td>Jami</td><td class="r">${rep.counted}</td><td class="r">${formatMoney(rep.amount)}</td><td></td></tr></tfoot></table></section>` : '<p class="sc-mt">Yordamchi ustoz yo\'q</p>'}`;
        root.querySelector('[data-aid]').onchange = e => { root.dataset.aid = e.target.value; renderAssistAdmin(root); };
        root.querySelector('[data-month]').onchange = e => { root.dataset.month = e.target.value; renderAssistAdmin(root); };
        root.querySelectorAll('[data-step]').forEach(b => b.onclick = async () => { busy(b, true); try { await post(`/assist/months/${month}/${b.dataset.step}`); toast('Saqlandi'); renderAssistAdmin(root); } catch (e) { busy(b, false); toast(e.message, 4000); } });
        root.querySelectorAll('[data-late]').forEach(b => b.onclick = () => correctionDrawer(reqs.find(r => r.id === b.dataset.late), () => renderAssistAdmin(root)));
        root.querySelector('[data-add]')?.addEventListener('click', () => correctionDrawer({ teacher_id: aid, payload: {} }, () => renderAssistAdmin(root)));
    }
    function correctionDrawer(req, done) {
        const p = req.payload || {};
        const my = students().filter(s => s.assistantTeacherId === req.teacher_id);
        const box = openDrawer({ title: 'Aloqani tuzatish', sub: req.id ? `${esc(req.requester_name)} so'rovi` : 'Admin tuzatishi · sabab bilan tarixga yoziladi', body: `
            <div class="sc-g2">${field('O\'quvchi', `<select name="st">${my.map(s => `<option value="${esc(s.id)}"${s.id === p.studentId ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select>`)}
            ${field('Sana', `<input type="date" name="day" value="${esc(p.day || today())}" max="${today()}">`)}
            ${field('Usul', `<select name="ch">${Object.entries({ phone: 'Telefon', zoom: 'Zoom', meet: 'Google Meet', tg_video: 'Telegram video', tg_group: 'Telegram guruh videodars', tg_text: 'Telegram yozishma' }).map(([k, l]) => `<option value="${k}"${k === p.channel ? ' selected' : ''}>${l}</option>`).join('')}</select>`)}
            ${field('Davomiylik, daqiqa', `<input name="min" inputmode="numeric" value="${esc(p.minutes || '')}">`)}</div>
            ${field('Tuzatish sababi', `<textarea name="reason" rows="2">${esc(req.reason || '')}</textarea>`)}`,
            foot: '<button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Saqlash</button>' });
        box.querySelector('[data-save]').onclick = async e => {
            busy(e.target, true);
            try { await post('/assist/corrections', { studentId: val(box, 'st'), day: val(box, 'day'), channel: val(box, 'ch'), minutes: Number(val(box, 'min')), reason: val(box, 'reason'), requestId: req.id }); toast('Aloqa qo\'shildi'); closeDrawer(); done(); }
            catch (err) { busy(e.target, false); errBox(box, err.message); }
        };
    }

    window.schoolUI = Object.assign(window.schoolUI || {}, {
        api, post, esc, today, addDays, wd, weekStart, fmtDate, hm, toMin, pattern, DAY, DAY_FULL,
        studentAvatar, staffAvatar, staffAvatarUrl, tgPill, teacherName, studentById, teachersForSubject,
        openDrawer, closeDrawer, errBox, busy, field, impact, toast, refreshCache, nowMin,
        openStudent, renderApprovals, renderGroups, renderAssistAdmin, loadStaffAvatars
    });
})();
