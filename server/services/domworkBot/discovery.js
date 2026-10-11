'use strict';
// Discovery is only evidence. CRM groups and student links need explicit admin approval.
const {randomUUID}=require('node:crypto');
const groups=require('../domworkGroups');
const store=()=>require('./store');
const policy=require('./policy');
const fail=policy.error;
const SCHEMA=`
CREATE TABLE IF NOT EXISTS domwork_group_discovery (
 chat_id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT 'pending',
 revision INTEGER NOT NULL DEFAULT 1, evidence JSONB NOT NULL DEFAULT '{}', checked_at TIMESTAMPTZ,
 lease_until TIMESTAMPTZ, last_error TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS domwork_student_group_discovery (
 student_id TEXT PRIMARY KEY, state TEXT NOT NULL DEFAULT 'pending', revision INTEGER NOT NULL DEFAULT 1,
 evidence JSONB NOT NULL DEFAULT '{}', checked_at TIMESTAMPTZ, lease_until TIMESTAMPTZ,
 last_error TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;
async function init(db) {
    await db.query(SCHEMA);
    // Additive inbox only: existing learning groups, defaults and students stay unchanged.
    await db.query(`INSERT INTO domwork_group_discovery(chat_id,title)
        SELECT chat_id,title FROM domwork_bot_seen_chats s
        WHERE NOT EXISTS(SELECT 1 FROM domwork_learning_groups g WHERE g.chat_id=s.chat_id AND NOT g.archived)
        AND NOT EXISTS(SELECT 1 FROM domwork_bot_groups g WHERE g.chat_id=s.chat_id) ON CONFLICT DO NOTHING`);
}
async function observe(db,chatId,title='') {
    if(!/^-[1-9]\d{4,15}$/.test(String(chatId))) return;
    if((await db.query(`SELECT id FROM domwork_learning_groups WHERE chat_id=$1 AND NOT archived
        UNION ALL SELECT id FROM domwork_bot_groups WHERE chat_id=$1`,[String(chatId)])).rows.length) return;
    await db.query(`INSERT INTO domwork_group_discovery(chat_id,title) VALUES($1,$2)
        ON CONFLICT(chat_id) DO UPDATE SET title=EXCLUDED.title,state='pending',revision=domwork_group_discovery.revision+1,
        checked_at=NULL,lease_until=NULL,last_error='',updated_at=NOW()`,[String(chatId),String(title).slice(0,200)]);
}
async function requestStudent(db,id) {
    await db.query(`INSERT INTO domwork_student_group_discovery(student_id) VALUES($1)
        ON CONFLICT(student_id) DO UPDATE SET state='pending',revision=domwork_student_group_discovery.revision+1,
        checked_at=NULL,lease_until=NULL,last_error='',updated_at=NOW()`,[id]);
}
async function requestTeachersStudents(db,teacherIds) {
    if(!teacherIds.length) return;
    const rows=(await db.query("SELECT * FROM students WHERE subject='russian' AND teacher_id=ANY($1::text[])",[teacherIds])).rows;
    for(const s of rows.filter(policy.activeStudent)) await requestStudent(db,s.id);
}
async function contactLinked(db,identity) {
    if(identity.kind==='student') await requestStudent(db,identity.id);
    if(identity.role==='teacher') {
        // A teacher registering after the bot joined groups must also be discovered.
        await db.query(`UPDATE domwork_group_discovery SET state='pending',revision=revision+1,lease_until=NULL,
            checked_at=NULL,last_error='',updated_at=NOW() WHERE state<>'confirmed'`);
        await requestTeachersStudents(db,[identity.employeeId]);
    }
}
async function list(db,actor) {
    await groups.admin(db,actor);
    return {candidates:(await db.query(`SELECT d.chat_id AS "chatId",d.title,d.state,d.revision,d.evidence,
        d.checked_at AS "checkedAt",d.last_error AS "lastError" FROM domwork_group_discovery d
        WHERE NOT EXISTS(SELECT 1 FROM domwork_learning_groups g WHERE g.chat_id=d.chat_id AND NOT g.archived)
        AND NOT EXISTS(SELECT 1 FROM domwork_bot_groups g WHERE g.chat_id=d.chat_id)
        ORDER BY d.title,d.chat_id`)).rows};
}
async function rescan(db,actor) {
    await groups.admin(db,actor);
    await db.query(`UPDATE domwork_group_discovery SET state='pending',revision=revision+1,checked_at=NULL,
        lease_until=NULL,last_error='',updated_at=NOW() WHERE state<>'confirmed'`);
    const teachers=(await groups.list(db,actor)).teachers;
    await requestTeachersStudents(db,teachers.map(t=>t.id));
    return {queued:true};
}
function memberPresent(member) {
    return ['member','administrator','creator'].includes(member?.status) || (member?.status==='restricted' && member.is_member===true);
}
async function inspect(db,chatId,call,botId) {
    const chat=await call('getChat',{chat_id:chatId});
    const bot=await call('getChatMember',{chat_id:chatId,user_id:botId});
    if(String(chat.id)!==chatId || !['group','supergroup'].includes(chat.type) || bot.status!=='administrator')
        throw fail(400,'Bot guruhda administrator emas');
    const admins=await call('getChatAdministrators',{chat_id:chatId});
    const teachers=new Map();
    for(const admin of admins) {
        if(admin.user?.is_bot) continue;
        const identity=await store().identity(db,String(admin.user?.id || ''));
        if(identity?.role==='teacher' && identity.employeeId) teachers.set(identity.employeeId,{id:identity.employeeId,name:identity.name});
    }
    let inviteLink='';
    try {if(chat.invite_link) inviteLink=groups.inviteLink(chat.invite_link);else if(chat.username) inviteLink=groups.inviteLink('https://t.me/'+chat.username);}catch{/* Missing invite never invents one. */}
    return {title:String(chat.title || '').slice(0,120),inviteLink,teachers:[...teachers.values()],canRestrict:bot.can_restrict_members===true};
}
async function claim(pool,table) {
    return groups.transaction(pool,async db=>(await db.query(`UPDATE ${table} SET state='scanning',lease_until=NOW()+INTERVAL '5 minutes'
        WHERE ${table==='domwork_group_discovery'?'chat_id':'student_id'}=(SELECT ${table==='domwork_group_discovery'?'chat_id':'student_id'}
        FROM ${table} WHERE state='pending' OR (state='scanning' AND lease_until<NOW()) ORDER BY updated_at LIMIT 1 FOR UPDATE SKIP LOCKED)
        RETURNING *`)).rows[0]);
}
async function scanStudent(db,row,call,botId) {
    const student=(await db.query("SELECT * FROM students WHERE id=$1 AND subject='russian'",[row.student_id])).rows[0];
    if(!policy.activeStudent(student)) return {groups:[],reason:'inactive'};
    const link=(await db.query("SELECT telegram_id FROM domwork_bot_links WHERE account_kind='student' AND account_id=$1",[student.id])).rows[0];
    const identity=link && await store().identity(db,link.telegram_id);
    if(identity?.kind!=='student' || identity.id!==student.id) return {groups:[],teacherId:student.teacher_id,reason:'not-registered'};
    const list=(await db.query(`SELECT * FROM domwork_learning_groups WHERE type='classroom' AND NOT archived
        AND verified_at IS NOT NULL AND teacher_id=$1 ORDER BY id`,[student.teacher_id])).rows;
    const found=[];
    async function check(g) {
        const bot=await call('getChatMember',{chat_id:g.chat_id,user_id:botId});
        if(bot.status!=='administrator') throw fail(400,'Guruhda bot admin huquqini yo‘qotgan');
        const member=await call('getChatMember',{chat_id:g.chat_id,user_id:Number(link.telegram_id)});
        return memberPresent(member)?{id:g.id,name:g.name}:null;
    }
    for(let at=0;at<list.length;at+=4) found.push(...(await Promise.all(list.slice(at,at+4).map(check))).filter(Boolean));
    return {teacherId:student.teacher_id,telegramId:link.telegram_id,groups:found,reason:found.length===1?'unique':found.length?'ambiguous':'no-match'};
}
async function processOne(pool,call,botId) {
    let table='domwork_group_discovery',row=await claim(pool,table);
    if(!row) {table='domwork_student_group_discovery';row=await claim(pool,table);}
    if(!row) return false;
    const field=table==='domwork_group_discovery'?'chat_id':'student_id',id=row[field];
    try {
        const evidence=field==='chat_id'?await inspect(pool,id,call,botId):await scanStudent(pool,row,call,botId);
        await pool.query(`UPDATE ${table} SET state='ready',evidence=$3,checked_at=NOW(),lease_until=NULL,last_error=''
            WHERE ${field}=$1 AND revision=$2 AND state='scanning'`,[id,row.revision,JSON.stringify(evidence)]);
    } catch(error) {
        // Explicit rescan is required after errors; do not hammer Telegram indefinitely.
        await pool.query(`UPDATE ${table} SET state='error',lease_until=NULL,last_error=$3 WHERE ${field}=$1 AND revision=$2 AND state='scanning'`,
            [id,row.revision,error.status?error.message:'Telegram tekshiruvi bajarilmadi. Qayta tekshiring']);
    }
    return true;
}
function selection(items) {
    if(!Array.isArray(items)||!items.length||items.length>50||new Set(items.map(i=>i?.chatId)).size!==items.length)
        throw fail(400,'1–50 ta takrorlanmagan guruhni tanlang');
    return items.map(i=>{
        if(!Number.isSafeInteger(i?.revision)||i.revision<1) throw fail(400,'Guruh versiyasini kiriting');
        const data=groups.input({...i,isDefault:false,inviteLink:i.inviteLink || ''});
        if(!data.chatId) throw fail(400,'Guruh chat_id qiymati talab qilinadi');
        return {...data,revision:i.revision};
    });
}
async function confirm(pool,actor,items,verify) {
    const selected=selection(items);
    await groups.admin(pool,actor);
    // Live read-only permissions checks happen before the short atomic database transaction.
    const verified=[];
    for(let at=0;at<selected.length;at+=4) verified.push(...await Promise.all(selected.slice(at,at+4).map(i=>verify(i.chatId,{trial:i.type==='trial'}))));
    return groups.transaction(pool,async db=>{
        await groups.admin(db,actor);
        await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-learning-groups'))");
        const result=[];
        for(const [index,item] of selected.entries()) {
            if(verified[index]?.chatId!==item.chatId) throw fail(409,'Telegram guruh tekshiruvi mos kelmadi');
            const candidate=(await db.query('SELECT * FROM domwork_group_discovery WHERE chat_id=$1 FOR UPDATE',[item.chatId])).rows[0];
            if(!candidate||candidate.revision!==item.revision||candidate.state!=='ready'
                || Date.now()-new Date(candidate.checked_at).getTime()>24*3600000) throw fail(409,'Guruh taklifi eskirgan. Qayta tekshiring');
            if((await db.query('SELECT id FROM domwork_learning_groups WHERE chat_id=$1 AND NOT archived UNION ALL SELECT id FROM domwork_bot_groups WHERE chat_id=$1',[item.chatId])).rows.length)
                throw fail(409,'Guruh allaqachon bog‘langan. Eski bog‘lanish o‘zgartirilmadi');
            const teacher=(await db.query(`SELECT id FROM hr_employees WHERE id=$1 AND role IN ('oqituvchi','rus-oqituvchi')
                AND (role='rus-oqituvchi' OR lang='russian') AND COALESCE(status,'active')<>'inactive' FOR SHARE`,[item.teacherId])).rows[0];
            if(!teacher) throw fail(400,'Faol rus tili ustozini tanlang');
            const after=(await db.query(`INSERT INTO domwork_learning_groups(id,type,name,teacher_id,invite_link,chat_id,is_default,verified_at,created_by,updated_by)
                VALUES($1,$2,$3,$4,$5,$6,false,NOW(),$7,$7) RETURNING *`,[randomUUID(),item.type,item.name,item.teacherId,item.inviteLink,item.chatId,actor.id])).rows[0];
            await groups.audit(db,actor,'discovery-confirm',null,after);
            await db.query("UPDATE domwork_group_discovery SET state='confirmed',revision=revision+1,updated_at=NOW() WHERE chat_id=$1",[item.chatId]);
            result.push(groups.dto(after));
        }
        await requestTeachersStudents(db,[...new Set(selected.filter(i=>i.type==='classroom').map(i=>i.teacherId))]);
        return {groups:result};
    });
}
async function studentCandidates(db,actor) {
    const students=await groups.studentsList(db,actor);
    const evidence=new Map((await db.query('SELECT * FROM domwork_student_group_discovery')).rows.map(r=>[r.student_id,r]));
    return {students:students.map(s=>{const d=evidence.get(s.id);return {...s,discovery:d?{
        state:d.state,reason:d.evidence?.teacherId===s.teacherId?d.evidence.reason:'stale',
        groups:d.state==='ready' && d.evidence?.teacherId===s.teacherId?d.evidence.groups || []:[],lastError:d.last_error}:null};})};
}
module.exports={SCHEMA,init,observe,contactLinked,requestStudent,rescan,list,inspect,memberPresent,processOne,confirm,selection,studentCandidates};
