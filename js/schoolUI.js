// Akademik bo'lim va yagona dars jadvali — CRM ko'rinishlari (/api/school bilan).
// Bitta manba: hamma amal serverda bajariladi, keyin kesh qayta yuklanadi.
// Ustoz va yordamchiga tarif/to'lov summasi hech qachon chizilmaydi.
(function () {
    'use strict';
    const DAY = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const DAY_FULL = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
    const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const STUDENT_AVATARS = ['tulki', 'mushuk', 'ayiq', 'boyqush', 'panda', 'quyon', 'sher', 'pingvin', 'kuchukcha', 'toshbaqa'];

    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const role = () => (typeof getCurrentUser === 'function' ? getCurrentUser()?.role : '') || '';
    const isFull = () => ['admin', 'boshliq'].includes(role());
    const isManager = () => ['admin', 'boshliq', 'rop'].includes(role());
    const toast = (m, ms = 2600) => (typeof showMiniToast === 'function' ? showMiniToast(m, ms) : alert(m));
    async function api(path, opts = {}) {
        const o = { ...opts };
        if (o.body && typeof o.body !== 'string') o.body = JSON.stringify(o.body);
        return apiFetch('/api/school' + path, o);
    }
    const post = (p, body) => api(p, { method: 'POST', body: body || {} });
    async function refreshCache() { try { if (typeof reloadStateFromApi === 'function') await reloadStateFromApi(); } catch (e) { console.warn('[school] kesh yangilanmadi', e.message); } }

    // ── Sana / vaqt (Toshkent) ───────────────────────────────────────────────
    function today() { const t = new Date(Date.now() + 5 * 3600000); return t.toISOString().slice(0, 10); }
    function nowMin() { const t = new Date(Date.now() + 5 * 3600000); return t.getUTCHours() * 60 + t.getUTCMinutes(); }
    function addDays(d, n) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
    function wd(d) { const x = new Date(d + 'T00:00:00Z').getUTCDay(); return x === 0 ? 7 : x; }
    function weekStart(d) { return addDays(d, 1 - wd(d)); }
    function fmtDate(d, withDay = true) { if (!d) return '—'; const [y, m, dd] = d.split('-').map(Number); return `${withDay ? DAY[wd(d) - 1] + ', ' : ''}${dd}-${MONTHS[m - 1]}`; }
    const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    const toMin = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    const pattern = d => ([1, 3, 5].includes(Number(d)) ? 'Du·Ch·Ju' : [2, 4, 6].includes(Number(d)) ? 'Se·Pa·Sh' : DAY[Number(d) - 1] || '—');

    // ── Avatarlar: o'quvchi — ilovadagi rasm yoki standart tulki; xodim — 3D personaj ──
    function studentAvatar(s, size = 32) {
        // Personaj tanlamagan o'quvchilar hammasi tulki bo'lib qolmasin: ID bo'yicha doimiy personaj.
        const pick = id => { let h = 0; for (const ch of String(id || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return STUDENT_AVATARS[h % STUDENT_AVATARS.length]; };
        const url = s?.avatarUrl && /^(\/|https:)/.test(s.avatarUrl) ? s.avatarUrl : `/images/student-avatars/${pick(s?.id || s?.name)}.webp`;
        return `<img class="sc-av" src="${esc(url)}" width="${size}" height="${size}" alt="" loading="lazy" onerror="this.onerror=null;this.src='/images/student-avatars/tulki.webp'">`;
    }
    function staffAvatarUrl(avatar) {
        if (avatar && /^(\/|https:|data:image\/)/.test(avatar)) return avatar;
        return '';
    }
    let _avatars = {};
    let _avP = null;
    function loadStaffAvatars() { return (_avP ||= api('/staff-avatars').then(r => { _avatars = r.avatars || {}; }).catch(() => { _avP = null; })); }
    function staffAvatar(person, size = 32) {
        const url = staffAvatarUrl(person?.avatar || _avatars[person?.id]);
        return url ? `<img class="sc-av" src="${esc(url)}" width="${size}" height="${size}" alt="" loading="lazy">`
            : `<span class="sc-av sc-av--blank" style="width:${size}px;height:${size}px" aria-hidden="true"></span>`;
    }

    // ── Keshdan ma'lumot ─────────────────────────────────────────────────────
    const cache = key => (typeof getItem === 'function' && typeof STORAGE_KEYS !== 'undefined' ? getItem(STORAGE_KEYS[key], []) : []);
    const students = () => cache('students');
    const studentById = id => students().find(s => s.id === id) || null;
    function staffList() { return cache('hrEmployees'); }
    function teacherName(id, short = false) {
        const e = staffList().find(x => x.id === id) || cache('teachers').find(x => x.id === id);
        if (!e) return '—';
        if (!short) return e.name;
        const p = String(e.name || '').split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : e.name;
    }
    function teachersForSubject(subject = 'english') {
        return staffList().filter(e => ['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi'].includes(e.role) && (e.status || 'active') !== 'inactive'
            && (e.lang === 'both' || (e.role === 'rus-oqituvchi' ? 'russian' : e.role === 'ingliz-oqituvchi' ? 'english' : e.lang === 'russian' ? 'russian' : 'english') === subject));
    }
    function assistants() { return staffList().filter(e => e.role === 'yordamchi' && (e.status || 'active') !== 'inactive'); }
    function tgPill(group) {
        if (!group?.name) return '<span class="sc-pill sc-pill--mute">Telegram guruh yo\'q</span>';
        const inner = `<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M21.5 4.3 2.9 11.5c-1.3.5-1.2 1.3-.2 1.6l4.8 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.4-1.5Z"/></svg>${esc(group.name)}`;
        return group.tg_link || group.link ? `<a class="sc-tg" href="${esc(group.tg_link || group.link)}" target="_blank" rel="noopener" title="Telegram guruhni ochish">${inner}</a>`
            : `<span class="sc-tg sc-tg--nolink">${inner}</span>`;
    }

    // ── Umumiy oyna (drawer) ─────────────────────────────────────────────────
    let _drawer = null;
    function openDrawer({ title, sub = '', body = '', foot = '', wide = false, onClose = null }) {
        closeDrawer();
        const wrap = document.createElement('div');
        wrap.className = 'sc-dim';
        wrap.innerHTML = `<aside class="sc-drw${wide ? ' sc-drw--wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="scDrwTitle">
            <header class="sc-dh"><div><h2 id="scDrwTitle">${esc(title)}</h2>${sub ? `<p class="sc-mt">${sub}</p>` : ''}</div>
            <button type="button" class="sc-x" data-close aria-label="Yopish">✕</button></header>
            <div class="sc-db">${body}</div>${foot ? `<footer class="sc-df">${foot}</footer>` : ''}</aside>`;
        document.body.appendChild(wrap);
        wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) closeDrawer(); });
        const onKey = e => { if (e.key === 'Escape') closeDrawer(); };
        document.addEventListener('keydown', onKey);
        _drawer = { el: wrap, onKey, onClose };
        setTimeout(() => wrap.querySelector('input,select,textarea,button:not([data-close])')?.focus(), 30);
        return wrap.querySelector('.sc-drw');
    }
    function closeDrawer() {
        if (!_drawer) return;
        document.removeEventListener('keydown', _drawer.onKey);
        _drawer.el.remove();
        const cb = _drawer.onClose; _drawer = null; cb?.();
    }
    function busy(btn, on) { if (!btn) return; btn.disabled = on; btn.dataset.label ||= btn.textContent; btn.textContent = on ? 'Saqlanmoqda…' : btn.dataset.label; }
    function errBox(root, msg) {
        let el = root.querySelector('.sc-err');
        if (!el) { el = document.createElement('div'); el.className = 'sc-err'; el.setAttribute('role', 'alert'); root.querySelector('.sc-db')?.prepend(el) || root.prepend(el); }
        el.textContent = msg; el.hidden = !msg; if (msg) el.scrollIntoView({ block: 'nearest' });
    }
    const field = (label, inner, hint = '') => `<label class="sc-fd"><span>${label}</span>${inner}${hint ? `<small>${hint}</small>` : ''}</label>`;
    const chips = (name, list, sel) => `<div class="sc-chips" role="radiogroup">${list.map(([v, l]) => `<label class="sc-chip"><input type="radio" name="${name}" value="${esc(v)}"${v === sel ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
    const impact = items => `<ul class="sc-imp">${items.map(([i, t]) => `<li><span class="sc-ic" aria-hidden="true">${i}</span><span>${t}</span></li>`).join('')}</ul>`;

    // ── O'quvchi kartasi: to'liq sahifa (UstozOquvchiKarta, UstozKartaAloqa, YordamchiKarta, YordamchiKartaAloqa, AdminOquvchiKarta) ──
    // Ismni bosganda hamma joyda shu karta ochiladi. Ustoz va yordamchi to'lov, tarif, qarz va
    // sotuv tarixini HECH QACHON ko'rmaydi (server ham bermaydi); ROP va sotuv O'zlashtirishni faqat o'qiydi.
    const MON_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const dShort = d => { if (!d) return '—'; const [, m, dd] = String(d).slice(0, 10).split('-').map(Number); return `${dd}-${MON_SHORT[m - 1]}`; };
    const num = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const shortName = n => { const p = String(n || '').trim().split(/\s+/); return p[0] ? p[0] + (p[1] ? ' ' + p[1][0] + '.' : '') : '—'; };
    const localDay = iso => (iso ? new Date(new Date(iso).getTime() + 5 * 3600000).toISOString().slice(0, 10) : '');
    const whenTxt = iso => { const d = localDay(iso); if (!d) return '—'; const t = today(); return d === t ? 'bugun' : d === addDays(t, -1) ? 'kecha' : dShort(d); };
    const advDaysOf = day => ([1, 3, 5].includes(Number(day)) ? [2, 4, 6] : [1, 3, 5]);
    const CHN = { phone: ['☎', 'Telefon'], zoom: ['Z', 'Zoom'], meet: ['M', 'Google Meet'], tg_video: ['▶', 'Telegram video'], tg_group: ['▶', 'Telegram guruh videodars'], tg_text: ['✉', 'Telegram yozishma'] };
    const CST = { counted: '', short: '5 daqiqadan qisqa', same_day: 'shu kuni 2-chi', extra_text: 'haftadagi 2-yozishma', over_cap: '13 dan ortiq' };
    const LOCK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

    // ── Ilova natijalari (O'zlashtirish) — karta va "O'quvchini tekshirish" uchun umumiy ──
    const acad = {
        cls: v => (v == null ? '' : v < 55 ? 'lo' : v < 75 ? 'mid' : 'hi'),
        pct: v => (v == null ? '—' : Math.round(v) + '%'),
        dur(sec) { const m = Math.round((Number(sec) || 0) / 60); return m >= 60 ? `${Math.floor(m / 60)} s ${m % 60} daq` : `${m} daq`; },
        lessonStats(l) {
            const rs = l.results || [], g = rs.filter(r => Number(r.total) > 0);
            const first = g.length ? Math.round(g.reduce((s, r) => s + (Number(r.firstPercent) || 0), 0) / g.length) : null;
            const attempts = g.length ? Math.max(...g.map(r => Number(r.attempts) || 0)) : 0;
            const mistakes = rs.reduce((s, r) => s + (r.mistakes || []).reduce((n, m) => n + (Number(m.count) || 1), 0), 0);
            const last = rs.map(r => r.updatedAt).filter(Boolean).sort().pop() || null;
            return { first, attempts, mistakes, last };
        },
        recent: (d, n = 3) => (d?.lessons || []).filter(l => l.started || (l.results || []).length).sort((a, b) => b.no - a.no).slice(0, n),
        current(d) { const r = d?.student?.reached || 0; if (!r) return 1; const l = d.lessons?.[r - 1]; return l && l.percent >= 100 && r < 72 ? r + 1 : r; },
        recentFirst(d) {
            const xs = acad.recent(d, 3).map(l => acad.lessonStats(l).first).filter(v => v != null);
            return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : (d?.student?.firstTryAvg ?? null);
        },
        mistakes(d, n = 3) {
            const out = [];
            for (const l of d?.lessons || []) for (const r of l.results || []) for (const m of r.mistakes || []) {
                if (!m?.question) continue;
                out.push({ no: l.no, part: r.title || '', attempts: Number(r.attempts) || 1, q: m.question, your: m.yourAnswer || '', right: m.correctAnswer || '', at: m.lastAt || r.updatedAt || '' });
            }
            return out.sort((a, b) => String(b.at).localeCompare(String(a.at)) || b.no - a.no).slice(0, n);
        },
        // Ko'p xato qilingan mavzu: oxirgi 5 darsdan eng ko'p xatoli dars (va uning qismi).
        topic(d) {
            let best = null;
            for (const l of acad.recent(d, 5)) {
                const n = acad.lessonStats(l).mistakes; if (!n || (best && best.n >= n)) continue;
                const part = (l.results || []).slice().sort((a, b) => (b.mistakes || []).length - (a.mistakes || []).length)[0];
                best = { n, name: l.name && !/^\d+-dars$/.test(l.name) ? l.name : `${l.no}-dars`, part: part?.title || '' };
            }
            return best;
        },
        exams(d) {
            const by = new Map((d?.exams || []).filter(e => e.examId).map(e => [e.examId, e]));
            const reached = d?.student?.reached || 0, rows = [];
            for (let m = 1; m <= 6; m++) {
                const e = by.get(`interval-${m}`), a = m * 12 - 11, b = m * 12;
                const base = { m, title: `${m}-modul imtihoni`, range: `${a}–${b}-darslar` };
                if (e) { rows.push({ ...base, st: e.passed ? 'ok' : 'bad', pill: e.passed ? 'O\'tdi' : 'O\'tmadi', sub: `${whenTxt(e.time)} · ilovada`, right: e.passed ? 'topshirildi' : `${e.bestPercent ?? e.scorePercent ?? 0}%`, done: true, passed: !!e.passed }); continue; }
                rows.push({ ...base, st: 'mute', pill: rows.length ? 'Keyin' : 'Hali yo\'q', sub: reached >= b ? 'ochiq · hali topshirilmagan' : `${b}-darsdan keyin ochiladi`, right: '—' });
                break;
            }
            const f = by.get('final'); if (f) rows.push({ m: 7, title: 'Yakuniy imtihon', range: '1–72-darslar', st: f.passed ? 'ok' : 'bad', pill: f.passed ? 'O\'tdi' : 'O\'tmadi', sub: `${whenTxt(f.time)} · ilovada`, right: f.passed ? 'topshirildi' : `${f.bestPercent ?? 0}%`, done: true, passed: !!f.passed });
            return rows;
        },
        examFact(d) {
            const rows = acad.exams(d), last = rows.filter(r => r.done).pop();
            if (!last) { const nx = rows[0]; return { v: 'Hali yo\'q', cls: '', sub: nx ? `${nx.title} · ${nx.sub}` : '' }; }
            return { v: last.passed ? 'O\'tdi' : 'O\'tmadi', cls: last.passed ? 'hi' : 'lo', sub: `${last.title} · baho qo'yilmaydi` };
        },
        steps(l) {
            const s = l.steps || {}, hw = `Vazifa ${s.homeworkDone || 0}/${s.homeworkTotal || 0}`;
            const hwCls = s.homeworkTotal && s.homeworkDone >= s.homeworkTotal ? 'ok' : s.homeworkDone ? 'w' : '';
            return `<div class="scc-steps">${[[l.type === 'live' ? 'Slaydlar' : 'Video', s.watch], ['So\'zlar', s.vocabList], ['Mashq', s.vocabPractice]].map(([t, on]) => `<span class="${on ? 'ok' : ''}">${t}</span>`).join('')}${s.homeworkTotal ? `<span class="${hwCls}">${hw}</span>` : ''}</div>`;
        },
        lessonsTable(d, { compact = false } = {}) {
            const rows = acad.recent(d, 3);
            if (!rows.length) return '<p class="sc-mt scc-pad">Ilovada hali dars boshlanmagan</p>';
            return `<div class="scc-tw"><table class="scc-kt${compact ? ' is-compact' : ''}"><thead><tr><th scope="col">Dars</th><th scope="col">Bosqichlar</th><th scope="col">1-urinish</th><th scope="col">Urinish</th><th scope="col">Xato</th><th scope="col">Vaqt</th></tr></thead><tbody>
              ${rows.map(l => { const x = acad.lessonStats(l), type = l.type === 'live' ? 'jonli' : 'video';
                return `<tr><td><b>${l.no}-dars</b>${compact ? ` <small>${type}</small>` : `<small>${type} · ${esc(whenTxt(x.last))}${l.type === 'live' && x.last ? ', ustoz bilan' : ''}</small>`}</td><td>${acad.steps(l)}</td>
                  <td><b class="scc-pc ${acad.cls(x.first)}">${acad.pct(x.first)}</b></td><td>${x.attempts || '—'}</td><td>${x.mistakes}</td><td>${esc(acad.dur(l.seconds))}</td></tr>`; }).join('')}
            </tbody></table></div>`;
        },
        mistakesList(d, { compact = false, n = 3 } = {}) {
            const xs = acad.mistakes(d, n);
            if (!xs.length) return `<p class="sc-mt${compact ? '' : ' scc-pad'}">Xato yo'q</p>`;
            if (compact) return `<div class="scc-errs">${xs.map(m => `<div class="scc-er"><span class="sc-pill sc-pill--info">${m.no}-dars${m.part ? ' · ' + esc(m.part) : ''}</span><span class="sc-grow">${esc(m.q)} <span class="sc-mt">O'quvchi: "${esc(m.your)}" · To'g'risi: "${esc(m.right)}"</span></span><b class="scc-bad">${m.attempts} urinish</b></div>`).join('')}</div>`;
            return xs.map(m => `<div class="scc-err"><small>${m.no}-dars${m.part ? ' · ' + esc(m.part) : ''} · ${m.attempts} urinish</small><b>${esc(m.q)}</b><span>O'quvchi: <em class="a">"${esc(m.your)}"</em> · To'g'risi: <em class="r">"${esc(m.right)}"</em></span></div>`).join('');
        },
        examsList(d, { compact = false } = {}) {
            const rows = acad.exams(d);
            const pill = r => `<span class="sc-pill ${r.st === 'ok' ? 'sc-pill--ok' : r.st === 'bad' ? 'sc-pill--bad' : 'sc-pill--mute'}">${esc(r.pill)}</span>`;
            if (compact) return `<div class="scc-errs">${rows.map(r => `<div class="scc-er">${pill(r)}<span class="sc-grow">${esc(r.title)}${r.done ? '' : ' · ' + esc(r.sub)}</span><b class="${r.st === 'ok' ? 'scc-ok' : 'scc-bad'}">${r.done ? esc(r.right === 'topshirildi' ? 'o\'tdi' : r.right) : '—'}</b></div>`).join('')}</div>`;
            return rows.map(r => `<div class="scc-ex">${pill(r)}<span class="sc-grow"><b>${esc(r.title)} · ${esc(r.range)}</b><small>${esc(r.sub)}</small></span><b class="${r.st === 'ok' ? 'scc-ok' : r.st === 'bad' ? 'scc-bad' : ''}">${esc(r.right)}</b></div>`).join('');
        },
        path(d) {
            const cur = acad.current(d);
            const cells = Array.from({ length: 72 }, (_, i) => {
                const no = i + 1, l = d?.lessons?.[i], done = (l && l.percent >= 100) || no < cur;
                const c = [no % 2 === 0 ? 'lv' : '', no % 12 === 0 ? 'ex' : '', no === cur ? 'cur' : done ? 'd' : ''].filter(Boolean).join(' ');
                return `<i class="${c}" title="${no}-dars${no % 12 === 0 ? ' · imtihon' : no % 2 === 0 ? ' · jonli' : ''}${l?.percent ? ' · ' + l.percent + '%' : ''}"></i>`;
            });
            return `<div class="scc-path" role="img" aria-label="Kurs yo'li: ${cur}-dars ochiq">${cells.join('')}</div>`;
        },
        legend: '<div class="scc-pl"><span><i class="d"></i>Tugatgan</span><span><i class="cur"></i>Hozirgi</span><span><i class="lv"></i>Jonli dars (ustoz bilan)</span><span><i class="ex"></i>Imtihon</span><span><i></i>Hali ochilmagan</span></div>',
        bars(d) {
            const t = today(), days = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13));
            const v = days.map(x => Math.round((d?.timeByDay?.[x] || 0) / 60)), max = Math.max(1, ...v);
            return `<div class="scc-bars" role="img" aria-label="14 kunlik faollik">${days.map((x, i) => `<i class="${v[i] ? '' : 'z'}" style="height:${v[i] ? Math.max(4, Math.round(v[i] / max * 100)) : 3}%" title="${dShort(x)} · ${v[i]} daq"></i>`).join('')}</div>
              <div class="scc-bl"><span>${dShort(days[0])}</span><span>bugun</span></div>`;
        },
        facts(d) {
            const s = d.student, ex = acad.examFact(d), f = acad.recentFirst(d);
            const behind = s.expected && s.reached + 6 < s.expected;
            return `<div class="scc-facts">
              <div class="scc-fact"><small>Ilovada erishgan dars</small><b>${s.reached || 0} / 72</b><span>${s.expected ? `reja bo'yicha ${s.expected} · ${behind ? 'orqada' : 'farq me\'yorda'}` : 'ilovadagi oxirgi ochilgan dars'}</span></div>
              <div class="scc-fact"><small>Uy vazifasi · 1-urinish</small><b class="scc-pc ${acad.cls(f)}">${acad.pct(f)}</b><span>oxirgi 3 dars o'rtachasi</span></div>
              <div class="scc-fact"><small>Faol vaqt · 7 kun</small><b>${esc(acad.dur(s.time?.week))}</b><span>7 kunning ${s.activeDays7 || 0} tasida faol</span></div>
              <div class="scc-fact"><small>Imtihonlar</small><b class="scc-pc ${ex.cls}">${esc(ex.v)}</b><span>${esc(ex.sub)}</span></div></div>`;
        },
        insight(d, { peer = null, who = 'other', next = '' } = {}) {
            const s = d.student, keys = new Set((s.flags || []).map(f => f.key)), lab = k => (s.flags || []).find(f => f.key === k)?.label || '';
            const parts = [];
            if (keys.has('struggling')) {
                const f = acad.recentFirst(d), tp = acad.topic(d);
                const peerTxt = peer != null ? ` (${who === 'assistant' ? 'siz yordam beradigan o\'quvchilar' : who === 'teacher' ? 'o\'quvchilaringiz' : 'ustoz o\'quvchilari'} o'rtachasi ${peer}%)` : '';
                parts.push(`<b>Uy vazifasida qiynalyapti.</b> Oxirgi 3 darsda birinchi urinishdagi natija ${acad.pct(f)}${peerTxt}.${tp ? ` Ko'p xato: <b>${esc(tp.name)}</b>${tp.part ? ` (${esc(tp.part)})` : ''}.` : ''} ${who === 'assistant' ? `Keyingi aloqada${next ? ` (${esc(next)})` : ''} shu mavzuni og'zaki mashq qiling.` : 'Keyingi jonli darsda shu mavzuni takrorlash tavsiya etiladi.'}`);
            }
            if (keys.has('idle')) parts.push(`<b>${esc(lab('idle'))}.</b> ${s.lastActive ? `Ilovada oxirgi faollik: ${esc(whenTxt(s.lastActive))}.` : ''} Sababini so'rash tavsiya etiladi.`);
            if (keys.has('behind')) parts.push(`<b>${esc(lab('behind'))}.</b> Ilovada ${s.reached || 0}-dars ochiq.`);
            if (keys.has('frozen')) parts.push('<b>Muzlatilgan.</b> Shu davrda reja hisoblanmaydi.');
            if (!parts.length) return '<div class="scc-flag is-ok"><span aria-hidden="true">✓</span><span>Rejada — e\'tibor talab qiladigan holat yo\'q.</span></div>';
            return `<div class="scc-flag"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 18h.01"/></svg><span>${parts.join(' ')}</span></div>`;
        },
        flagPill(d) {
            const k = new Set((d?.student?.flags || []).map(f => f.key));
            return k.has('struggling') ? ['Qiynalyapti', 'sc-pill--warn'] : k.has('idle') ? ['Faol emas', 'sc-pill--warn'] : k.has('behind') ? ['Rejadan orqada', 'sc-pill--warn'] : null;
        }
    };

    // ── Sahifa ──
    let _page = null;      // { id, card, tab, data: {} }
    let _onSaved = null;   // tahrir/holat oynasi saqlangach
    function saved(c) { const f = _onSaved; _onSaved = null; closeDrawer(); if (f) f(); else openStudent(c.id); }
    function pageEl() {
        let el = document.getElementById('scCardPage');
        if (!el) {
            el = document.createElement('div');
            el.id = 'scCardPage'; el.className = 'sc-root scc-page';
            el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'O\'quvchi kartasi');
            (document.querySelector('.content-main') || document.body).appendChild(el);
        }
        document.body.classList.add('sc-card-open');
        return el;
    }
    function closeStudent() {
        document.getElementById('scCardPage')?.remove();
        document.body.classList.remove('sc-card-open');
        _page = null;
    }
    async function openStudent(studentId, tab = 'umumiy') {
        loadStaffAvatars();
        // Eski chaqiriqlar (o'quvchi paneli, guruhlar): tahrir va holat — alohida oyna.
        if (tab === 'tahrir' || tab === 'holat') return openCardForm(studentId, tab, () => {});
        closeDrawer();
        const el = pageEl();
        el.innerHTML = `<button type="button" class="scc-back" data-back>← O'quvchilar</button><div class="sc-skel"></div>`;
        el.querySelector('[data-back]').onclick = closeStudent;
        el.scrollTop = 0;
        let card;
        try { card = (await api(`/students/${encodeURIComponent(studentId)}/card`)).card; }
        catch (e) { const sk = el.querySelector('.sc-skel'); if (sk) sk.outerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        if (!document.getElementById('scCardPage')) return;
        _page = { id: studentId, card, tab, data: {} };
        renderStudent(el, card, tab);
    }
    async function openCardForm(studentId, tab, done) {
        const box = openDrawer({ title: tab === 'tahrir' ? 'O\'quvchini tahrirlash' : 'Holatni o\'zgartirish', sub: 'Yuklanmoqda…', body: '<div class="sc-skel"></div>', wide: true });
        let card = _page?.id === studentId ? _page.card : null;
        if (!card) { try { card = (await api(`/students/${encodeURIComponent(studentId)}/card`)).card; } catch (e) { errBox(box, e.message); return; } }
        box.querySelector('.sc-dh .sc-mt')?.remove();
        box.querySelector('#scDrwTitle').innerHTML = `${studentAvatar(card, 32)} ${esc(card.name)}`;
        box.querySelector('.sc-dh > div').insertAdjacentHTML('beforeend', `<p class="sc-mt sc-row">${statusPill(card)} ${tgPill(card.group)}</p>`);
        const body = box.querySelector('.sc-db'); body.innerHTML = '';
        _onSaved = done || (() => {});
        (tab === 'tahrir' ? editForm : statusForm)(box, body, card);
    }
    function statusPill(card) {
        const st = card.status;
        if (st === 'frozen') { const f = card.statuses.filter(s => s.status === 'frozen').pop(); return `<span class="sc-pill sc-pill--info">Muzlatilgan${f?.to ? ' · ' + esc(fmtDate(f.to, false)) + ' gacha' : ''}</span>`; }
        if (st === 'left') { const l = card.statuses.filter(s => s.status === 'left').pop(); return `<span class="sc-pill sc-pill--bad">Chiqib ketgan${l ? ' · ' + esc(fmtDate(addDays(l.from, -1), false)) : ''}</span>`; }
        const fr = card.statuses.find(s => s.status === 'frozen' && s.from > today());
        return `<span class="sc-pill sc-pill--ok">Faol</span>${fr ? ` <span class="sc-pill sc-pill--info">Muzlatiladi: ${esc(fmtDate(fr.from, false))}–${esc(fmtDate(fr.to, false))}</span>` : ''}`;
    }
    // Ma'lumot bir marta yuklanadi (karta ochiq turganda tablar o'rtasida qayta so'ralmaydi).
    function load(c, key, fn) {
        if (!_page || _page.id !== c.id) return fn();
        return (_page.data[key] ||= fn().catch(e => { if (_page) delete _page.data[key]; throw e; }));
    }
    const getProg = c => load(c, 'prog', () => api(`/students/${encodeURIComponent(c.id)}/progress`));
    const getAtt = (c, month) => load(c, 'att:' + month, () => api(`/students/${encodeURIComponent(c.id)}/attendance?month=${month}`));
    const getCon = (c, month) => load(c, 'con:' + month, () => api(`/students/${encodeURIComponent(c.id)}/contacts?month=${month}`));
    const getPay = c => load(c, 'pay', () => api(`/students/${encodeURIComponent(c.id)}/payments`));
    const getSales = c => load(c, 'sales', () => api(`/students/${encodeURIComponent(c.id)}/sales`));
    // Taqqoslash uchun o'rtacha 1-urinish (faqat Darslik markaziga kira oladiganlar: admin, ROP, ustoz).
    const _peer = {};
    async function peerAvg(c) {
        if (!['admin', 'boshliq', 'rop', 'teacher'].includes(role())) return null;
        const lang = c.subject === 'russian' ? 'russian' : 'english';
        try {
            const list = (await (_peer[lang] ||= apiFetch(`/api/academic/students?lang=${lang}`).catch(e => { delete _peer[lang]; throw e; }))).students || [];
            const mine = c.scope === 'assistant' ? list.filter(s => s.role === 'assistant') : c.scope === 'teacher' ? list.filter(s => s.role === 'main') : list.filter(s => studentById(s.id)?.teacherId === c.teacherId);
            const xs = mine.map(s => s.firstTryAvg).filter(v => v != null);
            return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
        } catch { return null; }
    }
    function nextAdvice(c, n = 2) {
        const days = advDaysOf(c.schedule?.day), out = [];
        for (let i = 1; i <= 14 && out.length < n; i++) { const d = addDays(today(), i); if (days.includes(wd(d))) out.push(`${DAY[wd(d) - 1]} ${dShort(d)}${c.schedule?.time ? ' ' + c.schedule.time : ''}`); }
        return out;
    }
    function nextLesson(c) {
        const days = T_PATTERN(c.schedule?.day), t = today(), tm = toMin(c.schedule?.time);
        for (let i = 0; i <= 14; i++) { const d = addDays(t, i); if (!days.includes(wd(d))) continue; if (i === 0 && tm != null && tm <= nowMin()) continue; return d; }
        return null;
    }
    const T_PATTERN = day => ([1, 3, 5].includes(Number(day)) ? [1, 3, 5] : [2, 4, 6].includes(Number(day)) ? [2, 4, 6] : [Number(day) || 1]);
    // Kurs oxiri: 36-jonli dars sanasi (haftasiga 3 dars) — kurs boshidan jadval bo'yicha.
    function courseEnd(c) {
        if (!c.startDate || !c.schedule?.day) return null;
        const days = T_PATTERN(c.schedule.day); let d = String(c.startDate).slice(0, 10), n = 0;
        for (let i = 0; i < 200 && n < 36; i++, d = addDays(d, 1)) if (days.includes(wd(d)) && ++n === 36) return d;
        return null;
    }
    const ddmm = d => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : '');

    function renderStudent(el, c, tab) {
        const sc = c.scope, money = sc === 'full' || sc === 'sales';
        const local = studentById(c.id) || {};
        const serial = c.serialCode || local.serialCode || '';
        const canEdit = isManager() || (role() === 'sales_manager' && sc === 'sales');
        const tabs = [['umumiy', 'Umumiy']];
        if (sc !== 'past') tabs.push(['davomat', 'Davomat va aloqalar'], ['oz', 'O\'zlashtirish']);
        if (money) tabs.push(['tolov', 'To\'lovlar'], ['sotuv', 'Sotuv tarixi']);
        if (c.history) tabs.push(['tarix', 'O\'zgarishlar tarixi']);
        const lock = sc === 'teacher' ? 'To\'lov va sotuv ma\'lumotlari ustozga ko\'rsatilmaydi' : sc === 'assistant' ? 'To\'lov va sotuv ma\'lumotlari yordamchi ustozga ko\'rsatilmaydi'
            : sc === 'past' ? 'Faqat siz bilan bo\'lgan davr' : role() === 'rop' || sc === 'sales' ? 'O\'zlashtirish — faqat o\'qish uchun' : '';
        const s = c.schedule || {};
        const end = courseEnd(c);
        const meta = sc === 'assistant'
            ? `asosiy ustoz ${esc(teacherName(c.teacherId))} · darslari ${esc(s.days || '')} ${esc(s.time || '')} · aloqa tavsiyasi ${advDaysOf(s.day).map(x => DAY[x - 1]).join('·')} ${esc(s.time || '')} · <span data-acount>…</span> / 13 aloqa`
            : money ? [serial && '#' + esc(serial), esc(c.phone || '')].filter(Boolean).join(' · ')
            : sc === 'past' ? 'oldingi o\'quvchingiz'
            : [serial && '#' + esc(serial), s.days && `${esc(s.days)} ${esc(s.time || '')} · ${esc(s.duration || '')} daq`, c.startDate && `kurs ${ddmm(String(c.startDate).slice(0, 10))}${end ? ' → ' + ddmm(end) : ''}`, c.assistantId && `yordamchi ${esc(teacherName(c.assistantId))}`].filter(Boolean).join(' · ');
        const acts = [];
        if (sc === 'teacher' && c.status !== 'left') acts.push(['makeup', 'Qoplash darsi qo\'yish', ''], ['req', 'Adminga so\'rov', '']);
        if (sc === 'assistant') acts.push(['write', 'Asosiy ustozga yozish', ''], ['mat', 'Dars materiallari', 'pri']);
        if (canEdit) acts.push(['edit', '✎ Tahrirlash', 'pri']);
        if (isManager()) acts.push(['status', 'Holatni o\'zgartirish', '']);
        if (money && typeof inflowUI !== 'undefined' && typeof inflowUI?.openPayment === 'function') acts.push(['pay', '+ To\'lov qabul qilish', '']);
        el.innerHTML = `<button type="button" class="scc-back" data-back>← ${sc === 'assistant' ? 'O\'quvchilarim' : 'O\'quvchilar'}</button>
          <section class="sc-card scc-head">
            <div class="scc-hrow">${studentAvatar(c, 44)}<div class="scc-hmain">
              <div class="scc-hname"><h1>${esc(c.name)}</h1>${sc === 'assistant' ? '<button type="button" class="scc-call" data-act="call"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>Qo\'ng\'iroq</button>' : ''}</div>
              <div class="scc-pills">${sc === 'past' ? '' : tgPill(c.group)} ${statusPill(c)} <span class="sc-pill sc-pill--info">${c.subject === 'russian' ? 'Rus tili' : 'Ingliz tili'}</span><span data-flag></span><span class="scc-meta">${meta}</span></div>
            </div></div>
            ${acts.length ? `<div class="scc-acts">${acts.map(([k, l, p]) => `<button type="button" class="sc-btn${p ? ' sc-btn--pri' : ''}" data-act="${k}">${esc(l)}</button>`).join('')}</div>` : ''}
            <div class="scc-tabs"><div role="tablist" aria-label="Karta bo'limlari">${tabs.map(([k, l]) => `<button type="button" role="tab" class="scc-tab" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>${lock ? `<span class="scc-lock">${LOCK}${esc(lock)}</span>` : ''}</div>
          </section>
          <div class="scc-body" data-body></div>`;
        el.querySelector('[data-back]').onclick = closeStudent;
        const body = el.querySelector('[data-body]');
        // Sarlavhadagi bayroq / to'lov holati / aloqalar soni — fonda.
        if (sc === 'teacher' || sc === 'assistant') getProg(c).then(r => {
            const fp = r.detail && acad.flagPill(r.detail); const f = el.querySelector('[data-flag]');
            if (fp && f) f.outerHTML = `<span class="sc-pill ${fp[1]}">${fp[0]}</span>`;
            const m = el.querySelector('[data-act="mat"]'); if (m && r.detail) { m.textContent = `${acad.current(r.detail)}-dars materiallari`; m.dataset.no = acad.current(r.detail); }
        }).catch(() => {});
        if (money) getPay(c).then(p => { const f = el.querySelector('[data-flag]'); const pp = payPill(p); if (f && pp) f.outerHTML = pp; }).catch(() => {});
        if (sc === 'assistant') getCon(c, today().slice(0, 7)).then(r => { const x = el.querySelector('[data-acount]'); if (x) x.textContent = r.counted; }).catch(() => {});
        el.querySelectorAll('[data-act]').forEach(b => b.onclick = () => cardAction(b.dataset.act, c, b));
        const show = k => {
            if (_page) _page.tab = k;
            el.querySelectorAll('.scc-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === k)));
            if (k === 'umumiy') summaryTab(body, c);
            else if (k === 'davomat') attendanceTab(body, c);
            else if (k === 'oz') progressTab(body, c);
            else if (k === 'tolov') paymentsTab(body, c);
            else if (k === 'sotuv') salesTab(body, c);
            else if (k === 'tarix') body.innerHTML = `<section class="sc-card sc-pad">${historyList(c)}</section>`;
        };
        el.querySelectorAll('.scc-tab').forEach(b => b.onclick = () => show(b.dataset.tab));
        show(tabs.some(t => t[0] === tab) ? tab : 'umumiy');
    }
    function payPill(p) {
        const MON = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
        if (Number(p.debtAmount) > 0) return `<span class="sc-pill sc-pill--bad">Qarz ${esc(num(p.debtAmount))} so'm</span>`;
        const due = p.paymentDueDate ? String(p.paymentDueDate).slice(0, 10) : '';
        if (due && due >= today()) return `<span class="sc-pill sc-pill--ok">${MON[Number(today().slice(5, 7)) - 1]} to'langan</span>`;
        if (due) return `<span class="sc-pill sc-pill--warn">To'lov muddati o'tdi</span>`;
        return '';
    }
    function cardAction(k, c, btn) {
        const reopen = () => openStudent(c.id, _page?.tab || 'umumiy');
        if (k === 'edit') return openCardForm(c.id, 'tahrir', reopen);
        if (k === 'status') return openCardForm(c.id, 'holat', reopen);
        if (k === 'pay') return inflowUI.openPayment(c.id);
        if (k === 'req') return studentRequestDrawer(c);
        if (k === 'makeup') {
            if (window.schoolSchedule?.makeupDrawer) return window.schoolSchedule.makeupDrawer(() => { if (_page) delete _page.data['att:' + today().slice(0, 7)]; reopen(); }, { studentId: c.id });
            return typeof switchTab === 'function' && switchTab('teachers-section');
        }
        if (k === 'call') {
            const link = c.group?.tg_link || c.group?.link;
            if (link) window.open(link, '_blank', 'noopener');
            const s = studentById(c.id) || { id: c.id, name: c.name };
            if (window.schoolTeacher?.markDrawer) window.schoolTeacher.markDrawer(s, () => { if (_page) Object.keys(_page.data).filter(x => x.startsWith('con:')).forEach(x => delete _page.data[x]); reopen(); });
            return;
        }
        if (k === 'write') {
            // Xodimlar chati CRM'da faqat rahbarlar uchun — asosiy ustozga Telegram orqali (HR'dagi raqam).
            const t = staffList().find(x => x.id === c.teacherId);
            const digits = String(t?.phone || '').replace(/\D/g, '');
            if (digits.length >= 9) return window.open(`https://t.me/+${digits.length === 9 ? '998' + digits : digits}`, '_blank', 'noopener');
            return toast('Asosiy ustozning telefon raqami HR bo\'limida kiritilmagan', 3500);
        }
        if (k === 'mat') {
            const no = Number(btn?.dataset.no) || 1, lang = c.subject === 'russian' ? 'russian' : 'english';
            const S = window.LessonHub?._state; if (S) { S.selected = S.selected || {}; S.selected[lang] = no; S.view = 'lessons'; }
            closeStudent();
            if (typeof switchTab === 'function') switchTab('teachers-section', { teachersSection: 'textbook' });
        }
    }
    function studentRequestDrawer(c) {
        const box = openDrawer({ title: 'Adminga so\'rov', sub: `${esc(c.name)} · admin ko'rib chiqadi va javob beradi`, body: `
            <div class="sc-sec"><h3>Mavzu</h3>${chips('topic', [['freeze', 'Muzlatish'], ['teacher', 'Ustozni almashtirish'], ['schedule', 'Jadvalni o\'zgartirish'], ['other', 'Boshqa']], 'freeze')}</div>
            <div class="sc-sec">${field('Izoh', '<textarea name="reason" rows="3" placeholder="Masalan: o\'quvchi 2 haftaga safarga ketmoqda, ota-onasi so\'radi"></textarea>', 'Kamida 3 belgi · admin "Ustozlar so\'rovlari"da ko\'radi')}</div>
            <div class="sc-note">To'lov va tarif masalalari ustozga ko'rsatilmaydi — ularni admin hal qiladi.</div>`,
            foot: '<button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Yuborish</button>' });
        box.querySelector('[data-save]').onclick = async e => {
            const reason = box.querySelector('[name=reason]').value.trim();
            if (reason.length < 3) return errBox(box, 'Izohni yozing');
            busy(e.target, true);
            try { await post('/requests', { type: 'student', studentId: c.id, topic: box.querySelector('[name=topic]:checked')?.value || 'other', reason }); toast('So\'rov adminga yuborildi'); closeDrawer(); }
            catch (err) { busy(e.target, false); errBox(box, err.message); }
        };
    }

    // ── Umumiy ──
    async function summaryTab(body, c) {
        const sc = c.scope, money = sc === 'full' || sc === 'sales', s = c.schedule || {};
        const month = today().slice(0, 7), mName = MONTHS[Number(month.slice(5)) - 1];
        const frozenUsed = (c.statuses || []).filter(x => x.status === 'frozen').length;
        const frozenNext = (c.statuses || []).find(x => x.status === 'frozen' && x.from > today());
        const end = courseEnd(c);
        const teachers = (c.teachers || []).filter(t => t.from > '2001-01-01');
        body.innerHTML = `<div class="scc-g3${money ? '' : ' is-two'}">
            <section class="sc-card"><header class="sc-ch"><h2>O'qish</h2><span class="sc-pill sc-pill--info">${c.subject === 'russian' ? 'Rus' : 'Ingliz'}${s.duration ? ' · ' + esc(s.duration) + ' daq' : ''}</span></header>
              <dl class="scc-dl"><dt>Asosiy ustoz</dt><dd>${esc(teacherName(c.teacherId))}</dd><dt>Yordamchi ustoz</dt><dd>${c.assistantId ? esc(teacherName(c.assistantId)) : '—'}</dd>
                ${s.days ? `<dt>Jadval</dt><dd>${esc(s.days)} ${esc(s.time || '')}</dd>` : ''}
                <dt>Kurs</dt><dd>${c.startDate ? `${ddmm(String(c.startDate).slice(0, 10))}${end ? ' → ' + ddmm(end) : ''} · ` : ''}<span data-reached>…</span> / 72 dars</dd>
                ${sc === 'past' ? '' : `<dt>Muzlatish</dt><dd>${c.status === 'frozen' ? 'hozir muzlatilgan' : frozenNext ? `rejada · ${esc(dShort(frozenNext.from))} – ${esc(dShort(frozenNext.to))}` : frozenUsed ? 'ishlatilgan · qolmadi' : 'yo\'q · 1 marta qoldi'}</dd>`}
                ${c.pendingTeacherChange ? `<dt>Ustoz almashadi</dt><dd>${esc(teacherName(c.pendingTeacherChange.teacherId))} · ${esc(fmtDate(c.pendingTeacherChange.from))}</dd>` : ''}
                ${teachers.length > 1 ? `<dt>Ustozlar tarixi</dt><dd>${teachers.map(t => `${esc(shortName(teacherName(t.teacherId)))} ${esc(dShort(t.from))}`).join(' → ')}</dd>` : ''}</dl></section>
            ${sc === 'past' ? '' : `<section class="sc-card" data-attcard><header class="sc-ch"><h2>Davomat · ${esc(mName)}</h2><button type="button" class="scc-lnk" data-go="davomat">Batafsil →</button></header><div class="sc-skel scc-skel"></div></section>`}
            ${money ? `<section class="sc-card" data-paycard><header class="sc-ch"><h2>To'lov</h2><span data-pp></span></header><div class="sc-skel scc-skel"></div></section>` : ''}
          </div>
          ${sc === 'past' ? '' : `<div class="scc-g2k${money ? '' : ' is-one'}">
            <section class="sc-card" data-ozcard><header class="sc-ch"><h2>O'zlashtirish · qisqacha</h2><button type="button" class="scc-lnk" data-go="oz">To'liq ko'rish →</button></header><div class="sc-skel scc-skel"></div></section>
            ${money ? '<section class="sc-card" data-salecard><header class="sc-ch"><h2>Sotuv tarixi</h2></header><div class="sc-skel scc-skel"></div></section>' : ''}
          </div>`}
          ${(c.requests || []).filter(r => r.status === 'pending').map(r => `<div class="sc-note sc-note--warn">So'rov №${esc(r.number)} (${esc(REQ_KIND[r.kind])}) — admin yoki ROP tasdig'ini kutmoqda</div>`).join('')}`;
        body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => document.querySelector(`#scCardPage .scc-tab[data-tab="${b.dataset.go}"]`)?.click());
        const fill = (sel, html) => { const x = body.querySelector(sel); if (x) x.innerHTML = html; };
        const swap = (card, html) => { const x = body.querySelector(card); x?.querySelector('.scc-skel')?.insertAdjacentHTML('afterend', html); x?.querySelector('.scc-skel')?.remove(); };
        if (sc === 'past') { getProg(c).then(r => fill('[data-reached]', String(r.progress?.reached ?? '—'))).catch(() => fill('[data-reached]', '—')); return; }
        // Davomat
        Promise.all([getAtt(c, month), c.assistantId ? getCon(c, month).catch(() => null) : null]).then(([a, con]) => {
            const x = attStats(a, c), ws = weekStart(today());
            const last = Object.entries(a.entries).sort((p, q) => Number(q[0]) - Number(p[0]))[0];
            const lastDate = last ? `${month}-${String(last[0]).padStart(2, '0')}` : '';
            swap('[data-attcard]', `<dl class="scc-dl">
              <dt>Hisobga o'tdi</dt><dd>${x.counted} / ${x.plan} · ${x.present} keldi${x.approved ? ` + ${x.approved} qoplash` : ''}${x.review ? ` · +${x.review} tekshiruvda` : ''}</dd>
              <dt>Kelmadi</dt><dd>${x.absent}${x.coveredAbsent || x.review ? ` · ${[x.coveredAbsent && `${x.coveredAbsent} tasi qoplandi`, x.review && `${x.review} tekshiruvda`].filter(Boolean).join(', ')}` : ''}</dd>
              <dt>Qoplanmagan</dt><dd class="${x.open.length ? 'scc-teal' : ''}">${x.open.length ? x.open.map(d => Number(d.slice(8))).join(', ').replace(/, (\d+)$/, ' va $1') + '-' + MON_SHORT[Number(month.slice(5)) - 1] : '—'}</dd>
              <dt>Tekshiruvda</dt><dd>${x.review ? `${x.review} qoplash · ${x.reviewDays.map(dShort).join(', ')}` : '—'}</dd>
              ${c.assistantId ? `<dt>Yordamchi aloqalari</dt><dd>${con ? `${con.counted} / ${con.cap} · bu hafta ${con.items.filter(i => i.day >= ws && i.status === 'counted').length} / 3` : '—'}</dd>` : ''}
              <dt>Oxirgi dars</dt><dd>${lastDate ? `${lastDate === today() ? 'bugun' : dShort(lastDate)}${s.time ? ' ' + esc(s.time) : ''} · ${last[1].present ? 'keldi' : 'kelmadi'}` : '—'}</dd></dl>`);
        }).catch(e => swap('[data-attcard]', `<p class="sc-mt scc-pad">${esc(e.message)}</p>`));
        // O'zlashtirish qisqacha
        getProg(c).then(r => {
            fill('[data-reached]', String(r.progress?.reached ?? 0));
            if (!r.detail) return swap('[data-ozcard]', '<p class="sc-mt scc-pad">Ilova ma\'lumoti hali yo\'q</p>');
            const d = r.detail, f = acad.recentFirst(d), ex = acad.examFact(d);
            swap('[data-ozcard]', `<div class="scc-mini"><div><small>Ilovada</small><b>${d.student.reached || 0} / 72</b></div><div><small>1-urinish</small><b class="scc-pc ${acad.cls(f)}">${acad.pct(f)}</b></div>
              <div><small>Faol · 7 kun</small><b>${esc(acad.dur(d.student.time?.week).replace(' daq', ' d'))}</b></div><div><small>Imtihon</small><b class="scc-pc ${ex.cls}">${esc(ex.v)}</b></div></div>
              <div class="scc-pathw">${acad.path(d)}</div>`);
        }).catch(e => swap('[data-ozcard]', `<p class="sc-mt scc-pad">${esc(e.message)}</p>`));
        if (!money) return;
        // To'lov
        getPay(c).then(p => {
            const M = { card: 'Karta', uzum: 'Uzum', paylater: 'Bo\'lib to\'lash', bank: 'Bank', payme: 'Payme', click: 'Click', cash: 'Naqd', unknown: '' };
            const live = p.payments.filter(x => !x.voided), lp = live[0];
            const due = p.paymentDueDate ? String(p.paymentDueDate).slice(0, 10) : '';
            const left = due ? Math.round((Date.parse(due) - Date.parse(today())) / 864e5) : null;
            fill('[data-paycard] [data-pp]', payPill(p));
            swap('[data-paycard]', `<dl class="scc-dl"><dt>Tarif</dt><dd>${esc(p.tariff || '—')}${p.monthlyPrice ? ' · ' + esc(num(p.monthlyPrice)) + ' so\'m/oy' : ''}</dd>
              <dt>Oxirgi to'lov</dt><dd>${lp ? `${esc(dShort(lp.date))} · ${esc(num(lp.amount))}${M[lp.method] ? ' · ' + esc(M[lp.method]) : ''}` : '—'}</dd>
              <dt>Keyingi to'lov</dt><dd>${due ? `${esc(dShort(due))} · ${left >= 0 ? left + ' kun qoldi' : -left + ' kun o\'tdi'}` : '—'}</dd>
              <dt>Qarz</dt><dd class="${Number(p.debtAmount) > 0 ? 'scc-bad' : ''}">${p.debtAmount != null ? esc(num(p.debtAmount)) + ' so\'m' : '—'}</dd>
              <dt>To'lovlar</dt><dd>${live.length} ta · jami ${esc(num(live.reduce((n, x) => n + x.amount, 0)))} so'm</dd></dl>`);
        }).catch(e => swap('[data-paycard]', `<p class="sc-mt scc-pad">${esc(e.message)}</p>`));
        // Sotuv tarixi
        getSales(c).then(r => {
            const L = r.lead;
            if (!L) return swap('[data-salecard]', '<p class="sc-mt scc-pad">Lidga bog\'lanmagan (eski yoki qo\'lda qo\'shilgan yozuv)</p>');
            const ev = [[L.createdAt, `${esc(L.source || 'Lid')} lid${L.manager ? ' · menejer ' + esc(String(L.manager).split(' ')[0]) : ''}`],
                [L.trialLessonAt, `sinov darsi · ${esc(shortName(teacherName(c.teacherId)))}`], [L.closedDate, `to'lov yopildi${L.saleManager ? ' · ' + esc(String(L.saleManager).split(' ')[0]) : ''}`],
                [c.startDate, 'o\'quvchiga aylandi · ilova login berildi']].filter(x => x[0]);
            swap('[data-salecard]', `<ul class="scc-tl">${ev.map(([d, t]) => `<li><b>${esc(dShort(String(d).slice(0, 10)))}</b> · ${t}</li>`).join('')}</ul>`);
        }).catch(e => swap('[data-salecard]', `<p class="sc-mt scc-pad">${esc(e.message)}</p>`));
    }
    const REQ_KIND = { tariff: 'tarif', teacher: 'ustoz', payment: 'to\'lov' };

    // Oy bo'yicha davomat hisobi: hisobga o'tgan = keldi + tasdiqlangan qoplash (rejadan oshmaydi).
    function attStats(a, c) {
        const month = a.month, td = today();
        const vals = Object.entries(a.entries).map(([d, e]) => ({ date: `${month}-${String(d).padStart(2, '0')}`, ...e }));
        const mks = (a.makeups || []).filter(m => m.status !== 'rejected' && m.status !== 'cancelled');
        const inMonth = m => String(m.held || '').slice(0, 7) === month;
        const approved = mks.filter(m => m.status === 'approved' && inMonth(m)).length, review = mks.filter(m => m.status === 'review' && inMonth(m));
        const present = vals.filter(v => v.present).length, absentDays = vals.filter(v => !v.present).map(v => v.date).sort();
        const covered = new Set(mks.map(m => m.missed)), done = new Set(mks.filter(m => m.status === 'approved').map(m => m.missed));
        return { plan: a.lessonDays.length, passed: a.lessonDays.filter(d => d <= td).length, present, absent: absentDays.length, approved, review: review.length,
            reviewDays: review.map(m => m.held).sort(), counted: Math.min(present + approved, a.lessonDays.length),
            coveredAbsent: absentDays.filter(d => done.has(d)).length, open: absentDays.filter(d => !covered.has(d)) };
    }

    // ── Davomat va aloqalar: kunma-kun ro'yxat + KPI (asosiy ustoz) va yordamchi aloqalari ──
    async function attendanceTab(body, c, month = today().slice(0, 7)) {
        const sc = c.scope;
        const scope = { teacher: `o'z o'quvchingiz · o'z darslaringiz${c.assistantId ? ` va yordamchi ${esc(shortName(teacherName(c.assistantId)))} aloqalari · ikkalasi alohida, aralashmaydi` : ''}`,
            assistant: 'sizga biriktirilgan o\'quvchi · asosiy ustoz darslari (faqat o\'qish) va o\'z aloqalaringiz',
            sales: 'o\'zingiz sotgan o\'quvchi · asosiy ustoz darslari va yordamchi aloqalari · faqat o\'qish',
            full: 'asosiy ustoz darslari va yordamchi aloqalari alohida · tuzatish — Davomat va Yordamchi aloqalari bo\'limlarida' }[sc] || '';
        const [y, m] = month.split('-').map(Number), mName = MONTHS[m - 1];
        const prev = addDays(month + '-01', -1).slice(0, 7), next = addDays(month + '-28', 7).slice(0, 7);
        body.innerHTML = `<div class="scc-scope"><span><b>Siz ko'ryapsiz:</b> ${scope}</span><span class="scc-mon"><button type="button" data-m="${prev}" aria-label="Oldingi oy">‹</button><span>${esc(mName)} ${y}</span><button type="button" data-m="${next}" aria-label="Keyingi oy"${month >= today().slice(0, 7) ? ' disabled' : ''}>›</button></span></div>
          <div class="scc-g2"><section class="sc-card" data-main><div class="sc-skel scc-skel"></div></section>
          <section class="sc-card" data-asst>${c.assistantId ? '<div class="sc-skel scc-skel"></div>' : `<header class="sc-ch"><h2>Yordamchi aloqalari</h2></header><p class="sc-mt scc-pad">Yordamchi ustoz biriktirilmagan</p>`}</section></div>`;
        body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => attendanceTab(body, c, b.dataset.m));
        const mainEl = body.querySelector('[data-main]'), asEl = body.querySelector('[data-asst]');
        getAtt(c, month).then(a => {
            const x = attStats(a, c), td = today();
            const mk = (a.makeups || []).filter(q => q.status !== 'rejected' && q.status !== 'cancelled');
            const days = new Set(a.lessonDays);
            for (const q of mk) if (q.kind !== 'double' && String(q.held || '').slice(0, 7) === month) days.add(q.held);
            Object.keys(a.entries).forEach(d => days.add(`${month}-${String(d).padStart(2, '0')}`));
            let n = Number(a.presentBefore) || 0;
            const MK = { approved: ['tasdiqlandi', 'sc-pill--teal'], review: ['tekshiruvda', 'sc-pill--warn'], planned: ['rejada', 'sc-pill--info'] };
            const rows = [...days].sort().map(d => {
                const e = a.entries[Number(d.slice(8))], sep = mk.find(q => q.held === d && q.kind !== 'double'), dbl = mk.find(q => q.held === d && q.kind === 'double');
                let pill, txt = '';
                if (sep) { const st = MK[sep.status] || MK.planned; if (sep.status !== 'planned') n++; pill = `<span class="sc-pill ${st[1]}">Qoplash</span>`; txt = `${sep.status !== 'planned' ? n * 2 + '-dars · ' : ''}${esc(dShort(sep.missed))} o'rniga · ${st[0]}`; }
                else if (e?.present) { n++; const a1 = n * 2; if (dbl && dbl.status !== 'planned') n++; pill = '<span class="sc-pill sc-pill--ok">Keldi</span>'; txt = dbl ? `${a1}- va ${a1 + 2}-dars · qo'shaloq (${esc(dShort(dbl.missed))} o'rniga · ${(MK[dbl.status] || MK.planned)[0]})` : `${a1}-dars`; }
                else if (e) pill = '<span class="sc-pill sc-pill--bad">Kelmadi</span>';
                else if (d < td) pill = '<span class="sc-pill sc-pill--warn">Belgilanmagan</span>';
                else { pill = `<span class="sc-pill sc-pill--mute">${d === td ? 'Bugun' : 'Rejada'}</span>`; txt = `${(n + 1) * 2}-dars · jonli`; n++; }
                return `<li><span class="scc-date"><b>${esc(dShort(d))}</b><small>${DAY[wd(d) - 1]}</small></span>${pill}<span class="scc-rt">${txt}</span></li>`;
            });
            mainEl.innerHTML = `<header class="sc-ch"><h2>Asosiy ustoz darslari · ${esc(shortName(teacherName(c.teacherId)))}</h2><span class="sc-pill sc-pill--info">${esc(mName)} · rejada ${x.plan}</span></header>
              <div class="scc-k4"><div><small>Keldi</small><b>${x.present}</b></div><div><small>Kelmadi</small><b class="${x.absent ? 'scc-bad' : ''}">${x.absent}</b></div>
                <div><small>Qoplandi</small><b>${x.approved}${x.review ? ` <em>+${x.review} tekshiruvda</em>` : ''}</b></div><div><small>Hisobga o'tgan</small><b>${x.counted} / ${x.plan}</b></div></div>
              <ul class="scc-days">${rows.join('') || '<li class="sc-mt">Bu oyda dars yo\'q</li>'}</ul>`;
        }).catch(e => { mainEl.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; });
        if (!c.assistantId) return;
        getCon(c, month).then(r => {
            const ws = weekStart(today()), items = r.items.slice().reverse();
            const mins = r.items.filter(i => i.outcome !== 'no_answer' && Number(i.minutes) > 0).map(i => Number(i.minutes));
            const avg = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length * 10) / 10 : null;
            const adv = month === today().slice(0, 7) ? nextAdvice(c) : [];
            asEl.innerHTML = `<header class="sc-ch"><h2>Yordamchi aloqalari · ${esc(shortName(teacherName(c.assistantId)))}</h2><span class="sc-pill sc-pill--info">${esc(mName)} · ${r.cap} tagacha</span></header>
              <div class="scc-k4"><div><small>Hisoblangan</small><b>${r.counted} / ${r.cap}</b></div><div><small>Bu hafta</small><b>${r.items.filter(i => i.day >= ws && i.status === 'counted').length} / 3</b></div>
                <div><small>Javob bermadi</small><b class="${r.noAnswer ? 'scc-bad' : ''}">${r.noAnswer}</b></div><div><small>O'rtacha</small><b>${avg != null ? avg + ' daq' : '—'}</b></div></div>
              <ul class="scc-days">${items.map(i => { const ch = CHN[i.channel] || ['•', i.channel];
                const pill = i.outcome === 'no_answer' ? '<span class="sc-pill sc-pill--bad">✕ Javob bermadi</span>' : `<span class="sc-pill ${i.status === 'counted' ? 'sc-pill--ok' : 'sc-pill--mute'}">${ch[0]} ${esc(ch[1])}${i.minutes ? ' · ' + i.minutes + ' daq' : ''}</span>`;
                const txt = i.outcome === 'no_answer' ? 'hisoblanmaydi' : [i.note && esc(i.note), CST[i.status] && esc(CST[i.status]) + ' · hisoblanmadi'].filter(Boolean).join(' · ');
                return `<li><span class="scc-date"><b>${esc(dShort(i.day))}</b><small>${DAY[wd(i.day) - 1]}</small></span>${pill}<span class="scc-rt">${txt}</span></li>`; }).join('') || '<li class="sc-mt">Bu oyda aloqa yo\'q</li>'}</ul>
              ${adv.length ? `<p class="scc-foot">Keyingi tavsiya: ${adv.map(esc).join(' · ')}</p>` : ''}`;
        }).catch(e => { asEl.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; });
    }

    // ── O'zlashtirish: ilovadagi natija (faqat o'qish) ──
    async function progressTab(body, c) {
        body.innerHTML = '<div class="sc-skel"></div>';
        let r; try { r = await getProg(c); } catch (e) { body.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        if (!r.detail) { body.innerHTML = '<section class="sc-card sc-pad"><p class="sc-mt">Ilova ma\'lumoti hali yo\'q — o\'quvchi ilovaga kirgach shu yerda chiqadi</p></section>'; return; }
        const d = r.detail, cur = acad.current(d), nl = nextLesson(c);
        const nextLive = cur % 2 === 0 ? cur : cur + 1;
        const who = c.scope === 'assistant' ? 'assistant' : c.scope === 'teacher' ? 'teacher' : 'other';
        const adv = nextAdvice(c, 1)[0];
        body.innerHTML = `<div data-ins>${acad.insight(d, { who, next: adv })}</div>
          ${acad.facts(d)}
          <section class="sc-card"><header class="sc-ch"><h2>Kurs yo'li · 72 dars</h2><span class="sc-mt">${cur}-dars ochiq${nl && nextLive <= 72 ? ` · keyingi jonli dars ${nextLive}-dars, ${DAY[wd(nl) - 1]} ${esc(dShort(nl))}` : ''}</span></header>${acad.path(d)}${acad.legend}</section>
          <div class="scc-g2k"><section class="sc-card"><header class="sc-ch"><h2>Darslar bo'yicha</h2><span class="sc-mt">o'quvchi ilovasidan</span></header>${acad.lessonsTable(d)}
              <header class="sc-ch scc-ch2"><h2>Oxirgi xatolar</h2><span class="sc-mt">to'g'ri javob o'quvchiga keyin ko'rsatilgan</span></header>${acad.mistakesList(d)}</section>
            <div class="scc-col"><section class="sc-card"><header class="sc-ch"><h2>Ilovadagi faollik · 14 kun</h2><span class="sc-mt">daqiqa/kun</span></header>${acad.bars(d)}</section>
              <section class="sc-card"><header class="sc-ch"><h2>Imtihonlar</h2></header>${acad.examsList(d)}</section></div></div>
          ${role() === 'rop' || c.scope === 'sales' ? '<p class="sc-mt">Faqat o\'qish uchun · ma\'lumot o\'quvchi ilovasidan.</p>' : ''}`;
        // Taqqoslash (o'rtacha) keyin qo'shiladi.
        if ((d.student.flags || []).some(f => f.key === 'struggling')) peerAvg(c).then(p => { const x = body.querySelector('[data-ins]'); if (x && p != null) x.innerHTML = acad.insight(d, { who, next: adv, peer: p }); });
    }

    // ── To'lovlar (admin, ROP, sotuv) ──
    async function paymentsTab(body, c) {
        body.innerHTML = '<div class="sc-skel"></div>';
        let r; try { r = await api(`/students/${encodeURIComponent(c.id)}/payments`); } catch (e) { body.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        const M = { card: 'Karta', uzum: 'Uzum', paylater: 'Bo\'lib to\'lash', bank: 'Bank', payme: 'Payme', click: 'Click', cash: 'Naqd', unknown: '—' };
        const live = r.payments.filter(x => !x.voided), total = live.reduce((n, x) => n + x.amount, 0);
        body.innerHTML = `<div class="sc-kpis"><div class="sc-kpi"><small>Tarif</small><b class="sc-small">${esc(r.tariff || '—')}</b><span>${r.monthlyPrice ? esc(formatMoney(r.monthlyPrice)) + '/oy' : ''}</span></div>
            <div class="sc-kpi"><small>Jami to'langan</small><b>${esc(formatMoney(total))}</b><span>${live.length} to'lov</span></div>
            <div class="sc-kpi${Number(r.debtAmount) > 0 ? ' sc-kpi--bad' : ''}"><small>Qarz</small><b>${r.debtAmount != null ? esc(formatMoney(r.debtAmount)) : '—'}</b></div>
            <div class="sc-kpi"><small>Keyingi to'lov</small><b class="sc-small">${r.paymentDueDate ? esc(fmtDate(String(r.paymentDueDate).slice(0, 10), false)) : '—'}</b></div></div>
          <section class="sc-card sc-mtop"><table class="sc-table"><thead><tr><th>Sana</th><th class="r">Summa</th><th>Usul</th><th>Menejer</th><th></th></tr></thead><tbody>
            ${r.payments.map(x => `<tr${x.voided ? ' class="sc-mt"' : ''}><td>${esc(fmtDate(x.date, false))}</td><td class="r">${x.voided ? '<s>' : '<b>'}${esc(formatMoney(x.amount))}${x.voided ? '</s>' : '</b>'}</td><td>${esc(M[x.method] || x.method)}${x.form === 'partial' ? ' · qisman' : ''}</td><td>${esc(x.manager || '—')}</td><td>${x.voided ? '<span class="sc-pill sc-pill--mute">bekor qilingan</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="sc-mt">To\'lov yozuvi topilmadi</td></tr>'}
          </tbody></table></section><p class="sc-mt">To'lovni o'zgartirish — Moliya bo'limida (tasdiq va dalil bilan).</p>`;
    }
    // ── Sotuv tarixi (admin, ROP, sotuv) ──
    async function salesTab(body, c) {
        body.innerHTML = '<div class="sc-skel"></div>';
        let r; try { r = await api(`/students/${encodeURIComponent(c.id)}/sales`); } catch (e) { body.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        const L = r.lead;
        if (!L) { body.innerHTML = '<p class="sc-mt">Bu o\'quvchi lidga bog\'lanmagan (eski yoki qo\'lda qo\'shilgan yozuv)</p>'; return; }
        const d = v => v ? esc(fmtDate(String(v).slice(0, 10), false)) : '—';
        body.innerHTML = `<dl class="sc-kv"><dt>Manba</dt><dd>${esc(L.source || '—')}</dd><dt>Menejer</dt><dd>${esc(L.saleManager || L.manager || '—')}</dd>
            <dt>Lid kelgan</dt><dd>${d(L.createdAt)}</dd><dt>Sinov darsi</dt><dd>${d(L.trialLessonAt)}</dd><dt>To'lov yopildi</dt><dd>${d(L.closedDate)}</dd></dl>
          <section class="sc-card sc-pad sc-mtop"><h3>Lid izohlari va bosqichlar</h3><ul class="sc-hist">${L.comments.map(x => `<li><b>${d(x.at)}</b> · ${esc(x.author || '')}<br><span class="sc-pre">${esc(x.text)}</span></li>`).join('') || '<li class="sc-mt">Izoh yo\'q</li>'}</ul></section>`;
    }

    function editForm(box, body, c) {
        const sales = role() === 'sales_manager';
        const dur = c.schedule?.duration || 30;
        body.innerHTML = `
          ${sales ? '<div class="sc-note">Ism, telefon, login va parol darhol saqlanadi. Tarif, jadval va ustoz o\'zgarishi admin yoki ROP tasdig\'iga boradi.</div>' : ''}
          <div class="sc-sec"><h3>Shaxsiy va ilova</h3><div class="sc-g2">
            ${field('Ism familiya', `<input name="name" value="${esc(c.name)}" maxlength="80" required>`)}
            ${field('Telefon', `<input name="phone" value="${esc(c.phone || '')}" inputmode="tel">`)}
            ${field('Ota-ona telefoni', `<input name="parentPhone" value="${esc(c.parentPhone || '')}" inputmode="tel">`)}
            ${field('Ilova logini', `<input name="login" value="${esc(c.login || '')}" autocomplete="off">`)}
            ${field('Yangi vaqtinchalik parol', `<input name="newPassword" type="text" autocomplete="new-password" placeholder="o'zgartirilmaydi">`, 'Birinchi kirishda o\'quvchi almashtiradi')}
          </div></div>
          <div class="sc-sec"><h3>O'qish${sales ? ' · tasdiq bilan' : ''}</h3><div class="sc-g2">
            ${field('Tarif', `<input name="tariff" value="${esc(c.tariff || '')}" maxlength="40">`)}
            ${field('Oylik narx, so\'m', `<input name="monthlyPrice" value="${esc(c.monthlyPrice ?? '')}" inputmode="numeric">`)}
            ${field('Dars kunlari', `<select name="lessonDay"><option value="1"${[1, 3, 5].includes(Number(c.schedule?.day)) ? ' selected' : ''}>Du·Ch·Ju</option><option value="2"${[2, 4, 6].includes(Number(c.schedule?.day)) ? ' selected' : ''}>Se·Pa·Sh</option></select>`)}
            ${field('Dars vaqti', `<input name="lessonTime" value="${esc(c.schedule?.time || '')}" placeholder="16:30" pattern="\\d{1,2}:\\d{2}">`)}
            ${field('Davomiylik', `<select name="lessonDuration">${[15, 30, 45, 60, 90].map(d => `<option value="${d}"${d === dur ? ' selected' : ''}>${d} daq</option>`).join('')}</select>`)}
            ${field('Qachondan', `<input name="effectiveFrom" type="date" value="${today()}">`, 'Server bo\'sh vaqtni qayta tekshiradi')}
          </div></div>
          <div class="sc-sec"><h3>Telegram guruh</h3>${isManager() ? `<div class="sc-g2">
            ${field('Guruh nomi', `<input name="groupName" value="${esc(c.group?.name || '')}" placeholder="C40 | onlayn ${c.subject === 'russian' ? 'rus' : 'ingliz'} tili">`)}
            ${field('Havola', `<input name="groupLink" value="${esc(c.group?.tg_link || '')}" placeholder="https://t.me/+…">`)}</div>` : `<p class="sc-mt">${tgPill(c.group)} · nom va havolani admin yoki ROP o'zgartiradi</p>`}</div>
          <div class="sc-sec">${field('Sabab (majburiy)', '<textarea name="reason" rows="2" required placeholder="Masalan: telefon raqamida 2 raqam almashgan"></textarea>', 'O\'zgarishlar tarixiga yoziladi')}</div>`;
        body.dataset.schedTouched = '0';
        // Jadval faqat foydalanuvchi shu maydonlarga tegsa o'zgargan hisoblanadi (eski qiymat select'da bo'lmasa ham).
        body.querySelectorAll('[name=lessonDay],[name=lessonTime],[name=lessonDuration]').forEach(i => i.addEventListener('change', () => { body.dataset.schedTouched = '1'; }));
        const durSel = body.querySelector('[name=lessonDuration]');
        if (durSel && ![...durSel.options].some(o => Number(o.value) === Number(dur))) durSel.insertAdjacentHTML('afterbegin', `<option value="${dur}" selected>${dur} daq</option>`);
        box.insertAdjacentHTML('beforeend', `<footer class="sc-df"><span class="sc-mt">O'zgarish ilova, ustoz, sotuv va moliyada birdek yangilanadi</span><div class="sc-row"><button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Saqlash</button></div></footer>`);
        box.querySelector('[data-save]').onclick = async e => {
            const v = n => body.querySelector(`[name="${n}"]`)?.value?.trim() ?? '';
            const changes = {};
            if (v('name') !== c.name) changes.name = v('name');
            if (v('phone') && v('phone') !== (c.phone || '')) changes.phone = v('phone');
            if (v('parentPhone') !== (c.parentPhone || '')) changes.parentPhone = v('parentPhone');
            if (v('login') && v('login') !== (c.login || '')) changes.login = v('login');
            if (v('newPassword')) changes.newPassword = v('newPassword');
            if (v('tariff') !== (c.tariff || '')) changes.tariff = v('tariff');
            if (v('monthlyPrice') !== String(c.monthlyPrice ?? '') && v('monthlyPrice') !== '') changes.monthlyPrice = Number(v('monthlyPrice').replace(/\D/g, ''));
            const touched = body.dataset.schedTouched === '1';
            if (touched && (pattern(v('lessonDay')) !== c.schedule?.days || v('lessonTime') !== (c.schedule?.time || '') || Number(v('lessonDuration')) !== Number(c.schedule?.duration))) {
                Object.assign(changes, { lessonDay: Number(v('lessonDay')), lessonTime: v('lessonTime'), lessonDuration: Number(v('lessonDuration')), effectiveFrom: v('effectiveFrom') });
            }
            const groupChanged = isManager() && (v('groupName') !== (c.group?.name || '') || v('groupLink') !== (c.group?.tg_link || ''));
            if (!Object.keys(changes).length && !groupChanged) return errBox(box, 'O\'zgarish yo\'q');
            if (v('reason').length < 5) return errBox(box, 'Sababni yozing (kamida 5 belgi)');
            busy(e.target, true); errBox(box, '');
            try {
                let msg = 'Saqlandi';
                if (Object.keys(changes).length) {
                    const r = await post(`/students/${encodeURIComponent(c.id)}/edit`, { changes, reason: v('reason') });
                    if (r.request) msg = r.applied?.changed ? 'Saqlandi · tarif/jadval o\'zgarishi tasdiqqa yuborildi' : 'Tasdiqqa yuborildi';
                }
                if (groupChanged) await api(`/students/${encodeURIComponent(c.id)}/group`, { method: 'PUT', body: { name: v('groupName'), link: v('groupLink'), reason: v('reason') } });
                toast(msg); await refreshCache(); window.dispatchEvent(new CustomEvent('school:changed'));
                saved(c);
            } catch (err) { busy(e.target, false); errBox(box, err.message); }
        };
    }

    // Holat: muzlatish / ustozni almashtirish / qayta tiklash / kursni to'xtatish — alohida bitta oyna.
    function statusForm(box, body, c) {
        const st = c.status;
        const acts = [
            ['freeze', 'Muzlatish', 'vaqtincha · kursda 1 marta, 30 kungacha', st !== 'active' || c.statuses.some(s => s.status === 'frozen')],
            ['teacher', 'Ustozni almashtirish', 'yangi ustoz va sana · tarix saqlanadi', st === 'left'],
            ['restore', 'Qayta tiklash', 'faqat muzlatilgan yoki chiqib ketgan o\'quvchi uchun', st === 'active'],
            ['stop', 'Kursni to\'xtatish', 'o\'quvchi chiqib ketadi', st === 'left']
        ];
        const first = acts.find(a => !a[3])?.[0] || 'freeze';
        body.innerHTML = `<div class="sc-sec"><h3>Amal</h3><div class="sc-alst" role="radiogroup">${acts.map(([k, l, h, off]) =>
            `<label class="sc-ai${k === 'stop' ? ' sc-ai--dg' : ''}${off ? ' is-off' : ''}"><input type="radio" name="act" value="${k}"${off ? ' disabled' : ''}${k === first ? ' checked' : ''}><span><b>${l}</b><small>${h}</small></span></label>`).join('')}</div></div><div class="sc-actbody"></div>`;
        const ab = body.querySelector('.sc-actbody');
        const render = k => { box.querySelector('.sc-df')?.remove(); ({ freeze: freezeForm, teacher: teacherForm, restore: restoreForm, stop: stopForm })[k](box, ab, c); };
        body.querySelectorAll('input[name="act"]').forEach(r => r.onchange = () => render(r.value));
        render(first);
    }
    function footer(box, label, danger, onSave) {
        box.insertAdjacentHTML('beforeend', `<footer class="sc-df"><span class="sc-mt">Admin va ROP · sabab tarixga yoziladi</span><div class="sc-row"><button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="${danger ? 'sc-btn sc-btn--dg' : 'sc-btn sc-btn--pri'}" data-save>${label}</button></div></footer>`);
        box.querySelector('[data-save]').onclick = async e => {
            busy(e.target, true); errBox(box, '');
            try { await onSave(); await refreshCache(); window.dispatchEvent(new CustomEvent('school:changed')); }
            catch (err) { busy(e.target, false); errBox(box, err.message); }
        };
    }
    const reasonBlock = (opts, sel) => `<div class="sc-sec"><h3>Sabab</h3>${chips('rcode', opts, sel)}<textarea name="reason" rows="2" class="sc-mtop" placeholder="Batafsil yozing"></textarea></div>`;
    const val = (root, n) => root.querySelector(`[name="${n}"]`)?.value?.trim() ?? '';
    const radio = (root, n) => root.querySelector(`[name="${n}"]:checked`)?.value || '';
    const fullReason = root => [radio(root, 'rcode'), val(root, 'reason')].filter(Boolean).join(': ');

    function freezeForm(box, ab, c) {
        const from = addDays(today(), 1);
        ab.innerHTML = `<div class="sc-sec"><h3>Muddat</h3><div class="sc-g2">${field('Qaysi sanadan', `<input type="date" name="from" value="${from}" min="${today()}">`)}${field('Qaysi sanagacha', `<input type="date" name="to" value="${addDays(from, 13)}">`)}</div><p class="sc-mt" data-days></p></div>
          ${reasonBlock([['Kasallik', 'Kasallik'], ['Safar', 'Safar'], ['Imtihonlar', 'Imtihonlar'], ['Boshqa', 'Boshqa']], 'Safar')}
          <div class="sc-sec"><h3>Saqlansa nima bo'ladi</h3>${impact([
            ['▦', `${esc(teacherName(c.teacherId, true))} jadvali: ${esc(c.schedule?.days || '')} ${esc(c.schedule?.time || '')} — shu davrda faqat sinov darslariga ochiladi, vaqt o'quvchi uchun saqlanadi`],
            ['◷', 'Yordamchi aloqalari shu kunlarda belgilanmaydi · chegara va narx o\'zgarmaydi'],
            ['₪', 'Keyingi to\'lov sanasi va kurs oxiri muzlatish kunlariga suriladi'],
            ['▣', 'Ilova: o\'tgan darslar ochiq · Telegram guruh qoladi'],
            ['↻', 'Tugash sanasidan keyingi kuni avtomatik faollashadi — oldin qaytarish ham mumkin']])}</div>`;
        const upd = () => { const a = val(ab, 'from'), b = val(ab, 'to'); const n = a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1 : 0; ab.querySelector('[data-days]').textContent = n > 0 ? `${n} kun${n > 30 ? ' — 30 kundan oshmaydi' : ''} · qaytadi: ${fmtDate(addDays(b, 1))}` : ''; };
        ab.querySelectorAll('input[type=date]').forEach(i => i.oninput = upd); upd();
        footer(box, 'Muzlatish', false, async () => { await post(`/students/${encodeURIComponent(c.id)}/freeze`, { from: val(ab, 'from'), to: val(ab, 'to'), reasonCode: radio(ab, 'rcode'), reason: fullReason(ab) }); toast('Muzlatildi'); saved(c); });
    }
    function stopForm(box, ab, c) {
        ab.innerHTML = `<div class="sc-sec"><h3>Oxirgi dars</h3>${field('Oxirgi dars sanasi', `<input type="date" name="last" value="${today()}">`)}</div>
          ${reasonBlock([['Vaqti yo\'q', 'Vaqti yo\'q'], ['Moliyaviy', 'Moliyaviy'], ['Boshqa markaz', 'Boshqa markaz'], ['Natijadan norozi', 'Natijadan norozi'], ['Boshqa', 'Boshqa']], 'Vaqti yo\'q')}
          <div class="sc-sec"><h3>Saqlansa nima bo'ladi</h3>${impact([
            ['▦', `${esc(teacherName(c.teacherId, true))} jadvalida ${esc(c.schedule?.days || '')} ${esc(c.schedule?.time || '')} keyingi kundan bo'shaydi → sinovga ochiladi`],
            ['◷', 'Yordamchi ro\'yxatidan chiqadi · tarix arxivda qoladi'],
            ['✈', 'Telegram guruh arxivlanadi'],
            ['▣', 'Ilova: faqat o\'tgan darslar · yangi dars ochilmaydi'],
            ['☎', 'Sotuv menejerining "Faol emas" ro\'yxatiga tushadi'],
            ['▤', 'Faol o\'quvchilar, davomat va reytingdan chiqadi · qoplanmagan darslar bekor bo\'ladi']])}</div>
          <div class="sc-note sc-note--bad">Qaytarib bo'lmaydigan amal emas — "Qayta tiklash" bilan qaytariladi, vaqti band bo'lsa yangi vaqt tanlanadi.</div>`;
        footer(box, 'Kursni to\'xtatish', true, async () => { await post(`/students/${encodeURIComponent(c.id)}/stop`, { lastLesson: val(ab, 'last'), reasonCode: radio(ab, 'rcode'), reason: fullReason(ab) }); toast('Kurs to\'xtatildi'); saved(c); });
    }
    async function freeSlotsFor(teacherId, from, duration, day) {
        const to = addDays(from, 13);
        const r = await api(`/schedule/free?purpose=lesson&teacherId=${encodeURIComponent(teacherId)}&from=${from}&to=${to}&duration=${duration}`);
        const days = [1, 3, 5].includes(Number(day)) ? [1, 3, 5] : [2, 4, 6];
        // Haftalik dars: shu vaqt naqshdagi uchala kunda ham bo'sh bo'lishi kerak.
        const byTime = new Map();
        for (const s of r.slots) { if (!days.includes(wd(s.date))) continue; const k = s.time; byTime.set(k, (byTime.get(k) || new Set()).add(s.date)); }
        return [...byTime.entries()].filter(([, set]) => set.size >= 5).map(([t]) => t).sort();
    }
    function restoreForm(box, ab, c) {
        const frozen = c.status === 'frozen';
        const from = addDays(today(), 1);
        ab.innerHTML = frozen ? `<div class="sc-sec"><h3>Muzlatishdan oldin qaytarish</h3>${field('Birinchi dars', `<input type="date" name="from" value="${from}" min="${today()}">`, 'Ishlatilmagan kunlar to\'lov sanasidan qaytarib olinadi')}</div>${reasonBlock([['Erta qaytdi', 'Erta qaytdi'], ['Boshqa', 'Boshqa']], 'Erta qaytdi')}`
            : `<div class="sc-sec"><h3>Qachondan</h3><div class="sc-g2">${field('Birinchi dars', `<input type="date" name="from" value="${from}" min="${today()}">`)}${field('Kurs', `<select name="cont"><option value="next">To'xtagan joyidan davom</option><option value="restart">Boshidan (progress arxivga)</option></select>`)}</div></div>
              <div class="sc-sec"><h3>Ustoz va vaqt</h3><div class="sc-g2">${field('Ustoz', `<select name="teacher">${teachersForSubject(c.subject).map(t => `<option value="${esc(t.id)}"${t.id === c.teacherId ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`)}
                ${field('Dars kunlari', `<select name="day"><option value="1"${[1, 3, 5].includes(Number(c.schedule?.day)) ? ' selected' : ''}>Du·Ch·Ju</option><option value="2"${[2, 4, 6].includes(Number(c.schedule?.day)) ? ' selected' : ''}>Se·Pa·Sh</option></select>`)}</div>
                <div class="sc-old" data-old></div><p class="sc-mt sc-mtop">Bo'sh vaqtlar · ${esc(c.schedule?.duration || 30)} daq</p><div class="sc-slots" data-slots><span class="sc-mt">Yuklanmoqda…</span></div></div>
              ${reasonBlock([['Qayta yozildi', 'Qayta yozildi'], ['Sabab bartaraf etildi', 'Sabab bartaraf etildi'], ['Boshqa', 'Boshqa']], 'Qayta yozildi')}
              <div class="sc-sec"><h3>Saqlansa nima bo'ladi</h3>${impact([['▦', 'Tanlangan vaqt ustoz jadvalida band bo\'ladi'], ['◷', 'Yordamchi ro\'yxatiga qaytadi'], ['✈', 'Telegram guruh arxivdan qaytadi'], ['₪', 'Yangi to\'lov davri birinchi darsdan · sotuv menejeriga vazifa'], ['▣', 'Ilova: eski login ishlaydi']])}</div>`;
        let pick = null;
        const load = async () => {
            if (frozen) return;
            const slotsEl = ab.querySelector('[data-slots]'); slotsEl.innerHTML = '<span class="sc-mt">Yuklanmoqda…</span>';
            const tid = val(ab, 'teacher'), day = val(ab, 'day');
            try {
                const times = await freeSlotsFor(tid, val(ab, 'from'), c.schedule?.duration || 30, day);
                const old = c.schedule?.time; const oldFree = tid === c.teacherId && pattern(day) === c.schedule?.days && times.includes(old);
                ab.querySelector('[data-old]').innerHTML = old && tid === c.teacherId ? (oldFree ? `<div class="sc-note sc-note--ok">Eski vaqt bo'sh: ${esc(c.schedule.days)} ${esc(old)}</div>` : `<div class="sc-note sc-note--bad"><b>Eski vaqt band: ${esc(c.schedule.days)} ${esc(old)}</b> — yangi vaqt tanlang</div>`) : '';
                pick = oldFree ? old : null;
                slotsEl.innerHTML = times.length ? times.map(t => `<button type="button" class="sc-slot" aria-pressed="${t === pick}" data-t="${t}">${esc(pattern(day))} ${t}</button>`).join('') : '<span class="sc-mt">Bu ustozda 2 hafta ichida bo\'sh doimiy vaqt yo\'q — boshqa ustozni tanlang</span>';
                slotsEl.querySelectorAll('.sc-slot').forEach(b => b.onclick = () => { pick = b.dataset.t; slotsEl.querySelectorAll('.sc-slot').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
            } catch (e) { slotsEl.textContent = e.message; }
        };
        ab.querySelectorAll('select[name=teacher],select[name=day],input[name=from]').forEach(i => i.onchange = load); load();
        footer(box, 'Qayta tiklash', false, async () => {
            if (!frozen && !pick) throw new Error('Bo\'sh vaqtni tanlang');
            await post(`/students/${encodeURIComponent(c.id)}/restore`, frozen ? { from: val(ab, 'from'), reason: fullReason(ab) }
                : { from: val(ab, 'from'), teacherId: val(ab, 'teacher'), lessonDay: Number(val(ab, 'day')), lessonTime: pick, continueFrom: val(ab, 'cont'), reasonCode: radio(ab, 'rcode'), reason: fullReason(ab) });
            toast('Qayta tiklandi'); saved(c);
        });
    }
    function teacherForm(box, ab, c) {
        const from = addDays(today(), 1);
        const list = teachersForSubject(c.subject).filter(t => t.id !== c.teacherId && t.id !== c.assistantId);
        ab.innerHTML = `<div class="sc-sec"><h3>Yangi ustoz</h3><p class="sc-mt">${esc(c.schedule?.days || '')} ${esc(c.schedule?.time || '')} · ${esc(c.schedule?.duration || '')} daq bo'yicha tekshiriladi</p><div class="sc-tch" data-tch><span class="sc-mt">Tekshirilmoqda…</span></div></div>
          <div class="sc-sec"><h3>Sana</h3>${field('Yangi ustoz bilan birinchi dars', `<input type="date" name="from" value="${from}" min="${today()}">`, 'Shu kungacha eski ustoz dars o\'tadi va qoplaydi')}</div>
          ${reasonBlock([['Ota-ona so\'radi', 'Ota-ona so\'radi'], ['Ustoz yuklamasi', 'Ustoz yuklamasi'], ['Ustoz ketmoqda', 'Ustoz ketmoqda'], ['Boshqa', 'Boshqa']], 'Ota-ona so\'radi')}
          <div class="sc-sec"><h3>Saqlansa nima bo'ladi</h3>${impact([['▦', 'Eski ustozda vaqt bo\'shaydi → sinovga ochiladi · yangi ustozda band'], ['✈', 'Telegram guruh: yangi ustozni qo\'shing, eskisini chiqaring'], ['↺', 'Qoplanmagan darslar oxirgi kungacha eski ustozda, keyin yangisiga o\'tadi'], ['₪', 'Ustozlar maoshi dars bo\'yicha bo\'linadi · o\'quvchi to\'lovi o\'zgarmaydi'], ['▣', 'Ilova: progress saqlanadi · yangi ustoz rasmi va ismi']])}</div>`;
        let pick = null;
        const load = async () => {
            const el = ab.querySelector('[data-tch]');
            const rows = await Promise.all(list.map(async t => {
                try { const times = await freeSlotsFor(t.id, val(ab, 'from'), c.schedule?.duration || 30, c.schedule?.day); return { t, ok: times.includes(c.schedule?.time), alt: times[0] || null }; }
                catch { return { t, ok: false, alt: null }; }
            }));
            rows.sort((a, b) => (b.ok - a.ok) || (!!b.alt - !!a.alt));
            pick = rows.find(r => r.ok)?.t.id || null;
            el.innerHTML = rows.map(r => `<label class="sc-tc${!r.ok && !r.alt ? ' is-off' : ''}"><input type="radio" name="tch" value="${esc(r.t.id)}"${r.t.id === pick ? ' checked' : ''}${!r.ok && !r.alt ? ' disabled' : ''}>${staffAvatar(r.t, 34)}<span class="sc-grow"><b>${esc(r.t.name)}</b><small>${r.ok ? 'vaqt o\'zgarmaydi' : r.alt ? 'shu vaqt band · bo\'sh: ' + esc(r.alt) : 'mos bo\'sh vaqt yo\'q'}</small></span><span class="sc-pill ${r.ok ? 'sc-pill--ok' : r.alt ? 'sc-pill--warn' : 'sc-pill--mute'}">${r.ok ? esc(c.schedule?.time) + ' bo\'sh' : r.alt ? 'band' : '—'}</span></label>`).join('') || '<span class="sc-mt">Boshqa ustoz yo\'q</span>';
            el.querySelectorAll('input[name=tch]').forEach(i => i.onchange = () => { pick = i.value; });
            el._rows = rows;
        };
        ab.querySelector('input[name=from]').onchange = load; load();
        footer(box, 'Almashtirish', false, async () => {
            if (!pick) throw new Error('Yangi ustozni tanlang');
            const r = ab.querySelector('[data-tch]')._rows?.find(x => x.t.id === pick);
            await post(`/students/${encodeURIComponent(c.id)}/teacher`, { teacherId: pick, from: val(ab, 'from'), lessonTime: r && !r.ok ? r.alt : undefined, reason: fullReason(ab) });
            toast('Ustoz almashtirildi'); saved(c);
        });
    }
    const ACTION_LABEL = { edit: 'Tahrir', freeze: 'Muzlatildi', stop: 'Kurs to\'xtatildi', restore: 'Qayta tiklandi', 'unfreeze-early': 'Muzlatishdan erta qaytdi',
        'teacher-change': 'Ustoz almashtirildi', group: 'Telegram guruh', 'request-tariff': 'So\'rov: tarif', 'request-teacher': 'So\'rov: ustoz',
        'request-approved': 'So\'rov tasdiqlandi', 'request-rejected': 'So\'rov rad etildi', 'request-returned': 'So\'rov qaytarildi' };
    const FIELD_LABEL = { name: 'Ism', phone: 'Telefon', parentPhone: 'Ota-ona', login: 'Login', password: 'Parol', tariff: 'Tarif', monthlyPrice: 'Narx', schedule: 'Jadval' };
    function historyList(c) {
        if (!c.history?.length) return '<p class="sc-mt">Hali o\'zgarish yo\'q</p>';
        return `<ol class="sc-tl">${c.history.map(h => {
            const ch = h.changes || {};
            let diff = Object.entries(ch).filter(([, v]) => Array.isArray(v)).map(([k, [a, b]]) => `<div class="sc-diff"><span>${esc(FIELD_LABEL[k] || k)}</span><s>${esc(a)}</s> → <b>${esc(b)}</b></div>`).join('');
            if (h.action === 'group') diff = `<div class="sc-diff"><span>Guruh</span>${ch.before ? `<s>${esc(ch.before.name)}</s> → ` : ''}<b>${esc(ch.after?.name || '')}</b></div>`;
            if (h.action === 'teacher-change') diff = `<div class="sc-diff"><span>Ustoz</span><s>${esc(teacherName(ch.from))}</s> → <b>${esc(teacherName(ch.to))}</b> · ${esc(fmtDate(ch.date))}</div>`;
            if (h.action === 'freeze') diff = `<div class="sc-diff"><span>Muddat</span><b>${esc(fmtDate(ch.from, false))} – ${esc(fmtDate(ch.to, false))}</b> · ${esc(ch.days)} kun</div>`;
            if (h.action === 'stop') diff = `<div class="sc-diff"><span>Oxirgi dars</span><b>${esc(fmtDate(ch.lastLesson))}</b></div>`;
            if (h.action === 'restore') diff = `<div class="sc-diff"><span>Qaytdi</span><b>${esc(fmtDate(ch.from))} · ${esc(ch.schedule || '')}</b></div>`;
            return `<li><div class="sc-tl-h"><b>${esc(ACTION_LABEL[h.action] || h.action)}</b><span class="sc-mt">${esc(new Date(h.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))} · ${esc(h.actor_name)}</span></div>${diff}${h.reason ? `<p class="sc-mt">${esc(h.reason)}</p>` : ''}</li>`;
        }).join('')}</ol>`;
    }

    // ── Sotuv tahrirlari · tasdiq (admin va ROP) ─────────────────────────────
    async function renderApprovals(root) {
        await loadStaffAvatars();
        root.innerHTML = '<div class="sc-skel"></div>';
        let data, filter = root.dataset.filter || 'pending';
        try { data = await api('/edit-requests'); } catch (e) { root.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        const counts = data.counts || {};
        const list = data.requests.filter(r => filter === 'all' || r.status === filter);
        root.innerHTML = `<div class="sc-head"><div><h1>Sotuv tahrirlari · tasdiq</h1><p class="sc-sub">Admin va ROP teng · kim birinchi qaror qilsa, ikkinchisida yopiladi</p></div>
            <div class="sc-seg" role="group">${[['pending', 'Kutilmoqda'], ['approved', 'Tasdiqlangan'], ['rejected', 'Rad etilgan'], ['returned', 'Qaytarilgan'], ['all', 'Hammasi']].map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${k === filter}">${l}${k !== 'all' && counts[k] ? ' ' + counts[k] : ''}</button>`).join('')}</div></div>
          <div class="sc-note">Tasdiq so'raydi: tarif yoki narx · jadval · asosiy ustoz. Ism, telefon, login va parolni menejer o'zi tuzatadi — faqat tarixga yoziladi.</div>
          <div class="sc-lay2"><section class="sc-card sc-inbox">${list.map((r, i) => `<button type="button" class="sc-it" data-i="${i}"><span class="sc-grow"><b>${esc(r.requester_name)} · ${esc(REQ_KIND[r.kind])}</b><small>${esc(r.student_name || '')}</small><small>${esc(new Date(r.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))} · №${esc(r.number)}</small></span>${reqPill(r)}</button>`).join('') || '<p class="sc-mt sc-pad">So\'rov yo\'q</p>'}</section>
          <section class="sc-card" data-detail><p class="sc-mt sc-pad">So'rovni tanlang</p></section></div>`;
        root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { root.dataset.filter = b.dataset.f; renderApprovals(root); });
        const open = i => { root.querySelectorAll('.sc-it').forEach(x => x.classList.toggle('sel', x.dataset.i === String(i))); approvalDetail(root, list[i]); };
        root.querySelectorAll('.sc-it').forEach(b => b.onclick = () => open(Number(b.dataset.i)));
        if (list.length) open(0);
    }
    const reqPill = r => `<span class="sc-pill ${{ pending: 'sc-pill--warn', approved: 'sc-pill--ok', rejected: 'sc-pill--bad', returned: 'sc-pill--mute' }[r.status]}">${{ pending: 'Kutilmoqda', approved: 'Tasdiqlandi', rejected: 'Rad etildi', returned: 'Qaytarildi' }[r.status]}</span>`;
    function approvalDetail(root, r) {
        const el = root.querySelector('[data-detail]');
        const s = studentById(r.student_id) || {};
        const ch = r.changes || {};
        const rows = [];
        if (r.kind === 'teacher') rows.push(['Asosiy ustoz', teacherName(s.teacherId), teacherName(ch.teacherId)], ['Qachondan', '—', ch.from ? fmtDate(ch.from) : '—']);
        if ('tariff' in ch) rows.push(['Tarif', s.tariff || '—', ch.tariff]);
        if ('monthlyPrice' in ch) rows.push(['Oylik narx', s.monthlyPrice ? formatMoney(s.monthlyPrice) : '—', formatMoney(ch.monthlyPrice)]);
        if ('lessonDuration' in ch || 'lessonTime' in ch) rows.push(['Jadval', `${pattern(s.lessonDayOfWeek)} ${s.lessonTime || ''} · ${s.lessonDuration || ''} daq`, `${pattern(ch.lessonDay ?? s.lessonDayOfWeek)} ${ch.lessonTime || s.lessonTime} · ${ch.lessonDuration || s.lessonDuration} daq`]);
        if (ch.effectiveFrom && r.kind !== 'teacher') rows.push(['Qachondan', '—', fmtDate(ch.effectiveFrom)]);
        const pending = r.status === 'pending';
        el.innerHTML = `<header class="sc-ch"><h2>${esc(r.student_name || s.name || '')} · ${r.kind === 'teacher' ? 'ustozni almashtirish' : 'tarif o\'zgarishi'}</h2><span class="sc-mt">№${esc(r.number)} · ${esc(r.requester_name)}</span></header>
          <div class="sc-pad">
            <div class="sc-row sc-req"><span class="sc-grow"><b>${esc(r.requester_name)}</b><span class="sc-mt"> · o'z sotgan o'quvchisi · ${esc(new Date(r.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}</span></span><button type="button" class="sc-btn" data-card>Kartani ochish</button></div>
            <h3>Nima o'zgaradi</h3><table class="sc-df-t"><thead><tr><th></th><th>Hozir</th><th></th><th>So'ralgan</th></tr></thead><tbody>${rows.map(([l, a, b]) => `<tr${String(a) === String(b) ? ' class="same"' : ''}><td>${esc(l)}</td><td>${esc(a)}</td><td>${String(a) === String(b) ? '=' : '→'}</td><td><b>${esc(b)}</b></td></tr>`).join('')}</tbody></table>
            <h3>Menejer sababi</h3><blockquote class="sc-quote">${esc(r.reason)}</blockquote>
            ${pending ? `<h3>Qaror</h3><div class="sc-dec" role="radiogroup">
              <label class="sc-dc sc-dc--ok"><input type="radio" name="dec" value="approve"><b>Tasdiqlash</b><small>server bo'sh vaqtni qayta tekshiradi</small></label>
              <label class="sc-dc sc-dc--no"><input type="radio" name="dec" value="reject"><b>Rad etish</b><small>sabab majburiy</small></label>
              <label class="sc-dc"><input type="radio" name="dec" value="return"><b>Qaytarish</b><small>menejer tuzatib qayta yuboradi</small></label></div>
              <textarea name="note" rows="2" class="sc-mtop" placeholder="Izoh (rad etish va qaytarishda majburiy)"></textarea>`
            : `<div class="sc-note">${reqPill(r)} ${esc(r.decided_by_name || '')} · ${r.decided_at ? esc(new Date(r.decided_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })) : ''}${r.decision_note ? ' — ' + esc(r.decision_note) : ''}</div>`}
          </div>
          ${pending ? `<footer class="sc-df"><span class="sc-mt">Avval qarorni tanlang</span><button type="button" class="sc-btn sc-btn--pri" data-save disabled>Qarorni saqlash</button></footer>` : ''}`;
        el.querySelector('[data-card]').onclick = () => openStudent(r.student_id);
        if (!pending) return;
        const save = el.querySelector('[data-save]');
        const note = el.querySelector('[name=note]');
        el.querySelectorAll('[name=dec]').forEach(i => i.onchange = () => { save.disabled = false; note.placeholder = i.value === 'approve' ? 'Izoh (ixtiyoriy)' : 'Sabab (majburiy) — menejerga boradi'; note.required = i.value !== 'approve'; });
        save.onclick = async () => {
            const decision = el.querySelector('[name=dec]:checked')?.value;
            if (decision !== 'approve' && note.value.trim().length < 3) { note.focus(); return toast('Sababni yozing'); }
            busy(save, true);
            try { await post(`/edit-requests/${r.id}/decide`, { decision, note: note.value.trim() }); toast('Qaror saqlandi'); await refreshCache(); renderApprovals(root); }
            catch (e) { busy(save, false); toast(e.message, 4000); }
        };
    }

    // ── Telegram guruhlar (admin, ROP) ───────────────────────────────────────
    async function renderGroups(root) {
        await loadStaffAvatars();
        root.innerHTML = '<div class="sc-skel"></div>';
        let d; try { d = await api('/groups'); } catch (e) { root.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        const q = (root.dataset.q || '').toLowerCase();
        const list = d.groups.filter(g => !q || g.name.toLowerCase().includes(q) || String(g.student_name).toLowerCase().includes(q));
        const noLink = d.groups.filter(g => !g.tg_link && !g.archived).length, auto = d.groups.filter(g => g.name_source === 'auto').length;
        root.innerHTML = `<div class="sc-head"><div><h1>Telegram guruhlar</h1><p class="sc-sub">Har o'quvchining individual guruhi · a'zolar: o'quvchi, ustoz, yordamchi, ROP, sotuv menejeri · nomni bosing — Telegram ochiladi</p></div>
          ${isFull() ? '<button type="button" class="sc-btn" data-auto>Eski guruhlarga nom berish</button>' : ''}</div>
          <div class="sc-kpis"><div class="sc-kpi"><small>Guruhlar</small><b>${d.groups.length}</b></div><div class="sc-kpi"><small>Avtomatik nom</small><b>${auto}</b><span>nomini tekshiring</span></div><div class="sc-kpi"><small>Havolasiz</small><b>${noLink}</b></div><div class="sc-kpi"><small>Keyingi nom</small><b class="sc-small">${esc(d.nextName)}</b></div></div>
          <section class="sc-card"><div class="sc-pad"><input type="search" placeholder="Guruh nomi yoki o'quvchi" value="${esc(root.dataset.q || '')}" data-q></div>
          <table class="sc-table"><thead><tr><th>Guruh</th><th>O'quvchi</th><th>Asosiy ustoz</th><th>Yordamchi</th><th>Nom</th><th></th></tr></thead><tbody>
          ${list.map(g => `<tr${g.archived ? ' class="is-muted"' : ''}><td>${tgPill(g)}</td><td><button type="button" class="sc-link" data-st="${esc(g.student_id)}">${esc(g.student_name)}</button></td><td>${esc(teacherName(g.teacher_id, true))}</td><td>${g.assistant_teacher_id ? esc(teacherName(g.assistant_teacher_id, true)) : '—'}</td>
            <td>${g.archived ? '<span class="sc-pill sc-pill--mute">arxiv</span>' : g.name_source === 'auto' ? '<span class="sc-pill sc-pill--warn">avtomatik</span>' : '<span class="sc-pill sc-pill--ok">qo\'lda</span>'}</td><td><button type="button" class="sc-btn sc-btn--sm" data-edit="${esc(g.student_id)}">Tahrirlash</button></td></tr>`).join('')}
          </tbody></table></section>`;
        const s = root.querySelector('[data-q]'); s.oninput = () => { root.dataset.q = s.value; clearTimeout(s._t); s._t = setTimeout(() => renderGroups(root).then(() => root.querySelector('[data-q]')?.focus()), 300); };
        root.querySelectorAll('[data-st]').forEach(b => b.onclick = () => openStudent(b.dataset.st));
        root.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openStudent(b.dataset.edit, 'tahrir'));
        root.querySelector('[data-auto]')?.addEventListener('click', async e => { busy(e.target, true); try { const r = await post('/groups/auto-name'); toast(`${r.named} ta guruhga nom berildi`); renderGroups(root); } catch (err) { busy(e.target, false); toast(err.message); } });
    }

    // ── Yordamchi aloqalari: admin ko'rinishi (tuzatish, kech belgilash, oy yopish) ──
    async function renderAssistAdmin(root) {
        await loadStaffAvatars();
        const month = root.dataset.month || today().slice(0, 7);
        const list = assistants();
        const aid = root.dataset.aid || list[0]?.id || '';
        root.innerHTML = '<div class="sc-skel"></div>';
        let rep = null, reqs = [];
        try {
            if (aid) rep = await api(`/assist/month?assistantId=${encodeURIComponent(aid)}&month=${month}`);
            reqs = (await api('/requests?status=new')).requests.filter(r => r.type === 'assist_late');
        } catch (e) { root.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        const st = rep?.state || {};
        const locked = month < today().slice(0, 7);
        const step = !locked ? 'Oy davom etmoqda' : !st.prelim_at ? 'Qulflangan · dastlabki tasdiq kutilmoqda' : !st.final_at ? `Dastlabki tasdiq · e'tiroz ${st.objection_until ? fmtDate(String(st.objection_until).slice(0, 10), false) + ' gacha' : ''}` : !st.paid_at ? 'Yakuniy tasdiq · to\'lov kutilmoqda' : 'To\'langan';
        root.innerHTML = `<div class="sc-head"><div><h1>Yordamchi aloqalari</h1><p class="sc-sub">Har o'quvchi bilan oyiga 13 tagacha × 3 846 so'm · kamida 5 daqiqa · "javob bermadi" hisoblanmaydi</p></div>
            <div class="sc-row"><select data-aid>${list.map(a => `<option value="${esc(a.id)}"${a.id === aid ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select><input type="month" value="${month}" data-month></div></div>
          ${reqs.length ? `<section class="sc-card"><header class="sc-ch"><h2>Kechikib belgilash so'rovlari · ${reqs.length}</h2></header>${reqs.map(r => `<div class="sc-it"><span class="sc-grow"><b>${esc(r.requester_name)} · ${esc(studentById(r.payload?.studentId)?.name || '')}</b><small>${esc(fmtDate(r.payload?.day))} · ${esc(r.payload?.channel || '')} ${esc(r.payload?.minutes || '')} daq — ${esc(r.reason)}</small></span><button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-late="${esc(r.id)}">Qo'shish</button></div>`).join('')}</section>` : ''}
          ${rep ? `<div class="sc-kpis"><div class="sc-kpi"><small>Hisoblangan</small><b>${rep.counted}</b><span>${formatMoney(rep.amount)}</span></div><div class="sc-kpi"><small>Javob bermadi</small><b>${rep.noAnswer}</b></div><div class="sc-kpi"><small>Limitdan ortiq</small><b>${rep.overCap}</b></div><div class="sc-kpi"><small>Holat</small><b class="sc-small">${esc(step)}</b></div></div>
          <section class="sc-card"><header class="sc-ch"><h2>O'quvchilar bo'yicha</h2>${isFull() && locked ? `<div class="sc-row">${!st.prelim_at ? '<button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-step="prelim">Dastlabki tasdiq</button>' : !st.final_at ? '<button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-step="final">Yakuniy tasdiq</button>' : !st.paid_at ? '<button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-step="paid">To\'landi</button>' : ''}</div>` : isFull() ? '<button type="button" class="sc-btn sc-btn--sm" data-add>+ Aloqani tuzatish</button>' : ''}</header>
          <table class="sc-table"><thead><tr><th>O'quvchi</th><th class="r">Hisoblangan</th><th class="r">Summa</th><th>Izoh</th></tr></thead><tbody>${rep.students.map(s => `<tr><td>${studentAvatar(studentById(s.studentId), 26)} ${esc(studentById(s.studentId)?.name || s.studentId)}</td><td class="r"><b>${s.counted}</b> / 13</td><td class="r">${formatMoney(s.amount)}</td><td class="sc-mt">${[s.noAnswer && `${s.noAnswer} javob bermadi`, s.overCap && `${s.overCap} ta limitdan ortiq`, s.short && `${s.short} ta 5 daqiqadan qisqa`].filter(Boolean).join(' · ') || '—'}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td>Jami</td><td class="r">${rep.counted}</td><td class="r">${formatMoney(rep.amount)}</td><td></td></tr></tfoot></table></section>` : '<p class="sc-mt">Yordamchi ustoz yo\'q</p>'}`;
        root.querySelector('[data-aid]').onchange = e => { root.dataset.aid = e.target.value; renderAssistAdmin(root); };
        root.querySelector('[data-month]').onchange = e => { root.dataset.month = e.target.value; renderAssistAdmin(root); };
        root.querySelectorAll('[data-step]').forEach(b => b.onclick = async () => { busy(b, true); try { await post(`/assist/months/${month}/${b.dataset.step}`); toast('Saqlandi'); renderAssistAdmin(root); } catch (e) { busy(b, false); toast(e.message, 4000); } });
        root.querySelectorAll('[data-late]').forEach(b => b.onclick = () => correctionDrawer(reqs.find(r => r.id === b.dataset.late), () => renderAssistAdmin(root)));
        root.querySelector('[data-add]')?.addEventListener('click', () => correctionDrawer({ teacher_id: aid, payload: {} }, () => renderAssistAdmin(root)));
    }
    function correctionDrawer(req, done) {
        const p = req.payload || {};
        const my = students().filter(s => s.assistantTeacherId === req.teacher_id);
        const box = openDrawer({ title: 'Aloqani tuzatish', sub: req.id ? `${esc(req.requester_name)} so'rovi` : 'Admin tuzatishi · sabab bilan tarixga yoziladi', body: `
            <div class="sc-g2">${field('O\'quvchi', `<select name="st">${my.map(s => `<option value="${esc(s.id)}"${s.id === p.studentId ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select>`)}
            ${field('Sana', `<input type="date" name="day" value="${esc(p.day || today())}" max="${today()}">`)}
            ${field('Usul', `<select name="ch">${Object.entries({ phone: 'Telefon', zoom: 'Zoom', meet: 'Google Meet', tg_video: 'Telegram video', tg_group: 'Telegram guruh videodars', tg_text: 'Telegram yozishma' }).map(([k, l]) => `<option value="${k}"${k === p.channel ? ' selected' : ''}>${l}</option>`).join('')}</select>`)}
            ${field('Davomiylik, daqiqa', `<input name="min" inputmode="numeric" value="${esc(p.minutes || '')}">`)}</div>
            ${field('Tuzatish sababi', `<textarea name="reason" rows="2">${esc(req.reason || '')}</textarea>`)}`,
            foot: '<button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Saqlash</button>' });
        box.querySelector('[data-save]').onclick = async e => {
            busy(e.target, true);
            try { await post('/assist/corrections', { studentId: val(box, 'st'), day: val(box, 'day'), channel: val(box, 'ch'), minutes: Number(val(box, 'min')), reason: val(box, 'reason'), requestId: req.id }); toast('Aloqa qo\'shildi'); closeDrawer(); done(); }
            catch (err) { busy(e.target, false); errBox(box, err.message); }
        };
    }

    window.schoolUI = Object.assign(window.schoolUI || {}, {
        api, post, esc, today, addDays, wd, weekStart, fmtDate, hm, toMin, pattern, DAY, DAY_FULL,
        studentAvatar, staffAvatar, staffAvatarUrl, tgPill, teacherName, studentById, teachersForSubject,
        openDrawer, closeDrawer, errBox, busy, field, impact, toast, refreshCache, nowMin,
        openStudent, closeStudent, renderApprovals, renderGroups, renderAssistAdmin, loadStaffAvatars, acad, dShort, whenTxt, shortName, num
    });
})();
