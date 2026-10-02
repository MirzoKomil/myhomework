const { randomUUID, createHash } = require('crypto');
const engine = require('../../js/payrollEngine');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS salary_kpi_settings (
    language TEXT PRIMARY KEY CHECK (language IN ('english','russian')),
    data JSONB NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS salary_plan_confirmations (
    language TEXT NOT NULL, period_start DATE NOT NULL, period_end DATE NOT NULL,
    amount BIGINT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL,
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(language,period_start,period_end)
);
CREATE TABLE IF NOT EXISTS salary_transactions (
    id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, language TEXT NOT NULL,
    period_start DATE NOT NULL, period_end DATE NOT NULL,
    amount BIGINT NOT NULL, calculation JSONB NOT NULL, source_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid','paid')),
    paid_at TIMESTAMPTZ, paid_by TEXT, cash_expense_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK(period_start <= period_end), UNIQUE(employee_id,period_start,period_end)
);
CREATE TABLE IF NOT EXISTS salary_audit (
    id BIGSERIAL PRIMARY KEY, action TEXT NOT NULL, entity_id TEXT NOT NULL,
    actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, before_data JSONB, after_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_salary_transactions_period ON salary_transactions(language,period_start,period_end);
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS kpi_template_id TEXT NOT NULL DEFAULT '';
`;
function error(status, message) { return Object.assign(new Error(message), { status }); }
function stableJson(value) {
    const normalize = v => Array.isArray(v) ? v.map(normalize) : v && typeof v === 'object' && !(v instanceof Date)
        ? Object.fromEntries(Object.keys(v).sort().map(k => [k, normalize(v[k])])) : v;
    return JSON.stringify(normalize(value));
}
function language(value) { if (!['english', 'russian'].includes(value)) throw error(400, 'Til noto‘g‘ri'); return value; }
async function initSchema(db) {
    await db.query(SCHEMA);
    for (const lang of ['english', 'russian']) await db.query(`INSERT INTO salary_kpi_settings(language,data)
        VALUES($1,$2) ON CONFLICT(language) DO NOTHING`, [lang, JSON.stringify(engine.defaults())]);
}
async function audit(db, actor, action, entity, before, after) {
    const actorName = actor.name || (actor.id && (await db.query('SELECT name FROM users WHERE id=$1', [actor.id])).rows[0]?.name);
    await db.query(`INSERT INTO salary_audit(action,entity_id,actor_id,actor_name,before_data,after_data)
        VALUES($1,$2,$3,$4,$5,$6)`, [action, entity, actor.id || 'system', actorName || actor.email || 'System',
        before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after)]);
}
async function transaction(pool, fn) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const db = await pool.connect();
        try {
            await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
            // One lock for accrual/confirmation/payment/settings prevents overlapping pay runs and races.
            await db.query("SELECT pg_advisory_xact_lock(hashtext('myhomework-payroll-v1'))");
            const result = await fn(db);
            await db.query('COMMIT'); return result;
        } catch (e) {
            await db.query('ROLLBACK');
            if (!['40001', '40P01'].includes(e.code) || attempt === 2) throw e;
        } finally { db.release(); }
    }
}
async function access(db, actor, mode = 'finance') {
    const { rows } = await db.query(`SELECT u.id,u.name,u.email,u.role,he.department,he.lang AS employee_lang FROM users u
        LEFT JOIN hr_employees he ON LOWER(TRIM(he.login))=LOWER(TRIM(u.email)) WHERE u.id=$1`, [actor.id]);
    const user = rows[0];
    if (!user) throw error(403, 'Akkaunt topilmadi');
    const finance = ['admin', 'boshliq', 'finance', 'accountant'].includes(user.role)
        || (user.role === 'employee' && ['moliya', 'finance'].includes(String(user.department).toLowerCase()));
    if (!finance && !(mode === 'leaderboard' && ['rop', 'sales_manager'].includes(user.role))) throw error(403, 'Moliya bo‘limiga ruxsat yo‘q');
    return { ...actor, ...user, finance };
}
async function sources(db, p) {
    const employees = (await db.query(`SELECT he.*, COALESCE(u.avatar,'') AS avatar FROM hr_employees he
        LEFT JOIN users u ON LOWER(TRIM(u.email))=LOWER(TRIM(he.login)) ORDER BY he.name`)).rows;
    const teachers = (await db.query('SELECT * FROM teachers ORDER BY id')).rows;
    const students = (await db.query('SELECT * FROM students ORDER BY id')).rows;
    const leads = (await db.query('SELECT * FROM leads WHERE deleted_at IS NULL ORDER BY id')).rows;
    const monthKeys = engine.months(p).map(b => b.key);
    const attendance = async table => {
        const rows = (await db.query(`SELECT att_key,student_id,day FROM ${table} WHERE present=1 AND LEFT(att_key,7)=ANY($1::text[])`, [monthKeys])).rows;
        const out = {};
        for (const r of rows) { out[r.att_key] ||= {}; out[r.att_key][r.student_id] ||= {}; out[r.att_key][r.student_id][r.day] = 1; }
        return out;
    };
    const json = (await db.query("SELECT key,data FROM json_data WHERE key=ANY($1::text[])", [['salesPlan', 'bonusHistory', 'bonusData', 'cashFlow']])).rows;
    const blob = Object.fromEntries(json.map(r => [r.key, r.data]));
    return { hrEmployees: employees.map(r => ({ id: r.id, name: r.name, role: r.role, lang: r.lang, avatar: r.avatar,
        status: r.status, startDate: r.start_date, joinDate: r.join_date, kpiTemplateId: r.kpi_template_id })),
        teachers: teachers.map(r => ({ id: r.id, schedulePattern: r.schedule_pattern, lessonDuration: r.lesson_duration })),
        students: students.map(r => ({ ...(r.extra_data || {}), id: r.id, name: r.name, subject: r.subject,
            teacherId: r.teacher_id, assistantTeacherId: r.assistant_teacher_id, lessonDuration: r.lesson_duration })),
        leads: { english: leads.filter(r => r.language !== 'russian').map(mapLead), russian: leads.filter(r => r.language === 'russian').map(mapLead) },
        mainAttendance: await attendance('main_attendance'), assistantAttendance: await attendance('assistant_attendance'),
        salesPlan: blob.salesPlan || {}, bonusHistory: Array.isArray(blob.bonusHistory) ? blob.bonusHistory : [],
        bonusData: blob.bonusData || {}, cashFlow: Array.isArray(blob.cashFlow) ? blob.cashFlow : [] };
}
function mapLead(r) { return { ...(r.extra_data || {}), id: r.id, managerId: r.manager_id, status: r.status, deletedAt: r.deleted_at }; }
async function settings(db, lang) {
    const row = (await db.query('SELECT * FROM salary_kpi_settings WHERE language=$1', [lang])).rows[0];
    if (!row) throw error(503, 'KPI sozlamalari hali tayyor emas');
    return { data: row.data, revision: row.revision };
}
async function calculate(db, p, lang) {
    const source = await sources(db, p), config = await settings(db, lang);
    const c = (await db.query(`SELECT * FROM salary_plan_confirmations WHERE language=$1 AND period_start=$2 AND period_end=$3`, [lang, p.start, p.end])).rows[0];
    const confirmation = c ? { amount: Number(c.amount), actorName: c.actor_name, confirmedAt: c.confirmed_at } : null;
    const saved = (await db.query(`SELECT * FROM salary_transactions WHERE language=$1 AND period_start=$2 AND period_end=$3`, [lang, p.start, p.end])).rows;
    const result = engine.calculate(source, config.data, p, lang, confirmation, saved.filter(t => t.status === 'paid').map(t => t.calculation));
    const rows = result.rows.map(row => {
        const transaction = saved.find(t => t.employee_id === row.employeeId);
        if (transaction?.status === 'paid') return { ...transaction.calculation, transactionId: transaction.id, status: 'paid', paidAt: transaction.paid_at, frozen: true };
        return { ...row, transactionId: transaction?.id || null, status: 'unpaid', saved: !!transaction,
            stale: !!transaction && stableJson(transaction.calculation) !== stableJson(row) };
    });
    // Paid employees remain visible even after HR deletion/reassignment.
    for (const t of saved) if (t.status === 'paid' && !rows.some(r => r.employeeId === t.employee_id)) rows.push({ ...t.calculation, transactionId: t.id, status: 'paid', paidAt: t.paid_at, frozen: true });
    return { ...result, rows, total: rows.reduce((sum, r) => sum + r.total, 0), revision: config.revision,
        sourceHash: createHash('sha256').update(stableJson({ result, revision: config.revision })).digest('hex') };
}
async function preview(pool, actor, input) {
    const p = engine.period(input.start, input.end), lang = language(input.language);
    return transaction(pool, async db => { await access(db, actor); return calculate(db, p, lang); });
}
async function saveSettings(pool, actor, lang, value, revision) {
    language(lang); const data = engine.validateSettings(value);
    return transaction(pool, async db => {
        const user = await access(db, actor), before = await settings(db, lang);
        if (before.revision !== revision) throw error(409, 'Sozlamalar boshqa xodim tomonidan yangilangan. Sahifani yangilang');
        await db.query('UPDATE salary_kpi_settings SET data=$2,revision=revision+1,updated_at=NOW() WHERE language=$1', [lang, JSON.stringify(data)]);
        await audit(db, user, 'settings', lang, before.data, data);
        return { data, revision: revision + 1 };
    });
}
async function confirmPlan(pool, actor, input) {
    const p = engine.period(input.start, input.end), lang = language(input.language);
    return transaction(pool, async db => {
        const user = await access(db, actor), source = await sources(db, p);
        const amount = engine.salesPlan(source, lang, p);
        if (amount === null || amount <= 0) throw error(400, 'Avval Sotuv rejasi sahifasida o‘rtacha reja kiriting');
        if (amount !== input.amount) throw error(409, 'Sotuv rejasi o‘zgargan. Yangilab qayta tasdiqlang');
        const before = (await db.query('SELECT * FROM salary_plan_confirmations WHERE language=$1 AND period_start=$2 AND period_end=$3', [lang, p.start, p.end])).rows[0];
        await db.query(`INSERT INTO salary_plan_confirmations(language,period_start,period_end,amount,actor_id,actor_name)
            VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(language,period_start,period_end) DO UPDATE
            SET amount=EXCLUDED.amount,actor_id=EXCLUDED.actor_id,actor_name=EXCLUDED.actor_name,confirmed_at=NOW()`, [lang, p.start, p.end, amount, user.id, user.name]);
        await audit(db, user, 'confirm-plan', `${lang}:${p.start}:${p.end}`, before, { amount });
        return { ok: true };
    });
}
async function accrue(pool, actor, input) {
    const p = engine.period(input.start, input.end), lang = language(input.language);
    return transaction(pool, async db => {
        const user = await access(db, actor), result = await calculate(db, p, lang);
        if (result.sourceHash !== input.sourceHash) throw error(409, 'Manba ma’lumotlari o‘zgardi. Qayta hisoblang');
        if (result.rows.some(r => r.blocked && r.status !== 'paid')) throw error(400, 'ROP uchun rejani tasdiqlang');
        for (const display of result.rows) {
            if (display.status === 'paid') continue;
            const overlap = (await db.query(`SELECT id FROM salary_transactions WHERE employee_id=$1 AND status='paid'
                AND period_start <= $3 AND period_end >= $2`, [display.employeeId, p.start, p.end])).rows;
            if (overlap.length) throw error(409, display.name + ': ushbu davr oldin to‘langan davr bilan kesishadi');
            const { transactionId, status, saved, stale, ...row } = display;
            const before = (await db.query('SELECT calculation FROM salary_transactions WHERE employee_id=$1 AND period_start=$2 AND period_end=$3', [row.employeeId, p.start, p.end])).rows[0];
            const id = transactionId || randomUUID();
            await db.query(`INSERT INTO salary_transactions(id,employee_id,language,period_start,period_end,amount,calculation,source_hash)
                VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(employee_id,period_start,period_end) DO UPDATE
                SET amount=EXCLUDED.amount,calculation=EXCLUDED.calculation,source_hash=EXCLUDED.source_hash,updated_at=NOW()
                WHERE salary_transactions.status='unpaid'`, [id, row.employeeId, lang, p.start, p.end, row.total, JSON.stringify(row), result.sourceHash]);
            await audit(db, user, 'accrue', id, before?.calculation, row);
        }
        return { ok: true };
    });
}
async function markPaid(pool, actor, id) {
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const row = (await db.query("SELECT *,TO_CHAR(period_start,'YYYY-MM-DD') AS start_key,TO_CHAR(period_end,'YYYY-MM-DD') AS end_key FROM salary_transactions WHERE id=$1 FOR UPDATE", [id])).rows[0];
        if (!row) throw error(404, 'Maosh hisobi topilmadi');
        if (row.status === 'paid') return { ok: true, alreadyPaid: true };
        if (Number(row.amount) < 0) throw error(400, 'Manfiy hisobni to‘langan deb belgilab bo‘lmaydi');
        const p = engine.period(row.start_key, row.end_key);
        const current = await calculate(db, p, row.language);
        const fresh = current.rows.find(r => r.employeeId === row.employee_id);
        if (!fresh || fresh.stale || fresh.blocked) throw error(409, 'Hisob eskirgan. Maoshlarni qayta shakllantiring');
        const overlap = (await db.query(`SELECT id FROM salary_transactions WHERE employee_id=$1 AND status='paid'
            AND period_start <= $3 AND period_end >= $2`, [row.employee_id, p.start, p.end])).rows;
        if (overlap.length) throw error(409, 'Ushbu davrning maoshi oldin to‘langan');
        await db.query("UPDATE salary_transactions SET status='paid',paid_at=NOW(),paid_by=$2,updated_at=NOW() WHERE id=$1", [id, user.id]);
        await audit(db, user, 'mark-paid', id, { status: 'unpaid' }, { status: 'paid', amount: row.amount });
        // No cash withdrawal here. A future expense transaction links its ID to cash_expense_id.
        return { ok: true };
    });
}
module.exports = { SCHEMA, initSchema, audit, access, language, transaction, sources, settings, calculate, preview, saveSettings, confirmPlan, accrue, markPaid };
