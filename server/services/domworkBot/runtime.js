'use strict';
const { configuration } = require('./config');
const { createRedis } = require('./redis');
const queue = require('./queue');
const store = require('./store');
const { createHandler } = require('./handlers');

function createRuntime({ pool, crm, env = process.env, redisFactory, telegramFactory, autoTick = true }) {
    let config, invalid = false;
    try { config = configuration(env); }
    catch { config = configuration({ ...env, DOMWORK_BOT_ENABLED: 'false' }); invalid = true; }
    let redis, telegram, botId, timer, busy = false, stopped = false;
    let state = invalid ? 'failed' : config.enabled ? 'starting' : 'disabled';
    const handler = createHandler({ crm });
    async function call(method, payload) {
        return telegram.callApi(method, payload, { signal: AbortSignal.timeout(20000) });
    }
    async function permitted(row) {
        return queue.transaction(pool, async db => {
            if (Date.now() - new Date(row.created_at).getTime() > 15 * 60000 && !row.payload._automation) return false;
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
            if (!settings.groupNotificationsEnabled) return false;
            const found = (await db.query(`SELECT chat_id FROM domwork_learning_groups WHERE chat_id=$1 AND NOT archived AND verified_at IS NOT NULL
                UNION ALL SELECT chat_id FROM domwork_bot_groups WHERE chat_id=$1 AND active`, [row.target_id])).rows;
            if (found.length !== 1 || !['sendMessage','sendPhoto','sendVideo','sendVoice'].includes(row.method)) return false;
            // Live Telegram permission check; stale verification never grants rights.
            const member = await call('getChatMember', { chat_id: row.target_id, user_id: botId });
            return member.status === 'administrator';
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
            const result = queue.failure(error);
            await queue.settle(pool, row.id, result.state, result.reason, result.seconds);
        }
        return true;
    }
    async function tick() {
        if (busy || stopped || !redis?.ready) return;
        busy = true;
        try {
            for (let n = 0; n < 5; n++) if (!await queue.processOne(pool, handler)) break;
            for (let n = 0; n < 5; n++) if (!await deliverOne()) break;
        } catch (error) { console.error('[domwork-bot] worker failed:', error.code || error.name); }
        finally { busy = false; }
    }
    return {
        async start() {
            if (!config.enabled) return;
            try {
                await store.initSchema(pool);
                redis = createRedis(config.redisUrl, redisFactory); await redis.connect();
                const factory = telegramFactory || (token => new (require('telegraf').Telegram)(token, { webhookReply: false }));
                telegram = factory(config.token);
                const me = await call('getMe', {});
                if (me.username?.toLowerCase() !== 'domworkuz_bot' || !me.is_bot) throw Error('Unexpected bot identity');
                botId = me.id; state = 'ready';
                if (autoTick) { timer = setInterval(tick, 500); timer.unref(); }
            } catch (error) {
                state = 'failed'; await redis?.close().catch(() => {});
                console.error('[domwork-bot] startup failed:', error.code || error.name);
            }
        },
        async stop() { stopped = true; clearInterval(timer); await redis?.close(); state = 'stopped'; },
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
        tick, deliverOne
    };
}
module.exports = { createRuntime };
