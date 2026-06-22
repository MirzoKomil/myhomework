const express = require('express');
const bcrypt = require('bcryptjs');
const {
    findUserByEmail,
    findUserById,
    createUser,
    updateUser,
    publicUser
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
    const user = createUser({
        name: name.trim(),
        email: email.trim(),
        passwordHash: bcrypt.hashSync(password, 10),
        role: role === 'teacher' ? 'teacher' : 'admin'
    });
    res.status(201).json({ user: publicUser(user) });
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
    const token = signToken(user);
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

module.exports = router;
