import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const TOTAL_KEY = 'mh_lightning_total';

let total = 0;
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
    loadPromise = AsyncStorage.getItem(TOTAL_KEY)
      .then((raw) => {
        total = raw !== null ? Number(raw) : 0;
      })
      .catch(() => {
        total = 0;
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
  } catch {
    // Xotiraga yozib bo'lmasa jim o'tkazib yuboramiz.
  }
}

export function getTotalLightning(): number {
  return total;
}

export async function loadLightning(): Promise<void> {
  await ensureLoaded();
  notify();
}

// Chaqmoqlar faqat to'planadi — hech qachon sarflanmaydi, shuning uchun bu yerda ayirish funksiyasi yo'q.
export async function addLightning(amount = 1) {
  await ensureLoaded();
  total += amount;
  notify();
  await persist();
}

export function useLightning(): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadLightning().then(() => setTick((t) => t + 1));
    return subscribe(() => setTick((t) => t + 1));
  }, []);
  return getTotalLightning();
}
