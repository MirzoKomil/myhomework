/**
 * v2 Darslar yo'li (dizayn: 07 Path).
 *
 * Ma'lumot eski "Darslar yo'li" (roadmap/[courseId].tsx) bilan bir xil:
 * qulf holati getLessonLockMap'dan, foiz — lessonProgressStore'dan.
 * Ro'yxat joriy oy (24 dars) bo'yicha ko'rsatiladi va joriy darsdan ikki
 * dars oldingi joyga aylantiriladi — dizayndagi ko'rinish shu.
 */
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHomeworkScores } from '@/components/v2/homework/scoreStore';
import {
  EXAM_INTERVAL,
  getAudioTracks,
  getListened,
  hasCyrillic,
  lessonSteps,
  loadCourseData,
  MONTH_SIZE,
  scheduleDates,
  shortDay,
  splitTitle,
  stepsDone,
  whenLabel,
  type CourseData,
  type LessonInfo,
} from '@/components/v2/lessons/data';
import { Check, LockIcon, PencilIcon, PlayIcon } from '@/components/v2/lessons/icons';
import { TabBar } from '@/components/v2/TabBar';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { fetchDemoGrades, fetchDemoSchedule, type LiveGradeEntry } from '@/services/contentApi';
import { useLessonCoins } from '@/services/coinsStore';

// Oylar nomi serverda yo'q — dizayndagi nomlar (1-oy "Tanishuv", 2-oy
// "Kundalik hayot"). 3-oy nomi dizaynda yo'q, shuning uchun faqat raqam.
const MONTH_TITLES: Record<number, string> = { 1: 'Tanishuv', 2: 'Kundalik hayot' };

export default function PathScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<CourseData | null>(null);
  const [error, setError] = useState(false);
  const [grades, setGrades] = useState<LiveGradeEntry[]>([]);
  const [schedule, setSchedule] = useState<{ startsAt: Date | null; pattern: 'mwf' | 'tts' }>({ startsAt: null, pattern: 'mwf' });
  const scrollRef = useRef<ScrollView>(null);
  const scrolled = useRef(false);
  const scores = useHomeworkScores();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const load = () =>
        loadCourseData()
          .then((d) => !cancelled && setData(d))
          .catch(() => !cancelled && setError(true));
      load();
      fetchDemoGrades().then((g) => !cancelled && setGrades(g.grades)).catch(() => {});
      fetchDemoSchedule()
        .then((s) => !cancelled && setSchedule({ startsAt: s.startsAt ? new Date(s.startsAt) : null, pattern: s.schedulePattern }))
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const lessons = data?.lessons ?? [];
  const active = data ? lessons[data.activeIndex] : undefined;
  const doneCount = lessons.filter((l) => l.completed).length;
  const monthNo = active ? Math.floor(active.index / MONTH_SIZE) + 1 : 1;
  const monthStart = (monthNo - 1) * MONTH_SIZE;
  const monthLessons = lessons.slice(monthStart, monthStart + MONTH_SIZE);
  const monthDone = monthLessons.filter((l) => l.completed).length;
  const examAfter = active ? Math.ceil(active.number / EXAM_INTERVAL) * EXAM_INTERVAL : EXAM_INTERVAL;
  const dates = schedule.startsAt && data ? scheduleDates(schedule.startsAt, schedule.pattern, data.activeIndex, monthStart + MONTH_SIZE) : {};
  const scrollTarget = active ? Math.max(monthStart, active.index - 2) : -1;

  return (
    <View style={styles.screen}>
      <View style={styles.column}>
        <View style={[styles.top, { paddingTop: insets.top + 14 }]}>
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={styles.h1}>Darslar</Text>
            <Text style={styles.count}>{doneCount} / {lessons.length || 72} tugadi</Text>
          </View>
          <View accessibilityRole="tablist" style={styles.tabs}>
            <View accessibilityRole="tab" accessibilityState={{ selected: true }} style={[styles.tab, styles.tabOn]}>
              <Text style={styles.tabOnText}>Yoʻl</Text>
            </View>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: false }} onPress={() => router.push(R.exams as Href)} style={styles.tab}>
              <Text style={styles.tabText}>Imtihonlar</Text>
            </Pressable>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: false }} onPress={() => router.push(R.bonus as Href)} style={styles.tab}>
              <Text style={styles.tabText}>Bonus</Text>
              <View accessibilityLabel="yangi" style={styles.newDot} />
            </Pressable>
          </View>
        </View>

        {data && (
          <View style={styles.monthWrap}>
            <View style={styles.month}>
              <View style={styles.monthIcon}>
                <Image source={designImages.d9b3ac63886f3fdd8214701a31f0956a} style={{ width: 42, height: 42 }} resizeMode="contain" />
              </View>
              <View style={styles.monthBody}>
                <Text style={styles.monthTitle} numberOfLines={1}>
                  {monthNo}-oy{MONTH_TITLES[monthNo] ? ` · ${MONTH_TITLES[monthNo]}` : ''} ({monthStart + 1}–{monthStart + monthLessons.length})
                </Text>
                <View style={styles.monthTrack}>
                  <View style={[styles.monthFill, { width: `${Math.round((monthDone / Math.max(1, monthLessons.length)) * 100)}%` }]} />
                </View>
                <Text style={styles.monthSub}>
                  {monthDone} / {monthLessons.length} dars · imtihon {examAfter}-darsdan keyin
                </Text>
              </View>
            </View>
          </View>
        )}
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {error && !data ? (
            <Text style={styles.sub}>Darslarni yuklab boʻlmadi. Internetni tekshirib, qayta urinib koʻring.</Text>
          ) : !data ? (
            <Text style={styles.sub}>Yuklanmoqda…</Text>
          ) : (
            <>
              {monthLessons.map((l, i) => (
                <View
                  key={l.id}
                  onLayout={(e) => {
                    if (l.index === scrollTarget && !scrolled.current) {
                      scrolled.current = true;
                      const y = e.nativeEvent.layout.y;
                      if (y > 0) scrollRef.current?.scrollTo({ y, animated: false });
                    }
                  }}
                >
                  <PathRow
                    lesson={l}
                    isActive={l.index === data.activeIndex}
                    isLast={i === monthLessons.length - 1}
                    nextDone={!!monthLessons[i + 1] && (monthLessons[i + 1].completed || monthLessons[i + 1].index === data.activeIndex)}
                    data={data}
                    grade={grades.find((g) => g.lessonId === l.id)}
                    date={dates[l.index]}
                    score={scores[l.id]}
                  />
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>
      <TabBar active="lessons" />
    </View>
  );
}

function PathRow({
  lesson,
  isActive,
  isLast,
  nextDone,
  data,
  grade,
  date,
  score,
}: {
  lesson: LessonInfo;
  isActive: boolean;
  isLast: boolean;
  nextDone: boolean;
  data: CourseData;
  grade?: LiveGradeEntry;
  date?: Date;
  score?: Record<string, { correct: number; total: number; finished: boolean }>;
}) {
  const coins = useLessonCoins(lesson.id);
  const kind = lesson.isVideo ? 'Videodars' : 'Jonli dars';
  const lineColor = lesson.completed && nextDone ? '#0FA968' : '#D5DBE7';

  if (isActive) {
    const tracks = getAudioTracks(data.mc, lesson.id);
    const steps = lessonSteps(lesson, tracks.length, getListened(lesson.id).filter((id) => tracks.some((t) => t.id === id)).length);
    // "Qadam 2 / 5" — hozir turgan qadam raqami (bajarilganlar + 1).
    const done = Math.min(steps.length, stepsDone(steps) + (steps.every((x) => x.done) ? 0 : 1));
    const { title, phrase } = splitTitle(lesson.name);
    const when = !lesson.isVideo && date ? ` · ${whenLabel(date)}` : '';
    const hwCount = lesson.content.homeworkParts.length;
    return (
      <View style={styles.row}>
        <View style={styles.rail}>
          <View style={styles.activeDot}>
            <Text style={styles.activeNum}>{lesson.number}</Text>
          </View>
          {!isLast && <View style={[styles.line, { backgroundColor: '#D5DBE7' }]} />}
        </View>
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              <Text style={[styles.overline, { color: '#1E3FD1' }]}>{kind}{when}</Text>
              <Text style={[styles.cardTitle, { fontFamily: hasCyrillic(title) ? fonts.displayCyrillic : fonts.display }]}>{title}</Text>
              {!!phrase && <Text style={styles.cardPhrase}>{phrase}</Text>}
            </View>
            <Image source={designImages.c04932e65803a7f5c40ff5868fd21516} style={styles.cardImg} resizeMode="contain" />
          </View>
          <View style={styles.segs} accessibilityLabel={`Qadam ${done} / ${steps.length}`}>
            {steps.map((s, k) => (
              <View key={s.key} style={styles.seg}>
                <View style={{ width: `${Math.round((s.done ? 1 : s.fraction) * 100)}%`, height: 6, backgroundColor: s.done ? '#0FA968' : '#2F5BFF' }} />
              </View>
            ))}
          </View>
          <View style={styles.cardBtns}>
            <Pressable accessibilityRole="link" onPress={() => router.push(R.lesson(lesson.id) as Href)} style={({ pressed }) => [styles.primary, pressed && { backgroundColor: '#1E3FD1' }]}>
              <Text style={styles.primaryText} numberOfLines={1}>Davom etish · {done}/{steps.length}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Uyga vazifa, ${hwCount} qism`}
              onPress={() => router.push(R.homework(lesson.id) as Href)}
              style={({ pressed }) => [styles.hwBtn, pressed && { opacity: 0.85 }]}
            >
              <PencilIcon />
              <Text style={styles.hwText}>Vazifa</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (lesson.locked) {
    const when = date ? ` · ${shortDay(date)}` : '';
    return (
      <View style={styles.row}>
        <View style={styles.rail}>
          <View style={[styles.dot, { backgroundColor: '#E7EBF3' }]}><LockIcon /></View>
          {!isLast && <View style={[styles.line, { backgroundColor: '#D5DBE7' }]} />}
        </View>
        <View style={[styles.body, isLast && { paddingBottom: 0 }]}>
          <Text style={[styles.overline, { color: '#5B6478' }]}>{lesson.number}-dars · {kind}{when}</Text>
          <Text style={[styles.name, { color: '#4A5468' }]}>{lesson.name}</Text>
        </View>
      </View>
    );
  }

  // Tugagan (yoki ochiq, lekin hali tugamagan) dars.
  let sub = '';
  if (lesson.isVideo) {
    const parts = Object.values(score ?? {});
    const correct = parts.reduce((a, p) => a + p.correct, 0);
    const total = parts.reduce((a, p) => a + p.total, 0);
    sub = [total > 0 ? `Vazifa ${correct} / ${total} toʻgʻri` : lesson.completed ? 'Vazifa bajarildi' : `${lesson.percent}% bajarildi`, coins > 0 ? `+${coins} coin` : '']
      .filter(Boolean)
      .join(' · ');
  } else {
    const avg = grade ? Object.values(grade.scores).reduce((a, b) => a + b, 0) / Object.values(grade.scores).length : null;
    sub = [lesson.attendanceTaken ? 'Qatnashdingiz' : `${lesson.percent}% bajarildi`, avg !== null ? `baho ${avg.toFixed(1)} / 5` : '']
      .filter(Boolean)
      .join(' · ');
  }
  const color = lesson.completed ? '#087A4A' : '#1E3FD1';
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: lesson.completed ? '#0FA968' : '#D4DEFF' }]}>
          {lesson.completed ? <Check /> : <Text style={[styles.overline, { color: '#1E3FD1' }]}>{lesson.number}</Text>}
        </View>
        {!isLast && <View style={[styles.line, { backgroundColor: lineColor }]} />}
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push(R.lesson(lesson.id) as Href)}
        style={[styles.body, styles.bodyRow, isLast && { paddingBottom: 0 }]}
      >
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <Text style={[styles.overline, { color }]}>{lesson.number}-dars · {kind}</Text>
          <Text style={styles.name}>{lesson.name}</Text>
          {!!sub && <Text style={styles.sub}>{sub}</Text>}
        </View>
        {lesson.isVideo && (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${lesson.number}-darsni qayta koʻrish`}
            onPress={() => router.push(R.video(lesson.id) as Href)}
            style={({ pressed }) => [styles.replay, pressed && { opacity: 0.85 }]}
          >
            <PlayIcon />
          </Pressable>
        )}
      </Pressable>
    </View>
  );
}

const shadowCard = { boxShadow: '0 6px 20px rgba(47, 91, 255, 0.14)' } as object;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  top: { paddingHorizontal: 20, paddingBottom: 14, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  h1: { fontFamily: fonts.display, fontSize: 30, lineHeight: 30, letterSpacing: -0.6, color: '#0B1220', fontWeight: 'normal' },
  count: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#4A5468', fontWeight: 'normal' },
  tabs: { flexDirection: 'row', backgroundColor: '#E7EBF3', borderRadius: 16, padding: 4, gap: 4 },
  tab: { flex: 1, height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabOn: { backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(11,18,32,0.08)' } as object,
  tabOnText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#0B1220', fontWeight: 'normal' },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#4A5468', fontWeight: 'normal' },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF7A1A' },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  monthWrap: { paddingHorizontal: 20 },
  month: { backgroundColor: '#0B1220', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  monthIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#FFF4D1', alignItems: 'center', justifyContent: 'center' },
  monthBody: { flex: 1, gap: 6, minWidth: 0 },
  monthTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#FFFFFF', fontWeight: 'normal' },
  monthTrack: { height: 6, borderRadius: 3, backgroundColor: '#26304A', overflow: 'hidden' },
  monthFill: { height: 6, borderRadius: 3, backgroundColor: '#3DDC97' },
  monthSub: { fontFamily: fonts.body, fontSize: 13, color: '#B8C1D6', fontWeight: 'normal' },
  row: { flexDirection: 'row', gap: 12 },
  rail: { width: 48, alignItems: 'center' },
  dot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  line: { width: 3, flex: 1, minHeight: 12 },
  activeDot: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2F5BFF',
    borderWidth: 4,
    borderColor: '#D4DEFF',
    marginTop: -2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeNum: { fontFamily: fonts.display, fontSize: 17, color: '#FFFFFF', fontWeight: 'normal' },
  body: { flex: 1, paddingTop: 2, paddingBottom: 12, gap: 2, minWidth: 0 },
  bodyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  overline: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.48, textTransform: 'uppercase', fontWeight: 'normal' },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 21, color: '#0B1220', fontWeight: 'normal' },
  sub: { fontFamily: fonts.body, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  replay: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(11,18,32,0.08)' } as object,
  card: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 14, paddingLeft: 16, paddingRight: 14, marginBottom: 12, gap: 10, minWidth: 0, ...shadowCard },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  cardTitle: { fontSize: 19, lineHeight: 21, letterSpacing: -0.19, color: '#0B1220', fontWeight: 'normal' },
  cardPhrase: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#4A5468', fontWeight: 'normal' },
  cardImg: { width: 70, height: 66, marginTop: -4, marginRight: -4 },
  segs: { flexDirection: 'row', gap: 5 },
  seg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#E7EBF3', overflow: 'hidden' },
  cardBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: { flex: 1, minWidth: 0, height: 46, borderRadius: 14, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#FFFFFF', fontWeight: 'normal' },
  hwBtn: { height: 46, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#FFF4D1', flexDirection: 'row', alignItems: 'center', gap: 5 },
  hwText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#7A5300', fontWeight: 'normal' },
});
