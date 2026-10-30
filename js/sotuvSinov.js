// Sotuv menejerining sinov oqimi — dizaynlar: SotuvSinov (liddan boshlanadigan "Sinov darsi qo'yish"
// sahifasi: lid istagiga yaqin bo'sh vaqtlar, ustoz tanlash, 10 daqiqa ushlab turish), SotuvHolatlar
// (band, ushlab turish tugadi, ustoz rad etdi + taklif, istagan vaqtda hech kim bo'sh emas, ko'p kunlik
// sinovda bir kun band) va SotuvJadval (sotuv "Dars jadvali": KPI, ustozlar bo'yicha kun, yon panellar).
// Ma'lumot faqat /api/school'dan: sotuvga server redakt qilgan jadval keladi (o'quvchi ismlari, holatlar,
// admin ochgan vaqtlar yo'q). Holat nomlari bitta manbadan: js/trialWorkflow.js (PHASES).
(function () {
    'use strict';
    const U = () => window.schoolUI;
    const W = () => window.trialWorkflow;
    const MON = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const TZ = 5 * 3600000;
    const STEP = 30;
    const role = () => (typeof getCurrentUser === 'function' ? getCurrentUser()?.role : '') || '';
    const me = () => (typeof getCurrentUser === 'function' ? getCurrentUser() : null) || {};
    const esc = s => U().esc(s);
    const hm = m => U().hm(m);
    const first = n => String(n || '').trim().split(/\s+/)[0] || '';
    const short = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : (p[0] || ''); };
    const dm = d => `${Number(d.slice(8))}-${MON[Number(d.slice(5, 7)) - 1]}`;
    const dayShort = d => `${U().DAY[U().wd(d) - 1]} ${Number(d.slice(8))}`;
    const rel = d => { const t = U().today(); return d === t ? 'Bugun' : d === U().addDays(t, 1) ? 'Ertaga' : ''; };
    const hrs = m => `${Math.round(m / 30) / 2} soat`;
    const hrsS = m => `${Math.round(m / 30) / 2} s`;
    const local = iso => { const ms = Date.parse(iso || ''); if (!Number.isFinite(ms)) return null; const d = new Date(ms + TZ); return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; };
    const isoOf = (date, min) => new Date(Date.parse(date + 'T00:00:00Z') + min * 60000 - TZ).toISOString();
    const toast = (m, ms) => U().toast(m, ms);
    const enabled = () => !!window.schoolUI && !!window.trialWorkflow && ['sales_manager', 'rop', 'admin', 'boshliq'].includes(role());

    // ── Oraliqlar ────────────────────────────────────────────────────────────
    const merge = list => { const s = [...list].filter(x => x.end > x.start).sort((a, b) => a.start - b.start); const out = []; for (const x of s) { const l = out[out.length - 1]; if (l && x.start <= l.end) l.end = Math.max(l.end, x.end); else out.push({ start: x.start, end: x.end }); } return out; };
    const subtract = (base, cut) => { let out = merge(base); for (const c of cut) out = out.flatMap(f => (c.end <= f.start || c.start >= f.end) ? [f] : [f.start < c.start ? { start: f.start, end: c.start } : null, c.end < f.end ? { start: c.end, end: f.end } : null].filter(Boolean)); return out; };
    const sum = list => list.reduce((n, x) => n + Math.max(0, x.end - x.start), 0);
    const overlaps = (a, b) => a.start < b.end && b.start < a.end;
    const inside = (list, s, e) => (list || []).some(f => f.start <= s && e <= f.end);
    // Sinov kunlari serverdagidek (leadTrialSlots): birinchi kun + shu dars qolipidagi keyingi kunlar.
    const patternDays = d => ([1, 3, 5].includes(d) ? [1, 3, 5] : [2, 4, 6].includes(d) ? [2, 4, 6] : [d]);
    function trialDates(date, n) {
        const days = patternDays(U().wd(date)); const out = []; let d = date, guard = 0;
        while (out.length < n && guard++ < 21) { if (!out.length || days.includes(U().wd(d))) out.push(d); d = U().addDays(d, 1); }
        return out;
    }
    // Bugungi kunda o'tib ketgan vaqt sinovga hisoblanmaydi.
    const futureFree = (v, list) => (v.date === U().today() ? subtract(list || [], [{ start: 0, end: U().nowMin() + 1 }]) : v.date < U().today() ? [] : (list || []));

    // ── Lidlar (CRM keshidan) ───────────────────────────────────────────────
    function allLeads() {
        const all = typeof getItem === 'function' && typeof STORAGE_KEYS !== 'undefined' ? getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) : { english: [], russian: [] };
        return [...(all.english || []).map(l => ({ ...l, _lang: 'english' })), ...(all.russian || []).map(l => ({ ...l, _lang: 'russian' }))];
    }
    const myManagerId = () => String(me().linkedManagerId || '');
    function myLeads() {
        const mid = myManagerId();
        return allLeads().filter(l => role() !== 'sales_manager' || !mid || String(l.managerId || '') === mid);
    }
    function findLead(lang, id) {
        if (typeof getLeadById === 'function') { const l = getLeadById(lang, id); if (l) return { ...l, _lang: lang }; }
        return allLeads().find(l => l.id === id) || null;
    }
    const OPEN = new Set(['yangi-lidlar', 'boglanishga-urinilmoqda', 'boglanildi', 'sinov-darsida', 'qaror-jarayonida', 'keyin-sotib-olmoqchi', 'yangi']);
    const leadPhase = l => W().leadPhase(l);

    // ════════════════════════════════════════════════════════════════════════
    // Sinov darsi qo'yish (SotuvSinov + SotuvHolatlar)
    // ════════════════════════════════════════════════════════════════════════
    let P = null;
    function pageEl() {
        let el = document.getElementById('ssPage');
        if (!el) {
            el = document.createElement('div');
            el.id = 'ssPage'; el.className = 'sc-root ss-page';
            el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Sinov darsi qo\'yish');
            (document.querySelector('.content-main') || document.body).appendChild(el);
        }
        document.body.classList.add('ss-page-open');
        return el;
    }
    // opts: { lang, leadId, isReschedule, prevOutcome, from: 'leads'|'schedule', preset: { teacherId, date, min }, onClose }
    function open(opts = {}) {
        if (!enabled()) return false;
        close({ silent: true });
        if (typeof closeModal === 'function') { try { closeModal(); } catch { /* yopiq */ } }
        U().loadStaffAvatars();
        const lead = opts.leadId ? findLead(opts.lang || 'english', opts.leadId) : null;
        const lang = lead?._lang || opts.lang || (typeof getUserOwnLang === 'function' && getUserOwnLang()) || 'english';
        const req = lead ? W().request(lead) : null;
        const prevAt = local(req?.scheduledAt || lead?.trialLessonAt);
        const dur0 = lead ? W().durationOf(lead) : 30;
        const today = U().today();
        P = { lang, lead, from: opts.from || 'leads', isReschedule: !!opts.isReschedule, prevOutcome: opts.prevOutcome || null, onClose: opts.onClose || null,
            date: opts.preset?.date || (prevAt && prevAt.date >= today ? prevAt.date : today), dur: [15, 30, 60].includes(dur0) ? dur0 : 30,
            days: Math.max(1, Math.min(3, Number(lead?.paymentOnboarding?.trialDaysCount) || 1)), mode: opts.preset?.teacherId ? 'teacher' : 'any',
            teacherId: opts.preset?.teacherId || '', wish: opts.preset ? opts.preset.min : (prevAt && prevAt.date >= today ? prevAt.min : null), note: '',
            sel: null, hold: null, alert: null, rejDismissed: false, rejPick: 0, data: null, err: '', loadedAt: 0, busy: false, pending: opts.preset || null, timers: [] };
        applyLeadWish(P);
        const el = pageEl();
        el.innerHTML = '<div class="sc-skel"></div>';
        el.scrollTop = 0;
        P.timers.push(setInterval(tick, 1000));
        P.timers.push(setInterval(() => { const a = document.activeElement; if (P && !P.busy && !(a?.closest?.('#ssPage') && /INPUT|SELECT|TEXTAREA/.test(a.tagName))) load(true); }, 30000));
        load().then(() => { if (P?.pending && P.lead) { const p = P.pending; P.pending = null; const m = firstFreeIn(p.teacherId, p.date, p.min); if (m != null) hold(p.teacherId, p.date, m); } });
        return true;
    }
    function close({ silent = false, saved = false } = {}) {
        if (!P) { document.body.classList.remove('ss-page-open'); return; }
        const p = P; P = null;
        p.timers.forEach(clearInterval);
        if (p.hold) U().post(`/bookings/${encodeURIComponent(p.hold.ids[0])}/cancel`).catch(() => {});
        document.getElementById('ssPage')?.remove();
        document.body.classList.remove('ss-page-open');
        if (silent) return;
        if (p.onClose) p.onClose(saved);
        else if (p.from === 'leads' && typeof renderLeads === 'function') renderLeads();
    }
    async function load(quiet = false) {
        if (!P) return;
        const p = P;
        const from = U().today(), to = U().addDays(from, 13);
        if (!quiet) { p.data = null; draw(); }
        try {
            const d = await U().api(`/schedule?from=${from}&to=${to}&lang=${p.lang}&mode=free`);
            if (P !== p) return;
            p.data = { teachers: (d.teachers || []).filter(t => ['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi'].includes(t.role) || !t.role), views: d.views || [], unassigned: d.unassigned || [], from, to };
            p.byKey = new Map(p.data.views.map(v => [v.teacherId + '|' + v.date, v]));
            p.err = null; p.failed = false; p.loadedAt = Date.now();
        } catch (e) {
            if (P !== p) return;
            // Xato: soxta "0 soat" ko'rsatilmaydi. Avval yuklangan bo'lsa — eski jadval qoladi va ogohlantirish chiqadi;
            // umuman yuklanmagan bo'lsa — LoadErr kartasi + "Qayta urinish", sana chiplari "—".
            p.err = e; if (!p.data) { p.failed = true; p.data = { teachers: [], views: [], unassigned: [] }; } p.byKey ||= new Map();
        }
        if (!p.err) p.failed = false;
        draw();
    }
    const view = (t, d) => P.byKey?.get(t + '|' + d) || null;
    const tname = id => P.data?.teachers.find(t => t.id === id)?.name || U().teacherName(id);
    function visibleTeachers(date = P.date) {
        const ids = [...new Set(P.data.views.filter(v => v.date === date && v.work.length).map(v => v.teacherId))];
        const list = ids.filter(id => P.data.teachers.some(t => t.id === id));
        const out = P.mode === 'teacher' && P.teacherId ? list.filter(id => id === P.teacherId) : list;
        return out.sort((a, b) => tname(a).localeCompare(tname(b)));
    }
    // Ushbu ustoz shu boshlanish vaqtida barcha sinov kunlarida sinovga ochiqmi.
    function dayFits(t, d, m, dur = P.dur) {
        const v = view(t, d); if (!v) return false;
        if (d === U().today() && m <= U().nowMin()) return false;
        return inside(v.trialFree, m, m + dur);
    }
    function fitsAll(t, date, m, dates = trialDates(date, P.days)) { return dates.every(d => dayFits(t, d, m)); }
    function firstFreeIn(t, date, from) {
        const v = view(t, date); if (!v) return null;
        for (let m = Math.ceil(from / STEP) * STEP; m < 24 * 60; m += STEP) if (fitsAll(t, date, m)) return m;
        return null;
    }
    function candidates(date = P.date, around = P.wish) {
        const out = [];
        const dates = trialDates(date, P.days);
        for (const t of visibleTeachers(date)) {
            const v = view(t, date);
            for (const f of futureFree(v, v.trialFree)) for (let m = Math.ceil(f.start / STEP) * STEP; m + P.dur <= f.end; m += STEP) if (fitsAll(t, date, m, dates)) out.push({ t, date, m });
        }
        const key = c => (around == null ? c.m : Math.abs(c.m - around) * 10 + (c.m < around ? 1 : 0));
        return out.sort((a, b) => key(a) - key(b) || openMin(b.t, date) - openMin(a.t, date));
    }
    const openMin = (t, date) => { const v = view(t, date); return v ? sum(futureFree(v, v.trialFree)) : 0; };
    const diffTxt = d => { if (d === 0) return 'aynan istagan vaqt'; const a = Math.abs(d), h = Math.floor(a / 60), m = a % 60; return `${d > 0 ? '+' : '−'}${h ? `${h} soat` : ''}${h && m ? ' ' : ''}${m ? `${m} daqiqa` : ''}`; };
    const whenTxt = (date, m) => `${rel(date) ? rel(date) + ' · ' : ''}${dayShort(date)} · ${hm(m)}`;
    const candLabel = c => `${short(tname(c.t))} · ${U().DAY[U().wd(c.date) - 1]} ${hm(c.m)}`;

    // ── Ushlab turish / band qilish ─────────────────────────────────────────
    async function release() {
        if (!P?.hold) return;
        const h = P.hold; P.hold = null; P.sel = null;
        try { await U().post(`/bookings/${encodeURIComponent(h.ids[0])}/cancel`); } catch { /* muddati tugagan bo'lishi mumkin */ }
    }
    async function hold(t, date, m) {
        if (!P || P.busy) return false;
        if (!P.lead) { P.pending = { teacherId: t, date, min: m }; P.alert = { type: 'error', msg: 'Avval lidni tanlang — vaqt lid uchun ushlab turiladi.' }; draw(); return false; }
        const p = P;
        p.busy = true; p.alert = null; draw();
        await release();
        const dates = trialDates(date, p.days);
        try {
            const r = await U().post('/bookings', { kind: 'trial', teacherId: t, dates, time: hm(m), duration: p.dur, leadId: p.lead.id });
            if (P !== p) { U().post(`/bookings/${encodeURIComponent(r.bookings[0].id)}/cancel`).catch(() => {}); return false; }
            const b = r.bookings || [];
            p.hold = { group: b[0].group_id, ids: b.map(x => x.id), until: Date.parse(b[0].hold_until) || Date.now() + 600000, t, date, m, dates, dur: p.dur };
            p.sel = { t, date, m };
            p.busy = false; draw();
            return true;
        } catch (e) {
            if (P !== p) return false;
            p.busy = false;
            p.alert = e.status === 409 ? { type: 'taken', t, date, m, msg: e.message } : { type: 'error', msg: e.message };
            await load(true);
            return false;
        }
    }
    function tick() {
        if (!P) return;
        if (P.hold && Date.now() >= P.hold.until) {
            const h = P.hold; P.hold = null; P.sel = null;
            P.alert = { type: 'expired', t: h.t, date: h.date, m: h.m };
            load(true);
            return;
        }
        const t = document.querySelector('#ssPage [data-left]');
        if (t && P.hold) { const s = Math.max(0, Math.round((P.hold.until - Date.now()) / 1000)); t.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
        const u = document.querySelector('#ssPage [data-upd]');
        if (u && P.loadedAt) { const s = Math.round((Date.now() - P.loadedAt) / 1000); u.textContent = s < 60 ? `yangilandi ${s} soniya oldin` : `yangilandi ${Math.round(s / 60)} daqiqa oldin`; }
    }
    function rejected() {
        if (!P?.lead || P.rejDismissed) return null;
        const r = W().request(P.lead);
        return r && r.state === 'rejected' && P.lead.status === 'sinov-darsida' ? r : null;
    }
    function prevOutcomeLabel() {
        if (P.prevOutcome?.label) return P.prevOutcome.label;
        const r = P.lead ? W().request(P.lead) : null;
        if (r?.state === 'rejected') return `Ustoz rad etdi: ${r.reasonLabel || '—'}`;
        return '';
    }
    function wishText() {
        if (P.wish == null && !P.note.trim()) return '';
        return [P.wish != null ? `${dayShort(P.date)}, ${hm(P.wish)} atrofida` : '', P.note.trim()].filter(Boolean).join(' · ');
    }
    async function confirmHold() {
        if (!P?.hold || P.busy) return;
        const p = P, h = p.hold;
        p.busy = true; draw();
        try {
            await U().post(`/bookings/group/${encodeURIComponent(h.group)}/attach-lead`, { leadId: p.lead.id,
                reschedule: p.isReschedule || p.lead.status === 'sinov-darsida', prevOutcome: prevOutcomeLabel(), wish: wishText() });
            p.hold = null;
            await U().refreshCache();
            toast(`Sinov belgilandi · ${first(tname(h.t))} tasdiqlagach lidga xabar boradi`, 3500);
            close({ saved: true });
        } catch (e) {
            if (P !== p) return;
            p.busy = false;
            if (/muddati tugagan/i.test(e.message)) { p.hold = null; p.sel = null; p.alert = { type: 'expired', t: h.t, date: h.date, m: h.m }; await load(true); }
            else if (e.status === 409 && /band|ushlab/i.test(e.message)) { await release(); p.alert = { type: 'taken', t: h.t, date: h.date, m: h.m, msg: e.message }; await load(true); }
            else { p.alert = { type: 'error', msg: e.message }; draw(); }
        }
    }
    // Lid istagan vaqtda hech kim bo'sh emas → "Ustoz biriktirilmagan" (admin/ROP "Ustoz biriktirish" qiladi).
    async function sendUnassigned() {
        if (!P?.lead || P.wish == null || P.busy) return;
        if (typeof updateLeadInStorage !== 'function') { toast('Saqlab bo\'lmadi'); return; }
        const p = P;
        if (!confirm(`${p.lead.name}: ${whenTxt(p.date, p.wish)} — ustozsiz adminga yuborilsinmi?\nAdmin yoki ROP shu vaqtga ustoz biriktiradi.`)) return;
        await release();
        const at = isoOf(p.date, p.wish);
        const rev = globalThis.crypto?.randomUUID?.() || 'trial-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        const author = me().name || 'Sotuv';
        const prev = prevOutcomeLabel();
        const text = ['Sinov darsi adminga yuborildi — "Ustoz biriktirilmagan":', ...(prev ? [`• Avvalgi natija: ${prev}`] : []),
            `• Lid istagi: ${p.date.split('-').reverse().join('.')}, ${U().DAY_FULL[U().wd(p.date) - 1]}, ${hm(p.wish)}`,
            `• Davomiyligi: ${p.days} kun · ${p.dur} daq`, ...(p.note.trim() ? [`• Izoh: ${p.note.trim()}`] : []), '• Shu vaqtda sinovga ochiq ustoz yo\'q — admin/ROP ustoz biriktiradi'].join('\n');
        const saved = updateLeadInStorage(p.lead._lang || p.lang, p.lead.id, l => ({ ...l, status: 'sinov-darsida', trialUnassigned: true, trialLessonAt: at, trialScheduleRevision: rev,
            paymentOnboarding: { ...(l.paymentOnboarding || {}), teacherId: '', lessonDayOfWeek: U().wd(p.date), lessonTime: hm(p.wish), lessonDuration: p.dur, trialDaysCount: p.days, isTrial: true },
            ...(l.trialLesson ? { trialLesson: null } : {}),
            comments: [...(Array.isArray(l.comments) ? l.comments : []), typeof createLeadComment === 'function'
                ? createLeadComment({ type: 'trial-lesson', text, author, reason: prev })
                : { id: 'c' + Date.now(), type: 'trial-lesson', text, author, createdAt: new Date().toISOString() }] }));
        if (!saved) { toast('Saqlab bo\'lmadi'); return; }
        toast('Adminga yuborildi · "Ustoz biriktirilmagan"', 3500);
        close({ saved: true });
    }
    async function acceptProposal() {
        const r = rejected(); if (!r) return;
        const iso = (r.proposals || [])[P.rejPick]; const a = local(iso); if (!a) return;
        P.date = a.date;
        if (await hold(String(r.teacherId), a.date, a.min)) await confirmHold();
    }

    // Lid kartasidagi istak (oxirgi "• Lid istagi: …" izohi) — o'qish rejimida ko'rsatiladi, vaqti tanlovga olinadi.
    function applyLeadWish(p) {
        p.wishText = '';
        const cs = Array.isArray(p.lead?.comments) ? p.lead.comments : [];
        for (let i = cs.length - 1; i >= 0; i--) {
            const m = /Lid istagi:\s*([^\n]+)/.exec(String(cs[i]?.text || ''));
            if (m) { p.wishText = m[1].trim(); break; }
        }
        if (p.wishText && p.wish == null) {
            const t = /(\d{1,2}):(\d{2})/.exec(p.wishText);
            if (t) p.wish = Math.round((Number(t[1]) * 60 + Number(t[2])) / STEP) * STEP;
        }
    }

    // ── Band qilishdagi holatlar (SotuvHolatlar) — 5 holat, HAQIQIY jadvaldan (ertangi kun, lid istagi yoki 10:00) ──
    // Har tugma haqiqiy amal: vaqtni ushlab turish, ustoz taklifini qabul qilish, adminga "Ustoz biriktirilmagan"
    // yuborish. Ushlab turish lid uchun — lid tanlanmagan bo'lsa, asosiy sahifada lid so'raladi (P.pending).
    function withDays(n, fn) { const keep = P.days; P.days = n; try { return fn(); } finally { P.days = keep; } }
    function rejectedLeads() {
        return myLeads().filter(l => l.status === 'sinov-darsida').map(l => ({ l, r: W().request(l) }))
            .filter(x => x.r && x.r.state === 'rejected').sort((a, b) => String(b.r.rejectedAt || b.r.scheduledAt || '').localeCompare(String(a.r.rejectedAt || a.r.scheduledAt || '')));
    }
    function statesModel() {
        const tm = U().addDays(U().today(), 1);
        const wish = P.wish != null ? P.wish : 10 * 60;
        const keepDate = P.date; P.date = tm;
        try {
            const ts = visibleTeachers(tm);
            const near = candidates(tm, wish);
            // 1 — istagan vaqtda band ustoz (haqiqiy band) va eng yaqin bo'sh vaqtlar.
            const busyT = ts.find(t => { const v = view(t, tm); return v && v.work.some(w => w.start <= wish && wish + P.dur <= w.end) && !dayFits(t, tm, wish); });
            // 2 — hozir ushlab turish mumkin bo'lgan haqiqiy bo'sh vaqt.
            const free = near[0] || null;
            // 4 — 08:00–21:30 orasida hech kim bo'sh bo'lmagan eng erta ish vaqti (avval lid istagi).
            const workAt = m => ts.some(t => (view(t, tm)?.work || []).some(w => w.start <= m && m + P.dur <= w.end));
            const nobody = m => !ts.some(t => dayFits(t, tm, m));
            let none = null;
            if (workAt(wish) && nobody(wish)) none = wish;
            else for (let m = 8 * 60; m <= 21 * 60 + 30; m += STEP) if (nobody(m) && (workAt(m) || m < 9 * 60)) { none = m; break; }
            const noneNear = none == null ? null : candidates(tm, none)[0] || null;
            // 5 — 3 kunlik sinov: birinchi kuni bo'sh, lekin keyingi kunlardan biri band.
            const d3 = trialDates(tm, 3);
            let partial = null;
            for (const t of ts) { for (let m = 8 * 60; m <= 21 * 60 && !partial; m += STEP) if (dayFits(t, tm, m) && !d3.every(d => dayFits(t, d, m))) partial = { t, m }; if (partial) break; }
            const alt3 = withDays(3, () => candidates(tm, partial ? partial.m : wish)).slice(0, 3);
            return { tm, wish, busyT, near: near.filter(c => !(busyT && c.t === busyT && c.m === wish)).slice(0, 3), free, none, noneNear, d3, partial, alt3, rej: rejectedLeads()[0] || null };
        } finally { P.date = keepDate; }
    }
    function drawStates(el) {
        const head = `<div class="sv-head"><div class="sv-ht"><button type="button" class="sc-link sv-back" data-back-states>← Sinov darsi qo'yish</button>
              <h1>Band qilishdagi holatlar</h1><p class="sc-sub">Sotuv menejeri va ROP ko'radigan xabarlar · har birida keyingi qadam tayyor · ertangi kun bo'yicha haqiqiy jadval</p></div></div>`;
        if (!P.data || P.failed) {
            el.innerHTML = head + (P.failed ? `<section class="sc-card ss-lerr">${window.LoadErr.html({ title: 'Ustozlar jadvalini yuklab bo\'lmadi', err: P.err, note: 'Holatlar haqiqiy bo\'sh vaqtlardan hisoblanadi — jadvalsiz ko\'rsatilmadi.' })}</section>` : '<div class="sc-skel"></div>');
            el.querySelector('[data-back-states]').onclick = () => { P.view = null; draw(); };
            window.LoadErr.bind(el, () => load());
            return;
        }
        const M = statesModel();
        const dd = d => `${U().DAY[U().wd(d) - 1]} ${Number(d.slice(8))}-${MON[Number(d.slice(5, 7)) - 1]}`;
        const pick = (c, label, pri, days = 1) => `<button type="button" class="sc-btn${pri ? ' sc-btn--pri' : ''}" data-st-pick="${esc(c.t)}|${c.date}|${c.m}|${days}"${P.busy ? ' disabled' : ''}>${esc(label)}</button>`;
        const card = (n, title, body, isSample = false) => `<section class="sc-card rs-hc${isSample ? ' is-sample' : ''}"><h3 class="rs-hc-h">${n} · ${esc(title)}${isSample ? ' <span class="rs-hc-nm">· namuna</span>' : ''}</h3>${body}</section>`;
        const empty = t => `<p class="sc-mt rs-hc-empty">${esc(t)}</p>`;
        // Bo'sh holat (dizayn: "3 · ... · namuna"): holat hozir yo'q — qanday ko'rinishi namunasi va o'chiq tugmalar, ostida haqiqiy holat matni.
        const sample = (kind, icon, title, text, btns, note) => `<div class="rs-hc-sample" aria-hidden="true">${toastBox(kind, icon, esc(title), esc(text))}
              <div class="sc-row sc-wrap">${btns.map((b, i) => `<button type="button" class="sc-btn${i ? '' : ' sc-btn--pri'}" disabled tabindex="-1">${esc(b)}</button>`).join('')}</div></div>${empty(note)}`;
        const lbl = c => `${short(tname(c.t))} · ${U().DAY[U().wd(c.date) - 1]} ${hm(c.m)}`;
        const c1 = M.busyT
            ? `${toastBox('bad', '⚠', `${esc(short(tname(M.busyT)))} · ${esc(dd(M.tm))} ${hm(M.wish)} band`, 'Bu vaqt allaqachon band (dars yoki boshqa menejerning sinovi). Tanlov saqlanmaydi.')}
               <b class="ss-lab">Lid istagiga eng yaqin bo'sh vaqtlar:</b><div class="ss-alt2">${M.near.map(c => pick(c, lbl(c))).join('') || empty('Ertaga bo\'sh vaqt yo\'q — boshqa sana tanlang.')}</div>`
            : empty(`Ertaga ${hm(M.wish)} da band ustoz yo'q — bu holat hozir yuz bermaydi.`) + (M.near.length ? `<div class="ss-alt2">${M.near.map(c => pick(c, lbl(c))).join('')}</div>` : '');
        const c2 = M.free
            ? `${toastBox('warn', '⏳', '10 daqiqa o\'tsa — vaqt qo\'yib yuboriladi', `${esc(short(tname(M.free.t)))} · ${esc(dd(M.tm))} ${hm(M.free.m)} hozir bo'sh. Ushlab turasizmi?`)}
               <div class="sc-row sc-wrap">${pick(M.free, 'Qayta ushlab turish', true)}<button type="button" class="sc-btn" data-st-back>Boshqa vaqt</button></div>`
            : empty('Ertaga sinovga ochiq bo\'sh vaqt yo\'q.');
        const R = M.rej;
        const rp = R ? (R.r.proposals || []).map(local).filter(Boolean) : [];
        const ra = R ? local(R.r.scheduledAt) : null;
        const c3 = R
            ? `${toastBox('info', '↺', `${esc(short(tname(String(R.r.teacherId))))} · ${esc(R.l.name)}${ra ? ` · ${esc(dd(ra.date))} ${hm(ra.min)}` : ''}`, `"${esc(R.r.reasonLabel || 'Rad etildi')}".${rp.length ? ` Taklif: ${rp.map(x => `${esc(dayShort(x.date))} · ${hm(x.min)}`).join(', ')}.` : ' Ustoz vaqt taklif qilmadi.'}`)}
               ${rp.length ? `<div class="ss-alt2" role="group" aria-label="Ustoz taklif qilgan vaqtlar">${rp.map((x, i) => `<button type="button" class="ss-ch3" data-st-rp="${i}" aria-pressed="${i === (P.stRp || 0)}">${esc(dayShort(x.date))} · ${hm(x.min)}</button>`).join('')}</div>` : ''}
               <div class="sc-row sc-wrap">${rp.length ? `<button type="button" class="sc-btn sc-btn--pri" data-st-rej-go${P.busy ? ' disabled' : ''}>Lidga yuborish va band qilish</button>` : ''}<button type="button" class="sc-btn" data-st-rej-other>Boshqa ustoz</button></div>`
            : sample('info', '↺', 'Ustoz · Lid · sana va vaqt', '"Shu vaqtda bandman". Taklif: ustoz bergan 2–3 ta vaqt.', ['Lidga yuborish va band qilish', 'Boshqa ustoz'],
                'Hozir ustoz rad etgan sinov yo\'q. Rad etilsa, shu yerda va lid sahifasida chiqadi.');
        const c4 = M.none != null
            ? `${toastBox('warn', '!', `Ertaga ${hm(M.none)} — sinovga ochiq ustoz yo'q`, M.noneNear ? `Eng yaqin bo'sh vaqt: ${hm(M.noneNear.m)} (${esc(short(tname(M.noneNear.t)))}). Lid aynan ${hm(M.none)} ni xohlasa, adminga yuboring.` : `Lid aynan ${hm(M.none)} ni xohlasa, adminga yuboring.`)}
               <div class="sc-row sc-wrap"><button type="button" class="sc-btn sc-btn--pri" data-st-unassigned="${M.none}"${P.busy ? ' disabled' : ''}>Adminga yuborish · "Ustoz biriktirilmagan"</button>${M.noneNear ? pick(M.noneNear, `${hm(M.noneNear.m)} ni taklif qilish`) : ''}</div>`
            : sample('warn', '!', 'Ertaga 08:00 — sinovga ochiq ustoz yo\'q', 'Eng erta bo\'sh vaqt va ustoz shu yerda ko\'rsatiladi. Lid aynan o\'sha vaqtni xohlasa, adminga yuboring.', ['Adminga yuborish · "Ustoz biriktirilmagan"', 'Eng yaqin vaqtni taklif qilish'],
                'Hozir bu holat yo\'q: ertaga 08:00–21:30 oralig\'ida har yarim soatda kamida bitta ustoz bo\'sh.');
        const P5 = M.partial;
        const c5 = P5
            ? `${toastBox('warn', '!', `${esc(short(tname(P5.t)))} · ${hm(P5.m)} · ${M.d3.map(d => `${esc(dayShort(d))} ${dayFits(P5.t, d, P5.m) ? '✓' : '✗'}`).join(' · ')}`, 'Uchala kun bir vaqtda bo\'lishi kerak. Mos variantlar:')}
               <div class="ss-slots">${M.alt3.map((c, i) => `<button type="button" class="ss-sl5${i ? '' : ' is-on'}" data-st-pick="${esc(c.t)}|${c.date}|${c.m}|3"${P.busy ? ' disabled' : ''}>${esc(short(tname(c.t)))} ${hm(c.m)}<small>${M.d3.map(dayShort).join(' · ')}</small></button>`).join('')}
                 <div class="ss-sl5 is-no">${esc(short(tname(P5.t)))} ${hm(P5.m)}<small>${esc(M.d3.filter(d => !dayFits(P5.t, d, P5.m)).map(dayShort).join(', '))} band</small></div></div>`
            : (M.alt3.length ? `${empty('Ertangi 3 kunlik sinovda bitta kuni band bo\'lgan vaqt yo\'q. Uch kunda ham bo\'sh variantlar:')}<div class="ss-slots">${M.alt3.map(c => `<button type="button" class="ss-sl5" data-st-pick="${esc(c.t)}|${c.date}|${c.m}|3">${esc(short(tname(c.t)))} ${hm(c.m)}<small>${M.d3.map(dayShort).join(' · ')}</small></button>`).join('')}</div>` : empty('3 kunlik sinov uchun bo\'sh vaqt yo\'q.'));
        el.innerHTML = `${head}
          ${P.alert?.type === 'error' ? `<div class="sc-err" role="alert">${esc(P.alert.msg)}</div>` : ''}
          <div class="rs-sts">
            ${card(1, 'Boshqa menejer oldinroq band qildi', c1)}
            ${card(2, 'Ushlab turish vaqti tugadi (1-holatdan oldin)', c2)}
            ${card(3, 'Ustoz rad etdi va vaqt taklif qildi', c3, !R)}
            ${card(4, 'Lid istagan vaqtda hech kim bo\'sh emas', c4, M.none == null)}
            ${card(5, '3 kunlik sinovda bir kun band', c5)}
          </div>`;
        const back = () => { P.view = null; draw(); document.getElementById('ssPage')?.scrollTo?.(0, 0); };
        el.querySelector('[data-back-states]').onclick = back;
        el.querySelector('[data-st-back]')?.addEventListener('click', () => { P.date = M.tm; back(); });
        el.querySelectorAll('[data-st-pick]').forEach(b => b.onclick = () => {
            const [t, d, m, days] = b.dataset.stPick.split('|');
            P.view = null; P.date = d; P.days = Number(days) || 1; P.alert = null;
            if (!P.lead) { P.pending = { teacherId: t, date: d, min: Number(m) }; P.alert = { type: 'error', msg: `Lidni tanlang — ${short(tname(t))} · ${dayShort(d)} ${hm(Number(m))} shu lid uchun ushlab turiladi.` }; draw(); return; }
            hold(t, d, Number(m));
        });
        el.querySelectorAll('[data-st-rp]').forEach(b => b.onclick = () => { P.stRp = Number(b.dataset.stRp); draw(); });
        el.querySelector('[data-st-rej-go]')?.addEventListener('click', () => {
            const k = P.stRp || 0;
            open({ lang: R.l._lang, leadId: R.l.id, from: P.from, onClose: P.onClose });
            if (P) { P.rejPick = k; const go = () => (P?.data ? acceptProposal() : setTimeout(go, 200)); go(); }
        });
        el.querySelector('[data-st-rej-other]')?.addEventListener('click', () => { open({ lang: R.l._lang, leadId: R.l.id, from: P.from, onClose: P.onClose }); if (P) { P.rejDismissed = true; P.mode = 'any'; } });
        el.querySelector('[data-st-unassigned]')?.addEventListener('click', e => {
            P.view = null; P.date = M.tm; P.wish = Number(e.currentTarget.dataset.stUnassigned); P.alert = null;
            if (!P.lead) { P.alert = { type: 'error', msg: `Lidni tanlang — so'ng "Adminga yuborish" (${hm(P.wish)}).` }; draw(); return; }
            draw(); sendUnassigned();
        });
    }

    // ── Chizish ─────────────────────────────────────────────────────────────
    function draw() {
        const el = document.getElementById('ssPage'); if (!el || !P) return;
        if (P.view === 'states') { drawStates(el); return; }
        const back = P.from === 'schedule' ? '← Dars jadvali' : '← Lidlar';
        const main = !P.data ? '' : P.failed ? `<section class="sc-card ss-gcard ss-lerr">${window.LoadErr.html({ title: 'Ustozlar jadvalini yuklab bo\'lmadi', err: P.err, note: 'Bo\'sh vaqtlar ko\'rsatilmadi — hech narsa band qilinmadi.' })}</section>`
            : `${alerts()}${grid()}${sbar()}`;
        el.innerHTML = `<div class="sv-head"><div class="sv-ht"><button type="button" class="sc-link sv-back" data-back>${back}</button>
              <h1>Sinov darsi qo'yish</h1><p class="sc-sub">Umumiy jadvaldan · faqat "sinovga ochiq" vaqtlar tanlanadi · boshqa o'quvchilar ismi ko'rinmaydi</p></div>
            <div class="ss-hr"><span class="sc-pill sc-pill--info ss-hpill">Barcha menejerlarning band qilgan vaqtlari hisobga olingan</span><button type="button" class="sc-link rs-states" data-states>Band qilishdagi holatlar →</button></div></div>
          ${P.data ? `<div class="ss-lay">${aside()}<div class="ss-main">${main}</div></div>` : '<div class="sc-skel"></div>'}`;
        bind(el);
        window.LoadErr.bind(el, () => load());
        tick();
    }
    function aside() {
        const lead = P.lead, today = U().today();
        const leadBox = lead ? `<div class="sc-row ss-who">${U().studentAvatar({ id: lead.id, name: lead.name }, 40)}<div class="sc-grow"><div class="ss-nm">${esc(lead.name)}</div><div class="sc-mt">${esc(lead.phone || '')}${lead.phone ? ' · ' : ''}${P.lang === 'russian' ? 'Rus tili' : 'Ingliz tili'}</div></div></div>
              ${lead.status === 'sinov-darsida' ? `<div class="sc-mt">Hozirgi holat: <b>${esc(W().PHASES[leadPhase(lead)]?.label || '')}</b> · yangi vaqt band qilinsa, avvalgisi tarixga o'tadi</div>` : ''}`
            : `<label class="ss-lf"><span>Lid</span><select data-lead aria-label="Lid"><option value="">— lidni tanlang —</option>${myLeads().filter(l => OPEN.has(l.status) || l.status === 'sinov-darsida')
                .sort((a, b) => String(a.name).localeCompare(String(b.name))).slice(0, 400).map(l => `<option value="${esc(l._lang + '|' + l.id)}">${esc(l.name)}${l.phone ? ' · ' + esc(String(l.phone).slice(-4)) : ''}${l._lang === 'russian' ? ' · rus' : ''}</option>`).join('')}</select><small class="sc-mt">Faqat sizning lidlaringiz</small></label>`;
        const times = []; for (let m = 8 * 60; m <= 21 * 60 + 30; m += 30) times.push(m);
        const chips = [0, 1, 2, 3, 4].map(k => { const d = U().addDays(today, k); const sm = P.data.views.filter(v => v.date === d && P.data.teachers.some(t => t.id === v.teacherId)).reduce((n, v) => n + sum(futureFree(v, v.trialFree)), 0);
            return `<button type="button" class="ss-ch2" data-date="${d}" aria-pressed="${d === P.date}">${rel(d) || dayShort(d)}<small>${k === 1 ? dayShort(d) + ' · ' : ''}${P.failed ? '—' : hrs(sm)}</small></button>`; }).join('');
        const custom = P.date > U().addDays(today, 4) ? `<button type="button" class="ss-ch2" aria-pressed="true">${dayShort(P.date)}<small>${dm(P.date)}</small></button>` : '';
        const cands = candidates().slice(0, 3);
        const exact = c => P.wish != null && c.m === P.wish;
        const selOf = c => P.sel && P.sel.t === c.t && P.sel.date === c.date && P.sel.m === c.m;
        const teacherSel = P.mode === 'teacher' ? `<select data-tsel aria-label="Ustoz"><option value="">— ustozni tanlang —</option>${P.data.teachers.map(t => `<option value="${esc(t.id)}"${t.id === P.teacherId ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>` : '';
        return `<aside class="sc-card ss-aside" aria-label="Lid va sinov parametrlari"><div class="ss-lead">
            ${leadBox}
            ${P.wishText && !P.wishEdit ? `<div class="ss-wish ss-wish--ro"><b>Lid istagi:</b> ${esc(P.wishText)}<button type="button" class="sc-link ss-wish-ed" data-wish-edit>O'zgartirish</button></div>`
              : `<div class="ss-wish"><b>Lid istagi:</b> <select data-wish aria-label="Lid istagan vaqt"><option value="">vaqt —</option>${times.map(m => `<option value="${m}"${m === P.wish ? ' selected' : ''}>${hm(m)}</option>`).join('')}</select> atrofida
              <input data-note type="text" maxlength="200" value="${esc(P.note)}" placeholder="Izoh: daraja, qanday bog'lanadi…" aria-label="Lid istagi izohi"></div>`}
            <div class="ss-lf"><span>Sana</span><div class="ss-chips2">${chips}${custom}<label class="ss-ch2 ss-ch2--d" title="Boshqa sana"><input type="date" data-dpick min="${today}" max="${U().addDays(today, 13)}" value="${P.date}" aria-label="Boshqa sana"></label></div></div>
            <div class="ss-lf"><span>Davomiyligi</span><div class="sc-seg ss-full" role="group" aria-label="Davomiyligi">${[15, 30, 60].map(n => `<button type="button" data-dur="${n}" aria-pressed="${n === P.dur}">${n} daq</button>`).join('')}</div></div>
            <div class="ss-lf"><span>Necha kunlik sinov</span><div class="sc-seg ss-full" role="group" aria-label="Kunlar">${[1, 2, 3].map(n => `<button type="button" data-days="${n}" aria-pressed="${n === P.days}">${n} kun</button>`).join('')}</div>
              <span class="sc-mt">2–3 kun tanlansa, keyingi kunlar ham tekshiriladi va band qilinadi${P.days > 1 ? ` (${trialDates(P.date, P.days).map(dayShort).join(' · ')})` : ''}. Natija yozilsa, qolgan kunlar bo'shaydi.</span></div>
            <div class="ss-lf"><span>Ustoz</span><div class="sc-seg ss-full" role="group" aria-label="Ustoz"><button type="button" data-mode="any" aria-pressed="${P.mode === 'any'}">Kim bo'sh bo'lsa</button><button type="button" data-mode="teacher" aria-pressed="${P.mode === 'teacher'}">Aniq ustoz</button></div>${teacherSel}</div>
          </div>
          <h3 class="sv-ph ss-ph">${P.wish != null ? 'Istakka eng yaqin' : 'Eng erta bo\'sh vaqtlar'}</h3>
          <ul class="ss-alt">${cands.map(c => `<li><div class="sc-grow"><b>${esc(candLabel(c))}</b><small>${P.wish != null ? diffTxt(c.m - P.wish) : `${hrs(openMin(c.t, c.date))} ochiq`}</small></div>
              ${selOf(c) ? `<span class="sc-pill sc-pill--ok">${exact(c) ? 'Mos' : 'Tanlandi'}</span>` : `${exact(c) ? '<span class="sc-pill sc-pill--ok">Mos</span>' : ''}<button type="button" class="sc-btn sc-btn--sm" data-pick="${esc(c.t)}|${c.date}|${c.m}">Tanlash</button>`}</li>`).join('')
            || `<li class="sc-mt">${P.failed ? 'Jadval yuklanmadi — bo\'sh vaqtlar noma\'lum' : `${dayShort(P.date)}: ${P.dur} daqiqalik${P.days > 1 ? `, ${P.days} kunlik` : ''} sinovga ochiq vaqt yo'q`}</li>`}</ul>
        </aside>`;
    }
    function toastBox(kind, icon, title, text, extra = '') {
        return `<div class="ss-toast ss-toast--${kind}" role="${kind === 'bad' ? 'alert' : 'status'}"><span class="ss-ti" aria-hidden="true">${icon}</span><div><b>${title}</b>${text}</div></div>${extra}`;
    }
    function alerts() {
        const out = [];
        if (P.err) out.push(window.LoadErr.html({ title: 'Jadvalni yangilab bo\'lmadi', err: P.err, note: 'Oxirgi yuklangan holat ko\'rsatilmoqda.', compact: true }));
        const r = rejected();
        if (r) {
            const a = local(r.scheduledAt);
            const props = (r.proposals || []).map(local).filter(Boolean);
            const note = r.rejectNote ? ` Izoh: "${esc(r.rejectNote)}".` : '';
            out.push(`<section class="sc-card ss-st"><h3 class="sv-ph">Ustoz rad etdi${props.length ? ' va vaqt taklif qildi' : ''}</h3>
              ${toastBox('info', '↺', `${esc(short(tname(String(r.teacherId))))} · ${esc(P.lead.name)}${a ? ` · ${esc(dayShort(a.date))}-${MON[Number(a.date.slice(5, 7)) - 1]} ${hm(a.min)}` : ''}`,
                `"${esc(r.reasonLabel || 'Rad etildi')}".${note} ${props.length ? `Taklif: ${props.map(x => `${esc(dayShort(x.date))} · ${hm(x.min)}`).join(', ')}.` : 'Ustoz boshqa vaqt taklif qilmadi — pastdan boshqa vaqt yoki ustoz tanlang.'}`)}
              ${props.length ? `<div class="ss-alt2" role="group" aria-label="Ustoz taklif qilgan vaqtlar">${props.map((x, i) => `<button type="button" class="ss-ch3" data-rp="${i}" aria-pressed="${i === P.rejPick}">${esc(dayShort(x.date))} · ${hm(x.min)}</button>`).join('')}</div>` : ''}
              <div class="sc-row sc-wrap">${props.length ? `<button type="button" class="sc-btn sc-btn--pri ss-big" data-rp-go${P.busy ? ' disabled' : ''}>Lidga yuborish va band qilish</button>` : ''}<button type="button" class="sc-btn ss-big" data-rp-no>Boshqa ustoz</button></div></section>`);
        }
        const A = P.alert;
        if (A?.type === 'taken') {
            const alt = candidates(A.date, P.wish ?? A.m).filter(c => !(c.t === A.t && c.m === A.m)).slice(0, 3);
            out.push(`<section class="sc-card ss-st">${toastBox('bad', '⚠', `${esc(short(tname(A.t)))} · ${esc(dayShort(A.date))}-${MON[Number(A.date.slice(5, 7)) - 1]} ${hm(A.m)} endi band`, `${esc(A.msg || 'Boshqa menejer oldinroq band qildi.')} Sizning tanlovingiz saqlanmadi.`)}
              ${alt.length ? `<b class="ss-lab">Lid istagiga eng yaqin bo'sh vaqtlar:</b><div class="ss-alt2">${alt.map(c => `<button type="button" class="ss-ch3" data-pick="${esc(c.t)}|${c.date}|${c.m}">${esc(candLabel(c))}</button>`).join('')}</div>` : '<p class="sc-mt">Bu kunda boshqa bo\'sh vaqt yo\'q — boshqa sana tanlang.</p>'}</section>`);
        } else if (A?.type === 'expired') {
            const still = fitsAll(A.t, A.date, A.m);
            out.push(`<section class="sc-card ss-st">${toastBox('warn', '⏳', '10 daqiqa o\'tdi — vaqt qo\'yib yuborildi', `${esc(short(tname(A.t)))} · ${esc(dayShort(A.date))}-${MON[Number(A.date.slice(5, 7)) - 1]} ${hm(A.m)} ${still ? 'hali bo\'sh. Qayta ushlab turasizmi?' : 'endi band — boshqa vaqt tanlang.'}`)}
              <div class="sc-row sc-wrap">${still ? `<button type="button" class="sc-btn sc-btn--pri ss-big" data-pick="${esc(A.t)}|${A.date}|${A.m}">Qayta ushlab turish</button>` : ''}<button type="button" class="sc-btn ss-big" data-dismiss>Boshqa vaqt</button></div></section>`);
        } else if (A?.type === 'error') {
            out.push(`<div class="sc-err" role="alert">${esc(A.msg)}</div>`);
        } else if (!P.sel && !r && P.wish != null && P.data.views.length) {
            const dates = trialDates(P.date, P.days);
            const exact = candidates().filter(c => c.m === P.wish);
            const firstDay = P.days > 1 ? visibleTeachers().filter(t => dayFits(t, P.date, P.wish)) : [];
            if (!exact.length && firstDay.length) {
                // 5-holat: ko'p kunlik sinovda bir kun band.
                const t = firstDay[0];
                const marks = dates.map(d => { const ok = dayFits(t, d, P.wish); const v = view(t, d); const why = ok ? '' : !v || !v.work.length ? 'ish kuni emas' : (v.items || []).some(i => overlaps(i, { start: P.wish, end: P.wish + P.dur }) && i.kind !== 'close' && i.kind !== 'leave') ? 'dars bor' : 'sinovga yopiq';
                    return `${esc(dayShort(d))}${d === dates[dates.length - 1] && d.slice(5, 7) !== P.date.slice(5, 7) ? '-' + MON[Number(d.slice(5, 7)) - 1] : ''} ${ok ? '✓' : `✗ (${why})`}`; }).join(' · ');
                const alt = candidates().slice(0, 3);
                out.push(`<section class="sc-card ss-st">${toastBox('warn', '!', `${esc(short(tname(t)))} · ${hm(P.wish)} · ${marks}`, `${P.days === 3 ? 'Uchala' : 'Ikkala'} kun bir vaqtda bo'lishi kerak. Mos variantlar:`)}
                  <div class="ss-slots">${alt.map(c => `<button type="button" class="ss-sl5" data-pick="${esc(c.t)}|${c.date}|${c.m}">${esc(short(tname(c.t)))} ${hm(c.m)}<small>${dates.map(dayShort).join(' · ')}</small></button>`).join('')}
                    <div class="ss-sl5 is-no">${esc(short(tname(t)))} ${hm(P.wish)}<small>${esc(dates.filter(d => !dayFits(t, d, P.wish)).map(dayShort).join(', '))} band</small></div></div></section>`);
            } else if (!exact.length) {
                // 4-holat: lid istagan vaqtda hech kim bo'sh emas.
                const near = candidates()[0];
                out.push(`<section class="sc-card ss-st">${toastBox('warn', '!', `${esc(rel(P.date) || dayShort(P.date))} ${hm(P.wish)} — sinovga ochiq ustoz yo'q`,
                    near ? `Eng yaqin bo'sh vaqt: ${hm(near.m)} (${esc(short(tname(near.t)))}). Lid aynan ${hm(P.wish)} ni xohlasa, adminga yuboring.` : `Bu kunda sinovga ochiq vaqt yo'q. Lid aynan ${hm(P.wish)} ni xohlasa, adminga yuboring.`)}
                  <div class="sc-row sc-wrap"><button type="button" class="sc-btn sc-btn--pri ss-big" data-unassigned${P.lead && !P.busy ? '' : ' disabled'}>Adminga yuborish · "Ustoz biriktirilmagan"</button>${near ? `<button type="button" class="sc-btn ss-big" data-pick="${esc(near.t)}|${near.date}|${near.m}">${hm(near.m)} ni taklif qilish</button>` : ''}</div></section>`);
            }
        }
        return out.join('');
    }
    function cellState(t, m) {
        const d = P.date, v = view(t, d), seg = { start: m, end: m + STEP };
        if (P.sel && P.sel.t === t && P.sel.date === d && P.sel.m === m) return 'sel';
        if (P.sel && P.sel.t === t && P.sel.date === d && overlaps(seg, { start: P.sel.m, end: P.sel.m + (P.hold?.dur || P.dur) })) return 'sel2';
        if (!v) return 'o';
        // Muzlatilgan o'quvchi joyi sotuvga "dars" bo'lib keladi, lekin sinovga ochiq — trialFree ustun.
        if (inside(v.trialFree, m, m + STEP) && !(d === U().today() && m < U().nowMin())) return fitsAll(t, d, m) ? 'f' : 'fx';
        const it = (v.items || []).find(i => overlaps(i, seg));
        if (it) {
            if (it.kind === 'trial' && it.status === 'hold') return it.mine ? 'mh' : 'h';
            if (it.kind === 'trial') return 't';
            if (it.kind === 'close' || it.kind === 'leave') return 'c';
            return 'b';
        }
        if (d === U().today() && m < U().nowMin()) return inside(v.work, m, m + STEP) ? 'p' : 'o';
        if (inside(v.work, m, m + STEP)) return 'c';
        return 'o';
    }
    function grid() {
        const ts = visibleTeachers();
        const views = ts.map(t => view(t, P.date)).filter(Boolean);
        // Ko'rinadigan oyna 09:00–20:00 (SotuvSinov dizayni, 1440px'ga sig'adi); sinovga ochiq vaqt yoki band sinov
        // shu oynadan tashqarida bo'lsa — o'sha soatgacha kengayadi (ish vaqtining bo'sh/yopiq chetlari oynani kengaytirmaydi).
        let H0 = 9 * 60, H1 = 20 * 60;
        for (const v of views) for (const x of [...futureFree(v, v.trialFree), ...(v.items || []).filter(i => i.kind === 'trial')]) { H0 = Math.min(H0, Math.floor(x.start / 60) * 60); H1 = Math.max(H1, Math.ceil(x.end / 60) * 60); }
        if (P.sel) { H0 = Math.min(H0, Math.floor(P.sel.m / 60) * 60); H1 = Math.max(H1, Math.ceil((P.sel.m + P.dur) / 60) * 60); }
        const cols = []; for (let m = H0; m < H1; m += STEP) cols.push(m);
        const pref = m => P.wish != null && Math.abs(m - P.wish) <= 120;
        const head = `<tr><th class="ss-tn" scope="col"><span class="sc-mt">Ustoz</span></th>${cols.map(m => `<th${m % 60 ? ' class="hh' + (pref(m) ? ' pref' : '') + '"' : ` scope="col"${pref(m) ? ' class="pref"' : ''}`}>${m % 60 ? '' : hm(m)}</th>`).join('')}</tr>`;
        const LBL = { b: 'band', c: 'yopiq', t: 'sinov', h: '⏳', o: '', p: '', mh: '', sel2: '' };
        const TTL = { b: 'Band (dars)', c: 'Sinovga yopiq', t: 'Boshqa sinov', h: 'Boshqa menejer tanlayapti', o: 'Ish vaqti emas', p: 'O\'tib ketgan', mh: 'Siz ushlab turibsiz', sel2: 'Siz tanladingiz' };
        const rows = ts.map(t => {
            const v = view(t, P.date);
            const cells = cols.map(m => ({ m, s: cellState(t, m) }));
            let html = '';
            for (let i = 0; i < cells.length;) {
                const c = cells[i];
                if (c.s === 'f' || c.s === 'sel' || c.s === 'fx') {
                    const lbl = `${tname(t)} ${hm(c.m)}`;
                    html += c.s === 'fx' ? `<td class="gc fx" title="${esc(lbl)} · ${P.dur} daqiqaga yoki barcha kunlarga sig'maydi"></td>`
                        : `<td class="gc f${c.s === 'sel' ? ' sel' : ''}"><button type="button" data-pick="${esc(t)}|${P.date}|${c.m}" aria-label="${esc(lbl)} ${c.s === 'sel' ? 'tanlangan' : 'bo\'sh'}" aria-pressed="${c.s === 'sel'}"${P.busy ? ' disabled' : ''}>${c.s === 'sel' ? '✓' : '+'}</button></td>`;
                    i++; continue;
                }
                let j = i + 1; while (j < cells.length && cells[j].s === c.s) j++;
                const span = j - i;
                let title = TTL[c.s] || '';
                if (c.s === 'h') { const it = (v?.items || []).find(x => x.kind === 'trial' && x.status === 'hold' && overlaps(x, { start: c.m, end: c.m + STEP })); const left = it?.holdUntil ? Math.max(1, Math.round((Date.parse(it.holdUntil) - Date.now()) / 60000)) : null; if (left) title += ` · ${left} daq`; }
                html += `<td class="gc st-${c.s}"${span > 1 ? ` colspan="${span}"` : ''} title="${esc(`${hm(c.m)}–${hm(cells[j - 1].m + STEP)} · ${title}`)}">${span > 1 || c.s === 'h' ? LBL[c.s] || '' : ''}</td>`;
                i = j;
            }
            return `<tr><th scope="row" class="ss-tn"><div class="ss-nm">${esc(tname(t))}</div><div class="ss-op">${hrs(openMin(t, P.date))} ochiq</div></th>${html}</tr>`;
        }).join('');
        const lbl = `${rel(P.date) ? rel(P.date) + ' · ' : ''}${U().DAY_FULL[U().wd(P.date) - 1]}, ${dm(P.date)}`;
        return `<section class="sc-card ss-gcard" aria-labelledby="ssGt"><header class="sv-bh"><h2 id="ssGt">Kim bo'sh? · ${esc(lbl)}</h2><span class="sc-grow"></span>
              ${P.wish != null ? '<span class="sc-pill sc-pill--warn">Sariq ustun — lid istagan vaqt ±2 soat</span>' : ''}<span class="sc-mt" data-upd></span></header>
            ${ts.length ? `<div class="ss-gw"><table class="ss-g3"><thead>${head}</thead><tbody>${rows}</tbody></table></div>` : `<p class="sc-mt sv-pp">${P.mode === 'teacher' && !P.teacherId ? 'Ustozni tanlang.' : 'Bu kunda ish vaqti belgilangan ustoz yo\'q.'}</p>`}
            <div class="sv-lg"><span><i class="sv-sq k-free"></i>Sinovga ochiq — bosing</span><span><i class="sv-sq ss-sq-sel"></i>Siz tanladingiz</span><span><i class="sv-sq ss-sq-b"></i>Band (dars)</span><span><i class="sv-sq k-tr"></i>Boshqa sinov</span>
              <span><i class="sv-sq k-hold"></i>Boshqa menejer tanlayapti</span><span><i class="sv-sq k-cls"></i>Sinovga yopiq</span><span><i class="sv-sq k-off"></i>Ish vaqti emas</span></div></section>`;
    }
    function sbar() {
        const h = P.hold;
        if (!h) return `<div class="ss-sbar" role="region" aria-label="Tanlov"><div class="ss-st"><b>${P.lead ? 'Vaqt tanlanmagan' : 'Lid tanlanmagan'}</b><div class="ss-sm">${P.lead ? 'Yashil katakni bosing — vaqt 10 daqiqa siz uchun ushlab turiladi, boshqa menejerlar uni "tanlanmoqda" deb ko\'radi.' : 'Chapdan lidni tanlang, keyin yashil katakni bosing.'}</div></div>
            <button type="button" class="sc-btn ss-gh" data-cancel>Bekor</button><button type="button" class="sc-btn sc-btn--pri ss-big" disabled>Band qilish · ustozga yuborish</button></div>`;
        const nm = tname(h.t);
        return `<div class="ss-sbar" role="region" aria-label="Tanlov"><div class="ss-st"><b>${esc(nm)} · ${esc(U().DAY_FULL[U().wd(h.date) - 1])}, ${dm(h.date)} · ${hm(h.m)}–${hm(h.m + h.dur)}</b>
            <div class="ss-sm">${h.dates.length} kunlik${h.dates.length > 1 ? ` (${h.dates.map(dayShort).join(' · ')})` : ''} · ${h.dur} daq · <span data-left>10:00</span> siz uchun ushlab turiladi · ${esc(first(nm))} tasdiqlagach lidga xabar boradi</div></div>
          <button type="button" class="sc-btn ss-gh" data-cancel>Bekor</button><button type="button" class="sc-btn sc-btn--pri ss-big" data-confirm${P.busy ? ' disabled' : ''}>${P.busy ? 'Saqlanmoqda…' : 'Band qilish · ustozga yuborish'}</button></div>`;
    }
    function bind(el) {
        el.querySelector('[data-back]').onclick = () => close();
        el.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => { if (P?.hold) { await release(); draw(); } else close(); });
        el.querySelector('[data-confirm]')?.addEventListener('click', confirmHold);
        el.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { const [t, d, m] = b.dataset.pick.split('|'); if (P.date !== d) P.date = d; P.alert = null; hold(t, d, Number(m)); });
        el.querySelectorAll('[data-date]').forEach(b => b.onclick = async () => { if (P.date === b.dataset.date) return; await release(); P.date = b.dataset.date; P.alert = null; draw(); });
        el.querySelector('[data-dpick]')?.addEventListener('change', async e => { const v = e.target.value; if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v === P.date) return; await release(); P.date = v; P.alert = null; draw(); });
        el.querySelectorAll('[data-dur]').forEach(b => b.onclick = async () => { await release(); P.dur = Number(b.dataset.dur); P.alert = null; draw(); });
        el.querySelectorAll('[data-days]').forEach(b => b.onclick = async () => { await release(); P.days = Number(b.dataset.days); P.alert = null; draw(); });
        el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { P.mode = b.dataset.mode; draw(); });
        el.querySelector('[data-tsel]')?.addEventListener('change', e => { P.teacherId = e.target.value; draw(); });
        el.querySelector('[data-wish]')?.addEventListener('change', e => { P.wish = e.target.value === '' ? null : Number(e.target.value); draw(); });
        el.querySelector('[data-note]')?.addEventListener('input', e => { P.note = e.target.value; });
        el.querySelector('[data-wish-edit]')?.addEventListener('click', () => { P.wishEdit = true; draw(); });
        el.querySelector('[data-states]')?.addEventListener('click', () => { P.view = 'states'; draw(); document.getElementById('ssPage')?.scrollTo?.(0, 0); });
        el.querySelector('[data-lead]')?.addEventListener('change', async e => {
            const [lang, id] = String(e.target.value || '').split('|');
            if (!id) return;
            const lead = findLead(lang, id); if (!lead) return;
            P.lead = lead; P.alert = null; P.wishEdit = false; applyLeadWish(P);
            const d0 = W().durationOf(lead); if ([15, 30, 60].includes(d0)) P.dur = d0;
            if (lang !== P.lang) { P.lang = lang; await load(); } else draw();
            if (P.pending) { const p = P.pending; P.pending = null; const m = firstFreeIn(p.teacherId, p.date, p.min); if (m != null) hold(p.teacherId, p.date, m); }
        });
        el.querySelectorAll('[data-rp]').forEach(b => b.onclick = () => { P.rejPick = Number(b.dataset.rp); draw(); });
        el.querySelector('[data-rp-go]')?.addEventListener('click', acceptProposal);
        el.querySelector('[data-rp-no]')?.addEventListener('click', () => { P.rejDismissed = true; draw(); });
        el.querySelector('[data-dismiss]')?.addEventListener('click', () => { P.alert = null; draw(); });
        el.querySelector('[data-unassigned]')?.addEventListener('click', sendUnassigned);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Sotuv · Dars jadvali (SotuvJadval)
    // ════════════════════════════════════════════════════════════════════════
    async function renderJadval(root) {
        const SS = window.schoolSchedule;
        const st = SS.state;
        const today = U().today(), tom = U().addDays(today, 1);
        st.date ||= today;
        if (st.date < today) st.date = today;
        const date = st.date;
        const lang = st.lang || 'english';
        const lbl = d => `${d === today ? 'Bugun · ' : d === tom ? 'Ertaga · ' : ''}${U().DAY[U().wd(d) - 1]}, ${dm(d)}`;
        root.innerHTML = `<div class="sv-head"><div class="sv-ht"><h1>Dars jadvali</h1><p class="sc-sub">Ustozlarning bo'sh va band vaqti · o'quvchilar ismi ko'rinmaydi · vaqt Toshkent bo'yicha</p></div>
            <div class="sv-ctl"><div class="sv-mon" role="group" aria-label="Sana"><button type="button" data-d="-1" aria-label="Oldingi kun"${date <= today ? ' disabled' : ''}>‹</button><span>${esc(lbl(date))}</span><button type="button" data-d="1" aria-label="Keyingi kun">›</button></div>
              <button type="button" class="sc-btn sc-btn--pri sv-big" data-new>+ Sinov darsi qo'yish</button></div></div>
          <div data-body class="sv-body"><div class="sc-skel"></div></div>`;
        const reload = () => SS.render(root);
        root.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { st.date = U().addDays(st.date, Number(b.dataset.d)); if (st.date < today) st.date = today; reload(); });
        root.querySelector('[data-new]').onclick = () => open({ lang, from: 'schedule', onClose: reload });
        const body = root.querySelector('[data-body]');
        let d, dt;
        try {
            const [a, b] = await Promise.all([U().api(`/schedule?from=${today}&to=${tom}&lang=${lang}&mode=free`),
                date === today || date === tom ? null : U().api(`/schedule?from=${date}&to=${date}&lang=${lang}&mode=free`)]);
            d = a; dt = b || a;
        } catch (e) { body.innerHTML = window.LoadErr.html({ title: 'Dars jadvalini yuklab bo\'lmadi', err: e, note: 'Bo\'sh vaqtlar va sinovlar ko\'rsatilmadi.' }); window.LoadErr.bind(body, reload); return; }
        const teachers = (d.teachers || []);
        const tn = id => teachers.find(t => t.id === id)?.name || U().teacherName(id);
        const known = v => teachers.some(t => t.id === v.teacherId);
        const vToday = d.views.filter(v => v.date === today && v.work.length && known(v));
        const vTom = d.views.filter(v => v.date === tom && v.work.length && known(v));
        const vDay = dt.views.filter(v => v.date === date && (v.work.length || v.items.length) && known(v)).sort((a, b) => tn(a.teacherId).localeCompare(tn(b.teacherId)));
        const unDay = (dt.unassigned || []).filter(u => u.date === date);
        const openOf = v => sum(futureFree(v, v.trialFree));
        const todayOpen = vToday.reduce((n, v) => n + openOf(v), 0), todayN = vToday.filter(v => openOf(v) >= 30).length;
        const tomOpen = vTom.reduce((n, v) => n + openOf(v), 0);
        const tomFirst = vTom.map(v => ({ v, f: (v.trialFree || [])[0] })).filter(x => x.f).sort((a, b) => a.f.start - b.f.start)[0];
        // Mening sinovlarim: o'z lidlarim "Sinov darsida" (holati trialWorkflow'dan).
        const mineL = myLeads().filter(l => l.status === 'sinov-darsida').map(l => {
            const r = W().request(l); const at = local(r?.scheduledAt || l.trialLessonAt);
            return { l, r, at, ph: leadPhase(l) };
        }).filter(x => x.at).sort((a, b) => (a.at.date + hm(a.at.min)).localeCompare(b.at.date + hm(b.at.min)));
        const pend = mineL.filter(x => x.ph === 'pending');
        const kpi = (dot, label, val, sub) => `<div class="sv-kpi"><div class="sv-kl"><i class="sv-dot" style="background:${dot}"></i>${label}</div><b>${val}</b><span>${sub}</span></div>`;
        const nowM = U().nowMin();
        // Kun lentasi
        let H0 = 9 * 60, H1 = 21 * 60;
        for (const v of vDay) for (const x of [...v.work, ...v.items]) { H0 = Math.min(H0, Math.floor(x.start / 60) * 60); H1 = Math.max(H1, Math.ceil(x.end / 60) * 60); }
        for (const u of unDay) { H0 = Math.min(H0, Math.floor(u.start / 60) * 60); H1 = Math.max(H1, Math.ceil(u.end / 60) * 60); }
        // Ko'rinadigan oyna (dizayn "‹ 09:00–13:00 ›", RopJadval bilan bir xil 4 soat): bugun — hozirgi vaqtdan, aks holda birinchi ish soatidan.
        // "Butun kun" tugmasi bilan 07–22 to'liq. Bloklar kesilmaydi — har blok oynada keng ko'rinadi.
        const WIN = 240, full = [H0, H1], winFits = H1 - H0 > WIN;
        const clampW = w => Math.max(H0, Math.min(H1 - WIN, w));
        if (st.sWinDate !== date) {
            st.sWinDate = date;
            const firstWork = Math.min(...vDay.flatMap(v => v.work.map(w => w.start)), ...unDay.map(u => u.start), H1 - WIN);
            st.sWin = Math.floor(((date === today ? nowM - 60 : firstWork) / 60)) * 60;
        }
        let vr = full;
        const setVr = () => { vr = st.sWinAll || !winFits ? full : [clampW(st.sWin), clampW(st.sWin) + WIN]; };
        setVr();
        const pct = m => ((Math.max(vr[0], Math.min(vr[1], m)) - vr[0]) / (vr[1] - vr[0]) * 100);
        const pos = (s, e) => `left:${pct(s).toFixed(3)}%;width:calc(${(pct(e) - pct(s)).toFixed(3)}% - 3px)`;
        const leadName = id => allLeads().find(l => l.id === id)?.name || '';
        const hb = (s, e, cls, t, sub, attrs = '', title = '') => (e <= vr[0] || s >= vr[1]) ? '' : `<${attrs ? 'button type="button"' : 'div'} class="sv-hb ${cls}" style="${pos(s, e)}"${attrs} title="${esc(title || `${hm(s)}–${hm(e)} · ${t}${sub ? ' · ' + sub : ''}`)}">${esc(e - s >= 30 ? t : '')}${sub && e - s >= 60 ? `<small>${esc(sub)}</small>` : ''}</${attrs ? 'button' : 'div'}>`;
        const lane = v => {
            const out = [];
            for (const g of subtract([{ start: H0, end: H1 }], v.work)) out.push(hb(g.start, g.end, 'k-off', 'ish vaqti emas', ''));
            const busy = (v.items || []).filter(i => !(i.kind === 'lesson' && inside(v.trialFree, i.start, i.end)));
            const free = subtract(v.work, busy);
            for (const f of free) {
                for (const s of subtract([f], v.trialFree || [])) out.push(hb(s.start, s.end, 'k-cls', 'bo\'sh · yopiq', '', '', `${hm(s.start)}–${hm(s.end)} · bo'sh, sinovga yopiq`));
                for (const s of (v.trialFree || []).filter(x => overlaps(x, f))) {
                    const a = Math.max(s.start, f.start), b = Math.min(s.end, f.end);
                    const past = date < today || (date === today && b <= nowM);
                    out.push(hb(a, b, 'k-free' + (past ? ' is-past' : ''), b - a >= 60 ? 'sinovga ochiq' : 'sinovga', b - a >= 120 ? `${Math.floor((b - a) / 60)} s ${(b - a) % 60 ? (b - a) % 60 + ' daq' : ''}`.trim() : '', past ? '' : ` data-free="${esc(v.teacherId)}|${Math.max(a, date === today ? Math.ceil((nowM + 1) / 30) * 30 : a)}"`, `${hm(a)}–${hm(b)} · sinovga ochiq${past ? '' : ' — bosing'}`));
                }
            }
            for (const i of busy) {
                if (i.kind === 'trial') {
                    const nm = i.mine && i.leadId ? first(leadName(i.leadId)) : '';
                    out.push(i.status === 'hold' ? hb(i.start, i.end, 'k-hold', i.mine ? 'siz' : 'tanlanmoqda', '', '', `${hm(i.start)}–${hm(i.end)} · ${i.mine ? 'siz ushlab turibsiz' : 'boshqa menejer tanlayapti'}`)
                        : hb(i.start, i.end, 'k-tr' + (i.mine ? ' ss-mine' : ''), nm || 'Sinov', i.mine ? 'mening sinovim' : '', '', `${hm(i.start)}–${hm(i.end)} · ${i.mine ? `mening sinovim${nm ? ' · ' + nm : ''}` : 'sinov'}`));
                } else if (i.kind === 'close' || i.kind === 'leave') out.push(hb(i.start, i.end, 'k-cls', 'yopiq', ''));
                else out.push(hb(i.start, i.end, 'ss-busy', 'band', ''));
            }
            return out.join('');
        };
        const row = (label, track, cls = '') => `<div class="sv-hr ${cls}"><div class="sv-hl">${label}</div><div class="sv-ht2">${track}</div></div>`;
        const winBox = () => !winFits ? '' : `<div class="sv-win" role="group" aria-label="Vaqt oynasi"><button type="button" data-win="-1" aria-label="Oldingi soatlar"${!st.sWinAll && clampW(st.sWin) <= H0 ? ' disabled' : ''}>‹</button><button type="button" data-winall aria-pressed="${!!st.sWinAll}" title="${st.sWinAll ? '4 soatlik oynaga qaytish' : 'Butun kunni ko\'rsatish'}">${hm(vr[0])}–${hm(vr[1])}</button><button type="button" data-win="1" aria-label="Keyingi soatlar"${!st.sWinAll && clampW(st.sWin) >= H1 - WIN ? ' disabled' : ''}>›</button></div>`;
        const drawBoard = () => {
        let axis = ''; for (let h = Math.ceil(vr[0] / 60); h < vr[1] / 60; h++) axis += `<span style="left:${pct(h * 60).toFixed(3)}%">${String(h).padStart(2, '0')}:00</span>`;
        // "Biriktirilmagan" qatori doim (dizayn): ustozsiz sinovlar; oynadan tashqaridagilar — "→ HH:MM" tugmasi.
        const unOut = unDay.filter(u => u.end <= vr[0] || u.start >= vr[1]);
        const unTrack = unDay.map(u => hb(u.start, u.end, 'k-hold', u.mine ? first(u.leadName) || 'Sinov' : 'Sinov', 'ustoz kerak', '', `${hm(u.start)}–${hm(u.end)} · sinov · ustoz kerak${u.mine && u.leadName ? ' · ' + u.leadName : ''}`)).join('')
            + (unOut.length ? `<button type="button" class="sc-btn sc-btn--sm ss-unout" data-wingo="${unOut[0].start}">→ ${hm(unOut[0].start)}${unOut.length > 1 ? ` (+${unOut.length - 1})` : ''}</button>` : '')
            + (!unDay.length ? '<span class="ss-unnone">ustozsiz sinov yo\'q</span>' : '');
        const unRow = row(`<span><b>Biriktirilmagan</b><small>sinovlar · ${unDay.length}</small></span>`, unTrack, 'is-un');
        const tRows = vDay.map(v => row(`${U().staffAvatar(teachers.find(t => t.id === v.teacherId) || { id: v.teacherId }, 30)}<span><button type="button" class="sc-link" data-t="${esc(v.teacherId)}">${esc(tn(v.teacherId))}</button><small>${v.items.filter(i => i.kind === 'lesson').length} dars · ${hrs(openOf(v))} ochiq</small></span>`, lane(v),
            v.items.some(i => i.kind === 'trial' && i.mine) ? 'ss-rmine' : '')).join('');
        const nowLine = date === today && nowM >= vr[0] && nowM <= vr[1] ? `<i class="sv-hnow" style="left:calc(var(--hl) + (100% - var(--hl)) * ${(pct(nowM) / 100).toFixed(4)})"><em>${hm(nowM)}</em></i>` : '';
        return vDay.length || unDay.length ? `<div class="sv-hw"><div class="sv-hbd"><div class="sv-hr sv-hax"><div class="sv-hl">Ustoz</div><div class="sv-ht2">${axis}</div></div>${unRow}${tRows}${nowLine}</div></div>`
            : '<p class="sc-mt sv-pp">Bu kunda ish vaqti belgilangan ustoz yo\'q.</p>';
        };
        const top = vTom.map(v => ({ v, m: openOf(v) })).filter(x => x.m > 0).sort((a, b) => b.m - a.m).slice(0, 3);
        const pill = ph => { const x = W().PHASES[ph] || { label: ph, tone: 'mute' }; return `<span class="sc-pill sc-pill--${x.tone}">${esc(x.label)}</span>`; };
        const mineRow = x => {
            const tid = String(x.r?.teacherId || x.l.paymentOnboarding?.teacherId || '');
            const sub = x.ph === 'unassigned' ? 'adminga yuborilgan · ustoz kerak' : x.ph === 'rejected' ? `${short(tn(tid))} rad etdi · ${x.r?.reasonLabel || ''}${x.r?.proposals?.length ? ` · taklif: ${x.r.proposals.map(local).filter(Boolean).map(a => `${U().DAY[U().wd(a.date) - 1]} ${hm(a.min)}`).join(', ')}` : ''}${x.r?.rejectNote ? ` · "${x.r.rejectNote}"` : ''}`
                : x.ph === 'done' || x.ph === 'noshow' ? `${short(tn(tid))}${x.r?.reasonLabel ? ' · ' + x.r.reasonLabel : ''}${x.r?.resultNote ? ` · "${x.r.resultNote}"` : ''}` : short(tn(tid));
            const act = ['rejected', 'overdue', 'noshow'].includes(x.ph) ? `<button type="button" class="sc-btn sc-btn--sm" data-re="${esc(x.l._lang)}|${esc(x.l.id)}">${x.ph === 'rejected' ? 'Qayta qo\'yish' : 'Boshqa vaqt'}</button>` : '';
            return `<div class="sv-li sv-wrapli"><span class="sv-tm">${x.at.date === today ? '' : `<small>${U().DAY[U().wd(x.at.date) - 1]} ${Number(x.at.date.slice(8))}</small>`}${hm(x.at.min)}</span><span class="sc-grow"><b>${esc(x.l.name)}</b><small>${esc(sub)}</small></span>${pill(x.ph)}${act ? `<span class="sv-acts">${act}</span>` : ''}</div>`;
        };
        body.innerHTML = `<div class="sv-kpis ss-k4">${kpi('#12B76A', 'Bugun sinovga ochiq', hrs(todayOpen), `${hm(nowM)} dan keyin · ${todayN} ustoz`)}
            ${kpi('#12B76A', `Ertaga · ${dayShort(tom)}`, hrs(tomOpen), tomFirst ? `eng erta ${hm(tomFirst.f.start)} · ${esc(short(tn(tomFirst.v.teacherId)))}` : 'sinovga ochiq vaqt yo\'q')}
            ${kpi('#7A5AF8', 'Mening sinovlarim', mineL.length, mineL.length ? esc(mineL.slice(0, 3).map(x => first(x.l.name) + (x.ph === 'unassigned' ? ' (ustozsiz)' : '')).join(' · ')) : 'hozircha yo\'q')}
            ${kpi('#F79009', 'Tasdiq kutilmoqda', pend.length, pend.length ? esc(`${first(pend[0].l.name)} · ${short(tn(String(pend[0].r?.teacherId || '')))} hali tasdiqlamagan`) : 'hammasi ko\'rib chiqilgan')}</div>
          <section class="sc-card sv-board"><header class="sv-bh"><h2>${date === today ? 'Bugun' : esc(lbl(date))} · ustozlar bo'yicha</h2><span data-winbox>${winBox()}</span><span class="sc-grow"></span>
            <span class="sc-pill sc-pill--ok ss-jhint">Yashil joyni bosing → sinov qo'yish oynasi shu vaqt bilan ochiladi</span></header>
            <div data-board>${drawBoard()}</div>
            <div class="sv-lg"><span><i class="sv-sq ss-sq-b"></i>Band (dars)</span><span><i class="sv-sq k-tr"></i>Sinov</span><span><i class="sv-sq k-free"></i>Sinovga ochiq</span><span><i class="sv-sq k-hold"></i>Tanlanmoqda / ustoz kutilmoqda</span><span><i class="sv-sq k-cls"></i>Sinovga yopiq</span><span><i class="sv-sq k-off"></i>Ish vaqti emas</span><button type="button" class="sc-link sv-rlink" data-rules>Jadval qoidalari →</button></div></section>
          <div class="sv-g3">
            <section class="sc-card sv-pn"><h3 class="sv-ph">Mening sinovlarim${me().name ? ' · ' + esc(first(me().name)) : ''}</h3>${mineL.map(mineRow).join('') || '<p class="sc-mt sv-pp">"Sinov darsida" bosqichida lidingiz yo\'q</p>'}</section>
            <section class="sc-card sv-pn"><h3 class="sv-ph">Ertaga eng ko'p ochiq</h3>${top.map(x => `<div class="sv-li"><span class="sv-tm">${hrsS(x.m)}</span><span class="sc-grow"><b>${esc(tn(x.v.teacherId))}</b><small>${esc((x.v.trialFree || []).slice(0, 2).map(f => `${hm(f.start)}–${hm(f.end)}`).join(', '))}${(x.v.trialFree || []).length > 2 ? ' …' : ''}</small></span></div>`).join('') || '<p class="sc-mt sv-pp">Ertaga sinovga ochiq vaqt yo\'q</p>'}</section>
            <section class="sc-card sv-pn"><h3 class="sv-ph">Qoida</h3><p class="sv-pp ss-rule">Siz faqat <b>sinovga ochiq</b> vaqtni band qila olasiz. Vaqt 10 daqiqa siz uchun ushlab turiladi. Ustoz tasdiqlagach lidga xabar boradi. Natija yozilgach sinov jadvaldan chiqadi.</p></section>
          </div>`;
        const bindBoard = () => {
            body.querySelectorAll('[data-free]').forEach(b => b.onclick = () => { const [t, m] = b.dataset.free.split('|'); open({ lang, from: 'schedule', onClose: reload, preset: { teacherId: t, date, min: Number(m) } }); });
            body.querySelectorAll('[data-board] [data-t]').forEach(b => b.onclick = () => open({ lang, from: 'schedule', onClose: reload, preset: { teacherId: b.dataset.t, date, min: date === today ? nowM : 0 } }));
            body.querySelectorAll('[data-win]').forEach(b => b.onclick = () => { if (st.sWinAll) st.sWinAll = false; else st.sWin = clampW(clampW(st.sWin) + Number(b.dataset.win) * 120); redrawBoard(); });
            body.querySelector('[data-winall]')?.addEventListener('click', () => { st.sWinAll = !st.sWinAll; redrawBoard(); });
            body.querySelectorAll('[data-wingo]').forEach(b => b.onclick = () => { st.sWinAll = false; st.sWin = clampW(Math.floor((Number(b.dataset.wingo) - 60) / 60) * 60); redrawBoard(); });
        };
        const redrawBoard = () => { setVr(); body.querySelector('[data-board]').innerHTML = drawBoard(); const wb = body.querySelector('[data-winbox]'); if (wb) wb.innerHTML = winBox(); bindBoard(); };
        bindBoard();
        body.querySelector('[data-rules]')?.addEventListener('click', () => (window.scheduleV2?.rulesDrawer ? window.scheduleV2.rulesDrawer() : window.jadvalQoidalar?.open()));
        body.querySelectorAll('[data-re]').forEach(b => b.onclick = () => { const [lg, id] = b.dataset.re.split('|'); open({ lang: lg, leadId: id, from: 'schedule', onClose: reload, isReschedule: true }); });
    }

    window.sotuvSinov = { enabled, open, close, renderJadval, from: () => P?.from || null, _t: { trialDates, patternDays, merge, subtract } };
})();
