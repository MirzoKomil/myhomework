// Arxiv va xodimni ishdan bo'shatish — haqiqiy PostgreSQL'dagi integratsion test.
// Ishga tushirish: ARCHIVE_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/archive_test_x node --test scripts/archive-lifecycle-postgres.test.cjs
// Faqat loopback va "archive_test_*" nomli bir martalik bazaga ruxsat beriladi.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');

const url = process.env.ARCHIVE_TEST_DATABASE_URL;
if (url) {
    const parsed = new URL(url);
    if (!['127.0.0.1', 'localhost', ''].includes(parsed.hostname) || !/^\/archive_test_[a-z0-9_]+$/.test(parsed.pathname)) {
        throw Error('Only disposable loopback archive_test_* databases are allowed');
    }
    process.env.DATABASE_URL = url;
}

test('arxiv + ishdan bo‘shatish (PostgreSQL)', { skip: !url }, async t => {
    const db = require('../server/db');
    const archive = require('../server/services/archive');
    const lifecycle = require('../server/services/staffLifecycle');
    const ctx = require('../server/services/archiveContext');
    await db.init();
    const pool = db.pool;
    const admin = (await pool.query("SELECT id, role, email FROM users WHERE role='admin' LIMIT 1")).rows[0];
    const actor = { id: admin.id, role: 'admin', email: admin.email, name: 'Admin' };
    const rop = { id: 'rop-user', role: 'rop', email: 'rop' };
    const asAdmin = fn => ctx.runAs(actor, fn);
    const tx = async fn => {
        const c = await pool.connect();
        try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
        catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    };
    const state = () => db.getFullState();

    await t.test('o‘chirilgan o‘quvchi arxivga tushadi va tiklanadi', async () => {
        await asAdmin(async () => db.patchState({ students: [...(await state()).students, { id: 'st-arx-1', name: 'Arxiv Talaba', phone: '901112233', subject: 'english' }] }, actor));
        const s1 = await state();
        assert.ok(s1.students.some(s => s.id === 'st-arx-1'));
        await asAdmin(async () => db.patchState({ students: s1.students.filter(s => s.id !== 'st-arx-1'), removedStudentIds: ['st-arx-1'] }, actor));
        assert.ok(!(await state()).students.some(s => s.id === 'st-arx-1'));
        const list = await archive.list(pool, actor, { type: 'student', q: 'arxiv talaba' });
        assert.equal(list.items.length, 1);
        const rec = list.items[0];
        assert.equal(rec.title, 'Arxiv Talaba');
        assert.ok(rec.deletedBy, 'kim o‘chirgani yozilgan');
        assert.ok(rec.restorable);
        await tx(c => archive.restore(c, actor, rec.id, { restoreLead: db.restoreLead }));
        assert.ok((await state()).students.some(s => s.id === 'st-arx-1'), 'tiklangan o‘quvchi joyida');
        await assert.rejects(tx(c => archive.restore(c, actor, rec.id, {})), /allaqachon tiklangan/);
        const after = await archive.list(pool, actor, { type: 'student', status: 'restored' });
        assert.ok(after.items.some(i => i.id === rec.id && i.restoredAt));
    });

    await t.test('ID band bo‘lsa tiklash 409 beradi, hech narsa ustidan yozilmaydi', async () => {
        const s = await state();
        await asAdmin(async () => db.patchState({ students: s.students.filter(x => x.id !== 'st-arx-1'), removedStudentIds: ['st-arx-1'] }, actor));
        const rec = (await archive.list(pool, actor, { type: 'student', q: 'st-arx-1' })).items[0];
        await asAdmin(async () => db.patchState({ students: [...(await state()).students, { id: 'st-arx-1', name: 'Yangi odam', subject: 'english' }] }, actor));
        await assert.rejects(tx(c => archive.restore(c, actor, rec.id, {})), e => e.status === 409);
        assert.equal((await state()).students.find(x => x.id === 'st-arx-1').name, 'Yangi odam');
    });

    await t.test('JSON ro‘yxatlar (skript, yo‘riqnoma, pul oqimi) arxivlanadi va tiklanadi', async () => {
        await asAdmin(async () => db.patchState({ scripts: [{ id: 'sc1', title: 'Sovuq qo‘ng‘iroq' }, { id: 'sc2', title: 'Qayta aloqa' }] }, actor));
        await asAdmin(async () => db.patchState({ scripts: [{ id: 'sc2', title: 'Qayta aloqa' }] }, actor));
        const rec = (await archive.list(pool, actor, { type: 'script' })).items.find(i => i.entityId === 'sc1');
        assert.ok(rec, 'skript arxivda');
        await tx(c => archive.restore(c, actor, rec.id, {}));
        assert.deepEqual((await state()).scripts.map(s => s.id).sort(), ['sc1', 'sc2']);
        await asAdmin(async () => db.patchState({ cashFlow: [{ id: 'cf1', type: 'chiqim', amount: 50000, category: 'Ijara', date: '2026-10-01' }] }, actor));
        await asAdmin(async () => db.patchState({ cashFlow: [] }, actor));
        assert.ok((await archive.list(pool, actor, { type: 'cashTx' })).items.some(i => i.entityId === 'cf1'));
    });

    await t.test('HR nomzod media fayli bilan arxivlanadi', async () => {
        const hr = require('../server/services/hrCandidates');
        await hr.initHrSchema();
        await pool.query(`INSERT INTO hr_candidates (id, full_name, contact_phone) VALUES ('cand1','Nomzod Bir','998901234567')`);
        await pool.query(`INSERT INTO hr_candidate_media (id, candidate_id, kind, mime, file_name, bytes) VALUES ('m1','cand1','cv','text/plain','cv.txt', decode('68656c6c6f','hex'))`);
        await ctx.runAs(actor, () => hr.deleteCandidate('cand1'));
        const rec = (await archive.list(pool, actor, { type: 'candidate' })).items[0];
        assert.equal(rec.title, 'Nomzod Bir');
        await tx(c => archive.restore(c, actor, rec.id, {}));
        const m = (await pool.query("SELECT encode(bytes,'hex') AS h FROM hr_candidate_media WHERE id='m1'")).rows[0];
        assert.equal(m.h, '68656c6c6f', 'fayl baytlari aynan qaytdi');
    });

    await t.test('ROP xodim arxivini ko‘rmaydi, lid/o‘quvchini ko‘radi', async () => {
        await assert.rejects(archive.list(pool, rop, { type: 'employee' }), e => e.status === 403);
        const l = await archive.list(pool, rop, {});
        assert.ok(l.items.every(i => ['lead', 'student', 'bookRoadmap', 'script', 'bonus'].includes(i.type)));
    });

    // ── Sotuv egasi va ishdan bo'shatish ──
    const emps = [
        { id: 'm-ali', name: 'Ali Menejer', role: 'sotuv-menejeri', login: '901000001', lang: 'english', status: 'active' },
        { id: 'm-vali', name: 'Vali Menejer', role: 'sotuv-menejeri', login: '901000002', lang: 'english', status: 'active' },
        { id: 'm-gani', name: 'Gani Menejer', role: 'sotuv-menejeri', login: '901000003', lang: 'english', status: 'active' },
        { id: 'm-rus', name: 'Rus Menejer', role: 'sotuv-menejeri', login: '901000004', lang: 'russian', status: 'active' }
    ];
    await t.test('tayyorgarlik: xodimlar, akkaunt, lidlar', async () => {
        const s = await state();
        await asAdmin(async () => db.patchState({ hrEmployees: [...s.hrEmployees, ...emps] }, actor));
        // Sotuv bosqichidagi lid o'quvchi akkauntini yaratadi — buning uchun kurs kerak.
        await pool.query(`UPDATE mobile_content SET data = jsonb_set(COALESCE(data,'{}'::jsonb), '{courses}', '[{"id":"c-en","lang":"english","title":"EN"},{"id":"c-ru","lang":"russian","title":"RU"}]'::jsonb) WHERE singleton = 1`);
        await pool.query(`INSERT INTO users (id,name,email,password_hash,role) VALUES ('u-ali','Ali Menejer','901000001','x','sales_manager') ON CONFLICT DO NOTHING`);
        await pool.query(`INSERT INTO user_sales_manager_links (user_id, manager_id) VALUES ('u-ali','m-ali') ON CONFLICT DO NOTHING`);
        await pool.query(`INSERT INTO sessions (id,user_id,jti) VALUES ('s-ali','u-ali','jti-ali') ON CONFLICT DO NOTHING`);
        // To'lov oqimi (chek, reyestr) bu testning mavzusi emas — lid yozuvi
        // to'g'ridan-to'g'ri upsertLeadWithClient orqali saqlanadi.
        const save = (lead, lang) => tx(c => db.upsertLeadWithClient(c, lead, lang, { actor }));
        const mk = (id, status, lang = 'english') => save({ id, name: 'Lid ' + id, phone: '99890' + String(id.length * 1000 + id.charCodeAt(id.length - 1)).padStart(7, '0'), managerId: 'm-ali', status: 'yangi-lidlar', source: 'Target' }, lang);
        for (const id of ['L1', 'L2', 'L3', 'L4']) await mk(id);
        await mk('LR1', 'yangi-lidlar', 'russian');
        // L3 to'liq sotildi, L4 qisman to'lovda.
        const up = async (id, patch) => {
            const cur = await db.getLeadById(id);
            return save({ ...cur, ...patch }, cur.language);
        };
        await up('L3', { status: 'tolov-yopildi', paymentClosedSurvey: { actualAmount: 1500000, closedDate: '2026-10-20' } });
        await up('L4', { status: 'tolov-jarayonida', paymentSurvey: { paymentType: 'partial', paidAmount: 500000, totalAmount: 1500000 } });
        assert.equal((await db.getLeadById('L3')).saleManagerId, 'm-ali');
        assert.equal((await db.getLeadById('L4')).saleManagerId, 'm-ali');
    });

    await t.test('brauzer saleManagerId’ni soxtalashtira olmaydi; lid berilsa sotuv egasi o‘zgarmaydi', async () => {
        const cur = await db.getLeadById('L3');
        await tx(c => db.upsertLeadWithClient(c, { ...cur, managerId: 'm-vali', saleManagerId: 'm-vali' }, 'english', { actor }));
        const after = await db.getLeadById('L3');
        assert.equal(after.managerId, 'm-vali');
        assert.equal(after.saleManagerId, 'm-ali', 'sotuv Ali’da qoldi');
        await tx(c => db.upsertLeadWithClient(c, { ...after, managerId: 'm-ali' }, 'english', { actor }));
    });

    await t.test('preview: ochiq lidlar, nomzod menejerlar, akkaunt', async () => {
        const p = await lifecycle.preview(pool, actor, 'm-ali');
        assert.equal(p.isSalesManager, true);
        assert.equal(p.leads.open, 4); // L1, L2, L4 (to'lovda), LR1
        assert.equal(p.leads.closed, 1);
        assert.deepEqual(p.targets.map(x => x.id).sort(), ['m-gani', 'm-rus', 'm-vali']);
        assert.equal(p.accounts.length, 1);
        await assert.rejects(lifecycle.preview(pool, rop, 'm-ali'), e => e.status === 403);
    });

    await t.test('tekshiruvlar: sabab, til bo‘yicha menejer, faol emas menejer', async () => {
        await assert.rejects(tx(c => lifecycle.offboard(c, actor, { employeeId: 'm-ali', mode: 'split', targetIds: ['m-vali'] })), /Sababni/);
        await assert.rejects(tx(c => lifecycle.offboard(c, actor, { employeeId: 'm-ali', reason: 'Ketdi', mode: 'split', targetIds: ['m-vali'] })), e => e.code === 'TARGET_LANG_MISSING');
        await assert.rejects(tx(c => lifecycle.offboard(c, actor, { employeeId: 'm-ali', reason: 'Ketdi', mode: 'one', targetId: 'm-yoq' })), /faol sotuv menejeri/);
        assert.equal((await pool.query("SELECT status FROM hr_employees WHERE id='m-ali'")).rows[0].status, 'active', 'xato bo‘lsa hech narsa o‘zgarmaydi');
    });

    await t.test('ishdan bo‘shatish: lidlar teng bo‘linadi, sotuvlar Ali’da qoladi, akkaunt bloklanadi', async () => {
        const r = await tx(c => lifecycle.offboard(c, actor, { employeeId: 'm-ali', reason: 'O‘z xohishi bilan', endDate: '2026-10-25', mode: 'split', targetIds: ['m-vali', 'm-gani', 'm-rus'] }));
        assert.equal(r.reassigned, 4);
        assert.equal(r.unassigned, 0);
        assert.equal(r.accountsBlocked, 1);
        assert.equal(r.sessionsClosed, 1);
        const leads = Object.fromEntries((await pool.query("SELECT id, manager_id, extra_data FROM leads WHERE id IN ('L1','L2','L3','L4','LR1')")).rows.map(x => [x.id, x]));
        assert.equal(leads.L3.manager_id, 'm-ali', 'yopilgan lid tarix uchun Ali’da qoladi');
        assert.equal(leads.LR1.manager_id, 'm-rus', 'rus lidi rus menejeriga');
        assert.ok(['m-vali', 'm-gani'].includes(leads.L1.manager_id) && ['m-vali', 'm-gani'].includes(leads.L2.manager_id));
        assert.ok(['m-vali', 'm-gani'].includes(leads.L4.manager_id));
        assert.equal(leads.L4.extra_data.saleManagerId, 'm-ali', 'qisman to‘lov krediti Ali’da');
        assert.equal((await db.getLeadById('L4')).saleManagerId, 'm-ali');
        const emp = (await pool.query("SELECT status, end_date, offboard_reason FROM hr_employees WHERE id='m-ali'")).rows[0];
        assert.deepEqual([emp.status, emp.end_date, emp.offboard_reason], ['inactive', '2026-10-25', 'O‘z xohishi bilan']);
        assert.equal(await db.findSessionByJti('jti-ali'), null, 'eski sessiya yaroqsiz');
        assert.ok((await db.findUserById('u-ali')).disabled_at);
        const audit = (await pool.query("SELECT COUNT(*)::int AS n FROM lead_audit WHERE action='reassigned' AND lead_id IN ('L1','L2','L4','LR1')")).rows[0].n;
        assert.equal(audit, 4);
        assert.ok((await archive.list(pool, actor, { type: 'offboarding' })).items.some(i => i.entityId === 'm-ali'));
        await assert.rejects(tx(c => lifecycle.offboard(c, actor, { employeeId: 'm-ali', reason: 'x', mode: 'unassigned' })), e => e.code === 'ALREADY_OFFBOARDED');
    });

    await t.test('eski tab HR snapshotini yuborsa ham bo‘shatilgan xodim qayta faollashmaydi', async () => {
        const s = await state();
        const stale = s.hrEmployees.map(e => e.id === 'm-ali' ? { ...e, status: 'active', endDate: '', offboardedAt: null } : e);
        await asAdmin(async () => db.patchState({ hrEmployees: stale }, actor));
        const row = (await pool.query("SELECT status, end_date, offboarded_at FROM hr_employees WHERE id='m-ali'")).rows[0];
        assert.equal(row.status, 'inactive');
        assert.equal(row.end_date, '2026-10-25');
        assert.ok(row.offboarded_at);
        const me = (await state()).hrEmployees.find(e => e.id === 'm-ali');
        assert.equal(me.endDate, '2026-10-25');
        assert.ok(me.offboardedAt);
    });

    await t.test('qayta ishga olish akkauntni ochadi', async () => {
        await tx(c => lifecycle.reinstate(c, actor, { employeeId: 'm-ali' }));
        const row = (await pool.query("SELECT status, end_date, offboarded_at FROM hr_employees WHERE id='m-ali'")).rows[0];
        assert.deepEqual([row.status, row.end_date, row.offboarded_at], ['active', '', null]);
        assert.equal((await db.findUserById('u-ali')).disabled_at, null);
    });

    await t.test('ustozda o‘quvchi bo‘lsa ishdan bo‘shatish to‘xtatiladi', async () => {
        const s = await state();
        await asAdmin(async () => db.patchState({ hrEmployees: [...s.hrEmployees, { id: 't-1', name: 'Ustoz Bir', role: 'ingliz-oqituvchi', login: '902000001', lang: 'english', status: 'active' }] }, actor));
        const s2 = await state();
        await asAdmin(async () => db.patchState({ students: [...s2.students, { id: 'st-t1', name: 'Ustozli talaba', subject: 'english', teacherId: 't-1' }] }, actor));
        await assert.rejects(tx(c => lifecycle.offboard(c, actor, { employeeId: 't-1', reason: 'Ketdi' })), e => e.code === 'TEACHER_HAS_STUDENTS');
        const p = await lifecycle.preview(pool, actor, 't-1');
        assert.equal(p.teacherStudents.main.length, 1);
    });

    await t.test('ochiq lidi bor xodimni oddiy o‘chirib bo‘lmaydi; toza xodim arxivga o‘chadi', async () => {
        const s = await state();
        await assert.rejects(asAdmin(async () => db.patchState({ hrEmployees: s.hrEmployees.filter(e => e.id !== 'm-gani'), removedIds: { hrEmployees: ['m-gani'] } }, actor)),
            e => e.code === 'OFFBOARD_FIRST');
        assert.ok((await state()).hrEmployees.some(e => e.id === 'm-gani'), 'xodim joyida qoldi');
        await asAdmin(async () => db.patchState({ hrEmployees: [...(await state()).hrEmployees, { id: 'e-clean', name: 'Toza Xodim', role: 'boshqaruvchi', status: 'active' }] }, actor));
        const s2 = await state();
        await asAdmin(async () => db.patchState({ hrEmployees: s2.hrEmployees.filter(e => e.id !== 'e-clean'), removedIds: { hrEmployees: ['e-clean'] } }, actor));
        const rec = (await archive.list(pool, actor, { type: 'employee' })).items.find(i => i.entityId === 'e-clean');
        assert.ok(rec);
        const full = await archive.get(pool, actor, rec.id);
        assert.equal(full.snapshot.row.name, 'Toza Xodim');
        await assert.rejects(archive.get(pool, rop, rec.id), e => e.status === 403);
    });

    await t.test('eski tab tiklangan yozuvni qayta o‘chira olmaydi', async () => {
        await asAdmin(async () => db.patchState({ students: [...(await state()).students, { id: 'st-stale', name: 'Eski Tab Talaba', subject: 'english' }] }, actor));
        await asAdmin(async () => db.patchState({ students: (await state()).students.filter(x => x.id !== 'st-stale'), removedIds: { students: ['st-stale'] } }, actor));
        const staleStudents = (await state()).students; // eski tab: unda st-stale yo'q
        const rec = (await archive.list(pool, actor, { type: 'student', q: 'eski tab' })).items[0];
        await tx(c => archive.restore(c, actor, rec.id, {}));
        await asAdmin(async () => db.patchState({ students: staleStudents, removedIds: { students: [] } }, actor));
        assert.ok((await state()).students.some(x => x.id === 'st-stale'), 'eski tab yuborgan ro‘yxatda yo‘q bo‘lsa ham o‘chmadi');
        // removedIds yubormaydigan eski kod ham hech kimni o'chirmaydi
        await asAdmin(async () => db.patchState({ hrEmployees: (await state()).hrEmployees.filter(e => e.id !== 'm-vali') }, actor));
        assert.ok((await state()).hrEmployees.some(e => e.id === 'm-vali'));
    });

    await t.test('tushum yozuvi sotuvni qilgan menejerga yoziladi', async () => {
        const inflow = require('../server/services/inflow');
        const lead = await db.getLeadById('L4');
        assert.notEqual(lead.managerId, 'm-ali');
        const c = await inflow.context(pool, lead, null);
        assert.equal(c.creditManagerId, 'm-ali');
        assert.equal(c.managerId, lead.managerId, 'to‘lovni hozirgi egasi qabul qila oladi');
        // Topshirilgan o'quvchi: yopilgan lid eski menejerda, o'quvchi yangisida — yangi menejer to'lov qabul qila oladi.
        const ctx2 = await inflow.context(pool, { id: 'Lx', managerId: 'm-old', language: 'english' }, { id: 'sx', managerId: 'm-vali', subject: 'english' });
        assert.ok(ctx2.accessManagerIds.includes('m-vali'));
        const engine = require('../js/payrollEngine');
        assert.equal(typeof engine, 'object');
    });

    await t.test('ishdan bo‘shatishda o‘quvchilar topshiriladi, SLA soati yangilanadi', async () => {
        const s = await state();
        await asAdmin(async () => db.patchState({ hrEmployees: [...s.hrEmployees, { id: 'm-bek', name: 'Bek Menejer', role: 'sotuv-menejeri', login: '901000009', lang: 'english', status: 'active' }] }, actor));
        await pool.query(`INSERT INTO students (id, name, subject, extra_data) VALUES ('st-bek1','Bek talabasi','english','{"managerId":"m-bek","paidAmount":100}') ON CONFLICT DO NOTHING`);
        const save = (lead, lang) => tx(c => db.upsertLeadWithClient(c, lead, lang, { actor }));
        await save({ id: 'LB1', name: 'Bek lidi', phone: '998931234567', managerId: 'm-bek', status: 'yangi-lidlar' }, 'english');
        const p = await lifecycle.preview(pool, actor, 'm-bek');
        assert.equal(p.managedStudents.total, 1);
        const r = await tx(c => lifecycle.offboard(c, actor, { employeeId: 'm-bek', reason: 'Ketdi', mode: 'one', targetId: 'm-vali' }));
        assert.equal(r.studentsMoved, 1);
        const st = (await pool.query("SELECT extra_data FROM students WHERE id='st-bek1'")).rows[0].extra_data;
        assert.equal(st.managerId, 'm-vali');
        assert.equal(st.paidAmount, 100, 'boshqa maydonlar saqlanadi');
        assert.equal(st.managerHistory.at(-1).from, 'm-bek');
        const lb = await db.getLeadById('LB1');
        assert.equal(lb.managerId, 'm-vali');
        assert.ok(lb.slaStageEnteredAt && Date.now() - Date.parse(lb.slaStageEnteredAt) < 60000);
    });

    await t.test('qo‘lda Inactive login’ni yopadi, Active qayta ochadi', async () => {
        await pool.query(`INSERT INTO users (id,name,email,password_hash,role) VALUES ('u-vali','Vali Menejer','901000002','x','sales_manager') ON CONFLICT DO NOTHING`);
        await pool.query(`INSERT INTO sessions (id,user_id,jti) VALUES ('s-vali','u-vali','jti-vali') ON CONFLICT DO NOTHING`);
        const s = await state();
        const staleTab = (await state()).hrEmployees; // hammasi active ko'ringan eski tab
        // ROP holatni o'zgartira olmaydi
        await asAdmin(async () => db.patchState({ hrEmployees: s.hrEmployees.map(e => e.id === 'm-vali' ? { ...e, status: 'inactive' } : e), changedStatusIds: { hrEmployees: ['m-vali'] } }, rop));
        assert.equal((await db.findUserById('u-vali')).disabled_at, null, 'ROP login’ni bloklay olmaydi');
        // admin aniq o'zgartirsa — bloklanadi
        await asAdmin(async () => db.patchState({ hrEmployees: s.hrEmployees.map(e => e.id === 'm-vali' ? { ...e, status: 'inactive' } : e), changedStatusIds: { hrEmployees: ['m-vali'] } }, actor));
        assert.ok((await db.findUserById('u-vali')).disabled_at);
        assert.equal(await db.findSessionByJti('jti-vali'), null);
        // eski tab boshqa xodimni tahrirlab "active" yuborsa ham holat qaytmaydi
        await asAdmin(async () => db.patchState({ hrEmployees: staleTab.map(e => e.id === 'm-rus' ? { ...e, phone: '901112233' } : e), changedStatusIds: { hrEmployees: [] } }, actor));
        assert.equal((await pool.query("SELECT status FROM hr_employees WHERE id='m-vali'")).rows[0].status, 'inactive');
        assert.ok((await db.findUserById('u-vali')).disabled_at, 'eski tab login’ni qayta ochmadi');
        const s2 = await state();
        await asAdmin(async () => db.patchState({ hrEmployees: s2.hrEmployees.map(e => e.id === 'm-vali' ? { ...e, status: 'active' } : e), changedStatusIds: { hrEmployees: ['m-vali'] } }, actor));
        assert.equal((await db.findUserById('u-vali')).disabled_at, null);
    });

    await t.test('ROP faqat o‘z tilidagi arxivni ko‘radi', async () => {
        await tx(c => db.upsertLeadWithClient(c, { id: 'LRU9', name: 'Rus lidi', phone: '998935550099', managerId: 'm-rus', status: 'yangi-lidlar' }, 'russian', { actor }));
        await db.softDeleteLead('LRU9', actor);
        const en = await archive.list(pool, { ...rop, langs: ['english'] }, { type: 'lead' });
        assert.ok(!en.items.some(i => i.entityId === 'LRU9'));
        const ru = await archive.list(pool, { ...rop, langs: ['russian'] }, { type: 'lead' });
        assert.ok(ru.items.some(i => i.entityId === 'LRU9'));
        await assert.rejects(tx(c => archive.restore(c, { ...rop, langs: ['english'] }, 'lead:LRU9', { restoreLead: db.restoreLead })), e => e.status === 403);
        await tx(c => archive.restore(c, { ...rop, langs: ['russian'] }, 'lead:LRU9', { restoreLead: db.restoreLead }));
        const restored = await archive.list(pool, actor, { type: 'lead', status: 'restored' });
        assert.ok(restored.items.some(i => i.entityId === 'LRU9'), 'tiklangan lid “Tiklanganlar”da ko‘rinadi');
    });

    await t.test('sana filtri Toshkent kuni bo‘yicha', async () => {
        await pool.query(`UPDATE archive_records SET deleted_at = '2026-10-19T19:30:00Z' WHERE entity_id = 'cf1'`); // 20-okt 00:30 Toshkent
        const d20 = await archive.list(pool, actor, { type: 'cashTx', from: '2026-10-20', to: '2026-10-20' });
        assert.ok(d20.items.some(i => i.entityId === 'cf1'));
        const d19 = await archive.list(pool, actor, { type: 'cashTx', from: '2026-10-19', to: '2026-10-19' });
        assert.ok(!d19.items.some(i => i.entityId === 'cf1'));
    });

    await t.test('butunlay o‘chgan eski lid (brauzer arxivi) tiklanadi', async () => {
        await pool.query(`INSERT INTO json_data (key, data) VALUES ('archive', $1) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data`,
            [JSON.stringify([{ id: 'archive_lead_OLD1_1', type: 'lead', item: { id: 'OLD1', name: 'Eski Lid', phone: '998937770011', status: 'boglanildi', managerId: 'm-vali' }, meta: { lang: 'english' }, deletedAt: '2026-08-01T10:00:00Z', deletedBy: 'Admin' }])]);
        assert.equal(await archive.migrateLegacyBlob(pool), 1);
        assert.equal(await archive.migrateLegacyBlob(pool), 0, 'takrorlanmaydi');
        const rec = (await archive.list(pool, actor, { type: 'lead', q: 'eski lid' })).items[0];
        assert.ok(rec && rec.restorable);
        await tx(c => archive.restore(c, actor, rec.id, { insertLead: (cl, lead, lang) => db.insertRestoredLead(cl, lead, lang, actor) }));
        assert.equal((await db.getLeadById('OLD1')).name, 'Eski Lid');
    });

    await t.test('mobil kontent va yuklangan fayl arxivga tushadi va tiklanadi', async () => {
        const fs = require('fs'), path = require('path'), os = require('os');
        const mc = (await pool.query('SELECT data FROM mobile_content WHERE singleton=1')).rows[0].data;
        await asAdmin(async () => db.patchState({ mobileContent: { ...mc, videos: [...(mc.videos || []), { id: 'vid-x', title: 'Test video' }] } }, actor));
        const mc2 = (await pool.query('SELECT data FROM mobile_content WHERE singleton=1')).rows[0].data;
        await asAdmin(async () => db.patchState({ mobileContent: { ...mc2, videos: mc2.videos.filter(v => v.id !== 'vid-x') } }, actor));
        const vr = (await archive.list(pool, actor, { type: 'mobileItem', q: 'test video' })).items[0];
        assert.ok(vr);
        await tx(c => archive.restore(c, actor, vr.id, {}));
        assert.ok((await pool.query('SELECT data FROM mobile_content WHERE singleton=1')).rows[0].data.videos.some(v => v.id === 'vid-x'));
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arx-up-'));
        fs.writeFileSync(path.join(dir, 'chek.png'), 'png');
        await archive.archiveUpload(pool, dir, 'chek.png', actor);
        assert.ok(!fs.existsSync(path.join(dir, 'chek.png')));
        const ur = (await archive.list(pool, actor, { type: 'upload' })).items.find(i => i.title === 'chek.png');
        await tx(c => archive.restore(c, actor, ur.id, {}));
        assert.equal(fs.readFileSync(path.join(dir, 'chek.png'), 'utf8'), 'png');
    });

    await t.test('arxivdan tiklangan o‘quvchi ketgan ustozga qaytmaydi', async () => {
        await pool.query(`UPDATE hr_employees SET status='inactive', offboarded_at=NOW() WHERE id='t-1'`);
        const s = await state();
        await asAdmin(async () => db.patchState({ students: s.students.filter(x => x.id !== 'st-t1'), removedStudentIds: ['st-t1'] }, actor));
        const rec = (await archive.list(pool, actor, { type: 'student', q: 'ustozli' })).items[0];
        const res = await tx(c => archive.restore(c, actor, rec.id, { validateStudent: (cl, st) => require('../server/services/teacherDuties').validateAssignment(cl, st, {}) }));
        assert.ok(res.warnings.some(w => /Ustoz/.test(w)));
        assert.equal((await pool.query("SELECT teacher_id FROM students WHERE id='st-t1'")).rows[0].teacher_id, null);
    });

    await t.test('HR nomzod fayli arxivda alohida saqlanadi (ro‘yxatda baytlar yo‘q)', async () => {
        const rec = (await archive.list(pool, actor, { type: 'candidate', status: 'all' })).items[0];
        const full = await archive.get(pool, actor, rec.id);
        assert.ok(Array.isArray(full.snapshot.media) && full.snapshot.media[0].size === 5);
        assert.ok(!JSON.stringify(full.snapshot).includes('68656c6c6f'));
    });

    await t.test('lidlar arxiv ro‘yxatida ko‘rinadi va tiklanadi', async () => {
        await db.softDeleteLead('L1', actor);
        const rec = (await archive.list(pool, actor, { type: 'lead' })).items.find(i => i.entityId === 'L1');
        assert.ok(rec && rec.id === 'lead:L1');
        await tx(c => archive.restore(c, actor, rec.id, { restoreLead: db.restoreLead }));
        assert.equal((await db.getLeadById('L1')).deletedAt, null);
    });

    await pool.end?.();
});

// db.js fon taymerlari (eslatmalar va h.k.) jarayonni ochiq ushlab turmasin.
after(() => { if (url) setTimeout(() => process.exit(process.exitCode || 0), 300).unref(); });
