'use strict';
const store=require('./store');
const policy=require('./policy');
const controls=require('./controls');
const workflow=require('../../../js/trialWorkflow');
async function trialButtons(db,lead,booking) {
    const buttons=[];
    const add=async(label,action)=>({text:label,callback_data:await store.callback(db,{type:'trial',leadId:lead.id,requestId:booking.id,teacherId:booking.teacherId,...action})});
    if(booking.state==='pending') buttons.push([await add('✅ Qabul qildim',{action:'accept'}),await add('❌ Rad etish',{action:'reject-options'})]);
    if(booking.state==='accepted') buttons.push([await add('✅ Dars o‘tildi',{action:'outcome',attended:true}),await add('❌ Dars o‘tilmadi',{action:'outcome-options'})]);
    return {inline_keyboard:buttons};
}
async function leaveButtons(db,id) {
    const row=[];
    for(const state of ['approved','rejected']) row.push({text:state==='approved'?'✅ Tasdiqlash':'❌ Rad etish',
        callback_data:await store.callback(db,{type:'leave',id,state})});
    return {inline_keyboard:[row]};
}
async function answer(db,update,value) {
    await store.enqueue(db,{key:`u:${update.update_id}:callback`,targetId:String(update.callback_query.from.id),method:'answerCallbackQuery',
        payload:{callback_query_id:update.callback_query.id,text:String(value).slice(0,180),show_alert:true}});
}
async function handle(db,update,crm) {
    const query=update.callback_query;
    const sender=policy.telegramId(query?.from?.id);
    const match=/^dw:([a-f0-9-]{36})$/.exec(query?.data || '');
    if(!sender || !match) return;
    const identity=await store.identity(db,sender);
    const token=(await db.query('SELECT data FROM domwork_bot_callbacks WHERE id=$1 AND expires_at>NOW() FOR UPDATE',[match[1]])).rows[0];
    try {
        if(!identity || !token) throw policy.error(403,'Akkaunt yoki tugma eskirgan. /start bosing');
        const data=token.data, chat=query.message?.chat;
        const privateChat=chat?.type==='private' && String(chat.id)===sender;
        if(data.type!=='trial' && !privateChat) throw policy.error(403,'Bu amal faqat shaxsiy kabinetda');
        if(data.type==='leave') {
            await controls.reviewLeave(db,{id:identity.id},data.id,data.state);
        } else if(data.type==='broadcast') {
            await controls.confirmBroadcast(db,{id:identity.id},data.id,data.fingerprint,data.cancel===true);
        } else if(data.type==='trial') {
            if(identity.role!=='teacher' || identity.employeeId!==data.teacherId) throw policy.error(403,'Tugma faqat biriktirilgan ustoz uchun');
            if(!privateChat) {
                const binding=(await db.query("SELECT id FROM domwork_bot_groups WHERE type='beacon' AND active AND chat_id=$1",[String(chat?.id || '')])).rows;
                if(binding.length!==1) throw policy.error(403,'Bu guruh Mayoqqa bog‘lanmagan');
            }
            const row=(await db.query("SELECT * FROM leads WHERE id=$1 AND language='russian' AND status='sinov-darsida' AND deleted_at IS NULL FOR UPDATE",[data.leadId])).rows[0];
            const lead=row && {...row.extra_data,id:row.id,name:row.name,status:row.status,language:row.language};
            const booking=workflow.request(lead);
            if(!booking || booking.id!==data.requestId || booking.teacherId!==identity.employeeId) throw policy.error(409,'Sinov darsi qayta belgilangan');
            if(['reject-options','outcome-options'].includes(data.action)) {
                const expected=data.action==='reject-options'?'pending':'accepted';
                if(booking.state!==expected) throw policy.error(409,'Dars holati o‘zgargan');
                const buttons=[];
                for(const reason of workflow.REASONS) buttons.push([{text:reason.label,callback_data:await store.callback(db,{...data,
                    action:data.action==='reject-options'?'reject':'outcome',attended:false,reasonId:reason.id})}]);
                await store.enqueue(db,{key:`u:${update.update_id}:reasons`,targetId:sender,role:identity.role,account:identity,
                    payload:{chat_id:sender,text:'Sababni tanlang:',reply_markup:{inline_keyboard:buttons}}});
                return await answer(db,update,'Sabablar shaxsiy chatga yuborildi');
            }
            if(!crm.botTrialAction) throw policy.error(503,'Sinov darsi ulanishi tayyor emas');
            await crm.botTrialAction(db,{id:identity.id,role:'teacher'},data.leadId,
                {requestId:data.requestId,action:data.action,attended:data.attended,reasonId:data.reasonId});
        } else throw policy.error(400,'Tugma turi noto‘g‘ri');
        await answer(db,update,'Saqlandi.');
    } catch(error) {
        if(!error.status || error.status>=500) throw error;
        await answer(db,update,error.message);
    }
}
module.exports={trialButtons,leaveButtons,handle};
