import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type CourseProgressCardProps = {
  progress: number;
  lessonsDone: number;
  lessonsTotal: number;
  onPress: () => void;
};

export function CourseProgressCard({ progress, lessonsDone, lessonsTotal, onPress }: CourseProgressCardProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const [displayPercent, setDisplayPercent] = useState(0);
  const fillAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Har safar bu ekran fokusga kelganda 0 dan joriy foizgacha bir marta animatsiya qiladi.
  useFocusEffect(
    useCallback(() => {
      fillAnim.setValue(0);
      setDisplayPercent(0);
      const id = fillAnim.addListener(({ value }) => setDisplayPercent(Math.round(value)));
      Animated.timing(fillAnim, {
        toValue: clamped,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return () => fillAnim.removeListener(id);
    }, [clamped, fillAnim])
  );

  // Raketaning doimiy sekin suzib-uchib turishi.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  const fillWidth = fillAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const handleLeft = fillAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const rocketTranslateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const rocketRotate = floatAnim.interpolate({ inputRange: [0, 1], outputRange: ['30deg', '38deg'] });

  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <LinearGradient colors={['#7B61FF', '#6B4FE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <Text style={styles.sparkle1}>✦</Text>

        <Animated.View style={[styles.rocketGlow, { transform: [{ translateY: rocketTranslateY }] }]}>
          <Animated.Text style={[styles.rocketEmoji, { transform: [{ rotate: rocketRotate }] }]}>🚀</Animated.Text>
        </Animated.View>

        <Text style={styles.label}>Umumiy progress</Text>
        <Text style={styles.percent}>{displayPercent}%</Text>

        <View style={styles.sliderTrack}>
          <Animated.View style={[styles.sliderFill, { width: fillWidth }]} />
          <Animated.View style={[styles.handleWrap, { left: handleLeft }]}>
            <View style={styles.handlePill}>
              <Text style={styles.handlePillText}>{displayPercent}</Text>
            </View>
            <View style={styles.handleDot} />
          </Animated.View>
        </View>

        <Text style={styles.lessonsText}>
          {lessonsDone} / {lessonsTotal} dars
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 28 },
  card: {
    borderRadius: theme.radius.lg,
    padding: 24,
    overflow: 'hidden',
  },
  sparkle1: { position: 'absolute', top: 20, left: 130, color: 'rgba(255,255,255,0.45)', fontSize: 11 },
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
    top: 10,
    right: 10,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rocketEmoji: { fontSize: 32 },
});
