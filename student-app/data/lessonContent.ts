import { Ionicons } from '@expo/vector-icons';

import { BOOK_STORIES } from '@/data/bookStories';
import { AdminLessonContent, fetchMobileContent } from '@/services/contentApi';
import { getListenedBookIds } from '@/services/bookProgressStore';
import { getCategoryProgress, getLessonProgress, loadLessonProgress, ProgressCategory } from '@/services/lessonProgressStore';

export type LessonDayType = 'grammar' | 'speaking' | 'bonus';

export type VocabWord = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  english: string;
  translation: string;
  transcript: string;
  // 58-vazifa: admin CRM'dan kiritiladigan, ixtiyoriy — bo'lmasa `icon`ga
  // qaytiladi (fallback).
  imageUrl?: string;
  exampleSentence?: string;
};

export type GrammarBlank = {
  id: string;
  sentence: string;
  answer: string;
  options: string[];
};

export type MatchPair = { id: string; left: string; right: string };

export type MultipleChoiceQ = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
};

export type SentenceBuildQ = {
  id: string;
  translation: string;
  words: string[];
  answer: string[];
};

export type SpeakingPrompt = {
  id: string;
  sentence: string;
  translation: string;
};

export type RoleplayScenario = {
  id: string;
  title: string;
  intro: string;
  lines: string[];
  closing: string;
};

export type ReadingSentence = { id: string; russianText: string };

export type HomeworkPart =
  | { id: string; kind: 'matching'; title: string; pairs: MatchPair[] }
  | { id: string; kind: 'fillBlank'; title: string; blanks: GrammarBlank[] }
  | { id: string; kind: 'multipleChoice'; title: string; questions: MultipleChoiceQ[] }
  | { id: string; kind: 'sentenceBuild'; title: string; items: SentenceBuildQ[] }
  | { id: string; kind: 'record'; title: string; prompts: SpeakingPrompt[] }
  | { id: string; kind: 'roleplay'; title: string; scenario: RoleplayScenario }
  | { id: string; kind: 'pronunciation'; title: string; prompts: SpeakingPrompt[] }
  | { id: string; kind: 'creative'; title: string; instruction: string; mediaType: 'text' | 'audio' }
  // 54-vazifa: "O'qib tarjima qilish mashqi" — bitta ruscha matn (paragraf)
  // va bir nechta alohida ruscha gap, o'quvchi har birini o'zbekchaga
  // tarjima qiladi, natija ustozga tekshirish uchun boradi.
  | { id: string; kind: 'reading'; title: string; paragraph: { id: string; russianText: string }; sentences: ReadingSentence[] };

export type SlideContent = { id: string; title: string; body: string; imageUrl?: string };

export type LessonContent = {
  lessonId: string;
  dayType: LessonDayType;
  unitTitle: string;
  konspekt: string;
  // 33-vazifa: so'z/ibora ovoz bilan o'qib berilganda to'g'ri talaffuz
  // (aksent) tanlash uchun — darsning qaysi til kursiga tegishli ekani.
  lang: 'english' | 'russian';
  slides: SlideContent[];
  vocabulary: VocabWord[];
  grammarBlanks: GrammarBlank[];
  speakingPractice: SpeakingPrompt[];
  homeworkParts: HomeworkPart[];
};

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function pickWindow<T>(pool: T[], offset: number, count: number): T[] {
  return Array.from({ length: Math.min(count, pool.length) }, (_, i) => pool[(offset + i) % pool.length]);
}


// ─── Rus tili kursi, 1-dars uchun lug'at ────────────────────────────────────
// 53-vazifa: 52-vazifada olib tashlangan edi, lekin admin bu darsning
// haqiqiy, foydalanilayotgan kontenti ekanini tasdiqladi — shu sabab
// FAQAT shu 1-dars uchun qaytarildi (boshqa darslar hamon bo'sh,
// faqat CRM orqali kiritilgan kontentni ko'rsatadi).
const RU_LESSON1_VOCAB: VocabWord[] = [
  { id: 'ru1-1', icon: 'hand-right-outline', english: 'Здравствуйте!', translation: 'Assalomu alaykum! (rasmiy salomlashish)', transcript: '' },
  { id: 'ru1-2', icon: 'chatbubble-outline', english: 'Привет!', translation: "Salom! (do'stona salomlashish)", transcript: '' },
  { id: 'ru1-3', icon: 'sunny-outline', english: 'Добрый день!', translation: 'Xayrli kun!', transcript: '' },
  { id: 'ru1-4', icon: 'help-circle-outline', english: 'Как вас зовут?', translation: 'Ismingiz nima? (rasmiy)', transcript: '' },
  { id: 'ru1-5', icon: 'help-circle-outline', english: 'Как тебя зовут?', translation: "Isming nima? (do'stona)", transcript: '' },
  { id: 'ru1-6', icon: 'person-outline', english: 'Меня зовут...', translation: 'Mening ismim...', transcript: '' },
  { id: 'ru1-7', icon: 'happy-outline', english: 'Очень приятно!', translation: 'Juda mamnunman! (tanishganda)', transcript: '' },
  { id: 'ru1-8', icon: 'calendar-outline', english: 'Сколько вам лет?', translation: 'Yoshingiz nechida? (rasmiy)', transcript: '' },
  { id: 'ru1-9', icon: 'calendar-outline', english: 'Сколько тебе лет?', translation: "Yoshing nechida? (do'stona)", transcript: '' },
  { id: 'ru1-10', icon: 'person-circle-outline', english: 'Мне ... лет / год / года', translation: 'Men ... yoshdaman.', transcript: '' },
  { id: 'ru1-11', icon: 'time-outline', english: 'Год', translation: 'Yil / Yosh (1, 21, 31 yosh uchun)', transcript: '' },
  { id: 'ru1-12', icon: 'time-outline', english: 'Года', translation: 'Yil / Yosh (2-4, 22-24, 32-34 yosh uchun)', transcript: '' },
  { id: 'ru1-13', icon: 'time-outline', english: 'Лет', translation: 'Yil / Yosh (5-20, 25-30 yosh va hokazo)', transcript: '' },
  { id: 'ru1-14', icon: 'exit-outline', english: 'До свидания!', translation: "Xayr! / Ko'rishguncha (rasmiy)", transcript: '' },
  { id: 'ru1-15', icon: 'hand-left-outline', english: 'Пока!', translation: "Xayr! (do'stona)", transcript: '' },
  { id: 'ru1-16', icon: 'today-outline', english: 'Сегодня', translation: 'Bugun', transcript: '[sivodnya]' },
  { id: 'ru1-17', icon: 'person-outline', english: 'Его', translation: 'Uni / Uniki', transcript: '[evo]' },
  { id: 'ru1-18', icon: 'home-outline', english: 'Дом', translation: 'Uy', transcript: '' },
  { id: 'ru1-19', icon: 'cafe-outline', english: 'Молоко', translation: 'Süt', transcript: '[malako]' },
  { id: 'ru1-20', icon: 'school-outline', english: 'Школа', translation: 'Maktab', transcript: '' },
  { id: 'ru1-21', icon: 'add-circle-outline', english: 'Ещё', translation: 'Yana / Hali', transcript: '[yeshchyo]' },
  { id: 'ru1-22', icon: 'close-circle-outline', english: 'Нет', translation: "Yo'q", transcript: '' },
];

// ─── Grammar fill-in-gap pool ───────────────────────────────────────────────
export const GRAMMAR_POOL: GrammarBlank[] = [
  { id: 'g1', sentence: 'She ___ to school every day.', answer: 'goes', options: ['go', 'goes', 'going', 'gone'] },
  { id: 'g2', sentence: 'They ___ football on Sundays.', answer: 'play', options: ['play', 'plays', 'playing', 'played'] },
  { id: 'g3', sentence: 'He ___ watching TV right now.', answer: 'is', options: ['is', 'are', 'am', 'be'] },
  { id: 'g4', sentence: 'I ___ my homework yesterday.', answer: 'did', options: ['do', 'does', 'did', 'done'] },
  { id: 'g5', sentence: 'We ___ never been to Paris.', answer: 'have', options: ['have', 'has', 'had', 'having'] },
  { id: 'g6', sentence: 'My sister ___ coffee in the morning.', answer: 'drinks', options: ['drink', 'drinks', 'drinking', 'drank'] },
  { id: 'g7', sentence: 'Look! It ___ raining outside.', answer: 'is', options: ['is', 'was', 'are', 'be'] },
  { id: 'g8', sentence: 'She ___ a new car last month.', answer: 'bought', options: ['buy', 'buys', 'bought', 'buying'] },
  { id: 'g9', sentence: 'Can you ___ me with this bag?', answer: 'help', options: ['help', 'helps', 'helping', 'helped'] },
  { id: 'g10', sentence: 'They ___ studying for the exam right now.', answer: 'are', options: ['is', 'am', 'are', 'be'] },
  { id: 'g11', sentence: 'We ___ dinner at 7 pm usually.', answer: 'have', options: ['have', 'has', 'having', 'had'] },
  { id: 'g12', sentence: 'He ___ to the gym twice a week.', answer: 'goes', options: ['go', 'goes', 'going', 'went'] },
];

// ─── Rus tili kursi, 1-dars uchun Video Quiz ────────────────────────────────
const RU_LESSON1_GRAMMAR: GrammarBlank[] = [
  {
    id: 'ru1-q1',
    sentence: '"О" harfiga urg\'u tushganda va tushmaganda qanday o\'qiladi?',
    answer: "Urg'u tushsa [O], urg'usiz bo'lsa [A]",
    options: ['Har doim [O] deb', "Urg'u tushsa [O], urg'usiz bo'lsa [A]", 'Har doim [A] deb'],
  },
  {
    id: 'ru1-q2',
    sentence: '"Сегодня" so\'zidagi "го" birikmasi qanday talaffuz qilinadi?',
    answer: '[сиводня]',
    options: ['[сегодня]', '[сиводня]', '[сеходня]'],
  },
  {
    id: 'ru1-q3',
    sentence: "Yoshingizni aytayotganda 1 yosh uchun qaysi so'z ishlatiladi? (masalan: Мне 21 ...)",
    answer: 'Год',
    options: ['Год', 'Года', 'Лет'],
  },
];

// ─── Rus tili kursi, 1-dars uchun Uyga vazifa ───────────────────────────────
// 54-vazifa: uyga vazifada endi faqat 3 turdagi mashq qoladi — (1) Grammatika
// mashqi (bu yerda emas, video kunlar uchun content.grammarBlanks'dan
// avtomatik olinadi — homework/index.tsx'dagi virtual qatorga qarang),
// (2) pastdagi 'matching' qismi ("Talaffuz mashqi" nomi bilan) va
// (3) yangi 'reading' qismi ("O'qib tarjima qilish mashqi"). Avvalgi
// A/B/C/creative qismlari olib tashlandi.
const RU_LESSON1_HOMEWORK: HomeworkPart[] = [
  {
    id: 'D',
    kind: 'matching',
    title: 'Talaffuz mashqi',
    pairs: [
      { id: 'ru1h-d1', left: 'Как тебя зовут?', right: 'Isming nima?' },
      { id: 'ru1h-d2', left: 'Добрый день!', right: 'Xayrli kun!' },
      { id: 'ru1h-d3', left: 'Очень приятно!', right: 'Juda mamnunman!' },
      { id: 'ru1h-d4', left: 'Сегодня', right: 'Bugun' },
    ],
  },
  {
    id: 'reading',
    kind: 'reading',
    title: "O'qib tarjima qilish mashqi",
    paragraph: {
      id: 'ru1h-r-p1',
      russianText: 'Здравствуйте! Меня зовут Алишер. Мне двадцать три года. Я учусь в школе. Очень приятно познакомиться с вами!',
    },
    sentences: [
      { id: 'ru1h-r-s1', russianText: 'Добрый день!' },
      { id: 'ru1h-r-s2', russianText: 'Как тебя зовут?' },
      { id: 'ru1h-r-s3', russianText: 'Сколько тебе лет?' },
      { id: 'ru1h-r-s4', russianText: 'До свидания!' },
    ],
  },
];

// ─── Multiple choice pool ───────────────────────────────────────────────────
export const MC_POOL: MultipleChoiceQ[] = [
  { id: 'mc1', question: "'Kutubxona' so'zining inglizchasi qaysi?", options: ['Library', 'Market', 'Kitchen', 'Journey'], correctIndex: 0 },
  { id: 'mc2', question: "Qaysi so'z 'tez' degan ma'noni bildiradi?", options: ['Slow', 'Quick', 'Heavy', 'Light'], correctIndex: 1 },
  { id: 'mc3', question: "'She ___ a teacher.' bo'sh joyga mos keladigan so'z?", options: ['am', 'is', 'are', 'be'], correctIndex: 1 },
  { id: 'mc4', question: "'Ob-havo' so'zining inglizchasi qaysi?", options: ['Weather', 'Nature', 'Storm', 'Cloud'], correctIndex: 0 },
  { id: 'mc5', question: "Qaysi gap to'g'ri?", options: ['He go to school.', 'He goes to school.', 'He going to school.', 'He gone to school.'], correctIndex: 1 },
  { id: 'mc6', question: "'Muhim' so'zining inglizchasi qaysi?", options: ['Important', 'Improve', 'Idea', 'Income'], correctIndex: 0 },
  { id: 'mc7', question: "'They ___ football.' bo'sh joyga mos keladigan so'z?", options: ['plays', 'play', 'playing', 'played'], correctIndex: 1 },
  { id: 'mc8', question: "'Sog'liq' so'zining inglizchasi qaysi?", options: ['Health', 'Heart', 'Habit', 'Heavy'], correctIndex: 0 },
  { id: 'mc9', question: "Qaysi so'z 'kuchli' degan ma'noni bildiradi?", options: ['Weak', 'Strong', 'Soft', 'Slow'], correctIndex: 1 },
  { id: 'mc10', question: "'We ___ dinner at 7.' bo'sh joyga mos keladigan so'z?", options: ['has', 'have', 'having', 'had'], correctIndex: 1 },
];

// ─── Sentence building pool ─────────────────────────────────────────────────
export const SENTENCE_POOL: SentenceBuildQ[] = [
  { id: 's1', translation: 'U har kuni maktabga boradi.', words: ['school', 'to', 'goes', 'she', 'every', 'day'], answer: ['she', 'goes', 'to', 'school', 'every', 'day'] },
  { id: 's2', translation: 'Ular yakshanba kunlari futbol o\'ynashadi.', words: ['football', 'play', 'they', 'Sundays', 'on'], answer: ['they', 'play', 'football', 'on', 'Sundays'] },
  { id: 's3', translation: 'Men kecha uy vazifamni bajardim.', words: ['homework', 'did', 'my', 'yesterday', 'I'], answer: ['I', 'did', 'my', 'homework', 'yesterday'] },
  { id: 's4', translation: 'U hozir televizor ko\'rmoqda.', words: ['watching', 'is', 'TV', 'he', 'now'], answer: ['he', 'is', 'watching', 'TV', 'now'] },
  { id: 's5', translation: 'Bu juda muhim savol.', words: ['question', 'is', 'this', 'important', 'very'], answer: ['this', 'is', 'very', 'important', 'question'] },
  { id: 's6', translation: 'Biz kutubxonaga bormoqchimiz.', words: ['library', 'go', 'to', 'want', 'the', 'we', 'to'], answer: ['we', 'want', 'to', 'go', 'to', 'the', 'library'] },
  { id: 's7', translation: 'Onam ertalab qahva ichadi.', words: ['coffee', 'morning', 'drinks', 'my', 'mother', 'in', 'the'], answer: ['my', 'mother', 'drinks', 'coffee', 'in', 'the', 'morning'] },
  { id: 's8', translation: 'Bu hikoya juda qiziqarli.', words: ['interesting', 'very', 'story', 'this', 'is'], answer: ['this', 'story', 'is', 'very', 'interesting'] },
];

// ─── Speaking prompts pool ──────────────────────────────────────────────────
export const SPEAKING_POOL: SpeakingPrompt[] = [
  { id: 'sp1', sentence: 'Could you tell me more about yourself?', translation: 'O\'zingiz haqingizda ko\'proq gapirib bera olasizmi?' },
  { id: 'sp2', sentence: 'What do you usually do on weekends?', translation: 'Odatda dam olish kunlari nima qilasiz?' },
  { id: 'sp3', sentence: 'I would like to practice my pronunciation.', translation: 'Men talaffuzimni mashq qilmoqchiman.' },
  { id: 'sp4', sentence: 'How was your day today?', translation: 'Bugungi kuningiz qanday o\'tdi?' },
  { id: 'sp5', sentence: 'This lesson is very useful for me.', translation: 'Bu dars men uchun juda foydali.' },
  { id: 'sp6', sentence: 'Can you help me with this exercise?', translation: 'Ushbu mashqda menga yordam bera olasizmi?' },
  { id: 'sp7', sentence: 'I enjoy learning new languages.', translation: 'Men yangi tillarni o\'rganishni yoqtiraman.' },
  { id: 'sp8', sentence: 'Let\'s talk about our future plans.', translation: 'Kelajakdagi rejalarimiz haqida gaplashaylik.' },
];

// ─── Bonus (Yakshanba) darslar — 6 kategoriya, 3 marta takrorlanadi = 18 dars ──
export type BonusCategory = { key: string; label: string; emoji: string; color: string; bg: string; konspekt: string };

export const BONUS_CATEGORIES: BonusCategory[] = [
  { key: 'movie', label: 'Kino tahlil', emoji: '🎬', color: '#DC2626', bg: '#FEE2E2', konspekt: "Ushbu darsda qisqa video parcha ingliz tilida tahlil qilinadi — muhim iboralar va so'zlashuv uslubi o'rganiladi." },
  { key: 'music', label: 'Musiqiy dars', emoji: '🎵', color: '#7C3AED', bg: '#EDE9FE', konspekt: "Ashula matni orqali yangi so'zlar va to'g'ri talaffuz mashq qilinadi." },
  { key: 'motivation', label: 'Motivatsion dars', emoji: '🌟', color: '#D97706', bg: '#FEF3C7', konspekt: "Shaxsiy rivojlanish va motivatsiya mavzusida ingliz tilida qisqa video ko'rib chiqiladi." },
  { key: 'quiz', label: "Intellektual o'yin", emoji: '🧠', color: '#2563EB', bg: '#DBEAFE', konspekt: "Quiz Night — bilimlaringizni ingliz tilida sinab ko'ring." },
  { key: 'slang', label: "Ko'cha ingliz tili", emoji: '🗣️', color: '#059669', bg: '#D1FAE5', konspekt: "Kundalik hayotda ishlatiladigan so'zlashuv iboralari va slenglar o'rganiladi." },
  { key: 'roleplay', label: 'Hayotiy vaziyat', emoji: '🎭', color: '#DB2777', bg: '#FCE7F3', konspekt: "Hayotiy vaziyatlar simulyatsiyasi orqali amaliy ingliz tili mashq qilinadi." },
];

export function getBonusLessonContent(bonusIndex: number): LessonContent {
  const category = BONUS_CATEGORIES[bonusIndex % BONUS_CATEGORIES.length];
  return {
    lessonId: `bonus-${bonusIndex + 1}`,
    dayType: 'bonus',
    unitTitle: `${category.emoji} ${category.label}`,
    konspekt: category.konspekt,
    lang: 'english',
    slides: [],
    vocabulary: [],
    grammarBlanks: [],
    speakingPractice: [],
    homeworkParts: [],
  };
}

// ─── Main entry point ───────────────────────────────────────────────────────
// 52-vazifa: ilgari bu yerda "namuna" (proseduraviy generatsiya qilingan)
// kontent avtomatik ko'rsatilardi — ingliz tili uchun VOCAB_POOL/GRAMMAR_POOL
// kabi havzalardan, rus tili uchun esa manba kodiga qattiq yozilgan
// RU_LESSON1_*/RU_LESSON2_* konstantalardan. Bu ikkalasi ham HAQIQIY,
// platforma (CRM) orqali admin/o'qituvchi kiritgan kontent EMAS edi — shu
// sabab ko'p darslar "to'liq" ko'rinsa ham, aslida hech kim tomonidan
// yozilmagan namuna matn edi. Endi bazaviy kontent har doim BO'SH: FAQAT
// mergeLessonContent orqali admin CRM'da (mc.lessonContents) haqiqatan
// kiritgan kontent ko'rsatiladi. konspekt/unitTitle — o'zbekcha, til-neytral
// umumiy yo'riqnoma matni (har bir dars uchun alohida yozilishi shart
// bo'lmagan interfeys matni), shu sabab bular qoldirildi.
export function getLessonContent(
  lessonId: string,
  dayIndex: number,
  lang: 'english' | 'russian' = 'english'
): LessonContent {
  if (lessonId.startsWith('bonus-')) {
    const bonusIndex = Math.max(0, parseInt(lessonId.replace('bonus-', ''), 10) - 1);
    return getBonusLessonContent(bonusIndex);
  }

  const dayType: LessonDayType = dayIndex % 2 === 0 ? 'grammar' : 'speaking';
  // 53-vazifa: faqat Rus tili kursining 1-darsi uchun (dayIndex === 0)
  // avvaldan tayyorlangan kontent qaytariladi — boshqa barcha darslar
  // (ikkala tilda ham) hamon bo'sh, faqat CRM orqali kiritilgan kontentni
  // ko'rsatadi.
  const isRussianLesson1 = lang === 'russian' && dayIndex === 0;

  return {
    lessonId,
    dayType,
    unitTitle: dayType === 'grammar' ? 'Grammar & Video dars' : 'Speaking & Live dars',
    konspekt:
      dayType === 'grammar'
        ? "Ushbu darsda asosiy grammatik qoida video orqali tushuntiriladi. Video tagida qisqacha konspekt joylashgan — asosiy formula va misollarni shu yerdan takrorlashingiz mumkin."
        : "Ushbu live darsda o'qituvchi tomonidan tayyorlangan slaydlar asosida suhbat ko'nikmalari mashq qilinadi.",
    lang,
    slides: [],
    vocabulary: isRussianLesson1 ? RU_LESSON1_VOCAB : [],
    grammarBlanks: isRussianLesson1 ? RU_LESSON1_GRAMMAR : [],
    speakingPractice: [],
    // 61-vazifa: o'quvchi tomonida bo'sh (hali admin to'ldirmagan) qism
    // ko'rsatmaslik kerak — 60-vazifadagi standart bo'sh-qism-shakli faqat
    // CRM'ning tahrirlash formasini oldindan to'ldirish uchun (admin qaysi
    // qismlarni kiritishi kerakligini bilishi uchun), studentga esa faqat
    // admin haqiqatan saqlagan kontent (mergeLessonContent orqali) ko'rinadi.
    homeworkParts: isRussianLesson1 ? RU_LESSON1_HOMEWORK : [],
  };
}

// CRM'da admin kiritgan real kontentni proseduraviy generatsiya qilingan
// standart kontent ustiga qo'yadi — admin faqat to'ldirgan maydonlar
// almashtiriladi, qolganlari o'zgarmaydi.
export function mergeLessonContent(base: LessonContent, admin?: AdminLessonContent): LessonContent {
  if (!admin) return base;
  return {
    ...base,
    konspekt: admin.konspekt && admin.konspekt.trim() ? admin.konspekt : base.konspekt,
    vocabulary: admin.vocabulary && admin.vocabulary.length ? admin.vocabulary : base.vocabulary,
    grammarBlanks: admin.grammarBlanks && admin.grammarBlanks.length ? admin.grammarBlanks : base.grammarBlanks,
    slides: admin.slides && admin.slides.length ? admin.slides : base.slides,
    speakingPractice: admin.speakingPractice && admin.speakingPractice.length ? admin.speakingPractice : base.speakingPractice,
    homeworkParts: admin.homeworkParts && admin.homeworkParts.length ? admin.homeworkParts : base.homeworkParts,
  };
}

export async function getResolvedLessonContent(lessonId: string, dayIndex: number): Promise<LessonContent> {
  const mc = await fetchMobileContent();
  const lesson = mc.lessons.find((l) => l.id === lessonId);
  const course = lesson ? mc.courses.find((c) => c.id === lesson.courseId) : undefined;
  const lang: 'english' | 'russian' = course?.lang === 'russian' ? 'russian' : 'english';
  const base = getLessonContent(lessonId, dayIndex, lang);
  return mergeLessonContent(base, mc.lessonContents[lessonId]);
}

export const COURSE_TOTAL_LESSONS = 72;
// 8-vazifa/32-vazifa: Bosh sahifa/Darslar yo'li'dagi bilan bir xil qoida -
// birinchi dars har doim ochiq, keyingi VIDEO dars oldingi (speaking)
// darsning bajarilishi kamida shu foizga yetganda, keyingi SPEAKING dars
// esa ustoz davomat OLGAN va oldingi videodars kamida shu foizga yetganda
// ochiladi (roadmap/[courseId].tsx'dagi recomputeLessons bilan bir xil
// mantiq). 51-vazifa: ikkala chegara ham 50% ga tushirildi — davomat sharti
// Razgovor (speaking) darslar uchun o'zgarishsiz qoladi.
const COURSE_DEFAULT_UNLOCK_PERCENT = 50;
const COURSE_LIVE_LESSON_UNLOCK_PERCENT = 50;

// 38-vazifa: Bosh sahifadagi "Umumiy progress" kartochkasi ilgari doim
// qattiq yozilgan namuna qiymatni (31%, 22/72 dars) ko'rsatardi. Endi
// "Darslar yo'li" ekranidagi bilan AYNAN bir xil qulflash mantig'i bo'yicha
// haqiqiy ochilgan darslar sonini hisoblaydi.
export async function getCourseOverallProgress(): Promise<{
  done: number;
  total: number;
  percent: number;
  homeworkCompleted: number;
  courseId: string | null;
}> {
  const empty = { done: 0, total: COURSE_TOTAL_LESSONS, percent: 0, homeworkCompleted: 0, courseId: null };
  const mc = await fetchMobileContent();
  const course = mc.courses[0];
  if (!course) return empty;

  await loadLessonProgress();
  const adminLessons = mc.lessons.filter((l) => l.courseId === course.id);
  const resolvedCourseLang: 'english' | 'russian' = course.lang === 'russian' ? 'russian' : 'english';

  let prevPercent = 100;
  let unlockedCount = 0;
  // 59-vazifa: "Natijalarim" ekranidagi "Bajarilgan uyga vazifalar" endi
  // haqiqiy — shu darsning "homework" kategoriyasi 100% bo'lgan (va
  // kamida bitta uyga vazifa qismi bo'lgan) darslar soni.
  let homeworkCompleted = 0;
  for (let i = 0; i < COURSE_TOTAL_LESSONS; i++) {
    const l = adminLessons[i];
    const id = l?.id ?? String(i + 1);
    const isVideoDay = i % 2 === 0;

    let locked: boolean;
    if (isVideoDay) {
      const requiredPercent = l?.lock?.enabled ? (l.lock.requiredPercent ?? COURSE_DEFAULT_UNLOCK_PERCENT) : COURSE_DEFAULT_UNLOCK_PERCENT;
      locked = i >= 1 && prevPercent < requiredPercent;
    } else {
      const requiredPercent = l?.lock?.enabled ? (l.lock.requiredPercent ?? COURSE_LIVE_LESSON_UNLOCK_PERCENT) : COURSE_LIVE_LESSON_UNLOCK_PERCENT;
      locked = i >= 1 && (!l?.attendanceTaken || prevPercent < requiredPercent);
    }
    if (!locked) unlockedCount++;

    const videoCategory: ProgressCategory = isVideoDay ? 'video' : 'speaking';
    const content = mergeLessonContent(getLessonContent(id, i, resolvedCourseLang), mc.lessonContents[id]);
    const homeworkPercent = getCategoryProgress(id, 'homework', content.homeworkParts.length);
    if (content.homeworkParts.length > 0 && homeworkPercent >= 100) homeworkCompleted++;
    const percent = Math.round(
      (getCategoryProgress(id, videoCategory) + getCategoryProgress(id, 'vocabulary') + homeworkPercent) / 3
    );
    prevPercent = percent;
  }

  return {
    done: unlockedCount,
    total: COURSE_TOTAL_LESSONS,
    percent: Math.round((unlockedCount / COURSE_TOTAL_LESSONS) * 100),
    homeworkCompleted,
    courseId: course.id,
  };
}

export type SkillsProgress = {
  vocabulary: number;
  speaking: number;
  listening: number;
  grammar: number;
  writing: number;
};

// 1-vazifa: Bosh sahifadagi "Ko'nikmalar progressi" paneli ilgari doim
// qattiq yozilgan namuna foizlarni (62%/45%/70%/38%/55%) ko'rsatardi. Endi
// har biri haqiqiy ma'lumotdan hisoblanadi:
// - So'zlar: 72 ta dars tarkibidagi JAMI so'zlar soni 100% — shundan
//   "Yangi so'zlar" mashqi to'g'ri javob bilan yakunlangan (vocabPractice)
//   darslardagi so'zlar soni ulushi (har darsda faqat birinchi
//   VOCAB_PRACTICE_SIZE ta so'z amalda mashq qilinadi).
// - Muloqot: 36 ta razgovor (speaking) darsning nechtasini ustoz "dars
//   o'tdim" deb belgilagani (attendanceTaken) ulushi.
// - Eshitish: Kutubxona > Kitoblar bo'limidagi audiokitoblardan nechtasi
//   haqiqatan tinglanganini (bookProgressStore) ulushi.
// - Gramatika: 36 ta videodars ichida uyga vazifasi 100% bajarilgan deb
//   hisoblanganlar ulushi.
// - Yozish: 72 ta dars uyga vazifalari ichidagi JAMI "O'qib tarjima
//   qilish mashqi" (kind: 'reading') soni 100% — shulardan nechtasi
//   bajarilgan (homeworkParts[id] belgilangan) ulushi.
export async function getSkillsProgress(): Promise<SkillsProgress> {
  const empty: SkillsProgress = { vocabulary: 0, speaking: 0, listening: 0, grammar: 0, writing: 0 };
  const mc = await fetchMobileContent();
  const course = mc.courses[0];
  if (!course) return empty;

  await loadLessonProgress();
  const adminLessons = mc.lessons.filter((l) => l.courseId === course.id);
  const resolvedCourseLang: 'english' | 'russian' = course.lang === 'russian' ? 'russian' : 'english';

  let totalWords = 0;
  let learnedWords = 0;
  let speakingLessons = 0;
  let speakingDone = 0;
  let videoLessons = 0;
  let videoHomeworkDone = 0;
  let totalReadingParts = 0;
  let doneReadingParts = 0;

  for (let i = 0; i < COURSE_TOTAL_LESSONS; i++) {
    const l = adminLessons[i];
    const id = l?.id ?? String(i + 1);
    const isVideoDay = i % 2 === 0;
    const content = mergeLessonContent(getLessonContent(id, i, resolvedCourseLang), mc.lessonContents[id]);

    totalWords += content.vocabulary.length;
    if (content.vocabulary.length > 0 && getLessonProgress(id).vocabPractice) {
      learnedWords += Math.min(VOCAB_PRACTICE_SIZE, content.vocabulary.length);
    }

    if (isVideoDay) {
      videoLessons++;
      const homeworkPercent = getCategoryProgress(id, 'homework', content.homeworkParts.length);
      if (content.homeworkParts.length > 0 && homeworkPercent >= 100) videoHomeworkDone++;
    } else {
      speakingLessons++;
      if (l?.attendanceTaken) speakingDone++;
    }

    const readingParts = content.homeworkParts.filter((p) => p.kind === 'reading');
    if (readingParts.length > 0) {
      const doneMap = getLessonProgress(id).homeworkParts;
      totalReadingParts += readingParts.length;
      doneReadingParts += readingParts.filter((p) => doneMap[p.id]).length;
    }
  }

  const listenedIds = await getListenedBookIds();
  const books = mc.library.books.length ? mc.library.books : BOOK_STORIES;
  const listenedCount = books.filter((b) => listenedIds.has(b.id)).length;

  return {
    vocabulary: totalWords > 0 ? Math.round((learnedWords / totalWords) * 100) : 0,
    speaking: speakingLessons > 0 ? Math.round((speakingDone / speakingLessons) * 100) : 0,
    listening: books.length > 0 ? Math.round((listenedCount / books.length) * 100) : 0,
    grammar: videoLessons > 0 ? Math.round((videoHomeworkDone / videoLessons) * 100) : 0,
    writing: totalReadingParts > 0 ? Math.round((doneReadingParts / totalReadingParts) * 100) : 0,
  };
}

// 5-vazifa: "So'zlar" ro'yxati o'ziga xos qattiq yozilgan "faqat birinchi 3
// dars ochiq" qoidasidan foydalanardi — bu asosiy "Darslar yo'li"dagi
// haqiqiy (progress/davomatga asoslangan) qulf holatidan butunlay farq
// qilardi. Endi ikkalasi ham AYNAN shu bitta hisoblashdan (getCourseOverallProgress
// bilan bir xil mantiq) foydalanadi, shunda qaysi dars asosiy yo'lda ochiq
// bo'lsa, so'zlar ro'yxatida ham xuddi shu dars ochiq bo'ladi.
export async function getLessonLockMap(): Promise<Record<string, boolean>> {
  const mc = await fetchMobileContent();
  const course = mc.courses[0];
  const map: Record<string, boolean> = {};
  if (!course) return map;

  await loadLessonProgress();
  const adminLessons = mc.lessons.filter((l) => l.courseId === course.id);
  const resolvedCourseLang: 'english' | 'russian' = course.lang === 'russian' ? 'russian' : 'english';

  let prevPercent = 100;
  for (let i = 0; i < COURSE_TOTAL_LESSONS; i++) {
    const l = adminLessons[i];
    const id = l?.id ?? String(i + 1);
    const isVideoDay = i % 2 === 0;

    let locked: boolean;
    if (isVideoDay) {
      const requiredPercent = l?.lock?.enabled ? (l.lock.requiredPercent ?? COURSE_DEFAULT_UNLOCK_PERCENT) : COURSE_DEFAULT_UNLOCK_PERCENT;
      locked = i >= 1 && prevPercent < requiredPercent;
    } else {
      const requiredPercent = l?.lock?.enabled ? (l.lock.requiredPercent ?? COURSE_LIVE_LESSON_UNLOCK_PERCENT) : COURSE_LIVE_LESSON_UNLOCK_PERCENT;
      locked = i >= 1 && (!l?.attendanceTaken || prevPercent < requiredPercent);
    }
    map[id] = locked;

    const videoCategory: ProgressCategory = isVideoDay ? 'video' : 'speaking';
    const content = mergeLessonContent(getLessonContent(id, i, resolvedCourseLang), mc.lessonContents[id]);
    const percent = Math.round(
      (getCategoryProgress(id, videoCategory) + getCategoryProgress(id, 'vocabulary') +
        getCategoryProgress(id, 'homework', content.homeworkParts.length)) / 3
    );
    prevPercent = percent;
  }
  return map;
}

export const VOCAB_PRACTICE_STEPS = ['translation', 'construct', 'pronounce'] as const;
export type VocabPracticeStep = (typeof VOCAB_PRACTICE_STEPS)[number];
export const VOCAB_PRACTICE_SIZE = 8;

// ─── Possible coins per lesson ───────────────────────────────────────────────
function homeworkPartCoins(part: HomeworkPart): number {
  switch (part.kind) {
    case 'matching':
      return part.pairs.length;
    case 'fillBlank':
      return part.blanks.length;
    case 'multipleChoice':
      return part.questions.length;
    case 'sentenceBuild':
      return part.items.length;
    case 'record':
    case 'pronunciation':
      return part.prompts.length;
    case 'roleplay':
      return part.scenario.lines.length;
    case 'creative':
      return 1;
    case 'reading':
      return 1;
  }
}

export function getLessonPossibleCoins(content: LessonContent): number {
  const vocabCoins = VOCAB_PRACTICE_SIZE * VOCAB_PRACTICE_STEPS.length;
  const homeworkCoins = content.homeworkParts.reduce((sum, part) => sum + homeworkPartCoins(part), 0);
  const grammarCoins = content.grammarBlanks.length;
  return vocabCoins + homeworkCoins + grammarCoins;
}
