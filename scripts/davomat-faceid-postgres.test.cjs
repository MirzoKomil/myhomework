// Davomat v2 — haqiqiy PostgreSQL bilan: bot tugmalari (ochiq tranzaksiya ichida), "Ofisda emasman",
// parallel qarorlar, akademik rahbar doirasi, til bo'limi, "hali belgilanmadi" xabari bir marta.
// Ishga tushirish: node scripts/run-payroll-postgres.cjs scripts/davomat-faceid-postgres.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const service = require('../server/services/staffAttendance');
const time = require('../server/services/staffAttendance/time');
const png = require('../server/services/staffAttendance/png');
const real = require('../server/services/staffAttendance/face');

const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (parsed.hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(parsed.pathname)) throw Error('Only disposable loopback test databases are allowed');
}

function frame(person, yaw = 0, jitter = 0) {
  const rgb = new Uint8Array(360 * 480 * 3);
  let seed = (person * 131 + jitter * 7919 + 1) >>> 0;
  for (let i = 12; i < rgb.length; i += 3) { seed = (seed * 1664525 + 1013904223) >>> 0; rgb[i] = rgb[i + 1] = rgb[i + 2] = seed >>> 24; }
  rgb.set([person, Math.round(yaw * 100) + 100, 1, jitter]);
  return 'data:image/png;base64,' + png.encodePng({ width: 360, height: 480, rgb }).toString('base64');
}
const analyzer = {
  MATCH_THRESHOLD: real.MATCH_THRESHOLD, distance: real.distance, bestDistance: real.bestDistance,
  async analyze(buf) {
    const { rgb } = png.decodePng(buf);
    const [person, yawCode, faces, jitter] = rgb;
    const descriptor = Array(128).fill(person / 100);
    descriptor[0] += (jitter % 5) * 0.07; descriptor[1] += (Math.floor(jitter / 5) % 5) * 0.07;
    return { faces, yaw: (yawCode - 100) / 100, box: { width: 150 }, descriptor };
  },
};
const OFFICE = { lat: 40.789035, lng: 72.346787, accuracy: 15 };
const FAR = { lat: 40.82, lng: 72.35, accuracy: 15 };
const at = (date, clock) => time.atTashkent(date, time.parseClock(clock));
const user = id => ({ id });
const DAYS = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(k => [k, { start: '09:00', end: '18:00' }]));

test('davomat v2 — PostgreSQL', { skip: !url }, async t => {
  const pool = new Pool({ connectionString: url });
  let jitter = 0;
  try {
    await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,phone TEXT);
      CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,role TEXT,lang TEXT,login TEXT,status TEXT,phone TEXT,dual_role BOOLEAN);
      CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
      CREATE TABLE teachers(id TEXT PRIMARY KEY,schedule_pattern TEXT,lesson_duration INTEGER);
      CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,teacher_id TEXT,lesson_day_of_week INTEGER,lesson_time TEXT,lesson_duration INTEGER,extra_data JSONB DEFAULT '{}');
      CREATE TABLE domwork_learning_groups(id TEXT PRIMARY KEY,type TEXT,teacher_id TEXT,chat_id TEXT,archived BOOLEAN DEFAULT FALSE);
      CREATE TABLE domwork_bot_links(telegram_id TEXT PRIMARY KEY,account_kind TEXT,account_id TEXT,phone TEXT,paused BOOLEAN DEFAULT FALSE);
      CREATE TABLE domwork_bot_outbox(id TEXT PRIMARY KEY,unique_key TEXT UNIQUE,target_kind TEXT,target_id TEXT,role TEXT,method TEXT,payload JSONB,not_before TIMESTAMPTZ);
      CREATE TABLE domwork_bot_callbacks(id TEXT PRIMARY KEY,data JSONB,expires_at TIMESTAMPTZ);
      CREATE TABLE domwork_bot_sessions(telegram_id TEXT PRIMARY KEY,state JSONB,expires_at TIMESTAMPTZ);
      CREATE TABLE domwork_staff_telegram_proofs(user_id TEXT,telegram_id TEXT);
      CREATE FUNCTION domwork_phone(v TEXT) RETURNS TEXT AS $$ SELECT regexp_replace(COALESCE(v,''),'\\D','','g') $$ LANGUAGE sql;
      INSERT INTO users(id,name,email,role) VALUES('boss','Direktor','boss','admin'),('rop-ru','Dilnoza','rop-ru','rop'),('rop-en','Kamola','rop-en','rop'),
        ('ak','Malika','ak','employee'),('ali','Ali','ali','sales_manager'),('bek','Bek','bek','sales_manager'),('yor','Javohir','yor','teacher'),('yor2','Sevara','yor2','teacher');
      INSERT INTO hr_employees(id,name,role,lang,login,status) VALUES('e-rru','Dilnoza Karimova','rop','russian','rop-ru','active'),('e-ren','Kamola','rop','english','rop-en','active'),
        ('e-ak','Malika Sobirova','head-of-teachers','english','ak','active'),('e-ali','Ali Valiyev','sotuv-menejeri','english','ali','active'),
        ('e-bek','Bek Ruslanov','sotuv-menejeri','russian','bek','active'),('e-yor','Javohir Karimov','yordamchi','english','yor','active'),
        ('e-yor2','Sevara Nazarova','yordamchi','russian','yor2','active');
      INSERT INTO domwork_bot_links VALUES('111','user','boss','998',false),('222','user','rop-ru','998',false),('223','user','rop-en','998',false),
        ('224','user','ak','998',false),('333','user','ali','998',false);
      INSERT INTO domwork_staff_telegram_proofs VALUES('boss','111'),('rop-ru','222'),('rop-en','223'),('ak','224');`);
    await service.initSchema(pool);
    for (const [e, p] of [['e-ali', 10], ['e-bek', 20], ['e-yor', 30], ['e-yor2', 40]]) {
      await service.saveSchedule(pool, user('boss'), e, { days: DAYS });
      await service.enrollFor(pool, analyzer, user('boss'), e, { frames: [frame(p), frame(p)] });
    }
    await pool.query("UPDATE staff_att_faces SET first_approved_at='2026-10-01T00:00:00Z'; UPDATE staff_att_schedules SET tracked_since='2026-10-01'");
    const outbox = async () => (await pool.query('SELECT unique_key,target_id,method,payload FROM domwork_bot_outbox ORDER BY unique_key')).rows;
    const check = async (uid, person, date, clock, extra = {}) => {
      const ch = await service.challenge(pool, user(uid), at(date, clock));
      const j = (jitter += 1);
      return service.check(pool, analyzer, user(uid), { kind: extra.kind || 'in', challenge: ch.id, location: extra.loc || OFFICE, outside: extra.outside,
        frame: frame(person, 0, j), turned: frame(person, ch.direction === 'left' ? 0.3 : -0.3, j) }, { now: at(date, clock), ip: '9.9.9.9' });
    };

    await t.test('til bo‘limi: rus ROP ingliz menejer so‘rovini ko‘rmaydi va hal qila olmaydi', async () => {
      const r = await service.createRequest(pool, user('ali'), { type: 'absent', date: '2026-11-20', reason: 'Kasallik' }, at('2026-11-02', '08:00'));
      assert.equal(r.approver.name, 'Kamola');
      assert.ok(!(await service.inbox(pool, user('rop-ru'))).rows.some(x => x.id === r.id));
      await assert.rejects(service.decideRequest(pool, user('rop-ru'), r.id, { decision: 'approve' }), { status: 403 });
      // 403 holat oshkor bo'lishidan oldin: tasdiqlangandan keyin ham begona ROP 403 oladi (409/200 emas)
      await service.decideRequest(pool, user('rop-en'), r.id, { decision: 'approve' });
      await assert.rejects(service.decideRequest(pool, user('rop-ru'), r.id, { decision: 'approve' }), { status: 403 });
      assert.deepEqual((await outbox()).filter(m => m.unique_key.startsWith(`attreq:${r.id}:2`)).map(m => m.target_id), ['223'], 'faqat ingliz ROP');
    });

    await t.test('bot tugmalari ochiq tranzaksiya ichida: tasdiqlash va rad etish sababi', async () => {
      const queue = require('../server/services/domworkBot/queue');
      const callbacks = require('../server/services/domworkBot/callbacks');
      const handlers = require('../server/services/domworkBot/handlers');
      const r1 = await service.createRequest(pool, user('bek'), { type: 'late', date: '2026-11-20', time: '10:30', reason: 'Shifokor' }, at('2026-11-02', '08:00'));
      const r2 = await service.createRequest(pool, user('bek'), { type: 'early_leave', date: '2026-11-21', time: '16:00', reason: 'Oilaviy' }, at('2026-11-02', '08:00'));
      const btn = async (id, i) => (await outbox()).find(m => m.unique_key === `attreq:${id}:222`).payload.reply_markup.inline_keyboard[0][i].callback_data;
      const cq = (n, data) => ({ update_id: n, callback_query: { id: 'q' + n, from: { id: 222 }, data, message: { chat: { id: 222, type: 'private' }, message_id: n } } });
      // Bot navbati kabi: bitta client, BEGIN ... COMMIT (queue.transaction)
      const ok1 = await btn(r1.id, 0), no2 = await btn(r2.id, 1);
      await queue.transaction(pool, db => callbacks.handle(db, cq(1, ok1), {}));
      assert.equal((await pool.query('SELECT state,decided_by FROM staff_att_requests WHERE id=$1', [r1.id])).rows[0].state, 'approved');
      assert.ok((await outbox()).some(m => m.method === 'editMessageReplyMarkup' && m.target_id === '222'), 'bot tugmasi "Tasdiqlandi" ga almashadi');
      await queue.transaction(pool, db => callbacks.handle(db, cq(2, no2), {}));
      assert.equal((await pool.query("SELECT state FROM domwork_bot_sessions WHERE telegram_id='222'")).rows[0].state.type, 'attreq-reject');
      const handle = handlers.createHandler({ crm: {} });
      await queue.transaction(pool, db => handle(db, { update_id: 3, message: { message_id: 3, from: { id: 222 }, chat: { id: 222, type: 'private' }, text: 'Bugun ish koʻp' } }));
      const row = (await pool.query('SELECT state,decision_reason FROM staff_att_requests WHERE id=$1', [r2.id])).rows[0];
      assert.deepEqual([row.state, row.decision_reason], ['rejected', 'Bugun ish koʻp']);
      assert.equal((await pool.query("SELECT COUNT(*)::int n FROM domwork_bot_sessions WHERE telegram_id='222'")).rows[0].n, 0);
    });

    await t.test('parallel qarorlar: bittasi o‘tadi, ikkinchisi 409 yoki takror (bir xil qaror)', async () => {
      const r = await service.createRequest(pool, user('bek'), { type: 'absent', date: '2026-11-25', reason: 'Kasallik' }, at('2026-11-02', '08:00'));
      const res = await Promise.allSettled([
        service.decideRequest(pool, user('rop-ru'), r.id, { decision: 'approve' }),
        service.decideRequest(pool, user('boss'), r.id, { decision: 'reject', reason: 'Oldindan aytilmadi' })]);
      const ok = res.filter(x => x.status === 'fulfilled'), bad = res.filter(x => x.status === 'rejected');
      assert.equal(ok.length, 1); assert.equal(bad[0].reason.status, 409);
      const final = (await pool.query('SELECT state FROM staff_att_requests WHERE id=$1', [r.id])).rows[0].state;
      assert.equal(final, ok[0].value.state);
      assert.equal((await outbox()).filter(m => m.unique_key.startsWith(`attreq:${r.id}:approved`) || m.unique_key.startsWith(`attreq:${r.id}:rejected`)).length, 0, 'bek botga ulanmagan');
    });

    await t.test('so‘rov chegaralari serverda: kelgandan keyin "kech qolaman", dam olish kuni, 60 kun', async () => {
      const d = '2026-11-26';
      assert.equal((await check('bek', 20, d, '09:05')).ok, true);
      await assert.rejects(service.createRequest(pool, user('bek'), { type: 'late', date: d, time: '10:00', reason: 'x' }, at(d, '09:10')), { status: 409 });
      await assert.rejects(service.createRequest(pool, user('bek'), { type: 'late', date: '2026-11-27', time: '19:00', reason: 'x' }, at(d, '09:10')), /ish vaqti/);
      await assert.rejects(service.createRequest(pool, user('bek'), { type: 'absent', date: '2027-03-01', reason: 'x' }, at(d, '09:10')), /60 kun/);
      await service.saveSchedule(pool, user('boss'), 'e-bek', { days: { ...DAYS, 7: undefined } });
      await assert.rejects(service.createRequest(pool, user('bek'), { type: 'absent', date: '2026-11-29', reason: 'x' }, at(d, '09:10')), /dam olish/);
      await service.saveSchedule(pool, user('boss'), 'e-bek', { days: DAYS });
    });

    await t.test('Ofisda emasman: kutilmoqda → tasdiqlansa Sababli; rad etilsa odatdagi; ofisga kelsa avtomatik bekor', async () => {
      const d1 = '2026-11-16';
      const o = await check('ali', 10, d1, '09:20', { loc: FAR, outside: { reason: 'Mijoz bilan uchrashuv', comment: 'Bobur aka' } });
      assert.deepEqual([o.ok, o.outside, o.today.status], [true, true, 'pending']);
      const ev = (await pool.query("SELECT lat,lng,photo_id FROM staff_att_events WHERE location_method='outside' AND work_date=$1", [d1])).rows[0];
      assert.deepEqual([ev.lat, ev.lng, !!ev.photo_id], [null, null, true], 'uy koordinatasi saqlanmaydi, selfie saqlanadi');
      const req = (await service.inbox(pool, user('rop-en'))).rows.find(x => x.type === 'outside');
      assert.ok(req && req.distance > 2000 && req.photoId);
      assert.ok(await service.photo(pool, user('rop-en'), req.photoId), 'ROP o‘z menejeri selfiesini ko‘radi');
      await service.decideRequest(pool, user('rop-en'), req.id, { decision: 'approve' });
      assert.equal((await service.computeDay(pool, 'e-ali', d1, await service.getSettings(pool), at(d1, '20:00'))).status, 'excused');

      const d2 = '2026-11-17';
      await check('ali', 10, d2, '09:30', { loc: FAR, outside: { reason: 'Boshqa' } });
      const req2 = (await service.inbox(pool, user('rop-en'))).rows.find(x => x.type === 'outside');
      await service.decideRequest(pool, user('rop-en'), req2.id, { decision: 'reject', reason: 'Oldindan aytilmadi' });
      assert.equal((await service.computeDay(pool, 'e-ali', d2, await service.getSettings(pool), at(d2, '10:30'))).status, 'waiting', 'rad etilgan belgi hisoblanmaydi');
      const back = await check('ali', 10, d2, '11:00');
      assert.deepEqual([back.ok, back.today.status, back.today.lateMinutes], [true, 'late', 120]);

      const d3 = '2026-11-18';
      await check('ali', 10, d3, '09:05', { loc: FAR, outside: { reason: 'Mijoz bilan uchrashuv' } });
      const late = await check('ali', 10, d3, '10:15');
      assert.deepEqual([late.today.status, late.today.lateMinutes], ['late', 75], 'kutilayotgan "ofisda emasman" ofisdagi belgini yashirmaydi');
      const st = (await pool.query("SELECT state FROM staff_att_requests WHERE employee_id='e-ali' AND work_date=$1 AND type='outside'", [d3])).rows[0].state;
      assert.equal(st, 'cancelled');
    });

    await t.test('akademik rahbar: faqat o‘z tilidagi yordamchilar, ularning selfiesi va so‘rovlari', async () => {
      const d = '2026-11-19';
      assert.equal((await check('yor', 30, d, '09:02')).ok, true);
      assert.equal((await check('yor2', 40, d, '09:03')).ok, true);
      const team = await service.team(pool, user('ak'), d, at(d, '12:00'));
      assert.deepEqual(team.rows.map(r => r.employeeId), ['e-yor'], 'ingliz akademik — faqat ingliz yordamchi; sotuv yo‘q');
      const own = (await pool.query("SELECT photo_id FROM staff_att_events WHERE employee_id='e-yor' AND photo_id IS NOT NULL LIMIT 1")).rows[0].photo_id;
      const other = (await pool.query("SELECT photo_id FROM staff_att_events WHERE employee_id='e-yor2' AND photo_id IS NOT NULL LIMIT 1")).rows[0].photo_id;
      const sales = (await pool.query("SELECT photo_id FROM staff_att_events WHERE employee_id='e-ali' AND photo_id IS NOT NULL LIMIT 1")).rows[0].photo_id;
      assert.ok(await service.photo(pool, user('ak'), own));
      await assert.rejects(service.photo(pool, user('ak'), other), { status: 403 });
      await assert.rejects(service.photo(pool, user('ak'), sales), { status: 403 });
      await assert.rejects(service.teamRecord(pool, user('ak'), 'e-ali', d), { status: 403 });
      const r = await service.createRequest(pool, user('yor'), { type: 'late', date: '2026-11-24', time: '11:00', reason: 'Transport' }, at(d, '12:00'));
      assert.equal(r.approver.kind, 'academic');
      assert.ok((await service.inbox(pool, user('ak'))).rows.some(x => x.id === r.id));
      assert.ok(!(await service.inbox(pool, user('rop-en'))).rows.some(x => x.id === r.id));
      // rus yordamchi — rus akademik yo'q → direktorga
      const r2 = await service.createRequest(pool, user('yor2'), { type: 'absent', date: '2026-11-24', reason: 'Kasallik' }, at(d, '12:00'));
      assert.equal(r2.approver.kind, 'admin');
      // akademik rahbarning o'z so'rovi — direktorga
      const me = await service.me(pool, user('ak'), at(d, '12:00'));
      assert.deepEqual([me.tracked, me.approver.kind], [false, 'academic'], 'grafik yoqilmagan — kuzatilmaydi, lekin tasdiqlovchi');
    });

    await t.test('"hali belgilanmadi" xabari: imtiyozdan keyin bir marta, o‘z ROP va direktorga', async () => {
      const d = '2026-11-30';
      await pool.query("DELETE FROM domwork_bot_outbox WHERE unique_key LIKE 'att:notyet%'");
      // tasdiqlangan "kech qolaman" — ruxsat vaqti + imtiyozgacha xabar yo'q
      const r = await service.createRequest(pool, user('bek'), { type: 'late', date: d, time: '11:00', reason: 'Shifokor' }, at(d, '07:00'));
      await service.decideRequest(pool, user('rop-ru'), r.id, { decision: 'approve' });
      await service.tick(pool, at(d, '09:05'));
      assert.equal((await outbox()).filter(m => m.unique_key.startsWith('att:notyet:e-ali')).length, 0, 'imtiyoz ichida — yo‘q');
      await service.tick(pool, at(d, '09:15'));
      await service.tick(pool, at(d, '09:20'));
      const got = (await outbox()).filter(m => m.unique_key.startsWith(`att:notyet:e-ali:${d}`)).map(m => m.target_id).sort();
      assert.deepEqual(got, ['111', '223'], 'direktor + ingliz ROP, bir martadan; rus ROP yo‘q');
      await service.tick(pool, at(d, '10:00'));
      assert.equal((await outbox()).filter(m => m.unique_key.startsWith(`att:notyet:e-bek:${d}`)).length, 0);
      await service.tick(pool, at(d, '11:12'));
      assert.deepEqual((await outbox()).filter(m => m.unique_key.startsWith(`att:notyet:e-bek:${d}`)).map(m => m.target_id).sort(), ['111', '222']);
    });

    await t.test('push: saqlangan imtiyoz ishlatiladi, dam olish kuni eslatma yo‘q', async () => {
      await service.saveSettings(pool, user('boss'), { ...(await service.getSettings(pool)), graceMinutes: 5 });
      const ev = await service.pushEvents(pool, 'ali', at('2026-12-01', '09:02'));
      assert.match(ev.find(e => e.id === 'att:start:2026-12-01').sub, /5 daqiqadan/);
      await service.saveSchedule(pool, user('boss'), 'e-ali', { days: { 1: { start: '09:00', end: '18:00' } } });
      assert.equal((await service.pushEvents(pool, 'ali', at('2026-12-02', '08:55'))).filter(e => e.type === 'att_shift').length, 0, 'seshanba — dam olish');
    });
  } finally { await pool.end(); }
});
