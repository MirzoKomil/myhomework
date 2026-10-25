'use strict';
// Xodimning hayot sikli: ishdan bo'shatish (offboarding) va qayta ishga olish.
//
// Asosiy muammo va yechim:
//  1. Sotuv lidning HOZIRGI menejeriga emas, sotuvni QILGAN menejerga
//     yoziladi: lid "To'lov jarayonida" yoki "To'lov yopildi" bosqichiga
//     birinchi kirganda server `saleManagerId`ni muhrlaydi va keyin lid kimga
//     berilmasin, u o'zgarmaydi. Shu tufayli ketgan menejerning lidlarini
//     boshqaga berish uning sotuvlarini o'g'irlamaydi.
//  2. Ishdan bo'shatish bitta server tranzaksiyasi: ochiq lidlar tanlangan
//     menejer(lar)ga beriladi (yoki taqsimlanmaganlarga qaytadi), HR holati
//     "inactive" + oxirgi ish kuni, login akkaunt bloklanadi va barcha
//     sessiyalari yopiladi. Hammasi lid tarixiga va arxivga yoziladi.
//  3. Ketgan xodim lid taqsimotida, reytingda va tanlov ro'yxatlarida
//     ko'rinmaydi, lekin tarixiy hisobotlarda ismi saqlanib qoladi.

const { randomUUID } = require('crypto');
const archive = require('./archive');
const roles = require('../../js/teacherRoles');

const SALE_STATUSES = new Set(['tolov-jarayonida', 'tolov-yopildi']);
const OPEN_STATUSES = ['yangi-lidlar', 'boglanishga-urinilmoqda', 'boglanildi', 'malumot-berildi', 'sinov-darsida',
    'qaror-jarayonida', 'keyin-sotib-olmoqchi', 'tolov-jarayonida'];
const SALES_ROLES = new Set(['sotuv-menejeri', 'sotuv_menejeri', 'sotuv menejeri', 'sales_manager']);
const MANAGE_ROLES = new Set(['admin', 'boshliq']);

function err(status, message, code) { return Object.assign(new Error(message), { status, code }); }
const canon = s => (s === 'malumot-berildi' ? 'boglanildi' : String(s || ''));
const isSalesRole = role => SALES_ROLES.has(String(role || '').toLowerCase());
const isActiveRow = r => String(r?.status || 'active').toLowerCase() !== 'inactive' && !r?.offboarded_at;
const sameLogin = (a, b) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

async function init(pool) {
    const q = sql => pool.query(sql).catch(e => console.warn('[staff-lifecycle] migratsiya:', e.message));
    await q(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS end_date TEXT DEFAULT ''`);
    await q(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS offboarded_at TIMESTAMPTZ`);
    await q(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS offboarded_by TEXT DEFAULT ''`);
    await q(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS offboard_reason TEXT DEFAULT ''`);
    await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ`);
    await backfillSaleManagers(pool).catch(e => console.warn('[staff-lifecycle] sotuv egasini to‘ldirishda xato:', e.message));
}

// Sotuv bosqichidagi, lekin hali `saleManagerId` muhrlanmagan lidlar uchun:
// bosqichlar tarixidagi sotuv bosqichiga BIRINCHI kirgan paytdagi menejer,
// tarix bo'lmasa — hozirgi menejer. Faqat bo'sh joylar to'ldiriladi.
async function backfillSaleManagers(db) {
    const res = await db.query(`
        UPDATE leads l SET extra_data = COALESCE(l.extra_data, '{}'::jsonb) || jsonb_build_object(
                'saleManagerId', src.mid, 'saleManagerSource', src.source)
        FROM (
            SELECT id,
                COALESCE((SELECT e->>'managerId'
                          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(extra_data->'stageHistory')='array' THEN extra_data->'stageHistory' ELSE '[]'::jsonb END)
                               WITH ORDINALITY AS t(e, i)
                          WHERE e->>'to' IN ('tolov-jarayonida','tolov-yopildi') AND COALESCE(e->>'managerId','') <> ''
                          ORDER BY i LIMIT 1), manager_id) AS mid,
                CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(extra_data->'stageHistory')='array' THEN extra_data->'stageHistory' ELSE '[]'::jsonb END) e
                                  WHERE e->>'to' IN ('tolov-jarayonida','tolov-yopildi') AND COALESCE(e->>'managerId','') <> '')
                     THEN 'stage-history' ELSE 'current-manager' END AS source
            FROM leads
            WHERE status IN ('tolov-jarayonida','tolov-yopildi')
              AND COALESCE(extra_data->>'saleManagerId','') = ''
              AND COALESCE(manager_id,'') <> ''
        ) src
        WHERE l.id = src.id AND COALESCE(src.mid,'') <> ''`);
    if (res.rowCount) console.log(`[staff-lifecycle] ${res.rowCount} ta sotuvga egasi muhrlandi`);
    return res.rowCount;
}

// upsertLeadWithClient chaqiradi. Brauzer yuborgan saleManagerId hech qachon
// ishlatilmaydi — qiymat faqat bazadagi oldingi holat va bosqichdan kelib chiqadi.
function nextSaleCredit(before, merged, at = new Date().toISOString()) {
    const afterSale = SALE_STATUSES.has(canon(merged?.status));
    if (!afterSale) return { saleManagerId: null, saleManagerAt: null, saleManagerSource: null };
    const beforeSale = before && SALE_STATUSES.has(canon(before.status));
    if (beforeSale && before.saleManagerId) {
        return { saleManagerId: before.saleManagerId, saleManagerAt: before.saleManagerAt || null, saleManagerSource: before.saleManagerSource || null };
    }
    const mid = String(merged?.managerId || before?.managerId || '') || null;
    return { saleManagerId: mid, saleManagerAt: mid ? at : null, saleManagerSource: mid ? 'status-change' : null };
}

// ── O'qish ───────────────────────────────────────────────────────────────

function mapEmployee(r) {
    return {
        id: r.id, name: r.name, role: r.role, lang: r.lang || 'english', login: r.login || '', status: r.status || 'active',
        endDate: r.end_date || '', offboardedAt: r.offboarded_at || null, offboardReason: r.offboard_reason || ''
    };
}

async function loadEmployee(db, id, lock = false) {
    const { rows } = await db.query(`SELECT * FROM hr_employees WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`, [String(id || '')]);
    if (!rows[0]) throw err(404, 'Xodim topilmadi');
    return rows[0];
}

async function findAccount(db, emp) {
    const { rows } = await db.query(
        `SELECT u.id, u.email, u.role, u.disabled_at,
                (SELECT COUNT(*)::int FROM sessions s WHERE s.user_id = u.id) AS sessions
         FROM users u
         WHERE (COALESCE($1,'') <> '' AND LOWER(TRIM(u.email)) = LOWER(TRIM($1)))
            OR u.id IN (SELECT user_id FROM user_sales_manager_links WHERE manager_id = $2)`,
        [emp.login || '', emp.id]);
    return rows;
}

async function activeSalesManagers(db, exceptId) {
    const { rows } = await db.query(`SELECT * FROM hr_employees WHERE id <> $1`, [exceptId]);
    return rows.filter(r => isSalesRole(r.role) && isActiveRow(r)).map(mapEmployee);
}

async function preview(db, actor, employeeId) {
    if (!MANAGE_ROLES.has(actor?.role)) throw err(403, 'Xodimni ishdan bo‘shatish faqat admin yoki boshliq uchun');
    const emp = await loadEmployee(db, employeeId);
    const sales = isSalesRole(emp.role);
    const out = {
        employee: mapEmployee(emp), isSalesManager: sales, alreadyOffboarded: !!emp.offboarded_at,
        accounts: (await findAccount(db, emp)).map(a => ({ id: a.id, login: a.email, disabled: !!a.disabled_at, sessions: a.sessions })),
        leads: null, targets: [], teacherStudents: null, warnings: []
    };
    if (sales) {
        const { rows } = await db.query(
            `SELECT status, language, COUNT(*)::int AS n FROM leads
             WHERE manager_id = $1 AND deleted_at IS NULL GROUP BY status, language`, [emp.id]);
        const open = rows.filter(r => OPEN_STATUSES.includes(r.status));
        out.leads = {
            open: open.reduce((a, r) => a + r.n, 0),
            paying: rows.filter(r => r.status === 'tolov-jarayonida').reduce((a, r) => a + r.n, 0),
            closed: rows.filter(r => r.status === 'tolov-yopildi').reduce((a, r) => a + r.n, 0),
            other: rows.filter(r => !OPEN_STATUSES.includes(r.status) && r.status !== 'tolov-yopildi').reduce((a, r) => a + r.n, 0),
            byLanguage: open.reduce((m, r) => (m[r.language] = (m[r.language] || 0) + r.n, m), {})
        };
        const load = await openLoad(db);
        out.targets = (await activeSalesManagers(db, emp.id)).map(m => ({ ...m, openLeads: load[m.id] || 0 }));
        if (out.leads.open && !out.targets.length) out.warnings.push('Boshqa faol sotuv menejeri yo‘q — ochiq lidlar taqsimlanmaganlarga qaytadi.');
    }
    if (roles.isMain(mapEmployee(emp)) || emp.role === 'yordamchi' || emp.dual_role === true) {
        const { rows } = await db.query(
            `SELECT id, name, teacher_id, assistant_teacher_id FROM students WHERE teacher_id = $1 OR assistant_teacher_id = $1 ORDER BY name`, [emp.id]);
        out.teacherStudents = {
            main: rows.filter(r => r.teacher_id === emp.id).map(r => ({ id: r.id, name: r.name })),
            assistant: rows.filter(r => r.assistant_teacher_id === emp.id).map(r => ({ id: r.id, name: r.name }))
        };
        if (out.teacherStudents.main.length || out.teacherStudents.assistant.length) {
            out.warnings.push('Bu ustozga hali o‘quvchilar biriktirilgan. Avval ularni O‘quvchilar bo‘limida boshqa ustozga o‘tkazing (dars jadvali va davomat to‘g‘ri ko‘chishi uchun).');
        }
    }
    if (!out.accounts.length) out.warnings.push('Bu xodimga bog‘langan login akkaunt topilmadi.');
    return out;
}

async function openLoad(db) {
    const { rows } = await db.query(
        `SELECT manager_id, COUNT(*)::int AS n FROM leads WHERE deleted_at IS NULL AND status = ANY($1) AND COALESCE(manager_id,'')<>'' GROUP BY manager_id`,
        [OPEN_STATUSES]);
    return Object.fromEntries(rows.map(r => [r.manager_id, r.n]));
}

// ── Ishdan bo'shatish ───────────────────────────────────────────────────────

function tashkentToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
const validDay = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;

async function offboard(db, actor, body = {}) {
    if (!MANAGE_ROLES.has(actor?.role)) throw err(403, 'Xodimni ishdan bo‘shatish faqat admin yoki boshliq uchun');
    const emp = await loadEmployee(db, body.employeeId, true);
    if (emp.offboarded_at) throw err(409, 'Bu xodim allaqachon ishdan bo‘shatilgan', 'ALREADY_OFFBOARDED');
    const endDate = body.endDate ? String(body.endDate) : tashkentToday();
    if (!validDay(endDate)) throw err(400, 'Oxirgi ish kuni noto‘g‘ri (YYYY-MM-DD)');
    const reason = String(body.reason || '').trim().slice(0, 500);
    if (!reason) throw err(400, 'Sababni yozing — bu tarixda qoladi');
    const accounts = await findAccount(db, emp);
    if (accounts.some(a => a.id === actor.id)) throw err(400, 'O‘z akkauntingizni o‘zingiz bloklay olmaysiz');

    // Ustoz: o'quvchilar avval odatiy o'tkazish oqimi orqali ko'chirilishi shart.
    const { rows: teaching } = await db.query(
        'SELECT COUNT(*)::int AS n FROM students WHERE teacher_id = $1 OR assistant_teacher_id = $1', [emp.id]);
    if (teaching[0].n > 0) {
        throw err(409, `Bu ustozga ${teaching[0].n} ta o‘quvchi biriktirilgan. Avval ularni boshqa ustozga o‘tkazing.`, 'TEACHER_HAS_STUDENTS');
    }

    const now = new Date().toISOString();
    const summary = { reassigned: 0, unassigned: 0, byTarget: {}, leadIds: [], bookRoadmap: 0 };
    if (isSalesRole(emp.role)) {
        const mode = ['one', 'split', 'unassigned'].includes(body.mode) ? body.mode : null;
        if (!mode) throw err(400, 'Ochiq lidlarni nima qilishni tanlang');
        const { rows: leads } = await db.query(
            `SELECT * FROM leads WHERE manager_id = $1 AND deleted_at IS NULL AND status = ANY($2) ORDER BY created_at, id FOR UPDATE`,
            [emp.id, OPEN_STATUSES]);
        const pool = await activeSalesManagers(db, emp.id);
        const ids = mode === 'one' ? [body.targetId] : mode === 'split' ? (Array.isArray(body.targetIds) ? body.targetIds : []) : [];
        const targets = ids.map(String).filter((v, i, a) => v && a.indexOf(v) === i).map(id => pool.find(m => m.id === id));
        if (mode !== 'unassigned') {
            if (!targets.length || targets.some(t => !t)) throw err(400, 'Lid beriladigan menejer faol sotuv menejeri bo‘lishi kerak');
            const langs = new Set(leads.map(l => l.language === 'russian' ? 'russian' : 'english'));
            for (const lang of langs) {
                if (!targets.some(t => (t.lang || 'english') === lang)) {
                    throw err(400, `${lang === 'russian' ? 'Rus' : 'Ingliz'} tili lidlari uchun shu tildagi menejerni ham tanlang`, 'TARGET_LANG_MISSING');
                }
            }
        }
        const load = await openLoad(db);
        const moved = new Map();
        for (const lead of leads) {
            const lang = lead.language === 'russian' ? 'russian' : 'english';
            const fit = targets.filter(t => (t.lang || 'english') === lang);
            let to = '';
            if (fit.length) {
                to = fit.reduce((best, t) => ((load[t.id] || 0) < (load[best.id] || 0) ? t : best), fit[0]).id;
                load[to] = (load[to] || 0) + 1;
            }
            const extra = { ...(lead.extra_data || {}) };
            const before = { managerId: lead.manager_id, status: lead.status, saleManagerId: extra.saleManagerId || null };
            if (SALE_STATUSES.has(lead.status) && !extra.saleManagerId) {
                extra.saleManagerId = emp.id; extra.saleManagerAt = now; extra.saleManagerSource = 'offboarding';
            }
            Object.assign(extra, {
                managerAssignedAt: to ? now : null,
                reassignedFrom: emp.id, reassignedAt: now, reassignReason: 'offboarding'
            });
            await db.query(`UPDATE leads SET manager_id=$2, extra_data=$3, updated_at=NOW() WHERE id=$1`, [lead.id, to, JSON.stringify(extra)]);
            await db.query(
                `INSERT INTO lead_audit (lead_id, action, actor_id, actor_name, snapshot) VALUES ($1,'reassigned',$2,$3,$4)`,
                [lead.id, String(actor.id || ''), String(actor.name || actor.email || ''),
                 JSON.stringify({ before, after: { managerId: to, saleManagerId: extra.saleManagerId || null }, reason: 'offboarding', employeeId: emp.id })]);
            summary.leadIds.push(lead.id);
            if (to) { summary.reassigned++; summary.byTarget[to] = (summary.byTarget[to] || 0) + 1; } else summary.unassigned++;
            moved.set(`${lang}:${lead.id}`, to);
        }
        // Ko'chgan lidlarga bog'langan, hali yetkazilmagan kitoblar ham yangi menejerga o'tadi.
        const { rows: books } = await db.query(
            `SELECT id, lead_ref FROM book_roadmap WHERE manager_id=$1 AND COALESCE(delivered_at,'')='' FOR UPDATE`, [emp.id]);
        for (const b of books) {
            let ref = null;
            try { ref = b.lead_ref ? JSON.parse(b.lead_ref) : null; } catch { ref = null; }
            const key = ref && ref.id ? `${ref.lang === 'russian' ? 'russian' : 'english'}:${ref.id}` : null;
            if (key && moved.has(key)) {
                await db.query('UPDATE book_roadmap SET manager_id=$2 WHERE id=$1', [b.id, moved.get(key)]);
                summary.bookRoadmap++;
            }
        }
    }

    await db.query(
        `UPDATE hr_employees SET status='inactive', end_date=$2, offboarded_at=NOW(), offboarded_by=$3, offboard_reason=$4 WHERE id=$1`,
        [emp.id, endDate, String(actor.id || ''), reason]);
    let sessionsClosed = 0;
    for (const a of accounts) {
        await db.query('UPDATE users SET disabled_at = COALESCE(disabled_at, NOW()) WHERE id=$1', [a.id]);
        const s = await db.query('DELETE FROM sessions WHERE user_id=$1', [a.id]);
        sessionsClosed += s.rowCount || 0;
    }
    const names = Object.fromEntries((await activeSalesManagers(db, emp.id)).map(m => [m.id, m.name]));
    const result = {
        employeeId: emp.id, name: emp.name, endDate, reason,
        reassigned: summary.reassigned, unassigned: summary.unassigned, bookRoadmap: summary.bookRoadmap,
        byTarget: Object.entries(summary.byTarget).map(([id, n]) => ({ id, name: names[id] || id, leads: n })),
        accountsBlocked: accounts.length, sessionsClosed
    };
    await archive.insertRecord(db, {
        type: 'offboarding', entityId: emp.id, title: emp.name,
        subtitle: `${emp.role || ''} · oxirgi kun ${endDate}`, lang: emp.lang || '',
        snapshot: { employee: { ...emp, password_hash: undefined }, result, leadIds: summary.leadIds }, reason,
        actor: { id: actor.id, role: actor.role, email: actor.email }
    });
    return result;
}

// ── Qayta ishga olish ──────────────────────────────────────────────────────

async function reinstate(db, actor, body = {}) {
    if (!MANAGE_ROLES.has(actor?.role)) throw err(403, 'Faqat admin yoki boshliq qayta ishga oladi');
    const emp = await loadEmployee(db, body.employeeId, true);
    if (!emp.offboarded_at && isActiveRow(emp)) throw err(409, 'Bu xodim allaqachon faol');
    await db.query(
        `UPDATE hr_employees SET status='active', end_date='', offboarded_at=NULL, offboarded_by='', offboard_reason='' WHERE id=$1`, [emp.id]);
    const accounts = await findAccount(db, emp);
    for (const a of accounts) await db.query('UPDATE users SET disabled_at=NULL WHERE id=$1', [a.id]);
    await archive.insertRecord(db, {
        type: 'offboarding', entityId: emp.id, title: emp.name, subtitle: 'Qayta ishga olindi', lang: emp.lang || '',
        snapshot: { reinstated: true, previousEndDate: emp.end_date || '', previousReason: emp.offboard_reason || '' },
        reason: String(body.note || 'Qayta ishga olindi').slice(0, 500),
        actor: { id: actor.id, role: actor.role, email: actor.email }
    });
    return { employeeId: emp.id, name: emp.name, accountsEnabled: accounts.length };
}

// Snapshot-save (saveHrEmployeesData) brauzerdan kelgan ma'lumot bilan
// offboarding holatini bekor qilib yubormasligi uchun: bu maydonlar faqat
// server tomonidan boshqariladi.
function preserveLifecycle(employee, oldRow) {
    if (!oldRow) return { endDate: '', offboardedAt: null, offboardedBy: '', offboardReason: '', status: employee.status || 'active' };
    const off = !!oldRow.offboarded_at;
    return {
        endDate: oldRow.end_date || '',
        offboardedAt: oldRow.offboarded_at || null,
        offboardedBy: oldRow.offboarded_by || '',
        offboardReason: oldRow.offboard_reason || '',
        status: off ? 'inactive' : (employee.status || 'active')
    };
}

module.exports = {
    init, backfillSaleManagers, nextSaleCredit, preview, offboard, reinstate, preserveLifecycle,
    SALE_STATUSES, OPEN_STATUSES, isSalesRole, isActiveRow, randomUUID
};
