import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import { Exam, getResolvedExams } from '@/data/exams';
import { courses } from '@/data/mock';
import { useExamResults } from '@/services/examStore';

export default function ExamsScreen() {
  const { t } = useLang();
  const activeCourse = courses[0];
  const results = useExamResults();
  const [lockedNotice, setLockedNotice] = useState<Exam | null>(null);
  const [resolved, setResolved] = useState<{ exam: Exam; passPercent: number }[] | null>(null);

  useEffect(() => {
    getResolvedExams().then(setResolved);
  }, []);

  const isUnlocked = (exam: Exam) => activeCourse.lessonsDone >= exam.requiredLessons;

  const openExam = (exam: Exam) => {
    if (!isUnlocked(exam)) {
      setLockedNotice(exam);
      return;
    }
    router.push(`/homework/exams/${exam.id}` as never);
  };

  if (!resolved) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={t('exams_title')} showBack />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Imtihonlar" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          {t('exams_subtitle')}
        </Text>
        {resolved.map(({ exam, passPercent }, index) => {
          const unlocked = isUnlocked(exam);
          const result = results[exam.id];
          const isFinal = exam.id === 'final';
          void passPercent;
          return (
            <Pressable key={exam.id} onPress={() => openExam(exam)}>
              <Card style={unlocked ? styles.card : styles.cardLocked}>
                <View style={styles.row}>
                  <View
                    style={[
                      styles.iconWrap,
                      !unlocked && styles.iconWrapLocked,
                      unlocked && { backgroundColor: isFinal ? '#FEF3C7' : theme.colors.blueLight },
                    ]}
                  >
                    <Ionicons
                      name={!unlocked ? 'lock-closed' : isFinal ? 'trophy' : 'timer-outline'}
                      size={20}
                      color={!unlocked ? theme.colors.textLight : isFinal ? '#D97706' : theme.colors.blue}
                    />
                  </View>
                  <View style={styles.info}>
                    <Text style={[styles.title, !unlocked && styles.titleLocked]}>
                      {isFinal ? '🏁 ' : `${index + 1}-${t('exam_label_suffix')} — `}
                      {exam.title}
                    </Text>
                    <Text style={styles.meta}>
                      {unlocked
                        ? t('exams_meta_unlocked').replace('{n}', String(exam.questions.length)).replace('{m}', String(Math.round(exam.durationSeconds / 60)))
                        : t('exams_meta_locked').replace('{n}', String(exam.requiredLessons))}
                    </Text>
                  </View>
                  {result && (
                    <View style={[styles.resultBadge, result.passed ? styles.resultBadgePass : styles.resultBadgeFail]}>
                      <Text style={styles.resultBadgeText}>{result.scorePercent}%</Text>
                    </View>
                  )}
                </View>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={lockedNotice !== null} animationType="fade" transparent onRequestClose={() => setLockedNotice(null)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={styles.dialogBackdropTap} onPress={() => setLockedNotice(null)} />
          {lockedNotice && (
            <View style={styles.dialogCard}>
              <View style={styles.dialogIconWrap}>
                <Ionicons name="lock-closed" size={30} color={theme.colors.textMuted} />
              </View>
              <Text style={styles.dialogTitle}>{t('exams_locked_title')}</Text>
              <Text style={styles.dialogSubtitle}>
                {t('exams_locked_body').replace('{n}', String(lockedNotice.requiredLessons))}
              </Text>
              <Pressable style={styles.dialogConfirmBtn} onPress={() => setLockedNotice(null)}>
                <Text style={styles.dialogConfirmText}>{t('common_tushunarli')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 32, gap: 12 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginBottom: 4, lineHeight: 19 },
  card: {},
  cardLocked: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconWrapLocked: { backgroundColor: theme.colors.bg },
  info: { flex: 1 },
  title: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text },
  titleLocked: { color: theme.colors.textMuted },
  meta: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  resultBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  resultBadgePass: { backgroundColor: theme.colors.successBg },
  resultBadgeFail: { backgroundColor: theme.colors.dangerBg },
  resultBadgeText: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.text },

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
  dialogIconWrap: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg, marginBottom: 4 },
  dialogTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text, textAlign: 'center' },
  dialogSubtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
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
