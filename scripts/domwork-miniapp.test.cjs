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
test('STT: no key → null; Gemini preferred; provider error → null; ElevenLabs fallback',async()=>{
 assert.equal(await miniapp.transcribe(Buffer.from('x'),'audio/ogg',{env:{}}),null);
 assert.equal(await miniapp.transcribe(Buffer.from('x'),'audio/ogg',{env:{GEMINI_API_KEY:'g'},fetchImpl:async()=>({ok:false,status:429})}),null);
 assert.equal(await miniapp.transcribe(Buffer.from('x'),'audio/ogg',{env:{GEMINI_API_KEY:'g'},fetchImpl:async()=>{throw Error('net');}}),null);
 const g=await miniapp.transcribe(Buffer.from('abc'),'audio/webm',{env:{GEMINI_API_KEY:'g',ELEVENLABS_API_KEY:'e'},fetchImpl:async(url,o)=>{
  assert.match(url,/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.5-flash-lite:generateContent$/);
  assert.equal(o.headers['x-goog-api-key'],'g');
  const part=JSON.parse(o.body).contents[0].parts[1].inline_data;assert.equal(part.mime_type,'audio/webm');assert.equal(part.data,Buffer.from('abc').toString('base64'));
  return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:' Меня зовут Дилшод '}]}}]})};}});
 assert.deepEqual(g,{text:'Меня зовут Дилшод',provider:'gemini'});
 const custom=await miniapp.transcribe(Buffer.from('x'),'audio/ogg',{env:{GEMINI_API_KEY:'g',GEMINI_STT_MODEL:'bad model/../x'},fetchImpl:async url=>{
  assert.match(url,/gemini-3\.5-flash-lite/);return {ok:true,json:async()=>({})};}});
 assert.equal(custom.text,'');
 const e=await miniapp.transcribe(Buffer.from('x'),'audio/ogg',{env:{ELEVENLABS_API_KEY:'k'},fetchImpl:async(url,o)=>{
  assert.equal(o.headers['xi-api-key'],'k');assert.equal(o.body.get('language_code'),'rus');return {ok:true,json:async()=>({text:'Меня зовут'})};}});
 assert.equal(e.text,'Меня зовут');
});
test('TTS: missing model (404) → next model; PCM wrapped as WAV; no key → null',async()=>{
 assert.equal(await miniapp.synthesize('Привет',{env:{}}),null);
 const seen=[];
 const r=await miniapp.synthesize('Меня зовут Тимур',{env:{GEMINI_API_KEY:'g',GEMINI_TTS_VOICE:'Kore'},fetchImpl:async(url,o)=>{
  seen.push(url.split('/models/')[1].split(':')[0]);
  if(seen.length===1)return {ok:false,status:404};
  const body=JSON.parse(o.body);assert.deepEqual(body.generationConfig.responseModalities,['AUDIO']);
  assert.equal(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,'Kore');assert.match(body.contents[0].parts[0].text,/Меня зовут Тимур$/);
  return {ok:true,json:async()=>({candidates:[{content:{parts:[{inlineData:{mimeType:'audio/L16;codec=pcm;rate=24000',data:Buffer.alloc(480).toString('base64')}}]}}]})};}});
 assert.equal(seen.length,2);assert.equal(r.mime,'audio/wav');assert.equal(r.bytes.length,44+480);assert.equal(r.bytes.toString('ascii',0,4),'RIFF');
});
module.exports={sign,TOKEN};
