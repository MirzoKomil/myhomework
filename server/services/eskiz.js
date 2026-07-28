/**
 * Eskiz.uz SMS shlyuzi bilan integratsiya.
 *
 * Diqqat: my.eskiz.uz shaxsiy kabinet (sayt) login/paroli SMS API uchun
 * ishlamaydi — Eskiz alohida "SMS shlyuzi" login/parolini talab qiladi
 * (my.eskiz.uz dashboardida "Integratsiya"/API bo'limidan olinadi).
 */

const ESKIZ_BASE = 'https://notify.eskiz.uz/api';

let cachedToken = null;

function requireCredentials() {
    const email = process.env.ESKIZ_EMAIL;
    const password = process.env.ESKIZ_PASSWORD;
    if (!email || !password) {
        throw new Error("ESKIZ_EMAIL / ESKIZ_PASSWORD .env'da o'rnatilmagan");
    }
    return { email, password };
}

async function login() {
    const { email, password } = requireCredentials();
    const form = new URLSearchParams({ email, password });
    const res = await fetch(`${ESKIZ_BASE}/auth/login`, { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.data?.token) {
        throw new Error(data?.message || `Eskiz login xatosi (HTTP ${res.status})`);
    }
    cachedToken = data.data.token;
    return cachedToken;
}

async function getToken() {
    if (!cachedToken) await login();
    return cachedToken;
}

// O'zbekiston raqamini Eskiz kutgan formatga keltiradi: faqat raqamlar,
// 998 prefiksi bilan, "+" belgisisiz (masalan "998901234567").
function normalizePhone(raw) {
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 9) digits = '998' + digits;
    return digits;
}

function isValidUzPhone(digits) {
    return /^998\d{9}$/.test(digits);
}

async function eskizFetch(path, form) {
    let token = await getToken();
    let res = await fetch(`${ESKIZ_BASE}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
    });
    if (res.status === 401) {
        // Token eskirgan — bir marta qayta login qilib urinib ko'ramiz.
        token = await login();
        res = await fetch(`${ESKIZ_BASE}${path}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
        });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `Eskiz xatosi (HTTP ${res.status})`);
    return data;
}

async function sendSms(phone, message) {
    const digits = normalizePhone(phone);
    if (!isValidUzPhone(digits)) {
        throw new Error(`Noto'g'ri telefon raqami: ${phone}`);
    }
    const form = new URLSearchParams({
        mobile_phone: digits,
        message,
        from: process.env.ESKIZ_SENDER_NICKNAME || '4546',
    });
    return eskizFetch('/message/sms/send', form);
}

async function getBalance() {
    const token = await getToken();
    const res = await fetch(`${ESKIZ_BASE}/user/get-limit`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `Eskiz balans xatosi (HTTP ${res.status})`);
    return data;
}

module.exports = { sendSms, getBalance, normalizePhone, isValidUzPhone };
