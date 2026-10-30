const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const store=require('../server/services/domworkBot/store');
const events=require('../server/services/domworkBot/events');
const groups=require('../server/services/domworkGroups');
const inflow=require('../server/services/inflow');
const T=require('../server/services/domworkBot/tone');
const url=process.env.PAYROLL_TEST_DATABASE_URL;
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||!/^\/payroll_test_[a-z0-9]+$/.test(u.pathname))throw Error('Only disposable loopback DBs');}
test('tone helpers escape and format safely',()=>{
 assert.equal(T.who('A<b>&','123456789'),'<a href="tg://user?id=123456789">A&lt;b&gt;&amp;</a>');
 assert.equal(T.who('Ali',''),'<b>Ali</b>');
 assert.equal(T.when('2026-10-30T18:00'),'30-oktyabr, juma · 18:00');
 assert.equal(T.sum(1200000),'1 200 000 so‘m');
 const long=T.fit('<b>x</b>'.repeat(600),T.HTML);assert.equal(long.extra.parse_mode,undefined);assert.doesNotMatch(long.text,/<b>/);
});
test('sales group celebrates a new sale with a mention; a later debt payment is a calm receipt — synthetic data',{skip:!url},async t=>{
 const pool=new Pool({connectionString:url});
 process.env.DOMWORK_BOT_ENABLED='true';
 const run=async()=>{const c=await pool.connect();try{await c.query('BEGIN');await events.processOne(c);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}};
 const add=async(id,key,lead,student,amount)=>{await pool.query(`INSERT INTO payment_records(id,source_key,lead_id,student_id,language,manager_id,paid_date,amount,method,form,debt_snapshot,snapshot,actor_id)
   VALUES($1,$2,$3,$4,'russian','h-s',(NOW() AT TIME ZONE 'Asia/Tashkent')::date,$5,'card','full',$6,$7,'a')`,[id,key,lead,student,amount,student?300000:0,JSON.stringify({name:'Azizbek Toshev',managerName:'Dilnoza Karimova'})]);
  await events.payment(pool,id);};
 try{
  await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,phone TEXT,disabled_at TIMESTAMPTZ);
   CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN,phone TEXT);
   CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
   CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,extra_data JSONB,teacher_id TEXT,assistant_teacher_id TEXT);
   CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,language TEXT,status TEXT,manager_id TEXT,deleted_at TIMESTAMPTZ,extra_data JSONB);
   CREATE TABLE json_data(key TEXT PRIMARY KEY,data JSONB);
   INSERT INTO users VALUES('u-s','Dilnoza Karimova','dil@x','sales_manager','+998901110000',NULL);
   INSERT INTO user_sales_manager_links VALUES('u-s','h-s');
   INSERT INTO hr_employees VALUES('h-s','Dilnoza Karimova','dil@x','sotuv-menejeri','active','russian',false,'+998901110000');
   INSERT INTO json_data VALUES('individualSalesPlans','{"h-s":{"totalAmount":10000000}}');`);
  await groups.initSchema(pool);await store.initSchema(pool);await inflow.initSchema(pool);
  await pool.query("INSERT INTO domwork_bot_links(telegram_id,account_kind,account_id,phone) VALUES('777000111','user','u-s','998901110000')");
  await pool.query("INSERT INTO domwork_bot_groups(id,type,scope,chat_id,active,created_by,title) VALUES('sg','sales','','-100111111',true,'a','Sotuv')");
  await pool.query(`UPDATE domwork_bot_settings SET data=data||'{"eventsEnabled":true,"groupNotificationsEnabled":true}'::jsonb`);
  await add('p1','lead:L1:deposit','L1',null,1200000);await run();
  await add('p2','student:S1:x','L1','S1',500000);await run();
  const rows=(await pool.query("SELECT unique_key,payload FROM domwork_bot_outbox ORDER BY created_at,unique_key")).rows;
  const group=rows.filter(r=>r.unique_key.endsWith(':sales:sg'));
  await t.test('new sale: celebration, mention, month stats and plan',()=>{
   const sale=group[0].payload;
   assert.equal(sale.parse_mode,'HTML');assert.match(sale.text,/YANGI SOTUV/);
   assert.match(sale.text,/<a href="tg:\/\/user\?id=777000111">Dilnoza Karimova<\/a>/);
   assert.match(sale.text,/1 200 000 so‘m/);assert.match(sale.text,/1-sotuv/);assert.match(sale.text,/reja <b>12%<\/b>/);
   const personal=rows.find(r=>r.unique_key.startsWith('event:payment:p1:manager')).payload;
   assert.match(personal.text,/Tabriklaymiz, Dilnoza/);assert.match(personal.text,/Rejagacha/);
  });
  await t.test('team vibes: Friday greeting, joke, 18:00 hot hour; Sunday is quiet; late tick catches up; switch off = silent',async()=>{
   const scheduler=require('../server/services/domworkBot/scheduler');
   const tick=async iso=>{const c=await pool.connect();try{await c.query('BEGIN');await scheduler.run(c,new Date(iso));await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}};
   const vibes=async()=>(await pool.query("SELECT unique_key,payload FROM domwork_bot_outbox WHERE unique_key LIKE 'vibe-%' ORDER BY unique_key")).rows;
   await pool.query("INSERT INTO domwork_bot_groups(id,type,scope,chat_id,active,created_by,title) VALUES('fam','family','','-100222222',true,'a','Family')");
   await pool.query(`UPDATE domwork_bot_settings SET data=data||'{"teamVibesEnabled":false}'::jsonb`);
   await tick('2026-10-30T13:00:00Z');assert.equal((await vibes()).length,0); // o'chiq
   await pool.query(`UPDATE domwork_bot_settings SET data=data||'{"teamVibesEnabled":true}'::jsonb`);
   // 09:20 da (oyna ichida, kechikib) ham Juma tabrigi yetib boradi; 13:30 va 13:31 — bitta latifa.
   for(const iso of ['2026-10-30T04:20:00Z','2026-10-30T04:21:00Z','2026-10-30T08:30:00Z','2026-10-30T08:31:00Z','2026-10-30T13:00:00Z','2026-11-01T13:00:00Z']) await tick(iso);
   const rows=await vibes();
   assert.deepEqual(rows.map(r=>r.unique_key.split(':')[0]),['vibe-evening','vibe-friday','vibe-joke']);
   assert.match(rows.find(r=>r.unique_key.startsWith('vibe-friday')).payload.text,/Juma/);
   assert.match(rows.find(r=>r.unique_key.startsWith('vibe-evening')).payload.text,/18:00|Kech|qaynoq|marafon|nafas|fokus/i);
  });
  await t.test('trial not confirmed in 15 minutes: teacher and beacon are nudged once, with buttons',async()=>{
   const scheduler=require('../server/services/domworkBot/scheduler');
   const now=new Date('2026-10-30T10:00:00Z');
   await pool.query("INSERT INTO hr_employees VALUES('h-t','Ezoza Sodiqova','ez@x','rus-oqituvchi','active','russian',false,'')");
   await pool.query("INSERT INTO domwork_bot_groups(id,type,scope,chat_id,active,created_by,title) VALUES('bc','beacon','','-100333333',true,'a','Mayoq')");
   await pool.query(`INSERT INTO leads(id,name,language,status,manager_id,extra_data) VALUES('LT','Ali Valiyev','russian','sinov-darsida','h-s',$1)`,
    [JSON.stringify({trialRequest:{id:'tr1',teacherId:'h-t',scheduledAt:'2026-10-30T20:00',daysCount:1,state:'pending',requestedAt:'2026-10-30T09:40:00Z'},paymentOnboarding:{teacherId:'h-t'},trialLessonAt:'2026-10-30T20:00'})]);
   const tick=async d=>{const c=await pool.connect();try{await c.query('BEGIN');await scheduler.run(c,d);await c.query('COMMIT');}finally{c.release();}};
   await tick(now);await tick(new Date(now.getTime()+60000));
   const rows=(await pool.query("SELECT unique_key,payload FROM domwork_bot_outbox WHERE unique_key LIKE 'trial-nudge:%'")).rows;
   const beacon=rows.filter(r=>r.unique_key.includes(':beacon'));assert.equal(beacon.length,1);
   assert.match(beacon[0].payload.text,/15 daqiqadan/);assert.ok(beacon[0].payload.reply_markup.inline_keyboard.length);
  });
  await t.test('daily sales report: voided receipts excluded, today transitions from audit, managers ranked',async()=>{
   const D=require('../server/services/domworkBot/dailyReports');
   await pool.query('ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(), ADD COLUMN IF NOT EXISTS lead_type TEXT, ADD COLUMN IF NOT EXISTS source TEXT');
   await pool.query(`CREATE TABLE IF NOT EXISTS lead_audit(id BIGSERIAL PRIMARY KEY,lead_id TEXT,actor_id TEXT,action TEXT,snapshot JSONB,created_at TIMESTAMPTZ DEFAULT NOW())`);
   await pool.query(`CREATE TABLE IF NOT EXISTS payment_record_voids(record_id TEXT PRIMARY KEY,void_date DATE NOT NULL,reason TEXT NOT NULL)`);
   await pool.query(`INSERT INTO payment_records(id,source_key,lead_id,language,manager_id,paid_date,amount,method,form,snapshot,actor_id)
     VALUES('pv','lead:LV:closing','LV','russian','h-s',(NOW() AT TIME ZONE 'Asia/Tashkent')::date,9000000,'card','full','{}','a')`);
   await pool.query(`INSERT INTO payment_record_voids(record_id,void_date,reason,actor_id,actor_name) VALUES('pv',(NOW() AT TIME ZONE 'Asia/Tashkent')::date,'xato','a','A')`);
   await pool.query(`INSERT INTO leads(id,name,language,status,manager_id,extra_data) VALUES('LA','A','russian','sinov-darsida','h-s','{}')`);
   await pool.query(`INSERT INTO lead_audit(lead_id,actor_id,snapshot) VALUES('LA','u-s','{"before":{"status":"boglanildi"},"after":{"status":"sinov-darsida","managerId":"h-s"}}'),
     ('LA','u-s','{"before":{"status":"sinov-darsida"},"after":{"status":"sinov-darsida","managerId":"h-s"}}')`);
   const date=new Date(Date.now()+5*3600000).toISOString().slice(0,10);
   const r=await D.salesDay(pool,date);
   assert.equal(r.day,1700000);assert.equal(r.payments,2);assert.equal(r.sales,1);
   assert.equal(r.leads.trial,1);assert.equal(r.plan,10000000);
   const text=D.salesText(r,{group:true});
   if(process.env.SHOW_TEXTS)console.log(text);
   assert.match(text,/Bugun: 1 700 000 so‘m/);assert.match(text,/reja <b>17%<\/b>/);assert.match(text,/🥇 <b>Dilnoza K\.<\/b>/);
   assert.doesNotMatch(text,/9 000 000/);
   assert.match(D.salesText(r),/Oy:/);
  });
  await t.test('targetolog report: today / 3 days / month lead quality with CRM rules',async()=>{
   const D=require('../server/services/domworkBot/dailyReports');
   const date=new Date(Date.now()+5*3600000).toISOString().slice(0,10);
   await pool.query("DELETE FROM leads");
   await pool.query(`INSERT INTO leads(id,name,language,status,manager_id,lead_type,extra_data,created_at) VALUES
    ('q1','A','russian','boglanildi','h-s','target','{"connectedSurvey":{"age":30}}',NOW()),
    ('q2','B','russian','boglanildi','h-s','target','{"connectedSurvey":{"age":17}}',NOW()),
    ('q3','C','russian','sifatsiz-lidlar','h-s','target','{}',NOW()),
    ('q4','D','russian','tolov-yopildi','h-s','target','{"connectedSurvey":{"age":18}}',NOW()),
    ('q5','E','russian','yangi-lidlar','h-s','organic','{}',NOW()),
    ('q6','F','russian','boglanildi','h-s','target','{}',NOW()-INTERVAL '2 days')`);
   await require('../server/services/targetAds').init(pool);
   await pool.query(`INSERT INTO target_ad_entries(language,kind,date,data,updated_by) VALUES('russian','day',$1,'{"budget":20,"leadCount":6}','a')`,[date]);
   const m=await D.marketingDay(pool,date);
   assert.deepEqual([m.today.total,m.today.quality,m.today.low,m.organic],[4,2,2,1]);
   assert.equal(m.three.total,5);assert.equal(m.month.sold>=1,true);
   const text=D.marketingText(m);if(process.env.SHOW_TEXTS)console.log(text);
   assert.match(text,/Bugun: 4 ta target lid/);assert.match(text,/Sifatli: <b>2<\/b> \(50%\)/);assert.match(text,/Oxirgi 3 kun/);assert.match(text,/Oy natijasi/);
  });
  await t.test('targetolog reminder: yesterday ad data missing → 15:00 marketing group nudge; entered → silent',async()=>{
   const scheduler=require('../server/services/domworkBot/scheduler');
   const tick=async d=>{const c=await pool.connect();try{await c.query('BEGIN');await scheduler.run(c,d);await c.query('COMMIT');}finally{c.release();}};
   await pool.query("INSERT INTO domwork_bot_groups(id,type,scope,chat_id,active,created_by,title) VALUES('mk','marketing','','-100444444',true,'a','Marketing') ON CONFLICT DO NOTHING");
   await pool.query(`UPDATE domwork_bot_settings SET data=data||'{"remindersEnabled":true}'::jsonb`);
   await tick(new Date('2026-11-03T10:00:00Z'));
   const row=(await pool.query("SELECT payload FROM domwork_bot_outbox WHERE unique_key LIKE 'ads-missing:2026-11-02:2:group%'")).rows[0];
   assert.match(row.payload.text,/2-noyabr/);
   await pool.query(`INSERT INTO target_ad_entries(language,kind,date,data,updated_by) VALUES('russian','day','2026-11-03','{"budget":5}','a')`);
   await tick(new Date('2026-11-04T10:00:00Z'));
   assert.equal((await pool.query("SELECT COUNT(*) FROM domwork_bot_outbox WHERE unique_key LIKE 'ads-missing:2026-11-03%'")).rows[0].count,'0');
  });
  await t.test('a later payment of the same customer is not announced as a new sale',()=>{
   const pay=group[1].payload;assert.match(pay.text,/To‘lov tushdi/);assert.doesNotMatch(pay.text,/YANGI SOTUV/);assert.match(pay.text,/Qolgan qarz/);
  });
 }finally{delete process.env.DOMWORK_BOT_ENABLED;await pool.end();}
});
