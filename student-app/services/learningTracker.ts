/**
 * Ustoz kabineti (CRM → Akademik bo'lim → Darslik) uchun o'quvchining
 * ilovadagi faolligi: qaysi darsda, qaysi bo'limda qancha vaqt o'tkazgani va
 * uy vazifasi qismlarining natijasi (to'g'ri/jami, xato qilingan savollar).
 *
 * Qoidalar:
 * - "Faol vaqt": ilova ochiq (oldingi planda) va o'quvchi faol bo'lganda
 *   hisoblanadi: 2 daqiqa (web) / 10 daqiqa (telefon) hech narsaga
 *   tegilmasa, hisob to'xtaydi. Video, audio va slayd bo'limlarida — 25 daqiqa;
 *   video/audio ijro etilayotgan bo'lsa yoki YouTube pleyer fokusda bo'lsa — faol.
 * - Har 60 soniyada va ilova fonga o'tganda serverga yuboriladi; tarmoq
 *   bo'lmasa navbatda qoladi va keyingi safar ketadi.
 * - O'quvchi tajribasiga hech qachon ta'sir qilmaydi (xatolar jim o'tadi).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';

import { authedFetch } from '@/services/contentApi';
import { getStudent, ready as authReady } from '@/services/studentAuthStore';

const API =
  Platform.OS === 'web'
    ? '/api/academic/track'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/academic/track';
const QUEUE_KEY = 'mh_v2_learning_queue';
const TICK_MS = 5000;
const FLUSH_MS = 60000;
const IDLE_MS = Platform.OS === 'web' ? 2 * 60000 : 10 * 60000;
// Video/audio/slayd ko'rishda o'quvchi ekranga tegmasligi mumkin (YouTube
// iframe'dagi ijroni sahifa sezmaydi) — shu bo'limlarda kutish uzunroq.
const MEDIA_SECTIONS = new Set(['video', 'audio', 'slaydlar']);
const MEDIA_IDLE_MS = 25 * 60000;

type TimeEntry = { day: string; lessonId: string; section: string; seconds: number };
type Mistake = { question: string; yourAnswer?: string };
type PartEntry = {
  lessonId: string;
  partId: string;
  kind: string;
  title: string;
  correct: number;
  total: number;
  mistakes: (string | Mistake)[];
};

let context = { lessonId: '', section: 'bosh' };
let lastActivity = Date.now();
let foreground = true;
let mediaPlaying = false;
let started = false;
let buffer: Record<string, TimeEntry> = {};
let parts: PartEntry[] = [];
let flushing = false;

const localDay = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// /v2/dars/<id>/<qadam> → dars + bo'lim; boshqa sahifalar → bo'lim nomi.
const STEP_ALIAS: Record<string, string> = {
  '': 'dars',
  index: 'dars',
  tugadi: 'dars',
  'slaydlar-toliq': 'slaydlar',
  'soz-royxati': 'sozlar',
  'vazifa-natija': 'vazifa',
};

export function contextFromPath(pathname: string): { lessonId: string; section: string } {
  const path = (pathname || '').replace(/^\/student/, '');
  const lesson = path.match(/\/v2\/dars\/([^/?#]+)(?:\/([^/?#]+))?/);
  if (lesson) {
    const step = lesson[2] ?? '';
    const section = (STEP_ALIAS[step] ?? step).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'dars';
    return { lessonId: decodeURIComponent(lesson[1]).slice(0, 160), section };
  }
  const first = path.match(/\/v2\/([^/?#]+)/)?.[1] ?? 'bosh';
  return { lessonId: '', section: first.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'bosh' };
}

export function noteActivity() {
  lastActivity = Date.now();
}

/** v2 layout har sahifa almashganda chaqiradi. */
export function trackPath(pathname: string) {
  context = contextFromPath(pathname);
  noteActivity();
  start();
}

/** Uy vazifasi qismi yakunlanganda (o'tgan yoki o'tmagan) — ustoz xatolarni ko'radi. */
export function reportPartResult(entry: PartEntry) {
  parts.push({
    ...entry,
    mistakes: (entry.mistakes ?? []).slice(0, 30).map((m) =>
      typeof m === 'string' ? m.slice(0, 300) : { question: String(m.question).slice(0, 300), yourAnswer: String(m.yourAnswer ?? '').slice(0, 200) },
    ),
  });
  void flush();
}

function isActive() {
  if (!foreground) return false;
  if (mediaPlaying) return true;
  // Web: fokus iframe ichida (YouTube pleyer bosilgan) — video ko'rilyapti.
  if (Platform.OS === 'web' && typeof document !== 'undefined' && document.activeElement?.tagName === 'IFRAME') return true;
  const limit = MEDIA_SECTIONS.has(context.section) ? MEDIA_IDLE_MS : IDLE_MS;
  return Date.now() - lastActivity < limit;
}

function tick() {
  if (!isActive() || !getStudent()) return;
  const day = localDay();
  const key = `${day}|${context.lessonId}|${context.section}`;
  const entry = buffer[key] ?? { day, lessonId: context.lessonId, section: context.section, seconds: 0 };
  entry.seconds += TICK_MS / 1000;
  buffer[key] = entry;
}

async function loadQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as { time?: TimeEntry[]; parts?: PartEntry[] };
    for (const t of saved.time ?? []) {
      const key = `${t.day}|${t.lessonId}|${t.section}`;
      const cur = buffer[key];
      buffer[key] = cur ? { ...cur, seconds: cur.seconds + t.seconds } : t;
    }
    parts = [...(saved.parts ?? []), ...parts];
  } catch {
    // buzilgan navbat — tashlab yuboramiz
  }
}

async function saveQueue(time: TimeEntry[], pending: PartEntry[]) {
  try {
    if (!time.length && !pending.length) await AsyncStorage.removeItem(QUEUE_KEY);
    else await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify({ time, parts: pending.slice(-30) }));
  } catch {
    // maxfiy rejim
  }
}

export async function flush(keepalive = false) {
  if (flushing) return;
  const time = Object.values(buffer).filter((t) => t.seconds > 0);
  const pending = parts;
  if (!time.length && !pending.length) return;
  await authReady();
  if (!getStudent()) return;
  flushing = true;
  buffer = {};
  parts = [];
  try {
    const res = await authedFetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time: time.slice(0, 60), parts: pending.slice(0, 30) }),
      ...(keepalive ? { keepalive: true } : null),
    });
    if (!res.ok && (res.status >= 500 || res.status === 429)) throw new Error(String(res.status));
    await saveQueue([], []);
  } catch {
    // Tarmoq yo'q — keyingi safar yuboriladi.
    for (const t of time) {
      const key = `${t.day}|${t.lessonId}|${t.section}`;
      const cur = buffer[key];
      buffer[key] = cur ? { ...cur, seconds: cur.seconds + t.seconds } : t;
    }
    parts = [...pending, ...parts];
    await saveQueue(Object.values(buffer), parts);
  } finally {
    flushing = false;
  }
}

function start() {
  if (started) return;
  started = true;
  void loadQueue();
  setInterval(tick, TICK_MS);
  setInterval(() => void flush(), FLUSH_MS);
  AppState.addEventListener('change', (state) => {
    const was = foreground;
    foreground = state === 'active';
    if (foreground && !was) noteActivity();
    if (!foreground) void flush(true);
  });
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const opts = { passive: true, capture: true } as AddEventListenerOptions;
    ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((ev) => document.addEventListener(ev, noteActivity, opts));
    document.addEventListener('play', () => { mediaPlaying = true; }, true);
    ['pause', 'ended'].forEach((ev) => document.addEventListener(ev, () => { mediaPlaying = false; noteActivity(); }, true));
    document.addEventListener('visibilitychange', () => {
      foreground = document.visibilityState === 'visible';
      if (foreground) noteActivity();
      else void flush(true);
    });
  }
}
