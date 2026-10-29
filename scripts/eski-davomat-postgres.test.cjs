// Haqiqiy PostgreSQL: eski Davomat belgilarini ko'chirish migratsiyasi (server/services/school/legacyAttendance.migrate).
// main_attendance (CRM /api/state, Davomat, maosh — hammasi shu jadvaldan), json_data.liveGrades, salary_audit, school_migrations.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const payroll = require('../server/services/payroll');
const engine = require('../js/payrollEngine');
const L = require('../server/services/school/legacyAttendance');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url) {
    const parsed = new URL(url);
    if (parsed.hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(parsed.pathname)) throw Error('Only disposable loopback DBs');
}
const NOW = new Date('2026-10-30T10:00:00Z'); // Toshkent: 2026-10-30
const quiet = { lines: [], log(m) { this.lines.push(m); }, warn(m) { this.lines.push(m); } };

test('real PostgreSQL: eski Du·Ch·Ju belgilari Se·Pa·Sh kunlariga — audit, yakuniy oy, qayta ishga tushish, maosh bilan bir xil', { skip: !url }, async () => {
    const pool = new Pool({ connectionString: url });
    try {
        await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,avatar TEXT);
          CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,role TEXT,lang TEXT,login TEXT,department TEXT,status TEXT,start_date TEXT,join_date TEXT,
            end_date TEXT,dual_role BOOLEAN);
          CREATE TABLE teachers(id TEXT PRIMARY KEY,name TEXT,type TEXT,subject TEXT,schedule_pattern TEXT,lesson_duration INTEGER);
          CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,subject TEXT,teacher_id TEXT,assistant_teacher_id TEXT,lesson_duration INTEGER,extra_data JSONB,lesson_day_of_week INTEGER,lesson_time TEXT);
          CREATE TABLE main_attendance(att_key TEXT NOT NULL,student_id TEXT NOT NULL,day INTEGER NOT NULL,present INTEGER DEFAULT 1,PRIMARY KEY(att_key,student_id,day));
          CREATE TABLE assistant_attendance(LIKE main_attendance INCLUDING ALL);
          CREATE TABLE leads(id TEXT PRIMARY KEY,manager_id TEXT,status TEXT,language TEXT,deleted_at TIMESTAMPTZ,extra_data JSONB);
          CREATE TABLE json_data(key TEXT PRIMARY KEY,data JSONB);
          CREATE TABLE school_absences(teacher_id TEXT NOT NULL,student_id TEXT NOT NULL,day DATE NOT NULL,absent BOOLEAN NOT NULL DEFAULT TRUE,PRIMARY KEY(teacher_id,student_id,day));
          CREATE TABLE fin_period_locks(month TEXT PRIMARY KEY);
          INSERT INTO hr_employees(id,name,role,lang,login,status,start_date) VALUES
            ('m','Mohinur','ingliz-oqituvchi','english','m','active','2026-01-01'),('k','Komiljon','ingliz-oqituvchi','english','k','active','2026-01-01');
          INSERT INTO teachers VALUES('m','Mohinur','asosiy','english','mwf',30),('k','Komiljon','asosiy','english','mwf',30);
          INSERT INTO students VALUES
            ('sps','Se·Pa·Sh','english','m',NULL,30,'{"startDate":"2026-09-24"}',2,'10:00'),
            ('late','Kech','english','m',NULL,30,'{"startDate":"2026-10-05"}',4,'11:00'),
            ('dcj','Du·Ch·Ju','english','m',NULL,30,'{"startDate":"2026-09-01"}',1,'12:00'),
            ('ks','Komil Se·Pa·Sh','english','k',NULL,30,'{"startDate":"2026-09-01"}',6,'13:00');
          INSERT INTO json_data VALUES('liveGrades','{"sps":[{"date":"2026-10-02","teacherId":"m","lessonId":"l1"},{"date":"2026-10-05","teacherId":"m","lessonId":"l2"}]}');`);
        const ins = async (key, sid, days) => { for (const d of days) await pool.query('INSERT INTO main_attendance VALUES($1,$2,$3,1)', [key, sid, d]); };
        await ins('2026-10_m', 'sps', [2, 5, 7, 9, 12]);
        await ins('2026-10_m', 'late', [2, 5, 7, 9, 12, 14, 16, 19]);
        await ins('2026-10_m', 'dcj', [2, 5, 7, 9]);
        await ins('2026-09_m', 'sps', [25, 28]);       // Mohinur sentyabr maoshi to'langan — yakuniy
        await ins('2026-09_k', 'ks', [2, 4, 7, 9]);    // Komiljon sentyabr: to'lanmagan, lekin moliya yopgan (fin_period_locks) — yakuniy
        await ins('2026-10_k', 'ks', [2, 5, 7]);
        await payroll.initSchema(pool);
        await pool.query(`INSERT INTO salary_transactions(id,employee_id,language,period_start,period_end,amount,calculation,source_hash,status)
            VALUES('p9','m','english','2026-09-01','2026-09-30',1,'{}','x','paid'),('u10','m','english','2026-10-01','2026-10-31',1,'{}','x','unpaid')`);
        await pool.query(`INSERT INTO fin_period_locks VALUES('2026-09')`);
        await pool.query(`INSERT INTO school_absences VALUES('k','ks','2026-10-03',TRUE)`); // 3-okt "Kelmadi" — band
        const before = (await pool.query('SELECT att_key,student_id,day,present FROM main_attendance ORDER BY 1,2,3')).rows;

        // Maosh (oktyabr, 'approved-v1': faqat o'z dars kunidagi "Keldi") — ko'chirishdan oldin Se·Pa·Sh belgilari 0.
        const period = engine.period('2026-10-01', '2026-10-31');
        const lessons = async () => {
            const src = await payroll.sources(pool, period);
            const cfg = await payroll.settings(pool, 'english');
            const rows = engine.calculate(src, cfg.data, period, 'english').rows;
            return Object.fromEntries(rows.filter(r => ['m', 'k'].includes(r.employeeId)).map(r => [r.employeeId, r.mainLessons]));
        };
        assert.deepEqual(await lessons(), { m: 4, k: 0 });

        const res = await L.migrate(pool, { log: quiet, now: NOW });
        const days = async (key, sid) => (await pool.query('SELECT day FROM main_attendance WHERE att_key=$1 AND student_id=$2 ORDER BY day', [key, sid])).rows.map(r => r.day);
        assert.deepEqual(await days('2026-10_m', 'sps'), [1, 3, 6, 8, 10]);
        assert.deepEqual(await days('2026-10_m', 'late'), [6, 8, 10, 13, 15, 17, 20, 22]);
        assert.deepEqual(await days('2026-10_m', 'dcj'), [2, 5, 7, 9]);
        assert.deepEqual(await days('2026-09_m', 'sps'), [25, 28]);
        assert.deepEqual(await days('2026-09_k', 'ks'), [2, 4, 7, 9]);
        assert.deepEqual(await days('2026-10_k', 'ks'), [1, 6, 8]); // 3-okt "Kelmadi" — o'tkazib yuborildi
        assert.equal(res.moved, 16);
        assert.ok(quiet.lines.includes("[eski-davomat] 2026-09 yakuniy — o'zgartirilmadi: 6 belgi"), quiet.lines.join('\n'));
        assert.ok(quiet.lines.includes("[eski-davomat] 2026-10 Mohinur: 13 belgi ko'chirildi, 0 joylashmadi"), quiet.lines.join('\n'));
        assert.ok(quiet.lines.includes("[eski-davomat] 2026-10 Komiljon: 3 belgi ko'chirildi, 0 joylashmadi"), quiet.lines.join('\n'));

        // Jonli dars yozuvlari ham ko'chdi.
        const lg = (await pool.query("SELECT data FROM json_data WHERE key='liveGrades'")).rows[0].data;
        assert.deepEqual(lg.sps.map(g => g.date), ['2026-10-01', '2026-10-03']);

        // Audit: asl blok to'liq saqlangan — undan qaytarib tiklash mumkin.
        const audits = (await pool.query("SELECT entity_id,before_data,after_data FROM salary_audit WHERE action=$1 ORDER BY id", [L.ACTION])).rows;
        assert.deepEqual(audits.map(a => a.entity_id), ['2026-10_k', '2026-10_m', 'done']);
        const am = audits.find(a => a.entity_id === '2026-10_m');
        assert.deepEqual(am.before_data.block.sps, { 2: 1, 5: 1, 7: 1, 9: 1, 12: 1 });
        assert.deepEqual(am.before_data.block.dcj, { 2: 1, 5: 1, 7: 1, 9: 1 });
        assert.equal(am.before_data.liveGrades.sps[0].date, '2026-10-02');
        assert.deepEqual(am.after_data.students.find(s => s.id === 'sps').moves[0], { from: '2026-10-02', to: '2026-10-01', value: 1 });
        const restored = [];
        for (const a of audits.filter(a => a.entity_id !== 'done')) for (const [sid, ds] of Object.entries(a.before_data.block))
            for (const [d, v] of Object.entries(ds)) restored.push(`${a.entity_id}|${sid}|${d}|${v}`);
        const orig = before.filter(r => ['2026-10_m', '2026-10_k'].includes(r.att_key)).map(r => `${r.att_key}|${r.student_id}|${r.day}|${r.present}`);
        assert.deepEqual(restored.sort(), orig.sort());

        // Maosh endi ko'chirilgan belgilarni sanaydi (Davomat bilan bir xil manba — main_attendance).
        assert.deepEqual(await lessons(), { m: 17, k: 3 });

        // Qayta ishga tushish — hech narsa o'zgarmaydi.
        const snap = (await pool.query('SELECT * FROM main_attendance ORDER BY 1,2,3')).rows;
        const again = await L.migrate(pool, { log: quiet, now: NOW });
        assert.equal(again.skipped, 'already-done');
        assert.deepEqual((await pool.query('SELECT * FROM main_attendance ORDER BY 1,2,3')).rows, snap);
        assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM salary_audit WHERE action=$1', [L.ACTION])).rows[0].n, 3);

        // Parallel ikki jarayon ham faqat bir marta bajaradi (marker qatori).
        await pool.query("DELETE FROM school_migrations WHERE id=$1", [L.MIGRATION_ID]);
        const third = await L.migrate(pool, { log: quiet, now: NOW }); // salary_audit markeri bor — baribir o'tkazib yuboriladi
        assert.equal(third.skipped, 'already-done');
    } finally { await pool.end(); }
});
