const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const express=require('express');
const reports=require('../server/services/domworkBot/reports');
const staff=require('../server/services/domworkBot/staff');
const schedule=require('../server/services/domworkBot/schedule');
const store=require('../server/services/domworkBot/store');
const groups=require('../server/services/domworkGroups');
const url=process.env.PAYROLL_TEST_DATABASE_URL;
if(url){const parsed=new URL(url);if(parsed.hostname!=='127.0.0.1'||!/^\/payroll_test_[a-z0-9]+$/.test(parsed.pathname))throw Error('Disposable loopback databases only');}
test('Domwork reporting on disposable PostgreSQL; all source records preserved',{skip:!url},async t=>{
    const pool=new Pool({connectionString:url}), now=new Date('2026-10-12T15:00:00Z');
    try{
        await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,phone TEXT,email TEXT,role TEXT);
            CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,phone TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN);
            CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
            CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,teacher_id TEXT,assistant_teacher_id TEXT,
                lesson_day_of_week INT,lesson_time TEXT,lesson_duration INT,extra_data JSONB);
            CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,language TEXT,lead_type TEXT,status TEXT,created_at TIMESTAMPTZ,deleted_at TIMESTAMPTZ,extra_data JSONB);
            CREATE TABLE lead_audit(lead_id TEXT,actor_id TEXT,snapshot JSONB,created_at TIMESTAMPTZ);
            CREATE TABLE payment_records(id TEXT,language TEXT,paid_date DATE,amount BIGINT);
            CREATE TABLE main_attendance(att_key TEXT,student_id TEXT,day INT,present INT);
            CREATE TABLE assistant_attendance(att_key TEXT,student_id TEXT,day INT,present INT);
            CREATE TABLE json_data(key TEXT PRIMARY KEY,data JSONB);
            CREATE TABLE teachers(id TEXT PRIMARY KEY,schedule_pattern TEXT,lesson_duration INT);
            CREATE TABLE timetable(date TEXT,time TEXT,teacher_id TEXT,student_id TEXT,completed INT);
            CREATE TABLE salary_plan_confirmations(language TEXT,period_start DATE,period_end DATE,amount BIGINT);
            INSERT INTO users VALUES('admin','Admin','+998901111111','admin','admin'),('teacher','Teacher','+998902222222','teacher','teacher');
            INSERT INTO teachers VALUES('t','mwf',30);
            INSERT INTO students VALUES('s','Student','+998903333333','russian','t','a',1,'10:00',60,'{"passwordHash":"hash","paidAmount":100,"startDate":"2026-10-12"}'),
                ('en','English','+998904444444','english','t',null,1,'11:00',30,'{"passwordHash":"hash","paidAmount":100,"startDate":"2026-10-12"}'),
                ('unpaid','Unpaid','+998905555555','russian','other',null,1,'12:00',30,'{"passwordHash":"hash","paidAmount":"unknown","startDate":"2026-10-12"}');
            INSERT INTO leads VALUES('l','Audited','1','russian','target','tolov-yopildi','2026-10-06T10:00:00Z',null,'{}'),
                ('old','No audit','2','russian','target','tolov-yopildi','2026-10-06T10:00:00Z',null,'{}'),
                ('late','Late sale','3','russian','target','tolov-yopildi','2026-10-06T10:00:00Z',null,'{}'),
                ('english','English','4','english','target','tolov-yopildi','2026-10-06T10:00:00Z',null,'{}'),
                ('organic','Organic','5','russian','organik','tolov-yopildi','2026-10-06T10:00:00Z',null,'{}');
            INSERT INTO lead_audit VALUES('l','admin','{"after":{"status":"boglanildi"}}','2026-10-06T11:00:00Z'),
                ('l','admin','{"after":{"status":"sinov-darsida"}}','2026-10-07T11:00:00Z'),
                ('l','admin','{"after":{"status":"tolov-yopildi"}}','2026-10-08T11:00:00Z'),
                ('l','admin','{"after":{"status":"tolov-yopildi"}}','2026-10-08T12:00:00Z'),
                ('late','admin','{"after":{"status":"tolov-yopildi"}}','2026-10-12T00:00:00Z');
            INSERT INTO payment_records VALUES('p','russian','2026-10-12',100),('refund','russian','2026-10-12',-10),('en','english','2026-10-12',999);
            INSERT INTO main_attendance VALUES('2026-10_t','s',12,1),('2026-10_previous','s',12,1),('2026-10_t','en',12,1),
                ('2026-10_t','s',13,0),('2026-10_t','s',14,1),('2026-10_previous','s',14,0),('2026-02_t','s',31,1);
            INSERT INTO assistant_attendance VALUES('2026-10_a','s',12,1);
            INSERT INTO json_data VALUES('salesPlan','{"russian":{"managers":1,"leadsPerDay":1,"avgCheck":10,"conversions":{"mid":100}}}');
            INSERT INTO salary_plan_confirmations VALUES('russian','2026-10-01','2026-10-31',310);`);
        await groups.initSchema(pool);await store.initSchema(pool);
        const tables=['users','hr_employees','students','leads','lead_audit','payment_records','main_attendance','assistant_attendance','teachers','timetable','json_data','salary_plan_confirmations','domwork_learning_groups','domwork_bot_groups','domwork_bot_links','domwork_bot_settings'];
        const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,(await pool.query(`SELECT * FROM ${table} ORDER BY 1`)).rows])));
        const before=await snapshot();
        await t.test('historical conversion is cohort-based, audit-only, language/source scoped and deduplicated',async()=>{
            assert.deepEqual(await reports.cohort(pool,'2026-10-05','2026-10-11'),{leads:3,audited:1,contacted:1,trial:1,won:1});
            assert.deepEqual(await reports.cohort(pool,'2026-10-01','2026-10-12'),{leads:3,audited:2,contacted:1,trial:1,won:2});
            const text=await staff.action(pool,{role:'marketing'},'history',{now});
            assert.ok(text.includes('Haftalik'));assert.ok(text.includes('Oylik'));assert.ok(text.includes('33.3%'));assert.ok(text.includes('Auditi bor: 1/3'));
            assert.ok(!text.includes('English'));assert.ok(!text.includes('Organic'));
        });
        await t.test('attendance counts unique student-days, excludes invalid dates and flags contradictions instead of inventing absence',async()=>{
            assert.deepEqual(await reports.attendance(pool,'main_attendance','2026-10-01','2026-10-31'),{attended:1,absent:1,conflict:1});
            assert.deepEqual(await reports.attendance(pool,'main_attendance','2026-02-01','2026-02-28'),{attended:0,absent:0,conflict:0});
            await assert.rejects(reports.attendance(pool,'users','2026-10-01','2026-10-31'),e=>e.status===400);
            const text=await reports.academicDigest(pool,'2026-10-12','2026-10-12');
            assert.ok(text.includes('Asosiy dars: qatnashdi 1 · kelmadi 0'));assert.ok(text.includes('Yordamchi dars: qatnashdi 1'));
            assert.ok(text.includes('O‘qishni boshlagan pullik o‘quvchilar: 1'));
        });
        await t.test('admin daily digest includes signed inflow and confirmed plan, with no invented missing-day marks',async()=>{
            const text=await staff.action(pool,{role:'admin'},'digest',{now,daily:true});
            for(const value of ['Kirim: 90 UZS','Akademik hisobot','Oylik tasdiqlangan sotuv rejasi: 310 UZS','Reja bajarilishi: 29.0%'])assert.ok(text.includes(value),text);
            await pool.query("UPDATE salary_plan_confirmations SET amount=500");
            assert.ok((await staff.action(pool,{role:'admin'},'digest',{now,daily:true})).includes('Reja bajarilishi:')===false);
            await pool.query("UPDATE salary_plan_confirmations SET amount=310");
        });
        await t.test('schedule blocks other-language reservations without leaking their student names, and reads only own teacher',async()=>{
            const text=await schedule.ownSchedule(pool,{role:'teacher',employeeId:'t'},new Date('2026-10-12T04:00:00Z'));
            assert.ok(text.includes('Band: 10:00–11:30'),text);assert.ok(text.includes('Jadvalda bo‘sh: 09:00–10:00, 11:30–24:00'));
            assert.ok(!text.includes('English'));assert.ok(!text.includes('Student'));assert.ok(!text.includes('+998'));
            const assistant=await schedule.ownSchedule(pool,{role:'assistant',employeeId:'a'},now);
            assert.ok(!assistant.includes('Band: 10:00'));assert.ok(assistant.includes('to‘liq emas'));
        });
        await t.test('read-only admin report preview rejects anonymous and revoked roles, queues no Telegram messages',async()=>{
            const createRouter=require('../server/routes/domworkBot');
            const app=express();app.use(express.json());
            app.use('/bot',createRouter({pool,runtime:{status(){return {enabled:false};}},authRequired:(req,res,next)=>{
                if(!req.get('X-Test-User'))return res.sendStatus(401);req.user={id:req.get('X-Test-User'),role:'admin'};next();
            }}));
            const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
            try{
                const base=`http://127.0.0.1:${server.address().port}/bot/reports/preview`;
                assert.equal((await fetch(base)).status,401);
                assert.equal((await fetch(base,{headers:{'X-Test-User':'teacher'}})).status,403);
                const res=await fetch(base,{headers:{'X-Test-User':'admin'}});assert.equal(res.status,200);
                assert.equal(res.headers.get('cache-control'),'no-store');const data=await res.json();
                assert.ok(data.digest.includes('Akademik hisobot'));assert.ok(data.marketingHistory.includes('Haftalik'));
                assert.equal((await pool.query('SELECT COUNT(*) FROM domwork_bot_outbox')).rows[0].count,'0');
                assert.deepEqual(await snapshot(),before);
            }finally{await new Promise(resolve=>server.close(resolve));}
        });
    }finally{await pool.end();}
});
