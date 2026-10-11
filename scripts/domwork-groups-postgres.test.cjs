const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const groups = require('../server/services/domworkGroups');
const express = require('express');
const createRouter = require('../server/routes/domworkGroups');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (url) {
    const parsed = new URL(url);
    if (parsed.hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(parsed.pathname)) throw Error('Only disposable loopback DBs');
}
test('Domwork group management on disposable PostgreSQL', { skip: !url }, async t => {
    const pool = new Pool({ connectionString: url });
    const actor = { id: 'admin', role: 'admin' };
    const payload = (type, suffix, extra = {}) => ({ type, name: `Guruh ${suffix}`, teacherId: 'a',
        inviteLink: `https://t.me/+abcdef_${suffix}`, isDefault: false, ...extra });
    let trial, main, second;
    try {
        await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT);
            CREATE TABLE hr_employees(id TEXT PRIMARY KEY,name TEXT,role TEXT,lang TEXT,status TEXT,trial_group_link TEXT);
            CREATE TABLE students(id TEXT PRIMARY KEY,teacher_id TEXT,extra_data JSONB);
            INSERT INTO users VALUES('admin','admin'),('teacher','teacher'),('revoked','sales_manager');
            INSERT INTO hr_employees VALUES('a','Ustoz A','rus-oqituvchi','russian','active','https://t.me/+legacy_a'),
            ('b','Ustoz B','oqituvchi','russian','active','https://t.me/+legacy_b'),
            ('en','English teacher','ingliz-oqituvchi','english','active',''),('inactive','Old teacher','rus-oqituvchi','russian','inactive','');
            INSERT INTO students VALUES('s','a','{"telegramGroupLink":"https://t.me/+oldstudent","paidAmount":12345}');`);
        const hrBefore = (await pool.query('SELECT * FROM hr_employees ORDER BY id')).rows;
        const studentsBefore = (await pool.query('SELECT * FROM students')).rows;
        await t.test('migration is additive and repeatable with no inherited auto-broadcast bindings', async () => {
            await groups.initSchema(pool); await groups.initSchema(pool);
            assert.deepEqual((await groups.list(pool, actor)).teachers.map(x => x.id), ['a', 'b']);
            assert.deepEqual((await groups.list(pool, actor)).groups, []);
        });
        await t.test('a teacher can have separate trial, main and multiple same-type groups', async () => {
            trial = await groups.save(pool, actor, null, payload('trial', 'trial', { isDefault: true }));
            main = await groups.save(pool, actor, null, payload('classroom', 'main', { isDefault: true }));
            second = await groups.save(pool, actor, null, payload('trial', 'second'));
            assert.equal((await groups.list(pool, actor)).groups.length, 3);
            assert.equal((await groups.defaultForTeacher(pool, 'trial', 'a')).id, trial.id);
            assert.equal((await groups.defaultForTeacher(pool, 'classroom', 'a')).id, main.id);
            assert.equal(await groups.defaultForTeacher(pool, 'trial', 'a', { delivery: true }), null);
            assert.equal(await groups.defaultForTeacher(pool, 'trial', 'b'), null);
        });
        await t.test('changing default preserves prior group and records both audit entries', async () => {
            second = await groups.save(pool, actor, second.id, { ...payload('trial', 'second', { isDefault: true }), revision: second.revision });
            const previous = (await groups.list(pool, actor)).groups.find(x => x.id === trial.id);
            assert.equal(previous.isDefault, false); assert.equal(previous.archived, false);
            assert.equal(previous.revision, trial.revision + 1); trial = previous;
            assert.equal((await groups.defaultForTeacher(pool, 'trial', 'a')).id, second.id);
            assert.equal((await pool.query("SELECT COUNT(*) FROM domwork_learning_group_audit WHERE action='default-replaced'")).rows[0].count, '1');
        });
        await t.test('stale edits, duplicates, forged admin role and invalid teachers are rejected without mutations', async () => {
            await assert.rejects(groups.save(pool, actor, trial.id, { ...payload('trial', 'trial'), revision: 1 }), e => e.status === 409);
            await assert.rejects(groups.save(pool, actor, null, payload('trial', 'second', { isDefault: true })), e => e.status === 409);
            assert.equal((await groups.defaultForTeacher(pool, 'trial', 'a')).id, second.id); // rollback also restores previous default
            for (const teacherId of ['en', 'inactive', 'missing']) await assert.rejects(groups.save(pool, actor, null, payload('trial', 'invalid', { teacherId })), e => e.status === 400);
            await assert.rejects(groups.list(pool, { id: 'teacher', role: 'admin' }), e => e.status === 403);
            await assert.rejects(groups.save(pool, { id: 'revoked', role: 'admin' }, null, payload('trial', 'forged')), e => e.status === 403);
            assert.equal((await groups.list(pool, actor)).groups.length, 3);
        });
        await t.test('editing a verified group link revokes verification; manually typed chat IDs cannot enable delivery', async () => {
            await pool.query('UPDATE domwork_learning_groups SET verified_at=NOW() WHERE id=$1', [second.id]);
            assert.equal((await groups.defaultForTeacher(pool, 'trial', 'a', { delivery: true })).id, second.id);
            second = await groups.save(pool, actor, second.id, { ...payload('trial', 'newlink', { isDefault: true, chatId: '-1001234567890' }), revision: second.revision });
            assert.equal(second.botVerified, false);
            assert.equal(await groups.defaultForTeacher(pool, 'trial', 'a', { delivery: true }), null);
        });
        await t.test('archive keeps group, audit and CRM data; restoration does not silently select a default', async () => {
            second = await groups.archive(pool, actor, second.id, { archived: true, revision: second.revision });
            assert.equal(second.archived, true); assert.equal(second.isDefault, false);
            assert.equal(await groups.defaultForTeacher(pool, 'trial', 'a'), null);
            second = await groups.archive(pool, actor, second.id, { archived: false, revision: second.revision });
            assert.equal(second.archived, false); assert.equal(second.isDefault, false);
            assert.equal((await groups.list(pool, actor)).groups.length, 3);
            assert.deepEqual((await pool.query('SELECT * FROM hr_employees ORDER BY id')).rows, hrBefore);
            assert.deepEqual((await pool.query('SELECT * FROM students')).rows, studentsBefore);
        });
        await t.test('audit failure rolls back the new group AND any default changes', async () => {
            await pool.query(`CREATE FUNCTION reject_group_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit failure'; END $$;
                CREATE TRIGGER reject_group_audit BEFORE INSERT ON domwork_learning_group_audit FOR EACH ROW EXECUTE FUNCTION reject_group_audit();`);
            try {
                await assert.rejects(groups.save(pool, actor, null, payload('classroom', 'auditfailure', { isDefault: true })), /fixture audit failure/);
                assert.equal((await groups.defaultForTeacher(pool, 'classroom', 'a')).id, main.id);
                assert.equal((await pool.query("SELECT COUNT(*) FROM domwork_learning_groups WHERE name='Guruh auditfailure'")).rows[0].count, '0');
            } finally { await pool.query('DROP TRIGGER reject_group_audit ON domwork_learning_group_audit; DROP FUNCTION reject_group_audit()'); }
        });
        await t.test('Express routes enforce auth boundary, persisted admin, validation and no-store responses', async () => {
            const app = express(); app.use(express.json());
            // Deliberately forged role in the test auth adapter verifies route/service checks persisted identity.
            app.use('/api/domwork/groups', createRouter(pool, (req, res, next) => {
                if (!req.headers['x-fixture-user']) return res.sendStatus(401);
                req.user = { id: req.headers['x-fixture-user'], role: 'admin' }; next();
            }));
            const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
            const base = `http://127.0.0.1:${server.address().port}/api/domwork/groups`;
            try {
                assert.equal((await fetch(base)).status, 401);
                assert.equal((await fetch(base, { headers: { 'x-fixture-user': 'teacher' } })).status, 403);
                const response = await fetch(base, { headers: { 'x-fixture-user': 'admin' } });
                assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
                const data = await response.json(); assert.equal(data.teachers.length, 2);
                assert.ok(!JSON.stringify(data).includes('created_by'));
                assert.equal((await fetch(base, { method: 'POST', headers: { 'x-fixture-user': 'admin', 'content-type': 'application/json' }, body: '{}' })).status, 400);
                assert.equal((await fetch(base + '/missing/archive', { method: 'POST', headers: { 'x-fixture-user': 'admin', 'content-type': 'application/json' }, body: JSON.stringify({ archived: true, revision: 1 }) })).status, 404);
            } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        });
        await t.test('concurrent default changes are serialized and do not mix teachers or lesson types', async () => {
            const results = await Promise.all([groups.save(pool, actor, null, payload('trial', 'concurrent1', { isDefault: true })),
                groups.save(pool, actor, null, payload('trial', 'concurrent2', { isDefault: true }))]);
            const rows = (await groups.list(pool, actor)).groups;
            assert.equal(rows.filter(g => g.type === 'trial' && g.teacherId === 'a' && g.isDefault).length, 1);
            assert.ok(results.some(g => g.id === rows.find(g => g.type === 'trial' && g.isDefault).id));
            assert.equal((await groups.defaultForTeacher(pool, 'classroom', 'a')).id, main.id);
            await pool.query("UPDATE hr_employees SET status='inactive' WHERE id='a'");
            assert.equal(await groups.defaultForTeacher(pool, 'classroom', 'a'), null);
        });
    } finally { await pool.end(); }
});
