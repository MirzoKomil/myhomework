const express = require('express');
const bcrypt = require('bcryptjs');
const {
    findUserByEmail,
    createUser,
    publicUser
} = require('../db');
const { signToken, authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body || {};
        if (!name?.trim() || !email?.trim() || !password) {
            return res.status(400).json({ error: 'Barcha maydonlar to\'ldirilishi shart' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' });
        }
        if (await findUserByEmail(email.trim())) {
            return res.status(409).json({ error: 'Bu login allaqachon ro\'yxatdan olingan' });
        }
        const user = await createUser({
            name: name.trim(),
            email: email.trim(),
            passwordHash: bcrypt.hashSync(password, 10),
            role: role === 'teacher' ? 'teacher' : 'admin'
        });
        res.status(201).json({ user: publicUser(user) });
    } catch (err) {
        console.error('POST /api/auth/register', err);
        res.status(500).json({ error: 'Server xatoligi' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email?.trim() || !password) {
            return res.status(400).json({ error: 'Login va parol kiriting' });
        }
        const user = await findUserByEmail(email.trim());
        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
        }
        const token = signToken(user);
        res.json({ token, user: publicUser(user) });
    } catch (err) {
        console.error('POST /api/auth/login', err);
        res.status(500).json({ error: 'Server xatoligi' });
    }
});

router.get('/me', authRequired, async (req, res) => {
    try {
        const { findUserById } = require('../db');
        const user = await findUserById(req.user.id);
        if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
        res.json({ user: publicUser(user) });
    } catch (err) {
        console.error('GET /api/auth/me', err);
        res.status(500).json({ error: 'Server xatoligi' });
    }
});

module.exports = router;
