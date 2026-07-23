import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import { getLessonContent, HomeworkPart, LessonContent, mergeLessonContent } from '@/data/lessonContent';
import { fetchMobileContent } from '@/services/contentApi';
import { CreativeSubmissionRecord, fetchCreativeSubmission } from '@/services/creativeSubmissionApi';
import { useLessonProgress } from '@/services/lessonProgressStore';

const KIND_ICON: Record<HomeworkPart['kind'], keyof typeof Ionicons.glyphMap> = {
  matching: 'git-compare-outline',
  fillBlank: 'reader-outline',
  multipleChoice: 'checkbox-outline',
  sentenceBuild: 'swap-horizontal-outline',
  record: 'mic-outline',
  roleplay: 'chatbubbles-outline',
  pronunciation: 'megaphone-outline',
  creative: 'brush-outline',
};

export default function HomeworkSectionScreen() {
  const { t } = useLang();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const [content, setContent] = useState<LessonContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [creativeSubmission, setCreativeSubmission] = useState<CreativeSubmissionRecord | null>(null);
  const progress = useLessonProgress(String(lessonId));

  useEffect(() => {
    let cancelled = false;
    fetchMobileContent()
      .then((mc) => {
        if (cancelled) return;
        const lesson = mc.lessons.find((l) => l.id === lessonId);
        const courseLessons = lesson ? mc.lessons.filter((l) => l.courseId === lesson.courseId) : [];
        const dayIndex = Math.max(0, courseLessons.findIndex((l) => l.id === lessonId));
        setContent(mergeLessonContent(getLessonContent(String(lessonId), dayIndex), mc.lessonContents[String(lessonId)]));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  // 148-ish: "Ijodiy vazifa"ning haqiqiy holati (kutilmoqda/qabul qilindi)
  // — bu shu ekranga qaytilganda ham yangilanib turishi uchun fokusda qayta
  // tekshiriladi.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchCreativeSubmission(String(lessonId)).then((record) => {
        if (!cancelled) setCreativeSubmission(record);
      });
      return () => {
        cancelled = true;
      };
    }, [lessonId])
  );

  if (loading || !content) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={t('hw_cat_homework_title')} showBack />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  const parts = content.homeworkParts;
  // 148-ish: "Ijodiy vazifa" ustoz qabul qilib 100% ballamaguncha bajarilgan
  // hisoblanmaydi — boshqa qismlar avvalgidek darhol avtomatik ballanadi.
  const isPartDone = (part: HomeworkPart) =>
    part.kind === 'creative' ? creativeSubmission?.status === 'graded' : !!progress.homeworkParts[part.id];
  const doneCount = parts.filter(isPartDone).length;
  const overallPct = Math.round((doneCount / parts.length) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Uyga vazifa" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.overallCard}>
          <Text style={styles.overallLabel}>{t('hw_overall_progress')}</Text>
          <View style={styles.overallRow}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${overallPct}%` }]} />
            </View>
            <Text style={styles.overallPct}>{overallPct}%</Text>
          </View>
        </Card>

        {parts.map((part) => {
          const isDone = isPartDone(part);
          const isPendingCreative = part.kind === 'creative' && creativeSubmission?.status === 'pending';
          const statusLabel = isDone ? t('hw_status_done') : isPendingCreative ? t('hw_status_pending_review') : t('hw_status_not_done');
          return (
            <Pressable
              key={part.id}
              onPress={() => router.push(`/homework/lesson/${lessonId}/homework/${part.id}?day=${content.dayType}` as never)}>
              <Card style={styles.card}>
                <View style={styles.row}>
                  <View style={[styles.iconWrap, isDone && styles.iconWrapDone]}>
                    <Ionicons
                      name={isDone ? 'checkmark' : isPendingCreative ? 'time-outline' : KIND_ICON[part.kind]}
                      size={22}
                      color={isDone ? '#fff' : theme.colors.success}
                    />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.title}>{part.title}</Text>
                    <Text style={[styles.status, isDone && styles.statusDone]}>
                      {statusLabel}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                </View>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 40, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overallCard: { marginBottom: 4 },
  overallLabel: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.textMuted, marginBottom: 8 },
  overallRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: theme.colors.border },
  progressBarFill: { height: 8, borderRadius: 4, backgroundColor: theme.colors.success },
  overallPct: { fontFamily: theme.fonts.extraBold, fontSize: 16, color: theme.colors.success, minWidth: 42, textAlign: 'right' },
  card: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDone: { backgroundColor: theme.colors.success },
  info: { flex: 1 },
  title: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text },
  status: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  statusDone: { color: theme.colors.success, fontFamily: theme.fonts.medium },
});
