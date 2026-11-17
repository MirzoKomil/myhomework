'use strict';
// Ilova ichidagi video dars (LiveKit) — 1-bosqich (sinov / pilot).
// Kanvas "CRM — barcha dizaynlar" → "Video dars · Telefon/Kompyuter" (VD_*), HANDOFF: claude/HANDOFF-video-dars-livekit.md.
//
// Railway o'zgaruvchilari:
//   LIVEKIT_URL         — wss://<loyiha>.livekit.cloud (LiveKit Cloud → Settings)
//   LIVEKIT_API_KEY     — API key
//   LIVEKIT_API_SECRET  — API secret
//   VIDEO_PILOT_TEACHERS — sinovdagi ustozlarning HR id'lari vergul bilan ("all" — hamma ustoz). Bo'sh — o'chiq.
//
// Har dars uchun alohida xona: les_<studentId>_<YYYY-MM-DD>. Har kishiga alohida 8 belgili havola kodi
// (https://myhomework.uz/d/XXXX-XXXX): faqat shu dars vaqtida ochiladi (15 daq oldin), dars tugagach o'chadi,
// bir vaqtda bitta qurilma. Tokenlar LiveKit formatidagi JWT (HS256) — alohida kutubxona shart emas.
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

const OPEN_BEFORE_MIN = 15;     // havola darsdan 15 daqiqa oldin ochiladi
const GRACE_AFTER_MIN = 15;     // dars tugagach 15 daqiqa ichida qayta kirsa bo'ladi
const DEVICE_TTL_MS = 2 * 60 * 1000; // boshqa qurilma "faol" deb hisoblanadigan muddat
const TZ_MS = 5 * 60 * 60 * 1000;   // Asia/Tashkent

const cfg = () => ({
    url: (process.env.LIVEKIT_URL || '').trim(),
    key: (process.env.LIVEKIT_API_KEY || '').trim(),
    secret: (process.env.LIVEKIT_API_SECRET || '').trim(),
});
const configured = () => { const c = cfg(); return !!(c.url && c.key && c.secret); };

function pilotOn(teacherId) {
    const raw = (process.env.VIDEO_PILOT_TEACHERS || '').trim();
    if (!raw || !configured()) return false;
    if (raw === 'all') return true;
    return !!teacherId && raw.split(',').map(s => s.trim()).filter(Boolean).includes(String(teacherId));
}

// LiveKit kirish tokeni. identity — xonadagi yagona nom (ustoz: "t:<id>", o'quvchi: "s:<id>", mehmon: "g:<kod>").
function accessToken({ identity, name, room, canPublish = true, metadata = {}, ttlSec = 3 * 60 * 60 }) {
    const c = cfg();
    return jwt.sign({
        name: String(name || '').slice(0, 80),
        metadata: JSON.stringify(metadata),
        video: { room, roomJoin: true, canPublish, canSubscribe: true, canPublishData: true },
    }, c.secret, { issuer: c.key, subject: identity, expiresIn: ttlSec, notBefore: 0, algorithm: 'HS256' });
}

const ymd = ms => new Date(ms + TZ_MS).toISOString().slice(0, 10);
const roomOf = (studentId, startsAtMs) => `les_${String(studentId).replace(/[^A-Za-z0-9-]/g, '')}_${ymd(startsAtMs)}`;

// 8 belgili, adashtirmaydigan alifbo (0/O, 1/I yo'q): XXXX-XXXX.
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
    const b = crypto.randomBytes(8);
    let s = '';
    for (let i = 0; i < 8; i++) s += ABC[b[i] % ABC.length];
    return `${s.slice(0, 4)}-${s.slice(4)}`;
}
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{4})(.{4})$/, '$1-$2');

let ready = null;
function ensureSchema(pool) {
    if (!ready) ready = pool.query(`
        CREATE TABLE IF NOT EXISTS video_links (
            code TEXT PRIMARY KEY,
            kind TEXT NOT NULL DEFAULT 'student',
            student_id TEXT,
            teacher_id TEXT,
            room TEXT NOT NULL,
            display_name TEXT DEFAULT '',
            teacher_name TEXT DEFAULT '',
            starts_at TIMESTAMPTZ NOT NULL,
            duration_min INTEGER NOT NULL DEFAULT 30,
            device_id TEXT,
            device_seen TIMESTAMPTZ,
            created_by TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS video_links_student ON video_links (student_id, starts_at);
        CREATE TABLE IF NOT EXISTS video_events (
            id BIGSERIAL PRIMARY KEY,
            room TEXT NOT NULL,
            identity TEXT NOT NULL,
            kind TEXT NOT NULL,
            at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS video_events_room ON video_events (room, at);
    `).catch(e => { ready = null; throw e; });
    return ready;
}

function windowOf(row, now = Date.now()) {
    const start = new Date(row.starts_at).getTime();
    const opens = start - OPEN_BEFORE_MIN * 60000;
    const ends = start + (Number(row.duration_min) || 30) * 60000 + GRACE_AFTER_MIN * 60000;
    return { start, opens, ends, state: now < opens ? 'early' : now > ends ? 'expired' : 'open' };
}

// O'quvchining navbatdagi darsi uchun havola (bir dars — bitta kod; qayta chaqirilsa o'sha kod qaytadi).
async function ensureStudentLink(pool, { studentId, studentName, teacherId, teacherName, startsAt, durationMin, createdBy = 'system' }) {
    await ensureSchema(pool);
    const startMs = new Date(startsAt).getTime();
    const room = roomOf(studentId, startMs);
    const found = await pool.query(`SELECT * FROM video_links WHERE kind='student' AND student_id=$1 AND room=$2 LIMIT 1`, [studentId, room]);
    if (found.rows[0]) return found.rows[0];
    for (let i = 0; i < 5; i++) {
        const code = newCode();
        const r = await pool.query(`INSERT INTO video_links (code, kind, student_id, teacher_id, room, display_name, teacher_name, starts_at, duration_min, created_by)
            VALUES ($1,'student',$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (code) DO NOTHING RETURNING *`,
            [code, studentId, teacherId || null, room, studentName || '', teacherName || '', new Date(startMs), Math.max(15, Number(durationMin) || 30), createdBy]);
        if (r.rows[0]) return r.rows[0];
    }
    throw new Error('Havola kodi yaratilmadi');
}

const publicUrl = code => `${(process.env.PUBLIC_BASE_URL || 'https://myhomework.uz').replace(/\/$/, '')}/d/${code}`;

module.exports = {
    cfg, configured, pilotOn, accessToken, ensureSchema, ensureStudentLink, windowOf, roomOf, normCode, newCode, publicUrl,
    DEVICE_TTL_MS, OPEN_BEFORE_MIN, GRACE_AFTER_MIN,
};
