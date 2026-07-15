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
  const r = await fetch(DEMO_PERSONA_MESSAGES_API_BASE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function sendDemoPersonaMessage(
  personaId: string,
  personaName: string,
  text: string,
  sender: 'student' | 'persona'
): Promise<DemoPersonaMessage> {
  const r = await fetch(DEMO_PERSONA_MESSAGES_API_BASE, {
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
  const r = await fetch(DEMO_NOTIFICATIONS_API_BASE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// 142-ish: o'quvchi "Darsni nega qoldirdingiz?" so'rovnomasiga javob berganda.
export async function submitAbsenceReason(lessonDate: string, reason: string): Promise<void> {
  const r = await fetch(ABSENCE_REASON_API_BASE, {
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

// Berilgan jadval va vaqt uchun hozir "efirda" bo'lishi kerak bo'lgan
// klipni topadi — topilmasa (hech narsa rejalashtirilmagan bo'lsa) null.
// Toshkent vaqtiga moslashtirilgan (+5 soat) — 142-ish'dagi `tashkentNow()`
// bilan bir xil yondashuv, server bilan bir xil "bugun"ni ko'rish uchun.
export function getActiveHomeworkRadioBlock(
  schedule: HomeworkRadioSchedule,
  now: Date = new Date(Date.now() + 5 * 60 * 60 * 1000)
): HomeworkRadioBlock | null {
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
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
