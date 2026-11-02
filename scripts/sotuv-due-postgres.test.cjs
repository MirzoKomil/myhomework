// Faqat bir martalik lokal baza bilan: PAYROLL_TEST_DATABASE_URL=postgresql://...@127.0.0.1/payroll_test_x node --test scripts/sotuv-due-postgres.test.cjs
// Qarzdorlar · "Muddatni surish so'rovi" (school_edit_requests kind='due'): sotuv menejeri so'rov yaratadi → pending →
// ROP tasdiqlaydi → paymentDueDate va paymentDueHistory yangilanadi; takroriy pending → 409; boshqa menejer o'quvchisi → 403.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const schema = require('../server/services/school/schema');
const O = require('../server/services/school/studentOps');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url) { const u = new URL(url); if (u.hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(u.pathname)) throw Error('Only disposable loopback DBs'); }

test('muddatni surish so\'rovi: so\'rov → tasdiq → sana va tarix (PostgreSQL)', { skip: !url }, async t => {
    const pool = new Pool({ connectionString: url });
    const tx = async fn => { const c = await pool.connect(); try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); } };
    const rop = { id: 'u-rop', role: 'rop', name: 'Islom Mominov' };
    const sales = { id: 'u-sales', role: 'sales_manager', name: 'Kamola Shahobiddinova' };
    const now = new Date('2026-11-02T06:00:00Z'); // Du 2-noy 11:00 Toshkent
    const extra = async id => (await pool.query('SELECT extra_data FROM students WHERE id=$1', [id])).rows[0].extra_data;
    try {
        await pool.query(`DROP TABLE IF EXISTS users, sessions, hr_employees, students, leads CASCADE;
          CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,avatar TEXT DEFAULT '',password_hash TEXT DEFAULT '');
          CREATE TABLE sessions(id TEXT, user_id TEXT, jti TEXT);
          CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN DEFAULT FALSE);
          CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT DEFAULT '',group_name TEXT DEFAULT '',subject TEXT DEFAULT 'english',
            teacher_id TEXT,assistant_teacher_id TEXT,lesson_day_of_week INTEGER,lesson_time TEXT DEFAULT '',lesson_duration INTEGER DEFAULT 15,extra_data JSONB DEFAULT '{}');
          CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,manager_id TEXT,status TEXT,language TEXT,extra_data JSONB DEFAULT '{}',deleted_at TIMESTAMPTZ);
          INSERT INTO students VALUES
            ('sha','Shahzoda Ergasheva','+998 90 1','','russian',null,null,1,'14:00',30,'{"managerId":"hr-ks","debtAmount":450000,"paidAmount":450000,"paymentDueDate":"2026-10-20","comment":"Oyligi 25-da"}'),
            ('ziy','Ziyoda Karimova','+998 90 2','','russian',null,null,2,'10:00',30,'{"managerId":"hr-ks","debtAmount":200000}'),
            ('lol','Lola Rahimova','+998 90 3','','russian',null,null,3,'10:00',30,'{"managerId":"hr-gm","debtAmount":350000,"paymentDueDate":"2026-11-11"}');`);
        await schema.initSchema(pool);

        let req;
        await t.test('sotuv menejeri so\'rov yaratadi — pending, o\'quvchi hali o\'zgarmaydi', async () => {
            const r = await tx(c => O.edit(c, sales, 'sha', { reason: 'Oyligi 25-da tushadi — 1 haftaga surishni so\'radi',
                changes: { paymentDueDate: '2026-11-27', comment: 'Oyligi 25-da', note: 'Otasi bilan gaplashish' } }, { managerId: 'hr-ks', now }));
            req = r.request;
            assert.equal(r.applied, null);
            assert.equal(req.kind, 'due');
            assert.equal(req.status, 'pending');
            // O'zgarmagan izoh so'rovga kirmaydi; eski sana prevDueDate sifatida saqlanadi.
            assert.deepEqual(req.changes, { paymentDueDate: '2026-11-27', note: 'Otasi bilan gaplashish', prevDueDate: '2026-10-20' });
            const ex = await extra('sha');
            assert.equal(ex.paymentDueDate, '2026-10-20');
            assert.equal(ex.paymentDueHistory, undefined);
        });
        await t.test('takroriy pending so\'rov → 409', async () => {
            await assert.rejects(tx(c => O.edit(c, sales, 'sha', { reason: 'Yana surish kerak', changes: { paymentDueDate: '2026-11-29' } }, { managerId: 'hr-ks', now })),
                e => e.status === 409 && /allaqachon kutilmoqda/.test(e.message));
            assert.equal((await pool.query(`SELECT count(*)::int n FROM school_edit_requests WHERE student_id='sha' AND kind='due'`)).rows[0].n, 1);
        });
        await t.test('boshqa menejerning o\'quvchisi → 403', async () => {
            await assert.rejects(tx(c => O.edit(c, sales, 'lol', { reason: 'Surish kerak', changes: { paymentDueDate: '2026-11-20' } }, { managerId: 'hr-ks', now })),
                e => e.status === 403);
        });
        await t.test('sababsiz yoki o\'zgarishsiz so\'rov → 400', async () => {
            await assert.rejects(tx(c => O.edit(c, sales, 'ziy', { reason: '', changes: { paymentDueDate: '2026-11-20' } }, { managerId: 'hr-ks', now })), e => e.status === 400);
            await assert.rejects(tx(c => O.edit(c, sales, 'ziy', { reason: 'Sana bir xil', changes: { paymentDueDate: '' } }, { managerId: 'hr-ks', now })), e => e.status === 400 && /O'zgarish yo'q/.test(e.message));
            await assert.rejects(tx(c => O.edit(c, sales, 'ziy', { reason: 'Noto\'g\'ri sana', changes: { paymentDueDate: '2026-13-40' } }, { managerId: 'hr-ks', now })), e => e.status === 400);
        });
        await t.test('server tekshiruvi (ROP Tasdiqlar): sana va kunlar farqi', async () => {
            const chk = await tx(c => O.checkRequest(c, req.id, now));
            assert.equal(chk.ok, true);
            assert.ok(chk.checks.some(x => x.level === 'ok' && /20\.10\.2026 → 27\.11\.2026 \(\+38 kun\)/.test(x.text)), JSON.stringify(chk.checks));
        });
        await t.test('ROP tasdiqlaydi → paymentDueDate, note va paymentDueHistory yangilanadi', async () => {
            const d = await tx(c => O.decideRequest(c, rop, req.id, { decision: 'approve' }));
            assert.equal(d.status, 'approved');
            const ex = await extra('sha');
            assert.equal(ex.paymentDueDate, '2026-11-27');
            assert.equal(ex.note, 'Otasi bilan gaplashish');
            assert.equal(ex.comment, 'Oyligi 25-da');
            assert.equal(ex.prevDueDate, undefined);
            assert.equal(ex.paymentDueHistory.length, 1);
            const h = ex.paymentDueHistory[0];
            assert.equal(h.from, '2026-10-20'); assert.equal(h.to, '2026-11-27'); assert.equal(h.by, 'Islom Mominov'); assert.equal(h.requestId, req.id);
            assert.match(h.reason, /^So'rov №\d+: Oyligi 25-da tushadi/);
            // Qaror qayta berilmaydi; endi yangi so'rov yuborish mumkin (pending yo'q).
            await assert.rejects(tx(c => O.decideRequest(c, rop, req.id, { decision: 'approve' })), e => e.status === 409);
            const r2 = await tx(c => O.edit(c, sales, 'sha', { reason: 'Yana bir hafta so\'radi', changes: { paymentDueDate: '2026-12-04' } }, { managerId: 'hr-ks', now }));
            assert.equal(r2.request.status, 'pending');
            assert.equal(r2.request.changes.prevDueDate, '2026-11-27');
        });
        await t.test('rad etilsa — sana o\'zgarmaydi', async () => {
            const r = await tx(c => O.edit(c, sales, 'ziy', { reason: 'Sana kelishildi', changes: { paymentDueDate: '2026-11-15' } }, { managerId: 'hr-ks', now }));
            await tx(c => O.decideRequest(c, rop, r.request.id, { decision: 'reject', note: 'Avval qisman to\'lasin' }));
            const ex = await extra('ziy');
            assert.equal(ex.paymentDueDate || '', '');
            assert.equal(ex.paymentDueHistory, undefined);
        });
    } finally { await pool.end(); }
});
