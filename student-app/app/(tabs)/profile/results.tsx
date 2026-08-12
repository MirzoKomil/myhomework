import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/ui/CoinIcon';
import { CourseProgressCard } from '@/components/ui/CourseProgressCard';
import { LightningIcon } from '@/components/ui/LightningIcon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { TEACHER_GRADE_CRITERIA } from '@/data/lessonGrades';
import { generateRealScheduleDays, ScheduleDay } from '@/data/scheduleCalendar';
import { getCourseOverallProgress } from '@/data/lessonContent';
import {
  DemoActivityEntry,
  fetchDemoActivity,
  fetchDemoGrades,
  fetchDemoSchedule,
  fetchDemoStudentPayments,
  fetchDemoStudentProfile,
  LiveGradeEntry,
} from '@/services/contentApi';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';
import { useCommunityLikesTotal } from '@/services/communityStore';
import { useCoins } from '@/services/coinsStore';
import { useLightning } from '@/services/lightningStore';
import { useOrders } from '@/services/shopStore';

type StatItem = { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; bg: string; color: string };

const BONUS_TOTAL = 18;

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

// 59-vazifa: "Natijalarim" ekrani ilgari ko'p qismda namuna (mock)
// ma'lumotlarni ko'rsatardi — endi barcha kartochkalar shu ilovada
// haqiqiy mavjud manbalardan (server API'lari va lessonProgressStore)
// hisoblanadi. Haqiqiy manbasi yo'q ikkita bo'lim ("Ko'nikmalar
// progressi" va "Qo'shimcha resurslar" — o'yin/kutubxona/AI chat/radio
// vaqti) butunlay olib tashlandi, chunki ular uchun ilovada hech qanday
// kuzatuv (tracking) mavjud emas edi.
export default function ResultsScreen() {
  const coins = useCoins();
  const lightning = useLightning();
  const orders = useOrders();
  const communityLikes = useCommunityLikesTotal();

  const [courseId, setCourseId] = useState<string | null>(null);
  const [courseProgress, setCourseProgress] = useState({ done: 0, total: 72, percent: 0, homeworkCompleted: 0 });
  const [attendanceRate, setAttendanceRate] = useState(0);
  const [hoursSpent, setHoursSpent] = useState(0);
  const [vocabularyCount, setVocabularyCount] = useState(0);
  const [correctedMistakes, setCorrectedMistakes] = useState(0);
  const [grades, setGrades] = useState<LiveGradeEntry[]>([]);
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>([]);
  const [lessonDuration, setLessonDuration] = useState(15);

  useEffect(() => {
    getCourseOverallProgress()
      .then((p) => {
        setCourseProgress(p);
        setCourseId(p.courseId);
      })
      .catch(() => {});

    fetchDemoStudentProfile()
      .then((profile) => {
        if (profile) {
          setAttendanceRate(profile.attendanceRate);
          setHoursSpent(profile.hoursSpent);
        }
      })
      .catch(() => {});

    getAccumulatedVocabulary()
      .then((words) => setVocabularyCount(words.length))
      .catch(() => {});

    fetchDemoActivity()
      .then((entries: DemoActivityEntry[]) => {
        setCorrectedMistakes(entries.reduce((sum, e) => sum + (e.wrongAttempts || 0), 0));
      })
      .catch(() => {});

    fetchDemoStudentPayments()
      .then((payments) => {
        if (payments) setLessonDuration(payments.lessonDuration);
      })
      .catch(() => {});

    // Jonli dars baholari (Ustoz baholari bo'limi) va haqiqiy jadval
    // (video/live/bonus kunlar soni) — "Jadval va davomat" ekranidagi
    // bilan bir xil manbadan.
    Promise.all([fetchDemoSchedule(), fetchDemoGrades()])
      .then(([schedule, gradesResp]) => {
        setGrades(gradesResp.grades);
        if (schedule.courseStartDate) {
          const attendedDates = new Set(gradesResp.grades.map((g) => g.date));
          const attendedTopics = new Map(gradesResp.grades.map((g) => [g.date, g.lessonName]));
          setScheduleDays(
            generateRealScheduleDays(schedule.courseStartDate, schedule.schedulePattern, attendedDates, attendedTopics)
          );
        }
      })
      .catch(() => {});
  }, []);

  const categoryAverages = useMemo(
    () =>
      TEACHER_GRADE_CRITERIA.map((c) => {
        if (grades.length === 0) return { ...c, avg: 0 };
        return { ...c, avg: grades.reduce((s, g) => s + g.scores[c.key], 0) / grades.length };
      }),
    [grades]
  );
  const avgTeacherScore = useMemo(
    () => (categoryAverages.length === 0 ? 0 : categoryAverages.reduce((s, c) => s + c.avg, 0) / categoryAverages.length),
    [categoryAverages]
  );

  const liveLessonsPast = useMemo(() => scheduleDays.filter((d) => d.type === 'live' && d.isPast), [scheduleDays]);
  const videoLessonsPast = useMemo(() => scheduleDays.filter((d) => d.type === 'video' && d.isPast), [scheduleDays]);
  const bonusDaysPast = useMemo(() => scheduleDays.filter((d) => d.type === 'bonus' && d.isPast), [scheduleDays]);
  const bonusAttended = useMemo(() => bonusDaysPast.filter((d) => !d.missed).length, [bonusDaysPast]);

  const speakingHours = (grades.length * lessonDuration) / 60;

  const generalStats: StatItem[] = [
    { icon: 'checkmark-circle', label: 'Davomat', value: `${attendanceRate}%`, bg: theme.colors.successBg, color: theme.colors.success },
    { icon: 'book', label: "O'rganilgan so'zlar", value: `${vocabularyCount} ta`, bg: theme.colors.purpleLight, color: theme.colors.purple },
    { icon: 'time', label: 'Ilovada sarflangan vaqt', value: `${hoursSpent} soat`, bg: theme.colors.warningBg, color: theme.colors.warning },
    { icon: 'build', label: 'Tuzatilgan xatolar', value: `${correctedMistakes} ta`, bg: theme.colors.dangerBg, color: theme.colors.danger },
  ];

  const teacherStats: StatItem[] = [
    { icon: 'clipboard', label: 'Ustoz baholagan darslar', value: `${grades.length} ta`, bg: theme.colors.blueLight, color: theme.colors.blue },
    { icon: 'star', label: "Ustozdan o'rtacha baho", value: `${avgTeacherScore.toFixed(1)}/5`, bg: theme.colors.warningBg, color: '#D97706' },
  ];

  const lessonStats: StatItem[] = [
    { icon: 'videocam', label: 'Tugallangan videodars (grammatika)', value: `${videoLessonsPast.length} ta`, bg: theme.colors.blueLight, color: theme.colors.blue },
    { icon: 'mic', label: 'Live darslar (speaking)', value: `${liveLessonsPast.length} ta`, bg: theme.colors.pinkBg, color: theme.colors.pink },
    { icon: 'hourglass', label: 'Speaking soati', value: `${speakingHours.toFixed(1)} soat`, bg: theme.colors.successBg, color: theme.colors.success },
    { icon: 'document-text', label: 'Bajarilgan uyga vazifalar', value: `${courseProgress.homeworkCompleted} ta`, bg: theme.colors.purpleLight, color: theme.colors.purple },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Natijalarim" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <CourseProgressCard
          progress={courseProgress.percent}
          lessonsDone={courseProgress.done}
          lessonsTotal={courseProgress.total}
          onPress={() => courseId && router.push(`/homework/roadmap/${courseId}` as never)}
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
              {bonusAttended}/{BONUS_TOTAL}
            </Text>
          </View>
          <ProgressBar progress={(bonusAttended / BONUS_TOTAL) * 100} color={theme.colors.warning} />
          <Text style={styles.bonusHint}>
            Kurs davomida jami {BONUS_TOTAL} ta yakshanba bonus dars rejalashtirilgan, hozirgacha {bonusDaysPast.length} tasi o'tdi.
          </Text>
        </View>

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
            <View style={[styles.statIcon, { backgroundColor: theme.colors.blueLight }]}>
              <LightningIcon size={20} />
            </View>
            <Text style={styles.statValue}>{lightning}</Text>
            <Text style={styles.statLabel}>Yig'gan chaqmoqlar</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: theme.colors.successBg }]}>
              <Ionicons name="bag-handle" size={20} color={theme.colors.success} />
            </View>
            <Text style={styles.statValue}>{orders.length} ta</Text>
            <Text style={styles.statLabel}>Homework Shopdan xaridlar</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: theme.colors.pinkBg }]}>
              <Ionicons name="heart" size={20} color={theme.colors.pink} />
            </View>
            <Text style={styles.statValue}>{communityLikes} ta</Text>
            <Text style={styles.statLabel}>Hamjamiyatda yig'gan like'lar</Text>
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
