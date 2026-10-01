import {
  Onest_400Regular,
  Onest_500Medium,
  Onest_600SemiBold,
  Onest_700Bold,
  Onest_800ExtraBold,
} from '@expo-google-fonts/onest';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { TeacherRatingModal } from '@/components/TeacherRatingModal';
import { theme } from '@/constants/theme';
import { WEB_FONT_BASE } from '@/constants/webFonts';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { loadAuth, useAuth } from '@/services/studentAuthStore';
import { invalidateCache } from '@/services/contentApi';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const nativeFonts = {
  ...Ionicons.font,
  Onest_400Regular,
  Onest_500Medium,
  Onest_600SemiBold,
  Onest_700Bold,
  Onest_800ExtraBold,
};

const webFonts = {
  Onest_400Regular: `${WEB_FONT_BASE}/onest-400.ttf`,
  Onest_500Medium: `${WEB_FONT_BASE}/onest-500.ttf`,
  Onest_600SemiBold: `${WEB_FONT_BASE}/onest-600.ttf`,
  Onest_700Bold: `${WEB_FONT_BASE}/onest-700.ttf`,
  Onest_800ExtraBold: `${WEB_FONT_BASE}/onest-800.ttf`,
  ionicons: `${WEB_FONT_BASE}/ionicons.ttf`,
};

export default function RootLayout() {
  const [loaded, error] = useFonts(Platform.OS === 'web' ? webFonts : nativeFonts);
  const [authLoaded, setAuthLoaded] = useState(false);
  const { token } = useAuth();
  const isEmbedded = Platform.OS === 'web' && typeof window !== 'undefined' && window.self !== window.top;
  const canViewStudent = !!token || isEmbedded;

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && authLoaded) SplashScreen.hideAsync();
  }, [loaded, authLoaded]);

  // 5-vazifa: document.title endi bu yerda emas, i18n/LanguageContext'da
  // courseLang'ga ("Homework"/"Domwork") qarab dinamik belgilanadi — bu
  // yerda ham qo'yilsa, mount effektlari tartibi sababli har doim
  // KEYIN ishga tushib, o'sha to'g'ri nomni qayta eskisiga qaytarib
  // yuborardi.

  // 6-vazifa (qayta ish): haqiqiy o'quvchi tokeni avval faqat Sozlamalar
  // ekrani ochilganda useAuth() orqali AsyncStorage'dan yuklanardi — shu
  // sababli foydalanuvchi login qilib to'g'ridan-to'g'ri boshqa ekranga
  // o'tsa (masalan To'lovlar), getToken() hali bo'sh qaytarardi va barcha
  // "demo-*" so'rovlar (shartnoma, baholar, jadval, xabarlar va h.k.)
  // xato ravishda "Namuna o'quvchi"ga tushib qolardi. Endi ilova ochilishi
  // bilanoq shu yerda bir marta yuklab qo'yiladi.
  useEffect(() => {
    let cancelled = false;
    loadAuth().then(() => { if (!cancelled) setAuthLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  // O'quvchi ilovani fon rejimiga o'tkazib, keyin qaytib ochganda (masalan
  // boshqa ilovaga o'tib qaytgach) dars/test ma'lumotlari darhol yangi
  // bo'lishi kerak — aks holda CRM'dagi tuzatishlar (masalan test to'g'ri
  // javobi) uzoq ochiq turgan eski sessiyalarga yetib bormay qoladi.
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        invalidateCache();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  if (!loaded || !authLoaded) return null;

  return (
    <LanguageProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}>
        <Stack.Protected guard={canViewStudent}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
      </Stack>
      {canViewStudent && <TeacherRatingModal key={token || 'preview'} />}
    </LanguageProvider>
  );
}
