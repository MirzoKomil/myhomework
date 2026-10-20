/**
 * Kompyuter: Darslar yo'li (dizayn: D_Path.dc.html).
 *
 * Ma'lumot mobil Darslar ekrani bilan bir xil: loadCourseData (qulf, foiz),
 * demo-grades (baho), demo-schedule (sanalar), vazifa natijalari (scoreStore).
 * O'ng ustun: oylar holati — o'sha darslar ro'yxatidan; oraliq imtihon va
 * tayyorgarlik — Imtihonlar ekranidagi hisob (getResolvedExams, examStore,
 * darslar lug'ati); "bugun N ta takrorlash" — WordReview seansining o'zi
 * (buildSession); "Yaqin darslar" — jadval sanalari + navbatdagi bonus dars.
 * Bonus vaqti va coin'i serverda yo'q — soat ko'rsatilmaydi, "+0 coin".
 */
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useHomeworkScores } from '@/components/v2/homework/scoreStore';
import { BONUS_LESSONS } from '@/components/v2/homework/bonusData';
import { buildSession, loadReviews } from '@/components/v2/home/reviewStore';
import {
  EXAM_INTERVAL,
  getAudioTracks,
  homeworkSummary,
  learnedWordIds,
  lessonSteps,
  loadCourseData,
  MONTH_SIZE,
  pad,
  scheduleDates,
  shortDay,
  splitTitle,
  stepsDone,
  useListened,
  useSeenWords,
  whenLabel,
  type CourseData,
  type LessonInfo,
} from '@/components/v2/lessons/data';
import { LessonLockedPopup } from '@/components/v2/popups/LessonLocked';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { getResolvedExams, type Exam } from '@/data/exams';
import { fetchDemoGrades, fetchDemoSchedule, type LiveGradeEntry } from '@/services/contentApi';
import { useLessonCoins } from '@/services/coinsStore';
import { useExamResults } from '@/services/examStore';
import { useCachedState } from '@/services/v2Cache';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

import { DesktopPage } from '../Shell';
import { IArrow, ICheck, IChevron, IFlag, ILock, IPencil, IPlay, T } from './ui';

// Mobil ekrandagi kabi: oy nomlari serverda yo'q — dizayndagi nomlar.
const MONTH_TITLES: Record<number, string> = { 1: 'Tanishuv', 2: 'Kundalik hayot' };
const DAY_SHORT = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
const STEP_NAMES = ['Yangi soʻzlar', 'Audio dialoglar', '', 'Uyga vazifa', 'Darsni yakunlash'];

const go = (h: string) => router.push(h as Href);

type Resolved = { exam: Exam; passPercent: number };

export function DPath() {
  const [data, setData] = useCachedState<CourseData | null>('darslar.data', null);
  const [error, setError] = useState(false);
  const [grades, setGrades] = useCachedState<LiveGradeEntry[]>('darslar.grades', []);
  const [schedule, setSchedule] = useCachedState<{ startsAt: Date | null; pattern: 'mwf' | 'tts' }>('darslar.schedule', { startsAt: null, pattern: 'mwf' });
  const [exams, setExams] = useState<Resolved[]>([]);
  const [reviewToday, setReviewToday] = useState(0);
  const results = useExamResults();
  const scores = useHomeworkScores();
  const { popup } = useLocalSearchParams<{ popup?: string }>();
  const [lockedIdx, setLockedIdx] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrolled = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadCourseData()
        .then((d) => !cancelled && setData(d))
        .catch(() => !cancelled && setError(true));
      fetchDemoGrades().then((g) => !cancelled && setGrades(g.grades)).catch(() => {});
      fetchDemoSchedule()
        .then((s) => !cancelled && setSchedule({ startsAt: s.startsAt ? new Date(s.startsAt) : null, pattern: s.schedulePattern }))
        .catch(() => {});
      getResolvedExams()
        .then((r) => !cancelled && setExams(r))
        .catch(() => {});
      Promise.all([getAccumulatedVocabulary(), loadReviews()])
        .then(([w, r]) => !cancelled && setReviewToday(buildSession(w, r).length))
        .catch(() => {});
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const lessons = data?.lessons ?? [];
  const active = data ? lessons[data.activeIndex] : undefined;
  const doneCount = lessons.filter((l) => l.completed).length;
  const total = lessons.length || 72;
  const monthNo = active ? Math.floor(active.index / MONTH_SIZE) + 1 : 1;
  const monthStart = (monthNo - 1) * MONTH_SIZE;
  const monthLessons = lessons.slice(monthStart, monthStart + MONTH_SIZE);
  const monthDone = monthLessons.filter((l) => l.completed).length;
  const examAfter = active ? Math.ceil(active.number / EXAM_INTERVAL) * EXAM_INTERVAL : EXAM_INTERVAL;
  const dates = schedule.startsAt && data ? scheduleDates(schedule.startsAt, schedule.pattern, data.activeIndex, monthStart + MONTH_SIZE) : {};
  const scrollTarget = active ? Math.max(monthStart, active.index - 2) : -1;
  const lockedLesson = lockedIdx !== null ? lessons[lockedIdx] : undefined;
  const firstLocked = data ? lessons.find((l) => l.index > data.activeIndex && l.locked) : undefined;

  // ?popup=locked — oynani to'g'ridan-to'g'ri ochish (mobil ekrandagi kabi).
  useEffect(() => {
    if (popup !== 'locked' || !data) return;
    const first = data.lessons.find((l) => l.index > data.activeIndex && l.locked);
    if (first) setLockedIdx(first.index);
  }, [popup, data]);

  const intervals = exams.filter((e) => e.exam.id !== 'final');
  const examFor = (n: number) => intervals.find((e) => e.exam.requiredLessons === n);
  const examNo = (e: Exam) => intervals.findIndex((x) => x.exam.id === e.id) + 1;
  const nextExam = intervals.find((e) => !results[e.exam.id]);

  // Yo'l qatorlari: darslar + har 12-darsdan keyin oraliq imtihon.
  type Row = { kind: 'lesson'; l: LessonInfo } | { kind: 'exam'; e: Resolved; after: number };
  const rows: Row[] = [];
  monthLessons.forEach((l) => {
    rows.push({ kind: 'lesson', l });
    const e = l.number % EXAM_INTERVAL === 0 ? examFor(l.number) : undefined;
    if (e) rows.push({ kind: 'exam', e, after: l.number });
  });
  // Qator ostidagi chiziq rangi: tugagan → tugagan yashil, tugagan → joriy ko'k, qolgani kulrang.
  const lineAfter = (i: number) => {
    const a = rows[i];
    const b = rows[i + 1];
    if (!a || !b || a.kind !== 'lesson' || !a.l.completed || b.kind !== 'lesson') return '#E2E6EE';
    if (b.l.completed) return '#087A4A';
    if (data && b.l.index === data.activeIndex) return '#2F5BFF';
    return '#E2E6EE';
  };

  return (
    <DesktopPage
      title="Darslar"
      scroll={false}
      // Ichki ro'yxat o'zi aylanadi — kontent bloki oyna balandligidan oshmasin.
      contentStyle={{ flex: 1, minHeight: 0 }}
      titleSlot={
        <View style={{ gap: 2, minWidth: 0 }}>
          <T f="display" size={28} lh={30.8} ls={-0.56} style={{ color: '#0B1220' }}>
            Darslar
          </T>
          <T f="bodyBold" size={14} color="#4A5468">
            {doneCount} / {total} tugadi
          </T>
        </View>
      }
      actions={<SectionTabs />}
    >
      <View style={s.body}>
        <View style={s.main}>
          {data && (
            <View accessibilityLabel={`${monthNo}-oy`} style={s.month}>
              <View style={s.monthIcon}>
                <Image source={designImages.d9b3ac63886f3fdd8214701a31f0956a} style={{ width: 58, height: 56 }} resizeMode="contain" />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <T size={19} color="#FFFFFF" lines={1} style={{ flexShrink: 1 }}>
                    {monthNo}-oy{MONTH_TITLES[monthNo] ? ` · ${MONTH_TITLES[monthNo]}` : ''} ({monthStart + 1}–{monthStart + monthLessons.length})
                  </T>
                  <T size={14} color="#7FE0AE">
                    {monthDone} / {monthLessons.length} dars
                  </T>
                </View>
                <View style={s.monthTrack}>
                  <View style={[s.monthFill, { width: `${Math.round((monthDone / Math.max(1, monthLessons.length)) * 100)}%` }]} />
                </View>
                <T f="bodyBold" size={13} color="#B8C1D6">
                  {monthDone} / {monthLessons.length} dars · imtihon {examAfter}-darsdan keyin
                </T>
              </View>
            </View>
          )}
          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingLeft: 4 }} showsVerticalScrollIndicator={false}>
            {error && !data ? (
              <T f="body" size={14} color="#4A5468">
                Darslarni yuklab boʻlmadi. Internetni tekshirib, qayta urinib koʻring.
              </T>
            ) : !data ? (
              <T f="body" size={14} color="#4A5468">
                Yuklanmoqda…
              </T>
            ) : (
              <View accessibilityRole="list" accessibilityLabel="Darslar">
                {rows.map((r, i) => {
                  const top = i === 0 ? null : lineAfter(i - 1);
                  const bottom = i === rows.length - 1 ? null : lineAfter(i);
                  const key = r.kind === 'lesson' ? r.l.id : `exam-${r.after}`;
                  return (
                    <View
                      key={key}
                      onLayout={(e) => {
                        if (r.kind === 'lesson' && r.l.index === scrollTarget && !scrolled.current) {
                          scrolled.current = true;
                          const y = e.nativeEvent.layout.y;
                          // Kontent o'lchami yangilangach suriladi (aks holda brauzer 0 ga qaytaradi).
                          if (y > 0) setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 50);
                        }
                      }}
                    >
                      {r.kind === 'exam' ? (
                        <ExamRow r={r.e} after={r.after} no={examNo(r.e.exam)} top={top} />
                      ) : (
                        <LessonRow
                          lesson={r.l}
                          data={data}
                          top={top}
                          bottom={bottom}
                          grade={grades.find((g) => g.lessonId === r.l.id)}
                          date={dates[r.l.index]}
                          score={scores[r.l.id]}
                          scoresAll={scores}
                          chevron={r.l.id === firstLocked?.id}
                          onLocked={() => setLockedIdx(r.l.index)}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>

        <ScrollView style={s.rail} contentContainerStyle={s.railIn} showsVerticalScrollIndicator={false}>
          <CourseCard lessons={lessons} done={doneCount} total={total} activeMonth={monthNo} />
          {nextExam && <ExamCard r={nextExam} no={examNo(nextExam.exam)} today={active?.number ?? doneCount} done={doneCount} />}
          {nextExam && <PrepCard r={nextExam} no={examNo(nextExam.exam)} done={doneCount} lessons={lessons} today={reviewToday} />}
          <UpcomingCard data={data} dates={dates} />
        </ScrollView>
      </View>

      <LessonLockedPopup
        visible={!!lockedLesson}
        onClose={() => setLockedIdx(null)}
        data={data}
        lesson={lockedLesson ?? null}
        date={lockedLesson ? dates[lockedLesson.index] : undefined}
        activeLiveAt={active && !active.isVideo ? dates[active.index] : undefined}
      />
    </DesktopPage>
  );
}

/** Sarlavhadagi "Yo'l · Imtihonlar · Bonus" (dizayn: nav aria-label="Darslar bo'limlari"). */
export function SectionTabs({ active = 'path' }: { active?: 'path' | 'exams' | 'bonus' }) {
  const tabs = [
    { key: 'path', label: 'Yoʻl', href: R.path },
    { key: 'exams', label: 'Imtihonlar', href: R.exams },
    { key: 'bonus', label: 'Bonus', href: R.bonus },
  ] as const;
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Darslar boʻlimlari" style={s.tabs}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => !on && go(t.href)}
            style={[s.tab, on && s.tabOn]}
          >
            <T size={14} color={on ? '#0B1220' : '#4A5468'}>
              {t.label}
            </T>
            {t.key === 'bonus' && <View accessibilityLabel="yangi" style={s.newDot} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function Rail({ top, bottom, children }: { top: string | null; bottom: string | null; children: React.ReactNode }) {
  return (
    <View style={s.railCol}>
      {top ? <View style={[s.line, { backgroundColor: top }]} /> : <View style={{ flex: 1 }} />}
      {children}
      {bottom ? <View style={[s.line, { backgroundColor: bottom }]} /> : <View style={{ flex: 1 }} />}
    </View>
  );
}

function LessonRow({
  lesson,
  data,
  top,
  bottom,
  grade,
  date,
  score,
  scoresAll,
  chevron,
  onLocked,
}: {
  lesson: LessonInfo;
  data: CourseData;
  top: string | null;
  bottom: string | null;
  grade?: LiveGradeEntry;
  date?: Date;
  score?: Record<string, { correct: number; total: number; finished: boolean }>;
  scoresAll: ReturnType<typeof useHomeworkScores>;
  chevron: boolean;
  onLocked: () => void;
}) {
  const coins = useLessonCoins(lesson.id);
  const kind = lesson.isVideo ? 'Videodars' : 'Jonli dars';

  if (lesson.index === data.activeIndex) {
    return <ActiveRow lesson={lesson} data={data} top={top} bottom={bottom} date={date} scores={scoresAll} />;
  }

  if (lesson.locked) {
    const when = date ? ` · ${shortDay(date)}` : '';
    return (
      <Pressable accessibilityRole="link" accessibilityLabel={`${lesson.number}-dars hali yopiq — batafsil`} onPress={onLocked} style={s.row}>
        <Rail top={top} bottom={bottom}>
          <View style={[s.dot, s.dotLocked]}>
            <ILock />
          </View>
        </Rail>
        <View style={s.rowBody}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Over color="#4A5468">
                {lesson.number}-dars · {kind}
                {when}
              </Over>
              <T size={17} color="#34405A">
                {lesson.name}
              </T>
            </View>
            {chevron && <IChevron />}
          </View>
        </View>
      </Pressable>
    );
  }

  // Tugagan (yoki ochiq, lekin tugamagan) dars — mobil ekrandagi hisob.
  let sub = '';
  if (lesson.isVideo) {
    const parts = Object.values(score ?? {});
    const correct = parts.reduce((a, p) => a + p.correct, 0);
    const tot = parts.reduce((a, p) => a + p.total, 0);
    sub = [tot > 0 ? `Vazifa ${correct} / ${tot} toʻgʻri` : lesson.completed ? 'Vazifa bajarildi' : `${lesson.percent}% bajarildi`, coins > 0 ? `+${coins} coin` : '']
      .filter(Boolean)
      .join(' · ');
  } else {
    const avg = grade ? Object.values(grade.scores).reduce((a, b) => a + b, 0) / Object.values(grade.scores).length : null;
    sub = [lesson.attendanceTaken ? 'Qatnashdingiz' : `${lesson.percent}% bajarildi`, avg !== null ? `baho ${avg.toFixed(1)} / 5` : ''].filter(Boolean).join(' · ');
  }
  return (
    <View style={s.row}>
      <Rail top={top} bottom={bottom}>
        <View style={[s.dot, { backgroundColor: lesson.completed ? '#087A4A' : '#D4DEFF' }]}>
          {lesson.completed ? (
            <ICheck />
          ) : (
            <T size={14} color="#1E3FD1">
              {lesson.number}
            </T>
          )}
        </View>
      </Rail>
      <Pressable accessibilityRole="link" onPress={() => go(R.lesson(lesson.id))} style={s.rowBody}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Over color={lesson.completed ? '#075E3A' : '#1E3FD1'}>
              {lesson.number}-dars · {kind}
            </Over>
            <T size={17}>{lesson.name}</T>
            {!!sub && (
              <T f="bodyBold" size={14} color="#4A5468">
                {sub}
              </T>
            )}
          </View>
          {lesson.isVideo && (
            <Pressable accessibilityRole="link" accessibilityLabel={`${lesson.number}-dars videodarsini qayta koʻrish`} onPress={() => go(R.video(lesson.id))} style={s.videoBtn}>
              <View style={s.videoPlay}>
                <IPlay />
              </View>
              <T size={14} color="#1E3FD1">
                Videodars
              </T>
            </Pressable>
          )}
        </View>
      </Pressable>
    </View>
  );
}

function ActiveRow({
  lesson,
  data,
  top,
  bottom,
  date,
  scores,
}: {
  lesson: LessonInfo;
  data: CourseData;
  top: string | null;
  bottom: string | null;
  date?: Date;
  scores: ReturnType<typeof useHomeworkScores>;
}) {
  const listened = useListened(lesson.id);
  // Tor oyna (1024–1279): maskot burchakka kichrayadi, matnga joy qoladi.
  const narrow = useWindowDimensions().width < 1280;
  const seen = useSeenWords(lesson.id);
  const tracks = getAudioTracks(data.mc, lesson.id);
  const heard = listened.filter((id) => tracks.some((t) => t.id === id)).length;
  const steps = lessonSteps(lesson, tracks.length, heard);
  const allDone = steps.every((x) => x.done);
  // "Qadam 2 / 5" — hozir turgan qadam raqami (bajarilganlar + 1), mobil ekrandagi kabi.
  const done = Math.min(steps.length, stepsDone(steps) + (allDone ? 0 : 1));
  const curIdx = steps.findIndex((x) => !x.done);
  const { title, phrase } = splitTitle(lesson.name);
  const kind = lesson.isVideo ? 'Videodars' : 'Jonli dars';
  const when = !lesson.isVideo && date ? ` · ${whenLabel(date)}` : '';
  const hwCount = lesson.content.homeworkParts.length;
  const words = lesson.content.vocabulary;
  const learned = learnedWordIds(lesson.id, words.map((w) => w.id), seen).size;
  const dialogNo = tracks.length ? Math.min(tracks.length, heard + (steps[1].done ? 0 : 1)) : 0;
  const hw = homeworkSummary(lesson, scores[lesson.id]);
  // Joriy qadam izohi: "Audio dialoglar 1 / 3".
  const detail = (() => {
    if (curIdx < 0) return '';
    const name = curIdx === 2 ? kind : STEP_NAMES[curIdx];
    const val = curIdx === 0 ? `${learned} / ${words.length}` : curIdx === 1 ? `${dialogNo} / ${tracks.length}` : curIdx === 3 ? `${hw.answered} / ${hw.total}` : '';
    return val ? `${name} ${val}` : name;
  })();

  return (
    <View style={s.row}>
      <Rail top={top} bottom={bottom}>
        <View style={s.activeDot}>
          <T size={18} color="#FFFFFF">
            {lesson.number}
          </T>
        </View>
      </Rail>
      <View style={[s.rowBody, { paddingVertical: 10 }]}>
        <View style={s.card}>
          <View accessibilityElementsHidden style={s.cardBlob} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              {!lesson.isVideo && <View style={s.liveDot} />}
              <Over color="#1E3FD1">
                {lesson.number}-dars · {kind}
                {when}
              </Over>
            </View>
            <T f="display" size={28} lh={30.8} ls={-0.56} style={{ marginTop: 2, paddingRight: narrow ? 80 : 0 }}>
              {title}
            </T>
            {!!phrase && (
              <T size={19} color="#1E3FD1">
                {phrase}
              </T>
            )}
            <View style={{ gap: 6, marginTop: 10, maxWidth: 360 }}>
              <View accessibilityLabel={`${steps.length} qadamdan ${done}-qadam`} style={{ flexDirection: 'row', gap: 4 }}>
                {steps.map((x, k) => (
                  <View key={x.key} style={[s.seg, { backgroundColor: x.done ? '#087A4A' : k === curIdx ? '#D4DEFF' : '#E2E6EE' }]}>
                    {!x.done && x.fraction > 0 && <View style={{ width: `${Math.round(x.fraction * 100)}%`, height: 8, backgroundColor: '#2F5BFF' }} />}
                  </View>
                ))}
              </View>
              <T f="bodyBold" size={13} color="#4A5468">
                Qadam {done} / {steps.length}
                {detail ? ` · ${detail}` : ''}
              </T>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
              <Pressable accessibilityRole="link" onPress={() => go(R.lesson(lesson.id))} style={({ pressed }) => [s.primary, pressed && { backgroundColor: '#1E3FD1' }]}>
                <T size={15} color="#FFFFFF">
                  Davom etish · {done}/{steps.length}
                </T>
                <IArrow />
              </Pressable>
              <Pressable accessibilityRole="link" accessibilityLabel={`Uyga vazifa, ${hwCount} qism`} onPress={() => go(R.homework(lesson.id))} style={({ pressed }) => [s.hwBtn, pressed && { opacity: 0.85 }]}>
                <IPencil />
                <T size={15} color="#7A5300">
                  Vazifa
                </T>
              </Pressable>
            </View>
          </View>
          <Image source={designImages.c04932e65803a7f5c40ff5868fd21516} style={narrow ? s.cardImgNarrow : s.cardImg} resizeMode="contain" />
        </View>
      </View>
    </View>
  );
}

function ExamRow({ r, after, no, top }: { r: Resolved; after: number; no: number; top: string | null }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${no}-oraliq imtihon — imtihonlar`} onPress={() => go(R.exams)} style={s.row}>
      <Rail top={top} bottom={null}>
        <View style={[s.dot, { backgroundColor: '#FFF4D1', borderWidth: 2, borderColor: '#F5B70A' }]}>
          <IFlag />
        </View>
      </Rail>
      <View style={s.rowBody}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Over color="#7A5300">{after}-darsdan keyin</Over>
            <T size={17}>{no}-oraliq imtihon</T>
            <T f="bodyBold" size={14} color="#4A5468">
              {r.exam.rangeLabel} · {r.exam.questions.length} savol · oʻtish bali {r.passPercent}%
            </T>
          </View>
          <IChevron />
        </View>
      </View>
    </Pressable>
  );
}

function CourseCard({ lessons, done, total, activeMonth }: { lessons: LessonInfo[]; done: number; total: number; activeMonth: number }) {
  const months = [1, 2, 3].map((m) => {
    const list = lessons.slice((m - 1) * MONTH_SIZE, m * MONTH_SIZE);
    const d = list.filter((l) => l.completed).length;
    const n = list.length || MONTH_SIZE;
    return { m, d, n, from: (m - 1) * MONTH_SIZE + 1, to: m * MONTH_SIZE };
  });
  const pct = Math.round((done / Math.max(1, total)) * 100);
  return (
    <View accessibilityLabel="Kurs" style={s.courseCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <T size={18}>
          Kurs · {total} dars
        </T>
        <T size={14} color="#1E3FD1">
          {done} / {total} · {pct}%
        </T>
      </View>
      {months.map(({ m, d, n, from, to }) => {
        const finished = d >= n && n > 0;
        const current = !finished && m === activeMonth;
        return (
          <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {finished ? (
              <View style={[s.mCircle, { backgroundColor: '#E3F7EE' }]}>
                <ICheck size={16} color="#087A4A" />
              </View>
            ) : current ? (
              <View style={[s.mCircle, { backgroundColor: '#2F5BFF' }]}>
                <T size={14} color="#FFFFFF">
                  {m}
                </T>
              </View>
            ) : (
              <View style={[s.mCircle, { backgroundColor: '#EEF1F7' }]}>
                <ILock size={15} />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <T size={14}>
                  {m}-oy · {from}–{to}
                </T>
                <T size={13} color={finished ? '#075E3A' : current ? '#1E3FD1' : '#4A5468'}>
                  {finished ? 'tugadi' : current ? `${d} / ${n}` : d > 0 ? `${d} / ${n}` : 'yopiq'}
                </T>
              </View>
              <View style={s.mTrack}>
                <View style={{ width: `${Math.round((d / n) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: finished ? '#087A4A' : '#2F5BFF' }} />
              </View>
            </View>
          </View>
        );
      })}
      <View style={{ height: 1, backgroundColor: '#EEF1F7' }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={s.fact}>
          <T f="bodyBold" size={12} color="#4A5468">
            Har hafta
          </T>
          <T size={14}>3 jonli + 3 video</T>
        </View>
        <View style={s.fact}>
          <T f="bodyBold" size={12} color="#4A5468">
            Oraliq imtihon
          </T>
          <T size={14}>har {EXAM_INTERVAL} darsda</T>
        </View>
      </View>
    </View>
  );
}

function ExamCard({ r, no, today, done }: { r: Resolved; no: number; today: number; done: number }) {
  // Imtihonlar ekranidagi hisob: bugungi darsdan imtihon darsigacha qolgan darslar.
  const left = Math.max(0, r.exam.requiredLessons - today);
  const open = done >= r.exam.requiredLessons;
  return (
    <Pressable accessibilityRole="link" onPress={() => go(R.exams)} style={({ pressed }) => [s.examCard, pressed && { opacity: 0.9 }]}>
      <View style={s.examIcon}>
        <Image source={designImages.ed6a96794e0940b7d7a5452cbc4cb422} style={{ width: 52, height: 52 }} resizeMode="contain" />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <T size={16}>{no}-oraliq imtihon</T>
        <T f="bodyBold" size={13} color="#4A5468">
          {r.exam.rangeLabel} · {r.exam.questions.length} savol
        </T>
        <View style={s.leftPill}>
          <T size={12} color="#B34700">
            {open ? 'Ochiq' : `${left} dars qoldi`}
          </T>
        </View>
      </View>
      <IChevron />
    </Pressable>
  );
}

function PrepCard({ r, no, done, lessons, today }: { r: Resolved; no: number; done: number; lessons: LessonInfo[]; today: number }) {
  // Imtihonlar ekranidagi hisob: oraliqdagi o'tilgan darslar va ulardagi so'zlar.
  const from = r.exam.requiredLessons - (EXAM_INTERVAL - 1);
  const to = Math.min(r.exam.requiredLessons, Math.max(from, done));
  const words = lessons.slice(from - 1, to).reduce((a, l) => a + l.content.vocabulary.length, 0);
  return (
    <Pressable accessibilityRole="link" onPress={() => go(R.wordReview)} style={({ pressed }) => [s.prep, pressed && { opacity: 0.9 }]}>
      <Image source={designImages.f7ed25f8b468b4cb6172a58adcd09f1f} style={{ width: 52, height: 52 }} resizeMode="contain" />
      <View style={{ flex: 1, gap: 2 }}>
        <T size={15}>{no}-imtihonga tayyorgarlik</T>
        <T f="bodyBold" size={13} color="#4A5468">
          {from === to ? `${from}-dars` : `${from}–${to}-darslar`} · {words} ta soʻz
        </T>
        <T size={13} color="#6A3CF0">
          bugun {today} ta takrorlash
        </T>
      </View>
      <IChevron color="#6A3CF0" />
    </Pressable>
  );
}

type Upcoming = { date: Date; title: string; sub: string; tone: 'today' | 'bonus' | 'plain' };

function relDay(d: Date) {
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(new Date())) / 86400000);
  return diff === 0 ? 'Bugun' : diff === 1 ? 'Ertaga' : shortDay(d);
}

function UpcomingCard({ data, dates }: { data: CourseData | null; dates: Record<number, Date> }) {
  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  const items: Upcoming[] = [];
  if (data) {
    Object.entries(dates).forEach(([k, d]) => {
      const l = data.lessons[Number(k)];
      if (!l || d < today0) return;
      const kind = l.isVideo ? 'Videodars' : 'Jonli dars';
      const sub = l.isVideo ? l.name.split(/\s*[(:—–]/)[0] : `${relDay(d)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      items.push({ date: d, title: `${l.number}-dars · ${kind}`, sub, tone: l.index === data.activeIndex ? 'today' : 'plain' });
    });
  }
  const bonus = BONUS_LESSONS.find((b) => b.date >= today0);
  if (bonus) items.push({ date: bonus.date, title: `Bonus dars · ${bonus.category.label}`, sub: `${relDay(bonus.date)} · +0 coin`, tone: 'bonus' });
  items.sort((a, b) => a.date.getTime() - b.date.getTime());
  const list = items.slice(0, 3);

  return (
    <Pressable accessibilityRole="link" accessibilityLabel="Dars jadvali" onPress={() => go(R.schedule)} style={s.upcoming}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2, paddingBottom: 4 }}>
        <T size={16}>Yaqin darslar</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <T size={14} color="#1E3FD1">
            Jadval
          </T>
          <IChevron size={16} color="#1E3FD1" />
        </View>
      </View>
      {list.map((it, i) => {
        const bg = it.tone === 'today' ? '#E8EEFF' : it.tone === 'bonus' ? '#FFF4D1' : '#F4F6FA';
        const accent = it.tone === 'today' ? '#1E3FD1' : it.tone === 'bonus' ? '#7A5300' : '#4A5468';
        return (
          <View key={i} style={[s.upItem, { backgroundColor: bg }]}>
            <View style={s.upDay}>
              <T size={12} lh={13.2} color={accent}>
                {DAY_SHORT[it.date.getDay()]}
              </T>
              <T size={16} lh={17.6}>
                {it.date.getDate()}
              </T>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <T size={14} lines={1}>
                {it.title}
              </T>
              <T f="bodyBold" size={13} color={accent} lines={1}>
                {it.sub}
              </T>
            </View>
          </View>
        );
      })}
    </Pressable>
  );
}

function Over({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <T size={12} color={color} ls={0.96} style={{ textTransform: 'uppercase' }}>
      {children}
    </T>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 24 },
  main: { flex: 1, minWidth: 0, gap: 14 },
  month: { backgroundColor: '#0B1220', borderRadius: 24, paddingVertical: 16, paddingLeft: 16, paddingRight: 22, flexDirection: 'row', alignItems: 'center', gap: 16 },
  monthIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: '#FFF4D1', alignItems: 'center', justifyContent: 'center' },
  monthTrack: { height: 8, borderRadius: 4, backgroundColor: '#263048', overflow: 'hidden' },
  monthFill: { height: 8, borderRadius: 4, backgroundColor: '#2FB47A' },
  tabs: { height: 46, padding: 4, borderRadius: 15, backgroundColor: '#E9EDF4', flexDirection: 'row', gap: 2 },
  tab: { height: 38, paddingHorizontal: 18, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  tabOn: { backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(11,18,32,0.12)' } as object,
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF7A1A', marginLeft: 6 },
  row: { flexDirection: 'row', gap: 20 },
  railCol: { width: 52, alignItems: 'center' },
  line: { width: 4, flex: 1, borderRadius: 2 },
  dot: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dotLocked: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E2E6EE' },
  activeDot: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#2F5BFF', boxShadow: '0 0 0 6px #D4DEFF', alignItems: 'center', justifyContent: 'center' } as object,
  rowBody: { flex: 1, minWidth: 0, paddingVertical: 18, flexDirection: 'row' },
  videoBtn: { height: 46, paddingLeft: 12, paddingRight: 16, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E8F0', flexDirection: 'row', alignItems: 'center', gap: 8 },
  videoPlay: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  card: { flex: 1, position: 'relative', backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 2, borderColor: '#2F5BFF', paddingVertical: 18, paddingHorizontal: 20, flexDirection: 'row', gap: 18, overflow: 'hidden' },
  cardBlob: { position: 'absolute', right: -30, top: -40, width: 230, height: 230, borderRadius: 115, backgroundColor: '#EEF2FF' },
  cardImg: { width: 190, height: 176, alignSelf: 'center', flexShrink: 0 },
  cardImgNarrow: { position: 'absolute', right: 10, top: 10, width: 86, height: 80 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D92D20' },
  seg: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  primary: { height: 50, paddingHorizontal: 22, borderRadius: 16, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', gap: 10, boxShadow: '0 5px 0 #1E3FD1' } as object,
  hwBtn: { height: 50, paddingHorizontal: 18, borderRadius: 16, backgroundColor: '#FFF4D1', flexDirection: 'row', alignItems: 'center', gap: 8 },
  rail: { width: 320, flexGrow: 0, flexShrink: 0 },
  railIn: { flexGrow: 1, gap: 16 },
  courseCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, gap: 16 },
  mCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  mTrack: { height: 6, borderRadius: 3, backgroundColor: '#EEF1F7', overflow: 'hidden' },
  fact: { flex: 1, backgroundColor: '#F4F6FA', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  examCard: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 16, paddingLeft: 16, paddingRight: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  examIcon: { width: 56, height: 56, borderRadius: 17, backgroundColor: '#FFF4D1', alignItems: 'center', justifyContent: 'center' },
  leftPill: { alignSelf: 'flex-start', height: 24, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#FFF1E6', justifyContent: 'center', marginTop: 3 },
  prep: { backgroundColor: '#F0EBFF', borderRadius: 24, paddingVertical: 14, paddingLeft: 14, paddingRight: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  upcoming: { flexGrow: 1, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, gap: 8 },
  upItem: { borderRadius: 14, paddingVertical: 8, paddingLeft: 8, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  upDay: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
