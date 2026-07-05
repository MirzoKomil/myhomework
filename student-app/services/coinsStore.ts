import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { profileStats } from '@/data/mock';

const TOTAL_KEY = 'mh_coins_total';
const BY_LESSON_KEY = 'mh_coins_by_lesson';

let total = 0;
let byLesson: Record<string, number> = {};
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
    loadPromise = Promise.all([AsyncStorage.getItem(TOTAL_KEY), AsyncStorage.getItem(BY_LESSON_KEY)])
      .then(([totalRaw, byLessonRaw]) => {
        total = totalRaw !== null ? Number(totalRaw) : profileStats.coins;
        byLesson = byLessonRaw ? JSON.parse(byLessonRaw) : {};
      })
      .catch(() => {
        total = profileStats.coins;
        byLesson = {};
      })
      .finally(() => {
        loaded = true;
      });
  }
  return loadPromise;
}

async function persist() {
  try {
    await AsyncStorage.setItem(TOTAL_KEY, String(total));
    await AsyncStorage.setItem(BY_LESSON_KEY, JSON.stringify(byLesson));
  } catch {
    // Xotiraga yozib bo'lmasa jim o'tkazib yuboramiz.
  }
}

export function getTotalCoins(): number {
  return total;
}

export function getLessonCoins(lessonId: string): number {
  return byLesson[lessonId] ?? 0;
}

export async function loadCoins(): Promise<void> {
  await ensureLoaded();
  notify();
}

export async function addCoins(amount: number, lessonId?: string) {
  await ensureLoaded();
  total += amount;
  if (lessonId) {
    byLesson[lessonId] = (byLesson[lessonId] ?? 0) + amount;
  }
  notify();
  await persist();
}

export function useCoins(): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadCoins().then(() => setTick((t) => t + 1));
    return subscribe(() => setTick((t) => t + 1));
  }, []);
  return getTotalCoins();
}

export function useLessonCoins(lessonId: string): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadCoins().then(() => setTick((t) => t + 1));
    return subscribe(() => setTick((t) => t + 1));
  }, [lessonId]);
  return getLessonCoins(lessonId);
}
