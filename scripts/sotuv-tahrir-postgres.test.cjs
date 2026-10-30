// Faqat bir martalik lokal baza bilan: PAYROLL_TEST_DATABASE_URL=postgresql://...@127.0.0.1/payroll_test_x node --test scripts/sotuv-tahrir-postgres.test.cjs
// BAHO6: sotuv tahrir so'rovi — (1) bugungi O'TGAN dars yangi jadvalni "band" qilmaydi, (2) o'zgarishsiz so'rov rad etiladi.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const schema = require('../server/services/school/schema');
const S = require('../server/services/school/schedule');
const O = require('../server/services/school/studentOps');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url) { const u = new URL(url); if (u.hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(u.pathname)) throw Error('Only disposable loopback DBs'); }

test('sotuv tahriri: o\'tgan dars band emas, o\'zgarishsiz so\'rov yo\'q (PostgreSQL)', { skip: !url }, async t => {
    const pool = new Pool({ connectionString: url });
    const tx = async fn => { const c = await pool.connect(); try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); } };
    const admin = { id: 'u-admin', role: 'admin', name: 'Abdulloh' };
    const sales = { id: 'u-sales', role: 'sales_manager', name: 'Jahongir' };
    const before = new Date('2026-10-29T03:00:00Z'); // Pa 29-okt 08:00
    const now = new Date('2026-10-30T06:00:00Z');    // Ju 30-okt 11:00 Toshkent
    try {
        await pool.query(`DROP TABLE IF EXISTS users, sessions, hr_employees, students, leads CASCADE;
          CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,avatar TEXT DEFAULT '',password_hash TEXT DEFAULT '');
          CREATE TABLE sessions(id TEXT, user_id TEXT, jti TEXT);
          CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN DEFAULT FALSE);
          CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT DEFAULT '',group_name TEXT DEFAULT '',subject TEXT DEFAULT 'english',
            teacher_id TEXT,assistant_teacher_id TEXT,lesson_day_of_week INTEGER,lesson_time TEXT DEFAULT '',lesson_duration INTEGER DEFAULT 15,extra_data JSONB DEFAULT '{}');
          CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,manager_id TEXT,status TEXT,language TEXT,extra_data JSONB DEFAULT '{}',deleted_at TIMESTAMPTZ);
          INSERT INTO hr_employees VALUES ('dilnoza','Dilnoza','dilnoza@x.uz','ingliz-oqituvchi','active','english');
          INSERT INTO students VALUES
            ('fer','Feruza Aliyeva','+998 90 1','','english','dilnoza',null,1,'14:00',60,'{"managerId":"m1","tariff":"60","monthlyPrice":300000}'),
            ('ali','Ali Valiyev','+998 90 2','','english','dilnoza',null,2,'10:00',30,'{}');`);
        await schema.initSchema(pool);
        await tx(c => S.setHours(c, admin, 'dilnoza', [1, 2, 3, 4, 5, 6].map(w => ({ weekday: w, from: '09:00', to: '20:00' }))));
        // Bugun (Ju 30-okt) 10:00–11:00 bir martalik dars — 11:00 da u tugagan.
        await tx(c => S.book(c, admin, { kind: 'once', teacherId: 'dilnoza', studentId: 'ali', date: '2026-10-30', time: '10:00', duration: 60 }, before));

        await t.test('checkWeekly: bugungi o\'tgan dars yangi Du·Ch·Ju 10:00 ni band qilmaydi', async () => {
            await tx(c => S.checkWeekly(c, { teacherId: 'dilnoza', day: 1, time: '10:00', duration: 60, excludeStudentId: 'fer', now }));
        });
        await t.test('so\'rov tekshiruvi (ROP "Tasdiqlash"): ok, bo\'sh vaqt bor', async () => {
            const r = await tx(c => O.edit(c, sales, 'fer', { reason: 'Ertalab qulay', changes: { lessonTime: '10:00' } }, { managerId: 'm1', now }));
            assert.equal(r.request.status, 'pending');
            assert.deepEqual(Object.keys(r.request.changes), ['lessonTime']);
            const chk = await tx(c => O.checkRequest(c, r.request.id, now));
            assert.equal(chk.ok, true, JSON.stringify(chk.checks));
            await pool.query(`UPDATE school_edit_requests SET status='rejected' WHERE id=$1`, [r.request.id]);
        });
        await t.test('kelajakdagi dars hali ham band qiladi', async () => {
            await tx(c => S.book(c, admin, { kind: 'once', teacherId: 'dilnoza', studentId: 'ali', date: '2026-11-02', time: '10:00', duration: 30 }, now));
            await assert.rejects(tx(c => S.checkWeekly(c, { teacherId: 'dilnoza', day: 1, time: '10:00', duration: 60, excludeStudentId: 'fer', now })), /2026-11-02.*band/);
        });
        await t.test('o\'zgarishsiz so\'rov (60 → 60) rad etiladi; o\'zgargan qism qoladi', async () => {
            await assert.rejects(tx(c => O.edit(c, sales, 'fer', { reason: 'Tarif tekshiruvi', changes: { lessonDuration: 60 } }, { managerId: 'm1', now })), e => e.status === 400 && /O'zgarish yo'q/.test(e.message));
            await assert.rejects(tx(c => O.edit(c, sales, 'fer', { reason: 'Tarif tekshiruvi', changes: { lessonDuration: 60, monthlyPrice: 300000, lessonDay: 1, lessonTime: '14:00' } }, { managerId: 'm1', now })), /O'zgarish yo'q/);
            await assert.rejects(tx(c => O.edit(c, sales, 'fer', { reason: 'Ustoz o\'sha', changes: { teacherId: 'dilnoza' } }, { managerId: 'm1', now })), /O'zgarish yo'q/);
            const r = await tx(c => O.edit(c, sales, 'fer', { reason: 'Narx o\'zgardi', changes: { lessonDuration: 60, monthlyPrice: 350000 } }, { managerId: 'm1', now }));
            assert.deepEqual(r.request.changes, { monthlyPrice: 350000 });
            assert.equal((await pool.query(`SELECT count(*)::int n FROM school_edit_requests WHERE student_id='fer' AND status='pending'`)).rows[0].n, 1);
        });
    } finally { await pool.end(); }
});
