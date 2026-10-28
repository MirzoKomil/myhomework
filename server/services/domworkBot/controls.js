'use strict';
const { randomUUID, createHash } = require('node:crypto');
const policy = require('./policy');
const store = require('./store');
const groups = require('../domworkGroups');
const OP_TYPES = ['sales','marketing','teachers','family','beacon'];
const SCHEMA = `
ALTER TABLE domwork_bot_groups ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE domwork_bot_groups ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS domwork_bot_broadcasts (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, segment TEXT NOT NULL, content JSONB NOT NULL,
 recipients JSONB NOT NULL, fingerprint TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'draft'
 CHECK(state IN ('draft','queued','cancelled')), scheduled_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), confirmed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS domwork_bot_trial_members (
 chat_id TEXT NOT NULL, telegram_id TEXT NOT NULL, lead_id TEXT NOT NULL, request_id TEXT NOT NULL,
 joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(chat_id,telegram_id)
);
CREATE TABLE IF NOT EXISTS domwork_bot_attendance_marks (
 student_id TEXT NOT NULL, date TEXT NOT NULL, duty TEXT NOT NULL CHECK(duty IN ('main','assistant')),
 teacher_id TEXT NOT NULL, present BOOLEAN, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(student_id,date,duty)
);
CREATE TABLE IF NOT EXISTS domwork_bot_jobs (key TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`;
async function init(db) { await db.query(SCHEMA); }
const fail = policy.error;
function settingsInput(body, previous) {
    const out = { ...previous };
    for (const key of ['staffNotifyEnabled','promotionsEnabled','trialRemovalEnabled','groupNotificationsEnabled','remindersEnabled','reportsEnabled','eventsEnabled','milestonesEnabled','dailyAwardsEnabled','weeklyAwardsEnabled','monthlyAwardsEnabled','employeeWelcomeEnabled','releaseNotesEnabled']) {
        if (Object.hasOwn(body,key)) {
            if (typeof body[key] !== 'boolean') throw fail(400,'Sozlama boolean bo‘lsin');
            out[key] = body[key];
        }
    }
    for (const key of ['courseText','platformText','resultsText','promotionText','familyText','methodicalText']) {
        if (Object.hasOwn(body,key)) {
            if (typeof body[key] !== 'string' || body[key].length > 3500) throw fail(400,'Matn 3500 belgidan oshmasin');
            out[key] = body[key].trim();
        }
    }
    if (Object.hasOwn(body,'officialChannel')) out.officialChannel = body.officialChannel ? groups.inviteLink(body.officialChannel) : '';
    for (const key of ['promotionTime','familyTime','awardsTime']) {
        if (Object.hasOwn(body,key)) {
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body[key])) throw fail(400,'Vaqt HH:MM shaklida bo‘lsin');
            out[key] = body[key];
        }
    }
    out.promotionIntervalMinutes = 1440;
    for(const period of ['weekly','monthly']) {
        const key=period+'AwardCriterion';
        if(Object.hasOwn(body,key)) {
            if(!['','sales','lessons'].includes(body[key]))throw fail(400,'Mukofot mezoni noto‘g‘ri');
            out[key]=body[key];
        }
        if(out[period+'AwardsEnabled'] && !out[key])throw fail(400,'Mukofot mezonini avval tanlang');
    }
    // Lid voronkasi sozlamalari (materiallar botda "#voronka <kalit>" orqali yuklanadi).
    for (const key of ['funnelEnabled','dripEnabled']) if (Object.hasOwn(body,key)) { if (typeof body[key] !== 'boolean') throw fail(400,'Sozlama boolean bo‘lsin'); out[key] = body[key]; }
    // Isitish faqat yoqilgan paytdan keyin kelgan mehmonlarga (eski bazaga birdaniga xabar ketmasin).
    if (out.dripEnabled && !previous.dripStartedAt) out.dripStartedAt = new Date().toISOString(); // faqat birinchi yoqilishda
    if (Object.hasOwn(body,'bonusChannel')) {
        const ch = String(body.bonusChannel || '').trim();
        if (ch && !/^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(ch)) throw fail(400,'Kanal @username shaklida bo‘lsin (masalan @domwork)');
        out.bonusChannel = ch;
    }
    for (const [key,min,max] of [['discountPercent',0,50],['discountHours',1,336],['salesSlaMinutes',5,240]]) {
        if (Object.hasOwn(body,key)) {
            const n = Number(body[key]);
            if (!Number.isInteger(n) || n < min || n > max) throw fail(400,`${key}: ${min}–${max} oralig‘idagi butun son`);
            out[key] = n;
        }
    }
    if (Object.hasOwn(body,'salesHours')) {
        if (!/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(body.salesHours)) throw fail(400,'Ish vaqti 09:00-21:00 shaklida bo‘lsin');
        out.salesHours = body.salesHours;
    }
    if (Object.hasOwn(body,'companyInfo')) {
        if (typeof body.companyInfo !== 'string' || body.companyInfo.length > 300) throw fail(400,'Kompaniya ma’lumoti 300 belgidan oshmasin');
        out.companyInfo = body.companyInfo.trim();
    }
    if (Object.hasOwn(body,'funnelTestimonials')) {
        const t = body.funnelTestimonials || {}, value = {};
        for (const k of ['A','B']) {
            const url = String(t[k] || '').trim();
            if (url && !/^https:\/\/t\.me\/[A-Za-z0-9_]{4,64}\/\d{1,9}$/.test(url)) throw fail(400,'O‘quvchi fikri — kanal posti havolasi (https://t.me/domwork_natijalari/123)');
            if (url) value[k] = url;
        }
        out.funnelTestimonials = value;
    }
    for(const key of ['courseMedia','platformMedia','resultsMedia']) {
        if(Object.hasOwn(body,key)) out[key]=body[key]?contentInput(body[key]):null;
    }
    if (out.promotionsEnabled && !out.promotionText) throw fail(400,'Kunlik xabar matnini avval kiriting');
    return out;
}
async function saveSettings(db, actor, body) {
    await store.currentAdmin(db,actor);
    const before = (await db.query('SELECT data,revision FROM domwork_bot_settings WHERE singleton=1 FOR UPDATE')).rows[0];
    if (body.revision !== before.revision) throw fail(409,'Sozlama o‘zgargan. Yangilang');
    const data = settingsInput(body,before.data);
    await db.query('UPDATE domwork_bot_settings SET data=$1,revision=revision+1 WHERE singleton=1',[JSON.stringify(data)]);
    await store.audit(db,actor.id,'settings','domwork',{before:before.data,after:data});
    return store.settings(db);
}
function bindingInput(body) {
    if (!OP_TYPES.includes(body.type)) throw fail(400,'Bo‘lim turini tanlang');
    const chatId = String(body.chatId || '');
    if (!/^-[1-9]\d{4,15}$/.test(chatId) || !Number.isSafeInteger(Number(chatId))) throw fail(400,'Guruh chat_id noto‘g‘ri');
    if (typeof body.active !== 'boolean') throw fail(400,'Faollik belgisini tanlang');
    return {type:body.type,chatId,active:body.active,inviteLink:body.inviteLink ? groups.inviteLink(body.inviteLink) : ''};
}
async function saveBinding(db,actor,body,verified) {
    await store.currentAdmin(db,actor);
    const input = bindingInput(body);
    if (verified.chatId !== input.chatId) throw fail(400,'Tekshirilgan guruh mos emas');
    await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-learning-groups'))");
    if ((await db.query('SELECT id FROM domwork_learning_groups WHERE chat_id=$1 AND NOT archived',[input.chatId])).rows.length)
        throw fail(409,'Bu guruh dars guruhiga biriktirilgan');
    const previous = (await db.query("SELECT * FROM domwork_bot_groups WHERE type=$1 AND scope='' FOR UPDATE",[input.type])).rows[0];
    if ((previous?.revision || 0) !== body.revision) throw fail(409,'Guruh bog‘lanishi o‘zgargan. Yangilang');
    const id = previous?.id || randomUUID();
    await db.query(`INSERT INTO domwork_bot_groups(id,type,scope,chat_id,invite_link,active,created_by,title)
        VALUES($1,$2,'',$3,$4,$5,$6,$7) ON CONFLICT(type,scope) DO UPDATE SET chat_id=EXCLUDED.chat_id,
        invite_link=EXCLUDED.invite_link,active=EXCLUDED.active,title=EXCLUDED.title,revision=domwork_bot_groups.revision+1,updated_at=NOW()`,
        [id,input.type,input.chatId,input.inviteLink,input.active,actor.id,verified.title]);
    await store.audit(db,actor.id,'group-binding',id,{before:previous || null,after:input});
    return {ok:true};
}
function contentInput(raw) {
    const method = raw?.method || 'sendMessage';
    const field = {sendPhoto:'photo',sendVideo:'video',sendVoice:'voice',sendDocument:'document'}[method];
    if (method !== 'sendMessage' && !field) throw fail(400,'Xabar turini tanlang');
    const value = String(raw.text || '');
    if (value.length > (field ? 1024 : 3500) || (!field && !value.trim())) throw fail(400,'Xabar matni noto‘g‘ri yoki juda uzun');
    const payload = field ? {caption:value} : {text:value};
    // Only Telegram file_id; no arbitrary remote URLs/SSRF, no chat-supplied local files.
    if (field) {
        const file = String(raw.fileId || '');
        if (!/^[A-Za-z0-9_-]{10,1024}$/.test(file)) throw fail(400,'Telegram media file_id kerak');
        payload[field] = file;
    }
    return {method,payload};
}
async function recipients(db,segment,groupIds=[]) {
    if (segment === 'groups') {
        if (!Array.isArray(groupIds) || !groupIds.length || groupIds.length>100) throw fail(400,'Guruhlarni tanlang');
        const rows = (await db.query(`SELECT id,chat_id FROM domwork_bot_groups WHERE active AND id=ANY($1::text[])
            UNION ALL SELECT id,chat_id FROM domwork_learning_groups WHERE NOT archived AND verified_at IS NOT NULL AND id=ANY($1::text[])`,[groupIds])).rows;
        if (rows.length !== new Set(groupIds).size) throw fail(409,'Barcha tanlangan guruhlar faol va tekshirilgan bo‘lsin');
        return rows.map(r=>({kind:'group',id:r.chat_id,bindingId:r.id}));
    }
    if (segment !== 'all' && !policy.ROLES.includes(segment)) throw fail(400,'Auditoriyani tanlang');
    const links = (await db.query('SELECT telegram_id FROM domwork_bot_links WHERE NOT paused ORDER BY telegram_id')).rows;
    const out=[];
    for (const link of links) {
        const identity=await store.identity(db,link.telegram_id);
        if (identity && !identity.paused && (segment==='all' || segment===identity.role))
            out.push({kind:'private',id:identity.telegramId,role:identity.role,account:{kind:identity.kind,id:identity.id}});
    }
    return out;
}
async function draft(db,actor,body) {
    await store.currentAdmin(db,actor);
    const content=contentInput(body.content), audience=await recipients(db,body.segment,body.groupIds);
    if (!audience.length) throw fail(409,'Tanlangan auditoriyada botga bog‘langan akkaunt yo‘q');
    const date=body.scheduledAt ? new Date(body.scheduledAt) : new Date();
    if (!Number.isFinite(date.getTime()) || date.getTime()>Date.now()+366*86400000 || date.getTime()<Date.now()-60000)
        throw fail(400,'Yuborish sanasi noto‘g‘ri');
    const id=randomUUID(), fingerprint=createHash('sha256').update(JSON.stringify({content,audience,at:date.toISOString()})).digest('hex');
    await db.query('INSERT INTO domwork_bot_broadcasts(id,actor_id,segment,content,recipients,fingerprint,scheduled_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [id,actor.id,body.segment,JSON.stringify(content),JSON.stringify(audience),fingerprint,date]);
    await store.audit(db,actor.id,'broadcast-draft',id,{segment:body.segment,count:audience.length});
    return {id,fingerprint,count:audience.length,scheduledAt:date.toISOString(),content};
}
async function confirmBroadcast(db,actor,id,fingerprint,cancel=false) {
    await store.currentAdmin(db,actor);
    const row=(await db.query('SELECT * FROM domwork_bot_broadcasts WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if (!row || row.actor_id!==actor.id) throw fail(404,'Xabar qoralamasi topilmadi');
    if (row.fingerprint!==fingerprint) throw fail(409,'Xabar ko‘rinishini qayta tekshiring');
    if (cancel) {
        await db.query("UPDATE domwork_bot_broadcasts SET state='cancelled' WHERE id=$1",[id]);
        await db.query("UPDATE domwork_bot_outbox SET state='cancelled',payload='{}' WHERE payload->>'_broadcast'=$1 AND state='pending'",[id]);
    } else {
        if (row.state==='queued') return {ok:true,alreadyQueued:true};
        if (row.state!=='draft' || Date.now()-new Date(row.created_at).getTime()>30*60000) throw fail(409,'Qoralama eskirgan yoki bekor qilingan');
        for (const r of row.recipients) await store.enqueue(db,{key:`broadcast:${id}:${r.kind}:${r.id}`,targetKind:r.kind,targetId:r.id,
            role:r.role || '',account:r.account,method:row.content.method,notBefore:row.scheduled_at,
            payload:{...row.content.payload,chat_id:r.id,_automation:true,_broadcast:id,_binding:r.bindingId,_admin:actor.id}});
        await db.query("UPDATE domwork_bot_broadcasts SET state='queued',confirmed_at=NOW() WHERE id=$1",[id]);
    }
    await store.audit(db,actor.id,cancel?'broadcast-cancel':'broadcast-confirm',id,{count:row.recipients.length});
    return {ok:true};
}
async function reviewLeave(db,actor,id,state) {
    await store.currentAdmin(db,actor);
    if (!['approved','rejected'].includes(state)) throw fail(400,'Qarorni tanlang');
    const row=(await db.query('SELECT * FROM domwork_bot_leave_requests WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if (!row) throw fail(404,'Ariza topilmadi');
    if (row.state===state) return {ok:true};
    if (row.state!=='pending') throw fail(409,'Ariza allaqachon ko‘rib chiqilgan');
    await db.query('UPDATE domwork_bot_leave_requests SET state=$2,reviewed_by=$3,reviewed_at=NOW() WHERE id=$1',[id,state,actor.id]);
    await store.audit(db,actor.id,'leave-'+state,id);
    const linked=(await db.query("SELECT telegram_id FROM domwork_bot_links WHERE account_kind='user' AND account_id=$1",[row.user_id])).rows[0];
    const identity=linked && await store.identity(db,linked.telegram_id);
    if (identity) await store.enqueue(db,{key:`leave:${id}:${state}`,targetId:identity.telegramId,role:identity.role,account:identity,
        payload:{chat_id:identity.telegramId,text:`Ruxsat arizangiz ${state==='approved'?'tasdiqlandi':'rad etildi'}.`,_automation:true}});
    return {ok:true};
}
module.exports={SCHEMA,init,OP_TYPES,settingsInput,saveSettings,bindingInput,saveBinding,contentInput,recipients,draft,confirmBroadcast,reviewLeave};
