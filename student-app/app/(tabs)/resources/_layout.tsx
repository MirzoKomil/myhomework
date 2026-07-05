import { Stack } from 'expo-router';

export default function ResourcesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="library" />
      <Stack.Screen name="games/index" />
      <Stack.Screen name="games/word-chain" />
      <Stack.Screen name="games/memory-match" />
      <Stack.Screen name="games/word-search" />
      <Stack.Screen name="games/mystery-word" />
    </Stack>
  );
}
