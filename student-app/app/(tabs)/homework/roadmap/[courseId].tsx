import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { courses, roadmapLessons } from '@/data/mock';

export default function RoadmapScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const course = courses.find((c) => c.id === courseId) ?? courses[0];
  const lessons = roadmapLessons[course.id] ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={course.title} showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Umumiy progress</Text>
          <Text style={styles.progressValue}>{course.progress}%</Text>
        </View>
        <ProgressBar progress={course.progress} height={8} />

        <View style={styles.path}>
          {lessons.map((lesson, index) => {
            const align = lesson.side === 'left' ? 'flex-start' : 'flex-end';
            const isActive = !lesson.locked && lesson.progress > 0 && lesson.progress < 100;
            return (
              <View key={lesson.id} style={[styles.nodeRow, { alignItems: align }]}>
                {index > 0 && <View style={styles.connector} />}
                <Pressable
                  disabled={lesson.locked}
                  onPress={() => router.push(`/homework/lesson/${lesson.id}`)}
                  style={[
                    styles.node,
                    lesson.locked && styles.nodeLocked,
                    isActive && styles.nodeActive,
                  ]}>
                  {lesson.locked ? (
                    <Ionicons name="lock-closed" size={22} color={theme.colors.textLight} />
                  ) : (
                    <Text style={styles.nodeNumber}>{lesson.id}</Text>
                  )}
                  <Text style={[styles.nodeTitle, lesson.locked && styles.nodeTitleLocked]}>
                    {lesson.title}
                  </Text>
                  {!lesson.locked && (
                    <Text style={styles.nodeProgress}>{lesson.progress}%</Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, marginTop: 8 },
  progressLabel: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted },
  progressValue: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.purple },
  path: { marginTop: 32, gap: 8 },
  nodeRow: { width: '100%' },
  connector: {
    width: 3,
    height: 32,
    backgroundColor: theme.colors.purpleLight,
    alignSelf: 'center',
    borderRadius: 2,
  },
  node: {
    width: '72%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 20,
    borderWidth: 2,
    borderColor: theme.colors.purpleLight,
    ...theme.shadow.card,
  },
  nodeActive: {
    borderColor: theme.colors.purple,
    backgroundColor: theme.colors.purpleLight,
  },
  nodeLocked: {
    opacity: 0.6,
    borderColor: theme.colors.border,
  },
  nodeNumber: {
    fontFamily: theme.fonts.extraBold,
    fontSize: 28,
    color: theme.colors.purple,
    marginBottom: 4,
  },
  nodeTitle: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  nodeTitleLocked: { color: theme.colors.textMuted },
  nodeProgress: { fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.purple, marginTop: 6 },
});
