/**
 * Kompyuter: yuklanish skeleti (D_Loading) va server xatosi (D_ServerError).
 * Ko'p ekranlar ishlatadi: menyuli sahifada — yon menyu yonidagi joyni
 * to'ldiradi; menyusiz (fokus) sahifada — butun oyna.
 */
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View, type DimensionValue, type TextStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { isFocusPath } from '@/components/v2/desktop/Shell';
import { supportUrl } from '@/components/v2/home/shared';
import { designImages } from '@/constants/v2/designImages';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';

import { AlertIcon, PulseIcon, RetryIcon, TgIcon } from './icons';

// ─── Yuklanish ─────────────────────────────────────────────────────────────
const B = ({ w, h, r, bg = '#E4E8F0' }: { w: DimensionValue; h: number; r: number; bg?: string }) => <View style={{ width: w, height: h, borderRadius: r, backgroundColor: bg }} />;

function Toast() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    a.start();
    return () => a.stop();
  }, [spin]);
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  return (
    <View style={l.toastAnchor} pointerEvents="none">
      <View accessibilityRole="progressbar" accessibilityLiveRegion="polite" style={l.toast}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Circle cx={12} cy={12} r={9} fill="none" stroke="#34405A" strokeWidth={3} />
            <Path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
          </Svg>
        </Animated.View>
        <Text style={l.toastText}>Yuklanmoqda…</Text>
      </View>
    </View>
  );
}

export function DLoading() {
  // Mobil Loading kabi: har qanday ekranda bosh sahifa skeleti (dizayndagi yagona holat).
  return (
    <View style={l.screen} accessibilityState={{ busy: true }}>
      <View style={{ flex: 1 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={l.header}>
          <View style={{ gap: 10 }}>
            <B w={220} h={12} r={6} />
            <B w={340} h={26} r={10} />
          </View>
          <View style={{ flex: 1 }} />
          <B w={46} h={46} r={23} />
          <B w={140} h={46} r={23} />
        </View>
        <View style={l.grid}>
          <View style={{ flex: 1, minWidth: 0, gap: 24 }}>
            <View style={[l.card, { height: 306, backgroundColor: '#DCE4FF' }]}>
              <B w={150} h={26} r={13} bg="#C7D4FF" />
              <B w="62%" h={40} r={12} bg="#C7D4FF" />
              <B w="44%" h={22} r={10} bg="#C7D4FF" />
              <View style={{ marginTop: 18 }}>
                <B w="70%" h={6} r={3} bg="#C7D4FF" />
              </View>
              <View style={{ flex: 1 }} />
              <B w={225} h={52} r={17} bg="#E8EEFF" />
            </View>
            <View
              style={[
                l.card,
                {
                  height: 88,
                  backgroundColor: '#1B2438',
                  paddingVertical: 20,
                  paddingHorizontal: 26,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 20,
                },
              ]}
            >
              <B w={200} h={34} r={10} bg="#2A3550" />
              <B w={180} h={30} r={10} bg="#2A3550" />
              <View style={{ flex: 1 }} />
              <B w={140} h={46} r={14} bg="#2A3550" />
              <B w={120} h={46} r={14} bg="#2A3550" />
            </View>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[l.card, { flex: 1, height: 130, padding: 16 }]}>
                  <B w={56} h={56} r={16} bg="#EEF1F7" />
                  <B w="80%" h={14} r={7} />
                  <B w="55%" h={12} r={6} bg="#EEF1F7" />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {Array.from({ length: 7 }, (_, i) => (
                <View
                  key={i}
                  style={[
                    l.card,
                    {
                      flex: 1,
                      height: 88,
                      padding: 14,
                      borderRadius: 18,
                      gap: 8,
                    },
                  ]}
                >
                  <B w="60%" h={12} r={6} />
                  <B w="80%" h={16} r={7} />
                  <B w="50%" h={10} r={5} bg="#EEF1F7" />
                </View>
              ))}
            </View>
          </View>
          <View style={{ width: 320, gap: 20 }}>
            <View style={[l.card, { height: 212 }]}>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <B w={56} h={56} r={28} />
                <View style={{ flex: 1, gap: 8 }}>
                  <B w="70%" h={14} r={7} />
                  <B w="50%" h={12} r={6} bg="#EEF1F7" />
                </View>
              </View>
              <B w="100%" h={1} r={0} bg="#EEF1F7" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {Array.from({ length: 7 }, (_, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: '#EEF1F7',
                    }}
                  />
                ))}
              </View>
            </View>
            <View style={[l.card, { height: 260 }]}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <B w={40} h={40} r={20} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <B w="60%" h={12} r={6} />
                    <B w="40%" h={10} r={5} bg="#EEF1F7" />
                  </View>
                </View>
              ))}
            </View>
            <View style={[l.card, { height: 136, backgroundColor: '#FFF7E0' }]}>
              <B w="50%" h={12} r={6} />
              <B w="80%" h={16} r={7} />
              <B w="60%" h={12} r={6} bg="#EEF1F7" />
            </View>
            <View style={[l.card, { height: 96 }]}>
              <B w="60%" h={14} r={7} />
              <B w="100%" h={8} r={4} bg="#EEF1F7" />
            </View>
          </View>
        </View>
      </View>
      <Toast />
    </View>
  );
}

const l = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA', overflow: 'hidden' },
  header: {
    height: 84,
    paddingHorizontal: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  grid: {
    flex: 1,
    paddingTop: 4,
    paddingHorizontal: 40,
    paddingBottom: 32,
    flexDirection: 'row',
    gap: 24,
  },
  card: { borderRadius: 24, backgroundColor: '#FFFFFF', padding: 24, gap: 14 },
  toastAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: 'center',
  },
  toast: {
    height: 48,
    paddingLeft: 16,
    paddingRight: 20,
    borderRadius: 24,
    backgroundColor: '#0B1220',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 12px 30px rgba(11,18,32,0.25)',
  },
  toastText: {
    fontFamily: fonts.bodyHeavy,
    fontWeight: 'normal',
    fontSize: 15,
    color: '#FFFFFF',
  },
});

// ─── Server xatosi ─────────────────────────────────────────────────────────
/** Avtomatik qayta urinishgacha soniya — mobil bilan bir xil. */
const AUTO_RETRY_SEC = 15;
const STATUS_URL = 'https://status.myhomework.uz';
const RING = 2 * Math.PI * 16; // ≈100.5 — dizayndagi dasharray

export function DServerError({ onRetry, code = 503 }: { onRetry: () => void; code?: number | string }) {
  const { courseLang } = useLang();
  const focus = isFocusPath(usePathname());
  const [left, setLeft] = useState(AUTO_RETRY_SEC);
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;

  useEffect(() => {
    const id = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (left === 0) retryRef.current();
  }, [left]);

  const leftLabel = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const ru = courseLang === 'russian';

  return (
    <ScrollView style={e.screen} contentContainerStyle={{ flexGrow: 1 }}>
      {/* Logotip faqat menyusiz oynada — menyuli sahifada u chap menyuda bor. */}
      <View style={e.header}>
        {focus && (
          <View style={e.brand}>
            <View style={e.brandIcon}>
              <Image source={designImages.b924b8ccc546d63f781f9ea1bd9db221} style={{ width: 42, height: 44, marginTop: 4 }} resizeMode="contain" />
            </View>
            <View>
              <Text style={e.brandName}>{ru ? 'Domwork' : 'Homework'}</Text>
              <Text style={e.brandSub}>{ru ? 'Rus tili' : 'Ingliz tili'} · onlayn maktab</Text>
            </View>
          </View>
        )}
      </View>
      <View style={e.center}>
        <View style={e.card}>
          <View style={e.art}>
            <View style={e.artCircle} />
            <Image source={designImages.cc0d95446730f059d25d989e2c9845ad} accessibilityLabel="Oʻylanib qolgan Domik" style={{ width: 320, height: 320 }} resizeMode="contain" />
          </View>
          <View style={e.text}>
            <View style={e.code}>
              <AlertIcon />
              <Text style={e.codeText}>Xato kodi: {code}</Text>
            </View>
            <Text accessibilityRole="header" style={e.h1}>
              Nimadir notoʻgʻri ketdi
            </Text>
            <Text style={e.p}>Serverda vaqtinchalik nosozlik. Birozdan soʻng qayta urinib koʻring.</Text>
            <View style={e.infoRow}>
              <View style={e.info} accessibilityLiveRegion="polite">
                <Svg width={40} height={40} viewBox="0 0 40 40">
                  <Circle cx={20} cy={20} r={16} fill="none" stroke="#DCE4FF" strokeWidth={5} />
                  <Circle
                    cx={20}
                    cy={20}
                    r={16}
                    fill="none"
                    stroke="#2F5BFF"
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeDasharray={`${RING}`}
                    strokeDashoffset={(RING * left) / AUTO_RETRY_SEC}
                    transform="rotate(-90 20 20)"
                  />
                </Svg>
                <View style={{ gap: 1 }}>
                  <Text style={[e.infoLabel, { whiteSpace: 'nowrap' } as TextStyle]}>Avtomatik qayta urinish</Text>
                  <Text style={e.infoValue}>{leftLabel}</Text>
                </View>
              </View>
              <Pressable accessibilityRole="link" onPress={() => Linking.openURL(STATUS_URL).catch(() => {})} style={e.info}>
                <View style={e.pulse}>
                  <PulseIcon />
                </View>
                <View style={{ gap: 1, minWidth: 0 }}>
                  <Text style={e.infoLabel}>Holat:</Text>
                  <Text style={[e.statusLink, { whiteSpace: 'nowrap' } as TextStyle]}>status.myhomework.uz</Text>
                </View>
              </Pressable>
            </View>
            <View style={e.actions}>
              <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [e.retry, pressed && { backgroundColor: '#1E3FD1' }]}>
                <RetryIcon />
                <Text style={e.retryText}>Qayta urinish</Text>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => Linking.openURL(supportUrl(courseLang)).catch(() => {})} style={e.help}>
                <TgIcon size={19} color="#1B8BC9" />
                <Text style={e.helpText}>Yordamga yozish</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const T = (f: string, size: number, extra?: TextStyle): TextStyle => ({
  fontFamily: f,
  fontWeight: 'normal',
  fontSize: size,
  ...extra,
});

const e = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  header: {
    height: 84,
    paddingHorizontal: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#E8EEFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandName: T(fonts.display, 23, {
    lineHeight: 24.15,
    letterSpacing: -0.46,
    color: '#0B1220',
  }),
  brandSub: T(fonts.bodyBold, 12, { color: '#4A5468' }),
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
    paddingHorizontal: 24,
  },
  card: {
    width: 1040,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingVertical: 44,
    paddingHorizontal: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
  },
  art: {
    width: 360,
    height: 380,
    borderRadius: 28,
    backgroundColor: '#E8EEFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  artCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#DCE4FF',
  },
  text: { flex: 1, minWidth: 0, gap: 18 },
  code: {
    alignSelf: 'flex-start',
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FDECEC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  codeText: T(fonts.bodyHeavy, 14, { color: '#B42318' }),
  h1: T(fonts.display, 40, {
    lineHeight: 43.2,
    letterSpacing: -0.8,
    color: '#0B1220',
  }),
  p: T(fonts.body, 17, { lineHeight: 26.35, color: '#4A5468' }),
  infoRow: { flexDirection: 'row', gap: 12 },
  info: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#F4F6FA',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: T(fonts.bodyBold, 13, { color: '#4A5468' }),
  infoValue: T(fonts.bodyHeavy, 18, { color: '#0B1220' }),
  pulse: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLink: T(fonts.bodyHeavy, 14, { color: '#1E3FD1' }),
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  retry: {
    flex: 1,
    height: 56,
    paddingHorizontal: 22,
    borderRadius: 17,
    backgroundColor: '#2F5BFF',
    boxShadow: '0 5px 0 #1E3FD1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  retryText: T(fonts.bodyHeavy, 15, { color: '#FFFFFF' }),
  help: {
    flex: 1,
    height: 56,
    paddingHorizontal: 22,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E6EE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  helpText: T(fonts.bodyHeavy, 15, { color: '#0B1220' }),
});
