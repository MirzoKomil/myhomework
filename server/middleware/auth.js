const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'myhomework-dev-secret-change-in-production';

function signToken(user) {
    const jti = randomUUID();
    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, jti },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
    return { token, jti };
}

async function authRequired(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });

    try {
        req.user = jwt.verify(token, JWT_SECRET);
    } catch {
        return res.status(401).json({ error: 'Token yaroqsiz yoki muddati tugagan' });
    }

    if (req.user.jti) {
        try {
            const { findSessionByJti, touchSession } = require('../db');
            const session = await findSessionByJti(req.user.jti);
            if (!session) return res.status(401).json({ error: 'Sessiya yakunlangan, qayta kiring' });
            const age = Date.now() - new Date(session.last_seen).getTime();
            if (age > 5 * 60 * 1000) await touchSession(req.user.jti);
        } catch (err) {
            console.error('[auth] Session check xatoligi:', err.message);
        }
    }

    next();
}

module.exports = { signToken, authRequired, JWT_SECRET };
