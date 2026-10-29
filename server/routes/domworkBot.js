'use strict';
const express = require('express');
const store = require('../services/domworkBot/store');
const queue = require('../services/domworkBot/queue');
const groups = require('../services/domworkGroups');
const controls = require('../services/domworkBot/controls');
const discovery = require('../services/domworkBot/discovery');
module.exports = function createRouter({ pool, runtime, authRequired }) {
    const router = express.Router();
    router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    const handle = fn => async (req, res) => {
        try { res.json(await fn(req)); }
        catch (error) {
            if (!error.status) console.error('[domwork-bot] route failed:', error.code || error.name);
            res.status(error.status || 500).json({ error: error.status ? error.message : 'Bot xizmatida xatolik' });
        }
    };
    // An acknowledged update is always durable; 503 makes Telegram retry safely.
    router.post('/webhook', handle(req => runtime.receive(req.body, req.get('X-Telegram-Bot-Api-Secret-Token'))));
    router.use(authRequired);
    router.use(async (req, res, next) => {
        try { await store.currentAdmin(pool, req.user); next(); }
        catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Bot xizmatida xatolik' }); }
    });
    router.get('/status', handle(() => runtime.status()));
    // Read-only acceptance preview; does not enable automation or queue messages.
    router.get('/reports/preview', handle(req => queue.transaction(pool,async db=>({
        digest:await (async()=>{const d=await require('../services/domworkBot/staff').action(db,{role:'admin',id:req.user.id},'digest',{daily:true});return d?.html ?? d;})(),
        marketingHistory:await require('../services/domworkBot/reports').marketingHistory(db)
    }))));
    router.get('/discovery',handle(req=>discovery.list(pool,req.user)));
    router.get('/awards/preview',handle(()=>queue.transaction(pool,async db=>{
        const day=require('../services/domworkBot/policy').today(),recognition=require('../services/domworkBot/recognition');
        return {sales:await recognition.summary(db,'sales',day,day,'Kun sotuvchisi'),teachers:await recognition.summary(db,'lessons',day,day,'Kun ustozi')};
    })));
    router.post('/discovery/rescan',handle(req=>queue.transaction(pool,db=>discovery.rescan(db,req.user))));
    router.post('/discovery/confirm',handle(req=>discovery.confirm(pool,req.user,req.body?.items,(id,options)=>runtime.verifyChat(id,options))));
    router.get('/student-groups',handle(req=>discovery.studentCandidates(pool,req.user)));
    router.post('/student-groups/confirm',handle(req=>groups.assignStudents(pool,req.user,req.body?.items)));
    router.get('/my-telegram-link', handle(req => store.ownAdminLink(pool, req.user)));
    router.post('/my-telegram-link/unlink', handle(req => queue.transaction(pool, db => store.unlinkOwnAdmin(db, req.user, req.body))));
    router.get('/settings', handle(() => store.settings(pool)));
    router.get('/student-activation', handle(() => require('../services/domworkBot/studentActivation').report(pool)));
    router.post('/student-activation/relaunch', handle(async req => {
        if (!(runtime.healthy ? await runtime.healthy() : runtime.status().state === 'ready'))
            throw Object.assign(Error('Bot xabar qabul qilmayapti (webhook/Redis). Avval «Bot webhookini ulash»ni tekshiring'), { status: 503 });
        return require('../services/domworkBot/studentActivation').relaunch(pool, req.user); }));
    router.get('/student-activation/diagnose', handle(async req => require('../services/domworkBot/studentActivation').diagnose(pool, req.user, req.query.q,
        runtime.healthy ? await runtime.healthy() : runtime.status().state === 'ready')));
    router.post('/student-activation/stop', handle(req => require('../services/domworkBot/studentActivation').stop(pool, req.user)));
    router.get('/staff-activation', handle(() => require('../services/domworkBot/staffActivation').report(pool)));
    router.post('/staff-activation/relaunch', handle(async req => {
        // Webhook ishlamasa hech kim Start/Tayyorman bosa olmaydi — bunday holatda yoqilmaydi.
        if (!(runtime.healthy ? await runtime.healthy() : runtime.status().state === 'ready'))
            throw Object.assign(Error('Bot xabar qabul qilmayapti (webhook/Redis). Avval «Bot webhookini ulash»ni tekshiring'), { status: 503 });
        return require('../services/domworkBot/staffActivation').relaunch(pool, req.user); }));
    router.post('/staff-activation/exempt', handle(req => require('../services/domworkBot/staffActivation').exempt(pool, req.user, req.body?.userId)));
    router.post('/staff-activation/stop', handle(req => require('../services/domworkBot/staffActivation').stop(pool, req.user)));
    router.get('/funnel/report', handle(req => require('../services/domworkBot/funnel').report(pool, Math.min(365, Math.max(1, Number(req.query.days) || 30)))));
    router.put('/settings', handle(req => queue.transaction(pool,db => controls.saveSettings(db,req.user,req.body))));
    router.get('/bindings', handle(async () => ({groups:(await pool.query('SELECT id,type,chat_id,invite_link,active,revision,title FROM domwork_bot_groups ORDER BY type')).rows})));
    router.put('/bindings', handle(async req => {
        const input=controls.bindingInput(req.body);
        const verified=await runtime.verifyChat(input.chatId);
        return queue.transaction(pool,db=>controls.saveBinding(db,req.user,req.body,verified));
    }));
    router.post('/broadcasts/preview', handle(req => queue.transaction(pool,db=>controls.draft(db,req.user,req.body))));
    router.post('/broadcasts/:id/confirm', handle(req => queue.transaction(pool,db=>controls.confirmBroadcast(db,req.user,req.params.id,req.body?.fingerprint))));
    router.post('/broadcasts/:id/cancel', handle(req => queue.transaction(pool,db=>controls.confirmBroadcast(db,req.user,req.params.id,req.body?.fingerprint,true))));
    router.get('/broadcasts', handle(async()=>({broadcasts:(await pool.query(`SELECT b.id,b.actor_id,b.segment,b.state,b.scheduled_at,b.created_at,
        jsonb_array_length(b.recipients) AS recipient_count,
        (SELECT COUNT(*) FROM domwork_bot_outbox o WHERE o.payload->>'_broadcast'=b.id AND o.state='pending') AS pending
        FROM domwork_bot_broadcasts b ORDER BY b.created_at DESC LIMIT 30`)).rows})));
    router.get('/delivery-status', handle(async()=>({counts:(await pool.query('SELECT state,COUNT(*) AS count FROM domwork_bot_outbox GROUP BY state')).rows,
        failures:(await pool.query("SELECT id,state,last_error,created_at FROM domwork_bot_outbox WHERE state IN ('failed','uncertain') ORDER BY created_at DESC LIMIT 30")).rows,
        errors:(await pool.query("SELECT part,message,created_at FROM domwork_bot_errors ORDER BY id DESC LIMIT 20").catch(()=>({rows:[]}))).rows})));
    // 30-okt: kun yakuni hisobotini qo'lda (hozir) yuborish — bugungi holat bo'yicha, rahbar/ROP/targetolog va guruhlarga.
    router.post('/reports/send-now', handle(req => queue.transaction(pool, async db => {
        const sched=require('../services/domworkBot/scheduler'), now=new Date();
        const policy=require('../services/domworkBot/policy'), today=policy.today(now), shift=require('../services/domworkBot/reports').shift;
        // Sana tanlanmasa: tun/ertalab (12:00 gacha) — kechagi kun, keyin — bugungi kun. Faqat oxirgi 7 kun.
        const hour=new Date(now.getTime()+5*3600000).getUTCHours();
        const date=req.body?.date || (hour<12?shift(today,-1):today);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || date>today || date<shift(today,-7)) throw policy.error(400,'Sana oxirgi 7 kun ichida bo‘lsin');
        const result=await sched.dailyReport(db,date,now,':manual:'+now.getTime());
        return {ok:true,date,...result};
    })));
    router.get('/leave-requests', handle(async()=>({requests:(await pool.query(`SELECT l.id,l.reason,l.start_date,l.end_date,l.state,h.name
        FROM domwork_bot_leave_requests l LEFT JOIN hr_employees h ON h.id=l.employee_id ORDER BY l.created_at DESC LIMIT 100`)).rows})));
    router.post('/leave-requests/:id/review', handle(req=>queue.transaction(pool,db=>controls.reviewLeave(db,req.user,req.params.id,req.body?.state))));
    router.post('/webhook/setup', handle(req => runtime.setupWebhook(req.user, { replace: req.body?.replace === true })));
    router.get('/observed-chats', handle(async () => ({ chats: (await pool.query('SELECT chat_id,title,bot_status,observed_at FROM domwork_bot_seen_chats ORDER BY observed_at DESC LIMIT 100')).rows })));
    router.post('/learning-groups/:id/verify', handle(async req => {
        const before = (await pool.query('SELECT * FROM domwork_learning_groups WHERE id=$1 AND NOT archived', [req.params.id])).rows[0];
        if (!before?.chat_id) throw Object.assign(Error('Guruhning chat_id qiymatini avval kiriting'), { status: 400 });
        const verified = await runtime.verifyChat(before.chat_id, { trial: before.type === 'trial' });
        return queue.transaction(pool, async db => {
            await store.currentAdmin(db, req.user);
            const current = (await db.query('SELECT * FROM domwork_learning_groups WHERE id=$1 FOR UPDATE', [before.id])).rows[0];
            if (current?.revision !== before.revision || current.archived) throw Object.assign(Error('Guruh o‘zgartirilgan. Yangilang'), { status: 409 });
            const after = (await db.query('UPDATE domwork_learning_groups SET verified_at=NOW(),revision=revision+1,updated_by=$2,updated_at=NOW() WHERE id=$1 RETURNING *', [before.id,req.user.id])).rows[0];
            await store.audit(db, req.user.id, 'learning-group-verified', before.id, verified);
            return { group: groups.dto(after) };
        });
    }));
    return router;
};
