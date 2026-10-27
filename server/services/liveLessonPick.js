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

// takenIds — o'quvchining shu kungacha belgilangan jonli darslari (boshqa sanalar).
function pickNextLiveLesson(mc, student, takenIds = []) {
    const { lessons } = courseLessonsFor(mc, student);
    const live = liveLessonsOf(lessons);
    if (!live.length) return null;
    const taken = new Set(takenIds.map(String));
    const next = live.find(l => !taken.has(String(l.id))) || live[live.length - 1];
    return { id: String(next.id), name: String(next.title || next.name || '') };
}

// Ustoz qo'lda tanlagan dars shu o'quvchining kursidagi jonli dars ekanini tekshiradi.
function isLiveLessonOf(mc, student, lessonId) {
    const { lessons } = courseLessonsFor(mc, student);
    const i = lessons.findIndex(l => String(l.id) === String(lessonId));
    return i >= 0 && i % 2 !== 0 ? { id: String(lessons[i].id), name: String(lessons[i].title || lessons[i].name || '') } : null;
}

module.exports = { pickNextLiveLesson, isLiveLessonOf, liveLessonsOf, courseLessonsFor };
