import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

import { profileStats } from '@/data/mock';
import { authedFetch } from '@/services/contentApi';

const AVATAR_KEY = 'mh_profile_avatar_uri';

const UPLOAD_BASE =
  Platform.OS === 'web'
    ? '/api/upload/community-image'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/upload/community-image';
const SYNC_BASE =
  Platform.OS === 'web'
    ? '/api/state/demo-profile/avatar'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/demo-profile/avatar';

// 12-vazifa: profil rasmi ilgari faqat qurilma xotirasida (AsyncStorage)
// saqlanardi — boshqa hech kim (masalan Leaderboard'dagi boshqa o'quvchi)
// buni ko'ra olmasdi. Endi tanlangan rasm avval serverga (doimiy /uploads/...
// havolaga) yuklanadi, keyin o'quvchi yozuviga saqlanadi — shu bilan
// boshqalar ham haqiqiy rasmni ko'ra oladi.
async function uploadAvatarImage(imageUri: string): Promise<string | null> {
  try {
    const formData = new FormData();
    if (Platform.OS === 'web') {
      const blobResp = await fetch(imageUri);
      const blob = await blobResp.blob();
      formData.append('file', blob, 'avatar.jpg');
    } else {
      // @ts-expect-error — React Native FormData {uri,name,type} shaklidagi fayl obyektini kutadi.
      formData.append('file', { uri: imageUri, name: 'avatar.jpg', type: 'image/jpeg' });
    }
    const res = await fetch(UPLOAD_BASE, { method: 'POST', body: formData });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url ?? null;
  } catch {
    return null;
  }
}

function syncAvatarToServer(url: string) {
  authedFetch(SYNC_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarUrl: url }),
  }).catch(() => {});
}

let avatarUri: string | null = profileStats.avatar;
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
    loadPromise = AsyncStorage.getItem(AVATAR_KEY)
      .then((raw) => {
        if (raw) avatarUri = raw;
      })
      .catch(() => {})
      .finally(() => {
        loaded = true;
      });
  }
  return loadPromise;
}

export function getAvatarUri(): string | null {
  return avatarUri;
}

export async function loadAvatar(): Promise<void> {
  await ensureLoaded();
  notify();
}

export async function setAvatarUri(uri: string): Promise<void> {
  // Darhol (optimistik) mahalliy ko'rinishni yangilaymiz — o'quvchi natijani
  // kutmasdan darhol ko'radi. Fon rejimida esa rasm serverga yuklanib, doimiy
  // havola bilan almashtiriladi (mahalliy vaqtinchalik uri qurilma qayta
  // ochilganda yoki boshqa o'quvchilarga ko'rsatilganda ishlamay qolar edi).
  avatarUri = uri;
  notify();
  try {
    await AsyncStorage.setItem(AVATAR_KEY, uri);
  } catch {
    // Xotiraga yozib bo'lmasa jim o'tkazib yuboramiz.
  }

  const uploadedUrl = await uploadAvatarImage(uri);
  if (!uploadedUrl) return;
  avatarUri = uploadedUrl;
  notify();
  try {
    await AsyncStorage.setItem(AVATAR_KEY, uploadedUrl);
  } catch {
    // ignore
  }
  syncAvatarToServer(uploadedUrl);
}

export function useAvatarUri(): string | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadAvatar().then(() => setTick((t) => t + 1));
    return subscribe(() => setTick((t) => t + 1));
  }, []);
  return getAvatarUri();
}
