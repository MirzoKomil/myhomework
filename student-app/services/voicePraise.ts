/**
 * O'zbekcha ovozli maqtov va dalda (v2).
 *
 * Har javobda maqtov aytilsa tez jonga tegadi — shuning uchun:
 *  - to'g'ri javob: ketma-ket 2-, 4-, 7-, 10-, keyin har 4-to'g'ri javobda
 *    (va kamida 8 soniyada bir marta) turli jumlalardan biri aytiladi;
 *  - xato javob: faqat kamida 2 ta ketma-ket to'g'ri javobdan keyingi xatoda,
 *    bir qismda ko'pi bilan BIR marta yumshoq dalda (maqtov ustun bo'lsin);
 *  - katta lahzalar (dars tugadi, yangi daraja, o'yinda g'alaba) — har doim,
 *    lekin fanfara tugagandan keyin;
 *  - bir vaqtda faqat BITTA jumla: yangisi oldingisini to'xtatadi; ilova
 *    o'zi ruscha so'z o'qiyotgan bo'lsa (expo-speech) — jim turadi.
 *
 * Ovozlar oldindan yozib olingan qisqa mp3 fayllar (assets/sounds/v2/voice).
 * O'quvchi Sozlamalar → "Ovozli maqtov" orqali o'chirishi mumkin; sozlama
 * faqat shu qurilmada (AsyncStorage) saqlanadi — serverga hech narsa ketmaydi.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

import { enqueuePrime, hasUserGesture, isSpeechBusy } from './audioUnlock';
import { VOICE_SOURCES, type VoiceGroup } from './voiceClips';

const STORAGE_KEY = 'v2.voicePraiseEnabled';
/** Maqtov aytiladigan ketma-ket to'g'ri javoblar soni (10 dan keyin — har 4-da). */
const PRAISE_AT = [2, 4, 7, 10];
const MIN_GAP_MS = 6000;
/** To'g'ri javob chimi (0–780 ms) va coin (220–820 ms) tugagach gapiradi. */
const PRAISE_DELAY_MS = 850;

let enabled = true;
let loaded = false;
const listeners = new Set<(on: boolean) => void>();
const players: Record<string, AudioPlayer> = {};
const lastIndex: Partial<Record<VoiceGroup, number>> = {};
let lastSpokenAt = 0;
let correctRun = 0;
let wrongSpoken = false;
/** Maqtov vaqti kelgan, lekin oraliq sabab aytilmagan — keyingi to'g'ri javobda aytiladi. */
let praiseOwed = false;
let current: AudioPlayer | null = null;
let pending: ReturnType<typeof setTimeout> | null = null;
/** stopVoice()/yangi speak() oldingi kutilayotgan chalishni bekor qilishi uchun. */
let seq = 0;

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
  else stopVoice();
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

function player(group: VoiceGroup, i: number): AudioPlayer | null {
  const key = `${group}:${i}`;
  try {
    let p = players[key];
    if (!p) {
      p = createAudioPlayer(VOICE_SOURCES[group][i]);
      players[key] = p;
    }
    return p;
  } catch {
    return null;
  }
}

/** Kutilayotgan yoki chalinayotgan jumlani to'xtatish (masalan ruscha so'z o'qilishidan oldin). */
export function stopVoice() {
  seq += 1;
  if (pending) {
    clearTimeout(pending);
    pending = null;
  }
  try {
    if (current?.playing) current.pause();
  } catch {
    // e'tiborsiz
  }
}

/** Guruhdan tasodifiy (oldingisidan farqli) jumla tanlab, kechikish bilan aytadi. */
export function speak(group: VoiceGroup, delayMs = 450) {
  if (!enabled) return;
  const list = VOICE_SOURCES[group];
  if (!list?.length) return;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastIndex[group]) i = (i + 1) % list.length;
  lastIndex[group] = i;
  lastSpokenAt = Date.now() + delayMs;
  stopVoice();
  const my = seq;
  pending = setTimeout(() => {
    pending = null;
    if (!enabled || !hasUserGesture() || isSpeechBusy()) return;
    const play = () => {
      if (my !== seq) return;
      const p = player(group, i);
      if (!p) return;
      try {
        current = p;
        p.muted = false;
        p.seekTo(0);
        p.play();
      } catch {
        // Ovoz chalinmasa ham hech narsa buzilmasin.
      }
    };
    // Native: ilova ruscha so'z o'qiyotgan bo'lsa (expo-speech) — jim turamiz.
    if (Platform.OS === 'web') play();
    else
      Speech.isSpeakingAsync()
        .then((busy) => !busy && play())
        .catch(play);
  }, delayMs);
}

/** Har javobdan keyin chaqiriladi (natija paneli ochilganda). */
export function praiseAnswer(correct: boolean) {
  const now = Date.now();
  if (correct) {
    correctRun += 1;
    const due = PRAISE_AT.includes(correctRun) || (correctRun > 10 && (correctRun - 10) % 4 === 0);
    if (due || praiseOwed) {
      if (now - lastSpokenAt > MIN_GAP_MS) {
        praiseOwed = false;
        speak('correct', PRAISE_DELAY_MS);
      } else praiseOwed = true;
    }
    return;
  }
  // Xato: yaxshi ketayotgan seriya uzilganda, bir qismda bir marta dalda.
  if (correctRun >= 2 && !wrongSpoken && now - lastSpokenAt > MIN_GAP_MS) {
    wrongSpoken = true;
    speak('wrong', 650);
  }
  correctRun = 0;
  praiseOwed = false;
}

/** Yangi mashq/qism boshlanganda hisoblagichni nolga qaytarish. */
export function resetPraiseRun() {
  correctRun = 0;
  wrongSpoken = false;
  praiseOwed = false;
}

/** Safari/iOS (web): jumla pleerlarini bosishlar ichida "ochish" (audioUnlock.ts). Effektlardan keyin navbatga qo'yiladi. */
export function primeVoiceOnFirstGesture() {
  // Katta lahzalar (dars tugadi, daraja, vazifa) birinchi bosishdayoq ochiladi.
  const prio: Record<VoiceGroup, number> = { complete: 1, levelup: 1, homework: 1, correct: 2, wrong: 2, retry: 2, gameWin: 2, gameLose: 2 };
  enqueuePrime(
    (Object.keys(VOICE_SOURCES) as VoiceGroup[]).flatMap((g) =>
      VOICE_SOURCES[g].map((_, i) => ({ key: `voice:${g}:${i}`, prio: prio[g], get: () => player(g, i) })),
    ),
  );
}
