/**
 * v2 — yangi dizayn ekranlari uchun alohida bo'lim (/student/v2).
 *
 * Haqiqiy o'quvchilar hozircha eski ilovada qoladi; bu bo'lim faqat
 * sinov uchun. Yangi shriftlar faqat shu yerda yuklanadi, shuning uchun
 * eski ilovaning ochilish tezligiga ta'sir qilmaydi.
 */
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { ActivityIndicator, Platform, View } from 'react-native';

import { WEB_FONT_BASE } from '@/constants/webFonts';
import { colors, fontFiles } from '@/constants/v2/tokens';

const nativeFonts = {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
};

// Webda shriftlar /student/fonts/ dan olinadi (eski Onest shriftlari kabi).
const webFonts = Object.fromEntries(
  Object.values(fontFiles).map((name) => [name, `${WEB_FONT_BASE}/${name}.ttf`]),
);

export default function V2Layout() {
  const [loaded] = useFonts(Platform.OS === 'web' ? webFonts : nativeFonts);

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.cobalt} accessibilityLabel="Yuklanmoqda" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
