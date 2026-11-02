// Jarimalar — haqiqiy PostgreSQL: davomatdan avtomatik, ogohlantirish, takrorlanmaslik, ko'rish huquqi,
// rahbar jarimasi (doira), e'tiroz, yuvish (tasdiq, 50% limit), admin sozlamasi keyingi oydan, moliya jami.
// Ishga tushirish: node scripts/run-payroll-postgres.cjs scripts/jarimalar-postgres.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const att = require('../server/services/staffAttendance');
const fines = require('../server/services/fines');
const time = require('../server/services/staffAttendance/time');

const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (parsed.hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(parsed.pathname)) throw Error('Only disposable loopback test databases are allowed');
}
const at = (date, clock) => time.atTashkent(date, time.parseClock(clock));
const user = id => ({ id });
const DAYS = Object.fromEntries([1, 2, 3, 4, 5, 6].map(k => [k, { start: '09:00', end: '18:00' }]));

test('jarimalar — PostgreSQL', { skip: !url }, async t => {
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,phone TEXT);
      CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,role TEXT,lang TEXT,login TEXT,status TEXT,phone TEXT,dual_role BOOLEAN);
      CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
      CREATE TABLE teachers(id TEXT PRIMARY KEY,schedule_pattern TEXT,lesson_duration INTEGER);
      CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,teacher_id TEXT,lesson_day_of_week INTEGER,lesson_time TEXT,lesson_duration INTEGER,extra_data JSONB DEFAULT '{}');
      CREATE TABLE domwork_learning_groups(id TEXT PRIMARY KEY,type TEXT,teacher_id TEXT,chat_id TEXT,archived BOOLEAN DEFAULT FALSE);
      CREATE TABLE domwork_bot_links(telegram_id TEXT PRIMARY KEY,account_kind TEXT,account_id TEXT,phone TEXT,paused BOOLEAN DEFAULT FALSE);
      CREATE TABLE domwork_bot_outbox(id TEXT PRIMARY KEY,unique_key TEXT UNIQUE,target_kind TEXT,target_id TEXT,role TEXT,method TEXT,payload JSONB,not_before TIMESTAMPTZ);
      CREATE TABLE salary_transactions(id TEXT PRIMARY KEY,employee_id TEXT,period_start DATE,period_end DATE,amount NUMERIC,status TEXT);
      INSERT INTO users(id,name,email,role) VALUES('boss','Abdulloh','boss','admin'),('rop-en','Kamola','rop-en','rop'),('rop-ru','Dilnoza','rop-ru','rop'),
        ('ali','Ali','ali','sales_manager'),('bek','Bek','bek','sales_manager'),('ak','Malika','ak','employee'),('yor','Javohir','yor','teacher'),('ust','Nodira','ust','teacher'),('hr','Hilola','hr','hr');
      INSERT INTO hr_employees(id,name,role,lang,login,status) VALUES('e-ren','Kamola','rop','english','rop-en','active'),('e-rru','Dilnoza','rop','russian','rop-ru','active'),
        ('e-ali','Ali Valiyev','sotuv-menejeri','english','ali','active'),('e-bek','Bek Ruslanov','sotuv-menejeri','russian','bek','active'),
        ('e-ak','Malika','head-of-teachers','english','ak','active'),('e-yor','Javohir','yordamchi','english','yor','active'),('e-ust','Nodira','ingliz-oqituvchi','english','ust','active'),
        ('e-hr','Hilola','hr','english','hr','active');
      INSERT INTO domwork_bot_links VALUES('333','user','ali','998',false);
      INSERT INTO salary_transactions VALUES('s1','e-ali','2026-10-01','2026-10-31',6200000,'unpaid');`);
    await att.initSchema(pool);
    await fines.initSchema(pool);
    for (const e of ['e-ali', 'e-bek']) await att.saveSchedule(pool, user('boss'), e, { days: DAYS });
    await pool.query("INSERT INTO staff_att_faces(employee_id,descriptors,state,submitted_by,first_approved_at) VALUES('e-ali','[]','approved','boss','2026-09-01'),('e-bek','[]','approved','boss','2026-09-01')");
    // Hisob 5-oktabrdan (undan oldingi kunlar "kelmadi" emas)
    await pool.query("UPDATE staff_att_schedules SET tracked_since='2026-10-04'");
    await pool.query("UPDATE staff_att_faces SET first_approved_at='2026-10-04'");
    await pool.query("UPDATE staff_att_schedules SET tracked_since='2026-11-01' WHERE employee_id='e-bek'");
    const ev = (emp, date, kind, clock) => pool.query(`INSERT INTO staff_att_events(id,employee_id,user_id,kind,work_date,occurred_at,ok) VALUES($1,$2,'x',$3,$4,$5,true)`,
      [`${emp}:${date}:${kind}`, emp, kind, date, at(date, clock)]);
    const rowsOf = async emp => (await pool.query("SELECT code,amount,warning,TO_CHAR(work_date,'YYYY-MM-DD') d FROM staff_fines WHERE employee_id=$1 ORDER BY work_date,code", [emp])).rows;

    await t.test('davomatdan avtomatik: 1-kechikish ogohlantirish, keyingisi jarima, erta ketish, kelmaslik; takror yozilmaydi; xabar', async () => {
      await ev('e-ali', '2026-10-05', 'in', '09:09'); await ev('e-ali', '2026-10-05', 'out', '18:05');   // 1-kechikish — ogohlantirish
      await ev('e-ali', '2026-10-06', 'in', '09:14'); await ev('e-ali', '2026-10-06', 'out', '18:01');   // 10 000
      await ev('e-ali', '2026-10-07', 'in', '08:55'); await ev('e-ali', '2026-10-07', 'out', '16:00');   // erta ketish 25 000
      // 2026-10-08 — kelmadi → 150 000; 2026-10-09 — tasdiqlangan "kelmayman" (sababli) — yo'q
      await pool.query(`INSERT INTO staff_att_requests(id,employee_id,user_id,type,work_date,reason,approver_kind,state) VALUES('rq','e-ali','ali','absent','2026-10-09','Kasallik','rop','approved')`);
      const r1 = await fines.tick(pool, at('2026-10-10', '12:00'));
      assert.ok(r1.created >= 4);
      const got = (await rowsOf('e-ali')).filter(r => r.d >= '2026-10-05' && r.d <= '2026-10-09');
      assert.deepEqual(got.map(r => [r.d, r.code, r.amount, r.warning]), [
        ['2026-10-05', 'late_1', 0, true], ['2026-10-06', 'late_1', 10000, false], ['2026-10-07', 'early_leave', 25000, false], ['2026-10-08', 'absent', 150000, false]]);
      await fines.tick(pool, at('2026-10-10', '12:05'));
      assert.equal((await rowsOf('e-ali')).filter(r => r.d >= '2026-10-05' && r.d <= '2026-10-09').length, 4, 'takror yozilmaydi');
      assert.equal((await rowsOf('e-ali')).filter(r => r.d < '2026-10-05').length, 0, 'hisob boshlanishidan oldin — yo‘q');
      const out = (await pool.query("SELECT unique_key FROM domwork_bot_outbox WHERE unique_key LIKE 'fine:%'")).rows;
      assert.ok(out.length >= 3, 'egasiga bot xabari (ogohlantirishdan tashqari)');
    });

    await t.test('Mening jarimalarim: maosh − jarimalar, 10% chegara, faqat egasi/rahbari/admin ko‘radi', async () => {
      const m = await fines.mine(pool, user('ali'), '2026-10', at('2026-10-20', '12:00'));
      assert.equal(m.salary, 6200000);
      assert.equal(m.summary.cap, 620000);
      assert.ok(m.summary.deducted >= 185000);
      assert.equal(m.summary.takeHome, 6200000 - m.summary.deducted);
      assert.ok(m.fines.some(f => f.status === 'warning'));
      await assert.rejects(fines.mine(pool, user('bek'), '2026-10', new Date(), { employeeId: 'e-ali' }), { status: 403 });
      await assert.rejects(fines.mine(pool, user('rop-ru'), '2026-10', new Date(), { employeeId: 'e-ali' }), { status: 403 });
      await assert.rejects(fines.mine(pool, user('hr'), '2026-10', new Date(), { employeeId: 'e-ali' }), { status: 403 });
      assert.equal((await fines.mine(pool, user('rop-en'), '2026-10', new Date(), { employeeId: 'e-ali' })).fines.length, m.fines.length);
      assert.ok(await fines.mine(pool, user('boss'), '2026-10', new Date(), { employeeId: 'e-ali' }));
      const id = m.fines.find(f => f.code === 'early_leave').id;
      await assert.rejects(fines.detail(pool, user('bek'), id), { status: 403 });
      const d = await fines.detail(pool, user('ali'), id, at('2026-10-08', '12:00'));
      assert.equal(d.rule.label, 'Ruxsatsiz erta ketish');
      assert.equal((await fines.mine(pool, user('boss'))).exempt, true, 'admin jarimasiz');
    });

    await t.test('rahbar jarimasi: ROP faqat o‘z tilidagi sotuvga, akademik — ustoz/yordamchiga; sabab va dalil majburiy', async () => {
      const team = await fines.team(pool, user('rop-en'));
      assert.deepEqual(team.rows.map(r => r.id), ['e-ali']);
      const body = { employeeId: 'e-ali', code: 'lead_no_call', reason: 'Qoʻngʻiroq tarixida urinish yoʻq, 10 daqiqada Sifatsiz', evidence: { leadId: 'L1', leadName: 'Laylo' } };
      await assert.rejects(fines.issue(pool, user('rop-ru'), body), { status: 403 });
      await assert.rejects(fines.issue(pool, user('rop-en'), { ...body, reason: 'qisqa' }), /Sabab/);
      await assert.rejects(fines.issue(pool, user('rop-en'), { ...body, code: 'absent' }), /Qoida/);
      // faqat joriy oy; o'tgan oy — 4-sanagacha
      await assert.rejects(fines.issue(pool, user('rop-en'), { ...body, date: '2026-09-28' }, at('2026-10-20', '12:00')), /joriy oy/);
      await assert.rejects(fines.issue(pool, user('rop-en'), { ...body, date: '2026-09-28' }, at('2026-10-05', '12:00')), /joriy oy/);
      const prev = await fines.issue(pool, user('rop-en'), { ...body, date: '2026-09-29' }, at('2026-10-04', '12:00'));
      await pool.query('DELETE FROM staff_fines WHERE id=$1', [prev.id]);
      const r = await fines.issue(pool, user('rop-en'), { ...body, date: '2026-10-20' }, at('2026-10-20', '12:00'));
      assert.equal(r.amount, 20000);
      assert.deepEqual((await fines.team(pool, user('ak'))).rows.map(x => x.id).sort(), ['e-ust', 'e-yor']);
      await assert.rejects(fines.issue(pool, user('ak'), body), { status: 403 });
      await assert.rejects(fines.issue(pool, user('ali'), { ...body, employeeId: 'e-bek' }), { status: 403 });
      await assert.rejects(fines.team(pool, user('hr')), { status: 403 });
    });

    await t.test('e‘tiroz 3 kun ichida; rahbar qabul qilsa jarima bekor', async () => {
      const f = (await pool.query("SELECT id FROM staff_fines WHERE employee_id='e-ali' AND code='lead_no_call'")).rows[0];
      await assert.rejects(fines.appeal(pool, user('ali'), f.id, 'Mijoz raqami notoʻgʻri edi', at('2026-12-01', '10:00')), /muddati/);
      await fines.appeal(pool, user('ali'), f.id, 'Mijoz raqami notoʻgʻri edi, qoʻngʻiroq WhatsApp orqali', new Date());
      assert.equal((await fines.appeals(pool, user('rop-en'))).rows.length, 1);
      await assert.rejects(fines.answerAppeal(pool, user('rop-ru'), f.id, { accept: true }), { status: 403 });
      await assert.rejects(fines.answerAppeal(pool, user('rop-en'), f.id, { accept: false }), /sabab/);
      await fines.answerAppeal(pool, user('rop-en'), f.id, { accept: true });
      await assert.rejects(fines.answerAppeal(pool, user('rop-en'), f.id, { accept: false, answer: 'x' }), { status: 409 });
      assert.equal((await pool.query('SELECT state FROM staff_fines WHERE id=$1', [f.id])).rows[0].state, 'cancelled');
    });

    await t.test('yuvish: qo‘shimcha soat yuz bilan, rahbar tasdiqlaydi, eng kichigi birinchi; kelmaslik 50%; muddat 4-sana', async () => {
      await ev('e-ali', '2026-10-20', 'in', '08:50'); await ev('e-ali', '2026-10-20', 'out', '19:30');
      const w = await fines.requestWash(pool, user('ali'), { kind: 'hours', date: '2026-10-20', month: '2026-10' }, at('2026-10-20', '19:40'));
      assert.deepEqual([w.minutes, w.value], [90, 37500]);
      // takroriy yuborish — 409 (bir kun uchun bitta)
      await assert.rejects(fines.requestWash(pool, user('ali'), { kind: 'hours', date: '2026-10-20', month: '2026-10' }, at('2026-10-20', '19:45')), { status: 409 });
      await assert.rejects(fines.requestWash(pool, user('ali'), { kind: 'hours', date: '2026-10-21', month: '2026-10' }, at('2026-10-20', '19:45')), /bugundan kech/);
      await assert.rejects(fines.requestWash(pool, user('ali'), { kind: 'hours', date: '2026-09-30', month: '2026-10' }, at('2026-10-20', '19:45')), /shu oy/);
      // grafik tugaguncha ketgan kun — qo'shimcha vaqt yo'q
      await assert.rejects(fines.requestWash(pool, user('ali'), { kind: 'hours', date: '2026-10-06', month: '2026-10' }, at('2026-10-20', '19:45')), /15 daqiqadan kam/);
      await assert.rejects(fines.decideWash(pool, user('rop-ru'), w.id, { decision: 'approve' }), { status: 403 });
      await assert.rejects(fines.decideWash(pool, user('rop-en'), w.id, { decision: 'reject' }), /sabab/);
      const ok = await fines.decideWash(pool, user('rop-en'), w.id, { decision: 'approve' }, at('2026-10-21', '10:00'));
      assert.equal(ok.washed, 37500);
      const wf = (await pool.query("SELECT code,washed FROM staff_fines WHERE employee_id='e-ali' AND NOT warning AND state='active' ORDER BY amount")).rows;
      assert.deepEqual(wf.map(r => [r.code, Number(r.washed)]), [['late_1', 10000], ['early_leave', 25000], ['absent', 2500]]);
      await assert.rejects(fines.requestWash(pool, user('ali'), { kind: 'sunday', date: '2026-10-24', month: '2026-10' }, at('2026-10-25', '13:00')), /yakshanba kuni/);
      await assert.rejects(fines.requestWash(pool, user('ali'), { kind: 'sunday', date: '2026-10-25', month: '2026-10' }, at('2026-10-25', '13:00')), /kelishni yuz bilan/);
      await ev('e-ali', '2026-10-25', 'in', '10:00'); await ev('e-ali', '2026-10-25', 'out', '14:05');
      const s = await fines.requestWash(pool, user('ali'), { kind: 'sunday', date: '2026-10-25', month: '2026-10' }, at('2026-10-25', '14:10'));
      await assert.rejects(fines.requestWash(pool, user('ali'), { kind: 'sunday', date: '2026-10-25', month: '2026-10' }, at('2026-10-25', '14:12')), { status: 409 });
      await fines.decideWash(pool, user('boss'), s.id, { decision: 'approve' }, at('2026-10-26', '10:00'));
      assert.equal(Number((await pool.query("SELECT washed FROM staff_fines WHERE employee_id='e-ali' AND code='absent'")).rows[0].washed), 75000, 'kelmaslik ko‘pi bilan 50%');
      const l = await fines.requestWash(pool, user('ali'), { kind: 'learning', month: '2026-10' }, at('2026-10-27', '13:00'));
      await assert.rejects(fines.requestWash(pool, user('ali'), { kind: 'learning', month: '2026-10' }, at('2026-10-27', '13:05')), /oyiga 1 marta/);
      await assert.rejects(fines.decideWash(pool, user('rop-en'), l.id, { decision: 'approve' }, at('2026-11-05', '10:00')), /muddati/);
      const tk = await fines.requestWash(pool, user('ali'), { kind: 'task', month: '2026-10', note: '20 ta eski lid' }, at('2026-11-04', '10:00'));
      await assert.rejects(fines.decideWash(pool, user('rop-en'), tk.id, { decision: 'approve' }, at('2026-11-04', '11:00')), /summani/);
      await assert.rejects(fines.requestWash(pool, user('ali'), { kind: 'task', month: '2026-10' }, at('2026-11-05', '10:00')), /muddati/);
    });

    await t.test('10 ish kuni ketma-ket vaqtida — eng kichik jarima avtomatik yuviladi (bir marta)', async () => {
      // Bek: 1-noyabr dushanba... 1 kechikish (ogohlantirish), 1 kechikish (jarima), keyin 10 kun vaqtida
      await ev('e-bek', '2026-11-02', 'in', '09:20'); await ev('e-bek', '2026-11-02', 'out', '18:00');
      await ev('e-bek', '2026-11-03', 'in', '09:20'); await ev('e-bek', '2026-11-03', 'out', '18:00');
      const ok = ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'];
      for (const d of ok) { await ev('e-bek', d, 'in', '08:55'); await ev('e-bek', d, 'out', '18:02'); }
      await fines.tick(pool, at('2026-11-16', '12:00'));
      await fines.tick(pool, at('2026-11-16', '12:05'));
      const b = (await pool.query("SELECT code,amount,washed,warning FROM staff_fines WHERE employee_id='e-bek' ORDER BY work_date")).rows;
      assert.deepEqual(b.map(r => [r.code, Number(r.amount), Number(r.washed), r.warning]), [['late_2', 0, 0, true], ['late_2', 25000, 25000, false]]);
      assert.equal(Number((await pool.query("SELECT COUNT(*)::int n FROM staff_fine_washes WHERE employee_id='e-bek' AND kind='streak'")).rows[0].n), 1);
    });

    await t.test('admin sozlamasi keyingi oyning 1-sanasidan; tarix; moliya jami', async () => {
      await assert.rejects(fines.getConfig(pool, user('rop-en')), { status: 403 });
      const c = await fines.getConfig(pool, user('boss'), at('2026-11-20', '10:00'));
      assert.equal(c.effectiveFrom, '2026-12-01');
      const draft = JSON.parse(JSON.stringify(c.draft));
      draft.roles.sales.find(r => r.code === 'late_2').amount = 30000;
      draft.soft.graceMinutes = 7;
      const s = await fines.saveConfig(pool, user('boss'), draft, at('2026-11-20', '10:00'));
      assert.equal(s.effective, '2026-12-01');
      assert.ok(s.changes.some(x => /25 000 → 30 000/.test(x)) && s.changes.some(x => /imtiyoz 5 → 7/.test(x)));
      // noyabr — eski summa (orqaga qarab emas)
      await ev('e-bek', '2026-11-17', 'in', '09:20'); await ev('e-bek', '2026-11-17', 'out', '18:00');
      await fines.tick(pool, at('2026-11-18', '12:00'));
      assert.equal(Number((await pool.query("SELECT amount FROM staff_fines WHERE employee_id='e-bek' AND work_date='2026-11-17'")).rows[0].amount), 25000);
      // dekabr — yangi summa; 6 daqiqa endi imtiyoz ichida
      await ev('e-bek', '2026-12-01', 'in', '09:06'); await ev('e-bek', '2026-12-01', 'out', '18:00');
      await ev('e-bek', '2026-12-02', 'in', '09:20'); await ev('e-bek', '2026-12-02', 'out', '18:00');
      await ev('e-bek', '2026-12-03', 'in', '09:20'); await ev('e-bek', '2026-12-03', 'out', '18:00');
      await fines.tick(pool, at('2026-12-04', '12:00'));
      const dec = (await pool.query("SELECT TO_CHAR(work_date,'YYYY-MM-DD') d,amount,warning FROM staff_fines WHERE employee_id='e-bek' AND month='2026-12' ORDER BY work_date")).rows;
      assert.deepEqual(dec.map(r => [r.d, Number(r.amount), r.warning]), [['2026-12-02', 0, true], ['2026-12-03', 30000, false]]);
      const hist = (await fines.getConfig(pool, user('boss'), at('2026-11-21', '10:00'))).history;
      assert.ok(hist.length >= 2 && hist[0].effective === '2026-12-01');
      const tot = await fines.monthTotals(pool, user('boss'), '2026-10', { 'e-ali': 6200000 });
      assert.equal(tot.totals['e-ali'].cap, 620000);
      assert.ok(tot.totals['e-ali'].deducted > 0 && tot.totals['e-ali'].washed > 0);
      await assert.rejects(fines.monthTotals(pool, user('rop-en'), '2026-10'), { status: 403 });
      // push: egasiga yangi jarima, rahbarga yuvish so'rovi
      const pe = await fines.pushEvents(pool, 'bek', new Date());
      assert.ok(pe.some(e => e.type === 'fine_new' && /Jarima: 30 000/.test(e.title)));
    });

    await t.test('HR tuzatishi va tasdiqlangan so‘rov — yozilgan jarima avtomatik bekor; yuvilgani tegilmaydi', async () => {
      await ev('e-ali', '2026-12-07', 'in', '09:40'); await ev('e-ali', '2026-12-07', 'out', '18:00');   // dekabr 1-kechikish — ogohlantirish
      await ev('e-ali', '2026-12-08', 'in', '09:40'); await ev('e-ali', '2026-12-08', 'out', '18:00');   // 2-kechikish — jarima
      await fines.tick(pool, at('2026-12-09', '12:00'));
      const f = (await pool.query("SELECT id,amount,state FROM staff_fines WHERE employee_id='e-ali' AND work_date='2026-12-08' AND code LIKE 'late_%'")).rows[0];
      assert.ok(f && f.amount > 0 && f.state === 'active');
      // qisman yuvilgan jarima (oktyabr, kelmaslik) — HR tuzatsa ham avtomatik bekor qilinmaydi (pul hisobi buzilmasin)
      const washedBefore = (await pool.query("SELECT id,state FROM staff_fines WHERE employee_id='e-ali' AND code='absent' AND washed>0")).rows[0];
      await att.setOverride(pool, user('boss'), { employeeId: 'e-ali', date: '2026-12-08', status: 'excused', note: 'shifokorda edi' });
      await fines.tick(pool, at('2026-12-09', '12:05'));
      const after = (await pool.query("SELECT state,note FROM staff_fines WHERE id=$1", [f.id])).rows[0];
      assert.deepEqual([after.state, after.note], ['cancelled', 'auto']);
      if (washedBefore) assert.equal((await pool.query('SELECT state FROM staff_fines WHERE id=$1', [washedBefore.id])).rows[0].state, washedBefore.state);
      // qayta tuzatish olib tashlansa — yangi jarima yoziladi (ref takrorlanmaydi, eski bekor qolganicha)
      assert.equal((await fines.mine(pool, user('ali'), '2026-12', at('2026-12-09', '12:10'))).fines.filter(x => x.date === '2026-12-08' && x.status !== 'cancelled' && x.amount > 0).length, 0);
    });

    await t.test('tasdiqlangan "kech qolaman": ruxsat vaqtidan hisoblanadi (jarima yo‘q yoki kamroq)', async () => {
      await pool.query(`INSERT INTO staff_att_requests(id,employee_id,user_id,type,work_date,at_time,reason,approver_kind,state) VALUES
        ('rq-l1','e-ali','ali','late','2026-12-10','11:00','Shifokor','rop','approved'),('rq-l2','e-ali','ali','late','2026-12-11','11:00','Shifokor','rop','approved')`);
      await ev('e-ali', '2026-12-10', 'in', '10:58'); await ev('e-ali', '2026-12-10', 'out', '18:00'); // ruxsat ichida — jarima yo'q
      await ev('e-ali', '2026-12-11', 'in', '11:20'); await ev('e-ali', '2026-12-11', 'out', '18:00'); // 20 daq kech — 16–30 pog'ona
      await fines.tick(pool, at('2026-12-12', '12:00'));
      const rows = (await pool.query("SELECT TO_CHAR(work_date,'YYYY-MM-DD') d,code,label FROM staff_fines WHERE employee_id='e-ali' AND work_date IN ('2026-12-10','2026-12-11') AND state='active'")).rows;
      assert.deepEqual(rows.map(r => [r.d, r.code, r.label]), [['2026-12-11', 'late_2', 'Kechikish 20 daq']]);
    });

    await t.test('ustma-ust tick — jarima va avtomatik yuvish ikki marta yozilmaydi', async () => {
      const before = Number((await pool.query('SELECT COUNT(*)::int n FROM staff_fines')).rows[0].n);
      await Promise.all([fines.tick(pool, at('2026-12-12', '12:30')), fines.tick(pool, at('2026-12-12', '12:30')), fines.tick(pool, at('2026-12-12', '12:31'))]);
      assert.equal(Number((await pool.query('SELECT COUNT(*)::int n FROM staff_fines')).rows[0].n), before);
      const dup = (await pool.query("SELECT employee_id,ref,COUNT(*) n FROM staff_fine_washes WHERE ref IS NOT NULL GROUP BY 1,2 HAVING COUNT(*)>1")).rows;
      assert.equal(dup.length, 0);
      const bek = (await pool.query("SELECT SUM(washed)::int w FROM staff_fines WHERE employee_id='e-bek' AND month='2026-11'")).rows[0].w;
      assert.equal(bek, 25000, 'avtomatik yuvish bir marta');
    });

    await t.test('oy chegarasi: har oyning birinchi kechikishi alohida ogohlantirish', async () => {
      await pool.query("INSERT INTO hr_employees(id,name,role,lang,login,status) VALUES('e-zed','Zed','sotuv-menejeri','english','zed','active')");
      await pool.query("INSERT INTO users(id,name,email,role) VALUES('zed','Zed','zed','sales_manager')");
      await att.saveSchedule(pool, user('boss'), 'e-zed', { days: DAYS });
      await pool.query("INSERT INTO staff_att_faces(employee_id,descriptors,state,submitted_by,first_approved_at) VALUES('e-zed','[]','approved','boss','2026-12-01')");
      await pool.query("UPDATE staff_att_schedules SET tracked_since='2026-12-28' WHERE employee_id='e-zed'");
      await ev('e-zed', '2026-12-29', 'in', '09:20'); await ev('e-zed', '2026-12-29', 'out', '18:00');
      await ev('e-zed', '2026-12-30', 'in', '09:20'); await ev('e-zed', '2026-12-30', 'out', '18:00');
      await ev('e-zed', '2026-12-31', 'in', '08:50'); await ev('e-zed', '2026-12-31', 'out', '18:00');
      await ev('e-zed', '2027-01-01', 'in', '08:55'); await ev('e-zed', '2027-01-01', 'out', '18:00');
      await ev('e-zed', '2027-01-02', 'in', '09:20'); await ev('e-zed', '2027-01-02', 'out', '18:00');
      await fines.tick(pool, at('2027-01-03', '12:00'));
      const z = (await pool.query("SELECT TO_CHAR(work_date,'YYYY-MM-DD') d,amount,warning FROM staff_fines WHERE employee_id='e-zed' ORDER BY work_date")).rows;
      assert.deepEqual(z.map(r => [r.d, r.warning]), [['2026-12-29', true], ['2026-12-30', false], ['2027-01-02', true]]);
    });

    await t.test('moliya: ikki til qatori — chegara maosh yig‘indisidan, jarima bir marta', async () => {
      await pool.query("INSERT INTO salary_transactions VALUES('s2','e-ali','2026-10-01','2026-10-31',1800000,'unpaid')");
      const m = await fines.mine(pool, user('ali'), '2026-10', at('2026-10-31', '12:00'));
      assert.equal(m.salary, 8000000);
      assert.equal(m.summary.cap, 800000);
      const tot = await fines.monthTotals(pool, user('boss'), '2026-10', { 'e-ali': 8000000 });
      assert.equal(tot.totals['e-ali'].cap, 800000);
      assert.equal(Object.keys(tot.totals).filter(k => k === 'e-ali').length, 1);
    });

    await t.test('qayta faollashish va yangilanish: sababli → bekor → tuzatish olib tashlandi → yana faol; 1-kechikish sababli bo‘lsa keyingisi ogohlantirish', async () => {
      await pool.query("INSERT INTO hr_employees(id,name,role,lang,login,status) VALUES('e-qa','Qodir','sotuv-menejeri','english','qa','active')");
      await pool.query("INSERT INTO users(id,name,email,role) VALUES('qa','Qodir','qa','sales_manager')");
      await att.saveSchedule(pool, user('boss'), 'e-qa', { days: DAYS });
      await pool.query("INSERT INTO staff_att_faces(employee_id,descriptors,state,submitted_by,first_approved_at) VALUES('e-qa','[]','approved','boss','2027-02-01')");
      await pool.query("UPDATE staff_att_schedules SET tracked_since='2027-02-07' WHERE employee_id='e-qa'");
      const q = async () => (await pool.query("SELECT TO_CHAR(work_date,'YYYY-MM-DD') d,code,amount,warning,state,note FROM staff_fines WHERE employee_id='e-qa' AND code LIKE 'late_%' AND code<>'late_streak3' ORDER BY work_date")).rows
        .map(r => [r.d, Number(r.amount), r.warning, r.state]);
      await ev('e-qa', '2027-02-08', 'in', '09:10'); await ev('e-qa', '2027-02-08', 'out', '18:00');   // 1-kechikish
      await ev('e-qa', '2027-02-09', 'in', '09:20'); await ev('e-qa', '2027-02-09', 'out', '18:00');   // 2-kechikish — 30 000 (dekabrdan yangi summa)
      await fines.tick(pool, at('2027-02-10', '12:00'));
      assert.deepEqual(await q(), [['2027-02-08', 0, true, 'active'], ['2027-02-09', 30000, false, 'active']]);
      // B: 1-kechikish sababli → 9-fevral endi oyning 1-kechikishi — bepul ogohlantirish
      await att.setOverride(pool, user('boss'), { employeeId: 'e-qa', date: '2027-02-08', status: 'excused', note: 'shifokor' });
      await fines.tick(pool, at('2027-02-10', '12:05'));
      assert.deepEqual(await q(), [['2027-02-08', 0, true, 'cancelled'], ['2027-02-09', 0, true, 'active']]);
      // A: tuzatish olib tashlandi → 8-fevral yana faol (ogohlantirish), 9-fevral yana 30 000
      await att.setOverride(pool, user('boss'), { employeeId: 'e-qa', date: '2027-02-08', status: null });
      await fines.tick(pool, at('2027-02-10', '12:10'));
      assert.deepEqual(await q(), [['2027-02-08', 0, true, 'active'], ['2027-02-09', 30000, false, 'active']]);
      // qo'lda bekor qilingan (e'tiroz qabul) qayta tiklanmaydi
      await pool.query("UPDATE staff_fines SET state='cancelled',note='' WHERE employee_id='e-qa' AND work_date='2027-02-09'");
      await fines.tick(pool, at('2027-02-10', '12:15'));
      assert.equal((await q())[1][3], 'cancelled');
      await pool.query("UPDATE staff_fines SET state='active' WHERE employee_id='e-qa' AND work_date='2027-02-09'");
      // B: tasdiqlangan "kech qolaman" pog'onani o'zgartiradi (20 → 5 daq: jarima yo'q → bekor)
      await pool.query("INSERT INTO staff_att_requests(id,employee_id,user_id,type,work_date,at_time,reason,approver_kind,state) VALUES('rq-qa','e-qa','qa','late','2027-02-09','09:15','Transport','rop','approved')");
      await pool.query("DELETE FROM staff_att_day_results WHERE employee_id='e-qa'");
      await fines.tick(pool, at('2027-02-10', '12:20'));
      assert.deepEqual((await q())[1], ['2027-02-09', 30000, false, 'cancelled'], '5 daq — imtiyoz ichida, jarima yo‘q');
    });

    await t.test('qisman yuvilgan jarima kuni sababli bo‘lsa: bekor, yuvilgan summa boshqa jarimaga; sig‘masa — kredit', async () => {
      await ev('e-qa', '2027-02-10', 'in', '09:40'); await ev('e-qa', '2027-02-10', 'out', '18:00');   // 2-kechikish (8-fevraldan keyin) — 50 000
      await ev('e-qa', '2027-02-11', 'in', '08:55'); await ev('e-qa', '2027-02-11', 'out', '16:00');   // erta ketish — 25 000
      await fines.tick(pool, at('2027-02-12', '12:00'));
      const late = (await pool.query("SELECT id,amount FROM staff_fines WHERE employee_id='e-qa' AND work_date='2027-02-10' AND code LIKE 'late_%'")).rows[0];
      const early = (await pool.query("SELECT id FROM staff_fines WHERE employee_id='e-qa' AND code='early_leave'")).rows[0];
      await pool.query('UPDATE staff_fines SET washed=30000 WHERE id=$1', [late.id]);   // qisman yuvilgan
      await att.setOverride(pool, user('boss'), { employeeId: 'e-qa', date: '2027-02-10', status: 'excused', note: 'HR' });
      await fines.tick(pool, at('2027-02-12', '12:05'));
      const l2 = (await pool.query('SELECT state,note,washed FROM staff_fines WHERE id=$1', [late.id])).rows[0];
      assert.deepEqual([l2.state, l2.note, Number(l2.washed)], ['cancelled', 'auto', 0]);
      assert.equal(Number((await pool.query('SELECT washed FROM staff_fines WHERE id=$1', [early.id])).rows[0].washed), 25000, '30 000 dan 25 000 erta ketishga');
      const cr = (await pool.query("SELECT amount FROM staff_fine_credits WHERE employee_id='e-qa'")).rows;
      assert.deepEqual(cr.map(r => Number(r.amount)), [5000], 'qolgan 5 000 — kredit');
      const tot = await fines.monthTotals(pool, user('boss'), '2027-02', { 'e-qa': 5000000 });
      assert.equal(tot.totals['e-qa'].credit, 5000);
      await fines.tick(pool, at('2027-02-12', '12:10'));
      assert.equal((await pool.query("SELECT COUNT(*)::int n FROM staff_fine_credits WHERE employee_id='e-qa'")).rows[0].n, 1, 'takrorlanmaydi');
    });
  } finally { await pool.end(); }
});
