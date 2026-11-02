// Sotuv menejeri kompyuter kabineti — qo'ng'iroq navbati va "Qoʻngʻiroq qanday oʻtdi?" oynasi (dizayn SotKL_Call).
// Faqat ropDesk.isSot() (role = sales_manager, ekran > 900px). Telefon ilovasi (js/sotuvApp.js) o'zgarmaydi —
// navbat (callQueue) va natija (openCallResult / outcome) mantig'i o'sha fayldan ko'chirildi, ma'lumot o'sha funksiyalar
// orqali yoziladi: staleLeads.logCall (2 daqiqa ichidagi takror bosish — bitta urinish), updateLeadInStorage,
// createLeadComment, requestLeadStageChange (anketa, sabab, sana oynalari Lidlardagidek ochiladi).
// "Qoʻngʻiroq qildim" tugmasi YO'Q: urinish faqat tel: havolasi bosilganda yoziladi (qo'ng'iroqsiz "Sifatsiz"ga
// chetlab o'tish bo'lmasin). Urinishlar soni — staleLeads.attempts (bitta qo'ng'iroq = bitta urinish).
// Tashqi API: window.sotDesk.{ queue, queueCount, openQueue, queueBarHtml, queueCardHtml, bindQueue, openCallResult }.
(function () {
    'use strict';
    const SD = window.sotDesk = window.sotDesk || {};
    const RD = () => window.ropDesk || {};
    const on = () => !!RD().isSot?.();
    const g = n => (typeof window[n] === 'function' ? window[n] : null);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const user = () => (g('getCurrentUser') ? getCurrentUser() : null) || {};
    const mid = () => user().linkedManagerId;
    const lang = () => user().linkedManagerLang || 'russian';
    const st = l => (g('normalizeLeadStatus') ? normalizeLeadStatus(l.status) : (l.status || 'yangi-lidlar'));
    const parseT = v => { if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null; const t = Date.parse(v || ''); return Number.isFinite(t) ? t : null; };
    const telOf = v => String(v || '').replace(/[^\d+]/g, '');
    const DAY = 86400000;
    const hm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const when = t => {
        const d = new Date(t), now = new Date();
        const diff = Math.round((new Date(d.toDateString()) - new Date(now.toDateString())) / DAY);
        return `${diff === 0 ? 'Bugun' : diff === -1 ? 'Kecha' : diff === 1 ? 'Ertaga' : `${d.getDate()}-${MON[d.getMonth()].slice(0, 3)}`} ${hm(t)}`;
    };
    const dur = ms => { ms = Math.abs(ms); const h = Math.floor(ms / 3600000); if (h >= 24) return Math.floor(h / 24) + ' kun'; if (h >= 1) return h + ' soat'; return Math.max(1, Math.round(ms / 60000)) + ' daq'; };
    const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
    const colLabel = id => ((typeof LEAD_COLUMNS !== 'undefined' ? LEAD_COLUMNS : []).find(c => c.id === id) || {}).label || id;
    const kindLabel = l => (g('getLeadKind') ? (getLeadKind(l) === 'target' ? 'Target' : 'Organik') : (l.leadType === 'target' ? 'Target' : 'Organik'));
    const PATH = typeof LEAD_MAIN_PATH !== 'undefined' ? LEAD_MAIN_PATH : ['yangi-lidlar', 'boglanishga-urinilmoqda', 'boglanildi', 'sinov-darsida', 'qaror-jarayonida', 'tolov-jarayonida', 'tolov-yopildi'];
    const hasSurvey = l => !!(window.leadWorkflow?.hasCombinedSurvey && leadWorkflow.hasCombinedSurvey(l));
    const SVG = (d, w = 16, sw = 2.2) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
    const P = {
        phone: 'M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z',
        skip: 'M5 5l10 7-10 7zM19 5v14', lock: 'M7 11V7a5 5 0 0110 0v4M5 11h14v10H5z',
        talked: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z', noanswer: 'M12 3a9 9 0 110 18 9 9 0 010-18zM5.6 5.6l12.8 12.8',
        later: 'M12 3a9 9 0 110 18 9 9 0 010-18zM12 7v5l3 2', trial: 'M8.5 12l2.5 2.5 4.5-5M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z',
        pay: 'M2 6h20v13H2zM2 10h20', fail: 'M6 6l12 12M18 6L6 18'
    };

    // ---------- ma'lumot ----------
    const LEADS = () => {
        const m = String(mid() || ''); if (!m || !g('getItem')) return [];
        return ((getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) || {})[lang()] || []).filter(l => !l.deletedAt && String(l.managerId) === m);
    };
    const leadById = id => (g('getLeadById') ? getLeadById(lang(), id) : LEADS().find(l => String(l.id) === String(id)));
    const assignedAt = l => parseT(l.managerAssignedAt) || parseT(l.createdAt) || parseT(l.date);
    const lastCallAt = l => (Array.isArray(l.comments) ? l.comments : []).filter(c => c && (c.type === 'call-attempt' || c.type === 'contact-fail')).reduce((m, c) => Math.max(m, parseT(c.createdAt) || 0), 0);
    const attempts = l => (window.staleLeads?.attempts ? window.staleLeads.attempts(l) : (Array.isArray(l.comments) ? l.comments : []).filter(c => c && c.type === 'call-attempt').map(c => ({ t: parseT(c.createdAt) })));
    function home() {
        try { return g('computeManagerHome') ? computeManagerHome({ user: user(), managerId: mid(), leads: getItem(STORAGE_KEYS.leads, {}), students: getItem(STORAGE_KEYS.students, []), now: new Date() }) : null; } catch (e) { return null; }
    }
    // Navbat (sotuvApp.js callQueue bilan bir xil): avval SLA o'tgan yangi lidlar va eslatmalar (computeManagerHome),
    // keyin "Urinilmoqda" va "Yangi" — eng uzoq vaqt qo'ng'iroq qilinmagani birinchi.
    function callQueue(d, leads) {
        const own = new Set(leads.map(l => l.id));
        const base = [...(d?.next?.lead ? [d.next.lead] : []), ...(d?.queue || [])].filter(l => own.has(l.id));
        const seen = new Set(base.map(l => l.id));
        const extra = leads.filter(l => !seen.has(l.id) && ['boglanishga-urinilmoqda', 'yangi-lidlar'].includes(st(l)) && telOf(l.phone))
            .sort((a, b) => (lastCallAt(a) - lastCallAt(b)) || ((assignedAt(a) || 0) - (assignedAt(b) || 0)));
        return [...base, ...extra].filter((l, i, a) => a.findIndex(x => x.id === l.id) === i).map(l => leadById(l.id) || l);
    }
    let cache = null;
    function queue() {
        if (!on()) return { d: null, list: [] };
        if (cache && Date.now() - cache.at < 2500) return cache.v;
        const d = home(); const v = { d, list: callQueue(d, LEADS()) };
        cache = { at: Date.now(), v };
        return v;
    }
    const invalidate = () => { cache = null; };
    const S = { skip: 0, opener: null, wrap: null, cur: null };
    function current() {
        const { d, list } = queue();
        const idx = list.length ? S.skip % list.length : 0;
        const next = list[idx] || null;
        let chip = null;
        if (next) {
            const fromD = d?.next?.lead && d.next.lead.id === next.id ? d.next : null;
            if (fromD?.reason === 'sla') chip = ['SLA oʻtdi · ' + dur(fromD.ms), 'red'];
            else if (fromD?.reason === 'late') chip = ['Kechikdi · ' + hm(fromD.at), 'red'];
            else if (fromD?.reason === 'today') chip = [hm(fromD.at) + ' · ' + dur(fromD.at - Date.now()) + ' qoldi', 'amber'];
            else if (st(next) === 'boglanishga-urinilmoqda') { const a = assignedAt(next); chip = [`${a ? Math.max(0, Math.floor((Date.now() - a) / DAY)) + ' kun · ' : ''}${attempts(next).length} urinish`, 'gray']; }
            else if (fromD) chip = ['Yangi · ' + dur(fromD.ms) + ' qoldi', 'blue'];
            else { const f = g('getLeadNextFollowUp') ? getLeadNextFollowUp(next) : null; if (f) chip = [(f.overdue ? 'Kechikdi · ' : '') + hm(f.at), f.overdue ? 'red' : 'amber']; }
        }
        const lc = next ? lastCallAt(next) : 0;
        const meta = next ? [colLabel(st(next)), lc ? 'oxirgi qoʻngʻiroq: ' + when(lc).toLowerCase() : (st(next) === 'boglanishga-urinilmoqda' ? 'hali qoʻngʻiroq yoʻq' : ''), kindLabel(next)].filter(Boolean).join(' · ') : '';
        const up = list.length > 1 ? [...list.slice(idx + 1), ...list.slice(0, idx)] : [];
        return { list, idx, next, chip, meta, up };
    }
    SD.queue = () => queue().list;
    SD.queueCount = () => { try { return queue().list.length; } catch (e) { return 0; } };

    // ---------- navbat paneli (Lidlar, dizayn SotKL_Call "KEYINGI QOʻNGʻIROQ") ----------
    SD.queueBarHtml = function () {
        if (!on()) return '';
        const q = current();
        if (!q.next) return `<section class="sdq sdq--calm" aria-label="Navbatdagi qoʻngʻiroq"><span class="sdq-ok" aria-hidden="true">✓</span><span><strong>Hamma lidlar bilan gaplashilgan</strong><em>Qoʻngʻiroq kutayotgan lid yoʻq</em></span></section>`;
        const ph = telOf(q.next.phone);
        return `<section class="sdq" id="sdQueue" aria-label="Navbatdagi qoʻngʻiroq">
            <div class="sdq-h"><span class="sdq-k">KEYINGI QOʻNGʻIROQ · ${q.idx + 1} / ${q.list.length}</span>${q.chip ? `<span class="sdq-chip sdq-chip--${q.chip[1]}">${esc(q.chip[0])}</span>` : ''}</div>
            <button type="button" class="sdq-n" data-sd-open="${esc(q.next.id)}" aria-haspopup="dialog" title="Lid kartasini ochish"><strong>${esc(q.next.name || 'Lid')}</strong><span>${esc(q.meta)}</span></button>
            ${ph ? `<a class="sdq-call" href="tel:${esc(ph)}" data-sd-call="${esc(q.next.id)}" aria-haspopup="dialog" title="Qoʻngʻiroq: ${esc(g('formatPhoneDisplay') ? formatPhoneDisplay(q.next.phone) : q.next.phone)} — natija oynasi ochiladi">${SVG(P.phone, 16)}Qoʻngʻiroq qilish</a>` : `<button type="button" class="sdq-call" data-sd-open="${esc(q.next.id)}">Lidni ochish</button>`}
            ${q.list.length > 1 ? `<button type="button" class="sdq-skip" data-sd-skip aria-label="Keyingi lidga oʻtish" title="Oʻtkazib yuborish — keyingi lid">${SVG(P.skip, 16)}</button>` : ''}
            ${q.up.length ? `<div class="sdq-next" aria-label="Navbatda keyin">${q.up.slice(0, 3).map((l, i) => `<button type="button" data-sd-open="${esc(l.id)}" aria-haspopup="dialog" title="${esc((l.name || '') + ' · ' + colLabel(st(l)))}">${i === 0 ? 'Keyin: ' : ''}${esc(firstName(l.name) || 'Lid')}</button>`).join('')}${q.up.length > 3 ? `<span>+${q.up.length - 3}</span>` : ''}</div>` : ''}
        </section>`;
    };
    // Bosh sahifa kartasi (dizayn SotKHome "KEYINGI QOʻNGʻIROQ"): mobil navbat + kobalt kartasi matnlari.
    SD.queueCardHtml = function () {
        if (!on()) return '';
        const q = current();
        if (!q.next) return `<section class="sdh-next" aria-labelledby="sdhNextH"><span class="sdh-eb">NAVBAT BOʻSH</span><h2 id="sdhNextH">Bugungi qoʻngʻiroqlar tugadi</h2><p class="sdh-nnote">Yangi lid biriktirilishi bilan shu yerda chiqadi.</p></section>`;
        const l = q.next, ph = telOf(l.phone);
        const note = Array.isArray(l.comments) ? [...l.comments].reverse().find(c => c && c.text && !['call-attempt', 'follow-up-reminder'].includes(c.type)) : null;
        const phTxt = g('formatPhoneDisplay') ? formatPhoneDisplay(l.phone) : l.phone;
        const src = (g('leadSourceName') ? leadSourceName(l.source) : l.source) || kindLabel(l);
        return `<section class="sdh-next" id="sdQueue" aria-labelledby="sdhNextH">
            <span class="sdh-eb">KEYINGI QOʻNGʻIROQ · ${q.idx + 1} / ${q.list.length}</span>
            <h2 id="sdhNextH">${esc(l.name || 'Lid')}</h2>
            <span class="sdh-dsub">${esc([phTxt, q.meta].filter(Boolean).join(' · '))}</span>
            <div class="sdh-chips">${q.chip ? `<span class="sdh-dchip sdh-dchip--${q.chip[1]}">${esc(q.chip[0])}</span>` : ''}<span class="sdh-dchip">${esc(src)}</span></div>
            ${note ? `<p class="sdh-nnote">Oxirgi izoh: «${esc(String(note.text).slice(0, 140))}»</p>` : ''}
            ${q.up.length ? `<div class="sdh-q" aria-label="Navbatdagilar">${q.up.slice(0, 3).map((x, i) => `<button type="button" data-sd-open="${esc(x.id)}" aria-haspopup="dialog">${i === 0 ? 'Keyin: ' : ''}${esc(firstName(x.name) || 'Lid')}</button>`).join('')}${q.up.length > 3 ? `<span>va yana ${q.up.length - 3} ta</span>` : ''}</div>` : ''}
            <div class="sdh-nact">
                ${ph ? `<a class="sdh-call" href="tel:${esc(ph)}" data-sd-call="${esc(l.id)}" aria-haspopup="dialog">${SVG(P.phone, 17)}Qoʻngʻiroq qilish</a>` : ''}
                <button type="button" class="sdh-ghost" data-sd-open="${esc(l.id)}" aria-haspopup="dialog">Lidni ochish</button>
                ${q.list.length > 1 ? `<button type="button" class="sdh-skip" data-sd-skip aria-label="Keyingi lidga oʻtish" title="Keyingi lidga oʻtish">${SVG(P.skip, 16)}</button>` : ''}
            </div></section>`;
    };
    // Navbat tugmalari (lid ochish, o'tkazib yuborish). Qo'ng'iroq — umumiy tel: ushlagichi (pastda).
    SD.bindQueue = function (root) {
        if (!root || root.dataset.sdqBound) return;
        root.dataset.sdqBound = '1';
        root.addEventListener('click', e => {
            const o = e.target.closest('[data-sd-open]');
            if (o) { e.preventDefault(); g('openLeadOverview') && openLeadOverview(lang(), o.dataset.sdOpen); return; }
            if (e.target.closest('[data-sd-skip]')) { e.preventDefault(); S.skip++; refresh(); setTimeout(() => document.querySelector('#sdQueue [data-sd-skip]')?.focus(), 0); }
        });
    };
    // Sidebar "Lidlar" badge'i: Lidlar ochiladi, navbat paneliga fokus.
    SD.openQueue = function () {
        setTimeout(() => {
            const q = document.querySelector('#sdLeadsTop #sdQueue');
            if (!q) return;
            q.scrollIntoView({ block: 'nearest' });
            (q.querySelector('.sdq-call') || q).focus?.({ preventScroll: true });
            q.classList.remove('sd-flash'); void q.offsetWidth; q.classList.add('sd-flash');
        }, 80);
    };

    // Joriy ko'rinishni yangilash (navbat, badge'lar, doska yoki Bosh sahifa).
    function refresh() {
        invalidate();
        try {
            if (document.getElementById('tab-sales')?.classList.contains('active') && g('renderLeads')) renderLeads();
            else if (document.getElementById('tab-dashboard')?.classList.contains('active') && g('renderDashboard')) renderDashboard();
        } catch (e) { /* keyingi chizishda yangilanadi */ }
        try { RD().refreshBadges?.(); } catch (e) { /* sidebar yo'q */ }
    }
    SD.refreshQueue = refresh;

    // ---------- "Qoʻngʻiroq qanday oʻtdi?" (sotuvApp.js openCallResult / outcome) ----------
    const OUTS = l => {
        const s = st(l), before = PATH.indexOf(s) >= 0 && PATH.indexOf(s) < PATH.indexOf('boglanildi'), locked = before && !hasSurvey(l);
        return { before, list: [
            ['talked', 'Gaplashdik', before ? 'anketa ochiladi' : '', 'blue'],
            ['noanswer', 'Javob bermadi', 'urinishlar: ' + attempts(l).length, 'red'],
            ['later', 'Keyin oladi', 'sana soʻraladi', 'amber'],
            ['trial', 'Sinovga yozildi', locked ? 'anketadan keyin' : 'vaqt tanlanadi', 'green', locked],
            ['pay', 'Toʻlov qiladi', locked ? 'anketadan keyin' : 'toʻlov qadamlari', 'blue', locked],
            ['fail', 'Qiziqmaydi', 'sabab soʻraladi', 'gray']
        ] };
    };
    const BTN = before => ({ talked: before ? 'Saqlash va anketaga oʻtish' : 'Saqlash', noanswer: 'Saqlash', later: 'Saqlash va sanani tanlash', trial: 'Saqlash va vaqt tanlash', pay: 'Saqlash va toʻlovga oʻtish', fail: 'Saqlash va sabab' });
    const CHIPS = ['Narxni soʻradi', 'Oila bilan maslahatlashadi', 'Kechqurun qulay', 'Ish uchun', 'Farzandi uchun'];
    const localIso = t => { const d = new Date(t); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
    function quickTimes() {
        const n = new Date(), out = [['1 soatdan keyin', localIso(Date.now() + 3600000)]];
        const t18 = new Date(n.getFullYear(), n.getMonth(), n.getDate(), 18, 0); if (t18 > n) out.push(['Bugun 18:00', localIso(t18)]);
        out.push(['Ertaga 10:00', localIso(new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 10, 0))]);
        return out;
    }

    function openCallResult(id, opener) {
        if (!on()) return;
        const l = leadById(id); if (!l) return;
        const s = st(l);
        if (['tolov-yopildi', 'muvaffaqiyatsiz-sotuv', 'sifatsiz-lidlar'].includes(s)) return; // yopilgan lidga natija so'ralmaydi
        closeResult(true);
        S.opener = opener && opener.isConnected ? opener : document.activeElement;
        S.cur = { id: String(l.id), pick: '', before: OUTS(l).before };
        const at = attempts(l), prev = at.length > 1 ? at[at.length - 2] : null;
        const phTxt = g('formatPhoneDisplay') ? formatPhoneDisplay(l.phone) : l.phone;
        const o = OUTS(l);
        const n = at.length;
        const wrap = document.createElement('div');
        wrap.className = 'sdc-wrap';
        wrap.innerHTML = `<div class="sdc-dim" aria-hidden="true"></div>
          <section class="sdc" role="dialog" aria-modal="true" aria-labelledby="sdcT" aria-describedby="sdcCnt" tabindex="-1" data-lead-id="${esc(l.id)}">
            <div class="sdc-h"><span class="sdc-ib">${SVG(P.phone, 22)}</span><div class="sdc-ht"><h2 id="sdcT">Qoʻngʻiroq qanday oʻtdi?</h2><span>${esc([l.name || 'Lid', colLabel(s), phTxt].filter(Boolean).join(' · '))}</span></div><button type="button" class="sdc-link" data-sdc-later title="Natijani keyin belgilash (Esc)">Keyin</button></div>
            <div class="sdc-cnt" id="sdcCnt">${SVG(P.phone, 14, 2.4)}<span>Qoʻngʻiroq qayd etildi${n ? ` · <b>${n}-urinish</b>` : ''}</span><span aria-hidden="true">·</span><span>${prev ? 'oldingisi: ' + esc(when(prev.t)) : 'birinchi qoʻngʻiroq'}</span></div>
            <div class="sdc-opts" role="radiogroup" aria-label="Natija" aria-required="true">${o.list.map((x, i) => `<button type="button" role="radio" aria-checked="false" tabindex="${i === 0 ? 0 : -1}" class="sdc-opt sdc-tone-${x[3]}${x[4] ? ' is-locked' : ''}" data-sdc-out="${x[0]}"><span class="sdc-oi" aria-hidden="true">${SVG(P[x[0]], 17)}</span><strong>${x[1]}</strong>${x[2] ? `<em>${x[4] ? SVG(P.lock, 13, 2.6) : ''}${esc(x[2])}</em>` : ''}</button>`).join('')}</div>
            <button type="button" class="sdc-link sdc-junk" data-sdc-junk>Notoʻgʻri raqam yoki boshqa til → Sifatsiz</button>
            ${s === 'boglanishga-urinilmoqda' && n >= 6 ? `<p class="sdc-hint6">Bu lidga ${n} marta qoʻngʻiroq qilingan. “Qiziqmaydi” → “Telefonini koʻtarmadi (6+ urinishdan soʻng)” sababini tanlash mumkin.</p>` : ''}
            <div class="sdc-fld"><span id="sdcNoteL">Qisqa izoh</span><div class="sdc-chips" role="group" aria-label="Tez izohlar">${CHIPS.map(t => `<button type="button" aria-pressed="false" data-sdc-chip>${esc(t)}</button>`).join('')}</div><textarea id="sdcNote" rows="2" maxlength="2000" aria-labelledby="sdcNoteL" placeholder="Nima deb kelishdingiz?"></textarea></div>
            <div class="sdc-fld" data-sdc-fu hidden><span id="sdcFuL">Keyingi qoʻngʻiroq <em>(ixtiyoriy · eslatma keladi, kartada “Qoʻngʻiroq · …” chiqadi)</em></span><div class="sdc-chips" role="group" aria-label="Tez vaqtlar">${quickTimes().map(q => `<button type="button" aria-pressed="false" data-sdc-fuq="${q[1]}">${q[0]}</button>`).join('')}</div><input id="sdcFu" type="datetime-local" min="${localIso(Date.now() + 60000)}" aria-labelledby="sdcFuL"><span class="sdc-err" data-sdc-fuerr role="alert" hidden>Vaqt hozirdan keyin boʻlsin</span></div>
            <span class="sdc-err" data-sdc-need role="alert" hidden>Natijani tanlang</span>
            <div class="sdc-ft"><span class="sdc-muted">Izoh lid tarixiga yoziladi</span><span class="sdc-sp"></span><button type="button" class="sdc-save" data-sdc-save aria-disabled="true">Natijani tanlang</button></div>
          </section>`;
        document.body.appendChild(wrap);
        S.wrap = wrap;
        document.body.classList.add('sdc-open');
        wrap.addEventListener('click', onClick);
        wrap.addEventListener('keydown', onKey);
        wrap.querySelector('#sdcNote').addEventListener('input', syncChips);
        wrap.querySelector('#sdcFu').addEventListener('input', () => { wrap.querySelectorAll('[data-sdc-fuq]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sdcFuq === wrap.querySelector('#sdcFu').value))); wrap.querySelector('[data-sdc-fuerr]').hidden = true; });
        setTimeout(() => wrap.querySelector('[data-sdc-out]')?.focus({ preventScroll: true }), 0);
    }
    SD.openCallResult = openCallResult;
    function closeResult(silent) {
        const w = S.wrap; if (!w) return;
        S.wrap = null; S.cur = null;
        w.remove();
        document.body.classList.remove('sdc-open');
        if (!silent) { const o = S.opener; S.opener = null; if (o && o.isConnected && o.focus) setTimeout(() => o.focus({ preventScroll: true }), 0); }
    }
    function pick(k) {
        const w = S.wrap; if (!w || !S.cur) return;
        S.cur.pick = k;
        w.querySelectorAll('[data-sdc-out]').forEach(b => { const v = b.dataset.sdcOut === k; b.setAttribute('aria-checked', String(v)); b.tabIndex = v ? 0 : -1; });
        const l = leadById(S.cur.id);
        const fu = w.querySelector('[data-sdc-fu]');
        fu.hidden = !((k === 'noanswer' && l && st(l) !== 'yangi-lidlar') || (k === 'talked' && !S.cur.before));
        const sv = w.querySelector('[data-sdc-save]');
        sv.setAttribute('aria-disabled', 'false'); sv.textContent = BTN(S.cur.before)[k] || 'Saqlash';
        w.querySelector('[data-sdc-need]').hidden = true;
    }
    function syncChips() {
        const w = S.wrap; if (!w) return;
        const v = w.querySelector('#sdcNote').value;
        w.querySelectorAll('[data-sdc-chip]').forEach(b => b.setAttribute('aria-pressed', String(v.includes(b.textContent.trim()))));
    }
    function onClick(e) {
        const w = S.wrap; if (!w) return;
        const t = e.target.closest('[data-sdc-out],[data-sdc-later],[data-sdc-junk],[data-sdc-chip],[data-sdc-fuq],[data-sdc-save]');
        if (!t) return;
        const d = t.dataset;
        if ('sdcOut' in d) return pick(d.sdcOut);
        if ('sdcLater' in d) return closeResult();
        if ('sdcJunk' in d) return save('junk');
        if ('sdcChip' in d) {
            const ta = w.querySelector('#sdcNote'), v = t.textContent.trim(), on2 = ta.value.includes(v);
            ta.value = on2 ? ta.value.replace(v, '').replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ',') : (ta.value ? ta.value.replace(/[.\s]+$/, '') + ', ' : '') + v;
            syncChips(); return;
        }
        if ('sdcFuq' in d) {
            const i = w.querySelector('#sdcFu'); i.value = i.value === d.sdcFuq ? '' : d.sdcFuq;
            w.querySelectorAll('[data-sdc-fuq]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sdcFuq === i.value)));
            w.querySelector('[data-sdc-fuerr]').hidden = true; return;
        }
        if ('sdcSave' in d) {
            if (!S.cur?.pick) { w.querySelector('[data-sdc-need]').hidden = false; w.querySelector('[data-sdc-out]')?.focus(); return; }
            save(S.cur.pick);
        }
    }
    function onKey(e) {
        const w = S.wrap; if (!w) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeResult(); return; }
        const r = e.target.closest?.('[data-sdc-out]');
        if (r && /^(Arrow(Left|Right|Up|Down)|Home|End)$/.test(e.key)) {
            e.preventDefault();
            const all = [...w.querySelectorAll('[data-sdc-out]')]; const i = all.indexOf(r);
            const n = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : (i + (/Right|Down/.test(e.key) ? 1 : -1) + all.length) % all.length;
            all[n].focus(); pick(all[n].dataset.sdcOut); return;
        }
        if (e.key !== 'Tab') return;
        const f = [...w.querySelectorAll('button:not([disabled]), a[href], textarea, input')].filter(x => x.offsetParent !== null && !(x.getAttribute('role') === 'radio' && x.tabIndex < 0));
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }

    // Natijani yozish (sotuvApp.js outcome bilan bir xil): izoh — qo'ng'iroq haqidagi fakt, keyingi oyna bekor qilinsa
    // ham tarixda qoladi. "Javob bermadi" — "contact-fail" (urinish emas, staleLeads.attempts). Keyingi qo'ng'iroq —
    // "follow-up-reminder" (openLeadFollowUpReminderModal bilan bir xil yozuv), eng oxirida yoziladi.
    function save(k) {
        const w = S.wrap, cur = S.cur; if (!w || !cur) return;
        const l = leadById(cur.id); if (!l) { closeResult(); return; }
        if (window.davomat?.guardLead?.()) return; // ish kuni tugagan — yangi lid harakati yopiq
        const s = st(l), u = user(), id = cur.id;
        const note = w.querySelector('#sdcNote').value.trim();
        const fuBox = w.querySelector('[data-sdc-fu]');
        const fuV = !fuBox.hidden ? w.querySelector('#sdcFu').value : '';
        const fuAt = fuV ? new Date(fuV) : null;
        if (fuV && (!fuAt || Number.isNaN(fuAt.getTime()) || fuAt.getTime() <= Date.now())) { w.querySelector('[data-sdc-fuerr]').hidden = false; w.querySelector('#sdcFu').focus(); return; }
        const add = [];
        const mk = (o, extra = {}) => { const c = { ...createLeadComment(o), ...extra }; return c; };
        if (note) add.push(mk({ text: note, author: u.name, type: 'manual' }));
        let toastT = '';
        let moveTo = '';
        if (k === 'talked') {
            if (cur.before) moveTo = 'boglanildi';
            else { if (!note) add.push(mk({ text: 'Qoʻngʻiroq: gaplashildi', author: u.name, type: 'manual' })); toastT = 'Tarixga yozildi'; }
        } else if (k === 'noanswer') {
            if (s === 'yangi-lidlar') moveTo = 'boglanishga-urinilmoqda';
            else {
                const r = (typeof LEAD_CONTACT_FAIL_REASONS !== 'undefined' ? LEAD_CONTACT_FAIL_REASONS : []).find(x => x.id === 'no-answer');
                add.push(mk({ text: `Qo'ng'iroq qilindi, lekin: ${r?.label || 'Javob bermadi'}`, author: u.name, type: 'contact-fail', reason: r?.label || 'Javob bermadi', reasonId: 'no-answer' }));
                toastT = `“Javob bermadi” yozildi · ${attempts(l).length}-urinish`;
            }
        } else moveTo = { later: 'keyin-sotib-olmoqchi', trial: 'sinov-darsida', pay: 'tolov-jarayonida', fail: 'muvaffaqiyatsiz-sotuv', junk: 'sifatsiz-lidlar' }[k] || '';
        if (fuAt && !moveTo) {
            const whenTxt = g('formatCommentTime') ? formatCommentTime(fuAt.toISOString()) : fuAt.toLocaleString();
            add.push(mk({ text: `Bog'lanish uchun eslatma: ${whenTxt}`, author: u.name, type: 'follow-up-reminder' }, { reminderAt: fuAt.toISOString() }));
        }
        if (add.length && g('updateLeadInStorage')) {
            updateLeadInStorage(lang(), id, x => {
                const b = g('normalizeLeadExtras') ? normalizeLeadExtras(x) : x;
                const ids = new Set((b.comments || []).map(c => c && c.id));
                add.forEach(c => { while (ids.has(c.id)) c.id = c.id + '_' + Math.random().toString(36).slice(2, 6); ids.add(c.id); });
                return { ...b, comments: [...(b.comments || []), ...add] };
            });
        }
        closeResult(!!moveTo);
        if (moveTo) { if (g('requestLeadStageChange')) requestLeadStageChange(lang(), id, moveTo); invalidate(); setTimeout(() => RD().refreshBadges?.(), 0); return; }
        refresh();
        if (toastT && g('showMiniToast')) showMiniToast(toastT + (fuAt ? ` · keyingi qoʻngʻiroq: ${g('formatLeadFollowUpWhen') ? formatLeadFollowUpWhen(fuAt.getTime()) : fuV}` : (k === 'noanswer' ? ' · eslatma qoʻyilmadi' : '')), 5000);
    }

    // ---------- tel: havolalari ----------
    // Karta (rk-ph), navbat, Bosh sahifa, lid kartasi (openLeadOverview) va qotgan lidlar qulfi: bosilganda urinish
    // yoziladi (staleLeads.logCall, 2 daqiqa dedupe) va natija oynasi ochiladi. tel: navigatsiyasi to'xtatilmaydi.
    let ovLead = null;
    const wrapOv = () => {
        const o = window.openLeadOverview;
        if (typeof o !== 'function' || o.__sdc) return;
        const fn = function (lg, id) { ovLead = { lang: lg, id }; return o.apply(this, arguments); };
        fn.__sdc = true; window.openLeadOverview = fn;
    };
    function leadOfLink(a) {
        if (a.dataset.sdCall) return a.dataset.sdCall;
        const sl = a.closest('[data-sl-call]'); if (sl) return sl.dataset.slCall;
        const card = a.closest('.lead-card[data-lead-id]'); if (card) return (card.dataset.leadLang || lang()) === lang() ? card.dataset.leadId : null;
        if (a.closest('#modalOverlay .lov-phones') && ovLead && ovLead.lang === lang()) return ovLead.id;
        return null;
    }
    document.addEventListener('click', e => {
        if (!on()) return;
        const a = e.target.closest?.('a[href^="tel:"]'); if (!a) return;
        const id = leadOfLink(a); if (!id) return;
        const fromGate = !!a.closest('[data-sl-call]');
        // Qulf oynasi o'zi logCall qiladi (staleLeads onClick); qolganlarida shu yerda.
        if (!fromGate) { try { window.staleLeads?.logCall?.(id); } catch (er) { /* dalil yozilmasa ham qo'ng'iroq ochiladi */ } }
        invalidate();
        if (a.closest('#modalOverlay')) { try { g('closeModal') && closeModal(); } catch (er) { /* oyna yo'q */ } }
        const opener = fromGate ? null : a;
        // Qulf: staleLeads 400 ms dan keyin qayta chizadi (fokusni oladi) — natija oynasi undan keyin, qulf ustida ochiladi.
        setTimeout(() => { openCallResult(id, opener); RD().refreshBadges?.(); }, fromGate ? 520 : 30);
    });

    // Sidebar badge va navbat lidlar o'zgarganda yangilanadi (renderLeads / renderDashboard chaqirilganda).
    const boot = () => { wrapOv(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
    setTimeout(boot, 1500);
})();
