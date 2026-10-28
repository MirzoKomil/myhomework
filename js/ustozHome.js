// Ustoz kabineti (UstozBosh, UstozDavomat, "Darsni tugatasizmi?" oynasi) uchun umumiy yordamchilar:
//  • qoplanmagan darslar (kelmadi + qoplash yo'q) va ustozning O'Z maoshidagi taxminiy yo'qotish
//    (calculateKpiSalary dagi ustoz stavkasi bo'yicha; o'quvchi tarifi ishlatilmaydi va ko'rsatilmaydi);
//  • "N o'quvchiga e'tibor kerak" — Akademik → O'quvchini tekshirish (js/schoolCheck.js) bilan bir xil qoida;
//  • reyting kartasi (▲/▼ o'tgan oyga nisbatan, "N-o'ringa X ball qoldi", formula raqamlari bilan);
//  • Bosh sahifa "Bugun" ro'yxatidagi joriy/keyingi dars qatoriga "Boshlash" (js/lessonStart.js).
// Davomat yozilmaydi — faqat mavjud endpointlar o'qiladi; qo'shaloq dars mavjud POST /api/school/makeups/double orqali.
(function () {
    'use strict';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const school = (p, o) => apiFetch('/api/school' + p, { timeout: 30000, ...(o || {}) });
    const num = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const MON3 = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const DAY = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' });
    const today = () => dayFmt.format(new Date());
    const dkey = v => (v ? String(v).slice(0, 10) : '');
    const wd = d => { const x = new Date(`${d}T00:00:00Z`).getUTCDay(); return x || 7; };
    const first = n => String(n || '').trim().split(/\s+/)[0] || '';
    const dm = d => `${Number(d.slice(8))}-${MON3[Number(d.slice(5, 7)) - 1]}`;
    const andJoin = a => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} va ${a[a.length - 1]}`);
    const me = () => (typeof getCurrentUser === 'function' ? getCurrentUser() : null) || {};

    function ownMain(tid) {
        return (getItem(STORAGE_KEYS.students, []) || []).filter(s => String(s.teacherId || '') === String(tid) && !s.frozen && !s.isStaffDemo && s.status !== 'inactive');
    }
    function lessonDaySet(s, month) {
        const cal = typeof teacherAttendanceCalendar !== 'undefined' ? teacherAttendanceCalendar : null;
        if (cal) {
            try {
                const own = typeof resolveTeacherWithVirtual === 'function' ? resolveTeacherWithVirtual(s.teacherId) || {} : {};
                return new Set(cal.cells(month, cal.weekdays(s, own, 'main')).filter(c => c && c.scheduled).map(c => c.day));
            } catch { /* pastdagi zaxira */ }
        }
        if (s.lessonDayOfWeek == null || typeof expandLessonPatternDays !== 'function') return null;
        const pat = expandLessonPatternDays(s.lessonDayOfWeek), [y, m] = month.split('-').map(Number), out = new Set();
        for (let d = 1; d <= new Date(Date.UTC(y, m, 0)).getUTCDate(); d++) { const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7; if (pat.includes(w)) out.add(d); }
        return out;
    }

    // ── Qoplanmagan darslar (joriy oy, bugungacha) ─────────────────────────
    // "Kelmadi" = main_attendance dagi 0 yoki school_absences (/attendance/absences); "Keldi" ustun turadi.
    // Qoplangan = shu sana uchun qoplash bor (rejada / tekshiruvda / tasdiqlangan) — Davomat sahifasi bilan bir xil.
    async function missed(user = me(), { makeups = null } = {}) {
        const tid = user.linkedTeacherId; if (!tid) return null;
        const td = today(), month = td.slice(0, 7);
        const [ab, mk] = await Promise.all([
            school('/attendance/absences?month=' + month).catch(() => ({ absences: [] })),
            makeups ? Promise.resolve(makeups) : school('/makeups').then(r => r.makeups || []).catch(() => [])]);
        const att = (getItem(STORAGE_KEYS.mainAttendance, {}) || {})[`${month}_${tid}`] || {};
        const mine = mk.filter(m => m.teacher_id === tid && ['planned', 'review', 'approved'].includes(m.status));
        const by = new Map();
        for (const s of ownMain(tid)) {
            const marks = att[s.id] || {}, absent = new Set();
            for (const [d, v] of Object.entries(marks)) if (v === 0 || v === false) absent.add(Number(d));
            for (const a of ab.absences || []) if (a.teacherId === tid && a.studentId === s.id && String(a.day).slice(0, 7) === month) absent.add(Number(String(a.day).slice(8, 10)));
            const days = lessonDaySet(s, month);
            const dates = [...absent].filter(d => marks[d] !== 1 && marks[d] !== true && (!days || days.has(d)))
                .map(d => `${month}-${String(d).padStart(2, '0')}`).filter(d => d <= td).sort();
            const cover = new Map(mine.filter(m => m.student_id === s.id).map(m => [dkey(m.missed_date), m]));
            const open = dates.filter(d => !cover.has(d));
            const planned = dates.filter(d => cover.get(d)?.status === 'planned').map(d => ({ missed: d, held: dkey(cover.get(d).held_date) }));
            if (open.length || planned.length) by.set(s.id, { student: s, open, planned });
        }
        return { month, today: td, by, makeups: mk };
    }

    // Ustozning o'z maoshi bo'yicha: har o'quvchida (ustoz stavkasi / oylik reja) × qoplansa hisobga o'tadigan darslar.
    function lossSum(user, m) {
        if (!m || typeof calculateKpiSalary !== 'function') return null;
        const own = typeof resolveTeacherWithVirtual === 'function' ? resolveTeacherWithVirtual(user.linkedTeacherId) : null;
        if (!own || own.type === 'yordamchi') return null;
        const list = ownMain(user.linkedTeacherId);
        let kpi = null;
        try { kpi = list.length ? calculateKpiSalary(own, m.month, getItem(STORAGE_KEYS.mainAttendance, {}), list) : null; } catch { kpi = null; }
        if (!kpi || !(kpi.expected > 0)) return null;
        const per = new Map((kpi.perStudent || []).map(p => [p.id, p]));
        let sum = 0;
        for (const [sid, x] of m.by) {
            const p = per.get(sid); if (!p || !x.open.length) continue;
            const room = Math.max(0, kpi.expected - (Number(p.lessons) || 0));
            sum += (Number(p.maxEarned) || 0) / kpi.expected * Math.min(x.open.length, room);
        }
        return Math.round(sum / 100) * 100;
    }

    function missedText(m) {
        const rows = [...m.by.values()].filter(x => x.open.length).sort((a, b) => b.open.length - a.open.length);
        const parts = rows.slice(0, 3).map(x => {
            const base = x.open.length >= 3 ? `${first(x.student.name)} ${x.open.length}`
                : `${first(x.student.name)} ${x.open.map(d => Number(d.slice(8))).join(', ')}-${MON3[Number(x.open[0].slice(5, 7)) - 1]}`;
            const pl = x.planned.filter(p => p.held).map(p => `${dm(p.missed)} → ${DAY[wd(p.held) - 1]} ${Number(p.held.slice(8))}`);
            return base + (pl.length ? ` (${pl.join(', ')} rejada)` : '');
        });
        if (rows.length > 3) parts.push(`yana ${rows.length - 3} ta`);
        const [y, mo] = m.month.split('-').map(Number);
        const left = new Date(Date.UTC(y, mo, 0)).getUTCDate() - Number(m.today.slice(8));
        parts.push(left > 0 ? `oy tugashiga ${left} kun` : 'bugun oyning oxirgi kuni');
        return parts.join(' · ');
    }

    // ── E'tibor kerak (schoolCheck.js: ilovada nofaol / qiynalyapti / rejadan orqada) ──
    const flagKeys = s => new Set((s.flags || []).map(f => f.key));
    async function attention() {
        const lang = window.LessonStart?.teacherLang ? window.LessonStart.teacherLang() : 'english';
        const ov = await apiFetch(`/api/academic/students?lang=${lang}`, { timeout: 30000 });
        return (ov.students || []).filter(s => s.role === 'main' && ['idle', 'struggling', 'behind'].some(k => flagKeys(s).has(k)));
    }
    function attentionText(list) {
        const idle = list.filter(s => flagKeys(s).has('idle'));
        const strug = list.filter(s => !flagKeys(s).has('idle') && flagKeys(s).has('struggling'));
        const behind = list.filter(s => !flagKeys(s).has('idle') && !flagKeys(s).has('struggling'));
        const out = [];
        if (idle.length === 1) out.push(`${first(idle[0].name)} ${idle[0].daysIdle == null ? 'ilovaga kirmagan' : `${idle[0].daysIdle} kundan beri faol emas`}`);
        else if (idle.length) out.push(`${andJoin(idle.map(s => first(s.name)))} ilovada faol emas`);
        if (strug.length) out.push(`${andJoin(strug.map(s => first(s.name)))} uy vazifasida qiynalyapti`);
        if (behind.length) out.push(`${andJoin(behind.map(s => first(s.name)))} rejadan orqada`);
        return out.join(' · ');
    }
    function openCheck(list) {
        const reasons = new Set(list.flatMap(s => ['idle', 'struggling', 'behind'].filter(k => flagKeys(s).has(k))));
        if (window.schoolCheck?.state) Object.assign(window.schoolCheck.state, { ctx: 'main', q: '', more: false, filter: reasons.size === 1 ? [...reasons][0] : 'all', sel: list[0]?.id || '' });
        if (typeof switchTab === 'function') switchTab('teachers-section');
        if (typeof switchTeachersSection === 'function') switchTeachersSection('cabinet');
    }

    // "Bajarish kerak" ro'yxatiga qo'shiladigan bandlar (schoolTeacher.homeExtras chizadi).
    async function todoItems(user = me(), makeupsP = null) {
        const mk = makeupsP ? await Promise.resolve(makeupsP).catch(() => null) : null;
        const [m, att] = await Promise.all([missed(user, { makeups: mk ? mk.makeups || [] : null }).catch(() => null), attention().catch(() => null)]);
        const items = [];
        if (m) {
            const open = [...m.by.values()].reduce((n, x) => n + x.open.length, 0);
            const planned = [...m.by.values()].reduce((n, x) => n + x.planned.length, 0);
            if (open) {
                if (mk) globalThis.__schoolMakeups = mk.makeups || [];
                const loss = lossSum(user, m);
                const top = [...m.by.values()].filter(x => x.open.length).sort((a, b) => b.open.length - a.open.length)[0];
                items.push({ ic: 'sync', t: `${open} ta qoplanmagan dars${planned ? ` (${planned} tasi rejada)` : ''}${loss ? ` · ≈ ${num(loss)} so'm` : ''}`,
                    s: missedText(m), btn: "Qoplash qo'yish",
                    act: () => {
                        const done = () => { try { if (typeof renderDashboardOverview === 'function') renderDashboardOverview(_lastDashboardOverviewArgs || {}); } catch { /* */ } };
                        if (window.schoolSchedule?.makeupDrawer) window.schoolSchedule.makeupDrawer(done, { studentId: top?.student.id });
                        else if (typeof switchTab === 'function') switchTab('timetable');
                    } });
            }
        }
        if (att && att.length) items.push({ ic: 'att', t: `${att.length} o'quvchiga e'tibor kerak`, s: attentionText(att), btn: "Ko'rish", act: () => openCheck(att) });
        return items;
    }

    // ── Reyting ─────────────────────────────────────────────────────────────
    const f1 = v => (Number(v) || 0).toFixed(1);
    // ▲/▼ — ball o'zgarishi o'tgan oyga nisbatan; title — o'tgan oydagi o'rin.
    function delta(r, prevRank = r.prevRank) {
        if (r.prevScore == null) return '<span class="uh-dl" title="O\'tgan oyda reytingda yo\'q">—</span>';
        const d = Math.round((Number(r.score) - Number(r.prevScore)) * 10) / 10;
        const rk = prevRank != null && prevRank !== r.rank ? ` · o'rin ${prevRank} → ${r.rank}` : prevRank != null ? ` · o'rin o'zgarmadi (${prevRank})` : '';
        const title = `O'tgan oy: ${prevRank != null ? prevRank + "-o'rin, " : ''}${f1(r.prevScore)} ball${rk}`;
        if (!d) return `<span class="uh-dl" title="${esc(title)}">—</span>`;
        return `<span class="uh-dl ${d > 0 ? 'up' : 'dn'}" title="${esc(title)}">${d > 0 ? '▲' : '▼'}${f1(Math.abs(d))}</span>`;
    }
    function ratingCard(data, now = new Date()) {
        const rows = data?.rows || [], selfId = data?.selfId, own = rows.find(r => r.id === selfId);
        const kind = data?.ownType === 'yordamchi' ? 'yordamchi ustozlar' : 'asosiy ustozlar';
        const LIMIT = 6;
        const shown = rows.filter(r => r.rank <= LIMIT || r.id === selfId);
        const list = shown.map((r, i) => `${i && r.rank - shown[i - 1].rank > 1 ? '<li class="uh-rk-gap" aria-hidden="true">…</li>' : ''}<li${r.id === selfId ? ' class="me" aria-current="true"' : ''}><span class="n">${r.rank}</span><span class="nm">${r.id === selfId ? `<b>${esc(r.name)} (siz)</b>` : esc(r.name)}</span><span class="sc">${f1(r.score)}</span>${delta(r)}</li>`).join('');
        let fx = '';
        if (own) {
            const parts = own.learnPct != null
                ? `Ball = davomat ${own.davomatPct}% × 60% + o'quvchilar o'zlashtirishi (uy vazifasi, 1-urinish) ${own.learnPct}% × 40%.`
                : `Ball = davomat ${own.davomatPct}% (o'zlashtirish bo'yicha ilova ma'lumoti hali yo'q — ball faqat davomatdan).`;
            const above = rows.find(r => r.rank === own.rank - 1);
            const gap = above ? Math.max(0.1, Math.round((above.score - own.score) * 10) / 10) : null;
            const below = rows.find(r => r.rank === own.rank + 1);
            const tail = above ? ` ${own.rank - 1}-o'ringa <b>${f1(gap)} ball</b> qoldi.`
                : below ? ` Siz 1-o'rindasiz — 2-o'rindan <b>${f1(Math.max(0, Math.round((own.score - below.score) * 10) / 10))} ball</b> oldinda.` : ' Siz 1-o\'rindasiz.';
            fx = `<p class="uh-fx">${parts}${tail}</p>`;
        } else fx = '<p class="uh-fx">Ball = davomat × 60% + o\'quvchilar o\'zlashtirishi (uy vazifasi, 1-urinish) × 40%. Darslar belgilangach o\'rningiz chiqadi.</p>';
        return `<div class="ahx-card-h uh-rk-h"><h3>Ustozlar reytingi · ${esc(MONTHS[now.getMonth()])}</h3><span>${kind}</span></div>
            ${list ? `<ol class="uh-rk">${list}</ol>` : '<p class="dashboard-empty">Hali maʻlumot yoʻq</p>'}${fx}`;
    }

    // ── Bosh sahifa "Bugun": joriy yoki keyingi dars qatorida "Boshlash" ─────
    async function decorateToday(container) {
        const LS = window.LessonStart; if (!LS || !container) return;
        const rows = [...container.querySelectorAll('[data-thx-today] > li[data-thx-sid]')].filter(r => r.dataset.thxDuty !== 'assistant');
        const cur = rows.find(r => r.dataset.thxSt === 'now') || rows.find(r => r.dataset.thxSt === 'wait');
        if (!cur || cur.querySelector('[data-uh-start]')) return;
        const sid = cur.dataset.thxSid;
        cur.classList.add('tch-row--cur');
        let acts = cur.querySelector('.tch-row-actions');
        if (!acts) { acts = document.createElement('div'); acts.className = 'tch-row-actions'; cur.appendChild(acts); }
        acts.querySelectorAll('.uhb-pill').forEach(p => p.remove()); // dizayn: joriy qatorda pill o'rnida Boshlash
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'sc-btn sc-btn--pri uhb-start'; b.dataset.uhStart = sid; b.textContent = 'Boshlash';
        b.setAttribute('aria-label', `${cur.querySelector('strong')?.textContent || ''} — darsni boshlash`);
        b.onclick = () => LS.start({ studentId: sid, studentName: cur.querySelector('strong')?.textContent || '', duration: Number(cur.dataset.thxDur) || null })
            .catch(e => (typeof showMiniToast === 'function' ? showMiniToast(e.message, 3200) : null));
        acts.insertBefore(b, acts.firstChild);
        try {
            const t = await LS.loadToday();
            const it = t?.items.find(i => i.studentId === sid);
            const sub = cur.querySelector('.mot-prize-note');
            if (it?.lessonNo && sub && !sub.dataset.uhLesson) { sub.dataset.uhLesson = '1'; sub.textContent = `${Number(cur.dataset.thxDur) || 15} daq · ${it.lessonNo}-dars, jonli`; }
        } catch { /* dars raqamisiz qoladi */ }
    }

    // ── Maosh kartasi: "73 keldi · 16 kelmadi · 1 belgilanmagan = o'tgan 90 · +2 qoplash → 75 hisobga o'tdi · oy rejasi 108 dars"
    // Hisob — teacherDutyUI.monthTotals (Akademik → Davomat "Oktyabr" kartasi bilan bitta manba). Faqat o'qiydi.
    async function decoratePlan(container, user = me()) {
        const T = window.teacherDutyUI?.monthTotals, home = container?.querySelector('#teacherHome');
        const foot = home?.querySelector('#kbxThPlan')?.closest('.kbx-plan')?.querySelector('.kbx-bar-foot');
        const tid = user.linkedTeacherId; if (!T || !foot || !tid) return;
        const td = today(), month = td.slice(0, 7);
        const [ab, mk] = await Promise.all([school('/attendance/absences?month=' + month).catch(() => ({ absences: [] })),
            school('/makeups').then(r => r.makeups || []).catch(() => [])]);
        if (!foot.isConnected) return;
        const block = (getItem(STORAGE_KEYS.mainAttendance, {}) || {})[`${month}_${tid}`] || {};
        const own = typeof resolveTeacherWithVirtual === 'function' ? resolveTeacherWithVirtual(tid) || {} : {};
        const t = T({ id: tid, month, students: ownMain(tid), mainAtt: window.teacherDutyUI.mergeAbsences(block, ab.absences, tid), makeups: mk, teacher: own, todayKey: td });
        if (!t.plan) return;
        const [l, r] = foot.children;
        l.innerHTML = `<strong>${t.came}</strong> keldi · <strong>${t.absent}</strong> kelmadi · <strong>${t.unmarked}</strong> belgilanmagan = o'tgan ${t.expected}${t.approved ? ` · +${t.approved} qoplash` : ''} → <strong>${t.counted}</strong> hisobga o'tdi`;
        if (r) r.textContent = `oy rejasi ${t.plan} dars`;
        if (t.pct == null) return;
        const card = foot.closest('.kbx-plan'), pill = card.querySelector('.kbx-plan-h .kbx-pill'), bar = card.querySelector('.kbx-bar');
        if (pill) { pill.textContent = `Davomat ${t.pct}%`; pill.className = `kbx-pill kbx-pill--${t.pct >= 90 ? 'ok' : 'warn'}`; }
        if (bar) { bar.querySelector('i').style.width = t.pct + '%'; bar.setAttribute('aria-label', `Davomat ${t.pct}%`); }
    }

    // Ustozning o'z maoshi — server payroll (/api/payroll/me). Bosh sahifa va Davomat shu bitta javobni ko'rsatadi
    // ("Mening maoshim" /api/staff/salary ham xuddi shu payroll.calculate qatorini oladi). Qisqa kesh — ortiqcha so'rov bo'lmasin.
    let payCache = null;
    function myPay(force = false) {
        if (force || !payCache || Date.now() - payCache.t > 30000) {
            payCache = { t: Date.now(), p: apiFetch('/api/payroll/me', { timeout: 30000 }) };
            payCache.p.catch(() => { payCache = null; });
        }
        return payCache.p;
    }

    window.UstozHome = { myPay, decoratePlan, missed, lossSum, missedText, attention, attentionText, todoItems, ratingCard, delta, decorateToday, f1, today, dm, DAY, wd };
})();
