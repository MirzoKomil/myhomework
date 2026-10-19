// Kitobdagi QR-kodlar: myhomework.uz/audio/L05-1 → 5-darsning 1-dialogi.
// Audio fayllar repozitoriyning audio/ papkasida (LNN_dK.mp3) turadi va
// server qayta ishga tushganda o'chmaydi. Fayl hali qo'yilmagan bo'lsa,
// o'quvchiga tushunarli sahifa ko'rsatiladi.
const fs = require('fs');
const path = require('path');

const QR_PATH = /^\/audio\/L(\d{1,2})-([1-3])\/?$/i;

function bookAudioHandler(root) {
    return (req, res, next) => {
        const m = QR_PATH.exec(req.path);
        if (!m) return next();
        const n = Number(m[1]);
        if (!n || n > 72) return next();
        const rel = `/audio/L${String(n).padStart(2, '0')}_d${m[2]}.mp3`;
        fs.access(path.join(root, rel), fs.constants.R_OK, err => {
            res.setHeader('Cache-Control', 'no-cache');
            if (!err) return res.redirect(302, rel);
            res.status(404).type('html').send(
                '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
                '<title>Audio dialog</title><body style="font-family:system-ui,sans-serif;text-align:center;padding:48px 20px;color:#1d2433">' +
                `<h2>${n}-dars, ${m[2]}-dialog</h2><p>Bu audio tez orada qo'shiladi.</p>` +
                '<p><a href="/student">Ilovani ochish</a></p></body>'
            );
        });
    };
}

module.exports = { bookAudioHandler, QR_PATH };
