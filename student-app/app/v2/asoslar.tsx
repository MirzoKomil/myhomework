/**
 * v2 asoslari — yangi dizayn komponentlarining ko'rgazma sahifasi.
 * Manzil: /student/v2/asoslar. Faqat sinov uchun: haqiqiy ma'lumot ishlatmaydi, hech narsa saqlamaydi.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ArrowRightIcon,
  BoltIcon,
  Button,
  Card,
  ChatIcon,
  CheckIcon,
  Chip,
  CoinIcon,
  IconCircleButton,
  Input,
  ProgressBar,
  ProgressRing,
  SegmentedProgress,
  StatPill,
  V2Text,
  type TextVariant,
} from '@/components/v2';
import { colors, radius, space } from '@/constants/v2/tokens';

const swatches: { name: string; value: string; dark?: boolean }[] = [
  { name: 'Kobalt', value: colors.cobalt, dark: true },
  { name: 'Siyoh', value: colors.ink, dark: true },
  { name: 'Kungaboqar', value: colors.sunflower },
  { name: 'Fon', value: colors.bg },
  { name: 'Muvaffaqiyat', value: colors.success, dark: true },
  { name: 'Streak', value: colors.streak },
  { name: 'Coin', value: colors.coin },
  { name: 'Chaqmoq', value: colors.lightning, dark: true },
];

const typeSamples: { variant: TextVariant; label: string; text: string; cyrillic?: boolean }[] = [
  { variant: 'hero', label: 'hero · 32', text: 'Rus tilida 0 dan erkin suhbatgacha' },
  { variant: 'title', label: 'title · 30', text: 'Darslar' },
  { variant: 'heading', label: 'heading · 25', text: 'Kafeda buyurtma berish' },
  { variant: 'heading', label: 'heading · ruscha', text: 'Привет! Кофе, пожалуйста', cyrillic: true },
  { variant: 'subheading', label: 'subheading · 20', text: 'Samandar' },
  { variant: 'bodyStrong', label: 'bodyStrong · 16', text: 'Kunlik maqsad' },
  { variant: 'bodySmall', label: 'bodySmall · 14', text: '30 / 50 chaqmoq · yana 1 ta mashq' },
  { variant: 'overline', label: 'overline · 12', text: '10-dars · Video · hozirgi' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <V2Text variant="overline" color={colors.textSubtle} accessibilityRole="header">
        {title}
      </V2Text>
      {children}
    </View>
  );
}

export default function V2Foundation() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 44) + 24, paddingBottom: insets.bottom + 40 }]}
    >
      <View style={styles.column}>
        <View style={styles.intro}>
          <Chip label="Sinov · v2" tone="cobalt" />
          <V2Text variant="title" accessibilityRole="header">Dizayn asoslari</V2Text>
          <V2Text variant="bodySmall" color={colors.textMuted}>
            Yangi dizayn qurilayotgan bloklar. O'quvchilar hali eski ilovani ko'radi.
          </V2Text>
        </View>

        <Section title="Namuna: bosh sahifa boshi">
          <View style={styles.header}>
            <View style={styles.avatar}>
              <V2Text variant="subheading" color={colors.textOnDark}>S</V2Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <V2Text variant="caption" color={colors.textMuted}>Xayrli kun</V2Text>
              <V2Text variant="subheading" numberOfLines={1}>Samandar</V2Text>
            </View>
            <StatPill kind="streak" value={6} />
            <StatPill kind="coin" value={486} />
            <IconCircleButton accessibilityLabel="Xabarlar" badge={3}>
              <ChatIcon />
            </IconCircleButton>
          </View>

          <Card tone="cobalt" rounded="hero" padding={20} style={{ gap: 14 }}>
            <View style={styles.row}>
              <Chip label="Bugungi dars" tone="onCobalt" />
              <V2Text variant="caption" color={colors.cobaltSoft}>10-dars · 1-modul</V2Text>
            </View>
            <View style={{ gap: 6 }}>
              <V2Text variant="heading" color={colors.textOnDark} style={{ maxWidth: 230 }}>
                Kafeda buyurtma berish
              </V2Text>
              <V2Text variant="bodySmall" color={colors.cobaltSoft}>
                Video · 16 so'z · uyga vazifa · ~25 daq. qoldi
              </V2Text>
            </View>
            <Button label="Davom etish · 2 / 5" variant="inverse" trailing={<ArrowRightIcon />} />
          </Card>

          <Card style={{ gap: 12 }}>
            <View style={styles.row}>
              <ProgressRing value={0.6} accessibilityLabel="Kunlik maqsad: 30 dan 50 chaqmoq">
                <BoltIcon />
              </ProgressRing>
              <View style={{ flex: 1, gap: 2 }}>
                <V2Text variant="bodyStrong">Kunlik maqsad</V2Text>
                <V2Text variant="bodySmall" color={colors.textMuted}>30 / 50 chaqmoq · yana 1 ta mashq</V2Text>
              </View>
            </View>
          </Card>
        </Section>

        <Section title="Ranglar">
          <View style={styles.swatches}>
            {swatches.map((s) => (
              <View key={s.name} style={styles.swatch}>
                <View style={[styles.swatchColor, { backgroundColor: s.value }]} />
                <V2Text variant="caption">{s.name}</V2Text>
                <V2Text variant="caption" color={colors.textSubtle}>{s.value}</V2Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Matn">
          <Card style={{ gap: 14 }}>
            {typeSamples.map((t) => (
              <View key={t.label} style={{ gap: 2 }}>
                <V2Text variant="caption" color={colors.textSubtle}>{t.label}</V2Text>
                <V2Text variant={t.variant} cyrillic={t.cyrillic}>{t.text}</V2Text>
              </View>
            ))}
          </Card>
        </Section>

        <Section title="Tugmalar">
          <View style={{ gap: 10 }}>
            <Button label="Kirish" />
            <Button label="Davom etish" variant="secondary" />
            <View style={styles.row}>
              <Button label="Davom etish" size="md" style={{ flex: 1 }} />
              <Button label="Vazifa 20/60" size="md" variant="coin" leading={<CoinIcon size={16} />} />
            </View>
            <Button label="Yuborilmoqda" loading />
            <Button label="Mavjud emas" disabled />
          </View>
        </Section>

        <Section title="Belgilar">
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            <Chip label="Hozirgi" tone="cobalt" />
            <Chip label="Tugadi" tone="success" />
            <Chip label="Jonli dars" tone="danger" />
            <Chip label="Yopiq" tone="neutral" />
            <Chip label="+60 coin" tone="coin" />
          </View>
        </Section>

        <Section title="Progress">
          <Card tone="ink" style={{ gap: 8 }}>
            <V2Text variant="bodyStrong" color={colors.textOnDark}>1-modul · Tanishuv</V2Text>
            <ProgressBar value={0.75} color={colors.successBright} trackColor={colors.inkRaised} accessibilityLabel="1-modul: 9 / 12 dars" />
            <V2Text variant="caption" color={colors.textOnDarkMuted}>9 / 12 dars · oxirida imtihon va sertifikat</V2Text>
          </Card>
          <Card style={{ gap: 10 }}>
            <V2Text variant="overline" color={colors.cobalt}>Dars bosqichlari</V2Text>
            <SegmentedProgress total={5} done={2} accessibilityLabel="Dars bosqichlari: 5 dan 2" />
          </Card>
          <View style={[styles.row, { gap: 10 }]}>
            {[true, true, true, false].map((done, i) => (
              <View key={i} style={[styles.dayDot, done ? { backgroundColor: colors.streak } : styles.dayToday]}>
                {done ? <CheckIcon /> : <V2Text variant="bodySmall" color={colors.streakText}>7</V2Text>}
              </View>
            ))}
          </View>
        </Section>

        <Section title="Kiritish maydonlari">
          <Card style={{ gap: 14 }}>
            <Input label="Login" placeholder="Masalan: AA424" autoCapitalize="characters" />
            <Input label="Parol" placeholder="Parolingiz" secure />
            <Input label="Telefon" placeholder="+998" error="Raqam to'liq emas" keyboardType="phone-pad" />
          </Card>
        </Section>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 28 },
  intro: { gap: 8 },
  section: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 100, gap: 2 },
  swatchColor: { height: 56, borderRadius: radius.md, borderWidth: 1, borderColor: colors.divider, marginBottom: 4 },
  dayDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayToday: { backgroundColor: colors.surface, borderWidth: 2.5, borderColor: colors.streak },
});
