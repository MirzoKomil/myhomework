/**
 * Kutubxona ekranlari uchun ma'lumot yig'uvchilar — faqat mavjud
 * servislardan (contentApi, lessonProgressStore) va shu qurilmada
 * saqlanadigan tinglash joylaridan.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getAudioTracks, getListened, type AudioTrack } from '@/components/v2/lessons/data';
import type { MobileContent } from '@/services/contentApi';
import { getStudent, ready as authReady } from '@/services/studentAuthStore';

import { courseLessons, type LessonRef } from './shared';

/* ---- Kitob audio treklari ----
 * Darslik audiosi — CRM'da dars modullariga biriktirilgan audio fayllar
 * (dars ichidagi "Audio dialoglar" bilan bir xil manba: getAudioTracks).
 * Trek raqami — CRM audio dialogida kiritilgan kitob trek raqami (bo'lsa),
 * aks holda kurs bo'yicha tartib raqami (1-darsdan boshlab ketma-ket).
 * Kitob "qism"i (1-/2-qism) serverda yo'q — ko'rsatilmaydi.
 */
export type BookTrack = AudioTrack & { no: number; lesson: LessonRef; heard: boolean };
export type LessonTracks = LessonRef & { tracks: BookTrack[] };

export function allBookTracks(mc: MobileContent): BookTrack[] {
  const out: BookTrack[] = [];
  courseLessons(mc).forEach((lesson, index) => {
    const heard = getListened(lesson.id);
    getAudioTracks(mc, lesson.id).forEach((t) => {
      out.push({ ...t, no: t.trackNo ?? out.length + 1, lesson: { lesson, index, number: index + 1 }, heard: heard.includes(t.id) });
    });
  });
  return out;
}

/** Darslar bo'yicha guruhlangan treklar (joriy darsdan orqaga). */
export function groupByLesson(tracks: BookTrack[], uptoIndex: number): LessonTracks[] {
  const map = new Map<string, LessonTracks>();
  tracks
    .filter((t) => t.lesson.index <= uptoIndex)
    .forEach((t) => {
      const g = map.get(t.lesson.lesson.id) ?? { ...t.lesson, tracks: [] };
      g.tracks.push(t);
      map.set(t.lesson.lesson.id, g);
    });
  return [...map.values()].sort((a, b) => b.index - a.index);
}

/** Ro'yxatda nom qo'shtirnoqsiz ko'rsatiladi (dizayndagidek); sarlavhada «…» qayta qo'yiladi. */
export const bare = (s: string) => s.replace(/^[«"„]+|[»"“]+$/g, '').trim();

/** "0:48" kabi qatorni soniyaga (yo'q bo'lsa — 0). */
export function parseDur(d?: string): number {
  const m = d ? /^(\d+):(\d{2})$/.exec(d.trim()) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/* ---- Qurilmadagi tinglash joylari (o'quvchi bo'yicha alohida kalit) ---- */

type PosMap = Record<string, { t: number; d: number }>;
type Store<T> = { key: string; cache: T | null };

async function keyFor(base: string) {
  await authReady().catch(() => {});
  const sid = getStudent()?.id;
  return sid ? `${base}:${sid}` : base;
}
async function load<T extends object>(st: Store<T>, base: string): Promise<T> {
  if (st.cache) return st.cache;
  st.key = await keyFor(base);
  try {
    const raw = await AsyncStorage.getItem(st.key);
    st.cache = raw ? (JSON.parse(raw) as T) : ({} as T);
  } catch {
    st.cache = {} as T;
  }
  return st.cache;
}
async function save<T>(st: Store<T>) {
  try {
    await AsyncStorage.setItem(st.key, JSON.stringify(st.cache));
  } catch {
    // Xotiraga yozib bo'lmasa — jim o'tamiz (maxfiy rejim).
  }
}

/** Kitob treki: qayerda to'xtagan (soniya) va davomiyligi — AudioList'dagi "davom etmoqda · 0:21". */
const trackSt: Store<PosMap> = { key: '', cache: null };
export async function getTrackPositions(): Promise<PosMap> {
  return { ...(await load(trackSt, 'mh_v2_track_position')) };
}
export async function saveTrackPosition(trackId: string, t: number, d: number) {
  const p = await load(trackSt, 'mh_v2_track_position');
  if (t <= 0.5 || (d > 0 && t >= d - 0.5)) delete p[trackId];
  else p[trackId] = { t, d };
  await save(trackSt);
}

/** Mavzudagi dialoglar soni — CRM'da speaking mavzusi = bitta dialog (replikalar ro'yxati). */
export const dialogCount = (t: { lines?: unknown[] }) => (t.lines?.length ? 1 : 0);

/** Kutubxona dialogi (speaking mavzusi): eshitilganmi va qayergacha (0..1). */
type DialogMap = Record<string, { heard?: boolean; frac?: number }>;
const dialogSt: Store<DialogMap> = { key: '', cache: null };
export async function getDialogProgress(): Promise<DialogMap> {
  return { ...(await load(dialogSt, 'mh_v2_dialog_progress')) };
}
export async function saveDialogProgress(topicId: string, frac: number, heard?: boolean) {
  const p = await load(dialogSt, 'mh_v2_dialog_progress');
  const cur = p[topicId] ?? {};
  p[topicId] = { heard: cur.heard || !!heard, frac: heard ? 0 : Math.max(0, Math.min(1, frac)) };
  await save(dialogSt);
}

/* ---- Hikoya tinglash joyi (foiz) — StoryList'dagi "30%" uchun ---- */

const POS_KEY = 'mh_v2_story_position';
let posCache: Record<string, number> | null = null;

async function loadPos(): Promise<Record<string, number>> {
  if (posCache) return posCache;
  try {
    const raw = await AsyncStorage.getItem(POS_KEY);
    posCache = raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    posCache = {};
  }
  return posCache;
}

/** 0..1 — hikoya matnining qancha qismi tinglangan. */
export async function getStoryPositions(): Promise<Record<string, number>> {
  return { ...(await loadPos()) };
}

export async function saveStoryPosition(storyId: string, fraction: number) {
  const p = await loadPos();
  p[storyId] = Math.max(0, Math.min(1, fraction));
  try {
    await AsyncStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    // Xotiraga yozib bo'lmasa — jim o'tamiz (maxfiy rejim).
  }
}
