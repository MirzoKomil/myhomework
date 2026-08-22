import { Platform } from 'react-native';

import { getToken, ready } from '@/services/studentAuthStore';
import type { GrammarBlank, HomeworkPart, SlideContent, SpeakingPrompt, VocabWord } from '@/data/lessonContent';
import type { ShopProduct } from '@/data/shopProducts';
import type { GrammarTopic } from '@/data/grammarGuide';
import type { VocabTopic } from '@/data/vocabularyLibrary';
import type { PronunciationTopic } from '@/data/pronunciationTopics';
import type { SpeakingTopic } from '@/data/speakingTopics';
import type { PodcastEpisode } from '@/data/podcastEpisodes';
import type { BookStory } from '@/data/bookStories';

// Web uchun relative URL ishlaydi (server bir xil origin).
// Native uchun env dan yoki fallback URL ishlatiladi.
const API_BASE =
  Platform.OS === 'web'
    ? '/api/state/mobile-content'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/mobile-content';

const DEMO_GRADES_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-grades'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-grades';

// 40-vazifa: "Yordamchi ustozni haftalik baholash" — haqiqiy, serverda
// saqlanadigan tarix.
const DEMO_ASSISTANT_RATINGS_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-assistant-ratings'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-assistant-ratings';

const DEMO_SCHEDULE_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-schedule'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-schedule';

const DEMO_MESSAGES_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-messages'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-messages';

const DEMO_PEER_MESSAGES_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-peer-messages'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-peer-messages';

const DEMO_PERSONA_MESSAGES_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-persona-messages'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-persona-messages';

const DEMO_BOOK_DELIVERY_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-book-delivery'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-book-delivery';

const DEMO_NOTIFICATIONS_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-notifications'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-notifications';

const ABSENCE_REASON_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/notifications/absence-reason'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/notifications/absence-reason';

const HOMEWORK_RADIO_SCHEDULE_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/homework-radio-schedule'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/homework-radio-schedule';

const CONTENT_COMMENTS_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/content-comments'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/content-comments';

const DEMO_ACTIVITY_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-activity'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-activity';

const DEMO_CONTRACT_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-contract'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-contract';

const DEMO_CONTRACT_PDF_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-contract-pdf'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-contract-pdf';

const DEMO_PROFILE_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-profile'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-profile';

// 39-vazifa: "To'lovlar" ekrani uchun — Sotuv bo'limi bilan integratsiya
// qilingan haqiqiy qarzdorlik/to'lov tarixi.
const DEMO_PAYMENTS_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-payments'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-payments';

// 36-vazifa: haqiqiy Leaderboard uchun — o'quvchining o'z tanga/chaqmoq
// jamlanmasini serverga yuborish va real ro'yxatni olish.
const SYNC_PROGRESS_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/sync-progress'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/sync-progress';

const LEADERBOARD_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/leaderboard'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/leaderboard';

export type AdminCourse = {
  id: string;
  name: string;
  lang?: string;
  createdAt?: string;
};

export type AdminLesson = {
  id: string;
  courseId: string;
  name: string;
  isDemo?: boolean;
  isPaid?: boolean;
  isActive?: boolean;
  lock?: { enabled: boolean; requiredPercent?: number };
  attendanceTaken?: boolean;
  createdAt?: string;
};

export type AdminModule = {
  id: string;
  lessonId: string;
  courseId?: string;
  name: string;
  type?: string;
  status?: string;
  duration?: string;
  createdAt?: string;
};

export type AdminModuleContent = {
  id: string;
  moduleId: string;
  type: 'video' | 'pdf' | 'word' | 'image' | 'text';
  name?: string;
  url?: string;
  text?: string;
  createdAt?: string;
};

// CRM'da "Dars" tahrirlovchisi orqali kiritilgan real dars tarkibi — barcha
// maydonlar ixtiyoriy, chunki admin hali to'ldirmagan bo'lishi mumkin.
export type AdminLessonContent = {
  videoUrl?: string;
  konspekt?: string;
  vocabulary?: VocabWord[];
  grammarBlanks?: GrammarBlank[];
  slides?: SlideContent[];
  speakingPractice?: SpeakingPrompt[];
  homeworkParts?: HomeworkPart[];
  updatedAt?: string;
};

export type AdminExamQuestion =
  | { kind: 'multipleChoice'; id: string; question: string; options: string[]; correctIndex: number }
  | { kind: 'sentenceBuild'; id: string; translation: string; words: string[]; answer: string[] }
  | { kind: 'fillBlank'; id: string; sentence: string; answer: string; options: string[] }
  | { kind: 'speaking'; id: string; sentence: string; translation: string };

export type AdminExamContent = {
  passPercent?: number;
  questions?: AdminExamQuestion[];
  updatedAt?: string;
};

// Kutubxonaning 6 resurs turi uchun CRM'da tahrirlangan, statik
// ma'lumotlar bilan serverda allaqachon birlashtirilgan (resolved) ro'yxatlar
// — appda static import o'rniga shu yerdan o'qiladi. Talaffuz/Podkastlarga
// haqiqiy audioUrl, Speaking/Podkastlar/Kitoblarga esa coverUrl qo'shilishi
// mumkin (CRM'da yuklangan bo'lsa).
export type LibraryContent = {
  grammar: GrammarTopic[];
  words: VocabTopic[];
  pronunciation: (PronunciationTopic & { audioUrl?: string })[];
  speaking: (SpeakingTopic & { coverUrl?: string })[];
  podcasts: (PodcastEpisode & { coverUrl?: string; audioUrl?: string })[];
  books: (BookStory & { coverUrl?: string })[];
};

export type MobileContent = {
  courses: AdminCourse[];
  lessons: AdminLesson[];
  modules: AdminModule[];
  moduleContents: AdminModuleContent[];
  lessonContents: Record<string, AdminLessonContent>;
  examContents: Record<string, AdminExamContent>;
  certificateTemplateUrl?: string;
  // Homework Shop'ning haqiqiy mahsulotlari — statik SHOP_PRODUCTS bazasi
  // serverda CRM'ning shopOverrides'i bilan allaqachon birlashtirilgan
  // (resolved) holda keladi, appda qo'shimcha birlashtirish shart emas.
  shop: ShopProduct[];
  library: LibraryContent;
};

// 150-ish: haqiqiy o'quvchi login qilgan bo'lsa, uning tokeni har bir
// "demo-*" so'rovga qo'shiladi — server shu token orqali qaysi o'quvchi
// ekanini aniqlaydi (token yo'q bo'lsa, eskicha "Namuna o'quvchi" ma'lumoti
// qaytadi, hech qanday xatti-harakat o'zgarmaydi).
export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // 5-vazifa: token AsyncStorage'dan hali yuklanmagan bo'lishi mumkin
  // (ilova ochilgan ilk lahzalarda) — shuni kutmasak, birinchi so'rov
  // tokensiz ketib, server noto'g'ri (demo) o'quvchi ma'lumotini
  // qaytaradi va bu keshda qolib ketadi (masalan rus tili o'quvchisiga
  // ingliz tili kursi ko'rinishi kabi buglarga sabab bo'ladi).
  await ready();
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

let _cache: MobileContent | null = null;
let _cacheFetchedAt = 0;
let _fetchPromise: Promise<MobileContent> | null = null;

// O'quvchi ilovani bir marta ochib, uni kunlar davomida fon rejimida ochiq
// qoldirishi mumkin (mobil qurilmalar ilovani o'chirmaydi, faqat fon
// rejimiga o'tkazadi) — shunday uzoq sessiyalarda kesh muddati bo'lmasa,
// CRM'da kiritilgan HECH QANDAY yangilanish (masalan test to'g'ri javobini
// tuzatish) o'sha sessiyaga umuman yetib bormaydi. Shu sabab kesh
// belgilangan vaqtdan keyin eskirgan deb hisoblanadi va avtomatik qayta
// yuklanadi — o'quvchi hech narsa qilishi shart emas.
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchMobileContent(): Promise<MobileContent> {
  if (_cache && Date.now() - _cacheFetchedAt < CACHE_TTL_MS) return _cache;
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = authedFetch(API_BASE)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data: MobileContent) => {
      _cache = {
        courses: data.courses ?? [],
        lessons: data.lessons ?? [],
        modules: data.modules ?? [],
        moduleContents: data.moduleContents ?? [],
        lessonContents: data.lessonContents ?? {},
        examContents: data.examContents ?? {},
        certificateTemplateUrl: data.certificateTemplateUrl,
        shop: data.shop ?? [],
        library: {
          grammar: data.library?.grammar ?? [],
          words: data.library?.words ?? [],
          pronunciation: data.library?.pronunciation ?? [],
          speaking: data.library?.speaking ?? [],
          podcasts: data.library?.podcasts ?? [],
          books: data.library?.books ?? [],
        },
      };
      _cacheFetchedAt = Date.now();
      return _cache;
    })
    .finally(() => { _fetchPromise = null; });

  return _fetchPromise;
}

export function invalidateCache() {
  _cache = null;
  _cacheFetchedAt = 0;
}

// CRM'da darsga biriktirilgan video va boshqa fayllarni (pdf/word/rasm/matn)
// ilova tomonida ko'rsatish uchun ajratib beradi.
export type LessonMaterials = {
  videoUrl?: string;
  files: AdminModuleContent[];
};

export function getLessonMaterials(mc: MobileContent, lessonId: string): LessonMaterials {
  const moduleIds = new Set(mc.modules.filter((m) => m.lessonId === lessonId).map((m) => m.id));
  const contents = mc.moduleContents.filter((c) => moduleIds.has(c.moduleId));
  const videoContent = contents.find((c) => c.type === 'video' && c.url);
  // "Videodars" bo'limida to'g'ridan-to'g'ri kiritilgan videoUrl — eski modul-asosli
  // videodan ustun turadi, chunki endi toq raqamli darslarda video shu yerdan boshqariladi.
  const videoUrl = mc.lessonContents[lessonId]?.videoUrl || videoContent?.url;
  const files = contents.filter((c) => c.id !== videoContent?.id);
  return { videoUrl, files };
}

// Ustoz CRM'da o'zining kabinetidan davomat qilib, o'quvchini "qatnashdi" deb
// belgilaganda majburiy kiritgan jonli dars bahosi — faqat CRM'da "Namuna
// o'quvchi" deb belgilangan bitta o'quvchi uchun (boshqa o'quvchilarning
// ma'lumotlari bu public endpoint orqali hech qachon oshkor qilinmaydi).
export type StudentRatingOfTeacher = {
  explanation: number;
  punctuality: number;
  techQuality: number;
  engagement: number;
  overall: number;
};

export type LiveGradeEntry = {
  date: string;
  teacherId: string;
  lessonId: string;
  lessonName: string;
  scores: { attendance: number; activity: number; speaking: number; understanding: number; discipline: number };
  studentRatingOfTeacher?: StudentRatingOfTeacher;
};

export type DemoGradesResponse = {
  grades: LiveGradeEntry[];
  teacherRating: number | null;
};

export async function fetchDemoGrades(): Promise<DemoGradesResponse> {
  const r = await authedFetch(DEMO_GRADES_API_BASE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return { grades: data.grades ?? [], teacherRating: data.teacherRating ?? null };
}

// O'quvchi ilovada "Siz ustozni baholang" formasini yuborganda shu yerga
// yozadi — qaysi o'quvchi ekanligini server har doim CRM'da belgilangan
// "Namuna o'quvchi"dan aniqlaydi, mijozdan kelgan hech qanday ID'ga
// ishonilmaydi.
export async function submitTeacherRating(date: string, ratings: StudentRatingOfTeacher): Promise<void> {
  const r = await authedFetch(`${DEMO_GRADES_API_BASE}/rate-teacher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, ratings }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'Xatolik' }));
    throw new Error(err.error || 'Xatolik');
  }
}

export type AssistantRatingValues = { contact: number; speed: number; help: number; motivation: number; overall: number };

// 40-vazifa: o'quvchining yordamchi ustozini har hafta baholashi — haqiqiy,
// serverda saqlanadigan tarix (avval mahalliy holatda, ilova qayta
// ochilganda yo'qoladigan/hech qachon saqlanmagan edi).
export async function fetchAssistantRatings(): Promise<Record<string, AssistantRatingValues>> {
  const r = await authedFetch(DEMO_ASSISTANT_RATINGS_API_BASE);
  if (!r.ok) return {};
  const data = await r.json();
  return data?.ratings && typeof data.ratings === 'object' ? data.ratings : {};
}

export async function submitAssistantRating(weekKey: string, ratings: AssistantRatingValues): Promise<void> {
  const r = await authedFetch(DEMO_ASSISTANT_RATINGS_API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekKey, ratings }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'Xatolik' }));
    throw new Error(err.error || 'Xatolik');
  }
}

// Bosh sahifadagi eslatma kartochkasi uchun — CRM'da "Namuna o'quvchi" deb
// belgilangan bitta o'quvchining Telegram guruh havolasi va navbatdagi
// speaking dars vaqtini qaytaradi (haqiqiy dars kuni/soatidan hisoblanadi).
export type DemoScheduleResponse = {
  telegramGroupLink: string;
  topic: string;
  startsAt: string | null;
  // 123-ish: "Jadval va davomat" ekranini o'quvchining haqiqiy o'qish
  // boshlagan kuni va asosiy ustozining haftalik dars kunlari patterniga
  // (mwf/tts) qurish uchun.
  courseStartDate: string | null;
  schedulePattern: 'mwf' | 'tts';
  lessonDayOfWeek: number | null;
  lessonTime: string;
};

// 40-vazifa: Bosh sahifa/Profil ekranlaridagi ism va ID ilgari hardcode
// qilingan namuna ("Shahzoda Mavlonova") edi — endi CRM'da haqiqatan
// tanlangan (yoki real login qilgan) o'quvchining o'z ismi/ID/kurs
// tilini qaytaradi.
export type DemoProfileResponse = {
  name: string;
  studentId: string;
  lang: 'english' | 'russian';
  // 35-vazifa: "Davomat" va "Vaqt" kartochkalari uchun — haqiqiy davomat
  // yozuvlaridan hisoblangan foiz va soat (namuna qiymatlar emas).
  attendanceRate: number;
  hoursSpent: number;
  // 11-vazifa: "Profilni tahrirlash" ekrani uchun — CRM'da saqlangan
  // haqiqiy qiymatlar (namuna ma'lumot emas).
  phone: string;
  age: number | null;
  gender: 'erkak' | 'ayol' | '';
  address: string;
  // 13-vazifa: "Mening ustozim" ekrani uchun — o'quvchiga CRM'da
  // haqiqatan biriktirilgan asosiy/yordamchi ustoz.
  mainTeacherName: string;
  mainTeacherPhone: string;
  assistantTeacherName: string;
  assistantTeacherPhone: string;
};

export async function fetchDemoStudentProfile(): Promise<DemoProfileResponse | null> {
  const r = await authedFetch(DEMO_PROFILE_API_BASE);
  if (!r.ok) return null;
  const data = await r.json();
  if (!data?.name) return null;
  return {
    name: data.name,
    studentId: data.studentId ?? '',
    lang: data.lang === 'russian' ? 'russian' : 'english',
    attendanceRate: Number(data.attendanceRate) || 0,
    hoursSpent: Number(data.hoursSpent) || 0,
    phone: data.phone ?? '',
    age: data.age != null ? Number(data.age) : null,
    gender: data.gender === 'erkak' || data.gender === 'ayol' ? data.gender : '',
    address: data.address ?? '',
    mainTeacherName: data.mainTeacherName ?? '',
    mainTeacherPhone: data.mainTeacherPhone ?? '',
    assistantTeacherName: data.assistantTeacherName ?? '',
    assistantTeacherPhone: data.assistantTeacherPhone ?? '',
  };
}

export type DemoPaymentEntry = {
  id: string;
  date: string;
  amount: number;
  paid: number;
  debt: number;
  tariffLabel: string;
};

export type DemoPaymentsResponse = {
  tariffLabel: string;
  lessonDuration: number;
  monthlyAmount: number;
  courseStartDate: string | null;
  salesManagerName: string;
  debtAmount: number;
  paymentDueDate: string | null;
  history: DemoPaymentEntry[];
};

// 39-vazifa: "To'lovlar" ekrani ilgari to'liq namuna (fake) ma'lumot
// ko'rsatardi — endi Sotuv bo'limi bilan integratsiya qilingan haqiqiy
// qarzdorlik va Moliya bo'limidagi haqiqiy to'lov tarixini qaytaradi.
export async function fetchDemoStudentPayments(): Promise<DemoPaymentsResponse | null> {
  const r = await authedFetch(DEMO_PAYMENTS_API_BASE);
  if (!r.ok) return null;
  const data = await r.json();
  return {
    tariffLabel: data.tariffLabel || 'Standard',
    lessonDuration: Number(data.lessonDuration) || 15,
    monthlyAmount: Number(data.monthlyAmount) || 0,
    courseStartDate: data.courseStartDate ?? null,
    salesManagerName: data.salesManagerName || '',
    debtAmount: Number(data.debtAmount) || 0,
    paymentDueDate: data.paymentDueDate ?? null,
    history: Array.isArray(data.history) ? data.history : [],
  };
}

// 36-vazifa: mobil ilova tanga/chaqmoq to'plaganda o'z jamlanma summasini
// serverga yuboradi — bu Leaderboardni haqiqiy qiladi. Tarmoq xatoligi
// bo'lsa jim o'tkazib yuboriladi (mahalliy AsyncStorage baribir to'g'ri).
export async function syncStudentProgress(partial: {
  coins?: number;
  lightning?: number;
  // 37-vazifa: Kunlik/Haftalik/Oylik reyting uchun — shu chaqiruvda
  // QANCHA qo'shilgani (umumiy summa emas).
  coinsDelta?: number;
  lightningDelta?: number;
}): Promise<void> {
  try {
    await authedFetch(SYNC_PROGRESS_API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
  } catch {
    // ignore — keyingi o'zgarishda qayta urinilaveradi.
  }
}

export type LeaderboardEntryResponse = {
  id: string;
  name: string;
  coins: number;
  lightning: number;
  lessonsCompleted: number;
  rank: number;
  isMe: boolean;
  // 12-vazifa: o'quvchi o'zi qo'ygan profil rasmi (bo'lsa) — bo'lmasa
  // bo'sh, ilova ism asosidagi avatarga tushadi.
  avatarUrl?: string;
};

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'alltime';

export async function fetchLeaderboard(
  scope: 'region' | 'country',
  period: LeaderboardPeriod = 'alltime'
): Promise<LeaderboardEntryResponse[]> {
  const r = await authedFetch(`${LEADERBOARD_API_BASE}?scope=${scope}&period=${period}`);
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data?.entries) ? data.entries : [];
}

export async function fetchDemoSchedule(): Promise<DemoScheduleResponse> {
  const r = await authedFetch(DEMO_SCHEDULE_API_BASE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return {
    telegramGroupLink: data.telegramGroupLink ?? '',
    topic: data.topic ?? '',
    startsAt: data.startsAt ?? null,
    courseStartDate: data.courseStartDate ?? null,
    schedulePattern: data.schedulePattern === 'tts' ? 'tts' : 'mwf',
    lessonDayOfWeek: data.lessonDayOfWeek ?? null,
    lessonTime: data.lessonTime ?? '',
  };
}

// "Muloqot" bo'limidagi Qo'llab-quvvatlash/Asosiy ustoz/Yordamchi ustoz
// suhbatlari — CRM'da "Namuna o'quvchi" deb belgilangan bitta o'quvchi
// uchun haqiqiy, serverda saqlanadigan xabarlar. Boshqa hech qanday
// o'quvchi ma'lumoti bu orqali oshkor qilinmaydi.
export type DemoMessageThreadId = 'support' | 'main-teacher' | 'assistant-teacher';

export type DemoMessage = {
  id: string;
  threadId: DemoMessageThreadId;
  sender: 'student' | 'teacher' | 'admin';
  senderId?: string | null;
  senderName?: string;
  type: 'text';
  text?: string;
  time: string;
};

export type DemoMessagesResponse = {
  support: DemoMessage[];
  mainTeacher: DemoMessage[];
  assistantTeacher: DemoMessage[];
};

export async function fetchDemoMessages(): Promise<DemoMessagesResponse> {
  const r = await authedFetch(DEMO_MESSAGES_API_BASE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return {
    support: data.support ?? [],
    mainTeacher: data.mainTeacher ?? [],
    assistantTeacher: data.assistantTeacher ?? [],
  };
}

export async function sendDemoMessage(threadId: DemoMessageThreadId, text: string): Promise<DemoMessage> {
  const r = await authedFetch(DEMO_MESSAGES_API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId, text }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'Xatolik' }));
    throw new Error(err.error || 'Xatolik');
  }
  const data = await r.json();
  return data.message;
}

// "Maqsaddoshlar" (hamkurs) suhbatlari — CRM'da "Namuna o'quvchi" deb
// belgilangan bitta o'quvchi uchun haqiqiy, serverda saqlanadigan xabarlar.
// CRM tomonda hamkurs ismi (best-effort) haqiqiy o'quvchi yozuviga
// bog'lanadi va admin o'z profilidan shu hamkurs nomidan javob yozishi mumkin.
export type DemoPeerMessage = {
  id: string;
  sender: 'student' | 'peer';
  senderName?: string;
  type: 'text';
  text?: string;
  time: string;
};

export type DemoPeerThread = {
  peerName: string;
  linkedStudentId: string | null;
  messages: DemoPeerMessage[];
};

export type DemoPeerMessagesResponse = Record<string, DemoPeerThread>;

export async function fetchDemoPeerMessages(): Promise<DemoPeerMessagesResponse> {
  const r = await authedFetch(DEMO_PEER_MESSAGES_API_BASE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function sendDemoPeerMessage(peerId: string, peerName: string, text: string): Promise<DemoPeerMessage> {
  const r = await authedFetch(DEMO_PEER_MESSAGES_API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ peerId, peerName, text }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'Xatolik' }));
    throw new Error(err.error || 'Xatolik');
  }
  const data = await r.json();
  return data.message;
}

// "Afsonalar" (Legends) — namuna o'quvchining AI-personajlar bilan
// suhbatlari. peerMessages bilan bir xil naqsh, lekin sender aniq
// ko'rsatiladi ('student'/'persona') va linkedStudentId yo'q.
export type DemoPersonaMessage = {
  id: string;
  sender: 'student' | 'persona';
  type: 'text';
  text?: string;
  time: string;
};

export type DemoPersonaThread = {
  personaName: string;
  messages: DemoPersonaMessage[];
};

export type DemoPersonaMessagesResponse = Record<string, DemoPersonaThread>;

export async function fetchDemoPersonaMessages(): Promise<DemoPersonaMessagesResponse> {
  const r = await authedFetch(DEMO_PERSONA_MESSAGES_API_BASE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function sendDemoPersonaMessage(
  personaId: string,
  personaName: string,
  text: string,
  sender: 'student' | 'persona'
): Promise<DemoPersonaMessage> {
  const r = await authedFetch(DEMO_PERSONA_MESSAGES_API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personaId, personaName, text, sender }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'Xatolik' }));
    throw new Error(err.error || 'Xatolik');
  }
  const data = await r.json();
  return data.message;
}

// 141-ish: "Bildirishnomalar" — CRM'da yoqilgan avtomatik eslatma qoidalari
// (masalan dars boshlanishidan oldin) haqiqiy jadval ma'lumotidan hisoblab
// chiqarilib, admin qo'lda yuborgan xabarlar bilan bitta ro'yxatga
// birlashtirilib qaytariladi. Faqat CRM'da "Namuna o'quvchi" deb belgilangan
// bitta o'quvchi uchun.
export type DemoNotification = {
  id: string;
  category: 'news' | 'lessons';
  source: 'auto' | 'system' | 'manual';
  title: string;
  message: string;
  date: string;
  unread: boolean;
  interactive?: 'attendance' | 'rate-teacher';
  lessonDate?: string;
};

export async function fetchDemoNotifications(): Promise<DemoNotification[]> {
  const r = await authedFetch(DEMO_NOTIFICATIONS_API_BASE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// 142-ish: o'quvchi "Darsni nega qoldirdingiz?" so'rovnomasiga javob berganda.
export async function submitAbsenceReason(lessonDate: string, reason: string): Promise<void> {
  const r = await authedFetch(ABSENCE_REASON_API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lessonDate, reason }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'Xatolik' }));
    throw new Error(err.error || 'Xatolik');
  }
}

// 144-ish: "Homework Radio" haqiqiy dastur jadvali — CRM'da yuklangan audio
// kliplarni haqiqiy sana + soat oralig'iga bog'laydi. Kalit — kalendar sanasi
// ("YYYY-MM-DD"), takrorlanadigan shablon emas.
export type HomeworkRadioBlock = {
  id: string;
  title: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  audioUrl: string;
};

export type HomeworkRadioSchedule = Record<string, HomeworkRadioBlock[]>;

export async function fetchHomeworkRadioSchedule(): Promise<HomeworkRadioSchedule> {
  const r = await fetch(HOMEWORK_RADIO_SCHEDULE_API_BASE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// Toshkent vaqtiga moslashtirilgan (+5 soat) — 142-ish'dagi `tashkentNow()`
// bilan bir xil yondashuv, server bilan bir xil "bugun"ni ko'rish uchun.
export function getHomeworkRadioTodayKey(now: Date = new Date(Date.now() + 5 * 60 * 60 * 1000)): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

// Berilgan jadval va vaqt uchun hozir "efirda" bo'lishi kerak bo'lgan
// klipni topadi — topilmasa (hech narsa rejalashtirilmagan bo'lsa) null.
export function getActiveHomeworkRadioBlock(
  schedule: HomeworkRadioSchedule,
  now: Date = new Date(Date.now() + 5 * 60 * 60 * 1000)
): HomeworkRadioBlock | null {
  const todayStr = getHomeworkRadioTodayKey(now);
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const blocks = schedule[todayStr] || [];
  for (const b of blocks) {
    const [sh, sm] = b.startTime.split(':').map(Number);
    const [eh, em] = b.endTime.split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (nowMinutes >= start && nowMinutes < end) return b;
  }
  return null;
}

// 145-ish: "Izohlar" — hozircha radio stansiyalari uchun. `parentId` orqali
// istalgan izohga (o'quvchiniki yoki adminniki) javob yozish mumkin.
export type ContentComment = {
  id: string;
  category: string;
  itemId: string;
  itemLabel: string;
  authorName: string;
  text: string;
  createdAt: string;
  parentId: string | null;
  isAdmin: boolean;
};

export async function fetchContentComments(category: string, itemId: string): Promise<ContentComment[]> {
  const r = await fetch(CONTENT_COMMENTS_API_BASE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const all: ContentComment[] = await r.json();
  return all.filter((c) => c.category === category && c.itemId === itemId);
}

export async function addContentComment(
  category: string,
  itemId: string,
  itemLabel: string,
  authorName: string,
  text: string,
  parentId?: string
): Promise<ContentComment> {
  const r = await fetch(CONTENT_COMMENTS_API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, itemId, itemLabel, authorName, text, parentId: parentId ?? null }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'Xatolik' }));
    throw new Error(err.error || 'Xatolik');
  }
  const data = await r.json();
  return data.comment;
}

// Server faqat matn qaytaradi — UI ko'rinishi (rang/emoji) manba turiga
// qarab shu yerda beriladi, `AppNotification` shakliga moslashtirib.
export function toAppNotification(n: DemoNotification): {
  id: string;
  category: 'news' | 'lessons';
  date: string;
  title: string;
  message: string;
  detail: string;
  unread: boolean;
  colors: [string, string];
  emoji: string;
  interactive?: 'attendance' | 'rate-teacher';
  lessonDate?: string;
} {
  const isAuto = n.source === 'auto';
  return {
    id: n.id,
    category: n.category,
    date: new Date(n.date).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    title: n.title,
    message: n.message,
    detail: n.message,
    unread: n.unread,
    colors: isAuto ? ['#7C3AED', '#5B21B6'] : ['#3B82F6', '#2563EB'],
    emoji: isAuto ? '🔔' : '📣',
    interactive: n.interactive,
    lessonDate: n.lessonDate,
  };
}

// "Yetkazib berish xizmati → Kitob yetkazish" ekrani uchun — CRM'ning
// Sotuv bo'limidagi "Kitob yetkazish" kanban-yozuvidan (bookRoadmap) olingan
// haqiqiy holat. Faqat CRM'da "Namuna o'quvchi" deb belgilangan bitta
// o'quvchi uchun — mos yozuv topilmasa null.
export type DemoBookDeliveryResponse = {
  address: string;
  stage: 'preparing' | 'dispatched' | 'in_transit' | 'delivered';
  dispatchedDate: string | null;
  deliveredDate: string | null;
  lang: 'english' | 'russian';
  studentId: string;
} | null;

export async function fetchDemoBookDelivery(): Promise<DemoBookDeliveryResponse> {
  const r = await authedFetch(DEMO_BOOK_DELIVERY_API_BASE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// 125-ish: o'quvchi imtihon/uyga vazifa/video/lug'at mashqini yakunlaganda
// haqiqiy natijasini (ball, to'g'ri/adashgan, xatolar) shu yerga yozadi —
// ustoz o'z kabinetidan va admin profilidan bularni kuzatib turishi uchun.
// Faqat CRM'da "Namuna o'quvchi" deb belgilangan bitta o'quvchi uchun.
export type ActivityMistake = { question: string; yourAnswer: string; correctAnswer: string };

export type DemoActivityEntry = {
  id: string;
  type: 'exam' | 'homework' | 'video' | 'vocab';
  label: string;
  scorePercent: number | null;
  passed: boolean | null;
  wrongAttempts: number | null;
  mistakes: ActivityMistake[];
  time: string;
};

export async function fetchDemoActivity(): Promise<DemoActivityEntry[]> {
  const r = await authedFetch(DEMO_ACTIVITY_API_BASE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function sendDemoActivity(entry: {
  type: DemoActivityEntry['type'];
  label: string;
  scorePercent?: number;
  passed?: boolean;
  wrongAttempts?: number;
  mistakes?: ActivityMistake[];
}): Promise<void> {
  const r = await authedFetch(DEMO_ACTIVITY_API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
}

// 6-vazifa: "To'lovlar" ekranidagi shartnoma raqami/sanasi — lid
// o'quvchiga aylanganda CRM tomonidan avtomatik biriktirilgan haqiqiy
// qiymatlar (PDF fayldagi bilan bir xil bo'lishi uchun).
export type DemoContractResponse = { number: string | null; date: string | null };

export async function fetchDemoContract(): Promise<DemoContractResponse> {
  const r = await authedFetch(DEMO_CONTRACT_API_BASE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// PDF havolasi Linking.openURL bilan to'g'ridan-to'g'ri ochiladi — bunda
// maxsus Authorization sarlavhasi yuborib bo'lmaydi, shuning uchun token
// query-parametr sifatida qo'shiladi (server buni ham qabul qiladi).
export function getContractPdfUrl(): string {
  const token = getToken();
  return token ? `${DEMO_CONTRACT_PDF_API_BASE}?token=${encodeURIComponent(token)}` : DEMO_CONTRACT_PDF_API_BASE;
}
