const express = require('express');
const { handleBeelineWebhook } = require('../db');

const router = express.Router();

// 45-vazifa: Beeline IP Telefoniyasi hisobi hali ochilmagan (API hujjatlari
// hali yo'q) — bu endpoint faqat kelgan so'rovni Railway loglariga yozib,
// 200 qaytaradi (webhook provayderlari odatda 200 kelmasa qayta-qayta
// urinaveradi, shu sabab xatolik bo'lsa ham 200 qaytariladi). Hisob ochilib,
// Beeline'dan haqiqiy webhook kelganda shu loglardan uning payload shaklini
// ko'rib, server/db.js'dagi handleBeelineWebhook() funksiyasini yakunlash
// kerak.
router.post('/webhook/beeline', async (req, res) => {
    try {
        const result = await handleBeelineWebhook(req.body);
        res.json(result);
    } catch (err) {
        console.error('POST /api/telephony/webhook/beeline', err);
        res.status(200).json({ ok: false });
    }
});

module.exports = router;
