import { Platform } from 'react-native';

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

export type MobileContent = {
  courses: AdminCourse[];
  lessons: AdminLesson[];
  modules: AdminModule[];
  moduleContents: AdminModuleContent[];
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
      };
      return _cache;
    })
    .finally(() => { _fetchPromise = null; });

  return _fetchPromise;
}

export function invalidateCache() {
  _cache = null;
}
