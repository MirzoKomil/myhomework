// "Darsni boshlash" — ustozning bugungi darslari, o'quvchining navbatdagi
// jonli darsi va prezentatsiya oynasini (js/lessonPresenter.js) shu dars bilan
// ochish. "Darsni tugatish" o'quvchiga davomatda "Keldi" qo'yadi (mavjud
// POST /api/state/teacher-attendance orqali — saveTeacherAttendanceChange)
// va boshlash→tugatish vaqtini /api/academic/sessions ga yozadi.
// Foydalanuvchilar: Darslik banneri (lessonHub.js), Bosh sahifadagi
// "Keyingi dars" kartasi (app.js), Elektron doska (whiteboard.js).
(function () {
    'use strict';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const api = (p, o) => apiFetch(p, { timeout: 30000, ...(o || {}) });
    const toast = m => (typeof showMiniToast === 'function' ? showMiniToast(m, 3200) : null);
    const plain = s => String(s ?? '').replace(/́/g, '');
    const TZ = 'Asia/Tashkent';
    const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    const hmFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
    const today = () => dayFmt.format(new Date());
    const nowMin = () => { const [h, m] = hmFmt.format(new Date()).split(':').map(Number); return h * 60 + m; };
    const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';

    const me = () => (typeof getCurrentUser === 'function' ? getCurrentUser() : null);
    function isPureAssistant(user = me()) {
        if (!user || user.role !== 'teacher') return false;
        if (typeof _isPureAssistant === 'function') { try { return !!_isPureAssistant(user); } catch { /* */ } }
        const emp = (typeof getItem === 'function' ? getItem(STORAGE_KEYS.hrEmployees, []) : []).find(e => e.id === user.linkedTeacherId);
        return emp?.role === 'yordamchi';
    }
    function teacherLang(user = me()) {
        if (user?.linkedTeacherLang) return user.linkedTeacherLang === 'russian' ? 'russian' : 'english';
        const emp = (typeof getItem === 'function' ? getItem(STORAGE_KEYS.hrEmployees, []) : []).find(e => e.id === user?.linkedTeacherId);
        return emp?.role === 'rus-oqituvchi' || emp?.lang === 'russian' ? 'russian' : 'english';
    }

    // ── Bugungi darslar (ustoz) yoki aloqalar (yordamchi) ───────────────────
    let cache = { at: 0, key: '', data: null, p: null };
    async function loadToday({ force = false } = {}) {
        const user = me();
        if (!user || user.role !== 'teacher') return null;
        const key = `${user.id}|${today()}`;
        if (!force && cache.key === key && cache.data && Date.now() - cache.at < 60000) return cache.data;
        if (!force && cache.key === key && cache.p) return cache.p;
        cache.key = key;
        cache.p = (async () => {
            const assistant = isPureAssistant(user);
            const d = today();
            let items = [];
            if (assistant) {
                const r = await api(`/api/school/assist/plan?from=${d}&to=${d}`);
                items = (r.items || []).filter(i => i.date === d && i.studentId).map(i => ({
                    studentId: i.studentId, studentName: i.studentName || '', start: i.start, end: i.end || i.start + 15,
                    // "Javob bermadi" — bajarilmagan (qayta urinish kerak), Davomat/Bosh sahifa bilan bir xil.
                    kind: 'contact', done: i.kind === 'contact' && i.outcome !== 'no_answer', noAnswer: i.kind === 'contact' && i.outcome === 'no_answer', date: d }));
            } else {
                const r = await api(`/api/school/schedule?from=${d}&to=${d}`);
                for (const v of r.views || []) for (const i of v.items || []) {
                    if (!i.studentId || (i.kind !== 'lesson' && i.kind !== 'makeup')) continue;
                    items.push({ studentId: i.studentId, studentName: i.studentName || '', start: i.start, end: i.end, kind: i.kind, att: i.att, date: d });
                }
            }
            items.sort((a, b) => a.start - b.start);
            const ids = [...new Set(items.map(i => i.studentId))];
            let lessons = {};
            if (ids.length) {
                try { lessons = (await api(`/api/academic/next-lessons?ids=${encodeURIComponent(ids.join(','))}`)).lessons || {}; } catch { lessons = {}; }
            }
            for (const it of items) {
                const l = lessons[it.studentId];
                if (!l) continue;
                it.lang = l.lang;
                it.reached = l.reached || 0;
                if (assistant) { it.lessonNo = l.reached || null; continue; }
                // Yagona qoida — server (liveLessonPick: o'tilmagan birinchi jonli dars, tarix to'liq bo'lmasa ilovadagi o'rin).
                // Davomat "Jonli dars avtomatik belgilanadi: N-dars" va "Keldi" saqlanganda ham aynan shu dars.
                it.lessonNo = l.nextLive?.no || null;
                it.lessonId = l.nextLive?.id || '';
            }
            const nm = nowMin();
            // Yordamchi aloqasi tavsiya vaqti — o'tib ketgan bo'lsa ham bugun bajarilmagani ko'rsatiladi.
            // Yordamchi: o'quvchi bo'yicha — bugun bog'langan o'quvchi (avval "javob bermadi" bo'lsa ham) keyingi bo'lmaydi;
            // aks holda hammasi belgilangach eski "javob bermadi" urinishi banner'ga chiqib qolardi. Hammasi belgilansa — banner yo'q.
            const doneIds = new Set(items.filter(i => i.done).map(i => i.studentId));
            const open = assistant ? items.filter(i => !doneIds.has(i.studentId)) : items.filter(i => !i.done);
            const next = open.find(i => i.end > nm && i.att !== 1) || (assistant ? open[0] : null) || null;
            const total = assistant ? new Set(items.map(i => i.studentId)).size : items.length;
            const data = { assistant, items, next, done: assistant ? doneIds.size : items.filter(i => i.end <= nm || i.att === 1 || i.done).length, total, lang: teacherLang(user) };
            cache = { at: Date.now(), key, data, p: null };
            return data;
        })().catch(e => { cache.p = null; throw e; });
        return cache.p;
    }

    const lessonCache = new Map();
    async function loadLesson(no, lang) {
        const key = `${lang}:${no}`;
        const hit = lessonCache.get(key);
        if (hit && Date.now() - hit.at < 180000) return hit.data;
        const data = await api(`/api/academic/lessons/${no}?lang=${lang}`);
        lessonCache.set(key, { at: Date.now(), data });
        return data;
    }

    // Kitob/ustoz kitobi sahifalari, slaydlar soni — banner va kartalar uchun.
    function lessonFacts(data) {
        const L = data.lesson;
        const tb = (data.guides || []).find(g => g.kind === 'teacher_book' && !/yordamchi|assistant/i.test(g.title));
        const slides = (data.materials || []).filter(m => m.kind === 'live_slides' || m.kind === 'video_slides').length + (L.slides || []).length;
        const bookNo = data.book ? (String(data.book.title).match(/(\d+)\s*-?\s*(qism|kitob|part)/i)?.[1] || '') : '';
        return {
            no: L.no, type: L.type, name: plain(L.name), topic: plain(L.topic || ''),
            book: data.book ? `${bookNo ? bookNo + '-kitob' : 'Kitob'}${data.book.page ? ` ${data.book.page}-bet` : ''}` : '',
            teacherBook: tb ? `Ustoz kitobi ${tb.page}-bet` : '', slides,
        };
    }

    // ── Darsni boshlash ─────────────────────────────────────────────────────
    async function start({ studentId = '', studentName = '', lessonNo, lessonId = '', lang, duration, group = [] } = {}) {
        const user = me();
        lang = lang || teacherLang(user);
        let no = Number(lessonNo);
        if (!no && studentId) {
            const t = await loadToday().catch(() => null);
            const it = t?.items.find(i => i.studentId === studentId);
            no = it?.lessonNo || 0;
            lessonId = lessonId || it?.lessonId || '';
        }
        if (!no) no = 2;
        let data;
        try { data = await loadLesson(no, lang); }
        catch (e) { toast(`Darsni ochib bo'lmadi: ${e.message}`); return; }
        const sources = window.LessonHub?.buildSources ? window.LessonHub.buildSources(data) : [];
        const students = getStudents();
        const st = students.find(s => s.id === studentId);
        const dur = Number(duration) || Number(st?.lessonDuration) || 60;
        const facts = lessonFacts(data);
        const isMain = !isPureAssistant(user) && user?.role === 'teacher';
        window.LessonPresenter.open({
            title: `${data.lesson.no}-dars · ${data.lesson.type === 'live' ? 'Jonli dars' : 'Videodars'}`,
            subtitle: [studentName || st?.name || '', `${dur} daq`, facts.book].filter(Boolean).join(' · '),
            sources, start: 0, lesson: data, duration: dur,
            presence: studentId ? { studentId, name: studentName || st?.name || '' } : null,
            finish: isMain ? { label: 'Darsni tugatish', onFinish: ctx => finish({ ...ctx, studentId, studentName: studentName || st?.name || '', lessonNo: data.lesson.no, lessonId, group }) } : null,
        });
    }

    function getStudents() {
        return typeof getItem === 'function' && typeof STORAGE_KEYS !== 'undefined' ? getItem(STORAGE_KEYS.students, []) : [];
    }

    // Tugatish oynasi: kimga "Keldi" qo'yiladi (bitta o'quvchi yoki shu vaqtdagi guruh).
    async function finish({ startedAt, root, close, studentId, studentName, lessonNo, lessonId }) {
        const user = me();
        let list = [];
        try {
            const t = await loadToday();
            const cur = t?.items.find(i => i.studentId === studentId);
            list = (t?.items || []).filter(i => cur ? i.start === cur.start : true);
            if (!cur && studentId) list.unshift({ studentId, studentName, start: null });
        } catch { if (studentId) list = [{ studentId, studentName }]; }
        const uniq = [...new Map(list.map(i => [i.studentId, i])).values()];
        const mins = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
        const nameOf = i => i.studentName || getStudents().find(s => s.id === i.studentId)?.name || i.studentId;
        const main = uniq.find(i => i.studentId === studentId) || (uniq.length === 1 ? uniq[0] : null);
        const who = uniq.length === 1 ? nameOf(uniq[0]) : uniq.length ? `${uniq.length} o'quvchi` : (studentName || '');
        // Qo'shaloq dars: kamida 120 daqiqa va qoplanmagan (kelmagan, qoplash yo'q) dars kerak — POST /api/school/makeups/double.
        const DOUBLE_MIN = 120, canDouble = !!main && main.att !== 1 && mins >= DOUBLE_MIN;
        const box = document.createElement('div');
        box.className = 'lp-dlg-bg';
        box.innerHTML = `<form class="lp-dlg lp-dlg--fin" role="dialog" aria-modal="true" aria-labelledby="lpFinT">
            <div class="lp-dlg-h"><div><h3 id="lpFinT">Darsni tugatasizmi?</h3><p class="lp-dlg-sub">${esc([who, `${lessonNo}-dars`, `${mins} daqiqa o'tdi`].filter(Boolean).join(' · '))}</p></div>
              <button type="button" class="lp-dlg-x" data-x aria-label="Yopish — darsni davom ettirish"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
            ${uniq.length ? `<div class="lp-dlg-box">Tugatganda davomat avtomatik <b>"Keldi"</b> bo'ladi va <b>${lessonNo}-dars</b> o'tilgan deb yoziladi va ilovada keyingi darslar ochiladi.</div>` : ''}
            ${uniq.length > 1 ? `<div class="lp-dlg-list">${uniq.map(i => `<label class="lp-dlg-row"><input type="checkbox" name="s" value="${esc(i.studentId)}"${i.att !== 1 && studentId ? ' checked' : ''}>
                <span><b>${esc(nameOf(i))}</b>${i.start != null ? `<small>${hm(i.start)}${i.att === 1 ? ' · allaqachon «Keldi»' : ''}</small>` : ''}</span></label>`).join('')}</div>`
                : !uniq.length ? '<p class="lp-dlg-sub">Bugun jadvalingizda dars topilmadi — davomatni "Davomat" bo\'limida belgilang.</p>'
                : uniq[0].att === 1 ? '<p class="lp-dlg-sub">Davomatda allaqachon «Keldi» turibdi — qayta yozilmaydi.</p>' : ''}
            ${main ? `<label class="lp-dlg-opt${canDouble ? '' : ' is-off'}" data-dbl><input type="checkbox" name="double"${canDouble ? '' : ' disabled'}>
                <span><b>Bu qo'shaloq dars edi</b><small data-dbl-note>Kamida ${DOUBLE_MIN} daqiqa kerak · hozir ${mins} daqiqa</small></span></label>
                <div class="lp-dlg-pick" data-dbl-pick hidden></div>` : ''}
            <div class="lp-dlg-act"><button type="button" class="lp-link" data-close title="Davomat qo'ymasdan taqdimotni yopish">Davomatsiz yopish</button><span class="lp-grow"></span>
                <button type="button" class="lp-btn" data-x>Davom etish</button>
                ${uniq.length ? '<button type="submit" class="lp-btn lp-btn--pri">Tugatish · Keldi</button>' : ''}</div>
            <div class="lp-dlg-msg" role="status"></div></form>`;
        root.appendChild(box);
        const form = box.querySelector('form');
        box.querySelectorAll('[data-x]').forEach(b => { b.onclick = () => box.remove(); });
        box.querySelector('[data-close]').onclick = () => { box.remove(); close(); };
        (form.querySelector('[type=submit]') || form.querySelector('.lp-dlg-act [data-x]')).focus();
        // Qaysi qoldirilgan dars o'rniga — qoplanmagan darslar (js/ustozHome.js, Davomat bilan bir xil qoida).
        let openMissed = [];
        if (canDouble) {
            const dbl = form.querySelector('[name=double]'), note = form.querySelector('[data-dbl-note]'), pick = form.querySelector('[data-dbl-pick]');
            dbl.disabled = true;
            note.textContent = `${mins} daqiqa · qoplanmagan darslar tekshirilmoqda…`;
            (window.UstozHome?.missed ? window.UstozHome.missed(user) : Promise.resolve(null)).then(m => {
                if (!box.isConnected) return;
                openMissed = m?.by.get(main.studentId)?.open || [];
                if (!openMissed.length) { note.textContent = `${mins} daqiqa · bu oyda qoplanmagan darsi yo'q — qo'shaloq dars faqat qoldirilgan dars o'rniga`; form.querySelector('[data-dbl]').classList.add('is-off'); return; }
                dbl.disabled = false;
                const dm = window.UstozHome.dm;
                note.textContent = `${mins} daqiqa · ${openMissed.length === 1 ? `${dm(openMissed[0])} darsi o'rniga` : `${openMissed.length} ta qoplanmagan dars`} · admin tasdiqlagach maoshga qo'shiladi`;
                if (openMissed.length > 1) pick.innerHTML = `<label>Qaysi dars o'rniga? <select name="missed">${openMissed.map(d => `<option value="${d}">${dm(d)}</option>`).join('')}</select></label>`;
                dbl.onchange = () => { pick.hidden = !(dbl.checked && openMissed.length > 1); };
            }).catch(() => { note.textContent = `${mins} daqiqa · qoplanmagan darslarni yuklab bo'lmadi`; });
        }
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const ids = uniq.length > 1 ? [...form.querySelectorAll('input[name=s]:checked')].map(x => x.value) : uniq.length && uniq[0].att !== 1 ? [uniq[0].studentId] : [];
            if (!ids.length && uniq.length === 1) { toast('Davomatda allaqachon «Keldi»'); box.remove(); close(); return; }
            if (!ids.length) { form.querySelector('.lp-dlg-msg').textContent = "Kamida bitta o'quvchini belgilang"; return; }
            const double = !!form.querySelector('[name=double]')?.checked && openMissed.length && main && ids.includes(main.studentId);
            const missedDate = double ? (form.querySelector('[name=missed]')?.value || openMissed[0]) : '';
            form.querySelectorAll('button').forEach(b => { b.disabled = true; });
            form.querySelector('.lp-dlg-msg').textContent = 'Saqlanmoqda…';
            const date = today(), teacherId = user?.linkedTeacherId;
            const failed = [];
            let doubleErr = '';
            for (const sid of ids) {
                const base = { teacherId, studentId: sid, date, present: true, attendanceType: 'main' };
                try {
                    // Shu dars aynan o'tilgan jonli dars sifatida (o'quvchi kursida bo'lmasa — server o'zi tanlaydi).
                    if (sid === studentId && lessonId) {
                        try { await saveTeacherAttendanceChange({ ...base, grade: { lessonId } }); }
                        catch (err) { if (/tegishli emas/i.test(err.message)) await saveTeacherAttendanceChange(base); else throw err; }
                    } else await saveTeacherAttendanceChange(base);
                    api('/api/academic/sessions', { method: 'POST', body: JSON.stringify({ studentId: sid, startedAt: new Date(startedAt).toISOString(), endedAt: new Date().toISOString(), lessonNo: sid === studentId ? lessonNo : null }) }).catch(() => {});
                    if (double && sid === main.studentId) {
                        try { await api('/api/school/makeups/double', { method: 'POST', body: JSON.stringify({ studentId: sid, missedDate, heldDate: date }) }); }
                        catch (err) { doubleErr = err.message; }
                    }
                } catch (err) { failed.push(`${getStudents().find(s => s.id === sid)?.name || sid}: ${err.message}`); }
            }
            cache = { at: 0, key: '', data: null, p: null };
            if (failed.length) {
                form.querySelector('.lp-dlg-msg').textContent = `Saqlanmadi — ${failed.join('; ')}`;
                form.querySelectorAll('button').forEach(b => { b.disabled = false; });
                return;
            }
            if (doubleErr) toast(`«Keldi» saqlandi, qo'shaloq dars saqlanmadi: ${doubleErr}`);
            else toast(double ? `Davomat: «Keldi · 2 dars» ✓ · qoplash tekshiruvga yuborildi` : `Davomat: «Keldi» ✓ · ${mins} daq`);
            box.remove();
            close();
            try { if (typeof renderDashboardOverview === 'function' && document.getElementById('teacherHome')) renderDashboardOverview(_lastDashboardOverviewArgs); } catch { /* */ }
        });
    }

    // ── Bosh sahifa: "Keyingi dars" kartasi ─────────────────────────────────
    async function decorateHome(container) {
        const btn = container.querySelector('[data-thx-start]');
        const card = btn?.closest('section');
        if (!card) return;
        btn.addEventListener('click', () => {
            start({ studentId: btn.dataset.thxStart, studentName: btn.dataset.name || '', duration: Number(btn.dataset.dur) || null })
                .catch(e => toast(e.message));
        });
        const slot = card.querySelector('[data-thx-lesson]');
        if (!slot || !btn) return;
        try {
            const t = await loadToday();
            const it = t?.items.find(i => i.studentId === btn.dataset.thxStart);
            if (!it?.lessonNo) return;
            const data = await loadLesson(it.lessonNo, it.lang || t.lang);
            const f = lessonFacts(data);
            const dur = Number(btn.dataset.dur) || 0;
            const sub = card.querySelector('.kbx-dsub');
            if (sub) sub.textContent = [`${f.no}-dars`, f.type === 'live' ? 'jonli dars' : 'videodars', dur ? `${dur} daq` : '', f.book].filter(Boolean).join(' · ');
            const chips = [f.topic || (f.name !== `${f.no}-dars` ? f.name : ''), f.slides ? `${f.slides} slayd` : '', f.teacherBook].filter(Boolean);
            slot.innerHTML = chips.map(c => `<span class="kbx-dchip">${esc(c)}</span>`).join('');
            slot.hidden = !chips.length;
        } catch { /* karta oddiy ko'rinishda qoladi */ }
    }

    window.LessonStart = { loadToday, loadLesson, lessonFacts, start, decorateHome, isPureAssistant, teacherLang, today, hm, firstName, nowMin, _finish: finish };
})();
