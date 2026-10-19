/**
 * Web (ayniqsa iOS Safari) uchun audio "ochish" yordamchisi — sfx.ts va
 * voicePraise.ts ikkalasi ham shundan foydalanadi.
 *
 * - Brauzer foydalanuvchi sahifaga hali tegmagan bo'lsa play() ni rad etadi
 *   (va expo-audio bu xatoni ushlamaydi → konsolda "Unhandled rejection").
 *   Shuning uchun `hasUserGesture()` false bo'lsa umuman chalmaymiz.
 * - iOS'da har audio element bir marta foydalanuvchi bosishi ichida chalinsa,
 *   keyin bosishsiz ham (masalan ekran ochilganda) chalina oladi. Shuning uchun
 *   pleerlar navbatga qo'yiladi va har bosishda bir nechtasi jim holda
 *   "ochiladi" — birinchi bosishda eng kerakli effektlar, qolganlari keyingi
 *   bosishlarda (arzon telefonlarda bir zumda 30 ta faylni dekodlamaslik uchun).
 * - Faqat haqiqiy faollashtiruvchi hodisalar tinglanadi: click, touchend,
 *   keydown (spec bo'yicha sensorli pointerdown faollashtirmaydi).
 */
import type { AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

type Entry = { key: string; get: () => AudioPlayer | null };

const queue: Entry[] = [];
const primed = new Set<string>();
let gestured = false;
let listening = false;
let batches = 0;

const EVENTS = ['click', 'touchend', 'keydown'] as const;

export function hasUserGesture(): boolean {
  if (Platform.OS !== 'web') return true;
  const ua = typeof navigator !== 'undefined' ? (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation : undefined;
  return gestured || !!ua?.hasBeenActive;
}

/** Ilova o'qiyotgan matnni (expo-speech) bo'lib qo'ymaslik uchun. */
export function isSpeechBusy(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return !!window.speechSynthesis?.speaking;
  } catch {
    return false;
  }
}

function onGesture() {
  gestured = true;
  const n = batches === 0 ? 8 : 5;
  batches += 1;
  let done = 0;
  while (queue.length && done < n) {
    const e = queue.shift()!;
    if (primed.has(e.key)) continue;
    primed.add(e.key);
    done += 1;
    try {
      const p = e.get();
      if (!p || p.playing) continue;
      // Jim holda oxirigacha chalinadi (pause() qilinmaydi — aks holda brauzer
      // "play() interrupted" xatosini chiqaradi). Haqiqiy chalishda muted=false.
      p.muted = true;
      p.play();
    } catch {
      // e'tiborsiz
    }
  }
  if (!queue.length) stopListening();
}

function stopListening() {
  if (!listening) return;
  listening = false;
  EVENTS.forEach((ev) => document.removeEventListener(ev, onGesture, true));
}

/** Pleerlarni ochish navbatiga qo'shish (`front` — navbat boshiga). */
export function enqueuePrime(entries: Entry[], front = false) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const fresh = entries.filter((e) => !primed.has(e.key));
  if (front) queue.unshift(...fresh);
  else queue.push(...fresh);
  if (!listening && queue.length) {
    listening = true;
    EVENTS.forEach((ev) => document.addEventListener(ev, onGesture, true));
  }
}

