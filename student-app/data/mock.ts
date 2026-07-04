export type Course = {
  id: string;
  title: string;
  level: string;
  progress: number;
  lessonsTotal: number;
  lessonsDone: number;
};

export type LessonType = 'grammar' | 'speaking' | 'bonus';

export type MilestoneBadge = {
  icon: 'gift-outline' | 'trophy-outline' | 'rocket-outline';
  label: string;
  sub: string;
  bg: string;
  iconColor: string;
};

export type LessonNode = {
  id: string;
  title: string;
  subtitle: string;
  type: LessonType;
  progress: number;
  locked: boolean;
  side: 'left' | 'right';
  stars: number;
  milestone?: MilestoneBadge;
};

export type LessonActivity = {
  id: string;
  type: 'video' | 'speaking' | 'quiz';
  title: string;
  duration: string;
  done: boolean;
  locked: boolean;
};

const grammarTopics: [string, string][] = [
  ['First Words', 'Asosiy so\'zlar'],
  ['Numbers & Colors', 'Sonlar va ranglar'],
  ['Family & Home', 'Oila va uy'],
  ['Present Simple', 'Hozirgi oddiy zamon'],
  ['Adjectives', 'Sifatlar'],
  ['Articles', 'Artikllar'],
  ['Past Simple', 'O\'tgan oddiy zamon'],
  ['Prepositions', 'Predloglar va olmoshlar'],
  ['Plural Forms', 'Ko\'plik shakli'],
  ['Future Simple', 'Kelasi oddiy zamon'],
  ['Comparatives', 'Qiyosiy daraja'],
  ['Superlatives', 'Orttirma daraja'],
  ['Present Continuous', 'Hozirgi davom zamoni'],
  ['Modal Verbs: Can', 'Modal fe\'llar: Can/Could'],
  ['Conditionals I', '1-tur shartli gaplar'],
  ['Past Continuous', 'O\'tgan davom zamoni'],
  ['Phrasal Verbs I', 'Frazeologik fe\'llar I'],
  ['Question Forms', 'So\'roq gaplar'],
  ['Present Perfect', 'Hozirgi-o\'tgan zamon'],
  ['Relative Clauses', 'Aniqlovchi ergash gaplar'],
  ['Passive Voice', 'Passiv qurilma'],
  ['Past Perfect', 'O\'tgan-o\'tgan zamon'],
  ['Reported Speech', 'Bilvosita nutq'],
  ['Gerunds & Infinitives', 'Gerund va infinitiv'],
  ['Modal Verbs: Should', 'Modal fe\'llar: Should/Must'],
  ['Connectors & Linkers', 'Bog\'lovchi so\'zlar'],
  ['Emphasis & Cleft', 'Urg\'u va ajratma gaplar'],
  ['Conditionals II', '2-tur shartli gaplar'],
  ['Wishes & Regrets', 'Orzu va pushaymonlik'],
  ['Causative Verbs', 'Sabab fe\'llari'],
  ['Mixed Conditionals', 'Aralash shartli gaplar'],
  ['Inversion', 'Inversiya'],
  ['Phrasal Verbs II', 'Frazeologik fe\'llar II'],
  ['Academic Writing', 'Akademik yozuv'],
  ['Complex Noun Phrases', 'Murakkab ot birikmalari'],
  ['Advanced Vocabulary', 'Yuqori daraja lug\'at'],
  ['Revision Grammar I', 'Grammatika takrori I'],
  ['Revision Grammar II', 'Grammatika takrori II'],
  ['Final Grammar Review', 'Yakuniy grammatika'],
];

const speakingTopics: [string, string][] = [
  ['Introduce Yourself', 'O\'zingizni tanishtiring'],
  ['Coffee Talk', 'Kundalik suhbatlar'],
  ['Daily Routine', 'Kun tartibi'],
  ['Food & Drinks', 'Taom va ichimliklar'],
  ['Shopping Talk', 'Xarid qilish'],
  ['Asking Directions', 'Yo\'l so\'rash'],
  ['Transport Talk', 'Transport haqida'],
  ['Weather & Seasons', 'Ob-havo va fasllar'],
  ['At the Doctor', 'Shifokorga borish'],
  ['Job Interview', 'Ish suhbati'],
  ['At the Office', 'Ofisda muloqot'],
  ['School & Study', 'Ta\'lim va o\'qish'],
  ['Emotions & Feelings', 'His-tuyg\'ular'],
  ['Sharing Opinions', 'Fikr bildirish'],
  ['Handling Disagreements', 'Bahslashish usullari'],
  ['At the Airport', 'Aeroportda'],
  ['Hotel Booking', 'Mehmonxona'],
  ['Travel Experiences', 'Sayohat tajribalari'],
  ['Hobbies & Interests', 'Qiziqishlar va hobbies'],
  ['Music & Arts', 'Musiqa va san\'at'],
  ['Sports & Fitness', 'Sport va jismoniy tarbiya'],
  ['Social Media Life', 'Ijtimoiy tarmoqlar'],
  ['Tech Innovations', 'Texnologik yangiliklar'],
  ['Online Services', 'Onlayn xizmatlar'],
  ['Healthy Living', 'Sog\'lom turmush tarzi'],
  ['Mental Wellness', 'Ruhiy salomatlik'],
  ['Gym & Exercise', 'Sporzal va mashqlar'],
  ['Environment Issues', 'Atrof-muhit muammolari'],
  ['Animals & Wildlife', 'Hayvonlar va yovvoyi tabiat'],
  ['Climate Change', 'Iqlim o\'zgarishi'],
  ['Business Pitching', 'Biznes taqdimoti'],
  ['Money & Finance', 'Pul va moliya'],
  ['Negotiation Skills', 'Muzokaralar'],
  ['Public Speaking', 'Ommaviy nutq'],
  ['Academic Debates', 'Akademik munozara'],
  ['Critical Thinking', 'Tanqidiy fikrlash'],
  ['Fluency Builder', 'Nutq ravonligi'],
  ['Final Presentation', 'Yakuniy taqdimot'],
  ['Graduation Speech', 'Bitirish nutqi'],
];

const bonusTopics: [string, string][] = [
  ['Weekly Quest 1', 'Haftalik musobaqa 1'],
  ['Weekly Quest 2', 'Haftalik musobaqa 2'],
  ['Weekly Quest 3', 'Haftalik musobaqa 3'],
  ['Weekly Quest 4', 'Haftalik musobaqa 4'],
  ['Weekly Quest 5', 'Haftalik musobaqa 5'],
  ['Weekly Quest 6', 'Haftalik musobaqa 6'],
  ['Weekly Quest 7', 'Haftalik musobaqa 7'],
  ['Weekly Quest 8', 'Haftalik musobaqa 8'],
  ['Weekly Quest 9', 'Haftalik musobaqa 9'],
  ['Weekly Quest 10', 'Haftalik musobaqa 10'],
  ['Weekly Quest 11', 'Haftalik musobaqa 11'],
  ['Grand Challenge', 'Yakuniy grand musobaqa'],
];

const MILESTONES: Record<number, MilestoneBadge> = {
  7: { icon: 'gift-outline', label: 'Reward', sub: '10 dars', bg: '#D1FAE5', iconColor: '#059669' },
  21: { icon: 'trophy-outline', label: 'Challenge', sub: '30 dars', bg: '#EDE9FE', iconColor: '#7B61FF' },
  35: { icon: 'rocket-outline', label: 'Boost', sub: '50 dars', bg: '#FEF3C7', iconColor: '#D97706' },
};

function generateRoadmapLessons(): LessonNode[] {
  const lessons: LessonNode[] = [];
  let gIdx = 0;
  let sIdx = 0;
  let bIdx = 0;

  for (let i = 0; i < 90; i++) {
    const weekPos = i % 7;
    const lessonNum = i + 1;

    let type: LessonType;
    let title: string;
    let subtitle: string;

    if (weekPos === 6) {
      type = 'bonus';
      const t = bonusTopics[bIdx % bonusTopics.length];
      bIdx++;
      [title, subtitle] = t;
    } else if (weekPos % 2 === 0) {
      type = 'grammar';
      const t = grammarTopics[gIdx % grammarTopics.length];
      gIdx++;
      [title, subtitle] = t;
    } else {
      type = 'speaking';
      const t = speakingTopics[sIdx % speakingTopics.length];
      sIdx++;
      [title, subtitle] = t;
    }

    let progress = 0;
    let locked = false;

    if (lessonNum === 1) { progress = 67; }
    else if (lessonNum === 2) { progress = 33; }
    else if (lessonNum === 3) { progress = 0; }
    else { locked = true; }

    const stars = progress === 0 ? 0 : Math.min(5, Math.ceil(progress / 20));
    const milestone = MILESTONES[lessonNum];

    lessons.push({
      id: String(lessonNum),
      title,
      subtitle,
      type,
      progress,
      locked,
      side: i % 2 === 0 ? 'left' : 'right',
      stars,
      milestone,
    });
  }

  return lessons;
}

export const courses: Course[] = [
  {
    id: 'elementary-1',
    title: 'Elementary 1',
    level: 'A1',
    progress: 24,
    lessonsTotal: 90,
    lessonsDone: 22,
  },
  {
    id: 'elementary-2',
    title: 'Elementary 2',
    level: 'A2',
    progress: 0,
    lessonsTotal: 90,
    lessonsDone: 0,
  },
];

export const roadmapLessons: Record<string, LessonNode[]> = {
  'elementary-1': generateRoadmapLessons(),
  'elementary-2': [],
};

export const lessonActivities: Record<string, LessonActivity[]> = {
  '1': [
    { id: 'v1', type: 'video', title: 'Video dars', duration: '12 daq', done: true, locked: false },
    { id: 's1', type: 'speaking', title: 'Speaking', duration: '8 daq', done: false, locked: false },
    { id: 'q1', type: 'quiz', title: 'O\'yinlar va testlar', duration: '15 daq', done: false, locked: false },
  ],
};

export type DailyStage = {
  key: 'radio' | 'words' | 'translator' | 'speakingGame';
  label: string;
  icon: 'musical-notes-outline' | 'book-outline' | 'swap-horizontal-outline' | 'mic-outline';
  progress: number;
  done: boolean;
  bg: string;
  color: string;
};

export const dailyStages: DailyStage[] = [
  { key: 'radio', label: 'Radio', icon: 'musical-notes-outline', progress: 100, done: true, bg: '#D1FAE5', color: '#059669' },
  { key: 'words', label: 'So\'zlar', icon: 'book-outline', progress: 60, done: false, bg: '#E8F0FF', color: '#4F8CFF' },
  { key: 'translator', label: 'Tarjimon', icon: 'swap-horizontal-outline', progress: 0, done: false, bg: '#EDE9FE', color: '#7B61FF' },
  { key: 'speakingGame', label: 'Speaking Battle', icon: 'mic-outline', progress: 0, done: false, bg: '#FCE7F3', color: '#F472B6' },
];

export type SkillProgress = {
  key: 'vocabulary' | 'speaking' | 'listening' | 'grammar' | 'writing';
  label: string;
  icon: 'book-outline' | 'mic-outline' | 'headset-outline' | 'school-outline' | 'create-outline';
  progress: number;
};

export const skillProgress: SkillProgress[] = [
  { key: 'vocabulary', label: 'Vocabulary', icon: 'book-outline', progress: 62 },
  { key: 'speaking', label: 'Speaking', icon: 'mic-outline', progress: 45 },
  { key: 'listening', label: 'Listening', icon: 'headset-outline', progress: 70 },
  { key: 'grammar', label: 'Grammar', icon: 'school-outline', progress: 38 },
  { key: 'writing', label: 'Writing', icon: 'create-outline', progress: 55 },
];

export const nextLiveLesson = {
  topic: 'Speaking Club: Present Simple',
  startsAt: new Date(Date.now() + 1000 * 60 * (60 * 2 + 45)).toISOString(),
  telegramLink: 'https://t.me/+myhomework_elementary1',
};

export const profileStats = {
  name: 'Shahzoda Mavlonova',
  level: 'Beginner',
  phone: '+998 33 695 95 50',
  avatar: null as string | null,
  vocabularyCount: 142,
  grammarCount: 38,
  hoursSpent: 24.5,
  attendanceRate: 92,
  balance: 120000,
  tariff: 'Standard',
};

export const weeklySchedule = [
  { day: 'Dush', time: '14:00', topic: 'Present Simple', attended: true },
  { day: 'Sesh', time: '14:00', topic: 'Vocabulary: Family', attended: true },
  { day: 'Chor', time: '14:00', topic: 'Listening Practice', attended: false },
  { day: 'Pay', time: '14:00', topic: 'Speaking Club', attended: true },
  { day: 'Jum', time: '14:00', topic: 'Grammar Review', attended: null },
];

export const grades = [
  { subject: 'Speaking', score: 85, max: 100 },
  { subject: 'Listening', score: 78, max: 100 },
  { subject: 'Grammar', score: 91, max: 100 },
  { subject: 'Vocabulary', score: 88, max: 100 },
];

export const paymentHistory = [
  { id: '1', date: '2026-05-01', amount: 450000, tariff: 'Standard', status: 'paid' },
  { id: '2', date: '2026-04-01', amount: 450000, tariff: 'Standard', status: 'paid' },
  { id: '3', date: '2026-03-01', amount: 450000, tariff: 'Standard', status: 'paid' },
];
