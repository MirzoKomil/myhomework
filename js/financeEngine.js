// Myhomework.uz — Moliya hisob-kitob yadrosi (server va brauzerda bir xil ishlaydi).
//
// Tamoyillar:
//  * Pul faqat butun so'mda (BIGINT) saqlanadi va hisoblanadi — kasr, yaxlitlash xatosi yo'q.
//  * Hech bir yozuv o'chirilmaydi yoki o'zgartirilmaydi. Xato yozuv teskari (storno)
//    yozuv bilan yopiladi; storno sanasi yopilgan oyga tushsa, birinchi ochiq kunga
//    o'tkaziladi. Shuning uchun yopilgan oy raqamlari hech qachon o'zgarmaydi.
//  * Har bir hisobot boshqasi bilan solishtiriladi: Cash Flow yakuniy qoldig'i
//    hisob raqamlar qoldiqlari yig'indisiga teng bo'lishi shart (reconciled=true).
//  * Taxmin qilingan raqam yo'q. Sozlamaga bog'liq (masalan, kurs davomiyligi)
//    har bir ko'rsatkich hisobotda "taxmin" sifatida ochiq yoziladi.
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.FinanceEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const ENTITIES = { english: 'Ingliz tili (Homework)', russian: 'Rus tili (Domwork)', common: 'Umumiy (taqsimlanmagan)' };
    const TYPES = {
        income: 'Boshqa tushum', expense: 'Xarajat', refund: 'Mijozga qaytarilgan to‘lov', capital: 'Ta’sischi kiritgan mablag‘',
        drawing: 'Ta’sischi olgan mablag‘', loan_in: 'Olingan qarz', loan_repay: 'Qarzni qaytarish', transfer: 'Hisoblar orasida o‘tkazma'
    };
    // cf: IAS 7 bo'limi; pnl: Foyda-zarar qatori (null — P&L'ga kirmaydi).
    const CATEGORIES = [
        { code: 'REV_TUITION', name: 'Kurs to‘lovlari', type: 'receipt', cf: 'operating', pnl: 'revenue', system: true },
        { code: 'REV_OTHER', name: 'Boshqa daromad (kitob, material, xizmat)', type: 'income', cf: 'operating', pnl: 'other_income' },
        { code: 'REFUND', name: 'Mijozga qaytarilgan to‘lov', type: 'refund', cf: 'operating', pnl: 'refunds' },
        { code: 'COS_TEACHERS', name: 'O‘qituvchilar maoshi', type: 'expense', cf: 'operating', pnl: 'cost_of_services', cfLine: 'employees' },
        { code: 'COS_CONTENT', name: 'Darslik, kontent va o‘quv materiallari', type: 'expense', cf: 'operating', pnl: 'cost_of_services', cfLine: 'suppliers' },
        { code: 'PAY_SALES', name: 'Sotuv bo‘limi maoshi va bonuslari', type: 'expense', cf: 'operating', pnl: 'sales_payroll', cfLine: 'employees' },
        { code: 'PAY_ADMIN', name: 'Ma’muriy xodimlar maoshi', type: 'expense', cf: 'operating', pnl: 'admin_payroll', cfLine: 'employees' },
        { code: 'MKT_ADS', name: 'Target reklama byudjeti', type: 'expense', cf: 'operating', pnl: 'marketing', cfLine: 'suppliers' },
        { code: 'MKT_OTHER', name: 'Marketing: kontent, bloger, dizayn', type: 'expense', cf: 'operating', pnl: 'marketing', cfLine: 'suppliers' },
        { code: 'RENT', name: 'Ijara va kommunal', type: 'expense', cf: 'operating', pnl: 'rent', cfLine: 'suppliers' },
        { code: 'SOFTWARE', name: 'Dasturlar va servislar (CRM, telefoniya, SMS, hosting)', type: 'expense', cf: 'operating', pnl: 'software', cfLine: 'suppliers' },
        { code: 'ADMIN', name: 'Ofis va ma’muriy xarajatlar', type: 'expense', cf: 'operating', pnl: 'admin', cfLine: 'suppliers' },
        { code: 'BANK_FEES', name: 'Bank, to‘lov tizimi va Uzum komissiyalari', type: 'expense', cf: 'operating', pnl: 'finance_cost', cfLine: 'fees' },
        { code: 'TAX', name: 'Soliqlar va majburiy to‘lovlar', type: 'expense', cf: 'operating', pnl: 'tax', cfLine: 'taxes' },
        { code: 'OTHER_EXP', name: 'Boshqa xarajatlar', type: 'expense', cf: 'operating', pnl: 'other_expense', cfLine: 'suppliers' },
        { code: 'CAPEX', name: 'Uskuna va aktivlar (kapital xarajat)', type: 'expense', cf: 'investing', pnl: null, cfLine: 'capex' },
        { code: 'OWNER_IN', name: 'Ta’sischi kiritgan mablag‘', type: 'capital', cf: 'financing', pnl: null, cfLine: 'owner_in' },
        { code: 'OWNER_OUT', name: 'Ta’sischi olgan mablag‘ (dividend, shaxsiy)', type: 'drawing', cf: 'financing', pnl: null, cfLine: 'owner_out' },
        { code: 'LOAN_IN', name: 'Olingan qarz', type: 'loan_in', cf: 'financing', pnl: null, cfLine: 'loan_in' },
        { code: 'LOAN_REPAY', name: 'Qarzni qaytarish', type: 'loan_repay', cf: 'financing', pnl: null, cfLine: 'loan_out' },
        { code: 'TRANSFER', name: 'Hisoblar orasida o‘tkazma', type: 'transfer', cf: null, pnl: null }
    ];
    const CATEGORY = Object.fromEntries(CATEGORIES.map(c => [c.code, c]));
    const DEFAULT_ACCOUNTS = [
        { id: 'acc-cash', entity: 'common', name: 'Kassa (naqd pul)', kind: 'cash', methods: ['cash'] },
        { id: 'acc-card', entity: 'common', name: 'Karta (P2P / terminal)', kind: 'card', methods: ['card', 'payme', 'click', 'paylater'] },
        { id: 'acc-bank', entity: 'common', name: 'Bank hisob raqami', kind: 'bank', methods: ['bank'] },
        { id: 'acc-uzum', entity: 'common', name: 'Uzum Nasiya (kliring)', kind: 'clearing', methods: ['uzum'] },
        { id: 'acc-suspense', entity: 'common', name: 'Aniqlanmagan (tekshirish kerak)', kind: 'suspense', methods: ['unknown'] }
    ];
    const ACCOUNT_KINDS = { cash: 'Naqd', card: 'Karta', bank: 'Bank', clearing: 'Kliring', wallet: 'Elektron hamyon', suspense: 'Tekshiruvdagi' };
    const DEFAULT_SETTINGS = { courseMonths: { english: 3, russian: 3 }, suspiciousMin: 10000 };

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

    // ---------- Pul harakatlari: yagona ro'yxat ----------
    // Har bir harakat: { id, source, entity, date, account, toAccount, sign, amount, category, type, ... }
    // amount har doim musbat; yo'nalish sign (+1 kirim / -1 chiqim) bilan beriladi.
    function accountForMethod(accounts, method, entity) {
        const active = accounts.filter(a => a.active !== false);
        return active.find(a => a.entity === entity && (a.methods || []).includes(method))
            || active.find(a => a.entity === 'common' && (a.methods || []).includes(method))
            || active.find(a => a.kind === 'suspense') || null;
    }
    function receiptMovements(receipts, accounts) {
        const out = [];
        for (const r of receipts) {
            const account = accountForMethod(accounts, r.method, r.entity);
            const base = { source: 'receipt', receiptId: r.id, entity: r.entity, account: account?.id || 'acc-suspense', category: 'REV_TUITION', type: 'receipt',
                amount: r.amount, name: r.name, phone: r.phone, managerId: r.managerId, managerName: r.managerName, leadId: r.leadId, studentId: r.studentId, method: r.method,
                newSale: !!r.newSale, form: r.form };
            out.push({ ...base, id: 'r:' + r.id, date: r.date, sign: 1 });
            // Bekor qilingan tushum: asl sanada emas, bekor qilish sanasida manfiy yozuv.
            if (r.voidDate) out.push({ ...base, id: 'rv:' + r.id, date: r.voidDate, sign: -1, voidReason: r.voidReason, isReversal: true });
        }
        return out;
    }
    function transactionMovements(transactions) {
        const out = [];
        for (const t of transactions) {
            const cat = CATEGORY[t.categoryCode] || CATEGORY[{ income: 'REV_OTHER', refund: 'REFUND', capital: 'OWNER_IN', drawing: 'OWNER_OUT', loan_in: 'LOAN_IN', loan_repay: 'LOAN_REPAY', transfer: 'TRANSFER' }[t.type]] || CATEGORY.OTHER_EXP;
            // Storno yozuv asl yozuvning teskarisi: asl kirim bo'lsa chiqim, asl chiqim bo'lsa kirim.
            const reversal = !!t.reversesId, flip = reversal ? -1 : 1;
            const base = { source: 'transaction', transactionId: t.id, entity: t.entity, date: t.date, category: cat.code, type: t.type, amount: t.amount,
                counterparty: t.counterparty || '', description: t.description || '', isReversal: reversal, reversesId: t.reversesId || null, paymentRecordId: t.paymentRecordId || null,
                payableId: t.payableId || null, salaryId: t.salaryId || null, legacy: !!t.legacy };
            if (t.type === 'transfer') {
                out.push({ ...base, id: 't:' + t.id + ':out', account: t.accountId, sign: -1 * flip, transferLeg: 'out' });
                out.push({ ...base, id: 't:' + t.id + ':in', account: t.toAccountId, sign: 1 * flip, transferLeg: 'in' });
                continue;
            }
            const inflow = ['income', 'capital', 'loan_in'].includes(t.type);
            out.push({ ...base, id: 't:' + t.id, account: t.accountId, sign: (inflow ? 1 : -1) * flip });
        }
        return out;
    }
    function movements(data) {
        return [...receiptMovements(data.receipts || [], data.accounts || []), ...transactionMovements(data.transactions || [])]
            .filter(m => date(m.date))
            .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    }

    // ---------- Hisob raqamlar qoldig'i ----------
    function accountBalances(data, asOf, scope = 'all') {
        const mv = movements(data);
        return (data.accounts || []).map(a => {
            const opening = Number(a.openingBalance) || 0, openingDate = date(a.openingDate) || '0000-00-00';
            const flows = mv.filter(m => m.account === a.id && m.date >= openingDate && (!asOf || m.date <= asOf) && scopeMatch(m.entity, scope));
            const inflow = sum(flows.filter(m => m.sign > 0)), outflow = sum(flows.filter(m => m.sign < 0));
            // Boshlang'ich qoldiq hisob raqam egasiga tegishli: umumiy hisob faqat konsolidatsiyada qo'shiladi.
            const includeOpening = (scope === 'all' || a.entity === scope) && (!asOf || openingDate <= asOf);
            const lastCheck = (data.accountChecks || []).filter(c => c.accountId === a.id && (!asOf || c.date <= asOf)).sort((x, y) => x.date.localeCompare(y.date) || String(x.createdAt).localeCompare(String(y.createdAt))).at(-1) || null;
            const bookAtCheck = lastCheck ? (Number(a.openingBalance) || 0) + sum(mv.filter(m => m.account === a.id && m.date >= openingDate && m.date <= lastCheck.date), m => m.sign * m.amount) : null;
            return { id: a.id, name: a.name, kind: a.kind, entity: a.entity, active: a.active !== false, openingBalance: includeOpening ? opening : 0, openingDate: a.openingDate || '',
                inflow, outflow, balance: (includeOpening ? opening : 0) + inflow - outflow,
                check: lastCheck && { date: lastCheck.date, actual: Number(lastCheck.actualBalance), book: bookAtCheck, difference: Number(lastCheck.actualBalance) - bookAtCheck, note: lastCheck.note || '' } };
        });
    }

    // ---------- Kunlik kassa daftari ----------
    function cashbook(data, { start, end, account = '', scope = 'all' }) {
        const mv = movements(data).filter(m => scopeMatch(m.entity, scope) && (!account || m.account === account));
        const accounts = (data.accounts || []).filter(a => !account || a.id === account);
        const openingOf = asOfExclusive => accounts.reduce((n, a) => {
            const od = date(a.openingDate) || '0000-00-00', inc = scope === 'all' || a.entity === scope;
            return n + (inc && od < asOfExclusive ? Number(a.openingBalance) || 0 : 0)
                + sum(mv.filter(m => m.account === a.id && m.date >= od && m.date < asOfExclusive), m => m.sign * m.amount);
        }, 0);
        const days = [];
        let running = openingOf(start);
        const openingBalance = running;
        for (let d = start; d <= end; d = addDays(d, 1)) {
            const accountIds = new Set(accounts.map(a => a.id));
            const entries = mv.filter(m => m.date === d && accountIds.has(m.account)
                && m.date >= (date(accounts.find(a => a.id === m.account)?.openingDate) || '0000-00-00'));
            const inflow = sum(entries.filter(m => m.sign > 0)), outflow = sum(entries.filter(m => m.sign < 0));
            const opening = running; running += inflow - outflow;
            if (entries.length) days.push({ date: d, opening, inflow, outflow, closing: running, entries });
        }
        return { start, end, account, openingBalance, closingBalance: running,
            inflow: sum(days, d => d.inflow), outflow: sum(days, d => d.outflow), days };
    }

    // ---------- Pul oqimlari hisoboti (IAS 7, to'g'ridan-to'g'ri usul) ----------
    function cashFlowStatement(data, { start, end, scope = 'all' }) {
        const mv = movements(data).filter(m => inRange(m.date, start, end) && scopeMatch(m.entity, scope) && m.category !== 'TRANSFER');
        const line = pred => sum(mv.filter(pred), m => m.sign * m.amount);
        const cat = m => CATEGORY[m.category] || {};
        const operating = [
            { key: 'receipts', label: 'O‘quvchilardan olingan to‘lovlar', amount: line(m => m.category === 'REV_TUITION') },
            { key: 'other_in', label: 'Boshqa operatsion tushumlar', amount: line(m => m.category === 'REV_OTHER') },
            { key: 'refunds', label: 'Mijozlarga qaytarilgan to‘lovlar', amount: line(m => m.category === 'REFUND') },
            { key: 'employees', label: 'Xodimlarga to‘langan maosh va bonuslar', amount: line(m => cat(m).cfLine === 'employees') },
            { key: 'suppliers', label: 'Yetkazib beruvchilar va xizmatlar uchun to‘lovlar', amount: line(m => cat(m).cfLine === 'suppliers') },
            { key: 'fees', label: 'Bank va to‘lov tizimi komissiyalari', amount: line(m => cat(m).cfLine === 'fees') },
            { key: 'taxes', label: 'To‘langan soliqlar', amount: line(m => cat(m).cfLine === 'taxes') }
        ];
        const investing = [{ key: 'capex', label: 'Uskuna va aktivlar sotib olish', amount: line(m => cat(m).cfLine === 'capex') }];
        const financing = [
            { key: 'owner_in', label: 'Ta’sischi kiritgan mablag‘', amount: line(m => m.category === 'OWNER_IN') },
            { key: 'loan_in', label: 'Olingan qarzlar', amount: line(m => m.category === 'LOAN_IN') },
            { key: 'loan_out', label: 'Qaytarilgan qarzlar', amount: line(m => m.category === 'LOAN_REPAY') },
            { key: 'owner_out', label: 'Ta’sischiga to‘langan mablag‘', amount: line(m => m.category === 'OWNER_OUT') }
        ];
        const total = rows => sum(rows);
        const net = { operating: total(operating), investing: total(investing), financing: total(financing) };
        const netChange = net.operating + net.investing + net.financing;
        const before = addDays(start, -1);
        const openingCash = sum(accountBalances(data, before, scope), a => a.balance);
        const closingCash = sum(accountBalances(data, end, scope), a => a.balance);
        // Boshlang'ich qoldiq sanasi davr ichida bo'lsa, u ham harakat sifatida ko'rinadi.
        const openingInjection = sum((data.accounts || []).filter(a => (scope === 'all' || a.entity === scope) && inRange(date(a.openingDate), start, end)), a => Number(a.openingBalance) || 0);
        const preOpening = sum(movements(data).filter(m => inRange(m.date, start, end) && scopeMatch(m.entity, scope) && m.category !== 'TRANSFER'
            && m.date < (date((data.accounts || []).find(a => a.id === m.account)?.openingDate) || '0000-00-00')), m => m.sign * m.amount);
        const expectedClosing = openingCash + openingInjection + netChange - preOpening;
        return { start, end, scope, operating, investing, financing, net, netChange, openingCash, openingInjection, preOpeningExcluded: preOpening,
            closingCash, reconciled: expectedClosing === closingCash, difference: closingCash - expectedClosing };
    }

    // ---------- Foyda va zarar (P&L) ----------
    const PNL_LINES = [
        ['revenue', 'Kurs to‘lovlaridan tushum'], ['refunds', 'Qaytarilgan to‘lovlar'], ['net_revenue', 'Sof tushum', 'total'],
        ['cost_of_services', 'Xizmat tannarxi (o‘qituvchilar, kontent)'], ['gross_profit', 'Yalpi foyda', 'total'],
        ['sales_payroll', 'Sotuv bo‘limi maoshi va bonuslari'], ['marketing', 'Marketing va reklama'], ['admin_payroll', 'Ma’muriy xodimlar maoshi'],
        ['rent', 'Ijara va kommunal'], ['software', 'Dasturlar va servislar'], ['admin', 'Ofis va ma’muriy xarajatlar'],
        ['opex', 'Operatsion xarajatlar jami', 'subtotal'], ['ebitda', 'Operatsion foyda (EBITDA)', 'total'],
        ['other_income', 'Boshqa daromad'], ['finance_cost', 'Moliyaviy xarajatlar (komissiyalar)'], ['other_expense', 'Boshqa xarajatlar'],
        ['profit_before_tax', 'Soliqqacha foyda', 'total'], ['tax', 'Soliqlar'], ['net_profit', 'Sof foyda', 'total']
    ];
    function pnlFromBuckets(b) {
        const v = k => b[k] || 0;
        const net_revenue = v('revenue') - v('refunds');
        const gross_profit = net_revenue - v('cost_of_services');
        const opex = v('sales_payroll') + v('marketing') + v('admin_payroll') + v('rent') + v('software') + v('admin');
        const ebitda = gross_profit - opex;
        const profit_before_tax = ebitda + v('other_income') - v('finance_cost') - v('other_expense');
        const net_profit = profit_before_tax - v('tax');
        return { ...b, net_revenue, gross_profit, opex, ebitda, profit_before_tax, net_profit,
            margins: { gross: pct(gross_profit, net_revenue), ebitda: pct(ebitda, net_revenue), net: pct(net_profit, net_revenue) } };
    }
    // Kassa usuli: pul kirgan/chiqqan kunida tan olinadi.
    function cashBuckets(data, start, end, scope) {
        const b = {};
        for (const m of movements(data)) {
            if (!inRange(m.date, start, end) || !scopeMatch(m.entity, scope)) continue;
            const line = (CATEGORY[m.category] || {}).pnl;
            if (!line) continue;
            // Kirim kategoriyalari (+), xarajatlar (-) — buckets musbat summa saqlaydi.
            const signed = m.sign * m.amount;
            b[line] = (b[line] || 0) + (['revenue', 'other_income'].includes(line) ? signed : -signed);
        }
        return b;
    }
    // Hisoblash usuli (IFRS 15 / IAS 19 ga yaqin): tushum kurs davomida teng taqsimlanadi,
    // maosh hisoblangan davrida, xarajat hujjat (hisob-faktura) sanasida tan olinadi.
    function contractSchedule(data, scope) {
        const months = (data.settings || DEFAULT_SETTINGS).courseMonths || DEFAULT_SETTINGS.courseMonths;
        const byContract = new Map();
        for (const r of data.receipts || []) {
            if (!scopeMatch(r.entity, scope)) continue;
            const key = r.entity + ':' + (r.leadId || r.studentId || 'r:' + r.id);
            const c = byContract.get(key) || { key, entity: r.entity, name: r.name, receipts: [], contractValue: 0 };
            c.receipts.push(r);
            c.contractValue = Math.max(c.contractValue, Number(r.contractValue) || 0);
            byContract.set(key, c);
        }
        const out = [];
        for (const c of byContract.values()) {
            const cash = (asOf, from) => sum(c.receipts.filter(r => (!from || r.date >= from) && r.date <= asOf), r => r.amount)
                - sum(c.receipts.filter(r => r.voidDate && (!from || r.voidDate >= from) && r.voidDate <= asOf), r => r.amount);
            const live = c.receipts.filter(r => !r.voidDate);
            if (!live.length) { out.push({ ...c, start: null, end: null, cash, value: 0, months: 0 }); continue; }
            const startDate = live.map(r => r.date).sort()[0];
            const m = Math.max(1, Number(months[c.entity]) || 3);
            const value = Math.max(c.contractValue, sum(live, r => r.amount));
            out.push({ ...c, start: startDate, end: addDays(addMonths(startDate, m), -1), value, months: m, cash });
        }
        return out;
    }
    function recognized(contract, asOf) {
        if (!contract.start || asOf < contract.start) return 0;
        const total = dayDiff(contract.start, contract.end) + 1;
        const done = Math.min(total, dayDiff(contract.start, asOf) + 1);
        return Math.floor(contract.value * done / total);
    }
    function accrualBuckets(data, start, end, scope) {
        const b = {};
        const add = (line, value) => { if (line) b[line] = (b[line] || 0) + value; };
        // Tushum: kurs davomida, faqat qabul qilingan + qarz qilib berilgan shartnoma qiymati bo'yicha.
        for (const c of contractSchedule(data, scope)) add('revenue', recognized(c, end) - recognized(c, addDays(start, -1)));
        // Qaytarishlar, boshqa daromad, xarajatlar — harakat sanasida (maosh to'lovlari bundan mustasno).
        for (const m of movements(data)) {
            if (m.source !== 'transaction' || !inRange(m.date, start, end) || !scopeMatch(m.entity, scope)) continue;
            if (m.salaryId || m.payableId) continue; // hisoblangan sanada alohida qo'shiladi
            const line = (CATEGORY[m.category] || {}).pnl; if (!line) continue;
            add(line, ['other_income'].includes(line) ? m.sign * m.amount : -m.sign * m.amount);
        }
        for (const s of data.salaries || []) {
            if (!scopeMatch(s.entity, scope) || !inRange(s.accrualDate, start, end) || s.amount <= 0) continue;
            add((CATEGORY[s.categoryCode] || CATEGORY.PAY_ADMIN).pnl, s.amount);
        }
        for (const p of data.payables || []) {
            if (p.kind === 'loan' || p.voided || !scopeMatch(p.entity, scope) || !inRange(p.issueDate, start, end)) continue;
            add((CATEGORY[p.categoryCode] || CATEGORY.OTHER_EXP).pnl, p.amount);
        }
        return b;
    }
    function profitAndLoss(data, { start, end, scope = 'all', basis = 'cash' }) {
        const buckets = basis === 'accrual' ? accrualBuckets(data, start, end, scope) : cashBuckets(data, start, end, scope);
        const result = pnlFromBuckets(buckets);
        // P&L'ga kirmaydigan, lekin investor ko'rishi shart bo'lgan pul harakatlari.
        const mv = movements(data).filter(m => inRange(m.date, start, end) && scopeMatch(m.entity, scope));
        result.belowTheLine = {
            capex: -sum(mv.filter(m => m.category === 'CAPEX'), m => m.sign * m.amount),
            ownerDrawings: -sum(mv.filter(m => m.category === 'OWNER_OUT'), m => m.sign * m.amount),
            ownerContributions: sum(mv.filter(m => m.category === 'OWNER_IN'), m => m.sign * m.amount)
        };
        if (scope !== 'all') {
            const common = basis === 'accrual' ? accrualBuckets(data, start, end, 'common') : cashBuckets(data, start, end, 'common');
            result.unallocatedCommon = pnlFromBuckets(common).net_profit;
        }
        result.basis = basis; result.start = start; result.end = end; result.scope = scope;
        result.lines = PNL_LINES.map(([key, label, kind]) => ({ key, label, kind: kind || 'line', amount: result[key] || 0 }));
        return result;
    }
    function monthlyPnl(data, { start, end, scope = 'all', basis = 'cash' }) {
        return monthsBetween(start, end).map(month => {
            const s = month + '-01' < start ? start : month + '-01', e = monthEnd(month) > end ? end : monthEnd(month);
            const p = profitAndLoss(data, { start: s, end: e, scope, basis });
            return { month, start: s, end: e, net_revenue: p.net_revenue, gross_profit: p.gross_profit, opex: p.opex, ebitda: p.ebitda, net_profit: p.net_profit, revenue: p.revenue || 0, refunds: p.refunds || 0, cost_of_services: p.cost_of_services || 0 };
        });
    }

    // ---------- Debitorlik (o'quvchilar qarzi) ----------
    const AGING = [['not_due', 'Muddati kelmagan'], ['d1_30', '1–30 kun'], ['d31_60', '31–60 kun'], ['d61_90', '61–90 kun'], ['d90', '90+ kun'], ['no_date', 'To‘lov sanasi yo‘q']];
    function receivablesAging(receivables, asOf, scope = 'all') {
        const buckets = Object.fromEntries(AGING.map(([k]) => [k, { amount: 0, count: 0 }]));
        const rows = [];
        for (const r of receivables || []) {
            if (!scopeMatch(r.entity, scope) || !(Number(r.debt) > 0)) continue;
            const due = date(r.dueDate);
            const overdue = due ? dayDiff(due, asOf) : null;
            const bucket = !due ? 'no_date' : overdue <= 0 ? 'not_due' : overdue <= 30 ? 'd1_30' : overdue <= 60 ? 'd31_60' : overdue <= 90 ? 'd61_90' : 'd90';
            buckets[bucket].amount += Number(r.debt); buckets[bucket].count++;
            rows.push({ ...r, debt: Number(r.debt), dueDate: due, overdueDays: overdue != null && overdue > 0 ? overdue : 0, bucket });
        }
        rows.sort((a, b) => b.overdueDays - a.overdueDays || b.debt - a.debt);
        const total = sum(rows, r => r.debt);
        const overdue = sum(rows.filter(r => r.overdueDays > 0), r => r.debt);
        return { asOf, total, overdue, count: rows.length, buckets: AGING.map(([key, label]) => ({ key, label, ...buckets[key], share: pct(buckets[key].amount, total) })), rows };
    }

    // ---------- Kreditorlik (korxona qarzlari) ----------
    function payablesSummary(data, asOf, scope = 'all') {
        const rows = [];
        const paidOf = id => sum((data.transactions || []).filter(t => t.payableId === id && t.type !== 'loan_in' && t.date <= asOf), t => (t.reversesId ? -1 : 1) * t.amount);
        for (const p of data.payables || []) {
            if (p.voided || !scopeMatch(p.entity, scope) || p.issueDate > asOf) continue;
            const paid = paidOf(p.id), outstanding = Math.max(0, p.amount - paid);
            if (!outstanding) continue;
            const overdueDays = p.dueDate && p.dueDate < asOf ? dayDiff(p.dueDate, asOf) : 0;
            rows.push({ id: p.id, kind: p.kind, entity: p.entity, counterparty: p.counterparty, description: p.description, categoryCode: p.categoryCode,
                issueDate: p.issueDate, dueDate: p.dueDate, amount: p.amount, paid, outstanding, overdueDays });
        }
        for (const s of data.salaries || []) {
            if (s.status === 'paid' || s.amount <= 0 || !scopeMatch(s.entity, scope) || s.accrualDate > asOf) continue;
            rows.push({ id: 'salary:' + s.id, salaryId: s.id, kind: 'salary', entity: s.entity, counterparty: s.employeeName, description: `Maosh ${s.periodStart} — ${s.periodEnd}`,
                categoryCode: s.categoryCode, issueDate: s.accrualDate, dueDate: s.accrualDate, amount: s.amount, paid: 0, outstanding: s.amount, overdueDays: 0 });
        }
        rows.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '') || b.outstanding - a.outstanding);
        const byKind = k => sum(rows.filter(r => r.kind === k), r => r.outstanding);
        return { asOf, total: sum(rows, r => r.outstanding), salaries: byKind('salary'), bills: byKind('bill'), loans: byKind('loan'), other: byKind('other'),
            overdue: sum(rows.filter(r => r.overdueDays > 0), r => r.outstanding), rows };
    }

    // ---------- Boshqaruv balansi ----------
    function deferredRevenue(data, asOf, scope) {
        return sum(contractSchedule(data, scope), c => Math.max(0, c.cash(asOf) - recognized(c, asOf)));
    }
    function balanceSheet(data, asOf, scope = 'all') {
        const accounts = accountBalances(data, asOf, scope);
        const cash = sum(accounts, a => a.balance);
        const ar = receivablesAging(data.receivables, asOf, scope);
        const ap = payablesSummary(data, asOf, scope);
        const deferred = deferredRevenue(data, asOf, scope);
        const assets = cash + ar.total;
        const liabilities = ap.total + deferred;
        return { asOf, scope, cash, accounts, receivables: ar.total, receivablesOverdue: ar.overdue, assets,
            payables: { salaries: ap.salaries, bills: ap.bills, other: ap.other }, loans: ap.loans, deferredRevenue: deferred, liabilities, netAssets: assets - liabilities };
    }

    // ---------- Asosiy ko'rsatkichlar ----------
    function kpis(data, { start, end, scope = 'all' }) {
        const pnl = profitAndLoss(data, { start, end, scope, basis: 'cash' });
        const mv = movements(data).filter(m => inRange(m.date, start, end) && scopeMatch(m.entity, scope));
        // Bekor qilingan tushum sotuv ham, undirish ham hisoblanmaydi.
        const voided = new Set(movements(data).filter(m => m.isReversal && m.receiptId).map(m => m.receiptId));
        const live = mv.filter(m => m.category === 'REV_TUITION' && !m.isReversal && !voided.has(m.receiptId));
        const newSales = live.filter(m => m.newSale);
        const newCount = new Set(newSales.map(m => m.leadId || m.studentId || m.receiptId)).size;
        const collections = sum(live.filter(m => !m.newSale));
        const marketing = pnl.marketing || 0, salesPay = pnl.sales_payroll || 0;
        // Burn/runway: oxirgi 3 to'liq oyning o'rtacha sof operatsion pul oqimi.
        const endMonth = monthOf(end), months3 = [1, 2, 3].map(i => monthOf(addMonths(endMonth + '-01', -i)));
        const opFlows = months3.map(m => cashFlowStatement(data, { start: m + '-01', end: monthEnd(m), scope }).net.operating);
        const avgOperating = Math.round(sum(opFlows, x => x) / 3);
        const cash = sum(accountBalances(data, end, scope), a => a.balance);
        return {
            netRevenue: pnl.net_revenue, grossMargin: pnl.margins.gross, netMargin: pnl.margins.net, netProfit: pnl.net_profit,
            newSales: newCount, newSalesAmount: sum(newSales), averageCheck: newCount ? Math.round(sum(newSales) / newCount) : null,
            collections, receiptCount: live.length,
            cac: newCount && marketing ? Math.round(marketing / newCount) : null,
            fullCac: newCount && (marketing + salesPay) ? Math.round((marketing + salesPay) / newCount) : null,
            marketingShare: pct(marketing, pnl.net_revenue),
            averageMonthlyOperatingCashFlow: avgOperating, cash,
            runwayMonths: avgOperating < 0 ? Math.round((cash / -avgOperating) * 10) / 10 : null
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
        return {
            total: live.length,
            withoutProof: live.filter(r => !r.receiptUrl).length,
            unknownMethod: live.filter(r => r.method === 'unknown').length,
            legacyReview: live.filter(r => r.legacyReview).length,
            voided: (receipts || []).filter(r => r.voidDate).length,
            suspicious, suspiciousAmount: sum(suspicious)
        };
    }

    // ---------- Tashqi ro'yxat bilan solishtirish ----------
    const CYR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', қ: 'q', ғ: 'g', ў: 'o', ҳ: 'h' };
    function nameTokens(value) {
        const latin = String(value || '').toLowerCase().replace(/[а-яёқғўҳ]/g, ch => CYR[ch] ?? ch).replace(/[ʻ‘’'`ʼ]/g, '').replace(/h/g, 'x');
        return latin.split(/[^a-z]+/).filter(t => t.length >= 3).map(t => t.replace(/(ov|ova|ev|eva|yev|yeva|xon|jon|bek|oy)$/, '') || t);
    }
    function nameSimilar(a, b) {
        const ta = nameTokens(a), tb = nameTokens(b);
        return ta.some(x => tb.some(y => x === y || (x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x)))));
    }
    // external: [{ date, name, phone, amount, ref }]; ledger: receipts (bekor qilinmaganlari).
    function reconcile(external, ledger, { tolerance = 3, start, end } = {}) {
        const ext = external.map((r, i) => ({ ...r, idx: i, date: date(r.date), amount: money(r.amount), phone: phone9(r.phone) })).filter(r => r.date && r.amount);
        const from = start || ext.map(r => r.date).sort()[0], to = end || ext.map(r => r.date).sort().at(-1);
        const pool = (ledger || []).filter(r => !r.voidDate && inRange(r.date, from, to)).map(r => ({ ...r, phone9: phone9(r.phone) }));
        const used = new Set(), results = [];
        const near = (a, b) => Math.abs(dayDiff(a, b)) <= tolerance;
        const samePerson = (e, r) => (e.phone && r.phone9 && e.phone === r.phone9) || nameSimilar(e.name, r.name);
        const pick = pred => pool.find(r => !used.has(r.id) && pred(r));
        // 1-bosqich: aniq mos (shu odam, shu summa, sana ±tolerance). Ikkinchi bosqichlar faqat qolganlar uchun.
        const passes = [
            ['match', (e, r) => samePerson(e, r) && r.amount === e.amount && near(e.date, r.date)],
            ['date_diff', (e, r) => samePerson(e, r) && r.amount === e.amount && Math.abs(dayDiff(e.date, r.date)) <= 31],
            ['amount_diff', (e, r) => samePerson(e, r) && near(e.date, r.date)]
        ];
        const pending = new Map(ext.map(e => [e.idx, e]));
        for (const [status, pred] of passes) {
            for (const e of [...pending.values()]) {
                // Telefon mos kelgani ism mosligidan ustun turadi.
                const r = pick(r => pred(e, r) && e.phone && r.phone9 === e.phone) || pick(r => pred(e, r));
                if (!r) continue;
                used.add(r.id); pending.delete(e.idx);
                results.push({ status, external: e, ledger: r, difference: r.amount - e.amount, phoneMismatch: !!(e.phone && r.phone9 && e.phone !== r.phone9) });
            }
        }
        for (const e of pending.values()) results.push({ status: 'missing_in_crm', external: e, ledger: null, difference: -e.amount });
        for (const r of pool) if (!used.has(r.id)) results.push({ status: 'extra_in_crm', external: null, ledger: r, difference: r.amount });
        const order = { missing_in_crm: 0, amount_diff: 1, extra_in_crm: 2, date_diff: 3, match: 4 };
        results.sort((a, b) => order[a.status] - order[b.status] || ((a.external || a.ledger).date).localeCompare((b.external || b.ledger).date));
        const totalExternal = sum(ext), totalLedger = sum(pool);
        const count = s => results.filter(r => r.status === s).length;
        return { start: from, end: to, totalExternal, totalLedger, difference: totalLedger - totalExternal, results,
            counts: { match: count('match'), date_diff: count('date_diff'), amount_diff: count('amount_diff'), missing_in_crm: count('missing_in_crm'), extra_in_crm: count('extra_in_crm') } };
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
            const pm = after.match(/(?:\+?998[\s-]?)?\(?(\d{2})\)?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})(?!\d)/);
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
        ENTITIES, TYPES, CATEGORIES, CATEGORY, DEFAULT_ACCOUNTS, ACCOUNT_KINDS, DEFAULT_SETTINGS, PNL_LINES, AGING,
        money, date, today, addDays, addMonths, dayDiff, monthOf, monthEnd, monthsBetween, inRange, phone9, pct,
        accountForMethod, movements, accountBalances, cashbook, cashFlowStatement, profitAndLoss, monthlyPnl,
        contractSchedule, recognized, receivablesAging, payablesSummary, balanceSheet, deferredRevenue, kpis,
        suspiciousReasons, dataQuality, reconcile, parseStatementText, nameSimilar
    };
});
