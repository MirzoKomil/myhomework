import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { courses, profileStats } from '@/data/mock';

export default function ResultsScreen() {
  const activeCourse = courses[0];

  const stats: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; bg: string; color: string }[] = [
    { icon: 'checkmark-circle', label: 'Davomat', value: `${profileStats.attendanceRate}%`, bg: theme.colors.successBg, color: theme.colors.success },
    { icon: 'book', label: "O'rganilgan lug'atlar", value: `${profileStats.vocabularyCount} ta`, bg: theme.colors.purpleLight, color: theme.colors.purple },
    { icon: 'document-text', label: "O'rganilgan grammatika", value: `${profileStats.grammarCount} ta`, bg: theme.colors.blueLight, color: theme.colors.blue },
    { icon: 'time', label: 'Ilovada sarflangan vaqt', value: `${profileStats.hoursSpent} soat`, bg: theme.colors.warningBg, color: theme.colors.warning },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Natijalarim" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.courseCard}>
          <View style={styles.courseTop}>
            <Text style={styles.courseTitle}>{activeCourse.title}</Text>
            <Text style={styles.coursePercent}>{activeCourse.progress}%</Text>
          </View>
          <Text style={styles.courseMeta}>
            {activeCourse.lessonsDone}/{activeCourse.lessonsTotal} dars tugallangan
          </Text>
          <ProgressBar progress={activeCourse.progress} />
        </View>

        <View style={styles.grid}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon} size={20} color={s.color} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 32 },
  courseCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 18,
    marginBottom: 16,
    ...theme.shadow.card,
  },
  courseTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  courseTitle: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  coursePercent: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.purple },
  courseMeta: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    ...theme.shadow.card,
  },
  statIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontFamily: theme.fonts.bold, fontSize: 18, color: theme.colors.text },
  statLabel: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
});
