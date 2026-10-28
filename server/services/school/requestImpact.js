'use strict';
// Ustoz so'rovining ta'siri (admin "Ustozlar so'rovlari" sahifasi uchun):
//  • ta'til / vaqtni yopish — shu oraliqqa tushadigan darslar va har biriga taklif qilinadigan
//    qoplash vaqti (ustozning keyingi kunlardagi bo'sh vaqtidan, shu oy ichida);
//  • qo'shimcha ochish — faqat sana va oraliq;
//  • o'quvchi bo'yicha so'rov — o'quvchining yaqin 14 kundagi darslari.
// Faqat o'qiydi — hech narsa yozmaydi. Qoplash yozish routes/school.js dagi qarorda.
const T = require('./time');
const S = require('./schedule');

const STEP = 30;
const LOOKAHEAD = 7;

// So'rov qaysi sanaga tegishli: aniq sana yoki (har hafta) bugundan keyingi birinchi shu hafta kuni.
function targetDate(p, today) {
    if (p.date) return T.assertDate(String(p.date).slice(0, 10));
    const wd = Number(p.weekday);
    if (wd >= 1 && wd <= 7) { let d = today; for (let i = 0; i < 7 && T.weekday(d) !== wd; i++) d = T.addDays(d, 1); return d; }
    return null;
}

// Bo'sh oraliqlardan davomiylikka mos, asl vaqtga eng yaqin boshlanish.
function pickSlot(free, duration, near, used) {
    let best = null;
    for (const f of free) {
        for (let t = Math.ceil(f.start / STEP) * STEP; t + duration <= f.end; t += STEP) {
            if (used.some(u => T.overlaps(u, { start: t, end: t + duration }))) continue;
            const score = Math.abs(t - near);
            if (!best || score < best.score) best = { start: t, score };
        }
    }
    return best ? best.start : null;
}

async function impact(db, r, now = new Date()) {
    const p = r.payload || {};
    const today = T.nowLocal(now);
    if (r.type === 'assist_finance' || r.type === 'assist_late') return { type: r.type, lessons: [] };
    if (r.type === 'student') {
        const sid = String(p.studentId || '');
        const st = (await db.query('SELECT id, name, teacher_id, lesson_day_of_week, lesson_time, lesson_duration FROM students WHERE id=$1', [sid])).rows[0];
        if (!st) return { type: r.type, student: null, lessons: [] };
        const to = T.addDays(today.date, 13);
        const ctx = await S.loadContext(db, { teacherIds: st.teacher_id ? [st.teacher_id] : [], from: today.date, to, now });
        const lessons = [];
        for (const d of T.dateRange(today.date, to, 31)) {
            for (const i of S.dayView(ctx, st.teacher_id, d).items) if (i.studentId === sid && (i.kind === 'lesson' || i.kind === 'reserved')) lessons.push({ date: d, time: T.fromMin(i.start), duration: i.end - i.start });
        }
        return { type: r.type, student: { id: st.id, name: st.name, teacherId: st.teacher_id, days: T.patternLabel(st.lesson_day_of_week), time: st.lesson_time, duration: Number(st.lesson_duration) || null }, lessons };
    }
    const date = targetDate(p, today.date);
    if (!date) return { type: r.type, date: null, lessons: [] };
    const from = T.toMin(p.from || '00:00') ?? 0, to = T.toMin(p.to || '24:00') ?? 1440;
    const range = { start: from, end: to };
    const weekly = !p.date && p.repeat === 'weekly';
    if (r.type === 'open') return { type: r.type, date, weekly, from: T.fromMin(from), to: T.fromMin(to), lessons: [] };

    const month = date.slice(0, 7);
    const last = T.monthBounds(month).to;
    const horizon = T.addDays(date, LOOKAHEAD) > last ? last : T.addDays(date, LOOKAHEAD);
    const ctx = await S.loadContext(db, { teacherIds: [r.teacher_id], from: date, to: horizon, now });
    const view = S.dayView(ctx, r.teacher_id, date);
    const hit = view.items.filter(i => (i.kind === 'lesson' || i.kind === 'makeup') && i.studentId && T.overlaps(i, range));
    // Shu sana uchun allaqachon rejalashtirilgan qoplashlar (qaror saqlangandan keyin ko'rsatish uchun).
    const planned = (await db.query(`SELECT m.student_id, m.status, TO_CHAR(m.held_date,'YYYY-MM-DD') AS held, b.start_min FROM school_makeups m
        LEFT JOIN school_bookings b ON b.id=m.booking_id WHERE m.teacher_id=$1 AND m.missed_date=$2 AND m.status IN ('planned','review','approved')`, [r.teacher_id, date])).rows;
    const names = new Map(ctx.students.map(s => [s.id, s]));
    // Taklif: shu kun (yopilgan oraliqdan tashqari, faqat "vaqtni yopish"da) va keyingi kunlar, o'tmagan vaqt.
    const days = T.dateRange(date, horizon, 31).filter(d => d >= today.date && T.weekday(d) !== 7 && (d !== date || r.type === 'close'));
    const views = new Map(days.map(d => [d, S.dayView(ctx, r.teacher_id, d)]));
    const used = new Map();
    const lessons = hit.map(i => {
        const dur = i.end - i.start;
        const already = planned.find(m => m.student_id === i.studentId);
        let suggestion = null;
        if (!already) {
            for (const d of days) {
                let free = views.get(d).makeupFree;
                if (d === date) free = T.subtract(free, [range]);
                if (d === today.date) free = T.subtract(free, [{ start: 0, end: today.min + STEP }]);
                const u = used.get(d) || [];
                const t = pickSlot(free, dur, i.start, u);
                if (t != null) { u.push({ start: t, end: t + dur }); used.set(d, u); suggestion = { date: d, time: T.fromMin(t) }; break; }
            }
        }
        return { studentId: i.studentId, studentName: names.get(i.studentId)?.name || i.studentName || '', time: T.fromMin(i.start), duration: dur,
            kind: i.kind, suggestion, planned: already ? { date: already.held, time: already.start_min != null ? T.fromMin(Number(already.start_min)) : null, status: already.status } : null };
    });
    return { type: r.type, date, weekly, from: T.fromMin(from), to: T.fromMin(to), lessons };
}

module.exports = { impact, targetDate, pickSlot };
