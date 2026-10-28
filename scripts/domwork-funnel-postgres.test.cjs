const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const store=require('../server/services/domworkBot/store');
const queue=require('../server/services/domworkBot/queue');
const leadLink=require('../server/services/domworkBot/leadLink');
const funnel=require('../server/services/domworkBot/funnel');
const groups=require('../server/services/domworkGroups');
const {createHandler}=require('../server/services/domworkBot/handlers');
const url=process.env.PAYROLL_TEST_DATABASE_URL;
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||!/^\/payroll_test_[a-z0-9]+$/.test(u.pathname))throw Error('Only disposable loopback DBs');}
test('lead funnel for unknown Telegram visitors — synthetic data, no Telegram calls',{skip:!url},async t=>{
 const pool=new Pool({connectionString:url}),handler=createHandler({crm:{}});
 let uid=1000;
 const from=id=>({id,first_name:'Mehmon',last_name:'Test',username:'mehmon_'+id});
 const msg=(id,text,extra={})=>({update_id:++uid,message:{message_id:uid,from:from(id),chat:{id,type:'private'},text,...extra}});
 const cb=(id,data)=>({update_id:++uid,callback_query:{id:'cq'+uid,from:from(id),data,message:{chat:{id,type:'private'}}}});
 const run=async update=>{await queue.receive(pool,update);while(await queue.processOne(pool,handler));};
 const out=async id=>(await pool.query("SELECT method,payload,not_before FROM domwork_bot_outbox WHERE target_id=$1 AND method<>'answerCallbackQuery' ORDER BY created_at,unique_key",[String(id)])).rows;
 const texts=async id=>(await out(id)).map(r=>r.payload.text||r.payload.caption||'');
 const setSettings=async patch=>pool.query("UPDATE domwork_bot_settings SET data=data||$1::jsonb WHERE singleton=1",[JSON.stringify(patch)]);
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
   INSERT INTO students VALUES('s-empty','Bo‘sh raqamli o‘quvchi','','russian','{"passwordHash":"h","paidAmount":100}','t1'),
    ('s-paid','Faol o‘quvchi','+998935550000','russian','{"passwordHash":"h","paidAmount":100}','t1');
   INSERT INTO leads(id,name,phone,source,language,status,comments) VALUES('land-1','Dilshod Karimov','+998907770011','Domwork','russian','yangi-lidlar',
    '[{"type":"contact-time","text":"Bog‘lanish uchun qulay vaqt: 12:00–16:00 | Maqsad: Ish va karyera | Sayt: https://domwork.uz"}]');`);
  await groups.initSchema(pool);await store.initSchema(pool);
  await pool.query("INSERT INTO domwork_bot_groups(id,type,scope,chat_id,active,created_by) VALUES('g-sales','sales','','-1001234567890',true,'admin')");

  await t.test('disabled by default: unknown visitor keeps the old phone prompt, landing gets no bot link',async()=>{
   await run(msg(700,'/start'));
   assert.match((await texts(700))[0],/telefon raqamingizni yuboring/);
   assert.equal(await leadLink.issueIfEnabled(pool,'land-1'),null);
   assert.equal((await pool.query('SELECT COUNT(*) FROM domwork_bot_visitors')).rows[0].count,'0');
  });
  await setSettings({funnelEnabled:true,discountPercent:15,discountHours:72,salesSlaMinutes:30,salesHours:'00:00-23:59',
   funnelMedia:{sovga:{method:'sendDocument',fileId:'GIFT_FILE_ID_123'},dars1:{method:'sendVideo',fileId:'LESSON1_FILE_ID'},dars2:{method:'sendVideo',fileId:'LESSON2_FILE_ID'},qollanma_bank:{method:'sendDocument',fileId:'BANK_GUIDE_FILE'}}});

  await t.test('organic start: greeting + gift without phone, delayed segment question cancelled once answered',async()=>{
   await run(msg(701,'/start ig_reels12'));
   const rows=await out(701);
   assert.equal(rows[0].payload.reply_markup.keyboard.length,2);
   assert.equal(rows[1].method,'sendDocument');assert.equal(rows[1].payload.document,'GIFT_FILE_ID_123');
   assert.equal(rows[1].payload.reply_markup.inline_keyboard[0][0].callback_data,'f:les');
   const delayed=rows.find(r=>/nima uchun kerak/.test(r.payload.text||''));
   assert.ok(new Date(delayed.not_before)-Date.now()>60000);
   const v=(await pool.query("SELECT * FROM domwork_bot_visitors WHERE telegram_id='701'")).rows[0];
   assert.equal(v.source,'ig:reels12');assert.equal(v.phone,'');
   await run(cb(701,'f:seg:career'));
   const row={target_kind:'private',target_id:'701',method:'sendMessage',payload:delayed.payload};
   assert.equal(await queue.transaction(pool,db=>funnel.deliverable(db,row)),false);
   assert.ok((await texts(701)).some(x=>/soha bo‘yicha/.test(x)));
   await run(cb(701,'f:fld:bank'));
   const r2=await out(701);assert.ok(r2.some(r=>r.payload.document==='BANK_GUIDE_FILE'));
  });
  await t.test('1-dars needs a one-tap own contact; phone creates a CRM lead tagged "no call"',async()=>{
   await run(cb(701,'f:les'));
   const ask=(await out(701)).at(-1);assert.equal(ask.payload.reply_markup.keyboard[0][0].request_contact,true);
   // Forwarded/someone else's contact is rejected.
   await run(msg(701,'',{contact:{phone_number:'+998901234567',user_id:999}}));
   assert.equal((await pool.query("SELECT COUNT(*) FROM leads WHERE source='Telegram bot'")).rows[0].count,'0');
   await run(msg(701,'',{contact:{phone_number:'+998901234567',user_id:701}}));
   const lead=(await pool.query("SELECT * FROM leads WHERE source='Telegram bot'")).rows[0];
   assert.equal(lead.phone,'+998901234567');assert.equal(lead.status,'yangi-lidlar');assert.equal(lead.language,'russian');
   assert.match(lead.comments,/qo‘ng‘iroq SHART EMAS/);assert.equal(lead.extra_data.utmCampaign,'reels12');
   assert.equal((await pool.query("SELECT COUNT(*) FROM lead_audit WHERE lead_id=$1",[lead.id])).rows[0].count,'1');
   assert.ok((await out(701)).some(r=>r.payload.video==='LESSON1_FILE_ID'));
   assert.equal(await store.identity(pool,'701'),null); // prospect lead is not a cabinet identity
  });
  await t.test('lesson → quiz → honest feedback; hot score alerts sales once, softly',async()=>{
   await run(cb(701,'f:les:2'));await run(cb(701,'f:seen'));
   await run(cb(701,'f:q:0:a'));await run(cb(701,'f:q:1:a'));await run(cb(701,'f:q:2:a'));
   assert.ok((await texts(701)).some(x=>/barakalla/.test(x)&&/«мне»/.test(x)));
   const sales=(await pool.query("SELECT payload FROM domwork_bot_outbox WHERE target_id='-1001234567890'")).rows.map(r=>r.payload.text);
   assert.equal(sales.filter(x=>/Issiq lid/.test(x)).length,1);assert.match(sales[0],/qo‘ng‘iroq qilmang/);
  });
  await t.test('request: call with known phone → time → CRM comment + sales group + honest promise; delayed CTA cancelled',async()=>{
   await run(cb(701,'f:cta'));
   const ctaRow=(await out(701)).at(-1);assert.match(ctaRow.payload.text,/15% chegirma/);
   await run(cb(701,'f:call'));assert.match((await texts(701)).at(-1),/\*\*\* \*\* 67/);
   await run(cb(701,'f:cok'));await run(cb(701,'f:w:now'));
   assert.match((await texts(701)).at(-1),/30 daqiqa ichida/);
   const lead=(await pool.query("SELECT comments FROM leads WHERE source='Telegram bot'")).rows[0];
   assert.match(lead.comments,/bog‘lanishni so‘radi — qo‘ng‘iroq, Hozir/);
   assert.ok((await pool.query("SELECT payload FROM domwork_bot_outbox WHERE target_id='-1001234567890'")).rows.some(r=>/Botdan so‘rov/.test(r.payload.text)));
   const later=(await out(701)).find(r=>r.payload._guest?.unless==='request');
   assert.equal(await queue.transaction(pool,db=>funnel.deliverable(db,{target_kind:'private',target_id:'701',method:'sendMessage',payload:later.payload})),false);
  });
  await t.test('landing token: issued only when enabled, links the exact lead without phone, goal reused',async()=>{
   const link=await leadLink.issueIfEnabled(pool,'land-1');
   assert.equal(link,null); // DOMWORK_BOT_ENABLED is not set in tests
   const raw=await queue.transaction(pool,db=>leadLink.issue(db,'land-1'));
   assert.match(raw,/^https:\/\/t\.me\/Domworkuz_bot\?start=ld_[A-Za-z0-9_-]{43}$/);
   const start='/start '+new URL(raw).searchParams.get('start');
   const update=msg(702,start);await queue.receive(pool,update);
   const saved=(await pool.query('SELECT payload FROM domwork_bot_updates WHERE update_id=$1',[update.update_id])).rows[0].payload;
   assert.equal(saved.message.text,'/start lead-link');assert.ok(!JSON.stringify(saved).includes(start.slice(10)));
   while(await queue.processOne(pool,handler));
   assert.match((await texts(702))[0],/Dilshod! Arizangiz qabul qilindi/);
   const v=(await pool.query("SELECT * FROM domwork_bot_visitors WHERE telegram_id='702'")).rows[0];
   assert.equal(v.lead_id,'land-1');assert.equal(v.segment,'career');
   assert.equal(v.phone,''); // landing raqami tasdiqlanmagan — kontakt tugmasi bilan olinadi
   assert.equal((await pool.query("SELECT phone FROM domwork_bot_links WHERE telegram_id='702'")).rows[0].phone,'');
   // Same token cannot be reused by another Telegram.
   await run(msg(703,start));
   assert.equal((await pool.query("SELECT lead_id FROM domwork_bot_visitors WHERE telegram_id='703'")).rows[0].lead_id,null);
  });
  await t.test('security: landing form with a STUDENT phone cannot take over the student cabinet',async()=>{
   await pool.query("INSERT INTO leads(id,name,phone,source,language,status) VALUES('attack','Hujumchi','+998935550000','Domwork','russian','yangi-lidlar')");
   const raw=await queue.transaction(pool,db=>leadLink.issue(db,'attack'));
   await run(msg(799,'/start '+new URL(raw).searchParams.get('start')));
   await run(msg(799,'/start'));
   assert.equal(await store.identity(pool,'799'),null);
   assert.ok(!(await texts(799)).some(x=>/Faol o‘quvchi/.test(x)));
   assert.equal((await pool.query("SELECT COUNT(*) FROM domwork_bot_links WHERE account_kind='student'")).rows[0].count,'0');
  });
  await t.test('replayed buttons do not spam sales; unblocked visitor is served again',async()=>{
   const before=(await pool.query("SELECT COUNT(*) FROM domwork_bot_outbox WHERE target_id='-1001234567890'")).rows[0].count;
   await run(cb(701,'f:faq:price'));await run(cb(701,'f:faq:price'));await run(cb(701,'f:w:now'));
   const after=(await pool.query("SELECT COUNT(*) FROM domwork_bot_outbox WHERE target_id='-1001234567890'")).rows[0].count;
   assert.equal(Number(after)-Number(before),1); // faqat birinchi narx so'rovi
   await pool.query("UPDATE domwork_bot_visitors SET blocked_at=NOW() WHERE telegram_id='701'");
   await run(msg(701,'/start'));
   assert.equal((await pool.query("SELECT blocked_at FROM domwork_bot_visitors WHERE telegram_id='701'")).rows[0].blocked_at,null);
  });
  await t.test('security: a phone-less lead link never resolves to a student with an empty phone',async()=>{
   await pool.query("INSERT INTO leads(id,name,phone,source,language,status) VALUES('nophone','Raqamsiz','','Telegram bot','russian','yangi-lidlar')");
   await pool.query("INSERT INTO domwork_bot_links(telegram_id,account_kind,account_id,phone) VALUES('704','lead','nophone','')");
   assert.equal(await store.identity(pool,'704'),null);
   await pool.query("DELETE FROM domwork_bot_links WHERE telegram_id='704'");
  });
  await t.test('staff/students are untouched: a real student contact still opens the cabinet',async()=>{
   await run(msg(705,'/start'));
   await run(msg(705,'',{contact:{phone_number:'+998935550000',user_id:705}}));
   const id=await store.identity(pool,'705');assert.equal(id.kind,'student');assert.equal(id.id,'s-paid');
   assert.equal((await pool.query("SELECT COUNT(*) FROM leads WHERE phone='+998935550000' AND source='Telegram bot'")).rows[0].count,'0');
  });
  await t.test('free text goes to sales; /stop pauses automation; block marks visitor',async()=>{
   await run(msg(701,'Darslar kechqurun bo‘ladimi?'));
   assert.ok((await pool.query("SELECT payload FROM domwork_bot_outbox WHERE target_id='-1001234567890'")).rows.some(r=>/kechqurun bo‘ladimi/.test(r.payload.text)));
   await run(msg(701,'/stop'));
   assert.equal((await pool.query("SELECT paused FROM domwork_bot_visitors WHERE telegram_id='701'")).rows[0].paused,true);
   assert.equal(await queue.transaction(pool,db=>funnel.deliverable(db,{target_kind:'private',target_id:'701',method:'sendMessage',payload:{_guest:{tid:'701'},_automation:true}})),false);
  });
  await t.test('admin uploads material with "#voronka <key>"; others cannot',async()=>{
   await pool.query("INSERT INTO domwork_bot_links(telegram_id,account_kind,account_id,phone) VALUES('900','user','admin','998901111111')");
   await run(msg(900,'',{caption:'#voronka menejer',photo:[{file_id:'SMALL_PHOTO_ID'},{file_id:'BIG_PHOTO_FILE_ID'}]}));
   assert.deepEqual((await store.settings(pool)).data.funnelMedia.menejer.fileId,'BIG_PHOTO_FILE_ID');
   await run(msg(900,'#voronka'));assert.match((await texts(900)).at(-1),/✅ menejer/);
   await run(msg(701,'#voronka menejer',{}));
   assert.equal((await store.settings(pool)).data.funnelMedia.menejer.fileId,'BIG_PHOTO_FILE_ID');
  });
  await t.test('report counts unique people per step',async()=>{
   const r=await funnel.report(pool,30);
   const step=e=>r.steps.find(s=>s.event===e).people;
   assert.ok(step('start')>=2);assert.equal(step('request'),1);assert.equal(step('quiz'),1);
  });
 }finally{await pool.end();}
});
