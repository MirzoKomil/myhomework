/**
 * v2 Maxfiylik siyosati (dizayn: 59 · Privacy).
 *
 * Eski `settings/privacy.tsx` o'rnini bosadi. Siyosat matni statik —
 * dizayndagi yangilangan matn aynan ishlatilgan.
 */
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Column, ScreenHeader, SUPPORT_TELEGRAM_URL, TelegramButton } from '@/components/v2/settings/parts';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';

const SECTIONS = [
  {
    title: 'Qanday maʼlumot yigʻamiz',
    body: 'Ism, familiya, telefon raqam, login, dars natijalari, vazifa javoblari, coin va chaqmoqlar hamda qurilma turi.',
  },
  {
    title: 'Nima uchun',
    body: 'Darslarni ochish, vazifalarni avtomatik tekshirish, eslatma yuborish va toʻlovlarni hisoblash uchun.',
  },
  {
    title: 'Kim koʻradi',
    body: 'Faqat siz, ustozlaringiz va Domwork menejeri. Reytingda boshqalar faqat ismingiz, avataringiz va chaqmoqlaringizni koʻradi.',
  },
  {
    title: 'Saqlash muddati',
    body: 'Kurs tugaganidan keyin 12 oy saqlanadi, soʻng oʻchiriladi. Istalgan vaqtda oʻchirishni soʻrashingiz mumkin.',
  },
  {
    title: 'Bogʻlanish',
    body: 'Savol yoki oʻchirish soʻrovi uchun Domwork supportga Telegramda yozing.',
  },
];

export default function V2Privacy() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Column style={styles.fill}>
          <ScreenHeader title="Maxfiylik siyosati" subtitle="Yangilangan: 01.09.2026" fallback={R.settings} />
          <View style={styles.body}>
            <View style={styles.card}>
              {SECTIONS.map((s) => (
                <View key={s.title} style={styles.section}>
                  <Text
                    accessibilityRole="header"
                    {...(Platform.OS === 'web' ? ({ 'aria-level': 2 } as object) : null)}
                    style={styles.h2}
                  >
                    {s.title}
                  </Text>
                  <Text style={styles.p}>{s.body}</Text>
                </View>
              ))}
            </View>
            <View style={styles.fill} />
            <TelegramButton label="Supportga yozish" url={SUPPORT_TELEGRAM_URL} height={52} radius={18} fontSize={16} />
          </View>
        </Column>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  scroll: { flexGrow: 1 },
  fill: { flex: 1 },
  body: { flex: 1, paddingTop: 14, paddingHorizontal: 20, gap: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 14 },
  section: { gap: 4 },
  h2: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 18, lineHeight: 23, letterSpacing: -0.18, color: '#0B1220' },
  p: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 14, lineHeight: 21, color: '#4A5468' },
});
