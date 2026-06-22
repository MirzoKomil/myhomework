import { Stack } from 'expo-router';

export default function HomeworkLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="roadmap/[courseId]" />
      <Stack.Screen name="lesson/[lessonId]/index" />
      <Stack.Screen name="lesson/[lessonId]/video" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="lesson/[lessonId]/speaking" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="lesson/[lessonId]/quiz" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
