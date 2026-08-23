import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'mh_listened_books';

// 1-vazifa: Bosh sahifadagi "Eshitish" ko'nikma progressi Kutubxona >
// Kitoblar bo'limidagi audiokitoblardan aynan tinglab chiqilganlarining
// ulushini ko'rsatishi kerak — bu maqsadda qaysi kitob(lar) tinglanganini
// eslab qolish uchun kichik, alohida saqlagich.
let cache: Set<string> = new Set();
let loaded = false;
let loadPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(KEY)
      .then((raw) => {
        cache = new Set(raw ? (JSON.parse(raw) as string[]) : []);
      })
      .catch(() => {
        cache = new Set();
      })
      .finally(() => {
        loaded = true;
      });
  }
  return loadPromise;
}

async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(Array.from(cache)));
  } catch {
    // Xotiraga yozib bo'lmasa (masalan, maxfiy rejim) — jim o'tkazib yuboramiz.
  }
}

export async function markBookListened(bookId: string): Promise<void> {
  await ensureLoaded();
  if (cache.has(bookId)) return;
  cache.add(bookId);
  await persist();
}

export async function getListenedBookIds(): Promise<Set<string>> {
  await ensureLoaded();
  return new Set(cache);
}
