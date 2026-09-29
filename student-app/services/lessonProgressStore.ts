import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

import { getStudent, getToken, ready as authReady } from '@/services/studentAuthStore';

const KEY = 'mh_lesson_progress';
const LEGACY_OWNER_KEY = 'mh_lesson_progress_legacy_owner';
const LESSON_PROGRESS_API =
  Platform.OS === 'web'
    ? '/api/state/lesson-progress'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/lesson-progress';

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
let activeIdentity = '';
let activeStorageKey = KEY;
let lastServerSyncAt = 0;
const SERVER_REFRESH_MS = 30_000;
const UNSAFE_PROGRESS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function normalizeStore(raw: unknown): Store {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Store = {};
  Object.entries(raw as Record<string, unknown>).forEach(([lessonId, value]) => {
    if (UNSAFE_PROGRESS_KEYS.has(lessonId) || !value || typeof value !== 'object' || Array.isArray(value)) return;
    const v = value as Partial<LessonProgress>;
    const homeworkParts: Record<string, boolean> = {};
    if (v.homeworkParts && typeof v.homeworkParts === 'object' && !Array.isArray(v.homeworkParts)) {
      Object.entries(v.homeworkParts).forEach(([partId, done]) => {
        if (!UNSAFE_PROGRESS_KEYS.has(partId) && done === true) homeworkParts[partId] = true;
      });
    }
    result[lessonId] = {
      videoWatch: v.videoWatch === true,
      videoExercises: v.videoExercises === true,
      slidesWatch: v.slidesWatch === true,
      speakingExercises: v.speakingExercises === true,
      vocabList: v.vocabList === true,
      vocabPractice: v.vocabPractice === true,
      homeworkParts,
    };
  });
  return result;
}

function mergeStores(a: Store, b: Store): Store {
  const merged: Store = {};
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach((lessonId) => {
    const x = a[lessonId] ?? EMPTY;
    const y = b[lessonId] ?? EMPTY;
    merged[lessonId] = {
      videoWatch: x.videoWatch || y.videoWatch,
      videoExercises: x.videoExercises || y.videoExercises,
      slidesWatch: x.slidesWatch || y.slidesWatch,
      speakingExercises: x.speakingExercises || y.speakingExercises,
      vocabList: x.vocabList || y.vocabList,
      vocabPractice: x.vocabPractice || y.vocabPractice,
      homeworkParts: { ...x.homeworkParts, ...y.homeworkParts },
    };
  });
  return merged;
}

async function prepareIdentity(): Promise<void> {
  await authReady();
  const studentId = getStudent()?.id;
  const identity = studentId ? `student:${studentId}` : 'guest';
  if (identity === activeIdentity) return;
  activeIdentity = identity;
  activeStorageKey = studentId ? `${KEY}:${studentId}` : KEY;
  cache = {};
  loaded = false;
  loadPromise = null;
  lastServerSyncAt = 0;
}

async function ensureLoaded(): Promise<void> {
  await prepareIdentity();
  if (loaded) return;
  if (!loadPromise) {
    const identityAtStart = activeIdentity;
    const keyAtStart = activeStorageKey;
    loadPromise = Promise.all([
      AsyncStorage.getItem(keyAtStart),
      identityAtStart === 'guest' ? Promise.resolve(null) : AsyncStorage.getItem(KEY),
      identityAtStart === 'guest' ? Promise.resolve(null) : AsyncStorage.getItem(LEGACY_OWNER_KEY),
    ])
      .then(async ([scopedRaw, legacyRaw, legacyOwner]) => {
        if (identityAtStart !== activeIdentity) return;
        if (scopedRaw) {
          cache = normalizeStore(JSON.parse(scopedRaw));
          return;
        }
        const mayClaimLegacy = legacyRaw && (!legacyOwner || legacyOwner === identityAtStart);
        cache = mayClaimLegacy ? normalizeStore(JSON.parse(legacyRaw)) : {};
        if (mayClaimLegacy) {
          await Promise.all([
            AsyncStorage.setItem(keyAtStart, JSON.stringify(cache)),
            AsyncStorage.setItem(LEGACY_OWNER_KEY, identityAtStart),
          ]);
        }
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
    await AsyncStorage.setItem(activeStorageKey, JSON.stringify(cache));
  } catch {
    // Xotiraga yozib bo'lmasa (masalan, maxfiy rejim) — jim o'tkazib yuboramiz.
  }
}

export function getLessonProgress(lessonId: string): LessonProgress {
  return cache[lessonId] ?? EMPTY;
}

async function syncWithServer(force = false): Promise<void> {
  await ensureLoaded();
  const token = getToken();
  if (!token || activeIdentity === 'guest') return;
  if (!force && Date.now() - lastServerSyncAt < SERVER_REFRESH_MS) return;

  const identityAtStart = activeIdentity;
  const snapshot = cache;
  try {
    const response = await fetch(LESSON_PROGRESS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ progress: snapshot }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (identityAtStart !== activeIdentity) return;
    cache = mergeStores(cache, normalizeStore(data.progress));
    lastServerSyncAt = Date.now();
    notify();
    await persist();
  } catch {
    // Offline holatda lokal progress ishlashda davom etadi. Keyingi ekran
    // ochilishi yoki keyingi bajarilgan bosqich serverga yana urinadi.
    lastServerSyncAt = 0;
  }
}

export async function loadLessonProgress(forceServerRefresh = false): Promise<void> {
  await ensureLoaded();
  await syncWithServer(forceServerRefresh);
  notify();
}

export async function markDone(lessonId: string, key: keyof Omit<LessonProgress, 'homeworkParts'>) {
  await ensureLoaded();
  const current = cache[lessonId] ?? { ...EMPTY, homeworkParts: {} };
  cache[lessonId] = { ...current, [key]: true };
  notify();
  await persist();
  void syncWithServer(true);
}

export async function markHomeworkPartDone(lessonId: string, partId: string) {
  await ensureLoaded();
  const current = cache[lessonId] ?? { ...EMPTY, homeworkParts: {} };
  cache[lessonId] = { ...current, homeworkParts: { ...current.homeworkParts, [partId]: true } };
  notify();
  await persist();
  void syncWithServer(true);
}

export type ProgressCategory = 'video' | 'speaking' | 'vocabulary' | 'homework';

export function getCategoryProgress(lessonId: string, category: ProgressCategory, totalHomeworkParts = 0): number {
  const p = getLessonProgress(lessonId);
  // 52/3-vazifa: mashqlar (grammatika/nutq) "Uyga vazifa" qismiga
  // ko'chirilgani sabab, "Videodars"/"Speaking ko'rgazmalari" endi
  // to'g'ridan-to'g'ri video/slaydlarni ko'rish ekraniga olib boradi —
  // alohida "mashqlar" bosqichi yo'q. Shu sabab bu ikkalasi videoExercises/
  // speakingExercises bilan emas, faqat ko'rilgan-ko'rilmaganiga qarab
  // hisoblanadi (aks holda hech qachon 100%ga yetmasdi).
  if (category === 'video') {
    return p.videoWatch ? 100 : 0;
  }
  if (category === 'speaking') {
    return p.slidesWatch ? 100 : 0;
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
