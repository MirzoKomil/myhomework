/**
 * v2 Maxfiylik siyosati (dizayn: 59 · Privacy).
 *
 * Eski `settings/privacy.tsx` o'rnini bosadi. Siyosat matni statik —
 * dizayndagi yangilangan matn aynan ishlatilgan.
 */
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloseIcon } from '@/components/v2/settings/icons';
import { Column, ScreenHeader, SUPPORT_TELEGRAM_URL, TelegramButton } from '@/components/v2/settings/parts';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { DPrivacy } from '@/components/v2/desktop/profile/DPrivacy';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';

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
    body: 'Faqat siz, ustozlaringiz va Domwork menejeri. Reytingda boshqalar faqat ismingiz, avataringiz, chaqmoqlaringiz, dars soni va seriyangizni koʻradi.',
  },
  {
    title: 'Saqlash muddati',
    body: 'Kurs tugaganidan keyin 12 oy saqlanadi, soʻng oʻchiriladi. Oʻchirishni istalgan vaqtda supportdan soʻrashingiz mumkin.',
  },
];

// "Nimani saqlamaymiz" kartasi (dizayndagi qizil × belgili ro'yxat).
const NOT_STORED = [
  'Bank karta maʼlumotlari (toʻlov Click / Payme orqali)',
  'Ovoz yozuvlari — mikrofon ishlatilmaydi',
  'Kontaktlar va galereya (faqat siz tanlagan avatar)',
];

export default function V2Privacy() {
  return useIsDesktop() ? <DPrivacy /> : <V2PrivacyMobile />;
}

function V2PrivacyMobile() {
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
            <View style={styles.card2}>
              <Text
                accessibilityRole="header"
                {...(Platform.OS === 'web' ? ({ 'aria-level': 2 } as object) : null)}
                style={styles.h2}
              >
                Nimani saqlamaymiz
              </Text>
              <View accessibilityRole="list" style={styles.list}>
                {NOT_STORED.map((t) => (
                  <View key={t} style={styles.li}>
                    <View style={{ marginTop: 2 }}>
                      <CloseIcon size={16} color="#B42318" strokeWidth={2.4} />
                    </View>
                    <Text style={styles.liText}>{t}</Text>
                  </View>
                ))}
              </View>
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
  h2: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 18, lineHeight: 22, letterSpacing: -0.18, color: '#0B1220' },
  card2: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 18, gap: 8 },
  list: { gap: 6 },
  li: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  liText: { flex: 1, fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18.2, color: '#4A5468' },
  p: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 14, lineHeight: 21, color: '#4A5468' },
});
