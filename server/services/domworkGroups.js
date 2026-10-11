'use strict';
const { randomUUID } = require('node:crypto');

// Independent additive storage: never rewrites students, HR links or old chats.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS domwork_learning_groups (
 id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('trial','classroom')),
 name TEXT NOT NULL, teacher_id TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'russian' CHECK(language='russian'),
 invite_link TEXT NOT NULL, chat_id TEXT NOT NULL DEFAULT '',
 is_default BOOLEAN NOT NULL DEFAULT FALSE, archived BOOLEAN NOT NULL DEFAULT FALSE,
 revision INTEGER NOT NULL DEFAULT 1, verified_at TIMESTAMPTZ,
 created_by TEXT NOT NULL, updated_by TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(NOT (archived AND is_default))
);
CREATE UNIQUE INDEX IF NOT EXISTS domwork_learning_default ON domwork_learning_groups(type,teacher_id) WHERE is_default AND NOT archived;
-- Empty invites are allowed for discovered chats; never manufacture a URL.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='domwork_learning_invite' AND indexdef NOT LIKE '%<>%') THEN
  DROP INDEX domwork_learning_invite;
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS domwork_learning_invite ON domwork_learning_groups(invite_link) WHERE NOT archived AND invite_link<>'';
CREATE UNIQUE INDEX IF NOT EXISTS domwork_learning_chat ON domwork_learning_groups(chat_id) WHERE chat_id<>'' AND NOT archived;
CREATE TABLE IF NOT EXISTS domwork_learning_group_audit (
 id BIGSERIAL PRIMARY KEY, group_id TEXT NOT NULL, actor_id TEXT NOT NULL, action TEXT NOT NULL,
 before_data JSONB, after_data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS domwork_student_group_links (
 student_id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES domwork_learning_groups(id),
 revision INTEGER NOT NULL DEFAULT 1, updated_by TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS domwork_student_group_audit (
 id BIGSERIAL PRIMARY KEY, student_id TEXT NOT NULL, actor_id TEXT NOT NULL,
 before_data JSONB, after_data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;
const fail = (status, message) => Object.assign(new Error(message), { status });
async function initSchema(db) { await db.query(SCHEMA); }
function inviteLink(raw) {
    if (typeof raw !== 'string' || raw.length > 300) throw fail(400, 'Telegram guruh havolasini kiriting');
    let url;
    try { url = new URL(raw.trim()); } catch { throw fail(400, 'Telegram havolasi noto‘g‘ri'); }
    if (url.protocol !== 'https:' || url.hostname !== 't.me' || url.port || url.username || url.password || url.search || url.hash)
        throw fail(400, 'Faqat https://t.me/ guruh havolasi qabul qilinadi');
    const path = url.pathname.replace(/\/$/, '');
    const invite = path.match(/^\/(?:\+|joinchat\/)([A-Za-z0-9_-]{6,128})$/);
    if (invite) return 'https://t.me/+' + invite[1];
    if (/^\/[A-Za-z][A-Za-z0-9_]{4,31}$/.test(path)) return 'https://t.me' + path.toLowerCase();
    throw fail(400, 'Guruh havolasi noto‘g‘ri; xabar yoki bot havolasini kiritmang');
}
function input(body) {
    if (!body || !['trial', 'classroom'].includes(body.type)) throw fail(400, 'Sinov yoki asosiy dars turini tanlang');
    if (body.language && body.language !== 'russian') throw fail(400, 'Bu bo‘lim faqat rus tili uchun');
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const teacherId = typeof body.teacherId === 'string' ? body.teacherId.trim() : '';
    if (!name || name.length > 120) throw fail(400, 'Guruh nomi 1–120 belgidan iborat bo‘lsin');
    if (!teacherId || teacherId.length > 100) throw fail(400, 'Ustozni tanlang');
    if (typeof body.isDefault !== 'boolean') throw fail(400, 'Standart guruh belgisi noto‘g‘ri');
    const chatId = body.chatId == null ? '' : String(body.chatId).trim();
    if (chatId && (!/^-[1-9]\d{4,15}$/.test(chatId) || !Number.isSafeInteger(Number(chatId)))) throw fail(400, 'Guruh chat_id qiymati manfiy butun son bo‘lishi kerak');
    return { type: body.type, name, teacherId, inviteLink: body.inviteLink === '' && chatId ? '' : inviteLink(body.inviteLink), chatId, isDefault: body.isDefault };
}
function revision(raw) {
    if (!Number.isSafeInteger(raw) || raw < 1) throw fail(400, 'Yozuv versiyasi talab qilinadi');
    return raw;
}
function dto(row) {
    return { id: row.id, type: row.type, name: row.name, teacherId: row.teacher_id,
        teacherName: row.teacher_name || '', inviteLink: row.invite_link, chatId: row.chat_id,
        isDefault: row.is_default, archived: row.archived, revision: row.revision,
        botVerified: Boolean(row.verified_at), updatedAt: row.updated_at };
}
async function admin(db, actor) {
    const row = (await db.query('SELECT id,role FROM users WHERE id=$1', [actor?.id])).rows[0];
    if (row?.role !== 'admin') throw fail(403, 'Guruhlarni faqat CRM administratori boshqaradi');
}
const TEACHERS = `SELECT id,name FROM hr_employees WHERE role IN ('oqituvchi','rus-oqituvchi')
 AND (role='rus-oqituvchi' OR lang='russian') AND COALESCE(status,'active')<>'inactive' ORDER BY name,id`;
async function list(db, actor) {
    await admin(db, actor);
    const teachers = (await db.query(TEACHERS)).rows;
    const groups = (await db.query(`SELECT g.*,h.name AS teacher_name FROM domwork_learning_groups g
        LEFT JOIN hr_employees h ON h.id=g.teacher_id ORDER BY g.archived,g.type,g.name,g.id`)).rows.map(dto);
    return { groups, teachers };
}
async function transaction(pool, fn) {
    const db = await pool.connect();
    try { await db.query('BEGIN'); const result = await fn(db); await db.query('COMMIT'); return result; }
    catch (error) { await db.query('ROLLBACK');
        if (error.code === '23505') throw fail(409, 'Bu havola yoki chat_id boshqa faol guruhga bog‘langan');
        throw error;
    } finally { db.release(); }
}
async function audit(db, actor, action, before, after) {
    await db.query(`INSERT INTO domwork_learning_group_audit(group_id,actor_id,action,before_data,after_data) VALUES($1,$2,$3,$4,$5)`,
        [after.id, actor.id, action, before ? JSON.stringify(dto(before)) : null, JSON.stringify(dto(after))]);
}
async function save(pool, actor, id, body) {
    return transaction(pool, async db => {
        await admin(db, actor);
        const data = input(body);
        // Serializes edits and default changes across ALL groups for the same teacher.
        await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-learning-groups'))");
        if(data.chatId && (await db.query("SELECT to_regclass('domwork_bot_groups') AS relation")).rows[0]?.relation
            && (await db.query('SELECT id FROM domwork_bot_groups WHERE chat_id=$1',[data.chatId])).rows.length)
            throw fail(409,'Bu chat_id botning bo‘lim guruhiga biriktirilgan');
        const before = id ? (await db.query('SELECT * FROM domwork_learning_groups WHERE id=$1 FOR UPDATE', [id])).rows[0] : null;
        if (id && !before) throw fail(404, 'Guruh topilmadi');
        if (id && before.revision !== revision(body.revision)) throw fail(409, 'Guruh boshqa oynada o‘zgartirilgan. Ro‘yxatni yangilang');
        if (before?.archived) throw fail(409, 'Avval guruhni arxivdan qaytaring');
        if (before && (before.teacher_id !== data.teacherId || before.type !== data.type)
            && (await db.query('SELECT 1 FROM domwork_student_group_links WHERE group_id=$1 LIMIT 1',[id])).rows.length)
            throw fail(409, 'Guruhda o‘quvchilar bor. Ustoz yoki dars turini almashtirishdan oldin ularni alohida qayta biriktiring');
        if (!(await db.query(`SELECT id FROM hr_employees WHERE id=$1 AND role IN ('oqituvchi','rus-oqituvchi')
            AND (role='rus-oqituvchi' OR lang='russian') AND COALESCE(status,'active')<>'inactive'`, [data.teacherId])).rows.length)
            throw fail(400, 'Faol rus tili ustozi topilmadi');
        const groupId = id || randomUUID();
        if (data.isDefault) {
            const previous = (await db.query('SELECT * FROM domwork_learning_groups WHERE type=$1 AND teacher_id=$2 AND is_default AND NOT archived AND id<>$3 FOR UPDATE', [data.type, data.teacherId, groupId])).rows;
            for (const row of previous) {
                const changed = (await db.query('UPDATE domwork_learning_groups SET is_default=false,revision=revision+1,updated_by=$2,updated_at=NOW() WHERE id=$1 RETURNING *', [row.id, actor.id])).rows[0];
                await audit(db, actor, 'default-replaced', row, changed);
            }
        }
        let after;
        if (before) {
            after = (await db.query(`UPDATE domwork_learning_groups SET type=$2,name=$3,teacher_id=$4,invite_link=$5,chat_id=$6,is_default=$7,
                verified_at=CASE WHEN chat_id=$6 AND invite_link=$5 AND teacher_id=$4 AND type=$2 THEN verified_at ELSE NULL END,
                revision=revision+1,updated_by=$8,updated_at=NOW() WHERE id=$1 RETURNING *`,
                [groupId, data.type, data.name, data.teacherId, data.inviteLink, data.chatId, data.isDefault, actor.id])).rows[0];
        } else {
            after = (await db.query(`INSERT INTO domwork_learning_groups(id,type,name,teacher_id,invite_link,chat_id,is_default,created_by,updated_by)
                VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *`,
                [groupId, data.type, data.name, data.teacherId, data.inviteLink, data.chatId, data.isDefault, actor.id])).rows[0];
        }
        await audit(db, actor, before ? 'edit' : 'create', before, after);
        return dto(after);
    });
}
async function archive(pool, actor, id, body) {
    return transaction(pool, async db => {
        await admin(db, actor);
        if (typeof body?.archived !== 'boolean') throw fail(400, 'Arxiv holati noto‘g‘ri');
        await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-learning-groups'))");
        const before = (await db.query('SELECT * FROM domwork_learning_groups WHERE id=$1 FOR UPDATE', [id])).rows[0];
        if (!before) throw fail(404, 'Guruh topilmadi');
        if (before.revision !== revision(body.revision)) throw fail(409, 'Guruh boshqa oynada o‘zgartirilgan. Ro‘yxatni yangilang');
        const after = (await db.query(`UPDATE domwork_learning_groups SET archived=$2,is_default=false,verified_at=NULL,
            revision=revision+1,updated_by=$3,updated_at=NOW() WHERE id=$1 RETURNING *`, [id, body.archived, actor.id])).rows[0];
        await audit(db, actor, body.archived ? 'archive' : 'restore', before, after);
        return dto(after);
    });
}
// No arbitrary first-group fallback: ambiguous groups require an admin-selected default.
// Telegram delivery MUST additionally require verified_at; a typed chat_id is not proof.
async function defaultForTeacher(db, type, teacherId, { delivery = false } = {}) {
    if (!['trial', 'classroom'].includes(type) || !teacherId) return null;
    const row = (await db.query(`SELECT g.* FROM domwork_learning_groups g JOIN hr_employees h ON h.id=g.teacher_id
        WHERE g.type=$1 AND g.teacher_id=$2 AND g.is_default AND NOT g.archived
        AND h.role IN ('oqituvchi','rus-oqituvchi') AND (h.role='rus-oqituvchi' OR h.lang='russian')
        AND COALESCE(h.status,'active')<>'inactive' AND ($3=false OR g.verified_at IS NOT NULL)`, [type, teacherId, delivery])).rows[0];
    return row ? dto(row) : null;
}
// Main-class routing never falls back to a teacher-wide default or another student's group.
async function forStudent(db, studentId, { delivery = false } = {}) {
    const row = (await db.query(`SELECT g.* FROM domwork_student_group_links l
        JOIN students s ON s.id=l.student_id JOIN domwork_learning_groups g ON g.id=l.group_id
        JOIN hr_employees h ON h.id=g.teacher_id
        WHERE s.id=$1 AND s.subject='russian' AND s.teacher_id=g.teacher_id AND g.type='classroom' AND NOT g.archived
        AND h.role IN ('oqituvchi','rus-oqituvchi') AND (h.role='rus-oqituvchi' OR h.lang='russian')
        AND COALESCE(h.status,'active')<>'inactive' AND ($2=false OR g.verified_at IS NOT NULL)`,[studentId,delivery])).rows[0];
    return row ? dto(row) : null;
}
async function studentInvite(db,studentId,language,legacy='') {
    if(language!=='russian') return legacy;
    const group=await forStudent(db,studentId);
    if(group) return group.inviteLink;
    // Explicit old personal link remains intact only if no new link was approved.
    const assigned=(await db.query('SELECT 1 FROM domwork_student_group_links WHERE student_id=$1',[studentId])).rows.length;
    return assigned?'':legacy;
}
async function studentsList(db, actor) {
    await admin(db, actor);
    const rows=(await db.query(`SELECT s.id,s.name,s.phone,s.teacher_id,s.extra_data,
        h.name AS teacher_name,l.group_id,COALESCE(l.revision,0) AS revision
        FROM students s LEFT JOIN hr_employees h ON h.id=s.teacher_id
        LEFT JOIN domwork_student_group_links l ON l.student_id=s.id WHERE s.subject='russian' ORDER BY s.name,s.id`)).rows;
    return rows.filter(require('./domworkBot/policy').activeStudent).map(s=>({id:s.id,name:s.name,phone:s.phone,
        teacherId:s.teacher_id,teacherName:s.teacher_name,groupId:s.group_id || '',revision:s.revision}));
}
async function assignStudents(pool, actor, items) {
    if(!Array.isArray(items) || !items.length || items.length>100 || new Set(items.map(i=>i?.studentId)).size!==items.length)
        throw fail(400,'1–100 ta takrorlanmagan o‘quvchini tanlang');
    return transaction(pool,async db=>{
        await admin(db,actor);
        await db.query("SELECT pg_advisory_xact_lock(hashtext('domwork-learning-groups'))");
        const result=[];
        for(const item of [...items].sort((a,b)=>String(a.studentId).localeCompare(String(b.studentId)))) {
            if(typeof item?.studentId!=='string' || typeof item.groupId!=='string' || !Number.isSafeInteger(item.revision) || item.revision<0)
                throw fail(400,'O‘quvchi, guruh va yozuv versiyasini kiriting');
            const student=(await db.query("SELECT * FROM students WHERE id=$1 AND subject='russian' FOR UPDATE",[item.studentId])).rows[0];
            if(!require('./domworkBot/policy').activeStudent(student)) throw fail(400,'Faol rus tili o‘quvchisi topilmadi');
            const group=(await db.query(`SELECT g.* FROM domwork_learning_groups g JOIN hr_employees h ON h.id=g.teacher_id
                WHERE g.id=$1 AND g.type='classroom' AND NOT g.archived AND g.teacher_id=$2
                AND h.role IN ('oqituvchi','rus-oqituvchi') AND (h.role='rus-oqituvchi' OR h.lang='russian')
                AND COALESCE(h.status,'active')<>'inactive' FOR UPDATE OF g`,[item.groupId,student.teacher_id])).rows[0];
            if(!group) throw fail(400,'Guruh o‘quvchining asosiy ustoziga tegishli bo‘lishi kerak');
            const before=(await db.query('SELECT * FROM domwork_student_group_links WHERE student_id=$1 FOR UPDATE',[student.id])).rows[0];
            if((before?.revision || 0)!==item.revision) throw fail(409,'O‘quvchi guruhi boshqa oynada o‘zgargan. Yangilang');
            if(before?.group_id===group.id) {result.push(before);continue;}
            const after=(await db.query(`INSERT INTO domwork_student_group_links(student_id,group_id,updated_by) VALUES($1,$2,$3)
                ON CONFLICT(student_id) DO UPDATE SET group_id=EXCLUDED.group_id,revision=domwork_student_group_links.revision+1,
                updated_by=EXCLUDED.updated_by,updated_at=NOW() RETURNING *`,[student.id,group.id,actor.id])).rows[0];
            await db.query('INSERT INTO domwork_student_group_audit(student_id,actor_id,before_data,after_data) VALUES($1,$2,$3,$4)',
                [student.id,actor.id,before?JSON.stringify(before):null,JSON.stringify(after)]);
            result.push(after);
        }
        return {links:result};
    });
}
module.exports = { SCHEMA, initSchema, inviteLink, input, revision, dto, admin, list, save, archive, defaultForTeacher,
    forStudent, studentInvite, studentsList, assignStudents, transaction, audit };
