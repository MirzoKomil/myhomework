// Sotuv menejeri: ustoz sinov darsi bo'yicha qaror qilganda (tasdiqladi / rad etdi / natija yozdi) — darhol popup.
// Ma'lumot lidning trialRequest maydonidan (server yozadi: acceptedAt, rejectedAt, completedAt); lidlar ro'yxati
// har bir necha soniyada serverdan yangilanadi. Har hodisa bir marta ko'rsatiladi (brauzerda belgilanadi).
// Telefon ilovasi va kompyuter uchun bir xil. Ko'rinish — css/staleLeads.css (.sl-sheet-wrap, .sl-sheet--pop) + .tp-*.
(function () {
    'use strict';
    const g = n => typeof window[n] === 'function';
    const FRESH = 12 * 3600000; // eski hodisalar (12 soatdan oldingi) popup bo'lib chiqmaydi — qo'ng'iroqcha ro'yxatida bor
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const user = () => (g('getCurrentUser') ? getCurrentUser() : null) || {};
    const lang = () => user().linkedManagerLang || 'russian';
    const ts = v => { const t = typeof v === 'number' ? v : Date.parse(v || ''); return Number.isFinite(t) ? t : 0; };
    const first = n => String(n || '').trim().split(/\s+/)[0] || '';
    const MON = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const hm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    const when = t => { const d = new Date(t), n = new Date(); const diff = Math.round((new Date(d.toDateString()) - new Date(n.toDateString())) / 86400000);
        return `${diff === 0 ? 'Bugun' : diff === 1 ? 'Ertaga' : diff === -1 ? 'Kecha' : `${d.getDate()}-${MON[d.getMonth()]}`} ${hm(t)}`; };
    const ic = (p, s = 20, w = 2.2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
    const I = { check: '<path d="M5 12l5 5L20 7"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>' };
    const teacherName = id => {
        if (!id || !g('getItem')) return 'Ustoz';
        const t = (getItem(STORAGE_KEYS.teachers, []) || []).find(x => String(x.id) === String(id));
        return t?.name ? first(t.name) : 'Ustoz';
    };

    const KEY = () => `dw_trial_seen_${user().id || user().login || 'u'}`;
    const loadSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY()) || '[]')); } catch (e) { return new Set(); } };
    const saveSeen = s => { try { localStorage.setItem(KEY(), JSON.stringify([...s].slice(-400))); } catch (e) { /* saqlab bo'lmasa ham ishlaydi */ } };

    function events() {
        if (user().role !== 'sales_manager' || !user().linkedManagerId || !g('getItem')) return [];
        const m = String(user().linkedManagerId), now = Date.now(), out = [];
        for (const l of (getItem(STORAGE_KEYS.leads, {})?.[lang()] || [])) {
            if (l.deletedAt || String(l.managerId) !== m) continue;
            const r = window.trialWorkflow?.request ? trialWorkflow.request(l) : l.trialRequest;
            if (!r || !r.id || String(r.id).startsWith('legacy:')) continue;
            const add = (kind, at) => { if (at) out.push({ key: `${r.id}:${kind}`, kind, at, lead: l, r, fresh: now - at <= FRESH }); };
            if (r.state === 'accepted') add('acc', ts(r.acceptedAt));
            if (r.state === 'rejected') add('rej', ts(r.rejectedAt));
            if (r.state === 'completed') add('done', ts(r.completedAt));
        }
        return out.sort((a, b) => a.at - b.at);
    }

    let seen = null, queue = [], el = null, booted = false;
    function scan() {
        if (!seen) return;
        const ev = events();
        let changed = false;
        for (const e of ev) {
            if (seen.has(e.key) || queue.some(q => q.key === e.key)) continue;
            if (!e.fresh) { seen.add(e.key); changed = true; continue; }
            queue.push(e);
        }
        if (changed) saveSeen(seen);
        if (!el && queue.length) show(queue.shift());
    }

    function show(e) {
        const l = e.lead, r = e.r, t = teacherName(r.teacherId), at = ts(r.scheduledAt), name = esc(l.name || 'Lid');
        let tone, icon, title, body, acts;
        if (e.kind === 'acc') {
            tone = 'ok'; icon = I.check; title = `${esc(t)} sinov darsini tasdiqladi`;
            body = `<strong>${name}</strong>${at ? `<span>${when(at)} · ${esc(t)}</span>` : ''}<em>Lidga vaqtni eslatib qoʻying — sinovga kelishi ehtimoli oshadi.</em>`;
            acts = `<button type="button" class="sl-b sl-b--pri sl-b--xl" data-tp-sms>SMS bilan eslatish</button><button type="button" class="sl-b sl-b--out sl-b--xl" data-tp-ok>Yaxshi</button>`;
        } else if (e.kind === 'rej') {
            tone = 'bad'; icon = I.clock; title = `${esc(t)} bu vaqtda dars oʻta olmaydi`;
            const props = (Array.isArray(r.proposals) ? r.proposals : []).map(ts).filter(Boolean);
            body = `<strong>${name}</strong>${at ? `<span>${when(at)} · ${esc(r.reasonLabel || 'Vaqt toʻgʻri kelmadi')}</span>` : ''}
              ${r.rejectNote || r.note ? `<em>“${esc(r.rejectNote || r.note)}”</em>` : ''}
              ${props.length ? `<div class="tp-props"><span>Ustoz taklif qilgan vaqtlar:</span>${props.map(p => `<b>${when(p)}</b>`).join('')}</div>` : ''}
              <em>Lid bilan gaplashib, boshqa vaqt yoki boshqa ustozga qoʻying.</em>`;
            acts = `<button type="button" class="sl-b sl-b--pri sl-b--xl" data-tp-retrial>Boshqa vaqt qoʻyish</button><button type="button" class="sl-b sl-b--out sl-b--xl" data-tp-ok>Keyinroq</button>`;
        } else {
            const ok = r.attended === true;
            tone = ok ? 'ok' : 'warn'; icon = ok ? I.star : I.x; title = ok ? 'Sinov darsi oʻtkazildi' : 'Lid sinovga kelmadi';
            body = `<strong>${name}</strong><span>${esc(t)}${at ? ' · ' + when(at) : ''}</span>${r.resultNote ? `<em>“${esc(r.resultNote)}”</em>` : ''}
              <em>${ok ? 'Hozir qoʻngʻiroq qiling — taassurot yangi paytida qarorga olib keling.' : 'Qoʻngʻiroq qilib, sababini bilib, yangi vaqtga yozing.'}</em>`;
            acts = `<button type="button" class="sl-b sl-b--pri sl-b--xl" data-tp-open>Lidni ochish</button><button type="button" class="sl-b sl-b--out sl-b--xl" data-tp-ok>Keyinroq</button>`;
        }
        el = document.createElement('div');
        el.className = 'sl-sheet-wrap tp-wrap';
        el.innerHTML = `<button type="button" class="sl-sdim" data-tp-ok aria-label="Yopish"></button>
          <section class="sl-sheet sl-sheet--pop tp-pop tp-pop--${tone}" role="alertdialog" aria-modal="true" aria-labelledby="tpT" tabindex="-1">
            <div class="sl-center"><span class="tp-ic">${ic(icon, 34, 2.6)}</span><h2 id="tpT">${title}</h2><div class="tp-body">${body}</div></div>${acts}</section>`;
        document.body.appendChild(el);
        el.addEventListener('click', ev => onClick(ev, e));
        el.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); close(e); } });
        el.querySelector('.tp-pop')?.focus({ preventScroll: true });
        try { navigator.vibrate?.(e.kind === 'acc' ? [40, 60, 40] : 80); } catch (er) { /* tebranish yo'q */ }
    }
    function close(e) {
        seen.add(e.key); saveSeen(seen);
        el?.remove(); el = null;
        setTimeout(scan, 300);
    }
    function onClick(ev, e) {
        const t = ev.target.closest('[data-tp-ok],[data-tp-sms],[data-tp-retrial],[data-tp-open]');
        if (!t) return;
        const id = e.lead.id, lg = lang();
        close(e);
        if ('tpSms' in t.dataset) { if (g('openLeadSmsTemplateModal')) openLeadSmsTemplateModal(lg, id); return; }
        if ('tpRetrial' in t.dataset) { if (g('openRescheduleTrialLessonModal')) openRescheduleTrialLessonModal(lg, id); return; }
        if ('tpOpen' in t.dataset) {
            if (window.sotuvApp?.openLead && window.matchMedia('(max-width: 900px)').matches) window.sotuvApp.openLead(id);
            else if (g('openLeadOverview')) openLeadOverview(lg, id);
        }
    }

    function boot() {
        if (booted) return;
        const u = user();
        if (!u.role) return;
        booted = true;
        if (u.role !== 'sales_manager') return;
        seen = loadSeen();
        // Birinchi marta ishga tushganda — eski hodisalar "ko'rilgan" deb belgilanadi (popup yog'ilib ketmasin).
        let fresh0 = false;
        try { fresh0 = localStorage.getItem(KEY()) == null; } catch (e) { /* yo'q */ }
        const start = (n = 0) => {
            const ready = (getItem(STORAGE_KEYS.leads, null)?.[lang()] || []).length > 0;
            if (!ready && n < 40) { setTimeout(() => start(n + 1), 500); return; }
            if (fresh0) { events().forEach(e => seen.add(e.key)); saveSeen(seen); }
            scan();
            setInterval(scan, 5000);
            document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(scan, 800); });
        };
        start();
    }
    const tryBoot = (k = 0) => { boot(); if (!booted && k < 60) setTimeout(() => tryBoot(k + 1), 500); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => tryBoot()); else tryBoot();
    window.trialPopup = { scan, _events: events };
})();
