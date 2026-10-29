const { randomUUID } = require('crypto');
const workflow = require('../../js/trialWorkflow');

function error(status, message) { return Object.assign(new Error(message), { status }); }
async function teacherForActor(client, actor) {
    if (actor?.role !== 'teacher') throw error(403, 'Sinov darsi natijasini faqat biriktirilgan ustoz belgilaydi');
    const { rows } = await client.query(`SELECT he.id, he.name FROM users u
        JOIN hr_employees he ON LOWER(TRIM(he.login)) = LOWER(TRIM(u.email))
        WHERE u.id = $1 AND u.role = 'teacher'
          AND he.role IN ('oqituvchi', 'asosiy', 'ingliz-oqituvchi', 'rus-oqituvchi', 'yordamchi')`, [actor.id]);
    if (rows.length !== 1) throw error(403, 'Ustoz akkaunti HR profiliga aniq biriktirilishi kerak');
    return rows[0];
}
const trialComments = lead => (lead.comments || []).filter(c => c.type === 'trial-lesson' || c.type === 'trial-teacher');
// Sinovni qo'ygan sotuv menejeri — oxirgi "Sinov darsi belgilandi" izohi muallifi (faqat ism).
const managerName = lead => trialComments(lead).filter(c => c.type === 'trial-lesson').slice(-1)[0]?.author || '';
// Ustozga (GET/POST /api/trial-lessons — faqat ustoz roli) lidning telefon raqami berilmaydi: lid — sotuv ma'lumoti,
// ustoz sinovni Meet/xodimlar orqali o'tadi. Sotuv, ROP va admin lidni o'z endpointlaridan (telefon bilan) oladi.
function summary(lead, teacher) {
    return { id: lead.id, name: lead.name, language: lead.language,
        teacherName: teacher.name, trialRequest: workflow.request(lead),
        durationMin: Number(lead.paymentOnboarding?.lessonDuration) || 30, managerName: managerName(lead),
        comments: trialComments(lead) };
}
async function listTrialLessons(client, actor, rowToLead) {
    const teacher = await teacherForActor(client, actor);
    const { rows } = await client.query("SELECT * FROM leads WHERE status = 'sinov-darsida' AND deleted_at IS NULL ORDER BY updated_at DESC");
    return rows.map(rowToLead).filter(lead => workflow.request(lead)?.teacherId === teacher.id).map(lead => summary(lead, teacher));
}
// Ustozning sinovlar tarixi: lid keyingi bosqichga o'tgan yoki sinov qayta qo'yilgan bo'lsa ham
// ustozning o'z natijasi ko'rinadi. Faqat sinovga oid maydonlar — telefon, lid bosqichi,
// to'lov/tarif va sotuv natijasi ustozga berilmaydi.
async function listTrialHistory(client, actor, rowToLead, days = 120) {
    const teacher = await teacherForActor(client, actor);
    const since = Date.now() - Math.max(7, Math.min(400, Number(days) || 120)) * 86400000;
    const { rows } = await client.query(`SELECT * FROM leads WHERE deleted_at IS NULL AND (
            extra_data->'trialRequest'->>'teacherId' = $1
            OR extra_data->'paymentOnboarding'->>'teacherId' = $1
            OR COALESCE(extra_data->'trialHistory', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('teacherId', $1::text)))
        ORDER BY updated_at DESC LIMIT 500`, [teacher.id]);
    const out = [];
    for (const lead of rows.map(rowToLead)) {
        const current = workflow.request(lead);
        const entries = [...(Array.isArray(lead.trialHistory) ? lead.trialHistory.map(r => ({ r, archived: true })) : []),
            ...(current ? [{ r: current, archived: false }] : [])];
        for (const { r, archived } of entries) {
            if (!r || String(r.teacherId) !== String(teacher.id)) continue;
            const at = Date.parse(r.scheduledAt);
            if (!Number.isFinite(at) || at < since) continue;
            // Joriy, hali sinov bosqichidagi so'rovlar "Faol" ro'yxatda; bu yerda faqat yakunlanganlari.
            if (!archived && lead.status === 'sinov-darsida' && r.state !== 'completed') continue;
            const phase = r.state === 'completed' ? (r.attended ? 'done' : 'noshow')
                : r.state === 'rejected' ? 'rejected' : archived ? 'rebooked' : 'closed';
            out.push({ id: `${lead.id}:${r.id}`, leadId: lead.id, name: lead.name, language: lead.language,
                managerName: managerName(lead), phase,
                trialRequest: { id: r.id, teacherId: r.teacherId, scheduledAt: r.scheduledAt, daysCount: r.daysCount, state: r.state,
                    attended: r.attended, reasonLabel: r.reasonLabel || '', resultNote: r.resultNote || '', proposals: r.proposals || [],
                    acceptedAt: r.acceptedAt, completedAt: r.completedAt, rejectedAt: r.rejectedAt, confirmedLate: !!r.confirmedLate } });
        }
    }
    return out.sort((a, b) => String(b.trialRequest.scheduledAt).localeCompare(String(a.trialRequest.scheduledAt)));
}
const tashkent = iso => {
    const d = new Date(Date.parse(iso) + 5 * 3600000);
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};
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
        : payload.action === 'reject' ? `Sinov darsi so‘rovi ustoz tomonidan rad etildi.\nSabab: ${next.reasonLabel}`
            + (next.proposals?.length ? `\nUstoz taklif qilgan vaqtlar: ${next.proposals.map(tashkent).join(', ')}` : '')
            + (next.rejectNote ? `\nIzoh: ${next.rejectNote}` : '')
        : `Sinov darsi: ${next.attended ? 'qatnashdi' : 'qatnashmadi'}.${next.reasonLabel ? '\nSabab: ' + next.reasonLabel : ''}`
            + (next.confirmedLate ? '\n(Ustoz oldindan tasdiqlamagan edi.)' : '')
            + (next.resultNote ? `\nMenejer uchun izoh: ${next.resultNote}` : '');
    const comments = [...(before.comments || []), { id: randomUUID(), type: 'trial-teacher', text,
        author: teacher.name, authorId: actor.id, authorRole: 'teacher', createdAt: now,
        requestId: current.id, reason: next.reasonLabel || '' }];
    const extra = typeof row.extra_data === 'string' ? JSON.parse(row.extra_data) : (row.extra_data || {});
    const updated = await client.query(`UPDATE leads SET extra_data = $2, comments = $3, updated_at = NOW()
        WHERE id = $1 RETURNING *`, [leadId, JSON.stringify({ ...extra, trialRequest: next }), JSON.stringify(comments)]);
    const after = rowToLead(updated.rows[0]);
    await appendAudit(client, leadId, 'trial-' + payload.action, { ...actor, name: teacher.name }, { before, after });
    if (after.language === 'russian') await require('./domworkBot/events').capture(client,'trial-result',leadId,
        {requestId:next.id},`trial-result:${leadId}:${next.id}:${next.state}`);
    return summary(after, teacher);
}
module.exports = { teacherForActor, summary, listTrialLessons, listTrialHistory, updateTrialLesson };
