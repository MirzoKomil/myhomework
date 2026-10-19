/**
 * Dizayndagi 10 ta tayyor avatar (ProfileEdit artboard) va tanlangan
 * avatarni eslab qolish. Tanlangan tayyor avatar ham oddiy rasm sifatida
 * avatarStore orqali saqlanadi (serverga yuklanadi) — shunda Leaderboard
 * va eski ekranlar ham shu rasmni ko'radi. Qaysi tayyor avatar
 * tanlangani esa faqat belgi uchun qurilmada saqlanadi.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';

import { designImages } from '@/constants/v2/designImages';

export const PRESETS = [
  { key: 'tulki', label: 'Tulki', id: '93faebd4826b1da6adaee5d0dcda6209' },
  { key: 'mushuk', label: 'Mushuk', id: 'a3708508c0cbf5ab86162c4a6d6cd5e2' },
  { key: 'ayiq', label: 'Ayiq', id: '8e0b816fbe0129a37398f3ed492a0505' },
  { key: 'boyqush', label: 'Boyqush', id: '1f74e7895823b5bffaf1b36a54ee7fd8' },
  { key: 'panda', label: 'Panda', id: '0f7d59dcb1d2e56a37e0299ff47ee04b' },
  { key: 'quyon', label: 'Quyon', id: '6fbb4a0364e41f76fd238e0c91d0228b' },
  { key: 'sher', label: 'Sher', id: '5dbf25e6051b77b37c2186bb3b063150' },
  { key: 'pingvin', label: 'Pingvin', id: '36eec51388d80c03926ef8f16fbc465b' },
  { key: 'kuchukcha', label: 'Kuchukcha', id: '340849cdb26c80eaa783d90e65c2322f' },
  { key: 'toshbaqa', label: 'Toshbaqa', id: 'f72223a868975b44db340e986cf4ac2d' },
] as const;

export type PresetKey = (typeof PRESETS)[number]['key'];

export const presetSource = (id: string) => designImages[id as keyof typeof designImages];

/** Avatar umuman tanlanmagan bo'lsa — dizayndagi standart (tulki). */
export const DEFAULT_PRESET = PRESETS[0];

const PRESET_KEY = 'mh_v2_avatar_preset';

export async function getSavedPreset(): Promise<PresetKey | null> {
  try {
    const v = await AsyncStorage.getItem(PRESET_KEY);
    return PRESETS.some((p) => p.key === v) ? (v as PresetKey) : null;
  } catch {
    return null;
  }
}

export async function savePreset(key: PresetKey | null) {
  try {
    if (key) await AsyncStorage.setItem(PRESET_KEY, key);
    else await AsyncStorage.removeItem(PRESET_KEY);
  } catch {
    // Qurilmaga yozib bo'lmasa — faqat belgi yo'qoladi.
  }
}

/** Tayyor avatarning yuklanadigan manzili (webda /student/assets/..., native'da fayl). */
export function presetUri(id: string): string | null {
  const src = presetSource(id);
  return src ? Image.resolveAssetSource(src)?.uri ?? null : null;
}
