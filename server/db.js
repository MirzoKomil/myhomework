const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'myhomework.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function createDatabase(dbPath) {
    try {
        const Database = require('better-sqlite3');
        return new Database(dbPath);
    } catch {
        const { DatabaseSync } = require('node:sqlite');
        return new DatabaseSync(dbPath);
    }
}

const db = createDatabase(DB_PATH);

function initSchema() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'admin',
            created_at TEXT DEFAULT (datetime('now'))
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
            email TEXT DEFAULT '',
            source TEXT DEFAULT 'Organik',
            language TEXT NOT NULL,
            date TEXT,
            external_id TEXT,
            status TEXT DEFAULT 'new',
            lead_type TEXT DEFAULT 'organic',
            comments TEXT DEFAULT '[]',
            attachments TEXT DEFAULT '[]',
            created_at TEXT DEFAULT (datetime('now'))
        );
    `);
    migrateLeadsSchema();
    migrateUsersSchema();
    migrateStudentsSchema();
}

function migrateStudentsSchema() {
    const cols = db.prepare('PRAGMA table_info(students)').all();
    const names = new Set(cols.map(c => c.name));
    const additions = [
        ['lesson_day_of_week', 'INTEGER'],
        ['lesson_time', "TEXT DEFAULT ''"],
        ['lesson_duration', 'INTEGER DEFAULT 15']
    ];
    for (const [col, def] of additions) {
        if (!names.has(col)) {
            db.exec(`ALTER TABLE students ADD COLUMN ${col} ${def}`);
        }
    }
}

function migrateUsersSchema() {
    const cols = db.prepare('PRAGMA table_info(users)').all();
    const names = new Set(cols.map(c => c.name));
    const additions = [
        ['phone', "TEXT DEFAULT ''"],
        ['bio', "TEXT DEFAULT ''"],
        ['location', "TEXT DEFAULT ''"],
        ['avatar', "TEXT DEFAULT ''"]
    ];
    for (const [col, def] of additions) {
        if (!names.has(col)) {
            db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
        }
    }
}

function migrateLeadsSchema() {
    const cols = db.prepare('PRAGMA table_info(leads)').all();
    const names = new Set(cols.map(c => c.name));
    if (!names.has('external_id')) {
        db.exec('ALTER TABLE leads ADD COLUMN external_id TEXT');
    }
    if (!names.has('created_at')) {
        db.exec("ALTER TABLE leads ADD COLUMN created_at TEXT DEFAULT (datetime('now'))");
    }
    if (!names.has('email')) {
        db.exec("ALTER TABLE leads ADD COLUMN email TEXT DEFAULT ''");
    }
    if (!names.has('status')) {
        db.exec("ALTER TABLE leads ADD COLUMN status TEXT DEFAULT 'new'");
    }
    if (!names.has('lead_type')) {
        db.exec("ALTER TABLE leads ADD COLUMN lead_type TEXT DEFAULT 'organic'");
    }
    if (!names.has('comments')) {
        db.exec("ALTER TABLE leads ADD COLUMN comments TEXT DEFAULT '[]'");
    }
    if (!names.has('attachments')) {
        db.exec("ALTER TABLE leads ADD COLUMN attachments TEXT DEFAULT '[]'");
    }
    if (!names.has('phone2')) {
        db.exec("ALTER TABLE leads ADD COLUMN phone2 TEXT DEFAULT ''");
    }
    if (!names.has('manager_id')) {
        db.exec("ALTER TABLE leads ADD COLUMN manager_id TEXT DEFAULT ''");
    }
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_source_external ON leads(source, external_id) WHERE external_id IS NOT NULL');
    db.prepare("UPDATE leads SET language = 'russian' WHERE LOWER(source) LIKE '%domwork%'").run();
    db.prepare("UPDATE leads SET language = 'english' WHERE LOWER(source) LIKE '%homework%'").run();
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

function parseJsonArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function rowToLead(r) {
    const attachments = parseJsonArray(r.attachments);
    return {
        id: r.id,
        name: r.name,
        phone: r.phone || '',
        phone2: r.phone2 || '',
        email: r.email || '',
        managerId: r.manager_id || '',
        source: r.source || 'Organik',
        date: r.date || '',
        status: r.status || 'new',
        leadType: r.lead_type || 'organic',
        comments: parseJsonArray(r.comments),
        attachments,
        managerPhoto: attachments[0] || null,
        externalId: r.external_id || null,
        createdAt: r.created_at || null
    };
}

function getLeads() {
    const leadRows = db.prepare('SELECT * FROM leads ORDER BY datetime(created_at) DESC, date DESC').all();
    const leads = { english: [], russian: [] };
    leadRows.forEach(r => {
        const item = rowToLead(r);
        if (r.language === 'russian') leads.russian.push(item);
        else leads.english.push(item);
    });
    return leads;
}

function insertLead({ name, phone, email, language, source, externalId, date, status, leadType }) {
    const src = normalizeLeadSource(source);
    const lang = languageForSource(src, language);
    const extId = externalId ? String(externalId) : null;
    const leadTypeNorm = String(leadType || '').toLowerCase() === 'target' ? 'target' : 'organic';
    const statusNorm = status || 'yangi-lidlar';

    if (extId) {
        const existing = db.prepare('SELECT id FROM leads WHERE source = ? AND external_id = ?').get(src, extId);
        if (existing) return { id: existing.id, duplicate: true };
    }

    const id = randomUUID();
    const dateStr = date || new Date().toLocaleDateString('uz-UZ');
    db.prepare(
        'INSERT INTO leads (id, name, phone, email, source, language, date, external_id, status, lead_type, comments, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, name, phone || '', email || '', src, lang, dateStr, extId, statusNorm, leadTypeNorm, '[]', '[]');

    return {
        id,
        duplicate: false,
        lead: {
            id, name, phone: phone || '', email: email || '', source: src, language: lang,
            date: dateStr, externalId: extId, status: statusNorm, leadType: leadTypeNorm
        }
    };
}

function seedIfEmpty() {
    const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    if (userCount > 0) return;

    const hash = bcrypt.hashSync('123456', 10);
    db.prepare(
        'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
    ).run(randomUUID(), 'Asosiy Admin', 'admin', hash, 'admin');

    const teachers = [
        ['t1', 'Saida Rustamaliyeva', 'asosiy', 'english', '', 'mwf', 15],
        ['t2', 'Zulayho Majitova', 'asosiy', 'english', '', 'tts', 15],
        ['t3', 'Zokir', 'asosiy', 'russian', '', 'mwf', 30],
        ['t4', 'Yordamchi (Ingliz)', 'yordamchi', 'english', '', 'tts', 15],
        ['t5', 'Yordamchi (Rus)', 'yordamchi', 'russian', '', 'mwf', 15]
    ];
    const insTeacher = db.prepare(
        'INSERT INTO teachers (id, name, type, subject, phone, schedule_pattern, lesson_duration) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    teachers.forEach(t => insTeacher.run(...t));

    db.prepare('INSERT INTO sales_managers (id, name) VALUES (?, ?)').run('sm1', 'Sotuv menejeri 1');
    db.prepare('INSERT INTO sales_managers (id, name) VALUES (?, ?)').run('sm2', 'Sotuv menejeri 2');

    const students = [
        ['s1', 'Eliboy', '93978310191', 'English', 'english', 't2', null, 2, '10:00', 15],
        ['s2', 'Umar', '93697373263', 'English', 'english', 't2', null, 4, '11:00', 30],
        ['s3', 'Aziz', '901234567', 'Russian', 'russian', 't3', null, 1, '09:00', 30]
    ];
    const insStudent = db.prepare(
        'INSERT INTO students (id, name, phone, group_name, subject, teacher_id, assistant_teacher_id, lesson_day_of_week, lesson_time, lesson_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    students.forEach(s => insStudent.run(...s));
}

function buildAttendanceObject(table) {
    const rows = db.prepare(`SELECT att_key, student_id, day FROM ${table} WHERE present = 1`).all();
    const out = {};
    rows.forEach(r => {
        if (!out[r.att_key]) out[r.att_key] = {};
        if (!out[r.att_key][r.student_id]) out[r.att_key][r.student_id] = {};
        out[r.att_key][r.student_id][r.day] = 1;
    });
    return out;
}

function getFullState() {
    const teachers = db.prepare('SELECT * FROM teachers ORDER BY name').all().map(rowToTeacher);
    const salesManagers = db.prepare('SELECT * FROM sales_managers').all().map(r => ({ id: r.id, name: r.name }));
    const students = db.prepare('SELECT * FROM students ORDER BY name').all().map(rowToStudent);
    const timetableRows = db.prepare('SELECT * FROM timetable').all();
    const timetable = {};
    timetableRows.forEach(r => {
        timetable[r.slot_key] = {
            teacherId: r.teacher_id || '',
            salesManagerId: r.sales_manager_id || '',
            studentId: r.student_id || '',
            completed: !!r.completed,
            isProbniy: true
        };
    });
    const payments = db.prepare('SELECT * FROM payments ORDER BY date DESC').all().map(rowToPayment);
    const leads = getLeads();

    return {
        teachers,
        salesManagers,
        students,
        timetable,
        mainAttendance: buildAttendanceObject('main_attendance'),
        assistantAttendance: buildAttendanceObject('assistant_attendance'),
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
        assistantTeacherId: r.assistant_teacher_id || null,
        lessonDayOfWeek: r.lesson_day_of_week != null ? r.lesson_day_of_week : null,
        lessonTime: r.lesson_time || '',
        lessonDuration: r.lesson_duration || 15
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

function runTransaction(fn) {
    if (typeof db.transaction === 'function') {
        db.transaction(fn)();
        return;
    }
    db.exec('BEGIN');
    try {
        fn();
        db.exec('COMMIT');
    } catch (e) {
        db.exec('ROLLBACK');
        throw e;
    }
}

function saveTeachers(teachers) {
    runTransaction(() => {
        db.prepare('DELETE FROM teachers').run();
        const ins = db.prepare(
            'INSERT INTO teachers (id, name, type, subject, phone, schedule_pattern, lesson_duration) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        teachers.forEach(t => ins.run(
            t.id, t.name, t.type, t.subject || 'english', t.phone || '',
            t.schedulePattern || 'mwf', t.lessonDuration || 15
        ));
    });
}

function saveStudents(students) {
    runTransaction(() => {
        db.prepare('DELETE FROM students').run();
        const ins = db.prepare(
            'INSERT INTO students (id, name, phone, group_name, subject, teacher_id, assistant_teacher_id, lesson_day_of_week, lesson_time, lesson_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        students.forEach(s => ins.run(
            s.id, s.name, s.phone || '', s.group || '', s.subject || 'english',
            s.teacherId || null, s.assistantTeacherId || null,
            s.lessonDayOfWeek != null ? s.lessonDayOfWeek : null,
            s.lessonTime || '',
            s.lessonDuration || 15
        ));
    });
}

function saveSalesManagers(list) {
    runTransaction(() => {
        db.prepare('DELETE FROM sales_managers').run();
        const ins = db.prepare('INSERT INTO sales_managers (id, name) VALUES (?, ?)');
        list.forEach(s => ins.run(s.id, s.name));
    });
}

function saveTimetable(timetable) {
    runTransaction(() => {
        db.prepare('DELETE FROM timetable').run();
        const ins = db.prepare(
            'INSERT INTO timetable (slot_key, date, time, view_key, teacher_id, sales_manager_id, student_id, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        Object.entries(timetable || {}).forEach(([key, e]) => {
            const parts = key.split('_');
            ins.run(
                key,
                parts[0] || '',
                parts[1] || '',
                parts[2] || 'all',
                e.teacherId || null,
                e.salesManagerId || null,
                e.studentId || null,
                e.completed ? 1 : 0
            );
        });
    });
}

function saveAttendanceTable(tableName, data) {
    runTransaction(() => {
        db.prepare(`DELETE FROM ${tableName}`).run();
        const ins = db.prepare(`INSERT INTO ${tableName} (att_key, student_id, day, present) VALUES (?, ?, ?, 1)`);
        Object.entries(data || {}).forEach(([attKey, students]) => {
            Object.entries(students || {}).forEach(([studentId, days]) => {
                Object.entries(days || {}).forEach(([day, val]) => {
                    if (val) ins.run(attKey, studentId, parseInt(day, 10));
                });
            });
        });
    });
}

function savePayments(payments) {
    runTransaction(() => {
        db.prepare('DELETE FROM payments').run();
        const ins = db.prepare(
            'INSERT INTO payments (id, student_id, platform, book, paid, debt, date) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        payments.forEach(p => ins.run(
            p.id, p.studentId, p.platform || 0, p.book || 0, p.paid || 0, p.debt || 0, p.date || ''
        ));
    });
}

function saveLeads(leads) {
    runTransaction(() => {
        db.prepare('DELETE FROM leads').run();
        const ins = db.prepare(
            'INSERT INTO leads (id, name, phone, phone2, email, manager_id, source, language, date, external_id, status, lead_type, comments, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        ['english', 'russian'].forEach(lang => {
            (leads[lang] || []).forEach(l => {
                const photo = l.managerPhoto || (l.attachments && l.attachments[0]) || null;
                const attachments = photo ? [photo] : [];
                ins.run(
                    l.id, l.name, l.phone || '', l.phone2 || '', l.email || '', l.managerId || '',
                    l.source || 'Organik', lang, l.date || '',
                    l.externalId || null, l.status || 'yangi-lidlar', l.leadType === 'target' ? 'target' : 'organic',
                    JSON.stringify(l.comments || []), JSON.stringify(attachments)
                );
            });
        });
    });
}

function patchState(partial) {
    if (partial.teachers) saveTeachers(partial.teachers);
    if (partial.students) saveStudents(partial.students);
    if (partial.salesManagers) saveSalesManagers(partial.salesManagers);
    if (partial.timetable) saveTimetable(partial.timetable);
    if (partial.mainAttendance) saveAttendanceTable('main_attendance', partial.mainAttendance);
    if (partial.assistantAttendance) saveAttendanceTable('assistant_attendance', partial.assistantAttendance);
    if (partial.payments) savePayments(partial.payments);
    if (partial.leads) saveLeads(partial.leads);
}

function findUserByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function findUserById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function createUser({ name, email, passwordHash, role }) {
    const id = randomUUID();
    db.prepare(
        'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
    ).run(id, name, email, passwordHash, role || 'admin');
    return findUserById(id);
}

function updateUser(id, fields) {
    const allowed = ['name', 'email', 'phone', 'bio', 'location', 'avatar'];
    const updates = [];
    const values = [];
    for (const key of allowed) {
        if (fields[key] !== undefined) {
            updates.push(`${key} = ?`);
            values.push(fields[key]);
        }
    }
    if (fields.passwordHash !== undefined) {
        updates.push('password_hash = ?');
        values.push(fields.passwordHash);
    }
    if (!updates.length) return findUserById(id);
    values.push(id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return findUserById(id);
}

function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        bio: user.bio || '',
        location: user.location || '',
        avatar: user.avatar || '',
        createdAt: user.created_at || ''
    };
}

initSchema();
seedIfEmpty();

module.exports = {
    db,
    getFullState,
    getLeads,
    insertLead,
    patchState,
    findUserByEmail,
    findUserById,
    createUser,
    updateUser,
    publicUser
};
