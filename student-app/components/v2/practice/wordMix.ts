/**
 * So'z o'yinlari uchun "aqlli aralash".
 *
 * Avval har o'yin ochilgan darslar so'zlaridan tasodifiy tanlardi — bir xil
 * so'zlar qayta-qayta chiqardi, o'quvchining hozirgi darsi va xatolari
 * hisobga olinmasdi. Endi har o'yin so'zlarni uch manbadan oladi:
 *  ~50% — joriy dars so'zlari (endi o'rganayotgani),
 *  ~30% — takrorlash kerak bo'lganlar (So'z takrorlash jadvali + o'yindagi xatolar),
 *  ~20% — eski darslar so'zlari (unutilmasin).
 * Oxirgi o'yinlarda chiqqan so'zlar iloji boricha darhol qaytarilmaydi.
 * Hammasi qurilmada (AsyncStorage) — serverga hech narsa qo'shilmaydi.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadReviews, saveReview, wordKey } from '@/components/v2/home/reviewStore';

import { loadCurrentLesson, plainWord } from './shared';

const RECENT_KEY = 'mh_v2_game_recent';
const RECENT_MAX = 40;

/** O'yinlar ichidagi yagona kalit: urg'usiz, kichik harf. */
export const mixKey = (w: string) => plainWord(wordKey(w));

export type MixContext = {
  current: Set<string>;
  weak: Set<string>;
  recent: Set<string>;
};

export async function loadMixContext(): Promise<MixContext> {
  const [lesson, reviews, recentRaw] = await Promise.all([
    loadCurrentLesson().catch(() => null),
    loadReviews().catch(() => ({})),
    AsyncStorage.getItem(RECENT_KEY).catch(() => null),
  ]);
  const now = Date.now();
  const weak = new Set(
    Object.entries(reviews)
      .filter(([, r]) => r && r.due <= now)
      .map(([k]) => plainWord(k)),
  );
  let recent: string[] = [];
  try {
    recent = recentRaw ? (JSON.parse(recentRaw) as string[]) : [];
  } catch {
    recent = [];
  }
  return {
    current: new Set((lesson?.vocab ?? []).map((w) => mixKey(w.english))),
    weak,
    recent: new Set(recent),
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * `items` ichidan `n` tasini aralash qoidasi bo'yicha tanlaydi.
 * Biror guruh yetmasa — qolgan joy boshqalaridan to'ldiriladi; yaqinda
 * chiqqanlar faqat boshqa so'z qolmaganda olinadi.
 */
export function pickMix<T>(items: T[], n: number, keyOf: (t: T) => string, ctx: MixContext | null): T[] {
  const uniq = new Map<string, T>();
  for (const it of items) {
    const k = mixKey(keyOf(it));
    if (k && !uniq.has(k)) uniq.set(k, it);
  }
  const all = [...uniq.entries()];
  if (!ctx) return shuffle(all).slice(0, n).map(([, t]) => t);

  const fresh = all.filter(([k]) => !ctx.recent.has(k));
  const cur = shuffle(fresh.filter(([k]) => ctx.current.has(k)));
  const weak = shuffle(fresh.filter(([k]) => !ctx.current.has(k) && ctx.weak.has(k)));
  const old = shuffle(fresh.filter(([k]) => !ctx.current.has(k) && !ctx.weak.has(k)));

  const want = { cur: Math.round(n * 0.5), weak: Math.round(n * 0.3) };
  const out: [string, T][] = [...cur.slice(0, want.cur), ...weak.slice(0, want.weak)];
  out.push(...old.slice(0, Math.max(0, n - out.length)));
  // To'ldirish: avval qolgan yangilari, keyin yaqinda chiqqanlar.
  const used = new Set(out.map(([k]) => k));
  for (const pool of [shuffle(fresh), shuffle(all)]) {
    for (const e of pool) {
      if (out.length >= n) break;
      if (!used.has(e[0])) {
        used.add(e[0]);
        out.push(e);
      }
    }
  }
  return shuffle(out.slice(0, n)).map(([, t]) => t);
}

/** O'yinda ko'rsatilgan so'zlar — keyingi o'yinlarda darhol qaytarilmasin. */
export async function rememberShown(words: string[]) {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const prev = raw ? (JSON.parse(raw) as string[]) : [];
    const keys = words.map(mixKey).filter(Boolean);
    const next = [...keys, ...prev.filter((k) => !keys.includes(k))].slice(0, RECENT_MAX);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // jim
  }
}

/** O'yinda xato qilingan so'z — "So'z takrorlash"da ertaga chiqadi. */
export function markMistake(word: string) {
  saveReview(word, false).catch(() => {});
}
