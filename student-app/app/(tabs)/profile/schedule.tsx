import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { weeklySchedule } from '@/data/mock';

export default function ScheduleScreen() {
  const attended = weeklySchedule.filter((s) => s.attended === true).length;
  const total = weeklySchedule.filter((s) => s.attended !== null).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Jadval va davomat" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.summary}>
          <Text style={styles.summaryLabel}>Haftalik davomat</Text>
          <Text style={styles.summaryValue}>
            {attended}/{total} dars
          </Text>
          <View style={styles.rateBar}>
            <View style={[styles.rateFill, { width: `${(attended / total) * 100}%` }]} />
          </View>
        </Card>

        {weeklySchedule.map((item) => (
          <Card key={item.day} style={styles.dayCard}>
            <View style={styles.dayRow}>
              <View>
                <Text style={styles.dayName}>{item.day}</Text>
                <Text style={styles.dayTime}>{item.time}</Text>
              </View>
              <View style={styles.dayRight}>
                {item.attended === true && (
                  <View style={[styles.badge, styles.badgePresent]}>
                    <Ionicons name="checkmark" size={14} color={theme.colors.success} />
                    <Text style={styles.badgeTextPresent}>Keldi</Text>
                  </View>
                )}
                {item.attended === false && (
                  <View style={[styles.badge, styles.badgeAbsent]}>
                    <Ionicons name="close" size={14} color={theme.colors.danger} />
                    <Text style={styles.badgeTextAbsent}>Kelmadi</Text>
                  </View>
                )}
                {item.attended === null && (
                  <View style={[styles.badge, styles.badgeUpcoming]}>
                    <Text style={styles.badgeTextUpcoming}>Kutilmoqda</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.topic}>{item.topic}</Text>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, gap: 12 },
  summary: { marginBottom: 8 },
  summaryLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted },
  summaryValue: { fontFamily: theme.fonts.extraBold, fontSize: 28, color: theme.colors.text, marginVertical: 4 },
  rateBar: { height: 8, backgroundColor: theme.colors.border, borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  rateFill: { height: 8, backgroundColor: theme.colors.success, borderRadius: 4 },
  dayCard: {},
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayName: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  dayTime: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  dayRight: {},
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgePresent: { backgroundColor: theme.colors.successBg },
  badgeAbsent: { backgroundColor: theme.colors.dangerBg },
  badgeUpcoming: { backgroundColor: theme.colors.warningBg },
  badgeTextPresent: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.success },
  badgeTextAbsent: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.danger },
  badgeTextUpcoming: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.warning },
  topic: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginTop: 10 },
});
