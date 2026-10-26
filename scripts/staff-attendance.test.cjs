// Xodimlar davomati — sof qoidalar (bazasiz).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../server/services/staffAttendance/rules');
const time = require('../server/services/staffAttendance/time');
const lessons = require('../server/services/staffAttendance/lessons');
const { decodePng } = require('../server/services/staffAttendance/png');
const zlib = require('zlib');

const settings = rules.normalizeSettings({});
const at = (date, clock) => time.atTashkent(date, time.parseClock(clock));

test('Toshkent vaqti UTC+5 bo‘yicha hisoblanadi', () => {
    assert.equal(time.tashkentDate(new Date('2026-10-26T19:30:00Z')), '2026-10-27');
    assert.equal(time.tashkentClock(new Date('2026-10-26T04:05:00Z')), '09:05');
    assert.equal(time.weekday('2026-10-26'), 1);
    assert.equal(time.weekday('2026-11-01'), 7);
    assert.equal(at('2026-10-26', '09:00').toISOString(), '2026-10-26T04:00:00.000Z');
});

test('lokatsiya: ofis ichida, tashqarida va GPS aniqligi past', () => {
    const office = settings.office;
    assert.equal(rules.checkLocation(settings, { lat: office.lat, lng: office.lng, accuracy: 15 }).ok, true);
    const near = rules.checkLocation(settings, { lat: office.lat + 0.001, lng: office.lng, accuracy: 20 }); // ~111 m
    assert.equal(near.ok, true);
    const far = rules.checkLocation(settings, { lat: office.lat + 0.01, lng: office.lng, accuracy: 20 }); // ~1.1 km
    assert.deepEqual([far.ok, far.reason], [false, 'outside']);
    assert.equal(rules.checkLocation(settings, { lat: office.lat, lng: office.lng, accuracy: 900 }).reason, 'low_accuracy');
    assert.equal(rules.checkLocation(settings, {}).reason, 'no_location');
});

test('tiriklik: bosh burilmasa yoki boshqa odam bo‘lsa rad etiladi', () => {
    const front = { faces: 1, yaw: 0.02, box: { width: 150 } };
    assert.equal(rules.checkLiveness(front, { faces: 1, yaw: 0.25, box: { width: 140 } }).ok, true);
    assert.equal(rules.checkLiveness(front, { faces: 1, yaw: -0.2, box: { width: 160 } }).ok, true);
    assert.equal(rules.checkLiveness(front, { faces: 1, yaw: 0.05, box: { width: 150 } }).reason, 'liveness');
    assert.equal(rules.checkLiveness(front, { faces: 1, yaw: 0.3, box: { width: 40 } }).reason, 'liveness');
    assert.equal(rules.checkLiveness(front, { faces: 2, yaw: 0.3, box: { width: 150 } }).reason, 'many_faces');
    // Odam o'z chap tomoniga burilsa (ko'zgulanmagan kadrda) yaw ortadi.
    assert.equal(rules.checkLiveness(front, { faces: 1, yaw: 0.25, box: { width: 140 } }, 'left').ok, true);
    assert.equal(rules.checkLiveness(front, { faces: 1, yaw: 0.25, box: { width: 140 } }, 'right').reason, 'wrong_direction');
    assert.equal(rules.checkLiveness(front, { faces: 1, yaw: -0.2, box: { width: 140 } }, 'right').ok, true);
});

test('grafik: noto‘g‘ri vaqt va tugash boshlanishdan oldin bo‘lsa xato', () => {
    assert.deepEqual(rules.normalizeDays({ 1: { start: '09:00', end: '18:00' }, 6: { start: '10:00', end: '14:00' } }),
        { 1: { start: '09:00', end: '18:00' }, 6: { start: '10:00', end: '14:00' } });
    assert.throws(() => rules.normalizeDays({ 1: { start: '9', end: '18:00' } }), /vaqti noto/);
    assert.throws(() => rules.normalizeDays({ 1: { start: '18:00', end: '09:00' } }), /tugash/);
});

test('kunlik holat: vaqtida, kechikdi, kutilmoqda, kelmadi, erta ketdi, ta’til, dam olish', () => {
    const day = { start: '09:00', end: '18:00' };
    const base = { date: '2026-10-26', today: '2026-10-26', day, settings, leave: false, override: null };
    const ev = (kind, clock) => ({ kind, occurred_at: at('2026-10-26', clock) });
    assert.equal(rules.dayStatus({ ...base, nowMinutes: 600, events: [ev('in', '09:08')] }).status, 'on_time');
    const late = rules.dayStatus({ ...base, nowMinutes: 600, events: [ev('in', '09:17')] });
    assert.deepEqual([late.status, late.lateMinutes, late.inClock], ['late', 17, '09:17']);
    assert.equal(rules.dayStatus({ ...base, nowMinutes: 9 * 60 + 30, events: [] }).status, 'waiting');
    assert.equal(rules.dayStatus({ ...base, nowMinutes: 8 * 60, events: [] }).status, 'upcoming');
    assert.equal(rules.dayStatus({ ...base, nowMinutes: 11 * 60 + 1, events: [] }).status, 'absent');
    assert.equal(rules.dayStatus({ ...base, today: '2026-10-27', nowMinutes: 0, events: [] }).status, 'absent');
    const early = rules.dayStatus({ ...base, nowMinutes: 1100, events: [ev('in', '08:55'), ev('out', '17:20')] });
    assert.deepEqual([early.status, early.earlyMinutes, early.workedMinutes], ['on_time', 40, 505]);
    assert.equal(rules.dayStatus({ ...base, nowMinutes: 1300, events: [ev('in', '08:55')] }).noCheckout, true);
    assert.equal(rules.dayStatus({ ...base, nowMinutes: 700, events: [], leave: true }).status, 'leave');
    assert.equal(rules.dayStatus({ ...base, nowMinutes: 700, events: [], override: { status: 'excused', note: 'shifokor' } }).status, 'excused');
    assert.equal(rules.dayStatus({ ...base, day: null, nowMinutes: 700, events: [] }).status, 'off');
    assert.equal(rules.dayStatus({ ...base, date: '2026-10-28', nowMinutes: 700, events: [] }).status, 'upcoming');
    assert.equal(rules.dayStatus({ ...base, today: '2026-10-27', nowMinutes: 0, events: [], countFrom: '2026-10-26' }).status, 'before');
    assert.equal(rules.dayStatus({ ...base, today: '2026-10-27', nowMinutes: 0, events: [], countFrom: '2026-10-25' }).status, 'absent');
    assert.equal(rules.dayStatus({ ...base, today: '2026-10-27', nowMinutes: 0, events: [], countFrom: null }).status, 'not_ready');
    assert.equal(rules.dayStatus({ ...base, nowMinutes: 600, events: [ev('in', '09:17')], countFrom: '2026-10-26' }).status, 'late');
});

test('sozlamalar chegaralari', () => {
    const s = rules.normalizeSettings({ office: { lat: 'x', radius: 5 }, graceMinutes: 999, notifyTelegram: false });
    assert.equal(s.office.lat, rules.DEFAULT_SETTINGS.office.lat);
    assert.equal(s.office.radius, 150);
    assert.equal(s.graceMinutes, 10);
    assert.equal(s.notifyTelegram, false);
});

test('PNG dekoder: canvas beradigan RGBA rasmni o‘qiydi (filtrlar bilan)', () => {
    const w = 3, h = 2;
    const rows = [];
    // filter 0 (None) va filter 1 (Sub)
    rows.push(Buffer.from([0, 255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]));
    rows.push(Buffer.from([1, 10, 20, 30, 255, 1, 1, 1, 0, 1, 1, 1, 0]));
    const raw = Buffer.concat(rows);
    const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); return Buffer.concat([len, Buffer.from(type), data, Buffer.alloc(4)]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
    const out = decodePng(png);
    assert.equal(out.width, 3); assert.equal(out.height, 2);
    assert.deepEqual(Array.from(out.rgb.slice(0, 9)), [255, 0, 0, 0, 255, 0, 0, 0, 255]);
    assert.deepEqual(Array.from(out.rgb.slice(9)), [10, 20, 30, 11, 21, 31, 12, 22, 32]);
    assert.throws(() => decodePng(Buffer.from('salom')), /PNG emas/);
});

test('ustoz darslari: ketma-ket darslar bitta blokka birlashadi', () => {
    const blocks = lessons.blocksFrom([
        { studentId: 'a', start: 600, end: 615 }, { studentId: 'b', start: 615, end: 630 },
        { studentId: 'c', start: 635, end: 650 }, { studentId: 'd', start: 720, end: 735 }]);
    assert.equal(blocks.length, 2);
    assert.deepEqual([blocks[0].start, blocks[0].end, blocks[0].slots.length], [600, 650, 3]);
});

test('ustoz darslari: video chat bo‘yicha vaqtida / kech boshladi / erta tugatdi / bo‘lmadi', () => {
    const date = '2026-10-26', nowDate = '2026-10-27', now = new Date('2026-10-27T10:00:00Z');
    const block = { start: 600, end: 750, slots: [] }; // 10:00-12:30
    const chats = start => lessons.intervals([{ kind: 'started', at: at(date, start) }, { kind: 'ended', at: at(date, '12:31') }], now);
    assert.equal(lessons.judgeByVideo(block, date, chats('09:58'), now, nowDate).status, 'on_time');
    const late = lessons.judgeByVideo(block, date, chats('10:12'), now, nowDate);
    assert.deepEqual([late.status, late.lateStartMinutes], ['late_start', 12]);
    const early = lessons.judgeByVideo(block, date, lessons.intervals([{ kind: 'ended', at: at(date, '12:00'), duration_seconds: 7260 }], now), now, nowDate);
    assert.deepEqual([early.status, early.earlyEndMinutes, early.startedClock], ['early_end', 30, '09:59']);
    assert.equal(lessons.judgeByVideo(block, date, [], now, nowDate).status, 'not_held');
    assert.equal(lessons.judgeByVideo(block, nowDate, [], new Date('2026-10-27T03:00:00Z'), nowDate).status, 'pending');
    const live = lessons.judgeByVideo(block, date, lessons.intervals([{ kind: 'started', at: at(date, '10:00') }], at(date, '11:00')), at(date, '11:00'), date);
    assert.equal(live.status, 'live');
});

test('ustoz darslari: davomat belgilangan vaqt bo‘yicha', () => {
    const date = '2026-10-26', now = new Date('2026-10-27T10:00:00Z');
    const block = { start: 600, end: 630, slots: [{ studentId: 'a', studentName: 'A', start: 600, end: 615 }, { studentId: 'b', studentName: 'B', start: 615, end: 630 }] };
    const ok = lessons.judgeByMarks(block, date, new Map([['a', at(date, '10:05')], ['b', at(date, '10:20')]]), now, '2026-10-27');
    assert.equal(ok.status, 'marked');
    const late = lessons.judgeByMarks(block, date, new Map([['a', at(date, '10:05')], ['b', at(date, '19:00')]]), now, '2026-10-27');
    assert.equal(late.status, 'marked_late');
    const missing = lessons.judgeByMarks(block, date, new Map([['a', at(date, '10:05')]]), now, '2026-10-27');
    assert.equal(missing.status, 'not_marked');
});
