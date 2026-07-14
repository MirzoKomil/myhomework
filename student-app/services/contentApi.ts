import { Platform } from 'react-native';

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

const DEMO_BOOK_DELIVERY_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-book-delivery'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-book-delivery';

const DEMO_ACTIVITY_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-activity'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-activity';

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

let _cache: MobileContent | null = null;
let _fetchPromise: Promise<MobileContent> | null = null;

export async function fetchMobileContent(): Promise<MobileContent> {
  if (_cache) return _cache;
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = fetch(API_BASE)
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
      return _cache;
    })
    .finally(() => { _fetchPromise = null; });

  return _fetchPromise;
}

export function invalidateCache() {
  _cache = null;
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
  const r = await fetch(DEMO_GRADES_API_BASE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return { grades: data.grades ?? [], teacherRating: data.teacherRating ?? null };
}

// O'quvchi ilovada "Siz ustozni baholang" formasini yuborganda shu yerga
// yozadi — qaysi o'quvchi ekanligini server har doim CRM'da belgilangan
// "Namuna o'quvchi"dan aniqlaydi, mijozdan kelgan hech qanday ID'ga
// ishonilmaydi.
export async function submitTeacherRating(date: string, ratings: StudentRatingOfTeacher): Promise<void> {
  const r = await fetch(`${DEMO_GRADES_API_BASE}/rate-teacher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, ratings }),
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

export async function fetchDemoSchedule(): Promise<DemoScheduleResponse> {
  const r = await fetch(DEMO_SCHEDULE_API_BASE);
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
  const r = await fetch(DEMO_MESSAGES_API_BASE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return {
    support: data.support ?? [],
    mainTeacher: data.mainTeacher ?? [],
    assistantTeacher: data.assistantTeacher ?? [],
  };
}

export async function sendDemoMessage(threadId: DemoMessageThreadId, text: string): Promise<DemoMessage> {
  const r = await fetch(DEMO_MESSAGES_API_BASE, {
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
  const r = await fetch(DEMO_PEER_MESSAGES_API_BASE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function sendDemoPeerMessage(peerId: string, peerName: string, text: string): Promise<DemoPeerMessage> {
  const r = await fetch(DEMO_PEER_MESSAGES_API_BASE, {
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

// "Yetkazib berish xizmati → Kitob yetkazish" ekrani uchun — CRM'ning
// Sotuv bo'limidagi "Kitob yetkazish" kanban-yozuvidan (bookRoadmap) olingan
// haqiqiy holat. Faqat CRM'da "Namuna o'quvchi" deb belgilangan bitta
// o'quvchi uchun — mos yozuv topilmasa null.
export type DemoBookDeliveryResponse = {
  address: string;
  stage: 'preparing' | 'dispatched' | 'in_transit' | 'delivered';
  dispatchedDate: string | null;
  deliveredDate: string | null;
} | null;

export async function fetchDemoBookDelivery(): Promise<DemoBookDeliveryResponse> {
  const r = await fetch(DEMO_BOOK_DELIVERY_API_BASE);
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
  const r = await fetch(DEMO_ACTIVITY_API_BASE);
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
  const r = await fetch(DEMO_ACTIVITY_API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
}
