'use strict';
const policy = require('./policy');
const {randomUUID} = require('node:crypto');
// Separate, additive storage: legacy ratings and unscoped advertising JSON are never rewritten.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS domwork_assistant_ratings (
 student_id TEXT NOT NULL, week TEXT NOT NULL, teacher_id TEXT NOT NULL, ratings JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(student_id,week)
);
CREATE INDEX IF NOT EXISTS domwork_assistant_ratings_teacher ON domwork_assistant_ratings(teacher_id,week);
CREATE TABLE IF NOT EXISTS domwork_ad_entries (
 kind TEXT NOT NULL CHECK(kind IN ('day','plan')), date TEXT NOT NULL, data JSONB NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, updated_by TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(kind,date)
);
CREATE TABLE IF NOT EXISTS domwork_insights_audit (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL,
 before_data JSONB, after_data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;
async function init(db) {await db.query(SCHEMA);}
async function audit(db,actor,action,entity,before,after) {
    await db.query('INSERT INTO domwork_insights_audit(id,actor_id,action,entity_id,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6)',
        [randomUUID(),actor,action,entity,before==null?null:JSON.stringify(before),JSON.stringify(after)]);
}
const ratingKeys=['contact','speed','help','motivation','overall'];
function ratingsInput(ratings) {
    if(!ratings || !ratingKeys.every(k=>typeof ratings[k]==='number' && Number.isInteger(ratings[k]) && ratings[k]>=1 && ratings[k]<=5))
        throw policy.error(400,'Barcha mezonlar bo‘yicha 1–5 butun sonli baho kerak');
    return Object.fromEntries(ratingKeys.map(k=>[k,ratings[k]]));
}
async function rateAssistant(db,studentId,week,ratings,now=new Date()) {
    if(!studentId) throw policy.error(401,'O‘quvchi hisobiga kiring');
    const today=policy.today(now), reports=require('./reports'), monday=reports.shift(reports.periods(now).weeks.at(-1).start,-7);
    // A past, unattributed rating cannot become evidence about today's assistant.
    if(week!==monday) throw policy.error(400,'Faqat oxirgi to‘liq tugagan hafta baholanadi');
    const clean=ratingsInput(ratings);
    const s=(await db.query("SELECT * FROM students WHERE id=$1 AND subject='russian' FOR UPDATE",[studentId])).rows[0];
    if(!policy.activeStudent(s) || !s.assistant_teacher_id || s.assistant_teacher_id===s.teacher_id)
        throw policy.error(403,'Faol yordamchi ustoz biriktirilmagan');
    const teacher=(await db.query('SELECT role,lang,status,dual_role FROM hr_employees WHERE id=$1',[s.assistant_teacher_id])).rows[0];
    if(!teacher || teacher.status==='inactive' || teacher.lang!=='russian'
        || !(teacher.role==='yordamchi' || (teacher.dual_role && ['rus-oqituvchi','oqituvchi'].includes(teacher.role))))
        throw policy.error(403,'Yordamchi ustoz faol emas');
    if(s.extra_data?.startDate && s.extra_data.startDate>today) throw policy.error(403,'O‘qish hali boshlanmagan');
    // The app rates the last completed week. Current assignment alone is NOT historical proof.
    const marks=(await db.query('SELECT att_key,day,present FROM assistant_attendance WHERE student_id=$1 AND LEFT(att_key,7) BETWEEN $2 AND $3',
        [studentId,week.slice(0,7),reports.shift(week,6).slice(0,7)])).rows.filter(r=>{
            const date=r.att_key.slice(0,7)+'-'+String(r.day).padStart(2,'0');
            return require('../../../js/payrollEngine').date(date) && date>=week && date<=reports.shift(week,6);
        });
    if(!marks.some(r=>r.present===1) || marks.some(r=>r.att_key.slice(8)!==s.assistant_teacher_id))
        throw policy.error(409,'O‘tgan hafta uchun yordamchi ustozning aniq davomati topilmadi yoki ustoz almashgan; baho taxminan biriktirilmaydi');
    const legacy=(await db.query("SELECT data FROM json_data WHERE key='assistantWeeklyRatings'")).rows[0]?.data;
    if(legacy?.[studentId]?.[week]) throw policy.error(409,'Bu haftaning eski bahosi saqlangan; u o‘zgartirilmaydi');
    const inserted=await db.query(`INSERT INTO domwork_assistant_ratings(student_id,week,teacher_id,ratings)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING *`,[studentId,week,s.assistant_teacher_id,JSON.stringify(clean)]);
    if(!inserted.rows.length) throw policy.error(409,'Bu hafta baholangan; saqlangan baho o‘zgartirilmaydi');
    await audit(db,studentId,'assistant-rating',studentId+':'+week,null,{teacherId:s.assistant_teacher_id,ratings:clean});
    return clean;
}
async function assistantHistory(db,studentId) {
    const rows=(await db.query('SELECT week,ratings FROM domwork_assistant_ratings WHERE student_id=$1 ORDER BY week',[studentId])).rows;
    return Object.fromEntries(rows.map(r=>[r.week,r.ratings]));
}
async function assistantRanking(db,teacherId) {
    const rows=(await db.query('SELECT ratings FROM domwork_assistant_ratings WHERE teacher_id=$1',[teacherId])).rows;
    const scores=rows.map(r=>r.ratings.overall).filter(n=>Number.isFinite(n)&&n>=1&&n<=5);
    return scores.length?`O‘quvchilar bahosi: ${(scores.reduce((s,n)=>s+n,0)/scores.length).toFixed(1)}\nBaholar soni: ${scores.length}\nFaqat aniq ustoz IDsi bilan saqlangan baholar.`
        :'Aniq ustoz IDsi bilan saqlangan yordamchi baholari hali yo‘q. Eski, ustoz IDsi yo‘q baholar taxminan biriktirilmaydi.';
}
async function marketingAccess(db,actor) {
    const rows=(await db.query(`SELECT u.id,u.role,h.lang,h.status FROM users u LEFT JOIN hr_employees h
        ON LOWER(TRIM(h.login))=LOWER(TRIM(u.email)) WHERE u.id=$1`,[actor.id])).rows;
    if(rows.length!==1 || !(rows[0].role==='admin' || (rows[0].role==='targetolog' && rows[0].lang==='russian' && rows[0].status!=='inactive')))
        throw policy.error(403,'Rus tili marketing ma’lumotlariga ruxsat yo‘q');
}
function entryInput(kind,date,data) {
    const engine=require('../../../js/payrollEngine');
    if(!(kind==='day'?engine.date(date)===date:kind==='plan' && /^\d{4}-(0[1-9]|1[0-2])$/.test(date))) throw policy.error(400,'Sana noto‘g‘ri');
    const keys=kind==='day'?['budget','leadCount']:['budget','lidSoni','kvalLidSoni','kvalLidPct'];
    const clean={};
    for(const k of keys) {
        const value=data?.[k];
        if(k==='kvalLidPct' && value==null) {clean[k]=null;continue;}
        if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e9
            || (['leadCount','lidSoni','kvalLidSoni'].includes(k) && !Number.isInteger(value))
            || (k==='kvalLidPct' && value>100)) throw policy.error(400,'Summa va sonlar noto‘g‘ri');
        clean[k]=k==='budget'?Math.round(value*100)/100:value;
    }
    return clean;
}
async function marketingMonth(db,actor,month) {
    await marketingAccess(db,actor);
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw policy.error(400,'Oy noto‘g‘ri');
    const rows=(await db.query('SELECT kind,date,data,revision FROM domwork_ad_entries WHERE LEFT(date,7)=$1 ORDER BY date',[month])).rows;
    const legacy=(await db.query("SELECT key,data FROM json_data WHERE key IN ('targetDailyAdSpend','targetMonitoringPlan')")).rows;
    const raw=Object.fromEntries(legacy.map(r=>[r.key,r.data]));
    const days={};
    for(const [key,data] of Object.entries(raw.targetDailyAdSpend?.russian?.[month] || {})) {
        const date=/^\d{4}-\d{2}-\d{2}$/.test(key)?key:month+'-'+String(key).padStart(2,'0');
        if(require('../../../js/payrollEngine').date(date) && typeof data?.budget==='number' && Number.isFinite(data.budget) && data.budget>=0)
            days[date]={budget:data.budget,leadCount:Number.isInteger(data.leadCount)&&data.leadCount>=0?data.leadCount:null,revision:0};
    }
    return {days:{...days,...Object.fromEntries(rows.filter(r=>r.kind==='day').map(r=>[r.date,{...r.data,revision:r.revision}]))},
        plan:rows.find(r=>r.kind==='plan') || (raw.targetMonitoringPlan?.russian?.[month]?{data:raw.targetMonitoringPlan.russian[month],revision:0}:null)};
}
async function saveMarketing(db,actor,body) {
    await marketingAccess(db,actor);
    const {kind,date,revision}=body, data=entryInput(kind,date,body.data);
    if(!Number.isInteger(revision)||revision<0) throw policy.error(400,'Versiya talab qilinadi');
    await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-ad:' || $1::text))",[kind+':'+date]);
    const before=(await db.query('SELECT * FROM domwork_ad_entries WHERE kind=$1 AND date=$2 FOR UPDATE',[kind,date])).rows[0];
    if((before?.revision || 0)!==revision) throw policy.error(409,'Ma’lumot o‘zgargan; oynani yangilang');
    await db.query(`INSERT INTO domwork_ad_entries(kind,date,data,updated_by) VALUES($1,$2,$3,$4)
        ON CONFLICT(kind,date) DO UPDATE SET data=EXCLUDED.data,revision=domwork_ad_entries.revision+1,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
        [kind,date,JSON.stringify(data),actor.id]);
    await audit(db,actor.id,'russian-ad-'+kind,date,before?.data || null,data);
    return {ok:true};
}
async function advertising(db,start,end) {
    const raw=(await db.query("SELECT key,data FROM json_data WHERE key IN ('targetDailyAdSpend','targetMonitoringPlan')")).rows;
    const legacy=Object.fromEntries(raw.map(r=>[r.key,r.data]));
    const days={};
    for(const [month,entries] of Object.entries(legacy.targetDailyAdSpend?.russian || {})) for(const [key,value] of Object.entries(entries || {})) {
        const date=/^\d{4}-\d{2}-\d{2}$/.test(key)?key:month+'-'+String(key).padStart(2,'0');
        if(date>=start && date<=end && typeof value?.budget==='number' && Number.isFinite(value.budget) && value.budget>=0) days[date]=value;
    }
    const entries=(await db.query('SELECT kind,date,data FROM domwork_ad_entries WHERE date BETWEEN $1 AND $2 OR (kind=\'plan\' AND date=$3)',[start,end,start.slice(0,7)])).rows;
    for(const r of entries.filter(r=>r.kind==='day')) days[r.date]=r.data;
    return {days,total:Object.values(days).reduce((sum,v)=>sum+v.budget,0),known:Object.keys(days).length>0,
        plan:entries.find(r=>r.kind==='plan')?.data || legacy.targetMonitoringPlan?.russian?.[start.slice(0,7)] || null};
}
module.exports={SCHEMA,init,ratingsInput,rateAssistant,assistantHistory,assistantRanking,marketingAccess,entryInput,marketingMonth,saveMarketing,advertising};
