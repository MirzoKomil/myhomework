import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CourseProgressCard } from '@/components/ui/CourseProgressCard';
import { LessonReminder } from '@/components/ui/LessonReminder';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SkillBars } from '@/components/ui/SkillBars';
import { theme } from '@/constants/theme';
import { courses, dailyStages, nextLiveLesson, profileStats, skillProgress } from '@/data/mock';
import { getLastPosition, LastPosition } from '@/services/progressStore';

export default function HomeScreen() {
  const activeCourse = courses[0];
  const [lastPosition, setLastPosition] = useState<LastPosition | null>(null);

  useFocusEffect(
    useCallback(() => {
      getLastPosition().then(setLastPosition);
    }, [])
  );

  const handleContinue = () => {
    if (lastPosition) {
      router.push(`/homework/lesson/${lastPosition.lessonId}/module/${lastPosition.moduleId}` as never);
    } else {
      router.push('/homework');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Salom,</Text>
            <Text style={styles.name}>{profileStats.name.split(' ')[0]} 👋</Text>
          </View>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={theme.colors.purple} />
          </View>
        </View>

        <LinearGradient
          colors={['#9B7BFF', '#6B4FE0', '#5B6CF8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <Text style={styles.heroLabel}>Bugungi maqsad</Text>
          <Text style={styles.heroTitle}>2 ta vazifani yakunlang</Text>
          <ProgressBar progress={55} color="#fff" height={8} />
          <Text style={styles.heroProgress}>55% bajarildi</Text>
        </LinearGradient>

        <View style={styles.quickGrid}>
          {dailyStages.map((stage) => {
            const inner = (
              <>
                <View style={[styles.quickIcon, { backgroundColor: stage.bg }]}>
                  <Ionicons name={stage.icon} size={22} color={stage.color} />
                </View>
                <Text style={styles.quickLabel}>{stage.label}</Text>
              </>
            );
            if (stage.route) {
              return (
                <Pressable
                  key={stage.key}
                  style={styles.quickItem}
                  onPress={() => router.push(stage.route as never)}>
                  {inner}
                </Pressable>
              );
            }
            return (
              <View key={stage.key} style={styles.quickItem}>
                {inner}
              </View>
            );
          })}
        </View>

        <LessonReminder
          topic={nextLiveLesson.topic}
          startsAt={nextLiveLesson.startsAt}
          telegramLink={nextLiveLesson.telegramLink}
        />

        <Text style={styles.sectionTitle}>Ko'nikmalar progressi</Text>
        <SkillBars skills={skillProgress} />

        <CourseProgressCard
          progress={activeCourse.progress}
          lessonsDone={activeCourse.lessonsDone}
          lessonsTotal={activeCourse.lessonsTotal}
          onPress={handleContinue}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted },
  name: { fontFamily: theme.fonts.extraBold, fontSize: 26, color: theme.colors.text },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { borderRadius: theme.radius.lg, padding: 24, marginBottom: 28 },
  heroLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  heroTitle: { fontFamily: theme.fonts.bold, fontSize: 20, color: '#fff', marginBottom: 16 },
  heroProgress: { fontFamily: theme.fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 8 },
  sectionTitle: { fontFamily: theme.fonts.bold, fontSize: 18, color: theme.colors.text, marginBottom: 14 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  quickItem: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    ...theme.shadow.card,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickLabel: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text },
});
