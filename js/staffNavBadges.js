// Ustoz va yordamchi sidebari (UstozBosh, YordamchiBosh): son belgilari va sof yordamchida "Sinov darslari"ni yashirish.
// Sonlar bildirishnomalar voqealaridan (GET /api/staff/notify/feed, js/staffSettings.js → 'staff:feed' hodisasi):
//  • Akademik bo'lim — belgilanmagan davomat (attendance_unmarked);
//  • Sinov darslari — tasdiqlash kerak (trial_confirm) + natija kutilmoqda (trial_result).
// Boshqa rollarning sidebariga tegmaydi.
(function () {
    'use strict';
    const MAP = { 'teachers-section': ['attendance_unmarked'], 'trial-lessons': ['trial_confirm', 'trial_result'] };
    const TITLE = { 'teachers-section': 'belgilanmagan davomat', 'trial-lessons': 'sinov darslari: tasdiqlash yoki natija kutilmoqda' };
    const me = () => (typeof getCurrentUser === 'function' ? getCurrentUser() : null) || {};
    const item = tab => document.querySelector(`#sidebarMenu .menu-item[data-tab="${tab}"]`);
    let pureAssistant = false, last = [];

    // Sof yordamchi: HR lavozimi "yordamchi" va asosiy (o'zi dars beradigan) o'quvchisi yo'q.
    function applyRole(user = me()) {
        if (user?.role !== 'teacher') return;
        try {
            const hr = typeof getItem === 'function' ? getItem(STORAGE_KEYS.hrEmployees, []) : [];
            const students = typeof getItem === 'function' ? getItem(STORAGE_KEYS.students, []) : [];
            const tid = user.linkedTeacherId;
            const emp = hr.find(e => (tid && e.id === tid) || String(e.name || '').trim().toLowerCase() === String(user.name || '').trim().toLowerCase());
            pureAssistant = emp?.role === 'yordamchi' && !students.some(s => tid && s.teacherId === tid && s.status !== 'inactive');
        } catch { pureAssistant = false; }
        draw(last);
    }

    // Asosiy ustoz: "Akademik bo'lim" soni = shu oyda (bugungacha) davomati belgilanmagan darslar — Davomat sahifasidagi
    // oy kartasi va Bosh sahifa maosh kartasidagi "N belgilanmagan" bilan bitta hisob (AttendanceRules.monthTotals,
    // "Kelmadi" — school_absences). Bildirishnomalardagi voqealar faqat oxirgi 7 kunni oladi, shuning uchun son ulardan emas.
    const MON = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' });
    let unm = null, unmBusy = false;
    function ownMainStudents(tid) {
        const rules = window.AttendanceRules;
        // Shu oyda faol bo'lgan (AttendanceRules.inMonth) — Davomat oy kartasi bilan bitta ro'yxat.
        const month = dayFmt.format(new Date()).slice(0, 7);
        return (typeof getItem === 'function' ? getItem(STORAGE_KEYS.students, []) : []).filter(s => s.teacherId === tid && (rules ? rules.inMonth(s, s.statusHistory, month) : s.status !== 'inactive'));
    }
    async function loadUnmarked() {
        const u = me(), tid = u.linkedTeacherId;
        if (u.role !== 'teacher' || !tid || unmBusy || !window.AttendanceRules || !window.schoolUI) return;
        const students = ownMainStudents(tid);
        if (!students.length) { unm = null; draw(last); return; }
        unmBusy = true;
        try {
            const todayKey = dayFmt.format(new Date()), month = todayKey.slice(0, 7);
            const [ab, mk] = await Promise.all([window.schoolUI.api('/attendance/absences?month=' + month), window.schoolUI.api('/makeups').then(r => r.makeups || []).catch(() => [])]);
            const block = (getItem(STORAGE_KEYS.mainAttendance, {}) || {})[`${month}_${tid}`] || {};
            const mainAtt = window.teacherDutyUI?.mergeAbsences ? window.teacherDutyUI.mergeAbsences(block, ab.absences, tid) : block;
            const teacher = typeof resolveTeacherWithVirtual === 'function' ? resolveTeacherWithVirtual(tid) || {} : {};
            const all = window.AttendanceRules.withPast ? window.AttendanceRules.withPast(students, getItem(STORAGE_KEYS.pastStudents, []) || [], tid, month) : students;
            const t = window.AttendanceRules.monthTotals({ id: tid, month, students: all, mainAtt, makeups: mk, teacher, todayKey });
            unm = { month, n: t.unmarked };
        } catch { /* son bildirishnomalardan qoladi */ }
        unmBusy = false;
        draw(last);
    }
    function countFor(tab, events, u) {
        if (u.role !== 'teacher') return 0;
        if (tab === 'teachers-section' && unm && !pureAssistant) return unm.n;
        return new Set((events || []).filter(e => MAP[tab].includes(e.type)).map(e => e.id)).size;
    }
    function labelFor(tab, n) {
        if (tab === 'teachers-section' && unm && !pureAssistant) return `${MON[Number(unm.month.slice(5)) - 1]}: ${n} ta dars davomati belgilanmagan (Davomat)`;
        return `${n} ta ${TITLE[tab]}`;
    }

    function draw(events) {
        const u = me();
        for (const tab of Object.keys(MAP)) {
            const el = item(tab); if (!el) continue;
            let b = el.querySelector('.tgs-nb');
            const n = countFor(tab, events, u);
            if (tab === 'trial-lessons' && u.role === 'teacher') el.style.display = pureAssistant && !n ? 'none' : '';
            if (!n) { b?.remove(); continue; }
            if (!b) { b = document.createElement('span'); b.className = 'tgs-nb'; el.appendChild(b); }
            b.textContent = n > 99 ? '99+' : String(n);
            b.setAttribute('aria-label', labelFor(tab, n));
            b.title = labelFor(tab, n);
        }
    }

    window.addEventListener('staff:feed', e => { last = e.detail?.events || []; draw(last); loadUnmarked(); });
    // Davomat sahifasi oy hisobini chizganda — o'sha raqam darhol (qayta so'rovsiz).
    window.addEventListener('ustoz:month-unmarked', e => { const d = e.detail || {}; if (d.month === dayFmt.format(new Date()).slice(0, 7)) { unm = { month: d.month, n: Number(d.n) || 0 }; draw(last); } });
    // Davomat / sinov o'zgarganda sonlar darhol yangilansin.
    let t = null;
    const later = () => { clearTimeout(t); t = setTimeout(() => window.staffNotify?.refresh?.(), 800); };
    window.addEventListener('school:changed', later);
    window.addEventListener('school:changed', () => setTimeout(loadUnmarked, 900));
    // Ustoz/yordamchida "Sinov darslari" bandida bitta son belgisi (shu modul, .tgs-nb). js/trialUI.js o'z belgisini
    // (.tl-navcnt) qo'yadi — u ustozda yashiriladi (css/sozlamalar.css), lekin o'zgarsa (sinov tasdiqlandi, natija yozildi)
    // bu yerdagi son ham serverdan qayta olinadi — ikki joyda bir xil raqam.
    function watchTrial() {
        const el = item('trial-lessons');
        if (!el || el.dataset.tgsWatch) return;
        el.dataset.tgsWatch = '1';
        new MutationObserver(muts => { if (me().role === 'teacher' && muts.some(m => [...m.addedNodes, ...m.removedNodes, m.target].some(n => n.classList?.contains('tl-navcnt') || n.parentElement?.classList?.contains('tl-navcnt')))) later(); })
            .observe(el, { childList: true, subtree: true, characterData: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchTrial); else watchTrial();
    const applyRoleBase = applyRole;
    window.staffNavBadges = { applyRole: user => { applyRoleBase(user); watchTrial(); window.ustozShell?.refreshRole?.(); }, draw };
})();
