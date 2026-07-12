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
            first_name TEXT DEFAULT '',
            last_name TEXT DEFAULT '',
            role TEXT NOT NULL DEFAULT 'employee',
            login TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            email TEXT DEFAULT '',
            department TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            join_date TEXT DEFAULT '',
            gender TEXT DEFAULT '',
            birth_date TEXT DEFAULT '',
            start_date TEXT DEFAULT '',
            card_number TEXT DEFAULT '',
            passport_series TEXT DEFAULT '',
            pinfl TEXT DEFAULT '',
            address TEXT DEFAULT ''
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

        CREATE TABLE IF NOT EXISTS mobile_content (
            singleton INTEGER PRIMARY KEY DEFAULT 1,
            data JSONB NOT NULL DEFAULT '{"videos":[],"documents":[],"courses":[],"lessons":[]}'
        );

        CREATE TABLE IF NOT EXISTS json_data (
            key TEXT PRIMARY KEY,
            data JSONB NOT NULL DEFAULT '[]'
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
    // 124-ish: haqiqiy yetkazib berish manzili va bosqich sanalarini saqlash uchun
    await pool.query(`ALTER TABLE book_roadmap ADD COLUMN IF NOT EXISTS address TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE book_roadmap ADD COLUMN IF NOT EXISTS dispatched_at TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE book_roadmap ADD COLUMN IF NOT EXISTS delivered_at TEXT DEFAULT ''`).catch(() => {});

    // Migration: hr_employees jadvaliga yangi ustunlar qo'shish
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS first_name TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS last_name TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS birth_date TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS start_date TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS card_number TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS passport_series TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS pinfl TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS address TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'english'`).catch(() => {});

    // Migration: leads va students jadvallariga extra_data qo'shish
    await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'`).catch(() => {});
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'`).catch(() => {});

    // Boshlang'ich mobile_content qatori
    await pool.query(
        `INSERT INTO mobile_content (singleton, data) VALUES (1, $1) ON CONFLICT (singleton) DO NOTHING`,
        [JSON.stringify({ videos: [], documents: [], courses: [], lessons: [], modules: [], moduleContents: [] })]
    );
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
    let extra = {};
    try {
        if (r.extra_data) {
            extra = typeof r.extra_data === 'object' ? r.extra_data : JSON.parse(r.extra_data);
        }
    } catch {}
    return {
        ...extra,
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
    let extra = {};
    try {
        if (r.extra_data) {
            extra = typeof r.extra_data === 'object' ? r.extra_data : JSON.parse(r.extra_data);
        }
    } catch {}
    return {
        ...extra,
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
        address: r.address || '', dispatchedAt: r.dispatched_at || '', deliveredAt: r.delivered_at || '',
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
            `INSERT INTO book_roadmap (id, name, student_id, phone, region, manager_id, kind, status, date, lang, lead_ref, comments, address, dispatched_at, delivered_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            [r.id, r.name || '', r.studentId || '', r.phone || '',
             r.region || '', r.managerId || '', r.kind || 'organik',
             r.status || 'yangi-oquvchi', r.date || '',
             r.lang || 'english',
             r.leadRef ? JSON.stringify(r.leadRef) : null,
             JSON.stringify(r.comments || []),
             r.address || '', r.dispatchedAt || '', r.deliveredAt || '']
        );
    }
}

async function getHrEmployeesData() {
    const rows = await q(`
        SELECT he.*,
               COALESCE(
                   (SELECT u.avatar FROM users u
                    WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(he.login))
                    LIMIT 1),
               '') AS avatar
        FROM hr_employees he
        ORDER BY he.name
    `);
    return rows.map(r => ({
        id: r.id, name: r.name,
        avatar: r.avatar || '',
        firstName: r.first_name || '', lastName: r.last_name || '',
        role: r.role, login: r.login || '',
        phone: r.phone || '', email: r.email || '',
        department: r.department || '', status: r.status || 'active',
        joinDate: r.join_date || '', gender: r.gender || '',
        birthDate: r.birth_date || '', startDate: r.start_date || '',
        cardNumber: r.card_number || '', passportSeries: r.passport_series || '',
        pinfl: r.pinfl || '', address: r.address || '',
        lang: r.lang || 'english'
    }));
}

// Har bir speaking (juft) darsning "attendanceTaken" holati har o'qishda
// real liveGrades'dan qayta hisoblanadi — CRM'da saqlangan qiymatga hech
// qachon ishonilmaydi (admin uni qo'lda "soxta" o'zgartira olmasligi kerak,
// faqat ustoz o'z kabinetidan haqiqiy davomat olgandagina o'zgaradi).
function applyComputedLessonAttendance(mc, liveGrades, demoStudentId) {
    if (!demoStudentId) return mc;
    const attendedIds = new Set((liveGrades[demoStudentId] || []).map(g => g.lessonId));
    (mc.courses || []).forEach(course => {
        (mc.lessons || [])
            .filter(l => l.courseId === course.id)
            .forEach((l, i) => {
                if (i % 2 !== 0) l.attendanceTaken = attendedIds.has(l.id);
            });
    });
    return mc;
}

async function getMobileContentData() {
    const row = await q1('SELECT data FROM mobile_content WHERE singleton = 1');
    const mc = row ? row.data : { videos: [], documents: [], courses: [], lessons: [] };
    const [liveGrades, demoStudentId] = await Promise.all([
        getJsonData('liveGrades'),
        getJsonData('demoStudentId'),
    ]);
    return applyComputedLessonAttendance(mc, liveGrades, demoStudentId);
}

async function saveMobileContentData(client, data) {
    await client.query(
        `INSERT INTO mobile_content (singleton, data) VALUES (1, $1)
         ON CONFLICT (singleton) DO UPDATE SET data = EXCLUDED.data`,
        [JSON.stringify(data)]
    );
}

async function getFullState() {
    const [teacherRows, smRows, studentRows, ttRows, paymentRows,
        mainAtt, assistAtt, leads, hrEmployees, bookRoadmap, mobileContent,
        scripts, bonusHistory, bonusData, salesPlan, cashFlow, orgChart, manualMetrics,
        liveGrades, demoStudentId, studentMessages, peerMessages, studentActivity] = await Promise.all([
        q('SELECT * FROM teachers ORDER BY name'),
        q(`SELECT sm.id, sm.name, COALESCE(u.avatar,'') AS avatar
           FROM sales_managers sm
           LEFT JOIN users u ON LOWER(TRIM(u.name)) = LOWER(TRIM(sm.name))`),
        q('SELECT * FROM students ORDER BY name'),
        q('SELECT * FROM timetable'),
        q('SELECT * FROM payments ORDER BY date DESC'),
        buildAttendanceObject('main_attendance'),
        buildAttendanceObject('assistant_attendance'),
        getLeads(),
        getHrEmployeesData(),
        getBookRoadmap(),
        getMobileContentData(),
        getJsonData('scripts'),
        getJsonData('bonusHistory'),
        getJsonData('bonusData'),
        getJsonData('salesPlan'),
        getJsonData('cashFlow'),
        getJsonData('orgChart'),
        getJsonData('manualMetrics'),
        getJsonData('liveGrades'),
        getJsonData('demoStudentId'),
        getJsonData('studentMessages'),
        getJsonData('peerMessages'),
        getJsonData('studentActivity'),
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
        salesManagers: smRows.map(r => ({ id: r.id, name: r.name, avatar: r.avatar || '' })),
        students: studentRows.map(rowToStudent),
        timetable,
        mainAttendance: mainAtt,
        assistantAttendance: assistAtt,
        payments: paymentRows.map(rowToPayment),
        leads, hrEmployees, bookRoadmap, mobileContent,
        scripts, bonusHistory, bonusData, salesPlan, cashFlow, orgChart, manualMetrics,
        liveGrades, demoStudentId, studentMessages, peerMessages, studentActivity
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
        const { id, name, phone, group, subject, teacherId, assistantTeacherId,
                lessonDayOfWeek, lessonTime, lessonDuration, ...extra } = s;
        await client.query(
            `INSERT INTO students (id, name, phone, group_name, subject, teacher_id, assistant_teacher_id, lesson_day_of_week, lesson_time, lesson_duration, extra_data)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [s.id, s.name || '', s.phone || '', s.group || '', s.subject || 'english',
             s.teacherId || null, s.assistantTeacherId || null,
             s.lessonDayOfWeek != null ? s.lessonDayOfWeek : null,
             s.lessonTime || '', s.lessonDuration || 15,
             JSON.stringify(extra)]
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
            const attachmentsArr = photo ? [photo] : [];
            const { id, name, phone, phone2, email, managerId, source, date,
                    externalId, status, leadType, comments, managerPhoto,
                    attachments, createdAt, ...extra } = l;
            await client.query(
                `INSERT INTO leads (id, name, phone, phone2, email, manager_id, source, language, date, external_id, status, lead_type, comments, attachments, extra_data)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
                [l.id, l.name || '', l.phone || '', l.phone2 || '', l.email || '',
                 l.managerId || '', l.source || 'Organik', lang, l.date || '',
                 l.externalId || null, l.status || 'yangi-lidlar',
                 l.leadType === 'target' ? 'target' : 'organic',
                 JSON.stringify(l.comments || []), JSON.stringify(attachmentsArr),
                 JSON.stringify(extra)]
            );
        }
    }
}

async function saveHrEmployeesData(client, employees) {
    await client.query('DELETE FROM hr_employees');
    for (const e of (employees || [])) {
        await client.query(
            `INSERT INTO hr_employees
                (id, name, first_name, last_name, role, login, phone, email,
                 department, status, join_date, gender, birth_date, start_date,
                 card_number, passport_series, pinfl, address, lang)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
            [e.id, e.name, e.firstName || '', e.lastName || '',
             e.role || 'employee', e.login || '', e.phone || '', e.email || '',
             e.department || '', e.status || 'active', e.joinDate || '',
             e.gender || '', e.birthDate || '', e.startDate || '',
             e.cardNumber || '', e.passportSeries || '', e.pinfl || '', e.address || '',
             e.lang || 'english']
        );
    }
}

async function getJsonData(key) {
    const row = await q1('SELECT data FROM json_data WHERE key = $1', [key]);
    if (!row) {
        if (key === 'demoStudentId') return '';
        return (key === 'bonusData' || key === 'salesPlan' || key === 'liveGrades' || key === 'studentMessages' || key === 'peerMessages' || key === 'studentActivity') ? {} : [];
    }
    return row.data;
}

// Faqat CRM'da "Namuna o'quvchi" deb belgilangan bitta o'quvchining jonli
// dars baholarini qaytaradi — boshqa barcha o'quvchilarning ma'lumotlari
// public endpoint orqali hech qachon oshkor qilinmaydi. Ustozning umumiy
// reytingi esa BARCHA o'quvchilarning "overall" bahosi o'rtachasi sifatida
// hisoblanadi — bu faqat bitta agregat son, hech kimning shaxsiy bahosini
// oshkor qilmaydi.
async function getDemoStudentGrades() {
    const liveGrades = await getJsonData('liveGrades');
    const demoStudentId = await getJsonData('demoStudentId');
    if (!demoStudentId) return { grades: [], teacherRating: null };
    const grades = liveGrades[demoStudentId] || [];

    const lastTeacherId = grades.length ? grades[grades.length - 1].teacherId : null;
    let teacherRating = null;
    if (lastTeacherId) {
        const overalls = [];
        Object.values(liveGrades).forEach((entries) => {
            (entries || []).forEach((e) => {
                if (e.teacherId === lastTeacherId && e.studentRatingOfTeacher && typeof e.studentRatingOfTeacher.overall === 'number') {
                    overalls.push(e.studentRatingOfTeacher.overall);
                }
            });
        });
        if (overalls.length) teacherRating = Math.round((overalls.reduce((a, b) => a + b, 0) / overalls.length) * 10) / 10;
    }
    return { grades, teacherRating };
}

// Faqat "Namuna o'quvchi" uchun — bitta jonli dars sanasiga ustozni baholash
// natijasini qo'shadi. Boshqa hech qanday o'quvchi ma'lumotini yozib
// bo'lmaydi, chunki studentId har doim serverda demoStudentId'dan olinadi
// (mijozdan kelgan qiymatga ishonilmaydi).
async function submitDemoStudentTeacherRating(date, ratings) {
    const demoStudentId = await getJsonData('demoStudentId');
    if (!demoStudentId) throw new Error("Namuna o'quvchi belgilanmagan");
    const liveGrades = await getJsonData('liveGrades');
    const entries = liveGrades[demoStudentId] || [];
    const entry = entries.find((e) => e.date === date);
    if (!entry) throw new Error('Mos dars topilmadi');
    entry.studentRatingOfTeacher = ratings;
    await tx(async (client) => {
        await saveJsonData(client, 'liveGrades', liveGrades);
    });
}

// Tashkentda (UTC+5, DST yo'q) berilgan hafta kuni (1=Dushanba..7=Yakshanba)
// va soatdan kelib chiqib, keyingi eng yaqin sodir bo'lish vaqtini hisoblaydi.
// Agar bugun aynan shu kun bo'lsa-yu, dars (davomiyligi bilan) hali tugamagan
// bo'lsa, bugungi vaqt qaytariladi — aks holda keyingi haftaga o'tkaziladi.
function computeNextWeeklyOccurrence(dayOfWeek, timeStr, durationMinutes) {
    const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
    const [hh, mm] = String(timeStr).split(':').map(Number);
    const nowUtcMs = Date.now();
    const nowTashkent = new Date(nowUtcMs + TASHKENT_OFFSET_MS);
    const nowDow = nowTashkent.getUTCDay() === 0 ? 7 : nowTashkent.getUTCDay();
    const dayDiff = (dayOfWeek - nowDow + 7) % 7;
    const candidateTashkentMs = Date.UTC(
        nowTashkent.getUTCFullYear(), nowTashkent.getUTCMonth(), nowTashkent.getUTCDate() + dayDiff,
        hh || 0, mm || 0, 0, 0
    );
    let candidateUtcMs = candidateTashkentMs - TASHKENT_OFFSET_MS;
    const durMs = (durationMinutes || 0) * 60 * 1000;
    if (candidateUtcMs + durMs <= nowUtcMs) candidateUtcMs += 7 * 24 * 60 * 60 * 1000;
    return new Date(candidateUtcMs).toISOString();
}

// Public endpoint uchun — faqat CRM'da "Namuna o'quvchi" deb belgilangan
// bitta o'quvchining Telegram guruh havolasi va navbatdagi speaking dars
// vaqtini qaytaradi. StudentId har doim serverda demoStudentId'dan olinadi.
async function getDemoStudentSchedule() {
    const empty = {
        telegramGroupLink: '', topic: '', startsAt: null,
        courseStartDate: null, schedulePattern: 'mwf', lessonDayOfWeek: null, lessonTime: ''
    };
    const demoStudentId = await getJsonData('demoStudentId');
    if (!demoStudentId) return empty;
    const row = await q1('SELECT * FROM students WHERE id = $1', [demoStudentId]);
    if (!row) return empty;
    const student = rowToStudent(row);

    // 123-ish: "Jadval va davomat" ekrani o'quvchining haqiqiy o'qish
    // boshlagan kuni va o'zining asosiy ustozining haftalik dars kunlari
    // patterni (mwf/tts) asosida quriladi — shuning uchun ular ham
    // qaytariladi.
    let schedulePattern = 'mwf';
    if (student.teacherId) {
        const teacherRow = await q1('SELECT schedule_pattern FROM teachers WHERE id = $1', [student.teacherId]);
        if (teacherRow?.schedule_pattern) schedulePattern = teacherRow.schedule_pattern;
    }
    const courseStartDate = student.startDate || null;

    if (student.lessonDayOfWeek == null || !student.lessonTime) {
        return {
            telegramGroupLink: student.telegramGroupLink || '', topic: '', startsAt: null,
            courseStartDate, schedulePattern, lessonDayOfWeek: null, lessonTime: ''
        };
    }
    const startsAt = computeNextWeeklyOccurrence(student.lessonDayOfWeek, student.lessonTime, student.lessonDuration);
    const topic = student.group ? `Speaking Club: ${student.group}` : 'Speaking Club';
    return {
        telegramGroupLink: student.telegramGroupLink || '', topic, startsAt,
        courseStartDate, schedulePattern,
        lessonDayOfWeek: student.lessonDayOfWeek, lessonTime: student.lessonTime
    };
}

const DEMO_MESSAGE_THREAD_IDS = ['support', 'main-teacher', 'assistant-teacher'];

// Public endpoint uchun — faqat CRM'da "Namuna o'quvchi" deb belgilangan
// bitta o'quvchining uchta suhbat (Qo'llab-quvvatlash / Asosiy ustoz /
// Yordamchi ustoz) xabarlarini qaytaradi. StudentId har doim serverda
// demoStudentId'dan olinadi — mijozdan kelgan qiymatga ishonilmaydi.
async function getDemoStudentMessages() {
    const demoStudentId = await getJsonData('demoStudentId');
    if (!demoStudentId) return { support: [], mainTeacher: [], assistantTeacher: [] };
    const all = await getJsonData('studentMessages');
    const byThread = all[demoStudentId] || {};
    return {
        support: byThread['support'] || [],
        mainTeacher: byThread['main-teacher'] || [],
        assistantTeacher: byThread['assistant-teacher'] || [],
    };
}

// Namuna o'quvchi ilovadan xabar yozganda shu yerga yuboradi. StudentId
// har doim serverda demoStudentId'dan olinadi, shuning uchun bu boshqa
// hech bir o'quvchi ma'lumotini yoza olmaydi.
async function sendDemoStudentMessage(threadId, text) {
    if (!DEMO_MESSAGE_THREAD_IDS.includes(threadId)) throw new Error("Noto'g'ri suhbat");
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error("Xabar matni bo'sh bo'lishi mumkin emas");
    const demoStudentId = await getJsonData('demoStudentId');
    if (!demoStudentId) throw new Error("Namuna o'quvchi belgilanmagan");

    const all = await getJsonData('studentMessages');
    if (!all[demoStudentId]) all[demoStudentId] = {};
    if (!all[demoStudentId][threadId]) all[demoStudentId][threadId] = [];
    const message = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        threadId, sender: 'student', type: 'text', text: trimmed,
        time: new Date().toISOString(),
    };
    all[demoStudentId][threadId].push(message);
    await tx(async (client) => {
        await saveJsonData(client, 'studentMessages', all);
    });
    return message;
}

// Appdagi "Maqsaddoshlar" (hamkurs) suhbatlari uchun bir martalik urinish —
// hamkurs ismi (masalan "Madina") CRM'dagi haqiqiy o'quvchilar ro'yxatidagi
// ismning birinchi so'zi bilan mos kelsa, shu haqiqiy o'quvchi ID'siga
// bog'lab qo'yiladi (faqat ma'lumot uchun, CRM administratorga qaysi haqiqiy
// o'quvchi nazarda tutilganini ko'rsatish uchun) — topilmasa, baribir suhbat
// real/saqlanadigan bo'lib qoladi, faqat bog'lanish bo'sh qoladi.
async function findRealStudentIdByFirstName(name) {
    if (!name) return null;
    const target = String(name).trim().split(/\s+/)[0].toLowerCase();
    if (!target) return null;
    const rows = await q('SELECT id, name FROM students');
    const match = rows.find(r => String(r.name || '').trim().split(/\s+/)[0].toLowerCase() === target);
    return match ? match.id : null;
}

// Public endpoint uchun — faqat CRM'da "Namuna o'quvchi" deb belgilangan
// bitta o'quvchining barcha "hamkurs" (Maqsaddoshlar) suhbatlarini qaytaradi.
async function getDemoStudentPeerMessages() {
    const demoStudentId = await getJsonData('demoStudentId');
    if (!demoStudentId) return {};
    const all = await getJsonData('peerMessages');
    return all[demoStudentId] || {};
}

// Namuna o'quvchi ilovadan hamkursiga xabar yozganda shu yerga yuboradi.
// StudentId har doim serverda demoStudentId'dan olinadi.
async function sendDemoStudentPeerMessage(peerId, peerName, text) {
    const trimmedId = String(peerId || '').trim();
    if (!trimmedId) throw new Error("Hamkurs aniqlanmadi");
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error("Xabar matni bo'sh bo'lishi mumkin emas");
    const demoStudentId = await getJsonData('demoStudentId');
    if (!demoStudentId) throw new Error("Namuna o'quvchi belgilanmagan");

    const all = await getJsonData('peerMessages');
    if (!all[demoStudentId]) all[demoStudentId] = {};
    if (!all[demoStudentId][trimmedId]) {
        const linkedStudentId = await findRealStudentIdByFirstName(peerName);
        all[demoStudentId][trimmedId] = { peerName: peerName || trimmedId, linkedStudentId, messages: [] };
    }
    const message = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        sender: 'student', type: 'text', text: trimmed,
        time: new Date().toISOString(),
    };
    all[demoStudentId][trimmedId].messages.push(message);
    await tx(async (client) => {
        await saveJsonData(client, 'peerMessages', all);
    });
    return message;
}

// 124-ish: CRM'ning Sotuv bo'limidagi "Kitob yetkazish" kanban-bosqichlarini
// appning 4 bosqichli ko'rsatkichiga (Tayyorlanmoqda/Jo'natildi/Yo'lda/
// Yetkazib berildi) moslashtiradi.
const BOOK_ROADMAP_STAGE_MAP = {
    'yangi-oquvchi': 'preparing',
    'manzil-olindi': 'preparing',
    'pochtaga-tayyorlandi': 'preparing',
    'pochtaga-topshirildi': 'dispatched',
    'pochta-yetib-bordi': 'in_transit',
    'mijoz-qabul-qildi': 'delivered',
};

// Public endpoint uchun — faqat CRM'da "Namuna o'quvchi" deb belgilangan
// bitta o'quvchining haqiqiy kitob yetkazib berish holatini qaytaradi.
// bookRoadmap yozuvi studentga to'g'ridan-to'g'ri bog'lanmagani uchun
// (CRM'da bu maydon to'ldirilmaydi), avval student.leadRef orqali (ishonchli),
// topilmasa ism bo'yicha (best-effort) moslashtiriladi.
async function getDemoStudentBookDelivery() {
    const demoStudentId = await getJsonData('demoStudentId');
    if (!demoStudentId) return null;
    const studentRow = await q1('SELECT * FROM students WHERE id = $1', [demoStudentId]);
    if (!studentRow) return null;
    const student = rowToStudent(studentRow);

    const bookRoadmap = await getBookRoadmap();
    let entry = null;
    if (student.leadRef?.id) {
        entry = bookRoadmap.find(b => b.leadRef && b.leadRef.id === student.leadRef.id && b.leadRef.lang === student.leadRef.lang);
    }
    if (!entry && student.name) {
        const target = student.name.trim().toLowerCase();
        entry = bookRoadmap.find(b => b.name && b.name.trim().toLowerCase() === target);
    }
    if (!entry) return null;

    return {
        address: entry.address || '',
        stage: BOOK_ROADMAP_STAGE_MAP[entry.status] || 'preparing',
        dispatchedDate: entry.dispatchedAt || null,
        deliveredDate: entry.deliveredAt || null,
    };
}

const ACTIVITY_TYPES = ['exam', 'homework', 'video', 'vocab'];
const MAX_ACTIVITY_ENTRIES = 50;

// 125-ish: appda o'quvchi imtihon/uyga vazifa/video/lug'at mashqlarini
// bajarganda haqiqiy natijasini (ball, to'g'ri/adashgan) shu yerga yozadi —
// ustoz o'z kabinetidan va admin profilidan bularni kuzatib turishi uchun.
// Faqat CRM'da "Namuna o'quvchi" deb belgilangan bitta o'quvchi uchun.
async function getDemoStudentActivity() {
    const demoStudentId = await getJsonData('demoStudentId');
    if (!demoStudentId) return [];
    const all = await getJsonData('studentActivity');
    return all[demoStudentId] || [];
}

async function addDemoStudentActivity(entry) {
    const type = String(entry?.type || '').trim();
    if (!ACTIVITY_TYPES.includes(type)) throw new Error("Noto'g'ri faoliyat turi");
    const demoStudentId = await getJsonData('demoStudentId');
    if (!demoStudentId) throw new Error("Namuna o'quvchi belgilanmagan");

    const all = await getJsonData('studentActivity');
    if (!all[demoStudentId]) all[demoStudentId] = [];
    const record = {
        id: 'act-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        type,
        label: String(entry.label || '').slice(0, 200),
        scorePercent: typeof entry.scorePercent === 'number' ? entry.scorePercent : null,
        passed: typeof entry.passed === 'boolean' ? entry.passed : null,
        wrongAttempts: typeof entry.wrongAttempts === 'number' ? entry.wrongAttempts : null,
        mistakes: Array.isArray(entry.mistakes)
            ? entry.mistakes.slice(0, 20).map(m => ({
                question: String(m?.question || '').slice(0, 300),
                yourAnswer: String(m?.yourAnswer || '').slice(0, 300),
                correctAnswer: String(m?.correctAnswer || '').slice(0, 300),
            }))
            : [],
        time: new Date().toISOString(),
    };
    all[demoStudentId].unshift(record);
    if (all[demoStudentId].length > MAX_ACTIVITY_ENTRIES) all[demoStudentId].length = MAX_ACTIVITY_ENTRIES;
    await tx(async (client) => {
        await saveJsonData(client, 'studentActivity', all);
    });
    return record;
}

async function saveJsonData(client, key, data) {
    await client.query(
        `INSERT INTO json_data (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data`,
        [key, JSON.stringify(data)]
    );
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
        if (partial.mobileContent)      await saveMobileContentData(client, partial.mobileContent);
        if (partial.scripts !== undefined)     await saveJsonData(client, 'scripts', partial.scripts);
        if (partial.bonusHistory !== undefined) await saveJsonData(client, 'bonusHistory', partial.bonusHistory);
        if (partial.bonusData !== undefined)   await saveJsonData(client, 'bonusData', partial.bonusData);
        if (partial.salesPlan !== undefined)   await saveJsonData(client, 'salesPlan', partial.salesPlan);
        if (partial.cashFlow !== undefined)    await saveJsonData(client, 'cashFlow', partial.cashFlow);
        if (partial.orgChart !== undefined)    await saveJsonData(client, 'orgChart', partial.orgChart);
        if (partial.manualMetrics !== undefined) await saveJsonData(client, 'manualMetrics', partial.manualMetrics);
        if (partial.liveGrades !== undefined)    await saveJsonData(client, 'liveGrades', partial.liveGrades);
        if (partial.demoStudentId !== undefined) await saveJsonData(client, 'demoStudentId', partial.demoStudentId);
        if (partial.studentMessages !== undefined) await saveJsonData(client, 'studentMessages', partial.studentMessages);
        if (partial.peerMessages !== undefined) await saveJsonData(client, 'peerMessages', partial.peerMessages);
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

async function insertLead({ name, phone, email, language, source, externalId, date, status, leadType, contactTime }) {
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

    // 3-ish: Bog'lanish uchun qulay vaqt — dastlabki izoh sifatida
    const initialComments = [];
    if (contactTime) {
        initialComments.push({
            id: randomUUID(),
            type: 'contact-time',
            text: `Bog'lanish uchun qulay vaqt: ${contactTime}`,
            author: 'Tizim',
            ts: Date.now(),
            date: dateStr
        });
    }

    await pool.query(
        'INSERT INTO leads (id, name, phone, email, source, language, date, external_id, status, lead_type, comments, attachments) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [id, name, phone || '', email || '', src, lang, dateStr, extId, statusNorm, leadTypeNorm, JSON.stringify(initialComments), '[]']
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
    getHrEmployeesData, getMobileContentData, getDemoStudentGrades, submitDemoStudentTeacherRating,
    getDemoStudentSchedule,
    getDemoStudentMessages, sendDemoStudentMessage,
    getDemoStudentPeerMessages, sendDemoStudentPeerMessage,
    getDemoStudentBookDelivery,
    getDemoStudentActivity, addDemoStudentActivity,
    createSession, findSessionByJti, getSessionById, getSessionsByUserId,
    touchSession, deleteSession, deleteSessionByJti, deleteOtherSessions,
    init
};
