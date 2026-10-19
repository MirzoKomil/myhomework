/**
 * Kutubxona guruhi (Grammatika, Audiolar, Dialoglar, Hikoyalar, Oflayn)
 * uchun umumiy bo'laklar: orqaga tugmasi, filtr tablari, ikonkalar va
 * ma'lumot yordamchilari. Qiymatlar dizayndagi inline stillardan olingan.
 */
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { fonts } from '@/constants/v2/tokens';
import type { AdminLesson, MobileContent } from '@/services/contentApi';
import { getLastPosition } from '@/services/progressStore';

const hidden = { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };

// Matn: dizayndagi og'irlik → Manrope fayli (sintetik qalinlashmasin).
const weightFont = { 500: fonts.bodyMedium, 600: fonts.body, 700: fonts.bodyBold, 800: fonts.bodyHeavy } as const;
export function T({
  w = 700,
  size,
  color = '#0B1220',
  lh,
  style,
  children,
  ...rest
}: {
  w?: 500 | 600 | 700 | 800;
  size: number;
  color?: string;
  lh?: number;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
  numberOfLines?: number;
  accessibilityLabel?: string;
  onPress?: () => void;
}) {
  return (
    <Text
      {...rest}
      style={[{ fontFamily: weightFont[w], fontSize: size, color, fontWeight: 'normal' }, lh ? { lineHeight: size * lh } : null, style]}
    >
      {children}
    </Text>
  );
}

/** Dizayndagi "h1" — Bricolage (kirillda Manrope'ga tushadi). */
export function Display({ size, ls = -0.02, lh = 1.1, color = '#0B1220', style, children }: { size: number; ls?: number; lh?: number; color?: string; style?: StyleProp<TextStyle>; children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={[{ fontFamily: fonts.display, fontSize: size, letterSpacing: size * ls, lineHeight: size * lh, color, fontWeight: 'normal' }, style]}>
      {children}
    </Text>
  );
}

export const go = (href: string) => router.push(href as Href);

/** Orqaga: tarix bo'lsa — orqaga, bo'lmasa dizayndagi ekranga. */
export function goBack(fallback: string) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as Href);
}

export function BackButton({ fallback, bg = '#FFFFFF' }: { fallback: string; bg?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Orqaga" onPress={() => goBack(fallback)} style={({ pressed }) => [styles.back, { backgroundColor: bg }, pressed && styles.pressed]}>
      <ChevronLeft />
    </Pressable>
  );
}

export function Column({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.column, style]}>{children}</View>;
}

export type TabStyle = { height: number; padX: number; gap: number; inactiveBorder?: string; inactiveColor: string; inactiveWeight: 700 | 800 };
/** Bo'sh (0 ta) tab ko'rinishi — dizayndagi "Qiyin · 0": uzuq chegara, kulrang fon. */
const DISABLED_TAB = { bg: '#EEF1F7', border: '#D5DBE7', color: '#586175' };

export function FilterTabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
  look,
  style,
}: {
  tabs: { key: K; label: string; disabled?: boolean; hint?: string }[];
  value: K;
  onChange: (k: K) => void;
  label: string;
  look: TabStyle;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={[{ flexDirection: 'row', gap: look.gap }, style]}>
      {tabs.map((t) => {
        const on = t.key === value;
        if (t.disabled && !on) {
          return (
            <View
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: false, disabled: true }}
              accessibilityHint={t.hint}
              style={{
                height: look.height,
                paddingHorizontal: look.padX,
                borderRadius: look.height / 2,
                backgroundColor: DISABLED_TAB.bg,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: DISABLED_TAB.border,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <T w={800} size={14} color={DISABLED_TAB.color} numberOfLines={1}>
                {t.label}
              </T>
            </View>
          );
        }
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.key)}
            style={{
              height: look.height,
              // Dizayndagi tugma: padding + chegara (chegara padding ichiga kirmaydi).
              paddingHorizontal: look.padX,
              borderRadius: look.height / 2,
              backgroundColor: on ? '#0B1220' : '#FFFFFF',
              borderWidth: on || !look.inactiveBorder ? 0 : 1.5,
              borderColor: look.inactiveBorder,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <T w={on ? 800 : look.inactiveWeight} size={14} color={on ? '#FFFFFF' : look.inactiveColor} numberOfLines={1}>
              {t.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Ikonkalar (dizayndagi inline SVG) ---------- */

export function ChevronLeft({ size = 22, color = '#0B1220' }: { size?: number; color?: string }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 6l-6 6 6 6" />
    </Svg>
  );
}
export function ChevronRight({ size = 20, color = '#5B6478', sw = 2.2 }: { size?: number; color?: string; sw?: number }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 6l6 6-6 6" />
    </Svg>
  );
}
export function Check({ size = 15, color = '#FFFFFF', sw = 3.2 }: { size?: number; color?: string; sw?: number }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}
export function Cross({ size = 14, color = '#B42318' }: { size?: number; color?: string }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round">
      <Path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}
export function PlayRounded({ size = 18, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill={color} />
    </Svg>
  );
}
export function PlaySharp({ size = 10, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M7 4.5v15l13-7.5z" />
    </Svg>
  );
}
export function CameraIcon({ size = 20, color = '#0B1220' }: { size?: number; color?: string }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round">
      <Path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <Circle cx={12} cy={13} r={3.5} />
    </Svg>
  );
}
export function PauseIcon({ size = 26 }: { size?: number }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24">
      <Rect x={6} y={5} width={4.2} height={14} rx={1.4} fill="#FFFFFF" />
      <Rect x={13.8} y={5} width={4.2} height={14} rx={1.4} fill="#FFFFFF" />
    </Svg>
  );
}
export function BackFiveIcon() {
  return (
    <Svg {...hidden} width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#0B1220" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <Path d="M4 4v4h4" />
    </Svg>
  );
}
export function FwdFiveIcon() {
  return (
    <Svg {...hidden} width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#0B1220" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <Path d="M20 4v4h-4" />
    </Svg>
  );
}
export function RepeatIcon({ color = '#0B1220' }: { color?: string }) {
  return (
    <Svg {...hidden} width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 2l3 3-3 3" />
      <Path d="M4 11V9a4 4 0 0 1 4-4h12" />
      <Path d="M7 22l-3-3 3-3" />
      <Path d="M20 13v2a4 4 0 0 1-4 4H4" />
    </Svg>
  );
}
export function HandIcon() {
  return (
    <Svg {...hidden} width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#4A5468" strokeWidth={2} strokeLinecap="round">
      <Path d="M9 11V5a2 2 0 0 1 4 0v6M13 10V8a2 2 0 0 1 4 0v5a7 7 0 0 1-7 7H9a5 5 0 0 1-5-5v-2a2 2 0 0 1 4 0" />
    </Svg>
  );
}
export function NoWifiIcon() {
  return (
    <Svg {...hidden} width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFC93C" strokeWidth={2.2} strokeLinecap="round">
      <Path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01M3 3l18 18" />
    </Svg>
  );
}
export function SavedIcon({ done }: { done: boolean }) {
  // Yuklab olingan — yashil belgi; yuklanmagan — xuddi shu doira, belgisiz, kulrang.
  const c = done ? '#087A4A' : '#5B6478';
  return (
    <Svg accessibilityRole="image" accessibilityLabel={done ? 'Yuklab olingan' : 'Yuklanmagan'} width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={9} />
      {done ? <Path d="M8 12.5l3 3 5-6" /> : null}
    </Svg>
  );
}
export function LiveIcon() {
  return (
    <Svg {...hidden} width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#4A5468" strokeWidth={2} strokeLinejoin="round">
      <Rect x={2} y={6} width={14} height={12} rx={3} />
      <Path d="M16 10l6-3v10l-6-3" />
    </Svg>
  );
}

/** Dizayndagi "‹" (AudioTrack/AudioDialogLib sarlavhasi): 20px, M15 5l-7 7 7 7. */
export function ChevronLeftWide() {
  return (
    <Svg {...hidden} width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#0B1220" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}
export function QrIcon() {
  return (
    <Svg {...hidden} width={13} height={13} viewBox="0 0 24 24" fill="#4A5468">
      <Path d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm10-2h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2zm2-4h2v2h-2zm0 4h2v2h-2z" />
    </Svg>
  );
}
/** Qorong'u pleer: pauza (rx 1.5, 4..20). */
export function PauseTall({ size = 26, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24">
      <Rect x={6} y={4} width={4.2} height={16} rx={1.5} fill={color} />
      <Rect x={13.8} y={4} width={4.2} height={16} rx={1.5} fill={color} />
    </Svg>
  );
}
/** Ro'yxatdagi kichik "ijro" uchburchagi (fill #2F5BFF). */
export function PlaySmall({ size = 13, color = '#2F5BFF' }: { size?: number; color?: string }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z" fill={color} />
    </Svg>
  );
}
export function PrevIcon() {
  return (
    <Svg {...hidden} width={20} height={20} viewBox="0 0 24 24">
      <Path d="M6 5h2.4v14H6zM20 5.5v13a.8.8 0 0 1-1.2.7L9.6 12.7a.8.8 0 0 1 0-1.4l9.2-6.5a.8.8 0 0 1 1.2.7z" fill="#FFFFFF" />
    </Svg>
  );
}
export function NextIcon() {
  return (
    <Svg {...hidden} width={20} height={20} viewBox="0 0 24 24">
      <Path d="M15.6 5H18v14h-2.4zM4 5.5v13a.8.8 0 0 0 1.2.7l9.2-6.5a.8.8 0 0 0 0-1.4L5.2 4.8A.8.8 0 0 0 4 5.5z" fill="#FFFFFF" />
    </Svg>
  );
}
/** "Replikani / gapni takrorlash" — ichida "1" bor takrorlash belgisi. */
export function RepeatOneIcon({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <Svg {...hidden} width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 2l3 3-3 3" />
      <Path d="M4 11V9a4 4 0 0 1 4-4h16" />
      <Path d="M7 22l-3-3 3-3" />
      <Path d="M20 13v2a4 4 0 0 1-4 4H4" />
      <Path d="M11 10.5l1.6-1V15" strokeWidth={2} />
    </Svg>
  );
}

/* ---------- Ma'lumot yordamchilari ---------- */

export type LessonRef = { lesson: AdminLesson; index: number; number: number };

/** Kursdagi darslar (birinchi kurs) — eski ilovadagi kabi. */
export function courseLessons(mc: MobileContent): AdminLesson[] {
  const course = mc.courses[0];
  return course ? mc.lessons.filter((l) => l.courseId === course.id) : [];
}

/** Joriy dars: oxirgi ochilgan → faol (isActive) → birinchi. Bosh sahifadagi qoida. */
export async function currentLesson(mc: MobileContent): Promise<LessonRef | null> {
  const lessons = courseLessons(mc);
  if (!lessons.length) return null;
  const last = await getLastPosition().catch(() => null);
  let idx = last ? lessons.findIndex((l) => l.id === last.lessonId) : -1;
  if (idx < 0) idx = lessons.findIndex((l) => l.isActive);
  if (idx < 0) idx = 0;
  return { lesson: lessons[idx], index: idx, number: idx + 1 };
}

/** Juft indeksli (toq raqamli) darslar — videodars/grammatika kuni. */
export function isVideoDay(index: number) {
  return index % 2 === 0;
}

/** Joriy yoki undan oldingi eng yaqin videodars (grammatika shu darsda o'tiladi). */
export function latestVideoLesson(mc: MobileContent, cur: LessonRef | null): LessonRef | null {
  if (!cur) return null;
  const lessons = courseLessons(mc);
  for (let i = cur.index; i >= 0; i--) if (isVideoDay(i)) return { lesson: lessons[i], index: i, number: i + 1 };
  return null;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ʻʼ'‘’`]/g, "'")
    .replace(/[^\p{L}\p{N}' ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Mavzu nomi bilan dars nomini solishtiradi (mavzularda darsga havola yo'q,
 * shuning uchun nom bo'yicha bog'lanadi): "Modal soʻzlar: хотеть…" ↔ "Modal soʻzlar".
 */
export function titlesMatch(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y || /^\d+ dars$/.test(y) || /^\d+ dars$/.test(x)) return false;
  return x.startsWith(y) || y.startsWith(x);
}

export function findLessonForTitle(mc: MobileContent, title: string): LessonRef | null {
  const lessons = courseLessons(mc);
  const i = lessons.findIndex((l) => titlesMatch(title, l.name));
  return i < 0 ? null : { lesson: lessons[i], index: i, number: i + 1 };
}

/** Matn hajmidan taxminiy o'qish vaqti (daqiqada, ~110 so'z/daq — sekin o'qish). */
export function readMinutes(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 110));
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function mmss(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  back: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center' },
});
