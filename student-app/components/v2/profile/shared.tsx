/**
 * Profil guruhining umumiy bo'laklari: sarlavha (orqaga tugmasi bilan),
 * ustun, formatlash va kurs/to'lov hisob-kitoblari. Barcha raqamlar
 * mavjud servislardan (contentApi, lessonContent, scheduleCalendar)
 * olinadi — bu yerda hech qanday namuna qiymat yo'q.
 */
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/constants/v2/tokens';
import { CERTIFICATES } from '@/data/certificates';
import { getLevelProgress } from '@/data/levels';
import type { DemoScheduleResponse, LiveGradeEntry } from '@/services/contentApi';
import type { ExamResult } from '@/services/examStore';

import { BackIcon, BackIcon2 } from './icons';

// Eski Kontaktlar ekranidagi manzillar (profile/settings/contacts.tsx).
export const supportUrl = (courseLang: string) =>
  courseLang === 'russian' ? 'https://t.me/Domwork_admin' : 'https://t.me/myhomeworkuz';

/** Telegram'da raqam orqali suhbat; raqam bo'lmasa — qo'llab-quvvatlash. */
export const tgByPhone = (phone: string, fallback: string) => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 ? `https://t.me/+${digits.length === 9 ? '998' + digits : digits}` : fallback;
};

export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

/** Dizayndagi pul ko'rinishi: 1 650 000 (oddiy bo'shliq bilan). */
export const money = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const pad = (n: number) => String(n).padStart(2, '0');

export function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** 11.09.2026 */
export const dmy = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
/** 11.09 */
export const dm = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export const daysBetween = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);

/** Kurs 72 dars · 3 oy (dizayndagi tarif shartlari) — tugash sanasi boshlanishdan 3 oy keyin. */
export const COURSE_MONTHS = 3;
export function courseEnd(start: Date) {
  const e = new Date(start);
  e.setMonth(e.getMonth() + COURSE_MONTHS);
  return e;
}

export const MONTHS_LOWER = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
/** Hafta kunlari (Yakshanbadan, Date.getDay() tartibida) — dizayndagi qisqartmalar. */
export const DAY_SHORT = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

/** Ustoz asosiy dars kunlari (CRM SCHEDULE_PATTERNS bilan bir xil). */
export const patternLabel = (p: 'mwf' | 'tts') => (p === 'tts' ? 'Se, Pa, Sh' : 'Du, Ch, Ju');

// To'lov usullari — js/paymentLedger.js METHODS bilan bir xil nomlar.
const METHODS: Record<string, string> = {
  card: 'Karta', uzum: 'Uzum Nasiya', paylater: 'Paylater', bank: 'Bank hisobi', payme: 'Payme', click: 'Click', cash: 'Naqd',
};
export const methodLabel = (m: unknown) => (typeof m === 'string' ? METHODS[m] ?? '' : '');

/** Dizayndagi daraja nomlari va nishonlari (Levels artboard bilan bir xil). */
export const LEVEL_UI = [
  { name: 'Uchqun', img: 'e0075f409ade6741e1515b9b344c2571' },
  { name: 'Shogird', img: '02122e23f58cb07d26e8524e55ccb8b0' },
  { name: 'Bilimdon', img: '5b5ad36506e557f32656fd97d291d0e3' },
  { name: 'Usta', img: '5cf848e6643888e0c2ffc873dc37c6a3' },
  { name: 'Domwork afsonasi', img: 'f561781d559c63b7ef26fcbf36820493' },
] as const;

export function levelInfo(lightning: number) {
  const p = getLevelProgress(lightning);
  const keys = ['spark', 'apprentice', 'scholar', 'master', 'legend'];
  const idx = Math.max(0, keys.indexOf(p.level.key));
  return { ...p, index: idx, ui: LEVEL_UI[idx], nextUi: idx < 4 ? LEVEL_UI[idx + 1] : null };
}

/*
 * Kurs jadvali (dizayn modeli: haftada 3 jonli + 3 video, 72 dars · 3 oy):
 * ustozning dars kunlarida (mwf/tts — CRM'dagi pattern) jonli dars,
 * qolgan Du–Sh kunlarida videodars, Yakshanba — bonus dars. Dars raqami
 * kurs boshlanganidan beri o'tgan Du–Sh kunlari soni. Jonli darsga
 * kelgani ustoz bahosi qo'yilgan sanalardan aniqlanadi (eski
 * generateRealScheduleDays bilan bir xil qoida).
 */
export type DayKind = 'live' | 'video' | 'bonus';
export type CourseDay = { date: Date; kind: DayKind; lesson: number | null; isPast: boolean; isToday: boolean; attended: boolean };

export const isoKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const PATTERN: Record<'mwf' | 'tts', number[]> = { mwf: [1, 3, 5], tts: [2, 4, 6] };

export function courseDay(date: Date, start: Date, pattern: 'mwf' | 'tts', gradeDates: Set<string>, today = startOfDay(new Date())): CourseDay {
  const d = startOfDay(date);
  const dow = d.getDay();
  let lesson: number | null = null;
  if (dow !== 0 && d >= start) {
    let n = 0;
    for (const c = new Date(start); c <= d; c.setDate(c.getDate() + 1)) if (c.getDay() !== 0) n++;
    lesson = n <= 72 ? n : null;
  }
  const kind: DayKind = dow === 0 ? 'bonus' : PATTERN[pattern].includes(dow) ? 'live' : 'video';
  return { date: d, kind, lesson, isPast: d < today, isToday: d.getTime() === today.getTime(), attended: gradeDates.has(isoKey(d)) };
}

/** Jonli darslar: kelgan / o'tgan (haqiqiy jadval + ustoz baholari). */
export function liveAttendance(schedule: DemoScheduleResponse | null, grades: LiveGradeEntry[]) {
  const start = parseIso(schedule?.courseStartDate);
  if (!schedule || !start) return { attended: grades.length, total: grades.length };
  const dates = new Set(grades.map((g) => g.date));
  const today = startOfDay(new Date());
  let total = 0;
  let attended = 0;
  for (const c = new Date(start); c < today; c.setDate(c.getDate() + 1)) {
    const day = courseDay(c, start, schedule.schedulePattern, dates, today);
    if (day.kind !== 'live' || day.lesson === null) continue;
    total++;
    if (day.attended) attended++;
  }
  return { attended, total };
}

/** Bugundan boshlab keyingi jonli dars kuni (bugun ham bo'lishi mumkin). */
export function nextLiveDay(schedule: DemoScheduleResponse | null) {
  const start = parseIso(schedule?.courseStartDate);
  if (!schedule || !start) return null;
  const today = startOfDay(new Date());
  for (let i = 0; i < 8; i++) {
    const c = new Date(today);
    c.setDate(c.getDate() + i);
    const day = courseDay(c, start, schedule.schedulePattern, new Set(), today);
    if (day.kind === 'live' && day.lesson !== null) return day;
  }
  return null;
}

/** Guruh nomi — server jonli dars mavzusini "Speaking Club: <guruh>" ko'rinishida beradi. */
export const groupFromTopic = (topic: string | undefined) => {
  const m = /^Speaking Club:\s*(.+)$/.exec(topic ?? '');
  return m ? m[1].trim() : '';
};

/** "19:00" + 30 daqiqa + 5 daqiqa tanaffus → "19:35" (yordamchi ustoz amaliyoti). */
export function addMinutes(time: string, minutes: number) {
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return '';
  const t = Number(m[1]) * 60 + Number(m[2]) + minutes;
  return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
}

/** O'quvchining jonli dars baholari o'rtachasi (eski profile/grades.tsx hisobi). */
export function gradeAverage(grades: LiveGradeEntry[]) {
  if (!grades.length) return 0;
  const per = (g: LiveGradeEntry) => {
    const s = g.scores;
    return (s.attendance + s.activity + s.speaking + s.understanding + s.discipline) / 5;
  };
  return grades.reduce((sum, g) => sum + per(g), 0) / grades.length;
}

export const fmtGrade = (n: number) => (n > 0 ? n.toFixed(1) : '0');

/** Dizayndagi 7 ta sertifikat: 6 oraliq + yakuniy (eski certificates.tsx qoidasi). */
export function certificateStates(examResults: Record<string, ExamResult>, lessonsDone: number) {
  const list = CERTIFICATES.filter((c) => c.type !== 'bonus');
  return list.map((c, i) => {
    const examId = c.type === 'course' ? 'final' : c.id;
    const res = examResults[examId];
    const passed = !!res?.passed && lessonsDone >= c.requiredLessons;
    return { cert: c, index: i, examId, passed, score: res?.scorePercent ?? 0 };
  });
}

export function goBack(fallback: string) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as Href);
}

export function go(href: string) {
  router.push(href as Href);
}

/**
 * Sarlavha. `variant="b"` — Sertifikat/Jadval/Natijalar/Ustozlar
 * artboardlaridagi (qator balandligi 1.1, boshqa orqaga belgisi) ko'rinish.
 */
export function Header({
  title,
  subtitle,
  fallback,
  variant = 'a',
  subtitleWeight = 'semibold',
}: {
  title: string;
  subtitle?: string;
  fallback: string;
  variant?: 'a' | 'b' | 'teacher';
  subtitleWeight?: 'semibold' | 'bold';
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Orqaga" onPress={() => goBack(fallback)} style={s.back}>
        {variant === 'b' ? <BackIcon2 /> : <BackIcon />}
      </Pressable>
      <View style={[s.titleCol, variant === 'teacher' ? null : { gap: 1 }]}>
        <Text accessibilityRole="header" style={[s.title, { lineHeight: variant === 'a' ? 27.6 : 26.4 }]}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[s.subtitle, { fontFamily: subtitleWeight === 'bold' ? fonts.bodyBold : fonts.body }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

export function Column({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.column, style]}>{children}</View>;
}

export const s = StyleSheet.create({
  column: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0 },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleCol: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 24, letterSpacing: -0.48, color: '#0B1220' },
  subtitle: { fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  pressed: { opacity: 0.85 },
});
