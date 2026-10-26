'use strict';
// Akademik bo'lim → Darslik markazi.
// Ustoz uchun 72 darslik reja, har dars bo'yicha materiallar (jonli dars,
// videodars va grammatika slaydlari, ustoz qo'llanmasi), kitob PDF'lari, og'zaki
// imtihon topshiriqlari va o'quvchilarning yangi ilovadagi o'zlashtirishi
// (progress, xatolar, faol vaqt, davomat, jonli dars baholari).
//
// Mustaqil, faqat qo'shiladigan saqlash: mobile_content, students,
// student_lesson_progress, davomat va json_data faqat o'qiladi.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { sanitizeMobileContent } = require('../../js/mobileContentPolicy');
const teacherRoles = require('../../js/teacherRoles');
const RULES = require('../../js/academicRules');

const { TOTAL_LESSONS, MONTH_SIZE, PASS_PERCENT, UNLOCK_PERCENT, LESSONS_PER_WEEK } = RULES;
const TEACHER_GRADED = new Set(RULES.TEACHER_GRADED);
const EDIT_ROLES = new Set(['admin', 'boshliq']);
const VIEW_ROLES = new Set(['admin', 'boshliq', 'rop', 'teacher']);
const LANGS = new Set(['english', 'russian']);
const TZ = 'Asia/Tashkent';
const DAILY_CAP_SECONDS = 8 * 3600;
const MAX_FLUSH_SECONDS = 900;
const CONTENT_TTL_MS = 30000;

// Har dars uchun alohida materiallar va kurs bo'yicha umumiy fayllar.
const LESSON_KINDS = {
    live_slides: 'Jonli dars slaydlari',
    video_slides: 'Videodars slaydlari',
    grammar_slides: 'Grammatika slaydlari',
    lesson_plan: 'Dars rejasi (ustoz)',
    teacher_guide: "Ustoz qo'llanmasi",
    extra: "Qo'shimcha material",
};
const COURSE_KINDS = {
    book: 'Darslik kitobi (PDF)',
    teacher_book: "Teacher's book",
    methodology: 'Metodika',
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS academic_materials (
 id TEXT PRIMARY KEY,
 language TEXT NOT NULL CHECK (language IN ('english','russian')),
 lesson_no INTEGER CHECK (lesson_no IS NULL OR (lesson_no BETWEEN 1 AND 72)),
 kind TEXT NOT NULL,
 title TEXT NOT NULL,
 url TEXT NOT NULL,
 file_name TEXT NOT NULL DEFAULT '',
 file_size BIGINT NOT NULL DEFAULT 0,
 mime TEXT NOT NULL DEFAULT '',
 note TEXT NOT NULL DEFAULT '',
 meta JSONB NOT NULL DEFAULT '{}',
 sort INTEGER NOT NULL DEFAULT 0,
 archived BOOLEAN NOT NULL DEFAULT FALSE,
 created_by TEXT NOT NULL DEFAULT '',
 updated_by TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS academic_materials_lang ON academic_materials(language, lesson_no) WHERE NOT archived;
CREATE TABLE IF NOT EXISTS student_learning_time (
 student_id TEXT NOT NULL,
 day DATE NOT NULL,
 lesson_id TEXT NOT NULL DEFAULT '',
 section TEXT NOT NULL DEFAULT '',
 seconds INTEGER NOT NULL DEFAULT 0 CHECK (seconds >= 0),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY (student_id, day, lesson_id, section)
);
CREATE TABLE IF NOT EXISTS student_part_results (
 student_id TEXT NOT NULL,
 lesson_id TEXT NOT NULL,
 part_id TEXT NOT NULL,
 kind TEXT NOT NULL DEFAULT '',
 title TEXT NOT NULL DEFAULT '',
 correct INTEGER NOT NULL DEFAULT 0,
 total INTEGER NOT NULL DEFAULT 0,
 first_percent INTEGER NOT NULL DEFAULT 0,
 last_percent INTEGER NOT NULL DEFAULT 0,
 best_percent INTEGER NOT NULL DEFAULT 0,
 attempts INTEGER NOT NULL DEFAULT 0,
 passed BOOLEAN NOT NULL DEFAULT FALSE,
 mistakes JSONB NOT NULL DEFAULT '[]',
 first_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY (student_id, lesson_id, part_id)
);
ALTER TABLE student_part_results ADD COLUMN IF NOT EXISTS first_percent INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS student_exam_results (
 student_id TEXT NOT NULL,
 exam_id TEXT NOT NULL,
 last_percent INTEGER NOT NULL DEFAULT 0,
 best_percent INTEGER NOT NULL DEFAULT 0,
 attempts INTEGER NOT NULL DEFAULT 0,
 passed BOOLEAN NOT NULL DEFAULT FALSE,
 mistakes JSONB NOT NULL DEFAULT '[]',
 first_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY (student_id, exam_id)
);
`;

const error = (status, message) => Object.assign(new Error(message), { status });

async function initSchema(pool) {
    await pool.query(SCHEMA);
}

// ─── Sana: hamma hisob Toshkent vaqtida ─────────────────────────────────────
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const tzDay = (d = new Date()) => dayFmt.format(d);
function shiftDay(day, delta) {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
}

// ─── Kirish huquqi ──────────────────────────────────────────────────────────
// Ustoz faqat o'z tilini va o'ziga biriktirilgan (asosiy yoki yordamchi)
// o'quvchilarni ko'radi. Rol tokendan emas, bazadagi akkauntdan olinadi.
async function resolveAccess(pool, actor) {
    const { rows } = await pool.query('SELECT id, role FROM users WHERE id=$1', [actor?.id]);
    const role = rows[0]?.role;
    if (!role || !VIEW_ROLES.has(role)) throw error(403, "Darslik markaziga ruxsat yo'q");
    if (role !== 'teacher') return { role, canEdit: EDIT_ROLES.has(role), teacher: null, lang: null };
    const teacherDuties = require('./teacherDuties');
    const teacher = await teacherDuties.teacherForActor(pool, { id: actor.id, role });
    return { role, canEdit: false, teacher, lang: teacherRoles.language(teacher) === 'russian' ? 'russian' : 'english' };
}

function pickLang(access, requested) {
    if (access.lang) return access.lang;
    return LANGS.has(requested) ? requested : 'english';
}

// CRM'ning qolgan joylari kabi: nofaol va xodimlarning demo akkauntlari
// hisobga kirmaydi; muzlatilganlar ko'rinadi, lekin alohida belgilanadi.
async function accessibleStudents(pool, access, lang) {
    const params = [lang];
    let where = "COALESCE(s.subject,'english') = $1";
    if (access.teacher) {
        params.push(access.teacher.id);
        where += ' AND (s.teacher_id = $2 OR s.assistant_teacher_id = $2)';
    }
    const { rows } = await pool.query(`SELECT s.id, s.name, s.group_name, s.subject, s.teacher_id,
        s.assistant_teacher_id, s.lesson_duration, s.lesson_day_of_week, s.lesson_time, COALESCE(s.extra_data,'{}'::jsonb) AS extra
        FROM students s WHERE ${where} ORDER BY s.name`, params);
    return rows.map(r => ({
        id: r.id, name: r.name, group: r.group_name || '', subject: r.subject || 'english',
        teacherId: r.teacher_id || '', assistantTeacherId: r.assistant_teacher_id || '',
        lessonDuration: Number(r.lesson_duration) || null,
        lessonDayOfWeek: r.lesson_day_of_week === null || r.lesson_day_of_week === undefined ? null : Number(r.lesson_day_of_week),
        lessonTime: r.lesson_time || '',
        startDate: r.extra?.startDate || r.extra?.joinDate || '',
        status: String(r.extra?.status || '').toLowerCase(), frozen: r.extra?.frozen === true,
        staffDemo: r.extra?.isStaffDemo === true,
        platformCourseId: r.extra?.platformCourseId || '',
        role: access.teacher ? (r.teacher_id === access.teacher.id ? 'main' : 'assistant') : null,
    })).filter(s => !s.staffDemo && !['inactive', 'archived', 'deleted', 'left'].includes(s.status));
}

async function assertStudentAccess(pool, access, studentId) {
    const { rows } = await pool.query("SELECT id, COALESCE(subject,'english') AS subject FROM students WHERE id=$1", [studentId]);
    if (!rows[0]) throw error(404, "O'quvchi topilmadi");
    const lang = rows[0].subject === 'russian' ? 'russian' : 'english';
    const list = await accessibleStudents(pool, access, lang);
    const student = list.find(s => s.id === studentId);
    if (!student) throw error(403, "Bu o'quvchi sizga biriktirilmagan");
    return { student, lang };
}

// ─── Kontent (faqat o'qiladi, 30 soniya keshlanadi) ─────────────────────────
let contentCache = { at: 0, mc: null };
async function loadMobileContent(pool) {
    if (contentCache.mc && Date.now() - contentCache.at < CONTENT_TTL_MS) return contentCache.mc;
    const { rows } = await pool.query('SELECT data FROM mobile_content WHERE singleton = 1');
    const mc = sanitizeMobileContent(rows[0]?.data
        ? JSON.parse(JSON.stringify(rows[0].data)) : { courses: [], lessons: [], lessonContents: {} });
    mc.courses ||= []; mc.lessons ||= []; mc.lessonContents ||= {};
    contentCache = { at: Date.now(), mc };
    return mc;
}

const SOURCE_ROOT = path.join(__dirname, '..', '..');
let ruSourceCache = null;
function loadRussianSource(root = SOURCE_ROOT) {
    if (ruSourceCache) return ruSourceCache;
    const map = {};
    const dir = path.join(root, 'content', 'ru');
    for (let n = 1; n <= TOTAL_LESSONS; n++) {
        const file = path.join(dir, `L${String(n).padStart(2, '0')}.json`);
        try { map[n] = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* manba bo'lmasa — CRM kontenti yetarli */ }
    }
    ruSourceCache = map;
    return map;
}

let oralCache;
function loadOralExams(lang, root = SOURCE_ROOT) {
    if (lang !== 'russian') return null;
    if (oralCache === undefined) {
        try { oralCache = JSON.parse(fs.readFileSync(path.join(root, 'content', 'ru', 'exams', 'oral.json'), 'utf8')); }
        catch { oralCache = null; }
    }
    return oralCache;
}

function coursesFor(mc, lang) {
    return mc.courses.filter(c => (c.lang || 'english') === lang);
}

function pickCourse(mc, lang, courseId) {
    const list = coursesFor(mc, lang);
    return list.find(c => c.id === courseId) || list[0] || null;
}

function courseLessons(mc, course) {
    return course ? mc.lessons.filter(l => l.courseId === course.id).slice(0, TOTAL_LESSONS) : [];
}

// Har o'quvchi o'z kursidagi darslar bo'yicha (ilovadagi bilan bir xil).
function studentCourseLessons(mc, student) {
    const lang = student.subject === 'russian' ? 'russian' : 'english';
    return courseLessons(mc, pickCourse(mc, lang, student.platformCourseId));
}

const stripStress = s => String(s || '').replace(/́/g, '');
const monthOf = no => Math.ceil(no / MONTH_SIZE);

function partQuestionCount(p) {
    switch (p?.kind) {
        case 'matching': return (p.pairs || []).length;
        case 'fillBlank': return (p.blanks || []).length;
        case 'multipleChoice': return (p.questions || []).length;
        case 'sentenceBuild': return (p.items || []).length;
        case 'reading': return (p.sentences || []).length || 1;
        case 'record': return (p.prompts || []).length || 1;
        default: return 1;
    }
}

function lessonMeta(mc, lang, lessons, index, ru) {
    const no = index + 1;
    const admin = lessons[index];
    const id = admin?.id || '';
    const content = (id && mc.lessonContents[id]) || {};
    const src = lang === 'russian' ? (ru[no] || null) : null;
    const isVideo = index % 2 === 0;
    const parts = Array.isArray(content.homeworkParts) ? content.homeworkParts : [];
    return {
        no, id, month: monthOf(no), type: isVideo ? 'video' : 'live',
        name: admin?.name || src?.title || `${no}-dars`,
        topic: src?.topic || '',
        cando: src?.cando || '',
        active: admin ? admin.isActive !== false : false,
        exists: !!admin,
        counts: {
            vocab: (content.vocabulary || []).length || (src?.vocab || []).length,
            slides: (content.slides || []).length,
            dialogs: (content.audioDialogs || []).length,
            homework: parts.length,
            questions: parts.reduce((sum, p) => sum + partQuestionCount(p), 0),
            video: content.videoUrl ? 1 : 0,
            konspekt: (content.konspekt || src?.konspekt) ? 1 : 0,
        },
    };
}

// ─── Materiallar ────────────────────────────────────────────────────────────
function materialRow(r) {
    return {
        id: r.id, language: r.language, lessonNo: r.lesson_no, kind: r.kind,
        kindLabel: LESSON_KINDS[r.kind] || COURSE_KINDS[r.kind] || r.kind,
        title: r.title, url: r.url, fileName: r.file_name, fileSize: Number(r.file_size) || 0,
        mime: r.mime, note: r.note, meta: r.meta || {}, sort: r.sort,
        createdAt: r.created_at, updatedAt: r.updated_at,
    };
}

async function listMaterials(pool, lang, lessonNo) {
    const params = [lang];
    let where = 'language=$1 AND NOT archived';
    if (lessonNo !== undefined) {
        params.push(lessonNo);
        where += ' AND lesson_no = $2';
    }
    const { rows } = await pool.query(`SELECT * FROM academic_materials WHERE ${where}
        ORDER BY lesson_no NULLS FIRST, kind, sort, created_at`, params);
    return rows.map(materialRow);
}

const SAFE_URL = /^(\/uploads\/[\w.-]+|https:\/\/[^\s<>"']+)$/i;
const META_KEYS = ['lessonFrom', 'lessonTo', 'part', 'pageMap'];

function cleanMaterial(body, existing = {}) {
    const language = body.language ?? existing.language;
    if (!LANGS.has(language)) throw error(400, "Til noto'g'ri");
    const lessonNo = body.lessonNo === undefined ? existing.lessonNo
        : body.lessonNo === null || body.lessonNo === '' ? null : Number(body.lessonNo);
    const kind = String(body.kind ?? existing.kind ?? '');
    if (lessonNo === null || lessonNo === undefined) {
        if (!COURSE_KINDS[kind]) throw error(400, "Kurs materiali turi noto'g'ri");
    } else {
        if (!Number.isInteger(lessonNo) || lessonNo < 1 || lessonNo > TOTAL_LESSONS) throw error(400, "Dars raqami 1–72 bo'lishi kerak");
        if (!LESSON_KINDS[kind]) throw error(400, "Material turi noto'g'ri");
    }
    const title = String(body.title ?? existing.title ?? '').trim().slice(0, 200);
    if (!title) throw error(400, 'Nomini kiriting');
    const url = String(body.url ?? existing.url ?? '').trim();
    if (!SAFE_URL.test(url) || url.length > 2000) throw error(400, "Havola /uploads/... yoki https:// bilan boshlanishi kerak");
    const rawMeta = { ...(existing.meta || {}), ...(body.meta && typeof body.meta === 'object' ? body.meta : {}) };
    const meta = {};
    for (const key of META_KEYS) if (rawMeta[key] !== undefined) meta[key] = rawMeta[key];
    // Kitob va ustoz qo'llanmalarida — har dars boshlanadigan sahifa.
    if (COURSE_KINDS[kind]) meta.pageMap = cleanPageMap(meta.pageMap);
    else delete meta.pageMap;
    for (const key of ['lessonFrom', 'lessonTo', 'part']) {
        if (meta[key] === undefined || meta[key] === '' || meta[key] === null) { delete meta[key]; continue; }
        const v = Number(meta[key]);
        if (!Number.isInteger(v) || v < 1 || v > TOTAL_LESSONS) throw error(400, "Dars oralig'i 1–72 bo'lishi kerak");
        meta[key] = v;
    }
    if (meta.lessonFrom && meta.lessonTo && meta.lessonFrom > meta.lessonTo) throw error(400, "Dars oralig'i noto'g'ri");
    return {
        language, lessonNo: lessonNo ?? null, kind, title, url,
        fileName: String(body.fileName ?? existing.fileName ?? '').slice(0, 255),
        fileSize: Math.max(0, Math.min(Number(body.fileSize ?? existing.fileSize) || 0, 1e10)),
        mime: String(body.mime ?? existing.mime ?? '').slice(0, 120),
        note: String(body.note ?? existing.note ?? '').slice(0, 2000),
        meta, sort: Number.isInteger(Number(body.sort)) ? Number(body.sort) : (existing.sort || 0),
    };
}

// "1:5, 2:9" yoki {1:5} → {"1":5,"2":9}. Kitobdagi har darsning boshlanish sahifasi.
function cleanPageMap(raw) {
    const out = {};
    const entries = typeof raw === 'string'
        ? raw.split(/[,;\n]+/).map(x => x.split(/[:=\-–]/).map(s => s.trim()))
        : Object.entries(raw || {});
    for (const [k, v] of entries) {
        const no = Number(k), page = Number(v);
        if (Number.isInteger(no) && no >= 1 && no <= TOTAL_LESSONS && Number.isInteger(page) && page >= 1 && page <= 5000) out[no] = page;
    }
    return out;
}

async function saveMaterial(pool, actor, id, body) {
    const access = await resolveAccess(pool, actor);
    if (!access.canEdit) throw error(403, "Materiallarni faqat admin yoki boshliq qo'sha oladi");
    let existing = null;
    if (id) {
        const { rows } = await pool.query('SELECT * FROM academic_materials WHERE id=$1 AND NOT archived', [id]);
        if (!rows[0]) throw error(404, 'Material topilmadi');
        existing = materialRow(rows[0]);
    }
    const m = cleanMaterial(body || {}, existing || {});
    if (existing) {
        const { rows } = await pool.query(`UPDATE academic_materials SET language=$2, lesson_no=$3, kind=$4, title=$5,
            url=$6, file_name=$7, file_size=$8, mime=$9, note=$10, meta=$11, sort=$12, updated_by=$13, updated_at=NOW()
            WHERE id=$1 RETURNING *`, [id, m.language, m.lessonNo, m.kind, m.title, m.url, m.fileName, m.fileSize,
            m.mime, m.note, JSON.stringify(m.meta), m.sort, actor.id]);
        return materialRow(rows[0]);
    }
    const { rows } = await pool.query(`INSERT INTO academic_materials (id, language, lesson_no, kind, title, url,
        file_name, file_size, mime, note, meta, sort, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) RETURNING *`,
    ['am-' + randomUUID(), m.language, m.lessonNo, m.kind, m.title, m.url, m.fileName, m.fileSize, m.mime,
        m.note, JSON.stringify(m.meta), m.sort, actor.id]);
    return materialRow(rows[0]);
}

// O'chirish — arxivlash: fayl va yozuv saqlanadi, kerak bo'lsa tiklanadi.
async function archiveMaterial(pool, actor, id) {
    const access = await resolveAccess(pool, actor);
    if (!access.canEdit) throw error(403, "Materiallarni faqat admin yoki boshliq o'chira oladi");
    const { rows } = await pool.query(`UPDATE academic_materials SET archived=TRUE, updated_by=$2, updated_at=NOW()
        WHERE id=$1 AND NOT archived RETURNING id`, [id, actor.id]);
    if (!rows[0]) throw error(404, 'Material topilmadi');
    return { ok: true };
}

// ─── Darslik markazi: 72 dars ───────────────────────────────────────────────
async function getHub(pool, actor, { lang: requested, courseId } = {}) {
    const access = await resolveAccess(pool, actor);
    const lang = pickLang(access, requested);
    const mc = await loadMobileContent(pool);
    const course = pickCourse(mc, lang, courseId);
    const lessons = courseLessons(mc, course);
    const ru = lang === 'russian' ? loadRussianSource() : {};
    const materials = await listMaterials(pool, lang);
    const byLesson = {};
    for (const m of materials) if (m.lessonNo) (byLesson[m.lessonNo] ||= []).push(m.kind);
    const syllabus = [];
    for (let i = 0; i < TOTAL_LESSONS; i++) {
        const meta = lessonMeta(mc, lang, lessons, i, ru);
        meta.materials = [...new Set(byLesson[meta.no] || [])];
        syllabus.push(meta);
    }
    // Qaysi darsda nechta o'quvchi turibdi (har o'quvchi o'z kursi bo'yicha).
    const students = await accessibleStudents(pool, access, lang);
    const progress = await loadProgress(pool, students.map(s => s.id));
    const reachedBy = {};
    for (const s of students) {
        const reached = reachedLesson(progress[s.id] || {}, idToNoMap(studentCourseLessons(mc, s)));
        if (reached) reachedBy[reached] = (reachedBy[reached] || 0) + 1;
    }
    syllabus.forEach(l => { l.studentsHere = reachedBy[l.no] || 0; });
    const oral = loadOralExams(lang);
    return {
        lang, canEdit: access.canEdit, role: access.role, lockedLang: !!access.lang,
        course: course ? { id: course.id, name: course.name } : null,
        courses: coursesFor(mc, lang).map(c => ({ id: c.id, name: c.name })),
        kinds: { lesson: LESSON_KINDS, course: COURSE_KINDS },
        rules: { passPercent: PASS_PERCENT, unlockPercent: UNLOCK_PERCENT, liveAutoUnlock: RULES.LIVE_AUTO_UNLOCK,
            examInterval: RULES.EXAM_INTERVAL, examPassPercent: RULES.EXAM_PASS_PERCENT, lessonsPerWeek: LESSONS_PER_WEEK },
        syllabus,
        courseMaterials: materials.filter(m => m.lessonNo === null),
        groups: [...new Set(students.map(s => s.group).filter(Boolean))].sort(),
        studentCount: students.length,
        defaultDuration: mostCommon(students.map(s => s.lessonDuration).filter(Boolean)) || 60,
        oralExams: oral,
    };
}

function mostCommon(arr) {
    const c = {};
    let best = null;
    for (const v of arr) { c[v] = (c[v] || 0) + 1; if (best === null || c[v] > c[best]) best = v; }
    return best === null ? null : Number(best);
}

async function getLesson(pool, actor, { lang: requested, no, courseId } = {}) {
    const access = await resolveAccess(pool, actor);
    const lang = pickLang(access, requested);
    const n = Number(no);
    if (!Number.isInteger(n) || n < 1 || n > TOTAL_LESSONS) throw error(400, "Dars raqami 1–72 bo'lishi kerak");
    const mc = await loadMobileContent(pool);
    const course = pickCourse(mc, lang, courseId);
    const lessons = courseLessons(mc, course);
    const ru = lang === 'russian' ? loadRussianSource() : {};
    const meta = lessonMeta(mc, lang, lessons, n - 1, ru);
    const content = (meta.id && mc.lessonContents[meta.id]) || {};
    const src = ru[n] || {};
    const prevSrc = ru[n - 1] || {};
    const prevMeta = n > 1 ? lessonMeta(mc, lang, lessons, n - 2, ru) : null;
    const vocabulary = (content.vocabulary || []).length ? content.vocabulary.map(v => ({
        word: v.english, translation: v.translation, transcript: v.transcript || '',
        example: v.exampleSentence || '', imageUrl: v.imageUrl || '', icon: v.icon || '',
    })) : (src.vocab || []).map(v => ({
        word: v.ru, translation: v.uz, transcript: v.tr || '', example: v.ex || '',
        imageUrl: v.media ? '/' + v.media : '', icon: v.icon || '',
    }));
    const lesson = {
        ...meta,
        titleRu: src.title_ru || '',
        videoUrl: content.videoUrl || src.videoUrl || '',
        konspekt: content.konspekt || src.konspekt || '',
        review: (src.review || []).map(r => ({ q: r.q, a: r.a || '' })),
        vocabulary,
        slides: (content.slides || []).map(s => ({ id: s.id, title: s.title || '', body: s.body || '', imageUrl: s.imageUrl || '' })),
        audioDialogs: (content.audioDialogs || []).map(d => ({
            id: d.id, title: d.title, audioUrl: d.audioUrl, coverUrl: d.coverUrl || '',
            durationSec: d.durationSec || 0, bookPart: d.bookPart || null, trackNo: d.trackNo || null,
            lines: (d.lines || []).map(l => ({ speaker: l.speaker || '', ru: l.ru || '', uz: l.uz || '' })),
        })),
        dialog: src.dialog?.lines ? { title: src.dialog.title || '', lines: src.dialog.lines.map(l => ({ speaker: l.who || '', ru: l.ru, uz: l.uz })) } : null,
        text: src.text ? { title: src.text.title || '', ru: src.text.ru || '', uz: src.text.uz || '', questions: src.text.questions || [] } : null,
        speaking: (content.speakingPractice || []).length
            ? content.speakingPractice.map(s => ({ ru: s.sentence, uz: s.translation }))
            : (src.speaking || []).map(s => ({ ru: s.ru, uz: s.uz })),
        homework: (content.homeworkParts || []).map(p => ({
            id: p.id, kind: p.kind, title: p.title || '', teacherGraded: TEACHER_GRADED.has(p.kind),
            questions: partQuestionCount(p), preview: partPreview(p),
        })),
    };
    lesson.plan = buildTeacherPlan(lesson, {
        lang, prevReview: prevSrc.review || [], prevVocab: (prevSrc.vocab || []).slice(0, 6).map(v => v.ru),
        prevName: prevMeta?.name || '',
    });
    const all = await listMaterials(pool, lang);
    const materials = all.filter(m => m.lessonNo === n);
    const book = bookPageFor(all.filter(m => m.kind === 'book'), n);
    const students = await accessibleStudents(pool, access, lang);
    const classStats = await lessonClassStats(pool, mc, students, n);
    // Teacher's book va boshqa qo'llanmalarning shu darsga tegishli sahifasi.
    const guides = all.filter(m => (m.kind === 'teacher_book' || m.kind === 'methodology') && m.meta.pageMap?.[n])
        .map(m => ({ id: m.id, title: m.title, url: m.url, kind: m.kind, page: m.meta.pageMap[n] }));
    return { lang, canEdit: access.canEdit, lesson, materials, book, guides, classStats };
}

function partPreview(p) {
    const strip = s => String(s ?? '').slice(0, 300);
    switch (p.kind) {
        case 'matching': return (p.pairs || []).slice(0, 40).map(x => ({ q: strip(x.left ?? x[0] ?? x.ru), a: strip(x.right ?? x[1] ?? x.uz) }));
        case 'fillBlank': return (p.blanks || []).slice(0, 40).map(x => ({ q: strip(x.sentence), a: strip(x.answer), options: (x.options || []).map(strip) }));
        case 'multipleChoice': return (p.questions || []).slice(0, 40).map(x => ({ q: strip(x.question), a: strip((x.options || [])[x.correctIndex]), options: (x.options || []).map(strip) }));
        case 'sentenceBuild': return (p.items || []).slice(0, 40).map(x => ({ q: strip(x.translation), a: strip(Array.isArray(x.answer) ? x.answer.join(' ') : x.answer) }));
        case 'reading': return [
            ...(p.paragraph?.russianText ? [{ q: strip(p.paragraph.russianText), a: strip(p.paragraph.uzbekText || '') }] : []),
            ...(p.sentences || []).slice(0, 40).map(x => ({ q: strip(x.russianText), a: '' })),
        ];
        case 'record': return (p.prompts || []).slice(0, 40).map(x => ({ q: strip(x.sentence), a: strip(x.translation) }));
        case 'roleplay': return p.scenario ? [{ q: strip(p.scenario.title || p.scenario.intro), a: '' }] : [];
        case 'creative': return p.instruction ? [{ q: strip(p.instruction), a: '' }] : [];
        default: return [];
    }
}

function bookPageFor(books, no) {
    for (const b of books) {
        const from = b.meta.lessonFrom || 1, to = b.meta.lessonTo || TOTAL_LESSONS;
        if (no < from || no > to) continue;
        const page = b.meta.pageMap?.[no] || null;
        return { id: b.id, title: b.title, url: b.url, page };
    }
    return null;
}

// ─── Ustoz uchun dars rejasi (metodik shablon) ──────────────────────────────
// Jonli dars — PPP + TBL aralash: takrorlash → leksika → kirish (dialog) →
// grammatika (CCQ bilan) → nazoratli mashq → erkin gapirish → kechiktirilgan
// xato tuzatish va yakun. 20 daqiqagacha bo'lgan individual dars uchun
// alohida qisqa shablon. Ulushlar foizda — daqiqalar mijozda hisoblanadi.
const ANTICIPATED = {
    russian: [
        "Urg'u: o'quvchi so'zni harfma-harf o'qiydi — urg'uni ko'rsating, «o» urg'usiz [a] o'qilishini eslating",
        "Jins (он/она́/оно́) va sifat qo'shimchalari — o'zbek tilida jins yo'q, shuning uchun eng ko'p xato shu yerda",
        "Kelishik qo'shimchalari — qoidani jadval bilan emas, tayyor iboralar bilan bering (в Ташке́нте, у меня́)",
        "ы / и, щ / ш, ь — talaffuzni ko'zgu oldida takrorlatish",
    ],
    english: [
        "Artikllar (a/an/the) — o'zbek tilida yo'q, iboralar ichida o'rgating",
        "Fe'l zamonlari va to be — «I am work» kabi xatolarni oldindan tuzating",
        "th, w/v, qisqa-uzun unlilar talaffuzi",
        "So'z tartibi (SVO) va savol gap tuzish",
    ],
};

const DIFFERENTIATION = {
    russian: [
        "Tez o'quvchi: rolli o'yinda qo'shimcha shart bering (masalan, 2 ta savolni o'zi qo'shsin)",
        "Qiynalayotgan o'quvchi: tayyor gap qoliplari bering (Я живу́ в… / Я люблю́…) va avval yozib, keyin aytsin",
    ],
    english: [
        "Tez o'quvchi: rolli o'yinda qo'shimcha shart bering (masalan, 2 ta savolni o'zi qo'shsin)",
        "Qiynalayotgan o'quvchi: tayyor gap qoliplari bering (I live in… / I like…) va avval yozib, keyin aytsin",
    ],
};

function konspektRules(konspekt) {
    const lines = String(konspekt || '').split('\n').map(s => s.trim()).filter(s => s && s !== '---');
    const isTitle = s => /^\d+\s*-\s*DARS\b/i.test(s) || /^bu darsdan keyin/i.test(s) || /^bugun\b/i.test(s);
    const bullets = lines.filter(s => /^[*•]|^- /.test(s)).map(s => s.replace(/^[*•\-]\s*/, ''));
    if (bullets.length) return bullets.slice(0, 5);
    const headings = lines.filter(s => /^\d+[.)]\s+\S/.test(s) && !isTitle(s));
    if (headings.length) return headings.slice(0, 5);
    const rules = lines.filter(s => !isTitle(s) && /\s[—–]\s/.test(s));
    return rules.slice(0, 5);
}

function buildTeacherPlan(lesson, ctx = {}) {
    const short = (arr, n = 8) => arr.slice(0, n);
    const words = lesson.vocabulary.map(v => stripStress(v.word));
    const goal = lesson.cando || `${stripStress(lesson.name)} mavzusini o'zlashtirish`;
    const dialogTitle = lesson.audioDialogs[0]?.title || lesson.dialog?.title || lesson.text?.title || '';
    const rules = konspektRules(lesson.konspekt);
    const speaking = short(lesson.speaking.map(s => stripStress(s.ru)), 8);
    const autoParts = lesson.homework.filter(h => !h.teacherGraded);
    const gradedParts = lesson.homework.filter(h => h.teacherGraded);
    const anticipated = ANTICIPATED[ctx.lang === 'russian' ? 'russian' : 'english'];
    if (lesson.type === 'video') {
        return {
            mode: 'video', goal,
            summary: "Videodars — o'quvchi ilovada mustaqil o'rganadi. Ustozning ishi: dars oldidan tayyorlash, kuzatish va keyingi jonli darsda mustahkamlash.",
            blocks: [
                { key: 'student', when: "O'quvchi ilovada", title: "Videodars, so'zlar va uy vazifasi",
                    items: [lesson.videoUrl ? 'Videodarsni ko\'radi' : "Video yo'q — slaydlar va konspekt orqali o'rganadi",
                        lesson.slides.length ? `${lesson.slides.length} ta slayd` : '',
                        words.length ? `${words.length} ta yangi so'z: ro'yxat + mashq` : '',
                        ...autoParts.map(h => `${h.title || h.kind} — ${h.questions} ta savol (avtomatik tekshiriladi)`)].filter(Boolean),
                    tip: `Har qism ${PASS_PERCENT}% dan yuqori bajarilsa o'tadi. Keyingi jonli dars bu dars kamida ${UNLOCK_PERCENT}% bajarilganda yoki davomat belgilanganda ochiladi.` },
                { key: 'before', when: 'Ustoz · dars kuni', title: 'Kuzatish va eslatma',
                    items: [`"O'quvchilar" yorlig'ida ${UNLOCK_PERCENT}% ga yetmaganlarni ko'ring va eslatma yozing`,
                        "Eng ko'p xato qilingan savollarni yozib oling — jonli darsda 3–5 daqiqa ajrating",
                        ...gradedParts.map(h => `${h.title || 'Ijodiy vazifa'}ni baholang`)],
                    tip: "Faol bo'lmagan o'quvchiga shaxsiy xabar umumiy guruh xabaridan samaraliroq." },
                { key: 'after', when: 'Keyingi jonli darsda', title: 'Mustahkamlash',
                    items: [...short(words, 5).map(w => `So'rang: ${w}`), ...(rules.length ? [`Qoidani 1 savol bilan tekshiring: ${rules[0]}`] : [])],
                    tip: "Video ko'rmaganlar uchun prezentatsiyada ilovadagi slaydlarni 2–3 daqiqada tez o'tib chiqing." },
            ],
            checklist: ['Videodars/slaydlar ilovada ochilishini tekshirish', `${UNLOCK_PERCENT}% ga yetmaganlarga eslatma`, "Xatolar ro'yxatini keyingi jonli darsga olib o'tish"],
        };
    }
    const review = ctx.prevReview?.length ? ctx.prevReview.map(r => r.q) : short(ctx.prevVocab || [], 6);
    const reviewItems = short(review, 5).length ? short(review, 5) : [`${stripStress(ctx.prevName) || "O'tgan dars"} bo'yicha 3–4 savol`];
    const ccq = rules.length ? [`Tushunishni tekshirish (CCQ): "${rules[0]}" — 2 ta ha/yo'q savol bering`] : ['Tushunishni tekshirish (CCQ): qoida bo\'yicha 2 ta ha/yo\'q savol'];
    return {
        mode: 'live', goal,
        summary: `Jonli dars. Maqsad: ${goal}`,
        blocks: [
            { key: 'warmup', title: "Salomlashish va o'tgan darsni takrorlash", share: 8, min: 3, items: reviewItems,
                tip: "Har o'quvchiga kamida bitta savol. Oldingi darsni bajarmaganlar ro'yxati sahifaning yuqorisida." },
            { key: 'vocab', title: "Yangi so'zlar", share: 12, min: 3, items: short(words, 12),
                tip: "Kartochka rejimi: ko'rsatish → xor bilan takrorlash → tarjimasini so'rash (T tugmasi) → gapda ishlatish." },
            { key: 'dialog', title: dialogTitle ? `Kirish: ${dialogTitle}` : 'Kirish: dialog yoki matn', share: 15, min: 3,
                items: [lesson.audioDialogs.length ? `${lesson.audioDialogs.length} ta audio dialog` : '',
                    lesson.dialog ? `Kitob dialogi — ${lesson.dialog.lines.length} replika` : '', lesson.text ? "O'qish matni va savollar" : ''].filter(Boolean),
                tip: "1) matnsiz tinglash va umumiy savol, 2) matn bilan tinglash, 3) rollarga bo'lib o'qish." },
            { key: 'grammar', title: 'Grammatika (qoidani kashf qilish)', share: 15, min: 3,
                items: [...(rules.length ? rules : ["Konspektdagi qoidani dialogdagi misollar orqali chiqarib oling"]), ...ccq],
                tip: "Qoidani o'zingiz aytmang — dialogdan 2–3 misol yozing va o'quvchidan naqshni topishni so'rang." },
            { key: 'controlled', title: 'Nazoratli mashq', share: 15, min: 3,
                items: [...autoParts.slice(0, 2).map(h => `${h.title || h.kind} turidagi 3–4 savolni og'zaki`), 'Doskada: bo\'sh joyni to\'ldirish / gap tuzish'],
                tip: "Har bir to'g'ri javobdan keyin «Nega?» deb so'rang — taxmin emas, qoida ishlatilsin." },
            { key: 'speaking', title: 'Erkin gapirish (rolli o\'yin)', share: 25, min: 4,
                items: speaking.length ? speaking : ["Mavzu bo'yicha savol-javob va rolli o'yin"],
                tip: "O'quvchi kamida 70% vaqt gapirsin. Xatolarni to'xtatmasdan yozib boring — keyingi blokda tuzatasiz." },
            { key: 'wrapup', title: 'Xatolar ustida ishlash va yakun', share: 10, min: 4,
                items: ["Yozib olingan 3–5 xatoni doskada birga tuzatish", `Maqsadni tekshirish: «${goal}»`, ...lesson.homework.slice(0, 3).map(h => `Ilovada: ${h.title || h.kind}`)],
                tip: "Darsdan keyin darhol «Davomat» yorlig'ida belgilang — davomat keyingi darsni ilovada ochadi." },
        ],
        mediumBlocks: [
            { key: 'warmup', title: "Takrorlash va uy vazifasini tekshirish", share: 12, min: 3, items: reviewItems.slice(0, 4),
                tip: "Har o'quvchiga bitta savol; ilovadagi xatolaridan 1 tasini so'rang." },
            { key: 'vocab', title: "Yangi so'zlar", share: 15, min: 3, items: short(words, 10),
                tip: "Kartochka rejimi: ko'rsatish → takrorlash → tarjima (T)." },
            { key: 'input', title: dialogTitle ? `Dialog va qoida: ${dialogTitle}` : 'Dialog va qoida', share: 28, min: 6,
                items: [...(rules.length ? rules.slice(0, 3) : ['Konspektdagi qoidani dialog misollari bilan']), ...ccq],
                tip: "Dialogni tinglang, undan qoidani o'quvchi topsin, so'ng 2–3 ta og'zaki mashq." },
            { key: 'speaking', title: "Gapirish (rolli o'yin)", share: 30, min: 6, items: speaking.length ? speaking.slice(0, 6) : ["Mavzu bo'yicha savol-javob"],
                tip: "Xatolarni to'xtatmasdan yozib boring." },
            { key: 'wrapup', title: 'Xatolar ustida ishlash va yakun', share: 15, min: 4,
                items: ["Yozib olingan 2–3 xatoni birga tuzatish", ...lesson.homework.slice(0, 2).map(h => `Ilovada: ${h.title || h.kind}`)],
                tip: "Darsdan keyin darhol «Davomat» yorlig'ida belgilang." },
        ],
        shortBlocks: [
            { key: 'warmup', title: "Takrorlash va uy vazifasini tekshirish", share: 20, min: 3, items: reviewItems.slice(0, 3),
                tip: "Ilovadagi xatolaridan 1–2 tasini so'rang (O'quvchilar yorlig'ida)." },
            { key: 'speaking', title: "Asosiy qism: gapirish amaliyoti", share: 60, min: 6,
                items: [...(speaking.length ? speaking.slice(0, 5) : ["Mavzu bo'yicha savol-javob"]), ...(rules.length ? [`Qoida: ${rules[0]}`] : [])],
                tip: "Individual darsda o'quvchi 80% gapirsin. Yangi so'zlarni savollar ichida ishlating." },
            { key: 'wrapup', title: 'Xatolar va uy vazifasi', share: 20, min: 3,
                items: ['2–3 asosiy xatoni tuzatish', ...lesson.homework.slice(0, 2).map(h => `Ilovada: ${h.title || h.kind}`)],
                tip: "Darsdan keyin darhol «Davomat» yorlig'ida belgilang." },
        ],
        anticipated,
        differentiation: DIFFERENTIATION[ctx.lang === 'russian' ? 'russian' : 'english'],
        checklist: ['Slaydlar va doskani oldindan ochib qo\'yish', 'Audio dialogni tekshirish (ovoz)', "Oldingi darsni bajarmaganlar ro'yxatini ko'rish", 'Darsdan keyin davomatni belgilash'],
    };
}

// Daqiqalarni taqsimlash — umumiy algoritm js/academicRules.js'da (mijoz bilan bir xil).
const allocateMinutes = RULES.allocateMinutes;

// ─── O'quvchi progressi ─────────────────────────────────────────────────────
async function loadProgress(pool, ids) {
    if (!ids.length) return {};
    const { rows } = await pool.query('SELECT student_id, data FROM student_lesson_progress WHERE student_id = ANY($1::text[])', [ids]);
    return Object.fromEntries(rows.map(r => [r.student_id, r.data || {}]));
}

// student-app/components/v2/lessons/data.ts lessonPercent bilan bir xil.
function lessonPercent(progress, isVideo, totalParts) {
    const p = progress || {};
    const watch = isVideo ? (p.videoWatch ? 100 : 0) : (p.slidesWatch ? 100 : 0);
    const vocab = Math.round(([p.vocabList, p.vocabPractice].filter(v => v === true).length / 2) * 100);
    const done = Object.values(p.homeworkParts || {}).filter(v => v === true).length;
    const hw = totalParts ? Math.round((Math.min(done, totalParts) / totalParts) * 100) : 0;
    return Math.round((watch + vocab + hw) / 3);
}

function hasAnyProgress(p) {
    return !!p && (p.videoWatch || p.slidesWatch || p.vocabList || p.vocabPractice
        || Object.values(p.homeworkParts || {}).some(Boolean));
}

const idToNoMap = lessons => Object.fromEntries(lessons.map((l, i) => [l.id, i + 1]));

function reachedLesson(progress, idToNo) {
    let max = 0;
    for (const [id, p] of Object.entries(progress)) if (idToNo[id] && hasAnyProgress(p)) max = Math.max(max, idToNo[id]);
    return max;
}

function expectedLesson(startDate, now = new Date()) {
    const start = startDate ? new Date(startDate) : null;
    if (!start || Number.isNaN(start.getTime()) || start > now) return null;
    const weeks = (now - start) / (7 * 86400000);
    return Math.max(1, Math.min(TOTAL_LESSONS, Math.floor(weeks * LESSONS_PER_WEEK) + 1));
}

async function loadTime(pool, ids, sinceDays) {
    if (!ids.length) return [];
    const since = shiftDay(tzDay(), -(sinceDays - 1));
    const { rows } = await pool.query(`SELECT student_id, day::text AS day, lesson_id, section, seconds
        FROM student_learning_time WHERE student_id = ANY($1::text[]) AND day >= $2::date`, [ids, since]);
    return rows.map(r => ({ ...r, seconds: Number(r.seconds) || 0 }));
}

async function loadTotals(pool, ids) {
    if (!ids.length) return {};
    const { rows } = await pool.query(`SELECT student_id, SUM(seconds)::bigint AS total, MIN(day)::text AS since,
        MAX(updated_at) AS last_at FROM student_learning_time WHERE student_id = ANY($1::text[]) GROUP BY student_id`, [ids]);
    return Object.fromEntries(rows.map(r => [r.student_id, { total: Number(r.total) || 0, since: r.since, lastAt: r.last_at }]));
}

async function loadParts(pool, ids) {
    if (!ids.length) return [];
    const { rows } = await pool.query(`SELECT student_id, lesson_id, part_id, kind, title, correct, total, first_percent,
        last_percent, best_percent, attempts, passed, mistakes, updated_at FROM student_part_results WHERE student_id = ANY($1::text[])`, [ids]);
    return rows;
}

async function loadLastSeen(pool, ids) {
    if (!ids.length) return {};
    const { rows } = await pool.query(`SELECT user_id, MAX(last_seen) AS last_seen FROM sessions
        WHERE user_id = ANY($1::text[]) GROUP BY user_id`, [ids]);
    return Object.fromEntries(rows.map(r => [r.user_id, r.last_seen]));
}

const iso = d => (d ? new Date(d).toISOString() : null);
const maxDate = (...ds) => ds.filter(Boolean).map(d => new Date(d)).sort((a, b) => b - a)[0] || null;

function summarizeStudent(student, mc, progress, parts, timeRows, totals, lastSeen, now = new Date()) {
    const lessons = studentCourseLessons(mc, student);
    const perLesson = lessons.map((l, i) => {
        const content = mc.lessonContents[l.id] || {};
        const totalParts = (content.homeworkParts || []).length;
        return { no: i + 1, id: l.id, percent: lessonPercent(progress[l.id], i % 2 === 0, totalParts), started: hasAnyProgress(progress[l.id]) };
    });
    const reached = reachedLesson(progress, idToNoMap(lessons));
    const completed = perLesson.filter(l => l.percent >= 100).length;
    const started = perLesson.filter(l => l.started);
    const avgPercent = started.length ? Math.round(started.reduce((s, l) => s + l.percent, 0) / started.length) : 0;
    const graded = parts.filter(p => p.total > 0);
    const avg = key => (graded.length ? Math.round(graded.reduce((s, p) => s + (Number(p[key]) || 0), 0) / graded.length) : null);
    const homeworkAvg = avg('best_percent');
    const firstTryAvg = avg('first_percent');
    const avgAttempts = graded.length ? Math.round((graded.reduce((s, p) => s + (Number(p.attempts) || 0), 0) / graded.length) * 10) / 10 : null;
    const mistakes = parts.reduce((s, p) => s + (Array.isArray(p.mistakes) ? p.mistakes.length : 0), 0);
    const daySecs = {};
    for (const r of timeRows) daySecs[r.day] = (daySecs[r.day] || 0) + r.seconds;
    const today = tzDay(now);
    const sumDays = n => { let s = 0; for (let i = 0; i < n; i++) s += daySecs[shiftDay(today, -i)] || 0; return s; };
    const activeDays7 = Array.from({ length: 7 }, (_, i) => (daySecs[shiftDay(today, -i)] || 0) > 0).filter(Boolean).length;
    const lastActive = maxDate(lastSeen, totals?.lastAt, ...parts.map(p => p.updated_at));
    const daysIdle = lastActive ? Math.floor((now - lastActive) / 86400000) : null;
    const expected = student.frozen ? null : expectedLesson(student.startDate, now);
    const flags = [];
    if (student.frozen) flags.push({ key: 'frozen', label: 'Muzlatilgan' });
    else {
        if (daysIdle === null || daysIdle >= 3) flags.push({ key: 'idle', label: daysIdle === null ? "Ilovaga kirmagan" : `${daysIdle} kundan beri faol emas` });
        if ((firstTryAvg !== null && firstTryAvg < PASS_PERCENT) || (avgAttempts !== null && avgAttempts >= 2.5)) flags.push({ key: 'struggling', label: 'Uy vazifasida qiynalyapti' });
        if (expected && reached + LESSONS_PER_WEEK < expected) flags.push({ key: 'behind', label: `Rejadan orqada (${expected}-dars bo'lishi kerak)` });
    }
    return {
        id: student.id, name: student.name, group: student.group, role: student.role, frozen: student.frozen,
        reached, completed, avgPercent, homeworkAvg, firstTryAvg, avgAttempts, mistakes, expected,
        time: { today: sumDays(1), week: sumDays(7), month: sumDays(30), total: totals?.total || 0, since: totals?.since || null },
        activeDays7, lastActive: iso(lastActive), daysIdle, flags, perLesson,
    };
}

const groupBy = (rows, key = 'student_id') => rows.reduce((a, r) => ((a[r[key]] ||= []).push(r), a), {});

async function studentsOverview(pool, actor, { lang: requested } = {}) {
    const access = await resolveAccess(pool, actor);
    const lang = pickLang(access, requested);
    const students = await accessibleStudents(pool, access, lang);
    const ids = students.map(s => s.id);
    const [mc, progress, parts, timeRows, totals, lastSeen] = await Promise.all([
        loadMobileContent(pool), loadProgress(pool, ids), loadParts(pool, ids),
        loadTime(pool, ids, 30), loadTotals(pool, ids), loadLastSeen(pool, ids),
    ]);
    const partsBy = groupBy(parts), timeBy = groupBy(timeRows);
    const list = students.map(s => {
        const sum = summarizeStudent(s, mc, progress[s.id] || {}, partsBy[s.id] || [], timeBy[s.id] || [], totals[s.id], lastSeen[s.id]);
        delete sum.perLesson;
        return sum;
    });
    const trackingSince = Object.values(totals).map(t => t.since).filter(Boolean).sort()[0] || null;
    return { lang, students: list, trackingSince, generatedAt: new Date().toISOString() };
}

// Jadval bo'yicha kutilgan jonli darslar soni (db.getDemoStudentAttendanceStats
// bilan bir xil qoida: 1/3/5 yoki 2/4/6 kunlar; startDate'dan bugungacha).
function expectedLiveLessons(student, now = new Date()) {
    if (student.lessonDayOfWeek === null || student.lessonDayOfWeek === undefined || !student.lessonTime || !student.startDate) return null;
    const d = Number(student.lessonDayOfWeek);
    const days = [1, 3, 5].includes(d) ? [1, 3, 5] : [2, 4, 6].includes(d) ? [2, 4, 6] : [d];
    const start = new Date(`${String(student.startDate).slice(0, 10)}T12:00:00Z`);
    const todayKey = tzDay(now);
    // Bugungi dars hali vaqti kelmagan bo'lsa hisobga kirmaydi (Toshkent vaqti).
    const nowHm = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    const m = String(student.lessonTime).match(/(\d{1,2})[:.](\d{2})/);
    const lessonHm = m ? `${m[1].padStart(2, '0')}:${m[2]}` : '00:00';
    const end = new Date(`${todayKey}T12:00:00Z`);
    if (Number.isNaN(start.getTime()) || start > end) return null;
    let n = 0;
    for (const c = new Date(start); c <= end && n < 4000; c.setUTCDate(c.getUTCDate() + 1)) {
        if (!days.includes(c.getUTCDay())) continue;
        if (c.toISOString().slice(0, 10) === todayKey && nowHm < lessonHm) continue;
        n++;
    }
    return Math.min(n, Math.ceil(TOTAL_LESSONS / 2));
}

async function loadAttendance(pool, studentId) {
    const q = table => pool.query(`SELECT att_key, day, present FROM ${table} WHERE student_id=$1`, [studentId])
        .then(r => r.rows).catch(() => []);
    const [main, assistant] = await Promise.all([q('main_attendance'), q('assistant_attendance')]);
    const toRow = kind => r => ({ date: `${String(r.att_key).slice(0, 7)}-${String(r.day).padStart(2, '0')}`, present: Number(r.present) === 1 || r.present === true, kind });
    return [...main.map(toRow('main')), ...assistant.map(toRow('assistant'))]
        .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
}

async function loadStudentJson(pool, key, studentId) {
    const { rows } = await pool.query('SELECT data -> $2 AS v FROM json_data WHERE key=$1', [key, studentId]);
    return Array.isArray(rows[0]?.v) ? rows[0].v : [];
}

async function studentDetail(pool, actor, studentId) {
    const access = await resolveAccess(pool, actor);
    const { student } = await assertStudentAccess(pool, access, String(studentId || ''));
    const ids = [student.id];
    const [mc, progress, parts, timeRows, totals, lastSeen, activity, grades, attendance, lessonTime] = await Promise.all([
        loadMobileContent(pool), loadProgress(pool, ids), loadParts(pool, ids),
        loadTime(pool, ids, 60), loadTotals(pool, ids), loadLastSeen(pool, ids),
        loadStudentJson(pool, 'studentActivity', student.id), loadStudentJson(pool, 'liveGrades', student.id),
        loadAttendance(pool, student.id),
        pool.query(`SELECT lesson_id, SUM(seconds)::bigint AS s FROM student_learning_time WHERE student_id=$1 AND lesson_id<>'' GROUP BY lesson_id`, [student.id]).then(r => r.rows),
    ]);
    const summary = summarizeStudent(student, mc, progress[student.id] || {}, parts, timeRows, totals[student.id], lastSeen[student.id]);
    const lessons = studentCourseLessons(mc, student);
    const idToNo = idToNoMap(lessons);
    const p = progress[student.id] || {};
    const timeByLesson = Object.fromEntries(lessonTime.map(r => [r.lesson_id, Number(r.s) || 0]));
    const timeBySection = {}, timeByDay = {};
    for (const r of timeRows) {
        const sec = r.section || 'boshqa';
        timeBySection[sec] = (timeBySection[sec] || 0) + r.seconds;
        timeByDay[r.day] = (timeByDay[r.day] || 0) + r.seconds;
    }
    const partsByLesson = groupBy(parts, 'lesson_id');
    const gradesByLesson = groupBy(grades.filter(g => g && g.lessonId), 'lessonId');
    const perLesson = summary.perLesson.map(l => {
        const content = mc.lessonContents[l.id] || {};
        const lp = p[l.id] || {};
        const isVideo = l.no % 2 === 1;
        const results = (partsByLesson[l.id] || []).map(r => ({
            partId: r.part_id, kind: r.kind, title: r.title, correct: r.correct, total: r.total,
            firstPercent: r.first_percent, bestPercent: r.best_percent, lastPercent: r.last_percent, attempts: r.attempts, passed: r.passed,
            mistakes: (r.mistakes || []).slice(0, 30), updatedAt: iso(r.updated_at),
        }));
        return {
            ...l, name: lessons[l.no - 1]?.name || `${l.no}-dars`, type: isVideo ? 'video' : 'live',
            steps: {
                watch: isVideo ? !!lp.videoWatch : !!lp.slidesWatch,
                vocabList: !!lp.vocabList, vocabPractice: !!lp.vocabPractice,
                homeworkDone: Object.values(lp.homeworkParts || {}).filter(Boolean).length,
                homeworkTotal: (content.homeworkParts || []).length,
            },
            results, seconds: timeByLesson[l.id] || 0,
            grades: (gradesByLesson[l.id] || []).map(gradeRow),
        };
    });
    delete summary.perLesson;
    const acts = activity.slice(-50).reverse().map(a => ({ ...a, lessonNo: idToNo[String(a.label || '').split(' - ')[0]] || null }));
    // Nisbat faqat asosiy ustoz darslari bo'yicha (alohida sanalar) — maxraj ham
    // asosiy jadvaldan. Yordamchi ustoz mashg'ulotlari alohida sanaladi.
    const present = new Set(attendance.filter(a => a.present && a.kind === 'main').map(a => a.date)).size;
    const assistantPresent = new Set(attendance.filter(a => a.present && a.kind === 'assistant').map(a => a.date)).size;
    const expectedLive = student.frozen ? null : expectedLiveLessons(student);
    const examRows = await pool.query('SELECT exam_id, last_percent, best_percent, attempts, passed, mistakes, updated_at FROM student_exam_results WHERE student_id=$1 ORDER BY exam_id', [student.id]).then(r => r.rows);
    const days30 = Array.from({ length: 30 }, (_, i) => shiftDay(tzDay(), i - 29));
    return {
        student: { ...summary, startDate: student.startDate || null },
        lessons: perLesson,
        timeByDay, timeBySection, sectionPeriodDays: 60,
        activity: acts,
        exams: examRows.length ? examRows.map(e => ({ examId: e.exam_id, label: examLabel(e.exam_id), scorePercent: e.last_percent, bestPercent: e.best_percent,
            attempts: e.attempts, passed: e.passed, mistakes: (e.mistakes || []).slice(0, 40), time: iso(e.updated_at) })) : acts.filter(a => a.type === 'exam'),
        attendance: { rows: attendance, present, assistantPresent, expected: expectedLive,
            rate: expectedLive ? Math.min(100, Math.round((present / expectedLive) * 100)) : null },
        days30,
        grades: grades.slice(-30).reverse().map(g => ({ ...gradeRow(g), lessonNo: idToNo[g.lessonId] || null })),
    };
}

function examLabel(id) {
    return id === 'final' ? 'Yakuniy imtihon' : /^interval-(\d+)$/.test(id) ? `${id.split('-')[1]}-oraliq imtihon` : id;
}

function gradeRow(g) {
    const scores = g?.scores && typeof g.scores === 'object' ? g.scores : {};
    const vals = Object.values(scores).map(Number).filter(Number.isFinite);
    return { date: g?.date || '', lessonId: g?.lessonId || '', average: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null,
        scores, comment: String(g?.comment || '').slice(0, 300) };
}

// Bitta dars bo'yicha guruh holati (har o'quvchi o'z kursidagi N-dars bo'yicha).
async function lessonClassStats(pool, mc, students, n) {
    if (!students.length) return { students: [], topMistakes: [], prevHomeworkMissing: [] };
    const ids = students.map(s => s.id);
    const lessonFor = new Map(students.map(s => {
        const ls = studentCourseLessons(mc, s);
        return [s.id, { cur: ls[n - 1] || null, prev: ls[n - 2] || null, idToNo: idToNoMap(ls) }];
    }));
    const curIds = [...new Set([...lessonFor.values()].map(v => v.cur?.id).filter(Boolean))];
    const [progress, parts, time] = await Promise.all([
        loadProgress(pool, ids),
        curIds.length ? pool.query(`SELECT student_id, lesson_id, part_id, title, best_percent, first_percent, passed, mistakes FROM student_part_results
            WHERE student_id = ANY($1::text[]) AND lesson_id = ANY($2::text[])`, [ids, curIds]).then(r => r.rows) : [],
        curIds.length ? pool.query(`SELECT student_id, lesson_id, SUM(seconds)::bigint AS seconds FROM student_learning_time
            WHERE student_id = ANY($1::text[]) AND lesson_id = ANY($2::text[]) GROUP BY student_id, lesson_id`, [ids, curIds]).then(r => r.rows) : [],
    ]);
    const isVideo = n % 2 === 1;
    const mistakeCount = {};
    const rows = students.map(s => {
        const lf = lessonFor.get(s.id);
        const cur = lf.cur;
        const lp = cur ? progress[s.id]?.[cur.id] || {} : {};
        const totalParts = cur ? (mc.lessonContents[cur.id]?.homeworkParts || []).length : 0;
        const own = cur ? parts.filter(r => r.student_id === s.id && r.lesson_id === cur.id) : [];
        for (const r of own) for (const m of (r.mistakes || [])) {
            const key = String(m?.question || m || '').slice(0, 200);
            if (key) mistakeCount[key] = (mistakeCount[key] || 0) + (Number(m?.count) || 1);
        }
        const secs = cur ? time.filter(r => r.student_id === s.id && r.lesson_id === cur.id).reduce((a, r) => a + (Number(r.seconds) || 0), 0) : 0;
        return {
            id: s.id, name: s.name, group: s.group, frozen: s.frozen,
            reached: reachedLesson(progress[s.id] || {}, lf.idToNo),
            percent: cur ? lessonPercent(lp, isVideo, totalParts) : 0,
            watch: isVideo ? !!lp.videoWatch : !!lp.slidesWatch, vocab: !!lp.vocabList && !!lp.vocabPractice,
            homeworkDone: Object.values(lp.homeworkParts || {}).filter(Boolean).length, homeworkTotal: totalParts,
            bestPercent: own.length ? Math.round(own.reduce((x, r) => x + r.best_percent, 0) / own.length) : null,
            firstPercent: own.length ? Math.round(own.reduce((x, r) => x + r.first_percent, 0) / own.length) : null,
            mistakes: own.reduce((x, r) => x + (r.mistakes || []).length, 0), seconds: secs,
        };
    }).sort((a, b) => b.percent - a.percent);
    // Darsdan oldin: aynan shu darsga yetib kelayotganlar (oxirgi boshlagan darsi
    // N-2…N) orasidan oldingi darsni 50% dan kam bajarganlar.
    const prevHomeworkMissing = n > 1 ? rows.filter(r => !r.frozen && r.reached >= n - 2 && r.reached <= n).filter(r => {
        const lf = lessonFor.get(r.id);
        if (!lf.prev) return false;
        const totalParts = (mc.lessonContents[lf.prev.id]?.homeworkParts || []).length;
        return lessonPercent(progress[r.id]?.[lf.prev.id], (n - 1) % 2 === 1, totalParts) < UNLOCK_PERCENT;
    }).map(r => ({ id: r.id, name: r.name })) : [];
    return {
        students: rows,
        topMistakes: Object.entries(mistakeCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([question, count]) => ({ question, count })),
        prevHomeworkMissing,
    };
}

// ─── Ilovadan keladigan tracking ────────────────────────────────────────────
// Faqat o'quvchi tokeni bilan. Dars va qism ID'lari o'quvchining o'z kursidan
// tekshiriladi, savollar soni serverdagi kontentdan olinadi, vaqt bitta
// yuborishda va kunlik (8 soat) chegaralanadi, so'rovlar soni cheklanadi.
// Xotirada saqlanadi: server qayta ishga tushsa nolga qaytadi (bitta Railway
// nusxasi uchun yetarli; bir nechta nusxa bo'lsa — Redis'ga ko'chirish kerak).
const trackState = new Map(); // studentId → { windowStart, count, creditedUntil }
const RATE_PER_MIN = 20;

function rateCheck(studentId, now) {
    const st = trackState.get(studentId) || { windowStart: now, count: 0, creditedUntil: now - MAX_FLUSH_SECONDS * 1000 };
    if (now - st.windowStart > 60000) { st.windowStart = now; st.count = 0; }
    st.count++;
    trackState.set(studentId, st);
    if (trackState.size > 50000) trackState.clear();
    if (st.count > RATE_PER_MIN) throw error(429, "So'rovlar juda ko'p");
    return st;
}

function normalizeMistake(m) {
    if (typeof m === 'string') return { question: m.slice(0, 300), yourAnswer: '', correctAnswer: '' };
    return { question: String(m?.question || '').slice(0, 300), yourAnswer: String(m?.yourAnswer || '').slice(0, 200), correctAnswer: String(m?.correctAnswer || '').slice(0, 200) };
}

function mergeMistakes(previous, incoming, at) {
    const map = new Map();
    for (const m of Array.isArray(previous) ? previous : []) if (m?.question) map.set(m.question, { ...m, count: Number(m.count) || 1 });
    for (const m of incoming) {
        const old = map.get(m.question);
        map.set(m.question, { ...m, correctAnswer: m.correctAnswer || old?.correctAnswer || '', count: (old?.count || 0) + 1, lastAt: at });
    }
    return [...map.values()].sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || ''))).slice(0, 40);
}

// Bitta tranzaksiya (haqiqiy pg.Pool'da) — xatolar tarixini o'qib-yozishda
// parallel so'rovlar bir-birining natijasini yo'qotmasin.
async function withClient(pool, fn) {
    if (typeof pool.connect !== 'function') return fn(pool, '');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const out = await fn(client, ' FOR UPDATE');
        await client.query('COMMIT');
        return out;
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
    } finally { client.release(); }
}

function homeworkPartFor(mc, lessonId, partId, lang) {
    const byId = id => (mc.lessonContents[id]?.homeworkParts || []).find(x => x.id === partId);
    // Rus tilidagi bonus darslar "<id>-russian" kaliti ostida saqlanadi (db.resolveLangScopedContent).
    if (/^bonus-\d{1,3}$/.test(lessonId) && lang === 'russian') return byId(`${lessonId}-russian`);
    return byId(lessonId);
}

const EXAM_IDS = new Set([...Array.from({ length: TOTAL_LESSONS / RULES.EXAM_INTERVAL }, (_, i) => `interval-${i + 1}`), 'final']);
function examExists(mc, examId, lang) {
    if (!EXAM_IDS.has(examId)) return false;
    const store = mc.examContents || {};
    // Kontent kiritilmagan bo'lsa ilova standart savollarni ko'rsatadi — ID ro'yxati yetarli.
    if (!Object.keys(store).length) return true;
    return !!(lang === 'russian' ? store[`${examId}-russian`] || store[examId] : store[examId]);
}

async function recordTracking(pool, studentId, body = {}, now = new Date()) {
    if (!studentId) throw error(401, "O'quvchi avtorizatsiyasi talab qilinadi");
    const st = rateCheck(studentId, now.getTime());
    const time = Array.isArray(body.time) ? body.time.slice(0, 40) : [];
    const parts = Array.isArray(body.parts) ? body.parts.slice(0, 20) : [];
    const exams = Array.isArray(body.exams) ? body.exams.slice(0, 10) : [];
    const { rows: srows } = await pool.query("SELECT id, COALESCE(subject,'english') AS subject, COALESCE(extra_data,'{}'::jsonb) AS extra FROM students WHERE id=$1", [studentId]);
    if (!srows[0]) throw error(404, "O'quvchi topilmadi");
    const lang = srows[0].subject === 'russian' ? 'russian' : 'english';
    const mc = await loadMobileContent(pool);
    const lessons = studentCourseLessons(mc, { subject: lang, platformCourseId: srows[0].extra?.platformCourseId || '' });
    const lessonIds = new Set(lessons.map(l => l.id));
    const validLesson = id => lessonIds.has(id) || /^bonus-\d{1,3}$/.test(id);
    const today = tzDay(now);
    const earliest = shiftDay(today, -3);
    let skipped = 0, skippedSeconds = 0;

    // Vaqt: bir xil kalitlar jamlanadi, keyin bitta so'rov bilan yoziladi.
    const buckets = new Map();
    for (const t of time) {
        const seconds = Math.round(Number(t?.seconds));
        const day = String(t?.day || today).slice(0, 10);
        if (!Number.isFinite(seconds) || seconds <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day > shiftDay(today, 1) || day < earliest) { skipped++; continue; }
        let lessonId = String(t?.lessonId || '').slice(0, 160);
        if (lessonId && !validLesson(lessonId)) lessonId = '';
        let section = String(t?.section || '').toLowerCase();
        if (!RULES.SECTIONS[section]) section = 'boshqa';
        const d = day > today ? today : day;
        const key = `${d}|${lessonId}|${section}`;
        buckets.set(key, (buckets.get(key) || 0) + Math.min(seconds, 86400));
    }
    // Bugungi vaqt: haqiqatda o'tgan vaqtdan oshmaydi (creditedUntil — shu
    // o'quvchiga oxirgi hisoblangan lahza). Oldingi kunlar (oflayn navbat) —
    // faqat kunlik 8 soat chegarasi bilan.
    const nowMs = now.getTime();
    let todayBudget = Math.max(0, Math.min((nowMs - st.creditedUntil) / 1000, 86400));
    const days = [...new Set([...buckets.keys()].map(k => k.split('|')[0]))];
    const used = {};
    if (days.length) {
        const { rows } = await pool.query(`SELECT day::text AS day, COALESCE(SUM(seconds),0)::bigint AS s FROM student_learning_time
            WHERE student_id=$1 AND day = ANY($2::date[]) GROUP BY day`, [studentId, days]);
        for (const r of rows) used[r.day] = Number(r.s) || 0;
    }
    const left = Object.fromEntries(days.map(d => [d, Math.max(0, DAILY_CAP_SECONDS - (used[d] || 0))]));
    // Oflayn navbat: bitta so'rovda o'tgan kunlar uchun jami 4 soatdan oshmaydi.
    let backfillBudget = 4 * 3600;
    const values = [], params = [studentId];
    let creditedToday = 0;
    for (const [key, secs] of buckets) {
        const [day, lessonId, section] = key.split('|');
        let allowed = Math.min(secs, left[day]);
        if (day === today) allowed = Math.min(allowed, todayBudget);
        else allowed = Math.min(allowed, backfillBudget);
        allowed = Math.floor(allowed);
        skippedSeconds += secs - Math.max(0, allowed);
        if (allowed <= 0) continue;
        left[day] -= allowed;
        if (day === today) { todayBudget -= allowed; creditedToday += allowed; } else backfillBudget -= allowed;
        params.push(day, lessonId, section, allowed);
        const b = params.length;
        values.push(`($1, $${b - 3}::date, $${b - 2}, $${b - 1}, $${b}::int)`);
    }
    if (values.length) {
        await pool.query(`INSERT INTO student_learning_time (student_id, day, lesson_id, section, seconds) VALUES ${values.join(',')}
            ON CONFLICT (student_id, day, lesson_id, section)
            DO UPDATE SET seconds = LEAST(student_learning_time.seconds + EXCLUDED.seconds, 86400), updated_at = NOW()`, params);
    }
    st.creditedUntil = Math.min(nowMs, st.creditedUntil + creditedToday * 1000);

    let savedParts = 0;
    for (const p of parts) {
        const lessonId = String(p?.lessonId || '').slice(0, 160);
        const partId = String(p?.partId || '').slice(0, 160);
        const part = validLesson(lessonId) ? homeworkPartFor(mc, lessonId, partId, lang) : null;
        if (!part) { skipped++; continue; }
        const total = partQuestionCount(part) || 1;
        const correct = Math.max(0, Math.min(Math.round(Number(p?.correct) || 0), total));
        const percent = Math.round((correct / total) * 100);
        const answers = new Map(partPreview(part).map(x => [x.q, x.a]));
        const seen = new Set();
        const mistakes = (Array.isArray(p.mistakes) ? p.mistakes : []).slice(0, 40).map(normalizeMistake)
            .filter(m => m.question && !seen.has(m.question) && seen.add(m.question))
            .map(m => ({ ...m, correctAnswer: m.correctAnswer || answers.get(m.question) || '' }));
        await withClient(pool, async (db, lock) => {
            // Avval bo'sh qator (bo'lmasa), keyin qulflab o'qish — birinchi urinishda ham poyga bo'lmasin.
            if (lock) await db.query(`INSERT INTO student_part_results (student_id, lesson_id, part_id, attempts) VALUES ($1,$2,$3,0) ON CONFLICT DO NOTHING`, [studentId, lessonId, partId]);
            const { rows: prev } = await db.query(`SELECT mistakes, attempts FROM student_part_results WHERE student_id=$1 AND lesson_id=$2 AND part_id=$3${lock}`, [studentId, lessonId, partId]);
            const merged = mergeMistakes(prev[0]?.mistakes, mistakes, now.toISOString());
            await db.query(`INSERT INTO student_part_results (student_id, lesson_id, part_id, kind, title, correct, total,
                first_percent, last_percent, best_percent, attempts, passed, mistakes)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$8,1,$9,$10)
                ON CONFLICT (student_id, lesson_id, part_id) DO UPDATE SET kind=EXCLUDED.kind, title=EXCLUDED.title,
                  correct=EXCLUDED.correct, total=EXCLUDED.total, last_percent=EXCLUDED.last_percent,
                  first_percent=CASE WHEN student_part_results.attempts = 0 THEN EXCLUDED.first_percent ELSE student_part_results.first_percent END,
                  best_percent=GREATEST(student_part_results.best_percent, EXCLUDED.best_percent),
                  attempts=student_part_results.attempts + 1,
                  passed=student_part_results.passed OR EXCLUDED.passed, mistakes=EXCLUDED.mistakes, updated_at=NOW()`,
            [studentId, lessonId, partId, String(part.kind || '').slice(0, 40), String(part.title || '').slice(0, 160),
                correct, total, percent, percent >= PASS_PERCENT, JSON.stringify(merged)]);
        });
        savedParts++;
    }

    let savedExams = 0;
    for (const e of exams) {
        const examId = String(e?.examId || '').slice(0, 40);
        const percent = Math.round(Number(e?.scorePercent));
        if (!examExists(mc, examId, lang) || !Number.isFinite(percent) || percent < 0 || percent > 100) { skipped++; continue; }
        const mistakes = (Array.isArray(e.mistakes) ? e.mistakes : []).slice(0, 40).map(normalizeMistake).filter(m => m.question);
        await withClient(pool, async (db, lock) => {
            if (lock) await db.query(`INSERT INTO student_exam_results (student_id, exam_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [studentId, examId]);
            const { rows: prev } = await db.query(`SELECT mistakes FROM student_exam_results WHERE student_id=$1 AND exam_id=$2${lock}`, [studentId, examId]);
            const merged = mergeMistakes(prev[0]?.mistakes, mistakes, now.toISOString());
            await db.query(`INSERT INTO student_exam_results (student_id, exam_id, last_percent, best_percent, attempts, passed, mistakes)
                VALUES ($1,$2,$3,$3,1,$4,$5)
                ON CONFLICT (student_id, exam_id) DO UPDATE SET last_percent=EXCLUDED.last_percent,
                  best_percent=GREATEST(student_exam_results.best_percent, EXCLUDED.best_percent),
                  attempts=student_exam_results.attempts + 1, passed=student_exam_results.passed OR EXCLUDED.passed,
                  mistakes=EXCLUDED.mistakes, updated_at=NOW()`,
            [studentId, examId, percent, e.passed === true && percent >= RULES.EXAM_PASS_PERCENT, JSON.stringify(merged)]);
        });
        savedExams++;
    }
    return { ok: true, time: values.length, parts: savedParts, exams: savedExams, skipped, skippedSeconds: Math.max(0, Math.round(skippedSeconds)) };
}

module.exports = {
    TOTAL_LESSONS, LESSON_KINDS, COURSE_KINDS, PASS_PERCENT,
    initSchema, resolveAccess, getHub, getLesson, saveMaterial, archiveMaterial, listMaterials,
    studentsOverview, studentDetail, recordTracking,
    // test uchun
    buildTeacherPlan, konspektRules, allocateMinutes, expectedLiveLessons, lessonPercent, cleanPageMap, cleanMaterial, expectedLesson, summarizeStudent, mergeMistakes, tzDay,
    _resetCache: () => { ruSourceCache = null; contentCache = { at: 0, mc: null }; trackState.clear(); oralCache = undefined; },
};
