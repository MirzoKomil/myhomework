// HR boti anketasi (18-vazifa TZ, 3-bo'lim).
//
// Savollar KOD EMAS, MA'LUMOT sifatida saqlanadi — bot mantig'i (hrBot.js)
// shu ro'yxat bo'ylab yuradi. Savol qo'shish/o'zgartirish uchun faqat shu
// faylga tegiladi, bot mantig'iga umuman tegilmaydi.
//
// Savol turlari:
//   text    — erkin matn
//   contact — Telegram kontaktini ulashish tugmasi (majburiy, matn qabul qilinmaydi)
//   choice  — inline tugmalar (options)
//   photo   — faqat rasm
//   voice   — faqat ovozli xabar (voice)
//   media   — ovozli xabar YOKI video (TZ da "audio/video namuna" deyilgan)
//   video   — video yoki dumaloq video (video_note)

// ── A) Umumiy blok — barcha vakansiyalar uchun majburiy ─────────────────────
const GENERAL_QUESTIONS = [
    {
        key: 'full_name',
        type: 'text',
        text: 'Ism va Familiyangizni kiriting:',
    },
    {
        key: 'telegram_phone',
        type: 'contact',
        text: 'Telefon raqamingizni ulashing.\n\nPastdagi «📱 Raqamni ulashish» tugmasini bosing — '
            + 'raqamni qo\'lda yozish qabul qilinmaydi.',
        buttonText: '📱 Raqamni ulashish',
    },
    {
        key: 'contact_phone',
        type: 'text',
        text: "Qo'ng'iroqlar uchun doimiy ishlatadigan faol telefon raqamingizni kiriting. "
            + "(Agar Telegram raqamingiz bilan bir xil bo'lsa ham, qayta yozib yuboring)\n\n"
            + 'Masalan: +998901234567',
    },
    {
        key: 'address',
        type: 'text',
        text: 'Yashash manzilingiz (shahar/tuman):',
    },
    {
        key: 'birth_year',
        type: 'text',
        text: "Tug'ilgan yilingiz:\n\nMasalan: 2000",
    },
    {
        key: 'has_laptop',
        type: 'choice',
        text: 'Shaxsiy noutbukingiz bormi?',
        options: [
            { id: 'ha', label: 'Ha, bor', value: true },
            { id: 'yoq', label: "Yo'q", value: false },
        ],
    },
    {
        key: 'ready_for_office',
        type: 'choice',
        text: "Ish to'liq ofisda bo'ladi. Ofisga kelib ishlashga tayyormisiz?",
        options: [
            { id: 'ha', label: 'Ha, tayyorman', value: true },
            { id: 'yoq', label: "Yo'q", value: false },
        ],
    },
    {
        key: 'photo',
        type: 'photo',
        text: "O'zingiz yaqqol ko'ringan 1 dona sifatli rasmingizni yuboring.\n\n"
            + "Rasmiy bo'lishi shart emas, oddiy selfi yoki sifatli erkin rasm ham bo'ladi.",
    },
];

// ── B) Vakansiyaga xos savollar ─────────────────────────────────────────────
const VACANCY_QUESTIONS = {
    'sotuv-menejeri': [
        {
            key: 'sales_experience', type: 'choice',
            text: 'Sotuv sohasida (ayniqsa, telefon orqali yoki ta\'lim kurslarini sotishda) tajribangiz bormi?',
            options: [
                { id: 'bor', label: 'Ha, tajribam bor' },
                { id: 'yoq', label: "Yo'q, lekin tez o'rganaman" },
            ],
        },
        {
            key: 'online_sales_ability', type: 'choice',
            text: 'Telefon orqali onlayn kurslar/mahsulotlar sota olasizmi?',
            options: [
                { id: 'ha', label: 'Ha, bemalol' },
                { id: 'yoq', label: "Bunday tajribam yo'q" },
            ],
        },
        {
            key: 'work_hours', type: 'choice',
            text: "Ofisda to'liq stavkada ishlashga tayyormisiz?",
            options: [
                { id: 'toliq', label: "Ha, to'liq kunga" },
                { id: 'yarim', label: 'Faqat yarim kun (talaba)' },
            ],
        },
        {
            key: 'voice', type: 'voice',
            text: "Iltimos, 45-60 soniyalik ovozli xabar (Voice) yuboring:\n\n"
                + "O'zingiz haqingizda va nima uchun aynan sizni sotuv jamoamizga "
                + 'olishimiz kerakligi haqida erkin gapirib bering.',
        },
    ],

    'rop': [
        {
            key: 'sales_total_experience', type: 'choice',
            text: 'Sotuv sohasidagi umumiy tajribangiz qancha?',
            options: [
                { id: 'kam', label: '1 yildan kam' },
                { id: '1-3', label: '1-3 yil' },
                { id: 'kop', label: "3 yildan ko'p" },
            ],
        },
        {
            key: 'management_experience', type: 'text',
            text: 'Boshqaruv (rahbarlik) tajribangiz bormi va eng ko\'pi bilan necha kishilik '
                + 'jamoani boshqargansiz?',
        },
        {
            key: 'crm_systems', type: 'choice',
            text: 'Qaysi CRM tizimlarida ishlagansiz?',
            options: [
                { id: 'amo', label: 'amoCRM' },
                { id: 'bitrix', label: 'Bitrix24' },
                { id: 'boshqa', label: 'Boshqa CRM' },
            ],
        },
        {
            key: 'max_monthly_turnover', type: 'text',
            text: 'Avvalgi ish joyingizda jamoangiz bilan erishgan eng yuqori oylik sotuv '
                + 'aylanmasi qancha bo\'lgan?',
        },
        {
            key: 'fulltime_office', type: 'choice',
            text: "To'liq ish kunida (Full-time) ofisda ishlashga tayyormisiz?",
            options: [
                { id: 'ha', label: 'Ha' },
                { id: 'yoq', label: "Yo'q" },
            ],
        },
    ],

    'ingliz-oqituvchi': [
        {
            key: 'english_level', type: 'choice',
            text: 'Ingliz tili darajangiz va sertifikatingiz?',
            options: [
                { id: 'ielts', label: 'IELTS 7.0+' },
                { id: 'cefr-c1', label: 'CEFR C1' },
                { id: 'filolog', label: 'Filologiya diplomi' },
                { id: 'yoq', label: "Sertifikat yo'q" },
            ],
        },
        {
            key: 'online_teaching_experience', type: 'choice',
            text: "Onlayn formatda dars o'tish tajribangiz qancha?",
            options: [
                { id: 'kam', label: '1 yildan kam' },
                { id: '1-3', label: '1-3 yil' },
                { id: 'kop', label: "3 yildan ko'p" },
                { id: 'yoq', label: "Tajribam yo'q" },
            ],
        },
        {
            key: 'weekly_hours', type: 'text',
            text: 'Haftasiga necha soat dars bera olasiz?',
        },
        {
            key: 'media', type: 'media',
            text: 'Ingliz tilida 1 daqiqalik qisqa ovozli xabar (Voice) yoki video yuboring:\n\n'
                + "O'zingiz va dars berish uslubingiz haqida gapirib bering.",
        },
    ],

    'rus-oqituvchi': [
        {
            key: 'russian_level', type: 'choice',
            text: 'Rus tili darajangiz?',
            options: [
                { id: 'native', label: 'Native (ona tili)' },
                { id: 'c1', label: 'C1 / Erkin' },
                { id: 'filolog', label: 'Filolog' },
            ],
        },
        {
            key: 'uzbek_audience_experience', type: 'choice',
            text: "O'zbekzabon auditoriyaga rus tilida so'zlashuvni noldan o'rgatish tajribangiz bormi?",
            options: [
                { id: 'ha', label: 'Ha, bor' },
                { id: 'yoq', label: "Yo'q" },
            ],
        },
        {
            key: 'online_teaching_experience', type: 'text',
            text: 'Onlayn formatda dars berish tajribangiz qancha?',
        },
        {
            key: 'weekly_hours', type: 'text',
            text: 'Haftalik dars bera oladigan soatlaringiz hajmi?',
        },
        {
            key: 'voice', type: 'voice',
            text: "Rus tilida 1 daqiqalik ovozli xabar (Voice) yuboring "
                + "(o'zingiz haqingizda qisqa tanishtiruv).",
        },
    ],

    'ingliz-yordamchi': null,   // pastda ASSISTANT_QUESTIONS bilan to'ldiriladi
    'rus-yordamchi': null,

    'metodist': [
        {
            key: 'methodist_experience', type: 'text',
            text: "Ta'lim sohasida metodistlik ish tajribangiz qancha?",
        },
        {
            key: 'content_creation', type: 'choice',
            text: 'Onlayn kurslar uchun darslik, ishchi daftar yoki kontent yaratganmisiz?',
            options: [
                { id: 'ha', label: 'Ha' },
                { id: 'yoq', label: "Yo'q" },
            ],
        },
        {
            key: 'samples_link', type: 'text',
            text: 'Dastur va sillabuslaringizdan namunalar havolasi '
                + '(Google Drive yoki Telegram havola):',
        },
    ],

    'brand-face': [
        {
            key: 'camera_experience', type: 'choice',
            text: 'Kamera qarshisida gapirish (Reels, Stories, YouTube) tajribangiz bormi?',
            options: [
                { id: 'bor', label: 'Ha, bor' },
                { id: 'yoq', label: "Yo'q, lekin xohlayman" },
            ],
        },
        {
            key: 'social_link', type: 'text',
            text: 'Shaxsiy Instagram yoki TikTok profilingiz havolasi:',
        },
        {
            key: 'languages', type: 'choice',
            text: 'Qaysi tillarda erkin gapira olasiz?',
            options: [
                { id: 'rus', label: 'Rus tili' },
                { id: 'ingliz', label: 'Ingliz tili' },
                { id: 'ikkala', label: 'Ikkala til ham' },
                { id: 'ozbek', label: "Faqat o'zbek tili" },
            ],
        },
        {
            key: 'video', type: 'video',
            text: "Kamera qarshisida o'zingizni tanishtirgan holda 30-60 soniyalik video "
                + 'yuboring (oddiy video yoki Telegram dumaloq video/krujok).',
        },
    ],
};

// Ikkala yordamchi o'qituvchi vakansiyasi uchun savollar bir xil (TZ, 5-band) —
// bitta ta'rif ikkalasiga ham beriladi, ikki joyda takrorlanmasin.
const ASSISTANT_QUESTIONS = [
    {
        key: 'assistant_language', type: 'choice',
        text: "Qaysi til bo'yicha yordamchi o'qituvchi bo'lmoqchisiz?",
        options: [
            { id: 'ingliz', label: 'Ingliz tili' },
            { id: 'rus', label: 'Rus tili' },
        ],
    },
    {
        key: 'language_level', type: 'text',
        text: 'Til bilish darajangiz qanday? (sertifikat yoki daraja)',
    },
    {
        key: 'current_status', type: 'text',
        text: 'Hozirda talabamisiz yoki boshqa joyda ishlaysizmi?',
    },
    {
        key: 'daily_hours', type: 'text',
        text: 'Kuniga necha soat vaqt ajrata olasiz? '
            + "(vazifalarni tekshirish va o'quvchilar savollariga javob berish uchun)",
    },
];

VACANCY_QUESTIONS['ingliz-yordamchi'] = ASSISTANT_QUESTIONS;
VACANCY_QUESTIONS['rus-yordamchi'] = ASSISTANT_QUESTIONS;

// Vakansiya uchun to'liq savollar ketma-ketligi: avval umumiy blok, keyin
// vakansiyaga xos savollar.
function questionsForVacancy(vacancyId) {
    return [...GENERAL_QUESTIONS, ...(VACANCY_QUESTIONS[vacancyId] || [])];
}

module.exports = { GENERAL_QUESTIONS, VACANCY_QUESTIONS, questionsForVacancy };
