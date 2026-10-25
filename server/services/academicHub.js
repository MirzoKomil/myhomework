'use strict';
// Akademik bo'lim → Darslik markazi.
// Ustoz uchun 72 darslik reja, har dars bo'yicha materiallar (jonli dars,
// videodars va grammatika slaydlari, ustoz qo'llanmasi), kitob PDF'lari va
// o'quvchilarning yangi ilovadagi o'zlashtirishi (progress, xatolar, vaqt).
//
// Mustaqil, faqat qo'shiladigan saqlash: mobile_content, students va
// student_lesson_progress jadvallari faqat o'qiladi, hech qachon yozilmaydi.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { sanitizeMobileContent } = require('../../js/mobileContentPolicy');
const teacherRoles = require('../../js/teacherRoles');

const TOTAL_LESSONS = 72;
const MONTH_SIZE = 24;
const EDIT_ROLES = new Set(['admin', 'boshliq']);
const VIEW_ROLES = new Set(['admin', 'boshliq', 'rop', 'teacher']);
const LANGS = new Set(['english', 'russian']);
const PASS_PERCENT = 65; // ilovadagi uy vazifasi qismi o'tish chegarasi
const LESSONS_PER_WEEK = 6; // 72 dars = 12 hafta (3 oy)

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
 last_percent INTEGER NOT NULL DEFAULT 0,
 best_percent INTEGER NOT NULL DEFAULT 0,
 attempts INTEGER NOT NULL DEFAULT 0,
 passed BOOLEAN NOT NULL DEFAULT FALSE,
 mistakes JSONB NOT NULL DEFAULT '[]',
 first_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY (student_id, lesson_id, part_id)
);
`;

const error = (status, message) => Object.assign(new Error(message), { status });

async function initSchema(pool) {
    await pool.query(SCHEMA);
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

async function accessibleStudents(pool, access, lang) {
    const params = [lang];
    let where = "COALESCE(s.subject,'english') = $1";
    if (access.teacher) {
        params.push(access.teacher.id);
        where += ' AND (s.teacher_id = $2 OR s.assistant_teacher_id = $2)';
    }
    const { rows } = await pool.query(`SELECT s.id, s.name, s.group_name, s.subject, s.teacher_id,
        s.assistant_teacher_id, s.lesson_duration, COALESCE(s.extra_data,'{}'::jsonb) AS extra
        FROM students s WHERE ${where} ORDER BY s.name`, params);
    return rows.map(r => ({
        id: r.id, name: r.name, group: r.group_name || '', subject: r.subject || 'english',
        teacherId: r.teacher_id || '', assistantTeacherId: r.assistant_teacher_id || '',
        lessonDuration: Number(r.lesson_duration) || null,
        startDate: r.extra?.startDate || r.extra?.joinDate || '',
        status: r.extra?.status || '', frozen: r.extra?.frozen === true,
        platformCourseId: r.extra?.platformCourseId || '',
        role: access.teacher ? (r.teacher_id === access.teacher.id ? 'main' : 'assistant') : null,
    })).filter(s => !['archived', 'deleted', 'left'].includes(String(s.status).toLowerCase()));
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

// ─── Kontent (faqat o'qiladi) ───────────────────────────────────────────────
async function loadMobileContent(pool) {
    const { rows } = await pool.query('SELECT data FROM mobile_content WHERE singleton = 1');
    const mc = sanitizeMobileContent(rows[0]?.data
        ? JSON.parse(JSON.stringify(rows[0].data)) : { courses: [], lessons: [], lessonContents: {} });
    mc.courses ||= []; mc.lessons ||= []; mc.lessonContents ||= {};
    return mc;
}

let ruSourceCache = null;
function loadRussianSource(root = path.join(__dirname, '..', '..')) {
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

function coursesFor(mc, lang) {
    return mc.courses.filter(c => (c.lang || 'english') === lang);
}

function pickCourse(mc, lang, courseId) {
    const list = coursesFor(mc, lang);
    return list.find(c => c.id === courseId) || list[0] || null;
}

function courseLessons(mc, course) {
    return course ? mc.lessons.filter(l => l.courseId === course.id) : [];
}

const stripStress = s => String(s || '').replace(/́/g, '');
const monthOf = no => Math.ceil(no / MONTH_SIZE);

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

function partQuestionCount(p) {
    switch (p?.kind) {
        case 'matching': return (p.pairs || []).length;
        case 'fillBlank': return (p.blanks || []).length;
        case 'multipleChoice': return (p.questions || []).length;
        case 'sentenceBuild': return (p.items || []).length;
        case 'reading': return (p.sentences || []).length || 1;
        default: return 1;
    }
}

const TEACHER_GRADED = new Set(['creative', 'reading', 'record', 'roleplay']);

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

function cleanMaterial(body, existing = {}) {
    const language = body.language ?? existing.language;
    if (!LANGS.has(language)) throw error(400, "Til noto'g'ri");
    const lessonNo = body.lessonNo === undefined ? existing.lessonNo
        : body.lessonNo === null || body.lessonNo === '' ? null : Number(body.lessonNo);
    const kind = String(body.kind ?? existing.kind ?? '');
    if (lessonNo === null) {
        if (!COURSE_KINDS[kind]) throw error(400, "Kurs materiali turi noto'g'ri");
    } else {
        if (!Number.isInteger(lessonNo) || lessonNo < 1 || lessonNo > TOTAL_LESSONS) throw error(400, "Dars raqami 1–72 bo'lishi kerak");
        if (!LESSON_KINDS[kind]) throw error(400, "Material turi noto'g'ri");
    }
    const title = String(body.title ?? existing.title ?? '').trim().slice(0, 200);
    if (!title) throw error(400, 'Nomini kiriting');
    const url = String(body.url ?? existing.url ?? '').trim();
    if (!SAFE_URL.test(url) || url.length > 2000) throw error(400, "Havola /uploads/... yoki https:// bilan boshlanishi kerak");
    const meta = { ...(existing.meta || {}), ...(body.meta && typeof body.meta === 'object' ? body.meta : {}) };
    if (kind === 'book') meta.pageMap = cleanPageMap(meta.pageMap);
    for (const key of ['lessonFrom', 'lessonTo', 'part']) {
        if (meta[key] === undefined || meta[key] === '' || meta[key] === null) { delete meta[key]; continue; }
        const v = Number(meta[key]);
        if (!Number.isInteger(v) || v < 1 || v > TOTAL_LESSONS) throw error(400, "Dars oralig'i 1–72 bo'lishi kerak");
        meta[key] = v;
    }
    return {
        language, lessonNo, kind, title, url,
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
    // Ustozga: qaysi darsda nechta o'quvchisi turibdi (oxirgi boshlagan dars).
    const students = await accessibleStudents(pool, access, lang);
    const progress = await loadProgress(pool, students.map(s => s.id));
    const reachedBy = {};
    const idToNo = Object.fromEntries(lessons.slice(0, TOTAL_LESSONS).map((l, i) => [l.id, i + 1]));
    for (const s of students) {
        const reached = reachedLesson(progress[s.id] || {}, idToNo);
        if (reached) reachedBy[reached] = (reachedBy[reached] || 0) + 1;
    }
    syllabus.forEach(l => { l.studentsHere = reachedBy[l.no] || 0; });
    return {
        lang, canEdit: access.canEdit, role: access.role, lockedLang: !!access.lang,
        course: course ? { id: course.id, name: course.name } : null,
        courses: coursesFor(mc, lang).map(c => ({ id: c.id, name: c.name })),
        kinds: { lesson: LESSON_KINDS, course: COURSE_KINDS },
        syllabus,
        courseMaterials: materials.filter(m => m.lessonNo === null),
        studentCount: students.length,
        defaultDuration: mostCommon(students.map(s => s.lessonDuration).filter(Boolean)) || 60,
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
        prevReview: prevSrc.review || [], prevVocab: (prevSrc.vocab || []).slice(0, 6).map(v => v.ru),
        prevName: prevMeta?.name || '',
    });
    const materials = await listMaterials(pool, lang, n);
    const books = (await listMaterials(pool, lang)).filter(m => m.kind === 'book');
    const book = bookPageFor(books, n);
    const students = await accessibleStudents(pool, access, lang);
    const classStats = await lessonClassStats(pool, students, meta, content, prevMeta);
    return { lang, canEdit: access.canEdit, lesson, materials, book, classStats };
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
// Ulushlar foizda: ustoz dars davomiyligini tanlaganda daqiqalar shundan
// hisoblanadi. Har blokda — nima qilinadi, qaysi material, metodik maslahat.
function buildTeacherPlan(lesson, ctx = {}) {
    const short = (arr, n = 8) => arr.slice(0, n);
    const words = lesson.vocabulary.map(v => stripStress(v.word));
    const goal = lesson.cando || `${lesson.name} mavzusini o'zlashtirish`;
    const dialogTitle = lesson.audioDialogs[0]?.title || lesson.dialog?.title || lesson.text?.title || '';
    // Konspektdan asosiy qoidalar: avval ro'yxat bandlari (*), bo'lmasa
    // raqamli sarlavhalar ("1. ..."), sarlavha/kirish qatorlari tashlanadi.
    const kLines = String(lesson.konspekt || '').split('\n').map(s => s.trim()).filter(s => s && s !== '---');
    const bullets = kLines.filter(s => /^[*•]|^- /.test(s)).map(s => s.replace(/^[*•\-]\s*/, ''));
    const headings = kLines.filter(s => /^\d+[.)]\s+\S/.test(s));
    const konspektPoints = (bullets.length ? bullets : headings.length ? headings : kLines.slice(1)).slice(0, 5);
    if (lesson.type === 'video') {
        return {
            mode: 'video', goal,
            summary: "Videodars — o'quvchi ilovada mustaqil o'rganadi. Ustozning vazifasi: tayyorlab qo'yish, kuzatish va keyingi jonli darsda mustahkamlash.",
            blocks: [
                { key: 'watch', title: "O'quvchi videodars yoki slaydlarni ko'radi", share: 35,
                    items: [lesson.videoUrl ? 'Videodars ilovada ochiq' : "Video yo'q — slaydlar va konspekt orqali",
                        lesson.slides.length ? `${lesson.slides.length} ta slayd` : ''].filter(Boolean),
                    tip: "Video bo'lmasa, jonli darsda slaydlarni prezentatsiya rejimida qisqa ko'rsatib o'ting." },
                { key: 'vocab', title: "Yangi so'zlar (ro'yxat + mashq)", share: 25, items: short(words, 12),
                    tip: "Keyingi jonli darsning boshida shu so'zlardan 5 tasini og'zaki so'rang." },
                { key: 'homework', title: 'Ilovadagi uy vazifasi', share: 30,
                    items: lesson.homework.map(h => `${h.title || h.kind} — ${h.questions} ta savol${h.teacherGraded ? " (ustoz tekshiradi)" : ''}`),
                    tip: `Har qism ${PASS_PERCENT}% dan yuqori bajarilganda o'tadi. Xatolar ro'yxatini "O'quvchilar" bo'limidan ko'ring.` },
                { key: 'check', title: 'Ustoz nazorati', share: 10,
                    items: ["Darsni 50% dan kam bajarganlarga eslatma yuboring", 'Ijodiy/o\'qish vazifalarini baholang'],
                    tip: "Keyingi jonli dars ochilishi uchun bu dars kamida 50% bajarilgan bo'lishi kerak." },
            ],
            checklist: ['Videodars/slaydlar ilovada ochilishini tekshirish', "Oldingi jonli darsdan qolgan uy vazifalarini ko'rib chiqish", "Faol bo'lmagan o'quvchilarga xabar yozish"],
        };
    }
    const review = ctx.prevReview?.length ? ctx.prevReview.map(r => r.q) : short(ctx.prevVocab || [], 6);
    return {
        mode: 'live', goal,
        summary: `Jonli dars. Maqsad: ${goal}`,
        blocks: [
            { key: 'warmup', title: "Salomlashish va o'tgan darsni takrorlash", share: 10,
                items: short(review, 6).length ? short(review, 6) : [`${ctx.prevName || "O'tgan dars"} bo'yicha 3–4 savol`],
                tip: "Har o'quvchiga kamida bitta savol. Uy vazifasini bajarmaganlar ro'yxati shu sahifada." },
            { key: 'vocab', title: "Yangi so'zlar", share: 15, items: short(words, 12),
                tip: "Kartochka rejimida ko'rsating: ko'rsatish → xor bilan takrorlash → tarjimasini so'rash → gapda ishlatish." },
            { key: 'dialog', title: dialogTitle ? `Dialog / matn: ${dialogTitle}` : 'Dialog yoki matn', share: 20,
                items: [lesson.audioDialogs.length ? `${lesson.audioDialogs.length} ta audio dialog` : '',
                    lesson.dialog ? `${lesson.dialog.lines.length} replika` : '', lesson.text ? "O'qish matni va savollar" : ''].filter(Boolean),
                tip: "Avval tinglash (matnsiz), keyin matn bilan, so'ng rollarga bo'lib o'qish." },
            { key: 'grammar', title: 'Grammatika', share: 15,
                items: konspektPoints.length ? konspektPoints : ['Konspekt asosida qoidani misollar bilan tushuntirish'],
                tip: "Qoidani 2–3 misol bilan bering, so'ng o'quvchi o'zi gap tuzsin. Doskaga yozib boring." },
            { key: 'speaking', title: 'Gapirish amaliyoti', share: 30,
                items: short(lesson.speaking.map(s => stripStress(s.ru)), 8).length ? short(lesson.speaking.map(s => stripStress(s.ru)), 8) : ['Mavzu bo\'yicha savol-javob va rolli o\'yin'],
                tip: "Ustoz kamroq, o'quvchi ko'proq gapirsin (kamida 70% vaqt). Xatolarni darhol emas, blok oxirida tuzating." },
            { key: 'wrapup', title: 'Yakun va uy vazifasi', share: 10,
                items: [`Maqsadni tekshirish: «${goal}»`, ...lesson.homework.slice(0, 4).map(h => `Ilovada: ${h.title || h.kind}`)],
                tip: 'Davomatni shu yerning o\'zida belgilang — davomat jonli darsni ilovada ochadi.' },
        ],
        checklist: ['Slaydlar va doskani oldindan ochib qo\'yish', 'Audio dialogni tekshirish (ovoz)', "Oldingi dars uy vazifasini bajarmaganlarni ko'rib chiqish", 'Darsdan keyin davomatni belgilash'],
    };
}

// ─── O'quvchi progressi ─────────────────────────────────────────────────────
async function loadProgress(pool, ids) {
    if (!ids.length) return {};
    const { rows } = await pool.query('SELECT student_id, data FROM student_lesson_progress WHERE student_id = ANY($1::text[])', [ids]);
    return Object.fromEntries(rows.map(r => [r.student_id, r.data || {}]));
}

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

function reachedLesson(progress, idToNo) {
    let max = 0;
    for (const [id, p] of Object.entries(progress)) if (idToNo[id] && hasAnyProgress(p)) max = Math.max(max, idToNo[id]);
    return max;
}

function studentCourseLessons(mc, student) {
    const lang = student.subject === 'russian' ? 'russian' : 'english';
    const course = pickCourse(mc, lang, student.platformCourseId);
    return courseLessons(mc, course).slice(0, TOTAL_LESSONS);
}

function expectedLesson(startDate, now = new Date()) {
    const start = startDate ? new Date(startDate) : null;
    if (!start || Number.isNaN(start.getTime()) || start > now) return null;
    const weeks = (now - start) / (7 * 86400000);
    return Math.max(1, Math.min(TOTAL_LESSONS, Math.floor(weeks * LESSONS_PER_WEEK) + 1));
}

async function loadTime(pool, ids, sinceDays) {
    if (!ids.length) return [];
    const { rows } = await pool.query(`SELECT student_id, day::text AS day, lesson_id, section, seconds
        FROM student_learning_time WHERE student_id = ANY($1::text[]) AND day >= CURRENT_DATE - $2::int`, [ids, sinceDays]);
    return rows;
}

async function loadTotals(pool, ids) {
    if (!ids.length) return {};
    const { rows } = await pool.query(`SELECT student_id, SUM(seconds)::bigint AS total, MIN(day)::text AS since,
        MAX(updated_at) AS last_at FROM student_learning_time WHERE student_id = ANY($1::text[]) GROUP BY student_id`, [ids]);
    return Object.fromEntries(rows.map(r => [r.student_id, { total: Number(r.total) || 0, since: r.since, lastAt: r.last_at }]));
}

async function loadParts(pool, ids) {
    if (!ids.length) return [];
    const { rows } = await pool.query(`SELECT student_id, lesson_id, part_id, kind, title, correct, total, last_percent,
        best_percent, attempts, passed, mistakes, updated_at FROM student_part_results WHERE student_id = ANY($1::text[])`, [ids]);
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
    const idToNo = Object.fromEntries(perLesson.map(l => [l.id, l.no]));
    const reached = reachedLesson(progress, idToNo);
    const completed = perLesson.filter(l => l.percent >= 100).length;
    const started = perLesson.filter(l => l.started);
    const avgPercent = started.length ? Math.round(started.reduce((s, l) => s + l.percent, 0) / started.length) : 0;
    const graded = parts.filter(p => p.total > 0);
    const homeworkAvg = graded.length ? Math.round(graded.reduce((s, p) => s + p.best_percent, 0) / graded.length) : null;
    const mistakes = parts.reduce((s, p) => s + (Array.isArray(p.mistakes) ? p.mistakes.length : 0), 0);
    const daySecs = {};
    for (const r of timeRows) daySecs[r.day] = (daySecs[r.day] || 0) + r.seconds;
    const dayKey = d => d.toISOString().slice(0, 10);
    const sumDays = n => { let s = 0; for (let i = 0; i < n; i++) s += daySecs[dayKey(new Date(now - i * 86400000))] || 0; return s; };
    const activeDays7 = Array.from({ length: 7 }, (_, i) => daySecs[dayKey(new Date(now - i * 86400000))] > 0).filter(Boolean).length;
    const lastActive = maxDate(lastSeen, totals?.lastAt, ...parts.map(p => p.updated_at));
    const daysIdle = lastActive ? Math.floor((now - lastActive) / 86400000) : null;
    const expected = expectedLesson(student.startDate, now);
    const flags = [];
    if (daysIdle === null || daysIdle >= 3) flags.push({ key: 'idle', label: daysIdle === null ? "Ilovaga kirmagan" : `${daysIdle} kundan beri faol emas` });
    if (homeworkAvg !== null && homeworkAvg < PASS_PERCENT) flags.push({ key: 'struggling', label: 'Uy vazifasida qiynalyapti' });
    if (expected && reached + LESSONS_PER_WEEK < expected) flags.push({ key: 'behind', label: `Rejadan orqada (${expected}-dars bo'lishi kerak)` });
    return {
        id: student.id, name: student.name, group: student.group, role: student.role,
        reached, completed, avgPercent, homeworkAvg, mistakes, expected,
        time: { today: sumDays(1), week: sumDays(7), month: sumDays(30), total: totals?.total || 0, since: totals?.since || null },
        activeDays7, lastActive: iso(lastActive), daysIdle, flags, perLesson,
    };
}

async function studentsOverview(pool, actor, { lang: requested } = {}) {
    const access = await resolveAccess(pool, actor);
    const lang = pickLang(access, requested);
    const students = await accessibleStudents(pool, access, lang);
    const ids = students.map(s => s.id);
    const [mc, progress, parts, timeRows, totals, lastSeen] = await Promise.all([
        loadMobileContent(pool), loadProgress(pool, ids), loadParts(pool, ids),
        loadTime(pool, ids, 30), loadTotals(pool, ids), loadLastSeen(pool, ids),
    ]);
    const group = (rows, key = 'student_id') => rows.reduce((a, r) => ((a[r[key]] ||= []).push(r), a), {});
    const partsBy = group(parts), timeBy = group(timeRows);
    const list = students.map(s => {
        const sum = summarizeStudent(s, mc, progress[s.id] || {}, partsBy[s.id] || [], timeBy[s.id] || [], totals[s.id], lastSeen[s.id]);
        delete sum.perLesson;
        return sum;
    });
    const trackingSince = Object.values(totals).map(t => t.since).filter(Boolean).sort()[0] || null;
    return { lang, students: list, trackingSince };
}

async function studentDetail(pool, actor, studentId) {
    const access = await resolveAccess(pool, actor);
    const { student } = await assertStudentAccess(pool, access, String(studentId || ''));
    const ids = [student.id];
    const [mc, progress, parts, timeRows, totals, lastSeen, activity] = await Promise.all([
        loadMobileContent(pool), loadProgress(pool, ids), loadParts(pool, ids),
        loadTime(pool, ids, 60), loadTotals(pool, ids), loadLastSeen(pool, ids), loadLegacyActivity(pool, student.id),
    ]);
    const summary = summarizeStudent(student, mc, progress[student.id] || {}, parts, timeRows, totals[student.id], lastSeen[student.id]);
    const lessons = studentCourseLessons(mc, student);
    const idToNo = Object.fromEntries(lessons.map((l, i) => [l.id, i + 1]));
    const p = progress[student.id] || {};
    const timeByLesson = {}, timeBySection = {}, timeByDay = {};
    for (const r of timeRows) {
        if (r.lesson_id) timeByLesson[r.lesson_id] = (timeByLesson[r.lesson_id] || 0) + r.seconds;
        const sec = r.section || 'boshqa';
        timeBySection[sec] = (timeBySection[sec] || 0) + r.seconds;
        timeByDay[r.day] = (timeByDay[r.day] || 0) + r.seconds;
    }
    const partsByLesson = parts.reduce((a, r) => ((a[r.lesson_id] ||= []).push(r), a), {});
    const perLesson = summary.perLesson.map(l => {
        const content = mc.lessonContents[l.id] || {};
        const lp = p[l.id] || {};
        const isVideo = l.no % 2 === 1;
        const results = (partsByLesson[l.id] || []).map(r => ({
            partId: r.part_id, kind: r.kind, title: r.title, correct: r.correct, total: r.total,
            bestPercent: r.best_percent, lastPercent: r.last_percent, attempts: r.attempts, passed: r.passed,
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
        };
    });
    // Ilovadagi lessonId → dars raqami (vaqt jadvali uchun).
    delete summary.perLesson;
    return {
        student: { ...summary, startDate: student.startDate || null },
        lessons: perLesson,
        timeByDay, timeBySection,
        activity: activity.map(a => ({ ...a, lessonNo: idToNo[String(a.label || '').split(' - ')[0]] || null })),
    };
}

async function loadLegacyActivity(pool, studentId) {
    const { rows } = await pool.query("SELECT data FROM json_data WHERE key='studentActivity'");
    const list = rows[0]?.data?.[studentId];
    return Array.isArray(list) ? list.slice(-50).reverse() : [];
}

// Bitta dars bo'yicha guruh holati: kim qayerda, eng ko'p xato qilingan savollar.
async function lessonClassStats(pool, students, meta, content, prevMeta) {
    if (!students.length || !meta.id) return { students: [], topMistakes: [], prevHomeworkMissing: [] };
    const ids = students.map(s => s.id);
    const [progress, parts, time] = await Promise.all([
        loadProgress(pool, ids),
        pool.query(`SELECT student_id, part_id, title, best_percent, passed, mistakes FROM student_part_results
            WHERE student_id = ANY($1::text[]) AND lesson_id = $2`, [ids, meta.id]).then(r => r.rows),
        pool.query(`SELECT student_id, SUM(seconds)::int AS seconds FROM student_learning_time
            WHERE student_id = ANY($1::text[]) AND lesson_id = $2 GROUP BY student_id`, [ids, meta.id]).then(r => r.rows),
    ]);
    const totalParts = (content.homeworkParts || []).length;
    const isVideo = meta.type === 'video';
    const timeBy = Object.fromEntries(time.map(r => [r.student_id, r.seconds]));
    const partsBy = parts.reduce((a, r) => ((a[r.student_id] ||= []).push(r), a), {});
    const mistakeCount = {};
    for (const r of parts) for (const m of (r.mistakes || [])) {
        const key = String(m?.question || m || '').slice(0, 200);
        if (key) mistakeCount[key] = (mistakeCount[key] || 0) + 1;
    }
    const rows = students.map(s => {
        const lp = progress[s.id]?.[meta.id] || {};
        const own = partsBy[s.id] || [];
        return {
            id: s.id, name: s.name, percent: lessonPercent(lp, isVideo, totalParts),
            watch: isVideo ? !!lp.videoWatch : !!lp.slidesWatch, vocab: !!lp.vocabList && !!lp.vocabPractice,
            homeworkDone: Object.values(lp.homeworkParts || {}).filter(Boolean).length, homeworkTotal: totalParts,
            bestPercent: own.length ? Math.round(own.reduce((x, r) => x + r.best_percent, 0) / own.length) : null,
            mistakes: own.reduce((x, r) => x + (r.mistakes || []).length, 0), seconds: timeBy[s.id] || 0,
        };
    }).sort((a, b) => b.percent - a.percent);
    // Jonli dars oldidan: oldingi (video) darsni 50% dan kam bajarganlar.
    let prevHomeworkMissing = [];
    if (prevMeta?.id) {
        prevHomeworkMissing = students.filter(s => {
            const lp = progress[s.id]?.[prevMeta.id];
            return lessonPercent(lp, prevMeta.type === 'video', prevMeta.counts.homework) < 50;
        }).map(s => ({ id: s.id, name: s.name }));
    }
    return {
        students: rows,
        topMistakes: Object.entries(mistakeCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([question, count]) => ({ question, count })),
        prevHomeworkMissing,
    };
}

// ─── Ilovadan keladigan tracking ────────────────────────────────────────────
const SECTION_RE = /^[a-z0-9-]{0,40}$/;
const MAX_FLUSH_SECONDS = 900; // bitta yuborishda 15 daqiqadan oshmaydi

async function recordTracking(pool, studentId, body = {}, now = new Date()) {
    if (!studentId) throw error(401, "O'quvchi avtorizatsiyasi talab qilinadi");
    const time = Array.isArray(body.time) ? body.time.slice(0, 60) : [];
    const parts = Array.isArray(body.parts) ? body.parts.slice(0, 30) : [];
    const today = now.toISOString().slice(0, 10);
    const earliest = new Date(now - 3 * 86400000).toISOString().slice(0, 10);
    let savedTime = 0, savedParts = 0;
    for (const t of time) {
        const seconds = Math.round(Number(t?.seconds));
        const day = String(t?.day || today).slice(0, 10);
        const lessonId = String(t?.lessonId || '').slice(0, 160);
        const section = String(t?.section || '').toLowerCase();
        if (!Number.isFinite(seconds) || seconds <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(day)
            || day > today || day < earliest || !SECTION_RE.test(section)) continue;
        await pool.query(`INSERT INTO student_learning_time (student_id, day, lesson_id, section, seconds)
            VALUES ($1,$2,$3,$4,$5) ON CONFLICT (student_id, day, lesson_id, section)
            DO UPDATE SET seconds = LEAST(student_learning_time.seconds + EXCLUDED.seconds, 86400), updated_at = NOW()`,
        [studentId, day, lessonId, section, Math.min(seconds, MAX_FLUSH_SECONDS)]);
        savedTime++;
    }
    for (const p of parts) {
        const lessonId = String(p?.lessonId || '').slice(0, 160);
        const partId = String(p?.partId || '').slice(0, 160);
        const total = Math.max(0, Math.min(Math.round(Number(p?.total) || 0), 500));
        const correct = Math.max(0, Math.min(Math.round(Number(p?.correct) || 0), total));
        if (!lessonId || !partId || !total) continue;
        const percent = Math.round((correct / total) * 100);
        const mistakes = (Array.isArray(p.mistakes) ? p.mistakes : []).slice(0, 30).map(m => (
            typeof m === 'string' ? { question: m.slice(0, 300) }
                : { question: String(m?.question || '').slice(0, 300), yourAnswer: String(m?.yourAnswer || '').slice(0, 200), correctAnswer: String(m?.correctAnswer || '').slice(0, 200) }
        )).filter(m => m.question);
        await pool.query(`INSERT INTO student_part_results (student_id, lesson_id, part_id, kind, title, correct, total,
            last_percent, best_percent, attempts, passed, mistakes)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,1,$9,$10)
            ON CONFLICT (student_id, lesson_id, part_id) DO UPDATE SET kind=EXCLUDED.kind, title=EXCLUDED.title,
              correct=EXCLUDED.correct, total=EXCLUDED.total, last_percent=EXCLUDED.last_percent,
              best_percent=GREATEST(student_part_results.best_percent, EXCLUDED.best_percent),
              attempts=student_part_results.attempts + 1,
              passed=student_part_results.passed OR EXCLUDED.passed, mistakes=EXCLUDED.mistakes, updated_at=NOW()`,
        [studentId, lessonId, partId, String(p.kind || '').slice(0, 40), String(p.title || '').slice(0, 160),
            correct, total, percent, percent >= PASS_PERCENT, JSON.stringify(mistakes)]);
        savedParts++;
    }
    return { ok: true, time: savedTime, parts: savedParts };
}

module.exports = {
    TOTAL_LESSONS, LESSON_KINDS, COURSE_KINDS, PASS_PERCENT,
    initSchema, resolveAccess, getHub, getLesson, saveMaterial, archiveMaterial, listMaterials,
    studentsOverview, studentDetail, recordTracking,
    // test uchun
    buildTeacherPlan, lessonPercent, cleanPageMap, cleanMaterial, expectedLesson, summarizeStudent,
    _resetCache: () => { ruSourceCache = null; },
};
