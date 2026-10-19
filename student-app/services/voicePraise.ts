/**
 * O'zbekcha ovozli maqtov va dalda (v2).
 *
 * Har javobda maqtov aytilsa tez jonga tegadi — shuning uchun:
 *  - to'g'ri javob: ketma-ket 2-, 4-, 6-… to'g'ri javobda (va kamida 4 soniyada
 *    bir marta) turli jumlalardan biri aytiladi;
 *  - xato javob: faqat to'g'ri javobdan keyingi BIRINCHI xatoda yumshoq dalda
 *    (ketma-ket xatolarda jim — o'quvchi kayfiyati tushmasin);
 *  - katta lahzalar (dars tugadi, yangi daraja, o'yinda g'alaba) — har doim.
 *
 * Ovozlar oldindan yozib olingan qisqa mp3 fayllar (assets/sounds/v2/voice).
 * O'quvchi Sozlamalar → "Ovozli maqtov" orqali o'chirishi mumkin; sozlama
 * faqat shu qurilmada (AsyncStorage) saqlanadi — serverga hech narsa ketmaydi.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';

import { VOICE_SOURCES, type VoiceGroup } from './voiceClips';

const STORAGE_KEY = 'v2.voicePraiseEnabled';
const VOLUME = 0.95;

let enabled = true;
let loaded = false;
const listeners = new Set<(on: boolean) => void>();
const players: Record<string, AudioPlayer> = {};
const lastIndex: Partial<Record<VoiceGroup, number>> = {};
let lastSpokenAt = 0;
let correctRun = 0;
let lastWasCorrect = true;

AsyncStorage.getItem(STORAGE_KEY)
  .then((v) => {
    if (v === '0') enabled = false;
  })
  .catch(() => {})
  .finally(() => {
    loaded = true;
    listeners.forEach((fn) => fn(enabled));
  });

export function setVoicePraiseEnabled(on: boolean) {
  enabled = on;
  AsyncStorage.setItem(STORAGE_KEY, on ? '1' : '0').catch(() => {});
  listeners.forEach((fn) => fn(on));
  if (on) speak('correct', 0);
}

export function useVoicePraiseEnabled(): boolean {
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

/** Guruhdan tasodifiy (oldingisidan farqli) jumla tanlab, kechikish bilan aytadi. */
export function speak(group: VoiceGroup, delayMs = 450) {
  if (!enabled) return;
  const list = VOICE_SOURCES[group];
  if (!list?.length) return;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastIndex[group]) i = (i + 1) % list.length;
  lastIndex[group] = i;
  const key = `${group}:${i}`;
  lastSpokenAt = Date.now() + delayMs;
  setTimeout(() => {
    try {
      let p = players[key];
      if (!p) {
        p = createAudioPlayer(list[i]);
        p.volume = VOLUME;
        players[key] = p;
      }
      p.muted = false;
      p.seekTo(0);
      p.play();
    } catch {
      // Ovoz chalinmasa ham hech narsa buzilmasin.
    }
  }, delayMs);
}

/** Har javobdan keyin chaqiriladi (natija paneli ochilganda). */
export function praiseAnswer(correct: boolean) {
  const now = Date.now();
  if (correct) {
    correctRun += 1;
    const due = correctRun >= 2 && correctRun % 2 === 0;
    if (due && now - lastSpokenAt > 4000) speak('correct');
    lastWasCorrect = true;
    return;
  }
  // Xato: faqat to'g'ri javoblardan keyingi birinchi xatoda dalda.
  if (lastWasCorrect && now - lastSpokenAt > 4000) speak('wrong', 550);
  correctRun = 0;
  lastWasCorrect = false;
}

/** Yangi mashq/qism boshlanganda hisoblagichni nolga qaytarish. */
export function resetPraiseRun() {
  correctRun = 0;
  lastWasCorrect = true;
}

/** Safari/iOS (web): birinchi bosishda jumla pleerlarini jim holda "ochib" qo'yish (sfx.ts dagi kabi). */
let primed = false;
export function primeVoiceOnFirstGesture() {
  if (primed || typeof document === 'undefined') return;
  primed = true;
  const prime = () => {
    document.removeEventListener('pointerdown', prime, true);
    document.removeEventListener('keydown', prime, true);
    (Object.keys(VOICE_SOURCES) as VoiceGroup[]).forEach((group) => {
      VOICE_SOURCES[group].forEach((src, i) => {
        const key = `${group}:${i}`;
        try {
          let p = players[key];
          if (!p) {
            p = createAudioPlayer(src);
            players[key] = p;
          }
          if (p.playing) return;
          p.volume = VOLUME;
          // Jim holda oxirigacha chalinadi (pause() yo'q — konsolda xato chiqmasin).
          p.muted = true;
          p.play();
        } catch {
          // e'tiborsiz
        }
      });
    });
  };
  document.addEventListener('pointerdown', prime, true);
  document.addEventListener('keydown', prime, true);
}
