import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/constants/v2/tokens';

const clamp = (n: number) => Math.max(0, Math.min(1, n));

type BarProps = {
  /** 0 dan 1 gacha. */
  value: number;
  color?: string;
  trackColor?: string;
  height?: number;
  accessibilityLabel?: string;
};

export function ProgressBar({ value, color = colors.success, trackColor = colors.track, height = 6, accessibilityLabel }: BarProps) {
  const pct = Math.round(clamp(value) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }]}
    >
      <View style={{ width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

/** Dars bosqichlari kabi bo'lingan progress (masalan 2 / 5). */
export function SegmentedProgress({ total, done, color = colors.success, accessibilityLabel }: { total: number; done: number; color?: string; accessibilityLabel?: string }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? `${done} / ${total}`}
      accessibilityValue={{ min: 0, max: total, now: done }}
      style={styles.segments}
    >
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.segment, { backgroundColor: i < done ? color : colors.track }]} />
      ))}
    </View>
  );
}

type RingProps = {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
  accessibilityLabel?: string;
};

/** Kunlik maqsad halqasi. */
export function ProgressRing({ value, size = 56, stroke = 7, color = colors.lightning, children, accessibilityLabel }: RingProps) {
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const filled = c * clamp(value);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp(value) * 100) }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.trackSoft} strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  segments: { flexDirection: 'row', gap: 5 },
  segment: { flex: 1, height: 6, borderRadius: 3 },
});
