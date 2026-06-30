import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { fetchMobileContent, AdminCourse } from '@/services/contentApi';

type CourseVM = AdminCourse & { lessonsTotal: number; lessonsDone: number; progress: number };

export default function HomeworkCoursesScreen() {
  const [courses, setCourses] = useState<CourseVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMobileContent()
      .then((mc) => {
        const vms: CourseVM[] = mc.courses.map((c) => {
          const total = mc.lessons.filter((l) => l.courseId === c.id).length;
          return { ...c, lessonsTotal: total, lessonsDone: 0, progress: 0 };
        });
        setCourses(vms);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Uy vazifasi" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Kursingizni tanlang va darslarga o'ting</Text>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.purple} />
          </View>
        )}

        {error && (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={40} color={theme.colors.textMuted} />
            <Text style={styles.errorText}>Kurslarni yuklab bo'lmadi</Text>
          </View>
        )}

        {!loading && !error && courses.length === 0 && (
          <View style={styles.center}>
            <Ionicons name="book-outline" size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Hali kurslar qo'shilmagan</Text>
          </View>
        )}

        {courses.map((course) => (
          <Pressable
            key={course.id}
            onPress={() => router.push(`/homework/roadmap/${course.id}`)}>
            <Card style={styles.courseCard}>
              <View style={styles.courseTop}>
                <View style={styles.iconWrap}>
                  <Ionicons name="book" size={22} color={theme.colors.purple} />
                </View>
                <View style={styles.courseInfo}>
                  <Text style={styles.courseTitle}>{course.name}</Text>
                  <Text style={styles.courseLevel}>{course.lessonsTotal} ta dars</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
              </View>
              <ProgressBar progress={course.progress} />
              <Text style={styles.progressText}>
                {course.lessonsDone} / {course.lessonsTotal} dars · {course.progress}%
              </Text>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 32, gap: 16 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginBottom: 8 },
  courseCard: { marginBottom: 4 },
  courseTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 14 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseInfo: { flex: 1 },
  courseTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text },
  courseLevel: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  progressText: { fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.textMuted, marginTop: 8 },
  center: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted },
  errorText: { fontFamily: theme.fonts.medium, fontSize: 15, color: '#ef4444' },
});
