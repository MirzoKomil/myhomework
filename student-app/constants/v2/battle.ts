/**
 * v2 Yuzma-yuz mukofoti (egasi qarori): har g'alaba +25 coin, lekin
 * kuniga faqat birinchi 3 ta g'alaba coin beradi. Eski ilova
 * data/mock.ts dagi BATTLE_WIN_COINS'dan foydalanishda davom etadi.
 *
 * Hisoblagich qurilmada (AsyncStorage) — kun Toshkent vaqti bo'yicha.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const V2_BATTLE_WIN_COINS = 25;
export const V2_BATTLE_DAILY_COIN_WINS = 3;

const KEY_PREFIX = 'mh_v2_battle_wins_';

/** Toshkent sanasi (UTC+5, yozgi vaqt yo'q) — "YYYY-MM-DD". */
export function tashkentDateKey(now = new Date()) {
  return new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}

async function readWins(key: string) {
  const raw = await AsyncStorage.getItem(key).catch(() => null);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Bugun coin bilan to'langan g'alabalar soni. */
export function getTodayPaidBattleWins() {
  return readWins(KEY_PREFIX + tashkentDateKey());
}

// Ketma-ket chaqiruvlar bir-birini bosib ketmasligi uchun navbat.
let queue: Promise<unknown> = Promise.resolve();

/**
 * G'alaba uchun coin "o'rnini" band qiladi: bugungi limit tugamagan bo'lsa
 * hisoblagichni oshirib true qaytaradi (coin'ni chaqiruvchi qo'shadi).
 */
export function claimBattleWinCoins(): Promise<boolean> {
  const run = queue.then(async () => {
    const key = KEY_PREFIX + tashkentDateKey();
    const wins = await readWins(key);
    if (wins >= V2_BATTLE_DAILY_COIN_WINS) return false;
    await AsyncStorage.setItem(key, String(wins + 1)).catch(() => {});
    return true;
  });
  queue = run.catch(() => false);
  return run;
}
