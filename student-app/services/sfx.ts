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
 * - Ovoz chalinmasa ham ilova ishlashi to'xtamaydi (hamma xato yutiladi).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';

const SOURCES = {
  tap: require('@/assets/sounds/v2/tap.mp3'),
  select: require('@/assets/sounds/v2/select.mp3'),
  correct: require('@/assets/sounds/v2/correct.mp3'),
  wrong: require('@/assets/sounds/v2/wrong.mp3'),
  coin: require('@/assets/sounds/v2/coin.mp3'),
  match: require('@/assets/sounds/v2/match.mp3'),
  flip: require('@/assets/sounds/v2/flip.mp3'),
  unlock: require('@/assets/sounds/v2/unlock.mp3'),
  streak: require('@/assets/sounds/v2/streak.mp3'),
  complete: require('@/assets/sounds/v2/complete.mp3'),
  levelup: require('@/assets/sounds/v2/levelup.mp3'),
  pop: require('@/assets/sounds/v2/pop.mp3'),
  lose: require('@/assets/sounds/v2/lose.mp3'),
} as const;

export type SfxName = keyof typeof SOURCES;

/** Har ovozning nisbiy balandligi — hammasi bir xil "quloqqa" eshitilsin. */
const VOLUME: Record<SfxName, number> = {
  tap: 0.35,
  select: 0.45,
  correct: 0.7,
  wrong: 0.6,
  coin: 0.55,
  match: 0.6,
  flip: 0.4,
  unlock: 0.6,
  streak: 0.7,
  complete: 0.75,
  levelup: 0.75,
  pop: 0.4,
  lose: 0.55,
};

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

// Diqqat: setAudioModeAsync bu yerda chaqirilmaydi — u butun ilovaning audio
// sozlamasini (dars audiolarini ham) o'zgartirib yuboradi.

/**
 * Effektni chalish. Bir xil ovoz 60 ms ichida qayta chaqirilsa — e'tiborsiz
 * qoldiriladi (tez-tez bosishda "shitirlash" bo'lmasin).
 */
export function playSfx(name: SfxName) {
  if (!enabled) return;
  const now = Date.now();
  if ((lastPlayed[name] ?? 0) > now - 60) return;
  lastPlayed[name] = now;
  try {
    let p = players[name];
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      p.volume = VOLUME[name];
      players[name] = p;
    }
    p.muted = false;
    p.seekTo(0);
    p.play();
  } catch {
    // Ovoz chalinmasa ham hech narsa buzilmasin.
  }
}

/** Kechikish bilan chalish (masalan animatsiya cho'qqisiga moslash). */
export function playSfxLater(name: SfxName, ms: number) {
  setTimeout(() => playSfx(name), ms);
}

/**
 * Safari/iOS (web): audio element faqat foydalanuvchi bosishi ichida birinchi
 * marta chalinsa "ochiladi". Shuning uchun birinchi bosishda hamma effekt
 * pleerlarini jim holda bir lahza chalib, darhol to'xtatamiz — keyin ular
 * ekran almashganda ham (masalan "Dars tugadi" ochilganda) chalinadi.
 */
let primed = false;
export function primeSfxOnFirstGesture() {
  if (primed || typeof document === 'undefined') return;
  primed = true;
  const prime = () => {
    document.removeEventListener('pointerdown', prime, true);
    document.removeEventListener('keydown', prime, true);
    const at = Date.now();
    (Object.keys(SOURCES) as SfxName[]).forEach((name) => {
      try {
        let p = players[name];
        if (!p) {
          p = createAudioPlayer(SOURCES[name]);
          players[name] = p;
        }
        const player = p;
        player.muted = true;
        player.play();
        setTimeout(() => {
          try {
            player.muted = false;
            // Shu bosishning o'zi effekt chaqirgan bo'lsa — uni to'xtatmaymiz.
            if ((lastPlayed[name] ?? 0) >= at) return;
            player.pause();
            player.seekTo(0);
            player.volume = VOLUME[name];
          } catch {
            // e'tiborsiz
          }
        }, 60);
      } catch {
        // e'tiborsiz
      }
    });
  };
  document.addEventListener('pointerdown', prime, true);
  document.addEventListener('keydown', prime, true);
}
