// Moliya bo'limi: hisob raqamlar, xarajat/qaytarish/kapital/qarz operatsiyalari, korxona
// qarzlari, tushumlarni tuzatish (storno), oy yopish va hisobotlar.
//
// Qoidalar (barchasi serverda majburiy):
//  * Yozuvlar o'chirilmaydi va tahrirlanmaydi. Xato — storno yozuvi bilan yopiladi.
//  * Yopilgan oyga hech qanday yozuv tushmaydi (sana bo'yicha). Storno ochiq kunga yoziladi.
//  * Har bir o'zgarish fin_audit jurnaliga kim, qachon, nima qilgani bilan yoziladi.
//  * Bir so'rov ikki marta yuborilsa (internet uzilishi), request_key orqali bitta yozuv qoladi.
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const F = require('../../js/financeEngine');
const ledger = require('../../js/paymentLedger');
const inflow = require('./inflow');

const error = (status, message) => Object.assign(new Error(message), { status });
const ENTITY_VALUES = ['english', 'russian', 'common'];
const SCHEMA = `
CREATE TABLE IF NOT EXISTS fin_accounts (
 id TEXT PRIMARY KEY, entity TEXT NOT NULL CHECK(entity IN ('english','russian','common')), name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('cash','card','bank','clearing','wallet','suspense')), methods TEXT[] NOT NULL DEFAULT '{}',
 opening_balance BIGINT NOT NULL DEFAULT 0, opening_date DATE, active BOOLEAN NOT NULL DEFAULT TRUE, sort INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fin_payables (
 id TEXT PRIMARY KEY, request_key TEXT UNIQUE, entity TEXT NOT NULL CHECK(entity IN ('english','russian','common')),
 kind TEXT NOT NULL CHECK(kind IN ('bill','loan','other')), counterparty TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 category_code TEXT NOT NULL, amount BIGINT NOT NULL CHECK(amount>0 AND amount<=9007199254740991), issue_date DATE NOT NULL, due_date DATE,
 document_url TEXT NOT NULL DEFAULT '', voided_at TIMESTAMPTZ, void_reason TEXT, voided_by TEXT,
 actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fin_transactions (
 id TEXT PRIMARY KEY, request_key TEXT UNIQUE, entity TEXT NOT NULL CHECK(entity IN ('english','russian','common')),
 txn_date DATE NOT NULL, type TEXT NOT NULL CHECK(type IN ('income','expense','refund','capital','drawing','loan_in','loan_repay','transfer')),
 category_code TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES fin_accounts(id), to_account_id TEXT REFERENCES fin_accounts(id),
 amount BIGINT NOT NULL CHECK(amount>0 AND amount<=9007199254740991), counterparty TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
 receipt_url TEXT NOT NULL DEFAULT '', payable_id TEXT REFERENCES fin_payables(id), payment_record_id TEXT, salary_id TEXT,
 reverses_id TEXT UNIQUE REFERENCES fin_transactions(id), reversal_reason TEXT, legacy BOOLEAN NOT NULL DEFAULT FALSE,
 actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK((type='transfer') = (to_account_id IS NOT NULL)), CHECK(to_account_id IS NULL OR to_account_id<>account_id)
);
CREATE INDEX IF NOT EXISTS fin_transactions_salary ON fin_transactions(salary_id) WHERE salary_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fin_transactions_date ON fin_transactions(txn_date);
CREATE TABLE IF NOT EXISTS payment_record_voids (
 record_id TEXT PRIMARY KEY REFERENCES payment_records(id), void_date DATE NOT NULL, reason TEXT NOT NULL,
 evidence_url TEXT NOT NULL DEFAULT '', replaced_by TEXT, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fin_account_checks (
 id BIGSERIAL PRIMARY KEY, account_id TEXT NOT NULL REFERENCES fin_accounts(id), check_date DATE NOT NULL,
 actual_balance BIGINT NOT NULL, note TEXT NOT NULL DEFAULT '', actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fin_period_locks (
 month TEXT PRIMARY KEY CHECK(month ~ '^[0-9]{4}-[0-9]{2}$'), locked_by TEXT NOT NULL, locked_by_name TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
 locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fin_settings (id TEXT PRIMARY KEY, data JSONB NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS fin_audit (
 id BIGSERIAL PRIMARY KEY, action TEXT NOT NULL, entity_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL,
 before_data JSONB, after_data JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fin_migrations (id TEXT PRIMARY KEY, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
`;

async function initSchema(pool) {
    // Bitta ulanishda: advisory lock va unlock bir sessiyada bo'lishi shart.
    const db = typeof pool.connect === 'function' && !pool.release ? await pool.connect() : pool;
    try {
        await db.query("SELECT pg_advisory_lock(hashtext('fin-init'))");
        try {
            await db.query(SCHEMA);
            for (const [i, a] of F.DEFAULT_ACCOUNTS.entries()) {
                await db.query(`INSERT INTO fin_accounts(id,entity,name,kind,methods,sort) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,
                    [a.id, a.entity, a.name, a.kind, a.methods, i]);
            }
            await db.query(`INSERT INTO fin_settings(id,data) VALUES('main',$1) ON CONFLICT(id) DO NOTHING`, [JSON.stringify(F.DEFAULT_SETTINGS)]);
            await migrateLegacyCash(db);
        } finally { await db.query("SELECT pg_advisory_unlock(hashtext('fin-init'))"); }
    } finally { if (db !== pool) db.release(); }
}
async function transaction(pool, fn) {
    const db = await pool.connect();
    try {
        await db.query('BEGIN');
        // Barcha moliyaviy yozuvlar ketma-ket: qoldiq, oy yopish va to'lov tekshiruvlari poyga holatiga tushmaydi.
        await db.query("SELECT pg_advisory_xact_lock(hashtext('fin-write'))");
        const result = await fn(db);
        await db.query('COMMIT'); return result;
    } catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
async function read(pool, fn) {
    const db = await pool.connect();
    try { await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); const r = await fn(db); await db.query('COMMIT'); return r; }
    catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
async function access(db, actor, { admin = false } = {}) {
    const user = await inflow.access(db, actor);
    if (!user.finance) throw error(403, 'Moliya bo‘limiga ruxsat yo‘q');
    if (admin && !['admin', 'boshliq'].includes(user.role)) throw error(403, 'Bu amal faqat rahbar uchun');
    return user;
}
async function audit(db, user, action, entityId, before, after) {
    await db.query('INSERT INTO fin_audit(action,entity_id,actor_id,actor_name,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6)',
        [action, entityId, user.id || 'system', user.name || user.email || 'System', before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after)]);
}
function proofExists(url) {
    if (!ledger.receipt(url)) return false;
    const dir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '../../data');
    try { return fs.statSync(path.join(dir, 'uploads', path.basename(url))).isFile(); } catch { return false; }
}
function requireEvidence(url, label = 'Asos hujjat') {
    if (!url) return '';
    if (!ledger.receipt(url) || !proofExists(url)) throw error(400, label + ' fayli topilmadi. Qayta yuklang');
    return url;
}
const toKey = v => v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : String(v).slice(0, 10);
const text = (v, max = 500) => String(v ?? '').trim().slice(0, max);
function requestKey(value) { if (!/^[a-zA-Z0-9-]{16,80}$/.test(value || '')) throw error(400, 'So‘rov identifikatori noto‘g‘ri'); return value; }
function entity(value, allowCommon = true) {
    if (!ENTITY_VALUES.includes(value) || (!allowCommon && value === 'common')) throw error(400, 'Yo‘nalishni tanlang');
    return value;
}
function amountOf(value) { const n = F.money(value); if (!n) throw error(400, 'Summa musbat butun son bo‘lishi kerak'); return n; }
function dateOf(value, label = 'Sana') {
    const d = F.date(value); if (!d) throw error(400, label + ' noto‘g‘ri');
    if (d > F.today()) throw error(400, label + ' kelajakda bo‘lishi mumkin emas');
    return d;
}
// Oy yopish kumulyativ: "closed through" — eng oxirgi yopilgan oy va undan oldingi barcha oylar yopiq.
async function closedThrough(db) { return (await db.query('SELECT MAX(month) AS m FROM fin_period_locks')).rows[0].m || ''; }
async function isClosed(db, day) { const m = await closedThrough(db); return !!m && F.monthOf(day) <= m; }
async function assertOpen(db, day, label = 'Bu sana') {
    const m = await closedThrough(db);
    if (m && F.monthOf(day) <= m)
        throw error(409, `${label} yopilgan davrga (${m} gacha yopilgan) tushadi. Yopilgan oyga yozib bo‘lmaydi — storno/tuzatishni ochiq oy sanasi bilan kiriting`);
}
async function accountRow(db, id, label = 'Hisob raqam') {
    const row = (await db.query('SELECT * FROM fin_accounts WHERE id=$1', [id])).rows[0];
    if (!row || !row.active) throw error(400, label + ' topilmadi yoki faol emas');
    return row;
}

// ---------- Ma'lumotni yig'ish (hisobot uchun) ----------
async function load(db) {
    const toDate = v => v ? toKey(v) : '';
    const accounts = (await db.query('SELECT * FROM fin_accounts ORDER BY sort,name')).rows.map(a => ({ id: a.id, entity: a.entity, name: a.name, kind: a.kind,
        methods: a.methods || [], openingBalance: Number(a.opening_balance), openingDate: toDate(a.opening_date), active: a.active }));
    const receiptRows = (await db.query(`SELECT r.id,r.lead_id,r.student_id,r.language,r.manager_id,TO_CHAR(r.paid_date,'YYYY-MM-DD') AS paid_date,r.amount,r.method,
        r.receipt_url,r.form,r.source_key,r.snapshot,r.legacy_review,r.created_at,TO_CHAR(v.void_date,'YYYY-MM-DD') AS void_date,v.reason AS void_reason,
        l.extra_data->'paymentSurvey'->>'totalAmount' AS contract_total
        FROM payment_records r LEFT JOIN payment_record_voids v ON v.record_id=r.id LEFT JOIN leads l ON l.id=r.lead_id
        ORDER BY r.paid_date,r.created_at,r.id`)).rows;
    const firstSeen = new Set();
    const receipts = receiptRows.map(r => {
        const key = r.language + ':' + (r.lead_id || r.student_id || r.id);
        const newSale = !r.void_date && !firstSeen.has(key);
        if (!r.void_date) firstSeen.add(key);
        return { id: r.id, entity: r.language, date: r.paid_date, amount: Number(r.amount), method: r.method, receiptUrl: r.receipt_url, form: r.form,
            name: r.snapshot?.name || '', phone: r.snapshot?.phone || '', managerId: r.manager_id, managerName: r.snapshot?.managerName || '',
            leadId: r.lead_id, studentId: r.student_id, legacyReview: r.legacy_review, correction: String(r.source_key).startsWith('correction:'),
            voidDate: r.void_date || '', voidReason: r.void_reason || '', newSale, contractValue: F.money(r.contract_total) || 0 };
    });
    const transactions = (await db.query(`SELECT *,TO_CHAR(txn_date,'YYYY-MM-DD') AS d FROM fin_transactions ORDER BY txn_date,created_at`)).rows.map(t => ({
        id: t.id, entity: t.entity, date: t.d, type: t.type, categoryCode: t.category_code, accountId: t.account_id, toAccountId: t.to_account_id,
        amount: Number(t.amount), counterparty: t.counterparty, description: t.description, receiptUrl: t.receipt_url, payableId: t.payable_id,
        paymentRecordId: t.payment_record_id, salaryId: t.salary_id, reversesId: t.reverses_id, reversalReason: t.reversal_reason, legacy: t.legacy,
        actorName: t.actor_name, createdAt: t.created_at }));
    const reversed = new Set(transactions.filter(t => t.reversesId).map(t => t.reversesId));
    for (const t of transactions) t.reversed = reversed.has(t.id);
    const payables = (await db.query(`SELECT *,TO_CHAR(issue_date,'YYYY-MM-DD') AS i,TO_CHAR(due_date,'YYYY-MM-DD') AS d FROM fin_payables ORDER BY issue_date`)).rows.map(p => ({
        id: p.id, entity: p.entity, kind: p.kind, counterparty: p.counterparty, description: p.description, categoryCode: p.category_code,
        amount: Number(p.amount), issueDate: p.i, dueDate: p.d || '', documentUrl: p.document_url, voided: !!p.voided_at, voidReason: p.void_reason || '' }));
    const salaryRows = (await db.query(`SELECT s.id,s.employee_id,s.language,s.amount,s.status,TO_CHAR(s.period_start,'YYYY-MM-DD') AS ps,TO_CHAR(s.period_end,'YYYY-MM-DD') AS pe,
        s.paid_at,he.name,he.role FROM salary_transactions s LEFT JOIN hr_employees he ON he.id=s.employee_id ORDER BY s.period_end`).catch(() => ({ rows: [] }))).rows;
    const roleCategory = role => {
        const r = String(role || '').toLowerCase();
        if (['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi', 'asosiy', 'yordamchi'].includes(r)) return 'COS_TEACHERS';
        if (['sotuv-menejeri', 'sotuv_menejeri', 'sotuv menejeri', 'sales_manager', 'rop'].includes(r)) return 'PAY_SALES';
        return 'PAY_ADMIN';
    };
    const salaries = salaryRows.map(s => ({ id: s.id, entity: s.language, employeeId: s.employee_id, employeeName: s.name || s.employee_id, role: s.role || '',
        amount: Number(s.amount), status: s.status, periodStart: s.ps, periodEnd: s.pe, accrualDate: s.pe, categoryCode: roleCategory(s.role), paidAt: s.paid_at }));
    const studentRows = (await db.query(`SELECT id,name,phone,subject,extra_data FROM students`)).rows;
    const receivables = studentRows.map(s => {
        const x = s.extra_data || {};
        return { studentId: s.id, entity: s.subject === 'russian' ? 'russian' : 'english', name: s.name, phone: s.phone, debt: F.money(x.debtAmount) || 0,
            dueDate: x.paymentDueDate || '', status: x.status || '', frozen: !!x.frozen, managerId: x.managerId || '', managerName: x.managerName || '', leadId: x.leadRef?.id || '' };
    }).filter((r, i) => r.debt > 0 && !(studentRows[i].extra_data || {}).isStaffDemo);
    const accountChecks = (await db.query(`SELECT account_id,TO_CHAR(check_date,'YYYY-MM-DD') AS d,actual_balance,note,actor_name,created_at FROM fin_account_checks ORDER BY check_date,created_at`)).rows
        .map(c => ({ accountId: c.account_id, date: c.d, actualBalance: Number(c.actual_balance), note: c.note, actorName: c.actor_name, createdAt: c.created_at }));
    const settingsRow = (await db.query("SELECT data,revision FROM fin_settings WHERE id='main'")).rows[0];
    const settings = { ...F.DEFAULT_SETTINGS, ...(settingsRow?.data || {}) };
    const locks = (await db.query("SELECT month,locked_by_name,note,locked_at FROM fin_period_locks ORDER BY month")).rows;
    return { accounts, receipts, transactions, payables, salaries, receivables, accountChecks, settings, settingsRevision: settingsRow?.revision || 1, locks,
        closedThrough: locks.map(l => l.month).sort().at(-1) || '' };
}

function period(q) {
    const end = F.date(q.end) || F.today();
    const start = F.date(q.start) || F.monthOf(end) + '-01';
    if (start > end) throw error(400, 'Boshlanish sanasi tugash sanasidan keyin bo‘lmasligi kerak');
    const scope = ['english', 'russian', 'all'].includes(q.scope) ? q.scope : 'all';
    const basis = q.basis === 'accrual' ? 'accrual' : 'cash';
    return { start, end, scope, basis };
}

async function overview(pool, actor, q) {
    return read(pool, async db => {
        const user = await access(db, actor);
        const data = await load(db);
        const p = period(q);
        const monthsStart = F.monthOf(F.addMonths(p.end, -5)) + '-01';
        const paidSalaryWithoutCash = data.salaries.filter(s => s.status === 'paid' && s.amount > 0
            && !data.transactions.some(t => t.salaryId === s.id && !t.reversesId && !t.reversed));
        const suspensePending = data.receipts.filter(r => !r.voidDate && r.method === 'unknown').length;
        const quality = F.dataQuality(data.receipts, data.settings);
        const scoped = r => p.scope === 'all' || r.entity === p.scope;
        return {
            period: p, user: { role: user.role, canUnlock: ['admin', 'boshliq'].includes(user.role) },
            accounts: F.accountBalances(data, p.end, p.scope),
            balance: F.balanceSheet(data, p.end, p.scope),
            pnl: F.profitAndLoss(data, p),
            pnlOther: F.profitAndLoss(data, { ...p, basis: p.basis === 'cash' ? 'accrual' : 'cash' }),
            monthly: F.monthlyPnl(data, { start: monthsStart < p.start ? monthsStart : p.start, end: p.end, scope: p.scope, basis: p.basis }),
            cashflow: F.cashFlowStatement(data, p),
            receivables: F.receivablesAging(data.receivables, p.end, p.scope),
            payables: F.payablesSummary(data, p.end, p.scope),
            kpis: F.kpis(data, p),
            quality: { ...quality, suspicious: quality.suspicious.filter(scoped), paidSalaryWithoutCash: paidSalaryWithoutCash.filter(scoped), suspensePending,
                voidedList: data.receipts.filter(r => r.voidDate && scoped(r)) },
            settings: data.settings, settingsRevision: data.settingsRevision, locks: data.locks, closedThrough: data.closedThrough,
            accountsList: data.accounts, categories: F.CATEGORIES,
            assumptions: { courseMonths: data.settings.courseMonths, receivablesSource: 'O‘quvchi kartasidagi joriy qarz (CRM)', revenueRecognition: p.basis }
        };
    });
}
async function cashbook(pool, actor, q) {
    return read(pool, async db => {
        await access(db, actor);
        const data = await load(db), p = period(q);
        if (F.dayDiff(p.start, p.end) > 400) throw error(400, 'Kassa daftari uchun davr 400 kundan oshmasin');
        return F.cashbook(data, { start: p.start, end: p.end, account: text(q.account, 80), scope: p.scope });
    });
}
async function listTransactions(pool, actor, q) {
    return read(pool, async db => {
        await access(db, actor);
        const data = await load(db), p = period(q);
        const rows = data.transactions.filter(t => F.inRange(t.date, p.start, p.end) && (p.scope === 'all' || t.entity === p.scope));
        return { rows: rows.reverse(), accounts: data.accounts, payables: data.payables.filter(x => !x.voided), categories: F.CATEGORIES };
    });
}
async function auditLog(pool, actor, q) {
    return read(pool, async db => {
        await access(db, actor);
        const limit = Math.min(500, Math.max(1, Number(q.limit) || 100));
        const fin = (await db.query('SELECT id,action,entity_id,actor_name,before_data,after_data,created_at FROM fin_audit ORDER BY created_at DESC,id DESC LIMIT $1', [limit])).rows;
        return { rows: fin };
    });
}

// ---------- Yozish amallari ----------
async function createTransaction(pool, actor, body) {
    const key = requestKey(body.requestKey);
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const prior = (await db.query('SELECT * FROM fin_transactions WHERE request_key=$1', [key])).rows[0];
        if (prior) return { id: prior.id, duplicate: true };
        const type = body.type;
        if (!Object.hasOwn(F.TYPES, type)) throw error(400, 'Operatsiya turini tanlang');
        const cat = F.CATEGORY[body.categoryCode];
        const expectedType = type === 'expense' ? 'expense' : type;
        if (!cat || cat.type !== expectedType) throw error(400, 'Bu operatsiya turi uchun toifa noto‘g‘ri');
        let ent = entity(body.entity);
        const day = dateOf(body.date);
        await assertOpen(db, day);
        const amount = amountOf(body.amount);
        const account = await accountRow(db, body.accountId);
        let toAccount = null;
        if (type === 'transfer') toAccount = await accountRow(db, body.toAccountId, 'Qabul qiluvchi hisob');
        if (toAccount && toAccount.id === account.id) throw error(400, 'O‘tkazma bir hisobning o‘ziga bo‘lmaydi');
        const counterparty = text(body.counterparty, 200), description = text(body.description, 1000);
        if (['expense', 'refund', 'drawing', 'loan_in', 'loan_repay', 'capital'].includes(type) && !counterparty && !description) throw error(400, 'Kimga/kimdan yoki izoh kiriting');
        const receiptUrl = requireEvidence(body.receiptUrl, 'Chek');
        // Yirik chiqimlar asossiz qolmasin: 1 mln so'mdan katta xarajat uchun chek majburiy.
        if (['expense', 'refund', 'drawing'].includes(type) && amount >= 1000000 && !receiptUrl) throw error(400, '1 000 000 so‘mdan katta chiqim uchun chek yoki hujjat yuklang');
        let payableId = null, paymentRecordId = null;
        if (type === 'refund') {
            if (body.paymentRecordId) {
                const rec = (await db.query(`SELECT r.*,v.record_id AS voided FROM payment_records r LEFT JOIN payment_record_voids v ON v.record_id=r.id WHERE r.id=$1`, [body.paymentRecordId])).rows[0];
                if (!rec || rec.voided) throw error(400, 'Qaytariladigan tushum topilmadi');
                const refunded = Number((await db.query(`SELECT COALESCE(SUM(CASE WHEN reverses_id IS NULL THEN amount ELSE -amount END),0) AS n FROM fin_transactions
                    WHERE payment_record_id=$1 AND type='refund'`, [rec.id])).rows[0].n);
                if (refunded + amount > Number(rec.amount)) throw error(409, 'Qaytarish summasi tushumdan oshib ketdi');
                paymentRecordId = rec.id; ent = rec.language;
            } else if (ent === 'common') throw error(400, 'Qaytarish qaysi yo‘nalishga tegishli ekanini tanlang');
        }
        if (type === 'loan_repay' || (body.payableId && type !== 'loan_in')) {
            const p = (await db.query('SELECT * FROM fin_payables WHERE id=$1', [body.payableId])).rows[0];
            if (!p || p.voided_at) throw error(400, 'Qarz / hisob-faktura topilmadi');
            if (type === 'loan_repay' && p.kind !== 'loan') throw error(400, 'Bu yozuv qarz emas');
            const paid = Number((await db.query(`SELECT COALESCE(SUM(CASE WHEN reverses_id IS NULL THEN amount ELSE -amount END),0) AS n FROM fin_transactions WHERE payable_id=$1 AND type<>'loan_in'`, [p.id])).rows[0].n);
            if (paid + amount > Number(p.amount)) throw error(409, `To‘lov qoldiqdan oshib ketdi (qoldiq: ${Number(p.amount) - paid})`);
            payableId = p.id; ent = p.entity;
            if (type === 'expense' && p.category_code !== cat.code) throw error(400, 'Toifa hisob-faktura toifasiga mos emas');
        }
        const id = randomUUID();
        if (type === 'loan_in') {
            payableId = randomUUID();
            await db.query(`INSERT INTO fin_payables(id,entity,kind,counterparty,description,category_code,amount,issue_date,due_date,document_url,actor_id,actor_name)
                VALUES($1,$2,'loan',$3,$4,'LOAN_REPAY',$5,$6,$7,$8,$9,$10)`, [payableId, ent, counterparty || 'Qarz beruvchi', description, amount, day, F.date(body.dueDate) || null, receiptUrl, user.id, user.name]);
        }
        await db.query(`INSERT INTO fin_transactions(id,request_key,entity,txn_date,type,category_code,account_id,to_account_id,amount,counterparty,description,receipt_url,
            payable_id,payment_record_id,actor_id,actor_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
            [id, key, ent, day, type, cat.code, account.id, toAccount?.id || null, amount, counterparty, description, receiptUrl, payableId, paymentRecordId, user.id, user.name]);
        await audit(db, user, 'transaction-create', id, null, { type, category: cat.code, entity: ent, date: day, amount, account: account.id, toAccount: toAccount?.id, payableId, paymentRecordId, counterparty, description });
        return { id, duplicate: false };
    });
}
async function reverseTransaction(pool, actor, id, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const t = (await db.query('SELECT *,TO_CHAR(txn_date,\'YYYY-MM-DD\') AS d FROM fin_transactions WHERE id=$1', [id])).rows[0];
        if (!t) throw error(404, 'Operatsiya topilmadi');
        if (t.reverses_id) throw error(400, 'Storno yozuvini qayta storno qilib bo‘lmaydi');
        if ((await db.query('SELECT 1 FROM fin_transactions WHERE reverses_id=$1', [id])).rows.length) throw error(409, 'Bu operatsiya allaqachon bekor qilingan');
        const reason = text(body.reason, 500);
        if (reason.length < 5) throw error(400, 'Bekor qilish sababini yozing (kamida 5 belgi)');
        let day = F.date(body.date) || (await isClosed(db, t.d) ? F.today() : t.d);
        day = dateOf(day);
        if (day < t.d) throw error(400, 'Storno sanasi asl operatsiyadan oldin bo‘lmaydi');
        await assertOpen(db, day, 'Storno sanasi');
        if (t.type === 'loan_in') {
            const repaid = Number((await db.query(`SELECT COALESCE(SUM(CASE WHEN reverses_id IS NULL THEN amount ELSE -amount END),0) AS n FROM fin_transactions WHERE payable_id=$1 AND type='loan_repay'`, [t.payable_id])).rows[0].n);
            if (repaid > 0) throw error(409, 'Bu qarz bo‘yicha qaytarish bor. Avval qaytarishlarni bekor qiling');
            await db.query('UPDATE fin_payables SET voided_at=NOW(),void_reason=$2,voided_by=$3 WHERE id=$1', [t.payable_id, 'Olingan qarz bekor qilindi: ' + reason, user.id]);
        }
        const rid = randomUUID();
        await db.query(`INSERT INTO fin_transactions(id,entity,txn_date,type,category_code,account_id,to_account_id,amount,counterparty,description,receipt_url,payable_id,
            payment_record_id,salary_id,reverses_id,reversal_reason,actor_id,actor_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
            [rid, t.entity, day, t.type, t.category_code, t.account_id, t.to_account_id, t.amount, t.counterparty, 'STORNO: ' + reason, t.receipt_url,
                t.type === 'loan_in' ? null : t.payable_id, t.payment_record_id, t.salary_id, t.id, reason, user.id, user.name]);
        await audit(db, user, 'transaction-reverse', t.id, { amount: Number(t.amount), date: t.d, type: t.type }, { reversalId: rid, date: day, reason });
        return { id: rid };
    });
}
async function createPayable(pool, actor, body) {
    const key = requestKey(body.requestKey);
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const prior = (await db.query('SELECT id FROM fin_payables WHERE request_key=$1', [key])).rows[0];
        if (prior) return { id: prior.id, duplicate: true };
        const kind = ['bill', 'other'].includes(body.kind) ? body.kind : 'bill';
        const cat = F.CATEGORY[body.categoryCode];
        if (!cat || cat.type !== 'expense') throw error(400, 'Xarajat toifasini tanlang');
        const counterparty = text(body.counterparty, 200);
        if (!counterparty) throw error(400, 'Kimga qarzdorligimizni yozing');
        const issue = F.date(body.issueDate); if (!issue) throw error(400, 'Hujjat sanasi noto‘g‘ri');
        await assertOpen(db, issue, 'Hujjat sanasi');
        const due = body.dueDate ? F.date(body.dueDate) : null;
        if (body.dueDate && !due) throw error(400, 'To‘lov muddati noto‘g‘ri');
        if (due && due < issue) throw error(400, 'To‘lov muddati hujjat sanasidan oldin bo‘lmaydi');
        const id = randomUUID(), amount = amountOf(body.amount), ent = entity(body.entity);
        await db.query(`INSERT INTO fin_payables(id,request_key,entity,kind,counterparty,description,category_code,amount,issue_date,due_date,document_url,actor_id,actor_name)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [id, key, ent, kind, counterparty, text(body.description, 1000), cat.code, amount, issue, due,
            requireEvidence(body.documentUrl, 'Hujjat'), user.id, user.name]);
        await audit(db, user, 'payable-create', id, null, { kind, entity: ent, counterparty, category: cat.code, amount, issue, due });
        return { id, duplicate: false };
    });
}
async function voidPayable(pool, actor, id, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const p = (await db.query('SELECT *,TO_CHAR(issue_date,\'YYYY-MM-DD\') AS i FROM fin_payables WHERE id=$1', [id])).rows[0];
        if (!p || p.voided_at) throw error(404, 'Yozuv topilmadi');
        if (p.kind === 'loan') throw error(400, 'Qarzni bekor qilish uchun olingan qarz operatsiyasini storno qiling');
        const reason = text(body.reason, 500); if (reason.length < 5) throw error(400, 'Sababini yozing');
        await assertOpen(db, p.i, 'Hujjat sanasi');
        const paid = Number((await db.query(`SELECT COALESCE(SUM(CASE WHEN reverses_id IS NULL THEN amount ELSE -amount END),0) AS n FROM fin_transactions WHERE payable_id=$1 AND type<>'loan_in'`, [id])).rows[0].n);
        if (paid > 0) throw error(409, 'Bu hujjat bo‘yicha to‘lov qilingan. Avval to‘lovni storno qiling');
        await db.query('UPDATE fin_payables SET voided_at=NOW(),void_reason=$2,voided_by=$3 WHERE id=$1', [id, reason, user.id]);
        await audit(db, user, 'payable-void', id, { amount: Number(p.amount) }, { reason });
        return { ok: true };
    });
}
// Maoshlar bo'limida "to'landi" deb belgilangan hisob uchun kassadan chiqimni yozish.
async function recordSalaryPayment(pool, actor, salaryId, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const s = (await db.query(`SELECT s.*,he.name,he.role FROM salary_transactions s LEFT JOIN hr_employees he ON he.id=s.employee_id WHERE s.id=$1`, [salaryId])).rows[0];
        if (!s) throw error(404, 'Maosh hisobi topilmadi');
        if (s.status !== 'paid') throw error(409, 'Avval Maoshlar bo‘limida hisobni tasdiqlab, "To‘landi" deb belgilang');
        if (Number(s.amount) <= 0) throw error(400, 'Nol yoki manfiy maosh uchun chiqim yozilmaydi');
        const prior = (await db.query('SELECT id FROM fin_transactions WHERE salary_id=$1 AND reverses_id IS NULL AND id NOT IN (SELECT reverses_id FROM fin_transactions WHERE reverses_id IS NOT NULL)', [salaryId])).rows[0];
        if (prior) return { id: prior.id, duplicate: true };
        const day = dateOf(body.date || (s.paid_at ? new Date(s.paid_at).toISOString().slice(0, 10) : F.today()));
        await assertOpen(db, day);
        const account = await accountRow(db, body.accountId);
        const r = String(s.role || '').toLowerCase();
        const category = ['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi', 'asosiy', 'yordamchi'].includes(r) ? 'COS_TEACHERS'
            : ['sotuv-menejeri', 'sotuv_menejeri', 'sotuv menejeri', 'sales_manager', 'rop'].includes(r) ? 'PAY_SALES' : 'PAY_ADMIN';
        const id = randomUUID();
        await db.query(`INSERT INTO fin_transactions(id,entity,txn_date,type,category_code,account_id,amount,counterparty,description,salary_id,actor_id,actor_name)
            VALUES($1,$2,$3,'expense',$4,$5,$6,$7,$8,$9,$10,$11)`, [id, s.language, day, category, account.id, Number(s.amount), s.name || s.employee_id,
            `Maosh ${new Date(s.period_start).toISOString().slice(0, 10)} — ${new Date(s.period_end).toISOString().slice(0, 10)}`, salaryId, user.id, user.name]);
        await db.query('UPDATE salary_transactions SET cash_expense_id=$2 WHERE id=$1', [salaryId, id]).catch(() => {});
        await audit(db, user, 'salary-cash-out', id, null, { salaryId, amount: Number(s.amount), date: day, account: account.id });
        return { id, duplicate: false };
    });
}

// ---------- Tushumlar reyestrini tuzatish ----------
async function voidReceipt(db, user, recordId, { reason, evidenceUrl, date, replacedBy = null }) {
    const rec = (await db.query(`SELECT *,TO_CHAR(paid_date,'YYYY-MM-DD') AS d FROM payment_records WHERE id=$1 FOR UPDATE`, [recordId])).rows[0];
    if (!rec) throw error(404, 'Tushum topilmadi');
    if ((await db.query('SELECT 1 FROM payment_record_voids WHERE record_id=$1', [recordId])).rows.length) throw error(409, 'Bu tushum allaqachon bekor qilingan');
    const refunds = Number((await db.query(`SELECT COALESCE(SUM(CASE WHEN reverses_id IS NULL THEN amount ELSE -amount END),0) AS n FROM fin_transactions WHERE payment_record_id=$1`, [recordId])).rows[0].n);
    if (refunds > 0) throw error(409, 'Bu tushum bo‘yicha qaytarish yozilgan. Avval qaytarishni storno qiling');
    const day = dateOf(F.date(date) || (await isClosed(db, rec.d) ? F.today() : rec.d), 'Bekor qilish sanasi');
    if (day < rec.d) throw error(400, 'Bekor qilish sanasi tushum sanasidan oldin bo‘lmaydi');
    await assertOpen(db, day, 'Bekor qilish sanasi');
    await db.query(`INSERT INTO payment_record_voids(record_id,void_date,reason,evidence_url,replaced_by,actor_id,actor_name) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [recordId, day, reason, evidenceUrl || '', replacedBy, user.id, user.name]);
    await db.query('INSERT INTO payment_audit(record_id,action,actor_id,actor_name,data) VALUES($1,$2,$3,$4,$5)',
        [recordId, 'finance-void', user.id, user.name, JSON.stringify({ reason, evidenceUrl, voidDate: day, replacedBy })]);
    await audit(db, user, 'receipt-void', recordId, { amount: Number(rec.amount), date: rec.d, name: rec.snapshot?.name }, { reason, voidDate: day, replacedBy });
    return { recordId, voidDate: day };
}
async function voidReceipts(pool, actor, body) {
    const ids = Array.isArray(body.recordIds) ? [...new Set(body.recordIds.map(String))] : [];
    if (!ids.length || ids.length > 200) throw error(400, 'Bekor qilinadigan tushumlarni tanlang');
    const reason = text(body.reason, 500);
    if (reason.length < 5) throw error(400, 'Bekor qilish sababini yozing (kamida 5 belgi)');
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const evidenceUrl = requireEvidence(body.evidenceUrl);
        const out = [];
        for (const id of ids) out.push(await voidReceipt(db, user, id, { reason, evidenceUrl, date: body.date }));
        return { voided: out };
    });
}
// Reyestrda yo'q yoki xato kiritilgan tushumni hujjat asosida kiritish. replacesId berilsa —
// eski yozuv shu tranzaksiyada bekor qilinadi (summa yoki sana tuzatish).
async function manualReceipt(pool, actor, body) {
    const key = requestKey(body.requestKey);
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const sourceKey = 'correction:' + key;
        const prior = (await db.query('SELECT id FROM payment_records WHERE source_key=$1', [sourceKey])).rows[0];
        if (prior) return { id: prior.id, duplicate: true };
        const lang = entity(body.entity, false);
        const day = dateOf(body.date, 'To‘lov sanasi');
        await assertOpen(db, day, 'To‘lov sanasi');
        const amount = amountOf(body.amount);
        const method = ledger.method(body.method);
        if (method === 'unknown') throw error(400, 'To‘lov usulini tanlang');
        const reason = text(body.reason, 500); if (reason.length < 5) throw error(400, 'Tuzatish sababini yozing (kamida 5 belgi)');
        const evidenceUrl = requireEvidence(body.evidenceUrl);
        if (!evidenceUrl) throw error(400, 'Asos hujjatni yuklang (audit ro‘yxati, chek yoki bank ko‘chirmasi)');
        let leadId = text(body.leadId, 120) || null, studentId = text(body.studentId, 120) || null, managerId = text(body.managerId, 120), name = text(body.name, 200), phone = text(body.phone, 40);
        let replaced = null;
        if (body.replacesId) {
            replaced = (await db.query(`SELECT * FROM payment_records WHERE id=$1`, [body.replacesId])).rows[0];
            if (!replaced) throw error(404, 'Tuzatiladigan tushum topilmadi');
            if (replaced.language !== lang) throw error(400, 'Tuzatish boshqa yo‘nalishga tegishli');
            leadId = leadId || replaced.lead_id; studentId = studentId || replaced.student_id; managerId = managerId || replaced.manager_id;
            name = name || replaced.snapshot?.name || ''; phone = phone || replaced.snapshot?.phone || '';
        }
        if (!name) throw error(400, 'O‘quvchi ismini kiriting');
        const managerName = managerId ? (await db.query('SELECT name FROM hr_employees WHERE id=$1', [managerId])).rows[0]?.name || '' : '';
        const id = randomUUID();
        const form = body.form === 'full' ? 'full' : 'partial';
        await db.query(`INSERT INTO payment_records(id,source_key,lead_id,student_id,language,manager_id,teacher_id,paid_date,amount,method,receipt_url,tariff,form,debt_snapshot,snapshot,legacy_review,actor_id)
            VALUES($1,$2,$3,$4,$5,$6,'',$7,$8,$9,$10,$11,$12,0,$13,FALSE,$14)`,
            [id, sourceKey, leadId, studentId, lang, managerId || '', day, amount, method, evidenceUrl, Number(body.tariff) || replaced?.tariff || null, form,
                JSON.stringify({ name, phone, managerName, teacherName: '', nextPaymentDate: '', total: null, timeKnown: false, correction: true, reason }), user.id]);
        await db.query('INSERT INTO payment_audit(record_id,action,actor_id,actor_name,data) VALUES($1,$2,$3,$4,$5)',
            [id, 'finance-correction', user.id, user.name, JSON.stringify({ amount, date: day, method, reason, evidenceUrl, replacesId: replaced?.id || null })]);
        await audit(db, user, 'receipt-manual', id, replaced ? { id: replaced.id, amount: Number(replaced.amount) } : null, { amount, date: day, name, phone, entity: lang, reason });
        if (replaced) await voidReceipt(db, user, replaced.id, { reason: 'Tuzatildi: ' + reason, evidenceUrl, date: body.voidDate, replacedBy: id });
        return { id, duplicate: false };
    });
}
async function reconcile(pool, actor, body) {
    return read(pool, async db => {
        await access(db, actor);
        const lang = entity(body.entity, false);
        const rows = Array.isArray(body.rows) ? body.rows.slice(0, 2000) : [];
        if (!rows.length) throw error(400, 'Solishtirish uchun qatorlar yo‘q');
        const data = await load(db);
        const result = F.reconcile(rows, data.receipts.filter(r => r.entity === lang), { start: F.date(body.start), end: F.date(body.end), tolerance: Math.min(10, Math.max(0, Number(body.tolerance ?? 3))) });
        return result;
    });
}

// ---------- Sozlamalar, hisob raqamlar, oy yopish ----------
async function saveAccount(pool, actor, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const name = text(body.name, 120); if (!name) throw error(400, 'Hisob nomini kiriting');
        if (!Object.hasOwn(F.ACCOUNT_KINDS, body.kind)) throw error(400, 'Hisob turini tanlang');
        const ent = entity(body.entity);
        const methods = (Array.isArray(body.methods) ? body.methods : []).filter(m => Object.hasOwn(ledger.METHODS, m));
        const opening = body.openingBalance === '' || body.openingBalance == null ? 0 : Number(body.openingBalance);
        if (!Number.isSafeInteger(opening)) throw error(400, 'Boshlang‘ich qoldiq butun son bo‘lishi kerak');
        const openingDate = body.openingDate ? F.date(body.openingDate) : null;
        if (body.openingDate && !openingDate) throw error(400, 'Boshlang‘ich qoldiq sanasi noto‘g‘ri');
        const existing = body.id ? (await db.query('SELECT * FROM fin_accounts WHERE id=$1', [body.id])).rows[0] : null;
        if (body.id && !existing) throw error(404, 'Hisob topilmadi');
        // Usul faqat bitta faol hisobga biriktiriladi (bir yo'nalish ichida) — aks holda tushum qayerga tushishi noaniq bo'ladi.
        const clash = (await db.query(`SELECT name FROM fin_accounts WHERE active AND id<>$1 AND entity=$2 AND methods && $3::text[]`, [existing?.id || '', ent, methods])).rows[0];
        if (clash && body.active !== false) throw error(409, `Tanlangan to‘lov usuli "${clash.name}" hisobiga biriktirilgan`);
        if (existing) {
            const openingChanged = Number(existing.opening_balance) !== opening || (existing.opening_date ? toKey(existing.opening_date) : null) !== openingDate;
            if (openingChanged) {
                const prevDate = existing.opening_date ? toKey(existing.opening_date) : null;
                const od = [openingDate, prevDate].filter(Boolean).sort()[0];
                if (od && await isClosed(db, od)) throw error(409, 'Boshlang‘ich qoldiq yopilgan oylarga ta’sir qiladi. Avval oylarni oching (rahbar)');
            }
            await db.query(`UPDATE fin_accounts SET name=$2,kind=$3,entity=$4,methods=$5,opening_balance=$6,opening_date=$7,active=$8,updated_at=NOW() WHERE id=$1`,
                [existing.id, name, body.kind, ent, methods, opening, openingDate, body.active !== false]);
            await audit(db, user, 'account-update', existing.id, { name: existing.name, opening: Number(existing.opening_balance), openingDate: existing.opening_date, methods: existing.methods, active: existing.active },
                { name, opening, openingDate, methods, active: body.active !== false });
            return { id: existing.id };
        }
        const id = 'acc-' + randomUUID().slice(0, 8);
        await db.query(`INSERT INTO fin_accounts(id,entity,name,kind,methods,opening_balance,opening_date,sort) VALUES($1,$2,$3,$4,$5,$6,$7,100)`, [id, ent, name, body.kind, methods, opening, openingDate]);
        await audit(db, user, 'account-create', id, null, { name, kind: body.kind, entity: ent, methods, opening, openingDate });
        return { id };
    });
}
async function addAccountCheck(pool, actor, accountId, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor);
        await accountRow(db, accountId);
        const day = dateOf(body.date, 'Tekshiruv sanasi');
        const actual = Number(body.actualBalance);
        if (!Number.isSafeInteger(actual)) throw error(400, 'Haqiqiy qoldiqni butun son bilan kiriting');
        await db.query('INSERT INTO fin_account_checks(account_id,check_date,actual_balance,note,actor_id,actor_name) VALUES($1,$2,$3,$4,$5,$6)', [accountId, day, actual, text(body.note, 500), user.id, user.name]);
        await audit(db, user, 'account-check', accountId, null, { date: day, actual, note: text(body.note, 500) });
        return { ok: true };
    });
}
async function lockMonth(pool, actor, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const month = String(body.month || '');
        if (!/^\d{4}-\d{2}$/.test(month) || !F.date(month + '-01')) throw error(400, 'Oy noto‘g‘ri');
        const through = await closedThrough(db);
        if (body.locked === false) {
            await access(db, actor, { admin: true });
            const reason = text(body.note, 500); if (reason.length < 5) throw error(400, 'Oyni qayta ochish sababini yozing');
            if (month !== through) throw error(409, through ? `Faqat oxirgi yopilgan oyni (${through}) qayta ochish mumkin` : 'Yopilgan oy yo‘q');
            const r = await db.query('DELETE FROM fin_period_locks WHERE month=$1 RETURNING month,locked_by_name,note', [month]);
            await audit(db, user, 'period-unlock', month, r.rows[0], { reason });
            return { ok: true, closedThrough: await closedThrough(db) };
        }
        if (F.monthEnd(month) >= F.today()) throw error(400, 'Faqat tugagan oyni yopish mumkin');
        if (through && month <= through) return { ok: true, alreadyLocked: true, closedThrough: through };
        await db.query('INSERT INTO fin_period_locks(month,locked_by,locked_by_name,note) VALUES($1,$2,$3,$4)', [month, user.id, user.name, text(body.note, 500)]);
        await audit(db, user, 'period-lock', month, { closedThrough: through }, { closedThrough: month, note: text(body.note, 500) });
        return { ok: true, closedThrough: month };
    });
}
async function saveSettings(pool, actor, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const row = (await db.query("SELECT data,revision FROM fin_settings WHERE id='main' FOR UPDATE")).rows[0];
        if (Number(body.revision) !== row.revision) throw error(409, 'Sozlamalarni boshqa foydalanuvchi o‘zgartirgan. Sahifani yangilang');
        const cm = body.data?.courseMonths || {};
        const months = v => { const n = Number(v); if (!Number.isInteger(n) || n < 1 || n > 24) throw error(400, 'Kurs davomiyligi 1–24 oy oralig‘ida bo‘lsin'); return n; };
        const min = Number(body.data?.suspiciousMin ?? row.data.suspiciousMin ?? 10000);
        if (!Number.isSafeInteger(min) || min < 0) throw error(400, 'Shubhali summa chegarasi noto‘g‘ri');
        const data = { ...row.data, courseMonths: { english: months(cm.english ?? 3), russian: months(cm.russian ?? 3) }, suspiciousMin: min };
        await db.query("UPDATE fin_settings SET data=$1,revision=revision+1,updated_at=NOW() WHERE id='main'", [JSON.stringify(data)]);
        await audit(db, user, 'settings-update', 'main', row.data, data);
        return { revision: row.revision + 1 };
    });
}

// Eski "Cash Flow" (json) qo'lda kiritilgan yozuvlari bir marta, belgilangan holda ko'chiriladi —
// hech narsa jimgina yo'qolmaydi, lekin "Eski — tekshiring" deb ko'rinadi.
async function migrateLegacyCash(db) {
    if ((await db.query("SELECT 1 FROM fin_migrations WHERE id='legacy-cashflow-v1'")).rows.length) return;
    const hasRecords = (await db.query("SELECT to_regclass('payment_records') AS t")).rows[0].t;
    const manual = (await db.query("SELECT data FROM json_data WHERE key='cashFlow'").catch(() => ({ rows: [] }))).rows[0]?.data || [];
    let decisions = [], records = [];
    if (hasRecords) {
        decisions = (await db.query('SELECT * FROM payment_cash_decisions').catch(() => ({ rows: [] }))).rows.map(r => ({ cashId: r.cash_id, recordId: r.record_id, decision: r.decision, snapshot: r.snapshot }));
        records = (await db.query(`SELECT id,lead_id,student_id,language,amount,method,TO_CHAR(paid_date,'YYYY-MM-DD') AS paid_date FROM payment_records`)).rows
            .map(r => ({ id: r.id, leadId: r.lead_id, studentId: r.student_id, language: r.language, amount: Number(r.amount), method: r.method, paidDate: r.paid_date }));
    }
    const rows = ledger.projectCash(Array.isArray(manual) ? manual : [], records, decisions).rows.filter(r => !r.ledgerGenerated);
    const accountOf = m => ({ 'Naqd pul': 'acc-cash', Karta: 'acc-card', Paylater: 'acc-card', 'Bank hisob raqami': 'acc-bank', 'Uzum Nasiya': 'acc-uzum' })[m] || 'acc-suspense';
    for (const c of rows) {
        const amount = F.money(c.amount), day = F.date(c.date);
        if (!amount || !day) continue;
        const purpose = String(c.purpose || '');
        let type, category;
        if (c.type === 'kirim') {
            if (c.category === 'investitsiya') { type = 'capital'; category = 'OWNER_IN'; } else { type = 'income'; category = 'REV_OTHER'; }
        } else if (/refund|qaytar/i.test(purpose)) { type = 'refund'; category = 'REFUND'; }
        else if (/CEO|shaxsiy/i.test(purpose)) { type = 'drawing'; category = 'OWNER_OUT'; }
        else if (c.category === 'investitsiya') { type = 'expense'; category = /CRM/i.test(purpose) ? 'SOFTWARE' : 'CAPEX'; }
        else { type = 'expense'; category = /oylik|maosh/i.test(purpose) ? 'PAY_ADMIN' : /target/i.test(purpose) ? 'MKT_ADS' : /marketing/i.test(purpose) ? 'MKT_OTHER' : /CRM/i.test(purpose) ? 'SOFTWARE' : 'OTHER_EXP'; }
        const ent = c.lang === 'russian' || c.lang === 'english' ? c.lang : 'common';
        await db.query(`INSERT INTO fin_transactions(id,request_key,entity,txn_date,type,category_code,account_id,amount,counterparty,description,receipt_url,legacy,actor_id,actor_name)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE,'system','Eski Cash Flow’dan ko‘chirildi') ON CONFLICT(request_key) DO NOTHING`,
            [randomUUID(), 'legacy-cf-' + String(c.id).slice(0, 60).padEnd(16, '0'), ent === 'common' && type === 'refund' ? 'english' : ent, day, type, category, accountOf(c.paymentMethod), amount,
                text(c.person, 200), text([purpose, c.notes].filter(Boolean).join(' · '), 1000), ledger.receipt(c.receiptUrl) || '']);
    }
    await db.query("INSERT INTO fin_migrations(id) VALUES('legacy-cashflow-v1') ON CONFLICT DO NOTHING");
}

module.exports = { SCHEMA, initSchema, load, overview, cashbook, listTransactions, auditLog, createTransaction, reverseTransaction, createPayable, voidPayable,
    recordSalaryPayment, voidReceipts, manualReceipt, reconcile, saveAccount, addAccountCheck, lockMonth, saveSettings, assertOpen };
