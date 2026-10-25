'use strict';
// Targetolog — "faqat kuzatuvchi" rol. Ilgari har bir route alohida rol
// tekshirardi va ba'zilari (bildirishnoma qoidalari, push yuborish, kontent
// izohlari, qo'ng'iroq yozuvlari, shartnoma raqami...) faqat "login qilgan"mi
// deb qarardi — targetolog ham ularni o'zgartira olardi. Endi butun /api
// bo'yicha bitta qoida: targetolog o'zgartiradigan (GET/HEAD/OPTIONS bo'lmagan)
// so'rov faqat ruxsat etilgan ro'yxatdagi yo'llarga o'tadi.
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./auth');

const READ_ONLY_ROLES = new Set(['targetolog']);
const ALLOWED = [
    { method: 'PUT', re: /^\/api\/target-ads\/?$/ },              // o'z kunlik target ma'lumoti (servis til/sana ruxsatini tekshiradi)
    { method: 'POST', re: /^\/api\/auth\/(logout|change-password|avatar)\/?$/ },
    { method: 'PATCH', re: /^\/api\/auth\/me\/?$/ },
    { method: 'DELETE', re: /^\/api\/auth\/sessions\/.+$/ }
];

function readOnlyRoles({ findUserById }) {
    return async (req, res, next) => {
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
        const header = req.headers.authorization || '';
        if (!header.startsWith('Bearer ')) return next(); // tokensiz (webhook, login) — route o'zi hal qiladi
        let payload;
        try { payload = jwt.verify(header.slice(7), JWT_SECRET); } catch { return next(); } // yaroqsiz token — authRequired 401 qaytaradi
        if (!payload?.id || payload.studentId) return next();
        let role;
        try { role = (await findUserById(payload.id))?.role || payload.role; }
        catch { return res.status(503).json({ error: 'Ruxsatni tekshirib boʻlmadi, birozdan keyin qayta urinib koʻring' }); } // tokendagi eski rolga ishonilmaydi
        if (!READ_ONLY_ROLES.has(role)) return next();
        const path = (req.baseUrl || '') + (req.path || '');
        const full = req.originalUrl.split('?')[0];
        if (ALLOWED.some(a => a.method === req.method && (a.re.test(full) || a.re.test(path)))) return next();
        return res.status(403).json({ error: 'Targetolog kabineti faqat ko‘rish uchun — bu amalga ruxsat yo‘q' });
    };
}

module.exports = { readOnlyRoles, READ_ONLY_ROLES, ALLOWED };
