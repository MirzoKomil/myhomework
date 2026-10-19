/**
 * "Seriya uzildi" (dizayn: 80 · Popup · seriya uzildi).
 *
 * FAQ'dagi "seriya uzilsa nima bo'ladi?" havolasidan ochiladigan
 * NAMUNA oyna (dizayndagi "Namuna: dars qoldirilganda" belgisi bilan):
 * streak serverda kuzatilmaydi, shuning uchun raqamlar (6 kun → 0)
 * o'quvchining emas — dizayndagi tushuntirish misoli. Host: /v2/streak?popup=lost.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { loadCurrentLesson } from '@/components/v2/practice/shared';
import { CloseIcon, DropArrowIcon, ShieldIcon, TICK2, TickIcon } from '@/components/v2/rewards/icons';
import { BottomSheet, SheetTop, sheetText } from '@/components/v2/rewards/sheet';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';

// Namuna qiymatlari (dizayndagi misol) — o'quvchi ma'lumoti emas.
const SAMPLE_STREAK = 6;
const SHIELD_PRICE = 150;

type Props = { visible: boolean; onClose: () => void };

export function StreakLostPopup({ visible, onClose }: Props) {
  const [lessonId, setLessonId] = useState<string | null>(null);
  useEffect(() => {
    if (!visible) return;
    loadCurrentLesson()
      .then((l) => setLessonId(l?.id ?? null))
      .catch(() => {});
  }, [visible]);

  const go = (href: string) => {
    onClose();
    router.push(href as never);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} paddingBottom={34} labelledBy="Seriya uzildi">
      <SheetTop sample="Namuna: dars qoldirilganda" onClose={onClose} />
      <View style={styles.head}>
        <Image source={designImages['78f533d49645c292f499fbc1b6168dd2']} accessibilityLabel="Uxlab qolgan Domik" style={{ width: 128, height: 128 }} resizeMode="contain" />
        <Text accessibilityRole="header" style={[sheetText.title, { lineHeight: 28.6 }]}>Seriya uzildi</Text>
        <View accessible accessibilityLabel={`Seriya ${SAMPLE_STREAK} kundan 0 ga tushdi`} style={styles.drop}>
          <Text style={[styles.big, styles.struck]}>{SAMPLE_STREAK}</Text>
          <DropArrowIcon />
          <Text style={styles.big}>0</Text>
          <Text style={styles.kun}>kun</Text>
        </View>
        <Text style={sheetText.body}>
          Kecha birorta ham dars yoki mashq boʻlmadi. <Text style={{ fontFamily: fonts.bodyHeavy, color: '#0B1220' }}>Streak himoyangiz yoʻq edi</Text>, shuning uchun seriya qaytadan boshlanadi.
        </Text>
      </View>

      <View accessible accessibilityLabel={`Oldingi seriya: ${SAMPLE_STREAK} kun`} style={styles.week}>
        {Array.from({ length: SAMPLE_STREAK }, (_, i) => (
          <View key={i} style={styles.day}>
            <View style={[styles.circle, { backgroundColor: '#FFD9BF' }]}><TickIcon size={15} color="#B54700" strokeWidth={3} d={TICK2} /></View>
            <Text style={styles.dayText}>{i + 1}</Text>
          </View>
        ))}
        <View style={styles.day}>
          <View style={[styles.circle, styles.missed]}><CloseIcon size={14} color="#B42318" strokeWidth={3} /></View>
          <Text style={[styles.dayText, { fontFamily: fonts.bodyHeavy, color: '#B42318' }]}>{SAMPLE_STREAK + 1}-kun</Text>
        </View>
      </View>

      <Pressable accessibilityRole="link" onPress={() => go(lessonId ? R.lesson(lessonId) : R.path)} style={({ pressed }) => [styles.cta, pressed && { backgroundColor: '#1E3FD1' }]}>
        <Text style={styles.ctaText}>Yangi seriyani boshlash</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => go(R.shop)} style={({ pressed }) => [styles.shop, pressed && { opacity: 0.8 }]}>
        <ShieldIcon size={18} color="#2F5BFF" strokeWidth={2} />
        <Text style={styles.shopText}>Himoya olish · {SHIELD_PRICE} coin</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 8 },
  drop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  big: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 34, lineHeight: 40, color: '#0B1220' },
  // Dizayn: line-through qalinligi 3px (web'da textDecorationThickness).
  struck: { color: '#B54700', textDecorationLine: 'line-through', ...(Platform.OS === 'web' ? ({ textDecorationThickness: 3 } as object) : null) },
  kun: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 15, color: '#4A5468' },
  week: { backgroundColor: '#F4F6FA', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 5 },
  circle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  missed: { borderWidth: 2.5, borderColor: '#B42318', borderStyle: 'dashed' },
  dayText: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468' },
  cta: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 0 #1E3FD1' },
  ctaText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, color: '#FFFFFF' },
  shop: { height: 55, borderRadius: 16, borderWidth: 1.5, borderColor: '#E4E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shopText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#0B1220' },
});
