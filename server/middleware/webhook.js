const LEADS_WEBHOOK_SECRET = process.env.LEADS_WEBHOOK_SECRET || 'myhomework-leads-dev-secret';
const SECRET_FROM_ENV = Boolean(process.env.LEADS_WEBHOOK_SECRET);

if (!SECRET_FROM_ENV) {
    console.warn(
        '[webhook] OGOHLANTIRISH: LEADS_WEBHOOK_SECRET o\'rnatilmagan, koddagi zaxira kalit ishlatilyapti. ' +
        'Railway Variables\'da haqiqiy kalit qo\'ying.'
    );
}

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
        `kutilgan=${LEADS_WEBHOOK_SECRET.length} belgi`,
    ].join(' ');
}

function webhookSecretRequired(req, res, next) {
    const header = req.headers['x-webhook-secret'] || '';
    const auth = req.headers.authorization || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (header === LEADS_WEBHOOK_SECRET || bearer === LEADS_WEBHOOK_SECRET) {
        console.log(`[webhook] QABUL QILINDI  ${describeAttempt(req)}`);
        return next();
    }
    console.warn(`[webhook] RAD ETILDI  ${describeAttempt(req)}`);
    return res.status(401).json({ error: 'Webhook kaliti noto\'g\'ri' });
}

module.exports = { webhookSecretRequired, LEADS_WEBHOOK_SECRET, SECRET_FROM_ENV };
