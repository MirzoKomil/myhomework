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
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
    setInterval(mount, 60000);
}());
