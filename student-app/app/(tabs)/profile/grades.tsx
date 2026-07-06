import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import {
  ASSISTANT_RATING_CRITERIA,
  AssistantRatingKey,
  GradeCriterionKey,
  TEACHER_GRADE_CRITERIA,
  TEACHER_GRADE_RUBRIC,
  TEACHER_RATING_CRITERIA,
  TeacherRatingKey,
  generateAssistantWeeklyRating,
  generateStudentRatingOfTeacher,
  generateTeacherScores,
} from '@/data/lessonGrades';
import { grades } from '@/data/mock';
import { UZ_MONTHS, generateScheduleDays } from '@/data/scheduleCalendar';

function formatShortDate(d: Date): string {
  return `${d.getDate()}-${UZ_MONTHS[d.getMonth()].toLowerCase().slice(0, 3)}`;
}

function Dots({ value, max = 5, color }: { value: number; max?: number; color: string }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: max }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: i < value ? color : theme.colors.border }]} />
      ))}
    </View>
  );
}

function StarRow({
  value,
  onChange,
}: {
  value: number;
  onChange?: (v: number) => void;
}) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} disabled={!onChange} onPress={() => onChange?.(i)} hitSlop={4}>
          <Ionicons name={i <= value ? 'star' : 'star-outline'} size={20} color={i <= value ? '#D97706' : theme.colors.textLight} />
        </Pressable>
      ))}
    </View>
  );
}

export default function GradesScreen() {
  const average = Math.round(grades.reduce((sum, g) => sum + g.score, 0) / grades.length);
  const [showRubric, setShowRubric] = useState(false);

  const [scheduleDays] = useState(() => generateScheduleDays());
  const liveLessons = useMemo(
    () => scheduleDays.filter((d) => d.type === 'live' && d.isPast).sort((a, b) => b.date.getTime() - a.date.getTime()),
    [scheduleDays]
  );
  const recentUnratedIds = useMemo(() => new Set(liveLessons.slice(0, 2).map((d) => d.dayNumber)), [liveLessons]);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [studentRatings, setStudentRatings] = useState<Record<number, Record<TeacherRatingKey, number>>>(() => {
    const seeded: Record<number, Record<TeacherRatingKey, number>> = {};
    liveLessons.forEach((d) => {
      if (!recentUnratedIds.has(d.dayNumber)) seeded[d.dayNumber] = generateStudentRatingOfTeacher(d.dayNumber);
    });
    return seeded;
  });
  const [drafts, setDrafts] = useState<Record<number, Partial<Record<TeacherRatingKey, number>>>>({});

  const toggleExpanded = (dayNumber: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dayNumber)) next.delete(dayNumber);
      else next.add(dayNumber);
      return next;
    });
  };

  const setDraftValue = (dayNumber: number, key: TeacherRatingKey, value: number) => {
    setDrafts((prev) => ({ ...prev, [dayNumber]: { ...prev[dayNumber], [key]: value } }));
  };

  const submitRating = (dayNumber: number) => {
    const draft = drafts[dayNumber];
    if (!draft) return;
    const complete = TEACHER_RATING_CRITERIA.every((c) => draft[c.key]);
    if (!complete) return;
    setStudentRatings((prev) => ({ ...prev, [dayNumber]: draft as Record<TeacherRatingKey, number> }));
  };

  const completedSundays = useMemo(
    () => scheduleDays.filter((d) => d.type === 'bonus' && d.isPast).sort((a, b) => b.date.getTime() - a.date.getTime()),
    [scheduleDays]
  );
  const pendingWeekId = completedSundays[0]?.dayNumber;
  const [assistantRatings, setAssistantRatings] = useState<Record<number, Record<AssistantRatingKey, number>>>(() => {
    const seeded: Record<number, Record<AssistantRatingKey, number>> = {};
    completedSundays.slice(1).forEach((d) => {
      seeded[d.dayNumber] = generateAssistantWeeklyRating(d.dayNumber);
    });
    return seeded;
  });
  const [assistantDraft, setAssistantDraft] = useState<Partial<Record<AssistantRatingKey, number>>>({});

  const submitAssistantRating = () => {
    if (pendingWeekId === undefined) return;
    const complete = ASSISTANT_RATING_CRITERIA.every((c) => assistantDraft[c.key]);
    if (!complete) return;
    setAssistantRatings((prev) => ({ ...prev, [pendingWeekId]: assistantDraft as Record<AssistantRatingKey, number> }));
    setAssistantDraft({});
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Baholar"
        showBack
        rightAction={
          <Pressable style={styles.infoBtn} onPress={() => setShowRubric(true)} hitSlop={8}>
            <Ionicons name="information-circle-outline" size={22} color={theme.colors.textMuted} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.averageCard}>
          <Text style={styles.averageLabel}>O'rtacha ball</Text>
          <Text style={styles.averageValue}>{average}</Text>
          <Text style={styles.averageMax}>/ 100</Text>
        </Card>

        {grades.map((grade) => (
          <Card key={grade.subject} style={styles.gradeCard}>
            <View style={styles.gradeRow}>
              <Text style={styles.subject}>{grade.subject}</Text>
              <Text style={styles.score}>
                {grade.score}
                <Text style={styles.max}> / {grade.max}</Text>
              </Text>
            </View>
            <ProgressBar progress={(grade.score / grade.max) * 100} />
          </Card>
        ))}

        <Text style={styles.sectionTitle}>Jonli darslar baholari</Text>
        <Text style={styles.sectionSubtitle}>
          Har bir o'tgan jonli darsdan so'ng ustozingiz sizni 5 ta mezon bo'yicha baholaydi. Har bir ball — 1 coin.
        </Text>

        {liveLessons.map((lesson) => {
          const scores = generateTeacherScores(lesson.dayNumber);
          const totalCoins = TEACHER_GRADE_CRITERIA.reduce((sum, c) => sum + scores[c.key as GradeCriterionKey], 0);
          const isOpen = expanded.has(lesson.dayNumber);
          const rated = studentRatings[lesson.dayNumber];
          const draft = drafts[lesson.dayNumber] ?? {};
          const draftComplete = TEACHER_RATING_CRITERIA.every((c) => draft[c.key]);

          return (
            <Card key={lesson.dayNumber} style={styles.lessonCard}>
              <Pressable style={styles.lessonHeader} onPress={() => toggleExpanded(lesson.dayNumber)}>
                <View style={styles.lessonHeaderInfo}>
                  <Text style={styles.lessonDate}>{formatShortDate(lesson.date)}</Text>
                  <Text style={styles.lessonTopic}>{lesson.topic}</Text>
                </View>
                <View style={styles.coinBadge}>
                  <CoinIcon size={13} />
                  <Text style={styles.coinBadgeText}>
                    {totalCoins}/{TEACHER_GRADE_CRITERIA.length * 5}
                  </Text>
                </View>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textLight} />
              </Pressable>

              {isOpen && (
                <View style={styles.lessonBody}>
                  {TEACHER_GRADE_CRITERIA.map((c) => (
                    <View key={c.key} style={styles.criterionRow}>
                      <Text style={styles.criterionLabel}>{c.label}</Text>
                      <Dots value={scores[c.key]} color={theme.colors.warning} />
                    </View>
                  ))}

                  <View style={styles.divider} />
                  <Text style={styles.rateTeacherTitle}>Siz ustozni baholang</Text>

                  {rated ? (
                    TEACHER_RATING_CRITERIA.map((c) => (
                      <View key={c.key} style={styles.criterionRow}>
                        <Text style={styles.criterionLabel}>{c.label}</Text>
                        <StarRow value={rated[c.key]} />
                      </View>
                    ))
                  ) : (
                    <>
                      {TEACHER_RATING_CRITERIA.map((c) => (
                        <View key={c.key} style={styles.ratingInputBlock}>
                          <Text style={styles.criterionLabel}>{c.label}</Text>
                          <Text style={styles.ratingQuestion}>{c.question}</Text>
                          <StarRow value={draft[c.key] ?? 0} onChange={(v) => setDraftValue(lesson.dayNumber, c.key, v)} />
                        </View>
                      ))}
                      <Pressable
                        style={[styles.submitBtn, !draftComplete && styles.submitBtnDisabled]}
                        disabled={!draftComplete}
                        onPress={() => submitRating(lesson.dayNumber)}>
                        <Text style={styles.submitBtnText}>Baholarni yuborish</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}
            </Card>
          );
        })}

        <Text style={styles.sectionTitle}>Yordamchi ustozni haftalik baholash</Text>
        <Text style={styles.sectionSubtitle}>Har yakshanba, hafta yakunlangach, yordamchi ustozingizni baholaysiz.</Text>

        {pendingWeekId !== undefined && !assistantRatings[pendingWeekId] && (
          <Card style={styles.lessonCard}>
            <Text style={styles.rateTeacherTitle}>Bu haftalik ishlash uchun baholang</Text>
            {ASSISTANT_RATING_CRITERIA.map((c) => (
              <View key={c.key} style={styles.ratingInputBlock}>
                <Text style={styles.criterionLabel}>{c.label}</Text>
                <Text style={styles.ratingQuestion}>{c.question}</Text>
                <StarRow value={assistantDraft[c.key] ?? 0} onChange={(v) => setAssistantDraft((prev) => ({ ...prev, [c.key]: v }))} />
              </View>
            ))}
            <Pressable
              style={[styles.submitBtn, !ASSISTANT_RATING_CRITERIA.every((c) => assistantDraft[c.key]) && styles.submitBtnDisabled]}
              disabled={!ASSISTANT_RATING_CRITERIA.every((c) => assistantDraft[c.key])}
              onPress={submitAssistantRating}>
              <Text style={styles.submitBtnText}>Baholarni yuborish</Text>
            </Pressable>
          </Card>
        )}

        {completedSundays.map((week) => {
          const rating = assistantRatings[week.dayNumber];
          if (!rating) return null;
          const weekStart = new Date(week.date);
          weekStart.setDate(weekStart.getDate() - 6);
          return (
            <Card key={week.dayNumber} style={styles.lessonCard}>
              <Text style={styles.lessonDate}>
                {formatShortDate(weekStart)} — {formatShortDate(week.date)}
              </Text>
              <View style={{ marginTop: 10, gap: 8 }}>
                {ASSISTANT_RATING_CRITERIA.map((c) => (
                  <View key={c.key} style={styles.criterionRow}>
                    <Text style={styles.criterionLabel}>{c.label}</Text>
                    <StarRow value={rating[c.key]} />
                  </View>
                ))}
              </View>
            </Card>
          );
        })}
      </ScrollView>

      <Modal visible={showRubric} animationType="slide" transparent onRequestClose={() => setShowRubric(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropTap} onPress={() => setShowRubric(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Baholash mezonlari</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.rubricIntro}>
                Ustoz har bir jonli darsdan so'ng quyidagi 5 ta mezonni 1 dan 5 gacha baholaydi. Har bir 🟡 = 1 coin. Dars
                yakunida jami 5 tadan 25 tagacha coin to'plash mumkin.
              </Text>
              {TEACHER_GRADE_CRITERIA.map((c) => {
                const rubric = TEACHER_GRADE_RUBRIC[c.key];
                return (
                  <View key={c.key} style={styles.rubricBlock}>
                    <Text style={styles.rubricLabel}>{c.label}</Text>
                    <Text style={styles.rubricQuestion}>{rubric.question}</Text>
                    {rubric.levels.map((level, i) => (
                      <Text key={i} style={styles.rubricLevel}>
                        {'🟡'.repeat(i + 1)} — {level}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </ScrollView>
            <Pressable style={styles.submitBtn} onPress={() => setShowRubric(false)}>
              <Text style={styles.submitBtnText}>Tushunarli</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, gap: 12, paddingBottom: 40 },
  infoBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },

  averageCard: { alignItems: 'center', marginBottom: 8 },
  averageLabel: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted },
  averageValue: { fontFamily: theme.fonts.extraBold, fontSize: 48, color: theme.colors.purple, marginTop: 4 },
  averageMax: { fontFamily: theme.fonts.regular, fontSize: 16, color: theme.colors.textMuted },
  gradeCard: {},
  gradeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  subject: { fontFamily: theme.fonts.semiBold, fontSize: 16, color: theme.colors.text },
  score: { fontFamily: theme.fonts.bold, fontSize: 18, color: theme.colors.purple },
  max: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted },

  sectionTitle: { fontFamily: theme.fonts.extraBold, fontSize: 16, color: theme.colors.text, marginTop: 12 },
  sectionSubtitle: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginBottom: 4, lineHeight: 17 },

  lessonCard: {},
  lessonHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lessonHeaderInfo: { flex: 1 },
  lessonDate: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.text },
  lessonTopic: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  coinBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.warningBg, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  coinBadgeText: { fontFamily: theme.fonts.bold, fontSize: 11, color: '#B45309' },

  lessonBody: { marginTop: 16, gap: 10 },
  criterionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  criterionLabel: { flex: 1, fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.text },
  dotsRow: { flexDirection: 'row', gap: 4 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  starsRow: { flexDirection: 'row', gap: 3 },

  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 14 },
  rateTeacherTitle: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.text, marginBottom: 10 },
  ratingInputBlock: { gap: 4, marginBottom: 12 },
  ratingQuestion: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textMuted },

  submitBtn: { backgroundColor: theme.colors.purple, borderRadius: theme.radius.sm, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBackdropTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: theme.colors.text, marginBottom: 10 },
  rubricIntro: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, lineHeight: 19, marginBottom: 16 },
  rubricBlock: { marginBottom: 18 },
  rubricLabel: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.purple, marginBottom: 3 },
  rubricQuestion: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginBottom: 6, lineHeight: 17 },
  rubricLevel: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.text, marginBottom: 3, lineHeight: 17 },
});
