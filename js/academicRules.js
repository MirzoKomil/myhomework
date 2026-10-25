// Akademik qoidalar — server (academicHub), CRM (lessonHub) va hujjatlar uchun
// yagona manba. Qiymatlar yangi o'quvchi ilovasidagi bilan bir xil:
//   PASS_PERCENT        — student-app/components/v2/homework/lib.ts PASS_THRESHOLD (0.65)
//   TEACHER_GRADED      — lib.ts isTeacherGraded (faqat ijodiy vazifa)
//   UNLOCK_PERCENT /
//   LIVE_AUTO_UNLOCK    — student-app/data/lessonContent.ts (50 / 60)
// Ilovada o'zgartirilsa, shu fayl ham yangilanishi shart.
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.AcademicRules = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    return Object.freeze({
        TOTAL_LESSONS: 72,
        MONTH_SIZE: 24,
        EXAM_INTERVAL: 12,
        EXAM_PASS_PERCENT: 70,
        PASS_PERCENT: 65,
        UNLOCK_PERCENT: 50,
        LIVE_AUTO_UNLOCK: 60,
        LESSONS_PER_WEEK: 6,
        TEACHER_GRADED: Object.freeze(['creative']),
        // Ilova bo'limlari (learningTracker.ts contextFromPath natijalari).
        SECTIONS: Object.freeze({
            dars: 'Dars sahifasi', video: 'Videodars', slaydlar: 'Slaydlar', sozlar: "So'zlar", audio: 'Audio dialog',
            vazifa: 'Uy vazifasi', tekshiruv: 'Tekshiruv', xatolar: 'Xatolar ustida', bosh: 'Bosh sahifa', darslar: 'Darslar',
            mashq: "O'yin mashqlar", lugat: "Lug'at", grammatika: 'Grammatika', imtihonlar: 'Imtihonlar', takrorlash: 'Takrorlash',
            dialoglar: 'Dialoglar', audiolar: 'Audiolar', hikoyalar: 'Hikoyalar', asoslar: 'Asoslar', liga: 'Liga', bonus: 'Bonus darslar',
            natijalar: 'Natijalar', tarjimon: 'Tarjimon', boshqa: 'Boshqa',
        }),
    });
});
