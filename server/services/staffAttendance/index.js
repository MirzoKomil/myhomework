'use strict';
// Xodimlar davomati: yuz (Face ID) + lokatsiya bilan kelish/ketish.
// Ustozlar bu oqimga kirmaydi — ular uchun lessons.js (avtomatik nazorat).
const { randomUUID } = require('crypto');
const rules = require('./rules');
const t = require('./time');
const notify = require('./notify');
const { dataUrlToBuffer } = require('./png');

const MANAGE_ROLES = new Set(['admin', 'boshliq', 'hr']);
const VIEW_ROLES = new Set(['admin', 'boshliq', 'hr', 'rop']);
const TEACHER_HR_ROLES = new Set(['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi', 'asosiy', 'yordamchi']);
const MAX_ATTEMPTS_PER_DAY = 12;
const MAX_JPEG_BYTES = 400 * 1024;
const MAX_PNG_BYTES = 2 * 1024 * 1024;

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
 state TEXT NOT NULL CHECK(state IN ('pending','approved','rejected')),
 submitted_by TEXT NOT NULL, reviewed_by TEXT, reviewed_at TIMESTAMPTZ, first_approved_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS staff_att_schedules (
 employee_id TEXT PRIMARY KEY, tracked BOOLEAN NOT NULL DEFAULT TRUE, days JSONB NOT NULL DEFAULT '{}',
 tracked_since DATE NOT NULL DEFAULT CURRENT_DATE,
 updated_by TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE staff_att_faces ADD COLUMN IF NOT EXISTS first_approved_at TIMESTAMPTZ;
ALTER TABLE staff_att_schedules ADD COLUMN IF NOT EXISTS tracked_since DATE NOT NULL DEFAULT CURRENT_DATE;
CREATE TABLE IF NOT EXISTS staff_att_events (
 id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, user_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('in','out')),
 work_date DATE NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 ok BOOLEAN NOT NULL, reason TEXT NOT NULL DEFAULT '',
 lat DOUBLE PRECISION, lng DOUBLE PRECISION, accuracy INTEGER, distance_m INTEGER,
 face_distance REAL, yaw_delta REAL, photo_id TEXT, ip TEXT NOT NULL DEFAULT '', user_agent TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS staff_att_events_day ON staff_att_events(work_date,employee_id);
CREATE TABLE IF NOT EXISTS staff_att_overrides (
 employee_id TEXT NOT NULL, work_date DATE NOT NULL, status TEXT NOT NULL CHECK(status IN ('excused','present','absent','leave')),
 note TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(employee_id,work_date)
);
CREATE TABLE IF NOT EXISTS staff_att_audit (
 id BIGSERIAL PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL,
 data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

function error(status, message) { return Object.assign(new Error(message), { status }); }

async function initSchema(db) {
    await db.query(SCHEMA);
    await require('./lessons').initSchema(db);
}

async function tableExists(db, name) {
    return !!(await db.query('SELECT to_regclass($1) AS t', ['public.' + name])).rows[0]?.t;
}

// Login akkaunti → xodim (hr_employees). Sotuv menejerlari uchun maxsus bog'lanish ham hisobga olinadi.
async function actor(db, user) {
    const linkTable = await tableExists(db, 'user_sales_manager_links');
    const { rows } = await db.query(`SELECT u.id,u.name,u.email,u.role,he.id AS employee_id,he.name AS employee_name,
        he.role AS employee_role,he.status AS employee_status
        FROM users u LEFT JOIN hr_employees he ON ${linkTable
        ? `he.id=COALESCE((SELECT manager_id FROM user_sales_manager_links l WHERE l.user_id=u.id LIMIT 1),
            (SELECT id FROM hr_employees x WHERE LOWER(TRIM(x.login))=LOWER(TRIM(u.email)) LIMIT 1))`
        : 'LOWER(TRIM(he.login))=LOWER(TRIM(u.email))'}
        WHERE u.id=$1 LIMIT 1`, [user?.id]);
    const row = rows[0];
    if (!row) throw error(401, 'Akkaunt topilmadi');
    return { ...row, canManage: MANAGE_ROLES.has(row.role), canView: VIEW_ROLES.has(row.role) };
}

function requireView(a) { if (!a.canView) throw error(403, 'Davomat bo‘limiga ruxsat yo‘q'); }
function requireManage(a) { if (!a.canManage) throw error(403, 'Faqat HR yoki rahbar o‘zgartira oladi'); }

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

function jpegBuffer(dataUrl) {
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) throw error(400, 'Rasm (JPEG) yuborilmadi');
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length < 1000 || buf.length > MAX_JPEG_BYTES || buf[0] !== 0xff || buf[1] !== 0xd8) throw error(400, 'Rasm hajmi yoki formati noto‘g‘ri');
    return buf;
}

function pngBuffer(dataUrl) {
    let buf;
    try { buf = dataUrlToBuffer(dataUrl); } catch (e) { throw error(400, e.message); }
    if (buf.length > MAX_PNG_BYTES) throw error(400, 'Rasm juda katta');
    return buf;
}

async function savePhoto(db, employeeId, purpose, jpeg) {
    const id = randomUUID();
    await db.query('INSERT INTO staff_att_photos(id,employee_id,purpose,mime,data) VALUES($1,$2,$3,$4,$5)',
        [id, employeeId, purpose, 'image/jpeg', jpeg]);
    return id;
}

async function analyzeSafe(analyzer, png, opts) {
    try { return await analyzer.analyze(png, opts); }
    catch (e) {
        if (e.status) throw e;
        if (/PNG/.test(e.message)) throw error(400, 'Rasm formati noto‘g‘ri');
        console.error('[staff-attendance] yuz tahlili xatosi:', e.message);
        throw error(503, 'Yuzni tekshirib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring');
    }
}

// Namuna: 2-3 ta to'g'ri qaragan kadr. Hammasida bitta yuz va bir-biriga mos bo'lishi shart.
async function buildDescriptors(db, analyzer, employeeId, frames, revealName = false) {
    if (!Array.isArray(frames) || frames.length < 2 || frames.length > 3) throw error(400, '2 yoki 3 ta rasm kerak');
    const descriptors = [];
    for (const f of frames) {
        const r = await analyzeSafe(analyzer, pngBuffer(f));
        if (r.faces !== 1) throw error(422, rules.reasonText(r.faces > 1 ? 'many_faces' : 'no_face'));
        descriptors.push(r.descriptor);
    }
    for (let i = 0; i < descriptors.length; i++) for (let j = i + 1; j < descriptors.length; j++) {
        if (analyzer.distance(descriptors[i], descriptors[j]) > analyzer.MATCH_THRESHOLD) {
            throw error(422, 'Rasmlar bir-biriga mos kelmadi. Yorug‘ joyda, to‘g‘ri qarab qayta oling');
        }
    }
    // Bitta odam ikki xodim nomidan belgilay olmasligi uchun.
    const others = (await db.query("SELECT f.employee_id,f.descriptors,he.name FROM staff_att_faces f LEFT JOIN hr_employees he ON he.id=f.employee_id WHERE f.state='approved' AND f.employee_id<>$1", [employeeId])).rows;
    for (const o of others) {
        if (analyzer.bestDistance(descriptors[0], o.descriptors) <= analyzer.MATCH_THRESHOLD) {
            // Xodimning o'ziga boshqa xodim ismi ko'rsatilmaydi — faqat HR'ga.
            throw error(409, revealName ? `Bu yuz boshqa xodimga (${o.name || o.employee_id}) biriktirilgan`
                : 'Bu yuz boshqa xodimga biriktirilgan. HR bilan bog‘laning');
        }
    }
    return descriptors;
}

async function storeFace(db, analyzer, { employeeId, frames, photo, state, by }) {
    const descriptors = await buildDescriptors(db, analyzer, employeeId, frames, state === 'approved');
    const photoId = await savePhoto(db, employeeId, 'enroll', jpegBuffer(photo));
    const approved = state === 'approved';
    await db.query(`INSERT INTO staff_att_faces(employee_id,descriptors,photo_id,state,submitted_by,reviewed_by,reviewed_at,first_approved_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT(employee_id) DO UPDATE SET descriptors=EXCLUDED.descriptors,photo_id=EXCLUDED.photo_id,
        state=EXCLUDED.state,submitted_by=EXCLUDED.submitted_by,reviewed_by=EXCLUDED.reviewed_by,reviewed_at=EXCLUDED.reviewed_at,updated_at=NOW(),
        first_approved_at=COALESCE(staff_att_faces.first_approved_at,EXCLUDED.first_approved_at)`,
        [employeeId, JSON.stringify(descriptors), photoId, state, by, approved ? by : null, approved ? new Date() : null]);
    await audit(db, by, 'face:' + state, employeeId, { photoId });
    return { state, photoId };
}

async function scheduleFor(db, employeeId) {
    const row = (await db.query("SELECT tracked,days,TO_CHAR(tracked_since,'YYYY-MM-DD') AS since FROM staff_att_schedules WHERE employee_id=$1", [employeeId])).rows[0];
    return row ? { tracked: row.tracked, days: row.days || {}, since: row.since } : null;
}

async function leaveOn(db, employeeId, date) {
    if (!(await tableExists(db, 'domwork_bot_leave_requests'))) return false;
    return !!(await db.query(`SELECT 1 FROM domwork_bot_leave_requests WHERE employee_id=$1 AND state='approved'
        AND start_date<=$2::date AND end_date>=$2::date LIMIT 1`, [employeeId, date])).rows[0];
}

async function computeDay(db, employeeId, date, settings, now = new Date()) {
    const schedule = await scheduleFor(db, employeeId);
    const events = (await db.query('SELECT kind,occurred_at FROM staff_att_events WHERE employee_id=$1 AND work_date=$2 AND ok ORDER BY occurred_at', [employeeId, date])).rows;
    const override = (await db.query('SELECT status,note FROM staff_att_overrides WHERE employee_id=$1 AND work_date=$2', [employeeId, date])).rows[0] || null;
    const day = schedule?.tracked ? schedule.days[String(t.weekday(date))] || null : null;
    const face = (await db.query("SELECT state,first_approved_at FROM staff_att_faces WHERE employee_id=$1", [employeeId])).rows[0];
    const approvedOn = face?.state === 'approved' && face.first_approved_at ? t.tashkentDate(face.first_approved_at) : null;
    const countFrom = approvedOn ? [approvedOn, schedule?.since || approvedOn].sort().pop() : null;
    return rules.dayStatus({ date, today: t.tashkentDate(now), nowMinutes: t.tashkentMinutes(now), day, settings,
        events, leave: await leaveOn(db, employeeId, date), override, countFrom });
}

// ── Xodimning o'z kabineti ────────────────────────────────────────────────────

async function me(db, user, now = new Date()) {
    const a = await actor(db, user);
    const base = { name: a.name, employeeId: a.employee_id || null };
    if (!a.employee_id) return { ...base, tracked: false, reason: 'no_employee' };
    const schedule = await scheduleFor(db, a.employee_id);
    if (!schedule?.tracked) return { ...base, tracked: false, reason: 'not_tracked' };
    const settings = await getSettings(db);
    const face = (await db.query('SELECT state,updated_at FROM staff_att_faces WHERE employee_id=$1', [a.employee_id])).rows[0];
    const date = t.tashkentDate(now);
    const today = await computeDay(db, a.employee_id, date, settings, now);
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS_PER_DAY - Number((await db.query(
        'SELECT COUNT(*)::int AS n FROM staff_att_events WHERE employee_id=$1 AND work_date=$2', [a.employee_id, date])).rows[0].n));
    return { ...base, tracked: true, face: face ? face.state : 'none', today, days: schedule.days,
        office: { name: settings.office.name, radius: settings.office.radius }, attemptsLeft,
        nextAction: today.inAt ? 'out' : 'in' };
}

async function submitOwnFace(db, analyzer, user, body) {
    const a = await actor(db, user);
    if (!a.employee_id) throw error(403, 'Siz HR ro‘yxatida xodim sifatida topilmadingiz');
    const current = (await db.query('SELECT state FROM staff_att_faces WHERE employee_id=$1', [a.employee_id])).rows[0];
    if (current?.state === 'approved') throw error(409, 'Yuz namunangiz allaqachon tasdiqlangan. O‘zgartirish uchun HR’ga murojaat qiling');
    const result = await storeFace(db, analyzer, { employeeId: a.employee_id, frames: body?.frames, photo: body?.photo, state: 'pending', by: a.id });
    await notify.facePending(db, { employeeId: a.employee_id, name: a.employee_name || a.name });
    return result;
}

async function transaction(pool, fn) {
    if (typeof pool.connect !== 'function') return fn(pool); // testlarda tayyor client berilishi mumkin
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

function guardOrder(prior, kind) {
    if (prior.length >= MAX_ATTEMPTS_PER_DAY) throw error(429, 'Bugungi urinishlar soni tugadi. HR bilan bog‘laning');
    const okIn = prior.find(e => e.ok && e.kind === 'in');
    if (kind === 'in' && okIn) throw error(409, `Bugun kelish allaqachon belgilangan (${t.tashkentClock(okIn.occurred_at)})`);
    if (kind === 'out' && !okIn) throw error(409, 'Avval kelishni belgilang');
}

async function priorEvents(db, employeeId, date) {
    return (await db.query('SELECT kind,ok,occurred_at FROM staff_att_events WHERE employee_id=$1 AND work_date=$2 ORDER BY occurred_at', [employeeId, date])).rows;
}

// Yuz tahlili (bir necha soniya) tranzaksiyadan TASHQARIDA bajariladi, yozish esa
// xodim bo'yicha qulf ostida qayta tekshirib amalga oshiriladi.
async function check(pool, analyzer, user, body, meta = {}) {
    const a = await actor(pool, user);
    if (!a.employee_id) throw error(403, 'Siz HR ro‘yxatida xodim sifatida topilmadingiz');
    const schedule = await scheduleFor(pool, a.employee_id);
    if (!schedule?.tracked) throw error(403, 'Sizga davomat belgilash yoqilmagan');
    const kind = body?.kind === 'out' ? 'out' : body?.kind === 'in' ? 'in' : null;
    if (!kind) throw error(400, 'Amal turi noto‘g‘ri');
    const now = meta.now || new Date();
    const date = t.tashkentDate(now);
    const settings = await getSettings(pool);
    guardOrder(await priorEvents(pool, a.employee_id, date), kind);

    const face = (await pool.query("SELECT descriptors FROM staff_att_faces WHERE employee_id=$1 AND state='approved'", [a.employee_id])).rows[0];
    if (!face) throw error(409, rules.reasonText('no_face_profile'));

    const loc = rules.checkLocation(settings, body?.location);
    const lat = Number(body?.location?.lat), lng = Number(body?.location?.lng);
    const record = { lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null,
        accuracy: loc.accuracy ?? null, distance: loc.distance ?? null, faceDistance: null, yawDelta: null };
    const frontPng = pngBuffer(body?.frame), turnedPng = pngBuffer(body?.turned);
    const jpeg = jpegBuffer(body?.photo);

    let reason = loc.ok ? '' : loc.reason;
    let front = null;
    if (!reason) {
        front = await analyzeSafe(analyzer, frontPng);
        if (front.faces !== 1) reason = front.faces > 1 ? 'many_faces' : 'no_face';
    }
    if (!reason) {
        record.faceDistance = analyzer.bestDistance(front.descriptor, face.descriptors);
        if (!(record.faceDistance <= analyzer.MATCH_THRESHOLD)) reason = 'mismatch';
    }
    if (!reason) {
        const turned = await analyzeSafe(analyzer, turnedPng, { descriptor: false });
        const live = rules.checkLiveness(front, turned);
        record.yawDelta = Number.isFinite(live.yawDelta) ? live.yawDelta : null;
        if (!live.ok) reason = live.reason;
    }

    const id = randomUUID();
    const status = await transaction(pool, async db => {
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['staff_att:' + a.employee_id]);
        if (!reason) guardOrder(await priorEvents(db, a.employee_id, date), kind); // parallel so'rov himoyasi
        // Rasm faqat ofis hududidagi urinishlarda saqlanadi.
        const photoId = loc.ok ? await savePhoto(db, a.employee_id, 'check', jpeg) : null;
        await db.query(`INSERT INTO staff_att_events(id,employee_id,user_id,kind,work_date,occurred_at,ok,reason,lat,lng,accuracy,distance_m,face_distance,yaw_delta,photo_id,ip,user_agent)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
            [id, a.employee_id, a.id, kind, date, now, !reason, reason, record.lat, record.lng, record.accuracy, record.distance,
                Number.isFinite(record.faceDistance) ? record.faceDistance : null, record.yawDelta, photoId,
                String(meta.ip || '').slice(0, 64), String(meta.userAgent || '').slice(0, 300)]);
        if (reason) {
            if (reason === 'mismatch') await notify.mismatch(db, { employeeId: a.employee_id, name: a.employee_name || a.name, date, at: now, settings });
            return null;
        }
        // Telegram botdagi "Ish jadvali / Face ID" menyusi shu jadvalni o'qiydi.
        if (await tableExists(db, 'domwork_bot_face_logs')) {
            await db.query('INSERT INTO domwork_bot_face_logs(event_id,employee_id,kind,occurred_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
                [id, a.employee_id, kind, now]);
        }
        const day = await computeDay(db, a.employee_id, date, settings, now);
        const who = { employeeId: a.employee_id, name: a.employee_name || a.name, date, status: day, settings };
        if (kind === 'in' && day.status === 'late') await notify.late(db, who);
        if (kind === 'out' && day.earlyMinutes) await notify.earlyLeave(db, who);
        return day;
    });
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

async function enrollFor(db, analyzer, user, employeeId, body) {
    const a = await actor(db, user); requireManage(a);
    await employeeExists(db, employeeId);
    return storeFace(db, analyzer, { employeeId, frames: body?.frames, photo: body?.photo, state: 'approved', by: a.id });
}

async function reviewFace(db, analyzer, user, employeeId, decision) {
    const a = await actor(db, user); requireManage(a);
    const face = (await db.query('SELECT state,descriptors FROM staff_att_faces WHERE employee_id=$1 FOR UPDATE', [employeeId])).rows[0];
    if (!face) throw error(404, 'Yuz namunasi topilmadi');
    if (decision === 'approve') {
        const others = (await db.query("SELECT f.employee_id,f.descriptors,he.name FROM staff_att_faces f LEFT JOIN hr_employees he ON he.id=f.employee_id WHERE f.state='approved' AND f.employee_id<>$1", [employeeId])).rows;
        for (const o of others) if (analyzer.bestDistance(face.descriptors[0], o.descriptors) <= analyzer.MATCH_THRESHOLD) {
            throw error(409, `Bu yuz boshqa xodimga (${o.name || o.employee_id}) biriktirilgan`);
        }
    }
    const state = decision === 'approve' ? 'approved' : 'rejected';
    await db.query(`UPDATE staff_att_faces SET state=$2,reviewed_by=$3,reviewed_at=NOW(),updated_at=NOW(),
        first_approved_at=CASE WHEN $2='approved' THEN COALESCE(first_approved_at,NOW()) ELSE first_approved_at END WHERE employee_id=$1`, [employeeId, state, a.id]);
    await audit(db, a.id, 'face:' + state, employeeId);
    return { state };
}

async function deleteFace(db, user, employeeId) {
    const a = await actor(db, user); requireManage(a);
    await db.query('DELETE FROM staff_att_faces WHERE employee_id=$1', [employeeId]);
    await audit(db, a.id, 'face:delete', employeeId);
    return { deleted: true };
}

async function daily(db, user, date, now = new Date()) {
    const a = await actor(db, user); requireView(a);
    if (!t.isDate(date)) throw error(400, 'Sana noto‘g‘ri');
    const settings = await getSettings(db);
    const list = (await db.query(`SELECT he.id,he.name,he.role FROM staff_att_schedules s JOIN hr_employees he ON he.id=s.employee_id
        WHERE s.tracked AND COALESCE(he.status,'active')<>'inactive' ORDER BY he.name`)).rows;
    const attempts = (await db.query(`SELECT id,employee_id,kind,occurred_at,ok,reason,distance_m,accuracy,face_distance,photo_id,lat,lng
        FROM staff_att_events WHERE work_date=$1 ORDER BY occurred_at`, [date])).rows;
    const rows = [];
    for (const e of list) {
        const day = await computeDay(db, e.id, date, settings, now);
        const mine = attempts.filter(x => x.employee_id === e.id);
        rows.push({ employeeId: e.id, name: e.name, role: e.role, ...day,
            attempts: mine.map(x => ({ id: x.id, kind: x.kind, at: x.occurred_at, clock: t.tashkentClock(x.occurred_at), ok: x.ok,
                reason: x.reason, message: x.ok ? '' : rules.reasonText(x.reason), distance: x.distance_m, accuracy: x.accuracy,
                faceDistance: x.face_distance, photoId: x.photo_id, lat: x.lat, lng: x.lng })),
            rejected: mine.filter(x => !x.ok).length });
    }
    const summary = {};
    for (const r of rows) summary[r.status] = (summary[r.status] || 0) + 1;
    return { date, office: settings.office, rows, summary };
}

async function monthly(db, user, month, now = new Date()) {
    const a = await actor(db, user); requireView(a);
    if (!t.isMonth(month)) throw error(400, 'Oy noto‘g‘ri');
    const settings = await getSettings(db);
    const dates = t.monthDates(month);
    const list = (await db.query(`SELECT he.id,he.name,he.role FROM staff_att_schedules s JOIN hr_employees he ON he.id=s.employee_id
        WHERE s.tracked AND COALESCE(he.status,'active')<>'inactive' ORDER BY he.name`)).rows;
    const out = [];
    for (const e of list) {
        const days = [];
        const totals = { on_time: 0, late: 0, absent: 0, leave: 0, excused: 0, lateMinutes: 0, earlyMinutes: 0, workedMinutes: 0 };
        for (const date of dates) {
            const d = await computeDay(db, e.id, date, settings, now);
            days.push({ date, status: d.status, lateMinutes: d.lateMinutes, earlyMinutes: d.earlyMinutes, inClock: d.inClock, outClock: d.outClock });
            if (totals[d.status] != null) totals[d.status]++;
            if (d.status === 'present') totals.on_time++;
            totals.lateMinutes += d.lateMinutes; totals.earlyMinutes += d.earlyMinutes; totals.workedMinutes += d.workedMinutes;
        }
        out.push({ employeeId: e.id, name: e.name, role: e.role, days, totals });
    }
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
    if (!a.canView && row.employee_id !== a.employee_id) throw error(403, 'Ruxsat yo‘q');
    return row;
}

async function lessonReport(db, user, date, now = new Date()) {
    const a = await actor(db, user); requireView(a);
    return require('./lessons').report(db, date, now);
}

// Har 5 daqiqada: "kelmadi" xabarlari va eski rasmlarni tozalash.
async function tick(db, now = new Date()) {
    const settings = await getSettings(db);
    const date = t.tashkentDate(now);
    const list = (await db.query(`SELECT he.id,he.name FROM staff_att_schedules s JOIN hr_employees he ON he.id=s.employee_id
        WHERE s.tracked AND COALESCE(he.status,'active')<>'inactive'`)).rows;
    let absent = 0;
    for (const e of list) {
        const d = await computeDay(db, e.id, date, settings, now);
        if (d.status === 'absent') { absent++; await notify.absent(db, { employeeId: e.id, name: e.name, date, status: d, settings }); }
    }
    const purged = (await db.query(`DELETE FROM staff_att_photos WHERE purpose='check' AND created_at < NOW() - ($1::int * INTERVAL '1 day')`,
        [settings.photoRetentionDays])).rowCount;
    return { absent, purged };
}

module.exports = { initSchema, actor, getSettings, saveSettings, me, submitOwnFace, check, employees, saveSchedule,
    enrollFor, reviewFace, deleteFace, daily, monthly, setOverride, photo, tick, computeDay, lessonReport, transaction,
    MAX_ATTEMPTS_PER_DAY, TEACHER_HR_ROLES };
