const { randomUUID } = require('crypto');
const workflow = require('../../js/trialWorkflow');

function error(status, message) { return Object.assign(new Error(message), { status }); }
async function teacherForActor(client, actor) {
    if (actor?.role !== 'teacher') throw error(403, 'Sinov darsi natijasini faqat biriktirilgan ustoz belgilaydi');
    const { rows } = await client.query(`SELECT he.id, he.name FROM users u
        JOIN hr_employees he ON LOWER(TRIM(he.login)) = LOWER(TRIM(u.email))
        WHERE u.id = $1 AND u.role = 'teacher'
          AND he.role IN ('ingliz-oqituvchi', 'rus-oqituvchi', 'yordamchi')`, [actor.id]);
    if (rows.length !== 1) throw error(403, 'Ustoz akkaunti HR profiliga aniq biriktirilishi kerak');
    return rows[0];
}
function summary(lead, teacher) {
    return { id: lead.id, name: lead.name, phone: lead.phone, language: lead.language,
        teacherName: teacher.name, trialRequest: workflow.request(lead),
        comments: (lead.comments || []).filter(c => c.type === 'trial-lesson' || c.type === 'trial-teacher') };
}
async function listTrialLessons(client, actor, rowToLead) {
    const teacher = await teacherForActor(client, actor);
    const { rows } = await client.query("SELECT * FROM leads WHERE status = 'sinov-darsida' AND deleted_at IS NULL ORDER BY updated_at DESC");
    return rows.map(rowToLead).filter(lead => workflow.request(lead)?.teacherId === teacher.id).map(lead => summary(lead, teacher));
}
async function updateTrialLesson(client, actor, leadId, payload, rowToLead, appendAudit) {
    const teacher = await teacherForActor(client, actor);
    const { rows } = await client.query('SELECT * FROM leads WHERE id = $1 FOR UPDATE', [leadId]);
    const row = rows[0];
    if (!row || row.deleted_at) throw error(404, 'Sinov darsi topilmadi');
    const before = rowToLead(row);
    const current = workflow.request(before);
    if (current?.teacherId !== teacher.id) throw error(403, 'Bu sinov darsi boshqa ustozga biriktirilgan');
    if (before.status !== 'sinov-darsida') throw error(409, 'Lid sinov darsi ustunidan ko‘chirilgan');
    const now = new Date().toISOString();
    const next = workflow.transition(current, payload, actor, now);
    if (!next) return summary(before, teacher);
    const text = payload.action === 'accept' ? 'Sinov darsi so‘rovi ustoz tomonidan tasdiqlandi.'
        : `Sinov darsi: ${next.attended ? 'qatnashdi' : 'qatnashmadi'}.${next.reasonLabel ? '\nSabab: ' + next.reasonLabel : ''}`;
    const comments = [...(before.comments || []), { id: randomUUID(), type: 'trial-teacher', text,
        author: teacher.name, authorId: actor.id, authorRole: 'teacher', createdAt: now,
        requestId: current.id, reason: next.reasonLabel || '' }];
    const extra = typeof row.extra_data === 'string' ? JSON.parse(row.extra_data) : (row.extra_data || {});
    const updated = await client.query(`UPDATE leads SET extra_data = $2, comments = $3, updated_at = NOW()
        WHERE id = $1 RETURNING *`, [leadId, JSON.stringify({ ...extra, trialRequest: next }), JSON.stringify(comments)]);
    const after = rowToLead(updated.rows[0]);
    await appendAudit(client, leadId, 'trial-' + payload.action, { ...actor, name: teacher.name }, { before, after });
    return summary(after, teacher);
}
module.exports = { teacherForActor, summary, listTrialLessons, updateTrialLesson };
