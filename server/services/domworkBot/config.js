'use strict';
// Secrets are read only from the process environment; never included in DTOs/logs.
function configuration(env = process.env) {
    const enabled = env.DOMWORK_BOT_ENABLED === 'true';
    const token = env.DOMWORK_BOT_TOKEN || '';
    const secret = env.DOMWORK_BOT_WEBHOOK_SECRET || '';
    const redisUrl = env.REDIS_URL || '';
    const publicUrl = env.DOMWORK_BOT_PUBLIC_URL || 'https://myhomework.uz';
    if (enabled) {
        if (!/^\d{6,16}:[A-Za-z0-9_-]{30,100}$/.test(token)) throw Error('DOMWORK_BOT_TOKEN is missing or invalid');
        if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret)) throw Error('DOMWORK_BOT_WEBHOOK_SECRET is missing or invalid');
        let redis, base;
        try { redis = new URL(redisUrl); base = new URL(publicUrl); } catch { throw Error('Bot connection configuration is invalid'); }
        if (!['redis:', 'rediss:'].includes(redis.protocol)) throw Error('Redis URL is invalid');
        if (base.protocol !== 'https:' || base.username || base.password || base.port || base.search || base.hash || base.pathname !== '/')
            throw Error('Bot public URL must be an HTTPS origin');
    }
    return { enabled, token, secret, redisUrl, webhookUrl: publicUrl.replace(/\/$/, '') + '/api/domwork/bot/webhook' };
}
module.exports = { configuration };
