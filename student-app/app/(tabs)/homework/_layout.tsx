import { Redirect, Stack, useGlobalSearchParams, useSegments } from 'expo-router';
import { hiddenStudentSectionRedirect } from '@/constants/studentFeatures';
import { useLang } from '@/i18n/LanguageContext';

export default function HomeworkLayout() {
  const { courseLang } = useLang();
  const segments = useSegments();
  const { lessonId } = useGlobalSearchParams<{ lessonId?: string | string[] }>();
  const redirect = hiddenStudentSectionRedirect(courseLang, segments, lessonId);
  if (redirect) return <Redirect href={redirect} />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="roadmap/[courseId]" />
      <Stack.Screen name="bonus" />
      <Stack.Screen name="bonusLesson/[bonusId]/index" />
      <Stack.Screen name="exams/index" />
      <Stack.Screen name="exams/[examId]" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="lesson/[lessonId]/index" />
      <Stack.Screen name="lesson/[lessonId]/video/index" />
      <Stack.Screen name="lesson/[lessonId]/video/watch" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="lesson/[lessonId]/video/exercises" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="lesson/[lessonId]/speaking/index" />
      <Stack.Screen name="lesson/[lessonId]/speaking/slides" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="lesson/[lessonId]/speaking/exercises" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="lesson/[lessonId]/vocabulary/index" />
      <Stack.Screen name="lesson/[lessonId]/vocabulary/list" />
      <Stack.Screen name="lesson/[lessonId]/vocabulary/practice" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="lesson/[lessonId]/homework/index" />
      <Stack.Screen name="lesson/[lessonId]/homework/[part]" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
