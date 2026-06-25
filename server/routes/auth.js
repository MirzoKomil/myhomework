const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const {
    findUserByEmail, findUserById, createUser, updateUser, publicUser,
    createSession, getSessionsByUserId, getSessionById,
    deleteSession, deleteSessionByJti, deleteOtherSessions, DATA_DIR
} = require('../db');
const { signToken, authRequired } = require('../middleware/auth');

const router = express.Router();

// Ochiq ro'yxatdan o'tish o'chirilgan — faqat /create-user orqali (admin tomonidan)
router.post('/register', (req, res) => {
    res.status(403).json({ error: 'Ro\'yxatdan o\'tish yopilgan. Admin bilan bog\'laning.' });
});

router.post('/create-user', authRequired, async (req, res) => {
    try {
        if (req.user.role !== 'admin')
            return res.status(403).json({ error: 'Faqat admin foydalanuvchi yarata oladi' });
        const { name, login, password, role } = req.body || {};
        if (!name?.trim() || !login?.trim() || !password)
            return res.status(400).json({ error: 'Ism, login va parol talab qilinadi' });
        if (String(password).length < 4)
            return res.status(400).json({ error: 'Parol kamida 4 ta belgidan iborat bo\'lishi kerak' });
        const validRoles = ['admin', 'teacher', 'sales_manager', 'employee'];
        const userRole = validRoles.includes(role) ? role : 'employee';
        const existing = await findUserByEmail(login.trim());
        if (existing) {
            if (existing.email === 'admin' && existing.role === 'admin')
                return res.status(403).json({ error: 'Asosiy admin akkauntini bu yo\'l bilan o\'zgartirib bo\'lmaydi' });
            await updateUser(existing.id, { name: name.trim(), passwordHash: bcrypt.hashSync(String(password), 10), role: userRole });
            return res.json({ ok: true, user: publicUser(await findUserById(existing.id)) });
        }
        const user = await createUser({ name: name.trim(), email: login.trim(), passwordHash: bcrypt.hashSync(String(password), 10), role: userRole });
        res.status(201).json({ ok: true, user: publicUser(user) });
    } catch (err) {
        console.error('POST /create-user', err);
        res.status(500).json({ error: 'Server xatoligi' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email?.trim() || !password)
            return res.status(400).json({ error: 'Login va parol kiriting' });
        const user = await findUserByEmail(email.trim());
        if (!user || !bcrypt.compareSync(password, user.password_hash))
            return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
        const { token, jti } = signToken(user);
        const userAgent = req.headers['user-agent'] || '';
        const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '';
        await createSession({ userId: user.id, jti, userAgent, ip });
        res.json({ token, user: publicUser(user) });
    } catch (err) {
        console.error('POST /login', err);
        res.status(500).json({ error: 'Server xatoligi' });
    }
});

router.get('/me', authRequired, async (req, res) => {
    try {
        const user = await findUserById(req.user.id);
        if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
        res.json({ user: publicUser(user) });
    } catch (err) { res.status(500).json({ error: 'Server xatoligi' }); }
});

router.patch('/me', authRequired, async (req, res) => {
    try {
        const { name, email, phone, bio, location, avatar } = req.body || {};
        const user = await findUserById(req.user.id);
        if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
        const fields = {};
        if (name !== undefined) {
            if (!String(name).trim()) return res.status(400).json({ error: 'Ism bo\'sh bo\'lmasligi kerak' });
            fields.name = String(name).trim();
        }
        if (email !== undefined) {
            const trimmed = String(email).trim();
            if (!trimmed) return res.status(400).json({ error: 'Email bo\'sh bo\'lmasligi kerak' });
            const existing = await findUserByEmail(trimmed);
            if (existing && existing.id !== user.id)
                return res.status(409).json({ error: 'Bu email allaqachon band' });
            fields.email = trimmed;
        }
        if (phone !== undefined) fields.phone = String(phone).trim();
        if (bio !== undefined) fields.bio = String(bio).trim();
        if (location !== undefined) fields.location = String(location).trim();
        if (avatar !== undefined) fields.avatar = String(avatar);
        const updated = await updateUser(user.id, fields);
        res.json({ user: publicUser(updated) });
    } catch (err) {
        console.error('PATCH /me', err);
        res.status(500).json({ error: 'Server xatoligi' });
    }
});

router.post('/change-password', authRequired, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        if (!currentPassword || !newPassword)
            return res.status(400).json({ error: 'Joriy va yangi parol kiriting' });
        if (newPassword.length < 6)
            return res.status(400).json({ error: 'Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak' });
        const user = await findUserById(req.user.id);
        if (!user || !bcrypt.compareSync(currentPassword, user.password_hash))
            return res.status(401).json({ error: 'Joriy parol noto\'g\'ri' });
        await updateUser(user.id, { passwordHash: bcrypt.hashSync(newPassword, 10) });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Server xatoligi' }); }
});

// ── Sessiyalar ────────────────────────────────────────────────────────────────

router.get('/sessions', authRequired, async (req, res) => {
    try {
        const rows = await getSessionsByUserId(req.user.id);
        const sessions = rows.map(s => ({
            id: s.id, userAgent: s.user_agent, ip: s.ip,
            createdAt: s.created_at, lastSeen: s.last_seen,
            isCurrent: s.jti === req.user.jti
        }));
        res.json({ sessions });
    } catch (err) { res.status(500).json({ error: 'Server xatoligi' }); }
});

router.delete('/sessions/others', authRequired, async (req, res) => {
    try {
        if (!req.user.jti) return res.status(400).json({ error: 'Joriy token eski formatda' });
        await deleteOtherSessions(req.user.id, req.user.jti);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Server xatoligi' }); }
});

router.delete('/sessions/:id', authRequired, async (req, res) => {
    try {
        const session = await getSessionById(req.params.id);
        if (!session || session.user_id !== req.user.id)
            return res.status(404).json({ error: 'Sessiya topilmadi' });
        if (session.jti === req.user.jti)
            return res.status(400).json({ error: 'Joriy sessiyani bu yo\'l bilan o\'chirib bo\'lmaydi.' });
        await deleteSession(req.params.id);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Server xatoligi' }); }
});

router.post('/logout', authRequired, async (req, res) => {
    try {
        if (req.user.jti) await deleteSessionByJti(req.user.jti);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Server xatoligi' }); }
});

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_DIR = path.join(DATA_DIR, 'avatars');

router.post('/avatar', authRequired, async (req, res) => {
    try {
        const { dataUrl } = req.body || {};
        if (!dataUrl || !dataUrl.startsWith('data:image/'))
            return res.status(400).json({ error: 'Yaroqsiz rasm formati' });
        // Uzunlik tekshiruvi: ~2MB base64 → ~1.5MB rasm
        if (dataUrl.length > 2 * 1024 * 1024)
            return res.status(413).json({ error: 'Rasm hajmi katta. Kichikroq rasm tanlang.' });
        // Railway da fayl tizimi yo'qoladi — data URL ni DB ga saqlaymiz
        await updateUser(req.user.id, { avatar: dataUrl });
        const updated = await findUserById(req.user.id);
        res.json({ url: dataUrl, user: publicUser(updated) });
    } catch (err) {
        console.error('POST /avatar', err);
        res.status(500).json({ error: 'Server xatoligi' });
    }
});

router.get('/avatar/:userId', (req, res) => {
    // Faqat UUID formatiga ruxsat (path traversal himoyasi)
    const safeId = req.params.userId.replace(/[^a-zA-Z0-9\-]/g, '');
    if (!safeId || safeId.length > 64) return res.status(400).send('Invalid');

    // Avval DB dan avatarni olamiz (Railway da fayl tizimi yo'qoladi)
    try {
        const user = await findUserById(safeId);
        if (user?.avatar?.startsWith('data:image/')) {
            const matches = user.avatar.match(/^data:image\/(\w+);base64,(.+)$/);
            if (matches) {
                const mimeType = `image/${matches[1]}`;
                const buffer = Buffer.from(matches[2], 'base64');
                res.setHeader('Content-Type', mimeType);
                res.setHeader('Cache-Control', 'public, max-age=3600');
                return res.send(buffer);
            }
        }
    } catch { /* file fallback ga o'tamiz */ }

    // Fallback: eski fayl tizimidan (lokal dev uchun)
    const filePath = path.join(AVATAR_DIR, `${safeId}.jpg`);
    if (!filePath.startsWith(AVATAR_DIR)) return res.status(403).send('Ruxsat yo\'q');
    if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(filePath);
});

module.exports = router;
