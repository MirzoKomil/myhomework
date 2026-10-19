/**
 * "home" guruhining umumiy yordamchilari: onboarding belgisi, qo'llab-quvvatlash
 * havolasi va bildirishnomalarni qurilmada "o'qilgan" deb belgilash.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { fonts } from '@/constants/v2/tokens';

/** Onboarding shu qurilmada tugallangani (serverda maydon yo'q). */
export const ONBOARDED_KEY = 'mh_v2_onboarded';
/** Onboarding javobi — faqat qurilmada saqlanadi. */
export const GOAL_KEY = 'mh_v2_goal';
/** "Hammasini o'qilgan qilish" — serverda o'qildi belgisi yo'q, shuning uchun qurilmada. */
const READ_KEY = 'mh_v2_read_notifications';

// Eski ilovadagi (profile/settings/contacts.tsx) bilan bir xil manzillar.
export const supportUrl = (courseLang: string) =>
  courseLang === 'russian' ? 'https://t.me/Domwork_admin' : 'https://t.me/myhomeworkuz';

export const BOT_URL = 'https://t.me/Domworkuz_bot';

export async function isOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function getReadIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(READ_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function markAllRead(ids: string[]): Promise<void> {
  const prev = await getReadIds();
  ids.forEach((id) => prev.add(id));
  // Ro'yxat cheksiz o'smasligi uchun oxirgi 300 tasi saqlanadi.
  const list = [...prev].slice(-300);
  try {
    await AsyncStorage.setItem(READ_KEY, JSON.stringify(list));
  } catch {
    // Xotiraga yozib bo'lmasa jim o'tamiz.
  }
}

/** Kirill harfi bormi — Bricolage'da kirill yo'q, Manrope ExtraBold'ga o'tamiz. */
export const hasCyrillic = (s: string) => /[Ѐ-ӿ]/.test(s);
/**
 * Webda display steki o'zi Manrope/system-ui'ga o'tadi — urg'u belgisi (U+0301,
 * Manrope'da yo'q) ham to'g'ri joylashadi. Native'da kirill uchun Manrope.
 */
export const displayFont = (s: string) =>
  Platform.OS !== 'web' && hasCyrillic(s) ? fonts.displayCyrillic : fonts.display;
