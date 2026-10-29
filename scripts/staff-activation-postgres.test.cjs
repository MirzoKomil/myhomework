const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const store=require('../server/services/domworkBot/store');
const link=require('../server/services/domworkBot/staffLink');
const act=require('../server/services/domworkBot/staffActivation');
const queue=require('../server/services/domworkBot/queue');
const groups=require('../server/services/domworkGroups');
const {createHandler}=require('../server/services/domworkBot/handlers');
const url=process.env.PAYROLL_TEST_DATABASE_URL;
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||!/^\/payroll_test_[a-z0-9]+$/.test(u.pathname))throw Error('Only disposable loopback DBs');}
test('bot relaunch: mandatory staff activation — synthetic data only',{skip:!url},async t=>{
 const pool=new Pool({connectionString:url});
 const teacher={id:'u-t',role:'teacher',jti:'jt'},sales={id:'u-s',role:'sales_manager',jti:'js'},english={id:'u-en',role:'teacher',jti:'je'},admin={id:'u-a',role:'admin',jti:'ja'};
 const run=()=>queue.processOne(pool,createHandler({crm:{}}));
 const out=async like=>(await pool.query('SELECT unique_key,payload,method FROM domwork_bot_outbox WHERE unique_key LIKE $1 ORDER BY created_at,unique_key',[like])).rows;
 const st=(actor,ready=true)=>act.status(pool,actor,ready);
 try{
  await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,phone TEXT,disabled_at TIMESTAMPTZ);
   CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN,phone TEXT);
   CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
   CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,extra_data JSONB,teacher_id TEXT);
   CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,language TEXT,status TEXT,deleted_at TIMESTAMPTZ);
   CREATE TABLE sessions(user_id TEXT,jti TEXT PRIMARY KEY);
   INSERT INTO users VALUES('u-t','Rus Ustoz','ustoz@x','teacher','+998901112233',NULL),('u-s','Sotuvchi','sot@x','sales_manager','+998901112236',NULL),
    ('u-en','Ingliz','en@x','teacher','+998901112234',NULL),('u-a','Bosh Admin','adm@x','admin','+998901112230',NULL);
   INSERT INTO hr_employees VALUES('h-t','Rus Ustoz','ustoz@x','rus-oqituvchi','active','russian',false,'+998901112233'),
    ('h-s','Sotuvchi','sot@x','sotuv-menejeri','active','russian',false,'+998901112236'),
    ('h-en','Ingliz','en@x','ingliz-oqituvchi','active','english',false,'+998901112234');
   INSERT INTO sessions VALUES('u-t','jt'),('u-s','js'),('u-en','je'),('u-a','ja');`);
  await groups.initSchema(pool);await store.initSchema(pool);
  // Ustoz avvaldan telefon raqami orqali ulangan (eski usul).
  await pool.query("INSERT INTO domwork_bot_links(telegram_id,account_kind,account_id,phone) VALUES('900','user','u-t','998901112233')");

  await t.test('nothing is required until an admin relaunches',async()=>{
   for(const a of [teacher,sales,admin])assert.equal((await st(a)).required,false);
  });
  await t.test('only an admin relaunches; linked staff get a role welcome, the new menu and a ✅ Tayyorman button',async()=>{
   await assert.rejects(act.relaunch(pool,teacher),e=>e.status===403);
   const r=await act.relaunch(pool,admin);assert.equal(r.sent,1);assert.equal(r.campaign,1);
   const rows=await out('activate:1:u-t:%'),w=rows.find(r=>r.unique_key.endsWith(':w')),ok=rows.find(r=>r.unique_key.endsWith(':ok'));assert.equal(rows.length,2);
   assert.match(w.payload.text,/Rus Ustoz/);assert.match(w.payload.text,/Maoshim/);assert.ok(w.payload.reply_markup.keyboard.length>1);
   assert.equal(ok.payload.reply_markup.inline_keyboard[0][0].callback_data,'a:ok');
  });
  await t.test('the CRM window shows only for eligible staff and never when the bot is down',async()=>{
   assert.deepEqual(await st(teacher),{required:true,linked:true,acknowledged:false,admin:false,name:'Rus Ustoz'});
   assert.equal((await st(sales)).linked,false);assert.equal((await st(sales)).required,true);
   assert.equal((await st(english)).required,false);
   assert.equal((await st(teacher,false)).required,false);
   assert.equal((await st(admin)).admin,true);
   await assert.rejects(st({id:'u-t',role:'teacher',jti:'old'}),e=>e.status===401);
  });
  await t.test('/start re-offers the button; ✅ Tayyorman closes the window',async()=>{
   await queue.receive(pool,{update_id:700,message:{message_id:1,from:{id:900,first_name:'U'},chat:{id:900,type:'private'},text:'/start'}});await run();
   assert.equal((await out('u:700:activate')).length,1);
   // Begona (ulanmagan) Telegram tugmani bossa — hech narsa tasdiqlanmaydi.
   await queue.receive(pool,{update_id:701,callback_query:{id:'c0',from:{id:999},data:'a:ok',message:{message_id:5,chat:{id:999,type:'private'}}}});await run();
   assert.equal((await st(teacher)).required,true);
   await queue.receive(pool,{update_id:702,callback_query:{id:'c1',from:{id:900},data:'a:ok',message:{message_id:5,chat:{id:900,type:'private'}}}});await run();
   assert.equal((await st(teacher)).required,false);
   assert.equal((await out('activate:1:u-t:done')).length,1);
   assert.equal((await out('u:702:a-edit'))[0].method,'editMessageReplyMarkup');
  });
  await t.test('an unlinked staff member links in the window (Start + confirm) and is done',async()=>{
   const req=await link.create(pool,sales);
   const raw=new URL(req.url).searchParams.get('start');
   await queue.receive(pool,{update_id:710,message:{message_id:2,from:{id:920,first_name:'Sot'},chat:{id:920,type:'private'},text:'/start '+raw}});await run();
   await link.confirm(pool,sales,{requestId:req.request.id,telegramId:'920'});
   assert.equal((await st(sales)).required,false);assert.equal((await st(sales)).acknowledged,true);
  });
  await t.test('a broken old link counts as unlinked and is replaced on a new link request',async()=>{
   await pool.query("UPDATE users SET phone='+998905555555' WHERE id='u-t'");await pool.query("UPDATE hr_employees SET phone='+998905555555' WHERE id='h-t'");
   await act.relaunch(pool,admin);
   assert.equal((await st(teacher)).linked,false);assert.equal((await link.status(pool,teacher)).linked,false);
   assert.equal((await out('activate:2:u-t:%')).length,0);
   await link.create(pool,teacher);
   assert.equal((await pool.query("SELECT COUNT(*) FROM domwork_bot_links WHERE account_id='u-t'")).rows[0].count,'0');
  });
  await t.test('resend is self-only, rate limited; admin report and stop',async()=>{
   await assert.rejects(act.resend(pool,teacher),e=>e.status===409); // ulanmagan
   // Qayta ishga tushirishda sotuvchiga xabar hozirgina ketgan — darhol qayta yuborish cheklanadi.
   await assert.rejects(act.resend(pool,sales),e=>e.status===429);
   await pool.query("UPDATE domwork_staff_activation SET sent_at=NOW()-INTERVAL '1 minute'");
   await pool.query("UPDATE domwork_bot_links SET paused=true WHERE telegram_id='920'");
   await act.resend(pool,sales);
   assert.equal((await pool.query("SELECT paused FROM domwork_bot_links WHERE telegram_id='920'")).rows[0].paused,false);
   await assert.rejects(act.resend(pool,sales),e=>e.status===429);
   const rep=await act.report(pool);
   assert.equal(rep.required,true);assert.deepEqual(rep.people.map(p=>p.id).sort(),['u-a','u-s','u-t']);
   await assert.rejects(act.stop(pool,sales),e=>e.status===403);
   await act.stop(pool,admin);
   assert.equal((await st(teacher)).required,false);
  });
 }finally{await pool.end();}
});
