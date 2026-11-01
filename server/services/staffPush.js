'use strict';
// "Domwork Team" Android ilovasiga push (FCM). Manba — xodim bildirishnomalari (staffNotify.collect): qo'ng'iroqcha
// panelidagi va faqat push uchun hisoblanadigan voqealar. Har daqiqada har ilova o'rnatgan xodim uchun yangi
// voqealar tekshiriladi va telefoniga yuboriladi (ilova yopiq bo'lsa ham keladi).
// Sozlama: xodimning "Bildirishnomalar" sozlamasida Telegram yoki brauzer — birortasi yoqilgan bo'lsa telefonga ham keladi; tinch soatlar hurmat qilinadi.
// Birinchi ulanishda (yoki uzilishdan keyin) mavjud voqealar "yuborilgan" deb belgilanadi — eski xabarlar to'planib kelmaydi.
const fcm = require('./fcm');
const N = require('./staffNotify');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS staff_push_tokens (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, platform TEXT NOT NULL DEFAULT 'android',
    app_version TEXT NOT NULL DEFAULT '', device TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS staff_push_tokens_user ON staff_push_tokens(user_id);
CREATE TABLE IF NOT EXISTS staff_push_state (user_id TEXT PRIMARY KEY, baseline_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_push_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS staff_push_sent (user_id TEXT NOT NULL, event_id TEXT NOT NULL, sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(user_id, event_id));`;
const state = { ready: false };
const LOCK = 731205; // pg advisory lock — bir nechta server nusxasi bir xabarni ikki marta yubormasin

async function initSchema(pool) {
    await pool.query(SCHEMA);
    state.ready = true;
}

const clean = (v, n) => String(v ?? '').trim().slice(0, n);
async function register(pool, actor, body = {}) {
    const token = clean(body.token, 4096);
    if (token.length < 20) throw Object.assign(new Error('Token noto\'g\'ri'), { status: 400 });
    // Bitta telefon — bitta token: boshqa xodim shu telefondan kirsa, token unga o'tadi.
    await pool.query(`INSERT INTO staff_push_tokens (token, user_id, platform, app_version, device) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (token) DO UPDATE SET user_id=EXCLUDED.user_id, platform=EXCLUDED.platform, app_version=EXCLUDED.app_version,
        device=EXCLUDED.device, last_seen_at=NOW()`,
        [token, String(actor.id), clean(body.platform, 20) || 'android', clean(body.appVersion, 40), clean(body.device, 120)]);
    return { ok: true, configured: fcm.configured() };
}
async function unregister(pool, actor, body = {}) {
    const token = clean(body.token, 4096);
    if (token) await pool.query('DELETE FROM staff_push_tokens WHERE token=$1 AND user_id=$2', [token, String(actor.id)]);
    return { ok: true };
}
async function mine(pool, actor) {
    const rows = (await pool.query('SELECT platform, app_version, device, last_seen_at FROM staff_push_tokens WHERE user_id=$1 ORDER BY last_seen_at DESC', [String(actor.id)])).rows;
    return { configured: fcm.configured(), devices: rows };
}

const urlFor = (role, e) => {
    const base = role === 'teacher' ? 'https://myhomework.uz/teacher/' : 'https://myhomework.uz/';
    return `${base}?notif=${encodeURIComponent(e.id || '')}${e.go?.tab ? `&tab=${encodeURIComponent(e.go.tab)}` : ''}${e.go?.leadId ? `&lead=${encodeURIComponent(e.go.leadId)}` : ''}`;
};
async function deliver(pool, userId, role, msg) {
    const tokens = (await pool.query('SELECT token FROM staff_push_tokens WHERE user_id=$1', [userId])).rows.map(r => r.token);
    let ok = 0;
    for (const t of tokens) {
        const r = await fcm.send(t, msg);
        if (r.ok) ok++;
        else if (r.gone) await pool.query('DELETE FROM staff_push_tokens WHERE token=$1', [t]);
        else console.error('[push] yuborilmadi:', r.error);
    }
    return { ok, devices: tokens.length };
}

async function test(pool, actor) {
    if (!fcm.configured()) throw Object.assign(new Error('Push hali sozlanmagan (serverda FCM kaliti yo\'q)'), { status: 503 });
    const u = (await pool.query('SELECT role FROM users WHERE id=$1', [actor.id])).rows[0] || {};
    const r = await deliver(pool, String(actor.id), u.role, { title: 'Bildirishnomalar ishlayapti ✅', body: 'Domwork Team xabarlari endi shu telefonga keladi.', tag: 'test', id: `test:${Date.now()}`,
        url: u.role === 'teacher' ? 'https://myhomework.uz/teacher/' : 'https://myhomework.uz/' });
    if (!r.devices) throw Object.assign(new Error('Bu akkauntda ilova o\'rnatilgan telefon topilmadi'), { status: 404 });
    return { ok: r.ok > 0, ...r };
}

// Bitta xodim — o'z tranzaksiyasida (FOR UPDATE: ikki parallel tekshiruv bir xabarni ikki marta yubormaydi).
async function pushUser(pool, userId, role, now) {
    // Voqealar tranzaksiyadan tashqarida yig'iladi: bitta bo'lim xatosi tranzaksiyani buzmasin.
    const { row, prefs, ev, errors } = await N.collect(pool, { id: userId }, now);
    const c = await pool.connect();
    let out = [], quiet = false;
    try {
        await c.query('BEGIN');
        await c.query('INSERT INTO staff_push_state(user_id) VALUES($1) ON CONFLICT DO NOTHING', [userId]);
        const st = (await c.query('SELECT last_push_at FROM staff_push_state WHERE user_id=$1 FOR UPDATE', [userId])).rows[0];
        const ids = [...new Set(ev.map(e => e.id))];
        const gap = !st?.last_push_at || now - new Date(st.last_push_at) > 10 * 60000;
        if (gap) {
            if (!errors.length) {
                await c.query('UPDATE staff_push_state SET baseline_at=NOW(), last_push_at=$2 WHERE user_id=$1', [userId, now]);
                if (ids.length) await c.query('INSERT INTO staff_push_sent(user_id,event_id) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING', [userId, ids]);
            }
            await c.query('COMMIT');
            return 0;
        }
        await c.query('UPDATE staff_push_state SET last_push_at=$2 WHERE user_id=$1', [userId, now]);
        const done = ids.length ? new Set((await c.query('SELECT event_id FROM staff_push_sent WHERE user_id=$1 AND event_id=ANY($2::text[])', [userId, ids])).rows.map(r => r.event_id)) : new Set();
        quiet = N.quietNow(row.prefs?.quiet, now);
        const seen = new Set(), skip = [];
        for (const e of ev) {
            if (seen.has(e.id) || done.has(e.id)) continue; seen.add(e.id);
            if (Date.parse(e.at) > now.getTime() + 60000) continue; // vaqti hali kelmagan
            if (prefs[e.type] && prefs[e.type].web === false && prefs[e.type].tg === false) { skip.push(e.id); continue; } // ikkala kanal o'chirilgan bo'lsagina
            if (quiet && !N.URGENT.has(e.type)) continue; // tinch soat tugagach (hali dolzarb bo'lsa)
            out.push(e);
        }
        const mark = [...skip, ...out.map(e => e.id)];
        if (mark.length) await c.query('INSERT INTO staff_push_sent(user_id,event_id) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING', [userId, mark]);
        await c.query('COMMIT');
    } catch (e) {
        await c.query('ROLLBACK').catch(() => {});
        throw e;
    } finally { c.release(); }
    if (!out.length) return 0;
    // Bir nechta bo'lsa (masalan tinch soatdan keyin) — 3 tagacha alohida, qolgani bitta jamlangan xabar.
    const single = out.length <= 3 ? out : [];
    for (const e of single) await deliver(pool, userId, role, { title: e.title, body: e.sub || '', tag: e.type, id: e.id, url: urlFor(role, e) });
    if (!single.length) await deliver(pool, userId, role, { title: `${out.length} ta yangi xabar`, tag: 'digest', id: `digest:${now.getTime()}`, url: urlFor(role, {}),
        body: out.slice(0, 5).map(e => '• ' + e.title).join('\n') + (out.length > 5 ? `\n… va yana ${out.length - 5} ta` : '') });
    return out.length;
}

let running = false;
async function tick(pool, now = new Date(), { budgetMs = 45000 } = {}) {
    if (!state.ready || !fcm.configured() || running) return 0;
    running = true;
    const lock = await pool.connect();
    try {
        if (!(await lock.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK])).rows[0]?.ok) return 0;
        try {
            await pool.query("DELETE FROM staff_push_sent WHERE sent_at < NOW() - INTERVAL '60 days'");
            await pool.query("DELETE FROM staff_push_tokens WHERE last_seen_at < NOW() - INTERVAL '90 days'");
            const users = (await pool.query(`SELECT DISTINCT t.user_id, u.role, s.last_push_at FROM staff_push_tokens t JOIN users u ON u.id::text = t.user_id
                LEFT JOIN staff_push_state s ON s.user_id = t.user_id ORDER BY s.last_push_at NULLS FIRST`)).rows;
            const started = Date.now(); let sent = 0;
            for (const u of users) {
                if (Date.now() - started > budgetMs) break; // qolganlari keyingi daqiqada
                try { sent += await pushUser(pool, u.user_id, u.role, now); }
                catch (e) { console.error('[push] xodim tekshiruvi xatosi:', e.code || e.message); }
            }
            return sent;
        } finally { await lock.query('SELECT pg_advisory_unlock($1)', [LOCK]).catch(() => {}); }
    } finally { lock.release(); running = false; }
}

module.exports = { state, initSchema, register, unregister, mine, test, tick };
