// Eski Davomat ekranidan qolgan Du·Ch·Ju belgilarini Se·Pa·Sh o'quvchining o'z dars kunlariga ko'chirish (server/services/school/legacyAttendance).
// Sof hisob (plan, moveGrades) — bazasiz. Haqiqiy PostgreSQL bilan: scripts/eski-davomat-postgres.test.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../server/services/school/legacyAttendance');
const R = require('../js/attendanceRules');

const TODAY = '2026-10-30'; // 1-okt — payshanba; Se·Pa·Sh: 1,3,6,8,10,13,15,17,20,22,24,27,29,31
const marks = days => Object.fromEntries(days.map(d => [d, 1]));
const keys = o => Object.keys(o || {}).map(Number).sort((a, b) => a - b);
const base = () => ({
    today: TODAY,
    teachers: { t: { name: 'Mohinur', schedulePattern: 'mwf', hire: '2026-01-01' } },
    students: {
        sps: { id: 'sps', name: 'Se·Pa·Sh', teacherId: 't', lessonDayOfWeek: 2, startDate: '2026-09-24' },
        late: { id: 'late', name: 'Kech boshlagan', teacherId: 't', lessonDayOfWeek: 4, startDate: '2026-10-05' },
        dcj: { id: 'dcj', name: 'Du·Ch·Ju', teacherId: 't', lessonDayOfWeek: 1, startDate: '2026-09-01' },
    },
    attendance: { '2026-10_t': { sps: marks([2, 5, 7, 9, 12]), late: marks([2, 5, 7, 9, 12, 14, 16, 19]), dcj: marks([2, 5, 7, 9]) } },
});
const apply = (input, changes) => {
    const att = JSON.parse(JSON.stringify(input.attendance));
    for (const ch of changes) for (const r of ch.students) att[ch.attKey][r.studentId] = r.after;
    return att;
};

test("Se·Pa·Sh o'quvchi: Du·Ch·Ju belgilari soni saqlangan holda eng erta o'z dars kunlariga ko'chadi", () => {
    const input = base();
    const { changes } = L.plan(input);
    assert.equal(changes.length, 1);
    const ch = changes[0];
    assert.equal(ch.attKey, '2026-10_t');
    const sps = ch.students.find(r => r.studentId === 'sps');
    assert.deepEqual(keys(sps.after), [1, 3, 6, 8, 10]);
    assert.deepEqual(sps.moves.map(m => [m.from, m.to]), [[2, 1], [5, 3], [7, 6], [9, 8], [12, 10]]);
    // Kursni 2026-10-05 dan boshlagan: 1 va 3-okt kutilmaydi.
    const late = ch.students.find(r => r.studentId === 'late');
    assert.deepEqual(keys(late.after), [6, 8, 10, 13, 15, 17, 20, 22]);
    assert.equal(ch.moved, 13); assert.equal(ch.unplaced, 0);
    // Du·Ch·Ju o'quvchiga tegilmaydi.
    assert.ok(!ch.students.some(r => r.studentId === 'dcj'));
    // Yangi qoida (2026-10, faqat o'z dars kunidagi "Keldi") endi hammasini sanaydi.
    const att = apply(input, changes)['2026-10_t'];
    const tot = R.monthTotals({ id: 't', month: '2026-10', students: Object.values(input.students), mainAtt: att, makeups: [],
        teacher: { schedulePattern: 'mwf' }, todayKey: TODAY, nowMin: 23 * 60 });
    assert.equal(tot.rows.find(r => r.id === 'sps').came, 5);
    assert.equal(tot.rows.find(r => r.id === 'late').came, 8);
    assert.equal(tot.rows.find(r => r.id === 'dcj').came, 4);
});

test('yakuniy (to\'langan / yopilgan) oy o\'zgartirilmaydi — faqat soni qaytadi', () => {
    const input = base();
    input.attendance['2026-09_t'] = { sps: marks([25, 28]) };
    input.final = new Set(['2026-09_t']);
    const { changes, finals } = L.plan(input);
    assert.deepEqual(changes.map(c => c.attKey), ['2026-10_t']);
    assert.deepEqual(finals, [{ attKey: '2026-09_t', month: '2026-09', teacherId: 't', count: 2 }]);
});

test("ikkinchi hisob — hech narsa o'zgarmaydi (natija barqaror)", () => {
    const input = base();
    const first = L.plan(input);
    const again = L.plan({ ...input, attendance: apply(input, first.changes) });
    assert.equal(again.changes.length, 0);
    assert.equal(again.finals.length, 0);
});

test("joy yetmasa — ortiqcha belgi joyida qoladi; kelajak, band kun, muzlatilgan kun va boshqa ustoz davri o'tkazib yuboriladi", () => {
    const input = base();
    input.students.sps.startDate = '2026-10-20';
    // 20, 22, 24, 27, 29 — o'z kunlar (31 — kelajak). 22 — "Kelmadi", 24 — muzlatilgan (24–25-okt).
    input.busy = { sps: new Set(['2026-10-22']) };
    input.statusRows = { sps: [{ status: 'frozen', from_date: '2026-10-24', to_date: '2026-10-25', created_at: '2026-10-23T00:00:00Z' }] };
    input.attendance['2026-10_t'].sps = marks([2, 5, 7, 9, 12]);
    let { changes } = L.plan(input);
    let sps = changes[0].students.find(r => r.studentId === 'sps');
    assert.deepEqual(sps.moves.map(m => m.to), [20, 27, 29]);
    assert.deepEqual(sps.unplaced, [9, 12]);
    assert.deepEqual(keys(sps.after), [9, 12, 20, 27, 29]);
    // Ustoz almashgan: 27-oktdan boshqa ustozda — 27, 29 shu ustozniki emas.
    input.students.sps.teacherId = 'b';
    input.history = { sps: [{ teacherId: 't', from: '2026-09-01' }, { teacherId: 'b', from: '2026-10-27' }] };
    ({ changes } = L.plan(input));
    sps = changes[0].students.find(r => r.studentId === 'sps');
    assert.deepEqual(sps.moves.map(m => m.to), [20]);
    assert.deepEqual(sps.unplaced, [5, 7, 9, 12]);
});

test("boshqa blokda belgilangan kun band; qiymat saqlanadi; tasodifiy (eski ekran ustunida bo'lmagan) kun tegilmaydi", () => {
    const input = base();
    input.attendance['2026-10_b'] = { sps: { 1: 1 } };
    input.attendance['2026-10_t'] = { sps: { 2: 1, 5: true, 4: 1 } }; // 4-okt — yakshanba: eski ekranda yo'q edi
    const { changes } = L.plan(input);
    const sps = changes[0].students.find(r => r.studentId === 'sps');
    assert.deepEqual(sps.moves, [{ from: 2, to: 3, value: 1 }, { from: 5, to: 6, value: true }]);
    assert.equal(sps.after[4], 1);
});

test("jonli dars yozuvi (liveGrades) belgi bilan birga yangi sanaga ko'chadi", () => {
    const input = base();
    const { changes } = L.plan(input);
    const g = { sps: [{ date: '2026-10-02', teacherId: 't', lessonId: 'l1' }, { date: '2026-10-05', teacherId: 'x', lessonId: 'lx' }, { date: '2026-10-07', lessonId: 'l3' }] };
    const { grades, touched } = L.moveGrades(g, changes);
    assert.deepEqual(grades.sps.map(x => x.date), ['2026-10-01', '2026-10-05', '2026-10-06']);
    assert.deepEqual(touched.sps.before, g.sps);
    assert.equal(g.sps[0].date, '2026-10-02'); // asl obyekt o'zgarmaydi
});
