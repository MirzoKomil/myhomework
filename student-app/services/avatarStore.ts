import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { profileStats } from '@/data/mock';

const AVATAR_KEY = 'mh_profile_avatar_uri';

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
  avatarUri = uri;
  notify();
  try {
    await AsyncStorage.setItem(AVATAR_KEY, uri);
  } catch {
    // Xotiraga yozib bo'lmasa jim o'tkazib yuboramiz.
  }
}

export function useAvatarUri(): string | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadAvatar().then(() => setTick((t) => t + 1));
    return subscribe(() => setTick((t) => t + 1));
  }, []);
  return getAvatarUri();
}
