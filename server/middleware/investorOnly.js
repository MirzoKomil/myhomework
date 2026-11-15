'use strict';
// Investor roli (15-noyabr, Moliya › Investor): faqat o'z kabineti. Butun /api bo'yicha bitta qoida — investor
// faqat ruxsat etilgan yo'llarga o'tadi (har bir route alohida tekshirishiga tayanilmaydi). Rol bazadan olinadi
// (tokendagi eski rolga ishonilmaydi), 3 soniyalik kesh bilan.
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./auth');

const ALLOWED = [
    /^\/api\/investor(\/|$)/,
    /^\/api\/auth\/(me|logout|change-password|sessions|login-history|avatar)(\/|$)/
];
// Rol o'zgarsa (masalan investor yangi rol oldi) — ko'pi bilan 3 soniyada kuchga kiradi.
const CACHE_MS = 3000;

// Yo'lni bir xil ko'rinishga keltiradi: %xx ochiladi (ikki marta kodlangan ham), // birlashtiriladi, ./.. hal qilinadi.
// Ochib bo'lmasa null — investor uchun bunday yo'l ruxsat etilmagan hisoblanadi.
function normalizePath(req) {
    let p = (req.baseUrl || '') + (req.path || '/');
    try { for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(p); i++) p = decodeURIComponent(p); } catch { return null; }
    p = p.replace(/\\/g, '/').replace(/\/+/g, '/');
    p = require('path').posix.normalize(p);
    return p.length > 1 ? p.replace(/\/$/, '') : p;
}

// Kesh modul darajasida: rol o'zgarganda (updateUser, investor akkaunti) invalidateUser(id) darhol tozalaydi.
const cache = new Map();
function invalidateUser(id) { if (id == null) cache.clear(); else cache.delete(id); }

function investorOnly({ findUserById, now = Date.now }) {
    const roleOf = async id => {
        const hit = cache.get(id);
        if (hit && now() - hit.at < CACHE_MS) return hit.role;
        const role = (await findUserById(id))?.role || null;
        cache.set(id, { role, at: now() });
        if (cache.size > 5000) cache.clear();
        return role;
    };
    return async (req, res, next) => {
        const header = req.headers.authorization || '';
        if (!header.startsWith('Bearer ')) return next(); // tokensiz — route o'zi hal qiladi (authRequired 401)
        let payload;
        // Yaroqsiz/eskirgan token: sarlavha olib tashlanadi — keyingi hech bir route (authRequired'siz ham) uni o'qiy olmaydi,
        // so'rov tokensiz so'rov kabi ishlaydi (himoyalangan route 401, ochiq route — anonim).
        try { payload = jwt.verify(header.slice(7), JWT_SECRET); } catch { delete req.headers.authorization; return next(); }
        const path = normalizePath(req);
        if (path && ALLOWED.some(re => re.test(path))) return next();
        if (payload?.role === 'investor') return res.status(403).json({ error: 'Investor kabineti faqat Investor bo‘limini ko‘radi' });
        if (!payload?.id) return next();
        // O'quvchi tokeni (studentId) ham tekshiriladi: id xodim jadvalida investor bo'lsa — bloklanadi.
        let role;
        try { role = await roleOf(payload.id); }
        catch { return res.status(503).json({ error: 'Ruxsatni tekshirib boʻlmadi, birozdan keyin qayta urinib koʻring' }); }
        if (role === 'investor' || payload.role === 'investor') return res.status(403).json({ error: 'Investor kabineti faqat Investor bo‘limini ko‘radi' });
        return next();
    };
}

module.exports = { investorOnly, invalidateUser, ALLOWED, normalizePath, CACHE_MS };
