import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { lessonActivities } from '@/data/mock';

const activityConfig = {
  video: { icon: 'play-circle' as const, color: theme.colors.blue, bg: theme.colors.blueLight, route: 'video' },
  speaking: { icon: 'mic' as const, color: theme.colors.pink, bg: theme.colors.pinkBg, route: 'speaking' },
  quiz: { icon: 'game-controller' as const, color: theme.colors.success, bg: theme.colors.successBg, route: 'quiz' },
};

export default function LessonScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const activities = lessonActivities[lessonId ?? '1'] ?? lessonActivities['1'];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={`Dars ${lessonId}`} showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Barcha bo'limlarni ketma-ket bajaring</Text>

        {activities.map((activity, index) => {
          const config = activityConfig[activity.type];
          const isLast = index === activities.length - 1;
          return (
            <View key={activity.id} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.dot, { backgroundColor: config.color }]}>
                  {activity.done ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : (
                    <Ionicons name={config.icon} size={14} color="#fff" />
                  )}
                </View>
                {!isLast && <View style={styles.line} />}
              </View>
              <Pressable
                style={{ flex: 1 }}
                disabled={activity.locked}
                onPress={() => router.push(`/homework/lesson/${lessonId}/${config.route}`)}>
                <Card style={[styles.activityCard, activity.locked && styles.locked]}>
                  <View style={styles.activityRow}>
                    <View style={[styles.activityIcon, { backgroundColor: config.bg }]}>
                      <Ionicons name={config.icon} size={24} color={config.color} />
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityTitle}>{activity.title}</Text>
                      <Text style={styles.activityDuration}>{activity.duration}</Text>
                    </View>
                    {activity.done ? (
                      <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
                    ) : activity.locked ? (
                      <Ionicons name="lock-closed" size={20} color={theme.colors.textLight} />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                    )}
                  </View>
                </Card>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginBottom: 20 },
  timelineItem: { flexDirection: 'row', gap: 14, marginBottom: 4 },
  timelineLeft: { alignItems: 'center', width: 28 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { flex: 1, width: 2, backgroundColor: theme.colors.border, marginVertical: 4 },
  activityCard: { marginBottom: 8 },
  locked: { opacity: 0.5 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  activityIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  activityInfo: { flex: 1 },
  activityTitle: { fontFamily: theme.fonts.semiBold, fontSize: 16, color: theme.colors.text },
  activityDuration: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
});
