import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';

const SECTIONS = [
  {
    title: "Ma'lumotlar to'planishi",
    body: "Biz sizning ismingiz, telefon raqamingiz va o'quv jarayoningiz haqidagi ma'lumotlarni faqat xizmat sifatini yaxshilash uchun to'playmiz.",
  },
  {
    title: "Ma'lumotlardan foydalanish",
    body: "Sizning ma'lumotlaringiz uchinchi shaxslarga sotilmaydi yoki ulashilmaydi, faqat o'quv jarayonini yaxshilash uchun ishlatiladi.",
  },
  {
    title: "Xavfsizlik",
    body: "Barcha ma'lumotlar shifrlangan holda saqlanadi va faqat vakolatli xodimlar tomonidan ko'rilishi mumkin.",
  },
];

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Maxfiylik siyosati" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.card}>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, gap: 12 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    marginBottom: 12,
    ...theme.shadow.card,
  },
  title: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text, marginBottom: 8 },
  body: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, lineHeight: 20 },
});
