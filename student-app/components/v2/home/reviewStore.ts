/**
 * So'z takrorlash (WordReview) natijalari — faqat qurilmada (AsyncStorage).
 * Serverda takrorlash jadvali yo'q, shuning uchun har bir so'z uchun
 * oxirgi ko'rilgan vaqt va keyingi chiqish sanasi shu yerda saqlanadi:
 * "Takrorlayman" — ertaga yana, "Bilaman" — 7 kundan keyin.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'mh_v2_word_review';
const DAY = 86400000;

export type ReviewRecord = { lastSeen: number; due: number };
export type ReviewMap = Record<string, ReviewRecord>;

/** So'z kaliti — getAccumulatedVocabulary bilan bir xil (kichik harfda). */
export const wordKey = (w: string) => w.trim().toLowerCase();

export async function loadReviews(): Promise<ReviewMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ReviewMap) : {};
  } catch {
    return {};
  }
}

const startOfDay = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export async function saveReview(word: string, known: boolean): Promise<void> {
  const map = await loadReviews();
  const now = Date.now();
  // Kun boshiga tenglanadi — "ertaga" ertangi kun boshidan chiqadi.
  map[wordKey(word)] = { lastSeen: now, due: startOfDay(now) + (known ? 7 : 1) * DAY };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // Xotiraga yozib bo'lmasa jim o'tamiz.
  }
}

/** "4 kun oldin" kabi — oxirgi ko'rilgan kundan beri. */
export function daysAgo(t: number, now = Date.now()) {
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(t)) / DAY));
}
