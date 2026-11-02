// Xodimlar davomati — haqiqiy PostgreSQL bilan integratsiya testi.
// Ishga tushirish: scripts/run-payroll-postgres.cjs (vaqtinchalik loopback klaster).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const service = require('../server/services/staffAttendance');
const lessons = require('../server/services/staffAttendance/lessons');
const time = require('../server/services/staffAttendance/time');
const png = require('../server/services/staffAttendance/png');
const real = require('../server/services/staffAttendance/face');

const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (parsed.hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(parsed.pathname)) throw Error('Only disposable loopback test databases are allowed');
}

// Soxta yuz tahlilchisi. 360x480 PNG'ning birinchi piksellari: R = odam, G = bosh burilishi (yaw*100+100),
// B = yuzlar soni, 2-piksel R = "kadr farqi" (bir xil rasm qayta yuborilganini aniqlash uchun).
// Haqiqiy model alohida (face.js) sinalgan.
function frame(person, yaw = 0, faces = 1, jitter = 0) {
  const rgb = new Uint8Array(360 * 480 * 3);
  // Har bir kadr — o'ziga xos "sahna" (jitter bo'yicha takrorlanadigan tasodifiy naqsh), bir xil jitter = bir xil rasm.
  let seed = (person * 131 + jitter * 7919 + 1) >>> 0;
  for (let i = 12; i < rgb.length; i += 3) { seed = (seed * 1664525 + 1013904223) >>> 0; rgb[i] = rgb[i + 1] = rgb[i + 2] = seed >>> 24; }
  rgb.set([person, Math.round(yaw * 100) + 100, faces, jitter]);
  return 'data:image/png;base64,' + png.encodePng({ width: 360, height: 480, rgb }).toString('base64');
}
const analyzer = {
  MATCH_THRESHOLD: real.MATCH_THRESHOLD, distance: real.distance, bestDistance: real.bestDistance,
  async analyze(buf) {
    const { rgb } = png.decodePng(buf);
    const [person, yawCode, faces, jitter] = rgb;
    if (!faces) return { faces: 0 };
    const descriptor = Array(128).fill(person / 100);
    // Har xil kadr — biroz farqli descriptor (0.07+), lekin namunaga mos (≤0.4).
    descriptor[0] += (jitter % 5) * 0.07;
    descriptor[1] += (Math.floor(jitter / 5) % 5) * 0.07;
    return { faces, yaw: (yawCode - 100) / 100, box: { width: 150 }, descriptor };
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
        ('ali','Ali','ali','sales_manager'),('vali','Vali','vali','employee'),('teacher','Ustoz','teacher','teacher'),('dup','Dup','dup','employee');
      INSERT INTO hr_employees VALUES('e-ali','Ali Valiyev','sotuv-menejeri','english','ali','active'),
        ('e-vali','Vali Karimov','marketolog','english','vali','active'),('e-t','Nodira Ustoz','rus-oqituvchi','russian','teacher','active'),
        ('e-d1','Dup 1','marketolog','english','dup','active'),('e-d2','Dup 2','marketolog','english','DUP ','active');
      INSERT INTO domwork_bot_links VALUES('111','user','boss','998',false),('222','user','rop','998',false),('333','user','ali','998',false);`);
    await Promise.all([service.initSchema(pool), service.initSchema(pool)]); // parallel ishga tushirish xavfsiz
    const user = id => ({ id });
    const monday = '2026-10-26';
    const outbox = async () => (await pool.query('SELECT unique_key,target_id,payload FROM domwork_bot_outbox ORDER BY unique_key')).rows;
    let jitter = 0;
    // Har urinish: yangi bir martalik topshiriq (yo'nalish) va shu yo'nalishga burilgan kadr.
    const attempt = async (uid, { person = 10, kind = 'in', loc = office, clock, turnOk = true, wrongWay = false, sameFrame = null, ip = '9.9.9.9' } = {}) => {
      const ch = await service.challenge(pool, user(uid), at(monday, clock));
      const sign = (ch.direction === 'left' ? 1 : -1) * (wrongWay ? -1 : 1);
      const j = sameFrame ?? (jitter += 1);
      return service.check(pool, analyzer, user(uid), { kind, challenge: ch.id, location: loc,
        frame: frame(person, 0, 1, j), turned: frame(person, turnOk ? 0.3 * sign : 0.02, 1, j) }, { now: at(monday, clock), ip });
    };

    await t.test('grafik yoqilmagan xodim uchun tugma yo‘q, rol cheklovlari, ikki xodimga bir login', async () => {
      assert.equal((await service.me(pool, user('ali'))).tracked, false);
      assert.equal((await service.me(pool, user('dup'))).reason, 'ambiguous');
      await assert.rejects(service.saveSchedule(pool, user('rop'), 'e-ali', { days: { 1: { start: '09:00', end: '18:00' } } }), { status: 403 });
      await assert.rejects(service.daily(pool, user('rop'), monday), { status: 403 });
      await assert.rejects(service.daily(pool, user('ali'), monday), { status: 403 });
      await service.saveSchedule(pool, user('hr'), 'e-ali', { days: { 1: { start: '09:00', end: '18:00' }, 2: { start: '09:00', end: '18:00' } } });
      await service.saveSchedule(pool, user('hr'), 'e-vali', { days: { 1: { start: '10:00', end: '19:00' } } });
      const me = await service.me(pool, user('ali'), at(monday, '08:30'));
      assert.deepEqual([me.tracked, me.face, me.nextAction, me.today.status], [true, 'none', 'in', 'not_ready']);
      await assert.rejects(service.saveSchedule(pool, user('hr'), 'e-ali', { days: { 1: { start: '18:00', end: '09:00' } } }), { status: 400 });
    });

    await t.test('yuz namunasi: o‘lcham, mos kelmaslik, HR faqat ko‘rgan rasmini tasdiqlaydi, boshqa xodim yuzi', async () => {
      await assert.rejects(service.submitOwnFace(pool, analyzer, user('ali'), { frames: [frame(10), 'data:image/png;base64,AAAA'] }), { status: 400 });
      await assert.rejects(service.submitOwnFace(pool, analyzer, user('ali'), { frames: [frame(10), frame(30)] }), { status: 422 });
      await assert.rejects(service.submitOwnFace(pool, analyzer, user('ali'), { frames: [frame(10), frame(10, 0, 2)] }), { status: 422 });
      const first = await service.submitOwnFace(pool, analyzer, user('ali'), { frames: [frame(40), frame(40)] });
      assert.ok((await outbox()).some(r => r.unique_key.startsWith('att:face:e-ali')));
      // HR oynani ochgan payt xodim boshqa yuzni yuboradi — HR'ning tasdig'i eski rasmga tegishli, rad etiladi.
      const second = await service.submitOwnFace(pool, analyzer, user('ali'), { frames: [frame(10), frame(10)] });
      await assert.rejects(service.transaction(pool, db => service.reviewFace(db, analyzer, user('hr'), 'e-ali', 'approve', first.photoId)), { status: 409 });
      assert.equal((await pool.query("SELECT COUNT(*)::int n FROM staff_att_photos WHERE employee_id='e-ali' AND purpose='enroll'")).rows[0].n, 1, 'eski namuna rasmi o‘chiriladi');
      await assert.rejects(service.transaction(pool, db => service.reviewFace(db, analyzer, user('rop'), 'e-ali', 'approve', second.photoId)), { status: 403 });
      assert.equal((await service.transaction(pool, db => service.reviewFace(db, analyzer, user('hr'), 'e-ali', 'approve', second.photoId))).state, 'approved');
      const stored = (await pool.query("SELECT p.mime,p.data FROM staff_att_faces f JOIN staff_att_photos p ON p.id=f.photo_id WHERE f.employee_id='e-ali'")).rows[0];
      assert.equal(png.decodePng(stored.data).rgb[0], 10, 'HR ko‘radigan rasm — tekshirilgan kadrning o‘zi');
      await assert.rejects(service.enrollFor(pool, analyzer, user('hr'), 'e-vali', { frames: [frame(10), frame(10)] }), /Ali Valiyev/);
      await assert.rejects(service.submitOwnFace(pool, analyzer, user('vali'), { frames: [frame(10), frame(10)] }), e => e.status === 409 && !/Ali/.test(e.message));
      assert.equal((await service.enrollFor(pool, analyzer, user('hr'), 'e-vali', { frames: [frame(70), frame(70)] })).state, 'approved');
      await assert.rejects(service.submitOwnFace(pool, analyzer, user('ali'), { frames: [frame(10), frame(10)] }), { status: 409 });
    });

    await t.test('hisob grafik yoqilgan va yuz tasdiqlangan kundan boshlanadi', async () => {
      const first = await service.daily(pool, user('boss'), monday, at(monday, '20:00'));
      assert.equal(first.rows.find(r => r.employeeId === 'e-vali').status, 'before');
      await pool.query("DELETE FROM staff_att_day_results");
      await pool.query("UPDATE staff_att_schedules SET tracked_since='2026-10-01'");
      await pool.query("UPDATE staff_att_faces SET first_approved_at='2026-10-01T03:00:00Z'");
      const m = await service.monthly(pool, user('boss'), '2026-09', at('2026-10-26', '20:00'));
      assert.ok(m.rows.every(r => r.days.every(d => ['before', 'off'].includes(d.status))), 'sentyabr hisoblanmaydi');
      await pool.query("DELETE FROM staff_att_day_results");
    });

    await t.test('belgilash: topshiriq, lokatsiya, yuz, tiriklik, yo‘nalish, qayta yuborish, kechikish, takror', async () => {
      await pool.query('DELETE FROM domwork_bot_outbox');
      await assert.rejects(service.check(pool, analyzer, user('ali'), { kind: 'in', challenge: 'yoq', location: office, frame: frame(10), turned: frame(10, 0.3) }, { now: at(monday, '09:05') }), { status: 409 });
      const far = await attempt('ali', { loc: { ...office, lat: office.lat + 0.02 }, clock: '09:10' });
      assert.deepEqual([far.ok, far.reason], [false, 'outside']);
      const farRow = (await pool.query("SELECT lat,lng,distance_m,photo_id FROM staff_att_events WHERE reason='outside'")).rows[0];
      assert.deepEqual([farRow.lat, farRow.lng, farRow.photo_id], [null, null, null], 'ofisdan tashqarida koordinata va rasm saqlanmaydi');
      assert.ok(farRow.distance_m > 2000);
      const wrong = await attempt('ali', { person: 70, clock: '09:11' });
      assert.deepEqual([wrong.ok, wrong.reason], [false, 'mismatch']);
      assert.deepEqual((await outbox()).map(r => r.target_id), ['111'], 'yuz mos emas — faqat direktorga (ROP HR bo‘limiga kira olmaydi)');
      assert.equal((await attempt('ali', { turnOk: false, clock: '09:12' })).reason, 'liveness');
      assert.equal((await attempt('ali', { wrongWay: true, clock: '09:13' })).reason, 'wrong_direction');
      const ok = await attempt('ali', { clock: '09:17', sameFrame: 24 });
      assert.deepEqual([ok.ok, ok.clock, ok.today.status, ok.today.lateMinutes], [true, '09:17', 'late', 17]);
      assert.ok((await outbox()).some(r => r.unique_key === 'att:late:e-ali:2026-10-26:111' && /17 daqiqa/.test(r.payload.text)));
      assert.equal((await pool.query("SELECT COUNT(*)::int n FROM domwork_bot_face_logs WHERE employee_id='e-ali'")).rows[0].n, 1);
      await assert.rejects(attempt('ali', { clock: '09:30' }), { status: 409 });
      const replay = await attempt('ali', { kind: 'out', clock: '17:00', sameFrame: 24 });
      assert.deepEqual([replay.ok, replay.reason], [false, 'replay']);
      const out = await attempt('ali', { kind: 'out', clock: '17:20' });
      assert.deepEqual([out.today.earlyMinutes, out.today.workedMinutes], [40, 483]);
      assert.ok(!(await outbox()).some(r => r.unique_key.startsWith('att:early:e-ali')), 'erta ketish xabari kun oxirida');
      await service.tick(pool, at(monday, '19:05'));
      assert.ok((await outbox()).some(r => r.unique_key.startsWith('att:early:e-ali')));
      const photo = (await pool.query("SELECT p.data FROM staff_att_events e JOIN staff_att_photos p ON p.id=e.photo_id WHERE e.ok AND e.kind='in'")).rows[0];
      const img = png.decodePng(photo.data);
      assert.deepEqual([img.width, img.height], [180, 240], 'dalil rasmi tekshirilgan kadrdan kichraytirilgan');
    });

    await t.test('kompyuterdan: ofis IP manzili GPS o‘rnini bosadi; parallel so‘rov rad etiladi', async () => {
      await service.saveSettings(pool, user('hr'), { officeIps: '1.2.3.4' });
      const noGps = await attempt('vali', { person: 70, loc: null, clock: '10:02', ip: '5.5.5.5' });
      assert.equal(noGps.reason, 'no_location');
      const viaIp = await attempt('vali', { person: 70, loc: null, clock: '10:03', ip: '::ffff:1.2.3.4' });
      assert.equal(viaIp.ok, true);
      assert.equal((await pool.query("SELECT location_method FROM staff_att_events WHERE employee_id='e-vali' AND ok")).rows[0].location_method, 'ip');
      await service.saveSettings(pool, user('hr'), { officeIps: '' });
      const slow = { ...analyzer, analyze: async (...a) => { await new Promise(r => setTimeout(r, 150)); return analyzer.analyze(...a); } };
      const ch1 = await service.challenge(pool, user('vali'), at(monday, '18:00')), ch2 = await service.challenge(pool, user('vali'), at(monday, '18:00'));
      const body = ch => ({ kind: 'out', challenge: ch.id, location: office, frame: frame(70, 0, 1, 23), turned: frame(70, ch.direction === 'left' ? 0.3 : -0.3, 1, 23) });
      const results = await Promise.allSettled([service.check(pool, slow, user('vali'), body(ch1), { now: at(monday, '18:00') }),
        service.check(pool, slow, user('vali'), body(ch2), { now: at(monday, '18:00') })]);
      assert.equal(results.filter(r => r.status === 'rejected' && r.reason.status === 429).length, 1);
    });

    await t.test('kunlik/oylik jadval, kelmadi xabari bir marta, qo‘lda holat, tarix muzlatiladi', async () => {
      await pool.query("DELETE FROM staff_att_events WHERE employee_id='e-vali'");
      const d = await service.daily(pool, user('boss'), monday, at(monday, '20:00'));
      const ali = d.rows.find(r => r.employeeId === 'e-ali'), vali = d.rows.find(r => r.employeeId === 'e-vali');
      assert.deepEqual([ali.status, ali.rejected, ali.attempts.length], ['late', 5, 7]);
      assert.equal(vali.status, 'absent');
      await pool.query('DELETE FROM domwork_bot_outbox');
      await service.tick(pool, at(monday, '12:05'));
      await service.tick(pool, at(monday, '12:10'));
      assert.equal((await outbox()).filter(r => r.unique_key.startsWith('att:absent:e-vali')).length, 2, 'har bir qabul qiluvchiga bitta');
      await assert.rejects(service.setOverride(pool, user('rop'), { employeeId: 'e-vali', date: monday, status: 'excused' }), { status: 403 });
      await service.setOverride(pool, user('hr'), { employeeId: 'e-vali', date: monday, status: 'excused', note: 'Shifokorda' });
      assert.equal((await service.daily(pool, user('boss'), monday, at(monday, '20:00'))).rows.find(r => r.employeeId === 'e-vali').status, 'excused');
      await pool.query("INSERT INTO domwork_bot_leave_requests VALUES('l1','e-ali','approved','2026-10-27','2026-10-27')");
      const m = await service.monthly(pool, user('boss'), '2026-10', at('2026-10-31', '20:00'));
      const aliMonth = m.rows.find(r => r.employeeId === 'e-ali');
      assert.equal(aliMonth.days.find(x => x.date === '2026-10-27').status, 'leave');
      assert.equal(aliMonth.days.find(x => x.date === '2026-10-26').status, 'late');
      assert.equal(aliMonth.totals.late, 1);
      // Keyin grafik o'zgarsa ham o'tgan kun natijasi o'zgarmaydi.
      await service.saveSchedule(pool, user('hr'), 'e-ali', { days: { 1: { start: '10:00', end: '18:00' } } });
      const again = await service.monthly(pool, user('boss'), '2026-10', at('2026-10-31', '20:00'));
      assert.equal(again.rows.find(r => r.employeeId === 'e-ali').days.find(x => x.date === '2026-10-26').lateMinutes, 17);
    });

    await t.test('rasmni faqat egasi yoki rahbar ko‘radi', async () => {
      const id = (await pool.query("SELECT photo_id FROM staff_att_events WHERE employee_id='e-ali' AND ok LIMIT 1")).rows[0].photo_id;
      assert.ok((await service.photo(pool, user('ali'), id)).data.length > 100);
      assert.ok(await service.photo(pool, user('hr'), id));
      await assert.rejects(service.photo(pool, user('vali'), id), { status: 403 });
      // Davomat v2 (DavRecord): ROP o'z sotuv menejerlarining selfiesini ko'radi; boshqa lavozimdagilarnikini — yo'q.
      assert.ok(await service.photo(pool, user('rop'), id));
      const valiPhoto = (await pool.query("SELECT photo_id FROM staff_att_events WHERE employee_id='e-vali' AND photo_id IS NOT NULL LIMIT 1")).rows[0]?.photo_id;
      if (valiPhoto) await assert.rejects(service.photo(pool, user('rop'), valiPhoto), { status: 403 });
    });

    await t.test('davomat v2: javob so‘rash, ROP tasdiqlaydi, rad etish sababi, ruxsat bilan kech kelish', async () => {
      const tue = '2026-11-09'; // dushanba (grafik: Du 10:00–18:00)
      await pool.query("UPDATE hr_employees SET lang='english' WHERE id='e-ali'");
      await assert.rejects(service.createRequest(pool, user('ali'), { type: 'late', date: tue, time: '10:30' }, at(tue, '07:00')), /Sabab/);
      const r1 = await service.createRequest(pool, user('ali'), { type: 'late', date: tue, time: '11:30', reason: 'Shifokor', comment: 'bola' }, at(tue, '07:00'));
      assert.equal(r1.approver.kind, 'rop');
      await assert.rejects(service.createRequest(pool, user('ali'), { type: 'late', date: tue, time: '10:00', reason: 'Shifokor' }, at(tue, '07:01')), { status: 409 });
      // tasdiqlovchiga Telegram tugmalari (ROP + o'z tilidagi)
      assert.ok((await outbox()).some(r => r.unique_key === `attreq:${r1.id}:222`));
      // marketolog/sotuv bo'lmagan xodim tasdiqlay olmaydi; ROP navbatida ko'rinadi
      await assert.rejects(service.decideRequest(pool, user('ali'), r1.id, { decision: 'approve' }), { status: 403 });
      const inbox = await service.inbox(pool, user('rop'));
      assert.deepEqual(inbox.rows.map(r => [r.name, r.type, r.time]), [['Ali Valiyev', 'late', '11:30']]);
      await assert.rejects(service.decideRequest(pool, user('rop'), r1.id, { decision: 'reject' }), /sabab/i);
      await service.decideRequest(pool, user('rop'), r1.id, { decision: 'approve' });
      assert.ok((await outbox()).some(r => r.unique_key === `attreq:${r1.id}:approved` && r.target_id === '333'), 'xodimga javob');
      // 10:20 da keldi — kechikish yozilmaydi, kun "Sababli"
      const day = await service.computeDay(pool, 'e-ali', tue, await service.getSettings(pool), at(tue, '11:00'));
      const ev = { id: 'ev-tue', employee_id: 'e-ali', user_id: 'ali', kind: 'in', work_date: tue, occurred_at: at(tue, '11:20'), ok: true };
      assert.equal(day.status, 'waiting');
      await pool.query(`INSERT INTO staff_att_events(id,employee_id,user_id,kind,work_date,occurred_at,ok) VALUES($1,$2,$3,$4,$5,$6,$7)`, Object.values(ev));
      const d2 = await service.computeDay(pool, 'e-ali', tue, await service.getSettings(pool), at(tue, '12:00'));
      assert.deepEqual([d2.status, d2.lateMinutes], ['excused', 0]);
      // /me: ruxsat vaqtigacha qulf yo'q
      const me = await service.me(pool, user('ali'), at(tue, '12:00'));
      assert.deepEqual([me.tracked, me.phase, me.today.status], [true, 'working', 'excused']);
      // ruxsat vaqtigacha qulf yo'q (rules.phase alohida sinalgan)
      // rad etish: sabab bilan, kun odatdagi qoida
      const r2 = await service.createRequest(pool, user('ali'), { type: 'early_leave', date: '2026-11-16', time: '16:00', reason: 'Oilaviy' }, at('2026-11-02', '08:00'));
      await service.decideRequest(pool, user('rop'), r2.id, { decision: 'reject', reason: 'Bugun ish koʻp', note: '17:00 da yigʻilish' });
      const mine = await service.myRequests(pool, user('ali'), at('2026-11-02', '08:05'));
      assert.deepEqual(mine.rows.find(r => r.id === r2.id).state, 'rejected');
      assert.ok((await outbox()).some(r => r.unique_key === `attreq:${r2.id}:rejected` && /Bugun ish koʻp/.test(r.payload.text)));
      // bekor qilish faqat kutilayotganda
      await assert.rejects(service.cancelRequest(pool, user('ali'), r2.id), { status: 409 });
      // jamoa: ROP faqat sotuv menejerlarini ko'radi (marketolog yo'q)
      const team = await service.team(pool, user('rop'), tue, at(tue, '12:00'));
      assert.deepEqual(team.rows.map(r => r.employeeId), ['e-ali']);
      // HR xodim, direktor emas — so'rovlar ekrani yopiq
      await assert.rejects(service.inbox(pool, user('hr')), { status: 403 });
      // direktor ROP navbatidagini ko'rmaydi (admin navbati alohida), lekin hal qila oladi
      assert.equal((await service.inbox(pool, user('boss'))).rows.length, 0);
      // asosiy ustoz uchun so'rov va belgilash yo'q
      await assert.rejects(service.createRequest(pool, user('teacher'), { type: 'absent', date: tue, reason: 'Kasallik' }, at(tue, '07:00')), { status: 403 });
    });

    await t.test('ustoz darslari: Telegram video chat, bog‘lanmagan guruh, davomat vaqti', async () => {
      await pool.query(`INSERT INTO teachers VALUES('e-t','mwf',15);
        INSERT INTO students(id,name,teacher_id,lesson_day_of_week,lesson_time,lesson_duration) VALUES
          ('s1','Aziz','e-t',1,'10:00',15),('s2','Bek','e-t',1,'10:15',15),('s3','Jasur','e-t',1,'11:00',15),('s4','Muzlatilgan','e-t',1,'16:00',15),
          ('s5','Laylo','e-t',1,'15:00',15);
        UPDATE students SET extra_data='{"status":"frozen"}' WHERE id='s4';
        INSERT INTO domwork_learning_groups VALUES('g1','classroom','e-t','-1001',false);`);
      const msg = (chat, id, clock, extra) => ({ message_id: id, chat: { id: chat, type: 'supergroup' }, date: Math.floor(at(monday, clock).getTime() / 1000), ...extra });
      assert.equal(await lessons.recordVideoChat(pool, msg(-1001, 1, '10:03', { video_chat_started: {} })), true);
      await lessons.recordVideoChat(pool, msg(-1001, 2, '10:31', { video_chat_ended: { duration: 1680 } }));
      await lessons.recordVideoChat(pool, msg(-1001, 2, '10:31', { video_chat_ended: { duration: 1680 } })); // takror
      await lessons.recordVideoChat(pool, msg(-1001, 3, '11:12', { video_chat_started: {} }));
      await lessons.recordVideoChat(pool, msg(-1001, 4, '11:14', { video_chat_ended: { duration: 120 } }));
      assert.equal(await lessons.recordVideoChat(pool, msg(-2002, 5, '15:00', { video_chat_started: {} })), false, 'CRM’ga bog‘lanmagan guruh yozilmaydi');
      assert.equal(await lessons.recordVideoChat(pool, msg(-1001, 6, '15:00', { text: 'salom' })), false);
      // 15:00 dagi dars Telegram'da emas, boshqa joyda o'tdi — davomat vaqtida belgilangan.
      await lessons.recordMark(pool, { teacherId: 'e-t', studentId: 's5', date: monday, duty: 'main' });
      await pool.query("UPDATE staff_att_lesson_marks SET first_marked_at=$1 WHERE student_id='s5'", [at(monday, '15:06')]);
      const r = await service.lessonReport(pool, user('boss'), monday, at(monday, '20:00'));
      const row = r.rows.find(x => x.teacherId === 'e-t');
      assert.equal(row.source, 'telegram');
      assert.equal(row.lessons, 4, 'muzlatilgan o‘quvchi hisoblanmaydi');
      assert.deepEqual(row.blocks.map(b => [b.start, b.end, b.status, b.source]),
        [['10:00', '10:30', 'on_time', 'telegram'], ['11:00', '11:15', 'late_start', 'telegram'], ['15:00', '15:15', 'marked', 'davomat']]);
      await pool.query("UPDATE domwork_learning_groups SET archived=true");
      await lessons.recordMark(pool, { teacherId: 'e-t', studentId: 's1', date: monday, duty: 'main' });
      await pool.query("UPDATE staff_att_lesson_marks SET first_marked_at=$1 WHERE student_id='s1'", [at(monday, '10:05')]);
      await lessons.recordMark(pool, { teacherId: 'e-t', studentId: 's1', date: monday, duty: 'main' }); // birinchisi saqlanadi
      const row2 = (await service.lessonReport(pool, user('boss'), monday, at(monday, '20:00'))).rows.find(x => x.teacherId === 'e-t');
      assert.equal(row2.source, 'davomat');
      assert.equal(row2.blocks[0].slots[0].markedClock, '10:05');
      assert.deepEqual(row2.blocks.map(b => b.status), ['not_marked', 'not_marked', 'marked']);
      await assert.rejects(service.lessonReport(pool, user('teacher'), monday), { status: 403 });
    });

    await t.test('eski rasmlar, ketgan xodim namunasi tozalanadi; namunani o‘chirish tarixni buzmaydi', async () => {
      await pool.query("UPDATE staff_att_photos SET created_at=NOW()-INTERVAL '100 days' WHERE purpose='check'");
      const r = await service.tick(pool, new Date());
      assert.ok(r.purged >= 3);
      await pool.query("UPDATE hr_employees SET status='inactive' WHERE id='e-vali'");
      await service.tick(pool, new Date());
      assert.equal((await pool.query("SELECT COUNT(*)::int n FROM staff_att_photos WHERE employee_id='e-vali' AND purpose='enroll'")).rows[0].n, 0);
      await service.deleteFace(pool, user('hr'), 'e-ali');
      const m = await service.monthly(pool, user('boss'), '2026-10', at('2026-10-31', '20:00'));
      const days = m.rows.find(x => x.employeeId === 'e-ali').days;
      assert.equal(days.find(x => x.date === '2026-10-26').status, 'late', 'o‘tgan kun o‘zgarmaydi');
      const nov = await service.monthly(pool, user('boss'), '2026-11', at('2026-11-05', '20:00'));
      assert.equal(nov.rows.find(x => x.employeeId === 'e-ali').days.find(x => x.date === '2026-11-02').status, 'not_ready', 'namuna o‘chirilgach "kelmadi" emas');
      assert.equal((await service.me(pool, user('ali'))).face, 'reset');
      // Biometrik belgilar muddati o'tgach o'chiriladi.
      await pool.query("UPDATE staff_att_events SET occurred_at=occurred_at-INTERVAL '200 days'");
      await service.tick(pool, new Date());
      assert.equal((await pool.query('SELECT COUNT(*)::int n FROM staff_att_events WHERE descriptor IS NOT NULL OR frame_hash IS NOT NULL')).rows[0].n, 0);
    });
  } finally {
    await pool.end();
  }
});
