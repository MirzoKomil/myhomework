import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

import { getLevelForLightning } from '@/data/levels';
import { syncStudentProgress } from '@/services/contentApi';
import { clearDirty, fetchMyProgress, firstHydration, isDirty, markDirty, markHydrated } from '@/services/progressSync';
import { getToken, subscribe as subscribeAuth } from '@/services/studentAuthStore';

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
      .then(() => hydrateFromServer())
      .finally(() => {
        loaded = true;
      });
  }
  return loadPromise;
}

let pending = 0;
let hydratedFor: string | null = null;

// Telefon xotirasini serverdagi summa bilan moslash (progressSync.ts ga qarang).
async function hydrateFromServer(): Promise<void> {
  const token = getToken();
  if (!token || hydratedFor === token) return;
  const srv = await fetchMyProgress();
  if (!srv) return;
  hydratedFor = token;
  if (await isDirty('lightning')) {
    if (await syncStudentProgress({ lightning: total })) await clearDirty('lightning');
    return;
  }
  await clearDirty('lightning');
  if (pending > 0) return;
  if (await firstHydration('lightning') && total > srv.lightning) {
    if (await syncStudentProgress({ lightning: total })) await markHydrated('lightning');
    return;
  }
  await markHydrated('lightning');
  total = srv.lightning;
  await persist();
}

subscribeAuth(() => {
  if (!loaded || !getToken()) return;
  hydrateFromServer().then(notify).catch(() => {});
});

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
  // 36/37-vazifa: Leaderboard (jumladan Kunlik/Haftalik/Oylik) haqiqiy
  // bo'lishi uchun jamlanma summa VA shu chaqiruvda qo'shilgan miqdor
  // (delta) serverga ham yuboriladi.
  pending++;
  await markDirty('lightning');
  const synced = syncStudentProgress({ lightning: total, lightningDelta: amount }).then(async (ok) => {
    pending--;
    if (ok && pending === 0) await clearDirty('lightning');
  });
  void synced;

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
