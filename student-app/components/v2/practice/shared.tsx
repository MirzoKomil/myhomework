/**
 * Mashq guruhi uchun umumiy bo'laklar: o'yin sarlavhasi (X tugmasi),
 * Mashq pastki menyusi, joriy dars ma'lumoti va qurilmadagi kichik
 * xotiralar (o'yin rekordlari, shaxsiy lug'at, oxirgi qidiruvlar).
 *
 * Rekord/lug'at/qidiruvlar uchun serverda joy yo'q — shuning uchun
 * faqat shu qurilmada (AsyncStorage) saqlanadi, soxta raqam yo'q.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHomeworkScores, type PartScore } from '@/components/v2/homework/scoreStore';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getResolvedLessonContent, type VocabWord } from '@/data/lessonContent';
import { fetchMobileContent } from '@/services/contentApi';
import { getLastPosition } from '@/services/progressStore';

import { CloseIcon, NavHome, NavPath, NavStar, NavTrophy, NavUser } from './icons';

/** Rus harflari Bricolage'da yo'q: native'da Manrope'ga o'tiladi, webda stack o'zi tushadi. */
export const displayRu = Platform.OS === 'web' ? fonts.display : fonts.displayCyrillic;

export const reset = { fontWeight: 'normal' as const };

// ─── Urg'u belgisi (U+0301, «меню́») ────────────────────────────────────────
// Dizayn rus so'zlarini urg'u bilan ko'rsatadi. O'yin mantig'i (harf
// solishtirish) urg'usiz shakl bilan ishlaydi, ekranda esa kontentdagi
// asl shakl (urg'u bo'lsa — urg'u bilan) chiqadi.
const STRESS_RE = /́/g;
export const plainWord = (w: string) => w.replace(STRESS_RE, '');
/** So'zni harflarga bo'ladi; urg'u belgisi o'zidan oldingi harfga qo'shilib qoladi. */
export function stressLetters(w: string): string[] {
  const out: string[] = [];
  for (const ch of w) {
    if (ch === '́' && out.length) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

/** Orqaga: tarix bo'lsa ortga, bo'lmasa Mashq sahifasiga. */
export function goBack(fallback: string = R.practice) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as Href);
}

// ─── Joriy dars ────────────────────────────────────────────────────────────
export type CurrentLesson = { id: string; number: number; name: string; vocab: VocabWord[] };

// Bosh sahifadagi bilan bir xil: oxirgi ochilgan dars, bo'lmasa faol dars.
export async function loadCurrentLesson(): Promise<CurrentLesson | null> {
  const mc = await fetchMobileContent();
  const course = mc.courses[0];
  if (!course) return null;
  const lessons = mc.lessons.filter((l) => l.courseId === course.id);
  if (!lessons.length) return null;
  const last = await getLastPosition();
  let idx = last ? lessons.findIndex((l) => l.id === last.lessonId) : -1;
  if (idx < 0) idx = lessons.findIndex((l) => l.isActive);
  if (idx < 0) idx = 0;
  const lesson = lessons[idx];
  const content = await getResolvedLessonContent(lesson.id, idx).catch(() => null);
  return { id: lesson.id, number: idx + 1, name: lesson.name, vocab: content?.vocabulary ?? [] };
}

export function useCurrentLesson() {
  const [lesson, setLesson] = useState<CurrentLesson | null>(null);
  useEffect(() => {
    let off = false;
    loadCurrentLesson()
      .then((l) => { if (!off) setLesson(l); })
      .catch(() => {});
    return () => { off = true; };
  }, []);
  return lesson;
}

// ─── O'yin rekordlari (qurilmada) ──────────────────────────────────────────
export type GameRecords = {
  wordChain: number;
  memorySeconds: number | null;
  wordSearch: { found: number; total: number };
  mystery: { tries: number; max: number };
};
const RECORDS_KEY = 'mh_v2_game_records';
const EMPTY_RECORDS: GameRecords = {
  wordChain: 0,
  memorySeconds: null,
  wordSearch: { found: 0, total: 6 },
  mystery: { tries: 0, max: 6 },
};

export async function getRecords(): Promise<GameRecords> {
  try {
    const raw = await AsyncStorage.getItem(RECORDS_KEY);
    return raw ? { ...EMPTY_RECORDS, ...JSON.parse(raw) } : EMPTY_RECORDS;
  } catch {
    return EMPTY_RECORDS;
  }
}

export async function saveRecords(patch: Partial<GameRecords>) {
  const cur = await getRecords();
  try {
    await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify({ ...cur, ...patch }));
  } catch {
    // Xotiraga yozib bo'lmasa — jim o'tamiz, o'yin baribir ishlaydi.
  }
}

export function useRecords() {
  const [rec, setRec] = useState<GameRecords>(EMPTY_RECORDS);
  const reload = useCallback(() => { getRecords().then(setRec); }, []);
  useEffect(reload, [reload]);
  return { rec, reload };
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ─── Shaxsiy lug'at va oxirgi qidiruvlar/tarjimalar (qurilmada) ───────────
async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
async function writeList<T>(key: string, list: T[]) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch {
    // jim
  }
}

export type MyWord = { word: string; translation?: string };
const MY_WORDS_KEY = 'mh_v2_my_words';
export const getMyWords = () => readList<MyWord>(MY_WORDS_KEY);
export async function addMyWord(w: MyWord) {
  const list = await getMyWords();
  if (list.some((x) => x.word.toLowerCase() === w.word.toLowerCase())) return;
  await writeList(MY_WORDS_KEY, [w, ...list].slice(0, 500));
}

/** Yozish davomida avtomatik saqlangan oraliq so'zni yakuniy shakli bilan almashtiradi. */
export async function replaceMyWord(prevWord: string | null, w: MyWord) {
  const list = (await getMyWords()).filter(
    (x) => x.word.toLowerCase() !== w.word.toLowerCase() && (prevWord == null || x.word !== prevWord),
  );
  await writeList(MY_WORDS_KEY, [w, ...list].slice(0, 500));
}

// ─── Uyga vazifa xatolari (Lug'atim: "N xato") ───────────────────────────
// Manba — components/v2/homework/scoreStore (faqat o'qiladi). Xatolar ekrani
// (dars/[lessonId]/xatolar) bilan bir xil hisob: results bo'lsa — false'lar,
// eski yozuvlarda — mistakes ro'yxati.
export function countMistakes(store: Record<string, Record<string, PartScore>>): number {
  let n = 0;
  for (const lesson of Object.values(store ?? {}))
    for (const sc of Object.values(lesson ?? {})) {
      if (!sc) continue;
      n += sc.results ? sc.results.filter((r) => r === false).length : (sc.mistakes?.length ?? 0);
    }
  return n;
}

/** Barcha darslardagi uyga vazifa xatolari soni; natija o'zgarsa yangilanadi. */
export function useMistakeCount(): number {
  return countMistakes(useHomeworkScores());
}

export type RecentTranslation = { source: string; target: string; dir: 'uz-other' | 'other-uz' };
const RECENT_TR_KEY = 'mh_v2_recent_translations';
// Eski yozuvlarda 5 tagacha bo'lishi mumkin — har doim 3 ta qaytariladi.
export const getRecentTranslations = async () => (await readList<RecentTranslation>(RECENT_TR_KEY)).slice(0, 3);
export async function pushRecentTranslation(t: RecentTranslation) {
  const list = (await getRecentTranslations()).filter((x) => x.source !== t.source);
  // Dizaynda "Oxirgilar"da 3 ta qator.
  await writeList(RECENT_TR_KEY, [t, ...list].slice(0, 3));
}

export type RecentSearch = { query: string; meta: string; href: string };
const RECENT_SEARCH_KEY = 'mh_v2_recent_searches';
export const getRecentSearches = () => readList<RecentSearch>(RECENT_SEARCH_KEY);
export async function pushRecentSearch(s: RecentSearch) {
  const list = (await getRecentSearches()).filter((x) => x.query !== s.query);
  await writeList(RECENT_SEARCH_KEY, [s, ...list].slice(0, 5));
}

// ─── O'yin sarlavhasi ──────────────────────────────────────────────────────
export function GameHeader({
  overline,
  overlineColor,
  title,
  right,
  dark,
  onClose,
}: {
  overline: string;
  overlineColor: string;
  title: string;
  right?: ReactNode;
  dark?: boolean;
  onClose?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Oʻyindan chiqish"
        onPress={onClose ?? (() => goBack())}
        style={[styles.closeBtn, dark && { backgroundColor: '#1B2438' }]}
      >
        <CloseIcon color={dark ? '#FFFFFF' : '#0B1220'} />
      </Pressable>
      <View style={styles.headerText}>
        <Text style={[styles.overline, { color: overlineColor }]} numberOfLines={1}>{overline}</Text>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

// ─── Mashq pastki menyusi (Practice dizayni aynan) ─────────────────────────
const NAV = [
  { key: 'home', label: 'Asosiy', href: R.home },
  { key: 'lessons', label: 'Darslar', href: R.path },
  { key: 'practice', label: 'Mashq', href: R.practice },
  { key: 'league', label: 'Liga', href: R.league },
  { key: 'profile', label: 'Profil', href: R.profile },
] as const;

export function PracticeNav() {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Asosiy menyu"
      style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 24) }]}
    >
      {NAV.map((it) => {
        const active = it.key === 'practice';
        const c = active ? '#2F5BFF' : '#5B6478';
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={it.label}
            onPress={() => { if (!active) router.push(it.href as Href); }}
            style={styles.navItem}
          >
            {it.key === 'home' && <NavHome color={c} />}
            {it.key === 'lessons' && <NavPath color={c} />}
            {it.key === 'practice' && <NavStar color={c} strokeWidth={active ? 2.4 : 2} />}
            {it.key === 'league' && <NavTrophy color={c} />}
            {it.key === 'profile' && <NavUser color={c} />}
            <Text style={[styles.navLabel, { color: c, fontFamily: active ? fonts.bodyHeavy : fonts.bodyBold }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  closeBtn: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, minWidth: 0 },
  overline: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18, ...reset },
  title: { fontFamily: fonts.bodyHeavy, fontSize: 17, lineHeight: 23, color: '#0B1220', ...reset },
  nav: {
    minHeight: 86,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E4E8F0',
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 48 },
  navLabel: { fontSize: 12, lineHeight: 16, ...reset },
});
