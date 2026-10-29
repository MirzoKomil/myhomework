const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const store=require('../server/services/domworkBot/store');
const link=require('../server/services/domworkBot/staffLink');
const queue=require('../server/services/domworkBot/queue');
const groups=require('../server/services/domworkGroups');
const {createHandler}=require('../server/services/domworkBot/handlers');
const url=process.env.PAYROLL_TEST_DATABASE_URL;
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||!/^\/payroll_test_[a-z0-9]+$/.test(u.pathname))throw Error('Only disposable loopback DBs');}
test('staff Telegram linking without matching phone — synthetic data only',{skip:!url},async t=>{
 const pool=new Pool({connectionString:url});
 const teacher={id:'u-t',role:'teacher',jti:'jt'},english={id:'u-en',role:'teacher',jti:'je'},disabled={id:'u-off',role:'admin',jti:'jo'};
 const msg=(id,text)=>({from:{id,first_name:'Boshqa',last_name:'Raqam',username:'ustoz_tg'},chat:{id,type:'private'},text});
 const start=r=>new URL(r.url).searchParams.get('start');
 let req;
 try{
  await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,phone TEXT,disabled_at TIMESTAMPTZ);
   CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN,phone TEXT);
   CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
   CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,extra_data JSONB,teacher_id TEXT);
   CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,language TEXT,status TEXT,deleted_at TIMESTAMPTZ);
   CREATE TABLE sessions(user_id TEXT,jti TEXT PRIMARY KEY);
   INSERT INTO users VALUES('u-t','Rus Ustoz','ustoz@x','teacher','+998901112233',NULL),('u-en','Ingliz','en@x','teacher','+998901112234',NULL),
    ('u-off','Old Admin','old@x','admin','+998901112235',NOW());
   INSERT INTO hr_employees VALUES('h-t','Rus Ustoz','ustoz@x','rus-oqituvchi','active','russian',false,'+998901112233'),
    ('h-en','Ingliz','en@x','ingliz-oqituvchi','active','english',false,'+998901112234');
   INSERT INTO sessions VALUES('u-t','jt'),('u-en','je'),('u-off','jo');`);
  await groups.initSchema(pool);await store.initSchema(pool);
  await t.test('only a live session of an eligible Russian staff member may create a link',async()=>{
   for(const bad of [english,disabled,{id:'u-t',role:'teacher'},{id:'u-t',role:'teacher',jti:'je'},{id:'s',role:'student',jti:'jt'}])
    await assert.rejects(link.create(pool,bad),e=>[401,403].includes(e.status));
   req=await link.create(pool,teacher);
   assert.match(start(req),/^ul_[A-Za-z0-9_-]{43}$/);assert.ok(req.qr.size>20 && req.qr.path.startsWith('M'));
   const row=(await pool.query('SELECT token_hash FROM domwork_staff_telegram_requests')).rows[0];
   assert.ok(!JSON.stringify(row).includes(start(req).slice(3)));
  });
  await t.test('Start redacts the token and links in one step, although the Telegram phone differs; replaces only a lead link',async()=>{
   await pool.query("INSERT INTO domwork_bot_links(telegram_id,account_kind,account_id,phone) VALUES('900','lead','lead-x','998977777777')");
   await queue.receive(pool,{update_id:500,message:msg(900,'/start '+start(req))});
   const saved=(await pool.query('SELECT payload FROM domwork_bot_updates WHERE update_id=500')).rows[0].payload;
   assert.equal(saved.message.text,'/start staff-link');assert.ok(!JSON.stringify(saved).includes(start(req)));
   await queue.processOne(pool,createHandler({crm:{}}));
   const id=await store.identity(pool,'900');
   assert.equal(id.kind,'user');assert.equal(id.role,'teacher');assert.equal(id.employeeId,'h-t');
   assert.equal((await link.status(pool,teacher)).linked,true);
   const out=(await pool.query("SELECT payload FROM domwork_bot_outbox WHERE unique_key LIKE 'staff-link:%'")).rows;
   assert.equal(out.length,1);assert.match(out[0].payload.text,/ulandi/);assert.ok(out[0].payload.reply_markup.keyboard.length>0);
   // Bir martalik: havola boshqa Telegramda ishlamaydi.
   await assert.rejects(queue.transaction(pool,db=>link.claim(db,msg(901,'/start '+start(req)))),e=>e.status===410);
   // CRM raqami o'zgarsa ham tasdiqlangan ulanish uzilmaydi.
   await pool.query("UPDATE users SET phone='+998909999999' WHERE id='u-t'");await pool.query("UPDATE hr_employees SET phone='+998909999999' WHERE id='h-t'");
   assert.equal((await store.identity(pool,'900'))?.role,'teacher');
   await assert.rejects(link.create(pool,teacher),e=>e.status===409);
  });
  await t.test('another CRM account cannot take an occupied Telegram; unlink is self-only and audited',async()=>{
   await pool.query("UPDATE hr_employees SET lang='russian',role='rus-oqituvchi' WHERE id='h-en'");
   const r2=await link.create(pool,english);
   await assert.rejects(queue.transaction(pool,db=>link.claim(db,msg(900,'/start '+start(r2)))),e=>e.status===409);
   await link.unlink(pool,teacher);
   assert.equal(await store.identity(pool,'900'),null);
   assert.equal((await pool.query("SELECT COUNT(*) FROM domwork_bot_audit WHERE action='staff-telegram-unlinked'")).rows[0].count,'1');
   assert.equal((await pool.query("SELECT COUNT(*) FROM domwork_bot_links WHERE account_id='u-en'")).rows[0].count,'0');
  });
  await t.test('a phone-matched link without proof still requires the phone to keep matching',async()=>{
   await pool.query("INSERT INTO domwork_bot_links(telegram_id,account_kind,account_id,phone) VALUES('910','user','u-en','998901112234')");
   assert.equal((await store.identity(pool,'910'))?.role,'teacher');
   await pool.query("UPDATE users SET phone='+998905555555' WHERE id='u-en'");await pool.query("UPDATE hr_employees SET phone='+998905555555' WHERE id='h-en'");
   assert.equal(await store.identity(pool,'910'),null);
  });
  await t.test('a claim left unconfirmed by the old flow is finished by any next message — the phone is never asked',async()=>{
   await pool.query("DELETE FROM domwork_bot_links WHERE account_id='u-t'");await pool.query("DELETE FROM domwork_staff_telegram_proofs WHERE user_id='u-t'");
   await pool.query(`INSERT INTO domwork_staff_telegram_requests(id,user_id,session_jti,token_hash,state,telegram_id,expires_at,claimed_at)
    VALUES('old-claim','u-t','jt','${'b'.repeat(64)}','claimed','930',NOW()+INTERVAL '5 minutes',NOW())`);
   await queue.receive(pool,{update_id:600,message:{...msg(930,'/START'),message_id:11,contact:{user_id:930,phone_number:'+998920000000',first_name:'B'}}});
   await queue.processOne(pool,createHandler({crm:{}}));
   assert.equal((await store.identity(pool,'930'))?.role,'teacher');
   assert.equal((await pool.query("SELECT COUNT(*) FROM domwork_bot_outbox WHERE unique_key='u:600:r:0'")).rows[0].count,'0');
  });
 }finally{await pool.end();}
});
