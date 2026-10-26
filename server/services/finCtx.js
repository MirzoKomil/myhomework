// Moliyaviy yozuvni qaysi ilova tranzaksiyasi qilganini isbotlovchi belgi (fin.ctx).
// Belgi bazada saqlanadigan sirsiz HMAC bilan imzolanadi: kalit faqat server muhitida (FIN_SEAL_KEY),
// shuning uchun bazaga to'g'ridan-to'g'ri SQL bilan kirgan odam "ilova nomidan" yozuv soxtalashtira olmaydi —
// u qo'ygan belgi imzosiz bo'ladi va yaxlitlik tekshiruvi buni ushlaydi.
const { createHmac, randomUUID, timingSafeEqual } = require('crypto');
const fs = require('fs');
const path = require('path');
// Server diskidagi (bazadan tashqari) nazorat papkasi: zanjir boshi va buzilish ogohlantirishi shu yerda turadi —
// bazaga kirgan odam bularni o'zgartira olmaydi.
function guardDir() {
    const base = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '../../data');
    const dir = path.join(base, 'finance-guard');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}
function writeJson(file, data) { const tmp = file + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(data)); fs.renameSync(tmp, file); }
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
const headFile = () => path.join(guardDir(), 'head.json');
const alarmFile = () => path.join(guardDir(), 'alarm.json');
const DEV_KEY = 'myhomework-dev-secret-change-in-production';
const KEY = process.env.FIN_SEAL_KEY || process.env.JWT_SECRET || DEV_KEY;
const mac = s => createHmac('sha256', KEY).update('fin-ctx|' + s).digest('hex').slice(0, 32);
function token(prefix) {
    const id = randomUUID();
    return `${prefix}:${id}.${mac(prefix + ':' + id)}`;
}
const RE = /^([a-z]+):([0-9a-f-]{36})\.([0-9a-f]{32})$/;
function valid(ctx) {
    const m = RE.exec(String(ctx || ''));
    if (!m) return false;
    const a = Buffer.from(mac(m[1] + ':' + m[2])), b = Buffer.from(m[3]);
    return a.length === b.length && timingSafeEqual(a, b);
}
// Tranzaksiya imzosi: ilova tranzaksiyasi tugashidan oldin shu tranzaksiyada yaratilgan barcha muhr va audit
// yozuvlari xeshlarini (Postgres tranzaksiya raqami bilan) kalit bilan imzolaydi. Imzosiz yoki imzosi mos kelmagan
// tranzaksiya — ilovadan tashqari yozuv (belgi nusxalangan bo'lsa ham, triggerlar o'chirilgan bo'lsa ham).
const txMac = (xid, seals, audits) => createHmac('sha256', KEY).update('fin-tx|' + xid + '|' + seals.join(',') + '|' + audits.join(',')).digest('hex');
let ready = false, structureCheck = null;
const setStructureCheck = fn => { structureCheck = fn; };
async function hashesOf(db, xid) {
    const r = (await db.query(`SELECT (SELECT COALESCE(array_agg(row_hash ORDER BY seq), '{}') FROM fin_row_seals WHERE xid=$1) AS s,
        (SELECT COALESCE(array_agg(hash ORDER BY id), '{}') FROM fin_audit WHERE xid=$1) AS a`, [xid])).rows[0];
    return { seals: r.s, audits: r.a };
}
// ---------- Ilova niyati (intent) ----------
// Ilova tranzaksiya ichida qaysi moliyaviy jadvalga NIMA yozganini o'zi qayd etadi (SQL va parametrlaridan).
// Imzolashdan oldin bazadagi muhrlar shu ro'yxat bilan solishtiriladi: ilova yozmagan qator (yashirin trigger qo'shgan)
// yoki ilova yozganidan farqli qiymat (BEFORE trigger o'zgartirgan) bo'lsa — tranzaksiya imzolanmaydi va bekor qilinadi.
const SEALED_TABLES = { payment_records: 'id', fin_transactions: 'id', payment_record_voids: 'record_id', fin_account_checks: 'id', fin_asset_events: 'id',
    fin_accounts: 'id', fin_payables: 'id', fin_contract_values: 'record_id', fin_settings_history: 'id', fin_period_locks: 'month', fin_period_snapshots: 'month', salary_transactions: 'id',
    fin_student_log: 'id', fin_settings: 'id', fin_contract_events: 'id', fin_salary_roles: 'salary_id', fin_receipt_reviews: 'record_id', fin_student_corrections: 'id' };
const TRACKED = new Set([...Object.keys(SEALED_TABLES), 'students']);
// Moliyaning o'z triggerlari keltirib chiqaradigan yozuvlar (triggerlar imzolangan izda): qaysi ilova yozuvidan kelib chiqishi.
const DERIVED = { fin_contract_values: ['payment_records', 'I'], fin_salary_roles: ['salary_transactions', 'I'], fin_student_log: ['students', '*'] };
function splitTop(str) {
    const out = []; let depth = 0, quote = false, cur = '';
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (quote) { cur += ch; if (ch === "'" && str[i + 1] === "'") { cur += str[++i]; } else if (ch === "'") quote = false; continue; }
        if (ch === "'") { quote = true; cur += ch; continue; }
        if (ch === '(') depth++; if (ch === ')') depth--;
        if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
        cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}
const SKIP = Symbol('skip');
function resolve(token, values) {
    const t = token.replace(/::[\w\[\] ]+$/, '').trim();
    let m;
    if ((m = /^\$(\d+)$/.exec(t))) return values?.[Number(m[1]) - 1];
    if ((m = /^'((?:[^']|'')*)'$/.exec(t))) return m[1].replace(/''/g, "'");
    if (/^NULL$/i.test(t)) return null;
    if (/^TRUE$/i.test(t)) return true;
    if (/^FALSE$/i.test(t)) return false;
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    return SKIP;
}
const keyOf = t => SEALED_TABLES[t] || 'id';
// INSERT ... VALUES(...) ni ustun → qiymat xaritasiga aylantiradi (bitta qatorli ko'rinish); aks holda null.
function parseInsert(sql, values) {
    const m = /^\s*INSERT\s+INTO\s+(\w+)\s*(?:\(([^)]*)\))?\s*([\s\S]*)$/i.exec(sql);
    if (!m || !TRACKED.has(m[1])) return null;
    const rest = m[3].trim();
    const vm = /^VALUES\s*\(([\s\S]*?)\)\s*(ON\s+CONFLICT[\s\S]*?)?(?:\s+RETURNING[\s\S]*)?$/i.exec(rest);
    const cols = m[2] ? m[2].split(',').map(c => c.trim()) : [];
    const out = { table: m[1], cols, row: null, conflict: null };
    if (vm && cols.length) {
        const vals = splitTop(vm[1]);
        if (vals.length === cols.length && !/\)\s*,\s*\(/.test(vm[1].replace(/'(?:[^']|'')*'/g, "''"))) {
            out.row = {}; out.tokens = {};
            cols.forEach((c, i) => { const v = resolve(vals[i], values); out.tokens[c] = vals[i]; if (v !== SKIP) out.row[c] = v; });
        }
        const cm = vm[2] && /^ON\s+CONFLICT\s*\(([^)]*)\)\s*DO\s+UPDATE\s+SET\s+([\s\S]*?)(?:\s+WHERE\s+[\s\S]*)?$/i.exec(vm[2].trim());
        if (cm) out.conflict = { cols: cm[1].split(',').map(c => c.trim()), set: splitTop(cm[2]).map(a => a.split('=')[0].trim()) };
        else if (vm[2] && /DO\s+UPDATE/i.test(vm[2])) out.conflict = { cols: null, set: null };
        if (vm[2] && /DO\s+NOTHING/i.test(vm[2])) out.optional = true;
    }
    return out;
}
// UPDATE/DELETE: jadval, taxallus, SET ustunlari (va qiymatlari), WHERE.
function parseChange(sql, values) {
    let m = /^\s*UPDATE\s+(\w+)(?:\s+(?:AS\s+)?(?!SET\b)(\w+))?\s+SET\s+([\s\S]*?)(?:\s+WHERE\s+([\s\S]*?))?(?:\s+RETURNING\s+[\s\S]*)?$/i.exec(sql);
    if (m && TRACKED.has(m[1])) {
        const set = {}; const cols = [];
        for (const a of splitTop(m[3])) {
            const i = a.indexOf('='); const c = a.slice(0, i).trim(); const expr = a.slice(i + 1).trim(); cols.push(c);
            // jsonb birlashtirish: col = col || $n::jsonb — kutilgan natija = oldingi qiymat + parametr.
            const mm = new RegExp('^' + c + '\\s*\\|\\|\\s*\\$(\\d+)(?:::jsonb)?$', 'i').exec(expr);
            if (mm) { const v = values?.[Number(mm[1]) - 1]; try { set[c] = { __merge: typeof v === 'string' ? JSON.parse(v) : v }; } catch {} continue; }
            const v = resolve(expr, values); if (v !== SKIP) set[c] = v;
        }
        return { op: 'U', table: m[1], alias: m[2] || null, where: m[4] || null, cols, set };
    }
    m = /^\s*DELETE\s+FROM\s+(\w+)(?:\s+(?:AS\s+)?(?!WHERE\b)(\w+))?(?:\s+WHERE\s+([\s\S]*?))?(?:\s+RETURNING\s+[\s\S]*)?$/i.exec(sql);
    if (m && TRACKED.has(m[1])) return { op: 'D', table: m[1], alias: m[2] || null, where: m[3] || null, cols: [], set: {} };
    return null;
}
// WHERE dagi $n larni qayta raqamlab, o'zgarishdan OLDIN qaysi qatorlar tegishini (va ularning holatini) o'qiydi.
async function probe(client, orig, table, alias, where, values) {
    const nums = []; const w = (where || 'TRUE').replace(/\$(\d+)/g, (_, n) => { const i = nums.indexOf(n); if (i >= 0) return '$' + (i + 1); nums.push(n); return '$' + nums.length; });
    const params = nums.map(n => values?.[Number(n) - 1]);
    const ref = alias || table;
    await orig.call(client, 'SAVEPOINT fin_probe');
    try {
        const r = await orig.call(client, `SELECT ${ref}.${keyOf(table)}::text AS k, pg_catalog.to_jsonb(${ref}) AS r FROM ${table} ${alias || ''} WHERE ${w} FOR UPDATE`, params);
        await orig.call(client, 'RELEASE SAVEPOINT fin_probe');
        return r.rows;
    } catch (e) { await orig.call(client, 'ROLLBACK TO SAVEPOINT fin_probe'); return null; }
}
function intentState(client) {
    if (!client.__finState) client.__finState = { inserts: new Map(), changes: new Map(), deletes: new Set(), broken: null };
    return client.__finState;
}
async function capture(client, orig, sql, values) {
    const st = intentState(client);
    const ins = parseInsert(sql, values);
    if (ins) {
        if (!ins.row) { if (!/^\s*INSERT\s+INTO\s+\w+\s*(\([^)]*\))?\s*SELECT\b/i.test(sql) || SEALED_TABLES[ins.table]) st.broken = st.broken || `${ins.table}: tahlil qilinmagan INSERT`; return; }
        const k = ins.row[keyOf(ins.table)];
        if (ins.conflict) {
            // Upsert: ziddiyat ustunlari bo'yicha mavjud qator (yangilanadigan) oldindan o'qiladi.
            if (!ins.conflict.cols || ins.conflict.cols.some(c => !(c in ins.row))) { st.broken = st.broken || `${ins.table}: upsert kaliti aniqlanmadi`; return; }
            const where = ins.conflict.cols.map((c, i) => `${c} = $${i + 1}`).join(' AND ');
            const rows = await probe(client, orig, ins.table, null, where, ins.conflict.cols.map(c => ins.row[c]));
            if (rows === null) { st.broken = st.broken || `${ins.table}: upsert tekshiruvi bajarilmadi`; return; }
            for (const r of rows) addChange(st, ins.table, r.k, r.r, ins.conflict.set, Object.fromEntries(ins.conflict.set.filter(c => c in ins.row).map(c => [c, ins.row[c]])));
            if (rows.length) return; // qo'shilmaydi, yangilanadi
        }
        const list = st.inserts.get(ins.table) || []; list.push({ key: k == null ? null : String(k), row: ins.row, optional: !!ins.optional }); st.inserts.set(ins.table, list);
        return;
    }
    const ch = parseChange(sql, values);
    if (!ch) { if (/^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql)) { const t = /^\s*(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/i.exec(sql)?.[1]; if (t && TRACKED.has(t)) st.broken = st.broken || `${t}: tahlil qilinmagan o‘zgartirish`; } return; }
    const rows = await probe(client, orig, ch.table, ch.alias, ch.where, values);
    if (rows === null) { st.broken = st.broken || `${ch.table}: o‘zgartirish tekshiruvi bajarilmadi`; return; }
    for (const r of rows) {
        if (ch.op === 'D') st.deletes.add(ch.table + '|' + r.k);
        else addChange(st, ch.table, r.k, r.r, ch.cols, ch.set);
    }
}
function addChange(st, table, key, before, cols, set) {
    const id = table + '|' + key, cur = st.changes.get(id);
    if (!cur) st.changes.set(id, { before, allowed: new Set([...cols, 'updated_at']), set: { ...set } });
    else { cols.forEach(c => cur.allowed.add(c)); Object.assign(cur.set, set); for (const c of cols) if (!(c in set)) delete cur.set[c]; }
}
// Tranzaksiya boshida ulanishga bog'lanadi, oxirida (finally) albatta yechiladi (ulanish havzaga qaytadi).
function track(client, { skipVerify = false } = {}) {
    if (client.__finTracked) return () => {};
    const orig = client.query;
    client.__finTracked = true; client.__finSkipIntents = skipVerify; delete client.__finState; intentState(client);
    client.query = function (text, values) {
        const sql = String(typeof text === 'object' && text ? text.text : text || ''), vals = typeof text === 'object' && text ? text.values : values;
        if (typeof arguments[arguments.length - 1] === 'function' || !/^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql)) return orig.apply(this, arguments);
        const args = arguments;
        return (async () => {
            try { await capture(client, orig, sql, vals); } catch (e) { intentState(client).broken = intentState(client).broken || ('tahlil xatosi: ' + e.message); }
            return orig.apply(client, args);
        })();
    };
    return () => { client.query = orig; delete client.__finTracked; delete client.__finState; delete client.__finSkipIntents; };
}
const canon = v => {
    if (v === undefined || v === null) return null;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') { const t = v.trim(); if (/^[\[{]/.test(t)) { try { return canon(JSON.parse(t)); } catch { return v; } } return v; }
    if (Array.isArray(v)) return '[' + v.map(x => JSON.stringify(canon(x))).join(',') + ']';
    if (typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + JSON.stringify(canon(v[k]))).join(',') + '}';
    return String(v);
};
function sameValue(intended, stored) {
    if (intended instanceof Date && typeof stored === 'string') {
        const local = `${intended.getFullYear()}-${String(intended.getMonth() + 1).padStart(2, '0')}-${String(intended.getDate()).padStart(2, '0')}`;
        if (stored.length <= 10) return stored === local || stored === intended.toISOString().slice(0, 10);
        return Date.parse(stored) === intended.getTime();
    }
    const a = canon(intended), b = canon(stored);
    if (a === b) return true;
    if (a == null || b == null) return a === b || (a === '' && b == null) || (b === '' && a == null);
    if (/^-?\d+(\.\d+)?$/.test(a) && /^-?\d+(\.\d+)?$/.test(b)) return Number(a) === Number(b);
    // Vaqt belgisi (timestamptz): bir xil lahza turli vaqt mintaqasida yozilishi mumkin (baza UTC, ilova +05:00) — lahza bo'yicha solishtiriladi.
    if (/^\d{4}-\d{2}-\d{2}/.test(a) && /^\d{4}-\d{2}-\d{2}/.test(b)) {
        if (a.length > 10 && b.length > 10) return Date.parse(a) === Date.parse(b);
        return a.slice(0, 10) === b.slice(0, 10);
    }
    return false;
}
async function verifyIntents(db, xid) {
    if (db.__finSkipIntents || !db.__finState) return;
    const st = db.__finState;
    const fail = (t, k, why) => { throw Object.assign(new Error(`FIN_TAMPER: ${t}/${k}: ${why} — bazada ilovadan tashqari o‘zgartirish (trigger) bor, yozuv bekor qilindi`), { status: 409 }); };
    const seals = (await db.query('SELECT table_name, row_id, op FROM fin_row_seals WHERE xid=$1 ORDER BY seq', [xid])).rows;
    if (st.broken && seals.length) fail('*', '', 'ilova o‘z yozuvini tekshira olmadi (' + st.broken + ')');
    const insertedKeys = t => new Set((st.inserts.get(t) || []).map(i => i.key).filter(k => k != null));
    const studentKeys = new Set([...insertedKeys('students'), ...[...st.changes.keys(), ...st.deletes].filter(k => k.startsWith('students|')).map(k => k.slice(9))]);
    const read = async (t, k) => (await db.query(`SELECT pg_catalog.to_jsonb(t) AS r FROM ${t} t WHERE ${keyOf(t)}::text = $1`, [String(k)])).rows[0]?.r;
    const used = new Set();
    for (const sl of seals) {
        const t = sl.table_name, k = String(sl.row_id);
        if (t === 'fin_student_log') {
            const r = await read(t, k);
            if (r && studentKeys.has(String(r.student_id))) continue;
            if (r && (st.inserts.get('fin_student_log') || []).some(i => String(i.row.student_id) === String(r.student_id))) continue;
            fail(t, k, 'ilova yozmagan o‘quvchi holati');
        }
        if (t === 'fin_contract_values') { if (insertedKeys('payment_records').has(k) || insertedKeys('fin_contract_values').has(k)) continue; fail(t, k, 'ilova qo‘shmagan tushum qiymati'); }
        if (t === 'fin_salary_roles') { if (insertedKeys('salary_transactions').has(k) || insertedKeys('fin_salary_roles').has(k)) continue; fail(t, k, 'ilova qo‘shmagan maosh lavozimi'); }
        if (sl.op === 'D') { if (st.deletes.has(t + '|' + k)) continue; fail(t, k, 'ilova o‘chirmagan qator o‘chirilgan'); }
        const ch = st.changes.get(t + '|' + k);
        if (sl.op === 'U') {
            if (!ch) fail(t, k, 'ilova o‘zgartirmagan qator o‘zgargan');
            const now = await read(t, k); if (!now) continue;
            for (const col of Object.keys(now)) {
                if (!ch.allowed.has(col) && ch.before && !sameValue(ch.before[col], now[col])) fail(t, k, `“${col}” ustuni ilova o‘zgartirmagan holda o‘zgargan`);
                if (col in ch.set && !sameValue(expectedSet(ch, col), now[col])) fail(t, k, `“${col}” ustuni ilova yozganidan farq qiladi`);
            }
            continue;
        }
        // INSERT: kalit bo'yicha, ketma-ket raqamli jadvalda tartib bo'yicha.
        const list = st.inserts.get(t) || [];
        let it = list.find(i => !used.has(i) && i.key === k) || list.find(i => !used.has(i) && i.key == null);
        if (!it) fail(t, k, 'ilova bunday qator qo‘shmagan');
        used.add(it);
        const now = await read(t, k); if (!now) continue;
        const later = ch ? ch.allowed : new Set();
        for (const [col, v] of Object.entries(it.row)) if (!later.has(col) && Object.prototype.hasOwnProperty.call(now, col) && !sameValue(v, now[col])) fail(t, k, `“${col}” ustuni ilova yozganidan farq qiladi`);
    }
    // Teskari yo'nalish (to'liqlik): ilova yozgan har bir moliyaviy qator muhrlangan bo'lishi, o'zgartirgan/o'chirgan qatorlari
    // aynan ilova yozgandek bo'lishi shart (BEFORE trigger qatorni "yutib" yuborsa yoki o'quvchi holatini almashtirsa — ushlanadi).
    for (const [t, list] of st.inserts) for (const it of list) {
        if (used.has(it) || it.optional) continue;
        if (SEALED_TABLES[t]) fail(t, it.key || '?', 'ilova yozgan qator bazada yo‘q (muhrlanmagan)');
        if (t === 'students' && it.key != null) {
            const now = await read(t, it.key);
            if (!now) { if (!st.deletes.has(t + '|' + it.key) || true) fail(t, it.key, 'ilova yozgan o‘quvchi qatori bazada yo‘q'); }
            const ch = st.changes.get(t + '|' + it.key), later = ch ? ch.allowed : new Set();
            for (const [col, v] of Object.entries(it.row)) if (!later.has(col) && Object.prototype.hasOwnProperty.call(now, col) && !sameValue(v, now[col])) fail(t, it.key, `“${col}” ustuni ilova yozganidan farq qiladi`);
        }
    }
    for (const [id, ch] of st.changes) {
        const [t, k] = [id.slice(0, id.indexOf('|')), id.slice(id.indexOf('|') + 1)];
        if (st.deletes.has(id)) continue;
        const now = await read(t, k);
        if (!now) { if ((st.inserts.get(t) || []).some(i => i.key === k)) continue; fail(t, k, 'ilova o‘zgartirgan qator yo‘qolgan'); }
        for (const col of Object.keys(now)) {
            if (!ch.allowed.has(col) && ch.before && !sameValue(ch.before[col], now[col]) && !(st.inserts.get(t) || []).some(i => i.key === k)) fail(t, k, `“${col}” ustuni ilova o‘zgartirmagan holda o‘zgargan`);
            if (col in ch.set && !sameValue(expectedSet(ch, col), now[col])) fail(t, k, `“${col}” ustuni ilova yozganidan farq qiladi`);
        }
    }
    for (const id of st.deletes) {
        const [t, k] = [id.slice(0, id.indexOf('|')), id.slice(id.indexOf('|') + 1)];
        if ((st.inserts.get(t) || []).some(i => i.key === k)) continue;
        if (await read(t, k)) fail(t, k, 'ilova o‘chirgan qator hali ham bor');
    }
}
function expectedSet(ch, col) {
    const v = ch.set[col];
    if (v && typeof v === 'object' && '__merge' in v) {
        const base = ch.before?.[col] && typeof ch.before[col] === 'object' ? ch.before[col] : {};
        return { ...base, ...(v.__merge || {}) };
    }
    return v;
}
// Faqat ilova kodi chaqiradi (COMMIT dan oldin). Kechiktirilgan triggerlar (o'quvchi o'chirilishi) avval ishga tushiriladi.
async function signTx(db) {
    if (!ready) ready = !!(await db.query("SELECT to_regclass('fin_tx_signatures') AS t")).rows[0].t;
    if (!ready) return;
    await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    const xid = (await db.query('SELECT pg_current_xact_id_if_assigned()::text AS x')).rows[0].x;
    const st = db.__finState, wrote = !!xid || (st && (st.inserts.size || st.changes.size || st.deletes.size));
    if (wrote && structureCheck && !db.__finSkipIntents) await structureCheck(db);
    if (!xid) return;
    await verifyIntents(db, xid);
    // Diskdagi oldingi zanjir boshi bazada bo'lishi shart: oxirgi yozuvlar o'chirilgan bo'lsa, ogohlantirish ko'tariladi va bosh oldinga surilmaydi.
    const prev = readHead();
    if (prev) {
        const ok = (!prev.sealSeq || (await db.query('SELECT row_hash FROM fin_row_seals WHERE seq=$1', [prev.sealSeq])).rows[0]?.row_hash === prev.sealHash)
            && (!prev.auditId || (await db.query('SELECT hash FROM fin_audit WHERE id=$1', [prev.auditId])).rows[0]?.hash === prev.auditHash);
        if (!ok) { raiseAlarm({ table: 'fin_row_seals', rowId: String(prev.sealSeq), reason: `server diskidagi zanjir boshi (${prev.sealSeq}-muhr) bazada yo‘q — oxirgi yozuvlar o‘chirilgan` }); db.__finNoAdvance = true; }
    }
    await signXid(db, xid);
    const h = (await db.query(`SELECT (SELECT seq FROM fin_row_seals ORDER BY seq DESC LIMIT 1) AS seq, (SELECT row_hash FROM fin_row_seals ORDER BY seq DESC LIMIT 1) AS hash,
        (SELECT id FROM fin_audit WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1) AS aid, (SELECT hash FROM fin_audit WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1) AS ahash`)).rows[0];
    db.__finHead = { sealSeq: Number(h.seq || 0), sealHash: h.hash || '', auditId: Number(h.aid || 0), auditHash: h.ahash || '' };
}
// COMMIT muvaffaqiyatli bo'lgach: zanjir boshi server diskiga (faqat oldinga) yoziladi.
function commitHead(db) {
    const h = db.__finHead, stop = db.__finNoAdvance; delete db.__finHead; delete db.__finNoAdvance;
    if (!h || stop) return;
    try {
        const cur = readJson(headFile());
        if (!cur || h.sealSeq > cur.sealSeq || h.auditId > cur.auditId) writeJson(headFile(), { sealSeq: Math.max(h.sealSeq, cur?.sealSeq || 0), sealHash: h.sealSeq >= (cur?.sealSeq || 0) ? h.sealHash : cur.sealHash,
            auditId: Math.max(h.auditId, cur?.auditId || 0), auditHash: h.auditId >= (cur?.auditId || 0) ? h.auditHash : cur.auditHash, at: new Date().toISOString() });
    } catch { /* disk yozilmasa ham tranzaksiya buzilmaydi */ }
}
const readHead = () => readJson(headFile());
const readAlarm = () => readJson(alarmFile());
function raiseAlarm(r) { try { if (!fs.existsSync(alarmFile())) writeJson(alarmFile(), { at: new Date().toISOString(), table: r.table || '', rowId: r.rowId || '', reason: r.reason || '' }); } catch {} }
function stageAck(ack) { const a = readAlarm(); if (a) writeJson(alarmFile(), { ...a, ack1: ack }); }
// Ikki kishi tasdiqlagandan keyin: zanjir boshi bazaning joriy holatidan qayta yoziladi (oldingisi tarixda qoladi).
async function rebaseline(pool) {
    const h = (await pool.query(`SELECT (SELECT seq FROM fin_row_seals ORDER BY seq DESC LIMIT 1) AS seq, (SELECT row_hash FROM fin_row_seals ORDER BY seq DESC LIMIT 1) AS hash,
        (SELECT id FROM fin_audit WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1) AS aid, (SELECT hash FROM fin_audit WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1) AS ahash`)).rows[0];
    try { const old = readHead(); if (old) fs.appendFileSync(path.join(guardDir(), 'alarm-history.log'), JSON.stringify({ rebaselinedFrom: old, at: new Date().toISOString() }) + '\n'); } catch {}
    writeJson(headFile(), { sealSeq: Number(h.seq || 0), sealHash: h.hash || '', auditId: Number(h.aid || 0), auditHash: h.ahash || '', at: new Date().toISOString(), rebaselined: true });
}
function clearAlarm(note, by) { const a = readAlarm(); if (!a) return null; try { fs.appendFileSync(path.join(guardDir(), 'alarm-history.log'), JSON.stringify({ ...a, clearedAt: new Date().toISOString(), clearedBy: by, note }) + '\n'); fs.unlinkSync(alarmFile()); } catch {} return a; }
async function signXid(db, xid) {
    const { seals, audits } = await hashesOf(db, xid);
    if (!seals.length && !audits.length) return;
    await db.query('INSERT INTO fin_tx_signatures(xid,seals,audits,mac) VALUES($1,$2,$3,$4)', [xid, seals.length, audits.length, txMac(xid, seals, audits)]);
}
const schemaMac = h => createHmac('sha256', KEY).update('fin-schema|' + h).digest('hex');
const validSchemaMac = (h, mac) => { const a = Buffer.from(schemaMac(h)), b = Buffer.from(String(mac || '')); return a.length === b.length && timingSafeEqual(a, b); };
const checkpointMac = c => createHmac('sha256', KEY).update(['fin-checkpoint', c.sealSeq, c.sealHash, c.auditId, c.auditHash, c.prev, c.issuedAt || ''].join('|')).digest('hex');
// Kalit sozlanmagan (ochiq dev kaliti) bo'lsa imzo himoya bermaydi — moliya bo'limida ogohlantiriladi.
const keyConfigured = () => KEY !== DEV_KEY;
module.exports = { stageAck, rebaseline, setStructureCheck, SEALED_TABLES, track, commitHead, readHead, readAlarm, raiseAlarm, clearAlarm, verifyIntents, token, valid, keyConfigured, signTx, signXid, txMac, schemaMac, validSchemaMac, checkpointMac };
