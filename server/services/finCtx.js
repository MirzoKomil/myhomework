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
// Tranzaksiya imzosi: ilova tranzaksiyasi tugashidan oldin shu tranzaksiyada yaratilgan barcha muhr va audit
// yozuvlari xeshlarini (Postgres tranzaksiya raqami bilan) kalit bilan imzolaydi. Imzosiz yoki imzosi mos kelmagan
// tranzaksiya — ilovadan tashqari yozuv (belgi nusxalangan bo'lsa ham, triggerlar o'chirilgan bo'lsa ham).
const txMac = (xid, seals, audits) => createHmac('sha256', KEY).update('fin-tx|' + xid + '|' + seals.join(',') + '|' + audits.join(',')).digest('hex');
let ready = false;
async function hashesOf(db, xid) {
    const r = (await db.query(`SELECT (SELECT COALESCE(array_agg(row_hash ORDER BY seq), '{}') FROM fin_row_seals WHERE xid=$1) AS s,
        (SELECT COALESCE(array_agg(hash ORDER BY id), '{}') FROM fin_audit WHERE xid=$1) AS a`, [xid])).rows[0];
    return { seals: r.s, audits: r.a };
}
// Faqat ilova kodi chaqiradi (COMMIT dan oldin). Kechiktirilgan triggerlar (o'quvchi o'chirilishi) avval ishga tushiriladi.
async function signTx(db) {
    if (!ready) ready = !!(await db.query("SELECT to_regclass('fin_tx_signatures') AS t")).rows[0].t;
    if (!ready) return;
    await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    const xid = (await db.query('SELECT pg_current_xact_id_if_assigned()::text AS x')).rows[0].x;
    if (xid) await signXid(db, xid);
}
async function signXid(db, xid) {
    const { seals, audits } = await hashesOf(db, xid);
    if (!seals.length && !audits.length) return;
    await db.query('INSERT INTO fin_tx_signatures(xid,seals,audits,mac) VALUES($1,$2,$3,$4)', [xid, seals.length, audits.length, txMac(xid, seals, audits)]);
}
// Kalit sozlanmagan (ochiq dev kaliti) bo'lsa imzo himoya bermaydi — moliya bo'limida ogohlantiriladi.
const keyConfigured = () => KEY !== DEV_KEY;
module.exports = { token, valid, keyConfigured, signTx, signXid, txMac };
