import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="grades" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="payment" />
      <Stack.Screen name="leaderboard" />
    </Stack>
  );
}
