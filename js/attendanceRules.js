// Asosiy ustoz davomati va "faol o'quvchi" — server (teacherRating, staffSettings) va CRM (Davomat, Bosh sahifa,
// bildirishnomalar, yordamchi sahifalari) uchun YAGONA ta'rif. Bir raqam hamma sahifada bir xil chiqishi uchun
// (BAHOLASH-MEZONI: "Bir manba: davomat %") formulani faqat shu yerda o'zgartiring.
//
//  • Faol o'quvchi: muzlatilmagan, kursni to'xtatmagan/tugatmagan/chiqib ketmagan (status), xodim demo emas.
//    Faol bo'lmagan o'quvchi rejaga, o'quvchilar soniga, "bugungi darslar"ga kirmaydi.
//  • Oy hisobi (2026-10 dan): o'quvchining o'z dars kunlaridagi "Keldi" + admin tasdiqlagan qoplash,
//    har o'quvchida oy rejasidan oshmaydi. O'quvchi boshlagan kundan oldingi kunlar kutilmaydi va sanalmaydi
//    (moliya bilan bir xil — payrollEngine studentStart).
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
    // Oy hisobi — UstozDavomat "Oktyabr" kartasi, UstozBosh maosh kartasi va Reyting davomati.
    // mainAtt: { [studentId]: { [day]: 1 | 0 } } ("Kelmadi" — 0, school_absences qo'shilgan bo'lishi mumkin).
    // makeups: school_makeups qatorlari (teacher_id, student_id, status, kind, held_date).
    function monthTotals({ id, month, students, mainAtt, makeups, teacher, todayKey }) {
        const cal = calendar(), strict = month >= '2026-10';
        const thisMonth = todayKey.slice(0, 7), todayDay = Number(todayKey.slice(8));
        const my = (makeups || []).filter(m => m.teacher_id === id && ['planned', 'review', 'approved'].includes(m.status));
        const t = { plan: 0, expected: 0, came: 0, absent: 0, unmarked: 0, approved: 0, review: 0, counted: 0, students: 0 };
        for (const s of (students || []).filter(isActiveStudent)) {
            const start = dkey(s.startDate || s.joinDate);
            const started = c => !start || c.date >= start;
            const past = c => started(c) && (month < thisMonth || (month === thisMonth && c.day <= todayDay));
            const cells = cal.cells(month, cal.weekdays(s, teacher, 'main')).filter(c => c && c.scheduled);
            const entries = (mainAtt || {})[s.id] || {}, plan = cells.length, gone = cells.filter(past);
            const days = new Set(cells.filter(c => started(c) && cal.status(entries[c.day]) === 'present').map(c => c.day));
            if (!strict) Object.entries(entries).forEach(([d, v]) => { if (cal.status(v) === 'present') days.add(Number(d)); });
            const came = gone.filter(c => days.has(c.day)).length, absent = gone.filter(c => cal.status(entries[c.day]) === 'absent').length;
            let n = days.size, appr = 0;
            const mine = my.filter(m => m.student_id === s.id && dkey(m.held_date).slice(0, 7) === month);
            if (strict) for (const m of mine.filter(m => m.status === 'approved')) {
                const hd = dkey(m.held_date), d = Number(hd.slice(8));
                if (start && hd < start) continue;
                if (m.kind === 'double') { n++; appr++; } else if (!days.has(d)) { days.add(d); n++; appr++; }
            }
            t.students++;
            t.plan += plan; t.expected += gone.length; t.came += came; t.absent += absent; t.unmarked += Math.max(0, gone.length - came - absent);
            t.approved += appr; t.review += mine.filter(m => m.status === 'review').length; t.counted += Math.min(n, plan);
        }
        t.ratio = t.expected ? Math.min(1, t.counted / t.expected) : null;
        t.pct = t.ratio == null ? null : Math.round(t.ratio * 100);
        return t;
    }
    // O'quvchining SANA bo'yicha holati (school_student_status yozuvlari): 'active' | 'frozen' | 'left'.
    // Yozuvlar sana, keyin yaratilgan vaqt bo'yicha qo'llanadi; bekor qilinganlar hisobga olinmaydi.
    // server/services/school/schedule.js statusOn shu funksiyani ishlatadi (bitta ta'rif).
    function statusOn(statusRows, date) {
        let state = 'active';
        const ts = v => (v instanceof Date ? v.getTime() : Date.parse(v) || 0);
        const rows = [...(statusRows || [])].filter(r => !r.cancelled_at)
            .sort((a, b) => dkey(a.from_date).localeCompare(dkey(b.from_date)) || ts(a.created_at) - ts(b.created_at));
        for (const r of rows) {
            const from = dkey(r.from_date), to = r.to_date ? dkey(r.to_date) : null;
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
    // Yordamchi: oy oxirigacha ko'pi bilan nechta aloqa hisoblanishi mumkin (server assist.remaining bilan bir xil):
    // har o'quvchida min(cap, hisoblangan + qolgan tavsiya kunlari).
    function assistPossible(counted, adviceLeft, cap) {
        return Math.min(cap, (Number(counted) || 0) + (Number(adviceLeft) || 0));
    }
    return Object.freeze({ INACTIVE, isActiveStudent, statusOn, activeOn, weekPlanSlots, weekPlanCount, monthTotals, assistPossible });
});
