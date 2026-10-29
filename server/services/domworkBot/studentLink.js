'use strict';
const {randomBytes,randomUUID,createHash}=require('node:crypto');
const policy=require('./policy');
const queue=require('./queue');
const SCHEMA=`
CREATE TABLE IF NOT EXISTS domwork_student_telegram_requests (
 id TEXT PRIMARY KEY, student_id TEXT NOT NULL, session_jti TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','claimed','confirmed','cancelled')),
 telegram_id TEXT, telegram_name TEXT NOT NULL DEFAULT '', telegram_username TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL,
 claimed_at TIMESTAMPTZ, confirmed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS domwork_student_telegram_request_owner ON domwork_student_telegram_requests(student_id,created_at DESC);
CREATE TABLE IF NOT EXISTS domwork_student_telegram_proofs (
 student_id TEXT PRIMARY KEY, telegram_id TEXT NOT NULL UNIQUE, verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;
const hash=raw=>createHash('sha256').update(raw).digest('hex');
async function init(db){await db.query(SCHEMA);}
async function owner(db,actor){
    if(actor?.role!=='student'||typeof actor.id!=='string'||!actor.jti)throw policy.error(403,'O‘quvchi akkauntingiz bilan tizimga kiring');
    // Explicit session check fails closed, including legacy JWTs and CRM previews.
    if(!(await db.query('SELECT 1 FROM sessions WHERE user_id=$1 AND jti=$2 FOR SHARE',[actor.id,actor.jti])).rows.length)
        throw policy.error(401,'Sessiya yakunlangan. Qayta kiring');
    const row=(await db.query("SELECT id,name,phone,subject,extra_data FROM students WHERE id=$1 AND subject='russian' FOR SHARE",[actor.id])).rows[0];
    if(!policy.activeStudent(row))throw policy.error(403,'Faqat faol rus tili o‘quvchisi uchun');
    return row;
}
async function existing(db,id){return(await db.query("SELECT telegram_id FROM domwork_bot_links WHERE account_kind='student' AND account_id=$1",[id])).rows[0]||null;}
function requestDto(row){return row?{id:row.id,state:row.state,expired:new Date(row.expires_at).getTime()<=Date.now(),expiresAt:row.expires_at,
    telegram:row.state==='claimed'?{id:row.telegram_id,name:row.telegram_name,username:row.telegram_username}:null}:null;}
async function status(db,actor){
    const student=await owner(db,actor);
    const row=(await db.query('SELECT * FROM domwork_student_telegram_requests WHERE student_id=$1 AND session_jti=$2 ORDER BY created_at DESC LIMIT 1',[student.id,actor.jti])).rows[0];
    return{linked:!!await existing(db,student.id),request:requestDto(row)};
}
async function create(pool,actor){
    return queue.transaction(pool,async db=>{
        await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-bot-links'))");
        const student=await owner(db,actor);
        if(await existing(db,student.id))throw policy.error(409,'O‘quvchi Telegramga allaqachon bog‘langan. Almashtirish uchun admin bilan bog‘laning');
        const recent=(await db.query("SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE created_at>NOW()-INTERVAL '10 seconds')::int AS fast FROM domwork_student_telegram_requests WHERE student_id=$1 AND created_at>NOW()-INTERVAL '1 hour'",[student.id])).rows[0];
        if(recent.fast||recent.total>=20)throw policy.error(429,'Biroz kutib qayta urinib ko‘ring');
        await db.query("UPDATE domwork_student_telegram_requests SET state='cancelled' WHERE student_id=$1 AND state IN ('pending','claimed')",[student.id]);
        const raw=randomBytes(32).toString('base64url'),id=randomUUID();
        const row=(await db.query("INSERT INTO domwork_student_telegram_requests(id,student_id,session_jti,token_hash,expires_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL '15 minutes') RETURNING *",[id,student.id,actor.jti,hash(raw)])).rows[0];
        await require('./store').audit(db,actor.id,'student-telegram-request',id);
        const url='https://t.me/Domworkuz_bot?start=sl_'+raw;
        return{request:requestDto(row),url,qr:require('./qr').qrPath(url)};
    });
}
function startHash(command){
    const raw=/^\/start(?:@Domworkuz_bot)? sl_([A-Za-z0-9_-]{43})$/i.exec(command||'');
    return raw?hash(raw[1]):null;
}
// Never persist a reusable raw linking credential in the durable Telegram inbox.
function redact(update){
    const text=update?.message?.text||'';
    if(!update?.message)return update;
    const {_studentLinkHash:ignored,_staffLinkHash:ignoredStaff,_leadLinkHash:ignoredLead,...message}=update.message;
    const tokenHash=startHash(text);
    if(tokenHash)return{...update,message:{...message,text:'/start student-link',_studentLinkHash:tokenHash}};
    const staffHash=require('./staffLink').startHash(text);
    if(staffHash)return{...update,message:{...message,text:'/start staff-link',_staffLinkHash:staffHash}};
    const leadHash=require('./leadLink').startHash(text);
    return{...update,message:leadHash?{...message,text:'/start lead-link',_leadLinkHash:leadHash}:message};
}
async function claim(db,message){
    const telegramId=policy.telegramId(message?.from?.id),tokenHash=/^[a-f0-9]{64}$/.test(message?._studentLinkHash||'')?message._studentLinkHash:startHash(message?.text);
    if(!telegramId||message.chat?.type!=='private'||String(message.chat.id)!==telegramId||message.from.is_bot||message.forward_origin||!tokenHash)
        throw policy.error(400,'Ulash havolasini o‘z Telegramingizda oching');
    await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-bot-links'))");
    const row=(await db.query("SELECT * FROM domwork_student_telegram_requests WHERE token_hash=$1 AND state IN ('pending','claimed') AND expires_at>NOW() FOR UPDATE",[tokenHash])).rows[0];
    if(!row)throw policy.error(410,'Havola eskirgan. Student appdan yangi havola oling');
    await owner(db,{id:row.student_id,role:'student',jti:row.session_jti});
    if(row.state==='claimed'&&row.telegram_id!==telegramId)throw policy.error(409,'Bu havola ishlatilgan. Ilovadan yangi havola oling');
    const occupied=(await db.query('SELECT account_kind,account_id FROM domwork_bot_links WHERE telegram_id=$1',[telegramId])).rows[0];
    // Lid sifatida ulangan Telegram (avval mehmon/sinov) o'quvchiga aylanganda tasdiqlashda almashtiriladi.
    if(occupied&&occupied.account_kind!=='lead'&&(occupied.account_kind!=='student'||occupied.account_id!==row.student_id))throw policy.error(409,'Telegram hisobi boshqa CRM akkauntiga bog‘langan');
    const linked=await existing(db,row.student_id);
    if(linked&&linked.telegram_id!==telegramId)throw policy.error(409,'O‘quvchi boshqa Telegramga bog‘langan. Admin bilan bog‘laning');
    if(row.state==='pending')await db.query("UPDATE domwork_student_telegram_requests SET state='claimed',telegram_id=$2,telegram_name=$3,telegram_username=$4,claimed_at=NOW() WHERE id=$1",
        [row.id,telegramId,String([message.from.first_name,message.from.last_name].filter(Boolean).join(' ')).slice(0,160),String(message.from.username||'').slice(0,64)]);
    // 29-okt: ilovaga qaytib tasdiqlash qadami olib tashlandi — Start'ning o'zi ulaydi (xodimlardagidek).
    // Havola bir martalik, 15 daqiqa, faqat o'quvchining tirik ilova sessiyasida yaratiladi, faqat shaxsiy chatda ishlaydi.
    const student=(await db.query("SELECT id,name,phone FROM students WHERE id=$1",[row.student_id])).rows[0];
    await finalize(db,row,student,telegramId,'bot-start');
    return{ok:true,linked:true};
}
async function confirm(pool,actor,input={}){
    return queue.transaction(pool,async db=>{
        await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-bot-links'))");
        const student=await owner(db,actor),telegramId=policy.telegramId(input.telegramId);
        if(typeof input.requestId!=='string'||!telegramId)throw policy.error(400,'Telegram hisobini tekshirib tasdiqlang');
        const row=(await db.query('SELECT *,expires_at>NOW() AS valid FROM domwork_student_telegram_requests WHERE id=$1 AND student_id=$2 AND session_jti=$3 FOR UPDATE',[input.requestId,student.id,actor.jti])).rows[0];
        if(!row||row.state!=='claimed'||!row.valid||row.telegram_id!==telegramId)throw policy.error(409,'Ulash so‘rovi eskirgan yoki o‘zgargan. Qayta tekshiring');
        await finalize(db,row,student,telegramId,'platform');
        return{ok:true};
    });
}
// Ulanishni yakunlash. Chaqiruvchi advisory lock'ni ushlab turadi.
async function finalize(db,row,student,telegramId,method){
    const occupied=(await db.query('SELECT account_kind,account_id FROM domwork_bot_links WHERE telegram_id=$1',[telegramId])).rows[0],linked=await existing(db,student.id);
    if((occupied&&occupied.account_kind!=='lead'&&(occupied.account_kind!=='student'||occupied.account_id!==student.id))||(linked&&linked.telegram_id!==telegramId))
        throw policy.error(409,'Mavjud Telegram bog‘lanishi almashtirilmadi. Admin bilan bog‘laning');
    if(occupied?.account_kind==='lead')await db.query("DELETE FROM domwork_bot_links WHERE telegram_id=$1 AND account_kind='lead'",[telegramId]);
    if(!linked)await db.query("INSERT INTO domwork_bot_links(telegram_id,account_kind,account_id,phone) VALUES($1,'student',$2,$3)",[telegramId,student.id,policy.phone(student.phone)]);
    await db.query('INSERT INTO domwork_student_telegram_proofs(student_id,telegram_id) VALUES($1,$2) ON CONFLICT(student_id) DO NOTHING',[student.id,telegramId]);
    await db.query("UPDATE domwork_student_telegram_requests SET state='confirmed',confirmed_at=NOW(),telegram_id=$2 WHERE id=$1",[row.id,telegramId]);
    await require('./store').audit(db,student.id,'student-telegram-confirmed',row.id,{telegramId,method});
    await require('./discovery').requestStudent(db,student.id);
    const identity=await require('./store').identity(db,telegramId);
    if(!identity)return;
    const {keyboard}=require('./handlers'), T=require('./tone');
    await require('./store').enqueue(db,{key:'student-link:'+row.id,targetId:telegramId,role:'student',account:identity,
        payload:{chat_id:telegramId,text:welcome(identity),reply_markup:keyboard(identity),...T.HTML}});
}
function welcome(identity){
    const T=require('./tone');
    return `🎉 Tabriklaymiz, ${T.esc(T.first(identity.name))}! Telegram Domwork ilovangizga ulandi.\n\n`
        +'Endi shu yerda:\n🔔 darsdan 15 daqiqa oldin eslatma va jonli dars havolasi\n📊 baho va vazifa natijalari\n💳 to‘lov va shartnoma\n🔑 login va parol\n\n'
        +'Ilovaga qayting — oyna o‘zi yopiladi. Pastdagi menyudan kerakli bo‘limni tanlang 👇';
}
async function finishPending(db,telegramId){
    await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-bot-links'))");
    const row=(await db.query("SELECT * FROM domwork_student_telegram_requests WHERE telegram_id=$1 AND state='claimed' AND expires_at>NOW() ORDER BY claimed_at DESC LIMIT 1 FOR UPDATE",[telegramId])).rows[0];
    if(!row)return false;
    const student=await owner(db,{id:row.student_id,role:'student',jti:row.session_jti});
    await finalize(db,row,student,telegramId,'bot-start');
    return true;
}
async function cancel(pool,actor,input={}){
    return queue.transaction(pool,async db=>{
        await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-bot-links'))");await owner(db,actor);
        if(typeof input.requestId!=='string')throw policy.error(400,'Ulash so‘rovini tanlang');
        await db.query("UPDATE domwork_student_telegram_requests SET state='cancelled' WHERE id=$1 AND student_id=$2 AND session_jti=$3 AND state IN ('pending','claimed')",[input.requestId,actor.id,actor.jti]);
        return{ok:true};
    });
}
module.exports={SCHEMA,init,owner,status,create,claim,confirm,finishPending,cancel,redact,startHash,welcome};
