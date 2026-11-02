const express = require('express');
const { getSmsHistory, addSmsHistoryEntries } = require('../db');
const { authRequired } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const eskiz = require('../services/eskiz');

const router = express.Router();

// Bir so'rovda yuborilishi mumkin bo'lgan maksimal qabul qiluvchilar soni —
// Eskiz'ga bir vaqtda haddan tashqari ko'p so'rov yubormaslik va CRM
// tomonida so'rov cho'zilib ketmasligi uchun.
const MAX_RECIPIENTS_PER_REQUEST = 500;
// Qayta yuborishda "allaqachon yuborilgan" deb hisoblanadigan oyna (skipAlreadySent).
const SMS_DEDUPE_MS = 6 * 60 * 60 * 1000;
const HISTORY_FLUSH_EVERY = 10;
// Hozir yuborilayotgan "telefon|matn" juftlari (bir jarayon ichida parallel so'rovlar uchun).
const IN_FLIGHT = new Set();

// SMS maktab hisobidan (Eskiz) pul yechadi — faqat SMS bilan ishlaydigan
// xodimlar yubora oladi. Ilgari har qanday tokenli foydalanuvchi (ustoz,
// oddiy xodim, hatto o'quvchi tokeni) ham yubora olardi.
// Targetolog SMS rassilkani ko'rmaydi va yubora olmaydi.
const SMS_ROLES = ['admin', 'rop', 'boshliq', 'sales_manager'];
const smsAccess = requireRoles(SMS_ROLES);

router.get('/balance', authRequired, smsAccess, async (req, res) => {
    try {
        res.json(await eskiz.getBalance());
    } catch (err) {
        console.error('GET /api/sms/balance', err);
        res.status(500).json({ error: err.message || 'Balansni olishda xatolik' });
    }
});

router.get('/history', authRequired, smsAccess, async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : 200;
        if (req.user.role === 'sales_manager') {
            // Sotuv menejeri faqat o'zi yuborgan SMS'larni (va ulardagi
            // telefonlarni) ko'radi.
            const me = String(req.user.email || '').toLowerCase();
            const own = (await getSmsHistory()).filter(e =>
                String(e.sentBy || '').toLowerCase() === me || String(e.sentBy || '') === String(req.user.id));
            return res.json(limit ? own.slice(0, limit) : own);
        }
        res.json(await getSmsHistory(limit));
    } catch (err) {
        console.error('GET /api/sms/history', err);
        res.status(500).json({ error: 'Tarixni yuklashda xatolik' });
    }
});

router.post('/send', authRequired, smsAccess, async (req, res) => {
    try {
        const { recipients, message, audience } = req.body || {};
        const text = String(message || '').trim();
        if (!text) return res.status(400).json({ error: 'Xabar matni bo\'sh' });
        if (!Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({ error: "Qabul qiluvchilar tanlanmagan" });
        }
        if (recipients.length > MAX_RECIPIENTS_PER_REQUEST) {
            return res.status(400).json({
                error: `Bir martada eng ko'pi bilan ${MAX_RECIPIENTS_PER_REQUEST} ta qabul qiluvchi tanlanishi mumkin`
            });
        }

        // Mijoz kutishni to'xtatsa ham (timeout) server yuborishda davom etadi. Shu sabab:
        //  - tarix har bir bo'lakdan keyin yoziladi — "Tarixni yangilash" haqiqiy holatni ko'rsatadi;
        //  - shu raqamga aynan shu matn hozir yuborilayotgan bo'lsa (parallel so'rov) — qayta yuborilmaydi;
        //  - skipAlreadySent (ommaviy yuborish) — yaqinda (SMS_DEDUPE_MS) shu raqamga shu matn
        //    muvaffaqiyatli ketgan bo'lsa o'tkazib yuboriladi (qayta yuborish ikki marta pul yechmaydi).
        const skipAlreadySent = req.body?.skipAlreadySent === true;
        const keyOf = (phone, msg) => `${String(phone).replace(/\D/g, '')}|${msg}`;
        let recentSent = new Set();
        if (skipAlreadySent) {
            const since = Date.now() - SMS_DEDUPE_MS;
            recentSent = new Set((await getSmsHistory())
                .filter(e => e.status === 'sent' && new Date(e.sentAt).getTime() >= since)
                .map(e => keyOf(e.phone || '', String(e.message || '').trim())));
        }
        const sentBy = req.user?.email || req.user?.id || null;
        const results = [];
        let pending = [];
        const flush = async () => {
            if (!pending.length) return;
            const batch = pending; pending = [];
            await addSmsHistoryEntries(batch.map(r => ({ ...r, message: r.message || text, audience: audience || null, sentBy })));
        };
        const myKeys = [];
        try {
            for (const r of recipients) {
                const phone = String(r.phone || '').trim();
                const name = String(r.name || '').trim();
                // 24-vazifa: qabul qiluvchi o'z matnini olib kelishi mumkin
                // ({sinov_guruh} kabi o'rin egallovchilar CRM tomonida har kim
                // uchun alohida almashtiriladi). Kelmasa — umumiy matn.
                const personalText = String(r.message || '').trim() || text;
                if (!phone) {
                    const e = { phone, name, status: 'error', error: 'Telefon raqami yo\'q' };
                    results.push(e); pending.push(e);
                    continue;
                }
                const key = keyOf(phone, personalText);
                if (IN_FLIGHT.has(key) || recentSent.has(key)) {
                    // Tarixga yozilmaydi — u yerda avvalgi (haqiqiy) yuborish bor.
                    results.push({ phone, name, status: 'skipped', reason: IN_FLIGHT.has(key) ? 'in-flight' : 'already-sent',
                        recipientId: r.id || null, recipientType: r.type || null, message: personalText });
                    continue;
                }
                IN_FLIGHT.add(key); myKeys.push(key); recentSent.add(key);
                let entry;
                try {
                    const resp = await eskiz.sendSms(phone, personalText);
                    entry = {
                        phone, name, status: 'sent',
                        eskizId: resp?.id || null,
                        recipientId: r.id || null, recipientType: r.type || null,
                        message: personalText,
                    };
                } catch (err) {
                    recentSent.delete(key);
                    entry = {
                        phone, name, status: 'error', error: err.message || 'Nomalum xatolik',
                        recipientId: r.id || null, recipientType: r.type || null,
                        message: personalText,
                    };
                }
                results.push(entry);
                // Tarixda har kimga aynan nima ketgani ko'rinishi kerak — umumiy
                // shablon emas, o'sha odamga yuborilgan matn.
                pending.push(entry);
                if (pending.length >= HISTORY_FLUSH_EVERY) await flush();
            }
            await flush();
        } finally {
            myKeys.forEach(k => IN_FLIGHT.delete(k));
        }

        const sentCount = results.filter(r => r.status === 'sent').length;
        const skipped = results.filter(r => r.status === 'skipped').length;
        res.json({ ok: true, sent: sentCount, failed: results.length - sentCount - skipped, skipped, results });
    } catch (err) {
        console.error('POST /api/sms/send', err);
        res.status(500).json({ error: err.message || 'SMS yuborishda xatolik' });
    }
});

module.exports = router;
