const {test}=require('node:test');
const assert=require('node:assert/strict');
const store=require('../server/services/domworkBot/store');
const events=require('../server/services/domworkBot/events');
const scheduler=require('../server/services/domworkBot/scheduler');
const live=require('../server/services/domworkBot/live');
test('live feed: telefon-login ism bilan almashtiriladi, mas’ul menejer ko‘rsatiladi',async()=>{
 const sent=[];
 store.settings=async()=>({data:{liveFeedEnabled:true}});
 scheduler.roles=async()=>[{telegramId:'1',role:'admin'}];
 events.privateMessage=async(db,key,person,text)=>sent.push(text);
 const audit=[
  {id:11,lead_id:'L1',action:'updated',actor_id:'u7',actor_name:'+998907681295',snapshot:{before:{name:'Sherzod',status:'boglanishga-urinilmoqda',managerId:'h1'},after:{name:'Sherzod',status:'boglanildi',managerId:'h1',language:'russian'}}},
  {id:12,lead_id:'L2',action:'updated',actor_id:'u7',actor_name:'+998907681295',snapshot:{before:{name:'Guzal',status:'boglanishga-urinilmoqda',managerId:'h2'},after:{name:'Guzal',status:'muvaffaqiyatsiz-sotuv',managerId:'h2',language:'russian'}}}
 ];
 const db={query:async(sql)=>{
  if(/FROM domwork_bot_live_cursor/.test(sql))return{rows:[{value:10}]};
  if(/FROM lead_audit/.test(sql))return{rows:audit};
  if(/FROM leads/.test(sql))return{rows:[{id:'L1',language:'russian'},{id:'L2',language:'russian'}]};
  if(/SELECT id,name,login,phone,email FROM hr_employees/.test(sql))return{rows:[{id:'h1',name:'Hamida Boymirzayeva',login:'998907681295',phone:'',email:''},{id:'h2',name:'Sevinch Ibrohimova',login:'x',phone:'',email:''}]};
  if(/FROM hr_employees/.test(sql))return{rows:[{id:'h1',name:'Hamida Boymirzayeva'},{id:'h2',name:'Sevinch Ibrohimova'}]};
  if(/FROM users/.test(sql))return{rows:[{id:'u7',name:'+998907681295',email:'+998907681295'}]};
  return{rows:[]};
 }};
 await live.leadFeed(db);
 assert.equal(sent.length,2);
 assert.match(sent[0],/<b>Hamida Boymirzayeva<\/b>: <b>Sherzod<\/b>/);
 assert.match(sent[0],/Mas’ul: <b>Hamida Boymirzayeva<\/b>/);
 assert.match(sent[1],/Mas’ul: <b>Sevinch Ibrohimova<\/b>/);
 assert.doesNotMatch(sent.join('\n'),/\+998907681295/);
});
