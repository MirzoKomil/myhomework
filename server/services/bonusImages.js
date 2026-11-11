// 11-noyabr (tezlik): bonusData ichidagi base64 rasmlar (har biri ~0,2–0,9 MB) har bir /api/state javobida
// (admin, ROP, sotuv) qayta yuborilardi. GET'da ular URL bilan almashtiriladi; PATCH'da URL qaytib kelsa —
// bazadagi asl rasm joyiga qo'yiladi (rasm yo'qolmaydi, o'zgarmagan bo'lsa audit ham yozilmaydi).
const crypto = require('crypto');
const PREFIX = '/api/state/bonus-image/';
const hash = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
const isData = v => typeof v === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(v);

function toUrls(bonusData) {
    if (!bonusData || typeof bonusData !== 'object' || Array.isArray(bonusData)) return bonusData;
    const out = {};
    for (const [id, b] of Object.entries(bonusData)) {
        out[id] = b && typeof b === 'object' && isData(b.image) && !/^data:image\/svg/i.test(b.image) ? { ...b, image: PREFIX + encodeURIComponent(id) + '?h=' + hash(b.image) } : b;
    }
    return out;
}

async function stored(db) {
    return (await db.query("SELECT data FROM json_data WHERE key='bonusData'")).rows[0]?.data || {};
}

async function restore(db, incoming) {
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return incoming;
    const needs = Object.values(incoming).some(b => b && typeof b.image === 'string' && b.image.startsWith(PREFIX));
    if (!needs) return incoming;
    const prev = await stored(db), out = {};
    for (const [id, b] of Object.entries(incoming)) {
        if (b && typeof b.image === 'string' && b.image.startsWith(PREFIX)) {
            const srcId = decodeURIComponent(b.image.slice(PREFIX.length).split('?')[0]);
            const img = prev[srcId]?.image;
            out[id] = { ...b, image: isData(img) ? img : '' };
        } else out[id] = b;
    }
    return out;
}

async function read(db, id) {
    const img = (await stored(db))[id]?.image;
    if (!isData(img)) return null;
    const m = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/is.exec(img);
    if (!m || /svg/i.test(m[1])) return null; // SVG — skript xavfi, yubormaymiz
    return { type: m[1], buf: Buffer.from(m[2], 'base64') };
}

module.exports = { toUrls, restore, read, PREFIX };
