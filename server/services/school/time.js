'use strict';
// Yagona dars jadvali uchun vaqt yordamchilari — sof funksiyalar, bazasiz.
// Hamma vaqt Asia/Tashkent bo'yicha (UTC+5, yozgi vaqt yo'q). Sana "YYYY-MM-DD",
// vaqt "HH:MM", ichkarida daqiqalar (0..1440). Hafta kuni: 1=Du ... 7=Ya.

const TZ_OFFSET_MIN = 5 * 60;
const DAY_UZ = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

const fail = (status, message) => Object.assign(new Error(message), { status });

function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')); }
function assertDate(s, label = 'Sana') { if (!isDate(s)) throw fail(400, `${label} noto'g'ri`); return s; }

function toMin(hhmm) {
    if (typeof hhmm === 'number' && Number.isInteger(hhmm)) return hhmm;
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return null;
    const h = Number(m[1]), mi = Number(m[2]);
    if (h > 24 || mi > 59 || (h === 24 && mi)) return null;
    return h * 60 + mi;
}
function fromMin(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// Toshkent bo'yicha bugungi sana va daqiqa.
function nowLocal(now = new Date()) {
    const t = new Date(now.getTime() + TZ_OFFSET_MIN * 60000);
    return { date: t.toISOString().slice(0, 10), min: t.getUTCHours() * 60 + t.getUTCMinutes() };
}
function weekday(date) {
    const d = new Date(assertDate(date) + 'T00:00:00Z').getUTCDay(); // 0=Ya
    return d === 0 ? 7 : d;
}
function addDays(date, n) {
    const d = new Date(assertDate(date) + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
function dateRange(from, to, max = 62) {
    assertDate(from, 'Boshlanish sanasi'); assertDate(to, 'Tugash sanasi');
    const n = daysBetween(from, to);
    if (n < 0) throw fail(400, 'Oraliq noto\'g\'ri');
    if (n >= max) throw fail(400, `Oraliq ${max} kundan oshmasin`);
    return Array.from({ length: n + 1 }, (_, i) => addDays(from, i));
}
function monthOf(date) { return assertDate(date).slice(0, 7); }
function monthBounds(month) {
    if (!/^\d{4}-\d{2}$/.test(month || '')) throw fail(400, 'Oy noto\'g\'ri');
    const from = month + '-01';
    const d = new Date(from + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0);
    return { from, to: d.toISOString().slice(0, 10) };
}
// Haftaning dushanbasi.
function weekStart(date) { return addDays(date, 1 - weekday(date)); }

// O'quvchining dars kunlari: eski CRM bitta kun raqamini saqlaydi va
// 1/3/5 → Du·Ch·Ju, 2/4/6 → Se·Pa·Sh deb kengaytiradi (app.js bilan bir xil).
function patternDays(day) {
    const d = Number(day);
    if ([1, 3, 5].includes(d)) return [1, 3, 5];
    if ([2, 4, 6].includes(d)) return [2, 4, 6];
    return d >= 1 && d <= 7 ? [d] : [];
}
function patternLabel(day) { return patternDays(day).map(d => DAY_UZ[d - 1]).join('·'); }
// Yordamchi aloqasi uchun tavsiya kunlari — asosiy dars kunlarining oralig'i.
function adviceDays(day) {
    const p = patternDays(day);
    if (p.join() === '1,3,5') return [2, 4, 6];
    if (p.join() === '2,4,6') return [1, 3, 5];
    return [1, 2, 3, 4, 5, 6].filter(d => !p.includes(d));
}

function overlaps(a, b) { return a.start < b.end && b.start < a.end; }
// Oraliqlardan ayirish: [{start,end}] - [{start,end}].
function subtract(free, busy) {
    let out = free.map(x => ({ ...x }));
    for (const b of busy) {
        const next = [];
        for (const f of out) {
            if (!overlaps(f, b)) { next.push(f); continue; }
            if (b.start > f.start) next.push({ ...f, end: b.start });
            if (b.end < f.end) next.push({ ...f, start: b.end });
        }
        out = next;
    }
    return out.filter(x => x.end > x.start);
}
function merge(list) {
    const s = [...list].sort((a, b) => String(a.kind || '').localeCompare(String(b.kind || '')) || a.start - b.start);
    const out = [];
    for (const x of s) {
        const last = out[out.length - 1];
        if (last && x.start <= last.end && (last.kind || '') === (x.kind || '')) last.end = Math.max(last.end, x.end);
        else out.push({ ...x });
    }
    return out;
}

module.exports = { TZ_OFFSET_MIN, DAY_UZ, fail, isDate, assertDate, toMin, fromMin, nowLocal, weekday, addDays,
    daysBetween, dateRange, monthOf, monthBounds, weekStart, patternDays, patternLabel, adviceDays, overlaps, subtract, merge };
