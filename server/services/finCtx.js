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
let ready = false;
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
function record(client, text, values) {
    const sql = String(text || '');
    let m = /^\s*INSERT\s+INTO\s+(\w+)\s*(?:\(([^)]*)\))?\s*([\s\S]*)$/i.exec(sql);
    if (m && TRACKED.has(m[1])) {
        const vm = /^VALUES\s*\(([\s\S]*)\)\s*(?:ON\s+CONFLICT[\s\S]*?)?(?:RETURNING[\s\S]*)?$/i.exec(m[3].trim());
        const cols = m[2] ? m[2].split(',').map(c => c.trim()) : [], vals = vm ? splitTop(vm[1]) : [];
        if (vm && cols.length && cols.length === vals.length && !/\)\s*,\s*\(/.test(vm[1].replace(/'(?:[^']|'')*'/g, "''"))) {
            const row = {}; cols.forEach((c, i) => { const v = resolve(vals[i], values); if (v !== SKIP) row[c] = v; });
            client.__finIntents.push({ table: m[1], op: 'I', row });
        } else client.__finIntents.push({ table: m[1], op: 'I', any: true });
        if (/ON\s+CONFLICT[\s\S]*DO\s+UPDATE/i.test(sql)) client.__finIntents.push({ table: m[1], op: 'U', any: true });
        return;
    }
    if ((m = /^\s*UPDATE\s+(\w+)\b/i.exec(sql)) && TRACKED.has(m[1])) { client.__finIntents.push({ table: m[1], op: 'U', any: true }); return; }
    if ((m = /^\s*DELETE\s+FROM\s+(\w+)\b/i.exec(sql)) && TRACKED.has(m[1])) client.__finIntents.push({ table: m[1], op: 'D', any: true });
}
// Tranzaksiya boshida ulanishga bog'lanadi, oxirida (finally) albatta yechiladi (ulanish havzaga qaytadi).
function track(client, { skipVerify = false } = {}) {
    if (client.__finTracked) return () => {};
    const orig = client.query;
    client.__finTracked = true; client.__finIntents = []; client.__finSkipIntents = skipVerify;
    client.query = function (text, values) {
        try { record(client, typeof text === 'object' && text ? text.text : text, typeof text === 'object' && text ? text.values : values); } catch { client.__finIntents.push({ table: '*', op: '*', any: true, broken: true }); }
        return orig.apply(this, arguments);
    };
    return () => { client.query = orig; delete client.__finTracked; delete client.__finIntents; delete client.__finSkipIntents; };
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
    // Sana ustuni: '2026-10-20' va '2026-10-20T00:00:00' ko'rinishlari.
    if (/^\d{4}-\d{2}-\d{2}/.test(a) && /^\d{4}-\d{2}-\d{2}/.test(b)) return a.slice(0, 10) === b.slice(0, 10) && (a.length <= 10 || b.length <= 10 || Date.parse(a) === Date.parse(b));
    return false;
}
async function verifyIntents(db, xid) {
    if (db.__finSkipIntents || !db.__finIntents) return;
    const intents = db.__finIntents;
    if (intents.some(i => i.broken)) return; // tahlil qila olmagan so'rov — xavfsiz tomonga emas, lekin yozuvni to'xtatmaymiz
    const seals = (await db.query('SELECT table_name, row_id, op FROM fin_row_seals WHERE xid=$1 ORDER BY seq', [xid])).rows;
    const fail = (sl, why) => { throw Object.assign(new Error(`FIN_TAMPER: ${sl.table_name}/${sl.row_id}: ${why} — bazada ilovadan tashqari o‘zgartirish (trigger) bor, yozuv bekor qilindi`), { status: 409 }); };
    for (const sl of seals) {
        const der = DERIVED[sl.table_name];
        if (der && intents.some(i => i.table === der[0] && (der[1] === '*' || i.op === der[1]))) continue;
        const key = SEALED_TABLES[sl.table_name];
        const same = intents.filter(i => i.table === sl.table_name && i.op === sl.op);
        if (!same.length) fail(sl, 'ilova bu jadvalga yozmagan');
        if (sl.op !== 'I') continue;
        // Kalit ilova tomonidan berilgan bo'lsa — kalit bo'yicha; ketma-ket raqam (BIGSERIAL) bo'lsa — tartib bo'yicha, har niyat bir marta.
        let keyed = same.find(i => !i.used && i.row && i.row[key] != null && String(i.row[key]) === String(sl.row_id));
        if (!keyed) keyed = same.find(i => !i.used && i.row && i.row[key] == null);
        if (!keyed) { if (same.some(i => i.any)) continue; fail(sl, 'ilova bunday qator qo‘shmagan'); }
        keyed.used = true;
        const stored = (await db.query(`SELECT pg_catalog.to_jsonb(t) AS r FROM ${sl.table_name} t WHERE ${key}::text = $1`, [String(sl.row_id)])).rows[0]?.r;
        if (!stored) continue; // shu tranzaksiyada keyin o'chirilgan (masalan, qayta ochish)
        for (const [col, v] of Object.entries(keyed.row)) if (Object.prototype.hasOwnProperty.call(stored, col) && !sameValue(v, stored[col])) fail(sl, `“${col}” ustuni ilova yozganidan farq qiladi`);
    }
}
// Faqat ilova kodi chaqiradi (COMMIT dan oldin). Kechiktirilgan triggerlar (o'quvchi o'chirilishi) avval ishga tushiriladi.
async function signTx(db) {
    if (!ready) ready = !!(await db.query("SELECT to_regclass('fin_tx_signatures') AS t")).rows[0].t;
    if (!ready) return;
    await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    const xid = (await db.query('SELECT pg_current_xact_id_if_assigned()::text AS x')).rows[0].x;
    if (!xid) return;
    await verifyIntents(db, xid);
    await signXid(db, xid);
    const h = (await db.query(`SELECT (SELECT seq FROM fin_row_seals ORDER BY seq DESC LIMIT 1) AS seq, (SELECT row_hash FROM fin_row_seals ORDER BY seq DESC LIMIT 1) AS hash,
        (SELECT id FROM fin_audit WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1) AS aid, (SELECT hash FROM fin_audit WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1) AS ahash`)).rows[0];
    db.__finHead = { sealSeq: Number(h.seq || 0), sealHash: h.hash || '', auditId: Number(h.aid || 0), auditHash: h.ahash || '' };
}
// COMMIT muvaffaqiyatli bo'lgach: zanjir boshi server diskiga (faqat oldinga) yoziladi.
function commitHead(db) {
    const h = db.__finHead; delete db.__finHead;
    if (!h) return;
    try {
        const cur = readJson(headFile());
        if (!cur || h.sealSeq > cur.sealSeq || h.auditId > cur.auditId) writeJson(headFile(), { sealSeq: Math.max(h.sealSeq, cur?.sealSeq || 0), sealHash: h.sealSeq >= (cur?.sealSeq || 0) ? h.sealHash : cur.sealHash,
            auditId: Math.max(h.auditId, cur?.auditId || 0), auditHash: h.auditId >= (cur?.auditId || 0) ? h.auditHash : cur.auditHash, at: new Date().toISOString() });
    } catch { /* disk yozilmasa ham tranzaksiya buzilmaydi */ }
}
const readHead = () => readJson(headFile());
const readAlarm = () => readJson(alarmFile());
function raiseAlarm(r) { try { if (!fs.existsSync(alarmFile())) writeJson(alarmFile(), { at: new Date().toISOString(), table: r.table || '', rowId: r.rowId || '', reason: r.reason || '' }); } catch {} }
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
module.exports = { SEALED_TABLES, track, commitHead, readHead, readAlarm, raiseAlarm, clearAlarm, verifyIntents, token, valid, keyConfigured, signTx, signXid, txMac, schemaMac, validSchemaMac, checkpointMac };
