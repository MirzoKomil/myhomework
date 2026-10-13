'use strict';
const engine=require('../../../js/payrollEngine');
const policy=require('./policy');
const reports=require('./reports');
const store=require('./store');
const money=n=>new Intl.NumberFormat('uz-UZ').format(n).replace(/[\u00a0\u202f]/g,' ')+' UZS';
const MILESTONES=[20000000,40000000,60000000];
const RELEASE={id:'domwork-bot-insights-2026-10',text:'CRM yangilandi: bot menyulari erkin almashadi; sotuv pog‘onalari va g‘oliblar xabarlari uchun alohida sozlamalar, yordamchi ustoz baholarining aniq tarixi va rus tili reklama sarfi kiritish imkoniyati qo‘shildi.'};
async function sales(db,start,end,excludeId=null) {
    const records=(await db.query(`SELECT id,lead_id,manager_id,language,amount,TO_CHAR(paid_date,'YYYY-MM-DD') AS date
        FROM payment_records WHERE language='russian' AND paid_date BETWEEN $1::date AND $2::date`,[start,end])).rows;
    const employees=(await db.query('SELECT id,name,role,lang,status FROM hr_employees ORDER BY id')).rows.map(r=>({...r}));
    const leads=(await db.query("SELECT id,manager_id,extra_data FROM leads WHERE language='russian'")).rows;
    const cashFlow=(await db.query("SELECT data FROM json_data WHERE key='cashFlow'")).rows[0]?.data;
    const source={hrEmployees:employees,leads:{russian:leads.map(r=>({...r.extra_data,id:r.id,managerId:r.manager_id}))},
        paymentRecords:records.filter(r=>r.id!==excludeId).map(r=>({id:r.id,leadId:r.lead_id,managerId:r.manager_id,language:r.language,amount:Number(r.amount),paidDate:r.date})),
        cashFlow:Array.isArray(cashFlow)?cashFlow:[]};
    const facts=engine.salesFacts(source,'russian',engine.period(start,end),engine.defaults());
    return {warnings:facts.warnings,rows:employees.filter(e=>e.lang==='russian' && e.status!=='inactive' && engine.role(e)==='sales')
        .map(e=>({id:e.id,name:e.name,value:facts.byManager[e.id]||0})).filter(e=>e.value>0).sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id))};
}
async function milestones(db,payment,now=new Date()) {
    const settings=(await store.settings(db)).data;
    if(!settings.milestonesEnabled || !settings.eventsEnabled || !settings.groupNotificationsEnabled || payment.language!=='russian') return [];
    const date=typeof payment.paid_date==='string'?payment.paid_date:null;
    const period=policy.monthPeriod(now), today=policy.today(now);
    if(date?.slice(0,7)!==today.slice(0,7)||date>today) return [];
    const after=await sales(db,period.start,today),before=await sales(db,period.start,today,payment.id);
    if(after.warnings.length || before.warnings.length)return [];
    const value=after.rows.find(r=>r.id===payment.manager_id)?.value || 0;
    const prior=before.rows.find(r=>r.id===payment.manager_id)?.value || 0;
    return MILESTONES.filter(n=>prior<n && value>=n);
}
async function teachers(db,start,end) {
    const marks=(await db.query(`SELECT a.att_key,a.student_id,a.day,a.present FROM main_attendance a
        JOIN students s ON s.id=a.student_id AND s.subject='russian' WHERE LEFT(a.att_key,7) BETWEEN LEFT($1,7) AND LEFT($2,7)`,[start,end])).rows;
    const employees=(await db.query("SELECT id,name,role,lang,status FROM hr_employees WHERE (role='rus-oqituvchi' OR (role<>'ingliz-oqituvchi' AND lang='russian')) AND COALESCE(status,'active')<>'inactive'")).rows;
    const eligible=new Map(employees.filter(e=>engine.role(e)==='teacher').map(e=>[e.id,e]));
    const days=new Map();
    for(const mark of marks) {
        const month=mark.att_key.slice(0,7), date=month+'-'+String(mark.day).padStart(2,'0'), owner=mark.att_key.slice(8);
        if(!engine.date(date)||date<start||date>end||!eligible.has(owner))continue;
        const key=mark.student_id+':'+date;
        if(!days.has(key))days.set(key,[]);
        days.get(key).push({owner,present:mark.present});
    }
    const counts=new Map();
    for(const entries of days.values()) {
        // Contradictory or multiply-owned student-days do not select a winner.
        if(new Set(entries.map(e=>e.owner)).size!==1 || entries.some(e=>e.present!==1))continue;
        const owner=entries[0].owner;counts.set(owner,(counts.get(owner)||0)+1);
    }
    const russianIds=new Set((await db.query("SELECT id FROM students WHERE subject='russian'")).rows.map(r=>r.id));
    const grades=(await db.query("SELECT data FROM json_data WHERE key='liveGrades'")).rows[0]?.data || {};
    const scores=new Map();
    for(const [id,entries] of Object.entries(grades)) if(russianIds.has(id)&&Array.isArray(entries)) for(const g of entries) {
        const n=g.studentRatingOfTeacher?.overall;
        if(!eligible.has(g.teacherId)||typeof n!=='number'||!Number.isFinite(n)||n<1||n>5||!engine.date(g.date)||g.date<start||g.date>end)continue;
        if(!scores.has(g.teacherId))scores.set(g.teacherId,[]);
        scores.get(g.teacherId).push(n);
    }
    return {warnings:[],rows:[...counts].map(([id,value])=>({id,name:eligible.get(id).name,value,
        rating:scores.has(id)?scores.get(id).reduce((s,n)=>s+n,0)/scores.get(id).length:null,ratings:scores.get(id)?.length || 0}))
        .sort((a,b)=>b.value-a.value||(b.rating??0)-(a.rating??0)||a.id.localeCompare(b.id))};
}
function winners(rows) {
    if(!rows.length)return [];
    const top=rows[0];return rows.filter(r=>r.value===top.value && (r.rating??null)===(top.rating??null));
}
async function summary(db,criterion,start,end,label) {
    const result=criterion==='sales'?await sales(db,start,end):await teachers(db,start,end);
    // Unattributable refunds can change rankings; never announce a financial winner on incomplete evidence.
    const selected=result.warnings.length?[]:winners(result.rows);
    const text=`🏆 ${label}\nDavr: ${start} — ${end}\n`+(selected.length
        ?selected.map(r=>`${r.name}: ${criterion==='sales'?money(r.value):r.value+' ta tasdiqlangan dars'+(r.rating!=null?' · Baho '+r.rating.toFixed(1)+' ('+r.ratings+')':' · Bu davr uchun baho yo‘q')}`).join('\n')
        :result.warnings.length?'Qaytarilgan pullar/menejer bog‘lanishlarini tekshirish kerak; g‘olib e’lon qilinmaydi.':'Tasdiqlangan natija yo‘q; g‘olib e’lon qilinmaydi.');
    return {criterion,start,end,winners:selected,text};
}
async function announce(db,key,type,criterion,start,end,label,setting,now) {
    const value=await summary(db,criterion,start,end,label);
    if(!value.winners.length)return;
    await require('./events').groupMessage(db,key,type,value.text,{_setting:setting,
        _expiresAt:new Date(now.getTime()+3600000).toISOString(),_award:{criterion,start,end,winners:value.winners}});
}
async function run(db,settings,clock,now,once) {
    if(!settings.groupNotificationsEnabled)return;
    const [hour,minute]=(settings.awardsTime || '20:00').split(':').map(Number);
    if(clock.hour!==hour||clock.minute<minute||clock.minute>=minute+2)return;
    if(settings.dailyAwardsEnabled) await once(db,'daily-awards:'+clock.date,async()=>{
        await announce(db,'daily-sales:'+clock.date,'sales','sales',clock.date,clock.date,'Kun sotuvchisi','dailyAwardsEnabled',now);
        await announce(db,'daily-teacher:'+clock.date,'teachers','lessons',clock.date,clock.date,'Kun ustozi','dailyAwardsEnabled',now);
    });
    if(clock.day===7 && settings.weeklyAwardsEnabled && ['sales','lessons'].includes(settings.weeklyAwardCriterion))
        await once(db,'weekly-awards:'+clock.date,()=>announce(db,'weekly-awards:'+clock.date,'family',settings.weeklyAwardCriterion,
            reports.shift(clock.date,-6),clock.date,'Hafta yetakchisi','weeklyAwardsEnabled',now));
    const next=reports.shift(clock.date,1);
    if(next.slice(0,7)!==clock.date.slice(0,7) && settings.monthlyAwardsEnabled && ['sales','lessons'].includes(settings.monthlyAwardCriterion))
        await once(db,'monthly-awards:'+clock.date,()=>announce(db,'monthly-awards:'+clock.date,'family',settings.monthlyAwardCriterion,
            clock.date.slice(0,7)+'-01',clock.date,'Oy yetakchisi','monthlyAwardsEnabled',now));
}
async function release(db) {
    const inserted=await db.query('INSERT INTO domwork_bot_jobs(key) VALUES($1) ON CONFLICT DO NOTHING RETURNING key',['release:'+RELEASE.id]);
    const settings=(await store.settings(db)).data;
    if(inserted.rows.length && settings.releaseNotesEnabled && settings.eventsEnabled && settings.groupNotificationsEnabled)
        await require('./events').capture(db,'release',RELEASE.id,{},'release:'+RELEASE.id);
}
module.exports={MILESTONES,RELEASE,sales,teachers,winners,milestones,summary,run,release};
