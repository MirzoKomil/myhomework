import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { TEACHER_RATING_CRITERIA, TeacherRatingKey } from '@/data/lessonGrades';
import { fetchDemoGrades, LiveGradeEntry, StudentRatingOfTeacher, submitTeacherRating } from '@/services/contentApi';

const CHECK_INTERVAL_MS = 60000;

function StarRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={4}>
          <Ionicons name={i <= value ? 'star' : 'star-outline'} size={22} color={i <= value ? '#D97706' : theme.colors.textLight} />
        </Pressable>
      ))}
    </View>
  );
}

// 142-ish: "Har dars tugaganda ustozni baholash" eslatmasi — appda qaysi
// sahifada bo'lishidan qat'iy nazar, o'quvchi hali baholamagan dars bo'lsa
// shu global oyna avtomatik chiqib turadi (root layout'da bir marta
// mount qilinadi). Modal `onRequestClose` bilan yopilmaydi — faqat baholab
// yuborilgandan keyin o'zi yopiladi.
export function TeacherRatingModal() {
  const [pending, setPending] = useState<LiveGradeEntry | null>(null);
  const [draft, setDraft] = useState<Partial<Record<TeacherRatingKey, number>>>({});
  const [submitting, setSubmitting] = useState(false);
  const checkingRef = useRef(false);

  const checkPending = () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    fetchDemoGrades()
      .then(({ grades }) => {
        const unrated = grades.find((g) => !g.studentRatingOfTeacher);
        setPending((prev) => {
          if (unrated && (!prev || prev.date !== unrated.date)) setDraft({});
          return unrated ?? null;
        });
      })
      .catch(() => {})
      .finally(() => {
        checkingRef.current = false;
      });
  };

  useEffect(() => {
    checkPending();
    const interval = setInterval(checkPending, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const setValue = (key: TeacherRatingKey, value: number) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const complete = TEACHER_RATING_CRITERIA.every((c) => draft[c.key]);

  const onSubmit = () => {
    if (!pending || !complete || submitting) return;
    setSubmitting(true);
    submitTeacherRating(pending.date, draft as StudentRatingOfTeacher)
      .then(() => {
        setPending(null);
        setDraft({});
      })
      .catch(() => {})
      .finally(() => setSubmitting(false));
  };

  if (!pending) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Ustozingizni baholang</Text>
          <Text style={styles.subtitle}>{pending.lessonName}</Text>
          {TEACHER_RATING_CRITERIA.map((c) => (
            <View key={c.key} style={styles.row}>
              <Text style={styles.rowLabel}>{c.label}</Text>
              <StarRow value={draft[c.key] ?? 0} onChange={(v) => setValue(c.key, v)} />
            </View>
          ))}
          <Pressable
            style={[styles.submitBtn, (!complete || submitting) && styles.submitBtnDisabled]}
            disabled={!complete || submitting}
            onPress={onSubmit}>
            <Text style={styles.submitBtnText}>Yuborish</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    padding: 20,
  },
  title: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: theme.colors.text, marginBottom: 4, textAlign: 'center' },
  subtitle: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted, marginBottom: 16, textAlign: 'center' },
  row: { marginBottom: 14 },
  rowLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.text, marginBottom: 6 },
  starsRow: { flexDirection: 'row', gap: 6 },
  submitBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: { backgroundColor: theme.colors.purpleLight },
  submitBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
});
