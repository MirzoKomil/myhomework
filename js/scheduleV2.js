// Dars jadvali v2 — dizaynlar: UstozJadval (Kun/Hafta/Oy), YordamchiJadval (tavsiya jadvali),
// AdminJadval / RopJadval (kun · ustozlar), AdminJadvalUstoz (hafta · bitta ustoz), JadvalQoidalar.
// Ma'lumot faqat /api/school'dan (server ruxsatni tekshiradi). Sotuv menejeri ko'rinishi ("Kim bo'sh?")
// js/schoolSchedule.js'da qoladi — bu fayl unga tegmaydi.
(function () {
    'use strict';
    const U = () => window.schoolUI;
    const SS = () => window.schoolSchedule;
    const MON = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const CH_IC = { phone: '☎', zoom: 'Z', meet: 'M', tg_video: '▶', tg_group: 'G', tg_text: '✉' };
    const CH = { phone: 'Telefon', zoom: 'Zoom', meet: 'Google Meet', tg_video: 'Telegram video', tg_group: 'Telegram guruh', tg_text: 'Telegram yozishma' };
    const V2_VIEWS = ['day', 'week', 'tday', 'mine', 'tmonth', 'advice'];
    const role = () => (typeof getCurrentUser === 'function' ? getCurrentUser()?.role : '') || '';
    const isFull = () => ['admin', 'boshliq'].includes(role());
    const isRop = () => role() === 'rop';
    const me = () => (typeof getCurrentUser === 'function' ? getCurrentUser() : null) || {};
    const hrList = () => (typeof getItem === 'function' && typeof STORAGE_KEYS !== 'undefined' ? getItem(STORAGE_KEYS.hrEmployees, []) : []) || [];
    const dm = d => { const [, m, dd] = d.split('-').map(Number); return `${dd}-${MON[m - 1]}`; };
    const short = name => { const p = String(name || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : (p[0] || ''); };
    const first = name => String(name || '').trim().split(/\s+/)[0] || '';
    const hours = m => { const h = Math.round(m / 6) / 10; return `${String(h).replace('.', ',')} soat`; };

    function isAssistant() {
        const u = me(); if (u.role !== 'teacher') return false;
        const e = hrList().find(x => x.id === u.linkedTeacherId);
        if (e) return e.role === 'yordamchi';
        try { return typeof resolveTeacherWithVirtual === 'function' && resolveTeacherWithVirtual(u.linkedTeacherId)?.type === 'yordamchi'; } catch { return false; }
    }

    // ── Oraliqlar ────────────────────────────────────────────────────────────
    const merge = list => { const s = [...list].filter(x => x.end > x.start).sort((a, b) => a.start - b.start); const out = []; for (const x of s) { const l = out[out.length - 1]; if (l && x.start <= l.end) l.end = Math.max(l.end, x.end); else out.push({ start: x.start, end: x.end }); } return out; };
    function subtract(base, cut) {
        let out = merge(base);
        for (const c of cut) out = out.flatMap(f => (c.end <= f.start || c.start >= f.end) ? [f] : [f.start < c.start ? { start: f.start, end: c.start } : null, c.end < f.end ? { start: c.end, end: f.end } : null].filter(Boolean));
        return out;
    }
    const intersect = (a, b) => merge(a.flatMap(x => b.map(y => ({ start: Math.max(x.start, y.start), end: Math.min(x.end, y.end) })).filter(z => z.end > z.start)));
    const sum = list => list.reduce((n, x) => n + Math.max(0, x.end - x.start), 0);
    const overlaps = (a, b) => a.start < b.end && b.start < a.end;

    // Ko'rinadigan soatlar: odatda 09–21, kech/erta dars bo'lsa kengayadi (21:30–22:00 dars sig'adi, #121).
    function fit(views, extra = []) {
        let lo = 9 * 60, hi = 21 * 60;
        for (const v of views) for (const x of [...(v.items || []), ...(v.work || [])]) {
            if (Number.isFinite(x.start)) lo = Math.min(lo, Math.floor(x.start / 60) * 60);
            if (Number.isFinite(x.end)) hi = Math.max(hi, Math.ceil(x.end / 60) * 60);
        }
        for (const x of extra) { lo = Math.min(lo, Math.floor(x.start / 60) * 60); hi = Math.max(hi, Math.ceil(x.end / 60) * 60); }
        return [Math.max(0, lo), Math.min(24 * 60, hi)];
    }
    function when(date, i) {
        const td = U().today(), now = U().nowMin();
        return { past: date < td || (date === td && i.end <= now), live: date === td && i.start <= now && now < i.end, future: date > td || (date === td && i.start > now) };
    }
    const TRIAL = { hold: 'ushlab turilgan', pending: 'tasdiq kutilmoqda', confirmed: 'tasdiqlandi', done: 'o\'tkazildi', no_show: 'lid kelmadi' };
    // Blok rangi va matni: keldi / kelmadi / belgilanmagan / hozir / rejada / qoplash / sinov ...
    function look(i, date, { names = true } = {}) {
        const w = when(date, i), dur = i.end - i.start;
        const nm = names ? first(i.studentName || '') : '';
        if (i.kind === 'lesson') {
            const sub = i.double ? `${dur} daq ×2 · qo'shaloq` : null;
            if (i.att === 1) return { cls: 'k-ok', t: nm || 'Dars', s: sub || 'keldi', st: 'ok' };
            if (i.att === 0) return { cls: 'k-no', t: nm || 'Dars', s: 'kelmadi', st: 'no' };
            if (w.live) return { cls: 'k-now', t: nm || 'Dars', s: sub || 'hozir', st: 'now' };
            if (w.past) return { cls: 'k-un', t: nm || 'Dars', s: 'belgilanmagan', st: 'un' };
            return { cls: 'k-wait', t: nm || 'Dars', s: sub || `${dur} daq`, st: 'wait' };
        }
        if (i.kind === 'reserved') return { cls: 'k-rsv', t: nm || 'Muzlatilgan', s: 'saqlangan · faqat sinov', st: 'rsv' };
        if (i.kind === 'makeup') return { cls: w.live ? 'k-now' : 'k-mk', t: `${nm || 'Qoplash'} · qoplash`, s: i.missedDate ? `${dm(i.missedDate)} o'rniga` : 'qoplash', st: 'mk' };
        if (i.kind === 'trial') {
            const s = i.status === 'confirmed' && w.past ? 'natija kutilmoqda' : TRIAL[i.status] || i.status || '';
            return { cls: i.status === 'hold' ? 'k-hold' : i.status === 'done' || i.status === 'no_show' ? 'k-trd' : 'k-tr', t: `${first(i.leadName) || 'Lid'} · sinov`, s, st: 'tr' };
        }
        if (i.kind === 'close') return { cls: 'k-cls', t: '🔒 yopildi', s: [i.reason, i.by && 'admin'].filter(Boolean).join(' · '), st: 'cls' };
        if (i.kind === 'leave') return { cls: 'k-cls', t: 'Ta\'til', s: i.reason || '', st: 'cls' };
        return { cls: 'k-cls', t: i.kind, s: '', st: 'cls' };
    }
    // Ustma-ust tushgan bloklar yonma-yon (yo'lak) joylashadi.
    // Muzlatilgan o'quvchining saqlangan vaqti (k-rsv) "faqat sinov" uchun — ustiga sinov/dars tushsa, u yo'lak olmaydi:
    // orqa fonda to'liq kenglikda qoladi, ustidagi blok tor ustunga siqilmaydi ("Shahzo natij…" bo'lmasin).
    function lanes(blocks) {
        const real = blocks.filter(b => !b.bg && !/\bk-rsv\b/.test(b.cls || ''));
        for (const b of blocks) if (!b.bg && /\bk-rsv\b/.test(b.cls || '') && real.some(x => x.start < b.end && x.end > b.start)) { b.bg = true; b.under = true; }
        const fg = blocks.filter(b => !b.bg).sort((a, b) => a.start - b.start || b.end - a.end);
        let cluster = [], end = -1;
        const flush = () => { const ln = []; for (const b of cluster) { let k = ln.findIndex(e => e <= b.start); if (k < 0) { k = ln.length; ln.push(0); } ln[k] = b.end; b.lane = k; } for (const b of cluster) b.lanes = ln.length; cluster = []; };
        for (const b of fg) { if (b.start >= end && cluster.length) flush(); cluster.push(b); end = Math.max(end, b.end); }
        if (cluster.length) flush();
        return blocks;
    }

    // ── Vertikal hafta / kun to'ri ───────────────────────────────────────────
    // Yordamchi tavsiya jadvali (YordamchiJadval): bloklar dizayndagidek to'liq kenglikda, balandligi 30px (--hh 80px da);
    // bir vaqtga to'g'ri kelganlari yonma-yon tor ustunga bo'linmaydi — biri ostiga ikkinchisi tushadi.
    const STACK_H = 22.5, STACK_STEP = 25.5; // daqiqa birligida: 30px blok + 4px oraliq (--hh = 80px)
    function stackTops(blocks) {
        let prev = -Infinity;
        for (const b of [...blocks].sort((a, c) => a.start - c.start)) { b.top = Math.max(b.start, prev + STACK_STEP); prev = b.top; }
        return blocks;
    }
    function vgrid(cols, [H0, H1], { cls = '', stack = false } = {}) {
        const { esc } = U();
        const H = (H1 - H0) / 60;
        const y = m => `calc(var(--hh) * ${((m - H0) / 60).toFixed(4)})`;
        const td = U().today(), now = U().nowMin();
        let axis = ''; for (let h = H0 / 60; h < H1 / 60; h++) axis += `<span style="top:${y(h * 60)}">${String(h).padStart(2, '0')}:00</span>`;
        const col = c => {
            if (stack) stackTops(c.blocks); else lanes(c.blocks);
            const bl = c.blocks.map(b => {
                if (stack) {
                    const tag = b.click ? 'button type="button"' : 'div';
                    return `<${tag} class="sv-b sv-sb ${b.cls}" style="top:${y(b.top)};height:calc(var(--hh) * ${(STACK_H / 60).toFixed(4)})"${b.attrs || ''} title="${esc(b.title || b.t || '')}">${esc(b.t || '')}</${tag.split(' ')[0]}>`;
                }
                const s = Math.max(H0, b.start), e = Math.min(H1, b.end); if (e <= s) return '';
                const L = b.lanes > 1 ? `left:calc(4px + (100% - 8px) * ${(b.lane / b.lanes).toFixed(4)});width:calc((100% - 8px) / ${b.lanes} - 2px);right:auto;` : '';
                const xs = e - s <= 20 ? ' xs' : '';
                const tag = b.click ? 'button type="button"' : 'div';
                return `<${tag} class="sv-b ${b.cls}${xs}${b.bg ? ' is-bg' : ''}" style="top:${y(s)};height:calc(var(--hh) * ${((e - s) / 60).toFixed(4)} - 3px);${L}"${b.attrs || ''} title="${esc(b.title || `${U().hm(b.start)}–${U().hm(b.end)} · ${b.t || ''}${b.s ? ' · ' + b.s : ''}`)}">${b.html || esc(b.t || '')}${b.s ? `<small>${esc(b.s)}</small>` : ''}</${tag.split(' ')[0]}>`;
            }).join('');
            const nowLine = c.date === td && now >= H0 && now <= H1 ? `<i class="sv-now" style="top:${y(now)}"></i>` : '';
            return `<div class="sv-dc${c.date === td ? ' td' : ''}"><div class="sv-dh${c.date === td ? ' td' : ''}">${esc(c.label)} <b>${Number(c.date.slice(8))}</b></div><div class="sv-dl" data-date="${c.date}" style="height:calc(var(--hh) * ${H})">${bl}${nowLine}</div></div>`;
        };
        return `<div class="sv-wkw"><div class="sv-wk ${cls}" style="--cols:${cols.length}"><div class="sv-tc"><div class="sv-dh"></div><div class="sv-tl" style="height:calc(var(--hh) * ${H})">${axis}</div></div>${cols.map(col).join('')}</div></div>`;
    }
    // Bir ustoz-kunning bloklari: ish vaqti emas, bo'sh (sinovga ochiq / ochiq / admin ochgan / faqat qoplash), darslar.
    function teacherBlocks(v, [H0, H1], { free = true, clickFree = false, clickOv = false, names = true, assist = [] } = {}) {
        const { esc } = U();
        const out = [];
        const td = U().today(), now = U().nowMin();
        for (const g of subtract([{ start: H0, end: H1 }], v.work)) out.push({ ...g, bg: true, cls: 'k-off', t: 'ish vaqti emas', title: 'Ish vaqti emas', click: clickFree && v.date >= td, attrs: clickFree && v.date >= td ? ` data-off="${g.start}|${g.end}"` : '' });
        if (free) {
            const trial = v.trialFree || [], opens = v.opens || [], mo = v.makeupOnly || [];
            const pieces = merge([...(v.free || []), ...mo.map(m => ({ start: m.start, end: m.end }))]);
            const busy = (v.items || []).filter(i => i.kind !== 'reserved');
            // Yordamchi aloqasi vaqtni band qilmaydi, lekin bo'sh blok yozuvi uning ostida qolmasin.
            for (const p of subtract(pieces, [...busy, ...assist.map(a => ({ start: a.start, end: Math.max(a.end, a.start + 30) }))])) {
                // Bo'lak turlari: faqat qoplash → admin ochgan → sinovga ochiq → ochiq (sinovga yopiq).
                const segs = [];
                for (const s of intersect([p], mo)) segs.push({ ...s, kind: 'mo' });
                let rest = subtract([p], mo);
                for (const s of intersect(rest, opens)) segs.push({ ...s, kind: 'open' });
                rest = subtract(rest, opens);
                for (const s of intersect(rest, trial)) segs.push({ ...s, kind: 'trial' });
                for (const s of subtract(rest, trial)) segs.push({ ...s, kind: 'free' });
                for (const s of segs) {
                    const past = v.date < td || (v.date === td && s.end <= now);
                    const ov = s.kind === 'open' ? opens.find(o => overlaps(o, s)) : s.kind === 'mo' ? mo.find(o => overlaps(o, s)) : null;
                    const look2 = { mo: ['k-cls k-mo', 'faqat qoplash'], open: ['k-freex', '+ admin ochdi'], trial: ['k-free', 'sinovga ochiq'], free: ['k-free k-free2', 'ochiq'] }[s.kind];
                    const canClick = (clickFree && !past) || (clickOv && ov);
                    out.push({ ...s, bg: true, cls: look2[0] + (past ? ' is-past' : ''), t: s.end - s.start >= 30 ? look2[1] : '', s: s.kind === 'open' && ov?.reason ? ov.reason : '',
                        title: `${U().hm(s.start)}–${U().hm(s.end)} · ${look2[1]}`, click: canClick,
                        attrs: canClick ? ` data-free="${s.start}|${s.end}|${s.kind}"${ov ? ` data-ovid="${esc(ov.overrideId)}"` : ''}` : '' });
                }
            }
        }
        for (const i of v.items || []) {
            const l = look(i, v.date, { names });
            const attrs = i.studentId ? ` data-st="${esc(i.studentId)}"` : i.kind === 'trial' ? ` data-tr="${esc(i.bookingId || '')}" data-lead="${esc(i.leadId || '')}"` : i.overrideId ? ` data-ovid="${esc(i.overrideId)}"` : '';
            out.push({ start: i.start, end: i.end, cls: l.cls, t: l.t, s: l.s, click: !!attrs && (i.kind !== 'close' && i.kind !== 'leave' || clickOv), attrs: attrs + (i.overrideId ? ` data-ovk="${esc(i.kind)}"` : '') });
        }
        for (const a of assist) {
            const end = Math.max(a.end, a.start + 30);
            const done = a.kind === 'contact';
            out.push({ start: a.start, end, cls: done ? (a.outcome === 'no_answer' ? 'k-as k-asn' : 'k-as') : 'k-asw', t: first(a.studentName),
                s: done ? (a.outcome === 'no_answer' ? 'aloqa · javob bermadi' : `aloqa ✓ ${a.minutes} daq`) : 'aloqa · tavsiya', click: true, attrs: ` data-st="${esc(a.studentId)}"` });
        }
        return out;
    }
    const weekDays = (from, views) => {
        const days = []; for (let k = 0; k < 7; k++) days.push(U().addDays(from, k));
        const sun = days[6];
        return views.some(v => v.date === sun && (v.items.length || (v.work.length && !v.noHours))) ? days : days.slice(0, 6);
    };
    const LEGEND_T = [['k-rsv', 'Muzlatilgan o\'quvchi vaqti · saqlangan, faqat sinov'], ['k-asw', 'Yordamchi aloqasi · band qilmaydi'], ['k-ok', 'Keldi'], ['k-no', 'Kelmadi'], ['k-un', 'Belgilanmagan'], ['k-wait', 'Rejada'], ['k-mk', 'Qoplash'], ['k-tr', 'Sinov darsi'], ['k-free', 'Bo\'sh (sotuv sinov qo\'ya oladi)'], ['k-freex', 'Admin ochgan'], ['k-cls', 'Sinovga yopiq'], ['k-off', 'Ish vaqti emas']];
    // rules — "Jadval qoidalari" havolasi (ustoz/yordamchi: dizaynda sarlavha qatorida tugma yo'q).
    // "Yordamchi aloqasi" bandi — faqat jadvalda yordamchi aloqasi bo'lsa (asosiy ustozda 29-okt dan yordamchilik yo'q).
    const legendT = asst => (asst && asst.length ? LEGEND_T : LEGEND_T.filter(([c]) => c !== 'k-asw'));
    const legend = (list, { rules = false } = {}) => `<div class="sv-lg">${list.map(([c, t]) => `<span><i class="sv-sq ${c}"></i>${t}</span>`).join('')}${rules ? '<button type="button" class="sc-link sv-rlink" data-rules>Jadval qoidalari →</button>' : ''}</div>`;

    // ── Sahifa sarlavhasi va boshqaruvlar ───────────────────────────────────────
    // inline — ustoz/yordamchi (UstozJadval, YordamchiJadval): boshqaruvlar sarlavha qatorining o'ngida,
    // "Qoidalar" tugmasi yo'q (havola legenda qatorida). Admin/ROP — boshqaruvlar sarlavha ostida (AdminJadval).
    function header(root, { title, sub, tabs = [], right = '', nav = '', lang = false, extra = '', inline = false, back = false }) {
        const st = SS().state;
        const { esc } = U();
        const ctl = `${tabs.length ? `<div class="sc-seg sv-seg" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-v="${k}" aria-pressed="${k === st.view}">${esc(l)}</button>`).join('')}</div>` : ''}
            ${nav}${lang ? `<div class="sc-seg sv-seg" role="group" aria-label="Yo'nalish"><button type="button" data-lang="english" aria-pressed="${st.lang === 'english'}">Ingliz</button><button type="button" data-lang="russian" aria-pressed="${st.lang === 'russian'}">Rus</button></div>` : ''}${extra}`;
        root.innerHTML = inline
            ? `<div class="sv-head sv-head--in${back ? ' sv-head--bk' : ''}"><div class="sv-ht">${back ? '<button type="button" class="sc-link sv-back" data-back>← Barcha ustozlar</button>' : ''}<h1>${title}</h1><p class="sc-sub">${sub}</p></div><div class="sv-hr2">${ctl}${right}</div></div>
          <div data-body class="sv-body"><div class="sc-skel"></div></div>`
            : `<div class="sv-head"><div class="sv-ht"><h1>${title}</h1><p class="sc-sub">${sub}</p></div>${right}</div>
          <div class="sv-ctl">${ctl}
            <span class="sc-grow"></span><button type="button" class="sc-btn sc-btn--sm sv-rules" data-rules>Qoidalar</button></div>
          <div data-body class="sv-body"><div class="sc-skel"></div></div>`;
        root.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { st.view = b.dataset.v; SS().render(root); });
        root.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { if (st.lang === b.dataset.lang) return; st.lang = b.dataset.lang; st.teacherId = null; SS().render(root); });
        root.querySelector('.sv-ctl [data-rules]')?.addEventListener('click', rulesDrawer);
        return root.querySelector('[data-body]');
    }
    function navBox(label, aria = 'Sana') {
        return `<div class="sv-mon" role="group" aria-label="${aria}"><button type="button" data-d="-1" aria-label="Oldingi">‹</button><span>${label}</span><button type="button" data-d="1" aria-label="Keyingi">›</button></div>`;
    }
    function bindNav(root, step, reload) {
        const st = SS().state;
        root.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const d = Number(b.dataset.d); st.date = d === 0 ? U().today() : U().addDays(st.date, d * step); reload(); });
    }
    const dayLabel = d => `${d === U().today() ? 'Bugun · ' : ''}${U().DAY[U().wd(d) - 1]}, ${dm(d)}`;
    const weekLabel = from => `${dm(from)} – ${dm(U().addDays(from, 6))}`;
    // Sarlavhadagi hafta nomi: faqat joriy haftada "Bu hafta", boshqasida — qo'shni hafta nomi yoki sana oralig'i.
    const weekTitle = from => { const cur = U().weekStart(U().today()); return from === cur ? 'Bu hafta' : from === U().addDays(cur, -7) ? 'O\'tgan hafta' : from === U().addDays(cur, 7) ? 'Keyingi hafta' : weekLabel(from); };

    // ── Kirish ───────────────────────────────────────────────────────────────
    function owns(view) { return V2_VIEWS.includes(view) && role() !== 'sales_manager'; }
    function defaultView() {
        const r = role();
        if (r === 'teacher') return isAssistant() ? 'advice' : 'mine';
        return 'day';
    }
    async function render(root, ctx) {
        const st = SS().state, r = role();
        if (r === 'teacher' && isAssistant() && st.view !== 'advice') st.view = 'advice';
        if (r === 'teacher' && !isAssistant() && !['tday', 'mine', 'tmonth'].includes(st.view)) st.view = 'mine';
        const reload = () => SS().render(root);
        try {
            if (st.view === 'advice') return await adviceView(root, reload);
            if (['tday', 'mine', 'tmonth'].includes(st.view)) return await teacherView(root, reload);
            if (st.view === 'week') return await teacherWeekAdmin(root, reload);
            return await dayBoard(root, reload);
        } catch (e) {
            const b = root.querySelector('[data-body]') || root;
            b.innerHTML = `<div class="sc-err">${U().esc(e.message)}</div>`;
        }
    }
    function mgrTabs() {
        return isFull() ? [['day', 'Kun · ustozlar'], ['week', 'Hafta · bitta ustoz'], ['requests', 'So\'rovlar'], ['makeups', 'Qoplash']]
            : [['day', 'Kun · ustozlar'], ['week', 'Hafta · bitta ustoz']];
    }
    const langName = l => (l === 'russian' ? 'Rus tili' : 'Ingliz tili');

    // ═══ Admin / ROP: kun · ustozlar ═══════════════════════════════════════════
    async function dayBoard(root, reload) {
        const st = SS().state, { api, esc, hm, addDays, today, nowMin, staffAvatar, studentAvatar } = U();
        const canPick = SS().canPickLang();
        const body = header(root, { title: 'Dars jadvali',
            sub: `Barcha ustozlar · ${langName(st.lang)} · vaqt Toshkent bo'yicha · ${isRop() ? 'ROP: hamma ustoz, sinov va menejerlar · vaqtni ochish/yopish faqat adminda' : 'yagona jadval, har rol o\'z vakolatida ko\'radi'}`,
            tabs: mgrTabs(), nav: navBox(dayLabel(st.date)), lang: canPick,
            right: isRop() ? '<button type="button" class="sc-btn sc-btn--pri sv-big" data-book>+ Sinov darsi qo\'yish</button>' : '' });
        bindNav(root, 1, reload);
        root.querySelector('[data-book]')?.addEventListener('click', () => { st.view = 'free'; SS().render(root); });
        const date = st.date, next = addDays(date, 1);
        const [d, plan] = await Promise.all([api(`/schedule?from=${date}&to=${next}&lang=${st.lang}`), api(`/assist/plan?from=${date}&to=${date}&lang=${st.lang}`).catch(() => null)]);
        const tmap = new Map((d.teachers || []).map(t => [t.id, t]));
        const tname = id => tmap.get(id)?.name || U().teacherName(id);
        const mgr = new Map((d.managers || []).map(m => [m.id, m.name]));
        const todayViews = d.views.filter(v => v.date === date && (v.items.length || (v.work.length && !v.noHours))).sort((a, b) => tname(a.teacherId).localeCompare(tname(b.teacherId)));
        const all = todayViews.flatMap(v => v.items.map(i => ({ ...i, teacherId: v.teacherId, date })));
        const lessons = all.filter(i => i.kind === 'lesson' || i.kind === 'makeup');
        const L = lessons.map(i => ({ i, l: look(i, date) }));
        const isToday = date === today(), isPast = date < today();
        const doneN = L.filter(x => x.l.st === 'ok').length, nowN = L.filter(x => x.l.st === 'now').length, missN = L.filter(x => x.l.st === 'no').length, unN = L.filter(x => x.l.st === 'un').length;
        const unassigned = (d.unassigned || []).filter(u => u.date === date);
        const trialsAll = d.views.flatMap(v => v.items.filter(i => i.kind === 'trial').map(i => ({ ...i, teacherId: v.teacherId, date: v.date })))
            .concat((d.unassigned || []).map(u => ({ ...u, kind: 'trial', unassigned: true })));
        const trialsToday = trialsAll.filter(t => t.date === date), trialsTom = trialsAll.filter(t => t.date === next);
        const trialWait = trialsToday.filter(t => !t.unassigned && t.status === 'confirmed' && when(date, t).past).length;
        const asst = plan?.items || [];
        const contacts = asst.filter(a => a.kind === 'contact');
        const kpi = (dot, label, val, subtxt) => `<div class="sv-kpi"><div class="sv-kl">${dot ? `<i class="sv-dot" style="background:${dot}"></i>` : ''}${label}</div><b>${val}</b><span>${subtxt}</span></div>`;
        const assistants = (plan?.assistants || []).filter(a => asst.some(x => x.assistantId === a.id));
        const asLine = assistants.map(a => {
            const its = asst.filter(x => x.assistantId === a.id);
            const c = its.filter(x => x.kind === 'contact'), ok = c.filter(x => x.outcome !== 'no_answer').length, na = c.length - ok, adv = its.filter(x => x.kind === 'advice').length;
            return `${esc(short(a.name))} ${isToday ? 'bugun' : dm(date)} ${its.length} tavsiya: <b>${ok} bajarildi</b>${na ? ` · ${na} javob bermadi` : ''}${adv ? ` · ${adv} ${isPast ? 'qolib ketdi' : 'rejada'}` : ''}`;
        }).join(' · ');
        let showFree = st.showFree !== false, hideAs = !!st.hideAssist;
        const trialLeft = todayViews.reduce((n, v) => n + sum(isToday ? subtract(v.trialFree || [], [{ start: 0, end: nowMin() }]) : isPast ? [] : v.trialFree || []), 0);
        const views0 = todayViews.concat(unassigned.length ? [{ items: unassigned, work: [] }] : []);
        const range = fit(views0, asst);
        const pct = m => ((Math.max(range[0], Math.min(range[1], m)) - range[0]) / (range[1] - range[0]) * 100);
        const pos = (s, e) => `left:${pct(s).toFixed(3)}%;width:calc(${(pct(e) - pct(s)).toFixed(3)}% - 3px)`;
        const hb = (s, e, cls, t, sub, attrs = '', title = '') => `<${attrs ? 'button type="button"' : 'div'} class="sv-hb ${cls}" style="${pos(s, e)}"${attrs} title="${esc(title || `${hm(s)}–${hm(e)} · ${t}${sub ? ' · ' + sub : ''}`)}">${t ? esc(t) : ''}${sub ? `<small>${esc(sub)}</small>` : ''}</${attrs ? 'button' : 'div'}>`;
        const draw = () => {
            showFree = st.showFree !== false; hideAs = !!st.hideAssist;
            let axis = ''; for (let h = range[0] / 60; h < range[1] / 60; h++) axis += `<span style="left:${pct(h * 60).toFixed(3)}%">${String(h).padStart(2, '0')}:00</span>`;
            const row = (label, track, cls = '') => `<div class="sv-hr ${cls}"><div class="sv-hl">${label}</div><div class="sv-ht2">${track}</div></div>`;
            const unRow = unassigned.length ? row(`<span><b>Biriktirilmagan</b><small>sinovlar · ${unassigned.length}</small></span>`, unassigned.map(u => hb(u.start, u.end, 'k-tr k-un2', first(u.leadName), 'ustoz yo\'q', ` data-un="${esc(u.leadId)}"`)).join(''), 'is-un') : '';
            const tRows = todayViews.map(v => {
                const bl = teacherBlocks(v, range, { free: showFree, names: true, assist: hideAs ? [] : asst.filter(a => a.assistantId === v.teacherId) });
                const tr = bl.map(b => hb(b.start, b.end, b.cls, b.t, b.s, b.click || b.attrs?.includes('data-st') ? b.attrs : '')).join('');
                const nL = v.items.filter(i => i.kind === 'lesson' || i.kind === 'makeup').length;
                const nA = asst.filter(a => a.assistantId === v.teacherId).length;
                return row(`${staffAvatar(tmap.get(v.teacherId) || { id: v.teacherId }, 30)}<span><button type="button" class="sc-link" data-t="${esc(v.teacherId)}">${esc(tname(v.teacherId))}</button><small>asosiy · ${nL} dars${nA ? ` + ${nA} aloqa` : ''}</small></span>`, tr);
            }).join('');
            const aRows = hideAs ? '' : assistants.filter(a => !todayViews.some(v => v.teacherId === a.id)).map(a => {
                const its = asst.filter(x => x.assistantId === a.id);
                const tr = its.map(x => {
                    const s = studentAvatar(U().studentById(x.studentId) || { name: x.studentName }, 22);
                    const done = x.kind === 'contact';
                    return `<button type="button" class="sv-hb ${done ? (x.outcome === 'no_answer' ? 'k-as k-asn' : 'k-as') : 'k-asw'} sv-hav" style="${pos(x.start, Math.max(x.end, x.start + 20))}" data-st="${esc(x.studentId)}" title="${esc(`${hm(x.start)} · ${x.studentName} · ${done ? (x.outcome === 'no_answer' ? 'javob bermadi' : `${CH[x.channel] || ''} ${x.minutes} daq`) : 'tavsiya'}`)}">${s}</button>`;
                }).join('');
                return row(`${staffAvatar({ id: a.id }, 30)}<span><b>${esc(a.name)}</b><small>yordamchi · ${its.length} aloqa</small></span>`, tr, 'is-as');
            }).join('');
            const nowM = nowMin();
            const nowLine = isToday && nowM >= range[0] && nowM <= range[1] ? `<i class="sv-hnow" style="left:calc(var(--hl) + (100% - var(--hl)) * ${(pct(nowM) / 100).toFixed(4)})"><em>${hm(nowM)}</em></i>` : '';
            return `<div class="sv-hw"><div class="sv-hbd"><div class="sv-hr sv-hax"><div class="sv-hl">Ustoz</div><div class="sv-ht2">${axis}</div></div>${unRow}${tRows}${aRows}${nowLine}</div></div>`;
        };
        const nowList = L.filter(x => x.l.st === 'now').map(x => x.i);
        const attention = [
            ...unassigned.map(u => { const freeT = todayViews.filter(v => (v.trialFree || []).some(f => f.start <= u.start && u.end <= f.end)).map(v => short(tname(v.teacherId))); return { t: u.start, h: `<b>${esc(u.leadName)} · sinov</b><small>ustoz yo'q${freeT.length ? ` · ${esc(freeT.slice(0, 2).join(', '))} ${hm(u.start)} bo'sh` : ''}</small>`, act: `<button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-un="${esc(u.leadId)}">Biriktirish</button>` }; }),
            ...L.filter(x => x.l.st === 'un').map(x => ({ t: x.i.start, h: `<b><button type="button" class="sc-link" data-st="${esc(x.i.studentId)}">${esc(first(x.i.studentName))}</button> · ${esc(short(tname(x.i.teacherId)))}</b><small>belgilanmagan</small>` })),
            ...trialsToday.filter(t => !t.unassigned && t.status === 'confirmed' && when(date, t).past).map(t => ({ t: t.start, h: `<b>${esc(first(t.leadName) || 'Lid')} · sinov natijasi</b><small>${esc(short(tname(t.teacherId)))} yozmagan</small>` })),
            ...L.filter(x => x.l.st === 'no').map(x => ({ t: x.i.start, h: `<b><button type="button" class="sc-link" data-st="${esc(x.i.studentId)}">${esc(first(x.i.studentName))}</button> · ${esc(short(tname(x.i.teacherId)))}</b><small>kelmadi · qoplanmagan</small>` }))
        ];
        const trialPill = t => t.unassigned ? ['Ustoz yo\'q', 'sc-pill--warn'] : t.status === 'pending' ? ['Tasdiq kutilmoqda', 'sc-pill--info'] : t.status === 'hold' ? ['Ushlab turilgan', 'sc-pill--mute'] : t.status === 'confirmed' && when(t.date, t).past ? ['Natija kutilmoqda', 'sc-pill--warn'] : t.status === 'done' ? ['O\'tkazildi', 'sc-pill--ok'] : t.status === 'no_show' ? ['Lid kelmadi', 'sc-pill--mute'] : ['Tasdiqlangan', 'sc-pill--ok'];
        const trialRow = t => { const p = trialPill(t); return `<div class="sv-li"><span class="sv-tm">${t.date === date ? '' : `<small>${U().DAY[U().wd(t.date) - 1]}</small>`}${hm(t.start)}</span><span class="sc-grow"><b>${esc(t.leadName || 'Lid')}</b><small>${[t.unassigned ? 'ustoz biriktirilmagan' : short(tname(t.teacherId)), isRop() && mgr.get(t.managerId) ? first(mgr.get(t.managerId)) : ''].filter(Boolean).map(esc).join(' · ')}</small></span><span class="sc-pill ${p[1]}">${p[0]}</span></div>`; };
        const managersPanel = () => {
            const by = new Map(); for (const t of [...trialsToday, ...trialsTom]) { const k = t.managerId || ''; if (!by.has(k)) by.set(k, []); by.get(k).push(t); }
            const ids = [...new Set([...(d.managers || []).map(m => m.id), ...by.keys()])].filter(Boolean);
            return `<section class="sc-card sv-pn"><h3 class="sv-ph">Menejerlar · bugun va ertaga</h3>${ids.map(id => { const ts = by.get(id) || []; return `<div class="sv-li"><span class="sc-grow"><b>${esc(mgr.get(id) || 'Menejer')}</b><small>${ts.length ? ts.map(t => `${esc(first(t.leadName) || 'Lid')} ${t.date === date ? 'bugun' : U().DAY[U().wd(t.date) - 1]} ${hm(t.start)}${t.unassigned ? ' (ustozsiz)' : ''}`).join(' · ') : 'bugun va ertaga sinov yo\'q'}</small></span><span class="sv-cnt">${ts.length}</span></div>`; }).join('') || '<p class="sc-mt sv-pp">Menejer yo\'q</p>'}
              <p class="sc-mt sv-pp">Bir vaqtni ikki menejer band qila olmaydi: ushlab turilgan vaqt hammaga "tanlanmoqda" bo'lib ko'rinadi.</p></section>`;
        };
        body.innerHTML = `<div class="sv-kpis">${kpi('', isToday ? 'Bugungi darslar' : 'Darslar', lessons.length, `${todayViews.filter(v => v.items.some(i => i.kind === 'lesson')).length} ustoz · ${lessons.filter(i => i.kind === 'makeup').length} qoplash${lessons.filter(i => i.double).length ? ` · ${lessons.filter(i => i.double).length} qo'shaloq` : ''}`)}
            ${kpi('#12B76A', 'O\'tildi', doneN, `${lessons.length ? Math.round(doneN / lessons.length * 100) : 0}% · keldi deb belgilangan`)}
            ${kpi('#0065D6', 'Hozir darsda', nowN, isToday ? `${hm(nowMin())} holatiga` : '—')}
            ${kpi('#D92D20', 'Qoldirildi', missN, 'kelmadi · qoplash mumkin')}
            ${kpi('#F79009', 'Belgilanmagan', unN, 'dars tugagan, ustoz belgilamagan')}
            ${kpi('#7A5AF8', 'Sinov darslari', trialsToday.length, `${trialWait} natija kutilmoqda · ${unassigned.length} ustozsiz`)}</div>
          ${assistants.length ? `<div class="sc-card sv-strip"><span class="sc-pill sv-pill-teal">Yordamchi aloqalari</span><span class="sc-grow">darslar soniga kirmaydi · ${asLine}</span>${isFull() ? '<button type="button" class="sc-link" data-assist>Batafsil →</button>' : ''}</div>` : ''}
          <section class="sc-card sv-board"><header class="sv-bh"><h2>${isToday ? 'Bugun' : esc(dm(date))} · ustozlar bo'yicha</h2><span class="sc-grow"></span>
              <label class="sv-tgl"><input type="checkbox" data-free${showFree ? ' checked' : ''}><i></i>Sinov uchun bo'sh vaqtlar</label>
              ${assistants.length ? `<label class="sv-tgl"><input type="checkbox" data-hideas${hideAs ? ' checked' : ''}><i></i>Yordamchilarni yashirish</label>` : ''}
              ${isPast ? '' : `<span class="sc-pill sc-pill--ok">${isToday ? 'Bugun yana' : 'Shu kuni'} ${hours(trialLeft)} sinovga ochiq</span>`}</header>
            <div data-board>${todayViews.length || unassigned.length ? draw() : '<p class="sc-mt sv-pp">Bu kunda ish vaqti belgilangan ustoz yo\'q. "Hafta · bitta ustoz" → "Ish vaqti shabloni" orqali kiriting.</p>'}</div>
            ${legend([['k-ok', 'Keldi'], ['k-no', 'Kelmadi'], ['k-un', 'Belgilanmagan'], ['k-now', 'Hozir'], ['k-wait', 'Kutilmoqda'], ['k-mk', 'Qoplash'], ['k-tr', 'Sinov darsi'], ['k-free', 'Bo\'sh · sinovga ochiq'], ['k-freex', 'Admin qo\'shgan vaqt'], ['k-free2', 'Bo\'sh · sinovga yopiq'], ['k-off', 'Ish vaqti emas'], ['k-as', 'Yordamchi aloqasi · darslar soniga kirmaydi (avatar — o\'quvchi)']])}</section>
          <div class="sv-g3">
            <section class="sc-card sv-pn"><h3 class="sv-ph">Hozir darsda · ${nowList.length}</h3>${nowList.map(i => `<div class="sv-li"><span class="sv-tm">${hm(i.start)}</span><span class="sc-grow"><b><button type="button" class="sc-link" data-st="${esc(i.studentId)}">${esc(first(i.studentName))}</button> · ${esc(short(tname(i.teacherId)))}</b><small>${i.end - i.start} daq · ${i.end - nowMin()} daq qoldi</small></span></div>`).join('') || `<p class="sc-mt sv-pp">${isToday ? 'Hozir dars yo\'q' : 'Faqat bugungi kunda ko\'rinadi'}</p>`}</section>
            ${isRop() ? managersPanel() : `<section class="sc-card sv-pn"><h3 class="sv-ph">E'tibor kerak · ${attention.length}</h3>${attention.sort((a, b) => a.t - b.t).map(a => `<div class="sv-li"><span class="sv-tm">${hm(a.t)}</span><span class="sc-grow">${a.h}</span>${a.act || ''}</div>`).join('') || '<p class="sc-mt sv-pp">Hammasi joyida</p>'}</section>`}
            <section class="sc-card sv-pn"><h3 class="sv-ph">Sinov darslari · ${isToday ? 'bugun' : dm(date)} ${trialsToday.length} · ertaga ${trialsTom.length}</h3>${[...trialsToday, ...trialsTom].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start).map(trialRow).join('') || '<p class="sc-mt sv-pp">Sinov yo\'q</p>'}
              <p class="sc-mt sv-pp">Natijasi yozilgan sinov jadvaldan chiqadi — tarixi "Sinov darslari" bo'limida.</p></section>
          </div>`;
        const bind = () => {
            body.querySelectorAll('[data-st]').forEach(b => b.onclick = () => U().openStudent(b.dataset.st));
            body.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { st.teacherId = b.dataset.t; st.view = 'week'; SS().render(root); });
            body.querySelectorAll('[data-un]').forEach(b => b.onclick = () => unassignedDrawer(unassigned.find(u => u.leadId === b.dataset.un), todayViews, tname, mgr));
            body.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => typeof switchTab === 'function' && switchTab('trial-lessons'));
        };
        bind();
        body.querySelector('[data-assist]')?.addEventListener('click', () => typeof switchTab === 'function' && switchTab('school-assist'));
        const redraw = () => { const el = body.querySelector('[data-board]'); if (todayViews.length || unassigned.length) el.innerHTML = draw(); bind(); };
        body.querySelector('[data-free]').onchange = e => { st.showFree = e.target.checked; redraw(); };
        body.querySelector('[data-hideas]')?.addEventListener('change', e => { st.hideAssist = e.target.checked; redraw(); });
    }
    function unassignedDrawer(u, views, tname, mgr) {
        if (!u) return;
        const { openDrawer, esc, hm } = U();
        const freeT = views.filter(v => (v.trialFree || []).some(f => f.start <= u.start && u.end <= f.end));
        const box = openDrawer({ title: `${u.leadName} · sinov`, sub: `${esc(dm(u.date))} · ${hm(u.start)}–${hm(u.end)}${mgr.get(u.managerId) ? ' · menejer ' + esc(mgr.get(u.managerId)) : ''}`, body: `
            <div class="sc-note sc-note--warn">Bu sinovga hali ustoz biriktirilmagan.</div>
            <div class="sc-sec"><h3>Shu vaqtda bo'sh ustozlar</h3>${freeT.length ? `<ul class="sc-hist">${freeT.map(v => `<li>${esc(tname(v.teacherId))} · ${hm(u.start)} bo'sh</li>`).join('')}</ul>` : '<p class="sc-mt">Shu vaqtda sinovga ochiq ustoz yo\'q — vaqtni o\'zgartirish yoki admin vaqt ochishi kerak.</p>'}</div>
            <p class="sc-mt">Ustoz lid oynasida (Sinov darslari bo'limi) biriktiriladi — server vaqt to'qnashuvini tekshiradi.</p>`,
            foot: '<button type="button" class="sc-btn" data-close>Yopish</button><button type="button" class="sc-btn sc-btn--pri" data-go>Sinov darslari bo\'limiga</button>' });
        box.querySelector('[data-go]').onclick = () => { U().closeDrawer(); if (typeof switchTab === 'function') switchTab('trial-lessons'); };
    }

    // ═══ Admin / ROP: hafta · bitta ustoz ══════════════════════════════════════
    async function teacherWeekAdmin(root, reload) {
        const st = SS().state, { api, esc, hm, addDays, weekStart, today, nowMin, DAY, DAY_FULL, staffAvatar } = U();
        const teachers = U().teachersForSubject(st.lang);
        if (!teachers.some(t => t.id === st.teacherId)) st.teacherId = teachers[0]?.id || null;
        const from = weekStart(st.date), to = addDays(from, 6);
        const t = teachers.find(x => x.id === st.teacherId);
        // AdminJadvalUstoz: "← Barcha ustozlar" sarlavha ustida, o'ngda Kun/Hafta · ustoz · hafta (til — "Kun · ustozlar"da tanlanadi).
        const body = header(root, { title: t ? `${U().esc(t.name)} · haftalik jadval` : 'Hafta · bitta ustoz', inline: true, back: true,
            sub: `<span data-wsub>${langName(st.lang)} · vaqt Toshkent bo'yicha${isRop() ? ' · vaqtni ochish/yopish faqat adminda' : ''}</span>`,
            tabs: [['day', 'Kun · ustozlar'], ['week', 'Hafta · bitta ustoz']],
            nav: `${teachers.length ? `<label class="sv-tsel">${t ? staffAvatar(t, 26) : ''}<select data-tid aria-label="Ustoz">${teachers.map(x => `<option value="${esc(x.id)}"${x.id === st.teacherId ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : ''}${navBox(weekLabel(from), 'Hafta')}` });
        bindNav(root, 7, reload);
        root.querySelector('[data-back]').onclick = () => { st.view = 'day'; SS().render(root); };
        root.querySelector('[data-tid]')?.addEventListener('change', e => { st.teacherId = e.target.value; reload(); });
        if (!st.teacherId) { body.innerHTML = '<p class="sc-mt">Bu yo\'nalishda ustoz yo\'q</p>'; return; }
        const tid = st.teacherId;
        const [d, hrs, plan, chg] = await Promise.all([api(`/schedule?from=${from}&to=${to}&teacherId=${encodeURIComponent(tid)}&lang=${st.lang}`),
            api(`/teachers/${encodeURIComponent(tid)}/hours`).catch(() => ({ hours: [] })), api(`/assist/plan?from=${from}&to=${to}&assistantId=${encodeURIComponent(tid)}&lang=${st.lang}`).catch(() => null),
            api(`/teachers/${encodeURIComponent(tid)}/changes`).catch(() => ({ changes: [] }))]);
        const views = d.views;
        const asst = plan?.items || [];
        const days = weekDays(from, views);
        const range = fit(views, asst);
        const vBy = new Map(views.map(v => [v.date, v]));
        // KPI
        const work = views.reduce((n, v) => n + (v.noHours ? 0 : sum(v.work)), 0);
        const opened = views.reduce((n, v) => n + sum(v.opens || []), 0);
        const items = views.flatMap(v => v.items.map(i => ({ ...i, date: v.date })));
        const les = items.filter(i => i.kind === 'lesson' || i.kind === 'reserved'), mk = items.filter(i => i.kind === 'makeup'), tr = items.filter(i => i.kind === 'trial');
        const trialOpen = views.reduce((n, v) => n + sum(v.trialFree || []), 0);
        const trialAfter = views.reduce((n, v) => n + (v.date < today() ? 0 : sum(v.date === today() ? subtract(v.trialFree || [], [{ start: 0, end: nowMin() }]) : v.trialFree || [])), 0);
        const closedM = views.reduce((n, v) => n + sum(intersect(v.items.filter(i => i.kind === 'close' || i.kind === 'leave'), v.work)), 0);
        const moM = views.reduce((n, v) => n + sum(v.makeupOnly || []), 0);
        const notTrial = views.reduce((n, v) => n + sum(subtract(v.free || [], v.trialFree || [])), 0);
        const kpi = (dot, l, v, s) => `<div class="sv-kpi"><div class="sv-kl">${dot ? `<i class="sv-dot" style="background:${dot}"></i>` : ''}${l}</div><b>${v}</b><span>${s}</span></div>`;
        // Ish vaqti shabloni (bir xil soatlar guruhlanadi).
        const grp = new Map(); for (const h of hrs.hours || []) { const k = `${hm(h.start_min)} – ${hm(h.end_min)}${h.trial_open === false ? ' · sinovga yopiq' : ''}`; if (!grp.has(k)) grp.set(k, []); grp.get(k).push(Number(h.weekday)); }
        const offDays = [1, 2, 3, 4, 5, 6, 7].filter(w => !(hrs.hours || []).some(h => Number(h.weekday) === w));
        // Sarlavha izohi (dizayn): "Asosiy ustoz · Ingliz tili · 8 o'quvchi + 2 yordamchi · ish vaqti Du–Sh (o'quvchilari Du·Ch·Ju va Se·Pa·Sh)".
        const mine = (typeof getItem === 'function' ? getItem(STORAGE_KEYS.students, []) || [] : []).filter(x => x.teacherId === tid && !x.isStaffDemo && x.status !== 'inactive');
        const asIds = new Set(mine.map(x => x.assistantTeacherId).filter(Boolean));
        const wdays = [...new Set((hrs.hours || []).map(h => Number(h.weekday)))].sort((a, b) => a - b);
        const contig = wdays.length > 2 && wdays.every((w, k) => !k || w === wdays[k - 1] + 1);
        const pats = [...new Set(mine.map(x => Number(x.lessonDayOfWeek ?? x.schedule?.day)).filter(n => n === 1 || n === 2))].sort().map(n => (n === 1 ? 'Du·Ch·Ju' : 'Se·Pa·Sh'));
        const subEl = root.querySelector('[data-wsub]');
        if (subEl) subEl.textContent = [t?.role === 'yordamchi' ? 'Yordamchi ustoz' : 'Asosiy ustoz', langName(st.lang), `${mine.length} o'quvchi${asIds.size ? ` + ${asIds.size} yordamchi` : ''}`,
            wdays.length ? `ish vaqti ${contig ? `${DAY[wdays[0] - 1]}–${DAY[wdays[wdays.length - 1] - 1]}` : wdays.map(w => DAY[w - 1]).join('·')}${pats.length ? ` (o'quvchilari ${pats.join(' va ')})` : ''}` : 'ish vaqti kiritilmagan',
            ...(isRop() ? ['vaqtni ochish/yopish faqat adminda'] : [])].join(' · ');
        // "O'zgarishlar tarixi" — server (ochish/yopish, shablon, sinov band qilish, qoplash), kim · qachon · sabab.
        const ROLE_L = { admin: 'admin', boshliq: 'boshliq', rop: 'ROP', sales_manager: 'sotuv', teacher: 'ustoz' };
        const OV_ADD = { open: 'sinov uchun ochdi', close: 'sinovdan yopdi', leave: 'ish vaqtidan chiqardi', makeup_only: 'faqat qoplash uchun qoldirdi' };
        const OV_DEL = { open: 'ochishni bekor qildi', close: 'qayta ochdi (sinovga)', leave: 'ish vaqtiga qaytardi', makeup_only: 'qayta ochdi (sinovga)' };
        const TR_ST = { pending: 'ustoz tasdig\'i kutilmoqda', accepted: 'tasdiqlandi', rejected: 'ustoz rad etdi', attended: 'o\'tkazildi', absent: 'lid kelmadi' };
        const ago = iso => { const x = new Date(new Date(iso).getTime() + 5 * 3600000), dd = x.toISOString().slice(0, 10), tm = x.toISOString().slice(11, 16);
            return `${dd === today() ? 'bugun' : dd === addDays(today(), -1) ? 'kecha' : dm(dd)} ${tm}`; };
        const whenTxt = e => e.date ? `${DAY[U().wd(e.date) - 1]} ${dm(e.date)}` : e.weekday ? `har ${DAY_FULL[e.weekday - 1].toLowerCase()}` : '';
        const tpl = list => { const g = new Map(); for (const h of list || []) { const k = `${hm(h.start_min)}–${hm(h.end_min)}`; if (!g.has(k)) g.set(k, []); g.get(k).push(DAY[h.weekday - 1]); } return [...g.entries()].map(([k, ds]) => `${ds.join('·')} ${k}`).join(', ') || 'bo\'sh'; };
        const histLi = e => {
            const who = `<b>${esc(first(e.by) || 'Tizim')}</b>${ROLE_L[e.role] ? ` (${ROLE_L[e.role]})` : ''}`;
            if (e.type === 'override') return `<li>${who} · ${whenTxt(e)} ${hm(e.start)}–${hm(e.end)} ${(e.action === 'remove' ? OV_DEL : OV_ADD)[e.kind] || e.kind}<small>${ago(e.at)}${e.reason ? ` · "${esc(e.reason)}"` : ''} · ${e.date ? 'faqat shu sana' : 'har hafta'}</small></li>`;
            if (e.type === 'hours') return `<li>${who} · ish vaqti shablonini o'zgartirdi<small>${ago(e.at)} · ${esc(tpl(e.after))}</small></li>`;
            if (e.type === 'trial') return `<li>${who} · ${whenTxt(e)} ${hm(e.start)} ${esc(first(e.name) || 'lid')} sinovini band qildi<small>${ago(e.at)} · ${TR_ST[e.state] || esc(e.state || '')}</small></li>`;
            if (e.type === 'booking') return `<li>${who} · ${whenTxt(e)} ${hm(e.start)} ${esc(first(e.name) || 'o\'quvchi')} ${e.kind === 'makeup' ? 'qoplash darsini qo\'ydi' : 'bir martalik dars qo\'ydi'}<small>${ago(e.at)}${e.status === 'cancelled' ? ' · bekor qilingan' : ''}</small></li>`;
            return '';
        };
        const histHtml = (chg.changes || []).slice(0, 6).map(histLi).join(''); // dizayndagidek oxirgi 6 ta
        const cols = days.map(date => {
            const v = vBy.get(date) || { date, items: [], work: [], free: [], trialFree: [], opens: [], makeupOnly: [] };
            return { date, label: DAY[U().wd(date) - 1], blocks: teacherBlocks(v, range, { clickFree: isFull(), clickOv: isFull(), assist: asst.filter(a => a.date === date) }) };
        });
        body.innerHTML = `<div class="sv-kpis sv-k5">${kpi('', 'Ish vaqti · hafta', hours(work), `shablon ${hours(work - opened)}${opened ? ` + admin ochgan ${hours(opened)}` : ''}`)}
            ${kpi('#0065D6', 'Darslar', les.length + mk.length, `${hours(sum(les) + sum(mk))} · +${mk.length} qoplash${asst.length ? ` · ${asst.length} aloqa alohida` : ''}`)}
            ${kpi('#7A5AF8', 'Sinov darslari', tr.length, `${tr.filter(i => i.status === 'confirmed' && when(i.date, i).past).length} natija kutilmoqda · ${tr.filter(i => i.status === 'pending').length} tasdiq kutilmoqda`)}
            ${kpi('#12B76A', 'Sinovga ochiq', hours(trialOpen), `hozirdan keyin ${hours(trialAfter)}`)}
            ${kpi('#98A2B3', 'Sinovga yopiq', hours(closedM + moM + notTrial), `yopilgan ${hours(closedM)}${moM ? ` · faqat qoplash ${hours(moM)}` : ''}${notTrial ? ` · boshqa ${hours(notTrial)}` : ''}`)}</div>
          <div class="sv-lay">
            <section class="sc-card sv-wcard"><header class="sv-bh"><h2>${weekLabel(from)}</h2><span class="sc-grow"></span><span class="sc-mt">${isFull() ? 'Bo\'sh joyni bosing → ochish / yopish · darsni bosing → o\'quvchi kartasi' : 'Darsni bosing → o\'quvchi kartasi'}</span></header>
              ${vgrid(cols, range)}${legend(legendT(asst))}</section>
            <div class="sv-side">
              <section class="sc-card" data-panel></section>
              <section class="sc-card"><header class="sv-bh"><h2>Ish vaqti shabloni</h2><span class="sc-grow"></span>${isFull() ? '<button type="button" class="sc-btn sc-btn--sm" data-hours>Tahrirlash</button>' : ''}</header>
                <dl class="sv-dl3">${[...grp.entries()].map(([k, ws]) => `<dt>${ws.sort().map(w => DAY[w - 1]).join(' · ')}</dt><dd>${esc(k)}</dd>`).join('') || '<dt>—</dt><dd>Ish vaqti kiritilmagan</dd>'}
                  ${offDays.length && (hrs.hours || []).length ? `<dt>${offDays.map(w => DAY_FULL[w - 1]).join(', ')}</dt><dd>dam olish</dd>` : ''}<dt>Sinov uchun</dt><dd>ish vaqtidagi barcha bo'sh joy, istisnolar bilan</dd></dl></section>
              <section class="sc-card"><header class="sv-bh"><h2>O'zgarishlar tarixi</h2></header><ul class="sv-hist">${histHtml || '<li class="sc-mt">Oxirgi 30 kunda o\'zgarish yo\'q</li>'}</ul></section>
            </div></div>`;
        const panel = body.querySelector('[data-panel]');
        const idle = () => {
            panel.innerHTML = `<header class="sv-bh"><h2>Tanlangan vaqt</h2></header><div class="sv-ed"><p class="sc-mt">${isFull() ? 'Jadvaldagi bo\'sh joyni, "ish vaqti emas" yoki yopilgan vaqtni bosing — shu yerda ochish / yopish mumkin.' : 'ROP jadvalni ko\'radi; vaqtni ochish va yopish adminda.'}</p>
              ${isFull() ? '<button type="button" class="sc-btn" data-ov-new>Boshqa sana uchun ochish / yopish</button>' : ''}</div>`;
            panel.querySelector('[data-ov-new]')?.addEventListener('click', () => SS()._.overrideDrawer(tid, reload));
        };
        idle();
        body.querySelector('[data-hours]')?.addEventListener('click', () => SS()._.hoursDrawer(tid, reload));
        body.querySelectorAll('[data-st]').forEach(b => b.onclick = () => U().openStudent(b.dataset.st));
        body.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => typeof switchTab === 'function' && switchTab('trial-lessons'));
        if (!isFull()) return;
        const select = el => { body.querySelectorAll('.sv-b.selx').forEach(x => x.classList.remove('selx')); el.classList.add('selx'); };
        // Ochish / yopish yozuvlari (shu haftadagi): bosilganda joriy holat, sabab, kim · qachon.
        const ovAll = new Map();
        for (const v of views) {
            for (const i of v.items.filter(x => x.overrideId)) ovAll.set(i.overrideId, { ...i, kind: i.kind });
            for (const o of v.opens || []) ovAll.set(o.overrideId, { ...o, kind: 'open' });
            for (const o of v.makeupOnly || []) ovAll.set(o.overrideId, { ...o, kind: 'makeup_only' });
        }
        const CUR = { close: 'sinovga yopiq', leave: 'ish vaqtidan chiqarilgan', open: 'admin ochgan', makeup_only: 'faqat qoplash' };
        // "Tanlangan vaqt" (AdminJadvalUstoz): Nima qilamiz? · Qachonga? · Sabab · Qayta ochish / O'zgarishni saqlash.
        // Vaqt oralig'i sarlavhadagi soatlarda tahrirlanadi (bo'sh blok uzun bo'lsa, kerakli qismini tanlash uchun).
        const slotPanel = (date, s, e, mode, ovid) => {
            const wdN = U().wd(date);
            const ex = ovid ? ovAll.get(ovid) : null;
            const isOpen = mode === 'off' || ex?.kind === 'open';
            const OPTS = isOpen ? [['open', 'Qo\'shimcha ochish', 'Shablondan tashqari — sotuv shu vaqtga sinov qo\'ya oladi']]
                : [['close', 'Sinovga yopish', 'Ustoz ishlaydi, lekin sotuv bu vaqtni band qila olmaydi'], ['leave', 'Ish vaqtidan chiqarish', 'Ustoz bu vaqtda ishlamaydi (ta\'til, kasal, shaxsiy)'], ['makeup_only', 'Faqat qoplash uchun', 'Ustoz qoldirilgan darslarni shu yerga qo\'yadi']];
            const selK = ex?.kind || OPTS[0][0];
            const a0 = ex ? ex.start : s, b0 = ex ? ex.end : e;
            const cur = ex ? [CUR[ex.kind], ex.reason, [first(ex.by), ex.at && (() => { const x = new Date(new Date(ex.at).getTime() + 5 * 3600000), dd = x.toISOString().slice(0, 10); return `${dd === today() ? 'bugun' : dm(dd)} ${x.toISOString().slice(11, 16)}`; })()].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
                : mode === 'off' ? 'ish vaqti emas' : mode === 'trial' ? 'sinovga ochiq' : 'ochiq (sinovga yopiq)';
            let rep = ex?.weekly ? 'weekly' : 'once', confirm = false;
            panel.innerHTML = `<header class="sv-bh"><h2>Tanlangan vaqt</h2><span class="sc-grow"></span><span class="sc-pill sc-pill--mute">${DAY_FULL[wdN - 1]} · ${dm(date)}</span></header>
              <div class="sv-ed"><div class="sv-slot"><b class="sv-tr"><input inputmode="numeric" maxlength="5" pattern="[0-2][0-9]:[0-5][0-9]" placeholder="00:00" name="from" value="${hm(a0)}" aria-label="Boshlanish"> – <input inputmode="numeric" maxlength="5" pattern="[0-2][0-9]:[0-5][0-9]" placeholder="00:00" name="to" value="${hm(b0)}" aria-label="Tugash"></b><small>joriy holat: ${esc(cur)}${ex?.weekly ? ' · har hafta' : ''}</small></div>
              <div class="sv-fl"><span>Nima qilamiz?</span>${OPTS.map(([k, l, h]) => `<label class="sv-rb"><input type="radio" name="ovk" value="${k}"${k === selK ? ' checked' : ''}><i></i><span><b>${l}</b><small>${h}</small></span></label>`).join('')}</div>
              <div class="sv-fl"><span>Qachonga?</span><div class="sc-seg sv-full" role="group" aria-label="Davr"><button type="button" data-rep="once" aria-pressed="${rep === 'once'}">Faqat ${dm(date)}</button><button type="button" data-rep="weekly" aria-pressed="${rep === 'weekly'}">Har ${DAY_FULL[wdN - 1].toLowerCase()}</button></div></div>
              <label class="sv-fl"><span>Sabab (ustoz va sotuv ko'radi)</span><input class="sv-inp" name="reason" value="${esc(ex?.reason || '')}" placeholder="Masalan: metodik seminar"></label>
              <div class="sv-btns">${ex ? `<button type="button" class="sc-btn" data-del>${ex.kind === 'open' ? 'Ochishni bekor qilish' : 'Qayta ochish'}</button>` : '<button type="button" class="sc-btn" data-cancel>Bekor</button>'}<button type="button" class="sc-btn sc-btn--pri" data-save>O'zgarishni saqlash</button></div></div>`;
            const ed = panel.querySelector('.sv-ed'), saveB = panel.querySelector('[data-save]');
            const reset = () => { if (!confirm) return; confirm = false; ed.querySelector('[data-conf]')?.remove(); saveB.textContent = 'O\'zgarishni saqlash'; saveB.dataset.label = saveB.textContent; };
            ed.addEventListener('input', reset); ed.addEventListener('change', reset);
            panel.querySelectorAll('[data-rep]').forEach(b => b.onclick = () => { rep = b.dataset.rep; reset(); panel.querySelectorAll('[data-rep]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
            panel.querySelector('[data-cancel]')?.addEventListener('click', () => { body.querySelectorAll('.sv-b.selx').forEach(x => x.classList.remove('selx')); idle(); });
            panel.querySelector('[data-del]')?.addEventListener('click', async ev => {
                U().busy(ev.target, true);
                try { await U().api('/overrides/' + encodeURIComponent(ovid), { method: 'DELETE' }); U().toast(ex.kind === 'open' ? 'Ochish bekor qilindi' : 'Qayta ochildi — vaqt shablondagidek'); reload(); } catch (err) { U().busy(ev.target, false); U().errBox(ed, err.message); }
            });
            saveB.addEventListener('click', async ev => {
                const v = n => panel.querySelector(`[name=${n}]`).value;
                const payload = { teacherId: tid, kind: panel.querySelector('[name=ovk]:checked').value, repeat: rep, date, weekday: wdN, from: v('from'), to: v('to'), reason: v('reason'), confirm };
                U().busy(ev.target, true);
                try {
                    if (ex) await U().api('/overrides/' + encodeURIComponent(ovid), { method: 'PUT', body: payload }); else await U().post('/overrides', payload);
                    U().toast('Saqlandi'); reload();
                } catch (err) { U().busy(ev.target, false); if (SS()._.showConflicts(ed, err, ev.target)) confirm = true; else U().errBox(ed, err.message); }
            });
            panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        };
        body.querySelectorAll('.sv-dl [data-free]').forEach(b => b.onclick = () => { const [s, e, kind] = b.dataset.free.split('|'); select(b); slotPanel(b.closest('[data-date]').dataset.date, Number(s), Number(e), kind, b.dataset.ovid); });
        body.querySelectorAll('.sv-dl [data-off]').forEach(b => b.onclick = () => { const [s, e] = b.dataset.off.split('|').map(Number); select(b); slotPanel(b.closest('[data-date]').dataset.date, Math.max(s, 7 * 60), Math.min(e, Math.max(s, 7 * 60) + 60), 'off'); });
        body.querySelectorAll('.sv-dl [data-ovk]').forEach(b => b.onclick = () => { const it = items.find(i => i.overrideId === b.dataset.ovid); select(b); slotPanel(b.closest('[data-date]').dataset.date, it?.start ?? 0, it?.end ?? 0, 'close', b.dataset.ovid); });
    }

    // ═══ Ustoz: Kun / Hafta / Oy ═══════════════════════════════════════════════
    async function teacherView(root, reload) {
        const st = SS().state, { api, esc, hm, addDays, weekStart, today, DAY, DAY_FULL } = U();
        const mode = st.view;
        const from = mode === 'tday' ? st.date : mode === 'tmonth' ? st.date.slice(0, 8) + '01' : weekStart(st.date);
        const to = mode === 'tday' ? st.date : mode === 'tmonth' ? (() => { const x = new Date(from + 'T00:00:00Z'); x.setUTCMonth(x.getUTCMonth() + 1); x.setUTCDate(0); return x.toISOString().slice(0, 10); })() : addDays(from, 6);
        const navLabel = mode === 'tday' ? dayLabel(st.date) : mode === 'tmonth' ? `${['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'][Number(from.slice(5, 7)) - 1]} ${from.slice(0, 4)}` : weekLabel(from);
        const body = header(root, { title: 'Dars jadvali', sub: '<span data-hrs>vaqt Toshkent bo\'yicha</span>',
            tabs: [['tday', 'Kun'], ['mine', 'Hafta'], ['tmonth', 'Oy']], nav: navBox(navLabel, mode === 'tmonth' ? 'Oy' : mode === 'tday' ? 'Kun' : 'Hafta'), inline: true });
        const navBtns = root.querySelectorAll('[data-d]');
        if (mode === 'tmonth') navBtns.forEach(b => b.onclick = () => { const x = new Date(from + 'T00:00:00Z'); x.setUTCMonth(x.getUTCMonth() + Number(b.dataset.d)); st.date = x.toISOString().slice(0, 10); reload(); });
        else bindNav(root, mode === 'tday' ? 1 : 7, reload);
        const tid = me().linkedTeacherId;
        api(`/teachers/${encodeURIComponent(tid || '-')}/hours`).then(r => {
            // Bitta formatlovchi (js/workHours.js) — Profil "Ish vaqti" qatori bilan bir xil matn; ustma-ust oraliqlar birlashadi.
            const txt = window.WorkHours ? window.WorkHours.text(r.hours) : '';
            const el = root.querySelector('[data-hrs]'); if (el && txt) el.textContent = `Ish vaqtingiz: ${txt} · vaqt Toshkent bo'yicha`;
        }).catch(() => {});
        const [d, plan, reqs] = await Promise.all([api(`/schedule?from=${from}&to=${to}`), api(`/assist/plan?from=${from}&to=${mode === 'tmonth' ? from : to}`).catch(() => null), api('/requests').catch(() => ({ requests: [] }))]);
        const asst = mode === 'tmonth' ? [] : plan?.items || [];
        if (mode === 'tmonth') return monthView(body, d, from, to, reload);
        const days = mode === 'tday' ? [st.date] : weekDays(from, d.views);
        const vBy = new Map(d.views.map(v => [v.date, v]));
        const range = fit(d.views, [...asst, { start: 9 * 60, end: 22 * 60 }]); // dizayn: 09:00–22:00
        const cols = days.map(date => ({ date, label: DAY[U().wd(date) - 1], blocks: teacherBlocks(vBy.get(date) || { date, items: [], work: [] }, range, { clickFree: true, assist: asst.filter(a => a.date === date) }) }));
        const n = k => d.views.reduce((a, v) => a + v.items.filter(i => i.kind === k).length, 0);
        const trials = d.views.flatMap(v => v.items.filter(i => i.kind === 'trial').map(i => ({ ...i, date: v.date })));
        const myReqs = (reqs.requests || []).filter(r => ['close', 'open', 'leave'].includes(r.type)).slice(0, 3);
        body.innerHTML = `<div class="sv-lay">
            <section class="sc-card sv-wcard"><header class="sv-bh"><h2>${mode === 'tday' ? esc(dayLabel(st.date)) : esc(weekTitle(from))} · ${n('lesson')} dars · ${n('makeup')} qoplash · ${n('trial')} sinov${asst.length ? ` · ${asst.length} yordamchi aloqasi (jadvalni band qilmaydi)` : ''}</h2>
              <p class="sc-mt sv-hint">Bo'sh joyni bosing → qoplash darsi · darsni bosing → o'quvchi kartasi</p></header>
              ${vgrid(cols, range, { cls: mode === 'tday' ? 'is-day' : '' })}${legend(legendT(asst), { rules: true })}</section>
            <div class="sv-side">
              <section class="sc-card" data-mk></section>
              <section class="sc-card"><header class="sv-bh"><h2>${mode === 'tday' ? 'Shu kungi' : 'Shu haftadagi'} sinovlar</h2><span class="sc-grow"></span><button type="button" class="sc-link" data-trials>Sinov darslari →</button></header>
                ${trials.map(t => { const w = when(t.date, t); const s = t.status === 'confirmed' && w.past ? 'dars o\'tdi — natijani yozing. Yozilgach jadvaldan chiqadi.' : t.status === 'pending' ? 'tasdiqlashingiz kerak' : TRIAL[t.status] || '';
                    const acts = t.fromLead || !t.bookingId ? '' : t.status === 'pending' ? `<button type="button" class="sc-btn sc-btn--sm" data-a="reject" data-id="${esc(t.bookingId)}">Rad etish</button><button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-a="accept" data-id="${esc(t.bookingId)}">Tasdiqlash</button>`
                        : t.status === 'confirmed' && w.past ? `<button type="button" class="sc-btn sc-btn--sm" data-a="no_show" data-id="${esc(t.bookingId)}">Lid kelmadi</button><button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-a="done" data-id="${esc(t.bookingId)}">O'tkazildi</button>` : '';
                    return `<div class="sv-li sv-wrapli"><span class="sc-grow"><b>${esc(t.leadName || 'Lid')}</b> · ${t.date === today() ? 'bugun' : `${DAY[U().wd(t.date) - 1]} ${dm(t.date)}`} ${hm(t.start)}<small>${esc(s)}</small></span>${acts ? `<span class="sv-acts">${acts}</span>` : ''}</div>`; }).join('') || '<p class="sc-mt sv-pp">Sinov yo\'q</p>'}</section>
              <section class="sc-card"><header class="sv-bh"><h2>Vaqtimni o'zgartirish</h2></header><div class="sv-ed">
                <p class="sv-txt">Ish vaqtini admin boshqaradi. Shaxsiy sabab bilan biror vaqtni yopish yoki qo'shimcha ochish uchun so'rov yuboring.</p>
                <button type="button" class="sc-btn sv-wide" data-req="close">Vaqtni yopish so'rovi</button><button type="button" class="sc-btn sv-wide" data-req="open">Qo'shimcha ochish</button>
                ${myReqs.map(r => `<div class="sv-req"><span class="sc-pill ${r.status === 'approved' ? 'sc-pill--ok' : r.status === 'rejected' ? 'sc-pill--bad' : 'sc-pill--warn'}">${r.status === 'approved' ? 'Tasdiqlandi' : r.status === 'rejected' ? 'Rad etildi' : 'Kutilmoqda'}</span><small>${r.payload?.date ? `${DAY[U().wd(r.payload.date) - 1]} ${dm(r.payload.date)}` : r.payload?.weekday ? 'har ' + DAY_FULL[r.payload.weekday - 1].toLowerCase() : ''} ${esc(r.payload?.from || '')}${r.payload?.to ? '–' + esc(r.payload.to) : ''} · ${{ close: 'yopish', open: 'ochish', leave: 'ta\'til' }[r.type]}</small></div>`).join('')}
                <button type="button" class="sc-link sv-oldl" data-old>Sinovlar, qoplashlar va so'rovlar ro'yxati →</button></div></section>
            </div></div>`;
        const mkPanel = body.querySelector('[data-mk]');
        const myStudents = () => (getItem(STORAGE_KEYS.students, []) || []).filter(s => s.teacherId === tid && !s.isStaffDemo && !s.frozen && s.status !== 'inactive');
        const missed = d.missed || [];
        // O'quvchilar ro'yxati yoki kartasidan "Qoplash darsi qo'yish" → shu o'quvchi uchun bo'sh joy tanlanadi.
        const forSt = st.makeupFor ? myStudents().find(x => x.id === st.makeupFor) : null;
        if (st.makeupFor && !forSt) st.makeupFor = null;
        const mkIdle = () => {
            mkPanel.innerHTML = `<header class="sv-bh"><h2>Qoplash darsini rejalashtirish</h2></header><div class="sv-ed">${forSt
                ? `<p class="sc-mt"><b>${esc(forSt.name)}</b> uchun jadvaldagi bo'sh joyni bosing — qoldirilgan darsni shu oy ichida o'tib berasiz.</p><button type="button" class="sc-btn" data-mkoff>Bekor qilish</button>`
                : '<p class="sc-mt">Jadvaldagi bo\'sh joyni bosing — qoldirilgan ("Kelmadi") darsni shu oy ichida o\'tib berasiz. Qo\'shaloq dars Davomatda "Keldi · 2 dars" bilan belgilanadi.</p>'}</div>`;
            mkPanel.querySelector('[data-mkoff]')?.addEventListener('click', () => { st.makeupFor = null; reload(); });
        };
        mkIdle();
        // Tanlangan vaqt jadvalda ko'k blok bo'lib ko'rinadi (dizayndagidek).
        const pickBox = (dl, a, b2, label) => {
            body.querySelectorAll('.sv-pickbox').forEach(x => x.remove());
            if (!dl || a == null) return;
            const y = m => `calc(var(--hh) * ${((m - range[0]) / 60).toFixed(4)})`;
            dl.insertAdjacentHTML('beforeend', `<div class="sv-b pick sv-pickbox" style="top:${y(a)};height:calc(var(--hh) * ${((b2 - a) / 60).toFixed(4)} - 3px)">${esc(label)}<small>${hm(a)}–${hm(b2)}</small></div>`);
        };
        // Bosilgan joy atrofida dars boshlanishi (15 daqiqaga yaxlitlanadi, bo'sh oraliqdan chiqmaydi).
        const snap = (s, e, dur, at) => { const hi = e - dur; const t = Math.max(Math.ceil(s / 15) * 15, Math.min(Math.round((at - dur / 2) / 15) * 15, Math.floor(hi / 15) * 15)); return t < s || t > hi ? s : t; };
        // UstozJadval dizayni: bo'sh joy → shu panelda o'quvchi va qoldirilgan dars tanlanadi. Vaqt — bosilgan joydan
        // (15 daqiqaga yaxlitlanadi). Qoldirilgan dars faqat "Kelmadi" ro'yxatidan, sana qo'lda kiritilmaydi.
        const mkSlot = (el, date, s, e, clickMin) => {
            const dl = el.closest('.sv-dl');
            // Bugun — o'tib ketgan qismi taklif qilinmaydi: boshlanish hozirgi vaqtdan keyingi 15 daqiqalikka suriladi.
            if (date === today()) { s = Math.max(s, Math.ceil(U().nowMin() / 15) * 15); clickMin = Math.max(clickMin ?? s, s); }
            if (date < today() || s >= e) { pickBox(null); mkPanel.innerHTML = '<header class="sv-bh"><h2>Qoplash darsini rejalashtirish</h2></header><p class="sc-mt sv-pp">Bu vaqt o\'tib ketgan — qoplash darsini keyingi bo\'sh vaqtga qo\'ying.</p>'; return; }
            const list = myStudents();
            if (!list.length) { mkPanel.innerHTML = '<header class="sv-bh"><h2>Qoplash darsini rejalashtirish</h2></header><p class="sc-mt sv-pp">Faol o\'quvchingiz yo\'q</p>'; return; }
            const openOf = id => missed.filter(m => m.studentId === id && !m.makeup && m.date.slice(0, 7) === date.slice(0, 7));
            const fitsOf = x => e - s >= (Number(x.lessonDuration) || 30);
            list.sort((a, b) => (openOf(b.id).length > 0 && fitsOf(b)) - (openOf(a.id).length > 0 && fitsOf(a)) || (openOf(b.id).length > 0) - (openOf(a.id).length > 0) || a.name.localeCompare(b.name));
            const draw = sid => {
                const stu = list.find(x => x.id === sid);
                const dur = Number(stu?.lessonDuration) || 30;
                const fits = e - s >= dur;
                const t0 = fits ? snap(s, e, dur, clickMin) : s;
                const ms = missed.filter(m => m.studentId === sid && m.date.slice(0, 7) === date.slice(0, 7) && m.date <= today() && m.date <= date); // qoplash qoldirilgan darsdan keyin
                const firstOpen = ms.find(m => !m.makeup);
                const ld = Number(stu.lessonDayOfWeek), lessonDay = ([1, 3, 5].includes(ld) ? [1, 3, 5] : [2, 4, 6].includes(ld) ? [2, 4, 6] : [ld]).includes(U().wd(date));
                mkPanel.innerHTML = `<header class="sv-bh"><h2>Qoplash darsini rejalashtirish</h2></header><div class="sv-ed">
                  <div class="sv-slot"><b>${DAY_FULL[U().wd(date) - 1]}, ${dm(date)} · ${fits ? `${hm(t0)}–${hm(t0 + dur)}` : `${hm(s)}–${hm(e)}`}</b><small>${lessonDay ? '' : `${esc(first(stu?.name))}ning dars kuni emas · `}bo'sh · ${fits ? `${dur} daq sig'adi` : `${dur} daq sig'maydi`}</small></div>
                  <label class="sc-fd"><span>O'quvchi</span><select name="st">${list.map(x => `<option value="${esc(x.id)}"${x.id === sid ? ' selected' : ''}>${esc(x.name)} · ${Number(x.lessonDuration) || 30} daq</option>`).join('')}</select></label>
                  <div class="sv-fl"><span>Qaysi qoldirilgan dars o'rniga?</span>${ms.length ? ms.map(m => `<label class="sv-rb${m.makeup ? ' is-off' : ''}"${m.makeup ? ' aria-disabled="true"' : ''}><input type="radio" name="miss" value="${m.date}"${m === firstOpen ? ' checked' : ''}${m.makeup ? ' disabled' : ''}><i></i><span><b>${dm(m.date)}, ${DAY_FULL[U().wd(m.date) - 1]}</b><small>${m.makeup ? `allaqachon ${m.makeup.status === 'approved' ? 'qoplangan' : m.makeup.status === 'review' ? 'qoplangan · tekshiruvda' : 'rejalashtirilgan'}${m.makeup.heldDate ? ' · ' + dm(m.makeup.heldDate) : ''}` : 'kelmagan · hali qoplanmagan'}</small></span></label>`).join('')
                    : '<p class="sc-mt">Bu oyda bu o\'quvchida "Kelmadi" deb belgilangan dars yo\'q — qoplash faqat haqiqiy kelmagan dars uchun.</p>'}</div>
                  <div class="sc-note">O'quvchiga ilovada eslatma boradi. Vaqt band bo'ladi: sotuv bu yerga sinov qo'ya olmaydi. Dars o'tgach "Keldi" desangiz, admin tasdiqlaydi va dars maoshingizga qo'shiladi.</div>
                  ${lessonDay ? `<p class="sc-err" role="alert">${esc(first(stu?.name))}ning dars kuni — qoplash darsi faqat dars kuni bo'lmagan kunga qo'yiladi. Dars kunida Davomatda "Keldi · 2 dars" ni tanlang.</p>` : ''}
                  <div class="sv-btns"><button type="button" class="sc-btn" data-cancel>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save${fits && firstOpen && !lessonDay ? '' : ' disabled'}>Rejaga qo'yish</button></div></div>`;
                if (fits) pickBox(dl, t0, t0 + dur, `${first(stu?.name)} · qoplash`); else pickBox(null);
                mkPanel.querySelector('[name=st]').onchange = ev => draw(ev.target.value);
                mkPanel.querySelector('[data-cancel]').onclick = () => { pickBox(null); mkIdle(); };
                mkPanel.querySelector('[data-save]').onclick = async ev => {
                    const missedDate = mkPanel.querySelector('[name=miss]:checked')?.value;
                    if (!missedDate) return U().errBox(mkPanel, 'Qaysi dars o\'rniga ekanini tanlang');
                    U().busy(ev.target, true);
                    try { await U().post('/makeups/plan', { kind: 'makeup', teacherId: stu.teacherId, studentId: stu.id, date, time: hm(t0), duration: dur, missedDate }); st.makeupFor = null; U().toast('Qoplash rejaga qo\'yildi'); reload(); }
                    catch (err) { U().busy(ev.target, false); U().errBox(mkPanel, err.message); }
                };
            };
            draw(list[0].id);
            mkPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        };
        body.querySelectorAll('.sv-dl [data-free]').forEach(b => b.onclick = ev => {
            const [s, e] = b.dataset.free.split('|').map(Number);
            const r = b.getBoundingClientRect();
            const clickMin = s + Math.round(((ev.clientY - r.top) / Math.max(1, r.height)) * (e - s));
            const date = b.closest('[data-date]').dataset.date;
            // Oldindan tanlangan o'quvchi (ro'yxat/karta) → "Qoplash darsi" oynasi (Oynalar dizayni).
            if (forSt) {
                const dur = Number(forSt.lessonDuration) || 30;
                if (e - s < dur) return U().toast(`Bu bo'sh joyga ${dur} daqiqa sig'maydi`);
                const t0 = snap(s, e, dur, clickMin);
                return SS().makeupDrawer(reload, { studentId: forSt.id, date, start: t0 });
            }
            mkSlot(b, date, s, e, clickMin);
        });
        body.querySelectorAll('[data-st]').forEach(b => b.onclick = () => U().openStudent(b.dataset.st));
        body.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => typeof switchTab === 'function' && switchTab('trial-lessons'));
        body.querySelector('[data-trials]').onclick = () => typeof switchTab === 'function' && switchTab('trial-lessons');
        body.querySelectorAll('[data-req]').forEach(b => b.onclick = () => SS()._.teacherRequestDrawer(reload, b.dataset.req));
        body.querySelector('[data-old]').onclick = () => { st.view = 'trials'; SS().render(root); };
        body.querySelector('[data-rules]')?.addEventListener('click', rulesDrawer);
        body.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => { try { await U().post(`/bookings/${b.dataset.id}/${b.dataset.a}`); U().toast('Saqlandi'); reload(); } catch (e) { U().toast(e.message, 4000); } });
    }
    function monthView(body, d, from, to, reload) {
        const st = SS().state, { esc, today, DAY } = U();
        const vBy = new Map(d.views.map(v => [v.date, v]));
        const cells = [];
        for (let k = 1; k < U().wd(from); k++) cells.push('<span class="sv-d e"></span>');
        let ok = 0, no = 0, un = 0, mkN = 0, plan = 0, total = 0;
        for (const date of (() => { const a = []; let x = from; while (x <= to) { a.push(x); x = U().addDays(x, 1); } return a; })()) {
            const v = vBy.get(date);
            const L = (v?.items || []).filter(i => i.kind === 'lesson' || i.kind === 'makeup').map(i => look(i, date));
            total += L.length;
            const c = { ok: L.filter(l => l.st === 'ok').length, no: L.filter(l => l.st === 'no').length, un: L.filter(l => l.st === 'un').length, mk: L.filter(l => l.st === 'mk').length };
            ok += c.ok; no += c.no; un += c.un; mkN += c.mk; plan += L.filter(l => l.st === 'wait' || l.st === 'now').length;
            const off = !v || (!v.work.length && !L.length);
            const cls = off ? 'x' : !L.length ? '' : date > today() ? 'pl' : c.no ? 'no' : c.un ? 'un' : c.mk && !c.ok ? 'q' : 'ok';
            cells.push(`<button type="button" class="sv-d ${cls}${date === today() ? ' td' : ''}${c.mk ? ' cv' : ''}" data-day="${date}" title="${esc(`${dm(date)} · ${L.length} dars${c.ok ? ` · ${c.ok} keldi` : ''}${c.no ? ` · ${c.no} kelmadi` : ''}${c.un ? ` · ${c.un} belgilanmagan` : ''}`)}">${Number(date.slice(8))}${L.length ? `<sup>${L.length}</sup>` : ''}</button>`);
        }
        const cs = (l, v, s) => `<div class="sv-cs"><small>${l}</small><b>${v}</b><span>${s}</span></div>`;
        body.innerHTML = `<section class="sc-card"><div class="sv-cal"><div class="sv-cg">${DAY.map(x => `<span class="h">${x}</span>`).join('')}${cells.join('')}</div>
            <div class="sv-csum">${cs('Darslar', total, `${plan} rejada`)}${cs('Keldi', ok, 'davomatda belgilangan')}${cs('Kelmadi', no, 'qoplash mumkin')}${cs('Belgilanmagan', un, 'Akademik → Davomat')}${cs('Qoplash', mkN, 'shu oy')}</div></div>
            ${legend([['k-ok', 'Hammasi keldi'], ['k-no', 'Kelmagan bor'], ['k-un', 'Belgilanmagan'], ['k-mk', 'Qoplash'], ['k-wait', 'Rejada'], ['k-off', 'Dars yo\'q']], { rules: true })}</section>`;
        body.querySelector('[data-rules]')?.addEventListener('click', rulesDrawer);
        body.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { st.date = b.dataset.day; st.view = 'tday'; SS().render(body.parentElement); });
    }

    // ═══ Yordamchi: haftalik tavsiya jadvali ═══════════════════════════════════
    async function adviceView(root, reload) {
        const st = SS().state, { api, esc, hm, addDays, weekStart, today, DAY } = U();
        const from = weekStart(st.date), to = addDays(from, 6);
        const body = header(root, { title: 'Dars jadvali', sub: 'Tavsiya jadvali · tizim har o\'quvchiga haftasiga 3 vaqt taklif qiladi (asosiy darslar oralig\'i + qulay vaqt) · majburiy emas', nav: navBox(weekLabel(from), 'Hafta'), inline: true });
        bindNav(root, 7, reload);
        const plan = await api(`/assist/plan?from=${from}&to=${to}`);
        const items = plan.items || [];
        const days = weekDays(from, [{ date: to, items: items.filter(i => i.date === to), work: [] }]);
        const td = today();
        // Dizaynda o'tib ketgan (bajarilmagan) tavsiyalar ko'rsatilmaydi — faqat bajarilgan aloqalar va oldindagi tavsiyalar.
        const shown = items.filter(i => i.kind === 'contact' || !i.past);
        const cols = days.map(date => ({ date, label: DAY[U().wd(date) - 1], blocks: shown.filter(i => i.date === date).map(i => {
            const done = i.kind === 'contact';
            const na = done && i.outcome === 'no_answer';
            const warn = done && !na && i.status !== 'counted';
            const t = `${first(i.studentName)} ${done ? (na ? '✕' : `${CH_IC[i.channel] || ''} ${i.minutes ? i.minutes + '′' : ''}`) : hm(i.start)}`;
            const why = warn ? (U().CST || {})[i.status] || 'hisoblanmadi' : ''; // sabab matni — schoolUI.CST (bitta manba)
            return { start: i.start, end: i.start + 30, cls: done ? (na ? 'k-no' : warn ? 'k-un' : 'k-ok') : 'k-wait', t,
                title: `${hm(i.start)} · ${i.studentName} · ${done ? (na ? 'javob bermadi' : `${CH[i.channel] || ''} ${i.minutes} daq${why ? ' · ' + why : ''}`) : 'tavsiya'}`,
                click: true, attrs: ` data-sid="${esc(i.studentId)}" data-k="${i.kind}"` };
        }) }));
        // Ko'rinadigan soatlar: ustma-ust tushgan bloklar pastga surilgani hisobga olinadi.
        const bottoms = cols.flatMap(c => stackTops(c.blocks).map(b => ({ start: b.start, end: b.top + STACK_H })));
        const range = fit([], [...bottoms, { start: 9 * 60, end: 22 * 60 }]); // dizayn: 09:00–22:00
        const advice = items.filter(i => i.kind === 'advice').length, done = items.filter(i => i.kind === 'contact' && i.outcome !== 'no_answer').length;
        const hasUn = shown.some(i => i.kind === 'contact' && i.outcome !== 'no_answer' && i.status !== 'counted');
        body.innerHTML = `<section class="sc-card sv-wcard"><header class="sv-bh"><h2>${esc(weekTitle(from))} · ${window.AttendanceRules?.weekPlanCount ? AttendanceRules.weekPlanCount(items) : advice + items.filter(i => i.kind === 'contact').length} tavsiya · ${done} bajarildi</h2><span class="sc-grow"></span><span class="sc-mt">Blokni bosing → aloqani belgilash</span></header>
            ${items.length ? vgrid(cols, range, { stack: true }) : '<p class="sc-mt sv-pp">Sizga yordamchi sifatida faol o\'quvchi biriktirilmagan.</p>'}
            ${legend([['k-ok', 'Bajarildi (usul · daqiqa)'], ['k-no', 'Javob bermadi'], ...(hasUn ? [['k-un', 'Hisoblanmadi (qoida)']] : []), ['k-wait', 'Tavsiya']], { rules: true })}</section>`;
        body.querySelector('[data-rules]')?.addEventListener('click', rulesDrawer);
        body.querySelectorAll('[data-sid]').forEach(b => b.onclick = () => {
            const date = b.closest('[data-date]').dataset.date;
            const s = (getItem(STORAGE_KEYS.students, []) || []).find(x => x.id === b.dataset.sid);
            if (b.dataset.k === 'contact' || date !== td || !s) return U().openStudent(b.dataset.sid);
            if (window.schoolTeacher?.markDrawer) window.schoolTeacher.markDrawer(s, reload);
        });
    }

    // ═══ Qoidalar (JadvalQoidalar) ═════════════════════════════════════════════
    // Dizaynda to'liq sahifa (2 ustunli kartalar) — js/jadvalQoidalar.js.
    function rulesDrawer() { window.jadvalQoidalar?.open(); }

    window.scheduleV2 = { render, owns, defaultView, isAssistant, rulesDrawer, _t: { merge, subtract, intersect, lanes, fit, look } };
})();
