// ROP kompyuter — "Sotuv" guruhi sahifalari: Voronka (sales-stats), Reyting va bonus, Sotuv rejasi, Qarzdorlar,
// Skript va yo'riqnoma. Asl render funksiyalari (renderSalesFunnel, renderRating, renderSalesPlan, renderDebtorsTable,
// renderScripts) va ularning mantiqi o'zgarmaydi — ROP'da faqat sahifa sarlavhasi (Sotuv tablari o'rniga) va dizayn
// ko'rinishi (css/ropDeskPages.css) qo'shiladi. Dizayn: RopK_Funnel, RopK_Rating, RopK_Plan, RopK_Debtors, RopK_Scripts.
(function () {
    'use strict';
    const P = window.ropDeskPages; if (!P) return;
    const U = P.U, esc = U.esc;
    const WD = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
    const p2 = n => String(n).padStart(2, '0');
    const today = () => { const d = new Date(); return `${WD[d.getDay()]}, ${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`; };

    // ---- Voronka ----
    P.register('funnel', { tab: 'sales', head: () => ({ title: 'Sotuv voronkasi', sub: `${esc(U.langLabel())} yoʻnalishi · lidlar hozir qaysi bosqichda turgani`, chipRight: true }) });

    // ---- Reyting va bonus ----
    // "Sotuv menejerlari · Ustozlar" almashtirgichi ropSotuvNav.ratingView'da (#rsRatingBar) — sarlavhaga ko'chiriladi
    // (asl tugmalar bosiladi, holat bitta joyda qoladi).
    const ratingView = () => (document.querySelector('#rsRatingBar [aria-pressed="true"]')?.dataset.rtv || 'sales');
    P.register('rating', {
        tab: 'sales',
        head: () => ({
            title: 'Reyting',
            sub: `${ratingView() === 'teachers' ? 'Ustozlar' : 'Sotuv menejerlari'} · ${esc(U.langLabel())} yoʻnalishi`,
            right: `<div class="rdp-seg rdp-seg--dark" role="group" aria-label="Reyting turi"><button type="button" data-rdp-rtv="sales" aria-pressed="${ratingView() !== 'teachers'}">Sotuv menejerlari</button><button type="button" data-rdp-rtv="teachers" aria-pressed="${ratingView() === 'teachers'}">Ustozlar</button></div>`
        }),
        after() {
            const h = document.getElementById('rdpSalesHead'); if (!h) return;
            h.querySelectorAll('[data-rdp-rtv]').forEach(b => b.onclick = () => {
                document.querySelector(`#rsRatingBar [data-rtv="${b.dataset.rdpRtv}"]`)?.click();
                U.salesHead(P.PAGES.rating); P.PAGES.rating.after();
            });
        }
    });

    // ---- Sotuv rejasi ----
    P.register('plan', { tab: 'sales', head: () => ({ title: 'Sotuv rejasi', sub: 'Lidlar, konversiya va budjet asosida sotuv rejasi va bajarilishi', chipRight: true }) });

    // ---- Qarzdorlar ----
    P.register('debt', {
        tab: 'sales',
        head: () => ({ title: 'Qarzdorlar', sub: `Roʻyxatda qoldigʻi bor barcha oʻquvchilar. <b>Muddati oʻtgan</b> — sotuv menejeri bilan kelishilgan sana oʻtib, qoldiq toʻlanmagan. Siz faqat ${esc(U.langLabel())} oʻquvchilarini koʻrasiz.`, right: `<span class="rdp-mt">Bugun: ${esc(today())}</span>` })
    });

    // ---- Skript va yo'riqnoma ----
    P.register('script', { tab: 'sales', head: () => ({ title: 'Skript va yoʻriqnoma', sub: `Sotuv skriptlari va yoʻriqnomalar · ${esc(U.langLabel())}`, chipRight: true }) });
})();
