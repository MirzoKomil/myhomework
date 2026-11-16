'use strict';
// AI qo'ng'iroq tahlili xarajati → Moliya (Eskiz SMS kabi, Abdulloh 16-noy).
//
//  * Har bir AI chaqiruvi (Gemini matnga aylantirish, Claude baholash) javobidagi token soni bo'yicha aniq narxi
//    dollarda `ai_call_costs` jadvaliga yoziladi (taxmin emas: Google va Anthropic o'zi aytgan tokenlar × narx jadvali).
//  * "AI xizmatlari (Google, Anthropic)" — Eskiz balansi kabi alohida hisob (acc-ai-services, umumiy, elektron hamyon).
//    Google (va kreditdan oshsa Anthropic) pulni keyin kartadan yechadi: shu paytda "To'lovni yozish" — xarajat emas
//    (o'tkazma yoki ta'sischi mablag'i). Hisob qoldig'i manfiy bo'lsa — hali to'lanmagan summa.
//  * Har kuni 00:10 dan keyin (Toshkent) o'tgan kun(lar) uchun har maktab (Rus/Ingliz — qo'ng'iroq tili) bo'yicha bitta
//    "AI qo'ng'iroq tahlili" xarajati yoziladi: summa = (Gemini $ + Claude'ning oylik kreditdan oshgan qismi $) × MB kursi.
//    Xarajat va "kun yopildi" belgisi bitta tranzaksiyada (yarim yozilib qolmaydi).
//  * Claude: Anthropic Console'dagi Max tarifining oylik krediti (ANTHROPIC_MONTHLY_CREDIT_USD, standart 100). Taxmin:
//    kredit Toshkent kalendar oyi boshida yangilanadi. Kredit ichidagisi pul yechmaydi, faqat ko'rsatiladi; tugasa
//    baholash to'xtaydi — Muammolar'da ogohlantiriladi.
//  * Javob kelmagan (vaqt tugagan) chaqiruvlar narxi noma'lum — yozilmaydi (Google baribir hisoblashi mumkin, juda kam).
//  * Muammolar (faqat Moliya › Muammolar'da): kurs olinmadi; xarajat yozilmadi; Claude krediti 80% dan oshdi / tugadi.

const ACCOUNT_ID = 'acc-ai-services';
const CATEGORY = 'AI_CALLS';
const SCHEMA = `
CREATE TABLE IF NOT EXISTS ai_call_costs (
 id BIGSERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT NOW(), day DATE NOT NULL, analysis_id TEXT, provider TEXT NOT NULL,
 lang TEXT, model TEXT, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, cache_read INTEGER NOT NULL DEFAULT 0,
 cache_write INTEGER NOT NULL DEFAULT 0, usd NUMERIC(12,6) NOT NULL DEFAULT 0, priced BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS ai_call_costs_day ON ai_call_costs(day);
CREATE TABLE IF NOT EXISTS ai_cost_days (
 day DATE PRIMARY KEY, calls INTEGER NOT NULL DEFAULT 0, gemini_usd NUMERIC(12,6) NOT NULL DEFAULT 0, claude_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
 claude_paid_usd NUMERIC(12,6) NOT NULL DEFAULT 0, rate NUMERIC(12,2), amount BIGINT NOT NULL DEFAULT 0, transaction_id TEXT, parts JSONB,
 closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ai_cost_state (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE ai_call_costs ADD COLUMN IF NOT EXISTS lang TEXT;
ALTER TABLE ai_cost_days ADD COLUMN IF NOT EXISTS parts JSONB;`;

// Narxlar: $ / 1 mln token (rasmiy narx sahifalari, 2026-noyabr). Yangi model — CALL_AI_PRICES env (JSON) bilan
// qo'shiladi: {"model":{"in":2,"out":12,"cacheRead":0.2,"cacheWrite":2.5}}. Jadvalda yo'q model — eng qimmat Pro narxi
// bilan hisoblanadi (kam emas, ko'p ko'rsatilsin) va "taxminiy" deb belgilanadi.
const PRICES = {
    // Pro modellar: so'rov 200 ming tokendan oshsa (≈100+ daqiqalik yozuv) narx oshadi — "long".
    'gemini-3.1-pro-preview': { in: 2, out: 12, long: { in: 4, out: 18 } },
    'gemini-2.5-pro': { in: 1.25, out: 10, long: { in: 2.5, out: 15 } },
    'gemini-2.5-flash': { in: 1, out: 2.5 }, // audio kirish 1 $
    'gemini-3-flash-preview': { in: 1, out: 3 },
    'claude-sonnet-5-5': { in: 2, out: 10, cacheRead: 0.1, cacheWrite: 2.5 },
    'claude-sonnet-5': { in: 2, out: 10, cacheRead: 0.2, cacheWrite: 2.5 },
    'claude-opus-5-5': { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 },
};
const FALLBACK = { gemini: { in: 2, out: 12 }, claude: { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 } };

function priceOf(provider, model, env = process.env) {
    let extra = {};
    try { extra = env.CALL_AI_PRICES ? JSON.parse(env.CALL_AI_PRICES) : {}; } catch { extra = {}; }
    const p = extra[model] || PRICES[model];
    return p ? { ...p, known: true } : { ...FALLBACK[provider === 'claude' ? 'claude' : 'gemini'], known: false };
}

// Javobdagi "usage" → token soni va $ narx. Gemini: usageMetadata (thoughts ham chiqish narxida); Claude: usage.
function costOf(provider, model, usage, env = process.env) {
    const u = usage || {};
    const n = v => Math.max(0, Math.round(Number(v) || 0));
    let input = 0, output = 0, cacheRead = 0, cacheWrite = 0;
    if (provider === 'gemini') {
        input = n(u.promptTokenCount);
        output = n(u.candidatesTokenCount) + n(u.thoughtsTokenCount);
        cacheRead = n(u.cachedContentTokenCount);
        input = Math.max(0, input - cacheRead);
    } else {
        input = n(u.input_tokens); output = n(u.output_tokens);
        cacheRead = n(u.cache_read_input_tokens); cacheWrite = n(u.cache_creation_input_tokens);
    }
    let p = priceOf(provider, model, env);
    if (p.long && input + cacheRead > 200000) p = { ...p, ...p.long };
    const usd = (input * p.in + output * p.out + cacheRead * (p.cacheRead ?? p.in * 0.1) + cacheWrite * (p.cacheWrite ?? p.in * 1.25)) / 1e6;
    return { provider, model: String(model || ''), input, output, cacheRead, cacheWrite, usd: Math.round(usd * 1e6) / 1e6, priced: p.known };
}

const tkNow = () => new Date(Date.now() + 5 * 3600000);
const tkDay = (offset = 0) => new Date(tkNow().getTime() + offset * 86400000).toISOString().slice(0, 10);
const addDays = (d, k) => new Date(Date.parse(d + 'T00:00:00Z') + k * 86400000).toISOString().slice(0, 10);
const creditUsd = (env = process.env) => { const v = Number(env.ANTHROPIC_MONTHLY_CREDIT_USD); return Number.isFinite(v) && v >= 0 ? v : 100; };

async function initSchema(pool) { await pool.query(SCHEMA); }

async function setState(pool, patch) {
    await pool.query(`INSERT INTO ai_cost_state(id,data) VALUES('main',$1) ON CONFLICT(id) DO UPDATE SET data=ai_cost_state.data || $1::jsonb, updated_at=NOW()`, [JSON.stringify(patch)]);
}
async function getState(pool) { return (await pool.query("SELECT data FROM ai_cost_state WHERE id='main'")).rows[0]?.data || {}; }

// Bitta chaqiruv narxini yozish (callAi navbatidan). Xato bo'lsa tahlil to'xtamaydi — faqat log.
async function record(pool, { analysisId, provider, model, usage, lang }, env = process.env) {
    const c = costOf(provider, model, usage, env);
    if (!c.input && !c.output && !c.cacheRead && !c.cacheWrite) return c;
    await pool.query(`INSERT INTO ai_call_costs(day,analysis_id,provider,lang,model,input_tokens,output_tokens,cache_read,cache_write,usd,priced)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [tkDay(0), analysisId || null, c.provider, lang === 'english' ? 'english' : 'russian', c.model, c.input, c.output, c.cacheRead, c.cacheWrite, c.usd, c.priced]);
    return c;
}

// Markaziy bank kursi (USD). Olinmasa — oxirgi ma'lum kurs, faqat 3 kundan eski bo'lmasa; aks holda xato
// (kun yopilmaydi, Muammolar'da ko'rinadi, keyin qayta urinadi).
async function usdRate(pool, day, fetchImpl = globalThis.fetch) {
    try {
        const res = await fetchImpl(`https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/${day}/`, { signal: AbortSignal.timeout(15000) });
        if (res.ok) {
            const j = await res.json();
            const r = Number(String((Array.isArray(j) ? j[0] : j)?.Rate || '').replace(',', '.'));
            if (r > 1000) { await setState(pool, { rate: { value: r, day } }); return r; }
        }
    } catch { /* tarmoq — pastda oxirgi kurs */ }
    const last = (await getState(pool)).rate;
    if (last?.value && Math.abs(Date.parse(day) - Date.parse(last.day)) <= 3 * 86400000) return Number(last.value);
    throw new Error('Dollar kursini olib bo‘lmadi (cbu.uz)');
}

// Avtomatik yozuvlar egasi: birinchi admin (eskizFinance bilan bir xil).
async function systemActor(pool) {
    const row = (await pool.query(`SELECT id FROM users WHERE role IN ('admin','boshliq') AND disabled_at IS NULL ORDER BY (role='admin') DESC, created_at LIMIT 1`)).rows[0];
    if (!row) throw new Error('Admin akkaunt topilmadi');
    return { id: row.id };
}

// O'tgan kun(lar)ni yopish: har kun alohida yoziladi (oyma-oy Claude krediti to'g'ri hisoblanishi uchun).
async function runDaily(pool, { force = false, env = process.env, fetchImpl } = {}) {
    const now = tkNow();
    if (!force && now.getUTCHours() === 0 && now.getUTCMinutes() < 10) return { skipped: 'too-early' };
    const finance = require('./finance');
    const yesterday = tkDay(-1);
    const lastClosed = (await pool.query("SELECT TO_CHAR(MAX(day),'YYYY-MM-DD') AS d FROM ai_cost_days")).rows[0].d;
    const firstCost = (await pool.query("SELECT TO_CHAR(MIN(day),'YYYY-MM-DD') AS d FROM ai_call_costs")).rows[0].d;
    if (!firstCost) return { skipped: 'no-costs' };
    let day = lastClosed ? addDays(lastClosed, 1) : firstCost;
    const out = [];
    const credit = creditUsd(env);
    while (day <= yesterday) {
        // Qo'ng'iroq = Gemini matnga aylantirgan tahlil (e'tiroz qayta bahosi yangi qo'ng'iroq emas).
        const rows = (await pool.query(`SELECT COALESCE(lang,'russian') AS lang, COUNT(DISTINCT analysis_id) FILTER (WHERE provider='gemini')::int AS calls,
            COALESCE(SUM(usd) FILTER (WHERE provider='gemini'),0)::float AS g, COALESCE(SUM(usd) FILTER (WHERE provider='claude'),0)::float AS c
            FROM ai_call_costs WHERE day=$1 GROUP BY 1 ORDER BY 1`, [day])).rows;
        const tot = rows.reduce((a, r) => ({ calls: a.calls + r.calls, g: a.g + r.g, c: a.c + r.c }), { calls: 0, g: 0, c: 0 });
        // Claude: shu oyda shu kungacha ishlatilgan — kreditdan oshgan qismigina pul (tillar o'rtasida ulush bo'yicha).
        const before = Number((await pool.query(`SELECT COALESCE(SUM(usd),0)::float AS n FROM ai_call_costs WHERE provider='claude' AND day >= $1 AND day < $2`,
            [day.slice(0, 8) + '01', day])).rows[0].n);
        const claudePaid = Math.max(0, before + tot.c - Math.max(credit, before));
        const usd = tot.g + claudePaid;
        let rate = null;
        if (usd > 0) {
            try { rate = await usdRate(pool, day, fetchImpl); }
            catch (err) { await setState(pool, { rateError: { at: new Date().toISOString(), message: err.message, day } }); return { error: err.message, closed: out }; }
        }
        await setState(pool, { rateError: null });
        const parts = rows.map(r => {
            const paidShare = tot.c > 0 ? claudePaid * r.c / tot.c : 0;
            return { entity: r.lang, calls: r.calls, gemini: r.g, claude: r.c, claudePaid: paidShare, amount: rate ? Math.round((r.g + paidShare) * rate) : 0 };
        });
        const amount = parts.reduce((n, p) => n + p.amount, 0);
        if (amount > 0) await finance.ensureSystemAccount(pool, { id: ACCOUNT_ID, entity: 'common', name: 'AI xizmatlari (Google, Anthropic)', kind: 'wallet', openingBalance: 0, openingDate: day });
        const actor = amount > 0 ? await systemActor(pool) : null;
        try {
            // Xarajat(lar) va "kun yopildi" qatori bitta tranzaksiyada — yarim yozilib qolsa ham qayta urinish toza boshlanadi.
            await finance.withTransaction(pool, async db => {
                const ids = [];
                for (const p of parts) {
                    if (p.amount <= 0) continue;
                    const r = await finance.createTransactionIn(db, actor, {
                        requestKey: `ai-calls-day-${day}-${p.entity}`, type: 'expense', categoryCode: CATEGORY, entity: p.entity, date: day,
                        amount: p.amount, accountId: ACCOUNT_ID, counterparty: p.claudePaid > 0 ? 'Google, Anthropic' : 'Google (Gemini)',
                        description: `AI qoʻngʻiroq tahlili: ${p.calls} ta · $${(p.gemini + p.claudePaid).toFixed(2)} × ${Math.round(rate)}`,
                    }, { auto: true });
                    ids.push(r.id);
                }
                await db.query(`INSERT INTO ai_cost_days(day,calls,gemini_usd,claude_usd,claude_paid_usd,rate,amount,transaction_id,parts) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(day) DO NOTHING`,
                    [day, tot.calls, tot.g, tot.c, claudePaid, rate, amount, ids.join(',') || null, JSON.stringify(parts)]);
            });
        } catch (err) {
            await setState(pool, { writeError: { at: new Date().toISOString(), message: String(err.message).slice(0, 200), day } });
            return { error: err.message, closed: out };
        }
        await setState(pool, { writeError: null });
        out.push({ day, calls: tot.calls, gemini: tot.g, claude: tot.c, claudePaid, rate, amount, parts });
        day = addDays(day, 1);
    }
    return { closed: out };
}

// Moliya ekrani: oy bo'yicha jami, Claude krediti, kunlar, muammolar.
async function status(pool, actor, q = {}, env = process.env) {
    const user = await require('./inflow').access(pool, actor);
    if (!user.finance) throw Object.assign(new Error('Moliya bo‘limiga ruxsat yo‘q'), { status: 403 });
    const st = await getState(pool);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(q.start || '') ? q.start : tkDay(-30);
    const end = /^\d{4}-\d{2}-\d{2}$/.test(q.end || '') ? q.end : tkDay(0);
    const days = (await pool.query(`SELECT TO_CHAR(day,'YYYY-MM-DD') AS day, calls, gemini_usd::float AS gemini, claude_usd::float AS claude, claude_paid_usd::float AS "claudePaid", rate::float AS rate, amount::float AS amount
        FROM ai_cost_days WHERE day BETWEEN $1 AND $2 ORDER BY day DESC`, [start, end])).rows;
    const month = tkDay(0).slice(0, 8) + '01';
    const m = (await pool.query(`SELECT COUNT(DISTINCT analysis_id) FILTER (WHERE provider='gemini')::int AS calls, COALESCE(SUM(usd) FILTER (WHERE provider='gemini'),0)::float AS g,
        COALESCE(SUM(usd) FILTER (WHERE provider='claude'),0)::float AS c, BOOL_AND(priced) AS priced FROM ai_call_costs WHERE day >= $1`, [month])).rows[0];
    const credit = creditUsd(env);
    const acc = (await pool.query('SELECT id FROM fin_accounts WHERE id=$1', [ACCOUNT_ID])).rows[0];
    const problems = [];
    if (credit > 0 && m.c >= credit) problems.push({ key: 'credit_out', used: m.c, credit });
    else if (credit > 0 && m.c >= credit * 0.8) problems.push({ key: 'credit_low', used: m.c, credit });
    if (st.rateError) problems.push({ key: 'rate', ...st.rateError });
    if (st.writeError) problems.push({ key: 'write', ...st.writeError });
    return {
        accountId: acc ? ACCOUNT_ID : null, days, rate: st.rate?.value || null,
        month: { from: month, calls: m.calls, geminiUsd: m.g, claudeUsd: m.c, credit, priced: m.priced !== false, perCallUsd: m.calls ? (m.g + m.c) / m.calls : 0 },
        problems,
    };
}

let timer = null;
function start(pool) {
    if (timer || process.env.NODE_ENV === 'test') return;
    const tick = () => runDaily(pool).catch(e => console.warn('[ai-moliya]', e.message));
    timer = setInterval(tick, 15 * 60000); timer.unref?.();
    setTimeout(tick, 100 * 1000).unref?.();
}

module.exports = { ACCOUNT_ID, CATEGORY, SCHEMA, PRICES, initSchema, record, costOf, priceOf, runDaily, status, start, usdRate };
