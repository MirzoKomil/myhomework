// domwork.uz landingini Railway'da (yoki istalgan Node serverda) ishlatish.
// Netlify o'rnini bosadi: public/ papkani beradi va formani CRM'ga uzatadi.
//
// Railway sozlamasi:
//   Root directory: integrations/netlify-landings/domwork
//   Start: npm start   (Railway o'zi aniqlaydi)
//   Variables: LEADS_WEBHOOK_SECRET — myhomework servisidagi bitta faol kalit
//
// Qo'shimcha paket kerak emas — faqat Node 20+ ichki modullari.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from './netlify/lib/lead-handler.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const PORT = Number(process.env.PORT) || 8080;
const MAX_BODY = 16000;
const leadHandler = createHandler('domwork');

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
    '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8',
    '.woff2': 'font/woff2',
};
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
};

// Netlify'dagi kabi: bitta IP'dan daqiqasiga 10 ta ariza.
const hits = new Map();
function rateLimited(ip) {
    const now = Date.now();
    const list = (hits.get(ip) || []).filter(t => now - t < 60_000);
    list.push(now);
    hits.set(ip, list);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < 60_000)) hits.delete(k);
    return list.length > 10;
}

function clientIp(req) {
    return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

function send(res, status, body, headers = {}) {
    res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = []; let size = 0;
        req.on('data', c => {
            size += c.length;
            if (size > MAX_BODY) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; }
            chunks.push(c);
        });
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

async function handleLead(req, res) {
    if (req.method === 'POST' && rateLimited(clientIp(req))) {
        return send(res, 429, JSON.stringify({ error: 'So‘rovlar ko‘paydi. Bir ozdan keyin qayta yuboring' }),
            { 'Content-Type': 'application/json; charset=utf-8' });
    }
    let body;
    if (req.method === 'POST') {
        try { body = await readBody(req); }
        catch (e) { return send(res, e.status || 400, JSON.stringify({ error: 'So‘rov juda katta' }), { 'Content-Type': 'application/json; charset=utf-8' }); }
    }
    const request = new Request(`https://${req.headers.host || 'domwork.uz'}${req.url}`, {
        method: req.method, headers: req.headers, body: req.method === 'POST' ? body : undefined,
    });
    const response = await leadHandler(request);
    const headers = Object.fromEntries(response.headers.entries());
    send(res, response.status, Buffer.from(await response.arrayBuffer()), headers);
}

async function serveStatic(req, res) {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
    catch { return send(res, 400, 'Bad request'); }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.normalize(path.join(ROOT, pathname));
    if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');
    try {
        const info = await stat(file);
        if (!info.isFile()) throw new Error('not a file');
        const ext = path.extname(file).toLowerCase();
        const data = await readFile(file);
        const cache = ext === '.html' ? 'no-cache' : 'public, max-age=3600';
        send(res, 200, req.method === 'HEAD' ? undefined : data,
            { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': cache });
    } catch {
        // Noma'lum sahifa — bosh sahifaga (eski havolalar uzilib qolmasin).
        const data = await readFile(path.join(ROOT, 'index.html'));
        send(res, 404, req.method === 'HEAD' ? undefined : data, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' });
    }
}

const server = http.createServer(async (req, res) => {
    try {
        const { pathname } = new URL(req.url, 'http://x');
        // www.domwork.uz → domwork.uz
        if (/^www\./i.test(req.headers.host || '')) {
            return send(res, 301, '', { Location: `https://${req.headers.host.replace(/^www\./i, '')}${req.url}` });
        }
        if (pathname === '/health') return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });
        if (pathname === '/.netlify/functions/lead' || pathname === '/api/lead') return await handleLead(req, res);
        // Netlify Forms zaxira nusxasi uchun yuboriladigan POST — bu yerda kerak emas.
        if (req.method === 'POST' && pathname === '/') { req.resume(); return send(res, 204, ''); }
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
        return await serveStatic(req, res);
    } catch (err) {
        console.error('[domwork-site] XATO:', err.message);
        if (!res.headersSent) send(res, 500, 'Server error');
    }
});

server.listen(PORT, () => console.log(`[domwork-site] ${PORT}-portda ishlayapti`));
