// Ustoz ilovasi v2 — Davomat bo'limi (kanvas "Ustoz · yakuniy": H1/H1t/H1j, F2–F6, L0–L3).
// Mantiq manbasi — teacher/app.js (openMark, renderDavomat, openQoplash, outbox) va server qoidalari
// (server/services/teacherAttendanceRules.js): kelajakka belgi yo'q, bugun — dars boshlanishidan 15 daqiqa oldin,
// muzlagan / chiqib ketgan kunga yo'q, yopilgan oyni faqat admin tuzatadi.
// Ma'lumot: S.state.mainAttendance ("Keldi"), GET /api/school/attendance/absences ("Kelmadi" + sabab), S.makeups (qoplash).
(function () {
    'use strict';
    const U = window.U, D = () => window.DWT;
    if (!U) return;

    // Davomat qulfi shu sanadan boshlab ishlaydi (undan oldingi kunlar qulfga kirmaydi). L0 dagi "Yangi qoida · 18-noyabrdan".
    const QULF_FROM = '2026-11-18';
    const MARK_BEFORE = 15; // server TEACHER_MARK_BEFORE_MIN bilan bir xil
    const INTRO_KEY = 'dwt_dv_intro', FLT_KEY = 'dwt_dv_flt';
    // Dizayndagi 5 sabab → server kodlari (server/db.js ABSENCE_REASONS). Eski yozuvlar: other + "Ogohlantirmadi · ..." izohi ham tan olinadi.
    const REASONS = [['nowarn', 'Ogohlantirmadi', 'nowarn'], ['sick', 'Kasal', 'sick'], ['travel', 'Uzrli sabab', 'travel'], ['noanswer', "Aloqa bo'lmadi", 'noanswer'], ['other', 'Boshqa', 'other']];
    const ICO = {
        prev: '<path d="M15 6l-6 6 6 6"></path>', next: '<path d="M9 6l6 6-6 6"></path>',
        ok: '<path d="M5 12l5 5L20 7"></path>', x: '<path d="M6 6l12 12M18 6L6 18"></path>',
        lock: '<rect x="4" y="10.5" width="16" height="10.5" rx="3"></rect><path d="M8 10.5V7.5a4 4 0 018 0v3"></path><path d="M12 15v2"></path>',
        open: '<rect x="4" y="10.5" width="16" height="10.5" rx="3"></rect><path d="M8 10.5V7.5a4 4 0 017.6-1.8"></path>',
        clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>'
    };
    const esc = s => U.esc(s);
    const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';
    const monName = m => D().MON[+m.slice(5) - 1];
    const dayShort = date => D().DAY[D().wdOf(date) - 1];
    const dayFull = date => D().DAY_FULL[D().wdOf(date) - 1];
    const dLong = date => `${dayFull(date)}, ${+date.slice(8)}-${monName(date.slice(0, 7))}`;
    const dur = s => Number(s.lessonDuration) || 30;
    const startOf = s => D().toMin(s.lessonTime);

    let month = null;                      // ko'rsatilayotgan oy
    let flt = (D()?.store?.get(FLT_KEY, 'all')) || 'all';
    const local = new Map();               // shu sessiyada saqlangan belgilar (server javobi kelguncha ustun)
    const reasons = new Map();             // `${sid}|${date}` → { reasonCode, reasonNote }
    const scroll = {};                     // `${month}|${flt}` → scrollLeft

    // ── Ma'lumot: "Kelmadi" belgilari va telefonda navbatdagi belgilar holatga qo'shiladi ──
    const absEntry = m => U.load('dv-abs:' + m, () => D().api(`/api/school/attendance/absences?month=${m}`), { ttl: 5 * 60000 });
    function sync(m) {
        const d = D(), S = d.S; if (!S.state || !S.me) return null;
        const e = absEntry(m);
        for (const a of e.data?.absences || []) {
            if (a.teacherId && a.teacherId !== S.me.id) continue;
            const date = String(a.day || '').slice(0, 10), s = d.stuOf(a.studentId);
            if (!s || date.slice(0, 7) !== m) continue;
            if (a.reasonCode) reasons.set(`${a.studentId}|${date}`, { reasonCode: a.reasonCode, reasonNote: a.reasonNote || '' });
            if (d.markOf(s, date) === 'empty') d.setAtt(a.studentId, date, 0);
        }
        for (const o of d.outbox()) { const b = o.body || {}; if (String(b.date || '').startsWith(m)) d.setAtt(b.studentId, b.date, b.present === null ? null : b.present ? 1 : 0); }
        for (const [k, v] of local) { const [sid, date] = k.split('|'); if (date.startsWith(m)) d.setAtt(sid, date, v); }
        return e;
    }
    const today = () => D().now();
    const curMonth = () => today().month;

    // ── Holat qoidalari ──
    const inactiveOf = s => (D().S.inactive || []).find(x => x.id === s.id) || null;
    function countsOn(s, date) { // shu kuni dars hisoblanadimi (kurs boshlangan, muzlatilmagan, chiqib ketmagan)
        const sd = String(s.startDate || s.joinDate || '').slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(sd) && date < sd) return false;
        const ie = inactiveOf(s);
        if (ie) {
            const from = String(ie.from || '').slice(0, 10), to = String(ie.to || '').slice(0, 10);
            if (ie.state === 'frozen') { if ((!from || date >= from) && (!to || date <= to)) return false; }
            else if (['left', 'moved', 'finished'].includes(ie.state)) { if (!from || date >= from) return false; }
        } else if (s.frozen) return false;
        return true;
    }
    const isLesson = (s, date) => D().patternOf(s).includes(D().wdOf(date));
    const heldOn = (s, date) => (D().S.makeups || []).find(m => m.student_id === s.id && D().day10(m.held_date) === date && m.status !== 'rejected');
    const covered = (s, date) => D().coveredBy(s, date);
    function cell(s, date) {
        const n = today(), st = D().markOf(s, date);
        if (st === 'present') return 'g';
        if (st === 'absent') return covered(s, date) ? 'b' : 'r';
        if (!countsOn(s, date)) return 'x';
        if (date > n.date) return 'f';
        if (date === n.date) { const a = startOf(s); return a != null && n.min < a + dur(s) ? 'f' : 'y'; }
        return 'y';
    }
    const TITLE = { g: 'Keldi', r: 'Kelmadi', b: 'Qoplangan', y: 'Belgilanmagan', f: 'Oldinda', x: 'Hisoblanmaydi' };
    // Belgi qo'yish mumkinmi (server qoidasi). null — mumkin, aks holda sabab matni.
    function blockReason(s, date) {
        const n = today();
        if (date.slice(0, 7) < n.month) return `${cap(monName(date.slice(0, 7)))} yopilgan — tuzatish admin orqali`;
        if (!countsOn(s, date)) return s.frozen || inactiveOf(s)?.state === 'frozen' ? "O'sha kuni o'quvchi muzlatilgan — davomat qo'yilmaydi" : "O'sha kuni o'quvchi faol emas — davomat qo'yilmaydi";
        if (date > n.date) return "Kelajakdagi darsga davomat qo'yilmaydi";
        if (date === n.date) { const a = startOf(s); if (a != null && n.min < a - MARK_BEFORE) return `Dars hali boshlanmagan — davomat ${D().hm(Math.max(0, a - MARK_BEFORE))} dan qo'yiladi`; }
        return null;
    }
    // Ro'yxat: faol o'quvchilar (toq → juft → yakshanba, vaqt bo'yicha), oxirida muzlagan / chiqib ketganlar (kulrang).
    function roster(m) {
        const d = D(), S = d.S, me = S.me?.id;
        const grp = s => { const p = d.patternOf(s); return p[0] === 1 ? 0 : p[0] === 2 ? 1 : 2; };
        const sort = (a, b) => grp(a) - grp(b) || (startOf(a) ?? 9999) - (startOf(b) ?? 9999) || String(a.name).localeCompare(String(b.name));
        const first = `${m}-01`;
        const isOut = s => !!s.frozen || ['frozen', 'left', 'moved', 'finished'].includes(inactiveOf(s)?.state);
        const main = S.main.slice();
        // Shu oyda chiqib ketgan / boshqa ustozga o'tgan o'quvchilar ham oy oxirigacha ko'rinadi.
        for (const x of S.inactive || []) {
            if (main.some(s => s.id === x.id) || !['left', 'moved', 'finished'].includes(x.state)) continue;
            const s = d.stuOf(x.id); if (!s || String(x.from || '').slice(0, 10) < first) continue;
            if (s.teacherId === me || Object.keys(d.attFor(s.id, m)).length) main.push(s);
        }
        const act = main.filter(s => !isOut(s)).sort(sort), out = main.filter(isOut).sort(sort);
        return { act, out, all: [...act, ...out] };
    }
    function stats(s, m) {
        const days = D().lessonDays(s, m).map(c => c.date);
        const c = { g: 0, r: 0, b: 0, y: 0, f: 0, x: 0 };
        for (const date of days) c[cell(s, date)]++;
        const approved = (D().S.makeups || []).filter(x => x.student_id === s.id && D().day10(x.missed_date).slice(0, 7) === m && x.status === 'approved').length;
        return { ...c, plan: days.length, counted: Math.min(days.length, c.g + approved) };
    }
    const pending = m => roster(m).act.reduce((a, s) => a + D().lessonDays(s, m).filter(c => cell(s, c.date) === 'y').length, 0);
    // Qoplanmagan "Kelmadi" darslar (shu oy, berilgan kungacha) — DWT.uncovered bilan bir xil qoida.
    const missedFor = (s, upto) => D().uncovered(s, upto.slice(0, 7)).filter(x => x <= upto);

    // ── Saqlash (davomat) — internet yo'q bo'lsa telefonda navbat (eski ilova bilan bir xil outbox) ──
    async function saveMark(s, date, present, extra = {}) {
        const d = D(), S = d.S;
        const body = { teacherId: S.me.id, studentId: s.id, date, present, attendanceType: 'main', requireReason: true, ...extra };
        const apply = () => { d.setAtt(s.id, date, present === null ? null : present ? 1 : 0); local.set(`${s.id}|${date}`, present === null ? null : present ? 1 : 0); if (present === false && extra.reasonCode) reasons.set(`${s.id}|${date}`, { reasonCode: extra.reasonCode, reasonNote: extra.reasonNote || '' }); };
        try {
            await d.api('/api/state/teacher-attendance', { method: 'POST', body });
            apply(); U.drop('dv-abs:' + date.slice(0, 7));
            return 'ok';
        } catch (err) {
            if (err.network) {
                const label = `${d.first(s.name)} · ${d.fmtDate(date)} · ${present ? 'Keldi' : 'Kelmadi'}`;
                d.store.set(d.OUTBOX, [...d.outbox().filter(o => !(o.body.studentId === s.id && o.body.date === date)), { body, label, at: Date.now() }]);
                apply(); return 'queued';
            }
            throw err;
        }
    }
    // Pastdan oyna: ichki sahifa (F2) va qulf ustida ham ko'rinsin.
    function sheet(html, bind, label, gap = 14) {
        return U.sheet(html, (el, close) => {
            el.classList.add('dv-top'); el.previousElementSibling?.classList.add('dv-top'); el.style.gap = gap + 'px';
            bind(el, close);
        }, { label });
    }
    const dch = (date, cls) => `<span class="dv-dch ${cls}"><b>${+date.slice(8)}</b><small>${dayShort(date)}</small></span>`;
    const head = (s, date, cls, title, sub) => `<div class="row">${dch(date, cls)}<div class="col g1"><h2 style="font-size: 19px; font-weight: 800">${title}</h2><span class="s">${sub}</span></div>${D().avatar(s, 'av" style="width: 40px; height: 40px')}</div>`;
    const missRow = (date, on) => `<button type="button" class="opt dv-opt${on ? ' on' : ''}" aria-pressed="${on}" data-miss="${date}" style="min-height: 50px"><span class="rad" aria-hidden="true"></span><span class="dv-mx">${+date.slice(8)}<i></i></span><b style="font-size: 14px">${dLong(date)}</b></button>`;

    // ── F3 / F3b / F4 — dars kuni: Keldi / Kelmadi ──
    function openLesson(s, date, { mode = null, onDone = null } = {}) {
        const d = D(), n = today();
        const cur = d.markOf(s, date), a = startOf(s), L = dur(s);
        const rs = reasons.get(`${s.id}|${date}`);
        let pick = mode || (cur === 'present' ? 'p' : cur === 'absent' ? 'a' : null);
        let onTime = true, from = a != null ? d.hm(a) : '', to = a != null ? d.hm(a + L) : '';
        let reason = cur === 'absent' && rs ? (rs.reasonCode === 'other' && /^Ogohlantirmadi/.test(rs.reasonNote) ? 'nowarn' : REASONS.find(r => r[2] === rs.reasonCode)?.[0] || null) : null;
        let note = rs ? String(rs.reasonNote || '').replace(/^Ogohlantirmadi\s*·?\s*/, '') : '';
        let dbl = false, dMiss = null, busy = false;
        const miss = missedFor(s, date).filter(x => x < date);
        const sub = `${dLong(date)} · ${esc(s.lessonTime || '')} · ${L} daq`;
        const dcls = () => ({ g: 'g', r: 'r', b: 'b', y: 'y', f: 'y', x: 'x' })[cell(s, date)]; // saqlangan holat (dizayn F3: belgilanmagan — sariq)
        sheet('<div class="dv-sh" style="display: contents"></div>', (el, close) => {
            const box = el.querySelector('.dv-sh');
            const tmin = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v).trim()); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
            function timeHint() {
                const f = tmin(from), t = tmin(to);
                if (f == null || t == null) return `<span class="xs" style="color: #B42318; font-weight: 700">Vaqtni SS:DD ko'rinishida yozing (masalan 11:10)</span>`;
                if (t <= f) return `<span class="xs" style="color: #B42318; font-weight: 700">Tugash vaqti boshlanishdan keyin bo'lsin</span>`;
                const m = t - f;
                return m === L ? `<span class="xs" style="color: #067647; font-weight: 700">${m} daqiqa · to'liq</span>` : `<span class="xs" style="color: #B54708; font-weight: 700">${m} daqiqa o'tildi (${L} o'rniga) · admin ko'radi</span>`;
            }
            const valid = () => pick === 'p' ? (onTime || (tmin(from) != null && tmin(to) != null && tmin(to) > tmin(from))) && (!dbl || dMiss) : pick === 'a' ? !!reason : false;
            function draw() {
                if (dbl && miss.length === 1) dMiss = miss[0];
                box.innerHTML = `${head(s, date, dcls(), esc(d.first(s.name)), sub)}
                  <div class="dv-bg2"><button type="button" data-pk="p" class="${pick === 'p' ? 'og' : ''}" aria-pressed="${pick === 'p'}">${U.svg(ICO.ok, 18, 3.5)}Keldi</button><button type="button" data-pk="a" class="${pick === 'a' ? 'orr' : ''}" aria-pressed="${pick === 'a'}">${U.svg(ICO.x, 18, 3.5)}Kelmadi</button></div>
                  ${pick === 'p' ? `<div class="dv-tb"><span class="dv-st">VAQTIDA O'TDIMI?${onTime && a != null ? ` · ${d.hm(a)} – ${d.hm(a + L)}` : ''}</span><div class="seg dv-seg44" style="background: #E9EEF6"><button type="button" data-ot="1" class="${onTime ? 'on' : ''}">Ha, vaqtida</button><button type="button" data-ot="0" class="${onTime ? '' : 'on'}">Yo'q, boshqacha</button></div>
                      ${onTime ? '' : `<div class="dv-tt"><label for="dv-t1">Boshlandi<input id="dv-t1" inputmode="numeric" maxlength="5" autocomplete="off" value="${esc(from)}"></label><label for="dv-t2">Tugadi<input id="dv-t2" inputmode="numeric" maxlength="5" autocomplete="off" value="${esc(to)}"></label></div><span class="dv-th">${timeHint()}</span>`}</div>
                    ${miss.length ? (dbl ? `<div class="dv-dbl"><div class="between" style="display: flex; justify-content: space-between; align-items: center"><span class="dv-st">QOPLASH · QAYSI DARS O'RNIGA?</span><button type="button" class="dv-lnk" data-dbl="0">Bekor</button></div>
                        ${miss.length > 1 ? `<div class="col" style="gap: 6px">${miss.slice().reverse().map(x => missRow(x, x === dMiss)).join('')}</div>` : `<span class="s">${dLong(miss[0])} darsi o'rniga · shu kuni 2 dars o'tildi</span>`}</div>`
                      : `<button type="button" class="btn w dv-addq" data-dbl="1">+ Shu kuni qoplash darsi ham o'tdim</button>`) : ''}` : ''}
                  ${pick === 'a' ? `<span class="dv-st">SABABI</span>
                    <div class="chips" style="flex-wrap: wrap">${REASONS.map(([k, l]) => `<button type="button" class="chip${reason === k ? ' on' : ''}" data-rs="${k}" aria-pressed="${reason === k}">${l}</button>`).join('')}</div>
                    <div class="fl"><label for="dv-iz">Izoh · ixtiyoriy</label><textarea id="dv-iz" maxlength="300" placeholder="Masalan: telefonni ko'tarmadi">${esc(note)}</textarea></div>
                    <div class="note i" style="padding: 10px 12px"><span>Bu darsni ${monName(date.slice(0, 7))} ichida qoplasangiz, katak <b style="color: #1570EF">ko'k</b> bo'ladi va hisobga o'tadi.</span></div>` : ''}
                  <button type="button" class="btn p w" data-save style="height: 54px; font-size: 16px"${valid() && !busy ? '' : ' disabled'}>${busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
                  ${pick === 'p' && onTime ? `<span class="xs" style="text-align: center">Darsni ilovada "Boshlash" bilan ochsangiz vaqt o'zi yoziladi — bu savol chiqmaydi</span>` : ''}
                  ${!pick ? `<span class="xs" style="text-align: center">${n.date === date ? 'Bugungi dars' : 'O\'tgan dars'} · Keldi yoki Kelmadi ni tanlang</span>` : ''}`;
                box.querySelectorAll('[data-pk]').forEach(b => b.onclick = () => { pick = b.dataset.pk; draw(); });
                box.querySelectorAll('[data-ot]').forEach(b => b.onclick = () => { onTime = b.dataset.ot === '1'; draw(); });
                box.querySelectorAll('[data-dbl]').forEach(b => b.onclick = () => { dbl = b.dataset.dbl === '1'; if (!dbl) dMiss = null; draw(); });
                box.querySelectorAll('[data-miss]').forEach(b => b.onclick = () => { dMiss = b.dataset.miss; draw(); });
                box.querySelectorAll('[data-rs]').forEach(b => b.onclick = () => { reason = b.dataset.rs; draw(); });
                const iz = box.querySelector('#dv-iz'); if (iz) iz.oninput = () => { note = iz.value; };
                const upd = () => { from = box.querySelector('#dv-t1')?.value ?? from; to = box.querySelector('#dv-t2')?.value ?? to; box.querySelector('.dv-th').innerHTML = timeHint(); box.querySelector('[data-save]').disabled = !valid() || busy; };
                box.querySelectorAll('#dv-t1, #dv-t2').forEach(i => i.oninput = upd);
                box.querySelector('[data-save]').onclick = save;
            }
            async function save() {
                if (!valid() || busy) return;
                busy = true; draw();
                try {
                    let extra = {}, r;
                    if (pick === 'p') extra = onTime ? { heldFrom: '', heldTo: '' } : { heldFrom: d.hm(tmin(from)), heldTo: d.hm(tmin(to)) };
                    else { const rr = REASONS.find(x => x[0] === reason); extra = { reasonCode: rr[2], reasonNote: note.trim() }; }
                    r = await saveMark(s, date, pick === 'p', extra);
                    if (pick === 'p' && dbl && dMiss) {
                        if (r === 'queued') { U.toast("Internet yo'q — Keldi saqlandi, qoplashni ulanganda qo'shing"); close(); U.render(); onDone?.(); return; }
                        try {
                            const m = await d.api('/api/school/makeups/double', { method: 'POST', body: { studentId: s.id, missedDate: dMiss, heldDate: date } });
                            if (m.makeup) d.S.makeups.unshift(m.makeup);
                            close(); U.toast(`Keldi + qoplash (${d.fmtDate(dMiss)}) — hisobga o'tdi`, { ok: true }); U.render(); onDone?.(); return;
                        } catch (err) { close(); U.toast(`Keldi saqlandi. Qoplash: ${err.message}`); U.render(); onDone?.(); return; }
                    }
                    close();
                    U.toast(r === 'queued' ? "Internet yo'q — telefonda saqlandi, keyin yuboriladi" : pick === 'p' ? 'Keldi — saqlandi' : 'Kelmadi — saqlandi', { ok: r !== 'queued' });
                    U.render(); onDone?.();
                } catch (err) { busy = false; draw(); U.toast(err.message); }
            }
            draw();
        }, `${s.name} · ${dLong(date)}`);
    }

    // ── F5 / F6 — dars yo'q kun: qoplash darsi (POST /api/school/makeups/separate, darhol hisobga o'tadi) ──
    const schCache = new Map(); // kun → { data, err } (oyna ichida — U.load oyna ochiq paytda ekranni qayta chizmaydi)
    function busyItems(date) {
        const e = schCache.get(date) || {};
        const me = D().S.me?.id;
        const views = (e.data?.views || []).filter(v => (!v.date || v.date === date) && (!v.teacherId || !me || v.teacherId === me));
        const items = views.flatMap(v => (v.items || []).filter(i => Number.isFinite(i.start) && Number.isFinite(i.end)));
        return { e, items, work: views[0]?.work || null };
    }
    const itemLabel = i => i.kind === 'lesson' ? `${D().first(i.studentName || D().stuOf(i.studentId)?.name || '')} darsi`.trim() : i.kind === 'trial' ? 'Sinov' : i.kind === 'makeup' ? 'Qoplash' : i.kind === 'break' ? 'Tanaffus' : 'Band';
    function openMakeup(s, date) {
        const d = D(), n = today(), L = dur(s);
        const miss = missedFor(s, date);
        if (!miss.length) {
            const had = d.lessonDays(s, date.slice(0, 7)).some(c => d.markOf(s, c.date) === 'absent');
            const txt = had ? `${esc(d.first(s.name))}ning ${monName(date.slice(0, 7))}dagi qoldirilgan darslari${date < n.date ? ' shu kungacha' : ''} qoplangan.` : `${esc(d.first(s.name))} ${monName(date.slice(0, 7))}da hamma darsga kelgan.`;
            return sheet(`<span class="dv-ok72">${U.svg(ICO.ok, 34, 2.6)}</span><h2 style="font-size: 20px; font-weight: 800">Qoplanadigan dars yo'q</h2>
                <span class="s" style="font-size: 15px; line-height: 1.5">${txt} Qoplash faqat shu oyda qoldirilgan dars o'rniga qo'shiladi.</span>
                <button type="button" class="btn p w" data-u-close style="height: 52px">Tushunarli</button>`, el => { el.classList.add('dv-center'); }, "Qoplanadigan dars yo'q");
        }
        let missed = miss[0], time = null, other = false, otherV = '', full = true, busy = false;
        const base = startOf(s) ?? 9 * 60;
        sheet('<div class="dv-sh" style="display: contents"></div>', (el, close) => {
            const box = el.querySelector('.dv-sh');
            const tmin = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v).trim()); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
            const clash = (t, items) => items.find(i => t < i.end && t + L > i.start);
            const future = t => date === n.date && t + L > n.min;
            function slots(items, work) {
                const lo = work?.length ? Math.min(...work.map(w => w.start)) : 8 * 60, hi = work?.length ? Math.max(...work.map(w => w.end)) : 22 * 60;
                // Soatbay to'r + o'quvchining odatiy vaqti; unga eng yaqin 3 tasi. Band soat — yopiq (kim bilan bandligi yoziladi).
                const own = Math.round(base / 30) * 30, grid = new Set([own]);
                for (let t = Math.ceil(lo / 60) * 60; t + L <= hi; t += 60) grid.add(t);
                const near = [...grid].filter(t => t !== own).sort((x, y) => Math.abs(x - own) - Math.abs(y - own) || x - y);
                const ok = t => !clash(t, items) && !future(t);
                return [own, ...near.filter(ok), ...near.filter(t => !ok(t))].slice(0, 3).sort((x, y) => x - y);
            }
            function draw() {
                const { e, items, work } = busyItems(date);
                const list = e.data || e.err ? slots(items, work) : [];
                if (time != null && (clash(time, items) || future(time))) time = null;
                if (time == null && !other) time = list.find(t => !clash(t, items) && !future(t)) ?? null;
                const ov = tmin(otherV), oc = ov != null ? clash(ov, items) : null;
                const okTime = other ? ov != null && !oc && !future(ov) : time != null;
                const step = miss.length > 1 ? 1 : 0;
                box.innerHTML = `${head(s, date, 'q', `${esc(d.first(s.name))}ga qoplash darsi`, `${dLong(date)} · ${miss.length > 1 ? "dars yo'q kun" : `${+miss[0].slice(8)}-${monName(miss[0].slice(0, 7))} darsi o'rniga`}`)}
                  ${miss.length > 1 ? `<span class="dv-st">1 · QAYSI QOLDIRILGAN DARSNI O'TIB BERDINGIZ?</span><div class="col" style="gap: 6px">${miss.map(x => missRow(x, x === missed)).join('')}</div>` : ''}
                  <span class="dv-st">${step + 1} · SOAT NECHADA O'TDINGIZ?</span>
                  ${!e.data && !e.err ? '<div class="u-sk" style="height: 46px; flex: none"></div>' : `<div class="dv-tg3">${list.map(t => { const c = clash(t, items), fu = future(t); return `<button type="button" data-tm="${t}"${c || fu ? ' disabled' : ''} class="${!other && t === time ? 'on' : ''}" aria-pressed="${!other && t === time}">${D().hm(t)}${c ? `<small>${esc(itemLabel(c))}</small>` : fu ? '<small>hali</small>' : ''}</button>`; }).join('')}<button type="button" data-tm="other" class="${other ? 'on' : ''}" aria-pressed="${other}">Boshqa</button></div>`}
                  ${other ? `<div class="fl"><label for="dv-ot">Boshlangan vaqt (SS:DD)</label><input id="dv-ot" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="masalan 16:30" value="${esc(otherV)}"></div><span class="xs dv-oth" style="font-weight: 700; color: ${oc || (ov != null && future(ov)) ? '#B42318' : '#4B5563'}">${oc ? `Bu vaqtda ${esc(itemLabel(oc))} bor — boshqa vaqt tanlang` : ov != null && future(ov) ? 'Bu vaqt hali kelmadi' : 'Band soatlar tanlanmaydi'}</span>` : ''}
                  ${e.err ? `<span class="xs" style="color: #B54708">Kun jadvali yuklanmadi — band soatlar tekshirilmadi.</span>` : ''}
                  <span class="dv-st">${step + 2} · ${L} DAQIQA TO'LIQ BO'LDIMI?</span>
                  <div class="seg dv-seg44" style="background: #E9EEF6"><button type="button" data-full="1" class="${full ? 'on' : ''}" aria-pressed="${full}">Ha, ${L} daqiqa</button><button type="button" data-full="0" class="${full ? '' : 'on'}" aria-pressed="${!full}">Yo'q, kamroq</button></div>
                  <div class="note g" style="padding: 10px 12px"><span>Admin tasdig'i kerak emas — darhol hisobga o'tadi.</span></div>
                  <button type="button" class="btn p w" data-save style="height: 54px; font-size: 16px"${okTime && missed && !busy ? '' : ' disabled'}>${busy ? 'Saqlanmoqda…' : 'Qoplash darsini saqlash'}</button>`;
                box.querySelectorAll('[data-miss]').forEach(b => b.onclick = () => { missed = b.dataset.miss; draw(); });
                box.querySelectorAll('[data-tm]').forEach(b => b.onclick = () => { if (b.dataset.tm === 'other') { other = true; time = null; } else { other = false; time = +b.dataset.tm; } draw(); if (other) box.querySelector('#dv-ot')?.focus(); });
                box.querySelectorAll('[data-full]').forEach(b => b.onclick = () => { full = b.dataset.full === '1'; draw(); });
                const oi = box.querySelector('#dv-ot');
                if (oi) oi.oninput = () => { otherV = oi.value; const v = tmin(otherV), c = v != null ? clash(v, items) : null, h = box.querySelector('.dv-oth'); h.textContent = c ? `Bu vaqtda ${itemLabel(c)} bor — boshqa vaqt tanlang` : v != null && future(v) ? 'Bu vaqt hali kelmadi' : 'Band soatlar tanlanmaydi'; h.style.color = c || (v != null && future(v)) ? '#B42318' : '#4B5563'; box.querySelector('[data-save]').disabled = !(v != null && !c && !future(v)) || busy; };
                box.querySelector('[data-save]').onclick = async () => {
                    const t = other ? tmin(otherV) : time; if (t == null || !missed || busy) return;
                    busy = true; draw();
                    try {
                        const r = await d.api('/api/school/makeups/separate', { method: 'POST', body: { studentId: s.id, missedDate: missed, heldDate: date, heldTime: d.hm(t), full } });
                        if (r.makeup) d.S.makeups.unshift(r.makeup);
                        schCache.delete(date); close(); U.toast(`Qoplash saqlandi — ${d.fmtDate(missed)} darsi hisobga o'tdi`, { ok: true }); U.render();
                    } catch (err) { busy = false; draw(); U.toast(err.message); }
                };
            }
            draw();
            if (!schCache.get(date)?.data) d.api(`/api/school/schedule?from=${date}&to=${date}`)
                .then(r => schCache.set(date, { data: r })).catch(err => schCache.set(date, { err }))
                .finally(() => { if (el.isConnected) draw(); });
        }, `${s.name} · qoplash`, 12);
    }

    // Boshqa bo'limlar uchun (Bosh, DarsYakun): dars kuni → Keldi/Kelmadi; dars yo'q kun → qoplash.
    function openDay(studentId, date, opts = {}) {
        const d = D(), s = d.stuOf(studentId); if (!s || !date) return;
        sync(date.slice(0, 7));
        const n = today();
        if (isLesson(s, date)) {
            const why = blockReason(s, date);
            if (why) return U.toast(why);
            return openLesson(s, date, opts);
        }
        if (date.slice(0, 7) < n.month) return U.toast(`${cap(monName(date.slice(0, 7)))} yopilgan — qoplashni admin kiritadi`);
        if (date > n.date) return U.toast("Qoplash darsi o'tgandan keyin shu kunga kiritiladi");
        if (!countsOn(s, date)) return U.toast("O'sha kuni o'quvchi faol emas — qoplash qo'yilmaydi");
        return openMakeup(s, date);
    }
    U.davomat = { openDay, pending: () => (D()?.S?.state ? (sync(curMonth()), pending(curMonth())) : 0) };

    // ── H1 / H1t / H1j — oylik jadval ──
    const k2 = (s, date, isToday) => {
        const c = cell(s, date), q = heldOn(s, date) && c === 'g';
        return `<i class="dv-k2 ${c}${isToday ? ' now' : ''}">${+date.slice(8)}${q ? '<span class="dv-pq">+Q</span>' : ''}</i>`;
    };
    function columns(m, f, list) {
        const d = D(), days = d.cal.cells(m, []).filter(Boolean).map(c => c.date);
        const sun = list.some(s => d.patternOf(s).includes(7));
        const want = f === 'odd' ? [1, 3, 5] : f === 'even' ? [2, 4, 6] : null;
        return days.filter(x => { const w = d.wdOf(x); return want ? want.includes(w) : w !== 7 || sun; });
    }
    function renderTab() {
        const d = D(), S = d.S, n = today();
        month ||= n.month;
        sync(month);
        const r = roster(month);
        const inF = s => { const p = d.patternOf(s); return flt === 'all' || (flt === 'odd' ? p[0] === 1 : p[0] === 2); };
        const rows = r.all.filter(inF), outIds = new Set(r.out.map(s => s.id));
        const cols = columns(month, flt, rows);
        const tot = r.all.reduce((a, s) => { const x = stats(s, month); a.g += x.g; a.r += x.r; a.y += outIds.has(s.id) ? 0 : x.y; a.b += x.b; return a; }, { g: 0, r: 0, y: 0, b: 0 });
        const isCur = month === n.month, M = cap(monName(month));
        const prevM = d.shiftMonth(month, -1), nextM = d.shiftMonth(month, 1);
        const grid = rows.length ? rows.map(s => {
            const st = stats(s, month), pat = d.patternOf(s);
            return `<div class="dv-tr${outIds.has(s.id) ? ' out' : ''}"><a class="dv-nmc" href="#" data-u-push="dv-oy" data-arg="${esc(s.id)}" aria-label="${esc(s.name)} — oy kalendari">${d.avatar(s, '')}<span class="nn">${esc(d.first(s.name))}<small>${st.counted} / ${st.plan}</small></span></a>${cols.map(x => {
                const td = x === n.date ? ' td' : '';
                if (!pat.includes(d.wdOf(x))) return `<span class="dv-cw${td}"></span>`;
                const c = cell(s, x);
                return `<button type="button" class="dv-cw${td}" data-day="${esc(s.id)}|${x}" aria-label="${esc(d.first(s.name))}, ${+x.slice(8)}-${monName(month)} · ${TITLE[c]}">${k2(s, x, x === n.date)}</button>`;
            }).join('')}</div>`;
        }).join('') : `<div class="dv-empty">${S.main.length ? (flt === 'odd' ? "Toq kunlarda (Du·Ch·Ju) o'quvchi yo'q" : "Juft kunlarda (Se·Pa·Sh) o'quvchi yo'q") : "Hozircha asosiy o'quvchilar yo'q"}</div>`;
        return `<header class="hd" style="padding-bottom: 4px"><div class="t"><span class="date">${esc(U.dateLong(n.date))}</span><h1 style="font-size: 26px">Davomat · ${M}</h1></div>
            <div style="display: flex; gap: 6px"><button type="button" class="icb" data-mon="-1" aria-label="${cap(monName(prevM))}">${U.svg(ICO.prev, 18, 2.2)}</button><button type="button" class="icb" data-mon="1" aria-label="${cap(monName(nextM))}"${isCur ? ' disabled style="opacity: .4"' : ''}>${U.svg(ICO.next, 18, 2.2)}</button></div></header>
          <div class="bd" style="gap: 12px; padding-bottom: 110px">${U.offline()}
            <div class="sm2 a1"><div><b style="color: #067647">${tot.g}</b><span>keldi</span></div><div><b style="color: #B42318">${tot.r}</b><span>kelmadi</span></div><div${tot.y ? ' style="border-color: #FEC84B; background: #FFFAEB"' : ''}><b style="color: ${tot.y ? '#B54708' : '#0B1220'}">${tot.y}</b><span>belgilang</span></div><div><b style="color: #1570EF">${tot.b}</b><span>qoplangan</span></div></div>
            <nav class="dv-flt" aria-label="Kunlar filtri">${[['all', 'Hammasi'], ['odd', 'Toq kunlar'], ['even', 'Juft kunlar']].map(([k, l]) => `<button type="button" data-flt="${k}" class="${flt === k ? 'on' : ''}" aria-pressed="${flt === k}">${l}</button>`).join('')}</nav>
            <div class="dv-tbw a2" style="--cw: 46px"><div class="dv-mh"><b style="font-size: 14px">${M}</b><span class="xs">${isCur ? 'raqam — sana · bugun qora halqada' : "oy yopilgan · faqat ko'rish"}</span></div>${rows.length ? '<span class="dv-fade" aria-hidden="true"></span>' : ''}<div class="dv-sc" data-ti="${isCur ? Math.max(0, cols.findIndex(x => x >= n.date)) : cols.length - 1}">${grid}</div></div>
            <div class="dv-lgd2"><span><i style="background: #12B76A"></i>Keldi</span><span><i style="background: #F04438"></i>Kelmadi</span><span><i style="background: #FFFFFF; box-shadow: inset 0 0 0 2px #F79009"></i>Belgilang</span><span><i style="background: #2E90FA"></i>Qoplandi</span><span><i style="background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E2E8F0"></i>Oldinda</span><span><i style="background: repeating-linear-gradient(135deg, #E2E8F0 0 3px, #F8FAFC 3px 6px)"></i>Hisoblanmaydi</span></div>
            ${isCur ? todayCard() : ''}
            ${absEntry(month).err ? `<div class="note w" role="alert"><span>"Kelmadi" belgilari yuklanmadi — ular belgilanmagan bo'lib ko'rinishi mumkin.</span><button type="button" class="btn sm" data-u-retry="dv-abs:${month}" style="margin-left: auto">Qayta</button></div>` : ''}
          </div>`;
    }
    function todayCard() {
        const d = D(), n = today();
        const list = d.S.main.filter(s => isLesson(s, n.date) && countsOn(s, n.date) && startOf(s) != null).sort((a, b) => startOf(a) - startOf(b));
        const row = s => {
            const st = d.markOf(s, n.date), a = startOf(s), left = a - n.min;
            const can = !blockReason(s, n.date);
            const pill = st === 'present' ? '<span class="pill ok">Keldi</span>' : st === 'absent' ? (covered(s, n.date) ? '<span class="pill inf">Qoplandi</span>' : '<span class="pill bad">Kelmadi</span>')
                : can ? '<span class="pill wa">Belgilang</span>' : left <= 60 ? `<span class="pill mu">${left} daq qoldi</span>` : '<span class="pill mu">Kutilmoqda</span>';
            const inner = `<span class="tm">${d.hm(a)}</span><span class="nm g1">${esc(d.first(s.name))}</span>${pill}`;
            if (!can) return `<div class="li">${inner}</div>`;
            return st === 'empty' ? `<a class="li dv-due" href="#" data-day="${esc(s.id)}|${n.date}">${inner}</a>` : `<a class="li" href="#" data-day="${esc(s.id)}|${n.date}" style="color: #0B1220">${inner}</a>`;
        };
        return `<section class="card l a3"><div class="sh" style="padding: 12px 0 2px"><h2 style="font-size: 16px">Bugun · ${list.length} dars</h2><a href="#jadval" data-u-go="jadval" style="font-size: 13px; min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: flex-end">Jadval</a></div>
          ${list.length ? list.map(row).join('') : '<div class="li"><span class="s">Bugun asosiy dars yo\'q</span></div>'}</section>`;
    }
    function bindTab(root) {
        const d = D(), n = today();
        root.querySelectorAll('[data-flt]').forEach(b => b.onclick = () => { flt = b.dataset.flt; d.store.set(FLT_KEY, flt); U.render(); });
        root.querySelectorAll('[data-mon]').forEach(b => b.onclick = () => { if (b.disabled) return; const v = d.shiftMonth(month, +b.dataset.mon); if (v <= n.month) { month = v; U.render(); } });
        root.querySelectorAll('[data-day]').forEach(b => b.onclick = e => { e.preventDefault(); const [sid, date] = b.dataset.day.split('|'); openDay(sid, date); });
        const sc = root.querySelector('.dv-sc'); if (!sc) return;
        const key = `${month}|${flt}`;
        if (scroll[key] != null) sc.scrollLeft = scroll[key];
        else sc.scrollLeft = Math.max(0, (+sc.dataset.ti - 3) * 46); // bugungi (yoki keyingi) ustun chapdan 4-o'rinda
        sc.onscroll = () => { scroll[key] = sc.scrollLeft; };
    }
    U.tab('davomat', { render: renderTab, bind: bindTab });
    U.badge('davomat', () => (D()?.S?.state ? (sync(curMonth()), pending(curMonth())) : 0));

    // ── F2 — o'quvchining to'liq oyi (ichki sahifa, dizayndagidek pastdan oyna ko'rinishida) ──
    let oyShown = null;
    U.page('dv-oy', {
        render(sid) {
            const d = D(), n = today(), s = d.stuOf(sid);
            month ||= n.month;
            sync(month);
            const M = cap(monName(month));
            const anim = oyShown === sid ? ' style="animation: none"' : '';
            const hd = `<header class="hd"><div class="t"><span class="date">${esc(U.dateLong(n.date))}</span><h1 style="font-size: 26px">Davomat · ${M}</h1></div></header>`;
            if (!s) return `<div class="dv-oyw">${hd}<div class="scrim" data-u-back${anim}></div><section class="sheet dv-oy" role="dialog" aria-modal="true" aria-label="O'quvchi"${anim}><span class="grab" aria-hidden="true"></span><div class="note w"><span>O'quvchi topilmadi.</span></div><button type="button" class="btn w" data-u-back>Orqaga</button></section></div>`;
            const st = stats(s, month), pat = d.patternOf(s);
            const cells = d.cal.cells(month, pat);
            const lead = cells.findIndex(Boolean), prevEnd = +d.cal.cells(d.shiftMonth(month, -1), []).filter(Boolean).slice(-1)[0].day;
            const out = [];
            for (let i = 0; i < lead; i++) out.push(`<span class="dv-dc o">${prevEnd - lead + 1 + i}</span>`);
            for (const c of cells.slice(lead)) {
                const t = c.date === n.date ? ' t' : '';
                if (c.scheduled) {
                    const k = cell(s, c.date), q = heldOn(s, c.date) && k === 'g';
                    out.push(`<button type="button" class="dv-dc ${k}${t}" data-day="${esc(s.id)}|${c.date}" aria-label="${c.day}-${monName(month)} · ${TITLE[k]}">${c.day}${k === 'b' ? '<small>qoplandi</small>' : ''}${q ? '<span class="dv-pq">+Q</span>' : ''}</button>`);
                } else {
                    const h = heldOn(s, c.date), hm = h && Number.isFinite(+h.held_start_min) && h.held_start_min !== null ? d.hm(+h.held_start_min) : h ? 'qoplash' : '';
                    out.push(`<button type="button" class="dv-dc${t}" data-day="${esc(s.id)}|${c.date}" aria-label="${c.day}-${monName(month)} · dars yo'q kun${h ? ' · qoplash o\'tilgan' : ''}">${c.day}${h ? `<small>${hm}</small><span class="dv-pq">+Q</span>` : ''}</button>`);
                }
            }
            for (let i = 1; out.length % 7; i++) out.push(`<span class="dv-dc o">${i}</span>`);
            return `<div class="dv-oyw">${hd}<div class="scrim" data-u-back aria-hidden="true"${anim}></div>
              <section class="sheet dv-oy" role="dialog" aria-modal="true" aria-labelledby="dv-oyh"${anim}><span class="grab" aria-hidden="true"></span>
                <div class="row">${d.avatar(s, 'av" style="width: 44px; height: 44px')}<div class="col g1"><h2 id="dv-oyh" style="font-size: 19px; font-weight: 800">${esc(s.name)}</h2><span class="s">${d.patternLabel(s.lessonDayOfWeek)} ${esc(s.lessonTime || '')} · ${dur(s)} daq${s.frozen ? ' · muzlatilgan' : ''}</span></div><button type="button" class="icb" data-u-back aria-label="Yopish" style="border: 0; background: #F1F5F9">${U.svg(ICO.x, 18, 2.4)}</button></div>
                <div class="sm2"><div><b style="color: #067647">${st.g}</b><span>keldi</span></div><div><b style="color: #B42318">${st.r}</b><span>kelmadi</span></div><div><b style="color: #1570EF">${st.b}</b><span>qoplandi</span></div><div><b>${st.f}</b><span>oldinda</span></div></div>
                <div class="dv-cg">${d.DAY.map(x => `<span class="dv-wd">${x}</span>`).join('')}${out.join('')}</div>
                <div class="dv-cgl"><span><i style="background: #12B76A"></i>Keldi</span><span><i style="background: #F04438"></i>Kelmadi</span><span><i style="background: #2E90FA"></i>Qoplandi</span><span><i style="background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E2E8F0"></i>Oldinda</span><span><i style="background: #F8FAFC; box-shadow: inset 0 0 0 1px #E2E8F0"></i>Dars yo'q kun</span></div>
                <div class="note i" style="padding: 10px 12px"><span>${month < n.month ? `<b>${M} yopilgan</b> — o'zgartirish admin orqali.` : `<b>Rangli kun</b> — dars kuni, bosib belgilaysiz. <b>Kulrang kun</b> — bosib qoplash darsini qo'shasiz. <b>+Q</b> — shu kuni qoplash o'tilgan.`}</span></div>
              </section></div>`;
        },
        bind(root, sid) {
            oyShown = sid;
            root.querySelectorAll('[data-day]').forEach(b => b.onclick = e => { e.preventDefault(); const [id, date] = b.dataset.day.split('|'); openDay(id, date); });
        },
        nav: false
    });

    // ── L0–L3 — davomat qulfi ──
    const lk = { items: null, done: new Map(), blocked: null, celebrate: false };
    function lockItems() {
        const d = D(), S = d.S, n = today(), m = n.month;
        if (!S.state || !S.me) return [];
        const e = sync(m); if (!e || !e.data) return []; // "Kelmadi" belgilari kelmaguncha qulf yo'q (yolg'on qulf bo'lmasin)
        const yest = U.addDays(n.date, -1), from = QULF_FROM > `${m}-01` ? QULF_FROM : `${m}-01`;
        if (yest < from) return [];
        const out = [];
        for (const s of roster(m).act) for (const c of d.lessonDays(s, m)) if (c.date >= from && c.date <= yest && cell(s, c.date) === 'y') out.push({ s, date: c.date });
        return out.sort((a, b) => a.date.localeCompare(b.date) || (startOf(a.s) ?? 0) - (startOf(b.s) ?? 0));
    }
    const introSeen = () => !!D().store.get(INTRO_KEY, false);
    function lockState() {
        if (!D()?.S?.state) return null;
        if (!introSeen()) return 'intro';
        const items = lockItems();
        if (items.length) {
            if (!lk.items) lk.items = items; // qulf oynasidagi ro'yxat belgilangach ham turadi (holati bilan)
            else for (const x of items) if (!lk.items.some(y => y.s.id === x.s.id && y.date === x.date)) lk.items.push(x);
            return 'lock';
        }
        if (lk.items && lk.done.size && !lk.celebrate) { lk.celebrate = true; setTimeout(() => U.confetti(), 60); }
        return lk.celebrate ? 'done' : null;
    }
    const TAB_NAMES = { home: 'Bosh sahifa', jadval: 'Jadval', davomat: 'Davomat', oquvchilar: "O'quvchilar", menyu: 'Menyu' };
    function lockRender() {
        const d = D(), n = today(), st = lockState();
        if (st === 'intro') {
            return `<div class="scrim" aria-hidden="true" style="background: rgba(11,18,32,.6)"></div>
              <section class="dv-mdl" role="dialog" aria-modal="true" aria-labelledby="dv-l0" style="top: 70px; text-align: center">
                <span class="dv-lk dv-pop" style="background: #EAF3FF; color: #0057B8">${U.svg(ICO.lock, 38, 2)}</span>
                <div class="col" style="gap: 6px; align-items: center"><span class="pill inf">${n.date < QULF_FROM ? `Yangi qoida · ${+QULF_FROM.slice(8)}-${monName(QULF_FROM.slice(0, 7))}dan` : 'Yangi qoida'}</span><h2 id="dv-l0" style="font-size: 23px; font-weight: 800; letter-spacing: -.02em">Davomat — kunning oxirigacha</h2><span class="s" style="font-size: 14px; line-height: 1.5">Davomat maoshingiz va o'quvchi nazoratining asosi. Shuning uchun endi u kechikmasligi kerak.</span></div>
                <div class="dv-stp"><i class="ok">1</i><div class="col"><b style="font-size: 15px">Dars tugadi — belgilang</b><span class="s">Keldi yoki Kelmadi, 2 soniya</span></div></div>
                <div class="dv-stp"><i class="wa">2</i><div class="col"><b style="font-size: 15px">Unutilsa, ertasi kuni ilova qulflanadi</b><span class="s">Kechagi darslar belgilanmaguncha boshqa bo'limlar ochilmaydi</span></div></div>
                <div class="dv-stp"><i class="inf">3</i><div class="col"><b style="font-size: 15px">Belgilaysiz — darhol ochiladi</b><span class="s">Hammasi bir oynada, 10–20 soniyada</span></div></div>
                <button type="button" class="btn p w" data-dv-intro style="height: 54px; font-size: 16px">Tushundim</button>
              </section>`;
        }
        if (st === 'done') {
            const done = (lk.items || []).filter(x => lk.done.has(`${x.s.id}|${x.date}`));
            const yest = U.addDays(n.date, -1), allY = done.every(x => x.date === yest);
            return `<div class="scrim" aria-hidden="true" style="background: rgba(11,18,32,.5)"></div>
              <section class="dv-mdl" role="dialog" aria-modal="true" aria-labelledby="dv-l3" style="top: 150px; text-align: center; align-items: center">
                <span class="dv-lk dv-pop" style="background: #ECFDF3; color: #067647">${U.svg(ICO.open, 40, 2)}</span>
                <h2 id="dv-l3" style="font-size: 23px; font-weight: 800">Rahmat! Ilova ochildi</h2>
                <span class="s" style="font-size: 14px; line-height: 1.5">${allY ? 'Kechagi' : "Qolib ketgan"} ${done.length} ta dars hisobga o'tdi. Endi har dars tugagach belgilasangiz, qulf umuman chiqmaydi.</span>
                <div class="dv-pills">${done.slice(0, 6).map(x => { const v = lk.done.get(`${x.s.id}|${x.date}`); return `<span class="pill ${v === 'p' ? 'ok' : 'bad'}">${esc(d.first(x.s.name))} · ${v === 'p' ? 'Keldi' : 'Kelmadi'}</span>`; }).join('')}${done.length > 6 ? `<span class="pill mu">+${done.length - 6}</span>` : ''}</div>
                <button type="button" class="btn p w" data-dv-done style="height: 52px">Davom etish</button>
              </section>`;
        }
        const items = lk.items || [], left = items.filter(x => cell(x.s, x.date) === 'y');
        const yest = U.addDays(n.date, -1), allY = items.every(x => x.date === yest);
        if (lk.blocked) {
            const nm = TAB_NAMES[lk.blocked] || 'Bu bo\'lim';
            return `<div class="scrim" data-dv-unblock aria-hidden="true" style="background: rgba(11,18,32,.5)"></div>
              <section class="sheet dv-l2" role="dialog" aria-modal="true" aria-labelledby="dv-l2" style="gap: 14px; align-items: center; text-align: center"><span class="grab" aria-hidden="true"></span>
                <span class="dv-lk" style="width: 64px; height: 64px; border-radius: 20px; background: #F1F5F9; color: #0B1220; animation: none">${U.svg(ICO.lock, 38, 2)}</span>
                <h2 id="dv-l2" style="font-size: 20px; font-weight: 800">${esc(nm)} hozircha yopiq</h2>
                <span class="s" style="font-size: 15px; line-height: 1.5">Avval ${allY ? 'kechagi' : 'qolib ketgan'} ${left.length} ta darsni belgilang. Keyin ${esc(nm)} va boshqa hamma bo'limlar ochiladi.</span>
                <button type="button" class="btn p w" data-dv-unblock style="height: 52px">Davomatni belgilash · ${left.length} ta</button>
              </section>${navCatcher()}`;
        }
        const groups = [];
        for (const x of items) { let g = groups.find(y => y.date === x.date); if (!g) groups.push(g = { date: x.date, list: [] }); g.list.push(x); }
        const doneN = items.length - left.length;
        const next = d.S.main.filter(s => isLesson(s, n.date) && countsOn(s, n.date) && startOf(s) != null && startOf(s) > n.min).sort((a, b) => startOf(a) - startOf(b))[0];
        const firstToday = d.S.main.filter(s => isLesson(s, n.date) && countsOn(s, n.date) && startOf(s) != null).sort((a, b) => startOf(a) - startOf(b))[0];
        const row = x => {
            const k = `${x.s.id}|${x.date}`, v = d.markOf(x.s, x.date);
            const btns = v === 'present' ? '<span class="pill ok">Keldi</span>' : v === 'absent' ? '<span class="pill bad">Kelmadi</span>'
                : `<span class="b2"><button type="button" data-lk="p" data-k="${esc(k)}" aria-label="${esc(x.s.name)} keldi" style="background: #12B76A; color: #FFFFFF">${U.svg(ICO.ok, 18, 3.5)}</button><button type="button" data-lk="a" data-k="${esc(k)}" aria-label="${esc(x.s.name)} kelmadi" style="background: #FFFFFF; color: #B42318; box-shadow: inset 0 0 0 1.5px #FDA29B">${U.svg(ICO.x, 16, 3.5)}</button></span>`;
            return `<div class="dv-mk${v !== 'empty' ? ' dn' : ''}"><span class="dv-dch y sm"><b>${+x.date.slice(8)}</b><small>${dayShort(x.date)}</small></span><div class="col g1"><span class="nm">${esc(x.s.name)}</span><span class="s">${esc(x.s.lessonTime || '')} · ${dur(x.s)} daq</span></div>${btns}</div>`;
        };
        return `<div class="scrim" aria-hidden="true" style="background: rgba(11,18,32,.62)"></div>
          <section class="dv-mdl" role="dialog" aria-modal="true" aria-labelledby="dv-l1" style="top: 56px">
            <span class="dv-lk" style="background: #FEF0C7; color: #B54708">${U.svg(ICO.lock, 38, 2)}</span>
            <div class="col" style="gap: 6px; align-items: center; text-align: center"><h2 id="dv-l1" style="font-size: 22px; font-weight: 800; letter-spacing: -.02em">${allY ? 'Kechagi davomat qolib ketdi' : 'Davomat qolib ketdi'}</h2><span class="s" style="font-size: 14px; line-height: 1.5">${left.length} ta darsni belgilang — ilova shu zahoti ochiladi.</span></div>
            ${groups.map((g, i) => `<div class="row" style="justify-content: space-between"><span class="xs b" style="letter-spacing: .05em">${dLong(g.date).toUpperCase()}</span>${i === 0 ? `<span class="pill wa">${doneN} / ${items.length}</span>` : ''}</div>${g.list.map(row).join('')}`).join('')}
            ${firstToday ? `<div class="note i" style="padding: 10px 12px">${U.svg(ICO.clock, 18, 2).replace('<svg ', '<svg style="flex: none; margin-top: 1px" ')}<span>${next ? `Bugungi ${next === firstToday ? 'birinchi' : 'keyingi'} darsingiz <b>${d.hm(startOf(next))}</b> da, ${esc(d.first(next.name))} bilan — ${next === firstToday ? 'undan oldin bemalol ulgurasiz.' : 'undan oldin belgilab oling.'}` : 'Bugungi darslaringizni ham tugagach shu yerda belgilaysiz.'}</span></div>` : ''}
            <span class="xs" style="text-align: center">Kelmadi tanlansa sabab so'raladi · savol bo'lsa: Adminga yozish</span>
          </section>${navCatcher()}`;
    }
    // Qulf ustidan pastki menyu bosilganini ushlash (nav qulf ostida qoladi) → L2.
    const navCatcher = () => `<div class="dv-lnav">${Object.entries(TAB_NAMES).map(([id, l]) => `<button type="button" data-dv-tab="${id}" aria-label="${l} (yopiq)"></button>`).join('')}</div>`;
    function lockBind(el) {
        if (!el) return;
        const d = D();
        el.querySelector('[data-dv-intro]')?.addEventListener('click', () => { d.store.set(INTRO_KEY, true); U.render(); });
        el.querySelector('[data-dv-done]')?.addEventListener('click', () => { lk.items = null; lk.done.clear(); lk.celebrate = false; lk.blocked = null; U.render(); });
        el.querySelectorAll('[data-dv-unblock]').forEach(b => b.onclick = () => { lk.blocked = null; U.render(); });
        el.querySelectorAll('[data-dv-tab]').forEach(b => b.onclick = () => onBlocked(b.dataset.dvTab));
        el.querySelectorAll('[data-lk]').forEach(b => b.onclick = async () => {
            const [sid, date] = b.dataset.k.split('|'), s = d.stuOf(sid); if (!s) return;
            if (b.dataset.lk === 'a') return openLesson(s, date, { mode: 'a', onDone: () => { if (d.markOf(s, date) !== 'empty') { lk.done.set(b.dataset.k, 'a'); U.render(); } } });
            el.querySelectorAll('[data-lk]').forEach(x => x.disabled = true);
            try { const r = await saveMark(s, date, true); lk.done.set(b.dataset.k, 'p'); if (r === 'queued') U.toast("Internet yo'q — telefonda saqlandi, keyin yuboriladi"); }
            catch (err) { U.toast(err.message); }
            U.render();
        });
    }
    function onBlocked(tab) {
        const st = lockState();
        if (st === 'lock') { if (tab === 'davomat') { lk.blocked = null; } else lk.blocked = tab; U.render(); }
    }
    U.lock('davomat', { priority: 2, active: () => !!lockState(), render: lockRender, bind: lockBind, onBlocked });
})();
