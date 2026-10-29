'use strict';
const {randomUUID}=require('node:crypto');
const store=require('./store');
const policy=require('./policy');
const groups=require('../domworkGroups');
const workflow=require('../../../js/trialWorkflow');
const callbacks=require('./callbacks');
const T=require('./tone');
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
// Sotuv statistikasi: bu to'lov o'quvchining birinchi to'lovimi (= yangi sotuv), menejerning oy natijasi va shaxsiy rejasi.
async function saleStats(db,payment) {
    // Sotuv = liddan kelgan birinchi tushum (lead:<id>:deposit yoki :closing). O'quvchining keyingi qarz to'lovlari — "to'lov tushdi".
    const leadKey=/^lead:(.+):(deposit|closing)$/.exec(payment.source_key || '');
    const prior=leadKey?(await db.query(`SELECT 1 FROM payment_records q WHERE q.id<>$1 AND q.source_key LIKE $2 AND NOT q.legacy_review
        AND (q.created_at<$3 OR (q.created_at=$3 AND q.id<$1)) LIMIT 1`,[payment.id,'lead:'+leadKey[1]+':%',payment.created_at])).rows.length:1;
    const month=policy.today().slice(0,7);
    const m=(await db.query(`SELECT COALESCE(SUM(amount),0) AS total,
        COUNT(DISTINCT lead_id) FILTER (WHERE source_key LIKE 'lead:%' AND NOT EXISTS(SELECT 1 FROM payment_records q WHERE q.lead_id=p.lead_id
            AND q.source_key LIKE 'lead:%' AND NOT q.legacy_review AND q.paid_date<$2::date)) AS sales
        FROM payment_records p WHERE language='russian' AND NOT legacy_review AND manager_id=$1 AND paid_date>=$2::date`,[payment.manager_id,month+'-01'])).rows[0];
    const plans=(await db.query("SELECT data FROM json_data WHERE key='individualSalesPlans'")).rows[0]?.data;
    const plan=Number(require('./staff').personalPlan(plans,payment.manager_id,month)?.totalAmount)||0;
    const managerName=(await db.query('SELECT name FROM hr_employees WHERE id=$1',[payment.manager_id])).rows[0]?.name || '';
    return {isSale:!prior,sales:Math.max(1,Number(m.sales)||0),monthSum:Number(m.total)||0,plan,managerName};
}
async function privateMessage(db,key,identity,text,extra={}) {
    if(!identity || identity.paused) return;
    ({text,extra}=T.fit(text,extra));
    await store.enqueue(db,{key,targetId:identity.telegramId,role:identity.role,account:identity,
        payload:{chat_id:identity.telegramId,text,_automation:true,...(key.startsWith('event:')?{_setting:'eventsEnabled'}:{}),...extra}});
}
async function groupMessage(db,key,type,text,extra={}) {
    const settings=(await store.settings(db)).data;
    if(!settings.groupNotificationsEnabled) return;
    const row=(await db.query("SELECT * FROM domwork_bot_groups WHERE type=$1 AND scope='' AND active",[type])).rows[0];
    if(!row) return;
    ({text,extra}=T.fit(text,extra));
    await store.enqueue(db,{key:key+':'+row.id,targetKind:'group',targetId:row.chat_id,
        payload:{chat_id:row.chat_id,text,_automation:true,_binding:row.id,...(key.startsWith('event:')?{_setting:'eventsEnabled'}:{}),...extra}});
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
                const name=(await db.query('SELECT name FROM hr_employees WHERE id=$1',[booking.teacherId])).rows[0]?.name || '';
                const managerName=source.manager_id?(await db.query('SELECT name FROM hr_employees WHERE id=$1',[source.manager_id])).rows[0]?.name || '':'';
                const head={pending:'🧪 <b>Yangi sinov darsi</b>',accepted:'✅ <b>Ustoz sinov darsini tasdiqladi</b>',rejected:'❌ <b>Ustoz sinov so‘rovini rad etdi</b>',
                    completed:booking.attended?'🎉 <b>Sinov darsi o‘tdi!</b>':'😕 <b>Sinov darsi o‘tmadi</b>'}[booking.state] || '📌 <b>Sinov darsi</b>';
                const tail={pending:'👇 Ustoz, iltimos, tasdiqlang',accepted:'📲 Menejer, o‘quvchiga vaqtni tasdiqlab qo‘ying — darsdan oldin bot ham eslatadi',rejected:'💼 Menejer, boshqa vaqt yoki ustoz tanlang',
                    completed:booking.attended?'📞 Menejer, endi qo‘ng‘iroq vaqti — taassurot issiqligida gaplashing!':'📞 Menejer, sababini bilib, yangi vaqt taklif qiling'}[booking.state];
                const summary=`${head}\n\n👤 O‘quvchi: ${T.b(lead.name)}\n🕒 ${T.b(T.when(booking.scheduledAt))}\n👩‍🏫 Ustoz: ${T.who(name,teacher?.telegramId)}`
                    +(managerName?`\n💼 Menejer: ${T.who(managerName,manager?.telegramId)}`:'')
                    +(booking.reasonLabel?`\n📝 Sabab: ${T.esc(booking.reasonLabel)}`:'')+(tail?`\n\n${tail}`:'');
                const buttons=await callbacks.trialButtons(db,lead,booking);
                const guard={_trial:{leadId:lead.id,requestId:booking.id,teacherId:booking.teacherId,state:booking.state},...T.HTML};
                await privateMessage(db,key+':teacher',teacher,summary,{reply_markup:buttons,...guard});
                await privateMessage(db,key+':manager',manager,summary,guard);
                await groupMessage(db,key+':beacon','beacon',summary,{reply_markup:buttons,...guard});
                if(booking.state==='pending') {
                    const learner=await linked(db,'lead',lead.id);
                    const group=await groups.defaultForTeacher(db,'trial',booking.teacherId);
                    await privateMessage(db,key+':lead',learner,`Assalomu alaykum, ${T.esc(T.first(lead.name))}! 🎉\n\nSinov darsingiz belgilandi:\n🕒 ${T.b(T.when(booking.scheduledAt))}\n👩‍🏫 Ustoz: ${T.b(name)}`
                        +(group?`\n\n👥 Dars shu guruhda bo‘ladi — oldindan qo‘shilib oling:\n${T.esc(group.inviteLink)}`:'')+'\n\nDarsdan oldin eslatib turamiz 🔔',guard);
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
                const mgr=await employee(db,payment.manager_id), stats=await saleStats(db,payment);
                const mgrName=payment.snapshot?.managerName || stats.managerName || 'Menejer';
                const month=`📈 Bu oy: ${T.b(stats.sales+'-sotuv')} · ${T.esc(T.sum(stats.monthSum))}${stats.plan>0?` · reja ${T.b(Math.floor(stats.monthSum/stats.plan*100)+'%')}`:''}`;
                const tariff=payment.tariff?` · 📦 ${T.esc(payment.tariff)} daqiqalik tarif`:'';
                const group=stats.isSale
                    ?`🎉🔥 <b>YANGI SOTUV!</b>\n\n👏 ${T.who(mgrName,mgr?.telegramId)} — tabriklaymiz!\n👤 O‘quvchi: ${T.b(payment.snapshot?.name)}\n💳 Summa: ${T.b(T.sum(payment.amount))}${tariff}\n${month}\n\n${T.i(T.pick(T.CHEERS.sale,payment.id))}`
                    :`💳 <b>To‘lov tushdi</b>\n\n💼 ${T.who(mgrName,mgr?.telegramId)}\n👤 O‘quvchi: ${T.b(payment.snapshot?.name)}\n💰 Summa: ${T.b(T.sum(payment.amount))}${Number(payment.debt_snapshot)>0?`\n⏳ Qolgan qarz: ${T.esc(T.sum(payment.debt_snapshot))}`:''}\n\n${T.i(T.pick(T.CHEERS.pay,payment.id))}`;
                const personal=stats.isSale
                    ?`🎉 Tabriklaymiz, ${T.esc(T.first(mgrName))}!\n\nYangi sotuv: ${T.b(payment.snapshot?.name)} — ${T.b(T.sum(payment.amount))}\n${month}${stats.plan>0&&stats.plan>stats.monthSum?`\n🎯 Rejagacha: ${T.b(T.sum(stats.plan-stats.monthSum))}`:''}\n\n${T.i(T.pick(T.CHEERS.sale,payment.id+':p'))}`
                    :`💳 To‘lov qabul qilindi: ${T.b(payment.snapshot?.name)} — ${T.b(T.sum(payment.amount))}${Number(payment.debt_snapshot)>0?`\n⏳ Qolgan qarz: ${T.esc(T.sum(payment.debt_snapshot))}`:'\n✅ Qarz to‘liq yopildi!'}`;
                await groupMessage(db,key+':sales','sales',group,T.HTML);
                await privateMessage(db,key+':manager',mgr,personal,T.HTML);
                if(payment.student_id) await privateMessage(db,key+':student',await linked(db,'student',payment.student_id),
                    `✅ To‘lovingiz qabul qilindi: ${T.b(T.sum(payment.amount))}\n\nRahmat, bizga ishonganingiz uchun! 🤝\nSavollar bo‘lsa — shu yerda yozing yoki menejeringizga murojaat qiling.`,{_studentId:payment.student_id,...T.HTML});
                if(settings.milestonesEnabled && row.data.month===policy.today().slice(0,7)) for(const threshold of row.data.milestones || []) {
                    if(!require('./recognition').MILESTONES.includes(threshold))continue;
                    const month=policy.today().slice(0,7), milestoneKey=`milestone:${payment.manager_id}:${month}:${threshold}`;
                    await require('./scheduler').once(db,milestoneKey,()=>groupMessage(db,milestoneKey,'sales',
                        `🚀 <b>YANGI POG‘ONA!</b>\n\n${T.who(mgrName,mgr?.telegramId)} bu oy sof tushumda ${T.b(T.sum(threshold))}dan oshdi! 🏅\n\nButun jamoa nomidan tabriklaymiz 👏👏👏`,
                        {...T.HTML,_setting:'milestonesEnabled',_settings:['eventsEnabled'],_milestone:{managerId:payment.manager_id,month,threshold},_expiresAt:new Date(Date.now()+3600000).toISOString()}));
                }
            }
        }
        if(row.type==='assignment') {
            const student=(await db.query("SELECT id,name,teacher_id,assistant_teacher_id,group_name,lesson_time FROM students WHERE id=$1 AND subject='russian'",[row.reference_id])).rows[0];
            const teacherId=student && (row.data.duty==='assistant'?student.assistant_teacher_id:student.teacher_id);
            if(teacherId===row.data.teacherId) {
                const group=await groups.forStudent(db,student.id);
                const teacher=await employee(db,teacherId), assistant=row.data.duty==='assistant';
                const tName=(await db.query('SELECT name FROM hr_employees WHERE id=$1',[teacherId])).rows[0]?.name || '';
                const details=[student.group_name?`📚 ${T.esc(student.group_name)}`:'',student.lesson_time?`🕒 ${T.esc(student.lesson_time)}`:''].filter(Boolean).join(' · ');
                const message=`🎓 <b>Sizga yangi o‘quvchi${assistant?' (yordamchi ustoz sifatida)':''}</b>\n\n👤 ${T.b(student.name)}${details?'\n'+details:''}`
                    +(group?`\n👥 Dars guruhi: ${T.esc(group.inviteLink)}`:'')+`\n\n${T.i(T.pick(T.CHEERS.teacher,row.event_key))}`;
                await privateMessage(db,key+':teacher',teacher,message,{_assignment:{studentId:student.id,teacherId,duty:row.data.duty},
                    ...(group?{_studentGroup:{studentId:student.id,groupId:group.id}}:{}),...T.HTML});
                await groupMessage(db,key+':teachers','teachers',`🎓 ${T.who(tName,teacher?.telegramId)}ga yangi o‘quvchi${assistant?' (yordamchi ustoz)':''}: ${T.b(student.name)}${details?'\n'+details:''}\n\n${T.i(T.pick(T.CHEERS.teacher,row.event_key+':g'))}`,T.HTML);
            }
        }
        if(row.type==='attendance' && row.data.present===false) {
            const student=(await db.query("SELECT * FROM students WHERE id=$1 AND subject='russian'",[row.reference_id])).rows[0];
            if(student && row.data.date===policy.today() && (row.data.duty==='assistant'?student.assistant_teacher_id:student.teacher_id)===row.data.teacherId)
                await privateMessage(db,key+':student',await linked(db,'student',student.id),'Bugungi darsda sizni ko‘rmadik 😔\n\nHammasi joyidami? Sababini ustozingizga yozib qo‘ying — darsni qanday to‘ldirishni birga hal qilamiz 🤝',
                    {_attendance:{studentId:student.id,...row.data}});
        }
    }
    if(settings.eventsEnabled && row.type==='employee' && settings.employeeWelcomeEnabled) {
        const employee=(await db.query("SELECT name,role,lang FROM hr_employees WHERE id=$1 AND (role='rus-oqituvchi' OR (role<>'ingliz-oqituvchi' AND lang='russian')) AND COALESCE(status,'active')<>'inactive'",[row.reference_id])).rows[0];
        const roleLabel={'rus-oqituvchi':'ustoz','yordamchi':'yordamchi ustoz','sotuv-menejeri':'sotuv menejeri','sotuv_menejeri':'sotuv menejeri','sotuv menejeri':'sotuv menejeri','sales_manager':'sotuv menejeri'}[employee?.role];
        if(employee) await groupMessage(db,key+':family','family',`👋 <b>Jamoamizga yangi a’zo!</b>\n\n${T.b(employee.name)}${roleLabel?` — ${roleLabel}`:''} bugundan biz bilan. Xush kelibsiz! 🎉\n\nKeling, birga zo‘r natijalarga erishamiz 🤝`,
            {...T.HTML,_setting:'employeeWelcomeEnabled',_settings:['eventsEnabled'],_employee:row.reference_id,_expiresAt:new Date(Date.now()+3600000).toISOString()});
    }
    if(settings.eventsEnabled && row.type==='release' && settings.releaseNotesEnabled && row.reference_id===require('./recognition').RELEASE.id)
        await groupMessage(db,key+':family','family',require('./recognition').RELEASE.text,
            {_setting:'releaseNotesEnabled',_settings:['eventsEnabled'],_expiresAt:new Date(Date.now()+3600000).toISOString()});
    await db.query("UPDATE domwork_bot_events SET state='done',data='{}' WHERE event_key=$1",[row.event_key]);
    return true;
}
module.exports={capture,payment,linked,employee,privateMessage,groupMessage,afterLead,assignments,attendance,processOne};
