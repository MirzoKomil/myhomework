const { Pool } = require('pg');
const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// ── Connection ───────────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
    console.error('[DB] DATABASE_URL muhit o\'zgaruvchisi topilmadi!');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false'
        ? false
        : { rejectUnauthorized: false }
});

pool.on('error', (err) => console.error('[DB] Pool xatoligi:', err.message));

// Fayllar uchun (avatarlar)
const DATA_DIR = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Query helpers ────────────────────────────────────────────────────────────

async function q(text, params = []) {
    const { rows } = await pool.query(text, params);
    return rows;
}

async function q1(text, params = []) {
    const { rows } = await pool.query(text, params);
    return rows[0] || null;
}

async function tx(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await fn(client);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

// ── Schema ───────────────────────────────────────────────────────────────────

async function initSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'admin',
            phone TEXT DEFAULT '',
            bio TEXT DEFAULT '',
            location TEXT DEFAULT '',
            avatar TEXT DEFAULT '',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            jti TEXT UNIQUE NOT NULL,
            user_agent TEXT DEFAULT '',
            ip TEXT DEFAULT '',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            last_seen TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS teachers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            subject TEXT NOT NULL DEFAULT 'english',
            phone TEXT DEFAULT '',
            schedule_pattern TEXT DEFAULT 'mwf',
            lesson_duration INTEGER DEFAULT 15
        );

        CREATE TABLE IF NOT EXISTS sales_managers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT DEFAULT '',
            group_name TEXT DEFAULT '',
            subject TEXT NOT NULL DEFAULT 'english',
            teacher_id TEXT,
            assistant_teacher_id TEXT,
            lesson_day_of_week INTEGER,
            lesson_time TEXT DEFAULT '',
            lesson_duration INTEGER DEFAULT 15
        );

        CREATE TABLE IF NOT EXISTS timetable (
            slot_key TEXT PRIMARY KEY,
            date TEXT,
            time TEXT,
            view_key TEXT,
            teacher_id TEXT,
            sales_manager_id TEXT,
            student_id TEXT,
            completed INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS main_attendance (
            att_key TEXT NOT NULL,
            student_id TEXT NOT NULL,
            day INTEGER NOT NULL,
            present INTEGER DEFAULT 1,
            PRIMARY KEY (att_key, student_id, day)
        );

        CREATE TABLE IF NOT EXISTS assistant_attendance (
            att_key TEXT NOT NULL,
            student_id TEXT NOT NULL,
            day INTEGER NOT NULL,
            present INTEGER DEFAULT 1,
            PRIMARY KEY (att_key, student_id, day)
        );

        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            student_id TEXT,
            platform INTEGER DEFAULT 0,
            book INTEGER DEFAULT 0,
            paid INTEGER DEFAULT 0,
            debt INTEGER DEFAULT 0,
            date TEXT
        );

        CREATE TABLE IF NOT EXISTS leads (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT DEFAULT '',
            phone2 TEXT DEFAULT '',
            email TEXT DEFAULT '',
            manager_id TEXT DEFAULT '',
            source TEXT DEFAULT 'Organik',
            language TEXT NOT NULL,
            date TEXT,
            external_id TEXT,
            status TEXT DEFAULT 'new',
            lead_type TEXT DEFAULT 'organic',
            comments TEXT DEFAULT '[]',
            attachments TEXT DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS hr_employees (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'employee',
            login TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            email TEXT DEFAULT '',
            department TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            join_date TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS book_roadmap (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            student_id TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            region TEXT DEFAULT '',
            manager_id TEXT DEFAULT '',
            kind TEXT DEFAULT 'organik',
            status TEXT DEFAULT 'yangi-oquvchi',
            date TEXT DEFAULT '',
            lang TEXT DEFAULT 'english',
            lead_ref TEXT DEFAULT NULL,
            comments TEXT DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_source_external
        ON leads(source, external_id)
        WHERE external_id IS NOT NULL
    `).catch(() => {});

    // Migration: book_roadmap jadvaliga yangi ustunlar qo'shish
    await pool.query(`ALTER TABLE book_roadmap ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'english'`).catch(() => {});
    await pool.query(`ALTER TABLE book_roadmap ADD COLUMN IF NOT EXISTS lead_ref TEXT DEFAULT NULL`).catch(() => {});
}

// ── Seed & migrate ───────────────────────────────────────────────────────────

async function migrateAdminPassword() {
    const admin = await q1("SELECT * FROM users WHERE email = 'admin'");
    if (!admin) return;
    const target = process.env.ADMIN_INIT_PASSWORD || 'admin123';
    const needsMigrate = bcrypt.compareSync('123456', admin.password_hash);
    const forceReset = !!process.env.ADMIN_INIT_PASSWORD && !bcrypt.compareSync(target, admin.password_hash);
    if (needsMigrate || forceReset) {
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2',
            [bcrypt.hashSync(target, 10), admin.id]);
        console.log('[DB] Admin paroli yangilandi');
    }
}

async function seedIfEmpty() {
    const row = await q1('SELECT COUNT(*) AS c FROM users');
    const count = parseInt(row.c, 10);
    if (count > 0) {
        await migrateAdminPassword();
        await cleanExpiredSessions();
        return;
    }
    console.log('[DB] Boshlang\'ich ma\'lumotlar yaratilmoqda...');
    await tx(async (client) => {
        await client.query(
            'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
            [randomUUID(), 'Asosiy Admin', 'admin', bcrypt.hashSync('admin123', 10), 'admin']
        );
        const teachers = [
            ['t1', 'Saida Rustamaliyeva', 'asosiy', 'english', '', 'mwf', 15],
            ['t2', 'Zulayho Majitova', 'asosiy', 'english', '', 'tts', 15],
            ['t3', 'Zokir', 'asosiy', 'russian', '', 'mwf', 30],
            ['t4', 'Yordamchi (Ingliz)', 'yordamchi', 'english', '', 'tts', 15],
            ['t5', 'Yordamchi (Rus)', 'yordamchi', 'russian', '', 'mwf', 15],
        ];
        for (const t of teachers) {
            await client.query(
                'INSERT INTO teachers (id, name, type, subject, phone, schedule_pattern, lesson_duration) VALUES ($1,$2,$3,$4,$5,$6,$7)',
                t
            );
        }
        const students = [
            ['s1', 'Eliboy', '93978310191', 'English', 'english', 't2', null, 2, '10:00', 15],
            ['s2', 'Umar', '93697373263', 'English', 'english', 't2', null, 4, '11:00', 30],
            ['s3', 'Aziz', '901234567', 'Russian', 'russian', 't3', null, 1, '09:00', 30],
        ];
        for (const s of students) {
            await client.query(
                'INSERT INTO students (id, name, phone, group_name, subject, teacher_id, assistant_teacher_id, lesson_day_of_week, lesson_time, lesson_duration) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
                s
            );
        }
    });
    console.log('[DB] Boshlang\'ich ma\'lumotlar yaratildi. Login: admin | Parol: admin123');
}

// ── Row mappers ──────────────────────────────────────────────────────────────

function rowToTeacher(r) {
    return {
        id: r.id, name: r.name, type: r.type, subject: r.subject,
        phone: r.phone || '', schedulePattern: r.schedule_pattern,
        lessonDuration: r.lesson_duration
    };
}

function rowToStudent(r) {
    return {
        id: r.id, name: r.name, phone: r.phone || '', group: r.group_name || '',
        subject: r.subject, teacherId: r.teacher_id || null,
        assistantTeacherId: r.assistant_teacher_id || null,
        lessonDayOfWeek: r.lesson_day_of_week != null ? r.lesson_day_of_week : null,
        lessonTime: r.lesson_time || '', lessonDuration: r.lesson_duration || 15
    };
}

function rowToPayment(r) {
    return {
        id: r.id, studentId: r.student_id,
        platform: r.platform, book: r.book, paid: r.paid, debt: r.debt, date: r.date
    };
}

function parseJsonArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
}

function rowToLead(r) {
    const attachments = parseJsonArray(r.attachments);
    return {
        id: r.id, name: r.name, phone: r.phone || '', phone2: r.phone2 || '',
        email: r.email || '', managerId: r.manager_id || '',
        source: r.source || 'Organik', date: r.date || '',
        status: r.status || 'new', leadType: r.lead_type || 'organic',
        comments: parseJsonArray(r.comments), attachments,
        managerPhoto: attachments[0] || null,
        externalId: r.external_id || null, createdAt: r.created_at || null
    };
}

// ── State ────────────────────────────────────────────────────────────────────

async function buildAttendanceObject(tableName) {
    const rows = await q(`SELECT att_key, student_id, day FROM ${tableName} WHERE present = 1`);
    const out = {};
    rows.forEach(r => {
        if (!out[r.att_key]) out[r.att_key] = {};
        if (!out[r.att_key][r.student_id]) out[r.att_key][r.student_id] = {};
        out[r.att_key][r.student_id][r.day] = 1;
    });
    return out;
}

async function getLeads() {
    const rows = await q('SELECT * FROM leads ORDER BY created_at DESC, date DESC');
    const leads = { english: [], russian: [] };
    rows.forEach(r => {
        const item = rowToLead(r);
        if (r.language === 'russian') leads.russian.push(item);
        else leads.english.push(item);
    });
    return leads;
}

function rowToBookRoadmap(r) {
    let leadRef = null;
    try { leadRef = r.lead_ref ? JSON.parse(r.lead_ref) : null; } catch { leadRef = null; }
    return {
        id: r.id, name: r.name, studentId: r.student_id || '',
        phone: r.phone || '', region: r.region || '',
        managerId: r.manager_id || '', kind: r.kind || 'organik',
        status: r.status || 'yangi-oquvchi', date: r.date || '',
        lang: r.lang || 'english', leadRef,
        comments: parseJsonArray(r.comments), createdAt: r.created_at || null
    };
}

async function getBookRoadmap() {
    const rows = await q('SELECT * FROM book_roadmap ORDER BY created_at DESC');
    return rows.map(rowToBookRoadmap);
}

async function saveBookRoadmap(client, items) {
    await client.query('DELETE FROM book_roadmap');
    for (const r of items) {
        await client.query(
            `INSERT INTO book_roadmap (id, name, student_id, phone, region, manager_id, kind, status, date, lang, lead_ref, comments)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [r.id, r.name || '', r.studentId || '', r.phone || '',
             r.region || '', r.managerId || '', r.kind || 'organik',
             r.status || 'yangi-oquvchi', r.date || '',
             r.lang || 'english',
             r.leadRef ? JSON.stringify(r.leadRef) : null,
             JSON.stringify(r.comments || [])]
        );
    }
}

async function getHrEmployeesData() {
    const rows = await q('SELECT * FROM hr_employees ORDER BY name');
    return rows.map(r => ({
        id: r.id, name: r.name, role: r.role, login: r.login || '',
        phone: r.phone || '', email: r.email || '',
        department: r.department || '', status: r.status || 'active', joinDate: r.join_date || ''
    }));
}

async function getFullState() {
    const [teacherRows, smRows, studentRows, ttRows, paymentRows,
        mainAtt, assistAtt, leads, hrEmployees, bookRoadmap] = await Promise.all([
        q('SELECT * FROM teachers ORDER BY name'),
        q('SELECT * FROM sales_managers'),
        q('SELECT * FROM students ORDER BY name'),
        q('SELECT * FROM timetable'),
        q('SELECT * FROM payments ORDER BY date DESC'),
        buildAttendanceObject('main_attendance'),
        buildAttendanceObject('assistant_attendance'),
        getLeads(),
        getHrEmployeesData(),
        getBookRoadmap()
    ]);
    const timetable = {};
    ttRows.forEach(r => {
        timetable[r.slot_key] = {
            teacherId: r.teacher_id || '', salesManagerId: r.sales_manager_id || '',
            studentId: r.student_id || '', completed: !!r.completed, isProbniy: true
        };
    });
    return {
        teachers: teacherRows.map(rowToTeacher),
        salesManagers: smRows.map(r => ({ id: r.id, name: r.name })),
        students: studentRows.map(rowToStudent),
        timetable,
        mainAttendance: mainAtt,
        assistantAttendance: assistAtt,
        payments: paymentRows.map(rowToPayment),
        leads, hrEmployees, bookRoadmap
    };
}

// ── Save functions (used in patchState) ─────────────────────────────────────

async function saveTeachers(client, teachers) {
    await client.query('DELETE FROM teachers');
    for (const t of teachers) {
        await client.query(
            'INSERT INTO teachers (id, name, type, subject, phone, schedule_pattern, lesson_duration) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [t.id, t.name, t.type, t.subject || 'english', t.phone || '', t.schedulePattern || 'mwf', t.lessonDuration || 15]
        );
    }
}

async function saveStudents(client, students) {
    await client.query('DELETE FROM students');
    for (const s of students) {
        await client.query(
            'INSERT INTO students (id, name, phone, group_name, subject, teacher_id, assistant_teacher_id, lesson_day_of_week, lesson_time, lesson_duration) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
            [s.id, s.name, s.phone || '', s.group || '', s.subject || 'english',
             s.teacherId || null, s.assistantTeacherId || null,
             s.lessonDayOfWeek != null ? s.lessonDayOfWeek : null,
             s.lessonTime || '', s.lessonDuration || 15]
        );
    }
}

async function saveSalesManagers(client, list) {
    await client.query('DELETE FROM sales_managers');
    for (const s of list) {
        await client.query('INSERT INTO sales_managers (id, name) VALUES ($1,$2)', [s.id, s.name]);
    }
}

async function saveTimetable(client, timetable) {
    await client.query('DELETE FROM timetable');
    for (const [key, e] of Object.entries(timetable || {})) {
        const parts = key.split('_');
        await client.query(
            'INSERT INTO timetable (slot_key, date, time, view_key, teacher_id, sales_manager_id, student_id, completed) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
            [key, parts[0] || '', parts[1] || '', parts[2] || 'all',
             e.teacherId || null, e.salesManagerId || null, e.studentId || null, e.completed ? 1 : 0]
        );
    }
}

async function saveAttendanceTable(client, tableName, data) {
    await client.query(`DELETE FROM ${tableName}`);
    for (const [attKey, students] of Object.entries(data || {})) {
        for (const [studentId, days] of Object.entries(students || {})) {
            for (const [day, val] of Object.entries(days || {})) {
                if (val) {
                    await client.query(
                        `INSERT INTO ${tableName} (att_key, student_id, day, present) VALUES ($1,$2,$3,1)`,
                        [attKey, studentId, parseInt(day, 10)]
                    );
                }
            }
        }
    }
}

async function savePayments(client, payments) {
    await client.query('DELETE FROM payments');
    for (const p of payments) {
        await client.query(
            'INSERT INTO payments (id, student_id, platform, book, paid, debt, date) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [p.id, p.studentId, p.platform || 0, p.book || 0, p.paid || 0, p.debt || 0, p.date || '']
        );
    }
}

async function saveLeads(client, leads) {
    await client.query('DELETE FROM leads');
    for (const lang of ['english', 'russian']) {
        for (const l of (leads[lang] || [])) {
            const photo = l.managerPhoto || (l.attachments && l.attachments[0]) || null;
            const attachments = photo ? [photo] : [];
            await client.query(
                'INSERT INTO leads (id, name, phone, phone2, email, manager_id, source, language, date, external_id, status, lead_type, comments, attachments) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
                [l.id, l.name, l.phone || '', l.phone2 || '', l.email || '', l.managerId || '',
                 l.source || 'Organik', lang, l.date || '', l.externalId || null,
                 l.status || 'yangi-lidlar', l.leadType === 'target' ? 'target' : 'organic',
                 JSON.stringify(l.comments || []), JSON.stringify(attachments)]
            );
        }
    }
}

async function saveHrEmployeesData(client, employees) {
    await client.query('DELETE FROM hr_employees');
    for (const e of (employees || [])) {
        await client.query(
            'INSERT INTO hr_employees (id, name, role, login, phone, email, department, status, join_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [e.id, e.name, e.role || 'employee', e.login || '',
             e.phone || '', e.email || '', e.department || '', e.status || 'active', e.joinDate || '']
        );
    }
}

async function patchState(partial) {
    await tx(async (client) => {
        if (partial.teachers)           await saveTeachers(client, partial.teachers);
        if (partial.students)           await saveStudents(client, partial.students);
        if (partial.salesManagers)      await saveSalesManagers(client, partial.salesManagers);
        if (partial.timetable)          await saveTimetable(client, partial.timetable);
        if (partial.mainAttendance)     await saveAttendanceTable(client, 'main_attendance', partial.mainAttendance);
        if (partial.assistantAttendance) await saveAttendanceTable(client, 'assistant_attendance', partial.assistantAttendance);
        if (partial.payments)           await savePayments(client, partial.payments);
        if (partial.leads)              await saveLeads(client, partial.leads);
        if (partial.hrEmployees)        await saveHrEmployeesData(client, partial.hrEmployees);
        if (partial.bookRoadmap)        await saveBookRoadmap(client, partial.bookRoadmap);
    });
}

// ── Leads insert (webhook) ───────────────────────────────────────────────────

function normalizeLeadLanguage(val) {
    if (!val) return 'english';
    const v = String(val).toLowerCase();
    if (v.includes('rus') || v === 'ru' || v === 'russian') return 'russian';
    return 'english';
}
function languageForSource(source, fallback) {
    const s = String(source || '').toLowerCase();
    if (s.includes('domwork')) return 'russian';
    if (s.includes('homework')) return 'english';
    return normalizeLeadLanguage(fallback);
}
function normalizeLeadSource(val) {
    const v = String(val || '').toLowerCase();
    if (v.includes('domwork')) return 'Domwork';
    if (v.includes('homework')) return 'Homework';
    if (!val) return 'Organik';
    return val;
}

async function insertLead({ name, phone, email, language, source, externalId, date, status, leadType }) {
    const src = normalizeLeadSource(source);
    const lang = languageForSource(src, language);
    const extId = externalId ? String(externalId) : null;
    const leadTypeNorm = String(leadType || '').toLowerCase() === 'target' ? 'target' : 'organic';
    const statusNorm = status || 'yangi-lidlar';

    if (extId) {
        const existing = await q1('SELECT id FROM leads WHERE source = $1 AND external_id = $2', [src, extId]);
        if (existing) return { id: existing.id, duplicate: true };
    }

    const id = randomUUID();
    const dateStr = date || new Date().toLocaleDateString('uz-UZ');
    await pool.query(
        'INSERT INTO leads (id, name, phone, email, source, language, date, external_id, status, lead_type, comments, attachments) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [id, name, phone || '', email || '', src, lang, dateStr, extId, statusNorm, leadTypeNorm, '[]', '[]']
    );
    return { id, duplicate: false, lead: { id, name, phone: phone || '', email: email || '', source: src, language: lang, date: dateStr, externalId: extId, status: statusNorm, leadType: leadTypeNorm } };
}

// ── Users ────────────────────────────────────────────────────────────────────

async function findUserByEmail(email) {
    return q1('SELECT * FROM users WHERE email = $1', [email]);
}

async function findUserById(id) {
    return q1('SELECT * FROM users WHERE id = $1', [id]);
}

async function createUser({ name, email, passwordHash, role }) {
    const id = randomUUID();
    await pool.query(
        'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5)',
        [id, name, email, passwordHash, role || 'admin']
    );
    return findUserById(id);
}

async function updateUser(id, fields) {
    const allowed = ['name', 'email', 'phone', 'bio', 'location', 'avatar', 'role'];
    const sets = [];
    const vals = [];
    let idx = 1;
    for (const key of allowed) {
        if (fields[key] !== undefined) {
            sets.push(`${key} = $${idx++}`);
            vals.push(fields[key]);
        }
    }
    if (fields.passwordHash !== undefined) {
        sets.push(`password_hash = $${idx++}`);
        vals.push(fields.passwordHash);
    }
    if (!sets.length) return findUserById(id);
    vals.push(id);
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    return findUserById(id);
}

function publicUser(user) {
    return {
        id: user.id, name: user.name, email: user.email, role: user.role,
        phone: user.phone || '', bio: user.bio || '',
        location: user.location || '', avatar: user.avatar || '',
        createdAt: user.created_at || ''
    };
}

// ── Sessions ─────────────────────────────────────────────────────────────────

async function createSession({ userId, jti, userAgent, ip }) {
    await pool.query(
        'INSERT INTO sessions (id, user_id, jti, user_agent, ip) VALUES ($1,$2,$3,$4,$5)',
        [randomUUID(), userId, jti, userAgent || '', ip || '']
    );
}

async function findSessionByJti(jti) {
    if (!jti) return null;
    return q1('SELECT * FROM sessions WHERE jti = $1', [jti]);
}

async function getSessionById(id) {
    return q1('SELECT * FROM sessions WHERE id = $1', [id]);
}

async function getSessionsByUserId(userId) {
    return q('SELECT * FROM sessions WHERE user_id = $1 ORDER BY last_seen DESC', [userId]);
}

async function touchSession(jti) {
    await pool.query('UPDATE sessions SET last_seen = NOW() WHERE jti = $1', [jti]);
}

async function deleteSession(id) {
    await pool.query('DELETE FROM sessions WHERE id = $1', [id]);
}

async function deleteSessionByJti(jti) {
    await pool.query('DELETE FROM sessions WHERE jti = $1', [jti]);
}

async function deleteOtherSessions(userId, currentJti) {
    await pool.query('DELETE FROM sessions WHERE user_id = $1 AND jti != $2', [userId, currentJti]);
}

async function cleanExpiredSessions() {
    await pool.query("DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '7 days'");
}

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
    try {
        await pool.query('SELECT 1');
        console.log('[DB] PostgreSQL ulanish muvaffaqiyatli');
    } catch (err) {
        console.error('[DB] PostgreSQL ulanmadi:', err.message);
        process.exit(1);
    }
    await initSchema();
    await seedIfEmpty();
}

module.exports = {
    pool, DATA_DIR,
    getFullState, getLeads, insertLead, patchState,
    findUserByEmail, findUserById, createUser, updateUser, publicUser,
    getHrEmployeesData,
    createSession, findSessionByJti, getSessionById, getSessionsByUserId,
    touchSession, deleteSession, deleteSessionByJti, deleteOtherSessions,
    init
};
