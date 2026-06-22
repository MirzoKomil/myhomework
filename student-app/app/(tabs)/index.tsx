import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { theme } from '@/constants/theme';
import { courses, profileStats } from '@/data/mock';

export default function HomeScreen() {
  const activeCourse = courses[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Salom,</Text>
            <Text style={styles.name}>{profileStats.name.split(' ')[0]} 👋</Text>
          </View>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={theme.colors.purple} />
          </View>
        </View>

        <LinearGradient
          colors={['#9B7BFF', '#6B4FE0', '#5B6CF8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <Text style={styles.heroLabel}>Bugungi maqsad</Text>
          <Text style={styles.heroTitle}>2 ta vazifani yakunlang</Text>
          <ProgressBar progress={55} color="#fff" height={8} />
          <Text style={styles.heroProgress}>55% bajarildi</Text>
        </LinearGradient>

        <Text style={styles.sectionTitle}>Tezkor kirish</Text>
        <View style={styles.quickGrid}>
          {[
            { icon: 'school' as const, label: 'Uy vazifasi', route: '/homework' },
            { icon: 'library' as const, label: 'Resurslar', route: '/resources' },
            { icon: 'sparkles' as const, label: 'AI yordam', route: '/ai' },
            { icon: 'calendar' as const, label: 'Jadval', route: '/profile/schedule' },
          ].map((item) => (
            <Pressable key={item.label} style={styles.quickItem} onPress={() => router.push(item.route as never)}>
              <View style={styles.quickIcon}>
                <Ionicons name={item.icon} size={22} color={theme.colors.purple} />
              </View>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Faol kurs</Text>
        <Card>
          <View style={styles.courseRow}>
            <View style={styles.courseBadge}>
              <Text style={styles.courseBadgeText}>{activeCourse.level}</Text>
            </View>
            <Text style={styles.courseProgress}>{activeCourse.progress}%</Text>
          </View>
          <Text style={styles.courseTitle}>{activeCourse.title}</Text>
          <Text style={styles.courseMeta}>
            {activeCourse.lessonsDone}/{activeCourse.lessonsTotal} dars tugallangan
          </Text>
          <ProgressBar progress={activeCourse.progress} />
          <Pressable style={styles.continueBtn} onPress={() => router.push('/homework')}>
            <Text style={styles.continueText}>Davom etish</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted },
  name: { fontFamily: theme.fonts.extraBold, fontSize: 26, color: theme.colors.text },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { borderRadius: theme.radius.lg, padding: 24, marginBottom: 28 },
  heroLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  heroTitle: { fontFamily: theme.fonts.bold, fontSize: 20, color: '#fff', marginBottom: 16 },
  heroProgress: { fontFamily: theme.fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 8 },
  sectionTitle: { fontFamily: theme.fonts.bold, fontSize: 18, color: theme.colors.text, marginBottom: 14 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  quickItem: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    ...theme.shadow.card,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickLabel: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text },
  courseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  courseBadge: { backgroundColor: theme.colors.blueLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  courseBadgeText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.blue },
  courseProgress: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.purple },
  courseTitle: { fontFamily: theme.fonts.bold, fontSize: 20, color: theme.colors.text, marginBottom: 4 },
  courseMeta: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginBottom: 12 },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    marginTop: 16,
  },
  continueText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
