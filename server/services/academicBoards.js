'use strict';
// Akademik bo'lim → Elektron doska va "Darsni boshlash" sessiyalari.
//
// Doska — ustozning o'z yozuvi (o'quvchi + dars yoki erkin), vektor chizmalar
// JSON ko'rinishida (avtosaqlash). Shablon — shu tildagi barcha ustozlar
// foydalana oladigan doska nusxasi. Ruxsat serverda:
//   • ustoz (asosiy yoki yordamchi) — faqat o'z doskalari; shablonlarni ko'radi;
//   • admin, boshliq, ROP — hamma doskani faqat ko'radi (yozmaydi).
// Sessiya — "Darsni boshlash" → "Darsni tugatish" vaqti (dalil sifatida
// admin Qoplashlar sahifasida). Maoshga ta'sir qilmaydi.
const { randomUUID } = require('node:crypto');

const LANGS = new Set(['english', 'russian']);
const VIEW_ALL = new Set(['admin', 'boshliq', 'rop']);
const MAX_DATA_BYTES = 1_500_000;
const MAX_ITEMS = 4000;
const TZ = 'Asia/Tashkent';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS academic_boards (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 language TEXT NOT NULL CHECK (language IN ('english','russian')),
 kind TEXT NOT NULL DEFAULT 'board' CHECK (kind IN ('board','template')),
 title TEXT NOT NULL DEFAULT '',
 student_id TEXT NOT NULL DEFAULT '',
 lesson_no INTEGER CHECK (lesson_no IS NULL OR (lesson_no BETWEEN 1 AND 72)),
 lesson_date DATE,
 duty TEXT NOT NULL DEFAULT 'main',
 data JSONB NOT NULL DEFAULT '{"items":[]}',
 item_count INTEGER NOT NULL DEFAULT 0,
 archived BOOLEAN NOT NULL DEFAULT FALSE,
 created_by TEXT NOT NULL DEFAULT '',
 updated_by TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS academic_boards_owner ON academic_boards(owner_id, updated_at DESC) WHERE NOT archived;
CREATE INDEX IF NOT EXISTS academic_boards_tpl ON academic_boards(language, kind) WHERE NOT archived;
CREATE TABLE IF NOT EXISTS academic_lesson_sessions (
 id TEXT PRIMARY KEY,
 teacher_id TEXT NOT NULL,
 student_id TEXT NOT NULL,
 lesson_date DATE NOT NULL,
 lesson_no INTEGER CHECK (lesson_no IS NULL OR (lesson_no BETWEEN 1 AND 72)),
 started_at TIMESTAMPTZ NOT NULL,
 ended_at TIMESTAMPTZ NOT NULL,
 minutes INTEGER NOT NULL DEFAULT 0 CHECK (minutes >= 0),
 created_by TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS academic_lesson_sessions_t ON academic_lesson_sessions(teacher_id, lesson_date);
`;

const error = (status, message) => Object.assign(new Error(message), { status });
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const tzDay = (d = new Date()) => dayFmt.format(d);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());

async function initSchema(pool) {
    await pool.query(SCHEMA);
}

// Kim so'rayapti: ustoz (HR profili bilan) yoki to'liq ko'ruvchi.
async function who(pool, actor) {
    const hub = require('./academicHub');
    const access = await hub.resolveAccess(pool, actor);
    if (access.teacher) return { ...access, teacherId: access.teacher.id, viewAll: false };
    if (VIEW_ALL.has(access.role)) return { ...access, teacherId: null, viewAll: true };
    throw error(403, "Doskalarga ruxsat yo'q");
}

function row(r, { withData = false } = {}) {
    const out = {
        id: r.id, ownerId: r.owner_id, ownerName: r.owner_name || '', language: r.language, kind: r.kind, title: r.title,
        studentId: r.student_id || '', studentName: r.student_name || '', lessonNo: r.lesson_no, duty: r.duty,
        lessonDate: r.lesson_date ? (r.lesson_date instanceof Date ? tzDay(r.lesson_date) : String(r.lesson_date).slice(0, 10)) : null,
        itemCount: Number(r.item_count) || 0, updatedAt: r.updated_at, updatedByName: r.updated_by_name || '', createdAt: r.created_at,
    };
    if (withData) out.data = r.data || { items: [] };
    return out;
}

const SELECT = `SELECT b.*, he.name AS owner_name, s.name AS student_name, COALESCE(uu.name, '') AS updated_by_name
    FROM academic_boards b
    LEFT JOIN hr_employees he ON he.id = b.owner_id
    LEFT JOIN students s ON s.id = b.student_id
    LEFT JOIN users uu ON uu.id = b.updated_by`;

// Ro'yxat (chizmalarsiz). Ustoz: o'z doskalari + shu tildagi shablonlar.
// Admin: tanlangan ustoz (yoki hammasi) doskalari + shablonlar.
async function listBoards(pool, actor, { lang, teacherId } = {}) {
    const a = await who(pool, actor);
    const language = a.lang || (LANGS.has(lang) ? lang : 'english');
    const params = [language];
    let own;
    if (a.viewAll) {
        own = "b.kind='board'";
        if (teacherId) { params.push(String(teacherId)); own += ` AND b.owner_id=$${params.length}`; }
    } else {
        params.push(a.teacherId);
        own = `b.kind='board' AND b.owner_id=$${params.length}`;
    }
    const { rows } = await pool.query(`${SELECT} WHERE NOT b.archived AND b.language=$1 AND ((${own}) OR b.kind='template')
        ORDER BY b.kind, b.updated_at DESC LIMIT 300`, params);
    return { lang: language, canWrite: !a.viewAll, teacherId: a.teacherId, boards: rows.map(r => row(r)) };
}

async function loadBoard(pool, id) {
    const { rows } = await pool.query(`${SELECT} WHERE b.id=$1 AND NOT b.archived`, [String(id || '')]);
    if (!rows[0]) throw error(404, 'Doska topilmadi');
    return rows[0];
}

function canRead(a, b) {
    if (a.viewAll) return true;
    if (b.kind === 'template') return !a.lang || b.language === a.lang;
    return b.owner_id === a.teacherId;
}

async function getBoard(pool, actor, id) {
    const a = await who(pool, actor);
    const b = await loadBoard(pool, id);
    if (!canRead(a, b)) throw error(403, "Bu doska sizniki emas");
    return { board: row(b, { withData: true }), canWrite: !a.viewAll && b.owner_id === a.teacherId };
}

// Chizmalar: faqat ma'lum turdagi elementlar, sonli koordinatalar, qisqa matn.
const COLOR = /^#[0-9a-f]{6}$/i;
const num = v => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : 0);
function cleanData(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const items = Array.isArray(src.items) ? src.items.slice(0, MAX_ITEMS) : [];
    const out = [];
    for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        const t = String(it.t || '');
        const c = COLOR.test(it.c) ? it.c : '#0B1220';
        const w = Math.max(1, Math.min(60, num(it.w) || 4));
        if (t === 'pen' || t === 'erase') {
            const pts = Array.isArray(it.p) ? it.p.slice(0, 4000).map(num) : [];
            if (pts.length >= 2) out.push({ t, c, w, p: pts.length % 2 ? pts.slice(0, -1) : pts });
        } else if (t === 'line' || t === 'rect' || t === 'ellipse' || t === 'arrow') {
            out.push({ t, c, w, x1: num(it.x1), y1: num(it.y1), x2: num(it.x2), y2: num(it.y2) });
        } else if (t === 'text') {
            const s = String(it.s || '').slice(0, 300);
            if (s) out.push({ t, c, w, x: num(it.x), y: num(it.y), s, f: Math.max(10, Math.min(160, num(it.f) || 32)) });
        }
    }
    const data = { v: 1, items: out };
    if (JSON.stringify(data).length > MAX_DATA_BYTES) throw error(413, "Doska juda katta — yangi doska oching");
    return data;
}

// Ustozga biriktirilgan o'quvchi (asosiy yoki yordamchi sifatida).
async function assertOwnStudent(pool, teacherId, studentId) {
    const { rows } = await pool.query('SELECT id, teacher_id, assistant_teacher_id FROM students WHERE id=$1', [studentId]);
    const s = rows[0];
    if (!s) throw error(404, "O'quvchi topilmadi");
    if (s.teacher_id === teacherId) return 'main';
    if (s.assistant_teacher_id === teacherId) {
        // 29-okt: asosiy ustozga qolib ketgan eski yordamchi biriktirishi ruxsat bermaydi.
        const r = (await pool.query('SELECT role FROM hr_employees WHERE id=$1', [teacherId])).rows[0];
        if (r?.role === 'yordamchi') return 'assistant';
    }
    throw error(403, "Bu o'quvchi sizga biriktirilmagan");
}

async function createBoard(pool, actor, body = {}) {
    const a = await who(pool, actor);
    if (a.viewAll) throw error(403, "Doskani faqat ustoz yaratadi — siz faqat ko'rasiz");
    const kind = body.kind === 'template' ? 'template' : 'board';
    const title = String(body.title || '').trim().slice(0, 120) || (kind === 'template' ? 'Shablon' : 'Doska');
    let studentId = '', duty = 'main', lessonNo = null, lessonDate = null;
    if (kind === 'board' && body.studentId) {
        studentId = String(body.studentId);
        duty = await assertOwnStudent(pool, a.teacherId, studentId);
    }
    if (body.lessonNo !== undefined && body.lessonNo !== null && body.lessonNo !== '') {
        const n = Number(body.lessonNo);
        if (!Number.isInteger(n) || n < 1 || n > 72) throw error(400, "Dars raqami 1–72 bo'lishi kerak");
        lessonNo = n;
    }
    if (body.lessonDate) {
        if (!isDate(body.lessonDate)) throw error(400, "Sana noto'g'ri");
        lessonDate = body.lessonDate;
    }
    // Bir o'quvchi + sana uchun bitta doska: qayta yaratilmaydi, mavjudi qaytadi.
    if (kind === 'board' && studentId && lessonDate) {
        const { rows } = await pool.query(`SELECT id FROM academic_boards WHERE NOT archived AND kind='board' AND owner_id=$1 AND student_id=$2 AND lesson_date=$3 LIMIT 1`,
            [a.teacherId, studentId, lessonDate]);
        if (rows[0]) return getBoard(pool, actor, rows[0].id);
    }
    let data = cleanData(body.data);
    if (body.fromId) {
        const src = await loadBoard(pool, body.fromId);
        if (!canRead(a, src)) throw error(403, "Shablonga ruxsat yo'q");
        data = cleanData(src.data);
    }
    const id = 'wb-' + randomUUID();
    await pool.query(`INSERT INTO academic_boards (id, owner_id, language, kind, title, student_id, lesson_no, lesson_date, duty, data, item_count, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
    [id, a.teacherId, a.lang || 'english', kind, title, studentId, lessonNo, lessonDate, duty, JSON.stringify(data), data.items.length, actor.id]);
    return getBoard(pool, actor, id);
}

async function updateBoard(pool, actor, id, body = {}) {
    const a = await who(pool, actor);
    if (a.viewAll) throw error(403, "Admin doskani faqat ko'radi");
    const b = await loadBoard(pool, id);
    if (b.owner_id !== a.teacherId) throw error(403, 'Bu doska sizniki emas');
    const sets = [], params = [b.id];
    if (body.data !== undefined) {
        const data = cleanData(body.data);
        params.push(JSON.stringify(data)); sets.push(`data=$${params.length}`);
        params.push(data.items.length); sets.push(`item_count=$${params.length}`);
    }
    if (body.title !== undefined) {
        params.push(String(body.title || '').trim().slice(0, 120) || b.title); sets.push(`title=$${params.length}`);
    }
    if (!sets.length) return { ok: true, updatedAt: b.updated_at };
    params.push(actor.id);
    const { rows } = await pool.query(`UPDATE academic_boards SET ${sets.join(', ')}, updated_by=$${params.length}, updated_at=NOW()
        WHERE id=$1 RETURNING updated_at, item_count`, params);
    return { ok: true, updatedAt: rows[0].updated_at, itemCount: rows[0].item_count };
}

async function archiveBoard(pool, actor, id) {
    const a = await who(pool, actor);
    if (a.viewAll) throw error(403, "Admin doskani faqat ko'radi");
    const b = await loadBoard(pool, id);
    if (b.owner_id !== a.teacherId) throw error(403, 'Bu doska sizniki emas');
    await pool.query('UPDATE academic_boards SET archived=TRUE, updated_by=$2, updated_at=NOW() WHERE id=$1', [b.id, actor.id]);
    return { ok: true };
}

// ── "Darsni boshlash" sessiyalari ───────────────────────────────────────────
// Faqat asosiy ustoz o'z o'quvchisi uchun yozadi; davomiylik 1–240 daqiqa.
async function recordSession(pool, actor, body = {}) {
    const a = await who(pool, actor);
    if (a.viewAll) throw error(403, 'Sessiyani faqat ustoz yozadi');
    const studentId = String(body.studentId || '');
    if (!studentId) throw error(400, "O'quvchi tanlanmagan");
    const duty = await assertOwnStudent(pool, a.teacherId, studentId);
    if (duty !== 'main') throw error(403, 'Darsni faqat asosiy ustoz boshlaydi');
    const started = new Date(body.startedAt), ended = new Date(body.endedAt || Date.now());
    if (Number.isNaN(started.getTime()) || Number.isNaN(ended.getTime()) || ended < started) throw error(400, "Vaqt noto'g'ri");
    if (ended.getTime() - Date.now() > 5 * 60000 || Date.now() - started.getTime() > 12 * 3600000) throw error(400, 'Sessiya vaqti mos emas');
    const minutes = Math.min(240, Math.max(0, Math.round((ended - started) / 60000)));
    const date = tzDay(started);
    let lessonNo = Number(body.lessonNo);
    if (!Number.isInteger(lessonNo) || lessonNo < 1 || lessonNo > 72) lessonNo = null;
    const id = 'ls-' + randomUUID();
    await pool.query(`INSERT INTO academic_lesson_sessions (id, teacher_id, student_id, lesson_date, lesson_no, started_at, ended_at, minutes, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, a.teacherId, studentId, date, lessonNo, started.toISOString(), ended.toISOString(), minutes, actor.id]);
    return { session: { id, studentId, date, lessonNo, minutes } };
}

async function listSessions(pool, actor, { month, teacherId } = {}) {
    const a = await who(pool, actor);
    if (!/^\d{4}-\d{2}$/.test(String(month || ''))) throw error(400, "Oy noto'g'ri");
    const params = [`${month}-01`];
    let where = "lesson_date >= $1::date AND lesson_date < ($1::date + INTERVAL '1 month')";
    const tid = a.viewAll ? (teacherId ? String(teacherId) : null) : a.teacherId;
    if (tid) { params.push(tid); where += ` AND teacher_id=$${params.length}`; }
    const { rows } = await pool.query(`SELECT teacher_id, student_id, TO_CHAR(lesson_date,'YYYY-MM-DD') AS date, lesson_no, minutes, started_at, ended_at
        FROM academic_lesson_sessions WHERE ${where} ORDER BY started_at`, params);
    return { sessions: rows.map(r => ({ teacherId: r.teacher_id, studentId: r.student_id, date: r.date, lessonNo: r.lesson_no, minutes: r.minutes, startedAt: r.started_at, endedAt: r.ended_at })) };
}

module.exports = { initSchema, listBoards, getBoard, createBoard, updateBoard, archiveBoard, recordSession, listSessions, cleanData };
