// BAHO3 (29-okt qoidalari) — server tuzatishlari: o'quvchi o'sha kuni faol bo'lmagan (muzlatilgan / chiqib ketgan) kunga
// asosiy ustoz davomati yo'q va u maoshga ham, Davomat %ga ham sanalmaydi (bitta qoida — AttendanceRules.lessonCountsOn);
// [yordamchi-alohida] bir martalik ko'chirish qayta ishlamaydi. Bazasiz (soxta client bilan).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/attendanceRules');
const engine = require('../js/payrollEngine');
const { assertTeacherAttendanceWindow: check } = require('../server/services/teacherAttendanceRules');

const now = new Date('2026-10-27T12:27:00Z'); // Se 27-okt, 17:27 Toshkent
const shirin = { id: 'st-shi', lesson_day_of_week: 2, lesson_time: '15:00', extra_data: { frozen: true, startDate: '2026-09-01' } }; // Se·Pa·Sh
const ziyoda = { id: 'st-ziy', lesson_day_of_week: 1, lesson_time: '15:00', extra_data: { status: 'inactive' } };
const FROZEN = [{ status: 'frozen', from_date: '2026-10-20', to_date: '2026-11-10', created_at: '2026-10-19T10:00:00Z' }];
const LEFT = [{ status: 'left', from_date: '2026-10-01', to_date: null, created_at: '2026-10-01T10:00:00Z' }];
const clientWith = rows => ({ query: async sql => /to_regclass\('public\.school_student_status'\)/.test(sql) ? { rows: [{ t: 'school_student_status' }] }
    : /FROM school_student_status/.test(sql) ? { rows } : /to_regclass/.test(sql) ? { rows: [{ t: null }] } : { rows: [] } });
const run = (student, rows, date, present) => check(clientWith(rows), { student, teacherId: 'hr-dil', date, present, duty: 'main', now });

test('ustoz: muzlatilgan kunga Keldi ham, Kelmadi ham — 409; muzlatishdan oldingi dars kuni — mumkin; belgini olib tashlash — mumkin', async () => {
    await assert.rejects(run(shirin, FROZEN, '2026-10-22', true), e => e.status === 409 && /muzlatilgan/.test(e.message));
    await assert.rejects(run(shirin, FROZEN, '2026-10-24', false), e => e.status === 409);
    await run(shirin, FROZEN, '2026-10-17', true); // Sh, muzlatishdan oldin
    await run(shirin, FROZEN, '2026-10-22', null); // eski belgini olib tashlash cheklanmaydi
});
test('ustoz: chiqib ketgan o\'quvchiga (holat yozuvi yoki eski "inactive" belgisi) — 409', async () => {
    await assert.rejects(run(ziyoda, LEFT, '2026-10-05', true), e => e.status === 409 && /chiqib ketgan/.test(e.message));
    await assert.rejects(run(ziyoda, [], '2026-10-05', true), e => e.status === 409, 'yozuv yo\'q — joriy belgi');
    await assert.rejects(run({ ...shirin, extra_data: { frozen: true } }, [], '2026-10-17', true), e => e.status === 409);
});

test('AttendanceRules.lessonCountsOn / inMonth: sana bo\'yicha; yozuv yo\'q eski o\'quvchida kun cheklanmaydi; demo — hech qachon', () => {
    assert.equal(R.lessonCountsOn(shirin, FROZEN, '2026-10-19'), true);
    assert.equal(R.lessonCountsOn(shirin, FROZEN, '2026-10-20'), false);
    assert.equal(R.lessonCountsOn(shirin, FROZEN, '2026-11-11'), true);
    assert.equal(R.lessonCountsOn({ id: 'x' }, [], '2026-10-20'), true);
    assert.equal(R.lessonCountsOn({ isStaffDemo: true }, [], '2026-10-20'), false);
    // /api/state statusHistory shakli ({from, to, at}) ham bir xil.
    const hist = [{ status: 'frozen', from: '2026-10-20', to: '2026-11-10', at: '2026-10-19T10:00:00Z' }];
    assert.equal(R.lessonCountsOn(shirin, hist, '2026-10-21'), false);
    assert.equal(R.inMonth(shirin, hist, '2026-10'), true, '1–19-okt faol bo\'lgan');
    assert.equal(R.inMonth(shirin, [{ status: 'frozen', from: '2026-09-25', to: '2026-11-10' }], '2026-10'), false);
    assert.equal(R.inMonth(ziyoda, [{ status: 'left', from: '2026-10-01' }], '2026-10'), false);
    assert.equal(R.inMonth({ id: 'y', frozen: true }, [], '2026-10'), false, 'yozuv yo\'q — isActiveStudent');
});

test('AttendanceRules.monthTotals: muzlatilgan kundagi Keldi va qoplash sanalmaydi, kutilmaydi ham; oldingi kunlar sanaladi', () => {
    const s = { id: 'st-shi', lessonDayOfWeek: 2, startDate: '2026-09-01', statusHistory: [{ status: 'frozen', from: '2026-10-20', to: '2026-11-10' }] };
    // Se·Pa·Sh oktyabr: 1,3,6,8,10,13,15,17,20,22,24,27,29,31 (14 ta). 22-okt (muzlatilgan) eski "Keldi" — sanalmaydi.
    const mainAtt = { 'st-shi': { 1: 1, 3: 1, 6: 1, 22: 1 } };
    const makeups = [{ teacher_id: 't', student_id: 'st-shi', status: 'approved', kind: 'double', held_date: '2026-10-24' }];
    const T = R.monthTotals({ id: 't', month: '2026-10', students: [s], mainAtt, makeups, teacher: { schedulePattern: 'tts' }, todayKey: '2026-10-27' });
    assert.equal(T.plan, 8, 'oy rejasi — faol dars kunlari (1–17-okt), Davomat kartasi jami = o\'quvchi kartalari yig\'indisi');
    assert.equal(T.counted, 3);
    assert.equal(T.expected, 8, '1–17-okt dars kunlari; 20–27 muzlatilgan — kutilmaydi');
    assert.equal(T.approved, 0);
    // Holat tarixisiz (eski javob) — avvalgidek.
    const old = R.monthTotals({ id: 't', month: '2026-10', students: [{ ...s, statusHistory: undefined }], mainAtt, makeups, teacher: {}, todayKey: '2026-10-27' });
    assert.equal(old.counted, 5);
});

test('payrollEngine: muzlatilgan / chiqib ketgan kundagi "Keldi" va qoplash asosiy ustozga to\'lanmaydi (Davomat bilan bitta qoida); eski oylar qayta narxlanmaydi', () => {
    const base = { hrEmployees: [{ id: 'dil', name: 'Dilnoza', role: 'ingliz-oqituvchi', lang: 'english', startDate: '2026-09-01' }],
        teachers: [{ id: 'dil', schedulePattern: 'tts' }], leads: { english: [], russian: [] }, assistantAttendance: {},
        bonusHistory: [], bonusData: {}, cashFlow: [], salesPlan: {}, teacherAttendancePolicy: 'all-days-v1', makeupPolicy: 'approved-v1', makeupPolicyFrom: '2026-10',
        students: [{ id: 'st-shi', name: 'Shirin', teacherId: 'dil', lessonDuration: 60, lessonDayOfWeek: 2, startDate: '2026-09-01', frozen: true },
            { id: 'st-ziy', name: 'Ziyoda', teacherId: 'dil', lessonDuration: 60, lessonDayOfWeek: 1, status: 'inactive' }],
        mainAttendance: { '2026-10_dil': { 'st-shi': { 1: 1, 3: 1, 22: 1 }, 'st-ziy': { 5: 1 } }, '2026-09_dil': { 'st-shi': { 29: 1 } } },
        makeups: [{ status: 'approved', teacherId: 'dil', studentId: 'st-shi', kind: 'double', heldDate: '2026-10-24' }],
        studentStatus: { 'st-shi': FROZEN, 'st-ziy': LEFT } };
    const oct = engine.period('2026-10-01', '2026-10-31'), settings = engine.defaults();
    const row = engine.calculate(base, settings, oct, 'english').rows.find(r => r.employeeId === 'dil');
    const shi = row.breakdown.find(b => b.studentId === 'st-shi');
    assert.equal(shi.lessons, 2, '1 va 3-okt — muzlatishdan oldin; 22-okt Keldi va 24-okt qoplash — muzlatilgan');
    assert.equal(shi.earned, Math.round(300000 * 2 / 14));
    assert.equal(row.breakdown.find(b => b.studentId === 'st-ziy')?.lessons || 0, 0);
    // Holat ma'lumoti bo'lmasa (eski asos) — avvalgidek sanaladi.
    const noStatus = engine.calculate({ ...base, studentStatus: undefined }, settings, oct, 'english').rows.find(r => r.employeeId === 'dil');
    assert.equal(noStatus.breakdown.find(b => b.studentId === 'st-shi').lessons, 4);
    // Sentyabr (approved-v1 dan oldingi siyosat) — holat filtri qo'llanmaydi, to'langan oylar qayta narxlanmaydi.
    const sepSource = { ...base, studentStatus: { 'st-shi': [{ status: 'frozen', from_date: '2026-09-20', to_date: '2026-09-30' }] } };
    const sep = engine.calculate(sepSource, settings, engine.period('2026-09-01', '2026-09-30'), 'english').rows.find(r => r.employeeId === 'dil');
    assert.equal(sep.breakdown.find(b => b.studentId === 'st-shi').lessons, 1);
});

test('[yordamchi-alohida]: topilmasa ham natija bir marta yoziladi — keyingi ishga tushishlarda qidiruv ham, log ham yo\'q', async () => {
    const { migrate, MIGRATION_ID } = require('../server/services/school/assistantSeparation');
    const done = new Map(), logs = [];
    const log = { log: m => logs.push(m), warn: m => logs.push(m) };
    let hrQueries = 0;
    const exec = async (sql, params) => {
        if (/CREATE TABLE IF NOT EXISTS school_migrations/.test(sql)) return { rows: [] };
        if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql) || /pg_advisory_xact_lock/.test(sql)) return { rows: [] };
        if (/SELECT result FROM school_migrations/.test(sql)) return { rows: done.has(params[0]) ? [{ result: done.get(params[0]) }] : [] };
        if (/INSERT INTO school_migrations/.test(sql)) { done.set(params[0], JSON.parse(params[1])); return { rows: [] }; }
        if (/FROM hr_employees WHERE COALESCE\(status/.test(sql)) { hrQueries++; return { rows: [] }; }
        if (/FROM students s\s+JOIN hr_employees/.test(sql)) return { rows: [{ id: 's1', name: 'S', subject: 'english', extra_data: {}, aid: 'm', aname: 'Mohinur' }] };
        throw Error('SQL: ' + sql);
    };
    const pool = { query: exec, connect: async () => ({ query: exec, release() {} }) };
    const first = await migrate(pool, log);
    assert.equal(first.skipped, 'not-found');
    assert.equal(done.get(MIGRATION_ID).skipped, 'not-found');
    assert.equal(logs.length, 2, 'topilmadi + "hali biriktirilgan" ogohlantirishi — bir marta');
    const second = await migrate(pool, log);
    assert.equal(second.skipped, 'already-done');
    assert.equal(hrQueries, 2, 'ikkinchi ishga tushishda HR qidirilmaydi');
    assert.equal(logs.length, 2, 'log takrorlanmaydi');
});

test('state.js: ustoz uchun ishlatilmaydigan PATCH ruxsat ro\'yxati yo\'q (ustoz baribir 403)', () => {
    const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../server/routes/state.js'), 'utf8');
    const patch = src.slice(src.indexOf("router.patch('/'"), src.indexOf("router.post('/teacher-attendance'"));
    assert.match(patch, /if \(req\.user\.role === 'teacher'\) return res\.status\(403\)/);
    assert.doesNotMatch(patch, /\['mainAttendance', 'assistantAttendance', 'liveGrades'\]/);
});

test('"Keldi" ustun: qoldirilgan kunida "Keldi" bo\'lgan tasdiqlangan qoplash maoshga ham, Davomat %ga ham o\'tmaydi (ikki marta to\'lov yo\'q)', () => {
    const base = { hrEmployees: [{ id: 'dil', name: 'Dilnoza', role: 'ingliz-oqituvchi', lang: 'english', startDate: '2026-09-01' }],
        teachers: [{ id: 'dil', schedulePattern: 'tts' }], leads: { english: [], russian: [] }, assistantAttendance: {},
        bonusHistory: [], bonusData: {}, cashFlow: [], salesPlan: {}, teacherAttendancePolicy: 'all-days-v1', makeupPolicy: 'approved-v1', makeupPolicyFrom: '2026-10',
        students: [{ id: 'st-bek', name: 'Bekzod', teacherId: 'dil', lessonDuration: 60, lessonDayOfWeek: 2, startDate: '2026-09-01' }],
        // 22-okt (Pa) — "Keldi"; 22-okt o'rniga 23-okt (Ju) qoplash tasdiqlangan; 15-okt (Kelmadi) o'rniga 25-okt (Ya) qoplash — haqiqiy.
        mainAttendance: { '2026-10_dil': { 'st-bek': { 20: 1, 22: 1 } } },
        makeups: [{ status: 'approved', teacherId: 'dil', studentId: 'st-bek', kind: 'separate', heldDate: '2026-10-23', missedDate: '2026-10-22' },
            { status: 'approved', teacherId: 'dil', studentId: 'st-bek', kind: 'separate', heldDate: '2026-10-25', missedDate: '2026-10-15' }] };
    const oct = engine.period('2026-10-01', '2026-10-31');
    const b = engine.calculate(base, engine.defaults(), oct, 'english').rows.find(r => r.employeeId === 'dil').breakdown.find(x => x.studentId === 'st-bek');
    assert.equal(b.lessons, 3, '20, 22 Keldi + 25-okt haqiqiy qoplash; 23-okt (22-okt Keldi bo\'lgan) — sanalmaydi');
    assert.equal(b.makeups, 1);
    // Boshqa ustoz blokidagi "Keldi" ham ustun (ustoz almashgan oy).
    const other = { ...base, mainAttendance: { '2026-10_dil': { 'st-bek': { 20: 1 } }, '2026-10_gul': { 'st-bek': { 22: 1 } } } };
    assert.equal(engine.calculate(other, engine.defaults(), oct, 'english').rows.find(r => r.employeeId === 'dil').breakdown.find(x => x.studentId === 'st-bek').makeups, 1);
    const T = R.monthTotals({ id: 'dil', month: '2026-10', students: [{ id: 'st-bek', lessonDayOfWeek: 2, startDate: '2026-09-01' }], mainAtt: { 'st-bek': { 20: 1, 22: 1 } },
        makeups: base.makeups.map(m => ({ teacher_id: 'dil', student_id: m.studentId, status: m.status, kind: m.kind, held_date: m.heldDate, missed_date: m.missedDate })),
        teacher: { schedulePattern: 'tts' }, todayKey: '2026-10-27' });
    assert.equal(T.counted, 3); assert.equal(T.approved, 1);
});

test('Reyting: muzlatishdan oldingi darslar sanaladi (inMonth) — Davomat % va maosh bilan bir xil; muzlatilgan kundagi belgi — yo\'q', () => {
    const { computeTeacherRating } = require('../server/services/teacherRating');
    const now = new Date('2026-10-27T12:00:00Z');
    const state = { teachers: [{ id: 't', name: 'T', type: 'asosiy', schedulePattern: 'tts' }],
        students: [{ id: 'shi', teacherId: 't', lessonDayOfWeek: 2, lessonTime: '15:00', startDate: '2026-09-01', frozen: true,
            statusHistory: [{ status: 'frozen', from: '2026-10-20', to: '2026-11-10' }] },
            { id: 'ziy', teacherId: 't', lessonDayOfWeek: 2, lessonTime: '15:00', status: 'inactive', statusHistory: [{ status: 'left', from: '2026-09-20' }] }],
        mainAttendance: { '2026-10_t': { shi: { 1: 1, 3: 1, 22: 1 }, ziy: { 1: 1 } } } };
    const row = computeTeacherRating(state, 'asosiy', now).find(r => r.id === 't');
    assert.equal(row.completed, 2, '1 va 3-okt; 22-okt muzlatilgan; Ziyoda oktyabrda faol emas');
    assert.equal(row.expected, 8, 'Se·Pa·Sh 1–17-okt');
});

test('staffNotify "Qayta urinish kerak": ochiq "Admin orqali so\'rov" (assist_late) bor o\'quvchi/kun istisno; Profil "Ish vaqti" — js/workHours.text', () => {
    const fs = require('node:fs'), path = require('node:path');
    const notify = fs.readFileSync(path.join(__dirname, '../server/services/staffNotify.js'), 'utf8');
    const q = notify.slice(notify.indexOf("outcome='no_answer'"), notify.indexOf("title: 'Qayta urinish kerak'"));
    assert.match(q, /NOT EXISTS \(SELECT 1 FROM school_requests r WHERE r\.type='assist_late' AND r\.status='new'/);
    const st = fs.readFileSync(path.join(__dirname, '../server/services/staffSettings.js'), 'utf8');
    assert.match(st, /require\('\.\.\/\.\.\/js\/workHours'\)\.text\(hours\)/);
    const W = require('../js/workHours');
    assert.equal(W.text([{ weekday: 1, start_min: 600, end_min: 1260 }, { weekday: 1, start_min: 720, end_min: 1200 }, { weekday: 2, start_min: 600, end_min: 1260 }]), 'Du·Se 10:00–21:00');
});
