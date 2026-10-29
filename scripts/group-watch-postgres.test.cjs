const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const store=require('../server/services/domworkBot/store');
const groups=require('../server/services/domworkGroups');
const school=require('../server/services/school/schema');
const watch=require('../server/services/domworkBot/groupWatch');
const controls=require('../server/services/domworkBot/controls');
const url=process.env.PAYROLL_TEST_DATABASE_URL;
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||!/^\/payroll_test_[a-z0-9]+$/.test(u.pathname))throw Error('Only disposable loopback DBs');}
test('ROP is nagged about class groups without the bot; classroom broadcast audience — synthetic data',{skip:!url},async t=>{
 const pool=new Pool({connectionString:url});
 const now=new Date();
 try{
  await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,phone TEXT);
   CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN,phone TEXT);
   CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
   CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,extra_data JSONB,teacher_id TEXT,assistant_teacher_id TEXT,group_name TEXT,lesson_day_of_week INT,lesson_time TEXT,lesson_duration INT);
   CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,language TEXT,status TEXT,deleted_at TIMESTAMPTZ);
   INSERT INTO hr_employees VALUES('h-t','Ezoza Sodiqova','ez@x','rus-oqituvchi','active','russian',false,'');
   INSERT INTO students(id,name,subject,extra_data,teacher_id) VALUES
    ('s1','Ali','russian','{"passwordHash":"h","paidAmount":1}','h-t'),('s2','Vali','russian','{"passwordHash":"h","paidAmount":1}','h-t'),
    ('s3','Old','russian','{"passwordHash":"h","paidAmount":1}','h-t'),('s4','Ok','russian','{"passwordHash":"h","paidAmount":1}','h-t');`);
  await groups.initSchema(pool);await store.initSchema(pool);await school.initSchema(pool);
  await pool.query(`INSERT INTO school_student_groups(student_id,tg_link,name,updated_by,updated_at) VALUES
    ('s1','https://t.me/+c70','C70','a',NOW()-INTERVAL '1 hour'),('s2','https://t.me/+c70','C70b','a',NOW()-INTERVAL '1 hour'),
    ('s3','https://t.me/+c10','C10','a',NOW()-INTERVAL '40 days'),('s4','https://t.me/+c20','C20','a',NOW()-INTERVAL '1 hour')`);
  await pool.query(`INSERT INTO domwork_learning_groups(id,type,name,teacher_id,invite_link,chat_id,verified_at,created_by,updated_by)
    VALUES('g20','classroom','C20','h-t','https://t.me/+c20','-100200',NOW(),'a','a')`);
  await pool.query("INSERT INTO domwork_student_group_links(student_id,group_id,updated_by) VALUES('s4','g20','a')").catch(async()=>{
   const cols=(await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='domwork_student_group_links'")).rows.map(r=>r.column_name);
   throw Error('domwork_student_group_links columns: '+cols.join(','));
  });
  await pool.query("INSERT INTO domwork_bot_seen_chats(chat_id,title,bot_status) VALUES('-100700','C70','member')");
  await t.test('groups without a verified bot are listed once per invite link; fresh vs old split; state explained',async()=>{
   const list=await watch.missing(pool,now);
   const c70=list.find(g=>g.link.endsWith('c70'));assert.equal(c70.students.length,2);assert.equal(c70.state,'not-admin');assert.equal(c70.fresh,true);
   assert.equal(list.find(g=>g.link.endsWith('c10')).fresh,false);
   assert.ok(!list.some(g=>g.link.endsWith('c20')));
   assert.match(watch.text(list.filter(g=>g.fresh),false),/har 15 daqiqada/);
  });
  await t.test('"all class groups" broadcast audience = verified classroom groups',async()=>{
   const audience=await controls.recipients(pool,'classrooms');assert.deepEqual(audience.map(a=>a.id),['-100200']);
  });
 }finally{await pool.end();}
});
