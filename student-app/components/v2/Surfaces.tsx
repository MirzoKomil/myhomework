/**
 * Kartalar, belgilar (chip) va statistika "tabletkalari".
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius, shadow, touchTarget } from '@/constants/v2/tokens';
import { CoinIcon, FlameIcon } from './Icons';
import { V2Text } from './Text';

type CardTone = 'surface' | 'ink' | 'cobalt';

const cardBg: Record<CardTone, string> = {
  surface: colors.surface,
  ink: colors.ink,
  cobalt: colors.cobalt,
};

type CardProps = {
  children: ReactNode;
  tone?: CardTone;
  /** Hozirgi dars kabi e'tibor talab qiluvchi karta uchun soya. */
  focused?: boolean;
  rounded?: keyof typeof radius;
  padding?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, tone = 'surface', focused, rounded = 'xxl', padding = 16, onPress, accessibilityLabel, style }: CardProps) {
  const body = [
    { backgroundColor: cardBg[tone], borderRadius: radius[rounded], padding },
    focused && shadow.focusCard,
    style,
  ];
  if (!onPress) return <View style={body}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [body, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

type ChipTone = 'onCobalt' | 'cobalt' | 'success' | 'danger' | 'neutral' | 'coin';

const chipColors: Record<ChipTone, { bg: string; fg: string }> = {
  onCobalt: { bg: colors.surface, fg: colors.cobalt },
  cobalt: { bg: colors.cobaltSoft, fg: colors.cobalt },
  success: { bg: colors.successSoft, fg: colors.successText },
  danger: { bg: colors.dangerSoft, fg: colors.dangerText },
  neutral: { bg: colors.track, fg: colors.textSubtle },
  coin: { bg: colors.coinSoft, fg: colors.coinText },
};

export function Chip({ label, tone = 'cobalt' }: { label: string; tone?: ChipTone }) {
  const c = chipColors[tone];
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      <V2Text variant="overline" color={c.fg}>
        {label}
      </V2Text>
    </View>
  );
}

type StatKind = 'streak' | 'coin';

/** Bosh sahifa tepasidagi streak va coin "tabletkalari". */
export function StatPill({ kind, value, onPress }: { kind: StatKind; value: number; onPress?: () => void }) {
  const isStreak = kind === 'streak';
  const label = isStreak ? `${value} kunlik streak` : `${value} coin`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      {isStreak ? <FlameIcon /> : <CoinIcon />}
      <V2Text variant="bodyLarge" color={isStreak ? colors.streakText : colors.coinText} style={styles.pillText}>
        {value}
      </V2Text>
    </Pressable>
  );
}

export function IconCircleButton({
  children,
  accessibilityLabel,
  onPress,
  badge,
}: {
  children: ReactNode;
  accessibilityLabel: string;
  onPress?: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? `${accessibilityLabel}, ${badge} ta yangi` : accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
    >
      {children}
      {!!badge && (
        <View style={styles.badge}>
          <V2Text variant="tab" color={colors.textOnDark} style={styles.badgeText}>
            {badge > 99 ? '99+' : badge}
          </V2Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.xs },
  pill: {
    height: touchTarget,
    paddingHorizontal: 9,
    borderRadius: touchTarget / 2,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pillText: { fontSize: 15 },
  circle: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    borderRadius: 9,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bodyHeavy },
});
