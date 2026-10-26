'use strict';
// Toshkent vaqti (UTC+5, yozgi vaqt yo'q) bilan ishlash uchun sof funksiyalar.
const OFFSET_MS = 5 * 60 * 60 * 1000;

const pad = n => String(n).padStart(2, '0');

function tashkentDate(at = new Date()) {
    return new Date(new Date(at).getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

// Kun boshidan o'tgan daqiqalar (Toshkent vaqti).
function tashkentMinutes(at = new Date()) {
    const d = new Date(new Date(at).getTime() + OFFSET_MS);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function tashkentClock(at) {
    const m = tashkentMinutes(at);
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

// 1 = dushanba ... 7 = yakshanba
function weekday(date) {
    return new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
}

function parseClock(value) {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || '').trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function clock(minutes) {
    if (minutes == null || !Number.isFinite(minutes)) return '';
    const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

// Toshkent sanasi + daqiqa → haqiqiy Date (UTC).
function atTashkent(date, minutes) {
    return new Date(Date.parse(`${date}T00:00:00Z`) + minutes * 60000 - OFFSET_MS);
}

function isDate(value) {
    return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(value || ''))
        && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isMonth(value) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || '')); }

function monthDates(month) {
    const [y, m] = month.split('-').map(Number);
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`);
}

module.exports = { tashkentDate, tashkentMinutes, tashkentClock, weekday, parseClock, clock, atTashkent,
    isDate, isMonth, monthDates, OFFSET_MS };
