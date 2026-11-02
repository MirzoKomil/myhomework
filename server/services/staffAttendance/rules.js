'use strict';
// Davomat qoidalari — sof funksiyalar (bazasiz, test qilish oson).
const t = require('./time');

const DEFAULT_SETTINGS = Object.freeze({
    office: { name: 'Mavr School, Andijon', lat: 40.789035, lng: 72.346787, radius: 150 },
    graceMinutes: 10,          // kechikishga imtiyoz
    absentAfterMinutes: 120,   // ish boshlanib shuncha o'tib belgilamasa — "kelmadi"
    earlyLeaveGraceMinutes: 10,
    maxAccuracyMeters: 200,    // GPS aniqligi bundan yomon bo'lsa — rad
    photoRetentionDays: 90,
    notifyTelegram: true,
    officeIps: [],             // ofis internetining tashqi IP manzillari (kompyuterdan belgilash uchun)
    checkTurnDirection: true,  // bosh aynan ko'rsatilgan tomonga burilishi shart
});

function normalizeIps(raw) {
    const list = Array.isArray(raw) ? raw : String(raw || '').split(/[\s,;]+/);
    const v4 = v => /^(\d{1,3})(\.\d{1,3}){3}(\/([0-9]|[12]\d|3[0-2]))?$/.test(v) && v.split('/')[0].split('.').every(n => Number(n) <= 255);
    const v6 = v => /^[0-9a-f:]+$/i.test(v) && v.includes(':') && v.length <= 39 && (v.match(/::/g) || []).length <= 1;
    const ok = v => v4(v) || v6(v);
    return [...new Set(list.map(v => String(v).trim()).filter(Boolean))].filter(ok).slice(0, 20);
}

const DAY_KEYS = ['1', '2', '3', '4', '5', '6', '7'];

function normalizeSettings(raw) {
    const s = { ...DEFAULT_SETTINGS, ...(raw || {}) };
    const o = { ...DEFAULT_SETTINGS.office, ...((raw && raw.office) || {}) };
    const num = (v, min, max, def) => (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max ? Number(v) : def);
    return {
        office: {
            name: String(o.name || '').slice(0, 120),
            address: String(o.address || '').slice(0, 200),
            lat: num(o.lat, -90, 90, DEFAULT_SETTINGS.office.lat),
            lng: num(o.lng, -180, 180, DEFAULT_SETTINGS.office.lng),
            radius: Math.round(num(o.radius, 30, 2000, DEFAULT_SETTINGS.office.radius)),
        },
        graceMinutes: Math.round(num(s.graceMinutes, 0, 120, DEFAULT_SETTINGS.graceMinutes)),
        absentAfterMinutes: Math.round(num(s.absentAfterMinutes, 15, 720, DEFAULT_SETTINGS.absentAfterMinutes)),
        earlyLeaveGraceMinutes: Math.round(num(s.earlyLeaveGraceMinutes, 0, 120, DEFAULT_SETTINGS.earlyLeaveGraceMinutes)),
        maxAccuracyMeters: Math.round(num(s.maxAccuracyMeters, 20, 2000, DEFAULT_SETTINGS.maxAccuracyMeters)),
        photoRetentionDays: Math.round(num(s.photoRetentionDays, 7, 365, DEFAULT_SETTINGS.photoRetentionDays)),
        notifyTelegram: s.notifyTelegram !== false,
        officeIps: normalizeIps(s.officeIps),
        checkTurnDirection: s.checkTurnDirection !== false,
    };
}

// Grafik: { "1": {start:"09:00", end:"18:00"}, ... } — bo'sh kun = dam olish.
function normalizeDays(raw) {
    const out = {};
    for (const key of DAY_KEYS) {
        const d = raw && raw[key];
        if (!d) continue;
        const start = t.parseClock(d.start), end = t.parseClock(d.end);
        if (start == null || end == null) throw Object.assign(new Error(`${key}-kun vaqti noto'g'ri (SS:DD)`), { status: 400 });
        if (end <= start) throw Object.assign(new Error(`${key}-kun: tugash vaqti boshlanishdan keyin bo'lishi kerak`), { status: 400 });
        out[key] = { start: t.clock(start), end: t.clock(end) };
    }
    return out;
}

function haversineMeters(a, b) {
    const R = 6371000, rad = x => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

// GPS tekshiruvi: { ok, distance, reason }
function checkLocation(settings, loc) {
    const lat = Number(loc?.lat), lng = Number(loc?.lng), accuracy = Number(loc?.accuracy);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return { ok: false, reason: 'no_location' };
    }
    const acc = Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 9999;
    const distance = Math.round(haversineMeters(settings.office, { lat, lng }));
    if (acc > settings.maxAccuracyMeters) return { ok: false, reason: 'low_accuracy', distance, accuracy: Math.round(acc) };
    if (distance > settings.office.radius + Math.min(acc, 50)) return { ok: false, reason: 'outside', distance, accuracy: Math.round(acc) };
    return { ok: true, distance, accuracy: Math.round(acc) };
}

// Tiriklik: ikkinchi kadrda bosh sezilarli burilgan va yuz o'lchami mos.
// direction: 'left' | 'right' — xodimning o'ziga nisbatan. Kamera ko'rgan (ko'zgulanmagan) rasmda odam o'z
// chap tomoniga burilsa burun uchi rasmning o'ng tomoniga siljiydi → yaw ortadi.
const MIN_YAW_DELTA = 0.12;
function checkLiveness(front, turned, direction = null) {
    if (!front || front.faces !== 1) return { ok: false, reason: front?.faces > 1 ? 'many_faces' : 'no_face' };
    if (!turned || turned.faces !== 1) return { ok: false, reason: turned?.faces > 1 ? 'many_faces' : 'no_face_turned' };
    const ratio = turned.box.width / front.box.width;
    if (!(ratio > 0.6 && ratio < 1.6)) return { ok: false, reason: 'liveness' };
    const signed = turned.yaw - front.yaw;
    const delta = Math.abs(signed);
    if (!(delta >= MIN_YAW_DELTA)) return { ok: false, reason: 'liveness', yawDelta: delta };
    if (direction && (direction === 'left' ? signed < 0 : signed > 0)) return { ok: false, reason: 'wrong_direction', yawDelta: delta };
    return { ok: true, yawDelta: delta };
}

const REASONS = {
    no_location: 'Lokatsiya olinmadi. Telefon sozlamalarida joylashuvga ruxsat bering.',
    low_accuracy: 'GPS aniqligi past. Derazaga yaqinroq turib qayta urinib ko‘ring.',
    low_accuracy_phone: 'Joylashuv aniq emas. Kompyuterda GPS bo‘lmaydi — davomatni telefoningizdan belgilang.',
    replay: 'Bu rasm avval yuborilgan rasmga juda o‘xshaydi. Biroz qimirlab, yangidan urinib ko‘ring.',
    wrong_direction: 'Boshingizni ko‘rsatilgan tomonga buring.',
    outside: 'Siz ofis hududidan tashqaridasiz.',
    not_tracked_role: 'Sizning lavozimingiz uchun davomat belgilanmaydi.',
    no_face: 'Rasmda yuz topilmadi. Yuzingiz ramka ichida va yorug‘ joyda bo‘lsin.',
    no_face_turned: 'Ikkinchi rasmda yuz topilmadi. Boshingizni sekin buring, yuz ramkadan chiqmasin.',
    many_faces: 'Kadrda faqat siz bo‘lishingiz kerak.',
    liveness: 'Bosh burilishi aniqlanmadi. Ko‘rsatmaga qarab boshingizni yonga buring.',
    mismatch: 'Yuz namunangizga mos kelmadi.',
    no_face_profile: 'Yuz namunangiz hali tasdiqlanmagan. HR bilan bog‘laning.',
};

function reasonText(code) { return REASONS[code] || 'Belgilab bo‘lmadi. Qayta urinib ko‘ring.'; }

// Bir xodimning bir kunlik holati.
// input: { date, today, nowMinutes, day:{start,end}|null, settings, events:[{kind,occurred_at}] (faqat ok),
//          leave:boolean, override:{status,note}|null }
function dayStatus(input) {
    const { date, today, nowMinutes, day, settings, leave, override } = input;
    const events = (input.events || []).slice().sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
    const ins = events.filter(e => e.kind === 'in'), outs = events.filter(e => e.kind === 'out');
    const firstIn = ins[0] || null;
    const lastOut = outs.length ? outs[outs.length - 1] : null;
    const inMin = firstIn ? t.tashkentMinutes(firstIn.occurred_at) : null;
    const outMin = lastOut ? t.tashkentMinutes(lastOut.occurred_at) : null;
    const base = {
        date, scheduled: !!day, start: day?.start || '', end: day?.end || '',
        inAt: firstIn ? firstIn.occurred_at : null, outAt: lastOut ? lastOut.occurred_at : null,
        inClock: firstIn ? t.clock(inMin) : '', outClock: lastOut ? t.clock(outMin) : '',
        lateMinutes: 0, earlyMinutes: 0, workedMinutes: 0,
    };
    if (firstIn && lastOut && outMin > inMin) base.workedMinutes = outMin - inMin;

    if (override) return { ...base, status: override.status, note: override.note || '', overridden: true };
    if (leave) return { ...base, status: 'leave' };
    if (!day) return { ...base, status: firstIn ? 'extra' : 'off' };
    // Hisob faqat grafik yoqilgan VA yuz namunasi tasdiqlangan kundan boshlanadi; o'sha birinchi kuni
    // belgilamagan bo'lsa ham "kelmadi" deb hisoblanmaydi (xodim tizimdan endi xabar topgan bo'lishi mumkin).
    if ('countFrom' in input && !firstIn) {
        if (input.countFrom === null) return { ...base, status: 'not_ready' };
        if (date <= input.countFrom) return { ...base, status: 'before' };
    }

    const start = t.parseClock(day.start), end = t.parseClock(day.end);
    const isFuture = date > today;
    const isToday = date === today;
    if (isFuture) return { ...base, status: 'upcoming' };

    if (!firstIn) {
        if (isToday && nowMinutes < start + settings.absentAfterMinutes) {
            return { ...base, status: nowMinutes < start ? 'upcoming' : 'waiting' };
        }
        return { ...base, status: 'absent' };
    }
    const late = Math.max(0, inMin - start);
    base.lateMinutes = late > settings.graceMinutes ? late : 0;
    base.rawLateMinutes = late; // jarimalar o'z imtiyozi bilan hisoblaydi (server/services/fines)
    let status = base.lateMinutes ? 'late' : 'on_time';
    if (lastOut && outMin > inMin) {
        const early = Math.max(0, end - outMin);
        base.earlyMinutes = early > settings.earlyLeaveGraceMinutes ? early : 0;
    } else if (!isToday || nowMinutes > end + 60) {
        base.noCheckout = true;
    }
    return { ...base, status };
}

const STATUS_LABELS = {
    on_time: 'Vaqtida', late: 'Kechikdi', absent: 'Kelmadi', waiting: 'Kutilmoqda', upcoming: 'Hali erta',
    off: 'Dam olish', before: 'Hisob boshlanmagan', not_ready: 'Yuz namunasi tasdiqlanmagan', extra: 'Dam olish kuni keldi', leave: 'Ta’tilda', excused: 'Sababli', present: 'Keldi (qo‘lda)',
    pending: 'Kutilmoqda',
};

// ── Kim kuzatiladi va kim tasdiqlaydi (DavRules v2) ──────────────────────────
// Kuzatiladi: sotuv menejeri, ROP, HR, akademik rahbar, yordamchi ustoz. Yo'q: asosiy ustoz, targetolog, admin.
const MAIN_TEACHER_ROLES = new Set(['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi', 'asosiy']);
const ACADEMIC_HEAD_ROLE = 'head-of-teachers';
const SALES_EMP_ROLES = new Set(['sotuv-menejeri', 'sotuv_menejeri', 'sotuv menejeri', 'sales_manager']);

// { userRole, empRole } → 'sales' | 'rop' | 'hr' | 'academic' | 'assistant' | 'admin' | 'teacher' | 'targetolog' | 'other'
function staffKind({ userRole, empRole } = {}) {
    if (userRole === 'admin' || userRole === 'boshliq') return 'admin';
    if (userRole === 'rop') return 'rop';
    if (userRole === 'hr') return 'hr';
    if (userRole === 'targetolog') return 'targetolog';
    if (userRole === 'sales_manager' || SALES_EMP_ROLES.has(empRole)) return 'sales';
    if (empRole === 'rop') return 'rop';
    if (empRole === 'hr') return 'hr';
    if (empRole === 'targetolog') return 'targetolog';
    if (empRole === 'yordamchi') return 'assistant';
    if (empRole === ACADEMIC_HEAD_ROLE) return 'academic';
    if (MAIN_TEACHER_ROLES.has(empRole) || userRole === 'teacher') return 'teacher';
    return 'other';
}
// Rol bo'yicha davomat umuman mumkinmi (xodimning "Davomat kuzatiladi" belgisi alohida tekshiriladi).
function roleTracked(who) { return !['admin', 'teacher', 'targetolog'].includes(staffKind(who)); }

// Javob so'rovi kimga boradi: sotuv → ROP, yordamchi → akademik rahbar, qolganlar (ROP, HR, akademik…) → admin.
function approverKind(who) {
    const k = staffKind(who);
    return k === 'sales' ? 'rop' : k === 'assistant' ? 'academic' : 'admin';
}
// Tasdiqlovchi doirasi: { kind, langs } — langs null bo'lsa til cheklovi yo'q.
function approverScope({ userRole, empRole, langs = null } = {}) {
    const k = staffKind({ userRole, empRole });
    if (k === 'admin') return { kind: 'admin', langs: null };
    if (k === 'rop') return { kind: 'rop', langs };
    if (k === 'academic') return { kind: 'academic', langs };
    return null;
}
// Admin (direktor) hamma so'rovni hal qila oladi; ROP/akademik — faqat o'ziga yo'naltirilgan va o'z tilidagi.
function canDecide(scope, request) {
    if (!scope || !request) return false;
    if (scope.kind === 'admin') return true;
    if (request.approver_kind !== scope.kind) return false;
    return !scope.langs || !request.lang || scope.langs.includes(request.lang);
}
// So'rov bir tilga tegishli; tasdiqlovchi tillari ('english' | 'russian' | 'both') shu tilni qamrasa — mos.
function langCovers(approverLang, lang) {
    if (!lang) return true;
    const l = String(approverLang || '').toLowerCase();
    return l === 'both' || l === lang;
}

const REQUEST_TYPES = { late: 'Kech qolaman', absent: 'Kelmayman', early_leave: 'Erta ketaman', outside: 'Ofisda emasman' };

// ctx (ixtiyoriy): { day: {start,end}|null (o'sha kun grafigi), inOk, outOk (bugun belgilangan), maxDays }
const MAX_REQUEST_DAYS = 60;
function normalizeRequest(body, { today, day, inOk = false, outOk = false, maxDays = MAX_REQUEST_DAYS } = {}) {
    const type = String(body?.type || '');
    if (!['late', 'absent', 'early_leave'].includes(type)) throw Object.assign(new Error('So‘rov turini tanlang'), { status: 400 });
    const date = String(body?.date || '');
    if (!t.isDate(date)) throw Object.assign(new Error('Kunni tanlang'), { status: 400 });
    if (date < today) throw Object.assign(new Error('O‘tgan kun uchun so‘rov yuborib bo‘lmaydi'), { status: 400 });
    const ahead = Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
    if (ahead > maxDays) throw Object.assign(new Error(`So‘rovni ko‘pi bilan ${maxDays} kun oldindan yuborish mumkin`), { status: 400 });
    if (day === null) throw Object.assign(new Error('Bu kun grafigingizda dam olish kuni — so‘rov kerak emas'), { status: 400 });
    if (date === today && type === 'late' && inOk) throw Object.assign(new Error('Bugun kelish allaqachon belgilangan'), { status: 409 });
    if (date === today && type === 'early_leave' && outOk) throw Object.assign(new Error('Bugun ketish allaqachon belgilangan'), { status: 409 });
    if (date === today && type === 'absent' && inOk) throw Object.assign(new Error('Bugun kelish allaqachon belgilangan'), { status: 409 });
    let time = '';
    if (type !== 'absent') {
        const m = t.parseClock(body?.time);
        if (m == null) throw Object.assign(new Error(type === 'late' ? 'Qachon kelishingizni yozing' : 'Qachon ketishingizni yozing'), { status: 400 });
        time = t.clock(m);
        if (day) {
            const s = t.parseClock(day.start), e = t.parseClock(day.end);
            if (type === 'late' && !(m > s && m < e)) throw Object.assign(new Error(`Kelish vaqti ish vaqti ichida bo‘lsin (${day.start} dan keyin, ${day.end} dan oldin)`), { status: 400 });
            if (type === 'early_leave' && !(m > s && m < e)) throw Object.assign(new Error(`Ketish vaqti ish vaqti ichida bo‘lsin (${day.start} dan keyin, ${day.end} dan oldin)`), { status: 400 });
        }
    }
    const reason = String(body?.reason || '').trim().slice(0, 80);
    if (!reason) throw Object.assign(new Error('Sababni tanlang'), { status: 400 });
    return { type, date, time, reason, comment: String(body?.comment || '').trim().slice(0, 500) };
}

// Kun holatiga javob so'rovlari ta'siri (HR tuzatishidan keyin emas — undan oldin qo'llanadi).
//  • kutilayotgan so'rov — "Kutilmoqda", kechikish/kelmaslik yozilmaydi;
//  • tasdiqlangan — "Sababli" (kech qolaman: ruxsat vaqtigacha kelsa; erta ketaman: ruxsat vaqtidan keyin ketsa);
//  • rad etilgan — odatdagi qoida.
function applyRequests(base, requests, settings, clockNow = null, { officeIn = false } = {}) {
    // Ofisga kelib odatdagidek belgilagan bo'lsa — kutilayotgan "Ofisda emasman" kunni yashirmaydi.
    const list = (requests || []).filter(r => (r.state === 'pending' || r.state === 'approved') && !(officeIn && r.type === 'outside' && r.state === 'pending'));
    if (!list.length || !base.scheduled) return base;
    const out = { ...base };
    const inMin = t.parseClock(out.inClock), outMin = t.parseClock(out.outClock);
    const approved = type => list.find(r => r.state === 'approved' && r.type === type);
    const pending = list.some(r => r.state === 'pending' && r.type !== 'early_leave');
    if (list.some(r => r.state === 'pending' && r.type === 'outside')) return { ...out, status: 'pending', lateMinutes: 0, rawLateMinutes: 0 };
    const whole = approved('absent') || approved('outside');
    if (whole) return { ...out, status: 'excused', lateMinutes: 0, rawLateMinutes: 0, earlyMinutes: 0, note: whole.reason || '', request: whole.id };
    let excused = null;
    const late = approved('late');
    // Ruxsat vaqti hali kelmagan (yoki imtiyozi o'tmagan) — "kelmadi" emas, kutilmoqda.
    if (late && inMin == null && clockNow && clockNow.isToday && clockNow.nowMinutes < t.parseClock(late.time) + settings.absentAfterMinutes
        && ['absent', 'waiting'].includes(out.status)) return { ...out, status: 'waiting', lateMinutes: 0 };
    if (late && ['late', 'on_time'].includes(out.status) && inMin != null) {
        const over = inMin - t.parseClock(late.time);
        // Jarimalar xom kechikishni o'qiydi — ruxsat vaqtidan hisoblanadi.
        out.rawLateMinutes = Math.max(0, over);
        if (over > settings.graceMinutes) { out.lateMinutes = over; out.status = 'late'; }
        else if (out.status === 'late') { out.lateMinutes = 0; out.rawLateMinutes = 0; out.status = 'excused'; excused = late; }
    }
    const early = approved('early_leave');
    if (early && out.earlyMinutes && outMin != null) {
        const before = t.parseClock(early.time) - outMin;
        out.earlyMinutes = before > settings.earlyLeaveGraceMinutes ? before : 0;
        if (!out.earlyMinutes && !excused) excused = early;
        if (!out.earlyMinutes && out.status === 'on_time') out.status = 'excused';
    }
    if (pending && ['late', 'absent', 'waiting'].includes(out.status)) { out.status = 'pending'; out.lateMinutes = 0; out.rawLateMinutes = 0; }
    if (excused) { out.note = excused.reason || ''; out.request = excused.id; }
    return out;
}

// Ilova holati (qulf): ish vaqtidan tashqari ilova erkin, ish boshlanganda belgilaguncha qulf.
// input: { nowMinutes, day:{start,end}|null, inClock, outClock, requests (bugungi, pending/approved) }
// → { phase, start, end, unlockAt, lateMinutes }
//   phase: off | before | late_ok | lock | working | leave | done | excused | outside | missed
function phase({ nowMinutes, day, inClock, outClock, requests = [] }) {
    const live = (requests || []).filter(r => r.state === 'pending' || r.state === 'approved');
    const start = day ? t.parseClock(day.start) : null, end = day ? t.parseClock(day.end) : null;
    const base = { start: day?.start || '', end: day?.end || '', unlockAt: '', lateMinutes: 0 };
    const inMin = t.parseClock(inClock);
    if (inMin != null) {
        if (t.parseClock(outClock) != null) return { ...base, phase: 'done' };
        if (start == null) return { ...base, phase: 'working' };
        const early = live.find(r => r.type === 'early_leave' && r.state === 'approved');
        const leaveAt = early ? Math.min(end, t.parseClock(early.time)) : end;
        return { ...base, phase: nowMinutes >= leaveAt ? 'leave' : 'working', leaveAt: t.clock(leaveAt) };
    }
    if (start == null) return { ...base, phase: 'off' };
    if (live.some(r => r.type === 'outside')) return { ...base, phase: 'outside' };
    if (live.some(r => r.type === 'absent' && r.state === 'approved')) return { ...base, phase: 'excused' };
    if (nowMinutes < start) return { ...base, phase: 'before' };
    if (nowMinutes >= end) return { ...base, phase: 'missed' };
    const late = live.find(r => r.type === 'late' && r.state === 'approved');
    const until = late ? Math.max(start, t.parseClock(late.time)) : start;
    if (nowMinutes < until) return { ...base, phase: 'late_ok', unlockAt: t.clock(until) };
    return { ...base, phase: 'lock', lateMinutes: nowMinutes - until, unlockAt: t.clock(until) };
}

// Ketma-ket "vaqtida" kunlar: eng yangi kundan orqaga, dam olish kunlari o'tkazib yuboriladi.
function onTimeStreak(days) {
    let n = 0;
    for (const d of (days || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1))) {
        if (['off', 'upcoming', 'before', 'not_ready', 'leave', 'excused'].includes(d.status)) continue;
        if (d.status === 'on_time' || d.status === 'present') n++;
        else break;
    }
    return n;
}

module.exports = { DEFAULT_SETTINGS, normalizeSettings, normalizeDays, haversineMeters, checkLocation, checkLiveness,
    dayStatus, reasonText, REASONS, STATUS_LABELS, MIN_YAW_DELTA, DAY_KEYS,
    staffKind, roleTracked, approverKind, approverScope, canDecide, langCovers, REQUEST_TYPES, normalizeRequest, applyRequests, phase, onTimeStreak,
    ACADEMIC_HEAD_ROLE, SALES_EMP_ROLES, MAX_REQUEST_DAYS };
