// Telefon: holat paneli (soat, batareya) foni eng tepadagi sarlavha rangiga moslanadi — "tab ustida tab"
// ko'rinishi (kulrang tasma + oq sarlavha + chiziq) yo'qoladi. iPhone o'rnatilgan ilovada tasma sahifa fonidan,
// Android'da theme-color'dan olinadi — ikkalasi ham shu yerda yangilanadi. Faqat rang o'qiladi, hech narsa saqlanmaydi.
(function () {
    'use strict';
    if (!window.matchMedia || !window.matchMedia('(max-width: 900px)').matches) return;
    const meta = document.querySelector('meta[name="theme-color"]');
    let last = '';
    const solid = c => c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c);
    function topColor() {
        let el = document.elementFromPoint(Math.round(innerWidth / 2), 1);
        while (el && el !== document.documentElement) {
            const c = getComputedStyle(el).backgroundColor;
            if (solid(c)) return c;
            el = el.parentElement;
        }
        return getComputedStyle(document.body).backgroundColor;
    }
    function sync() {
        if (document.visibilityState !== 'visible') return;
        const c = topColor();
        if (!solid(c) || c === last) return;
        last = c;
        document.documentElement.style.backgroundColor = c;
        if (meta) meta.setAttribute('content', c);
    }
    let t = 0;
    const soon = () => { if (!t) t = setTimeout(() => { t = 0; sync(); }, 120); };
    const start = () => {
        sync();
        new MutationObserver(soon).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
        addEventListener('scroll', soon, { passive: true, capture: true });
        addEventListener('resize', soon);
        document.addEventListener('visibilitychange', soon);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
