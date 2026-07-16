import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// 150-ish: haqiqiy o'quvchi login-parol bilan kirganda uning tokeni shu
// yerda saqlanadi. Kalit ataylab CRM'ning o'z tokenidan ('mh_token',
// js/api.js) farqli — CRM'ning "O'quvchi ilovasi" ko'rib chiqish tabi
// /student/'ni bir xil origin'dagi iframe'da ochadi, shuning uchun
// AsyncStorage (web'da localStorage) ikkalasi uchun umumiy — kalitlar
// to'qnashmasligi kerak.
const TOKEN_KEY = 'mh_student_token';
const STUDENT_KEY = 'mh_student_info';

export type StudentInfo = { id: string; name: string; login: string };

let token: string | null = null;
let student: StudentInfo | null = null;
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
    loadPromise = Promise.all([AsyncStorage.getItem(TOKEN_KEY), AsyncStorage.getItem(STUDENT_KEY)])
      .then(([t, s]) => {
        token = t;
        student = s ? JSON.parse(s) : null;
      })
      .catch(() => {})
      .finally(() => {
        loaded = true;
      });
  }
  return loadPromise;
}

export function getToken(): string | null {
  return token;
}

export function getStudent(): StudentInfo | null {
  return student;
}

export function isLoggedIn(): boolean {
  return !!token;
}

export async function loadAuth(): Promise<void> {
  await ensureLoaded();
  notify();
}

export async function setAuth(newToken: string, newStudent: StudentInfo): Promise<void> {
  token = newToken;
  student = newStudent;
  loaded = true;
  notify();
  try {
    await Promise.all([AsyncStorage.setItem(TOKEN_KEY, newToken), AsyncStorage.setItem(STUDENT_KEY, JSON.stringify(newStudent))]);
  } catch {
    // Xotiraga yozib bo'lmasa jim o'tkazib yuboramiz — token barcha holatda
    // xotirada (RAM'da) mavjud bo'lib qoladi.
  }
}

export async function clearAuth(): Promise<void> {
  token = null;
  student = null;
  notify();
  try {
    await Promise.all([AsyncStorage.removeItem(TOKEN_KEY), AsyncStorage.removeItem(STUDENT_KEY)]);
  } catch {
    // yozib bo'lmasa ham jim o'tkazib yuboramiz
  }
}

export function useAuth(): { token: string | null; student: StudentInfo | null } {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadAuth().then(() => setTick((t) => t + 1));
    return subscribe(() => setTick((t) => t + 1));
  }, []);
  return { token, student };
}
