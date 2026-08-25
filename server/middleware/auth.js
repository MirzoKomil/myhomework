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

// 150-ish: o'quvchi tokeni bo'lsa haqiqiy o'quvchini aniqlaydi. TOKEN
// UMUMAN YO'Q bo'lgandagina (masalan CRM'ning "O'quvchi ilovasi" ko'rib
// chiqish iframe'i, yoki hali hech qachon login qilmagan yangi tashrif)
// jim ravishda eski "Namuna o'quvchi" (demo) xatti-harakatiga tushadi —
// bu ataylab, mavjud CRM preview tajribasi uchun saqlanadi.
//
// LEKIN token BOR bo'lib, u yaroqsiz/eskirgan/sessiyasi tugagan bo'lsa —
// bu boshqacha holat: foydalanuvchi ONGLI ravishda o'z hisobiga kirgan
// va o'z ma'lumotini kutmoqda. Bunday holatda ilgari ham jim ravishda
// demo rejimga (global "namuna o'quvchi" — bazada bugungi kunda haqiqiy,
// pul to'lagan o'quvchi bo'lishi mumkin) tushirilardi — bu esa
// MAXFIYLIK muammosi edi: bitta haqiqiy o'quvchining shaxsiy profili/
// baholari/davomat ma'lumoti tokeni eskirgan/yaroqsiz bo'lgan BOSHQA
// har qanday haqiqiy o'quvchiga ko'rsatilib qo'yilishi mumkin edi. Endi
// bunday holatda aniq 401 qaytariladi — ilova qayta kirishni so'rashi
// kerak, boshqa birovning ma'lumotini hech qachon ko'rsatmaydi.
async function studentAuthOptional(req, res, next) {
    req.studentId = null;
    const header = req.headers.authorization || '';
    // 6-vazifa: shartnoma PDF havolasi <a>/Linking.openURL orqali to'g'ridan
    // to'g'ri ochiladi — bunda maxsus Authorization sarlavhasi yuborib
    // bo'lmaydi, shuning uchun token query-parametr sifatida ham qabul
    // qilinadi (faqat sarlavha yo'q bo'lgandagina, mavjud xatti-harakatga
    // ta'sir qilmaydi).
    let token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token && typeof req.query?.token === 'string') token = req.query.token;
    if (!token) return next();

    let payload;
    try {
        payload = jwt.verify(token, JWT_SECRET);
    } catch {
        return res.status(401).json({ error: 'Sessiya tugagan, qaytadan kiring' });
    }
    if (payload.role !== 'student') return next();
    if (payload.jti) {
        const { findSessionByJti, touchSession } = require('../db');
        const session = await findSessionByJti(payload.jti);
        if (!session) return res.status(401).json({ error: 'Sessiya yakunlangan, qaytadan kiring' });
        const age = Date.now() - new Date(session.last_seen).getTime();
        if (age > 5 * 60 * 1000) await touchSession(payload.jti).catch(() => {});
    }
    // O'quvchi arxivga o'tkazilgan/o'chirilgan bo'lsa, uning eski tokeni
    // boshqa "namuna o'quvchi" ma'lumotlariga tushib ketmasligi kerak.
    const { getDemoStudentProfile } = require('../db');
    const profile = await getDemoStudentProfile(payload.id);
    if (!profile?.name) return res.status(401).json({ error: "O'quvchi akkaunti mavjud emas" });
    req.studentId = payload.id;
    next();
}

module.exports = { signToken, authRequired, studentAuthOptional, JWT_SECRET };
