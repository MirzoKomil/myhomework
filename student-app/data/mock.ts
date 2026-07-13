import type { ImageSourcePropType } from 'react-native';

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
  emoji: string;
  fact: string;
};

export type LessonNode = {
  id: string;
  title: string;
  subtitle: string;
  type: LessonType;
  progress: number;
  locked: boolean;
  lockReason?: 'percent' | 'attendance';
  lockRequiredPercent?: number;
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

export const courses: Course[] = [
  {
    id: 'elementary-1',
    title: 'Elementary 1',
    level: 'A1',
    progress: 31,
    lessonsTotal: 72,
    lessonsDone: 22,
  },
  {
    id: 'elementary-2',
    title: 'Elementary 2',
    level: 'A2',
    progress: 0,
    lessonsTotal: 72,
    lessonsDone: 0,
  },
];

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
  // Haqiqiy jonli oqimni radio-browser.info orqali topish uchun qidiruv so'zi.
  // Homework Radio'da yo'q — u alohida, statik namoyish sifatida qoladi.
  streamQuery?: string;
  // Stansiyaning haqiqiy rasmiy logotipi — mavjud bo'lsa, ro'yxat va pleer
  // ekranida bayroq+gradient o'rniga shu tasvir ko'rsatiladi.
  logo?: ImageSourcePropType;
};

export const radioStations: RadioStation[] = [
  {
    id: 'npr', name: 'NPR', country: 'US', flag: '🇺🇸', genre: 'News & Talk', colors: ['#34D399', '#1FA97D'],
    location: 'Vashington, AQSH',
    founded: '1970-yildan beri',
    about: "Chuqur tahliliy yangiliklar, jamiyat va madaniyatga oid suhbat-dasturlarni efirga uzatuvchi jamoat radiosi.",
    streamQuery: 'NPR News',
    logo: require('@/assets/images/radio/npr.jpg'),
  },
  {
    id: 'wnyc', name: 'WNYC', country: 'US', flag: '🇺🇸', genre: 'News & Talk', colors: ['#0EA5E9', '#0284C7'],
    location: 'Nyu-York, AQSH',
    founded: '1924-yildan beri',
    about: "Nyu-York davlat radiosi — siyosat, madaniyat va ijtimoiy hayot haqida chuqur suhbatlar va podkastlarni efirga uzatadi.",
    streamQuery: 'WNYC',
    logo: require('@/assets/images/radio/wnyc.jpg'),
  },
  {
    id: 'bloomberg-radio', name: 'Bloomberg Radio', country: 'US', flag: '🇺🇸', genre: 'Biznes va iqtisodiyot', colors: ['#1E293B', '#0F172A'],
    location: 'Nyu-York, AQSH',
    founded: '1990-yillardan beri',
    about: "Biznes, iqtisodiyot va global bozorlar haqida professional tahliliy dasturlarni efirga uzatadi.",
    streamQuery: 'Bloomberg Radio',
    logo: require('@/assets/images/radio/bloomberg-radio.jpg'),
  },
  {
    id: 'fox-news-radio', name: 'Fox News Radio', country: 'US', flag: '🇺🇸', genre: 'Yangiliklar', colors: ['#DC2626', '#991B1B'],
    location: 'AQSH',
    founded: '2003-yildan beri',
    about: "Kundalik yangiliklar, siyosiy debatlar va dolzarb mavzular bo'yicha tinimsiz muloqotlarni efirga uzatadi.",
    streamQuery: 'Fox News Radio',
    logo: require('@/assets/images/radio/fox-news-radio.jpg'),
  },
  {
    // VOA Learning English (avvalgi stansiya) faqat HLS oqimga ega edi — bu
    // Chrome/Android/desktop'da <audio> orqali haqiqiy tovush chiqarmaydi
    // (ekranda "jonli" ko'rinadi, lekin ovozsiz). VOA'ning na asosiy
    // (voanews.com), na Learning English saytida umuman veb orqali jonli
    // tinglash imkoniyati yo'q edi — muqobil topilmadi. C-SPAN Radio esa
    // barcha qurilmalarda ishlaydigan, real, rasmiy AQSh stansiyasi.
    id: 'c-span-radio', name: 'C-SPAN Radio', country: 'US', flag: '🇺🇸', genre: 'Kongress va siyosat', colors: ['#3B82F6', '#1D4ED8'],
    location: 'Vashington, AQSH',
    founded: '1979-yildan beri',
    about: "AQSh Kongressidagi muhokamalar, matbuot anjumanlari va siyosiy suhbatlarni to'g'ridan-to'g'ri, aniq va sekin nutqda efirga uzatadi.",
    streamQuery: 'C-SPAN Radio',
  },
  {
    id: 'bbc-world-service', name: 'BBC World Service', country: 'UK', flag: '🇬🇧', genre: 'Xalqaro yangiliklar', colors: ['#7C3AED', '#5B21B6'],
    location: 'London, Buyuk Britaniya',
    founded: '1932-yildan beri',
    about: "Dunyo bo'ylab turli aksentlardagi suhbatlar va xalqaro yangiliklarni efirga uzatadi — tinglab tushunish mahoratini oshirish uchun ajoyib manba.",
    streamQuery: 'BBC World Service',
    logo: require('@/assets/images/radio/bbc-world-service.png'),
  },
  {
    id: 'bbc-radio-4', name: 'BBC Radio 4', country: 'UK', flag: '🇬🇧', genre: 'Nutq, drama va madaniyat', colors: ['#0F766E', '#115E59'],
    location: 'London, Buyuk Britaniya',
    founded: '1967-yildan beri',
    about: "Musiqasiz — faqat drama, komediya, fan va madaniyat haqida chuqur suhbatlardan iborat Buyuk Britaniyaning eng mashhur nutq radiosi.",
    streamQuery: 'BBC Radio 4',
    logo: require('@/assets/images/radio/bbc-radio-4.png'),
  },
  {
    id: 'lbc', name: 'LBC', country: 'UK', flag: '🇬🇧', genre: 'Jonli muloqot', colors: ['#F59E0B', '#D97706'],
    location: 'London, Buyuk Britaniya',
    founded: '1973-yildan beri',
    about: "Oddiy odamlar qo'ng'iroq qilib, boshlovchi bilan bahslashadigan Buyuk Britaniyaning eng mashhur jonli muloqot radiosi.",
    // Diqqat: sodda "LBC" so'rovi radio-browser.info katalogida "LBC News"
    // (alohida, faqat yangiliklar beruvchi opa-singil kanal) sifatida chiqishi
    // mumkin — aynan asosiy LBC talk-radio oqimini olish uchun "LBC UK" ishlatiladi.
    streamQuery: 'LBC UK',
    logo: require('@/assets/images/radio/lbc.png'),
  },
  {
    id: 'times-radio', name: 'Times Radio', country: 'UK', flag: '🇬🇧', genre: 'Siyosat va tahlil', colors: ['#7F1D1D', '#450A0A'],
    location: 'London, Buyuk Britaniya',
    founded: '2020-yildan beri',
    about: "The Times nashri tomonidan tashkil etilgan, yuqori saviyadagi siyosiy va ijtimoiy tahliliy dasturlarni efirga uzatadi.",
    streamQuery: 'Times Radio',
    logo: require('@/assets/images/radio/times-radio.jpg'),
  },
  {
    id: 'talksport', name: 'talkSPORT', country: 'UK', flag: '🇬🇧', genre: 'Sport sharhlari', colors: ['#EA580C', '#C2410C'],
    location: 'London, Buyuk Britaniya',
    founded: '2000-yildan beri',
    about: "Kun bo'yi futbol va boshqa sport turlari bo'yicha qizg'in sharhlar va bahslarni efirga uzatadi.",
    streamQuery: 'talkSPORT',
    logo: require('@/assets/images/radio/talksport.png'),
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
  interactive?: 'attendance' | 'rate-teacher';
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
  studentId: 'AZ8421',
  age: 19,
  gender: 'Ayol',
  address: "Toshkent sh., Chilonzor tumani, Bunyodkor ko'chasi 12-uy",
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
  radioTimeHours: 2.6,
};

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

export type DeliveryStage = 'preparing' | 'dispatched' | 'in_transit' | 'delivered';

export const DELIVERY_STAGE_ORDER: DeliveryStage[] = ['preparing', 'dispatched', 'in_transit', 'delivered'];

export const DELIVERY_STAGE_LABELS: Record<DeliveryStage, string> = {
  preparing: 'Tayyorlanmoqda',
  dispatched: "Jo'natildi",
  in_transit: "Yo'lda",
  delivered: 'Yetkazib berildi',
};

export type BookDelivery = {
  id: string;
  title: string;
  emoji: string;
  stage: DeliveryStage;
  address: string;
  dispatchedDate?: string;
  deliveredDate?: string;
};

export const bookDeliveries: BookDelivery[] = [
  {
    id: 'coursebook',
    title: 'Coursebook',
    emoji: '📘',
    stage: 'delivered',
    address: "Toshkent sh., Chilonzor tumani, Bunyodkor ko'chasi 12-uy",
    dispatchedDate: '2026-06-20',
    deliveredDate: '2026-06-25',
  },
  {
    id: 'vocabulary-book',
    title: 'Vocabulary Book',
    emoji: '📗',
    stage: 'in_transit',
    address: "Toshkent sh., Chilonzor tumani, Bunyodkor ko'chasi 12-uy",
    dispatchedDate: '2026-07-02',
  },
];

export type PersonaCategory = 'general' | 'business' | 'sports' | 'politics' | 'film' | 'medicine' | 'science';

export type CelebrityPersona = {
  id: string;
  name: string;
  category: PersonaCategory;
  emoji: string;
  avatarImage: ImageSourcePropType;
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
  science: 'Science',
};

export const celebrityPersonas: CelebrityPersona[] = [
  {
    id: 'elon-musk',
    name: 'Elon Musk',
    category: 'business',
    emoji: '🚀',
    avatarImage: require('@/assets/images/personas/elon-musk.png'),
    colors: ['#9B7BFF', '#6B4FE0'],
    intro: "Hey, let's talk business, technology, or rockets. What do you want to know?",
  },
  {
    id: 'mark-zuckerberg',
    name: 'Mark Zuckerberg',
    category: 'business',
    emoji: '💻',
    avatarImage: require('@/assets/images/personas/mark-zuckerberg.png'),
    colors: ['#4F8CFF', '#3A6FE0'],
    intro: "Hi! Let's chat about building companies, technology, and connecting people.",
  },
  {
    id: 'messi',
    name: 'Lionel Messi',
    category: 'sports',
    emoji: '⚽',
    avatarImage: require('@/assets/images/personas/messi.png'),
    colors: ['#6FCF97', '#34D399'],
    intro: "Hola! Let's talk football, training, and what it takes to become a champion.",
  },
  {
    id: 'ronaldo',
    name: 'Cristiano Ronaldo',
    category: 'sports',
    emoji: '🏆',
    avatarImage: require('@/assets/images/personas/ronaldo.png'),
    colors: ['#34D399', '#1FA97D'],
    intro: "Hey! Ask me about football, discipline, and staying at the top of your game.",
  },
  {
    id: 'franklin',
    name: 'Benjamin Franklin',
    category: 'politics',
    emoji: '🦅',
    avatarImage: require('@/assets/images/personas/franklin.png'),
    colors: ['#FBBF24', '#D97706'],
    intro: "Good day! Let's discuss politics, invention, and the wisdom of hard work.",
  },
  {
    id: 'queen-elizabeth',
    name: 'Queen Elizabeth II',
    category: 'politics',
    emoji: '👑',
    avatarImage: require('@/assets/images/personas/queen-elizabeth.png'),
    colors: ['#A78BFA', '#7C3AED'],
    intro: "Good afternoon. I would be delighted to talk about leadership, duty, and history.",
  },
  {
    id: 'dicaprio',
    name: 'Leonardo DiCaprio',
    category: 'film',
    emoji: '🎬',
    avatarImage: require('@/assets/images/personas/dicaprio.png'),
    colors: ['#F87171', '#DF4F4F'],
    intro: "Hey, let's talk about acting, storytelling, and the movie industry.",
  },
  {
    id: 'jolie',
    name: 'Angelina Jolie',
    category: 'film',
    emoji: '🎥',
    avatarImage: require('@/assets/images/personas/jolie.png'),
    colors: ['#F472B6', '#EC4899'],
    intro: "Hi! I'd love to chat about film, humanitarian work, and following your passions.",
  },
  {
    id: 'dr-house',
    name: 'Dr. House',
    category: 'medicine',
    emoji: '🩺',
    avatarImage: require('@/assets/images/personas/dr-house.png'),
    colors: ['#4B5563', '#1F2937'],
    intro: "Everybody lies. But let's talk medicine anyway — what's your question?",
  },
  {
    id: 'einstein',
    name: 'Albert Einstein',
    category: 'science',
    emoji: '🧠',
    avatarImage: require('@/assets/images/personas/einstein.png'),
    colors: ['#A78BFA', '#7C3AED'],
    intro: "Hello! Let's talk about science, curiosity, and how imagination shapes discovery.",
  },
];

export type LeaderboardEntry = {
  id: string;
  name: string;
  avatarEmoji: string;
  lessonsCompleted: number;
  coins: number;
  lightning: number;
};

export const ME_LEADERBOARD_ID = 'me';

// Chaqmoq faqat to'planadi (sarflanmaydi), shuning uchun reyting shu bo'yicha
// hisoblanadi — coin esa sarflanishi mumkinligi uchun faqat ma'lumot sifatida
// ko'rsatiladi, o'ringa ta'sir qilmaydi.
export const leaderboardEntries: LeaderboardEntry[] = [
  { id: 'e1', name: 'Azizbek', avatarEmoji: '🧑', lessonsCompleted: 95, coins: 12560, lightning: 12500 },
  { id: 'e2', name: 'Zarina', avatarEmoji: '👩', lessonsCompleted: 92, coins: 11230, lightning: 12000 },
  { id: 'e4', name: 'Madina', avatarEmoji: '👩‍🦱', lessonsCompleted: 90, coins: 8420, lightning: 11500 },
  { id: 'e3', name: 'Behruz', avatarEmoji: '🧑‍🦱', lessonsCompleted: 88, coins: 9870, lightning: 11000 },
  { id: 'e5', name: 'Diyor', avatarEmoji: '🧑‍🦰', lessonsCompleted: 85, coins: 7650, lightning: 10200 },
  { id: 'e6', name: 'Kamila', avatarEmoji: '👱‍♀️', lessonsCompleted: 80, coins: 6980, lightning: 9500 },
  { id: ME_LEADERBOARD_ID, name: 'Siz', avatarEmoji: '🙂', lessonsCompleted: 75, coins: 6250, lightning: 8200 },
  { id: 'e7', name: 'Sardor', avatarEmoji: '🧔', lessonsCompleted: 70, coins: 5420, lightning: 7800 },
  { id: 'e8', name: 'Gulnoza', avatarEmoji: '🧕', lessonsCompleted: 65, coins: 4980, lightning: 7000 },
  { id: 'e9', name: 'Asilbek', avatarEmoji: '👨', lessonsCompleted: 60, coins: 4250, lightning: 6200 },
  { id: 'e10', name: 'Nodira', avatarEmoji: '👩‍🦳', lessonsCompleted: 58, coins: 3900, lightning: 5900 },
  { id: 'e11', name: 'Jasur', avatarEmoji: '👦', lessonsCompleted: 55, coins: 3600, lightning: 5400 },
  { id: 'e12', name: 'Sitora', avatarEmoji: '👧', lessonsCompleted: 52, coins: 3200, lightning: 5000 },
  { id: 'e13', name: 'Otabek', avatarEmoji: '🧑‍🎓', lessonsCompleted: 48, coins: 2800, lightning: 4400 },
  { id: 'e14', name: 'Feruza', avatarEmoji: '👩‍🎓', lessonsCompleted: 44, coins: 2400, lightning: 3900 },
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

export type RankedLeaderboardEntry = LeaderboardEntry & { rank: number; displayCoins: number; displayLightning: number };

export function getRankedLeaderboard(
  period: LeaderboardPeriod,
  scope: LeaderboardScope,
  myCoins?: number,
  myLightning?: number
): RankedLeaderboardEntry[] {
  const factor = PERIOD_SCALE[period] * SCOPE_SCALE[scope];
  const entries = leaderboardEntries.map((e) =>
    e.id === ME_LEADERBOARD_ID
      ? { ...e, coins: myCoins ?? e.coins, lightning: myLightning ?? e.lightning }
      : e
  );
  // Reyting chaqmoq bo'yicha hisoblanadi — u faqat to'planadi, sarflanmaydi.
  // Coin sarflanishi mumkinligi uchun faqat ma'lumot sifatida ko'rsatiladi.
  const scaled = entries.map((e) => ({
    ...e,
    displayCoins: Math.max(1, Math.round(e.coins * factor)),
    displayLightning: Math.max(1, Math.round(e.lightning * factor)),
  }));
  scaled.sort((a, b) => b.displayLightning - a.displayLightning);
  return scaled.map((e, i) => ({ ...e, rank: i + 1 }));
}
