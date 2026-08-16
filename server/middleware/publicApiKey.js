// "platformaga API chiqazib ber" vazifasi — tashqi tomondan (masalan Meta
// Ads tahlil vositasi) faqat O'QISH uchun ishlatiladigan, JWT/sessiyaga
// bog'liq bo'lmagan alohida kirish kaliti. Yangi, tashqariga ochiladigan
// sirt bo'lgani uchun, LEADS_WEBHOOK_SECRET'dan farqli, hech qanday
// zaxira (fallback) kalit yo'q — .env'da o'rnatilmasa, bu API butunlay
// yopiq qoladi (fail-closed), o'rniga eskirgan/taxmin qilinadigan kalit
// bilan ochiq qolib ketmaydi.
const PUBLIC_SALES_API_KEY = process.env.PUBLIC_SALES_API_KEY || '';

if (!PUBLIC_SALES_API_KEY) {
    console.warn(
        '[public-api] OGOHLANTIRISH: PUBLIC_SALES_API_KEY o\'rnatilmagan — ' +
        '/api/public/* endpointlari hech kimga ochilmaydi. Railway Variables\'da o\'rnating.'
    );
}

// Rad etilgan urinishlar jimgina yo'qolmasligi uchun qayd etiladi. Kalitning
// o'zi hech qachon logga tushmaydi — faqat uzunligi va manbasi.
function describeAttempt(req) {
    const header = req.headers['x-api-key'] || '';
    const auth = req.headers.authorization || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const berilgan = header || bearer;
    return [
        `yol=${req.method} ${req.originalUrl}`,
        `manba=${req.headers['referer'] || req.headers['origin'] || 'noma\'lum'}`,
        `ip=${req.headers['x-forwarded-for'] || req.ip || '?'}`,
        `kalit=${berilgan ? `bor(${berilgan.length} belgi)` : 'YO\'Q'}`,
        `usul=${header ? 'x-api-key' : bearer ? 'Bearer' : '-'}`,
    ].join(' ');
}

function publicApiKeyRequired(req, res, next) {
    if (!PUBLIC_SALES_API_KEY) {
        return res.status(503).json({ error: 'API hali sozlanmagan' });
    }
    const header = req.headers['x-api-key'] || '';
    const auth = req.headers.authorization || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (header === PUBLIC_SALES_API_KEY || bearer === PUBLIC_SALES_API_KEY) {
        console.log(`[public-api] QABUL QILINDI  ${describeAttempt(req)}`);
        return next();
    }
    console.warn(`[public-api] RAD ETILDI  ${describeAttempt(req)}`);
    return res.status(401).json({ error: 'API kaliti noto\'g\'ri yoki yo\'q' });
}

module.exports = { publicApiKeyRequired, PUBLIC_SALES_API_KEY };
