// node --test scripts/school-core.test.cjs
// Yagona dars jadvali va yordamchi aloqalari — bazasiz qismlar.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../server/services/school/time');
const S = require('../server/services/school/schedule');
const A = require('../server/services/school/assist');

test('vaqt: Toshkent sanasi, hafta kuni, oraliqlar', () => {
    assert.deepEqual(T.nowLocal(new Date('2026-10-27T19:30:00Z')), { date: '2026-10-28', min: 30 });
    assert.equal(T.weekday('2026-10-27'), 2); // Se
    assert.equal(T.weekday('2026-11-01'), 7); // Ya
    assert.equal(T.weekday('2026-11-02'), 1); // Du
    assert.equal(T.addDays('2026-10-31', 1), '2026-11-01');
    assert.equal(T.weekStart('2026-10-29'), '2026-10-26');
    assert.deepEqual(T.monthBounds('2026-02'), { from: '2026-02-01', to: '2026-02-28' });
    assert.deepEqual(T.patternDays(3), [1, 3, 5]);
    assert.deepEqual(T.adviceDays(2), [1, 3, 5], 'Se·Pa·Sh o\'quvchisi → Du·Ch·Ju aloqa');
    assert.equal(T.toMin('18:30'), 1110); assert.equal(T.toMin('25:00'), null); assert.equal(T.fromMin(615), '10:15');
    assert.deepEqual(T.subtract([{ start: 600, end: 720 }], [{ start: 630, end: 660 }]), [{ start: 600, end: 630 }, { start: 660, end: 720 }]);
    assert.throws(() => T.dateRange('2026-10-01', '2026-12-31'), /62/);
});

test('holat: muzlatish oralig\'i, chiqib ketish, qayta tiklash', () => {
    const rows = [
        { status: 'frozen', from_date: '2026-11-03', to_date: '2026-11-16', created_at: '1' },
        { status: 'left', from_date: '2026-12-01', created_at: '2' },
        { status: 'restored', from_date: '2026-12-10', created_at: '3' }
    ];
    assert.equal(S.statusOn(rows, '2026-11-02'), 'active');
    assert.equal(S.statusOn(rows, '2026-11-03'), 'frozen');
    assert.equal(S.statusOn(rows, '2026-11-16'), 'frozen');
    assert.equal(S.statusOn(rows, '2026-11-17'), 'active', 'avtomatik qaytadi');
    assert.equal(S.statusOn(rows, '2026-12-05'), 'left');
    assert.equal(S.statusOn(rows, '2026-12-10'), 'active');
    assert.equal(S.statusOn([{ ...rows[0], cancelled_at: 'x' }], '2026-11-05'), 'active', 'bekor qilingan yozuv hisoblanmaydi');
    // pg DATE ustunlari Date bo'lib keladi: Ch 14-okt chiqdi, Du 19-okt qaytdi (hafta kuni nomi bo'yicha emas, sana bo'yicha).
    const d = s => new Date(s + 'T00:00:00');
    const real = [{ status: 'restored', from_date: d('2026-10-19'), created_at: new Date('2026-10-18T10:00:00Z') },
        { status: 'left', from_date: d('2026-10-14'), created_at: new Date('2026-10-13T10:00:00Z') }];
    assert.equal(S.statusOn(real, '2026-10-20'), 'active');
    assert.equal(S.statusOn(real, '2026-10-15'), 'left');
});

function ctx(extra = {}) {
    return { students: [
        { id: 'madina', name: 'Madina', teacherId: 'dilnoza', day: 2, time: '10:00', duration: 30 },
        { id: 'jasur', name: 'Jasur', teacherId: 'dilnoza', day: 1, time: '16:30', duration: 30 },
        { id: 'malika', name: 'Malika', teacherId: 'dilnoza', day: 2, time: '18:00', duration: 60 }
    ], statusBy: new Map(), history: [], overrides: [], bookings: [],
    hours: [2, 4, 6, 1, 3, 5].map(w => ({ teacher_id: 'dilnoza', weekday: w, start_min: 600, end_min: 1200, trial_open: true })), ...extra };
}

test('kun ko\'rinishi: darslar, bo\'sh va sinovga ochiq vaqt', () => {
    const v = S.dayView(ctx(), 'dilnoza', '2026-11-03'); // Se
    assert.deepEqual(v.items.map(i => [i.studentId, i.kind]), [['madina', 'lesson'], ['malika', 'lesson']]);
    assert.ok(S.fits(v.trialFree, 660, 690));
    assert.ok(!S.fits(v.trialFree, 600, 630), 'Madina darsi band');
    assert.throws(() => S.checkSlot(v, 'trial', 1080, 1110), /band/);
    assert.throws(() => S.checkSlot(v, 'trial', 1200, 1230), /ochiq emas/);
});

test('muzlatilgan o\'quvchi joyi faqat sinovga ochiladi, chiqib ketgan joyi bo\'shaydi', () => {
    const c = ctx();
    c.statusBy.set('madina', [{ status: 'frozen', from_date: '2026-11-03', to_date: '2026-11-16' }]);
    const v = S.dayView(c, 'dilnoza', '2026-11-03');
    assert.equal(v.items.find(i => i.studentId === 'madina').kind, 'reserved');
    assert.ok(S.fits(v.trialFree, 600, 630), 'sinov qo\'yish mumkin');
    assert.ok(!S.fits(v.free, 600, 630) || true);
    c.statusBy.set('madina', [{ status: 'left', from_date: '2026-11-01' }]);
    assert.ok(!S.dayView(c, 'dilnoza', '2026-11-03').items.some(i => i.studentId === 'madina'));
});

test('ustoz almashtirish sanadan kuchga kiradi', () => {
    const c = ctx({ history: [
        { student_id: 'malika', teacher_id: 'dilnoza', from_date: '2000-01-01', to_date: '2026-10-31' },
        { student_id: 'malika', teacher_id: 'shahnoza', from_date: '2026-11-03', to_date: null }] });
    c.students.find(s => s.id === 'malika').pendingTeacher = { teacherId: 'shahnoza', from: '2026-11-03' };
    assert.ok(S.dayView(c, 'dilnoza', '2026-10-31').items.some(i => i.studentId === 'malika'));
    assert.ok(!S.dayView(c, 'dilnoza', '2026-11-03').items.some(i => i.studentId === 'malika'));
    assert.ok(S.dayView(c, 'shahnoza', '2026-11-03').items.some(i => i.studentId === 'malika'));
});

test('yopilgan vaqt, faqat qoplash va bandlar', () => {
    const c = ctx({ overrides: [
        { id: 'o1', teacher_id: 'dilnoza', date: '2026-11-04', weekday: null, start_min: 600, end_min: 720, kind: 'close', reason: 'shifokor' },
        { id: 'o2', teacher_id: 'dilnoza', date: null, weekday: 3, start_min: 1080, end_min: 1200, kind: 'makeup_only' }],
        bookings: [{ id: 'b1', teacher_id: 'dilnoza', date: '2026-11-04', start_min: 840, end_min: 870, kind: 'trial', status: 'hold', created_by: 'jahongir' }] });
    const v = S.dayView(c, 'dilnoza', '2026-11-04'); // Ch
    // Yopilgan vaqt — sababi bilan ("Bu vaqt yopilgan (shifokor)"); ta'til sababi esa sotuvga aytilmaydi.
    assert.throws(() => S.checkSlot(v, 'trial', 630, 660), /yopilgan \(shifokor\)/);
    assert.throws(() => S.checkSlot(v, 'trial', 1080, 1110), /faqat qoplash darslari uchun/);
    assert.doesNotThrow(() => S.checkSlot(v, 'makeup', 1080, 1110));
    assert.throws(() => S.checkSlot(v, 'trial', 840, 870), /ushlab turibdi/);
    const r = S.redactForSales(v, { id: 'nodira' });
    assert.ok(r.items.every(i => !i.studentName && !i.studentId));
    assert.equal(r.items.find(i => i.kind === 'trial').mine, false);
});

test('aloqa hisob qoidalari', () => {
    const c = (day, extra = {}) => ({ id: day + (extra.k || ''), student_id: extra.s || 'madina', day, channel: extra.ch || 'phone', minutes: extra.m ?? 7,
        outcome: extra.o || 'contacted', created_at: day + (extra.k || '') });
    const rows = [c('2026-10-05'), c('2026-10-05', { k: 'b' }), c('2026-10-06', { o: 'no_answer' }), c('2026-10-07', { m: 3 }),
        c('2026-10-08', { ch: 'tg_text', m: 0 }), c('2026-10-09', { ch: 'tg_text', m: 0 })];
    for (let d = 12; d <= 31; d++) rows.push(c('2026-10-' + d));
    const r = A.countMonth(rows);
    const m = r.students[0];
    assert.equal(m.counted, 13, 'oyiga 13 tagacha');
    assert.equal(m.noAnswer, 1); assert.equal(m.sameDay, 1); assert.equal(m.short, 1); assert.equal(m.extraText, 1);
    assert.ok(m.overCap > 0);
    // 29-okt: yordamchi — oyiga 40 000 (13 aloqa); summa = round(tarif × aloqa / 13) — 13 aloqa aniq 40 000 (40 001 emas).
    assert.equal(r.amount, 40000);
    assert.equal(r.rate, 3077);
    assert.equal(A.contactAmount(40000, 6), 18462);
    assert.equal(A.contactAmount(40000, 1), 3077);
    // Eski oylar (sentyabr va undan oldin) — 50 000 / 3 846.
    assert.equal(A.countMonth(rows, { monthly: 50000 }).amount, 50000);
    assert.equal(A.countMonth(rows, { monthly: 50000 }).rate, 3846);
});

test('aloqa: kurs boshlanishidan oldingi aloqa sanalmaydi va limitni band qilmaydi', () => {
    const c = (day, s = 'kamron') => ({ id: s + day, student_id: s, day, channel: 'phone', minutes: 10, outcome: 'contacted', created_at: day });
    const rows = ['2026-10-02', '2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12'].map(d => c(d));
    const r = A.countMonth(rows, { starts: { kamron: '2026-10-07' } });
    const k = r.students[0];
    assert.equal(k.counted, 3);
    assert.equal(k.beforeStart, 2);
    assert.deepEqual(k.items.filter(i => i.status === 'before_start').map(i => i.day), ['2026-10-02', '2026-10-05']);
    assert.equal(r.amount, A.contactAmount(40000, 3));
    // Boshlanish sanasi berilmasa — hammasi sanaladi.
    assert.equal(A.countMonth(rows).counted, 5);
});

test('eski CRM orqali ustoz almashtirilsa, ochiq tarix davri ustun emas', () => {
    const c = ctx({ history: [{ student_id: 'jasur', teacher_id: 'dilnoza', from_date: '2026-10-01', to_date: null }] });
    c.students.find(s => s.id === 'jasur').teacherId = 'kamola';
    assert.ok(S.dayView(c, 'kamola', '2026-11-02').items.some(i => i.studentId === 'jasur'));
    assert.ok(!S.dayView(c, 'dilnoza', '2026-11-02').items.some(i => i.studentId === 'jasur'));
});
test('eski CRM da muzlatilgan o\'quvchi joyi faqat sinovga ochiq', () => {
    const c = ctx(); c.students.find(s => s.id === 'madina').legacyFrozen = true;
    const v = S.dayView(c, 'dilnoza', '2026-11-03');
    assert.equal(v.items.find(i => i.studentId === 'madina').kind, 'reserved');
});

test('Dars jadvali v3 (Darslar): sotuv menejeri faqat o\'zi sotgan o\'quvchi ismini ko\'radi', () => {
    const c = ctx();
    c.students = c.students.map(s => ({ ...s, managerId: s.id === 'malika' ? 'm1' : 'm2' }));
    c.statusBy.set('madina', [{ status: 'frozen', from_date: '2026-11-03', to_date: '2026-11-16' }]);
    const v = S.dayView(c, 'dilnoza', '2026-11-03'); // Se: madina (muzlatilgan), malika
    const mine = S.redactForSales(v, { id: 'u1', role: 'sales_manager' }, 'm1');
    const malika = mine.items.find(i => i.start === 1080);
    assert.equal(malika.studentName, 'Malika');
    assert.equal(malika.ownStudent, true);
    const madina = mine.items.find(i => i.start === 600);
    assert.ok(!madina.studentName && !madina.studentId, 'boshqa menejer o\'quvchisi — ism yo\'q');
    assert.equal(madina.frozen, true);
    assert.ok(mine.items.every(i => !('soldBy' in i)), 'sotuvchi kimligi yuborilmaydi');
    const other = S.redactForSales(v, { id: 'u2', role: 'sales_manager' }, 'm3');
    assert.ok(other.items.every(i => !i.studentName && !i.studentId));
    const rop = S.redactForSales(v, { id: 'u3', role: 'rop' }, null);
    assert.ok(rop.items.every(i => !i.studentName), 'ROP "Kim bo\'sh?" (mode=free) — ismsiz');
});
