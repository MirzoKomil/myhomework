'use strict';
// Xodimlar davomati: yuz (Face ID) + lokatsiya bilan kelish/ketish.
// Ustozlar bu oqimga kirmaydi — ular uchun lessons.js (avtomatik nazorat).
const { randomUUID } = require('crypto');
const rules = require('./rules');
const t = require('./time');
const notify = require('./notify');
const png = require('./png');

const MANAGE_ROLES = new Set(['admin', 'boshliq', 'hr']);
// ROP uchun HR bo'limi CRM'da ataylab yopiq (js/app.js applyRoleBasedAccess) — u Telegram xabarlarini oladi.
const VIEW_ROLES = new Set(['admin', 'boshliq', 'hr']);
const TEACHER_HR_ROLES = new Set(['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi', 'asosiy', 'yordamchi']);
const MAX_ATTEMPTS_PER_DAY = 12;
const MAX_FACE_ATTEMPTS_PER_DAY = 8;
const MAX_CHALLENGES_PER_DAY = 30;
const FRAME_W = 360, FRAME_H = 480;    // brauzer har doim shu o'lchamda (3x4) yuboradi
const MAX_PNG_BYTES = 1.5 * 1024 * 1024;
const CHALLENGE_TTL_SECONDS = 180;
const REPLAY_DISTANCE = 0.02;           // yuz belgilari deyarli aynan bir xil — qayta yuborilgan rasm
const REPLAY_HAMMING = 12;              // rasm xeshi (256 bit) deyarli bir xil — qayta yuborilgan rasm
const TURNED_MATCH_THRESHOLD = 0.6;     // burilgan yuz to'g'ri yuzdan biroz farq qiladi
const inFlight = new Set();             // bir xodimdan bir vaqtda bitta tekshiruv

const SCHEMA = `
CREATE TABLE IF NOT EXISTS staff_att_settings (
 singleton INTEGER PRIMARY KEY DEFAULT 1 CHECK(singleton=1), data JSONB NOT NULL DEFAULT '{}',
 updated_by TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO staff_att_settings(singleton) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS staff_att_photos (
 id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, purpose TEXT NOT NULL CHECK(purpose IN ('enroll','check')),
 mime TEXT NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS staff_att_photos_age ON staff_att_photos(purpose,created_at);
CREATE TABLE IF NOT EXISTS staff_att_faces (
 employee_id TEXT PRIMARY KEY, descriptors JSONB NOT NULL, photo_id TEXT,
 state TEXT NOT NULL CHECK(state IN ('pending','approved','rejected','reset')),
 submitted_by TEXT NOT NULL, reviewed_by TEXT, reviewed_at TIMESTAMPTZ, first_approved_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS staff_att_schedules (
 employee_id TEXT PRIMARY KEY, tracked BOOLEAN NOT NULL DEFAULT TRUE, days JSONB NOT NULL DEFAULT '{}',
 tracked_since DATE NOT NULL DEFAULT CURRENT_DATE,
 updated_by TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS staff_att_events (
 id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, user_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('in','out')),
 work_date DATE NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 ok BOOLEAN NOT NULL, reason TEXT NOT NULL DEFAULT '',
 lat DOUBLE PRECISION, lng DOUBLE PRECISION, accuracy INTEGER, distance_m INTEGER, location_method TEXT NOT NULL DEFAULT '',
 face_distance REAL, yaw_delta REAL, descriptor JSONB, frame_hash TEXT, photo_id TEXT, ip TEXT NOT NULL DEFAULT '', user_agent TEXT NOT NULL DEFAULT ''
);
-- Oldingi versiyada yaratilgan bazalar uchun (takroriy ishga tushirish xavfsiz).
ALTER TABLE staff_att_faces ADD COLUMN IF NOT EXISTS first_approved_at TIMESTAMPTZ;
ALTER TABLE staff_att_faces ADD COLUMN IF NOT EXISTS reset_at TIMESTAMPTZ;
ALTER TABLE staff_att_schedules ADD COLUMN IF NOT EXISTS tracked_since DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE staff_att_events ADD COLUMN IF NOT EXISTS location_method TEXT NOT NULL DEFAULT '';
ALTER TABLE staff_att_events ADD COLUMN IF NOT EXISTS descriptor JSONB;
ALTER TABLE staff_att_events ADD COLUMN IF NOT EXISTS frame_hash TEXT;
ALTER TABLE staff_att_faces DROP CONSTRAINT IF EXISTS staff_att_faces_state_check;
ALTER TABLE staff_att_faces ADD CONSTRAINT staff_att_faces_state_check CHECK(state IN ('pending','approved','rejected','reset'));
CREATE INDEX IF NOT EXISTS staff_att_events_day ON staff_att_events(work_date,employee_id);
CREATE INDEX IF NOT EXISTS staff_att_events_emp ON staff_att_events(employee_id,occurred_at DESC);
CREATE TABLE IF NOT EXISTS staff_att_challenges (
 id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, direction TEXT NOT NULL CHECK(direction IN ('left','right')),
 expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS staff_att_overrides (
 employee_id TEXT NOT NULL, work_date DATE NOT NULL, status TEXT NOT NULL CHECK(status IN ('excused','present','absent','leave')),
 note TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(employee_id,work_date)
);
-- Tugagan kunlar natijasi muzlatiladi: keyin grafik yoki sozlama o'zgarsa ham o'tgan oy raqamlari o'zgarmaydi.
CREATE TABLE IF NOT EXISTS staff_att_day_results (
 employee_id TEXT NOT NULL, work_date DATE NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(employee_id,work_date)
);
CREATE TABLE IF NOT EXISTS staff_att_audit (
 id BIGSERIAL PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL,
 data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS staff_att_audit_entity ON staff_att_audit(entity_id,created_at);
`;

function error(status, message) { return Object.assign(new Error(message), { status }); }

// Bir nechta server nusxasi bir vaqtda ko'tarilsa ham jadvallar to'qnashmasligi uchun qulf ostida.
async function initSchema(pool) {
    const client = typeof pool.connect === 'function' ? await pool.connect() : pool;
    try {
        await client.query("SELECT pg_advisory_lock(hashtext('staff_att_schema'))");
        try {
            await client.query(SCHEMA);
            await require('./lessons').initSchema(client);
        } finally {
            await client.query("SELECT pg_advisory_unlock(hashtext('staff_att_schema'))");
        }
    } finally {
        if (client !== pool) client.release();
    }
}

async function tableExists(db, name) {
    return !!(await db.query('SELECT to_regclass($1) AS t', ['public.' + name])).rows[0]?.t;
}

async function transaction(pool, fn) {
    if (typeof pool.connect !== 'function') return fn(pool);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
    } finally {
        client.release();
    }
}

// Login akkaunti → xodim (hr_employees). Bir login ikki xodimga biriktirilgan bo'lsa — xavfsiz tomonga, xodim topilmaydi.
async function actor(db, user) {
    const row = (await db.query('SELECT id,name,email,role FROM users WHERE id=$1', [user?.id])).rows[0];
    if (!row) throw error(401, 'Akkaunt topilmadi');
    let employees = [];
    if (await tableExists(db, 'user_sales_manager_links')) {
        employees = (await db.query(`SELECT he.id,he.name,he.role FROM user_sales_manager_links l JOIN hr_employees he ON he.id=l.manager_id
            WHERE l.user_id=$1`, [row.id])).rows;
    }
    if (!employees.length && String(row.email || '').trim()) {
        employees = (await db.query(`SELECT id,name,role FROM hr_employees WHERE COALESCE(TRIM(login),'')<>''
            AND LOWER(TRIM(login))=LOWER(TRIM($1)) AND COALESCE(status,'active')<>'inactive'`, [row.email])).rows;
    }
    const emp = employees.length === 1 ? employees[0] : null;
    return { ...row, employee_id: emp?.id || null, employee_name: emp?.name || null, employee_role: emp?.role || null,
        ambiguous: employees.length > 1, canManage: MANAGE_ROLES.has(row.role), canView: VIEW_ROLES.has(row.role) };
}

function requireView(a) { if (!a.canView) throw error(403, 'Davomat bo‘limiga ruxsat yo‘q'); }
function requireManage(a) { if (!a.canManage) throw error(403, 'Faqat HR yoki rahbar o‘zgartira oladi'); }
function requireEmployee(a) {
    if (a.ambiguous) throw error(409, 'Loginingiz HR ro‘yxatida bir nechta xodimga biriktirilgan. HR bilan bog‘laning');
    if (!a.employee_id) throw error(403, 'Siz HR ro‘yxatida xodim sifatida topilmadingiz');
}

async function audit(db, actorId, action, entityId, data = {}) {
    await db.query('INSERT INTO staff_att_audit(actor_id,action,entity_id,data) VALUES($1,$2,$3,$4)',
        [String(actorId), action, String(entityId), JSON.stringify(data)]);
}

async function getSettings(db) {
    const row = (await db.query('SELECT data FROM staff_att_settings WHERE singleton=1')).rows[0];
    return rules.normalizeSettings(row?.data);
}

async function saveSettings(db, user, raw) {
    const a = await actor(db, user); requireManage(a);
    const s = rules.normalizeSettings(raw);
    await db.query('UPDATE staff_att_settings SET data=$1,updated_by=$2,updated_at=NOW() WHERE singleton=1', [JSON.stringify(s), a.id]);
    await audit(db, a.id, 'settings', 'settings', s);
    return s;
}

// Kadr: aniq 360x480 PNG. Dekodlangan piksellar dalil rasmini yasash uchun ham ishlatiladi —
// HR ko'radigan rasm aynan yuz tekshirilgan rasmning o'zi (alohida rasm qabul qilinmaydi).
function frame(dataUrl) {
    let buf, img;
    try { buf = png.dataUrlToBuffer(dataUrl); } catch (e) { throw error(400, 'Rasm yuborilmadi'); }
    if (buf.length > MAX_PNG_BYTES) throw error(400, 'Rasm juda katta');
    try { img = png.decodePng(buf, { width: FRAME_W, height: FRAME_H }); }
    catch (e) { throw error(400, e.size ? 'Rasm o‘lchami noto‘g‘ri. Sahifani yangilab qayta urinib ko‘ring' : 'Rasm formati noto‘g‘ri'); }
    return { buf, img };
}

async function savePhoto(db, employeeId, purpose, data) {
    const id = randomUUID();
    await db.query('INSERT INTO staff_att_photos(id,employee_id,purpose,mime,data) VALUES($1,$2,$3,$4,$5)',
        [id, employeeId, purpose, 'image/png', data]);
    return id;
}

async function analyzeSafe(analyzer, buf, opts) {
    try { return await analyzer.analyze(buf, opts); }
    catch (e) {
        if (e.status) throw e;
        if (/PNG/.test(e.message)) throw error(400, 'Rasm formati noto‘g‘ri');
        console.error('[staff-attendance] yuz tahlili xatosi:', e.message);
        throw error(503, 'Yuzni tekshirib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring');
    }
}

function withLock(key, fn) {
    if (inFlight.has(key)) return Promise.reject(error(429, 'Oldingi urinish hali tekshirilmoqda. Biroz kuting'));
    inFlight.add(key);
    return Promise.resolve().then(fn).finally(() => inFlight.delete(key));
}

// ── Yuz namunasi ─────────────────────────────────────────────────────────────

async function otherApprovedMatch(db, analyzer, employeeId, descriptor) {
    const others = (await db.query(`SELECT f.employee_id,f.descriptors,he.name FROM staff_att_faces f LEFT JOIN hr_employees he ON he.id=f.employee_id
        WHERE f.state='approved' AND f.employee_id<>$1`, [employeeId])).rows;
    return others.find(o => analyzer.bestDistance(descriptor, o.descriptors) <= analyzer.MATCH_THRESHOLD) || null;
}

// 2-3 ta to'g'ri qaragan kadr: hammasida bitta yuz va bir-biriga mos bo'lishi shart.
async function buildDescriptors(db, analyzer, employeeId, frames, revealName) {
    if (!Array.isArray(frames) || frames.length < 2 || frames.length > 3) throw error(400, '2 yoki 3 ta rasm kerak');
    const parsed = frames.map(frame);
    const descriptors = [];
    for (const f of parsed) {
        const r = await analyzeSafe(analyzer, f.buf);
        if (r.faces !== 1) throw error(422, rules.reasonText(r.faces > 1 ? 'many_faces' : 'no_face'));
        descriptors.push(r.descriptor);
    }
    for (let i = 0; i < descriptors.length; i++) for (let j = i + 1; j < descriptors.length; j++) {
        if (analyzer.distance(descriptors[i], descriptors[j]) > analyzer.MATCH_THRESHOLD) {
            throw error(422, 'Rasmlar bir-biriga mos kelmadi. Yorug‘ joyda, to‘g‘ri qarab qayta oling');
        }
    }
    const other = await otherApprovedMatch(db, analyzer, employeeId, descriptors[0]);
    if (other) {
        // Xodimning o'ziga boshqa xodim ismi ko'rsatilmaydi — faqat HR'ga.
        throw error(409, revealName ? `Bu yuz boshqa xodimga (${other.name || other.employee_id}) biriktirilgan`
            : 'Bu yuz boshqa xodimga biriktirilgan. HR bilan bog‘laning');
    }
    return { descriptors, evidence: parsed[0].buf };
}

async function storeFace(pool, analyzer, { employeeId, frames, state, by }) {
    const { descriptors, evidence } = await buildDescriptors(pool, analyzer, employeeId, frames, state === 'approved');
    return transaction(pool, async db => {
        const old = (await db.query('SELECT photo_id,state FROM staff_att_faces WHERE employee_id=$1 FOR UPDATE', [employeeId])).rows[0];
        // Tahlil davomida HR namunani tasdiqlab qo'ygan bo'lsa — xodimning yuborgani uni almashtirmaydi.
        if (state === 'pending' && old?.state === 'approved') throw error(409, 'Yuz namunangiz allaqachon tasdiqlangan');
        const photoId = await savePhoto(db, employeeId, 'enroll', evidence);
        const approved = state === 'approved';
        await db.query(`INSERT INTO staff_att_faces(employee_id,descriptors,photo_id,state,submitted_by,reviewed_by,reviewed_at,first_approved_at)
            VALUES($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT(employee_id) DO UPDATE SET descriptors=EXCLUDED.descriptors,photo_id=EXCLUDED.photo_id,
            state=EXCLUDED.state,submitted_by=EXCLUDED.submitted_by,reviewed_by=EXCLUDED.reviewed_by,reviewed_at=EXCLUDED.reviewed_at,updated_at=NOW(),
            first_approved_at=COALESCE(staff_att_faces.first_approved_at,EXCLUDED.first_approved_at),
            reset_at=CASE WHEN EXCLUDED.state='approved' THEN NULL ELSE staff_att_faces.reset_at END`,
            [employeeId, JSON.stringify(descriptors), photoId, state, by, approved ? by : null, approved ? new Date() : null]);
        if (old?.photo_id) await db.query("DELETE FROM staff_att_photos WHERE id=$1 AND purpose='enroll'", [old.photo_id]);
        await audit(db, by, 'face:' + state, employeeId, { photoId });
        return { state, photoId };
    });
}

async function submitOwnFace(pool, analyzer, user, body) {
    const a = await actor(pool, user); requireEmployee(a);
    const current = (await pool.query('SELECT state FROM staff_att_faces WHERE employee_id=$1', [a.employee_id])).rows[0];
    if (current?.state === 'approved') throw error(409, 'Yuz namunangiz allaqachon tasdiqlangan. O‘zgartirish uchun HR’ga murojaat qiling');
    if (!(await scheduleFor(pool, a.employee_id))?.tracked) throw error(403, 'Sizga davomat belgilash yoqilmagan');
    // Har bir urinish (muvaffaqiyatsizi ham) hisoblanadi — yuz tekshiruvi navbatini band qilib bo'lmasin.
    const recent = (await pool.query(`SELECT COUNT(*)::int AS n FROM staff_att_audit WHERE entity_id=$1 AND action='face:attempt'
        AND created_at > NOW() - INTERVAL '1 day'`, [a.employee_id])).rows[0].n;
    if (recent >= MAX_FACE_ATTEMPTS_PER_DAY) throw error(429, 'Bugun yuz namunasi juda ko‘p yuborildi. Ertaga qayta urinib ko‘ring yoki HR’ga murojaat qiling');
    if (analyzer.hasCapacity && !analyzer.hasCapacity(3)) throw error(503, 'Hozir tekshiruv navbati band. Bir daqiqadan keyin qayta urinib ko‘ring');
    await audit(pool, a.id, 'face:attempt', a.employee_id);
    const result = await withLock('face:' + a.employee_id, () =>
        storeFace(pool, analyzer, { employeeId: a.employee_id, frames: body?.frames, state: 'pending', by: a.id }));
    await notify.facePending(pool, { employeeId: a.employee_id, name: a.employee_name || a.name }).catch(() => {});
    return result;
}

// ── Kun holati (bir nechta xodim/kun uchun bir martada yuklanadi) ────────────

async function loadContext(db, employeeIds, from, to) {
    const ids = employeeIds.map(String);
    const q = (sql, params) => db.query(sql, params).then(r => r.rows);
    const [schedules, faces, events, overrides, snapshots] = await Promise.all([
        q("SELECT employee_id,tracked,days,TO_CHAR(tracked_since,'YYYY-MM-DD') AS since FROM staff_att_schedules WHERE employee_id=ANY($1::text[])", [ids]),
        q('SELECT employee_id,state,first_approved_at,reset_at FROM staff_att_faces WHERE employee_id=ANY($1::text[])', [ids]),
        q(`SELECT employee_id,TO_CHAR(work_date,'YYYY-MM-DD') AS d,kind,occurred_at FROM staff_att_events
            WHERE ok AND employee_id=ANY($1::text[]) AND work_date BETWEEN $2 AND $3 ORDER BY occurred_at`, [ids, from, to]),
        q(`SELECT employee_id,TO_CHAR(work_date,'YYYY-MM-DD') AS d,status,note FROM staff_att_overrides
            WHERE employee_id=ANY($1::text[]) AND work_date BETWEEN $2 AND $3`, [ids, from, to]),
        q(`SELECT employee_id,TO_CHAR(work_date,'YYYY-MM-DD') AS d,data FROM staff_att_day_results
            WHERE employee_id=ANY($1::text[]) AND work_date BETWEEN $2 AND $3`, [ids, from, to]),
    ]);
    const leaves = await tableExists(db, 'domwork_bot_leave_requests')
        ? await q(`SELECT employee_id,TO_CHAR(start_date,'YYYY-MM-DD') AS s,TO_CHAR(end_date,'YYYY-MM-DD') AS e FROM domwork_bot_leave_requests
            WHERE state='approved' AND employee_id=ANY($1::text[]) AND end_date>=$2 AND start_date<=$3`, [ids, from, to]) : [];
    const key = (e, d) => e + '|' + d;
    const ev = new Map();
    for (const r of events) { const k = key(r.employee_id, r.d); if (!ev.has(k)) ev.set(k, []); ev.get(k).push(r); }
    return {
        schedules: new Map(schedules.map(r => [r.employee_id, r])),
        faces: new Map(faces.map(r => [r.employee_id, r])),
        events: ev,
        overrides: new Map(overrides.map(r => [key(r.employee_id, r.d), r])),
        snapshots: new Map(snapshots.map(r => [key(r.employee_id, r.d), r.data])),
        leaves, key, fresh: [],
    };
}

function statusFor(ctx, employeeId, date, settings, now) {
    const today = t.tashkentDate(now);
    const k = ctx.key(employeeId, date);
    let base = date < today ? ctx.snapshots.get(k) : null;
    if (!base) {
        const schedule = ctx.schedules.get(employeeId);
        const face = ctx.faces.get(employeeId);
        const day = schedule?.tracked ? (schedule.days || {})[String(t.weekday(date))] || null : null;
        // Hisob grafik yoqilgan va yuz namunasi BIRINCHI marta tasdiqlangan kundan boshlanadi.
        const approvedOn = face?.first_approved_at ? t.tashkentDate(face.first_approved_at) : null;
        // Namuna HR tomonidan o'chirilgan va hali qayta tasdiqlanmagan — o'chirilgan kundan boshlab "kelmadi" hisoblanmaydi.
        const usable = face?.state === 'approved' || !face?.reset_at || date < t.tashkentDate(face.reset_at);
        const countFrom = approvedOn && usable ? [approvedOn, schedule?.since || approvedOn].sort().pop() : null;
        base = rules.dayStatus({ date, today, nowMinutes: t.tashkentMinutes(now), day, settings,
            events: ctx.events.get(k) || [], leave: false, override: null, countFrom });
        if (date < today) { ctx.snapshots.set(k, base); ctx.fresh.push([employeeId, date, base]); }
    }
    const override = ctx.overrides.get(k);
    if (override) return { ...base, status: override.status, note: override.note || '', overridden: true };
    if (ctx.leaves.some(l => l.employee_id === employeeId && l.s <= date && l.e >= date)) return { ...base, status: 'leave' };
    return base;
}

async function freeze(db, ctx) {
    if (!ctx.fresh.length) return;
    const rows = ctx.fresh.splice(0);
    await db.query(`INSERT INTO staff_att_day_results(employee_id,work_date,data)
        SELECT * FROM UNNEST($1::text[],$2::date[],$3::jsonb[]) ON CONFLICT DO NOTHING`,
        [rows.map(r => r[0]), rows.map(r => r[1]), rows.map(r => JSON.stringify(r[2]))]);
}

async function computeDay(db, employeeId, date, settings, now = new Date()) {
    const ctx = await loadContext(db, [employeeId], date, date);
    const result = statusFor(ctx, employeeId, date, settings, now);
    await freeze(db, ctx);
    return result;
}

// ── Xodimning o'z kabineti ────────────────────────────────────────────────────

async function scheduleFor(db, employeeId) {
    const row = (await db.query('SELECT tracked,days FROM staff_att_schedules WHERE employee_id=$1', [employeeId])).rows[0];
    return row ? { tracked: row.tracked, days: row.days || {} } : null;
}

async function me(db, user, now = new Date()) {
    const a = await actor(db, user);
    const base = { name: a.name, employeeId: a.employee_id || null };
    if (a.ambiguous) return { ...base, tracked: false, reason: 'ambiguous' };
    if (!a.employee_id) return { ...base, tracked: false, reason: 'no_employee' };
    const schedule = await scheduleFor(db, a.employee_id);
    if (!schedule?.tracked) return { ...base, tracked: false, reason: 'not_tracked' };
    const settings = await getSettings(db);
    const face = (await db.query('SELECT state FROM staff_att_faces WHERE employee_id=$1', [a.employee_id])).rows[0];
    const date = t.tashkentDate(now);
    const today = await computeDay(db, a.employee_id, date, settings, now);
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS_PER_DAY - Number((await db.query(
        'SELECT COUNT(*)::int AS n FROM staff_att_events WHERE employee_id=$1 AND work_date=$2', [a.employee_id, date])).rows[0].n));
    return { ...base, tracked: true, face: face ? face.state : 'none', today, days: schedule.days,
        office: { name: settings.office.name, radius: settings.office.radius }, attemptsLeft, photoDays: settings.photoRetentionDays,
        nextAction: today.inAt ? 'out' : 'in' };
}

// Har urinishdan oldin server tasodifiy yo'nalish beradi (chapga/o'ngga) — bir martalik, 2 daqiqa.
async function challenge(db, user, now = new Date()) {
    const a = await actor(db, user); requireEmployee(a);
    const schedule = await scheduleFor(db, a.employee_id);
    if (!schedule?.tracked) throw error(403, 'Sizga davomat belgilash yoqilmagan');
    await db.query("DELETE FROM staff_att_challenges WHERE expires_at < NOW() - INTERVAL '1 hour' AND employee_id=$1", [a.employee_id]);
    const n = (await db.query("SELECT COUNT(*)::int AS n FROM staff_att_challenges WHERE employee_id=$1 AND expires_at > $2", [a.employee_id, new Date(now.getTime() - 86400000)])).rows[0].n;
    if (n >= MAX_CHALLENGES_PER_DAY) throw error(429, 'Bugungi urinishlar soni tugadi. HR bilan bog‘laning');
    const id = randomUUID();
    const direction = require('crypto').randomInt(2) ? 'left' : 'right';
    await db.query('INSERT INTO staff_att_challenges(id,employee_id,direction,expires_at) VALUES($1,$2,$3,$4)',
        [id, a.employee_id, direction, new Date(now.getTime() + CHALLENGE_TTL_SECONDS * 1000)]);
    return { id, direction, expiresIn: CHALLENGE_TTL_SECONDS };
}

function guardOrder(prior, kind) {
    if (prior.length >= MAX_ATTEMPTS_PER_DAY) throw error(429, 'Bugungi urinishlar soni tugadi. HR bilan bog‘laning');
    const okIn = prior.find(e => e.ok && e.kind === 'in');
    if (kind === 'in' && okIn) throw error(409, `Bugun kelish allaqachon belgilangan (${t.tashkentClock(okIn.occurred_at)})`);
    if (kind === 'out' && !okIn) throw error(409, 'Avval kelishni belgilang');
}

async function priorEvents(db, employeeId, date) {
    return (await db.query('SELECT kind,ok,occurred_at FROM staff_att_events WHERE employee_id=$1 AND work_date=$2 ORDER BY occurred_at', [employeeId, date])).rows;
}

function ipAllowed(ip, list) {
    const raw = String(ip || '').trim().toLowerCase();
    if (raw.includes(':') && !raw.startsWith('::ffff:')) return (list || []).some(entry => entry.toLowerCase() === raw); // IPv6 — aniq moslik
    const v4 = raw.replace(/^::ffff:/, '');
    const toInt = s => s.split('.').reduce((n, p) => (n << 8) + Number(p), 0) >>> 0;
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) return false;
    return (list || []).some(entry => {
        const [base, bits] = entry.split('/');
        if (!bits) return base === v4;
        const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
        return !base.includes(':') && (toInt(base) & mask) === (toInt(v4) & mask);
    });
}

// Yuz tahlili (bir necha soniya, alohida oqimda) tranzaksiyadan TASHQARIDA bajariladi;
// yozish xodim bo'yicha qulf ostida qayta tekshirib amalga oshiriladi.
async function check(pool, analyzer, user, body, meta = {}) {
    const a = await actor(pool, user); requireEmployee(a);
    const schedule = await scheduleFor(pool, a.employee_id);
    if (!schedule?.tracked) throw error(403, 'Sizga davomat belgilash yoqilmagan');
    const kind = body?.kind === 'out' ? 'out' : body?.kind === 'in' ? 'in' : null;
    if (!kind) throw error(400, 'Amal turi noto‘g‘ri');
    return withLock('check:' + a.employee_id, () => checkLocked(pool, analyzer, a, kind, body, meta));
}

async function checkLocked(pool, analyzer, a, kind, body, meta) {
    const now = meta.now || new Date();
    const date = t.tashkentDate(now);
    const settings = await getSettings(pool);
    guardOrder(await priorEvents(pool, a.employee_id, date), kind);
    const face = (await pool.query("SELECT descriptors FROM staff_att_faces WHERE employee_id=$1 AND state='approved'", [a.employee_id])).rows[0];
    if (!face) throw error(409, rules.reasonText('no_face_profile'));
    const ch = (await pool.query('SELECT direction,expires_at,used_at FROM staff_att_challenges WHERE id=$1 AND employee_id=$2',
        [String(body?.challenge || ''), a.employee_id])).rows[0];
    if (!ch || ch.used_at || new Date(ch.expires_at) < now) throw error(409, 'Urinish vaqti tugadi. Qaytadan boshlang');
    const front = frame(body?.frame), turnedFrame = frame(body?.turned);
    // Ikkala tahlil uchun navbatda joy oldindan tekshiriladi (birinchisi o'tib, ikkinchisida to'xtab qolmasin).
    if (analyzer.hasCapacity && !analyzer.hasCapacity(2)) throw error(503, 'Hozir tekshiruv navbati band. Bir necha soniyadan keyin qayta urinilmoqda');
    const frameHash = png.dhash(front.img);

    // Joylashuv: GPS ofis radiusida, yoki so'rov ofis internetidan (IP ro'yxati) kelgan.
    const gps = rules.checkLocation(settings, body?.location);
    const viaIp = ipAllowed(meta.ip, settings.officeIps);
    const locOk = gps.ok || viaIp;
    const lat = Number(body?.location?.lat), lng = Number(body?.location?.lng);
    // Ofisdan tashqaridagi urinishda aniq koordinata saqlanmaydi (bu ko'pincha uy manzili) — faqat masofa.
    const record = { lat: locOk && Number.isFinite(lat) ? lat : null, lng: locOk && Number.isFinite(lng) ? lng : null,
        accuracy: gps.accuracy ?? null, distance: gps.distance ?? null, method: gps.ok ? 'gps' : viaIp ? 'ip' : '',
        faceDistance: null, yawDelta: null, descriptor: null };

    let reason = locOk ? '' : (gps.reason === 'low_accuracy' && !settings.officeIps.length ? 'low_accuracy_phone' : gps.reason);
    let frontResult = null;
    if (!reason) {
        frontResult = await analyzeSafe(analyzer, front.buf);
        if (frontResult.faces !== 1) reason = frontResult.faces > 1 ? 'many_faces' : 'no_face';
    }
    if (!reason) {
        record.descriptor = frontResult.descriptor;
        record.faceDistance = analyzer.bestDistance(frontResult.descriptor, face.descriptors);
        if (!(record.faceDistance <= analyzer.MATCH_THRESHOLD)) reason = 'mismatch';
    }
    if (!reason) {
        // Avval yuborilgan rasmni qayta jo'natish (masalan, uydan skript bilan) — rad etiladi.
        const recent = (await pool.query(`SELECT descriptor,frame_hash FROM staff_att_events WHERE employee_id=$1
            AND (descriptor IS NOT NULL OR frame_hash IS NOT NULL) ORDER BY occurred_at DESC LIMIT 120`, [a.employee_id])).rows;
        if (recent.some(r => (r.descriptor && analyzer.distance(frontResult.descriptor, r.descriptor) < REPLAY_DISTANCE)
            || png.hamming(frameHash, r.frame_hash) <= REPLAY_HAMMING)) reason = 'replay';
    }
    if (!reason) {
        const turned = await analyzeSafe(analyzer, turnedFrame.buf);
        const live = rules.checkLiveness(frontResult, turned, settings.checkTurnDirection ? ch.direction : null);
        record.yawDelta = Number.isFinite(live.yawDelta) ? live.yawDelta : null;
        if (!live.ok) reason = live.reason;
        else if (!(analyzer.bestDistance(turned.descriptor, face.descriptors) <= TURNED_MATCH_THRESHOLD)) reason = 'mismatch';
    }

    const id = randomUUID();
    const after = [];
    const status = await transaction(pool, async db => {
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['staff_att:' + a.employee_id]);
        // Qulf ostida qayta tekshiruv: parallel so'rovlar kunlik chegarani yoki tartibni buzmasin.
        guardOrder(await priorEvents(db, a.employee_id, date), reason ? null : kind);
        const used = await db.query('UPDATE staff_att_challenges SET used_at=NOW() WHERE id=$1 AND used_at IS NULL', [String(body.challenge)]);
        if (!used.rowCount) throw error(409, 'Urinish vaqti tugadi. Qaytadan boshlang');
        // Dalil rasmi — tekshirilgan kadrning o'zi (2 barobar kichraytirilgan). Ofisdan tashqarida rasm saqlanmaydi.
        const photoId = locOk ? await savePhoto(db, a.employee_id, 'check', png.encodePng(png.halve(front.img))) : null;
        await db.query(`INSERT INTO staff_att_events(id,employee_id,user_id,kind,work_date,occurred_at,ok,reason,lat,lng,accuracy,distance_m,location_method,
            face_distance,yaw_delta,descriptor,frame_hash,photo_id,ip,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
            [id, a.employee_id, a.id, kind, date, now, !reason, reason, record.lat, record.lng, record.accuracy, record.distance, record.method,
                Number.isFinite(record.faceDistance) ? record.faceDistance : null, record.yawDelta,
                record.descriptor ? JSON.stringify(record.descriptor) : null, locOk ? frameHash : null, photoId,
                String(meta.ip || '').slice(0, 64), String(meta.userAgent || '').slice(0, 300)]);
        const who = { employeeId: a.employee_id, name: a.employee_name || a.name, date, at: now, settings };
        if (reason) {
            if (reason === 'mismatch') after.push(() => notify.mismatch(pool, who));
            if (reason === 'replay') after.push(() => notify.replay(pool, who));
            return null;
        }
        // Telegram botdagi "Ish jadvali / Face ID" menyusi shu jadvalni o'qiydi.
        if (await tableExists(db, 'domwork_bot_face_logs')) {
            await db.query('INSERT INTO domwork_bot_face_logs(event_id,employee_id,kind,occurred_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
                [id, a.employee_id, kind, now]);
        }
        const day = await computeDay(db, a.employee_id, date, settings, now);
        if (kind === 'in' && day.status === 'late') after.push(() => notify.late(pool, { ...who, status: day }));
        return day;
    });
    // Xabarlar faqat yozuv saqlangandan keyin; xato bo'lsa ham belgilash bekor bo'lmaydi.
    for (const fn of after) await fn().catch(e => console.error('[staff-attendance] xabar xatosi:', e.message));
    if (reason) return { ok: false, reason, message: rules.reasonText(reason), distance: record.distance };
    return { ok: true, kind, at: now, clock: t.tashkentClock(now), today: status };
}

// ── HR / rahbar ──────────────────────────────────────────────────────────────

async function employees(db, user) {
    const a = await actor(db, user); requireView(a);
    const rows = (await db.query(`SELECT he.id,he.name,he.role,he.lang,he.status,he.login,s.tracked,s.days,f.state AS face_state,f.photo_id AS face_photo,f.updated_at AS face_updated
        FROM hr_employees he LEFT JOIN staff_att_schedules s ON s.employee_id=he.id LEFT JOIN staff_att_faces f ON f.employee_id=he.id
        WHERE COALESCE(he.status,'active')<>'inactive' ORDER BY he.name`)).rows;
    return rows.map(r => ({ id: r.id, name: r.name, role: r.role, lang: r.lang, hasLogin: !!String(r.login || '').trim(),
        isTeacher: TEACHER_HR_ROLES.has(r.role), tracked: r.tracked === true, days: r.days || {},
        face: r.face_state || 'none', facePhotoId: r.face_photo || null, faceUpdatedAt: r.face_updated || null }));
}

async function employeeExists(db, id) {
    const row = (await db.query('SELECT id,name FROM hr_employees WHERE id=$1', [String(id || '')])).rows[0];
    if (!row) throw error(404, 'Xodim topilmadi');
    return row;
}

async function saveSchedule(db, user, employeeId, body) {
    const a = await actor(db, user); requireManage(a);
    await employeeExists(db, employeeId);
    const days = rules.normalizeDays(body?.days || {});
    const tracked = body?.tracked !== false;
    if (tracked && !Object.keys(days).length) throw error(400, 'Kamida bitta ish kuni kiriting');
    // tracked_since: hisob boshlangan kun. O'chirib qayta yoqilsa — qayta yoqilgan kundan.
    await db.query(`INSERT INTO staff_att_schedules(employee_id,tracked,days,tracked_since,updated_by) VALUES($1,$2,$3,$5,$4)
        ON CONFLICT(employee_id) DO UPDATE SET tracked=EXCLUDED.tracked,days=EXCLUDED.days,updated_by=EXCLUDED.updated_by,updated_at=NOW(),
        tracked_since=CASE WHEN EXCLUDED.tracked AND NOT staff_att_schedules.tracked THEN EXCLUDED.tracked_since ELSE staff_att_schedules.tracked_since END`,
        [employeeId, tracked, JSON.stringify(days), a.id, t.tashkentDate()]);
    await audit(db, a.id, 'schedule', employeeId, { tracked, days });
    return { tracked, days };
}

async function enrollFor(pool, analyzer, user, employeeId, body) {
    const a = await actor(pool, user); requireManage(a);
    await employeeExists(pool, employeeId);
    return withLock('face:' + employeeId, () => storeFace(pool, analyzer, { employeeId, frames: body?.frames, state: 'approved', by: a.id }));
}

// HR qaysi rasmni ko'rib tasdiqlagan bo'lsa, faqat o'sha namuna tasdiqlanadi (oraliqda almashtirilgan bo'lsa — 409).
async function reviewFace(db, analyzer, user, employeeId, decision, photoId) {
    const a = await actor(db, user); requireManage(a);
    const face = (await db.query('SELECT state,descriptors,photo_id FROM staff_att_faces WHERE employee_id=$1 FOR UPDATE', [employeeId])).rows[0];
    if (!face) throw error(404, 'Yuz namunasi topilmadi');
    if (face.state !== 'pending' || !photoId || face.photo_id !== photoId) throw error(409, 'Namuna o‘zgargan. Oynani yangilab qayta ko‘ring');
    if (decision === 'approve') {
        const other = await otherApprovedMatch(db, analyzer, employeeId, face.descriptors[0]);
        if (other) throw error(409, `Bu yuz boshqa xodimga (${other.name || other.employee_id}) biriktirilgan`);
    }
    const state = decision === 'approve' ? 'approved' : 'rejected';
    await db.query(`UPDATE staff_att_faces SET state=$2,reviewed_by=$3,reviewed_at=NOW(),updated_at=NOW(),
        first_approved_at=CASE WHEN $2='approved' THEN COALESCE(first_approved_at,NOW()) ELSE first_approved_at END,
        reset_at=CASE WHEN $2='approved' THEN NULL ELSE reset_at END WHERE employee_id=$1`, [employeeId, state, a.id]);
    await audit(db, a.id, 'face:' + state, employeeId, { photoId });
    return { state };
}

// Namuna o'chiriladi (rasmlar ham), lekin tarix saqlanadi — o'tgan kunlar holati o'zgarmaydi.
async function deleteFace(pool, user, employeeId) {
    const a = await actor(pool, user); requireManage(a);
    await transaction(pool, async db => {
        await db.query(`UPDATE staff_att_faces SET state='reset',descriptors='[]',photo_id=NULL,reviewed_by=$2,reviewed_at=NOW(),updated_at=NOW(),reset_at=NOW()
            WHERE employee_id=$1`, [employeeId, a.id]);
        await db.query("DELETE FROM staff_att_photos WHERE employee_id=$1 AND purpose='enroll'", [employeeId]);
        await audit(db, a.id, 'face:delete', employeeId);
    });
    return { deleted: true };
}

async function trackedList(db) {
    return (await db.query(`SELECT he.id,he.name,he.role FROM staff_att_schedules s JOIN hr_employees he ON he.id=s.employee_id
        WHERE s.tracked AND COALESCE(he.status,'active')<>'inactive' ORDER BY he.name`)).rows;
}

async function daily(db, user, date, now = new Date()) {
    const a = await actor(db, user); requireView(a);
    if (!t.isDate(date)) throw error(400, 'Sana noto‘g‘ri');
    const settings = await getSettings(db);
    const list = await trackedList(db);
    const ctx = await loadContext(db, list.map(e => e.id), date, date);
    const attempts = (await db.query(`SELECT id,employee_id,kind,occurred_at,ok,reason,distance_m,accuracy,location_method,face_distance,photo_id,lat,lng
        FROM staff_att_events WHERE work_date=$1 ORDER BY occurred_at`, [date])).rows;
    const rows = list.map(e => {
        const day = statusFor(ctx, e.id, date, settings, now);
        const mine = attempts.filter(x => x.employee_id === e.id);
        return { employeeId: e.id, name: e.name, role: e.role, ...day,
            attempts: mine.map(x => ({ id: x.id, kind: x.kind, at: x.occurred_at, clock: t.tashkentClock(x.occurred_at), ok: x.ok,
                reason: x.reason, message: x.ok ? '' : rules.reasonText(x.reason), distance: x.distance_m, accuracy: x.accuracy,
                method: x.location_method, faceDistance: x.face_distance, photoId: x.photo_id, lat: x.lat, lng: x.lng })),
            rejected: mine.filter(x => !x.ok).length };
    });
    await freeze(db, ctx);
    const summary = {};
    for (const r of rows) summary[r.status] = (summary[r.status] || 0) + 1;
    return { date, office: settings.office, rows, summary };
}

async function monthly(db, user, month, now = new Date()) {
    const a = await actor(db, user); requireView(a);
    if (!t.isMonth(month)) throw error(400, 'Oy noto‘g‘ri');
    const settings = await getSettings(db);
    const dates = t.monthDates(month);
    const list = await trackedList(db);
    const ctx = await loadContext(db, list.map(e => e.id), dates[0], dates[dates.length - 1]);
    const out = list.map(e => {
        const totals = { on_time: 0, late: 0, absent: 0, leave: 0, excused: 0, lateMinutes: 0, earlyMinutes: 0, workedMinutes: 0 };
        const days = dates.map(date => {
            const d = statusFor(ctx, e.id, date, settings, now);
            if (totals[d.status] != null) totals[d.status]++;
            if (d.status === 'present') totals.on_time++;
            totals.lateMinutes += d.lateMinutes; totals.earlyMinutes += d.earlyMinutes; totals.workedMinutes += d.workedMinutes;
            return { date, status: d.status, lateMinutes: d.lateMinutes, earlyMinutes: d.earlyMinutes, inClock: d.inClock, outClock: d.outClock };
        });
        return { employeeId: e.id, name: e.name, role: e.role, days, totals };
    });
    await freeze(db, ctx);
    return { month, dates, rows: out };
}

async function setOverride(db, user, body) {
    const a = await actor(db, user); requireManage(a);
    const { employeeId, date } = body || {};
    if (!t.isDate(date)) throw error(400, 'Sana noto‘g‘ri');
    await employeeExists(db, employeeId);
    if (body.status === null || body.status === '') {
        await db.query('DELETE FROM staff_att_overrides WHERE employee_id=$1 AND work_date=$2', [employeeId, date]);
        await audit(db, a.id, 'override:clear', employeeId, { date });
        return { cleared: true };
    }
    if (!['excused', 'present', 'absent', 'leave'].includes(body.status)) throw error(400, 'Holat noto‘g‘ri');
    const note = String(body.note || '').trim().slice(0, 300);
    await db.query(`INSERT INTO staff_att_overrides(employee_id,work_date,status,note,created_by) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(employee_id,work_date) DO UPDATE SET status=EXCLUDED.status,note=EXCLUDED.note,created_by=EXCLUDED.created_by,created_at=NOW()`,
        [employeeId, date, body.status, note, a.id]);
    await audit(db, a.id, 'override', employeeId, { date, status: body.status, note });
    return { status: body.status, note };
}

async function photo(db, user, id) {
    const a = await actor(db, user);
    const row = (await db.query('SELECT employee_id,mime,data FROM staff_att_photos WHERE id=$1', [String(id || '')])).rows[0];
    if (!row) throw error(404, 'Rasm topilmadi');
    if (!a.canView && (!a.employee_id || row.employee_id !== a.employee_id)) throw error(403, 'Ruxsat yo‘q');
    return row;
}

async function lessonReport(db, user, date, now = new Date()) {
    const a = await actor(db, user); requireView(a);
    return require('./lessons').report(db, date, now);
}

// Har 5 daqiqada: "kelmadi" va "erta ketdi" xabarlari, tugagan kunlarni muzlatish, eski rasmlarni tozalash.
async function tick(db, now = new Date()) {
    const settings = await getSettings(db);
    const date = t.tashkentDate(now);
    const nowMin = t.tashkentMinutes(now);
    const list = await trackedList(db);
    const yesterday = t.tashkentDate(new Date(now.getTime() - 86400000));
    const ctx = await loadContext(db, list.map(e => e.id), yesterday, date);
    let absent = 0;
    for (const e of list) {
        statusFor(ctx, e.id, yesterday, settings, now); // kechagi kun muzlatiladi
        const d = statusFor(ctx, e.id, date, settings, now);
        const who = { employeeId: e.id, name: e.name, date, status: d, settings };
        if (d.status === 'absent') { absent++; await notify.absent(db, who).catch(() => {}); }
        // Erta ketish xabari kun oxirida (ish tugagandan 1 soat keyin), oxirgi "ketdim" bo'yicha.
        const end = t.parseClock(d.end);
        if (d.earlyMinutes && end != null && nowMin >= Math.min(end + 60, 23 * 60 + 50)) await notify.earlyLeave(db, who).catch(() => {});
    }
    await freeze(db, ctx);
    const purged = (await db.query(`DELETE FROM staff_att_photos WHERE purpose='check' AND created_at < NOW() - ($1::int * INTERVAL '1 day')`,
        [settings.photoRetentionDays])).rowCount;
    // Yuz belgilari (biometrik) ham rasmlar bilan bir xil muddatda o'chiriladi.
    await db.query(`UPDATE staff_att_events SET descriptor=NULL,frame_hash=NULL WHERE descriptor IS NOT NULL
        AND occurred_at < NOW() - ($1::int * INTERVAL '1 day')`, [settings.photoRetentionDays]);
    // Ishdan ketgan (nofaol) xodimning yuz namunasi o'chiriladi; belgilash rasmlari (dalil) odatiy muddatda eskiradi.
    await db.query(`DELETE FROM staff_att_photos p USING hr_employees he WHERE he.id=p.employee_id AND he.status='inactive' AND p.purpose='enroll'`);
    await db.query(`UPDATE staff_att_faces f SET descriptors='[]',state='reset',photo_id=NULL,reset_at=NOW() FROM hr_employees he
        WHERE he.id=f.employee_id AND he.status='inactive' AND f.descriptors<>'[]'::jsonb`);
    await db.query(`UPDATE staff_att_events e SET descriptor=NULL,frame_hash=NULL FROM hr_employees he
        WHERE he.id=e.employee_id AND he.status='inactive' AND e.descriptor IS NOT NULL`);
    return { absent, purged };
}

module.exports = { initSchema, actor, getSettings, saveSettings, me, challenge, submitOwnFace, check, employees, saveSchedule,
    enrollFor, reviewFace, deleteFace, daily, monthly, setOverride, photo, tick, computeDay, lessonReport, transaction, ipAllowed,
    MAX_ATTEMPTS_PER_DAY, TEACHER_HR_ROLES, FRAME_W, FRAME_H };
