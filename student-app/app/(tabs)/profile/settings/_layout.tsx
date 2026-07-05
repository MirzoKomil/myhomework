import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="language" />
      <Stack.Screen name="active-lessons" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="devices" />
      <Stack.Screen name="about" />
      <Stack.Screen name="faq" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="contacts" />
    </Stack>
  );
}
