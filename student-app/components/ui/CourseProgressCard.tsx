import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type CourseProgressCardProps = {
  progress: number;
  lessonsDone: number;
  lessonsTotal: number;
  onPress: () => void;
};

export function CourseProgressCard({ progress, lessonsDone, lessonsTotal, onPress }: CourseProgressCardProps) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <LinearGradient colors={['#7B61FF', '#6B4FE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <Text style={styles.sparkle1}>✦</Text>
        <Text style={styles.sparkle2}>✦</Text>

        <View style={styles.arrowBtn}>
          <Ionicons name="arrow-up-outline" size={18} color="#6B4FE0" style={styles.arrowIcon} />
        </View>

        <Text style={styles.label}>Umumiy progress</Text>
        <Text style={styles.percent}>{clamped}%</Text>

        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${clamped}%` }]} />
          <View style={[styles.handleWrap, { left: `${clamped}%` }]}>
            <View style={styles.handlePill}>
              <Text style={styles.handlePillText}>{clamped}</Text>
            </View>
            <View style={styles.handleDot} />
          </View>
        </View>

        <Text style={styles.lessonsText}>
          {lessonsDone} / {lessonsTotal} dars
        </Text>

        <View style={styles.rocketGlow}>
          <Text style={styles.rocketEmoji}>🚀</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 28 },
  card: {
    borderRadius: theme.radius.lg,
    padding: 24,
    paddingRight: 110,
    overflow: 'hidden',
  },
  sparkle1: { position: 'absolute', top: 24, right: 90, color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  sparkle2: { position: 'absolute', top: 64, right: 60, color: 'rgba(255,255,255,0.35)', fontSize: 9 },
  arrowBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: { transform: [{ rotate: '45deg' }] },
  label: { fontFamily: theme.fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 6 },
  percent: { fontFamily: theme.fonts.extraBold, fontSize: 40, color: '#fff', marginBottom: 22 },
  sliderTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 14,
    marginTop: 22,
  },
  sliderFill: { height: 8, borderRadius: 4, backgroundColor: '#fff' },
  handleWrap: {
    position: 'absolute',
    top: -30,
    alignItems: 'center',
    transform: [{ translateX: -12 }],
  },
  handlePill: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
  },
  handlePillText: { fontFamily: theme.fonts.bold, fontSize: 11, color: '#6B4FE0' },
  handleDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: theme.colors.success,
  },
  lessonsText: { fontFamily: theme.fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  rocketGlow: {
    position: 'absolute',
    right: -10,
    bottom: 4,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rocketEmoji: { fontSize: 44, transform: [{ rotate: '35deg' }] },
});
