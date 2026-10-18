import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, touchTarget } from '@/constants/v2/tokens';
import { V2Text } from './Text';

type Variant = 'primary' | 'inverse' | 'secondary' | 'coin' | 'telegram';
type Size = 'lg' | 'md';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  /** Matndan keyin chiqadigan ikonka (masalan o'q). */
  trailing?: ReactNode;
  /** Matndan oldin chiqadigan ikonka (masalan coin). */
  leading?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  /** Ekran o'quvchisi uchun aniqroq tavsif kerak bo'lsa. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const palette: Record<Variant, { bg: string; bgPressed: string; fg: string }> = {
  primary: { bg: colors.cobalt, bgPressed: colors.cobaltPressed, fg: colors.textOnDark },
  inverse: { bg: colors.surface, bgPressed: colors.cobaltSoft, fg: colors.ink },
  secondary: { bg: colors.track, bgPressed: colors.border, fg: colors.ink },
  coin: { bg: colors.coinSoft, bgPressed: '#FFE9A8', fg: colors.coinText },
  // Telegram ko'kida oq matn kontrasti yetmaydi (2.6:1) — siyoh rang.
  telegram: { bg: colors.telegram, bgPressed: '#1E96D4', fg: colors.ink },
};

const sizes: Record<Size, { height: number; radius: number; variant: 'bodyLarge' | 'bodyStrong' }> = {
  lg: { height: 56, radius: radius.lg, variant: 'bodyLarge' },
  md: { height: 46, radius: 14, variant: 'bodyStrong' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  trailing,
  leading,
  disabled,
  loading,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const p = palette[variant];
  const s = sizes[size];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { height: s.height, borderRadius: s.radius, backgroundColor: pressed ? p.bgPressed : p.bg },
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {leading}
          <V2Text variant={s.variant} color={p.fg} numberOfLines={1}>
            {label}
          </V2Text>
          {trailing}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inactive: { opacity: 0.5 },
});
