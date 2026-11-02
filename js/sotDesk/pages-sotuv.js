// Sotuv menejeri kompyuter kabineti — Sotuv rejasi, Reyting, Statistika (mening voronkam), Skriptlar.
// Dizayn: SotK_Plan, SotK_Rating, SotK_Funnel, SotK_Scripts. Faqat role=sales_manager va ekran >900px (body.sot-desk-v2).
// Asl render funksiyalari (renderSalesPlan*, renderRating/renderLeaderboardSection, renderSalesFunnel, renderScripts)
// o'zgarmaydi va hamon chaqiriladi — ustidan sarlavha (sotDeskPages.register → #rdpSalesHead), qo'shimcha DOM va
// css/sotDeskPages.css qo'shiladi. Ma'lumot faqat mavjud manbalardan: getIndividualSalesPlan, getManagerSalesForMonth,
// getLeadStatsForRankings/_getLeadRankingAmount (reyting manbai), DAILY_BONUSES/MONTHLY_BONUSES (getMergedBonus).
// Prod cheklovlari: reja — faqat ko'rish (ropSotuvNav.lockPlan); skriptlar — faqat o'qish (PATCH /api/state
// sales_manager'dan scripts kalitini qabul qilmaydi, shu sabab tahrir/o'chirish/qo'shish tugmalari olib tashlanadi).
(function () {
    'use strict';
    const SP = window.sotDeskPages; if (!SP) return;
    const U = SP.U, esc = U.esc, g = U.g;
    const on = () => U.isSotDesk();
    const mid = () => String(U.user().linkedManagerId || '');
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const UZM = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    const p2 = n => String(n).padStart(2, '0');
    const dayKey = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    const monthKey = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
    const mlnN = n => String(Math.round((Number(n) || 0) / 1e5) / 10).replace('.', ',');
    const mln = n => (g('fmtMln') ? fmtMln(n) : `${mlnN(n)} mln soʻm`);
    const mlnS = n => mln(n).replace(' soʻm', '');
    const parseT = v => { if (!v) return 0; if (typeof v === 'number') return v; const s = String(v); const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00:00' : s); return Number.isFinite(t) ? t : 0; };
    const when = t => {
        const d = new Date(t), now = new Date();
        const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const hm = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
        if (dayKey(d) === dayKey(now)) return `Bugun, ${hm}`;
        if (dayKey(d) === dayKey(y)) return `Kecha, ${hm}`;
        return `${d.getDate()}-${MON[d.getMonth()].slice(0, 3)}, ${hm}`;
    };
    const SVG = (d, s = 16, w = 2) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
    const IC = { check: 'M5 12.5l4.5 4.5L19 7', lock: 'M7 11V7a5 5 0 0110 0v4M5 11h14v10H5z', arrow: 'M5 12h14M13 6l6 6-6 6' };

    // O'z wrap'imiz (bayroq boshqacha — ropSotuvNav __rs va ropDeskPages __rdp o'ramlari bilan to'qnashmaydi).
    function hook(name, after) {
        const orig = window[name];
        if (typeof orig !== 'function' || orig.__sotp) return;
        const fn = function (...a) { const r = orig.apply(this, a); try { if (on()) after(...a); } catch (e) { console.warn('[sotDeskPages]', name, e); } return r; };
        fn.__sotp = true;
        window[name] = fn;
    }

    // ==================== Sotuv rejasi ====================
    const spMain = () => document.querySelector('[data-sales-panel="sales-plan"] [data-sp-main].active')?.dataset.spMain || 'individual';
    SP.register('plan', {
        tab: 'sales',
        head: () => ({
            title: 'Sotuv rejasi', sub: spMain() === 'jamoaviy' ? 'Jamoa rejasi kalkulyatori va shu oy natijasi' : 'Shaxsiy oylik rejangiz va uning bajarilishi',
            right: `<div class="rdp-seg sot-seg" role="group" aria-label="Reja turi">${[['individual', 'Mening rejam'], ['jamoaviy', 'Jamoaviy reja']].map(([k, l]) => `<button type="button" data-sot-spmain="${k}" aria-pressed="${spMain() === k}">${l}</button>`).join('')}</div>`
        }),
        after: () => decoratePlan()
    });
    function planHead() {
        const h = document.getElementById('rdpSalesHead'); if (!h || document.body.dataset.rdp !== 'plan') return;
        U.salesHead(SP.PAGES.plan);
        h.querySelectorAll('[data-sot-spmain]').forEach(b => b.onclick = () => {
            document.querySelector(`[data-sales-panel="sales-plan"] [data-sp-main="${b.dataset.sotSpmain}"]`)?.click();
        });
    }

    // Reyting manbai (getLeadStatsForRankings) bo'yicha o'z to'lovlarim — mobil "Rejam" (sotuvApp.js screenPlan) hisobi.
    // Sotuv menejeriga statistika PII'siz keladi (ism/ID yo'q), shu sabab "So'nggi to'lovlar" ro'yxati ismlar bilan
    // o'z lidlarimdan (server faqat o'z lidlarini beradi) xuddi shu hisob bilan olinadi; kunlik ustunlar — reyting manbaidan.
    function paidOf(pool) {
        const owner = l => (window.staffStatus?.saleOwner ? staffStatus.saleOwner(l) : (l.saleManagerId || l.managerId));
        const st = l => (g('normalizeLeadStatus') ? normalizeLeadStatus(l.status) : l.status);
        const out = [];
        pool.filter(l => l && !l.deletedAt && String(owner(l)) === mid()).forEach(l => {
            const s = st(l);
            const partial = g('_isPartialInProgressLead') ? _isPartialInProgressLead(l) : (s === 'tolov-jarayonida' && l.paymentSurvey?.paymentType === 'partial' && Number(l.paymentSurvey?.paidAmount) > 0);
            if (s !== 'tolov-yopildi' && !partial) return;
            const t = parseT(g('_getLeadRankingDate') ? _getLeadRankingDate(l) : (l.paymentClosedSurvey?.closedDate || l.closedDate || l.createdAt));
            const v = g('_getLeadRankingAmount') ? _getLeadRankingAmount(l) : 0;
            if (t) out.push({ t, v, name: l.name || '' });
        });
        return out.sort((a, b) => b.t - a.t);
    }
    function myPayments() {
        const now = new Date();
        const days = [...Array(14)].map((_, i) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13 + i); return { d, k: dayKey(d), v: 0 }; });
        paidOf(g('getLeadStatsForRankings') ? getLeadStatsForRankings() : []).forEach(p => { const day = days.find(x => x.k === dayKey(new Date(p.t))); if (day) day.v += p.v; });
        const all = g('getItem') ? getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) : {};
        return { days, paid: paidOf([...(all.english || []), ...(all.russian || [])]) };
    }
    const merged = list => (list || []).map(b => (g('getMergedBonus') ? getMergedBonus(b) : b));
    const prizeIc = (id, size = 36) => (typeof PRIZE_IMAGES !== 'undefined' && PRIZE_IMAGES[id] ? `<img src="images/prizes/${PRIZE_IMAGES[id]}" alt="" width="${size}" height="${size}" loading="lazy">` : '');

    function heroHtml(oy, plan, act, deals) {
        const now = new Date(), isNow = oy === monthKey(now);
        const [yy, mm] = oy.split('-').map(Number);
        const daysIn = new Date(yy, mm, 0).getDate();
        const a = Number(plan.totalAmount) || 0;
        const pctRaw = a > 0 ? Math.round(act / a * 100) : 0, pct = Math.min(100, pctRaw);
        const due = isNow ? Math.round(a * now.getDate() / daysIn) : 0;
        const duePct = a > 0 ? Math.min(100, Math.round(due / a * 100)) : 0;
        const forecast = isNow ? Math.round(act / Math.max(1, now.getDate()) * daysIn) : 0;
        const fut = oy > monthKey(now);
        const footR = isNow ? (forecast < a ? `Shu tempda ${mlnS(forecast)} — rejaga ${mlnS(a - forecast)} yetmaydi` : `Shu tempda ${mlnS(forecast)} — reja bajariladi`)
            : fut ? 'Oy hali boshlanmagan' : (pctRaw >= 100 ? 'Reja bajarilgan' : 'Oy yopilgan');
        return `<section class="sot-ph" aria-label="Shaxsiy reja">
            <span class="sot-ph-k">SHAXSIY REJA · ${esc(UZM[mm - 1].toUpperCase())} ${yy}</span>
            <div class="sot-ph-big"><b>${mlnN(act)}</b><span>/ ${mlnN(a)} mln soʻm</span></div>
            <p class="sot-ph-sub">${deals} ta toʻlov${deals ? ` · oʻrtacha chek ${U.num(Math.round(act / deals))} soʻm` : ''}</p>
            <div class="sot-ph-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${pctRaw}% bajarildi${isNow ? `, bugungacha ${duePct}% kerak edi` : ''}"><i style="width:${pct}%;background:${pctRaw >= 100 ? '#4ADE80' : '#60A5FA'}"></i>${isNow ? `<em style="left:${duePct}%" title="Bugungacha shu yerda boʻlish kerak"></em>` : ''}</div>
            <div class="sot-ph-foot"><span><b>${pctRaw}%</b> bajarildi</span><span>${esc(footR)}</span></div>
        </section>`;
    }
    function sideHtml(sales, pay) {
        const today = pay.days[13].v;
        const bonus = merged(typeof DAILY_BONUSES !== 'undefined' ? DAILY_BONUSES : []).filter(b => Number(b.threshold) > 0);
        const gifts = merged(typeof MONTHLY_BONUSES !== 'undefined' ? MONTHLY_BONUSES : []).filter(b => Number(b.threshold) > 0);
        return `${bonus.length ? `<section class="rdp-card sot-pc" aria-labelledby="sotBonH"><div class="sot-pc-h"><h2 id="sotBonH">Bugungi bonus</h2><span>bugun ${esc(mln(today))}</span></div>
              <div class="sot-tiers">${bonus.map(b => { const ok = today >= b.threshold; return `<div class="sot-tier${ok ? ' is-ok' : ''}"><b>${esc(b.label)}</b><span>${esc(mln(b.threshold))}</span><em>${ok ? `${SVG(IC.check, 13, 3)} olindi` : `${esc(mln(b.threshold - today))} qoldi`}</em></div>`; }).join('')}</div></section>` : ''}
            <section class="rdp-card sot-pc" aria-labelledby="sotPayH"><div class="sot-pc-h"><h2 id="sotPayH">Soʻnggi toʻlovlar</h2></div>
              ${pay.paid.length ? `<ul class="sot-pays">${pay.paid.slice(0, 5).map(p => `<li><span class="sot-ok">${SVG(IC.check, 14, 3)}</span><span class="sot-pays-t"><b>${esc(p.name || 'Toʻlov')}</b><small>${esc(when(p.t))}</small></span><b class="sot-num">${U.num(p.v)}</b></li>`).join('')}</ul>` : '<p class="rdp-mt sot-none">Shu oy hali toʻlov yoʻq</p>'}</section>
            ${gifts.length ? `<section class="rdp-card sot-pc" aria-labelledby="sotGiftH"><div class="sot-pc-h"><h2 id="sotGiftH">Oylik sovgʻalar</h2></div>
              <div class="sot-gifts">${gifts.map(b => { const ok = sales >= b.threshold; return `<div class="sot-gift${ok ? ' is-ok' : ''}">${prizeIc(b.id) || `<span class="sot-gift-e">${esc(b.icon || '🎁')}</span>`}<b>${esc(b.label)}</b><span>${ok ? 'olindi' : `${esc(mln(b.threshold - sales))} qoldi`}</span></div>`; }).join('')}</div></section>` : ''}`;
    }
    function dailyHtml(pay) {
        const days = pay.days, max = Math.max(1, ...days.map(x => x.v));
        const best = days.reduce((a, b) => (b.v > a.v ? b : a), days[0]);
        const lab = d => `${d.getDate()}-${MON[d.getMonth()].slice(0, 3)}`;
        return `<div class="sot-pc-h"><h2 id="sotDayH">Kunlik tushum</h2><span>soʻnggi 14 kun</span></div>
            <div class="sot-bars" role="img" aria-label="Soʻnggi 14 kundagi tushum${best.v ? `, eng yaxshi kun ${lab(best.d)} — ${mln(best.v)}` : ''}">${days.map((x, i) => `<span class="${i === 13 ? 'is-today' : x === best && x.v ? 'is-best' : ''}" style="height:${x.v ? Math.max(4, Math.round(x.v / max * 100)) : 2}%" title="${lab(x.d)} · ${esc(mln(x.v))}"></span>`).join('')}</div>
            <div class="sot-bars-l"><span>${lab(days[0].d)}</span>${best.v ? `<span>eng yaxshi: ${lab(best.d)} · ${esc(mln(best.v))}</span>` : '<span>bu davrda toʻlov yoʻq</span>'}<span>Bugun</span></div>`;
    }

    function decoratePlan() {
        if (!on() || document.body.dataset.rdp !== 'plan') return;
        planHead();
        const panel = document.querySelector('[data-sales-panel="sales-plan"]'); if (!panel) return;
        const ro = panel.querySelector('.rs-ro');
        if (ro && !ro.querySelector('svg')) ro.insertAdjacentHTML('afterbegin', SVG(IC.lock, 15));
        const content = document.getElementById('spIndContent'), card = document.getElementById('spIndPlanCard');
        if (!content || !card || spMain() !== 'individual' || !mid()) return;
        content.classList.add('sot-plan-grid');
        const oy = document.getElementById('spIndPlanMonthSelect')?.value || monthKey(new Date());
        const plan = g('getIndividualSalesPlan') ? getIndividualSalesPlan(mid(), oy) : {};
        const act = g('getManagerSalesForMonth') ? getManagerSalesForMonth(mid(), oy) : 0;
        const deals = g('getManagerDealsCountForMonth') ? getManagerDealsCountForMonth(mid(), oy) : 0;
        // Qora "SHAXSIY REJA" kartasi — oddiy progress satri o'rnida (u CSS bilan yashiriladi, o'chirilmaydi).
        card.querySelector('.sot-ph')?.remove();
        const hasPlan = (Number(plan.totalAmount) || 0) > 0;
        card.classList.toggle('sot-has-ph', hasPlan);
        if (hasPlan) card.querySelector('.sp-card-h')?.insertAdjacentHTML('afterend', heroHtml(oy, plan, act, deals));
        // Asl izoh "Tahrirlab saqlasangiz…" — sotuv menejeri tahrirlay olmaydi, shu sabab matn ko'rish rejimiga moslanadi.
        const ml = k => (g('monthKeyLabel') ? monthKeyLabel(k) : k);
        if (plan.carriedOverFrom) card.querySelectorAll('.sp-notice--info').forEach(n => { n.textContent = `Bu reja ${ml(plan.carriedOverFrom)} oyidan avtomatik koʻchirilgan. Admin ${ml(oy)} uchun alohida reja belgilasa, oʻsha qoʻllanadi.`; });
        if (plan.legacy) card.querySelectorAll('.sp-notice:not(.sp-notice--info)').forEach(n => { n.textContent = 'Bu reja oyi koʻrsatilmagan eski yozuv — admin oy boʻyicha belgilagach shu yerda yangilanadi.'; });
        // Kunlik tushum, bugungi bonus, so'nggi to'lovlar, oylik sovg'alar — joriy oy (mobil "Rejam" bilan bir xil manba).
        const pay = myPayments();
        const sales = g('getManagerSalesForMonth') ? getManagerSalesForMonth(mid(), monthKey(new Date())) : act;
        let daily = document.getElementById('sotPlanDaily');
        if (!daily) { daily = document.createElement('section'); daily.id = 'sotPlanDaily'; daily.className = 'card rdp-card sot-pc sot-daily'; daily.setAttribute('aria-labelledby', 'sotDayH'); content.appendChild(daily); }
        daily.innerHTML = dailyHtml(pay);
        let side = document.getElementById('sotPlanSide');
        if (!side) { side = document.createElement('aside'); side.id = 'sotPlanSide'; side.className = 'sot-plan-side'; side.setAttribute('aria-label', 'Bonus va toʻlovlar'); content.appendChild(side); }
        side.innerHTML = sideHtml(sales, pay);
    }
    hook('renderSalesPlan', () => decoratePlan());
    hook('renderSalesPlanIndividualPlanCard', () => decoratePlan());

    // ==================== Reyting ====================
    // ropSotuvNav.ratingView sotuvda ham ishlaydi (sarlavha/ichki tablarni boshqaradi, sotuvda "Ustozlar" yo'q) —
    // bu yerda faqat sahifa sarlavhasi, davr satri, o'z o'rnim kartasidagi "Lidlarga" va jadvaldagi "Siz" qatori.
    const PER = { kunlik: 'Bugun', haftalik: 'Shu hafta', oylik: 'Shu oy' };
    SP.register('rating', {
        tab: 'sales',
        head: () => ({ title: 'Reyting', sub: `Sotuv menejerlari · ${esc(U.langLabel())} yoʻnalishi` }),
        after: () => decorateRating()
    });
    function periodText() {
        const per = typeof _ratingPeriod !== 'undefined' ? _ratingPeriod : 'oylik';
        const d = new Date();
        if (per === 'kunlik') return `Bugun · ${d.getDate()}-${MON[d.getMonth()]}`;
        if (per === 'haftalik') { const s = new Date(d); s.setDate(d.getDate() - ((d.getDay() || 7) - 1)); return `Shu hafta · ${s.getDate()}-${MON[s.getMonth()].slice(0, 3)} – ${d.getDate()}-${MON[d.getMonth()].slice(0, 3)}`; }
        return `${UZM[d.getMonth()]} · 1–${d.getDate()}-kun`;
    }
    function decorateRating() {
        if (!on() || document.body.dataset.rdp !== 'rating') return;
        const panel = document.querySelector('[data-sales-panel="rating"]'); if (!panel) return;
        const tabs = panel.querySelector('.rating-main-tabs');
        let per = document.getElementById('sotRtPer');
        const lb = typeof _ratingSection === 'undefined' || _ratingSection === 'leaderboard';
        if (tabs && lb) {
            if (!per) { per = document.createElement('p'); per.id = 'sotRtPer'; per.className = 'sot-rt-per'; tabs.after(per); }
            per.textContent = periodText(); per.hidden = false;
        } else if (per) per.hidden = true;
        const me = (g('getSalesManagers') ? getSalesManagers() : []).find(m => String(m.id) === mid());
        // O'z o'rnim kartasi → "Lidlarga" (Lidlar bo'limi).
        const card = panel.querySelector('#ratingLeaderboard .mot-me');
        if (card && !card.querySelector('.sot-rt-go')) {
            card.insertAdjacentHTML('beforeend', `<button type="button" class="rdp-btn sot-rt-go">Lidlarga</button>`);
            card.querySelector('.sot-rt-go').onclick = () => (g('switchSalesSection') ? switchSalesSection('leads') : SP.open('leads'));
        }
        // Natijalar jadvalida o'z qatorim ajratiladi (asl jadvalda menejer ID yo'q — ism bo'yicha).
        if (me?.name) {
            panel.querySelectorAll('#ratingLeaderboard table tbody tr').forEach(tr => {
                const nm = tr.querySelector('td:nth-child(2) strong');
                const mine = nm && nm.textContent.trim() === String(me.name).trim();
                tr.classList.toggle('sot-rt-me', !!mine);
                if (mine && !nm.querySelector('.sot-me-chip')) nm.insertAdjacentHTML('beforeend', ' <span class="sot-me-chip">Siz</span>');
            });
        }
    }
    hook('renderRating', () => decorateRating());
    hook('renderLeaderboardSection', () => decorateRating());

    // ==================== Statistika = Mening voronkam ====================
    // renderSalesFunnel sotuv menejeri uchun allaqachon o'z lidlariga cheklaydi (_salesFunnelMgrIds = [linkedManagerId]).
    SP.register('funnel', {
        tab: 'sales',
        head: () => ({ title: 'Mening voronkam', sub: 'Statistika · faqat sizga biriktirilgan lidlar hozir qaysi bosqichda turgani', chipRight: true })
    });

    // ==================== Skriptlar (faqat o'qish) + Yo'riqnomalar ====================
    const SC = { tab: 'scr' };
    const scriptCount = () => { const lg = U.lang(); return (g('getItem') ? getItem(STORAGE_KEYS.scripts, []) : []).filter(s => (s.lang || 'english') === lg).length; };
    const guideNew = () => {
        // Yo'riqnomalar ro'yxati (staffGuides bilan bir xil filtr); "yangi" soni faqat tanishganlik holati ma'lum bo'lsa.
        const tags = g('resolveGuideAudienceTags') ? resolveGuideAudienceTags(U.user()) : [];
        const list = (g('getItem') ? getItem(STORAGE_KEYS.guides, []) : []).filter(x => (x.targetRoles || []).some(t => tags.includes(t)));
        return { n: list.length, fresh: SC.acks ? list.filter(x => !SC.acks.has(x.id)).length : null };
    };
    function loadAcks() {
        if (SC.acksBusy || SC.acks || !g('apiFetch')) return;
        SC.acksBusy = true;
        Promise.resolve(apiFetch('/api/staff/guides/acks/mine', { fresh: true }))
            .then(r => { SC.acks = new Set((r?.acks || []).map(a => a.guideId)); })
            .catch(() => { SC.acks = null; })
            .finally(() => { SC.acksBusy = false; if (document.body.dataset.rdp === 'script') scriptHead(); });
    }
    SP.register('script', {
        tab: 'sales',
        head: () => ({
            title: 'Skriptlar',
            sub: SC.tab === 'gd' ? 'Lavozimingizga tegishli qoidalar · yangilari tepada' : `${esc(U.langLabel())} yoʻnalishi · ${scriptCount()} ta maqola · sotuvchilar uchun kurs maʼlumotlari ensiklopediyasi`
        }),
        after: () => decorateScripts()
    });
    function scriptHead() {
        const h = document.getElementById('rdpSalesHead'); if (!h || document.body.dataset.rdp !== 'script') return;
        U.salesHead(SP.PAGES.script);
        const gn = guideNew();
        h.insertAdjacentHTML('beforeend', `<div class="sot-sc-tabs" role="tablist" aria-label="Skriptlar va yoʻriqnomalar">
            <button type="button" role="tab" data-sot-sct="scr" aria-selected="${SC.tab === 'scr'}">Skriptlar <em class="sot-cnt">${scriptCount()}</em></button>
            <button type="button" role="tab" data-sot-sct="gd" aria-selected="${SC.tab === 'gd'}">Yoʻriqnomalar${gn.fresh ? ` <em class="sot-cnt sot-cnt--red">${gn.fresh} yangi</em>` : gn.n ? ` <em class="sot-cnt">${gn.n}</em>` : ''}</button></div>`);
        h.querySelectorAll('[data-sot-sct]').forEach(b => b.onclick = () => { SC.tab = b.dataset.sotSct; decorateScripts(); });
    }
    // Yo'riqnomalar staffGuides (js/staffSettings.js) bilan chiziladi: u #sgGuides'ni id bo'yicha topadi, shu sabab
    // tugun shu sahifaga vaqtincha ko'chiriladi va boshqa joyga o'tilganda #tab-guides'ga qaytariladi.
    function guidesHome() {
        const root = document.getElementById('sgGuides'), sec = document.getElementById('tab-guides');
        if (root && sec && root.parentNode !== sec) sec.appendChild(root);
    }
    function decorateScripts() {
        if (!on() || document.body.dataset.rdp !== 'script') { guidesHome(); return; }
        loadAcks();
        scriptHead();
        const panel = document.querySelector('[data-sales-panel="scripts"]'); if (!panel) return;
        // Faqat o'qish: qo'shish/tahrirlash/o'chirish tugmalari olib tashlanadi (server baribir saqlamaydi).
        panel.querySelectorAll('#addScriptBtn, [data-script-edit], [data-script-del], #scriptEditBtn, #scriptDeleteBtn').forEach(b => b.remove());
        panel.querySelectorAll('.scr-read-acts').forEach(x => x.remove());
        panel.querySelectorAll('#scriptsGrid .team-empty-state span').forEach(p => { if (/Maqola qoʻshish/.test(p.textContent)) p.textContent = 'Skriptlarni ROP yoki admin qoʻshadi — qoʻshilgach shu yerda chiqadi.'; });
        panel.classList.toggle('sot-sc-gd', SC.tab === 'gd');
        let box = document.getElementById('sotGuidesBox');
        if (SC.tab === 'gd') {
            if (!box) { box = document.createElement('div'); box.id = 'sotGuidesBox'; box.className = 'sot-guides'; panel.appendChild(box); }
            box.hidden = false;
            // "Tanishib chiqdim" bosilgach sarlavhadagi "N yangi" soni yangilanadi (staffGuides o'z holatini o'zi saqlaydi).
            box.onclick = e => { if (e.target.closest('[data-ack]')) setTimeout(() => { SC.acks = null; loadAcks(); }, 1200); };
            if (window.staffGuides && g('getItem')) {
                let root = document.getElementById('sgGuides');
                if (!root) { root = document.createElement('div'); root.id = 'sgGuides'; root.className = 'sg-root'; }
                if (root.parentNode !== box) box.appendChild(root);
                window.staffGuides.render();
            } else box.innerHTML = '<p class="rdp-mt">Yoʻriqnomalar yuklanmadi</p>';
        } else {
            if (box) box.hidden = true;
            guidesHome();
        }
    }
    hook('renderScripts', () => decorateScripts());
    // Har navigatsiyadan OLDIN #sgGuides o'z joyiga (#tab-guides) qaytariladi — Yo'riqnomalar sahifasi (renderMyGuides)
    // hech qachon yashirin skript bo'limiga chizmaydi; skriptlarda "Yo'riqnomalar" ochiq bo'lsa decorateScripts qayta oladi.
    ['switchTab', 'switchSalesSection'].forEach(name => {
        const orig = window[name];
        if (typeof orig !== 'function' || orig.__sotpB) return;
        const fn = function (...a) { try { guidesHome(); } catch (e) { /* */ } return orig.apply(this, a); };
        fn.__sotpB = true;
        window[name] = fn;
    });
})();
