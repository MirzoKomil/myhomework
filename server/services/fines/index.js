'use strict';
// Jarimalar va rag'bat — server (dizayn J01–J09, mantiq J06).
//  • Davomat jarimalari avtomatik: staffAttendance kun natijalaridan (tick har 5 daqiqada), takrorlanmaydi (ref kaliti).
//  • Ish jarimalarini rahbar yozadi (ROP — o'z sotuv menejerlariga, akademik rahbar — o'z ustoz/yordamchilariga, admin — hammaga).
//  • Jarima faqat egasiga, uning rahbariga va adminga ko'rinadi (reytingda yo'q).
//  • E'tiroz — 3 kun ichida; yuvish — keyingi oyning 4-sanasigacha, rahbar tasdig'i bilan; 10 kun vaqtida — avtomatik.
//  • Sozlamalar versiyalanadi: saqlash keyingi oyning 1-sanasidan kuchga kiradi (orqaga qarab emas), tarix saqlanadi.
//  • Maosh: monthTotals() — xodim bo'yicha oy jami (chegara bilan). Moliya → Maoshlar shuni ko'rsatadi; ayirishni admin qiladi.
const { randomUUID } = require('crypto');
const R = require('./rules');
const t = require('../staffAttendance/time');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS staff_fine_settings (
 seq BIGSERIAL PRIMARY KEY, effective DATE NOT NULL, data JSONB NOT NULL, created_by TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS staff_fine_changes (
 id BIGSERIAL PRIMARY KEY, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL DEFAULT '', text TEXT NOT NULL, effective DATE NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS staff_fines (
 id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, user_id TEXT, role TEXT NOT NULL, work_date DATE NOT NULL, month TEXT NOT NULL,
 code TEXT NOT NULL, label TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount >= 0), warning BOOLEAN NOT NULL DEFAULT FALSE,
 source TEXT NOT NULL CHECK(source IN ('attendance','manager')), ref TEXT, reason TEXT NOT NULL DEFAULT '', evidence JSONB NOT NULL DEFAULT '{}',
 state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','appeal','cancelled')), washed INTEGER NOT NULL DEFAULT 0,
 issued_by TEXT, appeal_text TEXT NOT NULL DEFAULT '', appeal_at TIMESTAMPTZ, appeal_by TEXT, appeal_answer TEXT NOT NULL DEFAULT '',
 seen_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS staff_fines_ref ON staff_fines(employee_id, ref) WHERE ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS staff_fines_emp ON staff_fines(employee_id, month);
CREATE TABLE IF NOT EXISTS staff_fine_washes (
 id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, user_id TEXT, kind TEXT NOT NULL CHECK(kind IN ('hours','sunday','task','learning','streak')),
 month TEXT NOT NULL, fine_id TEXT, minutes INTEGER NOT NULL DEFAULT 0, value INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '',
 evidence JSONB NOT NULL DEFAULT '{}', state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected','cancelled')),
 parts JSONB NOT NULL DEFAULT '[]', decided_by TEXT, decided_at TIMESTAMPTZ, decision_reason TEXT NOT NULL DEFAULT '',
 ref TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS staff_fine_washes_ref ON staff_fine_washes(employee_id, ref) WHERE ref IS NOT NULL;
-- Bir kun uchun bitta qo'shimcha soat / yakshanba so'rovi (rad etilgani hisobga olinmaydi).
CREATE UNIQUE INDEX IF NOT EXISTS staff_fine_washes_day ON staff_fine_washes(employee_id, kind, (evidence->>'date'))
 WHERE kind IN ('hours','sunday') AND state IN ('pending','approved');
ALTER TABLE staff_fines ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';
-- Bekor qilingan (keyin sababli bo'lgan) jarimaning yuvilgan summasi joylashtirilmagan qismi — admin uchun belgi.
CREATE TABLE IF NOT EXISTS staff_fine_credits (
 id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, month TEXT NOT NULL, fine_id TEXT NOT NULL UNIQUE, amount INTEGER NOT NULL CHECK(amount > 0),
 note TEXT NOT NULL DEFAULT '', resolved BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS staff_fine_washes_inbox ON staff_fine_washes(state, created_at);
`;

function error(status, message) { return Object.assign(new Error(message), { status }); }
const att = () => require('../staffAttendance');
const ST = () => require('../staffAttendance/rules');

async function initSchema(pool) {
    await pool.query(SCHEMA);
    const n = (await pool.query('SELECT COUNT(*)::int AS n FROM staff_fine_settings')).rows[0].n;
    if (!n) await pool.query("INSERT INTO staff_fine_settings(effective,data,created_by) VALUES('2000-01-01',$1,'system')", [JSON.stringify(R.defaultConfig())]);
}

async function versions(db) {
    return (await db.query("SELECT seq,TO_CHAR(effective,'YYYY-MM-DD') AS effective,data FROM staff_fine_settings ORDER BY seq")).rows.map(r => ({ ...r, seq: Number(r.seq) }));
}
async function configAt(db, date) { return R.configFor(await versions(db), date); }

// ── Kim? ─────────────────────────────────────────────────────────────────────
// Xodimning jarima roli: sales | rop | hr | academic | assistant | teacher | targetolog ; admin — jarimasiz.
function fineRole(userRole, empRole) {
    const k = ST().staffKind({ userRole, empRole });
    return R.ROLES.includes(k) ? k : null;
}
async function viewer(db, user) {
    const a = await att().actor(db, user);
    const kind = ['admin', 'boshliq'].includes(a.role) ? 'admin' : fineRole(a.role, a.employee_role) || 'other';
    const lang = att().empLang({ role: a.employee_role, lang: a.employee_lang });
    const langs = lang === 'both' || !lang ? null : [lang];
    return { ...a, kind, employeeId: a.employee_id, langs, lang };
}
async function owner(db, employeeId) {
    const e = (await db.query(`SELECT he.id,he.name,he.role,he.lang,u.id AS user_id,u.role AS user_role FROM hr_employees he
        LEFT JOIN users u ON LOWER(TRIM(u.email))=LOWER(TRIM(he.login)) AND COALESCE(TRIM(he.login),'')<>'' WHERE he.id=$1 LIMIT 1`, [String(employeeId || '')])).rows[0];
    if (!e) throw error(404, 'Xodim topilmadi');
    const role = fineRole(e.user_role, e.role);
    return { employeeId: e.id, name: e.name, role, lang: att().empLang(e), userId: e.user_id };
}
async function requireSee(db, v, employeeId) {
    const o = await owner(db, employeeId);
    if (!R.canSee(v, o)) throw error(403, 'Bu jarimani koʻrishga ruxsat yoʻq');
    return o;
}

// ── Davomat jarimalarini yaratish (tick) ─────────────────────────────────────
// Oy boshidan kechagacha (bugun hali tugamagan) va bugungi yakunlangan holatlar: kechikish — kelgan zahoti.
async function syncAttendance(db, now = new Date()) {
    const today = t.tashkentDate(now);
    const from = today.slice(0, 7) + '-01';
    // oy boshida o'tgan oyning oxirgi kunlarini ham (seriya va oxirgi kun)
    const prevStart = t.tashkentDate(new Date(Date.parse(from + 'T12:00:00Z') - 3 * 86400000 - t.OFFSET_MS));
    const start = prevStart < from ? prevStart : from;
    const svc = att();
    const settings = await svc.getSettings(db);
    const list = (await db.query(`SELECT he.id,he.name,he.role,he.lang,u.id AS user_id,u.role AS user_role FROM staff_att_schedules s JOIN hr_employees he ON he.id=s.employee_id
        LEFT JOIN users u ON LOWER(TRIM(u.email))=LOWER(TRIM(he.login)) AND COALESCE(TRIM(he.login),'')<>''
        WHERE s.tracked AND NOT ${await svc.goneSql(db)}`)).rows;
    if (!list.length) return { created: [] };
    const ctx = await svc.loadContext(db, list.map(e => e.id), start, today);
    const dates = [];
    for (let d = start; d <= today; d = t.tashkentDate(new Date(Date.parse(d + 'T12:00:00Z') + 86400000 - t.OFFSET_MS))) dates.push(d);
    const vers = await versions(db);
    const created = [];
    for (const e of list) {
        const role = fineRole(e.user_role, e.role);
        if (!role || !R.ATT_ROLES.has(role)) continue;
        // Bugungi kun: faqat kechikish (kelgan bo'lsa). Kelmaslik, erta ketish, ketish yo'q — kun yakunlangach (ertasi).
        const days = dates.map(date => {
            const d = svc.statusFor(ctx, e.id, date, settings, now);
            if (date !== today) return { date, ...d };
            return { date, status: d.status === 'late' ? 'late' : d.status === 'on_time' ? 'on_time' : 'upcoming', lateMinutes: d.lateMinutes, rawLateMinutes: d.rawLateMinutes };
        });
        // Har oy o'z sozlamasi bilan (kuchga kirish sanasi).
        const byMonth = {};
        for (const d of days) (byMonth[d.date.slice(0, 7)] ||= []).push(d);
        const produced = new Set();
        for (const [month, mdays] of Object.entries(byMonth)) {
            const cfg = R.configFor(vers, month + '-01');
            // Seriya oy chegarasidan o'tadi — oldingi kunlar bilan hisoblanadi, faqat shu oy jarimalari olinadi.
            const fines = R.attendanceFines(days.filter(d => d.date <= mdays[mdays.length - 1].date), cfg, role).filter(f => f.date.startsWith(month));
            for (const f of fines) {
                produced.add(f.ref);
                // "Oyning 1-kechikishi" butun oy bo'yicha — oy boshidan beri hisoblangan
                const id = randomUUID();
                // Upsert: avtomatik bekor qilingani qayta faollashadi; yuvilmagan faol jarima yangi hisobga moslanadi
                // (masalan 1-kechikish sababli bo'lsa, keyingisi "ogohlantirish"ga aylanadi). Qo'lda bekor/e'tiroz/yuvilgan — tegilmaydi.
                const ins = await db.query(`INSERT INTO staff_fines(id,employee_id,user_id,role,work_date,month,code,label,amount,warning,source,ref,evidence)
                    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'attendance',$11,$12)
                    ON CONFLICT (employee_id, ref) WHERE ref IS NOT NULL DO UPDATE SET state='active', note='', amount=EXCLUDED.amount, warning=EXCLUDED.warning,
                        code=EXCLUDED.code, label=EXCLUDED.label, evidence=EXCLUDED.evidence
                    WHERE (staff_fines.state='cancelled' AND staff_fines.note='auto')
                       OR (staff_fines.state='active' AND staff_fines.washed=0 AND (staff_fines.amount, staff_fines.warning, staff_fines.code, staff_fines.label)
                           IS DISTINCT FROM (EXCLUDED.amount, EXCLUDED.warning, EXCLUDED.code, EXCLUDED.label))
                    RETURNING id, (xmax = 0) AS inserted, seen_at`,
                    [id, e.id, e.user_id || null, role, f.date, month, f.code, f.label, f.amount, f.warning, f.ref, JSON.stringify({ date: f.date, minutes: f.minutes || null })]);
                const row = ins.rows[0];
                if (row && row.inserted) created.push({ id, employeeId: e.id, name: e.name, userId: e.user_id, ...f });
                else if (row && f.amount > 0 && !f.warning) {
                    // qayta faollashgan yoki summasi oshgan — egasi yana ko'rsin (popup), xabar takrorlanmaydi (outbox kaliti)
                    await db.query('UPDATE staff_fines SET seen_at=NULL WHERE id=$1', [row.id]);
                }
            }
        }
        // Endi chiqmaydigan jarima (HR tuzatdi, so'rov tasdiqlandi, sozlama…) — yuvilmagan bo'lsa avtomatik bekor.
        // Bugun hali yakunlanmagan: faqat kechikish ko'riladi, shuning uchun bugungi boshqa turdagi jarimalar tegilmaydi.
        const existing = (await db.query(`SELECT id,ref,month,code,amount,washed,TO_CHAR(work_date,'YYYY-MM-DD') AS d FROM staff_fines WHERE employee_id=$1 AND source='attendance'
            AND state='active' AND work_date BETWEEN $2 AND $3`, [e.id, start, today])).rows.map(f => ({ ...f, amount: Number(f.amount), washed: Number(f.washed) }));
        const stale = existing.filter(f => !produced.has(f.ref) && (f.d < today || /:late$|:streak3$/.test(f.ref)));
        for (const f of stale) {
            const c = await db.query(`UPDATE staff_fines SET state='cancelled',note='auto',washed=0 WHERE id=$1 AND state='active' RETURNING id`, [f.id]);
            if (!c.rowCount || !f.washed) continue;
            // Qisman yuvilgan jarima endi yo'q — yuvilgan summa shu oyning boshqa faol jarimalariga o'tadi (eng kichigidan),
            // sig'masa — kredit (admin ko'radi: Moliya → Maoshlar).
            const cfgM = R.configFor(vers, f.month + '-01');
            const others = (await db.query(`SELECT id,code,amount,washed,state,warning FROM staff_fines WHERE employee_id=$1 AND month=$2 AND state='active' AND id<>$3`, [e.id, f.month, f.id])).rows
                .map(x => ({ ...x, amount: Number(x.amount), washed: Number(x.washed) }));
            const { parts, unused } = R.allocateWash(others, f.washed, cfgM);
            for (const p of parts) await db.query('UPDATE staff_fines SET washed=washed+$2 WHERE id=$1', [p.id, p.amount]);
            if (unused > 0) await db.query(`INSERT INTO staff_fine_credits(id,employee_id,month,fine_id,amount,note) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (fine_id) DO NOTHING`,
                [randomUUID(), e.id, f.month, f.id, unused, 'Yuvilgan jarima keyin sababli boʻldi — summa joylashtirilmadi']);
        }
        // 10 ish kuni ketma-ket vaqtida — eng kichik jarima o'zi yuviladi (oy ichidagi seriyalar).
        const cfgNow = R.configFor(vers, today);
        const sw = R.streakWashes(days.filter(d => d.date >= from && d.date < today), cfgNow);
        for (const date of sw.dates) {
            for (let i = 0; i < cfgNow.soft.washStreakCount; i++) await autoStreakWash(db, e, date, i, cfgNow, today);
        }
    }
    await svc.freeze(db, ctx);
    return { created };
}
async function autoStreakWash(db, e, date, i, cfg, today) {
    const month = date.slice(0, 7);
    const ref = `streak:${date}:${i}`;
    const exists = (await db.query('SELECT 1 FROM staff_fine_washes WHERE employee_id=$1 AND ref=$2', [e.id, ref])).rows[0];
    if (exists) return;
    const fines = (await db.query(`SELECT id,code,amount,washed,state,warning,TO_CHAR(work_date,'YYYY-MM-DD') AS d FROM staff_fines WHERE employee_id=$1 AND month=$2 AND state='active'`, [e.id, month])).rows
        .filter(f => R.canWash(f.d, today));
    const target = fines.filter(f => !f.warning && R.washable(f, cfg) > 0).sort((a, b) => R.washable(a, cfg) - R.washable(b, cfg))[0];
    if (!target) return; // yuviladigan jarima yo'q — seriya keyingi jarimaga saqlanmaydi (sodda qoida)
    const amount = R.washable(target, cfg);
    const ins = await db.query(`INSERT INTO staff_fine_washes(id,employee_id,user_id,kind,month,fine_id,value,state,parts,ref,note,decided_at)
        VALUES($1,$2,$3,'streak',$4,$5,$6,'approved',$7,$8,'10 ish kuni ketma-ket vaqtida',NOW()) ON CONFLICT DO NOTHING RETURNING id`,
        [randomUUID(), e.id, e.user_id || null, month, target.id, amount, JSON.stringify([{ id: target.id, amount }]), ref]);
    if (ins.rowCount) await db.query('UPDATE staff_fines SET washed=washed+$2 WHERE id=$1', [target.id, amount]); // parallel tick ikki marta yuvmaydi
}

// ── Xabar (bot + push) ───────────────────────────────────────────────────────
const money = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const escH = v => String(v ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
async function notifyFine(db, f) {
    if (!f.userId || f.warning) return 0;
    const days = f.appealDays || (await configAt(db, t.tashkentDate())).soft.appealDays;
    const ok = (await db.query("SELECT to_regclass('public.domwork_bot_links') AS a, to_regclass('public.domwork_bot_outbox') AS b")).rows[0];
    if (!ok?.a || !ok?.b) return 0;
    const link = (await db.query("SELECT telegram_id FROM domwork_bot_links WHERE account_kind='user' AND NOT paused AND account_id=$1", [String(f.userId)])).rows[0];
    if (!link) return 0;
    const text = `🧾 <b>Jarima yozildi: ${money(f.amount)} soʻm</b>\n${escH(f.label)}${f.reason ? `\nSabab: ${escH(f.reason)}` : ''}\n\nHammasi tuzatsa boʻladigan narsa: qoʻshimcha soat, yakshanba navbatchiligi yoki 10 kun ketma-ket vaqtida kelish bilan yuvish mumkin. Eʼtiroz — ${days} kun ichida, ilovada.`;
    await require('../domworkBot/store').enqueue(db, { key: `fine:${f.id}`, targetId: link.telegram_id,
        payload: { chat_id: link.telegram_id, text, parse_mode: 'HTML', disable_web_page_preview: true,
            reply_markup: { inline_keyboard: [[{ text: '📱 Ilovada ochish', url: 'https://myhomework.uz/?tab=jarimalar' }]] } } });
    return 1;
}
// Bir nechta server nusxasi yoki ustma-ust tick — bitta tranzaksiya va advisory lock ostida (ikkinchisi kutadi).
async function tick(pool, now = new Date()) {
    const { created } = await att().transaction(pool, async db => {
        await db.query("SELECT pg_advisory_xact_lock(hashtext('staff_fines_tick'))");
        return syncAttendance(db, now);
    });
    const db = pool;
    for (const f of created) await notifyFine(db, f).catch(e => console.error('[fines] xabar:', e.message));
    return { created: created.length };
}

// ── Xodim: Mening jarimalarim (J01) ──────────────────────────────────────────
function fineView(f, cfg, today) {
    const d = typeof f.work_date === 'string' ? f.work_date.slice(0, 10) : t.tashkentDate(f.work_date);
    const created = t.tashkentDate(new Date(f.created_at));
    const washLeft = f.state === 'active' && !f.warning ? R.washable({ ...f, amount: f.amount, washed: f.washed }, cfg) : 0;
    const status = f.warning ? 'warning' : f.state === 'cancelled' ? 'cancelled' : f.state === 'appeal' ? 'appeal'
        : Number(f.washed) >= Number(f.amount) ? 'washed' : Number(f.washed) > 0 ? 'partly' : 'active';
    return { id: f.id, date: d, code: f.code, label: f.label, amount: Number(f.amount), washed: Number(f.washed), warning: f.warning, source: f.source,
        reason: f.reason, evidence: f.evidence || {}, state: f.state, status, appealText: f.appeal_text, appealAnswer: f.appeal_answer,
        appealUntil: R.appealUntil(created, cfg), canAppeal: f.state === 'active' && !f.warning && today <= R.appealUntil(created, cfg) && !f.appeal_at,
        canWash: washLeft > 0 && R.canWash(d, today), washLeft, washDeadline: R.washDeadline(d), issuedBy: f.issued_by_name || '', seen: !!f.seen_at,
        employeeId: f.employee_id, name: f.employee_name || '', createdAt: f.created_at };
}
const FINE_SELECT = `SELECT f.*,TO_CHAR(f.work_date,'YYYY-MM-DD') AS work_date,u.name AS issued_by_name,he.name AS employee_name FROM staff_fines f
    LEFT JOIN users u ON u.id=f.issued_by LEFT JOIN hr_employees he ON he.id=f.employee_id`;

async function salaryFor(db, employeeId, month) {
    // Hisoblangan maosh: avval shakllantirilgan hisob (salary_transactions), bo'lmasa — null (chegara ko'rsatilmaydi).
    try {
        // Bir xodim ikki til bo'yicha alohida hisoblanishi mumkin — oy bo'yicha yig'indi (chegara uchun).
        const r = (await db.query(`SELECT SUM(amount) AS s, COUNT(*)::int AS n FROM salary_transactions WHERE employee_id=$1 AND TO_CHAR(period_start,'YYYY-MM')=$2`, [employeeId, month])).rows[0];
        return r && r.n ? Number(r.s) : null;
    } catch (e) { return null; }
}

async function mine(db, user, month, now = new Date(), opts = {}) {
    const v = await viewer(db, user);
    if (!opts.employeeId && v.kind === 'admin') return { linked: !!v.employeeId, exempt: true }; // admin jarimasiz
    const empId = opts.employeeId || v.employeeId;
    if (!empId) return { linked: false };
    if (empId !== v.employeeId) await requireSee(db, v, empId);
    else if (v.kind === 'admin' || v.kind === 'other') return { linked: true, exempt: true };
    const o = await owner(db, empId);
    if (!o.role) return { linked: true, exempt: true };
    const today = t.tashkentDate(now);
    const m = t.isMonth(month) ? month : today.slice(0, 7);
    const cfg = await configAt(db, m + '-01');
    const rows = (await db.query(`${FINE_SELECT} WHERE f.employee_id=$1 AND f.month=$2 ORDER BY f.work_date DESC, f.created_at DESC`, [empId, m])).rows;
    const fines = rows.map(f => fineView(f, cfg, today));
    let salary = opts.salary !== undefined ? opts.salary : await salaryFor(db, empId, m);
    if (salary == null && opts.salaryLookup) salary = await opts.salaryLookup(m).catch(() => null);
    const sum = R.monthSummary(rows.map(f => ({ ...f, amount: Number(f.amount), washed: Number(f.washed) })), salary, cfg);
    // Seriya: shu oy ish kunlari (vaqtida kelish) — avtomatik yuvishgacha qolgan kunlar
    let streak = { progress: 0, need: 10 };
    if (R.ATT_ROLES.has(o.role)) {
        try {
            const svc = att(), settings = await svc.getSettings(db);
            const from = m + '-01', to = today < t.monthDates(m).pop() ? today : t.monthDates(m).pop();
            const ctx = await svc.loadContext(db, [empId], from, to);
            const days = t.monthDates(m).filter(d => d < today).map(date => ({ date, ...svc.statusFor(ctx, empId, date, settings, now) }));
            streak = R.streakWashes(days, cfg);
        } catch (e) { /* davomat jadvali yo'q */ }
    }
    const washes = (await db.query(`SELECT id,kind,value,state,note,decision_reason,minutes,created_at FROM staff_fine_washes WHERE employee_id=$1 AND month=$2 ORDER BY created_at DESC`, [empId, m])).rows
        .map(w => ({ id: w.id, kind: w.kind, value: Number(w.value), state: w.state, note: w.note, reason: w.decision_reason, minutes: w.minutes, createdAt: w.created_at }));
    return { linked: true, month: m, name: o.name, role: o.role, roleLabel: R.ROLE_LABELS[o.role], fines, summary: sum, salary,
        washDeadline: R.washDeadline(m + '-01'), payDay: R.nextMonthStart(m + '-01').slice(0, 8) + '05', streak: { progress: streak.progress, need: streak.need },
        soft: cfg.soft, washes, rules: (cfg.roles[o.role] || []).filter(r => r.active) };
}

// Popup (J04): ko'rilmagan yangi jarimalar; seen=true belgilanadi.
async function unseen(db, user) {
    const v = await viewer(db, user);
    if (!v.employeeId) return { rows: [] };
    const rows = (await db.query(`${FINE_SELECT} WHERE f.employee_id=$1 AND f.seen_at IS NULL AND f.state='active' AND NOT f.warning AND f.created_at>NOW()-INTERVAL '7 days' ORDER BY f.created_at LIMIT 3`, [v.employeeId])).rows;
    const today = t.tashkentDate();
    const cfg = await configAt(db, today);
    const n = Number((await db.query(`SELECT COUNT(*)::int AS n FROM staff_fines WHERE employee_id=$1 AND month=$2 AND code LIKE 'late_%' AND code<>'late_streak3'`, [v.employeeId, today.slice(0, 7)])).rows[0].n);
    return { rows: rows.map(f => ({ ...fineView(f, cfg, today), lateNo: n })), washHour: cfg.soft.washHour };
}
async function markSeen(db, user, ids) {
    const v = await viewer(db, user);
    if (!v.employeeId) return { ok: true };
    await db.query('UPDATE staff_fines SET seen_at=NOW() WHERE employee_id=$1 AND id=ANY($2::text[]) AND seen_at IS NULL', [v.employeeId, (ids || []).map(String).slice(0, 20)]);
    return { ok: true };
}

async function detail(db, user, id, now = new Date()) {
    const v = await viewer(db, user);
    const f = (await db.query(`${FINE_SELECT} WHERE f.id=$1`, [String(id || '')])).rows[0];
    if (!f) throw error(404, 'Jarima topilmadi');
    await requireSee(db, v, f.employee_id);
    const cfg = await configAt(db, f.work_date);
    const view = fineView(f, cfg, t.tashkentDate(now));
    // Dalil: davomat yozuvi (vaqt, masofa, yuz) — DavRecord bilan bir xil manba
    let record = null;
    if (f.source === 'attendance') {
        // Egasi — o'z kuni (/me/day bilan bir xil); rahbar/admin — xodim kuni. Davomat huquqi alohida tekshiriladi.
        try { record = await att().teamRecord(db, user, v.employeeId === f.employee_id ? null : f.employee_id, f.work_date, now); }
        catch (e) { record = null; }
    }
    const rule = (cfg.roles[f.role] || []).find(r => r.code === f.code);
    return { ...view, rule: rule ? { label: rule.label, sub: rule.sub, amount: rule.amount } : null, grace: cfg.soft.graceMinutes,
        record: record ? { start: record.start, inClock: record.inClock, outClock: record.outClock, attempts: (record.attempts || []).filter(a => a.ok).map(a => ({ clock: a.clock, distance: a.distance, faceScore: a.faceScore, kind: a.kind })) } : null,
        mine: v.employeeId === f.employee_id, canManage: v.employeeId !== f.employee_id && R.canManage(v, await owner(db, f.employee_id)) };
}

// ── E'tiroz (J07) ────────────────────────────────────────────────────────────
async function appeal(db, user, id, text, now = new Date()) {
    const v = await viewer(db, user);
    const body = String(text || '').trim().slice(0, 600);
    if (body.length < 5) throw error(400, 'Nima notoʻgʻri ekanini yozing');
    const f = (await db.query('SELECT * FROM staff_fines WHERE id=$1', [String(id || '')])).rows[0];
    if (!f || f.employee_id !== v.employeeId) throw error(404, 'Jarima topilmadi');
    const cfg = await configAt(db, t.tashkentDate(f.work_date));
    if (f.warning || f.state !== 'active' || f.appeal_at) throw error(409, 'Bu jarimaga eʼtiroz bildirib boʻlmaydi');
    if (t.tashkentDate(now) > R.appealUntil(t.tashkentDate(new Date(f.created_at)), cfg)) throw error(409, `Eʼtiroz muddati (${cfg.soft.appealDays} kun) oʻtgan`);
    const u = await db.query(`UPDATE staff_fines SET state='appeal',appeal_text=$2,appeal_at=NOW() WHERE id=$1 AND state='active' RETURNING id`, [f.id, body]);
    if (!u.rowCount) throw error(409, 'Holat oʻzgargan');
    return { state: 'appeal' };
}
async function answerAppeal(db, user, id, { accept, answer } = {}) {
    const v = await viewer(db, user);
    const f = (await db.query('SELECT * FROM staff_fines WHERE id=$1', [String(id || '')])).rows[0];
    if (!f) throw error(404, 'Jarima topilmadi');
    if (!R.canManage(v, await owner(db, f.employee_id)) || v.employeeId === f.employee_id) throw error(403, 'Eʼtirozga faqat rahbar yoki admin javob beradi');
    if (f.state !== 'appeal') throw error(409, 'Eʼtiroz yoʻq yoki allaqachon javob berilgan');
    const text = String(answer || '').trim().slice(0, 300);
    if (!accept && !text) throw error(400, 'Rad etish sababini yozing');
    const u = await db.query(`UPDATE staff_fines SET state=$2,appeal_by=$3,appeal_answer=$4 WHERE id=$1 AND state='appeal' RETURNING id`, [f.id, accept ? 'cancelled' : 'active', v.id, text]);
    if (!u.rowCount) throw error(409, 'Eʼtirozga allaqachon javob berilgan');
    return { state: accept ? 'cancelled' : 'active' };
}

// ── Rahbar jarima yozadi (J08) ───────────────────────────────────────────────
async function team(db, user) {
    const v = await viewer(db, user);
    if (!['admin', 'rop', 'academic'].includes(v.kind)) throw error(403, 'Jarima yozish faqat ROP, akademik rahbar va admin uchun');
    const rows = (await db.query(`SELECT he.id,he.name,he.role,he.lang,u.role AS user_role FROM hr_employees he
        LEFT JOIN users u ON LOWER(TRIM(u.email))=LOWER(TRIM(he.login)) AND COALESCE(TRIM(he.login),'')<>''
        WHERE NOT ${await att().goneSql(db)} ORDER BY he.name`)).rows;
    const today = t.tashkentDate();
    const cfg = await configAt(db, today);
    return { kind: v.kind, rows: rows.map(e => ({ id: e.id, name: e.name, role: fineRole(e.user_role, e.role), lang: att().empLang(e) }))
        .filter(e => e.role && e.id !== v.employeeId && R.canManage(v, { employeeId: e.id, role: e.role, lang: e.lang }))
        .map(e => ({ ...e, roleLabel: R.ROLE_LABELS[e.role], rules: (cfg.roles[e.role] || []).filter(r => r.active && (!r.kind || r.kind === 'work')) })) };
}
async function issue(db, user, body = {}, now = new Date()) {
    const v = await viewer(db, user);
    const o = await owner(db, body.employeeId);
    if (!o.role || o.employeeId === v.employeeId || !R.canManage(v, o)) throw error(403, 'Faqat oʻz xodimingizga jarima yozasiz');
    const today = t.tashkentDate(now);
    const date = t.isDate(body.date) ? body.date : today;
    if (date > today) throw error(400, 'Kelajakdagi sana uchun jarima yozilmaydi');
    // Joriy oy; o'tgan oy — faqat keyingi oyning 4-sanasigacha (maosh 5-sanada yopiladi).
    if (date.slice(0, 7) !== today.slice(0, 7) && !(R.nextMonthStart(date).slice(0, 7) === today.slice(0, 7) && R.canWash(date, today)))
        throw error(400, 'Faqat joriy oy (va oy boshida 4-sanagacha — oʻtgan oy) uchun jarima yoziladi');
    const cfg = await configAt(db, date);
    const rule = (cfg.roles[o.role] || []).find(r => r.code === body.code && r.active && (!r.kind || r.kind === 'work'));
    if (!rule) throw error(400, 'Qoidani tanlang');
    const reason = String(body.reason || '').trim().slice(0, 600);
    if (reason.length < 10) throw error(400, 'Sababni batafsil yozing');
    const evidence = { text: String(body.evidence?.text || '').trim().slice(0, 300), leadId: String(body.evidence?.leadId || '').slice(0, 80) || undefined,
        leadName: String(body.evidence?.leadName || '').slice(0, 120) || undefined };
    if (!evidence.text && !evidence.leadId) throw error(400, 'Dalilni koʻrsating');
    const id = randomUUID();
    await db.query(`INSERT INTO staff_fines(id,employee_id,user_id,role,work_date,month,code,label,amount,source,reason,evidence,issued_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'manager',$10,$11,$12)`, [id, o.employeeId, o.userId || null, o.role, date, date.slice(0, 7), rule.code, rule.label, rule.amount, reason, JSON.stringify(evidence), v.id]);
    await notifyFine(db, { id, userId: o.userId, amount: rule.amount, label: rule.label, reason }).catch(e => console.error('[fines] xabar:', e.message));
    return { id, amount: rule.amount };
}

// ── Yuvish (J03, J09) ────────────────────────────────────────────────────────
async function requestWash(db, user, body = {}, now = new Date()) {
    const v = await viewer(db, user);
    if (!v.employeeId) throw error(403, 'Xodim topilmadi');
    const kind = String(body.kind || '');
    if (!['hours', 'sunday', 'task', 'learning'].includes(kind)) throw error(400, 'Yuvish turini tanlang');
    const today = t.tashkentDate(now);
    // Joriy oy jarimalari; oy boshida (1–4) o'tgan oyniki ham yuviladi.
    const month = body.month && t.isMonth(body.month) ? body.month : today.slice(0, 7);
    if (!R.canWash(month + '-01', today)) throw error(409, `${month} jarimalarini yuvish muddati tugagan`);
    const cfg = await configAt(db, month + '-01');
    if (kind === 'learning') {
        const n = Number((await db.query(`SELECT COUNT(*)::int AS n FROM staff_fine_washes WHERE employee_id=$1 AND month=$2 AND kind='learning' AND state IN ('pending','approved')`, [v.employeeId, month])).rows[0].n);
        if (n) throw error(409, 'Oʻrganish orqali yuvish oyiga 1 marta');
    }
    let minutes = 0, evidence = {};
    if (kind === 'hours' || kind === 'sunday') {
        // Sana: shu oy ichida va bugundan kech emas; vaqt — yuz bilan belgilangan kelish/ketish (ofisda, ok).
        const date = t.isDate(body.date) ? body.date : today;
        if (date.slice(0, 7) !== month || date > today) throw error(400, 'Sana shu oy ichida va bugundan kech boʻlmasin');
        const ev = (await att().priorEvents(db, v.employeeId, date)).filter(e => e.ok && e.location_method !== 'outside');
        const outs = ev.filter(e => e.kind === 'out'), ins = ev.filter(e => e.kind === 'in');
        const lastOut = outs.length ? t.tashkentMinutes(outs[outs.length - 1].occurred_at) : null;
        const firstIn = ins.length ? t.tashkentMinutes(ins[0].occurred_at) : null;
        if (kind === 'sunday') {
            if (t.weekday(date) !== 7) throw error(400, 'Yakshanba navbatchiligi faqat yakshanba kuni');
            if (firstIn == null) throw error(409, 'Yakshanba kuni ofisga kelishni yuz bilan belgilang — soʻng yuboring');
            evidence = { date, from: t.clock(firstIn), to: lastOut != null ? t.clock(lastOut) : '' };
        } else {
            const sched = (await db.query('SELECT days FROM staff_att_schedules WHERE employee_id=$1', [v.employeeId])).rows[0]?.days || {};
            const day = sched[String(t.weekday(date))];
            if (lastOut == null) throw error(409, 'Avval ketishni yuz bilan belgilang — qoʻshimcha vaqt shundan hisoblanadi');
            if (!day) throw error(409, 'Dam olish kuni — “Yakshanba navbatchiligi” orqali yuboring');
            // Faqat grafik tugaganidan keyingi vaqt (ketish yuz bilan belgilangan) hisoblanadi.
            minutes = Math.max(0, lastOut - t.parseClock(day.end));
            if (minutes < 15) throw error(409, 'Ish tugaganidan keyin 15 daqiqadan kam qolgansiz');
            evidence = { date, from: day.end, to: t.clock(lastOut) };
        }
    }
    const value = R.washValue(kind, { minutes, amount: body.amount }, cfg);
    const id = randomUUID();
    const ins = await db.query(`INSERT INTO staff_fine_washes(id,employee_id,user_id,kind,month,fine_id,minutes,value,note,evidence)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING id`, [id, v.employeeId, v.id, kind, month, body.fineId ? String(body.fineId) : null, minutes, value,
        String(body.note || '').trim().slice(0, 300), JSON.stringify(evidence)]);
    if (!ins.rowCount) throw error(409, 'Bu kun uchun soʻrov allaqachon yuborilgan');
    return { id, value, minutes };
}
// Rahbar doirasi SQL'da (LIMIT dan oldin): R.canManage bilan bir xil — ROP: sotuv, akademik: ustoz/yordamchi, o'z tilida.
// Til: rus/ingliz-oqituvchi lavozimidan, aks holda he.lang ('both' — har ikkisi). JS'dagi canManage ikkinchi himoya sifatida qoladi.
function scopeSql(v, he = 'he', from = 1) {
    if (v.kind === 'admin') return { sql: 'TRUE', params: [] };
    const roles = v.kind === 'rop' ? ['sotuv-menejeri', 'sotuv_menejeri', 'sotuv menejeri', 'sales_manager'] : ['yordamchi', 'oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi', 'asosiy'];
    const lang = `(CASE ${he}.role WHEN 'rus-oqituvchi' THEN 'russian' WHEN 'ingliz-oqituvchi' THEN 'english' ELSE COALESCE(NULLIF(LOWER(${he}.lang),''),'') END)`;
    const params = [roles];
    let sql = `${he}.role=ANY($${from}::text[])`;
    if (v.langs) { params.push(v.langs); sql += ` AND (${lang} IN ('','both') OR ${lang}=ANY($${from + 1}::text[]))`; }
    if (v.employeeId) { params.push(v.employeeId); sql += ` AND ${he}.id<>$${from + params.length - 1}`; }
    return { sql, params };
}
async function washInbox(db, user, tab = 'pending', v = null) {
    v = v || await viewer(db, user);
    if (!['admin', 'rop', 'academic'].includes(v.kind)) throw error(403, 'Yuvish soʻrovlarini rahbar tasdiqlaydi');
    const sc = scopeSql(v);
    const rows = (await db.query(`SELECT w.*,he.name,he.role AS emp_role,he.lang,u.role AS user_role FROM staff_fine_washes w JOIN hr_employees he ON he.id=w.employee_id
        LEFT JOIN users u ON u.id=w.user_id WHERE ${tab === 'history' ? "w.state IN ('approved','rejected') AND w.kind<>'streak'" : "w.state='pending'"} AND ${sc.sql}
        ORDER BY w.created_at ${tab === 'history' ? 'DESC' : ''} LIMIT 100`, sc.params)).rows;
    const out = rows.filter(w => R.canManage(v, { employeeId: w.employee_id, role: fineRole(w.user_role, w.emp_role), lang: att().empLang({ role: w.emp_role, lang: w.lang }) }) && w.employee_id !== v.employeeId)
        .map(w => ({ id: w.id, employeeId: w.employee_id, name: w.name, kind: w.kind, minutes: w.minutes, value: Number(w.value), note: w.note, evidence: w.evidence, state: w.state, reason: w.decision_reason, createdAt: w.created_at }));
    return { rows: out, pending: out.filter(w => w.state === 'pending').length };
}
async function decideWash(db, user, id, body = {}, now = new Date()) {
    const v = await viewer(db, user);
    const w = (await db.query(`SELECT w.*,he.role AS emp_role,he.lang,u.role AS user_role FROM staff_fine_washes w JOIN hr_employees he ON he.id=w.employee_id
        LEFT JOIN users u ON u.id=w.user_id WHERE w.id=$1`, [String(id || '')])).rows[0];
    if (!w) throw error(404, 'Soʻrov topilmadi');
    const o = { employeeId: w.employee_id, role: fineRole(w.user_role, w.emp_role), lang: att().empLang({ role: w.emp_role, lang: w.lang }) };
    if (!R.canManage(v, o) || v.employeeId === w.employee_id) throw error(403, 'Bu soʻrov sizga yuborilmagan');
    if (w.state !== 'pending') throw error(409, 'Soʻrov allaqachon koʻrib chiqilgan');
    if (body.decision === 'reject') {
        const reason = String(body.reason || '').trim().slice(0, 200);
        if (!reason) throw error(400, 'Rad etish sababini yozing');
        const u = await db.query(`UPDATE staff_fine_washes SET state='rejected',decided_by=$2,decided_at=NOW(),decision_reason=$3 WHERE id=$1 AND state='pending' RETURNING id`, [w.id, v.id, reason]);
        if (!u.rowCount) throw error(409, 'Soʻrov allaqachon koʻrib chiqilgan');
        return { state: 'rejected' };
    }
    if (body.decision !== 'approve') throw error(400, 'Qarorni tanlang');
    const today = t.tashkentDate(now);
    if (!R.canWash(w.month + '-01', today)) throw error(409, 'Yuvish muddati tugagan');
    const cfg = await configAt(db, w.month + '-01');
    if (w.kind === 'task' && !(Number(body.amount) > 0)) throw error(400, 'Vazifa uchun yuviladigan summani kiriting');
    const value = w.kind === 'task' ? Math.round(Number(body.amount)) : Number(w.value);
    const fines = (await db.query(`SELECT id,code,amount,washed,state,warning FROM staff_fines WHERE employee_id=$1 AND month=$2 AND state='active' FOR UPDATE`, [w.employee_id, w.month])).rows
        .map(f => ({ ...f, amount: Number(f.amount), washed: Number(f.washed) }));
    const { parts } = R.allocateWash(fines, value, cfg, w.fine_id || null);
    const u = await db.query(`UPDATE staff_fine_washes SET state='approved',decided_by=$2,decided_at=NOW(),parts=$3,value=$4 WHERE id=$1 AND state='pending' RETURNING id`,
        [w.id, v.id, JSON.stringify(parts), value]);
    if (!u.rowCount) throw error(409, 'Soʻrov allaqachon koʻrib chiqilgan');
    for (const p of parts) await db.query('UPDATE staff_fines SET washed=washed+$2 WHERE id=$1', [p.id, p.amount]);
    return { state: 'approved', washed: parts.reduce((a, p) => a + p.amount, 0) };
}

// ── Admin sozlamalari (J05) ──────────────────────────────────────────────────
async function requireAdmin(db, user) {
    const v = await viewer(db, user);
    if (v.kind !== 'admin') throw error(403, 'Faqat admin');
    return v;
}
async function getConfig(db, user, now = new Date()) {
    await requireAdmin(db, user);
    const today = t.tashkentDate(now);
    const vers = await versions(db);
    const next = R.nextMonthStart(today);
    const pending = vers.filter(x => x.effective > today).pop();
    const history = (await db.query(`SELECT actor_name,text,TO_CHAR(effective,'YYYY-MM-DD') AS effective,created_at FROM staff_fine_changes ORDER BY id DESC LIMIT 30`)).rows;
    return { current: R.configFor(vers, today), draft: pending ? R.normalizeConfig(pending.data) : R.configFor(vers, today), effectiveFrom: next,
        hasPending: !!pending, history, labels: R.ROLE_LABELS, roles: R.ROLES };
}
function diffText(a, b) {
    const out = [];
    for (const r of R.ROLES) {
        const A = a.roles[r] || [], B = b.roles[r] || [];
        for (const x of B) {
            const y = A.find(z => z.code === x.code);
            const who = `${R.ROLE_LABELS[r]}: “${x.label}”`;
            if (!y) out.push(`${who} qoʻshildi, ${money(x.amount)}`);
            else {
                if (y.amount !== x.amount) out.push(`${who} ${money(y.amount)} → ${money(x.amount)}`);
                if (y.active !== x.active) out.push(`${who} ${x.active ? 'yoqildi' : 'oʻchirildi'}`);
                if (y.warnFirst !== x.warnFirst) out.push(`${who} 1-marta ogohlantirish ${x.warnFirst ? 'yoqildi' : 'oʻchirildi'}`);
            }
        }
        for (const y of A) if (!B.some(z => z.code === y.code)) out.push(`${R.ROLE_LABELS[r]}: “${y.label}” olib tashlandi`);
    }
    const L = { graceMinutes: 'imtiyoz', capPercent: 'oylik chegara %', cleanMonthBonus: '“Toza oy” bonusi', cleanMonthOn: '“Toza oy”', appealDays: 'eʼtiroz muddati',
        washHour: '1 soat narxi', washSunday: 'yakshanba narxi', washStreakCount: 'avto yuvish soni', washLearning: 'oʻrganish narxi', absentWashPercent: 'kelmaslik yuvish limiti %' };
    for (const k of Object.keys(L)) if (a.soft[k] !== b.soft[k]) out.push(`${L[k]} ${a.soft[k]} → ${b.soft[k]}`);
    return out;
}
async function saveConfig(db, user, raw, now = new Date()) {
    const v = await requireAdmin(db, user);
    const today = t.tashkentDate(now), effective = R.nextMonthStart(today);
    const vers = await versions(db);
    const before = R.configFor(vers, effective);
    const next = R.normalizeConfig(raw);
    const changes = diffText(before, next);
    if (!changes.length) return { saved: false, effective };
    await db.query('INSERT INTO staff_fine_settings(effective,data,created_by) VALUES($1,$2,$3)', [effective, JSON.stringify(next), v.id]);
    for (const c of changes.slice(0, 40)) await db.query('INSERT INTO staff_fine_changes(actor_id,actor_name,text,effective) VALUES($1,$2,$3,$4)', [v.id, v.name || '', c, effective]);
    return { saved: true, effective, changes };
}

// ── Moliya: xodim bo'yicha oy jami (Maoshlar sahifasi) ───────────────────────
// salaries: { employeeId: hisoblangan summa } — chegara uchun. Javob: { employeeId: {gross, washed, net, cap, deducted, bonus} }
async function monthTotals(db, user, month, salaries = {}) {
    await requireAdmin(db, user);
    if (!t.isMonth(month)) throw error(400, 'Oy notoʻgʻri');
    const cfg = await configAt(db, month + '-01');
    const rows = (await db.query('SELECT employee_id,amount,washed,state,warning FROM staff_fines WHERE month=$1', [month])).rows;
    const by = {};
    for (const r of rows) (by[r.employee_id] ||= []).push({ ...r, amount: Number(r.amount), washed: Number(r.washed) });
    const out = {};
    for (const [id, list] of Object.entries(by)) {
        const s = R.monthSummary(list, salaries[id] != null ? Number(salaries[id]) : null, cfg);
        out[id] = { gross: s.gross, washed: s.washed, net: s.net, cap: s.cap, deducted: s.deducted, bonus: s.bonus, count: list.filter(f => !f.warning && f.state !== 'cancelled').length };
    }
    // Kredit: yuvilgan jarima keyin sababli bo'ldi va summani boshqa jarimaga o'tkazib bo'lmadi — admin hal qiladi.
    for (const c of (await db.query('SELECT employee_id,SUM(amount)::int AS s FROM staff_fine_credits WHERE month=$1 AND NOT resolved GROUP BY 1', [month])).rows) {
        out[c.employee_id] ||= { gross: 0, washed: 0, net: 0, cap: null, deducted: 0, bonus: 0, count: 0 };
        out[c.employee_id].credit = Number(c.s);
    }
    return { month, totals: out, cleanBonus: cfg.soft.cleanMonthOn ? cfg.soft.cleanMonthBonus : 0 };
}

// Rahbar/admin uchun kutilayotgan ishlar soni (menyu nishonlari).
async function counts(db, user) {
    const v = await viewer(db, user);
    const out = { kind: v.kind, canIssue: ['admin', 'rop', 'academic'].includes(v.kind), washPending: 0, appeals: 0, exempt: v.kind === 'admin' || v.kind === 'other' };
    if (out.canIssue) {
        out.washPending = (await washInbox(db, user, 'pending', v)).pending;
        const sc = scopeSql(v);
        const ap = (await db.query(`SELECT f.employee_id,f.role,he.lang,he.role AS emp_role FROM staff_fines f JOIN hr_employees he ON he.id=f.employee_id WHERE f.state='appeal' AND ${sc.sql}`, sc.params)).rows;
        out.appeals = ap.filter(r => R.canManage(v, { employeeId: r.employee_id, role: r.role, lang: att().empLang({ role: r.emp_role, lang: r.lang }) })).length;
    }
    return out;
}
async function appeals(db, user) {
    const v = await viewer(db, user);
    if (!['admin', 'rop', 'academic'].includes(v.kind)) throw error(403, 'Ruxsat yoʻq');
    const rows = (await db.query(`${FINE_SELECT} WHERE f.state='appeal' ORDER BY f.appeal_at`)).rows;
    const today = t.tashkentDate();
    const out = [];
    for (const f of rows) { const o = await owner(db, f.employee_id); if (R.canManage(v, o) && o.employeeId !== v.employeeId) out.push(fineView(f, await configAt(db, f.work_date), today)); }
    return { rows: out };
}

const pushPass = { key: 0, inbox: new Map() };
// Push (staffNotify → Jamoa APK): yangi jarima (ogohlantirishsiz), yuvish va e'tiroz javobi; rahbarga — yangi yuvish so'rovi.
async function pushEvents(db, userId, now = new Date()) {
    if (!(await db.query("SELECT to_regclass('public.staff_fines') AS t")).rows[0]?.t) return [];
    const v = await viewer(db, { id: userId }).catch(() => null);
    if (!v) return [];
    const ev = [];
    if (v.employeeId) {
        const rows = (await db.query(`SELECT id,label,amount,state,appeal_answer,created_at,appeal_at FROM staff_fines WHERE employee_id=$1 AND NOT warning AND created_at>NOW()-INTERVAL '2 days'`, [v.employeeId])).rows;
        for (const f of rows) ev.push({ id: `fine:${f.id}`, type: 'fine_new', cat: 'boshqa', tone: 'warn', pushOnly: true, title: `Jarima: ${money(f.amount)} soʻm`,
            sub: `${f.label} · yuvish yoʻllari ilovada`, at: new Date(f.created_at).toISOString(), go: { tab: 'jarimalar' } });
        const ws = (await db.query(`SELECT id,state,value,decided_at FROM staff_fine_washes WHERE employee_id=$1 AND kind<>'streak' AND state IN ('approved','rejected') AND decided_at>NOW()-INTERVAL '2 days'`, [v.employeeId])).rows;
        for (const w of ws) ev.push({ id: `finewash:${w.id}:${w.state}`, type: 'fine_new', cat: 'boshqa', tone: w.state === 'approved' ? 'ok' : 'warn', pushOnly: true,
            title: w.state === 'approved' ? `Jarima yuvildi: ${money(w.value)} soʻm` : 'Yuvish soʻrovi rad etildi', sub: 'Mening jarimalarim', at: new Date(w.decided_at).toISOString(), go: { tab: 'jarimalar' } });
    }
    if (['admin', 'rop', 'academic'].includes(v.kind)) {
        // Bir push o'tishida (30 s) bir xil doiradagi rahbarlar uchun navbat bir marta o'qiladi.
        const key = Math.floor(now.getTime() / 30000), sk = v.kind + '|' + (v.langs || []).join(',');
        if (pushPass.key !== key) { pushPass.key = key; pushPass.inbox = new Map(); }
        if (!pushPass.inbox.has(sk)) pushPass.inbox.set(sk, washInbox(db, { id: userId }, 'pending', { ...v, employeeId: null }).catch(() => ({ rows: [] })));
        const inbox = { rows: (await pushPass.inbox.get(sk)).rows.filter(w => w.employeeId !== v.employeeId) };
        for (const w of inbox.rows.filter(x => Date.now() - new Date(x.createdAt) < 86400000)) ev.push({ id: `finewashreq:${w.id}`, type: 'fine_new', cat: 'tasdiq', tone: 'info', pushOnly: true,
            title: `Yuvish soʻrovi: ${String(w.name || '').split(/\s+/)[0]}`, sub: `${money(w.value)} soʻm`, at: new Date(w.createdAt).toISOString(), go: { tab: 'jarimalar' } });
    }
    return ev;
}

module.exports = { SCHEMA, initSchema, tick, pushEvents, syncAttendance, mine, unseen, markSeen, detail, appeal, answerAppeal, team, issue, requestWash, washInbox, decideWash,
    getConfig, saveConfig, monthTotals, counts, appeals, fineRole, viewer };
