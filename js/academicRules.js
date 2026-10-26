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
    // Dars daqiqalarini taqsimlash: eng katta qoldiq usuli, har blok o'z
    // minimumidan (min) kam bo'lmaydi, jami aynan dars davomiyligiga teng.
    function largestRemainder(raw, total) {
        const floors = raw.map(Math.floor);
        let left = total - floors.reduce((a, b) => a + b, 0);
        const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
        for (let k = 0; left > 0 && k < order.length; k++, left--) floors[order[k][1]]++;
        return floors;
    }
    function allocateMinutes(blocks, duration) {
        const total = Math.max(1, Math.round(duration));
        const mins = blocks.map(b => Math.max(1, b.min || 1));
        const minSum = mins.reduce((a, b) => a + b, 0);
        if (minSum >= total) return largestRemainder(mins.map(m => (m / minSum) * total), total);
        const shares = blocks.map(b => b.share || 1);
        let out = shares.map(sh => (sh / shares.reduce((a, b) => a + b, 0)) * total);
        const fixed = new Set();
        for (let g = 0; g < blocks.length; g++) {
            const low = out.findIndex((v, i) => !fixed.has(i) && v < mins[i]);
            if (low < 0) break;
            fixed.add(low);
            const rest = total - [...fixed].reduce((a, i) => a + mins[i], 0);
            const freeShare = shares.reduce((a, sh, i) => a + (fixed.has(i) ? 0 : sh), 0);
            out = out.map((_, i) => (fixed.has(i) ? mins[i] : (shares[i] / freeShare) * rest));
        }
        return largestRemainder(out, total);
    }
    return Object.freeze({
        allocateMinutes,
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
