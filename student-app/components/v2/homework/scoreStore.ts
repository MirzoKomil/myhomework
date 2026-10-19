/**
 * Uyga vazifa qismlarining natijalari (nechta to'g'ri, qancha coin, qaysi
 * savolda to'xtagan). Eski ilova faqat "qism bajarildi" belgisini saqlardi;
 * v2 dizayni esa "4 / 10", "18 / 20 to'g'ri (90%)", "+18 coin" kabi
 * raqamlarni ko'rsatadi — shu sabab ular qurilmada (AsyncStorage) saqlanadi.
 * Serverga hech narsa qo'shilmaydi.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { getStudent, ready as authReady } from '@/services/studentAuthStore';

const KEY = 'mh_v2_homework_scores';

export type PartScore = {
  /** Shu qismda nechta savolga javob berilgan (davom ettirish uchun). */
  answered: number;
  correct: number;
  total: number;
  coins: number;
  /** Xato qilingan savollar matni — "Xatolar" ro'yxati uchun. */
  mistakes: string[];
  finished: boolean;
};

type Store = Record<string, Record<string, PartScore>>;

let cache: Store = {};
let loaded = false;
let loadPromise: Promise<void> | null = null;
let storageKey = KEY;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function ensureLoaded() {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      await authReady();
      // Har o'quvchining natijasi alohida kalitda — bir qurilmada ikki o'quvchi bo'lsa aralashmasin.
      const id = getStudent()?.id;
      storageKey = id ? `${KEY}:${id}` : KEY;
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        cache = raw ? JSON.parse(raw) : {};
      } catch {
        cache = {};
      }
      loaded = true;
    })();
  }
  return loadPromise;
}

async function persist() {
  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(cache));
  } catch {
    // Xotiraga yozib bo'lmasa (maxfiy rejim) — jim o'tamiz.
  }
}

export function getPartScore(lessonId: string, partId: string): PartScore | undefined {
  return cache[lessonId]?.[partId];
}

export function getLessonScores(lessonId: string): Record<string, PartScore> {
  return cache[lessonId] ?? {};
}

export async function savePartScore(lessonId: string, partId: string, score: PartScore) {
  await ensureLoaded();
  cache = { ...cache, [lessonId]: { ...(cache[lessonId] ?? {}), [partId]: score } };
  notify();
  await persist();
}

export async function resetPartScore(lessonId: string, partId: string) {
  await ensureLoaded();
  const lesson = { ...(cache[lessonId] ?? {}) };
  delete lesson[partId];
  cache = { ...cache, [lessonId]: lesson };
  notify();
  await persist();
}

export async function loadScores() {
  await ensureLoaded();
}

export function useHomeworkScores(): Store {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    ensureLoaded().then(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return cache;
}
