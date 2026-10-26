// Xodimlar davomati — haqiqiy PostgreSQL bilan integratsiya testi.
// Ishga tushirish: scripts/run-payroll-postgres.cjs (vaqtinchalik loopback klaster).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const { Pool } = require('pg');
const service = require('../server/services/staffAttendance');
const lessons = require('../server/services/staffAttendance/lessons');
const time = require('../server/services/staffAttendance/time');

const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (parsed.hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(parsed.pathname)) throw Error('Only disposable loopback test databases are allowed');
}

// Soxta yuz tahlilchisi: PNG'ning birinchi pikseli — R = odam raqami, G = bosh burilishi (yaw*100+100),
// B = yuzlar soni. Haqiqiy model alohida (face.js) testlanadi.
function png(person, yaw = 0, faces = 1) {
  const raw = Buffer.from([0, person, Math.round(yaw * 100) + 100, faces, 255]);
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); return Buffer.concat([len, Buffer.from(type), data, Buffer.alloc(4)]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6;
  const file = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  return 'data:image/png;base64,' + file.toString('base64');
}
const jpeg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(1500, 7)]).toString('base64');
const real = require('../server/services/staffAttendance/face');
const { decodePng } = require('../server/services/staffAttendance/png');
const analyzer = {
  MATCH_THRESHOLD: real.MATCH_THRESHOLD, distance: real.distance, bestDistance: real.bestDistance,
  async analyze(buf, opts = {}) {
    const { rgb } = decodePng(buf);
    const [person, yawCode, faces] = rgb;
    if (!faces) return { faces: 0 };
    return { faces, yaw: (yawCode - 100) / 100, box: { width: 150 }, descriptor: opts.descriptor === false ? undefined : Array(128).fill(person / 100) };
  },
};
const office = { lat: 40.789035, lng: 72.346787, accuracy: 15 };
const at = (date, clock) => time.atTashkent(date, time.parseClock(clock));

test('real PostgreSQL staff attendance', { skip: !url }, async t => {
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT);
      CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,role TEXT,lang TEXT,login TEXT,status TEXT);
      CREATE TABLE teachers(id TEXT PRIMARY KEY,schedule_pattern TEXT,lesson_duration INTEGER);
      CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,teacher_id TEXT,lesson_day_of_week INTEGER,lesson_time TEXT,lesson_duration INTEGER,extra_data JSONB DEFAULT '{}');
      CREATE TABLE domwork_learning_groups(id TEXT PRIMARY KEY,type TEXT,teacher_id TEXT,chat_id TEXT,archived BOOLEAN DEFAULT FALSE);
      CREATE TABLE domwork_bot_links(telegram_id TEXT PRIMARY KEY,account_kind TEXT,account_id TEXT,phone TEXT,paused BOOLEAN DEFAULT FALSE);
      CREATE TABLE domwork_bot_outbox(id TEXT PRIMARY KEY,unique_key TEXT UNIQUE,target_kind TEXT,target_id TEXT,role TEXT,method TEXT,payload JSONB,not_before TIMESTAMPTZ);
      CREATE TABLE domwork_bot_face_logs(event_id TEXT PRIMARY KEY,employee_id TEXT,kind TEXT,occurred_at TIMESTAMPTZ);
      CREATE TABLE domwork_bot_leave_requests(id TEXT PRIMARY KEY,employee_id TEXT,state TEXT,start_date DATE,end_date DATE);
      INSERT INTO users VALUES('boss','Direktor','boss','admin'),('rop','ROP','rop','rop'),('hr','HR','hr','hr'),
        ('ali','Ali','ali','sales_manager'),('vali','Vali','vali','employee'),('teacher','Ustoz','teacher','teacher');
      INSERT INTO hr_employees VALUES('e-ali','Ali Valiyev','sotuv-menejeri','english','ali','active'),
        ('e-vali','Vali Karimov','marketolog','english','vali','active'),('e-t','Nodira Ustoz','rus-oqituvchi','russian','teacher','active');
      INSERT INTO domwork_bot_links VALUES('111','user','boss','998',false),('222','user','rop','998',false),('333','user','ali','998',false);`);
    await service.initSchema(pool);
    await service.initSchema(pool); // takroriy ishga tushirish xavfsiz
    const user = id => ({ id });
    const monday = '2026-10-26';
    const outbox = async () => (await pool.query('SELECT unique_key,target_id,payload FROM domwork_bot_outbox ORDER BY unique_key')).rows;

    await t.test('grafik yoqilmagan xodim uchun tugma yo‘q, rol cheklovlari', async () => {
      assert.equal((await service.me(pool, user('ali'))).tracked, false);
      await assert.rejects(service.saveSchedule(pool, user('rop'), 'e-ali', { days: { 1: { start: '09:00', end: '18:00' } } }), { status: 403 });
      await assert.rejects(service.daily(pool, user('ali'), monday), { status: 403 });
      await service.saveSchedule(pool, user('hr'), 'e-ali', { days: { 1: { start: '09:00', end: '18:00' }, 2: { start: '09:00', end: '18:00' } } });
      await service.saveSchedule(pool, user('hr'), 'e-vali', { days: { 1: { start: '10:00', end: '19:00' } } });
      const me = await service.me(pool, user('ali'), at(monday, '08:30'));
      assert.deepEqual([me.tracked, me.face, me.nextAction, me.today.status], [true, 'none', 'in', 'not_ready']);
      await assert.rejects(service.saveSchedule(pool, user('hr'), 'e-ali', { days: { 1: { start: '18:00', end: '09:00' } } }), { status: 400 });
    });

    await t.test('yuz namunasi: xodim yuboradi → HR tasdiqlaydi; boshqa xodimga bir xil yuz bo‘lmaydi', async () => {
      await assert.rejects(service.check(pool, analyzer, user('ali'), { kind: 'in', location: office, frame: png(10), turned: png(10, 0.3), photo: jpeg }, { now: at(monday, '08:50') }), { status: 409 });
      await assert.rejects(service.submitOwnFace(pool, analyzer, user('ali'), { frames: [png(10), png(30)], photo: jpeg }), { status: 422 });
      await assert.rejects(service.submitOwnFace(pool, analyzer, user('ali'), { frames: [png(10), png(10, 0, 2)], photo: jpeg }), { status: 422 });
      const sent = await service.submitOwnFace(pool, analyzer, user('ali'), { frames: [png(10), png(10)], photo: jpeg });
      assert.equal(sent.state, 'pending');
      assert.ok((await outbox()).some(r => r.unique_key.startsWith('att:face:e-ali')));
      await assert.rejects(service.transaction(pool, db => service.reviewFace(db, analyzer, user('rop'), 'e-ali', 'approve')), { status: 403 });
      assert.equal((await service.transaction(pool, db => service.reviewFace(db, analyzer, user('hr'), 'e-ali', 'approve'))).state, 'approved');
      await assert.rejects(service.enrollFor(pool, analyzer, user('hr'), 'e-vali', { frames: [png(10), png(10)], photo: jpeg }), { status: 409 });
      assert.equal((await service.enrollFor(pool, analyzer, user('hr'), 'e-vali', { frames: [png(40), png(40)], photo: jpeg })).state, 'approved');
      await assert.rejects(service.submitOwnFace(pool, analyzer, user('ali'), { frames: [png(10), png(10)], photo: jpeg }), { status: 409 });
    });

    await t.test('hisob grafik yoqilgan va yuz tasdiqlangan kundan boshlanadi', async () => {
      // Grafik ham, yuz ham bugun (2026-10-26) yoqildi: bugun belgilamasa "kelmadi" emas.
      const first = await service.daily(pool, user('boss'), monday, at(monday, '20:00'));
      assert.equal(first.rows.find(r => r.employeeId === 'e-vali').status, 'before');
      await pool.query("UPDATE staff_att_schedules SET tracked_since='2026-10-01'");
      await pool.query("UPDATE staff_att_faces SET first_approved_at='2026-10-01T03:00:00Z'");
      const m = await service.monthly(pool, user('boss'), '2026-09', at('2026-10-26', '20:00'));
      assert.ok(m.rows.every(r => r.days.every(d => ['before', 'off'].includes(d.status))), 'sentyabr hisoblanmaydi');
    });

    await t.test('belgilash: lokatsiya, yuz mos emas, tiriklik, kechikish, takror, erta ketish', async () => {
      await pool.query('DELETE FROM domwork_bot_outbox');
      const body = (person, yaw2, loc = office, kind = 'in') => ({ kind, location: loc, frame: png(person), turned: png(person, yaw2), photo: jpeg });
      const far = await service.check(pool, analyzer, user('ali'), body(10, 0.3, { ...office, lat: office.lat + 0.02 }), { now: at(monday, '09:10') });
      assert.deepEqual([far.ok, far.reason], [false, 'outside']);
      const wrong = await service.check(pool, analyzer, user('ali'), body(40, 0.3), { now: at(monday, '09:11') });
      assert.deepEqual([wrong.ok, wrong.reason], [false, 'mismatch']);
      assert.deepEqual((await outbox()).map(r => r.target_id), ['111', '222'], 'faqat direktor va ROP');
      const still = await service.check(pool, analyzer, user('ali'), body(10, 0.02), { now: at(monday, '09:12') });
      assert.deepEqual([still.ok, still.reason], [false, 'liveness']);
      const ok = await service.check(pool, analyzer, user('ali'), body(10, -0.25), { now: at(monday, '09:17'), ip: '1.2.3.4' });
      assert.deepEqual([ok.ok, ok.clock, ok.today.status, ok.today.lateMinutes], [true, '09:17', 'late', 17]);
      assert.ok((await outbox()).some(r => r.unique_key === 'att:late:e-ali:2026-10-26:111' && /17 daqiqa/.test(r.payload.text)));
      assert.equal((await pool.query("SELECT COUNT(*)::int n FROM domwork_bot_face_logs WHERE employee_id='e-ali'")).rows[0].n, 1);
      await assert.rejects(service.check(pool, analyzer, user('ali'), body(10, 0.3), { now: at(monday, '09:30') }), { status: 409 });
      const out = await service.check(pool, analyzer, user('ali'), body(10, 0.3, office, 'out'), { now: at(monday, '17:20') });
      assert.deepEqual([out.today.earlyMinutes, out.today.workedMinutes], [40, 483]);
      assert.ok((await outbox()).some(r => r.unique_key.startsWith('att:early:e-ali')));
      const photos = (await pool.query("SELECT COUNT(*)::int n FROM staff_att_photos WHERE purpose='check'")).rows[0].n;
      assert.equal(photos, 4, 'ofisdan tashqari urinishda rasm saqlanmaydi');
    });

    await t.test('kunlik/oylik jadval, kelmadi xabari bir marta, qo‘lda holat', async () => {
      const d = await service.daily(pool, user('rop'), monday, at(monday, '20:00'));
      const ali = d.rows.find(r => r.employeeId === 'e-ali'), vali = d.rows.find(r => r.employeeId === 'e-vali');
      assert.deepEqual([ali.status, ali.rejected, ali.attempts.length], ['late', 3, 5]);
      assert.equal(vali.status, 'absent');
      await pool.query('DELETE FROM domwork_bot_outbox');
      await service.tick(pool, at(monday, '12:05'));
      await service.tick(pool, at(monday, '12:10'));
      const absent = (await outbox()).filter(r => r.unique_key.startsWith('att:absent:e-vali'));
      assert.equal(absent.length, 2, 'har bir qabul qiluvchiga bitta');
      await assert.rejects(service.setOverride(pool, user('rop'), { employeeId: 'e-vali', date: monday, status: 'excused' }), { status: 403 });
      await service.setOverride(pool, user('hr'), { employeeId: 'e-vali', date: monday, status: 'excused', note: 'Shifokorda' });
      const again = await service.daily(pool, user('boss'), monday, at(monday, '20:00'));
      assert.equal(again.rows.find(r => r.employeeId === 'e-vali').status, 'excused');
      await pool.query("INSERT INTO domwork_bot_leave_requests VALUES('l1','e-ali','approved','2026-10-27','2026-10-27')");
      const m = await service.monthly(pool, user('boss'), '2026-10', at('2026-10-31', '20:00'));
      const aliMonth = m.rows.find(r => r.employeeId === 'e-ali');
      assert.equal(aliMonth.days.find(x => x.date === '2026-10-27').status, 'leave');
      assert.equal(aliMonth.days.find(x => x.date === '2026-10-26').status, 'late');
      assert.equal(aliMonth.totals.late, 1);
    });

    await t.test('rasmni faqat egasi yoki rahbar ko‘radi', async () => {
      const id = (await pool.query("SELECT photo_id FROM staff_att_events WHERE employee_id='e-ali' AND ok LIMIT 1")).rows[0].photo_id;
      assert.ok((await service.photo(pool, user('ali'), id)).data.length > 1000);
      assert.ok(await service.photo(pool, user('rop'), id));
      await assert.rejects(service.photo(pool, user('vali'), id), { status: 403 });
    });

    await t.test('ustoz darslari: Telegram video chat va davomat vaqti', async () => {
      await pool.query(`INSERT INTO teachers VALUES('e-t','mwf',15);
        INSERT INTO students(id,name,teacher_id,lesson_day_of_week,lesson_time,lesson_duration) VALUES
          ('s1','Aziz','e-t',1,'10:00',15),('s2','Bek','e-t',1,'10:15',15),('s3','Jasur','e-t',1,'14:00',15),('s4','Muzlatilgan','e-t',1,'16:00',15);
        UPDATE students SET extra_data='{"status":"frozen"}' WHERE id='s4';
        INSERT INTO domwork_learning_groups VALUES('g1','classroom','e-t','-1001',false);`);
      const msg = (id, clock, extra) => ({ message_id: id, chat: { id: -1001, type: 'supergroup' }, date: Math.floor(at(monday, clock).getTime() / 1000), ...extra });
      assert.equal(await lessons.recordVideoChat(pool, msg(1, '10:03', { video_chat_started: {} })), true);
      await lessons.recordVideoChat(pool, msg(2, '10:31', { video_chat_ended: { duration: 1680 } }));
      await lessons.recordVideoChat(pool, msg(2, '10:31', { video_chat_ended: { duration: 1680 } })); // takror
      await lessons.recordVideoChat(pool, msg(3, '14:12', { video_chat_started: {} }));
      await lessons.recordVideoChat(pool, msg(4, '14:14', { video_chat_ended: { duration: 120 } }));
      assert.equal(await lessons.recordVideoChat(pool, { ...msg(5, '15:00', { text: 'salom' }) }), false);
      const r = await service.lessonReport(pool, user('boss'), monday, at(monday, '20:00'));
      const row = r.rows.find(x => x.teacherId === 'e-t');
      assert.equal(row.source, 'telegram');
      assert.equal(row.lessons, 3, 'muzlatilgan o‘quvchi hisoblanmaydi');
      assert.deepEqual(row.blocks.map(b => [b.start, b.end, b.status]), [['10:00', '10:30', 'on_time'], ['14:00', '14:15', 'late_start']]);
      assert.equal(row.problems, 1);
      // Telegram guruhi yo'q ustoz — davomat vaqti bo'yicha
      await pool.query("UPDATE domwork_learning_groups SET archived=true");
      await lessons.recordMark(pool, { teacherId: 'e-t', studentId: 's1', date: monday, duty: 'main' });
      await pool.query("UPDATE staff_att_lesson_marks SET first_marked_at=$1", [at(monday, '10:05')]);
      await lessons.recordMark(pool, { teacherId: 'e-t', studentId: 's1', date: monday, duty: 'main' }); // birinchisi saqlanadi
      const r2 = await service.lessonReport(pool, user('boss'), monday, at(monday, '20:00'));
      const row2 = r2.rows.find(x => x.teacherId === 'e-t');
      assert.equal(row2.source, 'davomat');
      assert.equal(row2.blocks[0].slots[0].markedClock, '10:05');
      assert.deepEqual(row2.blocks.map(b => b.status), ['not_marked', 'not_marked']);
      await assert.rejects(service.lessonReport(pool, user('teacher'), monday), { status: 403 });
    });

    await t.test('eski rasmlar saqlash muddatidan keyin o‘chiriladi', async () => {
      await pool.query("UPDATE staff_att_photos SET created_at=NOW()-INTERVAL '100 days' WHERE purpose='check'");
      const r = await service.tick(pool, new Date());
      assert.equal(r.purged, 4);
      assert.equal((await pool.query("SELECT COUNT(*)::int n FROM staff_att_photos WHERE purpose='enroll'")).rows[0].n, 2);
    });
  } finally {
    await pool.end();
  }
});
