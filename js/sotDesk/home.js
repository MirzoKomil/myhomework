// Sotuv menejeri kompyuter kabineti — Bosh sahifa (dizayn SotKHome). Faqat ropDesk.isSot() (>900px).
// renderManagerHome (app.js) o'zgarmaydi va o'chirilmaydi: renderDashboardOverview o'raladi, keyin #managerHome
// bezatiladi — "Keyingi qoʻngʻiroq" kartasi mobil navbat bilan (js/sotDesk/call.js), qotgan lidlar banneri
// (staleLeads), "Bugun" plitkalari (sotuvApp.js todayCalls bilan bir xil hisob), bugungi sinov darslari ro'yxati;
// "Bugungi obed" va "Oy reytingi" o'ng ustunga ko'chiriladi. Ma'lumot — mavjud funksiyalar (computeManagerHome …).
(function () {
    'use strict';
    const SD = window.sotDesk = window.sotDesk || {};
    const on = () => !!window.ropDesk?.isSot?.();
    const g = n => (typeof window[n] === 'function' ? window[n] : null);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const user = () => (g('getCurrentUser') ? getCurrentUser() : null) || {};
    const mid = () => user().linkedManagerId;
    const lang = () => user().linkedManagerLang || 'russian';
    const st = l => (g('normalizeLeadStatus') ? normalizeLeadStatus(l.status) : (l.status || 'yangi-lidlar'));
    const parseT = v => { if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null; const t = Date.parse(v || ''); return Number.isFinite(t) ? t : null; };
    const hm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
    const mln = n => String(Math.round((Number(n) || 0) / 1e5) / 10).replace('.', ',') + ' mln';
    const LEADS = () => {
        const m = String(mid() || ''); if (!m || !g('getItem')) return [];
        return ((getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) || {})[lang()] || []).filter(l => !l.deletedAt && String(l.managerId) === m);
    };
    const trialAt = l => parseT(l.trialRequest?.scheduledAt) || parseT(l.trialLessonAt);
    const teacherName = id => { if (!id || !g('getItem')) return ''; const t = (getItem(STORAGE_KEYS.teachers, []) || []).find(x => String(x.id) === String(id)); return t?.name || ''; };

    // Bugungi qo'ng'iroqlar (sotuvApp.js todayCalls): "call-attempt" (tel: bosilganda) va undan keyingi natija izohlari.
    function todayCalls(leads, now = new Date()) {
        const k = dayKey(now), out = { calls: 0, leads: 0, got: 0 };
        for (const l of leads) {
            const cs = (Array.isArray(l.comments) ? l.comments : []).filter(Boolean);
            const mine = cs.filter(c => c.type === 'call-attempt' && parseT(c.createdAt) && dayKey(parseT(c.createdAt)) === k);
            if (!mine.length) continue;
            out.calls += mine.length; out.leads++;
            const lastCall = Math.max(...mine.map(c => parseT(c.createdAt)));
            const after = cs.filter(c => parseT(c.createdAt) >= lastCall && c.type !== 'call-attempt');
            const failed = after.some(c => c.type === 'contact-fail');
            const moved = parseT(l.slaStageEnteredAt) >= lastCall;
            if (!failed && (moved || after.length)) out.got++;
        }
        return out;
    }

    function staleHtml() {
        const SL = window.staleLeads; if (!SL?.compute) return '';
        let d; try { d = SL.compute(); } catch (e) { return ''; }
        const list = d.warn.concat(d.lock); if (!list.length) return '';
        const names = list.slice(0, 3).map(l => `${l.name || 'Lid'} (${SL.ageDays(l)} kun)`).join(', ') + (list.length > 3 ? ` va yana ${list.length - 3} ta` : '');
        return `<div class="sdh-stale" role="status"><span class="sdh-stale-i" aria-hidden="true">⏳</span><span class="sdh-stale-t"><b>${list.length} ta lid ${d.rule.warnDays} kundan ortiq “Urinilmoqda”da:</b> ${esc(names)}. ${d.lock.length ? 'Baʼzilarini hoziroq “Sifatsiz”ga oʻtkazish shart.' : 'Qotgan lidlar qoidasiga koʻra qoʻngʻiroq qiling yoki natijasini yozing.'}</span><button type="button" class="sd-btn2" data-sdh-go="stale">Lidlarga</button></div>`;
    }
    function todayHtml(d) {
        const leads = LEADS(), now = new Date();
        const tc = todayCalls(leads, now);
        const goal = Math.max(1, Number(window.staleLeads?.rule?.()?.callsPerDay) || 30);
        const trials = leads.filter(l => st(l) === 'sinov-darsida' && trialAt(l) && dayKey(trialAt(l)) === dayKey(now)).sort((a, b) => trialAt(a) - trialAt(b));
        const paying = leads.filter(l => st(l) === 'tolov-jarayonida');
        const paySum = paying.reduce((a, l) => a + (Number(l.paymentSurvey?.debtAmount || l.paymentSurvey?.amount || 0) || 0), 0);
        const deals = Number(d?.deals || 0);
        return `<section class="sdh-today-s" aria-labelledby="sdhTodayH">
            <div class="sdh-ph"><h2 id="sdhTodayH">Bugun</h2><span class="sdh-hint">qoʻngʻiroq tugmasi va natija izohlaridan</span></div>
            <div class="sdh-today">
              <button type="button" class="sdh-tt" data-sdh-go="leads"><span>Qoʻngʻiroq</span><strong>${tc.calls}<small> / ${goal}</small></strong><i class="sdh-tbar" aria-hidden="true"><b style="width:${Math.min(100, Math.round(tc.calls / goal * 100))}%"></b></i><em>${tc.calls >= goal ? 'Maqsad bajarildi' : `${goal - tc.calls} ta qoldi`}</em></button>
              <button type="button" class="sdh-tt" data-sdh-go="leads"><span>Lidlar · javob oldi</span><strong>${tc.leads}<small> · ${tc.got} javob</small></strong><em class="${tc.leads ? 'is-g' : ''}">${tc.leads ? Math.round(tc.got / tc.leads * 100) + '% javob oldi' : 'hali yoʻq'}</em></button>
              <button type="button" class="sdh-tt" data-sdh-go="trial"><span>Bugungi sinov</span><strong>${trials.length}</strong><em class="is-g">${trials.length ? 'birinchisi ' + hm(trialAt(trials[0])) + ' da' : 'sinov qoʻyish'}</em></button>
              <button type="button" class="sdh-tt" data-sdh-go="pay"><span>Toʻlov jarayonida</span><strong>${paying.length}<small> ta lid</small></strong><em>${paying.length ? (paySum ? mln(paySum) + ' kutilmoqda' : 'toʻlov kutilmoqda') : `hozir yoʻq${deals ? ` · ${deals} ta toʻlov yopilgan` : ''}`}</em></button>
            </div></section>`;
    }
    function trialsHtml() {
        const now = new Date();
        const trials = LEADS().filter(l => st(l) === 'sinov-darsida' && trialAt(l) && dayKey(trialAt(l)) === dayKey(now)).sort((a, b) => trialAt(a) - trialAt(b));
        return `<section class="card ahx-card sdh-trials" aria-labelledby="sdhTrH"><div class="ahx-card-h"><h3 id="sdhTrH">Bugungi sinov darslari</h3></div>
            ${trials.length ? `<div role="list">${trials.map(l => { const rq = window.trialWorkflow?.request ? trialWorkflow.request(l) : l.trialRequest; const tn = teacherName(rq?.teacherId || l.trialRequest?.teacherId || l.paymentOnboarding?.teacherId); const lbl = rq?.attended === true ? 'qatnashdi' : ''; return `<div class="sdh-trial" role="listitem"><time>${hm(trialAt(l))}</time><div><strong>${esc(l.name || 'Lid')}</strong><span>${esc([tn ? 'Ustoz ' + tn : 'Ustoz biriktirilmagan', lbl].filter(Boolean).join(' · '))}</span></div><button type="button" class="btn-secondary-sm mhx-btn" data-sdh-lead="${esc(l.id)}">Lidni ochish</button></div>`; }).join('')}</div>` : '<p class="mhx-sub" style="margin:0">Bugun sinov darsi yoʻq</p>'}</section>`;
    }

    function go(k) {
        if (k === 'trial') { document.querySelector('#sidebarMenu [data-rk="trial"]')?.click(); return; }
        document.querySelector('#sidebarMenu [data-rk="leads"]')?.click();
        if (k === 'stale') setTimeout(() => window.ropDesk?.leads?.showStale?.(), 60);
        if (k === 'pay') setTimeout(() => document.querySelector('#leadsKanban .lead-column[data-status="tolov-jarayonida"]')?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' }), 80);
    }

    function decorate() {
        if (!on()) return;
        const root = document.getElementById('managerHome'); if (!root) return;
        root.classList.add('sdh');
        let d = null;
        try { d = g('computeManagerHome') ? computeManagerHome({ user: user(), managerId: mid(), leads: getItem(STORAGE_KEYS.leads, {}), students: getItem(STORAGE_KEYS.students, []), now: new Date() }) : null; } catch (e) { d = null; }
        // Sarlavha: o'ngda "soat HH:MM holatiga".
        const head = root.querySelector('.mhx-head');
        if (head && !head.querySelector('.sdh-asof')) head.insertAdjacentHTML('beforeend', `<span class="sdh-asof">soat ${hm(Date.now())} holatiga</span>`);
        // Keyingi qo'ng'iroq — navbat (call.js); kobalt kartasi o'rnida.
        const top = root.querySelector('.kbx-top');
        const nx = top?.querySelector('.kbx-next');
        if (nx && SD.queueCardHtml) { const t = document.createElement('template'); t.innerHTML = SD.queueCardHtml().trim(); if (t.content.firstElementChild) nx.replaceWith(t.content.firstElementChild); }
        if (top) SD.bindQueue?.(top);
        // Qotgan lidlar banneri + "Bugun" plitkalari — reja/navbat qatoridan keyin.
        if (top) top.insertAdjacentHTML('afterend', staleHtml() + todayHtml(d));
        // "Bugungi obed" va "Oy reytingi" — o'ng ustunga (voronka ostiga), bugungi sinovlar — chap ustunga.
        const sides = root.querySelectorAll('.mhx-grid > .mhx-side');
        const goal = root.querySelector(':scope > .mot-home');
        if (sides[1]) {
            if (goal) sides[1].appendChild(goal);
            const board = root.querySelector(':scope > .mhx-board'); if (board) sides[1].appendChild(board);
        }
        if (sides[0]) sides[0].insertAdjacentHTML('beforeend', trialsHtml());
        root.querySelectorAll('[data-sdh-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.sdhGo)));
        root.querySelectorAll('[data-sdh-lead]').forEach(b => b.addEventListener('click', () => g('openLeadOverview') && openLeadOverview(lang(), b.dataset.sdhLead)));
    }
    SD.decorateHome = decorate;

    function wrap() {
        const orig = window.renderDashboardOverview;
        if (typeof orig !== 'function' || orig.__sdh) return !!orig?.__sdh;
        const fn = function () { const r = orig.apply(this, arguments); try { decorate(); } catch (e) { console.warn('[sotDesk] bosh sahifa', e.message); } return r; };
        fn.__sdh = true; window.renderDashboardOverview = fn;
        return true;
    }
    if (!wrap()) setTimeout(wrap, 0);
})();
