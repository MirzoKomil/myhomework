// Moliya bo'limi: hisob raqamlar, xarajat/qaytarish/kapital/qarz operatsiyalari, korxona
// qarzlari, tushumlarni hujjat asosida tuzatish, oy yopish (muzlatilgan nusxa) va hisobotlar.
//
// Qoidalar (ilova kodida ham, ma'lumotlar bazasida ham majburiy):
//  * Moliyaviy yozuvlar o'chirilmaydi va tahrirlanmaydi (bazadagi triggerlar UPDATE/DELETE'ni rad etadi).
//    Xato — storno yoki hujjatli tuzatish bilan yopiladi.
//  * Yopilgan davrga hech qanday yozuvchi (CRM tushumi, moliya, eski import) yozolmaydi — trigger.
//  * Yopilgan oyning hisobotlari muzlatilgan nusxadan olinadi; keyingi farqlar ochiq oyda
//    "o'tgan davr tuzatishi" bo'lib ko'rinadi.
//  * Har bir amal xesh-zanjirli audit jurnaliga yoziladi (o'zgartirilsa, zanjir uziladi).
//  * Vazifalar ajratilgan: oy yopish, sozlamalar, hisob raqamlar va katta summali bekor qilish —
//    faqat rahbar (admin/boshliq); kundalik kiritish — moliya xodimi.
const { randomUUID, createHash } = require('crypto');
const fs = require('fs');
const path = require('path');
const F = require('../../js/financeEngine');
const ledger = require('../../js/paymentLedger');
const inflow = require('./inflow');

const error = (status, message) => Object.assign(new Error(message), { status });
const ENTITY_VALUES = ['english', 'russian', 'common'];
const DIRECTOR_ROLES = ['admin', 'boshliq'];
const EVIDENCE_RE = /^\/api\/finance\/evidence\/([0-9a-f-]{36})$/;
const toKey = v => v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : String(v).slice(0, 10);
const text = (v, max = 500) => String(v ?? '').trim().slice(0, max);

function lockGuardSql(table, column) {
    return `
CREATE OR REPLACE FUNCTION fin_guard_${table}() RETURNS trigger AS $$
DECLARE closed TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(hashtext('fin-write'));
  SELECT MAX(month) INTO closed FROM fin_period_locks;
  IF closed IS NOT NULL AND TO_CHAR(NEW.${column},'YYYY-MM') <= closed THEN
    RAISE EXCEPTION 'FIN_PERIOD_CLOSED: % sanasi yopilgan davrga (% gacha) tushadi', NEW.${column}, closed USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS fin_guard_${table} ON ${table};
CREATE TRIGGER fin_guard_${table} BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION fin_guard_${table}();`;
}
function immutableSql(table) {
    return `
DROP TRIGGER IF EXISTS fin_immutable_${table} ON ${table};
CREATE TRIGGER fin_immutable_${table} BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION fin_reject_change();`;
}
const SCHEMA = `
CREATE TABLE IF NOT EXISTS fin_accounts (
 id TEXT PRIMARY KEY, entity TEXT NOT NULL CHECK(entity IN ('english','russian','common')), name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('cash','card','bank','clearing','wallet','suspense')), methods TEXT[] NOT NULL DEFAULT '{}',
 opening_balance BIGINT NOT NULL DEFAULT 0, opening_date DATE, active BOOLEAN NOT NULL DEFAULT TRUE, sort INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fin_accounts ADD COLUMN IF NOT EXISTS request_key TEXT UNIQUE;
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
ALTER TABLE fin_transactions ADD COLUMN IF NOT EXISTS useful_life_months INTEGER;
ALTER TABLE fin_transactions ADD COLUMN IF NOT EXISTS non_salary BOOLEAN NOT NULL DEFAULT FALSE;
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
ALTER TABLE fin_account_checks ADD COLUMN IF NOT EXISTS request_key TEXT UNIQUE;
CREATE TABLE IF NOT EXISTS fin_period_locks (
 month TEXT PRIMARY KEY CHECK(month ~ '^[0-9]{4}-[0-9]{2}$'), locked_by TEXT NOT NULL, locked_by_name TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
 locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fin_period_snapshots (month TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS fin_settings (id TEXT PRIMARY KEY, data JSONB NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS fin_audit (
 id BIGSERIAL PRIMARY KEY, action TEXT NOT NULL, entity_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL,
 before_data JSONB, after_data JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fin_audit ADD COLUMN IF NOT EXISTS prev_hash TEXT;
ALTER TABLE fin_audit ADD COLUMN IF NOT EXISTS hash TEXT;
CREATE TABLE IF NOT EXISTS fin_evidence (
 id TEXT PRIMARY KEY, file_name TEXT NOT NULL, original_name TEXT NOT NULL, mime TEXT NOT NULL, size BIGINT NOT NULL, sha256 TEXT NOT NULL,
 uploaded_by TEXT NOT NULL, uploaded_by_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fin_migrations (id TEXT PRIMARY KEY, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS account_id TEXT;

CREATE OR REPLACE FUNCTION fin_reject_change() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'FIN_IMMUTABLE: % jadvalidagi moliyaviy yozuvni o''zgartirib yoki o''chirib bo''lmaydi', TG_TABLE_NAME USING ERRCODE = 'P0001'; END $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION fin_payables_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.voided_at IS NOT NULL OR NEW.voided_at IS NULL
     OR (to_jsonb(NEW) - 'voided_at' - 'void_reason' - 'voided_by') <> (to_jsonb(OLD) - 'voided_at' - 'void_reason' - 'voided_by') THEN
    RAISE EXCEPTION 'FIN_IMMUTABLE: hisob-faktura faqat bir marta bekor qilinishi mumkin' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS fin_payables_guard ON fin_payables;
CREATE TRIGGER fin_payables_guard BEFORE UPDATE OR DELETE ON fin_payables FOR EACH ROW EXECUTE FUNCTION fin_payables_guard();
CREATE OR REPLACE FUNCTION fin_payment_records_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'FIN_IMMUTABLE: tushum yozuvini o''chirib bo''lmaydi' USING ERRCODE = 'P0001'; END IF;
  IF (to_jsonb(NEW) - 'student_id' - 'account_id') <> (to_jsonb(OLD) - 'student_id' - 'account_id')
     OR (OLD.student_id IS NOT NULL AND NEW.student_id IS DISTINCT FROM OLD.student_id)
     OR (OLD.account_id IS NOT NULL AND NEW.account_id IS DISTINCT FROM OLD.account_id) THEN
    RAISE EXCEPTION 'FIN_IMMUTABLE: tushum yozuvini o''zgartirib bo''lmaydi — moliya bo''limida tuzating' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS fin_payment_records_guard ON payment_records;
CREATE TRIGGER fin_payment_records_guard BEFORE UPDATE OR DELETE ON payment_records FOR EACH ROW EXECUTE FUNCTION fin_payment_records_guard();
-- Tushum yozilgan paytdagi hisob raqam saqlanadi: keyinchalik sozlama o'zgarsa ham tarix ko'chmaydi.
CREATE OR REPLACE FUNCTION fin_receipt_account() RETURNS trigger AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    SELECT id INTO NEW.account_id FROM fin_accounts WHERE active AND NEW.method = ANY(methods)
      ORDER BY (entity = NEW.language) DESC, (entity = 'common') DESC, sort LIMIT 1;
    IF NEW.account_id IS NULL THEN NEW.account_id := 'acc-suspense'; END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS fin_receipt_account ON payment_records;
CREATE TRIGGER fin_receipt_account BEFORE INSERT ON payment_records FOR EACH ROW EXECUTE FUNCTION fin_receipt_account();
${lockGuardSql('payment_records', 'paid_date')}
${lockGuardSql('fin_transactions', 'txn_date')}
${lockGuardSql('fin_payables', 'issue_date')}
${lockGuardSql('payment_record_voids', 'void_date')}
${lockGuardSql('fin_account_checks', 'check_date')}
${immutableSql('fin_transactions')}
${immutableSql('payment_record_voids')}
${immutableSql('fin_account_checks')}
${immutableSql('fin_audit')}
${immutableSql('fin_evidence')}
`;

async function initSchema(pool) {
    // Advisory lock va unlock bitta ulanishda bo'lishi shart.
    const db = typeof pool.connect === 'function' && !pool.release ? await pool.connect() : pool;
    try {
        await db.query("SELECT pg_advisory_lock(hashtext('fin-init'))");
        try {
            await db.query(SCHEMA);
            for (const [i, a] of F.DEFAULT_ACCOUNTS.entries()) {
                await db.query(`INSERT INTO fin_accounts(id,entity,name,kind,methods,sort) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`, [a.id, a.entity, a.name, a.kind, a.methods, i]);
            }
            await db.query(`INSERT INTO fin_settings(id,data) VALUES('main',$1) ON CONFLICT(id) DO NOTHING`, [JSON.stringify(F.DEFAULT_SETTINGS)]);
            if (!(await db.query("SELECT 1 FROM fin_migrations WHERE id='receipt-accounts-v1'")).rows.length) {
                // Mavjud tushumlar uchun hisob bir marta, hozirgi xaritaga ko'ra biriktiriladi.
                await db.query(`UPDATE payment_records r SET account_id=COALESCE((SELECT a.id FROM fin_accounts a WHERE a.active AND r.method = ANY(a.methods)
                    ORDER BY (a.entity=r.language) DESC,(a.entity='common') DESC,a.sort LIMIT 1),'acc-suspense') WHERE account_id IS NULL`);
                await db.query("INSERT INTO fin_migrations(id) VALUES('receipt-accounts-v1') ON CONFLICT DO NOTHING");
            }
            await migrateLegacyCash(db);
        } finally { await db.query("SELECT pg_advisory_unlock(hashtext('fin-init'))"); }
    } finally { if (db !== pool) db.release(); }
}

async function transaction(pool, fn) {
    const db = await pool.connect();
    try {
        await db.query('BEGIN');
        // Barcha moliyaviy yozuvlar ketma-ket: qoldiq, oy yopish va limit tekshiruvlari poyga holatiga tushmaydi.
        await db.query("SELECT pg_advisory_xact_lock(hashtext('fin-write'))");
        const result = await fn(db);
        await db.query('COMMIT'); return result;
    } catch (e) {
        await db.query('ROLLBACK');
        if (/FIN_PERIOD_CLOSED|FIN_IMMUTABLE/.test(e.message || '')) throw error(409, e.message.replace(/^.*?(FIN_PERIOD_CLOSED|FIN_IMMUTABLE):\s*/, ''));
        throw e;
    } finally { db.release(); }
}
async function read(pool, fn) {
    const db = await pool.connect();
    try { await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); const r = await fn(db); await db.query('COMMIT'); return r; }
    catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
async function access(db, actor, { director = false } = {}) {
    const user = await inflow.access(db, actor);
    if (!user.finance) throw error(403, 'Moliya bo‘limiga ruxsat yo‘q');
    user.director = DIRECTOR_ROLES.includes(user.role);
    if (director && !user.director) throw error(403, 'Bu amal faqat rahbar (admin/boshliq) uchun');
    return user;
}
function auditHash(prev, row) { return createHash('sha256').update(String(prev || '') + '|' + JSON.stringify(row)).digest('hex'); }
async function audit(db, user, action, entityId, before, after) {
    const prev = (await db.query('SELECT hash FROM fin_audit WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1')).rows[0]?.hash || '';
    const createdAt = new Date().toISOString();
    const row = { action, entityId, actorId: user.id || 'system', actorName: user.name || user.email || 'System', before: before ?? null, after: after ?? null, createdAt };
    await db.query('INSERT INTO fin_audit(action,entity_id,actor_id,actor_name,before_data,after_data,created_at,prev_hash,hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [action, entityId, row.actorId, row.actorName, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after), createdAt, prev, auditHash(prev, sortKeys(canonical(row)))]);
}
function canonical(v) { return v == null ? null : JSON.parse(JSON.stringify(v)); }
async function verifyAuditChain(db) {
    const rows = (await db.query('SELECT id,action,entity_id,actor_id,actor_name,before_data,after_data,created_at,prev_hash,hash FROM fin_audit WHERE hash IS NOT NULL ORDER BY id')).rows;
    let prev = '', count = 0;
    for (const r of rows) {
        const row = { action: r.action, entityId: r.entity_id, actorId: r.actor_id, actorName: r.actor_name, before: canonical(r.before_data), after: canonical(r.after_data), createdAt: new Date(r.created_at).toISOString() };
        // JSONB kalitlar tartibini o'zgartiradi, shuning uchun xesh tartiblangan kanonik shakldan hisoblanadi.
        if ((r.prev_hash || '') !== prev || auditHash(prev, sortKeys(row)) !== r.hash) return { ok: false, brokenAt: Number(r.id), count };
        prev = r.hash; count++;
    }
    return { ok: true, count };
}
function sortKeys(v) { return Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v; }
function evidenceDir() {
    const base = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '../../data');
    const dir = path.join(base, 'finance-evidence');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}
async function requireEvidence(db, url, { required = false, label = 'Asos hujjat' } = {}) {
    if (!url) { if (required) throw error(400, label + 'ni yuklang (chek, bank ko‘chirmasi yoki audit ro‘yxati)'); return ''; }
    const m = EVIDENCE_RE.exec(String(url));
    if (!m) throw error(400, label + ' moliya bo‘limi orqali yuklangan bo‘lishi kerak');
    const row = (await db.query('SELECT file_name FROM fin_evidence WHERE id=$1', [m[1]])).rows[0];
    if (!row || !fs.existsSync(path.join(evidenceDir(), row.file_name))) throw error(400, label + ' fayli topilmadi. Qayta yuklang');
    return url;
}
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
// Oy yopish kumulyativ: eng oxirgi yopilgan oy va undan oldingilar yopiq.
async function closedThrough(db) { return (await db.query('SELECT MAX(month) AS m FROM fin_period_locks')).rows[0].m || ''; }
async function isClosed(db, day) { const m = await closedThrough(db); return !!m && F.monthOf(day) <= m; }
async function assertOpen(db, day, label = 'Bu sana') {
    const m = await closedThrough(db);
    if (m && F.monthOf(day) <= m) throw error(409, `${label} yopilgan davrga (${m} gacha yopilgan) tushadi. Tuzatishni ochiq oy sanasi bilan kiriting`);
}
async function accountRow(db, id, label = 'Hisob raqam') {
    const row = (await db.query('SELECT * FROM fin_accounts WHERE id=$1', [id])).rows[0];
    if (!row || !row.active) throw error(400, label + ' topilmadi yoki faol emas');
    return row;
}
async function settingsRow(db) { const r = (await db.query("SELECT data,revision FROM fin_settings WHERE id='main'")).rows[0]; return { data: F.settingsOf({ settings: r?.data || {} }), revision: r?.revision || 1 }; }
async function sumPaid(db, where, params) {
    return Number((await db.query(`SELECT COALESCE(SUM(CASE WHEN reverses_id IS NULL THEN amount ELSE -amount END),0) AS n FROM fin_transactions WHERE ${where}`, params)).rows[0].n);
}

// ---------- Ma'lumotni yig'ish ----------
function salaryCategory(role) {
    const r = String(role || '').toLowerCase();
    if (['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi', 'asosiy', 'yordamchi'].includes(r)) return 'COS_TEACHERS';
    if (['sotuv-menejeri', 'sotuv_menejeri', 'sotuv menejeri', 'sales_manager', 'rop'].includes(r)) return 'PAY_SALES';
    return 'PAY_ADMIN';
}
async function load(db) {
    const accounts = (await db.query('SELECT * FROM fin_accounts ORDER BY sort,name')).rows.map(a => ({ id: a.id, entity: a.entity, name: a.name, kind: a.kind,
        methods: a.methods || [], openingBalance: Number(a.opening_balance), openingDate: a.opening_date ? toKey(a.opening_date) : '', active: a.active }));
    const receiptRows = (await db.query(`SELECT r.id,r.lead_id,r.student_id,r.language,r.manager_id,TO_CHAR(r.paid_date,'YYYY-MM-DD') AS paid_date,r.amount,r.method,
        r.receipt_url,r.form,r.source_key,r.snapshot,r.legacy_review,r.account_id,TO_CHAR(v.void_date,'YYYY-MM-DD') AS void_date,v.reason AS void_reason,
        l.extra_data->'paymentSurvey'->>'totalAmount' AS contract_total
        FROM payment_records r LEFT JOIN payment_record_voids v ON v.record_id=r.id LEFT JOIN leads l ON l.id=r.lead_id
        ORDER BY r.paid_date,r.created_at,r.id`)).rows;
    const receipts = receiptRows.map(r => ({ id: r.id, entity: r.language, date: r.paid_date, amount: Number(r.amount), method: r.method, accountId: r.account_id || null,
        receiptUrl: r.receipt_url, form: r.form, name: r.snapshot?.name || '', phone: r.snapshot?.phone || '', managerId: r.manager_id, managerName: r.snapshot?.managerName || '',
        leadId: r.lead_id, studentId: r.student_id, legacyReview: r.legacy_review, correction: String(r.source_key).startsWith('correction:'),
        voidDate: r.void_date || '', voidReason: r.void_reason || '', contractValue: F.money(r.contract_total) || 0 }));
    const transactions = (await db.query(`SELECT *,TO_CHAR(txn_date,'YYYY-MM-DD') AS d FROM fin_transactions ORDER BY txn_date,created_at`)).rows.map(t => ({
        id: t.id, entity: t.entity, date: t.d, type: t.type, categoryCode: t.category_code, accountId: t.account_id, toAccountId: t.to_account_id,
        amount: Number(t.amount), counterparty: t.counterparty, description: t.description, receiptUrl: t.receipt_url, payableId: t.payable_id,
        paymentRecordId: t.payment_record_id, salaryId: t.salary_id, reversesId: t.reverses_id, reversalReason: t.reversal_reason, legacy: t.legacy,
        usefulLifeMonths: t.useful_life_months, nonSalary: t.non_salary, actorName: t.actor_name, createdAt: t.created_at }));
    const reversed = new Set(transactions.filter(t => t.reversesId).map(t => t.reversesId));
    for (const t of transactions) t.reversed = reversed.has(t.id);
    const payables = (await db.query(`SELECT *,TO_CHAR(issue_date,'YYYY-MM-DD') AS i,TO_CHAR(due_date,'YYYY-MM-DD') AS d FROM fin_payables ORDER BY issue_date`)).rows.map(p => ({
        id: p.id, entity: p.entity, kind: p.kind, counterparty: p.counterparty, description: p.description, categoryCode: p.category_code,
        amount: Number(p.amount), issueDate: p.i, dueDate: p.d || '', documentUrl: p.document_url, voided: !!p.voided_at, voidReason: p.void_reason || '' }));
    const salaryRows = (await db.query(`SELECT s.id,s.employee_id,s.language,s.amount,s.status,TO_CHAR(s.period_start,'YYYY-MM-DD') AS ps,TO_CHAR(s.period_end,'YYYY-MM-DD') AS pe,
        s.paid_at,he.name,he.role FROM salary_transactions s LEFT JOIN hr_employees he ON he.id=s.employee_id ORDER BY s.period_end`).catch(() => ({ rows: [] }))).rows;
    const salaries = salaryRows.map(s => ({ id: s.id, entity: s.language, employeeId: s.employee_id, employeeName: s.name || s.employee_id, role: s.role || '',
        amount: Number(s.amount), status: s.status, periodStart: s.ps, periodEnd: s.pe, accrualDate: s.pe, categoryCode: salaryCategory(s.role),
        paidAt: s.paid_at ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date(s.paid_at)) : '' }));
    const receivables = [];
    for (const s of (await db.query(`SELECT id,name,phone,subject,extra_data FROM students`)).rows) {
        const x = s.extra_data || {};
        if (x.isStaffDemo || !['english', 'russian'].includes(s.subject)) continue;
        const debt = F.money(x.debtAmount) || 0;
        if (debt <= 0) continue;
        receivables.push({ studentId: s.id, entity: s.subject, name: s.name, phone: s.phone, debt, dueDate: x.paymentDueDate || '', status: x.status || '', frozen: !!x.frozen,
            managerName: x.managerName || '', leadId: x.leadRef?.id || '' });
    }
    const accountChecks = (await db.query(`SELECT account_id,TO_CHAR(check_date,'YYYY-MM-DD') AS d,actual_balance,note,actor_name,created_at FROM fin_account_checks ORDER BY check_date,created_at`)).rows
        .map(c => ({ accountId: c.account_id, date: c.d, actualBalance: Number(c.actual_balance), note: c.note, actorName: c.actor_name, createdAt: c.created_at }));
    const s = await settingsRow(db);
    const locks = (await db.query("SELECT month,locked_by_name,note,locked_at FROM fin_period_locks ORDER BY month")).rows;
    const snapshots = Object.fromEntries((await db.query('SELECT month,data FROM fin_period_snapshots')).rows.map(r => [r.month, r.data]));
    return { accounts, receipts, transactions, payables, salaries, receivables, accountChecks, settings: s.data, settingsRevision: s.revision, locks,
        closedThrough: locks.map(l => l.month).sort().at(-1) || '', snapshots };
}
function period(q) {
    const end = F.date(q.end) || F.today();
    const start = F.date(q.start) || F.monthOf(end) + '-01';
    if (start > end) throw error(400, 'Boshlanish sanasi tugash sanasidan keyin bo‘lmasligi kerak');
    if (F.dayDiff(start, end) > 3700) throw error(400, 'Davr 10 yildan oshmasin');
    return { start, end, scope: ['english', 'russian', 'all'].includes(q.scope) ? q.scope : 'all', basis: q.basis === 'accrual' ? 'accrual' : 'cash' };
}

async function overview(pool, actor, q) {
    return read(pool, async db => {
        const user = await access(db, actor);
        const data = await load(db), p = period(q);
        const monthsStart = F.monthOf(F.addMonths(p.end, -5)) + '-01';
        const quality = F.dataQuality(data.receipts, data.settings);
        const scoped = r => p.scope === 'all' || r.entity === p.scope;
        const paidSalaryWithoutCash = data.salaries.filter(s => s.status === 'paid' && s.amount > 0
            && data.transactions.filter(t => t.salaryId === s.id).reduce((n, t) => n + (t.reversesId ? -1 : 1) * t.amount, 0) < s.amount);
        const firstDate = [...data.receipts.map(r => r.date), ...data.transactions.map(t => t.date)].filter(Boolean).sort()[0] || F.today();
        const nextMonth = data.closedThrough ? F.monthOf(F.addMonths(data.closedThrough + '-01', 1)) : F.monthOf(F.addMonths(F.monthOf(F.today()) + '-01', -1));
        return {
            period: p, user: { role: user.role, director: user.director },
            accounts: F.accountBalances(data, p.end, p.scope),
            balance: F.balanceSheet(data, p.end, 'all'),
            pnl: F.profitAndLoss(data, p),
            pnlOther: F.profitAndLoss(data, { ...p, basis: p.basis === 'cash' ? 'accrual' : 'cash' }),
            monthly: F.monthlyPnl(data, { start: monthsStart < p.start ? monthsStart : p.start, end: p.end, scope: p.scope, basis: p.basis }),
            cashflow: F.cashFlowStatement(data, p),
            receivables: F.receivablesAging(data.receivables, F.today(), p.scope),
            payables: F.payablesSummary(data, p.end, p.scope),
            kpis: F.kpis(data, p),
            quality: { ...quality, suspicious: quality.suspicious.filter(scoped), paidSalaryWithoutCash: paidSalaryWithoutCash.filter(scoped), voidedList: data.receipts.filter(r => r.voidDate && scoped(r)) },
            settings: data.settings, settingsRevision: data.settingsRevision, locks: data.locks, closedThrough: data.closedThrough, firstDate,
            closeCandidate: { month: nextMonth, issues: F.monthEnd(nextMonth) < F.today() ? closeReadiness(data, nextMonth) : null },
            auditChain: await verifyAuditChain(db), accountsList: data.accounts, categories: F.CATEGORIES
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
        const limit = Math.min(2000, Math.max(1, Number(q.limit) || 200));
        const params = [limit], where = [];
        if (q.action) { params.push(String(q.action)); where.push(`action=$${params.length}`); }
        const rows = (await db.query(`SELECT id,action,entity_id,actor_name,before_data,after_data,created_at FROM fin_audit ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT $1`, params)).rows;
        return { rows, chain: await verifyAuditChain(db) };
    });
}
async function people(pool, actor, q) {
    return read(pool, async db => {
        await access(db, actor);
        const lang = entity(q.entity, false), term = text(q.q, 80);
        if (term.length < 2) return { rows: [] };
        const digits = term.replace(/\D/g, '');
        const like = '%' + term.toLowerCase() + '%', phoneLike = digits.length >= 4 ? '%' + digits.slice(-9) + '%' : '__none__';
        const students = (await db.query(`SELECT id,name,phone,extra_data->'leadRef'->>'id' AS lead_id FROM students WHERE subject=$1 AND (LOWER(name) LIKE $2 OR REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g') LIKE $3) LIMIT 15`, [lang, like, phoneLike])).rows;
        const leads = (await db.query(`SELECT id,name,phone,manager_id,status FROM leads WHERE language=$1 AND deleted_at IS NULL AND (LOWER(name) LIKE $2 OR REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g') LIKE $3) LIMIT 15`, [lang, like, phoneLike])).rows;
        return { rows: [...students.map(s => ({ kind: 'student', studentId: s.id, leadId: s.lead_id || null, name: s.name, phone: s.phone })),
            ...leads.filter(l => !students.some(s => s.lead_id === l.id)).map(l => ({ kind: 'lead', leadId: l.id, studentId: null, name: l.name, phone: l.phone, managerId: l.manager_id, status: l.status }))] };
    });
}

// ---------- Hujjatlar (dalillar): faqat avtorizatsiya bilan o'qiladi ----------
async function storeEvidence(pool, actor, file) {
    if (!file || !file.buffer) throw error(400, 'Fayl tanlanmagan');
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!['.pdf', '.png', '.jpg', '.jpeg', '.webp'].includes(ext) || !/^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.mimetype || '')) throw error(400, 'Faqat PDF yoki rasm (PNG, JPG, WEBP)');
    if (file.buffer.length > 15 * 1024 * 1024) throw error(400, 'Fayl 15 MB dan oshmasin');
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const id = randomUUID(), fileName = id + ext;
        fs.writeFileSync(path.join(evidenceDir(), fileName), file.buffer);
        const sha = createHash('sha256').update(file.buffer).digest('hex');
        await db.query('INSERT INTO fin_evidence(id,file_name,original_name,mime,size,sha256,uploaded_by,uploaded_by_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [id, fileName, text(file.originalname, 200), file.mimetype, file.buffer.length, sha, user.id, user.name]);
        await audit(db, user, 'evidence-upload', id, null, { name: text(file.originalname, 200), size: file.buffer.length, sha256: sha });
        return { url: '/api/finance/evidence/' + id, sha256: sha };
    });
}
async function readEvidence(pool, actor, id) {
    return read(pool, async db => {
        await access(db, actor);
        const row = (await db.query('SELECT * FROM fin_evidence WHERE id=$1', [String(id)])).rows[0];
        if (!row) throw error(404, 'Hujjat topilmadi');
        return { path: path.join(evidenceDir(), row.file_name), mime: row.mime, name: row.original_name };
    });
}

// ---------- Operatsiyalar ----------
async function createTransaction(pool, actor, body) {
    const key = requestKey(body.requestKey);
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const prior = (await db.query('SELECT id FROM fin_transactions WHERE request_key=$1', [key])).rows[0];
        if (prior) return { id: prior.id, duplicate: true };
        const settings = (await settingsRow(db)).data;
        const type = body.type;
        if (!Object.hasOwn(F.TYPES, type)) throw error(400, 'Operatsiya turini tanlang');
        const cat = F.CATEGORY[body.categoryCode];
        if (!cat || cat.type !== type || body.categoryCode === 'TAX') throw error(400, 'Bu operatsiya turi uchun toifa noto‘g‘ri');
        let ent = entity(body.entity);
        const day = dateOf(body.date);
        await assertOpen(db, day);
        const amount = amountOf(body.amount);
        const account = await accountRow(db, body.accountId);
        let toAccount = null;
        if (type === 'transfer') toAccount = await accountRow(db, body.toAccountId, 'Qabul qiluvchi hisob');
        const counterparty = text(body.counterparty, 200), description = text(body.description, 1000);
        if (type !== 'transfer' && !counterparty) throw error(400, 'Kimga / kimdan ekanini yozing');
        const needEvidence = ['refund', 'drawing'].includes(type) || (type === 'expense' && amount >= 1000000);
        const receiptUrl = await requireEvidence(db, body.receiptUrl, { required: needEvidence, label: 'Chek yoki hujjat' });
        let payableId = null, paymentRecordId = null, nonSalary = false;
        if (cat.payroll) {
            // Maosh "Maoshlar" bo'limida hisoblanadi; bu yerda qo'lda kiritish faqat ataylab belgilansa (ikki marta hisoblanmasligi uchun).
            if (!body.nonSalary) throw error(400, 'Maosh to‘lovlari “Maoshlar” bo‘limi orqali yuritiladi. Bir martalik to‘lov bo‘lsa, “maosh tizimidan tashqari” belgisini qo‘ying');
            nonSalary = true;
        }
        if (type === 'refund') {
            if (!body.paymentRecordId) throw error(400, 'Qaysi tushum qaytarilayotganini tanlang');
            const rec = (await db.query(`SELECT r.*,v.record_id AS voided FROM payment_records r LEFT JOIN payment_record_voids v ON v.record_id=r.id WHERE r.id=$1`, [body.paymentRecordId])).rows[0];
            if (!rec || rec.voided) throw error(400, 'Qaytariladigan tushum topilmadi');
            if (await sumPaid(db, `payment_record_id=$1 AND type='refund'`, [rec.id]) + amount > Number(rec.amount)) throw error(409, 'Qaytarish summasi tushumdan oshib ketdi');
            if (amount > settings.approvalLimit && !user.director) throw error(403, `${settings.approvalLimit} so‘mdan katta qaytarish faqat rahbar tomonidan`);
            paymentRecordId = rec.id; ent = rec.language;
        }
        if (type === 'loan_repay' || (body.payableId && type !== 'loan_in')) {
            const p = (await db.query('SELECT * FROM fin_payables WHERE id=$1', [body.payableId])).rows[0];
            if (!p || p.voided_at) throw error(400, 'Qarz / hisob-faktura topilmadi');
            if (type === 'loan_repay' && p.kind !== 'loan') throw error(400, 'Bu yozuv qarz emas');
            if (type === 'expense' && p.category_code !== cat.code) throw error(400, 'Toifa hisob-faktura toifasiga mos emas');
            const paid = await sumPaid(db, `payable_id=$1 AND type<>'loan_in'`, [p.id]);
            if (paid + amount > Number(p.amount)) throw error(409, `To‘lov qoldiqdan oshib ketdi (qoldiq: ${Number(p.amount) - paid})`);
            payableId = p.id; ent = p.entity;
        }
        let usefulLife = null;
        if (cat.code === 'CAPEX') { usefulLife = Number(body.usefulLifeMonths || settings.usefulLifeMonths); if (!Number.isInteger(usefulLife) || usefulLife < 1 || usefulLife > 240) throw error(400, 'Foydalanish muddati 1–240 oy'); }
        const fee = type === 'transfer' && body.feeAmount ? amountOf(body.feeAmount) : 0;
        const id = randomUUID();
        if (type === 'loan_in') {
            payableId = randomUUID();
            await db.query(`INSERT INTO fin_payables(id,entity,kind,counterparty,description,category_code,amount,issue_date,due_date,document_url,actor_id,actor_name)
                VALUES($1,$2,'loan',$3,$4,'LOAN_REPAY',$5,$6,$7,$8,$9,$10)`, [payableId, ent, counterparty, description, amount, day, F.date(body.dueDate) || null, receiptUrl, user.id, user.name]);
        }
        await db.query(`INSERT INTO fin_transactions(id,request_key,entity,txn_date,type,category_code,account_id,to_account_id,amount,counterparty,description,receipt_url,
            payable_id,payment_record_id,useful_life_months,non_salary,actor_id,actor_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
            [id, key, ent, day, type, cat.code, account.id, toAccount?.id || null, amount, counterparty, description, receiptUrl, payableId, paymentRecordId, usefulLife, nonSalary, user.id, user.name]);
        if (fee) {
            // Uzum / to'lov tizimi hisob-kitobi: bankka sof summa tushadi, komissiya kliring hisobidan xarajat bo'ladi.
            await db.query(`INSERT INTO fin_transactions(id,request_key,entity,txn_date,type,category_code,account_id,amount,counterparty,description,receipt_url,actor_id,actor_name)
                VALUES($1,$2,$3,$4,'expense','BANK_FEES',$5,$6,$7,$8,$9,$10,$11)`, [randomUUID(), key.slice(0, 70) + '-fee', ent, day, account.id, fee, account.name, 'Komissiya' + (description ? ': ' + description : ''), receiptUrl, user.id, user.name]);
        }
        await audit(db, user, 'transaction-create', id, null, { type, category: cat.code, entity: ent, date: day, amount, fee, account: account.id, toAccount: toAccount?.id || null, payableId, paymentRecordId, counterparty, description, receiptUrl });
        return { id, duplicate: false };
    });
}
async function reverseTransaction(pool, actor, id, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const t = (await db.query("SELECT *,TO_CHAR(txn_date,'YYYY-MM-DD') AS d FROM fin_transactions WHERE id=$1", [id])).rows[0];
        if (!t) throw error(404, 'Operatsiya topilmadi');
        if (t.reverses_id) throw error(400, 'Storno yozuvini qayta storno qilib bo‘lmaydi');
        if ((await db.query('SELECT 1 FROM fin_transactions WHERE reverses_id=$1', [id])).rows.length) throw error(409, 'Bu operatsiya allaqachon bekor qilingan');
        const reason = text(body.reason, 500);
        if (reason.length < 5) throw error(400, 'Bekor qilish sababini yozing (kamida 5 belgi)');
        const day = dateOf(F.date(body.date) || (await isClosed(db, t.d) ? F.today() : t.d), 'Storno sanasi');
        if (day < t.d) throw error(400, 'Storno sanasi asl operatsiyadan oldin bo‘lmaydi');
        await assertOpen(db, day, 'Storno sanasi');
        if (t.type === 'loan_in') {
            if (await sumPaid(db, `payable_id=$1 AND type='loan_repay'`, [t.payable_id]) > 0) throw error(409, 'Bu qarz bo‘yicha qaytarish bor. Avval qaytarishlarni bekor qiling');
            await db.query('UPDATE fin_payables SET voided_at=NOW(),void_reason=$2,voided_by=$3 WHERE id=$1', [t.payable_id, 'Olingan qarz bekor qilindi: ' + reason, user.id]);
        }
        const rid = randomUUID();
        await db.query(`INSERT INTO fin_transactions(id,entity,txn_date,type,category_code,account_id,to_account_id,amount,counterparty,description,receipt_url,payable_id,
            payment_record_id,salary_id,reverses_id,reversal_reason,useful_life_months,non_salary,actor_id,actor_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
            [rid, t.entity, day, t.type, t.category_code, t.account_id, t.to_account_id, t.amount, t.counterparty, 'STORNO: ' + reason, t.receipt_url,
                t.type === 'loan_in' ? null : t.payable_id, t.payment_record_id, t.salary_id, t.id, reason, t.useful_life_months, t.non_salary, user.id, user.name]);
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
        if (!cat || cat.type !== 'expense' || cat.payroll || cat.code === 'CAPEX' || body.categoryCode === 'TAX') throw error(400, 'Xarajat toifasini tanlang (maosh va kapital xarajat bu yerda kiritilmaydi)');
        const counterparty = text(body.counterparty, 200);
        if (!counterparty) throw error(400, 'Kimga qarzdorligimizni yozing');
        const issue = dateOf(body.issueDate, 'Hujjat sanasi');
        await assertOpen(db, issue, 'Hujjat sanasi');
        const due = body.dueDate ? F.date(body.dueDate) : null;
        if (body.dueDate && !due) throw error(400, 'To‘lov muddati noto‘g‘ri');
        if (due && due < issue) throw error(400, 'To‘lov muddati hujjat sanasidan oldin bo‘lmaydi');
        const id = randomUUID(), amount = amountOf(body.amount), ent = entity(body.entity);
        const documentUrl = await requireEvidence(db, body.documentUrl, { label: 'Hujjat' });
        await db.query(`INSERT INTO fin_payables(id,request_key,entity,kind,counterparty,description,category_code,amount,issue_date,due_date,document_url,actor_id,actor_name)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [id, key, ent, kind, counterparty, text(body.description, 1000), cat.code, amount, issue, due, documentUrl, user.id, user.name]);
        await audit(db, user, 'payable-create', id, null, { kind, entity: ent, counterparty, category: cat.code, amount, issue, due, documentUrl });
        return { id, duplicate: false };
    });
}
async function voidPayable(pool, actor, id, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const p = (await db.query("SELECT *,TO_CHAR(issue_date,'YYYY-MM-DD') AS i FROM fin_payables WHERE id=$1", [id])).rows[0];
        if (!p || p.voided_at) throw error(404, 'Yozuv topilmadi');
        if (p.kind === 'loan') throw error(400, 'Qarzni bekor qilish uchun olingan qarz operatsiyasini storno qiling');
        const reason = text(body.reason, 500); if (reason.length < 5) throw error(400, 'Sababini yozing');
        await assertOpen(db, p.i, 'Hujjat sanasi');
        if (await sumPaid(db, `payable_id=$1 AND type<>'loan_in'`, [id]) > 0) throw error(409, 'Bu hujjat bo‘yicha to‘lov qilingan. Avval to‘lovni storno qiling');
        await db.query('UPDATE fin_payables SET voided_at=NOW(),void_reason=$2,voided_by=$3 WHERE id=$1', [id, reason, user.id]);
        await audit(db, user, 'payable-void', id, { amount: Number(p.amount) }, { reason });
        return { ok: true };
    });
}
async function recordSalaryPayment(pool, actor, salaryId, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const s = (await db.query(`SELECT s.*,he.name,he.role FROM salary_transactions s LEFT JOIN hr_employees he ON he.id=s.employee_id WHERE s.id=$1`, [salaryId])).rows[0];
        if (!s) throw error(404, 'Maosh hisobi topilmadi');
        if (s.status !== 'paid') throw error(409, 'Avval Maoshlar bo‘limida hisobni tasdiqlab, “To‘landi” deb belgilang');
        if (Number(s.amount) <= 0) throw error(400, 'Nol yoki manfiy maosh uchun chiqim yozilmaydi');
        const already = await sumPaid(db, 'salary_id=$1', [salaryId]);
        if (already >= Number(s.amount)) {
            const prior = (await db.query('SELECT id FROM fin_transactions WHERE salary_id=$1 AND reverses_id IS NULL ORDER BY created_at DESC LIMIT 1', [salaryId])).rows[0];
            return { id: prior?.id, duplicate: true };
        }
        const day = dateOf(body.date || (s.paid_at ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date(s.paid_at)) : F.today()));
        await assertOpen(db, day);
        const account = await accountRow(db, body.accountId);
        if (!F.EQUIVALENT_KINDS.has(account.kind)) throw error(400, 'Maosh naqd, karta yoki bank hisobidan to‘lanadi');
        const id = randomUUID();
        await db.query(`INSERT INTO fin_transactions(id,entity,txn_date,type,category_code,account_id,amount,counterparty,description,salary_id,actor_id,actor_name)
            VALUES($1,$2,$3,'expense',$4,$5,$6,$7,$8,$9,$10,$11)`, [id, s.language, day, salaryCategory(s.role), account.id, Number(s.amount) - already, s.name || s.employee_id,
            `Maosh ${toKey(s.period_start)} — ${toKey(s.period_end)}`, salaryId, user.id, user.name]);
        await audit(db, user, 'salary-cash-out', id, null, { salaryId, amount: Number(s.amount) - already, date: day, account: account.id });
        return { id, duplicate: false };
    });
}

// ---------- Tushumlar reyestrini hujjat asosida tuzatish ----------
async function voidReceipt(db, user, settings, recordId, { reason, evidenceUrl, date, replacedBy = null }) {
    const rec = (await db.query(`SELECT *,TO_CHAR(paid_date,'YYYY-MM-DD') AS d FROM payment_records WHERE id=$1`, [recordId])).rows[0];
    if (!rec) throw error(404, 'Tushum topilmadi');
    if ((await db.query('SELECT 1 FROM payment_record_voids WHERE record_id=$1', [recordId])).rows.length) throw error(409, 'Bu tushum allaqachon bekor qilingan');
    if (await sumPaid(db, 'payment_record_id=$1', [recordId]) > 0) throw error(409, 'Bu tushum bo‘yicha qaytarish yozilgan. Avval qaytarishni storno qiling');
    if (!replacedBy && Number(rec.amount) > settings.approvalLimit && !user.director) throw error(403, `${settings.approvalLimit} so‘mdan katta tushumni bekor qilish faqat rahbar tomonidan`);
    const day = dateOf(F.date(date) || (await isClosed(db, rec.d) ? F.today() : rec.d), 'Bekor qilish sanasi');
    if (day < rec.d) throw error(400, 'Bekor qilish sanasi tushum sanasidan oldin bo‘lmaydi');
    await assertOpen(db, day, 'Bekor qilish sanasi');
    await db.query(`INSERT INTO payment_record_voids(record_id,void_date,reason,evidence_url,replaced_by,actor_id,actor_name) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [recordId, day, reason, evidenceUrl, replacedBy, user.id, user.name]);
    await db.query('INSERT INTO payment_audit(record_id,action,actor_id,actor_name,data) VALUES($1,$2,$3,$4,$5)',
        [recordId, 'finance-void', user.id, user.name, JSON.stringify({ reason, evidenceUrl, voidDate: day, replacedBy })]);
    await audit(db, user, 'receipt-void', recordId, { amount: Number(rec.amount), date: rec.d, name: rec.snapshot?.name || '' }, { reason, voidDate: day, replacedBy, evidenceUrl });
    return { recordId, voidDate: day };
}
async function insertCorrection(db, user, key, op, { reason, evidenceUrl, lang }) {
    const sourceKey = 'correction:' + key;
    const prior = (await db.query('SELECT id FROM payment_records WHERE source_key=$1', [sourceKey])).rows[0];
    if (prior) return { id: prior.id, duplicate: true };
    const day = dateOf(op.date, 'To‘lov sanasi');
    await assertOpen(db, day, 'To‘lov sanasi');
    const amount = amountOf(op.amount);
    let replaced = null;
    if (op.replacesId) {
        replaced = (await db.query('SELECT * FROM payment_records WHERE id=$1', [op.replacesId])).rows[0];
        if (!replaced) throw error(404, 'Tuzatiladigan tushum topilmadi');
        if (replaced.language !== lang) throw error(400, 'Tuzatish boshqa yo‘nalishga tegishli');
    }
    const method = ledger.method(op.method || replaced?.method);
    if (method === 'unknown') throw error(400, 'To‘lov usulini tanlang');
    const leadId = text(op.leadId, 120) || replaced?.lead_id || null, studentId = text(op.studentId, 120) || replaced?.student_id || null;
    // Yangi tushum faqat aniq o'quvchi yoki lidga bog'lanadi — aks holda sotuv va qarz hisoblari buziladi.
    if (!leadId && !studentId) throw error(400, 'Tushum qaysi o‘quvchi yoki lidga tegishli ekanini tanlang');
    let name = text(op.name, 200) || replaced?.snapshot?.name || '', phone = text(op.phone, 40) || replaced?.snapshot?.phone || '', managerId = text(op.managerId, 120) || replaced?.manager_id || '';
    if (!replaced) {
        const person = studentId ? (await db.query('SELECT name,phone,subject FROM students WHERE id=$1', [studentId])).rows[0] : null;
        const lead = leadId ? (await db.query('SELECT name,phone,manager_id,language FROM leads WHERE id=$1', [leadId])).rows[0] : null;
        if ((studentId && !person) || (leadId && !lead)) throw error(404, 'Tanlangan o‘quvchi yoki lid topilmadi');
        if ((person && person.subject !== lang) || (lead && lead.language !== lang)) throw error(400, 'O‘quvchi boshqa yo‘nalishga tegishli');
        name = name || person?.name || lead?.name || ''; phone = phone || person?.phone || lead?.phone || ''; managerId = managerId || lead?.manager_id || '';
    }
    const managerName = managerId ? (await db.query('SELECT name FROM hr_employees WHERE id=$1', [managerId])).rows[0]?.name || '' : '';
    const id = randomUUID();
    await db.query(`INSERT INTO payment_records(id,source_key,lead_id,student_id,language,manager_id,teacher_id,paid_date,amount,method,receipt_url,tariff,form,debt_snapshot,snapshot,legacy_review,actor_id)
        VALUES($1,$2,$3,$4,$5,$6,'',$7,$8,$9,$10,$11,$12,0,$13,FALSE,$14)`,
        [id, sourceKey, leadId, studentId, lang, managerId, day, amount, method, evidenceUrl, Number(op.tariff) || replaced?.tariff || null, op.form === 'full' ? 'full' : (replaced?.form || 'partial'),
            JSON.stringify({ name, phone, managerName, teacherName: '', nextPaymentDate: '', total: null, timeKnown: false, correction: true, reason }), user.id]);
    await db.query('INSERT INTO payment_audit(record_id,action,actor_id,actor_name,data) VALUES($1,$2,$3,$4,$5)',
        [id, 'finance-correction', user.id, user.name, JSON.stringify({ amount, date: day, method, reason, evidenceUrl, replacesId: replaced?.id || null })]);
    await audit(db, user, 'receipt-manual', id, replaced ? { id: replaced.id, amount: Number(replaced.amount), date: toKey(replaced.paid_date) } : null, { amount, date: day, name, phone, entity: lang, reason, evidenceUrl, leadId, studentId });
    return { id, duplicate: false, replaced };
}
// Bir nechta tuzatish bitta tranzaksiyada: yoki hammasi saqlanadi, yoki hech biri.
async function batchCorrections(pool, actor, body) {
    const key = requestKey(body.requestKey);
    const ops = Array.isArray(body.operations) ? body.operations : [];
    if (!ops.length || ops.length > 200) throw error(400, 'Tuzatishlar ro‘yxati bo‘sh yoki juda katta');
    const reason = text(body.reason, 500);
    if (reason.length < 5) throw error(400, 'Tuzatish sababini yozing (kamida 5 belgi)');
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const settings = (await settingsRow(db)).data;
        const lang = entity(body.entity, false);
        const evidenceUrl = await requireEvidence(db, body.evidenceUrl, { required: true });
        const results = [];
        for (const [i, op] of ops.entries()) {
            try {
                if (op.kind === 'void') {
                    const rec = (await db.query('SELECT language FROM payment_records WHERE id=$1', [op.recordId])).rows[0];
                    if (rec && rec.language !== lang) throw error(400, 'Tushum boshqa yo‘nalishga tegishli');
                    const prior = (await db.query('SELECT 1 FROM payment_record_voids WHERE record_id=$1 AND reason=$2', [op.recordId, reason])).rows[0];
                    if (prior) { results.push({ kind: 'void', recordId: op.recordId, duplicate: true }); continue; }
                    results.push({ kind: 'void', ...(await voidReceipt(db, user, settings, String(op.recordId), { reason, evidenceUrl, date: op.voidDate })) });
                } else if (op.kind === 'add' || op.kind === 'replace') {
                    if (op.kind === 'replace' && !op.replacesId) throw error(400, 'Tuzatiladigan tushum ko‘rsatilmagan');
                    const r = await insertCorrection(db, user, key.slice(0, 60) + '-' + i, op, { reason, evidenceUrl, lang });
                    if (op.kind === 'replace' && !r.duplicate) await voidReceipt(db, user, settings, op.replacesId, { reason: 'Tuzatildi: ' + reason, evidenceUrl, date: op.voidDate, replacedBy: r.id });
                    results.push({ kind: op.kind, id: r.id, duplicate: r.duplicate });
                } else throw error(400, 'Noma’lum tuzatish turi');
            } catch (e) { e.message = `${i + 1}-tuzatish: ${e.message}`; throw e; }
        }
        await audit(db, user, 'receipt-batch', key, null, { count: ops.length, reason, evidenceUrl });
        return { results };
    });
}
async function voidReceipts(pool, actor, body) {
    const ids = Array.isArray(body.recordIds) ? [...new Set(body.recordIds.map(String))] : [];
    if (!ids.length || ids.length > 200) throw error(400, 'Bekor qilinadigan tushumlarni tanlang');
    const reason = text(body.reason, 500);
    if (reason.length < 5) throw error(400, 'Bekor qilish sababini yozing (kamida 5 belgi)');
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const settings = (await settingsRow(db)).data;
        const evidenceUrl = await requireEvidence(db, body.evidenceUrl, { required: true });
        const out = [];
        for (const id of ids) out.push(await voidReceipt(db, user, settings, id, { reason, evidenceUrl, date: body.date }));
        return { voided: out };
    });
}
async function manualReceipt(pool, actor, body) {
    return batchCorrections(pool, actor, { requestKey: body.requestKey, entity: body.entity, reason: body.reason, evidenceUrl: body.evidenceUrl,
        operations: [{ ...body, kind: body.replacesId ? 'replace' : 'add' }] }).then(r => ({ id: r.results[0].id, duplicate: r.results[0].duplicate }));
}
async function reconcile(pool, actor, body) {
    return read(pool, async db => {
        await access(db, actor);
        const lang = entity(body.entity, false);
        const rows = Array.isArray(body.rows) ? body.rows.slice(0, 3000) : [];
        if (!rows.length) throw error(400, 'Solishtirish uchun qatorlar yo‘q');
        const data = await load(db);
        return F.reconcile(rows, data.receipts.filter(r => r.entity === lang), { start: F.date(body.start), end: F.date(body.end), tolerance: Math.min(10, Math.max(0, Number(body.tolerance ?? 3))) });
    });
}

// ---------- Hisob raqamlar, tekshiruv, oy yopish, sozlamalar ----------
async function saveAccount(pool, actor, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor, { director: true });
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
        if (!existing && body.requestKey) {
            const prior = (await db.query('SELECT id FROM fin_accounts WHERE request_key=$1', [requestKey(body.requestKey)])).rows[0];
            if (prior) return { id: prior.id, duplicate: true };
        }
        const clash = (await db.query(`SELECT name FROM fin_accounts WHERE active AND id<>$1 AND entity=$2 AND methods && $3::text[]`, [existing?.id || '', ent, methods])).rows[0];
        if (clash && body.active !== false) throw error(409, `Tanlangan to‘lov usuli "${clash.name}" hisobiga biriktirilgan`);
        if (existing) {
            const prevDate = existing.opening_date ? toKey(existing.opening_date) : null;
            if (Number(existing.opening_balance) !== opening || prevDate !== openingDate) {
                const od = [openingDate, prevDate].filter(Boolean).sort()[0];
                if ((od && await isClosed(db, od)) || (!od && await closedThrough(db))) throw error(409, 'Boshlang‘ich qoldiq yopilgan oylarga ta’sir qiladi. Avval oylarni qayta oching');
            }
            if (existing.entity !== ent && (await db.query('SELECT 1 FROM payment_records WHERE account_id=$1 UNION ALL SELECT 1 FROM fin_transactions WHERE account_id=$1 OR to_account_id=$1 LIMIT 1', [existing.id])).rows.length)
                throw error(409, 'Harakati bor hisobning egasini o‘zgartirib bo‘lmaydi — yangi hisob oching');
            if (existing.kind !== body.kind && (await db.query('SELECT 1 FROM payment_records WHERE account_id=$1 UNION ALL SELECT 1 FROM fin_transactions WHERE account_id=$1 OR to_account_id=$1 LIMIT 1', [existing.id])).rows.length)
                throw error(409, 'Harakati bor hisobning turini o‘zgartirib bo‘lmaydi — hisobotlar tarixi o‘zgaradi');
            await db.query(`UPDATE fin_accounts SET name=$2,kind=$3,entity=$4,methods=$5,opening_balance=$6,opening_date=$7,active=$8,updated_at=NOW() WHERE id=$1`,
                [existing.id, name, body.kind, ent, methods, opening, openingDate, body.active !== false]);
            await audit(db, user, 'account-update', existing.id, { name: existing.name, opening: Number(existing.opening_balance), openingDate: prevDate, methods: existing.methods, active: existing.active },
                { name, opening, openingDate, methods, active: body.active !== false });
            return { id: existing.id };
        }
        if (openingDate && await isClosed(db, openingDate)) throw error(409, 'Boshlang‘ich qoldiq sanasi yopilgan davrda');
        const id = 'acc-' + randomUUID().slice(0, 8);
        await db.query(`INSERT INTO fin_accounts(id,entity,name,kind,methods,opening_balance,opening_date,sort,request_key) VALUES($1,$2,$3,$4,$5,$6,$7,100,$8)`,
            [id, ent, name, body.kind, methods, opening, openingDate, body.requestKey || null]);
        await audit(db, user, 'account-create', id, null, { name, kind: body.kind, entity: ent, methods, opening, openingDate });
        return { id };
    });
}
async function addAccountCheck(pool, actor, accountId, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor);
        if (body.requestKey) {
            const prior = (await db.query('SELECT id FROM fin_account_checks WHERE request_key=$1', [requestKey(body.requestKey)])).rows[0];
            if (prior) return { ok: true, duplicate: true };
        }
        await accountRow(db, accountId);
        const day = dateOf(body.date, 'Tekshiruv sanasi');
        await assertOpen(db, day, 'Tekshiruv sanasi');
        const actual = Number(body.actualBalance);
        if (!Number.isSafeInteger(actual)) throw error(400, 'Haqiqiy qoldiqni butun son bilan kiriting');
        await db.query('INSERT INTO fin_account_checks(account_id,check_date,actual_balance,note,actor_id,actor_name,request_key) VALUES($1,$2,$3,$4,$5,$6,$7)',
            [accountId, day, actual, text(body.note, 500), user.id, user.name, body.requestKey || null]);
        await audit(db, user, 'account-check', accountId, null, { date: day, actual, note: text(body.note, 500) });
        return { ok: true };
    });
}
// Oy yopishdan oldingi majburiy nazorat: har bir pul hisobi oy oxirida (oxirgi 3 kun) haqiqiy qoldiq bilan
// solishtirilgan va farqi nol bo'lishi kerak. Aks holda rahbar sababini yozib, ongli ravishda yopadi.
const fmt = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
function closeReadiness(data, month) {
    const end = F.monthEnd(month), issues = [], mv = F.movements(data);
    for (const a of data.accounts) {
        if (!a.active || !F.EQUIVALENT_KINDS.has(a.kind)) continue;
        const used = mv.some(m => m.account === a.id && m.date <= end) || (a.openingBalance && (!a.openingDate || a.openingDate <= end));
        if (!used) continue;
        const checks = (data.accountChecks || []).filter(c => c.accountId === a.id && c.date >= F.addDays(end, -3) && c.date <= end);
        const last = checks.at(-1);
        if (!last) { issues.push(`${a.name}: oy oxirida haqiqiy qoldiq kiritilmagan`); continue; }
        const book = F.accountBalances(data, last.date).find(x => x.id === a.id).balance;
        const actual = Number(last.actualBalance);
        if (book !== actual) issues.push(`${a.name}: kitobda ${fmt(book)} so‘m, haqiqiy ${fmt(actual)} so‘m (farq ${fmt(actual - book)} so‘m)`);
    }
    const suspense = F.accountBalances(data, end).find(a => a.kind === 'suspense');
    if (suspense && suspense.balance) issues.push(`To‘lov usuli aniqlanmagan ${fmt(suspense.balance)} so‘m “Aniqlanmagan” hisobida turibdi`);
    return issues;
}
async function closeStatus(pool, actor, q) {
    return read(pool, async db => {
        await access(db, actor);
        const data = await load(db), month = String(q.month || '');
        if (!/^\d{4}-\d{2}$/.test(month)) throw error(400, 'Oy noto‘g‘ri');
        return { month, issues: closeReadiness(data, month) };
    });
}
async function lockMonth(pool, actor, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor, { director: true });
        const month = String(body.month || '');
        if (!/^\d{4}-\d{2}$/.test(month) || !F.date(month + '-01')) throw error(400, 'Oy noto‘g‘ri');
        const through = await closedThrough(db);
        if (body.locked === false) {
            const reason = text(body.note, 500); if (reason.length < 5) throw error(400, 'Oyni qayta ochish sababini yozing');
            if (month !== through) throw error(409, through ? `Faqat oxirgi yopilgan oyni (${through}) qayta ochish mumkin` : 'Yopilgan oy yo‘q');
            const snap = (await db.query('DELETE FROM fin_period_snapshots WHERE month=$1 RETURNING data', [month])).rows[0];
            const r = await db.query('DELETE FROM fin_period_locks WHERE month=$1 RETURNING month,locked_by_name,note', [month]);
            await audit(db, user, 'period-unlock', month, { lock: r.rows[0] || null, snapshot: snap?.data ? { createdAt: snap.data.createdAt, netAssets: snap.data.balance?.netAssets } : null }, { reason });
            return { ok: true, closedThrough: await closedThrough(db) };
        }
        if (F.monthEnd(month) >= F.today()) throw error(400, 'Faqat tugagan oyni yopish mumkin');
        if (through && month <= through) return { ok: true, alreadyLocked: true, closedThrough: through };
        const data = await load(db);
        const issues = closeReadiness(data, month);
        const note = text(body.note, 1000);
        if (issues.length && !(body.override === true && note.length >= 10))
            throw Object.assign(error(409, 'Oyni yopishdan oldin tuzating: ' + issues.join('; ') + '. Yoki sababini (kamida 10 belgi) yozib, ongli ravishda yoping'), { issues });
        // Hali yopilmagan barcha oylar (birinchi yozuvdan boshlab) uchun muzlatilgan nusxa olinadi.
        const first = [...data.receipts.map(r => r.date), ...data.transactions.map(t => t.date), ...data.payables.map(p => p.issueDate), ...data.salaries.map(s => s.accrualDate)].filter(Boolean).sort()[0] || month + '-01';
        const months = F.monthsBetween(first < month + '-01' ? first : month + '-01', month + '-01').filter(m => !through || m > through);
        for (const m of months) await db.query('INSERT INTO fin_period_snapshots(month,data) VALUES($1,$2) ON CONFLICT(month) DO UPDATE SET data=EXCLUDED.data,created_at=NOW()', [m, JSON.stringify(F.snapshotMonth(data, m))]);
        await db.query('INSERT INTO fin_period_locks(month,locked_by,locked_by_name,note) VALUES($1,$2,$3,$4)', [month, user.id, user.name, issues.length ? 'OGOHLANTIRISH BILAN: ' + note : note]);
        await audit(db, user, 'period-lock', month, { closedThrough: through || null }, { closedThrough: month, note, overriddenIssues: issues, snapshotMonths: months });
        return { ok: true, closedThrough: month, snapshotMonths: months };
    });
}
async function saveSettings(pool, actor, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor, { director: true });
        const row = (await db.query("SELECT data,revision FROM fin_settings WHERE id='main' FOR UPDATE")).rows[0];
        if (Number(body.revision) !== row.revision) throw error(409, 'Sozlamalarni boshqa foydalanuvchi o‘zgartirgan. Sahifani yangilang');
        const d = body.data || {}, cur = F.settingsOf({ settings: row.data });
        const int = (v, min, max, label) => { const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) throw error(400, `${label}: ${min}–${max} oralig‘ida butun son`); return n; };
        const rates = {};
        for (const k of Object.keys(F.DEFAULT_SETTINGS.eclRates)) rates[k] = int(d.eclRates?.[k] ?? cur.eclRates[k], 0, 100, 'ECL stavkasi (%)');
        const data = { ...row.data,
            courseMonths: { english: int(d.courseMonths?.english ?? cur.courseMonths.english, 1, 24, 'Kurs davomiyligi'), russian: int(d.courseMonths?.russian ?? cur.courseMonths.russian, 1, 24, 'Kurs davomiyligi') },
            suspiciousMin: int(d.suspiciousMin ?? cur.suspiciousMin, 0, 1000000, 'Shubhali summa'), salaryDueDays: int(d.salaryDueDays ?? cur.salaryDueDays, 0, 60, 'Maosh to‘lash muddati'),
            usefulLifeMonths: int(d.usefulLifeMonths ?? cur.usefulLifeMonths, 1, 240, 'Foydalanish muddati'), approvalLimit: int(d.approvalLimit ?? cur.approvalLimit, 0, 1e12, 'Tasdiqlash chegarasi'), eclRates: rates };
        await db.query("UPDATE fin_settings SET data=$1,revision=revision+1,updated_at=NOW() WHERE id='main'", [JSON.stringify(data)]);
        await audit(db, user, 'settings-update', 'main', row.data, data);
        return { revision: row.revision + 1 };
    });
}

// Eski "Cash Flow" (json) qo'lda kiritilgan yozuvlari bir marta, "ESKI YOZUV" belgisi bilan ko'chiriladi.
async function migrateLegacyCash(db) {
    if ((await db.query("SELECT 1 FROM fin_migrations WHERE id='legacy-cashflow-v1'")).rows.length) return;
    const manual = (await db.query("SELECT data FROM json_data WHERE key='cashFlow'").catch(() => ({ rows: [] }))).rows[0]?.data || [];
    const decisions = (await db.query('SELECT * FROM payment_cash_decisions').catch(() => ({ rows: [] }))).rows.map(r => ({ cashId: r.cash_id, recordId: r.record_id, decision: r.decision, snapshot: r.snapshot }));
    const records = (await db.query(`SELECT id,lead_id,student_id,language,amount,method,TO_CHAR(paid_date,'YYYY-MM-DD') AS paid_date FROM payment_records`)).rows
        .map(r => ({ id: r.id, leadId: r.lead_id, studentId: r.student_id, language: r.language, amount: Number(r.amount), method: r.method, paidDate: r.paid_date }));
    const rows = ledger.projectCash(Array.isArray(manual) ? manual : [], records, decisions).rows.filter(r => !r.ledgerGenerated);
    const accountOf = m => ({ 'Naqd pul': 'acc-cash', Karta: 'acc-card', Paylater: 'acc-card', 'Bank hisob raqami': 'acc-bank', 'Uzum Nasiya': 'acc-uzum' })[m] || 'acc-suspense';
    const closed = await closedThrough(db);
    for (const c of rows) {
        const amount = F.money(c.amount), day = F.date(c.date);
        if (!amount || !day || (closed && F.monthOf(day) <= closed)) continue;
        const purpose = String(c.purpose || '');
        let type, category;
        if (c.type === 'kirim') { if (c.category === 'investitsiya') { type = 'capital'; category = 'OWNER_IN'; } else { type = 'income'; category = 'REV_OTHER'; } }
        else if (/CEO|shaxsiy/i.test(purpose)) { type = 'drawing'; category = 'OWNER_OUT'; }
        else if (c.category === 'investitsiya') { type = 'expense'; category = /CRM/i.test(purpose) ? 'SOFTWARE' : 'CAPEX'; }
        else { type = 'expense'; category = /target/i.test(purpose) ? 'MKT_ADS' : /marketing/i.test(purpose) ? 'MKT_OTHER' : /CRM/i.test(purpose) ? 'SOFTWARE' : 'OTHER_EXP'; }
        const ent = c.lang === 'russian' || c.lang === 'english' ? c.lang : 'common';
        await db.query(`INSERT INTO fin_transactions(id,request_key,entity,txn_date,type,category_code,account_id,amount,counterparty,description,legacy,useful_life_months,actor_id,actor_name)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,$11,'system','Eski Cash Flow’dan ko‘chirildi') ON CONFLICT(request_key) DO NOTHING`,
            [randomUUID(), 'legacy-cf-' + String(c.id).slice(0, 60).padEnd(16, '0'), ent, day, type, category, accountOf(c.paymentMethod), amount,
                text(c.person, 200) || 'Noma’lum', text(['ESKI YOZUV', purpose, c.notes].filter(Boolean).join(' · '), 1000), category === 'CAPEX' ? 36 : null]);
    }
    await db.query("INSERT INTO fin_migrations(id) VALUES('legacy-cashflow-v1') ON CONFLICT DO NOTHING");
}

module.exports = { SCHEMA, initSchema, load, overview, cashbook, listTransactions, auditLog, people, storeEvidence, readEvidence, createTransaction, reverseTransaction,
    createPayable, voidPayable, recordSalaryPayment, voidReceipts, manualReceipt, batchCorrections, reconcile, saveAccount, addAccountCheck, closeStatus, lockMonth,
    saveSettings, assertOpen, verifyAuditChain, closeReadiness };
