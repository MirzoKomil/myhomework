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
    // Ustoz "Vaqt to'g'ri kelmaydi" deganda (UstozSinov dizayni). Eski REASONS ham qabul qilinadi
    // (ustoz ilovasi va Telegram bot shulardan foydalanadi).
    const REJECT_REASONS = [
        { id: 'teacher-busy', label: 'Shu vaqtda bandman' },
        { id: 'teacher-health', label: "Sog'lig'im" },
        { id: 'teacher-other', label: 'Boshqa sabab' }
    ];
    const MAX_PROPOSALS = 3;
    // Barcha rollarda bir xil nom: ustoz kabineti, admin "Sinov darsi", ROP nazorati (va keyin sotuv).
    const PHASES = {
        unassigned: { label: 'Ustoz biriktirilmagan', tone: 'warn' },
        rejected: { label: 'Rad etildi', tone: 'warn' },
        pending: { label: 'Tasdiq kutilmoqda', tone: 'mute' },
        overdue: { label: "Muddati o'tdi · natija kerak", tone: 'bad' },
        accepted: { label: 'Tasdiqlandi', tone: 'info' },
        result: { label: 'Natija kutilmoqda', tone: 'warn' },
        done: { label: "O'tkazildi", tone: 'ok' },
        noshow: { label: 'Lid kelmadi', tone: 'bad' },
        sold: { label: 'Sotildi', tone: 'ok' },
        rebooked: { label: "Qayta qo'yildi", tone: 'mute' },
        closed: { label: 'Sinovdan chiqarildi', tone: 'mute' },
        cancelled: { label: 'Sinov bekor qilindi', tone: 'mute' }
    };
    // ROP/admin sinovni bekor qilgan (lid "Sinov darsida"da qoladi, ustoz va band olib tashlangan). Belgi faqat
    // shu jadval revision'iga tegishli — menejer qayta sinov qo'ysa (yangi revision) bekor holati o'z-o'zidan tushadi.
    function isCancelled(lead) {
        const c = lead && lead.trialCancelled;
        return !!(c && c.rev && lead.status === 'sinov-darsida' && c.rev === lead.trialScheduleRevision);
    }
    // "Sotildi" — sotuv O'quvchilari bilan bir manba: lid "To'lov jarayonida"ga o'tganda o'quvchi yaratiladi (js/app.js LEAD_STATUSES_NEED_SERIAL).
    const SOLD_STATUSES = new Set(['tolov-jarayonida', 'tolov-yopildi']);
    // Sinov darsi holati (bitta manba). opts: { leadStatus, durationMin, now (ms), archived }.
    // Tasdiqlanmagan va vaqti o'tib ketgan sinov "osilib" qolmaydi — "Muddati o'tdi · natija kerak".
    function phase(request, opts = {}) {
        const now = Number.isFinite(opts.now) ? opts.now : Date.now();
        const status = opts.leadStatus;
        const r = request || {};
        if (r.state === 'completed') {
            if (!r.attended) return 'noshow';
            return SOLD_STATUSES.has(status) ? 'sold' : 'done';
        }
        if (opts.archived) return 'rebooked';
        if (status && status !== 'sinov-darsida') return SOLD_STATUSES.has(status) ? 'sold' : 'closed';
        if (!r.teacherId) return 'unassigned';
        if (r.state === 'rejected') return 'rejected';
        const start = Date.parse(r.scheduledAt);
        const dur = Math.max(15, Number(opts.durationMin) || 30);
        if (r.state === 'accepted') return Number.isFinite(start) && start + dur * 60000 <= now ? 'result' : 'accepted';
        return Number.isFinite(start) && start <= now ? 'overdue' : 'pending';
    }
    function durationOf(lead) {
        return Number(lead?.paymentOnboarding?.lessonDuration) || parseInt(lead?.paymentSurvey?.tariff, 10) || 30;
    }
    function leadPhase(lead, now) {
        if (isCancelled(lead)) return 'cancelled';
        return phase(request(lead), { leadStatus: lead?.status, now, durationMin: durationOf(lead) });
    }
    function cleanProposals(list, now) {
        if (list == null) return [];
        if (!Array.isArray(list)) throw Object.assign(new Error("Taklif qilingan vaqtlar noto'g'ri"), { status: 400 });
        const nowMs = Date.parse(now);
        const out = [];
        for (const v of list) {
            const ms = Date.parse(String(v || ''));
            if (!Number.isFinite(ms)) throw Object.assign(new Error("Taklif qilingan vaqt noto'g'ri"), { status: 400 });
            if (ms <= nowMs) throw Object.assign(new Error("Taklif qilingan vaqt o'tib ketgan"), { status: 400 });
            if (ms > nowMs + 30 * 86400000) throw Object.assign(new Error("Taklif 30 kun ichida bo'lishi kerak"), { status: 400 });
            const iso = new Date(ms).toISOString();
            if (!out.includes(iso)) out.push(iso);
        }
        if (out.length > MAX_PROPOSALS) throw Object.assign(new Error(`Ko'pi bilan ${MAX_PROPOSALS} ta vaqt taklif qiling`), { status: 400 });
        return out.sort();
    }
    const cleanNote = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
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
        const validAt = !!next.scheduledAt && Number.isFinite(new Date(next.scheduledAt).getTime());
        // "Ustoz biriktirilmagan": lid istagan vaqtda hech kim bo'sh bo'lmasa, sotuv menejeri sinovni
        // adminga yuboradi (SotuvHolatlar, 4-holat). Faqat shu saqlashda aniq belgilangan bo'lsa qabul
        // qilinadi (trialUnassigned + yangi trialScheduleRevision); admin/ROP keyin "Ustoz biriktirish" qiladi.
        if (!next.teacherId && validAt && after.trialUnassigned === true && after.trialScheduleRevision
            && after.trialScheduleRevision !== before?.trialScheduleRevision) {
            return { trialRequest: null,
                trialHistory: [...(Array.isArray(before?.trialHistory) ? before.trialHistory : []), ...(previous ? [{ ...previous, archivedAt: now }] : [])] };
        }
        if (!next.teacherId || !validAt) {
            throw Object.assign(new Error('Sinov darsi uchun ustoz va vaqt tanlanishi shart'), { status: 400 });
        }
        return { trialRequest: { ...next, id: makeId(), state: 'pending', requestedAt: now }, ...(after.trialUnassigned ? { trialUnassigned: false } : {}),
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
        if (payload.action === 'reject') {
            if (current.state === 'rejected') return null;
            if (current.state !== 'pending') throw Object.assign(new Error('So‘rov allaqachon ko‘rib chiqilgan'), { status: 409 });
            const reason = REJECT_REASONS.find(r => r.id === payload.reasonId) || REASONS.find(r => r.id === payload.reasonId);
            if (!reason) throw Object.assign(new Error('Rad etish sababini tanlang'), { status: 400 });
            const proposals = cleanProposals(payload.proposals, now);
            const note = cleanNote(payload.note, 500);
            return { ...current, state: 'rejected', attended: false, reasonId: reason.id,
                reasonLabel: reason.label, rejectedAt: now, rejectedBy: actor.id,
                ...(proposals.length ? { proposals } : {}), ...(note ? { rejectNote: note } : {}) };
        }
        if (payload.action !== 'outcome' || typeof payload.attended !== 'boolean') {
            throw Object.assign(new Error('Sinov darsi natijasini tanlang'), { status: 400 });
        }
        // Tasdiqlanmay qolgan, lekin vaqti o'tgan sinovga ham natija yoziladi (osilib qolmasin).
        const overdue = current.state === 'pending' && Date.parse(current.scheduledAt) <= Date.parse(now);
        if (current.state !== 'accepted' && !overdue) throw Object.assign(new Error('Avval sinov darsi so‘rovini tasdiqlang'), { status: 409 });
        const reason = REASONS.find(r => r.id === payload.reasonId);
        if (!payload.attended && !reason) throw Object.assign(new Error('Sinov darsi nima uchun o‘tilmaganini tanlang'), { status: 400 });
        const present = payload.attended || reason?.id === 'attended-wants-other-teacher';
        const note = cleanNote(payload.note, 1000);
        return { ...current, state: 'completed', attended: present, reasonId: payload.attended ? '' : reason.id,
            reasonLabel: payload.attended ? '' : reason.label, completedAt: now, completedBy: actor.id,
            ...(overdue ? { confirmedLate: true } : {}), ...(note ? { resultNote: note } : {}) };
    }
    return { REASONS, REJECT_REASONS, PHASES, MAX_PROPOSALS, phase, leadPhase, isCancelled, durationOf, cleanProposals, booking, sameBooking, request, attended, matchesFilter, syncSchedule, transition };
});
