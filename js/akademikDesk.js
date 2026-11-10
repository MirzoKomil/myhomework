// Jamoa — Akademik rahbar (role=akademik) kompyuter kabineti (≥901px), dizayn: "Akademik" kanvasi AkdHome, AkdProblems,
// AkdMakeups, AkdTeachers (1440px). Sidebar bandlari — index.html [data-akd], tartib — app.js DESIGN_SIDEBAR.akademik.
// Maʼlumot va oynalar telefon kabineti (js/akademikApp.js → akademikApp.kit) bilan umumiy: bir xil kesh, bir xil API,
// muammoni yopish / muddatni surish / masʼul / qoplash natijasi / ustozni almashtirish oynalari telefondagi bilan aynan bir xil.
// Umumiy sahifalar (Oʻquvchilar, Dars jadvali, Darslik, Yoʻriqnomalar) oʻzgarmaydi — faqat ularga havola beriladi.
// Uslublar: css/akademikDesk.css (akd- prefiksi). Telefon (≤900px) — js/akademikApp.js, bu fayl u yerda hech narsa chizmaydi.
(function () {
    'use strict';
    const MQ = window.matchMedia('(max-width: 900px)');
    const isDesk = () => !MQ.matches;
    const K = () => window.akademikApp?.kit || null;
    const cu = () => (typeof getCurrentUser === 'function' ? getCurrentUser() : null) || {};
    const isAk = () => cu().role === 'akademik';

    // ---------- holat ----------
    const V = {
        view: 'home', ptab: 'open', pq: '', ptype: '', pteacher: '', pid: null, pauto: true, later: false,
        mtab: 'pending', mteacher: '', mAll: false, ttab: 'teachers', tid: null, aid: null, tauto: true,
        rtab: 'all', rteacher: '', sid: null, rAll: false, ltab: 'pending',
    };
    let root = null, inited = false, draft = null, opener = '';
    // Yuborilayotgan soʻrovlar (ikki marta bosilmasin): 'stage:<pid>', 'm:<makeupId>', 'l:<lateId>'.
    const pending = new Set();

    const DESK_VIEWS = new Set(['home', 'problems', 'archive', 'teachers', 'makeups', 'risk', 'late']);
    const activeTab = () => document.getElementById('tab-akademik')?.classList.contains('active');

    // ---------- navigatsiya ----------
    // Sidebar va ichki havolalar: kabinet bo'limi yoki mavjud sahifa (Dars jadvali v3, Darslik, HR davomat).
    function nav(key, extra = {}) {
        if (typeof switchTab !== 'function') return;
        if (key === 'slots') { switchTab('timetable', { akdNav: 'slots' }); return; }
        if (key === 'book') { switchTab('teachers-section', { teachersSection: 'textbook', akdNav: 'book' }); return; }
        // Davomat (js/davomatApp.js — Face ID): davomat.open('team' | 'approvals' | 'my'); oʻz davomati zaxirasi — eski tekshirish oynasi.
        if (key === 'att' || key === 'attreq') { if (dvApplies(key)) window.davomat.open(key === 'att' ? 'team' : 'approvals'); return; }
        if (key === 'myatt') {
            if (dvApplies('myatt')) { window.davomat.open('my'); return; }
            if (window.staffAttendanceUI?.openCheckSheet) { window.staffAttendanceUI.openCheckSheet(); markWhileOpen('myatt', '.satt-overlay'); return; }
            switchTab('profile', { akdNav: 'myatt' }); return;
        }
        if (!DESK_VIEWS.has(key)) key = 'home';
        if (key === 'problems' || key === 'archive') {
            V.ptab = key === 'archive' ? 'closed' : (extra.ptab || (V.ptab === 'closed' ? 'open' : V.ptab));
            V.pq = extra.pq || ''; V.ptype = ''; V.pteacher = extra.pteacher || ''; V.later = false;
            V.pid = extra.pid ?? null; V.pauto = extra.pid == null;
        }
        if (key === 'teachers') { V.ttab = extra.ttab || 'teachers'; V.tid = extra.tid ?? null; V.aid = extra.aid ?? null; V.tauto = extra.tid == null && extra.aid == null; }
        if (key === 'makeups') { V.mtab = extra.mtab || 'pending'; V.mteacher = extra.mteacher || ''; V.mAll = false; }
        if (key === 'risk') { V.rtab = extra.rtab || 'all'; V.rteacher = extra.rteacher || ''; V.sid = extra.sid ?? null; V.rAll = false; }
        if (key === 'late') V.ltab = extra.ltab || 'pending';
        switchTab('akademik', { akd: key });
    }

    const dvInfo = () => { try { return window.davomat?.menuInfo?.() || null; } catch (e) { return null; } };
    // Band koʻrinadimi: yordamchilar davomati / soʻrovlar — tasdiqlovchi 'academic'; oʻz davomati — kuzatiladi (kompyuterda eski oyna zaxirasi bor).
    function dvApplies(key) {
        const mi = dvInfo();
        if (key === 'myatt') return !!(window.davomat?.open && mi?.tracked);
        return !!(window.davomat?.open && mi?.approver === 'academic');
    }
    // Oyna bilan ochiladigan band (Mening davomatim): oyna ochiq turganda sidebar'da shu band faol, yopilgach avvalgisi qaytadi.
    function markWhileOpen(key, sel) {
        const item = document.querySelector(`#sidebarMenu .menu-item[data-akd="${key}"]`); if (!item) return;
        const prev = [...document.querySelectorAll('#sidebarMenu .menu-item.active')].filter(x => x !== item);
        prev.forEach(x => x.classList.remove('active')); item.classList.add('active'); item.setAttribute('aria-current', 'true');
        const mo = new MutationObserver(() => { if (!document.querySelector(sel)) done(); });
        const done = () => { mo.disconnect(); item.classList.remove('active'); item.removeAttribute('aria-current'); prev.forEach(x => x.classList.add('active')); };
        if (!document.querySelector(sel)) { done(); return; }
        mo.observe(document.body, { childList: true });
    }

    // ---------- yordamchilar ----------
    const nameKey = n => String(n || '').trim().split(/\s+/)[0] || '';
    const maskPhone = p => { const d = String(p || '').replace(/\D/g, ''); if (d.length < 9) return p || ''; const n = d.length === 9 ? '998' + d : d; return `+${n.slice(0, 3)} ${n.slice(3, 5)} *** ** ${n.slice(-2)}`; };
    const monLoc = name => (name ? name + 'da' : '');
    function h1(title, sub, right = '') {
        return `<div class="akd-h1row"><div class="akd-h1"><h1>${K().esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${right}</div>`;
    }
    const btnNew = (attrs = '') => `<button type="button" class="akd-btn akd-btn--pri" data-k-new ${attrs}>${K().ic('plus', 16, 2.4)}Muammo yozish</button>`;
    function tabs(attr, list, cur, label) {
        const { esc } = K();
        return `<div class="akd-tabs" role="tablist" aria-label="${esc(label)}">${list.map(([k, t]) => `<button type="button" role="tab" class="akd-tab" aria-selected="${k === cur}" data-k-${attr}="${esc(k)}">${esc(t)}</button>`).join('')}</div>`;
    }
    // "Turi: hammasi" / "Ustoz: hammasi" — dizayndagi tugma koʻrinishidagi tanlov (native select, klaviatura bilan ishlaydi).
    function pick(attr, label, opts, cur) {
        const { esc } = K();
        return `<label class="akd-sel"><span class="aka-sr">${esc(label)}</span><select class="team-native" data-k-${attr}>${[['', `${label}: hammasi`], ...opts.map(([v, t]) => [v, `${label}: ${t}`])].map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    }
    const sk = (n, h) => Array.from({ length: n }, () => `<div class="aka-sk akd-sk" style="height:${h}px"></div>`).join('');
    function withData(url, fn, skel) {
        const k = K(), c = k.need(url);
        if (c.d) return fn(c.d);
        if (c.e) return k.errBox(c.e, url).replace('data-a-retry', 'data-k-retry');
        return skel;
    }
    const cnt = n => (n != null ? ' · ' + n : '');
    const AV = { blue: ['#EAF3FF', '#0057B8'], red: ['#FEF3F2', '#B42318'], amber: ['#FEF0C7', '#93370D'], green: ['#ECFDF3', '#067647'], grey: ['#EEF2F8', '#3A4456'], dark: ['#0B1220', '#FFFFFF'] };
    const av = (name, size = 36, tone = 'blue') => { const [b, c] = AV[tone] || AV.blue; return `<span class="akd-av" aria-hidden="true" style="width:${size}px;height:${size}px;background:${b};color:${c};font-size:${size >= 48 ? 15 : 13}px">${K().esc(K().initials(name))}</span>`; };
    const toneOfScore = s => (s == null ? 'grey' : K().scoreTone(s));

    // =====================================================================================
    // AkdHome · Bosh sahifa
    // =====================================================================================
    // Bildirishnoma koʻrinishi va manzili — telefondagi (kit.notifs) bilan bir; faqat AkdHome dizayni farq qiladigan ikonkalar ustiga yoziladi.
    const nLook = () => ({ ...K().notifs.NLOOK, acad_makeup_new: ['phone', 'blue'], acad_risk_new: ['trend', 'amber'] });
    const nView = etype => (etype === 'acad_problem_followup' ? 'archive' : K().notifs.NGO[etype]?.[0] || null);
    // "Sinov qabul qilinmagan" — oʻsha ustozning paneli (server teacherId; eski javobda — ism boʻyicha), aks holda Sinov vaqtlari (Dars jadvali v3).
    function trialGo(nt) {
        const k = K(); if (!nt) return 'data-k-go="slots"';
        if (nt.teacherId) return `data-k-teacher="${k.esc(nt.teacherId)}"`;
        const t = (k.need(k.API.teachers).d?.items || []).find(x => k.first(x.name) === k.first(nt.teacher));
        return t ? `data-k-teacher="${k.esc(t.id)}"` : 'data-k-go="slots"';
    }
    function viewHome() {
        const k = K(), { esc, ic, num, pct, MON, WD } = k;
        const u = cu(), d = new Date(), nm = k.first(u.name || k.myName());
        const head = h1(`${k.greet()}${nm ? ', ' + nm : ''}`, esc(`${WD[d.getDay()]}, ${d.getDate()}-${MON[d.getMonth()]}`), btnNew());
        const c = k.need(k.API.ov);
        if (!c.d) return head + (c.e ? k.errBox(c.e, k.API.ov).replace('data-a-retry', 'data-k-retry') : `<div class="akd-homeTop">${sk(1, 222)}<div class="akd-tiles">${sk(4, 190)}</div></div>`);
        const o = c.d, st = o.students || {}, t = o.tiles || {};
        const total = num(st.total), onPlan = num(st.onPlan), behind = st.behind != null ? num(st.behind) : Math.max(0, total - onPlan);
        const ratio = total ? onPlan / total : 0, off = Math.round(276 * (1 - ratio));
        const hero = `<section class="akd-hero akd-s1" aria-label="Rejada oʻqiyapti">
            <div class="akd-hero-r"><div class="akd-ring"><svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label="Oʻquvchilarning ${Math.round(ratio * 100)} foizi rejada"><circle cx="52" cy="52" r="44" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="10"/><circle class="akd-ring-v" cx="52" cy="52" r="44" fill="none" stroke="#3B8BEE" stroke-width="10" stroke-linecap="round" stroke-dasharray="276" style="stroke-dashoffset:${off}" transform="rotate(-90 52 52)"/></svg>
                <div><strong>${Math.round(ratio * 100)}%</strong><span>rejada</span></div></div>
              <div class="akd-hero-t"><em>REJADA OʻQIYAPTI · ${MON[d.getMonth()].toUpperCase()}</em><div><strong>${onPlan}</strong><span>/ ${total} oʻquvchi</span></div><span>${behind} tasi darsdan orqada · ${num(o.teachersTotal)} ustoz</span></div></div>
            <div class="akd-sub3"><div><span>Darsga keldi</span><strong>${pct(o.attendancePct)}%</strong></div><div><span>Ketdi (oyda)</span><strong class="c-yel">${num(st.left30)} ta</strong></div><div><span>Muzlatilgan</span><strong>${num(st.frozen)} ta</strong></div></div></section>`;
        const nt = t.nextUnacceptedTrial;
        const tiles = [
            { k: 'overdue', n: num(t.overdueProblems), icon: 'alert', tone: 'red', title: 'Muammo muddati oʻtdi', sub: num(t.overdueProblems) ? `Eng eskisi ${num(t.oldestOverdueDays)} kun${num(t.oldestOverdueReminds) ? ` · bot ${num(t.oldestOverdueReminds)} marta eslatdi` : ''}` : 'Muddati oʻtgan yoʻq', subTone: num(t.overdueProblems) ? 'red' : '', go: 'data-k-go="problems" data-k-ptab="open"' },
            { k: 'makeups', n: num(t.makeupsPending), icon: 'phone', tone: 'blue', title: 'Qoplashni tekshirish', sub: 'Oʻquvchiga qoʻngʻiroq', go: 'data-k-go="makeups"' },
            { k: 'risk', n: num(t.risk), icon: 'trend', tone: 'amber', title: 'Ketish xavfi', sub: num(t.riskNoApp) ? `${num(t.riskNoApp)} tasi appga kirmayapti` : 'Xavf roʻyxati', subTone: num(t.riskNoApp) ? 'amber' : '', go: 'data-k-go="risk" data-k-rtab="all"' },
            { k: 'trial', n: num(t.trialsUnaccepted), icon: 'cal', tone: 'purple', title: 'Sinov qabul qilinmagan', sub: nt ? `${k.relDT(nt.time).replace(/ 00:00$/, '')} · ${k.first(nt.teacher)}` : 'Hammasi qabul qilingan', go: trialGo(nt) },
        ];
        const cats = tiles.filter(x => x.n > 0), sum = cats.reduce((a, x) => a + x.n, 0);
        const tile = x => `<a href="#" class="akd-tile${x.k === 'overdue' && x.n ? ' is-hot akd-pulse' : ''}" ${x.go}><span class="akd-tile-h"><span class="aka-qi akd-qi t-${x.tone}">${ic(x.icon, 20)}</span><strong>${x.n}</strong></span><strong>${esc(x.title)}</strong><small class="${x.subTone ? 'c-' + x.subTone : ''}">${esc(x.sub)}</small></a>`;
        const att = (o.teachersAttention || []).slice(0, 3);
        const TB = { red: '#D92D20', amber: '#F79009', blue: '#0065D6' };
        const attRow = r => { const tone = ['red', 'blue'].includes(r.tone) ? r.tone : 'amber';
            return `<a href="#" class="akd-arow" data-k-teacher="${esc(r.id)}">${av(k.first(r.name), 40, tone)}<span class="akd-arow-t"><span><strong>${esc(k.first(r.name))}</strong>${r.reason ? k.chip(r.reason, tone) : ''}</span><span class="akd-bar" aria-hidden="true"><i style="width:${pct(r.onPlanPct)}%;background:${TB[tone]}"></i></span><small>${num(r.students)} oʻquvchi · ${pct(r.onPlanPct)}% rejada oʻqiyapti</small></span></a>`; };
        const notifs = (k.notifs.list() || []).slice(0, 3);
        const today = new Date().toDateString(), yest = k.addDays(new Date(), -1).toDateString();
        const nTime = n => { const x = Number(n.time) || Date.parse(n.time || ''); return Number.isFinite(x) ? x : 0; };
        const when = n => { const x = nTime(n); if (!x) return ''; const ds = new Date(x).toDateString(); return ds === today ? k.hm(x) : ds === yest ? `Kecha ${k.hm(x)}` : k.dShort(x); };
        const nRow = n => { const [icn, tone] = nLook()[n.etype] || (/davomat|attendance|face/i.test(String(n.etype || '')) ? ['face', 'amber'] : n.type === 'danger' ? ['alert', 'red'] : ['bell', 'grey']);
            return `<a href="#" class="akd-nrow${n.read ? '' : ' is-new'}" data-k-notif="${esc(n.id)}"><span class="aka-qi t-${tone}">${ic(icn, 16)}</span><span class="akd-nrow-t"><strong>${esc(n.title || 'Bildirishnoma')}</strong>${n.message ? `<small>${esc(n.message)}</small>` : ''}</span><small class="akd-nrow-time">${esc(when(n))}</small></a>`; };
        return head + `<div class="akd-homeTop">${hero}
            <section class="akd-s2 akd-now"><div class="akd-sh"><h2>Hozir hal qiling</h2><span class="${sum ? 'c-red' : 'c-green'}">${sum ? `${cats.length} toifa · ${sum} ta` : 'Hammasi hal qilingan'}</span></div>
                <div class="akd-tiles">${tiles.map(tile).join('')}</div></section></div>
            <div class="akd-homeBot">
              <section class="akd-card akd-s3"><div class="akd-ch"><h2>Ustozlar · avval eʼtibor kerak</h2><a href="#" data-k-go="teachers">Hammasi · ${num(o.teachersTotal)}</a></div>
                ${att.length ? att.map(attRow).join('') : k.emptyBox('check', 'Hamma ustoz reja boʻyicha', 'Eʼtibor kerak boʻlgan ustoz yoʻq')}</section>
              <section class="akd-card akd-s3"><div class="akd-ch"><h2>Soʻnggi voqealar</h2><a href="#" data-k-allnotifs>Hammasi</a></div>
                ${notifs.length ? notifs.map(nRow).join('') : k.emptyBox('bell', 'Hozircha voqea yoʻq', 'Yangi bildirishnomalar shu yerda chiqadi')}</section></div>`;
    }

    // =====================================================================================
    // AkdProblems · Muammolar (jadval + oʻng panel)
    // =====================================================================================
    function dueCell(p) {
        const k = K(), { esc, ic } = k;
        if (p.stage === 'closed') return p.closedAt ? `<span class="akd-due t-green">${ic('check', 12, 2.6)}Yopildi ${esc(k.dShort(p.closedAt))}</span>` : '—';
        if (p.overdue) return `<span class="akd-due t-solid">${esc(k.overdueTxt(p.dueAt))}</span>`;
        if (!p.dueAt) return '<span class="akd-mut">—</span>';
        return k.dayDiff(p.dueAt) === 0 ? `<span class="akd-due t-amber">Bugun ${esc(k.hm(p.dueAt))}</span>` : `<span class="akd-due t-grey">${esc(k.relDT(p.dueAt))}</span>`;
    }
    function probRow(p) {
        const k = K(), { esc } = k, [, sl, tone] = k.stageOf(p.stage), sel = String(p.id) === String(V.pid);
        const owner = p.stage === 'closed' ? esc(p.ownerName ? (k.isMe(p.ownerName) ? 'Siz' : k.first(p.ownerName)) : '—')
            : p.ownerName ? esc(k.isMe(p.ownerName) ? 'Siz' : k.first(p.ownerName)) : '<span class="akd-unset">tayinlanmagan</span>';
        return `<tr class="akd-row${sel ? ' is-sel' : ''}" data-k-prow="${esc(p.id)}"${sel ? ' aria-current="true"' : ''}>
            <td><span class="akd-tt"><a href="#muammo-${esc(p.id)}" data-k-p="${esc(p.id)}">${esc(p.title)}</a>${k.chip(sl, tone)}</span></td>
            <td class="akd-nw">${esc(k.shortName(p.studentName) || '—')}${p.teacherName ? `<small>ustoz ${esc(k.first(p.teacherName))}</small>` : ''}${p.source ? `<small>xabar: ${esc(k.SRC_LOW[p.source] || p.source)}</small>` : ''}</td>
            <td>${owner}</td><td>${dueCell(p)}</td></tr>`;
    }
    function viewProblems() {
        const k = K(), { esc, ic } = k;
        const url = k.API.problems(V.ptab, V.pq.trim());
        const counts = (k.need(url).d || k.peek(k.API.problems('open')) || {}).counts || {};
        if (V.ptab !== 'open') k.need(k.API.problems('open'));
        const all = (k.peek(url)?.items || []).map(k.normP);
        const teachersOpt = [...new Set(all.map(p => k.first(p.teacherName)).filter(Boolean))].sort().map(n => [n, n]);
        if (V.pteacher && !teachersOpt.some(o => o[0] === V.pteacher)) teachersOpt.push([V.pteacher, V.pteacher]);
        const items = all.filter(p => (!V.ptype || p.type === V.ptype) && (!V.pteacher || k.first(p.teacherName) === V.pteacher));
        if (V.pauto && k.peek(url)) { V.pauto = false; if (V.pid == null && items.length) V.pid = items[0].id; }
        const head = h1(V.ptab === 'closed' ? 'Arxiv · yopilgan muammolar' : 'Muammolar', 'Yangi muammoni faqat siz ochasiz; masʼul ixtiyoriy', btnNew());
        const bar = `<div class="akd-filters">${tabs('ptab', [['open', `Ochiq${cnt(counts.open)}`], ['mine', `Mening${cnt(counts.mine)}`], ['closed', 'Yopilgan']], V.ptab, 'Holat')}
            ${V.pq ? `<button type="button" class="akd-qchip" data-k-pqx aria-label="Qidiruvni olib tashlash: ${esc(V.pq)}">«${esc(V.pq)}» ${ic('x', 14, 2.4)}</button>` : ''}
            <span class="akd-sp"></span>${pick('ptype', 'Turi', k.TYPES, V.ptype)}${pick('pteacher', 'Ustoz', teachersOpt, V.pteacher)}</div>`;
        const table = withData(url, () => {
            if (!items.length) return `<section class="akd-card">${k.emptyBox(V.ptab === 'closed' ? 'archive' : 'check', V.pq || V.ptype || V.pteacher ? 'Hech narsa topilmadi' : V.ptab === 'closed' ? 'Yopilgan muammo yoʻq' : 'Ochiq muammo yoʻq', V.pq || V.ptype || V.pteacher ? 'Filtrni oʻzgartiring' : V.ptab === 'closed' ? '' : 'Yangi muammo «Muammo yozish» orqali ochiladi')}</section>`;
            const th = '<thead><tr><th scope="col">Muammo · bosqich</th><th scope="col">Oʻquvchi</th><th scope="col">Masʼul</th><th scope="col">Muddat</th></tr></thead>';
            let body;
            if (V.ptab === 'closed') body = items.map(probRow).join('');
            else {
                const over = items.filter(p => p.overdue), today = items.filter(p => !p.overdue && p.dueAt && k.dayDiff(p.dueAt) <= 0), later = items.filter(p => !p.overdue && !(p.dueAt && k.dayDiff(p.dueAt) <= 0));
                const grp = (t, cls) => `<tr class="akd-grp ${cls}"><th scope="rowgroup" colspan="4">${esc(t)}</th></tr>`;
                const showLater = V.later || (!over.length && !today.length) || later.some(p => String(p.id) === String(V.pid));
                body = (over.length ? grp(`MUDDATI OʻTGAN · ${over.length}`, 'is-red') + over.map(probRow).join('') : '')
                    + (today.length ? grp(`BUGUN · ${today.length}`, '') + today.map(probRow).join('') : '')
                    + (later.length ? (showLater ? grp(`KEYINGI KUNLAR · ${later.length}`, '') + later.map(probRow).join('')
                        : `<tr><td colspan="4" class="akd-more-td"><button type="button" class="akd-more" data-k-later>Keyingi kunlar · ${later.length}${ic('chev', 16, 2)}</button></td></tr>`) : '');
            }
            return `<section class="akd-card akd-tcard"><table class="akd-table">${th}<tbody>${body}</tbody></table></section>`;
        }, `<section class="akd-card akd-tcard">${sk(5, 64)}</section>`);
        return `<div class="akd-split"><div class="akd-main">${head}${bar}${table}</div>${V.pid != null ? problemPanel() : ''}</div>`;
    }
    function problemPanel() {
        const k = K(), { esc, ic } = k, url = k.API.problem(V.pid), c = k.need(url);
        const close = `<button type="button" class="akd-ib" data-k-pclose aria-label="Panelni yopish">${ic('x', 16, 2.2)}</button>`;
        if (!c.d) return `<aside class="akd-panel akd-card" aria-label="Muammo #${esc(V.pid)}"><div class="akd-ph"><span class="akd-pid">Muammo #${esc(V.pid)}</span><span class="akd-sp"></span>${close}</div>${c.e ? k.errBox(c.e, url).replace('data-a-retry', 'data-k-retry') : sk(1, 120) + sk(1, 48) + sk(1, 200)}</aside>`;
        const p = k.normP(c.d.item || c.d), closed = p.stage === 'closed';
        const events = (c.d.events || []).slice().sort((a, b) => new Date(k.f(b, 'at', 'created_at')) - new Date(k.f(a, 'at', 'created_at')));
        const idx = k.STAGES.findIndex(s => s[0] === p.stage);
        const steps = k.STAGES.map(([key, l], i) => {
            const done = i < idx || closed, cur = i === idx && !closed, nextBtn = !closed && i === idx + 1 && key !== 'closed';
            const dot = done ? `<span class="aka-st-d is-done">${ic('check', 14, 3)}</span>` : cur ? '<span class="aka-st-d is-cur"><i></i></span>' : '<span class="aka-st-d"></span>';
            const inner = `${i < 3 ? `<span class="aka-st-l${done ? ' is-done' : ''}" aria-hidden="true"></span>` : ''}${dot}${esc(l)}`;
            return `<li class="${cur ? 'is-cur' : done ? 'is-done' : ''}"${cur ? ' aria-current="step"' : ''}>${nextBtn ? `<button type="button" class="aka-st-b" data-k-stage="${key}"${pending.has('stage:' + p.id) ? ' disabled aria-busy="true"' : ''} aria-label="Bosqichni “${esc(l)}”ga oʻtkazish">${inner}</button>` : inner}</li>`;
        }).join('');
        const owner = p.ownerName ? (k.isMe(p.ownerName) ? 'Siz' : p.ownerName) : '';
        const typeL = (k.TYPES.find(t => t[0] === p.type) || [, 'Boshqa'])[1];
        const ev = events.map(e => {
            const kind = k.f(e, 'kind') || 'comment', text = k.f(e, 'text'), actor = k.f(e, 'actorName', 'actor_name'), at = k.f(e, 'at', 'created_at');
            const title = kind === 'reminded' ? (text && /^bot/i.test(text) ? text.split(' · ')[0] : 'Bot eslatdi') : (text || k.EV_T[kind] || kind);
            const sub = [k.relDT(at), kind === 'reminded' ? (text && /^bot/i.test(text) ? text.split(' · ').slice(1).join(' · ') : '') : actor ? (k.isMe(actor) ? 'Siz' : actor) : ''].filter(Boolean).join(' · ');
            return `<li><strong>${esc(title)}</strong><small>${esc(sub)}</small></li>`;
        }).join('') || `<li><strong>Qayd etildi</strong><small>${esc([p.createdAt ? k.dtComma(p.createdAt) : '', p.createdByName ? (k.isMe(p.createdByName) ? 'Siz' : p.createdByName) : ''].filter(Boolean).join(' · '))}</small></li>`;
        const dueTxt = p.dueAt ? (p.overdue && !closed ? `<dd class="c-red">${esc(k.dtShort(p.dueAt))} · ${esc(k.overdueTxt(p.dueAt))}</dd>` : `<dd>${esc(k.relDT(p.dueAt))}</dd>`) : '<dd>—</dd>';
        const result = closed ? `<dt>Natija</dt><dd>${esc((k.RESULTS.find(r => r[0] === p.result) || [, p.result || '—'])[1])}</dd>${p.resultNote ? `<dt>Izoh</dt><dd class="akd-norm">${esc(p.resultNote)}</dd>` : ''}${p.followupAt ? `<dt>Qayta tekshirish</dt><dd>${esc(k.dLong(p.followupAt))}</dd>` : ''}` : '';
        return `<aside class="akd-panel akd-card akd-s2" aria-label="Muammo #${esc(p.id)}">
            <div class="akd-ph"><span class="akd-pid">Muammo #${esc(p.id)}</span>${k.chip(typeL)}${p.source ? k.chip(k.SRC_CHIP[p.source] || p.source) : ''}<span class="akd-sp"></span>${close}</div>
            <h2 class="akd-pt">${esc(p.title)}</h2>${p.details ? `<p class="akd-pd">${esc(p.details)}</p>` : ''}
            <ol class="aka-steps akd-steps" aria-label="Bosqichlar">${steps}</ol>
            <div class="akd-two">${p.studentPhone ? `<a class="akd-btn akd-btn--dark akd-btn--13" href="${esc(k.telHref(p.studentPhone))}">${ic('phone', 16)}Oʻquvchiga qoʻngʻiroq</a>` : `<span class="akd-btn akd-btn--off akd-btn--13">${ic('phone', 16)}Raqam yoʻq</span>`}
                ${p.teacherPhone ? `<a class="akd-btn akd-btn--line akd-btn--13" href="${esc(k.telHref(p.teacherPhone))}">${ic('phone', 16)}Ustozga qoʻngʻiroq</a>` : `<span class="akd-btn akd-btn--off akd-btn--13">${ic('phone', 16)}Ustoz raqami yoʻq</span>`}</div>
            <dl class="akd-dl"><dt>Oʻquvchi</dt><dd>${p.studentId ? `<a href="#" data-k-student="${esc(p.studentId)}">${esc(p.studentName)}</a>` : esc(p.studentName || '—')}</dd>
                <dt>Ustoz</dt><dd>${p.teacherId ? `<a href="#" data-k-teacher="${esc(p.teacherId)}">${esc(k.first(p.teacherName))}</a>` : esc(k.first(p.teacherName) || '—')}${!closed && p.studentId ? ` · <a href="#" data-k-transfer="${esc(p.studentId)}">Boshqa ustozga oʻtkazish</a>` : ''}</dd>
                <dt>Masʼul</dt><dd>${closed ? esc(owner || '—') : owner ? `${esc(owner)} · <a href="#" data-k-owner>oʻzgartirish</a>` : '<a href="#" data-k-owner>Tayinlash</a>'}</dd>
                <dt>Muddat</dt>${dueTxt}${result}</dl>
            <div class="akd-hist"><h3>Tarix</h3><ol>${ev}</ol></div>
            ${closed ? '' : `<form class="akd-cmt" data-k-cmt><label class="aka-sr" for="akdCmt">Izoh</label><input id="akdCmt" type="text" maxlength="1000" placeholder="Izoh yoki qoʻngʻiroq natijasi…" autocomplete="off"><button type="submit" aria-label="Yuborish">${ic('send', 16)}</button></form>
            <div class="akd-acts"><button type="button" class="akd-btn akd-btn--ghost" data-k-postpone>Muddatni surish…</button><button type="button" class="akd-btn akd-btn--green akd-grow" data-k-close>${ic('check', 16, 2.6)}Muammoni yopish</button></div>`}
        </aside>`;
    }

    // =====================================================================================
    // AkdMakeups · Qoplash tekshiruvi
    // =====================================================================================
    function viewMakeups() {
        const k = K(), { esc, ic } = k, url = k.API.makeups(V.mtab);
        const counts = (k.need(url).d || k.peek(k.API.makeups('pending')) || {}).counts || {};
        if (V.mtab !== 'pending') k.need(k.API.makeups('pending'));
        const all = k.peek(url)?.items || [];
        const tOpts = [...new Set(all.map(m => k.first(m.teacherName)).filter(Boolean))].sort().map(n => [n, n]);
        if (V.mteacher && !tOpts.some(o => o[0] === V.mteacher)) tOpts.push([V.mteacher, V.mteacher]);
        const head = h1('Qoplash tekshiruvi', 'Qoplash ustoz kiritgan zahoti maoshga kiradi. Oʻquvchiga qoʻngʻiroq qilib tekshiring: dars boʻlmagan boʻlsa, keyingi oyning 4-sanasigacha rad etish mumkin.');
        const bar = `<div class="akd-filters">${tabs('mtab', [['pending', 'Kutmoqda' + cnt(counts.pending)], ['held', 'Tekshirildi'], ['not_held', 'Dars boʻlmagan']], V.mtab, 'Holat')}<span class="akd-sp"></span>${pick('mteacher', 'Ustoz', tOpts, V.mteacher)}</div>`;
        const table = withData(url, () => {
            const items = all.filter(m => !V.mteacher || k.first(m.teacherName) === V.mteacher);
            if (!items.length) return `<section class="akd-card">${k.emptyBox(V.mtab === 'pending' ? 'check' : 'archive', V.mtab === 'pending' ? 'Tekshiriladigan qoplash yoʻq' : 'Roʻyxat boʻsh', V.mtab === 'pending' ? 'Ustoz yangi qoplash kiritsa shu yerda chiqadi' : '')}</section>`;
            const shown = V.mAll ? items : items.slice(0, 5);
            const pend = V.mtab === 'pending';
            const row = m => {
                const nm = k.shortName(m.studentName);
                const dl = m.deadline ? k.dayDiff(m.deadline) : null;
                const dcell = !pend ? (m.checkedAt ? `<span class="akd-mut">${esc(k.dShort(m.checkedAt))}${m.checkedByName ? ' · ' + esc(k.isMe(m.checkedByName) ? 'Siz' : k.first(m.checkedByName)) : ''}</span>` : '—')
                    : m.canReject === false ? k.chip('Rad etish muddati oʻtdi', 'grey') : m.deadline ? (dl != null && dl <= 6 ? `<span class="akd-due t-red">${esc(k.dShort(m.deadline))} gacha</span>` : `<span class="akd-mut">${esc(k.dShort(m.deadline))} gacha</span>`) : '—';
                const call = m.studentPhone ? `<a class="akd-call" href="${esc(k.telHref(m.studentPhone))}" aria-label="${esc(nm)}ga qoʻngʻiroq">${ic('phone', 16)}</a>` : `<span class="akd-call is-off" role="img" aria-label="${esc(nm)}: telefon kiritilmagan" title="Telefon kiritilmagan">${ic('phone', 16)}</span>`;
                const busy = pending.has('m:' + m.id) ? ' disabled aria-busy="true"' : '';
                const acts = pend ? `${call}<span class="akd-res" role="group" aria-label="${esc(nm)}: natija"><button type="button" class="akd-rb akd-rb--ok" data-k-mres="held" data-k-mid="${esc(m.id)}"${busy}>Oʻtildi</button><button type="button" class="akd-rb akd-rb--no" data-k-mres="not_held" data-k-mid="${esc(m.id)}"${m.canReject === false ? ' disabled title="Rad etish muddati oʻtgan (keyingi oyning 4-sanasi)"' : busy}>Dars boʻlmagan…</button><button type="button" class="akd-rb" data-k-mres="no_answer" data-k-mid="${esc(m.id)}"${busy}>Javob yoʻq</button></span>`
                    : `${call}${V.mtab === 'held' ? k.chip('Oʻtildi', 'green') : k.chip('Rad etildi', 'red')}`;
                return `<tr class="akd-row"><td><strong>${esc(nm)}</strong>${m.checkStatus === 'no_answer' ? ' ' + k.chip('Javob bermadi', 'amber') : ''}<small>${esc(maskPhone(m.studentPhone) || '—')}</small>${!pend && m.checkNote ? `<small>«${esc(m.checkNote)}»</small>` : ''}</td>
                    <td>${esc(k.first(m.teacherName) || '—')}</td><td class="akd-nw">${esc(m.heldAt ? k.dtComma(m.heldAt) : '—')}${m.lessonNo ? `<small>${esc(m.lessonNo)}-dars</small>` : ''}</td>
                    <td class="akd-mut">${esc(m.enteredAt ? k.dShort(m.enteredAt) : '—')}</td><td>${dcell}</td><td class="akd-acts-td">${acts}</td></tr>`;
            };
            return `<section class="akd-card akd-tcard"><table class="akd-table"><thead><tr><th scope="col">Oʻquvchi</th><th scope="col">Ustoz</th><th scope="col">Qoplash vaqti</th><th scope="col">Kiritildi</th><th scope="col">${pend ? 'Rad etish muddati' : 'Tekshirildi'}</th><th scope="col"><span class="aka-sr">Amallar</span></th></tr></thead><tbody>${shown.map(row).join('')}</tbody></table>
                ${!V.mAll && items.length > 5 ? `<button type="button" class="akd-more akd-more--foot" data-k-mall>Yana ${items.length - 5} ta${ic('chev', 16, 2)}</button>` : ''}</section>`;
        }, `<section class="akd-card akd-tcard">${sk(5, 64)}</section>`);
        return `<div class="akd-main">${head}${bar}${table}</div>`;
    }
    async function makeupResult(id, result, btn) {
        const k = K();
        if (result === 'not_held') { syncState(); k.dlg.makeup(id, 'not_held'); return; }
        if (pending.has('m:' + id)) return;
        pending.add('m:' + id); btn.disabled = true; draw();
        try {
            await k.send(`/api/academic/head/makeups/${encodeURIComponent(id)}/check`, 'POST', { result, note: '', openProblem: false });
            k.toast(result === 'held' ? 'Tekshirildi · maoshda qoladi' : 'Navbatda qoldi — keyinroq qayta qoʻngʻiroq qiling', result === 'held' ? 'win' : 'ok');
            k.invalidate('/api/academic/head/makeups', k.API.ov);
        } catch (e) { k.toast(e.status === 409 ? 'Allaqachon tekshirilgan' : e.message || 'Saqlab boʻlmadi', 'bad'); if (e.status === 409) k.invalidate('/api/academic/head/makeups'); }
        finally { pending.delete('m:' + id); draw(); }
    }

    // =====================================================================================
    // AkdTeachers · Ustozlar (reyting jadvali + panel) va Yordamchilar
    // =====================================================================================
    function viewTeachers() {
        const k = K(), { esc, num, pct } = k;
        const T = k.need(k.API.teachers), A = k.need(k.API.assistants);
        const tItems = T.d?.items || [], aItems = A.d?.items || [];
        const sum = T.d?.summary || {};
        const studentsSum = tItems.reduce((a, t) => a + num(t.students), 0);
        const sub = `${T.d ? studentsSum + ' oʻquvchi · ' : ''}Ball = davomat × 0,6 + oʻzlashtirish × 0,4 · «Vaqtida» ballga kirmaydi`;
        const right = V.ttab === 'teachers' && T.d ? `<span class="akd-sum">Vaqtida <strong>${pct(sum.onTimePct)}%</strong> · Tanaffus <strong>${num(sum.breaksPlanned)}</strong> · Sinov rad <strong class="${num(sum.trialRejects30) ? 'c-amber' : ''}">${num(sum.trialRejects30)}</strong></span>`
            : V.ttab === 'assistants' && A.d ? `<span class="akd-sum">7 kunda aloqa <strong>${num(A.d.summary?.contacted7)} / ${num(A.d.summary?.total)}</strong> · 5+ kun aloqasiz <strong class="${num(A.d.summary?.silent5) ? 'c-amber' : ''}">${num(A.d.summary?.silent5)}</strong></span>` : '';
        const bar = `<div class="akd-filters">${tabs('ttab', [['teachers', `Ustozlar${T.d ? ' · ' + tItems.length : ''}`], ['assistants', `Yordamchilar${A.d ? ' · ' + aItems.length : ''}`]], V.ttab, 'Turi')}<span class="akd-sp"></span>${right}</div>`;
        let table, panel = '';
        if (V.ttab === 'teachers') {
            if (V.tauto && T.d) { V.tauto = false; if (V.tid == null && tItems.length) { const worst = tItems.slice().sort((a, b) => (a.score ?? 999) - (b.score ?? 999))[0]; V.tid = worst.id; } }
            table = withData(k.API.teachers, () => {
                if (!tItems.length) return `<section class="akd-card">${k.emptyBox('team', 'Ustoz topilmadi', 'Bu tilda faol ustoz yoʻq')}</section>`;
                const row = (t, i) => { const sel = String(t.id) === String(V.tid), st = toneOfScore(t.score);
                    return `<tr class="akd-row${sel ? ' is-sel' : ''}" data-k-trow="${esc(t.id)}"${sel ? ' aria-current="true"' : ''}><td class="akd-rank">${num(t.rank) || i + 1}</td>
                        <td><span class="akd-who">${av(k.first(t.name), 36)}<span class="akd-tt"><a href="#ustoz-${esc(t.id)}" data-k-t="${esc(t.id)}">${esc(k.first(t.name))}</a>${t.flag?.text ? k.chip(t.flag.text, t.flag.tone || 'amber') : ''}</span></span></td>
                        <td>${num(t.students)}</td><td>${t.attendancePct != null ? pct(t.attendancePct) + '%' : '—'}</td><td>${t.masteryPct != null ? pct(t.masteryPct) + '%' : '—'}</td><td class="akd-mut">${t.onTimePct != null ? pct(t.onTimePct) + '%' : '—'}</td>
                        <td><span class="akd-score t-${st}">${t.score != null ? num(t.score) : '—'}</span></td></tr>`; };
                return `<section class="akd-card akd-tcard"><table class="akd-table akd-table--t"><thead><tr><th scope="col">#</th><th scope="col">Ustoz</th><th scope="col">Oʻquvchi</th><th scope="col">Davomat</th><th scope="col">Oʻzlashtirish</th><th scope="col">Vaqtida</th><th scope="col">Ball</th></tr></thead><tbody>${tItems.map(row).join('')}</tbody></table></section>`;
            }, `<section class="akd-card akd-tcard">${sk(7, 60)}</section>`);
            if (V.tid != null) panel = teacherPanel();
        } else {
            if (V.tauto && A.d) { V.tauto = false; if (V.aid == null && aItems.length) V.aid = aItems[0].id; }
            table = withData(k.API.assistants, () => {
                if (!aItems.length) return `<section class="akd-card">${k.emptyBox('team', 'Yordamchi ustoz yoʻq')}</section>`;
                const row = a => { const sel = String(a.id) === String(V.aid), r = num(a.students) ? num(a.contacted7) / num(a.students) * 100 : 0;
                    return `<tr class="akd-row${sel ? ' is-sel' : ''}" data-k-arow="${esc(a.id)}"${sel ? ' aria-current="true"' : ''}>
                        <td><span class="akd-who">${av(k.first(a.name), 36)}<span class="akd-tt"><a href="#yordamchi-${esc(a.id)}" data-k-a="${esc(a.id)}">${esc(k.first(a.name))}</a>${a.note ? `<small>${esc(a.note)}</small>` : ''}</span></span></td>
                        <td>${num(a.students)}</td><td><span class="akd-mini"><span class="akd-bar" aria-hidden="true"><i style="width:${pct(r)}%;background:${r >= 75 ? '#0065D6' : '#F79009'}"></i></span>${num(a.contacted7)} / ${num(a.students)}</span></td>
                        <td class="${num(a.silent5) ? 'c-red' : ''}">${num(a.silent5)}</td><td>${a.attendance?.text ? k.chip(a.attendance.text, a.attendance.tone || 'grey') : '—'}</td></tr>`; };
                return `<section class="akd-card akd-tcard"><table class="akd-table"><thead><tr><th scope="col">Yordamchi ustoz</th><th scope="col">Oʻquvchi</th><th scope="col">7 kunda aloqa</th><th scope="col">5+ kun aloqasiz</th><th scope="col">Bugun</th></tr></thead><tbody>${aItems.map(row).join('')}</tbody></table></section>
                    <p class="akd-foot">Aloqa sanaladi: qoʻngʻiroq kamida 5 daqiqa (kuniga 1 ta), yozishma haftasiga 1 ta. Maqsad — har oʻquvchi bilan haftasiga 3 aloqa.</p>`;
            }, `<section class="akd-card akd-tcard">${sk(3, 60)}</section>`);
            if (V.aid != null) panel = assistantPanel();
        }
        return `<div class="akd-split"><div class="akd-main">${h1('Ustozlar', esc(sub))}${bar}${table}</div>${panel}</div>`;
    }
    const lr = (label, val, cls = '') => `<div class="akd-lr"><span>${label}</span><strong class="${cls}">${val}</strong></div>`;
    const kvt = (label, val, tone = '') => `<div class="akd-kv"><span>${label}</span><strong class="${tone ? 'c-' + tone : ''}">${val}</strong></div>`;
    function teacherPanel() {
        const k = K(), { esc, ic, num, pct, MON } = k, url = k.API.teacher(V.tid), c = k.need(url);
        const close = `<button type="button" class="akd-ib" data-k-tclose aria-label="Panelni yopish">${ic('x', 16, 2.2)}</button>`;
        if (!c.d) return `<aside class="akd-panel akd-card" aria-label="Ustoz"><div class="akd-ph"><span class="akd-sp"></span>${close}</div>${c.e ? k.errBox(c.e, url).replace('data-a-retry', 'data-k-retry') : sk(1, 56) + sk(2, 72) + sk(1, 300)}</aside>`;
        const t = c.d, tr = t.trials30 || {}, mk = t.makeups30 || {}, sal = t.salary || {}, pr = t.problems || {};
        const now = new Date(), prevMon = MON[(now.getMonth() + 11) % 12];
        // Ish haqi oyi — salary.month ('YYYY-MM'); toʻlov 5-, qoplashni rad etish 4-sanagacha — undan keyingi oyda.
        const salM = /^\d{4}-(\d{2})/.exec(String(sal.month || '')), salIdx = salM ? Number(salM[1]) - 1 : (now.getMonth() + 11) % 12, afterMon = MON[(salIdx + 1) % 12];
        const onPlan = num(t.studentsCount) ? num(t.onPlanCount) / num(t.studentsCount) * 100 : 0;
        const nm = k.first(t.name), tg = k.tgHref(t.phone), salMon = MON[salIdx];
        const reasons = (tr.rejectReasons || []).map(r => (typeof r === 'string' ? r : r.reason || r.text || '')).filter(Boolean);
        const lockTxt = t.lock ? (/qulf ochiladi/i.test(t.lock.reason || '') ? t.lock.reason : `${t.lock.reason || ''}${t.lock.reason ? '. ' : ''}Davomat belgilansa qulf ochiladi.`) : '';
        return `<aside class="akd-panel akd-card akd-s2" aria-label="${esc(nm)}">
            <div class="akd-ph akd-ph--who">${av(nm, 48, toneOfScore(t.score))}<span class="akd-who-t"><strong>${esc(nm)}</strong><small>Ustoz · ${t.prevScore != null ? `${esc(monLoc(prevMon))} ${num(t.prevScore)} ball` : `${t.score != null ? num(t.score) + ' ball' : 'ball hali yoʻq'}`}</small></span>
                ${t.phone ? `<a class="akd-ib akd-ib--dark" href="${esc(k.telHref(t.phone))}" aria-label="${esc(nm)}ga qoʻngʻiroq">${ic('phone', 18)}</a>` : ''}</div>
            ${t.lock ? `<div class="akd-lock">${ic('lock', 18)}<span><strong>Appi qulfda</strong> · ${esc(lockTxt)}</span></div>` : ''}
            <div class="akd-kvs">${kvt('Sinovlar · 30 kun', `${num(tr.accepted) + num(tr.rejected)} · ${num(tr.rejected)} rad`, num(tr.rejected) ? 'amber' : '')}${kvt('Oʻquvchi boʻldi', String(num(tr.converted)))}${kvt('Ketgan · 30 kun', String(num(t.left30)), num(t.left30) ? 'red' : '')}${kvt('Xavfdagi oʻquvchi', String(num(t.riskStudents)), num(t.riskStudents) ? 'red' : '')}</div>
            <div class="akd-lrs">
              ${lr('Rejada oʻqiyapti', `${pct(onPlan)}% · ${num(t.onPlanCount)} / ${num(t.studentsCount)}`)}
              ${lr('Kech boshlangan darslar', `30 kunda ${num(t.lateLessons30)} ta`)}
              ${lr('Rad sabablari', reasons.length ? esc(reasons.map(r => `«${r}»`).join(', ')) : '—')}
              ${lr('Qoplash (30 kun)', `<a href="#" data-k-go="makeups" data-k-mteacher="${esc(nm)}">${num(mk.total)} ta${num(mk.inReview) ? ` · ${num(mk.inReview)} tasi tekshiruvda` : ''}</a>`)}
              ${lr('Sinov vaqtlari', '<a href="#" data-k-go="slots">Dars jadvalida ›</a>')}
              ${lr(`Ish haqi · ${esc(salMon)} (faqat koʻrish)`, sal.lessons == null ? 'Hisob hali yoʻq' : `${num(sal.lessons)}${num(sal.makeups) ? ` + ${num(sal.makeups)} qoplash` : ''}${sal.amount != null ? ' · ' + esc(k.money(sal.amount)) : ''}`)}
              ${lr('Holat', sal.status === 'paid' ? 'Toʻlangan' : sal.status === 'unpaid' ? `Admin tekshiryapti · 5-${esc(afterMon)} toʻlanadi` : 'Hisob hali yoʻq')}
              ${lr('Eslatma', `Qoplash rad etilsa 4-${esc(afterMon)}gacha oʻzgarishi mumkin`)}
              ${lr(`Oʻquvchilari · ${num(t.studentsCount)}`, `<a href="#" data-k-go="risk" data-k-rteacher="${esc(nm)}">roʻyxat ›</a>`)}
              ${lr('Muammolar', `<a href="#" data-k-go="problems" data-k-pteacher="${esc(nm)}">${num(pr.open) ? `${num(pr.open)} ochiq${num(pr.overdue) ? ` · ${num(pr.overdue)} muddati oʻtgan` : ''}` : 'Ochiq muammo yoʻq'} ›</a>`)}
            </div>
            <div class="akd-acts">${tg ? `<a class="akd-btn akd-btn--ghost" href="${esc(tg)}" target="_blank" rel="noopener">${ic('send', 16)}Telegramda yozish</a>` : `<span class="akd-btn akd-btn--off">${ic('send', 16)}Telegram yoʻq</span>`}<button type="button" class="akd-btn akd-btn--pri akd-grow" data-k-new data-k-newfor="teacher">${ic('plus', 16, 2.6)}Muammo yozish</button></div>
        </aside>`;
    }
    function assistantPanel() {
        const k = K(), { esc, ic, num, MON } = k, url = k.API.assistant(V.aid), c = k.need(url);
        const close = `<button type="button" class="akd-ib" data-k-aclose aria-label="Panelni yopish">${ic('x', 16, 2.2)}</button>`;
        if (!c.d) return `<aside class="akd-panel akd-card" aria-label="Yordamchi"><div class="akd-ph"><span class="akd-sp"></span>${close}</div>${c.e ? k.errBox(c.e, url).replace('data-a-retry', 'data-k-retry') : sk(1, 56) + sk(2, 72) + sk(1, 260)}</aside>`;
        const a = c.d, l7 = a.last7 || {}, sil = (a.silent || []).slice().sort((x, y) => num(y.days) - num(x.days)), sal = a.salary || {}, at = a.attendance || {};
        const now = new Date(), mon = MON[now.getMonth()], nm = k.first(a.name), tg = k.tgHref(a.phone);
        return `<aside class="akd-panel akd-card akd-s2" aria-label="${esc(nm)}">
            <div class="akd-ph akd-ph--who">${av(nm, 48)}<span class="akd-who-t"><strong>${esc(a.name || nm)}</strong><small>Yordamchi ustoz · ${num(a.students)} oʻquvchi</small></span>
                ${a.phone ? `<a class="akd-ib akd-ib--dark" href="${esc(k.telHref(a.phone))}" aria-label="${esc(nm)}ga qoʻngʻiroq">${ic('phone', 18)}</a>` : ''}${close}</div>
            <div class="akd-kvs">${kvt('Kamida 1 aloqa · 7 kun', `${num(l7.contacted)} / ${num(a.students)}`)}${kvt('5+ kun aloqasiz', String(sil.length), sil.length ? 'red' : '')}${kvt('Qoʻngʻiroqlar', String(num(l7.calls)))}${kvt('Yozishmalar', String(num(l7.messages)))}</div>
            ${sil.length ? `<div class="akd-hist"><h3>Aloqasiz qolganlar</h3><ul class="akd-sil">${sil.slice(0, 5).map(x => `<li><a href="#" data-k-student="${esc(x.studentId)}">${esc(k.shortName(x.name))}</a><small>ustoz ${esc(k.first(x.teacherName))}</small>${k.chip(`${num(x.days)} kun`, num(x.days) >= 6 ? 'red' : 'amber')}</li>`).join('')}</ul></div>` : ''}
            <div class="akd-lrs">
              ${lr('Bugun', esc(at.today || '—'))}
              ${lr(`Davomat · ${esc(mon)}`, dvApplies('att') ? `<a href="#" data-k-go="att">${esc(at.monthText || 'Koʻrish')} ›</a>` : esc(at.monthText || '—'))}
              ${lr('Kechikkan aloqalar', `<a href="#" data-k-go="late">${num(a.lateContactsPending) ? `${num(a.lateContactsPending)} ta kutmoqda` : 'Yoʻq'} ›</a>`)}
              ${lr(`Maosh · ${esc(mon)} (faqat koʻrish)`, `${num(sal.counted)} aloqa · ≈ ${esc(k.money(sal.amount))}`)}
              ${lr('Hisob', '40 000 soʻm × aloqa ÷ 13, oʻquvchi boʻyicha')}
              ${lr('Toʻlov', `Oy tugagach tekshiriladi · ${esc(sal.payDate ? k.dLong(sal.payDate) : '5-' + MON[(now.getMonth() + 1) % 12])}`)}
            </div>
            <div class="akd-acts">${tg ? `<a class="akd-btn akd-btn--ghost" href="${esc(tg)}" target="_blank" rel="noopener">${ic('send', 16)}Telegramda yozish</a>` : `<span class="akd-btn akd-btn--off">${ic('send', 16)}Telegram yoʻq</span>`}<button type="button" class="akd-btn akd-btn--pri akd-grow" data-k-new data-k-newfor="assistant">${ic('plus', 16, 2.6)}Muammo yozish</button></div>
        </aside>`;
    }

    // =====================================================================================
    // Xavfdagi oʻquvchilar (jadval + oʻquvchi paneli) — telefondagi A08/A09 mazmuni
    // =====================================================================================
    function viewRisk() {
        const k = K(), { esc, num, pct } = k, url = k.API.risk(V.rtab);
        const counts = (k.need(url).d || k.peek(k.API.risk('all')) || {}).counts || {};
        const all = k.peek(url)?.items || [];
        const tOpts = [...new Set(all.map(r => k.first(r.teacherName)).filter(Boolean))].sort().map(n => [n, n]);
        if (V.rteacher && !tOpts.some(o => o[0] === V.rteacher)) tOpts.push([V.rteacher, V.rteacher]);
        const head = h1('Xavfdagi oʻquvchilar', 'Roʻyxat avtomatik: 3+ kun appga kirmasa, 2+ dars qoldirsa yoki rejadan 6+ dars orqada qolsa. Har birida bitta asosiy sabab koʻrsatiladi.');
        const bar = `<div class="akd-filters">${tabs('rtab', k.RISK.map(([key, t]) => [key, t + cnt(counts[key])]), V.rtab, 'Asosiy sabab')}<span class="akd-sp"></span>${pick('rteacher', 'Ustoz', tOpts, V.rteacher)}</div>`;
        const TB = { red: '#D92D20', amber: '#F79009' };
        const table = withData(url, () => {
            const items = all.filter(r => !V.rteacher || k.first(r.teacherName) === V.rteacher);
            if (!items.length) return `<section class="akd-card">${k.emptyBox('check', 'Xavfdagi oʻquvchi yoʻq', V.rteacher ? `Ustoz ${V.rteacher} oʻquvchilarida xavf yoʻq` : 'Hamma oʻquvchi reja boʻyicha')}</section>`;
            const shown = V.rAll ? items : items.slice(0, 12);
            const row = r => { const tone = k.riskTone(r), total = num(r.totalLessons) || 72, sel = String(r.id) === String(V.sid);
                return `<tr class="akd-row${sel ? ' is-sel' : ''}" data-k-srow="${esc(r.id)}"${sel ? ' aria-current="true"' : ''}><td><span class="akd-who">${av(r.name, 36, tone)}<a href="#oquvchi-${esc(r.id)}" data-k-s="${esc(r.id)}">${esc(k.shortName(r.name))}</a></span></td>
                    <td>${esc(k.first(r.teacherName) || '—')}</td><td><span class="akd-mini"><span class="akd-bar" aria-hidden="true"><i style="width:${pct(num(r.lessonNo) / total * 100)}%;background:${TB[r.reason === 'behind' ? 'red' : tone]}"></i></span>${num(r.lessonNo)}/${total}</span></td><td>${k.chip(r.reasonText || '', tone)}</td></tr>`; };
            return `<section class="akd-card akd-tcard"><table class="akd-table"><thead><tr><th scope="col">Oʻquvchi</th><th scope="col">Ustoz</th><th scope="col">Dars</th><th scope="col">Asosiy sabab</th></tr></thead><tbody>${shown.map(row).join('')}</tbody></table>
                ${!V.rAll && items.length > 12 ? `<button type="button" class="akd-more akd-more--foot" data-k-rall>Yana ${items.length - 12} ta${k.ic('chev', 16, 2)}</button>` : ''}</section>`;
        }, `<section class="akd-card akd-tcard">${sk(6, 60)}</section>`);
        return `<div class="akd-split"><div class="akd-main">${head}${bar}${table}</div>${V.sid != null ? studentPanel() : ''}</div>`;
    }
    function studentPanel() {
        const k = K(), { esc, ic, num, pct } = k, url = k.API.student(V.sid), c = k.need(url);
        const close = `<button type="button" class="akd-ib" data-k-sclose aria-label="Panelni yopish">${ic('x', 16, 2.2)}</button>`;
        if (!c.d) return `<aside class="akd-panel akd-card" aria-label="Oʻquvchi"><div class="akd-ph"><span class="akd-sp"></span>${close}</div>${c.e ? k.errBox(c.e, url).replace('data-a-retry', 'data-k-retry') : sk(1, 56) + sk(1, 90) + sk(2, 72)}</aside>`;
        const s = c.d, a = s.activity || {}, total = num(s.totalLessons) || 72, lesson = num(s.lessonNo), plan = num(s.planLessonNo), behind = Math.max(0, plan - lesson);
        const tone = behind >= 6 ? 'red' : behind > 3 ? 'amber' : 'blue';
        const lessons = s.lessons || [], came = lessons.filter(l => l.status === 'came').length, held = lessons.filter(l => l.status !== 'next').length;
        const pr = s.problems || {}, th = s.teacherHistory || [];
        const TB = { red: '#D92D20', amber: '#F79009', blue: '#0065D6' };
        return `<aside class="akd-panel akd-card akd-s2" aria-label="${esc(s.name || 'Oʻquvchi')}">
            <div class="akd-ph akd-ph--who">${av(s.name, 48, s.risk ? 'red' : 'blue')}<span class="akd-who-t"><strong>${esc(s.name || '—')}</strong><small>Ustoz ${s.teacher?.id ? `<a href="#" data-k-teacher="${esc(s.teacher.id)}">${esc(k.first(s.teacher.name))}</a>` : esc(k.first(s.teacher?.name) || '—')}${s.schedule ? ' · ' + esc(s.schedule) : ''}</small></span>
                ${s.phone ? `<a class="akd-ib akd-ib--dark" href="${esc(k.telHref(s.phone))}" aria-label="Qoʻngʻiroq">${ic('phone', 18)}</a>` : ''}${close}</div>
            ${s.risk?.reasonText ? `<div class="akd-lock akd-lock--amber">${ic('trend', 18)}<span><strong>Xavf</strong> · ${esc(s.risk.reasonText)}</span></div>` : ''}
            <div class="akd-prog"><div class="akd-lr akd-lr--flat"><span><strong class="akd-big">${lesson}</strong> / ${total}-dars</span><strong class="${behind ? 'c-' + (tone === 'blue' ? 'amber' : tone) : 'c-green'}">${behind ? `Rejadan ${behind} dars orqada` : 'Reja boʻyicha'}</strong></div>
                <div class="aka-pbar" aria-hidden="true"><i style="width:${pct(lesson / total * 100)}%;background:${TB[tone]}"></i>${plan ? `<b style="left:${pct(plan / total * 100)}%"></b>` : ''}</div>${plan ? `<small class="akd-mut">Chiziq — reja boʻyicha bugun ${plan}-darsda boʻlishi kerak edi</small>` : ''}</div>
            <div class="akd-kvs">${kvt('Vazifa bajarish', a.completionPct != null ? pct(a.completionPct) + '%' : '—')}${kvt('Haftasiga vaqt', a.weeklyMinutes != null ? esc(k.minTxt(a.weeklyMinutes)) : '—')}${kvt('Koʻp xato', esc(a.topMistake || '—'))}${kvt('Darsga kelish', a.attendancePct != null ? pct(a.attendancePct) + '%' : '—')}</div>
            <div class="akd-hist"><h3>Darslar · oxirgi 4 hafta <small>${came} / ${held} keldi</small></h3>${lessons.length ? `<ol class="aka-days" aria-label="Dars kunlari">${lessons.map(l => { const d = k.toDate(l.date); return `<li class="is-${esc(l.status)}" aria-label="${esc(k.dShort(l.date))}: ${l.status === 'came' ? 'keldi' : l.status === 'missed' ? 'kelmadi' : l.status === 'unmarked' ? 'belgilanmagan' : 'keyingi'}">${d ? d.getDate() : ''}</li>`; }).join('')}</ol>` : '<p class="akd-mut">Oxirgi 4 haftada dars yoʻq</p>'}</div>
            ${k.assistBlock ? k.assistBlock(s, true) : ''}
            <div class="akd-lrs">${lr('Muammolar', `<a href="#" data-k-go="problems" data-k-pq="${esc(s.name || '')}" data-k-ptab="${num(pr.open) ? 'open' : 'closed'}">${num(pr.open) ? `${num(pr.open)} ta ochiq` : 'ochigʻi yoʻq'}${num(pr.closed) ? ` · ${num(pr.closed)} ta yopilgan` : ''} ›</a>`)}${lr('Ustozlar tarixi', `<a href="#" data-k-thist>${esc(th.length ? th.map(t => `${k.first(t.name)} · ${k.dLong(t.from)}dan`).slice(-1)[0] : '—')} ›</a>`)}</div>
            <div class="akd-acts"><button type="button" class="akd-btn akd-btn--ghost" data-k-transfer="${esc(s.id)}">${ic('team', 16)}Ustozni almashtirish</button><button type="button" class="akd-btn akd-btn--pri akd-grow" data-k-new data-k-newfor="student">${ic('plus', 16, 2.6)}Muammo yozish</button></div>
        </aside>`;
    }

    // =====================================================================================
    // Kechikkan aloqalar (yordamchilar) — telefondagi A19 mazmuni, jadval koʻrinishida
    // =====================================================================================
    function viewLate() {
        const k = K(), { esc, ic, num } = k, url = k.API.late(V.ltab), pend = k.need(k.API.late('pending'));
        const n = pend.d ? (pend.d.items || []).length : null;
        const head = h1('Kechikkan aloqalar', 'Yordamchilar · faqat shu oy. Tasdiqlansa aloqa sanaladi: «aloqasiz» hisobi va yordamchi maoshi darhol yangilanadi. Rad etishda sabab majburiy; admin ham tasdiqlay oladi — kim birinchi hal qilsa, shu qoladi.');
        const bar = `<div class="akd-filters">${tabs('ltab', [['pending', `Kutmoqda${cnt(n)}`], ['history', 'Tarix']], V.ltab, 'Holat')}</div>`;
        const table = withData(url, d => {
            const items = d.items || [];
            if (!items.length) return `<section class="akd-card">${k.emptyBox(V.ltab === 'pending' ? 'check' : 'archive', V.ltab === 'pending' ? 'Tasdiq kutayotgan aloqa yoʻq' : 'Tarix boʻsh', V.ltab === 'pending' ? 'Yordamchi kechikkan aloqa kiritsa shu yerda chiqadi' : '')}</section>`;
            const row = x => { const rc = x.ruleCheck || {}, nm = k.shortName(x.studentName);
                const st = x.status === 'approved' ? k.chip('Tasdiqlandi', 'green') : x.status === 'rejected' ? k.chip('Rad etildi', 'red') : '';
                const who = (x.decidedBy || x.decidedByName) ? (x.decidedBy === 'Siz' || k.isMe(x.decidedByName) ? 'Siz' : (x.decidedByName || x.decidedBy)) : '';
                return `<tr class="akd-row"><td><strong>${esc(nm)}</strong><small>ustoz ${esc(k.first(x.teacherName))}</small></td><td>${esc(k.first(x.assistantName))}</td>
                    <td class="akd-nw">${esc(x.at ? k.dtComma(x.at) : '—')}<small>${esc(x.kind === 'call' ? `qoʻngʻiroq ${num(x.minutes)} daqiqa` : 'yozishma')}</small></td>
                    <td class="akd-norm">${x.reason ? '«' + esc(x.reason) + '»' : '—'}</td><td>${rc.text ? `<span class="c-${rc.ok ? 'green' : 'red'} akd-b13">${rc.ok ? '✓' : '✕'} ${esc(rc.text)}</span>` : '—'}</td>
                    <td class="akd-mut">${esc(x.enteredAt ? k.relDT(x.enteredAt) : '—')}</td>
                    <td class="akd-acts-td">${V.ltab === 'pending' ? `<button type="button" class="akd-btn akd-btn--ghost akd-btn--sm" data-k-lrej="${esc(x.id)}"${pending.has('l:' + x.id) ? ' disabled' : ''}>Rad etish…</button><button type="button" class="akd-btn akd-btn--green akd-btn--sm" data-k-lok="${esc(x.id)}"${pending.has('l:' + x.id) ? ' disabled aria-busy="true"' : ''}>${ic('check', 14, 2.8)}Tasdiqlash</button>`
                        : `${st}${who ? `<small>${esc(who)}${x.decisionNote ? ' · «' + esc(x.decisionNote) + '»' : ''}</small>` : ''}`}</td></tr>`; };
            return `<section class="akd-card akd-tcard"><table class="akd-table"><thead><tr><th scope="col">Oʻquvchi</th><th scope="col">Yordamchi</th><th scope="col">Aloqa</th><th scope="col">Sabab</th><th scope="col">Qoida</th><th scope="col">Kiritildi</th><th scope="col"><span class="aka-sr">Amallar</span></th></tr></thead><tbody>${items.map(row).join('')}</tbody></table></section>`;
        }, `<section class="akd-card akd-tcard">${sk(3, 64)}</section>`);
        return `<div class="akd-main">${head}${bar}${table}</div>`;
    }

    // =====================================================================================
    // Muammo yozish (A03 — telefondagi forma, oyna koʻrinishida)
    // =====================================================================================
    function openNew(extra = {}) {
        const k = K(); if (!k) return;
        draft = k.newDraft(extra); draft.sq = '';
        k.openSheet('Muammo yozish', 'Yangi karta', `<form class="aka-form akd-nf" data-nf novalidate></form>`, w => {
            w.querySelector('.aka-sheet').classList.add('akd-sheet--wide');
            const fm = w.querySelector('[data-nf]');
            drawNew(fm);
            fm.addEventListener('input', e => {
                const el = e.target;
                if (el.matches('[data-d]')) draft[el.dataset.d] = el.value;
                if (el.matches('[data-sq]')) { draft.sq = el.value; const box = fm.querySelector('[data-sl]'); if (box) box.innerHTML = studentList(); }
            });
            fm.addEventListener('change', e => {
                const el = e.target;
                if (el.type === 'radio' && ['type', 'source', 'owner', 'due'].includes(el.name)) { draft[el.name] = el.value; if (el.name === 'due' || el.name === 'owner') drawNew(fm); }
                if (el.matches('[data-staff]')) { const x = k.staffList().find(s => String(s.id) === el.value); draft.ownerStaff = x ? { id: x.id, name: x.name } : null; }
            });
            fm.addEventListener('click', e => {
                const b = e.target.closest('[data-sid],[data-schange],[data-nsave],[data-ncancel]'); if (!b) return;
                if ('ncancel' in b.dataset) { k.closeSheet(); return; }
                if ('nsave' in b.dataset) { saveNew(b); return; }
                if ('schange' in b.dataset) { draft.studentId = null; drawNew(fm); fm.querySelector('[data-sq]')?.focus(); return; }
                const x = k.localStudents().find(s => String(s.id) === b.dataset.sid); if (!x) return;
                Object.assign(draft, { studentId: x.id, studentName: x.name, teacherId: x.teacherId || null, teacherName: x.teacherName || '', studentMeta: [x.lessonNo ? x.lessonNo + '-dars' : '', x.schedule].filter(Boolean).join(' · ') });
                if (draft.owner === 'teacher' && !x.teacherId) draft.owner = 'self';
                drawNew(fm);
            });
            fm.addEventListener('submit', e => e.preventDefault());
            setTimeout(() => (fm.querySelector('[data-sq]') || fm.querySelector('#akdNTitle'))?.focus(), 80);
        });
    }
    function studentList() {
        const k = K(), { esc } = k, all = k.localStudents(), q = String(draft?.sq || '').trim().toLowerCase();
        const list = all.filter(x => !q || x.name.toLowerCase().includes(q) || String(x.teacherName || '').toLowerCase().includes(q)).slice(0, 40);
        return list.length ? list.map(x => `<button type="button" class="aka-srow" data-sid="${esc(x.id)}">${k.ava(x.name, 36)}<span><strong>${esc(x.name)}</strong><small>${esc([x.teacherName ? 'Ustoz: ' + k.first(x.teacherName) : '', x.lessonNo ? x.lessonNo + '-dars' : '', x.schedule].filter(Boolean).join(' · '))}</small></span></button>`).join('')
            : `<p class="aka-muted">${all.length ? 'Topilmadi' : 'Oʻquvchilar roʻyxati hali yuklanmagan.'}</p>`;
    }
    function drawNew(fm) {
        const k = K(), { esc, ic } = k, D = draft;
        const staff = k.staffList();
        const owners = [['self', 'Siz']];
        if (D.teacherId && D.teacherName) owners.push(['teacher', `${k.first(D.teacherName)} (ustoz)`]);
        if (staff.length) owners.push(['staff', 'Boshqa xodim…']);
        owners.push(['later', 'Keyinroq']);
        const dues = k.dueOptions();
        if (!dues.some(x => x[0] === D.due)) D.due = 'tomorrow';
        const student = D.studentId
            ? `<div class="aka-pick">${k.ava(D.studentName, 40)}<span class="aka-pick-t"><strong>${esc(D.studentName)}</strong><small>${esc([D.teacherName ? 'Ustoz: ' + k.first(D.teacherName) : '', D.studentMeta].filter(Boolean).join(' · '))}</small></span><button type="button" class="akd-linkbtn" data-schange>Oʻzgartirish</button></div>`
            : `<label class="aka-search">${ic('search', 18)}<span class="aka-sr">Oʻquvchini qidirish</span><input type="search" placeholder="Ism yoki ustoz" data-sq value="${esc(D.sq || '')}" autocomplete="off"></label><div class="aka-slist akd-slist" data-sl>${studentList()}</div>`;
        fm.innerHTML = `<div class="aka-fld"><span class="aka-lbl">Oʻquvchi <i>*</i></span>${student}<small class="aka-hint">Ustoz oʻquvchidan avtomatik olinadi</small></div>
            ${k.fs('Muammo turi', true, k.chips('type', k.TYPES, D.type))}
            ${k.fs('Kim xabar berdi', true, k.chips('source', k.SOURCES, D.source))}
            <label class="aka-fld"><span class="aka-lbl">Qisqa sarlavha <i>*</i></span><input id="akdNTitle" class="aka-inp" type="text" maxlength="140" value="${esc(D.title)}" data-d="title" placeholder="Masalan: ustoz darsga kech kiryapti" required></label>
            <label class="aka-fld"><span class="aka-lbl">Tafsilot</span><textarea class="aka-ta" rows="3" maxlength="2000" data-d="details" placeholder="Kim, qachon, nima dedi…">${esc(D.details)}</textarea></label>
            ${k.fs('Masʼul', false, k.chips('owner', owners, D.owner) + (D.owner === 'staff' ? `<label class="aka-fld"><span class="aka-sr">Xodim</span><select class="aka-inp" data-staff><option value="">Xodimni tanlang</option>${staff.map(e => `<option value="${esc(e.id)}"${D.ownerStaff && String(D.ownerStaff.id) === String(e.id) ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>` : ''))}
            ${k.fs('Muddat', true, k.chips('due', dues, D.due) + (D.due === 'custom' ? `<label class="aka-fld"><span class="aka-sr">Sana va vaqt</span><input class="aka-inp" type="datetime-local" value="${esc(D.dueCustom)}" data-d="dueCustom" min="${k.localDate()}T00:00"></label>` : ''))}
            ${k.note('Masʼul tanlanmasa karta «Qayd etildi»da qoladi. Muddat oʻtsa karta qizarib, bot sizga va masʼulga Telegramda eslatadi.')}
            <div class="akd-acts"><button type="button" class="aka-btn aka-btn--ghost aka-btn--fit" data-ncancel>Bekor qilish</button><button type="button" class="aka-btn aka-btn--pri" data-nsave>Kartani ochish</button></div>`;
    }
    async function saveNew(btn) {
        const k = K(), D = draft; if (!D) return;
        if (!D.studentId) { k.toast('Oʻquvchini tanlang', 'bad'); return; }
        if (!D.title.trim()) { k.toast('Qisqa sarlavha yozing', 'bad'); document.getElementById('akdNTitle')?.focus(); return; }
        let due;
        if (D.due === 'custom') { const d = D.dueCustom ? new Date(D.dueCustom) : null; due = d && !Number.isNaN(d.getTime()) ? d : null; }
        else due = (k.dueOptions().find(x => x[0] === D.due) || [])[2] || null;
        if (!due) { k.toast('Muddatni tanlang', 'bad'); return; }
        if (due < new Date()) { k.toast('Muddat oʻtgan vaqt boʻlmasin', 'bad'); return; }
        if (D.owner === 'staff' && !D.ownerStaff) { k.toast('Masʼul xodimni tanlang', 'bad'); return; }
        const ownerId = D.owner === 'self' ? 'self' : D.owner === 'teacher' ? D.teacherId : D.owner === 'staff' ? (D.ownerStaff?.id || null) : null;
        btn.disabled = true;
        try {
            const r = await k.send('/api/academic/problems', 'POST', { studentId: D.studentId, type: D.type, source: D.source, title: D.title.trim(), details: D.details.trim(), ownerId, dueAt: due.toISOString() });
            k.invalidate('/api/academic/problems', k.API.ov, '/api/academic/head/students/' + D.studentId);
            draft = null; k.closeSheet(true);
            k.toast('Muammo kartasi ochildi', 'win');
            const id = r?.item?.id ?? r?.id;
            nav('problems', { ptab: 'open', pid: id ?? null });
        } catch (e) { btn.disabled = false; k.toast(e.message || 'Saqlab boʻlmadi', 'bad'); }
    }
    function newFor(kind) {
        const k = K();
        if (kind === 'student') { const s = k.peek(k.API.student(V.sid)); if (s) return openNew({ studentId: s.id, studentName: s.name, teacherId: s.teacher?.id || null, teacherName: s.teacher?.name || '', studentMeta: [s.lessonNo ? s.lessonNo + '-dars' : '', s.schedule || ''].filter(Boolean).join(' · ') }); }
        if (kind === 'teacher') return openNew({ type: 'teacher', source: 'self' });
        if (kind === 'assistant') return openNew({ source: 'assistant' });
        return openNew();
    }

    // =====================================================================================
    // Chizish
    // =====================================================================================
    const VIEWS = { home: viewHome, problems: viewProblems, archive: viewProblems, teachers: viewTeachers, makeups: viewMakeups, risk: viewRisk, late: viewLate };
    // Telefon oynalari akademikApp.state (pid/sid/tid/mtab) bo'yicha ishlaydi — ochishdan oldin shu yerdan uzatiladi.
    function syncState() { const S = window.akademikApp?.state; if (!S) return; S.pid = V.pid; S.sid = V.sid; S.tid = V.tid; S.mtab = V.mtab; S.ltab = V.ltab; }
    function draw(anim = false) {
        if (!root || !K()) return;
        if (V.view === 'archive') V.ptab = 'closed';
        const keep = {};
        root.querySelectorAll('input[id], textarea[id]').forEach(el => { if (el.value && el.type !== 'radio' && el.type !== 'checkbox') keep[el.id] = el.value; });
        const act = document.activeElement, focusKey = act && root.contains(act) ? (act.id ? '#' + act.id : focusSel(act)) : '';
        let html;
        try { html = (VIEWS[V.view] || viewHome)(); }
        catch (e) { console.error('[akademikDesk]', e); html = `<div class="akd-main">${h1('Xatolik', 'Sahifani chizib boʻlmadi')}${K().emptyBox('alert', 'Sahifani chizib boʻlmadi', e.message || '')}</div>`; }
        root.dataset.view = V.view;
        root.classList.toggle('akd-enter', !!anim);
        root.innerHTML = `<div class="akd-page">${html}</div>`;
        Object.keys(keep).forEach(id => { const el = root.querySelector('#' + id); if (el && !el.value) el.value = keep[id]; });
        if (focusKey) { try { root.querySelector(focusKey)?.focus({ preventScroll: true }); } catch (e) { /* */ } }
        syncState();
        updateBadges();
    }
    // Qayta chizishda fokus o'z joyida qolsin (jadval qatori, tab, filtr).
    function focusSel(el) {
        const attrs = ['data-k-p', 'data-k-t', 'data-k-a', 'data-k-s', 'data-k-ptab', 'data-k-mtab', 'data-k-ttab', 'data-k-rtab', 'data-k-ltab', 'data-k-ptype', 'data-k-pteacher', 'data-k-mteacher', 'data-k-rteacher', 'data-k-stage', 'data-k-postpone', 'data-k-close', 'data-k-owner', 'data-k-transfer', 'data-k-thist', 'data-k-lrej', 'data-k-lok', 'data-k-trow', 'data-k-prow', 'data-k-srow', 'data-k-arow'];
        for (const a of attrs) if (el.hasAttribute(a)) return `[${a}="${CSS.escape(el.getAttribute(a))}"]`;
        if ('kNew' in el.dataset) return el.dataset.kNewfor ? `[data-k-newfor="${el.dataset.kNewfor}"]` : '.akd-h1row [data-k-new]';
        if (el.dataset.kMres) return `[data-k-mres="${el.dataset.kMres}"][data-k-mid="${CSS.escape(el.dataset.kMid)}"]`;
        return '';
    }
    function updateBadges() {
        const k = K(); if (!k) return;
        const ov = k.peek(k.API.ov), t = ov?.tiles || {};
        const vals = {
            problems: k.peek(k.API.problems('open'))?.counts?.open,
            makeups: t.makeupsPending,
            late: k.peek(k.API.late('pending')) ? (k.peek(k.API.late('pending')).items || []).length : null,
            attreq: dvApplies('attreq') ? dvInfo().pending : null,
        };
        // DAVOMAT bandlari faqat davomat.menuInfo() mos kelsa (davomatApp telefonda yuklanadi; kompyuterda — "Mening davomatim" zaxira oynasi bilan).
        ['att', 'attreq'].forEach(key => { const a = document.querySelector(`#sidebarMenu .menu-item[data-akd="${key}"]`); if (a) a.style.display = dvApplies(key) ? '' : 'none'; });
        const myA = document.querySelector('#sidebarMenu .menu-item[data-akd="myatt"]');
        if (myA) myA.style.display = dvApplies('myatt') || (isDesk() && !window.davomat?.state?.() && window.staffAttendanceUI?.openCheckSheet) ? '' : 'none';
        const dvSep = [...document.querySelectorAll('#sidebarMenu .menu-sep--group')].find(x => x.textContent.trim() === 'Davomat');
        if (dvSep) dvSep.style.display = ['att', 'attreq', 'myatt'].some(key => document.querySelector(`#sidebarMenu .menu-item[data-akd="${key}"]`)?.style.display !== 'none') ? '' : 'none';
        document.querySelectorAll('[data-akd-badge]').forEach(b => {
            const n = Number(vals[b.dataset.akdBadge]) || 0;
            b.hidden = !n; b.textContent = n ? (n > 99 ? '99+' : String(n)) : '';
            const a = b.closest('a'); const l = a?.querySelector('.label')?.textContent || '';
            if (a) { if (n) a.setAttribute('aria-label', `${l}, ${n} ta`); else a.removeAttribute('aria-label'); }
        });
    }
    function render(el, ctx = {}) {
        if (!isAk()) return;
        init();
        root = el || root;
        if (!root || !K()) return;
        if (!isDesk()) { root.innerHTML = ''; return; }
        const v = ctx.akd || 'home';
        if (v !== V.view) {
            if (v === 'problems' && V.ptab === 'closed') { V.ptab = 'open'; V.pid = null; }
            if ((v === 'problems' || v === 'archive') && V.pid == null) V.pauto = true;
            if (v === 'teachers' && V.tid == null && V.aid == null) V.tauto = true;
        }
        const changed = v !== V.view || !root.firstChild;
        V.view = v;
        if (!root._akd) bind(root);
        draw(changed);
    }

    // ---------- hodisalar ----------
    function bind(el) {
        el._akd = true;
        el.addEventListener('click', onClick);
        el.addEventListener('change', onChange);
        el.addEventListener('submit', onSubmit);
    }
    // Esc oʻng panelni yopadi (fokus body'da boʻlsa ham); ochiq oyna boʻlsa — oynaning oʻzi yopiladi.
    function onEsc(e) {
        if (e.key !== 'Escape' || e.defaultPrevented || !root || !isDesk() || !activeTab() || document.querySelector('.aka-sheet-wrap, .satt-overlay, [role="dialog"][aria-modal="true"]:not([hidden])')) return;
        const a = document.activeElement;
        if (a && a !== document.body && !root.contains(a)) return;
        if (V.pid != null && ['problems', 'archive'].includes(V.view)) { const id = V.pid; V.pid = null; V.pauto = false; draw(); root.querySelector(`[data-k-p="${CSS.escape(String(id))}"]`)?.focus(); }
        else if (V.view === 'teachers' && (V.tid != null || V.aid != null)) { const sel = V.tid != null ? `[data-k-t="${CSS.escape(String(V.tid))}"]` : `[data-k-a="${CSS.escape(String(V.aid))}"]`; V.tid = null; V.aid = null; V.tauto = false; draw(); root.querySelector(sel)?.focus(); }
        else if (V.view === 'risk' && V.sid != null) { const sel = `[data-k-s="${CSS.escape(String(V.sid))}"]`; V.sid = null; draw(); root.querySelector(sel)?.focus(); }
    }
    function onClick(e) {
        const k = K(); if (!k) return;
        const t = e.target.closest('a, button, tr[data-k-prow], tr[data-k-trow], tr[data-k-arow], tr[data-k-srow]');
        if (!t || !root.contains(t)) return;
        const d = t.dataset;
        if (t.tagName === 'A' && /^(tel:|https?:)/.test(t.getAttribute('href') || '')) return;
        if (t.tagName === 'A') e.preventDefault();
        if ('kRetry' in d) { const c = k.need(d.kRetry); c.e = null; c.at = 0; k.need(d.kRetry, true); draw(); return; }
        // Oyna yopilgach fokus shu tugmaga qaytadi (sahifa oraliqda qayta chizilgan boʻlsa ham).
        if (['kNew', 'kOwner', 'kPostpone', 'kClose', 'kTransfer', 'kThist', 'kLrej'].some(x => x in d) || d.kMres === 'not_held') opener = focusSel(t);
        if ('kNew' in d) { if (d.kNewfor) newFor(d.kNewfor); else openNew(); return; }
        if ('kGo' in d) {
            const view = d.kGo;
            if (['slots', 'att', 'attreq', 'myatt', 'book'].includes(view)) { nav(view); return; }
            nav(view, { ttab: d.kTtab, aid: d.kAid, ptab: d.kPtab, pq: d.kPq, pteacher: d.kPteacher, mteacher: d.kMteacher, rtab: d.kRtab, rteacher: d.kRteacher });
            return;
        }
        if ('kAllnotifs' in d) { document.getElementById('notifToggle')?.click(); return; }
        if ('kNotif' in d) {
            const n = (k.notifs.list() || []).find(x => String(x.id) === String(d.kNotif));
            k.notifs.open(d.kNotif);
            const v = n && nView(n.etype);
            if (v) nav(v); else if (n?.tab && n.tab !== 'dashboard') switchTab(n.tab); else draw();
            return;
        }
        if ('kPtab' in d) { if (d.kPtab !== 'closed' && V.view === 'archive') { nav('problems', { ptab: d.kPtab }); return; } if (d.kPtab === 'closed' && V.view === 'problems') { nav('archive'); return; } V.ptab = d.kPtab; V.pid = null; V.pauto = true; V.later = false; draw(); return; }
        if ('kPqx' in d) { V.pq = ''; V.pid = null; V.pauto = true; draw(); return; }
        if ('kLater' in d) { V.later = true; draw(); return; }
        if ('kP' in d || 'kProw' in d) { const id = d.kP || d.kProw; if (String(V.pid) !== String(id)) { V.pid = id; V.pauto = false; draw(); } return; }
        if ('kPclose' in d) { const id = V.pid; V.pid = null; draw(); root.querySelector(`[data-k-p="${CSS.escape(String(id))}"]`)?.focus(); return; }
        if ('kStage' in d) {
            const key = 'stage:' + V.pid; if (pending.has(key)) return;
            pending.add(key); t.disabled = true; syncState();
            k.patchProblem({ stage: d.kStage }, `Bosqich: ${k.stageOf(d.kStage)[1]}`).finally(() => { pending.delete(key); draw(); });
            return;
        }
        if ('kOwner' in d) { syncState(); k.dlg.owner(); return; }
        if ('kPostpone' in d) { syncState(); k.dlg.postpone(); return; }
        if ('kClose' in d) { syncState(); k.dlg.close(); return; }
        if ('kTransfer' in d) { syncState(); k.dlg.transfer(d.kTransfer); return; }
        if ('kThist' in d) { syncState(); k.dlg.teacherHistory(); return; }
        if ('kStudent' in d) { nav('risk', { sid: d.kStudent }); return; }
        if ('kTeacher' in d) { nav('teachers', { tid: d.kTeacher }); return; }
        if ('kMtab' in d) { V.mtab = d.kMtab; V.mAll = false; draw(); return; }
        if ('kMall' in d) { V.mAll = true; draw(); return; }
        if ('kMres' in d) { makeupResult(d.kMid, d.kMres, t); return; }
        if ('kTtab' in d) { V.ttab = d.kTtab; V.tauto = true; draw(); return; }
        if ('kT' in d || 'kTrow' in d) { V.tid = d.kT || d.kTrow; V.tauto = false; draw(); return; }
        if ('kA' in d || 'kArow' in d) { V.aid = d.kA || d.kArow; V.tauto = false; draw(); return; }
        if ('kTclose' in d) { V.tid = null; V.tauto = false; draw(); return; }
        if ('kAclose' in d) { V.aid = null; V.tauto = false; draw(); return; }
        if ('kRtab' in d) { V.rtab = d.kRtab; V.rAll = false; draw(); return; }
        if ('kRall' in d) { V.rAll = true; draw(); return; }
        if ('kS' in d || 'kSrow' in d) { V.sid = d.kS || d.kSrow; draw(); return; }
        if ('kSclose' in d) { V.sid = null; draw(); return; }
        if ('kLtab' in d) { V.ltab = d.kLtab; draw(); return; }
        if ('kLok' in d) {
            const key = 'l:' + d.kLok; if (pending.has(key)) return;
            pending.add(key); syncState(); draw();
            k.decideLate(d.kLok, true, '', null).finally(() => { pending.delete(key); draw(); });
            return;
        }
        if ('kLrej' in d) { syncState(); k.dlg.lateReject(d.kLrej); return; }
    }
    function onChange(e) {
        const el = e.target;
        if (el.matches('[data-k-ptype]')) { V.ptype = el.value; V.pid = null; V.pauto = true; draw(); }
        else if (el.matches('[data-k-pteacher]')) { V.pteacher = el.value; V.pid = null; V.pauto = true; draw(); }
        else if (el.matches('[data-k-mteacher]')) { V.mteacher = el.value; V.mAll = false; draw(); }
        else if (el.matches('[data-k-rteacher]')) { V.rteacher = el.value; V.rAll = false; draw(); }
    }
    async function onSubmit(e) {
        const fm = e.target.closest('[data-k-cmt]'); if (!fm) return;
        e.preventDefault();
        const k = K(), inp = fm.querySelector('input'), v = inp.value.trim(); if (!v) return;
        const btn = fm.querySelector('button'); btn.disabled = true;
        try {
            await k.send(k.API.problem(V.pid) + '/events', 'POST', { kind: 'comment', text: v });
            inp.value = '';
            k.invalidate('/api/academic/problems');
            k.need(k.API.problem(V.pid), true);
            k.toast('Izoh saqlandi');
        } catch (er) { k.toast(er.message || 'Saqlab boʻlmadi', 'bad'); }
        btn.disabled = false;
    }

    function onData() {
        updateBadges();
        if (!root || !isDesk() || !activeTab()) return;
        draw();
    }
    function init() {
        if (inited || !isAk() || !K()) return;
        inited = true;
        // Belgi faqat kompyuterda: telefonda css/akademikApp.css tokenlari (--a-nav) oʻzgarmasin.
        const syncCls = () => document.body.classList.toggle('akd-on', isDesk());
        syncCls();
        K().on(onData);
        K().onSheetClose(() => setTimeout(() => {
            if (!opener || !root || !activeTab() || document.querySelector('.aka-sheet-wrap')) return;
            const a = document.activeElement;
            if (!a || a === document.body || !document.body.contains(a)) root.querySelector(opener)?.focus({ preventScroll: true });
            opener = '';
        }, 0));
        document.addEventListener('keydown', onEsc);
        const k = K();
        k.need(k.API.ov); k.need(k.API.problems('open')); k.need(k.API.late('pending'));
        MQ.addEventListener?.('change', () => { syncCls(); if (activeTab()) { if (isDesk()) draw(); else if (root) root.innerHTML = ''; } });
        window.addEventListener('staff:feed', () => { if (isDesk() && activeTab() && V.view === 'home' && !document.querySelector('.aka-sheet-wrap')) draw(); });
        setInterval(() => {
            if (!isDesk() || document.visibilityState !== 'visible') return;
            const kk = K(); kk.need(kk.API.ov); kk.need(kk.API.problems('open')); kk.need(kk.API.late('pending'));
            if (activeTab() && !document.querySelector('.aka-sheet-wrap')) draw();
        }, 60000);
        updateBadges();
        // davomatApp /me ni oʻzi yuklaydi (telefonda) — kelgach DAVOMAT bandlari koʻrinishi yangilanadi.
        let dvTries = 0;
        if (isDesk()) window.davomat?.peekMe?.().then(updateBadges);
        const dvPoll = setInterval(() => { updateBadges(); if (window.davomat?.state?.() || ++dvTries > 20) clearInterval(dvPoll); }, 1500);
    }
    function boot() { if (isAk()) init(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 120));
    else setTimeout(boot, 120);

    window.akademikDesk = { render, nav, isDesk, openNew, state: V, _test: { maskPhone, draw: () => draw() } };
})();
