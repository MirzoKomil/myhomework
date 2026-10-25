'use strict';
// Kichik PNG dekoder (tashqi paketsiz). Brauzer canvas.toDataURL('image/png')
// beradigan oddiy PNG'larni (8-bit, interlace'siz, RGB/RGBA/grayscale) o'qiydi.
// Yuz tekshiruvi serverda ishlashi uchun kerak: rasmni piksellarga aylantiramiz.
const zlib = require('zlib');

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_SIDE = 2000;

function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    return pb <= pc ? b : c;
}

// Natija: { width, height, rgb: Uint8Array (width*height*3) }
function decodePng(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 33 || !buf.subarray(0, 8).equals(SIG)) {
        throw new Error('PNG emas');
    }
    let off = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
    const idat = [];
    while (off + 8 <= buf.length) {
        const len = buf.readUInt32BE(off);
        const type = buf.toString('ascii', off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') {
            width = data.readUInt32BE(0); height = data.readUInt32BE(4);
            bitDepth = data[8]; colorType = data[9]; interlace = data[12];
        } else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        off += 12 + len;
    }
    if (!width || !height || width > MAX_SIDE || height > MAX_SIDE) throw new Error('PNG o\'lchami noto\'g\'ri');
    if (bitDepth !== 8 || interlace !== 0) throw new Error('PNG formati qo\'llab-quvvatlanmaydi');
    const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
    if (!channels) throw new Error('PNG rang turi qo\'llab-quvvatlanmaydi');

    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = width * channels;
    if (raw.length < (stride + 1) * height) throw new Error('PNG buzilgan');
    const px = new Uint8Array(stride * height);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const src = y * (stride + 1) + 1, dst = y * stride, prev = dst - stride;
        for (let x = 0; x < stride; x++) {
            const r = raw[src + x];
            const a = x >= channels ? px[dst + x - channels] : 0;
            const b = y > 0 ? px[prev + x] : 0;
            const c = (x >= channels && y > 0) ? px[prev + x - channels] : 0;
            let v;
            switch (filter) {
                case 0: v = r; break;
                case 1: v = r + a; break;
                case 2: v = r + b; break;
                case 3: v = r + ((a + b) >> 1); break;
                case 4: v = r + paeth(a, b, c); break;
                default: throw new Error('PNG filtri noto\'g\'ri');
            }
            px[dst + x] = v & 0xff;
        }
    }
    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < width * height; i++, j += 3) {
        const s = i * channels;
        if (channels >= 3) { rgb[j] = px[s]; rgb[j + 1] = px[s + 1]; rgb[j + 2] = px[s + 2]; }
        else { rgb[j] = rgb[j + 1] = rgb[j + 2] = px[s]; }
    }
    return { width, height, rgb };
}

function dataUrlToBuffer(dataUrl) {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) throw new Error('Rasm PNG data-URL ko\'rinishida bo\'lishi kerak');
    return Buffer.from(m[1], 'base64');
}

module.exports = { decodePng, dataUrlToBuffer };
