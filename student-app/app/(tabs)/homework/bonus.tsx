import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';

const BONUS_LESSONS = [
  { id: 'b1', title: 'Bonus dars 1 — Kundalik suhbat', date: 'Yakshanba, 12.07', duration: '18 daq' },
  { id: 'b2', title: 'Bonus dars 2 — Grammatika mashqi', date: 'Yakshanba, 19.07', duration: '22 daq' },
  { id: 'b3', title: 'Bonus dars 3 — Talaffuz sirlari', date: 'Yakshanba, 26.07', duration: '15 daq' },
  { id: 'b4', title: 'Bonus dars 4 — Idiomalar', date: 'Yakshanba, 02.08', duration: '20 daq' },
];

export default function BonusLessonsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Bonus darslar" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Har yakshanba kuni beriladigan qo'shimcha video darslar to'plami</Text>
        {BONUS_LESSONS.map((lesson) => (
          <Pressable key={lesson.id} onPress={() => Alert.alert(lesson.title, "Video tez orada qo'shiladi")}>
            <Card style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons name="play-circle" size={26} color="#D97706" />
              </View>
              <View style={styles.info}>
                <Text style={styles.title}>{lesson.title}</Text>
                <Text style={styles.meta}>
                  {lesson.date} · {lesson.duration}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 32, gap: 12 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginBottom: 4, lineHeight: 19 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  title: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text },
  meta: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
});
