'use strict';
const T=require('./tone');
const hhmm=d=>{const l=new Date(new Date(d).getTime()+5*3600000);return String(l.getUTCHours()).padStart(2,'0')+':'+String(l.getUTCMinutes()).padStart(2,'0');};
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
async function trialNudges(db,now) {
    const T=require('./tone'), callbacks=require('./callbacks');
    for(const row of (await db.query("SELECT * FROM leads WHERE language='russian' AND status='sinov-darsida' AND deleted_at IS NULL")).rows) {
        const lead={...row.extra_data,id:row.id,name:row.name,status:row.status,language:row.language};
        const booking=workflow.request(lead);
        const asked=Date.parse(booking?.requestedAt), lesson=Date.parse(booking?.scheduledAt);
        if(!booking || booking.state!=='pending' || !Number.isFinite(asked)) continue;
        const elapsed=now.getTime()-asked;
        // Faqat yangi so'rovlar (3 soat ichida) va dars hali boshlanmagan — eski navbat birdaniga "uyg'onmasin".
        if(elapsed<15*60000 || elapsed>3*3600000 || (Number.isFinite(lesson) && lesson<=now.getTime())) continue;
        const step=elapsed>=45*60000?45:15;
        await once(db,`trial-nudge:${booking.id}:${step}`,async()=>{
            const teacher=await events.employee(db,booking.teacherId), manager=row.manager_id?await events.employee(db,row.manager_id):null;
            const tName=(await db.query('SELECT name FROM hr_employees WHERE id=$1',[booking.teacherId])).rows[0]?.name || 'Ustoz';
            const guard={...T.HTML,_trial:{leadId:lead.id,requestId:booking.id,teacherId:booking.teacherId,state:booking.state},_expiresAt:new Date(now.getTime()+20*60000).toISOString()};
            const buttons=await callbacks.trialButtons(db,lead,booking);
            const body=`👤 ${T.b(lead.name)}\n🕒 ${T.b(T.when(booking.scheduledAt))}`;
            await events.privateMessage(db,`trial-nudge:${booking.id}:${step}:teacher`,teacher,
                `⏰ <b>${T.esc(T.first(tName))}, sinov darsi ${step} daqiqadan beri tasdiqlanmagan!</b>\n\n${body}\n\nO‘quvchi va menejer javobingizni kutyapti — iltimos, hoziroq tasdiqlang yoki rad eting 👇`,{...guard,reply_markup:buttons});
            await events.groupMessage(db,`trial-nudge:${booking.id}:${step}:beacon`,'beacon',
                `${step===45?'🚨':'⏰'} ${T.who(tName,teacher?.telegramId)}, sinov darsi ${T.b(step+' daqiqadan')} beri tasdiqlanmagan!\n\n${body}\n\n👇 Iltimos, tasdiqlang`,{...guard,reply_markup:buttons});
            if(step===45) {
                await events.privateMessage(db,`trial-nudge:${booking.id}:45:manager`,manager,
                    `⚠️ Ustoz ${T.b(tName)} sinov darsini 45 daqiqadan beri tasdiqlamadi.\n\n${body}\n\nUstoz bilan bog‘laning yoki boshqa ustoz tanlang 📞`,guard);
                for(const rop of await roles(db,['rop'])) await events.privateMessage(db,`trial-nudge:${booking.id}:45:rop:${rop.telegramId}`,rop,
                    `🚨 <b>Sinov darsi 45 daqiqadan beri tasdiqlanmagan</b>\n\n${body}\n👩‍🏫 Ustoz: ${T.who(tName,teacher?.telegramId)}\n\nNazoratga oling, iltimos.`,guard);
            }
        });
    }
}
async function run(db,now=new Date()) {
    const lock=(await db.query("SELECT pg_try_advisory_xact_lock(hashtext('domwork-bot-scheduler')) AS locked")).rows[0];
    if(!lock.locked) return;
    const settings=(await store.settings(db)).data, clock=localClock(now);
    await require('./recognition').run(db,settings,clock,now,once);
    // Jamoa kayfiyati (motivatsiya, latifa, Juma, dushanba, oy oxiri) — alohida savepoint.
    await db.query('SAVEPOINT team_vibes');
    try { await require('./vibes').run(db,settings,clock,now,once); await db.query('RELEASE SAVEPOINT team_vibes'); }
    catch(error) { await db.query('ROLLBACK TO SAVEPOINT team_vibes'); console.error('[domwork-bot] vibes failed:', error.code || error.name); }
    // Sinov darsi 15 daqiqada tasdiqlanmasa — ustozni qayta chaqirish; 45 daqiqada — ROP va menejerga ham.
    if(settings.eventsEnabled) {
        await db.query('SAVEPOINT trial_nudge');
        try { await trialNudges(db,now); await db.query('RELEASE SAVEPOINT trial_nudge'); }
        catch(error) { await db.query('ROLLBACK TO SAVEPOINT trial_nudge'); console.error('[domwork-bot] trial nudge failed:', error.code || error.name); }
    }
    // Isitish alohida savepoint ichida: xatosi eslatma va hisobotlarni orqaga qaytarmasin.
    await db.query('SAVEPOINT funnel_drip');
    try { await require('./funnel').drip(db,now); await db.query('RELEASE SAVEPOINT funnel_drip'); }
    catch(error) { await db.query('ROLLBACK TO SAVEPOINT funnel_drip'); console.error('[domwork-bot] drip failed:', error.code || error.name); }
    const expires=()=>new Date(now.getTime()+3*60000).toISOString();
    if(settings.remindersEnabled) {
        const students=(await db.query("SELECT * FROM students WHERE subject='russian'")).rows.filter(policy.activeStudent);
        for(const student of students) {
            const at=scheduledToday(student,now);
            if(!at) continue;
            const atText=at.toISOString(), identity=await events.linked(db,'student',student.id);
            const group=await groups.forStudent(db,student.id,{delivery:true});
            // Ilova va FAQ'da va'da qilingandek: dars havolasi 15 daqiqa oldin.
            for(const minute of [15]) if(checkpoint(at,minute,now)) await once(db,`class:${student.id}:${atText}:${minute}`,async()=>{
                const message=`🔔 ${T.esc(T.first(student.name))}, darsingiz ${T.b(minute+' daqiqadan')} keyin — soat ${T.b(hhmm(at))} da boshlanadi!${group?`\n\n👥 Guruh: ${T.esc(group.inviteLink)}`:''}\n\nTayyorlaning, ustozingiz kutadi ✍️`;
                const groupGuard=group?{_studentGroup:{studentId:student.id,groupId:group.id}}:{};
                await events.privateMessage(db,`reminder:${student.id}:${atText}:${minute}`,identity,message,{...T.HTML,_setting:'remindersEnabled',_expiresAt:expires(),_schedule:{studentId:student.id,at:atText},...groupGuard});
                await learningMessage(db,`group-class:${group?.id}:${atText}:${minute}`,group,`🔔 Dars ${T.b(minute+' daqiqadan')} keyin — soat ${T.b(hhmm(at))} da boshlanadi!\nHammani kutamiz 📚`,{...T.HTML,_setting:'remindersEnabled',_expiresAt:expires(),_schedule:{studentId:student.id,at:atText,teacherId:student.teacher_id},...groupGuard});
            });
            const end=new Date(at.getTime()+(Number(student.lesson_duration)||15)*60000);
            if(checkpoint(end,-15,now)) await once(db,`missing-attendance:${student.id}:${atText}`,async()=>{
                const mark=(await db.query(`SELECT present FROM main_attendance WHERE att_key=$1 AND student_id=$2 AND day=$3`,
                    [clock.date.slice(0,7)+'_'+student.teacher_id,student.id,Number(clock.date.slice(8))])).rows[0];
                const explicit=(await db.query("SELECT present FROM domwork_bot_attendance_marks WHERE student_id=$1 AND date=$2 AND duty='main'",[student.id,clock.date])).rows[0];
                if(mark || explicit?.present!=null) return;
                const teacher=await events.employee(db,student.teacher_id);
                const tName=(await db.query('SELECT name FROM hr_employees WHERE id=$1',[student.teacher_id])).rows[0]?.name || '';
                await events.privateMessage(db,`attendance-reminder:${student.id}:${atText}`,teacher,
                    `⏰ ${T.esc(T.first(tName) || 'Ustoz')}, ${T.b(student.name)}ning soat ${T.b(hhmm(at))} dagi darsi bo‘yicha davomat hali belgilanmagan.\n\nBelgilanmagan dars maoshga o‘tmaydi — 1 daqiqa ajrating 🙏`,{...T.HTML,_setting:'remindersEnabled',_expiresAt:expires(),_assignment:{studentId:student.id,teacherId:student.teacher_id,duty:'main'},_schedule:{studentId:student.id,at:atText},_missingAttendance:{studentId:student.id,teacherId:student.teacher_id,duty:'main',date:clock.date}});
                await events.groupMessage(db,`attendance-team:${student.id}:${atText}`,'teachers',`⏰ ${T.who(tName,teacher?.telegramId)}, ${T.b(student.name)}ning ${T.b(hhmm(at))} dagi darsi bo‘yicha davomat hali belgilanmagan.\nBelgilanmagan dars maoshga o‘tmaydi — 1 daqiqa ajrating 🙏`,{...T.HTML,_expiresAt:expires()});
            });
            if(student.assistant_teacher_id && clock.hour===21 && clock.minute<2) await once(db,`assistant-attendance:${student.id}:${clock.date}`,async()=>{
                const guard={studentId:student.id,teacherId:student.assistant_teacher_id,duty:'assistant',date:clock.date};
                const mark=(await db.query('SELECT present FROM assistant_attendance WHERE att_key=$1 AND student_id=$2 AND day=$3',
                    [clock.date.slice(0,7)+'_'+guard.teacherId,student.id,Number(clock.date.slice(8))])).rows[0];
                if(mark) return;
                await events.privateMessage(db,`assistant-attendance:${student.id}:${clock.date}`,await events.employee(db,guard.teacherId),
                    `📋 Bugun ${T.b(student.name)} bilan aloqa hali belgilanmagan.\n\nKun tugashidan oldin belgilang — aks holda hisoblanmaydi 🙏`,
                    {...T.HTML,_setting:'remindersEnabled',_expiresAt:expires(),_assignment:guard,_missingAttendance:guard});
            });
        }
        for(const row of (await db.query("SELECT * FROM leads WHERE language='russian' AND status='sinov-darsida' AND deleted_at IS NULL")).rows) {
            const lead={...row.extra_data,id:row.id,name:row.name,status:row.status};
            const booking=workflow.request(lead);
            if(!booking || !['pending','accepted'].includes(booking.state)) continue;
            for(const minute of [60,15]) if(checkpoint(booking.scheduledAt,minute,now)) await once(db,`trial-reminder:${lead.id}:${booking.id}:${minute}`,async()=>{
                const group=await groups.defaultForTeacher(db,'trial',booking.teacherId,{delivery:true});
                const message=`🔔 Sinov darsi ${T.b(minute===60?'1 soatdan':minute+' daqiqadan')} keyin — ${T.b(T.when(booking.scheduledAt))}${group?`\n\n👥 Guruh: ${T.esc(group.inviteLink)}`:''}\n\n${minute===60?'Qulay joy va naushnik tayyorlab qo‘ying 🎧':'Guruhga kiring, ustoz sizni kutmoqda! 👋'}`;
                const guard={...T.HTML,_setting:'remindersEnabled',_expiresAt:expires(),_trial:{leadId:lead.id,requestId:booking.id,teacherId:booking.teacherId,state:booking.state}};
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
    // Targetolog kechagi reklama ma'lumotini (sarf, lidlar) CRMga kiritmagan bo'lsa: 10:00 — o'ziga, 15:00 — Marketing guruhiga ham.
    if(settings.remindersEnabled && (reached('10:00') || reached('15:00'))) {
        const yday=require('./reports').shift(clock.date,-1), step=reached('10:00')?1:2;
        await once(db,`ads-missing:${yday}:${step}`,async()=>{
            if(!(await db.query("SELECT to_regclass('target_ad_entries') AS t")).rows[0]?.t) return;
            if((await db.query("SELECT 1 FROM target_ad_entries WHERE language='russian' AND kind='day' AND date=$1",[yday])).rows.length) return;
            const opts={...T.HTML,_setting:'remindersEnabled',_expiresAt:new Date(now.getTime()+3600000).toISOString()};
            const people=await roles(db,['marketing']);
            for(const p of people) await events.privateMessage(db,`ads-missing:${yday}:${step}:${p.telegramId}`,p,
                `📝 ${T.esc(T.first(p.name))}, ${T.b(T.dateOnly(yday))} uchun reklama ma’lumoti CRMga hali kiritilmagan.\n\n💵 Sarf va kabinetdagi lidlar sonini kiriting: CRM → Marketing → Target lidlar.\nBusiz kunlik hisobotda 1 lid narxi va CPL hisoblanmaydi 🙏`,opts);
            if(step===2) await events.groupMessage(db,`ads-missing:${yday}:2:group`,'marketing',
                `⚠️ ${T.b(T.dateOnly(yday))} uchun reklama sarfi hali kiritilmagan${people.length?': '+people.map(p=>T.who(p.name,p.telegramId)).join(', '):''}.\nIltimos, bugun kiritib qo‘ying — oy hisobotidagi narxlar shunga bog‘liq 📊`,opts);
        });
    }
    // 29-okt: kun yakuni hisobotlari 23:00 da (kechki sotuv soatlari ham kirsin), ROP taqqoslamasi 23:05 da.
    if(settings.reportsEnabled && (reached('23:00') || reached('23:05'))) {
        const type=reached('23:00')?'daily':'comparison';
        await once(db,'report:'+clock.date+':'+type,async()=>{
            const opts={...T.HTML,_setting:'reportsEnabled',_expiresAt:new Date(now.getTime()+3600000).toISOString()};
            if(type==='comparison') {
                for(const identity of await roles(db,['rop'])) {
                    const value=await staff.action(db,identity,'reports',{now,daily:true,comparison:true});
                    await events.privateMessage(db,'report:'+clock.date+':comparison:'+identity.telegramId,identity,`🔁 <b>24 soatlik taqqoslama</b> · ${T.dateOnly(clock.date)}\n\n${T.esc(value)}`,opts);
                }
                return;
            }
            const D=require('./dailyReports');
            const sales=await D.salesDay(db,clock.date), market=await D.marketingDay(db,clock.date);
            const text={admin:await D.adminText(db,clock.date),rop:D.salesText(sales),marketing:D.marketingText(market)};
            for(const identity of await roles(db,['admin','rop','marketing']))
                await events.privateMessage(db,'report:'+clock.date+':daily:'+identity.telegramId,identity,text[identity.role],opts);
            await events.groupMessage(db,'department-report:'+clock.date+':daily:sales','sales',D.salesText(sales,{group:true}),opts);
            await events.groupMessage(db,'department-report:'+clock.date+':daily:marketing','marketing',text.marketing,opts);
        });
    }
    if(settings.groupNotificationsEnabled && reached(settings.familyTime || '10:00')) {
        if(settings.familyText) await once(db,'family-content:'+clock.date,()=>events.groupMessage(db,'family-content:'+clock.date,'family',settings.familyText));
        if(clock.day===7 && settings.methodicalText) await once(db,'methodical:'+clock.date,()=>events.groupMessage(db,'methodical:'+clock.date,'teachers',settings.methodicalText));
        if(clock.day===7) await once(db,'video-day:'+clock.date,async()=>{
            const rows=(await db.query("SELECT * FROM domwork_learning_groups WHERE type='classroom' AND NOT archived AND verified_at IS NOT NULL")).rows;
            for(const row of rows) await learningMessage(db,'video-day:'+clock.date+':'+row.id,groups.dto(row),'☀️ Xayrli yakshanba!\n\nBugun dam olish kuni — 15 daqiqa ajratib, platformadagi video darsni ko‘rib qo‘ying va yordamchi ustozingiz bilan vazifani bajaring 📚\n\n👉 https://myhomework.uz/student/\n\nKichik qadamlar katta natija beradi! 💪');
        });
    }
}
module.exports={localClock,scheduledToday,checkpoint,once,run};
