import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'mh_last_position';

export type LastPosition = {
  lessonId: string;
  section: string;
  label: string;
  updatedAt: number;
};

export async function saveLastPosition(pos: Omit<LastPosition, 'updatedAt'>) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...pos, updatedAt: Date.now() }));
  } catch {
    // Xotiraga yozib bo'lmasa (masalan, maxfiy rejim) — jim o'tkazib yuboramiz.
  }
}

export async function getLastPosition(): Promise<LastPosition | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
