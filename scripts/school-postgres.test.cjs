// Faqat bir martalik lokal baza bilan: node scripts/run-payroll-postgres.cjs scripts/school-postgres.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const schema = require('../server/services/school/schema');
const S = require('../server/services/school/schedule');
const O = require('../server/services/school/studentOps');
const A = require('../server/services/school/assist');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url) { const u = new URL(url); if (u.hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(u.pathname)) throw Error('Only disposable loopback DBs'); }

test('yagona jadval va o\'quvchi amallari — haqiqiy PostgreSQL', { skip: !url }, async t => {
    const pool = new Pool({ connectionString: url });
    const tx = async fn => { const c = await pool.connect(); try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); } };
    const admin = { id: 'u-admin', role: 'admin', name: 'Abdulloh' }, rop = { id: 'u-rop', role: 'rop', name: 'Bahodir' };
    const sales = { id: 'u-sales', role: 'sales_manager', name: 'Jahongir' }, sales2 = { id: 'u-sales2', role: 'sales_manager', name: 'Nodira' };
    const assistant = { id: 'u-sanjar', role: 'teacher', name: 'Sanjar' };
    const now = new Date('2026-10-27T07:00:00Z'); // Se 27-okt, 12:00 Toshkent
    try {
        await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,avatar TEXT DEFAULT '',password_hash TEXT DEFAULT '');
          CREATE TABLE sessions(id TEXT, user_id TEXT, jti TEXT);
          CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN DEFAULT FALSE);
          CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT DEFAULT '',group_name TEXT DEFAULT '',subject TEXT DEFAULT 'english',
            teacher_id TEXT,assistant_teacher_id TEXT,lesson_day_of_week INTEGER,lesson_time TEXT DEFAULT '',lesson_duration INTEGER DEFAULT 15,extra_data JSONB DEFAULT '{}');
          CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,manager_id TEXT,status TEXT,language TEXT,extra_data JSONB DEFAULT '{}',deleted_at TIMESTAMPTZ);
          INSERT INTO leads VALUES ('lead-trial','Sardor','m-nodira','sinov-darsida','english','{"paymentSurvey":{"tariff":"30"},"paymentOnboarding":{"teacherId":"dilnoza","lessonDayOfWeek":4},"trialRequest":{"id":"t1","teacherId":"dilnoza","scheduledAt":"2026-10-29T10:00:00.000Z","daysCount":1,"state":"accepted"}}');
          INSERT INTO users VALUES ('u-sanjar','Sanjar','sanjar@x.uz','teacher');
          INSERT INTO hr_employees VALUES ('dilnoza','Dilnoza','dilnoza@x.uz','ingliz-oqituvchi','active','english'),
            ('kamola','Kamola','kamola@x.uz','ingliz-oqituvchi','active','english'),('sanjar','Sanjar','sanjar@x.uz','yordamchi','active','english');
          INSERT INTO students VALUES
            ('madina','Madina Yusupova','+998 93 222 18 04','','english','dilnoza','sanjar',2,'10:00',30,'{"managerId":"m-nodira","paymentDueDate":"2026-11-30","startDate":"2026-10-01"}'),
            ('jasur','Jasur Toshmatov','+998 97 410 33 21','','english','dilnoza','sanjar',1,'16:30',30,'{"managerId":"m-jahongir"}'),
            ('malika','Malika Ergasheva','','','english','dilnoza','sanjar',2,'18:00',60,'{}');`);
        await schema.initSchema(pool); await schema.initSchema(pool);
        await tx(c => S.setHours(c, admin, 'dilnoza', [1, 2, 3, 4, 5, 6].map(w => ({ weekday: w, from: '10:00', to: '20:00' }))));
        await tx(c => S.setHours(c, admin, 'kamola', [2, 4, 6].map(w => ({ weekday: w, from: '10:00', to: '20:00' }))));

        await t.test('sinov: bo\'sh vaqt band bo\'ladi, ikki menejer bir vaqtni ololmaydi', async () => {
            const input = { kind: 'trial', teacherId: 'dilnoza', date: '2026-10-29', time: '12:00', duration: 30, leadId: 'lead-1' };
            const r = await Promise.allSettled([tx(c => S.book(c, sales, input, now)), tx(c => S.book(c, sales2, { ...input, leadId: 'lead-2' }, now))]);
            assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
            assert.match(r.find(x => x.status === 'rejected').reason.message, /ushlab turibdi|band/);
            await assert.rejects(tx(c => S.book(c, sales, { ...input, time: '10:00', leadId: 'lead-3' }, now)), /band/);
            await assert.rejects(tx(c => S.book(c, sales, { ...input, time: '21:00', leadId: 'lead-4' }, now)), /ochiq emas/);
            await assert.rejects(tx(c => S.book(c, sales, { ...input, time: '15:00', leadId: 'lead-5' }, now)), /band/, 'sotuvdagi lid sinovi ham band qiladi');
            const later = new Date(now.getTime() + 11 * 60000);
            await tx(c => S.book(c, sales2, { ...input, leadId: 'lead-2' }, later)); // ushlab turish tugadi
        });

        await t.test('muzlatish: 30 kun, kursda bir marta, to\'lov muddati suriladi, vaqt sinovga ochiladi', async () => {
            await assert.rejects(tx(c => O.freeze(c, admin, 'madina', { from: '2026-11-03', to: '2026-12-10', reason: 'Safar' }, now)), /30/);
            await assert.rejects(tx(c => O.freeze(c, sales, 'madina', { from: '2026-11-03', to: '2026-11-16', reason: 'Safar' }, now)), /admin yoki ROP/);
            await tx(c => O.freeze(c, rop, 'madina', { from: '2026-11-03', to: '2026-11-16', reason: 'Safar' }, now));
            const ex = (await pool.query("SELECT extra_data FROM students WHERE id='madina'")).rows[0].extra_data;
            assert.equal(ex.paymentDueDate, '2026-12-14');
            assert.equal(ex.frozen, undefined, 'hali boshlanmagan');
            await tx(c => O.applyDue(c, new Date('2026-11-03T03:00:00Z')));
            assert.equal((await pool.query("SELECT extra_data FROM students WHERE id='madina'")).rows[0].extra_data.frozen, true);
            await tx(c => O.applyDue(c, new Date('2026-11-17T03:00:00Z')));
            assert.equal((await pool.query("SELECT extra_data FROM students WHERE id='madina'")).rows[0].extra_data.frozen, false, 'avtomatik qaytdi');
            await assert.rejects(tx(c => O.freeze(c, admin, 'madina', { from: '2026-12-01', to: '2026-12-05', reason: 'Yana' }, now)), /bir marta/);
            const ctx = await S.loadContext(pool, { teacherIds: ['dilnoza'], from: '2026-11-03', to: '2026-11-03', now });
            const v = S.dayView(ctx, 'dilnoza', '2026-11-03');
            assert.ok(S.fits(v.trialFree, 600, 630) && !S.fits(v.free, 600, 630));
        });

        await t.test('sotuv tahriri: telefon darhol, tarif — so\'rov; admin/ROP dan birinchisi hal qiladi', async () => {
            await assert.rejects(tx(c => O.edit(c, sales, 'madina', { reason: 'xato raqam', changes: { phone: '+998901112233' } }, { managerId: 'm-jahongir' })), /o'zingiz sotgan/);
            const r = await tx(c => O.edit(c, sales, 'jasur', { reason: 'Raqamda 2 raqam almashgan', changes: { phone: '998974103312', lessonDuration: 60, monthlyPrice: 280000 } }, { managerId: 'm-jahongir' }));
            assert.equal(r.applied.changed, true);
            assert.equal(r.request.status, 'pending');
            const both = await Promise.allSettled([
                tx(c => O.decideRequest(c, admin, r.request.id, { decision: 'approve' })),
                tx(c => O.decideRequest(c, rop, r.request.id, { decision: 'reject', note: 'kerak emas' }))]);
            assert.equal(both.filter(x => x.status === 'fulfilled').length, 1, 'ikkinchisi yopiladi');
            const hist = await O.history(pool, 'jasur');
            assert.ok(hist.some(h => h.action === 'edit' && h.reason.includes('2 raqam')));
        });

        await t.test('eski CRM nusxasi akademik o\'zgarishni qaytarmaydi', () => {
            const existing = { name: 'Malika', teacherId: 'kamola', schoolRev: 3, frozen: true, lessonTime: '18:00' };
            const incoming = { name: 'Malika', teacherId: 'dilnoza', schoolRev: 1, lessonTime: '19:00' };
            const extra = { frozen: false };
            O.protectSchoolFields(incoming, extra, existing);
            assert.equal(incoming.teacherId, 'kamola'); assert.equal(extra.frozen, true); assert.equal(incoming.lessonTime, '18:00');
        });

        await t.test('ustozni almashtirish sanadan, band vaqt tekshiriladi', async () => {
            await tx(c => O.changeTeacher(c, admin, 'malika', { teacherId: 'kamola', from: '2026-11-03', reason: 'Ota-ona so\'radi' }, { now }));
            assert.equal((await pool.query("SELECT teacher_id FROM students WHERE id='malika'")).rows[0].teacher_id, 'dilnoza', 'hali eski ustoz');
            await tx(c => O.applyDue(c, new Date('2026-11-03T03:00:00Z')));
            assert.equal((await pool.query("SELECT teacher_id FROM students WHERE id='malika'")).rows[0].teacher_id, 'kamola');
            await assert.rejects(tx(c => O.changeTeacher(c, admin, 'jasur', { teacherId: 'kamola', from: '2026-11-04', reason: 'test' }, { now })), /ish vaqtidan tashqarida|band/);
        });

        await t.test('to\'xtatish va qayta tiklash: eski vaqt band bo\'lsa yangi vaqt', async () => {
            await tx(c => O.stop(c, admin, 'jasur', { lastLesson: '2026-10-30', reason: 'Vaqti yo\'q' }, now));
            await tx(c => O.applyDue(c, new Date('2026-11-01T03:00:00Z')));
            assert.equal((await pool.query("SELECT extra_data FROM students WHERE id='jasur'")).rows[0].extra_data.status, 'inactive');
            await tx(c => S.book(c, admin, { kind: 'once', teacherId: 'dilnoza', studentId: 'madina', date: '2026-11-04', time: '16:30', duration: 30 }, now));
            await assert.rejects(tx(c => O.restore(c, admin, 'jasur', { from: '2026-11-04', reason: 'Qaytdi' }, now)), /band/);
            await tx(c => O.restore(c, admin, 'jasur', { from: '2026-11-04', lessonTime: '14:00', reason: 'Qaytdi' }, now));
            await tx(c => O.applyDue(c, new Date('2026-11-04T03:00:00Z')));
            const j = (await pool.query("SELECT lesson_time, extra_data FROM students WHERE id='jasur'")).rows[0];
            assert.equal(j.lesson_time, '14:00'); assert.equal(j.extra_data.status, 'active');
        });

        await t.test('Telegram guruh: nom takrorlanmaydi, sotuv faqat birinchi marta', async () => {
            await tx(c => O.setGroup(c, admin, 'madina', { link: 'https://t.me/+Abcdefgh123', name: 'C07 | onlayn ingliz tili' }));
            await assert.rejects(tx(c => O.setGroup(c, admin, 'malika', { link: 'https://t.me/+Zbcdefgh123', name: 'c07 | onlayn ingliz tili' })), /boshqa guruhda/);
            await assert.rejects(tx(c => O.setGroup(c, sales, 'jasur', { link: 'javascript:alert(1)', name: 'C21' }, { managerId: 'm-jahongir' })), /havolasi/);
            await tx(c => O.setGroup(c, sales, 'jasur', { link: 'https://t.me/+Hd3sZp0aQw8yM2Fj', name: 'C21 | onlayn ingliz tili' }, { managerId: 'm-jahongir' }));
            await assert.rejects(tx(c => O.setGroup(c, sales, 'jasur', { link: 'https://t.me/+Hd3sZp0aQw8yM2Fk', name: 'C22' }, { managerId: 'm-jahongir' })), /admin yoki ROP/);
            assert.equal(await O.nextGroupName(pool), 'C22 | onlayn ingliz tili');
        });

        await t.test('yordamchi aloqasi: faqat bugun, muzlagan kunda yo\'q, admin tuzatadi, oy qulfi', async () => {
            const on = new Date('2026-10-28T07:00:00Z');
            await assert.rejects(tx(c => A.mark(c, assistant, { studentId: 'madina', day: '2026-10-27', channel: 'phone', minutes: 7 }, on)), /shu kuni/);
            await tx(c => A.mark(c, assistant, { studentId: 'madina', channel: 'phone', minutes: 7 }, on));
            await tx(c => A.mark(c, assistant, { studentId: 'malika', outcome: 'no_answer' }, on));
            await assert.rejects(tx(c => A.mark(c, assistant, { studentId: 'madina', channel: 'phone', minutes: 7 }, new Date('2026-11-05T07:00:00Z'))), /muzlatilgan/);
            await tx(c => A.adminCorrect(c, admin, { studentId: 'malika', day: '2026-10-26', channel: 'phone', minutes: 6, reason: 'Kechikib belgilash so\'rovi' }, on));
            const rep = await A.monthReport(pool, 'sanjar', '2026-10');
            // 29-okt: 2026-10 dan oyiga 40 000 (13 aloqa) — har aloqa 3 077, summa round(40 000 × n / 13).
            assert.equal(rep.counted, 2); assert.equal(rep.noAnswer, 1); assert.equal(rep.rate, 3077); assert.equal(rep.amount, 6154);
            assert.equal(rep.policy, 'contacts-v1');
            await tx(c => A.advanceMonth(c, admin, '2026-10', 'prelim', new Date('2026-11-02T07:00:00Z')));
            await tx(c => A.adminCorrect(c, admin, { studentId: 'malika', day: '2026-10-20', channel: 'phone', minutes: 6, reason: 'e\'tiroz davrida tuzatish' }, new Date('2026-11-03T07:00:00Z')));
            await assert.rejects(tx(c => A.advanceMonth(c, admin, '2026-10', 'final', new Date('2026-11-03T07:00:00Z'))), /E'tiroz/);
            await tx(c => A.advanceMonth(c, admin, '2026-10', 'final', new Date('2026-11-05T07:00:00Z')));
            await assert.rejects(tx(c => A.adminCorrect(c, admin, { studentId: 'malika', day: '2026-10-21', channel: 'phone', minutes: 6, reason: 'kech qoldi' }, new Date('2026-11-06T07:00:00Z'))), /yakuniy/);
        });

        await t.test('yordamchi narxi oyga bog\'liq: sentyabr — eski 50 000 / 3 846; kurs boshlanishidan oldingi aloqa sanalmaydi', async () => {
            await pool.query(`INSERT INTO students VALUES ('kamron','Kamron','', '','english','dilnoza','sanjar',1,'12:00',30,'{"startDate":"2026-10-07"}')`);
            const on = new Date('2026-10-28T07:00:00Z');
            for (const day of ['2026-09-21', '2026-09-23']) await tx(c => A.adminCorrect(c, admin, { studentId: 'jasur', assistantId: 'sanjar', day, channel: 'phone', minutes: 8, reason: 'sentyabr tuzatishi' }, on));
            const sep = await A.monthReport(pool, 'sanjar', '2026-09');
            assert.equal(sep.policy, 'legacy'); assert.equal(sep.rate, 3846); assert.equal(sep.monthly, 50000);
            assert.equal(sep.amount, Math.round(50000 * 2 / 13));
            // (Oktyabr oldingi bandda yakuniy tasdiqlangan — yozuvlar to'g'ridan-to'g'ri.)
            for (const day of ['2026-10-02', '2026-10-05', '2026-10-07', '2026-10-09']) await pool.query(`INSERT INTO school_assist_contacts (id,student_id,assistant_id,day,at_min,channel,minutes,note,outcome,created_by)
                VALUES ($1,'kamron','sanjar',$2,600,'phone',8,'','contacted','u-admin')`, ['k' + day, day]);
            const oct = await A.monthReport(pool, 'sanjar', '2026-10');
            const k = oct.students.find(x => x.studentId === 'kamron');
            assert.equal(k.counted, 2); assert.equal(k.beforeStart, 2);
            assert.deepEqual(k.items.filter(i => i.status === 'before_start').map(i => i.day), ['2026-10-02', '2026-10-05']);
            assert.equal(k.amount, Math.round(40000 * 2 / 13));
        });

        await t.test('HTTP: qoplash tekshiruvi, takroriy so\'rov 409, yordamchiga asosiy ustoz Telegram\'i', async () => {
            const express = require('express');
            const RealDate = Date, fixed = new RealDate('2026-10-27T12:27:00Z').getTime(), off = fixed - RealDate.now();
            global.Date = class extends RealDate { constructor(...a) { if (!a.length) super(RealDate.now() + off); else super(...a); } static now() { return RealDate.now() + off; } };
            const server = await (async () => {
                await pool.query(`CREATE TABLE IF NOT EXISTS main_attendance(att_key TEXT, student_id TEXT, day INTEGER, present INTEGER, PRIMARY KEY(att_key,student_id,day));
                  CREATE TABLE IF NOT EXISTS staff_profile_extra(user_id TEXT PRIMARY KEY, telegram TEXT DEFAULT '', birthday TEXT DEFAULT '', ext TEXT DEFAULT '');
                  INSERT INTO users VALUES ('u-dil','Dilnoza','dilnoza@x.uz','teacher') ON CONFLICT DO NOTHING;
                  INSERT INTO staff_profile_extra(user_id, telegram) VALUES ('u-dil','@dilnoza_t') ON CONFLICT DO NOTHING;
                  INSERT INTO students VALUES ('nodir','Nodir','', '','english','dilnoza','sanjar',1,'10:00',30,'{"startDate":"2026-10-01"}');
                  INSERT INTO main_attendance VALUES ('2026-10_dilnoza','nodir',23,1);
                  INSERT INTO school_absences (teacher_id, student_id, day, absent, marked_by) VALUES ('dilnoza','nodir','2026-10-26',true,'u-dil'),('dilnoza','nodir','2026-10-23',true,'u-dil'),('dilnoza','nodir','2026-10-24',true,'u-dil');`);
                const app = express(); app.use(express.json());
                const users = { 'u-dil': { id: 'u-dil', role: 'teacher', name: 'Dilnoza', email: 'dilnoza@x.uz' }, 'u-sanjar': { id: 'u-sanjar', role: 'teacher', name: 'Sanjar', email: 'sanjar@x.uz' } };
                const router = require('../server/routes/school')({ db: { pool, tx: fn => tx(fn) }, authRequired: (req, res, next) => { req.user = { ...users[req.headers['x-user']] }; next(); },
                    findUserById: async id => users[id] || null });
                app.use('/api/school', router);
                return await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
            })();
            const call = async (user, method, path, body) => {
                const r = await fetch(`http://127.0.0.1:${server.address().port}/api/school${path}`, { method, headers: { 'content-type': 'application/json', 'x-user': user }, body: body ? JSON.stringify(body) : undefined });
                return { status: r.status, body: await r.json() };
            };
            try {
                // Qoplanmagan darslar: 23 — "Keldi" ustun; 24 (Sh) — dars kuni emas; faqat 26 qoladi.
                const missed = await S.missedLessons(pool, 'dilnoza', { from: '2026-10-01', to: '2026-10-27' });
                assert.deepEqual(missed.filter(m => m.studentId === 'nodir').map(m => m.date), ['2026-10-26']);
                let r = await call('u-dil', 'POST', '/makeups/double', { studentId: 'nodir', missedDate: '2026-10-23', heldDate: '2026-10-26' });
                assert.equal(r.status, 400); assert.match(r.body.error, /Keldi/);
                r = await call('u-dil', 'POST', '/makeups/separate', { studentId: 'nodir', missedDate: '2026-10-26', heldDate: '2026-10-28' });
                assert.equal(r.status, 400); assert.match(r.body.error, /o'tmagan/);
                r = await call('u-dil', 'POST', '/makeups/double', { studentId: 'nodir', missedDate: '2026-10-26', heldDate: '2026-10-30' });
                assert.equal(r.status, 400, 'kelajakdagi qo\'shaloq dars "o\'tkazildi" bo\'lmaydi');
                r = await call('u-dil', 'POST', '/makeups/separate', { studentId: 'nodir', missedDate: '2026-10-20', heldDate: '2026-10-27' });
                assert.equal(r.status, 400, '"Kelmadi" belgilanmagan kun');
                r = await call('u-dil', 'POST', '/makeups/separate', { studentId: 'nodir', missedDate: '2026-10-26', heldDate: '2026-10-25' });
                assert.equal(r.status, 400); assert.match(r.body.error, /keyin/);
                r = await call('u-dil', 'POST', '/makeups/separate', { studentId: 'nodir', missedDate: '2026-10-26', heldDate: '2026-10-27' });
                assert.equal(r.status, 200); assert.equal(r.body.makeup.status, 'review');
                r = await call('u-sanjar', 'POST', '/makeups/separate', { studentId: 'nodir', missedDate: '2026-10-26', heldDate: '2026-10-27' });
                assert.equal(r.status, 403, 'boshqa ustoz o\'quvchisi');
                await pool.query(`INSERT INTO school_makeups (id,student_id,teacher_id,missed_date,held_date,kind,status,created_by) VALUES ('mk-fut','nodir','dilnoza','2026-10-21','2026-10-30','separate','planned','u-dil')`).catch(async () => {
                    await pool.query(`INSERT INTO school_makeups (id,student_id,teacher_id,missed_date,held_date,kind,status) VALUES ('mk-fut','nodir','dilnoza','2026-10-21','2026-10-30','separate','planned')`); });
                r = await call('u-dil', 'POST', '/makeups/mk-fut/held');
                assert.equal(r.status, 400, 'rejadagi qoplash o\'tmasdan "o\'tkazildi" bo\'lmaydi');
                // Admin orqali so'rov: bir o'quvchi + bir kun — bitta ochiq so'rov.
                await pool.query("DELETE FROM school_assist_months WHERE month='2026-10'"); // oldingi bandda yakunlangan oy qulfi
                const late = { studentId: 'nodir', day: '2026-10-20', reason: 'qo\'ng\'iroq qildim, belgilamadim', channel: 'phone', minutes: 10 };
                const both = await Promise.all([call('u-sanjar', 'POST', '/assist/late-requests', late), call('u-sanjar', 'POST', '/assist/late-requests', late)]);
                assert.deepEqual(both.map(x => x.status).sort(), [200, 409]);
                assert.equal((await call('u-sanjar', 'POST', '/assist/late-requests', { ...late, day: '2026-10-21' })).status, 200);
                // Kartada asosiy ustoz Telegram'i — faqat hozirgi yordamchiga; telefon yo'q.
                r = await call('u-sanjar', 'GET', '/students/nodir/card');
                assert.equal(r.status, 200); assert.equal(r.body.card.scope, 'assistant');
                assert.deepEqual(r.body.card.mainTeacher, { id: 'dilnoza', name: 'Dilnoza', telegram: '@dilnoza_t' });
                assert.ok(!('phone' in r.body.card));
                r = await call('u-dil', 'GET', '/students/nodir/card');
                assert.equal(r.body.card.scope, 'teacher'); assert.equal(r.body.card.mainTeacher, undefined);
            } finally { global.Date = RealDate; await new Promise(r => server.close(r)); }
        });
    } finally { await pool.end(); }
});
