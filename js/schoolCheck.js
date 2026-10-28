// Akademik bo'lim → "O'quvchini tekshirish" (UstozOquvchilar, YordamchiOquvchilar, Oquvchilar dizaynlari).
// E'tibor ro'yxati: ilovada nofaol, qiynalyapti, rejadan orqada. Ismni bosish → yagona o'quvchi kartasi.
//  • ustoz: o'z o'quvchilari (asosiy / yordamchi sifatida alohida);
//  • admin, boshliq, ROP: ustoz yoki yordamchini tanlaydi + taxminiy maosh KPI.
// Ustoz va yordamchiga to'lov, tarif va qarz hech qachon chizilmaydi.
(function () {
    'use strict';
    const U = () => window.schoolUI;
    const st = { sel: '', filter: 'all', q: '', more: false, ctx: 'main', staff: '' };
    const role = () => (typeof getCurrentUser === 'function' ? getCurrentUser()?.role : '') || '';
    const isLead = () => ['admin', 'boshliq', 'rop'].includes(role());
    const PASS = 65;
    const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const ICON_SEARCH = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
    const keys = s => new Set((s.flags || []).map(f => f.key));
    const FILTERS = [['all', 'Hammasi', () => true], ['idle', 'Ilovada nofaol', s => keys(s).has('idle')], ['struggling', 'Qiynalyapti', s => keys(s).has('struggling')], ['behind', 'Rejadan orqada', s => keys(s).has('behind')]];
    const attention = s => ['idle', 'struggling', 'behind'].some(k => keys(s).has(k));
    const reasons = s => [keys(s).has('idle') && 'faol emas', keys(s).has('struggling') && 'qiynalyapti', keys(s).has('behind') && 'orqada'].filter(Boolean);
    const idleTxt = s => (s.daysIdle == null ? 'ilovaga kirmagan' : `${s.daysIdle} kun faol emas`);
    const actTxt = s => (s.daysIdle == null ? 'ilovaga kirmagan' : s.daysIdle <= 0 ? 'bugun faol' : s.daysIdle === 1 ? 'kecha' : `${s.daysIdle} kun oldin`);

    let _seq = 0;
    async function render(root, { lang = 'english' } = {}) {
        const u = U(); if (!u || !root) return;
        const { esc, api, today, studentAvatar, staffAvatar, teacherName, pattern } = u;
        const seq = ++_seq;
        await u.loadStaffAvatars();
        const me = getCurrentUser() || {};
        const lead = isLead();
        if (!root.dataset.loaded) root.innerHTML = '<div class="sc-skel"></div>';
        let ov;
        try { ov = await apiFetch(`/api/academic/students?lang=${lang}`); }
        catch (e) { root.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        if (seq !== _seq) return;
        root.dataset.loaded = '1';
        const local = new Map((getItem(STORAGE_KEYS.students, []) || []).map(s => [s.id, s]));
        // Ilova xulosasida ustoz/jadval yo'q — CRM keshidan qo'shiladi.
        const all = (ov.students || []).map(s => { const l = local.get(s.id) || {}; return { ...s, teacherId: l.teacherId || '', assistantTeacherId: l.assistantTeacherId || '', lessonDayOfWeek: l.lessonDayOfWeek, lessonTime: l.lessonTime || '', lessonDuration: l.lessonDuration || null }; });
        const month = today().slice(0, 7);

        // Kimning o'quvchilari: ustoz — o'zi; rahbar — tanlangan ustoz yoki yordamchi.
        let staffList = [], list, ctx;
        if (lead) {
            const mains = u.teachersForSubject(lang), asst = (getItem(STORAGE_KEYS.hrEmployees, []) || []).filter(e => e.role === 'yordamchi' && (e.status || 'active') !== 'inactive' && (e.lang === 'both' || (e.lang === 'russian' ? 'russian' : 'english') === lang));
            staffList = [...mains.map(e => ({ ...e, kind: 'main' })), ...asst.map(e => ({ ...e, kind: 'assistant' }))];
            if (!staffList.some(e => e.id === st.staff)) st.staff = staffList.find(e => all.some(s => s.teacherId === e.id || s.assistantTeacherId === e.id))?.id || staffList[0]?.id || '';
            const who = staffList.find(e => e.id === st.staff);
            ctx = who?.kind === 'assistant' ? 'assistant' : 'main';
            list = who ? all.filter(s => (ctx === 'assistant' ? s.assistantTeacherId : s.teacherId) === who.id) : all;
        } else {
            const mains = all.filter(s => s.role === 'main'), helped = all.filter(s => s.role === 'assistant');
            if (st.ctx === 'assistant' && !helped.length) st.ctx = 'main';
            if (st.ctx === 'main' && !mains.length && helped.length) st.ctx = 'assistant';
            ctx = st.ctx; list = ctx === 'assistant' ? helped : mains;
            st.counts = { main: mains.length, assistant: helped.length };
        }
        // Yordamchi aloqalari (oyiga 13 tagacha) — yordamchi konteksti uchun.
        const assistantId = lead ? (ctx === 'assistant' ? st.staff : '') : (ctx === 'assistant' ? me.linkedTeacherId : '');
        let rep = null;
        if (ctx === 'assistant') rep = await api(`/assist/month?month=${month}${lead ? '&assistantId=' + encodeURIComponent(assistantId) : ''}`).catch(() => null);
        if (seq !== _seq) return;
        const repBy = new Map((rep?.students || []).map(x => [x.studentId, x]));

        const firsts = list.map(s => s.firstTryAvg).filter(v => v != null);
        const avg = firsts.length ? Math.round(firsts.reduce((a, b) => a + b, 0) / firsts.length) : null;
        const att = list.filter(attention);
        const groups = new Map();
        for (const s of att) { const k = reasons(s).join(', '); groups.set(k, [...(groups.get(k) || []), String(s.name || '').split(' ')[0]]); }
        const attTxt = [...groups.entries()].map(([k, names]) => `${names.join(', ')} (${k})`).join(' · ');

        // Saralash: e'tibor kerak bo'lganlar oldin, keyin 1-urinish bo'yicha.
        const sorted = list.slice().sort((a, b) => reasons(b).length - reasons(a).length || (a.firstTryAvg ?? 101) - (b.firstTryAvg ?? 101) || String(a.name).localeCompare(String(b.name)));
        const f = FILTERS.find(x => x[0] === st.filter) || FILTERS[0];
        const q = st.q.trim().toLowerCase();
        const shown = sorted.filter(f[2]).filter(s => !q || String(s.name || '').toLowerCase().includes(q) || String(local.get(s.id)?.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '') || '§'));
        if (!shown.some(s => s.id === st.sel)) st.sel = shown[0]?.id || '';
        const LIMIT = 10, visible = st.more ? shown : shown.slice(0, LIMIT);

        // KPI
        let kpis;
        if (lead) {
            const who = staffList.find(e => e.id === st.staff);
            let pay = '';
            if (who && ctx === 'assistant' && rep) {
                pay = `<div class="okx-k"><small>Mashg'ulotlar · shu oy</small><b>${rep.counted} <em>/ ${list.length * (rep.cap || 13)}</em></b></div>
                  <div class="okx-k okx-pay"><small>Taxminiy maosh</small><b>${esc(u.num(rep.amount))} <em>so'm</em></b><span>${esc(u.num(rep.rate || 3077))} so'm × ${rep.counted} aloqa · ${list.length} o'quvchi</span></div>`;
            } else if (who && typeof calculateKpiSalary === 'function') {
                try {
                    const t = (typeof resolveTeacherWithVirtual === 'function' && resolveTeacherWithVirtual(who.id)) || null;
                    const kpi = t ? calculateKpiSalary(t, month, getItem(STORAGE_KEYS.mainAttendance, {})) : null;
                    if (kpi) pay = `<div class="okx-k"><small>Darslar · shu oy</small><b>${kpi.completed} <em>/ ${kpi.expected * (kpi.studentCount || 1)}</em></b></div>
                      <div class="okx-k okx-pay"><small>Taxminiy maosh</small><b>${esc(u.num(kpi.total))} <em>so'm</em></b><span>davomat asosida · ${kpi.studentCount || list.length} o'quvchi</span></div>`;
                } catch (e) { console.warn('[tekshirish] maosh hisoblanmadi', e.message); }
            }
            kpis = `<section class="sc-card okx-top"><label class="okx-pick">${who ? staffAvatar(who, 34) : ''}<span class="okx-pick-t"><b>${esc(who?.name || 'Ustoz yo\'q')}</b><small>${who ? (ctx === 'assistant' ? 'Yordamchi ustoz' : 'Asosiy ustoz') + ' · ustozni almashtirish' : ''}</small></span>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                <select data-staff aria-label="Ustozni tanlash">${[['main', 'Asosiy ustozlar'], ['assistant', 'Yordamchi ustozlar']].map(([k, l]) => `<optgroup label="${l}">${staffList.filter(e => e.kind === k).map(e => `<option value="${esc(e.id)}"${e.id === st.staff ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
              <div class="okx-ks"><div class="okx-k"><small>O'quvchilar</small><b>${list.length}</b></div>${pay || `<div class="okx-k"><small>E'tibor kerak</small><b class="okx-warn">${att.length}</b></div><div class="okx-k"><small>Uy vazifasi · 1-urinish</small><b>${avg != null ? avg + '%' : '—'}</b></div>`}</div></section>`;
        } else {
            const seg = st.counts.main && st.counts.assistant ? `<div class="sc-seg okx-seg" role="group" aria-label="O'quvchilar"><button type="button" data-ctx="main" aria-pressed="${ctx === 'main'}">Asosiy · ${st.counts.main}</button><button type="button" data-ctx="assistant" aria-pressed="${ctx === 'assistant'}">Yordamchi sifatida · ${st.counts.assistant}</button></div>` : '';
            kpis = `${seg}<div class="okx-kpis"><section class="sc-card okx-kpi"><small>O'quvchilar</small><b>${list.length}</b><span>${ctx === 'assistant' ? 'yordamchi sifatida · natijalar ilovadan' : 'asosiy ustozligingizda'}</span></section>
              <section class="sc-card okx-kpi"><small>E'tibor kerak</small><b class="okx-warn">${att.length}</b><span>${esc(attTxt) || 'hammasi rejada'}</span></section>
              <section class="sc-card okx-kpi"><small>Uy vazifasi · 1-urinish</small><b>${avg != null ? avg + '%' : '—'}</b><span>${ctx === 'assistant' ? 'siz yordam beradigan o\'quvchilar o\'rtachasi' : 'o\'quvchilaringiz o\'rtachasi'}</span></section></div>`;
        }

        const item = s => {
            const meta = keys(s).has('idle') ? (lead ? `<span class="okx-bad">${esc(idleTxt(s))} · ${s.reached || 0}-dars</span>` : `${s.reached || 0}-dars · ${esc(idleTxt(s))}`)
                : `${s.reached || 0}-dars${keys(s).has('struggling') ? ' · qiynalyapti' : keys(s).has('behind') ? ' · rejadan orqada' : lead ? ' · ' + esc(actTxt(s)) : ''}`;
            const v = s.firstTryAvg;
            return `<button type="button" class="okx-it${s.id === st.sel ? ' on' : ''}" data-sel="${esc(s.id)}"${s.id === st.sel ? ' aria-current="true"' : ''}>${studentAvatar(local.get(s.id) || s, 36)}
              <span class="okx-it-t"><b>${esc(s.name)}</b><small>${meta}</small></span>
              <span class="okx-lp"><small>1-urinish</small><b class="${v != null && v < 55 ? 'okx-lo' : ''}">${v != null ? v + '%' : '—'}</b>${lead ? '' : `<i class="okx-trk"><i class="${v != null && v < PASS ? 'lo' : ''}" style="width:${Math.min(100, v || 0)}%"></i></i>`}</span></button>`;
        };
        root.innerHTML = `${kpis}
          <div class="okx-lay"><section class="sc-card okx-list" aria-label="O'quvchilar ro'yxati">
            <div class="okx-ls"><label class="okx-inp">${ICON_SEARCH}<input type="search" placeholder="${lead ? 'O\'quvchi ismi yoki telefoni' : 'O\'quvchi ismi'}" value="${esc(st.q)}" data-q aria-label="O'quvchi qidirish"></label>
              <div class="okx-chips" role="group" aria-label="Filtr">${FILTERS.map(([k, l, fn]) => `<button type="button" class="okx-chip" data-f="${k}" aria-pressed="${st.filter === k}">${l} <b>${sorted.filter(fn).length}</b></button>`).join('')}</div></div>
            <div class="okx-items">${visible.map(item).join('') || `<p class="sc-mt okx-empty">${q || st.filter !== 'all' ? 'Hech kim topilmadi' : ctx === 'assistant' ? 'Yordamchi sifatida o\'quvchi yo\'q' : 'O\'quvchi biriktirilmagan'}</p>`}
              ${shown.length > visible.length ? `<button type="button" class="sc-btn okx-more" data-more>Yana ${shown.length - visible.length} ta o'quvchini ko'rsatish</button>` : ''}</div></section>
          <section class="sc-card okx-det" data-det aria-live="polite"></section></div>
          <p class="sc-mt">1-urinish — ilovadagi mashqlarni birinchi urinishda to'g'ri bajarish ulushi (baho emas). Ma'lumot o'quvchi ilovasidan · faqat ko'rish.</p>`;

        const rerender = () => render(root, { lang });
        root.querySelector('[data-staff]')?.addEventListener('change', e => { st.staff = e.target.value; st.sel = ''; st.more = false; rerender(); });
        root.querySelectorAll('[data-ctx]').forEach(b => b.onclick = () => { st.ctx = b.dataset.ctx; st.sel = ''; st.filter = 'all'; rerender(); });
        root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { st.filter = b.dataset.f; st.more = false; rerender(); });
        root.querySelector('[data-more]')?.addEventListener('click', () => { st.more = true; rerender(); });
        const qi = root.querySelector('[data-q]');
        qi.oninput = () => { st.q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => rerender().then(() => { const n = root.querySelector('[data-q]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }), 220); };
        root.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => {
            st.sel = b.dataset.sel;
            root.querySelectorAll('[data-sel]').forEach(x => { const on = x === b; x.classList.toggle('on', on); on ? x.setAttribute('aria-current', 'true') : x.removeAttribute('aria-current'); });
            detail(root.querySelector('[data-det]'), list.find(s => s.id === st.sel), { ctx, lead, local, repBy, rep, avg, lang });
        });
        detail(root.querySelector('[data-det]'), list.find(s => s.id === st.sel), { ctx, lead, local, repBy, rep, avg, lang });
    }

    let _dseq = 0;
    async function detail(el, s, o) {
        const u = U(); if (!el) return;
        const { esc, api, today, studentAvatar, pattern, acad } = u;
        const seq = ++_dseq;
        if (!s) { el.innerHTML = '<p class="sc-mt okx-empty">O\'quvchini tanlang</p>'; return; }
        const ls = o.local.get(s.id) || {};
        const month = today().slice(0, 7), mName = MONTHS[Number(month.slice(5)) - 1];
        const head = `<div class="okx-dh">${studentAvatar(ls.id ? ls : s, 48)}<div class="sc-grow"><h2><button type="button" class="okx-name" data-card>${esc(s.name)}</button></h2>
            <div class="sc-mt">${[(o.lead || o.ctx === 'main') && ls.phone && esc(typeof formatPhoneDisplay === 'function' ? formatPhoneDisplay(ls.phone) : ls.phone), s.lessonTime && `${esc(pattern(s.lessonDayOfWeek))} ${esc(s.lessonTime)}`, s.lessonDuration && `${s.lessonDuration} daq`].filter(Boolean).join(' · ')}</div></div>
            <div class="sc-row sc-wrap">${o.ctx === 'assistant' ? '<span class="sc-pill sc-pill--info">Yordamchi sifatida</span>' : ''}${!o.lead && o.ctx === 'main' ? '<button type="button" class="sc-btn" data-cal>Davomat kalendari</button>' : ''}<button type="button" class="sc-btn${o.lead ? '' : ' sc-btn--pri'}" data-card>Kartani ochish</button></div></div>`;
        el.innerHTML = `${head}<div class="okx-body"><div class="sc-skel"></div></div>`;
        const bind = () => {
            el.querySelectorAll('[data-card]').forEach(b => b.onclick = () => u.openStudent(s.id, 'oz'));
            el.querySelector('[data-cal]')?.addEventListener('click', () => {
                // Tanlangan o'quvchining kalendari ochilsin (birinchi o'quvchiniki emas).
                window.teacherDutyUI?.focus?.(s.id);
                if (typeof switchTeachersSection === 'function') switchTeachersSection('attendance');
                window.teacherDutyUI?.render?.();
                setTimeout(() => window.teacherDutyUI?.revealFocused?.(), 60);
            });
        };
        bind();
        let r, a = null;
        try {
            [r, a] = await Promise.all([api(`/students/${encodeURIComponent(s.id)}/progress`), o.ctx === 'main' ? api(`/students/${encodeURIComponent(s.id)}/attendance?month=${month}`).catch(() => null) : null]);
        } catch (e) { if (seq === _dseq) el.querySelector('.okx-body').innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        if (seq !== _dseq) return;
        const d = r.detail;
        const body = el.querySelector('.okx-body');
        if (!d) { body.innerHTML = '<p class="sc-mt">Ilova ma\'lumoti hali yo\'q — o\'quvchi ilovaga kirgach shu yerda chiqadi</p>'; return; }
        const k = keys(d.student);
        const pills = (d.student.flags || []).filter(f => f.key !== 'frozen').map(f => `<span class="sc-pill ${f.key === 'behind' ? 'sc-pill--bad' : 'sc-pill--warn'}">${esc(f.label)}</span>`).join('');
        const f1 = acad.recentFirst(d);
        let fourth;
        if (o.ctx === 'assistant') { const x = o.repBy.get(s.id); fourth = `<div class="okx-fa"><small>Yordamchi aloqa · oyiga ${o.rep?.cap || 13} tagacha</small><b>${x?.counted || 0} / ${o.rep?.cap || 13}</b></div>`; }
        else if (a) {
            const passed = a.lessonDays.filter(x => x <= today()).length, present = Object.values(a.entries).filter(e => e.present).length;
            fourth = `<div class="okx-fa"><small>Davomat · ${esc(mName)}</small><b class="${passed && present / passed < 0.6 ? 'okx-bad' : ''}">${present} <em>/ ${passed} o'tgan</em></b></div>`;
        } else fourth = `<div class="okx-fa"><small>Imtihon</small><b>${esc(acad.examFact(d).v)}</b></div>`;
        const tp = acad.topic(d);
        const advice = !o.lead && o.ctx === 'assistant' && k.has('struggling') && tp ? `<div class="scc-flag"><span><b>Keyingi aloqada nima qilish kerak.</b> Ko'p xato: <b>${esc(tp.name)}</b>${tp.part ? ` (${esc(tp.part)})` : ''}. Shu mavzudagi gaplarni og'zaki mashq qiling.</span></div>` : '';
        body.innerHTML = `${pills ? `<div class="sc-row sc-wrap">${pills}</div>` : ''}${advice}
          <div class="okx-facts"><div class="okx-fa"><small>Erishgan dars</small><b>${d.student.reached || 0} <em>/ 72</em></b></div>
            <div class="okx-fa"><small>Uy vazifasi · 1-urinish</small><b class="scc-pc ${acad.cls(f1)}">${acad.pct(f1)}</b></div>
            <div class="okx-fa"><small>Faol vaqt · 7 kun</small><b>${esc(acad.dur(d.student.time?.week))}${d.student.activeDays7 != null ? ` <em>· ${d.student.activeDays7} kun</em>` : ''}</b></div>${fourth}</div>
          <h3>Darslar bo'yicha</h3><div class="okx-tbl">${acad.lessonsTable(d, { compact: true })}</div>
          <h3>Oxirgi xatolar</h3>${acad.mistakesList(d, { compact: true, n: 2 })}
          <h3>Imtihonlar</h3>${acad.examsList(d, { compact: true })}`;
    }

    window.schoolCheck = { render, state: st };
})();
