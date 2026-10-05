// Read-only, isolated UI QA; never imports the application's database or auth.
const express=require('express');
const path=require('node:path');
const fs=require('node:fs');
const app=express(),root=path.resolve(__dirname,'..');
app.use('/css',express.static(path.join(root,'css')));
app.use('/js',express.static(path.join(root,'js')));
app.get('/',(_req,res)=>res.type('html').send(`<!doctype html><html lang="uz"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Inflow — isolated design QA</title><style>${fs.readFileSync(path.join(root,'css/styles.css'),'utf8').replace(/^@import[^\n]*\n/,'')}
body{padding:163px 16px 16px 292px}.fixture-nav{position:fixed;top:16px;left:292px;right:16px;height:130px;background:var(--surface);border-radius:20px;padding:16px}.fixture-nav button{padding:10px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:12px}@media(max-width:768px){body{padding:217px 10px 10px}.fixture-nav{left:10px;height:180px}}
</style><div class="fixture-nav">Izolyatsiyalangan test — haqiqiy hisoblar ulanmagan<br><button onclick="_financeLang='russian';inflowUI.render()">Rus tili</button><button onclick="_financeLang='english';inflowUI.render()">Ingliz tili</button><button onclick="document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark'">Test mavzusi</button></div><div data-finance-panel="tolovlar" class="active"><div id="inflowRoot"></div></div><div id="history"></div>
<script src="/js/paymentLedger.js"></script><script>
let _financeLang='russian';const STORAGE_KEYS={cashFlow:'cashFlow'};const cache={cashFlow:[]};const getItem=(k,d)=>cache[k]||d,setCachedItem=(k,v)=>cache[k]=v;
const escapeHtml=value=>{const d=document.createElement('div');d.textContent=value;return d.innerHTML;};const renderCashFlow=()=>{};
const fixtureRecords=Array.from({length:29},(_,i)=>({id:'r'+i,studentId:'s'+Math.floor(i/2),language:'russian',name:'O‘quvchi '+i+' Uzun familiya',phone:'+998901234567',paidDate:'2026-10-'+String(5-i%5).padStart(2,'0'),paidTime:'',amount:600000+i*10000,debt:i%2?0:1400000,method:i===0?'card':'unknown',managerId:i===0?'':'m',managerName:i===0?'':'Hamidaxon Boymirzayeva',teacherId:'t',teacherName:'Gulhayoxon Hoshimova',tariff:30,form:i%2?'full':'partial',nextPaymentDate:'2026-10-10',receiptUrl:'',legacyReview:true}));
const apiFetch=async(url,options)=>{if(options?.method&&options.method!=='GET')throw Error('This fixture never writes real data');if(url.includes('cash-reconciliation'))return{manual:[],decisions:[],pending:[]};if(url.includes('/history'))return{summary:{amount:2000000,count:2,debt:0},history:fixtureRecords.slice(0,2).map(r=>({...r,date:r.paidDate,time:'',paid:r.amount})),legacyHistory:[]};return{records:url.includes('language=russian')?fixtureRecords:[],migrationIssues:url.includes('language=russian')?[{source_key:'student:test',reason:'Sana isbotlanmagan',language:'russian',date:'',name:'Test o‘quvchi'}]:[],unscopedIssueCount:0};};
let fixtureExport=null;async function loadXlsxLib(){if(!window.XLSX)await new Promise((ok,no)=>{const s=document.createElement('script');s.src='/js/vendor/xlsx.full.min.js';s.onload=ok;s.onerror=no;document.head.appendChild(s);});XLSX.writeFile=(book,name)=>{fixtureExport={book,name};};}
</script><script src="/js/inflowUI.js"></script><script>inflowUI.render();</script></html>`));
app.listen(8786,'127.0.0.1',()=>process.stdout.write('Isolated inflow QA: http://127.0.0.1:8786\n'));
