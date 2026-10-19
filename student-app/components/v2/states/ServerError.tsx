/**
 * Server xatosi holati (dizayn: ServerError.dc.html).
 * `code` — ko'rsatiladigan HTTP kodi (berilmasa dizayndagi 503).
 */
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { ErrorCircleIcon, RetryIcon, TelegramIcon } from '@/components/v2/home/icons';
import { supportUrl } from '@/components/v2/home/shared';
import { designImages } from '@/constants/v2/designImages';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';

export function ServerError({ onRetry, code = 503 }: { onRetry: () => void; code?: number | string }) {
  const insets = useSafeAreaInsets();
  const { courseLang } = useLang();
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        <View style={styles.column}>
          <View style={[styles.center, { paddingTop: insets.top + 10 }]}>
            <View style={styles.art}>
              {/* radial-gradient(circle at 50% 55%, #FFF 0, #FFF 40%, transparent 70%) */}
              <Svg width={240} height={230} style={StyleSheet.absoluteFill} accessible={false}>
                <Defs>
                  <RadialGradient id="g" cx="50%" cy="55%" r="50%" fx="50%" fy="55%">
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
                    <Stop offset="0.57" stopColor="#FFFFFF" stopOpacity={1} />
                    <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="240" height="230" rx="120" fill="url(#g)" />
              </Svg>
              <Image source={designImages.cc0d95446730f059d25d989e2c9845ad} accessibilityLabel="Oʻylanib qolgan Domik" style={styles.mascot} resizeMode="contain" />
            </View>
            <Text style={styles.h1} accessibilityRole="header">Nimadir notoʻgʻri ketdi</Text>
            <Text style={styles.p}>Serverga ulanib boʻlmadi. Internetni tekshiring va qayta urinib koʻring.</Text>
            <View style={styles.code}>
              <ErrorCircleIcon />
              <Text style={styles.codeText}>Xato kodi: {code}</Text>
            </View>
          </View>

          <View style={[styles.actions, { paddingBottom: Math.max(34, insets.bottom + 14) }]}>
            <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && { backgroundColor: '#1E3FD1' }]}>
              <RetryIcon />
              <Text style={styles.retryText}>Qayta urinish</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(supportUrl(courseLang))} style={styles.help}>
              <TelegramIcon color="#1B6FA8" />
              <Text style={styles.helpText}>Yordamga yozish</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  center: { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', gap: 12 },
  art: { width: 240, height: 230, alignItems: 'center', justifyContent: 'center' },
  mascot: { width: 190, height: 200 },
  h1: { marginTop: 4, fontFamily: fonts.display, fontSize: 28, lineHeight: 30.8, letterSpacing: -0.56, color: '#0B1220', textAlign: 'center', fontWeight: 'normal' },
  p: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: '#4A5468', textAlign: 'center', maxWidth: 310, fontWeight: 'normal' },
  code: { marginTop: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  codeText: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  actions: { paddingTop: 16, paddingHorizontal: 20, gap: 10 },
  retry: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  retryText: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: '#FFFFFF', fontWeight: 'normal' },
  help: { height: 52, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E4E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  helpText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#0B1220', fontWeight: 'normal' },
});
