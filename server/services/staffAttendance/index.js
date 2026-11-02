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
-- Javob so'rash (kech qolaman / kelmayman / erta ketaman) va "Ofisda emasman" — tasdiqlovchi: ROP, akademik rahbar yoki admin.
CREATE TABLE IF NOT EXISTS staff_att_requests (
 id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, user_id TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('late','absent','early_leave','outside')),
 work_date DATE NOT NULL, at_time TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL, comment TEXT NOT NULL DEFAULT '',
 approver_kind TEXT NOT NULL CHECK(approver_kind IN ('rop','academic','admin')), lang TEXT,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected','cancelled')),
 decided_by TEXT, decided_at TIMESTAMPTZ, decision_reason TEXT NOT NULL DEFAULT '', decision_note TEXT NOT NULL DEFAULT '',
 event_id TEXT, distance_m INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS staff_att_requests_emp ON staff_att_requests(employee_id,work_date);
CREATE INDEX IF NOT EXISTS staff_att_requests_inbox ON staff_att_requests(state,approver_kind,created_at);
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

// Ishdan ketgan xodim: status 'inactive' yoki Arxiv/ishdan bo'shatish (offboarded_at) belgilangan.
let offboardColumn = null;
async function goneSql(db, alias = 'he') {
    if (offboardColumn === null) {
        offboardColumn = !!(await db.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public'
            AND table_name='hr_employees' AND column_name='offboarded_at'`)).rows[0];
    }
    const a = alias ? alias + '.' : '';
    return `(COALESCE(${a}status,'active')='inactive'${offboardColumn ? ` OR ${a}offboarded_at IS NOT NULL` : ''})`;
}

async function tableExists(db, name) {
    return !!(await db.query('SELECT to_regclass($1) AS t', ['public.' + name])).rows[0]?.t;
}

// pool o'rniga allaqachon ochiq tranzaksiyadagi client berilsa (masalan bot navbati — domworkBot/queue.js),
// ichma-ich BEGIN/COMMIT qilinmaydi va qayta connect() chaqirilmaydi.
function isClient(db) { return typeof db.release === 'function' || typeof db.connect !== 'function' || !!db.domworkAfterCommit; }
async function transaction(pool, fn) {
    if (isClient(pool)) return fn(pool);
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
        employees = (await db.query(`SELECT he.id,he.name,he.role,he.lang FROM user_sales_manager_links l JOIN hr_employees he ON he.id=l.manager_id
            WHERE l.user_id=$1`, [row.id])).rows;
    }
    if (!employees.length && String(row.email || '').trim()) {
        employees = (await db.query(`SELECT id,name,role,lang FROM hr_employees WHERE COALESCE(TRIM(login),'')<>''
            AND LOWER(TRIM(login))=LOWER(TRIM($1)) AND NOT ${await goneSql(db, '')}`, [row.email])).rows;
    }
    const emp = employees.length === 1 ? employees[0] : null;
    return { ...row, employee_id: emp?.id || null, employee_name: emp?.name || null, employee_role: emp?.role || null, employee_lang: emp?.lang || null,
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
        // "Ofisda emasman" belgisi so'rov rad etilsa/bekor qilinsa hisobga olinmaydi (odatdagi qoida).
        q(`SELECT e.employee_id,TO_CHAR(e.work_date,'YYYY-MM-DD') AS d,e.kind,e.occurred_at,e.location_method FROM staff_att_events e
            WHERE e.ok AND e.employee_id=ANY($1::text[]) AND e.work_date BETWEEN $2 AND $3
            AND NOT (e.location_method='outside' AND EXISTS(SELECT 1 FROM staff_att_requests r WHERE r.event_id=e.id AND r.state IN ('rejected','cancelled')))
            ORDER BY e.occurred_at`, [ids, from, to]),
        q(`SELECT employee_id,TO_CHAR(work_date,'YYYY-MM-DD') AS d,status,note FROM staff_att_overrides
            WHERE employee_id=ANY($1::text[]) AND work_date BETWEEN $2 AND $3`, [ids, from, to]),
        q(`SELECT employee_id,TO_CHAR(work_date,'YYYY-MM-DD') AS d,data FROM staff_att_day_results
            WHERE employee_id=ANY($1::text[]) AND work_date BETWEEN $2 AND $3`, [ids, from, to]),
    ]);
    const requests = await q(`SELECT id,employee_id,TO_CHAR(work_date,'YYYY-MM-DD') AS d,type,at_time AS time,reason,state FROM staff_att_requests
        WHERE state IN ('pending','approved') AND employee_id=ANY($1::text[]) AND work_date BETWEEN $2 AND $3`, [ids, from, to]);
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
        requests: requests.reduce((m, r) => { const k = key(r.employee_id, r.d); if (!m.has(k)) m.set(k, []); m.get(k).push(r); return m; }, new Map()),
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
    // Javob so'rovi (kutilmoqda / tasdiqlangan) — muzlatilgan natija ustidan, HR tuzatishidan oldin.
    if (ctx.requests?.has(k)) {
        const officeIn = (ctx.events.get(k) || []).some(e => e.kind === 'in' && e.location_method !== 'outside');
        base = rules.applyRequests(base, ctx.requests.get(k), settings, { isToday: date === today, nowMinutes: t.tashkentMinutes(now) }, { officeIn });
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
    const scope = await scopeFor(db, a);
    if (scope) base.approver = { kind: scope.kind, pending: await pendingCount(db, scope) };
    if (!a.employee_id) return { ...base, tracked: false, reason: 'no_employee' };
    if (!rules.roleTracked({ userRole: a.role, empRole: a.employee_role })) return { ...base, tracked: false, reason: 'role' };
    const schedule = await scheduleFor(db, a.employee_id);
    if (!schedule?.tracked) return { ...base, tracked: false, reason: 'not_tracked' };
    const settings = await getSettings(db);
    const face = (await db.query('SELECT state FROM staff_att_faces WHERE employee_id=$1', [a.employee_id])).rows[0];
    const date = t.tashkentDate(now);
    const today = await computeDay(db, a.employee_id, date, settings, now);
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS_PER_DAY - Number((await db.query(
        'SELECT COUNT(*)::int AS n FROM staff_att_events WHERE employee_id=$1 AND work_date=$2', [a.employee_id, date])).rows[0].n));
    const requests = (await db.query(`SELECT id,type,at_time AS time,reason,state,decided_by FROM staff_att_requests
        WHERE employee_id=$1 AND work_date=$2 AND state IN ('pending','approved')`, [a.employee_id, date])).rows;
    const day = (schedule.days || {})[String(t.weekday(date))] || null;
    const ph = rules.phase({ nowMinutes: t.tashkentMinutes(now), day, inClock: today.inClock, outClock: today.outClock, requests });
    const lateReq = requests.find(r => r.type === 'late' && r.state === 'approved');
    const decider = lateReq?.decided_by ? (await db.query('SELECT name FROM users WHERE id=$1', [lateReq.decided_by])).rows[0]?.name : '';
    return { ...base, tracked: true, kind: rules.staffKind({ userRole: a.role, empRole: a.employee_role }),
        face: face ? face.state : 'none', today, days: schedule.days, date, nowClock: t.tashkentClock(now), serverNow: now.toISOString(),
        office: { name: settings.office.name, radius: settings.office.radius, lat: settings.office.lat, lng: settings.office.lng }, attemptsLeft, photoDays: settings.photoRetentionDays,
        nextAction: today.inAt ? 'out' : 'in', ...ph, requests: requests.map(({ decided_by, ...r }) => r),
        lateApproval: lateReq ? { time: lateReq.time, reason: lateReq.reason, by: decider || '' } : null,
        approverName: await approverLabel(db, await effectiveRoute(db, a)) };
}

// Har urinishdan oldin server tasodifiy yo'nalish beradi (chapga/o'ngga) — bir martalik, 2 daqiqa.
async function challenge(db, user, now = new Date()) {
    const a = await actor(db, user); requireEmployee(a); requireTrackedRole(a);
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
    // "Ofisda emasman" bilan belgilangan kelish keyin ofisga kelib odatdagidek belgilashga to'sqinlik qilmaydi.
    const okIn = prior.find(e => e.ok && e.kind === 'in' && e.location_method !== 'outside');
    if (kind === 'in' && okIn) throw error(409, `Bugun kelish allaqachon belgilangan (${t.tashkentClock(okIn.occurred_at)})`);
    if (kind === 'out' && !prior.some(e => e.ok && e.kind === 'in')) throw error(409, 'Avval kelishni belgilang');
    if (kind === 'outside' && prior.some(e => e.ok && e.kind === 'in')) throw error(409, 'Bugun kelish allaqachon belgilangan');
}

async function priorEvents(db, employeeId, date) {
    return (await db.query('SELECT kind,ok,occurred_at,location_method FROM staff_att_events WHERE employee_id=$1 AND work_date=$2 ORDER BY occurred_at', [employeeId, date])).rows;
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
function requireTrackedRole(a) {
    if (!rules.roleTracked({ userRole: a.role, empRole: a.employee_role })) throw error(403, rules.reasonText('not_tracked_role'));
}

async function check(pool, analyzer, user, body, meta = {}) {
    const a = await actor(pool, user); requireEmployee(a); requireTrackedRole(a);
    const schedule = await scheduleFor(pool, a.employee_id);
    if (!schedule?.tracked) throw error(403, 'Sizga davomat belgilash yoqilmagan');
    const kind = body?.kind === 'out' ? 'out' : body?.kind === 'in' ? 'in' : null;
    if (!kind) throw error(400, 'Amal turi noto‘g‘ri');
    // "Ofisda emasman": faqat kelishda, sabab majburiy; selfie baribir tekshiriladi.
    if (body?.outside) {
        if (kind !== 'in') throw error(400, '“Ofisda emasman” faqat kelishda belgilanadi');
        if (!String(body.outside.reason || '').trim()) throw error(400, 'Sababni tanlang');
    }
    return withLock('check:' + a.employee_id, () => checkLocked(pool, analyzer, a, kind, body, meta));
}

async function checkLocked(pool, analyzer, a, kind, body, meta) {
    const now = meta.now || new Date();
    const date = t.tashkentDate(now);
    const settings = await getSettings(pool);
    guardOrder(await priorEvents(pool, a.employee_id, date), body?.outside ? 'outside' : kind);
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
    const outside = !!body?.outside && !gps.ok && !viaIp;
    const locOk = gps.ok || viaIp || outside;
    const lat = Number(body?.location?.lat), lng = Number(body?.location?.lng);
    // Ofisdan tashqaridagi urinishda aniq koordinata saqlanmaydi (bu ko'pincha uy manzili) — faqat masofa.
    const record = { lat: (gps.ok || viaIp) && Number.isFinite(lat) ? lat : null, lng: (gps.ok || viaIp) && Number.isFinite(lng) ? lng : null,
        accuracy: gps.accuracy ?? null, distance: gps.distance ?? null, method: gps.ok ? 'gps' : viaIp ? 'ip' : outside ? 'outside' : '',
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
        guardOrder(await priorEvents(db, a.employee_id, date), reason ? null : outside ? 'outside' : kind);
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
        if (!outside && kind === 'in') {
            // Ofisga keldi — kutilayotgan "Ofisda emasman" endi kerak emas (kun odatdagi qoida bo'yicha).
            const c = await db.query(`UPDATE staff_att_requests SET state='cancelled',decided_at=NOW(),decision_note='Ofisga kelib belgiladi'
                WHERE employee_id=$1 AND work_date=$2 AND type='outside' AND state='pending' RETURNING id`, [a.employee_id, date]);
            if (c.rowCount) await audit(db, a.id, 'request:auto-cancel', a.employee_id, { ids: c.rows.map(x => x.id) });
        }
        if (outside) {
            const requestId = randomUUID();
            const route = await effectiveRoute(db, a);
            await db.query(`INSERT INTO staff_att_requests(id,employee_id,user_id,type,work_date,at_time,reason,comment,approver_kind,lang,event_id,distance_m)
                VALUES($1,$2,$3,'outside',$4,$5,$6,$7,$8,$9,$10,$11)`, [requestId, a.employee_id, a.id, date, t.tashkentClock(now),
                String(body.outside.reason).trim().slice(0, 80), String(body.outside.comment || '').trim().slice(0, 500), route.kind, route.lang, id, record.distance]);
            await audit(db, a.id, 'request:create', a.employee_id, { id: requestId, type: 'outside' });
            after.push(() => notifyRequest(pool, requestId));
        }
        const day = await computeDay(db, a.employee_id, date, settings, now);
        if (kind === 'in' && day.status === 'late') after.push(async () => notify.late(pool, { ...who, status: day,
            userIds: (await approverUsers(pool, routeFor(a))).map(u => String(u.id)) }));
        return day;
    });
    // Xabarlar faqat yozuv saqlangandan keyin; xato bo'lsa ham belgilash bekor bo'lmaydi.
    for (const fn of after) await fn().catch(e => console.error('[staff-attendance] xabar xatosi:', e.message));
    if (reason) return { ok: false, reason, message: rules.reasonText(reason), distance: record.distance };
    const extra = kind === 'in' ? await streakInfo(pool, a.employee_id, now, settings).catch(() => ({})) : {};
    return { ok: true, kind, at: now, clock: t.tashkentClock(now), today: status, outside, distance: record.distance,
        faceScore: Number.isFinite(record.faceDistance) ? Math.max(0, Math.min(100, Math.round((1 - record.faceDistance) * 100))) : null, ...extra };
}

// ── Javob so'rash, tasdiqlash va jamoa davomati (Jamoa ilovasi) ──────────────
const teacherRoles = require('../../../js/teacherRoles');
const ROLE_TEXT = { sales: 'Sotuv menejeri', rop: 'ROP', hr: 'HR', academic: 'Akademik rahbar', assistant: 'Yordamchi ustoz', admin: 'Direktor', other: 'Xodim' };
const APPROVER_TEXT = { rop: 'ROP', academic: 'Akademik rahbar', admin: 'Direktor' };

// Xodimning til yo'nalishi: 'english' | 'russian' | 'both' | null.
function empLang(emp) {
    if (!emp) return null;
    if (teacherRoles.isAssistant(emp) || teacherRoles.isMain(emp)) return teacherRoles.language(emp);
    const l = String(emp.lang || '').toLowerCase();
    return ['english', 'russian', 'both'].includes(l) ? l : null;
}
const langsOf = l => (l === 'both' ? ['english', 'russian'] : l === 'english' || l === 'russian' ? [l] : null);

// So'rov kimga boradi (xodimning o'zi uchun).
function routeFor(a) {
    const kind = rules.approverKind({ userRole: a.role, empRole: a.employee_role });
    const lang = empLang({ role: a.employee_role, lang: a.employee_lang });
    return { kind, lang: kind === 'admin' || lang === 'both' ? null : lang };
}

// Tasdiqlovchi doirasi (ROP — o'z tilidagi sotuv, akademik rahbar — o'z tilidagi yordamchilar, admin — hammasi).
async function scopeFor(db, a) {
    const langs = langsOf(empLang({ role: a.employee_role, lang: a.employee_lang }));
    return rules.approverScope({ userRole: a.role, empRole: a.employee_role, langs });
}

async function trackedRows(db) {
    return (await db.query(`SELECT he.id,he.name,he.role,he.lang FROM staff_att_schedules s JOIN hr_employees he ON he.id=s.employee_id
        WHERE s.tracked AND NOT ${await goneSql(db)} ORDER BY he.name`)).rows;
}
function inScope(scope, row) {
    if (!scope) return false;
    const kind = rules.staffKind({ empRole: row.role });
    if (!rules.roleTracked({ empRole: row.role })) return false;
    if (scope.kind === 'admin') return true;
    if (scope.kind === 'rop' && kind !== 'sales') return false;
    if (scope.kind === 'academic' && kind !== 'assistant') return false;
    const l = empLang(row);
    return !scope.langs || !l || l === 'both' || scope.langs.includes(l);
}
async function teamRows(db, scope) { return (await trackedRows(db)).filter(r => inScope(scope, r)); }
async function teamIds(db, scope) { return (await teamRows(db, scope)).map(r => r.id); }

function scopeSql(scope, alias = 'r', from = 1) {
    if (scope.kind === 'admin') return { sql: `${alias}.approver_kind='admin'`, params: [] };
    if (!scope.langs) return { sql: `${alias}.approver_kind=$${from}`, params: [scope.kind] };
    return { sql: `${alias}.approver_kind=$${from} AND (${alias}.lang IS NULL OR ${alias}.lang=ANY($${from + 1}::text[]))`, params: [scope.kind, scope.langs] };
}
async function pendingCount(db, scope) {
    const w = scopeSql(scope);
    return Number((await db.query(`SELECT COUNT(*)::int AS n FROM staff_att_requests r WHERE r.state='pending' AND ${w.sql}`, w.params)).rows[0]?.n || 0);
}

// Tasdiqlovchi akkauntlar (Telegram va "Soʻrov boradi" yozuvi uchun).
async function approverUsers(db, route) {
    if (route.kind === 'admin') return (await db.query("SELECT id,name,role FROM users WHERE role IN ('admin','boshliq') ORDER BY role,name")).rows;
    const sql = route.kind === 'rop'
        ? `SELECT u.id,u.name,u.role,he.lang FROM users u LEFT JOIN hr_employees he ON LOWER(TRIM(he.login))=LOWER(TRIM(u.email)) AND COALESCE(TRIM(he.login),'')<>'' WHERE u.role='rop'`
        : `SELECT u.id,u.name,u.role,he.lang FROM users u JOIN hr_employees he ON LOWER(TRIM(he.login))=LOWER(TRIM(u.email)) AND COALESCE(TRIM(he.login),'')<>''
            WHERE he.role='${rules.ACADEMIC_HEAD_ROLE}' AND NOT ${await goneSql(db)}`;
    const rows = (await db.query(sql)).rows;
    const seen = new Set();
    return rows.filter(r => !seen.has(r.id) && seen.add(r.id) && rules.langCovers(r.lang || 'both', route.lang));
}
// Tasdiqlovchilar ro'yxati kam o'zgaradi, /me esa har 15–60 soniyada so'raladi — 60 s kesh (marshrut bo'yicha).
const APPROVER_TTL_MS = 60000;
const approverCache = new Map();
// HR xodim lavozimi/tili yoki loginini o'zgartirsa — kesh darhol tozalanadi (aks holda ko'pi bilan 60 s eski).
function clearApproverCache() { approverCache.clear(); }
async function approverUsersCached(db, route) {
    const key = route.kind + '|' + (route.lang || '');
    const hit = approverCache.get(key);
    if (hit && Date.now() - hit.at < APPROVER_TTL_MS) return hit.rows;
    const rows = await approverUsers(db, route);
    approverCache.set(key, { at: Date.now(), rows });
    if (approverCache.size > 50) approverCache.delete(approverCache.keys().next().value);
    return rows;
}
// Shu til bo'limida ROP / akademik rahbar yo'q bo'lsa — so'rov yetim qolmasin, direktorga boradi.
async function effectiveRoute(db, a) {
    const route = routeFor(a);
    if (route.kind === 'admin' || (await approverUsersCached(db, route)).length) return route;
    return { kind: 'admin', lang: null };
}
async function approverLabel(db, route) {
    const first = (await approverUsersCached(db, route))[0];
    return { kind: route.kind, role: APPROVER_TEXT[route.kind], name: first?.name || '' };
}

const MON_S = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
function dayPhrase(date, today) {
    const tomorrow = t.tashkentDate(new Date(Date.parse(today + 'T12:00:00Z') + 86400000 - t.OFFSET_MS));
    const short = `${Number(date.slice(8))}-${MON_S[Number(date.slice(5, 7)) - 1]}`;
    return date === today ? 'Bugun' : date === tomorrow ? `Ertaga, ${short}` : short;
}
function requestView(r, today) {
    const date = typeof r.work_date === 'string' ? r.work_date : t.tashkentDate(r.work_date);
    return { id: r.id, type: r.type, typeLabel: rules.REQUEST_TYPES[r.type], date, day: dayPhrase(date, today), time: r.at_time || '',
        reason: r.reason, comment: r.comment || '', state: r.state, approverKind: r.approver_kind, approverRole: APPROVER_TEXT[r.approver_kind],
        decidedBy: r.decided_by_name || '', decisionReason: r.decision_reason || '', decisionNote: r.decision_note || '',
        createdAt: r.created_at, createdClock: r.created_at ? t.tashkentClock(r.created_at) : '', distance: r.distance_m ?? null,
        employeeId: r.employee_id, name: r.employee_name || '', role: r.employee_role ? ROLE_TEXT[rules.staffKind({ empRole: r.employee_role })] : '',
        photoId: r.photo_id || null };
}
const REQ_SELECT = `SELECT r.*,TO_CHAR(r.work_date,'YYYY-MM-DD') AS work_date,he.name AS employee_name,he.role AS employee_role,
    du.name AS decided_by_name,e.photo_id FROM staff_att_requests r LEFT JOIN hr_employees he ON he.id=r.employee_id
    LEFT JOIN users du ON du.id=r.decided_by LEFT JOIN staff_att_events e ON e.id=r.event_id`;

async function createRequest(pool, user, body, now = new Date()) {
    const a = await actor(pool, user); requireEmployee(a); requireTrackedRole(a);
    if (!(await scheduleFor(pool, a.employee_id))?.tracked) throw error(403, 'Sizga davomat belgilash yoqilmagan');
    const today = t.tashkentDate(now);
    const schedule = await scheduleFor(pool, a.employee_id);
    const reqDate = String(body?.date || '');
    const day = t.isDate(reqDate) ? (schedule.days || {})[String(t.weekday(reqDate))] || null : undefined;
    const prior = t.isDate(reqDate) && reqDate === today ? await priorEvents(pool, a.employee_id, today) : [];
    const input = rules.normalizeRequest(body, { today, day,
        inOk: prior.some(e => e.ok && e.kind === 'in' && e.location_method !== 'outside'), outOk: prior.some(e => e.ok && e.kind === 'out') });
    const route = await effectiveRoute(pool, a);
    const id = randomUUID();
    await transaction(pool, async db => {
        // Belgilash (checkLocked) bilan bir xil xodim qulfi: so'rov va kelish/ketish bir-biriga aralashmaydi.
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['staff_att:' + a.employee_id]);
        if (input.date === today) {
            const now2 = await priorEvents(db, a.employee_id, today);
            rules.normalizeRequest(body, { today, day, inOk: now2.some(e => e.ok && e.kind === 'in' && e.location_method !== 'outside'),
                outOk: now2.some(e => e.ok && e.kind === 'out') });
        }
        const dup = (await db.query(`SELECT 1 FROM staff_att_requests WHERE employee_id=$1 AND work_date=$2 AND type=$3 AND state IN ('pending','approved')`,
            [a.employee_id, input.date, input.type])).rows[0];
        if (dup) throw error(409, 'Bu kun uchun shunday soʻrov allaqachon bor');
        const open = Number((await db.query(`SELECT COUNT(*)::int AS n FROM staff_att_requests WHERE employee_id=$1 AND state='pending'`, [a.employee_id])).rows[0].n);
        if (open >= 10) throw error(429, 'Javob kutayotgan soʻrovlar juda koʻp');
        await db.query(`INSERT INTO staff_att_requests(id,employee_id,user_id,type,work_date,at_time,reason,comment,approver_kind,lang)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [id, a.employee_id, a.id, input.type, input.date, input.time, input.reason, input.comment, route.kind, route.lang]);
        await audit(db, a.id, 'request:create', a.employee_id, { id, ...input });
    });
    await notifyRequest(pool, id).catch(e => console.error('[staff-attendance] so‘rov xabari:', e.message));
    return { id, state: 'pending', approver: await approverLabel(pool, route) };
}

async function cancelRequest(pool, user, id) {
    const a = await actor(pool, user); requireEmployee(a);
    const r = await pool.query(`UPDATE staff_att_requests SET state='cancelled',decided_at=NOW() WHERE id=$1 AND employee_id=$2 AND state='pending' RETURNING id`,
        [String(id || ''), a.employee_id]);
    if (!r.rowCount) throw error(409, 'Soʻrovni bekor qilib boʻlmaydi — u allaqachon koʻrib chiqilgan');
    await audit(pool, a.id, 'request:cancel', a.employee_id, { id });
    return { cancelled: true };
}

async function myRequests(db, user, now = new Date()) {
    const a = await actor(db, user); requireEmployee(a);
    const rows = (await db.query(`${REQ_SELECT} WHERE r.employee_id=$1 AND r.state<>'cancelled' ORDER BY r.created_at DESC LIMIT 30`, [a.employee_id])).rows;
    return { rows: rows.map(r => requestView(r, t.tashkentDate(now))), approver: await approverLabel(db, await effectiveRoute(db, a)) };
}

async function requireScope(db, user) {
    const a = await actor(db, user);
    const scope = await scopeFor(db, a);
    if (!scope) throw error(403, 'Davomat soʻrovlarini faqat ROP, akademik rahbar yoki direktor koʻradi');
    return { a, scope };
}

async function inbox(db, user, tab = 'pending', now = new Date()) {
    const { scope } = await requireScope(db, user);
    const w = scopeSql(scope);
    const where = tab === 'history' ? "r.state IN ('approved','rejected')" : "r.state='pending'";
    const rows = (await db.query(`${REQ_SELECT} WHERE ${where} AND ${w.sql} ORDER BY ${tab === 'history' ? 'r.decided_at DESC' : 'r.created_at'} LIMIT 100`, w.params)).rows;
    const langs = scope.langs;
    return { scope: { kind: scope.kind, langs }, pending: await pendingCount(db, scope), rows: rows.map(r => requestView(r, t.tashkentDate(now))) };
}

async function decideRequest(pool, user, id, body = {}) {
    const decision = body.decision === 'approve' ? 'approved' : body.decision === 'reject' ? 'rejected' : null;
    if (!decision) throw error(400, 'Qarorni tanlang');
    const reason = String(body.reason || '').trim().slice(0, 120);
    if (decision === 'rejected' && !reason) throw error(400, 'Rad etish sababini yozing');
    const { a, scope } = await requireScope(pool, user);
    const row = await transaction(pool, async db => {
        const r = (await db.query('SELECT * FROM staff_att_requests WHERE id=$1 FOR UPDATE', [String(id || '')])).rows[0];
        if (!r) throw error(404, 'Soʻrov topilmadi');
        // Avval huquq — begona so'rov holati (tasdiqlangan/yo'q) oshkor bo'lmasin.
        if (!rules.canDecide(scope, r)) throw error(403, 'Bu soʻrov sizga yuborilmagan');
        if (r.user_id === String(a.id)) throw error(403, 'Oʻz soʻrovingizni tasdiqlay olmaysiz');
        if (r.state === decision) return null; // takroriy bosish (bot + ilova)
        if (r.state !== 'pending') throw error(409, 'Soʻrov allaqachon koʻrib chiqilgan');
        // Shartli yangilash: qator qulfi bo'lmagan holatda ham (masalan replika) ikki qaror bir-birini bosib ketmaydi.
        const upd = await db.query(`UPDATE staff_att_requests SET state=$2,decided_by=$3,decided_at=NOW(),decision_reason=$4,decision_note=$5
            WHERE id=$1 AND state='pending' RETURNING id`, [r.id, decision, a.id, decision === 'rejected' ? reason : '', String(body.note || '').trim().slice(0, 500)]);
        if (!upd.rowCount) throw error(409, 'Soʻrov allaqachon koʻrib chiqilgan');
        await audit(db, a.id, 'request:' + decision, r.employee_id, { id: r.id, reason });
        // Kun natijasi muzlatilgan bo'lsa — qayta hisoblansin (masalan, rad etilgan "Ofisda emasman").
        await db.query('DELETE FROM staff_att_day_results WHERE employee_id=$1 AND work_date=$2', [r.employee_id, r.work_date]);
        return r;
    });
    if (row) await notifyDecision(pool, row.id).catch(e => console.error('[staff-attendance] qaror xabari:', e.message));
    return { id, state: decision };
}

// ── Telegram (bot navbati) ───────────────────────────────────────────────────
async function botReady(db) {
    const r = (await db.query("SELECT to_regclass('public.domwork_bot_links') AS a, to_regclass('public.domwork_bot_outbox') AS b, to_regclass('public.domwork_bot_callbacks') AS c")).rows[0];
    return !!(r?.a && r?.b);
}
const escH = v => String(v ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
function requestText(r, today) {
    const day = dayPhrase(r.work_date, today).toLowerCase();
    const what = r.type === 'late' ? `kech qolmoqchi — ${r.at_time} da keladi` : r.type === 'early_leave' ? `erta ketmoqchi — ${r.at_time} da`
        : r.type === 'absent' ? 'kelmaydi' : `ofisda emas${r.distance_m != null ? ` (ofisdan ${(r.distance_m / 1000).toFixed(1).replace('.', ',')} km)` : ''}, ${r.at_time} da belgiladi`;
    return `<b>${escH(r.employee_name)}</b> ${day} ${what}.\nSabab: ${escH(r.reason)}${r.comment ? ` · «${escH(r.comment.slice(0, 200))}»` : ''}`;
}
async function loadReq(db, id) {
    return (await db.query(`${REQ_SELECT} WHERE r.id=$1`, [id])).rows[0] || null;
}
async function notifyRequest(pool, id) {
    if (!(await botReady(pool))) return 0;
    const r = await loadReq(pool, id);
    if (!r) return 0;
    const settings = await getSettings(pool);
    if (settings.notifyTelegram === false) return 0;
    const users = await approverUsers(pool, { kind: r.approver_kind, lang: r.lang });
    if (!users.length) return 0;
    const buttons = await tableExists(pool, 'domwork_bot_callbacks');
    const links = (await pool.query(`SELECT telegram_id,account_id FROM domwork_bot_links WHERE account_kind='user' AND NOT paused AND account_id=ANY($1::text[])`,
        [users.map(u => String(u.id))])).rows;
    const store = require('../domworkBot/store');
    const kindText = ROLE_TEXT[rules.staffKind({ empRole: r.employee_role })] || 'Xodim';
    const text = `🕘 <b>Davomat soʻrovi · ${escH(kindText)}</b>\n${requestText(r, t.tashkentDate())}`;
    let n = 0;
    for (const l of links) {
        const keyboard = [...(buttons ? [[{ text: '✅ Tasdiqlash', callback_data: await store.callback(pool, { type: 'attreq', id: r.id, decision: 'approve' }) },
            { text: '❌ Rad etish', callback_data: await store.callback(pool, { type: 'attreq', id: r.id, decision: 'reject' }) }]] : []),
            [{ text: '📱 Ilovada ochish', url: 'https://myhomework.uz/?tab=davomat-sorov' }]];
        await store.enqueue(pool, { key: `attreq:${r.id}:${l.telegram_id}`, targetId: l.telegram_id,
            payload: { chat_id: l.telegram_id, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: keyboard } } });
        n++;
    }
    return n;
}
async function notifyDecision(pool, id) {
    if (!(await botReady(pool))) return 0;
    const r = await loadReq(pool, id);
    const link = r && (await pool.query(`SELECT telegram_id FROM domwork_bot_links WHERE account_kind='user' AND NOT paused AND account_id=$1`, [r.user_id])).rows[0];
    if (!link) return 0;
    const ok = r.state === 'approved';
    const what = `${rules.REQUEST_TYPES[r.type].toLowerCase()} · ${dayPhrase(r.work_date, t.tashkentDate()).toLowerCase()}${r.at_time && r.type !== 'outside' ? ' ' + r.at_time : ''}`;
    const text = ok ? `✅ Soʻrovingiz tasdiqlandi: ${escH(what)}\n${escH(r.decided_by_name || '')} tasdiqladi — kechikish yozilmaydi.`
        : `❌ Soʻrovingiz rad etildi: ${escH(what)}\nSabab: ${escH(r.decision_reason)}${r.decision_note ? `\n«${escH(r.decision_note)}»` : ''}\nOdatdagi qoida ishlaydi.`;
    await require('../domworkBot/store').enqueue(pool, { key: `attreq:${r.id}:${r.state}`, targetId: link.telegram_id,
        payload: { chat_id: link.telegram_id, text, parse_mode: 'HTML', disable_web_page_preview: true } });
    return 1;
}

// ── Xodimning o'z oyi (Mening davomatim) ─────────────────────────────────────
async function myMonth(db, user, month, now = new Date()) {
    const a = await actor(db, user); requireEmployee(a);
    if (!t.isMonth(month)) throw error(400, 'Oy noto‘g‘ri');
    const settings = await getSettings(db);
    const dates = t.monthDates(month);
    const ctx = await loadContext(db, [a.employee_id], dates[0], dates[dates.length - 1]);
    const today = t.tashkentDate(now);
    const totals = { on_time: 0, late: 0, lateMinutes: 0, absent: 0, excused: 0 };
    const days = dates.map(date => {
        const d = statusFor(ctx, a.employee_id, date, settings, now);
        if (d.status === 'on_time' || d.status === 'present') totals.on_time++;
        if (d.status === 'late') { totals.late++; totals.lateMinutes += d.lateMinutes; }
        if (d.status === 'absent') totals.absent++;
        if (d.status === 'excused' || d.status === 'leave') totals.excused++;
        return { date, status: date > today ? 'upcoming' : d.status, scheduled: d.scheduled, lateMinutes: d.lateMinutes, earlyMinutes: d.earlyMinutes,
            inClock: d.inClock, outClock: d.outClock, workedMinutes: d.workedMinutes, note: d.note || '' };
    });
    await freeze(db, ctx);
    const reqs = (await db.query(`${REQ_SELECT} WHERE r.employee_id=$1 AND r.state='approved' AND r.work_date BETWEEN $2 AND $3`,
        [a.employee_id, dates[0], dates[dates.length - 1]])).rows;
    for (const r of reqs) { const d = days.find(x => x.date === r.work_date); if (d && d.status === 'excused') d.approvedBy = r.decided_by_name || ''; }
    const schedule = await scheduleFor(db, a.employee_id);
    return { month, days, totals, scheduleDays: schedule?.days || {} };
}

// Bitta kun yozuvi (selfie, vaqtlar, joylashuv) — xodim o'zinikini, tasdiqlovchi o'z jamoasinikini ko'radi.
async function teamRecord(db, user, employeeId, date, now = new Date()) {
    const a = await actor(db, user);
    const id = String(employeeId || a.employee_id || '');
    if (!t.isDate(date)) throw error(400, 'Sana noto‘g‘ri');
    if (id !== a.employee_id && !a.canView) {
        const scope = await scopeFor(db, a);
        if (!scope || !(await teamIds(db, scope)).includes(id)) throw error(403, 'Ruxsat yo‘q');
    }
    const emp = await employeeExists(db, id);
    const settings = await getSettings(db);
    const ctx = await loadContext(db, [id], date, date);
    const day = statusFor(ctx, id, date, settings, now);
    await freeze(db, ctx);
    const attempts = (await db.query(`SELECT id,kind,occurred_at,ok,reason,distance_m,accuracy,location_method,face_distance,photo_id FROM staff_att_events
        WHERE employee_id=$1 AND work_date=$2 ORDER BY occurred_at`, [id, date])).rows;
    const face = (await db.query("SELECT photo_id FROM staff_att_faces WHERE employee_id=$1 AND state='approved'", [id])).rows[0];
    return { employeeId: id, name: emp.name, date, ...day, facePhotoId: face?.photo_id || null, office: { name: settings.office.name, radius: settings.office.radius },
        attempts: attempts.map(x => ({ id: x.id, kind: x.kind, clock: t.tashkentClock(x.occurred_at), ok: x.ok, message: x.ok ? '' : rules.reasonText(x.reason),
            distance: x.distance_m, method: x.location_method, photoId: x.photo_id,
            faceScore: x.face_distance != null ? Math.max(0, Math.min(100, Math.round((1 - x.face_distance) * 100))) : null })) };
}

// ROP / akademik rahbar / direktor: o'z jamoasining bugungi davomati.
async function team(db, user, date, now = new Date()) {
    const { scope } = await requireScope(db, user);
    if (!t.isDate(date)) throw error(400, 'Sana noto‘g‘ri');
    const settings = await getSettings(db);
    const list = await teamRows(db, scope);
    const ctx = await loadContext(db, list.map(e => e.id), date, date);
    const rows = list.map(e => ({ employeeId: e.id, name: e.name, role: ROLE_TEXT[rules.staffKind({ empRole: e.role })], lang: empLang(e),
        ...statusFor(ctx, e.id, date, settings, now) }));
    await freeze(db, ctx);
    const summary = {};
    for (const r of rows) summary[r.status] = (summary[r.status] || 0) + 1;
    const w = scopeSql(scope);
    const pend = (await db.query(`${REQ_SELECT} WHERE r.state='pending' AND ${w.sql} ORDER BY r.created_at LIMIT 5`, w.params)).rows
        .map(r => requestView(r, t.tashkentDate(now)));
    return { date, scope: { kind: scope.kind, langs: scope.langs }, rows, summary, pending: await pendingCount(db, scope), pendingPreview: pend };
}

// Admin (D15): ofis nomi, manzili, nuqtasi va radiusi.
async function saveOffice(db, user, body = {}) {
    const a = await actor(db, user); requireManage(a);
    const cur = await getSettings(db);
    const next = rules.normalizeSettings({ ...cur, office: { ...cur.office, ...body } });
    if (!String(next.office.name).trim()) throw error(400, 'Ofis nomini yozing');
    await db.query('UPDATE staff_att_settings SET data=$1,updated_by=$2,updated_at=NOW() WHERE singleton=1', [JSON.stringify(next), a.id]);
    await audit(db, a.id, 'settings:office', 'settings', next.office);
    return next.office;
}

// Kelishdagi tabrik oynasi (DavDone): ketma-ket vaqtida kunlar va shu oydagi kechikishlar.
async function streakInfo(db, employeeId, now, settings) {
    const today = t.tashkentDate(now);
    const from = t.tashkentDate(new Date(now.getTime() - 45 * 86400000));
    const ctx = await loadContext(db, [employeeId], from, today);
    const days = [];
    for (let d = new Date(now.getTime() - 45 * 86400000); t.tashkentDate(d) <= today; d = new Date(d.getTime() + 86400000)) {
        const date = t.tashkentDate(d);
        days.push({ date, status: statusFor(ctx, employeeId, date, settings, now).status });
    }
    await freeze(db, ctx);
    const month = today.slice(0, 7);
    return { streak: rules.onTimeStreak(days), monthLate: days.filter(d => d.date.startsWith(month) && d.status === 'late').length };
}

// Push (staffNotify → Jamoa ilovasi): ish boshlanishi/tugashi eslatmalari va so'rov qarorlari.
// Push o'tishi (staffPush.tick) har daqiqada hamma xodim uchun chaqiradi: sozlama va tasdiqlovchi navbati
// bir o'tish (bir xil `now`) ichida bir marta olinadi.
const passCache = { key: 0, settings: null, inbox: new Map() };
function pass(now) {
    const key = Math.floor(now.getTime() / 30000);
    if (passCache.key !== key) { passCache.key = key; passCache.settings = null; passCache.inbox = new Map(); }
    return passCache;
}
async function pushEvents(db, userId, now = new Date()) {
    if (!(await tableExists(db, 'staff_att_requests'))) return [];
    const a = await actor(db, { id: userId }).catch(() => null);
    const ev = [];
    if (!a) return ev;
    const pc = pass(now);
    const settings = pc.settings || (pc.settings = await getSettings(db));
    const date = t.tashkentDate(now), nowMin = t.tashkentMinutes(now), iso = m => t.atTashkent(date, m).toISOString();
    const scope = await scopeFor(db, a);
    if (scope) {
        const w = scopeSql(scope);
        const ck = scope.kind + '|' + (scope.langs || []).join(',');
        if (!pc.inbox.has(ck)) pc.inbox.set(ck, db.query(`${REQ_SELECT} WHERE r.state='pending' AND r.created_at>NOW()-INTERVAL '1 day' AND ${w.sql} ORDER BY r.created_at LIMIT 20`, w.params).then(x => x.rows));
        const rows = await pc.inbox.get(ck).catch(e => { pc.inbox.delete(ck); throw e; });
        for (const r of rows) ev.push({ id: `attreq:new:${r.id}`, type: 'att_request_new', cat: 'tasdiq', tone: 'info', pushOnly: true,
            title: `Davomat soʻrovi: ${String(r.employee_name || '').split(/\s+/)[0]}`, sub: `${rules.REQUEST_TYPES[r.type]} · ${dayPhrase(r.work_date, date).toLowerCase()}${r.at_time ? ' ' + r.at_time : ''}`,
            at: new Date(r.created_at).toISOString(), go: { tab: 'davomat-sorov' } });
    }
    if (!a.employee_id || !rules.roleTracked({ userRole: a.role, empRole: a.employee_role })) return ev;
    const decided = (await db.query(`${REQ_SELECT} WHERE r.employee_id=$1 AND r.state IN ('approved','rejected') AND r.decided_at>NOW()-INTERVAL '2 days'`, [a.employee_id])).rows;
    for (const r of decided) ev.push({ id: `attreq:${r.id}:${r.state}`, type: 'att_request_decision', cat: 'boshqa', tone: r.state === 'approved' ? 'ok' : 'warn', pushOnly: true,
        title: r.state === 'approved' ? 'Soʻrovingiz tasdiqlandi' : 'Soʻrovingiz rad etildi',
        sub: `${rules.REQUEST_TYPES[r.type]} · ${dayPhrase(r.work_date, date).toLowerCase()}${r.state === 'rejected' && r.decision_reason ? ' · ' + r.decision_reason : ''}`,
        at: new Date(r.decided_at).toISOString(), go: { tab: 'davomat' } });
    const schedule = await scheduleFor(db, a.employee_id);
    const day = schedule?.tracked ? (schedule.days || {})[String(t.weekday(date))] : null;
    const face = (await db.query("SELECT 1 FROM staff_att_faces WHERE employee_id=$1 AND state='approved'", [a.employee_id])).rows[0];
    if (!day || !face) return ev; // dam olish kuni yoki yuz namunasi yo'q — eslatma yo'q
    const prior = await priorEvents(db, a.employee_id, date);
    const inOk = prior.find(e => e.ok && e.kind === 'in'), outOk = prior.filter(e => e.ok && e.kind === 'out').pop();
    const requests = (await db.query(`SELECT type,at_time AS time,state FROM staff_att_requests WHERE employee_id=$1 AND work_date=$2 AND state IN ('pending','approved')`,
        [a.employee_id, date])).rows;
    const ph = rules.phase({ nowMinutes: nowMin, day, inClock: inOk ? t.tashkentClock(inOk.occurred_at) : '', outClock: outOk ? t.tashkentClock(outOk.occurred_at) : '', requests });
    const start = t.parseClock(day.start), end = t.parseClock(day.end);
    if (ph.phase === 'before' && nowMin >= start - 10)
        ev.push({ id: `att:soon:${date}`, type: 'att_shift', cat: 'boshqa', tone: 'info', pushOnly: true, title: 'Ish kuni boshlanmoqda',
            sub: `${day.start} da boshlanadi. Ofisga kelganingizni yuz bilan tasdiqlang.`, at: iso(start - 10), go: { tab: 'davomat' } });
    if (ph.phase === 'lock' && nowMin < start + 60)
        ev.push({ id: `att:start:${date}`, type: 'att_shift', cat: 'boshqa', tone: 'warn', pushOnly: true, title: 'Siz hali belgilanmadingiz',
            sub: `Kechikish vaqti hisoblanmoqda. ${settings.graceMinutes} daqiqadan keyin rahbaringizga xabar ketadi.`, at: iso(t.parseClock(ph.unlockAt) || start), go: { tab: 'davomat' } });
    if (ph.phase === 'leave' && nowMin < end + 180) {
        const worked = inOk ? Math.max(0, nowMin - t.tashkentMinutes(inOk.occurred_at)) : 0;
        ev.push({ id: `att:end:${date}`, type: 'att_shift', cat: 'boshqa', tone: 'info', pushOnly: true, title: 'Ish kuni tugadi',
            sub: `Ketishingizni tasdiqlang — bugun ${Math.floor(worked / 60)} soat ${worked % 60} daqiqa ishladingiz.`, at: iso(t.parseClock(ph.leaveAt) || end), go: { tab: 'davomat' } });
    }
    return ev;
}

async function lateWaiting(db, list, ctx, settings, now) {
    // Ish boshlanib imtiyoz vaqti o'tsa ham belgilanmagan — tasdiqlovchiga va direktorga (bir marta).
    const date = t.tashkentDate(now), nowMin = t.tashkentMinutes(now);
    for (const e of list) {
        const d = statusFor(ctx, e.id, date, settings, now);
        if (d.status !== 'waiting' || nowMin < t.parseClock(d.start) + settings.graceMinutes) continue;
        const reqs = ctx.requests?.get(ctx.key(e.id, date)) || [];
        const late = reqs.find(r => r.type === 'late' && r.state === 'approved');
        if (late && nowMin < t.parseClock(late.time) + settings.graceMinutes) continue;
        const route = { kind: rules.approverKind({ empRole: e.role }), lang: empLang(e) === 'both' ? null : empLang(e) };
        const ids = (await approverUsers(db, route)).map(u => String(u.id));
        await notify.notYet(db, { employeeId: e.id, name: e.name, date, status: d, settings, userIds: ids }).catch(() => {});
    }
}

// ── HR / rahbar ──────────────────────────────────────────────────────────────

async function employees(db, user) {
    const a = await actor(db, user); requireView(a);
    const rows = (await db.query(`SELECT he.id,he.name,he.role,he.lang,he.status,he.login,s.tracked,s.days,f.state AS face_state,f.photo_id AS face_photo,f.updated_at AS face_updated
        FROM hr_employees he LEFT JOIN staff_att_schedules s ON s.employee_id=he.id LEFT JOIN staff_att_faces f ON f.employee_id=he.id
        WHERE NOT ${await goneSql(db)} ORDER BY he.name`)).rows;
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
    return (await db.query(`SELECT he.id,he.name,he.role,he.lang FROM staff_att_schedules s JOIN hr_employees he ON he.id=s.employee_id
        WHERE s.tracked AND NOT ${await goneSql(db)} ORDER BY he.name`)).rows;
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
    if (!a.canView && (!a.employee_id || row.employee_id !== a.employee_id)) {
        const scope = await scopeFor(db, a);
        if (!scope || !(await teamIds(db, scope)).includes(row.employee_id)) throw error(403, 'Ruxsat yo‘q');
    }
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
    await lateWaiting(db, list, ctx, settings, now).catch(e => console.error('[staff-attendance] kechikish xabari:', e.message));
    await freeze(db, ctx);
    const purged = (await db.query(`DELETE FROM staff_att_photos WHERE purpose='check' AND created_at < NOW() - ($1::int * INTERVAL '1 day')`,
        [settings.photoRetentionDays])).rowCount;
    // Yuz belgilari (biometrik) ham rasmlar bilan bir xil muddatda o'chiriladi.
    await db.query(`UPDATE staff_att_events SET descriptor=NULL,frame_hash=NULL WHERE descriptor IS NOT NULL
        AND occurred_at < NOW() - ($1::int * INTERVAL '1 day')`, [settings.photoRetentionDays]);
    // Ishdan ketgan (nofaol) xodimning yuz namunasi o'chiriladi; belgilash rasmlari (dalil) odatiy muddatda eskiradi.
    const gone = await goneSql(db);
    await db.query(`DELETE FROM staff_att_photos p USING hr_employees he WHERE he.id=p.employee_id AND ${gone} AND p.purpose='enroll'`);
    await db.query(`UPDATE staff_att_faces f SET descriptors='[]',state='reset',photo_id=NULL,reset_at=NOW() FROM hr_employees he
        WHERE he.id=f.employee_id AND ${gone} AND f.descriptors<>'[]'::jsonb`);
    await db.query(`UPDATE staff_att_events e SET descriptor=NULL,frame_hash=NULL FROM hr_employees he
        WHERE he.id=e.employee_id AND ${gone} AND e.descriptor IS NOT NULL`);
    return { absent, purged };
}

module.exports = { initSchema, actor, getSettings, saveSettings, me, challenge, submitOwnFace, check, employees, saveSchedule,
    myMonth, myRequests, createRequest, clearApproverCache, cancelRequest, inbox, decideRequest, team, teamRecord, saveOffice, pushEvents, scopeFor, routeFor,
    enrollFor, reviewFace, deleteFace, daily, monthly, setOverride, photo, tick, computeDay, lessonReport, transaction, ipAllowed, goneSql,
    MAX_ATTEMPTS_PER_DAY, TEACHER_HR_ROLES, FRAME_W, FRAME_H };
