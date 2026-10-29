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
  await t.test('a later payment of the same customer is not announced as a new sale',()=>{
   const pay=group[1].payload;assert.match(pay.text,/To‘lov tushdi/);assert.doesNotMatch(pay.text,/YANGI SOTUV/);assert.match(pay.text,/Qolgan qarz/);
  });
 }finally{delete process.env.DOMWORK_BOT_ENABLED;await pool.end();}
});
