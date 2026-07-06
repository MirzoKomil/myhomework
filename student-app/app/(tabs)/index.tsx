import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CourseProgressCard } from '@/components/ui/CourseProgressCard';
import { LessonReminder } from '@/components/ui/LessonReminder';
import { ShopEntryCard } from '@/components/ui/ShopEntryCard';
import { SkillBars } from '@/components/ui/SkillBars';
import { theme } from '@/constants/theme';
import { courses, dailyStages, nextLiveLesson, profileStats, skillProgress } from '@/data/mock';
import { fetchMobileContent } from '@/services/contentApi';
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
      router.push(`/homework/lesson/${lastPosition.lessonId}/${lastPosition.section}` as never);
      return;
    }
    fetchMobileContent()
      .then((mc) => {
        const course = mc.courses[0];
        const lessons = course ? mc.lessons.filter((l) => l.courseId === course.id) : [];
        const current = lessons.find((l) => l.isActive) ?? lessons[0];
        if (current) {
          router.push(`/homework/lesson/${current.id}` as never);
        } else {
          router.push('/homework');
        }
      })
      .catch(() => router.push('/homework'));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Salom,</Text>
          <Text style={styles.name}>{profileStats.name.split(' ')[0]} 👋</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} onPress={() => router.push('/messages' as never)}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={theme.colors.tabInactive} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => router.push('/notifications' as never)}>
            <Ionicons name="notifications-outline" size={24} color={theme.colors.tabInactive} />
            <View style={styles.badgeDot} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LessonReminder
          topic={nextLiveLesson.topic}
          startsAt={nextLiveLesson.startsAt}
          telegramLink={nextLiveLesson.telegramLink}
        />

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

        <Text style={styles.sectionTitle}>Ko'nikmalar progressi</Text>
        <SkillBars skills={skillProgress} />

        <CourseProgressCard
          progress={activeCourse.progress}
          lessonsDone={activeCourse.lessonsDone}
          lessonsTotal={activeCourse.lessonsTotal}
          onPress={handleContinue}
        />

        <ShopEntryCard onPress={() => router.push('/shop' as never)} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  greeting: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted },
  name: { fontFamily: theme.fonts.extraBold, fontSize: 26, color: theme.colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.danger,
    borderWidth: 1.5,
    borderColor: theme.colors.bg,
  },
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
