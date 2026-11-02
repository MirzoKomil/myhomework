'use strict';
// Jarimalar — sof qoidalar (bazasiz). Dizayn: "Jarimalar" J01–J09, mantiq J06 (JarLogic).
//  • Admin'dan tashqari hamma rol; har rolga o'z qoidalari, summalarni faqat admin belgilaydi.
//  • Davomat jarimalari avtomatik (kun natijasidan); ish jarimalarini rahbar yozadi.
//  • Oyning 1-kechikishi — faqat ogohlantirish; imtiyoz daqiqalari; oylik chegara (maoshning %);
//    tasdiqlangan javob so'rovi bo'lsa — jarima yo'q.
//  • Yuvish: qo'shimcha soat, yakshanba, rahbar vazifasi, 10 kun ketma-ket vaqtida (avtomatik), o'rganish;
//    keyingi oyning 4-sanasigacha (maosh 5-sanada); sababsiz kelmaslik — ko'pi bilan 50% yuviladi.
//  • Sozlama o'zgarishi keyingi oyning 1-sanasidan kuchga kiradi (orqaga qarab emas).

const ROLES = ['sales', 'rop', 'hr', 'academic', 'assistant', 'teacher', 'targetolog'];
const ROLE_LABELS = { sales: 'Sotuv menejeri', rop: 'ROP', hr: 'HR', academic: 'Akademik rahbar', assistant: 'Yordamchi ustoz', teacher: 'Asosiy ustoz', targetolog: 'Targetolog' };

// Davomat qoidalari (avtomatik). kind — hisoblash turi.
const ATT = [
    { code: 'late_1', kind: 'late', label: 'Kechikish 6–15 daqiqa', sub: '2-kechikishdan boshlab', amount: 10000, min: 1, max: 15, warnFirst: true },
    { code: 'late_2', kind: 'late', label: 'Kechikish 16–30 daqiqa', sub: '', amount: 25000, min: 16, max: 30, warnFirst: true },
    { code: 'late_3', kind: 'late', label: 'Kechikish 30 daqiqadan ortiq', sub: '', amount: 50000, min: 31, max: 100000, warnFirst: true },
    { code: 'late_streak3', kind: 'late_streak', label: '3 kun ketma-ket kechikish', sub: 'Shu kechikishlarga qoʻshimcha', amount: 50000 },
    { code: 'early_leave', kind: 'early', label: 'Ruxsatsiz erta ketish', sub: 'Tasdiqlangan soʻrovsiz', amount: 25000 },
    { code: 'no_checkout', kind: 'no_checkout', label: 'Ketish belgilanmagan', sub: '20:00 gacha', amount: 10000 },
    { code: 'absent', kind: 'absent', label: 'Sababsiz kelmaslik', sub: 'Soʻrov va sababsiz', amount: 150000, washLimit: true },
];
// Ish qoidalari (rahbar yozadi) — rolga qarab.
const WORK = {
    sales: [
        { code: 'lead_no_call', label: 'Lidni qoʻngʻiroqsiz “Sifatsiz”ga oʻtkazish', sub: 'Tekshiruvda aniqlansa', amount: 20000, evidence: 'lead' },
        { code: 'trial_forgot', label: 'Sinovga yozilgan oʻquvchini unutish', sub: 'Sinov oldidan eslatmaslik', amount: 20000, evidence: 'lead' }],
    rop: [{ code: 'lead_unassigned', label: 'Lidni 30 daqiqadan ortiq taqsimlamaslik', sub: 'Tekshiruvda aniqlansa', amount: 20000, evidence: 'text' }],
    hr: [{ code: 'candidate_late', label: 'Nomzodga 24 soatda javob bermaslik', sub: 'Bot arizasi', amount: 15000, evidence: 'text' }],
    academic: [{ code: 'problem_overdue', label: 'Muammoni muddatida hal qilmaslik', sub: 'Akademik muammolar', amount: 20000, evidence: 'text' }],
    assistant: [{ code: 'contact_missed', label: 'Kunlik aloqani belgilamaslik', sub: 'Kun oxirigacha', amount: 10000, evidence: 'text' }],
    teacher: [
        { code: 'lesson_late', label: 'Darsni kech boshlash', sub: 'Video chat boʻyicha', amount: 20000, evidence: 'text' },
        { code: 'attendance_late', label: 'Davomatni kech kiritish', sub: 'Dars tugagach 30 daqiqadan keyin', amount: 10000, evidence: 'text' }],
    targetolog: [{ code: 'report_missing', label: 'Kunlik hisobot kiritilmagan', sub: '10:00 gacha', amount: 20000, evidence: 'text' }],
};
const ATT_ROLES = new Set(['sales', 'rop', 'hr', 'academic', 'assistant']); // ofisda — yuz + joylashuv davomati

const DEFAULT_SOFT = Object.freeze({ graceMinutes: 5, capPercent: 10, cleanMonthBonus: 100000, cleanMonthOn: true, appealDays: 3,
    washHour: 25000, washSunday: 100000, washStreakCount: 1, washLearning: 15000, absentWashPercent: 50 });

function defaultConfig() {
    const roles = {};
    for (const r of ROLES) {
        roles[r] = [...(ATT_ROLES.has(r) ? ATT : []), ...(WORK[r] || [])].map(x => ({ ...x, active: true, warnFirst: !!x.warnFirst }));
    }
    return { roles, soft: { ...DEFAULT_SOFT } };
}

const int = (v, min, max, d) => (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max ? Math.round(Number(v)) : d);
// Admin kiritgan sozlamani tozalash: summalar 0..10 mln, kod lotin harf, label 120 belgi.
function normalizeConfig(raw) {
    const def = defaultConfig(), out = { roles: {}, soft: {} };
    for (const r of ROLES) {
        const list = Array.isArray(raw?.roles?.[r]) ? raw.roles[r] : def.roles[r];
        const seen = new Set();
        out.roles[r] = list.map(x => {
            const base = def.roles[r].find(d => d.code === x.code) || {};
            const code = String(x.code || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 40);
            if (!code || seen.has(code)) return null;
            seen.add(code);
            return { ...base, code, kind: base.kind || 'work', label: String(x.label || base.label || '').trim().slice(0, 120) || code,
                sub: String(x.sub ?? base.sub ?? '').slice(0, 120), amount: int(x.amount, 0, 10000000, base.amount || 0),
                active: x.active !== false, warnFirst: base.kind === 'late' ? x.warnFirst !== false : !!x.warnFirst,
                evidence: base.evidence || (base.kind ? undefined : 'text') };
        }).filter(Boolean);
    }
    const s = { ...DEFAULT_SOFT, ...(raw?.soft || {}) };
    out.soft = { graceMinutes: int(s.graceMinutes, 0, 60, DEFAULT_SOFT.graceMinutes), capPercent: int(s.capPercent, 0, 100, DEFAULT_SOFT.capPercent),
        cleanMonthBonus: int(s.cleanMonthBonus, 0, 10000000, DEFAULT_SOFT.cleanMonthBonus), cleanMonthOn: s.cleanMonthOn !== false,
        appealDays: int(s.appealDays, 1, 14, DEFAULT_SOFT.appealDays), washHour: int(s.washHour, 0, 10000000, DEFAULT_SOFT.washHour),
        washSunday: int(s.washSunday, 0, 10000000, DEFAULT_SOFT.washSunday), washStreakCount: int(s.washStreakCount, 0, 10, DEFAULT_SOFT.washStreakCount),
        washLearning: int(s.washLearning, 0, 10000000, DEFAULT_SOFT.washLearning), absentWashPercent: int(s.absentWashPercent, 0, 100, DEFAULT_SOFT.absentWashPercent) };
    return out;
}

// ── Kuchga kirish sanasi ─────────────────────────────────────────────────────
// Saqlangan sozlama keyingi oyning 1-sanasidan ishlaydi. versions: [{effective:'YYYY-MM-01', data}] — eng so'nggisi tanlanadi.
function nextMonthStart(date) {
    const [y, m] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}
function configFor(versions, date) {
    const ok = (versions || []).filter(v => v.effective <= date).sort((a, b) => (a.effective < b.effective ? 1 : a.effective > b.effective ? -1 : (b.seq || 0) - (a.seq || 0)));
    return normalizeConfig(ok[0]?.data || null);
}

// ── Davomat jarimalarini hisoblash ───────────────────────────────────────────
// days: bir oy (yoki undan uzoq) kun natijalari — staffAttendance statusFor natijasi: {date,status,lateMinutes,earlyMinutes,noCheckout,inClock}
// Javob: [{date, code, label, amount, warning, ref}] — har kun uchun barqaror "ref" (takror yozilmaydi).
function attendanceFines(days, config, role) {
    const rules = (config.roles[role] || []).filter(r => r.active);
    const by = code => rules.find(r => r.code === code);
    const grace = config.soft.graceMinutes;
    const out = [];
    const sorted = (days || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const lateSeen = {}; // oy bo'yicha birinchi kechikish
    let streak = 0;
    for (const d of sorted) {
        const month = d.date.slice(0, 7);
        // Sababli, ta'til, so'rov kutilmoqda, dam olish, hisob boshlanmagan — jarima yo'q.
        if (['excused', 'leave', 'pending', 'off', 'before', 'not_ready', 'upcoming', 'waiting', 'present'].includes(d.status)) {
            if (!['off', 'upcoming'].includes(d.status)) streak = 0;
            continue;
        }
        // Davomat imtiyozi (masalan 10 daq) jarima imtiyozidan (5 daq) farq qilishi mumkin — xom kechikish olinadi.
        const lateRaw = d.rawLateMinutes != null ? Number(d.rawLateMinutes) : Number(d.lateMinutes);
        const late = ['late', 'on_time'].includes(d.status) ? Math.max(0, lateRaw || 0) : 0;
        if (late > grace) {
            const tier = rules.filter(r => r.kind === 'late').find(r => late >= Math.max(r.min, grace + 1) && late <= r.max);
            if (tier) {
                const first = !lateSeen[month];
                lateSeen[month] = true;
                const warn = first && tier.warnFirst;
                out.push({ date: d.date, code: tier.code, label: `Kechikish ${late} daq`, amount: warn ? 0 : tier.amount, warning: warn, ref: `att:${d.date}:late`, minutes: late });
            }
            streak++;
            if (streak === 3 && by('late_streak3')) out.push({ date: d.date, code: 'late_streak3', label: '3 kun ketma-ket kechikish', amount: by('late_streak3').amount, warning: false, ref: `att:${d.date}:streak3` });
        } else if (d.status === 'on_time' || d.status === 'late') streak = 0;
        // "Vaqtida" lekin jarima imtiyozidan kech — yuqorida hisoblandi (late > grace).
        if (d.status === 'absent') {
            streak = 0;
            if (by('absent')) out.push({ date: d.date, code: 'absent', label: 'Sababsiz kelmaslik', amount: by('absent').amount, warning: false, ref: `att:${d.date}:absent` });
        }
        if (Number(d.earlyMinutes) > 0 && by('early_leave')) out.push({ date: d.date, code: 'early_leave', label: `Ruxsatsiz erta ketish · ${d.earlyMinutes} daq`, amount: by('early_leave').amount, warning: false, ref: `att:${d.date}:early` });
        if (d.noCheckout && by('no_checkout')) out.push({ date: d.date, code: 'no_checkout', label: 'Ketish belgilanmagan', amount: by('no_checkout').amount, warning: false, ref: `att:${d.date}:nocheckout` });
    }
    return out;
}

// ── Oylik hisob: chegara, yuvish, "Toza oy" ──────────────────────────────────
// fines: [{id, amount, state: 'active'|'washed'|'cancelled'|'appeal', washed (yuvilgan summa), warning}]
// salary: hisoblangan (oklad + bonus) yoki null.
function monthSummary(fines, salary, config) {
    const live = (fines || []).filter(f => !['cancelled'].includes(f.state) && !f.warning);
    const gross = live.reduce((a, f) => a + Number(f.amount || 0), 0);
    const washed = live.reduce((a, f) => a + Math.min(Number(f.amount || 0), Number(f.washed || 0)), 0);
    const net = Math.max(0, gross - washed);
    const cap = salary != null && salary > 0 ? Math.floor(salary * config.soft.capPercent / 100) : null;
    const deducted = cap == null ? net : Math.min(net, cap);
    const clean = config.soft.cleanMonthOn && !(fines || []).some(f => f.state !== 'cancelled' && !f.warning && Number(f.amount) > 0);
    const bonus = clean ? config.soft.cleanMonthBonus : 0;
    return { gross, washed, net, cap, deducted, overCap: cap != null && net > cap ? net - cap : 0, bonus,
        takeHome: salary == null ? null : Math.max(0, salary - deducted + bonus) };
}

// Bitta jarimani qancha yuvish mumkin (sababsiz kelmaslik — limit %).
function washable(fine, config) {
    const amount = Number(fine.amount || 0), done = Number(fine.washed || 0);
    const limit = fine.code === 'absent' ? Math.floor(amount * config.soft.absentWashPercent / 100) : amount;
    return Math.max(0, limit - done);
}
// Yuvish narxi (so'mda): kind 'hours' — daqiqa, 'sunday', 'learning', 'task' — rahbar belgilagan summa.
function washValue(kind, { minutes = 0, amount = 0 } = {}, config) {
    if (kind === 'hours') return Math.floor(config.soft.washHour * Math.max(0, minutes) / 60);
    if (kind === 'sunday') return config.soft.washSunday;
    if (kind === 'learning') return config.soft.washLearning;
    if (kind === 'task') return Math.max(0, Math.round(Number(amount) || 0));
    return 0;
}
// Yuvish summasini jarimalarga taqsimlash: avval eng kichik (to'liq yopiladigan), keyin qolganlari; limitlar hisobga olinadi.
function allocateWash(fines, value, config, targetId = null) {
    let left = Math.max(0, Math.round(value));
    const list = (fines || []).filter(f => f.state === 'active' && !f.warning && washable(f, config) > 0);
    const order = targetId ? list.filter(f => f.id === targetId) : list.slice().sort((a, b) => washable(a, config) - washable(b, config));
    const out = [];
    for (const f of order) {
        if (!left) break;
        const take = Math.min(left, washable(f, config));
        if (take > 0) { out.push({ id: f.id, amount: take }); left -= take; }
    }
    return { parts: out, unused: left };
}
// Yuvish muddati: jarima oyidan keyingi oyning 4-sanasi (shu kun ham) — Toshkent sanasi.
function washDeadline(fineDate) {
    const n = nextMonthStart(fineDate);
    return n.slice(0, 8) + '04';
}
function canWash(fineDate, today) { return today <= washDeadline(fineDate); }
// E'tiroz: yozilgan kundan boshlab appealDays kun (shu kun ham).
function appealUntil(createdDate, config) {
    const d = new Date(createdDate + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + config.soft.appealDays - 1);
    return d.toISOString().slice(0, 10);
}
// 10 ish kuni ketma-ket vaqtida → eng kichik jarima(lar) o'zi yuviladi. days — sana bo'yicha, ish kunlari.
function streakWashes(days, config) {
    const need = 10, out = [];
    let n = 0;
    for (const d of (days || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1))) {
        if (['off', 'upcoming', 'before', 'not_ready', 'leave', 'excused'].includes(d.status)) continue;
        if (d.status === 'on_time' || d.status === 'present') { n++; if (n === need) { out.push(d.date); n = 0; } }
        else n = 0;
    }
    return { dates: out, progress: n, need, count: config.soft.washStreakCount };
}

// Kim ko'radi: egasi, uning tasdiqlovchisi (ROP — sotuv, akademik — yordamchi/ustoz, o'z tilida), admin.
function canSee(viewer, owner) {
    if (!viewer || !owner) return false;
    if (viewer.kind === 'admin') return true;
    if (viewer.employeeId && viewer.employeeId === owner.employeeId) return true;
    return canManage(viewer, owner);
}
function canManage(viewer, owner) {
    if (!viewer || !owner) return false;
    if (viewer.kind === 'admin') return true;
    const sameLang = !viewer.langs || !owner.lang || owner.lang === 'both' || viewer.langs.includes(owner.lang);
    if (viewer.kind === 'rop') return owner.role === 'sales' && sameLang;
    if (viewer.kind === 'academic') return ['assistant', 'teacher'].includes(owner.role) && sameLang;
    return false;
}

module.exports = { ROLES, ROLE_LABELS, ATT, WORK, ATT_ROLES, DEFAULT_SOFT, defaultConfig, normalizeConfig, nextMonthStart, configFor,
    attendanceFines, monthSummary, washable, washValue, allocateWash, washDeadline, canWash, appealUntil, streakWashes, canSee, canManage };
