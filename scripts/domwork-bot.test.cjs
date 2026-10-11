const { test } = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../server/services/domworkBot/policy');
const store = require('../server/services/domworkBot/store');
const queue = require('../server/services/domworkBot/queue');
const { configuration } = require('../server/services/domworkBot/config');
const { createRuntime } = require('../server/services/domworkBot/runtime');
const { keyboard, actionFor, chunks } = require('../server/services/domworkBot/handlers');
const { createRedis } = require('../server/services/domworkBot/redis');
const contact = { from:{id:123},chat:{id:123,type:'private'},contact:{user_id:123,phone_number:'+998 90 123 45 67'} };
test('phone normalization preserves international length', () => {
    assert.equal(policy.phone('901234567'),'998901234567'); assert.equal(policy.phone('+7 999 123 45 67'),'79991234567');
    assert.equal(policy.phone('abc'),''); assert.equal(policy.phone('+0 12345678'),'');
    assert.equal(policy.phone('owner998907777777@example.invalid'),''); assert.equal(policy.phone('++998907777777'),'');
});
test('verified contact requires own private contact, not forwarded third-party contact', () => {
    assert.deepEqual(policy.contactIdentity(contact),{telegramId:'123',phone:'998901234567'});
    for (const changed of [{contact:{...contact.contact,user_id:234}},{forward_origin:{}},{chat:{id:-100,type:'supergroup'}},{from:{id:234}}])
        assert.throws(()=>policy.contactIdentity({...contact,...changed}), e=>e.status===400);
});
test('Telegram IDs must be safe positive integers', () => {
    for (const value of ['-100','1.2','NaN','123abc','9007199254740992','']) assert.equal(policy.telegramId(value),'');
    assert.equal(policy.telegramId(123),'123');
});
test('role precedence does not resolve duplicate real accounts by guessing', () => {
    const candidates=[{kind:'student',id:'s',role:'student'},{kind:'user',id:'u',role:'admin'}];
    assert.equal(policy.choose(candidates).id,'u');
    assert.throws(()=>policy.choose([...candidates,{kind:'user',id:'v',role:'admin'}]),e=>e.status===409);
    assert.throws(()=>policy.choose([]),e=>e.status===404);
});
test('Russian staff needs explicit active HR identity except superadmin', () => {
    assert.equal(store.staff({id:'u',role:'sales_manager'},'998901234567'),null);
    assert.equal(store.staff({id:'u',role:'teacher',employee_id:'e',employee_role:'ingliz-oqituvchi',lang:'english'},'1'),null);
    assert.equal(store.staff({id:'u',role:'teacher',employee_id:'e',employee_role:'rus-oqituvchi',employee_status:'inactive'},'1'),null);
    assert.equal(store.staff({id:'u',role:'teacher',employee_id:'e',employee_role:'rus-oqituvchi'},'1').role,'teacher');
    assert.equal(store.staff({id:'u',role:'admin'},'1').role,'admin');
});
test('only actual paid, active Russian students get student menu', () => {
    const row={id:'s',subject:'russian',extra_data:{passwordHash:'hash',paidAmount:100}};
    assert.equal(store.student(row,'1').role,'student');
    for(const extra of [{paidAmount:0},{frozen:true},{isStaffDemo:true},{status:'inactive'},{passwordHash:''}])
        assert.equal(store.student({...row,extra_data:{...row.extra_data,...extra}},'1'),null);
    assert.equal(store.student({...row,subject:'english'},'1'),null);
});
test('all eight menus are scoped; dual role is server-owned', () => {
    assert.equal(Object.keys(policy.MENUS).length,8);
    assert.throws(()=>policy.requireAction({role:'student'},'broadcast'),e=>e.status===403);
    assert.throws(()=>policy.requireAction({role:'teacher'},'assistant-duty'),e=>e.status===403);
    policy.requireAction({role:'teacher',dualRole:true},'assistant-duty');
    assert.equal(actionFor({role:'student'},'📣 Xabar tarqatish'),undefined);
    assert.ok(keyboard({role:'student'}).keyboard.every(row=>row.length<=2));
});
test('webhook secret rejects missing, short and wrong tokens', () => {
    const s='x'.repeat(40); assert.equal(policy.secretMatches(s,s),true);
    for (const input of ['',undefined,'x'.repeat(39),'y'.repeat(40)]) assert.equal(policy.secretMatches(s,input),false);
    assert.equal(policy.secretMatches('short','short'),false);
});
test('calendar boundaries use Tashkent including leap years', () => {
    assert.equal(policy.today(new Date('2026-10-10T20:00:00Z')),'2026-10-11');
    assert.deepEqual(policy.monthPeriod(new Date('2024-02-15Z')),{start:'2024-02-01',end:'2024-02-29'});
});
test('configuration is opt-in; secrets never enter status', async () => {
    assert.equal(configuration({}).enabled,false);
    assert.throws(()=>configuration({DOMWORK_BOT_ENABLED:'true'}));
    let queries=0;
    const runtime=createRuntime({pool:{query(){queries++;}},crm:{},env:{}});
    await runtime.start(); assert.equal(queries,0); assert.equal(runtime.status().state,'disabled');
    assert.equal(JSON.stringify(runtime.status()).includes('token'),false);
    const invalid=createRuntime({pool:{},crm:{},env:{DOMWORK_BOT_ENABLED:'true'}});
    assert.equal(invalid.status().state,'failed'); await invalid.start();
});
test('configuration validates public HTTPS origin and Redis protocol', () => {
    const env={DOMWORK_BOT_ENABLED:'true',DOMWORK_BOT_TOKEN:'123456789:'+'a'.repeat(35),DOMWORK_BOT_WEBHOOK_SECRET:'x'.repeat(40),REDIS_URL:'redis://localhost:6379'};
    assert.equal(configuration(env).webhookUrl,'https://myhomework.uz/api/domwork/bot/webhook');
    for(const value of ['http://a','https://a/path','https://u:p@a','https://a?x']) assert.throws(()=>configuration({...env,DOMWORK_BOT_PUBLIC_URL:value}));
    assert.throws(()=>configuration({...env,REDIS_URL:'https://redis'}));
});
test('durable update validation rejects malformed and oversized input', () => {
    assert.equal(queue.validUpdate({update_id:1,message:{}}).update_id,1);
    for(const value of [null,{update_id:-1,message:{}},{update_id:1},{update_id:'1',message:{}},{update_id:1,message:{text:'x'.repeat(140000)}}]) assert.throws(()=>queue.validUpdate(value));
});
test('transport only retries explicit rate rejection; uncertain outcome never retries automatically', () => {
    assert.equal(queue.failure(Error('timeout')).state,'uncertain');
    assert.equal(queue.failure({response:{error_code:500}}).state,'uncertain');
    assert.equal(queue.failure({response:{error_code:403}}).state,'failed');
    assert.deepEqual(queue.failure({response:{error_code:429,parameters:{retry_after:5}}}),{state:'pending',seconds:5,reason:'telegram-rate-limit'});
});
test('long replies split below Telegram limit without dropping content', () => {
    const value='a'.repeat(4000)+'\n'+'b'.repeat(3000), parts=chunks(value);
    assert.ok(parts.every(p=>p.length<=3500)); assert.equal(parts.join('').replaceAll('\n',''),value.replaceAll('\n',''));
});
test('Redis rate control and token release use atomic scripts without exposing URLs', async () => {
    const calls=[]; const client={isReady:true,isOpen:true,on(){},async connect(){},async destroy(){},async eval(script,args){calls.push({script,args});return 1;},async set(){return 'OK';}};
    const redis=createRedis('redis://secret',()=>client); await redis.connect();
    assert.equal(await redis.allow('123'),true); assert.equal(await redis.deliverySlot('123'),true);
    const token=await redis.lease('worker'); await redis.release('worker',token); await redis.close();
    assert.ok(calls.at(-1).script.includes('ARGV[1]')); assert.equal(calls.at(-1).args.arguments[0],token);
});
