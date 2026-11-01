'use strict';
// Firebase Cloud Messaging (HTTP v1) — "Domwork Team" Android ilovasiga push yuborish.
// Kalit: Railway env FCM_SERVICE_ACCOUNT — Firebase → Project settings → Service accounts → "Generate new private key"
// JSON faylining butun matni (yoki base64 ko'rinishi). Kalit yo'q bo'lsa — hech narsa yuborilmaydi, server ishlayveradi.
// Tashqi kutubxona kerak emas: JWT Node crypto bilan imzolanadi.
const crypto = require('crypto');

let creds, credsErr, access = { token: '', exp: 0 };

function credentials() {
    if (creds !== undefined) return creds;
    const raw = String(process.env.FCM_SERVICE_ACCOUNT || '').trim();
    if (!raw) return (creds = null);
    try {
        const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
        const j = JSON.parse(text);
        if (!j.client_email || !j.private_key || !j.project_id) throw new Error('client_email/private_key/project_id yo\'q');
        creds = { email: j.client_email, key: String(j.private_key).replace(/\\n/g, '\n'), project: j.project_id };
    } catch (e) {
        creds = null; credsErr = e.message;
        console.error('[fcm] FCM_SERVICE_ACCOUNT o\'qilmadi:', e.message);
    }
    return creds;
}
const configured = () => !!credentials();
const b64u = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

async function accessToken() {
    const c = credentials();
    if (!c) throw Object.assign(new Error('FCM sozlanmagan'), { code: 'FCM_NOT_CONFIGURED' });
    if (access.token && Date.now() < access.exp - 60000) return access.token;
    const now = Math.floor(Date.now() / 1000);
    const head = b64u({ alg: 'RS256', typ: 'JWT' });
    const body = b64u({ iss: c.email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
    const sig = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(c.key).toString('base64url');
    const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${sig}` })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw Object.assign(new Error(`FCM token olinmadi: ${j.error || r.status}`), { code: 'FCM_AUTH' });
    access = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
    return access.token;
}

// Faqat "data" xabar: ilova yopiq bo'lsa ham PushService o'zi chiroyli bildirishnoma chizadi (bosilsa — kerakli sahifa).
// Natija: { ok } | { ok:false, gone:true } (token eskirgan — o'chirish kerak) | { ok:false, error }.
async function send(token, { title, body, url, tag, id }) {
    const c = credentials();
    if (!c) return { ok: false, error: 'not_configured' };
    const data = { title: String(title || 'Domwork').slice(0, 200), body: String(body || '').slice(0, 600),
        url: String(url || 'https://myhomework.uz/'), tag: String(tag || 'domwork').slice(0, 120), id: String(id || '').slice(0, 200) };
    let r;
    try {
        r = await fetch(`https://fcm.googleapis.com/v1/projects/${c.project}/messages:send`, {
            method: 'POST', headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: { token, data, android: { priority: 'HIGH', ttl: '86400s' } } })
        });
    } catch (e) { return { ok: false, error: e.code || e.message }; }
    if (r.ok) return { ok: true };
    const j = await r.json().catch(() => ({}));
    const code = j?.error?.details?.find?.(d => d.errorCode)?.errorCode || j?.error?.status || String(r.status);
    if (r.status === 401) access = { token: '', exp: 0 };
    return { ok: false, gone: r.status === 404 || code === 'UNREGISTERED' || (code === 'INVALID_ARGUMENT' && /token/i.test(j?.error?.message || '')), error: code };
}

module.exports = { configured, send, status: () => ({ configured: configured(), error: credsErr || null, project: creds?.project || null }) };
