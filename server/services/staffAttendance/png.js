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
function decodePng(buf, expect = null) {
    if (!Buffer.isBuffer(buf) || buf.length < 33 || !buf.subarray(0, 8).equals(SIG)) {
        throw new Error('PNG emas');
    }
    let off = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
    const idat = [];
    while (off + 8 <= buf.length) {
        const len = buf.readUInt32BE(off);
        const type = buf.toString('ascii', off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (off + 12 + len > buf.length) throw new Error('PNG buzilgan');
        if (type === 'IHDR') {
            if (len < 13) throw new Error('PNG buzilgan');
            width = data.readUInt32BE(0); height = data.readUInt32BE(4);
            bitDepth = data[8]; colorType = data[9]; interlace = data[12];
        } else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        off += 12 + len;
    }
    if (!width || !height || width > MAX_SIDE || height > MAX_SIDE) throw new Error('PNG o\'lchami noto\'g\'ri');
    // Kutilgan o'lcham sarlavhadanoq tekshiriladi — katta rasm ochilmasdan rad etiladi.
    if (expect && (width !== expect.width || height !== expect.height)) throw Object.assign(new Error('PNG o\'lchami noto\'g\'ri'), { size: true });
    if (bitDepth !== 8 || interlace !== 0) throw new Error('PNG formati qo\'llab-quvvatlanmaydi');
    const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
    if (!channels) throw new Error('PNG rang turi qo\'llab-quvvatlanmaydi');

    const stride = width * channels;
    // Siqilgan "bomba" xotirani to'ldirmasligi uchun chiqish hajmi aniq cheklanadi.
    let raw;
    try { raw = zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: (stride + 1) * height }); }
    catch { throw new Error('PNG buzilgan'); }
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

// CRC32 (PNG bo'laklari uchun)
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

// RGB piksellar → PNG (dalil rasmi sifatida saqlash uchun).
function encodePng({ width, height, rgb }) {
    const raw = Buffer.alloc((width * 3 + 1) * height);
    for (let y = 0; y < height; y++) {
        raw[y * (width * 3 + 1)] = 0;
        Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(raw, y * (width * 3 + 1) + 1);
    }
    const chunk = (type, data) => {
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
        const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
        return Buffer.concat([len, body, crc]);
    };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
    return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Ikki baravar kichraytirish (2x2 o'rtacha).
function halve({ width, height, rgb }) {
    const w = Math.floor(width / 2), h = Math.floor(height / 2), out = new Uint8Array(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
        const i = (yy, xx) => rgb[((yy) * width + xx) * 3 + c];
        out[(y * w + x) * 3 + c] = (i(2 * y, 2 * x) + i(2 * y, 2 * x + 1) + i(2 * y + 1, 2 * x) + i(2 * y + 1, 2 * x + 1) + 2) >> 2;
    }
    return { width: w, height: h, rgb: out };
}

// Rasm markazining (yuz joyi) 17x16 kulrang "farq xeshi" — 256 bit. Bir xil rasm qayta yuborilsa
// (shovqin, yorug'lik o'zgarishi bilan ham) xesh deyarli o'zgarmaydi.
function dhash({ width, height, rgb }) {
    const x0 = Math.floor(width * 0.2), x1 = Math.floor(width * 0.8), y0 = Math.floor(height * 0.15), y1 = Math.floor(height * 0.75);
    const W = 17, H = 16, cells = new Float64Array(W * H);
    for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) {
        const sx = x0 + Math.floor((x1 - x0) * gx / W), ex = x0 + Math.floor((x1 - x0) * (gx + 1) / W);
        const sy = y0 + Math.floor((y1 - y0) * gy / H), ey = y0 + Math.floor((y1 - y0) * (gy + 1) / H);
        let sum = 0, n = 0;
        for (let y = sy; y < ey; y++) for (let x = sx; x < ex; x++) { const i = (y * width + x) * 3; sum += rgb[i] * 0.299 + rgb[i + 1] * 0.587 + rgb[i + 2] * 0.114; n++; }
        cells[gy * W + gx] = n ? sum / n : 0;
    }
    let bits = '';
    for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W - 1; gx++) bits += cells[gy * W + gx] > cells[gy * W + gx + 1] ? '1' : '0';
    return bits;
}
function hamming(a, b) {
    if (!a || !b || a.length !== b.length) return Infinity;
    let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
    return d;
}

function dataUrlToBuffer(dataUrl) {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) throw new Error('Rasm PNG data-URL ko\'rinishida bo\'lishi kerak');
    return Buffer.from(m[1], 'base64');
}

module.exports = { decodePng, encodePng, halve, dhash, hamming, dataUrlToBuffer };
