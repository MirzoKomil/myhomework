// Davomat v2 (Jamoa ilovasi): kim kuzatiladi, so'rov kimga boradi, ruxsat bilan kech kelish, ish vaqtidan tashqari belgilash.
// Sof funksiyalar (bazasiz): node --test scripts/davomat-faceid.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../server/services/staffAttendance/rules');
const time = require('../server/services/staffAttendance/time');

const settings = rules.normalizeSettings({});
const at = (date, clock) => time.atTashkent(date, time.parseClock(clock));
const day = { start: '09:00', end: '18:00' };
const monday = '2026-11-02';

test('kim kuzatiladi: sotuv, ROP, HR, akademik rahbar, yordamchi — ha; asosiy ustoz, targetolog, admin — yo‘q', () => {
    assert.equal(rules.roleTracked({ userRole: 'sales_manager', empRole: 'sotuv-menejeri' }), true);
    assert.equal(rules.roleTracked({ userRole: 'rop', empRole: 'rop' }), true);
    assert.equal(rules.roleTracked({ userRole: 'hr', empRole: 'hr' }), true);
    assert.equal(rules.roleTracked({ userRole: 'employee', empRole: 'head-of-teachers' }), true);
    assert.equal(rules.roleTracked({ userRole: 'teacher', empRole: 'yordamchi' }), true);
    assert.equal(rules.roleTracked({ userRole: 'teacher', empRole: 'rus-oqituvchi' }), false);
    assert.equal(rules.roleTracked({ userRole: 'targetolog', empRole: 'targetolog' }), false);
    assert.equal(rules.roleTracked({ userRole: 'admin' }), false);
    // HR ro'yxatidagi lavozim bo'yicha (login yo'q xodim ham)
    assert.equal(rules.roleTracked({ empRole: 'ingliz-oqituvchi' }), false);
    assert.equal(rules.roleTracked({ empRole: 'sotuv-menejeri' }), true);
});

test('so‘rov yo‘nalishi: sotuv → ROP, yordamchi → akademik rahbar, ROP/HR/akademik → admin', () => {
    assert.equal(rules.approverKind({ userRole: 'sales_manager', empRole: 'sotuv-menejeri' }), 'rop');
    assert.equal(rules.approverKind({ userRole: 'teacher', empRole: 'yordamchi' }), 'academic');
    assert.equal(rules.approverKind({ userRole: 'rop', empRole: 'rop' }), 'admin');
    assert.equal(rules.approverKind({ userRole: 'hr', empRole: 'hr' }), 'admin');
    assert.equal(rules.approverKind({ userRole: 'employee', empRole: 'head-of-teachers' }), 'admin');
});

test('tasdiqlovchi faqat o‘ziga va o‘z tilidagi so‘rovni hal qiladi; direktor — hammasini', () => {
    const rop = rules.approverScope({ userRole: 'rop', empRole: 'rop', langs: ['russian'] });
    const ak = rules.approverScope({ userRole: 'employee', empRole: 'head-of-teachers', langs: ['english'] });
    const admin = rules.approverScope({ userRole: 'admin' });
    assert.equal(rules.approverScope({ userRole: 'sales_manager', empRole: 'sotuv-menejeri' }), null);
    const ruSales = { approver_kind: 'rop', lang: 'russian' }, enSales = { approver_kind: 'rop', lang: 'english' };
    const enAssist = { approver_kind: 'academic', lang: 'english' }, ropReq = { approver_kind: 'admin', lang: null };
    assert.equal(rules.canDecide(rop, ruSales), true);
    assert.equal(rules.canDecide(rop, enSales), false, 'boshqa til bo‘limi');
    assert.equal(rules.canDecide(rop, enAssist), false, 'yordamchi — akademik rahbarga');
    assert.equal(rules.canDecide(ak, enAssist), true);
    assert.equal(rules.canDecide(ak, ruSales), false);
    assert.equal(rules.canDecide(rop, ropReq), false, 'ROP o‘z so‘rovini emas, admin hal qiladi');
    for (const r of [ruSales, enSales, enAssist, ropReq]) assert.equal(rules.canDecide(admin, r), true);
    assert.equal(rules.langCovers('both', 'russian'), true);
    assert.equal(rules.langCovers('english', 'russian'), false);
});

test('so‘rov maydonlari: sabab majburiy, kech qolaman/erta ketaman uchun vaqt, o‘tgan kun — yo‘q', () => {
    const today = monday;
    assert.throws(() => rules.normalizeRequest({ type: 'late', date: today, time: '10:30' }, { today }), /Sabab/);
    assert.throws(() => rules.normalizeRequest({ type: 'late', date: today, reason: 'Shifokor' }, { today }), /kelishingiz/);
    assert.throws(() => rules.normalizeRequest({ type: 'absent', date: '2026-11-01', reason: 'Kasallik' }, { today }), /O‘tgan/);
    assert.throws(() => rules.normalizeRequest({ type: 'holiday', date: today, reason: 'x' }, { today }), /turini/);
    assert.deepEqual(rules.normalizeRequest({ type: 'absent', date: '2026-11-03', time: '10:00', reason: ' Kasallik ', comment: 'isitma' }, { today }),
        { type: 'absent', date: '2026-11-03', time: '', reason: 'Kasallik', comment: 'isitma' });
    assert.equal(rules.normalizeRequest({ type: 'early_leave', date: today, time: '16:00', reason: 'Oilaviy' }, { today }).time, '16:00');
});

test('ish vaqtidan tashqari: ilova erkin; erta belgilansa ish boshlanganda qayta so‘ralmaydi', () => {
    assert.equal(rules.phase({ nowMinutes: time.parseClock('07:40'), day }).phase, 'before');
    assert.equal(rules.phase({ nowMinutes: time.parseClock('09:17'), day }).phase, 'lock');
    assert.equal(rules.phase({ nowMinutes: time.parseClock('09:17'), day }).lateMinutes, 17);
    assert.equal(rules.phase({ nowMinutes: time.parseClock('10:00'), day: null }).phase, 'off', 'dam olish kuni — qulf yo‘q');
    // 07:40 da "Ofisdaman — hozir belgilash" — 09:00 dan keyin ham qulf yo'q
    assert.equal(rules.phase({ nowMinutes: time.parseClock('09:30'), day, inClock: '07:40' }).phase, 'working');
    // Erta kelish kechikish emas
    const s = rules.dayStatus({ date: monday, today: monday, nowMinutes: time.parseClock('09:30'), day, settings,
        events: [{ kind: 'in', occurred_at: at(monday, '07:40') }] });
    assert.deepEqual([s.status, s.lateMinutes, s.inClock], ['on_time', 0, '07:40']);
    // Ish tugaganda — ketish oynasi
    assert.equal(rules.phase({ nowMinutes: time.parseClock('18:00'), day, inClock: '08:52' }).phase, 'leave');
    assert.equal(rules.phase({ nowMinutes: time.parseClock('18:05'), day, inClock: '08:52', outClock: '18:04' }).phase, 'done');
});

test('tasdiqlangan "kech qolaman": ruxsat vaqtigacha qulf yo‘q va kechikish yozilmaydi', () => {
    const late = [{ id: 'r1', type: 'late', time: '10:30', reason: 'Shifokor', state: 'approved' }];
    const p = rules.phase({ nowMinutes: time.parseClock('09:20'), day, requests: late });
    assert.deepEqual([p.phase, p.unlockAt], ['late_ok', '10:30']);
    assert.equal(rules.phase({ nowMinutes: time.parseClock('10:40'), day, requests: late }).phase, 'lock');
    assert.equal(rules.phase({ nowMinutes: time.parseClock('10:40'), day, requests: late }).lateMinutes, 10);
    // 10:20 da keldi → kechikish yo'q, kun "Sababli"
    const base = rules.dayStatus({ date: monday, today: monday, nowMinutes: time.parseClock('11:00'), day, settings,
        events: [{ kind: 'in', occurred_at: at(monday, '10:20') }] });
    assert.equal(base.status, 'late');
    const s = rules.applyRequests(base, late, settings);
    assert.deepEqual([s.status, s.lateMinutes, s.note], ['excused', 0, 'Shifokor']);
    // ruxsat vaqtidan ham kech (10:55) → kechikish ruxsat vaqtidan hisoblanadi
    const later = rules.applyRequests(rules.dayStatus({ date: monday, today: monday, nowMinutes: time.parseClock('11:00'), day, settings,
        events: [{ kind: 'in', occurred_at: at(monday, '10:55') }] }), late, settings);
    assert.deepEqual([later.status, later.lateMinutes], ['late', 25]);
    // hali kelmagan, ruxsat vaqti yaqin — "kelmadi" emas
    const waiting = rules.applyRequests(rules.dayStatus({ date: monday, today: monday, nowMinutes: time.parseClock('11:05'), day, settings: { ...settings, absentAfterMinutes: 120 },
        events: [] }), late, settings, { isToday: true, nowMinutes: time.parseClock('11:05') });
    assert.equal(waiting.status, 'waiting');
});

test('rad etilgan so‘rov — odatdagi qoida; kutilayotgan — "Kutilmoqda"; kelmayman tasdiqlansa — "Sababli"', () => {
    const base = rules.dayStatus({ date: monday, today: monday, nowMinutes: time.parseClock('12:00'), day, settings,
        events: [{ kind: 'in', occurred_at: at(monday, '09:40') }] });
    assert.equal(rules.applyRequests(base, [{ type: 'late', time: '10:00', state: 'rejected' }], settings).status, 'late');
    const pend = rules.applyRequests(base, [{ type: 'late', time: '10:00', state: 'pending' }], settings);
    assert.deepEqual([pend.status, pend.lateMinutes], ['pending', 0]);
    const absent = rules.dayStatus({ date: monday, today: '2026-11-03', nowMinutes: 0, day, settings, events: [] });
    assert.equal(absent.status, 'absent');
    assert.equal(rules.applyRequests(absent, [{ type: 'absent', reason: 'Kasallik', state: 'approved' }], settings).status, 'excused');
    assert.equal(rules.applyRequests(absent, [{ type: 'outside', reason: 'Mijoz', state: 'pending' }], settings).status, 'pending');
});

test('tasdiqlangan "erta ketaman": ruxsat vaqtidan keyin ketsa erta ketish yozilmaydi', () => {
    const base = rules.dayStatus({ date: monday, today: '2026-11-03', nowMinutes: 0, day, settings,
        events: [{ kind: 'in', occurred_at: at(monday, '08:55') }, { kind: 'out', occurred_at: at(monday, '16:02') }] });
    assert.equal(base.earlyMinutes, 118);
    const ok = rules.applyRequests(base, [{ type: 'early_leave', time: '16:00', reason: 'Oilaviy', state: 'approved' }], settings);
    assert.deepEqual([ok.earlyMinutes, ok.status], [0, 'excused']);
    const no = rules.applyRequests(base, [{ type: 'early_leave', time: '16:00', state: 'rejected' }], settings);
    assert.equal(no.earlyMinutes, 118);
    // ketish oynasi ruxsat vaqtida chiqadi
    const p = rules.phase({ nowMinutes: time.parseClock('16:00'), day, inClock: '08:55', requests: [{ type: 'early_leave', time: '16:00', state: 'approved' }] });
    assert.deepEqual([p.phase, p.leaveAt], ['leave', '16:00']);
});

test('ketma-ket vaqtida kunlar: dam olish kunlari o‘tkaziladi, kechikish seriyani uzadi', () => {
    const days = [
        { date: '2026-10-28', status: 'late' }, { date: '2026-10-29', status: 'on_time' }, { date: '2026-10-30', status: 'on_time' },
        { date: '2026-11-01', status: 'off' }, { date: '2026-11-02', status: 'on_time' }];
    assert.equal(rules.onTimeStreak(days), 3);
    assert.equal(rules.onTimeStreak([]), 0);
});
