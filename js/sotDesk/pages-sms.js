// Sotuv menejeri kompyuter — SMS yuborish (dizayn SotK_Sms): 1 Kimga · 2 Xabar matni · 3 Ko'rinishi/Natija + tarix.
// ROP sahifasi (js/ropDesk/pages-sms.js) bilan bir xil tab (tab-rdp-sms) va bir xil manbalar: apiSendSms (/api/sms/send),
// apiFetchSmsBalance, /api/sms/history, SMS_PLACEHOLDERS/_smsRecipientContext/fillSmsPlaceholders. Sotuvga xos:
//  - Ro'yxat FAQAT o'z lidlarim (server GET /api/leads sotuv menejeriga faqat managerId = o'zi bo'lganlarni beradi;
//    bu yerda ham managerId tekshiriladi) va o'z o'quvchilarim (filterStudentsForSalesManager — Qarzdorlar bilan bir xil).
//    Eslatma: server POST /api/sms/send sotuv menejeri uchun qabul qiluvchilarni tekshirmaydi — cheklov faqat shu ro'yxatda.
//  - Tarix: server sotuv menejeriga faqat o'zi yuborganlarini qaytaradi ("Yubordi" — Siz).
//  - Bitta tasdiq oynasi (confirm() emas), har raqam bo'yicha natija, xatolarni qayta tanlash.
//  - Timeout: server yuborishda davom etadi → "Javob kelmadi — SMSlar yuborilgan bo'lishi mumkin. Tarixni tekshiring.";
//    ko'r-ko'rona qayta yuborish yo'q: avval tarix yangilanadi, "Yuborildi" bo'lganlar tanlovdan olinadi; server ham
//    skipAlreadySent bilan oxirgi 6 soatda shu matn ketgan raqamga qayta yubormaydi.
(function () {
    'use strict';
    const SP = window.sotDeskPages; if (!SP) return;
    const U = SP.U, esc = U.esc, g = U.g;
    const MAX = 500; // server/routes/sms.js MAX_RECIPIENTS_PER_REQUEST
    const DEDUPE_MS = 6 * 3600 * 1000; // server SMS_DEDUPE_MS (skipAlreadySent)
    const S = { preset: 'manual', aud: 'lidlar', q: '', f: 'all', sel: new Set(), text: null, prev: 0, showWhy: false, cf: false,
        bal: undefined, balErr: false, hist: null, histErr: null, hf: 'all', hN: 8, sending: false, timeout: null, res: null, lastText: '', toast: '' };
    const mid = () => String(U.user().linkedManagerId || '');
    const st = l => (g('normalizeLeadStatus') ? normalizeLeadStatus(l.status) : l.status);
    const digits = v => String(v || '').replace(/\D/g, '');
    const validPhone = v => { let d = digits(v); if (d.length === 9) d = '998' + d; return /^998\d{9}$/.test(d); };
    const phoneTxt = v => (g('formatPhoneDisplay') ? formatPhoneDisplay(v) : v);
    const STAGE_ORDER = () => [...(typeof FUNNEL_STAGES !== 'undefined' ? FUNNEL_STAGES.map(f => f.id) : []), 'muvaffaqiyatsiz-sotuv', 'sifatsiz-lidlar'];
    const EXTRA = { 'muvaffaqiyatsiz-sotuv': 'Muvaffaqiyatsiz sotuv', 'sifatsiz-lidlar': 'Sifatsiz lidlar' }; // FUNNEL_STAGES'da yo'q (yopiq ustunlar)
    const stageLabel = id => (typeof FUNNEL_STAGES !== 'undefined' ? (FUNNEL_STAGES.find(f => f.id === id) || {}).label : '') || EXTRA[id] || id || '';
    const closedAt = l => U.ts(l.paymentClosedSurvey?.closedDate) || U.ts(l.closedDate) || U.ts(l.slaStageEnteredAt) || U.ts(l.statusChangedAt) || U.ts(l.updatedAt) || U.ts(l.createdAt);
    const key = r => `${r.type}:${r.id}`;
    const PH = () => (typeof SMS_PLACEHOLDERS !== 'undefined' ? SMS_PLACEHOLDERS : [{ key: '{ism}' }, { key: '{ustoz}' }, { key: '{sinov_guruh}' }]);
    const ctxOf = r => (g('_smsRecipientContext') ? _smsRecipientContext(r) : { '{ism}': r.name || '' });
    const fill = (t, r) => (g('fillSmsPlaceholders') ? fillSmsPlaceholders(t, ctxOf(r)) : String(t).split('{ism}').join(r.name || ''));
    const AUD = { lidlar: 'Sotuv lidlari', oquvchilar: 'Oʻquvchilar', qarzdorlar: 'Qarzdorlar' };

    // ---- auditoriyalar: faqat o'z lid va o'quvchilarim, faqat o'z tilim ----
    function myStudents() {
        const lg = U.lang();
        const all = (g('getItem') ? getItem(STORAGE_KEYS.students, []) : []).filter(s => s && !s.isStaffDemo && (s.subject || 'english') === lg && s.phone);
        return g('filterStudentsForSalesManager') ? filterStudentsForSalesManager(all, U.user()) : [];
    }
    function audience(aud) {
        if (!mid()) return [];
        if (aud === 'oquvchilar') return myStudents().map(s => ({ id: s.id, type: 'student', name: s.name || '(ismsiz)', phone: s.phone, sub: s.group || '', grp: s.group || 'Guruhsiz', teacherId: s.teacherId || '' }));
        if (aud === 'qarzdorlar') return myStudents().filter(s => (window.AttendanceRules?.isDebtor ? window.AttendanceRules.isDebtor(s) : Number(s.debtAmount || 0) > 0)).map(s => ({ id: s.id, type: 'debtor', name: s.name || '(ismsiz)', phone: s.phone,
            sub: Number(s.debtAmount || 0) > 0 ? `${U.num(s.debtAmount)} soʻm qarz` : `Toʻlov muddati ${s.paymentDueDate || ''}`, grp: s.group || 'Guruhsiz', teacherId: s.teacherId || '' }));
        return U.leads().filter(l => l.phone && String(l.managerId || '') === mid()).map(l => ({ id: l.id, type: 'lead', name: l.name || '(ismsiz)', phone: l.phone, sub: stageLabel(st(l)), grp: st(l), lead: l,
            teacherId: l.paymentOnboarding?.teacherId || l.trialRequest?.teacherId || '' }));
    }
    function presets() {
        const leads = audience('lidlar');
        const d7 = Date.now() - 7 * 86400000;
        const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
        return [
            { k: 'qaror', t: 'Qaror jarayonida', s: 'Hali toʻlov qilmaganlar', list: leads.filter(r => r.grp === 'qaror-jarayonida') },
            { k: 'noshow', t: 'Sinovga kelmaganlar', s: 'Oxirgi 7 kun', list: leads.filter(r => { const t = r.lead.trialRequest; return t?.state === 'completed' && t.attended === false && U.ts(t.completedAt) >= d7; }) },
            { k: 'price', t: 'Muvaffaqiyatsiz · narx sababli', s: 'Shu oy', list: leads.filter(r => r.grp === 'muvaffaqiyatsiz-sotuv' && /narx|qimmat/i.test(r.lead.failedSaleReason?.label || r.lead.failReason || '') && closedAt(r.lead) >= ms) }
        ].map(p => ({ ...p, bad: p.list.filter(r => !validPhone(r.phone)).length, list: p.list.filter(r => validPhone(r.phone)) }));
    }
    function allMap() { const m = new Map(); Object.keys(AUD).forEach(a => audience(a).forEach(r => m.set(key(r), r))); return m; }
    function selectedList() { const m = allMap(); return [...S.sel].map(k => m.get(k)).filter(Boolean); }

    // ---- SMS hisobi (Eskiz: lotin 160/153, unicode 70/67) ----
    const isUni = t => /[^\x0A\x0D\x20-\x7E]/.test(t);
    const parts = t => { const n = t.length; if (!n) return 0; const u = isUni(t); return n <= (u ? 70 : 160) ? 1 : Math.ceil(n / (u ? 67 : 153)); };
    const FANCY = /[ʻʼ‘’`´“”«»—–…]/;
    const plain = t => t.replace(/[ʻʼ‘’`´]/g, "'").replace(/[“”«»]/g, '"').replace(/[—–]/g, '-').replace(/…/g, '...');
    // Tarixda oxirgi 6 soatda aynan shu matn bilan "Yuborildi" bo'lgan raqamlar (server skipAlreadySent bilan bir xil kalit).
    function doneSet() {
        const since = Date.now() - DEDUPE_MS;
        return new Set((S.hist || []).filter(h => h.status === 'sent' && U.ts(h.sentAt) >= since).map(h => `${digits(h.phone)}|${String(h.message || '').trim()}`));
    }
    const isDone = (done, r, text) => done.has(`${digits(r.phone)}|${fill(text, r).trim()}`);

    function previewHtml(t, r) {
        if (!t) return '<mark class="rdp-sms-miss">Matn yozilmagan</mark>';
        if (!r) return esc(t);
        const ctx = ctxOf(r), keys = PH().map(p => p.key);
        return t.split(new RegExp(`(${keys.map(k => k.replace(/[{}]/g, '\\$&')).join('|')})`)).map(part => {
            if (!keys.includes(part)) return esc(part);
            const v = ctx[part];
            return v ? `<mark class="rdp-sms-ok">${esc(v)}</mark>` : `<mark class="rdp-sms-miss" title="${esc(part)} topilmadi">${part === '{sinov_guruh}' ? '[guruh havolasi yoʻq]' : `[${esc(part.slice(1, -1))} yoʻq]`}</mark>`;
        }).join('');
    }
    function toast(m) { S.toast = m; U.toast(m, 3800); }

    async function loadBalance(host) {
        try { const d = await apiFetchSmsBalance(); const b = d?.data?.balance ?? d?.balance; S.bal = b != null ? Number(b) : null; S.balErr = S.bal == null; }
        catch (e) { S.bal = null; S.balErr = true; }
        draw(host);
    }
    async function loadHistory(host) {
        S.histErr = null;
        try { const h = await apiFetch('/api/sms/history?limit=50', { fresh: true }); S.hist = Array.isArray(h) ? h : []; } catch (e) { S.histErr = e; }
        draw(host);
        return S.histErr ? null : S.hist;
    }
    // Timeoutdan keyin: tarixda "Yuborildi" bo'lganlar tanlovdan olinadi, shundan keyingina qayta yuborish mumkin.
    async function refreshAfterTimeout(host) {
        const t = S.timeout; if (!t) return;
        t.refreshing = true; draw(host);
        const hist = await loadHistory(host);
        if (!hist) { t.refreshing = false; draw(host); return; }
        const sent = new Set(hist.filter(h => h.status === 'sent' && U.ts(h.sentAt) >= t.at - 60000).map(h => `${digits(h.phone)}|${String(h.message || '').trim()}`));
        let removed = 0;
        for (const r of t.recipients) if (sent.has(`${digits(r.phone)}|${String(r.message).trim()}`) && S.sel.delete(r.k)) removed++;
        S.timeout = null;
        toast(`Tarix yangilandi: ${removed} ta raqamga allaqachon yuborilgan — tanlovdan olindi.${S.sel.size ? ` Qolgan ${S.sel.size} tasiga qayta yuborish mumkin.` : ''}`);
        loadBalance(host);
    }

    async function send(host) {
        const text = (S.text || '').trim();
        const done = doneSet();
        const list = selectedList().filter(r => validPhone(r.phone) && !isDone(done, r, text));
        S.cf = false;
        if (!text || !list.length || S.sending || S.timeout || list.length > MAX) { draw(host); return; }
        const recipients = list.map(r => ({ id: r.id, type: r.type, name: r.name, phone: r.phone, message: fill(text, r), k: key(r) }));
        S.sending = true; S.res = null; draw(host);
        const at = Date.now();
        try {
            const res = await apiSendSms(recipients.map(({ k, ...r }) => r), text, S.aud, { skipAlreadySent: true });
            const out = res.results || [];
            const rows = recipients.map((r, i) => {
                const x = out.find(o => digits(o.phone) === digits(r.phone) && (o.message == null || String(o.message).trim() === r.message.trim())) || out[i] || {};
                return { k: r.k, id: r.id, type: r.type, name: r.name, phone: r.phone, status: x.status || 'error', error: x.error || (x.status ? '' : 'Javobda yoʻq'), seg: parts(r.message) };
            });
            S.res = { rows, aud: S.aud, sent: res.sent || 0, failed: res.failed || 0, skipped: res.skipped || 0 };
            S.lastText = S.text; S.text = ''; S.sel.clear(); S.preset = 'manual'; S.prev = 0;
            loadHistory(host); loadBalance(host);
        } catch (e) {
            if (e && e.timeout) S.timeout = { at, recipients, refreshing: false };
            else toast(`Yuborib boʻlmadi: ${e?.message || 'nomaʼlum xatolik'}`);
        }
        S.sending = false; draw(host);
    }

    function confirmHtml(sel, text, total, perMin, perMax, missing) {
        const sample = sel[0];
        const pre = S.preset !== 'manual' ? presets().find(p => p.k === S.preset) : null;
        const per = `${perMin !== perMax ? `${perMin}–${perMax}` : perMax} SMS (${isUni(text) ? '70' : '160'} belgilik)`;
        return `<div class="sot-dlg-bg" data-sms-cfbg><div class="sot-dlg" role="dialog" aria-modal="true" aria-labelledby="sotSmsCfT" data-sms-cf>
            <h2 id="sotSmsCfT">${sel.length} ta qabul qiluvchiga SMS yuborilsinmi?</h2>
            <dl class="sot-dlg-kv"><dt>Auditoriya</dt><dd>${esc(AUD[S.aud])}${pre ? ` · ${esc(pre.t)}` : ''}</dd><dt>Bir kishiga</dt><dd>${per}</dd><dt>Jami sarf</dt><dd>${total} SMS</dd>
              ${S.bal != null ? `<dt>Balansda qoladi</dt><dd class="${S.bal - total < 0 ? 'rdp-red' : ''}">${U.num(S.bal - total)} SMS</dd>` : '<dt>Balans</dt><dd>aniqlanmadi</dd>'}</dl>
            ${sample ? `<div class="sot-dlg-ex"><small>Masalan, ${esc(sample.name)} oladi:</small><p>${esc(fill(text, sample))}</p></div>` : ''}
            ${missing.length ? `<p class="sot-dlg-warn">${missing.length} ta qabul qiluvchining sinov darsi guruhi aniqlanmadi (${esc(missing.slice(0, 3).map(r => r.name).join(', '))}${missing.length > 3 ? ' va boshqalar' : ''}) — ularga havolasiz SMS ketadi.</p>` : ''}
            ${S.bal != null && total > S.bal ? '<p class="sot-dlg-warn">Balans yetarli emas — bir qismi yuborilmasligi mumkin.</p>' : ''}
            <p class="rdp-mt">SMS maktab hisobidan (Eskiz) yechiladi va qaytarib boʻlmaydi.</p>
            <div class="sot-dlg-act"><button type="button" class="rdp-btn" data-sms-cfno>Bekor qilish</button><button type="button" class="rdp-btn rdp-btn--pri" data-sms-cfyes>Ha, ${sel.length} kishiga yuborish</button></div>
        </div></div>`;
    }
    function resultHtml() {
        const R = S.res, fails = R.rows.filter(x => x.status !== 'sent');
        const order = fails.concat(R.rows.filter(x => x.status === 'sent'));
        const icon = x => (x.status === 'sent' ? '<i class="sot-r-ok" aria-hidden="true">✓</i>' : x.status === 'skipped' ? '<i class="sot-r-sk" aria-hidden="true">–</i>' : '<i class="sot-r-no" aria-hidden="true">✕</i>');
        const desc = x => (x.status === 'sent' ? `${phoneTxt(x.phone)} · yuborildi · ${x.seg} SMS` : x.status === 'skipped' ? `${phoneTxt(x.phone)} · oʻtkazildi — shu matn allaqachon yuborilgan` : `${phoneTxt(x.phone)} · ${x.error || 'xato'}`);
        const failsOnly = fails.filter(x => x.status === 'error');
        return `<section class="rdp-card rdp-sms-c3 sot-res" aria-labelledby="sotSmsResH" role="status"><h2 id="sotSmsResH">Natija</h2>
            <div class="sot-res-t"><div class="is-ok"><b>${R.sent}</b><span>ta yuborildi</span></div><div class="${R.failed ? 'is-bad' : ''}"><b>${R.failed}</b><span>ta xato</span></div>${R.skipped ? `<div><b>${R.skipped}</b><span>ta oʻtkazildi</span></div>` : ''}</div>
            <ul class="sot-res-l">${order.map(x => `<li>${icon(x)}<span><b>${esc(x.name)}</b><small>${esc(desc(x))}${x.status === 'error' ? ` <button type="button" class="rdp-link" data-sms-open="${esc(x.type)}:${esc(x.id)}">${x.type === 'lead' ? 'Lidni ochish' : 'Oʻquvchini ochish'}</button>` : ''}</small></span></li>`).join('')}</ul>
            <p class="rdp-mt">Tarix va balans yangilandi. Matn va tanlov tozalandi${failsOnly.length ? ' — xato ketganlarni qayta tanlab, raqamini tuzatib yuborish mumkin' : ''}.</p>
            <div class="sot-res-act">${failsOnly.length ? `<button type="button" class="rdp-btn rdp-btn--pri" data-sms-retry>Xatolarni qayta tanlash (${failsOnly.length})</button>` : ''}<button type="button" class="rdp-btn" data-sms-new>Yangi xabar</button></div>
        </section>`;
    }

    function draw(host) {
        if (!host || !host.isConnected || !U.isSotDesk()) return;
        if (S.text == null) S.text = `Assalomu alaykum, {ism}! Domwork ${U.lang() === 'english' ? 'ingliz' : 'rus'} tili kursiga joylar oz qoldi. Bugun yozilsangiz — birinchi dars sovgʻa.`;
        const focus = document.activeElement && host.contains(document.activeElement) ? document.activeElement.dataset : null;
        const ps = presets(), all = audience(S.aud);
        const text = S.text || '';
        const done = doneSet();
        const isLead = S.aud === 'lidlar';
        const grps = isLead ? STAGE_ORDER().filter(k => all.some(r => r.grp === k)) : [...new Set(all.map(r => r.grp))].sort();
        const q = S.q.trim().toLowerCase();
        const shown = all.filter(r => (S.f === 'all' || r.grp === S.f) && (!q || r.name.toLowerCase().includes(q) || (digits(q) && digits(r.phone).includes(digits(q)))));
        const okShown = shown.filter(r => validPhone(r.phone) && !isDone(done, r, text));
        const sel = selectedList();
        const sendable = sel.filter(r => validPhone(r.phone) && !isDone(done, r, text));
        const sample = sel[Math.min(S.prev, Math.max(0, sel.length - 1))] || shown[0] || null;
        const filled = sendable.map(r => fill(text, r));
        const segs = filled.map(parts), lens = sel.map(r => fill(text, r).length);
        const perMax = segs.length ? Math.max(...segs) : parts(text), perMin = segs.length ? Math.min(...segs) : perMax;
        const total = segs.reduce((a, b) => a + b, 0);
        const tplLen = PH().reduce((t, p) => t.split(p.key).join(''), text).length;
        const lowBal = S.bal != null && total > S.bal;
        const counts = { lidlar: audience('lidlar').length, oquvchilar: audience('oquvchilar').length, qarzdorlar: audience('qarzdorlar').length };
        const t = S.timeout;
        const why = !text.trim() ? 'Xabar matnini kiriting' : !sel.length ? 'Kamida bitta qabul qiluvchi tanlang' : sel.length > MAX ? `Bir martada eng koʻpi bilan ${MAX} ta qabul qiluvchi tanlanishi mumkin`
            : t ? 'Avval tarixni yangilang — SMSlar yuborilgan boʻlishi mumkin' : !sendable.length ? 'Tanlanganlarning hammasiga bu matn allaqachon yuborilgan' : '';
        const missing = text.includes('{sinov_guruh}') ? sendable.filter(r => !ctxOf(r)['{sinov_guruh}']) : [];
        const presetBtn = p => `<button type="button" class="rdp-sms-opt${S.preset === p.k ? ' is-on' : ''}" role="radio" aria-checked="${S.preset === p.k}" data-sms-preset="${p.k}"><i class="rdp-radio" aria-hidden="true"></i><span><b>${esc(p.t)}</b><small>${esc(p.s)}${p.bad ? ` · ${p.bad} ta notoʻgʻri raqam tanlanmaydi` : ''}</small></span><em>${p.list.length}</em></button>`;
        const row = r => {
            const ok = validPhone(r.phone), on = S.sel.has(key(r)), dn = ok && isDone(done, r, text);
            const noLink = ok && !dn && text.includes('{sinov_guruh}') && !ctxOf(r)['{sinov_guruh}'];
            return `<label class="rdp-sms-r${on ? ' is-on' : ''}${ok ? '' : ' is-bad'}"><input type="checkbox" data-sms-k="${esc(key(r))}"${on ? ' checked' : ''}${ok && !dn ? '' : ' disabled'}><span><b>${esc(r.name)}</b><small>${esc(phoneTxt(r.phone))}${r.sub ? ` · ${esc(r.sub)}` : ''}</small></span>${!ok ? '<em class="rdp-pill rdp-pill--red">notoʻgʻri raqam</em>' : dn ? '<em class="rdp-pill rdp-pill--grn">yuborilgan</em>' : noLink ? '<em class="rdp-pill sot-pill--amb" title="Sinov guruhi havolasi yoʻq">havola yoʻq</em>' : ''}</label>`;
        };
        const hist = S.hist || [];
        const hSent = hist.filter(h => h.status === 'sent').length;
        const hList = hist.filter(h => S.hf === 'all' || (S.hf === 'sent' ? h.status === 'sent' : h.status !== 'sent'));
        const noMgr = !mid();
        host.innerHTML = `${U.headHtml({ title: 'SMS yuborish', sub: 'Eskiz.uz orqali · faqat sizga biriktirilgan lidlar va oʻz oʻquvchilaringiz · telefoni yoʻqlar roʻyxatga kirmaydi', chipRight: true,
                right: `<span class="rdp-bal${S.balErr ? ' is-err' : lowBal || (S.bal != null && S.bal < 100) ? ' is-low' : ''}"><i></i>${S.bal === undefined ? 'Balans: …' : S.bal == null ? 'Balans aniqlanmadi' : `Balans: ${U.num(S.bal)} SMS`}</span>` })}
          ${noMgr ? '<div class="rdp-errbox" role="alert"><b>Profilingiz sotuv menejeriga bogʻlanmagan</b><span>Lid va oʻquvchilar roʻyxati boʻsh — admin bilan bogʻlaning.</span></div>' : ''}
          <div class="rdp-sms sot-sms">
            <section class="rdp-card rdp-sms-c1" aria-labelledby="sotSms1"><h2 id="sotSms1"><i class="rdp-step">1</i>Kimga</h2>
              <h3 class="rdp-sms-h">Tayyor guruhlar</h3>
              <div class="rdp-sms-opts" role="radiogroup" aria-label="Kimga">${ps.map(presetBtn).join('')}
                <button type="button" class="rdp-sms-opt${S.preset === 'manual' ? ' is-on' : ''}" role="radio" aria-checked="${S.preset === 'manual'}" data-sms-preset="manual"><i class="rdp-radio" aria-hidden="true"></i><span><b>Qoʻlda tanlash</b><small>Pastdagi roʻyxatdan belgilang</small></span><em>${S.preset === 'manual' ? S.sel.size : '—'}</em></button></div>
              <h3 class="rdp-sms-h">Auditoriya</h3>
              <div class="rdp-seg rdp-seg--full" role="group" aria-label="Auditoriya">${Object.keys(AUD).map(k => `<button type="button" data-sms-aud="${k}" aria-pressed="${S.aud === k}">${AUD[k]} · ${counts[k]}</button>`).join('')}</div>
              <input type="search" class="rdp-in" placeholder="Ism yoki telefon boʻyicha qidirish…" value="${esc(S.q)}" data-sms-q aria-label="Ism yoki telefon boʻyicha qidirish">
              <label class="rdp-inline rdp-inline--full">${isLead ? 'Bosqich' : 'Guruh'} <select data-sms-f><option value="all">${isLead ? 'Barcha bosqichlar' : 'Barcha guruhlar'}</option>${grps.map(k => `<option value="${esc(k)}"${S.f === k ? ' selected' : ''}>${esc(isLead ? stageLabel(k) : k)} · ${all.filter(r => r.grp === k).length}</option>`).join('')}</select></label>
              <div class="rdp-sms-all"><label><input type="checkbox" data-sms-all${okShown.length && okShown.every(r => S.sel.has(key(r))) ? ' checked' : ''}${okShown.length ? '' : ' disabled'}> Hammasini tanlash (${okShown.length})</label>${S.sel.size ? '<button type="button" class="rdp-link" data-sms-clear>Tozalash</button>' : ''}</div>
              <div class="rdp-sms-list">${shown.map(row).join('') || `<p class="rdp-mt" style="padding:14px">${all.length ? 'Hech kim topilmadi' : isLead ? 'Sizga biriktirilgan telefonli lid yoʻq' : 'Sizning telefonli oʻquvchingiz yoʻq'}</p>`}</div>
              <p class="rdp-mt sot-sms-note">Auditoriya almashtirilsa tanlov tozalanadi. “Notoʻgʻri raqam”lar avtomatik tanlanmaydi (server 998XXXXXXXXX ni talab qiladi). Bir yuborishda eng koʻpi ${MAX} kishi.</p>
            </section>
            <section class="rdp-card rdp-sms-c2" aria-labelledby="sotSms2"><h2 id="sotSms2"><i class="rdp-step">2</i>Xabar matni</h2>
              <textarea class="rdp-sms-ta${S.showWhy && !text.trim() ? ' is-err' : ''}" rows="6" data-sms-text aria-label="Xabar matni" placeholder="SMS matnini kiriting…" maxlength="900">${esc(text)}</textarea>
              <div class="rdp-sms-ph"><b>Har kimga moslashadigan qismlar</b><div>${PH().map(p => `<button type="button" class="rdp-sms-chip" data-sms-ph="${esc(p.key)}" title="${esc(p.label || '')}">${esc(p.key)}</button>`).join('')}</div>
                <small>Bosilganda matnga qoʻshiladi. Yuborilayotganda har bir odam uchun alohida almashtiriladi — masalan <b>{sinov_guruh}</b> oʻsha oʻquvchiga biriktirilgan ustozning guruh havolasiga aylanadi.</small></div>
              <div class="rdp-sms-tiles">
                <div><small>Belgilar</small><b>${sel.length ? `${Math.min(...lens)}${Math.max(...lens) !== Math.min(...lens) ? '–' + Math.max(...lens) : ''}` : tplLen}</b><span>${sel.length ? 'ismlar bilan' : 'shablon uzunligi'}</span></div>
                <div><small>Bir kishiga</small><b>${perMin !== perMax ? `${perMin}–${perMax}` : perMax} SMS</b><span>${isUni(text) ? '70 belgi = 1 SMS' : '160 belgi = 1 SMS'}</span></div>
                <div class="${lowBal ? 'is-red' : ''}"><small>Jami sarf</small><b>${total} SMS</b><span>${sel.length ? `${sendable.length} kishi · balans ${S.bal != null ? U.num(S.bal) : 'nomaʼlum'}` : 'hali hech kim tanlanmagan'}</span></div>
              </div>
              ${FANCY.test(text) ? `<div class="rdp-sms-note"><span>Matnda ʼ yoki “—” kabi belgi bor — bitta SMS 70 belgi. Faqat oddiy lotin harflari boʻlsa 160 belgi.</span><button type="button" class="rdp-btn" data-sms-plain>ʼ → ' almashtirish</button></div>` : ''}
              ${lowBal ? `<div class="rdp-sms-note sot-sms-low" role="note"><span>Balans kam: ${total} SMS kerak, hisobda ${U.num(S.bal)} SMS. Eskiz hisobini toʻldiring — aks holda bir qismi yuborilmaydi.</span></div>` : ''}
              ${t ? `<div class="rdp-sms-to" role="alert"><div><b>Javob kelmadi — SMSlar yuborilgan boʻlishi mumkin. Tarixni tekshiring.</b><span>Server ${t.recipients.length} ta raqamga navbat bilan yuborishda davom etishi mumkin. Qayta yuborishdan oldin tarixni yangilang — “Yuborildi” boʻlganlar tanlovdan olinadi.</span></div><button type="button" class="rdp-btn" data-sms-hrefresh ${t.refreshing ? 'disabled' : ''}>${t.refreshing ? 'Yangilanmoqda…' : 'Tarixni yangilash'}</button></div>` : ''}
              <div class="rdp-sms-foot"><span>${sel.length} ta qabul qiluvchi tanlangan${sel.length !== sendable.length && sel.length ? ` · ${sendable.length} tasiga ketadi` : ''}</span><button type="button" class="rdp-btn rdp-btn--pri rdp-btn--lg" data-sms-send aria-disabled="${!!why || S.sending}" ${S.sending ? 'disabled' : ''}>${S.sending ? 'Yuborilmoqda…' : sendable.length ? `${sendable.length} kishiga yuborish` : 'Yuborish'}</button></div>
              ${S.showWhy && why ? `<p class="rdp-sms-warn" role="alert">${esc(why)}</p>` : ''}
            </section>
            ${S.res ? resultHtml() : `<section class="rdp-card rdp-sms-c3" aria-labelledby="sotSms3"><h2 id="sotSms3"><i class="rdp-step">3</i>Koʻrinishi</h2>
              <div class="rdp-sms-nav"><button type="button" class="rdp-btn rdp-btn--ic" data-sms-prev="-1" aria-label="Oldingi" ${sel.length > 1 && S.prev > 0 ? '' : 'disabled'}>‹</button><span>${sel.length ? `${Math.min(S.prev, sel.length - 1) + 1} / ${sel.length} · ` : 'Namuna · '}${esc(sample?.name || '—')}</span><button type="button" class="rdp-btn rdp-btn--ic" data-sms-prev="1" aria-label="Keyingi" ${sel.length > 1 && S.prev < sel.length - 1 ? '' : 'disabled'}>›</button></div>
              <div class="rdp-phone"><div class="rdp-phone-in"><small>Domwork · ${esc(sample ? phoneTxt(sample.phone) : '')}</small><p>${previewHtml(text, sample)}</p></div>
                <small class="rdp-phone-meta">${sample && text ? `${fill(text, sample).length} belgi · ${parts(fill(text, sample))} SMS · ${isUni(fill(text, sample)) ? '70 belgilik (ʻ/kirill)' : '160 belgilik (lotin)'}` : ''}</small></div>
              <p class="rdp-mt"><mark class="rdp-sms-ok">koʻk</mark> — almashtirilgan qism, <mark class="rdp-sms-miss">qizil</mark> — maʼlumot topilmadi (boʻsh ketadi).</p>
            </section>`}
          </div>
          <section class="rdp-card sot-hist" aria-labelledby="sotSmsHist"><div class="rdp-card-h"><h2 id="sotSmsHist">Yuborilgan SMS tarixi</h2>
              <div class="sot-hf" role="group" aria-label="Holat boʻyicha">${[['all', `Hammasi · ${hist.length}`], ['sent', `Yuborildi · ${hSent}`], ['err', `Xato · ${hist.length - hSent}`]].map(([k, l]) => `<button type="button" data-sms-hf="${k}" aria-pressed="${S.hf === k}">${l}</button>`).join('')}<button type="button" class="rdp-btn" data-sms-hload>Yangilash</button></div></div>
            ${S.histErr ? `<div class="rdp-errbox" role="alert"><b>Tarixni yuklab boʻlmadi</b><span>${esc(S.histErr.message || '')}</span><button type="button" class="rdp-btn" data-sms-hload>Qayta urinish</button></div>`
              : S.hist == null ? '<p class="rdp-mt">Yuklanmoqda…</p>' : !hist.length ? '<p class="rdp-mt">Hali SMS yubormagansiz</p>' : !hList.length ? '<p class="rdp-mt">Bu holatda yozuv yoʻq</p>'
              : `<div class="rdp-hist sot-hist-t" role="table"><div class="rdp-hist-r rdp-th" role="row"><span role="columnheader">Qabul qiluvchi</span><span role="columnheader">Telefon</span><span role="columnheader">Xabar</span><span role="columnheader">Holat</span><span role="columnheader">Sabab</span><span role="columnheader">Vaqt</span><span role="columnheader">Yubordi</span></div>${hList.slice(0, S.hN).map(h => `<div class="rdp-hist-r" role="row"><span><b>${esc(h.name || '—')}</b></span><span>${esc(phoneTxt(h.phone) || '—')}</span><span class="rdp-ell" title="${esc(h.message || '')}">${esc(h.message || '')}</span><span>${h.status === 'sent' ? '<em class="rdp-pill rdp-pill--grn">Yuborildi</em>' : '<em class="rdp-pill rdp-pill--red">Xato</em>'}</span><span class="rdp-ell${h.status === 'sent' ? ' rdp-mt' : ' sot-err'}" title="${esc(h.error || '')}">${h.status === 'sent' ? '—' : esc(h.error || 'Sabab qaytmadi')}</span><span class="rdp-mt">${esc(new Date(h.sentAt).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}</span><span>Siz</span></div>`).join('')}</div>
                ${hList.length > S.hN ? `<button type="button" class="rdp-btn sot-more" data-sms-hmore>Yana koʻrsatish (${hList.length - S.hN})</button>` : ''}`}
            <p class="rdp-mt">Faqat siz yuborgan SMSlar koʻrinadi (ROP — hammasini). Oxirgi 50 ta yozuv.</p>
          </section>
          ${S.cf ? confirmHtml(sendable, text, total, perMin, perMax, missing) : ''}`;
        wire(host, ps, okShown, sel, why);
        if (focus) { const sel2 = Object.keys(focus)[0]; if (sel2 && !S.cf) host.querySelector(`[data-${sel2.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}${focus[sel2] ? `="${CSS.escape(focus[sel2])}"` : ''}]`)?.focus(); }
        if (S.cf) host.querySelector('[data-sms-cfyes]')?.focus();
    }
    function wire(host, ps, okShown, sel, why) {
        const $ = s => host.querySelector(s);
        host.querySelectorAll('[data-sms-preset]').forEach(b => b.onclick = () => {
            S.preset = b.dataset.smsPreset; S.prev = 0; S.showWhy = false;
            if (S.preset !== 'manual') { const p = ps.find(x => x.k === S.preset); S.sel = new Set((p?.list || []).map(key)); S.aud = 'lidlar'; S.f = 'all'; S.q = ''; }
            else { S.sel.clear(); }
            draw(host);
            if (S.preset === 'manual') host.querySelector('[data-sms-q]')?.focus();
        });
        host.querySelectorAll('[data-sms-aud]').forEach(b => b.onclick = () => {
            if (S.aud === b.dataset.smsAud) return;
            const had = S.sel.size;
            S.aud = b.dataset.smsAud; S.f = 'all'; S.q = ''; S.sel.clear(); S.preset = 'manual'; S.prev = 0; S.showWhy = false;
            draw(host);
            if (had) toast('Auditoriya almashtirildi — tanlov tozalandi');
        });
        const qi = $('[data-sms-q]');
        if (qi) qi.oninput = e => { if (e.isComposing) return; S.q = qi.value; const pos = qi.selectionStart; draw(host); const n = host.querySelector('[data-sms-q]'); n.focus(); n.setSelectionRange(pos, pos); };
        $('[data-sms-f]')?.addEventListener('change', e => { S.f = e.target.value; draw(host); });
        host.querySelectorAll('[data-sms-k]').forEach(c => c.onchange = () => { S.preset = 'manual'; c.checked ? S.sel.add(c.dataset.smsK) : S.sel.delete(c.dataset.smsK); S.prev = 0; S.showWhy = false; draw(host); });
        const all = $('[data-sms-all]');
        if (all) all.onchange = () => { S.preset = 'manual'; okShown.forEach(r => (all.checked ? S.sel.add(key(r)) : S.sel.delete(key(r)))); S.showWhy = false; draw(host); };
        $('[data-sms-clear]')?.addEventListener('click', () => { S.sel.clear(); S.preset = 'manual'; draw(host); });
        const ta = $('[data-sms-text]');
        if (ta) ta.oninput = e => { if (e.isComposing) return; S.text = ta.value; const pos = ta.selectionStart; draw(host); const n = host.querySelector('[data-sms-text]'); n.focus(); n.setSelectionRange(pos, pos); };
        host.querySelectorAll('[data-sms-ph]').forEach(b => b.onclick = () => {
            const el = host.querySelector('[data-sms-text]'), k = b.dataset.smsPh;
            const s0 = el.selectionStart ?? el.value.length, e0 = el.selectionEnd ?? el.value.length;
            S.text = el.value.slice(0, s0) + k + el.value.slice(e0); draw(host);
            const n = host.querySelector('[data-sms-text]'); n.focus(); n.setSelectionRange(s0 + k.length, s0 + k.length);
        });
        $('[data-sms-plain]')?.addEventListener('click', () => { S.text = plain(S.text || ''); draw(host); });
        host.querySelectorAll('[data-sms-prev]').forEach(b => b.onclick = () => { S.prev = Math.max(0, Math.min(sel.length - 1, S.prev + Number(b.dataset.smsPrev))); draw(host); });
        $('[data-sms-send]')?.addEventListener('click', () => {
            if (S.sending) return;
            if (why) { S.showWhy = true; draw(host); if (!(S.text || '').trim()) host.querySelector('[data-sms-text]')?.focus(); return; }
            S.cf = true; draw(host);
        });
        const closeCf = () => { S.cf = false; draw(host); host.querySelector('[data-sms-send]')?.focus(); };
        $('[data-sms-cfno]')?.addEventListener('click', closeCf);
        $('[data-sms-cfyes]')?.addEventListener('click', () => send(host));
        $('[data-sms-cfbg]')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeCf(); });
        $('[data-sms-cf]')?.addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.preventDefault(); closeCf(); return; }
            if (e.key === 'Tab') { const bs = [...e.currentTarget.querySelectorAll('button')]; const ix = bs.indexOf(document.activeElement); e.preventDefault(); (e.shiftKey ? (bs[ix - 1] || bs[bs.length - 1]) : (bs[ix + 1] || bs[0])).focus(); }
        });
        $('[data-sms-hrefresh]')?.addEventListener('click', () => refreshAfterTimeout(host));
        host.querySelectorAll('[data-sms-hload]').forEach(b => b.onclick = () => { S.hist = null; S.histErr = null; draw(host); loadHistory(host); });
        host.querySelectorAll('[data-sms-hf]').forEach(b => b.onclick = () => { S.hf = b.dataset.smsHf; S.hN = 8; draw(host); });
        $('[data-sms-hmore]')?.addEventListener('click', () => { S.hN += 20; draw(host); });
        host.querySelectorAll('[data-sms-open]').forEach(b => b.onclick = () => {
            const [type, id] = b.dataset.smsOpen.split(':');
            if (type === 'lead' && g('openLeadOverview')) openLeadOverview(U.lang(), id);
            else if (type !== 'lead' && g('openStudentDetail')) openStudentDetail(id);
        });
        $('[data-sms-retry]')?.addEventListener('click', () => {
            const R = S.res, f = R.rows.filter(x => x.status === 'error');
            S.aud = R.aud; S.f = 'all'; S.q = ''; S.preset = 'manual'; S.prev = 0;
            S.sel = new Set(f.map(x => x.k)); S.text = S.lastText; S.res = null; draw(host);
            toast(`${f.length} ta xato qabul qiluvchi qayta tanlandi — raqamini tuzatib yuboring`);
        });
        $('[data-sms-new]')?.addEventListener('click', () => { S.res = null; draw(host); host.querySelector('[data-sms-text]')?.focus(); });
    }
    function render(host) {
        S.cf = false; S.showWhy = false;
        draw(host);
        loadBalance(host); loadHistory(host);
    }
    SP.register('sms', { tab: 'rdp-sms', render });
})();
