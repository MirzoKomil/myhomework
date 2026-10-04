const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { Pool } = require('pg');
const roles = require('../js/teacherRoles');
const duties = require('../server/services/teacherDuties');
const payroll = require('../server/services/payroll');
const engine = require('../js/payrollEngine');
const { functionSource } = require('./helpers/lead-workflow-fixture.cjs');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (parsed.hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(parsed.pathname)) throw Error('Only disposable loopback DBs');
}
test('real PostgreSQL dual-role identity, attendance, HR and payroll integration', { skip: !url }, async t => {
  const pool = new Pool({ connectionString: url });
  const actor = { id: 'ua', role: 'teacher', name: 'A' }, admin = { id: 'admin', role: 'admin', name: 'Admin' };
  const tx = async fn => {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const value = await fn(client); await client.query('COMMIT'); return value; }
    catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  };
  try {
    await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,avatar TEXT);
      CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,role TEXT,lang TEXT,login TEXT,department TEXT,status TEXT,start_date TEXT,join_date TEXT,
        first_name TEXT,last_name TEXT,phone TEXT,email TEXT,gender TEXT,birth_date TEXT,card_number TEXT,passport_series TEXT,pinfl TEXT,address TEXT,trial_group_link TEXT);
      CREATE TABLE teachers(id TEXT PRIMARY KEY,name TEXT,type TEXT,subject TEXT,schedule_pattern TEXT,lesson_duration INTEGER);
      CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,subject TEXT,teacher_id TEXT,assistant_teacher_id TEXT,lesson_duration INTEGER,extra_data JSONB);
      CREATE TABLE main_attendance(att_key TEXT,student_id TEXT,day INTEGER,present INTEGER,PRIMARY KEY(att_key,student_id,day));
      CREATE TABLE assistant_attendance(LIKE main_attendance INCLUDING ALL);
      CREATE TABLE leads(id TEXT PRIMARY KEY,manager_id TEXT,status TEXT,language TEXT,deleted_at TIMESTAMPTZ,extra_data JSONB);
      CREATE TABLE json_data(key TEXT PRIMARY KEY,data JSONB);
      CREATE TABLE mobile_content(singleton INTEGER PRIMARY KEY,data JSONB);
      INSERT INTO users VALUES('admin','Admin','admin','admin',''),('ua','A','a-login','teacher',''),('ub','B','b-login','teacher','');
      INSERT INTO hr_employees(id,name,role,lang,login,status,start_date) VALUES
        ('a','A','ingliz-oqituvchi','english','a-login','active','2026-09-01'),('b','B','ingliz-oqituvchi','english','b-login','active','2026-09-01');
      INSERT INTO teachers VALUES('a','A','asosiy','english','mwf',30),('b','B','asosiy','english','mwf',60);
      INSERT INTO students VALUES('main','Main','english','a','b',30,'{}'),('assist','Assist','english','b','a',60,'{}');`);
    await duties.initSchema(pool); await payroll.initSchema(pool);
    const requireSafe = name => name === '../js/teacherRoles' ? roles : name === '../js/payrollEngine' ? engine : (() => { throw Error(name); })();
    const context = vm.createContext({ tx, teacherDuties: duties, require: requireSafe, payroll,
      isUsableList: Array.isArray, guardBulkDelete: async () => {},
      saveJsonData: async (db, key, data) => db.query('INSERT INTO json_data(key,data) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data', [key, JSON.stringify(data)]) });
    vm.runInContext(['recordTeacherAttendance', 'saveHrEmployeesData'].map(n => functionSource('server/db.js', n)).join('\n'), context);
    const mark = (studentId, duty, day, present = true) => context.recordTeacherAttendance({ actor, teacherId: 'a', studentId,
      attendanceType: duty, date: `2026-10-${String(day).padStart(2, '0')}`, present });
    await t.test('migration defaults off, is repeatable and HR saves/audits dual role on the same user identity', async () => {
      await duties.initSchema(pool);
      assert.equal((await pool.query("SELECT dual_role FROM hr_employees WHERE id='a'")).rows[0].dual_role, false);
      await tx(db => context.saveHrEmployeesData(db, [{ id: 'a', name: 'A', role: 'ingliz-oqituvchi', login: 'a-login', dualRole: true, startDate: '2026-09-01' },
        { id: 'b', name: 'B', role: 'ingliz-oqituvchi', login: 'b-login', dualRole: true, startDate: '2026-09-01' }], admin));
      assert.equal((await duties.teacherForActor(pool, actor)).id, 'a');
      assert.equal((await duties.teacherForActor(pool, actor)).dualRole, true);
      assert.equal((await pool.query('SELECT COUNT(*) FROM users')).rows[0].count, '3');
      assert.ok((await pool.query("SELECT after_data FROM salary_audit WHERE entity_id='a'")).rows[0].after_data.dualRole);
    });
    await t.test('cross assignments validate, same-person assignment fails and disabling preserves existing assignment', async () => {
      await duties.validateAssignment(pool, { teacherId: 'b', assistantTeacherId: 'a', subject: 'english' });
      await duties.validateAssignment(pool, { teacherId: 'a', assistantTeacherId: 'b', subject: 'english' });
      await assert.rejects(duties.validateAssignment(pool, { teacherId: 'a', assistantTeacherId: 'a' }), /bir shaxs/);
      await pool.query("UPDATE hr_employees SET dual_role=false WHERE id='a'");
      await assert.rejects(duties.validateAssignment(pool, { teacherId: 'b', assistantTeacherId: 'a' }), /HR/);
      await duties.validateAssignment(pool, { teacherId: 'b', assistantTeacherId: 'a' }, { assistantTeacherId: 'a' });
    });
    await t.test('assistant marks, absence and repeats never change primary attendance or main grades', async () => {
      const grades = { assist: [{ teacherId: 'b', date: '2026-10-01', scores: { speaking: 5 } }] };
      await pool.query("INSERT INTO json_data VALUES('liveGrades',$1)", [JSON.stringify(grades)]);
      await pool.query("INSERT INTO main_attendance VALUES('2026-10_b','assist',1,1)");
      await mark('assist', 'assistant', 1); await mark('assist', 'assistant', 1);
      await mark('assist', 'assistant', 2, false);
      assert.deepEqual((await pool.query('SELECT day,present FROM assistant_attendance ORDER BY day')).rows, [{ day: 1, present: 1 }, { day: 2, present: 0 }]);
      assert.deepEqual((await pool.query("SELECT data FROM json_data WHERE key='liveGrades'")).rows[0].data, grades);
      assert.equal((await pool.query("SELECT COUNT(*) FROM main_attendance WHERE att_key='2026-10_b'")).rows[0].count, '1');
      await assert.rejects(mark('assist', 'main', 1), /biriktirilmagan/);
      await assert.rejects(mark('main', 'assistant', 1), /biriktirilmagan/);
      await assert.rejects(context.recordTeacherAttendance({ actor, teacherId: 'b', studentId: 'assist', date: '2026-10-01', present: true, attendanceType: 'main' }), /o'zingizga/);
    });
    await t.test('simultaneous marks at the cap cannot overcount assistant lessons', async () => {
      await pool.query("UPDATE salary_kpi_settings SET data=jsonb_set(data,'{assistant,maxLessons}','2') WHERE language='english'");
      const settled = await Promise.allSettled([mark('assist', 'assistant', 3), mark('assist', 'assistant', 4)]);
      assert.equal(settled.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal((await pool.query('SELECT COUNT(*) FROM assistant_attendance WHERE present=1')).rows[0].count, '2');
      await pool.query("UPDATE salary_kpi_settings SET data=jsonb_set(data,'{assistant,maxLessons}','0') WHERE language='english'");
    });
    await t.test('main marks retain required grade validation; one payroll row includes both duties and historical basis', async () => {
      await assert.rejects(mark('main', 'main', 2), /baholar/);
      await pool.query("INSERT INTO main_attendance VALUES('2026-10_a','main',2,1)");
      const result = await payroll.preview(pool, admin, { start: '2026-10-01', end: '2026-10-31', language: 'english' });
      const row = result.rows.find(r => r.employeeId === 'a');
      assert.equal(row.mainTotal, Math.round(150000 / 13));
      assert.equal(row.assistantTotal, Math.round(50000 * 2 / 13));
      assert.equal(row.total, row.mainTotal + row.assistantTotal);
      assert.equal(result.rows.filter(r => r.employeeId === 'a').length, 1);
      await payroll.accrue(pool, admin, { start: '2026-10-01', end: '2026-10-31', language: 'english', sourceHash: result.sourceHash });
      const basis = (await pool.query("SELECT basis FROM salary_transactions WHERE employee_id='a'")).rows[0].basis;
      assert.equal(basis.academicPolicy, 'dual-role-v1');
      assert.deepEqual(basis.students.map(s => s.id), ['assist', 'main']);
    });
    await t.test('attendance write and its audit roll back together', async () => {
      await pool.query("CREATE FUNCTION reject_duty_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='assistant-attendance' THEN RAISE EXCEPTION 'Audit failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER reject_duty_audit BEFORE INSERT ON salary_audit FOR EACH ROW EXECUTE FUNCTION reject_duty_audit();");
      await assert.rejects(mark('assist', 'assistant', 5), /Audit failure/);
      assert.equal((await pool.query('SELECT COUNT(*) FROM assistant_attendance WHERE day=5')).rows[0].count, '0');
    });
  } finally { await pool.end(); }
});
