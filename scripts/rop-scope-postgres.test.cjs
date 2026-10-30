// Faqat bir martalik lokal baza bilan: node scripts/run-payroll-postgres.cjs scripts/rop-scope-postgres.test.cjs
// Paket B (30-okt): ROP faqat o'z til yo'nalishini ko'radi — /api/school (karta, amallar, guruhlar, so'rovlar, sinov).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const schema = require('../server/services/school/schema');
const ropScope = require('../server/services/ropScope');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url) { const u = new URL(url); if (u.hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(u.pathname)) throw Error('Only disposable loopback DBs'); }

test('ROP til cheklovi — haqiqiy PostgreSQL', { skip: !url }, async t => {
    const pool = new Pool({ connectionString: url });
    const tx = async fn => { const c = await pool.connect(); try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); } };
    let server;
    try {
        await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,avatar TEXT DEFAULT '',password_hash TEXT DEFAULT '');
          CREATE TABLE sessions(id TEXT, user_id TEXT, jti TEXT);
          CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,login TEXT,role TEXT,status TEXT,lang TEXT,dual_role BOOLEAN DEFAULT FALSE);
          CREATE TABLE students(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT DEFAULT '',group_name TEXT DEFAULT '',subject TEXT DEFAULT 'english',
            teacher_id TEXT,assistant_teacher_id TEXT,lesson_day_of_week INTEGER,lesson_time TEXT DEFAULT '',lesson_duration INTEGER DEFAULT 15,extra_data JSONB DEFAULT '{}');
          CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,manager_id TEXT,status TEXT,language TEXT,extra_data JSONB DEFAULT '{}',deleted_at TIMESTAMPTZ,comments JSONB DEFAULT '[]',updated_at TIMESTAMPTZ);
          CREATE TABLE IF NOT EXISTS main_attendance(att_key TEXT, student_id TEXT, day INTEGER, present INTEGER, PRIMARY KEY(att_key,student_id,day));
          INSERT INTO users VALUES ('u-admin','Abdulloh','admin@x.uz','admin'),('u-rop','Bahodir','rop@x.uz','rop'),('u-ropru','Rus Rop','ropru@x.uz','rop'),('u-ropnone','Tilsiz','ropnone@x.uz','rop');
          INSERT INTO hr_employees VALUES ('hr-rop','Bahodir','rop@x.uz','rop','active','english'),('hr-ropru','Rus Rop','ropru@x.uz','rop','active','russian'),
            ('hr-ropnone','Tilsiz','ropnone@x.uz','rop','active',''),
            ('dil','Dilnoza','dil@x.uz','ingliz-oqituvchi','active','english'),('rus','Rustam','rus@x.uz','rus-oqituvchi','active','russian');
          INSERT INTO students VALUES ('en1','Madina','+998 1','','english','dil',null,2,'10:00',30,'{}'),('ru1','Ruslan','+998 2','','russian','rus',null,2,'10:00',30,'{}');
          INSERT INTO leads(id,name,manager_id,status,language) VALUES ('l-en','Anvar','m1','yangi','english'),('l-ru','Petr','m1','yangi','russian');`);
        await schema.initSchema(pool);
        await pool.query(`INSERT INTO school_student_groups(student_id, name, updated_by) VALUES ('en1','EN 1','u-admin'),('ru1','RU 1','u-admin')`);

        await t.test('ropLangsFor: HR tili; belgilanmagan — null (eski xatti-harakat)', async () => {
            assert.deepEqual(await ropScope.ropLangsFor(pool, { role: 'rop', email: 'rop@x.uz' }), ['english']);
            assert.deepEqual(await ropScope.ropLangsFor(pool, { role: 'rop', email: 'ROPRU@x.uz ' }), ['russian']);
            assert.equal(await ropScope.ropLangsFor(pool, { role: 'rop', email: 'ropnone@x.uz' }), null);
            assert.equal(await ropScope.ropLangsFor(pool, { role: 'admin', email: 'rop@x.uz' }), null);
        });

        const express = require('express');
        const users = { 'u-admin': { id: 'u-admin', role: 'admin', name: 'Abdulloh', email: 'admin@x.uz' }, 'u-rop': { id: 'u-rop', role: 'rop', name: 'Bahodir', email: 'rop@x.uz' },
            'u-ropru': { id: 'u-ropru', role: 'rop', name: 'Rus Rop', email: 'ropru@x.uz' }, 'u-ropnone': { id: 'u-ropnone', role: 'rop', name: 'Tilsiz', email: 'ropnone@x.uz' } };
        const app = express(); app.use(express.json());
        app.use('/api/school', require('../server/routes/school')({ db: { pool, tx: fn => tx(fn) }, authRequired: (req, res, next) => { req.user = { ...users[req.headers['x-user']] }; next(); },
            findUserById: async id => users[id] || null }));
        server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
        const call = async (user, method, path, body) => {
            const r = await fetch(`http://127.0.0.1:${server.address().port}/api/school${path}`, { method, headers: { 'content-type': 'application/json', 'x-user': user }, body: body ? JSON.stringify(body) : undefined });
            return { status: r.status, body: await r.json() };
        };

        await t.test('karta va o\'quvchi amallari: boshqa til → 403, o\'z tili → 200', async () => {
            assert.equal((await call('u-rop', 'GET', '/students/en1/card')).status, 200);
            assert.equal((await call('u-rop', 'GET', '/students/ru1/card')).status, 403);
            assert.equal((await call('u-rop', 'POST', '/students/ru1/freeze', { from: '2026-11-03', to: '2026-11-10', reason: 'x' })).status, 403);
            assert.equal((await call('u-ropru', 'GET', '/students/ru1/card')).status, 200);
            assert.equal((await call('u-ropru', 'GET', '/students/en1/history')).status, 403);
            assert.equal((await call('u-admin', 'GET', '/students/ru1/card')).status, 200, 'admin o\'zgarmagan');
            assert.equal((await call('u-ropnone', 'GET', '/students/ru1/card')).status, 200, 'tilsiz ROP — eski xatti-harakat');
        });

        await t.test('guruhlar va sotuv tahriri so\'rovlari ro\'yxati o\'z tilida', async () => {
            await pool.query(`INSERT INTO school_edit_requests(id, student_id, kind, requested_by, status, changes, reason) VALUES ('rq-en','en1','tariff','u-s','pending','{}','x'),('rq-ru','ru1','tariff','u-s','pending','{}','x')`);
            const g = await call('u-rop', 'GET', '/groups');
            assert.equal(g.status, 200);
            assert.deepEqual(g.body.groups.map(x => x.student_id), ['en1']);
            assert.deepEqual((await call('u-admin', 'GET', '/groups')).body.groups.map(x => x.student_id).sort(), ['en1', 'ru1']);
            const rq = await call('u-rop', 'GET', '/edit-requests');
            assert.equal(rq.status, 200);
            assert.deepEqual(rq.body.requests.map(r => r.id), ['rq-en']);
            assert.deepEqual(rq.body.counts, { pending: 1 });
            const rqRu = await call('u-ropru', 'GET', '/edit-requests');
            assert.deepEqual(rqRu.body.requests.map(r => r.id), ['rq-ru']);
            const dec = await call('u-rop', 'POST', '/edit-requests/rq-ru/decide', { decision: 'reject', note: 'x' });
            assert.equal(dec.status, 403);
        });

        await t.test('sinov: ROP boshqa til lidiga sinov qo\'ya olmaydi', async () => {
            const r = await call('u-rop', 'POST', '/bookings', { kind: 'trial', leadId: 'l-ru', teacherId: 'rus', date: '2026-11-03', time: '10:00', duration: 30 });
            assert.equal(r.status, 403);
            assert.match(r.body.error, /til/);
        });

        await t.test('sinov bandini bekor qilish: ROP faqat o\'z tilida (lid tili, lid bo\'lmasa ustoz tili)', async () => {
            await pool.query(`INSERT INTO school_bookings(id, teacher_id, kind, lead_id, date, start_min, end_min, status, created_by) VALUES
              ('b-ru','rus','trial','l-ru','2026-11-03',600,630,'pending','u-ropru'),('b-en','dil','trial','l-en','2026-11-03',600,630,'pending','u-rop'),
              ('b-ru2','rus','trial',null,'2026-11-04',600,630,'pending','u-ropru'),('b-ru3','rus','trial','l-ru','2026-11-05',600,630,'pending','u-ropru')`);
            const enOnRu = await call('u-rop', 'POST', '/bookings/b-ru/cancel');
            assert.equal(enOnRu.status, 403);
            assert.match(enOnRu.body.error, /til/);
            assert.equal((await call('u-rop', 'POST', '/bookings/b-ru2/cancel')).status, 403, 'lidsiz band — ustoz tili');
            assert.equal((await call('u-ropru', 'POST', '/bookings/b-en/cancel')).status, 403);
            assert.equal((await pool.query(`SELECT status FROM school_bookings WHERE id='b-ru'`)).rows[0].status, 'pending');
            assert.equal((await call('u-ropru', 'POST', '/bookings/b-ru/cancel')).status, 200);
            assert.equal((await call('u-rop', 'POST', '/bookings/b-en/cancel')).status, 200);
            assert.equal((await call('u-admin', 'POST', '/bookings/b-ru3/cancel')).status, 200, 'admin o\'zgarmagan');
        });

        await t.test('jadval: ROP so\'ralgan tilni emas, o\'z tilini oladi', async () => {
            const r = await call('u-ropru', 'GET', '/schedule?from=2026-11-03&to=2026-11-03&lang=english');
            assert.equal(r.status, 200);
            assert.equal(r.body.lang, 'russian');
        });
    } finally {
        if (server) server.close();
        await pool.end();
    }
});
