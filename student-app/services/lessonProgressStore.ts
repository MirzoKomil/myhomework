import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'mh_lesson_progress';

export type LessonProgress = {
  videoWatch: boolean;
  videoExercises: boolean;
  slidesWatch: boolean;
  speakingExercises: boolean;
  vocabList: boolean;
  vocabPractice: boolean;
  homeworkParts: Record<string, boolean>;
};

const EMPTY: LessonProgress = {
  videoWatch: false,
  videoExercises: false,
  slidesWatch: false,
  speakingExercises: false,
  vocabList: false,
  vocabPractice: false,
  homeworkParts: {},
};

type Store = Record<string, LessonProgress>;

let cache: Store = {};
let loaded = false;
let loadPromise: Promise<void> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(KEY)
      .then((raw) => {
        cache = raw ? JSON.parse(raw) : {};
      })
      .catch(() => {
        cache = {};
      })
      .finally(() => {
        loaded = true;
      });
  }
  return loadPromise;
}

async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Xotiraga yozib bo'lmasa (masalan, maxfiy rejim) — jim o'tkazib yuboramiz.
  }
}

export function getLessonProgress(lessonId: string): LessonProgress {
  return cache[lessonId] ?? EMPTY;
}

export async function loadLessonProgress(): Promise<void> {
  await ensureLoaded();
  notify();
}

export async function markDone(lessonId: string, key: keyof Omit<LessonProgress, 'homeworkParts'>) {
  await ensureLoaded();
  const current = cache[lessonId] ?? { ...EMPTY, homeworkParts: {} };
  cache[lessonId] = { ...current, [key]: true };
  notify();
  await persist();
}

export async function markHomeworkPartDone(lessonId: string, partId: string) {
  await ensureLoaded();
  const current = cache[lessonId] ?? { ...EMPTY, homeworkParts: {} };
  cache[lessonId] = { ...current, homeworkParts: { ...current.homeworkParts, [partId]: true } };
  notify();
  await persist();
}

export type ProgressCategory = 'video' | 'speaking' | 'vocabulary' | 'homework';

export function getCategoryProgress(lessonId: string, category: ProgressCategory, totalHomeworkParts = 0): number {
  const p = getLessonProgress(lessonId);
  if (category === 'video') {
    const done = [p.videoWatch, p.videoExercises].filter(Boolean).length;
    return Math.round((done / 2) * 100);
  }
  if (category === 'speaking') {
    const done = [p.slidesWatch, p.speakingExercises].filter(Boolean).length;
    return Math.round((done / 2) * 100);
  }
  if (category === 'vocabulary') {
    const done = [p.vocabList, p.vocabPractice].filter(Boolean).length;
    return Math.round((done / 2) * 100);
  }
  if (totalHomeworkParts === 0) return 0;
  const done = Object.values(p.homeworkParts).filter(Boolean).length;
  return Math.round((done / totalHomeworkParts) * 100);
}

export function useLessonProgress(lessonId: string): LessonProgress {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadLessonProgress().then(() => setTick((t) => t + 1));
    return subscribe(() => setTick((t) => t + 1));
  }, [lessonId]);
  return getLessonProgress(lessonId);
}
