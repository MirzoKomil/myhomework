/**
 * v2 Streak (dizayn: 48 · StreakSaved) + "Seriya uzildi" namuna oynasi
 * (80 · StreakLost, ?popup=lost — FAQ'dan ochiladi).
 *
 * Streak (ketma-ket kunlar) va streak himoyasi serverda kuzatilmaydi —
 * ekran dizayn tartibida, lekin 0 holatda: seriya 0 kun, oxirgi 7 kunda
 * belgilangan kun yo'q, himoya ishlatilmagan, faol himoya yo'q. Hafta
 * kunlari haqiqiy sanadan. "Darsni davom ettirish · 2 / 5" — bosh
 * sahifadagi bilan bir xil joriy dars va uning qadamlari.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveCurrentLesson, type CurrentLesson } from '@/components/v2/home/currentLesson';
import { StreakLostPopup } from '@/components/v2/popups/StreakLost';
import { ChevronRightIcon, ClockIcon, CloseIcon, ShieldIcon } from '@/components/v2/rewards/icons';
import { goBack } from '@/components/v2/rewards/parts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';

const SHORT = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
// Streak kuzatilmaydi — haqiqiy qiymat yo'q.
const STREAK_DAYS = 0;
const SHIELD_PRICE = 150;

export default function V2Streak() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ popup?: string }>();
  const [lost, setLost] = useState(false);
  const [lesson, setLesson] = useState<CurrentLesson | null>(null);

  useEffect(() => {
    if (params.popup === 'lost') setLost(true);
  }, [params.popup]);

  useEffect(() => {
    resolveCurrentLesson().then(setLesson).catch(() => {});
  }, []);

  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d;
  });
  const total = lesson?.steps.length ?? 0;
  const done = lesson?.steps.filter((s) => s.percent >= 100).length ?? 0;
  const current = Math.min(done + 1, total);

  return (
    <View style={styles.screen}>
      <Image source={designImages.ab2ec768d6bbc330d4b36a0481eb37cf} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} resizeMode="cover" accessibilityElementsHidden importantForAccessibility="no" />
      <Pressable style={{ flex: 1 }} accessibilityLabel="Yopish" onPress={() => goBack(R.home)} />
      <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 30 }]}>
        <View style={styles.column}>
          <View style={styles.handle} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: -10 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={() => goBack(R.home)} style={styles.close}>
              <CloseIcon />
            </Pressable>
          </View>
          <View style={styles.head}>
            <Image source={designImages.f1f2b5015be3aab0bfaac974e1e01af0} accessibilityLabel="Qalqon ushlagan Domik" style={{ width: 112, height: 111 }} resizeMode="contain" />
            <Text accessibilityRole="header" style={styles.title}>
              Seriya: <Text style={{ color: '#B54700' }}>{STREAK_DAYS} kun</Text>
            </Text>
            <Text style={styles.desc}>
              Bugun darsni tugatsangiz — <Text style={{ fontFamily: fonts.bodyHeavy, color: '#0B1220' }}>{STREAK_DAYS + 1} kun</Text>.
            </Text>
          </View>

          <View style={styles.week}>
            {days.map((d, i) => {
              const isToday = i === 6;
              return (
                <View key={i} style={{ alignItems: 'center', gap: 5 }}>
                  {isToday ? (
                    <View style={[styles.circle, styles.today]}><Text style={styles.todayNum}>{STREAK_DAYS + 1}</Text></View>
                  ) : (
                    <View style={[styles.circle, styles.empty]} />
                  )}
                  <Text style={[styles.dayText, isToday && { fontFamily: fonts.bodyHeavy, color: '#0B1220' }]}>{isToday ? 'Bugun' : SHORT[d.getDay()]}</Text>
                </View>
              );
            })}
          </View>

          {/* Himoya ishlatilgan kun — streak kuzatilmagani uchun sana yo'q (—). */}
          <View style={styles.used}>
            <ClockIcon />
            <Text style={styles.usedText}>
              <Text style={{ fontFamily: fonts.bodyHeavy, color: '#0B1220' }}>—</Text> · himoya hali ishlatilmagan
            </Text>
          </View>

          <Pressable accessibilityRole="link" onPress={() => router.push(R.shop as never)} style={({ pressed }) => [styles.link, pressed && { opacity: 0.8 }]}>
            <ShieldIcon size={20} color="#6B7489" strokeWidth={2} />
            <View style={{ flex: 1, gap: 2, paddingVertical: 8 }}>
              <Text style={styles.linkTitle}>Faol himoya yoʻq</Text>
              <Text style={styles.linkSub}>
                Doʻkonda <Text style={{ fontFamily: fonts.bodyHeavy, color: '#0B1220' }}>{SHIELD_PRICE} coin</Text>
              </Text>
            </View>
            <ChevronRightIcon size={18} color="#6B7489" strokeWidth={2.2} />
          </Pressable>

          <Pressable
            accessibilityRole="link"
            onPress={() => router.push((lesson ? R.lesson(lesson.id) : R.path) as never)}
            style={({ pressed }) => [styles.cta, pressed && { backgroundColor: '#1E3FD1' }]}
          >
            <Text style={styles.ctaText}>{total ? `Darsni davom ettirish · ${current} / ${total}` : 'Darsni davom ettirish'}</Text>
          </Pressable>
        </View>
      </View>
      <StreakLostPopup
        visible={lost}
        onClose={() => {
          setLost(false);
          // Dizaynda "Yopish" FAQ'ga qaytaradi — oyna FAQ'dan ochilgan.
          goBack(R.faq);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1220' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12, paddingHorizontal: 20, boxShadow: '0 -12px 40px rgba(0,0,0,.25)' },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 14 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#D5DAE4', alignSelf: 'center' },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center' },
  head: { alignItems: 'center', gap: 6, marginTop: -30 },
  title: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 26, lineHeight: 29, letterSpacing: -0.52, color: '#0B1220', textAlign: 'center' },
  desc: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 15, lineHeight: 22, color: '#4A5468', textAlign: 'center' },
  week: { backgroundColor: '#F4F6FA', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between' },
  circle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  empty: { borderWidth: 2, borderColor: '#E4E8F0' },
  today: { borderWidth: 2.5, borderColor: '#FF7A1A' },
  todayNum: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#B54700' },
  dayText: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 14.4, color: '#4A5468', textAlign: 'center' },
  used: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  usedText: { flex: 1, fontFamily: fonts.body, fontWeight: 'normal', fontSize: 14, color: '#4A5468' },
  link: { minHeight: 56, borderRadius: 16, borderWidth: 1.5, borderColor: '#E4E8F0', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, color: '#0B1220' },
  linkSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, color: '#4A5468' },
  cta: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, color: '#FFFFFF' },
});
