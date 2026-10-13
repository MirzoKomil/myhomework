'use strict';
const {randomUUID}=require('node:crypto');
const store=require('./store');
const policy=require('./policy');
const groups=require('../domworkGroups');
const workflow=require('../../../js/trialWorkflow');
const callbacks=require('./callbacks');
const money=n=>new Intl.NumberFormat('uz-UZ').format(Number(n)||0).replace(/[\u00a0\u202f]/g,' ')+' UZS';
async function capture(db,type,referenceId,data={},key) {
    // No replay of old imports or notifications before the bot is deliberately enabled.
    if(process.env.DOMWORK_BOT_ENABLED!=='true') return;
    if(!(await db.query("SELECT to_regclass('domwork_bot_events') AS present")).rows[0]?.present) return;
    await db.query(`INSERT INTO domwork_bot_events(event_key,type,reference_id,data) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [key || randomUUID(),type,referenceId,JSON.stringify(data)]);
}
async function linked(db,kind,id) {
    const row=(await db.query('SELECT telegram_id FROM domwork_bot_links WHERE account_kind=$1 AND account_id=$2',[kind,id])).rows[0];
    return row && await store.identity(db,row.telegram_id);
}
async function payment(db,id) {
    if(process.env.DOMWORK_BOT_ENABLED!=='true' || !(await db.query("SELECT to_regclass('domwork_bot_events') AS present")).rows[0]?.present) return;
    const record=(await db.query("SELECT *,TO_CHAR(paid_date,'YYYY-MM-DD') AS paid_date FROM payment_records WHERE id=$1 AND language='russian' AND NOT legacy_review",[id])).rows[0];
    if(record) await capture(db,'payment',id,{month:policy.today().slice(0,7),milestones:await require('./recognition').milestones(db,record)},'payment:'+id);
}
async function employee(db,id) {
    const rows=(await db.query(`SELECT l.telegram_id FROM domwork_bot_links l JOIN users u ON u.id=l.account_id
        LEFT JOIN user_sales_manager_links m ON m.user_id=u.id
        JOIN hr_employees h ON (u.role='sales_manager' AND m.manager_id IS NOT NULL AND h.id=m.manager_id)
        OR ((u.role<>'sales_manager' OR m.manager_id IS NULL) AND LOWER(TRIM(h.login))=LOWER(TRIM(u.email)))
        WHERE l.account_kind='user' AND h.id=$1`,[id])).rows;
    if(rows.length!==1) return null;
    const identity=await store.identity(db,rows[0].telegram_id);
    return identity?.employeeId===id?identity:null;
}
async function privateMessage(db,key,identity,text,extra={}) {
    if(!identity || identity.paused) return;
    await store.enqueue(db,{key,targetId:identity.telegramId,role:identity.role,account:identity,
        payload:{chat_id:identity.telegramId,text:String(text).slice(0,3500),_automation:true,...(key.startsWith('event:')?{_setting:'eventsEnabled'}:{}),...extra}});
}
async function groupMessage(db,key,type,text,extra={}) {
    const settings=(await store.settings(db)).data;
    if(!settings.groupNotificationsEnabled) return;
    const row=(await db.query("SELECT * FROM domwork_bot_groups WHERE type=$1 AND scope='' AND active",[type])).rows[0];
    if(!row) return;
    await store.enqueue(db,{key:key+':'+row.id,targetKind:'group',targetId:row.chat_id,
        payload:{chat_id:row.chat_id,text:String(text).slice(0,3500),_automation:true,_binding:row.id,...(key.startsWith('event:')?{_setting:'eventsEnabled'}:{}),...extra}});
}
async function afterLead(db,before,lead) {
    if(lead.language!=='russian') return;
    const request=workflow.request(lead), old=workflow.request(before);
    if(lead.status==='sinov-darsida' && request && request.id!==old?.id)
        await capture(db,'trial',lead.id,{requestId:request.id},'trial:'+lead.id+':'+request.id);
}
async function assignments(db,before,student) {
    if(student.subject!=='russian') return;
    for(const [duty,field] of [['main','teacherId'],['assistant','assistantTeacherId']]) {
        if(student[field] && student[field]!==before?.[field]) await capture(db,'assignment',student.id,{duty,teacherId:student[field]});
    }
}
async function attendance(db,{studentId,date,duty,teacherId,present}) {
    if(process.env.DOMWORK_BOT_ENABLED!=='true') return;
    if(!(await db.query("SELECT to_regclass('domwork_bot_attendance_marks') AS present")).rows[0]?.present) return;
    const student=(await db.query("SELECT id FROM students WHERE id=$1 AND subject='russian'",[studentId])).rows[0];
    if(!student) return;
    const prior=(await db.query('SELECT present,teacher_id FROM domwork_bot_attendance_marks WHERE student_id=$1 AND date=$2 AND duty=$3 FOR UPDATE',[studentId,date,duty])).rows[0];
    await db.query(`INSERT INTO domwork_bot_attendance_marks VALUES($1,$2,$3,$4,$5,NOW()) ON CONFLICT(student_id,date,duty)
        DO UPDATE SET teacher_id=EXCLUDED.teacher_id,present=EXCLUDED.present,updated_at=NOW()`,[studentId,date,duty,teacherId,present]);
    if(!prior || prior.present!==present || prior.teacher_id!==teacherId) await capture(db,'attendance',studentId,{date,duty,teacherId,present});
}
async function processOne(db) {
    const settings=(await store.settings(db)).data;
    const row=(await db.query("SELECT * FROM domwork_bot_events WHERE state='pending' ORDER BY created_at,event_key LIMIT 1 FOR UPDATE SKIP LOCKED")).rows[0];
    if(!row) return false;
    const key='event:'+row.event_key;
    // Disabled events are intentionally not replayed when later enabled.
    if(settings.eventsEnabled) {
        if(row.type==='trial' || row.type==='trial-result') {
            const source=(await db.query("SELECT * FROM leads WHERE id=$1 AND language='russian' AND deleted_at IS NULL",[row.reference_id])).rows[0];
            const lead=source && {...source.extra_data,id:source.id,name:source.name,status:source.status,language:source.language};
            const booking=lead && workflow.request(lead);
            if(booking?.id===row.data.requestId && lead.status==='sinov-darsida') {
                const teacher=await employee(db,booking.teacherId), manager=await employee(db,source.manager_id);
                const label={pending:'YANGI SINOV DARSI',accepted:'Ustoz darsni tasdiqladi',rejected:'Ustoz so‘rovni rad etdi',completed:booking.attended?'Dars o‘tildi':'Dars o‘tilmadi'}[booking.state];
                const name=(await db.query('SELECT name FROM hr_employees WHERE id=$1',[booking.teacherId])).rows[0]?.name || '';
                const summary=`📌 ${label}\nO‘quvchi: ${lead.name}\nVaqt: ${booking.scheduledAt}\nUstoz: ${name}${booking.reasonLabel?'\nSabab: '+booking.reasonLabel:''}`;
                const buttons=await callbacks.trialButtons(db,lead,booking);
                const guard={_trial:{leadId:lead.id,requestId:booking.id,teacherId:booking.teacherId,state:booking.state}};
                await privateMessage(db,key+':teacher',teacher,summary,{reply_markup:buttons,...guard});
                await privateMessage(db,key+':manager',manager,summary,guard);
                await groupMessage(db,key+':beacon','beacon',summary,{reply_markup:buttons,...guard});
                if(booking.state==='pending') {
                    const learner=await linked(db,'lead',lead.id);
                    const group=await groups.defaultForTeacher(db,'trial',booking.teacherId);
                    await privateMessage(db,key+':lead',learner,`${summary}${group?'\nGuruh: '+group.inviteLink:''}`,guard);
                }
                if(booking.state==='completed' && booking.attended && settings.trialRemovalEnabled) {
                    const members=(await db.query('SELECT * FROM domwork_bot_trial_members WHERE lead_id=$1 AND request_id=$2',[lead.id,booking.id])).rows;
                    for(const member of members) await store.enqueue(db,{key:key+':remove:'+member.telegram_id,targetKind:'group',targetId:member.chat_id,method:'unbanChatMember',
                        payload:{chat_id:member.chat_id,user_id:Number(member.telegram_id),only_if_banned:false,_automation:true,_remove:{leadId:lead.id,requestId:booking.id,telegramId:member.telegram_id}}});
                }
            }
        }
        if(row.type==='payment') {
            const payment=(await db.query("SELECT * FROM payment_records WHERE id=$1 AND language='russian' AND NOT legacy_review",[row.reference_id])).rows[0];
            if(payment) {
                const summary=`🔥 QABUL QILINDI!\nMenejer: ${payment.snapshot.managerName}\nO‘quvchi: ${payment.snapshot.name}\nTarif: ${payment.tariff || 'CRMda'} daqiqa\nSumma: ${money(payment.amount)}`;
                await groupMessage(db,key+':sales','sales',summary);
                await privateMessage(db,key+':manager',await employee(db,payment.manager_id),summary);
                if(payment.student_id) await privateMessage(db,key+':student',await linked(db,'student',payment.student_id),`To‘lovingiz qabul qilindi: ${money(payment.amount)}.`,{_studentId:payment.student_id});
                if(settings.milestonesEnabled && row.data.month===policy.today().slice(0,7)) for(const threshold of row.data.milestones || []) {
                    if(!require('./recognition').MILESTONES.includes(threshold))continue;
                    const month=policy.today().slice(0,7), milestoneKey=`milestone:${payment.manager_id}:${month}:${threshold}`;
                    await require('./scheduler').once(db,milestoneKey,()=>groupMessage(db,milestoneKey,'sales',
                        `🎉 ${payment.snapshot.managerName} oylik sof tushumda ${money(threshold)} pog‘onasiga chiqdi! Tabriklaymiz!`,
                        {_setting:'milestonesEnabled',_settings:['eventsEnabled'],_milestone:{managerId:payment.manager_id,month,threshold},_expiresAt:new Date(Date.now()+3600000).toISOString()}));
                }
            }
        }
        if(row.type==='assignment') {
            const student=(await db.query("SELECT id,name,teacher_id,assistant_teacher_id FROM students WHERE id=$1 AND subject='russian'",[row.reference_id])).rows[0];
            const teacherId=student && (row.data.duty==='assistant'?student.assistant_teacher_id:student.teacher_id);
            if(teacherId===row.data.teacherId) {
                const group=await groups.forStudent(db,student.id);
                const message=`Yangi o‘quvchi biriktirildi: ${student.name}${group?'\nDars guruhi: '+group.inviteLink:''}`;
                await privateMessage(db,key+':teacher',await employee(db,teacherId),message,{_assignment:{studentId:student.id,teacherId,duty:row.data.duty},
                    ...(group?{_studentGroup:{studentId:student.id,groupId:group.id}}:{})});
                await groupMessage(db,key+':teachers','teachers',`Yangi o‘quvchi ustozga biriktirildi. Muvaffaqiyatli darslar tilaymiz!`);
            }
        }
        if(row.type==='attendance' && row.data.present===false) {
            const student=(await db.query("SELECT * FROM students WHERE id=$1 AND subject='russian'",[row.reference_id])).rows[0];
            if(student && row.data.date===policy.today() && (row.data.duty==='assistant'?student.assistant_teacher_id:student.teacher_id)===row.data.teacherId)
                await privateMessage(db,key+':student',await linked(db,'student',student.id),'Siz bugungi darsga kirmadingiz. Sababini ustozingizga ma’lum qiling.',
                    {_attendance:{studentId:student.id,...row.data}});
        }
    }
    if(settings.eventsEnabled && row.type==='employee' && settings.employeeWelcomeEnabled) {
        const employee=(await db.query("SELECT name,role FROM hr_employees WHERE id=$1 AND lang='russian' AND COALESCE(status,'active')<>'inactive'",[row.reference_id])).rows[0];
        if(employee) await groupMessage(db,key+':family','family',`Jamoamizga yangi xodim qo‘shildi: ${employee.name}. Xush kelibsiz!`,
            {_setting:'employeeWelcomeEnabled',_settings:['eventsEnabled'],_employee:row.reference_id,_expiresAt:new Date(Date.now()+3600000).toISOString()});
    }
    if(settings.eventsEnabled && row.type==='release' && settings.releaseNotesEnabled && row.reference_id===require('./recognition').RELEASE.id)
        await groupMessage(db,key+':family','family',require('./recognition').RELEASE.text,
            {_setting:'releaseNotesEnabled',_settings:['eventsEnabled'],_expiresAt:new Date(Date.now()+3600000).toISOString()});
    await db.query("UPDATE domwork_bot_events SET state='done',data='{}' WHERE event_key=$1",[row.event_key]);
    return true;
}
module.exports={capture,payment,linked,employee,privateMessage,groupMessage,afterLead,assignments,attendance,processOne};
