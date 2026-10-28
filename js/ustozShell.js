// Ustoz/yordamchi kabineti qobig'i (UstozBosh, UstozDavomat dizaynlari): sidebar'dagi "H" belgili HOMEWORK logotipi
// va sarlavhadagi bugungi sana ("Chorshanba, 28-oktyabr"). Elementlar har doim qo'shiladi, lekin faqat
// body[data-role="teacher"] da ko'rinadi (css/ustozDavomat.css) — boshqa rollarning logotipi o'zgarmaydi.
(function () {
    'use strict';
    const WD = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    const MG = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    function dateText() {
        const t = new Date(Date.now() + 5 * 3600000); // Asia/Tashkent
        return `${WD[t.getUTCDay()]}, ${t.getUTCDate()}-${MG[t.getUTCMonth()]}`;
    }
    function mount() {
        const brand = document.querySelector('.sidebar-brand');
        if (brand && !brand.querySelector('.ud-brand')) {
            const el = document.createElement('span');
            el.className = 'ud-brand';
            el.innerHTML = '<span class="ud-logo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4v16M18 4v16M6 12h12"/></svg></span>HOMEWORK';
            brand.insertBefore(el, brand.firstChild);
        }
        const hdr = document.querySelector('.top-header');
        if (hdr && !hdr.querySelector('.ud-hdate')) {
            const d = document.createElement('span');
            d.className = 'ud-hdate';
            const toggle = hdr.querySelector('#sidebarToggle');
            if (toggle) toggle.after(d); else hdr.prepend(d);
        }
        const d = hdr?.querySelector('.ud-hdate');
        if (d) d.textContent = dateText();
        watchRole();
    }
    // Yuqori paneldagi lavozim: yordamchi ustoz (HR lavozimi "yordamchi") — "Yordamchi ustoz" (YordamchiSoz* dizaynlari),
    // asosiy ustoz — "Ustoz". app.js syncHeaderAvatar #userMeta'ni qayta yozadi — kuzatuvchi shu matnni tuzatib turadi.
    function roleLabel() {
        const u = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (u?.role !== 'teacher') return null;
        try {
            const hr = typeof getItem === 'function' ? getItem(STORAGE_KEYS.hrEmployees, []) : [];
            const emp = hr.find(e => u.linkedTeacherId && e.id === u.linkedTeacherId);
            return emp?.role === 'yordamchi' ? 'Yordamchi ustoz' : 'Ustoz';
        } catch { return null; }
    }
    function refreshRole() {
        const span = document.querySelector('#userMeta > span');
        const t = roleLabel();
        if (span && t && span.textContent !== t) span.textContent = t;
    }
    let mo = null;
    function watchRole() {
        const meta = document.getElementById('userMeta');
        if (!meta || mo) { refreshRole(); return; }
        mo = new MutationObserver(refreshRole);
        mo.observe(meta, { childList: true, subtree: true, characterData: true });
        refreshRole();
    }
    window.ustozShell = { refreshRole };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
    setInterval(mount, 60000);
}());
