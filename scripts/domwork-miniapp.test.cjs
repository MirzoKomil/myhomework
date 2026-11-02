const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const miniapp=require('../server/services/domworkBot/miniapp');
const TOKEN='123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
function sign(fields,token=TOKEN){
 const p=new URLSearchParams(fields);
 const check=[...p.entries()].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>`${k}=${v}`).join('\n');
 const secret=createHmac('sha256','WebAppData').update(token).digest();
 p.set('hash',createHmac('sha256',secret).update(check).digest('hex'));return p.toString();
}
const now=Date.now(),user=JSON.stringify({id:701,first_name:'Dilshod'});
test('initData: valid signature accepted, tampering/old/foreign token rejected',()=>{
 const ok=sign({auth_date:String(Math.floor(now/1000)),user,start_param:'ig_reels12'});
 const a=miniapp.verifyInitData(ok,TOKEN,{now});
 assert.equal(a.user.id,701);assert.equal(a.startParam,'ig_reels12');
 assert.throws(()=>miniapp.verifyInitData(ok.replace('Dilshod','Hacker'),TOKEN,{now}),{status:401});
 assert.throws(()=>miniapp.verifyInitData(ok,TOKEN.replace('A','B'),{now}),{status:401});
 assert.throws(()=>miniapp.verifyInitData(sign({auth_date:String(Math.floor(now/1000)-90000),user}),TOKEN,{now}),/eskirgan/);
 assert.throws(()=>miniapp.verifyInitData('',TOKEN,{now}),{status:401});
 assert.throws(()=>miniapp.verifyInitData(ok,'',{now}),{status:503});
 assert.throws(()=>miniapp.verifyInitData(sign({auth_date:String(Math.floor(now/1000)),user:'{"id":-5}'}),TOKEN,{now}),{status:401});
});
test('speech match: stress/ё ignored, name skipped, case ending = near',()=>{
 const want='Меня́ зову́т Дилшо́д. Мне 32 го́да. Я рабо́таю в ба́нке.';
 const full=miniapp.matchSpeech(want,'меня зовут дильшот мне 32 года я работаю в банке',{skip:['Дилшод']});
 assert.equal(full.score,100);assert.equal(full.level,'ok');
 const ending=miniapp.matchSpeech(want,'меня зовут мне 32 года я работаю в банк',{skip:['Дилшод']});
 assert.ok(ending.words.find(w=>w.word==='банке').near);assert.ok(ending.score>=90&&ending.score<100);
 assert.equal(miniapp.matchSpeech(want,'привет',{skip:['Дилшод']}).level,'retry');
 assert.equal(miniapp.matchSpeech('Ёлка','елка').score,100);
});
test('STT: no API key → null (unscored), provider error → null',async()=>{
 assert.equal(await miniapp.transcribe(Buffer.from('x'),'audio/ogg',{apiKey:''}),null);
 assert.equal(await miniapp.transcribe(Buffer.from('x'),'audio/ogg',{apiKey:'k',fetchImpl:async()=>({ok:false})}),null);
 const r=await miniapp.transcribe(Buffer.from('x'),'audio/ogg',{apiKey:'k',fetchImpl:async(url,o)=>{
  assert.equal(o.headers['xi-api-key'],'k');assert.equal(o.body.get('language_code'),'rus');return {ok:true,json:async()=>({text:'Меня зовут'})};}});
 assert.equal(r.text,'Меня зовут');
});
module.exports={sign,TOKEN};
