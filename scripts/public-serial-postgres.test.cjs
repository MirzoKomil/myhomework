// Faqat bir martalik lokal baza bilan: PAYROLL_TEST_DATABASE_URL=postgresql://...@127.0.0.1/payroll_test_x node --test scripts/public-serial-postgres.test.cjs
// O'quvchi ID'si (serialCode) faqat serverda, noyob: bir vaqtdagi konversiyalar, mavjud takrorlarni
// tuzatish (audit), UNIQUE indeks, brauzer yuborgan ID'ni rad etish. server/services/publicSerial.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const ps = require('../server/services/publicSerial');
const br = require('../server/services/bookRoadmapLead');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url) { const u = new URL(url); if (u.hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(u.pathname)) throw Error('Only disposable loopback DBs'); }

test('nextCode — AA001 … AA999 → AB001', () => {
    assert.equal(ps.nextCode(null), 'AA001');
    assert.equal(ps.nextCode('AA041'), 'AA042');
    assert.equal(ps.nextCode('AA999'), 'AB001');
    assert.equal(ps.nextCode('AZ999'), 'BA001');
    assert.equal(ps.canonical(' aa007 '), 'AA007');
    assert.equal(ps.canonical('EN-0412'), '');
});

test("o'quvchi ID'si — server, noyob (PostgreSQL)", { skip: !url }, async t => {
    const pool = new Pool({ connectionString: url, max: 12 });
    const tx = async fn => { const c = await pool.connect(); try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); } };
    try {
        await pool.query(`DROP TABLE IF EXISTS leads, students, book_roadmap, serial_code_audit;
          CREATE TABLE leads(id TEXT PRIMARY KEY, name TEXT, status TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), deleted_at TIMESTAMPTZ, extra_data JSONB DEFAULT '{}');
          CREATE TABLE students(id TEXT PRIMARY KEY, name TEXT, extra_data JSONB DEFAULT '{}');
          CREATE TABLE book_roadmap(id TEXT PRIMARY KEY, name TEXT, student_id TEXT DEFAULT '', status TEXT DEFAULT 'yangi-oquvchi', lead_ref TEXT);
          -- jonli bazadagidek: ikki menejer bir xil ID bergan (AA001), boshqasi AA422 ikki o'quvchida
          INSERT INTO leads(id,name,status,created_at,extra_data) VALUES
            ('l-j','Kamron','tolov-jarayonida','2026-10-20T10:00:00Z','{"serialCode":"AA001","stageHistory":[{"to":"tolov-jarayonida","at":"2026-10-21T10:00:00Z"}]}'),
            ('l-n','Malika','tolov-jarayonida','2026-10-01T10:00:00Z','{"serialCode":"AA001","stageHistory":[{"to":"tolov-jarayonida","at":"2026-10-25T10:00:00Z"}]}'),
            ('l-old','Eski','tolov-yopildi','2026-01-01T10:00:00Z','{"serialCode":"EN-0412"}'),
            ('l-none','IDsiz','tolov-yopildi','2026-10-02T10:00:00Z','{}'),
            ('l-new','Yangi','qiziqdi','2026-10-03T10:00:00Z','{}');
          INSERT INTO students(id,name,extra_data) VALUES
            ('s-j','Kamron','{"serialCode":"AA001","leadRef":{"id":"l-j","lang":"english"}}'),
            ('s-n','Malika','{"serialCode":"AA001","leadRef":{"id":"l-n","lang":"english"}}'),
            ('s-a','Aziz','{"serialCode":"AA422","joinDate":"2026-03-01"}'),
            ('s-b','Bobur','{"serialCode":"AA422","joinDate":"2026-05-01"}'),
            ('s-none','IDsiz','{"leadRef":{"id":"l-none","lang":"english"},"serialCode":"7790"}'),
            ('s-demo','DEMO','{"serialCode":"AA001","isStaffDemo":true}');
          INSERT INTO book_roadmap(id,name,student_id,lead_ref) VALUES
            ('b-j','Kamron','AA001','{"lang":"english","id":"l-j"}'),
            ('b-n','Malika','AA001','{"lang":"english","id":"l-n"}'),
            ('b-none','IDsiz','','{"lang":"english","id":"l-none"}')`);

        await t.test('takrorlar tuzatiladi: birinchi olgan saqlaydi, keyingisiga yangi ID, audit', async () => {
            const n = await tx(c => ps.migrate(c));
            assert.ok(n > 0);
            const code = async (t2, id, col = "extra_data->>'serialCode'") => (await pool.query(`SELECT ${col} c FROM ${t2} WHERE id=$1`, [id])).rows[0].c;
            assert.equal(await code('leads', 'l-j'), 'AA001', "to'lov bosqichiga birinchi kirgan lid ID'ni saqlaydi");
            const nN = await code('leads', 'l-n');
            assert.notEqual(nN, 'AA001'); assert.match(nN, /^AA4\d\d$/);
            assert.equal(await code('students', 's-n'), nN, "o'quvchi ham lid bilan birga");
            assert.equal(await code('book_roadmap', 'b-n', 'student_id'), nN, 'kitob kartasi ham');
            assert.equal(await code('book_roadmap', 'b-j', 'student_id'), 'AA001');
            assert.equal(await code('students', 's-a'), 'AA422', 'eskisi saqlaydi');
            assert.notEqual(await code('students', 's-b'), 'AA422');
            assert.equal(await code('leads', 'l-old'), 'EN-0412', "boshqa ko'rinishdagi eski ID o'zgarmaydi");
            const none = await code('leads', 'l-none');
            assert.match(none, /^AA\d{3}$/, "to'lov bosqichidagi ID'siz lidga ID berildi");
            assert.equal(await code('students', 's-none'), none);
            assert.equal(await code('book_roadmap', 'b-none', 'student_id'), none);
            assert.equal(await code('leads', 'l-new'), null, "to'lovgacha ID yo'q");
            const audit = (await pool.query('SELECT entity, entity_id, old_code, new_code FROM serial_code_audit ORDER BY id')).rows;
            assert.ok(audit.some(a => a.entity === 'lead' && a.entity_id === 'l-n' && a.old_code === 'AA001' && a.new_code === nN));
            assert.ok(audit.some(a => a.entity === 'student' && a.entity_id === 's-b' && a.old_code === 'AA422'));
            // Takroriy ishga tushirish — hech narsa o'zgarmaydi (idempotent).
            assert.equal(await tx(c => ps.migrate(c)), 0);
            await ps.ensureIndexes(pool);
            await assert.rejects(pool.query(`UPDATE leads SET extra_data = extra_data || '{"serialCode":"AA001"}' WHERE id='l-n'`), /unique|duplicate/i, 'UNIQUE indeks');
        });

        await t.test('bir vaqtdagi 10 ta konversiya — 10 xil ID', async () => {
            for (let i = 0; i < 10; i++) await pool.query(`INSERT INTO leads(id,name,status) VALUES ($1,'P','qiziqdi')`, ['p' + i]);
            const codes = await Promise.all(Array.from({ length: 10 }, (_, i) => tx(async c => {
                const before = { id: 'p' + i, status: 'qiziqdi' }; const merged = { ...before, status: 'tolov-jarayonida', serialCode: 'AA001' /* brauzer o'ylab topgan */ };
                const r = await ps.applyToLead(c, before, merged, merged.status);
                await new Promise(res => setTimeout(res, 20));
                await c.query(`UPDATE leads SET status=$2, extra_data = extra_data || jsonb_build_object('serialCode',$3::text) WHERE id=$1`, [before.id, merged.status, merged.serialCode]);
                assert.equal(r.assigned, true);
                return merged.serialCode;
            })));
            assert.equal(new Set(codes).size, 10, codes.join(','));
            assert.ok(!codes.includes('AA001'));
        });

        await t.test("bir marta berilgan ID o'zgarmaydi, brauzer yuborgani rad etiladi", async () => {
            const m = { status: 'tolov-yopildi', serialCode: 'ZZ999' };
            await tx(c => ps.applyToLead(c, { serialCode: 'AA001' }, m, m.status));
            assert.equal(m.serialCode, 'AA001');
            const early = { status: 'qiziqdi', serialCode: 'AB123' };
            await tx(c => ps.applyToLead(c, { status: 'yangi' }, early, early.status));
            assert.equal(early.serialCode, undefined);
        });

        await t.test("o'quvchilar ro'yxati (PATCH /api/state): bazadagi/liddagi ID, eskirgan nusxa emas", async () => {
            const nN = (await pool.query(`SELECT extra_data->>'serialCode' c FROM leads WHERE id='l-n'`)).rows[0].c;
            const list = [{ id: 's-n', serialCode: 'AA001', leadRef: { id: 'l-n' } }, { id: 's-x', serialCode: 'AA777' }, { id: 's-y', leadRef: { id: 'l-n' } }];
            const existing = new Map([['s-n', { serialCode: nN }]]);
            await tx(c => ps.guardStudentSerials(c, list, existing));
            assert.equal(list[0].serialCode, nN, 'eski oynadagi takror ID qabul qilinmaydi');
            assert.equal(list[1].serialCode, undefined, "server bermagan ID qabul qilinmaydi");
            assert.equal(list[2].serialCode, undefined, 'bitta ID ikki o\'quvchiga berilmaydi');
        });

        await t.test("lidga ID berilgach bog'langan o'quvchi va karta to'ldiriladi", async () => {
            await pool.query(`INSERT INTO leads(id,name,status) VALUES ('l-sync','S','tolov-jarayonida');
              INSERT INTO students(id,name,extra_data) VALUES ('s-sync','S','{"leadRef":{"id":"l-sync"}}');
              INSERT INTO book_roadmap(id,name,lead_ref) VALUES ('b-sync','S','{"lang":"english","id":"l-sync"}')`);
            const code = await tx(async c => { const k = await ps.allocate(c); await c.query(`UPDATE leads SET extra_data = jsonb_build_object('serialCode',$2::text) WHERE id=$1`, ['l-sync', k]); await ps.syncLinked(c, 'l-sync', k); return k; });
            assert.equal((await pool.query(`SELECT extra_data->>'serialCode' c FROM students WHERE id='s-sync'`)).rows[0].c, code);
            assert.equal((await pool.query(`SELECT student_id c FROM book_roadmap WHERE id='b-sync'`)).rows[0].c, code);
        });

        await t.test("admin snapshot: to'lanmagan lid kartasi jo'natilmaydi, bosqich o'zgarmasa — o'tadi", async () => {
            await pool.query(`INSERT INTO leads(id,name,status,extra_data) VALUES ('l-unpaid','U','tolov-jarayonida','{"paymentSurvey":{"paymentType":"partial"}}'),('l-paid','P','tolov-jarayonida','{"paymentSurvey":{"paymentType":"full"}}');
              INSERT INTO book_roadmap(id,name,status,lead_ref) VALUES ('b-u','U','pochtaga-topshirildi','{"id":"l-unpaid"}'),('b-p','P','manzil-olindi','{"id":"l-paid"}')`);
            await br.assertSnapshotTransitions(pool, [{ id: 'b-u', status: 'pochtaga-topshirildi', leadRef: { id: 'l-unpaid' } }]);
            await assert.rejects(br.assertSnapshotTransitions(pool, [{ id: 'b-u', name: 'U', status: 'pochta-yetib-bordi', leadRef: { id: 'l-unpaid' } }]), e => e.status === 409);
            await assert.rejects(br.assertSnapshotTransitions(pool, [{ id: 'b-new', name: 'N', status: 'pochtaga-topshirildi', leadRef: { id: 'l-unpaid' } }]), e => e.status === 409, 'yangi karta ham');
            await br.assertSnapshotTransitions(pool, [{ id: 'b-p', status: 'pochtaga-topshirildi', leadRef: { id: 'l-paid' } }]);
            await br.assertSnapshotTransitions(pool, [{ id: 'b-m', status: 'pochtaga-topshirildi', leadRef: null }]);
            await assert.rejects(br.assertSnapshotTransitions(pool, [{ id: 'b-p', status: 'xato' }]), e => e.status === 400);
        });
    } finally {
        await pool.query('DROP TABLE IF EXISTS leads, students, book_roadmap, serial_code_audit').catch(() => {});
        await pool.end();
    }
});
