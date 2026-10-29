// Asosiy ustoz davomati va "faol o'quvchi" — server (teacherRating, staffSettings) va CRM (Davomat, Bosh sahifa,
// bildirishnomalar, yordamchi sahifalari) uchun YAGONA ta'rif. Bir raqam hamma sahifada bir xil chiqishi uchun
// (BAHOLASH-MEZONI: "Bir manba: davomat %") formulani faqat shu yerda o'zgartiring.
//
//  • Faol o'quvchi: muzlatilmagan, kursni to'xtatmagan/tugatmagan/chiqib ketmagan (status), xodim demo emas.
//    Faol bo'lmagan o'quvchi rejaga, o'quvchilar soniga, "bugungi darslar"ga kirmaydi.
//  • Oy hisobi (2026-10 dan): o'quvchining o'z dars kunlaridagi "Keldi" + admin tasdiqlagan qoplash,
//    har o'quvchida oy rejasidan oshmaydi. O'quvchi boshlagan kundan oldingi kunlar kutilmaydi va sanalmaydi
//    (moliya bilan bir xil — payrollEngine studentStart).
//  • O'quvchi o'sha kuni faol bo'lmagan (muzlatilgan / chiqib ketgan — school_student_status) kundagi "Keldi" va qoplash
//    sanalmaydi, kutilmaydi ham (lessonCountsOn). Server ustozga bunday kunga belgi qo'ydirmaydi (teacherAttendanceRules),
//    moliya ham shu funksiya bilan sanaydi (payrollEngine) — Davomat % va maosh bitta qoida.
//    Holat yozuvlari: s.statusHistory ([{status, from, to}] — server /api/state beradi) yoki statusRows (school_student_status qatorlari).
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.AttendanceRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const INACTIVE = Object.freeze(['inactive', 'tark-etdi', "to'xtatilgan", 'bekor', 'left', 'archived', 'deleted']);
    const extraOf = s => {
        if (!s || s.extra_data == null) return null;
        if (typeof s.extra_data === 'object') return s.extra_data;
        try { return JSON.parse(s.extra_data); } catch { return {}; }
    };
    // s — state'dagi o'quvchi ({frozen, status, isStaffDemo}) yoki students jadvali qatori ({extra_data}).
    function isActiveStudent(s) {
        if (!s) return false;
        const x = extraOf(s) || s;
        if (x.frozen === true || s.legacyFrozen === true) return false;
        if (x.isStaffDemo === true || s.staffDemo === true) return false;
        if (s.legacyInactive === true) return false;
        return !INACTIVE.includes(String(x.status || '').toLowerCase());
    }
    function calendar() {
        if (typeof module === 'object' && module.exports) return require('./teacherAttendanceCalendar');
        return root.teacherAttendanceCalendar;
    }
    const dkey = v => {
        if (!v) return '';
        if (v instanceof Date) return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        return String(v).slice(0, 10);
    };
    // Ustozlar tarixi (school_teacher_history → s.teacherHistory: [{teacherId, from, to}], server /api/state beradi):
    // o'sha kuni o'quvchining asosiy ustozi kim edi. Tarix shu kunni qamramasa — null (payrollEngine teacherOnDay bilan bir xil).
    function teacherOn(s, date) {
        let who = null, best = '';
        for (const h of (s && s.teacherHistory) || []) {
            const from = dkey(h.from ?? h.fromDate ?? h.from_date);
            if (from && from <= date && from >= best) { best = from; who = h.teacherId ?? h.teacher_id ?? null; }
        }
        return who;
    }
    // Shu kungi dars shu ustozniki: ustoz almashsa — dars o'tgan ustozga (maosh bilan bir xil). Tarix shu kunni qamramasa —
    // hozirgi o'quvchi (yoki ustozi ko'rsatilmagan) shu ustozniki; o'tgan o'quvchida (boshqa ustozda, tarixi bor) — yo'q.
    function taughtOn(s, id, date) {
        const who = teacherOn(s, date);
        if (who) return who === id;
        return !(s && s.teacherId && s.teacherId !== id && (s.teacherHistory || []).length);
    }
    // Qoplashning qoldirilgan kunida "Keldi" bor — dars o'tilgan, qoplash maoshga o'tmaydi va tasdiqlab ham bo'lmaydi
    // (server /makeups → missed_came; payrollEngine missedCame). entries — o'sha o'quvchining shu oydagi belgilari.
    function missedCame(m, entries, month) {
        if (!m) return false;
        if (m.missed_came === true || m.missedCame === true) return true;
        const md = dkey(m.missed_date ?? m.missedDate);
        return !!md && (!month || md.slice(0, 7) === month) && !!entries && [1, true].includes(entries[Number(md.slice(8))]);
    }
    // "Tekshiruvda" qoplashlar (admin tasdiqlasa maoshga qo'shiladi): shu ustoz, shu oyda o'tilgan, tasdiqlab bo'ladigan (missed_came emas).
    // UstozBosh "+N qoplash tekshiruvda", Davomat, O'quvchilar ro'yxati va Mening maoshim — shu ta'rif (server staffSettings ham shu SQL sharti).
    function reviewMakeups(makeups, { id, month, mainAtt } = {}) {
        return (makeups || []).filter(m => m.status === 'review' && (!id || m.teacher_id === id) && (!month || dkey(m.held_date).slice(0, 7) === month)
            && !missedCame(m, (mainAtt || {})[m.student_id], month));
    }
    const toMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    // Toshkent vaqti bo'yicha hozirgi daqiqa (todayKey bugungi kun bo'lsa); boshqa kun uchun — kun oxiri.
    function nowMinFor(todayKey) {
        const t = new Date(Date.now() + 5 * 3600000);
        return t.toISOString().slice(0, 10) === todayKey ? t.getUTCHours() * 60 + t.getUTCMinutes() : 24 * 60;
    }
    // Oy hisobi — UstozDavomat "Oktyabr" kartasi va o'quvchi qatorlari, UstozBosh maosh kartasi va "Bajarish kerak",
    // sidebar soni, O'quvchilar ro'yxati va Reyting davomati. Bitta formula — boshqa joyda qayta hisoblamang.
    // mainAtt: { [studentId]: { [day]: 1 | 0 } } ("Kelmadi" — 0, school_absences qo'shilgan bo'lishi mumkin).
    // makeups: school_makeups qatorlari (teacher_id, student_id, status, kind, missed_date, held_date, missed_came).
    // students: shu ustozning shu oydagi o'quvchilari — hozirgilari va ustoz almashgan (o'tgan) o'quvchilar (s.teacherHistory bilan).
    //  • Faqat shu ustoz o'tgan kunlar (taughtOn): almashishdan oldingi darslar oldingi ustozda, keyingilari yangisida — maosh bilan bir xil.
    //  • Bugungi dars TUGAGANIDAN keyin (boshlanish + davomiylik) yoki belgi qo'yilgan bo'lsa "o'tgan" — boshlanmagan yoki davom
    //    etayotgan dars belgilanmagan ham, kutilgan ham emas (Davomat %, sidebar, "Bajarish kerak", Reyting — server va brauzer bir xil).
    //  • "Tekshiruvda" — reviewMakeups (missed_came — tasdiqlab bo'lmaydi — kirmaydi).
    // nowMin — Toshkent vaqti daqiqada (berilmasa soatdan); rows — har o'quvchi bo'yicha (Davomat kartalari, O'quvchilar ro'yxati).
    function monthTotals({ id, month, students, mainAtt, makeups, teacher, todayKey, nowMin }) {
        const cal = calendar(), strict = month >= '2026-10';
        const thisMonth = todayKey.slice(0, 7), nm = nowMin == null ? nowMinFor(todayKey) : nowMin;
        const my = (makeups || []).filter(m => m.teacher_id === id && ['planned', 'review', 'approved'].includes(m.status));
        const t = { plan: 0, expected: 0, came: 0, absent: 0, unmarked: 0, approved: 0, review: 0, counted: 0, students: 0, planned: 0, rows: [] };
        for (const s of (students || []).filter(s => inMonth(s, s.statusHistory, month))) {
            const start = dkey(s.startDate || s.joinDate), hist = s.statusHistory, entries = (mainAtt || {})[s.id] || {};
            // Bugungi dars tugash vaqti (boshlanish + davomiylik): shundan keyin "o'tgan" (29-okt qarori).
            const st = toMin(s.lessonTime), end = st == null ? null : st + (Number(s.lessonDuration) || 15);
            // Shu ustozning dars kuni: o'quvchi faol (muzlatilgan / chiqib ketgan kun emas) va o'sha kuni shu ustozda.
            const ownDay = c => lessonCountsOn(s, hist, c.date) && taughtOn(s, id, c.date);
            const started = c => (!start || c.date >= start) && ownDay(c);
            const isPast = c => month < thisMonth || (month === thisMonth && (c.date < todayKey
                || (c.date === todayKey && (cal.status(entries[c.day]) !== 'empty' || end == null || nm >= end))));
            const past = c => started(c) && isPast(c);
            const cells = cal.cells(month, cal.weekdays(s, teacher, 'main')).filter(c => c && c.scheduled);
            // Oy rejasi — o'quvchi faol va shu ustozda bo'lgan dars kunlari: Davomat kartasi jami = o'quvchi kartalari yig'indisi.
            // Maosh bo'luvchisi (o'quvchining oydagi jonli darslari) bunga bog'liq emas.
            const own = cells.filter(ownDay), plan = own.length, gone = cells.filter(past);
            const days = new Set(cells.filter(c => started(c) && cal.status(entries[c.day]) === 'present').map(c => c.day));
            if (!strict) Object.entries(entries).forEach(([d, v]) => { if (cal.status(v) === 'present') days.add(Number(d)); });
            const cameDays = gone.filter(c => days.has(c.day)), absentC = gone.filter(c => cal.status(entries[c.day]) === 'absent');
            const unmarkedC = gone.filter(c => !days.has(c.day) && cal.status(entries[c.day]) === 'empty');
            let n = days.size, appr = 0;
            const mine = my.filter(m => m.student_id === s.id && dkey(m.held_date).slice(0, 7) === month);
            const approvedList = [], noPay = mine.filter(m => missedCame(m, entries, month));
            if (strict) for (const m of mine.filter(m => m.status === 'approved')) {
                const hd = dkey(m.held_date), d = Number(hd.slice(8));
                if ((start && hd < start) || !lessonCountsOn(s, hist, hd)) continue;
                // "Keldi" ustun: qoldirilgan kunida "Keldi" bo'lgan qoplash sanalmaydi (payrollEngine bilan bir xil).
                if (missedCame(m, entries, month)) continue;
                if (m.kind === 'double') { n++; appr++; approvedList.push(m); } else if (!days.has(d)) { days.add(d); n++; appr++; approvedList.push(m); }
            }
            const reviewList = reviewMakeups(mine, { month, mainAtt: { [s.id]: entries } });
            // Kelmagan kunlar qoplash holati bo'yicha: qoplandi (tasdiqlangan) / tekshiruvda / rejada / ochiq.
            const byMissed = new Map(my.filter(m => m.student_id === s.id && !missedCame(m, entries, month)).map(m => [dkey(m.missed_date), m]));
            const absentDates = absentC.map(c => c.date), cov = d => byMissed.get(d)?.status;
            const row = { id: s.id, student: s, plan, expected: gone.length, came: cameDays.length, absent: absentC.length, unmarked: unmarkedC.length,
                approved: appr, review: reviewList.length, counted: Math.min(n, plan), presentDays: [...cameDays.map(c => c.day)],
                absentDates, unmarkedDates: unmarkedC.map(c => c.date), approvedList, reviewList, noPay,
                covered: absentDates.filter(d => cov(d) === 'approved').length, coveredReview: absentDates.filter(d => cov(d) === 'review').length,
                coveredPlanned: absentDates.filter(d => cov(d) === 'planned').length, openMissed: absentDates.filter(d => !byMissed.has(d)),
                planLeft: own.filter(c => !isPast(c)).length, past: s.teacherId !== id };
            t.rows.push(row);
            t.students++;
            t.plan += plan; t.expected += row.expected; t.came += row.came; t.absent += row.absent; t.unmarked += row.unmarked;
            t.approved += appr; t.review += row.review; t.counted += row.counted; t.planned += row.coveredPlanned;
        }
        t.ratio = t.expected ? Math.min(1, t.counted / t.expected) : null;
        t.pct = t.ratio == null ? null : Math.round(t.ratio * 100);
        return t;
    }
    // Oy hisobiga kiradigan o'quvchilar: hozirgilari + ustoz almashgan (o'tgan) o'quvchilar, agar shu oyda kamida bir dars kuni
    // shu ustozda bo'lgan bo'lsa (s.teacherHistory). past — /api/state pastStudents (faqat o'z davri belgilari bilan).
    function withPast(current, past, id, month) {
        const ids = new Set((current || []).map(s => s.id)), cal = calendar();
        const extra = (past || []).filter(s => s && !ids.has(s.id) && s.teacherId !== id && (s.teacherHistory || []).some(h => (h.teacherId ?? h.teacher_id) === id)
            && cal.cells(month, cal.weekdays(s, null, 'main')).some(c => c && c.scheduled && taughtOn(s, id, c.date)));
        return [...(current || []), ...extra];
    }
    // O'quvchining SANA bo'yicha holati (school_student_status yozuvlari): 'active' | 'frozen' | 'left'.
    // Yozuvlar sana, keyin yaratilgan vaqt bo'yicha qo'llanadi; bekor qilinganlar hisobga olinmaydi.
    // server/services/school/schedule.js statusOn shu funksiyani ishlatadi (bitta ta'rif).
    function statusOn(statusRows, date) {
        let state = 'active';
        const ts = v => (v instanceof Date ? v.getTime() : Date.parse(v) || 0);
        // Qator: school_student_status ({from_date, to_date, created_at}) yoki /api/state statusHistory ({from, to, at}).
        const fromOf = r => dkey(r.from_date ?? r.from), toOf = r => dkey(r.to_date ?? r.to) || null;
        const rows = [...(statusRows || [])].filter(r => !r.cancelled_at)
            .sort((a, b) => fromOf(a).localeCompare(fromOf(b)) || ts(a.created_at ?? a.at) - ts(b.created_at ?? b.at));
        for (const r of rows) {
            const from = fromOf(r), to = toOf(r);
            if (from > date) continue;
            if (r.status === 'frozen') { if (!to || date <= to) state = 'frozen'; else if (state === 'frozen') state = 'active'; }
            else if (r.status === 'left') state = 'left';
            else if (r.status === 'restored') state = 'active';
        }
        return state;
    }
    // Shu sanada faolmi — "faol o'quvchi"ning sana bo'yicha ta'rifi (yordamchi tavsiyasi, haftalik reja, bildirishnomalar).
    // Holat yozuvlari bo'lsa — sana bo'yicha (muzlatish/qaytish/chiqib ketish sanalari); bo'lmasa — isActiveStudent (flaglar).
    // Demo xodim va eski "inactive" belgisi har doim nofaol.
    function activeOn(s, statusRows, date) {
        if (!s) return false;
        const x = extraOf(s) || s;
        if (x.isStaffDemo === true || s.staffDemo === true || s.legacyInactive === true) return false;
        const rows = (statusRows || []).filter(r => !r.cancelled_at);
        if (!rows.length) return isActiveStudent(s);
        return statusOn(rows, date) === 'active';
    }
    // Shu kundagi dars (Keldi / qoplash) hisobga o'tadimi — o'quvchi faolligi bo'yicha (asosiy ustoz davomati va maosh uchun).
    // Holat yozuvlari bo'lsa — sana bo'yicha (statusOn === 'active'). Yozuv yo'q bo'lsa — eski o'quvchi: kun cheklanmaydi
    // (o'quvchi qaysi sanadan muzlatilgani/ketgani noma'lum; oy hisobi esa uni inMonth bilan isActiveStudent bo'yicha oladi).
    // Demo xodim va eski "inactive" belgisi — hech qachon.
    function lessonCountsOn(s, statusRows, date) {
        if (!s) return false;
        const x = extraOf(s) || s;
        if (x.isStaffDemo === true || s.staffDemo === true || s.legacyInactive === true) return false;
        const rows = (statusRows || []).filter(r => !r.cancelled_at);
        return !rows.length || statusOn(rows, dkey(date)) === 'active';
    }
    // Oy hisobiga (Davomat "Oktyabr" kartasi, reyting) kiradimi: holat yozuvlari bo'lsa — oyning kamida bir kunida faol
    // (masalan 20-oktdan muzlatilgan o'quvchining 1–19-okt darslari sanaladi, maosh bilan bir xil); bo'lmasa — isActiveStudent.
    function inMonth(s, statusRows, month) {
        if (!s) return false;
        const rows = (statusRows || []).filter(r => !r.cancelled_at);
        if (!rows.length) return isActiveStudent(s);
        const [y, m] = String(month).split('-').map(Number), last = new Date(Date.UTC(y, m, 0)).getUTCDate();
        for (let d = 1; d <= last; d++) if (lessonCountsOn(s, rows, `${month}-${String(d).padStart(2, '0')}`)) return true;
        return false;
    }
    // Haftalik tavsiya soni ("Bu hafta 12 / 47", Dars jadvali "47 tavsiya", "3 tadan kam" bildirishnomasi) — bitta hisob:
    // /api/school/assist/plan bandlaridan o'quvchi+kun juftliklari: tavsiya (o'quvchi shu kuni faol) + tavsiya kunidagi aloqa
    // (u shu kungi tavsiyaning o'rnini oladi, server `advice: true` belgisini qo'yadi). Tavsiyadan tashqari aloqalar kirmaydi.
    function weekPlanSlots(items) {
        const out = new Map();
        for (const i of items || []) {
            if (i.kind !== 'advice' && !(i.kind === 'contact' && i.advice === true)) continue;
            if (!out.has(i.studentId)) out.set(i.studentId, new Set());
            out.get(i.studentId).add(i.date);
        }
        return out;
    }
    function weekPlanCount(items) { let n = 0; for (const set of weekPlanSlots(items).values()) n += set.size; return n; }
    // Yordamchi: o'quvchining shu oydagi aloqa rejasi — YordamchiDavomat "Oktyabr" ustuni maxraji va YordamchiBosh
    // "mumkin bo'lgan aloqa" (jami = qatorlar yig'indisi). Oy davomida faol o'quvchi — oylik chegara (13); oyning bir qismida
    // faol bo'lmagan (muzlatilgan / qaytgan / chiqib ketgan) — faqat faol kunlardagi tavsiya kunlari, chegaradan oshmaydi.
    // adviceWeekdays — tavsiya hafta kunlari (1 = Du … 7 = Ya).
    function assistMonthPlan(s, statusRows, month, adviceWeekdays, cap) {
        const [y, m] = String(month).split('-').map(Number), last = new Date(Date.UTC(y, m, 0)).getUTCDate();
        let all = true, adv = 0;
        for (let d = 1; d <= last; d++) {
            const date = `${month}-${String(d).padStart(2, '0')}`;
            if (!activeOn(s, statusRows, date)) { all = false; continue; }
            if ((adviceWeekdays || []).includes(new Date(`${date}T00:00:00Z`).getUTCDay() || 7)) adv++;
        }
        return all ? cap : Math.min(cap, adv);
    }
    // Yordamchi: oy oxirigacha ko'pi bilan nechta aloqa hisoblanishi mumkin (server assist.remaining bilan bir xil):
    // har o'quvchida min(cap, hisoblangan + qolgan tavsiya kunlari).
    function assistPossible(counted, adviceLeft, cap) {
        return Math.min(cap, (Number(counted) || 0) + (Number(adviceLeft) || 0));
    }
    return Object.freeze({ INACTIVE, isActiveStudent, statusOn, activeOn, lessonCountsOn, inMonth, weekPlanSlots, weekPlanCount, monthTotals, assistPossible,
        teacherOn, taughtOn, missedCame, reviewMakeups, withPast, assistMonthPlan });
});
