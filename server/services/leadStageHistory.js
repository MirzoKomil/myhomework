// Lid bosqichlari tarixi — haqiqiy voronka (qaysi bosqichgacha yetgani)
// va bosqichlar orasidagi konversiyani hisoblash uchun.
// Tarixni faqat server yozadi: brauzer yuborgan "stageHistory" har doim
// bazadagi oldingi qiymat bilan almashtiriladi (soxtalashtirib bo'lmaydi).
const MAX_ENTRIES = 200;

function nextStageHistory(before, merged, { isNew, at, actor } = {}) {
    const history = Array.isArray(before?.stageHistory) ? before.stageHistory.slice(-MAX_ENTRIES + 1) : [];
    const from = isNew ? null : String(before?.status || '') || null;
    const to = String(merged?.status || '') || null;
    if (to && (isNew || from !== to)) {
        history.push({
            from, to, at: at || new Date().toISOString(),
            managerId: String(merged?.managerId || '') || null,
            by: actor?.id ? String(actor.id) : null,
        });
    }
    return history;
}

module.exports = { nextStageHistory, MAX_ENTRIES };
