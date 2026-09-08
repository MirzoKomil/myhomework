// Landing sahifalardan (domwork/homework va h.k.) keladigan lid webhooki
// uchun kalit tekshiruvi.
//
// ── NEGA BIR NECHTA KALIT ────────────────────────────────────────────────────
// Kalitni almashtirish bu yerda oddiy emas: uni bilgan tomon faqat server
// emas, balki BOSHQA saytlardagi JavaScript ham (integrations/domwork-fix.js,
// integrations/homeworkuz-fix.js — u yerda qiymat qattiq yozilgan). Agar
// Railway'da kalit bir zumda almashtirilsa, saytlar hali eski kalitni
// yuborayotgan bo'ladi va lidlar 401 bilan rad etila boshlaydi — jimgina,
// hech kim darrov sezmaydi. 2026-08-01 da 200+ lid yo'qolgan voqeadan keyin
// bunday tavakkalga yo'l qo'yilmaydi.
//
// Shuning uchun LEADS_WEBHOOK_SECRET VERGUL bilan ajratilgan bir nechta
// qiymat qabul qiladi. Almashtirish tartibi (bironta lid yo'qolmaydi):
//
//   1. Railway:  LEADS_WEBHOOK_SECRET = <YANGI>,<ESKI>
//      → ikkala kalit ham ishlaydi, hech narsa buzilmaydi.
//   2. Saytlardagi skriptlarda qiymatni <YANGI> ga o'zgartiring, shoshilmay.
//   3. Loglarda faqat "mos=1-kalit" ko'rina boshlagach (ya'ni endi hech kim
//      eskisini ishlatmayapti), Railway'da qiymatni <YANGI> ga qisqartiring.
//
// Ro'yxatdagi BIRINCHI kalit — asosiysi (yangi). Qolganlari — o'chirilishi
// kutilayotgan eskilari.
const RAW = process.env.LEADS_WEBHOOK_SECRET || '';

const SECRETS = RAW.split(',').map(s => s.trim()).filter(Boolean);
const SECRET_FROM_ENV = SECRETS.length > 0;

// Muhit o'zgaruvchisi umuman qo'yilmagan bo'lsa — eski xatti-harakat
// saqlanadi (koddagi zaxira kalit), aks holda hozir ishlab turgan
// saytlardan lid kelishi shu zahoti to'xtardi.
if (!SECRET_FROM_ENV) {
    SECRETS.push('myhomework-leads-dev-secret');
    console.warn(
        '[webhook] OGOHLANTIRISH: LEADS_WEBHOOK_SECRET o\'rnatilmagan, koddagi zaxira kalit ishlatilyapti. ' +
        'Railway Variables\'da haqiqiy kalit qo\'ying.'
    );
} else if (SECRETS.length > 1) {
    console.log(
        `[webhook] ${SECRETS.length} ta kalit faol (almashtirish rejimi). ` +
        'Saytlar yangisiga o\'tgach, eskilarini LEADS_WEBHOOK_SECRET dan olib tashlang.'
    );
}

// Birinchi (asosiy) kalit — eski eksportning ma'nosini saqlab qolish uchun.
const LEADS_WEBHOOK_SECRET = SECRETS[0];

// Rad etilgan urinishlar jimgina yo'qolmasligi uchun qayd etiladi.
// Kalitning o'zi hech qachon logga tushmaydi — faqat uzunligi va manbasi.
function describeAttempt(req) {
    const header = req.headers['x-webhook-secret'] || '';
    const auth = req.headers.authorization || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const berilgan = header || bearer;
    return [
        `manba=${req.headers['referer'] || req.headers['origin'] || 'noma\'lum'}`,
        `ip=${req.headers['x-forwarded-for'] || req.ip || '?'}`,
        `kalit=${berilgan ? `bor(${berilgan.length} belgi)` : 'YO\'Q'}`,
        `usul=${header ? 'x-webhook-secret' : bearer ? 'Bearer' : '-'}`,
        `kutilgan=${SECRETS.map(s => s.length).join('/')} belgi`,
    ].join(' ');
}

function webhookSecretRequired(req, res, next) {
    const header = req.headers['x-webhook-secret'] || '';
    const auth = req.headers.authorization || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const berilgan = header || bearer;

    const index = berilgan ? SECRETS.indexOf(berilgan) : -1;
    if (index !== -1) {
        // Qaysi kalit ishlatilgani ko'rsatiladi (kalitning o'zi emas, tartib
        // raqami) — shu orqali "eski kalitni hali kim ishlatyapti?" degan
        // savolga javob topiladi va uni qachon o'chirish mumkinligi bilinadi.
        const label = SECRETS.length > 1 ? `  mos=${index + 1}-kalit` : '';
        console.log(`[webhook] QABUL QILINDI  ${describeAttempt(req)}${label}`);
        return next();
    }
    console.warn(`[webhook] RAD ETILDI  ${describeAttempt(req)}`);
    return res.status(401).json({ error: 'Webhook kaliti noto\'g\'ri' });
}

module.exports = { webhookSecretRequired, LEADS_WEBHOOK_SECRET, SECRETS, SECRET_FROM_ENV };
