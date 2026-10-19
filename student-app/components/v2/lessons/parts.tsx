/**
 * "lessons" guruhining umumiy bo'laklari: sarlavha (orqaga/yopish tugmasi
 * bilan), ekran ustuni va pastki katta tugma. Qiymatlar dizayndan aynan.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { goBack } from '@/components/v2/settings/parts';
import { colors, fonts } from '@/constants/v2/tokens';

import { BackIcon, CloseIcon } from './icons';

export const displayFont = (s: string) => (/[Ѐ-ӿ]/.test(s) ? fonts.displayCyrillic : fonts.display);

export function HeaderButton({ kind, label, fallback }: { kind: 'back' | 'close'; label: string; fallback: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => goBack(fallback)}
      style={({ pressed }) => [s.hbtn, pressed && s.pressed]}
    >
      {kind === 'back' ? <BackIcon /> : <CloseIcon />}
    </Pressable>
  );
}

/** Sarlavha: 44×44 tugma + 24px sarlavha + 13px izoh. */
export function TitleHeader({ title, subtitle, fallback }: { title: string; subtitle?: string; fallback: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + 10 }]}>
      <HeaderButton kind="back" label="Orqaga" fallback={fallback} />
      <View style={s.titleCol}>
        <Text accessibilityRole="header" style={[s.title, { fontFamily: displayFont(title) }]} numberOfLines={2}>
          {title}
        </Text>
        {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

/** Ekran ustuni — telefonda 390, desktopda 480 dan keng bo'lmaydi. */
export function Column({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.column, style]}>{children}</View>;
}

export function BottomBar({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 0) + 34 }, style]}>{children}</View>;
}

export function Center({ children }: { children: ReactNode }) {
  return <View style={s.center}>{children}</View>;
}

export const s = StyleSheet.create({
  pressed: { opacity: 0.85 },
  hbtn: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0 },
  titleCol: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 24, lineHeight: 26.4, letterSpacing: -0.48, color: colors.ink, fontWeight: 'normal' },
  subtitle: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18, color: '#4A5468', fontWeight: 'normal' },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  bottom: { paddingTop: 12, paddingHorizontal: 20, flexShrink: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
