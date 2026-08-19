// Lid bosqichlari (Kanban ustunlari) — js/app.js'dagi FUNNEL_STAGES/
// normalizeLeadStatus bilan AYNAN bir xil bo'lishi shart. Bir nechta joyda
// (public sales API, CAPI.uz chiqish integratsiyasi) ishlatiladi, shuning
// uchun bitta umumiy joyga chiqarilgan.
const FUNNEL_STAGES = [
    { id: 'yangi-lidlar', label: 'Yangi lidlar' },
    { id: 'boglanishga-urinilmoqda', label: "Bog'lanishga urinilmoqda" },
    { id: 'boglanildi', label: "Bog'lanildi" },
    { id: 'malumot-berildi', label: "Ma'lumot berildi" },
    { id: 'qaror-jarayonida', label: 'Qaror jarayonida' },
    { id: 'sinov-darsida', label: 'Sinov darsida' },
    { id: 'tolov-jarayonida', label: "To'lov jarayonida" },
    { id: 'tolov-yopildi', label: "To'lov yopildi" },
];
const EXTRA_STAGES = [
    { id: 'muvaffaqiyatsiz-sotuv', label: 'Muvaffaqiyatsiz sotuv' },
    { id: 'sifatsiz-lidlar', label: 'Sifatsiz lidlar' },
];
const ALL_STAGE_IDS = new Set([...FUNNEL_STAGES, ...EXTRA_STAGES].map(s => s.id));
const STAGE_LABEL_BY_ID = new Map([...FUNNEL_STAGES, ...EXTRA_STAGES].map(s => [s.id, s.label]));

function normalizeLeadStatus(status) {
    if (!status || status === 'new') return 'yangi-lidlar';
    if (status === 'organic' || status === 'target') return 'yangi-lidlar';
    return ALL_STAGE_IDS.has(status) ? status : 'yangi-lidlar';
}

module.exports = { FUNNEL_STAGES, EXTRA_STAGES, ALL_STAGE_IDS, STAGE_LABEL_BY_ID, normalizeLeadStatus };
