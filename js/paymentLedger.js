(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.PaymentLedger = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const METHODS = { card: 'Karta', uzum: 'Uzum Nasiya', paylater: 'Paylater', bank: 'Bank hisobi', payme: 'Payme', click: 'Click', cash: 'Naqd', unknown: 'Aniqlanmagan' };
    const TARIFFS = { 15: 'Start (15 daq)', 30: 'Standart (30 daq)', 60: 'VIP (60 daq)' };
    function money(value) {
        if (value === '' || value == null) return null;
        const n = typeof value === 'number' ? value : Number(String(value).replace(/[\s,]/g, ''));
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
    function method(value) {
        if (Object.hasOwn(METHODS, value)) return value;
        const v = String(value || '').toLowerCase();
        return /uzum/.test(v) ? 'uzum' : /paylater/.test(v) ? 'paylater' : /payme/.test(v) ? 'payme' : /click/.test(v) ? 'click' : /karta|card/.test(v) ? 'card' : /naqd|cash/.test(v) ? 'cash' : /bank|hisob/.test(v) ? 'bank' : 'unknown';
    }
    function receipt(value) { return /^\/uploads\/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|pdf)$/i.test(String(value || '')) ? value : ''; }
    function leadEvents(lead) {
        const ps = lead.paymentSurvey || {}, pc = lead.paymentClosedSurvey || {}, events = [], issues = [];
        const add = (kind, value, when, meta) => {
            const amount = money(value), paidDate = date(when);
            if (amount === 0) return;
            if (amount == null || !paidDate) { issues.push({ kind, reason: 'Aniq summa yoki sana yo‘q' }); return; }
            events.push({ kind, amount, paidDate, method: method(meta.paymentMethod), receiptUrl: receipt(meta.receiptUrl), total: money(ps.totalAmount), tariff: Number(ps.tariff) || null });
        };
        if (ps.paymentType === 'partial') add('deposit', ps.paidAmount, ps.lastPaymentDate, ps);
        // A contractual price, stage change or a lender application is not proof of a receipt.
        if (lead.status === 'tolov-yopildi' || pc.closedDate) {
            if (ps.paymentType !== 'installment' || pc.installmentReceived === 'yes') {
                const cumulative = money(pc.actualAmount);
                const deposit = money(ps.paymentType === 'partial' ? ps.paidAmount : 0);
                if (cumulative == null || deposit == null || cumulative < deposit) issues.push({ kind: 'closing', reason: 'Jami qabul qilingan summa aniq emas yoki zakladdan kam' });
                else add('closing', cumulative - deposit, pc.installmentReceivedDate || pc.closedDate, pc);
            }
        }
        return { events, issues };
    }
    function filter(rows, f) {
        return rows.filter(r => (!f.start || r.paidDate >= f.start) && (!f.end || r.paidDate <= f.end)
            && (!f.manager || (f.manager === '__unassigned' ? !r.managerId : r.managerId === f.manager)) && (!f.teacher || r.teacherId === f.teacher)
            && (!f.tariff || String(r.tariff) === String(f.tariff)) && (!f.method || r.method === f.method)
            && (!f.form || r.form === f.form) && (!f.review || (f.review === 'missing-manager' ? !r.managerId : r.legacyReview))
            && searchMatches(r.name,r.phone,f.search));
    }
    function searchMatches(name,phone,search) {
        const q=String(search || '').trim().toLocaleLowerCase(), digits=q.replace(/\D/g,'');
        return !q || String(name || '').toLocaleLowerCase().includes(q)
            || (!/[\p{L}]/u.test(q) && !!digits && String(phone || '').replace(/\D/g,'').includes(digits));
    }
    function rangeError(f) {
        return (f.start && !date(f.start) || f.end && !date(f.end) || f.start && f.end && f.start > f.end)
            ? 'Boshlanish sanasi tugash sanasidan keyin bo‘lmasligi kerak. Sana oralig‘ini tekshiring.' : '';
    }
    function displayDate(value) { const d = date(value); return d ? d.slice(8) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '—'; }
    function excelMoneyFormat(value) {
        const groups=Math.floor((String(Math.abs(Number(value) || 0)).length-1)/3);
        return (groups ? '#' + '" "000'.repeat(groups) : '0') + '" UZS"';
    }
    function nextDate(debt, current, historical) { return money(debt) === 0 ? '' : date(current == null ? historical : current); }
    function filterIssues(issues, language, f = {}) {
        // Undated sources remain visible, but are explicitly NOT dated receipts.
        return issues.filter(r => r.language === language && (!r.date || ((!f.start || r.date >= f.start) && (!f.end || r.date <= f.end)))
            && searchMatches(r.name,r.phone,f.search));
    }
    function summary(rows) {
        const debts = new Map();
        for (const r of rows) debts.set(r.studentId || r.leadId || r.id, r.debt || 0);
        return { amount: rows.reduce((n, r) => n + Number(r.amount), 0), debt: [...debts.values()].reduce((a, b) => a + Number(b), 0), count: rows.length };
    }
    function cashFlow(rows) {
        return rows.map(r => ({ id: 'inflow:' + r.id, paymentRecordId: r.id, ledgerGenerated: true, type: 'kirim', category: 'sotuv', purpose: "Kurs to'lovi", amount: r.amount,
            date: r.paidDate, time: r.paidTime || '', paymentMethod: { cash: 'Naqd pul', bank: 'Bank hisob raqami', payme: 'Bank hisob raqami', click: 'Bank hisob raqami' }[r.method] || METHODS[r.method],
            lang: r.language, managerId: r.managerId, leadId: r.leadId, description: r.name, notes: r.name + (r.legacyReview ? ' · Eski ma’lumot — tekshirish kerak' : ''), receiptUrl: r.receiptUrl }));
    }
    function stable(value) {
        if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
        if (value && typeof value === 'object') return '{' + Object.keys(value).sort().filter(k => value[k] !== undefined)
            .map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
        return JSON.stringify(value);
    }
    function cashCandidates(cash, records) {
        if (cash.type !== 'kirim' || cash.ledgerGenerated) return [];
        if (!cash.paymentRecordId && !cash.leadId && !cash.studentId && !/kurs.*to.lov/i.test(cash.purpose || '')
            && !['sotuv','ichki-sotuv'].includes(cash.category)) return [];
        const account = value => ['bank','payme','click'].includes(method(value)) ? 'bank' : method(value);
        return records.filter(r => money(cash.amount) === r.amount && date(cash.date) === r.paidDate
            && (!cash.lang || cash.lang === r.language)
            && (!cash.leadId || cash.leadId === r.leadId)
            && (!cash.studentId || cash.studentId === r.studentId)
            && (account(cash.paymentMethod) === 'unknown' || r.method === 'unknown' || account(cash.paymentMethod) === account(r.method)));
    }
    function projectCash(manual, records, decisions = []) {
        const rows = [], pending = [], excludedIds = [], byId = new Map(records.map(r => [r.id, r]));
        for (const cash of manual) {
            if (cash.ledgerGenerated) continue;
            const decision = decisions.find(d => d.cashId === cash.id && d.snapshot === stable(cash));
            if (decision?.decision === 'linked' && byId.has(decision.recordId)) { excludedIds.push(cash.id); continue; }
            const candidates = cashCandidates(cash, records);
            if (decision?.decision !== 'independent' && candidates.length) {
                pending.push({ cash, candidates }); excludedIds.push(cash.id); continue;
            }
            rows.push(cash);
        }
        return { rows: [...rows, ...cashFlow(records)], pending, excludedIds };
    }
    return { METHODS, TARIFFS, money, date, today, method, receipt, leadEvents, filter, rangeError, displayDate, excelMoneyFormat, nextDate, filterIssues, summary, cashFlow,
        stable, cashCandidates, projectCash };
});
