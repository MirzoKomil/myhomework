const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const ledger = require('../../js/paymentLedger');
const STUDENT_LOCK = "SELECT pg_advisory_xact_lock(hashtext('lead-student-provisioning'))";
const error = (status, message) => Object.assign(new Error(message), { status });
// pg parses DATE at host-local midnight; UTC conversion could change the accounting day.
const dateKey = value => ledger.date(value instanceof Date ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` : value);
function proofExists(url) {
    if (!ledger.receipt(url)) return false;
    const dir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '../../data');
    try { return fs.statSync(path.join(dir, 'uploads', path.basename(url))).isFile(); } catch { return false; }
}
const SCHEMA = `
CREATE TABLE IF NOT EXISTS payment_records (
 id TEXT PRIMARY KEY, source_key TEXT NOT NULL UNIQUE, lead_id TEXT, student_id TEXT,
 language TEXT NOT NULL CHECK(language IN ('english','russian')), manager_id TEXT NOT NULL DEFAULT '',
 teacher_id TEXT NOT NULL DEFAULT '', paid_date DATE NOT NULL, paid_at TIMESTAMPTZ,
 amount BIGINT NOT NULL CHECK(amount>0 AND amount<=9007199254740991), method TEXT NOT NULL CHECK(method IN ('card','uzum','paylater','bank','payme','click','cash','unknown')),
 receipt_url TEXT NOT NULL DEFAULT '', tariff INTEGER, form TEXT NOT NULL CHECK(form IN ('full','partial')),
 debt_snapshot BIGINT NOT NULL DEFAULT 0 CHECK(debt_snapshot>=0), snapshot JSONB NOT NULL,
 legacy_review BOOLEAN NOT NULL DEFAULT FALSE, actor_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payment_records_period ON payment_records(language,paid_date);
CREATE INDEX IF NOT EXISTS payment_records_student ON payment_records(student_id);
CREATE INDEX IF NOT EXISTS payment_records_lead ON payment_records(lead_id);
CREATE TABLE IF NOT EXISTS payment_audit (
 id BIGSERIAL PRIMARY KEY, record_id TEXT NOT NULL, action TEXT NOT NULL,
 actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS payment_migration_issues (
 source_key TEXT PRIMARY KEY, reason TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS payment_migrations (id TEXT PRIMARY KEY, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
`;
async function initSchema(db) { await db.query(SCHEMA); }
async function transaction(pool, fn) {
    const db = await pool.connect();
    try { await db.query('BEGIN'); const result = await fn(db); await db.query('COMMIT'); return result; }
    catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
async function access(db, actor, write = false, subject = null) {
    // Never trust a role, language, credited manager or identity sent in the request/JWT alone.
    const u = (await db.query(`SELECT u.id,u.name,u.email,u.role,COALESCE(link.manager_id,he.id) AS manager_id,COALESCE(he.lang,assigned.lang) AS lang,he.department FROM users u
        LEFT JOIN hr_employees he ON LOWER(TRIM(he.login))=LOWER(TRIM(u.email))
        LEFT JOIN user_sales_manager_links link ON link.user_id=u.id LEFT JOIN hr_employees assigned ON assigned.id=link.manager_id WHERE u.id=$1`, [actor.id])).rows[0];
    if (!u) throw error(403, 'Akkaunt topilmadi');
    const finance = ['admin', 'boshliq', 'finance', 'accountant'].includes(u.role)
        || (u.role === 'employee' && ['finance', 'moliya'].includes(String(u.department).toLowerCase()));
    if (!finance && (!write || !['sales_manager', 'rop'].includes(u.role))) throw error(403, 'To‘lovlarga ruxsat yo‘q');
    if (!finance && subject && (u.lang !== subject.language || (u.role === 'sales_manager' && u.manager_id !== subject.managerId))) throw error(403, 'Bu o‘quvchining to‘loviga ruxsat yo‘q');
    return { ...u, finance };
}
function student(row) {
    return row && { ...(row.extra_data || {}), id: row.id, name: row.name, phone: row.phone, subject: row.subject,
        teacherId: row.teacher_id, group: row.group_name, lessonDuration: row.lesson_duration };
}
function safeStudent(s) { const { password, passwordHash, ...out } = s; return { ...out, hasPassword: !!passwordHash }; }
async function insert(db, event, context, actor, legacy = false) {
    const existing = (await db.query('SELECT * FROM payment_records WHERE source_key=$1', [event.sourceKey])).rows[0];
    if (existing) {
        if (Number(existing.amount) !== event.amount || dateKey(existing.paid_date) !== event.paidDate) throw error(409, 'Saqlangan tushumni o‘zgartirib bo‘lmaydi. Moliya bilan tekshiring');
        return { id: existing.id, inserted: false };
    }
    if (!legacy) {
        if (event.method === 'unknown' || !Object.hasOwn(ledger.METHODS, event.method)) throw error(400, 'To‘lov usulini tanlang');
        if (!ledger.receipt(event.receiptUrl)) throw error(400, 'To‘lov chekini yuklang');
        if (!proofExists(event.receiptUrl)) throw error(400, 'Chek fayli serverda topilmadi. Qayta yuklang');
        if (event.paidDate > ledger.today()) throw error(400, 'Tushum sanasi kelajakda bo‘lishi mumkin emas');
    }
    const id = randomUUID(), review = legacy && (event.method === 'unknown' || !proofExists(event.receiptUrl));
    const snapshot = { name: context.name || '', phone: context.phone || '', managerName: context.managerName || '', teacherName: context.teacherName || '',
        nextPaymentDate: context.nextPaymentDate || '', total: event.total, timeKnown: !!event.paidAt };
    await db.query(`INSERT INTO payment_records(id,source_key,lead_id,student_id,language,manager_id,teacher_id,paid_date,paid_at,
        amount,method,receipt_url,tariff,form,debt_snapshot,snapshot,legacy_review,actor_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [id, event.sourceKey, context.leadId || null, context.studentId || null, context.language, context.managerId || '', context.teacherId || '', event.paidDate,
            event.paidAt || null, event.amount, event.method, event.receiptUrl || '', event.tariff || null, event.form || 'partial', event.debt || 0,
            JSON.stringify(snapshot), review, actor.id || 'system']);
    await db.query('INSERT INTO payment_audit(record_id,action,actor_id,actor_name,data) VALUES($1,$2,$3,$4,$5)',
        [id, legacy ? 'legacy-import' : 'accepted', actor.id || 'system', actor.name || 'System', JSON.stringify({ ...event, ...context, legacyReview: review })]);
    return { id, inserted: true };
}
async function context(db, lead, s) {
    const managerId = lead?.managerId || s?.managerId || '', teacherId = s?.teacherId || lead?.paymentOnboarding?.teacherId || '';
    const managerName = (await db.query('SELECT name FROM hr_employees WHERE id=$1', [managerId])).rows[0]?.name || '';
    const teacherName = (await db.query('SELECT name FROM teachers WHERE id=$1', [teacherId])).rows[0]?.name
        || (await db.query('SELECT name FROM hr_employees WHERE id=$1', [teacherId])).rows[0]?.name || '';
    return { leadId: lead?.id || s?.leadRef?.id, studentId: s?.id, language: lead?.language || s?.subject || 'english',
        managerId, teacherId, managerName, teacherName, name: s?.name || lead?.name, phone: s?.phone || lead?.phone,
        nextPaymentDate: s?.paymentDueDate || lead?.paymentSurvey?.nextPaymentDate || '' };
}
async function issue(db, key, reason) {
    await db.query('INSERT INTO payment_migration_issues(source_key,reason) VALUES($1,$2) ON CONFLICT(source_key) DO UPDATE SET reason=EXCLUDED.reason', [key, reason]);
}
function paymentIdentity(lead) {
    const ps = lead?.paymentSurvey || {}, pc = lead?.paymentClosedSurvey || {};
    return JSON.stringify([lead?.status, ...['paymentType', 'paidAmount', 'debtAmount', 'totalAmount', 'lastPaymentDate', 'tariff'].map(k => ps[k] ?? null),
        ...['actualAmount', 'closedDate', 'installmentReceived', 'installmentReceivedDate'].map(k => pc[k] ?? null)]);
}
async function syncLead(db, lead, platformAccess, actor, legacy = false, priorLead = null) {
    if (!legacy && !['tolov-jarayonida', 'tolov-yopildi'].includes(lead.status)) return;
    const s = platformAccess?.student, inferred = ledger.leadEvents(lead);
    if (!legacy && actor.id && !actor.name) actor = { ...actor, name: (await db.query('SELECT name FROM users WHERE id=$1', [actor.id])).rows[0]?.name || actor.email };
    if (s) await db.query('UPDATE payment_records SET student_id=$2 WHERE lead_id=$1 AND student_id IS NULL', [lead.id, s.id]);
    const ctx = await context(db, lead, s);
    if (!legacy && paymentIdentity(lead) !== paymentIdentity(priorLead) && lead.status === 'tolov-yopildi'
        && ledger.money(lead.paymentClosedSurvey?.actualAmount) === 0 && ledger.money(lead.paymentSurvey?.totalAmount) > 0
        && (lead.paymentSurvey?.paymentType !== 'installment' || lead.paymentClosedSurvey?.installmentReceived === 'yes')) throw error(400, 'Qabul qilingan to‘lov summasi musbat bo‘lishi kerak');
    if (legacy) for (const item of inferred.issues) await issue(db, 'lead:' + lead.id + ':' + item.kind, item.reason);
    else if (inferred.issues.length && paymentIdentity(lead) !== paymentIdentity(priorLead)) throw error(400, inferred.issues[0].reason);
    let changed = false;
    for (const e of inferred.events) {
        const sourceKey = 'lead:' + lead.id + ':' + e.kind;
        const existing = (await db.query('SELECT * FROM payment_records WHERE source_key=$1', [sourceKey])).rows[0];
        let amount = e.amount;
        if (e.kind === 'closing') {
            // actualAmount is cumulative, including deposits and receipts accepted through Debtors.
            const total = Number((await db.query('SELECT COALESCE(SUM(amount),0) AS amount FROM payment_records WHERE lead_id=$1', [lead.id])).rows[0].amount) + (ledger.money(s?.paymentLedgerOpeningPaid) || 0);
            const cumulative = ledger.money(lead.paymentClosedSurvey?.actualAmount);
            if (existing) {
                if (cumulative !== total) throw error(409, 'Saqlangan yakuniy tushum summasi o‘zgartirilmasligi kerak');
                amount = Number(existing.amount);
            } else {
                if (cumulative < total) {
                    if (legacy) { await issue(db, sourceKey, 'Jami summa oldingi tushumlardan kam'); continue; }
                    throw error(409, 'Jami qabul qilingan summa oldingi tushumlardan kam');
                }
                amount = cumulative - total;
                if (!amount) continue;
            }
        }
        const result = await insert(db, { ...e, amount, sourceKey, form: e.kind === 'closing' ? 'full' : 'partial', debt: e.kind === 'closing' ? 0 : ledger.money(lead.paymentSurvey?.debtAmount) || 0 }, ctx, actor, legacy);
        changed ||= result.inserted;
    }
    if (!legacy && s) {
        const records = (await db.query('SELECT amount,TO_CHAR(paid_date,\'YYYY-MM-DD\') AS date FROM payment_records WHERE student_id=$1 OR lead_id=$2 ORDER BY paid_date,id', [s.id, lead.id])).rows;
        if (records.length || platformAccess.credentialsCreated) {
            const paid = records.reduce((a, r) => a + Number(r.amount), ledger.money(s.paymentLedgerOpeningPaid) || 0), total = ledger.money(lead.paymentSurvey?.totalAmount);
            const ps = lead.paymentSurvey || {};
            const partialDebt = ps.paymentType === 'partial' && ledger.money(ps.debtAmount) != null ? Math.max(0, ledger.money(ps.debtAmount) - (paid - (ledger.money(ps.paidAmount) || 0))) : null;
            const updated = { ...s, paidAmount: paid, debtAmount: lead.status === 'tolov-yopildi' && lead.paymentClosedSurvey?.noDebtConfirmed ? 0 : partialDebt ?? (total == null ? Math.max(0, Number(s.debtAmount) || 0) : Math.max(0, total - paid)),
                paymentLedgerManaged: true, paymentCount: records.length, lastPaymentDate: records.at(-1)?.date || '' };
            // Only a newly accepted receipt activates a paused account; re-saving a lead does not.
            if (changed) { updated.status = 'active'; updated.frozen = false; }
            await db.query('UPDATE students SET extra_data=extra_data || $2::jsonb WHERE id=$1', [s.id, JSON.stringify({ paidAmount: updated.paidAmount, debtAmount: updated.debtAmount,
                paymentLedgerManaged: true, paymentCount: updated.paymentCount, lastPaymentDate: updated.lastPaymentDate, ...(changed ? { status: 'active', frozen: false } : {}) })]);
            platformAccess.student = updated;
        }
    }
}
async function migrate(db) {
    await db.query("SELECT pg_advisory_xact_lock(hashtext('inflow-migration-v1'))");
    if ((await db.query("SELECT id FROM payment_migrations WHERE id='legacy-v1'")).rows.length) return { skipped: true };
    const students = (await db.query('SELECT * FROM students ORDER BY id')).rows.map(student);
    const leads = (await db.query('SELECT * FROM leads ORDER BY id')).rows;
    const linked = new Set();
    for (const row of leads) {
        const lead = { ...(row.extra_data || {}), id: row.id, name: row.name, phone: row.phone, managerId: row.manager_id, language: row.language, status: row.status };
        const s = students.find(s => s.leadRef?.id === lead.id && s.subject === lead.language);
        if (s) linked.add(s.id);
        await syncLead(db, lead, s ? { student: s } : null, { id: 'system', name: 'Eski to‘lovlarni ko‘chirish' }, true);
    }
    for (const row of (await db.query('SELECT * FROM payments ORDER BY id')).rows) {
        const amount = ledger.money(row.paid), paidDate = ledger.date(row.date), key = 'academic:' + row.id;
        if (!amount && amount !== null) continue;
        const s = students.find(s => s.id === row.student_id);
        if (!s || linked.has(s.id)) { await issue(db, key, 'O‘quvchi aniqlanmagan yoki lid tushumi bilan ustma-ust tushishi mumkin — qo‘lda tekshirish kerak'); continue; }
        if (amount == null || !paidDate) { await issue(db, key, 'Aniq summa yoki sana yo‘q'); continue; }
        await insert(db, { sourceKey: key, amount, paidDate, method: 'unknown', tariff: s.lessonDuration,
            form: Number(row.debt) > 0 ? 'partial' : 'full', debt: Math.max(0, Number(row.debt) || 0) }, await context(db, null, s), { id: 'system' }, true);
    }
    for (const s of students) if (Number(s.paidAmount) > 0 && !(await db.query('SELECT id FROM payment_records WHERE student_id=$1 LIMIT 1', [s.id])).rows.length)
        await issue(db, 'student:' + s.id, 'Faqat jamlangan to‘lov mavjud; alohida tushum summasi/sanasi isbotlanmagan');
    await db.query("INSERT INTO payment_migrations(id) VALUES('legacy-v1')");
    return { records: Number((await db.query('SELECT COUNT(*) AS n FROM payment_records')).rows[0].n), issues: Number((await db.query('SELECT COUNT(*) AS n FROM payment_migration_issues')).rows[0].n) };
}
async function list(db, actor, params) {
    await access(db, actor);
    if (!['english', 'russian'].includes(params.language)) throw error(400, 'Tilni tanlang');
    if (params.start && !ledger.date(params.start) || params.end && !ledger.date(params.end) || params.start && params.end && params.start > params.end) throw error(400, 'Sana oralig‘i noto‘g‘ri');
    const rows = (await db.query(`SELECT r.*,TO_CHAR(r.paid_date,'YYYY-MM-DD') AS date_key,
        TO_CHAR(r.paid_at AT TIME ZONE 'Asia/Tashkent','HH24:MI') AS time_key, s.extra_data AS current_student
        FROM payment_records r LEFT JOIN students s ON s.id=r.student_id WHERE r.language=$1 ORDER BY r.paid_date DESC,r.created_at DESC,r.id`, [params.language])).rows;
    const lastBalance = new Map();
    for (const r of [...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))) { const key = r.student_id || r.lead_id || r.id; if (!lastBalance.has(key)) lastBalance.set(key, Number(r.debt_snapshot)); }
    const records = rows.map(r => ({ id: r.id, leadId: r.lead_id, studentId: r.student_id, language: r.language, managerId: r.manager_id, teacherId: r.teacher_id,
        ...r.snapshot, paidDate: r.date_key, paidTime: r.time_key || '', amount: Number(r.amount), method: r.method, receiptUrl: r.receipt_url,
        tariff: r.tariff, form: r.form, debt: ledger.money(r.current_student?.debtAmount) ?? lastBalance.get(r.student_id || r.lead_id || r.id),
        nextPaymentDate: r.current_student?.paymentDueDate || r.snapshot.nextPaymentDate || '', legacyReview: r.legacy_review }));
    const filtered = ledger.filter(records, params);
    const issues = (await db.query('SELECT COUNT(*) AS n FROM payment_migration_issues')).rows[0].n;
    const migrationIssues = (await db.query('SELECT source_key,reason FROM payment_migration_issues ORDER BY source_key LIMIT 100')).rows;
    return { records: filtered, summary: ledger.summary(filtered), migrationIssueCount: Number(issues), migrationIssues };
}
async function receive(pool, actor, body) {
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(body.requestKey || '')) throw error(400, 'So‘rov identifikatori noto‘g‘ri');
    const amount = ledger.money(body.amount), paidDate = ledger.date(body.paidDate), method = ledger.method(body.method), receiptUrl = ledger.receipt(body.receiptUrl);
    if (!amount || !paidDate || method === 'unknown' || !receiptUrl) throw error(400, 'Summa, sana, to‘lov usuli va chek majburiy');
    if (paidDate > ledger.today()) throw error(400, 'To‘lov sanasi kelajakda bo‘lishi mumkin emas');
    const time = body.paidTime || '';
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw error(400, 'Vaqt noto‘g‘ri');
    return transaction(pool, async db => {
        let row = (await db.query('SELECT * FROM students WHERE id=$1', [body.studentId])).rows[0];
        if (!row) throw error(404, 'O‘quvchi topilmadi');
        let s = student(row), lead = null;
        // Same lock order as lead update: lead row -> provisioning lock -> student row.
        if (s.leadRef?.id) {
            const lr = (await db.query('SELECT * FROM leads WHERE id=$1 FOR UPDATE', [s.leadRef.id])).rows[0];
            if (lr) lead = { ...(lr.extra_data || {}), id: lr.id, name: lr.name, phone: lr.phone, managerId: lr.manager_id, language: lr.language, status: lr.status };
        }
        await db.query(STUDENT_LOCK);
        row = (await db.query('SELECT * FROM students WHERE id=$1 FOR UPDATE', [body.studentId])).rows[0];
        if (!row) throw error(404, 'O‘quvchi topilmadi');
        s = student(row);
        const ctx = await context(db, lead, s), user = await access(db, actor, true, ctx);
        const key = 'receipt:' + body.requestKey;
        const prior = (await db.query('SELECT * FROM payment_records WHERE source_key=$1', [key])).rows[0];
        if (prior) {
            if (prior.student_id !== s.id || Number(prior.amount) !== amount || prior.method !== method || prior.receipt_url !== receiptUrl || dateKey(prior.paid_date) !== paidDate
                || (prior.paid_at ? new Date(prior.paid_at).toISOString() : '') !== (time ? new Date(paidDate + 'T' + time + ':00+05:00').toISOString() : '')) throw error(409, 'So‘rov identifikatori boshqa to‘lovga ishlatilgan');
            return { id: prior.id, student: safeStudent(s), duplicate: true };
        }
        const debt = ledger.money(s.debtAmount);
        if (debt == null || amount > debt) throw error(409, 'To‘lov joriy qarzdan oshmasligi kerak. Sahifani yangilang');
        if (ledger.money(body.expectedDebt) !== debt) throw error(409, 'Qarz o‘zgargan. Sahifani yangilang');
        const paid = ledger.money(s.paidAmount) || 0;
        const recorded = Number((await db.query('SELECT COALESCE(SUM(amount),0) AS amount FROM payment_records WHERE student_id=$1', [s.id])).rows[0].amount);
        // A cumulative legacy balance is not a dated receipt and must not be invented as income.
        const openingPaid = s.paymentLedgerManaged ? (ledger.money(s.paymentLedgerOpeningPaid) || 0) : Math.max(0, paid - recorded);
        if (!Number.isSafeInteger(paid + amount)) throw error(400, 'Summa chegaradan oshdi');
        const result = await insert(db, { sourceKey: key, amount, paidDate, paidAt: time ? paidDate + 'T' + time + ':00+05:00' : null, method, receiptUrl,
            total: paid + debt, tariff: Number(s.lessonDuration), form: amount === debt ? 'full' : 'partial', debt: debt - amount }, ctx, user);
        const extras = { paidAmount: paid + amount, debtAmount: debt - amount, lastPaymentDate: paidDate, paymentCount: (Number(s.paymentCount) || 0) + 1,
            paymentLedgerManaged: true, paymentLedgerOpeningPaid: openingPaid, status: 'active', frozen: false, ...(debt === amount ? { paymentDueDate: '' } : {}) };
        await db.query('UPDATE students SET extra_data=extra_data || $2::jsonb WHERE id=$1', [s.id, JSON.stringify(extras)]);
        // Keep authorship in lead history without replacing earlier manager/teacher comments.
        if (lead) {
            const comment = { id: randomUUID(), type: 'payment-received', author: user.name, authorId: user.id,
                text: `${amount.toLocaleString('uz-UZ')} so‘m qabul qilindi (${ledger.METHODS[method]}), sana: ${paidDate}. Qoldiq: ${debt - amount} so‘m`, createdAt: new Date().toISOString() };
            await db.query(`UPDATE leads SET comments=(COALESCE(NULLIF(comments,''),'[]')::jsonb || $2::jsonb)::text,updated_at=NOW() WHERE id=$1`, [lead.id, JSON.stringify([comment])]);
        }
        return { id: result.id, student: safeStudent({ ...s, ...extras }), duplicate: false };
    });
}
async function previewStudent(db, actor, id) {
    const row = (await db.query('SELECT * FROM students WHERE id=$1', [id])).rows[0];
    if (!row) throw error(404, 'O‘quvchi topilmadi');
    const s = student(row);
    const linked = s.leadRef?.id && (await db.query('SELECT manager_id,language FROM leads WHERE id=$1', [s.leadRef.id])).rows[0];
    await access(db, actor, true, { managerId: linked?.manager_id || s.managerId, language: linked?.language || s.subject });
    return { student: safeStudent(s) };
}
module.exports = { SCHEMA, initSchema, transaction, access, insert, syncLead, migrate, list, receive, previewStudent, student };
