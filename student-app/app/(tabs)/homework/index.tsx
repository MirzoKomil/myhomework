import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { courses } from '@/data/mock';

export default function HomeworkCoursesScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Uy vazifasi" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Kursingizni tanlang va darslarga o'ting</Text>
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
                  <Text style={styles.courseTitle}>{course.title}</Text>
                  <Text style={styles.courseLevel}>{course.level} daraja</Text>
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
});
