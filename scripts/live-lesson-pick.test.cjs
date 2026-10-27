'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { pickNextLiveLesson, isLiveLessonOf } = require('../server/services/liveLessonPick');

const mc = {
    courses: [{ id: 'en1', lang: 'english' }, { id: 'ru1', lang: 'russian' }],
    lessons: [
        { id: 'e1', courseId: 'en1', name: '1-dars' }, { id: 'e2', courseId: 'en1', name: '2-dars' },
        { id: 'e3', courseId: 'en1', name: '3-dars' }, { id: 'e4', courseId: 'en1', name: '4-dars' },
        { id: 'r1', courseId: 'ru1', name: '1' }, { id: 'r2', courseId: 'ru1', name: '2' },
    ],
};

test("birinchi o'tilmagan jonli dars tanlanadi", () => {
    assert.deepEqual(pickNextLiveLesson(mc, { subject: 'english' }, []), { id: 'e2', name: '2-dars' });
    assert.deepEqual(pickNextLiveLesson(mc, { subject: 'english' }, ['e2']), { id: 'e4', name: '4-dars' });
});

test("hamma jonli dars o'tilgan bo'lsa oxirgisi qaytadi; fan bo'yicha kurs", () => {
    assert.equal(pickNextLiveLesson(mc, { subject: 'english' }, ['e2', 'e4']).id, 'e4');
    assert.equal(pickNextLiveLesson(mc, { subject: 'russian' }, []).id, 'r2');
    assert.equal(pickNextLiveLesson({ courses: [], lessons: [] }, { subject: 'english' }), null);
});

test("qo'lda tanlangan dars faqat o'quvchi kursidagi jonli dars bo'lsa qabul qilinadi", () => {
    assert.equal(isLiveLessonOf(mc, { subject: 'english' }, 'e2').id, 'e2');
    assert.equal(isLiveLessonOf(mc, { subject: 'english' }, 'e1'), null);
    assert.equal(isLiveLessonOf(mc, { subject: 'english' }, 'r2'), null);
});
