// Jarimalar — sof qoidalar: summa, chegara, 1-kechikish ogohlantirish, yuvish, ko'rish huquqi, kuchga kirish sanasi.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../server/services/fines/rules');

const cfg = R.normalizeConfig(null);
const day = (date, status, extra = {}) => ({ date, status, lateMinutes: 0, earlyMinutes: 0, ...extra });

test('kechikish pog‘onalari: imtiyoz 5 daq, oyning 1-kechikishi ogohlantirish', () => {
    const f = R.attendanceFines([
        day('2026-10-01', 'late', { lateMinutes: 4 }),   // imtiyoz ichida — yo'q
        day('2026-10-02', 'late', { lateMinutes: 9 }),   // 1-kechikish — ogohlantirish
        day('2026-10-05', 'on_time'),
        day('2026-10-06', 'late', { lateMinutes: 14 }),  // 10 000
        day('2026-10-07', 'on_time'),
        day('2026-10-08', 'late', { lateMinutes: 20 }),  // 25 000
        day('2026-10-09', 'on_time'),
        day('2026-10-12', 'late', { lateMinutes: 45 }),  // 50 000
    ], cfg, 'sales');
    assert.deepEqual(f.map(x => [x.date, x.amount, x.warning]), [['2026-10-02', 0, true], ['2026-10-06', 10000, false], ['2026-10-08', 25000, false], ['2026-10-12', 50000, false]]);
    // keyingi oy — yana birinchi kechikish ogohlantirish
    const g = R.attendanceFines([day('2026-10-02', 'late', { lateMinutes: 9 }), day('2026-11-03', 'late', { lateMinutes: 9 })], cfg, 'sales');
    assert.deepEqual(g.map(x => x.warning), [true, true]);
});

test('3 kun ketma-ket kechikish — qo‘shimcha; dam olish kuni seriyani uzmaydi; erta ketish, ketish yo‘q, kelmaslik', () => {
    const f = R.attendanceFines([
        day('2026-10-02', 'late', { lateMinutes: 10 }), day('2026-10-03', 'late', { lateMinutes: 10 }), day('2026-10-04', 'off'),
        day('2026-10-05', 'late', { lateMinutes: 10 }),
        day('2026-10-06', 'on_time', { earlyMinutes: 40 }), day('2026-10-07', 'on_time', { noCheckout: true }), day('2026-10-08', 'absent'),
    ], cfg, 'sales');
    const codes = f.map(x => x.code);
    assert.ok(codes.includes('late_streak3'));
    assert.equal(f.find(x => x.code === 'late_streak3').date, '2026-10-05');
    assert.deepEqual(['early_leave', 'no_checkout', 'absent'].map(c => f.find(x => x.code === c)?.amount), [25000, 10000, 150000]);
    assert.equal(new Set(f.map(x => x.ref)).size, f.length, 'har jarimaning barqaror ref kaliti');
});

test('tasdiqlangan so‘rov (Sababli), ta‘til, kutilayotgan so‘rov — jarima yo‘q; ustoz uchun davomat qoidasi yo‘q', () => {
    const f = R.attendanceFines([day('2026-10-02', 'excused', { lateMinutes: 0 }), day('2026-10-03', 'leave'), day('2026-10-05', 'pending'), day('2026-10-06', 'waiting')], cfg, 'sales');
    assert.equal(f.length, 0);
    assert.equal(R.attendanceFines([day('2026-10-02', 'absent')], cfg, 'teacher').length, 0);
    assert.ok(cfg.roles.teacher.some(r => r.code === 'lesson_late'));
    assert.ok(!('admin' in cfg.roles));
});

test('o‘chirilgan qoida va "1-marta ogohlantirish" o‘chirilsa', () => {
    const c = R.normalizeConfig({ ...cfg, roles: { ...cfg.roles, sales: cfg.roles.sales.map(r => r.code === 'late_1' ? { ...r, warnFirst: false } : r.code === 'absent' ? { ...r, active: false } : r) } });
    const f = R.attendanceFines([day('2026-10-02', 'late', { lateMinutes: 9 }), day('2026-10-03', 'absent')], c, 'sales');
    assert.deepEqual(f.map(x => [x.code, x.amount]), [['late_1', 10000]]);
});

test('oylik chegara 10%, yuvilgan summa, "Toza oy" bonusi', () => {
    const fines = [{ id: 'a', amount: 400000, state: 'active' }, { id: 'b', amount: 300000, state: 'active', washed: 50000 }, { id: 'c', amount: 0, warning: true, state: 'active' }];
    const s = R.monthSummary(fines, 6200000, cfg);
    assert.deepEqual([s.gross, s.washed, s.net, s.cap, s.deducted, s.overCap, s.bonus, s.takeHome], [700000, 50000, 650000, 620000, 620000, 30000, 0, 5580000]);
    const clean = R.monthSummary([{ id: 'w', amount: 0, warning: true, state: 'active' }], 5000000, cfg);
    assert.deepEqual([clean.deducted, clean.bonus, clean.takeHome], [0, 100000, 5100000]);
    const nosal = R.monthSummary([{ id: 'a', amount: 35000, state: 'active' }], null, cfg);
    assert.deepEqual([nosal.cap, nosal.deducted, nosal.takeHome], [null, 35000, null]);
    assert.equal(R.monthSummary([{ id: 'a', amount: 35000, state: 'cancelled' }], 1000000, cfg).deducted, 0, 'bekor qilingan (e‘tiroz qabul) hisoblanmaydi');
});

test('yuvish: narxlar, eng kichigi birinchi, kelmaslik ko‘pi bilan 50%, muddat keyingi oyning 4-sanasi', () => {
    assert.equal(R.washValue('hours', { minutes: 90 }, cfg), 37500);
    assert.equal(R.washValue('sunday', {}, cfg), 100000);
    assert.equal(R.washValue('learning', {}, cfg), 15000);
    assert.equal(R.washValue('task', { amount: 20000 }, cfg), 20000);
    const fines = [{ id: 'abs', code: 'absent', amount: 150000, state: 'active' }, { id: 'l', code: 'late_1', amount: 10000, state: 'active' }, { id: 'e', code: 'early_leave', amount: 25000, state: 'active' }];
    const a = R.allocateWash(fines, 200000, cfg);
    assert.deepEqual(a.parts, [{ id: 'l', amount: 10000 }, { id: 'e', amount: 25000 }, { id: 'abs', amount: 75000 }]);
    assert.equal(a.unused, 90000);
    assert.equal(R.washable({ code: 'absent', amount: 150000, washed: 75000 }, cfg), 0);
    assert.deepEqual(R.allocateWash(fines, 5000, cfg, 'e').parts, [{ id: 'e', amount: 5000 }]);
    assert.equal(R.washDeadline('2026-10-30'), '2026-11-04');
    assert.equal(R.washDeadline('2026-12-15'), '2027-01-04');
    assert.equal(R.canWash('2026-10-30', '2026-11-04'), true);
    assert.equal(R.canWash('2026-10-30', '2026-11-05'), false);
    assert.equal(R.appealUntil('2026-10-30', cfg), '2026-11-01');
});

test('10 ish kuni ketma-ket vaqtida — avtomatik yuvish; kechikish seriyani boshlaydi', () => {
    const days = [];
    for (let i = 1; i <= 15; i++) { const d = `2026-10-${String(i).padStart(2, '0')}`; days.push(day(d, new Date(d + 'T00:00:00Z').getUTCDay() === 0 ? 'off' : i === 3 ? 'late' : 'on_time')); }
    const s = R.streakWashes(days, cfg);
    // 4- va 11-oktyabr yakshanba; 3-oktyabr kechikish → 5..10, 12..15 = 10 ish kuni
    assert.deepEqual([s.dates, s.progress], [['2026-10-15'], 0]);
    assert.equal(R.streakWashes(days.slice(0, 8), cfg).progress, 4); // 5..8
});

test('ko‘rish va boshqarish: egasi, o‘z tilidagi ROP (sotuv), akademik rahbar (ustoz/yordamchi), admin', () => {
    const ali = { employeeId: 'e1', role: 'sales', lang: 'english' }, yor = { employeeId: 'e2', role: 'assistant', lang: 'russian' };
    const ropEn = { kind: 'rop', langs: ['english'] }, ropRu = { kind: 'rop', langs: ['russian'] }, ak = { kind: 'academic', langs: ['russian'] };
    assert.equal(R.canSee({ kind: 'sales', employeeId: 'e1' }, ali), true);
    assert.equal(R.canSee({ kind: 'sales', employeeId: 'e9' }, ali), false, 'hamkasb ko‘rmaydi');
    assert.equal(R.canSee(ropEn, ali), true);
    assert.equal(R.canSee(ropRu, ali), false);
    assert.equal(R.canManage(ak, yor), true);
    assert.equal(R.canManage(ak, ali), false);
    assert.equal(R.canManage(ropEn, yor), false);
    assert.equal(R.canSee({ kind: 'admin' }, yor), true);
    assert.equal(R.canSee({ kind: 'hr', employeeId: 'h' }, ali), false, 'HR boshqalar jarimasini ko‘rmaydi');
});

test('kuchga kirish: sozlama keyingi oyning 1-sanasidan; orqaga qarab ishlamaydi', () => {
    assert.equal(R.nextMonthStart('2026-11-02'), '2026-12-01');
    assert.equal(R.nextMonthStart('2026-12-31'), '2027-01-01');
    const v2 = R.defaultConfig(); v2.roles.sales = v2.roles.sales.map(r => r.code === 'late_2' ? { ...r, amount: 30000 } : r);
    const versions = [{ effective: '2026-01-01', data: null, seq: 1 }, { effective: '2026-12-01', data: v2, seq: 2 }];
    const amt = date => R.configFor(versions, date).roles.sales.find(r => r.code === 'late_2').amount;
    assert.equal(amt('2026-11-30'), 25000);
    assert.equal(amt('2026-12-01'), 30000);
    assert.equal(amt('2027-02-10'), 30000);
    // bir oyda ikki marta saqlansa — oxirgisi
    const v3 = R.defaultConfig(); v3.soft.graceMinutes = 7;
    assert.equal(R.configFor([...versions, { effective: '2026-12-01', data: v3, seq: 3 }], '2026-12-05').soft.graceMinutes, 7);
});

test('sozlama tozalanadi: manfiy summa, chegaradan tashqari foiz, takroriy kod', () => {
    const c = R.normalizeConfig({ roles: { sales: [{ code: 'late_1', amount: -5 }, { code: 'late_1', amount: 1 }, { code: 'Yangi qoida!', label: 'Yangi', amount: 5000 }] }, soft: { capPercent: 300, graceMinutes: -1 } });
    assert.deepEqual(c.roles.sales.map(r => [r.code, r.amount]), [['late_1', 10000], ['yangiqoida', 5000]]);
    assert.deepEqual([c.soft.capPercent, c.soft.graceMinutes], [10, 5]);
});
