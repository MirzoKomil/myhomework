/**
 * v2 Imtihonlar (dizayn: 20 · Exams).
 *
 * Ma'lumot eski homework/exams/index.tsx bilan bir xil: imtihonlar ro'yxati
 * va savollar soni — getResolvedExams (CRM'dagi savollar bilan
 * birlashtirilgan), natijalar — examStore. Tugagan darslar soni va bugungi
 * dars — Darslar yo'li bilan bir xil manba (loadCourseData).
 * Imtihonni topshirish ekrani v2'da yo'q — eski /homework/exams/[id] ochiladi.
 */
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Check, LockIcon, MedalIcon } from '@/components/v2/homework/icons';
import { LessonsTop } from '@/components/v2/homework/LessonsTop';
import { LessonsNav, Txt } from '@/components/v2/homework/ui';
import { loadCourseData } from '@/components/v2/lessons/data';
import { studentFeaturesForCourse } from '@/constants/studentFeatures';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { getResolvedExams, type Exam } from '@/data/exams';
import { useExamResults } from '@/services/examStore';

// Har bir oraliq imtihonning rasmi (dizayndagi tartibda).
const EXAM_IMAGES = [
  'cf6928439e1c0659517514deec13bdf1',
  'd9b3ac63886f3fdd8214701a31f0956a',
  '923cb5f22eb2a96192c4a0237a5a922a',
  'e2674814bb72cc679c58ee3db1f36b67',
  '141a620aef9657a3fb8e5d4b36ff7496',
  '299f7862b2d5676f27ef6755ab499960',
] as const;

type Resolved = { exam: Exam; passPercent: number };

export default function ExamsScreen() {
  const results = useExamResults();
  const [exams, setExams] = useState<Resolved[] | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [today, setToday] = useState<number | null>(null);
  const [bonusDot, setBonusDot] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getResolvedExams()
        .then((r) => !cancelled && setExams(r))
        .catch(() => !cancelled && setExams([]));
      loadCourseData()
        .then((d) => {
          if (cancelled || !d) return;
          setDone(d.lessons.filter((l) => l.completed).length);
          setToday(d.activeIndex + 1);
          // Path ekranidagidek: bonus darslar faqat shu kursda bo'lsa nuqta chiqadi.
          setBonusDot(studentFeaturesForCourse(d.lang).bonusLessons);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const list = exams ?? [];
  const intervals = list.filter((e) => e.exam.id !== 'final');
  const final = list.find((e) => e.exam.id === 'final');
  const lessonsDone = done ?? 0;
  const unlocked = (e: Exam) => lessonsDone >= e.requiredLessons;

  // Natijasi bor imtihonlar — yuqorida; birinchi natijasiz imtihon — "keyingi" (qora karta);
  // qolgan natijasizlari — bitta qulflangan guruh.
  const taken = intervals.filter((e) => results[e.exam.id]);
  const rest = intervals.filter((e) => !results[e.exam.id]);
  const next = rest[0];
  const later = rest.slice(1);
  const first = intervals[0];

  const openExam = (e: Exam) => router.push(`/homework/exams/${e.id}` as Href);
  const indexOf = (e: Exam) => intervals.findIndex((x) => x.exam.id === e.id);
  const rangeOf = (e: Exam) => e.rangeLabel;

  return (
    <View style={st.screen}>
      <View style={st.column}>
        <LessonsTop active="exams" done={done} total={72} bonusDot={bonusDot} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
          {first && (
            <View style={st.intro}>
              <Image source={designImages['f07a026d5685a2824d81ed41d407bb3f']} resizeMode="contain" style={{ width: 52, height: 50, flexShrink: 0 }} accessibilityElementsHidden />
              <Txt f="body" size={14} color="#4A5468" lh={19.6} style={{ flex: 1 }}>
                Har {first.exam.requiredLessons} darsdan keyin oraliq imtihon:{' '}
                <Txt f="bodyHeavy" size={14}>
                  {first.exam.questions.length} savol
                </Txt>
                , oʻtish bali{' '}
                <Txt f="bodyHeavy" size={14}>
                  {first.passPercent}%
                </Txt>
                .
              </Txt>
            </View>
          )}

          {taken.map(({ exam }) => {
            const r = results[exam.id];
            const i = indexOf(exam);
            return (
              <Pressable
                key={exam.id}
                accessibilityRole="button"
                onPress={() => (r.passed ? router.push(R.certificates as Href) : openExam(exam))}
                style={({ pressed }) => [st.row, pressed && st.pressed]}
              >
                <View style={[st.iconBox, { backgroundColor: r.passed ? '#E3F7EE' : '#FDECEC' }]}>
                  <Image source={designImages[EXAM_IMAGES[i % EXAM_IMAGES.length]]} resizeMode="contain" style={{ width: 42, height: 42 }} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <Txt f="bodyHeavy" size={15}>
                    {i + 1}-oraliq imtihon
                  </Txt>
                  <Txt f="body" size={13} color="#4A5468">
                    {rangeOf(exam)} · {r.passed ? 'sertifikat ✓' : 'qayta topshirish'}
                  </Txt>
                </View>
                <View style={[st.badge, { backgroundColor: r.passed ? '#E3F7EE' : '#FDECEC' }]}>
                  {r.passed && <Check size={13} color="#087A4A" />}
                  <Txt f="bodyHeavy" size={15} color={r.passed ? '#075E3A' : '#B42318'}>
                    {r.scorePercent}%
                  </Txt>
                </View>
              </Pressable>
            );
          })}

          {next &&
            (() => {
              const e = next.exam;
              const i = indexOf(e);
              const from = e.requiredLessons - 12;
              const inRange = Math.max(0, Math.min(12, lessonsDone - from));
              const left = Math.max(0, e.requiredLessons - lessonsDone);
              const open = unlocked(e);
              return (
                <Pressable accessibilityRole="button" disabled={!open} onPress={() => openExam(e)} style={({ pressed }) => [st.next, pressed && st.pressed]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[st.iconBox, { backgroundColor: '#FFF4D1' }]}>
                      <Image source={designImages[EXAM_IMAGES[i % EXAM_IMAGES.length]]} resizeMode="contain" style={{ width: 42, height: 42 }} />
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Txt f="bodyHeavy" size={16} color="#FFFFFF">
                        {i + 1}-oraliq imtihon
                      </Txt>
                      <Txt f="body" size={13} color="#B8C1D6">
                        {rangeOf(e)} · {e.questions.length} savol
                      </Txt>
                    </View>
                    <Txt f="bodyHeavy" size={14} color="#FFC93C">
                      {open ? 'Ochiq' : `${left} dars qoldi`}
                    </Txt>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: '#26304A', overflow: 'hidden' }}>
                    <View style={{ width: `${(inRange / 12) * 100}%`, height: 8, borderRadius: 4, backgroundColor: '#FFC93C' }} />
                  </View>
                  <Txt f="body" size={13} color="#B8C1D6">
                    {today ? `${today}-dars bugun · ` : ''}
                    {open ? 'imtihonni boshlash mumkin' : `imtihon ${e.requiredLessons}-darsdan keyin ochiladi`}
                  </Txt>
                </Pressable>
              );
            })()}

          {later.length > 0 && (
            <View style={st.row}>
              <View style={{ flexDirection: 'row', flexShrink: 0 }}>
                {later.slice(0, 3).map(({ exam }, k) => (
                  <View key={exam.id} style={[st.stackBox, { marginLeft: k === 0 ? 0 : -10 }]}>
                    <Image
                      source={designImages[EXAM_IMAGES[indexOf(exam) % EXAM_IMAGES.length]]}
                      resizeMode="contain"
                      style={[{ width: 32, height: 32, opacity: 0.75 }, { filter: 'grayscale(0.7)' } as object]}
                    />
                  </View>
                ))}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <Txt f="bodyHeavy" size={15}>
                  {later.length === 1 ? `${indexOf(later[0].exam) + 1}-oraliq imtihon` : `${indexOf(later[0].exam) + 1}–${indexOf(later[later.length - 1].exam) + 1}-oraliq imtihonlar`}
                </Txt>
                <Txt f="body" size={13} color="#4A5468">
                  {later[0].exam.requiredLessons - 11}–{later[later.length - 1].exam.requiredLessons}-darslar
                </Txt>
              </View>
              <LockIcon />
            </View>
          )}

          {final && (
            <Pressable
              accessibilityRole="button"
              disabled={!unlocked(final.exam)}
              onPress={() => openExam(final.exam)}
              style={({ pressed }) => [st.final, pressed && st.pressed]}
            >
              <View style={st.finalIcon}>
                <MedalIcon />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Txt f="bodyHeavy" size={15}>
                  Yakuniy imtihon
                </Txt>
                <Txt f="body" size={13} color="#5C4300">
                  {final.exam.questions.length} savol · {final.exam.requiredLessons}-darsdan keyin
                </Txt>
              </View>
              {results.final ? (
                <Txt f="bodyHeavy" size={15} color={results.final.passed ? '#075E3A' : '#B42318'}>
                  {results.final.scorePercent}%
                </Txt>
              ) : (
                !unlocked(final.exam) && <LockIcon color="#7A5300" />
              )}
            </Pressable>
          )}
        </ScrollView>
        <LessonsNav />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 8 },
  pressed: { opacity: 0.85 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 10, paddingLeft: 10, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 10, borderRadius: 11 },
  next: { backgroundColor: '#0B1220', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  stackBox: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#EEF1F7', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  final: { backgroundColor: '#FFF4D1', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  finalIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F5B70A', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
