/**
 * "lessons" guruhining ma'lumot qatlami. Hamma hisob-kitob eski ilovadagi
 * bilan bir xil (roadmap/[courseId].tsx, lessonContent.getLessonLockMap):
 * 72 ta dars, juft indeks — videodars, toq — jonli dars, qulf qoidalari
 * getLessonLockMap'dan olinadi. Shu sabab v2 va eski ilova bir xil holatni ko'rsatadi.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { isTeacherGraded, partLetter, partQuestionCount } from '@/components/v2/homework/lib';
import { COURSE_TOTAL_LESSONS, getLessonContent, getLessonLockMap, mergeLessonContent, type HomeworkPart, type LessonContent } from '@/data/lessonContent';
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
// Asosiy manba — CRM'dagi "Audio dialoglar" (lessonContents[id].audioDialogs):
// audio, matn (replikalar), kitob qismi va trek raqami bilan. Eski usul ham
// qo'llab-quvvatlanadi: admin modulga havola sifatida audio fayl
// (mp3/m4a/wav/ogg/aac) biriktirgan bo'lsa, u ham shu darsning dialogi.
const AUDIO_RE = /\.(mp3|m4a|wav|ogg|oga|aac|webm)(\?|#|$)/i;

export type AudioTrack = {
  id: string;
  title: string;
  url: string;
  duration?: string;
  coverUrl?: string;
  /** Faqat CRM audio dialoglarida — aniq qiymatlar (taxminiy emas). */
  durationSec?: number;
  bookPart?: number;
  trackNo?: number;
  lines?: DialogLine[];
};

export function getAudioTracks(mc: MobileContent, lessonId: string): AudioTrack[] {
  const tracks: AudioTrack[] = (mc.lessonContents[lessonId]?.audioDialogs ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    url: d.audioUrl,
    duration: d.durationSec ? fmtTime(d.durationSec) : undefined,
    coverUrl: d.coverUrl,
    durationSec: d.durationSec,
    bookPart: d.bookPart,
    trackNo: d.trackNo,
    lines: d.lines,
  }));
  const modules = mc.modules.filter((m) => m.lessonId === lessonId);
  modules.forEach((mod) => {
    const contents = mc.moduleContents.filter((c) => c.moduleId === mod.id);
    const cover = contents.find((c) => c.type === 'image' && c.url)?.url;
    contents
      .filter((c: AdminModuleContent) => !!c.url && AUDIO_RE.test(c.url))
      .forEach((c) => tracks.push({ id: c.id, title: c.name || mod.name, url: c.url!, duration: mod.duration, coverUrl: cover }));
  });
  return tracks;
}

// Serverda saqlanmaydigan kichik belgilar (tinglangan dialoglar, ko'rilgan
// so'z kartalari) — qurilmada, o'quvchi bo'yicha alohida kalitda saqlanadi.
function makeLocalSets(baseKey: string) {
  let data: Record<string, string[]> = {};
  let loaded: Promise<void> | null = null;
  let key = baseKey;
  const subs = new Set<() => void>();
  const load = () => {
    if (!loaded) {
      loaded = (async () => {
        await authReady();
        const sid = getStudent()?.id;
        key = sid ? `${baseKey}:${sid}` : baseKey;
        try {
          const raw = await AsyncStorage.getItem(key);
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = {};
        }
      })();
    }
    return loaded;
  };
  const get = (lessonId: string): string[] => data[lessonId] ?? [];
  const mark = async (lessonId: string, itemId: string) => {
    await load();
    const cur = new Set(data[lessonId] ?? []);
    if (cur.has(itemId)) return;
    cur.add(itemId);
    data = { ...data, [lessonId]: [...cur] };
    subs.forEach((l) => l());
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch {
      // Xotiraga yozib bo'lmasa jim o'tamiz.
    }
  };
  const useSet = (lessonId: string): string[] => {
    const [, setTick] = useState(0);
    useEffect(() => {
      load().then(() => setTick((t) => t + 1));
      const l = () => setTick((t) => t + 1);
      subs.add(l);
      return () => {
        subs.delete(l);
      };
    }, [lessonId]);
    return get(lessonId);
  };
  return { load, get, mark, useSet };
}

const listenedStore = makeLocalSets('mh_v2_audio_listened');
export const getListened = listenedStore.get;
export const markListened = listenedStore.mark;
export const useListened = listenedStore.useSet;

// Ko'rilgan so'z kartalari — "8 / 8 o'rganildi" va kartochkadagi belgi shundan.
const seenWordsStore = makeLocalSets('mh_v2_vocab_seen');
export const getSeenWords = seenWordsStore.get;
export const markWordSeen = seenWordsStore.mark;
export const useSeenWords = seenWordsStore.useSet;

/** O'rganilgan so'zlar: so'zlar qadami bajarilgan bo'lsa — hammasi, aks holda kartasi ochilganlari. */
export function learnedWordIds(lessonId: string, wordIds: string[], seen: string[]): Set<string> {
  if (getCategoryProgress(lessonId, 'vocabulary') >= 100) return new Set(wordIds);
  return new Set(wordIds.filter((w) => seen.includes(w)));
}

// ─── Dialog matni ──────────────────────────────────────────────────────────
// Dialog matni — CRM audio dialogida tayyor replikalar (speaker/ru/uz, start);
// eski usulda — audio bilan bir moduldagi "Matn" kontenti: "Ism: ruscha gap"
// qatoridan keyingi qator — o'zbekcha tarjimasi.
export type DialogLine = { speaker: string; ru: string; uz: string; start?: number };

export const SPEAKER_COLORS = ['#B34700', '#0B1220', '#1E3FD1', '#087A4A'];

export function parseDialog(text: string): DialogLine[] {
  const out: DialogLine[] = [];
  text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((row) => {
      const m = row.match(/^([^:]{1,24}):\s*(.+)$/);
      if (m) out.push({ speaker: m[1].trim(), ru: m[2].trim(), uz: '' });
      else if (out.length && !out[out.length - 1].uz) out[out.length - 1].uz = row;
    });
  return out;
}

export function trackLines(mc: MobileContent, track: Pick<AudioTrack, 'id' | 'lines'>): DialogLine[] {
  if (track.lines) return track.lines;
  const content = mc.moduleContents.find((c) => c.id === track.id);
  if (!content) return [];
  const text = mc.moduleContents.find((c) => c.moduleId === content.moduleId && c.type === 'text' && c.text)?.text;
  return text ? parseDialog(text) : [];
}

/**
 * Replikalar boshlanish soniyalari. CRM'da start berilgan bo'lsa — shu
 * (berilmaganlari qo'shni ma'lum vaqtlar orasida teng taqsimlanadi);
 * umuman bo'lmasa — audio davomiyligi replikalar soniga teng bo'linadi.
 */
export function lineStarts(lines: DialogLine[], duration: number): number[] {
  const n = lines.length;
  if (!n) return [];
  const known = lines.map((l) => (typeof l.start === 'number' && Number.isFinite(l.start) ? Math.max(0, l.start) : null));
  if (known.every((x) => x === null)) return lines.map((_, k) => (duration > 0 ? (k / n) * duration : 0));
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const v = known[k];
    if (v !== null) {
      out.push(v);
      continue;
    }
    let a = k - 1;
    while (a >= 0 && known[a] === null) a--;
    let b = k + 1;
    while (b < n && known[b] === null) b++;
    const t0 = a >= 0 ? known[a]! : 0;
    const t1 = b < n ? known[b]! : duration > t0 ? duration : t0;
    out.push(t0 + ((t1 - t0) * (k - a)) / (b - a));
  }
  return out;
}

/** Joriy replika: boshlanishi o'tgan oxirgi replika (aniq vaqtlarda — birinchisidan oldin -1). */
export function lineAt(starts: number[], t: number): number {
  let cur = -1;
  for (let k = 0; k < starts.length; k++) if (starts[k] <= t + 0.05) cur = k;
  return cur;
}

/** Gapirayotganlar ro'yxati (tartib bilan) — avatar rangi shu tartibdan. */
export const speakersOf = (lines: DialogLine[]) => Array.from(new Set(lines.map((l) => l.speaker)));
export const speakerColor = (speakers: string[], name: string) => SPEAKER_COLORS[Math.max(0, speakers.indexOf(name)) % SPEAKER_COLORS.length];

/** Kitob qismi — har oy (24 dars) kitobning bir qismi. */
export const bookPart = (index: number) => Math.floor(index / MONTH_SIZE) + 1;

/** Trekning kitob qismidagi tartib raqami — shu qismdagi oldingi darslar audiolari ham sanaladi. */
export function bookTrackNo(mc: MobileContent, lessons: Pick<LessonInfo, 'id' | 'index'>[], lessonIndex: number, trackIdx: number) {
  const start = (bookPart(lessonIndex) - 1) * MONTH_SIZE;
  let n = 0;
  for (const l of lessons) if (l.index >= start && l.index < lessonIndex) n += getAudioTracks(mc, l.id).length;
  return n + trackIdx + 1;
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

// ─── Uyga vazifa xulosasi (Dars, Yo'l va "dars yopiq" oynasi uchun) ────────
// Vazifa ekranidagi hisob bilan bir xil: avtomatik tekshiriladigan qismlar
// savollari, javob berilganlari (scoreStore) va bajarilgan qismlar (progress).
export type HwSummary = { letters: string[]; answered: number; total: number; done: boolean };

export function homeworkSummary(
  lesson: Pick<LessonInfo, 'id' | 'content'>,
  scores: Record<string, { answered?: number; finished?: boolean }> | undefined,
): HwSummary {
  const p = getLessonProgress(lesson.id);
  const auto = lesson.content.homeworkParts.filter((x) => !isTeacherGraded(x));
  const isDone = (x: HomeworkPart) => !!p.homeworkParts[x.id] || !!scores?.[x.id]?.finished;
  let answered = 0;
  let total = 0;
  auto.forEach((x) => {
    const n = partQuestionCount(x);
    total += n;
    answered += isDone(x) ? n : Math.min(n, scores?.[x.id]?.answered ?? 0);
  });
  // Hali tugamagan qismlar harflari ("B + C"); hammasi tugagan bo'lsa — barcha harflar.
  const open = auto.filter((x) => !isDone(x));
  const letters = (open.length ? open : auto).map((x) => partLetter(x)).filter((l): l is string => !!l);
  return { letters, answered, total, done: auto.length > 0 && open.length === 0 };
}

// ─── Tez tekshiruv (dialog tugagach) ───────────────────────────────────────
// Savollar dialogning o'zidan tuziladi: oldingi replika kontekst sifatida
// ko'rsatiladi, keyingi replika — to'g'ri javob; noto'g'ri variantlar —
// shu darsdagi boshqa replikalar. Tartib har safar bir xil (tasodifiy emas).
export const QUICK_CHECK_MAX = 4;

export type QuickQuestion = { context: DialogLine; answer: DialogLine; options: string[]; correct: number };

export function buildQuickCheck(lines: DialogLine[], pool: DialogLine[]): QuickQuestion[] {
  const out: QuickQuestion[] = [];
  for (let k = 1; k < lines.length && out.length < QUICK_CHECK_MAX; k++) {
    const answer = lines[k];
    const context = lines[k - 1];
    const others = [...lines, ...pool]
      .map((l) => l.ru)
      .filter((ru, i, arr) => ru !== answer.ru && ru !== context.ru && arr.indexOf(ru) === i);
    const distract = [others[(k * 2) % Math.max(1, others.length)], others[(k * 2 + 1) % Math.max(1, others.length)]]
      .filter((x, i, arr): x is string => !!x && arr.indexOf(x) === i);
    const correct = k % (distract.length + 1);
    const options = [...distract];
    options.splice(correct, 0, answer.ru);
    out.push({ context, answer, options, correct });
  }
  return out;
}
