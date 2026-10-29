const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const express = require('express');
const store = require('../server/services/domworkBot/store');
const groups = require('../server/services/domworkGroups');
const queue = require('../server/services/domworkBot/queue');
const { createHandler } = require('../server/services/domworkBot/handlers');
    const { createRuntime } = require('../server/services/domworkBot/runtime');
const createRouter = require('../server/routes/domworkBot');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url) {
    const parsed = new URL(url);
    if (parsed.hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(parsed.pathname)) throw Error('Only disposable loopback DBs');
}
test('Domwork bot on disposable PostgreSQL (no real Telegram or Redis)', {skip: !url}, async t => {
    const pool = new Pool({connectionString:url});
    const contact=(id,phone)=>({from:{id},chat:{id,type:'private'},contact:{user_id:id,phone_number:phone}});
    const msg=(id,text,extra={})=>({from:{id},chat:{id,type:'private'},text,...extra});
    const calls=[], reads=[];
    const crm={async getDemoStudentGrades(id){reads.push(id);return {grades:[{date:'2026-10-11',score:90}]};},async getStudentContractPdf(id){reads.push(id);return {buffer:Buffer.from('fixture'),filename:'fixture.pdf'};},
        botTrialAction:(db,actor,id,payload)=>require('../server/services/trialLessons').updateTrialLesson(db,actor,id,payload,
            r=>({...r.extra_data,id:r.id,name:r.name,status:r.status,language:r.language,comments:r.comments || []}),
            (db,id,action,actor,snapshot)=>store.audit(db,actor.id,action,id,snapshot))};
    const handler=createHandler({crm});
    let runtime;
    try {
        await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,phone TEXT);
            CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN,phone TEXT DEFAULT '');
            CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
            CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,extra_data JSONB,teacher_id TEXT);
            CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,language TEXT,status TEXT,deleted_at TIMESTAMPTZ);
            INSERT INTO users VALUES('a','Admin','admin','admin','+998901111111'),('t','Teacher','teacher','teacher','+998902222222'),
                ('coincidence','Unrelated','owner998907777777@example.invalid','admin','');
            INSERT INTO hr_employees(id,name,login,role,status,lang,dual_role) VALUES('he','Teacher','teacher','rus-oqituvchi','active','russian',true);
            INSERT INTO students VALUES('s','Student','+998903333333','russian','{"passwordHash":"hash","paidAmount":100}','he'),
                ('en','English','+998904444444','english','{"passwordHash":"hash","paidAmount":100}','he'),
                ('unpaid','Unpaid','+998905555555','russian','{"passwordHash":"hash","paidAmount":0}','he');
            INSERT INTO leads VALUES('lead','Trial','+998906666666','russian','sinov-darsida',NULL);`);
        const studentsBefore=(await pool.query('SELECT * FROM students ORDER BY id')).rows;
        await t.test('additive migrations repeat safely, all broadcasts off by default', async()=>{
            await groups.initSchema(pool);await store.initSchema(pool);await store.initSchema(pool);
            const data=(await store.settings(pool)).data;
            assert.equal(data.promotionsEnabled,false);assert.equal(data.groupNotificationsEnabled,false);assert.equal(data.promotionIntervalMinutes,1440);
        });
        await t.test('own contact authenticates admin, teacher, paid student and trial only',async()=>{
            for(const [id,phone,role] of [[100,'+998901111111','admin'],[101,'+998902222222','teacher'],[102,'+998903333333','student'],[103,'+998906666666','trial']]) {
                const own=await queue.transaction(pool,db=>store.linkContact(db,contact(id,phone)));assert.equal(own.role,role);
            }
            for(const phone of ['+998904444444','+998905555555','+998907777777']) await assert.rejects(queue.transaction(pool,db=>store.linkContact(db,contact(104,phone))),e=>e.status===404);
            await assert.rejects(queue.transaction(pool,db=>store.linkContact(db,contact(200,'+998903333333'))),e=>e.status===409);
            await assert.rejects(queue.transaction(pool,db=>store.linkContact(db,{...contact(200,'+998903333333'),contact:{user_id:102,phone_number:'+998903333333'}})),e=>e.status===400);
        });
        await t.test('durable receipt acknowledges duplicates without duplicate actions',async()=>{
            assert.equal((await queue.receive(pool,{update_id:1,message:msg(102,'📊 Natijalari & Baholari')})).duplicate,false);
            assert.equal((await queue.receive(pool,{update_id:1,message:msg(102,'forged replacement')})).duplicate,true);
            await Promise.all([queue.processOne(pool,handler),queue.processOne(pool,handler)]);
            assert.deepEqual(reads,['s']);
            assert.equal((await pool.query('SELECT count(*) FROM domwork_bot_outbox')).rows[0].count,'1');
            assert.deepEqual((await pool.query('SELECT payload FROM domwork_bot_updates WHERE update_id=1')).rows[0].payload,{});
        });
        await t.test('handler failure rolls back session and outbox before retry',async()=>{
            await queue.receive(pool,{update_id:2,message:msg(102,'x')});
            await queue.processOne(pool,async db=>{await store.setSession(db,'102',{secret:'fixture'});await store.enqueue(db,{key:'rolled-back',targetId:'102',payload:{text:'not sent'}});throw Error('fixture');});
            assert.equal(await store.session(pool,'102'),null);
            assert.equal((await pool.query("SELECT count(*) FROM domwork_bot_outbox WHERE unique_key='rolled-back'")).rows[0].count,'0');
            assert.equal((await pool.query('SELECT state FROM domwork_bot_updates WHERE update_id=2')).rows[0].state,'pending');
            await pool.query("UPDATE domwork_bot_updates SET state='failed' WHERE update_id=2");
        });
        await t.test('teacher cannot request student finance or admin broadcast by typing its label',async()=>{
            const n=reads.length;await queue.receive(pool,{update_id:3,message:msg(101,'💳 Mening to‘lovim')});await queue.processOne(pool,handler);
            assert.equal(reads.length,n);
            const reply=(await pool.query("SELECT payload FROM domwork_bot_outbox WHERE unique_key='u:3:r:0'")).rows[0].payload;
            assert.ok(reply.text.includes('Menyudan'));assert.equal(reply._account.id,'t');
        });
        await t.test('revocation is immediate, not trusted from old role or Redis cache',async()=>{
            await pool.query("UPDATE users SET role='employee' WHERE id='t'");assert.equal(await store.identity(pool,'101'),null);
            await pool.query("UPDATE users SET role='teacher' WHERE id='t'");
            await pool.query("UPDATE hr_employees SET status='inactive' WHERE id='he'");assert.equal(await store.identity(pool,'101'),null);
            await pool.query("UPDATE hr_employees SET status='active' WHERE id='he'");
        });
        await t.test('worker uses mocked transport; delivery rechecks account and wipes sent content',async()=>{
            const fakeRedis=()=>({isReady:true,isOpen:true,on(){},async connect(){},async destroy(){this.isOpen=false;},async eval(){return 1;}});
            runtime=createRuntime({pool,crm,autoTick:false,redisFactory:fakeRedis,telegramFactory:()=>({async callApi(method,payload){calls.push({method,payload});return method==='getMe'?{id:999,username:'Domworkuz_bot',is_bot:true}:true;}}),
                env:{DOMWORK_BOT_ENABLED:'true',DOMWORK_BOT_TOKEN:'123456789:'+'a'.repeat(35),DOMWORK_BOT_WEBHOOK_SECRET:'x'.repeat(40),REDIS_URL:'redis://127.0.0.1:6379'}});
            await runtime.start();assert.equal(runtime.status().state,'ready');
            assert.equal(await runtime.healthy(),false); // webhook o'rnatilmagan — majburiy oyna chiqmaydi
            await runtime.deliverOne();assert.equal(calls.filter(c=>c.method==='sendMessage').length,1);
            const sent=(await pool.query("SELECT state,payload FROM domwork_bot_outbox WHERE unique_key='u:1:r:0'")).rows[0];assert.equal(sent.state,'sent');assert.deepEqual(sent.payload,{});
            await pool.query("UPDATE users SET role='employee' WHERE id='t'");await runtime.deliverOne();
            assert.equal((await pool.query("SELECT state FROM domwork_bot_outbox WHERE unique_key='u:3:r:0'")).rows[0].state,'cancelled');
            await pool.query("UPDATE users SET role='teacher' WHERE id='t'");
        });
        await t.test('unknown transport outcomes never automatically resend',async()=>{
            await store.enqueue(pool,{key:'ambiguous',targetId:'102',role:'student',account:{kind:'student',id:'s'},payload:{chat_id:'102',text:'fixture'}});
            const row=await queue.claimOutbox(pool);assert.equal(row.unique_key,'ambiguous');
            await pool.query("UPDATE domwork_bot_outbox SET lease_until=NOW()-INTERVAL '1 second' WHERE id=$1",[row.id]);
            assert.equal(await queue.claimOutbox(pool),null);
            assert.equal((await pool.query('SELECT state FROM domwork_bot_outbox WHERE id=$1',[row.id])).rows[0].state,'uncertain');
        });
        await t.test('private data and menu never leak into group messages',async()=>{
            const n=calls.length;await queue.receive(pool,{update_id:4,message:{...msg(102,'🔑 Login & Parol'),chat:{id:-100,type:'supergroup'}}});await queue.processOne(pool,handler);
            assert.equal((await pool.query("SELECT count(*) FROM domwork_bot_outbox WHERE unique_key LIKE 'u:4:%'")).rows[0].count,'0');assert.equal(calls.length,n);
        });
        await t.test('membership observation never guesses teacher binding from title',async()=>{
            await queue.receive(pool,{update_id:5,my_chat_member:{chat:{id:-10012345,type:'supergroup',title:'Sinov darsi | Teacher'},new_chat_member:{status:'administrator'}}});await queue.processOne(pool,handler);
            assert.equal((await pool.query('SELECT count(*) FROM domwork_bot_seen_chats')).rows[0].count,'1');
            assert.equal((await pool.query('SELECT count(*) FROM domwork_learning_groups')).rows[0].count,'0');
        });
        await t.test('real HTTP route validates secret and stored admin role, not claimed role',async()=>{
            const app=express();app.use(express.json());
            app.use('/bot',createRouter({pool,runtime,authRequired:(req,res,next)=>{if(!req.get('X-Test-User'))return res.sendStatus(401);req.user={id:req.get('X-Test-User'),role:'admin'};next();}}));
            const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
            try {
                const base=`http://127.0.0.1:${server.address().port}/bot`;
                assert.equal((await fetch(base+'/status')).status,401);
                assert.equal((await fetch(base+'/status',{headers:{'X-Test-User':'t'}})).status,403);
                const good=await fetch(base+'/status',{headers:{'X-Test-User':'a'}});assert.equal(good.status,200);assert.equal(good.headers.get('cache-control'),'no-store');
                assert.equal((await fetch(base+'/my-telegram-link')).status,401);
                assert.equal((await fetch(base+'/my-telegram-link',{headers:{'X-Test-User':'t'}})).status,403);
                const own=await fetch(base+'/my-telegram-link',{headers:{'X-Test-User':'a'}});
                assert.equal(own.status,200);assert.equal(own.headers.get('cache-control'),'no-store');
                assert.equal((await own.json()).link.telegram_id,'100');
                assert.equal((await fetch(base+'/my-telegram-link/unlink',{method:'POST',headers:{'Content-Type':'application/json','X-Test-User':'t'},body:'{}'})).status,403);
                assert.equal((await fetch(base+'/my-telegram-link/unlink',{method:'POST',headers:{'Content-Type':'application/json','X-Test-User':'a'},body:'{}'})).status,409);
                assert.equal((await store.ownAdminLink(pool,{id:'a'})).link.telegram_id,'100');
                const body=JSON.stringify({update_id:6,message:msg(102,'/menu')});
                assert.equal((await fetch(base+'/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body})).status,401);
                assert.equal((await fetch(base+'/webhook',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':'x'.repeat(40)},body})).status,200);
            } finally {await new Promise(resolve=>server.close(resolve));}
        });
        await t.test('all old student data remain unchanged',async()=>{assert.deepEqual((await pool.query('SELECT * FROM students ORDER BY id')).rows,studentsBefore);});
        await pool.query(`ALTER TABLE leads ADD COLUMN extra_data JSONB NOT NULL DEFAULT '{}'; ALTER TABLE leads ADD COLUMN comments JSONB NOT NULL DEFAULT '[]';
            ALTER TABLE leads ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(); ALTER TABLE leads ADD COLUMN manager_id TEXT;
            UPDATE leads SET extra_data='{"paymentOnboarding":{"teacherId":"he"},"trialLessonAt":"2026-10-12T10:00:00+05:00","trialRequest":{"id":"r1","teacherId":"he","scheduledAt":"2026-10-12T10:00:00+05:00","daysCount":1,"state":"pending"},"custom":"keep"}',comments='[{"text":"Manager note"}]' WHERE id='lead';`);
        const controls=require('../server/services/domworkBot/controls');
        const callbackUpdate=(updateId,user,data,chat={id:user,type:'private'})=>({update_id:updateId,callback_query:{id:'cb'+updateId,from:{id:user},data,message:{chat,message_id:1}}});
        await t.test('admin settings require current role and exact revision, audit changes atomically',async()=>{
            const current=await store.settings(pool);
            await assert.rejects(queue.transaction(pool,db=>controls.saveSettings(db,{id:'t'},{revision:current.revision,eventsEnabled:true})),e=>e.status===403);
            await queue.transaction(pool,db=>controls.saveSettings(db,{id:'a'},{revision:current.revision,eventsEnabled:true}));
            await assert.rejects(queue.transaction(pool,db=>controls.saveSettings(db,{id:'a'},{revision:current.revision,eventsEnabled:false})),e=>e.status===409);
            assert.equal((await store.settings(pool)).data.eventsEnabled,true);
        });
        await t.test('teacher callbacks use exact assignment/request, preserve comments/custom fields and duplicate acceptance is safe',async()=>{
            const data=await store.callback(pool,{type:'trial',leadId:'lead',requestId:'r1',teacherId:'he',action:'accept'});
            await queue.transaction(pool,db=>handler(db,callbackUpdate(10,102,data)));
            assert.equal((await pool.query("SELECT extra_data FROM leads WHERE id='lead'")).rows[0].extra_data.trialRequest.state,'pending');
            await queue.transaction(pool,db=>handler(db,callbackUpdate(11,101,data)));
            await queue.transaction(pool,db=>handler(db,callbackUpdate(12,101,data)));
            const row=(await pool.query("SELECT extra_data,comments FROM leads WHERE id='lead'")).rows[0];
            assert.equal(row.extra_data.custom,'keep');assert.equal(row.extra_data.trialRequest.state,'accepted');assert.equal(row.comments.length,2);assert.equal(row.comments[0].text,'Manager note');
        });
        await t.test('stale trial callback and non-Mayoq group cannot mutate a lead',async()=>{
            const stale=await store.callback(pool,{type:'trial',leadId:'lead',requestId:'old',teacherId:'he',action:'outcome',attended:true});
            await queue.transaction(pool,db=>handler(db,callbackUpdate(13,101,stale)));
            const good=await store.callback(pool,{type:'trial',leadId:'lead',requestId:'r1',teacherId:'he',action:'outcome',attended:true});
            await queue.transaction(pool,db=>handler(db,callbackUpdate(14,101,good,{id:-10099999,type:'supergroup'})));
            assert.equal((await pool.query("SELECT extra_data FROM leads WHERE id='lead'")).rows[0].extra_data.trialRequest.state,'accepted');
            await queue.transaction(pool,db=>handler(db,callbackUpdate(15,101,good)));
            assert.equal((await pool.query("SELECT extra_data FROM leads WHERE id='lead'")).rows[0].extra_data.trialRequest.attended,true);
        });
        await t.test('broadcast preview freezes verified audience; confirmation requires owner and hash; retries create one row per account',async()=>{
            const preview=await queue.transaction(pool,db=>controls.draft(db,{id:'a'},{segment:'student',content:{text:'Safe fixture'}}));
            assert.equal(preview.count,1);
            assert.equal((await pool.query("SELECT count(*) FROM domwork_bot_outbox WHERE payload->>'_broadcast'=$1",[preview.id])).rows[0].count,'0');
            await assert.rejects(queue.transaction(pool,db=>controls.confirmBroadcast(db,{id:'t'},preview.id,preview.fingerprint)),e=>e.status===403);
            await assert.rejects(queue.transaction(pool,db=>controls.confirmBroadcast(db,{id:'a'},preview.id,'forged')),e=>e.status===409);
            await queue.transaction(pool,db=>controls.confirmBroadcast(db,{id:'a'},preview.id,preview.fingerprint));
            await queue.transaction(pool,db=>controls.confirmBroadcast(db,{id:'a'},preview.id,preview.fingerprint));
            assert.equal((await pool.query("SELECT count(*) FROM domwork_bot_outbox WHERE payload->>'_broadcast'=$1",[preview.id])).rows[0].count,'1');
            await queue.transaction(pool,db=>controls.confirmBroadcast(db,{id:'a'},preview.id,preview.fingerprint,true));
            assert.equal((await pool.query('SELECT state FROM domwork_bot_broadcasts WHERE id=$1',[preview.id])).rows[0].state,'cancelled');
        });
        await t.test('paused identities and English/unpaid accounts do not enter broadcasts',async()=>{
            await pool.query("UPDATE domwork_bot_links SET paused=true WHERE telegram_id='102'");
            await assert.rejects(queue.transaction(pool,db=>controls.draft(db,{id:'a'},{segment:'student',content:{text:'Not queued'}})),e=>e.status===409);
            await pool.query("UPDATE domwork_bot_links SET paused=false WHERE telegram_id='102'");
        });
        await t.test('leave review is admin-only, final decision immutable, author notified exactly once',async()=>{
            await pool.query("INSERT INTO domwork_bot_leave_requests(id,employee_id,user_id,reason,start_date,end_date) VALUES('l1','he','t','Fixture','2026-10-12','2026-10-13')");
            await assert.rejects(queue.transaction(pool,db=>controls.reviewLeave(db,{id:'t'},'l1','approved')),e=>e.status===403);
            await queue.transaction(pool,db=>controls.reviewLeave(db,{id:'a'},'l1','approved'));
            await queue.transaction(pool,db=>controls.reviewLeave(db,{id:'a'},'l1','approved'));
            await assert.rejects(queue.transaction(pool,db=>controls.reviewLeave(db,{id:'a'},'l1','rejected')),e=>e.status===409);
            assert.equal((await pool.query("SELECT count(*) FROM domwork_bot_outbox WHERE unique_key='leave:l1:approved'")).rows[0].count,'1');
        });
        await t.test('operational bindings are explicit, verified and revision-safe',async()=>{
            await queue.transaction(pool,db=>controls.saveBinding(db,{id:'a'},{type:'beacon',chatId:'-10022222',active:true,revision:0},{chatId:'-10022222',title:'Mayoq Fixture'}));
            await assert.rejects(queue.transaction(pool,db=>controls.saveBinding(db,{id:'a'},{type:'beacon',chatId:'-10033333',active:true,revision:0},{chatId:'-10033333',title:'Other'})),e=>e.status===409);
            assert.equal((await pool.query("SELECT chat_id FROM domwork_bot_groups WHERE type='beacon'")).rows[0].chat_id,'-10022222');
        });
        await t.test('scheduled jobs are idempotent across workers and roll back with their outbox',async()=>{
            const scheduler=require('../server/services/domworkBot/scheduler');let executions=0;
            for(let n=0;n<2;n++)await queue.transaction(pool,db=>scheduler.once(db,'fixture-job',async()=>{executions++;}));
            assert.equal(executions,1);
            await assert.rejects(queue.transaction(pool,db=>scheduler.once(db,'failed-job',async()=>{throw Error('fixture');})));
            assert.equal((await pool.query("SELECT count(*) FROM domwork_bot_jobs WHERE key='failed-job'")).rows[0].count,'0');
        });
        await t.test('all eight roles authenticate from current CRM records; explicit sales identity link wins over login coincidence',async()=>{
            for(const [id,userRole,hrRole,expected,phone] of [['rop','rop','rop','rop','998900000201'],['sales','sales_manager','sotuv-menejeri','sales','998900000202'],['marketing','targetolog','targetolog','marketing','998900000203'],['assistant','teacher','yordamchi','assistant','998900000204']]) {
                await pool.query('INSERT INTO users VALUES($1,$1,$2,$3,$4)',[id,id+'-login',userRole,phone]);
                await pool.query('INSERT INTO hr_employees(id,name,login,role,status,lang,phone) VALUES($1,$1,$2,$3,\'active\',\'russian\',$4)',['hr-'+id,id==='sales'?'different-login':id+'-login',hrRole,phone]);
                if(id==='sales')await pool.query("INSERT INTO user_sales_manager_links VALUES('sales','hr-sales')");
                const identity=await queue.transaction(pool,db=>store.linkContact(db,contact(Number(phone.slice(-3))+1000,phone)));
                assert.equal(identity.role,expected);assert.equal(identity.employeeId,'hr-'+id);
                assert.equal((await store.identity(pool,identity.telegramId)).role,expected);
            }
        });
        await t.test('Redis FSM mirrors only committed session changes, never failed handlers or transactions',async()=>{
            const mirrors=[];const fake={session:async(id,value)=>mirrors.push({id,value})};
            await queue.transaction(pool,async db=>{db.domworkRedis=fake;await store.setSession(db,'100',{step:'committed'});assert.equal(mirrors.length,0);});
            assert.equal(mirrors.length,1);assert.equal(mirrors[0].value.step,'committed');
            await assert.rejects(queue.transaction(pool,async db=>{db.domworkRedis=fake;await store.setSession(db,'100',{step:'rollback'});throw Error('fixture');}));
            await queue.receive(pool,{update_id:500,message:msg(100,'fixture')});
            await queue.processOne(pool,async db=>{db.domworkRedis=fake;await store.setSession(db,'100',{step:'savepoint-rollback'});throw Error('fixture');});
            assert.equal(mirrors.length,1);assert.equal((await store.session(pool,'100')).step,'committed');
        });
        await t.test('a chat cannot become both a learning and an operational group, in either order',async()=>{
            const body={type:'trial',name:'Conflict fixture',teacherId:'he',inviteLink:'https://t.me/+fixture12345',chatId:'-10022222',isDefault:true};
            await assert.rejects(groups.save(pool,{id:'a'},null,body),e=>e.status===409);
            const learning=await groups.save(pool,{id:'a'},null,{...body,chatId:'-10077777'});
            await assert.rejects(queue.transaction(pool,db=>controls.saveBinding(db,{id:'a'},{type:'sales',chatId:'-10077777',active:true,revision:0},{chatId:'-10077777',title:'Not sales'})),e=>e.status===409);
            assert.equal((await pool.query('SELECT id FROM domwork_learning_groups WHERE id=$1',[learning.id])).rows.length,1);
        });
        await t.test('changed schedules cancel pending reminders instead of sending obsolete lesson times',async()=>{
            await pool.query("ALTER TABLE students ADD COLUMN lesson_day_of_week INTEGER; ALTER TABLE students ADD COLUMN lesson_time TEXT; UPDATE students SET lesson_day_of_week=1,lesson_time='10:00' WHERE id='s'");
            await pool.query("UPDATE domwork_bot_outbox SET state='cancelled',payload='{}' WHERE state='pending'");
            await store.enqueue(pool,{key:'obsolete-schedule',targetId:'102',role:'student',account:{kind:'student',id:'s'},payload:{chat_id:'102',text:'Must not send',_automation:true,_schedule:{studentId:'s',at:'2026-10-12T06:00:00.000Z'}}});
            const count=calls.filter(c=>c.method==='sendMessage').length;
            await runtime.deliverOne();assert.equal(calls.filter(c=>c.method==='sendMessage').length,count);
            assert.equal((await pool.query("SELECT state FROM domwork_bot_outbox WHERE unique_key='obsolete-schedule'")).rows[0].state,'cancelled');
        });
        await t.test('actual scheduler creates one reminder per checkpoint and ignores future-start students',async()=>{
            const scheduler=require('../server/services/domworkBot/scheduler');
            await pool.query("ALTER TABLE students ADD COLUMN assistant_teacher_id TEXT; ALTER TABLE students ADD COLUMN lesson_duration INTEGER; CREATE TABLE main_attendance(att_key TEXT,student_id TEXT,day INTEGER,present INTEGER)");
            await pool.query("UPDATE domwork_bot_settings SET data=data || '{\"remindersEnabled\":true}'::jsonb");
            const now=new Date('2026-10-12T04:45:00Z');
            await queue.transaction(pool,db=>scheduler.run(db,now));
            await queue.transaction(pool,db=>scheduler.run(db,now));
            assert.equal((await pool.query("SELECT count(*) FROM domwork_bot_outbox WHERE unique_key='reminder:s:2026-10-12T05:00:00.000Z:15'")).rows[0].count,'1');
            await pool.query("UPDATE students SET extra_data=extra_data || '{\"startDate\":\"2026-12-01\"}'::jsonb WHERE id='s'");
            await queue.transaction(pool,db=>scheduler.run(db,new Date('2026-10-14T04:45:00Z')));
            assert.equal((await pool.query("SELECT count(*) FROM domwork_bot_outbox WHERE unique_key LIKE 'reminder:s:2026-10-14%'")).rows[0].count,'0');
            await pool.query("UPDATE students SET extra_data=extra_data-'startDate' WHERE id='s'");
        });
        await t.test('CRM events roll back with source changes; corrected attendance cancels stale absence notice',async()=>{
            const events=require('../server/services/domworkBot/events'),policy=require('../server/services/domworkBot/policy');
            const original=process.env.DOMWORK_BOT_ENABLED;process.env.DOMWORK_BOT_ENABLED='true';
            try {
                await assert.rejects(queue.transaction(pool,async db=>{await events.capture(db,'assignment','s',{},'rolled-back-event');throw Error('fixture');}));
                assert.equal((await pool.query("SELECT count(*) FROM domwork_bot_events WHERE event_key='rolled-back-event'")).rows[0].count,'0');
                await pool.query("UPDATE domwork_bot_outbox SET state='cancelled',payload='{}' WHERE state='pending'");
                await pool.query(`UPDATE domwork_bot_settings SET data=data||'{"liveFeedEnabled":false}'::jsonb`); // jonli kuzatuv bu testga aloqasiz
                const mark={studentId:'s',date:policy.today(),duty:'main',teacherId:'he',present:false};
                await queue.transaction(pool,db=>events.attendance(db,mark));
                await queue.transaction(pool,events.processOne);
                const queued=(await pool.query("SELECT id FROM domwork_bot_outbox WHERE payload ? '_attendance' AND state='pending'")).rows[0];
                assert.ok(queued);
                await queue.transaction(pool,db=>events.attendance(db,{...mark,present:true}));
                const count=calls.filter(c=>c.method==='sendMessage').length;await runtime.deliverOne();
                assert.equal(calls.filter(c=>c.method==='sendMessage').length,count);
                assert.equal((await pool.query('SELECT state FROM domwork_bot_outbox WHERE id=$1',[queued.id])).rows[0].state,'cancelled');
            } finally {if(original===undefined)delete process.env.DOMWORK_BOT_ENABLED;else process.env.DOMWORK_BOT_ENABLED=original;}
        });
        await t.test('24-hour ROP report counts actual transitions and assignments, not current column totals',async()=>{
            await pool.query(`ALTER TABLE leads ADD COLUMN created_at TIMESTAMPTZ DEFAULT '2026-10-01T10:00:00Z';
                CREATE TABLE lead_audit(lead_id TEXT,actor_id TEXT,snapshot JSONB,created_at TIMESTAMPTZ);
                CREATE TABLE payment_records(manager_id TEXT,language TEXT,amount BIGINT,paid_at TIMESTAMPTZ);
                INSERT INTO leads(id,name,phone,language,status,manager_id,created_at) VALUES('new-report','Fixture','','russian','tolov-yopildi','hr-sales','2026-10-12T10:00:00Z');
                INSERT INTO payment_records VALUES('hr-sales','russian',100,'2026-10-12T12:00:00Z'),('hr-sales','russian',900,'2026-10-10T12:00:00Z'),('hr-sales','english',500,'2026-10-12T12:00:00Z'),('hr-sales','russian',700,NULL);`);
            const snapshots=[['new-report',null,{managerId:'hr-sales',status:'yangi-lidlar'}],['lead',{managerId:'other',status:'yangi-lidlar'},{managerId:'hr-sales',status:'yangi-lidlar'}],
                ['new-report',{managerId:'hr-sales',status:'yangi-lidlar'},{managerId:'hr-sales',status:'sinov-darsida'}],['new-report',{managerId:'hr-sales',status:'sinov-darsida'},{managerId:'hr-sales',status:'tolov-yopildi'}]];
            for(const [id,before,after] of snapshots)await pool.query("INSERT INTO lead_audit VALUES($1,'sales',$2,'2026-10-12T12:00:00Z')",[id,JSON.stringify({before,after})]);
            const report=await require('../server/services/domworkBot/staff').comparison(pool,new Date('2026-10-12T16:00:00Z'));
            for(const value of ['Yangi biriktirilgan: 1','Eski biriktirilgan: 1','Ishlangan: 2','Sinovga yozilgan: 1','Yopilgan: 1','Vaqti aniq tushum: 100 UZS'])assert.ok(report.includes(value),report);
        });
        await t.test('completed main attendance cancels an already queued missing-mark reminder',async()=>{
            await pool.query("UPDATE domwork_bot_outbox SET state='cancelled',payload='{}' WHERE state='pending'");
            await store.enqueue(pool,{key:'marked-main-reminder',targetId:'101',role:'teacher',account:{kind:'user',id:'t'},payload:{chat_id:'101',text:'Must not send',_automation:true,_missingAttendance:{studentId:'s',teacherId:'he',duty:'main',date:'2026-10-12'}}});
            await pool.query("INSERT INTO main_attendance VALUES('2026-10_he','s',12,1)");
            await runtime.deliverOne();assert.equal((await pool.query("SELECT state FROM domwork_bot_outbox WHERE unique_key='marked-main-reminder'")).rows[0].state,'cancelled');
        });
        await t.test('assistant daily reminder is own-assignment scoped, deduplicated and cancelled when marked',async()=>{
            await pool.query('CREATE TABLE assistant_attendance(att_key TEXT,student_id TEXT,day INTEGER,present INTEGER)');
            await pool.query("UPDATE students SET assistant_teacher_id='hr-assistant' WHERE id='s'");
            await pool.query("UPDATE domwork_bot_outbox SET state='cancelled',payload='{}' WHERE state='pending'");
            const scheduler=require('../server/services/domworkBot/scheduler'),now=new Date('2026-10-12T16:00:00Z');
            await queue.transaction(pool,db=>scheduler.run(db,now));await queue.transaction(pool,db=>scheduler.run(db,now));
            const rows=(await pool.query("SELECT * FROM domwork_bot_outbox WHERE unique_key='assistant-attendance:s:2026-10-12'")).rows;
            assert.equal(rows.length,1);assert.equal(rows[0].target_id,'1204');assert.equal(rows[0].role,'assistant');
            // Refresh only this fixture expiry so delivery tests the attendance guard, not wall-clock date.
            await pool.query("UPDATE domwork_bot_outbox SET payload=payload-'_expiresAt' WHERE id=$1",[rows[0].id]);
            await pool.query("INSERT INTO assistant_attendance VALUES('2026-10_hr-assistant','s',12,0)");
            await runtime.deliverOne();assert.equal((await pool.query('SELECT state FROM domwork_bot_outbox WHERE id=$1',[rows[0].id])).rows[0].state,'cancelled');
        });
        await t.test('phone-change recovery is self-admin scoped, audited and preserves all other records',async()=>{
            await pool.query("INSERT INTO users VALUES('reset-admin','Reset admin','reset-login','admin','+998900888111')");
            await queue.transaction(pool,db=>store.linkContact(db,contact(90001,'+998900888111')));
            await pool.query("UPDATE users SET phone='+998900888222' WHERE id='reset-admin'");
            assert.equal(await store.identity(pool,'90001'),null);
            await assert.rejects(queue.transaction(pool,db=>store.linkContact(db,contact(90002,'+998900888222'))),e=>e.status===409);
            const actor={id:'reset-admin'}, preview=await store.ownAdminLink(pool,actor);
            const input={currentPhone:preview.account.phone,expectedTelegramId:preview.link.telegram_id,expectedRevision:preview.link.revision};
            const snapshot=async()=>Object.fromEntries(await Promise.all(['users','students','leads','hr_employees','domwork_bot_links','domwork_bot_sessions','domwork_bot_groups','domwork_learning_groups'].map(async table=>[table,(await pool.query(`SELECT * FROM ${table} ORDER BY 1`)).rows])));
            const before=await snapshot(),auditBefore=(await pool.query("SELECT count(*) FROM domwork_bot_audit WHERE action='self-telegram-unlinked'")).rows[0].count;
            await assert.rejects(queue.transaction(pool,db=>store.unlinkOwnAdmin(db,{id:'t'},input)),e=>e.status===403);
            await assert.rejects(queue.transaction(pool,db=>store.unlinkOwnAdmin(db,{id:'a'},input)),e=>e.status===409);
            await assert.rejects(queue.transaction(pool,db=>store.unlinkOwnAdmin(db,actor,{...input,currentPhone:'+998900888111'})),e=>e.status===409);
            await assert.rejects(queue.transaction(pool,db=>store.unlinkOwnAdmin(db,actor,{...input,expectedTelegramId:'101'})),e=>e.status===409);
            await assert.rejects(queue.transaction(pool,db=>store.unlinkOwnAdmin(db,actor,{...input,expectedRevision:'stale'})),e=>e.status===409);
            await assert.rejects(queue.transaction(pool,db=>store.unlinkOwnAdmin(db,actor,{})),e=>e.status===409);
            await assert.rejects(queue.transaction(pool,async db=>{await store.unlinkOwnAdmin(db,actor,input);throw Error('rollback fixture');}));
            assert.deepEqual(await snapshot(),before);
            assert.equal((await pool.query("SELECT count(*) FROM domwork_bot_audit WHERE action='self-telegram-unlinked'")).rows[0].count,auditBefore);
            assert.deepEqual(await queue.transaction(pool,db=>store.unlinkOwnAdmin(db,actor,input)),{ok:true,requiresOwnContact:true});
            const after=await snapshot();
            for(const table of Object.keys(before))assert.deepEqual(after[table],table==='domwork_bot_links'?before[table].filter(row=>row.account_id!=='reset-admin'):before[table],table);
            const audit=(await pool.query("SELECT * FROM domwork_bot_audit WHERE action='self-telegram-unlinked' AND entity_id='reset-admin'")).rows;
            assert.equal(audit.length,1);assert.equal(audit[0].data.before.telegram_id,'90001');assert.equal(audit[0].data.before.phone,'998900888111');
            await assert.rejects(queue.transaction(pool,db=>store.unlinkOwnAdmin(db,actor,input)),e=>e.status===409);
            assert.equal((await store.ownAdminLink(pool,actor)).link,null);
            const linked=await queue.transaction(pool,db=>store.linkContact(db,contact(90002,'+998900888222')));
            assert.equal(linked.role,'admin');assert.equal(linked.id,'reset-admin');
            assert.equal((await store.identity(pool,'90002')).id,'reset-admin');assert.equal(await store.identity(pool,'90001'),null);
        });
        const navigationReads=[];
        // Report SQL has its own real PostgreSQL suite. This adapter verifies
        // that navigation reaches the selected, current-role staff action.
        const navigationHandler=createHandler({crm:{...crm,async staffAction(db,identity,action){
            navigationReads.push({id:identity.id,role:identity.role,action});
            if(action==='configuration')return require('../server/services/domworkBot/staff').action(db,identity,action);
            return 'Fixture report: '+action;
        }}});
        let navigationUpdateId=10000;
        const navigate=async(id,label,extra={})=>{
            const updateId=navigationUpdateId++;
            await queue.transaction(pool,db=>navigationHandler(db,{update_id:updateId,message:msg(id,label,extra)}));
            return (await pool.query('SELECT payload FROM domwork_bot_outbox WHERE unique_key=$1',['u:'+updateId+':r:0'])).rows[0]?.payload;
        };
        const navigationSnapshot=async()=>Object.fromEntries(await Promise.all([
            'users','hr_employees','students','leads','domwork_bot_links','domwork_bot_settings',
            'domwork_learning_groups','domwork_student_group_links','domwork_bot_groups',
            'domwork_bot_broadcasts','domwork_bot_leave_requests'
        ].map(async table=>[table,(await pool.query(`SELECT * FROM ${table} ORDER BY 1`)).rows])));
        await t.test('all broadcast stages yield to allowed admin buttons without cancel; other sessions and saved records are preserved',async()=>{
            const before=await navigationSnapshot(),otherSession={type:'leave',fixture:'other user'};
            await store.setSession(pool,'101',otherSession);
            const buttons=[['🔗 Guruhlarni bog‘lash','Guruhni tanlang','choose-chat'],
                ['📝 Ruxsat arizalari','Hozircha',null],['📊 Umumiy hisobot','Fixture report: digest',null],
                ['⚙️ Bot sozlamalari','Kunlik sotuv xabarlari',null]];
            for(const step of ['segment','content','time'])for(const [label,expected,nextType]of buttons){
                await store.setSession(pool,'100',{type:'broadcast',step,segment:'student',content:{method:'sendMessage',text:'Unsent fixture'}});
                const response=await navigate(100,label);
                assert.ok(response.text.includes(expected),step+' → '+label+': '+response.text);
                const pending=await store.session(pool,'100');
                assert.equal(pending?.type||null,nextType);
                if(nextType==='choose-chat'){
                    assert.ok(response.reply_markup.keyboard.flat().some(button=>button.request_chat));
                    assert.ok(response.reply_markup.keyboard.flat().some(button=>button.text==='📊 Umumiy hisobot'));
                }
                assert.deepEqual(await store.session(pool,'101'),otherSession);
            }
            assert.deepEqual(await navigationSnapshot(),before);
            assert.ok(navigationReads.some(x=>x.id==='a'&&x.role==='admin'&&x.action==='digest'));
        });
        await t.test('leave workflow yields to teacher menu, and pressing leave again starts a fresh request',async()=>{
            const before=await navigationSnapshot();
            await store.setSession(pool,'101',{type:'leave'});
            const response=await navigate(101,'⏰ Face ID davomat');
            assert.match(response.text,/Face ID belgisi yo‘q/);
            assert.equal(await store.session(pool,'101'),null);
            await store.setSession(pool,'101',{type:'leave',fixture:'unfinished'});
            const restarted=await navigate(101,'📝 Ruxsat so‘rash');
            assert.ok(restarted.text.includes('Boshlanish sanasi'));
            assert.deepEqual(await store.session(pool,'101'),{type:'leave'});
            assert.deepEqual(await navigationSnapshot(),before);
        });
        await t.test('unavailable role buttons and ordinary replies do not clear or escalate an unfinished workflow',async()=>{
            const before=await navigationSnapshot(),pending={type:'leave',fixture:'keep'};
            await store.setSession(pool,'101',pending);
            for(const label of ['📣 Xabar tarqatish','📊 Umumiy hisobot','ordinary text']){
                const response=await navigate(101,label);
                assert.ok(response.text.includes('Sana va sabab'));
                assert.deepEqual(await store.session(pool,'101'),pending);
            }
            assert.deepEqual(await navigationSnapshot(),before);
        });
        await t.test('leaving a group chooser cancels only its pending request and rejects the old shared-chat response',async()=>{
            const before=await navigationSnapshot(),seen=(await pool.query('SELECT * FROM domwork_bot_seen_chats ORDER BY chat_id')).rows;
            await store.setSession(pool,'100',{type:'choose-chat',requestId:314});
            const response=await navigate(100,'📊 Umumiy hisobot');
            assert.equal(response.text,'Fixture report: digest');
            assert.equal(await store.session(pool,'100'),null);
            const stale=await navigate(100,undefined,{chat_shared:{request_id:314,chat_id:-10088888,title:'Stale chooser'}});
            assert.ok(stale.text.includes('so‘rovi eskirgan'));
            assert.deepEqual((await pool.query('SELECT * FROM domwork_bot_seen_chats ORDER BY chat_id')).rows,seen);
            assert.deepEqual(await navigationSnapshot(),before);
        });
        await t.test('broadcast answers/media still advance normally, menu button restarts, and cancel/menu commands remain supported',async()=>{
            const before=await navigationSnapshot();
            await navigate(100,'📣 Xabar tarqatish');
            assert.deepEqual(await store.session(pool,'100'),{type:'broadcast',step:'segment'});
            await navigate(100,'student');
            assert.equal((await store.session(pool,'100')).step,'content');
            await navigate(100,undefined,{photo:[{file_id:'fixture_photo_123456789'}],caption:'📊 Umumiy hisobot'});
            const content=await store.session(pool,'100');
            assert.equal(content.step,'time');assert.equal(content.content.text,'📊 Umumiy hisobot');
            await navigate(100,'📣 Xabar tarqatish');
            assert.deepEqual(await store.session(pool,'100'),{type:'broadcast',step:'segment'});
            const cancelled=await navigate(100,'/cancel');
            assert.equal(cancelled.text,'Bekor qilindi.');assert.equal(await store.session(pool,'100'),null);
            for(const command of ['/menu','/start']){
                await store.setSession(pool,'100',{type:'broadcast',step:'segment'});
                assert.ok((await navigate(100,command)).text.includes('Kerakli bo‘limni tanlang'));
                assert.equal(await store.session(pool,'100'),null);
            }
            assert.deepEqual(await navigationSnapshot(),before);
        });
    } finally {await runtime?.stop();await pool.end();}
});
