// Local synthetic browser QA only. NEVER imports CRM/db.js or calls the internet.
const express=require('express'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const app=express(),root=path.resolve(__dirname,'../integrations/netlify-landings');
let mode='success';const calls=[];
app.use(express.json());
for(const source of ['domwork','homework']) app.use('/'+source,express.static(path.join(root,source,'public')));
app.get('/crm-lead.js',(_req,res)=>res.sendFile(path.join(root,'domwork/public/crm-lead.js')));
app.post('/__qa/mode',(req,res)=>{mode=req.body.mode;res.json({ok:true});});
app.get('/__qa/calls',(_req,res)=>res.json({calls}));
app.post('/.netlify/functions/lead',async(req,res)=>{
  const source=new URL(req.headers.referer).pathname.startsWith('/domwork/')?'domwork':'homework';
  const {createHandler}=await import(pathToFileURL(path.join(root,source,'netlify/lib/lead-handler.mjs')));
  const handler=createHandler(source,{env:{LEADS_WEBHOOK_SECRET:'local-synthetic-only'},fetcher:async(_url,options)=>{
    calls.push(JSON.parse(options.body));
    await new Promise(resolve=>setTimeout(resolve,100));
    if(mode==='failure')throw Error('mock network failure');
    return Response.json({ok:true,id:'synthetic-id',duplicate:calls.slice(0,-1).some(c=>c.externalId===calls.at(-1).externalId)});
  }});
  const response=await handler(new Request('https://test.netlify.app/.netlify/functions/lead',{
    method:'POST',headers:{'Content-Type':'application/json',Origin:'https://'+(source==='domwork'?'domwork.uz':'homeworkuz.uz')},body:JSON.stringify(req.body)
  }));
  res.status(response.status).type('json').send(await response.text());
});
app.post('/',(_req,res)=>res.json({ok:true}));
app.listen(8791,'127.0.0.1',()=>console.log('Synthetic landing QA: http://127.0.0.1:8791/domwork/ and /homework/'));
