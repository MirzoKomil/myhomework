'use strict';
const bcrypt = require('bcryptjs');
const policy = require('./policy');
const store = require('./store');
const groups = require('../domworkGroups');
const trial = require('../../../js/trialWorkflow');
const callbacks = require('./callbacks');
const controls = require('./controls');
const discovery = require('./discovery');
const funnel = require('./funnel');
const money = value => new Intl.NumberFormat('uz-UZ').format(Number(value) || 0).replace(/[\u00a0\u202f]/g, ' ') + ' UZS';
const text = value => String(value ?? '').slice(0, 200);
const empty = 'Hozircha ma’lumot yo‘q.';
function keyboard(identity) {
    const buttons = policy.menu(identity).map(([, label]) => ({ text: label }));
    const rows = []; for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
    return { keyboard: rows, resize_keyboard: true };
}
function chunks(value, max = 3500) {
    const parts = []; let pending = String(value || empty);
    while (pending.length > max) {
        let at = pending.lastIndexOf('\n', max); if (at < 1) at = max;
        parts.push(pending.slice(0, at)); pending = pending.slice(at).replace(/^\n/, '');
    }
    parts.push(pending); return parts;
}
// Xabar tarqatish auditoriyasi — tugmalar (oldin inglizcha so'z yozilardi).
const SEGMENT_LABELS = { all: '👥 Hammaga', student: '🎓 O‘quvchilar', trial: '🧪 Sinovdagilar', sales: '💼 Sotuv menejerlari', teacher: '👩‍🏫 Ustozlar',
    assistant: '🤝 Yordamchi ustozlar', rop: '📊 ROP', marketing: '📈 Marketing', admin: '🛡 Adminlar' };
function segmentKeyboard() {
    const labels = Object.values(SEGMENT_LABELS), rows = [];
    for (let i = 0; i < labels.length; i += 2) rows.push(labels.slice(i, i + 2).map(text => ({ text })));
    return { keyboard: rows, resize_keyboard: true, one_time_keyboard: true };
}
function actionFor(identity, value) { return policy.menu(identity).find(([, label]) => label === value)?.[0]; }
function createHandler({ crm }) {
    if (!crm) throw Error('CRM adapter required');
    return async function handle(db, update) {
        if (update.callback_query) {
            if (/^f:/.test(String(update.callback_query.data || ''))) return require('./funnel').callback(db,update);
            if (/^m:/.test(String(update.callback_query.data || ''))) return require('./funnel').managerAction(db,update);
            return callbacks.handle(db,update,crm);
        }
        if(update.chat_member) {
            const change=update.chat_member, user=change.new_chat_member?.user;
            const joined=['member','administrator','creator'].includes(change.new_chat_member?.status)
                && !['member','administrator','creator'].includes(change.old_chat_member?.status);
            if(user?.is_bot) return;
            const identity=await store.identity(db,String(user?.id || ''));
            if(identity?.kind==='student') {await discovery.requestStudent(db,identity.id);return;}
            if(!joined) return;
            if(identity?.kind!=='lead') return;
            const row=(await db.query("SELECT * FROM leads WHERE id=$1 AND language='russian' AND status='sinov-darsida' AND deleted_at IS NULL",[identity.id])).rows[0];
            const lead=row && {...row.extra_data,id:row.id,name:row.name,status:row.status};
            const booking=lead && trial.request(lead);
            const group=booking && await groups.defaultForTeacher(db,'trial',booking.teacherId,{delivery:true});
            if(!group || group.chatId!==String(change.chat?.id) || booking.state==='completed') return;
            await db.query(`INSERT INTO domwork_bot_trial_members(chat_id,telegram_id,lead_id,request_id) VALUES($1,$2,$3,$4)
                ON CONFLICT(chat_id,telegram_id) DO UPDATE SET lead_id=EXCLUDED.lead_id,request_id=EXCLUDED.request_id,joined_at=NOW()`,[group.chatId,identity.telegramId,identity.id,booking.id]);
            if((await store.settings(db)).data.groupNotificationsEnabled) await store.enqueue(db,{key:`u:${update.update_id}:welcome`,targetKind:'group',targetId:group.chatId,
                payload:{chat_id:group.chatId,text:`Assalomu alaykum, ${text(identity.name)}! Domwork sinov darsiga xush kelibsiz!`,_automation:true,_binding:group.id}});
            return;
        }
        if (update.my_chat_member) {
            const change = update.my_chat_member;
            if (!['group','supergroup'].includes(change.chat?.type)) return;
            await db.query(`INSERT INTO domwork_bot_seen_chats(chat_id,title,bot_status) VALUES($1,$2,$3)
                ON CONFLICT(chat_id) DO UPDATE SET title=EXCLUDED.title,bot_status=EXCLUDED.bot_status,observed_at=NOW()`,
                [String(change.chat.id), text(change.chat.title), change.new_chat_member?.status || 'unknown']);
            await discovery.observe(db,String(change.chat.id),text(change.chat.title));
            // Membership observation never binds a CRM department or teacher by title.
            if (change.new_chat_member?.status !== 'administrator') {
                await db.query('UPDATE domwork_learning_groups SET verified_at=NULL WHERE chat_id=$1', [String(change.chat.id)]);
                await db.query('UPDATE domwork_bot_groups SET active=false WHERE chat_id=$1', [String(change.chat.id)]);
            }
            return;
        }
        const message = update.message;
        // Ustoz dars nazorati: guruhdagi video chat boshlandi/tugadi xizmat xabarlari (javob yuborilmaydi).
        if (message && ['group','supergroup'].includes(message.chat?.type)
            && (message.video_chat_started || message.video_chat_ended || message.voice_chat_started || message.voice_chat_ended)) {
            await require('../staffAttendance/lessons').recordVideoChat(db, message);
            return;
        }
        // Sotuv guruhida menejer bot xabariga reply qildi → javob lidga (voronka yoqilgan bo'lsa).
        if (message && ['group','supergroup'].includes(message.chat?.type) && message.reply_to_message && await funnel.enabled(db)
            && await funnel.relayFromGroup(db, update)) return;
        const callback = update.callback_query;
        const sender = policy.telegramId(message?.from?.id || callback?.from?.id);
        if (!sender) return;
        // Group callbacks are handled separately: no private data in group replies.
        if (!message || message.chat?.type !== 'private' || String(message.chat.id) !== sender) {
            if (callback) await store.enqueue(db, { key: `u:${update.update_id}:callback`, targetId: sender,
                method: 'answerCallbackQuery', payload: { callback_query_id: callback.id, text: 'Hozir CRM kabinetidan foydalaning.', show_alert: true } });
            return;
        }
        let identity = await store.identity(db, sender), replyNo = 0;
        async function reply(value, extra = {}) {
            for (const part of chunks(value)) await store.enqueue(db, { key: `u:${update.update_id}:r:${replyNo++}`,
                targetId: sender, role: identity?.role || '', account: identity,
                payload: { chat_id: sender, text: part, ...(identity ? { reply_markup: keyboard(identity) } : {}), ...extra } });
        }
        try {
            if(message._studentLinkHash || require('./studentLink').startHash(message.text)){
                await require('./studentLink').claim(db,message);
                await store.enqueue(db,{key:`u:${update.update_id}:student-link`,targetId:sender,
                    payload:{chat_id:sender,text:'Endi student appdagi “Telegram botga ulash” oynasiga qayting. “Holatni tekshirish”ni bosib, o‘z Telegram hisobingizni tasdiqlang.'}});
                return;
            }
            if(message._staffLinkHash || require('./staffLink').startHash(message.text)){
                await require('./staffLink').claim(db,message);
                await store.enqueue(db,{key:`u:${update.update_id}:staff-link`,targetId:sender,
                    payload:{chat_id:sender,text:'Endi CRMga qayting: “Telegram botni ulash” oynasida ismingiz chiqadi — “Ha, bu mening Telegramim” tugmasini bosing.'}});
                return;
            }
            if(message._leadLinkHash || require('./leadLink').startHash(message.text)){
                // Landing "Rahmat" sahifasidan: lid telefon raqamisiz taniladi.
                const claimed=await require('./leadLink').claim(db,message);
                if(!identity && await funnel.enabled(db)) return await funnel.start(db,update,message,{lead:claimed && !claimed.skipped ? claimed.lead : null});
                if(identity) return await reply(`Assalomu alaykum, ${text(identity.name)}! Kerakli bo‘limni tanlang.`);
            }
            if (message.contact) {
                if(!identity && await funnel.enabled(db)) {
                    // CRMda o'quvchi/xodim/sinov topilmasa — mehmon lid sifatida voronkada davom etadi.
                    try { identity = await store.linkContact(db, message); }
                    catch(error) { if(error.status===404) return await funnel.contact(db,update,message); throw error; }
                    await discovery.contactLinked(db,identity);
                    return await reply(`Assalomu alaykum, ${text(identity.name)}!\nDomwork shaxsiy kabinetingiz ochildi.`);
                }
                identity = await store.linkContact(db, message);
                await discovery.contactLinked(db,identity);
                return await reply(`Assalomu alaykum, ${text(identity.name)}!\nDomwork shaxsiy kabinetingiz ochildi.`);
            }
            const command = String(message.text || '').trim();
            if (command === '/stop') {
                if (identity) await db.query('UPDATE domwork_bot_links SET paused=true WHERE telegram_id=$1', [sender]);
                else await funnel.pause(db, sender);
                return await reply('Avtomatik xabarlar to‘xtatildi. Davom ettirish uchun /start bosing.', { reply_markup: { remove_keyboard: true } });
            }
            if (!identity && await funnel.enabled(db)) return await funnel.message(db, update);
            if (!identity) return await reply('CRM akkauntingizni aniqlash uchun o‘zingizning telefon raqamingizni yuboring.\n\nTelegramdagi raqamingiz CRMdagidan boshqa bo‘lsa: o‘quvchilar — Domwork ilovasi → Profil → “Telegram botni ulash”; xodimlar — CRM → Sozlamalar → Bildirishnomalar → Telegram bot → “Ulash”.',
                { reply_markup: { keyboard: [[{ text: '📱 Telefon raqamni yuborish', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } });
            if (command === '/start' || command === '/menu') {
                await db.query('UPDATE domwork_bot_links SET paused=false WHERE telegram_id=$1', [sender]);
                if(identity.kind==='student') await discovery.requestStudent(db,identity.id);
                await store.setSession(db, sender, null);
                return await reply(`Assalomu alaykum, ${text(identity.name)}! Kerakli bo‘limni tanlang.`);
            }
            if (command === '/cancel') {
                await store.setSession(db, sender, null); return await reply('Bekor qilindi.');
            }
            if(identity.role==='admin' && /^#voronka\b/i.test(String(message.caption || message.text || '').trim()))
                return await reply(await funnel.adminMedia(db, identity, message));
            if(message.chat_shared) {
                policy.requireAction(identity,'bindings');
                const pending=await store.session(db,sender);
                if(pending?.type!=='choose-chat' || pending.requestId!==message.chat_shared.request_id) throw policy.error(409,'Guruh tanlash so‘rovi eskirgan');
                const chatId=String(message.chat_shared.chat_id);
                if(!/^-[1-9]\d{4,15}$/.test(chatId)) throw policy.error(400,'Guruhni tanlang');
                await db.query(`INSERT INTO domwork_bot_seen_chats(chat_id,title,bot_status) VALUES($1,$2,'shared')
                    ON CONFLICT(chat_id) DO UPDATE SET title=EXCLUDED.title,observed_at=NOW()`,[chatId,text(message.chat_shared.title)]);
                await discovery.observe(db,chatId,text(message.chat_shared.title));
                await store.setSession(db,sender,null);
                return await reply(`Tanlangan guruh: ${text(message.chat_shared.title)}\nchat_id: ${chatId}\nCRM → Sozlamalar → Telegram guruhlari → Bot boshqaruvida aniq bo‘lim yoki ustozga biriktiring. Hali xabar yuborilmaydi.`);
            }
            // An allowed menu button is navigation, never a workflow answer or
            // broadcast content. Only abandon this sender's unfinished FSM;
            // persisted broadcasts, leave requests and CRM records stay intact.
            const action = actionFor(identity, command);
            if (action) policy.requireAction(identity, action);
            let pending = await store.session(db, sender);
            if (action && pending) {
                await store.setSession(db, sender, null);
                pending = null;
            }
            if (pending?.type === 'leave') {
                policy.requireAction(identity, 'leave');
                const match = /^(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+([\s\S]{5,1000})$/.exec(command);
                const validDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
                if (!match || !validDate(match[1]) || !validDate(match[2]) || match[2] < match[1])
                    return await reply('Sana va sababni shu shaklda yuboring:\n2026-10-12 2026-10-13 Oilaviy sabab\nBekor qilish: /cancel');
                if (!identity.employeeId) throw policy.error(409, 'Faol HR profiliga biriktiring');
                await db.query(`INSERT INTO domwork_bot_leave_requests(id,employee_id,user_id,reason,start_date,end_date)
                    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
                    [`leave:${update.update_id}`,identity.employeeId,identity.id,match[3],match[1],match[2]]);
                await store.audit(db, identity.id, 'leave-request', `leave:${update.update_id}`);
                await store.setSession(db, sender, null);
                return await reply('Ruxsat arizasi administratorga yuborildi. Hali tasdiqlanmagan.');
            }
            if (pending?.type === 'broadcast') {
                policy.requireAction(identity,'broadcast');
                if (pending.step === 'segment') {
                    const segment=Object.entries(SEGMENT_LABELS).find(([key,label])=>label===command || key===command)?.[0];
                    if (!segment) return await reply('Auditoriyani pastdagi tugmalardan tanlang. /cancel',{reply_markup:segmentKeyboard()});
                    await store.setSession(db,sender,{type:'broadcast',step:'content',segment});
                    return await reply('Matn yoki rasm/video/voice/faylni yuboring. Keyin ko‘rib tasdiqlaysiz. /cancel',{reply_markup:{remove_keyboard:true}});
                }
                if (pending.step === 'content') {
                    const media=message.photo?.at(-1) || message.video || message.voice || message.document;
                    const method=message.photo?'sendPhoto':message.video?'sendVideo':message.voice?'sendVoice':message.document?'sendDocument':'sendMessage';
                    const content={method,text:media?(message.caption || ''):command,fileId:media?.file_id};
                    controls.contentInput(content);
                    await store.setSession(db,sender,{type:'broadcast',step:'time',segment:pending.segment,content});
                    return await reply('Yuborish vaqti: «⚡️ Hozir» yoki YYYY-MM-DD HH:MM (Toshkent vaqti). /cancel',{reply_markup:{keyboard:[[{text:'⚡️ Hozir'}]],resize_keyboard:true,one_time_keyboard:true}});
                }
                if (pending.step === 'time') {
                    const now=['now','hozir','⚡️ hozir'].includes(command.toLowerCase());
                    if (!now && !/^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d$/.test(command)) return await reply('«⚡️ Hozir» tugmasini bosing yoki vaqtni YYYY-MM-DD HH:MM shaklida yozing.',{reply_markup:{keyboard:[[{text:'⚡️ Hozir'}]],resize_keyboard:true,one_time_keyboard:true}});
                    const scheduledAt=now?undefined:command.replace(' ','T')+':00+05:00';
                    const preview=await controls.draft(db,{id:identity.id},{segment:pending.segment,content:pending.content,scheduledAt});
                    const buttons=[];
                    for (const cancel of [false,true]) buttons.push({text:cancel?'Bekor qilish':'Tasdiqlash va yuborish',
                        callback_data:await store.callback(db,{type:'broadcast',id:preview.id,fingerprint:preview.fingerprint,cancel})});
                    await store.setSession(db,sender,null);
                    return await reply(`Xabar ko‘rinishi:\n${pending.content.text}\nTur: ${pending.content.method}\nAuditoriya: ${pending.segment}\nQabul qiluvchilar: ${preview.count}\nVaqt: ${new Date(preview.scheduledAt).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'})}\nTasdiqlanmaguncha yuborilmaydi.`,
                        {reply_markup:{inline_keyboard:[buttons]}});
                }
            }
            if (!action) return await reply('Menyudan bo‘limni tanlang. Bekor qilish: /cancel');
            policy.requireAction(identity, action);
            const config = (await store.settings(db)).data;
            if(action==='bindings') {
                const requestId=Number(update.update_id)%2147483647;
                await store.setSession(db,sender,{type:'choose-chat',requestId});
                return await reply('Guruhni tanlang. Keyin CRMda aniq ustoz yoki bo‘limga biriktiring.',{reply_markup:{keyboard:[[{text:'📌 Guruhni tanlash',request_chat:{request_id:requestId,chat_is_channel:false,bot_is_member:true,request_title:true}}],...keyboard(identity).keyboard],resize_keyboard:true}});
            }
            if (action === 'broadcast') {
                await store.setSession(db,sender,{type:'broadcast',step:'segment'});
                return await reply('Kimga yuboramiz? Pastdagi tugmalardan tanlang. Guruhlar uchun CRM → Telegram guruhlari → Bot boshqaruvi. /cancel',{reply_markup:segmentKeyboard()});
            }
            if (action === 'trial-lessons' && identity.role === 'teacher') {
                const rows=(await db.query("SELECT * FROM leads WHERE language='russian' AND status='sinov-darsida' AND deleted_at IS NULL ORDER BY updated_at DESC")).rows;
                let found=0;
                for(const row of rows) {
                    const lead={...row.extra_data,id:row.id,name:row.name,status:row.status,language:row.language};
                    const booking=trial.request(lead);
                    if(booking?.teacherId!==identity.employeeId) continue;
                    if(++found>30) break;
                    await reply(`${lead.name}\n${booking.scheduledAt}\nHolat: ${booking.state}${booking.reasonLabel?'\nSabab: '+booking.reasonLabel:''}`,
                        {reply_markup:await callbacks.trialButtons(db,lead,booking),_trial:{leadId:lead.id,requestId:booking.id,teacherId:booking.teacherId,state:booking.state}});
                }
                if(!found) await reply(empty);
                return;
            }
            if (action === 'leave-review') {
                const rows=(await db.query(`SELECT l.*,h.name FROM domwork_bot_leave_requests l LEFT JOIN hr_employees h ON h.id=l.employee_id
                    WHERE l.state='pending' ORDER BY l.created_at LIMIT 30`)).rows;
                for(const row of rows) await reply(`${text(row.name)}\n${row.reason}\n${policy.today(new Date(row.start_date))} — ${policy.today(new Date(row.end_date))}`,
                    {reply_markup:await callbacks.leaveButtons(db,row.id)});
                if(!rows.length) await reply(empty);
                return;
            }
            if (action === 'contact') return await reply('Qo‘llab-quvvatlash: https://t.me/domwork_admin');
            if (['course','platform','results'].includes(action)) {
                const media=config[action+'Media'];
                if(media) await store.enqueue(db,{key:`u:${update.update_id}:material`,targetId:sender,role:identity.role,account:identity,
                    method:media.method,payload:{...media.payload,chat_id:sender}});
                return await reply(config[action + 'Text'] || (media?'Material yuborildi.':'Materiallar administrator tomonidan hali kiritilmagan. https://t.me/domwork_admin'));
            }
            if (action === 'leave') {
                await store.setSession(db, sender, { type: 'leave' });
                return await reply('Boshlanish sanasi, tugash sanasi va sababni kiriting:\n2026-10-12 2026-10-13 Oilaviy sabab\nBekor qilish: /cancel');
            }
            if (action === 'penalties') {
                const rows = (await db.query('SELECT amount,reason,created_at FROM domwork_bot_penalties WHERE employee_id=$1 ORDER BY created_at DESC LIMIT 30', [identity.employeeId || ''])).rows;
                return await reply(rows.map(r => `${money(r.amount)} — ${text(r.reason)}`).join('\n') || empty);
            }
            if (action === 'work') {
                // CRM'dagi xodimlar davomati (Face ID + lokatsiya) — faqat o'zining tasdiqlangan belgilari, so'nggi 14 kun.
                const present = (await db.query("SELECT to_regclass('staff_att_events') AS t")).rows[0]?.t;
                const rows = present ? (await db.query(`SELECT kind,occurred_at FROM staff_att_events WHERE employee_id=$1 AND ok
                    AND occurred_at>NOW()-INTERVAL '14 days' ORDER BY occurred_at DESC LIMIT 40`, [identity.employeeId || ''])).rows : [];
                return await reply(rows.length ? 'So‘nggi 14 kun (Face ID):\n' + rows.map(r => `${r.kind === 'in' ? '🟢 Keldi' : '🔴 Ketdi'}: ${new Date(r.occurred_at).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'})}`).join('\n')
                    : 'So‘nggi 14 kunda Face ID belgisi yo‘q. Belgilash: CRM → Davomat.');
            }
            if (identity.role === 'trial' && action === 'trial-group') {
                const lead = await crm.getLeadById(identity.id);
                if (!lead || lead.language !== 'russian' || lead.status !== 'sinov-darsida') throw policy.error(403, 'Faol sinov darsi topilmadi');
                const booking = trial.request(lead);
                const group = await groups.defaultForTeacher(db, 'trial', booking?.teacherId);
                return await reply(group ? `${text(group.name)}\n${group.inviteLink}` : 'Ustozingiz uchun sinov guruhi hali belgilanmagan. Administrator bilan bog‘laning.');
            }
            if (identity.role === 'student') {
                // Never use demo-student fallback: every adapter receives the verified CRM id.
                if (!identity.id) throw policy.error(403, 'O‘quvchi akkaunti topilmadi');
                if (action === 'credentials') {
                    const row = (await db.query("SELECT phone,extra_data FROM students WHERE id=$1 AND subject='russian'", [identity.id])).rows[0];
                    const last4 = policy.phone(row?.phone).slice(-4);
                    const original = last4.length === 4 && row?.extra_data?.passwordHash && await bcrypt.compare(last4, row.extra_data.passwordHash);
                    return await reply(`Platforma: https://myhomework.uz/student/\nLogin: ${text(row?.extra_data?.login || '+' + policy.phone(row?.phone))}\n`
                        + (original ? `Parol: ${last4}` : 'Parol o‘zgartirilgan. Uni ko‘rsatish yoki tiklash uchun administratorga murojaat qiling.'));
                }
                if (action === 'grades') {
                    const result = await crm.getDemoStudentGrades(identity.id);
                    return await reply((result.grades || []).slice(-30).map(g => `${text(g.date)} — `
                        + (g.scores ? Object.entries(g.scores).map(([key,value])=>`${text(key)}: ${text(value)}`).join(', ') : text(g.overall ?? g.score ?? 'Baholar CRMda'))).join('\n') || empty);
                }
                if (action === 'payments') {
                    const result = await crm.getDemoStudentPayments(identity.id);
                    return await reply(`Tarif: ${text(result.tariffLabel)}\nQoldiq qarz: ${money(result.debtAmount)}\nMuddat: ${text(result.paymentDueDate || 'Belgilanmagan')}\n`
                        + (result.history || []).slice(0,30).map(r => `${text(r.date || r.paidDate)} — ${money(r.amount || r.paid)}`).join('\n'));
                }
                if (action === 'book') {
                    // No name-based best-effort matching: it can expose a namesake's address.
                    const student = (await db.query('SELECT extra_data FROM students WHERE id=$1', [identity.id])).rows[0];
                    const ref = student?.extra_data?.leadRef;
                    const rows = (await db.query("SELECT student_id,lead_ref,status,dispatched_at FROM book_roadmap WHERE lang='russian'", [])).rows;
                    const matches = rows.filter(r => {
                        let lead; try { lead = JSON.parse(r.lead_ref || 'null'); } catch { return false; }
                        return r.student_id === identity.id || (ref?.id && ref.lang === 'russian' && lead?.id === ref.id && lead.lang === 'russian');
                    });
                    const result = matches.length === 1 ? matches[0] : null;
                    return await reply(result ? `Yetkazib berish bosqichi: ${text(result.status)}\nJo‘natilgan sana: ${text(result.dispatched_at)}` : 'Kitob yozuvi akkauntingizga aniq biriktirilmagan. Administrator tekshirsin.');
                }
                if (action === 'attendance') {
                    const rows = (await db.query(`SELECT 'Asosiy' AS duty,LEFT(att_key,7) AS month,day,present FROM main_attendance WHERE student_id=$1
                        UNION ALL SELECT 'Yordamchi',LEFT(att_key,7),day,present FROM assistant_attendance WHERE student_id=$1 ORDER BY month DESC,day DESC LIMIT 60`, [identity.id])).rows;
                    return await reply(rows.map(r => `${r.month}-${String(r.day).padStart(2,'0')} · ${r.duty} · ${r.present === 1 ? 'Qatnashdi' : 'Kelmadi'}`).join('\n') || empty);
                }
                if (action === 'contract') {
                    const row = (await db.query('SELECT extra_data FROM students WHERE id=$1', [identity.id])).rows[0];
                    if (!row?.extra_data?.contract?.number) return await reply('Shartnoma hali rasmiylashtirilmagan. Administrator bilan bog‘laning.');
                    await store.enqueue(db, { key: `u:${update.update_id}:contract`, targetId: sender, role: 'student', account: identity,
                        method: 'sendDocument', payload: { chat_id: sender, _documentStudentId: identity.id } });
                    return;
                }
                if (action === 'groups' || action === 'schedule') {
                    const result = await crm.getDemoStudentSchedule(identity.id);
                    if (action === 'schedule') return await reply(`Dars vaqti: ${text(result.lessonTime || 'Belgilanmagan')}\nKeyingi dars: `
                        + (result.startsAt ? new Date(result.startsAt).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'})+`\nQolgan vaqt: ${Math.max(0,Math.ceil((new Date(result.startsAt).getTime()-Date.now())/60000))} daqiqa` : 'Belgilanmagan'));
                    const group = await groups.forStudent(db, identity.id);
                    // An explicit admin-approved assignment wins without rewriting the historical link.
                    const link = await groups.studentInvite(db,identity.id,'russian',result.telegramGroupLink || '');
                    return await reply([link ? `Dars guruhi: ${link}` : 'Dars guruhi havolasini administrator belgilaydi.', config.officialChannel ? `Rasmiy kanal: ${config.officialChannel}` : ''].filter(Boolean).join('\n'),
                        group?{_studentGroup:{studentId:identity.id,groupId:group.id}}:{});
                }
            }
            // Staff integrations are intentionally separate from student/data access.
            if (crm.staffAction) return await reply(await crm.staffAction(db, identity, action));
            return await reply('Bu funksiya hali ulanmagan. Hozircha CRM kabinetidan foydalaning.');
        } catch (error) {
            if (!error.status || error.status >= 500) throw error;
            await reply(error.message);
        }
    };
}
module.exports = { money, keyboard, chunks, actionFor, createHandler };
