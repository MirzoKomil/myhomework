import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { grades } from '@/data/mock';

export default function GradesScreen() {
  const average = Math.round(grades.reduce((sum, g) => sum + g.score, 0) / grades.length);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Baholar" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.averageCard}>
          <Text style={styles.averageLabel}>O'rtacha ball</Text>
          <Text style={styles.averageValue}>{average}</Text>
          <Text style={styles.averageMax}>/ 100</Text>
        </Card>

        {grades.map((grade) => (
          <Card key={grade.subject} style={styles.gradeCard}>
            <View style={styles.gradeRow}>
              <Text style={styles.subject}>{grade.subject}</Text>
              <Text style={styles.score}>
                {grade.score}
                <Text style={styles.max}> / {grade.max}</Text>
              </Text>
            </View>
            <ProgressBar progress={(grade.score / grade.max) * 100} />
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, gap: 12 },
  averageCard: { alignItems: 'center', marginBottom: 8 },
  averageLabel: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted },
  averageValue: { fontFamily: theme.fonts.extraBold, fontSize: 48, color: theme.colors.purple, marginTop: 4 },
  averageMax: { fontFamily: theme.fonts.regular, fontSize: 16, color: theme.colors.textMuted },
  gradeCard: {},
  gradeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  subject: { fontFamily: theme.fonts.semiBold, fontSize: 16, color: theme.colors.text },
  score: { fontFamily: theme.fonts.bold, fontSize: 18, color: theme.colors.purple },
  max: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted },
});
