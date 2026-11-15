// Investor moduli (15-noyabr, Moliya D dizayn): ulush sozlamalari, oylik hisob (yopilgan oy — yakuniy, joriy — taxminiy),
// to'lovlar (to'liq/qisman), tuzatish/bekor qilish (teskari yozuv, tarix saqlanadi) va investorning faqat-ko'rish kabineti.
// Asos — "Qolgan pul" (tushum − hisoblangan oylik − xarajat), finance.periodFigures bilan bir manbadan.
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const F = require('../../js/financeEngine');
const finance = require('./finance');

const error = (status, message) => Object.assign(new Error(message), { status });
const DIRECTOR_ROLES = ['admin', 'boshliq'];
const BASES = { before_tax: 'Qolgan pul (soliqdan oldin)', after_tax: 'Qolgan pul (soliqdan keyin)' };
const ENTITIES = ['russian', 'english', 'all'];
const MAIN = 'main';
const text = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const isMonth = v => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v || ''));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS investors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    user_id TEXT,
    share_pct NUMERIC(5,2) NOT NULL DEFAULT 30 CHECK (share_pct >= 0 AND share_pct <= 100),
    start_month TEXT NOT NULL DEFAULT '2026-09',
    term_months INTEGER NOT NULL DEFAULT 18 CHECK (term_months BETWEEN 1 AND 120),
    basis TEXT NOT NULL DEFAULT 'before_tax',
    entity TEXT NOT NULL DEFAULT 'russian',
    revision INTEGER NOT NULL DEFAULT 0,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Yopilgan oy natijasi: Moliya oyni yopganda yoziladi (faqat qo'shiladi). Oy qayta ochilib yana yopilsa — yangi qator,
-- amaldagisi — shu oyning eng oxirgi qatori.
CREATE TABLE IF NOT EXISTS investor_months (
    id BIGSERIAL PRIMARY KEY,
    investor_id TEXT NOT NULL REFERENCES investors(id),
    month TEXT NOT NULL,
    revenue BIGINT NOT NULL, payroll BIGINT NOT NULL, expenses BIGINT NOT NULL, taxes BIGINT NOT NULL,
    remaining BIGINT NOT NULL, base BIGINT NOT NULL, share BIGINT NOT NULL CHECK (share >= 0),
    share_pct NUMERIC(5,2) NOT NULL, basis TEXT NOT NULL, groups JSONB NOT NULL DEFAULT '[]',
    closed_on DATE, closed_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS investor_months_month ON investor_months(investor_id, month, id);
-- To'lovlar: tuzatish/bekor qilish — teskari yozuv (reverses_id), asl yozuv o'chmaydi.
CREATE TABLE IF NOT EXISTS investor_payments (
    id TEXT PRIMARY KEY,
    investor_id TEXT NOT NULL REFERENCES investors(id),
    month TEXT NOT NULL,
    amount BIGINT NOT NULL CHECK (amount > 0),
    paid_date DATE NOT NULL,
    method TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    reverses_id TEXT UNIQUE REFERENCES investor_payments(id),
    reason TEXT NOT NULL DEFAULT '',
    actor_id TEXT, actor_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS investor_audit (
    id BIGSERIAL PRIMARY KEY,
    investor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    before JSONB, after JSONB,
    actor_id TEXT, actor_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Trigger yo'q: moliya yaxlitlik nazorati bazadagi har qanday begona triggerni buzilish deb hisoblaydi.
-- O'zgarmaslik kod darajasida: bu modul investor_months / investor_payments jadvallariga faqat INSERT qiladi.
`;

async function initSchema(pool) {
    await pool.query(SCHEMA);
    // To'lov kassadan chiqim (OWNER_OUT) bilan bog'lanadi: finance.createTransaction yozuvi.
    await pool.query('ALTER TABLE investor_payments ADD COLUMN IF NOT EXISTS cash_txn_id TEXT');
    await pool.query(`INSERT INTO investors(id) VALUES($1) ON CONFLICT(id) DO NOTHING`, [MAIN]);
}

async function actorOf(db, actor) {
    const u = (await db.query(`SELECT u.id,u.name,u.role,he.department FROM users u LEFT JOIN hr_employees he ON LOWER(TRIM(he.login))=LOWER(TRIM(u.email)) WHERE u.id=$1`, [actor.id])).rows[0];
    if (!u) throw error(403, 'Akkaunt topilmadi');
    const finance = ['admin', 'boshliq', 'finance', 'accountant'].includes(u.role) || (u.role === 'employee' && ['finance', 'moliya'].includes(String(u.department).toLowerCase()));
    return { ...u, director: DIRECTOR_ROLES.includes(u.role), finance };
}
function settingsDto(r) {
    return { id: r.id, name: r.name, userId: r.user_id || null, sharePct: Number(r.share_pct), startMonth: r.start_month, termMonths: Number(r.term_months),
        basis: r.basis, basisLabel: BASES[r.basis] || r.basis, entity: r.entity, revision: Number(r.revision) };
}
// Rahbar — hammasi; investor roli — faqat o'ziga biriktirilgan yozuv (faqat ko'rish).
async function access(db, actor, { write = false } = {}) {
    const user = await actorOf(db, actor);
    const row = (await db.query('SELECT * FROM investors WHERE id=$1', [MAIN])).rows[0];
    if (!row) throw error(404, 'Investor sozlanmagan');
    if (user.director) return { user, inv: settingsDto(row) };
    // Moliyachi (egasi qarori, 15-noyabr): investor bo'limini to'liq ko'radi; o'zgartirish — faqat rahbar.
    if (!write && user.finance) return { user, inv: settingsDto(row) };
    if (!write && user.role === 'investor' && row.user_id === user.id) return { user, inv: settingsDto(row) };
    throw error(403, write ? 'Bu amal faqat rahbar (admin/boshliq) uchun' : 'Investor bo‘limiga ruxsat yo‘q');
}
async function audit(db, user, action, before, after) {
    await db.query('INSERT INTO investor_audit(investor_id,action,before,after,actor_id,actor_name) VALUES($1,$2,$3,$4,$5,$6)',
        [MAIN, action, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after), user.id, user.name]);
}
async function tx(pool, fn) {
    const db = await pool.connect();
    try {
        await db.query('BEGIN');
        await db.query("SELECT pg_advisory_xact_lock(hashtext('fin-investor'))");
        const r = await fn(db);
        await db.query('COMMIT');
        return r;
    } catch (e) {
        await db.query('ROLLBACK').catch(() => {});
        throw e;
    } finally { db.release(); }
}

const monthList = inv => Array.from({ length: inv.termMonths }, (_, i) => F.monthOf(F.addMonths(inv.startMonth + '-01', i)));
const shareOf = (base, pct) => Math.max(0, Math.round(base * pct / 100));
function figuresRow(f, inv) {
    const base = inv.basis === 'after_tax' ? f.remaining.amount : f.remaining.beforeTax;
    return { revenue: f.split.net, refunds: f.split.refunds, payroll: f.payroll.accrued, expenses: f.expenses.total, taxes: f.expenses.taxes, remaining: f.remaining.amount, base,
        share: shareOf(base, inv.sharePct), sharePct: inv.sharePct, basis: inv.basis,
        groups: f.payroll.groups.map(g => ({ key: g.key, label: g.label, accrued: g.accrued, paid: g.paid, count: g.count })),
        expenseCategories: f.expenses.byCategory };
}
const snapRow = r => ({ revenue: Number(r.revenue), payroll: Number(r.payroll), expenses: Number(r.expenses), taxes: Number(r.taxes), remaining: Number(r.remaining),
    base: Number(r.base), share: Number(r.share), sharePct: Number(r.share_pct), basis: r.basis, groups: r.groups || [], closedOn: r.closed_on ? F.date(r.closed_on instanceof Date ? r.closed_on.toISOString() : r.closed_on) : '', closedBy: r.closed_by || '' });

// Oylar jadvali: yopilgan oy — Moliya oy yopganda yozilgan yakuniy natija (snapshotMonth); ochiq oylar — joriy hisob (taxminiy);
// kelajak — bo'sh. GET hech narsa yozmaydi. Yopilgan, lekin yozuvi yo'q oy (eski yopilgan oylar) — joriy hisobdan ko'rsatiladi.
async function loadAll(pool, inv) {
    const db = await pool.connect();
    try {
        await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const data = await finance.load(db);
        const snaps = new Map((await db.query('SELECT DISTINCT ON (month) * FROM investor_months WHERE investor_id=$1 ORDER BY month, id DESC', [MAIN])).rows.map(r => [r.month, r]));
        const locks = new Map((await db.query("SELECT month, locked_by_name, TO_CHAR((locked_at AT TIME ZONE 'Asia/Tashkent')::date,'YYYY-MM-DD') AS d FROM fin_period_locks")).rows.map(r => [r.month, r]));
        // Yozuvi yo'q oylar shu bir nusxa (shu ulanish, REPEATABLE READ) ichida ketma-ket hisoblanadi — maosh ham, xarajat ham.
        const current = F.monthOf(F.today()), through = data.closedThrough || '';
        const computed = new Map();
        for (const m of monthList(inv)) if (m <= current && !(through && m <= through && snaps.get(m))) computed.set(m, await monthFigures(pool, data, inv, m, db));
        const payments = (await db.query(`SELECT id,month,amount,TO_CHAR(paid_date,'YYYY-MM-DD') AS d,method,note,reverses_id,reason,actor_name,created_at,cash_txn_id FROM investor_payments WHERE investor_id=$1 ORDER BY created_at, id`, [MAIN])).rows
            .map(p => ({ id: p.id, month: p.month, amount: Number(p.amount), date: p.d, method: p.method, note: p.note, reversesId: p.reverses_id, reason: p.reason, actorName: p.actor_name, createdAt: p.created_at, cashId: p.cash_txn_id }));
        await db.query('COMMIT');
        return { data, snaps, payments, computed, locks };
    } catch (e) { await db.query('ROLLBACK').catch(() => {}); throw e; } finally { db.release(); }
}
async function monthFigures(pool, data, inv, m, db = null) {
    const today = F.today(), current = F.monthOf(today);
    return figuresRow(await finance.periodFigures(pool, data, { start: m + '-01', end: m === current ? today : F.monthEnd(m), scope: inv.entity, basis: 'cash' }, { db }), inv);
}
async function months(pool, inv) {
    const { data, snaps, payments, computed, locks } = await loadAll(pool, inv);
    const reversed = new Set(payments.filter(p => p.reversesId).map(p => p.reversesId));
    for (const p of payments) p.reversed = reversed.has(p.id);
    const current = F.monthOf(F.today()), closedThrough = data.closedThrough || '';
    // Yozuvi yo'q oylar loadAll ichida (bitta ulanish, bitta REPEATABLE READ nusxa) hisoblangan.
    const list = monthList(inv), isClosed = m => !!closedThrough && m <= closedThrough;
    const rows = [];
    for (const m of list) {
        const paid = payments.filter(p => p.month === m).reduce((n, p) => n + (p.reversesId ? -1 : 1) * p.amount, 0);
        if (m > current) { rows.push({ month: m, status: 'future', paid }); continue; }
        const closed = isClosed(m), snap = snaps.get(m);
        const fig = closed && snap ? snapRow(snap) : { ...computed.get(m), ...(closed && locks.get(m) ? { closedOn: locks.get(m).d, closedBy: locks.get(m).locked_by_name } : {}) };
        const status = closed ? 'final' : m === current ? 'estimate_open' : 'estimate_unclosed';
        // Oy qayta yopilib ulush kamaygan bo'lsa — ortiqcha to'langan summa ko'rsatiladi (yashirilmaydi), Muammolar'da chiqadi.
        rows.push({ month: m, status, ...fig, paid, due: closed ? Math.max(0, fig.share - paid) : 0, overpaid: closed ? Math.max(0, paid - fig.share) : 0,
            payState: !closed ? null : paid > fig.share ? 'overpaid' : fig.share === 0 ? 'none' : paid >= fig.share ? 'paid' : paid > 0 ? 'partial' : 'unpaid' });
    }
    const finalRows = rows.filter(r => r.status === 'final');
    const totals = {
        finalShare: finalRows.reduce((n, r) => n + r.share, 0),
        withEstimate: rows.filter(r => r.status !== 'future').reduce((n, r) => n + (r.share || 0), 0),
        paid: payments.reduce((n, p) => n + (p.reversesId ? -1 : 1) * p.amount, 0),
        closedCount: finalRows.length, elapsed: rows.filter(r => r.status !== 'future').length
    };
    totals.due = finalRows.reduce((n, r) => n + r.due, 0);
    totals.overpaid = finalRows.reduce((n, r) => n + r.overpaid, 0);
    return { rows, payments, totals, closedThrough };
}
// Moliya oyni yopganda (finance.lockMonth ichida, o'sha tranzaksiyada) chaqiriladi: oy natijasi muzlatiladi.
async function snapshotMonth(pool, db, data, month, closedBy) {
    if (!(await db.query("SELECT to_regclass('investor_months') AS t")).rows[0].t) return null;
    const row = (await db.query('SELECT * FROM investors WHERE id=$1', [MAIN])).rows[0];
    if (!row) return null;
    const inv = settingsDto(row);
    if (!monthList(inv).includes(month)) return null;
    const fig = await monthFigures(pool, data, inv, month, db);
    await db.query(`INSERT INTO investor_months(investor_id,month,revenue,payroll,expenses,taxes,remaining,base,share,share_pct,basis,groups,closed_on,closed_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [MAIN, month, fig.revenue, fig.payroll, fig.expenses, fig.taxes, fig.remaining, fig.base, fig.share, fig.sharePct, fig.basis, JSON.stringify(fig.groups), F.today(), closedBy || null]);
    return fig;
}
async function snapshotClosedRange(pool, db, data, through, month, closedBy) {
    if (!(await db.query("SELECT to_regclass('investor_months') AS t")).rows[0].t) return;
    const row = (await db.query('SELECT * FROM investors WHERE id=$1', [MAIN])).rows[0];
    if (!row) return;
    for (const m of monthList(settingsDto(row))) if ((!through || m > through) && m <= month) await snapshotMonth(pool, db, data, m, closedBy);
}
// Oy holati va ulushi — to'lov tranzaksiyasi ICHIDA (qulfdan keyin) o'qiladi: shu paytda oy qayta ochilsa/yopilsa ham eskirgan qiymat ishlatilmaydi.
async function monthStateIn(pool, db, inv, month) {
    if (!monthList(inv).includes(month)) return null;
    const through = (await db.query('SELECT MAX(month) AS m FROM fin_period_locks')).rows[0].m || '';
    const closed = !!through && month <= through;
    const snap = (await db.query('SELECT * FROM investor_months WHERE investor_id=$1 AND month=$2 ORDER BY id DESC LIMIT 1', [MAIN, month])).rows[0];
    const share = closed && snap ? Number(snap.share) : (await monthFigures(pool, await finance.load(db), inv, month, db)).share;
    return { closed, share };
}

function publicView(inv, m, user) {
    // Investor kabineti: xodimlar maoshi, xarajat tafsiloti va to'lov kim kiritgani ko'rinmaydi.
    // Kabinetda maosh guruhlari ham ko'rsatilmaydi — javobdan olib tashlanadi.
    const rows = m.rows.map(({ expenseCategories, groups, ...r }) => r);
    return { investor: { name: inv.name, sharePct: inv.sharePct, startMonth: inv.startMonth, termMonths: inv.termMonths, basis: inv.basis, basisLabel: BASES[inv.basis], entity: inv.entity },
        rows, totals: m.totals, closedThrough: m.closedThrough,
        payments: m.payments.filter(p => !p.reversesId && !p.reversed).map(p => ({ id: p.id, month: p.month, amount: p.amount, date: p.date, method: p.method })),
        readOnly: true, user: { role: user.role, director: false } };
}

async function view(pool, actor) {
    const { user, inv } = await (async () => { const db = await pool.connect(); try { return await access(db, actor); } finally { db.release(); } })();
    const m = await months(pool, inv);
    if (!user.director && !user.finance) return publicView(inv, m, user);
    const db = await pool.connect();
    try {
        const account = inv.userId ? (await db.query('SELECT id,name,email,role,disabled_at FROM users WHERE id=$1', [inv.userId])).rows[0] || null : null;
        const history = (await db.query('SELECT action,before,after,actor_name,created_at FROM investor_audit WHERE investor_id=$1 ORDER BY id DESC LIMIT 100', [MAIN])).rows;
        return { investor: inv, bases: BASES, rows: m.rows, payments: m.payments, totals: m.totals, closedThrough: m.closedThrough,
            account: account && { id: account.id, name: account.name, login: account.email, active: account.role === 'investor' && !account.disabled_at }, history, user: { role: user.role, director: user.director } };
    } finally { db.release(); }
}

async function monthDetail(pool, actor, month) {
    if (!isMonth(month)) throw error(400, 'Oy noto‘g‘ri');
    const all = await view(pool, actor);
    const row = all.rows.find(r => r.month === month);
    if (!row) throw error(404, 'Bu oy shartnoma muddatiga kirmaydi');
    return { investor: all.investor, row: all.readOnly ? (({ groups, expenseCategories, ...x }) => x)(row) : row, payments: all.payments.filter(p => p.month === month), readOnly: !!all.readOnly };
}

async function saveSettings(pool, actor, body) {
    return tx(pool, async db => {
        const { user, inv } = await access(db, actor, { write: true });
        if (Number(body.revision) !== inv.revision) throw error(409, 'Sozlamalar boshqa oynada o‘zgargan. Sahifani yangilang');
        const name = text(body.name, 120);
        const sharePct = Number(body.sharePct), termMonths = Number(body.termMonths);
        if (!name) throw error(400, 'Investor ismini kiriting');
        if (!Number.isFinite(sharePct) || sharePct < 0 || sharePct > 100 || Math.round(sharePct * 100) !== sharePct * 100) throw error(400, 'Ulush 0–100% oralig‘ida bo‘lsin');
        if (!isMonth(body.startMonth)) throw error(400, 'Boshlanish oyini tanlang');
        if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 120) throw error(400, 'Muddat 1–120 oy bo‘lsin');
        if (!BASES[body.basis]) throw error(400, 'Hisob asosi noto‘g‘ri');
        if (!ENTITIES.includes(body.entity)) throw error(400, 'Yo‘nalish noto‘g‘ri');
        await db.query(`UPDATE investors SET name=$2,share_pct=$3,start_month=$4,term_months=$5,basis=$6,entity=$7,revision=revision+1,updated_by=$8,updated_at=NOW() WHERE id=$1`,
            [MAIN, name, sharePct, body.startMonth, termMonths, body.basis, body.entity, user.name]);
        const after = { name, sharePct, startMonth: body.startMonth, termMonths, basis: body.basis, entity: body.entity };
        await audit(db, user, 'settings', inv, after);
        return { ok: true, revision: inv.revision + 1, note: 'Yopilgan oylar natijasi o‘zgarmaydi — yangi sozlama ochiq oylarga qo‘llanadi' };
    });
}

function paymentInput(body) {
    const amount = F.money(body.amount), date = F.date(body.paidDate);
    if (!amount) throw error(400, 'Summa musbat butun son bo‘lishi kerak');
    if (!date || date > F.today()) throw error(400, 'To‘lov sanasi noto‘g‘ri (bugundan keyin bo‘lmasin)');
    return { amount, date, method: text(body.method, 60), note: text(body.note, 300), accountId: text(body.accountId, 80), receiptUrl: text(body.receiptUrl, 300) };
}
// Kassadan chiqim (OWNER_OUT, "drawing") — investor yozuvi bilan BITTA tranzaksiyada (finance.withTransaction): yo hammasi, yo hech narsa.
function cashBody(inv, month, input) {
    if (!input.accountId) throw error(400, 'Qaysi hisobdan to‘langanini tanlang');
    return { requestKey: 'inv-' + randomUUID(), entity: inv.entity === 'all' ? 'common' : inv.entity, type: 'drawing', categoryCode: 'OWNER_OUT',
        accountId: input.accountId, amount: input.amount, date: input.date, counterparty: inv.name || 'Investor', description: `Investor ulushi · ${month}${input.note ? ' · ' + input.note : ''}`, receiptUrl: input.receiptUrl };
}
async function insertPayment(db, user, month, input, extra = {}) {
    const id = randomUUID();
    await db.query(`INSERT INTO investor_payments(id,investor_id,month,amount,paid_date,method,note,reverses_id,reason,actor_id,actor_name,cash_txn_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id, MAIN, month, input.amount, input.date, input.method, input.note, extra.reversesId || null, extra.reason || '', user.id, user.name, extra.cashId || null]);
    return id;
}
const paidSum = async (db, month) => Number((await db.query(`SELECT COALESCE(SUM(CASE WHEN reverses_id IS NULL THEN amount ELSE -amount END),0) AS n FROM investor_payments WHERE investor_id=$1 AND month=$2`, [MAIN, month])).rows[0].n);
// To'landi deb belgilash: faqat yopilgan (yakuniy) oy uchun; qisman to'lov mumkin, ulushdan oshmasin.
async function addPayment(pool, actor, body) {
    const month = String(body.month || '');
    if (!isMonth(month)) throw error(400, 'Oy noto‘g‘ri');
    const input = paymentInput(body);
    return finance.withTransaction(pool, async db => {
        await db.query("SELECT pg_advisory_xact_lock(hashtext('fin-investor'))");
        // Sozlamalar (ulush, yo'nalish) ham tranzaksiya ichida, qulfdan keyin o'qiladi.
        const { user, inv } = await access(db, actor, { write: true });
        const row = await monthStateIn(pool, db, inv, month);
        if (!row) throw error(400, 'Bu oy shartnoma muddatiga kirmaydi');
        if (!row.closed) throw error(400, 'Faqat yopilgan oy ulushini to‘lash mumkin — joriy oy taxminiy');
        const paid = await paidSum(db, month);
        if (paid + input.amount > row.share) throw error(400, `Oy ulushidan oshib ketadi: ulush ${row.share}, to‘langan ${paid}`);
        const cash = await finance.createTransactionIn(db, actor, cashBody(inv, month, input), { allowOverdraft: true });
        const id = await insertPayment(db, user, month, input, { cashId: cash.id });
        await audit(db, user, 'payment', null, { id, month, cashId: cash.id, ...input });
        return { ok: true, id, cashId: cash.id, paid: paid + input.amount, share: row.share };
    });
}
// Tuzatish / bekor qilish: investor yozuvi qulflanadi (bir vaqtdagi ikki bekor qilish — bittasi o'tadi), kassadagi chiqim storno,
// teskari yozuv va (tuzatishda) yangi chiqim + yangi yozuv — hammasi bitta tranzaksiyada.
async function reversePayment(pool, actor, id, body) {
    const reason = text(body.reason, 300);
    if (reason.length < 5) throw error(400, 'Sababni yozing (kamida 5 belgi)');
    return finance.withTransaction(pool, async db => {
        await db.query("SELECT pg_advisory_xact_lock(hashtext('fin-investor'))");
        const { user, inv } = await access(db, actor, { write: true });
        const orig = (await db.query(`SELECT *,TO_CHAR(paid_date,'YYYY-MM-DD') AS d FROM investor_payments WHERE id=$1 AND investor_id=$2 FOR UPDATE`, [id, MAIN])).rows[0];
        if (!orig) throw error(404, 'To‘lov topilmadi');
        if (orig.reverses_id) throw error(400, 'Teskari yozuvni bekor qilib bo‘lmaydi');
        if ((await db.query('SELECT 1 FROM investor_payments WHERE reverses_id=$1', [id])).rows.length) throw error(409, 'Bu to‘lov allaqachon bekor qilingan');
        const correction = body.amount != null && body.amount !== '' ? paymentInput({ amount: body.amount, paidDate: body.paidDate || orig.d, method: body.method ?? orig.method, note: body.note ?? orig.note, accountId: body.accountId, receiptUrl: body.receiptUrl }) : null;
        if (correction) {
            // Oy ulushi: yopilgan oy yozuvi yoki (yo'q bo'lsa) joriy hisob — ortiqcha to'lov tekshiruvi o'tkazib yuborilmaydi.
            const st = await monthStateIn(pool, db, inv, orig.month);
            if (!st?.closed) throw error(400, 'Oy yopilmagan — tuzatilgan to‘lov faqat yopilgan oy uchun');
            const share = st.share, paid = await paidSum(db, orig.month);
            if (paid - Number(orig.amount) + correction.amount > share) throw error(400, `Oy ulushidan oshib ketadi: ulush ${share}`);
        }
        if (orig.cash_txn_id) await finance.reverseTransactionIn(db, actor, orig.cash_txn_id, { reason: 'Investor to‘lovi bekor qilindi: ' + reason });
        const revId = await insertPayment(db, user, orig.month, { amount: Number(orig.amount), date: F.today(), method: orig.method, note: 'Bekor qilindi' }, { reversesId: id, reason });
        let newId = null;
        if (correction) {
            const cash = await finance.createTransactionIn(db, actor, cashBody(inv, orig.month, correction), { allowOverdraft: true });
            newId = await insertPayment(db, user, orig.month, correction, { reason, cashId: cash.id });
        }
        await audit(db, user, newId ? 'payment-correct' : 'payment-cancel', { id, amount: Number(orig.amount), month: orig.month }, { reversalId: revId, newId, reason });
        return { ok: true, reversalId: revId, newId };
    });
}
// Investor kabineti uchun kirish hisobi (rol "investor"). Boshqa roldagi mavjud akkauntni investorga aylantirmaydi.
async function saveAccount(pool, actor, body) {
    const name = text(body.name, 120), login = text(body.login, 120), password = String(body.password || '');
    if (!name || !login) throw error(400, 'Ism va loginni kiriting');
    if (password && password.length < 6) throw error(400, 'Parol kamida 6 belgi bo‘lsin');
    return tx(pool, async db => {
        const { user, inv } = await access(db, actor, { write: true });
        const existing = (await db.query('SELECT id,role FROM users WHERE LOWER(TRIM(email))=LOWER($1)', [login])).rows[0];
        if (existing && existing.role !== 'investor') throw error(409, 'Bu login boshqa xodimga tegishli — investor uchun alohida login kiriting');
        let id = existing?.id;
        if (!id) {
            if (!password) throw error(400, 'Yangi kirish hisobi uchun parol kiriting');
            id = randomUUID();
            await db.query('INSERT INTO users (id,name,email,password_hash,role) VALUES ($1,$2,$3,$4,$5)', [id, name, login, bcrypt.hashSync(password, 10), 'investor']);
        } else {
            await db.query('UPDATE users SET name=$2 WHERE id=$1', [id, name]);
            if (password) await db.query('UPDATE users SET password_hash=$2 WHERE id=$1', [id, bcrypt.hashSync(password, 10)]);
        }
        if (inv.userId && inv.userId !== id) await db.query("UPDATE users SET disabled_at=NOW() WHERE id=$1 AND role='investor'", [inv.userId]);
        await db.query('UPDATE investors SET user_id=$2 WHERE id=$1', [MAIN, id]);
        await audit(db, user, 'account', { userId: inv.userId }, { userId: id, login });
        const { invalidateUser } = require('../middleware/investorOnly');
        invalidateUser(id); if (inv.userId) invalidateUser(inv.userId);
        return { ok: true, userId: id };
    });
}

module.exports = { SCHEMA, BASES, snapshotMonth, snapshotClosedRange, initSchema, access, view, monthDetail, saveSettings, addPayment, reversePayment, saveAccount, months, shareOf };
