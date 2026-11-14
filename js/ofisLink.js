// "Jonli ofis" tugmasi (/ofis): har bir kabinetning telefon sarlavhasida qo'ng'iroqcha yonida chiqadi.
// Kabinetlar sarlavhani o'zi qayta chizadi, shuning uchun qo'ng'iroqcha (aria-label "Bildirishnomalar...") topilib,
// uning yoniga xuddi shu ko'rinishdagi tugma qo'yiladi. Kompyuter sarlavhasida tugma index.html'da (#ofisLink).
(() => {
    const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M16 9h2a2 2 0 012 2v10M3 21h18M8 7h1M11 7h1M8 11h1M11 11h1M8 15h1M11 15h1"/></svg>';
    function scan() {
        document.querySelectorAll('[aria-label^="Bildirishnomalar"]').forEach(bell => {
            if (bell.hasAttribute('data-br-notify') || bell.closest('.header-actions')) return;
            const prev = bell.previousElementSibling;
            if (prev && prev.hasAttribute('data-ofis-link')) return;
            const a = document.createElement('a');
            a.href = '/ofis';
            a.className = bell.className;
            a.setAttribute('data-ofis-link', '');
            a.setAttribute('aria-label', 'Jonli ofis');
            a.title = 'Jonli ofis';
            a.innerHTML = ICON;
            a.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;text-decoration:none;color:inherit;margin-right:8px';
            bell.before(a);
        });
    }
    let t = null;
    // Debounce emas, throttle: ba'zi kabinetlar har soniyada qayta chiziladi — kutish tugamay qolmasin.
    new MutationObserver(() => { if (!t) t = setTimeout(() => { t = null; scan(); }, 120); })
        .observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', scan);
    scan();
})();
