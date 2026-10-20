/**
 * Server xatosi holati (dizayn: ServerError.dc.html).
 * `code` — ko'rsatiladigan HTTP kodi (berilmasa dizayndagi 503).
 * "Avtomatik qayta urinish" — haqiqiy teskari sanoq: 0 ga yetganda onRetry chaqiriladi.
 */
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { DServerError } from '@/components/v2/desktop/home/DStates';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';
import { ErrorCircleIcon, RetryIcon, TelegramIcon } from '@/components/v2/home/icons';
import { supportUrl } from '@/components/v2/home/shared';
import { designImages } from '@/constants/v2/designImages';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';

/** Avtomatik qayta urinishgacha soniya. */
const AUTO_RETRY_SEC = 15;
const STATUS_URL = 'https://status.myhomework.uz';

const ExternalIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6B7489" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" accessible={false} style={{ flexShrink: 0 }}>
    <Path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Svg>
);

export function ServerError(props: { onRetry: () => void; code?: number | string }) {
  // Kompyuterda — D_ServerError.
  return useIsDesktop() ? <DServerError {...props} /> : <ServerErrorMobile {...props} />;
}

function ServerErrorMobile({ onRetry, code = 503 }: { onRetry: () => void; code?: number | string }) {
  const insets = useSafeAreaInsets();
  const { courseLang } = useLang();
  const [left, setLeft] = useState(AUTO_RETRY_SEC);
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;

  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (left === 0) retryRef.current();
  }, [left]);

  const leftLabel = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        <View style={styles.column}>
          <View style={[styles.center, { paddingTop: Math.max(insets.top, 44) + 10, paddingBottom: Math.max(34, insets.bottom + 14) }]}>
            <View style={styles.art}>
              {/* radial-gradient(circle at 50% 55%, #FFF 0, #FFF 40%, transparent 70%) */}
              <Svg width={260} height={250} style={StyleSheet.absoluteFill} accessible={false}>
                <Defs>
                  <RadialGradient id="g" cx="50%" cy="55%" r="50%" fx="50%" fy="55%">
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
                    <Stop offset="0.57" stopColor="#FFFFFF" stopOpacity={1} />
                    <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="260" height="250" rx="130" fill="url(#g)" />
              </Svg>
              <Image source={designImages.cc0d95446730f059d25d989e2c9845ad} accessibilityLabel="Oʻylanib qolgan Domik" style={styles.mascot} resizeMode="contain" />
            </View>
            <Text style={styles.h1} accessibilityRole="header">Nimadir notoʻgʻri ketdi</Text>
            <Text style={styles.p}>Serverda vaqtinchalik nosozlik. Birozdan soʻng qayta urinib koʻring.</Text>

            <View style={styles.info}>
              <View style={[styles.row, styles.rowLine]}>
                <ErrorCircleIcon size={18} />
                <Text style={styles.rowLabel}>Xato kodi</Text>
                <Text style={styles.rowValue}>{code}</Text>
              </View>
              <View style={[styles.row, styles.rowLine]} accessibilityLiveRegion="polite">
                <RetryIcon size={18} color="#2F5BFF" />
                <Text style={styles.rowLabel}>Avtomatik qayta urinish</Text>
                <Text style={[styles.rowValue, { fontVariant: ['tabular-nums'] }]}>{leftLabel}</Text>
              </View>
              <Pressable accessibilityRole="link" onPress={() => Linking.openURL(STATUS_URL)} style={styles.row}>
                <View style={styles.statusDot} />
                <Text style={styles.rowLabel}>
                  Holat: <Text style={styles.statusLink}>status.myhomework.uz</Text>
                </Text>
                <ExternalIcon />
              </Pressable>
            </View>

            <View style={styles.actions}>
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
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  center: { flex: 1, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', gap: 12 },
  art: { width: 260, height: 250, alignItems: 'center', justifyContent: 'center' },
  mascot: { width: 210, height: 220 },
  h1: { marginTop: 4, fontFamily: fonts.display, fontSize: 28, lineHeight: 30.8, letterSpacing: -0.56, color: '#0B1220', textAlign: 'center', fontWeight: 'normal' },
  p: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: '#4A5468', textAlign: 'center', maxWidth: 310, fontWeight: 'normal' },
  info: { marginTop: 6, alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 4, paddingHorizontal: 14 },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  rowLabel: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: '#4A5468', fontWeight: 'normal' },
  rowValue: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#0B1220', fontWeight: 'normal' },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F5A300', marginHorizontal: 4, flexShrink: 0 },
  statusLink: { fontFamily: fonts.bodyHeavy, color: '#1E3FD1' },
  actions: { marginTop: 10, alignSelf: 'stretch', gap: 10 },
  retry: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  retryText: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: '#FFFFFF', fontWeight: 'normal' },
  help: { height: 52, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E4E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  helpText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#0B1220', fontWeight: 'normal' },
});
