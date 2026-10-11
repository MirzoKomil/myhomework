'use strict';
const policy=require('./policy');
const store=require('./store');
const events=require('./events');
const groups=require('../domworkGroups');
const workflow=require('../../../js/trialWorkflow');
const staff=require('./staff');
function localClock(now=new Date()) {
    const shifted=new Date(now.getTime()+5*3600000);
    return {date:policy.today(now),hour:shifted.getUTCHours(),minute:shifted.getUTCMinutes(),day:shifted.getUTCDay() || 7};
}
function scheduledToday(student,now=new Date()) {
    const clock=localClock(now), d=Number(student.lesson_day_of_week);
    const days=[1,3,5].includes(d)?[1,3,5]:[2,4,6].includes(d)?[2,4,6]:[d];
    if(!days.includes(clock.day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(student.lesson_time || '')) return null;
    if(student.extra_data?.startDate && student.extra_data.startDate>clock.date) return null;
    return new Date(clock.date+'T'+student.lesson_time+':00+05:00');
}
function checkpoint(at,minutes,now=new Date()) {
    const delta=(new Date(at).getTime()-now.getTime())/60000;
    return Number.isFinite(delta) && delta<=minutes && delta>minutes-2;
}
async function once(db,key,fn) {
    const insert=await db.query('INSERT INTO domwork_bot_jobs(key) VALUES($1) ON CONFLICT DO NOTHING RETURNING key',[key]);
    if(!insert.rows.length) return;
    await fn();
}
async function roles(db,allowed) {
    const out=[];
    for(const row of (await db.query('SELECT telegram_id FROM domwork_bot_links WHERE NOT paused')).rows) {
        const identity=await store.identity(db,row.telegram_id);
        if(identity && !identity.paused && allowed.includes(identity.role)) out.push(identity);
    }
    return out;
}
async function learningMessage(db,key,group,text,extra={}) {
    if(!group?.botVerified || !group.chatId || !(await store.settings(db)).data.groupNotificationsEnabled) return;
    await store.enqueue(db,{key,targetKind:'group',targetId:group.chatId,payload:{chat_id:group.chatId,text,_automation:true,_binding:group.id,...extra}});
}
async function run(db,now=new Date()) {
    const lock=(await db.query("SELECT pg_try_advisory_xact_lock(hashtext('domwork-bot-scheduler')) AS locked")).rows[0];
    if(!lock.locked) return;
    const settings=(await store.settings(db)).data, clock=localClock(now);
    const expires=()=>new Date(now.getTime()+3*60000).toISOString();
    if(settings.remindersEnabled) {
        const students=(await db.query("SELECT * FROM students WHERE subject='russian'")).rows.filter(policy.activeStudent);
        for(const student of students) {
            const at=scheduledToday(student,now);
            if(!at) continue;
            const atText=at.toISOString(), identity=await events.linked(db,'student',student.id);
            const group=await groups.defaultForTeacher(db,'classroom',student.teacher_id,{delivery:true});
            for(const minute of [30,5]) if(checkpoint(at,minute,now)) await once(db,`class:${student.id}:${atText}:${minute}`,async()=>{
                const message=`Darsingiz ${minute} daqiqadan keyin boshlanadi.${group?'\nGuruh: '+group.inviteLink:''}`;
                await events.privateMessage(db,`reminder:${student.id}:${atText}:${minute}`,identity,message,{_setting:'remindersEnabled',_expiresAt:expires(),_schedule:{studentId:student.id,at:atText}});
                await learningMessage(db,`group-class:${group?.id}:${atText}:${minute}`,group,`Dars boshlanishiga ${minute} daqiqa qoldi.`,{_setting:'remindersEnabled',_expiresAt:expires(),_schedule:{studentId:student.id,at:atText,teacherId:student.teacher_id}});
            });
            const end=new Date(at.getTime()+(Number(student.lesson_duration)||15)*60000);
            if(checkpoint(end,-15,now)) await once(db,`missing-attendance:${student.id}:${atText}`,async()=>{
                const mark=(await db.query(`SELECT present FROM main_attendance WHERE att_key=$1 AND student_id=$2 AND day=$3`,
                    [clock.date.slice(0,7)+'_'+student.teacher_id,student.id,Number(clock.date.slice(8))])).rows[0];
                const explicit=(await db.query("SELECT present FROM domwork_bot_attendance_marks WHERE student_id=$1 AND date=$2 AND duty='main'",[student.id,clock.date])).rows[0];
                if(mark || explicit?.present!=null) return;
                await events.privateMessage(db,`attendance-reminder:${student.id}:${atText}`,await events.employee(db,student.teacher_id),
                    `Iltimos, ${student.name} ning darsi bo‘yicha davomatni belgilang.`,{_setting:'remindersEnabled',_expiresAt:expires(),_assignment:{studentId:student.id,teacherId:student.teacher_id,duty:'main'},_schedule:{studentId:student.id,at:atText},_missingAttendance:{studentId:student.id,teacherId:student.teacher_id,duty:'main',date:clock.date}});
                await events.groupMessage(db,`attendance-team:${student.id}:${atText}`,'teachers','Rejadagi dars uchun davomat hali belgilanmagan. Ustoz kabinetidan tekshiring.',{_expiresAt:expires()});
            });
            if(student.assistant_teacher_id && clock.hour===21 && clock.minute<2) await once(db,`assistant-attendance:${student.id}:${clock.date}`,async()=>{
                const guard={studentId:student.id,teacherId:student.assistant_teacher_id,duty:'assistant',date:clock.date};
                const mark=(await db.query('SELECT present FROM assistant_attendance WHERE att_key=$1 AND student_id=$2 AND day=$3',
                    [clock.date.slice(0,7)+'_'+guard.teacherId,student.id,Number(clock.date.slice(8))])).rows[0];
                if(mark) return;
                await events.privateMessage(db,`assistant-attendance:${student.id}:${clock.date}`,await events.employee(db,guard.teacherId),
                    `${student.name} uchun bugungi yordamchi ustozlik davomati belgilanmagan. Kabinetingizdan tekshiring.`,
                    {_setting:'remindersEnabled',_expiresAt:expires(),_assignment:guard,_missingAttendance:guard});
            });
        }
        for(const row of (await db.query("SELECT * FROM leads WHERE language='russian' AND status='sinov-darsida' AND deleted_at IS NULL")).rows) {
            const lead={...row.extra_data,id:row.id,name:row.name,status:row.status};
            const booking=workflow.request(lead);
            if(!booking || !['pending','accepted'].includes(booking.state)) continue;
            for(const minute of [60,15]) if(checkpoint(booking.scheduledAt,minute,now)) await once(db,`trial-reminder:${lead.id}:${booking.id}:${minute}`,async()=>{
                const group=await groups.defaultForTeacher(db,'trial',booking.teacherId,{delivery:true});
                const message=`Sinov darsingiz ${minute} daqiqadan keyin boshlanadi.${group?'\nGuruh: '+group.inviteLink:''}`;
                const guard={_setting:'remindersEnabled',_expiresAt:expires(),_trial:{leadId:lead.id,requestId:booking.id,teacherId:booking.teacherId,state:booking.state}};
                await events.privateMessage(db,`trial-learner:${lead.id}:${booking.id}:${minute}`,await events.linked(db,'lead',lead.id),message,guard);
                await learningMessage(db,`trial-group:${group?.id}:${booking.id}:${minute}`,group,message,guard);
            });
        }
    }
    const reached=time=>{const [h,m]=time.split(':').map(Number); return clock.hour===h && clock.minute>=m && clock.minute<m+2;};
    if(settings.promotionsEnabled && settings.promotionText && reached(settings.promotionTime || '10:00')) {
        await once(db,'promotion:'+clock.date,async()=>{
            for(const identity of await roles(db,['trial'])) await events.privateMessage(db,'promotion:'+clock.date+':'+identity.telegramId,identity,settings.promotionText,{_setting:'promotionsEnabled',_expiresAt:new Date(now.getTime()+3600000).toISOString()});
        });
    }
    if(settings.reportsEnabled && (reached('20:00') || reached('21:00'))) {
        const type=reached('20:00')?'daily':'comparison';
        await once(db,'report:'+clock.date+':'+type,async()=>{
            for(const identity of await roles(db,['admin','rop','marketing'])) {
                const action=identity.role==='admin'?'digest':identity.role==='rop'?'reports':'daily';
                const value=await staff.action(db,identity,action,{now,daily:true,comparison:type==='comparison'});
                await events.privateMessage(db,'report:'+clock.date+':'+type+':'+identity.telegramId,identity,`${clock.date} · ${type==='daily'?'Kunlik hisobot':'24 soatlik taqqoslama'}\n${value}`,{_expiresAt:new Date(now.getTime()+3600000).toISOString()});
            }
            for(const [department,role,action] of [['sales','rop','reports'],['marketing','marketing','daily']]) {
                const value=await staff.action(db,{role,language:'russian'},action,{now,daily:true,comparison:type==='comparison'});
                await events.groupMessage(db,'department-report:'+clock.date+':'+type+':'+department,department,value,{_setting:'reportsEnabled',_expiresAt:new Date(now.getTime()+3600000).toISOString()});
            }
        });
    }
    if(settings.groupNotificationsEnabled && reached(settings.familyTime || '10:00')) {
        if(settings.familyText) await once(db,'family-content:'+clock.date,()=>events.groupMessage(db,'family-content:'+clock.date,'family',settings.familyText));
        if(clock.day===7 && settings.methodicalText) await once(db,'methodical:'+clock.date,()=>events.groupMessage(db,'methodical:'+clock.date,'teachers',settings.methodicalText));
        if(clock.day===7) await once(db,'video-day:'+clock.date,async()=>{
            const rows=(await db.query("SELECT * FROM domwork_learning_groups WHERE type='classroom' AND NOT archived AND verified_at IS NOT NULL")).rows;
            for(const row of rows) await learningMessage(db,'video-day:'+clock.date+':'+row.id,groups.dto(row),'Bugun platformadagi video darslarni ko‘ring va yordamchi ustozingiz bilan vazifalarni bajaring. https://myhomework.uz/student/');
        });
    }
}
module.exports={localClock,scheduledToday,checkpoint,once,run};
