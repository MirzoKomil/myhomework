// ROP kompyuter — "Nazorat" guruhi: Tasdiqlar (bezash), SLA (yangi sahifa), Qotgan lidlar qoidasi (sahifa; prod'da
// Lidlar'dagi modal ham qoladi), Arxiv (archiveCenter shu sahifaga ulanadi). Dizayn: RopK_Approvals, RopK_Sla,
// RopK_Stale, RopK_Archive. Faqat role=rop kompyuterda (pages-common.js).
(function () {
    'use strict';
    const P = window.ropDeskPages; if (!P) return;
    const U = P.U, esc = U.esc, g = U.g;
    const MIN = 60000, HOUR = 3600000, DAY = 86400000;
    const p2 = n => String(n).padStart(2, '0');
    const hm = t => { const d = new Date(t); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
    const dayWord = t => { const d = new Date(t), n = new Date(); const diff = Math.round((new Date(d.toDateString()) - new Date(n.toDateString())) / DAY);
        return diff === 0 ? 'bugun' : diff === -1 ? 'kecha' : `${p2(d.getDate())}.${p2(d.getMonth() + 1)}`; };
    const dur = ms => { const m = Math.max(0, Math.round(ms / MIN)); if (m < 60) return `${m} daq`; const h = Math.floor(m / 60); if (h < 24) return `${h} soat${m % 60 ? ` ${m % 60} daq` : ''}`; const d = Math.floor(h / 24); return `${d} kun${h % 24 ? ` ${h % 24} soat` : ''}`; };
    const ruleTxt = min => (min >= 1440 && min % 1440 === 0 ? `${min / 1440 * 24} soat` : min >= 60 ? `${Math.round(min / 60)} soat` : `${min} daq`);
    const STAGE = { 'yangi-lidlar': 'Yangi', 'boglanishga-urinilmoqda': 'Urinilmoqda', boglanildi: 'Bogʻlanildi', 'sinov-darsida': 'Sinov', 'qaror-jarayonida': 'Qaror', 'tolov-jarayonida': 'Toʻlovda', 'keyin-sotib-olmoqchi': 'Keyin oladi' };
    const st = l => (g('normalizeLeadStatus') ? normalizeLeadStatus(l.status) : l.status);
    const mgrById = id => U.managers().find(m => String(m.id) === String(id)) || (g('getItem') ? (getItem(STORAGE_KEYS.salesManagers, []) || []).find(m => String(m.id) === String(id)) : null);
    const tgOf = id => { const p = (g('getItem') ? getItem(STORAGE_KEYS.hrEmployees, []) : []).find(e => String(e.id) === String(id)) || mgrById(id); const ph = String(p?.phone || '').replace(/[^\d+]/g, ''); return ph ? `https://t.me/${ph.startsWith('+') ? ph : '+' + ph}` : ''; };

    // ================= Tasdiqlar (schoolUI.renderApprovals ustidan bezash) =================
    // Mantiq (server tekshiruvi, qaror, 409) o'zgarmaydi — faqat dizayn joylashuvi: sarlavha chipi, til izohi, ro'yxat
    // sarlavhasi, tekshiruv/oqibat yonma-yon, qaror bloki pastda doim ko'rinadi (A2), Moliya qatori sanaga bog'lanadi (A1).
    function decorateApprovals() {
        const root = document.getElementById('schoolApprovalsRoot');
        if (!root || !U.isRopDesk()) return;
        const head = root.querySelector(':scope > .sc-head');
        if (head && !head.dataset.rdp) {
            head.dataset.rdp = '1';
            head.querySelector('h1')?.insertAdjacentHTML('beforeend', `<span class="rdp-chip">${esc(U.langLabel())}</span>`);
            head.querySelectorAll('[data-f]').forEach(b => { const m = b.textContent.match(/^(.*?)\s+(\d+)$/); if (m) b.innerHTML = `${esc(m[1])} <b class="rdp-n">${m[2]}</b>`; });
        }
        const note = root.querySelector(':scope > .sc-note');
        if (note && !note.dataset.rdp) { note.dataset.rdp = '1'; note.insertAdjacentHTML('beforeend', ` Siz faqat ${esc(U.langLabel())} oʻquvchilari boʻyicha soʻrovlarni koʻrasiz.`); }
        const inbox = root.querySelector('.sc-inbox');
        if (inbox && !inbox.querySelector('.rdp-ap-lh')) {
            const n = inbox.querySelectorAll('.ad-ri').length;
            if (n) inbox.insertAdjacentHTML('afterbegin', `<div class="rdp-ap-lh"><span>${n} ta soʻrov</span><span>yangisi yuqorida</span></div>`);
        }
        const det = root.querySelector('[data-detail]');
        const body = det?.querySelector('.ad-apd');
        if (!body || body.dataset.rdp) return;
        body.dataset.rdp = '1';
        det.classList.add('rdp-ap-det');
        // Sarlavhada holat pilli (ro'yxatdagi tanlangan so'rovdan).
        const pill = root.querySelector('.ad-ri.sel .sc-pill');
        const ch = det.querySelector('.sc-ch');
        if (pill && ch && !ch.querySelector('.sc-pill')) ch.querySelector('.sc-mt')?.after(pill.cloneNode(true));
        const h3 = t => [...body.querySelectorAll(':scope > h3')].find(h => h.textContent.trim().toLowerCase().startsWith(t));
        // Server tekshiruvi + Tasdiqlansa — yonma-yon.
        const hs = h3('server'), hi = h3('tasdiqlansa');
        if (hs && hi) {
            const two = document.createElement('div'); two.className = 'rdp-ap-two';
            const a = document.createElement('div'), b = document.createElement('div');
            const sn = hs.nextElementSibling, inn = hi.nextElementSibling;
            hs.before(two); a.append(hs); if (sn && sn !== hi) a.append(sn); b.append(hi); if (inn) b.append(inn);
            two.append(a, b);
        }
        // A1: Moliya qatori — qaysi sanadan va Qarzdorlarga havola.
        const from = [...body.querySelectorAll('.ad-dt tr')].find(tr => /qachondan/i.test(tr.cells?.[0]?.textContent || ''))?.cells?.[3]?.textContent?.trim();
        const fin = [...body.querySelectorAll('.ad-imp li span')].find(s => /^Moliya:/.test(s.textContent));
        if (fin && !fin.dataset.rdp) {
            fin.dataset.rdp = '1';
            if (from) fin.append(` · ${from}`);
            const a = document.createElement('button'); a.type = 'button'; a.className = 'rdp-link'; a.textContent = 'Qarzdorlar →';
            a.onclick = () => P.open('debt'); fin.append(' ', a);
        }
        // A2: qaror bloki pastki qismda, tekshiruv ustida emas — kartaning pastki (doim ko'rinadigan) zonasiga.
        const hq = h3('qaror'), foot = det.querySelector(':scope > .sc-df');
        if (hq && foot) {
            const dec = document.createElement('div'); dec.className = 'rdp-ap-dec';
            const parts = [hq]; let n = hq.nextElementSibling; while (n) { parts.push(n); n = n.nextElementSibling; }
            dec.append(...parts); foot.before(dec);
        }
    }
    function bootApprovals() {
        const root = document.getElementById('schoolApprovalsRoot'); if (!root) return;
        let q = 0;
        new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; try { decorateApprovals(); } catch (e) { console.warn('[rdp approvals]', e); } }); })
            .observe(root, { childList: true, subtree: true });
    }
    P.register('check', { tab: 'school-approvals', after: decorateApprovals });

    // ================= SLA o'tgan lidlar (yangi sahifa) =================
    const SLA = { mgr: 'all', stage: 'all' };
    function slaData() {
        const lg = U.lang();
        let alerts = [];
        try { alerts = (g('getLeadSlaNotificationsForCurrentUser') ? getLeadSlaNotificationsForCurrentUser() : []).filter(a => a.audience === 'rop' && a.leadLang === lg); } catch (e) { alerts = []; }
        const leads = U.leads();
        return alerts.map(a => {
            const l = leads.find(x => x.id === a.leadId);
            if (!l || (g('parseLeadSlaTime') && parseLeadSlaTime(l.slaRopAcknowledged?.[a.stageKey]))) return null;
            const rule = (typeof LEAD_SLA_RULES !== 'undefined' ? LEAD_SLA_RULES[st(l)] : null)?.rop;
            return { a, l, rule, left: a.time + DAY - Date.now(), since: Date.now() - (a.time - (rule?.after || 0) * MIN) };
        }).filter(Boolean).sort((x, y) => x.left - y.left);
    }
    function renderSla(host) {
        const all = slaData();
        const mgrs = U.managers();
        const gone = all.filter(x => x.left <= 0), soon = all.filter(x => x.left > 0 && x.left < 6 * HOUR);
        const noMgr = all.filter(x => !x.l.managerId);
        const byMgr = id => all.filter(x => String(x.l.managerId || '') === String(id || ''));
        const usedMgr = mgrs.filter(m => byMgr(m.id).length);
        const list = all.filter(x => (SLA.mgr === 'all' || (SLA.mgr === 'none' ? !x.l.managerId : String(x.l.managerId) === SLA.mgr)) && (SLA.stage === 'all' || st(x.l) === SLA.stage));
        const R = typeof LEAD_SLA_RULES !== 'undefined' ? LEAD_SLA_RULES : {};
        const chip = (k, label, n) => `<button type="button" class="rdp-fchip${SLA.mgr === k ? ' is-on' : ''}" data-sla-mgr="${esc(k)}" aria-pressed="${SLA.mgr === k}">${esc(label)} <b>${n}</b></button>`;
        const card = x => {
            const { a, l, rule, left, since } = x, m = mgrById(l.managerId);
            const late = left <= 0, tg = l.managerId ? tgOf(l.managerId) : '';
            const pct = Math.max(0, Math.min(100, Math.round((1 - left / DAY) * 100)));
            const adminAt = a.time + DAY;
            const status = late ? 'adminga ketdi' : `${dur(left)} qoldi`;
            const sub = `${l.managerId ? esc(U.firstName(m?.name || '')) : '<span class="rdp-red">Menejersiz</span>'} · ${esc(STAGE[st(l)] || st(l))}`;
            return `<article class="rdp-sla-card${late ? ' is-late' : left < 6 * HOUR ? ' is-soon' : ''}">
                ${l.managerId ? U.av(l.managerId, m?.name || '', 40) : '<span class="rdp-av rdp-av--empty" aria-hidden="true">—</span>'}
                <div class="rdp-sla-main"><b class="rdp-sla-name">${esc(l.name || 'Lid')}</b><span class="rdp-sla-sub">${sub}</span>
                  <div class="rdp-sla-pills"><span class="rdp-pill">Qoida: ${esc(ruleTxt(rule?.after || 0))}</span><span class="rdp-pill rdp-pill--red">Turibdi: ${esc(dur(since))}</span></div>
                  <p class="rdp-sla-msg">${esc(a.message || '')}</p>
                  <div class="rdp-sla-acts">${l.managerId
                    ? `${tg ? `<a class="rdp-btn" href="${esc(tg)}" target="_blank" rel="noopener">${esc(U.firstName(m?.name || ''))}ga yozish</a>` : ''}<button type="button" class="rdp-btn rdp-btn--pri" data-sla-ack="${esc(l.id)}">Koʻrildi</button>`
                    : `<button type="button" class="rdp-btn rdp-btn--pri" data-sla-assign>Biriktirish</button><span class="rdp-mt">Avval menejerga biriktiring</span>`}
                    <button type="button" class="rdp-btn" data-sla-open="${esc(l.id)}">Lidni ochish</button>${l.managerId && !tg ? `<span class="rdp-mt">${esc(U.firstName(m?.name || ''))} Telegram'ni ulamagan</span>` : ''}</div></div>
                <div class="rdp-sla-side"><span class="rdp-pill ${late ? 'rdp-pill--solid' : 'rdp-pill--amber'}">${esc(status)}</span><span class="rdp-sla-bar"><i style="width:${pct}%"></i></span>
                  <small>Adminga ${dayWord(adminAt)} ${hm(adminAt)} da ${late ? `oʻtdi · ${dur(-left)} oldin` : 'oʻtadi'}</small></div></article>`;
        };
        const group = (title, note, arr, red) => arr.length ? `<h3 class="rdp-sec${red ? ' is-red' : ''}">${title} · ${arr.length}${note ? ` <span>${note}</span>` : ''}</h3><div class="rdp-sla-list">${arr.map(card).join('')}</div>` : '';
        const lGone = list.filter(x => x.left <= 0), lSoon = list.filter(x => x.left > 0 && x.left < 6 * HOUR), lRest = list.filter(x => x.left >= 6 * HOUR);
        const ruleRows = [['yangi-lidlar', 'Yangi lid'], ['boglanishga-urinilmoqda', 'Urinilmoqda'], ['boglanildi', 'Bogʻlanildi'], ['sinov-darsida', 'Sinovdan keyin'], ['qaror-jarayonida', 'Qaror'], ['tolov-jarayonida', 'Toʻlov']]
            .filter(([k]) => R[k]?.rop).map(([k, t]) => `<div class="rdp-kv"><span>${t}</span><b>${esc(ruleTxt(R[k].rop.after))}</b><small>${R[k].trialBased ? 'sinov darsi vaqtidan' : 'bosqichga kirgandan'}</small></div>`).join('');
        const stages = [...new Set(all.map(x => st(x.l)))];
        host.innerHTML = `${U.headHtml({ title: 'SLA oʻtgan lidlar', sub: `${all.length} ta ochiq · “Koʻrildi” bosilmasa 24 soatda adminga oʻtadi`, chipRight: true })}
          <div class="rdp-kpis">
            <div class="rdp-kpi"><small>Ochiq</small><b>${all.length}</b><span>${esc(U.langLabel())} · ${usedMgr.length} menejer</span></div>
            <div class="rdp-kpi rdp-kpi--red"><small>Adminga oʻtgan</small><b>${gone.length}</b><span>24 soatdan oshdi</span></div>
            <div class="rdp-kpi rdp-kpi--amber"><small>Oz qoldi</small><b>${soon.length}</b><span>6 soatdan kam</span></div>
            <div class="rdp-kpi"><small>Menejersiz</small><b>${noMgr.length}</b><span>avval biriktiring</span></div>
          </div>
          <div class="rdp-cols">
            <div class="rdp-col-main">
              <div class="rdp-fchips" role="group" aria-label="Menejer boʻyicha">${chip('all', 'Hammasi', all.length)}${usedMgr.map(m => chip(String(m.id), U.firstName(m.name), byMgr(m.id).length)).join('')}${noMgr.length ? chip('none', 'Menejersiz', noMgr.length) : ''}</div>
              <label class="rdp-inline">Bosqich <select data-sla-stage><option value="all">Barcha bosqichlar</option>${stages.map(s => `<option value="${esc(s)}"${SLA.stage === s ? ' selected' : ''}>${esc(STAGE[s] || s)}</option>`).join('')}</select></label>
              ${group('ADMINGA OʻTGAN', '24 soatda “Koʻrildi” bosilmadi — admin xabar oldi', lGone, true)}
              ${group('ADMINGA OʻTISHIGA OZ QOLDI', '6 soatdan kam', lSoon, true)}
              ${group('BOSHQALAR', 'adminga 6 soatdan koʻp', lRest, false)}
              ${!list.length ? `<div class="rdp-empty"><b>SLA oʻtgan lid yoʻq</b><span>${all.length ? 'Bu filtr boʻyicha lid yoʻq' : 'Barcha menejerlar oʻz vaqtida ishlayapti'}</span></div>` : ''}
            </div>
            <aside class="rdp-col-side">
              <section class="rdp-card"><h2>Menejerlar boʻyicha</h2>
                <div class="rdp-mt-t" role="table"><div class="rdp-mt-r rdp-mt-h" role="row"><span role="columnheader">Menejer</span><span role="columnheader">Ochiq</span><span role="columnheader">Adminda</span></div>
                ${[...usedMgr.map(m => [String(m.id), m.name, byMgr(m.id)]), ...(noMgr.length ? [['none', 'Menejersiz', noMgr]] : [])].map(([k, n, arr]) => `<button type="button" class="rdp-mt-r${SLA.mgr === k ? ' is-on' : ''}" role="row" data-sla-mgr="${esc(k)}"><span role="cell" class="rdp-who">${k === 'none' ? '<span class="rdp-av rdp-av--empty" style="width:26px;height:26px">—</span>' : U.av(k, n, 26)}${esc(n)}</span><span role="cell">${arr.length}</span><span role="cell">${arr.filter(x => x.left <= 0).length ? `<i class="rdp-dotn">${arr.filter(x => x.left <= 0).length}</i>` : '0'}</span></button>`).join('')}</div>
                <p class="rdp-mt">Qatorni bossangiz roʻyxat shu menejer boʻyicha filtrlanadi.</p></section>
              <section class="rdp-card"><h2>Qachon sizga keladi</h2>${ruleRows}
                <p class="rdp-mt">Shu muddatda lid keyingi bosqichga oʻtmasa, eskalatsiya sizga keladi. “Koʻrildi” 24 soat ichida bosilmasa — adminga “ROP eskalatsiyani koʻrmadi” xabari ketadi. Lid bosqichi oʻzgarsa hisob yangidan boshlanadi.</p></section>
            </aside>
          </div>`;
        host.querySelectorAll('[data-sla-mgr]').forEach(b => b.onclick = () => { SLA.mgr = SLA.mgr === b.dataset.slaMgr && b.dataset.slaMgr !== 'all' ? 'all' : b.dataset.slaMgr; renderSla(host); });
        host.querySelector('[data-sla-stage]')?.addEventListener('change', e => { SLA.stage = e.target.value; renderSla(host); });
        host.querySelectorAll('[data-sla-open]').forEach(b => b.onclick = () => g('openLeadOverview') && openLeadOverview(U.lang(), b.dataset.slaOpen));
        host.querySelectorAll('[data-sla-assign]').forEach(b => b.onclick = () => g('switchTab') && switchTab('sales', { salesSection: 'leads' }));
        host.querySelectorAll('[data-sla-ack]').forEach(b => b.onclick = () => ackSla(b.dataset.slaAck, b, host));
    }
    // ropApp.ackSla / openLeadNotifyModal "Ko'rib chiqildi" bilan bir xil yozuv: slaRopAcknowledged[stageKey].
    function ackSla(id, btn, host) {
        const lg = U.lang(), l = U.leads().find(x => x.id === id); if (!l) return;
        btn.disabled = true;
        const alerts = g('getLeadSlaCardAlerts') ? getLeadSlaCardAlerts(l, lg).filter(a => a.audience === 'rop') : [];
        const a = alerts[0];
        if (!a || !g('updateLeadInStorage')) { btn.disabled = false; if (g('openLeadNotifyModal')) openLeadNotifyModal(lg, id); return; }
        const saved = updateLeadInStorage(lg, id, x => ({ ...x, slaRopAcknowledged: { ...(x.slaRopAcknowledged || {}), [a.stageKey]: new Date().toISOString() } }));
        if (!saved) { btn.disabled = false; U.toast('Saqlab boʻlmadi'); return; }
        if (g('markLeadSlaAlertsRead')) markLeadSlaAlertsRead(alerts);
        if (g('renderNotificationPanel')) renderNotificationPanel();
        U.toast(`${l.name || 'Lid'} — koʻrildi, adminga oʻtmaydi`, 3000);
        renderSla(host);
    }
    P.register('sla', { tab: 'rdp-sla', render: renderSla });

    // ================= Qotib qolgan lidlar qoidasi (sahifa) =================
    // Hisob staleLeads.js bilan bir xil: "Urinilmoqda"da, hech qachon bog'lanilmagan, menejerga berilgan kundan.
    const AFTER = new Set(['boglanildi', 'malumot-berildi', 'sinov-darsida', 'qaror-jarayonida', 'keyin-sotib-olmoqchi', 'tolov-jarayonida', 'tolov-yopildi']);
    const neverConnected = l => !(Array.isArray(l.stageHistory) && l.stageHistory.some(h => h && AFTER.has(h.to))) && !(l.connectedSurvey && Object.keys(l.connectedSurvey).length);
    const ageDays = (l, now) => { const t = U.ts(l.managerAssignedAt) || U.ts(l.createdAt); return t ? Math.floor((now - t) / DAY) : 0; };
    const STALE = { saved: null, form: null, err: null, loading: false, at: 0, saving: false, saveErr: '' };
    function staleStats(r) {
        const now = Date.now(), ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(), by = {};
        for (const l of U.leads()) {
            const k = String(l.managerId || ''); if (!k) continue;
            const o = by[k] || (by[k] = { warn: 0, lock: 0, closed: 0 });
            if (st(l) === 'boglanishga-urinilmoqda' && neverConnected(l)) { const d = ageDays(l, now); if (d >= r.lockDays) o.lock++; else if (d >= r.warnDays) o.warn++; }
            if (st(l) === 'sifatsiz-lidlar' && (l.comments || []).some(c => c?.type === 'sifatsiz-lid' && /Telefonni olmadi/.test(c.text || '') && U.ts(c.createdAt) >= ms)) o.closed++;
        }
        return by;
    }
    const staleValid = f => {
        const e = {};
        if (!(Number.isInteger(f.warnDays) && f.warnDays >= 1 && f.warnDays <= 60)) e.warnDays = '1–60 oraligʻida butun son';
        if (!(Number.isInteger(f.lockDays) && f.lockDays >= 2 && f.lockDays <= 90)) e.lockDays = '2–90 oraligʻida butun son';
        else if (!e.warnDays && f.lockDays <= f.warnDays) e.lockDays = 'Qulf kuni ogohlantirishdan katta boʻlsin';
        if (!(Number.isInteger(f.callsPerDay) && f.callsPerDay >= 1 && f.callsPerDay <= 300)) e.callsPerDay = '1–300 oraligʻida butun son';
        return e;
    };
    async function loadStale(host) {
        STALE.loading = true; STALE.err = null; renderStale(host);
        try {
            // Xatoda standart 3/5/30 bilan davom etilmaydi — saqlash haqiqiy qoidani almashtirib yubormasin.
            const r = await apiFetch('/api/leads/stale-rule', { fresh: true });
            const rule = r?.rules?.[U.lang()];
            if (!rule) throw new Error('Qoida kelmadi');
            STALE.saved = { warnDays: Number(rule.warnDays), lockDays: Number(rule.lockDays), callsPerDay: Number(rule.callsPerDay) };
            STALE.form = { ...STALE.saved }; STALE.at = Date.now();
        } catch (e) { STALE.err = e; }
        STALE.loading = false; renderStale(host);
    }
    function renderStale(host) {
        const sub = '“Urinilmoqda”da turib, bir marta ham telefonni olmagan lidlar — menejerga berilgan kundan hisoblanadi. Qulf kuni kelganda sotuv menejeri ilovani ochganda shu lidlarni hal qilmaguncha boshqa ishlarga oʻta olmaydi (kuniga bir marta 5 daqiqalik imtiyoz bor). “Sifatsiz”ga faqat qoʻngʻiroqdan keyin oʻtkaziladi.';
        const head = U.headHtml({ title: 'Qotib qolgan lidlar qoidasi', sub: esc(sub), chipRight: true });
        if (STALE.loading || (!STALE.form && !STALE.err)) { host.innerHTML = `${head}<div class="rdp-card rdp-sk" aria-busy="true">Yuklanmoqda…</div>`; return; }
        if (!STALE.form) { host.innerHTML = `${head}<div class="rdp-card rdp-errbox" role="alert"><b>Qoidani yuklab boʻlmadi</b><span>${esc(STALE.err?.message || '')}</span><button type="button" class="rdp-btn" data-st-retry>Qayta urinish</button></div>`; host.querySelector('[data-st-retry]').onclick = () => loadStale(host); return; }
        const f = STALE.form, errs = staleValid(f), ok = !Object.keys(errs).length;
        const dirty = JSON.stringify(f) !== JSON.stringify(STALE.saved);
        const preview = ok ? staleStats(f) : {}, savedStats = staleStats(STALE.saved);
        const mgrs = U.managers();
        const nm = id => (mgrs.find(m => String(m.id) === id) || mgrById(id) || {}).name || id;
        const sumW = Object.values(preview).reduce((a, o) => a + o.warn, 0), sumL = Object.values(preview).reduce((a, o) => a + o.lock, 0);
        const lockedM = Object.entries(preview).filter(([, o]) => o.lock).map(([id]) => U.firstName(nm(id)));
        const rows = Object.entries(savedStats).filter(([, o]) => o.warn || o.lock || o.closed);
        const fld = (k, label, hint, min, max) => `<label class="rdp-fld${errs[k] ? ' is-err' : ''}"><span>${label}</span><input type="number" inputmode="numeric" min="${min}" max="${max}" step="1" value="${Number.isFinite(f[k]) ? f[k] : ''}" data-st-k="${k}" aria-invalid="${!!errs[k]}"><small>${errs[k] ? esc(errs[k]) : hint}</small></label>`;
        const w = f.warnDays, lk = f.lockDays;
        host.innerHTML = `${head}
          <div class="rdp-cols rdp-cols--st">
            <section class="rdp-card"><h2>Qoida</h2>
              <div class="rdp-st-in">${fld('warnDays', 'Ogohlantirish (kun)', 'Menejer Bosh sahifasida ogohlantirish chiqadigan kun · 1–60', 1, 60)}${fld('lockDays', 'Majburiy qulf (kun)', 'Menejer ilovasi shu lidlar bilan qulflanadigan kun · 2–90', 2, 90)}${fld('callsPerDay', 'Kunlik qoʻngʻiroq maqsadi', 'Bir menejer uchun kuniga · 1–300', 1, 300)}</div>
              ${ok ? `<div class="rdp-st-days" aria-label="Kunlar chizigʻi"><span class="is-ok" style="flex:${w}">0–${w - 1} kun · oddiy</span><span class="is-warn" style="flex:${Math.max(1, lk - w)}">${w}${lk - 1 > w ? `–${lk - 1}` : ''} kun · ogohlantirish</span><span class="is-lock" style="flex:2">${lk}+ kun · qulf</span></div>` : ''}
              <p class="rdp-mt">Kun lid menejerga berilgan paytdan sanaladi. Telefonni olgach (Bogʻlanildi va keyingi bosqichlar) lid hisobdan chiqadi.</p>
              <div class="rdp-st-prev" aria-live="polite">${ok ? `${dirty ? 'Saqlansa' : 'Shu qoida bilan hozir'}: ${sumW} ta lid ogohlantirishda, ${sumL} ta lid qulfda${lockedM.length ? ` · qulflangan menejerlar: ${esc(lockedM.join(', '))}` : ''}` : 'Qiymatlarni tuzating'}</div>
            </section>
            <section class="rdp-card"><h2>Menejer nimani koʻradi</h2><ul class="rdp-st-legend">
              <li><i class="is-warn"></i><span><b>Ogohlantirish kuni</b> — sotuv ilovasi Bosh sahifasida “N ta lid X kundan beri olmayapti” kartasi: “N kundan keyin ‘Sifatsiz’ga oʻtkazish shart”.</span></li>
              <li><i class="is-lock"></i><span><b>Qulf kuni</b> — ilova ochilganda shu lidlar roʻyxati; har biriga avval qoʻngʻiroq qilinadi, keyin “Sifatsiz” yoki keyingi bosqich.</span></li>
              <li><i class="is-ok"></i><span><b>Imtiyoz</b> — kuniga bir marta 5 daqiqa, keyin qulf qaytadi.</span></li>
              <li><i></i><span><b>Kunlik qoʻngʻiroq maqsadi</b> — sotuv ilovasidagi “Qoʻngʻiroq N / ${STALE.saved.callsPerDay}” hisoblagichi va ROP menejerlar roʻyxati.</span></li></ul></section>
          </div>
          <section class="rdp-card"><div class="rdp-card-h"><h2>Menejerlar boʻyicha hozirgi holat</h2><span class="rdp-mt">Saqlangan qoida boʻyicha · ${dayWord(STALE.at)} ${hm(STALE.at)}</span></div>
            ${rows.length ? `<div class="rdp-tbl" role="table"><div class="rdp-tr rdp-th" role="row"><span role="columnheader">Menejer</span><span role="columnheader">Ogohlantirish</span><span role="columnheader">Qulf</span><span role="columnheader" title="Bu oy “Telefonni olmadi” sababi bilan Sifatsizga oʻtkazilgan">Bu oy majburan yopildi</span></div>
              ${rows.map(([id, o]) => `<div class="rdp-tr" role="row"><span role="cell" class="rdp-who">${U.av(id, nm(id), 26)}<b>${esc(nm(id))}</b></span><span role="cell">${o.warn ? `<i class="rdp-cnt rdp-cnt--warn">${o.warn}</i>` : '0'}</span><span role="cell">${o.lock ? `<i class="rdp-cnt rdp-cnt--lock">${o.lock}</i>` : '0'}</span><span role="cell">${o.closed}</span></div>`).join('')}</div>`
              : '<p class="rdp-mt">Hozir qotib qolgan lid yoʻq</p>'}
          </section>
          <div class="rdp-stickyfoot">${STALE.saveErr ? `<span class="rdp-red" role="alert">${esc(STALE.saveErr)}</span>` : dirty ? '<span class="rdp-mt">Saqlanmagan oʻzgarish bor</span>' : ''}
            <button type="button" class="rdp-btn" data-st-cancel ${dirty ? '' : 'disabled'}>Bekor qilish</button><button type="button" class="rdp-btn rdp-btn--pri" data-st-save ${dirty && ok && !STALE.saving ? '' : 'disabled'}>${STALE.saving ? 'Saqlanmoqda…' : 'Saqlash'}</button></div>`;
        host.querySelectorAll('[data-st-k]').forEach(i => i.addEventListener('change', () => { STALE.form = { ...STALE.form, [i.dataset.stK]: i.value === '' ? NaN : Number(i.value) }; STALE.saveErr = ''; renderStale(host); host.querySelector(`[data-st-k="${i.dataset.stK}"]`)?.focus(); }));
        host.querySelector('[data-st-cancel]').onclick = () => { STALE.form = { ...STALE.saved }; STALE.saveErr = ''; renderStale(host); };
        host.querySelector('[data-st-save]').onclick = async () => {
            STALE.saving = true; renderStale(host);
            try {
                // Faqat ROP tilining qoidasi yuboriladi; serverning javobidagi (tozalangan) qiymatlar olinadi.
                const r = await apiFetch('/api/leads/stale-rule', { method: 'PUT', body: JSON.stringify({ rules: { [U.lang()]: STALE.form } }) });
                const sv = r?.rules?.[U.lang()] || STALE.form;
                STALE.saved = { warnDays: Number(sv.warnDays), lockDays: Number(sv.lockDays), callsPerDay: Number(sv.callsPerDay) };
                STALE.form = { ...STALE.saved }; STALE.at = Date.now(); STALE.saveErr = '';
                U.toast('Qoida saqlandi');
            } catch (e) { STALE.saveErr = `Saqlab boʻlmadi: ${e.message || ''}`; }
            STALE.saving = false; renderStale(host);
        };
    }
    P.register('lock', { tab: 'rdp-stale', render: host => loadStale(host), dirty: () => !!STALE.form && JSON.stringify(STALE.form) !== JSON.stringify(STALE.saved) });

    // ================= Arxiv =================
    function renderArchive(host) {
        host.innerHTML = `${U.headHtml({ title: 'Arxiv', sub: 'Oʻchirilgan har qanday maʼlumot shu yerda saqlanadi — kim, qachon oʻchirgani bilan. Kerakli yozuvni bir tugma bilan joyiga qaytaring.', chipRight: true })}<div class="rdp-arch"><div id="rdpArchiveMount"></div></div>`;
        if (window.archiveCenter) window.archiveCenter.mount(host.querySelector('#rdpArchiveMount'));
        else host.querySelector('#rdpArchiveMount').innerHTML = '<p class="rdp-mt">Arxiv moduli yuklanmadi</p>';
    }
    P.register('arch', { tab: 'rdp-archive', render: renderArchive });

    // Qotgan lidlar qoidasida saqlanmagan o'zgarish bo'lsa — boshqa sahifaga o'tishdan oldin so'raladi.
    function guardLeave() {
        const orig = window.switchTab;
        if (typeof orig !== 'function' || orig.__rdpGuard) return;
        const fn = function (tab, ...rest) {
            if (U.isRopDesk() && tab !== 'rdp-stale' && document.getElementById('tab-rdp-stale')?.classList.contains('active') && P.PAGES.lock.dirty()
                && !confirm('Qoidadagi oʻzgarishlar saqlanmagan. Chiqib ketilsinmi?')) return undefined;
            if (tab !== 'rdp-stale') { STALE.form = STALE.saved ? { ...STALE.saved } : null; }
            return orig.call(this, tab, ...rest);
        };
        fn.__rdpGuard = true; fn.__rdp = orig.__rdp; window.switchTab = fn;
    }
    const boot = () => { bootApprovals(); guardLeave(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
