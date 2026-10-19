/**
 * v2 ilova ovoz effektlari.
 *
 * - Ovozlar Domwork uchun maxsus sintez qilingan (litsenziya muammosi yo'q),
 *   har biri 1–16 KB: assets/sounds/v2/*.mp3.
 * - Har ovoz uchun BITTA pleer butun sessiya davomida qayta ishlatiladi
 *   (gameSounds.ts dagi Safari/iOS "faqat bir marta chaladi" muammosi sababli).
 * - O'quvchi Sozlamalar → "Ovoz effektlari" orqali o'chirib qo'yishi mumkin.
 *   Sozlama faqat qurilmada (AsyncStorage) saqlanadi — serverga hech narsa
 *   yuborilmaydi.
 * - Nisbiy balandlik fayllarning o'ziga yozilgan (iOS `volume` ni e'tiborsiz
 *   qoldiradi) — pleer balandligi doim 1.
 * - Ovoz chalinmasa ham ilova ishlashi to'xtamaydi (hamma xato yutiladi).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';

import { enqueuePrime, hasUserGesture } from './audioUnlock';

const SOURCES = {
  tap: require('@/assets/sounds/v2/tap.mp3'),
  select: require('@/assets/sounds/v2/select.mp3'),
  correct: require('@/assets/sounds/v2/correct.mp3'),
  wrong: require('@/assets/sounds/v2/wrong.mp3'),
  coin: require('@/assets/sounds/v2/coin.mp3'),
  match: require('@/assets/sounds/v2/match.mp3'),
  flip: require('@/assets/sounds/v2/flip.mp3'),
  unlock: require('@/assets/sounds/v2/unlock.mp3'),
  complete: require('@/assets/sounds/v2/complete.mp3'),
  levelup: require('@/assets/sounds/v2/levelup.mp3'),
  pop: require('@/assets/sounds/v2/pop.mp3'),
  lose: require('@/assets/sounds/v2/lose.mp3'),
} as const;

export type SfxName = keyof typeof SOURCES;

const STORAGE_KEY = 'v2.sfxEnabled';

let enabled = true;
let loaded = false;
const listeners = new Set<(on: boolean) => void>();
const players: Partial<Record<SfxName, AudioPlayer>> = {};
const lastPlayed: Partial<Record<SfxName, number>> = {};

AsyncStorage.getItem(STORAGE_KEY)
  .then((v) => {
    if (v === '0') enabled = false;
  })
  .catch(() => {})
  .finally(() => {
    loaded = true;
    listeners.forEach((fn) => fn(enabled));
  });

export function isSfxEnabled() {
  return enabled;
}

export function setSfxEnabled(on: boolean) {
  enabled = on;
  AsyncStorage.setItem(STORAGE_KEY, on ? '1' : '0').catch(() => {});
  listeners.forEach((fn) => fn(on));
  if (on) playSfx('select');
}

/** Sozlamalar ekrani uchun: joriy holat va o'zgarishlarni kuzatish. */
export function useSfxEnabled(): boolean {
  const [on, setOn] = useState(enabled);
  useEffect(() => {
    listeners.add(setOn);
    if (loaded) setOn(enabled);
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  return on;
}

function player(name: SfxName): AudioPlayer | null {
  try {
    let p = players[name];
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      players[name] = p;
    }
    return p;
  } catch {
    return null;
  }
}

// Diqqat: setAudioModeAsync bu yerda chaqirilmaydi — u butun ilovaning audio
// sozlamasini (dars audiolarini ham) o'zgartirib yuboradi.

/**
 * Effektni chalish. Bir xil ovoz 60 ms ichida qayta chaqirilsa — e'tiborsiz
 * qoldiriladi (tez-tez bosishda "shitirlash" bo'lmasin).
 */
export function playSfx(name: SfxName) {
  if (!enabled || !hasUserGesture()) return;
  const now = Date.now();
  if ((lastPlayed[name] ?? 0) > now - 60) return;
  lastPlayed[name] = now;
  const p = player(name);
  if (!p) return;
  try {
    p.muted = false;
    p.seekTo(0);
    p.play();
  } catch {
    // Ovoz chalinmasa ham hech narsa buzilmasin.
  }
}

/** Kechikish bilan chalish (masalan animatsiya cho'qqisiga moslash). Bekor qilish funksiyasini qaytaradi. */
export function playSfxLater(name: SfxName, ms: number): () => void {
  const t = setTimeout(() => playSfx(name), ms);
  return () => clearTimeout(t);
}

/** Birinchi bosishda ochiladigan eng kerakli effektlar; qolganlari keyin. */
const FIRST: SfxName[] = ['correct', 'wrong', 'coin', 'select', 'flip', 'match', 'complete', 'unlock', 'levelup', 'lose'];

/** Safari/iOS (web): pleerlarni foydalanuvchi bosishlari ichida "ochish" (audioUnlock.ts). */
export function primeSfxOnFirstGesture() {
  const rest = (Object.keys(SOURCES) as SfxName[]).filter((n) => !FIRST.includes(n));
  enqueuePrime([
    ...FIRST.map((n) => ({ key: `sfx:${n}`, prio: 0, get: () => player(n) })),
    ...rest.map((n) => ({ key: `sfx:${n}`, prio: 3, get: () => player(n) })),
  ]);
}
