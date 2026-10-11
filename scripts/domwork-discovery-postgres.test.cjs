const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const express=require('express');
const groups=require('../server/services/domworkGroups');
const discovery=require('../server/services/domworkBot/discovery');
const store=require('../server/services/domworkBot/store');
const queue=require('../server/services/domworkBot/queue');
const {createRuntime}=require('../server/services/domworkBot/runtime');
const createRouter=require('../server/routes/domworkBot');
const url=process.env.PAYROLL_TEST_DATABASE_URL;
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||!/^\/payroll_test_[a-z0-9]+$/.test(u.pathname))throw Error('Only disposable loopback DBs');}
test('automatic group discovery and per-student routing (synthetic Telegram only)',{skip:!url},async t=>{
    const pool=new Pool({connectionString:url}),actor={id:'admin'},botId=999;
    const chats=new Map(),sent=[];
    const chatId=n=>String(-1005000000-n);
    const contact=(id,phone)=>({from:{id},chat:{id,type:'private'},contact:{user_id:id,phone_number:phone}});
    async function call(method,payload){
        if(method==='getMe')return{id:botId,is_bot:true,username:'Domworkuz_bot'};
        if(method==='sendMessage'){sent.push(payload);return true;}
        const c=chats.get(String(payload.chat_id));if(!c)throw Error('Unknown fixture chat');
        if(method==='getChat')return{id:Number(payload.chat_id),type:'supergroup',title:c.title};
        if(method==='getChatAdministrators')return c.admins.map(id=>({status:'administrator',user:{id,is_bot:false}}));
        if(method==='getChatMember')return Number(payload.user_id)===botId?{status:c.botStatus||'administrator',can_restrict_members:c.restrict!==false}:{status:c.members.includes(Number(payload.user_id))?'member':'left'};
        throw Error('Unexpected method '+method);
    }
    async function snapshot(){return Object.fromEntries(await Promise.all(['users','hr_employees','students','leads','domwork_bot_groups'].map(async table=>[table,(await pool.query('SELECT * FROM '+table+' ORDER BY id')).rows])));}
    let runtime,original,initial,approved;
    try{
        await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,phone TEXT);
            CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN,phone TEXT);
            CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
            CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,extra_data JSONB,teacher_id TEXT,lesson_day_of_week INTEGER,lesson_time TEXT,lesson_duration INTEGER);
            CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,language TEXT,status TEXT,deleted_at TIMESTAMPTZ);
            INSERT INTO users VALUES('admin','Admin','admin','admin','+998901111111'),('teacher','Teacher A','teachera','teacher','+998902222222'),('other','Teacher B','teacherb','teacher','+998902222223');
            INSERT INTO hr_employees VALUES('a','Teacher A','teachera','rus-oqituvchi','active','russian',true,'+998902222222'),('b','Teacher B','teacherb','rus-oqituvchi','active','russian',false,'+998902222223');
            INSERT INTO students VALUES('s1','Student 1','+998903333331','russian','{"passwordHash":"hash","paidAmount":100,"telegramGroupLink":"https://t.me/+OldStudentLink"}','a',1,'10:00',30),
                ('s2','Student 2','+998903333332','russian','{"passwordHash":"hash","paidAmount":200}','a',1,'10:00',30),
                ('s3','Student 3','+998903333333','russian','{"passwordHash":"hash","paidAmount":200}','b',1,'10:00',30),
                ('en','English','+998903333334','english','{"passwordHash":"hash","paidAmount":200}','a',1,'10:00',30);`);
        await groups.initSchema(pool);await store.initSchema(pool);
        await queue.transaction(pool,db=>store.linkContact(db,contact(101,'+998902222222')));
        await queue.transaction(pool,db=>store.linkContact(db,contact(102,'+998902222223')));
        await queue.transaction(pool,db=>store.linkContact(db,contact(201,'+998903333331')));
        await queue.transaction(pool,db=>store.linkContact(db,contact(202,'+998903333332')));
        initial=await groups.save(pool,actor,null,{type:'trial',name:'Old trial',teacherId:'a',inviteLink:'https://t.me/+OldTrialLink',chatId:'-10012345',isDefault:true});
        initial=(await groups.list(pool,actor)).groups.find(g=>g.id===initial.id);
        original=await snapshot();
        await t.test('repeatable migrations preserve legacy records and empty discovered invites are valid',async()=>{
            await groups.initSchema(pool);await store.initSchema(pool);
            assert.deepEqual(await snapshot(),original);
            assert.equal(groups.input({type:'classroom',name:'Group',teacherId:'a',inviteLink:'',chatId:chatId(1),isDefault:false}).inviteLink,'');
            assert.throws(()=>groups.input({type:'classroom',name:'Group',teacherId:'a',inviteLink:'',isDefault:false}));
        });
        await t.test('50 chats are discovered without binding or title-based teacher guessing',async()=>{
            for(let n=1;n<=50;n++){
                chats.set(chatId(n),{title:'Group '+n,admins:[101],members:n===1?[201]:n===2?[202]:[]});
                await discovery.observe(pool,chatId(n),'Teacher B '+n);await discovery.processOne(pool,call,botId);
            }
            const list=await discovery.list(pool,actor);assert.equal(list.candidates.length,50);
            assert.ok(list.candidates.every(c=>c.state==='ready'&&c.evidence.teachers.length===1&&c.evidence.teachers[0].id==='a'));
            assert.equal((await groups.list(pool,actor)).groups.length,1);
            assert.equal((await store.settings(pool)).data.groupNotificationsEnabled,false);
        });
        await t.test('bulk validation, stale revisions, duplicate chats and persisted permissions are atomic',async()=>{
            const c=(await discovery.list(pool,actor)).candidates;
            const items=c.map(c=>({chatId:c.chatId,name:c.evidence.title,teacherId:'a',type:'classroom',inviteLink:'',revision:c.revision}));
            await assert.rejects(discovery.confirm(pool,{id:'teacher',role:'admin'},items,async(id,o)=>({chatId:id})),e=>e.status===403);
            await assert.rejects(discovery.confirm(pool,actor,[items[0],items[0]],async(id,o)=>({chatId:id})),e=>e.status===400);
            await assert.rejects(discovery.confirm(pool,actor,[items[0],{...items[1],revision:999}],async(id,o)=>({chatId:id})),e=>e.status===409);
            assert.equal((await groups.list(pool,actor)).groups.length,1);
            approved=(await discovery.confirm(pool,actor,items,async(id,o)=>{assert.equal(o.trial,false);return{chatId:id};})).groups;
            assert.equal(approved.length,50);assert.ok(approved.every(g=>g.botVerified&&!g.isDefault&&g.inviteLink===''));
            assert.equal((await discovery.list(pool,actor)).candidates.length,0);
            assert.deepEqual((await groups.list(pool,actor)).groups.find(g=>g.id===initial.id),initial);
            assert.deepEqual(await snapshot(),original);
        });
        await t.test('each student membership is checked across teacher groups, no links created until approved',async()=>{
            await discovery.requestStudent(pool,'s3');
            while(await discovery.processOne(pool,call,botId)){}
            const list=(await discovery.studentCandidates(pool,actor)).students;
            assert.equal(list.length,3);assert.equal(list.find(s=>s.id==='s3').discovery.reason,'not-registered');
            assert.equal(list.find(s=>s.id==='s1').discovery.groups[0].id,approved.find(g=>g.chatId===chatId(1)).id);
            assert.equal(list.find(s=>s.id==='s2').discovery.groups[0].id,approved.find(g=>g.chatId===chatId(2)).id);
            assert.equal(await groups.forStudent(pool,'s1'),null);
            await groups.assignStudents(pool,actor,list.filter(s=>s.id!=='s3').map(s=>({studentId:s.id,revision:0,groupId:s.discovery.groups[0].id})));
            assert.equal((await groups.forStudent(pool,'s1')).chatId,chatId(1));
            assert.equal((await groups.forStudent(pool,'s2')).chatId,chatId(2));
            assert.deepEqual(await snapshot(),original);
        });
        await t.test('multiple member matches and multiple teachers remain ambiguous, no silent overwrites',async()=>{
            chats.get(chatId(3)).members=[201];await discovery.requestStudent(pool,'s1');await discovery.processOne(pool,call,botId);
            const s=(await discovery.studentCandidates(pool,actor)).students.find(s=>s.id==='s1');
            assert.equal(s.discovery.reason,'ambiguous');assert.equal(s.discovery.groups.length,2);
            assert.equal((await groups.forStudent(pool,'s1')).chatId,chatId(1));
            chats.set(chatId(60),{title:'Ambiguous',admins:[101,102],members:[]});await discovery.observe(pool,chatId(60));await discovery.processOne(pool,call,botId);
            assert.equal((await discovery.list(pool,actor)).candidates[0].evidence.teachers.length,2);
            chats.set(chatId(61),{title:'Teacher A — title is not proof',admins:[],members:[]});await discovery.observe(pool,chatId(61));await discovery.processOne(pool,call,botId);
            assert.equal((await discovery.list(pool,actor)).candidates.find(c=>c.chatId===chatId(61)).evidence.teachers.length,0);
        });
        await t.test('revoked teacher roles are not identified; later registration queues discovery again',async()=>{
            await pool.query("UPDATE users SET role='employee' WHERE id='teacher'");
            await discovery.observe(pool,chatId(61));chats.get(chatId(61)).admins=[101];await discovery.processOne(pool,call,botId);
            assert.equal((await discovery.list(pool,actor)).candidates.find(c=>c.chatId===chatId(61)).evidence.teachers.length,0);
            await pool.query("UPDATE users SET role='teacher' WHERE id='teacher'");
            await discovery.contactLinked(pool,await store.identity(pool,'101'));
            assert.equal((await discovery.list(pool,actor)).candidates.find(c=>c.chatId===chatId(61)).state,'pending');
            while(await discovery.processOne(pool,call,botId)){}
            assert.equal((await discovery.list(pool,actor)).candidates.find(c=>c.chatId===chatId(61)).evidence.teachers[0].id,'a');
        });
        await t.test('permission/read errors are held for rescan, no duplicate or partially confirmed groups',async()=>{
            chats.set(chatId(62),{title:'Not admin',admins:[101],members:[],botStatus:'member'});
            await discovery.observe(pool,chatId(62));await discovery.processOne(pool,call,botId);
            assert.equal((await discovery.list(pool,actor)).candidates.find(c=>c.chatId===chatId(62)).state,'error');
            await assert.rejects(discovery.confirm(pool,actor,[{chatId:chatId(62),type:'classroom',teacherId:'a',name:'Not admin',revision:1,inviteLink:''}],async()=>{throw Object.assign(Error('permission'),{status:400});}),e=>e.status===400);
            assert.equal((await groups.list(pool,actor)).groups.length,51);
        });
        await t.test('bulk student assignments reject cross-teacher, English, duplicates and stale revisions with full rollback',async()=>{
            const one=approved.find(g=>g.chatId===chatId(1)),two=approved.find(g=>g.chatId===chatId(2));
            const items=[{studentId:'s1',revision:1,groupId:two.id},{studentId:'s2',revision:0,groupId:one.id}];
            await assert.rejects(groups.assignStudents(pool,actor,items),e=>e.status===409);
            assert.equal((await groups.forStudent(pool,'s1')).id,one.id);
            for(const id of ['s3','en'])await assert.rejects(groups.assignStudents(pool,actor,[{studentId:id,revision:0,groupId:one.id}]),e=>e.status===400);
            await assert.rejects(groups.assignStudents(pool,{id:'teacher'},[items[0]]),e=>e.status===403);
            await assert.rejects(groups.assignStudents(pool,actor,[items[0],items[0]]),e=>e.status===400);
            await groups.assignStudents(pool,actor,[{studentId:'s1',revision:1,groupId:one.id}]);
            assert.equal((await discovery.studentCandidates(pool,actor)).students.find(s=>s.id==='s1').revision,1); // no-op stays idempotent
        });
        await t.test('student audit failure rolls back the entire batch and keeps previous assignments',async()=>{
            const before=(await pool.query('SELECT * FROM domwork_student_group_links ORDER BY student_id')).rows;
            await pool.query(`CREATE FUNCTION reject_student_group_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture student audit failure'; END $$;
                CREATE TRIGGER reject_student_group_audit BEFORE INSERT ON domwork_student_group_audit FOR EACH ROW EXECUTE FUNCTION reject_student_group_audit();`);
            try{await assert.rejects(groups.assignStudents(pool,actor,[{studentId:'s1',revision:1,groupId:approved.find(g=>g.chatId===chatId(2)).id}]),/fixture student audit failure/);
                assert.deepEqual((await pool.query('SELECT * FROM domwork_student_group_links ORDER BY student_id')).rows,before);
            }finally{await pool.query('DROP TRIGGER reject_student_group_audit ON domwork_student_group_audit; DROP FUNCTION reject_student_group_audit()');}
        });
        await t.test('a scan invalidated by a new observation cannot publish stale evidence; expired leases resume',async()=>{
            const id=chatId(70);chats.set(id,{title:'Race test',admins:[101],members:[]});await discovery.observe(pool,id,'Race test');
            let changed=false;
            await discovery.processOne(pool,async(method,payload)=>{if(!changed){changed=true;await discovery.observe(pool,id,'Newer observation');}return call(method,payload);},botId);
            assert.equal((await discovery.list(pool,actor)).candidates.find(c=>c.chatId===id).state,'pending');
            await pool.query("UPDATE domwork_group_discovery SET state='scanning',lease_until=NOW()-INTERVAL '1 minute' WHERE chat_id=$1",[id]);
            await discovery.processOne(pool,call,botId);
            assert.equal((await discovery.list(pool,actor)).candidates.find(c=>c.chatId===id).state,'ready');
        });
        await t.test('audit failure rolls back every new group in the batch',async()=>{
            const candidates=(await discovery.list(pool,actor)).candidates.filter(c=>c.state==='ready');
            const before=(await groups.list(pool,actor)).groups.length;
            await pool.query(`CREATE FUNCTION reject_discovery_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit failure'; END $$;
                CREATE TRIGGER reject_discovery_audit BEFORE INSERT ON domwork_learning_group_audit FOR EACH ROW EXECUTE FUNCTION reject_discovery_audit();`);
            try{await assert.rejects(discovery.confirm(pool,actor,candidates.map(c=>({chatId:c.chatId,revision:c.revision,teacherId:'a',type:'classroom',name:c.title||'New',inviteLink:''})),async id=>({chatId:id})),/fixture audit failure/);
                assert.equal((await groups.list(pool,actor)).groups.length,before);
            }finally{await pool.query('DROP TRIGGER reject_discovery_audit ON domwork_learning_group_audit; DROP FUNCTION reject_discovery_audit()');}
        });
        await t.test('assigned group cannot be silently transferred to another teacher; archive halts routing without erasing link',async()=>{
            const g=approved.find(g=>g.chatId===chatId(1));
            await assert.rejects(groups.save(pool,actor,g.id,{...g,teacherId:'b'}),e=>e.status===409);
            const archived=await groups.archive(pool,actor,g.id,{revision:g.revision,archived:true});
            assert.equal(await groups.forStudent(pool,'s1'),null);
            assert.equal(await groups.studentInvite(pool,'s1','russian','https://t.me/+OldStudentLink'),'');
            assert.equal(await groups.studentInvite(pool,'s3','russian','https://t.me/+OwnOldLink'),'https://t.me/+OwnOldLink');
            assert.equal(await groups.studentInvite(pool,'en','english','https://t.me/+EnglishLink'),'https://t.me/+EnglishLink');
            assert.equal((await pool.query("SELECT group_id FROM domwork_student_group_links WHERE student_id='s1'")).rows[0].group_id,g.id);
            await groups.archive(pool,actor,g.id,{revision:archived.revision,archived:false});
            assert.equal(await groups.forStudent(pool,'s1',{delivery:true}),null);
            await pool.query('UPDATE domwork_learning_groups SET verified_at=NOW() WHERE id=$1',[g.id]);
            await pool.query("UPDATE students SET teacher_id='b' WHERE id='s1'");assert.equal(await groups.forStudent(pool,'s1'),null);
            await pool.query("UPDATE students SET teacher_id='a' WHERE id='s1'");
        });
        await t.test('queued group/private links are cancelled if student changes group before delivery',async()=>{
            runtime=createRuntime({pool,crm:{},autoTick:false,redisFactory:()=>({isReady:true,isOpen:true,on(){},async connect(){},async destroy(){this.isOpen=false;},async eval(){return 1;}}),
                telegramFactory:()=>({callApi:call}),env:{DOMWORK_BOT_ENABLED:'true',DOMWORK_BOT_TOKEN:'123456789:'+'a'.repeat(35),DOMWORK_BOT_WEBHOOK_SECRET:'x'.repeat(40),REDIS_URL:'redis://127.0.0.1:6379'}});
            await runtime.start();assert.equal(runtime.status().state,'ready');
            const old=await groups.forStudent(pool,'s1');
            await store.enqueue(pool,{key:'stale-private-link',targetId:'201',role:'student',account:{kind:'student',id:'s1'},payload:{text:'old group',_studentGroup:{studentId:'s1',groupId:old.id}}});
            await groups.assignStudents(pool,actor,[{studentId:'s1',revision:1,groupId:approved.find(g=>g.chatId===chatId(2)).id}]);
            await runtime.deliverOne();assert.equal(sent.length,0);
            assert.equal((await pool.query("SELECT state FROM domwork_bot_outbox WHERE unique_key='stale-private-link'")).rows[0].state,'cancelled');
            await store.enqueue(pool,{key:'own-new-link',targetId:'201',role:'student',account:{kind:'student',id:'s1'},payload:{text:'new group',_studentGroup:{studentId:'s1',groupId:approved.find(g=>g.chatId===chatId(2)).id}}});
            await runtime.deliverOne();assert.equal(sent.length,1);
        });
        await t.test('new API requires authenticated persisted admin, no-store and rejects malformed batches',async()=>{
            const app=express();app.use(express.json());app.use('/api/domwork/bot',createRouter({pool,runtime,authRequired:(req,res,next)=>{
                if(!req.headers['x-user'])return res.sendStatus(401);req.user={id:req.headers['x-user'],role:'admin'};next();}}));
            const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));}),base=`http://127.0.0.1:${server.address().port}/api/domwork/bot`;
            try{
                assert.equal((await fetch(base+'/discovery')).status,401);
                for(const path of ['/discovery','/student-groups']){
                    assert.equal((await fetch(base+path,{headers:{'x-user':'teacher'}})).status,403);
                    const response=await fetch(base+path,{headers:{'x-user':'admin'}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
                }
                assert.equal((await fetch(base+'/student-groups/confirm',{method:'POST',headers:{'x-user':'admin','content-type':'application/json'},body:'{}'})).status,400);
            }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
        });
        await t.test('independent discovery worker resolves one queued group without sending messages or overlapping itself',async()=>{
            const id=chatId(80);chats.set(id,{title:'Worker fixture',admins:[101],members:[]});
            await discovery.observe(pool,id,'Worker fixture');const count=sent.length;
            await Promise.all([runtime.tickDiscovery(),runtime.tickDiscovery()]);
            const c=(await discovery.list(pool,actor)).candidates.find(c=>c.chatId===id);
            assert.equal(c.state,'ready');assert.equal(c.evidence.teachers[0].id,'a');assert.equal(sent.length,count);
        });
        await t.test('legacy CRM snapshots, old trial and disabled automation stay unchanged throughout',async()=>{
            assert.deepEqual(await snapshot(),original);
            assert.deepEqual((await groups.list(pool,actor)).groups.find(g=>g.id===initial.id),initial);
            assert.equal((await store.settings(pool)).data.groupNotificationsEnabled,false);
        });
    }finally{await runtime?.stop();await pool.end();}
});
