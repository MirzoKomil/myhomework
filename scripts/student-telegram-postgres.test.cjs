const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const express=require('express');
const store=require('../server/services/domworkBot/store');
const link=require('../server/services/domworkBot/studentLink');
const queue=require('../server/services/domworkBot/queue');
const groups=require('../server/services/domworkGroups');
const {createHandler}=require('../server/services/domworkBot/handlers');
const router=require('../server/routes/studentTelegram');
const url=process.env.PAYROLL_TEST_DATABASE_URL;
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||!/^\/payroll_test_[a-z0-9]+$/.test(u.pathname))throw Error('Only disposable loopback DBs');}
test('student Telegram linking — no real CRM or Telegram calls',{skip:!url},async t=>{
 const pool=new Pool({connectionString:url}),actor={id:'s',role:'student',jti:'session-s'},other={id:'s2',role:'student',jti:'session-s2'};
 const message=(id,text)=>({from:{id,first_name:'Different phone',username:'fixture'},chat:{id,type:'private'},text});
 const start=r=>new URL(r.url).searchParams.get('start');
 const claim=(r,id=800)=>queue.transaction(pool,db=>link.claim(db,message(id,'/start '+start(r))));
 const snapshot=async()=>Object.fromEntries(await Promise.all(['students','users','hr_employees','leads','domwork_learning_groups','domwork_bot_groups','domwork_bot_settings'].map(async table=>[table,(await pool.query('SELECT * FROM '+table+' ORDER BY 1')).rows])));
 let server,request,original;
 try{
  await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,phone TEXT);
   CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN,phone TEXT);
   CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
   CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,extra_data JSONB,teacher_id TEXT);
   CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,language TEXT,status TEXT,deleted_at TIMESTAMPTZ);
   CREATE TABLE sessions(user_id TEXT,jti TEXT PRIMARY KEY);
   INSERT INTO students VALUES('s','Paid RU','+998903333333','russian','{"passwordHash":"hash","paidAmount":100,"results":[99]}','teacher'),
    ('s2','Second','+998903333334','russian','{"passwordHash":"hash","paidAmount":200}','teacher'),
    ('en','English','+998903333335','english','{"passwordHash":"hash","paidAmount":200}','teacher'),
    ('demo','Demo','+998903333336','russian','{"passwordHash":"hash","paidAmount":200,"isStaffDemo":true}','teacher'),
    ('unpaid','Unpaid','+998903333337','russian','{"passwordHash":"hash","paidAmount":0}','teacher');
   INSERT INTO users VALUES('admin','Admin','admin','admin','+998901111111');
   INSERT INTO sessions VALUES('s','session-s'),('s2','session-s2'),('en','session-en'),('demo','session-demo'),('unpaid','session-unpaid');`);
  await groups.initSchema(pool);await store.initSchema(pool);original=await snapshot();
  await t.test('additive schema repeats and only real active paid Russian students with own session qualify',async()=>{
   await store.initSchema(pool);assert.deepEqual(await snapshot(),original);
   for(const bad of [{id:'admin',role:'admin',jti:'session-s'},{id:'s',role:'student'},{id:'s',role:'student',jti:'session-s2'},
    ...['en','demo','unpaid','missing'].map(id=>({id,role:'student',jti:'session-'+id}))])await assert.rejects(link.create(pool,bad),e=>[401,403].includes(e.status));
   assert.equal((await pool.query('SELECT COUNT(*) FROM domwork_student_telegram_requests')).rows[0].count,'0');
  });
  await t.test('creates 256-bit short-lived credential, never returns JWT/phone or writes raw token',async()=>{
   request=await link.create(pool,actor);assert.match(start(request),/^sl_[A-Za-z0-9_-]{43}$/);assert.ok(start(request).length<64);
   const row=(await pool.query('SELECT * FROM domwork_student_telegram_requests WHERE id=$1',[request.request.id])).rows[0];
   assert.match(row.token_hash,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(row).includes(start(request).slice(3)));
   assert.ok(new Date(row.expires_at)-new Date(row.created_at)<=900001);assert.equal(await store.identity(pool,'800'),null);
   await assert.rejects(link.create(pool,actor),e=>e.status===429);
   assert.ok(!JSON.stringify(await link.status(pool,actor)).includes('token_hash'));
  });
  await t.test('audit failure rolls back the whole Start: no identity, proof, outbox or discovery',async()=>{
   await pool.query(`CREATE FUNCTION fail_link_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.action='student-telegram-confirmed' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fail_link_audit BEFORE INSERT ON domwork_bot_audit FOR EACH ROW EXECUTE FUNCTION fail_link_audit();`);
   await assert.rejects(claim(request));
   assert.equal(await store.identity(pool,'800'),null);assert.equal((await link.status(pool,actor)).request.state,'pending');
   assert.equal((await pool.query('SELECT COUNT(*) FROM domwork_student_telegram_proofs')).rows[0].count,'0');
   await pool.query('DROP TRIGGER fail_link_audit ON domwork_bot_audit');
  });
  await t.test('a Telegram already bound to another CRM account is never taken over',async()=>{
   await pool.query("INSERT INTO domwork_bot_links(telegram_id,account_kind,account_id,phone) VALUES('800','user','admin','998901111111')");
   await assert.rejects(claim(request),e=>e.status===409);
   assert.equal((await pool.query("SELECT account_kind FROM domwork_bot_links WHERE telegram_id='800'")).rows[0].account_kind,'user');
   await pool.query("DELETE FROM domwork_bot_links WHERE telegram_id='800'"); // Only synthetic fixture cleanup.
  });
  await t.test('Start links in one step (different phone), redacts the inbox and sends the menu; the link is single-use',async()=>{
   const update={update_id:100,message:message(800,'/start '+start(request))};
   await queue.receive(pool,update);
   const saved=(await pool.query('SELECT payload FROM domwork_bot_updates WHERE update_id=100')).rows[0].payload;
   assert.ok(!JSON.stringify(saved).includes(start(request)));assert.equal(saved.message.text,'/start student-link');
   assert.equal(saved.message._studentLinkHash,link.startHash(update.message.text));
   assert.equal(link.startHash('/start slh_'+saved.message._studentLinkHash),null);
   assert.equal(link.redact({message:{text:'/start slh_'+saved.message._studentLinkHash,_studentLinkHash:saved.message._studentLinkHash}}).message._studentLinkHash,undefined);
   await queue.processOne(pool,createHandler({crm:{}}));
   const identity=await store.identity(pool,'800');assert.equal(identity.id,'s');assert.equal(identity.role,'student');
   assert.ok((await link.status(pool,actor)).linked);
   assert.equal((await pool.query("SELECT state FROM domwork_student_group_discovery WHERE student_id='s'")).rows[0].state,'pending');
   const out=(await pool.query('SELECT payload FROM domwork_bot_outbox WHERE unique_key=$1',['student-link:'+request.request.id])).rows[0].payload;
   assert.ok(out.reply_markup.keyboard.flat().some(x=>x.text.includes('Mening to‘lovim')));assert.equal(out._account.id,'s');assert.equal(out.parse_mode,'HTML');
   const linkBefore=(await pool.query("SELECT * FROM domwork_bot_links WHERE telegram_id='800'")).rows[0];
   const same=await queue.transaction(pool,db=>store.linkContact(db,{...message(800,''),contact:{user_id:800,phone_number:'+79991112233'}}));assert.equal(same.id,'s');
   assert.deepEqual((await pool.query("SELECT * FROM domwork_bot_links WHERE telegram_id='800'")).rows[0],linkBefore);
   await assert.rejects(claim(request,801),e=>e.status===410);await assert.rejects(link.create(pool,actor),e=>e.status===409);
   await assert.rejects(queue.transaction(pool,db=>link.claim(db,{...update.message,forward_origin:{}})),e=>e.status===400);
   await assert.rejects(queue.transaction(pool,db=>link.claim(db,{...update.message,chat:{id:-1001,type:'supergroup'}})),e=>e.status===400);
   assert.deepEqual(await snapshot(),original);
  });
  await t.test('verified platform identity survives CRM phone changes but still rejects frozen, demo and English students',async()=>{
   await pool.query("UPDATE students SET phone='+998990000000' WHERE id='s'");assert.equal((await store.identity(pool,'800')).id,'s');
   await pool.query("UPDATE students SET extra_data=extra_data||'{\"frozen\":true}' WHERE id='s'");assert.equal(await store.identity(pool,'800'),null);
   await pool.query("UPDATE students SET phone='+998903333333',extra_data=extra_data-'frozen' WHERE id='s'");
   await pool.query("UPDATE students SET subject='english' WHERE id='s'");assert.equal(await store.identity(pool,'800'),null);
   await pool.query("UPDATE students SET subject='russian',extra_data=extra_data||'{\"isStaffDemo\":true}' WHERE id='s'");assert.equal(await store.identity(pool,'800'),null);
   await pool.query("UPDATE students SET extra_data=extra_data-'isStaffDemo' WHERE id='s'");
   assert.deepEqual(await snapshot(),original);
  });
  await t.test('expired/cancelled/regenerated links and revoked originating session never bind',async()=>{
   const r=await link.create(pool,other);
   await pool.query("UPDATE domwork_student_telegram_requests SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",[r.request.id]);
   await assert.rejects(claim(r,802),e=>e.status===410);
   await pool.query("UPDATE domwork_student_telegram_requests SET created_at=NOW()-INTERVAL '20 seconds' WHERE student_id='s2'");
   const fresh=await link.create(pool,other);
   await link.cancel(pool,other,{requestId:fresh.request.id});await assert.rejects(claim(fresh,802),e=>e.status===410);
   await pool.query("UPDATE domwork_student_telegram_requests SET created_at=NOW()-INTERVAL '20 seconds' WHERE student_id='s2'");
   const last=await link.create(pool,other);await pool.query("DELETE FROM sessions WHERE jti='session-s2'");
   await assert.rejects(claim(last,802),e=>e.status===401);await assert.rejects(link.status(pool,other),e=>e.status===401);
   assert.equal(await store.identity(pool,'802'),null);
   await pool.query("INSERT INTO sessions VALUES('s2','session-s2')");
  });
  await t.test('race between competing students claiming the same Telegram preserves winner, loser remains unbound',async()=>{
   await pool.query("INSERT INTO students SELECT 's3','Third','+998903333338',subject,extra_data,teacher_id FROM students WHERE id='s2';INSERT INTO sessions VALUES('s3','session-s3')");
   await pool.query("UPDATE domwork_student_telegram_requests SET created_at=NOW()-INTERVAL '20 seconds' WHERE student_id='s2'");
   const a=await link.create(pool,other),third={id:'s3',role:'student',jti:'session-s3'},b=await link.create(pool,third);
   const results=await Promise.allSettled([claim(a,803),claim(b,803)]);
   assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.status===409).length,1);
   assert.equal((await pool.query("SELECT COUNT(*) FROM domwork_bot_links WHERE telegram_id='803'")).rows[0].count,'1');
   await pool.query("DELETE FROM domwork_bot_links WHERE account_id='s3'");await pool.query("DELETE FROM students WHERE id='s3'"); // Remove synthetic student to compare legacy snapshot.
  });
  await t.test('HTTP requires auth/own active student, ignores forged student IDs and returns no-store',async()=>{
   const app=express();app.use(express.json());app.use(router({pool,runtime:{status:()=>({state:'ready'})},authRequired:(req,res,next)=>{
    if(!req.get('authorization'))return res.sendStatus(401);req.user=req.get('authorization')==='admin'?{id:'admin',role:'admin',jti:'session-s'}:actor;next();
   }}));server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base='http://127.0.0.1:'+server.address().port;
   assert.equal((await fetch(base)).status,401);assert.equal((await fetch(base,{headers:{authorization:'admin'}})).status,403);
   const response=await fetch(base+'?studentId=s2',{headers:{authorization:'student'}});assert.equal(response.headers.get('cache-control'),'no-store');assert.ok((await response.json()).linked);
   assert.equal((await fetch(base+'/confirm',{method:'POST',headers:{authorization:'student','content-type':'application/json'},body:JSON.stringify({studentId:'s2',requestId:'forged',telegramId:'803'})})).status,409);
  });
  await t.test('student campaign: admin relaunch sends the new menu to linked students and makes the popup mandatory for the rest',async()=>{
   const SA=require('../server/services/domworkBot/studentActivation');
   const saved=(await pool.query('SELECT data,revision FROM domwork_bot_settings')).rows[0];
   assert.equal(await SA.mandatory(pool,false),false);
   await assert.rejects(SA.relaunch(pool,{id:'s'}),e=>e.status===403);
   const r=await SA.relaunch(pool,{id:'admin'});assert.ok(r.sent>=1);
   assert.equal(await SA.mandatory(pool,false),true);assert.equal(await SA.mandatory(pool,true),false);
   await assert.rejects(SA.relaunch(pool,{id:'admin'}),e=>e.status===429);
   const rep=await SA.report(pool);assert.ok(rep.linked>=1);assert.ok(rep.total>=2);
   await SA.stop(pool,{id:'admin'});assert.equal(await SA.mandatory(pool,false),false);
   await pool.query('UPDATE domwork_bot_settings SET data=$1,revision=$2',[saved.data,saved.revision]);
  });
  await t.test('admin diagnose explains why a student sees no popup',async()=>{
   const SA=require('../server/services/domworkBot/studentActivation');
   await assert.rejects(SA.diagnose(pool,{id:'s'},'Paid',true),e=>e.status===403);
   const a=(await SA.diagnose(pool,{id:'admin'},'Paid RU',true)).students[0];
   assert.equal(a.popup,false);assert.ok(a.reasons.some(r=>/ulangan/.test(r)));assert.ok(a.reasons.some(r=>/kampaniya/.test(r)));
   const u=(await SA.diagnose(pool,{id:'admin'},'903333337',true)).students[0];
   assert.equal(u.name,'Unpaid');assert.ok(u.reasons.some(r=>/paidAmount/.test(r)));
  });
  await t.test('existing CRM, groups, notification settings and historical student data unchanged',async()=>assert.deepEqual(await snapshot(),original));
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await pool.end();}
});
