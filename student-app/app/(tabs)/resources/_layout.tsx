import { Stack } from 'expo-router';

export default function ResourcesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="library/index" />
      <Stack.Screen name="library/grammar/index" />
      <Stack.Screen name="library/grammar/[topicId]" />
      <Stack.Screen name="library/words/index" />
      <Stack.Screen name="library/words/[topicId]" />
      <Stack.Screen name="games/index" />
      <Stack.Screen name="games/word-chain" />
      <Stack.Screen name="games/memory-match" />
      <Stack.Screen name="games/word-search" />
      <Stack.Screen name="games/mystery-word" />
    </Stack>
  );
}
