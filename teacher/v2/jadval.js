// Ustoz ilovasi v2 — Jadval bo'limi (dizayn: S1, S1e, S2, S3, S4, S5, SinovNatija, P1, P2, P3).
//   U.tab('jadval')        — "Sinov darslari" (Bugun · Ertaga · Tanaffus) | "Darslar" (15 daqiqalik to'r, faqat ko'rish)
//   U.lock('sinov')        — yangi sinov qo'yilganda ilova qulf: Qabul qilaman / Bu vaqtda o'ta olmayman (sabab + taklif vaqtlar)
//   U.page('jd-tarix')     — sinovlar tarixi (/api/trial-lessons/history)
//   U.jadval.openTanaffus() — Menyu'dagi "Tanaffus" plitkasi uchun
// Mantiq manbasi — eski ilova (teacher/app.js: PAGES.sinov, trialSend, openSinovRad, PAGES.jadval) va server
// (js/trialWorkflow.js transition, server/services/school/schedule.js addBreak/removeBreak).
(function () {
    'use strict';
    const U = window.U;
    const D = () => window.DWT;
    const W = () => window.trialWorkflow || {};
    const esc = s => D().esc(s);
    const hm = m => D().hm(m);

    // ── Holat ──
    let tab = 'sinov', filter = 'bugun', mode = 'kun', selDate = null;
    const lk = { id: null, step: 'ask', done: null, reason: null, props: [], note: '', busy: false, shown: '' };

    // ── Yordamchilar ──
    const today = () => D().now().date;
    const tomorrow = () => U.addDays(today(), 1);
    const weekStart = date => U.addDays(date, 1 - D().wdOf(date));
    const trials = () => D().S.trials || [];
    const tReq = l => D().tReq(l);
    const tAt = l => D().tAt(l);
    const phase = l => D().trialPhase(l);
    const dur = l => Number(l?.durationMin) || 30;
    const mgrName = l => D().first(l?.managerName || D().trialManager(l) || '');
    const LANG = { english: 'Ingliz tili', russian: 'Rus tili', ingliz: 'Ingliz tili', rus: 'Rus tili' };
    const fmtShort = date => D().fmtDate(date); // 16-noy
    const range = (a, b) => `${hm(a)}–${hm(b)}`;
    const rangeSp = (a, b) => `${hm(a)} – ${hm(b)}`;
    const isoAt = (date, min) => new Date(Date.parse(`${date}T00:00:00Z`) + (min - 300) * 60000).toISOString();
    function stubLabel(date) {
        const t = today();
        if (date === t) return 'Bugun';
        if (date === U.addDays(t, -1)) return 'Kecha';
        if (date < t) return fmtShort(date);
        return D().DAY_FULL[D().wdOf(date) - 1];
    }
    function relLabel(date) {
        const t = today();
        return date === t ? 'Bugun' : date === U.addDays(t, 1) ? 'Ertaga' : date === U.addDays(t, -1) ? 'Kecha' : `${D().DAY[D().wdOf(date) - 1]} ${fmtShort(date)}`;
    }
    function left(min) {
        const h = Math.floor(min / 60), m = min % 60;
        return h ? `${h} soat${m ? ` ${m} daq` : ''} qoldi` : `${m} daq qoldi`;
    }
    const wish = l => {
        const c = (l.comments || []).filter(x => x.type === 'trial-lesson').slice(-1)[0];
        const m = /Lid istagi:\s*(.+)/.exec(c?.text || '');
        return m ? m[1].trim() : '';
    };
    const myViews = data => Object.fromEntries((data?.views || []).filter(v => !D().S.me || !v.teacherId || v.teacherId === D().S.me.id).map(v => [v.date, v]));
    const ICO = {
        chev: '<path d="M9 6l6 6-6 6"></path>',
        cal: '<rect x="3" y="4.5" width="18" height="16" rx="3"></rect><path d="M3 9.5h18M8 3v3M16 3v3M9 15l2 2 4-4"></path>',
        check: '<path d="M5 12l5 5L20 7"></path>',
        back: '<path d="M15 18l-6-6 6-6"></path>'
    };
    async function trialPost(l, payload) {
        const r = await U.api(`/api/trial-lessons/${encodeURIComponent(l.id)}`, { method: 'POST', body: { requestId: tReq(l).id, ...payload } });
        const S = D().S;
        const i = (S.trials || []).findIndex(x => x.id === l.id);
        if (i >= 0 && r.lesson) S.trials[i] = r.lesson;
        U.drop('jd:');
        return r.lesson || l;
    }
    // Ro'yxat yuklanmagan bo'lsa (S.trials === null) — qayta yuklash.
    function trialsState() {
        if (D().S.trials) return { data: D().S.trials };
        return U.load('jd:trials', () => U.api('/api/trial-lessons').then(r => { D().S.trials = r.lessons || []; return D().S.trials; }));
    }
    const historyLoad = () => U.load('jd:hist', () => U.api('/api/trial-lessons/history?days=60').then(r => r.history || []), { ttl: 120000 });

    // ── Sarlavha va yuqori tablar ──
    function header(right = '') {
        const n = D().now();
        return `<header class="hd" style="padding-bottom: 4px"><div class="t"><span class="date">${esc(U.dateLong(n.date))}${tab === 'sinov' ? ` · ${hm(n.min)}` : ''}</span><h1 style="font-size: 26px">Jadval</h1></div>${right}</header>`;
    }
    const activeCount = () => trials().filter(l => ['pending', 'upcoming', 'result'].includes(phase(l))).length;
    function tabs2() {
        const c = activeCount();
        return `<nav class="jd-tabs2" role="tablist" aria-label="Jadval bo'limlari"><button type="button" role="tab" data-jd-tab="sinov" aria-selected="${tab === 'sinov'}" class="${tab === 'sinov' ? 'on' : ''}">Sinov darslari${c ? `<span class="c">${c}</span>` : ''}</button><button type="button" role="tab" data-jd-tab="darslar" aria-selected="${tab === 'darslar'}" class="${tab === 'darslar' ? 'on' : ''}">Darslar</button></nav>`;
    }

    // ── Sinov darslari: Bugun / Ertaga ──
    function groupsFor(date) {
        const all = trials();
        const at = l => tAt(l);
        const isDay = l => at(l)?.date === date;
        const byTime = (a, b) => String(tReq(a).scheduledAt).localeCompare(String(tReq(b).scheduledAt));
        const result = date === today() ? all.filter(l => phase(l) === 'result').sort(byTime) : [];
        const wait = all.filter(l => isDay(l) && ['pending', 'upcoming'].includes(phase(l))).sort(byTime);
        const done = all.filter(l => isDay(l) && phase(l) === 'past');
        const h = historyLoad().data || [];
        for (const x of h) {
            const r = x.trialRequest || {};
            if (tD(r.scheduledAt) !== date) continue;
            if (all.some(l => l.id === x.leadId && tReq(l).id === r.id)) continue;
            if (!['done', 'noshow', 'rejected'].includes(x.phase)) continue;
            done.push({ id: x.id, name: x.name, managerName: x.managerName, trialRequest: r, hist: x.phase });
        }
        done.sort(byTime);
        return { result, wait, done };
    }
    const tD = iso => D().tz(iso)?.date || '';
    const countFor = date => { const g = groupsFor(date); return g.result.length + g.wait.length + g.done.length; };
    function ticket(l, kind) {
        const a = tAt(l), r = tReq(l), m = mgrName(l);
        const cls = kind === 'result' ? 's-w' : kind === 'wait' ? 's-v' : r.state === 'rejected' || l.hist === 'rejected' ? 's-m' : r.attended === false || l.hist === 'noshow' ? 's-r' : 's-g';
        let act = '';
        if (kind === 'result') act = `<button type="button" class="btn sm jd-res" data-jd-natija="${esc(l.id)}">Natija yozish</button>`;
        else if (kind === 'wait') {
            const n = D().now();
            if (phase(l) === 'pending') act = '<span class="pill wa" style="align-self: flex-start">Javob kutilmoqda</span>';
            else if (a && a.date === n.date) act = `<span class="pill vio" style="align-self: flex-start">${left(Math.max(1, a.min - n.min))}</span>`;
            else act = '<span class="pill inf" style="align-self: flex-start">Tasdiqlangan</span>';
        } else {
            const st = l.hist || (r.state === 'rejected' ? 'rejected' : r.attended ? 'done' : 'noshow');
            act = st === 'rejected' ? `<span class="pill mu" style="align-self: flex-start">Rad etildi${r.reasonLabel ? ' · ' + esc(r.reasonLabel) : ''}</span>`
                : st === 'noshow' ? `<span class="pill bad" style="align-self: flex-start">Lid kelmadi · natija yuborildi</span>`
                    : '<span class="pill ok" style="align-self: flex-start">O\'tkazildi · natija yuborildi</span>';
        }
        return `<div class="jd-tk"><div class="jd-stub ${cls}"><span>${a ? esc(stubLabel(a.date)) : ''}</span><strong>${a ? hm(a.min) : '—'}</strong><span>${dur(l)} daq${r.daysCount > 1 ? ` · ${r.daysCount} kun` : ''}</span></div><div class="jd-cut"></div><div class="jd-tb"><span class="nm" style="font-size: 15px">${esc(l.name || 'Lid')}</span>${m ? `<span class="s">menejer ${esc(m)}</span>` : ''}${act}</div></div>`;
    }
    const sh3 = (color, title, n) => `<div class="jd-sh3"><i style="background: ${color}"></i><b>${title}</b><span class="xs b">${n}</span></div>`;
    function sinovList(date) {
        const st = trialsState();
        if (!st.data) return st.err ? U.err(st, 'jd:trials') : U.skel(2, 96);
        const g = groupsFor(date);
        let html = '';
        if (g.result.length) html += sh3('#F79009', 'NATIJA YOZISH KERAK', g.result.length) + g.result.map(l => ticket(l, 'result')).join('');
        if (g.wait.length) html += sh3('#7F56D9', 'KUTILMOQDA', g.wait.length) + g.wait.map(l => ticket(l, 'wait')).join('');
        if (g.done.length) html += sh3('#12B76A', 'YAKUNLANGAN', g.done.length) + g.done.map(l => ticket(l, 'done')).join('');
        if (!html) html = `<div class="card" style="align-items: center; text-align: center; padding: 18px; color: #4B5563; font-size: 13px">${date === today() ? "Bugun sinov darsi yo'q" : "Ertaga sinov darsi yo'q"}</div>`;
        else if (date !== today() && !g.result.length) html += '<div class="card" style="align-items: center; text-align: center; padding: 18px; color: #4B5563; font-size: 13px">Natija dars tugagach shu yerda so\'raladi</div>';
        return html;
    }

    // ── Tanaffus (P1, P3) ──
    const tfKey = () => `jd:tf:${today()}`;
    const tfLoad = () => U.load(tfKey(), () => U.api(`/api/school/schedule?from=${today()}&to=${tomorrow()}`));
    // Admin sinovga ochgan vaqtlar: bo'sh (trialFree) + sinov qo'yilgan + tanaffus olingan. Bugungi o'tgan vaqt ko'rsatilmaydi.
    function tfRows(v, date) {
        if (!v) return [];
        const n = D().now(), isToday = date === n.date;
        const cut = isToday ? Math.ceil(n.min / 30) * 30 : 0;
        const rows = [];
        for (const f of v.trialFree || []) {
            let a = Math.max(f.start, cut);
            while (a < f.end) {
                let b = Math.min(f.end, (Math.floor(a / 60) + 1) * 60);
                if (f.end - b < 30) b = f.end;
                if (b - a >= 15) rows.push({ kind: 'free', start: a, end: b });
                a = b;
            }
        }
        const byLead = Object.fromEntries(trials().map(l => [l.id, l]));
        for (const i of v.items || []) {
            if (isToday && i.end <= n.min) continue;
            if (i.kind === 'trial' && !['cancelled', 'rejected', 'done', 'no_show'].includes(i.status)) {
                const l = byLead[i.leadId];
                rows.push({ kind: 'trial', start: i.start, end: i.end, name: l ? D().first(l.name) : '' });
            } else if (i.kind === 'break') rows.push({ kind: 'break', start: i.start, end: i.end, id: i.overrideId, reason: i.reason, reasonCode: i.reasonCode, note: i.note });
        }
        return rows.sort((a, b) => a.start - b.start);
    }
    function slotRow(r) {
        if (r.kind === 'trial') return `<div class="jd-slot"><b>${rangeSp(r.start, r.end)}</b><span class="s g1">${r.name ? esc(r.name) + ' sinovi' : 'sinov'}</span><span class="pill vio">Sinov bor</span></div>`;
        if (r.kind === 'break') return `<div class="jd-slot jd-stripe"><b>${rangeSp(r.start, r.end)}</b><span class="s g1">siz oldingiz</span><span class="pill jd-ptn">Tanaffus</span></div>`;
        return `<div class="jd-slot"><b>${rangeSp(r.start, r.end)}</b><span class="s g1">ochiq</span><span class="pill ok">Bo'sh</span></div>`;
    }
    function tanaffusView() {
        const c = tfLoad();
        if (!c.data) return c.err ? U.err(c, tfKey()) : U.skel(2, 140);
        const by = myViews(c.data), t = today(), e = tomorrow();
        const days = [[t, by[t]], [e, by[e]]];
        let cards = '', free = 0;
        for (const [date, v] of days) for (const r of tfRows(v, date)) {
            if (r.kind === 'free') free++;
            if (r.kind !== 'break') continue;
            const sub = `${esc(r.reason || 'Tanaffus')}${r.note ? ` · «${esc(r.note)}»` : ''}`;
            cards += `<section class="card a1" style="background: #FFF4E5; border: 1.5px solid #FDBA74; gap: 10px">
<div class="row"><span class="jd-pz" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5"></rect><rect x="14" y="5" width="4" height="14" rx="1.5"></rect></svg></span><div class="col g1"><b style="font-size: 16px; color: #7A2E0E">${date === t ? 'Tanaffusdasiz' : 'Ertaga tanaffus'} · ${range(r.start, r.end)}</b><span class="s" style="color: #9A3412">${sub}</span></div></div>
<button type="button" class="btn w" style="height: 46px; color: #C4320A; border-color: #FDBA74" data-jd-unbreak="${esc(r.id)}">Tanaffusni bekor qilish</button></section>`;
        }
        const sec = (date, v, i) => {
            const rows = tfRows(v, date);
            const title = date === t ? 'BUGUN · SINOVGA OCHIQ VAQTLARINGIZ' : `ERTAGA · ${esc(U.dateLong(date).toUpperCase())}`;
            const body = rows.length ? `<div class="card l a${i + 1}" style="${i ? 'padding: 2px 14px; flex: none' : 'padding: 0'}">${rows.map(slotRow).join('')}</div>`
                : `<div class="card" style="align-items: center; text-align: center; padding: 16px; color: #4B5563; font-size: 13px">${!v ? 'Jadval topilmadi' : v.work?.length ? 'Sinovga ochiq vaqt qolmadi' : 'Bu kunda admin sinovga vaqt ochmagan'}</div>`;
            return sh3(date === t ? '#12B76A' : '#94A3B8', title, rows.length) + body;
        };
        return `${cards}${days.map(([d, v], i) => sec(d, v, i)).join('')}
${free ? `<div style="display: grid; grid-template-columns: 1fr; gap: 8px; flex: none"><button type="button" class="btn w" style="height: 52px; background: #C4320A; border-color: #C4320A; color: #FFFFFF" data-jd-break="whole">Butun kunga tanaffus</button><button type="button" class="btn w" style="height: 50px; color: #C4320A; border-color: #FDBA74" data-jd-break="slots">Faqat ma'lum vaqtga</button></div>` : ''}
<div class="note i" style="padding: 10px 12px"><span>Tanaffusdagi vaqtga sotuv bo'limi sinov qo'ya olmaydi. Sinov qo'yilgan vaqtga tanaffus olinmaydi.</span></div>`;
    }

    // ── P2: Sinovga tanaffus olish oynasi ──
    const BREAK_FALLBACK = [['tired', 'Charchadim / dam olish'], ['health', "Sog'lig'im"], ['family', 'Oilaviy ish'], ['study', "O'qish / tayyorgarlik"], ['other', 'Boshqa sabab']].map(([code, label]) => ({ code, label }));
    let breakReasons = null;
    function openBreak(whole) {
        const c = tfLoad();
        if (!c.data) { U.toast(c.err ? (c.err.message || 'Jadval yuklanmadi') : 'Jadval yuklanmoqda…'); return; }
        const by = myViews(c.data), t = today(), e = tomorrow();
        const freeOf = d => tfRows(by[d], d).filter(r => r.kind === 'free');
        const st = { day: freeOf(t).length ? t : e, whole: !!whole, sel: new Set(), reason: null, note: '', busy: false };
        if (!breakReasons) U.api('/api/school/breaks/reasons').then(r => { if (r.reasons?.length) { breakReasons = r.reasons; draw?.(); } }).catch(() => {});
        let draw = null;
        U.sheet('<div class="jd-shw"></div>', (el, close) => {
            el.style.top = '70px'; el.style.gap = '12px';
            const box = el.querySelector('.jd-shw');
            draw = () => {
                const rows = tfRows(by[st.day], st.day), free = rows.filter(r => r.kind === 'free');
                const key = r => `${r.start}-${r.end}`;
                for (const k of [...st.sel]) if (!free.some(r => key(r) === k)) st.sel.delete(k);
                const chosen = st.whole ? free : free.filter(r => st.sel.has(key(r)));
                const merged = [];
                for (const r of chosen) { const p = merged[merged.length - 1]; if (p && p.end === r.start) p.end = r.end; else merged.push({ start: r.start, end: r.end }); }
                const reasons = breakReasons || BREAK_FALLBACK;
                const other = st.reason === 'other';
                const ok = merged.length && st.reason && (!other || st.note.trim().length >= 3) && !st.busy;
                const label = !merged.length ? 'Tanaffus olish' : st.whole && !rows.some(r => r.kind !== 'free') ? 'Tanaffus olish · butun kun' : merged.length > 2 ? `Tanaffus olish · ${merged.length} ta vaqt` : `Tanaffus olish · ${merged.map(r => range(r.start, r.end)).join(', ')}`;
                box.innerHTML = `<div class="col"><h2 id="jd-p2" style="font-size: 20px; font-weight: 800">Sinovga tanaffus</h2><span class="s">Admin ochgan sinov vaqtlaringizdan</span></div>
<div class="seg" role="tablist" style="background: #E9EEF6">${[t, e].map(d => `<button type="button" role="tab" data-d="${d}" aria-selected="${st.day === d}" class="${st.day === d ? 'on' : ''}">${d === t ? 'Bugun' : 'Ertaga'} · ${fmtShort(d)}</button>`).join('')}</div>
<div class="seg" role="tablist" style="background: #E9EEF6"><button type="button" role="tab" data-w="1" aria-selected="${st.whole}" class="${st.whole ? 'on' : ''}">Butun kun</button><button type="button" role="tab" data-w="0" aria-selected="${!st.whole}" class="${!st.whole ? 'on' : ''}">Ma'lum vaqt</button></div>
${!rows.length ? `<div class="note w" style="padding: 10px 12px"><span>${!by[st.day] ? 'Jadval topilmadi' : 'Bu kunda sinovga ochiq vaqt yo\'q'}</span></div>`
    : st.whole ? `<span class="jd-st">SINOVGA YOPILADI</span><div class="card l" style="padding: 0">${rows.map(r => r.kind === 'free'
        ? `<div class="jd-slot" style="background: #FFF4E5"><span class="jd-chk on" aria-hidden="true">${U.svg(ICO.check, 14, 3.5)}</span><b>${rangeSp(r.start, r.end)}</b><span class="s">tanlandi</span></div>`
        : `<div class="jd-slot" style="opacity: .5"><span class="jd-chk" aria-hidden="true" style="background: #F1F5F9"></span><b>${rangeSp(r.start, r.end)}</b><span class="s">${r.kind === 'trial' ? 'sinov bor' : 'tanaffusda'}</span></div>`).join('')}</div>`
    : `<span class="jd-st" id="jd-qv">QAYSI VAQTLAR?</span><div class="card l" style="padding: 0" role="group" aria-labelledby="jd-qv">${rows.map(r => {
        if (r.kind !== 'free') return `<div class="jd-slot" style="opacity: .5"><span class="jd-chk" aria-hidden="true" style="background: #F1F5F9"></span><b>${rangeSp(r.start, r.end)}</b><span class="s">${r.kind === 'trial' ? 'sinov bor' : 'tanaffusda'}</span></div>`;
        const on = st.sel.has(key(r));
        return `<button type="button" class="jd-slot jd-slotb" role="checkbox" aria-checked="${on}" data-k="${key(r)}"${on ? ' style="background: #FFF4E5"' : ''}><span class="jd-chk${on ? ' on' : ''}" aria-hidden="true">${on ? U.svg(ICO.check, 14, 3.5) : ''}</span><b>${rangeSp(r.start, r.end)}</b><span class="s">${on ? 'tanlandi' : "bo'sh"}</span></button>`;
    }).join('')}</div>`}
<span class="jd-st" id="jd-sb">SABAB · MAJBURIY</span>
<div class="chips" style="flex-wrap: wrap" role="radiogroup" aria-labelledby="jd-sb">${reasons.map(r => `<button type="button" role="radio" aria-checked="${st.reason === r.code}" class="chip${st.reason === r.code ? ' on' : ''}" data-r="${esc(r.code)}">${esc(r.label)}</button>`).join('')}</div>
<div class="fl"><label for="jd-tz">Izoh${other ? ' · majburiy' : ''}</label><input id="jd-tz" type="text" maxlength="300" value="${esc(st.note)}" placeholder="${other ? 'Sababni qisqacha yozing' : 'ixtiyoriy'}"></div>
<button type="button" class="btn w" data-go style="height: 54px; font-size: 16px; background: #C4320A; border-color: #C4320A; color: #FFFFFF; margin-top: auto${ok ? '' : '; opacity: .5'}"${ok ? '' : ' aria-disabled="true"'}>${label}</button>
<span class="xs" style="text-align: center">Admin va ROP'ga Telegram orqali darhol xabar boradi</span>`;
                el.setAttribute('aria-labelledby', 'jd-p2');
                box.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { st.day = b.dataset.d; st.sel.clear(); draw(); });
                box.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { st.whole = b.dataset.w === '1'; draw(); });
                box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const k = b.dataset.k; st.sel.has(k) ? st.sel.delete(k) : st.sel.add(k); draw(); box.querySelector(`[data-k="${k}"]`)?.focus(); });
                box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { st.reason = b.dataset.r; draw(); });
                const inp = box.querySelector('#jd-tz');
                inp.oninput = () => {
                    st.note = inp.value;
                    const go = box.querySelector('[data-go]'), can = merged.length && st.reason && (st.reason !== 'other' || st.note.trim().length >= 3);
                    go.style.opacity = can ? '' : '.5'; can ? go.removeAttribute('aria-disabled') : go.setAttribute('aria-disabled', 'true');
                };
                box.querySelector('[data-go]').onclick = async () => {
                    if (st.busy) return;
                    if (!merged.length) return U.toast(st.whole ? "Bu kunda bo'sh sinov vaqti yo'q" : 'Vaqtni tanlang');
                    if (!st.reason) return U.toast('Sababni tanlang');
                    if (st.reason === 'other' && st.note.trim().length < 3) return U.toast('"Boshqa sabab" uchun izoh yozing');
                    st.busy = true; draw();
                    // Butun kun: kunda sinov yoki tanaffus bo'lmasa — wholeDay; aks holda bo'sh vaqtlar ro'yxati (server sinovli vaqtni rad etadi).
                    const pure = st.whole && !rows.some(r => r.kind !== 'free');
                    const body = { date: st.day, ...(pure ? { wholeDay: true } : { slots: merged.map(r => ({ from: hm(r.start), to: hm(r.end) })) }), reasonCode: st.reason, ...(st.note.trim() ? { note: st.note.trim() } : {}) };
                    try {
                        await U.api('/api/school/breaks', { method: 'POST', body });
                        U.drop('jd:tf'); U.drop('jd:sch'); close();
                        U.toast(`Tanaffus olindi · ${pure ? 'butun kun' : merged.map(r => range(r.start, r.end)).join(', ')}`, { ok: true });
                        U.render();
                    } catch (err) { st.busy = false; U.toast(err.message || 'Saqlanmadi'); if (err.status === 409) { U.drop('jd:tf'); } draw(); }
                };
            };
            draw();
        }, { label: 'Sinovga tanaffus' });
    }
    async function unbreak(id, btn) {
        if (btn) btn.disabled = true;
        try {
            await U.api(`/api/school/breaks/${encodeURIComponent(id)}`, { method: 'DELETE' });
            U.drop('jd:tf'); U.drop('jd:sch');
            U.toast('Tanaffus bekor qilindi · vaqt sinovga ochildi', { ok: true });
            U.render();
        } catch (err) { if (btn) btn.disabled = false; U.toast(err.message || 'Bekor qilinmadi'); }
    }

    // ── SinovNatija: natija yozish (eski ilova: trialSend / openSinovRad 'noshow') ──
    function openNatija(id) {
        const l = trials().find(x => x.id === id); if (!l) return;
        const a = tAt(l), m = mgrName(l);
        const reasons = (D().REASONS || W().REASONS || []).filter(r => r.id !== 'teacher-late');
        const st = { attended: true, reason: 'student-missed', note: '', busy: false };
        U.sheet('<div class="jd-shw"></div>', (el, close) => {
            el.style.top = '150px'; el.style.gap = '14px'; el.setAttribute('aria-labelledby', 'jd-sn');
            const box = el.querySelector('.jd-shw');
            const draw = () => {
                box.innerHTML = `<div class="row"><span class="vio jd-nb" aria-hidden="true">${a ? esc(relLabel(a.date)) : ''}<b>${a ? hm(a.min) : ''}</b></span><div class="col g1"><h2 id="jd-sn" style="font-size: 20px; font-weight: 800">Dars o'tdi — natijani belgilang</h2><span class="s">${esc(l.name)} · ${dur(l)} daq${m ? ` · menejer ${esc(m)}` : ''}</span></div></div>
<span class="jd-st">DARS BO'LDIMI?</span>
<div class="seg jd-seg44" role="radiogroup" aria-label="Dars bo'ldimi?"><button type="button" role="radio" data-a="1" aria-checked="${st.attended}" class="${st.attended ? 'on' : ''}">O'tkazildi</button><button type="button" role="radio" data-a="0" aria-checked="${!st.attended}" class="${!st.attended ? 'on' : ''}">Lid kelmadi</button></div>
${st.attended ? '' : `<span class="jd-st" id="jd-nr">SABAB · MAJBURIY</span><div class="chips" style="flex-wrap: wrap" role="radiogroup" aria-labelledby="jd-nr">${reasons.map(r => `<button type="button" role="radio" aria-checked="${st.reason === r.id}" class="chip${st.reason === r.id ? ' on' : ''}" data-r="${esc(r.id)}">${esc(r.label)}</button>`).join('')}</div>`}
<div class="fl"><label for="jd-iz">Menejer uchun izoh</label><textarea id="jd-iz" maxlength="1000" style="height: 96px" placeholder="${st.attended ? "Daraja, qiziqishi, qaysi vaqt mos" : 'ixtiyoriy'}">${esc(st.note)}</textarea><span class="xs">Daraja, qiziqishi va qaysi vaqt mos keladi</span></div>
<button type="button" class="btn p w" data-go style="height: 54px; font-size: 16px; color: #FFFFFF; margin-top: auto"${st.busy ? ' disabled' : ''}>Saqlash</button>
<span class="xs" style="text-align: center">"Lid kelmadi" tanlansa sabab so'raladi · o'quvchiga baho ko'rsatilmaydi</span>`;
                const ta = box.querySelector('#jd-iz'); ta.oninput = () => { st.note = ta.value; };
                box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { st.attended = b.dataset.a === '1'; draw(); });
                box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { st.reason = b.dataset.r; draw(); });
                box.querySelector('[data-go]').onclick = async () => {
                    if (st.busy) return;
                    if (!st.attended && !st.reason) return U.toast('Sababni tanlang');
                    st.busy = true; draw();
                    const note = st.note.trim();
                    const payload = st.attended ? { action: 'outcome', attended: true } : { action: 'outcome', attended: st.reason === 'attended-wants-other-teacher', reasonId: st.reason };
                    try {
                        await trialPost(l, { ...payload, ...(note ? { note } : {}) });
                        close(); U.toast('Natija yozildi · menejerga yuborildi', { ok: true }); U.render();
                    } catch (err) { st.busy = false; U.toast(err.message || 'Saqlanmadi'); draw(); }
                };
            };
            draw();
        }, { label: 'Sinov natijasi' });
    }

    // ── Darslar (S2): kun — 15 daqiqalik to'r, hafta — ro'yxat. Faqat ko'rish. ──
    const PX = 1.6; // 1 daqiqa = 1.6px (15 daq = 24px)
    const schLoad = ws => U.load(`jd:sch:${ws}`, () => U.api(`/api/school/schedule?from=${ws}&to=${U.addDays(ws, 6)}`));
    const GRID_KINDS = ['lesson', 'reserved', 'makeup', 'trial'];
    function lessonState(i, date) {
        const s = D().stuOf(i.studentId), n = D().now();
        const past = date < n.date || (date === n.date && n.min >= i.end);
        const cur = date === n.date && n.min >= i.start && n.min < i.end;
        if (cur) return { past: false, txt: `${i.end - n.min} daq qoldi`, cls: '' };
        if (i.kind === 'lesson' && s) {
            const mk = D().markOf(s, date);
            if (mk === 'present') return { past: true, txt: 'Keldi', cls: 's-ok' };
            if (mk === 'absent') return { past: true, txt: 'Kelmadi', cls: 's-no' };
            if (past) return { past, txt: 'Belgilanmagan', cls: 's-un' };
        }
        return { past, txt: past ? "o'tdi" : '', cls: '' };
    }
    function trialStatusTxt(i) {
        const l = trials().find(x => x.id === i.leadId);
        if (i.status === 'hold') return 'menejer ushlab turibdi';
        const p = l ? phase(l) : i.status === 'pending' ? 'pending' : 'upcoming';
        return p === 'pending' ? 'tasdiq kutilmoqda' : p === 'result' ? 'natija kerak' : p === 'past' ? "o'tdi" : 'tasdiqlangan';
    }
    function dayGrid(v, date) {
        const n = D().now();
        const items = (v?.items || []).filter(i => GRID_KINDS.includes(i.kind)).sort((a, b) => a.start - b.start);
        const overlay = (v?.items || []).filter(i => ['break', 'close', 'leave'].includes(i.kind));
        if (!items.length) return { html: `<div class="card" style="align-items: center; text-align: center; padding: 22px 16px; color: #4B5563; font-size: 13px">${!v ? 'Jadval topilmadi' : v.work?.length || v.noHours ? "Bu kunda dars yo'q" : 'Dam olish kuni'}${overlay.length ? ` · ${overlay.some(o => o.kind === 'leave') ? "ta'til" : overlay.some(o => o.kind === 'close') ? 'vaqt yopilgan' : 'sinovga tanaffus'}` : ''}</div>`, cap: '' };
        const busy = new Set();
        for (const i of items) for (let h = Math.floor(i.start / 60); h < Math.ceil(i.end / 60); h++) busy.add(h);
        if (date === n.date) busy.add(Math.floor(n.min / 60));
        const lo = Math.min(...busy), hi = Math.max(...busy);
        // Ketma-ket 2+ soat bo'sh bo'lsa — yig'iladi (dizayndagi "12:00–14:00 yig'ilgan").
        const hours = [], gaps = [];
        for (let h = lo; h <= hi;) {
            if (busy.has(h)) { hours.push(h); h++; continue; }
            let e = h; while (e <= hi && !busy.has(e)) e++;
            if (e - h >= 2) { gaps.push({ from: h, to: e, at: hours.length }); h = e; }
            else { for (let k = h; k < e; k++) hours.push(k); h = e; }
        }
        const idx = new Map(hours.map((h, k) => [h, k]));
        const y = min => { const h = Math.floor(min / 60); if (idx.has(h)) return idx.get(h) * 96 + (min - h * 60) * PX; const g = gaps.find(g => h >= g.from && h < g.to); return g ? g.at * 96 : (min < lo * 60 ? 0 : hours.length * 96); };
        const pieces = (a, b) => { const out = []; for (const h of hours) { const s = Math.max(a, h * 60), e = Math.min(b, h * 60 + 60); if (e > s) { const last = out[out.length - 1]; if (last && Math.abs(last.bottom - y(s)) < 0.5) last.bottom = y(s) + (e - s) * PX; else out.push({ top: y(s), bottom: y(s) + (e - s) * PX }); } } return out; };
        const tl = hours.map(h => `<span class="h">${hm(h * 60)}</span><span class="q">${hm(h * 60 + 15)}</span><span class="hf">${hm(h * 60 + 30)}</span><span class="q">${hm(h * 60 + 45)}</span>`).join('');
        let blocks = '';
        for (const o of overlay) for (const p of pieces(o.start, o.end)) {
            const br = o.kind === 'break';
            blocks += `<button type="button" class="jd-b ${br ? 'jd-dbr' : 'jd-dcl'}" ${br ? 'data-jd-tfgo="1"' : 'tabindex="-1"'} style="top: ${p.top + 2}px; height: ${Math.max(18, p.bottom - p.top - 4)}px" aria-label="${br ? 'Sinovga tanaffus' : o.kind === 'leave' ? "Ta'til" : 'Yopiq vaqt'} ${range(Math.max(o.start, 0), Math.min(o.end, 1440))}">${br ? 'Tanaffus' : o.kind === 'leave' ? "Ta'til" : 'Yopiq'}${p.bottom - p.top >= 40 ? `<small>${range(o.start, Math.min(o.end, 1440))}${o.reason ? ' · ' + esc(o.reason) : ''}</small>` : ''}</button>`;
        }
        for (const i of items) {
            const top = y(i.start) + 2, h = Math.max(20, (i.end - i.start) * PX - 4);
            const s = D().stuOf(i.studentId), d = i.end - i.start;
            let cls, name, sub, attr;
            if (i.kind === 'trial') {
                const l = trials().find(x => x.id === i.leadId);
                cls = 'jd-dtr'; name = `Sinov · ${esc(l ? D().first(l.name) : 'lid')}`; sub = trialStatusTxt(i); attr = `data-jd-trial="${esc(i.leadId || '')}" data-date="${date}"`;
                const past = date < n.date || (date === n.date && n.min >= i.end); if (past) cls += ' jd-past';
            } else {
                const ls = lessonState(i, date);
                cls = i.kind === 'makeup' ? 'jd-dmk' : d <= 15 ? 'jd-d15' : d <= 30 ? 'jd-d30' : 'jd-d60';
                if (i.kind === 'reserved') cls += ' jd-past';
                else if (ls.past) cls += ' jd-past';
                name = `${i.kind === 'makeup' ? 'Qoplash · ' : ''}${esc(D().first(s?.name || i.studentName || ''))}`;
                sub = i.kind === 'reserved' ? 'muzlatilgan' : ls.txt; attr = s ? `data-jd-stu="${esc(s.id)}"` : 'tabindex="-1"';
                if (ls.cls) sub = `<span class="${ls.cls}">${sub}</span>`;
            }
            const small = `${range(i.start, i.end)}${sub ? ' · ' + sub : ''}`;
            blocks += d <= 15
                ? `<button type="button" class="jd-b ${cls} jd-one" ${attr} style="top: ${top}px; height: ${h}px">${name}<small>${small}</small></button>`
                : `<button type="button" class="jd-b ${cls}" ${attr} style="top: ${top}px; height: ${h}px">${name}<small>${small}</small></button>`;
        }
        const lines = gaps.map(g => `<div class="jd-gapl" style="top: ${g.at * 96}px" aria-hidden="true"></div>`).join('');
        let now = '';
        if (date === n.date) now = `<span class="jd-now" style="top: ${Math.max(0, y(n.min) - 1)}px" aria-hidden="true"></span>`;
        const ttl = `${D().DAY_FULL[D().wdOf(date) - 1]} jadvali`;
        const cap = gaps.map(g => `${hm(g.from * 60)}–${hm(g.to * 60)}`).join(', ');
        return {
            html: `<div class="jd-grid a1" role="group" aria-label="${esc(ttl)}"><div class="jd-tl" aria-hidden="true">${tl}</div><div class="jd-dl" style="height: ${hours.length * 96}px">${blocks}${lines}${now}</div></div>`,
            cap: cap ? `${cap} yig'ilgan — bu vaqtda dars yo'q` : ''
        };
    }
    function weekRows(ws, by) {
        const n = D().now();
        const days = Array.from({ length: 7 }, (_, k) => U.addDays(ws, k)).filter(d => D().wdOf(d) !== 7 || (by[d]?.items || []).some(i => GRID_KINDS.includes(i.kind)));
        const chip = (i, d) => {
            if (i.kind === 'trial') { const l = trials().find(x => x.id === i.leadId); return `<span class="jd-wk" style="background: #F4EBFF; color: #53389E">${hm(i.start)} ${esc(l ? D().first(l.name) : 'Lid')} · sinov</span>`; }
            if (i.kind === 'break') return `<span class="jd-wk jd-stripe" style="color: #C4320A">${range(i.start, i.end)} tanaffus</span>`;
            const s = D().stuOf(i.studentId), nm = esc(D().first(s?.name || i.studentName || ''));
            if (i.kind === 'makeup') return `<span class="jd-wk" style="background: #CCF1EE; color: #0B5F56">${hm(i.start)} ${nm} · qoplash</span>`;
            if (i.kind === 'reserved') return `<span class="jd-wk" style="color: #4B5563">${hm(i.start)} ${nm} · muzlatilgan</span>`;
            const st = lessonState(i, d);
            const bg = st.cls === 's-ok' ? '#DCFAE6' : st.cls === 's-no' ? '#FEE4E2' : st.cls === 's-un' ? '#FEF0C7' : '#EAF3FF';
            return `<span class="jd-wk" style="background: ${bg}">${hm(i.start)} ${nm}${st.cls === 's-no' ? ' ✕' : ''}</span>`;
        };
        return `<section class="card l a1" aria-label="Hafta jadvali">${days.map(d => {
            const items = (by[d]?.items || []).filter(i => [...GRID_KINDS, 'break'].includes(i.kind)).sort((a, b) => a.start - b.start);
            return `<button type="button" class="li jd-wrow" data-jd-day="${d}"><b class="jd-wd${d === n.date ? ' td' : ''}">${D().DAY[D().wdOf(d) - 1]} ${+d.slice(8)}</b>${items.length ? `<span class="jd-wks">${items.map(i => chip(i, d)).join('')}</span>` : `<span class="xs" style="padding-top: 6px">${by[d]?.work?.length ? "dars yo'q" : 'dam olish'}</span>`}</button>`;
        }).join('')}</section>`;
    }
    function darslarView() {
        const n = D().now(); selDate ||= n.date;
        const ws = weekStart(selDate), c = schLoad(ws), by = c.data ? myViews(c.data) : {};
        const segR = `<div class="seg jd-seg44" role="tablist" style="width: 132px"><button type="button" role="tab" data-jd-mode="kun" aria-selected="${mode === 'kun'}" class="${mode === 'kun' ? 'on' : ''}">Kun</button><button type="button" role="tab" data-jd-mode="hafta" aria-selected="${mode === 'hafta'}" class="${mode === 'hafta' ? 'on' : ''}">Hafta</button></div>`;
        const legend = '<div class="jd-lg" aria-label="Belgilar"><span><i class="jd-d15"></i>15 daq</span><span><i class="jd-d30"></i>30 daq</span><span><i class="jd-d60"></i>60 daq</span><span><i class="jd-dtr"></i>Sinov</span><span><i class="jd-dmk"></i>Qoplash</span><span><i style="background: #EAF3FF; opacity: .6; border: 1px solid #C7DEFA"></i>Muzlatilgan</span></div>';
        if (mode === 'hafta') {
            const all = Object.values(by).flatMap(v => v.items || []);
            const cnt = k => all.filter(i => i.kind === k).length;
            return `${header(segR)}<div class="bd" style="gap: 10px">${U.offline()}${tabs2()}
<div class="row" style="padding: 0 4px; flex: none"><b style="font-size: 15px">${fmtShort(ws)} – ${fmtShort(U.addDays(ws, 6))}${c.data ? ` · ${cnt('lesson')} dars · ${cnt('trial')} sinov` : ''}</b></div>
<span class="xs" style="padding: 0 4px; margin-top: -6px">Kunni bosing → kun ko'rinishi</span>
${c.err && !c.data ? U.err(c, `jd:sch:${ws}`) : !c.data ? U.skel(3, 64) : weekRows(ws, by)}
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; flex: none"><button type="button" class="btn sm" data-jd-wk="-7">${U.svg(ICO.back, 18)}Oldingi hafta</button><button type="button" class="btn sm" data-jd-wk="7">Keyingi hafta${U.svg(ICO.chev, 18)}</button></div>
</div>`;
        }
        const days = Array.from({ length: 7 }, (_, k) => U.addDays(ws, k)).filter(d => D().wdOf(d) !== 7 || d === selDate || (by[d]?.items || []).some(i => GRID_KINDS.includes(i.kind)));
        const strip = `<nav class="jd-days" aria-label="Kunlar" style="grid-template-columns: repeat(${days.length}, minmax(0, 1fr))">${days.map(d => {
            const has = (by[d]?.items || []).some(i => GRID_KINDS.includes(i.kind));
            return `<button type="button" data-jd-day="${d}" class="${d === selDate ? 'on' : ''}"${d === selDate ? ' aria-current="date"' : ''} aria-label="${esc(U.dateLong(d))}">${D().DAY[D().wdOf(d) - 1]}<b>${+d.slice(8)}</b>${has ? '<i></i>' : ''}</button>`;
        }).join('')}</nav>`;
        const v = by[selDate];
        const items = v?.items || [];
        const nL = items.filter(i => ['lesson', 'makeup'].includes(i.kind)).length, nT = items.filter(i => i.kind === 'trial').length;
        const g = c.data ? dayGrid(v, selDate) : null;
        return `${header(segR)}<div class="bd" style="gap: 10px">${U.offline()}${tabs2()}${strip}
<div class="row" style="padding: 0 4px; flex: none"><b style="font-size: 15px">${D().DAY_FULL[D().wdOf(selDate) - 1]}${c.data ? ` · ${nL} dars${nT ? ` · ${nT} sinov` : ''}` : ''}</b></div>
<span class="xs" style="padding: 0 4px; margin-top: -6px">Darsni bosing → o'quvchi kartasi</span>
${c.err && !c.data ? U.err(c, `jd:sch:${ws}`) : !g ? U.skel(1, 380) : g.html}
${g?.cap ? `<span class="xs" style="padding: 0 4px; text-align: center; margin-top: -4px">${esc(g.cap)}</span>` : ''}
${legend}
</div>`;
    }

    // ── Tab ──
    U.tab('jadval', {
        render() {
            if (tab === 'darslar') return darslarView();
            const t = today(), e = tomorrow();
            const st = trialsState();
            const nT = st.data ? countFor(t) : 0, nE = st.data ? countFor(e) : 0;
            const f = `<nav class="jd-dd3" role="tablist" aria-label="Sinov filtri"><button type="button" role="tab" data-jd-f="bugun" aria-selected="${filter === 'bugun'}" class="${filter === 'bugun' ? 'on' : ''}">Bugun${nT ? ` <small>${nT}</small>` : ''}</button><button type="button" role="tab" data-jd-f="ertaga" aria-selected="${filter === 'ertaga'}" class="${filter === 'ertaga' ? 'on' : ''}">Ertaga${nE ? ` <small>${nE}</small>` : ''}</button><button type="button" role="tab" data-jd-f="tanaffus" aria-selected="${filter === 'tanaffus'}" class="${filter === 'tanaffus' ? 'on' : ''}">Tanaffus</button></nav>`;
            const body = filter === 'tanaffus' ? tanaffusView() : sinovList(filter === 'ertaga' ? e : t);
            const hist = filter !== 'tanaffus' ? `<button type="button" class="row jd-link" data-u-push="jd-tarix">Sinovlar tarixi${U.svg(ICO.chev, 16, 2.2)}</button>` : '';
            return `${header()}<div class="bd" style="gap: 12px; padding-bottom: 110px">${U.offline()}${tabs2()}${f}${body}${hist}</div>`;
        },
        bind(root) {
            root.querySelectorAll('[data-jd-tab]').forEach(b => b.onclick = () => { tab = b.dataset.jdTab; U.render(true); });
            root.querySelectorAll('[data-jd-f]').forEach(b => b.onclick = () => { filter = b.dataset.jdF; U.render(); });
            root.querySelectorAll('[data-jd-natija]').forEach(b => b.onclick = () => openNatija(b.dataset.jdNatija));
            root.querySelectorAll('[data-jd-break]').forEach(b => b.onclick = () => openBreak(b.dataset.jdBreak === 'whole'));
            root.querySelectorAll('[data-jd-unbreak]').forEach(b => b.onclick = () => unbreak(b.dataset.jdUnbreak, b));
            root.querySelectorAll('[data-jd-mode]').forEach(b => b.onclick = () => { mode = b.dataset.jdMode; U.render(); });
            root.querySelectorAll('[data-jd-day]').forEach(b => b.onclick = () => { selDate = b.dataset.jdDay; mode = 'kun'; U.render(); });
            root.querySelectorAll('[data-jd-wk]').forEach(b => b.onclick = () => { selDate = U.addDays(weekStart(selDate || today()), Number(b.dataset.jdWk)); U.render(); });
            root.querySelectorAll('[data-jd-stu]').forEach(b => b.onclick = () => U.push('karta', b.dataset.jdStu));
            root.querySelectorAll('[data-jd-trial]').forEach(b => b.onclick = () => { const d = b.dataset.date; tab = 'sinov'; filter = d === tomorrow() ? 'ertaga' : 'bugun'; U.render(true); });
            root.querySelectorAll('[data-jd-tfgo]').forEach(b => b.onclick = () => { tab = 'sinov'; filter = 'tanaffus'; U.render(true); });
        }
    });

    // ── Sinovlar tarixi ──
    U.page('jd-tarix', {
        render() {
            const c = historyLoad();
            const list = c.data || [];
            const pill = x => x.phase === 'done' ? '<span class="pill ok">O\'tkazildi</span>' : x.phase === 'noshow' ? '<span class="pill bad">Lid kelmadi</span>' : x.phase === 'rejected' ? '<span class="pill mu">Rad etildi</span>' : x.phase === 'rebooked' ? '<span class="pill mu">Qayta qo\'yildi</span>' : '<span class="pill mu">Yopildi</span>';
            const row = x => { const a = D().tz(x.trialRequest?.scheduledAt); const r = x.trialRequest || {}; return `<div class="li"><div class="col g1"><span class="nm">${esc(x.name || 'Lid')}</span><span class="xs">${a ? `${esc(relLabel(a.date))} · ${hm(a.min)}` : ''}${x.managerName ? ` · menejer ${esc(D().first(x.managerName))}` : ''}${r.reasonLabel ? ` · ${esc(r.reasonLabel)}` : ''}</span></div>${pill(x)}</div>`; };
            const m = D().now().month, mon = list.filter(x => tD(x.trialRequest?.scheduledAt).slice(0, 7) === m);
            const k = p => mon.filter(x => x.phase === p).length;
            return `<div class="bar"><a href="#" class="back" data-u-back>${U.svg(ICO.back, 22, 2.2)}Jadval</a></div>
<div class="bd nb" style="gap: 12px">${U.offline()}<h1 class="ttl">Sinovlar tarixi</h1>
${c.err && !c.data ? U.err(c, 'jd:hist') : !c.data ? U.skel(3, 56) : `<div class="kp"><div class="k"><span>${esc(D().MON[+m.slice(5) - 1])}</span><strong>${mon.length}</strong></div><div class="k"><span>O'tkazildi</span><strong>${k('done')}</strong></div><div class="k"><span>Kelmadi</span><strong>${k('noshow')}</strong></div></div>
${list.length ? `<section class="card l">${list.map(row).join('')}</section>` : '<div class="card" style="align-items: center; text-align: center; padding: 18px; color: #4B5563; font-size: 13px">Hali yakunlangan sinov yo\'q</div>'}`}
<span class="xs" style="padding: 0 4px">Oxirgi 60 kun. Sotuv natijasi va konversiya ustozga ko'rsatilmaydi.</span></div>`;
        }
    });

    // ── S3 / S4 / S5: sinov qo'yildi — ilova qulf ──
    const pendingList = () => trials().filter(l => phase(l) === 'pending').sort((a, b) => String(tReq(a).scheduledAt).localeCompare(String(tReq(b).scheduledAt)));
    function proposalSlots(l) {
        const a = tAt(l); if (!a) return { loading: false, list: [] };
        const c = U.load(`jd:prop:${a.date}`, () => U.api(`/api/school/schedule?from=${a.date}&to=${U.addDays(a.date, 1)}`), { ttl: 120000 });
        if (!c.data) return { loading: !c.err, list: [] };
        const by = myViews(c.data), n = D().now(), d = dur(l), out = [];
        for (const date of [a.date, U.addDays(a.date, 1)]) for (const f of by[date]?.trialFree || []) {
            for (let t = Math.ceil(f.start / 30) * 30; t + d <= f.end; t += 30) {
                if (date === a.date && t === a.min) continue;
                if (date < n.date || (date === n.date && t <= n.min + 30)) continue;
                out.push({ date, min: t, iso: isoAt(date, t), dist: (date === a.date ? 0 : 1440) + Math.abs(t - a.min) });
            }
        }
        return { loading: false, list: out.sort((x, y) => x.dist - y.dist).slice(0, 3).sort((x, y) => x.iso.localeCompare(y.iso)) };
    }
    function lockAsk(l) {
        const a = tAt(l), r = tReq(l), m = mgrName(l), w = wish(l), lang = LANG[l.language] || '';
        const anim = lk.shown !== `ask:${l.id}` ? ' jd-anim' : '';
        return `<div class="scrim" aria-hidden="true" style="background: rgba(11,18,32,.62)"></div>
<section class="jd-mdl${anim}" role="dialog" aria-modal="true" aria-labelledby="jd-s3" style="top: 64px">
<span class="jd-bell${anim}">${U.svg(ICO.cal, 34, 2)}</span>
<div class="col" style="gap: 6px; align-items: center; text-align: center"><span class="pill vio">Yangi sinov darsi</span><h2 id="jd-s3" style="font-size: 22px; font-weight: 800; letter-spacing: -.02em">Sizga sinov darsi qo'yildi</h2><span class="s">Javob bermaguningizcha ilova yopiq turadi</span></div>
<div class="jd-trc">
<div class="row"><div class="col" style="align-items: center; width: 64px; flex: none"><span class="xs b" style="color: #6941C6">${a ? esc(relLabel(a.date).toUpperCase()) : ''}</span><strong style="font-size: 24px; font-weight: 800; color: #0B1220">${a ? hm(a.min) : '—'}</strong></div><div class="col g1"><span class="nm" style="font-size: 16px">${esc(l.name || 'Lid')}</span><span class="s">${dur(l)} daq${r.daysCount > 1 ? ` · ${r.daysCount} kun` : ''}${lang ? ` · ${lang}` : ''}${m ? ` · menejer ${esc(m)}` : ''}</span></div></div>
${w ? `<span style="font-size: 13px; color: #53389E; line-height: 1.45">«${esc(w)}»</span>` : ''}</div>
<button type="button" class="btn ok2 w" data-jd-acc style="height: 56px; font-size: 16px; color: #FFFFFF"${lk.busy ? ' disabled' : ''}>${U.svg(ICO.check, 20, 3.5)}Qabul qilaman</button>
<button type="button" class="btn w" data-jd-rej style="height: 50px; font-size: 15px; color: #0057B8"${lk.busy ? ' disabled' : ''}>Bu vaqtda o'ta olmayman</button>
</section>`;
    }
    function lockReject(l) {
        const a = tAt(l), reasons = W().REJECT_REASONS?.length ? W().REJECT_REASONS : (D().REASONS || []);
        const p = proposalSlots(l);
        const anim = lk.shown !== `rej:${l.id}` ? '' : ' style="animation: none"';
        const other = lk.reason === 'teacher-other';
        return `<div class="scrim" data-jd-lback aria-hidden="true" style="background: rgba(11,18,32,.62)"></div>
<section class="sheet" role="dialog" aria-modal="true" aria-labelledby="jd-s4" style="top: 110px; gap: 12px${anim ? '; animation: none' : ''}">
<span class="grab" aria-hidden="true"></span>
<div class="col"><h2 id="jd-s4" style="font-size: 20px; font-weight: 800">Nega o'ta olmaysiz?</h2><span class="s">${esc(l.name || 'Lid')}${a ? ` · ${esc(relLabel(a.date).toLowerCase())} ${hm(a.min)}` : ''}</span></div>
<span class="jd-st" id="jd-rs">SABAB · MAJBURIY</span>
<div class="chips" style="flex-wrap: wrap" role="radiogroup" aria-labelledby="jd-rs">${reasons.map(r => `<button type="button" role="radio" aria-checked="${lk.reason === r.id}" class="chip${lk.reason === r.id ? ' on' : ''}" data-jd-rr="${esc(r.id)}">${esc(r.label)}</button>`).join('')}</div>
${other ? `<div class="fl"><label for="jd-rn">Izoh</label><input id="jd-rn" type="text" maxlength="500" value="${esc(lk.note)}" placeholder="qisqacha"></div>` : ''}
<span class="jd-st" id="jd-rp">BOSHQA VAQT TAKLIF QILING · IXTIYORIY</span>
${p.loading ? U.skel(1, 52) : p.list.length ? `<div class="jd-sl" role="group" aria-labelledby="jd-rp">${p.list.map(x => { const on = lk.props.includes(x.iso); return `<button type="button" class="${on ? 'on' : ''}" aria-pressed="${on}" data-jd-pp="${x.iso}">${esc(relLabel(x.date))}<b>${hm(x.min)}</b></button>`; }).join('')}</div>` : '<span class="xs">Yaqin kunlarda sinovga ochiq boshqa vaqt yo\'q — menejer o\'zi kelishadi.</span>'}
<div class="note w" style="padding: 10px 12px"><span>${a ? `${hm(a.min)} dagi joy darhol bo'shaydi, ` : ''}menejer ${esc(D().first(l.name) || 'lid')} bilan yangi vaqtni kelishadi.</span></div>
<button type="button" class="btn p w" data-jd-send style="height: 54px; font-size: 16px; color: #FFFFFF; margin-top: auto${lk.reason ? '' : '; opacity: .5'}"${lk.busy ? ' disabled' : ''}${lk.reason ? '' : ' aria-disabled="true"'}>Menejerga yuborish</button>
</section>`;
    }
    function lockDone() {
        const l = lk.done, a = l && tAt(l);
        const anim = lk.shown !== 'done' ? ' jd-anim' : '';
        return `<div class="scrim" aria-hidden="true"></div>
<section class="jd-mdl${anim}" role="dialog" aria-modal="true" aria-labelledby="jd-s5" style="top: 190px; text-align: center; align-items: center">
<span class="jd-bell${anim}" style="background: #ECFDF3; color: #067647">${U.svg(ICO.check, 36, 3.5)}</span>
<h2 id="jd-s5" style="font-size: 22px; font-weight: 800">Jadvalingizga yozildi</h2>
<span class="s" style="font-size: 14px; line-height: 1.5">${a ? `${esc(relLabel(a.date))} ${hm(a.min)} · ` : ''}${esc(l?.name || '')}. Menejerga xabar bordi${pendingList().length ? ` · yana ${pendingList().length} ta sinov javob kutmoqda` : ''}.</span>
<button type="button" class="btn p w" data-jd-done style="height: 52px; color: #FFFFFF">${pendingList().length ? 'Keyingi sinov' : "Sinov darslariga o'tish"}</button>
</section>`;
    }
    U.lock('sinov', {
        priority: 1,
        active: () => !!lk.done || pendingList().length > 0,
        render() {
            if (lk.done) return lockDone();
            const l = pendingList()[0];
            if (lk.id !== l.id) Object.assign(lk, { id: l.id, step: 'ask', reason: null, props: [], note: '', busy: false });
            return lk.step === 'reject' ? lockReject(l) : lockAsk(l);
        },
        bind(el) {
            if (!el) return;
            const l = trials().find(x => x.id === lk.id);
            const prevShown = lk.shown;
            lk.shown = lk.done ? 'done' : `${lk.step === 'reject' ? 'rej' : 'ask'}:${lk.id}`;
            const acc = el.querySelector('[data-jd-acc]');
            if (acc) acc.onclick = async () => {
                if (lk.busy || !l) return;
                lk.busy = true; acc.disabled = true;
                try { const nl = await trialPost(l, { action: 'accept' }); lk.busy = false; lk.done = nl; U.render(); }
                catch (err) { lk.busy = false; acc.disabled = false; U.toast(err.message || 'Saqlanmadi'); if (err.status === 409) refreshTrials(); }
            };
            const rej = el.querySelector('[data-jd-rej]');
            if (rej) rej.onclick = () => { lk.step = 'reject'; U.render(); };
            el.querySelectorAll('[data-jd-lback]').forEach(b => b.onclick = () => { if (!lk.busy) { lk.step = 'ask'; U.render(); } });
            el.onkeydown = e => { if (e.key === 'Escape' && lk.step === 'reject' && !lk.busy) { lk.step = 'ask'; U.render(); } };
            el.querySelectorAll('[data-jd-rr]').forEach(b => b.onclick = () => { lk.reason = b.dataset.jdRr; U.render(); });
            el.querySelectorAll('[data-jd-pp]').forEach(b => b.onclick = () => {
                const v = b.dataset.jdPp, max = W().MAX_PROPOSALS || 3;
                if (lk.props.includes(v)) lk.props = lk.props.filter(x => x !== v);
                else if (lk.props.length >= max) return U.toast(`Ko'pi bilan ${max} ta vaqt taklif qiling`);
                else lk.props = [...lk.props, v];
                b.classList.toggle('on', lk.props.includes(v)); b.setAttribute('aria-pressed', String(lk.props.includes(v)));
            });
            const rn = el.querySelector('#jd-rn'); if (rn) rn.oninput = () => { lk.note = rn.value; };
            const send = el.querySelector('[data-jd-send]');
            if (send) send.onclick = async () => {
                if (lk.busy || !l) return;
                if (!lk.reason) return U.toast('Sababni tanlang');
                lk.busy = true; send.disabled = true;
                const note = lk.note.trim();
                try {
                    await trialPost(l, { action: 'reject', reasonId: lk.reason, ...(lk.props.length ? { proposals: lk.props.slice().sort() } : {}), ...(note ? { note } : {}) });
                    Object.assign(lk, { id: null, step: 'ask', reason: null, props: [], note: '', busy: false });
                    U.toast('Menejerga yuborildi', { ok: true }); U.render();
                } catch (err) { lk.busy = false; send.disabled = false; U.toast(err.message || 'Yuborilmadi'); if (err.status === 409) refreshTrials(); }
            };
            const done = el.querySelector('[data-jd-done]');
            if (done) done.onclick = () => {
                const a = lk.done && tAt(lk.done);
                lk.done = null; lk.id = null; lk.step = 'ask';
                if (pendingList().length) return U.render();
                tab = 'sinov'; filter = a && a.date === tomorrow() ? 'ertaga' : 'bugun';
                U.go('jadval'); U.render(true);
            };
            if (prevShown !== lk.shown) (el.querySelector('[data-jd-acc], [data-jd-done], .chip, [data-jd-send]'))?.focus({ preventScroll: true });
        },
        onBlocked() { U.toast('Avval yangi sinov darsiga javob bering'); }
    });
    async function refreshTrials() {
        try { const r = await U.api('/api/trial-lessons'); D().S.trials = r.lessons || []; U.drop('jd:'); U.render(); } catch { /* jim */ }
    }

    // Menyu'dagi "Tanaffus" plitkasi
    U.jadval = {
        openTanaffus() { tab = 'sinov'; filter = 'tanaffus'; U.go('jadval'); U.render(true); }
    };
})();
