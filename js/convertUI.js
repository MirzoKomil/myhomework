// Sinovdan keyin o'quvchiga aylantirish — 6 qadam (SotuvKonversiya, SotuvKonvertGuruh).
// Faqat ko'rinish: mavjud oynalar (js/app.js: openPaymentTeacherScheduleModal → openPaymentProcessModal →
// openPaymentOnboardingModal → openPaymentClosedModal) va ularning ma'lumot/tekshiruvlari o'zgarmaydi.
// Bu fayl qadamlar qatorini, Xulosa panelini, tarif va bo'sh vaqt kartalarini hamda alohida
// "Telegram guruh" qadamini qo'shadi. Lid → o'quvchi, guruh nomi (nextGroupName) — serverda, avvalgidek.
(function () {
    'use strict';
    const STEPS = ['Sinov', 'Natija', 'Tarif va jadval', 'To\'lov', 'Telegram guruh', 'Ilova login'];
    const LINK_RE = /^https:\/\/t\.me\/(\+[A-Za-z0-9_-]{8,64}|joinchat\/[A-Za-z0-9_-]{8,64}|[A-Za-z0-9_]{5,32})$/;
    const MON = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const DAY = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const g = name => (typeof window[name] === 'function' ? window[name] : null);
    const items = key => (typeof getItem === 'function' && typeof STORAGE_KEYS !== 'undefined' ? getItem(STORAGE_KEYS[key], []) : []);
    const shortName = n => { const p = String(n || '').trim().split(/\s+/); return p[0] ? p[0] + (p[1] ? ' ' + p[1][0] + '.' : '') : '—'; };
    const staffName = id => (items('hrEmployees').find(e => e.id === id) || items('teachers').find(t => t.id === id))?.name || '';
    const local = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : new Date(d.getTime() + 5 * 3600000); };
    const when = iso => { const d = local(iso); if (!d) return ''; return `${DAY[d.getUTCDay()]} ${d.getUTCDate()}-${MON[d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
    const patternOf = day => ([2, 4, 6].includes(Number(day)) ? 'tts' : 'mwf');
    const PAT = { mwf: { days: [1, 3, 5], label: 'Du · Ch · Ju' }, tts: { days: [2, 4, 6], label: 'Se · Pa · Sh' } };
    // Tarif narxi (oyiga) — dizayn (SotuvKonversiya) bo'yicha: 15 daq 75 000, 30 daq 150 000, 60 daq 300 000.
    const PRICE = { 15: 75000, 30: 150000, 60: 300000 };
    const COURSE_DAYS = 90;
    const num = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const ddmm = d => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
    const ymdLocal = () => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
    const addD = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    const dowOf = d => new Date(d + 'T00:00:00Z').getUTCDay();
    const dLabel = d => `${DAY[dowOf(d)]} ${Number(d.slice(8))}-${MON[Number(d.slice(5, 7)) - 1]}`;
    // Konversiya — to'liq sahifa ko'rinishi (SotuvKonversiya): mavjud oyna kontent maydonini to'liq egallaydi,
    // tepada "← Lidlar · Sinov darsida" va lid ismi. Oyna yopilganda (crm:modal-closed) odatiy ko'rinishga qaytadi.
    function pageMode(lead) {
        const ov = document.getElementById('modalOverlay'); if (!ov) return;
        wrapOpenModal();
        ov.classList.add('cv-pagemode');
        // Kontent maydoni: sidebar va yuqori panel ko'rinib turadi (dizayndagidek sahifa).
        const sb = document.getElementById('sidebar')?.getBoundingClientRect(), hd = document.querySelector('.top-header')?.getBoundingClientRect();
        if (window.matchMedia('(min-width: 901px)').matches && sb && hd) { ov.style.setProperty('--cv-l', Math.round(sb.right) + 'px'); ov.style.setProperty('--cv-t', Math.round(hd.bottom) + 'px'); }
        else { ov.style.removeProperty('--cv-l'); ov.style.removeProperty('--cv-t'); }
        const t = document.getElementById('modalTitle'); if (t && lead?.name) t.textContent = lead.name;
        const hdr = t?.parentElement;
        hdr?.querySelector('.cv-back')?.remove();
        if (hdr && t) {
            t.insertAdjacentHTML('beforebegin', `<button type="button" class="sc-link cv-back">← Lidlar${lead?.status === 'sinov-darsida' ? ' · Sinov darsida' : ''}</button>`);
            hdr.querySelector('.cv-back').onclick = () => { if (typeof closeModal === 'function') closeModal(); if (typeof renderLeads === 'function') renderLeads(); };
        }
        if (!ov.dataset.cvBound) {
            ov.dataset.cvBound = '1';
            ov.addEventListener('crm:modal-closed', () => { ov.classList.remove('cv-pagemode'); ov.querySelector('.modal-header .cv-back')?.remove(); });
        }
    }

    function trialInfo(lead) {
        const t = lead?.trialRequest || null;
        const at = t?.scheduledAt || lead?.trialLessonAt || null;
        const held = t ? t.state === 'completed' || t.state === 'accepted' : !!(at && Date.parse(at) < Date.now());
        return { t, at, held, done: t?.state === 'completed', attended: t?.state === 'completed' ? t.attended !== false : null, teacherId: t?.teacherId || lead?.paymentOnboarding?.teacherId || '' };
    }
    // Qadamlar: 1–2 — sinov holati bo'yicha, keyingilari — joriy qadamgacha bajarilgan.
    // Qadam faqat haqiqatan bajarilgan bo'lsa "✓": 3 — doimiy jadval saqlangan, 4 — to'lov yozilgan, 5 — guruh kiritilgan.
    function stepDone(n, lead, tr) {
        const ob = lead?.paymentOnboarding || {};
        if (n === 1) return tr.held;
        if (n === 2) return tr.done;
        if (n === 3) return typeof leadHasTeacherSchedule === 'function' ? leadHasTeacherSchedule(lead) : !!(ob.teacherId && ob.lessonTime && !ob.isTrial);
        if (n === 4) return !!lead?.paymentSurvey;
        if (n === 5) return !!(ob.telegramGroupLink && ob.telegramGroupName);
        return false;
    }
    function steps(active, lead) {
        const tr = trialInfo(lead);
        return `<ol class="cv-chips" aria-label="O'quvchiga aylantirish qadamlari">${STEPS.map((l, i) => {
            const n = i + 1, done = n < active && stepDone(n, lead, tr);
            const cls = n === active ? 'is-now' : done ? 'is-done' : '';
            return `<li class="cv-chip ${cls}"${n === active ? ' aria-current="step"' : ''}>${done ? '✓' : n} ${esc(l)}</li>`;
        }).join('')}</ol>`;
    }
    function subline(lead, lang) {
        const tr = trialInfo(lead);
        const mgr = staffName(lead?.managerId);
        return [lead?.phone && (typeof formatPhoneDisplay === 'function' ? formatPhoneDisplay(lead.phone) : lead.phone), lang === 'russian' ? 'Rus tili' : 'Ingliz tili',
            mgr && 'menejer ' + String(mgr).split(' ')[0], tr.at && `sinov: ${when(tr.at)}${tr.teacherId ? ', ' + staffName(tr.teacherId) : ''}`].filter(Boolean).map(esc).join(' · ');
    }
    function trialBox(lead) {
        const tr = trialInfo(lead);
        if (!tr.t || !tr.done) return tr.at ? `<div class="cv-trial"><b>Sinov darsi${tr.teacherId ? ' · ' + esc(shortName(staffName(tr.teacherId))) : ''}</b>${esc(when(tr.at))} · natija hali yozilmagan</div>` : '';
        const t = tr.t;
        return `<div class="cv-trial"><b>✓ Sinov natijasi${tr.teacherId ? ' · ' + esc(shortName(staffName(tr.teacherId))) : ''}</b>${t.attended === false ? esc(t.reasonLabel || 'O\'tkazilmadi') + '.' : 'O\'tkazildi.'}${t.resultNote ? ` "${esc(t.resultNote)}"` : ''}</div>`;
    }

    // ── 3-qadam: Tarif va jadval (mavjud jadval oynasi ustiga) ──
    function enhanceSchedule(modalBody, lead, lang) {
        // #modalBody bitta element — oyna qayta ochilganda eski belgi qolmasin (avval dataset.cvDone qayta ochishda bezakni o'chirib qo'yardi).
        if (!modalBody || modalBody.querySelector('.cv-lay')) return;
        delete modalBody.dataset.cvFirst;
        const oldSteps = modalBody.querySelector('.pay-steps');
        const survey = modalBody.querySelector('.lead-survey');
        if (!survey) return;
        oldSteps?.insertAdjacentHTML('beforebegin', `<p class="cv-sub">${subline(lead, lang)}</p>${steps(3, lead)}`);
        oldSteps?.remove();
        const lay = document.createElement('div'); lay.className = 'cv-lay';
        lay.innerHTML = '<div class="cv-main"></div><aside class="cv-aside" aria-label="Xulosa"></aside>';
        survey.before(lay); lay.querySelector('.cv-main').appendChild(survey);
        const aside = lay.querySelector('.cv-aside');
        const teacherSel = modalBody.querySelector('#onboardTeacherId'), durSel = modalBody.querySelector('#onboardLessonDuration');
        const block = modalBody.querySelector('#onboardScheduleBlock'), picker = modalBody.querySelector('#onboardSchedulePicker');
        const tr = trialInfo(lead);
        // Tarif — dars davomiyligi (15/30/60). Asl select yashirin, qiymati o'sha.
        if (durSel) {
            const f = durSel.closest('.lead-survey-field'); if (f) f.hidden = true, f.style.display = 'none';
            const box = document.createElement('section'); box.className = 'cv-box';
            box.innerHTML = `<h4>Tarif</h4><div class="cv-tar" role="radiogroup" aria-label="Tarif">${[...durSel.options].filter(o => o.value).map(o => `<button type="button" role="radio" data-dur="${esc(o.value)}" aria-checked="${o.value === durSel.value}">${esc(o.value)} daq${PRICE[o.value] ? ` · ${num(PRICE[o.value])}<span class="cv-pm"> so'm/oy</span>` : ''}</button>`).join('')}</div>
              ${tr.t?.resultNote ? `<p class="cv-rec">Ustoz tavsiyasi: <b>"${esc(tr.t.resultNote)}"</b></p>` : ''}<p class="cv-hint">Narx — oyiga. To'lov turi va summasi keyingi qadamda.</p>`;
            survey.prepend(box);
            box.querySelectorAll('[data-dur]').forEach(b => b.onclick = () => { durSel.value = b.dataset.dur; durSel.dispatchEvent(new Event('change', { bubbles: true })); sync(); });
        }
        // Bo'sh vaqt kartalari: tanlangan kunlarning UCHALASIDA ham bo'sh vaqtlar. To'liq jadval — "Barcha vaqtlar" ichida.
        let slots = null;
        if (block && picker) {
            slots = document.createElement('div'); slots.className = 'cv-slotw';
            picker.before(slots);
            const det = document.createElement('details'); det.className = 'cv-grid';
            det.innerHTML = '<summary>Barcha vaqtlar jadvali (har kun alohida)</summary>';
            picker.before(det); det.appendChild(picker);
            const sel = modalBody.querySelector('#onboardScheduleSelected'); if (sel) det.after(sel);
            block.querySelectorAll(':scope > .lead-survey-label, :scope > .lead-survey-hint').forEach(x => { x.hidden = true; x.style.display = 'none'; });
        }
        const firstBox = document.createElement('div'); firstBox.className = 'cv-first';
        if (slots) (modalBody.querySelector('#onboardScheduleSelected') || slots).after(firstBox);
        const firstDates = (pat, time) => {
            const days = PAT[pat].days; const out = []; let d = ymdLocal(); const nowM = (() => { const x = new Date(Date.now() + 5 * 3600000); return x.getUTCHours() * 60 + x.getUTCMinutes(); })();
            const tm = time ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) : 0;
            for (let i = 0; out.length < 3 && i < 21; i++, d = addD(d, 1)) if (days.includes(dowOf(d)) && !(i === 0 && tm <= nowM)) out.push(d);
            return out;
        };
        const drawFirst = () => {
            const day = Number(modalBody.dataset.onboardScheduleDay), time = modalBody.dataset.onboardScheduleTime;
            if (!day || !time) { firstBox.innerHTML = ''; delete modalBody.dataset.cvFirst; return; }
            const list = firstDates(patternOf(day), time);
            if (!list.includes(modalBody.dataset.cvFirst)) modalBody.dataset.cvFirst = list[0] || '';
            firstBox.innerHTML = `<p class="cv-st">Birinchi dars</p><div class="cv-fd" role="radiogroup" aria-label="Birinchi dars">${list.map((d, i) => `<button type="button" role="radio" data-first="${d}" aria-checked="${d === modalBody.dataset.cvFirst}">${esc(dLabel(d))}${i === 0 || d === modalBody.dataset.cvFirst ? ' · ' + esc(time) : ''}</button>`).join('')}</div>`;
            firstBox.querySelectorAll('[data-first]').forEach(b => b.onclick = () => { modalBody.dataset.cvFirst = b.dataset.first; sync(); });
        };
        const others = document.createElement('div'); others.className = 'cv-oth';
        teacherSel?.closest('.lead-survey-field')?.after(others);
        const freeTimes = (tid, pat, dur) => {
            if (!g('getTeacherBusyWeeklySlots') || !g('canFitWeeklyLesson') || !g('generateTimeSlots')) return [];
            const busy = getTeacherBusyWeeklySlots(tid, null, lead?.id || null), days = PAT[pat].days;
            return generateTimeSlots().filter(t => /:(00|30)$/.test(t)).map(t => {
                const busyDays = days.filter(d => !canFitWeeklyLesson(busy, d, t, dur));
                return { t, busyDays };
            }).filter(x => x.busyDays.length < days.length);
        };
        const drawSlots = () => {
            if (!slots) return;
            const tid = teacherSel?.value, dur = Number(durSel?.value) || 30;
            if (!tid) { slots.innerHTML = ''; return; }
            const pat = PAT[modalBody.dataset.onboardSchedulePattern] ? modalBody.dataset.onboardSchedulePattern : 'mwf';
            const list = freeTimes(tid, pat, dur), pickT = modalBody.dataset.onboardScheduleTime, pickD = Number(modalBody.dataset.onboardScheduleDay);
            const full = list.filter(x => !x.busyDays.length);
            slots.innerHTML = `<div class="cv-sh"><b>Doimiy jadval · ${esc(staffName(tid) || '')}</b><div class="sc-seg" role="group" aria-label="Kunlar">${Object.entries(PAT).map(([k, p]) => `<button type="button" data-pat="${k}" aria-pressed="${k === pat}">${p.label}</button>`).join('')}</div></div>
              <p class="cv-st">Uch kunda ham bo'sh ${dur} daqiqalik vaqtlar · ${full.length} ta</p>
              <div class="cv-slots">${list.map(x => {
                  const on = pickT === x.t && PAT[pat].days.includes(pickD), part = x.busyDays.length;
                  return `<button type="button" class="cv-slot${on ? ' is-on' : ''}${part ? ' is-part' : ''}" data-t="${x.t}"${part ? ' disabled' : ''} aria-pressed="${on}"><b>${x.t}</b><small>${part ? x.busyDays.map(d => DAY[d]).join(', ') + ' band' : PAT[pat].label.replace(/ · /g, ' ') + (Number(x.t.slice(0, 2)) >= 17 ? ' · kechki' : '')}</small></button>`;
              }).join('') || '<p class="cv-hint">Bu kunlarda mos bo\'sh vaqt yo\'q — boshqa kunlar yoki ustozni tanlang.</p>'}</div>`;
            slots.querySelectorAll('[data-pat]').forEach(b => b.onclick = () => {
                if (b.dataset.pat === pat) return;
                const btn = picker.querySelector(`[data-onboard-pattern-btn="${b.dataset.pat}"]`);
                if (btn) btn.click(); else { modalBody.dataset.onboardSchedulePattern = b.dataset.pat; delete modalBody.dataset.onboardScheduleDay; delete modalBody.dataset.onboardScheduleTime; }
                sync();
            });
            slots.querySelectorAll('.cv-slot:not([disabled])').forEach(b => b.onclick = () => {
                const day = PAT[pat].days[0];
                const cell = picker.querySelector(`[data-onboard-schedule-slot][data-day="${day}"][data-time="${b.dataset.t}"]`);
                if (cell) cell.click(); else { modalBody.dataset.onboardScheduleDay = String(day); modalBody.dataset.onboardScheduleTime = b.dataset.t; }
                sync();
            });
        };
        const drawOthers = () => {
            const tid = teacherSel?.value, dur = Number(durSel?.value) || 30;
            const pat = PAT[modalBody.dataset.onboardSchedulePattern] ? modalBody.dataset.onboardSchedulePattern : 'mwf';
            const pool = teacherSel ? [...teacherSel.options].filter(o => o.value && o.value !== tid) : [];
            others.innerHTML = pool.length ? `<span class="cv-hint">${tid ? 'Boshqa ustoz:' : 'Ustozlar:'}</span>${pool.map(o => `<button type="button" class="cv-ot" data-tid="${esc(o.value)}">${esc(shortName(o.textContent))} · ${freeTimes(o.value, pat, dur).filter(x => !x.busyDays.length).length} vaqt</button>`).join('')}` : '';
            others.querySelectorAll('[data-tid]').forEach(b => b.onclick = () => { teacherSel.value = b.dataset.tid; teacherSel.dispatchEvent(new Event('change', { bubbles: true })); sync(); });
        };
        const drawAside = () => {
            const tid = teacherSel?.value, dur = Number(durSel?.value) || 0;
            const day = Number(modalBody.dataset.onboardScheduleDay), time = modalBody.dataset.onboardScheduleTime;
            const pat = day ? PAT[patternOf(day)] : null, tname = staffName(tid);
            const fd = modalBody.dataset.cvFirst || '';
            aside.innerHTML = `<h3>Xulosa</h3>${trialBox(lead)}
              <dl class="cv-dl"><dt>Tarif</dt><dd>${dur ? `${dur} daq${PRICE[dur] ? ` · ${num(PRICE[dur])} so'm/oy` : ''}` : '—'}</dd><dt>Ustoz</dt><dd>${tname ? esc(tname) : '—'}</dd>
                <dt>Jadval</dt><dd>${pat && time ? `${pat.label} ${esc(time)}` : '—'}</dd><dt>Boshlanish</dt><dd>${fd ? esc(dLabel(fd)) : '—'}</dd>
                <dt>Kurs</dt><dd>${fd ? `${COURSE_DAYS} kun · ${ddmm(fd)} → ${ddmm(addD(fd, COURSE_DAYS - 1))}` : `${COURSE_DAYS} kun · 72 dars`}</dd></dl>
              <p class="cv-note">Saqlansa vaqt ${tname ? `<b>${esc(shortName(tname))}</b> ` : ''}jadvalida doimiy band bo'ladi${tr.t ? ' va sinov yozuvi jadvaldan chiqadi' : ''}. To'lov qabul qilingach lid "O'quvchi" bo'ladi va ilova logini yaratiladi.</p>`;
        };
        let raf = 0;
        function sync() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { drawSlots(); drawFirst(); drawOthers(); drawAside(); modalBody.querySelectorAll('[data-dur]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.dur === durSel?.value))); }); }
        teacherSel?.addEventListener('change', sync); durSel?.addEventListener('change', sync);
        new MutationObserver(sync).observe(modalBody, { attributes: true, attributeFilter: ['data-onboard-schedule-day', 'data-onboard-schedule-time', 'data-onboard-schedule-pattern'] });
        const ok = document.getElementById('confirmPaymentTeacherSchedule'); if (ok) ok.textContent = 'Davom etish · To\'lov';
        pageMode(lead);
        sync();
    }

    // ── 4-qadam (To'lov) va 6-qadam (Ilova login): sarlavha va qadamlar ──
    function enhanceStep(modalBody, lead, lang, active) {
        if (!modalBody) return;
        const old = modalBody.querySelector('.pay-steps');
        const html = `<p class="cv-sub">${subline(lead, lang)}</p>${steps(active, lead)}`;
        if (old) { old.insertAdjacentHTML('beforebegin', html); old.remove(); } else modalBody.insertAdjacentHTML('afterbegin', html);
        pageMode(lead);
        // "Birinchi dars" 3-qadamda tanlangan bo'lsa — "Ilk dars boshlash sanasi" shu bilan to'ladi.
        const fdIn = modalBody.querySelector('#onboardFirstLessonDate'), fd = lead?.paymentOnboarding?.firstLessonDate;
        if (active === 6 && fdIn && !fdIn.value && /^\d{4}-\d{2}-\d{2}$/.test(String(fd || ''))) { fdIn.value = fd; fdIn.dispatchEvent(new Event('change', { bubbles: true })); }
        if (active === 6) {
            // Guruh 5-qadamda kiritilgan bo'lsa — maydonlar shu yerda yashirin (qiymati o'sha, tekshiruv o'zgarmaydi).
            const ob = lead?.paymentOnboarding || {};
            if (ob.telegramGroupLink && ob.telegramGroupName) ['#onboardTelegramGroupLink', '#onboardTelegramGroupName'].forEach(s => {
                const f = modalBody.querySelector(s)?.closest('.lead-survey-field'); if (f) { f.hidden = true; f.style.display = 'none'; }
            });
            if (ob.telegramGroupName) modalBody.querySelector('.cv-chips')?.insertAdjacentHTML('afterend', `<p class="cv-hint">Telegram guruh: <b>${esc(ob.telegramGroupName)}</b> · ${esc(String(ob.telegramGroupLink || '').replace(/^https:\/\//, ''))}</p>`);
        }
    }

    // ── 5-qadam: Telegram guruh (alohida oyna) ──
    function openGroupStep(lang, leadId, next) {
        const lead = typeof getLeadById === 'function' ? getLeadById(lang, leadId) : null;
        if (!lead) return;
        const ob = lead.paymentOnboarding || {}, ps = lead.paymentSurvey || {};
        const me = (typeof getCurrentUser === 'function' && getCurrentUser()) || {};
        const rop = items('hrEmployees').find(e => /^rop$/i.test(String(e.role || '')) && (e.status || 'active') !== 'inactive');
        const first = String(lead.name || '').split(' ')[0];
        const members = [['student', `O'quvchi · ${first || '—'}`], ['teacher', `Ustoz · ${shortName(staffName(ob.teacherId))}`],
            ['assistant', `Yordamchi${ob.assistantTeacherId ? ' · ' + shortName(staffName(ob.assistantTeacherId)) : ' ustoz'}`], ['rop', `ROP${rop ? ' · ' + shortName(rop.name) : ''}`], ['me', `Siz · ${shortName(me.name)}`]];
        const saved = ob.telegramMembers || {};
        const pay = [ps.paymentTypeLabel, ps.amountLabel].filter(Boolean).join(' · ');
        const sched = ob.lessonDayOfWeek ? `${shortName(staffName(ob.teacherId))} ${PAT[patternOf(ob.lessonDayOfWeek)].label.replace(/ · /g, '·')} ${ob.lessonTime || ''}` : '';
        const tr = trialInfo(lead);
        const sub = [pay && 'To\'lov: ' + pay, sched, tr.done ? `sinov ${when(tr.at).split(' ').slice(1, 2).join('')} o'tkazildi` : ''].filter(Boolean).map(esc).join(' · ');
        openModal(`O'quvchiga aylantirish · ${lead.name || ''}`, `<div class="cv-grp">
            ${sub ? `<p class="cv-sub">${sub}</p>` : ''}${steps(5, lead)}
            <label class="cv-f"><span>Guruh havolasi *</span><span class="cv-field"><input type="url" id="cvGroupLink" class="form-control" placeholder="https://t.me/+..." value="${esc(ob.telegramGroupLink || '')}" autocomplete="off"><span class="sc-pill sc-pill--ok cv-ok" data-okpill hidden>✓ to'g'ri havola</span></span></label>
            <label class="cv-f"><span>Guruh nomi *</span><span class="cv-field"><input type="text" id="cvGroupName" class="form-control" maxlength="80" value="${esc(ob.telegramGroupName || '')}" placeholder="C40 | onlayn ${lang === 'russian' ? 'rus' : 'ingliz'} tili"><span class="cv-sug" data-sug hidden>tizim taklifi · keyingi bo'sh raqam</span></span>
              <small>Telegram'dagi nom bilan bir xil yozing · takrorlanmasligi tekshiriladi</small></label>
            <fieldset class="cv-f"><legend>Guruhga qo'shilganini belgilang</legend><div class="cv-mem">${members.map(([k, l]) => `<label><input type="checkbox" data-mem="${k}"${saved[k] ? ' checked' : ''}>${esc(l)}</label>`).join('')}</div></fieldset>
            <p class="cv-warn" data-warn hidden></p>
            <p class="cv-hint">Saqlangach: student appda "Telegram guruh" tugmasi shu havola bilan ochiladi · ustoz va yordamchi ro'yxatida guruh nomi chiqadi.</p>
            <p class="cv-err" role="alert" data-err hidden></p></div>`,
            `<span class="cv-count">5 / 6 qadam</span><button type="button" class="btn-danger-sm" id="cvGroupCancel">Bekor qilish</button><button type="button" class="btn-primary-sm" id="cvGroupNext">Davom etish</button>`, { wide: true });
        pageMode(lead);
        const body = document.getElementById('modalBody');
        const link = body.querySelector('#cvGroupLink'), name = body.querySelector('#cvGroupName'), okp = body.querySelector('[data-okpill]'), sug = body.querySelector('[data-sug]');
        const warn = body.querySelector('[data-warn]'), err = body.querySelector('[data-err]');
        const check = () => {
            okp.hidden = !LINK_RE.test(link.value.trim());
            const miss = members.filter(([k]) => !body.querySelector(`[data-mem="${k}"]`).checked).map(([, l]) => l.split(' · ')[0]);
            warn.hidden = !miss.length;
            warn.textContent = miss.length ? `${miss.join(', ')} hali qo'shilmagan — guruhga qo'shishni unutmang.` : '';
        };
        link.addEventListener('input', check); body.querySelectorAll('[data-mem]').forEach(c => c.addEventListener('change', check));
        name.addEventListener('input', () => { sug.hidden = true; });
        if (!name.value && typeof apiFetch === 'function') {
            apiFetch(`/api/school/groups/next-name?lang=${lang === 'russian' ? 'russian' : 'english'}`) // lid tili bo'yicha (#127); sotuvda server o'zi aniqlaydi
                .then(r => { if (!name.value && r?.name) { name.value = r.name; sug.hidden = false; } })
                .catch(e => { if (name.value) return; sug.hidden = false; sug.classList.add('cv-sug--err'); sug.textContent = `Keyingi bo'sh raqamni olib bo'lmadi (${(window.LoadErr?.reason(e) || e.message || 'server xatosi')}) — nomni Telegram'dagidek o'zingiz yozing`; });
        }
        check();
        document.getElementById('cvGroupCancel').onclick = () => { closeModal(); if (typeof renderLeads === 'function') renderLeads(); };
        document.getElementById('cvGroupNext').onclick = () => {
            const l = link.value.trim(), n = name.value.trim().replace(/\s+/g, ' ');
            const fail = (m, el) => { err.hidden = false; err.textContent = m; el?.focus(); };
            if (!l) return fail('Telegram guruh havolasini kiriting', link);
            if (!LINK_RE.test(l)) return fail('Havola https://t.me/... ko\'rinishida bo\'lsin', link);
            if (n.length < 2) return fail('Telegram guruh nomini kiriting', name);
            const mem = Object.fromEntries(members.map(([k]) => [k, body.querySelector(`[data-mem="${k}"]`).checked]));
            const upd = updateLeadInStorage(lang, leadId, x => ({ ...x, paymentOnboarding: { ...(x.paymentOnboarding || {}), telegramGroupLink: l, telegramGroupName: n, telegramMembers: mem } }));
            if (!upd) return fail('Lid topilmadi');
            closeModal();
            next?.();
        };
    }

    // Boshqa oyna ochilsa (openModal) — sahifa ko'rinishi olib tashlanadi; konversiya qadamlari uni pageMode() bilan qayta qo'yadi.
    // (convertUI.js app.js'dan oldin yuklanadi — o'rash birinchi pageMode() chaqiruvida.)
    function wrapOpenModal() {
        if (typeof window.openModal !== 'function' || window.openModal.__cv) return;
        const orig = window.openModal;
        const wrapped = function (...a) { const ov = document.getElementById('modalOverlay'); ov?.classList.remove('cv-pagemode'); ov?.querySelector('.modal-header .cv-back')?.remove(); return orig.apply(this, a); };
        wrapped.__cv = true; window.openModal = wrapped;
    }
    window.convertUI = { steps, subline, enhanceSchedule, enhanceStep, openGroupStep };
})();
