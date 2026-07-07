import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { BONUS_CATEGORIES } from '@/data/lessonContent';
import { courseEnrollment } from '@/data/mock';
import { UZ_MONTHS } from '@/data/scheduleCalendar';
import { getCategoryProgress, getLessonProgress, subscribe } from '@/services/lessonProgressStore';

const TOTAL = 18;
const UNLOCKED_COUNT = 1;
const BONUS_HOMEWORK_PARTS = 3;

// Kurs boshlangan sanadan keyingi birinchi yakshanba — bonus darslar shu kundan boshlab har hafta beriladi.
function firstSundayOnOrAfter(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  date.setDate(date.getDate() + (dow === 0 ? 0 : 7 - dow));
  return date;
}

const FIRST_BONUS_DATE = firstSundayOnOrAfter(courseEnrollment.courseStartDate);

function bonusDateLabel(index: number): string {
  const date = new Date(FIRST_BONUS_DATE);
  date.setDate(date.getDate() + index * 7);
  return `${date.getDate()}-${UZ_MONTHS[date.getMonth()].toLowerCase()}`;
}

const BONUS_LESSONS = Array.from({ length: TOTAL }, (_, i) => ({
  id: `bonus-${i + 1}`,
  category: BONUS_CATEGORIES[i % BONUS_CATEGORIES.length],
  round: Math.floor(i / BONUS_CATEGORIES.length) + 1,
  dateLabel: bonusDateLabel(i),
}));

function overallProgress(bonusId: string): number {
  const video = getLessonProgress(bonusId).videoWatch ? 100 : 0;
  const vocab = getCategoryProgress(bonusId, 'vocabulary');
  const homework = getCategoryProgress(bonusId, 'homework', BONUS_HOMEWORK_PARTS);
  return Math.round((video + vocab + homework) / 3);
}

export default function BonusLessonsScreen() {
  const [, forceUpdate] = useState(0);
  const [showLockedNotice, setShowLockedNotice] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => subscribe(() => forceUpdate((n) => n + 1)), []);

  const openLesson = (lesson: (typeof BONUS_LESSONS)[number], locked: boolean) => {
    if (locked) {
      setShowLockedNotice(true);
      return;
    }
    router.push(`/homework/bonusLesson/${lesson.id}` as never);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Bonus darslar"
        showBack
        rightAction={
          <Pressable style={styles.infoBtn} onPress={() => setShowInfo(true)} hitSlop={8}>
            <Ionicons name="information-circle-outline" size={22} color={theme.colors.textMuted} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Har yakshanba kuni beriladigan qo'shimcha video darslar to'plami</Text>
        {BONUS_LESSONS.map((lesson, index) => {
          const locked = index >= UNLOCKED_COUNT;
          const pct = locked ? 0 : overallProgress(lesson.id);
          return (
            <Pressable key={lesson.id} onPress={() => openLesson(lesson, locked)}>
              <Card style={locked ? styles.cardLocked : styles.card}>
                <View style={styles.row}>
                  <View style={[styles.iconWrap, locked && styles.iconWrapLocked, !locked && { backgroundColor: lesson.category.bg }]}>
                    {locked ? (
                      <Ionicons name="lock-closed" size={20} color={theme.colors.textLight} />
                    ) : (
                      <Text style={styles.iconEmoji}>{lesson.category.emoji}</Text>
                    )}
                  </View>
                  <View style={styles.info}>
                    <Text style={[styles.title, locked && styles.titleLocked]}>
                      Bonus dars {index + 1} — {lesson.category.label}
                    </Text>
                    <Text style={styles.meta}>
                      {locked ? `Hali ochilmagan • ${lesson.dateLabel}` : `${lesson.round}-bosqich • ${lesson.dateLabel}`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                </View>
                {!locked && (
                  <View style={styles.progressRow}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: lesson.category.color }]} />
                    </View>
                    <Text style={[styles.pctText, { color: lesson.category.color }]}>{pct}%</Text>
                  </View>
                )}
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={showLockedNotice} animationType="fade" transparent onRequestClose={() => setShowLockedNotice(false)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={styles.dialogBackdropTap} onPress={() => setShowLockedNotice(false)} />
          <View style={styles.dialogCard}>
            <View style={styles.dialogIconWrap}>
              <Ionicons name="lock-closed" size={30} color={theme.colors.textMuted} />
            </View>
            <Text style={styles.dialogTitle}>Bu bonus dars hali ochilmagan</Text>
            <Text style={styles.dialogSubtitle}>Har yakshanba navbatdagi bonus dars ochiladi. Iltimos, o'z navbatini kuting.</Text>
            <Pressable style={styles.dialogConfirmBtn} onPress={() => setShowLockedNotice(false)}>
              <Text style={styles.dialogConfirmText}>Tushunarli</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showInfo} animationType="fade" transparent onRequestClose={() => setShowInfo(false)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={styles.dialogBackdropTap} onPress={() => setShowInfo(false)} />
          <View style={styles.dialogCard}>
            <Text style={styles.dialogEmoji}>🎁</Text>
            <Text style={styles.dialogTitle}>Bonus darslar nima?</Text>
            <Text style={[styles.dialogSubtitle, styles.dialogSubtitleLeft]}>
              🗓️ Har yakshanba kuni yangita bonus dars ochiladi — jami 18 ta dars.{'\n\n'}
              🎬🎵🌟🧠🗣️🎭 6 ta qiziqarli kategoriya (Kino tahlil, Musiqiy dars, Motivatsion dars, Intellektual o'yin, Ko'cha ingliz tili, Hayotiy vaziyat) 3 marta takrorlanadi.{'\n\n'}
              📺 Har bir dars video, yangi so'zlar va avtomatik tekshiriladigan uyga vazifadan iborat — ijodiy qism yo'q, chunki bu qo'shimcha bonus dars!{'\n\n'}
              💬 Izoh qoldirish va coin yig'ish ham mavjud.
            </Text>
            <Pressable style={styles.dialogConfirmBtn} onPress={() => setShowInfo(false)}>
              <Text style={styles.dialogConfirmText}>Tushunarli</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 32, gap: 12 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginBottom: 4, lineHeight: 19 },
  card: {},
  cardLocked: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  iconWrapLocked: { backgroundColor: theme.colors.bg },
  iconEmoji: { fontSize: 22 },
  info: { flex: 1 },
  title: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text },
  titleLocked: { color: theme.colors.textMuted },
  meta: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  progressBarBg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: theme.colors.border },
  progressBarFill: { height: 5, borderRadius: 3 },
  pctText: { fontFamily: theme.fonts.bold, fontSize: 12, minWidth: 32, textAlign: 'right' },

  dialogBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogBackdropTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dialogCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  dialogIconWrap: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3C7', marginBottom: 4 },
  dialogEmoji: { fontSize: 36 },
  dialogTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text, textAlign: 'center' },
  dialogSubtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
  dialogSubtitleLeft: { textAlign: 'left', lineHeight: 20 },
  infoBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  dialogConfirmBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    marginTop: 10,
  },
  dialogConfirmText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
});
