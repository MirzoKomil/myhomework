'use strict';
// Ustozlar uchun avtomatik dars nazorati — ustoz hech narsa bosmaydi.
// Manba 1: Telegram guruhdagi video chat (jonli efir) boshlanish/tugash vaqti — bot guruhda admin.
// Manba 2: Telegram guruhi bog'lanmagan ustozlar uchun — dars vaqtida o'quvchi davomati qachon belgilangani.
// Dars jadvali CRM'dagi o'quvchi ma'lumotidan olinadi (lesson_time, lesson_duration, dars kunlari).
const t = require('./time');
const calendar = require('../../../js/teacherAttendanceCalendar');

const START_GRACE = 5;      // daqiqa
const END_GRACE = 5;
const MARK_BEFORE = 15;     // davomat dars boshlanishidan shuncha oldin ham qabul
const MARK_AFTER = 30;      // dars tugagach shuncha ichida belgilansa — vaqtida
const BLOCK_GAP = 10;       // ketma-ket darslar orasidagi tanaffus shundan kichik bo'lsa — bitta blok
const MAIN_ROLES = new Set(['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi', 'asosiy']);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS staff_att_video_chats (
 id BIGSERIAL PRIMARY KEY, chat_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('started','ended')),
 at TIMESTAMPTZ NOT NULL, duration_seconds INTEGER, update_key TEXT UNIQUE NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS staff_att_video_chats_at ON staff_att_video_chats(chat_id,at);
CREATE TABLE IF NOT EXISTS staff_att_lesson_marks (
 teacher_id TEXT NOT NULL, student_id TEXT NOT NULL, lesson_date DATE NOT NULL, duty TEXT NOT NULL,
 first_marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(teacher_id,student_id,lesson_date,duty)
);
`;

async function initSchema(db) { await db.query(SCHEMA); }

// Bot handler'idan chaqiriladi (guruhdagi xizmat xabarlari).
async function recordVideoChat(db, message) {
    if (!message || !['group', 'supergroup'].includes(message.chat?.type)) return false;
    const started = message.video_chat_started || message.voice_chat_started;
    const ended = message.video_chat_ended || message.voice_chat_ended;
    if (!started && !ended) return false;
    const at = new Date(Number(message.date) * 1000);
    if (Number.isNaN(at.getTime())) return false;
    const ready = (await db.query("SELECT to_regclass('public.staff_att_video_chats') AS a, to_regclass('public.domwork_learning_groups') AS b")).rows[0];
    if (!ready?.a || !ready?.b) return false;
    const chatId = String(message.chat.id);
    // Faqat CRM'da ustozga bog'langan dars guruhlari yoziladi.
    if (!(await db.query("SELECT 1 FROM domwork_learning_groups WHERE chat_id=$1 AND type='classroom' AND NOT archived LIMIT 1", [chatId])).rows[0]) return false;
    const kind = started ? 'started' : 'ended';
    const duration = ended && Number.isFinite(Number(ended.duration)) ? Math.max(0, Math.round(Number(ended.duration))) : null;
    await db.query(`INSERT INTO staff_att_video_chats(chat_id,kind,at,duration_seconds,update_key) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(update_key) DO NOTHING`, [chatId, kind, at, duration, `${chatId}:${message.message_id}`]);
    return true;
}

// Davomat belgilanganda chaqiriladi; faqat BIRINCHI belgilash vaqti saqlanadi.
async function recordMark(db, { teacherId, studentId, date, duty }) {
    if (!teacherId || !studentId || !t.isDate(date)) return;
    await db.query(`INSERT INTO staff_att_lesson_marks(teacher_id,student_id,lesson_date,duty) VALUES($1,$2,$3,$4)
        ON CONFLICT DO NOTHING`, [String(teacherId), String(studentId), date, duty === 'assistant' ? 'assistant' : 'main']);
}

// Video chat yozuvlaridan [boshlanish, tugash] oraliqlari (Date).
function intervals(events, now) {
    const sorted = events.slice().sort((a, b) => new Date(a.at) - new Date(b.at));
    const out = [];
    let open = null;
    for (const e of sorted) {
        const at = new Date(e.at);
        if (e.kind === 'started') { if (!open) open = at; continue; }
        const start = open || (e.duration_seconds != null ? new Date(at.getTime() - e.duration_seconds * 1000) : null);
        if (start) out.push({ start, end: at });
        open = null;
    }
    if (open) out.push({ start: open, end: now, live: true });
    return out;
}

function blocksFrom(slots) {
    const sorted = slots.slice().sort((a, b) => a.start - b.start);
    const blocks = [];
    for (const s of sorted) {
        const last = blocks[blocks.length - 1];
        if (last && s.start <= last.end + BLOCK_GAP) { last.end = Math.max(last.end, s.end); last.slots.push(s); }
        else blocks.push({ start: s.start, end: s.end, slots: [s] });
    }
    return blocks;
}

// Telegram video chat bo'yicha blok holati.
function judgeByVideo(block, date, chats, now, nowDate) {
    const bStart = t.atTashkent(date, block.start), bEnd = t.atTashkent(date, block.end);
    // Faqat shu blok bilan kesishgan efirlar (oldingi blokning efiri hisobga olinmaydi).
    const window = chats.filter(c => c.end > bStart && c.start < bEnd && c.start >= new Date(bStart.getTime() - 60 * 60000));
    if (!window.length) {
        const pending = date > nowDate || (date === nowDate && now < new Date(bEnd.getTime() + 15 * 60000));
        return { status: pending ? 'pending' : 'not_held' };
    }
    const first = window.reduce((a, b) => (b.start < a.start ? b : a));
    const last = window.reduce((a, b) => (b.end > a.end ? b : a));
    const lateStart = Math.round((first.start - bStart) / 60000);
    const live = !!last.live;
    const earlyEnd = live ? 0 : Math.round((bEnd - last.end) / 60000);
    const result = { startedClock: t.tashkentClock(first.start), endedClock: live ? '' : t.tashkentClock(last.end), live,
        lateStartMinutes: lateStart > START_GRACE ? lateStart : 0, earlyEndMinutes: earlyEnd > END_GRACE ? earlyEnd : 0 };
    result.status = result.lateStartMinutes && result.earlyEndMinutes ? 'late_and_early'
        : result.lateStartMinutes ? 'late_start' : result.earlyEndMinutes ? 'early_end' : live ? 'live' : 'on_time';
    return result;
}

// Davomat belgilash vaqti bo'yicha blok holati.
function judgeByMarks(block, date, marks, now, nowDate) {
    const slots = block.slots.map(s => {
        const m = marks.get(s.studentId);
        const from = t.atTashkent(date, s.start - MARK_BEFORE), to = t.atTashkent(date, s.end + MARK_AFTER);
        if (!m) {
            const pending = date > nowDate || (date === nowDate && now < to);
            return { ...s, status: pending ? 'pending' : 'not_marked' };
        }
        const at = new Date(m);
        return { ...s, markedClock: t.tashkentClock(at), status: at < from ? 'marked_early' : at <= to ? 'marked' : 'marked_late' };
    });
    const order = ['not_marked', 'marked_late', 'marked_early', 'pending', 'marked'];
    const status = order.find(o => slots.some(s => s.status === o)) || 'marked';
    return { status, slots };
}

async function report(db, date, now = new Date()) {
    if (!t.isDate(date)) throw Object.assign(new Error('Sana noto‘g‘ri'), { status: 400 });
    const nowDate = t.tashkentDate(now);
    const weekday = t.weekday(date);
    const teachers = (await db.query(`SELECT he.id,he.name,he.role,tc.schedule_pattern FROM hr_employees he LEFT JOIN teachers tc ON tc.id=he.id
        WHERE NOT ${await require('./index').goneSql(db)} ORDER BY he.name`)).rows.filter(r => MAIN_ROLES.has(r.role));
    if (!teachers.length) return { date, rows: [] };
    const students = (await db.query(`SELECT id,name,teacher_id,lesson_day_of_week,lesson_time,lesson_duration,extra_data
        FROM students WHERE teacher_id=ANY($1::text[]) AND COALESCE(lesson_time,'')<>''`, [teachers.map(x => x.id)])).rows
        .filter(s => !['inactive', 'frozen'].includes(s.extra_data?.status));
    const groupsReady = !!(await db.query("SELECT to_regclass('public.domwork_learning_groups') AS t")).rows[0]?.t;
    const chatRows = groupsReady ? (await db.query(`SELECT teacher_id,chat_id FROM domwork_learning_groups
        WHERE type='classroom' AND NOT archived AND chat_id<>''`)).rows : [];
    const dayStart = t.atTashkent(date, 0), dayEnd = t.atTashkent(date, 24 * 60);
    const videoRows = chatRows.length ? (await db.query(`SELECT chat_id,kind,at,duration_seconds FROM staff_att_video_chats
        WHERE chat_id=ANY($1::text[]) AND at >= $2 AND at < $3 ORDER BY at`,
        [chatRows.map(c => c.chat_id), new Date(dayStart.getTime() - 6 * 3600000), new Date(dayEnd.getTime() + 6 * 3600000)])).rows : [];
    const markRows = (await db.query(`SELECT teacher_id,student_id,first_marked_at FROM staff_att_lesson_marks
        WHERE lesson_date=$1 AND duty='main'`, [date])).rows;

    const rows = [];
    for (const teacher of teachers) {
        const mine = students.filter(s => s.teacher_id === teacher.id && calendar.weekdays(
            { lessonDayOfWeek: s.lesson_day_of_week }, { schedulePattern: teacher.schedule_pattern }, 'main').includes(weekday));
        const slots = mine.map(s => {
            const start = t.parseClock(s.lesson_time);
            return start == null ? null : { studentId: s.id, studentName: s.name, start, end: start + (Number(s.lesson_duration) || 15) };
        }).filter(Boolean);
        if (!slots.length) continue;
        const chatIds = new Set(chatRows.filter(c => c.teacher_id === teacher.id).map(c => c.chat_id));
        const source = chatIds.size ? 'telegram' : 'davomat';
        const chats = [];
        for (const id of chatIds) chats.push(...intervals(videoRows.filter(v => v.chat_id === id), now));
        const marks = new Map(markRows.filter(m => m.teacher_id === teacher.id).map(m => [m.student_id, m.first_marked_at]));
        const blocks = blocksFrom(slots).map(b => {
            let judged = source === 'telegram' ? judgeByVideo(b, date, chats, now, nowDate) : judgeByMarks(b, date, marks, now, nowDate);
            let blockSource = source;
            // Telegram'da efir bo'lmagan blok (dars boshqa joyda o'tgan bo'lishi mumkin) — davomat vaqti bilan tekshiriladi.
            if (source === 'telegram' && judged.status === 'not_held') {
                const byMarks = judgeByMarks(b, date, marks, now, nowDate);
                if (byMarks.slots.some(x => x.markedClock)) { judged = byMarks; blockSource = 'davomat'; }
            }
            return { start: t.clock(b.start), end: t.clock(b.end), lessons: b.slots.length, source: blockSource,
                students: b.slots.map(s => s.studentName), ...judged,
                slots: judged.slots ? judged.slots.map(s => ({ student: s.studentName, start: t.clock(s.start), end: t.clock(s.end), status: s.status, markedClock: s.markedClock || '' })) : undefined };
        });
        const problems = blocks.filter(b => !['on_time', 'marked', 'pending', 'live'].includes(b.status)).length;
        rows.push({ teacherId: teacher.id, name: teacher.name, source, lessons: slots.length, blocks, problems });
    }
    return { date, rows };
}

const LESSON_STATUS_LABELS = {
    on_time: 'Vaqtida', live: 'Hozir davom etmoqda', late_start: 'Kech boshladi', early_end: 'Erta tugatdi',
    late_and_early: 'Kech boshlab, erta tugatdi', not_held: 'Dars bo‘lmadi (video chat yo‘q)', pending: 'Hali vaqti kelmadi',
    marked: 'Davomat vaqtida belgilandi', marked_late: 'Davomat kech belgilandi', marked_early: 'Davomat darsdan oldin belgilandi',
    not_marked: 'Davomat belgilanmadi',
};

module.exports = { initSchema, recordVideoChat, recordMark, report, intervals, blocksFrom, judgeByVideo, judgeByMarks, LESSON_STATUS_LABELS };
