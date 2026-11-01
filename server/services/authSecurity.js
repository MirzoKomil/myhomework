'use strict';
// Kirish xavfsizligi (Sozlamalar → Parol / Sessiyalar dizayni, 2026-10-28):
//  • kirishlar tarixi (muvaffaqiyatli va noto'g'ri parol) — 30 kun ko'rinadi;
//  • bir login + IP dan 15 daqiqada 5 marta noto'g'ri parol → 15 daqiqa blok
//    (faqat shu IP uchun — boshqa odam egasini butunlay bloklab qo'ya olmaydi);
//  • xodim paroli kamida 4 belgi (30-okt direktor qarori: standart — telefonning oxirgi 4 raqami), eskisidan farqli;
//    o'zgartirilgan vaqt saqlanadi.
const { randomUUID } = require('node:crypto');

const FAIL_LIMIT = 5;
const LOCK_MINUTES = 15;
const STAFF_MIN = 4;

let ready = null;
function ensure(pool) {
    ready ||= pool.query(`
        CREATE TABLE IF NOT EXISTS login_events (
            id TEXT PRIMARY KEY, user_id TEXT, login TEXT NOT NULL, ok BOOLEAN NOT NULL,
            reason TEXT NOT NULL DEFAULT '', ip TEXT NOT NULL DEFAULT '', user_agent TEXT NOT NULL DEFAULT '',
            at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS login_events_login_at ON login_events (LOWER(login), at DESC);
        CREATE INDEX IF NOT EXISTS login_events_user_at ON login_events (user_id, at DESC);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
    `).catch(err => { ready = null; throw err; });
    return ready;
}

// Qulf kaliti normallashgan login: "+998 90 123 45 67", "901234567", "(90)1234567" — bitta akkaunt (findUserByEmail oxirgi 9 raqam bo'yicha topadi),
// shuning uchun yozilish ko'rinishini almashtirib 5 urinishni aylanib o'tib bo'lmaydi.
function loginKey(login) {
    const s = String(login || '').trim(), d = s.replace(/\D/g, '');
    return /^[\s+()0-9-]+$/.test(s) && d.length >= 9 ? d.slice(-9) : s.toLowerCase();
}
const KEY_SQL = `(CASE WHEN login ~ '^[[:space:]+()0-9-]+$' AND LENGTH(REGEXP_REPLACE(login,'[^0-9]','','g')) >= 9 THEN RIGHT(REGEXP_REPLACE(login,'[^0-9]','','g'),9) ELSE LOWER(login) END)`;
async function isLocked(pool, login, ip) {
    await ensure(pool);
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n, MAX(at) AS last FROM login_events
        WHERE ${KEY_SQL}=$1 AND ip=$2 AND NOT ok AND at > NOW() - ($3 || ' minutes')::interval`, [loginKey(login), ip, String(LOCK_MINUTES)]);
    return rows[0].n >= FAIL_LIMIT;
}

// Ustoz ilovasi v2 (Kirish K3/K4): qolgan urinishlar va qulf qachon ochilishi. isLocked bilan bir qoida —
// so'nggi 15 daqiqadagi xatolar; qulf eng so'nggi 5 xatoning eng eskisi 15 daqiqadan o'tganda ochiladi.
async function failState(pool, login, ip) {
    await ensure(pool);
    const { rows } = await pool.query(`SELECT at FROM login_events WHERE ${KEY_SQL}=$1 AND ip=$2 AND NOT ok
        AND at > NOW() - ($3 || ' minutes')::interval ORDER BY at DESC LIMIT $4`, [loginKey(login), ip, String(LOCK_MINUTES), FAIL_LIMIT]);
    const left = Math.max(0, FAIL_LIMIT - rows.length);
    const retryAfterSec = left === 0 ? Math.max(1, Math.ceil((new Date(rows[rows.length - 1].at).getTime() + LOCK_MINUTES * 60000 - Date.now()) / 1000)) : 0;
    return { attemptsLeft: left, retryAfterSec };
}

// Akkaunt bo'yicha umumiy cheklov (IP dan qat'i nazar): 15 daqiqada 3×FAIL_LIMIT xato — akkaunt vaqtincha yopiladi.
async function accountLocked(pool, userId) {
    if (!userId) return false;
    await ensure(pool);
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM login_events WHERE user_id=$1 AND NOT ok AND at > NOW() - ($2 || ' minutes')::interval`, [userId, String(LOCK_MINUTES)]);
    return rows[0].n >= FAIL_LIMIT * 3;
}

async function record(pool, { userId = null, login, ok, reason = '', ip = '', userAgent = '' }) {
    await ensure(pool);
    await pool.query(`INSERT INTO login_events (id, user_id, login, ok, reason, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [randomUUID(), userId, String(login || '').slice(0, 200), !!ok, reason, String(ip || '').slice(0, 80), String(userAgent || '').slice(0, 400)]);
    // Eski yozuvlar (90 kundan eski) vaqti-vaqti bilan tozalanadi.
    if (Math.random() < 0.02) await pool.query(`DELETE FROM login_events WHERE at < NOW() - INTERVAL '90 days'`).catch(() => {});
}

// Foydalanuvchining o'z kirishlari: user_id bo'yicha muvaffaqiyatlilar va o'z login'iga noto'g'ri urinishlar.
async function history(pool, user, days = 30) {
    await ensure(pool);
    const { rows } = await pool.query(`SELECT ok, reason, ip, user_agent, at FROM login_events
        WHERE (user_id=$1 OR LOWER(login)=LOWER($2)) AND at > NOW() - ($3 || ' days')::interval ORDER BY at DESC LIMIT 60`,
        [user.id, user.email || '', String(days)]);
    return rows.map(r => ({ ok: r.ok, reason: r.reason, ip: maskIp(r.ip), userAgent: r.user_agent, at: r.at }));
}
function maskIp(ip) {
    const v4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(ip || '');
    return v4 ? `${v4[1]}.${v4[2]}.xx.xx` : ip ? String(ip).replace(/:[0-9a-f]*:[0-9a-f]*$/i, ':xx:xx') : '';
}

function checkNewPassword(user, current, next) {
    const staff = user.role !== 'student';
    const min = staff ? STAFF_MIN : 6;
    if (String(next).length < min) return `Yangi parol kamida ${min} belgidan iborat bo'lishi kerak`;
    if (current === next) return 'Yangi parol eskisidan farqli bo\'lsin';
    return null;
}

async function markPasswordChanged(pool, userId) {
    await ensure(pool);
    await pool.query('UPDATE users SET password_changed_at=NOW() WHERE id=$1', [userId]);
}
async function passwordChangedAt(pool, userId) {
    await ensure(pool);
    return (await pool.query('SELECT password_changed_at FROM users WHERE id=$1', [userId])).rows[0]?.password_changed_at || null;
}

module.exports = { FAIL_LIMIT, LOCK_MINUTES, STAFF_MIN, ensure, isLocked, failState, accountLocked, loginKey, record, history, maskIp, checkNewPassword, markPasswordChanged, passwordChangedAt };
