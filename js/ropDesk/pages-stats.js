// ROP kompyuter: yangi Statistika (1-bo'lak). Dizayn: 'ROP kompyuter kabineti' -> Statistika doskalari.
// Faqat role=rop va kompyuter ekranda ishlaydi; boshqa rollarda renderSalesFunnel o'zgarmaydi.
// Lid CRM sanasi bo'yicha, sotuv va tushum to'lov sanasi bo'yicha. Sotuv = To'lov jarayonida + To'lov yopildi.
(function(){
    'use strict';
    const P = window.ropDeskPages; if (!P) return;
    const U = P.U, esc = U.esc, num = U.num;
    const MONTHS = ['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentyabr','oktyabr','noyabr','dekabr'];
    const fresh = () => ({ src: 'target', per: 'month', from: '', to: '', aFrom: '', aTo: '', mgrs: null, gone: false, side: 'leads', gender: '', age: '', region: '', goal: '', showAllM: false });
    let S = fresh(), ads = null, adsKey = '', animate = true;
    const AGE = [['17 gacha',0,17],['18–21',18,21],['22–25',22,25],['26–30',26,30],['31–35',31,35],['36–45',36,45],['46+',46,200]];
    const REACH = ['yangi-lidlar','boglanishga-urinilmoqda','boglanildi','sinov-darsida','qaror-jarayonida','tolov-jarayonida','tolov-yopildi'];

    const pad = n => String(n).padStart(2, '0');
    const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const dim = (y, m) => new Date(y, m, 0).getDate();
    const pct = (a, b, d = 1) => b > 0 ? (a / b * 100).toFixed(d).replace('.', ',') + '%' : '0%';
    const money = n => { n = Math.round(n || 0); if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',').replace(',0', '') + ' mln'; if (Math.abs(n) >= 1000) return Math.round(n / 1000) + ' ming'; return num(n); };
    const som = n => num(n) + ' soʻm';
    // 6 000 lidda har sana uchun yangi Intl formatlovchi sekin edi: natija xotirada saqlanadi.
    const dayC = new Map();
    const dayKey = raw => { if (raw === null || raw === undefined || raw === '') return null; let v = dayC.get(raw); if (v === undefined) { v = leadTashkentDayKey(raw); dayC.set(raw, v); } return v; };
    let leadsC = null;
    const L = () => leadsC || (leadsC = U.leads());
    const lk = l => dayKey(l.createdAt || l.date) || '';
    const st = l => normalizeLeadStatus(l.status);
    const isSale = l => ['tolov-jarayonida', 'tolov-yopildi'].includes(st(l));
    const received = l => { const ps = l.paymentSurvey || {}; if (st(l) === 'tolov-jarayonida' && ps.paymentType === 'partial') return Number(ps.paidAmount) || 0; return Number(l.paymentClosedSurvey?.actualAmount || l.paymentClosedSurvey?.totalAmount || ps.totalAmount || ps.paidAmount) || 0; };
    const srv = l => l.connectedSurvey || l.survey || l.leadSurvey || null;
    const midCheck = a => { const v = a.filter(x => x > 0); return v.length ? (Math.min(...v) + Math.max(...v)) / 2 : 0; };

    function range() {
        const t = todayKey(), y = +t.slice(0, 4), m = +t.slice(5, 7), mk = t.slice(0, 7), d = dim(y, m);
        if (S.per === 'today') return { from: t, to: t, label: 'bugun' };
        if (S.per === '7') { const x = new Date(t + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - 6); return { from: x.toISOString().slice(0, 10), to: t, label: 'oxirgi 7 kun' }; }
        const nm = MONTHS[m - 1];
        if (S.per === 'd1') return { from: mk + '-01', to: mk + '-10', label: '1–10 ' + nm };
        if (S.per === 'd2') return { from: mk + '-11', to: mk + '-20', label: '11–20 ' + nm };
        if (S.per === 'd3') return { from: mk + '-21', to: mk + '-' + pad(d), label: '21–' + d + ' ' + nm };
        if (S.per === 'all') return { from: '', to: '', label: 'hammasi' };
        if (S.per === 'custom' && (S.from || S.to)) { const f = S.from || S.to, e = S.to || S.from; return { from: f, to: e, label: f + ' — ' + e }; }
        return { from: mk + '-01', to: mk + '-' + pad(d), label: 'shu oy (1–' + (+t.slice(8)) + ' ' + nm + ')' };
    }
    const inR = (k, r) => !!k && (!r.from || (k >= r.from && k <= r.to));
    const srcOk = l => S.src === 'all' || (S.src === 'target' ? getLeadKind(l) === 'target' : getLeadKind(l) !== 'target');
    const mgrLead = l => S.mgrs === null || S.mgrs.includes(l.managerId);
    const mgrSale = l => S.mgrs === null || S.mgrs.includes(staffStatus.saleOwner(l));
    const assigned = l => { if (!S.aFrom && !S.aTo) return true; const f = S.aFrom || S.aTo, e = S.aTo || S.aFrom, k = dayKey(l.managerAssignedAt || l.createdAt || l.date); return !!k && k >= f && k <= e; };
    const saleKey = l => dayKey(_getSaleDate(l)) || '';

    function adsNeeded() {
        const mk = todayKey().slice(0, 7), key = U.lang() + mk;
        if (adsKey === key) return;
        adsKey = key;
        apiFetch('/api/target-ads?language=' + U.lang() + '&month=' + mk).then(d => { ads = d; if (active()) draw(); window.__st2.onAds && window.__st2.onAds(); }).catch(() => { ads = { failed: true }; if (active()) draw(); });
    }
    const phoneHost = () => document.getElementById('st2PhHost');
    const active = () => phoneHost() || (P.isRopDesk() && document.querySelector('[data-sales-panel="sales-stats"].active'));
    function spend(r) {
        if (!ads || ads.failed) return null;
        const rate = Number(ads.plan && ads.plan.usdRate) || 12000;
        let usd = 0, n = 0, last = '';
        Object.entries(ads.days || {}).forEach(([k, v]) => { if (inR(k, r) && Number(v.budget)) { usd += Number(v.budget); n++; if (k > last) last = k; } });
        return { usd, rate, som: usd * rate, n, last };
    }

    function calc() {
        const r = range(), all = L().filter(srcOk);
        const leads = all.filter(l => inR(lk(l), r) && mgrLead(l) && assigned(l));
        const sales = all.filter(l => isSale(l) && inR(saleKey(l), r) && mgrSale(l));
        const bad = leads.filter(l => isSifatsizLeadForQualityStats(l)), good = leads.length - bad.length;
        const money_ = sales.reduce((s, l) => s + received(l), 0);
        const rec = sales.map(received).filter(x => x > 0);
        return { r, all, leads, sales, bad, good, cash: money_, rec, chk: midCheck(rec), min: rec.length ? Math.min(...rec) : 0, max: rec.length ? Math.max(...rec) : 0 };
    }

    const countUp = (v, txt) => '<span data-n="' + v + '" data-t="' + esc(txt) + '">' + esc(txt) + '</span>';
    const tile = (l, v, s, cls = '', raw = null) => '<div class="st2-tile ' + cls + '"><div class="st2-tl">' + esc(l) + '</div><div class="st2-tv">' + (raw !== null ? countUp(raw, v) : esc(v)) + '</div><div class="st2-ts">' + s + '</div></div>';
    const bar = (l, n, tot, col = '#0065D6', extra = '') => { const w = tot > 0 ? Math.max(n ? 2 : 0, n / tot * 100) : 0; return '<div class="st2-b"><div class="st2-bl" title="' + esc(l) + '">' + esc(l) + '</div><div class="st2-bt"><i style="width:' + w + '%;background:' + col + '"></i></div><div class="st2-bn"><b>' + num(n) + '</b> ' + extra + '</div></div>'; };
    const card = (t, s, b, cls = '') => '<section class="st2-card ' + cls + '"><header><h3>' + esc(t) + '</h3>' + (s ? '<p>' + s + '</p>' : '') + '</header>' + b + '</section>';

    function planCard(c) {
        const lang = U.lang(), p = getSalesPlan(lang), m = computeSalesPlanMetrics(p, p.conversions.mid, p.duration).davr;
        const t = todayKey(), day = +t.slice(8), days = dim(+t.slice(0, 4), +t.slice(5, 7)), share = day / days, mk = t.slice(0, 7);
        const mr = { from: mk + '-01', to: mk + '-' + pad(days) };
        const leads = c.all.filter(l => inR(lk(l), mr)), sales = c.all.filter(l => isSale(l) && inR(saleKey(l), mr));
        const sum = sales.reduce((s, l) => s + received(l), 0), rec = sales.map(received);
        const sp = spend(mr), tgt = L().filter(l => getLeadKind(l) === 'target' && inR(lk(l), mr)).length;
        const cpl = sp && tgt ? sp.som / tgt : 0, romi = sp && sp.som ? (sum - sp.som) / sp.som * 100 : null, cv = leads.length ? sales.length / leads.length * 100 : 0, chk = midCheck(rec);
        const dp = (f, pl) => pl ? f / (pl * share) * 100 : 0;
        const ring = (lab, f, pl, ft) => { const pc = Math.min(100, pl ? f / pl * 100 : 0), C = 2 * Math.PI * 54; return '<div class="st2-ring"><svg viewBox="0 0 128 128" aria-hidden="true"><circle cx="64" cy="64" r="54"/><circle class="v" cx="64" cy="64" r="54" style="--c:' + C + ';stroke-dasharray:' + C + ';stroke-dashoffset:' + (C * (1 - pc / 100)) + '"/></svg><div><b>' + Math.round(pc) + '%</b><span>' + esc(lab) + '</span><em>' + esc(ft) + '</em></div></div>'; };
        const stat = (fp, cost) => { const k = cost ? (fp <= 100 ? 'ok' : 'bad') : (fp >= 100 ? 'ok' : fp >= 85 ? 'mid' : 'bad'); return '<span class="st2-st ' + k + '">' + (cost ? (fp <= 100 ? 'Meʼyorda' : 'Qimmat') : (fp >= 100 ? 'Bajarildi' : fp >= 85 ? 'Yaqin' : 'Orqada')) + '</span>'; };
        const row = (n, pl, pld, f, ftx, fp, st_, dpl, df) => '<tr><td>' + n + '</td><td>' + pl + '</td><td>' + pld + '</td><td><b>' + ftx + '</b></td><td>' + (fp === null ? '—' : Math.round(fp) + '%') + '</td><td>' + st_ + '</td><td>' + dpl + '</td><td>' + df + '</td></tr>';
        const srcL = { target: 'Target', organic: 'Organik', all: 'Umumiy' }[S.src];
        const projL = Math.round(leads.length / share), projS = sum / share;
        const noSp = S.src === 'organic';
        return '<section class="st2-plan"><div class="st2-pt"><div class="st2-ph"><div><h3>Sotuv rejasi va bajarilishi</h3><p>' + srcL + ' · 1–' + day + ' ' + MONTHS[+t.slice(5, 7) - 1] + ' · oy oʻtdi ' + Math.round(share * 100) + '% · “Oʻrtacha” reja · reja umumiy, fakt shu manba boʻyicha</p></div><span class="st2-rate">Kurs ' + num(sp ? sp.rate : 12000) + ' soʻm</span></div><div class="st2-rings">' +
            ring('Lidlar', leads.length, m.lidSoni, num(leads.length) + ' / ' + num(m.lidSoni)) + ring('Sotuvlar', sales.length, m.sotuvSoni, num(sales.length) + ' / ' + num(m.sotuvSoni)) + ring('Sotuv summasi', sum, m.sotuvSumma, money(sum) + ' / ' + money(m.sotuvSumma)) +
            '<div class="st2-proj"><span>Shu surʼat bilan oy oxirida</span><b>' + num(projL) + '</b> / ' + num(m.lidSoni) + ' lid<br><b>' + money(projS) + '</b> / ' + money(m.sotuvSumma) + '</div></div></div>' +
            '<div class="st2-tw"><table class="st2-t"><thead><tr><th>Koʻrsatkich</th><th>Oylik reja</th><th>Bugungacha</th><th>Fakt</th><th>%</th><th>Holat</th><th>Kunlik reja</th><th>Kunlik fakt</th></tr></thead><tbody>' +
            row('Lidlar', num(m.lidSoni), num(Math.round(m.lidSoni * share)), 0, num(leads.length), dp(leads.length, m.lidSoni), stat(dp(leads.length, m.lidSoni)), num(Math.round(m.lidSoni / days)), num(Math.round(leads.length / day))) +
            row('Sotuvlar soni', num(m.sotuvSoni), num(Math.round(m.sotuvSoni * share)), 0, num(sales.length), dp(sales.length, m.sotuvSoni), stat(dp(sales.length, m.sotuvSoni)), num(Math.round(m.sotuvSoni / days)), num(Math.round(sales.length / day))) +
            row('Sotuv summasi', money(m.sotuvSumma), money(m.sotuvSumma * share), 0, money(sum), dp(sum, m.sotuvSumma), stat(dp(sum, m.sotuvSumma)), money(m.sotuvSumma / days), money(sum / day)) +
            row('Konversiya', p.conversions.mid + '%', p.conversions.mid + '%', 0, cv.toFixed(1).replace('.', ',') + '%', cv / p.conversions.mid * 100, stat(cv / p.conversions.mid * 100), '—', '—') +
            row('Oʻrtacha chek', money(p.avgCheck), money(p.avgCheck), 0, money(chk), p.avgCheck ? chk / p.avgCheck * 100 : 0, stat(p.avgCheck ? chk / p.avgCheck * 100 : 0), '—', '—') +
            (noSp ? '' : row('Lid narxi', som(p.leadCost), som(p.leadCost), 0, cpl ? som(cpl) : '—', cpl ? cpl / p.leadCost * 100 : null, cpl ? stat(cpl / p.leadCost * 100, true) : '—', '—', '—') +
            row('Reklama byudjeti', money(m.budjet), money(m.budjet * share), 0, sp ? money(sp.som) : '—', sp && m.budjet ? sp.som / (m.budjet * share) * 100 : null, '<span class="st2-st mid">Sarflandi</span>', money(m.budjet / days), sp ? money(sp.som / day) : '—') +
            row('ROMI', Math.round(m.romi) + '%', Math.round(m.romi) + '%', 0, romi === null ? '—' : Math.round(romi) + '%', null, '—', '—', '—')) +
            '</tbody></table></div><footer>Chek rejasi — toʻliq narx.' + (noSp ? '' : (sp ? ' Reklama sarfi $' + sp.usd.toFixed(2) + ' × oylik kurs.' : ' Reklama sarfi yuklanmoqda.')) + ' <button type="button" data-st="openplan">Sotuv rejasini ochish</button></footer></section>';
    }

    function tiles(c) {
        const n = c.leads.length, badP = n ? c.bad.length / n * 100 : 0, sp = spend(c.r), mk = todayKey().slice(0, 7);
        const inProg = c.leads.filter(l => !['tolov-jarayonida','tolov-yopildi','muvaffaqiyatsiz-sotuv','sifatsiz-lidlar','keyin-sotib-olmoqchi'].includes(st(l))).length, later = c.leads.filter(l => st(l) === 'keyin-sotib-olmoqchi').length;
        const nP = c.sales.filter(l => st(l) === 'tolov-jarayonida').length, fresh_ = c.sales.filter(l => inR(lk(l), c.r)).length;
        const tl = c.all.filter(l => getLeadKind(l) === 'target' && inR(lk(l), c.r)), tq = tl.filter(l => !isSifatsizLeadForQualityStats(l)).length;
        const sp_ = sp && sp.usd > 0, spLab = c.r.from && c.r.from.slice(0, 7) === mk ? c.r.label : MONTHS[+mk.slice(5) - 1];
        const speeds = c.leads.filter(l => l.firstContactAt).map(l => (Number(l.firstContactAt) - leadCreatedMs(l)) / 36e5).filter(h => h >= 0).sort((a, b) => a - b);
        const med = speeds.length ? speeds[Math.floor(speeds.length / 2)] : null;
        let h = '<div class="st2-grid">' +
            tile('Lidlar', num(n), num(c.good) + ' sifatli · ' + num(c.bad.length) + ' sifatsiz', '', n) +
            tile('Sifatli lidlar', num(c.good), pct(c.good, n) + ' barcha liddan', '', c.good) +
            tile('Sifatsiz lidlar ulushi', badP.toFixed(1).replace('.', ',') + '%', num(c.bad.length) + ' ta · meʼyor 20% gacha' + (badP > 20 ? ' · ⚠ yuqori' : ''), badP > 20 ? 'bad' : '') +
            tile('Umumiy konversiya', pct(c.sales.length, n), c.sales.length + ' sotuv ÷ ' + num(n) + ' lid · sifatli liddan ' + pct(c.sales.length, c.good)) +
            tile('Sotuvlar', num(c.sales.length), 'Toʻlov jarayonida ' + nP + ' + yopildi ' + (c.sales.length - nP) + ' · ' + fresh_ + ' tasi shu davr lidlari, ' + (c.sales.length - fresh_) + ' tasi oldingi', 'hl', c.sales.length) +
            tile('Tushum (kassa)', money(c.cash), c.sales.length + ' ta sotuvdan qabul qilingan pul') +
            tile('Oʻrtacha chek', money(c.chk), c.rec.length ? 'eng kam ' + money(c.min) + ' va eng koʻp ' + money(c.max) + ' oʻrtasi · qarz kirmaydi' : 'sotuv yoʻq') +
            tile('Hali jarayonda', num(inProg), 'yana ' + later + ' — keyin sotib olmoqchi', '', inProg);
        if (S.src !== 'organic') {
            const p = getSalesPlan(U.lang()), cpl = sp_ && tl.length ? sp.som / tl.length : 0;
            h += tile('Reklama sarfi · ' + spLab, sp_ ? money(sp.som) : '—', sp_ ? '$' + sp.usd.toFixed(2) + ' · kurs ' + num(sp.rate) + (c.sales.length ? ' · 1 sotuv ' + money(sp.som / c.sales.length) : '') : (ads && ads.failed ? 'yuklab boʻlmadi' : 'maʼlumot yoʻq')) +
                tile('Bitta lid narxi', cpl ? som(cpl) : '—', cpl ? '$' + (sp.usd / tl.length).toFixed(2) + ' · reja ' + som(p.leadCost) + (cpl > p.leadCost ? ' · ⚠ qimmat' : '') : 'target lid yoki sarf yoʻq', cpl > p.leadCost ? 'bad' : '') +
                tile('Sifatli lid narxi', sp_ && tq ? som(sp.som / tq) : '—', sp_ && tq ? '$' + (sp.usd / tq).toFixed(2) + ' · ' + tq + ' sifatli target lid' : '—');
        }
        h += tile('1-aloqagacha', med === null ? '—' : (med >= 1 ? Math.round(med) + ' soat' : Math.round(med * 60) + ' daq'), 'mediana · lid tushgandan') + '</div>';
        return h;
    }

    function debtPay(c) {
        const t = todayKey(), mk = t.slice(0, 7);
        const debt = c.all.filter(l => isSale(l) && l.paymentSurvey?.paymentType === 'partial' && Number(l.paymentSurvey.debtAmount) > 0 && (saleKey(l) || '').slice(0, 7) === mk && String(l.paymentSurvey.nextPaymentDate || '').slice(0, 7) === mk && mgrSale(l)).sort((a, b) => String(a.paymentSurvey.nextPaymentDate).localeCompare(b.paymentSurvey.nextPaymentDate));
        const sum = debt.reduce((s, l) => s + Number(l.paymentSurvey.debtAmount), 0);
        const lines = debt.slice(0, 5).map(l => '<li><span>' + (+l.paymentSurvey.nextPaymentDate.slice(8)) + '-' + MONTHS[+mk.slice(5) - 1] + 'gacha</span><b>' + money(Number(l.paymentSurvey.debtAmount)) + '</b></li>').join('');
        const met = { card: 'Karta', payme: 'Payme', click: 'Click', cash: 'Naqd' }, cnt = {}; let unk = 0;
        c.sales.forEach(l => { const ps = l.paymentSurvey || {}; const k = ps.paymentType === 'installment' ? 'Nasiya' : met[ps.paymentMethod] || (ps.paymentMethod ? ps.paymentMethod : null); if (k) cnt[k] = (cnt[k] || 0) + 1; else unk++; });
        const tot = Object.values(cnt).reduce((a, b) => a + b, 0);
        const rows = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => bar(k, v, tot, '#0065D6', pct(v, tot, 0))).join('') || '<div class="st2-e">Sotuv yoʻq</div>';
        return '<div class="st2-2">' + card('Shu oyda qarzga sotilgan', 'Shu oyda toʻlagan, qolganini shu oyda toʻlashi kerak', '<div class="st2-dt"><div><span>Mijozlar</span><b>' + debt.length + '</b></div><div><span>Undirilishi kerak</span><b>' + money(sum) + '</b></div></div><ul class="st2-li">' + lines + '</ul>') +
            card('Toʻlov usuli', tot + ' ta sotuv boʻyicha', rows + (unk ? '<div class="st2-n">' + unk + ' ta sotuvda usul yozilmagan</div>' : '')) + '</div>';
    }

    function trend(c) {
        const days = new Map();
        const long = !c.r.from || (new Date(c.r.to) - new Date(c.r.from)) / 864e5 > 62;
        if (!long) { const x = new Date(c.r.from + 'T12:00:00Z'), e = c.r.to; while (x.toISOString().slice(0, 10) <= e) { days.set(x.toISOString().slice(0, 10), [0, 0]); x.setUTCDate(x.getUTCDate() + 1); } }
        c.leads.forEach(l => { const k = long ? lk(l).slice(0, 7) : lk(l); if (!days.has(k)) days.set(k, [0, 0]); days.get(k)[isSifatsizLeadForQualityStats(l) ? 1 : 0]++; });
        const a = [...days.entries()].sort((x, y) => x[0].localeCompare(y[0])), mx = Math.max(1, ...a.map(([, v]) => v[0] + v[1]));
        const col = a.map(([k, v], i) => { const lab = long ? k.slice(2) : (+k.slice(8)) + '.' + (+k.slice(5, 7)), show = a.length <= 16 || i % 3 === 0; return '<div class="st2-col" title="' + esc(lab) + ': ' + (v[0] + v[1]) + ' lid, ' + v[0] + ' sifatli"><div class="st2-cs"><i class="b" style="height:' + (v[1] / mx * 100) + '%"></i><i class="g" style="height:' + (v[0] / mx * 100) + '%"></i></div><span>' + (show ? esc(lab) : '') + '</span></div>'; }).join('');
        return card('Lidlar oqimi', 'CRMga tushgan kun boʻyicha · eng koʻpi ' + mx, '<div class="st2-leg"><span><i class="g"></i>Sifatli</span><span><i class="b"></i>Sifatsiz</span></div><div class="st2-tr">' + col + '</div>');
    }

    function funnels(c) {
        const rank = new Map(REACH.map((s, i) => [s, i])), reach = REACH.map(() => 0), lost = c.leads.length;
        rank.set('keyin-sotib-olmoqchi', 4); // qaror bosqichidan keyingi, lekin alohida bosqich sifatida ko'rsatilmaydi
        c.leads.forEach(l => { let m = rank.has(st(l)) ? rank.get(st(l)) : 0; (l.stageHistory || []).forEach(h => { [h.to, h.from].forEach(x => { const v = rank.get(normalizeLeadStatus(x)); if (v > m) m = v; }); }); for (let i = 0; i <= m; i++) reach[i]++; });
        let worst = -1, worstV = -1;
        const lab = id => FUNNEL_STAGES.find(s => s.id === id).label;
        const a = REACH.map((id, i) => { const pr = i ? reach[i - 1] : 0, p = pr ? reach[i] / pr * 100 : 100; if (i && pr >= 10 && 100 - p > worstV) { worstV = 100 - p; worst = i; } return { id, n: reach[i], p: i ? Math.round(p) : null }; });
        const f = a.map((x, i) => bar(lab(x.id), x.n, reach[0], FUNNEL_RAMP[i] || '#0065D6', x.p === null ? '' : x.p + '% oldingidan' + (i === worst ? ' ↓' : ''))).join('');
        const cur = [...FUNNEL_STAGES, { id: 'muvaffaqiyatsiz-sotuv', label: 'Muvaffaqiyatsiz sotuv' }, { id: 'sifatsiz-lidlar', label: 'Sifatsiz lidlar' }].map(s => { const n = c.leads.filter(l => st(l) === s.id).length; return bar(s.label, n, lost, s.id === 'muvaffaqiyatsiz-sotuv' ? '#D92D20' : s.id === 'sifatsiz-lidlar' ? '#64748B' : '#0065D6', pct(n, lost, 0)); }).join('');
        const age = c.bad.filter(l => leadLowQualityReason(l) === 'age').length;
        return '<div class="st2-2">' + card('Voronka', 'Har bosqich — shu yerga yoki undan keyingiga yetganlar', f + (worst > 0 ? '<div class="st2-n">Eng katta yoʻqotish: ' + esc(lab(REACH[worst - 1])) + ' → ' + esc(lab(REACH[worst])) + ' (' + Math.round(worstV) + '% oʻtmadi)</div>' : '') + '<div class="st2-n">Tarix 21-oktabrdan yoziladi, eski lidlar hozirgi bosqichi boʻyicha</div>') +
            card('Hozir qaysi bosqichda', 'Jami ' + num(lost) + ' ta lid', cur + (age ? '<div class="st2-n">Bundan tashqari sifatsiz sanaladi: yoshi ' + LEAD_UNDERAGE_MAX + ' va undan kichik <b>+' + age + '</b></div>' : '')) + '</div>';
    }

    function portrait(c) {
        const base = S.side === 'buy' ? c.sales : c.leads, ag = S.age ? AGE.find(a => a[0] === S.age) : null;
        const f = base.filter(l => { const s = srv(l); if (!S.gender && !S.age && !S.region && !S.goal) return true; if (!s) return false; if (S.gender && s.genderLabel !== S.gender) return false; if (S.region && (s.regionLabel || s.residenceLabel) !== S.region) return false; if (S.goal && s.learningGoalLabel !== S.goal) return false; if (ag) { const v = Number(s.age); if (!(v >= ag[1] && v <= ag[2])) return false; } return true; });
        const sv = f.map(srv).filter(Boolean), allS = base.map(srv).filter(Boolean);
        const uniq = k => [...new Set(allS.map(k).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uz'));
        const sel = (key, ph, list) => '<select data-st-f="' + key + '" aria-label="' + ph + '"><option value="">' + ph + '</option>' + list.map(v => '<option' + (S[key] === v ? ' selected' : '') + '>' + esc(v) + '</option>').join('') + '</select>';
        const count = key => { const m = new Map(); sv.forEach(s => { const v = key(s); if (v) m.set(v, (m.get(v) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
        const ages = AGE.map(a => { const list = sv.filter(s => Number(s.age) >= a[1] && Number(s.age) <= a[2]); const by = new Map(); list.forEach(s => by.set(+s.age, (by.get(+s.age) || 0) + 1)); const inner = [...by.entries()].sort((x, y) => x[0] - y[0]).map(([k, v]) => '<span>' + k + ' yosh: <b>' + v + '</b></span>').join(''); return '<details class="st2-ad"><summary>' + bar(a[0], list.length, sv.length, '#0065D6', pct(list.length, sv.length, 0)) + '</summary><div>' + (inner || 'Yoʻq') + '</div></details>'; }).join('');
        const g = count(s => s.genderLabel).map(([k, v]) => bar(k, v, sv.length, '#0065D6', pct(v, sv.length, 0))).join('');
        const goal = count(s => s.learningGoalLabel).map(([k, v]) => bar(k, v, sv.length, '#0065D6', pct(v, sv.length, 0))).join('');
        const regM = new Map();
        const reg = l => { const s = srv(l); return s ? (s.regionLabel || s.residenceLabel || '') : ''; };
        c.leads.forEach(l => { const k = reg(l); if (k) { const v = regM.get(k) || [0, 0]; v[0]++; regM.set(k, v); } });
        c.sales.forEach(l => { const k = reg(l); if (k) { const v = regM.get(k) || [0, 0]; v[1]++; regM.set(k, v); } });
        const regT = [...regM.entries()].sort((a, b) => b[1][0] - a[1][0]).map(([k, v]) => '<tr><td>' + esc(k) + '</td><td>' + v[0] + '</td><td>' + v[1] + '</td><td>' + pct(v[1], v[0]) + '</td></tr>').join('');
        return '<div class="st2-ptr"><div class="st2-seg" role="group"><button type="button" data-st-side="leads" aria-pressed="' + (S.side === 'leads') + '">Lidlar</button><button type="button" data-st-side="buy" aria-pressed="' + (S.side === 'buy') + '">Xaridorlar</button></div>' + sel('gender', 'Jinsi', uniq(s => s.genderLabel)) + sel('age', 'Yoshi', AGE.map(a => a[0])) + sel('region', 'Hududi', uniq(s => s.regionLabel || s.residenceLabel)) + sel('goal', 'Oʻqish sababi', uniq(s => s.learningGoalLabel)) + '<button type="button" class="st2-clr" data-st="clear">Tozalash</button><span>Anketa toʻldirilgan: <b>' + pct(sv.length, f.length, 0) + '</b> (' + sv.length + ' / ' + f.length + ')</span></div>' +
            '<div class="st2-3">' + card('Yosh', 'Guruhlar boʻyicha · har yosh alohida ochiladi', ages || '<div class="st2-e">Yoʻq</div>') + card('Jins', sv.length + ' ta anketa', g || '<div class="st2-e">Yoʻq</div>') + card('Oʻqish sababi', '', goal || '<div class="st2-e">Yoʻq</div>') + '</div>' +
            '<div class="st2-2">' + mapCard(c) + card('Hududlar reytingi', 'Oʻzbekiston va chet davlatlar', '<div class="st2-tw st2-sc"><table class="st2-t"><thead><tr><th>Hudud</th><th>Lid</th><th>Sotuv</th><th>Konv.</th></tr></thead><tbody>' + (regT || '<tr><td colspan="4">Yoʻq</td></tr>') + '</tbody></table></div>') + '</div>';
    }

    function reasons(c) {
        const count = (list, fn) => { const m = new Map(); list.forEach(l => { const k = fn(l); m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
        const failed = c.leads.filter(l => st(l) === 'muvaffaqiyatsiz-sotuv'), fr = count(failed, getFailedSaleReasonLabel);
        const bad = count(c.bad, l => leadLowQualityReason(l) === 'age' ? 'Yoshi ' + LEAD_UNDERAGE_MAX + ' va undan kichik' : getSifatsizLidReasonLabel(l));
        const list = (r, t) => r.map(([k, v]) => bar(k, v, t, '#0065D6', pct(v, t, 0))).join('') || '<div class="st2-e">Yoʻq</div>';
        const tar = count(c.sales.filter(l => l.paymentSurvey?.tariffLabel), l => l.paymentSurvey.tariffLabel);
        const buyA = AGE.map(a => [a[0], c.sales.filter(l => { const s = srv(l), v = s && Number(s.age); return v >= a[1] && v <= a[2]; }).length]).filter(x => x[1]), bt = buyA.reduce((s, x) => s + x[1], 0);
        return '<div class="st2-2">' + card('Muvaffaqiyatsiz sotuv sabablari', 'Jami ' + failed.length + ' ta', list(fr, failed.length)) + card('Sifatsiz lid sabablari', 'Jami ' + c.bad.length + ' ta', list(bad, c.bad.length)) + card('Xaridorlar · tarif', c.sales.length + ' ta xaridor', list(tar, c.sales.length)) + card('Xaridorlar yoshi', 'Qaysi yosh koʻproq sotib oladi', list(buyA, bt)) + '</div>';
    }

    function managers(c) {
        // getSalesManagers faqat ishlayotganlarni beradi; ketganlar sotuvlaridan topiladi (ism HR yozuvidan, oʻchirilgan boʻlsa Nomaʼlum).
        const all = getSalesManagers(U.lang()).slice(), known = new Set(all.map(m => m.id)), hr = getItem(STORAGE_KEYS.hrEmployees, []);
        if (S.gone) new Set(c.sales.map(l => staffStatus.saleOwner(l))).forEach(id => { if (id && !known.has(id)) { known.add(id); const e = hr.find(x => x.id === id); all.push({ id, name: (e && e.name) || 'Nomaʼlum menejer', gone: true }); } });
        const rows = all.filter(m => S.gone || staffStatus.isActive(m)).map(m => {
            const active_ = !m.gone && staffStatus.isActive(m), ls = active_ ? c.leads.filter(l => l.managerId === m.id) : [], ss = c.sales.filter(l => staffStatus.saleOwner(l) === m.id);
            const rec = ss.map(received), sp = ls.filter(l => l.firstContactAt).map(l => (Number(l.firstContactAt) - leadCreatedMs(l)) / 36e5).filter(h => h >= 0).sort((a, b) => a - b), bad = ls.filter(l => isSifatsizLeadForQualityStats(l)).length;
            const inP = ss.filter(l => st(l) === 'tolov-jarayonida').length;
            return { m, active_, n: ls.length, good: ls.length - bad, s: ss.length, inP, cash: rec.reduce((a, b) => a + b, 0), chk: midCheck(rec), sp: sp.length ? sp[Math.floor(sp.length / 2)] : null, nw: ls.filter(l => st(l) === 'yangi-lidlar').length, f: ls.filter(l => st(l) === 'muvaffaqiyatsiz-sotuv').length, bad, noR: ls.filter(l => st(l) === 'muvaffaqiyatsiz-sotuv' && !l.failedSaleReason).length };
        }).filter(r => r.active_ || r.s).sort((a, b) => b.cash - a.cash || b.n - a.n);
        const best = rows.filter(r => r.n >= 10).sort((a, b) => b.s / b.n - a.s / a.n)[0];
        const vis = S.showAllM ? rows : rows.slice(0, 8);
        const tr = vis.map(r => '<tr><td class="st2-mn">' + U.av(r.m.id, r.m.name, 30) + '<span>' + esc(r.m.name) + (r.active_ ? '' : ' <em>ketgan</em>') + '</span></td><td>' + (r.active_ ? r.n : '—') + '</td><td>' + (r.active_ ? r.good : '—') + '</td><td><b>' + r.s + '</b> <small>(' + r.inP + ' + ' + (r.s - r.inP) + ')</small></td><td>' + (r.active_ ? pct(r.s, r.n) + (best === r && r.s ? ' <span class="st2-up">▲</span>' : '') : '—') + '</td><td>' + (r.cash ? money(r.cash) : '—') + '</td><td>' + (r.chk ? money(r.chk) : '—') + '</td><td>' + (r.sp === null ? '—' : Math.round(r.sp) + ' soat') + '</td><td>' + (r.active_ ? r.nw : '—') + '</td><td>' + (r.active_ ? r.f + (r.noR ? ' <small>(' + r.noR + ' sababsiz)</small>' : '') : '—') + '</td><td>' + (r.active_ ? r.bad : '—') + '</td></tr>').join('');
        return card('Menejerlar samaradorligi', 'Tanlangan filtrlar boʻyicha · konversiya = sotuv ÷ barcha lid · chek = eng kam va eng koʻp tushgan summa oʻrtasi, qarzsiz',
            '<div class="st2-seg st2-mt" role="group"><button type="button" data-st-gone="0" aria-pressed="' + !S.gone + '">Ishlayotganlar</button><button type="button" data-st-gone="1" aria-pressed="' + S.gone + '">Ishdan ketganlar bilan</button></div><div class="st2-tw"><table class="st2-t st2-m"><thead><tr><th>Menejer</th><th>Lidlar</th><th>Sifatli</th><th>Sotuv</th><th>Konv.</th><th>Tushum</th><th>Chek</th><th>1-aloqa</th><th>Yangi kutmoqda</th><th>Muvaffaqiyatsiz</th><th>Sifatsiz</th></tr></thead><tbody>' + (tr || '<tr><td colspan="11">Menejer topilmadi</td></tr>') + '</tbody></table></div>' +
            (rows.length > 8 ? '<button type="button" class="st2-more" data-st="moreM">' + (S.showAllM ? 'Qisqartirish' : 'Barcha qatorlar') + '</button>' : '') + '<div class="st2-n">Sotuv menejer ketsa ham oʻziga yoziladi; ketgan menejer qatorida faqat sotuvlari qoladi. Yashil ▲ — 10+ lidli menejerlar ichida eng yuqori konversiya.</div>');
    }

    function toolbar(c) {
        const cnt = k => L().filter(l => (k === 'all' || (k === 'target' ? getLeadKind(l) === 'target' : getLeadKind(l) !== 'target')) && inR(lk(l), c.r) && mgrLead(l) && assigned(l)).length;
        const tabs = [['target','Target'],['organic','Organik'],['all','Umumiy']].map(([k, t]) => '<button type="button" data-st-src="' + k + '" aria-pressed="' + (S.src === k) + '">' + t + ' · ' + num(cnt(k)) + '</button>').join('');
        const t = todayKey(), dd = dim(+t.slice(0, 4), +t.slice(5, 7));
        const per = [['today','Bugun'],['7','7 kun'],['d1','1–10'],['d2','11–20'],['d3','21–' + dd],['month','Shu oy'],['all','Hammasi'],['custom','Sana']].map(([k, l]) => '<button type="button" data-st-per="' + k + '" aria-pressed="' + (S.per === k) + '">' + l + '</button>').join('');
        const ms = getSalesManagers(U.lang()).filter(m => staffStatus.isActive(m));
        const mLab = S.mgrs === null ? 'Barcha menejerlar' : S.mgrs.length + ' ta menejer';
        const mList = ms.map(m => '<label><input type="checkbox" data-st-m="' + esc(m.id) + '"' + (S.mgrs === null || S.mgrs.includes(m.id) ? ' checked' : '') + '> ' + esc(m.name) + '</label>').join('');
        return '<div class="st2-bar"><div class="st2-seg st2-big" role="group" aria-label="Manba">' + tabs + '</div><div class="st2-seg" role="group" aria-label="Davr">' + per + '</div></div><div class="st2-bar2"><details class="st2-dd"><summary>' + esc(mLab) + ' ▾</summary><div><button type="button" data-st="allM">Hammasi</button>' + mList + '</div></details><details class="st2-dd"' + (S.aFrom || S.aTo ? ' open' : '') + '><summary>Biriktirilgan sana ▾</summary><div class="st2-dr"><input type="date" data-st-d="aFrom" value="' + S.aFrom + '" aria-label="Dan"><input type="date" data-st-d="aTo" value="' + S.aTo + '" aria-label="Gacha"></div></details>' + (S.per === 'custom' ? '<span class="st2-dr"><b>CRMga tushgan sana</b><input type="date" data-st-d="from" value="' + S.from + '" aria-label="Dan"><input type="date" data-st-d="to" value="' + S.to + '" aria-label="Gacha"></span>' : '') + '</div>';
    }

    // Xarita: @svg-maps/uzbekistan (CC-BY-4.0, Victor Cazanave), koordinatalar soddalashtirilgan.
    const UZ_MAP = {"andijan":["750 320 750 316 734 313 728 307 724 308 720 300 723 297 732 295 747 296 749 289 756 286 763 288 762 291 770 298 779 298 783 301 786 300 786 297 790 298 792 299 791 302 776 309 775 316 771 315 769 319 757 313 760 317 758 318 760 322 759 326"],"bukhara":["421 383 409 394 411 400 393 407 388 413 385 411 378 412 358 398 349 387 300 353 296 344 294 324 287 319 299 303 289 290 300 285 286 266 305 261 309 270 319 277 323 288 335 291 353 301 356 308 363 307 368 295 371 293 374 295 374 302 390 304 391 299 403 298 405 293 410 307 434 311 433 320 423 333 408 330 406 344 395 357 400 364 411 366 416 369"],"fergana":["674 331 665 328 663 322 670 320 684 307 693 304 700 304 699 309 707 313 712 308 721 304 724 308 728 307 734 313 750 316 750 320 745 322 744 326 738 332 740 334 738 336 733 335 733 338 727 341 724 335 722 335 722 339 711 332 703 330 693 334 692 337 677 340 674 336"],"jizzakh":["581 375 579 378 572 378 541 371 532 376 532 379 529 378 529 381 523 375 522 370 526 363 532 361 531 354 514 351 506 347 508 340 505 335 504 321 491 320 500 304 498 297 492 293 491 283 497 283 498 275 543 277 550 284 556 282 559 284 556 284 555 296 551 296 550 298 567 310 567 314 563 314 562 319 565 318 559 332 560 337 585 334 584 341 581 343 584 345 600 341 601 343 602 346 595 348 592 346 597 358 595 358 591 351 593 358 590 361 589 358 585 359 582 366 584 371"],"namangan":["749 281 735 279 734 277 737 271 730 261 726 264 727 256 722 259 725 262 723 268 721 272 714 272 716 276 713 283 710 280 706 283 706 279 703 278 700 281 695 278 692 280 688 276 684 279 684 267 679 261 669 265 666 271 666 278 669 287 681 302 679 302 679 304 684 307 700 304 699 309 707 313 712 308 723 302 720 300 724 297 732 295 747 296 748 289 751 287","679 296 673 291 674 289"],"navoiy":["498 275 497 283 491 283 492 293 498 297 500 304 491 320 487 313 481 316 475 314 471 320 471 334 468 342 471 343 466 348 455 350 439 342 436 357 431 356 422 359 426 364 427 369 425 374 428 381 421 383 416 369 411 366 400 364 395 357 403 349 407 331 411 330 416 333 423 333 433 320 434 311 410 307 405 293 403 298 391 299 390 304 374 302 374 295 371 293 368 295 363 307 356 308 353 301 335 291 323 288 319 277 309 270 305 261 286 266 265 237 278 230 271 218 272 202 300 150 285 146 279 135 342 123 394 128 417 117 422 117 430 131 446 147 455 174 467 168 467 207 464 205 463 232 487 235 491 274"],"qashqadaryo":["421 383 428 381 448 381 451 379 455 380 461 390 465 391 480 386 486 390 494 384 503 386 505 392 511 392 513 389 527 393 529 397 540 402 541 409 533 412 533 416 533 428 527 427 516 440 514 447 495 464 494 471 489 467 481 467 473 460 459 453 453 455 439 450 418 433 397 421 388 413 393 407 411 400 409 394"],"karakalpakstan":["157 24 158 31 149 53 143 55 146 67 138 68 131 79 128 77 126 61 131 65 134 64 136 54 129 47 135 46 135 38 138 37 138 34 132 33 126 37 132 27 129 21 134 7","119 0 117 12 111 19 111 24 102 43 102 54 105 60 102 76 107 84 121 90 136 84 138 89 134 93 139 99 150 103 160 104 164 101 167 104 177 104 198 95 199 88 213 74 214 70 210 65 214 65 236 80 238 87 279 135 285 146 300 150 272 202 271 218 278 230 265 237 300 285 286 291 271 272 265 268 253 266 247 273 244 271 210 242 206 230 201 229 194 231 192 236 184 231 183 229 187 228 184 220 188 217 180 211 158 211 148 197 144 196 136 194 122 179 120 188 104 186 100 190 107 194 112 205 116 210 112 210 108 200 99 201 95 197 89 200 90 212 86 213 86 217 65 218 58 222 54 231 47 235 45 240 48 263 51 267 54 267 48 274 0 270 0 38"],"samarqand":["533 391 526 393 512 389 511 392 505 392 503 386 494 384 486 390 480 386 465 391 461 390 455 380 428 381 425 374 427 369 426 364 422 359 431 356 436 357 439 342 446 344 455 350 467 347 471 343 468 342 471 334 471 320 475 314 481 316 487 313 491 320 504 321 505 335 508 340 506 347 514 351 531 354 532 361 526 364 522 374 529 381"],"sirdaryo":["596 338 584 341 585 334 572 337 560 336 565 318 562 319 563 314 567 314 567 310 574 316 582 316 587 314 582 308 579 303 580 292 575 289 583 289 586 291 585 294 607 315 605 337"],"surxondaryo":["573 459 568 474 561 476 548 496 545 516 539 512 535 514 533 511 522 517 508 504 487 507 487 504 492 501 487 492 488 481 491 475 494 474 495 464 514 447 516 440 527 427 530 426 533 428 535 419 533 413 541 409 559 409 564 414 564 419 558 422 561 425 558 427 558 437 562 441 560 445 564 445"],"tashkent1":["619 266 610 267 608 273 611 275 618 274"],"tashkent2":["706 216 697 210 691 212 683 216 676 228 666 220 662 226 663 230 649 243 647 242 645 246 630 249 621 258 621 262 611 262 605 269 603 269 599 278 585 293 607 315 605 337 615 339 613 334 617 332 616 329 612 318 618 314 617 307 620 303 626 304 634 312 637 308 644 308 655 300 664 296 666 289 669 287 666 271 669 265 664 259 656 258 656 254 670 246 679 234 686 233 687 226 693 226","620 268 617 275 611 274 608 273 610 267 619 266"],"xorazm":["283 312 278 301 276 289 260 273 251 272 249 280 245 281 234 275 208 276 191 266 190 262 193 252 188 245 189 240 200 243 192 236 194 231 201 229 206 230 210 242 244 271 247 273 253 266 265 268 279 280 285 291 289 290 292 293 299 301 298 306 287 319"]};
    const UZ_REG = { andijon: ['andijan', 'Andijon'], buxoro: ['bukhara', 'Buxoro'], fargona: ['fergana', 'Fargʻona'], jizzax: ['jizzakh', 'Jizzax'], namangan: ['namangan', 'Namangan'], navoiy: ['navoiy', 'Navoiy'], qashqadaryo: ['qashqadaryo', 'Qashqadaryo'], qoraqalpogiston: ['karakalpakstan', 'Qoraqalpogʻiston'], samarqand: ['samarqand', 'Samarqand'], sirdaryo: ['sirdaryo', 'Sirdaryo'], surxondaryo: ['surxondaryo', 'Surxondaryo'], 'toshkent-sh': ['tashkent1', 'Toshkent sh.'], 'toshkent-v': ['tashkent2', 'Toshkent v.'], xorazm: ['xorazm', 'Xorazm'] };
    function mapCard(c) {
        const RAMP = ['#DCE9FB', '#A9CBF5', '#6FA6EE', '#2F7FE2', '#0057B8'], cnt = {}, buy = {}, ext = {}; let n = 0;
        c.leads.forEach(l => { const s = srv(l); if (!s) return; n++; if (s.residenceType === 'foreign') { const k = s.residenceLabel || 'Boshqa davlat'; ext[k] = (ext[k] || 0) + 1; } else if (UZ_REG[s.region]) cnt[UZ_REG[s.region][0]] = (cnt[UZ_REG[s.region][0]] || 0) + 1; });
        c.sales.forEach(l => { const s = srv(l); if (s && UZ_REG[s.region]) buy[UZ_REG[s.region][0]] = (buy[UZ_REG[s.region][0]] || 0) + 1; });
        const mx = Math.max(1, ...Object.values(cnt)), col = v => v ? RAMP[Math.min(4, Math.floor(v / mx * 4.999))] : '#F1F4F9';
        const small = new Set(['andijan', 'fergana', 'namangan', 'sirdaryo', 'tashkent1']);
        const shapes = Object.values(UZ_REG).map(([id, nm]) => (UZ_MAP[id] || []).map(p => '<polygon points="' + p + '" fill="' + (id === 'tashkent1' && cnt[id] ? RAMP[4] : col(cnt[id] || 0)) + '" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"><title>' + esc(nm) + ': ' + (cnt[id] || 0) + ' lid, ' + (buy[id] || 0) + ' sotuv</title></polygon>').join('')).join('');
        const labels = Object.values(UZ_REG).filter(([id]) => !small.has(id)).map(([id, nm]) => { const big = (UZ_MAP[id] || []).slice().sort((a, b) => b.length - a.length)[0]; if (!big) return ''; const a = big.split(' ').map(Number); let x = 0, y = 0; a.forEach((v, i) => { if (i % 2) y += v; else x += v; }); x /= a.length / 2; y /= a.length / 2; const dark = cnt[id] && Math.floor(cnt[id] / mx * 4.999) >= 3; return '<text x="' + x.toFixed(0) + '" y="' + y.toFixed(0) + '" text-anchor="middle" font-size="15" font-weight="700" fill="' + (dark ? '#fff' : '#0B1220') + '">' + (cnt[id] || 0) + '</text>'; }).join('');
        const ex = Object.entries(ext).sort((a, b) => b[1] - a[1]).map(([k, v]) => '<span>' + esc(k) + ' <b>' + v + '</b></span>').join('');
        return card('Hududlar', 'Anketasi toʻlgan ' + n + ' ta lid · sichqonchani ustiga olib boring', '<svg class="st2-map" viewBox="-6 -4 806 530" role="img" aria-label="Oʻzbekiston viloyatlari boʻyicha lidlar">' + shapes + labels + '</svg>' + (ex ? '<div class="st2-ext"><em>Chet davlatlar</em>' + ex + '</div>' : ''));
    }
    const channelOf = l => { const s = String(l.organicChannel || l.source || '').toLowerCase(); if (s.includes('telegram')) return 'Telegram'; if (s.includes('instagram')) return 'Instagram'; if (s.includes('youtube')) return 'YouTube'; if (l.organicChannel || s.includes('tavsiya') || s.includes('qoʻngʻiroq')) return 'Boshqa'; return 'Aniqlanmagan'; };
    function orgCard(c) {
        if (S.src === 'target') return '';
        const org = l => getLeadKind(l) !== 'target', ls = c.leads.filter(org), ss = c.sales.filter(org);
        const rows = ['Telegram', 'Instagram', 'YouTube', 'Boshqa', 'Aniqlanmagan'].map(k => { const a = ls.filter(l => channelOf(l) === k).length, b = ss.filter(l => channelOf(l) === k).length; return bar(k, a, ls.length, k === 'Aniqlanmagan' ? '#CBD5E1' : '#0065D6', 'lid · <b>' + b + '</b> sotuv'); }).join('');
        return card('Organik lidlar qayerdan kelgan', 'Telegram, Instagram, YouTube · yangi lidlarda “Qayerdan keldi?” maydonidan', rows);
    }
    let bot = null, botKey = '';
    function botCard(c) {
        if (U.lang() !== 'russian') return '';
        const key = c.r.from + '|' + c.r.to;
        if (botKey !== key) { botKey = key; bot = null; apiFetch('/api/bot-funnel?from=' + c.r.from + '&to=' + c.r.to).then(d => { bot = d; if (active()) draw(); }).catch(() => { bot = { failed: true }; if (active()) draw(); }); }
        const d = bot && !bot.failed ? bot : {}, ids = new Set(d.leadIds || []), sold = L().filter(l => ids.has(l.id) && isSale(l)), cash = sold.reduce((s, l) => s + received(l), 0);
        const steps = [['Start bosdi', d.start], ['Dars koʻrdi', d.lesson], ['Test yechdi', d.quiz], ['Qoʻllanma oldi', d.guide], ['Narxni koʻrdi', d.price], ['Telefon qoldirdi', d.phone], ['Ariza berdi', d.request], ['CRMda lid boʻldi', d.lead], ['Sotuv', sold.length]].map(([a, b]) => [a, b || 0]);
        let wi = -1, wv = -1;
        const rows = steps.map(([a, b], i) => { const p = i ? steps[i - 1][1] : 0, pc = p ? Math.round(b / p * 100) : 0; if (i && p >= 5 && 100 - pc > wv) { wv = 100 - pc; wi = i; } return bar(a, b, steps[0][1], '#0065D6', i ? pc + '% oldingidan' : ''); }).join('');
        const start = steps[0][1];
        return '<section class="st2-card"><header><h3>Telegram bot voronkasi</h3><p>Domwork bot · rus tili · start bosgandan sotuvgacha' + (bot && bot.failed ? ' · <b>maʼlumot yuklanmadi</b>' : '') + '</p></header><div class="st2-grid st2-g4">' + tile('Start bosganlar', num(start), 'tanlangan davrda') + tile('Telefon qoldirgan', num(d.phone || 0), 'startdan ' + pct(d.phone || 0, start, 0)) + tile('Botdan sotuv', num(sold.length), 'startdan ' + pct(sold.length, start, 0)) + tile('Botdan tushum', cash ? money(cash) : '0 soʻm', 'qabul qilingan') + '</div><div class="st2-m8">' + rows + '</div><div class="st2-ext"><span>Targetdan <b>' + (d.target || 0) + '</b></span><span>Organikdan <b>' + (d.organic || 0) + '</b></span><span>Xabarni toʻxtatgan <b>' + (d.paused || 0) + '</b></span><span>Botni bloklagan <b>' + (d.blocked || 0) + '</b></span>' + (wi > 0 ? '<span>Eng koʻp tushib qolgan: <b>' + esc(steps[wi][0]) + '</b></span>' : '') + '</div></section>';
    }

    function animateIn(root) {
        if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        root.classList.add('st2-anim');
        root.querySelectorAll('[data-n]').forEach(e => { const v = +e.dataset.n, t0 = performance.now(), T = 800; if (!v) return; (function f(t) { const p = Math.min(1, (t - t0) / T); e.textContent = num(Math.round(v * (1 - Math.pow(1 - p, 3)))); if (p < 1 && e.isConnected) requestAnimationFrame(f); else if (e.isConnected) e.textContent = e.dataset.t; })(t0); });
    }

    function draw() {
        if (!active()) return;
        leadsC = null;
        const panel = phoneHost() || document.querySelector('[data-sales-panel="sales-stats"]');
        adsNeeded();
        const y = panel.closest('.main-content, main')?.scrollTop, c = calc();
        const openD = [...panel.querySelectorAll('details.st2-dd')].map(d => d.open);
        panel.innerHTML = '<div class="st2" id="st2Root">' + toolbar(c) + planCard(c) + tiles(c) + debtPay(c) + trend(c) + funnels(c) + botCard(c) + orgCard(c) + portrait(c) + reasons(c) + managers(c) + '</div>';
        panel.querySelectorAll('details.st2-dd').forEach((d, i) => { if (openD[i]) d.open = true; });
        const root = panel.querySelector('#st2Root');
        bind(root); animateIn(root); animate = false;
    }
    function redraw(an) { animate = !!an; draw(); }
    function bind(root) {
        root.onclick = e => {
            const b = e.target.closest('button'); if (!b) return;
            const d = b.dataset;
            if (d.stSrc) { S.src = d.stSrc; redraw(true); }
            else if (d.stPer) { S.per = d.stPer; redraw(true); }
            else if (d.stSide) { S.side = d.stSide; redraw(); }
            else if (d.stGone) { S.gone = d.stGone === '1'; redraw(); }
            else if (d.st === 'openplan') P.open('plan');
            else if (d.st === 'clear') { S.gender = S.age = S.region = S.goal = ''; redraw(); }
            else if (d.st === 'moreM') { S.showAllM = !S.showAllM; redraw(); }
            else if (d.st === 'allM') { S.mgrs = null; redraw(); }
        };
        root.onchange = e => {
            const t = e.target, d = t.dataset;
            if (d.stF) { S[d.stF] = t.value; redraw(); }
            else if (d.stD) { S[d.stD] = t.value; redraw(); }
            else if ('stM' in d) { const ids = getSalesManagers(U.lang()).filter(m => staffStatus.isActive(m)).map(m => m.id); let cur = S.mgrs === null ? ids.slice() : S.mgrs.slice(); cur = t.checked ? [...cur, d.stM] : cur.filter(x => x !== d.stM); S.mgrs = cur.length === ids.length ? null : cur; redraw(); }
        };
    }

    const css = [
    '.st2{display:flex;flex-direction:column;gap:14px;font-family:"Plus Jakarta Sans",sans-serif;color:#0B1220;padding-bottom:40px}',
    '.st2 h3{font-size:16px;font-weight:800;margin:0;color:inherit}.st2-card header p,.st2-ph p{margin:3px 0 0;font-size:13px;color:#4B5563}',
    '.st2-bar{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between}.st2-bar2{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
    '.st2-seg{display:inline-flex;gap:2px;padding:3px;background:#EEF2F7;border-radius:12px;flex-wrap:wrap}.st2-seg button{border:0;background:none;font:inherit;font-size:13.5px;font-weight:700;color:#4B5563;padding:0 13px;height:38px;border-radius:9px;cursor:pointer}.st2-seg button[aria-pressed=true]{background:#0065D6;color:#fff}.st2-big button{height:42px;padding:0 18px;font-size:14px}.st2-mt{margin:0 0 12px}',
    '.st2-card,.st2-tile,.st2-plan{background:#fff;border:1px solid #E6EAF2;border-radius:20px}.st2-card{padding:18px 20px}.st2-card>header{margin-bottom:14px}',
    '.st2-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.st2-tile{padding:16px 18px;min-width:0}.st2-tl{font-size:13px;font-weight:700;color:#4B5563}.st2-tv{font-size:28px;font-weight:800;line-height:1.2;margin-top:5px;color:#0B1220}.st2-ts{font-size:12.5px;line-height:1.4;color:#4B5563;margin-top:4px}.st2-tile.hl{border-color:#0065D6;background:#EAF3FF}.st2-tile.bad{border-color:#FECDCA;background:#FEF3F2}.st2-tile.bad .st2-tv{color:#D92D20}',
    '.st2-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.st2-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}',
    '.st2-plan{overflow:hidden}.st2-pt{background:#0057B8;color:#fff;padding:20px 22px}.st2-pt p{color:#D8E8FB!important}.st2-ph{display:flex;justify-content:space-between;gap:14px}.st2-rate{height:34px;padding:0 12px;border-radius:10px;background:rgba(255,255,255,.14);display:inline-flex;align-items:center;font-size:13px;font-weight:700;white-space:nowrap}',
    '.st2-rings{display:flex;flex-wrap:wrap;gap:24px;align-items:center;margin-top:16px}.st2-ring{position:relative;width:128px;height:128px}.st2-ring svg{width:128px;height:128px;transform:rotate(-90deg)}.st2-ring circle{fill:none;stroke:rgba(255,255,255,.2);stroke-width:10}.st2-ring circle.v{stroke:#fff;stroke-linecap:round}.st2-ring>div{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.st2-ring b{font-size:22px;font-weight:800}.st2-ring span{font-size:11.5px;font-weight:700}.st2-ring em{font-style:normal;font-size:10.5px;color:#D8E8FB}.st2-proj{margin-left:auto;font-size:14px;line-height:1.6}.st2-proj span{display:block;font-size:12.5px;color:#D8E8FB}.st2-proj b{font-size:20px;font-weight:800}',
    '.st2-tw{overflow-x:auto}.st2-sc{max-height:380px;overflow-y:auto}.st2-t{width:100%;border-collapse:collapse;font-size:13.5px}.st2-t th{font-size:12px;font-weight:700;color:#4B5563;text-align:right;padding:9px 12px;border-bottom:1px solid #E6EAF2;white-space:nowrap;position:sticky;top:0;background:#fff}.st2-t td{text-align:right;padding:10px 12px;border-bottom:1px solid #F1F5F9;white-space:nowrap;color:#0B1220}.st2-t th:first-child,.st2-t td:first-child{text-align:left}.st2-t tr:last-child td{border-bottom:0}.st2-t small{color:#4B5563}.st2-plan footer{padding:12px 20px;font-size:12.5px;color:#4B5563;border-top:1px solid #E6EAF2}.st2-plan footer button,.st2-more{border:0;background:none;color:#0065D6;font:inherit;font-weight:700;cursor:pointer;padding:0}.st2-more{margin-top:10px;font-size:13px}',
    '.st2-st{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:700}.st2-st.ok{background:#ECFDF3;color:#067647}.st2-st.mid{background:#FFFAEB;color:#B54708}.st2-st.bad{background:#FEF3F2;color:#D92D20}',
    '.st2-b{display:grid;grid-template-columns:minmax(120px,190px) 1fr minmax(92px,auto);gap:10px;align-items:center;min-height:30px;font-size:13.5px}.st2-bl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#0B1220}.st2-bt{height:12px;background:#F1F5F9;border-radius:6px;overflow:hidden}.st2-bt i{display:block;height:100%;border-radius:6px;transform-origin:left}.st2-bn{text-align:right;font-size:12.5px;color:#4B5563;white-space:nowrap}.st2-bn b{font-size:14px;color:#0B1220}',
    '.st2-n{margin-top:10px;font-size:12.5px;line-height:1.45;color:#4B5563}.st2-e{font-size:13px;color:#4B5563;padding:8px 0}',
    '.st2-dt{display:flex;gap:32px}.st2-dt span{display:block;font-size:13px;color:#4B5563;font-weight:700}.st2-dt b{font-size:28px;font-weight:800}.st2-li{list-style:none;margin:10px 0 0;padding:0}.st2-li li{display:flex;justify-content:space-between;padding:7px 0;border-top:1px solid #F1F5F9;font-size:13.5px}',
    '.st2-leg{display:flex;gap:16px;font-size:12.5px;color:#4B5563;margin-bottom:8px}.st2-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}.st2 i.g{background:#0065D6}.st2 i.b{background:#CBD5E1}.st2-tr{display:flex;align-items:stretch;gap:3px;height:190px}.st2-col{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}.st2-cs{flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:1px}.st2-cs i{display:block;border-radius:3px 3px 0 0;transform-origin:bottom}.st2-col span{font-size:10.5px;text-align:center;color:#4B5563;height:14px;white-space:nowrap}',
    '.st2-ptr{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:13px;color:#4B5563}.st2-ptr select,.st2-dr input{height:40px;border:1px solid #E2E8F0;border-radius:12px;background:#fff;color:#0B1220;padding:0 10px;font:inherit;font-size:13.5px}.st2-clr{border:0;background:none;color:#0065D6;font:inherit;font-weight:700;cursor:pointer}',
    '.st2-ad summary{list-style:none;cursor:pointer}.st2-ad summary::-webkit-details-marker{display:none}.st2-ad>div{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;padding:4px 0 8px;color:#4B5563}',
    '.st2-dd{position:relative}.st2-dd summary{list-style:none;cursor:pointer;height:42px;padding:0 14px;display:inline-flex;align-items:center;border:1px solid #E2E8F0;border-radius:12px;background:#fff;font-size:13.5px;font-weight:600;color:#0B1220}.st2-dd summary::-webkit-details-marker{display:none}.st2-dd>div{position:absolute;z-index:30;top:48px;left:0;background:#fff;border:1px solid #E6EAF2;border-radius:14px;padding:10px;min-width:260px;max-height:320px;overflow:auto;display:flex;flex-direction:column;gap:6px;font-size:13.5px}.st2-dd>div button{align-self:flex-start;border:0;background:none;color:#0065D6;font:inherit;font-weight:700;cursor:pointer}.st2-dd>.st2-dr{flex-direction:row}.st2-dr{display:inline-flex;gap:6px;align-items:center;font-size:13px}',
    '.st2-mn{display:flex;align-items:center;gap:8px;font-weight:600}.st2-mn em{font-style:normal;font-size:11px;color:#B54708}.st2-up{color:#067647}',
    '.st2-anim .st2-bt i{animation:st2g .7s ease-out both}.st2-anim .st2-cs i{animation:st2r .6s ease-out both}.st2-anim .st2-ring circle.v{animation:st2d .9s ease-out both}.st2-anim>*{animation:st2f .4s ease-out both}',
    '@keyframes st2g{from{transform:scaleX(0)}}@keyframes st2r{from{transform:scaleY(0)}}@keyframes st2d{from{stroke-dashoffset:var(--c)}}@keyframes st2f{from{opacity:0;transform:translateY(8px)}}',
    '.st2-map{width:100%;display:block}.st2-map polygon{transition:opacity .15s}.st2-map polygon:hover{opacity:.75}.st2-ext{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:10px;font-size:13px;color:#4B5563}.st2-ext em{font-style:normal;font-weight:700}.st2-ext b{color:#0B1220}.st2-g4{margin-bottom:14px}.st2-card .st2-tile{border-radius:16px}',
    '@media(max-width:600px){.st2{gap:10px}.st2-bar{flex-direction:column;gap:8px}.st2-seg{flex-wrap:nowrap;overflow-x:auto;max-width:100%}.st2-seg button{white-space:nowrap;flex:none}.st2-big{display:flex}.st2-big button{flex:1;padding:0 8px;font-size:13px}.st2-grid{gap:8px}.st2-tile{padding:12px 14px;border-radius:18px}.st2-tv{font-size:22px}.st2-card{padding:14px;border-radius:18px}.st2-pt{padding:16px}.st2-ph{flex-direction:column;gap:8px}.st2-rate{align-self:flex-start}.st2-rings{gap:8px;justify-content:space-between}.st2-ring,.st2-ring svg{width:96px;height:96px}.st2-ring b{font-size:17px}.st2-ring span{font-size:10px}.st2-ring em{display:none}.st2-proj{margin:0;width:100%}.st2-plan thead{display:none}.st2-plan tr{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:10px 14px;border-bottom:1px solid #F1F5F9}.st2-plan tr:last-child{border-bottom:0}.st2-plan td{display:block;border:0;padding:0;text-align:left;white-space:normal}.st2-plan td:nth-child(1){grid-area:1/1;font-weight:700}.st2-plan td:nth-child(6){grid-area:1/2;text-align:right}.st2-plan td:nth-child(4){grid-area:2/1}.st2-plan td:nth-child(3){grid-area:2/2;text-align:right;color:#4B5563;font-size:12.5px}.st2-plan td:nth-child(3)::before{content:"bugungacha "}.st2-plan td:nth-child(8){grid-area:3/1/3/3;color:#4B5563;font-size:12.5px}.st2-plan td:nth-child(8)::before{content:"kunlik fakt "}.st2-plan td:nth-child(2),.st2-plan td:nth-child(5),.st2-plan td:nth-child(7){display:none}.st2-plan footer button{display:none}.st2-b{grid-template-columns:minmax(84px,118px) 1fr auto;gap:8px;font-size:13px}.st2-bn{font-size:11.5px}.st2-tr{height:150px}.st2-dd{position:static}.st2-dd>div{left:16px;right:16px;top:auto;min-width:0}.st2-dd>.st2-dr{flex-wrap:wrap}.st2-ptr select{flex:1 1 40%;min-width:0}}',
    '@media(max-width:1180px){.st2-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.st2-2,.st2-3{grid-template-columns:minmax(0,1fr)}.st2-proj{margin-left:0}}'
    ].join('\n');
    const st_ = document.createElement('style'); st_.id = 'st2Css'; st_.textContent = css; document.head.appendChild(st_);

    P.register('funnel', { tab: 'sales', head: () => ({ title: 'Statistika', sub: esc(U.langLabel()) + ' yoʻnalishi · ' + esc(range().label) + ' · lidlar CRMga tushgan sana, sotuv va tushum toʻlov sanasi boʻyicha', chipRight: true }) });
    const open0 = P.open;
    P.open = k => { if (k === 'funnel') { S = fresh(); animate = true; } return open0(k); };
    function hook() {
        U.wrap('renderSalesFunnel', () => { if (P.isRopDesk()) { draw(); U.salesHead(P.PAGES.funnel); } });
        if (active()) { draw(); U.salesHead(P.PAGES.funnel); }
    }
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-ra-go="funnel"]')) { S = fresh(); animate = true; } }, true);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
    window.__st2 = { calc, draw, planHtml() { adsNeeded(); const s = S.src; S.src = 'all'; leadsC = null; const h = planCard(calc()); S.src = s; return h; } };
})();
