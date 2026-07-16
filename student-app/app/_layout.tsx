import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { TeacherRatingModal } from '@/components/TeacherRatingModal';
import { theme } from '@/constants/theme';
import { WEB_FONT_BASE } from '@/constants/webFonts';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const nativeFonts = {
  ...Ionicons.font,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

const webFonts = {
  PlusJakartaSans_400Regular: `${WEB_FONT_BASE}/plus-jakarta-400.ttf`,
  PlusJakartaSans_500Medium: `${WEB_FONT_BASE}/plus-jakarta-500.ttf`,
  PlusJakartaSans_600SemiBold: `${WEB_FONT_BASE}/plus-jakarta-600.ttf`,
  PlusJakartaSans_700Bold: `${WEB_FONT_BASE}/plus-jakarta-700.ttf`,
  PlusJakartaSans_800ExtraBold: `${WEB_FONT_BASE}/plus-jakarta-800.ttf`,
  ionicons: `${WEB_FONT_BASE}/ionicons.ttf`,
};

export default function RootLayout() {
  const [loaded, error] = useFonts(Platform.OS === 'web' ? webFonts : nativeFonts);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Myhomework — O\'quvchi';
    }
  }, []);

  if (!loaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
      </Stack>
      <TeacherRatingModal />
    </>
  );
}
