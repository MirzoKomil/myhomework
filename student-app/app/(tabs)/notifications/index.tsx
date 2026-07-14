import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { AppNotification, NotifCategory } from '@/data/mock';
import { fetchDemoGrades, fetchDemoNotifications, toAppNotification } from '@/services/contentApi';

const ATTENDANCE_OPTIONS = ['Darsga kirdim', 'Darsga kira olmadim', 'Dars yarmida tugadi'];

function AttendanceCard({ notif }: { notif: AppNotification }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  return (
    <View style={styles.card}>
      <Text style={styles.dateText}>{notif.date}</Text>
      <Text style={styles.cardTitle}>{notif.title}</Text>
      <View style={styles.divider} />
      <Text style={styles.question}>{notif.message}</Text>
      {ATTENDANCE_OPTIONS.map((opt) => (
        <Pressable key={opt} style={styles.radioRow} onPress={() => !submitted && setSelected(opt)}>
          <View style={[styles.radioOuter, selected === opt && styles.radioOuterActive]}>
            {selected === opt && <View style={styles.radioInner} />}
          </View>
          <Text style={styles.radioLabel}>{opt}</Text>
        </Pressable>
      ))}
      <Pressable
        style={[styles.confirmBtn, (!selected || submitted) && styles.confirmBtnDisabled]}
        disabled={!selected || submitted}
        onPress={() => setSubmitted(true)}>
        <Text style={styles.confirmBtnText}>{submitted ? 'Tasdiqlandi ✓' : 'Tasdiqlash'}</Text>
      </Pressable>
    </View>
  );
}

function NotifCard({ notif }: { notif: AppNotification }) {
  const onPress =
    notif.interactive === 'rate-teacher'
      ? () => router.push('/profile/grades' as never)
      : () => router.push(`/notifications/${notif.id}` as never);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardTopRow}>
        <LinearGradient
          colors={notif.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emojiWrap}>
          <Text style={styles.emojiText}>{notif.emoji}</Text>
        </LinearGradient>
        <View style={styles.cardInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>{notif.title}</Text>
            {notif.unread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.cardMessage} numberOfLines={2}>
            {notif.message}
          </Text>
          <Text style={styles.dateText}>{notif.date}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const [tab, setTab] = useState<NotifCategory>('news');
  const [rateTeacherNotifs, setRateTeacherNotifs] = useState<AppNotification[]>([]);
  const [realNotifs, setRealNotifs] = useState<AppNotification[]>([]);

  // Ustoz davomat qilib baholagach, hali ustoz baholanmagan har bir jonli
  // dars uchun "Ustozni baholang" bildirishnomasi avtomatik qo'shiladi.
  useEffect(() => {
    fetchDemoGrades()
      .then(({ grades }) => {
        const unrated = grades.filter((g) => !g.studentRatingOfTeacher);
        setRateTeacherNotifs(
          unrated.map((g) => ({
            id: `rate-teacher-${g.date}`,
            category: 'lessons' as const,
            date: g.date,
            title: 'Ustozni baholang',
            message: `${g.lessonName} darsi uchun ustozingizni baholashingiz kutilmoqda.`,
            detail: `${g.lessonName} darsidan so'ng ustozingiz sizni baholadi. Endi navbat sizda — "Baholar" bo'limida ustozingizni baholang.`,
            unread: true,
            colors: ['#F59E0B', '#D97706'] as [string, string],
            emoji: '⭐',
            interactive: 'rate-teacher' as const,
          }))
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchDemoNotifications()
      .then((list) => setRealNotifs(list.map(toAppNotification)))
      .catch(() => {});
  }, []);

  const allNotifications = [...rateTeacherNotifs, ...realNotifs];
  const newsUnread = allNotifications.filter((n) => n.category === 'news' && n.unread).length;
  const lessonsUnread = allNotifications.filter((n) => n.category === 'lessons' && n.unread).length;
  const list = allNotifications.filter((n) => n.category === tab);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Bildirishnomalar" showBack />

      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === 'news' && styles.tabBtnActive]} onPress={() => setTab('news')}>
          <Text style={[styles.tabText, tab === 'news' && styles.tabTextActive]}>Yangiliklar</Text>
          {newsUnread > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{newsUnread}</Text>
            </View>
          )}
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === 'lessons' && styles.tabBtnActive]} onPress={() => setTab('lessons')}>
          <Text style={[styles.tabText, tab === 'lessons' && styles.tabTextActive]}>Darslar</Text>
          {lessonsUnread > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{lessonsUnread}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {list.map((n) =>
          n.interactive === 'attendance' ? <AttendanceCard key={n.id} notif={n} /> : <NotifCard key={n.id} notif={n} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: theme.colors.purpleLight },
  tabText: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.textMuted },
  tabTextActive: { color: theme.colors.purple },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { fontFamily: theme.fonts.bold, fontSize: 10, color: '#fff' },
  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    ...theme.shadow.card,
  },
  cardTopRow: { flexDirection: 'row', gap: 12 },
  emojiWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 20 },
  cardInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardTitle: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.colors.danger },
  cardMessage: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginBottom: 4 },
  dateText: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textLight },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 10 },
  question: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text, marginBottom: 12 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: theme.colors.purple },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.purple },
  radioLabel: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.text },
  confirmBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmBtnDisabled: { backgroundColor: theme.colors.purpleLight },
  confirmBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
});
