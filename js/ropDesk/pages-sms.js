// ROP kompyuter — SMS yuborish (dizayn RopK_Sms): 1 Kimga · 2 Xabar matni · 3 Ko'rinishi + tarix.
// Faqat ROP tili (lidlar/o'quvchilar), telefoni yo'q yoki noto'g'ri raqamlar tanlanmaydi. Yuborish — mavjud
// apiSendSms (/api/sms/send), o'rin egallovchilar — SMS_PLACEHOLDERS/_smsRecipientContext/fillSmsPlaceholders.
// Timeout: server yuborishda davom etadi → "Javob kelmadi — SMSlar yuborilgan bo'lishi mumkin. Tarixni tekshiring.",
// ko'r-ko'rona qayta yuborish yo'q: avval tarix yangilanadi, "Yuborildi" bo'lganlar tanlovdan olinadi; server ham
// skipAlreadySent bilan shu matn ketgan raqamni qayta yubormaydi. Admin/sotuv uchun Marketing → SMS rassilka o'zgarmaydi.
(function () {
    'use strict';
    const P = window.ropDeskPages; if (!P) return;
    const U = P.U, esc = U.esc, g = U.g;
    const DAY = 86400000;
    const S = { preset: 'qaror', aud: 'lidlar', q: '', stage: 'all', sel: new Set(), text: null, prev: 0,
        bal: undefined, balErr: false, hist: null, histErr: null, sending: false, timeout: null, result: null };
    const st = l => (g('normalizeLeadStatus') ? normalizeLeadStatus(l.status) : l.status);
    const digits = v => String(v || '').replace(/\D/g, '');
    const validPhone = v => { const d = digits(v); return d.length === 12 ? d.startsWith('998') : d.length === 9; };
    const phoneTxt = v => (g('formatPhoneDisplay') ? formatPhoneDisplay(v) : v);
    const stageLabel = id => (typeof FUNNEL_STAGES !== 'undefined' ? (FUNNEL_STAGES.find(f => f.id === id) || {}).label : '') || id || '';
    const closedAt = l => U.ts(l.paymentClosedSurvey?.closedDate) || U.ts(l.closedDate) || U.ts(l.slaStageEnteredAt) || U.ts(l.statusChangedAt) || U.ts(l.updatedAt) || U.ts(l.createdAt);
    const key = r => `${r.type}:${r.id}`;
    const PH = () => (typeof SMS_PLACEHOLDERS !== 'undefined' ? SMS_PLACEHOLDERS : [{ key: '{ism}' }, { key: '{ustoz}' }, { key: '{sinov_guruh}' }]);
    const ctxOf = r => (g('_smsRecipientContext') ? _smsRecipientContext(r) : { '{ism}': r.name || '' });
    const fill = (t, r) => (g('fillSmsPlaceholders') ? fillSmsPlaceholders(t, ctxOf(r)) : String(t).split('{ism}').join(r.name || ''));

    // ---- auditoriyalar (faqat ROP tili) ----
    function audience(aud) {
        const lg = U.lang();
        const students = (g('getItem') ? getItem(STORAGE_KEYS.students, []) : []).filter(s => !s.isStaffDemo && (s.subject || 'english') === lg && s.phone);
        if (aud === 'oquvchilar') return students.map(s => ({ id: s.id, type: 'student', name: s.name || '(ismsiz)', phone: s.phone, sub: s.group || '', teacherId: s.teacherId || '' }));
        if (aud === 'qarzdorlar') return students.filter(s => (window.AttendanceRules?.isDebtor ? window.AttendanceRules.isDebtor(s) : Number(s.debtAmount || 0) > 0)).map(s => ({ id: s.id, type: 'debtor', name: s.name || '(ismsiz)', phone: s.phone,
            sub: Number(s.debtAmount || 0) > 0 ? `${U.num(s.debtAmount)} soʻm qarz` : (s.paymentDueDate || ''), teacherId: s.teacherId || '' }));
        return U.leads().filter(l => l.phone).map(l => ({ id: l.id, type: 'lead', name: l.name || '(ismsiz)', phone: l.phone, sub: stageLabel(st(l)), stage: st(l), lead: l,
            teacherId: l.paymentOnboarding?.teacherId || l.trialRequest?.teacherId || '' }));
    }
    function presets() {
        const leads = audience('lidlar');
        const ws = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() || 7) - 1)); d.setHours(0, 0, 0, 0); return d.getTime(); })();
        const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
        return [
            { k: 'qaror', t: 'Qaror jarayonida', s: 'Hali toʻlov qilmaganlar', list: leads.filter(r => r.stage === 'qaror-jarayonida') },
            { k: 'noshow', t: 'Sinovga kelmaganlar', s: 'Shu hafta', list: leads.filter(r => { const t = r.lead.trialRequest; return t?.state === 'completed' && t.attended === false && U.ts(t.completedAt) >= ws; }) },
            { k: 'price', t: 'Muvaffaqiyatsiz · narx sababli', s: 'Shu oy', list: leads.filter(r => r.stage === 'muvaffaqiyatsiz-sotuv' && /narx|qimmat/i.test(r.lead.failedSaleReason?.label || r.lead.failReason || '') && closedAt(r.lead) >= ms) }
        ].map(p => ({ ...p, bad: p.list.filter(r => !validPhone(r.phone)).length, list: p.list.filter(r => validPhone(r.phone)) }));
    }
    function selectedList() {
        const map = new Map();
        ['lidlar', 'oquvchilar', 'qarzdorlar'].forEach(a => audience(a).forEach(r => map.set(key(r), r)));
        return [...S.sel].map(k => map.get(k)).filter(Boolean);
    }

    // ---- SMS hisobi (Eskiz: lotin 160/153, unicode 70/67) ----
    const isUni = t => /[^\x0A\x0D\x20-\x7E]/.test(t);
    const parts = t => { const n = t.length; if (!n) return 0; const u = isUni(t); return n <= (u ? 70 : 160) ? 1 : Math.ceil(n / (u ? 67 : 153)); };
    const FANCY = /[ʻʼ‘’`´“”«»—–…]/;
    const plain = t => t.replace(/[ʻʼ‘’`´]/g, "'").replace(/[“”«»]/g, '"').replace(/[—–]/g, '-').replace(/…/g, '...');

    function previewHtml(t, r) {
        if (!r) return esc(t);
        const ctx = ctxOf(r), keys = PH().map(p => p.key);
        return t.split(new RegExp(`(${keys.map(k => k.replace(/[{}]/g, '\\$&')).join('|')})`)).map(part => {
            if (!keys.includes(part)) return esc(part);
            const v = ctx[part];
            return v ? `<mark class="rdp-sms-ok">${esc(v)}</mark>` : `<mark class="rdp-sms-miss" title="${esc(part)} topilmadi">${esc(part)}</mark>`;
        }).join('');
    }

    async function loadBalance(host) {
        try { const d = await apiFetchSmsBalance(); const b = d?.data?.balance ?? d?.balance; S.bal = b != null ? Number(b) : null; S.balErr = false; }
        catch (e) { S.bal = null; S.balErr = true; }
        draw(host);
    }
    async function loadHistory(host) {
        S.histErr = null;
        try { S.hist = await apiFetch('/api/sms/history?limit=50', { fresh: true }); } catch (e) { S.histErr = e; }
        draw(host);
        return S.hist;
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
        S.result = { kind: 'info', text: `Tarix yangilandi: ${removed} ta qabul qiluvchiga SMS yetib borgan — ular tanlovdan olindi.${S.sel.size ? ` Qolgan ${S.sel.size} tasiga qayta yuborish mumkin (shu matn ketganlar server tomonidan oʻtkazib yuboriladi).` : ''}` };
        loadBalance(host);
    }

    async function send(host) {
        const text = (S.text || '').trim();
        const list = selectedList().filter(r => validPhone(r.phone));
        if (!text || !list.length || S.sending || S.timeout) return;
        const recipients = list.map(r => ({ id: r.id, type: r.type, name: r.name, phone: r.phone, message: fill(text, r), k: key(r), _missing: text.includes('{sinov_guruh}') && !ctxOf(r)['{sinov_guruh}'] }));
        const missing = recipients.filter(r => r._missing);
        if (missing.length && !confirm(`${missing.length} ta qabul qiluvchining sinov darsi guruhi aniqlanmadi (${missing.slice(0, 5).map(r => r.name).join(', ')}${missing.length > 5 ? ' va boshqalar' : ''}).\n\nUlarga havolasiz SMS ketadi. Davom etilsinmi?`)) return;
        if (!confirm(`${recipients.length} ta qabul qiluvchiga SMS yuborilsinmi?`)) return;
        S.sending = true; S.result = null; draw(host);
        const at = Date.now();
        try {
            const res = await apiSendSms(recipients.map(({ k, _missing, ...r }) => r), text, S.preset === 'manual' ? S.aud : 'lidlar', { skipAlreadySent: true });
            const errs = (res.results || []).filter(x => x.status === 'error').map(x => x.error).filter(Boolean);
            S.result = { kind: res.failed ? 'warn' : 'ok', text: `${res.sent || 0} ta yuborildi${res.failed ? `, ${res.failed} ta xato` : ''}${res.skipped ? `, ${res.skipped} ta oʻtkazildi (shu matn allaqachon yuborilgan)` : ''}${errs.length ? ` · Sabab: ${errs.slice(0, 3).join('; ')}` : ''}` };
            S.sel.clear();
            loadHistory(host); loadBalance(host);
        } catch (e) {
            if (e && e.timeout) S.timeout = { at, recipients, refreshing: false };
            else S.result = { kind: 'err', text: `Yuborib boʻlmadi: ${e.message || 'nomaʼlum xatolik'}` };
        }
        S.sending = false; draw(host);
    }

    function draw(host) {
        if (!host || !host.isConnected) return;
        if (S.text == null) S.text = `Assalomu alaykum, {ism}! Domwork ${U.lang() === 'english' ? 'ingliz' : 'rus'} tili kursiga joylar oz qoldi. Bugun yozilsangiz — birinchi dars sovgʻa.`;
        const ps = presets(), all = audience(S.aud);
        const stages = [...new Set(all.map(r => r.stage).filter(Boolean))];
        const q = S.q.trim().toLowerCase();
        const shown = all.filter(r => (S.stage === 'all' || r.stage === S.stage) && (!q || r.name.toLowerCase().includes(q) || digits(r.phone).includes(digits(q) || '\u0000')))
            .sort((a, b) => (S.sel.has(key(b)) ? 1 : 0) - (S.sel.has(key(a)) ? 1 : 0));
        const okShown = shown.filter(r => validPhone(r.phone));
        const sel = selectedList();
        const text = S.text || '';
        const sample = sel[Math.min(S.prev, Math.max(0, sel.length - 1))] || okShown[0] || null;
        const filled = sel.map(r => fill(text, r));
        const lens = filled.map(t => t.length);
        const perOne = sel.length ? Math.max(...filled.map(parts)) : parts(text);
        const total = filled.reduce((a, t) => a + parts(t), 0);
        const tplLen = PH().reduce((t, p) => t.split(p.key).join(''), text).length;
        const lowBal = S.bal != null && total > S.bal;
        const counts = { lidlar: audience('lidlar').length, oquvchilar: audience('oquvchilar').length, qarzdorlar: audience('qarzdorlar').length };
        const t = S.timeout;
        const canSend = !!text.trim() && sel.length > 0 && !S.sending && !t && !lowBal;
        const presetBtn = p => `<button type="button" class="rdp-sms-opt${S.preset === p.k ? ' is-on' : ''}" role="radio" aria-checked="${S.preset === p.k}" data-sms-preset="${p.k}"><i class="rdp-radio" aria-hidden="true"></i><span><b>${esc(p.t)}</b><small>${esc(p.s)}${p.bad ? ` · ${p.bad} ta notoʻgʻri raqam tanlanmaydi` : ''}</small></span><em>${p.list.length}</em></button>`;
        const row = r => { const ok = validPhone(r.phone), on = S.sel.has(key(r));
            return `<label class="rdp-sms-r${on ? ' is-on' : ''}${ok ? '' : ' is-bad'}"><input type="checkbox" data-sms-k="${esc(key(r))}"${on ? ' checked' : ''}${ok ? '' : ' disabled'}><span><b>${esc(r.name)}</b><small>${esc(phoneTxt(r.phone))}${r.sub ? ` · ${esc(r.sub)}` : ''}</small></span>${ok ? '' : '<em class="rdp-pill rdp-pill--red">notoʻgʻri raqam</em>'}</label>`; };
        const hist = S.hist;
        host.innerHTML = `${U.headHtml({ title: 'SMS yuborish', sub: `Eskiz.uz orqali · ${esc(U.langLabel())} lidlari va oʻquvchilari · telefoni yoʻqlar roʻyxatga kirmaydi`, chipRight: true,
                right: `<span class="rdp-bal${S.balErr ? ' is-err' : lowBal ? ' is-low' : ''}"><i></i>${S.bal === undefined ? 'Balans…' : S.bal == null ? 'Balans: nomaʼlum' : `Balans: ${U.num(S.bal)} SMS`}</span>` })}
          <div class="rdp-sms">
            <section class="rdp-card rdp-sms-c1" aria-labelledby="rdpSms1"><h2 id="rdpSms1"><i class="rdp-step">1</i>Kimga</h2>
              <h3 class="rdp-sms-h">Tayyor guruhlar</h3>
              <div class="rdp-sms-opts" role="radiogroup" aria-label="Kimga">${ps.map(presetBtn).join('')}
                <button type="button" class="rdp-sms-opt${S.preset === 'manual' ? ' is-on' : ''}" role="radio" aria-checked="${S.preset === 'manual'}" data-sms-preset="manual"><i class="rdp-radio" aria-hidden="true"></i><span><b>Qoʻlda tanlash</b><small>Pastdagi roʻyxatdan belgilang</small></span><em>${S.preset === 'manual' ? S.sel.size : '—'}</em></button></div>
              <h3 class="rdp-sms-h">Auditoriya</h3>
              <div class="rdp-seg rdp-seg--full" role="group" aria-label="Auditoriya">${[['lidlar', 'Sotuv lidlari'], ['oquvchilar', 'Oʻquvchilar'], ['qarzdorlar', 'Qarzdorlar']].map(([k, l]) => `<button type="button" data-sms-aud="${k}" aria-pressed="${S.aud === k}">${l} · ${counts[k]}</button>`).join('')}</div>
              <input type="search" class="rdp-in" placeholder="Ism yoki telefon boʻyicha qidirish…" value="${esc(S.q)}" data-sms-q aria-label="Qidirish">
              ${S.aud === 'lidlar' ? `<label class="rdp-inline rdp-inline--full">Bosqich <select data-sms-stage><option value="all">Barcha bosqichlar</option>${stages.map(s => `<option value="${esc(s)}"${S.stage === s ? ' selected' : ''}>${esc(stageLabel(s))}</option>`).join('')}</select></label>` : ''}
              <div class="rdp-sms-all"><label><input type="checkbox" data-sms-all${okShown.length && okShown.every(r => S.sel.has(key(r))) ? ' checked' : ''}> Hammasini tanlash (${okShown.length})</label>${S.sel.size ? '<button type="button" class="rdp-link" data-sms-clear>Tozalash</button>' : ''}</div>
              <div class="rdp-sms-list">${shown.map(row).join('') || '<p class="rdp-mt" style="padding:14px">Roʻyxat boʻsh</p>'}</div>
            </section>
            <section class="rdp-card rdp-sms-c2" aria-labelledby="rdpSms2"><h2 id="rdpSms2"><i class="rdp-step">2</i>Xabar matni</h2>
              <textarea class="rdp-sms-ta" rows="6" data-sms-text aria-label="Xabar matni" maxlength="900">${esc(text)}</textarea>
              <div class="rdp-sms-ph"><b>Har kimga moslashadigan qismlar</b><div>${PH().map(p => `<button type="button" class="rdp-sms-chip" data-sms-ph="${esc(p.key)}" title="${esc(p.label || '')}">${esc(p.key)}</button>`).join('')}</div>
                <small>Bosilganda matnga qoʻshiladi. Yuborilayotganda har bir odam uchun alohida almashtiriladi — masalan <b>{sinov_guruh}</b> oʻsha oʻquvchiga biriktirilgan ustozning guruh havolasiga aylanadi.</small></div>
              <div class="rdp-sms-tiles">
                <div><small>Belgilar</small><b>${sel.length ? `${Math.min(...lens)}${Math.max(...lens) !== Math.min(...lens) ? '–' + Math.max(...lens) : ''}` : tplLen}</b><span>${sel.length ? 'ismlar bilan' : 'shablon uzunligi'}</span></div>
                <div><small>Bir kishiga</small><b>${perOne} SMS</b><span>${isUni(text) ? '70 belgi = 1 SMS' : '160 belgi = 1 SMS'}</span></div>
                <div class="${lowBal ? 'is-red' : ''}"><small>Jami sarf</small><b>${total} SMS</b><span>${sel.length ? `${sel.length} kishi${S.bal != null ? ` · balans ${U.num(S.bal)}` : ''}` : 'hali hech kim tanlanmagan'}</span></div>
              </div>
              ${FANCY.test(text) ? `<div class="rdp-sms-note"><span>Matnda ʼ yoki “—” kabi belgi bor — bitta SMS 70 belgi. Faqat oddiy lotin harflari boʻlsa 160 belgi.</span><button type="button" class="rdp-btn" data-sms-plain>ʼ → ' almashtirish</button></div>` : ''}
              ${t ? `<div class="rdp-sms-to" role="alert"><div><b>Javob kelmadi — SMSlar yuborilgan boʻlishi mumkin. Tarixni tekshiring.</b><span>Server ${t.recipients.length} ta raqamga navbat bilan yuborishda davom etishi mumkin. Qayta yuborishdan oldin tarixni yangilang — “Yuborildi” boʻlganlar tanlovdan olinadi.</span></div><button type="button" class="rdp-btn" data-sms-hrefresh ${t.refreshing ? 'disabled' : ''}>${t.refreshing ? 'Yangilanmoqda…' : 'Tarixni yangilash'}</button></div>` : ''}
              ${S.result ? `<div class="rdp-sms-res is-${S.result.kind}" role="status">${esc(S.result.text)}</div>` : ''}
              <div class="rdp-sms-foot"><span>${sel.length} ta qabul qiluvchi tanlangan</span><button type="button" class="rdp-btn rdp-btn--pri rdp-btn--lg" data-sms-send ${canSend ? '' : 'disabled'}>${S.sending ? 'Yuborilmoqda…' : sel.length ? `${sel.length} kishiga yuborish` : 'Yuborish'}</button></div>
              ${t ? '<p class="rdp-sms-warn">Avval tarixni yangilang — SMSlar yuborilgan boʻlishi mumkin</p>' : lowBal ? '<p class="rdp-sms-warn">Balans yetarli emas — Eskiz hisobini toʻldiring</p>' : ''}
            </section>
            <section class="rdp-card rdp-sms-c3" aria-labelledby="rdpSms3"><h2 id="rdpSms3"><i class="rdp-step">3</i>Koʻrinishi</h2>
              <div class="rdp-sms-nav"><button type="button" class="rdp-btn rdp-btn--ic" data-sms-prev="-1" aria-label="Oldingi" ${sel.length > 1 && S.prev > 0 ? '' : 'disabled'}>‹</button><span>${sel.length ? `${Math.min(S.prev, sel.length - 1) + 1} / ${sel.length} · ` : 'Namuna · '}${esc(sample?.name || '—')}</span><button type="button" class="rdp-btn rdp-btn--ic" data-sms-prev="1" aria-label="Keyingi" ${sel.length > 1 && S.prev < sel.length - 1 ? '' : 'disabled'}>›</button></div>
              <div class="rdp-phone"><div class="rdp-phone-in"><small>Domwork · ${esc(sample ? phoneTxt(sample.phone) : '')}</small><p>${previewHtml(text, sample)}</p></div>
                <small class="rdp-phone-meta">${sample ? `${fill(text, sample).length} belgi · ${parts(fill(text, sample))} SMS · ${isUni(fill(text, sample)) ? '70 belgilik (ʼ/kirill)' : '160 belgilik (lotin)'}` : ''}</small></div>
              <p class="rdp-mt"><mark class="rdp-sms-ok">koʻk</mark> — almashtirilgan qism, <mark class="rdp-sms-miss">qizil</mark> — maʼlumot topilmadi (boʻsh ketadi).</p>
            </section>
          </div>
          <section class="rdp-card"><div class="rdp-card-h"><h2>Yuborilgan SMS tarixi</h2><button type="button" class="rdp-btn" data-sms-hload>Yangilash</button></div>
            ${S.histErr ? `<div class="rdp-errbox" role="alert"><b>Tarixni yuklab boʻlmadi</b><span>${esc(S.histErr.message || '')}</span></div>`
              : hist == null ? '<p class="rdp-mt">Yuklanmoqda…</p>' : !hist.length ? '<p class="rdp-mt">Hali SMS yuborilmagan</p>'
              : `<div class="rdp-hist" role="table"><div class="rdp-hist-r rdp-th" role="row"><span>Qabul qiluvchi</span><span>Telefon</span><span>Xabar</span><span>Holat</span><span>Vaqt</span></div>${hist.slice(0, 50).map(h => `<div class="rdp-hist-r" role="row"><span>${esc(h.name || '—')}</span><span>${esc(phoneTxt(h.phone) || '—')}</span><span class="rdp-ell" title="${esc(h.message || '')}">${esc(h.message || '')}</span><span>${h.status === 'sent' ? '<em class="rdp-pill rdp-pill--grn">Yuborildi</em>' : `<em class="rdp-pill rdp-pill--red" title="${esc(h.error || '')}">Xato${h.error ? ' · ' + esc(h.error) : ''}</em>`}</span><span class="rdp-mt">${esc(new Date(h.sentAt).toLocaleString('uz-UZ'))}</span></div>`).join('')}</div>`}
          </section>`;
        wire(host, ps, okShown, sel);
    }
    function wire(host, ps, okShown, sel) {
        const $ = s => host.querySelector(s);
        host.querySelectorAll('[data-sms-preset]').forEach(b => b.onclick = () => {
            S.preset = b.dataset.smsPreset; S.prev = 0; S.result = null;
            if (S.preset !== 'manual') { const p = ps.find(x => x.k === S.preset); S.sel = new Set((p?.list || []).map(key)); S.aud = 'lidlar'; }
            else S.sel.clear();
            draw(host);
        });
        host.querySelectorAll('[data-sms-aud]').forEach(b => b.onclick = () => { S.aud = b.dataset.smsAud; S.stage = 'all'; draw(host); });
        const qi = $('[data-sms-q]');
        if (qi) qi.oninput = () => { S.q = qi.value; const pos = qi.selectionStart; draw(host); const n = host.querySelector('[data-sms-q]'); n.focus(); n.setSelectionRange(pos, pos); };
        $('[data-sms-stage]')?.addEventListener('change', e => { S.stage = e.target.value; draw(host); });
        host.querySelectorAll('[data-sms-k]').forEach(c => c.onchange = () => { S.preset = 'manual'; c.checked ? S.sel.add(c.dataset.smsK) : S.sel.delete(c.dataset.smsK); S.prev = 0; draw(host); });
        const all = $('[data-sms-all]');
        if (all) all.onchange = () => { S.preset = 'manual'; okShown.forEach(r => (all.checked ? S.sel.add(key(r)) : S.sel.delete(key(r)))); draw(host); };
        $('[data-sms-clear]')?.addEventListener('click', () => { S.sel.clear(); S.preset = 'manual'; draw(host); });
        const ta = $('[data-sms-text]');
        if (ta) ta.oninput = () => { S.text = ta.value; const pos = ta.selectionStart; draw(host); const n = host.querySelector('[data-sms-text]'); n.focus(); n.setSelectionRange(pos, pos); };
        host.querySelectorAll('[data-sms-ph]').forEach(b => b.onclick = () => {
            const el = host.querySelector('[data-sms-text]'), k = b.dataset.smsPh;
            const s0 = el.selectionStart ?? el.value.length, e0 = el.selectionEnd ?? el.value.length;
            S.text = el.value.slice(0, s0) + k + el.value.slice(e0); draw(host);
            const n = host.querySelector('[data-sms-text]'); n.focus(); n.setSelectionRange(s0 + k.length, s0 + k.length);
        });
        $('[data-sms-plain]')?.addEventListener('click', () => { S.text = plain(S.text || ''); draw(host); });
        host.querySelectorAll('[data-sms-prev]').forEach(b => b.onclick = () => { S.prev = Math.max(0, Math.min(sel.length - 1, S.prev + Number(b.dataset.smsPrev))); draw(host); });
        $('[data-sms-send]')?.addEventListener('click', () => send(host));
        $('[data-sms-hrefresh]')?.addEventListener('click', () => refreshAfterTimeout(host));
        $('[data-sms-hload]')?.addEventListener('click', () => { S.hist = null; draw(host); loadHistory(host); });
    }
    function render(host) {
        S.result = null;
        if (S.preset !== 'manual' && !S.timeout) { const p = presets().find(x => x.k === S.preset); S.sel = new Set((p?.list || []).map(key)); }
        draw(host);
        loadBalance(host); loadHistory(host);
    }
    P.register('sms', { tab: 'rdp-sms', render });
})();
