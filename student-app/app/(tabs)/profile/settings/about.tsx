import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';

export default function AboutScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Biz haqimizda" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.logo}>📘</Text>
          <Text style={styles.title}>Myhomework.uz</Text>
          <Text style={styles.body}>
            Myhomework.uz — ingliz tilini interaktiv darslar, live-suhbatlar, o'yinlar va sun'iy intellekt
            yordamchisi orqali o'rganish uchun yaratilgan platforma. Maqsadimiz — har bir o'quvchi uchun
            til o'rganishni qiziqarli va samarali qilish.
          </Text>
          <Text style={styles.version}>Versiya 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 24,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  logo: { fontSize: 44, marginBottom: 12 },
  title: { fontFamily: theme.fonts.extraBold, fontSize: 20, color: theme.colors.text, marginBottom: 12 },
  body: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, lineHeight: 22, textAlign: 'center', marginBottom: 16 },
  version: { fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.textLight },
});
