'use strict';
// Platformadagi faollik (direktor qarori, 16-noy): xodim saytda FAOL bo'lgan daqiqalar.
//  • Faol daqiqa — sayt ochiq va so'nggi 2 daqiqada sichqoncha / klaviatura / teginish bo'lgan; qo'ng'iroq
//    (tel: bosilgandan saytga qaytguncha yoki natija yozilguncha, 30 daqiqagacha) va ochiq dars ekrani ham.
//    Hisoblashni brauzer qiladi (js/faollik.js) — server faqat daqiqalarni qabul qiladi.
//  • Bir daqiqa bir marta: kompyuter va telefon bir vaqtda ochiq bo'lsa ham (PRIMARY KEY user_id+at_min,
//    devices — bitlar: 1 kompyuter, 2 telefon).
//  • Ish vaqti — davomat grafigidan (staff_att_schedules), ustozda — ish soatlari (school_teacher_hours).
//    Grafik bo'lmasa — ish vaqti / tashqari ajratilmaydi.
//  • Harakatlar — mavjud audit jadvallaridan (lid, o'quvchi, to'lov, moliya); yangi yozuv qo'shilmaydi.
//  • Ko'radi: direktor — hammani; ROP — o'z tilidagi sotuv; akademik rahbar — o'z tilidagi akademik bo'lim;
//    xodim — faqat o'zini. Maosh va jarimaga TA'SIR QILMAYDI.
//  • Har kuni 23:00 da @Domworkuz_bot: direktorga hammasi, rahbarga o'z jamoasi.
const t = require('./staffAttendance/time');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS staff_activity_min (
 user_id TEXT NOT NULL, at_min TIMESTAMPTZ NOT NULL, section TEXT NOT NULL DEFAULT '', devices SMALLINT NOT NULL DEFAULT 0,
 PRIMARY KEY (user_id, at_min));
CREATE INDEX IF NOT EXISTS staff_activity_min_at ON staff_activity_min(at_min);
CREATE TABLE IF NOT EXISTS staff_activity_live (
 user_id TEXT PRIMARY KEY, seen_at TIMESTAMPTZ NOT NULL, active_at TIMESTAMPTZ, section TEXT NOT NULL DEFAULT '', device TEXT NOT NULL DEFAULT '');
`;
const NO_TRACK = new Set(['student', 'investor']);
const NOT_LISTED = new Set(['student', 'investor', 'admin', 'boshliq']);
const ONLINE_MS = 2 * 60 * 1000 + 30 * 1000;   // so'nggi faol daqiqa + yuborish oralig'i
const MAX_BACK_MS = 12 * 3600 * 1000;           // internetsiz to'plangan daqiqalar 12 soatgacha qabul qilinadi
const LOW_MINUTES = 120;                        // "kam faol" — ish kunida 2 soatdan kam
const DIGEST_FROM = 23 * 60;                    // bot hisoboti 23:00 dan
const DEPTS = ['Sotuv', 'Akademik', 'Boshqa'];

function error(status, message) { return Object.assign(new Error(message), { status }); }
const safe = async (fn, fb) => { try { return await fn(); } catch (e) { if (e.code !== '42P01' && e.code !== '42703') console.warn('[faollik]', e.message); return fb; } };
const cleanSection = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);
const parse = v => { if (!v) return {}; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return {}; } };
const firstName = s => String(s || '').trim().split(/\s+/)[0] || '';
const shortName = s => { const w = String(s || '').trim().split(/\s+/); return w.length > 1 ? `${w[0]} ${w[1][0]}.` : (w[0] || ''); };

async function initSchema(db) { await db.query(SCHEMA); }

// ── Qabul qilish ─────────────────────────────────────────────────────────────
// body: { device: 'desk'|'phone', section, mins: [[epochMinute, section], ...] }
async function ping(db, user, body = {}, now = new Date()) {
    if (!user?.id || NO_TRACK.has(user.role)) return { ok: true, skipped: true };
    const dev = body.device === 'phone' ? 2 : 1;
    const nowMin = Math.floor(now.getTime() / 60000);
    const lo = Math.floor((now.getTime() - MAX_BACK_MS) / 60000);
    const seen = new Map();
    for (const x of Array.isArray(body.mins) ? body.mins.slice(0, 900) : []) {
        const m = Number(Array.isArray(x) ? x[0] : x);
        if (!Number.isInteger(m) || m < lo || m > nowMin + 1) continue;
        if (!seen.has(m)) seen.set(m, cleanSection(Array.isArray(x) ? x[1] : '') || 'Boshqa');
    }
    const ms = [...seen.keys()], ss = [...seen.values()];
    if (ms.length) {
        await db.query(`INSERT INTO staff_activity_min(user_id,at_min,section,devices)
            SELECT $1, to_timestamp(m * 60), s, $4 FROM unnest($2::bigint[], $3::text[]) AS x(m, s)
            ON CONFLICT (user_id, at_min) DO UPDATE SET devices = staff_activity_min.devices | EXCLUDED.devices`, [String(user.id), ms, ss, dev]);
    }
    const lastActive = ms.length ? Math.max(...ms) : null;
    await db.query(`INSERT INTO staff_activity_live(user_id,seen_at,active_at,section,device) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT (user_id) DO UPDATE SET seen_at=EXCLUDED.seen_at,
          active_at=GREATEST(staff_activity_live.active_at, EXCLUDED.active_at),
          section=CASE WHEN EXCLUDED.active_at IS NOT NULL THEN EXCLUDED.section ELSE staff_activity_live.section END,
          device=CASE WHEN EXCLUDED.active_at IS NOT NULL THEN EXCLUDED.device ELSE staff_activity_live.device END`,
    [String(user.id), now, lastActive != null && lastActive >= nowMin - 3 ? new Date(lastActive * 60000) : null, cleanSection(body.section) || 'Boshqa', dev === 2 ? 'telefon' : 'kompyuter']);
    return { ok: true, saved: ms.length };
}

// ── Xodimlar (users ↔ hr_employees) ─────────────────────────────────────────
function deptOf(u, emp) {
    const rules = require('./staffAttendance/rules');
    const k = u.role === 'akademik' ? 'academic' : rules.staffKind({ userRole: u.role, empRole: emp?.role });
    if (k === 'sales') return ['Sotuv', 'Sotuv', 'sales'];
    if (k === 'rop') return ['Sotuv', 'Sotuv · ROP', 'rop'];
    if (k === 'academic') return ['Akademik', 'Akademik · rahbar', 'academic'];
    if (k === 'assistant') return ['Akademik', 'Akademik · yordamchi', 'assistant'];
    if (k === 'teacher') return ['Akademik', 'Akademik · ustoz', 'teacher'];
    if (k === 'hr') return ['Boshqa', 'Boshqa · HR', 'hr'];
    if (k === 'targetolog') return ['Boshqa', 'Boshqa · targetolog', 'targetolog'];
    return ['Boshqa', 'Boshqa', 'other'];
}
async function people(db) {
    const sa = require('./staffAttendance');
    const users = (await db.query('SELECT id,name,email,role FROM users')).rows.filter(u => !NOT_LISTED.has(u.role));
    const links = await safe(async () => (await db.query('SELECT user_id,manager_id FROM user_sales_manager_links')).rows, []);
    const gone = await sa.goneSql(db, 'he');
    const emps = (await db.query(`SELECT he.id,he.name,he.role,he.lang,LOWER(TRIM(COALESCE(he.login,''))) AS login,${gone} AS gone FROM hr_employees he`)).rows;
    const byId = new Map(emps.map(e => [e.id, e]));
    const byLogin = new Map(); for (const e of emps) if (e.login && !byLogin.has(e.login)) byLogin.set(e.login, e);
    const linkOf = new Map(); for (const l of links) if (!linkOf.has(String(l.user_id))) linkOf.set(String(l.user_id), l.manager_id);
    const out = [];
    for (const u of users) {
        const emp = byId.get(linkOf.get(String(u.id))) || byLogin.get(String(u.email || '').trim().toLowerCase()) || null;
        if (emp?.gone) continue;
        const [dept, label, kind] = deptOf(u, emp);
        out.push({ userId: String(u.id), name: emp?.name || u.name || '', role: u.role, empId: emp?.id || null, dept, label, kind,
            lang: emp ? sa.empLang(emp) : null });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

// Kim ko'radi: { all } | { dept, langs } | null
async function scopeOf(db, user) {
    if (user?.role === 'admin' || user?.role === 'boshliq') return { kind: 'admin', all: true, langs: null };
    if (user?.role === 'rop') return { kind: 'rop', dept: 'Sotuv', langs: await safe(() => require('./ropScope').ropLangsFor(db, user), null) };
    if (user?.role === 'akademik') return { kind: 'academic', dept: 'Akademik', langs: await safe(() => require('./academicHead').langsFor(db, user), null) };
    return null;
}
function inScope(scope, p) {
    if (!scope) return false;
    if (scope.all) return true;
    if (p.dept !== scope.dept) return false;
    if (!scope.langs) return true;
    return !p.lang || p.lang === 'both' || scope.langs.includes(p.lang);
}

// ── Ish vaqti ────────────────────────────────────────────────────────────────
async function hoursMaps(db, ps) {
    const ids = ps.map(p => p.empId).filter(Boolean);
    const sched = new Map(), teach = new Map();
    if (!ids.length) return { sched, teach };
    for (const r of await safe(async () => (await db.query('SELECT employee_id,days FROM staff_att_schedules WHERE employee_id=ANY($1::text[])', [ids])).rows, [])) sched.set(r.employee_id, parse(r.days));
    for (const r of await safe(async () => (await db.query('SELECT teacher_id,weekday,start_min,end_min FROM school_teacher_hours WHERE teacher_id=ANY($1::text[])', [ids])).rows, [])) {
        const k = r.teacher_id + ':' + r.weekday; (teach.get(k) || teach.set(k, []).get(k)).push([Number(r.start_min), Number(r.end_min)]);
    }
    return { sched, teach };
}
// Kun uchun ish oraliqlari [[from,to]] (daqiqa, 0–2880) yoki null (grafik yo'q). [] — dam olish kuni.
function workIntervals(maps, p, date) {
    if (!p.empId) return null;
    const wd = String(t.weekday(date));
    const days = maps.sched.get(p.empId);
    if (days && Object.keys(days).length) {
        const d = days[wd];
        if (!d) return [];
        const s = t.parseClock(d.start), e0 = t.parseClock(d.end);
        if (s == null || e0 == null) return [];
        return [[s, e0 > s ? e0 : e0 + 1440]];
    }
    const th = p.kind === 'teacher' || p.kind === 'assistant' || p.kind === 'academic' ? maps.teach.get(p.empId + ':' + wd) : null;
    if (th) return th.map(x => [x[0], x[1]]);
    if (p.kind === 'teacher' && [...maps.teach.keys()].some(k => k.startsWith(p.empId + ':'))) return [];
    return null;
}
const inside = (iv, m) => !!iv && iv.some(([a, b]) => m >= a && m < b);

// ── Ma'lumot yig'ish ─────────────────────────────────────────────────────────
function periodOf(period, date) {
    if (period === 'week') {
        const wd = t.weekday(date);
        const from = addDays(date, 1 - wd);
        return { period, from, to: addDays(from, 6) };
    }
    if (period === 'month') { const ds = t.monthDates(date.slice(0, 7)); return { period, from: ds[0], to: ds[ds.length - 1] }; }
    return { period: 'day', from: date, to: date };
}
function addDays(date, n) { return new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
function datesBetween(a, b) { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; }

async function loadMinutes(db, userIds, from, to, bucket = 1) {
    if (!userIds.length) return [];
    const a = t.atTashkent(from, 0), b = t.atTashkent(addDays(to, 1), 0);
    const q = bucket > 1
        ? `SELECT user_id, d, (m / ${bucket}) * ${bucket} AS m, section, devices, COUNT(*)::int AS n FROM (
             SELECT user_id, ((at_min AT TIME ZONE 'Asia/Tashkent')::date)::text AS d,
               (EXTRACT(HOUR FROM at_min AT TIME ZONE 'Asia/Tashkent') * 60 + EXTRACT(MINUTE FROM at_min AT TIME ZONE 'Asia/Tashkent'))::int AS m, section, devices
             FROM staff_activity_min WHERE at_min >= $1 AND at_min < $2 AND user_id = ANY($3::text[])) x GROUP BY 1,2,3,4,5`
        : `SELECT user_id, ((at_min AT TIME ZONE 'Asia/Tashkent')::date)::text AS d,
             (EXTRACT(HOUR FROM at_min AT TIME ZONE 'Asia/Tashkent') * 60 + EXTRACT(MINUTE FROM at_min AT TIME ZONE 'Asia/Tashkent'))::int AS m, section, devices, 1 AS n
           FROM staff_activity_min WHERE at_min >= $1 AND at_min < $2 AND user_id = ANY($3::text[]) ORDER BY at_min`;
    return (await db.query(q, [a, b, userIds])).rows;
}
async function loadActionCounts(db, from, to) {
    const a = t.atTashkent(from, 0), b = t.atTashkent(addDays(to, 1), 0);
    const out = new Map();
    const add = (rows) => { for (const r of rows) { const k = r.u + '|' + r.d; out.set(k, (out.get(k) || 0) + Number(r.n)); } };
    for (const tbl of ['lead_audit', 'school_student_audit', 'payment_audit', 'fin_audit']) {
        add(await safe(async () => (await db.query(`SELECT actor_id AS u, ((created_at AT TIME ZONE 'Asia/Tashkent')::date)::text AS d, COUNT(*)::int AS n
            FROM ${tbl} WHERE created_at >= $1 AND created_at < $2 AND COALESCE(actor_id,'') <> '' GROUP BY 1,2`, [a, b])).rows, []));
    }
    return out;
}
async function liveMap(db) {
    const rows = await safe(async () => (await db.query('SELECT user_id,active_at,section,device FROM staff_activity_live WHERE active_at > NOW() - INTERVAL \'10 minutes\'')).rows, []);
    return new Map(rows.map(r => [String(r.user_id), r]));
}
function onlineOf(live, userId, now) {
    const r = live.get(userId);
    return r && r.active_at && now.getTime() - new Date(r.active_at).getTime() <= ONLINE_MS ? { section: r.section || '', device: r.device || '' } : null;
}

// Bitta xodim × davr: daqiqa qatorlaridan hisob.
function summarize(p, rows, maps, dates, counts) {
    const byDay = new Map(dates.map(d => [d, { date: d, minutes: 0, outside: 0, actions: counts?.get(p.userId + '|' + d) || 0 }]));
    const sections = new Map();
    let desk = 0, phone = 0, both = 0, first = null, last = null;
    const ivCache = new Map();
    for (const r of rows) {
        const day = byDay.get(r.d); if (!day) continue;
        const n = Number(r.n) || 1, m = Number(r.m);
        if (!ivCache.has(r.d)) ivCache.set(r.d, workIntervals(maps, p, r.d));
        const iv = ivCache.get(r.d);
        day.minutes += n;
        if (iv && !inside(iv, m)) day.outside += n;
        sections.set(r.section || 'Boshqa', (sections.get(r.section || 'Boshqa') || 0) + n);
        const dv = Number(r.devices) || 1;
        if (dv === 3) both += n; else if (dv === 2) phone += n; else desk += n;
        if (first == null || m < first) first = m;
        if (last == null || m > last) last = m;
    }
    const days = [...byDay.values()];
    const minutes = days.reduce((s, d) => s + d.minutes, 0), outside = days.reduce((s, d) => s + d.outside, 0);
    const hasSchedule = dates.some(d => workIntervals(maps, p, d) !== null);
    const workDays = dates.filter(d => (workIntervals(maps, p, d) || []).length).length;
    return { minutes, outside, inHours: hasSchedule ? minutes - outside : null, actions: days.reduce((s, d) => s + d.actions, 0), hasSchedule, workDays,
        days: days.map(d => ({ date: d.date, minutes: d.minutes, outside: d.outside, actions: d.actions })),
        sections: [...sections.entries()].sort((a, b) => b[1] - a[1]).map(([name, min]) => ({ name, minutes: min })),
        devices: { desk: desk + both, phone: phone + both, both }, first, last };
}

async function dayStatuses(db, ps, date, now) {
    const sa = require('./staffAttendance');
    const ids = ps.map(p => p.empId).filter(Boolean);
    const out = new Map();
    if (!ids.length) return out;
    await safe(async () => {
        const settings = await sa.getSettings(db);
        const ctx = await sa.loadContext(db, ids, date, date);
        for (const id of ids) {
            const d = sa.statusFor(ctx, id, date, settings, now, { live: true });
            out.set(id, { status: d.status, earlyMinutes: d.earlyMinutes || 0, outClock: d.outClock || '' });
        }
    }, null);
    return out;
}

// ── Jamoa sahifasi ───────────────────────────────────────────────────────────
async function team(db, user, query = {}, now = new Date()) {
    const scope = await scopeOf(db, user);
    if (!scope) throw error(403, 'Faollik bo‘limi faqat direktor, ROP va akademik rahbar uchun');
    return overview(db, scope, query, now);
}
async function overview(db, scope, query = {}, now = new Date()) {
    const today = t.tashkentDate(now);
    let date = t.isDate(query.date) ? query.date : today;
    if (date > today) date = today;
    const per = periodOf(['day', 'week', 'month'].includes(query.period) ? query.period : 'day', date);
    const to = per.to > today ? today : per.to;
    const dates = datesBetween(per.from, to);
    const all = (await people(db)).filter(p => inScope(scope, p));
    const maps = await hoursMaps(db, all);
    const rows = await loadMinutes(db, all.map(p => p.userId), per.from, to, per.period === 'day' ? 1 : 5);
    const counts = await loadActionCounts(db, per.from, to);
    const live = await liveMap(db);
    const st = per.period === 'day' ? await dayStatuses(db, all, date, now) : new Map();
    const byUser = new Map(); for (const r of rows) (byUser.get(String(r.user_id)) || byUser.set(String(r.user_id), []).get(String(r.user_id))).push(r);
    const list = all.map(p => {
        const s = summarize(p, byUser.get(p.userId) || [], maps, dates, counts);
        const ds = p.empId ? st.get(p.empId) : null;
        return { userId: p.userId, name: p.name, dept: p.dept, label: p.label, kind: p.kind, lang: p.lang,
            minutes: s.minutes, outside: s.outside, inHours: s.inHours, actions: s.actions, hasSchedule: s.hasSchedule, workDays: s.workDays,
            first: s.first, last: s.last, days: per.period === 'day' ? undefined : s.days.map(d => d.minutes),
            online: onlineOf(live, p.userId, now), dayStatus: ds?.status || null };
    });
    list.sort((a, b) => b.minutes - a.minutes || b.actions - a.actions || a.name.localeCompare(b.name));
    const rank = {}; for (const r of list) { rank[r.dept] = (rank[r.dept] || 0) + 1; r.deptRank = r.minutes ? rank[r.dept] : null; }
    const totals = { staff: list.length, online: list.filter(r => r.online).length, minutes: list.reduce((s, r) => s + r.minutes, 0),
        outside: list.reduce((s, r) => s + r.outside, 0), outsideCount: list.filter(r => r.outside > 0).length, actions: list.reduce((s, r) => s + r.actions, 0),
        depts: Object.fromEntries(DEPTS.map(d => [d, list.filter(r => r.dept === d).length])) };
    const workDays = dates.filter(d => t.weekday(d) !== 7).length;
    return { period: per.period, date, from: per.from, to, today, now: now.toISOString(), nowClock: t.tashkentClock(now), dates,
        scope: { kind: scope.kind, dept: scope.dept || null, langs: scope.langs || null }, totals, workDays, rows: list };
}

// ── Bitta xodim tafsiloti ────────────────────────────────────────────────────
function segmentsOf(rows, iv) {
    const segs = [];
    for (const r of rows) {
        const m = Number(r.m), out = iv ? !inside(iv, m) : false, last = segs[segs.length - 1];
        if (last && m <= last[1] + 1 && last[2] === out) last[1] = m + 1;
        else segs.push([m, m + 1, out]);
    }
    return segs;
}
function leadLabel(r) {
    const snap = parse(r.snapshot), after = r.action === 'created' ? (snap.after || snap) : (snap.after || {}), before = snap.before || {};
    const who = firstName(after.name);
    if (r.action === 'created') return [['Lid yaratildi', `Lid yaratildi · ${who}`]];
    if (r.action !== 'updated') return [['Lid: boshqa', `Lid · ${r.action} · ${who}`]];
    const out = [];
    const nb = (before.comments || []).length;
    for (const c of (after.comments || []).slice(nb)) {
        if (c?.type === 'call-attempt') out.push(['Qo‘ng‘iroq', `Qo‘ng‘iroq · ${who}`]);
        else if (c?.type !== 'contact-fail') out.push(['Izoh yozildi', `Izoh · ${who}`]);
    }
    if (before.status !== after.status && after.status) out.push(after.status === 'sinov-darsida' ? ['Sinov darsi belgilandi', `Lid → «Sinov darsi» · ${who}`] : ['Lid holati o‘zgardi', `Lid holati o‘zgardi · ${who}`]);
    return out.length ? out : [['Lid tahrirlandi', `Lid tahrirlandi · ${who}`]];
}
async function actionsOf(db, userId, from, to) {
    const a = t.atTashkent(from, 0), b = t.atTashkent(addDays(to, 1), 0);
    const kinds = new Map(), last = [];
    const push = (label, text, at) => { kinds.set(label, (kinds.get(label) || 0) + 1); last.push({ at: new Date(at).toISOString(), clock: t.tashkentClock(at), date: t.tashkentDate(at), text }); };
    for (const r of await safe(async () => (await db.query('SELECT action,snapshot,created_at FROM lead_audit WHERE actor_id=$1 AND created_at>=$2 AND created_at<$3 ORDER BY created_at DESC LIMIT 1500', [userId, a, b])).rows, [])) {
        for (const [label, text] of leadLabel(r)) push(label, text, r.created_at);
    }
    for (const r of await safe(async () => (await db.query('SELECT action,created_at FROM school_student_audit WHERE actor_id=$1 AND created_at>=$2 AND created_at<$3 ORDER BY created_at DESC LIMIT 500', [userId, a, b])).rows, [])) push('O‘quvchi yozuvi', `O‘quvchi · ${r.action}`, r.created_at);
    for (const tbl of ['payment_audit', 'fin_audit']) {
        for (const r of await safe(async () => (await db.query(`SELECT action,created_at FROM ${tbl} WHERE actor_id=$1 AND created_at>=$2 AND created_at<$3 ORDER BY created_at DESC LIMIT 300`, [userId, a, b])).rows, [])) push('To‘lov / moliya', `To‘lov / moliya · ${r.action}`, r.created_at);
    }
    last.sort((x, y) => y.at.localeCompare(x.at));
    return { total: last.length, kinds: [...kinds.entries()].sort((x, y) => y[1] - x[1]).map(([name, n]) => ({ name, n })), last: last.slice(0, 30) };
}
function scheduleText(maps, p, date) {
    const iv = workIntervals(maps, p, date);
    if (iv === null) return null;
    if (!iv.length) return 'dam olish kuni';
    return iv.map(([a, b]) => `${t.clock(a)}–${t.clock(b)}`).join(', ');
}
async function detail(db, p, query = {}, now = new Date()) {
    const today = t.tashkentDate(now);
    let date = t.isDate(query.date) ? query.date : today;
    if (date > today) date = today;
    const per = periodOf(['day', 'week', 'month'].includes(query.period) ? query.period : 'day', date);
    const to = per.to > today ? today : per.to;
    const dates = datesBetween(per.from, to);
    const maps = await hoursMaps(db, [p]);
    const rows = await loadMinutes(db, [p.userId], per.from, to, 1);
    const counts = await loadActionCounts(db, per.from, to);
    const s = summarize(p, rows, maps, dates, counts);
    const acts = await actionsOf(db, p.userId, per.from, to);
    const live = await liveMap(db);
    return { period: per.period, date, from: per.from, to, today, nowClock: t.tashkentClock(now),
        person: { userId: p.userId, name: p.name, label: p.label, dept: p.dept, schedule: scheduleText(maps, p, date) },
        online: onlineOf(live, p.userId, now), ...s, actions: s.actions, actionKinds: acts.kinds, lastActions: acts.last,
        segments: per.period === 'day' ? segmentsOf(rows, workIntervals(maps, p, date)) : [],
        work: per.period === 'day' ? workIntervals(maps, p, date) : null };
}
async function person(db, user, userId, query = {}, now = new Date()) {
    const scope = await scopeOf(db, user);
    if (!scope) throw error(403, 'Faollik bo‘limi faqat direktor, ROP va akademik rahbar uchun');
    const p = (await people(db)).find(x => x.userId === String(userId));
    if (!p || !inScope(scope, p)) throw error(404, 'Xodim topilmadi yoki sizning jamoangizda emas');
    return detail(db, p, query, now);
}
async function me(db, user, query = {}, now = new Date()) {
    if (!user?.id || NO_TRACK.has(user.role)) throw error(403, 'Faqat xodimlar uchun');
    const p = (await people(db)).find(x => x.userId === String(user.id))
        || { userId: String(user.id), name: user.name || '', role: user.role, empId: null, dept: 'Boshqa', label: 'Boshqa', kind: 'other', lang: null };
    return { ...(await detail(db, p, query, now)), canTeam: !!(await scopeOf(db, user)) };
}

// ── Jonli ofis ───────────────────────────────────────────────────────────────
async function officeSummary(db, now = new Date()) {
    const date = t.tashkentDate(now);
    const ps = await people(db);
    const live = await liveMap(db);
    const mins = new Map((await safe(async () => (await db.query('SELECT user_id, COUNT(*)::int AS n FROM staff_activity_min WHERE at_min >= $1 GROUP BY 1', [t.atTashkent(date, 0)])).rows, []))
        .map(r => [String(r.user_id), r.n]));
    const byEmp = {};
    let online = 0;
    const rows = ps.map(p => ({ p, minutes: mins.get(p.userId) || 0, on: onlineOf(live, p.userId, now) }));
    for (const r of rows) {
        if (r.on) online++;
        if (r.p.empId) byEmp[r.p.empId] = { online: !!r.on, section: r.on?.section || '', minutes: r.minutes };
    }
    const top = dept => rows.filter(r => r.p.dept === dept && r.minutes > 0).sort((a, b) => b.minutes - a.minutes).map(r => ({ name: shortName(r.p.name), minutes: r.minutes }));
    return { online, staff: ps.length, salesTop: top('Sotuv').slice(0, 5), academicTop: top('Akademik').slice(0, 1), byEmp };
}

// ── Bot: kun yakuni (23:00) ──────────────────────────────────────────────────
const dur = m => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), r = m % 60; return h ? `${h} s ${String(r).padStart(2, '0')} daq` : `${r} daq`; };
const esc = v => String(v ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const WD = ['', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
function digestText(ov, title) {
    const r = ov.rows, tt = ov.totals;
    const d = ov.date.split('-').reverse().slice(0, 2).join('.');
    const lines = [`📊 <b>${esc(title)} — ${d} (${WD[t.weekday(ov.date)]})</b>`, '',
        `👥 Jamoa (${tt.staff} kishi): <b>${dur(tt.minutes)}</b> · harakatlar: <b>${tt.actions}</b>`,
        `🌙 Ish vaqtidan tashqari: <b>${dur(tt.outside)}</b> (${tt.outsideCount} kishi)`];
    const act = r.filter(x => x.minutes > 0);
    if (act.length) {
        lines.push('', '🏆 <b>Eng faol</b>');
        act.slice(0, 5).forEach((x, i) => lines.push(`${['🥇', '🥈', '🥉', '4.', '5.'][i]} ${esc(shortName(x.name))} <i>(${esc(x.dept.toLowerCase())})</i> — ${dur(x.minutes)} · ${x.actions} harakat`));
    }
    const after = r.filter(x => x.outside > 0).sort((a, b) => b.outside - a.outside);
    if (after.length) {
        lines.push('', '🌙 <b>Ish vaqtidan tashqari ham ishladi</b>' + (after.length > 3 ? ' (eng ko‘p)' : ''));
        after.slice(0, 3).forEach(x => lines.push(`${esc(shortName(x.name))} — ${dur(x.outside)}`));
        if (after.length > 3) lines.push(`… yana ${after.length - 3} kishi — saytda`);
    }
    const low = r.filter(x => x.hasSchedule && x.minutes < LOW_MINUTES && !['off', 'leave', 'excused', 'upcoming', 'before'].includes(x.dayStatus || '') && x.workDays > 0);
    if (low.length) {
        lines.push('', `⚠️ <b>Kam faol</b> (ish kuni, &lt; ${LOW_MINUTES / 60} soat; ta’til va ruxsatli ketish hisobga olinmaydi)`);
        low.slice(0, 6).forEach(x => lines.push(`${esc(shortName(x.name))} — ${x.minutes ? dur(x.minutes) : 'saytga kirmadi'}${x.earlyText ? ' · ' + esc(x.earlyText) : ''}`));
    }
    return lines.join('\n');
}
async function digestTick(db, now = new Date()) {
    if (process.env.DOMWORK_BOT_ENABLED !== 'true' || process.env.STAFF_ACTIVITY_DIGEST === 'off') return 0;
    if (t.tashkentMinutes(now) < DIGEST_FROM) return 0;
    const ok = (await db.query("SELECT to_regclass('public.domwork_bot_links') AS a, to_regclass('public.domwork_bot_outbox') AS b")).rows[0];
    if (!ok?.a || !ok?.b) return 0;
    const date = t.tashkentDate(now);
    const rec = (await db.query(`SELECT l.telegram_id,u.id,u.role,u.name,u.email FROM domwork_bot_links l JOIN users u ON u.id=l.account_id
        WHERE l.account_kind='user' AND NOT l.paused AND u.role = ANY($1::text[])`, [['admin', 'boshliq', 'rop', 'akademik']])).rows;
    if (!rec.length) return 0;
    const done = new Set((await db.query('SELECT unique_key FROM domwork_bot_outbox WHERE unique_key LIKE $1', [`act:day:${date}:%`])).rows.map(r => r.unique_key));
    const store = require('./domworkBot/store');
    const statusFix = async ov => {
        const ps = await people(db);
        const st = await dayStatuses(db, ps, date, now);
        for (const r of ov.rows) { const p = ps.find(x => x.userId === r.userId); const s = p?.empId ? st.get(p.empId) : null;
            if (s?.earlyMinutes > 0 && s.outClock) r.earlyText = `${s.outClock} da ruxsatsiz ketdi`; }
    };
    const cache = new Map();
    let sent = 0;
    for (const r of rec) {
        const key = `act:day:${date}:${r.id}:${r.telegram_id}`.slice(0, 200);
        if (done.has(key)) continue;
        const scope = await scopeOf(db, r);
        if (!scope) continue;
        const ck = JSON.stringify(scope);
        if (!cache.has(ck)) { const ov = await overview(db, scope, { period: 'day', date }, now); await statusFix(ov); cache.set(ck, ov); }
        const ov = cache.get(ck);
        if (!ov.rows.length || !ov.totals.minutes) continue;
        const title = scope.all ? 'Platformadagi faollik' : `Jamoa faolligi${scope.langs?.length === 1 ? (scope.langs[0] === 'russian' ? ' · Rus tili' : ' · Ingliz tili') : ''}`;
        try {
            await store.enqueue(db, { key, targetId: r.telegram_id, payload: { chat_id: r.telegram_id, text: digestText(ov, title), parse_mode: 'HTML', disable_web_page_preview: true,
                reply_markup: { inline_keyboard: [[{ text: '📈 Faollikni ochish', url: 'https://myhomework.uz/?faollik=1' }]] } } });
            sent++;
        } catch (e) { console.error('[faollik] bot xabari:', e.message); }
    }
    return sent;
}
async function cleanup(db) {
    await safe(() => db.query("DELETE FROM staff_activity_min WHERE at_min < NOW() - INTERVAL '400 days'"), null);
}
async function tick(db, now = new Date()) {
    const n = await digestTick(db, now);
    if (t.tashkentMinutes(now) < 10) await cleanup(db);
    return n;
}

module.exports = { initSchema, ping, team, person, me, overview, officeSummary, digestText, digestTick, tick, people, scopeOf, inScope, periodOf, summarize, workIntervals, segmentsOf };
