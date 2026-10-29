'use strict';
// Eski davomat ekranidagi "Du·Ch·Ju" belgilarini o'quvchining o'z dars kunlariga ko'chirish (bir martalik, server ishga tushganda).
//
// Muammo: eski Davomat ekrani (24a57020 dan oldin, renderMainAttendance → getLessonDaysInMonth(teacher.schedulePattern || 'mwf'))
// HAR o'quvchiga USTOZ jadvalining ustunlarini (odatda Du·Ch·Ju) ko'rsatgan. Shu sabab Se·Pa·Sh o'quvchilarga "Keldi"
// Du·Ch·Ju sanalariga qo'yilgan (masalan oktyabr: 2, 5, 7, 9, 12…). Yangi qoidalar (AttendanceRules.monthTotals, payrollEngine
// 'approved-v1', teacherAttendanceRules) faqat o'quvchining o'z dars kunidagi "Keldi"ni sanaydi — bu belgilar 0 bo'lib qolgan.
//
// Nima qilinadi (har oy bloki `${oy}_${ustoz}` va har o'quvchi uchun):
//  • "Eski belgi" — o'quvchining dars kuni bo'lmagan, lekin ustoz jadvalidagi (eski ekran ustunlari: mwf → Du·Ch·Ju,
//    tts → Se·Pa·Sh) kunga qo'yilgan belgi. Boshqa (tasodifiy) kunlardagi belgilarga tegilmaydi — ular eski ekrandan emas.
//  • Soni saqlanadi: eski belgilar o'sish tartibida, navbat bilan, o'quvchining SHU OYDAGI eng erta o'z dars kunlariga
//    ko'chiriladi. Kun quyidagilarga mos bo'lishi shart:
//      – o'quvchi kursni boshlagan kundan (startDate/joinDate) oldin emas, ustoz ishga kirgan kundan oldin emas;
//      – kelajak emas (Toshkent bo'yicha bugungacha);
//      – shu o'quvchida shu oyda hech qaysi ustoz blokida belgi yo'q (qiymati qanday bo'lmasin), "Kelmadi" (school_absences) yo'q,
//        qoplash darsi (school_makeups: qoldirilgan yoki o'tilgan kun) bilan band emas — aks holda qoplash hisobi o'zgarib ketadi;
//      – o'quvchi o'sha kuni faol (AttendanceRules.lessonCountsOn — muzlatilgan/chiqib ketgan kun emas) va o'sha kuni shu ustozda
//        (AttendanceRules.taughtOn — ustozlar tarixi).
//    Qator qiymati (present) o'zgarmaydi — faqat kuni o'zgaradi. Shu kundagi jonli dars yozuvi (json_data.liveGrades: date) ham
//    yangi sanaga ko'chiriladi (ilovadagi "o'tildi" va Davomatdagi dars raqami belgi bilan bir kunda turishi uchun).
//  • Joylashmagan belgi (mos kun qolmagan) joyida qoladi — shunchaki sanalmaydi; logga yoziladi.
//  • Yakuniy oy (moliya oyni yopgan — fin_period_locks, yoki shu ustozning shu oyni qamragan maoshi "to'langan" —
//    salary_transactions.status='paid') — o'zgartirilmaydi, faqat logga soni yoziladi. To'langan oyni o'zgartirsak,
//    maoshda "tuzatish taklifi" paydo bo'lardi.
//  • Har o'zgargan ustoz-oy uchun salary_audit yozuvi (action = ACTION): to'liq asl blok va jonli dars yozuvlari (before_data),
//    yangi blok va har bir ko'chirish (after_data) — to'liq qaytariladigan. Oxirida marker yozuvi (entity_id = 'done').
//  • Qayta ishga tushsa hech narsa qilmaydi: school_migrations (id = MIGRATION_ID) qatori shu tranzaksiyada birinchi bo'lib
//    yoziladi — parallel ikkinchi jarayon shu qatorda kutib, keyin "bor" deb chiqib ketadi (advisory lock kerak emas).
//    salary_audit markeri ham tekshiriladi.
// Yordamchi davomati (assistant_attendance) va aloqalar (school_assist_contacts) — tegilmaydi.
const R = require('../../../js/attendanceRules');
const cal = require('../../../js/teacherAttendanceCalendar');
const T = require('./time');

const MIGRATION_ID = 'legacy-mwf-attendance-2026-10';
const ACTION = 'migrate-legacy-mwf-attendance';
const ACTOR = { id: 'system', name: 'Tizim (eski davomat ko\'chirish)' };
const TAG = '[eski-davomat]';

const pad = n => String(n).padStart(2, '0');
const lastDay = month => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
const dkey = v => {
    if (!v) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
};
const validDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
const extraOf = r => {
    const x = r && r.extra_data;
    if (x && typeof x === 'object') return x;
    try { return JSON.parse(x || '{}') || {}; } catch { return {}; }
};
const patternDays = p => p === 'tts' ? [2, 4, 6] : [1, 3, 5];

// Sof hisob (bazasiz). input:
//  attendance:  { [attKey]: { [studentId]: { [day]: present } } } — main_attendance'ning BARCHA qatorlari (present 0 ham)
//  students:    { [id]: { id, teacherId, lessonDayOfWeek, startDate, joinDate, ...extra } }
//  teachers:    { [id]: { schedulePattern, name, hire } }
//  statusRows:  { [studentId]: school_student_status qatorlari }
//  history:     { [studentId]: [{ teacherId, from, to }] }  (school_teacher_history)
//  busy:        { [studentId]: Set<'YYYY-MM-DD'> } — "Kelmadi" va qoplash kunlari
//  final:       Set<attKey> — yakuniy (o'zgartirilmaydigan) bloklar
//  today:       'YYYY-MM-DD' (Toshkent)
function plan(input) {
    const { attendance = {}, students = {}, teachers = {}, statusRows = {}, history = {}, busy = {}, final = new Set(), today } = input;
    const changes = [], finals = [], skipped = [];
    // O'quvchi + oy bo'yicha band kunlar (har qanday ustoz blokida har qanday qiymatli qator).
    const taken = new Map();
    const takenOf = (sid, month) => {
        const k = sid + '|' + month;
        if (!taken.has(k)) {
            const set = new Set();
            for (const [key, block] of Object.entries(attendance)) if (key.slice(0, 7) === month && block[sid]) for (const d of Object.keys(block[sid])) set.add(Number(d));
            taken.set(k, set);
        }
        return taken.get(k);
    };
    for (const attKey of Object.keys(attendance).sort()) {
        const m = /^(\d{4}-\d{2})_(.+)$/.exec(attKey);
        if (!m) continue;
        const [, month, teacherId] = m;
        const teacher = teachers[teacherId] || {};
        const oldDays = patternDays(teacher.schedulePattern);
        const block = attendance[attKey] || {};
        const rows = [];
        let legacyTotal = 0;
        for (const sid of Object.keys(block).sort()) {
            const s = students[sid];
            if (!s) continue;
            const ld = Number(s.lessonDayOfWeek);
            if (s.lessonDayOfWeek == null || !(ld >= 1 && ld <= 7)) continue; // dars kuni yo'q — hisob ustoz jadvali bo'yicha, eski belgi muammosi yo'q
            const own = cal.weekdays({ lessonDayOfWeek: ld }, teacher, 'main');
            const marks = block[sid] || {};
            const legacy = Object.keys(marks).map(Number).filter(d => d >= 1 && d <= lastDay(month)
                && [1, true].includes(marks[d]) && !own.includes(T.weekday(`${month}-${pad(d)}`)) && oldDays.includes(T.weekday(`${month}-${pad(d)}`)))
                .sort((a, b) => a - b);
            if (!legacy.length) continue;
            legacyTotal += legacy.length;
            if (final.has(attKey)) continue;
            const start = validDate(dkey(s.startDate || s.joinDate));
            const hire = validDate(dkey(teacher.hire));
            const hist = statusRows[sid] || [];
            const sh = { ...s, teacherHistory: history[sid] || [] };
            const used = takenOf(sid, month), busySet = busy[sid] || new Set();
            const targets = [];
            for (let d = 1; d <= lastDay(month); d++) {
                const date = `${month}-${pad(d)}`;
                if (!own.includes(T.weekday(date))) continue;
                if (start && date < start) continue;
                if (hire && date < hire) continue;
                if (today && date > today) continue;
                if (used.has(d) || busySet.has(date)) continue;
                if (!R.lessonCountsOn(s, hist, date) || !R.taughtOn(sh, teacherId, date)) continue;
                targets.push(d);
            }
            const moves = [], unplaced = [];
            legacy.forEach((d, i) => {
                if (i < targets.length) moves.push({ from: d, to: targets[i], value: marks[d] });
                else unplaced.push(d);
            });
            // Band qilingan kunlar boshqa bloklar uchun ham band (bir o'quvchi bir oyda ikki ustozda bo'lishi mumkin).
            for (const mv of moves) { used.delete(mv.from); used.add(mv.to); }
            const after = { ...marks };
            for (const mv of moves) delete after[mv.from];
            for (const mv of moves) after[mv.to] = mv.value;
            rows.push({ studentId: sid, name: s.name || sid, before: { ...marks }, after, moves, unplaced });
        }
        if (!legacyTotal) continue;
        if (final.has(attKey)) { finals.push({ attKey, month, teacherId, count: legacyTotal }); continue; }
        const moved = rows.reduce((n, r) => n + r.moves.length, 0), unplaced = rows.reduce((n, r) => n + r.unplaced.length, 0);
        if (!moved && !unplaced) { skipped.push(attKey); continue; }
        changes.push({ attKey, month, teacherId, teacherName: teacher.name || teacherId, students: rows, moved, unplaced });
    }
    return { changes, finals, skipped };
}

// Jonli dars yozuvlari (liveGrades) — eski sanadagi shu ustoz (yoki ustozi ko'rsatilmagan) yozuvini yangi sanaga ko'chiradi.
// Yangi sanada shu ustozning yozuvi bo'lsa — tegilmaydi. Natija: { grades, touched: { [sid]: { before, after } } }.
function moveGrades(liveGrades, changes) {
    const grades = { ...(liveGrades || {}) }, touched = {};
    for (const ch of changes) for (const r of ch.students) {
        if (!r.moves.length || !Array.isArray(grades[r.studentId])) continue;
        const list = grades[r.studentId].map(g => ({ ...g }));
        let changed = false;
        for (const mv of r.moves) {
            const from = `${ch.month}-${pad(mv.from)}`, to = `${ch.month}-${pad(mv.to)}`;
            const mine = g => g && (!g.teacherId || g.teacherId === ch.teacherId);
            if (list.some(g => mine(g) && g.date === to)) continue;
            const g = list.find(g => mine(g) && g.date === from);
            if (g) { g.date = to; changed = true; }
        }
        if (changed) {
            touched[r.studentId] = { before: grades[r.studentId], after: list };
            grades[r.studentId] = list;
        }
    }
    return { grades, touched };
}

const exists = async (c, t) => !!(await c.query('SELECT to_regclass($1)::text AS t', ['public.' + t])).rows[0]?.t;

async function load(c, today) {
    const attendance = {};
    const attRows = (await c.query('SELECT att_key, student_id, day, present FROM main_attendance ORDER BY att_key, student_id, day FOR UPDATE')).rows;
    for (const r of attRows) ((attendance[r.att_key] ||= {})[r.student_id] ||= {})[r.day] = Number(r.present);
    const students = {};
    for (const r of (await c.query('SELECT * FROM students')).rows) {
        const x = extraOf(r);
        students[r.id] = { ...x, extra_data: x, id: r.id, name: r.name, teacherId: r.teacher_id, lessonDayOfWeek: r.lesson_day_of_week ?? null };
    }
    const teachers = {};
    for (const r of (await c.query('SELECT id, name, schedule_pattern FROM teachers')).rows) teachers[r.id] = { name: r.name, schedulePattern: r.schedule_pattern };
    if (await exists(c, 'hr_employees')) for (const r of (await c.query('SELECT * FROM hr_employees')).rows) {
        const t = teachers[r.id] ||= {};
        t.name = r.name || t.name;
        t.hire = r.start_date || r.join_date || '';
    }
    const statusRows = {};
    if (await exists(c, 'school_student_status')) for (const r of (await c.query(`SELECT student_id, status, TO_CHAR(from_date,'YYYY-MM-DD') AS from_date,
        TO_CHAR(to_date,'YYYY-MM-DD') AS to_date, created_at FROM school_student_status WHERE cancelled_at IS NULL ORDER BY from_date, created_at`)).rows)
        (statusRows[r.student_id] ||= []).push(r);
    const history = {};
    if (await exists(c, 'school_teacher_history')) for (const r of (await c.query(`SELECT student_id, teacher_id, TO_CHAR(from_date,'YYYY-MM-DD') AS from_date,
        TO_CHAR(to_date,'YYYY-MM-DD') AS to_date FROM school_teacher_history ORDER BY from_date`)).rows)
        (history[r.student_id] ||= []).push({ teacherId: r.teacher_id, from: r.from_date, to: r.to_date || null });
    const busy = {};
    const addBusy = (sid, d) => { if (d) (busy[sid] ||= new Set()).add(d); };
    if (await exists(c, 'school_absences')) for (const r of (await c.query(`SELECT student_id, TO_CHAR(day,'YYYY-MM-DD') AS day FROM school_absences WHERE absent`)).rows) addBusy(r.student_id, r.day);
    if (await exists(c, 'school_makeups')) for (const r of (await c.query(`SELECT student_id, TO_CHAR(missed_date,'YYYY-MM-DD') AS missed, TO_CHAR(held_date,'YYYY-MM-DD') AS held
        FROM school_makeups WHERE status IN ('planned','review','approved')`)).rows) { addBusy(r.student_id, r.missed); addBusy(r.student_id, r.held); }
    // Yakuniylik: moliya yopgan oy (fin_period_locks) yoki shu ustozning shu oyni qamragan "to'langan" maoshi.
    const final = new Set();
    const closedThrough = await exists(c, 'fin_period_locks') ? (await c.query('SELECT MAX(month) AS m FROM fin_period_locks')).rows[0]?.m || '' : '';
    const paid = await exists(c, 'salary_transactions') ? (await c.query(`SELECT employee_id, TO_CHAR(period_start,'YYYY-MM-DD') AS s, TO_CHAR(period_end,'YYYY-MM-DD') AS e
        FROM salary_transactions WHERE status='paid'`)).rows : [];
    for (const key of Object.keys(attendance)) {
        const month = key.slice(0, 7), tid = key.slice(8), first = month + '-01', last = `${month}-${pad(lastDay(month))}`;
        if ((closedThrough && month <= closedThrough) || paid.some(p => p.employee_id === tid && p.s <= last && p.e >= first)) final.add(key);
    }
    const liveGrades = (await exists(c, 'json_data')) ? (await c.query("SELECT data FROM json_data WHERE key='liveGrades' FOR UPDATE")).rows[0]?.data : null;
    return { attendance, students, teachers, statusRows, history, busy, final, today, liveGrades: liveGrades && typeof liveGrades === 'object' ? liveGrades : null };
}

async function audit(c, entity, before, after) {
    await c.query(`INSERT INTO salary_audit(action,entity_id,actor_id,actor_name,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6)`,
        [ACTION, entity, ACTOR.id, ACTOR.name, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after)]);
}

// pool — pg Pool (yoki connect() beradigan obyekt). now — test uchun (Toshkent "bugun" shundan).
async function migrate(pool, { log = console, now = new Date() } = {}) {
    await pool.query(`CREATE TABLE IF NOT EXISTS school_migrations (id TEXT PRIMARY KEY, ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), result JSONB NOT NULL DEFAULT '{}')`);
    const c = await pool.connect();
    let result;
    try {
        await c.query('BEGIN');
        // Marker birinchi yoziladi: parallel jarayon shu qatorda kutadi va keyin "bor" deb chiqadi.
        const mine = (await c.query(`INSERT INTO school_migrations (id, result) VALUES ($1, '{}') ON CONFLICT (id) DO NOTHING RETURNING id`, [MIGRATION_ID])).rows.length;
        const audited = mine && (await exists(c, 'salary_audit'))
            && (await c.query("SELECT 1 FROM salary_audit WHERE action=$1 AND entity_id='done' LIMIT 1", [ACTION])).rows.length;
        if (!mine || audited) { await c.query('ROLLBACK'); return { skipped: 'already-done' }; }
        if (!(await exists(c, 'salary_audit')) || !(await exists(c, 'main_attendance'))) {
            // Maosh audit jadvali hali yo'q — marker yozilmaydi, keyingi ishga tushishda bajariladi.
            await c.query('ROLLBACK'); log.warn(`${TAG} salary_audit yoki main_attendance jadvali yo'q — keyingi ishga tushishda`); return { skipped: 'not-ready' };
        }
        const today = T.nowLocal(now).date;
        const data = await load(c, today);
        const { changes, finals } = plan(data);
        const { grades, touched } = data.liveGrades ? moveGrades(data.liveGrades, changes) : { grades: null, touched: {} };
        for (const ch of changes) {
            const moving = ch.students.filter(r => r.moves.length);
            // Avval eski kunlar vaqtincha manfiy kunga o'tkaziladi, keyin yangi kunga — bir blokda kunlar almashsa ham PK to'qnashmaydi.
            for (const r of moving) for (const mv of r.moves)
                await c.query('UPDATE main_attendance SET day=$4 WHERE att_key=$1 AND student_id=$2 AND day=$3', [ch.attKey, r.studentId, mv.from, -mv.to]);
            for (const r of moving) for (const mv of r.moves)
                await c.query('UPDATE main_attendance SET day=$3 WHERE att_key=$1 AND student_id=$2 AND day=$4', [ch.attKey, r.studentId, mv.to, -mv.to]);
            const gradeBefore = {}, gradeAfter = {};
            for (const r of ch.students) if (touched[r.studentId]) { gradeBefore[r.studentId] = touched[r.studentId].before; gradeAfter[r.studentId] = touched[r.studentId].after; }
            const blockAfter = { ...data.attendance[ch.attKey] };
            for (const r of ch.students) blockAfter[r.studentId] = r.after;
            await audit(c, ch.attKey, { block: data.attendance[ch.attKey], liveGrades: gradeBefore },
                { block: blockAfter, liveGrades: gradeAfter, teacher: { id: ch.teacherId, name: ch.teacherName }, moved: ch.moved, unplaced: ch.unplaced,
                    students: ch.students.map(r => ({ id: r.studentId, name: r.name, before: r.before, after: r.after,
                        moves: r.moves.map(m => ({ from: `${ch.month}-${pad(m.from)}`, to: `${ch.month}-${pad(m.to)}`, value: m.value })),
                        unplaced: r.unplaced.map(d => `${ch.month}-${pad(d)}`) })) });
        }
        if (Object.keys(touched).length) await c.query(`UPDATE json_data SET data=$1 WHERE key='liveGrades'`, [JSON.stringify(grades)]);
        const summary = { today, moved: changes.reduce((n, ch) => n + ch.moved, 0), unplaced: changes.reduce((n, ch) => n + ch.unplaced, 0),
            blocks: changes.map(ch => ({ attKey: ch.attKey, teacher: ch.teacherName, moved: ch.moved, unplaced: ch.unplaced })),
            final: finals.map(f => ({ attKey: f.attKey, count: f.count })), liveGrades: Object.keys(touched).length };
        await audit(c, 'done', null, summary);
        await c.query('UPDATE school_migrations SET result=$2 WHERE id=$1', [MIGRATION_ID, JSON.stringify(summary)]);
        await c.query('COMMIT');
        result = { ...summary, changes, finals };
    } catch (e) {
        await c.query('ROLLBACK').catch(() => {});
        throw e;
    } finally { c.release(); }
    const byMonth = new Map();
    for (const f of result.finals) byMonth.set(f.month, (byMonth.get(f.month) || 0) + f.count);
    for (const [month, n] of [...byMonth].sort()) log.log(`${TAG} ${month} yakuniy — o'zgartirilmadi: ${n} belgi`);
    for (const ch of result.changes) {
        log.log(`${TAG} ${ch.month} ${ch.teacherName}: ${ch.moved} belgi ko'chirildi, ${ch.unplaced} joylashmadi`);
        const left = ch.students.filter(r => r.unplaced.length);
        if (left.length) log.log(`${TAG}   joylashmadi (joyida qoldi, sanalmaydi): ` + left.map(r => `${r.name} — ${r.unplaced.map(d => `${ch.month}-${pad(d)}`).join(', ')}`).join('; '));
    }
    if (!result.changes.length && !result.finals.length) log.log(`${TAG} ko'chiriladigan eski belgi yo'q`);
    return result;
}

module.exports = { MIGRATION_ID, ACTION, plan, moveGrades, migrate };
