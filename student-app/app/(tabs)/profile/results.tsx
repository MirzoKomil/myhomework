import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/ui/CoinIcon';
import { CourseProgressCard } from '@/components/ui/CourseProgressCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkillBars } from '@/components/ui/SkillBars';
import { theme } from '@/constants/theme';
import { courseEnrollment, courses, profileStats, skillProgress } from '@/data/mock';
import { generateTeacherScores, TEACHER_GRADE_CRITERIA } from '@/data/lessonGrades';
import { generateScheduleDays } from '@/data/scheduleCalendar';
import { useCoins } from '@/services/coinsStore';
import { useOrders } from '@/services/shopStore';

type StatItem = { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; bg: string; color: string };

function StatGrid({ stats }: { stats: StatItem[] }) {
  return (
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
  );
}

export default function ResultsScreen() {
  const activeCourse = courses[0];
  const coins = useCoins();
  const orders = useOrders();

  const scheduleDays = useMemo(() => generateScheduleDays(), []);

  const liveLessons = useMemo(() => scheduleDays.filter((d) => d.type === 'live' && d.isPast), [scheduleDays]);
  const videoLessons = useMemo(() => scheduleDays.filter((d) => d.type === 'video' && d.isPast), [scheduleDays]);
  const bonusDays = useMemo(() => scheduleDays.filter((d) => d.type === 'bonus'), [scheduleDays]);
  const bonusDaysPast = useMemo(() => bonusDays.filter((d) => d.isPast), [bonusDays]);
  const bonusAttended = useMemo(() => bonusDaysPast.filter((d) => !d.missed).length, [bonusDaysPast]);

  const avgTeacherScore = useMemo(() => {
    if (liveLessons.length === 0) return 0;
    let sum = 0;
    liveLessons.forEach((lesson) => {
      const scores = generateTeacherScores(lesson.dayNumber);
      TEACHER_GRADE_CRITERIA.forEach((c) => {
        sum += scores[c.key];
      });
    });
    return sum / (liveLessons.length * TEACHER_GRADE_CRITERIA.length);
  }, [liveLessons]);

  const speakingHours = (liveLessons.length * courseEnrollment.tariffMinutes) / 60;
  const homeworkCompleted = videoLessons.length + liveLessons.length;

  const correctedMistakes = useMemo(() => {
    let total = 0;
    [...videoLessons, ...liveLessons].forEach((day) => {
      const x = Math.sin(day.dayNumber * 17.31) * 10000;
      const frac = x - Math.floor(x);
      total += Math.floor(frac * 4); // har bir darsda 0-3 ta tuzatilgan xato
    });
    return total;
  }, [videoLessons, liveLessons]);

  const generalStats: StatItem[] = [
    { icon: 'checkmark-circle', label: 'Davomat', value: `${profileStats.attendanceRate}%`, bg: theme.colors.successBg, color: theme.colors.success },
    { icon: 'book', label: "O'rganilgan so'zlar", value: `${profileStats.vocabularyCount} ta`, bg: theme.colors.purpleLight, color: theme.colors.purple },
    { icon: 'time', label: 'Ilovada sarflangan vaqt', value: `${profileStats.hoursSpent} soat`, bg: theme.colors.warningBg, color: theme.colors.warning },
    { icon: 'build', label: 'Tuzatilgan xatolar', value: `${correctedMistakes} ta`, bg: theme.colors.dangerBg, color: theme.colors.danger },
  ];

  const teacherStats: StatItem[] = [
    { icon: 'clipboard', label: 'Ustoz baholagan darslar', value: `${liveLessons.length} ta`, bg: theme.colors.blueLight, color: theme.colors.blue },
    { icon: 'star', label: "Ustozdan o'rtacha baho", value: `${avgTeacherScore.toFixed(1)}/5`, bg: theme.colors.warningBg, color: '#D97706' },
  ];

  const lessonStats: StatItem[] = [
    { icon: 'videocam', label: "Tugallangan videodars (grammatika)", value: `${videoLessons.length} ta`, bg: theme.colors.blueLight, color: theme.colors.blue },
    { icon: 'mic', label: 'Live darslar (speaking)', value: `${liveLessons.length} ta`, bg: theme.colors.pinkBg, color: theme.colors.pink },
    { icon: 'hourglass', label: 'Speaking soati', value: `${speakingHours.toFixed(1)} soat`, bg: theme.colors.successBg, color: theme.colors.success },
    { icon: 'document-text', label: 'Bajarilgan uyga vazifalar', value: `${homeworkCompleted} ta`, bg: theme.colors.purpleLight, color: theme.colors.purple },
  ];

  const resourceStats: StatItem[] = [
    { icon: 'game-controller', label: "O'yinlarga sarflangan vaqt", value: `${profileStats.gamesTimeHours} soat`, bg: theme.colors.dangerBg, color: theme.colors.danger },
    { icon: 'library', label: 'Kutubxonada sarflangan vaqt', value: `${profileStats.libraryTimeHours} soat`, bg: theme.colors.blueLight, color: theme.colors.blue },
    { icon: 'sparkles', label: 'AI chatda sarflangan vaqt', value: `${profileStats.aiChatTimeHours} soat`, bg: theme.colors.purpleLight, color: theme.colors.purple },
    { icon: 'radio', label: 'Radioga sarflangan vaqt', value: `${profileStats.radioTimeHours} soat`, bg: theme.colors.successBg, color: theme.colors.success },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Natijalarim" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <CourseProgressCard
          progress={activeCourse.progress}
          lessonsDone={activeCourse.lessonsDone}
          lessonsTotal={activeCourse.lessonsTotal}
          onPress={() => router.push(`/homework/roadmap/${activeCourse.id}` as never)}
        />

        <Text style={styles.sectionTitle}>Umumiy natijalar</Text>
        <StatGrid stats={generalStats} />

        <Text style={styles.sectionTitle}>Ustoz baholari 🏆</Text>
        <StatGrid stats={teacherStats} />

        <Text style={styles.sectionTitle}>Darslar statistikasi</Text>
        <StatGrid stats={lessonStats} />

        <View style={styles.bonusCard}>
          <View style={styles.bonusHeadRow}>
            <Text style={styles.bonusTitle}>Bonus (Yakshanba) darslar</Text>
            <Text style={styles.bonusCount}>
              {bonusAttended}/{bonusDaysPast.length}
            </Text>
          </View>
          <ProgressBar progress={bonusDaysPast.length ? (bonusAttended / bonusDaysPast.length) * 100 : 0} color={theme.colors.warning} />
          <Text style={styles.bonusHint}>
            90 kunlik dasturda jami {bonusDays.length} ta bonus dars rejalashtirilgan, hozirgacha {bonusDaysPast.length} tasi o'tdi.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Ko'nikmalar progressi</Text>
        <SkillBars skills={skillProgress} />

        <Text style={styles.sectionTitle}>Qo'shimcha resurslar</Text>
        <StatGrid stats={resourceStats} />

        <Text style={styles.sectionTitle}>Yutuqlar ✨</Text>
        <View style={styles.grid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: theme.colors.warningBg }]}>
              <CoinIcon size={20} />
            </View>
            <Text style={styles.statValue}>{coins}</Text>
            <Text style={styles.statLabel}>Yig'gan ballari (coin)</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: theme.colors.successBg }]}>
              <Ionicons name="bag-handle" size={20} color={theme.colors.success} />
            </View>
            <Text style={styles.statValue}>{orders.length} ta</Text>
            <Text style={styles.statLabel}>Homework Shopdan xaridlar</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontFamily: theme.fonts.extraBold, fontSize: 16, color: theme.colors.text, marginTop: 8, marginBottom: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
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

  bonusCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 18,
    marginBottom: 8,
    ...theme.shadow.card,
  },
  bonusHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  bonusTitle: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text },
  bonusCount: { fontFamily: theme.fonts.extraBold, fontSize: 16, color: theme.colors.warning },
  bonusHint: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 10, lineHeight: 17 },
});
