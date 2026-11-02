const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const express=require('express');
const store=require('../server/services/domworkBot/store');
const queue=require('../server/services/domworkBot/queue');
const groups=require('../server/services/domworkGroups');
const miniapp=require('../server/services/domworkBot/miniapp');
const {createHandler}=require('../server/services/domworkBot/handlers');
const {sign,TOKEN}=require('./domwork-miniapp.test.cjs');
const url=process.env.PAYROLL_TEST_DATABASE_URL;
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||!/^\/payroll_test_[a-z0-9]+$/.test(u.pathname))throw Error('Only disposable loopback DBs');}
test('1-dars mini app: open, steps scored once, voice, request → CRM — synthetic data, no Telegram calls',{skip:!url},async t=>{
 const pool=new Pool({connectionString:url});
 const initData=id=>sign({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Dilshod',last_name:'K'}),start_param:'tg_target1'});
 let heard='меня зовут дилшод мне 32 года я работаю в банке';
 const app=express();app.use(express.json());
 app.use('/api/miniapp',require('../server/routes/miniapp')({pool,token:TOKEN,transcribe:async()=>heard===null?null:{text:heard},
  authRequired:(req,res,next)=>{req.user=JSON.parse(req.get('X-Test-User')||'null');req.user?next():res.status(401).end();},
  getSalesManagerIdForUser:async id=>id==='u-sardor'?'m-sardor':null}));
 const server=app.listen(0);const base=`http://127.0.0.1:${server.address().port}/api/miniapp`;
 const call=async(path,body,{id=801,headers={},raw}={})=>{
  const r=await fetch(base+path,{method:'POST',headers:{'X-Telegram-Init-Data':initData(id),...(raw?{}:{'Content-Type':'application/json'}),...headers},body:raw??JSON.stringify(body||{})});
  return {status:r.status,body:await r.json()};
 };
 const visitor=async id=>(await pool.query('SELECT * FROM domwork_bot_visitors WHERE telegram_id=$1',[String(id)])).rows[0];
 const outbox=async()=>(await pool.query("SELECT target_id,payload FROM domwork_bot_outbox WHERE method='sendMessage' ORDER BY created_at,unique_key")).rows;
 try{
  await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,phone TEXT,disabled_at TIMESTAMPTZ);
   CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN,phone TEXT);
   CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
   CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,extra_data JSONB,teacher_id TEXT);
   CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT DEFAULT '',phone2 TEXT DEFAULT '',email TEXT DEFAULT '',manager_id TEXT DEFAULT '',
    source TEXT,language TEXT NOT NULL,date TEXT,external_id TEXT,status TEXT,lead_type TEXT,comments TEXT DEFAULT '[]',attachments TEXT DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW(),deleted_at TIMESTAMPTZ,extra_data JSONB DEFAULT '{}');
   CREATE TABLE lead_audit(id BIGSERIAL PRIMARY KEY,lead_id TEXT,action TEXT,actor_id TEXT,actor_name TEXT,snapshot JSONB,created_at TIMESTAMPTZ DEFAULT NOW());
   CREATE TABLE sessions(user_id TEXT,jti TEXT PRIMARY KEY);
   INSERT INTO users VALUES('admin','Admin','admin@x','admin','+998901111111',NULL);
   INSERT INTO hr_employees(id,name,role,status) VALUES('m-sardor','Sardor Aliyev','sales_manager','active');`);
  await groups.initSchema(pool);await store.initSchema(pool);
  await pool.query("INSERT INTO domwork_bot_groups(id,type,scope,chat_id,active,created_by) VALUES('g-sales','sales','','-1001234567890',true,'admin')");
  await pool.query(`UPDATE domwork_bot_settings SET data=data||'{"funnelEnabled":true,"salesHours":"00:00-23:59","salesSlaMinutes":10}'::jsonb WHERE singleton=1`);

  await t.test('unsigned / forged requests are rejected before touching the DB',async()=>{
   const r=await fetch(base+'/open',{method:'POST'});assert.equal(r.status,401);
   const forged=await fetch(base+'/open',{method:'POST',headers:{'X-Telegram-Init-Data':initData(801).replace('Dilshod','X')}});assert.equal(forged.status,401);
   assert.equal((await pool.query('SELECT COUNT(*) FROM domwork_miniapp_progress')).rows[0].count,'0');
  });
  await t.test('first open creates visitor + progress and scores +2 once; reopen does not re-score',async()=>{
   const a=await call('/open');assert.equal(a.status,200);
   assert.equal(a.body.name,'Dilshod');assert.equal(a.body.points,2);assert.equal(a.body.manager,null);
   assert.deepEqual(a.body.videos.map(v=>v.url),['https://youtu.be/ee_5dITGHEc','https://youtu.be/6ypCbAyz2MU']);assert.equal(a.body.sales.slaMinutes,10);
   assert.equal((await visitor(801)).source,'miniapp:tg_target1');
   await call('/open');
   assert.equal((await visitor(801)).score,2);
   assert.equal((await pool.query("SELECT opens FROM domwork_miniapp_progress WHERE telegram_id='801'")).rows[0].opens,2);
  });
  await t.test('video counts only at ≥80%, homework/game once; unknown events refused',async()=>{
   let r=await call('/event',{type:'video',data:{percent:40}});assert.equal(r.body.steps.video,false);
   r=await call('/event',{type:'video',data:{percent:85}});assert.equal(r.body.steps.video,true);
   await call('/event',{type:'video',data:{percent:100}});
   r=await call('/event',{type:'homework',data:{done:true,correct:4,total:5,age:32,work:'bank <script>',name:'Dilshod'}});
   assert.equal(r.body.answers.homework.work,'bank  script');
   await call('/event',{type:'homework',data:{done:true,correct:5,total:5}});
   r=await call('/event',{type:'game',data:{done:true,score:9,time:41,won:true}});
   assert.equal(r.body.points,2+3+2+2);assert.equal((await visitor(801)).score,9);
   assert.equal((await call('/event',{type:'drop_table',data:{}})).status,400);
   assert.equal((await call('/event',{type:'game',data:[]})).status,400);
  });
  await t.test('mini app leads are not "hot" at 6 — threshold is 15 (opening + video + homework is only warm)',async()=>{
   assert.equal((await outbox()).filter(r=>/Issiq lid/.test(r.payload.text||'')).length,0);
  });
  await t.test('voice: wrong type / too big refused; low match asks retry and gives no points; good match finishes lesson',async()=>{
   const q='?expected='+encodeURIComponent('Меня́ зову́т Дилшо́д. Мне 32 го́да. Я рабо́таю в ба́нке.')+'&skip=Дилшод';
   assert.equal((await call('/voice'+q,null,{raw:Buffer.from('x'),headers:{'Content-Type':'text/plain'}})).status,415);
   assert.equal((await call('/voice'+q,null,{raw:Buffer.alloc(1024*1024+10),headers:{'Content-Type':'audio/ogg'}})).status,413);
   heard='привет';
   let r=await call('/voice'+q,null,{raw:Buffer.from('OggS-fake'),headers:{'Content-Type':'audio/ogg'}});
   assert.equal(r.body.level,'retry');assert.equal(r.body.state.steps.voice,false);
   heard='меня зовут дилшод мне 32 года я работаю в банк';
   r=await call('/voice'+q,null,{raw:Buffer.from('OggS-fake2'),headers:{'Content-Type':'audio/ogg; codecs=opus'}});
   assert.equal(r.body.level,'ok');assert.ok(r.body.score>=90);assert.equal(r.body.state.finished,true);assert.equal(r.body.state.points,12);
   assert.equal((await visitor(801)).score,12);
  });
  await t.test('STT unavailable → step still done as "unscored" (lead is not blamed)',async()=>{
   await call('/open',{}, {id:802});heard=null;
   const r=await call('/voice?expected=x',null,{id:802,raw:Buffer.from('OggS'),headers:{'Content-Type':'audio/webm'}});
   assert.equal(r.body.level,'unscored');assert.equal(r.body.state.steps.voice,true);
  });
  await t.test('call request without phone → needPhone + bot asks contact; with phone → CRM lead, comment, sales alert, +5 once',async()=>{
   let r=await call('/request',{method:'call',when:'now'});
   assert.equal(r.body.needPhone,true);
   assert.ok((await outbox()).some(m=>m.target_id==='801'&&m.payload.reply_markup?.keyboard?.[0]?.[0]?.request_contact));
   assert.equal((await visitor(801)).awaiting,'miniapp');
   assert.equal((await call('/request',{method:'fax',when:'now'})).status,400);
   await pool.query("UPDATE domwork_bot_visitors SET phone='998907770011',awaiting='' WHERE telegram_id='801'");
   r=await call('/request',{method:'call',when:'now'});
   assert.equal(r.body.needPhone,false);assert.equal(r.body.state.requested,true);assert.equal(r.body.state.points,17);
   await call('/request',{method:'call',when:'now'});
   const v=await visitor(801);assert.equal(v.score,17);assert.ok(v.lead_id);
   const lead=(await pool.query('SELECT * FROM leads WHERE id=$1',[v.lead_id])).rows[0];
   assert.match(lead.comments,/bog‘lanishni so‘radi/);
   // Dars lid paydo bo'lishidan oldin tugagan — xulosa so'rov paytida bir marta yoziladi.
   assert.equal((lead.comments.match(/1-darsni to‘liq o‘tdi/g)||[]).length,1);
   assert.equal(r.body.state.phoneMasked,'+99890 *** ** 11');
   const req=(await outbox()).filter(m=>/Botdan so‘rov/.test(m.payload.text||''));assert.equal(req.length,1);
   // Menejer qo'ng'iroqdan oldin mini ilova natijasi va va'da vaqtini ko'radi.
   assert.match(req[0].payload.text,/🎓 Namuna dars \(tugatdi\): video 100% · vazifa 5\/5 · o‘yin ✓ · ovoz \d+% aniq/);
   assert.match(req[0].payload.text,/⏱ Lidga «~10 daqiqa ichida» deb va'da qilindi — \d\d:\d\d gacha/);
   // Va'da vaqti o'tdi — bitta eslatma; natija belgilansa — yo'q.
   const later=new Date(Date.now()+11*60000);
   assert.equal(await queue.transaction(pool,db=>miniapp.salesSla(db,new Date(Date.now()+3*60000))),0);
   assert.equal(await queue.transaction(pool,db=>miniapp.salesSla(db,later)),1);
   assert.equal(await queue.transaction(pool,db=>miniapp.salesSla(db,later)),0);
   const sla=(await outbox()).filter(m=>/Va'da vaqti o‘tdi/.test(m.payload.text||''));
   assert.equal(sla.length,1);assert.ok(sla[0].payload.reply_markup.inline_keyboard.length>0);
  });
  await t.test('resources: gift PDF goes to the bot once a day; unknown material is not sent',async()=>{
   await pool.query(`UPDATE domwork_bot_settings SET data=data||'{"funnelMedia":{"sovga":{"method":"sendDocument","fileId":"GIFT_FILE_ID_123"}}}'::jsonb WHERE singleton=1`);
   let r=await call('/event',{type:'resource',data:{id:'sovga',send:true}});assert.equal(r.body.sent,true);
   await call('/event',{type:'resource',data:{id:'sovga',send:true}});
   assert.equal((await pool.query("SELECT COUNT(*) FROM domwork_bot_outbox WHERE target_id='801' AND payload->>'document'='GIFT_FILE_ID_123'")).rows[0].count,'1');
   r=await call('/event',{type:'resource',data:{id:'../etc',send:true}});assert.equal(r.body.sent,undefined);
  });
  await t.test('finished summary lands in CRM when lead exists; assigned manager shows on screen',async()=>{
   // 803: avval lid (telefon) bor, keyin darsni tugatadi.
   await call('/open',{}, {id:803});
   await pool.query("UPDATE domwork_bot_visitors SET phone='998901112233' WHERE telegram_id='803'");
   heard='меня зовут мне 32 года я работаю в банке';
   await call('/request',{method:'telegram',when:'eve'},{id:803});
   const v=await visitor(803);
   await pool.query("UPDATE leads SET manager_id='m-sardor' WHERE id=$1",[v.lead_id]);
   for(const e of [{type:'video',data:{percent:90}},{type:'homework',data:{done:true,correct:5,total:5,work:'bank',age:32}},{type:'game',data:{done:true,score:7}}])await call('/event',e,{id:803});
   const r=await call('/voice?expected='+encodeURIComponent('Меня зовут Дилшод. Мне 32 года. Я работаю в банке.')+'&skip=Дилшод',null,{id:803,raw:Buffer.from('OggS3'),headers:{'Content-Type':'audio/ogg'}});
   assert.equal(r.body.state.manager.name,'Sardor');assert.equal(r.body.state.finished,true);
   const lead=(await pool.query('SELECT comments,extra_data FROM leads WHERE id=$1',[v.lead_id])).rows[0];
   assert.match(lead.comments,/1-darsni to‘liq o‘tdi.*Video 90%.*vazifa 5\/5.*ovoz 100%/);
   assert.equal(lead.extra_data.miniapp.homework.work,'bank');
   // Ovozni faqat biriktirilgan menejer yoki rahbar tinglaydi.
   const vid=r.body.id,get=u=>fetch(base+'/voice/'+vid,{headers:{'X-Test-User':JSON.stringify(u)}});
   assert.equal((await get({id:'u-sardor',role:'sales_manager'})).status,200);
   assert.equal((await get({id:'u-other',role:'sales_manager'})).status,403);
   const boss=await get({id:'r',role:'rop'});assert.equal(boss.status,200);assert.equal(Buffer.from(await boss.arrayBuffer()).toString(),'OggS3');
  });
  await t.test('bot: new visitor gets «1-darsni ochish» web_app button; old «ko‘rish» button also opens the app',async()=>{
   const handler=createHandler({crm:{}});let uid=5000;
   const from=id=>({id,first_name:'Mehmon'});
   const run=async update=>{await queue.receive(pool,update);while(await queue.processOne(pool,handler));};
   await run({update_id:++uid,message:{message_id:uid,from:from(811),chat:{id:811,type:'private'},text:'/start'}});
   const rows=(await pool.query("SELECT payload FROM domwork_bot_outbox WHERE target_id='811' AND method<>'answerCallbackQuery' ORDER BY created_at,unique_key")).rows;
   const btn=rows.flatMap(r=>r.payload.reply_markup?.inline_keyboard||[]).flat().find(b=>b.web_app);
   assert.ok(btn,'web_app tugmasi yo‘q');assert.equal(btn.web_app.url,'https://myhomework.uz/miniapp/');assert.match(btn.text,/Namuna darsni ochish/);
   assert.ok(rows.some(r=>/namuna dars siz uchun ochildi/.test(r.payload.caption||r.payload.text||'')));
   await run({update_id:++uid,callback_query:{id:'cq'+uid,from:from(811),data:'f:les',message:{chat:{id:811,type:'private'}}}});
   const last=(await pool.query("SELECT payload FROM domwork_bot_outbox WHERE target_id='811' AND method='sendMessage' ORDER BY created_at DESC,unique_key DESC LIMIT 1")).rows[0];
   assert.equal(last.payload.reply_markup.inline_keyboard[0][0].web_app.url,'https://myhomework.uz/miniapp/');
   // O'chirilsa — eski video oqimi (raqam so'raladi).
   await pool.query(`UPDATE domwork_bot_settings SET data=data||'{"miniappEnabled":false,"funnelMedia":{"sovga":{"method":"sendDocument","fileId":"GIFT_FILE_ID_123"},"dars1":{"method":"sendVideo","fileId":"LESSON1_FILE_ID"}}}'::jsonb WHERE singleton=1`);
   await run({update_id:++uid,callback_query:{id:'cq'+uid,from:from(811),data:'f:les',message:{chat:{id:811,type:'private'}}}});
   const old=(await pool.query("SELECT payload FROM domwork_bot_outbox WHERE target_id='811' AND method='sendMessage' ORDER BY created_at DESC,unique_key DESC LIMIT 1")).rows[0];
   assert.equal(old.payload.reply_markup.keyboard[0][0].request_contact,true);
   await pool.query(`UPDATE domwork_bot_settings SET data=data||'{"miniappEnabled":true}'::jsonb WHERE singleton=1`);
  });
  await t.test('return nudge: half-done lesson after 2h, once, 10:00–20:00 Tashkent; not for holdout / requested / finished',async()=>{
   await call('/open',{}, {id:812});await call('/event',{type:'video',data:{percent:90}},{id:812});
   await call('/open',{}, {id:813});await pool.query("UPDATE domwork_bot_visitors SET holdout=(telegram_id='813')"); // nazorat guruhi tasodifiy (10%) — testda aniq
   await pool.query("UPDATE domwork_miniapp_progress SET last_seen_at=NOW()-INTERVAL '3 hours'");
   const t15=new Date(Date.now()-Date.now()%86400000+86400000+10*3600000); // ertaga 15:00 Toshkent
   assert.equal(await queue.transaction(pool,db=>miniapp.nudge(db,new Date(t15.getTime()+7*3600000))),0); // 22:00 — jim
   assert.ok(await queue.transaction(pool,db=>miniapp.nudge(db,t15))>=1);
   const sent=(await pool.query("SELECT target_id,payload FROM domwork_bot_outbox WHERE unique_key LIKE 'ma:%:nudge'")).rows;
   const ids=sent.map(r=>r.target_id);
   assert.ok(ids.includes('812'));for(const no of ['813','801','803'])assert.ok(!ids.includes(no),no); // nazorat guruhi, tugatgan, so'rov qoldirgan
   const m=sent.find(r=>r.target_id==='812').payload;
   assert.match(m.text,/yarmidasiz — <b>3 qadam qoldi/);
   assert.equal(m.reply_markup.inline_keyboard[0][0].web_app.url,'https://myhomework.uz/miniapp/?next=1');
   await queue.transaction(pool,db=>miniapp.nudge(db,t15));
   assert.equal((await pool.query("SELECT COUNT(*) FROM domwork_bot_outbox WHERE unique_key LIKE 'ma:%:nudge'")).rows[0].count,String(ids.length));
  });
 }finally{server.close();await pool.end();}
});
