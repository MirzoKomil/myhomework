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

    function draw(events) {
        const u = me();
        for (const tab of Object.keys(MAP)) {
            const el = item(tab); if (!el) continue;
            let b = el.querySelector('.tgs-nb');
            const n = u.role === 'teacher' ? new Set((events || []).filter(e => MAP[tab].includes(e.type)).map(e => e.id)).size : 0;
            if (tab === 'trial-lessons' && u.role === 'teacher') el.style.display = pureAssistant && !n ? 'none' : '';
            if (!n) { b?.remove(); continue; }
            if (!b) { b = document.createElement('span'); b.className = 'tgs-nb'; el.appendChild(b); }
            b.textContent = n > 9 ? '9+' : String(n);
            b.setAttribute('aria-label', `${n} ta ${TITLE[tab]}`);
        }
    }

    window.addEventListener('staff:feed', e => { last = e.detail?.events || []; draw(last); });
    // Davomat / sinov o'zgarganda sonlar darhol yangilansin.
    let t = null;
    const later = () => { clearTimeout(t); t = setTimeout(() => window.staffNotify?.refresh?.(), 800); };
    window.addEventListener('school:changed', later);
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
