const express = require('express');
const { insertLead } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// 48-vazifa: alohida Telegram bot (@homeworkleadgen_bot) ma'lum bir
// guruhni tinglaydi — u guruhga Meta Ads Manager'ga ulangan boshqa bot
// har bir yangi lid uchun qat'iy shablon asosida xabar tashlaydi. Bu
// yerda o'sha xabar matni tahlil qilinib, lid to'g'ridan-to'g'ri Sotuv
// bo'limining "Rus tili" -> "Yangi lidlar" ustuniga qo'shiladi.

function requireConfig() {
    const token = process.env.TELEGRAM_LEAD_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_LEAD_BOT_TOKEN sozlanmagan');
    return {
        token,
        webhookSecret: process.env.TELEGRAM_LEAD_WEBHOOK_SECRET || '',
        groupChatId: process.env.TELEGRAM_LEAD_GROUP_CHAT_ID || '',
    };
}

// Telefon raqamini +998XXXXXXXXX ko'rinishiga keltiradi. Ba'zi maydonlar
// mamlakat kodisiz (9 xonali, masalan "99 913 06 04"), ba'zilari
// to'liq (+998942697174) keladi — ikkalasi ham to'g'ri qabul qilinadi.
function normalizeLeadPhone(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return '';
    if (hasPlus) return `+${digits}`;
    if (digits.length === 9) return `+998${digits}`;
    if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
    return digits.length >= 9 ? `+${digits}` : digits;
}

// Namuna xabar:
// #telegram
//
// 🧾 Nomi: RUS - FORMA LEAD 29/07 (Abdulloh Abdulaxadov)
// 📝 Ma'lumotlar:
//     1. Ismingiz:: Manzura
//     2. Telefon raqamingiz:: 99 913 06 04
//     3. Phone number: +998942697174
// ℹ️ Manba: Instagram
// 📆 Sana: 10-08-2026 12:06:15
//
// ✅ Telegram uchun tayyor
//
// Format qat'iy pozitsiyaga (masalan "har doim 3-qator telefon") emas,
// LABEL'larga qarab o'qiladi — shu sabab maydonlar tartibi yoki soni
// o'zgarsa ham (masalan familiya maydoni qo'shilsa) ishlashda davom etadi.
function parseTelegramLeadMessage(text) {
    if (!text || typeof text !== 'string') return null;
    const lines = text.split(/\r?\n/);
    let formName = '';
    let sourceLabel = '';
    let name = '';
    let primaryPhone = '';
    let secondaryPhone = '';

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        let m;
        if ((m = /^🧾\s*Nomi:\s*(.+)$/u.exec(line))) { formName = m[1].trim(); continue; }
        if ((m = /^ℹ️\s*Manba:\s*(.+)$/u.exec(line))) { sourceLabel = m[1].trim(); continue; }
        if ((m = /^\d+\.\s*(.+?):+\s*(.*)$/.exec(line))) {
            const label = m[1].trim().toLowerCase();
            const value = m[2].trim();
            if (!value) continue;
            if (!name && label.includes('ism')) { name = value; continue; }
            if (label.includes('phone')) {
                if (!primaryPhone) primaryPhone = normalizeLeadPhone(value);
                continue;
            }
            if (label.includes('telefon')) {
                if (!secondaryPhone) secondaryPhone = normalizeLeadPhone(value);
                continue;
            }
        }
    }

    // "Phone number" maydoni (Meta avtomatik aniqlagan, E.164 formatidagi)
    // asosiy hisoblanadi, chunki bu qo'lda kiritilgandan ko'ra ishonchliroq.
    // Agar u topilmasa, foydalanuvchi qo'lda kiritgan "Telefon raqamingiz"
    // asosiy bo'ladi.
    if (!primaryPhone && secondaryPhone) {
        primaryPhone = secondaryPhone;
        secondaryPhone = '';
    }

    if (!name && !primaryPhone) return null;

    return {
        name: name || 'Telegram lid',
        phone: primaryPhone,
        phone2: secondaryPhone,
        formName,
        sourceLabel,
    };
}

// Sozlanish holati — maxfiy qiymatlar hech qachon qaytarilmaydi.
router.get('/lead-webhook/status', authRequired, async (req, res) => {
    if (!['admin', 'rop', 'boshliq'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Faqat admin yoki ROP korishi mumkin' });
    }
    const bor = v => Boolean(v);
    res.json({
        webhookUrl: 'https://myhomework.uz/api/telegram/lead-webhook',
        env: {
            TELEGRAM_LEAD_BOT_TOKEN: bor(process.env.TELEGRAM_LEAD_BOT_TOKEN),
            TELEGRAM_LEAD_WEBHOOK_SECRET: bor(process.env.TELEGRAM_LEAD_WEBHOOK_SECRET),
            TELEGRAM_LEAD_GROUP_CHAT_ID: bor(process.env.TELEGRAM_LEAD_GROUP_CHAT_ID),
        },
    });
});

router.post('/lead-webhook', async (req, res) => {
    // Telegram javobni tezda kutadi (aks holda qayta yuboraveradi) — shu
    // sabab har doim tezda 200 qaytariladi, xatolar faqat logga tushadi.
    try {
        const config = requireConfig();
        if (config.webhookSecret) {
            const got = req.headers['x-telegram-bot-api-secret-token'];
            if (got !== config.webhookSecret) {
                console.warn('[telegram-lead] RAD: secret_token mos kelmadi');
                return res.sendStatus(401);
            }
        }

        const message = req.body?.message || req.body?.channel_post;
        if (!message) return res.sendStatus(200);

        const chatId = String(message.chat?.id || '');
        const chatTitle = message.chat?.title || '';
        console.log(`[telegram-lead] Xabar keldi: chat.id=${chatId} chat.title="${chatTitle}"`);

        if (config.groupChatId && chatId !== String(config.groupChatId)) {
            console.log(`[telegram-lead] Otkazib yuborildi: notanish chat (kutilgan=${config.groupChatId})`);
            return res.sendStatus(200);
        }

        const text = message.text || message.caption || '';
        const parsed = parseTelegramLeadMessage(text);
        if (!parsed) {
            console.log('[telegram-lead] Otkazib yuborildi: lid formatiga mos kelmadi');
            return res.sendStatus(200);
        }

        const noteParts = [];
        if (parsed.sourceLabel) noteParts.push(`Manba: ${parsed.sourceLabel}`);
        if (parsed.formName) noteParts.push(`Forma: ${parsed.formName}`);

        const result = await insertLead({
            name: parsed.name,
            phone: parsed.phone,
            phone2: parsed.phone2,
            language: 'russian',
            source: 'Target',
            leadType: 'target',
            status: 'yangi-lidlar',
            externalId: `tg_${chatId}_${message.message_id}`,
            note: noteParts.join(' | '),
        });

        console.log(result.duplicate
            ? `[telegram-lead] DUBLIKAT  message_id=${message.message_id} id=${result.id}`
            : `[telegram-lead] LID YARATILDI  message_id=${message.message_id} id=${result.id} ism="${parsed.name}"`);

        return res.sendStatus(200);
    } catch (err) {
        console.error('[telegram-lead] XATO:', err.message);
        // Telegram 5xx javobda ham qayta urinib ko'radi (~1 kun davomida) —
        // shu sabab xatoda ham 200 qaytariladi, aks holda vaqtinchalik
        // xatolik (masalan baza uzilishi) o'nlab qayta urinishga va
        // dublikat urinishlarga olib kelishi mumkin edi. Kamchilik faqat
        // Railway loglarida ko'rinadi.
        return res.sendStatus(200);
    }
});

module.exports = router;
