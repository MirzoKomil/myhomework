import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import {
  SCHEDULE_MISSED_COLOR,
  SCHEDULE_TYPE_COLORS,
  SCHEDULE_TYPE_LABELS,
  ScheduleDay,
  UZ_MONTHS,
  UZ_WEEKDAY_FULL,
  UZ_WEEKDAY_LABELS,
  dateKey,
  generateRealScheduleDays,
  generateScheduleDays,
  getMonthMatrix,
  isSameDate,
} from '@/data/scheduleCalendar';
import { fetchDemoGrades, fetchDemoSchedule } from '@/services/contentApi';

function formatDate(d: Date): string {
  return `${d.getDate()}-${UZ_MONTHS[d.getMonth()].toLowerCase()}, ${UZ_WEEKDAY_FULL[(d.getDay() + 6) % 7]}`;
}

const WEEK_DAY_LABELS = ['Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan', 'Yak'];

type WeeklyItem = { day: string; time: string; topic: string; attended: boolean | null };

export default function ScheduleScreen() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Real ma'lumot kelguncha eski (statik) jadval bilan boshlanadi — server
  // javob bergach, agar o'quvchining haqiqiy o'qish boshlagan kuni topilsa,
  // shu asosda qurilgan haqiqiy jadval bilan almashtiriladi.
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>(() => generateScheduleDays());
  const [lessonTime, setLessonTime] = useState('');

  useEffect(() => {
    Promise.all([fetchDemoSchedule(), fetchDemoGrades()])
      .then(([schedule, grades]) => {
        if (!schedule.courseStartDate) return;
        const attendedDates = new Set(grades.grades.map((g) => g.date));
        const attendedTopics = new Map(grades.grades.map((g) => [g.date, g.lessonName]));
        setScheduleDays(
          generateRealScheduleDays(schedule.courseStartDate, schedule.schedulePattern, attendedDates, attendedTopics)
        );
        setLessonTime(schedule.lessonTime);
      })
      .catch(() => {});
  }, []);

  const dayMap = useMemo(() => {
    const map = new Map<string, ScheduleDay>();
    scheduleDays.forEach((d) => map.set(dateKey(d.date), d));
    return map;
  }, [scheduleDays]);

  const courseStart = scheduleDays[0]?.date ?? today;
  const courseEnd = scheduleDays[scheduleDays.length - 1]?.date ?? today;

  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const canGoPrev = viewMonth.getFullYear() > courseStart.getFullYear() || (viewMonth.getFullYear() === courseStart.getFullYear() && viewMonth.getMonth() > courseStart.getMonth());
  const canGoNext = viewMonth.getFullYear() < courseEnd.getFullYear() || (viewMonth.getFullYear() === courseEnd.getFullYear() && viewMonth.getMonth() < courseEnd.getMonth());

  const weeks = useMemo(() => getMonthMatrix(viewMonth.getFullYear(), viewMonth.getMonth()), [viewMonth]);

  const pastDays = useMemo(
    () => scheduleDays.filter((d) => d.isPast).sort((a, b) => b.date.getTime() - a.date.getTime()),
    [scheduleDays]
  );
  const missedDays = useMemo(() => pastDays.filter((d) => d.missed), [pastDays]);

  // Joriy hafta (Dushanbadan Yakshanbagacha) jadvali — haqiqiy scheduleDays'dan hisoblanadi.
  const weeklyItems: WeeklyItem[] = useMemo(() => {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return scheduleDays
      .filter((d) => d.date.getTime() >= weekStart.getTime() && d.date.getTime() <= weekEnd.getTime())
      .map((d) => ({
        day: WEEK_DAY_LABELS[(d.date.getDay() + 6) % 7],
        time: d.type === 'bonus' ? '' : lessonTime,
        topic: d.topic,
        attended: d.isToday || !d.isPast ? null : !d.missed,
      }));
  }, [scheduleDays, lessonTime, today]);

  const attended = weeklyItems.filter((s) => s.attended === true).length;
  const total = weeklyItems.filter((s) => s.attended !== null).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Jadval va davomat" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.calendarCard}>
          <View style={styles.monthNav}>
            <Pressable
              style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
              disabled={!canGoPrev}
              onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>
              <Ionicons name="chevron-back" size={18} color={canGoPrev ? theme.colors.text : theme.colors.textLight} />
            </Pressable>
            <Text style={styles.monthLabel}>
              {UZ_MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </Text>
            <Pressable
              style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
              disabled={!canGoNext}
              onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>
              <Ionicons name="chevron-forward" size={18} color={canGoNext ? theme.colors.text : theme.colors.textLight} />
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {UZ_WEEKDAY_LABELS.map((w) => (
              <Text key={w} style={styles.weekdayLabel}>
                {w}
              </Text>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((date, di) => {
                if (!date) return <View key={di} style={styles.dayCell} />;
                const sd = dayMap.get(dateKey(date));
                const dotColor = sd ? (sd.missed ? SCHEDULE_MISSED_COLOR : SCHEDULE_TYPE_COLORS[sd.type]) : undefined;
                const isToday = isSameDate(date, today);
                const isPast = date.getTime() < today.getTime();
                return (
                  <View key={di} style={styles.dayCell}>
                    <View style={[styles.dayCircle, isToday && styles.dayCircleToday]}>
                      <Text style={[styles.dayNumber, isPast && !isToday && styles.dayNumberPast]}>{date.getDate()}</Text>
                    </View>
                    {dotColor && <View style={[styles.dayDot, { backgroundColor: dotColor }]} />}
                  </View>
                );
              })}
            </View>
          ))}

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: SCHEDULE_TYPE_COLORS.live }]} />
              <Text style={styles.legendText}>{SCHEDULE_TYPE_LABELS.live}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: SCHEDULE_TYPE_COLORS.video }]} />
              <Text style={styles.legendText}>{SCHEDULE_TYPE_LABELS.video}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: SCHEDULE_TYPE_COLORS.bonus }]} />
              <Text style={styles.legendText}>{SCHEDULE_TYPE_LABELS.bonus}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: SCHEDULE_MISSED_COLOR }]} />
              <Text style={styles.legendText}>Qoldirilgan</Text>
            </View>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Joriy hafta jadvali</Text>
        <Card style={styles.summary}>
          <Text style={styles.summaryLabel}>Haftalik davomat</Text>
          <Text style={styles.summaryValue}>
            {attended}/{total} dars
          </Text>
          <View style={styles.rateBar}>
            <View style={[styles.rateFill, { width: `${total > 0 ? (attended / total) * 100 : 0}%` }]} />
          </View>
        </Card>

        {weeklyItems.map((item, i) => (
          <Card key={`${item.day}-${i}`} style={styles.dayCard}>
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

        <Text style={styles.sectionTitle}>Bo'lib o'tgan darslar</Text>
        {pastDays.map((d) => (
          <Card key={d.dayNumber} style={styles.historyCard}>
            <View style={[styles.historyDot, { backgroundColor: d.missed ? SCHEDULE_MISSED_COLOR : SCHEDULE_TYPE_COLORS[d.type] }]} />
            <View style={styles.historyInfo}>
              <Text style={styles.historyDate}>{formatDate(d.date)}</Text>
              <Text style={styles.historyTopic}>{d.topic}</Text>
            </View>
            {d.missed ? (
              <View style={[styles.badge, styles.badgeAbsent]}>
                <Ionicons name="close" size={12} color={theme.colors.danger} />
                <Text style={styles.badgeTextAbsent}>Kelmadi</Text>
              </View>
            ) : (
              <View style={[styles.badge, styles.badgePresent]}>
                <Ionicons name="checkmark" size={12} color={theme.colors.success} />
                <Text style={styles.badgeTextPresent}>Bajarildi</Text>
              </View>
            )}
          </Card>
        ))}

        <Text style={styles.sectionTitle}>Qoldirilgan darslar</Text>
        {missedDays.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Siz hali birorta ham darsni qoldirmadingiz 🎉</Text>
          </Card>
        ) : (
          missedDays.map((d) => (
            <Card key={d.dayNumber} style={styles.historyCard}>
              <View style={[styles.historyDot, { backgroundColor: SCHEDULE_MISSED_COLOR }]} />
              <View style={styles.historyInfo}>
                <Text style={styles.historyDate}>{formatDate(d.date)}</Text>
                <Text style={styles.historyTopic}>{d.topic}</Text>
              </View>
              <View style={[styles.badge, styles.badgeAbsent]}>
                <Ionicons name="close" size={12} color={theme.colors.danger} />
                <Text style={styles.badgeTextAbsent}>Kelmadi</Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, gap: 12, paddingBottom: 40 },

  calendarCard: { gap: 4 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  navBtnDisabled: { opacity: 0.4 },
  monthLabel: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontFamily: theme.fonts.semiBold, fontSize: 11, color: theme.colors.textMuted },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 3 },
  dayCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dayCircleToday: { backgroundColor: theme.colors.purple },
  dayNumber: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.text },
  dayNumberPast: { color: theme.colors.textLight },
  dayDot: { width: 5, height: 5, borderRadius: 3 },

  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: theme.fonts.medium, fontSize: 11, color: theme.colors.textMuted },

  sectionTitle: { fontFamily: theme.fonts.extraBold, fontSize: 16, color: theme.colors.text, marginTop: 12, marginBottom: 2 },

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

  historyCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  historyInfo: { flex: 1 },
  historyDate: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text },
  historyTopic: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  emptyCard: { alignItems: 'center' },
  emptyText: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
});
