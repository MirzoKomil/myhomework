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
};

module.exports = { DEFAULT_SETTINGS, normalizeSettings, normalizeDays, haversineMeters, checkLocation, checkLiveness,
    dayStatus, reasonText, REASONS, STATUS_LABELS, MIN_YAW_DELTA, DAY_KEYS };
