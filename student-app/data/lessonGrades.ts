export type GradeCriterionKey = 'attendance' | 'activity' | 'speaking' | 'understanding' | 'discipline';

export const TEACHER_GRADE_CRITERIA: { key: GradeCriterionKey; label: string }[] = [
  { key: 'attendance', label: 'Attendance (Qatnashuv)' },
  { key: 'activity', label: 'Activity (Faollik)' },
  { key: 'speaking', label: 'Speaking (Gapirish)' },
  { key: 'understanding', label: 'Understanding (Tushunish)' },
  { key: 'discipline', label: 'Discipline (Intizom)' },
];

export const TEACHER_GRADE_RUBRIC: Record<GradeCriterionKey, { question: string; levels: string[] }> = {
  attendance: {
    question: "O'quvchining darsda ishtirok etishi va vaqtida qatnashishi baholanadi.",
    levels: [
      "Darsda deyarli qatnashmadi yoki juda kech qo'shildi.",
      "Kechikib keldi va darsning katta qismini o'tkazib yubordi.",
      "Darsda qatnashdi, lekin biroz kechikdi.",
      'Vaqtida qatnashdi va dars davomida mavjud bo\'ldi.',
      'Vaqtida qatnashdi va butun dars davomida faol ishtirok etdi.',
    ],
  },
  activity: {
    question: "O'quvchining dars jarayonidagi faolligi va topshiriqlarda qatnashishi baholanadi.",
    levels: [
      "Faollik ko'rsatmadi.",
      'Kamdan-kam qatnashdi.',
      "Ba'zi vazifalarda ishtirok etdi.",
      "Ko'pchilik faoliyatlarda qatnashdi.",
      "Juda faol bo'ldi, savollarga javob berdi va tashabbus ko'rsatdi.",
    ],
  },
  speaking: {
    question: "O'quvchining ingliz tilida gapirishga bo'lgan harakati va nutq faolligi baholanadi.",
    levels: [
      'Ingliz tilida gapirmadi.',
      'Juda qisqa javoblar berdi.',
      'Oddiy gaplar bilan fikr bildirdi.',
      "Mavzu bo'yicha yaxshi gapira oldi.",
      'Erkin va faol ravishda ingliz tilida muloqot qildi.',
    ],
  },
  understanding: {
    question: 'Yangi mavzu va topshiriqlarni tushunish darajasi baholanadi.',
    levels: [
      'Mavzuni tushunmadi.',
      "Tushunishda jiddiy qiyinchilik bo'ldi.",
      'Asosiy qismini tushundi.',
      "Mavzuni yaxshi tushundi va qo'llay oldi.",
      "Mavzuni to'liq tushundi va mustaqil ishlata oldi.",
    ],
  },
  discipline: {
    question: "Dars qoidalariga rioya qilishi, e'tiborliligi va odobi baholanadi.",
    levels: [
      'Dars jarayoniga xalaqit berdi.',
      'Bir necha marta ogohlantirish oldi.',
      "Umuman olganda tartibli bo'ldi.",
      "Intizomli va e'tiborli bo'ldi.",
      "Namunali xulq-atvor va yuqori mas'uliyat ko'rsatdi.",
    ],
  },
};

export type TeacherRatingKey = 'explanation' | 'punctuality' | 'techQuality' | 'engagement' | 'overall';

export const TEACHER_RATING_CRITERIA: { key: TeacherRatingKey; label: string; question: string; levels: string[] }[] = [
  {
    key: 'explanation',
    label: 'Darsni tushuntirish sifati',
    question: "Ustoz mavzuni qanchalik aniq va tushunarli tushuntirdi?",
    levels: ['Juda tushunarsiz.', 'Qisman tushunarli.', "O'rtacha.", 'Yaxshi.', 'Juda tushunarli va aniq.'],
  },
  {
    key: 'punctuality',
    label: "Darsga o'z vaqtida kirishi",
    question: 'Ustoz darsni belgilangan vaqtda boshladimi?',
    levels: ['Juda kech qoldi.', 'Sezilarli kechikdi.', 'Biroz kechikdi.', 'Deyarli vaqtida kirdi.', "To'liq vaqtida kirdi."],
  },
  {
    key: 'techQuality',
    label: 'Internet va audio/video sifati',
    question: "Dars davomida ustozning interneti va ovozi qanday bo'ldi?",
    levels: [
      "Darsni o'tishga xalaqit berdi.",
      "Ko'p uzilishlar bo'ldi.",
      "Ba'zi uzilishlar bo'ldi.",
      'Yaxshi ishladi.',
      "A'lo darajada ishladi.",
    ],
  },
  {
    key: 'engagement',
    label: "O'quvchilar bilan ishlashi",
    question: 'Ustoz savollarga javob berishi va yordam berishi qanday bo\'ldi?',
    levels: ["E'tibor bermadi.", 'Kam yordam berdi.', "O'rtacha.", 'Yaxshi yordam berdi.', "Juda e'tiborli va yordamchi bo'ldi."],
  },
  {
    key: 'overall',
    label: 'Darsning umumiy sifati',
    question: "Bugungi darsdan qanchalik mamnun bo'ldingiz?",
    levels: [],
  },
];

export type AssistantRatingKey = 'contact' | 'speed' | 'help' | 'motivation' | 'overall';

export const ASSISTANT_RATING_CRITERIA: { key: AssistantRatingKey; label: string; question: string }[] = [
  { key: 'contact', label: 'Aloqaga chiqishi', question: "Yordamchi ustoz ushbu hafta davomida siz bilan muntazam aloqada bo'ldimi?" },
  { key: 'speed', label: 'Tezkorligi', question: 'Siz yozganingizda yoki murojaat qilganingizda qanchalik tez javob berdi?' },
  { key: 'help', label: 'Yordam berishi', question: 'Savollaringiz va muammolaringizni hal qilishda qanchalik yordam berdi?' },
  { key: 'motivation', label: 'Motivatsiya va nazorat', question: "Sizni dars va uy vazifalariga qanchalik rag'batlantirdi?" },
  { key: 'overall', label: 'Umumiy baho', question: "Yordamchi ustozning ushbu haftadagi ishidan qanchalik mamnunsiz?" },
];

function seededLevel(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  const frac = x - Math.floor(x);
  return Math.max(1, Math.min(5, Math.round(3 + (frac - 0.5) * 4)));
}

export function generateTeacherScores(dayNumber: number): Record<GradeCriterionKey, number> {
  return {
    attendance: seededLevel(dayNumber, 1),
    activity: seededLevel(dayNumber, 2),
    speaking: seededLevel(dayNumber, 3),
    understanding: seededLevel(dayNumber, 4),
    discipline: seededLevel(dayNumber, 5),
  };
}

export function generateStudentRatingOfTeacher(seed: number): Record<TeacherRatingKey, number> {
  return {
    explanation: seededLevel(seed, 11),
    punctuality: seededLevel(seed, 12),
    techQuality: seededLevel(seed, 13),
    engagement: seededLevel(seed, 14),
    overall: seededLevel(seed, 15),
  };
}

export function generateAssistantWeeklyRating(seed: number): Record<AssistantRatingKey, number> {
  return {
    contact: seededLevel(seed, 21),
    speed: seededLevel(seed, 22),
    help: seededLevel(seed, 23),
    motivation: seededLevel(seed, 24),
    overall: seededLevel(seed, 25),
  };
}
