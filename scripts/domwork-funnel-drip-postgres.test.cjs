const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const store=require('../server/services/domworkBot/store');
const queue=require('../server/services/domworkBot/queue');
const funnel=require('../server/services/domworkBot/funnel');
const groups=require('../server/services/domworkGroups');
const {createHandler}=require('../server/services/domworkBot/handlers');
const url=process.env.PAYROLL_TEST_DATABASE_URL;
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||!/^\/payroll_test_[a-z0-9]+$/.test(u.pathname))throw Error('Only disposable loopback DBs');}
// 2026-11-10 19:40 Toshkent = 14:40 UTC (O'zbekiston oynasi); 20:40 Toshkent = 15:40 UTC (migrant oynasi).
const AT=new Date('2026-11-10T14:40:00Z'), AT_A=new Date('2026-11-10T15:40:00Z');
test('isitish, menejer tugmalari, relay va kanal bonusi — synthetic data, no Telegram calls',{skip:!url},async t=>{
 const pool=new Pool({connectionString:url}),handler=createHandler({crm:{}});
 let uid=5000;
 const from=id=>({id,first_name:'Mehmon',username:'m'+id});
 const run=async update=>{await queue.receive(pool,update);while(await queue.processOne(pool,handler));};
 const out=async id=>(await pool.query("SELECT method,payload,unique_key FROM domwork_bot_outbox WHERE target_id=$1 AND method<>'answerCallbackQuery' ORDER BY created_at,unique_key",[String(id)])).rows;
 const visitor=async tid=>{await pool.query(`INSERT INTO domwork_bot_visitors(telegram_id,first_name,created_at,phone) VALUES($1,'Ali',$2,'998901112233')`,[String(tid),new Date(AT-25*3600000)]);};
 const v=async tid=>(await pool.query('SELECT * FROM domwork_bot_visitors WHERE telegram_id=$1',[String(tid)])).rows[0];
 const drip=now=>queue.transaction(pool,db=>funnel.drip(db,now));
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
   INSERT INTO users VALUES('u-sales','Dilnoza Sotuv','dilnoza@x','sales_manager','+998907000001',NULL),('u-t','Ustoz','u@x','teacher','+998907000002',NULL);
   INSERT INTO hr_employees VALUES('h-sales','Dilnoza Sotuv','dilnoza@x','sotuv-menejeri','active','russian',false,'+998907000001'),
    ('h-t','Ustoz','u@x','rus-oqituvchi','active','russian',false,'+998907000002');
   INSERT INTO leads(id,name,phone,source,language,status) VALUES('L1','Ali','+998901112233','Telegram bot','russian','yangi-lidlar');`);
  await groups.initSchema(pool);await store.initSchema(pool);
  await pool.query("UPDATE domwork_bot_settings SET data=data||$1::jsonb",[JSON.stringify({funnelEnabled:true,dripEnabled:true,discountPercent:15,
   bonusChannel:'@domwork',funnelMedia:{bonus:{method:'sendAudio',fileId:'BONUS_AUDIO_FILE'},dars1:{method:'sendVideo',fileId:'LESSON1_FILE_ID'}},
   funnelTestimonials:{B:'https://t.me/domwork_natijalari/12'}})]);
  await pool.query("INSERT INTO domwork_bot_groups(id,type,scope,chat_id,active,created_by) VALUES('g-sales','sales','','-1009876543210',true,'admin')");
  await pool.query(`INSERT INTO domwork_bot_links(telegram_id,account_kind,account_id,phone) VALUES('810','user','u-sales','998907000001'),('811','user','u-t','998907000002')`);

  await t.test('day 1 nudge goes once in the evening window; holdout, requested and off-window visitors get nothing',async()=>{
   await visitor(601);await visitor(602);await visitor(603);
   await pool.query("UPDATE domwork_bot_visitors SET holdout=true WHERE telegram_id='602'");
   await pool.query("UPDATE domwork_bot_visitors SET requested_at=NOW() WHERE telegram_id='603'");
   assert.equal(await drip(new Date('2026-11-10T10:00:00Z')),0); // 15:00 Toshkent — oyna emas
   assert.equal(await drip(AT),1);
   const rows=await out(601);assert.equal(rows.length,1);assert.match(rows[0].payload.text,/1-dars atigi 5 daqiqa/);
   assert.equal(rows[0].payload._automation,true);
   assert.equal((await out(602)).length,0);assert.equal((await out(603)).length,0);
   assert.equal(await drip(new Date(AT.getTime()+60000)),0); // 20 soat o'tmagan
   assert.equal((await v(601)).ignored,1);
  });
  await t.test('next days follow the plan; three ignored messages slow down to every 3 days; a reply resets it',async()=>{
   const day=n=>new Date(AT.getTime()+n*86400000);
   await drip(day(1));assert.match((await out(601)).at(-1).payload.text,/O‘quvchimiz natijasi[\s\S]*domwork_natijalari\/12/);
   await drip(day(2));assert.match((await out(601)).at(-1).payload.text,/Bonus: «33 ta ish iborasi»/);
   assert.equal((await v(601)).ignored,3);
   assert.equal(await drip(day(3)),0); // 3 kunlik tanaffus
   await run({update_id:++uid,message:{message_id:1,from:from(601),chat:{id:601,type:'private'},text:'Rahmat'}});
   assert.equal((await v(601)).ignored,0);
   assert.equal(await drip(day(3)),1);assert.match((await out(601)).at(-1).payload.text,/eng qiyini/);
  });
  await t.test('migrants are messaged in their own later window; a linked student is never dripped',async()=>{
   await visitor(604);await pool.query("UPDATE domwork_bot_visitors SET segment='russia' WHERE telegram_id='604'");
   assert.equal(await drip(AT),0);assert.equal(await drip(AT_A),1);
   await visitor(605);
   await pool.query(`INSERT INTO students VALUES('s1','O‘quvchi','+998935550000','russian','{"passwordHash":"h","paidAmount":10}','t')`);
   await pool.query("INSERT INTO domwork_bot_links(telegram_id,account_kind,account_id,phone) VALUES('605','student','s1','998935550000')");
   await drip(AT);assert.equal((await out(605)).length,0);assert.equal((await v(605)).drip_stopped,true);
  });
  await t.test('manager buttons: only linked sales staff in the sales group; "no answer" asks the lead politely once',async()=>{
   await pool.query("UPDATE domwork_bot_visitors SET lead_id='L1',requested_at=NOW() WHERE telegram_id='601'");
   const press=(fromId,data)=>run({update_id:++uid,callback_query:{id:'q'+uid,from:from(fromId),data,message:{message_id:77,chat:{id:-1009876543210,type:'supergroup'}}}});
   await press(811,'m:601:na'); // ustoz — sotuv emas
   assert.equal((await v(601)).outcome,null);
   await press(999,'m:601:na'); // bog'lanmagan odam
   assert.equal((await v(601)).outcome,null);
   await press(810,'m:601:na');
   assert.equal((await v(601)).outcome,'na');
   assert.match((await out(601)).at(-1).payload.text,/Dilnoza sizga qo‘ng‘iroq qildi/);
   await press(810,'m:601:na');
   assert.equal((await out(601)).filter(r=>/qo‘ng‘iroq qildi/.test(r.payload.text||'')).length,1);
   const lead=(await pool.query("SELECT comments FROM leads WHERE id='L1'")).rows[0].comments;assert.match(lead,/Dilnoza Sotuv: 🔕 Javob yo‘q/);
   const edits=(await pool.query("SELECT payload FROM domwork_bot_outbox WHERE method='editMessageReplyMarkup'")).rows;
   assert.equal(edits.at(-1).payload.message_id,77);
   await press(810,'m:601:rej');await press(810,'m:601:r:price');
   assert.equal((await v(601)).outcome,'r_price');
  });
  await t.test('post-call track by reason: price → installments on day 1',async()=>{
   await pool.query("UPDATE domwork_bot_visitors SET outcome_at=$2,drip_last_at=NULL WHERE telegram_id=$1",['601',new Date(AT-26*3600000)]);
   assert.equal(await drip(AT),1);assert.match((await out(601)).at(-1).payload.text,/Uzum Nasiya/);
  });
  await t.test('relay: a sales manager reply in the group reaches the lead with the manager name; others get a hint',async()=>{
   await pool.query("INSERT INTO domwork_bot_relay(chat_id,message_id,telegram_id) VALUES('-1009876543210',55,'601')");
   const reply=(fromId,extra)=>run({update_id:++uid,message:{message_id:++uid,from:from(fromId),chat:{id:-1009876543210,type:'supergroup'},
    reply_to_message:{message_id:55,from:{id:1,is_bot:true}},...extra}});
   await reply(810,{text:'Assalomu alaykum! Ertaga 10:00 da qo‘ng‘iroq qilsam bo‘ladimi?'});
   assert.match((await out(601)).at(-1).payload.text,/^👩‍💼 Dilnoza \(Domwork\):\nAssalomu alaykum!/);
   await reply(810,{voice:{file_id:'VOICE'}});
   const last=(await out(601)).at(-1);assert.equal(last.method,'copyMessage');assert.equal(last.payload.from_chat_id,'-1009876543210');
   await reply(999,{text:'begona'});
   assert.ok((await pool.query("SELECT payload FROM domwork_bot_outbox WHERE target_id='-1009876543210' AND payload->>'text' LIKE 'Javob yuborilmadi%'")).rows.length);
   assert.ok(!(await out(601)).some(r=>/begona/.test(r.payload.text||'')));
  });
  await t.test('channel bonus checks real membership via Telegram (mocked)',async()=>{
   const press=async status=>queue.transaction(pool,async db=>{db.domworkTelegram=async(method,payload)=>{assert.equal(method,'getChatMember');assert.equal(payload.chat_id,'@domwork');return {status};};
    const c={db,tid:'604',key:(()=>{let n=0;return()=>`bonus-test:${status}:${n++}`;})()};
    return funnel.bonus(c,(await db.query("SELECT * FROM domwork_bot_visitors WHERE telegram_id='604'")).rows[0]);});
   await press('left');assert.match((await out(604)).at(-1).payload.text,/Hali obuna ko‘rinmayapti/);
   await press('member');const last=(await out(604)).at(-1);assert.equal(last.payload.audio,'BONUS_AUDIO_FILE');
   assert.ok((await v(604)).bonus_at);
  });
  await t.test('weekly → reactivation → monthly → stops after 90 days (pure planning)',async()=>{
   const s=(await store.settings(pool)).data, base=new Date('2026-01-01T00:00:00Z');
   const plan=(sent,last,extra={})=>funnel.nextItem({telegram_id:'1',first_name:'A',segment:'career',created_at:base,drip_sent:sent,drip_last_at:last,ignored:0,lesson_parts:1,...extra},s,new Date(base.getTime()+40*86400000));
   const pre=['d1','d2','d3','d4','d5','d6','d8','d10'];
   assert.equal(plan(pre,new Date(base.getTime()+39*86400000)),null); // haftalik tanaffus
   assert.equal(plan(pre,new Date(base.getTime()+30*86400000)).key,'w0');
   assert.equal(plan([...pre,'w0','w1','w2','w3','w4','w5','w6','w7'],new Date(base.getTime()+30*86400000)).key,'react');
   assert.equal(plan([...pre,'w0','w1','w2','w3','w4','w5','w6','w7','react'],new Date(base.getTime()+5*86400000)).key,'m0');
   assert.equal(funnel.nextItem({created_at:base,drip_sent:pre,drip_last_at:base,ignored:0,lesson_parts:1,segment:'career',first_name:'A'},s,new Date(base.getTime()+91*86400000)),null);
   assert.equal(plan(pre,null,{drip_stopped:true}),null);
  });
  await t.test('report shows drip sends and outcomes',async()=>{
   const r=await funnel.report(pool,3650);
   assert.ok(r.drips.find(d=>d.item==='d1').sent>=1);assert.ok(r.outcomes.some(o=>o.action==='na'));
  });
 }finally{await pool.end();}
});
