/**
 * "homework" guruhining umumiy bloklari — Exercise/Test/Match/Build/Reading
 * dizaynlaridagi takrorlanuvchi qismlar (sarlavha, natija paneli, pastki menyu).
 */
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { ArrowRight, Check, CloseIcon, Coin, NavHome, NavPath, NavStar, NavTrophy, NavUser } from './icons';

export const webShadow = (css: string, native: ViewStyle = {}): ViewStyle =>
  (Platform.OS === 'web' ? ({ boxShadow: css } as object) : native) as ViewStyle;

type TxtProps = {
  f?: keyof typeof fonts;
  size: number;
  color?: string;
  lh?: number;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  lang?: string;
  numberOfLines?: number;
  accessibilityRole?: 'header' | 'text';
};

/** Dizayndagi matn: shrift + o'lcham + rang; fontWeight doim 'normal' (sintetik qalinlik bo'lmasin). */
export function Txt({ f = 'body', size, color = '#0B1220', lh, style, children, lang, numberOfLines, accessibilityRole }: TxtProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      accessibilityRole={accessibilityRole}
      {...(Platform.OS === 'web' && lang ? ({ lang } as object) : null)}
      style={[{ fontFamily: fonts[f], fontSize: size, color, fontWeight: 'normal' }, lh ? { lineHeight: lh } : null, style]}
    >
      {children}
    </Text>
  );
}

/** Yopish (X) tugmasi — 44×44, radius 15. */
export function CloseButton({ bg = '#FFFFFF', onPress }: { bg?: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Yopish"
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : null))}
      style={({ pressed }) => [s.close, { backgroundColor: bg }, pressed && s.pressed]}
    >
      <CloseIcon />
    </Pressable>
  );
}

/**
 * Exercise/Test/TypeAnswer/MistakeReview sarlavhasi: X + "B · ..." + "4 / 10" +
 * 8px chiziq. TypeAnswer'da chiziq ustida kichik izoh ("Yozib javob bering").
 */
export function LabelHeader({
  label,
  current,
  total,
  color,
  onClose,
  sub,
  barValue,
  progressLabel,
}: {
  label: string;
  current: number;
  total: number;
  color: string;
  onClose: () => void;
  sub?: string;
  /** Chiziq to'lishi raqamdan farq qilsa (TypeAnswer: 5 / 10, chiziq 40%). */
  barValue?: number;
  progressLabel?: string;
}) {
  const pct = total ? Math.min(100, ((barValue ?? current) / total) * 100) : 0;
  return (
    <View style={s.header}>
      <CloseButton onPress={onClose} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Txt f="bodyHeavy" size={13} color="#4A5468" numberOfLines={1} style={{ flexShrink: 1 }}>
            {label}
          </Txt>
          <Txt f="bodyHeavy" size={13} color="#4A5468">
            {current} / {total}
          </Txt>
        </View>
        {sub ? (
          <Txt f="body" size={12} color="#4A5468" style={{ marginTop: -4 }}>
            {sub}
          </Txt>
        ) : null}
        <View
          {...(progressLabel
            ? { accessibilityRole: 'progressbar' as const, accessibilityLabel: progressLabel, accessibilityValue: { min: 0, max: total, now: current } }
            : null)}
          style={{ height: 8, borderRadius: 4, backgroundColor: '#E2E6EE', overflow: 'hidden' }}
        >
          <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: color }} />
        </View>
      </View>
    </View>
  );
}

/** Match/Build/Reading sarlavhasi: X (kulrang) + 12px chiziq + "6 / 10". */
export function BarHeader({ current, total, color, label, onClose }: { current: number; total: number; color: string; label: string; onClose: () => void }) {
  const pct = total ? Math.min(100, (current / total) * 100) : 0;
  return (
    <View style={[s.header, { gap: 14 }]}>
      <CloseButton bg="#F4F6FA" onPress={onClose} />
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: total, now: current }}
        style={{ flex: 1, height: 12, borderRadius: 6, backgroundColor: '#E7EBF3', overflow: 'hidden' }}
      >
        <View style={{ width: `${pct}%`, height: 12, borderRadius: 6, backgroundColor: color }} />
      </View>
      <Txt f="bodyHeavy" size={15} color="#4A5468">
        {current} / {total}
      </Txt>
    </View>
  );
}

/** "31-DARS VAZIFASI · TAKRORLASH · A QISM" kabi ko'k ustki yozuv. */
export function Overline({ children }: { children: ReactNode }) {
  return (
    <Txt f="bodyHeavy" size={12} color="#1E3FD1" style={{ letterSpacing: 0.72, textTransform: 'uppercase' }}>
      {children}
    </Txt>
  );
}

/**
 * Javobdan keyingi pastki panel (Exercise — yashil "To'g'ri!", Test — qizil
 * "Noto'g'ri"). Tugma bosilganda keyingi savolga o'tiladi.
 */
export function FeedbackSheet({
  correct,
  detail,
  coin,
  buttonLabel,
  onPress,
  padBottom = 34,
  title,
  btnGap = 8,
  alignTop,
  checkSize = 22,
  checkStroke = 3.2,
}: {
  correct: boolean;
  detail: ReactNode;
  coin: boolean;
  buttonLabel: string;
  onPress: () => void;
  /** Dizayndagi pastki ichki bo'shliq: Exercise — 28, Test — 34. */
  padBottom?: number;
  /** MistakeReview: "To'g'ri! Bu safar topdingiz". */
  title?: string;
  btnGap?: number;
  /** MistakeReview: belgi yuqorida (align-items: flex-start), matnlar orasi 4. */
  alignTop?: boolean;
  /** To'g'ri belgisi: Exercise — 22 / 3.2, MistakeReview — 20 / 3. */
  checkSize?: number;
  checkStroke?: number;
}) {
  const insets = useSafeAreaInsets();
  const c = correct
    ? { bg: '#E3F7EE', icon: '#087A4A', title: '#075E3A', text: '#075E3A', btn: '#087A4A', btnShadow: '#075E3A' }
    : { bg: '#FDECEC', icon: '#D92D20', title: '#B42318', text: '#7A1C14', btn: '#D92D20', btnShadow: '#B42318' };
  return (
    <View accessibilityRole="alert" style={[s.sheet, { backgroundColor: c.bg, paddingBottom: Math.max(padBottom, insets.bottom + 14) }]}>
      <View style={[s.sheetRow, { alignItems: correct && !alignTop ? 'center' : 'flex-start' }]}>
        <View style={[s.sheetIcon, { backgroundColor: c.icon }]}>
          {correct ? <Check size={checkSize} color="#FFFFFF" strokeWidth={checkStroke} /> : <CloseIcon size={20} color="#FFFFFF" />}
        </View>
        <View style={{ flex: 1, gap: correct && !alignTop ? 2 : 4 }}>
          <Txt f="display" size={22} color={c.title}>
            {title ?? (correct ? 'Toʻgʻri!' : 'Notoʻgʻri')}
          </Txt>
          {typeof detail === 'string' ? (
            <Txt f={correct ? 'bodyBold' : 'body'} size={correct ? 15 : 14} color={c.text} lh={correct ? undefined : 20}>
              {detail}
            </Txt>
          ) : (
            detail
          )}
        </View>
        {coin && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Coin size={16} />
            <Txt f="bodyHeavy" size={15} color="#7A5300">
              +1
            </Txt>
          </View>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [s.sheetBtn, { backgroundColor: c.btn, gap: btnGap }, webShadow(`0 5px 0 ${c.btnShadow}`), pressed && s.pressed]}
      >
        <Txt f="bodyHeavy" size={17} color="#FFFFFF">
          {buttonLabel}
        </Txt>
        {correct && <ArrowRight />}
      </Pressable>
    </View>
  );
}

/** Variant tugmasi (Exercise/Test): oq / yashil ✓ / qizil ✗. */
export function OptionRow({
  label,
  state,
  onPress,
  disabled,
  minHeight = 56,
  radio,
}: {
  label: string;
  state: 'idle' | 'correct' | 'wrong';
  onPress: () => void;
  disabled?: boolean;
  /** Exercise — 52, Test/MistakeReview — 56. */
  minHeight?: number;
  /** MistakeReview: role="radio". */
  radio?: boolean;
}) {
  const c =
    state === 'correct'
      ? { bg: '#E3F7EE', border: '#087A4A', fg: '#075E3A' }
      : state === 'wrong'
        ? { bg: '#FDECEC', border: '#D92D20', fg: '#B42318' }
        : { bg: '#FFFFFF', border: '#E2E6EE', fg: '#4A5468' };
  return (
    <Pressable
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityState={radio ? { checked: state !== 'idle', disabled } : { selected: state !== 'idle', disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.option, { minHeight, backgroundColor: c.bg, borderColor: c.border }]}
    >
      <Txt f="bodyHeavy" size={18} color={c.fg} lang="ru" style={{ flex: 1 }}>
        {label}
      </Txt>
      {state === 'correct' && <Check size={20} color="#087A4A" />}
      {state === 'wrong' && <CloseIcon size={18} color="#B42318" />}
    </Pressable>
  );
}

/**
 * Exercise "B · natijalar" / Test "C · Test natijalari" kartasi: sarlavha,
 * o'ngda hisob va har savol uchun 8px chiziqcha (yashil/qizil/kulrang).
 */
export function ResultsCard({
  title,
  right,
  rightColor,
  states,
  radius,
  pad,
  gap,
  label,
  children,
}: {
  title: string;
  right: string;
  rightColor: string;
  states: (boolean | undefined)[];
  radius: number;
  pad: { v: number; h: number };
  gap: number;
  label: string;
  children?: ReactNode;
}) {
  return (
    <View accessibilityLabel={label} style={{ backgroundColor: '#FFFFFF', borderRadius: radius, paddingVertical: pad.v, paddingHorizontal: pad.h, gap }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Txt f="bodyHeavy" size={13}>
          {title}
        </Txt>
        <Txt f="bodyHeavy" size={13} color={rightColor}>
          {right}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {states.map((r, i) => (
          <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: r === undefined ? '#E2E6EE' : r ? '#087A4A' : '#D92D20' }} />
        ))}
      </View>
      {children}
    </View>
  );
}

const NAV = [
  { key: 'home', label: 'Asosiy', href: R.home },
  { key: 'lessons', label: 'Darslar', href: R.path },
  { key: 'practice', label: 'Mashq', href: R.practice },
  { key: 'league', label: 'Liga', href: R.league },
  { key: 'profile', label: 'Profil', href: R.profile },
] as const;

/** Exams/Bonus dizaynidagi pastki menyu ("Darslar" faol). */
export function LessonsNav() {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Asosiy menyu" style={[s.nav, { paddingBottom: Math.max(insets.bottom, 24) }]}>
      {NAV.map((it) => {
        const active = it.key === 'lessons';
        const c = active ? '#2F5BFF' : '#5B6478';
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={it.label}
            onPress={() => (active ? router.push(R.path as Href) : router.push(it.href as Href))}
            style={s.navItem}
          >
            {it.key === 'home' && <NavHome color={c} />}
            {it.key === 'lessons' && <NavPath color={c} />}
            {it.key === 'practice' && <NavStar color={c} />}
            {it.key === 'league' && <NavTrophy color={c} />}
            {it.key === 'profile' && <NavUser color={c} />}
            <Txt f={active ? 'bodyHeavy' : 'bodyBold'} size={12} color={c}>
              {it.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export const s = StyleSheet.create({
  pressed: { opacity: 0.85 },
  close: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 20, paddingHorizontal: 20, gap: 14 },
  sheetRow: { flexDirection: 'row', gap: 12 },
  sheetIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sheetBtn: { height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  option: { borderRadius: 18, borderWidth: 2, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  nav: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E4E8F0', paddingTop: 8, paddingHorizontal: 6 },
  navItem: { flex: 1, minHeight: 53, alignItems: 'center', justifyContent: 'center', gap: 3 },
});
