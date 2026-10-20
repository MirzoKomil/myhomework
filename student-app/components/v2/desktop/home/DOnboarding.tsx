/**
 * Kompyuter: Onboarding — "Rus tili sizga nima uchun kerak?" (dizayn: D_Onboarding).
 * Menyusiz to'liq oyna: chapda ko'k panel (520px), o'ngda 4 ta maqsad.
 * Mantiq mobil ekran bilan bir xil: javob faqat qurilmada (GOAL_KEY),
 * 'mh_v2_onboarded' belgisi qo'yiladi va Bosh sahifaga o'tiladi.
 * Klaviatura: 1–4 — tanlash, Enter — davom etish, Esc — orqaga.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType, type TextStyle } from 'react-native';

import { Kbd } from '@/components/v2/desktop/Shell';
import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { GOAL_KEY, ONBOARDED_KEY } from '@/components/v2/home/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';
import { v2Back } from '@/services/v2Nav';

import { ArrowIcon, BackIcon, CheckIcon } from './icons';

type Goal = { key: string; title: string; sub: string; img: ImageSourcePropType };

// Mobil ekrandagi maqsadlar (kalitlari bir xil — saqlangan javob mos keladi).
const GOALS: Goal[] = [
  { key: 'work', title: 'Ish va safar', sub: 'Safar, ish joyi, hujjatlar', img: designImages['542e0ea22dfa5f9dd6265acfd73e3ca2'] },
  { key: 'daily', title: 'Kundalik muloqot', sub: 'Kafe, doʻkon, tanishuv', img: designImages.d9c9d8d26328b24384a9840cf989fb7b },
  { key: 'business', title: 'Savdo va biznes', sub: 'Bozor, narx, mijozlar', img: designImages['3280a48481f2201f4e7135fe1267b5eb'] },
  { key: 'services', title: 'Sogʻliq va xizmatlar', sub: 'Shifokor, bank, pochta', img: designImages['2ed4977b1c6c69d1bb27827f54a0ac54'] },
];

export function DOnboarding() {
  const { courseLang } = useLang();
  const [goal, setGoal] = useState('work');
  const [saving, setSaving] = useState(false);
  const ru = courseLang === 'russian';
  const langName = ru ? 'Rus tili' : 'Ingliz tili';

  useEffect(() => {
    AsyncStorage.getItem(GOAL_KEY)
      .then((v) => {
        if (v && GOALS.some((g) => g.key === v)) setGoal(v);
      })
      .catch(() => {});
  }, []);

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await AsyncStorage.multiSet([
        [GOAL_KEY, goal],
        [ONBOARDED_KEY, '1'],
      ]);
    } catch {
      // Saqlab bo'lmasa ham o'quvchini to'xtatmaymiz.
    }
    router.replace(R.home);
  };
  const back = () => v2Back(R.login);

  useDesktopKeys({
    '1': () => setGoal(GOALS[0].key),
    '2': () => setGoal(GOALS[1].key),
    '3': () => setGoal(GOALS[2].key),
    '4': () => setGoal(GOALS[3].key),
    Enter: () => void finish(),
    Escape: back,
  });

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={s.root}>
        <View style={s.panel}>
          <View style={s.circle1} />
          <View style={s.circle2} />
          <Pressable accessibilityRole="link" accessibilityLabel={ru ? 'Domwork' : 'Homework'} onPress={back} style={s.brand}>
            <View style={s.brandIcon}>
              <Image source={designImages.b924b8ccc546d63f781f9ea1bd9db221} style={{ width: 42, height: 44, marginTop: 4 }} resizeMode="contain" />
            </View>
            <View>
              <Text style={s.brandName}>{ru ? 'Domwork' : 'Homework'}</Text>
              <Text style={s.brandSub}>{langName} · onlayn maktab</Text>
            </View>
          </Pressable>
          <View style={s.panelMid}>
            <View style={s.stepRow}>
              <View style={s.stepBadge}>
                <Text style={s.stepBadgeText}>1 / 1</Text>
              </View>
              <Text style={s.stepText}>Bitta savol — keyin boshlaymiz</Text>
            </View>
            <View style={s.mascotWrap}>
              <Image source={designImages.cc0d95446730f059d25d989e2c9845ad} style={{ width: 380, height: 380 }} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
            </View>
          </View>
          <Text style={s.panelText}>Tanlovingizga qarab darslardagi misollar, dialoglar va lugʻat sizga yaqin mavzularda boʻladi.</Text>
        </View>

        <View style={s.main}>
          <View style={s.topRow}>
            <Pressable accessibilityRole="link" accessibilityLabel="Orqaga" onPress={back} style={s.back}>
              <BackIcon />
            </Pressable>
            <Text style={s.topText}>Bitta savol — keyin boshlaymiz</Text>
          </View>
          <View style={{ gap: 6 }}>
            <Text accessibilityRole="header" style={s.h1}>
              {langName} sizga nima uchun kerak?
            </Text>
            <Text style={s.sub}>Darslardagi misollarni shunga moslaymiz</Text>
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel="Maqsad" style={s.grid}>
            {GOALS.map((g, i) => {
              const on = goal === g.key;
              return (
                <Pressable
                  key={g.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${g.title}. ${g.sub}`}
                  onPress={() => setGoal(g.key)}
                  style={[s.card, on ? s.cardOn : s.cardOff]}
                >
                  <Image source={g.img} style={s.cardImg} resizeMode="cover" />
                  {on && (
                    <View style={s.check}>
                      <CheckIcon size={16} strokeWidth={3} />
                    </View>
                  )}
                  <View style={s.cardText}>
                    <View style={s.cardTitleRow}>
                      <Kbd>{String(i + 1)}</Kbd>
                      <Text style={s.cardTitle}>{g.title}</Text>
                    </View>
                    <Text style={s.cardSub}>{g.sub}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={s.footer}>
            <View style={s.hint}>
              <Kbd>1</Kbd>
              <Text style={s.hintText}>–</Text>
              <Kbd>4</Kbd>
              <Text style={s.hintText}>tanlash ·</Text>
              <Kbd>Enter</Kbd>
              <Text style={s.hintText}>davom etish</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityState={{ busy: saving }} onPress={finish} style={({ pressed }) => [s.cta, pressed && { backgroundColor: '#1E3FD1' }]}>
              <Text style={s.ctaText}>Davom etish</Text>
              <ArrowIcon size={20} color="#FFFFFF" strokeWidth={2.6} />
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const T = (f: string, size: number, extra?: TextStyle): TextStyle => ({ fontFamily: f, fontWeight: 'normal', fontSize: size, ...extra });

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  root: { flex: 1, minHeight: 860, flexDirection: 'row' },
  panel: { width: 520, backgroundColor: '#2F5BFF', overflow: 'hidden', paddingVertical: 36, paddingHorizontal: 48 },
  circle1: { position: 'absolute', right: -140, top: -120, width: 420, height: 420, borderRadius: 210, backgroundColor: '#3D67FF' },
  circle2: { position: 'absolute', left: -120, bottom: -160, width: 380, height: 380, borderRadius: 190, backgroundColor: '#2A52EB' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
  brandIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brandName: T(fonts.display, 23, { lineHeight: 24.15, letterSpacing: -0.46, color: '#FFFFFF' }),
  brandSub: T(fonts.bodyBold, 12, { color: '#FFFFFF' }),
  panelMid: { flex: 1, marginTop: 54, gap: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBadge: { height: 32, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  stepBadgeText: T(fonts.bodyHeavy, 14, { color: '#1E3FD1' }),
  stepText: T(fonts.bodyHeavy, 15, { color: '#FFFFFF' }),
  mascotWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  panelText: T(fonts.bodyBold, 17, { lineHeight: 25.5, color: '#FFFFFF' }),

  main: { flex: 1, minWidth: 0, paddingTop: 36, paddingHorizontal: 64, paddingBottom: 40, gap: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  back: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E8F0', alignItems: 'center', justifyContent: 'center' },
  topText: T(fonts.bodyHeavy, 15, { color: '#4A5468' }),
  h1: T(fonts.display, 38, { lineHeight: 41.8, letterSpacing: -0.76, color: '#0B1220' }),
  sub: T(fonts.body, 17, { color: '#4A5468' }),
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  card: { flexGrow: 1, flexBasis: '40%', minWidth: 0, borderRadius: 24, borderWidth: 3, overflow: 'hidden' },
  cardOn: { borderColor: '#2F5BFF', backgroundColor: '#E8EEFF' },
  cardOff: { borderColor: '#E4E8F0', backgroundColor: '#FFFFFF' },
  cardImg: { width: '100%', height: 196 },
  check: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2F5BFF',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { paddingTop: 14, paddingHorizontal: 18, paddingBottom: 16, gap: 2 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: T(fonts.bodyHeavy, 18, { color: '#0B1220' }),
  cardSub: T(fonts.body, 14, { color: '#4A5468' }),
  footer: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 14 },
  hint: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  hintText: T(fonts.bodyBold, 14, { color: '#4A5468' }),
  cta: { height: 58, paddingHorizontal: 34, borderRadius: 18, backgroundColor: '#2F5BFF', boxShadow: '0 5px 0 #1E3FD1', flexDirection: 'row', alignItems: 'center', gap: 10 },
  ctaText: T(fonts.bodyHeavy, 17, { color: '#FFFFFF' }),
});
