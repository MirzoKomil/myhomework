'use strict';
// SMS xarajati → Moliya (Abdulloh tanlagan "A" varianti, 16-noy).
//
//  * "Eskiz balansi (SMS)" — oldindan to'lov hisobi (acc-eskiz-sms, Rus tili, elektron hamyon). Hisobotlarda pul qoldig'iga
//    kiradi (balans mos keladi), lekin undan maosh / qaytarish to'lanmaydi (financeEngine PREPAID_ACCOUNTS).
//  * To'ldirish — xarajat emas: shaxsiy kartadan bo'lsa "Ta'sischi kiritgan mablag'" (capital), kompaniya hisobidan
//    bo'lsa "o'tkazma" (transfer) bo'lib Moliya'ning oddiy operatsiya oynasidan yoziladi.
//  * Har kuni 00:10 dan keyin (Toshkent) o'tgan kun(lar) uchun bitta "SMS xizmati (Eskiz)" xarajati yoziladi:
//    summa = Eskiz balansidan aynan yechilgan pul = oldingi o'qish + shu oraliqdagi to'ldirishlar − hozirgi balans.
//    Shuning uchun Moliya'dagi Eskiz qoldig'i har doim haqiqiy Eskiz balansiga teng bo'ladi.
//  * Muammolar (faqat Moliya › Muammolar'da): balans 3 kundan kamga yetadi; balans oshgan-u to'ldirish kiritilmagan;
//    Eskiz javob bermadi (keyinroq qayta urinadi, yozilmagan kunlar keyingi o'qishga qo'shiladi).
const eskiz = require('./eskiz');

const ACCOUNT_ID = 'acc-eskiz-sms';
const SCHEMA = `
CREATE TABLE IF NOT EXISTS eskiz_sms_snapshots (
 day DATE PRIMARY KEY, balance BIGINT NOT NULL, spent BIGINT NOT NULL DEFAULT 0, topups BIGINT NOT NULL DEFAULT 0,
 transaction_id TEXT, read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS eskiz_sms_state (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`;

const tkNow = () => new Date(Date.now() + 5 * 3600000);
const tkDay = (offset = 0) => new Date(tkNow().getTime() + offset * 86400000).toISOString().slice(0, 10);
const dayKey = v => v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : String(v).slice(0, 10);
const fmt = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

async function initSchema(pool) { await pool.query(SCHEMA); }

async function setState(pool, patch) {
    await pool.query(`INSERT INTO eskiz_sms_state(id,data) VALUES('main',$1) ON CONFLICT(id) DO UPDATE SET data=eskiz_sms_state.data || $1::jsonb, updated_at=NOW()`, [JSON.stringify(patch)]);
}
async function getState(pool) {
    return (await pool.query("SELECT data FROM eskiz_sms_state WHERE id='main'")).rows[0]?.data || {};
}

// Avtomatik yozuvlar egasi: birinchi admin (moliya ruxsati bor, rahbar — limit va qoldiq tekshiruvlari unga qo'llanmaydi).
async function systemActor(pool) {
    const row = (await pool.query(`SELECT id FROM users WHERE role IN ('admin','boshliq') AND disabled_at IS NULL ORDER BY (role='admin') DESC, created_at LIMIT 1`)).rows[0];
    if (!row) throw new Error('Admin akkaunt topilmadi');
    return { id: row.id };
}

async function readEskizBalance() {
    const r = await eskiz.getBalance();
    const b = Number(r?.data?.balance ?? r?.balance);
    if (!Number.isFinite(b)) throw new Error('Eskiz balansini o‘qib bo‘lmadi');
    return Math.round(b);
}

// Hisob bo'lmasa — shu kungi haqiqiy Eskiz balansi bilan ochiladi (boshlang'ich qoldiq).
async function ensureAccount(pool, finance, day, balance) {
    return finance.ensureSystemAccount(pool, { id: ACCOUNT_ID, entity: 'russian', name: 'Eskiz balansi (SMS)', kind: 'wallet', openingBalance: balance, openingDate: day });
}

// Oraliqdagi to'ldirishlar: Eskiz hisobiga kirgan pul (kapital, o'tkazma, boshqa kirim), bekor qilinganlarsiz.
async function topupsBetween(pool, from, to) {
    return Number((await pool.query(`SELECT COALESCE(SUM(CASE WHEN t.to_account_id=$1 THEN t.amount WHEN t.account_id=$1 AND t.type IN ('capital','income','loan_in') THEN t.amount ELSE 0 END),0)::bigint AS n
        FROM fin_transactions t WHERE (t.to_account_id=$1 OR t.account_id=$1) AND t.txn_date > $2 AND t.txn_date <= $3 AND t.reverses_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM fin_transactions r WHERE r.reverses_id=t.id)`, [ACCOUNT_ID, from, to])).rows[0].n);
}

// O'tgan kun(lar) xarajatini yozish. force=true — vaqt cheklovisiz (sinov/qo'lda ishga tushirish).
async function runDaily(pool, { force = false } = {}) {
    const now = tkNow();
    if (!force && now.getUTCHours() === 0 && now.getUTCMinutes() < 10) return { skipped: 'too-early' };
    const finance = require('./finance');
    const day = tkDay(-1); // yopiladigan kun — kecha
    const last = (await pool.query("SELECT TO_CHAR(day,'YYYY-MM-DD') AS day, balance FROM eskiz_sms_snapshots ORDER BY day DESC LIMIT 1")).rows[0];
    if (last && last.day >= day) return { skipped: 'done' };
    let balance;
    try { balance = await readEskizBalance(); }
    catch (err) {
        await setState(pool, { apiError: { at: new Date().toISOString(), message: String(err.message).slice(0, 200) } });
        return { error: err.message };
    }
    await setState(pool, { apiError: null, live: { balance, at: new Date().toISOString() } });
    if (!last) {
        // Birinchi o'qish: hisob ochiladi, xarajat yozilmaydi (bundan oldingi SMS'lar eski davrga tegishli).
        await ensureAccount(pool, finance, day, balance);
        await pool.query('INSERT INTO eskiz_sms_snapshots(day,balance) VALUES($1,$2) ON CONFLICT(day) DO NOTHING', [day, balance]);
        await setState(pool, { unrecorded: null });
        return { opened: true, balance };
    }
    await ensureAccount(pool, finance, last.day, Number(last.balance));
    const topups = await topupsBetween(pool, last.day, day);
    const spent = Number(last.balance) + topups - balance;
    if (spent < 0) {
        // Balans oshgan, lekin to'ldirish Moliya'ga kiritilmagan — kun yopilmaydi, kiritilgach keyingi urinishda yoziladi.
        await setState(pool, { unrecorded: { amount: -spent, since: last.day, day } });
        return { unrecorded: -spent };
    }
    await setState(pool, { unrecorded: null });
    let txId = null;
    if (spent > 0) {
        const days = Math.round((Date.parse(day) - Date.parse(last.day)) / 86400000);
        const actor = await systemActor(pool);
        try {
            const r = await finance.withTransaction(pool, db => finance.createTransactionIn(db, actor, {
                requestKey: 'eskiz-sms-day-' + day, type: 'expense', categoryCode: 'MKT_SMS', entity: 'russian', date: day,
                amount: spent, accountId: ACCOUNT_ID, counterparty: 'Eskiz',
                description: days > 1 ? `SMS xizmati: ${days} kun (${last.day} dan keyin)` : 'SMS xizmati: 1 kun'
            }, { auto: true }));
            txId = r.id;
        } catch (err) {
            await setState(pool, { writeError: { at: new Date().toISOString(), message: String(err.message).slice(0, 200), day } });
            return { error: err.message };
        }
    }
    await setState(pool, { writeError: null });
    await pool.query('INSERT INTO eskiz_sms_snapshots(day,balance,spent,topups,transaction_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(day) DO NOTHING', [day, balance, spent, topups, txId]);
    await maybeAlertLow(pool, balance);
    return { day, spent, topups, balance };
}

// So'nggi 7 yozilgan kun bo'yicha kunlik o'rtacha va "necha kunga yetadi".
async function runway(pool, balance) {
    const rows = (await pool.query("SELECT spent, TO_CHAR(day,'YYYY-MM-DD') AS day FROM eskiz_sms_snapshots WHERE spent > 0 ORDER BY day DESC LIMIT 7")).rows;
    if (!rows.length) return { avgDaily: 0, daysLeft: null };
    const avg = Math.round(rows.reduce((n, r) => n + Number(r.spent), 0) / rows.length);
    return { avgDaily: avg, daysLeft: avg > 0 ? Math.max(0, Math.floor(balance / avg)) : null };
}

async function maybeAlertLow(pool, balance) {
    const { avgDaily, daysLeft } = await runway(pool, balance);
    if (daysLeft == null || daysLeft >= 3) return;
    try {
        const ls = require('./leadStageSms');
        // Telegram'ga kuniga bir marta (alertAdmin o'zi 6 soatlik kalit bilan takrorni to'xtatadi).
        await ls.alertAdmin('low', `Eskiz balansi: ${fmt(balance)} so‘m, kuniga ~${fmt(avgDaily)} — taxminan ${daysLeft} kunga yetadi. Moliya › Kassa › Eskiz balansi › To‘ldirish.`);
    } catch { /* bot ulanmagan bo'lsa jim */ }
}

// Moliya ekrani uchun holat: hisob, kunlik o'rtacha, muammolar, SMS xarajati kunlari.
async function status(pool, actor, q = {}) {
    const user = await require('./inflow').access(pool, actor);
    if (!user.finance) throw Object.assign(new Error('Moliya bo‘limiga ruxsat yo‘q'), { status: 403 });
    const st = await getState(pool);
    const acc = (await pool.query('SELECT id FROM fin_accounts WHERE id=$1', [ACCOUNT_ID])).rows[0];
    const last = (await pool.query("SELECT TO_CHAR(day,'YYYY-MM-DD') AS day, balance FROM eskiz_sms_snapshots ORDER BY day DESC LIMIT 1")).rows[0];
    const bookBalance = last ? Number(last.balance) : null;
    const { avgDaily, daysLeft } = bookBalance == null ? { avgDaily: 0, daysLeft: null } : await runway(pool, bookBalance);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(q.start || '') ? q.start : tkDay(-30);
    const end = /^\d{4}-\d{2}-\d{2}$/.test(q.end || '') ? q.end : tkDay(0);
    const days = (await pool.query(`SELECT TO_CHAR(day,'YYYY-MM-DD') AS day, spent, topups, balance FROM eskiz_sms_snapshots WHERE day BETWEEN $1 AND $2 AND spent > 0 ORDER BY day DESC`, [start, end])).rows
        .map(r => ({ day: r.day, spent: Number(r.spent), topups: Number(r.topups), balance: Number(r.balance) }));
    const problems = [];
    if (daysLeft != null && daysLeft < 3) problems.push({ key: 'low', balance: bookBalance, avgDaily, daysLeft });
    if (st.unrecorded) problems.push({ key: 'unrecorded', ...st.unrecorded });
    if (st.apiError) problems.push({ key: 'api', ...st.apiError });
    if (st.writeError) problems.push({ key: 'write', ...st.writeError });
    return { accountId: acc ? ACCOUNT_ID : null, balance: bookBalance, lastDay: last?.day || null, live: st.live || null, avgDaily, daysLeft, days, problems };
}

let timer = null;
function start(pool) {
    if (timer || process.env.NODE_ENV === 'test') return;
    const tick = () => runDaily(pool).catch(e => console.warn('[eskiz-moliya]', e.message));
    timer = setInterval(tick, 15 * 60000); timer.unref?.();
    setTimeout(tick, 90 * 1000).unref?.();
}

module.exports = { ACCOUNT_ID, SCHEMA, initSchema, runDaily, status, start, topupsBetween, runway };
