const express = require('express');
const bcrypt = require('bcryptjs');
const {
    findUserByEmail,
    findUserById,
    createUser,
    updateUser,
    publicUser,
    createSession,
    getSessionsByUserId,
    getSessionById,
    deleteSession,
    deleteSessionByJti,
    deleteOtherSessions
} = require('../db');
const { signToken, authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
    const { name, email, password, role } = req.body || {};
    if (!name?.trim() || !email?.trim() || !password) {
        return res.status(400).json({ error: 'Barcha maydonlar to\'ldirilishi shart' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' });
    }
    if (findUserByEmail(email.trim())) {
        return res.status(409).json({ error: 'Bu login allaqachon ro\'yxatdan olingan' });
    }
    const validRoles = ['admin', 'teacher', 'sales_manager', 'employee'];
    const userRole = validRoles.includes(role) ? role : 'employee';
    const user = createUser({
        name: name.trim(),
        email: email.trim(),
        passwordHash: bcrypt.hashSync(password, 10),
        role: userRole
    });
    res.status(201).json({ user: publicUser(user) });
});

// Admin tomonidan HR xodimlar uchun user yaratish/yangilash
router.post('/create-user', authRequired, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Faqat admin foydalanuvchi yarata oladi' });
    }
    const { name, login, password, role } = req.body || {};
    if (!name?.trim() || !login?.trim() || !password) {
        return res.status(400).json({ error: 'Ism, login va parol talab qilinadi' });
    }
    if (String(password).length < 4) {
        return res.status(400).json({ error: 'Parol kamida 4 ta belgidan iborat bo\'lishi kerak' });
    }
    const validRoles = ['admin', 'teacher', 'sales_manager', 'employee'];
    const userRole = validRoles.includes(role) ? role : 'employee';
    const existing = findUserByEmail(login.trim());
    if (existing) {
        if (existing.email === 'admin' && existing.role === 'admin') {
            return res.status(403).json({ error: 'Asosiy admin akkauntini bu yo\'l bilan o\'zgartirib bo\'lmaydi' });
        }
        updateUser(existing.id, {
            name: name.trim(),
            passwordHash: bcrypt.hashSync(String(password), 10),
            role: userRole
        });
        return res.json({ ok: true, user: publicUser(findUserById(existing.id)) });
    }
    const user = createUser({
        name: name.trim(),
        email: login.trim(),
        passwordHash: bcrypt.hashSync(String(password), 10),
        role: userRole
    });
    res.status(201).json({ ok: true, user: publicUser(user) });
});

router.post('/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email?.trim() || !password) {
        return res.status(400).json({ error: 'Login va parol kiriting' });
    }
    const user = findUserByEmail(email.trim());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
    }
    const { token, jti } = signToken(user);
    const userAgent = req.headers['user-agent'] || '';
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '';
    createSession({ userId: user.id, jti, userAgent, ip });
    res.json({ token, user: publicUser(user) });
});

router.get('/me', authRequired, (req, res) => {
    const user = findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    res.json({ user: publicUser(user) });
});

router.patch('/me', authRequired, (req, res) => {
    const { name, email, phone, bio, location, avatar } = req.body || {};
    const user = findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    const fields = {};
    if (name !== undefined) {
        if (!String(name).trim()) return res.status(400).json({ error: 'Ism bo\'sh bo\'lmasligi kerak' });
        fields.name = String(name).trim();
    }
    if (email !== undefined) {
        const trimmed = String(email).trim();
        if (!trimmed) return res.status(400).json({ error: 'Email bo\'sh bo\'lmasligi kerak' });
        const existing = findUserByEmail(trimmed);
        if (existing && existing.id !== user.id) {
            return res.status(409).json({ error: 'Bu email allaqachon band' });
        }
        fields.email = trimmed;
    }
    if (phone !== undefined) fields.phone = String(phone).trim();
    if (bio !== undefined) fields.bio = String(bio).trim();
    if (location !== undefined) fields.location = String(location).trim();
    if (avatar !== undefined) fields.avatar = String(avatar);

    const updated = updateUser(user.id, fields);
    res.json({ user: publicUser(updated) });
});

router.post('/change-password', authRequired, (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Joriy va yangi parol kiriting' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak' });
    }
    const user = findUserById(req.user.id);
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
        return res.status(401).json({ error: 'Joriy parol noto\'g\'ri' });
    }
    updateUser(user.id, { passwordHash: bcrypt.hashSync(newPassword, 10) });
    res.json({ ok: true });
});

// ── Sessiyalar ───────────────────────────────────────────────────────────────

router.get('/sessions', authRequired, (req, res) => {
    const rows = getSessionsByUserId(req.user.id);
    const sessions = rows.map(s => ({
        id: s.id,
        userAgent: s.user_agent,
        ip: s.ip,
        createdAt: s.created_at,
        lastSeen: s.last_seen,
        isCurrent: s.jti === req.user.jti
    }));
    res.json({ sessions });
});

router.delete('/sessions/others', authRequired, (req, res) => {
    if (!req.user.jti) return res.status(400).json({ error: 'Joriy token eski formatda' });
    deleteOtherSessions(req.user.id, req.user.jti);
    res.json({ ok: true });
});

router.delete('/sessions/:id', authRequired, (req, res) => {
    const session = getSessionById(req.params.id);
    if (!session || session.user_id !== req.user.id) {
        return res.status(404).json({ error: 'Sessiya topilmadi' });
    }
    if (session.jti === req.user.jti) {
        return res.status(400).json({ error: 'Joriy sessiyani bu yo\'l bilan o\'chirib bo\'lmaydi. Chiqish tugmasini ishlating.' });
    }
    deleteSession(req.params.id);
    res.json({ ok: true });
});

router.post('/logout', authRequired, (req, res) => {
    if (req.user.jti) deleteSessionByJti(req.user.jti);
    res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────

module.exports = router;
