// Rasmsiz davomat (dizayn: "CRM — barcha dizaynlar" → Rasmsiz davomat · Telefon / Kompyuter, RSZ_*; direktor 15-noy).
// Yuz namunasi hali tasdiqlanmagan kuzatiladigan xodim (sotuv, ROP, akademik rahbar, yordamchi) uchun vaqtinchalik tartib:
//  • Kabinet ochilganda (telefon VA kompyuter) majburiy oyna «Hozir ofisdamisiz?» →
//      Ha: kelgan vaqtini o'zi yozadi (hozirdan keyin emas, 05:00 dan oldin emas) → joylashuv (GPS 150 m yoki ofis interneti)
//      Yo'q: yo'ldaman (15 daq keyin yana) / bugun kelmayman (Javob so'rash) / tashqarida ishlayapman (sabab, rahbar tasdiqlaydi)
//  • Ish tugagach: «Ishni qachon tugatdingiz?» — Ketdim (vaqt) / Ketmadim (1 soatdan keyin yana, 23:00 gacha)
//  • Ketish belgilanmagan kun bo'lsa — keyingi kirishda birinchi shu so'raladi («Keyingi kun» — yarim tundan keyin)
//  • Bir kunda bir marta, server bo'yicha (telefonda belgilasa kompyuterda so'ralmaydi). Jarima yozilmaydi.
//  • HR yuzni tasdiqlagan zahoti oyna yo'qoladi — davomat Face ID bilan (js/davomatApp.js).
// Server: POST /api/staff-attendance/me/manual. Uslublar: css/davomatRasmsiz.css. Host uchun: window.davomatRsz.
(function () {
    'use strict';
    const API = '/api/staff-attendance';
    const OUT_REASONS = ['Mijoz bilan uchrashuv', 'Kasalman', 'Oilaviy sabab', 'Boshqa'];
    const ABS_REASONS = ['Kasalman', 'Oilaviy sabab', 'Taʼtil / dam olish', 'Boshqa'];
    const PEND = 'rsz_pending';
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ls = {
        get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* */ } },
        del: k => { try { localStorage.removeItem(k); } catch (e) { /* */ } },
    };
    const token = () => ls.get('mh_token') || '';
    const user = () => { try { return (typeof getCurrentUser === 'function' ? getCurrentUser() : null) || JSON.parse(ls.get('mh_currentUser') || 'null') || {}; } catch (e) { return {}; } };
    const tk = () => { const d = new Date(Date.now() + 5 * 3600000); return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; };
    const pm = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '').trim()); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
    const hm = n => `${String(Math.floor(((n % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((n % 60) + 60) % 60).padStart(2, '0')}`;
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const WD = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
    const dayLabel = d => { const x = new Date(d + 'T00:00:00Z'); return `${x.getUTCDate()}-${MON[x.getUTCMonth()]}, ${WD[x.getUTCDay()]}`; };
    const km = m => m == null ? '' : m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`;
    const mobile = () => window.matchMedia('(max-width: 900px)').matches;
    const ICON = {
        pin: '<path d="M12 21s-7-6.1-7-11.5A7 7 0 0119 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
        check: '<path d="M5 12l5 5L20 7"/>', exit: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', alert: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
        cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/>',
        chev: '<path d="M9 6l6 6-6 6"/>', wifi: '<path d="M2 9a16 16 0 0120 0M5 12.5a11 11 0 0114 0M8.5 16a6 6 0 017 0M12 19.5h.01"/>', phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    };
    const ic = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ''}</svg>`;

    const S = { me: null, loadedAt: 0, view: null, busy: false, loc: null, err: null, booted: false, dismissedFor: '' };
    let ov = null, toastEl = null;

    async function api(path, body) {
        const opts = { method: body !== undefined ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' }, cache: 'no-store' };
        if (body !== undefined) opts.body = JSON.stringify(body);
        let r;
        try { r = await fetch(API + path, opts); } catch (e) { throw Object.assign(new Error('Internet yoʻq'), { offline: true }); }
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error(j.error || 'Xatolik'), { status: r.status });
        return j;
    }
    const on = () => !!token() && !!user().id && user().role !== 'student';
    const active = () => !!(S.me && S.me.tracked && S.me.face !== 'approved' && S.me.rsz);
    const dayOf = () => { const m = S.me; if (!m) return null; const wd = new Date(m.date + 'T00:00:00Z').getUTCDay() || 7; return (m.days || {})[String(wd)] || null; };

    async function load(force) {
        if (!on()) return null;
        if (!force && Date.now() - S.loadedAt < (S.me && !S.me.tracked ? 600000 : 50000)) return S.me; // kuzatilmaydigan xodim — 10 daqiqada bir
        try { S.me = await api('/me'); S.loadedAt = Date.now(); } catch (e) { return S.me; }
        return S.me;
    }

    // Qaysi majburiy oyna kerak: 'yesterday' | 'ask' | 'leave' | null
    function needed() {
        if (!active()) return null;
        const m = S.me, r = m.rsz, now = tk().min, day = dayOf(), t = m.today || {};
        const later = r.askAt && Date.parse(r.askAt) > Date.now();
        if (r.openDay) return 'yesterday';
        if (pending()) return null; // internetsiz saqlangan kelish yuborilishini kutmoqda
        if (!t.inClock) {
            if (!day || later) return null;
            const end = pm(day.end), start = pm(day.start);
            if (end != null && now >= end) return null; // kun tugagan — ertaga
            if (start != null && now < start - 180) return null; // juda erta
            if ((m.requests || []).some(q => q.type === 'absent' && q.state !== 'rejected')) return null;
            return 'ask';
        }
        if (!t.outClock && !t.openBreak) {
            const end = day ? pm(day.end) : null;
            if (end == null || now < end || now >= pm(r.lastAsk || '23:00') || later) return null;
            return 'leave';
        }
        return null;
    }

    // ---------- oyna ----------
    function close() { if (ov) { ov.remove(); ov = null; } S.view = null; S.err = null; document.documentElement.classList.remove('rsz-open'); }
    function render(view, opts = {}) {
        S.view = view; S.opts = opts;
        if (!ov) {
            ov = document.createElement('div');
            ov.className = 'rsz-ov';
            ov.addEventListener('click', onClick);
            ov.addEventListener('input', onInput);
            ov.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.rsz-time')) { e.preventDefault(); ov.querySelector('[data-rsz-primary]')?.click(); } });
            document.body.appendChild(ov);
            document.documentElement.classList.add('rsz-open');
        }
        ov.innerHTML = `<section class="rsz-box" role="dialog" aria-modal="true" aria-labelledby="rszT">${VIEWS[view](opts)}</section>`;
        const f = ov.querySelector('.rsz-time, [data-rsz-focus]');
        if (f) setTimeout(() => f.focus(), 30);
    }
    const head = (icon, tone, title, sub) => `<span class="rsz-ic rsz-${tone}">${ic(icon, 30)}</span><h2 id="rszT">${title}</h2>${sub ? `<p class="rsz-sub">${sub}</p>` : ''}`;
    const LOCKN = '<p class="rsz-lock">Bu oyna javob berilmaguncha yopilmaydi.</p>';
    const timeField = (label, val, hint, err) => `<label class="rsz-field"><span>${label}</span><input class="rsz-time${err ? ' rsz-bad' : ''}" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="09:55" value="${esc(val)}" aria-invalid="${err ? 'true' : 'false'}"></label>
        <p class="rsz-hint${err ? ' rsz-hint-bad' : ''}" data-rsz-hint>${esc(err || hint)}</p>`;
    const opt = (attr, icon, tone, t, s) => `<button type="button" class="rsz-opt" ${attr}><span class="rsz-${tone}-t">${ic(icon, 22)}</span><span class="rsz-col"><b>${t}</b><small>${s}</small></span>${ic('chev', 18)}</button>`;

    const VIEWS = {
        ask: () => head('pin', 'blue', 'Hozir ofisdamisiz?', 'Yuz namunangiz hali ulanmagan. Shu vaqtgacha davomat joylashuv orqali belgilanadi.')
            + `<button type="button" class="rsz-btn rsz-pri" data-rsz="yes" data-rsz-focus>${ic('check', 18)}Ha, ofisdaman</button>
               <button type="button" class="rsz-btn" data-rsz="no">Yoʻq, ofisda emasman</button>${LOCKN}`,
        time: o => `<h2 id="rszT">Ofisga nechida keldingiz?</h2>${timeField('Kelgan vaqtingiz', o.clock ?? hm(tk().min), `Hozir ${hm(tk().min)}. Oldinroq kelgan boʻlsangiz, oʻsha vaqtni yozing. Hozirdan keyingi vaqt yozilmaydi.`, o.err)}
            <div class="rsz-note">${ic('pin', 18)}<span>${mobile() ? 'Saqlashda joylashuvingiz bir marta tekshiriladi: ofis atrofida ' + esc(S.me?.office?.radius || 150) + ' m. Telefon ruxsat soʻrasa — «Ruxsat berish».' : 'Brauzer joylashuv soʻraydi. Kompyuterda joylashuv noaniq boʻlishi mumkin — telefonda belgilash ishonchliroq. Ofis internetidan kirgan boʻlsangiz, avtomatik tasdiqlanadi.'}</span></div>
            <button type="button" class="rsz-btn rsz-pri" data-rsz="saveIn" data-rsz-primary>${ic('pin', 18)}Tekshirish va saqlash</button>
            <button type="button" class="rsz-btn" data-rsz="back">Orqaga</button>`,
        checking: () => `<h2 id="rszT">Joylashuv aniqlanmoqda…</h2><div class="rsz-bar"><i></i></div><p class="rsz-hint">15 soniyagacha. Natija oʻzi chiqadi.</p>`,
        where: () => `<h2 id="rszT">Hozir qayerdasiz?</h2>
            ${opt('data-rsz="onway"', 'clock', 'blue', 'Yoʻldaman, hali yetib kelmadim', '15 daqiqadan keyin yana soʻraymiz')}
            ${opt('data-rsz="absent"', 'cal', 'amber', 'Bugun ofisga kelmayman', 'Sabab rahbaringizga boradi · u tasdiqlaydi')}
            ${opt('data-rsz="outside"', 'brief', 'vio', 'Ofisdan tashqarida ishlayapman', 'Sabab majburiy · rahbaringiz tasdiqlaydi')}
            <button type="button" class="rsz-btn" data-rsz="back">Orqaga</button>`,
        absent: o => `<h2 id="rszT">Bugun ofisga kelmayman</h2><p class="rsz-sub">Soʻrov rahbaringizga boradi · u tasdiqlaydi</p>
            <fieldset class="rsz-fs"><legend>Sabab *</legend><div class="rsz-grid">${ABS_REASONS.map((r, i) => `<label class="rsz-radio"><input type="radio" name="rszA" value="${esc(r)}" ${i === 0 ? 'checked' : ''}><span>${esc(r)}</span></label>`).join('')}</div></fieldset>
            <label class="rsz-field"><span>Izoh</span><textarea rows="2" maxlength="500" data-rsz-note></textarea></label>
            ${o.err ? `<p class="rsz-hint rsz-hint-bad">${esc(o.err)}</p>` : ''}
            <button type="button" class="rsz-btn rsz-pri" data-rsz="sendAbsent" data-rsz-primary>Yuborish</button>
            <button type="button" class="rsz-btn" data-rsz="no">Orqaga</button>`,
        outside: o => `<h2 id="rszT">Ofisdan tashqarida ishlayapman</h2><p class="rsz-sub">Sabab rahbaringizga boradi · u tasdiqlaydi</p>
            <fieldset class="rsz-fs"><legend>Sabab *</legend><div class="rsz-grid">${OUT_REASONS.map((r, i) => `<label class="rsz-radio"><input type="radio" name="rszR" value="${esc(r)}" ${i === 0 ? 'checked' : ''}><span>${esc(r)}</span></label>`).join('')}</div></fieldset>
            <label class="rsz-field"><span>Izoh</span><textarea rows="2" maxlength="500" data-rsz-note placeholder="Masalan: mijoz bilan Navoiy koʻchasida, 12:00 da qaytaman"></textarea></label>
            ${o.err ? `<p class="rsz-hint rsz-hint-bad">${esc(o.err)}</p>` : ''}
            <button type="button" class="rsz-btn rsz-pri" data-rsz="sendOutside" data-rsz-primary>Yuborish</button>
            <button type="button" class="rsz-btn" data-rsz="no">Orqaga</button>`,
        far: o => head('alert', 'red', 'Siz ofisda emassiz', `Joylashuvingiz ofisdan ${esc(km(o.distance))} uzoqda (ruxsat ${esc(S.me?.office?.radius || 150)} m). Kelish belgilanmadi.`)
            + `<button type="button" class="rsz-btn rsz-pri" data-rsz="retry">Qayta tekshirish</button>
               <button type="button" class="rsz-btn" data-rsz="no">Ofisda emasman — javob tanlash</button>
               <p class="rsz-hint rsz-c">Ofis ichida boʻlsangiz: Wi‑Fi va GPS yoniqligini tekshiring, deraza yonida qayta urinib koʻring.</p>`,
        lowacc: o => head('alert', 'amber', mobile() ? 'Joylashuv aniq emas' : 'Kompyuter joylashuvi aniq emas', `Aniqlik ±${esc(km(o.accuracy))} — ofisda ekaningizni tasdiqlab boʻlmadi.`)
            + (mobile() ? '<p class="rsz-hint">GPS yoqilganini tekshiring, deraza yoniga borib qayta urining.</p>'
                : '<div class="rsz-note">' + ic('phone', 18) + '<span>Telefoningizda Jamoa ilovasini (yoki telefon brauzerida myhomework.uz) oching — oʻsha yerda belgilang. Belgilangach bu oyna oʻzi yopiladi.</span></div>')
            + `<button type="button" class="rsz-btn rsz-pri" data-rsz="retry">Qayta tekshirish</button>
               ${mobile() ? '' : '<button type="button" class="rsz-btn" data-rsz="phoneDone">Telefonda belgiladim</button>'}
               <button type="button" class="rsz-btn" data-rsz="no">Ofisda emasman — javob tanlash</button>`,
        denied: () => head('pin', 'amber', 'Joylashuvga ruxsat kerak', 'Ruxsatsiz ofisda ekaningizni tekshira olmaymiz.')
            + `<div class="rsz-steps"><b>Jamoa ilovasida</b><span>Sozlamalar → Ilovalar → Jamoa → Ruxsatlar → Joylashuv → «Ilova ishlatilayotganda».</span>
               <b>Brauzerda</b><span>Manzil qatoridagi qulf belgisi → «Joylashuv» → «Ruxsat berish», keyin sahifani yangilang.</span></div>
               <button type="button" class="rsz-btn rsz-pri" data-rsz="retry">Ruxsat berdim — qayta tekshirish</button>
               <button type="button" class="rsz-btn" data-rsz="no">Ofisda emasman — javob tanlash</button>${LOCKN}`,
        offline: o => head('wifi', 'red', 'Internet yoʻq — keyin yuboriladi', `Kelish (${esc(o.clock)}) va joylashuv qurilmada saqlandi. Internet qaytgach oʻzi yuboriladi — kutib turmang.`)
            + `<button type="button" class="rsz-btn rsz-pri" data-rsz="flush">Hozir qayta urinish</button>
               <button type="button" class="rsz-btn" data-rsz="close">Yopish — keyin yuboriladi</button>`,
        error: o => head('alert', 'red', 'Saqlab boʻlmadi', esc(o.message || 'Xatolik'))
            + `<button type="button" class="rsz-btn rsz-pri" data-rsz="${esc(o.retry || 'back')}">Qayta urinish</button>`,
        leave: o => head('exit', 'blue', `Ish vaqtingiz ${esc(dayOf()?.end || '')} da tugadi`, 'Ishni qachon tugatdingiz?')
            + timeField('Ketgan vaqtingiz', o.clock ?? hm(tk().min), `Hozir ${hm(tk().min)}. Ertaroq tugatgan boʻlsangiz, oʻsha vaqtni yozing.`, o.err)
            + `<button type="button" class="rsz-btn rsz-pri" data-rsz="saveOut" data-rsz-primary>${ic('exit', 18)}Ketdim — saqlash</button>
               <button type="button" class="rsz-btn" data-rsz="stay">Ketmadim, hali ofisdaman</button>
               <p class="rsz-lock">«Ketmadim» — har soatda yana soʻraladi (${esc(S.me?.rsz?.lastAsk || '23:00')} gacha).</p>`,
        early: o => head('alert', 'amber', 'Ish vaqti hali tugamagan', `Ish ${esc(dayOf()?.end || '')} da tugaydi. Hozir ketyapsizmi?`)
            + `<button type="button" class="rsz-btn rsz-pri" data-rsz="earlyYes" data-rsz-focus>Ha, hozir ketyapman (${hm(tk().min)})</button>
               <button type="button" class="rsz-btn" data-rsz="close">Yoʻq, qolaman</button>
               <p class="rsz-hint rsz-c">Ruxsat soʻramoqchi boʻlsangiz — «Javob soʻrash → Erta ketaman».</p>`,
        yesterday: o => { const od = S.me.rsz.openDay;
            return head('clock', 'amber', `${od.date === prevDate() ? 'Kecha' : esc(dayLabel(od.date))} ishni nechida tugatdingiz?`, `${esc(dayLabel(od.date))}. Kelgansiz ${esc(od.inClock)}, ketish belgilanmagan.`)
            + timeField('Ketgan vaqtingiz', o.clock ?? '', 'Masalan 19:40. Yarim tundan keyin ketgan boʻlsangiz — «Keyingi kun» ni belgilang.', o.err)
            + `<label class="rsz-check"><input type="checkbox" data-rsz-next ${o.nextDay ? 'checked' : ''}><span>Keyingi kun (00:00 dan keyin)</span></label>
               <button type="button" class="rsz-btn rsz-pri" data-rsz="saveYesterday" data-rsz-primary ${pm(o.clock) == null ? 'disabled' : ''}>Saqlash va davom etish</button>
               <p class="rsz-lock">Saqlangach bugungi «Ofisdamisiz?» chiqadi.</p>`; },
    };
    const prevDate = () => new Date(Date.parse(tk().date + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);

    function readTime() {
        const el = ov?.querySelector('.rsz-time'); const v = el ? el.value.trim() : '';
        return { v, m: pm(v) };
    }
    function onInput(e) {
        const el = e.target;
        if (el.matches('.rsz-time')) {
            let v = el.value.replace(/[^\d:]/g, '');
            if (/^\d{3,4}$/.test(v)) v = v.slice(0, v.length - 2) + ':' + v.slice(-2);
            if (v !== el.value) el.value = v;
            S.opts.clock = v;
            const b = ov.querySelector('[data-rsz="saveYesterday"]'); if (b) b.disabled = pm(v) == null;
        }
        if (el.matches('[data-rsz-next]')) S.opts.nextDay = el.checked;
    }
    function badTime(view, msg) { render(view, { ...S.opts, err: msg }); }

    function locate() {
        return new Promise(resolve => {
            if (!navigator.geolocation) return resolve({ error: 'none' });
            navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
                e => resolve({ error: e.code === 1 ? 'denied' : 'fail' }), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
        });
    }

    async function saveIn() {
        const { v, m } = readTime(); const now = tk().min;
        if (m == null) return badTime('time', 'Vaqtni 24 soat koʻrinishida yozing, masalan 09:55.');
        if (m > now) return badTime('time', `Hozirdan keyingi vaqt boʻlmaydi (hozir ${hm(now)}).`);
        if (m < 300) return badTime('time', 'Juda erta — vaqtni tekshiring.');
        S.inClock = hm(m);
        render('checking');
        const loc = await locate();
        if (loc.error === 'denied') return render('denied');
        const body = { action: 'in', clock: S.inClock, location: loc.error ? null : loc };
        try {
            const res = await api('/me/manual', body);
            if (!res.ok) {
                if (res.reason === 'outside') return render('far', { distance: res.distance });
                if (res.reason === 'low_accuracy' || res.reason === 'low_accuracy_phone') return render('lowacc', { accuracy: res.accuracy });
                if (res.reason === 'no_location') return loc.error === 'denied' ? render('denied') : render('lowacc', { accuracy: null });
                return render('error', { message: res.message, retry: 'retry' });
            }
            done(`Keldingiz: ${res.clock} deb yozildi`);
        } catch (e) {
            if (e.offline) { ls.set(PEND, JSON.stringify({ date: tk().date, body, savedAt: Date.now() })); return render('offline', { clock: S.inClock }); }
            render('error', { message: e.message, retry: 'back' });
        }
    }
    async function saveOut(view, extra = {}) {
        const { m } = readTime(); const now = tk().min;
        if (m == null) return badTime(view, 'Vaqtni 24 soat koʻrinishida yozing, masalan 20:05.');
        const isPast = view === 'yesterday';
        const inM = pm(isPast ? S.me.rsz.openDay.inClock : S.me.today?.inClock);
        if (!isPast && m > now) return badTime(view, `Hozirdan keyingi vaqt boʻlmaydi (hozir ${hm(now)}).`);
        if (!(isPast && S.opts.nextDay) && inM != null && m <= inM) return badTime(view, `Ketish kelgan vaqtingizdan (${hm(inM)}) keyin boʻlishi kerak.`);
        await send({ action: 'out', clock: hm(m), ...(isPast ? { date: S.me.rsz.openDay.date, nextDay: !!S.opts.nextDay } : {}), ...extra }, view);
    }
    async function send(body, view, msg) {
        if (S.busy) return; S.busy = true;
        try {
            const res = await api('/me/manual', body);
            S.busy = false;
            if (res.ok === false) return render('error', { message: res.message, retry: 'back' });
            if (body.action === 'out' && body.date) { await load(true); return decide(true, `Ketish ${res.clock} deb yozildi`); }
            done(msg || (body.action === 'out' ? `Ketish ${res.clock} deb yozildi. Xayr!` : 'Saqlandi'));
        } catch (e) {
            S.busy = false;
            if (e.offline) return badTime(view, 'Internet yoʻq. Ulanishni tekshirib qayta urinib koʻring.');
            badTime(view, e.message);
        }
    }
    async function done(msg) { close(); toast(msg); await load(true); paint(); }

    async function onClick(e) {
        const b = e.target.closest('[data-rsz]'); if (!b || b.disabled) return;
        const a = b.dataset.rsz;
        if (a === 'yes') return render('time', {});
        if (a === 'no') return render('where');
        if (a === 'back') return render(S.me?.today?.inClock ? 'leave' : 'ask', {});
        if (a === 'close') { S.dismissedFor = S.view === 'offline' ? 'pending' : S.dismissedFor; close(); paint(); return; }
        if (a === 'saveIn') return saveIn();
        if (a === 'retry') { if (S.inClock) { render('time', { clock: S.inClock }); return saveIn(); } return render('time', {}); }
        if (a === 'phoneDone') { await load(true); return decide(true, null, true); }
        if (a === 'onway' || a === 'stay') {
            try { await api('/me/manual', { action: 'answer', answer: a }); } catch (er) { /* oflayn — mahalliy */ }
            close(); toast(a === 'onway' ? 'Yetib kelgach «Ofisga keldim» ni bosing' : `Yaxshi. ${hm(tk().min + 60)} da yana soʻraymiz`);
            await load(true); paint(); return;
        }
        if (a === 'absent') return render('absent', {});
        if (a === 'sendAbsent') {
            const reason = ov.querySelector('input[name="rszA"]:checked')?.value || '';
            const comment = ov.querySelector('[data-rsz-note]')?.value || '';
            try { await api('/me/requests', { type: 'absent', date: tk().date, reason, comment }); done('Soʻrov yuborildi — rahbaringiz tasdiqlaydi'); }
            catch (er) { render('absent', { err: er.offline ? 'Internet yoʻq. Qayta urinib koʻring.' : er.message }); }
            return;
        }
        if (a === 'outside') return render('outside', {});
        if (a === 'sendOutside') {
            const reason = ov.querySelector('input[name="rszR"]:checked')?.value || '';
            const comment = ov.querySelector('[data-rsz-note]')?.value || '';
            if (!reason) return render('outside', { err: 'Sababni tanlang' });
            const loc = await locate();
            try { const r = await api('/me/manual', { action: 'outside', reason, comment, location: loc.error ? null : loc }); if (r.ok === false) throw new Error(r.message); done('Yuborildi — rahbaringiz tasdiqlaydi'); }
            catch (er) { render('outside', { err: er.offline ? 'Internet yoʻq. Qayta urinib koʻring.' : er.message }); }
            return;
        }
        if (a === 'saveOut') {
            const end = pm(dayOf()?.end); const { m } = readTime();
            if (end != null && m != null && m < end - 10 && tk().min < end) { S.earlyClock = hm(m); return render('early'); }
            return saveOut('leave');
        }
        if (a === 'earlyYes') return send({ action: 'out', clock: hm(tk().min) }, 'early');
        if (a === 'stay') return;
        if (a === 'saveYesterday') return saveOut('yesterday');
        if (a === 'flush') { await flush(); if (!pending()) close(); return; }
    }

    // ---------- internetsiz saqlangan kelish ----------
    const pending = () => { try { const p = JSON.parse(ls.get(PEND) || 'null'); if (p && p.date !== tk().date) { ls.del(PEND); return null; } return p; } catch (e) { return null; } };
    async function flush() {
        const p = pending(); if (!p) return;
        try {
            const res = await api('/me/manual', p.body);
            ls.del(PEND);
            if (res.ok) toast(`Keldingiz: ${res.clock} — yuborildi`);
            await load(true); paint(); decide(true);
        } catch (e) { if (!e.offline) { ls.del(PEND); toast(e.message); } }
    }

    // ---------- bosh sahifa kartasi (telefon) va kompyuter banneri ----------
    function cardInfo() {
        if (!active()) return null;
        const t = S.me.today || {}, day = dayOf(), p = pending();
        return { inClock: t.inClock || '', outClock: t.outClock || '', inEntered: t.inEnteredClock || '', method: t.inMethod || '', end: day?.end || '',
            pending: p ? p.body.clock : '', onWay: S.me.rsz.answer === 'onway' && !t.inClock };
    }
    function paint() {
        try { window.davomat?.refresh?.(); } catch (e) { /* */ }
        let bar = document.querySelector('.rsz-bar-top');
        const info = cardInfo();
        // Kompyuterda: kichik holat paneli (ekran yuqorisida), telefonda — davomat bosh kartasi (js/davomatApp.js).
        if (mobile() || !info || (!info.inClock && !info.pending)) { bar?.remove(); return; }
        if (!bar) { bar = document.createElement('div'); bar.className = 'rsz-bar-top'; document.body.appendChild(bar); bar.addEventListener('click', onBar); }
        const txt = info.pending ? `Kelish ${esc(info.pending)} · yuborilmoqda (internet kutilmoqda)`
            : info.outClock ? `Bugun: ${esc(info.inClock)} – ${esc(info.outClock)}`
            : `Keldingiz: ${esc(info.inClock)}${info.end ? ` · ish tugashi ${esc(info.end)}` : ''}`;
        bar.innerHTML = `<span class="rsz-pill">Rasmsiz</span><span>${txt}</span>${!info.outClock && info.inClock ? `<button type="button" class="rsz-mini" data-rszbar="leave">${ic('exit', 16)}Ketdim</button>` : ''}<button type="button" class="rsz-x" data-rszbar="hide" aria-label="Yashirish">×</button>`;
    }
    function onBar(e) {
        const b = e.target.closest('[data-rszbar]'); if (!b) return;
        if (b.dataset.rszbar === 'hide') { e.currentTarget.remove(); return; }
        leave();
    }
    function leave() {
        if (!active() || !S.me.today?.inClock || S.me.today?.outClock) return;
        const end = pm(dayOf()?.end);
        if (end != null && tk().min < end) return render('early');
        render('leave', {});
    }
    function arrive() { if (active() && !S.me.today?.inClock) render('time', {}); }

    // ---------- qachon ko'rsatish ----------
    function decide(force, msg, fromPhone) {
        if (!active()) { if (ov && !['offline'].includes(S.view)) close(); paint(); return; }
        const n = needed();
        if (msg) toast(msg);
        if (fromPhone && !n) { close(); toast(S.me.today?.inClock ? `Telefonda belgilandingiz: ${S.me.today.inClock}` : 'Saqlandi'); paint(); return; }
        if (!n) { if (ov && ['ask', 'leave', 'yesterday'].includes(S.view)) close(); paint(); return; }
        if (ov && !force) return; // foydalanuvchi oynada ishlayapti
        if (ov && force && S.view && !['ask', 'leave', 'yesterday', 'checking'].includes(S.view) && n !== 'yesterday') return;
        if (n === 'yesterday') render('yesterday', { clock: '' });
        else if (n === 'ask') { if (S.view !== 'ask') render('ask'); }
        else if (n === 'leave') { if (S.view !== 'leave') render('leave', {}); }
        paint();
    }
    async function tick(force) {
        if (!on()) return;
        await load(force);
        if (pending()) await flush();
        decide(false);
    }

    function toast(msg) {
        if (!msg) return;
        toastEl?.remove();
        toastEl = document.createElement('div');
        toastEl.className = 'rsz-toast'; toastEl.setAttribute('role', 'status');
        toastEl.innerHTML = `${ic('check', 18)}<span>${esc(msg)}</span>`;
        document.body.appendChild(toastEl);
        setTimeout(() => toastEl?.remove(), 4000);
    }

    function boot() {
        if (S.booted || !on()) return;
        S.booted = true;
        tick(true);
        setInterval(() => { if (document.visibilityState === 'visible') tick(false); }, 60000);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(true); });
        window.addEventListener('online', () => tick(true));
        document.addEventListener('click', e => { const b = e.target.closest('[data-rsz-card]'); if (!b) return; e.preventDefault(); if (b.dataset.rszCard === 'leave') leave(); else arrive(); });
    }
    function start() { if (!on()) { setTimeout(start, 1500); return; } boot(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.davomatRsz = { info: cardInfo, leave, arrive, refresh: () => tick(true), active };
})();
