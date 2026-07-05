import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';

const FAQ_ITEMS = [
  {
    q: "Qanday o'quv materiallarini olaman?",
    a: "Myhomework.uz talabasi sifatida siz dars materiallarini bepul yuklab olishingiz va xohlagan vaqtda foydalanishingiz mumkin. Har bir darsdan so'ng ko'nikmalaringizni mashq qildiradigan testlar mavjud.",
  },
  {
    q: 'Darsni o\'tkazib yuborsam nima bo\'ladi?',
    a: "Jadval bo'limida barcha darslaringiz va yozib olingan darslar ro'yxatini ko'rishingiz mumkin. Live darsni o'tkazib yuborsangiz, keyinroq yozuvini tomosha qilishingiz mumkin.",
  },
  {
    q: "To'lovni qanday amalga oshiraman?",
    a: "Profil bo'limidagi \"To'lov tarixi va tarif\" orqali joriy tarifingizni va to'lovlar tarixini ko'rishingiz, hamda yangi to'lov qilishingiz mumkin.",
  },
  {
    q: 'Coinlarni qanday to\'playman?',
    a: "Darslarni yakunlab, o'yinlarda g'alaba qozonib va kunlik faollik orqali coin to'plashingiz mumkin. To'plangan coinlar Leaderboard reytingingizga ta'sir qiladi.",
  },
];

export default function FaqScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="FAQ" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {FAQ_ITEMS.map((item, i) => {
          const open = openIndex === i;
          return (
            <View key={item.q} style={styles.card}>
              <Pressable style={styles.questionRow} onPress={() => setOpenIndex(open ? null : i)}>
                <Text style={styles.question}>{item.q}</Text>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.purple} />
              </Pressable>
              {open && <Text style={styles.answer}>{item.a}</Text>}
            </View>
          );
        })}
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
  questionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  question: { flex: 1, fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.text },
  answer: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, lineHeight: 20, marginTop: 10 },
});
