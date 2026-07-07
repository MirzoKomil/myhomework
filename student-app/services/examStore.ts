import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'mh_exam_results';

export type ExamMistake = { question: string; yourAnswer: string; correctAnswer: string };

export type ExamResult = {
  passed: boolean;
  scorePercent: number;
  mistakes: ExamMistake[];
  attemptedAt: number;
};

type Store = Record<string, ExamResult>;

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
    // Xotiraga yozib bo'lmasa jim o'tkazib yuboramiz.
  }
}

export function getExamResult(examId: string): ExamResult | undefined {
  return cache[examId];
}

export async function loadExamResults(): Promise<void> {
  await ensureLoaded();
  notify();
}

export async function saveExamResult(examId: string, result: ExamResult) {
  await ensureLoaded();
  const prev = cache[examId];
  // Faqat yaxshiroq natija bo'lsa yoki hali umuman urinilmagan bo'lsa saqlanadi.
  if (!prev || result.scorePercent > prev.scorePercent || result.passed) {
    cache[examId] = result;
  }
  notify();
  await persist();
}

export function useExamResult(examId: string): ExamResult | undefined {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadExamResults().then(() => setTick((t) => t + 1));
    return subscribe(() => setTick((t) => t + 1));
  }, [examId]);
  return getExamResult(examId);
}

export function useExamResults(): Store {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadExamResults().then(() => setTick((t) => t + 1));
    return subscribe(() => setTick((t) => t + 1));
  }, []);
  return cache;
}
