'use strict';
const { randomUUID } = require('node:crypto');
function createRedis(url, factory) {
    const client = (factory || require('redis').createClient)({ url, disableOfflineQueue: true,
        socket: { connectTimeout: 5000, reconnectStrategy: retries => Math.min(250 * (retries + 1), 5000) } });
    // Error messages can contain credentials/connection URLs; never print them.
    client.on('error', () => {});
    return {
        async connect() { await client.connect(); },
        get ready() { return client.isReady; },
        async close() { if (client.isOpen) await client.destroy(); },
        async session(sender,state) {
            const key='domwork:fsm:'+sender;
            if(state) await client.set(key,JSON.stringify(state),{EX:1800});
            else await client.del(key);
        },
        async readSession(sender) {
            const raw=await client.get('domwork:fsm:'+sender);
            return raw?JSON.parse(raw):null;
        },
        async allow(sender) {
            const count = await client.eval(`local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n`,
                { keys: ['domwork:request:' + sender], arguments: [] });
            return Number(count) <= 30;
        },
        async deliverySlot(chatId) {
            // Global and per-chat limits are atomic. A denied slot changes neither counter.
            const result = await client.eval(`
              if redis.call('EXISTS',KEYS[2])==1 then return 0 end
              local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>=25 then return 0 end
              n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],1) end
              redis.call('SET',KEYS[2],'1','EX',1); return 1`,
                { keys: ['domwork:send:global','domwork:send:chat:' + chatId], arguments: [] });
            return Number(result) === 1;
        },
        async lease(key) {
            const token = randomUUID();
            return await client.set('domwork:lease:' + key, token, { NX: true, PX: 30000 }) ? token : null;
        },
        async release(key, token) {
            await client.eval(`if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end; return 0`,
                { keys: ['domwork:lease:' + key], arguments: [token] });
        }
    };
}
module.exports = { createRedis };
