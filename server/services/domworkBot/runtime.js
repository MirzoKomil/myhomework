'use strict';
const { configuration } = require('./config');
const { createRedis } = require('./redis');
const queue = require('./queue');
const store = require('./store');
const events = require('./events');
const scheduler = require('./scheduler');
const discovery = require('./discovery');
const groups = require('../domworkGroups');
const { createHandler } = require('./handlers');

function createRuntime({ pool, crm, env = process.env, redisFactory, telegramFactory, autoTick = true }) {
    let config, invalid = false;
    try { config = configuration(env); }
    catch { config = configuration({ ...env, DOMWORK_BOT_ENABLED: 'false' }); invalid = true; }
    let redis, telegram, botId, timer, discoveryTimer, busy = false, discoveryBusy = false, stopped = false, lastSchedule=0;
    let state = invalid ? 'failed' : config.enabled ? 'starting' : 'disabled';
    const handler = createHandler({ crm });
    async function call(method, payload) {
        return telegram.callApi(method, payload, { signal: AbortSignal.timeout(20000) });
    }
    async function permitted(row) {
        return queue.transaction(pool, async db => {
            if (row.payload._expiresAt && Date.now()>new Date(row.payload._expiresAt).getTime()) return false;
            if(row.payload._setting && !(await store.settings(db)).data[row.payload._setting]) return false;
            if(row.payload._settings) {
                const settings=(await store.settings(db)).data;
                if(!row.payload._settings.every(key=>settings[key]===true))return false;
            }
            if(row.payload._employee) {
                if(!(await db.query("SELECT id FROM hr_employees WHERE id=$1 AND (role='rus-oqituvchi' OR (role<>'ingliz-oqituvchi' AND lang='russian')) AND COALESCE(status,'active')<>'inactive'",[row.payload._employee])).rows.length)return false;
            }
            if(row.payload._milestone) {
                const g=row.payload._milestone, today=require('./policy').today();
                if(g.month!==today.slice(0,7))return false;
                const actual=await require('./recognition').sales(db,g.month+'-01',today);
                if(actual.warnings.length || (actual.rows.find(r=>r.id===g.managerId)?.value || 0)<g.threshold)return false;
            }
            if(row.payload._award) {
                const g=row.payload._award, actual=await require('./recognition').summary(db,g.criterion,g.start,g.end,'');
                if(JSON.stringify(actual.winners)!==JSON.stringify(g.winners))return false;
            }
            if (row.payload._admin) {
                try { await store.currentAdmin(db,{id:row.payload._admin}); } catch { return false; }
            }
            if (row.payload._broadcast) {
                const broadcast=(await db.query('SELECT state FROM domwork_bot_broadcasts WHERE id=$1',[row.payload._broadcast])).rows[0];
                if(broadcast?.state!=='queued') return false;
            }
            if(row.payload._schedule) {
                const guard=row.payload._schedule;
                const student=(await db.query("SELECT * FROM students WHERE id=$1 AND subject='russian'",[guard.studentId])).rows[0];
                const at=new Date(guard.at);
                if(!student || !require('./policy').activeStudent(student) || !Number.isFinite(at.getTime())
                    || scheduler.scheduledToday(student,at)?.toISOString()!==guard.at
                    || (guard.teacherId && student.teacher_id!==guard.teacherId)) return false;
            }
            if(row.payload._trial) {
                const guard=row.payload._trial;
                const lead=(await db.query("SELECT extra_data FROM leads WHERE id=$1 AND language='russian' AND status='sinov-darsida' AND deleted_at IS NULL",[guard.leadId])).rows[0];
                const trial=lead?.extra_data?.trialRequest;
                if(!trial || trial.id!==guard.requestId || trial.teacherId!==guard.teacherId || trial.state!==guard.state) return false;
            }
            if(row.payload._assignment) {
                const guard=row.payload._assignment;
                const student=(await db.query("SELECT teacher_id,assistant_teacher_id FROM students WHERE id=$1 AND subject='russian'",[guard.studentId])).rows[0];
                if(!student || (guard.duty==='assistant'?student.assistant_teacher_id:student.teacher_id)!==guard.teacherId) return false;
            }
            if(row.payload._studentGroup) {
                const guard=row.payload._studentGroup;
                const current=await groups.forStudent(db,guard.studentId,{delivery:row.target_kind==='group'});
                if(!current || current.id!==guard.groupId || (row.target_kind==='group' && current.chatId!==row.target_id)) return false;
            }
            // Cancel old queued teacher-default reminders after enabling per-student routing.
            if(row.target_kind==='group' && row.payload._schedule?.studentId && !row.payload._studentGroup) return false;
            if(row.payload._attendance) {
                const guard=row.payload._attendance;
                const mark=(await db.query('SELECT present,teacher_id FROM domwork_bot_attendance_marks WHERE student_id=$1 AND date=$2 AND duty=$3',[guard.studentId,guard.date,guard.duty])).rows[0];
                if(!mark || mark.present!==false || mark.teacher_id!==guard.teacherId) return false;
            }
            if(row.payload._missingAttendance) {
                const guard=row.payload._missingAttendance;
                if(!['main','assistant'].includes(guard.duty) || !/^\d{4}-\d{2}-\d{2}$/.test(guard.date)) return false;
                const mark=(await db.query(`SELECT present FROM ${guard.duty==='main'?'main_attendance':'assistant_attendance'} WHERE att_key=$1 AND student_id=$2 AND day=$3`,
                    [guard.date.slice(0,7)+'_'+guard.teacherId,guard.studentId,Number(guard.date.slice(8))])).rows[0];
                if(mark) return false;
            }
            if (Date.now() - new Date(row.created_at).getTime() > 15 * 60000 && !row.payload._automation) return false;
            // Lid voronkasi (mehmonlar): o'z qoidalari — funnelEnabled, bloklanmagan, shart bajarilmagan.
            if (row.payload._guest) return require('./funnel').deliverable(db, row);
            if (row.target_kind === 'private') {
                if (!row.role) return ['sendMessage','answerCallbackQuery'].includes(row.method) && !row.payload._automation;
                const identity = await store.identity(db, row.target_id);
                const account = row.payload._account;
                return !!identity && identity.role === row.role && !!account
                    && identity.kind === account.kind && identity.id === account.id
                    && (!row.payload._automation || !identity.paused);
            }
            // Binding + settings are rechecked at delivery, not just when queued.
            const settings = (await store.settings(db)).data;
            if (!settings.groupNotificationsEnabled && !(row.payload._funnel && settings.funnelEnabled === true)) return false;
            const found = (await db.query(`SELECT id,chat_id,type,teacher_id FROM domwork_learning_groups WHERE chat_id=$1 AND NOT archived AND verified_at IS NOT NULL
                UNION ALL SELECT id,chat_id,type,NULL FROM domwork_bot_groups WHERE chat_id=$1 AND active`, [row.target_id])).rows;
            if (found.length !== 1 || (row.payload._binding && row.payload._binding!==found[0].id)
                || !['sendMessage','sendPhoto','sendVideo','sendVoice','sendDocument','unbanChatMember'].includes(row.method)) return false;
            // Live Telegram permission check; stale verification never grants rights.
            const member = await call('getChatMember', { chat_id: row.target_id, user_id: botId });
            if(member.status!=='administrator') return false;
            if(row.method==='unbanChatMember') {
                const guard=row.payload._remove;
                if(!settings.trialRemovalEnabled || !member.can_restrict_members || found[0].type!=='trial' || !guard
                    || String(row.payload.user_id)!==guard.telegramId || row.payload.only_if_banned!==false) return false;
                const lead=(await db.query("SELECT extra_data FROM leads WHERE id=$1 AND language='russian' AND status='sinov-darsida' AND deleted_at IS NULL",[guard.leadId])).rows[0];
                const booking=lead?.extra_data?.trialRequest;
                const joined=(await db.query('SELECT request_id,lead_id FROM domwork_bot_trial_members WHERE chat_id=$1 AND telegram_id=$2',[row.target_id,guard.telegramId])).rows[0];
                if(booking?.id!==guard.requestId || booking.state!=='completed' || !booking.attended || booking.teacherId!==found[0].teacher_id
                    || joined?.request_id!==guard.requestId || joined?.lead_id!==guard.leadId) return false;
                const learner=await store.identity(db,guard.telegramId);
                if(!learner || learner.kind!=='lead' || learner.id!==guard.leadId) return false;
            }
            return true;
        });
    }
    async function deliverOne() {
        const row = await queue.claimOutbox(pool); if (!row) return false;
        try {
            if (!await permitted(row)) { await queue.settle(pool, row.id, 'cancelled', 'identity-or-binding-changed'); return true; }
            if (!await redis.deliverySlot(row.target_id)) { await queue.settle(pool, row.id, 'pending', 'local-rate-limit', 1); return true; }
            const payload = Object.fromEntries(Object.entries(row.payload).filter(([key]) => !key.startsWith('_')));
            if (row.payload._documentStudentId) {
                if (row.role !== 'student' || row.payload._account?.id !== row.payload._documentStudentId) {
                    await queue.settle(pool, row.id, 'cancelled', 'document-identity-mismatch'); return true;
                }
                const document = await crm.getStudentContractPdf(row.payload._documentStudentId);
                if (!document) { await queue.settle(pool, row.id, 'failed', 'document-missing'); return true; }
                payload.document = { source: document.buffer, filename: document.filename };
            }
            await call(row.method, payload);
            await queue.settle(pool, row.id, 'sent');
        } catch (error) {
            // Mehmon botni bloklagan bo'lsa — keyingi voronka xabarlari to'xtaydi.
            if (row.payload._guest && Number(error?.response?.error_code) === 403)
                await pool.query('UPDATE domwork_bot_visitors SET blocked_at=NOW() WHERE telegram_id=$1', [row.target_id]).catch(() => {});
            const result = queue.failure(error);
            await queue.settle(pool, row.id, result.state, result.reason, result.seconds);
        }
        return true;
    }
    async function tick() {
        if (busy || stopped || !redis?.ready) return;
        busy = true;
        try {
            for (let n = 0; n < 5; n++) if (!await queue.processOne(pool, async(db,update)=>{db.domworkRedis=redis;return handler(db,update);})) break;
            for (let n = 0; n < 5; n++) if (!await queue.transaction(pool,events.processOne)) break;
            if(Date.now()-lastSchedule>30000) { await queue.transaction(pool,db=>scheduler.run(db)); lastSchedule=Date.now(); }
            for (let n = 0; n < 5; n++) if (!await deliverOne()) break;
        } catch (error) { console.error('[domwork-bot] worker failed:', error.code || error.name); }
        finally { busy = false; }
    }
    async function tickDiscovery() {
        if(discoveryBusy || stopped || !redis?.ready) return;
        discoveryBusy=true;
        try {await discovery.processOne(pool,(method,payload)=>telegram.callApi(method,payload,{signal:AbortSignal.timeout(5000)}),botId);}
        catch(error){console.error('[domwork-bot] discovery failed:',error.code || error.name);}
        finally{discoveryBusy=false;}
    }
    return {
        async start() {
            if (!config.enabled) return;
            try {
                await store.initSchema(pool);
                redis = createRedis(config.redisUrl, redisFactory);
                let startupTimeout;
                try { await Promise.race([redis.connect(),new Promise((_,reject)=>{startupTimeout=setTimeout(()=>reject(Error('Redis startup timeout')),15000);})]); }
                finally { clearTimeout(startupTimeout); }
                const factory = telegramFactory || (token => new (require('telegraf').Telegram)(token, { webhookReply: false }));
                telegram = factory(config.token);
                const me = await call('getMe', {});
                if (me.username?.toLowerCase() !== 'domworkuz_bot' || !me.is_bot) throw Error('Unexpected bot identity');
                botId = me.id; state = 'ready';
                await queue.transaction(pool,db=>require('./recognition').release(db));
                if (autoTick) {
                    timer = setInterval(tick, 500); timer.unref();
                    discoveryTimer = setInterval(tickDiscovery, 1000); discoveryTimer.unref();
                }
            } catch (error) {
                state = 'failed'; await redis?.close().catch(() => {});
                console.error('[domwork-bot] startup failed:', error.code || error.name);
            }
        },
        async stop() { stopped = true; clearInterval(timer); clearInterval(discoveryTimer); await redis?.close(); state = 'stopped'; },
        status() { return { enabled: config.enabled, state, redisReady: !!redis?.ready, webhookPath: '/api/domwork/bot/webhook' }; },
        async receive(update, secret) {
            if (!require('./policy').secretMatches(config.secret, secret)) throw Object.assign(Error('Webhook secret noto‘g‘ri'), { status: 401 });
            if (state !== 'ready' || !redis?.ready) throw Object.assign(Error('Bot hali tayyor emas'), { status: 503 });
            queue.validUpdate(update);
            const sender = update.message?.from?.id || update.callback_query?.from?.id;
            if (sender && !await redis.allow(String(sender))) throw Object.assign(Error('So‘rovlar haddan oshdi'), { status: 429 });
            return queue.receive(pool, update);
        },
        async setupWebhook(actor, { replace = false } = {}) {
            await store.currentAdmin(pool, actor);
            if (state !== 'ready') throw Object.assign(Error('Bot hali tayyor emas'), { status: 503 });
            const existing = await call('getWebhookInfo', {});
            if (existing.url && existing.url !== config.webhookUrl && !replace)
                throw Object.assign(Error('Botda boshqa webhook bor. Almashtirishni alohida tasdiqlang'), { status: 409 });
            await call('setWebhook', { url: config.webhookUrl, secret_token: config.secret, max_connections: 10,
                allowed_updates: ['message','callback_query','my_chat_member','chat_member'], drop_pending_updates: false });
            await store.audit(pool, actor.id, 'webhook-configured', 'domwork');
            return { ok: true };
        },
        async verifyChat(chatId, { trial = false } = {}) {
            if (state !== 'ready') throw Object.assign(Error('Bot hali tayyor emas'), { status: 503 });
            const chat = await call('getChat', { chat_id: chatId });
            const member = await call('getChatMember', { chat_id: chatId, user_id: botId });
            if (!['group','supergroup'].includes(chat.type) || member.status !== 'administrator' || (trial && !member.can_restrict_members))
                throw Object.assign(Error('Bot guruhda administrator bo‘lishi kerak; sinov guruhida a’zolarni chiqarish huquqi ham kerak'), { status: 400 });
            return { chatId: String(chat.id), title: String(chat.title || '').slice(0,200) };
        },
        tick, tickDiscovery, deliverOne
    };
}
module.exports = { createRuntime };
