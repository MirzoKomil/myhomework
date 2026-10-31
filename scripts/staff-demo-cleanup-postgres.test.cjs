// Xodim demo o'quvchilarini (isStaffDemo) bazadan tozalash — haqiqiy PostgreSQL'dagi integratsion test.
// Ishga tushirish: STAFF_DEMO_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/staff_demo_test_x node --test scripts/staff-demo-cleanup-postgres.test.cjs
// Faqat loopback va "staff_demo_test_*" nomli bir martalik bazaga ruxsat beriladi.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { isStaffDemoRow } = require('../server/services/staffDemoCleanup');

const url = process.env.STAFF_DEMO_TEST_DATABASE_URL;
if (url) {
    const parsed = new URL(url);
    if (!['127.0.0.1', 'localhost', ''].includes(parsed.hostname) || !/^\/staff_demo_test_[a-z0-9_]+$/.test(parsed.pathname)) {
        throw Error('Only disposable loopback staff_demo_test_* databases are allowed');
    }
    process.env.DATABASE_URL = url;
}

test('isStaffDemoRow faqat isStaffDemo belgisini tan oladi', () => {
    assert.equal(isStaffDemoRow({ isStaffDemo: true }), true);
    assert.equal(isStaffDemoRow({ isStaffDemo: 'true' }), true);
    assert.equal(isStaffDemoRow({ id: 'demo_x' }), false);
    assert.equal(isStaffDemoRow({ id: 's1' }), false);
    assert.equal(isStaffDemoRow(null), false);
});

test('xodim demo o\'quvchilari o\'chiriladi va qaytib yozilmaydi (PostgreSQL)', { skip: !url }, async () => {
    const db = require('../server/db');
    const cleanup = require('../server/services/staffDemoCleanup');
    const ctx = require('../server/services/archiveContext');
    await db.init();
    const pool = db.pool;
    const admin = (await pool.query("SELECT id, role, email FROM users WHERE role='admin' LIMIT 1")).rows[0];
    const actor = { id: admin.id, role: 'admin', email: admin.email, name: 'Admin' };

    await pool.query(`INSERT INTO students (id, name, subject, extra_data) VALUES
        ('s-real', 'Haqiqiy', 'english', '{}'),
        ('demo_hr-1', 'Xodim Bir', 'english', '{"isStaffDemo":true,"demoForEmployeeId":"hr-1"}'),
        ('demo_hr-2', 'Xodim Ikki', 'russian', '{"isStaffDemo":true,"demoForEmployeeId":"hr-2"}')`);
    await pool.query(`INSERT INTO student_learning_time (student_id, day, lesson_id, section, seconds)
        VALUES ('demo_hr-1', CURRENT_DATE, 'l1', 'video', 30), ('s-real', CURRENT_DATE, 'l1', 'video', 40)`).catch(() => {});

    const res = await cleanup.removeStaffDemoStudents(pool, { log() {}, warn() {} });
    assert.equal(res.removed, 2);
    const ids = (await pool.query('SELECT id FROM students ORDER BY id')).rows.map(r => r.id);
    assert.ok(ids.includes('s-real'), 'haqiqiy o\'quvchi qoladi');
    assert.ok(!ids.some(id => id.startsWith('demo_hr')), 'demo o\'quvchilar o\'chirildi');
    const lt = (await pool.query("SELECT student_id FROM student_learning_time")).rows.map(r => r.student_id);
    assert.ok(!lt.includes('demo_hr-1') && lt.includes('s-real'), 'faqat demo yetim qatorlari tozalandi');

    // Takroriy ishga tushish — hech narsa qilmaydi.
    assert.equal((await cleanup.removeStaffDemoStudents(pool, { log() {}, warn() {} })).removed, 0);

    // Eski brauzer nusxasi demo o'quvchini qaytarib yuborsa — yozilmaydi, haqiqiylari saqlanadi.
    const st = (await db.getFullState()).students;
    await ctx.runAs(actor, () => db.patchState({ students: [...st,
        { id: 'demo_hr-1', name: 'Xodim Bir', subject: 'english', isStaffDemo: true, demoForEmployeeId: 'hr-1' },
        { id: 's-new', name: 'Yangi', subject: 'english' }] }, actor));
    const after = (await db.getFullState()).students.map(s => s.id);
    assert.ok(!after.includes('demo_hr-1'), 'demo qayta yozilmadi');
    assert.ok(after.includes('s-new') && after.includes('s-real'));
    await pool.end?.();
});

// db.js fon taymerlari jarayonni ochiq ushlab turmasin.
after(() => { if (url) setTimeout(() => process.exit(process.exitCode || 0), 300).unref(); });
