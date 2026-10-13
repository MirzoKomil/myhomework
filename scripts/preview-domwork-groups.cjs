// Synthetic UI only: no database, Telegram token, network API or production imports.
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const app = express(), root = path.resolve(__dirname, '..');
app.use('/js', express.static(path.join(root, 'js')));
app.use('/css', express.static(path.join(root, 'css')));
app.get('/', (_req, res) => {
    const css = fs.readFileSync(path.join(root, 'css/styles.css'), 'utf8').replace(/^@import[^\r\n]*(?:\r?\n|$)/, '');
    res.type('html').send(`<!doctype html><html lang="uz"><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Domwork groups — isolated QA</title><style>${css}body{padding:16px} @media(max-width:600px){body{padding:8px}}</style>
        <link rel="stylesheet" href="/css/domworkGroups.css"></head><body>
        <p style="font-size:12px">Izolyatsiyalangan test — haqiqiy server va Telegram ulanmagan</p>
        <section class="settings-panel active" id="settingsPanel-telegram-groups"></section><script>
        const getCurrentUser=()=>({role:fixtureRole}); let fixtureRole='admin',fixtureFail=false;
        const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fixture={teachers:[{id:'a',name:'Gulhayoxon Testova'},{id:'b',name:'Mohinur Testova'}],groups:[
          {id:'trial',type:'trial',name:'Sinov darsi | Gulhayoxon',teacherId:'a',teacherName:'Gulhayoxon Testova',inviteLink:'https://t.me/+abcdef_trial',isDefault:true,archived:false,revision:1,botVerified:false},
          {id:'main',type:'classroom',name:'Asosiy dars | Mohinur',teacherId:'b',teacherName:'Mohinur Testova',inviteLink:'https://t.me/+abcdef_main',isDefault:true,archived:false,revision:1,botVerified:false},
          {id:'other',type:'trial',name:'Uzun nomli boshqa sinov guruhi <img src=x onerror="throw Error(1)">',teacherId:'a',teacherName:'Gulhayoxon Testova',inviteLink:'https://t.me/+abcdef_other',isDefault:false,archived:false,revision:1,botVerified:false}
        ]};
        const fixtureCalls=[];
        async function apiFetch(url,options={}){
          fixtureCalls.push({url,...options});await new Promise(resolve=>setTimeout(resolve,50));
          if(fixtureFail)throw Error('Test: server bilan aloqa yo‘q');
          if(url.includes('/api/domwork/bot')) {
            if(url.endsWith('/discovery'))return {candidates:Array.from({length:50},(_,n)=>({chatId:String(-1005000000-n),title:'Asosiy guruh '+(n+1),state:n===0?'pending':'ready',revision:1,evidence:{title:'Asosiy guruh '+(n+1),teachers:n===1?[]:[{id:'b',name:'Mohinur Testova'}],inviteLink:''}}))};
            if(url.endsWith('/student-groups'))return {students:Array.from({length:120},(_,n)=>({id:'s'+n,name:'O‘quvchi '+n,phone:'+998901234567',teacherId:'b',teacherName:'Mohinur Testova',revision:0,groupId:'',discovery:{state:'ready',reason:'unique',groups:[{id:'main',name:'Asosiy dars | Mohinur'}]}}))};
            if(url.endsWith('/settings'))return {data:{eventsEnabled:true,remindersEnabled:true,reportsEnabled:true},revision:1};
            if(url.endsWith('/awards/preview'))return {sales:{text:'🏆 Kun sotuvchisi\\nDavr: 2026-10-13\\nTest menejer: 20 000 000 UZS'},teachers:{text:'🏆 Kun ustozi\\nTest ustoz: 5 ta tasdiqlangan dars · Baho 4.8 (3)'}};
            if(url.endsWith('/bindings'))return {groups:[]};
            if(url.endsWith('/observed-chats'))return {chats:[{chat_id:'-100123456',title:'Mayoq Test'}]};
            if(url.endsWith('/status'))return {state:'disabled',redisReady:false};
            if(url.endsWith('/leave-requests'))return {requests:[{id:'leave1',name:'Ustoz Test',reason:'Sinov sabab',start_date:'2026-10-12',end_date:'2026-10-13',state:'pending'}]};
            if(url.endsWith('/delivery-status'))return {counts:[{state:'sent',count:5}],failures:[]};
            return {ok:true};
          }
          if(!options.body)return structuredClone(fixture);
          const data=JSON.parse(options.body),id=url.split('/').pop();
          if(url.endsWith('/archive')){const group=fixture.groups.find(g=>g.id===url.split('/').at(-2));group.archived=data.archived;group.isDefault=false;group.revision++;return{group};}
          let group=fixture.groups.find(g=>g.id===id);
          if(group){if(group.revision!==data.revision)throw Error('Guruh boshqa oynada o‘zgartirilgan');Object.assign(group,data);group.revision++;}
          else{group={...data,id:'new'+fixture.groups.length,revision:1,archived:false,botVerified:false};fixture.groups.push(group);}
          group.teacherName=fixture.teachers.find(t=>t.id===group.teacherId)?.name;
          if(group.isDefault)fixture.groups.forEach(g=>{if(g.id!==group.id&&g.type===group.type&&g.teacherId===group.teacherId)g.isDefault=false;});
          return{group};
        }
        </script><script src="/js/domworkBotUI.js"></script><script src="/js/domworkDiscoveryUI.js"></script><script src="/js/domworkGroupsUI.js"></script><script>domworkGroupsUI.render();</script></body></html>`);
});
app.listen(8788, '127.0.0.1', () => process.stdout.write('Isolated Domwork groups QA: http://127.0.0.1:8788\n'));
