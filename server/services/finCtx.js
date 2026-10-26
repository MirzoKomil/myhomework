// Moliyaviy yozuvni qaysi ilova tranzaksiyasi qilganini isbotlovchi belgi (fin.ctx).
// Belgi bazada saqlanadigan sirsiz HMAC bilan imzolanadi: kalit faqat server muhitida (FIN_SEAL_KEY),
// shuning uchun bazaga to'g'ridan-to'g'ri SQL bilan kirgan odam "ilova nomidan" yozuv soxtalashtira olmaydi —
// u qo'ygan belgi imzosiz bo'ladi va yaxlitlik tekshiruvi buni ushlaydi.
const { createHmac, randomUUID, timingSafeEqual } = require('crypto');
const DEV_KEY = 'myhomework-dev-secret-change-in-production';
const KEY = process.env.FIN_SEAL_KEY || process.env.JWT_SECRET || DEV_KEY;
const mac = s => createHmac('sha256', KEY).update('fin-ctx|' + s).digest('hex').slice(0, 32);
function token(prefix) {
    const id = randomUUID();
    return `${prefix}:${id}.${mac(prefix + ':' + id)}`;
}
const RE = /^([a-z]+):([0-9a-f-]{36})\.([0-9a-f]{32})$/;
function valid(ctx) {
    const m = RE.exec(String(ctx || ''));
    if (!m) return false;
    const a = Buffer.from(mac(m[1] + ':' + m[2])), b = Buffer.from(m[3]);
    return a.length === b.length && timingSafeEqual(a, b);
}
// Kalit sozlanmagan (ochiq dev kaliti) bo'lsa imzo himoya bermaydi — moliya bo'limida ogohlantiriladi.
const keyConfigured = () => KEY !== DEV_KEY;
module.exports = { token, valid, keyConfigured };
