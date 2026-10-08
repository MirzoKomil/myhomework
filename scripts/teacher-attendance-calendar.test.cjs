const { test } = require('node:test');
const assert = require('node:assert/strict');
const calendar = require('../js/teacherAttendanceCalendar');
const { appContext } = require('./helpers/lead-workflow-fixture.cjs');
const engine = require('../js/payrollEngine');

test('full month includes scheduled and unscheduled days, with Monday-first alignment', () => {
    const cells = calendar.cells('2026-10', [1, 3, 5]);
    assert.equal(cells.slice(0, 3).every(c => c === null), true);
    assert.deepEqual(cells.filter(Boolean).map(c => c.day), Array.from({ length: 31 }, (_, i) => i + 1));
    assert.equal(cells.find(c => c?.day === 4).scheduled, false); // Sunday is still selectable.
    assert.equal(cells.find(c => c?.day === 2).scheduled, true);
    assert.equal(cells.find(c => c?.day === 31).date, '2026-10-31');
});
test('month lengths include leap years and have no timezone-dependent gaps', () => {
    for (const [month, count] of [['2024-02', 29], ['2026-02', 28], ['2100-02', 28], ['2026-04', 30]]) {
        assert.equal(calendar.cells(month, []).filter(Boolean).length, count);
    }
    assert.deepEqual(calendar.cells('2026-13', []), []);
    assert.deepEqual(calendar.cells('not-a-month', []), []);
});
test('planned highlights follow the student timetable for primary duties, otherwise the own teacher pattern', () => {
    assert.deepEqual(calendar.weekdays({ lessonDayOfWeek: '2' }, { schedulePattern: 'mwf' }, 'main'), [2, 4, 6]);
    assert.deepEqual(calendar.weekdays({ lessonDayOfWeek: 7 }, {}, 'main'), [7]);
    assert.deepEqual(calendar.weekdays({ lessonDayOfWeek: 2 }, { schedulePattern: 'mwf' }, 'assistant'), [1, 3, 5]);
    assert.deepEqual(calendar.weekdays({}, { schedulePattern: 'tts' }, 'main'), [2, 4, 6]);
});
test('legacy present/absence values remain distinct from unmarked or removed days', () => {
    for (const v of [true, 1]) assert.equal(calendar.status(v), 'present');
    for (const v of [false, 0]) assert.equal(calendar.status(v), 'absent');
    for (const v of [null, undefined, '1']) assert.equal(calendar.status(v), 'empty');
});
test('explicit removal affects only the selected day/duty, and primary corrections preserve another teacher grade', () => {
    const cache = { assistant: { '2026-10_a': { s: { 1: 1, 2: 0, 3: 1 } } }, main: { '2026-10_a': { s: { 1: 1, 2: 1 } } },
        grades: { s: [{ teacherId: 'a', date: '2026-10-01' }, { teacherId: 'b', date: '2026-10-01' }, { teacherId: 'a', date: '2026-10-02' }] } };
    const c = appContext(['applyTeacherAttendanceResult'], {
        STORAGE_KEYS: { assistantAttendance: 'assistant', mainAttendance: 'main', liveGrades: 'grades' },
        getItem: key => cache[key] || {}, setCachedItem: (key, value) => { cache[key] = value; }
    });
    const result = { attendanceKey: '2026-10_a', teacherId: 'a', studentId: 's', day: 1, date: '2026-10-01', present: null };
    c.applyTeacherAttendanceResult({ ...result, attendanceType: 'assistant' });
    assert.deepEqual(JSON.parse(JSON.stringify(cache.assistant['2026-10_a'].s)), { 2: 0, 3: 1 });
    assert.equal(cache.grades.s.length, 3);
    c.applyTeacherAttendanceResult({ ...result, attendanceType: 'main' });
    assert.deepEqual(JSON.parse(JSON.stringify(cache.main['2026-10_a'].s)), { 2: 1 });
    assert.deepEqual(JSON.parse(JSON.stringify(cache.grades.s.map(g => [g.teacherId, g.date]))), [['b', '2026-10-01'], ['a', '2026-10-02']]);
});
test('new payroll counts off-schedule days within the monthly cap, while old paid bases keep their schedule policy', () => {
    const source = { teacherAttendancePolicy: 'all-days-v1', academicPolicy: 'dual-role-v1',
        hrEmployees: [{ id: 'a', name: 'A', role: 'ingliz-oqituvchi', lang: 'english' }], teachers: [{ id: 'a', schedulePattern: 'mwf' }],
        students: [{ id: 's', teacherId: 'a', subject: 'english', lessonDuration: 30 }],
        mainAttendance: { '2026-10_a': { s: { 2: 1, 4: 1, 31: 1 } } }, assistantAttendance: {}, leads: {}, cashFlow: [] };
    const settings = engine.defaults(), period = engine.period('2026-10-01', '2026-10-31');
    const row = engine.calculate(source, settings, period, 'english').rows[0];
    assert.equal(row.mainTotal, Math.round(150000 * 3 / 13));
    delete source.teacherAttendancePolicy; // Historical basis before this feature.
    assert.equal(engine.calculate(source, settings, period, 'english').rows[0].mainTotal, Math.round(150000 / 13));
    source.teacherAttendancePolicy = 'all-days-v1';
    source.mainAttendance['2026-10_a'].s = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [i + 1, 1]));
    assert.equal(engine.calculate(source, settings, period, 'english').rows[0].mainTotal, 150000);
});
