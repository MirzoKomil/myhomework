const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const ts=require('../student-app/node_modules/typescript');const link=require('../server/services/domworkBot/studentLink');
test('deep links use hashes internally; forged public hash commands cannot act as credentials',()=>{
 const raw='x'.repeat(43),message={text:'/start sl_'+raw,from:{id:9}};
 const source={update_id:1,message},redacted=link.redact(source);
 assert.equal(redacted.message.text,'/start student-link');assert.match(redacted.message._studentLinkHash,/^[a-f0-9]{64}$/);
 assert.equal(source.message.text,'/start sl_'+raw);assert.equal(link.startHash('/start slh_'+redacted.message._studentLinkHash),null);
 assert.equal(link.redact({message:{text:'/start',_studentLinkHash:redacted.message._studentLinkHash}}).message._studentLinkHash,undefined);
 assert.equal(link.startHash('/start sl_'+raw+'junk'),null);
});
function apiFixture(token='fixture'){
 const calls=[],exports={};let response={ok:true,json:async()=>({linked:false,available:true,request:null})};
 const code=ts.transpileModule(fs.readFileSync('student-app/services/telegramLinkApi.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,AbortSignal,require(name){return name==='react-native'?{Platform:{OS:'web'}}:name==='./studentAuthStore'?{ready:async()=>{},getToken:()=>token}:{authedFetch:async(...args)=>{calls.push(args);return response;}};}});
 return{api:exports,calls,setResponse:r=>response=r};
}
test('student API refuses demo requests and uses private bearer transport, no tokens in URL',async()=>{
 const f=apiFixture(null);await assert.rejects(f.api.createTelegramLink());assert.equal(f.calls.length,0);
 const real=apiFixture();await real.api.telegramLinkStatus();await real.api.createTelegramLink();
 assert.equal(real.calls[0][0],'/api/domwork/student-telegram');assert.equal(real.calls[0][1].cache,'no-store');
 assert.equal(real.calls[1][1].method,'POST');assert.deepEqual(JSON.parse(real.calls[1][1].body),{});
 assert.ok(real.calls.every(c=>!c[0].includes('fixture')));
 await real.api.confirmTelegramLink({id:'req',telegram:{id:'800'}});assert.deepEqual(JSON.parse(real.calls[2][1].body),{requestId:'req',telegramId:'800'});
 real.setResponse({ok:false,json:async()=>({error:'So‘rov eskirgan'})});await assert.rejects(real.api.telegramLinkStatus(),/eskirgan/);
});
test('profile entry is Russian-only; approval shows Telegram identity and never asks for password/contact',()=>{
 const profile=fs.readFileSync('student-app/app/(tabs)/profile/index.tsx','utf8'),screen=fs.readFileSync('student-app/app/(tabs)/profile/telegram.tsx','utf8');
 assert.match(profile,/courseLang === 'russian'/);assert.match(profile,/\/profile\/telegram/);
 assert.match(screen,/pending\.telegram\.id/);assert.match(screen,/confirmTelegramLink\(pending\)/);assert.match(screen,/cancelTelegramLink\(pending\)/);
 assert.ok(!screen.includes('TextInput'));assert.ok(!screen.includes('localStorage'));assert.ok(!screen.includes('request_contact'));
});
