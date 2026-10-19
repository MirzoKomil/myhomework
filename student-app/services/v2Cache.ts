/**
 * v2 ekranlari uchun xotiradagi (sessiya) kesh.
 *
 * Pastki menyuda bo'lim almashganda ekran qaytadan yaratiladi va hamma
 * ma'lumot noldan yuklanardi: kartalar avval bo'sh/0 bo'lib chiqib, keyin
 * "sakrab" to'lardi — ilova qotayotgandek tuyulardi. Endi oxirgi qiymat
 * darhol ko'rsatiladi, yangisi fonda yuklanib almashtiriladi.
 * Kalit o'quvchi id'si bilan — boshqa o'quvchi kirsa eski ma'lumot chiqmaydi.
 */
import { useCallback, useState } from 'react';

import { getStudent } from '@/services/studentAuthStore';

const store = new Map<string, unknown>();

const fullKey = (key: string) => `${getStudent()?.id ?? '-'}:${key}`;

export function hasCached(key: string): boolean {
  return store.has(fullKey(key));
}

export function useCachedState<T>(key: string, initial: T | (() => T)): [T, (v: T | ((prev: T) => T)) => void] {
  const k = fullKey(key);
  const [value, setValue] = useState<T>(() =>
    store.has(k) ? (store.get(k) as T) : typeof initial === 'function' ? (initial as () => T)() : initial,
  );
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
        store.set(k, next);
        return next;
      });
    },
    [k],
  );
  return [value, set];
}
