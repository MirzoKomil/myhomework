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
ALTER TABLE salary_transactions ADD COLUMN IF NOT EXISTS basis JSONB;
CREATE TABLE IF NOT EXISTS salary_adjustments (
    id TEXT PRIMARY KEY, source_transaction_id TEXT NOT NULL REFERENCES salary_transactions(id),
    employee_id TEXT NOT NULL, language TEXT NOT NULL,
    amount BIGINT NOT NULL CHECK(amount <> 0), corrected_total BIGINT NOT NULL,
    evaluation_hash TEXT NOT NULL, evidence JSONB NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('approved','dismissed','superseded','settled')),
    reviewed_by TEXT NOT NULL, reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_adjustments_active
    ON salary_adjustments(source_transaction_id) WHERE status='approved';
ALTER TABLE salary_adjustments ADD COLUMN IF NOT EXISTS manual BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE salary_adjustments ADD COLUMN IF NOT EXISTS request_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_adjustments_request ON salary_adjustments(request_key) WHERE request_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS salary_adjustment_applications (
    adjustment_id TEXT NOT NULL REFERENCES salary_adjustments(id),
    salary_transaction_id TEXT NOT NULL REFERENCES salary_transactions(id),
    amount BIGINT NOT NULL CHECK(amount <> 0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(adjustment_id,salary_transaction_id)
);
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
function hash(value) { return createHash('sha256').update(stableJson(value)).digest('hex'); }
function createBasis(source, config, confirmation, row, rows) {
    const ids = row.role === 'rop' ? source.hrEmployees.filter(e => engine.role(e) === 'sales' && engine.language(e) === engine.language(source.hrEmployees.find(e => e.id === row.employeeId) || {})).map(e => e.id) : [];
    ids.push(row.employeeId);
    const students = source.students.filter(s => row.role === 'teacher' ? s.teacherId === row.employeeId : row.role === 'assistant' ? s.assistantTeacherId === row.employeeId : false)
        .map(s => ({ id: s.id, name: s.name, subject: s.subject, teacherId: s.teacherId, assistantTeacherId: s.assistantTeacherId,
            lessonDuration: s.lessonDuration, startDate: s.startDate, joinDate: s.joinDate }));
    return { version: 1, settings: config.data, revision: config.revision, confirmation,
        hrEmployees: source.hrEmployees.filter(e => ids.includes(e.id)).map(({ avatar, ...e }) => e),
        teachers: source.teachers.filter(t => t.id === row.employeeId), students,
        salesPlan: source.salesPlan, bonusData: source.bonusData,
        incoming: Object.fromEntries(rows.filter(r => ids.includes(r.employeeId)).map(r => [r.employeeId, r.adjustments || []])) };
}
async function correctionProposals(db, p, lang) {
    const paid = (await db.query(`SELECT *,TO_CHAR(period_start,'YYYY-MM-DD') AS start_key,
        TO_CHAR(period_end,'YYYY-MM-DD') AS end_key FROM salary_transactions
        WHERE language=$1 AND status='paid' AND period_end < $2 ORDER BY period_end,id`, [lang, p.start])).rows;
    if (!paid.length) return [];
    const ledger = (await db.query(`SELECT a.*,COALESCE(SUM(ap.amount),0) AS consumed FROM salary_adjustments a
        LEFT JOIN salary_adjustment_applications ap ON ap.adjustment_id=a.id
        WHERE a.source_transaction_id=ANY($1::text[]) GROUP BY a.id ORDER BY a.created_at,a.id`, [paid.map(r => r.id)])).rows;
    const cache = new Map(), proposals = [];
    for (const original of paid) {
        const old = original.calculation, basis = original.basis;
        const records = ledger.filter(a => a.source_transaction_id === original.id);
        const applied = records.reduce((sum, a) => sum + Number(a.consumed), 0);
        const originalBase = Number(original.amount) - Number(old.adjustmentTotal || 0);
        if (!basis?.settings || !basis.hrEmployees?.length) {
            const manual = records.find(a => a.status === 'approved' && a.manual);
            if (manual) {
                const amount = Number(manual.amount) - Number(manual.consumed);
                proposals.push({ sourceTransactionId: original.id, employeeId: original.employee_id, name: old.name,
                    role: old.role, roleLabel: old.roleLabel, avatar: old.avatar || '', sourceStart: original.start_key, sourceEnd: original.end_key,
                    originalBase, correctedTotal: Number(manual.corrected_total), applied, amount,
                    status: 'approved', manual: true, adjustmentId: manual.id, evaluationHash: manual.evaluation_hash,
                    reviewHash: hash({ evaluationHash: manual.evaluation_hash, amount, applied }),
                    warnings: ['Moliya xodimi qo‘lda tasdiqlagan: ' + manual.evidence.reason], evidence: manual.evidence });
                continue;
            }
            proposals.push({ sourceTransactionId: original.id, employeeId: original.employee_id, name: old.name,
                sourceStart: original.start_key, sourceEnd: original.end_key, legacy: true,
                warning: 'Eski to‘langan hisobda tarif/jadval nusxasi yo‘q. Avtomatik qayta baholanmaydi.' });
            continue;
        }
        const sourcePeriod = engine.period(original.start_key, original.end_key), key = sourcePeriod.start + ':' + sourcePeriod.end;
        if (!cache.has(key)) cache.set(key, await sources(db, sourcePeriod));
        const current = cache.get(key);
        // Employment contracts, tariffs and assignments are historical, not today's replacements.
        const history = { ...current, hrEmployees: basis.hrEmployees, teachers: basis.teachers || [],
            students: basis.students || [], salesPlan: basis.salesPlan || {}, bonusData: basis.bonusData || {} };
        const recalculated = engine.calculate(history, basis.settings, sourcePeriod, lang, basis.confirmation, [], basis.incoming || {});
        const corrected = recalculated.rows.find(r => r.employeeId === original.employee_id);
        if (!corrected || corrected.blocked) {
            proposals.push({ sourceTransactionId: original.id, name: old.name, sourceStart: original.start_key,
                sourceEnd: original.end_key, legacy: true, warning: 'Eski hisobning tasdiqlangan asosini tekshirish kerak.' });
            continue;
        }
        const correctedTotal = corrected.baseTotal ?? corrected.total;
        const delta = correctedTotal - originalBase - applied;
        const evaluationHash = hash({ corrected, warnings: recalculated.warnings });
        const approved = records.find(a => a.status === 'approved');
        const remaining = approved ? Number(approved.amount) - Number(approved.consumed) : 0;
        const valid = !!approved && approved.evaluation_hash === evaluationHash && remaining === delta;
        const dismissed = records.some(a => a.status === 'dismissed' && a.evaluation_hash === evaluationHash && Number(a.amount) === delta);
        if (!delta && !approved) continue;
        proposals.push({ sourceTransactionId: original.id, employeeId: original.employee_id, name: old.name,
            role: old.role, roleLabel: old.roleLabel, avatar: old.avatar || '', sourceStart: original.start_key, sourceEnd: original.end_key,
            originalBase, correctedTotal, applied, amount: delta, evaluationHash,
            reviewHash: hash({ evaluationHash, delta, applied }),
            status: valid ? 'approved' : dismissed ? 'dismissed' : 'pending', adjustmentId: valid ? approved.id : null,
            warnings: recalculated.warnings, evidence: { originalBase, corrected, applied, warnings: recalculated.warnings } });
    }
    return proposals;
}
async function reviewManualAdjustment(pool, actor, sourceId, input) {
    const p = engine.period(input.start, input.end), lang = language(input.language);
    const amount = input.amount, reason = String(input.reason || '').trim(), requestKey = String(input.requestKey || '');
    if (!Number.isSafeInteger(amount) || !amount || Math.abs(amount) > 1000000000000) throw error(400, 'Tuzatish summasi 0 dan farqli butun son bo‘lsin');
    if (reason.length < 10 || reason.length > 1000) throw error(400, 'Sabab 10–1000 belgi bo‘lsin');
    if (!/^[a-zA-Z0-9-]{20,80}$/.test(requestKey)) throw error(400, 'So‘rov identifikatori noto‘g‘ri');
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const retry = (await db.query('SELECT * FROM salary_adjustments WHERE request_key=$1', [requestKey])).rows[0];
        if (retry) {
            if (retry.source_transaction_id !== sourceId || retry.language !== lang || Number(retry.amount) !== amount || retry.evidence.reason !== reason) throw error(409, 'Bu so‘rov identifikatori avval ishlatilgan');
            return { ok: true, alreadyApproved: true };
        }
        const original = (await db.query("SELECT *,TO_CHAR(period_start,'YYYY-MM-DD') AS start_key,TO_CHAR(period_end,'YYYY-MM-DD') AS end_key FROM salary_transactions WHERE id=$1 FOR UPDATE", [sourceId])).rows[0];
        if (!original || original.status !== 'paid' || original.language !== lang || original.end_key >= p.start) throw error(400, 'Faqat oldingi to‘langan davrni tuzatish mumkin');
        if (original.basis) throw error(400, 'Bu hisobning farqi avtomatik hisoblanadi; avtomatik tuzatishni tekshiring');
        if ((await db.query("SELECT id FROM salary_adjustments WHERE source_transaction_id=$1 AND status='approved'", [sourceId])).rows.length) throw error(409, 'Avval mavjud tasdiqlangan tuzatishni yakunlang yoki bekor qiling');
        const applied = Number((await db.query(`SELECT COALESCE(SUM(ap.amount),0) AS total FROM salary_adjustment_applications ap
            JOIN salary_adjustments a ON a.id=ap.adjustment_id WHERE a.source_transaction_id=$1`, [sourceId])).rows[0].total);
        const originalBase = Number(original.amount) - Number(original.calculation.adjustmentTotal || 0);
        const id = randomUUID(), evidence = { manual: true, reason, originalBase, applied };
        await db.query(`INSERT INTO salary_adjustments(id,source_transaction_id,employee_id,language,amount,corrected_total,
            evaluation_hash,evidence,status,reviewed_by,manual,request_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'approved',$9,TRUE,$10)`,
        [id, sourceId, original.employee_id, lang, amount, originalBase + applied + amount, hash({ sourceId, requestKey, amount, reason }), JSON.stringify(evidence), user.id, requestKey]);
        await audit(db, user, 'manual-adjustment-approve', id, null, { sourceTransactionId: sourceId, amount, reason, applied });
        return { ok: true };
    });
}
async function reviewAdjustment(pool, actor, sourceId, input) {
    const p = engine.period(input.start, input.end), lang = language(input.language);
    if (!['approve', 'dismiss'].includes(input.decision)) throw error(400, 'Tuzatish qarorini tanlang');
    return transaction(pool, async db => {
        const user = await access(db, actor), proposals = await correctionProposals(db, p, lang);
        const proposal = proposals.find(r => r.sourceTransactionId === sourceId);
        if (!proposal || proposal.legacy || proposal.reviewHash !== input.reviewHash) throw error(409, 'Tuzatish ma’lumotlari o‘zgargan. Yangilang');
        if (proposal.status === 'approved' && input.decision === 'approve') return { ok: true, alreadyApproved: true };
        if (proposal.status === 'dismissed' && input.decision === 'dismiss') return { ok: true, alreadyDismissed: true };
        const previous = (await db.query("SELECT * FROM salary_adjustments WHERE source_transaction_id=$1 AND status='approved' FOR UPDATE", [sourceId])).rows;
        await db.query("UPDATE salary_adjustments SET status='superseded' WHERE source_transaction_id=$1 AND status='approved'", [sourceId]);
        let id = null;
        if (proposal.amount) {
            id = randomUUID();
            await db.query(`INSERT INTO salary_adjustments(id,source_transaction_id,employee_id,language,amount,corrected_total,
                evaluation_hash,evidence,status,reviewed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [id, sourceId, proposal.employeeId, lang, proposal.amount, proposal.correctedTotal, proposal.evaluationHash,
                JSON.stringify(proposal.evidence), input.decision === 'approve' ? 'approved' : 'dismissed', user.id]);
        }
        await audit(db, user, 'adjustment-' + input.decision, id || sourceId, previous, proposal);
        return { ok: true };
    });
}
async function calculate(db, p, lang, withCorrections = true) {
    const source = await sources(db, p), config = await settings(db, lang);
    const c = (await db.query(`SELECT * FROM salary_plan_confirmations WHERE language=$1 AND period_start=$2 AND period_end=$3`, [lang, p.start, p.end])).rows[0];
    const confirmation = c ? { amount: Number(c.amount), actorName: c.actor_name, confirmedAt: c.confirmed_at } : null;
    const saved = (await db.query(`SELECT * FROM salary_transactions WHERE language=$1 AND period_start=$2 AND period_end=$3`, [lang, p.start, p.end])).rows;
    const proposals = withCorrections ? await correctionProposals(db, p, lang) : [];
    const incoming = {};
    for (const proposal of proposals.filter(r => r.status === 'approved')) {
        incoming[proposal.employeeId] ||= [];
        incoming[proposal.employeeId].push({ id: proposal.adjustmentId, sourceTransactionId: proposal.sourceTransactionId,
            sourceStart: proposal.sourceStart, sourceEnd: proposal.sourceEnd, amount: proposal.amount });
        if (!source.hrEmployees.some(e => e.id === proposal.employeeId && engine.language(e) === lang)) {
            source.hrEmployees.push({ id: proposal.employeeId, name: proposal.name, role: proposal.role === 'sales' ? 'sotuv-menejeri'
                : proposal.role === 'teacher' ? (lang === 'russian' ? 'rus-oqituvchi' : 'ingliz-oqituvchi') : proposal.role === 'assistant' ? 'yordamchi' : 'rop',
                lang, startDate: p.start, _correctionOnly: true });
        }
    }
    const result = engine.calculate(source, config.data, p, lang, confirmation, saved.filter(t => t.status === 'paid').map(t => t.calculation), incoming);
    const rows = result.rows.map(row => {
        const transaction = saved.find(t => t.employee_id === row.employeeId);
        if (transaction?.status === 'paid') return { ...transaction.calculation, transactionId: transaction.id, status: 'paid', paidAt: transaction.paid_at, frozen: true };
        return { ...row, transactionId: transaction?.id || null, status: 'unpaid', saved: !!transaction,
            stale: !!transaction && stableJson(transaction.calculation) !== stableJson(row) };
    });
    // Paid employees remain visible even after HR deletion/reassignment.
    for (const t of saved) if (t.status === 'paid' && !rows.some(r => r.employeeId === t.employee_id)) rows.push({ ...t.calculation, transactionId: t.id, status: 'paid', paidAt: t.paid_at, frozen: true });
    const bases = Object.fromEntries(result.rows.filter(r => !saved.some(t => t.employee_id === r.employeeId && t.status === 'paid'))
        .map(row => [row.employeeId, createBasis(source, config, confirmation, row, result.rows)]));
    return { ...result, rows, corrections: proposals.map(({ evidence, evaluationHash, ...r }) => r),
        total: rows.reduce((sum, r) => sum + r.total, 0), revision: config.revision,
        sourceHash: hash({ result, revision: config.revision }), _bases: bases };
}
async function preview(pool, actor, input) {
    const p = engine.period(input.start, input.end), lang = language(input.language);
    return transaction(pool, async db => {
        await access(db, actor);
        const { _bases, ...result } = await calculate(db, p, lang);
        return result;
    });
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
            await db.query(`INSERT INTO salary_transactions(id,employee_id,language,period_start,period_end,amount,calculation,source_hash,basis)
                VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(employee_id,period_start,period_end) DO UPDATE
                SET amount=EXCLUDED.amount,calculation=EXCLUDED.calculation,source_hash=EXCLUDED.source_hash,basis=EXCLUDED.basis,updated_at=NOW()
                WHERE salary_transactions.status='unpaid'`, [id, row.employeeId, lang, p.start, p.end, row.total,
                    JSON.stringify(row), result.sourceHash, JSON.stringify(result._bases[row.employeeId])]);
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
        for (const adjustment of row.calculation.adjustments || []) {
            const ledger = (await db.query(`SELECT a.*,COALESCE(SUM(ap.amount),0) AS consumed FROM salary_adjustments a
                LEFT JOIN salary_adjustment_applications ap ON ap.adjustment_id=a.id WHERE a.id=$1 GROUP BY a.id`, [adjustment.id])).rows[0];
            const remaining = ledger ? Number(ledger.amount) - Number(ledger.consumed) : 0;
            if (!ledger || ledger.status !== 'approved' || ledger.employee_id !== row.employee_id || ledger.language !== row.language
                || Math.sign(remaining) !== Math.sign(adjustment.amount) || Math.abs(adjustment.amount) > Math.abs(remaining)) {
                throw error(409, 'Tuzatish boshqa hisobda ishlatilgan yoki o‘zgargan. Qayta shakllantiring');
            }
            await db.query(`INSERT INTO salary_adjustment_applications(adjustment_id,salary_transaction_id,amount)
                VALUES($1,$2,$3)`, [adjustment.id, id, adjustment.amount]);
            if (remaining === adjustment.amount) await db.query("UPDATE salary_adjustments SET status='settled' WHERE id=$1", [adjustment.id]);
            await audit(db, user, 'adjustment-apply', adjustment.id, { remaining }, { salaryTransactionId: id, amount: adjustment.amount, remaining: remaining - adjustment.amount });
        }
        await db.query("UPDATE salary_transactions SET status='paid',paid_at=NOW(),paid_by=$2,updated_at=NOW() WHERE id=$1", [id, user.id]);
        await audit(db, user, 'mark-paid', id, { status: 'unpaid' }, { status: 'paid', amount: row.amount });
        // No cash withdrawal here. A future expense transaction links its ID to cash_expense_id.
        return { ok: true };
    });
}
module.exports = { SCHEMA, initSchema, audit, access, language, transaction, sources, settings, calculate, preview,
    createBasis, correctionProposals, reviewAdjustment, reviewManualAdjustment, saveSettings, confirmPlan, accrue, markPaid };
