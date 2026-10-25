// Myhomework.uz — Moliya hisob-kitob yadrosi (server va brauzerda bir xil ishlaydi).
//
// Tamoyillar:
//  * Pul faqat butun so'mda saqlanadi va hisoblanadi — kasr va yaxlitlash xatosi yo'q.
//  * Yozuvlar o'chirilmaydi va tahrirlanmaydi: xato storno (teskari yozuv) bilan yopiladi.
//  * Yopilgan oy raqamlari muzlatilgan nusxadan (snapshot) olinadi. Keyinroq aniqlangan
//    tuzatishlar yopilgan oyni o'zgartirmaydi — birinchi ochiq oyda "O'tgan davr tuzatishi"
//    qatori bo'lib ko'rinadi (IAS 8 ruhida, boshqaruv hisoboti uchun).
//  * Hisoblash usuli IFRS 15 ga tayanadi: har bir o'qish davri (shartnoma) alohida, tushum
//    kurs davomida teng tan olinadi, shartnoma bo'yicha aktiv/majburiyat sof holda ko'rsatiladi.
//  * Balans tenglamasi har safar tekshiriladi: Aktivlar − Majburiyatlar = Kapital harakati.
//  * Sozlamaga bog'liq har bir ko'rsatkich (kurs davomiyligi, ECL stavkalari, amortizatsiya
//    muddati) hisobotda taxmin sifatida ochiq yoziladi.
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.FinanceEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const ENTITIES = { english: 'Ingliz tili (Homework)', russian: 'Rus tili (Domwork)', common: 'Umumiy (ikkala maktab)' };
    const TYPES = {
        income: 'Boshqa tushum', expense: 'Xarajat', refund: 'Mijozga qaytarilgan to‘lov', capital: 'Ta’sischi kiritgan mablag‘',
        drawing: 'Ta’sischi olgan mablag‘', loan_in: 'Olingan qarz', loan_repay: 'Qarzni qaytarish', transfer: 'Hisoblar orasida o‘tkazma'
    };
    // cf: IAS 7 bo'limi; cfLine: pul oqimi qatori; pnl: foyda-zarar qatori (null — P&L'ga kirmaydi).
    const CATEGORIES = [
        { code: 'REV_TUITION', name: 'Kurs to‘lovlari', type: 'receipt', cf: 'operating', cfLine: 'receipts', pnl: 'revenue', system: true },
        { code: 'REV_OTHER', name: 'Boshqa daromad (kitob, material, xizmat)', type: 'income', cf: 'operating', cfLine: 'other_in', pnl: 'other_income' },
        { code: 'REFUND', name: 'Mijozga qaytarilgan to‘lov', type: 'refund', cf: 'operating', cfLine: 'refunds', pnl: 'refunds' },
        { code: 'COS_TEACHERS', name: 'O‘qituvchilar maoshi', type: 'expense', cf: 'operating', cfLine: 'employees', pnl: 'cost_of_services', payroll: true },
        { code: 'COS_CONTENT', name: 'Darslik, kontent va o‘quv materiallari', type: 'expense', cf: 'operating', cfLine: 'suppliers', pnl: 'cost_of_services' },
        { code: 'PAY_SALES', name: 'Sotuv bo‘limi maoshi va bonuslari', type: 'expense', cf: 'operating', cfLine: 'employees', pnl: 'sales_payroll', payroll: true },
        { code: 'PAY_ADMIN', name: 'Ma’muriy xodimlar maoshi', type: 'expense', cf: 'operating', cfLine: 'employees', pnl: 'admin_payroll', payroll: true },
        { code: 'TAX_PAYROLL', name: 'Ish haqi soliqlari (JShDS, ijtimoiy soliq)', type: 'expense', cf: 'operating', cfLine: 'taxes', pnl: 'payroll_tax' },
        { code: 'MKT_ADS', name: 'Target reklama byudjeti', type: 'expense', cf: 'operating', cfLine: 'suppliers', pnl: 'marketing' },
        { code: 'MKT_OTHER', name: 'Marketing: kontent, bloger, dizayn', type: 'expense', cf: 'operating', cfLine: 'suppliers', pnl: 'marketing' },
        { code: 'RENT', name: 'Ijara va kommunal', type: 'expense', cf: 'operating', cfLine: 'suppliers', pnl: 'rent' },
        { code: 'SOFTWARE', name: 'Dasturlar va servislar (CRM, telefoniya, SMS, hosting)', type: 'expense', cf: 'operating', cfLine: 'suppliers', pnl: 'software' },
        { code: 'ADMIN', name: 'Ofis va ma’muriy xarajatlar', type: 'expense', cf: 'operating', cfLine: 'suppliers', pnl: 'admin' },
        { code: 'BANK_FEES', name: 'To‘lov tizimi, bank va Uzum komissiyalari', type: 'expense', cf: 'operating', cfLine: 'suppliers', pnl: 'payment_fees' },
        { code: 'TAX_TURNOVER', name: 'Aylanmadan olinadigan soliq / QQS', type: 'expense', cf: 'operating', cfLine: 'taxes', pnl: 'turnover_tax' },
        { code: 'OTHER_EXP', name: 'Boshqa xarajatlar', type: 'expense', cf: 'operating', cfLine: 'suppliers', pnl: 'other_expense' },
        { code: 'INTEREST', name: 'Qarz bo‘yicha foizlar', type: 'expense', cf: 'financing', cfLine: 'interest', pnl: 'finance_cost' },
        { code: 'TAX_INCOME', name: 'Foyda solig‘i', type: 'expense', cf: 'operating', cfLine: 'taxes', pnl: 'income_tax' },
        { code: 'CAPEX', name: 'Uskuna va aktivlar (kapital xarajat)', type: 'expense', cf: 'investing', cfLine: 'capex', pnl: null },
        { code: 'OWNER_IN', name: 'Ta’sischi kiritgan mablag‘', type: 'capital', cf: 'financing', cfLine: 'owner_in', pnl: null },
        { code: 'OWNER_OUT', name: 'Ta’sischi olgan mablag‘ (dividend, shaxsiy)', type: 'drawing', cf: 'financing', cfLine: 'owner_out', pnl: null },
        { code: 'LOAN_IN', name: 'Olingan qarz', type: 'loan_in', cf: 'financing', cfLine: 'loan_in', pnl: null },
        { code: 'LOAN_REPAY', name: 'Qarzni qaytarish (asosiy qarz)', type: 'loan_repay', cf: 'financing', cfLine: 'loan_out', pnl: null },
        { code: 'TRANSFER', name: 'Hisoblar orasida o‘tkazma', type: 'transfer', cf: null, cfLine: null, pnl: null }
    ];
    const CATEGORY = Object.fromEntries(CATEGORIES.map(c => [c.code, c]));
    CATEGORY.TAX = CATEGORY.TAX_TURNOVER; // eski kod
    const DEFAULT_ACCOUNTS = [
        { id: 'acc-cash', entity: 'common', name: 'Kassa (naqd pul)', kind: 'cash', methods: ['cash'] },
        { id: 'acc-card', entity: 'common', name: 'Karta (P2P / terminal)', kind: 'card', methods: ['card', 'payme', 'click', 'paylater'] },
        { id: 'acc-bank', entity: 'common', name: 'Bank hisob raqami', kind: 'bank', methods: ['bank'] },
        { id: 'acc-uzum', entity: 'common', name: 'Uzum Nasiya — olinadigan (kliring)', kind: 'clearing', methods: ['uzum'] },
        { id: 'acc-suspense', entity: 'common', name: 'Aniqlanmagan (tekshirish kerak)', kind: 'suspense', methods: ['unknown'] }
    ];
    const ACCOUNT_KINDS = { cash: 'Naqd', card: 'Karta', bank: 'Bank', wallet: 'Elektron hamyon', clearing: 'Kliring (olinadigan)', suspense: 'Tekshiruvdagi' };
    const EQUIVALENT_KINDS = new Set(['cash', 'card', 'bank', 'wallet']);
    const DEFAULT_SETTINGS = {
        courseMonths: { english: 3, russian: 3 }, suspiciousMin: 10000, salaryDueDays: 10, usefulLifeMonths: 36, approvalLimit: 5000000,
        eclRates: { not_due: 0, d1_30: 5, d31_60: 20, d61_90: 50, d90: 100, no_date: 25 }
    };

    // ---------- Asosiy yordamchilar ----------
    function money(value) {
        if (value === '' || value == null) return null;
        const n = typeof value === 'number' ? value : Number(String(value).replace(/[\s,_']/g, '').replace(/(so['‘’]?m|uzs|sum)$/i, ''));
        return Number.isSafeInteger(n) && n >= 0 ? n : null;
    }
    function date(value) {
        let key = String(value || '').trim();
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(key)) key = key.slice(6) + '-' + key.slice(3, 5) + '-' + key.slice(0, 2);
        if (!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(key)) return '';
        key = key.slice(0, 10);
        const d = new Date(key + 'T00:00:00Z');
        return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === key ? key : '';
    }
    function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    function addDays(key, n) { const d = new Date(key + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
    function dayDiff(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
    function monthOf(key) { return String(key || '').slice(0, 7); }
    function monthEnd(month) { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }
    function addMonths(key, n) {
        const [y, m, d] = key.split('-').map(Number);
        const target = new Date(Date.UTC(y, m - 1 + n, 1));
        const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
        target.setUTCDate(Math.min(d, last));
        return target.toISOString().slice(0, 10);
    }
    function monthsBetween(start, end) {
        const out = [];
        for (let m = monthOf(start); m <= monthOf(end); m = monthOf(addMonths(m + '-01', 1))) out.push(m);
        return out;
    }
    function inRange(key, start, end) { return (!start || key >= start) && (!end || key <= end); }
    function sum(rows, pick = r => r.amount) { return rows.reduce((n, r) => n + (Number(pick(r)) || 0), 0); }
    function pct(part, whole) { return whole ? Math.round((part / whole) * 1000) / 10 : null; }
    function scopeMatch(entity, scope) { return scope === 'all' || !scope || entity === scope; }
    function phone9(value) { const d = String(value || '').replace(/\D/g, ''); return d.length >= 9 ? d.slice(-9) : d; }

    function settingsOf(data) { const s = data.settings || {}; return { ...DEFAULT_SETTINGS, ...s, courseMonths: { ...DEFAULT_SETTINGS.courseMonths, ...(s.courseMonths || {}) }, eclRates: { ...DEFAULT_SETTINGS.eclRates, ...(s.eclRates || {}) } }; }
    function memo(cache, data, fn) { if (cache.has(data)) return cache.get(data); const v = fn(); cache.set(data, v); return v; }
    const MV = new WeakMap(), CT = new WeakMap(), AS = new WeakMap(), FIRST = new WeakMap();

    // ---------- Pul harakatlari ----------
    // Har bir harakat: { id, source, entity, date, account, sign (+1/−1), amount (musbat), category, ... }
    function accountForMethod(accounts, method, entity) {
        const active = accounts.filter(a => a.active !== false);
        return active.find(a => a.entity === entity && (a.methods || []).includes(method))
            || active.find(a => a.entity === 'common' && (a.methods || []).includes(method))
            || active.find(a => a.kind === 'suspense') || null;
    }
    function receiptMovements(receipts, accounts) {
        const out = [];
        for (const r of receipts) {
            // Tushum yozilgan paytdagi hisob saqlanadi (r.accountId); keyingi sozlama o'zgarishi tarixni ko'chirmaydi.
            const account = r.accountId || accountForMethod(accounts, r.method, r.entity)?.id || 'acc-suspense';
            const base = { source: 'receipt', receiptId: r.id, entity: r.entity, account, category: 'REV_TUITION', type: 'receipt', amount: r.amount,
                name: r.name, phone: r.phone, managerId: r.managerId, managerName: r.managerName, leadId: r.leadId, studentId: r.studentId, method: r.method, form: r.form };
            out.push({ ...base, id: 'r:' + r.id, date: r.date, sign: 1 });
            if (r.voidDate) out.push({ ...base, id: 'rv:' + r.id, date: r.voidDate, sign: -1, voidReason: r.voidReason, isReversal: true });
        }
        return out;
    }
    function categoryOf(t) {
        return CATEGORY[t.categoryCode] || CATEGORY[{ income: 'REV_OTHER', refund: 'REFUND', capital: 'OWNER_IN', drawing: 'OWNER_OUT', loan_in: 'LOAN_IN', loan_repay: 'LOAN_REPAY', transfer: 'TRANSFER' }[t.type]] || CATEGORY.OTHER_EXP;
    }
    function transactionMovements(transactions) {
        const out = [];
        for (const t of transactions) {
            const cat = categoryOf(t), flip = t.reversesId ? -1 : 1;
            const base = { source: 'transaction', transactionId: t.id, entity: t.entity, date: t.date, category: cat.code, type: t.type, amount: t.amount,
                counterparty: t.counterparty || '', description: t.description || '', isReversal: !!t.reversesId, reversesId: t.reversesId || null,
                paymentRecordId: t.paymentRecordId || null, payableId: t.payableId || null, salaryId: t.salaryId || null, legacy: !!t.legacy, usefulLifeMonths: t.usefulLifeMonths || null };
            if (t.type === 'transfer') {
                out.push({ ...base, id: 't:' + t.id + ':out', account: t.accountId, sign: -flip, transferLeg: 'out', otherAccount: t.toAccountId });
                out.push({ ...base, id: 't:' + t.id + ':in', account: t.toAccountId, sign: flip, transferLeg: 'in', otherAccount: t.accountId });
                continue;
            }
            out.push({ ...base, id: 't:' + t.id, account: t.accountId, sign: (['income', 'capital', 'loan_in'].includes(t.type) ? 1 : -1) * flip });
        }
        return out;
    }
    function movements(data) {
        return memo(MV, data, () => [...receiptMovements(data.receipts || [], data.accounts || []), ...transactionMovements(data.transactions || [])]
            .filter(m => date(m.date)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)));
    }
    function accountMap(data) { return memo(AS, data, () => new Map((data.accounts || []).map(a => [a.id, a]))); }
    function openingDateOf(data, accountId) { return date(accountMap(data).get(accountId)?.openingDate) || '0000-00-00'; }
    function firstDate(data) {
        return memo(FIRST, data, () => {
            const dates = [...movements(data).map(m => m.date), ...(data.salaries || []).map(s => s.accrualDate), ...(data.payables || []).map(p => p.issueDate), ...(data.accounts || []).map(a => a.openingDate)].filter(date).sort();
            return dates[0] || today();
        });
    }

    // ---------- Hisob raqamlar qoldig'i ----------
    function accountBalances(data, asOf, scope = 'all') {
        const mv = movements(data);
        return (data.accounts || []).map(a => {
            const openingDate = date(a.openingDate) || '0000-00-00';
            const flows = mv.filter(m => m.account === a.id && m.date >= openingDate && (!asOf || m.date <= asOf) && scopeMatch(m.entity, scope));
            const inflow = sum(flows.filter(m => m.sign > 0)), outflow = sum(flows.filter(m => m.sign < 0));
            // Boshlang'ich qoldiq hisob egasiga tegishli: umumiy hisobniki faqat konsolidatsiyada.
            const includeOpening = (scope === 'all' || a.entity === scope) && (!asOf || openingDate <= asOf);
            const opening = includeOpening ? Number(a.openingBalance) || 0 : 0;
            const lastCheck = (data.accountChecks || []).filter(c => c.accountId === a.id && (!asOf || c.date <= asOf))
                .sort((x, y) => x.date.localeCompare(y.date) || String(x.createdAt).localeCompare(String(y.createdAt))).at(-1) || null;
            const bookAtCheck = lastCheck ? (Number(a.openingBalance) || 0) + sum(mv.filter(m => m.account === a.id && m.date >= openingDate && m.date <= lastCheck.date), m => m.sign * m.amount) : null;
            return { id: a.id, name: a.name, kind: a.kind, entity: a.entity, active: a.active !== false, openingBalance: opening, openingDate: a.openingDate || '',
                inflow, outflow, balance: opening + inflow - outflow, equivalent: EQUIVALENT_KINDS.has(a.kind), allocatedView: scope !== 'all' && a.entity === 'common',
                check: lastCheck && { date: lastCheck.date, actual: Number(lastCheck.actualBalance), book: bookAtCheck, difference: Number(lastCheck.actualBalance) - bookAtCheck, note: lastCheck.note || '' } };
        });
    }
    function cashSummary(balances) {
        const by = pred => sum(balances.filter(pred), a => a.balance);
        return { equivalents: by(a => EQUIVALENT_KINDS.has(a.kind)), suspense: by(a => a.kind === 'suspense'), clearing: by(a => a.kind === 'clearing'),
            cash: by(a => a.kind !== 'clearing') };
    }

    // ---------- Kunlik kassa daftari ----------
    function cashbook(data, { start, end, account = '', scope = 'all' }) {
        const accounts = (data.accounts || []).filter(a => !account || a.id === account);
        const ids = new Set(accounts.map(a => a.id));
        const mv = movements(data).filter(m => ids.has(m.account) && scopeMatch(m.entity, scope) && m.date >= openingDateOf(data, m.account));
        const openingOf = before => accounts.reduce((n, a) => {
            const od = date(a.openingDate) || '0000-00-00', inc = scope === 'all' || a.entity === scope;
            return n + (inc && od < before ? Number(a.openingBalance) || 0 : 0) + sum(mv.filter(m => m.account === a.id && m.date < before), m => m.sign * m.amount);
        }, 0);
        const byDay = new Map();
        for (const m of mv) if (inRange(m.date, start, end)) { if (!byDay.has(m.date)) byDay.set(m.date, []); byDay.get(m.date).push(m); }
        let running = openingOf(start);
        const openingBalance = running, days = [];
        for (const d of [...byDay.keys()].sort()) {
            const entries = byDay.get(d), inflow = sum(entries.filter(m => m.sign > 0)), outflow = sum(entries.filter(m => m.sign < 0));
            const opening = running; running += inflow - outflow;
            days.push({ date: d, opening, inflow, outflow, closing: running, entries });
        }
        return { start, end, account, openingBalance, closingBalance: running, inflow: sum(days, d => d.inflow), outflow: sum(days, d => d.outflow), days };
    }

    // ---------- Pul oqimlari hisoboti (IAS 7, to'g'ridan-to'g'ri usul) ----------
    // Pul mablag'lari = naqd, karta, bank, hamyon va "aniqlanmagan" hisob. Uzum kliring pul emas —
    // undan bankka tushgan summa "o'quvchilardan olingan to'lov" bo'lib ko'rinadi.
    const CF_LINES = {
        operating: [['receipts', 'O‘quvchilardan olingan to‘lovlar'], ['other_in', 'Boshqa operatsion tushumlar'], ['refunds', 'Mijozlarga qaytarilgan to‘lovlar'],
            ['employees', 'Xodimlarga to‘langan maosh va bonuslar'], ['suppliers', 'Yetkazib beruvchilar va xizmatlar uchun to‘lovlar'], ['taxes', 'To‘langan soliqlar']],
        investing: [['capex', 'Uskuna va aktivlar sotib olish']],
        financing: [['owner_in', 'Ta’sischi kiritgan mablag‘'], ['loan_in', 'Olingan qarzlar'], ['loan_out', 'Qaytarilgan qarzlar (asosiy qarz)'], ['interest', 'To‘langan foizlar'], ['owner_out', 'Ta’sischiga to‘langan mablag‘']]
    };
    function isCashAccount(data, id) { const a = accountMap(data).get(id); return !!a && a.kind !== 'clearing'; }
    function cashFlowMovements(data, start, end, scope) {
        return movements(data).filter(m => inRange(m.date, start, end) && scopeMatch(m.entity, scope) && isCashAccount(data, m.account) && m.date >= openingDateOf(data, m.account)
            && !(m.category === 'TRANSFER' && isCashAccount(data, m.otherAccount)));
    }
    function cashFlowStatement(data, { start, end, scope = 'all' }) {
        const mv = cashFlowMovements(data, start, end, scope);
        const lineOf = m => m.category === 'TRANSFER' ? 'receipts' : (CATEGORY[m.category] || {}).cfLine;
        const build = keys => keys.map(([key, label]) => ({ key, label, amount: sum(mv.filter(m => lineOf(m) === key), m => m.sign * m.amount) }));
        const operating = build(CF_LINES.operating), investing = build(CF_LINES.investing), financing = build(CF_LINES.financing);
        const net = { operating: sum(operating), investing: sum(investing), financing: sum(financing) };
        const netChange = net.operating + net.investing + net.financing;
        const balancesAt = d => accountBalances(data, d, scope).filter(a => a.kind !== 'clearing');
        const openingCash = sum(balancesAt(addDays(start, -1)), a => a.balance);
        const closingAccounts = balancesAt(end), closingCash = sum(closingAccounts, a => a.balance);
        const openingInjection = sum((data.accounts || []).filter(a => a.kind !== 'clearing' && (scope === 'all' || a.entity === scope) && inRange(date(a.openingDate), start, end)), a => Number(a.openingBalance) || 0);
        const expected = openingCash + openingInjection + netChange;
        return { start, end, scope, operating, investing, financing, net, netChange, openingCash, openingInjection, closingCash,
            closingSuspense: sum(closingAccounts.filter(a => a.kind === 'suspense'), a => a.balance),
            reconciled: expected === closingCash, difference: closingCash - expected };
    }

    // ---------- Shartnomalar (IFRS 15): har bir o'qish davri alohida ----------
    function contracts(data) {
        return memo(CT, data, () => {
            const settings = settingsOf(data), groups = new Map();
            for (const r of data.receipts || []) {
                if (!date(r.date)) continue;
                const g = r.entity + ':' + (r.leadId || r.studentId || 'r:' + r.id);
                if (!groups.has(g)) groups.set(g, []);
                groups.get(g).push(r);
            }
            const refundsByReceipt = new Map();
            for (const t of data.transactions || []) if (t.type === 'refund' && t.paymentRecordId) {
                if (!refundsByReceipt.has(t.paymentRecordId)) refundsByReceipt.set(t.paymentRecordId, []);
                refundsByReceipt.get(t.paymentRecordId).push({ date: t.date, amount: (t.reversesId ? -1 : 1) * t.amount });
            }
            const out = [];
            for (const [g, list] of groups) {
                list.sort((a, b) => a.date.localeCompare(b.date));
                const leadValue = Math.max(0, ...list.map(r => Number(r.contractValue) || 0));
                let current = null, n = 0;
                for (const r of list) {
                    const liveSum = sum(current ? current.receipts.filter(x => !x.voidDate) : []);
                    // Yangi o'qish davri: oldingi davr tugagan VA uning qiymati to'liq to'langan bo'lsa.
                    // Kech to'langan qarz (davr tugagach) eski shartnomaga yoziladi, yangi kurs ochmaydi.
                    if (!current || (r.date > current.end && liveSum >= current.threshold)) {
                        const months = Math.max(1, Number(settings.courseMonths[r.entity]) || 3);
                        current = { key: g + '#' + (++n), group: g, index: n, entity: r.entity, name: r.name, leadId: r.leadId, studentId: r.studentId, start: r.date, months,
                            end: addDays(addMonths(r.date, months), -1), receipts: [], refunds: [], threshold: n === 1 ? leadValue : 0 };
                        out.push(current);
                    }
                    current.receipts.push(r);
                    for (const f of refundsByReceipt.get(r.id) || []) current.refunds.push(f);
                }
            }
            for (const c of out) {
                const live = c.receipts.filter(r => !r.voidDate);
                c.value = live.length ? Math.max(c.index === 1 ? c.threshold : 0, sum(live)) : 0;
                c.firstReceipt = live[0] || null;
                c.startLive = live[0]?.date || null;
                const refunds = c.refunds.slice().sort((a, b) => a.date.localeCompare(b.date));
                let acc = 0; c.terminatedAt = null;
                for (const f of refunds) { acc += f.amount; if (acc > 0 && !c.terminatedAt) c.terminatedAt = f.date; if (acc <= 0) c.terminatedAt = null; }
            }
            return out;
        });
    }
    function contractCash(c, asOf) {
        return sum(c.receipts.filter(r => r.date <= asOf)) - sum(c.receipts.filter(r => r.voidDate && r.voidDate <= asOf))
            - sum(c.refunds.filter(f => f.date <= asOf));
    }
    function contractLive(c, asOf) { return c.receipts.some(r => r.date <= asOf && !(r.voidDate && r.voidDate <= asOf)); }
    function straightLine(c, asOf) {
        if (!c.value || !c.start || asOf < c.start) return 0;
        const total = dayDiff(c.start, c.end) + 1, done = Math.min(total, dayDiff(c.start, asOf) + 1);
        return Math.floor(c.value * done / total);
    }
    // Tushum (qaytarishdan oldingi) va yakuniy tan olingan tushum.
    function revenueBase(c, asOf) {
        if (!contractLive(c, asOf)) return 0;
        return straightLine(c, c.terminatedAt && asOf >= c.terminatedAt ? c.terminatedAt : asOf);
    }
    function earned(c, asOf) {
        const base = revenueBase(c, asOf);
        // Qaytarish shartnomani tugatadi: o'qitilgan qismdan ko'p, qolgan puldan ko'p tan olinmaydi.
        return c.terminatedAt && asOf >= c.terminatedAt ? Math.min(base, Math.max(0, contractCash(c, asOf))) : base;
    }
    function contractPosition(c, asOf) { return earned(c, asOf) - contractCash(c, asOf); }

    // ---------- Asosiy vositalar va amortizatsiya ----------
    function fixedAssets(data) {
        const life = settingsOf(data).usefulLifeMonths;
        return movements(data).filter(m => m.category === 'CAPEX').map(m => ({ id: m.id, date: m.date, entity: m.entity, cost: -m.sign * m.amount,
            end: addDays(addMonths(m.date, Number(m.usefulLifeMonths) || life), -1), description: m.counterparty || m.description }));
    }
    function depreciationAt(asset, asOf) {
        if (asOf < asset.date) return 0;
        const total = dayDiff(asset.date, asset.end) + 1, done = Math.min(total, dayDiff(asset.date, asOf) + 1);
        return Math.trunc(asset.cost * done / total);
    }

    // ---------- Kutilayotgan kredit zarari (IFRS 9, soddalashtirilgan matritsa) ----------
    function agingBucket(dueDate, asOf) {
        const due = date(dueDate);
        if (!due) return 'no_date';
        const overdue = dayDiff(due, asOf);
        return overdue <= 0 ? 'not_due' : overdue <= 30 ? 'd1_30' : overdue <= 60 ? 'd31_60' : overdue <= 90 ? 'd61_90' : 'd90';
    }
    function eclAt(data, asOf, scope = 'all') {
        const rates = settingsOf(data).eclRates, byKey = new Map();
        for (const r of data.receivables || []) { if (r.leadId) byKey.set('l:' + r.leadId, r); if (r.studentId) byKey.set('s:' + r.studentId, r); }
        let total = 0;
        for (const c of contracts(data)) {
            if (!scopeMatch(c.entity, scope)) continue;
            const pos = contractPosition(c, asOf);
            if (pos <= 0) continue;
            const r = byKey.get('l:' + c.leadId) || byKey.get('s:' + c.studentId);
            total += Math.floor(pos * (Number(rates[agingBucket(r?.dueDate, asOf)]) || 0) / 100);
        }
        return total;
    }

    // ---------- Foyda va zarar (P&L) ----------
    const PNL_LINES = [
        ['revenue', 'Kurs to‘lovlaridan tushum'], ['refunds', 'Qaytarishlar va tugatilgan shartnomalar'], ['net_revenue', 'Sof tushum', 'total'],
        ['cost_of_services', 'Xizmat tannarxi (o‘qituvchilar, kontent)'], ['gross_profit', 'Yalpi foyda', 'total'],
        ['sales_payroll', 'Sotuv bo‘limi maoshi va bonuslari'], ['marketing', 'Marketing va reklama'], ['admin_payroll', 'Ma’muriy xodimlar maoshi'],
        ['payroll_tax', 'Ish haqi soliqlari'], ['rent', 'Ijara va kommunal'], ['software', 'Dasturlar va servislar'], ['admin', 'Ofis va ma’muriy xarajatlar'],
        ['payment_fees', 'To‘lov tizimi va Uzum komissiyalari'], ['turnover_tax', 'Aylanmadan soliq / QQS'], ['credit_losses', 'Kutilayotgan kredit zarari (ECL)'],
        ['allocated_common', 'Umumiy xarajatlar ulushi (taqsimlangan)'],
        ['opex', 'Operatsion xarajatlar jami', 'subtotal'], ['ebitda', 'EBITDA', 'total'], ['depreciation', 'Amortizatsiya'], ['ebit', 'Operatsion foyda (EBIT)', 'total'],
        ['other_income', 'Boshqa daromad'], ['finance_cost', 'Foiz xarajatlari'], ['other_expense', 'Boshqa xarajatlar'], ['prior_adjustments', 'O‘tgan (yopilgan) davrlar tuzatishi'],
        ['profit_before_tax', 'Soliqqacha foyda', 'total'], ['income_tax', 'Foyda solig‘i'], ['net_profit', 'Sof foyda', 'total']
    ];
    const OPEX_KEYS = ['sales_payroll', 'marketing', 'admin_payroll', 'payroll_tax', 'rent', 'software', 'admin', 'payment_fees', 'turnover_tax', 'credit_losses', 'allocated_common'];
    const INCOME_LINES = new Set(['revenue', 'other_income', 'prior_adjustments']);
    function pnlFromBuckets(b) {
        const v = k => b[k] || 0;
        const net_revenue = v('revenue') - v('refunds');
        const gross_profit = net_revenue - v('cost_of_services');
        const opex = sum(OPEX_KEYS.map(k => v(k)), x => x);
        const ebitda = gross_profit - opex, ebit = ebitda - v('depreciation');
        const profit_before_tax = ebit + v('other_income') - v('finance_cost') - v('other_expense') + v('prior_adjustments');
        const net_profit = profit_before_tax - v('income_tax');
        return { ...b, net_revenue, gross_profit, opex, ebitda, ebit, profit_before_tax, net_profit,
            margins: { gross: pct(gross_profit, net_revenue), ebitda: pct(ebitda, net_revenue), net: pct(net_profit, net_revenue) } };
    }
    function addTo(b, line, value) { if (line && value) b[line] = (b[line] || 0) + value; }
    function cashBuckets(data, start, end, scope) {
        const b = {};
        for (const m of movements(data)) {
            if (!inRange(m.date, start, end) || !scopeMatch(m.entity, scope)) continue;
            const line = (CATEGORY[m.category] || {}).pnl;
            if (!line) continue;
            addTo(b, line, INCOME_LINES.has(line) ? m.sign * m.amount : -m.sign * m.amount);
        }
        return b;
    }
    function accrualBuckets(data, start, end, scope) {
        const b = {}, before = addDays(start, -1);
        for (const c of contracts(data)) {
            if (!scopeMatch(c.entity, scope)) continue;
            const base = revenueBase(c, end) - revenueBase(c, before);
            const term = (revenueBase(c, end) - earned(c, end)) - (revenueBase(c, before) - earned(c, before));
            addTo(b, 'revenue', base); addTo(b, 'refunds', term);
        }
        for (const m of movements(data)) {
            if (m.source !== 'transaction' || !inRange(m.date, start, end) || !scopeMatch(m.entity, scope)) continue;
            if (m.salaryId || m.payableId || m.category === 'CAPEX') continue; // hisoblangan sanada / aktiv sifatida alohida
            if (m.category === 'REFUND' && m.paymentRecordId) continue;     // shartnoma orqali hisoblangan
            const line = (CATEGORY[m.category] || {}).pnl;
            if (!line) continue;
            addTo(b, line, INCOME_LINES.has(line) ? m.sign * m.amount : -m.sign * m.amount);
        }
        for (const s of data.salaries || []) {
            if (s.amount > 0 && scopeMatch(s.entity, scope) && inRange(s.accrualDate, start, end)) addTo(b, (CATEGORY[s.categoryCode] || CATEGORY.PAY_ADMIN).pnl, s.amount);
        }
        for (const p of data.payables || []) {
            if (p.kind !== 'loan' && !p.voided && scopeMatch(p.entity, scope) && inRange(p.issueDate, start, end)) addTo(b, (CATEGORY[p.categoryCode] || CATEGORY.OTHER_EXP).pnl, p.amount);
        }
        for (const a of fixedAssets(data)) if (scopeMatch(a.entity, scope)) addTo(b, 'depreciation', depreciationAt(a, end) - depreciationAt(a, before));
        addTo(b, 'credit_losses', eclAt(data, end, scope) - eclAt(data, before, scope));
        return b;
    }
    function rawBuckets(data, start, end, scope, basis) {
        const fn = basis === 'accrual' ? accrualBuckets : cashBuckets;
        const b = fn(data, start, end, scope);
        if (scope === 'english' || scope === 'russian') {
            // Umumiy (ikkala maktabga tegishli) natija sof tushum ulushiga ko'ra taqsimlanadi.
            const common = pnlFromBuckets(fn(data, start, end, 'common'));
            const nr = s => pnlFromBuckets(fn(data, start, end, s)).net_revenue;
            const mine = nr(scope), other = nr(scope === 'english' ? 'russian' : 'english'), total = mine + other;
            const share = total > 0 ? Math.max(0, mine) / total : 0.5;
            const allocated = Math.round(-common.net_profit * share);
            if (allocated) b.allocated_common = allocated;
            b._allocation = { share: Math.round(share * 1000) / 10, commonResult: common.net_profit, marketing: Math.round((common.marketing || 0) * share) };
        }
        return b;
    }
    function mergeBuckets(target, src) {
        for (const [k, v] of Object.entries(src || {})) {
            if (k === '_allocation') { target._allocation = target._allocation || { share: v.share, commonResult: 0, marketing: 0 }; target._allocation.commonResult += v.commonResult; target._allocation.marketing += v.marketing; continue; }
            if (typeof v === 'number') target[k] = (target[k] || 0) + v;
        }
        return target;
    }
    function snapshotOf(data, month, scope, basis) {
        const closed = data.closedThrough || '';
        return closed && month <= closed ? data.snapshots?.[month]?.pnl?.[scope]?.[basis] || null : null;
    }
    function profitAndLoss(data, { start, end, scope = 'all', basis = 'cash' }) {
        const closed = data.closedThrough || '';
        const b = {}, segments = [];
        let usedSnapshot = false, partialClosed = false;
        for (const month of monthsBetween(start, end)) {
            const s = month + '-01' < start ? start : month + '-01', e = monthEnd(month) > end ? end : monthEnd(month);
            const full = s === month + '-01' && e === monthEnd(month);
            const snap = full ? snapshotOf(data, month, scope, basis) : null;
            if (snap) { mergeBuckets(b, snap); usedSnapshot = true; }
            else { mergeBuckets(b, rawBuckets(data, s, e, scope, basis)); if (closed && month <= closed) partialClosed = true; }
            segments.push(month);
        }
        // Yopilgan oylar keyinchalik o'zgargan bo'lsa — farq birinchi ochiq oyga "o'tgan davr tuzatishi" bo'lib tushadi.
        let priorDetail = [];
        if (closed) {
            const firstOpen = monthOf(addMonths(closed + '-01', 1));
            if (segments.includes(firstOpen)) {
                for (const month of Object.keys(data.snapshots || {}).filter(m => m <= closed).sort()) {
                    const snap = snapshotOf(data, month, scope, basis);
                    if (!snap) continue;
                    const diff = pnlFromBuckets(rawBuckets(data, month + '-01', monthEnd(month), scope, basis)).net_profit - pnlFromBuckets(snap).net_profit;
                    if (diff) { b.prior_adjustments = (b.prior_adjustments || 0) + diff; priorDetail.push({ month, amount: diff }); }
                }
            }
        }
        const result = pnlFromBuckets(b);
        const mv = movements(data).filter(m => inRange(m.date, start, end) && scopeMatch(m.entity, scope));
        result.belowTheLine = {
            capex: -sum(mv.filter(m => m.category === 'CAPEX'), m => m.sign * m.amount),
            ownerDrawings: -sum(mv.filter(m => m.category === 'OWNER_OUT'), m => m.sign * m.amount),
            ownerContributions: sum(mv.filter(m => m.category === 'OWNER_IN'), m => m.sign * m.amount),
            loansReceived: sum(mv.filter(m => m.category === 'LOAN_IN'), m => m.sign * m.amount),
            loansRepaid: -sum(mv.filter(m => m.category === 'LOAN_REPAY'), m => m.sign * m.amount)
        };
        result.allocation = b._allocation || null;
        result.priorDetail = priorDetail;
        result.usedSnapshot = usedSnapshot; result.partialClosed = partialClosed;
        result.basis = basis; result.start = start; result.end = end; result.scope = scope;
        result.lines = PNL_LINES.filter(([key]) => !(key === 'allocated_common' && scope === 'all')).map(([key, label, kind]) => ({ key, label, kind: kind || 'line', amount: result[key] || 0 }));
        return result;
    }
    function monthlyPnl(data, { start, end, scope = 'all', basis = 'cash' }) {
        return monthsBetween(start, end).map(month => {
            const s = month + '-01' < start ? start : month + '-01', e = monthEnd(month) > end ? end : monthEnd(month);
            const p = profitAndLoss(data, { start: s, end: e, scope, basis });
            return { month, start: s, end: e, revenue: p.revenue || 0, refunds: p.refunds || 0, net_revenue: p.net_revenue, cost_of_services: p.cost_of_services || 0,
                gross_profit: p.gross_profit, opex: p.opex, ebitda: p.ebitda, net_profit: p.net_profit, closed: !!(data.closedThrough && month <= data.closedThrough) };
        });
    }

    // ---------- Debitorlik: to'lov jadvali bo'yicha kutilayotgan to'lovlar (CRM, joriy holat) ----------
    const AGING = [['not_due', 'Muddati kelmagan'], ['d1_30', '1–30 kun'], ['d31_60', '31–60 kun'], ['d61_90', '61–90 kun'], ['d90', '90+ kun'], ['no_date', 'To‘lov sanasi yo‘q']];
    function receivablesAging(receivables, asOf, scope = 'all') {
        const buckets = Object.fromEntries(AGING.map(([k]) => [k, { amount: 0, count: 0 }]));
        const rows = [];
        for (const r of receivables || []) {
            if (!scopeMatch(r.entity, scope) || !(Number(r.debt) > 0)) continue;
            const bucket = agingBucket(r.dueDate, asOf), due = date(r.dueDate), overdue = due ? dayDiff(due, asOf) : 0;
            buckets[bucket].amount += Number(r.debt); buckets[bucket].count++;
            rows.push({ ...r, debt: Number(r.debt), dueDate: due, overdueDays: overdue > 0 ? overdue : 0, bucket });
        }
        rows.sort((a, b) => b.overdueDays - a.overdueDays || b.debt - a.debt);
        const total = sum(rows, r => r.debt), overdue = sum(rows.filter(r => r.overdueDays > 0), r => r.debt);
        return { asOf, total, overdue, count: rows.length, buckets: AGING.map(([key, label]) => ({ key, label, ...buckets[key], share: pct(buckets[key].amount, total) })), rows };
    }

    // ---------- Kreditorlik (korxona qarzlari) ----------
    function payablesSummary(data, asOf, scope = 'all') {
        const s0 = settingsOf(data), rows = [], tx = data.transactions || [];
        const paidOf = id => sum(tx.filter(t => t.payableId === id && t.type !== 'loan_in' && t.date <= asOf), t => (t.reversesId ? -1 : 1) * t.amount);
        for (const p of data.payables || []) {
            if (p.voided || !scopeMatch(p.entity, scope) || p.issueDate > asOf) continue;
            const paid = paidOf(p.id), outstanding = Math.max(0, p.amount - paid);
            if (!outstanding) continue;
            rows.push({ id: p.id, kind: p.kind, entity: p.entity, counterparty: p.counterparty, description: p.description, categoryCode: p.categoryCode,
                issueDate: p.issueDate, dueDate: p.dueDate, amount: p.amount, paid, outstanding, overdueDays: p.dueDate && p.dueDate < asOf ? dayDiff(p.dueDate, asOf) : 0 });
        }
        for (const s of data.salaries || []) {
            if (s.amount <= 0 || !scopeMatch(s.entity, scope) || s.accrualDate > asOf) continue;
            const cashOut = sum(tx.filter(t => t.salaryId === s.id && t.date <= asOf), t => (t.reversesId ? -1 : 1) * t.amount);
            const outstanding = Math.max(0, s.amount - cashOut);
            if (!outstanding) continue;
            const due = addDays(s.accrualDate, Number(s0.salaryDueDays) || 0);
            rows.push({ id: 'salary:' + s.id, salaryId: s.id, kind: 'salary', entity: s.entity, counterparty: s.employeeName, description: `Maosh ${s.periodStart} — ${s.periodEnd}`,
                categoryCode: s.categoryCode, issueDate: s.accrualDate, dueDate: due, amount: s.amount, paid: cashOut, outstanding,
                overdueDays: due < asOf ? dayDiff(due, asOf) : 0, unreconciled: s.status === 'paid' });
        }
        rows.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '') || b.outstanding - a.outstanding);
        const byKind = k => sum(rows.filter(r => r.kind === k), r => r.outstanding);
        return { asOf, total: sum(rows, r => r.outstanding), salaries: byKind('salary'), bills: byKind('bill'), loans: byKind('loan'), other: byKind('other'),
            unreconciledSalaries: sum(rows.filter(r => r.unreconciled), r => r.outstanding), overdue: sum(rows.filter(r => r.overdueDays > 0), r => r.outstanding), rows };
    }

    // ---------- Balans (konsolidatsiya) ----------
    function balanceSheet(data, asOf, scope = 'all') {
        const closed = data.closedThrough || '', m = monthOf(asOf);
        if (scope === 'all' && closed && m <= closed && asOf === monthEnd(m) && data.snapshots?.[m]?.balance) return { ...data.snapshots[m].balance, fromSnapshot: true };
        return balanceSheetRaw(data, asOf, scope);
    }
    function balanceSheetRaw(data, asOf, scope = 'all') {
        const accounts = accountBalances(data, asOf, scope), cs = cashSummary(accounts);
        let contractAssets = 0, contractLiabilities = 0;
        for (const c of contracts(data)) {
            if (!scopeMatch(c.entity, scope)) continue;
            const pos = contractPosition(c, asOf);
            if (pos > 0) contractAssets += pos; else contractLiabilities -= pos;
        }
        const ecl = eclAt(data, asOf, scope);
        const assets = fixedAssets(data).filter(a => scopeMatch(a.entity, scope) && a.date <= asOf);
        const ppeCost = sum(assets, a => a.cost), ppeDep = sum(assets, a => depreciationAt(a, asOf));
        const ap = payablesSummary(data, asOf, scope);
        const totalAssets = cs.equivalents + cs.suspense + cs.clearing + contractAssets - ecl + ppeCost - ppeDep;
        const totalLiabilities = contractLiabilities + ap.total;
        const netAssets = totalAssets - totalLiabilities;
        // Kapital harakati: boshlang'ich qoldiq + ta'sischi mablag'i − olingan mablag' + jamg'arilgan foyda.
        const mv = movements(data).filter(x => x.date <= asOf && scopeMatch(x.entity, scope));
        const openingEquity = sum((data.accounts || []).filter(a => (scope === 'all' || a.entity === scope) && date(a.openingDate) && a.openingDate <= asOf), a => Number(a.openingBalance) || 0)
            + sum((data.accounts || []).filter(a => (scope === 'all' || a.entity === scope) && !date(a.openingDate)), a => Number(a.openingBalance) || 0);
        const contributions = sum(mv.filter(x => x.category === 'OWNER_IN'), x => x.sign * x.amount);
        const drawings = -sum(mv.filter(x => x.category === 'OWNER_OUT'), x => x.sign * x.amount);
        const retained = pnlFromBuckets(rawBuckets(data, firstDate(data) < asOf ? firstDate(data) : asOf, asOf, scope, 'accrual')).net_profit - (scope === 'all' ? 0 : 0);
        // Hisob ochilish sanasidan oldingi pul harakatlari boshlang'ich qoldiq ichida deb qabul qilinadi.
        const preOpening = sum(mv.filter(x => x.date < openingDateOf(data, x.account)), x => x.sign * x.amount);
        const equityRollForward = openingEquity + contributions - drawings + retained - preOpening;
        return { asOf, scope, accounts, cashEquivalents: cs.equivalents, suspense: cs.suspense, uzumReceivable: cs.clearing, cash: cs.cash,
            contractAssets, ecl, contractAssetsNet: contractAssets - ecl, ppeCost, ppeDepreciation: ppeDep, ppeNet: ppeCost - ppeDep,
            totalAssets, contractLiabilities, payables: { salaries: ap.salaries, bills: ap.bills, other: ap.other, unreconciledSalaries: ap.unreconciledSalaries }, loans: ap.loans,
            totalLiabilities, netAssets, equity: { opening: openingEquity, contributions, drawings, retained, preOpening, total: equityRollForward },
            balanced: equityRollForward === netAssets, imbalance: netAssets - equityRollForward,
            // eski nomlar (UI va eksport uchun)
            assets: totalAssets, liabilities: totalLiabilities, deferredRevenue: contractLiabilities, receivables: contractAssets - ecl };
    }

    // ---------- Asosiy ko'rsatkichlar ----------
    function kpis(data, { start, end, scope = 'all' }) {
        const pnl = profitAndLoss(data, { start, end, scope, basis: 'cash' });
        const started = contracts(data).filter(c => scopeMatch(c.entity, scope) && c.startLive && inRange(c.startLive, start, end) && c.value > 0);
        const newClients = started.filter(c => c.index === 1), renewals = started.filter(c => c.index > 1);
        const firstPayments = started.map(c => c.firstReceipt.amount);
        const liveReceipts = movements(data).filter(m => m.category === 'REV_TUITION' && inRange(m.date, start, end) && scopeMatch(m.entity, scope));
        const voided = new Set(movements(data).filter(m => m.isReversal && m.receiptId).map(m => m.receiptId));
        const firstIds = new Set(started.map(c => c.firstReceipt.id));
        const collections = sum(liveReceipts.filter(m => !m.isReversal && !voided.has(m.receiptId) && !firstIds.has(m.receiptId)));
        const marketing = (pnl.marketing || 0) + (pnl.allocation?.marketing || 0);
        const salesPay = pnl.sales_payroll || 0;
        const endMonth = monthOf(end), months3 = [1, 2, 3].map(i => monthOf(addMonths(endMonth + '-01', -i)));
        const opFlows = months3.map(m => cashFlowStatement(data, { start: m + '-01', end: monthEnd(m), scope }).net.operating);
        const avgOperating = Math.round(sum(opFlows, x => x) / 3);
        const cs = cashSummary(accountBalances(data, end, scope));
        return {
            basis: 'cash', netRevenue: pnl.net_revenue, grossMargin: pnl.margins.gross, netMargin: pnl.margins.net, netProfit: pnl.net_profit,
            newClients: newClients.length, renewals: renewals.length, newSales: started.length,
            averageContract: started.length ? Math.round(sum(started, c => c.value) / started.length) : null,
            averageFirstPayment: firstPayments.length ? Math.round(sum(firstPayments, x => x) / firstPayments.length) : null,
            collections, receiptCount: liveReceipts.filter(m => !m.isReversal && !voided.has(m.receiptId)).length,
            cac: newClients.length && marketing ? Math.round(marketing / newClients.length) : null,
            fullCac: newClients.length && (marketing + salesPay) ? Math.round((marketing + salesPay) / newClients.length) : null,
            marketingShare: pct(marketing, pnl.net_revenue), averageMonthlyOperatingCashFlow: avgOperating,
            freeCash: cs.equivalents, runwayMonths: avgOperating < 0 ? Math.round((Math.max(0, cs.equivalents) / -avgOperating) * 10) / 10 : null
        };
    }

    // ---------- Ma'lumot sifati va shubhali yozuvlar ----------
    // Klaviaturada tasodifiy bosilgan "ism"larni aniqlash: undoshlar zanjiri yoki unli juda kam.
    function gibberish(name) {
        const tokens = String(name).toLowerCase().replace(/[ʻ‘’'`ʼ.-]/g, '').split(/\s+/).filter(Boolean);
        if (!tokens.length) return false;
        const bad = t => {
            if (/[а-яё]/i.test(t)) return /[бвгджзйклмнпрстфхцчшщ]{5,}/.test(t);
            if (!/^[a-z]+$/.test(t)) return false;
            const vowels = (t.match(/[aeiouy]/g) || []).length;
            if (t.length <= 2) return !vowels && tokens.length > 1;
            return /[bcdfghjklmnpqrstvwxz]{4,}/.test(t.replace(/sh|ch|ng/g, 'S')) || vowels / t.length < 0.2
                || (t.length <= 6 && /([bcdfghjklmnpqrstvwxz])[aeiou]?\1/.test(t) && vowels <= 1 && !/^(sh|ch)/.test(t));
        };
        return tokens.every(bad) || tokens.filter(bad).length >= 2;
    }
    function suspiciousReasons(r, settings = DEFAULT_SETTINGS) {
        const reasons = [];
        const name = String(r.name || '').trim().toLowerCase();
        const digits = String(r.phone || '').replace(/\D/g, '');
        if (/^(test|тест|aaa+|asd|qwe|xxx|demo)\b/i.test(name) || /^(.)\1{2,}$/.test(name.replace(/\s/g, ''))) reasons.push('Test yozuvga o‘xshaydi (ism)');
        else if (name && gibberish(name)) reasons.push('Ism ma’nosiz harflardan iborat');
        if (digits && digits.length < 9) reasons.push('Telefon raqam to‘liq emas');
        if (/^(\d)\1{8,}$/.test(digits.slice(-9)) || /^0{3,}|^8{3}0{6}$/.test(digits.slice(-9))) reasons.push('Telefon raqam soxta');
        if (Number(r.amount) > 0 && Number(r.amount) < (settings.suspiciousMin || 10000)) reasons.push('Summa juda kichik (nollar tushib qolgan bo‘lishi mumkin)');
        if (!r.managerId && !r.managerName) reasons.push('Menejer biriktirilmagan');
        return reasons;
    }
    function dataQuality(receipts, settings) {
        const live = (receipts || []).filter(r => !r.voidDate);
        const suspicious = live.map(r => ({ ...r, reasons: suspiciousReasons(r, settings) })).filter(r => r.reasons.length);
        return { total: live.length, withoutProof: live.filter(r => !r.receiptUrl).length, unknownMethod: live.filter(r => r.method === 'unknown').length,
            legacyReview: live.filter(r => r.legacyReview).length, voided: (receipts || []).filter(r => r.voidDate).length, suspicious, suspiciousAmount: sum(suspicious) };
    }

    // ---------- Oy yopilganda saqlanadigan muzlatilgan nusxa ----------
    function snapshotMonth(data, month) {
        const s = month + '-01', e = monthEnd(month), pnl = {};
        for (const scope of ['all', 'english', 'russian']) {
            pnl[scope] = {};
            for (const basis of ['cash', 'accrual']) { const b = rawBuckets(data, s, e, scope, basis); pnl[scope][basis] = b; }
        }
        const balance = balanceSheetRaw(data, e, 'all');
        return { month, pnl, balance: { ...balance, accounts: balance.accounts.map(a => ({ id: a.id, name: a.name, kind: a.kind, entity: a.entity, balance: a.balance })) }, createdAt: new Date().toISOString() };
    }

    // ---------- Tashqi ro'yxat bilan solishtirish ----------
    const CYR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', қ: 'q', ғ: 'g', ў: 'o', ҳ: 'h' };
    function nameTokens(value) {
        const latin = String(value || '').toLowerCase().replace(/[а-яёқғўҳ]/g, ch => CYR[ch] ?? ch).replace(/[ʻ‘’'`ʼ]/g, '').replace(/h/g, 'x').replace(/w/g, 'v');
        return [...new Set(latin.split(/[^a-z]+/).filter(t => t.length >= 3).map(t => t.replace(/(ovna|evna|ova|eva|yeva|yev|ov|ev|xon|jon|bek|oy|a)$/, '') || t))];
    }
    function tokenEq(x, y) { return x === y || (x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x))); }
    // strong: ikkala tomonda kamida 2 ta so'z va kamida 2 tasi mos (ism + familiya).
    // weak: bir tomonda bitta so'z (masalan, faqat ism) va u mos — faqat summa ham teng bo'lsa ishlatiladi.
    function nameMatch(a, b) {
        const ta = nameTokens(a), tb = nameTokens(b);
        if (!ta.length || !tb.length) return 'none';
        const hits = ta.filter(x => tb.some(y => tokenEq(x, y))).length;
        if (ta.length >= 2 && tb.length >= 2) return hits >= 2 ? 'strong' : 'none';
        return hits >= 1 ? 'weak' : 'none';
    }
    function nameSimilar(a, b) { return nameMatch(a, b) !== 'none'; }
    function reconcile(external, ledger, { tolerance = 3, start, end } = {}) {
        const ext = external.map((r, i) => ({ ...r, idx: i, date: date(r.date), amount: money(r.amount), phone: phone9(r.phone) })).filter(r => r.date && r.amount);
        const from = start || ext.map(r => r.date).sort()[0], to = end || ext.map(r => r.date).sort().at(-1);
        // Moslash uchun hovuz davrdan kengroq (oy chegarasidagi siljishlar uchun), "ro'yxatda yo'q" esa faqat davr ichida.
        const pool = (ledger || []).filter(r => !r.voidDate && inRange(r.date, addDays(from, -31), addDays(to, 31))).map(r => ({ ...r, phone9: phone9(r.phone) }));
        const candidates = [];
        for (const e of ext) for (const r of pool) {
            const phone = !!(e.phone && r.phone9 && e.phone === r.phone9), nm = nameMatch(e.name, r.name);
            if (!phone && nm === 'none') continue;
            const dd = Math.abs(dayDiff(e.date, r.date)), eq = r.amount === e.amount;
            let status = null;
            if (eq && dd <= tolerance) status = 'match';
            else if (eq && dd <= 31) status = 'date_diff';
            else if (!eq && dd <= tolerance && (phone || nm === 'strong')) status = 'amount_diff';
            if (!status || (!phone && nm === 'weak' && !eq)) continue;
            const score = (phone ? 1000 : 0) + (nm === 'strong' ? 400 : nm === 'weak' ? 150 : 0) + (eq ? 300 : 0) + ({ match: 200, date_diff: 60, amount_diff: 0 })[status] - dd * 3;
            candidates.push({ e, r, status, score, phone, nm, dd });
        }
        // Bitta to'lov CRM'da bo'lib-bo'lib kiritilgan bo'lishi mumkin (600k + 400k = 1 mln): aniq yig'indi
        // summa farqidan ustun, lekin aniq bitta mos yozuvdan past.
        for (const e of ext) {
            const same = pool.filter(r => Math.abs(dayDiff(e.date, r.date)) <= tolerance && ((e.phone && r.phone9 === e.phone) || nameMatch(e.name, r.name) === 'strong'));
            if (same.some(r => r.amount === e.amount)) continue;
            let found = null;
            for (let i = 0; i < same.length && !found; i++) for (let j = i + 1; j < same.length && !found; j++) {
                if (same[i].amount + same[j].amount === e.amount) found = [same[i], same[j]];
                for (let k = j + 1; k < same.length && !found; k++) if (same[i].amount + same[j].amount + same[k].amount === e.amount) found = [same[i], same[j], same[k]];
            }
            if (found) candidates.push({ e, rs: found, r: found[0], status: 'split', score: 1500 - Math.max(...found.map(r => Math.abs(dayDiff(e.date, r.date)))) * 3, phone: !!e.phone, nm: 'strong', dd: 0 });
        }
        candidates.sort((a, b) => b.score - a.score || a.dd - b.dd);
        const usedE = new Set(), usedR = new Set(), results = [];
        for (const c of candidates) {
            const rs = c.rs || [c.r];
            if (usedE.has(c.e.idx) || rs.some(r => usedR.has(r.id))) continue;
            usedE.add(c.e.idx); rs.forEach(r => usedR.add(r.id));
            results.push({ status: c.status, external: c.e, ledger: c.r, ledgers: rs, difference: sum(rs) - c.e.amount, phoneMismatch: !c.phone && !!(c.e.phone && c.r.phone9), nameOnly: !c.phone, nameMatch: c.nm });
        }
        for (const e of ext) if (!usedE.has(e.idx)) results.push({ status: 'missing_in_crm', external: e, ledger: null, ledgers: [], difference: -e.amount });
        for (const r of pool) if (!usedR.has(r.id) && inRange(r.date, from, to)) results.push({ status: 'extra_in_crm', external: null, ledger: r, ledgers: [r], difference: r.amount });
        const order = { missing_in_crm: 0, amount_diff: 1, extra_in_crm: 2, date_diff: 3, split: 4, match: 5 };
        results.sort((a, b) => order[a.status] - order[b.status] || ((a.external || a.ledger).date).localeCompare((b.external || b.ledger).date));
        const totalExternal = sum(ext), totalLedger = sum(pool.filter(r => inRange(r.date, from, to)));
        const count = s => results.filter(r => r.status === s).length;
        return { start: from, end: to, totalExternal, totalLedger, difference: totalLedger - totalExternal, results,
            counts: { match: count('match'), split: count('split'), date_diff: count('date_diff'), amount_diff: count('amount_diff'), missing_in_crm: count('missing_in_crm'), extra_in_crm: count('extra_in_crm') } };
    }

    // PDF/Excel'dan nusxalangan matnni qatorlarga ajratish. Har qatordan sana, telefon va
    // barcha summalar olinadi; qaysi summa ustuni "to'lov" ekanini foydalanuvchi tanlaydi.
    function parseStatementText(text) {
        const rows = [];
        for (const raw of String(text || '').split(/\r?\n/)) {
            const line = raw.replace(/ /g, ' ').trim();
            if (!line) continue;
            const dm = line.match(/(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})/);
            if (!dm || !date(dm[1])) continue;
            const after = line.slice(dm.index + dm[1].length);
            // Faqat O'zbekiston operator kodlari bilan boshlangan 9 xonali raqam telefon deb olinadi.
            const pm = after.match(/(?:\+?998[\s-]?)?\(?(9[0-9]|33|50|55|77|88|20|71)\)?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})(?!\d)/);
            const phone = pm ? pm.slice(1).join('') : '';
            const nameRaw = (pm ? after.slice(0, pm.index) : after.split(/\d/)[0]).replace(/[|\t;,]+/g, ' ').replace(/\s+/g, ' ').trim();
            const rest = (pm ? after.slice(pm.index + pm[0].length) : after).replace(/\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2}/g, ' ');
            const amounts = [...rest.matchAll(/(\d{1,3}(?:[  .,]\d{3})+|\d{4,})\s*(?:uzs|so['‘’]?m|sum)?/gi)]
                .map(m => money(m[1].replace(/[., ]/g, ' '))).filter(n => n != null && n >= 1000);
            rows.push({ date: date(dm[1]), name: nameRaw, phone, amounts, line });
        }
        return rows;
    }

    return {
        ENTITIES, TYPES, CATEGORIES, CATEGORY, DEFAULT_ACCOUNTS, ACCOUNT_KINDS, EQUIVALENT_KINDS, DEFAULT_SETTINGS, PNL_LINES, CF_LINES, AGING,
        money, date, today, addDays, addMonths, dayDiff, monthOf, monthEnd, monthsBetween, inRange, phone9, pct, settingsOf,
        accountForMethod, movements, accountBalances, cashSummary, cashbook, cashFlowStatement, profitAndLoss, monthlyPnl,
        contracts, contractCash, earned, revenueBase, contractPosition, fixedAssets, depreciationAt, eclAt, agingBucket,
        receivablesAging, payablesSummary, balanceSheet, balanceSheetRaw, kpis, snapshotMonth,
        suspiciousReasons, dataQuality, reconcile, parseStatementText, nameSimilar, nameMatch
    };
});
