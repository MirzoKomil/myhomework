/**
 * v2 daraja tizimi (egasi tasdiqlagan yangi oraliqlar). Eski ilova
 * data/levels.ts dan foydalanishda davom etadi — bu fayl faqat v2 uchun.
 *
 * "Hech qachon pasaytirmaslik" qoidasi: o'quvchi shu qurilmada erishgan
 * eng yuqori daraja indeksi AsyncStorage'da saqlanadi. Birinchi ishga
 * tushishda u ESKI oraliqlar bo'yicha hisoblanadi — yangi oraliqlar
 * kengroq bo'lgani uchun hech kim darajasidan tushib qolmasin.
 * Ko'rsatiladigan daraja = max(saqlangan, yangi oraliq bo'yicha).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { getLevelForLightning as getOldLevel, LEVELS, type Level, type LevelKey } from '@/data/levels';
import { getTotalLightning, loadLightning, useLightning } from '@/services/lightningStore';

const MAX_LEVEL_KEY = 'mh_v2_max_level';

// Rasm va tavsif eski ro'yxatdan kalit bo'yicha olinadi (bitta manba).
const base = (key: LevelKey) => LEVELS.find((l) => l.key === key)!;

export const V2_LEVELS: Level[] = [
  { ...base('spark'), name: 'Uchqun', min: 0, max: 300 },
  { ...base('apprentice'), name: 'Shogird', min: 301, max: 1000 },
  { ...base('scholar'), name: 'Bilimdon', min: 1001, max: 2000 },
  { ...base('master'), name: 'Usta', min: 2001, max: 3000 },
  { ...base('legend'), name: 'Domwork afsonasi', min: 3001, max: null },
];

export const V2_TOP_LEVEL = V2_LEVELS.length - 1;

/** Faqat yangi oraliqlar bo'yicha daraja indeksi (saqlangan maksimumsiz). */
export function getV2LevelIndex(total: number): number {
  const i = V2_LEVELS.findIndex((l) => total >= l.min && (l.max === null || total <= l.max));
  return i < 0 ? 0 : i;
}

export function getV2Level(total: number): Level {
  return V2_LEVELS[getV2LevelIndex(total)];
}

export type V2LevelProgress = {
  index: number;
  level: Level;
  next: Level | null;
  remaining: number;
  progressPercent: number;
};

/**
 * Keyingi darajagacha qolgan chaqmoq. `index` — ko'rsatiladigan daraja
 * (saqlangan maksimum oraliqdan yuqori bo'lsa, foiz 0 dan boshlanadi).
 */
export function getV2LevelProgress(total: number, index = getV2LevelIndex(total)): V2LevelProgress {
  const idx = Math.max(0, Math.min(V2_TOP_LEVEL, index));
  const level = V2_LEVELS[idx];
  const next = V2_LEVELS[idx + 1] ?? null;
  if (!next) return { index: idx, level, next: null, remaining: 0, progressPercent: 100 };
  const remaining = Math.max(0, next.min - total);
  const pct = Math.round(((total - level.min) / (next.min - level.min)) * 100);
  return { index: idx, level, next, remaining, progressPercent: Math.min(100, Math.max(0, pct)) };
}

// Saqlangan maksimum — barcha v2 ekranlari uchun bitta umumiy qiymat.
let storedMax: number | null = null;
let maxPromise: Promise<number> | null = null;
const listeners = new Set<() => void>();

function persistMax(idx: number) {
  AsyncStorage.setItem(MAX_LEVEL_KEY, String(idx)).catch(() => {
    // Yozib bo'lmasa — keyingi ochilishda yana hisoblanadi, daraja baribir tushmaydi.
  });
}

function loadMax(): Promise<number> {
  if (!maxPromise) {
    maxPromise = (async () => {
      // Chaqmoq yuklanmasdan 0 bilan boshlab yubormaslik uchun avval kutamiz.
      await loadLightning();
      const total = getTotalLightning();
      const raw = await AsyncStorage.getItem(MAX_LEVEL_KEY).catch(() => null);
      const saved = raw !== null && raw !== '' ? Number(raw) : NaN;
      let idx: number;
      if (Number.isFinite(saved)) {
        idx = Math.max(0, Math.min(V2_TOP_LEVEL, Math.floor(saved)));
      } else {
        // Birinchi marta: eski tizimdagi daraja — hech kim pastga tushmasin.
        const oldIdx = Math.max(0, LEVELS.findIndex((l) => l.key === getOldLevel(total).key));
        idx = oldIdx;
      }
      const best = Math.max(idx, getV2LevelIndex(total));
      if (best !== saved) persistMax(best);
      storedMax = best;
      listeners.forEach((l) => l());
      return best;
    })();
  }
  return maxPromise;
}

/**
 * v2 ekranlari uchun ko'rsatiladigan daraja. Saqlangan maksimum yuklanguncha
 * yangi oraliq bo'yicha qiymat qaytariladi.
 */
export function useV2Level(): V2LevelProgress & { lightning: number } {
  const lightning = useLightning();
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    void loadMax();
    return () => { listeners.delete(l); };
  }, []);

  const fromTotal = getV2LevelIndex(lightning);
  const index = Math.max(storedMax ?? 0, fromTotal);

  // Daraja ko'tarilsa — yangi maksimumni saqlaymiz (keyin hech qachon tushmaydi).
  useEffect(() => {
    if (storedMax !== null && fromTotal > storedMax) {
      storedMax = fromTotal;
      persistMax(fromTotal);
      listeners.forEach((l) => l());
    }
  }, [fromTotal]);

  return { ...getV2LevelProgress(lightning, index), lightning };
}
