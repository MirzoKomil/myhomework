(function (root, factory) {
    const workflow = factory();
    if (typeof module === 'object' && module.exports) module.exports = workflow;
    else root.leadWorkflow = workflow;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const DEFERRED_STATUS = 'keyin-sotib-olmoqchi';
    const DEFERRED_REASONS = [
        { id: 'no-money', label: "Puli hozir yo'qligi sababli" },
        { id: 'travelling', label: 'Safarda ekanligi sababli' },
        { id: 'busy-work', label: 'Ayni vaqtda ishi ko‘pligi sababli' },
        { id: 'other-education', label: 'Boshqa ta’lim bilan bandligi sababli' },
        { id: 'other', label: 'Boshqa' }
    ];
    const INFO_QUESTION_IDS = ['platform', 'price', 'format', 'terms', 'trial'];
    function canonicalStatus(status) {
        return status === 'malumot-berildi' ? 'boglanildi' : (status || 'yangi-lidlar');
    }
    function isDate(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const date = new Date(value + 'T00:00:00Z');
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }
    function displayDate(value) {
        return isDate(value) ? value.split('-').reverse().join('.') : '';
    }
    function validateDeferredSurvey(survey) {
        if (!DEFERRED_REASONS.some(r => r.id === survey?.reasonId)) {
            return { error: 'Kursni sotib olishni nega kechiktirganini tanlang', target: '[data-deferred-reason]' };
        }
        if (survey.reasonId === 'other' && (typeof survey.otherReason !== 'string' || !survey.otherReason.trim())) {
            return { error: 'Boshqa sababni yozib kiriting', target: '#deferredOtherReason' };
        }
        if (!isDate(survey.purchaseDate)) return { error: 'Qachon sotib olmoqchi: sanani tanlang', target: '#deferredPurchaseDate' };
        if (!isDate(survey.contactDate)) return { error: 'Qachon xabarlashishga kelishildi: sanani tanlang', target: '#deferredContactDate' };
        return null;
    }
    function hasInfoSurvey(lead) {
        return Array.isArray(lead?.infoProvidedSurvey) && INFO_QUESTION_IDS.every(id =>
            lead.infoProvidedSurvey.some(a => a.id === id && a.answer === 'yes'));
    }
    function hasConnectedSurvey(lead) {
        const s = lead?.connectedSurvey;
        return !!s && ['languageLevel', 'applicant', 'gender', 'learningGoal'].every(key =>
            typeof s[key] === 'string' && s[key].trim())
            && Number.isFinite(Number(s.age)) && Number(s.age) >= 7 && Number(s.age) <= 70
            && ((s.residenceType === 'uz' && !!s.region) || (s.residenceType === 'foreign' && !!s.country));
    }
    function hasCombinedSurvey(lead) {
        return hasConnectedSurvey(lead) && hasInfoSurvey(lead);
    }
    function validateStageChange(before, after) {
        const status = canonicalStatus(after.status);
        if (status === DEFERRED_STATUS) return validateDeferredSurvey(after.deferredPurchaseSurvey);
        if (status === 'boglanildi' && (!before || canonicalStatus(before.status) !== status) && !hasCombinedSurvey(after)) {
            return { error: 'Bog‘lanildi bosqichiga o‘tish uchun anketa va ma’lumot berish savollarini to‘liq to‘ldiring' };
        }
        return null;
    }
    return { DEFERRED_STATUS, DEFERRED_REASONS, canonicalStatus, isDate, displayDate,
        validateDeferredSurvey, hasInfoSurvey, hasConnectedSurvey, hasCombinedSurvey, validateStageChange };
});
