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
 const push=now=>N.telegramPush(pool,now);
 const sent=async()=>(await pool.query("SELECT unique_key,payload FROM domwork_bot_outbox WHERE unique_key LIKE 'staff:%' ORDER BY created_at")).rows;
 const guide=async(id,title)=>{const rows=JSON.parse((await pool.query("SELECT data FROM json_data WHERE key='guides'")).rows[0]?.data||'[]');
  rows.push({id,title,targetRoles:['sales_manager'],createdAt:new Date().toISOString()});
  await pool.query("INSERT INTO json_data(key,data) VALUES('guides',$1) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data",[JSON.stringify(rows)]);};
 const D=new Date().toISOString().slice(0,10);
 const at=(h,m=0)=>new Date(`${D}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`); // UTC; Toshkent = +5
 const NOON=at(7), NOON2=at(7,2), NOON4=at(7,4), NIGHT=at(19), NIGHT2=at(19,2);
 const keepAlive=t=>pool.query("UPDATE staff_notify_tg_state SET last_push_at=$1",[t]); // uzluksiz ishlagan deb faraz
 process.env.DOMWORK_BOT_ENABLED='true';
 try{
  await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,phone TEXT,bio TEXT,avatar TEXT,created_at TIMESTAMPTZ DEFAULT NOW(),disabled_at TIMESTAMPTZ);
   CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN,phone TEXT);
   CREATE TABLE user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
   CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,extra_data JSONB,teacher_id TEXT);
   CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,language TEXT,status TEXT,deleted_at TIMESTAMPTZ);
   CREATE TABLE sessions(user_id TEXT,jti TEXT PRIMARY KEY);
   CREATE TABLE json_data(key TEXT PRIMARY KEY,data TEXT);
   CREATE TABLE school_edit_requests(id TEXT PRIMARY KEY,student_id TEXT,requested_by TEXT,status TEXT,decided_at TIMESTAMPTZ,kind TEXT);
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
   await pool.query('UPDATE staff_notify_tg_state SET last_push_at=NOW()');assert.equal((await N.getPrefs(pool,{id:'u-s'})).channels.telegram.connected,true);
   await pool.query('UPDATE staff_notify_tg_state SET last_push_at=$1',[NOON]); // test vaqt o'qiga qaytarish
  });
  await t.test('a new event goes to Telegram once, with a CRM button',async()=>{
   await guide('g-new','Yangi sotuv skripti');
   assert.equal(await push(NOON2),1);assert.equal(await push(NOON4),0);
   const [row]=await sent();assert.match(row.payload.text,/Yangi yo'riqnoma\nYangi sotuv skripti/);
   assert.equal(row.payload.reply_markup.inline_keyboard[0][0].url,'https://myhomework.uz/');
  });
  await t.test('quiet hours hold non-urgent items until morning; Telegram off in prefs → never sent',async()=>{
   await guide('g-night','Tungi yo‘riqnoma');
   await keepAlive(new Date(NIGHT-60000));
   assert.equal(await push(NIGHT),0); // 00:00 Toshkent — tinch soat
   await keepAlive(new Date(NIGHT2-60000));
   await pool.query(`UPDATE staff_notify_prefs SET prefs=prefs||'{"quiet":{"from":"22:00","to":"08:00","off":true}}' WHERE user_id='u-s'`);
   assert.equal(await push(NIGHT2),1); // tinch soat o'chirilgan — darhol
   await pool.query(`UPDATE staff_notify_prefs SET prefs=prefs-'quiet' WHERE user_id='u-s'`);
   await pool.query(`UPDATE staff_notify_prefs SET prefs='{"types":{"guide_new":{"tg":false,"web":true}}}' WHERE user_id='u-s'`);
   await guide('g-off','Faqat panel');
   await keepAlive(new Date(NIGHT2.getTime()+60000));
   assert.equal(await push(new Date(NIGHT2.getTime()+120000)),0);
   assert.equal((await sent()).length,2);
   // Panel o'zgarmaydi: Telegram yoqilgan bo'lsa ham xabarlar panelda qoladi.
   const panel=await N.feed(pool,{id:'u-s'});assert.ok(panel.events.some(e=>e.id==='guide:g-new'));
  });
  await t.test('paused (/stop) or unlinked staff get nothing',async()=>{
   await pool.query(`UPDATE staff_notify_prefs SET prefs='{"types":{"guide_new":{"tg":true,"web":true}}}' WHERE user_id='u-s'`);
   await pool.query("UPDATE domwork_bot_links SET paused=true WHERE telegram_id='810'");
   await guide('g-paused','To‘xtatilgan');
   assert.equal(await push(new Date(NIGHT2.getTime()+240000)),0);
  });
  await t.test('after a gap (paused/off/bot down) old items are re-baselined, not flooded; several new ones come as one digest',async()=>{
   await pool.query("UPDATE domwork_bot_links SET paused=false WHERE telegram_id='810'");
   const later=new Date(NOON.getTime()+86400000); // ertasi kun 12:00 Toshkent
   assert.equal(await push(later),0); // 1 soatlik uzilish — qayta boshlang'ich
   for(const i of [1,2,3,4])await guide('g-d'+i,'Yangi '+i);
   assert.equal(await push(new Date(later.getTime()+120000)),4);
   const last=(await sent()).at(-1);assert.match(last.payload.text,/^🔔 4 ta yangi xabar:/);
   assert.ok(!(await sent()).some(r=>/To‘xtatilgan/.test(r.payload.text)));
  });
 }finally{delete process.env.DOMWORK_BOT_ENABLED;await pool.end();}
});
