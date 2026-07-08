import { Platform } from 'react-native';

import type { GrammarBlank, HomeworkPart, SlideContent, SpeakingPrompt, VocabWord } from '@/data/lessonContent';

// Web uchun relative URL ishlaydi (server bir xil origin).
// Native uchun env dan yoki fallback URL ishlatiladi.
const API_BASE =
  Platform.OS === 'web'
    ? '/api/state/mobile-content'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/mobile-content';

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
  konspekt?: string;
  vocabulary?: VocabWord[];
  grammarBlanks?: GrammarBlank[];
  slides?: SlideContent[];
  speakingPractice?: SpeakingPrompt[];
  homeworkParts?: HomeworkPart[];
  updatedAt?: string;
};

export type MobileContent = {
  courses: AdminCourse[];
  lessons: AdminLesson[];
  modules: AdminModule[];
  moduleContents: AdminModuleContent[];
  lessonContents: Record<string, AdminLessonContent>;
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
  const files = contents.filter((c) => c.id !== videoContent?.id);
  return { videoUrl: videoContent?.url, files };
}
