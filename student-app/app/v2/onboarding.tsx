/**
 * v2 Onboarding — "Rus tili sizga nima uchun kerak?" (dizayn: Onboarding.dc.html).
 *
 * Serverda bunday maydon yo'q, shuning uchun javob faqat qurilmada
 * (AsyncStorage) saqlanadi va onboarding qayta ko'rsatilmasligi uchun
 * 'mh_v2_onboarded' belgisi qo'yiladi.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArrowRight, BackIcon, CheckIcon } from '@/components/v2/home/icons';
import { GOAL_KEY, ONBOARDED_KEY } from '@/components/v2/home/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';

type Goal = { key: string; title: string; sub: string; img: ImageSourcePropType; posX: number };

const GOALS: Goal[] = [
  { key: 'work', title: 'Ish va safar', sub: 'Safar, ish joyi, hujjatlar', img: designImages['542e0ea22dfa5f9dd6265acfd73e3ca2'], posX: 0.5 },
  { key: 'daily', title: 'Kundalik muloqot', sub: 'Kafe, doʻkon, tanishuv', img: designImages.d9c9d8d26328b24384a9840cf989fb7b, posX: 0 },
  { key: 'business', title: 'Savdo va biznes', sub: 'Bozor, narx, mijozlar', img: designImages['3280a48481f2201f4e7135fe1267b5eb'], posX: 0.4 },
  { key: 'services', title: 'Sogʻliq va xizmatlar', sub: 'Shifokor, bank, pochta', img: designImages['2ed4977b1c6c69d1bb27827f54a0ac54'], posX: 0 },
];

const IMG_H = 174;

/** CSS `background: url() X% 50% / 135% auto` ning RN ko'rinishi. */
function CoverImage({ source, posX }: { source: ImageSourcePropType; posX: number }) {
  const [w, setW] = useState(0);
  const size = w * 1.35;
  return (
    <View style={styles.imgBox} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Image
          source={source}
          style={{ position: 'absolute', width: size, height: size, left: (w - size) * posX, top: (IMG_H - size) / 2 }}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      )}
    </View>
  );
}

export default function V2Onboarding() {
  const insets = useSafeAreaInsets();
  const { courseLang } = useLang();
  const [goal, setGoal] = useState('work');
  const [saving, setSaving] = useState(false);

  // Avval tanlangan javob bo'lsa (masalan sozlamalardan qaytilganda) — o'shani ko'rsatamiz.
  useEffect(() => {
    AsyncStorage.getItem(GOAL_KEY)
      .then((v) => { if (v && GOALS.some((g) => g.key === v)) setGoal(v); })
      .catch(() => {});
  }, []);

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await AsyncStorage.multiSet([[GOAL_KEY, goal], [ONBOARDED_KEY, '1']]);
    } catch {
      // Saqlab bo'lmasa ham o'quvchini to'xtatmaymiz.
    }
    router.replace(R.home);
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace(R.login));
  const langName = courseLang === 'russian' ? 'Rus tili' : 'Ingliz tili';

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.column, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
          <View style={styles.topRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Orqaga" onPress={back} style={styles.back}>
              <BackIcon />
            </Pressable>
            <Text style={styles.topText}>Bitta savol — keyin boshlaymiz</Text>
          </View>

          <View style={styles.head}>
            <Text style={styles.h1} accessibilityRole="header">{langName} sizga nima uchun kerak?</Text>
            <Text style={styles.sub}>Darslardagi misollarni shunga moslaymiz</Text>
          </View>

          <View accessibilityRole="radiogroup" accessibilityLabel="Maqsad" style={styles.grid}>
            {GOALS.map((g) => {
              const on = goal === g.key;
              return (
                <Pressable
                  key={g.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${g.title}. ${g.sub}`}
                  onPress={() => setGoal(g.key)}
                  style={[styles.card, on ? styles.cardOn : styles.cardOff]}
                >
                  <CoverImage source={g.img} posX={g.posX} />
                  {on && (
                    <View style={styles.check}>
                      <CheckIcon size={14} strokeWidth={3.4} />
                    </View>
                  )}
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{g.title}</Text>
                    <Text style={styles.cardSub}>{g.sub}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.bottom, { paddingBottom: Math.max(34, insets.bottom + 14) }]}>
            <Pressable
              accessibilityRole="button"
              onPress={finish}
              style={({ pressed }) => [styles.cta, pressed && { backgroundColor: '#1E3FD1' }]}
            >
              <Text style={styles.ctaText}>Davom etish</Text>
              <ArrowRight />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  topRow: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center' },
  topText: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#4A5468', fontWeight: 'normal' },
  head: { paddingTop: 24, paddingHorizontal: 20, gap: 6 },
  h1: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30.8, letterSpacing: -0.56, color: '#0B1220', fontWeight: 'normal' },
  sub: { fontFamily: fonts.body, fontSize: 15, color: '#4A5468', fontWeight: 'normal' },
  grid: { paddingTop: 18, paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '47.5%', flexGrow: 1, flexBasis: '40%', borderRadius: 22, borderWidth: 2.5, overflow: 'hidden', position: 'relative' },
  cardOn: { borderColor: '#2F5BFF', backgroundColor: '#E8EEFF' },
  cardOff: { borderColor: '#E4E8F0', backgroundColor: '#FFFFFF' },
  imgBox: { width: '100%', height: IMG_H, overflow: 'hidden' },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2F5BFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12, gap: 2 },
  cardTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, lineHeight: 18.75, color: '#0B1220', fontWeight: 'normal' },
  cardSub: { fontFamily: fonts.body, fontSize: 12, color: '#4A5468', fontWeight: 'normal' },
  bottom: { marginTop: 'auto', paddingTop: 14, paddingHorizontal: 20, gap: 6 },
  cta: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ctaText: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: '#FFFFFF', fontWeight: 'normal' },
});
