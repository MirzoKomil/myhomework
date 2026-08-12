import {
  GolosText_400Regular,
  GolosText_500Medium,
  GolosText_600SemiBold,
  GolosText_700Bold,
  GolosText_800ExtraBold,
} from '@expo-google-fonts/golos-text';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { TeacherRatingModal } from '@/components/TeacherRatingModal';
import { theme } from '@/constants/theme';
import { WEB_FONT_BASE } from '@/constants/webFonts';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { getToken, loadAuth } from '@/services/studentAuthStore';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const nativeFonts = {
  ...Ionicons.font,
  GolosText_400Regular,
  GolosText_500Medium,
  GolosText_600SemiBold,
  GolosText_700Bold,
  GolosText_800ExtraBold,
};

const webFonts = {
  GolosText_400Regular: `${WEB_FONT_BASE}/golos-400.ttf`,
  GolosText_500Medium: `${WEB_FONT_BASE}/golos-500.ttf`,
  GolosText_600SemiBold: `${WEB_FONT_BASE}/golos-600.ttf`,
  GolosText_700Bold: `${WEB_FONT_BASE}/golos-700.ttf`,
  GolosText_800ExtraBold: `${WEB_FONT_BASE}/golos-800.ttf`,
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

  // 6-vazifa (qayta ish): haqiqiy o'quvchi tokeni avval faqat Sozlamalar
  // ekrani ochilganda useAuth() orqali AsyncStorage'dan yuklanardi — shu
  // sababli foydalanuvchi login qilib to'g'ridan-to'g'ri boshqa ekranga
  // o'tsa (masalan To'lovlar), getToken() hali bo'sh qaytarardi va barcha
  // "demo-*" so'rovlar (shartnoma, baholar, jadval, xabarlar va h.k.)
  // xato ravishda "Namuna o'quvchi"ga tushib qolardi. Endi ilova ochilishi
  // bilanoq shu yerda bir marta yuklab qo'yiladi.
  useEffect(() => {
    loadAuth();
  }, []);

  // 151-ish (qayta ish): standalone brauzerdan (haqiqiy foydalanuvchi)
  // /student/ manziliga to'g'ridan-to'g'ri kirilganda token bo'lmasa
  // login sahifasiga yo'naltiramiz. CRM'ning o'z "O'quvchi ilovasi"
  // ko'rib chiqish tabi /student/'ni bir xil origin'dagi iframe'da
  // ochadi (js/app.js) — shu holatda hech qanday yo'naltirish qilinmaydi,
  // 150-ish arxitekturasidagi demo tajriba o'zgarishsiz qoladi.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cancelled = false;
    (async () => {
      await loadAuth();
      if (cancelled) return;
      const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;
      if (isEmbedded) return;
      if (getToken()) return;
      if (typeof window !== 'undefined' && window.location.pathname.includes('login')) return;
      router.replace('/login' as never);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;

  return (
    <LanguageProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
      </Stack>
      <TeacherRatingModal />
    </LanguageProvider>
  );
}
