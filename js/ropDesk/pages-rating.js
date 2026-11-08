// ROP kompyuter: Reyting va Sotuv rejasi tasdiqlangan dizaynga moslash (asl sahifalar ustidan, funksiyalar saqlanadi).
(function(){
    'use strict';
    const P = window.ropDeskPages; if (!P) return;
    const U = P.U, esc = U.esc;
    const SOM = /so['ʻʼ‘’`]m/i;
    const mln = v => (v / 1e6).toFixed(1).replace('.', ',').replace(/,0$/, '') + ' mln';
    function tidyNumbers(root) {
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
        while (w.nextNode()) { const p = w.currentNode.parentElement; if (p && !['INPUT','TEXTAREA','SELECT','OPTION','SCRIPT','STYLE'].includes(p.tagName)) list.push(w.currentNode); }
        const big = new RegExp('\\d{1,3}(?:[ ,\\u00a0]\\d{3}){2,}(?:\\s*' + SOM.source + ')?', 'gi'), tail = new RegExp('mln\\s*' + SOM.source, 'gi');
        list.forEach(n => { const t = n.nodeValue.replace(big, m => mln(+m.replace(SOM, '').replace(/[^\d]/g, ''))).replace(tail, 'mln'); if (t !== n.nodeValue) n.nodeValue = t; });
    }
    let obedAll = false;
    function rating() {
        const box = document.getElementById('ratingLeaderboard'); if (!box || !P.isRopDesk() || box.querySelector('.st3-done')) return;
        const mark = document.createElement('i'); mark.className = 'st3-done'; mark.hidden = true; box.appendChild(mark);
        const team = box.querySelector('.mot-team'); if (team) { const s = team.querySelector('span'); if (s && s.firstChild && s.firstChild.nodeType === 3) s.firstChild.nodeValue = 'Shaxsiy rejalar yigʻindisi '; }
        box.querySelectorAll('.rtx-pod .rtx-place').forEach(e => { if (/^\d$/.test(e.textContent.trim())) e.textContent = e.textContent.trim() + '-oʻrin'; });
        box.querySelectorAll('.rtx-pod .rtx-meta').forEach(e => { if (!/reja/.test(e.textContent)) e.textContent += ' · reja yoʻq'; });
        const list = box.querySelector('.rtx-obed');
        if (list) {
            const items = [...list.children], apply = () => items.forEach((li, i) => { li.hidden = !obedAll && i >= 5; });
            apply();
            if (items.length > 5) { const b = document.createElement('button'); b.type = 'button'; b.className = 'st3-more'; const lab = () => { b.textContent = obedAll ? 'Qisqartirish' : 'Barchasi (' + items.length + ')'; }; lab(); b.onclick = () => { obedAll = !obedAll; apply(); lab(); }; list.after(b); }
        }
        const week = box.querySelector('.rtx-week'), prizes = box.querySelector('.mot-prizes-wrap');
        if (week && prizes) { prizes.before(week); const p = week.querySelector('.rtx-card-h p'); if (p && !/15 mln/.test(p.textContent)) p.textContent += ' · kamida 15 mln sotuv'; }
        if (prizes) {
            const h = prizes.querySelector('.mot-h');
            if (h && !prizes.querySelector('.st3-sub')) { const p = document.createElement('p'); p.className = 'st3-sub'; p.textContent = 'Har menejerning yoʻli'; h.after(p); }
            prizes.querySelectorAll('.mot-chips').forEach(c => { const a = [...c.children]; if (a.length > 4) { a.slice(4).forEach(x => { x.hidden = true; x.style.display = 'none'; }); const m = document.createElement('span'); m.className = 'mot-chip st3-plus'; m.textContent = '+' + (a.length - 4); c.appendChild(m); } });
        }
        box.querySelectorAll('.sdp-table td, .sdp-table td *').forEach(e => { if (e.children.length) return; const t = e.textContent.trim(); const med = { '🥇': '1', '🥈': '2', '🥉': '3' }[t]; if (med) e.textContent = med; else if (t.includes('🚩')) e.textContent = t.replace('🚩', '').trim(); });
        box.querySelectorAll('.rating-view-btn .team-ico-wrap').forEach(e => e.remove());
        box.querySelectorAll('.rtx-tiers *').forEach(e => { if (!e.children.length) e.textContent = e.textContent.replace(/(Obed(?: \+ [\d,]+)?)\s+(?=\d)/, '$1 · '); });
        tidyNumbers(box);
    }
    function plan() {
        const panel = document.querySelector('[data-sales-panel="sales-plan"]'); if (!panel || !P.isRopDesk()) return;
        const fact = panel.querySelector('.spx-fact');
        panel.querySelectorAll('.sp-period-tab').forEach(b => { const t = b.textContent.trim(); if (t === '10–20') b.textContent = '11–20'; else if (t === '20–30') b.textContent = '21–30'; });
        tidyNumbers(panel);
        panel.querySelectorAll('td,b,span').forEach(e => { if (!e.children.length && /^\+?\d+\.0%$/.test(e.textContent.trim())) e.textContent = e.textContent.replace('.0', ''); else if (!e.children.length && /^\d{1,3}(,\d{3})$/.test(e.textContent.trim())) e.textContent = e.textContent.replace(',', ' '); });
        if (!fact || !window.__st2 || !window.__st2.planHtml) return;
        let host = panel.querySelector('#st3Plan');
        if (!host) { host = document.createElement('div'); host.id = 'st3Plan'; host.className = 'st2'; const nav = panel.querySelector('.section-nav-item')?.parentElement; if (nav) nav.after(host); else panel.prepend(host); }
        fact.hidden = true; fact.style.display = 'none';
        const draw = () => { if (!host.isConnected) return; host.innerHTML = window.__st2.planHtml(); const b = host.querySelector('[data-st=openplan]'); if (b) b.remove(); };
        window.__st2.onAds = draw; draw();
    }
    const st = document.createElement('style'); st.textContent = '.st3-more{margin-top:8px;border:0;background:none;color:#0065D6;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.st3-sub{margin:2px 0 10px;font-size:13px;color:#4B5563}#st3Plan{margin:12px 0}'; document.head.appendChild(st);
    function hook() {
        U.wrap('renderRating', rating); U.wrap('renderSalesPlan', plan);
        // Reyting sahifasi bir necha yo'l bilan qayta chiziladi: chizilgandan keyin har safar moslanadi (st3-done takrorlanishni to'xtatadi).
        const salesTab = document.getElementById('tab-sales');
        if (salesTab) { let timer; new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(rating, 30); }).observe(salesTab, { childList: true, subtree: true }); }
        P.PAGES.rating && (P.PAGES.rating.head = (h => () => { const r = h(); r.title = 'Reyting va bonus'; r.sub = esc(U.langLabel()) + ' · bitim = toʻlov jarayonida + yopildi, summa — qabul qilingan pul'; return r; })(P.PAGES.rating.head));
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
})();
