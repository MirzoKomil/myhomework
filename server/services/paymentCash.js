const L = require('../../js/paymentLedger');
const inflow = require('./inflow');
const error = (status, message) => Object.assign(new Error(message), { status });
async function initSchema(db) {
    await db.query(`CREATE TABLE IF NOT EXISTS payment_cash_decisions (
        cash_id TEXT PRIMARY KEY, decision TEXT NOT NULL CHECK(decision IN ('linked','independent')),
        record_id TEXT REFERENCES payment_records(id), snapshot TEXT NOT NULL,
        actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK((decision='linked' AND record_id IS NOT NULL) OR (decision='independent' AND record_id IS NULL))
    )`);
}
async function facts(db) {
    const rows = (await db.query(`SELECT id,lead_id,student_id,language,amount,method,
        TO_CHAR(paid_date,'YYYY-MM-DD') AS paid_date,snapshot FROM payment_records ORDER BY id`)).rows;
    const records = rows.map(r => ({ ...r.snapshot, id: r.id, leadId: r.lead_id, studentId: r.student_id, language: r.language,
        amount: Number(r.amount), method: r.method, paidDate: r.paid_date }));
    const decisions = (await db.query('SELECT * FROM payment_cash_decisions ORDER BY cash_id')).rows.map(r => ({
        cashId: r.cash_id, recordId: r.record_id, decision: r.decision, snapshot: r.snapshot }));
    return { records, decisions };
}
async function list(db, actor) {
    await inflow.access(db, actor);
    const { records, decisions } = await facts(db);
    const manual = (await db.query("SELECT data FROM json_data WHERE key='cashFlow'")).rows[0]?.data || [];
    return { manual, decisions, pending: L.projectCash(manual, records, decisions).pending };
}
async function decide(pool, actor, body) {
    if (!['linked','independent'].includes(body.decision) || !body.cashId || typeof body.snapshot !== 'string') throw error(400, 'Solishtirish qarori noto‘g‘ri');
    return inflow.transaction(pool, async db => {
        const user = await inflow.access(db, actor);
        await db.query("SELECT pg_advisory_xact_lock(hashtext('payment-cash-review'))");
        const manual = (await db.query("SELECT data FROM json_data WHERE key='cashFlow' FOR UPDATE")).rows[0]?.data || [];
        const cash = manual.find(c => c.id === body.cashId);
        if (!cash || L.stable(cash) !== body.snapshot) throw error(409, 'Kirim o‘zgargan. Yangilang va qayta solishtiring');
        const { records, decisions } = await facts(db);
        const old = decisions.find(d => d.cashId === cash.id);
        if (old) {
            if (old.snapshot === body.snapshot && old.decision === body.decision && (old.recordId || '') === (body.recordId || '')) return { duplicate: true };
            throw error(409, 'Bu kirim bo‘yicha moliya qarori allaqachon saqlangan');
        }
        const candidates = L.cashCandidates(cash, records);
        if (!candidates.length || (body.decision === 'linked' && !candidates.some(r => r.id === body.recordId))) throw error(409, 'Mos tushum topilmadi. Yangilang');
        const recordId = body.decision === 'linked' ? body.recordId : null;
        await db.query(`INSERT INTO payment_cash_decisions(cash_id,decision,record_id,snapshot,actor_id,actor_name)
            VALUES($1,$2,$3,$4,$5,$6)`, [cash.id, body.decision, recordId, body.snapshot, user.id, user.name]);
        await db.query('INSERT INTO payment_audit(record_id,action,actor_id,actor_name,data) VALUES($1,$2,$3,$4,$5)',
            [recordId || 'cash:' + cash.id, 'cash-reconciled', user.id, user.name, JSON.stringify({ cashId: cash.id, decision: body.decision, recordId, snapshot: cash })]);
        return { duplicate: false };
    });
}
// Keep archived/manual source rows even when a UI saves only the effective cash
// list. A reconciled entry cannot be rewritten by a stale bulk CRM snapshot.
async function saveCash(db, proposed) {
    if (!Array.isArray(proposed)) throw error(400, 'Cash Flow ro‘yxati noto‘g‘ri');
    const previous = (await db.query("SELECT data FROM json_data WHERE key='cashFlow' FOR UPDATE")).rows[0]?.data || [];
    const { records, decisions } = await facts(db);
    const excluded = new Set(L.projectCash(previous, records, decisions).excludedIds);
    const next = proposed.filter(r => !r.ledgerGenerated);
    if (new Set(next.map(r => r.id)).size !== next.length) throw error(400, 'Kirim ID takrorlangan');
    for (const old of previous) {
        const decision = decisions.find(d => d.cashId === old.id);
        const replacement = next.find(r => r.id === old.id);
        if (replacement && ((decision && L.stable(replacement) !== decision.snapshot)
            || (excluded.has(old.id) && L.stable(replacement) !== L.stable(old)))) throw error(409, 'Solishtirishdagi yozuvni o‘zgartirib bo‘lmaydi');
        if ((excluded.has(old.id) || decision) && !replacement) next.push(old);
    }
    await db.query("INSERT INTO json_data(key,data) VALUES('cashFlow',$1) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data", [JSON.stringify(next)]);
}
module.exports = { initSchema, facts, list, decide, saveCash };
