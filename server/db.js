const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function query(text, params) {
    const client = await pool.connect();
    try {
        return await client.query(text, params);
    } finally {
        client.release();
    }
}

async function initSchema() {
    await query(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'admin',
            created_at TIMESTAMPTZ DEFAULT NOW()
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
            assistant_teacher_id TEXT
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
            source TEXT DEFAULT 'Organik',
            language TEXT NOT NULL,
            date TEXT,
            external_id TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);
    await migrateLeadsSchema();
}

async function migrateLeadsSchema() {
    const res = await query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'leads'
    `);
    const names = new Set(res.rows.map(r => r.column_name));
    if (!names.has('external_id')) {
        await query('ALTER TABLE leads ADD COLUMN external_id TEXT');
    }
    if (!names.has('created_at')) {
        await query('ALTER TABLE leads ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW()');
    }
    await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_source_external
        ON leads(source, external_id)
        WHERE external_id IS NOT NULL
    `);
    await query("UPDATE leads SET language = 'russian' WHERE LOWER(source) LIKE '%domwork%'");
    await query("UPDATE leads SET language = 'english' WHERE LOWER(source) LIKE '%homework%'");
}

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

function rowToLead(r) {
    return {
        id: r.id,
        name: r.name,
        phone: r.phone || '',
        source: r.source || 'Organik',
        date: r.date || '',
        externalId: r.external_id || null,
        createdAt: r.created_at || null
    };
}

async function getLeads() {
    const res = await query('SELECT * FROM leads ORDER BY created_at DESC, date DESC');
    const leads = { english: [], russian: [] };
    res.rows.forEach(r => {
        const item = rowToLead(r);
        if (r.language === 'russian') leads.russian.push(item);
        else leads.english.push(item);
    });
    return leads;
}

async function insertLead({ name, phone, language, source, externalId, date }) {
    const src = normalizeLeadSource(source);
    const lang = languageForSource(src, language);
    const extId = externalId ? String(externalId) : null;

    if (extId) {
        const existing = await query(
            'SELECT id FROM leads WHERE source = $1 AND external_id = $2',
            [src, extId]
        );
        if (existing.rows.length > 0) return { id: existing.rows[0].id, duplicate: true };
    }

    const id = randomUUID();
    const dateStr = date || new Date().toLocaleDateString('uz-UZ');
    await query(
        'INSERT INTO leads (id, name, phone, source, language, date, external_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, name, phone || '', src, lang, dateStr, extId]
    );

    return {
        id,
        duplicate: false,
        lead: { id, name, phone: phone || '', source: src, language: lang, date: dateStr, externalId: extId }
    };
}

async function seedIfEmpty() {
    const res = await query('SELECT COUNT(*) AS c FROM users');
    if (parseInt(res.rows[0].c, 10) > 0) return;

    const hash = bcrypt.hashSync('123456', 10);
    await query(
        'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
        [randomUUID(), 'Asosiy Admin', 'admin', hash, 'admin']
    );

    const teachers = [
        ['t1', 'Saida Rustamaliyeva', 'asosiy', 'english', '', 'mwf', 15],
        ['t2', 'Zulayho Majitova', 'asosiy', 'english', '', 'tts', 15],
        ['t3', 'Zokir', 'asosiy', 'russian', '', 'mwf', 30],
        ['t4', 'Yordamchi (Ingliz)', 'yordamchi', 'english', '', 'tts', 15],
        ['t5', 'Yordamchi (Rus)', 'yordamchi', 'russian', '', 'mwf', 15]
    ];
    for (const t of teachers) {
        await query(
            'INSERT INTO teachers (id, name, type, subject, phone, schedule_pattern, lesson_duration) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            t
        );
    }

    await query('INSERT INTO sales_managers (id, name) VALUES ($1, $2)', ['sm1', 'Sotuv menejeri 1']);
    await query('INSERT INTO sales_managers (id, name) VALUES ($1, $2)', ['sm2', 'Sotuv menejeri 2']);

    const students = [
        ['s1', 'Eliboy', '93978310191', 'English', 'english', 't2', null],
        ['s2', 'Umar', '93697373263', 'English', 'english', 't2', null],
        ['s3', 'Aziz', '901234567', 'Russian', 'russian', 't3', null]
    ];
    for (const s of students) {
        await query(
            'INSERT INTO students (id, name, phone, group_name, subject, teacher_id, assistant_teacher_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            s
        );
    }
}

async function buildAttendanceObject(table) {
    const res = await query(`SELECT att_key, student_id, day FROM ${table} WHERE present = 1`);
    const out = {};
    res.rows.forEach(r => {
        if (!out[r.att_key]) out[r.att_key] = {};
        if (!out[r.att_key][r.student_id]) out[r.att_key][r.student_id] = {};
        out[r.att_key][r.student_id][r.day] = 1;
    });
    return out;
}

async function getFullState() {
    const [teachersRes, smRes, studentsRes, timetableRes, paymentsRes, leads] = await Promise.all([
        query('SELECT * FROM teachers ORDER BY name'),
        query('SELECT * FROM sales_managers'),
        query('SELECT * FROM students ORDER BY name'),
        query('SELECT * FROM timetable'),
        query('SELECT * FROM payments ORDER BY date DESC'),
        getLeads()
    ]);

    const teachers = teachersRes.rows.map(rowToTeacher);
    const salesManagers = smRes.rows.map(r => ({ id: r.id, name: r.name }));
    const students = studentsRes.rows.map(rowToStudent);

    const timetable = {};
    timetableRes.rows.forEach(r => {
        timetable[r.slot_key] = {
            teacherId: r.teacher_id || '',
            salesManagerId: r.sales_manager_id || '',
            studentId: r.student_id || '',
            completed: !!r.completed,
            isProbniy: true
        };
    });

    const payments = paymentsRes.rows.map(rowToPayment);

    const [mainAttendance, assistantAttendance] = await Promise.all([
        buildAttendanceObject('main_attendance'),
        buildAttendanceObject('assistant_attendance')
    ]);

    return {
        teachers,
        salesManagers,
        students,
        timetable,
        mainAttendance,
        assistantAttendance,
        payments,
        leads
    };
}

function rowToTeacher(r) {
    return {
        id: r.id,
        name: r.name,
        type: r.type,
        subject: r.subject,
        phone: r.phone || '',
        schedulePattern: r.schedule_pattern,
        lessonDuration: r.lesson_duration
    };
}

function rowToStudent(r) {
    return {
        id: r.id,
        name: r.name,
        phone: r.phone || '',
        group: r.group_name || '',
        subject: r.subject,
        teacherId: r.teacher_id || null,
        assistantTeacherId: r.assistant_teacher_id || null
    };
}

function rowToPayment(r) {
    return {
        id: r.id,
        studentId: r.student_id,
        platform: r.platform,
        book: r.book,
        paid: r.paid,
        debt: r.debt,
        date: r.date
    };
}

async function runTransaction(fn) {
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

async function saveTeachers(teachers) {
    await runTransaction(async (client) => {
        await client.query('DELETE FROM teachers');
        for (const t of teachers) {
            await client.query(
                'INSERT INTO teachers (id, name, type, subject, phone, schedule_pattern, lesson_duration) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [t.id, t.name, t.type, t.subject || 'english', t.phone || '', t.schedulePattern || 'mwf', t.lessonDuration || 15]
            );
        }
    });
}

async function saveStudents(students) {
    await runTransaction(async (client) => {
        await client.query('DELETE FROM students');
        for (const s of students) {
            await client.query(
                'INSERT INTO students (id, name, phone, group_name, subject, teacher_id, assistant_teacher_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [s.id, s.name, s.phone || '', s.group || '', s.subject || 'english', s.teacherId || null, s.assistantTeacherId || null]
            );
        }
    });
}

async function saveSalesManagers(list) {
    await runTransaction(async (client) => {
        await client.query('DELETE FROM sales_managers');
        for (const s of list) {
            await client.query('INSERT INTO sales_managers (id, name) VALUES ($1, $2)', [s.id, s.name]);
        }
    });
}

async function saveTimetable(timetable) {
    await runTransaction(async (client) => {
        await client.query('DELETE FROM timetable');
        for (const [key, e] of Object.entries(timetable || {})) {
            const parts = key.split('_');
            await client.query(
                'INSERT INTO timetable (slot_key, date, time, view_key, teacher_id, sales_manager_id, student_id, completed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [
                    key,
                    parts[0] || '',
                    parts[1] || '',
                    parts[2] || 'all',
                    e.teacherId || null,
                    e.salesManagerId || null,
                    e.studentId || null,
                    e.completed ? 1 : 0
                ]
            );
        }
    });
}

async function saveAttendanceTable(tableName, data) {
    await runTransaction(async (client) => {
        await client.query(`DELETE FROM ${tableName}`);
        for (const [attKey, students] of Object.entries(data || {})) {
            for (const [studentId, days] of Object.entries(students || {})) {
                for (const [day, val] of Object.entries(days || {})) {
                    if (val) {
                        await client.query(
                            `INSERT INTO ${tableName} (att_key, student_id, day, present) VALUES ($1, $2, $3, 1)`,
                            [attKey, studentId, parseInt(day, 10)]
                        );
                    }
                }
            }
        }
    });
}

async function savePayments(payments) {
    await runTransaction(async (client) => {
        await client.query('DELETE FROM payments');
        for (const p of payments) {
            await client.query(
                'INSERT INTO payments (id, student_id, platform, book, paid, debt, date) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [p.id, p.studentId, p.platform || 0, p.book || 0, p.paid || 0, p.debt || 0, p.date || '']
            );
        }
    });
}

async function saveLeads(leads) {
    await runTransaction(async (client) => {
        await client.query('DELETE FROM leads');
        for (const lang of ['english', 'russian']) {
            for (const l of (leads[lang] || [])) {
                await client.query(
                    'INSERT INTO leads (id, name, phone, source, language, date) VALUES ($1, $2, $3, $4, $5, $6)',
                    [l.id, l.name, l.phone || '', l.source || 'Organik', lang, l.date || '']
                );
            }
        }
    });
}

async function patchState(partial) {
    if (partial.teachers) await saveTeachers(partial.teachers);
    if (partial.students) await saveStudents(partial.students);
    if (partial.salesManagers) await saveSalesManagers(partial.salesManagers);
    if (partial.timetable) await saveTimetable(partial.timetable);
    if (partial.mainAttendance) await saveAttendanceTable('main_attendance', partial.mainAttendance);
    if (partial.assistantAttendance) await saveAttendanceTable('assistant_attendance', partial.assistantAttendance);
    if (partial.payments) await savePayments(partial.payments);
    if (partial.leads) await saveLeads(partial.leads);
}

async function findUserByEmail(email) {
    const res = await query('SELECT * FROM users WHERE email = $1', [email]);
    return res.rows[0] || null;
}

async function findUserById(id) {
    const res = await query('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
}

async function createUser({ name, email, passwordHash, role }) {
    const id = randomUUID();
    await query(
        'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
        [id, name, email, passwordHash, role || 'admin']
    );
    return findUserById(id);
}

function publicUser(user) {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function init() {
    await initSchema();
    await seedIfEmpty();
}

init().catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
});

module.exports = {
    pool,
    getFullState,
    getLeads,
    insertLead,
    patchState,
    findUserByEmail,
    findUserById,
    createUser,
    publicUser
};
