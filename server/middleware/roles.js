// Rolga qarab kirishni cheklash. Rol tokendagi qiymatdan emas, bazadagi
// joriy akkauntdan olinadi — xodimning roli o'zgartirilsa yoki u o'chirilsa,
// eski tokeni bilan ruxsat saqlanib qolmasin.
const { findUserById } = require('../db');

function requireRoles(...roles) {
    const allowed = new Set(roles.flat());
    return async (req, res, next) => {
        try {
            const current = req.user?.id ? await findUserById(req.user.id) : null;
            if (!current) return res.status(401).json({ error: 'Akkaunt topilmadi' });
            req.user = { ...req.user, role: current.role, name: current.name, email: current.email };
            if (!allowed.has(current.role)) return res.status(403).json({ error: 'Bu amalga ruxsat yoʻq' });
            next();
        } catch (err) {
            console.error('[roles] Rolni tekshirib boʻlmadi:', err.message);
            res.status(503).json({ error: 'Akkaunt ruxsatini tekshirib boʻlmadi' });
        }
    };
}

module.exports = { requireRoles };
