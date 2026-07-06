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
  route?: string;
};

export const dailyStages: DailyStage[] = [
  { key: 'radio', label: 'Radio', icon: 'musical-notes-outline', progress: 100, done: true, bg: '#D1FAE5', color: '#059669', route: '/radio' },
  { key: 'words', label: 'So\'zlar', icon: 'book-outline', progress: 60, done: false, bg: '#E8F0FF', color: '#4F8CFF', route: '/vocabulary' },
  { key: 'translator', label: 'Tarjimon', icon: 'swap-horizontal-outline', progress: 0, done: false, bg: '#EDE9FE', color: '#7B61FF', route: '/translator' },
  { key: 'speakingGame', label: 'Speaking Battle', icon: 'mic-outline', progress: 0, done: false, bg: '#FCE7F3', color: '#F472B6', route: '/battle' },
];

export type RadioAnnouncement = {
  id: string;
  title: string;
  subtitle: string;
  colors: [string, string];
};

export const radioAnnouncements: RadioAnnouncement[] = [
  {
    id: 'a1',
    title: 'Yangi BBC dasturi qo\'shildi',
    subtitle: 'Ingliz tilida tinglab, talaffuzni oshiring',
    colors: ['#6FA8FF', '#4F8CFF'],
  },
  {
    id: 'a2',
    title: 'Homework Radio jonli efirda',
    subtitle: 'Har kuni yangi darslar va musiqalar',
    colors: ['#9B7BFF', '#6B4FE0'],
  },
  {
    id: 'a3',
    title: 'Amerika aksentini o\'rganing',
    subtitle: '5 ta Amerika radiosi sizni kutmoqda',
    colors: ['#5EE6B0', '#34D399'],
  },
];

export type RadioStation = {
  id: string;
  name: string;
  country: 'UK' | 'US' | 'Homework';
  flag: string;
  genre: string;
  colors: [string, string];
  location: string;
  founded: string;
  about: string;
};

export const radioStations: RadioStation[] = [
  {
    id: 'bbc-radio-1', name: 'BBC Radio 1', country: 'UK', flag: '🇬🇧', genre: 'Pop & Hits', colors: ['#E85D5D', '#C43E3E'],
    location: 'London, Buyuk Britaniya',
    founded: '1967-yildan beri',
    about: "Yosh tinglovchilar uchun eng so'nggi pop va hit qo'shiqlarni, DJ dasturlari va musiqa chartlarini efirga uzatadi.",
  },
  {
    id: 'bbc-radio-2', name: 'BBC Radio 2', country: 'UK', flag: '🇬🇧', genre: 'Adult Contemporary', colors: ['#4F8CFF', '#3A6FE0'],
    location: 'London, Buyuk Britaniya',
    founded: '1967-yildan beri',
    about: "Katta yoshdagi tinglovchilar uchun mashhur qo'shiqlar, intervyular va turli janrdagi musiqiy dasturlarni namoyish etadi.",
  },
  {
    id: 'capital-fm', name: 'Capital FM', country: 'UK', flag: '🇬🇧', genre: 'Top 40', colors: ['#F472B6', '#DB4E93'],
    location: 'London, Buyuk Britaniya',
    founded: '1973-yildan beri',
    about: "Top 40 chartidagi eng mashhur zamonaviy qo'shiqlarni va shou-dasturlarni efirga uzatadi.",
  },
  {
    id: 'classic-fm', name: 'Classic FM', country: 'UK', flag: '🇬🇧', genre: 'Classical', colors: ['#7B61FF', '#5A3FD6'],
    location: 'London, Buyuk Britaniya',
    founded: '1992-yildan beri',
    about: "Dunyoning eng mashhur klassik musiqa asarlarini kun bo'yi tinglovchilarga yetkazadi.",
  },
  {
    id: 'npr', name: 'NPR', country: 'US', flag: '🇺🇸', genre: 'News & Talk', colors: ['#34D399', '#1FA97D'],
    location: 'Vashington, AQSH',
    founded: '1970-yildan beri',
    about: "Chuqur tahliliy yangiliklar, jamiyat va madaniyatga oid suhbat-dasturlarni efirga uzatuvchi jamoat radiosi.",
  },
  {
    id: 'iheart-hits', name: 'iHeart Hits', country: 'US', flag: '🇺🇸', genre: 'Pop Hits', colors: ['#FBBF24', '#E5A70F'],
    location: 'AQSH',
    founded: '2008-yildan beri',
    about: "Eng ommabop zamonaviy pop hitlarni uzluksiz tarzda efirga uzatadi.",
  },
  {
    id: 'kiss-fm', name: 'KISS FM', country: 'US', flag: '🇺🇸', genre: 'Hip-Hop & R&B', colors: ['#F87171', '#DF4F4F'],
    location: 'AQSH',
    founded: "1980-yillardan beri",
    about: "Hip-hop, R&B va zamonaviy shahar musiqasi janrlaridagi qo'shiqlarni efirga uzatadi.",
  },
  {
    id: 'jazz24', name: 'Jazz24', country: 'US', flag: '🇺🇸', genre: 'Jazz', colors: ['#6B4FE0', '#4C31B0'],
    location: 'Sietl, AQSH',
    founded: '2005-yildan beri',
    about: "Kecha-yu kunduz klassik va zamonaviy jaz musiqasini tinglovchilarga taqdim etadi.",
  },
  {
    id: 'classic-rock-101', name: 'Classic Rock 101', country: 'US', flag: '🇺🇸', genre: 'Classic Rock', colors: ['#4B5563', '#1F2937'],
    location: 'AQSH',
    founded: "20 yildan ortiq vaqtdan beri",
    about: "70–90-yillarning mashhur rok guruhlari va klassik rok qo'shiqlarini efirga uzatadi.",
  },
  {
    id: 'homework-radio', name: 'Homework Radio', country: 'Homework', flag: '🎓', genre: 'Til o\'rganish uchun maxsus', colors: ['#9B7BFF', '#6B4FE0'],
    location: 'Myhomework.uz platformasi',
    founded: 'Platforma ochilgan kundan beri',
    about: "Ingliz tilini o'rganuvchilar uchun maxsus tanlangan qo'shiqlar, audio darslar va motivatsion kontentni efirga uzatadi.",
  },
];

export type NotifCategory = 'news' | 'lessons';

export type AppNotification = {
  id: string;
  category: NotifCategory;
  date: string;
  title: string;
  message: string;
  detail: string;
  unread: boolean;
  colors: [string, string];
  emoji: string;
  interactive?: 'attendance';
};

export const appNotifications: AppNotification[] = [
  {
    id: 'n1',
    category: 'lessons',
    date: '14:35, 11.10.2026',
    title: '11-dars yakunlandi',
    message: 'Bugungi darsda ishtirok etdingizmi?',
    detail: '11-dars "Present Simple" mavzusida o\'tildi. Darsda ishtirokingizni tasdiqlang — bu sizning davomat statistikangizga ta\'sir qiladi.',
    unread: true,
    colors: ['#4F8CFF', '#3A6FE0'],
    emoji: '📋',
    interactive: 'attendance',
  },
  {
    id: 'n2',
    category: 'lessons',
    date: 'Ertaga, 19:00',
    title: 'Live darsga chaqiruv',
    message: 'Speaking Club darsi boshlanishiga sanoqli soatlar qoldi',
    detail: 'Ertaga soat 19:00 da "Speaking Club: Present Simple" mavzusidagi live darsimizga qo\'shiling. Darsni o\'tkazib yubormang!',
    unread: true,
    colors: ['#9B7BFF', '#6B4FE0'],
    emoji: '🔔',
  },
  {
    id: 'n3',
    category: 'lessons',
    date: '2 kun oldin',
    title: 'Tabriklaymiz!',
    message: 'Siz 5 kunlik streak\'ni ushladingiz',
    detail: 'Ketma-ket 5 kun davomida darslarni bajardingiz! Davom eting va yanada ko\'proq bonus yutuqlarga erishing.',
    unread: false,
    colors: ['#34D399', '#1FA97D'],
    emoji: '🏆',
  },
  {
    id: 'n4',
    category: 'news',
    date: '12.12.2026',
    title: 'Yangi kitob sotuvda',
    message: '"Beparvolikning nozik san\'ati" kitobi endi platformamizda mavjud',
    detail: 'Kitobni ingliz tilidan to\'g\'ridan-to\'g\'ri iste\'dodli va tajribali tarjimon o\'zbek tiliga o\'girgan. Resurslar bo\'limidan yuklab oling.',
    unread: true,
    colors: ['#F472B6', '#DB4E93'],
    emoji: '📘',
  },
  {
    id: 'n5',
    category: 'news',
    date: '05.11.2026',
    title: 'Do\'stingizni taklif qiling',
    message: 'Do\'stingizni taklif qiling va 100 coin oling',
    detail: 'Referral havolangizni ulashing — do\'stingiz ro\'yxatdan o\'tsa, ikkalangiz ham 100 coin qo\'lga kiritasiz.',
    unread: false,
    colors: ['#FBBF24', '#E5A70F'],
    emoji: '🎁',
  },
];

export type ChatThread = {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
};

export const chatThreads: ChatThread[] = [
  { id: 'support', name: 'Qo\'llab-quvvatlash', role: 'Yordam xizmati', emoji: '🎧', color: '#4F8CFF' },
  { id: 'main-teacher', name: 'Asosiy ustoz', role: 'Sizning o\'qituvchingiz', emoji: '👩‍🏫', color: '#7B61FF' },
  { id: 'assistant-teacher', name: 'Yordamchi ustoz', role: 'Kurator', emoji: '🧑‍🏫', color: '#34D399' },
  { id: 'project-lead', name: 'Loyiha rahbari', role: 'Menejer', emoji: '🧑‍💼', color: '#F472B6' },
];

export type ChatMessageType = 'text' | 'image' | 'voice';

export type ChatMessage = {
  id: string;
  chatId: string;
  from: 'me' | 'them';
  type: ChatMessageType;
  text?: string;
  imageUri?: string;
  voiceUri?: string;
  voiceDuration?: number;
  time: string;
};

export const initialChatMessages: ChatMessage[] = [
  { id: 'm1', chatId: 'support', from: 'them', type: 'text', text: 'Salom! Sizga qanday yordam bera olaman?', time: '09:12' },
  { id: 'm2', chatId: 'main-teacher', from: 'them', type: 'text', text: 'Assalomu alaykum, bugungi vazifangizni ko\'rib chiqdim, ajoyib ish!', time: 'Kecha' },
  { id: 'm3', chatId: 'assistant-teacher', from: 'them', type: 'text', text: 'Eslatma: ertaga soat 19:00 da live dars bor.', time: '2 kun oldin' },
  { id: 'm4', chatId: 'project-lead', from: 'them', type: 'text', text: 'Xush kelibsiz! Savollaringiz bo\'lsa bemalol yozing.', time: '1 hafta oldin' },
];

export type BattleWord = {
  word: string;
  translation: string;
  options: string[];
};

export const battleWords: BattleWord[] = [
  { word: 'apple', translation: 'olma', options: ['olma', 'nok', 'uzum', 'shaftoli'] },
  { word: 'window', translation: 'deraza', options: ['eshik', 'deraza', 'devor', 'tom'] },
  { word: 'friend', translation: 'do\'st', options: ['dushman', 'qo\'shni', 'do\'st', 'begona'] },
  { word: 'happy', translation: 'baxtli', options: ['g\'amgin', 'charchagan', 'baxtli', 'asabiy'] },
  { word: 'travel', translation: 'sayohat qilmoq', options: ['ishlamoq', 'sayohat qilmoq', 'uxlamoq', 'yozmoq'] },
  { word: 'kitchen', translation: 'oshxona', options: ['yotoqxona', 'mehmonxona', 'oshxona', 'hammom'] },
  { word: 'weather', translation: 'ob-havo', options: ['ob-havo', 'fasl', 'quyosh', 'shamol'] },
  { word: 'teacher', translation: 'o\'qituvchi', options: ['shifokor', 'o\'qituvchi', 'muhandis', 'haydovchi'] },
  { word: 'quick', translation: 'tez', options: ['sekin', 'tez', 'og\'ir', 'yengil'] },
  { word: 'library', translation: 'kutubxona', options: ['kutubxona', 'do\'kon', 'bozor', 'bank'] },
  { word: 'important', translation: 'muhim', options: ['muhim', 'oddiy', 'qiziqarli', 'zerikarli'] },
  { word: 'morning', translation: 'ertalab', options: ['kechqurun', 'tush payti', 'ertalab', 'kecha'] },
];

export type BattleOpponentType = 'bot' | 'random';

export const BATTLE_ROUNDS = 5;
export const BATTLE_ROUND_SECONDS = 8;
export const BATTLE_WIN_COINS = 50;

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
  coins: 320,
  streakDays: 5,
  gamesTimeHours: 3.2,
  libraryTimeHours: 5.8,
  aiChatTimeHours: 1.4,
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
  { id: '4', date: '2026-06-01', amount: 450000, tariff: 'Standard', status: 'debt' as const, dueDate: '2026-07-10' },
  { id: '1', date: '2026-05-01', amount: 450000, tariff: 'Standard', status: 'paid' as const },
  { id: '2', date: '2026-04-01', amount: 450000, tariff: 'Standard', status: 'paid' as const },
  { id: '3', date: '2026-03-01', amount: 450000, tariff: 'Standard', status: 'paid' as const },
];

export const courseEnrollment = {
  tariffMinutes: 30,
  courseStartDate: '2026-03-01',
  courseEndDate: '2026-12-01',
  salesManager: 'Kamronbek Yusupov',
  contractNumber: 'SHN-2026-0451',
  contractFileAvailable: false,
};

export type PersonaCategory = 'general' | 'business' | 'sports' | 'politics' | 'film' | 'medicine';

export type CelebrityPersona = {
  id: string;
  name: string;
  category: PersonaCategory;
  emoji: string;
  colors: [string, string];
  intro: string;
};

export const PERSONA_CATEGORY_LABELS: Record<PersonaCategory, string> = {
  general: 'General',
  business: 'Business',
  sports: 'Sports',
  politics: 'Politics',
  film: 'Film & Movies',
  medicine: 'Medicine',
};

export const celebrityPersonas: CelebrityPersona[] = [
  {
    id: 'homework-bot',
    name: 'Homework Bot',
    category: 'general',
    emoji: '🤖',
    colors: ['#6FA8FF', '#4F8CFF'],
    intro: "Hi there! I'm Homework Bot. Ask me anything about English, or just practice chatting with me!",
  },
  {
    id: 'shumboma',
    name: 'Shumboma',
    category: 'general',
    emoji: '🎭',
    colors: ['#F472B6', '#DB4E93'],
    intro: "Hey! I'm Shumboma, always up for a fun chat. What's on your mind today?",
  },
  {
    id: 'elon-musk',
    name: 'Elon Musk',
    category: 'business',
    emoji: '🚀',
    colors: ['#9B7BFF', '#6B4FE0'],
    intro: "Hey, let's talk business, technology, or rockets. What do you want to know?",
  },
  {
    id: 'mark-zuckerberg',
    name: 'Mark Zuckerberg',
    category: 'business',
    emoji: '💻',
    colors: ['#4F8CFF', '#3A6FE0'],
    intro: "Hi! Let's chat about building companies, technology, and connecting people.",
  },
  {
    id: 'messi',
    name: 'Lionel Messi',
    category: 'sports',
    emoji: '⚽',
    colors: ['#6FCF97', '#34D399'],
    intro: "Hola! Let's talk football, training, and what it takes to become a champion.",
  },
  {
    id: 'ronaldo',
    name: 'Cristiano Ronaldo',
    category: 'sports',
    emoji: '🏆',
    colors: ['#34D399', '#1FA97D'],
    intro: "Hey! Ask me about football, discipline, and staying at the top of your game.",
  },
  {
    id: 'franklin',
    name: 'Benjamin Franklin',
    category: 'politics',
    emoji: '🦅',
    colors: ['#FBBF24', '#D97706'],
    intro: "Good day! Let's discuss politics, invention, and the wisdom of hard work.",
  },
  {
    id: 'queen-elizabeth',
    name: 'Queen Elizabeth II',
    category: 'politics',
    emoji: '👑',
    colors: ['#A78BFA', '#7C3AED'],
    intro: "Good afternoon. I would be delighted to talk about leadership, duty, and history.",
  },
  {
    id: 'dicaprio',
    name: 'Leonardo DiCaprio',
    category: 'film',
    emoji: '🎬',
    colors: ['#F87171', '#DF4F4F'],
    intro: "Hey, let's talk about acting, storytelling, and the movie industry.",
  },
  {
    id: 'jolie',
    name: 'Angelina Jolie',
    category: 'film',
    emoji: '🎥',
    colors: ['#F472B6', '#EC4899'],
    intro: "Hi! I'd love to chat about film, humanitarian work, and following your passions.",
  },
  {
    id: 'dr-house',
    name: 'Dr. House',
    category: 'medicine',
    emoji: '🩺',
    colors: ['#4B5563', '#1F2937'],
    intro: "Everybody lies. But let's talk medicine anyway — what's your question?",
  },
];

export type LeaderboardEntry = {
  id: string;
  name: string;
  avatarEmoji: string;
  lessonsCompleted: number;
  coins: number;
};

export const ME_LEADERBOARD_ID = 'me';

export const leaderboardEntries: LeaderboardEntry[] = [
  { id: 'e1', name: 'Azizbek', avatarEmoji: '🧑', lessonsCompleted: 95, coins: 12560 },
  { id: 'e2', name: 'Zarina', avatarEmoji: '👩', lessonsCompleted: 92, coins: 11230 },
  { id: 'e3', name: 'Behruz', avatarEmoji: '🧑‍🦱', lessonsCompleted: 88, coins: 9870 },
  { id: 'e4', name: 'Madina', avatarEmoji: '👩‍🦱', lessonsCompleted: 90, coins: 8420 },
  { id: 'e5', name: 'Diyor', avatarEmoji: '🧑‍🦰', lessonsCompleted: 85, coins: 7650 },
  { id: 'e6', name: 'Kamila', avatarEmoji: '👱‍♀️', lessonsCompleted: 80, coins: 6980 },
  { id: ME_LEADERBOARD_ID, name: 'Siz', avatarEmoji: '🙂', lessonsCompleted: 75, coins: 6250 },
  { id: 'e7', name: 'Sardor', avatarEmoji: '🧔', lessonsCompleted: 70, coins: 5420 },
  { id: 'e8', name: 'Gulnoza', avatarEmoji: '🧕', lessonsCompleted: 65, coins: 4980 },
  { id: 'e9', name: 'Asilbek', avatarEmoji: '👨', lessonsCompleted: 60, coins: 4250 },
  { id: 'e10', name: 'Nodira', avatarEmoji: '👩‍🦳', lessonsCompleted: 58, coins: 3900 },
  { id: 'e11', name: 'Jasur', avatarEmoji: '👦', lessonsCompleted: 55, coins: 3600 },
  { id: 'e12', name: 'Sitora', avatarEmoji: '👧', lessonsCompleted: 52, coins: 3200 },
  { id: 'e13', name: 'Otabek', avatarEmoji: '🧑‍🎓', lessonsCompleted: 48, coins: 2800 },
  { id: 'e14', name: 'Feruza', avatarEmoji: '👩‍🎓', lessonsCompleted: 44, coins: 2400 },
];

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'alltime';
export type LeaderboardScope = 'region' | 'country' | 'global';

export const LEADERBOARD_PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  daily: 'Kunlik',
  weekly: 'Haftalik',
  monthly: 'Oylik',
  alltime: 'Doimiy',
};

export const LEADERBOARD_SCOPE_LABELS: Record<LeaderboardScope, string> = {
  region: "O'z viloyati",
  country: "O'zbekiston",
  global: 'Global',
};

const PERIOD_SCALE: Record<LeaderboardPeriod, number> = {
  daily: 0.02,
  weekly: 0.12,
  monthly: 0.4,
  alltime: 1,
};

const SCOPE_SCALE: Record<LeaderboardScope, number> = {
  region: 0.5,
  country: 1,
  global: 2.4,
};

export type RankedLeaderboardEntry = LeaderboardEntry & { rank: number; displayCoins: number };

export function getRankedLeaderboard(period: LeaderboardPeriod, scope: LeaderboardScope, myCoins?: number): RankedLeaderboardEntry[] {
  const factor = PERIOD_SCALE[period] * SCOPE_SCALE[scope];
  const entries = myCoins !== undefined
    ? leaderboardEntries.map((e) => (e.id === ME_LEADERBOARD_ID ? { ...e, coins: myCoins } : e))
    : leaderboardEntries;
  const scaled = entries.map((e) => ({ ...e, displayCoins: Math.max(1, Math.round(e.coins * factor)) }));
  scaled.sort((a, b) => b.displayCoins - a.displayCoins);
  return scaled.map((e, i) => ({ ...e, rank: i + 1 }));
}
