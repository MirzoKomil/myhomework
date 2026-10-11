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
    const crm={async getDemoStudentGrades(id){reads.push(id);return {grades:[{date:'2026-10-11',score:90}]};},async getStudentContractPdf(id){reads.push(id);return {buffer:Buffer.from('fixture'),filename:'fixture.pdf'};}};
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
                const body=JSON.stringify({update_id:6,message:msg(102,'/menu')});
                assert.equal((await fetch(base+'/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body})).status,401);
                assert.equal((await fetch(base+'/webhook',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':'x'.repeat(40)},body})).status,200);
            } finally {await new Promise(resolve=>server.close(resolve));}
        });
        await t.test('all old student data remain unchanged',async()=>{assert.deepEqual((await pool.query('SELECT * FROM students ORDER BY id')).rows,studentsBefore);});
    } finally {await runtime?.stop();await pool.end();}
});
