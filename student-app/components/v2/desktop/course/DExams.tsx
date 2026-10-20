/**
 * Kompyuter: Imtihonlar (dizayn: D_Exams.dc.html).
 *
 * Ma'lumot mobil Imtihonlar ekrani bilan bir xil: imtihonlar va savollar
 * soni — getResolvedExams, natijalar — examStore, tugagan darslar va
 * bugungi dars — loadCourseData. "bugun N ta takrorlash" — WordReview
 * seansining o'zi (buildSession), Darslar yo'lidagi kabi.
 * Imtihonni topshirish — eski /homework/exams/[id] (mobil ekrandagi kabi).
 */
import { router, useFocusEffect, type Href } from 'expo-router';
import { Children, useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { buildSession, loadReviews } from '@/components/v2/home/reviewStore';
import { EXAM_INTERVAL, loadCourseData } from '@/components/v2/lessons/data';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { getResolvedExams, type Exam } from '@/data/exams';
import { useExamResults } from '@/services/examStore';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

import { DesktopPage } from '../Shell';
import { go, IArrow, ICheck, IChevron, ILock, IMedal, LessonTabs, PageTitle, T } from './ui';

// Mobil ekrandagi rasmlar (indeks bo'yicha).
const PASSED_IMAGE = 'cf6928439e1c0659517514deec13bdf1';
const NEXT_IMAGE = 'd9b3ac63886f3fdd8214701a31f0956a';
const EXAM_IMAGES = [
  'cf6928439e1c0659517514deec13bdf1',
  'd9b3ac63886f3fdd8214701a31f0956a',
  '923cb5f22eb2a96192c4a0237a5a922a',
  'e2674814bb72cc679c58ee3db1f36b67',
  '141a620aef9657a3fb8e5d4b36ff7496',
  '299f7862b2d5676f27ef6755ab499960',
] as const;

type Resolved = { exam: Exam; passPercent: number };

export function DExams() {
  const results = useExamResults();
  const [exams, setExams] = useState<Resolved[] | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [today, setToday] = useState<number | null>(null);
  const [lessonWords, setLessonWords] = useState<number[]>([]);
  const [reviewToday, setReviewToday] = useState(0);

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
          setLessonWords(d.lessons.map((l) => l.content.vocabulary.length));
          setToday(d.activeIndex + 1);
        })
        .catch(() => {});
      Promise.all([getAccumulatedVocabulary(), loadReviews()])
        .then(([w, r]) => !cancelled && setReviewToday(buildSession(w, r).length))
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
  const taken = intervals.filter((e) => results[e.exam.id]);
  const rest = intervals.filter((e) => !results[e.exam.id]);
  const next = rest[0];
  const later = rest.slice(1);
  const first = intervals[0];
  const passedCount = list.filter((e) => results[e.exam.id]?.passed).length;

  const openExam = (e: Exam) => router.push(`/homework/exams/${e.id}` as Href);
  const indexOf = (e: Exam) => intervals.findIndex((x) => x.exam.id === e.id);

  return (
    <DesktopPage title="Darslar" titleSlot={<PageTitle title="Darslar" sub={done === null ? undefined : `${done} / 72 tugadi`} />} contentStyle={s.content}>
      <View style={s.topRow}>
        <LessonTabs active="exams" bonusDot />
        {first && (
          <View style={s.intro}>
            <Image source={designImages.f07a026d5685a2824d81ed41d407bb3f} style={{ width: 54, height: 54 }} resizeMode="contain" />
            <T f="body" size={16} color="#34405A" style={{ flexShrink: 1 }}>
              Har {first.exam.requiredLessons} darsdan keyin oraliq imtihon: <T size={16}>{first.exam.questions.length} savol</T>, oʻtish bali{' '}
              <T size={16}>{first.passPercent}%</T>.
            </T>
          </View>
        )}
      </View>

      {next && (
        <View style={s.heroRow}>
          <NextCard r={next} no={indexOf(next.exam) + 1} done={lessonsDone} today={today} open={unlocked(next.exam)} onOpen={() => openExam(next.exam)} />
          <PrepCard r={next} no={indexOf(next.exam) + 1} done={lessonsDone} lessonWords={lessonWords} reviewToday={reviewToday} />
        </View>
      )}

      <View style={s.listHead}>
        <T size={19} accessibilityRole="header">
          Barcha imtihonlar
        </T>
        <T f="bodyBold" size={14} color="#4A5468">
          {list.length} ta imtihon · {passedCount} tasi topshirildi
        </T>
      </View>

      <Grid>
        {taken.map(({ exam }) => {
          const r = results[exam.id];
          const i = indexOf(exam);
          const tint = r.passed ? '#E3F7EE' : '#FDECEC';
          return (
            <Pressable
              key={exam.id}
              accessibilityRole="link"
              accessibilityLabel={r.passed ? `${i + 1}-oraliq imtihon sertifikatlari` : undefined}
              onPress={() => (r.passed ? go(R.certificates) : openExam(exam))}
              style={({ pressed }) => [s.card, s.cell, pressed && s.pressed]}
            >
              <View style={[s.icon76, { backgroundColor: tint }]}>
                <Image source={designImages[PASSED_IMAGE]} style={{ width: 66, height: 66 }} resizeMode="contain" />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <T size={18}>{i + 1}-oraliq imtihon</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <T f="body" size={14} color="#4A5468">
                    {exam.rangeLabel} · {r.passed ? 'sertifikat' : 'qayta topshirish'}
                  </T>
                  {r.passed && <ICheck size={14} color="#4A5468" sw={2.6} />}
                </View>
              </View>
              <View style={[s.score, { backgroundColor: tint }]}>
                {r.passed && <ICheck size={16} color="#075E3A" sw={3} />}
                <T size={19} color={r.passed ? '#075E3A' : '#B42318'}>
                  {r.scorePercent}%
                </T>
              </View>
              <IChevron size={18} color="#5B6478" sw={2.4} />
            </Pressable>
          );
        })}

        {later.length > 0 && (
          <View style={[s.card, s.cell, { gap: 16 }]}>
            <View style={{ flexDirection: 'row', flexShrink: 0 }}>
              {later.slice(0, 3).map(({ exam }) => (
                <View key={exam.id} style={s.stackBox}>
                  <Image source={designImages[EXAM_IMAGES[indexOf(exam) % EXAM_IMAGES.length]]} style={{ width: 46, height: 46, opacity: 0.8 }} resizeMode="contain" />
                </View>
              ))}
            </View>
            <View style={{ flex: 1, minWidth: 0, marginLeft: 12, gap: 3 }}>
              <T size={18}>
                {later.length === 1
                  ? `${indexOf(later[0].exam) + 1}-oraliq imtihon`
                  : `${indexOf(later[0].exam) + 1}–${indexOf(later[later.length - 1].exam) + 1}-oraliq imtihonlar`}
              </T>
              <T f="body" size={14} color="#4A5468">
                {later[0].exam.requiredLessons - (EXAM_INTERVAL - 1)}–{later[later.length - 1].exam.requiredLessons}-darslar
              </T>
            </View>
            <ILock size={20} color="#5B6478" sw={2.2} />
          </View>
        )}

        {final && (
          <Pressable
            accessibilityRole="button"
            disabled={!unlocked(final.exam)}
            onPress={() => openExam(final.exam)}
            style={({ pressed }) => [s.card, s.cell, { backgroundColor: '#FFF4D1' }, pressed && s.pressed]}
          >
            <View style={[s.icon76, { borderRadius: 18, backgroundColor: '#F5B70A' }]}>
              <IMedal />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <T size={18}>Yakuniy imtihon</T>
              <T f="body" size={14} color="#6B4800">
                {final.exam.questions.length} savol · {final.exam.requiredLessons}-darsdan keyin
              </T>
            </View>
            {results.final ? (
              <T size={19} color={results.final.passed ? '#075E3A' : '#B42318'}>
                {results.final.scorePercent}%
              </T>
            ) : (
              !unlocked(final.exam) && <ILock size={20} color="#7A5300" sw={2.2} />
            )}
          </Pressable>
        )}
      </Grid>
    </DesktopPage>
  );
}

/** 2 ustunli to'r (oraliq 16): qatorlarga bo'linadi, toq bo'lsa oxirida bo'sh joy. */
function Grid({ children }: { children: React.ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={{ gap: 16 }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 16 }}>
          {r}
          {r.length === 1 && <View style={s.cell} />}
        </View>
      ))}
    </View>
  );
}

function NextCard({ r, no, done, today, open, onOpen }: { r: Resolved; no: number; done: number; today: number | null; open: boolean; onOpen: () => void }) {
  const e = r.exam;
  const from = e.requiredLessons - (EXAM_INTERVAL - 1);
  // Mobil ekrandagidek: bugungi darsdan imtihon darsigacha qolgan darslar (36 − 32 = 4).
  const left = Math.max(0, e.requiredLessons - (today ?? done));
  const nums = Array.from({ length: EXAM_INTERVAL }, (_, k) => from + k);
  const todayLabel = today && today >= from && today <= e.requiredLessons ? `, ${today}-dars bugun` : '';
  return (
    <Pressable accessibilityRole="button" disabled={!open} onPress={onOpen} style={s.next}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <View style={s.nextIcon}>
          <Image source={designImages[NEXT_IMAGE]} style={{ width: 72, height: 72 }} resizeMode="contain" />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <T f="display" size={30} lh={36} ls={-0.6} color="#FFFFFF">
            {no}-oraliq imtihon
          </T>
          <T f="bodyBold" size={16} color="#B8C1D6">
            {e.rangeLabel} · {e.questions.length} savol
          </T>
        </View>
        <T size={22} color="#FFC93C">
          {open ? 'Ochiq' : `${left} dars qoldi`}
        </T>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[`${e.questions.length} savol`, `Oʻtish bali ${r.passPercent}%`, 'Sertifikat'].map((c) => (
          <View key={c} style={s.chip}>
            <T f="bodyBold" size={14} color="#DCE2EE">
              {c}
            </T>
          </View>
        ))}
      </View>
      <View accessibilityLabel={`${e.rangeLabel}: ${done}-dars tugadi${todayLabel}`} style={{ flexDirection: 'row', gap: 6, marginTop: 'auto' }}>
        {nums.map((n) => {
          const isDone = n <= done;
          const isToday = !isDone && n === today;
          return (
            <View key={n} style={{ flex: 1, alignItems: 'center', gap: 7 }}>
              <View style={[s.seg, { backgroundColor: isDone ? '#FFC93C' : '#2B3550' }]}>{isToday && <View style={s.segHalf} />}</View>
              <T size={12} color={isDone ? '#FFC93C' : isToday ? '#FFFFFF' : '#8792AA'}>
                {n}
              </T>
            </View>
          );
        })}
      </View>
      <T f="bodyBold" size={15} color="#B8C1D6">
        {today ? `${today}-dars bugun · ` : ''}
        {open ? 'imtihonni boshlash mumkin' : `imtihon ${e.requiredLessons}-darsdan keyin ochiladi`}
      </T>
    </Pressable>
  );
}

function PrepCard({ r, no, done, lessonWords, reviewToday }: { r: Resolved; no: number; done: number; lessonWords: number[]; reviewToday: number }) {
  // Navbatdagi imtihon oralig'idagi o'tilgan darslar (masalan 25–31) va ulardagi so'zlar.
  const from = r.exam.requiredLessons - (EXAM_INTERVAL - 1);
  const to = Math.min(r.exam.requiredLessons, Math.max(from, done));
  const words = lessonWords.slice(from - 1, to).reduce((a, n) => a + n, 0);
  return (
    <Pressable accessibilityRole="link" onPress={() => go(R.wordReview)} style={({ pressed }) => [s.prep, pressed && s.pressed]}>
      <View style={s.prepIcon}>
        <Image source={designImages.f7ed25f8b468b4cb6172a58adcd09f1f} style={{ width: 62, height: 62 }} resizeMode="contain" />
      </View>
      <T size={20}>{no}-imtihonga tayyorgarlik</T>
      <T f="body" size={15} color="#4A5468" lh={21.75}>
        {from === to ? `${from}-dars` : `${from}–${to}-darslar`} · {words} ta soʻz · bugun {reviewToday} ta takrorlash
      </T>
      <View style={s.prepBtn}>
        <T size={15} color="#FFFFFF">
          Takrorlash
        </T>
        <IArrow size={16} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 32, gap: 16 },
  pressed: { opacity: 0.9 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  heroRow: { flexDirection: 'row', gap: 20, height: 300 },
  next: { flex: 1, minWidth: 0, overflow: 'hidden', backgroundColor: '#0B1220', borderRadius: 28, paddingVertical: 26, paddingHorizontal: 30, gap: 16 },
  nextIcon: { width: 84, height: 84, borderRadius: 22, backgroundColor: '#FFF4D1', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chip: { height: 34, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#1B2438', justifyContent: 'center' },
  seg: { width: '100%', height: 12, borderRadius: 6, overflow: 'hidden' },
  // Bugungi dars: chap yarmi sariq (dizayndagi linear-gradient 50%).
  segHalf: { width: '50%', height: 12, backgroundColor: '#FFC93C' },
  prep: { width: 380, flexShrink: 0, backgroundColor: '#F0EBFF', borderRadius: 28, paddingVertical: 22, paddingHorizontal: 24, gap: 12 },
  prepIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  prepBtn: { marginTop: 'auto', alignSelf: 'flex-start', height: 44, paddingHorizontal: 18, borderRadius: 14, backgroundColor: '#6A3CF0', flexDirection: 'row', alignItems: 'center', gap: 8 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cell: { flex: 1, minWidth: 0 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingTop: 30, paddingBottom: 30, paddingRight: 24, paddingLeft: 22, flexDirection: 'row', alignItems: 'center', gap: 18 },
  icon76: { width: 76, height: 76, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  score: { height: 44, paddingHorizontal: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  // content-box: 64 + 2×3 chegara.
  stackBox: { width: 70, height: 70, borderRadius: 18, backgroundColor: '#EEF1F7', borderWidth: 3, borderColor: '#FFFFFF', marginRight: -14, alignItems: 'center', justifyContent: 'center' },
});
