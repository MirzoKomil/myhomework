'use strict';

// Jonli dars (speaking) — o'quvchi kursidagi juft o'rindagi darslar (index 1, 3, 5…).
// Ustoz davomatda "Keldi" bosganda qaysi jonli dars o'tilgani shu yerdan
// avtomatik aniqlanadi: o'quvchi hali o'tmagan birinchi jonli dars. Bu belgi
// (liveGrades[*].lessonId) ilovada jonli darsni "o'tildi" qilib ochadi
// (server/db.js applyComputedLessonAttendance). Baho endi qo'yilmaydi.

function courseLessonsFor(mc, student) {
    const lang = student && student.subject === 'russian' ? 'russian' : 'english';
    const courses = (mc && Array.isArray(mc.courses) ? mc.courses : []).filter(c => (c.lang || 'english') === lang);
    const wanted = student && student.platformCourseId;
    const course = courses.find(c => c.id === wanted) || courses[0] || null;
    if (!course) return { course: null, lessons: [] };
    const lessons = (mc.lessons || []).filter(l => l.courseId === course.id);
    return { course, lessons };
}

function liveLessonsOf(lessons) {
    return lessons.filter((_, i) => i % 2 !== 0);
}

// Ilovadagi o'rin bo'yicha jonli dars raqami: o'quvchi ilovada N-darsgacha yetgan bo'lsa — N (juft) yoki N+1.
// (72 dars: toq — videodars, juft — jonli dars; student-app/data/lessonContent.ts lessonLockState.)
function liveNoByApp(reachedNo, total) {
    const r = Number(reachedNo) || 0;
    if (r <= 0 || total < 2) return null;
    return Math.min(total - (total % 2), r % 2 === 0 ? r : r + 1);
}
// YAGONA qoida (Davomat "Jonli dars avtomatik belgilanadi: N-dars", "Darsni boshlash/tugatish", Bosh sahifa,
// Elektron doska va "Keldi" saqlanganda — hammasi shu): o'quvchi hali o'tmagan birinchi jonli dars;
// lekin davomat tarixi to'liq bo'lmasa (masalan belgilash tizimi 27-oktyabrdan boshlangan) va o'quvchi ilovada
// ancha oldinda bo'lsa (bitta jonli darsdan ko'p — 2 dars), ilovadagi o'rni bo'yicha jonli dars olinadi.
// takenIds — o'quvchining shu kungacha belgilangan jonli darslari (boshqa sanalar). reachedNo — ilovada yetgan dars raqami.
function pickNextLiveLesson(mc, student, takenIds = [], reachedNo = 0) {
    const { lessons } = courseLessonsFor(mc, student);
    const live = liveLessonsOf(lessons);
    if (!live.length) return null;
    const taken = new Set(takenIds.map(String));
    let next = live.find(l => !taken.has(String(l.id))) || live[live.length - 1];
    const byApp = liveNoByApp(reachedNo, lessons.length);
    if (byApp && lessons.indexOf(next) + 1 < byApp - 2 && lessons[byApp - 1]) next = lessons[byApp - 1];
    return { id: String(next.id), name: String(next.title || next.name || ''), no: lessons.indexOf(next) + 1 };
}
// O'quvchining ilovada yetgan dars raqami (student_lesson_progress; academicHub.reachedLesson bilan bir xil qoida).
function reachedNoFrom(mc, student, progress) {
    const { lessons } = courseLessonsFor(mc, student);
    const idx = new Map(lessons.map((l, i) => [String(l.id), i + 1]));
    let max = 0;
    for (const [id, p] of Object.entries(progress || {})) {
        if (!idx.has(String(id)) || !p) continue;
        const any = p.videoWatch || p.slidesWatch || p.vocabList || p.vocabPractice || Object.values(p.homeworkParts || {}).some(Boolean);
        if (any) max = Math.max(max, idx.get(String(id)));
    }
    return max;
}

// Ustoz qo'lda tanlagan dars shu o'quvchining kursidagi jonli dars ekanini tekshiradi.
function isLiveLessonOf(mc, student, lessonId) {
    const { lessons } = courseLessonsFor(mc, student);
    const i = lessons.findIndex(l => String(l.id) === String(lessonId));
    return i >= 0 && i % 2 !== 0 ? { id: String(lessons[i].id), name: String(lessons[i].title || lessons[i].name || '') } : null;
}

module.exports = { pickNextLiveLesson, isLiveLessonOf, liveLessonsOf, courseLessonsFor, liveNoByApp, reachedNoFrom };
