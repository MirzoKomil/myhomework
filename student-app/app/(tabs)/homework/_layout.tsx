import { Stack } from 'expo-router';

export default function HomeworkLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="roadmap/[courseId]" />
      <Stack.Screen name="bonus" />
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
