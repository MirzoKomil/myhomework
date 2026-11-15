'use strict';
// Jonli ofis (/ofis) — CRM ma'lumoti (GET /api/office/live) asosida chizilgan ofisda jamoa harakatlanadi.
// Rasm: /ofis/office.webp (ChatGPT'da chizilgan; qayta chizilsa IMAP nuqtalari moslanadi).
(() => {
const W0 = 800, H0 = 1440, DX = 505;
const R = {
 entrance:{x:0,y:0,w:800,h:140,label:'Kirish · Face ID',ny:145},
 sotuv:{x:0,y:150,w:495,h:370,label:"Sotuv bo'limi",ny:335},
 rop:{x:515,y:150,w:285,h:180,label:'Akademik rahbar',ny:240},
 akad:{x:515,y:340,w:285,h:180,label:'Yordamchi ustozlar',ny:430},
 oquv:{x:0,y:530,w:495,h:270,label:"O'quvchilar · mobil ilova",ny:665},
 hr:{x:515,y:530,w:285,h:270,label:'HR · Marketing',ny:665},
 kassa:{x:0,y:810,w:495,h:190,label:'Kassa · Moliya',ny:905},
 oshxona:{x:515,y:810,w:285,h:190,label:'Oshxona · tanaffus',ny:905},
 jonli:{x:0,y:1010,w:495,h:420,label:'Jonli darslar zali',ny:1220},
 sinov:{x:515,y:1010,w:285,h:200,label:'Sinov darslari zali',ny:1110},
 bosh:{x:515,y:1220,w:285,h:210,label:"Bo'sh ustozlar",ny:1325}
};
const IMAP={
 entrance:{xs:[[0,31],[400,573],[505,695],[800,1144]],ys:[[-40,-12],[0,20],[95,183],[145,256]]},
 sotuv:{xs:[[0,26],[495,643]],ys:[[150,277],[520,773]]},
 rop:{xs:[[515,744],[585,925],[800,1144]],ys:[[150,277],[282,345],[320,470],[330,515]]},
 akad:{xs:[[515,744],[585,834],[670,944],[752,1052],[800,1144]],ys:[[340,530],[437,731],[520,775]]},
 oquv:{xs:[[0,26],[52,214],[376,533],[495,643]],ys:[[530,796],[640,878],[752,1055],[800,1087]]},
 hr:{xs:[[515,744],[600,940],[800,1144]],ys:[[530,796],[692,893],[730,1010],[800,1082]]},
 kassa:{xs:[[0,26],[250,340],[495,643]],ys:[[810,1106],[897,1223],[937,1340],[1000,1377]]},
 oshxona:{xs:[[515,744],[660,859],[800,1144]],ys:[[810,1106],[918,1290],[1000,1374]]},
 jonli:{xs:[[0,22],[495,650]],ys:[[1010,1392],[1430,2025]]},
 sinov:{xs:[[515,744],[800,1150]],ys:[[1010,1390],[1210,1672]]},
 bosh:{xs:[[515,744],[800,1144]],ys:[[1220,1688],[1430,2038]]}};
const CORY=[[-40,-12],[0,20],[140,256],[150,277],[330,515],[340,530],[520,775],[530,796],[800,1082],[810,1106],[1000,1374],[1010,1390],[1210,1672],[1220,1688],[1430,2038]];
function amap(pts,v){let i=0;while(i<pts.length-2&&v>pts[i+1][0])i++;const a=pts[i],b=pts[i+1];return a[1]+(v-a[0])*(b[1]-a[1])/(b[0]-a[0])}
const ainv=(pts,v)=>amap(pts.map(q=>[q[1],q[0]]),v);
function roomOf(x,y){if(y<145)return 'entrance';for(const k in R){const r=R[k];if(x>=r.x-.5&&x<=r.x+r.w+.5&&y>=r.y-.5&&y<=r.y+r.h+.5)return k}return null}
function ill(x,y){const k=roomOf(x,y);if(k){const m=IMAP[k];return{x:amap(m.xs,x),y:amap(m.ys,y)}}return{x:695+(x-505)*1.5,y:amap(CORY,y)}}
function illInv(X,Y){for(const k in IMAP){const m=IMAP[k];if(X>=m.xs[0][1]&&X<=m.xs[m.xs.length-1][1]&&Y>=m.ys[0][1]&&Y<=m.ys[m.ys.length-1][1])return{x:ainv(m.xs,X),y:ainv(m.ys,Y)}}return{x:505+(X-695)/1.5,y:ainv(CORY,Y)}}
const rnd=(a,b)=>a+Math.random()*(b-a), ri=(a,b)=>Math.floor(rnd(a,b+1)), pick=a=>a[Math.floor(Math.random()*a.length)];
const money=n=>Math.round(n||0).toLocaleString('ru-RU').replace(/[,  ]/g,' ');
const hm=d=>{const t=new Date(new Date(d).getTime()+5*3600000);return String(t.getUTCHours()).padStart(2,'0')+':'+String(t.getUTCMinutes()).padStart(2,'0')};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))|0;return Math.abs(h)};
const SKIN=['#F2C9A0','#E8B58C','#D9A27A','#F5D3B3'],HAIR=['#2B1B12','#4A2E1C','#1B1B1B','#6B3E22'];
const SH=['#1F4FD8','#0EA5E9','#7C3AED','#DB2777','#059669','#EA580C','#334155','#CA8A04'];
const KIND_LABEL={mgr:'Sotuv menejeri',rop:'ROP',akad:'Akademik rahbar',yord:'Yordamchi ustoz',hr:'HR',teacher:'Ustoz'};
const FEM=/a$|ya$|xon$|oy$|gul|nur|niso|sevar|zuhr|dil|mohi|shah?lo|lola|rano|feruz|kamol|madin/i;

// ── Joylar (dunyo koordinatalari, rasmga IMAP orqali) ──
// Sotuv bo'limi (16-noy): 15 ta menejer stoli (3 qator × 5) va ROP stoli shu xonada, doska oldida jamoaga qarab.
// Rasm koordinatalari: stol chap-yuqori burchagi (c, r), stul markazi (c+42, r+60), odam (c+42, r+70).
const MGR_SEATS=[];for(const r of [498,586,674])for(const c of [68,188,308,428,548]){const w=illInv(c+42,r+70);MGR_SEATS.push([w.x,w.y])}
const ROP_DESK=(()=>{const w=illInv(361,411);return[w.x,w.y]})();
const ROP_SEAT=[585,282], AK_SEATS=[[585,437],[670,437],[752,437],[630,480]], HR_SEAT=[600,692];
const BAGS=[];for(let r=0;r<3;r++)for(let c=0;c<4;c++)BAGS.push([52+c*108,640+r*56]);
// Jonli darslar: 20 ta 1+1 kabinka (rasm koordinatalari). Har birida stol, chapda ustoz, o'ngda o'quvchi.
const CABX=[97,220,343,467,591],CABY=[1488,1645,1800,1953],CWX=[20,151,276,401,528,650],CWY=[1392,1549,1707,1864,2025];
const CAB=[];for(let r=0;r<4;r++)for(let c=0;c<5;c++)CAB.push({cx:CABX[c],cy:CABY[r],x0:CWX[c],x1:CWX[c+1],y0:CWY[r],y1:CWY[r+1]});
// Sinov darslari zali: 6 ta 1+1 stol (rasm koordinatalari; ustoz chapda, o'quvchi o'ngda).
const TRIAL_I=[[836,1485],[950,1485],[1060,1485],[836,1576],[950,1576],[1060,1576]];
const LOUNGE=[[565,1305],[630,1305],[695,1305],[755,1305],[600,1392],[715,1392],[660,1260]];
const KITCHEN=[[620,880],[700,880],[620,955],[700,955],[760,915],[560,915]];
const BENCH=(i)=>[48+(i%9)*19,206];

// ── Holat ──
const API='/api/office/live';
let token=null,user=null,data=null,cursor=null,lastOk=0,firstLoad=true,langSel=null;
const params=new URLSearchParams(location.search);const TV=params.get('tv')==='1';
const people=new Map();   // id -> person (xodim, ustoz, o'quvchi, lid)
const fx=[];let toastT,bigT,turnFlash=null;
const nameOf=id=>(data&&data.names&&data.names[id])||'';

function mkPerson(id,o){let p=people.get(id);if(p)return Object.assign(p,o);const h=hash(id);
 p=Object.assign({id,x:400,y:-30,path:[],room:'outside',bubble:null,walk:0,visible:true,skin:SKIN[h%4],hair:HAIR[(h>>3)%4],shirt:SH[(h>>5)%SH.length],female:FEM.test(o.name||'')},o);
 people.set(id,p);return p}
function moveTo(p,room,x,y,cb){const pts=[];
 if(p.room==='outside'){pts.push({x:400,y:95,gate:1});pts.push({x:DX,y:R.entrance.ny});p.room='entrance'}
 if(room==='outside'){if(p.room!=='entrance')pts.push({x:DX,y:R[p.room].ny});pts.push({x:DX,y:R.entrance.ny});pts.push({x:400,y:95,gate:2});pts.push({x:400,y:-34})}
 else{if(p.room!==room){pts.push({x:DX,y:R[p.room].ny});pts.push({x:DX,y:R[room].ny})}pts.push({x,y})}
 p.path=pts;p.room=room;p.cb=cb}
function place(p,room,x,y){p.room=room;p.x=x;p.y=y;p.path=[];p.visible=true}
function say(p,icon,text,sec=6,color){if(p)p.bubble={icon,text,until:performance.now()+sec*1000,color}}
function leave(p){moveTo(p,'outside',0,0,()=>{p.visible=false;people.delete(p.id)})}
function step(p,dt){if(!p.path.length)return;const w=p.path[0],dx=w.x-p.x,dy=w.y-p.y,d=Math.hypot(dx,dy),v=120*dt;p.walk+=dt;
 if(d<=v){p.x=w.x;p.y=w.y;p.path.shift();if(w.gate&&p.kind!=='lead')turnFlash={c:w.gate===1?(p.lateFlash?'#F59E0B':'#16A34A'):'#1F4FD8',until:performance.now()+1500};if(!p.path.length){p.walk=0;const cb=p.cb;p.cb=null;cb&&cb()}}
 else{p.x+=dx/d*v;p.y+=dy/d*v}}

// ── Joylashtirish (surat → sahna) ──
function seatFor(s,idx){if(s.kind==='mgr'){const i=idx.mgr++;return ['sotuv',...(MGR_SEATS[i]||[60+i*30,470])]}
 if(s.kind==='rop')return['sotuv',...ROP_DESK];if(s.kind==='akad')return['rop',...ROP_SEAT];if(s.kind==='yord'){const i=idx.ak++;return['akad',...(AK_SEATS[i]||[560+i*30,500])]}
 if(s.kind==='hr')return['hr',...HR_SEAT];return['hr',650+idx.x++*25,760]}
const LUNCH_SEATS=[[560,880],[610,880],[660,880],[710,880],[760,880],[560,950],[610,950],[660,950],[710,950],[760,950]];
function breakSpot(s,idx){if(s.now==='lunch'||s.now==='lunch_late'){const i=idx.lunch=(idx.lunch||0)+1;return['oshxona',...(LUNCH_SEATS[(i-1)%LUNCH_SEATS.length])]}
 if(s.now==='out'||s.now==='step_late')return['outside'];return null}
// Ustoz ofisda faqat darsda, sinovda yoki sinovga ochiq bo'sh vaqtida; tanaffus/band/smenadan tashqari — ofisdan chiqadi.
const AWAY={break:['🚪','Tanaffusda'],leave:['🌴',"Ta'tilda"],busy:['⛔','Band'],off:['🌙','Smenada emas']};
const awayOf=t=>AWAY[t.awayWhy]||AWAY.off;
function teacherSpot(t,i){if(t.status==='away')return['outside'];if(t.status==='live'){const c=CAB[i%CAB.length],w=illInv(c.cx-33,c.cy+12);return['jonli',w.x,w.y]}
 if(t.status==='trial'){const k=trialTables.get(t.id)??0,[tx,ty]=TRIAL_I[k],w=illInv(tx-28,ty+12);return['sinov',w.x,w.y]}
 const l=LOUNGE[i%LOUNGE.length];return['bosh',l[0],l[1]]}
const trialTables=new Map();
function assignTrialTables(){const used=new Set();for(const t of data.teachers)if(t.status==='trial'&&trialTables.has(t.id))used.add(trialTables.get(t.id));
 for(const t of data.teachers){if(t.status!=='trial'){trialTables.delete(t.id);continue}if(!trialTables.has(t.id)){let k=[0,1,2,3,4,5].find(x=>!used.has(x));if(k==null)k=0;trialTables.set(t.id,k);used.add(k)}}}

const AV=new Map();   // id -> {src,img} — avatar faqat birinchi yuklashda keladi, keyin shu yerda saqlanadi
function avatarImg(id,src){if(!src)return AV.get(id)?.img||null;let a=AV.get(id);if(!a||a.src!==src){const img=new Image();img.src=src;a={src,img};AV.set(id,a)}return a.img}
const greeted=new Set();
function applySnapshot(d,animate){
 const prevT=new Map((data?.teachers||[]).map(t=>[t.id,t]));
 const prevS=new Map((data?.staff||[]).map(s=>[s.id,s]));
 data=d;assignTrialTables();
 const idx={mgr:0,ak:0,x:0};
 for(const s of d.staff){const [room,x,y]=seatFor(s,idx);const p=mkPerson('s:'+s.id,{name:s.name,kind:s.kind,staff:s,seat:[room,x,y]});
  if(s.female!=null)p.female=s.female;p.av=avatarImg('s:'+s.id,s.avatar);p.crown=!!s.crown;p.fire=!!s.fire;p.birthday=!!s.birthday;applyLook(p,s.look);
  const ps=prevS.get(s.id);
  if(animate&&ps&&!ps.fire&&s.fire){say(p,'🔥','Olovda! '+s.salesToday+' ta sotuv',10,'#EA580C');feed('🔥',`${esc(s.name)} olovda — bugun ${s.salesToday} ta sotuv!`,'#EA580C')}
  if(animate&&ps&&!ps.crown&&s.crown&&s.salesToday>0){feed('👑',`${esc(s.name)} — kun qahramoni (${s.salesToday} ta sotuv)`,'#B45309');setTimeout(()=>SND.voice('qahramon'),5000)}
  if(s.birthday&&!greeted.has(s.id)){greeted.add(s.id);feed('🎂',`Bugun ${esc(s.name)}ning tug'ilgan kuni! Tabriklaymiz!`,'#DB2777')}
  // Obed / vaqtincha chiqish: obedda — Oshxona, ruxsat bilan tashqarida — binodan chiqadi.
  const brk=breakSpot(s,idx);
  if(brk&&brk[0]==='oshxona'){if(!p.visible||p.room==='outside'){if(animate){p.visible=true;p.x=400;p.y=-30;p.room='outside';moveTo(p,...brk)}else place(p,...brk)}
   else if(!p.path.length&&(p.room!=='oshxona'||Math.hypot(p.x-brk[1],p.y-brk[2])>4))moveTo(p,...brk);
   if(animate&&ps&&ps.now!==s.now&&s.now==='lunch_late')feed('⏱',`${esc(s.name)} obeddan kech qolmoqda`,'#DC2626')}
  else if(brk&&brk[0]==='outside'){if(p.visible&&p.room!=='outside'){if(animate)leave(p);else{p.visible=false;p.room='outside'}}
   if(animate&&ps&&ps.now!==s.now&&s.now==='step_late')feed('⏱',`${esc(s.name)} ruxsatdan kech qolmoqda`,'#DC2626')}
  else if(s.inOffice){if(!p.visible||p.room==='outside'){if(animate){p.visible=true;p.x=400;p.y=-30;p.room='outside';p.lateFlash=!!s.late;moveTo(p,room,x,y)}else place(p,room,x,y)}
   else if(!p.path.length&&(p.room!==room||Math.hypot(p.x-x,p.y-y)>4)&&!p.away)moveTo(p,room,x,y)}
  else if(p.visible&&p.room!=='outside'){if(animate)leave(p);else{p.visible=false;p.room='outside'}}
  else if(!s.inOffice){p.visible=false;p.room='outside'}}
 for(const [id,p] of people)if(id.startsWith('s:')&&!d.staff.some(s=>'s:'+s.id===id)){people.delete(id)}
 d.teachers.forEach((t,i)=>{const [room,x,y]=teacherSpot(t,i);const p=mkPerson('t:'+t.id,{name:t.name,kind:'teacher',teacher:t,ti:i});if(t.female!=null)p.female=t.female;p.av=avatarImg('t:'+t.id,t.avatar);p.birthday=!!t.birthday;applyLook(p,t.look);
  if(t.birthday&&!greeted.has('t'+t.id)){greeted.add('t'+t.id);feed('🎂',`Bugun ustoz ${esc(t.name)}ning tug'ilgan kuni! Tabriklaymiz!`,'#DB2777')}
  const prev=prevT.get(t.id);
  if(room==='outside'){if(animate&&prev&&prev.status!=='away'&&p.visible&&p.room!=='outside'){const a=awayOf(t);say(p,a[0],a[1],5,'#64748B');feed(a[0],`Ustoz ${esc(t.name)} — ${a[1].toLowerCase()}, ofisdan chiqdi`,'#64748B');leave(p)}
   else if(!p.path.length||p.room==='outside'){p.visible=false;p.room='outside';p.path=[]}return}
  if(p.room==='outside'){p.visible=true;p.x=400;p.y=-30;if(animate&&prev){moveTo(p,room,x,y);if(prev.status==='away')feed('🚶',`Ustoz ${esc(t.name)} ofisga keldi`,'#16A34A')}else place(p,room,x,y)}
  else if(!animate||!prev){place(p,room,x,y)}else if(prev.status!==t.status){moveTo(p,room,x,y);
   if(t.status==='live'){say(p,'🎥','Darsda',8,'#DC2626');feed('🎥',`Ustoz ${esc(t.name)} darsni boshladi`,'#B45309');SND.ev('🎥')}
   else if(t.status==='trial'){say(p,'🎧','Sinov darsi',8,'#1F4FD8');feed('🎧',`Ustoz ${esc(t.name)} sinov darsida`,'#1F4FD8')}
   else say(p,'☕',"Bo'sh",5,'#16A34A')}
  else if(!p.path.length&&(p.room!==room||Math.hypot(p.x-x,p.y-y)>4))moveTo(p,room,x,y)});
 for(const [id] of people)if(id.startsWith('t:')&&!d.teachers.some(t=>'t:'+t.id===id))people.delete(id);
 // ilovadagi o'quvchilar
 const online=d.students.online.slice(0,BAGS.length);const want=new Set(online.map(o=>'st:'+o.id));
 for(const [id,p] of people)if(id.startsWith('st:')&&!want.has(id))people.delete(id);
 const used=new Set([...people.values()].filter(p=>p.bag!=null).map(p=>p.bag));
 for(const o of online){const id='st:'+o.id;if(people.has(id))continue;let b=BAGS.findIndex((_,i)=>!used.has(i));if(b<0)break;used.add(b);
  const p=mkPerson(id,{name:o.name,kind:'stud',bag:b,shirt:'#38BDF8'});place(p,'oquv',BAGS[b][0],BAGS[b][1]);if(animate)say(p,'📱','Ilovada',4)}
 alerts(d,animate);plan(d,animate);announceIn(d,animate);race(d,animate);goalIn(d,animate);ui();
}

// ── Voqealar ──
const ICON={checkin:'✅',checkout:'👋',break_out:'🍽️',break_in:'↩️',lead_new:'🟢',lead_assigned:'📋',call:'📞',call_fail:'📵',contacted:'💬',trial_booked:'📅',decision:'🤔',lead_lost:'❌',lead_junk:'⚪',sale:'💰',debt_payment:'💳',exam:'🎓'};
function evText(e){const m=nameOf(e.managerId)||'Menejer',L=esc(e.lead||'Mijoz');
 switch(e.type){
  case 'checkin':return[`${esc(nameOf(e.staffId))} Face ID · ${hm(e.at)}`+(e.late?` — ${e.late} daq kechikdi`:''),e.late?'#B45309':'#16A34A'];
  case 'checkout':return[`${esc(nameOf(e.staffId))} ishdan chiqdi · ${hm(e.at)}`,'#6B7385'];
  case 'break_out':return[e.breakKind==='step'?`${esc(nameOf(e.staffId))} vaqtincha chiqdi · ${hm(e.at)}${e.until?' · '+esc(e.until)+' gacha':''}`:`${esc(nameOf(e.staffId))} obedga chiqdi · ${hm(e.at)}${e.until?' · '+esc(e.until)+' gacha':''}`,e.breakKind==='step'?'#1F4FD8':'#B45309'];
  case 'break_in':return[`${esc(nameOf(e.staffId))} ${e.breakKind==='step'?'ruxsatdan':'obeddan'} qaytdi · ${hm(e.at)}`,'#16A34A'];
  case 'lead_new':return[`Yangi lid · ${e.src==='target'?'Target':'Organik'} · ${L}`];
  case 'lead_assigned':return[`Lid taqsimlandi: ${L} → ${esc(m)}`];
  case 'call':return[`${esc(m)} qo'ng'iroq qildi · ${L}`];
  case 'call_fail':return[`${L} javob bermadi · ${esc(m)}`,'#B45309'];
  case 'contacted':return[`${esc(m)} ${L} bilan bog'landi`];
  case 'trial_booked':return[`Sinov darsi: ${L} → ustoz ${esc(nameOf(e.teacherId)||'')}`,'#1F4FD8'];
  case 'decision':return[`${L} qaror jarayonida · ${esc(m)}`];
  case 'lead_lost':return[`${L} — muvaffaqiyatsiz · ${esc(m)}`,'#E11D48'];
  case 'lead_junk':return[`${L} — sifatsiz`,'#6B7385'];
  case 'sale':return[`Sotuv! ${esc(m)} · ${L}`+(e.amount?` · ${money(e.amount)} so'm`:''),'#16A34A'];
  case 'debt_payment':return[`To'lov: ${L}`+(e.amount?` · ${money(e.amount)} so'm`:''),'#0E7490'];
  case 'exam':return[`${esc(e.student)} imtihon topshirdi: ${e.percent}%`,e.passed?'#16A34A':'#E11D48'];
 }return[e.type]}
const feedEl=()=>document.getElementById('feed');
function feed(icon,html,color,at){const li=document.createElement('li');li.innerHTML=`<span class="t">${hm(at||Date.now())}</span><span class="i">${icon}</span><span style="${color?'color:'+color:''}">${html}</span>`;
 const f=feedEl();f.querySelector('.empty')?.remove();f.prepend(li);while(f.children.length>50)f.lastChild.remove();tvTick(icon,li.lastChild.textContent)}
const leads=new Map();
function leadPerson(e){const id='l:'+e.leadId;let p=people.get(id);if(!p){p=mkPerson(id,{name:e.lead||'Mijoz',kind:'lead',src:e.src||'organic',shirt:'#94A3B8'});p.x=400;p.y=-30;p.room='outside';p.visible=true}
 return p}
function benchSlot(){const used=new Set([...people.values()].filter(p=>p.kind==='lead'&&p.bench!=null).map(p=>p.bench));for(let i=0;i<9;i++)if(!used.has(i))return i;return 8}
function animateEvent(e){
 const mgr=people.get('s:'+e.managerId);
 const visitors=[...people.values()].filter(p=>p.kind==='lead').length;
 switch(e.type){
  case 'checkin':break; // snapshot o'zi olib kiradi
  case 'lead_new':{if(visitors>=10)break;const p=leadPerson(e);p.src=e.src;p.ride=e.src==='target'?'✈️':'🚶';p.bench=benchSlot();const [bx,by]=BENCH(p.bench);moveTo(p,'sotuv',bx,by,()=>say(p,'🆕',e.src==='target'?'Target':'Organik',5));
   p.ttl=performance.now()+120000;break}
  case 'lead_assigned':{say(people.get('s:'+(data.staff.find(s=>s.kind==='rop')||{}).id),'📋',`→ ${nameOf(e.managerId)}`,5);
   const p=people.get('l:'+e.leadId);if(p&&mgr&&mgr.visible){p.bench=null;moveTo(p,'sotuv',mgr.x,mgr.y+38)}break}
  case 'call':case 'call_fail':{if(mgr)say(mgr,e.type==='call'?'📞':'📵',e.type==='call'?"Qo'ng'iroq":'Javob yo\'q',6,e.type==='call'?'#1F4FD8':'#B45309');break}
  case 'contacted':if(mgr)say(mgr,'💬',"Bog'landi",5,'#0E7490');break;
  case 'trial_booked':{if(mgr)say(mgr,'📅','Sinov darsi!',5,'#16A34A');if(visitors>=10)break;const p=leadPerson(e);p.bench=null;const tt=people.get('t:'+e.teacherId);
   const k=trialTables.get(e.teacherId);const [ix,iy]=TRIAL_I[k!=null?k:ri(0,5)],sw=illInv(ix+28,iy+12),tx=sw.x,ty=sw.y;moveTo(p,'sinov',tx,ty,()=>{say(p,'🎧','Sinov darsi',8);setTimeout(()=>{if(people.get(p.id))leave(p)},25000)});break}
  case 'sale':{const p=leadPerson(e);p.bench=null;moveTo(p,'kassa',250,937,()=>{confetti(250,890,60);say(p,'💳',"To'lov",4);setTimeout(()=>{if(people.has(p.id)){p.shirt='#38BDF8';moveTo(p,'oquv',BAGS[ri(0,11)][0],BAGS[ri(0,11)][1]+20,()=>setTimeout(()=>{people.delete(p.id)},8000))}},1500)});
   if(mgr){say(mgr,'🎉','Sotuv!',8,'#16A34A');confetti(mgr.x,mgr.y-30,40)}catParty();
   const h=`💰 Sotuv! ${esc(nameOf(e.managerId))}`,sub=`${esc(e.lead||'')}`+(e.amount?` · ${money(e.amount)} so'm`:'');toast(h,sub);if(document.body.classList.contains('tv'))bigShow(h,sub);break}
  case 'debt_payment':if(mgr)say(mgr,'💳',"To'lov",5,'#0E7490');break;
  case 'lead_lost':case 'lead_junk':case 'decision':{const p=people.get('l:'+e.leadId);if(p){p.shirt='#CBD5E1';p.bench=null;leave(p)}if(mgr&&e.type==='decision')say(mgr,'🤔','Qaror',4);break}
  case 'exam':{const p=people.get('st:'+e.studentId);say(p,'🎓',e.percent+'%',8,e.passed?'#16A34A':'#E11D48');break}
 }}
function handleEvents(list,animate){
 for(const e of list){const [t,c]=evText(e);if(animate){feed(ICON[e.type]||'•',t,c,e.at);SND.ev(e.type==='sale'?'💰':ICON[e.type],e);animateEvent(e)}
  else{const li=document.createElement('li');li.innerHTML=`<span class="t">${hm(e.at)}</span><span class="i">${ICON[e.type]||'•'}</span><span style="${c?'color:'+c:''}">${t}</span>`;feedEl().prepend(li)}
  cursor=e.at}}

// ── Tarmoq ──
async function load(){
 const q=new URLSearchParams();if(TV)q.set('tv','1');if(langSel)q.set('lang',langSel);if(cursor&&!firstLoad)q.set('since',cursor);
 let res;try{res=await fetch(API+'?'+q,{headers:{Authorization:'Bearer '+token}})}catch(e){setLive(false);return}
 if(res.status===401){localStorage.removeItem('mh_token');showLogin('Sessiya tugadi — qayta kiring');return}
 if(!res.ok){setLive(false);return}
 const d=await res.json();setLive(true);lastOk=Date.now();
 if(firstLoad){feedEl().innerHTML='';applySnapshot(d,false);handleEvents(d.events,false);if(!d.events.length)feedEl().innerHTML='<div class="empty">Bugun hali voqea yoʻq</div>';firstLoad=false;setupLang(d)}
 else{applySnapshot(d,true);handleEvents(d.events,true)}}
function setLive(ok){document.getElementById('dot').classList.toggle('off',!ok)}
let pollT=null;function startPoll(){clearInterval(pollT);load();pollT=setInterval(load,10000)}
function setupLang(d){return; // Jonli ofis faqat Domwork (rus) — til tanlash yo'q
 const b=document.getElementById('langBtn');const can=d.viewer.scope==='full'||(d.viewer.langs==null&&d.viewer.scope!=='team');if(!can)return;
 b.style.display='';const lab=()=>b.textContent=langSel==='russian'?'🇷🇺 Rus':langSel==='english'?'🇬🇧 Ingliz':'🌐 Ikkala til';lab();
 b.onclick=()=>{langSel=langSel==null?'russian':langSel==='russian'?'english':null;lab();cursor=null;firstLoad=true;for(const k of [...people.keys()])people.delete(k);load()}}

// ── UI ──
function ui(){if(!data)return;const k=data.kpi;document.getElementById('clock').textContent=hm(Date.now());
 const v=data.viewer;document.getElementById('annBtn').style.display=ANN_ROLES.includes(v.role)?'':'none';document.getElementById('goalBtn').style.display=GOAL_ROLES.includes(v.role)?'':'none';document.getElementById('who').textContent=(user?.name?user.name+' · ':'')+({full:'toʻliq koʻrinish',sales:'sotuv koʻrinishi',academic:'akademik koʻrinish',team:'jamoa koʻrinishi'}[v.scope]||'');
 const dl=(n,key)=>{const y=k.yday?.[key];if(y==null)return n;const d=n-y;return `${n}<i class="${d>0?'up':d<0?'dn':'eq'}" title="Kecha shu vaqtgacha: ${y}">${d>0?'▲'+d:d<0?'▼'+(-d):'='}</i>`};
 const items=[['Ofisda',k.inOffice+'/'+k.staff],...(k.onLunch?[['Obedda',k.onLunch]]:[]),...(k.stepOut?[['Tashqarida',k.stepOut]]:[]),['Lidlar',dl(k.leads,'leads')],["Qo'ng'iroq",dl(k.calls,'calls')+(k.callLeads?`<small class="sub">${k.callLeads} ta lid</small>`:'')],['Sinov',dl(k.trials,'trials')],['Sotuv',dl(k.sales,'sales')]];
 if(v.money)items.push(['Tushum',money(k.money),'money']);
 if(k.plan)items.push(['Oylik reja',k.plan.pct+'%','money']);
 items.push(['Jonli dars',k.live],['Sinovda',k.trialNow],["Bo'sh ustoz",k.freeTeachers],['Ilovada',k.online+" o'q."]);
 if(k.platformOnline!=null)items.splice(1,0,['Onlayn',k.platformOnline,'online']);
 document.getElementById('kpis').innerHTML=items.map(([a,b,c])=>`<div class="kpi ${c||''}"><span>${a}</span><b>${b}</b></div>`).join('');
 const st=s=>s.now==='lunch'?`🍽️ obedda · ${s.breakUntil||''} gacha`:s.now==='lunch_late'?'⏱ obeddan kech':s.now==='out'?`🚪 tashqarida · ${s.breakUntil||''} gacha`:s.now==='step_late'?'⏱ ruxsatdan kech':s.inOffice?(people.get('s:'+s.id)?.bubble?.text||(s.platform?.online?'💻 onlayn · '+s.platform.section:'💻 ishda')):s.outAt?'ketdi '+hm(s.outAt):s.platform?.online?'💻 onlayn · '+s.platform.section:'hali kelmagan';
 const tt=t=>t.status==='live'?`🎥 Darsda · ${t.nowStudents.length} o'q.`:t.status==='trial'?'🎧 Sinov darsida':t.status==='away'?awayOf(t).join(' '):t.dav==='pending'?'⏳ davomat kutilmoqda':"Bo'sh";
 document.getElementById('team').innerHTML=data.staff.map(s=>`<div class="mem ${s.inOffice?'':'off'}" data-p="s:${esc(s.id)}"><span class="av" style="background:${people.get('s:'+s.id)?.shirt||'#94A3B8'}">${esc(s.name[0]||'?')}</span><div><div>${s.crown?'👑 ':''}${s.fire?'🔥 ':''}${s.birthday?'🎂 ':''}${esc(s.name)}${s.late?' <span style="color:#B45309">⚠️</span>':''}${(s.badges||[]).map(b=>' <span title="'+esc(b.t)+'">'+b.t.split(' ')[0]+'</span>').join('')}</div><div class="st">${esc(st(s))}</div></div></div>`).join('')
  +(data.teachers.length?'<div class="tsep">Ustozlar (masofadan)</div>'+data.teachers.map(t=>`<div class="mem" data-p="t:${esc(t.id)}"><span class="av" style="background:#F59E0B">${esc(t.name[0]||'?')}</span><div><div>${esc(t.name)}</div><div class="st">${esc(tt(t))}</div></div></div>`).join(''):'');
 document.getElementById('note').textContent=v.money?'':"Summalar, maosh va kechikishlar bu ko'rinishda chiqmaydi.";
 const hh=k.hourly||[],mx=Math.max(1,...hh),pk=hh.indexOf(Math.max(...hh));
 document.getElementById('hours').innerHTML=hh.slice(7,24).map((n,i)=>`<div class="hb${i+7===pk&&n?' pk':''}" title="${i+7}:00 — ${n} lid"><i style="height:${Math.round(n/mx*100)}%"></i><span>${(i+7)%3===0?i+7:''}</span></div>`).join('')
  +`<div class="hnote">${Math.max(...hh)?`Eng ko'p: ${pk}:00 — ${hh[pk]} lid`:'Bugun hali lid yoʻq'}</div>`
  ;document.getElementById('src').innerHTML=(k.leads?`<div class="src"><div class="srcbar"><i style="width:${Math.round(k.srcTarget/k.leads*100)}%"></i></div><span>✈️ Target <b>${k.srcTarget}</b></span><span>🚶 Organik <b>${k.srcOrganic}</b></span></div>`:'');
 raceUi();
 const fd=m=>{m=Math.round(m||0);const h=Math.floor(m/60),r=m%60;return h?h+' soat '+String(r).padStart(2,'0')+' daq':r+' daq'};
 const at=k.activeTop||[],aa=(k.activeAcademic||[])[0];document.getElementById('actBox').style.display=at.length||aa?'':'none';
 document.getElementById('act').innerHTML=at.map((x,i)=>`<div><span>${['🥇','🥈','🥉','4.','5.'][i]} ${esc(x.name)}</span><b>${fd(x.minutes)}</b></div>`).join('')+(aa?`<div><span>🎓 Akademikda: ${esc(aa.name)}</span><b>${fd(aa.minutes)}</b></div>`:'');
 const w=k.waiting||[];document.getElementById('waitBox').style.display=w.length?'':'none';
 document.getElementById('wait').innerHTML=w.map(x=>`<div><span>⏰ ${esc(x.name)}</span><b>${x.min} daq</b></div>`).join('');
 tvUi()}
document.addEventListener('click',e=>{const m=e.target.closest('.mem');if(m)openCard(people.get(m.dataset.p))});
function openCard(p){if(!p)return;const card=document.getElementById('card');
 if(p.kind==='teacher'){const t=data.teachers.find(x=>'t:'+x.id===p.id);if(!t)return;
  card.innerHTML=`<div class="hd"><div class="big" style="background:#F59E0B">${esc(t.name[0])}</div><div><h2>${esc(t.name)}</h2><div class="role">Ustoz · masofadan</div></div></div><div class="pill">${t.status==='live'?'🎥 Darsda':t.status==='trial'?'🎧 Sinov darsida':t.status==='away'?awayOf(t).join(' '):"Bo'sh"}</div>
  <div class="slist"><div><span>Bugun dars o'tdi</span><b>${t.lessonsDone}</b></div><div><span>Bugungi o'quvchilar</span><b>${t.todayStudents}</b></div><div><span>Davomat</span><b>${t.dav==='ok'?'✅ belgilandi':t.dav==='pending'?'⏳ kutilmoqda':'—'}</b></div>${t.nowStudents.map(s=>`<div><span>🟢 ${esc(s.name)}</span><b>darsda</b></div>`).join('')}</div><button class="close">Yopish</button>`}
 else if(p.kind==='stud'){card.innerHTML=`<div class="hd"><div class="big" style="background:#38BDF8">${esc(p.name[0]||'?')}</div><div><h2>${esc(p.name)}</h2><div class="role">O'quvchi · ilovada</div></div></div><button class="close">Yopish</button>`}
 else if(p.kind==='lead'){card.innerHTML=`<div class="hd"><div class="big" style="background:${p.src==='target'?'#1F4FD8':'#16A34A'}">${esc(p.name[0]||'?')}</div><div><h2>${esc(p.name)}</h2><div class="role">Lid · ${p.src==='target'?'Target':'Organik'}</div></div></div><button class="close">Yopish</button>`}
 else{const s=p.staff;if(!s)return;card.innerHTML=`<div class="hd"><div class="big" style="background:${p.shirt}">${esc(s.name[0]||'?')}</div><div><h2>${esc(s.name)}</h2><div class="role">${KIND_LABEL[s.kind]||''}</div></div></div>
  <div class="pill">${s.now==='lunch'||s.now==='lunch_late'?`🍽️ Obedda${s.breakOut?' · '+esc(s.breakOut)+' dan':''}${s.breakUntil?' · '+esc(s.breakUntil)+' gacha':''}${s.now==='lunch_late'?' · kech':''}`:s.now==='out'||s.now==='step_late'?`🚪 Tashqarida (ruxsat)${s.breakUntil?' · '+esc(s.breakUntil)+' gacha':''}${s.now==='step_late'?' · kech':''}`:s.inOffice?'🏢 Ofisda':'🏠 Ofisda emas'}</div><div class="slist"><div><span>Keldi (Face ID)</span><b>${s.inAt?hm(s.inAt):'—'}</b></div><div><span>Ketdi</span><b>${s.outAt?hm(s.outAt):'—'}</b></div>${s.late?`<div><span>Kechikish</span><b style="color:#B45309">${s.late} daq</b></div>`:''}${s.salesToday?`<div><span>Bugungi sotuv</span><b>${s.crown?'👑 ':''}${s.salesToday}</b></div>`:''}</div>${(s.badges||[]).length?`<div class="badges">${s.badges.map(b=>`<span>${esc(b.t)}</span>`).join('')}</div>`:''}<button class="close">Yopish</button>`}
 document.getElementById('sheet').classList.add('show')}
document.getElementById('sheet').addEventListener('click',e=>{if(e.target.id==='sheet'||e.target.classList.contains('close'))e.currentTarget.classList.remove('show')});
function toast(h,s){const el=document.getElementById('toast');el.innerHTML=h+(s?`<small>${s}</small>`:'');el.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),3500)}
function confetti(x,y,n=40){for(let i=0;i<n;i++)fx.push({x,y,vx:rnd(-90,90),vy:rnd(-160,-40),c:pick(['#1F4FD8','#F59E0B','#16A34A','#DB2777','#0EA5E9']),life:rnd(1,1.8),r:rnd(2,4)})}

// ── Kamera ──
let cv=document.getElementById('cv'),ctx=cv.getContext('2d'),stage=document.getElementById('stage'),hint=document.getElementById('hint');
let cw=0,ch=0,dpr=1;const cam={x:0,y:0,s:1},camT={x:0,y:0,s:1};let zoomRoom=null;
const IMG_W=1176,IMG_H=2090;
function pbox(r){const a=ill(r.x+1,r.y+1),b=ill(r.x+r.w-1,r.y+r.h-1);return{x0:a.x,y0:a.y,w:b.x-a.x,h:b.y-a.y}}
function fitBox(b,pad){const s=Math.min(cw/(b.w+pad*2),ch/(b.h+pad*2));return{s,x:b.x0+b.w/2-cw/s/2,y:b.y0+b.h/2-ch/s/2}}
const fitAll=()=>fitBox({x0:0,y0:0,w:IMG_W,h:IMG_H},0),fitRoom=k=>fitBox(pbox(R[k]),14);
function resize(){const tv=document.body.classList.contains('tv'),wide=innerWidth>=960;cw=tv?innerWidth:stage.clientWidth;
 ch=tv?innerHeight:wide?Math.max(560,Math.min(innerHeight-150,cw*IMG_H/IMG_W)):cw*IMG_H/IMG_W;dpr=Math.min(devicePixelRatio||1,2);
 cv.width=cw*dpr;cv.height=ch*dpr;cv.style.height=ch+'px';Object.assign(camT,zoomRoom?fitRoom(zoomRoom):fitAll());Object.assign(cam,camT)}
addEventListener('resize',resize);
function zoomTo(k){zoomRoom=k;Object.assign(camT,k?fitRoom(k):fitAll());document.getElementById('back').style.display=k?'':'none';hint.style.opacity=0}
document.getElementById('back').onclick=()=>zoomTo(null);
// Kabinetga qaytish: CRM'dan kelgan bo'lsa orqaga, aks holda rolga mos bosh sahifa.
document.getElementById('toCrm').onclick=()=>{try{if(document.referrer&&new URL(document.referrer).origin===location.origin&&history.length>1){history.back();return}}catch(e){}location.href=user?.role==='teacher'?'/teacher/':'/index.html'};
cv.addEventListener('click',e=>{const b=cv.getBoundingClientRect();const X=(e.clientX-b.left)/cam.s+cam.x,Y=(e.clientY-b.top)/cam.s+cam.y;
 let best=null,bd=1e9;const tol=Math.max(20,26/cam.s);for(const p of people.values()){if(!p.visible)continue;const q=ill(p.x,p.y);const d=Math.hypot(q.x-X,q.y-22-Y);if(d<tol&&d<bd){bd=d;best=p}}
 if(best&&(zoomRoom||cam.s>.62)){openCard(best);return}
 if(zoomRoom==='jonli'){const ci=CAB.findIndex(c=>X>=c.x0&&X<=c.x1&&Y>=c.y0&&Y<=c.y1);if(ci>=0&&data.teachers[ci]){openCard(people.get('t:'+data.teachers[ci].id));return}}
 const w=illInv(X,Y);for(const k in R){const r=R[k];if(w.x>=r.x&&w.x<=r.x+r.w&&w.y>=r.y&&w.y<=r.y+r.h){zoomTo(zoomRoom===k?null:k);return}}zoomTo(null)});

// ── Chizish ──
function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function face(x,y,t,r=13){const k=r/13;ctx.fillStyle=t.skin;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();ctx.fillStyle=t.hair;ctx.beginPath();ctx.arc(x,y-3*k,r+.5,Math.PI,0);ctx.fill();
 if(t.female){ctx.fillRect(x-r-.5,y-3*k,5*k,15*k);ctx.fillRect(x+r-4.5*k,y-3*k,5*k,15*k)}ctx.fillStyle='#14213D';ctx.beginPath();ctx.arc(x-4.5*k,y+2*k,1.6*k,0,7);ctx.arc(x+4.5*k,y+2*k,1.6*k,0,7);ctx.fill()}
function drawPerson(p){const moving=p.path.length>0,bob=moving?Math.abs(Math.sin(p.walk*11))*2:0,x=p.x,y=p.y-bob;
 if(p.crown||p.fire){const t=performance.now()/400;ctx.save();ctx.globalAlpha=.35+.15*Math.sin(t);ctx.fillStyle=p.fire?'#F97316':'#FBBF24';ctx.beginPath();ctx.ellipse(p.x,p.y,18,7,0,0,7);ctx.fill();ctx.restore()}
 ctx.fillStyle='rgba(20,33,61,.18)';ctx.beginPath();ctx.ellipse(p.x,p.y+1,9,3.5,0,0,7);ctx.fill();
 const l=moving?Math.sin(p.walk*11)*3:0;ctx.fillStyle='#2B3A55';rr(x-5,y-6+l*.3,4,7,2);ctx.fill();rr(x+1,y-6-l*.3,4,7,2);ctx.fill();
 ctx.fillStyle=p.shirt;rr(x-8,y-20,16,15,6);ctx.fill();
 if(p.kind==='lead'){ctx.fillStyle=p.src==='target'?'#1F4FD8':'#16A34A';rr(x-8,y-20,16,4,2);ctx.fill()}
 if(!p.noPhoto&&p.av&&p.av.complete&&p.av.naturalWidth){ctx.save();ctx.beginPath();ctx.arc(x,y-28,9.5,0,7);ctx.closePath();ctx.fillStyle='#fff';ctx.fill();ctx.clip();
  const iw=p.av.naturalWidth,ih=p.av.naturalHeight,sc=Math.max(19/iw,19/ih);ctx.drawImage(p.av,x-iw*sc/2,y-28-ih*sc*.42,iw*sc,ih*sc);ctx.restore();
  ctx.strokeStyle='#fff';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(x,y-28,9.5,0,7);ctx.stroke()}
 else{const st=p.style||(p.female?'long':'short');ctx.fillStyle=p.skin;ctx.beginPath();ctx.arc(x,y-27,8,0,7);ctx.fill();ctx.fillStyle=p.hair;
 if(st==='scarf'){ctx.beginPath();ctx.arc(x,y-27,10,Math.PI*.82,Math.PI*2.18);ctx.fill();rr(x-10,y-28,4,12,2);ctx.fill();rr(x+6,y-28,4,12,2);ctx.fill();ctx.fillStyle=p.skin;ctx.beginPath();ctx.arc(x,y-26,6.6,0,7);ctx.fill()}
 else if(st!=='bald'){ctx.beginPath();ctx.arc(x,y-29,8.4,Math.PI,0);ctx.fill();if(st==='long'){ctx.fillRect(x-8.4,y-29,3.4,11);ctx.fillRect(x+5,y-29,3.4,11)}}
 if(st==='cap'){ctx.fillStyle=p.shirt;ctx.beginPath();ctx.arc(x,y-30,8.8,Math.PI,0);ctx.fill();rr(x,y-31.5,12,3.2,1.6);ctx.fill()}
 ctx.fillStyle='#14213D';ctx.beginPath();ctx.arc(x-3,y-26,1.2,0,7);ctx.arc(x+3,y-26,1.2,0,7);ctx.fill();
 if(p.acc==='glasses'){ctx.strokeStyle='#14213D';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x-3,y-26,2.6,0,7);ctx.moveTo(x+5.6,y-26);ctx.arc(x+3,y-26,2.6,0,7);ctx.moveTo(x-.4,y-26);ctx.lineTo(x+.4,y-26);ctx.stroke()}}
 if(p.acc==='headphones'){ctx.strokeStyle='#14213D';ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(x,y-28,10,Math.PI*1.05,Math.PI*1.95);ctx.stroke();ctx.fillStyle='#14213D';rr(x-11.5,y-30,4,7,2);ctx.fill();rr(x+7.5,y-30,4,7,2);ctx.fill()}
 if(p.acc==='bow'){ctx.fillStyle='#EC4899';ctx.beginPath();ctx.moveTo(x+6,y-35);ctx.lineTo(x+1,y-39);ctx.lineTo(x+1,y-31);ctx.closePath();ctx.moveTo(x+6,y-35);ctx.lineTo(x+11,y-39);ctx.lineTo(x+11,y-31);ctx.closePath();ctx.fill()}
 if(p.acc==='tie'){ctx.fillStyle='#B91C1C';ctx.beginPath();ctx.moveTo(x-2,y-19);ctx.lineTo(x+2,y-19);ctx.lineTo(x+1.5,y-10);ctx.lineTo(x,y-8);ctx.lineTo(x-1.5,y-10);ctx.closePath();ctx.fill()}
 if(p.bubble&&p.bubble.icon==='📞'){ctx.fillStyle='#14213D';rr(x+6,y-30,4,9,2);ctx.fill()}
 if(p.kind==='stud'){ctx.fillStyle='#14213D';rr(x-4,y-17,8,11,2);ctx.fill();ctx.fillStyle='#60A5FA';rr(x-3,y-16,6,8,1);ctx.fill()}}
function chip(x,y,t,bg,fg){ctx.font='900 15px Nunito';const w=ctx.measureText(t).width+20;ctx.fillStyle=bg;rr(x,y,w,26,13);ctx.fill();ctx.fillStyle=fg;ctx.textAlign='left';ctx.fillText(t,x+10,y+18)}
const COLS=[['Yangi','#1F4FD8',['yangi-lidlar']],['Urinilmoqda','#F59E0B',['boglanishga-urinilmoqda']],['Sinov','#7C3AED',['sinov-darsida','boglanildi']],['Qaror','#0EA5E9',['qaror-jarayonida','keyin-sotib-olmoqchi']],["To'lov",'#16A34A',['tolov-jarayonida','tolov-yopildi']],['Sifatsiz','#94A3B8',['sifatsiz-lidlar','muvaffaqiyatsiz-sotuv']]];
let IMG=new Image();IMG.src='/ofis/office.webp?v=20261116s'; // rasm almashtirilsa versiyani oshiring (brauzer 4 soat keshlaydi)
function render(){
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#E9DCC7';ctx.fillRect(0,0,cw,ch);
 ctx.save();ctx.scale(cam.s,cam.s);ctx.translate(-cam.x,-cam.y);
 if(IMG.complete&&IMG.naturalWidth)ctx.drawImage(IMG,0,0,IMG_W,IMG_H);
 // turniket
 if(turnFlash&&performance.now()<turnFlash.until){ctx.fillStyle=turnFlash.c;ctx.globalAlpha=.35;ctx.beginPath();ctx.ellipse(573,183,70,28,0,0,7);ctx.fill();ctx.globalAlpha=1}
 if(data){
  // kanban doska
  ctx.fillStyle='#fff';rr(242,290,256,78,6);ctx.fill();const cwid=246/6;COLS.forEach(([n,c,ids],i)=>{const cx=247+i*cwid;const v=ids.reduce((s,id)=>s+(data.board[id]||0),0);
   ctx.fillStyle=c;rr(cx+2,296,cwid-4,10,3);ctx.fill();ctx.fillStyle='#14213D';ctx.font='900 21px Nunito';ctx.textAlign='center';ctx.fillText(v,cx+cwid/2,334);ctx.fillStyle='#6B7385';ctx.font='800 9.5px Nunito';ctx.fillText(n,cx+cwid/2,355)});
  // kassa ekrani
  ctx.fillStyle='#14213D';rr(410,1131,137,55,4);ctx.fill();ctx.textAlign='left';
  if(data.viewer.money){ctx.fillStyle='#FCD34D';ctx.font='900 10px Nunito';ctx.fillText('BUGUNGI TUSHUM',418,1148);ctx.fillStyle='#fff';ctx.font='900 18px Nunito';ctx.fillText(money(data.kpi.money),418,1172)}
  else{ctx.fillStyle='#FCD34D';ctx.font='900 10px Nunito';ctx.fillText('BUGUN',418,1148);ctx.fillStyle='#fff';ctx.font='900 18px Nunito';ctx.fillText(data.kpi.sales+' ta sotuv',418,1172)}
  const k=data.kpi;
  chip(150,1062,`📱 Faol ${k.students} · ilovada ${k.online} · bugun ${k.appLessons} dars qismi · ${k.exams} imtihon`,'rgba(20,33,61,.82)','#fff');
  chip(950,1400,`🎧 Hozir: ${k.trialNow} sinov`,'#1F4FD8','#fff');chip(950,1698,`☕ Bo'sh: ${k.freeTeachers} ustoz`,'#15803D','#fff');
  // kabinka doskalari: ustoz ismi, holat, davomat; darsdagi o'quvchi o'ng stulda
  data.teachers.slice(0,CAB.length).forEach((t,i)=>{const c=CAB[i],bx=c.cx+4,by=c.cy-70,live=t.status==='live';
   ctx.fillStyle='rgba(255,255,255,.96)';rr(bx-50,by-17,100,36,6);ctx.fill();ctx.textAlign='center';ctx.fillStyle='#14213D';ctx.font='900 11px Nunito';ctx.fillText(t.name,bx,by-4);
   const s=live?['#DC2626',t.nowStudents.length>1?`LIVE · ${t.nowStudents.length} o'q.`:'LIVE']:t.status==='trial'?['#1F4FD8','Sinovda']:t.status==='away'?['#CBD5E1',awayOf(t)[1]]:['#94A3B8',"Bo'sh"];
   ctx.font='900 9px Nunito';const w=ctx.measureText(s[1]).width+12;ctx.fillStyle=s[0];rr(bx-w/2,by+2,w,13,6.5);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(s[1],bx,by+11.5);
   if(t.dav==='ok'||t.dav==='pending'){ctx.font='11px sans-serif';ctx.fillText(t.dav==='ok'?'✅':'⏳',bx+44,by-4)}
   if(live&&t.nowStudents.length){const sd=t.nowStudents[0],x=c.cx+33,y=c.cy-8,h=hash(sd.id);ctx.fillStyle=SH[h%SH.length];rr(x-10,y+4,20,16,7);ctx.fill();
    face(x,y,{skin:SKIN[h%4],hair:HAIR[(h>>3)%4],female:FEM.test(sd.name)},10);
    if(t.nowStudents.length>1){ctx.fillStyle='#DC2626';ctx.beginPath();ctx.arc(x+12,y-10,8,0,7);ctx.fill();ctx.fillStyle='#fff';ctx.font='900 9px Nunito';ctx.fillText('+'+(t.nowStudents.length-1),x+12,y-7)}}
   ctx.textAlign='left'});
 }
 const list=[...people.values()].filter(p=>p.visible).map(p=>({p,q:ill(p.x,p.y)})).sort((a,b)=>a.q.y-b.q.y);
 for(const {p,q} of list){ctx.save();ctx.translate(q.x,q.y);ctx.scale(1.4,1.4);ctx.translate(-p.x,-p.y);drawPerson(p);ctx.restore()}
 for(const f of fx){const q=f.img?f:ill(f.x,f.y);ctx.globalAlpha=Math.max(0,Math.min(1,f.life));ctx.fillStyle=f.c;ctx.fillRect(q.x,q.y,f.r*1.5,f.r*2.4)}ctx.globalAlpha=1;
 drawExtras();drawExtras2();drawExtras3();
 ctx.restore();sky();overlay(list);overlayExtras(list)}
function overlay(list){const small=cw<600&&!zoomRoom;ctx.textAlign='left';ctx.font=small?'900 10px Nunito':'900 12px Nunito';
 for(const k in R){const r=R[k],q=ill(r.x+1,r.y+1),X=(q.x-cam.x)*cam.s+(small?5:8),Y=(q.y-cam.y)*cam.s+(small?5:8),w=ctx.measureText(r.label).width+(small?12:16);
  if(X>cw||Y>ch||X+w<0||Y+20<0)continue;ctx.fillStyle='rgba(255,255,255,.92)';rr(X,Y,w,small?17:22,9);ctx.fill();ctx.fillStyle='#14213D';ctx.fillText(r.label,X+(small?6:8),Y+(small?12:15))}
 const names=cam.s>.62,now=performance.now();
 for(const {p,q} of list){const X=(q.x-cam.x)*cam.s,Y=(q.y-cam.y)*cam.s-52*cam.s;
  if(p.kind==='lead'&&p.ride&&p.path.length){ctx.font=(names?22:15)+'px sans-serif';ctx.textAlign='center';ctx.fillText(p.ride,X-(names?22:14),Y+(names?30:22))}
  const ic=(p.crown?'👑':'')+(p.fire?'🔥':'')+(p.birthday?'🎂':'');if(ic){ctx.font=(names?18:13)+'px sans-serif';ctx.textAlign='center';ctx.fillText(ic,X,Y-(names?12:4)-(p.bubble&&now<p.bubble.until?(names?26:18):0))}
  if(names&&p.kind!=='lead'&&p.kind!=='stud'){ctx.font='800 11px Nunito';const w=ctx.measureText(p.name).width+10;ctx.fillStyle='rgba(20,33,61,.82)';rr(X-w/2,Y-8,w,16,8);ctx.fill();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(p.name,X,Y+4)}
  const b=p.bubble;if(b&&now<b.until){const txt=names?b.icon+' '+b.text:b.icon;ctx.font='800 12px Nunito';const w=ctx.measureText(txt).width+14,by=Y-(names?30:20);
   ctx.fillStyle='#fff';ctx.strokeStyle=b.color||'#C7D0E0';ctx.lineWidth=1.5;rr(X-w/2,by-10,w,22,11);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(X-4,by+12);ctx.lineTo(X,by+17);ctx.lineTo(X+4,by+12);ctx.fill();
   ctx.fillStyle=b.color||'#14213D';ctx.textAlign='center';ctx.fillText(txt,X,by+5)}else if(b)p.bubble=null}}

// ── Qo'shimchalar: termometr, ogohlantirish, kun-tun, ob-havo, bayramlar ──
const ROPSCR={x:1072,y:312,w:44,h:170};   // rasmdagi ROP xonasi devor ekrani
let planCelebrated=false,alerted=new Set();
function plan(d,animate){const p=d.kpi.plan;if(!p)return;if(p.pct>=100&&!planCelebrated){planCelebrated=true;if(animate){feed('🏆',"Oylik reja bajarildi! Butun jamoaga rahmat!",'#16A34A');
 toast('🏆 Oylik reja bajarildi!',p.pct+'%');for(let i=0;i<8;i++)setTimeout(()=>confetti(rnd(40,760),rnd(200,1300),50),i*300);SND.ev('💰');setTimeout(()=>SND.voice('reja'),6500)}}}
function alerts(d,animate){for(const w of d.kpi.waiting||[]){if(alerted.has(w.id))continue;alerted.add(w.id);if(animate)feed('⏰',`${esc(w.name)} ${w.min} daqiqadan beri taqsimlanmay kutyapti!`,'#DC2626')}}
function holiday(){const t=new Date(Date.now()+5*3600e3),m=t.getUTCMonth()+1,d=t.getUTCDate();
 if((m===12&&d>=20)||(m===1&&d<=5))return{k:'ny',t:'🎄 Yangi yil muborak!',e:['🎄','🎁','⛄']};
 if(m===3&&d>=18&&d<=25)return{k:'navruz',t:"🌷 Navro'z muborak!",e:['🌷','🍲','🌸']};
 if(m===3&&d===8)return{k:'8m',t:'🌷 8-mart muborak!',e:['🌷','💐','🌹']};
 if((m===8&&d>=30)||(m===9&&d<=2))return{k:'mus',t:'🇺🇿 Mustaqillik kuni muborak!',e:['🇺🇿','🎆','🇺🇿']};
 if(m===10&&d===1)return{k:'ust',t:"💐 O'qituvchilar kuni muborak!",e:['💐','📚','🍎']};
 return null}
function drawExtras(){if(!data)return;const k=data.kpi,now=performance.now();
 // Reja termometri (faqat summani ko'radiganlarga keladi)
 if(k.plan){const r=ROPSCR,pc=Math.min(1,k.plan.pct/100);ctx.fillStyle='#14213D';rr(r.x-6,r.y-6,r.w+12,r.h+40,8);ctx.fill();
  ctx.fillStyle='#334155';rr(r.x+12,r.y+6,20,r.h-22,10);ctx.fill();
  const g=ctx.createLinearGradient(0,r.y+r.h,0,r.y);g.addColorStop(0,'#16A34A');g.addColorStop(1,k.plan.pct>=100?'#FBBF24':'#4ADE80');
  const hh=(r.h-26)*pc;ctx.fillStyle=g;rr(r.x+14,r.y+4+(r.h-26)-hh+2,16,hh,8);ctx.fill();ctx.beginPath();ctx.arc(r.x+22,r.y+r.h-8,12,0,7);ctx.fill();
  ctx.fillStyle='#fff';ctx.font='900 13px Nunito';ctx.textAlign='center';ctx.fillText(k.plan.pct+'%',r.x+22,r.y+r.h+20);ctx.font='800 8px Nunito';ctx.fillStyle='#93C5FD';ctx.fillText('OYLIK REJA',r.x+22,r.y-12+0)}
 // Davomat kutilayotgan guruh xonasi miltillaydi
 data.teachers.slice(0,CAB.length).forEach((t,i)=>{if(t.dav!=='pending')return;const c=CAB[i];ctx.save();ctx.globalAlpha=.25+.25*Math.sin(now/250);ctx.strokeStyle='#DC2626';ctx.lineWidth=5;rr(c.x0+3,c.y0+3,c.x1-c.x0-6,c.y1-c.y0-6,8);ctx.stroke();ctx.restore()});
 // Kutib qolgan lidlar: skameyka ustida qizil soat
 const w=k.waiting||[];if(w.length){const q=ill(120,206);ctx.save();ctx.globalAlpha=.6+.4*Math.sin(now/220);ctx.font='26px sans-serif';ctx.textAlign='center';ctx.fillText('⏰',q.x-60,q.y+18);ctx.restore();
  ctx.fillStyle='#DC2626';rr(q.x-40,q.y-2,170,24,12);ctx.fill();ctx.fillStyle='#fff';ctx.font='900 12px Nunito';ctx.textAlign='left';ctx.fillText(`${w.length} ta lid 30+ daq kutyapti`,q.x-30,q.y+15)}
 // Bayram bezaklari
 const h=holiday();if(h){ctx.font='40px sans-serif';ctx.textAlign='center';[[95,175],[1110,90],[560,40]].forEach(([x,y],i)=>ctx.fillText(h.e[i%h.e.length],x,y));
  [[300,1300],[860,1350],[300,1985]].forEach(([x,y],i)=>{ctx.font='30px sans-serif';ctx.fillText(h.e[(i+1)%h.e.length],x,y)})}
 // Tug'ilgan kun: stol yonida sharlar
 for(const p of people.values())if(p.birthday&&p.visible&&!p.path.length){const q=ill(p.x,p.y);const b=Math.sin(now/600+q.x)*4;ctx.font='22px sans-serif';ctx.textAlign='center';ctx.fillText('🎈',q.x+26,q.y-48+b);ctx.fillText('🎈',q.x+38,q.y-40-b)}
}
// Kun-tun va ob-havo (ekran koordinatalarida)
const drops=[];
function sky(){const t=new Date(Date.now()+5*3600e3),hr=t.getUTCHours()+t.getUTCMinutes()/60,w=data?.kpi?.weather;
 let a=0,c='20,30,70';if(hr<6||hr>=20)a=.42;else if(hr<7)a=.42*(7-hr);else if(hr>=18.5)a=.42*(hr-18.5)/1.5;
 if(hr>=17&&hr<19.5){ctx.fillStyle=`rgba(255,140,60,${.12*(1-Math.abs(hr-18.2)/1.3)})`;ctx.fillRect(0,0,cw,ch)}
 if(w&&[45,48,51,53,55,61,63,65,80,81,82,95,96,99,71,73,75,85,86].includes(w.code))a=Math.max(a,.12);
 if(a>0){ctx.fillStyle=`rgba(${c},${a})`;ctx.fillRect(0,0,cw,ch);
  if(a>.25){ctx.save();ctx.globalCompositeOperation='lighter';for(const p of people.values()){if(!p.visible||p.kind==='lead'||p.kind==='stud')continue;const q=ill(p.x,p.y);const X=(q.x-cam.x)*cam.s,Y=(q.y-cam.y)*cam.s-40*cam.s;
   const g=ctx.createRadialGradient(X,Y,0,X,Y,60*cam.s);g.addColorStop(0,'rgba(255,214,140,.35)');g.addColorStop(1,'rgba(255,214,140,0)');ctx.fillStyle=g;ctx.fillRect(X-60*cam.s,Y-60*cam.s,120*cam.s,120*cam.s)}ctx.restore()}}
 const snow=w&&[71,73,75,77,85,86].includes(w.code),rain=w&&[51,53,55,61,63,65,80,81,82,95,96,99].includes(w.code),ny=holiday()?.k==='ny';
 if(rain||snow||ny){const n=snow||ny?70:110;while(drops.length<n)drops.push({x:Math.random()*cw,y:Math.random()*ch,v:rnd(.6,1)});
  ctx.save();ctx.strokeStyle='rgba(180,200,255,.45)';ctx.fillStyle='rgba(255,255,255,.85)';ctx.lineWidth=1.2;
  for(const d of drops){if(snow||(ny&&!rain)){d.y+=0.7*d.v;d.x+=Math.sin(d.y/30)*.3;ctx.beginPath();ctx.arc(d.x,d.y,1.6*d.v,0,7);ctx.fill()}else{d.y+=9*d.v;d.x-=1.5;ctx.beginPath();ctx.moveTo(d.x,d.y);ctx.lineTo(d.x+3,d.y-12);ctx.stroke()}
   if(d.y>ch){d.y=-10;d.x=Math.random()*cw}if(d.x<0)d.x=cw}ctx.restore()}else drops.length=0}
const WX={0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',51:'🌦',53:'🌦',55:'🌧',61:'🌧',63:'🌧',65:'🌧',71:'🌨',73:'🌨',75:'❄️',80:'🌦',81:'🌧',82:'⛈',95:'⛈',96:'⛈',99:'⛈'};
function overlayExtras(){if(!data)return;const h=holiday(),w=data.kpi.weather;let y=ch-46;
 if(w){const hr=new Date().getHours(),nt=hr>=19||hr<6;const t=(nt&&w.code<=2?'🌙':(WX[w.code]||'🌡'))+' Andijon '+w.temp+'°';ctx.font='800 13px Nunito';const ww=ctx.measureText(t).width+20;ctx.fillStyle='rgba(255,255,255,.92)';rr(cw-ww-10,10,ww,26,13);ctx.fill();ctx.fillStyle='#14213D';ctx.textAlign='left';ctx.fillText(t,cw-ww,28)}
 if(h){ctx.font='900 14px Nunito';const ww=ctx.measureText(h.t).width+24;ctx.fillStyle='rgba(219,39,119,.92)';rr(cw/2-ww/2,10,ww,28,14);ctx.fill();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(h.t,cw/2,29)}
 annBanner();
 if(replay.on){const t='⏪ Kun takrori · '+replay.clock;ctx.font='900 15px Nunito';const ww=ctx.measureText(t).width+28;ctx.fillStyle='rgba(20,33,61,.9)';rr(cw/2-ww/2,46,ww,30,15);ctx.fill();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(t,cw/2,66)}}

// ── Qo'shimchalar-2: personaj, mushuk, qo'ng'iroq poygasi, hafta qahramonlari, TV e'loni ──
function applyLook(p,l){if(!p.base)p.base={shirt:p.shirt,hair:p.hair};l=l||{};p.look=l;p.shirt=l.shirt||p.base.shirt;p.hair=l.hair||p.base.hair;p.style=l.style||null;p.acc=l.acc&&l.acc!=='none'?l.acc:null;p.noPhoto=l.head==='drawn'}
// Ofis mushugi "Mosh": yo'lakda aylanadi, sotuvda kassaga yuguradi, kechasi oshxonada uxlaydi.
const cat={id:'cat',x:640,y:960,path:[],room:'oshxona',walk:0,dir:1,next:0,party:0,visible:true};
const CAT_SPOTS=[['oshxona',640,960],['oshxona',740,880],['sotuv',245,470],['sotuv',120,250],['entrance',300,110],['entrance',700,110],['kassa',330,960],['oquv',260,760],['hr',720,760],['rop',720,300]];
const night=()=>{const h=new Date(Date.now()+5*3600e3).getUTCHours();return h>=20||h<7};
function catTick(now){if(cat.path.length)return;if(now<cat.next)return;
 if(night()){if(cat.room!=='oshxona'||Math.hypot(cat.x-560,cat.y-960)>4)moveTo(cat,'oshxona',560,960);cat.next=now+30000;return}
 const sp=pick(CAT_SPOTS);moveTo(cat,sp[0],sp[1]+rnd(-20,20),sp[2]+rnd(-10,10));cat.next=now+rnd(9000,20000)}
function catParty(){if(replay.on&&Math.random()<.5)return;moveTo(cat,'kassa',300,950,()=>{cat.party=performance.now()+5000});cat.next=performance.now()+15000}
function drawCat(){const now=performance.now();catTick(now);const q=ill(cat.x,cat.y),moving=cat.path.length>0;if(moving){const w=cat.path[0];if(Math.abs(w.x-cat.x)>1)cat.dir=w.x>cat.x?1:-1}
 const sleep=night()&&!moving,hop=cat.party>now?Math.abs(Math.sin(now/120))*14:moving?Math.abs(Math.sin(now/90))*3:0;
 ctx.save();ctx.translate(q.x,q.y-hop);ctx.scale(-cat.dir,1);ctx.font='30px sans-serif';ctx.textAlign='center';ctx.fillText(sleep?'🐈':'🐈',0,0);ctx.restore();
 ctx.textAlign='center';if(sleep){ctx.font='18px sans-serif';ctx.fillText('💤',q.x+16,q.y-30-Math.sin(now/600)*4)}
 else if(cat.party>now){ctx.font='18px sans-serif';ctx.fillText('❤️',q.x+(Math.sin(now/200)*8),q.y-40-hop)}}
function stepCat(dt){step(cat,dt)}
// Qo'ng'iroq poygasi
let raceLeader=null;
const raceList=()=>(data?.staff||[]).filter(s=>s.kind==='mgr'||s.kind==='rop').slice().sort((a,b)=>(b.callsToday||0)-(a.callsToday||0));
function race(d,animate){const l=raceList()[0];if(!l||!l.callsToday)return;if(raceLeader&&raceLeader!==l.id&&animate&&l.callsToday>(raceList()[1]?.callsToday||0)){
  feed('🏁',`${esc(l.name)} qo'ng'iroq poygasida birinchi o'ringa chiqdi! (${l.callsToday} ta)`,'#7C3AED');say(people.get('s:'+l.id),'🏁','1-o\'rin!',6,'#7C3AED');tvTick('🏁',l.name+" — qo'ng'iroq poygasida 1-o'rin")}
 raceLeader=l.id}
function raceUi(){const el=document.getElementById('race');if(!el)return;const L=raceList().filter(s=>s.inOffice||s.callsToday);const mx=Math.max(1,...L.map(s=>s.callsToday||0));
 document.getElementById('raceBox').style.display=L.length?'':'none';
 el.innerHTML=L.map((s,i)=>`<div class="lane"><span class="ln">${i===0&&s.callsToday?'🥇 ':''}${esc(s.name)}</span><div class="trk"><i style="left:${Math.round((s.callsToday||0)/mx*86)}%;background:${people.get('s:'+s.id)?.shirt||'#94A3B8'}">${esc(s.name[0]||'?')}</i><b>🏁</b></div><em title="${s.callLeadsToday||0} ta lidga">${s.callsToday||0}</em></div>`).join('')}
// Sotuv xonasi pastida poyga treki
function drawRaceTrack(){const L=raceList();if(!L.length)return;const mx=Math.max(1,...L.map(s=>s.callsToday||0)),x0=60,x1=600,y=781; // sotuv va o'quvchilar xonasi orasidagi devorda (15 stol pastki qatorini yopmasin)
 ctx.fillStyle='rgba(20,33,61,.82)';rr(x0-44,y-16,x1-x0+90,32,16);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.35)';ctx.setLineDash([6,6]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();ctx.setLineDash([]);
 ctx.font='16px sans-serif';ctx.textAlign='center';ctx.fillText('📞',x0-24,y+6);ctx.fillText('🏁',x1+26,y+6);
 L.forEach((s,i)=>{const X=x0+(s.callsToday||0)/mx*(x1-x0),bob=Math.sin(performance.now()/180+i)*1.5;ctx.fillStyle=people.get('s:'+s.id)?.shirt||'#94A3B8';ctx.beginPath();ctx.arc(X,y+bob,10,0,7);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='900 10px Nunito';ctx.fillText((s.name[0]||'?'),X,y+bob+3.5)})}
// O'tgan hafta qahramonlari — kirishdagi taxta
function drawWeek(){const w=data.kpi.week;if(!w||!w.top.length)return;const x=812,y=184,wd=290,h=22+w.top.length*16;
 ctx.fillStyle='rgba(255,255,255,.95)';rr(x,y,wd,h,10);ctx.fill();ctx.strokeStyle='#F59E0B';ctx.lineWidth=2;ctx.stroke();
 ctx.fillStyle='#B45309';ctx.font='900 11px Nunito';ctx.textAlign='left';ctx.fillText("🏆 O'TGAN HAFTA QAHRAMONLARI",x+10,y+15);
 w.top.forEach((t,i)=>{ctx.fillStyle='#14213D';ctx.font='800 12px Nunito';ctx.fillText(['🥇','🥈','🥉'][i]+' '+t.name,x+10,y+32+i*16);ctx.textAlign='right';ctx.fillStyle='#16A34A';ctx.fillText(t.sales+' ta sotuv',x+wd-10,y+32+i*16);ctx.textAlign='left'})}
function drawExtras2(){if(!data)return;drawRaceTrack();drawWeek();drawCat()}
// TV e'loni
let annSeen=null;
function announceIn(d,animate){const a=d.kpi.announce;if(!a){annSeen=null;return}if(annSeen===a.id)return;annSeen=a.id;if(!animate)return;
 feed('📢',`${esc(a.author)}: ${esc(a.text)}`,'#B45309');SND.ev('📅');toast('📢 '+esc(a.text),esc(a.author));
 if(document.body.classList.contains('tv'))tvShow(`<div class="tt">📢 E'lon</div><div class="tm big">${esc(a.text)}</div><div class="tm" style="opacity:.6">— ${esc(a.author)}</div>`,20)}
function annBanner(){const a=data?.kpi?.announce;if(!a)return;const tv=document.body.classList.contains('tv'),now=performance.now();
 const t='📢 '+a.text,fs=tv?28:15;ctx.font=`900 ${fs}px Nunito`;let tw=ctx.measureText(t).width;const maxW=cw-40,w=Math.min(maxW,tw+40),x=cw/2-w/2,h=fs+22,y=tv?78:ch-h-14;
 ctx.save();ctx.shadowColor='rgba(0,0,0,.25)';ctx.shadowBlur=18;ctx.fillStyle=`rgba(180,83,9,${.92+.06*Math.sin(now/400)})`;rr(x,y,w,h,h/2);ctx.fill();ctx.restore();
 ctx.save();ctx.beginPath();ctx.rect(x+14,y,w-28,h);ctx.clip();ctx.fillStyle='#fff';ctx.textAlign='left';
 const ox=tw>w-40?(x+20)-((now/30)%(tw+60))+(w-40):x+20;ctx.fillText(t,ox,y+h/2+fs*.36);if(tw>w-40)ctx.fillText(t,ox+tw+60,y+h/2+fs*.36);ctx.restore()}
const ANN_ROLES=['admin','boshliq','rop','hr'];
async function api(method,path,body){const r=await fetch('/api/office'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Xatolik');return d}
function openAnnounce(){const a=data?.kpi?.announce,card=document.getElementById('card');let hours=3;
 card.innerHTML=`<div class="hd"><div class="big" style="background:#B45309">📢</div><div><h2>TV'ga e'lon</h2><div class="role">Barcha ofis ekranlarida katta yozuv bo'lib chiqadi</div></div></div>
 ${a?`<div class="cur">Hozirgi: <b>${esc(a.text)}</b> <small>· ${esc(a.author)} · ${hm(a.until)} gacha</small></div>`:''}
 <textarea id="annText" maxlength="160" rows="3" placeholder="Masalan: Bugun 18:00 da yig'ilish 🙌"></textarea>
 <div class="opts" id="annH">${[1,3,8,24].map(h=>`<button class="opt${h===3?' on':''}" data-h="${h}">${h===24?'1 kun':h+' soat'}</button>`).join('')}</div>
 <div class="row2">${a?'<button class="ghost" id="annDel">E\'lonni olib tashlash</button>':''}<button class="pri" id="annSend">Yuborish</button></div><button class="close">Yopish</button>`;
 document.getElementById('sheet').classList.add('show');
 card.querySelectorAll('#annH .opt').forEach(b=>b.onclick=()=>{hours=+b.dataset.h;card.querySelectorAll('#annH .opt').forEach(x=>x.classList.toggle('on',x===b))});
 document.getElementById('annSend').onclick=async()=>{const text=document.getElementById('annText').value.trim();if(text.length<2){toast("E'lon matnini yozing");return}
  try{await api('POST','/announce',{text,hours});document.getElementById('sheet').classList.remove('show');toast("📢 E'lon chiqdi",'Barcha ekranlarda');load()}catch(e){toast(esc(e.message))}};
 const del=document.getElementById('annDel');if(del)del.onclick=async()=>{try{await api('DELETE','/announce');document.getElementById('sheet').classList.remove('show');toast("E'lon olib tashlandi");if(data)data.kpi.announce=null;load()}catch(e){toast(esc(e.message))}}}
// Personajim
async function openLook(){let r;try{r=await api('GET','/look')}catch(e){toast(esc(e.message));return}
 if(!r.employee){toast("Xodim kartangiz topilmadi","HR'dagi login emailingizga mos bo'lishi kerak");return}
 const O=r.options,cur=Object.assign({},r.look),me=people.get('s:'+r.employee.id)||people.get('t:'+r.employee.id);
 const LBL={style:{short:'Qisqa',long:'Uzun',scarf:"Ro'mol",cap:'Kepka',bald:'Kal'},acc:{none:"Yo'q",glasses:"Ko'zoynak",headphones:'Quloqchin',bow:'Bant',tie:'Galstuk'},head:{photo:'Rasmim',drawn:'Chizilgan'}};
 const card=document.getElementById('card');
 const sw=(k)=>O[k].map(c=>`<button class="sw${cur[k]===c?' on':''}" data-k="${k}" data-v="${c}" style="background:${c}"></button>`).join('');
 const ch=(k)=>O[k].map(c=>`<button class="opt${(cur[k]||O[k][0])===c?' on':''}" data-k="${k}" data-v="${c}">${LBL[k][c]}</button>`).join('');
 card.innerHTML=`<div class="hd"><canvas id="lookCv" width="120" height="120" style="width:60px;height:60px;border-radius:50%;background:#F3E7D6"></canvas><div><h2>Personajim</h2><div class="role">${esc(r.employee.name)} · ofisda shunday ko'rinasiz</div></div></div>
 <div class="lg">Kiyim rangi</div><div class="opts">${sw('shirt')}</div><div class="lg">Soch rangi</div><div class="opts">${sw('hair')}</div>
 <div class="lg">Soch turi</div><div class="opts">${ch('style')}</div><div class="lg">Aksessuar</div><div class="opts">${ch('acc')}</div><div class="lg">Bosh</div><div class="opts">${ch('head')}</div>
 <div class="row2"><button class="pri" id="lookSave">Saqlash</button></div><button class="close">Yopish</button>`;
 document.getElementById('sheet').classList.add('show');
 const prev=()=>{const c=document.getElementById('lookCv');if(!c)return;const pc=c.getContext('2d'),o=ctx;const h=hash('p'+r.employee.id);
  const tp={x:60,y:66,path:[],walk:0,skin:me?.skin||SKIN[h%4],hair:me?.hair||HAIR[0],shirt:me?.shirt||SH[0],female:!!me?.female,av:me?.av,kind:'staff'};tp.base={shirt:me?.base?.shirt||tp.shirt,hair:me?.base?.hair||tp.hair};applyLook(tp,cur);
  pc.setTransform(1,0,0,1,0,0);pc.clearRect(0,0,120,120);pc.setTransform(2.4,0,0,2.4,-84,-50);ctx=pc;try{drawPerson(tp)}finally{ctx=o}};prev();
 card.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{cur[b.dataset.k]=b.dataset.v;card.querySelectorAll(`[data-k="${b.dataset.k}"]`).forEach(x=>x.classList.toggle('on',x===b));prev()});
 document.getElementById('lookSave').onclick=async()=>{try{const d=await api('PUT','/look',cur);if(me)applyLook(me,d.look);document.getElementById('sheet').classList.remove('show');toast('👤 Personaj saqlandi')}catch(e){toast(esc(e.message))}}}
document.getElementById('annBtn').onclick=openAnnounce;document.getElementById('lookBtn').onclick=openLook;

// ── Qo'shimchalar-3: kunlik maqsad, davomat so'rovlari, shon-sharaf devori, ustozlar reytingi, musiqa, avtomatik kun takrori ──
const REQ_IC={late:['🕐','kech keladi'],absent:['✉️','bugun kelmaydi'],early_leave:['🏃','erta ketadi'],outside:['🏠','ofisdan tashqarida']};
function drawRequests(){const idx={mgr:0,ak:0,x:0};for(const s of data.staff){const seat=seatFor(s,idx);if(!s.req||s.inOffice)continue;const q=ill(seat[1],seat[2]),r=REQ_IC[s.req.type];if(!r)continue;
 const t=`${r[0]} ${s.name}${s.req.type==='late'&&s.req.at?' · '+s.req.at:''}${s.req.state==='pending'?' ?':''}`;ctx.font='800 11px Nunito';const w=ctx.measureText(t).width+14;
 ctx.fillStyle=s.req.state==='approved'?'rgba(255,255,255,.95)':'rgba(254,243,199,.95)';rr(q.x-w/2,q.y-46,w,20,10);ctx.fill();ctx.strokeStyle='#F59E0B';ctx.lineWidth=1;ctx.stroke();
 ctx.fillStyle='#14213D';ctx.textAlign='center';ctx.fillText(t,q.x,q.y-32)}}
function board(x,y,w,title,rows,color){const h=22+rows.length*16;ctx.fillStyle='rgba(255,255,255,.95)';rr(x,y,w,h,10);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
 ctx.fillStyle=color;ctx.font='900 11px Nunito';ctx.textAlign='left';ctx.fillText(title,x+10,y+15);
 rows.forEach(([a,b],i)=>{ctx.fillStyle='#14213D';ctx.font='800 12px Nunito';ctx.textAlign='left';ctx.fillText(a,x+10,y+32+i*16);ctx.textAlign='right';ctx.fillStyle='#16A34A';ctx.fillText(b,x+w-10,y+32+i*16)});ctx.textAlign='left'}
function drawFame(){const f=(data.kpi.fame||[]).slice(0,4);if(!f.length)return;board(420,812,215,"🎓 SHON-SHARAF DEVORI",f.map(x=>['⭐ '+x.name+(x.teacher?' · '+x.teacher:''),x.percent+'%']),'#7C3AED')}
function drawTeacherTop(){const t=data.kpi.teacherTop||[];if(!t.length)return;board(842,1955,205,"⭐ USTOZLAR REYTINGI · 7 KUN",t.map((x,i)=>[['🥇','🥈','🥉'][i]+' '+x.name,x.lessons+' dars']),'#B45309')}
function drawGoal(){const g=data.kpi.goal;if(!g)return;const k=data.kpi,parts=[['📞',k.calls,g.calls],['📅',k.trials,g.trials],['💰',k.sales,g.sales]].filter(p=>p[2]>0);if(!parts.length)return;
 const x0=24,y=238,w=600;ctx.fillStyle='rgba(255,255,255,.95)';rr(x0,y-18,w,32,16);ctx.fill();ctx.strokeStyle='#16A34A';ctx.lineWidth=1.5;ctx.stroke();
 ctx.fillStyle='#15803D';ctx.font='900 11px Nunito';ctx.textAlign='left';ctx.fillText('🎯 BUGUNGI MAQSAD',x0+12,y+2);const pw=(w-150)/parts.length;
 parts.forEach(([ic,v,t],i)=>{const px=x0+140+i*pw,pc=Math.min(1,v/t);ctx.fillStyle='#E5E7EB';rr(px+20,y-6,pw-70,10,5);ctx.fill();ctx.fillStyle=pc>=1?'#F59E0B':'#16A34A';rr(px+20,y-6,Math.max(10,(pw-70)*pc),10,5);ctx.fill();
  ctx.fillStyle='#14213D';ctx.font='14px sans-serif';ctx.fillText(ic,px,y+4);ctx.font='900 11px Nunito';ctx.fillText(`${v}/${t}`,px+pw-46,y+3)})}
function drawExtras3(){if(!data)return;drawRequests();drawFame();drawTeacherTop();drawGoal()}
let goalDone=new Set();
function goalIn(d,animate){const g=d.kpi.goal;if(!g)return;const k=d.kpi;[['calls',"qo'ng'iroq"],['trials','sinov darsi'],['sales','sotuv']].forEach(([key,l])=>{const t=g[key];if(!t||k[key]<t)return;const id=d.date+key+t;if(goalDone.has(id))return;goalDone.add(id);
 if(!animate)return;feed('🎯',`Bugungi maqsad bajarildi: ${t} ta ${l}! Barakalla, jamoa!`,'#15803D');toast('🎯 Maqsad bajarildi!',`${t} ta ${l}`);for(let i=0;i<4;i++)setTimeout(()=>confetti(rnd(60,440),rnd(200,480),50),i*250);SND.ev('🎉')})}
const GOAL_ROLES=['admin','boshliq','rop'];
function openGoal(){const g=data?.kpi?.goal||{},card=document.getElementById('card');
 card.innerHTML=`<div class="hd"><div class="big" style="background:#16A34A">🎯</div><div><h2>Bugungi maqsad</h2><div class="role">Ofis ekranida progress bo'lib chiqadi (faqat son)</div></div></div>
 <div class="gl"><label>📞 Qo'ng'iroq<input id="gC" type="number" min="0" inputmode="numeric" value="${g.calls||''}"></label><label>📅 Sinov darsi<input id="gT" type="number" min="0" inputmode="numeric" value="${g.trials||''}"></label><label>💰 Sotuv<input id="gS" type="number" min="0" inputmode="numeric" value="${g.sales||''}"></label></div>
 <div class="row2">${data?.kpi?.goal?'<button class="ghost" id="gDel">Olib tashlash</button>':''}<button class="pri" id="gSave">Saqlash</button></div><button class="close">Yopish</button>`;
 document.getElementById('sheet').classList.add('show');
 const send=async b=>{try{await api('POST','/goal',b);document.getElementById('sheet').classList.remove('show');toast(b.calls||b.trials||b.sales?'🎯 Maqsad qo\'yildi':'Maqsad olib tashlandi');load()}catch(e){toast(esc(e.message))}};
 document.getElementById('gSave').onclick=()=>send({calls:+document.getElementById('gC').value||0,trials:+document.getElementById('gT').value||0,sales:+document.getElementById('gS').value||0});
 const del=document.getElementById('gDel');if(del)del.onclick=()=>send({calls:0,trials:0,sales:0})}
document.getElementById('goalBtn').onclick=openGoal;
// TV fon musiqasi: tushlik (12:30–14:00) va kechki (17:30–19:00) payt, past ovozda.
const MUSIC=['/ofis/music/1.mp3','/ofis/music/2.mp3','/ofis/music/3.mp3'];let mus=null,musI=0;
function musicTick(){const tv=document.body.classList.contains('tv');const t=new Date(Date.now()+5*3600e3),m=t.getUTCHours()*60+t.getUTCMinutes();
 const want=tv&&SND.on&&!replay.on&&((m>=750&&m<840)||(m>=1050&&m<1140));
 if(want&&!mus){mus=new Audio(MUSIC[musI%MUSIC.length]);mus.volume=0;mus.onended=()=>{musI++;const v=mus;mus=null;v.remove?.();musicTick()};mus.play().then(()=>{let v=0;const f=setInterval(()=>{v+=.02;if(!mus||v>=.22){clearInterval(f);return}mus.volume=v},200)}).catch(()=>{mus=null})}
 else if(!want&&mus){const a=mus;mus=null;let v=a.volume;const f=setInterval(()=>{v-=.02;if(v<=0){clearInterval(f);a.pause();return}a.volume=v},200)}}
setInterval(musicTick,30000);
// TV: soat 19:00 da kun takrori o'zi boshlanadi (kuniga bir marta), keyin kun xulosasi.
let autoReplayDay='';
setInterval(()=>{if(!document.body.classList.contains('tv')||replay.on||!data)return;const t=new Date(Date.now()+5*3600e3),m=t.getUTCHours()*60+t.getUTCMinutes();
 if(m>=1140&&m<1150&&autoReplayDay!==data.date){autoReplayDay=data.date;tvShow(`<div class="tt">⏪ Bugungi kun 1 daqiqada</div>`,5);setTimeout(()=>{startReplay();setTimeout(tvMotto,70000)},5000)}},20000);

// ── Kun takrori: bugungi voqealar 60 soniyada ──
const replay={on:false,clock:'',timers:[]};
async function startReplay(){if(replay.on)return;const q=new URLSearchParams({all:'1'});if(TV)q.set('tv','1');if(langSel)q.set('lang',langSel);
 const r=await fetch(API+'?'+q,{headers:{Authorization:'Bearer '+token}});if(!r.ok)return;const d=await r.json();const ev=d.events.filter(e=>e.at);if(!ev.length){toast('Bugun hali voqea yoʻq');return}
 replay.on=true;clearInterval(pollT);const btn=document.getElementById('replayBtn');if(btn)btn.textContent='⏹ To\'xtatish';
 for(const [id,p] of people){if(id.startsWith('s:')){p.visible=false;p.room='outside';p.path=[]}if(id.startsWith('l:'))people.delete(id)}
 feedEl().innerHTML='';const t0=new Date(ev[0].at).getTime(),t1=new Date(ev[ev.length-1].at).getTime(),span=Math.max(1,t1-t0),DUR=60000;
 ev.forEach(e=>{const at=(new Date(e.at).getTime()-t0)/span*DUR;replay.timers.push(setTimeout(()=>{replay.clock=hm(e.at);
  if(e.type==='checkin'){const p=people.get('s:'+e.staffId);if(p){p.visible=true;p.x=400;p.y=-30;p.room='outside';moveTo(p,...p.seat)}}
  if(e.type==='checkout'){const p=people.get('s:'+e.staffId);if(p&&p.visible)leave(p)}
  if(e.type==='break_out'){const p=people.get('s:'+e.staffId);if(p&&p.visible){if(e.breakKind==='step')leave(p);else moveTo(p,'oshxona',...LUNCH_SEATS[Math.abs(e.staffId.length)%LUNCH_SEATS.length])}}
  if(e.type==='break_in'){const p=people.get('s:'+e.staffId);if(p){if(!p.visible||p.room==='outside'){p.visible=true;p.x=400;p.y=-30;p.room='outside'}moveTo(p,...p.seat)}}
  const [t,c]=evText(e);feed(ICON[e.type]||'•',t,c,e.at);SND.ev(e.type==='sale'?'💰':ICON[e.type],e);animateEvent(e)},at))});
 replay.timers.push(setTimeout(stopReplay,DUR+6000))}
function stopReplay(){replay.timers.forEach(clearTimeout);replay.timers=[];replay.on=false;const btn=document.getElementById('replayBtn');if(btn)btn.textContent='⏪ Kun takrori';
 for(const k of [...people.keys()])if(k.startsWith('l:'))people.delete(k);cursor=null;firstLoad=true;startPoll()}

// ── Ovoz (Web Audio, fayl yuklanmaydi) ──
// Ismli tabrik fayli: ofis/voice/n/<ism>.mp3 (lotin harflari, kichik). Bo'lmasa umumiy "sotuv".
const vslug=n=>String(n||'').toLowerCase().replace(/[ʻʼ'`‘’]/g,'').replace(/[^a-z0-9]/g,'');
const SND=(()=>{let ac=null,on=false,master,amb=null;
 function init(){if(ac)return;try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}
  ac=new (window.AudioContext||window.webkitAudioContext)();master=ac.createGain();master.gain.value=.8;master.connect(ac.destination)}
 function noiseBuf(sec){const b=ac.createBuffer(1,ac.sampleRate*sec,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b}
 let NB=null;const nb=()=>NB||(NB=noiseBuf(2));
 function tone(f,t0,dur,vol=.18,type='sine'){const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(vol,t0+.01);g.gain.exponentialRampToValueAtTime(.0008,t0+dur);o.connect(g);g.connect(master);o.start(t0);o.stop(t0+dur+.05)}
 function burst(t0,dur,vol,f,q=1.2,type='bandpass'){const s=ac.createBufferSource();s.buffer=nb();const fl=ac.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const g=ac.createGain();g.gain.setValueAtTime(vol,t0);g.gain.exponentialRampToValueAtTime(.0008,t0+dur);s.connect(fl);fl.connect(g);g.connect(master);s.start(t0,Math.random()*1.5,dur+.05)}
 const S={
  ding(){const t=ac.currentTime;tone(988,t,.35,.16);tone(1319,t+.09,.5,.14)},
  chime(){const t=ac.currentTime;[1047,1319,1568].forEach((f,i)=>tone(f,t+i*.09,.7,.11,'triangle'))},
  beep(){const t=ac.currentTime;tone(1200,t,.12,.08,'square')},
  warn(){const t=ac.currentTime;tone(330,t,.25,.12,'triangle');tone(262,t+.18,.35,.12,'triangle')},
  pop(){const t=ac.currentTime;const o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(500,t);o.frequency.exponentialRampToValueAtTime(1100,t+.08);g.gain.setValueAtTime(.18,t);g.gain.exponentialRampToValueAtTime(.001,t+.15);o.connect(g);g.connect(master);o.start(t);o.stop(t+.2)},
  kaching(){const t=ac.currentTime;burst(t,.08,.5,3000,.7,'highpass');[2637,3136,3951].forEach((f,i)=>tone(f,t+.06+i*.03,.9,.08));tone(1568,t+.05,.6,.06,'triangle')},
  applause(){const t=ac.currentTime;const n=220;for(let i=0;i<n;i++){const tt=t+.15+Math.pow(Math.random(),.8)*2.8;const fade=1-(tt-t)/3.2;burst(tt,.04+Math.random()*.03,(.25+Math.random()*.35)*Math.max(.15,fade),900+Math.random()*1800,.9)}
   [0,.25].forEach(d=>{tone(523,t+.2+d,.25,.0001)})},
  cheer(){const t=ac.currentTime;for(let k=0;k<5;k++){const o=ac.createOscillator(),g=ac.createGain(),fl=ac.createBiquadFilter();o.type='sawtooth';const f0=260+Math.random()*180;o.frequency.setValueAtTime(f0,t+.1);o.frequency.linearRampToValueAtTime(f0*1.6,t+.5);o.frequency.linearRampToValueAtTime(f0*1.3,t+1.1);fl.type='bandpass';fl.frequency.value=900+k*200;fl.Q.value=2;g.gain.setValueAtTime(0,t+.1);g.gain.linearRampToValueAtTime(.025,t+.3);g.gain.exponentialRampToValueAtTime(.0005,t+1.3);o.connect(fl);fl.connect(g);g.connect(master);o.start(t+.1);o.stop(t+1.4)}}
 };
 function ambStart(){if(amb)return;const s=ac.createBufferSource();s.buffer=noiseBuf(4);s.loop=true;
  const f1=ac.createBiquadFilter();f1.type='bandpass';f1.frequency.value=420;f1.Q.value=.9;const f2=ac.createBiquadFilter();f2.type='lowpass';f2.frequency.value=1100;
  const g=ac.createGain();g.gain.value=.05;s.connect(f1);f1.connect(f2);f2.connect(g);g.connect(master);s.start();
  const lfo=ac.createOscillator(),lg=ac.createGain();lfo.frequency.value=.35;lg.gain.value=.025;lfo.connect(lg);lg.connect(g.gain);lfo.start();
  const lfo2=ac.createOscillator(),lg2=ac.createGain();lfo2.frequency.value=2.7;lg2.gain.value=120;lfo2.connect(lg2);lg2.connect(f1.frequency);lfo2.start();
  const tick=setInterval(()=>{if(!on)return;const t=ac.currentTime;const n=Math.random()<.6?ri(3,9):0;for(let i=0;i<n;i++)burst(t+i*(.07+Math.random()*.06),.02,.05,3500,3,'bandpass');
   if(Math.random()<.04){tone(1400,t+.5,.25,.025);tone(1400,t+.85,.25,.025)}},900);
  amb={s,g,tick}}
 function ambStop(){if(!amb)return;amb.s.stop();clearInterval(amb.tick);amb=null}
 // Ovozli e'lon (ElevenLabs, o'zbekcha): fetch + WebAudio — CSP media-src ga bog'liq emas
 const VB={};let VT=0;
 async function voice(n,delay=0,fb=null){if(!on||!ac)return;const now=performance.now();if(now-VT<4000)return;VT=now;
  try{if(VB[n]===false&&fb)n=fb;if(!VB[n]){const r=await fetch('/ofis/voice/'+n+'.mp3');const okA=r.ok&&/audio|mpeg|octet/.test(r.headers.get('content-type')||'');let dec=null;if(okA){try{const buf=await r.arrayBuffer();dec=await new Promise((ok,no)=>ac.decodeAudioData(buf,ok,no))}catch(_){dec=null}}if(!dec){VB[n]=false;if(fb){VT=0;return voice(fb,delay)}return}VB[n]=dec}
   const s=ac.createBufferSource(),g=ac.createGain();g.gain.value=1.4;s.buffer=VB[n];s.connect(g);g.connect(master);
   if(amb){const t=ac.currentTime+delay;amb.g.gain.setTargetAtTime(.012,t,.1);amb.g.gain.setTargetAtTime(.05,t+VB[n].duration,.4)}
   s.start(ac.currentTime+delay)}catch(e){}}
 const MAP={'🟢':'ding','📅':'chime','✅':'beep','⚠️':'warn','🎉':'pop','🎓':'pop','👋':'pop','🎥':'beep'};
 let last={};
 return{get on(){return on},
  toggle(v){init();ac.resume&&ac.resume();on=v==null?!on:v;if(on)ambStart();else ambStop();document.getElementById('sndBtn').textContent=on?'🔊 Ovoz':'🔇 Ovoz';return on},
  voice,
  ev(icon,e){if(!on||!ac)return;if(icon==='💰'){S.kaching();setTimeout(()=>{S.applause();S.cheer()},350);const sl=vslug(e&&nameOf(e.managerId));voice(sl?'n/'+sl:'sotuv',1.4,'sotuv');return}const k=MAP[icon];if(!k)return;const now=performance.now();if(now-(last[k]||0)<700)return;last[k]=now;S[k]()}}
})();
document.getElementById('sndBtn').onclick=e=>{e.stopPropagation();SND.toggle();try{localStorage.setItem('ofisSnd',SND.on?'1':'0')}catch(err){}};
(()=>{let pref='1';try{pref=localStorage.getItem('ofisSnd')||'1'}catch(e){}if(pref!=='1')return;
 const once=()=>{removeEventListener('pointerdown',once,true);if(!SND.on)SND.toggle(true)};addEventListener('pointerdown',once,true)})();

// ── TV ──
const tvTk=document.getElementById('tvTicker'),bigEl=document.getElementById('big');let tvTour=null,tvIdx=0;
function tvTick(icon,text){if(!document.body.classList.contains('tv'))return;const d=document.createElement('div');d.textContent=icon+' '+text;tvTk.prepend(d);while(tvTk.children.length>3)tvTk.lastChild.remove()}
function bigShow(h,s){document.getElementById('bigS').innerHTML=h.replace(/^💰\s*Sotuv!\s*/,'')+(s?' · '+s:'');bigEl.classList.add('show');clearTimeout(bigT);bigT=setTimeout(()=>bigEl.classList.remove('show'),4000)}
const TOUR=['sotuv',null,'jonli','sinov','oquv',null,'kassa','rop',null,'bosh'];
function tvSet(on){document.body.classList.toggle('tv',on);tvTimersOn(on);if(on){try{const el=document.documentElement;const fr=(el.requestFullscreen||el.webkitRequestFullscreen||(()=>{})).call(el);if(fr&&fr.catch)fr.catch(()=>{})}catch(e){}
  if(!SND.on)SND.toggle(true);clearInterval(tvTour);tvTour=setInterval(()=>{tvIdx=(tvIdx+1)%TOUR.length;zoomTo(TOUR[tvIdx])},12000);hint.style.opacity=0}
 else{clearInterval(tvTour);try{document.fullscreenElement&&document.exitFullscreen()}catch(e){}zoomTo(null)}setTimeout(resize,60)}
document.getElementById('tvBtn').onclick=()=>{if(TV){tvSet(true);return}
 // TV — jamoa ko'rinishi (summasiz): alohida manzil ochiladi, shu brauzer sessiyasi bilan.
 location.href='/ofis?tv=1'};
document.getElementById('tvExit').onclick=()=>{tvSet(false);if(TV)location.href='/ofis'};
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&document.body.classList.contains('tv')&&!TV)tvSet(false)});
// TV: har 10 daqiqada "Bugungi top-3", har 5 daqiqada kun vaqtiga mos jumla.
const MOTTO={tong:["Xayrli tong, jamoa! Bugun ham zo'r kun bo'ladi 💪","Har bir qo'ng'iroq — yangi imkoniyat ☎️","Bugungi birinchi sotuv kimdan bo'ladi? 🏁"],
 kun:["Yarim kun o'tdi — davom etamiz! 🚀","Sinov darsiga kelgan har bir o'quvchi — kelajakdagi do'stimiz 🤝","Tabassum bilan gaplashing — mijoz buni sezadi 😊"],
 kech:["Kun yakuniga yaqin — oxirgi zarbani beramiz! ⚡","Bugun qilgan ishingiz ertangi natija 🌱"]};
function tvShow(html,sec){const el=document.getElementById('tvMsg');el.innerHTML=html;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),sec*1000)}
let tvRot=0;
function tvTop(){if(!data)return;const k=data.kpi,M=['🥇','🥈','🥉'],row=(i,n,v)=>`<div class="tr"><b>${M[i]}</b><span>${esc(n)}</span><em>${v}</em></div>`;
 const t=k.top||[],r=raceList().filter(s=>s.callsToday).slice(0,3),w=k.week?.top||[];
 const opts=[t.length&&`<div class="tt">🏆 Bugungi top</div>${t.map((x,i)=>row(i,x.name,x.sales+' ta sotuv')).join('')}`,
  r.length&&`<div class="tt">🏁 Qo'ng'iroq poygasi</div>${r.map((x,i)=>row(i,x.name,x.callsToday+" ta · "+(x.callLeadsToday||0)+' lid')).join('')}`,
  w.length&&`<div class="tt">🏆 O'tgan hafta qahramonlari</div>${w.map((x,i)=>row(i,x.name,x.sales+' ta sotuv')).join('')}`].filter(Boolean);
 if(!opts.length)return;tvShow(opts[tvRot++%opts.length],12)}
function tvMotto(){if(!data)return;const hr=new Date(Date.now()+5*3600e3).getUTCHours(),k=data.kpi;
 if(hr>=18){tvShow(`<div class="tt">🌙 Bugungi kun</div><div class="tm">${k.leads} lid · ${k.trials} sinov darsi · ${k.sales} sotuv</div><div class="tm">Rahmat, jamoa! 🙏</div>`,12);return}
 const arr=hr<12?MOTTO.tong:hr<16?MOTTO.kun:MOTTO.kech;tvShow(`<div class="tm big">${pick(arr)}</div>`,10)}
let tvTimers=[];
function tvTimersOn(on){tvTimers.forEach(clearInterval);tvTimers=[];if(on){tvTimers.push(setInterval(tvTop,10*60000),setInterval(tvMotto,5*60000));setTimeout(tvMotto,8000);setTimeout(tvTop,40000)}}
function tvUi(){if(!document.body.classList.contains('tv')||!data)return;document.getElementById('tvclock').textContent=hm(Date.now());const k=data.kpi;
 document.getElementById('tvk').innerHTML=[['Ofisda',k.inOffice+'/'+k.staff],['Lid',k.leads],['Sinov',k.trials],['Sotuv',k.sales],['Darsda',k.live],['Ilovada',k.online]].map(([a,b])=>`<div>${a}<b>${b}</b></div>`).join('')
 +(k.yday?`<div>Kechaga nisbatan<b>${(n=>n>0?'▲ +'+n:n<0?'▼ '+n:'=')(k.sales+k.trials-k.yday.sales-k.yday.trials)}</b></div>`:'')}

document.getElementById('replayBtn').onclick=()=>replay.on?stopReplay():startReplay();

// ── Kirish ──
function showLogin(msg){document.getElementById('app').style.display='none';document.getElementById('login').style.display='block';document.getElementById('loginErr').textContent=msg||'';clearInterval(pollT)}
document.getElementById('loginForm').addEventListener('submit',async e=>{e.preventDefault();const b=document.getElementById('lb');b.disabled=true;b.textContent='Kirish...';
 try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('lu').value.trim(),password:document.getElementById('lp').value})});
  const d=await r.json().catch(()=>({}));if(!r.ok||!d.token)throw new Error(d.error||"Login yoki parol noto'g'ri");
  localStorage.setItem('mh_token',d.token);localStorage.setItem('mh_currentUser',JSON.stringify(d.user));start()}
 catch(err){document.getElementById('loginErr').textContent=err.message}finally{b.disabled=false;b.textContent='Kirish'}});
function start(){token=localStorage.getItem('mh_token');try{user=JSON.parse(localStorage.getItem('mh_currentUser')||'null')}catch(e){user=null}
 if(!token){showLogin();return}document.getElementById('login').style.display='none';document.getElementById('app').style.display='';
 if(TV){document.body.classList.add('tv')}resize();startPoll();if(TV)tvSet(true)}

// ── Sikl ──
let last=performance.now(),uiT=0;
function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;for(const p of people.values())step(p,dt);step(cat,dt);
 for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.vy+=260*dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.life-=dt;if(f.life<=0)fx.splice(i,1)}
 for(const k of['x','y','s'])cam[k]+=(camT[k]-cam[k])*Math.min(1,dt*7);
 // Ko'p qolib ketgan lidlar (voqea kelmagan) — 2 daqiqadan keyin chiqib ketadi
 for(const p of people.values())if(p.kind==='lead'&&p.ttl&&now>p.ttl&&!p.path.length&&p.bench!=null){p.ttl=0;p.bench=null;leave(p)}
 render();uiT-=dt;if(uiT<=0){ui();uiT=1}requestAnimationFrame(loop)}
setTimeout(()=>{hint.style.opacity=0},7000);
(document.fonts?document.fonts.ready:Promise.resolve()).then(()=>{start();requestAnimationFrame(loop)});
})();
