const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const express=require('express');
const insights=require('../server/services/domworkBot/insights');
const recognition=require('../server/services/domworkBot/recognition');
const policy=require('../server/services/domworkBot/policy');
const reports=require('../server/services/domworkBot/reports');
const controls=require('../server/services/domworkBot/controls');
const store=require('../server/services/domworkBot/store');
const queue=require('../server/services/domworkBot/queue');
const events=require('../server/services/domworkBot/events');
const scheduler=require('../server/services/domworkBot/scheduler');
const url=process.env.PAYROLL_TEST_DATABASE_URL;
if(url){const p=new URL(url);if(p.hostname!=='127.0.0.1'||!/^\/payroll_test_[a-z0-9]+$/.test(p.pathname))throw Error('Disposable loopback DB only');}
test('Domwork recognition, assistant ownership and Russian advertising; no real Telegram',{skip:!url},async t=>{
    const db=new Pool({connectionString:url}),now=new Date('2026-10-13T10:00:00Z'),today=policy.today(),month=today.slice(0,7);
    const rating={contact:5,speed:4,help:5,motivation:4,overall:5};
    const write=fn=>queue.transaction(db,fn);
    const settings=async data=>db.query('UPDATE domwork_bot_settings SET data=$1',[JSON.stringify(data)]);
    const baseTables=['users','hr_employees','students','leads','payment_records','main_attendance','assistant_attendance','json_data','domwork_learning_groups','domwork_bot_groups','domwork_bot_links'];
    const snapshot=async()=>Object.fromEntries(await Promise.all(baseTables.map(async table=>[table,(await db.query(`SELECT * FROM ${table} ORDER BY 1,2`)).rows])));
    const oldEnv=process.env.DOMWORK_BOT_ENABLED;process.env.DOMWORK_BOT_ENABLED='true';
    try {
        await db.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,phone TEXT);
            CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN,phone TEXT);
            CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
            CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,teacher_id TEXT,assistant_teacher_id TEXT,extra_data JSONB);
            CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,manager_id TEXT,language TEXT,status TEXT,deleted_at TIMESTAMPTZ,extra_data JSONB);
            CREATE TABLE main_attendance(att_key TEXT,student_id TEXT,day INT,present INT);
            CREATE TABLE assistant_attendance(att_key TEXT,student_id TEXT,day INT,present INT);
            CREATE TABLE json_data(key TEXT PRIMARY KEY,data JSONB);
            INSERT INTO users VALUES('admin','Admin','admin','admin','+998901111111'),('target','Target','target','targetolog','+998902222222'),
                ('teacher','Teacher','teacher','teacher','+998903333333'),('en-target','English target','en-target','targetolog','+998904444444');
            INSERT INTO hr_employees VALUES('t','Teacher','teacher','rus-oqituvchi','active','english',true,''),('a','Assistant','assistant','yordamchi','active','russian',false,''),
                ('target','Target','target','targetolog','active','russian',false,''),('en-target','English target','en-target','targetolog','active','english',false,''),
                ('m','Sales','sales','sotuv-menejeri','active','russian',false,''),('m2','Sales two','sales2','sotuv-menejeri','active','russian',false,''),
                ('en','English','english','ingliz-oqituvchi','active','english',false,'');
            INSERT INTO students VALUES('s','Student','+998905555555','russian','t','a','{"passwordHash":"hash","paidAmount":100}'),
                ('s2','Other student','+998906666666','russian','t','a','{"passwordHash":"hash","paidAmount":100}'),
                ('en','English student','+998907777777','english','en','a','{"passwordHash":"hash","paidAmount":100}'),
                ('dual','Dual-role student','+998908888888','russian','different','t','{"passwordHash":"hash","paidAmount":100}');
            INSERT INTO leads VALUES('l','Lead','','m','russian','tolov-yopildi',NULL,'{}');
            INSERT INTO assistant_attendance VALUES('2026-10_a','s',6,1),('2026-10_a','s2',6,1),('2026-10_t','dual',6,1);
            INSERT INTO main_attendance VALUES('2026-10_t','s',13,1),('2026-10_t','s2',13,1),('2026-10_en','en',13,1),('2026-02_t','s',31,1);
            INSERT INTO json_data VALUES('assistantWeeklyRatings','{"s":{"2026-09-28":{"overall":1}}}'),
                ('targetDailyAdSpend','{"2026-10":{"2026-10-13":{"budget":999}}}'),('targetMonitoringPlan','{"2026-10":{"budget":9999}}'),
                ('liveGrades','{"s":[{"date":"2026-10-13","teacherId":"t","studentRatingOfTeacher":{"overall":5}}],"en":[{"date":"2026-10-13","teacherId":"t","studentRatingOfTeacher":{"overall":1}}]}');`);
        await require('../server/services/inflow').initSchema(db);
        await require('../server/services/domworkGroups').initSchema(db);await store.initSchema(db);
        const before=await snapshot();
        await t.test('additive initialization preserves all existing sources and keeps new automations off',async()=>{
            const saved=await store.settings(db);await store.initSchema(db);
            assert.deepEqual(await snapshot(),before);assert.deepEqual(await store.settings(db),saved);
            for(const k of ['milestonesEnabled','dailyAwardsEnabled','weeklyAwardsEnabled','monthlyAwardsEnabled','employeeWelcomeEnabled','releaseNotesEnabled'])assert.ok(!saved.data[k]);
            await write(d=>recognition.release(d));assert.equal((await db.query('SELECT COUNT(*) FROM domwork_bot_events')).rows[0].count,'0');
        });
        await t.test('assistant rating requires authenticated active Russian student and exact completed-week attendance evidence',async()=>{
            await assert.rejects(write(d=>insights.rateAssistant(d,null,'2026-10-05',rating,now)),e=>e.status===401);
            await assert.rejects(write(d=>insights.rateAssistant(d,'en','2026-10-05',rating,now)),e=>e.status===403);
            await assert.rejects(write(d=>insights.rateAssistant(d,'s','2026-09-28',rating,now)),e=>e.status===400);
            await assert.rejects(write(d=>insights.rateAssistant(d,'s','2026-10-05',{...rating,help:'5'},now)),e=>e.status===400);
            await assert.rejects(write(d=>insights.rateAssistant(d,'s','2026-10-05',{...rating,overall:6},now)),e=>e.status===400);
            await db.query("INSERT INTO assistant_attendance VALUES('2026-10_t','s',7,1)");
            await assert.rejects(write(d=>insights.rateAssistant(d,'s','2026-10-05',rating,now)),e=>e.status===409);
            await db.query("DELETE FROM assistant_attendance WHERE att_key='2026-10_t' AND student_id='s'");
            assert.deepEqual(await write(d=>insights.rateAssistant(d,'s','2026-10-05',rating,now)),rating);
            assert.deepEqual(await insights.assistantHistory(db,'s'),{'2026-10-05':rating});
            await assert.rejects(write(d=>insights.rateAssistant(d,'s','2026-10-05',rating,now)),e=>e.status===409);
            assert.equal((await db.query("SELECT data FROM json_data WHERE key='assistantWeeklyRatings'")).rows[0].data.s['2026-09-28'].overall,1);
        });
        await t.test('assistant ownership remains historical when assignment changes; old anonymous ratings never migrate',async()=>{
            await db.query("UPDATE students SET assistant_teacher_id='t' WHERE id='s'");
            assert.ok((await insights.assistantRanking(db,'a')).includes('5.0'));assert.ok(!(await insights.assistantRanking(db,'t')).includes('5.0'));
            await db.query("UPDATE students SET assistant_teacher_id='a' WHERE id='s'");
            await db.query("UPDATE json_data SET data=data || '{\"s2\":{\"2026-10-05\":{\"overall\":2}}}'::jsonb WHERE key='assistantWeeklyRatings'");
            await assert.rejects(write(d=>insights.rateAssistant(d,'s2','2026-10-05',rating,now)),e=>e.status===409);
            await db.query("UPDATE json_data SET data=data-'s2' WHERE key='assistantWeeklyRatings'");
        });
        await t.test('concurrent duplicate ratings commit once and leave one audit record',async()=>{
            const results=await Promise.allSettled([write(d=>insights.rateAssistant(d,'s2','2026-10-05',rating,now)),write(d=>insights.rateAssistant(d,'s2','2026-10-05',rating,now))]);
            assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
            assert.equal((await db.query("SELECT COUNT(*) FROM domwork_insights_audit WHERE entity_id='s2:2026-10-05'")).rows[0].count,'1');
        });
        await t.test('explicit Russian main role overrides legacy English language without rewriting HR or misclassifying English teachers',async()=>{
            // 29-okt: asosiy ustoz yordamchi bo'la olmaydi — "dual_role" belgisi bo'lsa ham asosiy ustozni yordamchi sifatida baholab bo'lmaydi.
            await assert.rejects(write(d=>insights.rateAssistant(d,'dual','2026-10-05',rating,now)),e=>e.status===403);
            assert.ok(!(await insights.assistantRanking(db,'t')).includes('5.0'));
            assert.equal((await db.query("SELECT lang FROM hr_employees WHERE id='t'")).rows[0].lang,'english');
            assert.equal((await recognition.teachers(db,'2026-10-13','2026-10-13')).rows[0].id,'t');
        });
        await t.test('Russian ad entry has persisted RBAC, validation, atomic audit and stale-write prevention',async()=>{
            const body={kind:'day',date:'2026-10-13',revision:0,data:{budget:0,leadCount:2}};
            for(const id of ['teacher','en-target','absent'])await assert.rejects(write(d=>insights.saveMarketing(d,{id,role:'admin'},body)),e=>e.status===403);
            for(const data of [{budget:-1,leadCount:2},{budget:5,leadCount:1.5},{budget:'5',leadCount:2}])await assert.rejects(write(d=>insights.saveMarketing(d,{id:'target'},{...body,data})),e=>e.status===400);
            await write(d=>insights.saveMarketing(d,{id:'target'},body));
            await assert.rejects(write(d=>insights.saveMarketing(d,{id:'target'},body)),e=>e.status===409);
            const row=await insights.marketingMonth(db,{id:'admin'},'2026-10');assert.equal(row.days['2026-10-13'].budget,0);assert.equal(row.days['2026-10-13'].revision,1);
            await write(d=>insights.saveMarketing(d,{id:'admin'},{...body,revision:1,data:{budget:12,leadCount:2}}));
            await write(d=>insights.saveMarketing(d,{id:'admin'},{kind:'plan',date:'2026-10',revision:0,data:{budget:100,lidSoni:20,kvalLidSoni:15,kvalLidPct:75}}));
            const value=await insights.advertising(db,'2026-10-01','2026-10-31');assert.equal(value.total,12);assert.equal(value.plan.budget,100);assert.ok(value.known);
            assert.deepEqual((await db.query("SELECT data FROM json_data WHERE key='targetDailyAdSpend'")).rows[0].data,before.json_data.find(r=>r.key==='targetDailyAdSpend').data);
            const audits=(await db.query('SELECT COUNT(*) FROM domwork_insights_audit')).rows[0].count;
            await assert.rejects(write(async d=>{await insights.saveMarketing(d,{id:'admin'},{...body,revision:2,data:{budget:50,leadCount:2}});throw Error('rollback');}));
            assert.equal((await db.query('SELECT COUNT(*) FROM domwork_insights_audit')).rows[0].count,audits);
            assert.equal((await insights.advertising(db,'2026-10-01','2026-10-31')).total,12);
        });
        await t.test('unscoped historical advertising is not a Russian CPL or plan',async()=>{
            const value=await insights.advertising(db,'2026-09-01','2026-09-30');assert.equal(value.known,false);assert.equal(value.plan,null);
        });
        await t.test('teacher recognition excludes English, invalid dates, conflicts and ambiguous ownership; ratings are exact-owner/date',async()=>{
            let result=await recognition.summary(db,'lessons','2026-10-13','2026-10-13','Teacher');
            assert.equal(result.winners[0].id,'t');assert.equal(result.winners[0].value,2);assert.equal(result.winners[0].rating,5);
            await db.query("INSERT INTO main_attendance VALUES('2026-10_t','s',13,0)");
            result=await recognition.summary(db,'lessons','2026-10-13','2026-10-13','Teacher');assert.equal(result.winners[0].value,1);
            await db.query("DELETE FROM main_attendance WHERE student_id='s' AND present=0");
            assert.deepEqual(recognition.winners([{id:'x',value:2,rating:4},{id:'y',value:2,rating:4}]).map(r=>r.id),['x','y']);
        });
        const receipt=async(id,amount,manager='m',date=today)=>db.query(`INSERT INTO payment_records(id,source_key,lead_id,language,manager_id,paid_date,amount,method,form,snapshot,actor_id)
            VALUES($1,$1,'l','russian',$3,$4,$2,'card','full','{"managerName":"Sales","name":"Student"}','admin')`,[id,amount,manager,date]);
        await t.test('sales recognition uses receipt date and manager, nets refunds, and suppresses uncertain financial awards',async()=>{
            await receipt('old',19000000);await receipt('new',1000000);
            let value=await recognition.summary(db,'sales',month+'-01',today,'Sales');assert.equal(value.winners[0].value,20000000);
            await db.query("INSERT INTO json_data VALUES('cashFlow',$1)",[JSON.stringify([{id:'r',type:'chiqim',purpose:'Refund',language:'russian',managerId:'m',date:today,amount:1000000}])]);
            value=await recognition.summary(db,'sales',month+'-01',today,'Sales');assert.equal(value.winners[0].value,19000000);
            await db.query("UPDATE json_data SET data=$1 WHERE key='cashFlow'",[JSON.stringify([{id:'r',type:'chiqim',purpose:'Refund',date:today,amount:1000000}])]);
            assert.equal((await recognition.summary(db,'sales',month+'-01',today,'Sales')).winners.length,0);
            await db.query("DELETE FROM json_data WHERE key='cashFlow'");
        });
        const enabled={eventsEnabled:true,groupNotificationsEnabled:true,milestonesEnabled:true,employeeWelcomeEnabled:true,releaseNotesEnabled:true};
        await t.test('milestones require opt-in, a new receipt crossing net turnover, and current accounting month',async()=>{
            const payment={id:'new',language:'russian',manager_id:'m',paid_date:today};
            assert.deepEqual(await recognition.milestones(db,payment),[]);
            await settings(enabled);assert.deepEqual(await recognition.milestones(db,payment),[20000000]);
            assert.deepEqual(await recognition.milestones(db,{...payment,paid_date:'2000-01-01'}),[]);
            await db.query("INSERT INTO domwork_bot_groups(id,type,scope,chat_id,active,created_by,title) VALUES('sales-group','sales','','-100111111',true,'admin','Sales'),('family','family','','-100222222',true,'admin','Family'),('teachers','teachers','','-100333333',true,'admin','Teachers')");
            await write(d=>events.payment(d,'new'));await write(d=>events.processOne(d));
            await write(d=>events.capture(d,'payment','new',{month,milestones:[20000000]},'duplicate-payment'));await write(d=>events.processOne(d));
            assert.equal((await db.query("SELECT COUNT(*) FROM domwork_bot_outbox WHERE unique_key LIKE 'milestone:%'")).rows[0].count,'1');
            assert.equal((await db.query("SELECT COUNT(*) FROM domwork_bot_jobs WHERE key LIKE 'milestone:%'")).rows[0].count,'1');
        });
        await t.test('daily/weekly/monthly winners are opt-in, criterion-required, idempotent and tied winners explicit',async()=>{
            assert.throws(()=>controls.settingsInput({weeklyAwardsEnabled:true},{}),e=>e.status===400);
            assert.throws(()=>controls.settingsInput({weeklyAwardCriterion:'random'},{}),e=>e.status===400);
            assert.equal(controls.settingsInput({weeklyAwardsEnabled:true,weeklyAwardCriterion:'sales'},{}).weeklyAwardsEnabled,true);
            const n=(await db.query('SELECT COUNT(*) FROM domwork_bot_outbox')).rows[0].count;
            await write(d=>scheduler.run(d,new Date('2026-10-13T15:00:00Z')));assert.equal((await db.query('SELECT COUNT(*) FROM domwork_bot_outbox')).rows[0].count,n);
            await settings({...enabled,dailyAwardsEnabled:true});
            await write(d=>scheduler.run(d,new Date('2026-10-13T15:00:00Z')));
            const after=(await db.query('SELECT COUNT(*) FROM domwork_bot_outbox')).rows[0].count;
            await write(d=>scheduler.run(d,new Date('2026-10-13T15:01:00Z')));assert.equal((await db.query('SELECT COUNT(*) FROM domwork_bot_outbox')).rows[0].count,after);
            await settings({...enabled,weeklyAwardsEnabled:true,weeklyAwardCriterion:'lessons',monthlyAwardsEnabled:true,monthlyAwardCriterion:'lessons'});
            await write(d=>scheduler.run(d,new Date('2026-10-18T15:00:00Z')));
            await write(d=>scheduler.run(d,new Date('2026-10-31T15:00:00Z')));
            assert.equal((await db.query("SELECT COUNT(*) FROM domwork_bot_outbox WHERE unique_key LIKE 'weekly-awards:%' OR unique_key LIKE 'monthly-awards:%'")).rows[0].count,'2');
        });
        await t.test('new employee events and releases are opt-in and never bootstrap/replay old records',async()=>{
            await settings(enabled);
            await write(d=>recognition.release(d));assert.equal((await db.query("SELECT COUNT(*) FROM domwork_bot_events WHERE type='release'")).rows[0].count,'0');
            await write(d=>events.capture(d,'employee','t',{},'test-new-employee'));await write(d=>events.processOne(d));
            assert.equal((await db.query("SELECT COUNT(*) FROM domwork_bot_outbox WHERE unique_key='event:test-new-employee:family:family'")).rows[0].count,'1');
            await settings({});await write(d=>events.capture(d,'employee','t',{},'test-disabled'));await write(d=>events.processOne(d));await settings(enabled);
            await write(d=>events.processOne(d));assert.equal((await db.query("SELECT COUNT(*) FROM domwork_bot_outbox WHERE unique_key LIKE 'event:test-disabled%'")).rows[0].count,'0');
        });
        await t.test('marketing HTTP uses real stored permissions, keeps stale writes out, and read-only awards preview queues nothing',async()=>{
            const app=express();app.use(express.json());const auth=(req,res,next)=>{if(!req.get('X-Test-User'))return res.sendStatus(401);req.user={id:req.get('X-Test-User'),role:'admin'};next();};
            app.use('/marketing',require('../server/routes/domworkMarketing')({pool:db,authRequired:auth}));
            app.use('/bot',require('../server/routes/domworkBot')({pool:db,runtime:{},authRequired:auth}));
            const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
            try {
                const base='http://127.0.0.1:'+server.address().port;
                assert.equal((await fetch(base+'/marketing?month=2026-10')).status,401);
                assert.equal((await fetch(base+'/marketing?month=2026-10',{headers:{'X-Test-User':'teacher'}})).status,403);
                assert.equal((await fetch(base+'/marketing?month=2026-10',{headers:{'X-Test-User':'target'}})).status,200);
                assert.equal((await fetch(base+'/bot/awards/preview',{headers:{'X-Test-User':'teacher'}})).status,403);
                const n=(await db.query('SELECT COUNT(*) FROM domwork_bot_outbox')).rows[0].count;
                assert.equal((await fetch(base+'/bot/awards/preview',{headers:{'X-Test-User':'admin'}})).status,200);
                assert.equal((await db.query('SELECT COUNT(*) FROM domwork_bot_outbox')).rows[0].count,n);
            } finally {await new Promise(resolve=>server.close(resolve));}
        });
        await t.test('delivery revalidates revoked flags and changed winner; transport mocked',async()=>{
            await db.query("UPDATE domwork_bot_outbox SET state='cancelled' WHERE state='pending'");
            const calls=[];
            const runtime=require('../server/services/domworkBot/runtime').createRuntime({pool:db,crm:{},autoTick:false,
                env:{DOMWORK_BOT_ENABLED:'true',DOMWORK_BOT_TOKEN:'123456789:'+'a'.repeat(35),DOMWORK_BOT_WEBHOOK_SECRET:'x'.repeat(40),REDIS_URL:'redis://127.0.0.1:6379'},
                redisFactory:()=>({isReady:true,isOpen:true,on(){},async connect(){},async destroy(){},async eval(){return 1;}}),
                telegramFactory:()=>({async callApi(method,payload){calls.push({method,payload});return method==='getMe'?{id:999,is_bot:true,username:'Domworkuz_bot'}:method==='getChatMember'?{status:'administrator'}:true;}})});
            await runtime.start();assert.equal(runtime.status().state,'ready');
            try {
                await settings({});await store.enqueue(db,{key:'flag-revoked',targetKind:'group',targetId:'-100111111',payload:{text:'fixture',_automation:true,_setting:'milestonesEnabled',_settings:['eventsEnabled'],_binding:'sales-group'}});
                await runtime.deliverOne();assert.equal((await db.query("SELECT state FROM domwork_bot_outbox WHERE unique_key='flag-revoked'")).rows[0].state,'cancelled');
                await settings({...enabled,dailyAwardsEnabled:true});
                await store.enqueue(db,{key:'winner-changed',targetKind:'group',targetId:'-100333333',payload:{text:'fixture',_automation:true,_setting:'dailyAwardsEnabled',_binding:'teachers',_award:{criterion:'lessons',start:'2026-10-13',end:'2026-10-13',winners:[{id:'t',value:99}]}}});
                await runtime.deliverOne();assert.equal((await db.query("SELECT state FROM domwork_bot_outbox WHERE unique_key='winner-changed'")).rows[0].state,'cancelled');
                await store.enqueue(db,{key:'valid-new-feature',targetKind:'group',targetId:'-100111111',payload:{chat_id:'-100111111',text:'fixture',_automation:true,_setting:'milestonesEnabled',_settings:['eventsEnabled'],_binding:'sales-group',_milestone:{managerId:'m',month,threshold:20000000}}});
                await runtime.deliverOne();assert.equal(calls.filter(c=>c.method==='sendMessage').length,1);
            }finally{await runtime.stop();}
        });
        await t.test('all original learning, HR, student and legacy data remain byte-for-byte unchanged',async()=>{
            const after=await snapshot();
            for(const table of ['users','hr_employees','students','leads','main_attendance','assistant_attendance','json_data','domwork_learning_groups','domwork_bot_links'])assert.deepEqual(after[table],before[table],table);
        });
    } finally {if(oldEnv==null)delete process.env.DOMWORK_BOT_ENABLED;else process.env.DOMWORK_BOT_ENABLED=oldEnv;await db.end();}
});
