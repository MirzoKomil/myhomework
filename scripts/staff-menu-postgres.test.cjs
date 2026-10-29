const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const staff=require('../server/services/domworkBot/staff');
const url=process.env.PAYROLL_TEST_DATABASE_URL;
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||!/^\/payroll_test_[a-z0-9]+$/.test(u.pathname))throw Error('Only disposable loopback DBs');}
test('bot staff menus match CRM lists — synthetic data only',{skip:!url},async t=>{
 const pool=new Pool({connectionString:url});
 const sales={id:'u-s',kind:'user',role:'sales',employeeId:'h-s',managerId:'h-s'};
 const rop={id:'u-r',kind:'user',role:'rop',employeeId:'h-r',managerId:'h-r'};
 const teacher={id:'u-t',kind:'user',role:'teacher',employeeId:'h-t'};
 try{
  await pool.query(`CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,extra_data JSONB,teacher_id TEXT,assistant_teacher_id TEXT,group_name TEXT,lesson_time TEXT);
   CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,language TEXT,status TEXT,manager_id TEXT,deleted_at TIMESTAMPTZ);
   CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,phone TEXT);
   CREATE TABLE teachers(id TEXT PRIMARY KEY,name TEXT,type TEXT,subject TEXT,phone TEXT);
   CREATE TABLE payment_records(amount NUMERIC,language TEXT,paid_date DATE);
   INSERT INTO hr_employees VALUES('h-t','Rus Ustoz','t@x','rus-oqituvchi','active','russian','+998901112233'),('h-s','Sotuvchi','s@x','sotuv-menejeri','active','russian','');
   INSERT INTO teachers VALUES('legacy-t','Boshqa ism','asosiy','russian','998 90 111 22 33'),('other','Boshqa','asosiy','russian','+998900000000');
   INSERT INTO leads VALUES('l1','Lid','1','russian','tolov-yopildi','h-s',NULL),('l2','Lid2','2','russian','yangi-lidlar','h-x',NULL),('l3','Lid3','3','russian','sinov-darsida','h-x',NULL);
   INSERT INTO students VALUES
    ('s1','Ali','901','russian','{"managerId":"h-s","debtAmount":300000,"paymentDueDate":"2026-11-01"}','h-t',NULL,'A1','10:00'),
    ('s2','Vali','902','russian','{"leadRef":{"id":"l1","lang":"russian"},"debtAmount":500000}','legacy-t',NULL,'',''),
    ('s3','Demo xodim','903','russian','{"managerId":"h-s","isStaffDemo":true,"debtAmount":999}','h-t',NULL,'',''),
    ('s4','Boshqaniki','904','russian','{"managerId":"h-x","debtAmount":100}','other',NULL,'','');`);
  await t.test('sales sees own and lead-derived students, never staff demos or others',async()=>{
   const list=await staff.action(pool,sales,'students');
   assert.match(list,/Jami: 2 ta/);assert.match(list,/Ali/);assert.match(list,/Vali/);
   assert.doesNotMatch(list,/Demo xodim|Boshqaniki/);
  });
  await t.test('debtors are sorted by amount with a total',async()=>{
   const out=await staff.action(pool,sales,'debtors');
   assert.match(out,/^Qarzdorlar: 2 ta · Jami qarz: 800 000 UZS/);
   assert.ok(out.indexOf('Vali')<out.indexOf('Ali'));assert.match(out,/Muddat: 2026-11-01/);
   const all=await staff.action(pool,rop,'debtors');assert.match(all,/Qarzdorlar: 3 ta/);assert.doesNotMatch(all,/Demo xodim/);
  });
  await t.test('teacher list includes legacy teacher records of the same person',async()=>{
   const out=await staff.action(pool,teacher,'students');
   assert.match(out,/Jami: 2 ta/);assert.match(out,/Ali/);assert.match(out,/Vali/);assert.doesNotMatch(out,/Demo xodim|Boshqaniki/);
  });
  await t.test('lead stages are shown with CRM names in funnel order',async()=>{
   const out=await staff.action(pool,rop,'income');
   assert.match(out,/Yangi lidlar: 1\nSinov darsida: 1\nTo‘lov yopildi: 1/);
   assert.doesNotMatch(out,/tolov-yopildi/);
  });
 }finally{await pool.end();}
});
