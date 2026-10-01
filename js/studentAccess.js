(function (root, factory) {
    const access = factory();
    if (typeof module === 'object' && module.exports) module.exports = access;
    else root.studentAccess = access;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const PAYMENT_STAGES = new Set(['tolov-jarayonida', 'tolov-yopildi']);

    function phoneLogin(value) {
        const text = String(value || '').trim();
        if (!/^[+\d\s().-]+$/.test(text)) return '';
        let digits = text.replace(/\D/g, '');
        if (digits.length === 9) digits = '998' + digits;
        if (digits.length < 9 || digits.length > 15) return '';
        return '+' + digits;
    }

    function loginKey(value) {
        return phoneLogin(value) || String(value || '').trim().toLowerCase();
    }

    function studentIdForLead(lang, id) {
        return `slead-${lang === 'russian' ? 'russian' : 'english'}-${id}`;
    }

    function courseForStudent(student, courses) {
        const lang = student.subject === 'russian' ? 'russian' : 'english';
        const matching = (courses || []).filter(c => (c.lang || 'english') === lang);
        return matching.find(c => c.id === student.platformCourseId) || matching[0];
    }

    function findStudentForLead(students, lead, lang) {
        const linked = students.find(s => s.leadRef?.id === lead.id
            && (!s.leadRef.lang || s.leadRef.lang === lang));
        if (linked) return linked;
        const phone = phoneLogin(lead.phone);
        const names = [lead.name, lead.paymentOnboarding?.studentFullName]
            .filter(Boolean).map(n => n.trim().toLowerCase());
        return phone ? students.find(s => (s.subject || 'english') === lang
            && phoneLogin(s.phone) === phone && names.includes(String(s.name || '').trim().toLowerCase())) : undefined;
    }

    function buildStudentForLead(lead, lang, existing, courses, today) {
        const subject = lang === 'russian' ? 'russian' : 'english';
        const onboarding = lead.paymentOnboarding || {};
        const ps = lead.paymentSurvey || {};
        const partial = ps.paymentType === 'partial' && lead.status !== 'tolov-yopildi';
        const paymentKey = JSON.stringify([lead.status, ps.paymentType, ps.paidAmount, ps.debtAmount,
            ps.totalAmount, ps.nextPaymentDate, ps.lastPaymentDate]);
        const syncPayment = !existing || (existing.leadPaymentSyncKey
            ? existing.leadPaymentSyncKey !== paymentKey
            : existing.paidAmount == null && existing.debtAmount == null);
        const student = {
            ...(existing || {}),
            id: existing?.id || studentIdForLead(subject, lead.id),
            name: onboarding.studentFullName || existing?.name || lead.name || '',
            phone: existing?.phone || lead.phone || '',
            subject,
            group: onboarding.courseLevelLabel || existing?.group || '',
            teacherId: onboarding.teacherId || existing?.teacherId || null,
            assistantTeacherId: onboarding.assistantTeacherId || existing?.assistantTeacherId || null,
            lessonDayOfWeek: onboarding.lessonDayOfWeek ?? existing?.lessonDayOfWeek ?? null,
            lessonTime: onboarding.lessonTime || existing?.lessonTime || '',
            lessonDuration: Number(ps.tariff) || onboarding.lessonDuration || existing?.lessonDuration || 15,
            telegramGroupLink: onboarding.telegramGroupLink || existing?.telegramGroupLink || '',
            leadRef: existing?.leadRef || { lang: subject, id: lead.id },
            serialCode: existing?.serialCode || lead.serialCode,
            startDate: existing?.startDate || today,
            managerId: lead.managerId || existing?.managerId || '',
            source: existing?.source || 'lead',
            autoProvisionedFromLead: true,
            paidAmount: syncPayment ? (partial ? (Number(ps.paidAmount) || 0)
                : (Number(ps.totalAmount) || existing?.paidAmount || 0)) : existing.paidAmount,
            debtAmount: lead.status === 'tolov-yopildi' ? 0 : (syncPayment
                ? (partial ? (Number(ps.debtAmount) || 0) : 0) : existing.debtAmount),
            paymentDueDate: lead.status === 'tolov-yopildi' ? '' : (syncPayment
                ? (partial ? (ps.nextPaymentDate || '') : '') : existing.paymentDueDate),
            lastPaymentDate: ps.lastPaymentDate || existing?.lastPaymentDate || '',
            leadPaymentSyncKey: paymentKey,
        };
        if (!student.contract && onboarding.contractNumber) {
            student.contract = { number: onboarding.contractNumber, date: onboarding.contractDate };
        }
        const course = courseForStudent(student, courses);
        if (course) student.platformCourseId = course.id;
        if (!student.login) student.login = phoneLogin(lead.phone);
        return student;
    }

    return { PAYMENT_STAGES, phoneLogin, loginKey, studentIdForLead, courseForStudent, findStudentForLead, buildStudentForLead };
});
