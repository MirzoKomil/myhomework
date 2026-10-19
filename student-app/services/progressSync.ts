/**
 * Tanga/chaqmoqni server bilan moslash.
 *
 * Summalar telefon xotirasida saqlanadi, har o'zgarishda serverga ham
 * yuboriladi. Yangi telefon yoki bosh ekrandagi yangi ikonka (iPhone'da
 * alohida xotira) 0 dan boshlardi va birinchi tangadayoq serverdagi
 * haqiqiy summani o'sha kichik son bilan almashtirib yuborardi.
 * Endi ochilishda summa serverdan olinadi (server — asosiy manba).
 * Serverga yetib bormagan o'zgarish "dirty" deb belgilanadi va keyingi
 * ochilishda server qiymati emas, telefondagisi serverga yuboriladi.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getStudent, getToken, ready } from '@/services/studentAuthStore';

export type ServerProgress = {
  coins: number;
  lightning: number;
  updatedAt: string | null;
  streak: number;
  todayCoins: number;
  todayLightning: number;
};

export type ProgressKind = 'coins' | 'lightning';

const API =
  Platform.OS === 'web'
    ? '/api/state/my-progress'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/my-progress';

const DIRTY_KEY = 'mh_progress_dirty';

let cache: { token: string; p: Promise<ServerProgress | null> } | null = null;

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0);

/** Serverdagi summa (sessiyada bir marta; login bo'lmasa — null). */
export async function fetchMyProgress(timeoutMs = 5000): Promise<ServerProgress | null> {
  await ready();
  const token = getToken();
  if (!token) return null;
  if (cache && cache.token === token) return cache.p;
  const p = (async () => {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl?.abort(), timeoutMs);
    try {
      const res = await fetch(API, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl?.signal });
      if (!res.ok) return null;
      const d = (await res.json()) as Partial<ServerProgress> | null;
      if (!d || typeof d !== 'object') return null;
      return {
        coins: num(d.coins),
        lightning: num(d.lightning),
        updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : null,
        streak: num(d.streak),
        todayCoins: num(d.todayCoins),
        todayLightning: num(d.todayLightning),
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  })();
  cache = { token, p };
  // Muvaffaqiyatsiz bo'lsa keyingi safar qayta urinib ko'ramiz.
  p.then((r) => {
    if (!r && cache?.p === p) cache = null;
  });
  return p;
}

type Dirty = { sid: string | null; coins?: boolean; lightning?: boolean };

async function readDirty(): Promise<Dirty> {
  try {
    const raw = await AsyncStorage.getItem(DIRTY_KEY);
    return raw ? (JSON.parse(raw) as Dirty) : { sid: null };
  } catch {
    return { sid: null };
  }
}

async function writeDirty(d: Dirty) {
  try {
    if (!d.coins && !d.lightning) await AsyncStorage.removeItem(DIRTY_KEY);
    else await AsyncStorage.setItem(DIRTY_KEY, JSON.stringify(d));
  } catch {
    // jim
  }
}

const currentSid = () => getStudent()?.id ?? null;

export async function markDirty(kind: ProgressKind) {
  const d = await readDirty();
  await writeDirty({ ...d, sid: currentSid(), [kind]: true });
}

export async function clearDirty(kind: ProgressKind) {
  const d = await readDirty();
  await writeDirty({ ...d, [kind]: false });
}

/** Shu o'quvchining serverga yetmagan o'zgarishi bormi (boshqa o'quvchiniki hisobga olinmaydi). */
export async function isDirty(kind: ProgressKind): Promise<boolean> {
  const d = await readDirty();
  return !!d[kind] && d.sid === currentSid();
}

// Birinchi moslash (shu telefon + shu o'quvchi): telefondagi va serverdagi
// summalardan kattasi olinadi — avval sinxronlanmay qolgan qiymat yo'qolmasin.
const HYDRATED_KEY = 'mh_progress_hydrated_v1';

// Telefondagi summa qaysi o'quvchiniki (bir telefonda boshqa o'quvchi kirsa,
// avvalgisining tangalari unga o'tib ketmasin).
const OWNER_KEY = 'mh_progress_owner';

export async function firstHydration(kind: ProgressKind): Promise<boolean> {
  try {
    const owner = await AsyncStorage.getItem(OWNER_KEY);
    if (owner && owner !== currentSid()) return false;
    const raw = await AsyncStorage.getItem(HYDRATED_KEY);
    const d = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    return !d[`${currentSid()}:${kind}`];
  } catch {
    return true;
  }
}

export async function markHydrated(kind: ProgressKind) {
  try {
    const raw = await AsyncStorage.getItem(HYDRATED_KEY);
    const d = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    d[`${currentSid()}:${kind}`] = true;
    await AsyncStorage.setItem(HYDRATED_KEY, JSON.stringify(d));
    const sid = currentSid();
    if (sid) await AsyncStorage.setItem(OWNER_KEY, sid);
  } catch {
    // jim
  }
}
