import { StyleSheet, View } from 'react-native';
import { theme } from '@/constants/theme';

type ProgressBarProps = {
  progress: number;
  color?: string;
  height?: number;
};

export function ProgressBar({ progress, color = theme.colors.purple, height = 6 }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  return (
    <View style={[styles.track, { height }]}>
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color, height }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: theme.colors.border,
    borderRadius: 99,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: 99,
  },
});
