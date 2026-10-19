/**
 * Sozlamalar guruhi uchun umumiy bo'laklar: sarlavha (orqaga tugmasi
 * bilan), almashtirgich (switch) va ko'k Telegram tugmasi. Qiymatlar
 * dizayndagi inline uslublardan aynan olingan.
 */
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/constants/v2/tokens';

import { BackIcon, TelegramButtonIcon } from './icons';

// Eski Kontaktlar ekranidagi admin Telegram manzili — dizayndagi
// "https://t.me/" o'rniga haqiqiy support/menejer manzili shu.
export const SUPPORT_TELEGRAM_URL = 'https://t.me/Domwork_admin';

/** Orqaga: tarix bo'lsa ortga, bo'lmasa (to'g'ridan-to'g'ri ochilgan) ota ekranga. */
export function goBack(fallback: string) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as Href);
}

export function ScreenHeader({ title, subtitle, fallback }: { title: string; subtitle?: string; fallback: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
          onPress={() => goBack(fallback)}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <BackIcon />
        </Pressable>
        <View style={styles.titleCol}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>
    </View>
  );
}

/** Dizayndagi 46×28 almashtirgich (faqat ko'rinish; bosish ota qatorda). */
export function ToggleKnob({ on }: { on: boolean }) {
  return (
    <View style={[styles.track, { backgroundColor: on ? '#2F5BFF' : '#C9D0DC' }]}>
      <View style={[styles.knob, on ? { right: 3 } : { left: 3 }]} />
    </View>
  );
}

export function TelegramButton({
  label,
  url,
  height,
  radius,
  fontSize,
  style,
}: {
  label: string;
  url: string;
  height: number;
  radius: number;
  fontSize: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => Linking.openURL(url).catch(() => {})}
      style={({ pressed }) => [styles.tgBtn, { height, borderRadius: radius }, pressed && styles.pressed, style]}
    >
      <TelegramButtonIcon />
      <Text style={[styles.tgText, { fontSize, lineHeight: fontSize + 6 }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Column({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.column, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  header: { paddingHorizontal: 20, flexShrink: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pressed: { opacity: 0.85 },
  titleCol: { flex: 1, minWidth: 0, gap: 1 },
  title: {
    fontFamily: fonts.display,
    fontWeight: 'normal',
    fontSize: 24,
    lineHeight: 27.6,
    letterSpacing: -0.48,
    color: '#0B1220',
  },
  subtitle: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  track: { width: 46, height: 28, borderRadius: 14, flexShrink: 0 },
  knob: { position: 'absolute', top: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  tgBtn: {
    paddingHorizontal: 14,
    backgroundColor: '#1B6FA8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    flexShrink: 0,
  },
  tgText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', color: '#FFFFFF' },
});
