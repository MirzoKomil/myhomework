/**
 * Kutubxona ekranlari uchun ma'lumot yig'uvchilar — faqat mavjud
 * servislardan (contentApi, lessonContent, lessonProgressStore).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getResolvedLessonContent, type HomeworkPart } from '@/data/lessonContent';
import type { MobileContent } from '@/services/contentApi';
import { getLessonProgress, loadLessonProgress } from '@/services/lessonProgressStore';

import { courseLessons, type LessonRef } from './shared';

type RoleplayPart = Extract<HomeworkPart, { kind: 'roleplay' }>;

export type AudioTrack = { partId: string; title: string; heard: boolean; trackNo: number };
export type LessonTracks = LessonRef & { tracks: AudioTrack[] };

/**
 * Darslikdagi audio treklar ilovada alohida saqlanmaydi (QR/trek ma'lumoti
 * serverda yo'q). Darsga eng yaqin real "audio dialog" — CRM'da kiritilgan
 * rolli dialog (homeworkParts, kind: 'roleplay'); shular trek sifatida
 * ko'rsatiladi. "Eshitilgan" — o'sha qism bajarilganmi (lessonProgressStore).
 */
export async function loadLessonTracks(mc: MobileContent, uptoIndex: number): Promise<LessonTracks[]> {
  await loadLessonProgress().catch(() => {});
  const lessons = courseLessons(mc);
  const out: LessonTracks[] = [];
  for (let i = Math.min(uptoIndex, lessons.length - 1); i >= 0; i--) {
    const lesson = lessons[i];
    const content = await getResolvedLessonContent(lesson.id, i).catch(() => null);
    if (!content) continue;
    const done = getLessonProgress(lesson.id).homeworkParts;
    const parts = content.homeworkParts.filter((p): p is RoleplayPart => p.kind === 'roleplay');
    if (!parts.length) continue;
    out.push({
      lesson,
      index: i,
      number: i + 1,
      tracks: parts.map((p, k) => ({ partId: p.id, title: p.scenario.title || p.title, heard: !!done[p.id], trackNo: k + 1 })),
    });
  }
  return out;
}

/* ---- Hikoya tinglash joyi (foiz) — StoryList'dagi "60%" uchun ---- */

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
