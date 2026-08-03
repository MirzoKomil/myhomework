const express = require('express');
const { getSmsHistory, addSmsHistoryEntries } = require('../db');
const { authRequired } = require('../middleware/auth');
const eskiz = require('../services/eskiz');

const router = express.Router();

// Bir so'rovda yuborilishi mumkin bo'lgan maksimal qabul qiluvchilar soni —
// Eskiz'ga bir vaqtda haddan tashqari ko'p so'rov yubormaslik va CRM
// tomonida so'rov cho'zilib ketmasligi uchun.
const MAX_RECIPIENTS_PER_REQUEST = 500;

router.get('/balance', authRequired, async (req, res) => {
    try {
        res.json(await eskiz.getBalance());
    } catch (err) {
        console.error('GET /api/sms/balance', err);
        res.status(500).json({ error: err.message || 'Balansni olishda xatolik' });
    }
});

router.get('/history', authRequired, async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : 200;
        res.json(await getSmsHistory(limit));
    } catch (err) {
        console.error('GET /api/sms/history', err);
        res.status(500).json({ error: 'Tarixni yuklashda xatolik' });
    }
});

router.post('/send', authRequired, async (req, res) => {
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

        const results = [];
        for (const r of recipients) {
            const phone = String(r.phone || '').trim();
            const name = String(r.name || '').trim();
            // 24-vazifa: qabul qiluvchi o'z matnini olib kelishi mumkin
            // ({sinov_guruh} kabi o'rin egallovchilar CRM tomonida har kim
            // uchun alohida almashtiriladi). Kelmasa — umumiy matn.
            const personalText = String(r.message || '').trim() || text;
            if (!phone) {
                results.push({ phone, name, status: 'error', error: 'Telefon raqami yo\'q' });
                continue;
            }
            try {
                const resp = await eskiz.sendSms(phone, personalText);
                results.push({
                    phone, name, status: 'sent',
                    eskizId: resp?.id || null,
                    recipientId: r.id || null, recipientType: r.type || null,
                    message: personalText,
                });
            } catch (err) {
                results.push({
                    phone, name, status: 'error', error: err.message || 'Nomalum xatolik',
                    recipientId: r.id || null, recipientType: r.type || null,
                    message: personalText,
                });
            }
        }

        // Tarixda har kimga aynan nima ketgani ko'rinishi kerak — umumiy
        // shablon emas, o'sha odamga yuborilgan matn.
        await addSmsHistoryEntries(results.map(r => ({
            ...r,
            message: r.message || text,
            audience: audience || null,
            sentBy: req.user?.email || req.user?.id || null,
        })));

        const sentCount = results.filter(r => r.status === 'sent').length;
        res.json({ ok: true, sent: sentCount, failed: results.length - sentCount, results });
    } catch (err) {
        console.error('POST /api/sms/send', err);
        res.status(500).json({ error: err.message || 'SMS yuborishda xatolik' });
    }
});

module.exports = router;
