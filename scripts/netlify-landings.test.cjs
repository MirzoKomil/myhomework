const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../integrations/netlify-landings');
const body = source => ({ name:'Synthetic test', phone:'+79991234567', goal:'Erkin muloqot', time:'12:00–16:00',
  telegram:'@synthetic', externalId:source+'_12345678-1234-4234-8234-123456789abc' });
const request = (source, data, origin, headers = {}) => new Request('https://test.netlify.app/.netlify/functions/lead', {
  method:'POST', headers:{'Content-Type':'application/json', Origin:origin || (source==='domwork'?'https://domwork.uz':'https://homeworkuz.uz'),...headers},
  body:typeof data==='string'?data:JSON.stringify(data)
});
for (const source of ['domwork','homework']) {
  test(source+': hosted connectivity probe never sends a creatable lead or returns a secret',async()=>{
    const {createHandler}=await import(pathToFileURL(path.join(root,source,'netlify/lib/lead-handler.mjs')));
    let upstream=400;
    const handler=createHandler(source,{env:{LEADS_WEBHOOK_SECRET:'synthetic-only'},fetcher:async(_url,options)=>{
      assert.deepEqual(JSON.parse(options.body),{name:''});
      return Response.json({error:upstream===400?'Ism kiritilishi shart':'not authorized'},{status:upstream});
    }});
    assert.deepEqual(await (await handler(request(source,{probe:true}))).json(),{ok:true,crmConnected:true});
    upstream=401;assert.equal((await handler(request(source,{probe:true}))).status,502);
    assert.equal((await handler(request(source,{probe:true,name:'not empty'}))).status,400);
  });
  test(source+': configuration diagnosis discloses only safe categories, never credential values',async()=>{
    const {createHandler}=await import(pathToFileURL(path.join(root,source,'netlify/lib/lead-handler.mjs')));
    for(const [secret,kind]of [['','missing'],['one,two','multiple_keys'],['myhomework-leads-dev-secret','legacy_development_key']]){
      const h=createHandler(source,{env:{LEADS_WEBHOOK_SECRET:secret},fetcher:()=>{throw Error('must not call CRM');}});
      const result=await (await h(request(source,{probe:true}))).json();assert.equal(result.configurationIssue,kind);
      assert.equal(Object.hasOwn(result,'value'),false);
      const normal=await (await h(request(source,body(source)))).json();assert.equal(Object.hasOwn(normal,'configurationIssue'),false);
    }
  });
  test(source+': server owns language, source, organic type and new stage; no public secret/private CRM record',async()=>{
    const { createHandler } = await import(pathToFileURL(path.join(root,source,'netlify/lib/lead-handler.mjs')));
    let sent;
    const handler = createHandler(source,{env:{LEADS_WEBHOOK_SECRET:'synthetic-only-secret'},fetcher:async(url,options)=>{
      sent={url,options,payload:JSON.parse(options.body)};
      return Response.json({ok:true,id:'synthetic-lead',lead:{private:'must not expose'}} ,{status:201});
    }});
    const response = await handler(request(source,{...body(source),source:'organik',language:'wrong',leadType:'target',status:'tolov-yopildi',
      utm_source:'campaign',utm_campaign:'test',utm_content:'creative',fbclid:'click'}));
    assert.equal(response.status,200); assert.deepEqual(await response.json(),{ok:true,id:'synthetic-lead',duplicate:false});
    assert.equal(sent.url,'https://myhomework.uz/api/leads');
    assert.equal(sent.payload.source,source); assert.equal(sent.payload.language,source==='domwork'?'russian':'english');
    assert.equal(sent.payload.leadType,'organic'); assert.equal(sent.payload.status,'yangi-lidlar');
    assert.equal(sent.payload.phone,'+79991234567'); assert.ok(sent.payload.contactTime.includes('Maqsad: Erkin muloqot'));
    assert.ok(sent.payload.contactTime.includes('@synthetic')); assert.equal(sent.payload.utm_campaign,'test');
    assert.equal(sent.options.headers['X-Webhook-Secret'],'synthetic-only-secret');
    assert.equal(response.headers.get('Cache-Control'),'no-store');
  });
  test(source+': request validation, exact origins, honeypot and missing config never call CRM',async()=>{
    const { createHandler } = await import(pathToFileURL(path.join(root,source,'netlify/lib/lead-handler.mjs')));
    let calls=0;
    const handler=createHandler(source,{env:{LEADS_WEBHOOK_SECRET:'test-only',URL:'https://mysite.netlify.app'},fetcher:async()=>{calls++;throw Error('must not call');}});
    for (const data of [null,[],{}, {...body(source),name:'A'}, {...body(source),phone:'+123'},
      {...body(source),phone:'+1234567890123456'}, {...body(source),time:'wrong'}, {...body(source),externalId:'known-old-id'}])
      assert.equal((await handler(request(source,data))).status,400);
    assert.equal((await handler(request(source,'{'))).status,400);
    assert.equal((await handler(request(source,{...body(source),extra:'x'.repeat(16000)}))).status,413);
    for (const origin of ['https://evil-domwork.uz','https://domwork.uz.evil.test','null','https://random.netlify.app',
      source==='domwork'?'https://homeworkuz.uz':'https://domwork.uz'])
      assert.equal((await handler(request(source,body(source),origin))).status,403);
    assert.equal((await handler(request(source,body(source),undefined,{'Content-Type':'text/plain'}))).status,415);
    assert.equal((await handler(new Request('https://test.netlify.app'))).status,405);
    assert.equal((await handler(request(source,{...body(source),'bot-field':'spam'}))).status,200);
    const missing=createHandler(source,{env:{},fetcher:async()=>{calls++;}});
    assert.equal((await missing(request(source,body(source)))).status,503); assert.equal(calls,0);
  });
  test(source+': only confirmed CRM receipts succeed; retry ID, duplicate and failures are explicit',async()=>{
    const { createHandler } = await import(pathToFileURL(path.join(root,source,'netlify/lib/lead-handler.mjs')));
    const ids=[];
    let mode='network';
    const handler=createHandler(source,{env:{LEADS_WEBHOOK_SECRET:'test-only'},fetcher:async(url,opts)=>{
      ids.push(JSON.parse(opts.body).externalId);
      if(mode==='network') throw Error('test-only: never disclose this');
      if(mode==='html') return new Response('<html>not saved</html>');
      if(mode==='429') return Response.json({error:'private upstream'},{status:429});
      if(mode==='bad-ok') return Response.json({ok:true});
      if(mode==='401') return Response.json({error:'secret rejected'},{status:401});
      return Response.json({ok:true,id:'existing-synthetic',duplicate:true});
    }});
    for (mode of ['network','html','bad-ok','401','429']) {
      const response=await handler(request(source,body(source)));
      assert.equal(response.status,mode==='429'?429:502);
      assert.ok(!(await response.text()).includes('test-only'));
    }
    mode='success';
    assert.deepEqual(await (await handler(request(source,body(source)))).json(),{ok:true,id:'existing-synthetic',duplicate:true});
    assert.equal(new Set(ids).size,1);
  });
}
test('identical shared files; page initialization is connected without no-cors or public secrets',()=>{
  for (const file of ['public/crm-lead.js','netlify/lib/lead-handler.mjs'])
    assert.equal(fs.readFileSync(path.join(root,'domwork',file),'utf8'),fs.readFileSync(path.join(root,'homework',file),'utf8'));
  for (const source of ['domwork','homework']) {
    const html=fs.readFileSync(path.join(root,source,'public/index.html'),'utf8');
    assert.ok(html.includes("CRMLeadForm.setup(CONFIG, '"+source+"')"));
    assert.ok(!html.includes('no-cors')); assert.ok(!html.includes('LEAD_WEBHOOK'));
    assert.ok(!html.includes('LEADS_WEBHOOK_SECRET')); assert.equal((html.match(/src="\/crm-lead.js"/g)||[]).length,1);
    for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
  }
});
test('international phone normalization never truncates a +7 number or doubles pasted country code',()=>{
  const window={};
  vm.runInNewContext(fs.readFileSync(path.join(root,'domwork/public/crm-lead.js'),'utf8'),{window});
  const normalize=window.CRMLeadForm.fullPhone;
  assert.equal(normalize('+7','999 123 45 67'),'+79991234567');
  assert.equal(normalize('+7KZ','701 123 45 67'),'+77011234567');
  assert.equal(normalize('+998','+998 90 123 45 67'),'+998901234567');
  assert.equal(normalize('+998','901234567'),'+998901234567');
  assert.equal(normalize('other','+49 151 12345678'),'+4915112345678');
  assert.equal(normalize('+7',''), ''); assert.equal(normalize('+7','1234567890123456'),'');
});
