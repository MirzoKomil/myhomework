import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { courses } from '@/data/mock';

export default function ActiveLessonsScreen() {
  const active = courses.filter((c) => c.progress > 0 || c.lessonsDone > 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Faol mashg'ulotlar" showBack />
      <View style={styles.list}>
        {active.length === 0 ? (
          <Text style={styles.empty}>Hozircha faol mashg'ulot yo'q</Text>
        ) : (
          active.map((c) => (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.level}>{c.level}</Text>
                <Text style={styles.percent}>{c.progress}%</Text>
              </View>
              <Text style={styles.title}>{c.title}</Text>
              <Text style={styles.meta}>
                {c.lessonsDone}/{c.lessonsTotal} dars tugallangan
              </Text>
              <ProgressBar progress={c.progress} />
            </View>
          ))
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  list: { padding: 20, gap: 12 },
  empty: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    marginBottom: 12,
    ...theme.shadow.card,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  level: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.blue, backgroundColor: theme.colors.blueLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  percent: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.purple },
  title: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text, marginBottom: 2 },
  meta: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginBottom: 8 },
});
