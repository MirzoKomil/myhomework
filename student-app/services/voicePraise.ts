/**
 * O'zbekcha ovozli maqtov va dalda (v2).
 *
 * Har javobda maqtov aytilsa tez jonga tegadi — shuning uchun:
 *  - to'g'ri javob: ketma-ket 3-, 5-, 8-, 12-, keyin har 4-to'g'ri javobda
 *    (va kamida 8 soniyada bir marta) turli jumlalardan biri aytiladi;
 *  - xato javob: faqat to'g'ri javobdan keyingi BIRINCHI xatoda yumshoq dalda
 *    (ketma-ket xatolarda jim — o'quvchi kayfiyati tushmasin);
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
import { useEffect, useState } from 'react';

import { enqueuePrime, hasUserGesture, isSpeechBusy } from './audioUnlock';
import { VOICE_SOURCES, type VoiceGroup } from './voiceClips';

const STORAGE_KEY = 'v2.voicePraiseEnabled';
/** Maqtov aytiladigan ketma-ket to'g'ri javoblar soni (12 dan keyin — har 4-da). */
const PRAISE_AT = [3, 5, 8, 12];
const MIN_GAP_MS = 8000;

let enabled = true;
let loaded = false;
const listeners = new Set<(on: boolean) => void>();
const players: Record<string, AudioPlayer> = {};
const lastIndex: Partial<Record<VoiceGroup, number>> = {};
let lastSpokenAt = 0;
let correctRun = 0;
let lastWasCorrect = true;
let current: AudioPlayer | null = null;
let pending: ReturnType<typeof setTimeout> | null = null;

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
  pending = setTimeout(() => {
    pending = null;
    if (!enabled || !hasUserGesture() || isSpeechBusy()) return;
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
  }, delayMs);
}

/** Har javobdan keyin chaqiriladi (natija paneli ochilganda). */
export function praiseAnswer(correct: boolean) {
  const now = Date.now();
  if (correct) {
    correctRun += 1;
    const due = PRAISE_AT.includes(correctRun) || (correctRun > 12 && correctRun % 4 === 0);
    if (due && now - lastSpokenAt > MIN_GAP_MS) speak('correct');
    lastWasCorrect = true;
    return;
  }
  // Xato: faqat to'g'ri javoblardan keyingi birinchi xatoda dalda.
  if (lastWasCorrect && now - lastSpokenAt > MIN_GAP_MS) speak('wrong', 550);
  correctRun = 0;
  lastWasCorrect = false;
}

/** Yangi mashq/qism boshlanganda hisoblagichni nolga qaytarish. */
export function resetPraiseRun() {
  correctRun = 0;
  lastWasCorrect = true;
}

/** Safari/iOS (web): jumla pleerlarini bosishlar ichida "ochish" (audioUnlock.ts). Effektlardan keyin navbatga qo'yiladi. */
export function primeVoiceOnFirstGesture() {
  const order: VoiceGroup[] = ['correct', 'wrong', 'complete', 'homework', 'levelup', 'gameWin', 'gameLose'];
  enqueuePrime(order.flatMap((g) => VOICE_SOURCES[g].map((_, i) => ({ key: `voice:${g}:${i}`, get: () => player(g, i) }))));
}
