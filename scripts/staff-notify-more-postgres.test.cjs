const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const ST=require('../server/services/staffSettings');
const N=require('../server/services/staffNotify');
const school=require('../server/services/school/schema');
const inflow=require('../server/services/inflow');
const url=process.env.PAYROLL_TEST_DATABASE_URL;
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||!/^\/payroll_test_[a-z0-9]+$/.test(u.pathname))throw Error('Only disposable loopback DBs');}
test('new staff notification sources — synthetic data only',{skip:!url},async t=>{
 const pool=new Pool({connectionString:url});
 const D=new Date().toISOString().slice(0,10);
 const at=(h,m=0)=>new Date(`${D}T${String(h-5).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`); // Toshkent vaqti
 const add=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
 const types=async(id,now)=>(await N.feed(pool,{id},now)).events;
 try{
  await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,phone TEXT,bio TEXT,avatar TEXT,created_at TIMESTAMPTZ DEFAULT NOW(),disabled_at TIMESTAMPTZ);
   CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN,phone TEXT);
   CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
   CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,extra_data JSONB,teacher_id TEXT,assistant_teacher_id TEXT,group_name TEXT,lesson_day_of_week INT,lesson_time TEXT,lesson_duration INT);
   CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,language TEXT,status TEXT,manager_id TEXT,deleted_at TIMESTAMPTZ,extra_data JSONB,updated_at TIMESTAMPTZ DEFAULT NOW());
   CREATE TABLE sessions(user_id TEXT,jti TEXT PRIMARY KEY,last_seen TIMESTAMPTZ DEFAULT NOW());
   CREATE TABLE json_data(key TEXT PRIMARY KEY,data TEXT);
   INSERT INTO users(id,name,email,role) VALUES('u-s','Dilnoza','dil@x','sales_manager'),('u-r','Rop','rop@x','rop'),('u-a','Admin','adm@x','admin');
   INSERT INTO user_sales_manager_links VALUES('u-s','h-s');
   INSERT INTO hr_employees VALUES('h-s','Dilnoza Karimova','dil@x','sotuv-menejeri','active','russian',false,''),('h-r','Rop','rop@x','rop','active','russian',false,'');
   INSERT INTO json_data VALUES('individualSalesPlans','{"h-s":{"totalAmount":10000000}}');
   INSERT INTO leads(id,name,language,status,manager_id,extra_data) VALUES('L1','Ali','russian','tolov-yopildi','h-s','{}'),('L2','Vali','russian','tolov-yopildi','h-s','{}');`);
  await ST.initSchema(pool);await school.initSchema(pool);await inflow.initSchema(pool);
  await pool.query(`INSERT INTO students(id,name,subject,extra_data) VALUES
   ('s1','Ali Valiyev','russian',$1),('s2','Vali Aliyev','russian',$2),('s3','Demo','russian','{"managerId":"h-s","isStaffDemo":true,"debtAmount":5,"paymentDueDate":"${D}"}')`,
   [JSON.stringify({managerId:'h-s',debtAmount:300000,paymentDueDate:add(D,2),leadRef:{id:'L1',lang:'russian'}}),JSON.stringify({leadRef:{id:'L2',lang:'russian'},debtAmount:200000,paymentDueDate:add(D,-3)})]);
  await pool.query(`INSERT INTO payment_records(id,source_key,lead_id,language,manager_id,paid_date,amount,method,form,snapshot,actor_id,created_at) VALUES
   ('p1','lead:L1:closing','L1','russian','h-s',$1,1500000,'card','full','{}','a',NOW()-INTERVAL '2 days'),('p2','lead:L2:closing','L2','russian','h-s',$1,500000,'card','full','{}','a',NOW())`,[D]);
  await pool.query(`INSERT INTO school_student_groups(student_id,tg_link,name,updated_by) VALUES('s2','https://t.me/+x','G2','a')`);
  await pool.query(`INSERT INTO school_student_status(id,student_id,status,from_date,to_date,reason,actor_id) VALUES('f1','s1','frozen',$1,$2,'Safar','a')`,[D,add(D,7)]);
  await t.test('sales: due soon / overdue (own + lead-derived, no demo), status change, missing group, daily plan at 20:00',async()=>{
   const ev=await types('u-s',at(20,30));const by=k=>ev.filter(e=>e.type===k);
   assert.deepEqual(by('payment_due').map(e=>e.title).sort(),["To'lov muddati o'tdi","To'lov muddati yaqin"]);
   assert.ok(!ev.some(e=>/Demo/.test(e.sub||'')));
   assert.match(by('student_status')[0].title,/muzlatildi/);
   assert.deepEqual(by('group_link_missing').map(e=>e.id),['glm:s1']);
   assert.match(by('daily_plan')[0].title,/Bugun 2 ta to'lov/);assert.match(by('daily_plan')[0].sub,/reja 20%/);
   assert.equal((await types('u-s',at(19,30))).some(e=>e.type==='daily_plan'),false);
  });
  await t.test('ROP sees team plan, team status and missing groups with manager name; admin sees overdue summary',async()=>{
   const rop=await types('u-r',at(20,30));
   assert.match(rop.find(e=>e.type==='daily_plan').sub,/Dilnoza 2 \(20%\)/);
   assert.match(rop.find(e=>e.type==='group_link_missing').sub,/Ali \(Dilnoza\)/);
   assert.match(rop.find(e=>e.type==='student_status').sub,/Dilnoza/);
   const adm=await types('u-a',at(10));
   assert.match(adm.find(e=>e.type==='payment_overdue').title,/1 o'quvchi/);
   for(const [id,h] of [['u-a',21.6],['u-r',21.6],['u-s',21.6]])assert.equal((await N.feed(pool,{id},at(Math.floor(h),36))).partial,undefined,id+' no failing source');
  });
  // Paket B (RopSinov): "Ustozga eslatish" → ustoz panelida yangi xabar; "Admin ochsin" → admin panelida, ustoz biriktirilgach yo'qoladi.
  await t.test('ROP sinov amallari: ustozga eslatma va adminga "vaqt oching" so\'rovi',async()=>{
   await pool.query(`INSERT INTO users(id,name,email,role) VALUES('u-t','Kamola','kam@x','teacher');
    INSERT INTO hr_employees VALUES('h-t','Kamola Mirzayeva','kam@x','ingliz-oqituvchi','active','english',false,'')`);
   const past=new Date(at(9).getTime()-3600000).toISOString(), rem=new Date(at(10).getTime()).toISOString();
   await pool.query(`INSERT INTO leads(id,name,language,status,manager_id,extra_data) VALUES
    ('T1','Shahzod','english','sinov-darsida','h-s',$1),('T2','Anvar','english','sinov-darsida','h-s',$2)`,
    [JSON.stringify({trialRequest:{id:'tr1',state:'accepted',teacherId:'h-t',scheduledAt:past,daysCount:1},trialRopReminder:{at:rem,by:'Bahodir Q',requestId:'tr1'}}),
     JSON.stringify({trialUnassigned:true,trialRequest:{id:'tr2',state:'pending',teacherId:'',scheduledAt:at(23).toISOString(),daysCount:1},trialAdminOpen:{at:rem,by:'Bahodir Q',date:D,time:'08:00',requestId:'tr2'}})]);
   const tev=await types('u-t',at(11));
   const r=tev.find(e=>e.id===`trial:T1:tr1:rop:${rem}`);
   assert.ok(r,'ustoz panelida ROP eslatmasi');assert.match(r.title,/ROP eslatdi: Shahzod/);assert.equal(r.type,'trial_result');
   const adm=await types('u-a',at(11));
   assert.match(adm.find(e=>e.id===`rop-open:T2:${rem}`)?.title||'',/ROP so'radi: sinovga vaqt oching · 08:00/);
   assert.equal((await types('u-r',at(11))).some(e=>/^rop-open:/.test(e.id)),false,'ROP o\'zi bu xabarni olmaydi');
   await pool.query(`UPDATE leads SET extra_data = extra_data || '{"trialUnassigned":false,"trialRequest":{"id":"tr2","state":"pending","teacherId":"h-t","scheduledAt":"${at(23).toISOString()}","daysCount":1}}'::jsonb WHERE id='T2'`);
   assert.equal((await types('u-a',at(11))).some(e=>/^rop-open:T2/.test(e.id)),false,'ustoz biriktirilgach so\'rov yopiladi');
   await pool.query(`UPDATE leads SET extra_data = jsonb_set(extra_data,'{trialRequest,state}','"completed"') WHERE id='T1'`);
   assert.equal((await types('u-t',at(11))).some(e=>/:rop:/.test(e.id)),false,'natija yozilgach eslatma yo\'q');
  });
 }finally{await pool.end();}
});
