(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.payrollEngine = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const DAY = 86400000;
    const ROLES = { sales: 'Sotuv menejeri', rop: 'ROP', teacher: 'Asosiy ustoz', assistant: 'Yordamchi ustoz' };
    function fail(message) { throw Object.assign(new Error(message), { status: 400 }); }
    function amount(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
    function money(value) { return Math.round(amount(value)); }
    function date(value) {
        if (typeof value !== 'string') return null;
        const s = value.slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
        const t = Date.parse(s + 'T00:00:00Z');
        return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s ? s : null;
    }
    function stamp(value) { return Date.parse(value + 'T00:00:00Z'); }
    function iso(value) { return new Date(value).toISOString().slice(0, 10); }
    function period(start, end) {
        start = date(start); end = date(end);
        if (!start || !end || start > end || (stamp(end) - stamp(start)) / DAY >= 366) fail('Davr 1–366 kun orasida bo‘lishi kerak');
        return { start, end, days: (stamp(end) - stamp(start)) / DAY + 1 };
    }
    function inPeriod(value, p) { const d = date(value); return !!d && d >= p.start && d <= p.end; }
    function months(p) {
        const out = [];
        let cursor = stamp(p.start);
        while (cursor <= stamp(p.end)) {
            const d = new Date(cursor), y = d.getUTCFullYear(), m = d.getUTCMonth();
            const last = Date.UTC(y, m + 1, 0), days = new Date(last).getUTCDate();
            out.push({ key: iso(cursor).slice(0, 7), start: iso(cursor), end: iso(Math.min(last, stamp(p.end))), days });
            cursor = last + DAY;
        }
        return out;
    }
    function fixedPay(monthly, p, employee = {}) {
        const start = date(employee.startDate || employee.joinDate);
        const end = date(employee.endDate);
        return money(months(p).reduce((sum, block) => {
            const a = start && start > block.start ? start : block.start;
            const b = end && end < block.end ? end : block.end;
            return sum + (a <= b ? amount(monthly) * ((stamp(b) - stamp(a)) / DAY + 1) / block.days : 0);
        }, 0));
    }
    function role(employee) {
        const r = String(employee?.role || '').toLowerCase();
        if (['sotuv-menejeri', 'sotuv_menejeri', 'sotuv menejeri', 'sales_manager'].includes(r)) return 'sales';
        if (r === 'rop') return 'rop';
        if (['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi', 'asosiy'].includes(r)) return 'teacher';
        if (r === 'yordamchi') return 'assistant';
        return null;
    }
    function language(employee) { return employee.role === 'rus-oqituvchi' || employee.lang === 'russian' || employee.subject === 'russian' ? 'russian' : 'english'; }
    function defaults() {
        return { version: 1, sales: { commission: 5, tiers: [
            { from: 0, fixed: 0 }, { from: 20000000, fixed: 1000000 },
            { from: 40000000, fixed: 2000000 }, { from: 60000000, fixed: 3000000 }
        ] }, rop: { hasFixed: false, fixed: 0, minCompletion: 1, tiers: [
            { upTo: 30, rate: 2 }, { upTo: 40, rate: 3 }, { upTo: 50, rate: 4 },
            { upTo: 70, rate: 5 }, { upTo: 80, rate: 7 }, { upTo: null, rate: 8 }
        ] }, teacher: { rates: { 15: 75000, 30: 150000, 60: 300000 }, maxLessons: 0 }, assistant: { rate: 50000, maxLessons: 0 },
        targetMonthlySalary: 0, bonusAmounts: { obed30: 30000, obed60: 60000 } };
    }
    function validateSettings(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) fail('KPI sozlamalari noto‘g‘ri');
        const n = (v, name, max = 1000000000000) => {
            if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) fail(name + ': musbat son kiriting');
            return v;
        };
        const sales = value.sales, rop = value.rop;
        if (!sales || !rop || !value.teacher?.rates || !value.assistant) fail('Barcha lavozim shablonlari kerak');
        const tiers = (list, name) => { if (!Array.isArray(list) || !list.length || list.length > 30) fail(name + ': 1–30 pog‘ona kiriting'); return list; };
        const salesTiers = tiers(sales.tiers, 'Fiksa').map(t => ({ from: n(t.from, 'Aylanma'), fixed: n(t.fixed, 'Fiksa') }));
        if (salesTiers[0].from !== 0 || salesTiers.some((t, i) => i && t.from <= salesTiers[i - 1].from)) fail('Fiksa pog‘onalari 0 dan o‘sib borishi kerak');
        const ropTiers = tiers(rop.tiers, 'ROP').map(t => ({ upTo: t.upTo === null ? null : n(t.upTo, 'Reja chegarasi', 1000000), rate: n(t.rate, 'Ulush', 100) }));
        if (ropTiers.at(-1).upTo !== null || ropTiers.slice(0, -1).some((t, i) => t.upTo === null || (i && t.upTo <= ropTiers[i - 1].upTo))) fail('ROP chegaralari o‘sib borsin; oxirgi chegara cheksiz bo‘lsin');
        const minCompletion = n(rop.minCompletion, 'ROP eng kam reja', 1000000);
        for (const key of ['teacher', 'assistant']) if (!Number.isInteger(n(value[key].maxLessons ?? 0, 'Oylik chegara', 31))) fail('Oylik dars chegarasi butun son bo‘lsin');
        if (ropTiers[0].upTo !== null && minCompletion > ropTiers[0].upTo) fail('ROP quyi chegarasi birinchi yuqori chegaradan katta');
        if (typeof rop.hasFixed !== 'boolean') fail('Fiksa mavjudligini tanlang');
        const bonusAmounts = {};
        if (!value.bonusAmounts || Array.isArray(value.bonusAmounts) || typeof value.bonusAmounts !== 'object') fail('Bonus summalari noto‘g‘ri');
        for (const [key, v] of Object.entries(value.bonusAmounts)) {
            if (!/^[\w-]{1,80}$/.test(key)) fail('Bonus kodi noto‘g‘ri');
            bonusAmounts[key] = n(v, 'Bonus');
        }
        return { version: 1, sales: { commission: n(sales.commission, 'Sotuv foizi', 100), tiers: salesTiers },
            rop: { hasFixed: rop.hasFixed, fixed: n(rop.fixed, 'ROP fiksa'), minCompletion, tiers: ropTiers },
            teacher: { rates: Object.fromEntries([15, 30, 60].map(d => [d, n(value.teacher.rates[d], 'Ustoz tarifi')])), maxLessons: n(value.teacher.maxLessons ?? 0, 'Oylik chegara', 31) },
            assistant: { rate: n(value.assistant.rate, 'Yordamchi tarifi'), maxLessons: n(value.assistant.maxLessons ?? 0, 'Oylik chegara', 31) },
            targetMonthlySalary: n(value.targetMonthlySalary, 'Targetolog maoshi'), bonusAmounts };
    }
    function expectedDays(month, pattern = 'mwf') {
        const start = stamp(month + '-01'), y = new Date(start).getUTCFullYear(), m = new Date(start).getUTCMonth();
        const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        const weekdays = pattern === 'tts' ? [2, 4, 6] : [1, 3, 5];
        return Array.from({ length: last }, (_, i) => i + 1).filter(day => weekdays.includes(new Date(Date.UTC(y, m, day)).getUTCDay()));
    }
    function teacherPay(employee, source, p, settings, dutyRole = role(employee)) {
        const assistant = dutyRole === 'assistant';
        const teacher = source.teachers.find(t => t.id === employee.id) || employee;
        const pattern = teacher.schedulePattern || 'mwf';
        const attendance = assistant ? source.assistantAttendance : source.mainAttendance;
        const students = source.students.filter(s => (assistant ? s.assistantTeacherId : s.teacherId) === employee.id && language(s) === language(employee)
            && !(assistant && role(employee) === 'teacher' && s.teacherId === employee.id));
        let total = 0, lessons = 0;
        const breakdown = [];
        for (const s of students) for (const block of months(p)) {
            const expected = expectedDays(block.key, pattern);
            const monthDays = new Date(Date.UTC(Number(block.key.slice(0, 4)), Number(block.key.slice(5, 7)), 0)).getUTCDate();
            const calendarCount = assistant ? Math.round(monthDays * 3 / 7) : expected.length;
            const limit = assistant ? settings.assistant.maxLessons : settings.teacher.maxLessons;
            const expectedCount = limit > 0 ? Math.min(calendarCount, limit) : calendarCount;
            const tariff = assistant ? settings.assistant.rate : settings.teacher.rates[s.lessonDuration || teacher.lessonDuration || 15];
            const entries = attendance[`${block.key}_${employee.id}`]?.[s.id] || {};
            const hire = date(employee.startDate || employee.joinDate);
            const studentStart = date(s.startDate || s.joinDate);
            const days = Object.entries(entries).filter(([day, present]) => {
                const d = date(block.key + '-' + String(day).padStart(2, '0'));
                return (present === 1 || present === true) && d && inPeriod(d, p) && d >= block.start && d <= block.end
                    && (!hire || d >= hire) && (!studentStart || d >= studentStart) && (assistant || expected.includes(Number(day)));
            }).length;
            const count = Math.min(days, expectedCount), earned = money((tariff || 0) * count / expectedCount);
            total += earned; lessons += count;
            breakdown.push({ studentId: s.id, name: s.name, month: block.key, lessons: count, expected: expectedCount, tariff: tariff || 0, earned });
        }
        return { total, lessons, studentCount: students.length, breakdown };
    }
    function salesFacts(source, lang, p, settings) {
        const leads = source.leads[lang] || [], byManager = {}, warnings = [];
        const refundEvents = (source.cashFlow || []).filter(t => t.type === 'chiqim' && /refund|pul qaytarish/i.test(t.purpose || ''));
        const add = (id, value) => { if (id) byManager[id] = (byManager[id] || 0) + value; };
        let turnover = 0;
        if (Array.isArray(source.paymentRecords)) {
            for (const r of source.paymentRecords) {
                if (r.language !== lang || !inPeriod(r.paidDate, p)) continue;
                add(r.managerId, amount(r.amount)); turnover += amount(r.amount);
                if (!r.managerId) warnings.push('To‘lov menejerga bog‘lanmagan: ' + r.id);
            }
        }
        for (const l of Array.isArray(source.paymentRecords) ? [] : leads) {
            const closed = l.paymentClosedSurvey || {};
            if (l.deletedAt || l.status !== 'tolov-yopildi' || l.cancelled) continue;
            if (!inPeriod(closed.closedDate || l.closedDate, p)) continue;
            // Nullish selection: an explicit actualAmount=0 must never fall back to a contractual amount.
            const gross = amount(closed.actualAmount ?? closed.totalAmount);
            const linkedRefunds = refundEvents.filter(t => (t.leadId || t.leadRef?.id) === l.id);
            const net = linkedRefunds.length ? gross : (l.refunded || l.paymentStatus === 'refunded' ? 0 : Math.max(0, gross - amount(l.refundAmount)));
            add(l.managerId, net); turnover += net;
        }
        for (const t of refundEvents) {
            if (!inPeriod(t.date, p)) continue;
            const linked = leads.find(l => l.id === (t.leadId || t.leadRef?.id));
            if (!Array.isArray(source.paymentRecords) && linked?.cancelled && inPeriod(linked.paymentClosedSurvey?.closedDate || linked.closedDate, p)) continue;
            const linkedManager = source.hrEmployees.find(e => e.id === t.managerId);
            const transactionLang = t.lang || t.language || (linked && lang) || (linkedManager && language(linkedManager));
            if (!transactionLang) { warnings.push('Qaytarilgan pul tili/menejeri aniqlanmagan: ' + t.id); continue; }
            if (transactionLang !== lang) continue;
            turnover -= amount(t.amount);
            const manager = t.managerId || linked?.managerId;
            if (manager) add(manager, -amount(t.amount));
            else warnings.push('Qaytarilgan pul menejerga bog‘lanmagan: ' + t.id);
        }
        const bonusByManager = {};
        for (const b of source.bonusHistory || []) {
            if (!inPeriod(b.date, p) || b.cancelled) continue;
            const value = b.amount ?? source.bonusData?.[b.bonusId]?.amount ?? settings.bonusAmounts[b.bonusId];
            if (value == null) { warnings.push('Bonus summasi belgilanmagan: ' + b.bonusId); continue; }
            bonusByManager[b.managerId] = (bonusByManager[b.managerId] || 0) + amount(value);
        }
        return { turnover: money(turnover), byManager, bonusByManager, warnings };
    }
    function salesPlan(source, lang, p) {
        const raw = source.salesPlan || {};
        const plan = raw[lang] || (typeof raw.managers === 'number' ? raw : {});
        if (!Number.isFinite(Number(plan.managers)) || !Number.isFinite(Number(plan.leadsPerDay)) || !Number.isFinite(Number(plan.avgCheck)) || !Number.isFinite(Number(plan.conversions?.mid))) return null;
        return money(Math.round(amount(plan.managers) * amount(plan.leadsPerDay) * p.days * amount(plan.conversions.mid) / 100) * amount(plan.avgCheck));
    }
    function withAdjustments(row, items = []) {
        const positive = items.filter(a => a.amount > 0);
        let available = Math.max(0, row.total + positive.reduce((sum, a) => sum + a.amount, 0));
        const adjustments = positive.map(a => ({ ...a }));
        for (const item of items.filter(a => a.amount < 0)) {
            const deducted = Math.min(available, -item.amount);
            if (deducted) adjustments.push({ ...item, amount: -deducted });
            available -= deducted;
        }
        const adjustmentTotal = adjustments.reduce((sum, a) => sum + a.amount, 0);
        return { ...row, baseTotal: row.total, adjustmentTotal, adjustments,
            total: Math.max(0, row.total + adjustmentTotal), unpaidDebt: Math.max(0, -row.total - adjustmentTotal) };
    }
    function calculate(source, settings, p, lang, confirmation = null, paidSnapshots = [], adjustmentsByEmployee = {}) {
        settings = validateSettings(settings); p = period(p.start, p.end);
        const facts = salesFacts(source, lang, p, settings);
        const employees = source.hrEmployees.filter(e => role(e) && language(e) === lang
            && (!date(e.startDate || e.joinDate) || date(e.startDate || e.joinDate) <= p.end));
        for (const e of employees) if (!date(e.startDate || e.joinDate)) facts.warnings.push(e.name + ': ish boshlagan sana yo‘q; fiksa to‘liq hisoblandi');
        for (const e of employees) if (e.status && e.status !== 'active') facts.warnings.push(e.name + ': nofaol xodim; davomat va bitimlar bo‘yicha hisobni tekshiring');
        const rows = [];
        for (const e of employees.filter(e => role(e) !== 'rop')) {
            const r = role(e);
            if (e.kpiTemplateId && e.kpiTemplateId !== r) { facts.warnings.push(e.name + ': KPI shabloni lavozimga mos emas'); continue; }
            let fixed = 0, commission = 0, bonus = 0, turnover = 0, academic = {};
            if (r === 'sales') {
                turnover = money(facts.byManager[e.id] || 0);
                const tier = settings.sales.tiers.filter(t => t.from <= Math.max(0, turnover)).at(-1);
                fixed = fixedPay(tier.fixed, p, e);
                commission = money(turnover * settings.sales.commission / 100);
                bonus = money(facts.bonusByManager[e.id] || 0);
            } else {
                academic = teacherPay(e, source, p, settings);
                if (r === 'teacher' && (e.dualRole === true || source.academicPolicy === 'dual-role-v1')) {
                    const main = academic, assistant = teacherPay(e, source, p, settings, 'assistant');
                    const studentIds = new Set([...main.breakdown, ...assistant.breakdown].map(b => b.studentId));
                    academic = { total: main.total + assistant.total, lessons: main.lessons + assistant.lessons,
                        studentCount: studentIds.size, mainTotal: main.total, assistantTotal: assistant.total,
                        mainLessons: main.lessons, assistantLessons: assistant.lessons,
                        breakdown: [...main.breakdown.map(b => ({ ...b, dutyRole: 'main' })),
                            ...assistant.breakdown.map(b => ({ ...b, dutyRole: 'assistant' }))] };
                }
            }
            if (e._correctionOnly) { fixed = 0; commission = 0; bonus = 0; turnover = 0; academic = {}; }
            const row = { employeeId: e.id, name: e.name, avatar: e.avatar || '', role: r, roleLabel: ROLES[r],
                fixed, turnover, commission, bonus, ...academic, total: fixed + commission + bonus + (academic.total || 0) };
            rows.push(withAdjustments(row, adjustmentsByEmployee[e.id]));
        }
        for (const snapshot of paidSnapshots) {
            const index = rows.findIndex(r => r.employeeId === snapshot.employeeId);
            if (index >= 0) rows[index] = { ...snapshot };
            else rows.push({ ...snapshot });
        }
        const managerSalaries = rows.filter(r => r.role === 'sales').reduce((sum, r) => sum + r.total, 0);
        const targetSalary = fixedPay(settings.targetMonthlySalary, p);
        const cleanTurnover = Math.max(0, facts.turnover - managerSalaries - targetSalary);
        const currentPlan = salesPlan(source, lang, p);
        const confirmed = !!confirmation && confirmation.amount === currentPlan;
        const completion = confirmed && currentPlan > 0 ? facts.turnover / currentPlan * 100 : 0;
        const rate = completion >= settings.rop.minCompletion ? settings.rop.tiers.find(t => t.upTo === null || completion <= t.upTo)?.rate || 0 : 0;
        for (const e of employees.filter(e => role(e) === 'rop')) {
            if (paidSnapshots.some(r => r.employeeId === e.id)) continue;
            const fixed = !e._correctionOnly && settings.rop.hasFixed ? fixedPay(settings.rop.fixed, p, e) : 0;
            const commission = !e._correctionOnly && confirmed ? money(cleanTurnover * rate / 100) : 0;
            const row = { employeeId: e.id, name: e.name, avatar: e.avatar || '', role: 'rop', roleLabel: ROLES.rop,
                fixed, turnover: facts.turnover, cleanTurnover, managerSalaries, targetSalary, completion, rate,
                commission, bonus: 0, total: fixed + commission, blocked: !e._correctionOnly && !confirmed };
            rows.push(withAdjustments(row, adjustmentsByEmployee[e.id]));
        }
        return { period: p, language: lang, rows, warnings: [...new Set(facts.warnings)],
            plan: { current: currentPlan, confirmed, confirmation }, turnover: facts.turnover, cleanTurnover,
            total: rows.reduce((sum, r) => sum + r.total, 0) };
    }
    return { ROLES, defaults, validateSettings, date, period, inPeriod, months, fixedPay, role, language,
        expectedDays, teacherPay, salesFacts, salesPlan, withAdjustments, calculate };
}));
