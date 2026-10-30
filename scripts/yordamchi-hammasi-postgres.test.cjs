// Faqat bir martalik lokal baza bilan: node scripts/run-payroll-postgres.cjs scripts/yordamchi-hammasi-postgres.test.cjs
// 30-okt (Abdulloh): boshqa asosiy ustozlarda qolgan yordamchi o'quvchilar Ayubxonga — bir marta, audit bilan.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const schema = require('../server/services/school/schema');
const sep = require('../server/services/school/assistantSeparation');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url) { const u = new URL(url); if (u.hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(u.pathname)) throw Error('Only disposable loopback DBs'); }

test('migrateAll: qolgan yordamchi o\'quvchilar Ayubxonga', { skip: !url }, async () => {
    const pool = new Pool({ connectionString: url });
    const quiet = { log: () => {}, warn: () => {} };
    try {
        await pool.query(`CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN DEFAULT FALSE);
          CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT DEFAULT '',group_name TEXT DEFAULT '',subject TEXT DEFAULT 'english',
            teacher_id TEXT,assistant_teacher_id TEXT,lesson_day_of_week INTEGER,lesson_time TEXT DEFAULT '',lesson_duration INTEGER DEFAULT 15,extra_data JSONB DEFAULT '{}');
          INSERT INTO hr_employees VALUES ('ay','Ayubxon Axmadjonov','ay@x.uz','yordamchi','active','russian'),
            ('kom','Komiljon Egamberdiyev','k@x.uz','rus-oqituvchi','active','russian'),('ezo','Ezoza Sodiqova','e@x.uz','rus-oqituvchi','active','russian'),
            ('dil','Dilnoza','d@x.uz','ingliz-oqituvchi','active','english');
          INSERT INTO students(id,name,subject,teacher_id,assistant_teacher_id,extra_data) VALUES
            ('r1','Asad','russian','ezo','kom','{}'),('r2','Malika','russian','kom','ezo','{}'),
            ('r3','Ketgan','russian','ezo','kom','{"status":"inactive"}'),('r4','Demo','russian','ezo','kom','{"isStaffDemo":true}'),
            ('e1','Madina','english','dil','kom','{}'),('r5','Tayyor','russian','kom','ay','{}');`);
        await schema.initSchema(pool);
        const r = await sep.migrateAll(pool, quiet);
        assert.deepEqual(r.moved.map(x => x.id).sort(), ['r1', 'r2']);
        assert.deepEqual(r.kept.map(x => x.id), ['e1']);
        const a = Object.fromEntries((await pool.query('SELECT id, assistant_teacher_id AS a FROM students')).rows.map(x => [x.id, x.a]));
        assert.deepEqual(a, { r1: 'ay', r2: 'ay', r3: 'kom', r4: 'kom', e1: 'kom', r5: 'ay' });
        const audit = (await pool.query(`SELECT student_id, reason FROM school_student_audit ORDER BY student_id`)).rows;
        assert.deepEqual(audit.map(x => x.student_id), ['r1', 'r2']);
        assert.match(audit[0].reason, /30-okt/);
        // Qayta ishga tushsa — hech narsa
        await pool.query(`UPDATE students SET assistant_teacher_id='kom' WHERE id='r1'`);
        assert.equal((await sep.migrateAll(pool, quiet)).skipped, 'already-done');
        assert.equal((await pool.query(`SELECT assistant_teacher_id FROM students WHERE id='r1'`)).rows[0].assistant_teacher_id, 'kom');
    } finally { await pool.end(); }
});

test('migrateAll: Ayubxon yordamchi emas — marker yozilmaydi, keyin yana urinadi', { skip: !url }, async () => {
    const pool = new Pool({ connectionString: url });
    const quiet = { log: () => {}, warn: () => {} };
    try {
        await pool.query(`DELETE FROM school_migrations; UPDATE hr_employees SET role='rus-oqituvchi' WHERE id='ay'`);
        assert.equal((await sep.migrateAll(pool, quiet)).skipped, 'not-found');
        assert.equal((await pool.query(`SELECT COUNT(*)::int n FROM school_migrations`)).rows[0].n, 0);
        await pool.query(`UPDATE hr_employees SET role='yordamchi' WHERE id='ay'`);
        const r = await sep.migrateAll(pool, quiet);
        assert.deepEqual(r.moved.map(x => x.id), ['r1']);
    } finally { await pool.end(); }
});
