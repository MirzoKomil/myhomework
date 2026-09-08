// "platformaga API chiqazib ber" vazifasi — tashqi tomondan (masalan Meta
// Ads tahlil vositasi) faqat O'QISH uchun ishlatiladigan, JWT/sessiyaga
// bog'liq bo'lmagan alohida kirish kalitlari. Yangi, tashqariga ochiladigan
// sirt bo'lgani uchun, LEADS_WEBHOOK_SECRET'dan farqli, hech qanday
// zaxira (fallback) kalit yo'q — .env'da o'rnatilmasa, bu API butunlay
// yopiq qoladi (fail-closed), o'rniga eskirgan/taxmin qilinadigan kalit
// bilan ochiq qolib ketmaydi.
//
// IKKI XIL KALIT, ATAYIN:
//   PUBLIC_SALES_API_KEY — faqat /api/public/sales/* (sotuv voronkasi,
//       lidlar). Bu kalit tashqi reklama tahlil vositasiga berilgan.
//   PUBLIC_CRM_API_KEY   — /api/public/crm/* (CRM'ning qolgan barcha
//       bo'limlari: o'quvchilar, davomat, moliya, HR va h.k.). Alohida,
//       chunki bu ancha kengroq ma'lumot — reklama vositasidagi eski
//       kalit sizib chiqsa, u avtomatik ravishda butun CRM'ni ocha
//       olmasligi kerak.
const PUBLIC_SALES_API_KEY = process.env.PUBLIC_SALES_API_KEY || '';
const PUBLIC_CRM_API_KEY = process.env.PUBLIC_CRM_API_KEY || '';

if (!PUBLIC_SALES_API_KEY) {
    console.warn(
        '[public-api] OGOHLANTIRISH: PUBLIC_SALES_API_KEY o\'rnatilmagan — ' +
        '/api/public/sales/* endpointlari hech kimga ochilmaydi. Railway Variables\'da o\'rnating.'
    );
}
if (!PUBLIC_CRM_API_KEY) {
    console.warn(
        '[public-api] OGOHLANTIRISH: PUBLIC_CRM_API_KEY o\'rnatilmagan — ' +
        '/api/public/crm/* endpointlari hech kimga ochilmaydi. Railway Variables\'da o\'rnating.'
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

// Bitta kalit uchun tekshiruvchi yasaydi. `nom` faqat log uchun — qaysi
// sirt urinilgani loglardan ko'rinib tursin.
function makeApiKeyGuard(nom, kalit) {
    return function apiKeyRequired(req, res, next) {
        if (!kalit) {
            return res.status(503).json({ error: 'API hali sozlanmagan' });
        }
        const header = req.headers['x-api-key'] || '';
        const auth = req.headers.authorization || '';
        const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (header === kalit || bearer === kalit) {
            console.log(`[public-api:${nom}] QABUL QILINDI  ${describeAttempt(req)}`);
            return next();
        }
        console.warn(`[public-api:${nom}] RAD ETILDI  ${describeAttempt(req)}`);
        return res.status(401).json({ error: 'API kaliti noto\'g\'ri yoki yo\'q' });
    };
}

const publicApiKeyRequired = makeApiKeyGuard('sales', PUBLIC_SALES_API_KEY);
const publicCrmApiKeyRequired = makeApiKeyGuard('crm', PUBLIC_CRM_API_KEY);

module.exports = {
    publicApiKeyRequired,
    publicCrmApiKeyRequired,
    PUBLIC_SALES_API_KEY,
    PUBLIC_CRM_API_KEY,
};
