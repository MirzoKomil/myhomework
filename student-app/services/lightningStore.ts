import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

import { getLevelForLightning } from '@/data/levels';

const TOTAL_KEY = 'mh_lightning_total';

const LEVEL_UP_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/notifications/level-up'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/notifications/level-up';

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
  const prevLevel = getLevelForLightning(total);
  total += amount;
  notify();
  await persist();

  // 142-ish qayta ish 8: daraja (Uchqun→Shogird→... ) o'zgargani — chaqmoq
  // butunlay qurilmada saqlangani sababli, o'tishni shu yerda aniqlab
  // serverga "levelUp" tizim voqeasi sifatida xabar beramiz (Bildirishnomalar
  // ro'yxatida ko'rinishi uchun).
  const newLevel = getLevelForLightning(total);
  if (newLevel.key !== prevLevel.key) {
    fetch(LEVEL_UP_API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: newLevel.name }),
    }).catch(() => {
      // Tarmoq xatoligi bo'lsa jim o'tkazib yuboramiz — daraja o'zi to'g'ri saqlandi.
    });
  }
}

export function useLightning(): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadLightning().then(() => setTick((t) => t + 1));
    return subscribe(() => setTick((t) => t + 1));
  }, []);
  return getTotalLightning();
}
