(function (root, factory) {
    const workflow = factory();
    if (typeof module === 'object' && module.exports) module.exports = workflow;
    else root.trialWorkflow = workflow;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const REASONS = [
        { id: 'teacher-late', label: "Ustoz vaqtida o'tmadi" },
        { id: 'student-missed', label: "O'quvchi vaqtida qatnashmadi" },
        { id: 'student-rescheduled', label: "O'quvchi boshqa vaqtga ko'chirdi" },
        { id: 'teacher-rescheduled', label: "Ustoz boshqa vaqtga ko'chirdi" },
        { id: 'attended-wants-other-teacher', label: "Qatnashdi, boshqa ustozni ham ko'rmoqchi" }
    ];
    function booking(lead) {
        const ob = lead?.paymentOnboarding || {};
        return { teacherId: String(ob.teacherId || lead?.trialLesson?.teacherId || ''),
            scheduledAt: lead?.trialLessonAt || lead?.trialLesson?.date || '', daysCount: Number(ob.trialDaysCount) || 1 };
    }
    function sameBooking(a, b) {
        return !!a && !!b && a.teacherId === b.teacherId && a.scheduledAt === b.scheduledAt && a.daysCount === b.daysCount;
    }
    function request(lead) {
        if (lead?.status !== 'sinov-darsida' && lead?.trialRequest?.id) return lead.trialRequest;
        const b = booking(lead);
        if (!b.teacherId || !b.scheduledAt) return null;
        if (sameBooking(lead?.trialRequest, b)) return lead.trialRequest;
        return { ...b, id: 'legacy:' + b.teacherId + ':' + b.scheduledAt + ':' + b.daysCount, state: 'pending' };
    }
    function attended(lead) { return request(lead)?.attended === true; }
    function matchesFilter(lead, filter) {
        return filter === 'all' || (filter === 'attended' ? attended(lead) : !attended(lead));
    }
    function syncSchedule(before, after, makeId, now) {
        const previous = request(before);
        const next = booking(after);
        const enteringTrial = after.status === 'sinov-darsida' && before?.status !== 'sinov-darsida';
        const changed = !sameBooking(booking(before), next) || enteringTrial
            || (after.trialScheduleRevision && after.trialScheduleRevision !== before?.trialScheduleRevision);
        // Attendance and acceptance are server-owned, never taken from a CRM snapshot.
        if (after.status !== 'sinov-darsida' || !changed) {
            return { trialRequest: previous, trialHistory: Array.isArray(before?.trialHistory) ? before.trialHistory : [] };
        }
        if (!next.teacherId || !next.scheduledAt || !Number.isFinite(new Date(next.scheduledAt).getTime())) {
            throw Object.assign(new Error('Sinov darsi uchun ustoz va vaqt tanlanishi shart'), { status: 400 });
        }
        return { trialRequest: { ...next, id: makeId(), state: 'pending', requestedAt: now },
            trialHistory: [...(Array.isArray(before?.trialHistory) ? before.trialHistory : []), ...(previous ? [{ ...previous, archivedAt: now }] : [])] };
    }
    function transition(current, payload, actor, now) {
        if (!current || payload.requestId !== current.id) {
            throw Object.assign(new Error('Sinov darsi qayta belgilangan. Ro‘yxatni yangilang.'), { status: 409 });
        }
        if (payload.action === 'accept') {
            if (current.state === 'accepted') return null;
            if (current.state !== 'pending') throw Object.assign(new Error('Bu sinov darsi natijasi allaqachon belgilangan'), { status: 409 });
            return { ...current, state: 'accepted', acceptedAt: now, acceptedBy: actor.id };
        }
        if (payload.action !== 'outcome' || typeof payload.attended !== 'boolean') {
            throw Object.assign(new Error('Sinov darsi natijasini tanlang'), { status: 400 });
        }
        if (current.state !== 'accepted') throw Object.assign(new Error('Avval sinov darsi so‘rovini tasdiqlang'), { status: 409 });
        const reason = REASONS.find(r => r.id === payload.reasonId);
        if (!payload.attended && !reason) throw Object.assign(new Error('Sinov darsi nima uchun o‘tilmaganini tanlang'), { status: 400 });
        const present = payload.attended || reason?.id === 'attended-wants-other-teacher';
        return { ...current, state: 'completed', attended: present, reasonId: payload.attended ? '' : reason.id,
            reasonLabel: payload.attended ? '' : reason.label, completedAt: now, completedBy: actor.id };
    }
    return { REASONS, booking, sameBooking, request, attended, matchesFilter, syncSchedule, transition };
});
