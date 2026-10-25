// Target lidlar monitoringi — sof hisob-kitob (DOM'siz, Node'da ham test qilinadi).
//
// Ikki manba bor va ular ATAYLAB alohida ko'rsatiladi:
//  1) Targetolog kiritgani (reklama kabineti): sarf, lid soni, o'zi sanagan
//     sifatli lid soni. Bular qo'lda kiritiladi.
//  2) CRM avtomatik: shu kuni CRM'ga tushgan "Target" manbali lidlar va
//     ularning sotuv bo'limidagi holati. Hech kim qo'lda o'zgartira olmaydi.
// Shu ikkalasining farqi (lid yo'qolishi/ikki marta sanash) alohida qator.
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.TargetSheet = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Sotuv bo'limidagi ustunlar bo'yicha lid sifati:
    //  - pending   — hali ishlanmagan (yangi / bog'lanishga urinilmoqda)
    //  - unqualified — "Sifatsiz lidlar" ustuniga tushgan
    //  - qualified — bog'lanildi va undan keyingi barcha bosqichlar
    //    (sinov, qaror, keyinroq, to'lov, hatto muvaffaqiyatsiz sotuv ham —
    //    bu lid maqsadli auditoriya bo'lgan, faqat sotib olmagan).
    const PENDING = new Set(['yangi-lidlar', 'boglanishga-urinilmoqda']);
    const UNQUALIFIED = new Set(['sifatsiz-lidlar']);
    const SOLD = new Set(['tolov-jarayonida', 'tolov-yopildi']);

    function quality(status) {
        if (PENDING.has(status)) return 'pending';
        if (UNQUALIFIED.has(status)) return 'unqualified';
        return 'qualified';
    }

    function daysInMonth(monthKey) {
        const [y, m] = monthKey.split('-').map(Number);
        return new Date(Date.UTC(y, m, 0)).getUTCDate();
    }

    function dayList(monthKey) {
        const n = daysInMonth(monthKey);
        const names = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
        const out = [];
        for (let d = 1; d <= n; d++) {
            const key = `${monthKey}-${String(d).padStart(2, '0')}`;
            out.push({ day: d, key, weekday: names[new Date(key + 'T00:00:00Z').getUTCDay()] });
        }
        return out;
    }

    function addDays(key, n) {
        return new Date(Date.parse(key + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
    }

    // "Temp" (pace) uchun hisobga olinadigan kunlar: o'tgan oy — butun oy;
    // joriy oy — KECHAGACHA (bugungi sarf hali kiritilmagan bo'ladi);
    // kelajak oy — 0.
    function paceDays(monthKey, today) {
        const n = daysInMonth(monthKey);
        const thisMonth = today.slice(0, 7);
        if (monthKey < thisMonth) return n;
        if (monthKey > thisMonth) return 0;
        return Math.min(n, Number(today.slice(8, 10)) - 1);
    }

    const div = (a, b) => (b > 0 && a != null ? a / b : null);

    // leads: [{ status(normallashgan), kind('target'|'organic'), dayKey('YYYY-MM-DD'), trial(bool), sold(bool), amount }]
    function crmByDay(leads, monthKey) {
        const days = {};
        for (const l of leads) {
            if (l.kind !== 'target' || !l.dayKey || l.dayKey.slice(0, 7) !== monthKey) continue;
            const d = days[l.dayKey] || (days[l.dayKey] = { leads: 0, qualified: 0, unqualified: 0, pending: 0, trial: 0, sold: 0 });
            d.leads++;
            d[quality(l.status)]++;
            if (l.trial) d.trial++;
            if (SOLD.has(l.status)) d.sold++;
        }
        return days;
    }

    function sum(list, key) { return list.reduce((s, x) => s + (Number(x?.[key]) || 0), 0); }

    // Rang: 'good' | 'warn' | 'bad' | '' (baholab bo'lmaydi)
    function grade(kind, fakt, plan, pace) {
        if (fakt == null || !plan) return '';
        if (kind === 'cost') { // past bo'lishi yaxshi (lid narxi)
            const r = fakt / plan;
            return r <= 1 ? 'good' : r <= 1.15 ? 'warn' : 'bad';
        }
        if (kind === 'rate') { // ulush — rejaga nisbatan, tempsiz
            const r = fakt / plan;
            return r >= 1 ? 'good' : r >= 0.85 ? 'warn' : 'bad';
        }
        if (!(pace > 0)) return '';
        const expected = plan * pace;
        const r = fakt / expected;
        if (kind === 'spend') return (r >= 0.9 && r <= 1.1) ? 'good' : (r >= 0.75 && r <= 1.25) ? 'warn' : 'bad';
        return r >= 1 ? 'good' : r >= 0.8 ? 'warn' : 'bad'; // count
    }

    function buildSheet({ monthKey, today, entries = {}, plan = null, leads = [] }) {
        const days = dayList(monthKey);
        const nDays = days.length;
        const pDays = paceDays(monthKey, today);
        const pace = pDays / nDays;
        const crm = crmByDay(leads, monthKey);
        const fixedPerDay = plan?.fixed ? plan.fixed / nDays : 0;

        const perDay = days.map(d => {
            const e = entries[d.key] || null;
            const c = crm[d.key] || { leads: 0, qualified: 0, unqualified: 0, pending: 0, trial: 0, sold: 0 };
            const isFuture = d.key > today;
            const budget = e ? Number(e.budget) || 0 : null;
            return {
                ...d, isFuture, isToday: d.key === today,
                entry: e,
                missing: !e && !isFuture && d.key < today,
                budget,
                fixed: !isFuture && d.key < today ? fixedPerDay : null,
                adLeads: e ? e.leadCount : null,
                adKval: e && e.kvalLeadCount != null ? e.kvalLeadCount : null,
                adCpl: e ? div(budget, e.leadCount) : null,
                adKvalCpl: e && e.kvalLeadCount != null ? div(budget, e.kvalLeadCount) : null,
                adKvalPct: e && e.kvalLeadCount != null && e.leadCount ? e.kvalLeadCount / e.leadCount * 100 : null,
                crm: c,
                crmCpl: e ? div(budget, c.leads) : null,
                crmKvalCpl: e ? div(budget, c.qualified) : null,
                crmKvalPct: (c.qualified + c.unqualified) ? c.qualified / (c.qualified + c.unqualified) * 100 : null,
                // Farq faqat ikkala manba ham bor kunda (kiritilgan kun) hisoblanadi
                diff: e ? e.leadCount - c.leads : null
            };
        });

        const entered = perDay.filter(d => d.entry);
        const budget = entered.length ? sum(entered, 'budget') : null;
        const adLeads = entered.length ? sum(entered, 'adLeads') : null;
        const kvalDays = entered.filter(d => d.adKval != null);
        const adKval = kvalDays.length ? sum(kvalDays, 'adKval') : null;
        const crmTotals = perDay.reduce((t, d) => {
            for (const k of Object.keys(t)) t[k] += d.crm[k];
            return t;
        }, { leads: 0, qualified: 0, unqualified: 0, pending: 0, trial: 0, sold: 0 });
        // Narx hisobida faqat sarfi kiritilgan kunlardagi CRM lidlari olinadi —
        // aks holda kiritilmagan kunlarning lidlari narxni sun'iy arzonlashtiradi.
        const crmLeadsEntered = sum(entered.map(d => d.crm), 'leads');
        const crmKvalEntered = sum(entered.map(d => d.crm), 'qualified');
        const adKvalBudget = sum(kvalDays, 'budget');
        const decided = crmTotals.qualified + crmTotals.unqualified;
        const diffs = entered.map(d => d.diff);

        const planLidNarxi = plan ? div(plan.budget, plan.lidSoni) : null;
        const planKvalNarxi = plan ? div(plan.budget, plan.kvalLidSoni) : null;
        const planKvalPct = plan && plan.lidSoni ? plan.kvalLidSoni / plan.lidSoni * 100 : null;

        const totals = {
            budget, fixed: fixedPerDay ? fixedPerDay * pDays : (plan ? 0 : null),
            adLeads, adKval,
            adCpl: div(budget, adLeads),
            adKvalCpl: div(adKvalBudget, adKval),
            adKvalPct: adKval != null ? div(adKval * 100, sum(kvalDays, 'adLeads')) : null,
            crm: crmTotals,
            crmCpl: div(budget, crmLeadsEntered),
            crmKvalCpl: div(budget, crmKvalEntered),
            crmKvalPct: decided ? crmTotals.qualified / decided * 100 : null,
            diff: diffs.length ? diffs.reduce((a, b) => a + b, 0) : null,
            enteredDays: entered.length,
            missingDays: perDay.filter(d => d.missing).map(d => d.key)
        };

        const p = plan || {};
        const g = {
            budget: grade('spend', budget, p.budget, pace),
            adLeads: grade('count', adLeads, p.lidSoni, pace),
            adKval: grade('count', adKval, p.kvalLidSoni, pace),
            adCpl: grade('cost', totals.adCpl, planLidNarxi),
            adKvalCpl: grade('cost', totals.adKvalCpl, planKvalNarxi),
            adKvalPct: grade('rate', totals.adKvalPct, planKvalPct),
            crmLeads: grade('count', crmTotals.leads, p.lidSoni, pace),
            crmKval: grade('count', crmTotals.qualified, p.kvalLidSoni, pace),
            crmCpl: grade('cost', totals.crmCpl, planLidNarxi),
            crmKvalCpl: grade('cost', totals.crmKvalCpl, planKvalNarxi),
            crmKvalPct: grade('rate', totals.crmKvalPct, planKvalPct)
        };

        return {
            monthKey, today, days: perDay, totals, grades: g, pace, paceDays: pDays, nDays,
            plan: plan ? { ...plan, lidNarxi: planLidNarxi, kvalNarxi: planKvalNarxi, kvalPct: planKvalPct } : null,
            lastEntered: entered.length ? entered[entered.length - 1].key : null,
            yesterday: addDays(today, -1)
        };
    }

    // Lid soni farqi qachon ogohlantirish: 2 tadan va 10% dan katta bo'lsa
    function diffLevel(diff, base) {
        if (diff == null) return '';
        const a = Math.abs(diff);
        if (a <= 1) return '';
        return a > Math.max(2, (base || 0) * 0.1) ? 'bad' : 'warn';
    }

    return { quality, daysInMonth, dayList, paceDays, crmByDay, grade, buildSheet, diffLevel, addDays };
});
