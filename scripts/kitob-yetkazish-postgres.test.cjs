// Faqat bir martalik lokal baza bilan: PAYROLL_TEST_DATABASE_URL=postgresql://...@127.0.0.1/payroll_test_x node --test scripts/kitob-yetkazish-postgres.test.cjs
// Konversiya: sotuv menejeri kitob yetkazish kartochkasini faqat o'z lidi uchun yaratadi/yangilaydi
// (ilgari PATCH /api/state {bookRoadmap} → 403, yozuv yo'qolardi). server/services/bookRoadmapLead.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const br = require('../server/services/bookRoadmapLead');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url) { const u = new URL(url); if (u.hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(u.pathname)) throw Error('Only disposable loopback DBs'); }

test('kitob yetkazish — sotuv faqat o\'z lidi/kartochkasi (PostgreSQL)', { skip: !url }, async t => {
    const pool = new Pool({ connectionString: url });
    const tx = async fn => { const c = await pool.connect(); try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); } };
    const sot = { role: 'sales_manager', name: 'Jahongir' }, admin = { role: 'admin', name: 'Admin' }, rop = { role: 'rop', name: 'ROP' };
    try {
        await pool.query(`DROP TABLE IF EXISTS leads, book_roadmap;
          CREATE TABLE leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,manager_id TEXT,status TEXT,language TEXT,source TEXT,lead_type TEXT,
            extra_data JSONB DEFAULT '{}',comments JSONB DEFAULT '[]',deleted_at TIMESTAMPTZ);
          CREATE TABLE book_roadmap(id TEXT PRIMARY KEY,name TEXT NOT NULL,student_id TEXT DEFAULT '',phone TEXT DEFAULT '',region TEXT DEFAULT '',manager_id TEXT DEFAULT '',
            kind TEXT DEFAULT 'organik',status TEXT DEFAULT 'yangi-oquvchi',date TEXT DEFAULT '',lang TEXT DEFAULT 'english',lead_ref TEXT,comments TEXT DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT NOW(),address TEXT DEFAULT '',dispatched_at TEXT DEFAULT '',delivered_at TEXT DEFAULT '');
          INSERT INTO leads(id,name,phone,manager_id,status,language,source,lead_type,extra_data) VALUES
            ('l-own','Anvar','+998 1','m-jah','tolov-jarayonida','english','Instagram','target','{"serialCode":"EN-0001","region":"Andijon","paymentOnboarding":{"bookAddress":"Andijon, Navoiy 5"},"paymentSurvey":{"paymentType":"partial"}}'),
            ('l-other','Feruza','+998 2','m-nod','tolov-jarayonida','english','Organik','organic','{}'),
            ('l-early','Sherzod','+998 3','m-jah','qiziqdi','english','Organik','organic','{}'),
            ('l-ru','Ruslan','+998 4','m-jah','tolov-yopildi','russian','Organik','organic','{}')`);
        const ID = '11111111-2222-4333-8444-555555555555';

        await t.test('o\'z lidi: kartochka serverdagi liddan yaratiladi, klient ID saqlanadi', async () => {
            const r = await tx(c => br.upsertFromLead(c, { leadId: 'l-own', entryId: ID, actor: sot, managerId: 'm-jah', now: new Date('2026-10-30T06:00:00Z') }));
            assert.equal(r.created, true);
            const e = br.toClient(r.entry);
            assert.equal(e.id, ID);
            assert.deepEqual(e.leadRef, { lang: 'english', id: 'l-own' });
            assert.equal(e.managerId, 'm-jah'); assert.equal(e.studentId, 'EN-0001'); assert.equal(e.address, 'Andijon, Navoiy 5');
            assert.equal(e.kind, 'target'); assert.equal(e.status, 'yangi-oquvchi'); assert.equal(e.date, '30.10.2026');
            assert.match(e.comments.at(-1).text, /Liddan avtomatik qo'shildi/);
        });
        await t.test('qayta chaqiruv — dublikat yo\'q, holat/izohlar saqlanadi, manzil yangilanadi', async () => {
            await pool.query(`UPDATE book_roadmap SET status='manzil-olindi' WHERE id=$1`, [ID]);
            await pool.query(`UPDATE leads SET extra_data = extra_data || '{"paymentOnboarding":{"bookAddress":"Toshkent"}}' WHERE id='l-own'`);
            const r = await tx(c => br.upsertFromLead(c, { leadId: 'l-own', entryId: '99999999-2222-4333-8444-555555555555', actor: sot, managerId: 'm-jah' }));
            assert.equal(r.created, false);
            assert.equal(r.entry.id, ID); assert.equal(r.entry.status, 'manzil-olindi'); assert.equal(r.entry.address, 'Toshkent');
            assert.equal((await pool.query('SELECT count(*)::int n FROM book_roadmap')).rows[0].n, 1);
        });
        await t.test('boshqa menejer lidi → 403; erta bosqich → 409; menejersiz sotuv → 403', async () => {
            await assert.rejects(tx(c => br.upsertFromLead(c, { leadId: 'l-other', actor: sot, managerId: 'm-jah' })), e => e.status === 403);
            await assert.rejects(tx(c => br.upsertFromLead(c, { leadId: 'l-early', actor: sot, managerId: 'm-jah' })), e => e.status === 409);
            await assert.rejects(tx(c => br.upsertFromLead(c, { leadId: 'l-own', actor: sot, managerId: '' })), e => e.status === 403);
            await assert.rejects(tx(c => br.upsertFromLead(c, { leadId: 'yoq', actor: sot, managerId: 'm-jah' })), e => e.status === 404);
        });
        await t.test('ROP — faqat o\'z tili; admin — hammasi', async () => {
            await assert.rejects(tx(c => br.upsertFromLead(c, { leadId: 'l-ru', actor: rop, langs: ['english'] })), e => e.status === 403);
            const a = await tx(c => br.upsertFromLead(c, { leadId: 'l-other', actor: admin }));
            assert.equal(a.created, true); assert.equal(a.entry.manager_id, 'm-nod');
        });
        await t.test('kanban: o\'z kartochkasi — bosqich/izoh; jo\'natish to\'lov tasdig\'isiz → 409', async () => {
            const c1 = await tx(c => br.updateOwnEntry(c, { entryId: ID, patch: { status: 'pochtaga-tayyorlandi', comments: [{ id: 'c1', text: 'Qo\'ng\'iroq qilindi', author: 'J', type: 'manual' }] }, actor: sot, managerId: 'm-jah' }));
            assert.equal(c1.entry.status, 'pochtaga-tayyorlandi');
            assert.equal(JSON.parse(c1.entry.comments)[0].text, 'Qo\'ng\'iroq qilindi');
            await assert.rejects(tx(c => br.updateOwnEntry(c, { entryId: ID, patch: { status: 'pochtaga-topshirildi' }, actor: sot, managerId: 'm-jah' })), e => e.status === 409);
            await pool.query(`UPDATE leads SET extra_data = extra_data || '{"paymentSurvey":{"paymentType":"full"}}' WHERE id='l-own'`);
            const c2 = await tx(c => br.updateOwnEntry(c, { entryId: ID, patch: { status: 'pochtaga-topshirildi' }, actor: sot, managerId: 'm-jah', now: new Date('2026-10-30T06:00:00Z') }));
            assert.equal(c2.entry.dispatched_at, '2026-10-30');
            await assert.rejects(tx(c => br.updateOwnEntry(c, { entryId: ID, patch: { status: 'xato' }, actor: sot, managerId: 'm-jah' })), e => e.status === 400);
        });
        await t.test('kanban: boshqa menejer kartochkasi → 403 (o\'zgarmaydi)', async () => {
            const other = (await pool.query(`SELECT id FROM book_roadmap WHERE manager_id='m-nod'`)).rows[0].id;
            await assert.rejects(tx(c => br.updateOwnEntry(c, { entryId: other, patch: { status: 'manzil-olindi' }, actor: sot, managerId: 'm-jah' })), e => e.status === 403);
            assert.equal((await pool.query('SELECT status FROM book_roadmap WHERE id=$1', [other])).rows[0].status, 'yangi-oquvchi');
        });
    } finally { await pool.end(); }
});
