const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const store=require('../server/services/domworkBot/store');
const queue=require('../server/services/domworkBot/queue');
const groups=require('../server/services/domworkGroups');
const ST=require('../server/services/staffSettings');
const N=require('../server/services/staffNotify');
const url=process.env.PAYROLL_TEST_DATABASE_URL;
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||!/^\/payroll_test_[a-z0-9]+$/.test(u.pathname))throw Error('Only disposable loopback DBs');}
test('CRM staff notifications reach Telegram — synthetic data',{skip:!url},async t=>{
 const pool=new Pool({connectionString:url});
 const push=now=>queue.transaction(pool,db=>N.telegramPush(db,now));
 const sent=async()=>(await pool.query("SELECT unique_key,payload FROM domwork_bot_outbox WHERE unique_key LIKE 'staff:%' ORDER BY created_at")).rows;
 const guide=async(id,title)=>{const rows=JSON.parse((await pool.query("SELECT data FROM json_data WHERE key='guides'")).rows[0]?.data||'[]');
  rows.push({id,title,targetRoles:['sales_manager'],createdAt:new Date().toISOString()});
  await pool.query("INSERT INTO json_data(key,data) VALUES('guides',$1) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data",[JSON.stringify(rows)]);};
 const NOON=new Date(new Date().toISOString().slice(0,10)+'T07:00:00Z'), NIGHT=new Date(new Date().toISOString().slice(0,10)+'T19:00:00Z'); // 12:00 / 00:00 Toshkent
 process.env.DOMWORK_BOT_ENABLED='true';
 try{
  await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,phone TEXT,bio TEXT,avatar TEXT,created_at TIMESTAMPTZ DEFAULT NOW(),disabled_at TIMESTAMPTZ);
   CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN,phone TEXT);
   CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
   CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,extra_data JSONB,teacher_id TEXT);
   CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,language TEXT,status TEXT,deleted_at TIMESTAMPTZ);
   CREATE TABLE sessions(user_id TEXT,jti TEXT PRIMARY KEY);
   CREATE TABLE json_data(key TEXT PRIMARY KEY,data TEXT);
   INSERT INTO users(id,name,email,role,phone) VALUES('u-s','Dilnoza','dilnoza@x','sales_manager','+998907000001');
   INSERT INTO hr_employees VALUES('h-s','Dilnoza','dilnoza@x','sotuv-menejeri','active','russian',false,'+998907000001');`);
  await ST.initSchema(pool);await groups.initSchema(pool);await store.initSchema(pool);
  await pool.query("INSERT INTO domwork_bot_links(telegram_id,account_kind,account_id,phone) VALUES('810','user','u-s','998907000001')");
  await pool.query(`INSERT INTO staff_notify_prefs(user_id,prefs) VALUES('u-s','{"types":{"guide_new":{"tg":true,"web":true}}}')`);
  await guide('g-old','Eski yo‘riqnoma');

  await t.test('off by default: nothing is sent and the panel still shows Telegram-only items',async()=>{
   assert.equal(await push(NOON),0);assert.equal((await sent()).length,0);
   assert.equal((await N.getPrefs(pool,{id:'u-s'})).channels.telegram.connected,false);
  });
  await pool.query("UPDATE domwork_bot_settings SET data=data||'{\"staffNotifyEnabled\":true}'::jsonb");
  await t.test('first run only sets a baseline — existing items are not flooded',async()=>{
   assert.equal(await push(NOON),0);assert.equal((await sent()).length,0);
   assert.equal((await N.getPrefs(pool,{id:'u-s'})).channels.telegram.connected,true);
  });
  await t.test('a new event goes to Telegram once, with a CRM button',async()=>{
   await guide('g-new','Yangi sotuv skripti');
   assert.equal(await push(NOON),1);assert.equal(await push(NOON),0);
   const [row]=await sent();assert.match(row.payload.text,/Yangi yo'riqnoma\nYangi sotuv skripti/);
   assert.equal(row.payload.reply_markup.inline_keyboard[0][0].url,'https://myhomework.uz/');
  });
  await t.test('quiet hours hold non-urgent items until morning; Telegram off in prefs → never sent',async()=>{
   await guide('g-night','Tungi yo‘riqnoma');
   assert.equal(await push(NIGHT),0);
   assert.equal(await push(NOON),1);
   await pool.query(`UPDATE staff_notify_prefs SET prefs='{"types":{"guide_new":{"tg":false,"web":true}}}' WHERE user_id='u-s'`);
   await guide('g-off','Faqat panel');
   assert.equal(await push(NOON),0);
   assert.equal((await sent()).length,2);
  });
  await t.test('paused (/stop) or unlinked staff get nothing',async()=>{
   await pool.query(`UPDATE staff_notify_prefs SET prefs='{"types":{"guide_new":{"tg":true,"web":true}}}' WHERE user_id='u-s'`);
   await pool.query("UPDATE domwork_bot_links SET paused=true WHERE telegram_id='810'");
   await guide('g-paused','To‘xtatilgan');
   assert.equal(await push(NOON),0);
  });
 }finally{delete process.env.DOMWORK_BOT_ENABLED;await pool.end();}
});
