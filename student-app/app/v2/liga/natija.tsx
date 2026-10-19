/**
 * v2 Liga — o'tgan hafta natijasi (dizayn: 40 · LeagueResult).
 *
 * Haftalik liga natijalari (o'rin, ko'tarilish, bonus coin) serverda
 * saqlanmaydi — ekran dizayn tartibida, lekin bo'sh (0) holatda.
 * Hafta oralig'i (masalan "5–11 oktabr") haqiqiy sanadan hisoblanadi.
 */
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { ArrowRightIcon, BoltFill, CloseIcon } from '@/components/v2/rewards/icons';
import { goBack, lastWeekLabel, TIERS } from '@/components/v2/rewards/parts';
import { R } from '@/constants/v2/routes';
import { designImages } from '@/constants/v2/designImages';
import { fonts } from '@/constants/v2/tokens';

// Liga tizimi serverda yo'q: hamma Bronza'da, natija 0.
const CURRENT = TIERS[0];
const NEXT = TIERS[1];

export default function V2LeagueResult() {
  const insets = useSafeAreaInsets();
  const week = lastWeekLabel();

  const share = () => {
    Share.share({ message: `Domwork · ${CURRENT.name} liga. Oʻtgan hafta (${week}) natijasi hali yoʻq.` }).catch(() => {});
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.column, { flex: 1 }]}>
          <View style={[styles.top, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
            <View style={styles.weekPill}><Text style={styles.weekText}>Oʻtgan hafta · {week}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={() => goBack(R.league)} style={styles.close}>
              <CloseIcon color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.body}>
            <View style={styles.glowWrap}>
              <Svg width={250} height={236} style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no">
                <Defs>
                  {/* CSS "circle at 50% 52%" — radius = eng uzoq burchakkacha (≈175px). */}
                  <RadialGradient id="g" cx="125" cy="122.72" r="175" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor="#FFF8E3" />
                    <Stop offset="0.38" stopColor="#FFF1C9" />
                    <Stop offset="0.58" stopColor="#FFC93C" stopOpacity={0.35} />
                    <Stop offset="0.71" stopColor="#FFC93C" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="250" height="236" fill="url(#g)" />
              </Svg>
              <Image source={designImages.e91544c14ad5b2b62bbbe447f02474b2} accessibilityLabel="Kubok koʻtargan Domik" style={{ width: 196, height: 206 }} resizeMode="contain" />
            </View>

            <View style={styles.chips} accessible accessibilityLabel={`${CURRENT.name} ligadan ${NEXT.name} ligaga`}>
              <View style={[styles.chip, { backgroundColor: '#2A2018' }]}><Text style={[styles.chipText, { color: '#E8C7A8' }]}>{CURRENT.name}</Text></View>
              <ArrowRightIcon />
              <View style={[styles.chip, { backgroundColor: '#E2E7F0' }]}><Text style={[styles.chipText, { color: '#0B1220' }]}>{NEXT.name}</Text></View>
            </View>
            <Text accessibilityRole="header" style={styles.h1}>Natija hali{'\n'}yoʻq</Text>
            <Text style={styles.lead}>
              Haftalik liga natijalari hali hisoblanmayapti. Haftani {CURRENT.name} ligada boshlaysiz — top 5 {NEXT.name} ligaga chiqadi.
            </Text>

            <View style={styles.stats}>
              <View style={styles.stat}><Text style={styles.statBig}>—</Text><Text style={styles.statSmall}>{CURRENT.name} liga</Text></View>
              <View style={styles.stat}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><BoltFill size={16} color="#A98BFF" /><Text style={styles.statBig}>0</Text></View>
                <Text style={styles.statSmall}>chaqmoq</Text>
              </View>
              <View style={styles.stat}><Text style={[styles.statBig, { color: '#FFC93C' }]}>+0</Text><Text style={styles.statSmall}>bonus coin</Text></View>
            </View>
          </View>

          <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 0) + 34 }]}>
            <Pressable accessibilityRole="link" onPress={() => router.replace(R.league as never)} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
              <Text style={styles.primaryText}>{CURRENT.name} ligaga qaytish</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={share} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}>
              <Text style={styles.secondaryText}>Natijani ulashish</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1220' },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  top: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekPill: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#1B2438', justifyContent: 'center' },
  weekText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#FFD66B' },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#1B2438', alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingTop: 6, paddingHorizontal: 24, alignItems: 'center', gap: 10 },
  glowWrap: { width: 250, height: 236, alignItems: 'center', justifyContent: 'center', borderRadius: 125, overflow: 'hidden' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { height: 30, paddingHorizontal: 12, borderRadius: 15, justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13 },
  h1: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 34, lineHeight: 36, letterSpacing: -0.68, color: '#FFFFFF', textAlign: 'center' },
  lead: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 15, lineHeight: 22, color: '#B8C1D6', maxWidth: 310, textAlign: 'center' },
  stats: { width: '100%', flexDirection: 'row', gap: 8, marginTop: 8 },
  stat: { flex: 1, backgroundColor: '#16203A', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  statBig: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 24, lineHeight: 30, color: '#FFFFFF' },
  statSmall: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#B8C1D6' },
  actions: { paddingTop: 16, paddingHorizontal: 20, gap: 8 },
  primary: { height: 56, borderRadius: 18, backgroundColor: '#FFC93C', alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 17, color: '#0B1220' },
  secondary: { height: 48, borderRadius: 16, borderWidth: 2, borderColor: '#26304A', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#FFFFFF' },
});
