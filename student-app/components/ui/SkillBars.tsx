import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { SkillProgress } from '@/data/mock';

const BAR_HEIGHT = 110;
const SHIMMER_HEIGHT = 46;

type SkillBarsProps = {
  skills: SkillProgress[];
};

const GRADIENTS: Record<SkillProgress['key'], [string, string]> = {
  vocabulary: ['#9B7BFF', '#6B4FE0'],
  speaking: ['#6FA8FF', '#4F8CFF'],
  listening: ['#FB92C6', '#F472B6'],
  grammar: ['#FFCE6B', '#FBBF24'],
  writing: ['#5EE6B0', '#34D399'],
};

function SkillBar({ skill, progressAnim }: { skill: SkillProgress; progressAnim: Animated.Value }) {
  const [displayPercent, setDisplayPercent] = useState(0);
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => {
      setDisplayPercent(Math.round(value * skill.progress));
    });
    return () => progressAnim.removeListener(id);
  }, [progressAnim, skill.progress]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const fillHeight = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.max(6, skill.progress)}%`],
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [BAR_HEIGHT, -SHIMMER_HEIGHT],
  });

  return (
    <View style={styles.col}>
      <Text style={styles.percent}>{displayPercent}%</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { height: fillHeight }]}>
          <LinearGradient
            colors={GRADIENTS[skill.key]}
            start={{ x: 0, y: 1 }}
            end={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View pointerEvents="none" style={[styles.shimmer, { transform: [{ translateY: shimmerTranslate }] }]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>
      </View>
      <Ionicons name={skill.icon} size={15} color={theme.colors.textMuted} style={styles.icon} />
      <Text style={styles.label}>{skill.label}</Text>
    </View>
  );
}

export function SkillBars({ skills }: SkillBarsProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, [progressAnim])
  );

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {skills.map((skill) => (
          <SkillBar key={skill.key} skill={skill} progressAnim={progressAnim} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 20,
    marginBottom: 28,
    ...theme.shadow.card,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  col: { alignItems: 'center', flex: 1 },
  percent: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.text, marginBottom: 6 },
  track: {
    width: 22,
    height: BAR_HEIGHT,
    borderRadius: 11,
    backgroundColor: theme.colors.bg,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: { width: '100%', borderRadius: 11, overflow: 'hidden' },
  shimmer: { position: 'absolute', left: 0, right: 0, height: SHIMMER_HEIGHT },
  icon: { marginTop: 10, marginBottom: 4 },
  label: { fontFamily: theme.fonts.medium, fontSize: 10, color: theme.colors.textMuted, textAlign: 'center' },
});
