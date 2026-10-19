/**
 * "lessons" guruhining ma'lumot qatlami. Hamma hisob-kitob eski ilovadagi
 * bilan bir xil (roadmap/[courseId].tsx, lessonContent.getLessonLockMap):
 * 72 ta dars, juft indeks — videodars, toq — jonli dars, qulf qoidalari
 * getLessonLockMap'dan olinadi. Shu sabab v2 va eski ilova bir xil holatni ko'rsatadi.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { COURSE_TOTAL_LESSONS, getLessonContent, getLessonLockMap, mergeLessonContent, type LessonContent } from '@/data/lessonContent';
import { fetchMobileContent, type AdminModuleContent, type MobileContent } from '@/services/contentApi';
import { getCategoryProgress, getLessonProgress, loadLessonProgress } from '@/services/lessonProgressStore';
import { getStudent, ready as authReady } from '@/services/studentAuthStore';

export const MONTH_SIZE = 24; // 72 dars = 3 oy
export const EXAM_INTERVAL = 12; // data/certificates.ts INTERVAL_SIZE bilan bir xil

export type LessonInfo = {
  id: string;
  index: number; // 0 dan
  number: number; // 1 dan
  name: string;
  isVideo: boolean;
  locked: boolean;
  percent: number;
  completed: boolean;
  attendanceTaken: boolean;
  content: LessonContent;
};

export type CourseData = {
  mc: MobileContent;
  lang: 'english' | 'russian';
  lessons: LessonInfo[];
  activeIndex: number;
};

export async function loadCourseData(): Promise<CourseData | null> {
  await loadLessonProgress();
  const mc = await fetchMobileContent();
  const course = mc.courses[0];
  if (!course) return null;
  const lang: 'english' | 'russian' = course.lang === 'russian' ? 'russian' : 'english';
  const lockMap = await getLessonLockMap();
  const admin = mc.lessons.filter((l) => l.courseId === course.id);
  const lessons: LessonInfo[] = [];
  for (let i = 0; i < COURSE_TOTAL_LESSONS; i++) {
    const l = admin[i];
    const id = l?.id ?? String(i + 1);
    const isVideo = i % 2 === 0;
    const content = mergeLessonContent(getLessonContent(id, i, lang), mc.lessonContents[id]);
    const percent = lessonPercent(id, isVideo, content);
    const locked = !!lockMap[id];
    lessons.push({
      id,
      index: i,
      number: i + 1,
      name: l?.name ?? `${i + 1}-dars`,
      isVideo,
      locked,
      percent,
      completed: !locked && percent >= 100,
      attendanceTaken: !!l?.attendanceTaken,
      content,
    });
  }
  // Joriy dars — eski yo'ldagi kabi ochilgan darslarning eng oxirgisi.
  const activeIndex = Math.max(0, lessons.filter((x) => !x.locked).length - 1);
  return { mc, lang, lessons, activeIndex };
}

export function lessonPercent(id: string, isVideo: boolean, content: LessonContent) {
  return Math.round(
    (getCategoryProgress(id, isVideo ? 'video' : 'speaking') +
      getCategoryProgress(id, 'vocabulary') +
      getCategoryProgress(id, 'homework', content.homeworkParts.length)) /
      3,
  );
}

/** "Kafe va restoranda — «Можно меню?»" → sarlavha + ruscha ibora. */
export function splitTitle(name: string): { title: string; phrase: string } {
  const m = name.match(/^(.*?)\s+[—–-]\s+(.+)$/);
  if (m) return { title: m[1], phrase: m[2] };
  return { title: name, phrase: '' };
}

export const hasCyrillic = (s: string) => /[Ѐ-ӿ]/.test(s);

// ─── Audio dialoglar ────────────────────────────────────────────────────────
// CRM'da darsga alohida "audio" turi yo'q — admin modulga havola sifatida
// audio fayl (mp3/m4a/wav/ogg/aac) biriktiradi. Darsning modullaridagi
// shunday havolalar shu darsning audio dialoglari hisoblanadi.
const AUDIO_RE = /\.(mp3|m4a|wav|ogg|oga|aac|webm)(\?|#|$)/i;

export type AudioTrack = { id: string; title: string; url: string; duration?: string; coverUrl?: string };

export function getAudioTracks(mc: MobileContent, lessonId: string): AudioTrack[] {
  const modules = mc.modules.filter((m) => m.lessonId === lessonId);
  const tracks: AudioTrack[] = [];
  modules.forEach((mod) => {
    const contents = mc.moduleContents.filter((c) => c.moduleId === mod.id);
    const cover = contents.find((c) => c.type === 'image' && c.url)?.url;
    contents
      .filter((c: AdminModuleContent) => !!c.url && AUDIO_RE.test(c.url))
      .forEach((c) => tracks.push({ id: c.id, title: c.name || mod.name, url: c.url!, duration: mod.duration, coverUrl: cover }));
  });
  return tracks;
}

// Tinglangan dialoglar — serverda bunday belgi yo'q, shuning uchun
// qurilmada (o'quvchi bo'yicha alohida kalitda) saqlanadi.
const LISTENED_KEY = 'mh_v2_audio_listened';
let listened: Record<string, string[]> = {};
let listenedLoaded: Promise<void> | null = null;
let listenedKey = LISTENED_KEY;
const listeners = new Set<() => void>();

function loadListened() {
  if (!listenedLoaded) {
    listenedLoaded = (async () => {
      await authReady();
      const sid = getStudent()?.id;
      listenedKey = sid ? `${LISTENED_KEY}:${sid}` : LISTENED_KEY;
      try {
        const raw = await AsyncStorage.getItem(listenedKey);
        listened = raw ? JSON.parse(raw) : {};
      } catch {
        listened = {};
      }
    })();
  }
  return listenedLoaded;
}

export function getListened(lessonId: string): string[] {
  return listened[lessonId] ?? [];
}

export async function markListened(lessonId: string, trackId: string) {
  await loadListened();
  const cur = new Set(listened[lessonId] ?? []);
  if (cur.has(trackId)) return;
  cur.add(trackId);
  listened = { ...listened, [lessonId]: [...cur] };
  listeners.forEach((l) => l());
  try {
    await AsyncStorage.setItem(listenedKey, JSON.stringify(listened));
  } catch {
    // Xotiraga yozib bo'lmasa jim o'tamiz.
  }
}

export function useListened(lessonId: string): string[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadListened().then(() => setTick((t) => t + 1));
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [lessonId]);
  return getListened(lessonId);
}

// ─── Dars qadamlari (dizayn: 5 qadam) ───────────────────────────────────────
// 1) Yangi so'zlar 2) Audio dialoglar 3) Jonli dars / Videodars
// 4) Uyga vazifa 5) Darsni yakunlash. 1, 3, 4 — eski ilovaning progress
// kategoriyalari (markDone bilan), 2 — tinglangan dialoglar.
export type StepKey = 'vocab' | 'audio' | 'main' | 'homework' | 'complete';
export type Step = { key: StepKey; done: boolean; fraction: number };

export function lessonSteps(lesson: Pick<LessonInfo, 'id' | 'isVideo' | 'content'>, audioTotal: number, listenedCount: number): Step[] {
  const p = getLessonProgress(lesson.id);
  const vocab = getCategoryProgress(lesson.id, 'vocabulary') / 100;
  const audio = audioTotal > 0 ? Math.min(1, listenedCount / audioTotal) : 1;
  const main = (lesson.isVideo ? p.videoWatch : p.slidesWatch) ? 1 : 0;
  const hw = getCategoryProgress(lesson.id, 'homework', lesson.content.homeworkParts.length) / 100;
  const first4 = [vocab, audio, main, hw];
  const allDone = first4.every((f) => f >= 1);
  const keys: StepKey[] = ['vocab', 'audio', 'main', 'homework', 'complete'];
  return [...first4, allDone ? 1 : 0].map((f, i) => ({ key: keys[i], done: f >= 1, fraction: f }));
}

export function stepsDone(steps: Step[]) {
  return steps.filter((s) => s.done).length;
}

/** Birinchi bajarilmagan qadam (hammasi bajarilgan bo'lsa — oxirgisi). */
export function currentStep(steps: Step[]) {
  const i = steps.findIndex((s) => !s.done);
  return i < 0 ? steps.length - 1 : i;
}

export const pad = (n: number) => String(n).padStart(2, '0');

const WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];

export function whenLabel(date: Date, now = new Date()) {
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((d1 - d0) / 86400000);
  if (diff === 0) return `bugun ${time}`;
  if (diff === 1) return `ertaga ${time}`;
  return `${WEEKDAYS[date.getDay()]} ${pad(date.getDate())}.${pad(date.getMonth() + 1)} ${time}`;
}

export function fmtTime(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** Orqaga: tarix bo'lsa ortga, bo'lmasa ota ekranga. */
export { goBack } from '@/components/v2/settings/parts';

// ─── Jadval: kelgusi darslar sanasi ─────────────────────────────────────────
// demo-schedule navbatdagi jonli dars vaqtini (startsAt) va hafta kunlari
// patternini (mwf/tts) beradi. startsAt — joriy darsdan keyingi birinchi
// jonli dars deb olinadi, undan keyingi darslar pattern kunlariga navbat bilan tushadi.
const PATTERN: Record<'mwf' | 'tts', number[]> = { mwf: [1, 3, 5], tts: [2, 4, 6] };

export function scheduleDates(startsAt: Date, pattern: 'mwf' | 'tts', activeIndex: number, upto: number): Record<number, Date> {
  const out: Record<number, Date> = {};
  let idx = activeIndex % 2 === 1 ? activeIndex : activeIndex + 1;
  const days = PATTERN[pattern] ?? PATTERN.mwf;
  const cur = new Date(startsAt);
  out[idx] = new Date(cur);
  while (idx < upto) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay() === 0 ? 7 : cur.getDay();
    if (days.includes(dow)) {
      idx += 1;
      out[idx] = new Date(cur);
    }
  }
  return out;
}

const SHORT = ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha'];
const FULL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
export const shortDay = (d: Date) => `${SHORT[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
export const fullDay = (d: Date) => `${FULL[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
