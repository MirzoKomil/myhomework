// Synthetic UI preview only: no database, CRM credentials or Telegram traffic.
const express=require('express');
const path=require('node:path');
const app=express();app.use(express.json());let pending=null,linked=false;const calls=[];
const dto=()=>pending?{...pending,expired:new Date(pending.expiresAt)<=new Date()}:null;
app.get('/qa/state',(req,res)=>res.json({calls,linked,pending:dto()}));
app.post('/qa/claim',(req,res)=>{if(pending)pending={...pending,state:'claimed',telegram:{id:'987654321',name:'Sinov Telegram',username:'synthetic_student'}};res.json({ok:true});});
app.get('/api/state/demo-profile',(req,res)=>res.json({name:'Sinov o‘quvchi',studentId:'TEST001',lang:'russian'}));
app.get('/api/state/content',(req,res)=>res.json({courses:[],lessons:[],modules:[],library:{},shop:[]}));
app.get('/api/state/leaderboard',(req,res)=>res.json([]));
app.use('/api/domwork/student-telegram',(req,res)=>{
 calls.push({method:req.method,path:req.path});
 if(!req.get('authorization'))return res.status(401).json({error:'Login kerak'});
 if(req.method==='GET')return res.json({linked,available:true,request:dto()});
 if(req.path==='/confirm'){if(pending?.state!=='claimed')return res.status(409).json({error:'Tasdiq kutilmoqda'});linked=true;pending.state='confirmed';return res.json({ok:true});}
 if(req.path==='/cancel'){if(pending)pending.state='cancelled';return res.json({ok:true});}
 pending={id:'synthetic-request',state:'pending',expiresAt:new Date(Date.now()+300000).toISOString(),telegram:null};
 res.json({request:dto(),url:'https://t.me/Domworkuz_bot?start=sl_SYNTHETIC_DO_NOT_USE'});
});
app.use('/api',(req,res)=>res.json({}));
const dist=path.resolve(__dirname,'../student-app/dist');app.use('/student',express.static(dist,{extensions:['html']}));
app.get('/student/*',(req,res)=>res.sendFile(path.join(dist,'index.html')));
app.listen(8791,'127.0.0.1',()=>process.stdout.write('Synthetic student Telegram preview http://127.0.0.1:8791/student/profile/telegram\n'));
