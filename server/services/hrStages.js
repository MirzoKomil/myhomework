// HR Vakansiya voronkasining ustunlari (18-vazifa).
// Sotuv bo'limidagi leadStages.js bilan bir xil tamoyilda: server ham,
// CRM frontendi ham AYNAN shu ro'yxatdan foydalanadi — ikki joyda alohida
// yozilsa, vaqt o'tib bir-biridan farq qilib ketadi.
//
// Sotuv voronkasidan farqi: bu yerda til bo'yicha ajratish YO'Q
// (nomzodlar ingliz/rus kursiga emas, ish o'rniga ariza beradi).
const HR_STAGES = [
    { id: 'kandidatlar', label: 'Kandidatlar', bg: '#EFF6FF', border: '#93C5FD', headerBg: 'rgba(59,130,246,0.14)', title: '#1D4ED8', count: '#2563EB' },
    { id: 'birinchi-filtr', label: "1-filtrdan o'tdi", bg: '#F5F3FF', border: '#C4B5FD', headerBg: 'rgba(124,58,237,0.12)', title: '#5B21B6', count: '#7C3AED' },
    { id: 'javob-bermadi', label: 'Javob bermadi', bg: '#F8FAFC', border: '#CBD5E1', headerBg: 'rgba(100,116,139,0.12)', title: '#475569', count: '#64748B' },
    { id: 'qayta-aloqa', label: 'Qayta aloqa', bg: '#ECFEFF', border: '#67E8F9', headerBg: 'rgba(6,182,212,0.12)', title: '#0E7490', count: '#0891B2' },
    { id: 'suhbat-belgilandi', label: 'Suhbat belgilandi', bg: '#EEF2FF', border: '#A5B4FC', headerBg: 'rgba(79,70,229,0.12)', title: '#3730A3', count: '#4F46E5' },
    { id: 'suhbatga-keldi', label: 'Suhbatga keldi', bg: '#F0FDF4', border: '#86EFAC', headerBg: 'rgba(22,163,74,0.12)', title: '#166534', count: '#16A34A' },
    { id: 'test', label: 'Test', bg: '#FFF7ED', border: '#FDBA74', headerBg: 'rgba(234,88,12,0.12)', title: '#C2410C', count: '#EA580C' },
    { id: 'yakuniy-suhbat', label: 'Yakuniy suhbat', bg: '#ECFDF5', border: '#6EE7B7', headerBg: 'rgba(5,150,105,0.12)', title: '#047857', count: '#059669' },
    { id: 'rad-javobi', label: 'Rad javobi berganlar', bg: '#FEF2F2', border: '#FCA5A5', headerBg: 'rgba(220,38,38,0.12)', title: '#B91C1C', count: '#DC2626' },
    { id: 'filtrdan-otmagan', label: "Filtrdan o'tmaganlar", bg: '#FFFBEB', border: '#FCD34D', headerBg: 'rgba(217,119,6,0.12)', title: '#B45309', count: '#D97706' },
];

const HR_STAGE_IDS = new Set(HR_STAGES.map(s => s.id));
const HR_STAGE_LABEL_BY_ID = new Map(HR_STAGES.map(s => [s.id, s.label]));

// Noma'lum/bo'sh bosqich har doim birinchi ustunga tushadi — nomzod
// hech qachon "yo'qolib" qolmasligi kerak.
function normalizeHrStage(stage) {
    const s = String(stage || '').trim();
    return HR_STAGE_IDS.has(s) ? s : 'kandidatlar';
}

// Bot to'ldiradigan vakansiyalar — TZ dagi tartib AYNAN saqlanadi, chunki
// nomzod ro'yxatni shu ketma-ketlikda ko'radi.
const VACANCIES = [
    { id: 'sotuv-menejeri', label: 'Sotuv menejeri' },
    { id: 'rop', label: "Sotuv bo'limi rahbari (ROP)" },
    { id: 'ingliz-oqituvchi', label: 'Ingliz tili o\'qituvchisi' },
    { id: 'rus-oqituvchi', label: 'Rus tili o\'qituvchisi' },
    { id: 'ingliz-yordamchi', label: 'Ingliz tili yordamchi o\'qituvchisi' },
    { id: 'rus-yordamchi', label: 'Rus tili yordamchi o\'qituvchisi' },
    { id: 'metodist', label: 'Metodist' },
    { id: 'brand-face', label: 'Brand Face (Brend yuzi)' },
];

const VACANCY_BY_ID = new Map(VACANCIES.map(v => [v.id, v]));

module.exports = {
    HR_STAGES, HR_STAGE_IDS, HR_STAGE_LABEL_BY_ID, normalizeHrStage,
    VACANCIES, VACANCY_BY_ID,
};
