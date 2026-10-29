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
// 29-okt qarori bo'yicha yangilangan: yordamchi ustoz — alohida lavozim (HR role 'yordamchi'); asosiy ustoz yordamchi
// bo'la olmaydi; baho qo'yilmaydi (27-okt) — "Keldi" faqat jonli dars belgisi; asosiy ustoz davomati faqat dars kunida,
// kelajakka yo'q; o'quvchi muzlatilgan/chiqib ketgan kunga davomat yo'q va maosh uni sanamaydi.
test('real PostgreSQL: alohida yordamchi lavozimi, davomat, HR va maosh integratsiyasi', { skip: !url }, async t => {
  const pool = new Pool({ connectionString: url });
  const teacherA = { id: 'ua', role: 'teacher', name: 'A' }, assistantY = { id: 'uy', role: 'teacher', name: 'Y' }, admin = { id: 'admin', role: 'admin', name: 'Admin' };
  const tx = async fn => {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const value = await fn(client); await client.query('COMMIT'); return value; }
    catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  };
  try {
    await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,avatar TEXT);
      CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,role TEXT,lang TEXT,login TEXT,department TEXT,status TEXT,start_date TEXT,join_date TEXT,
        first_name TEXT,last_name TEXT,phone TEXT,email TEXT,gender TEXT,birth_date TEXT,card_number TEXT,passport_series TEXT,pinfl TEXT,address TEXT,trial_group_link TEXT,
        end_date TEXT,offboarded_at TIMESTAMPTZ,offboarded_by TEXT,offboard_reason TEXT);
      CREATE TABLE teachers(id TEXT PRIMARY KEY,name TEXT,type TEXT,subject TEXT,schedule_pattern TEXT,lesson_duration INTEGER);
      CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,subject TEXT,teacher_id TEXT,assistant_teacher_id TEXT,lesson_duration INTEGER,extra_data JSONB,lesson_day_of_week INTEGER,lesson_time TEXT);
      CREATE TABLE main_attendance(att_key TEXT,student_id TEXT,day INTEGER,present INTEGER,PRIMARY KEY(att_key,student_id,day));
      CREATE TABLE assistant_attendance(LIKE main_attendance INCLUDING ALL);
      CREATE TABLE leads(id TEXT PRIMARY KEY,manager_id TEXT,status TEXT,language TEXT,deleted_at TIMESTAMPTZ,extra_data JSONB);
      CREATE TABLE json_data(key TEXT PRIMARY KEY,data JSONB);
      CREATE TABLE mobile_content(singleton INTEGER PRIMARY KEY,data JSONB);
      CREATE TABLE school_student_status(id TEXT PRIMARY KEY,student_id TEXT NOT NULL,status TEXT NOT NULL,from_date DATE NOT NULL,to_date DATE,
        reason TEXT,cancelled_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      INSERT INTO users VALUES('admin','Admin','admin','admin',''),('ua','A','a-login','teacher',''),('ub','B','b-login','teacher',''),('uy','Y','y-login','teacher','');
      INSERT INTO hr_employees(id,name,role,lang,login,status,start_date) VALUES
        ('a','A','ingliz-oqituvchi','english','a-login','active','2026-09-01'),('b','B','ingliz-oqituvchi','english','b-login','active','2026-09-01'),
        ('y','Y','yordamchi','english','y-login','active','2026-09-01');
      INSERT INTO teachers VALUES('a','A','asosiy','english','mwf',30),('b','B','asosiy','english','mwf',60);
      INSERT INTO students VALUES('main','Main','english','a','y',30,'{}',1,'10:00'),('assist','Assist','english','b','y',60,'{}',1,'11:00'),
        ('froz','Froz','english','a',NULL,30,'{"frozen":true}',1,'12:00');
      INSERT INTO school_student_status(id,student_id,status,from_date,to_date) VALUES('fz','froz','frozen','2026-10-12','2026-11-10');
      INSERT INTO mobile_content VALUES(1,'{"courses":[{"id":"en","lang":"english"}],"lessons":[{"id":"video","courseId":"en"},{"id":"speaking","courseId":"en"},{"id":"v2","courseId":"en"},{"id":"s2","courseId":"en"}]}');`);
    await duties.initSchema(pool); await payroll.initSchema(pool);
    const rules = require('../server/services/teacherAttendanceRules');
    const requireSafe = name => name === '../js/teacherRoles' ? roles : name === '../js/payrollEngine' ? engine
      : name === './services/liveLessonPick' ? require('../server/services/liveLessonPick')
      : name === './services/domworkBot/events' ? require('../server/services/domworkBot/events')
      : name === './services/stateScope' ? require('../server/services/stateScope')
      : name === './services/staffAttendance/lessons' ? { recordMark: async () => {} } : (() => { throw Error(name); })();
    // "Bugun" — 2026-10-29 (Toshkent 15:00) qotirilgan: oy yopilishi va kelajak qoidasi testni sanaga bog'lamasin.
    const NOW = new Date('2026-10-29T10:00:00Z');
    const context = vm.createContext({ tx, teacherDuties: duties, require: requireSafe, payroll,
      assertTeacherAttendanceWindow: (c, o) => rules.assertTeacherAttendanceWindow(c, { ...o, now: NOW }),
      isUsableList: Array.isArray, guardBulkDelete: async () => {}, staffLifecycle: require('../server/services/staffLifecycle'),
      schoolSchema: { state: { ready: false } },
      replaceSnapshotRows: async (c, table, _label, incoming) => { const ids = (incoming || []).map(i => i.id); if (ids.length) await c.query(`DELETE FROM ${table} WHERE id = ANY($1)`, [ids]); return []; },
      saveJsonData: async (db, key, data) => db.query('INSERT INTO json_data(key,data) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data', [key, JSON.stringify(data)]) });
    vm.runInContext(['recordTeacherAttendance', 'saveHrEmployeesData'].map(n => functionSource('server/db.js', n)).join('\n'), context);
    const d = day => `2026-10-${String(day).padStart(2, '0')}`;
    const markMain = (studentId, day, present = true) => context.recordTeacherAttendance({ actor: teacherA, teacherId: 'a', studentId, attendanceType: 'main', date: d(day), present });
    const markAsst = (studentId, day, present = true) => context.recordTeacherAttendance({ actor: assistantY, teacherId: 'y', studentId, attendanceType: 'assistant', date: d(day), present });
    const oct = { start: '2026-10-01', end: '2026-10-31', language: 'english' };
    await t.test('dual_role ustuni xavfsiz qo\'shiladi; asosiy ustozga yordamchilik yoqib bo\'lmaydi, u yordamchi pool\'iga kirmaydi', async () => {
      await duties.initSchema(pool);
      assert.equal((await pool.query("SELECT dual_role FROM hr_employees WHERE id='a'")).rows[0].dual_role, false);
      const hr = dual => [{ id: 'a', name: 'A', role: 'ingliz-oqituvchi', login: 'a-login', dualRole: dual, startDate: '2026-09-01' },
        { id: 'b', name: 'B', role: 'ingliz-oqituvchi', login: 'b-login', startDate: '2026-09-01' },
        { id: 'y', name: 'Y', role: 'yordamchi', lang: 'english', login: 'y-login', startDate: '2026-09-01' }];
      await assert.rejects(tx(db => context.saveHrEmployeesData(db, hr(true), admin)), /yordamchi ustoz bo‘la olmaydi/);
      await tx(db => context.saveHrEmployeesData(db, hr(false), admin));
      assert.equal((await duties.teacherForActor(pool, teacherA)).id, 'a');
      assert.equal(roles.isAssistant(await duties.teacherForActor(pool, teacherA)), false);
      assert.equal(roles.isAssistant(await duties.teacherForActor(pool, assistantY)), true);
      const employees = (await pool.query('SELECT * FROM hr_employees')).rows.map(duties.employee);
      assert.deepEqual(roles.pool(employees, [], 'yordamchi', 'english').map(e => e.id), ['y']);
      assert.equal((await pool.query('SELECT COUNT(*) FROM users')).rows[0].count, '4');
    });
    await t.test('biriktirish: yordamchi faqat yordamchi lavozimidan; asosiy ustoz — rad; bir shaxs ikki rolda — rad; eski biriktirish saqlanadi', async () => {
      await duties.validateAssignment(pool, { teacherId: 'b', assistantTeacherId: 'y', subject: 'english' });
      await assert.rejects(duties.validateAssignment(pool, { teacherId: 'b', assistantTeacherId: 'a', subject: 'english' }), /yordamchi ustoz bo‘la olmaydi/);
      await assert.rejects(duties.validateAssignment(pool, { teacherId: 'a', assistantTeacherId: 'a' }), /bir shaxs/);
      await duties.validateAssignment(pool, { teacherId: 'b', assistantTeacherId: 'a' }, { teacherId: 'b', assistantTeacherId: 'a' });
    });
    await t.test('yordamchi belgilari asosiy davomat va jonli dars belgilariga tegmaydi; rollar bir-birining davomatini yozmaydi', async () => {
      const grades = { assist: [{ teacherId: 'b', date: d(5), lessonId: 'speaking' }] };
      await pool.query("INSERT INTO json_data VALUES('liveGrades',$1)", [JSON.stringify(grades)]);
      await pool.query("INSERT INTO main_attendance VALUES('2026-10_b','assist',5,1)");
      await markAsst('assist', 6); await markAsst('assist', 6); await markAsst('assist', 7, false);
      assert.deepEqual((await pool.query('SELECT day,present FROM assistant_attendance ORDER BY day')).rows, [{ day: 6, present: 1 }, { day: 7, present: 0 }]);
      assert.deepEqual((await pool.query("SELECT data FROM json_data WHERE key='liveGrades'")).rows[0].data, grades);
      assert.equal((await pool.query("SELECT COUNT(*) FROM main_attendance WHERE att_key='2026-10_b'")).rows[0].count, '1');
      await assert.rejects(context.recordTeacherAttendance({ actor: assistantY, teacherId: 'y', studentId: 'assist', attendanceType: 'main', date: d(5), present: true }), /asosiy davomatni o‘zgartira olmaydi/);
      await assert.rejects(context.recordTeacherAttendance({ actor: teacherA, teacherId: 'a', studentId: 'main', attendanceType: 'assistant', date: d(5), present: true }), /yordamchi davomatini belgilamaydi/);
      await assert.rejects(markMain('assist', 5), /biriktirilmagan/);
      await assert.rejects(context.recordTeacherAttendance({ actor: teacherA, teacherId: 'b', studentId: 'assist', date: d(5), present: true, attendanceType: 'main' }), /o'zingizga/);
    });
    await t.test('bir vaqtdagi ikki belgi yordamchi oylik chegarasidan oshmaydi', async () => {
      await pool.query("UPDATE salary_kpi_settings SET data=jsonb_set(data,'{assistant,maxLessons}','2') WHERE language='english'");
      const settled = await Promise.allSettled([markAsst('assist', 8), markAsst('assist', 9)]);
      assert.equal(settled.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal((await pool.query('SELECT COUNT(*) FROM assistant_attendance WHERE present=1')).rows[0].count, '2');
      await pool.query("UPDATE salary_kpi_settings SET data=jsonb_set(data,'{assistant,maxLessons}','0') WHERE language='english'");
    });
    await t.test('asosiy ustoz: faqat dars kuni va o\'tgan kun; Keldi jonli darsni belgilaydi, olib tashlash boshqa ustozga tegmaydi; maosh = ulush ÷ 13 × o\'tilgan', async () => {
      const other = { teacherId: 'b', date: d(5), lessonId: 'speaking' };
      await pool.query("UPDATE json_data SET data=jsonb_set(data,'{main}',$1) WHERE key='liveGrades'", [JSON.stringify([other])]);
      await assert.rejects(markMain('main', 4), /dars kuni emas/); // yakshanba
      await assert.rejects(markMain('main', 30), /Kelajak/);
      await markMain('main', 5); await markMain('main', 7); await markMain('main', 7);
      let grades = (await pool.query("SELECT data FROM json_data WHERE key='liveGrades'")).rows[0].data.main;
      assert.equal(grades.filter(g => g.teacherId === 'a' && g.date === d(7)).length, 1);
      assert.equal(grades.find(g => g.teacherId === 'a' && g.date === d(5)).lessonId, 'speaking');
      assert.deepEqual(grades.find(g => g.teacherId === 'b'), other);
      const salary = (await payroll.preview(pool, admin, oct)).rows.find(r => r.employeeId === 'a');
      assert.equal(salary.mainTotal, Math.round(150000 * 2 / 13));
      assert.equal((await markMain('main', 7, null)).present, null);
      grades = (await pool.query("SELECT data FROM json_data WHERE key='liveGrades'")).rows[0].data.main;
      assert.equal(grades.some(g => g.teacherId === 'a' && g.date === d(7)), false);
      assert.deepEqual(grades.find(g => g.teacherId === 'b'), other);
      await assert.rejects(context.recordTeacherAttendance({ actor: teacherA, teacherId: 'a', studentId: 'main', date: '2026-02-30', present: null }), /sana/);
      await assert.rejects(context.recordTeacherAttendance({ actor: teacherA, teacherId: 'a', studentId: 'main', date: '2026-09-30', present: true }), /yopilgan/);
    });
    await t.test('muzlatilgan kunga Keldi/Kelmadi — 409; muzlatishdan oldingi dars kuni — yoziladi; maosh muzlatilgan kundagi eski belgini sanamaydi', async () => {
      await assert.rejects(markMain('froz', 14), /muzlatilgan/);
      await assert.rejects(markMain('froz', 14, false), /muzlatilgan/);
      await markMain('froz', 9);
      // Eski (qoida kiritilishidan oldingi) yozuv: muzlatilgan 19-okt — maoshga kirmaydi.
      await pool.query("INSERT INTO main_attendance VALUES('2026-10_a','froz',19,1)");
      const row = (await payroll.preview(pool, admin, oct)).rows.find(r => r.employeeId === 'a');
      const fz = row.breakdown.find(b => b.studentId === 'froz');
      assert.equal(fz.lessons, 1);
      assert.equal(fz.earned, Math.round(150000 / 13));
      await pool.query("DELETE FROM main_attendance WHERE student_id='froz'");
    });
    await t.test('yordamchi belgisini aniq olib tashlash audit bilan; asosiy belgilar o\'zgarmaydi', async () => {
      const before = (await pool.query("SELECT data FROM json_data WHERE key='liveGrades'")).rows[0].data;
      await markAsst('assist', 7, null);
      await markAsst('assist', 28); await markAsst('assist', 28, false); await markAsst('assist', 28, null);
      assert.equal((await pool.query('SELECT COUNT(*) FROM assistant_attendance WHERE day IN (7,28)')).rows[0].count, '0');
      assert.deepEqual((await pool.query("SELECT data FROM json_data WHERE key='liveGrades'")).rows[0].data, before);
      const audit = (await pool.query("SELECT after_data FROM salary_audit WHERE action='assistant-attendance' AND entity_id='2026-10_y:assist:28' ORDER BY created_at DESC,id DESC LIMIT 1")).rows[0];
      assert.equal(audit.after_data.present, null);
    });
    await t.test('maosh: asosiy ustozda bitta qator (yordamchilik yo\'q); asos snapshot siyosatlari bilan', async () => {
      const result = await payroll.preview(pool, admin, oct);
      const row = result.rows.find(r => r.employeeId === 'a');
      assert.equal(row.mainTotal, Math.round(150000 / 13));
      assert.equal(row.assistantTotal || 0, 0);
      assert.equal(result.rows.filter(r => r.employeeId === 'a').length, 1);
      await payroll.accrue(pool, admin, { ...oct, sourceHash: result.sourceHash });
      const basis = (await pool.query("SELECT basis FROM salary_transactions WHERE employee_id='a'")).rows[0].basis;
      assert.equal(basis.makeupPolicy, 'approved-v1');
      assert.equal(basis.teacherAttendancePolicy, 'all-days-v1');
      assert.ok(basis.students.some(s => s.id === 'main'));
    });
    await t.test('to\'langan oyga keyingi belgi — moliya tasdiqlaydigan tuzatish taklifi; to\'langan summa o\'zgarmaydi', async () => {
      const original = (await pool.query("SELECT id,basis,amount FROM salary_transactions WHERE employee_id='a'")).rows[0];
      await payroll.markPaid(pool, admin, original.id);
      await markMain('main', 9);
      const next = { start: '2026-11-01', end: '2026-11-30', language: 'english' };
      const corrections = (await payroll.preview(pool, admin, next)).corrections;
      assert.equal(corrections.find(c => c.employeeId === 'a').status, 'pending');
      assert.ok(corrections.find(c => c.employeeId === 'a').amount > 0);
      assert.equal((await pool.query('SELECT amount FROM salary_transactions WHERE id=$1', [original.id])).rows[0].amount, original.amount);
      await markMain('main', 9, null);
    });
    await t.test('davomat yozuvi va uning auditi birga orqaga qaytadi', async () => {
      await pool.query("CREATE FUNCTION reject_duty_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='assistant-attendance' THEN RAISE EXCEPTION 'Audit failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER reject_duty_audit BEFORE INSERT ON salary_audit FOR EACH ROW EXECUTE FUNCTION reject_duty_audit();");
      await assert.rejects(markAsst('assist', 26), /Audit failure/);
      assert.equal((await pool.query('SELECT COUNT(*) FROM assistant_attendance WHERE day=26')).rows[0].count, '0');
    });
  } finally { await pool.end(); }
});
