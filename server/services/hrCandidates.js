// HR Vakansiya voronkasi — ma'lumotlar qatlami (18-vazifa).
//
// server/db.js ga tegilmadi (u 4200 qatorli, jonli ma'lumot bilan ishlaydigan
// fayl) — bu modul faqat undan `pool` ni oladi va o'z jadvallarini o'zi
// yaratadi. Shu sabab mavjud hech qanday oqim buzilmaydi.
//
// ── MEDIA NEGA POSTGRES ICHIDA ──────────────────────────────────────────────
// Nomzodning rasmi/ovozi/videosi `bytea` ustunida, bazaning o'zida saqlanadi.
// Mavjud /uploads yo'li diskka yozadi (server/routes/uploads.js), lekin
// Railway'da ilova konteyneri har deployda toza holatda ko'tariladi — agar
// servisga alohida volume ulanmagan bo'lsa, diskdagi fayllar yo'qoladi.
// HR kartochkasidagi rasm/ovoz esa nomzod tanlanmaguncha (ba'zan oylab)
// kerak bo'ladi, ya'ni yo'qolishi mumkin emas. Baza esa volume ustida
// turibdi va zaxiralanadi.
//
// Hajm: rasm ~200-500 KB, ovoz ~0.5-1 MB, video ~2-10 MB. Yiliga bir necha
// yuz nomzod uchun bu bir necha GB emas, bir necha yuz MB — bazaga bemalol.
// Har bir fayl uchun qattiq chegara MAX_MEDIA_BYTES da.
const { randomUUID } = require('crypto');
const { pool } = require('../db');
const { normalizeHrStage } = require('./hrStages');

const MAX_MEDIA_BYTES = 20 * 1024 * 1024;   // 20 MB — Telegram video uchun yetarli

async function initHrSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS hr_candidates (
            id TEXT PRIMARY KEY,
            telegram_user_id TEXT DEFAULT '',
            telegram_username TEXT DEFAULT '',
            full_name TEXT NOT NULL,
            telegram_phone TEXT DEFAULT '',
            contact_phone TEXT DEFAULT '',
            address TEXT DEFAULT '',
            birth_year TEXT DEFAULT '',
            has_laptop BOOLEAN,
            ready_for_office BOOLEAN,
            vacancy_id TEXT DEFAULT '',
            vacancy_name TEXT DEFAULT '',
            answers JSONB NOT NULL DEFAULT '{}',
            utm_source TEXT DEFAULT '',
            stage TEXT NOT NULL DEFAULT 'kandidatlar',
            comments JSONB NOT NULL DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS hr_candidate_media (
            id TEXT PRIMARY KEY,
            candidate_id TEXT NOT NULL REFERENCES hr_candidates(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            mime TEXT DEFAULT '',
            file_name TEXT DEFAULT '',
            size_bytes INTEGER DEFAULT 0,
            bytes BYTEA NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS hr_bot_sessions (
            telegram_user_id TEXT PRIMARY KEY,
            state JSONB NOT NULL DEFAULT '{}',
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);
    await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_hr_candidates_stage_created
         ON hr_candidates(stage, created_at DESC)`
    ).catch(() => {});
    await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_hr_media_candidate
         ON hr_candidate_media(candidate_id, kind)`
    ).catch(() => {});
    console.log('[hr] Vakansiya jadvallari tayyor');
}

function parseJson(value, fallback) {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return fallback; }
}

// Media baytlari HECH QACHON ro'yxat javobiga qo'shilmaydi — faqat qaysi
// turlari borligi. Aks holda bitta "barcha nomzodlar" so'rovi o'nlab
// megabaytga aylanib ketardi.
function rowToCandidate(r) {
    return {
        id: r.id,
        telegramUserId: r.telegram_user_id || '',
        telegramUsername: r.telegram_username || '',
        fullName: r.full_name,
        telegramPhone: r.telegram_phone || '',
        contactPhone: r.contact_phone || '',
        address: r.address || '',
        birthYear: r.birth_year || '',
        hasLaptop: r.has_laptop,
        readyForOffice: r.ready_for_office,
        vacancyId: r.vacancy_id || '',
        vacancyName: r.vacancy_name || '',
        answers: parseJson(r.answers, {}),
        utmSource: r.utm_source || '',
        stage: normalizeHrStage(r.stage),
        comments: parseJson(r.comments, []),
        media: r.media_kinds ? String(r.media_kinds).split(',').filter(Boolean) : [],
        createdAt: r.created_at || null,
        updatedAt: r.updated_at || null,
    };
}

async function listCandidates() {
    const { rows } = await pool.query(`
        SELECT c.*,
               (SELECT string_agg(DISTINCT m.kind, ',')
                FROM hr_candidate_media m WHERE m.candidate_id = c.id) AS media_kinds
        FROM hr_candidates c
        ORDER BY c.created_at DESC
    `);
    return rows.map(rowToCandidate);
}

async function getCandidateById(id) {
    const { rows } = await pool.query(`
        SELECT c.*,
               (SELECT string_agg(DISTINCT m.kind, ',')
                FROM hr_candidate_media m WHERE m.candidate_id = c.id) AS media_kinds
        FROM hr_candidates c WHERE c.id = $1
    `, [id]);
    return rows[0] ? rowToCandidate(rows[0]) : null;
}

// Nomzod ikki marta ariza yuborsa ham YANGI kartochka yaratiladi — jimgina
// tashlab yuborilmaydi. HR ikkinchi arizani ko'rib, o'zi qaror qiladi
// (odam boshqa vakansiyaga topshirgan bo'lishi ham mumkin).
async function insertCandidate(data) {
    const id = randomUUID();
    const { rows } = await pool.query(`
        INSERT INTO hr_candidates
            (id, telegram_user_id, telegram_username, full_name, telegram_phone,
             contact_phone, address, birth_year, has_laptop, ready_for_office,
             vacancy_id, vacancy_name, answers, utm_source, stage, comments)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING *
    `, [
        id,
        String(data.telegramUserId || ''),
        String(data.telegramUsername || ''),
        String(data.fullName || '').trim() || 'Nomzod',
        String(data.telegramPhone || ''),
        String(data.contactPhone || ''),
        String(data.address || ''),
        String(data.birthYear || ''),
        typeof data.hasLaptop === 'boolean' ? data.hasLaptop : null,
        typeof data.readyForOffice === 'boolean' ? data.readyForOffice : null,
        String(data.vacancyId || ''),
        String(data.vacancyName || ''),
        JSON.stringify(data.answers || {}),
        String(data.utmSource || ''),
        'kandidatlar',
        JSON.stringify([]),
    ]);
    return rowToCandidate(rows[0]);
}

const UPDATABLE = {
    stage: (v) => ['stage', normalizeHrStage(v)],
    comments: (v) => ['comments', JSON.stringify(Array.isArray(v) ? v : [])],
    contactPhone: (v) => ['contact_phone', String(v || '')],
    fullName: (v) => ['full_name', String(v || '').trim() || 'Nomzod'],
    address: (v) => ['address', String(v || '')],
};

async function updateCandidate(id, fields) {
    const sets = [];
    const values = [id];
    for (const [key, raw] of Object.entries(fields || {})) {
        const mapper = UPDATABLE[key];
        if (!mapper) continue;                       // noma'lum maydon jimgina e'tiborsiz
        const [column, value] = mapper(raw);
        values.push(value);
        sets.push(`${column} = $${values.length}`);
    }
    if (!sets.length) return getCandidateById(id);
    await pool.query(
        `UPDATE hr_candidates SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`,
        values
    );
    return getCandidateById(id);
}

async function deleteCandidate(id) {
    const { rowCount } = await pool.query('DELETE FROM hr_candidates WHERE id = $1', [id]);
    return rowCount > 0;
}

async function addMedia(candidateId, kind, buffer, mime, fileName) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) return null;
    if (buffer.length > MAX_MEDIA_BYTES) {
        console.warn(`[hr] Media juda katta (${buffer.length} bayt), saqlanmadi: ${kind}`);
        return null;
    }
    const id = randomUUID();
    await pool.query(`
        INSERT INTO hr_candidate_media (id, candidate_id, kind, mime, file_name, size_bytes, bytes)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [id, candidateId, kind, mime || '', fileName || '', buffer.length, buffer]);
    return id;
}

async function getMedia(candidateId, kind) {
    const { rows } = await pool.query(
        `SELECT mime, file_name, bytes FROM hr_candidate_media
         WHERE candidate_id = $1 AND kind = $2
         ORDER BY created_at DESC LIMIT 1`,
        [candidateId, kind]
    );
    return rows[0] || null;
}

// ── Bot suhbat holati (FSM) ─────────────────────────────────────────────────
// Xotirada emas, bazada saqlanadi: Railway konteyneri istalgan vaqt qayta
// ishga tushishi mumkin, o'shanda yarim to'ldirilgan anketa yo'qolmasligi
// kerak — nomzod boshidan boshlashga majbur bo'lmaydi.

async function getBotSession(telegramUserId) {
    const { rows } = await pool.query(
        'SELECT state FROM hr_bot_sessions WHERE telegram_user_id = $1',
        [String(telegramUserId)]
    );
    return parseJson(rows[0]?.state, null);
}

async function saveBotSession(telegramUserId, state) {
    await pool.query(`
        INSERT INTO hr_bot_sessions (telegram_user_id, state, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (telegram_user_id)
        DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
    `, [String(telegramUserId), JSON.stringify(state || {})]);
}

async function clearBotSession(telegramUserId) {
    await pool.query('DELETE FROM hr_bot_sessions WHERE telegram_user_id = $1',
        [String(telegramUserId)]);
}

module.exports = {
    initHrSchema, listCandidates, getCandidateById, insertCandidate,
    updateCandidate, deleteCandidate, addMedia, getMedia,
    getBotSession, saveBotSession, clearBotSession,
    MAX_MEDIA_BYTES,
};
