/**
 * v2 Dars jadvali va davomat (dizayn: Schedule.dc.html).
 *
 * Haftalik ko'rinish. Jadval — fetchDemoSchedule (kurs boshlangan sana,
 * ustozning dars kunlari patterni, dars vaqti), jonli darsga kelgani va
 * bahosi — fetchDemoGrades (eski profile/schedule.tsx bilan bir xil manba).
 * Videodars holati — lessonProgressStore (video ko'rildi, uyga vazifa) va
 * v2 natijalari (to'g'ri javoblar soni). Bonus dars mavzusi —
 * BONUS_CATEGORIES (eski bonus darslar ekrani bilan bir xil tartib).
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLessonScores } from '@/components/v2/homework/scoreStore';
import { BackIcon2, CalendarIcon, CheckThinIcon, ChevronIcon, CloseIcon, NextIcon } from '@/components/v2/profile/icons';
import {
  Column,
  courseDay,
  DAY_SHORT,
  fmtGrade,
  go,
  gradeAverage,
  groupFromTopic,
  Header,
  isoKey,
  liveAttendance,
  MONTHS_LOWER,
  parseIso,
  patternLabel,
  startOfDay,
  type CourseDay,
} from '@/components/v2/profile/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { BONUS_CATEGORIES, getResolvedLessonContent } from '@/data/lessonContent';
import {
  fetchDemoGrades,
  fetchDemoSchedule,
  fetchDemoStudentPayments,
  fetchMobileContent,
  type DemoScheduleResponse,
  type LiveGradeEntry,
} from '@/services/contentApi';
import { getLessonProgress, loadLessonProgress } from '@/services/lessonProgressStore';

type VideoState = { watched: boolean; hwDone: boolean; correct: number; total: number };

function mondayOf(d: Date) {
  const m = startOfDay(d);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

function weekLabel(mon: Date) {
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  return mon.getMonth() === sun.getMonth()
    ? `${mon.getDate()}–${sun.getDate()} ${MONTHS_LOWER[sun.getMonth()]}`
    : `${mon.getDate()} ${MONTHS_LOWER[mon.getMonth()]} – ${sun.getDate()} ${MONTHS_LOWER[sun.getMonth()]}`;
}

const gradeOf = (g: LiveGradeEntry) => (g.scores.attendance + g.scores.activity + g.scores.speaking + g.scores.understanding + g.scores.discipline) / 5;

export default function V2Schedule() {
  const insets = useSafeAreaInsets();
  const [schedule, setSchedule] = useState<DemoScheduleResponse | null>(null);
  const [grades, setGrades] = useState<LiveGradeEntry[]>([]);
  const [tariff, setTariff] = useState('');
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [video, setVideo] = useState<Record<number, VideoState>>({});
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));

  useEffect(() => {
    fetchDemoSchedule().then(setSchedule).catch(() => {});
    fetchDemoGrades().then((g) => setGrades(g.grades)).catch(() => {});
    fetchDemoStudentPayments().then((p) => setTariff(p?.tariffLabel ?? '')).catch(() => {});
    fetchMobileContent()
      .then((mc) => {
        const c = mc.courses[0];
        setLessonIds(c ? mc.lessons.filter((l) => l.courseId === c.id).map((l) => l.id) : []);
      })
      .catch(() => {});
  }, []);

  const start = parseIso(schedule?.courseStartDate);
  const gradeByDate = useMemo(() => new Map(grades.map((g) => [g.date, g])), [grades]);
  const gradeDates = useMemo(() => new Set(grades.map((g) => g.date)), [grades]);

  const days: CourseDay[] = useMemo(() => {
    if (!start || !schedule) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return courseDay(d, start, schedule.schedulePattern, gradeDates);
    }).filter((d) => d.date >= start && (d.lesson !== null || d.kind === 'bonus'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, schedule, gradeDates, start?.getTime()]);

  // Shu haftadagi videodarslar holati (ko'rildi / vazifa natijasi).
  const loadVideo = useCallback(async () => {
    await loadLessonProgress();
    const next: Record<number, VideoState> = {};
    for (const d of days) {
      if (d.kind !== 'video' || d.lesson === null) continue;
      const id = lessonIds[d.lesson - 1];
      if (!id) continue;
      const p = getLessonProgress(id);
      const content = await getResolvedLessonContent(id, d.lesson - 1).catch(() => null);
      const parts = content?.homeworkParts.length ?? 0;
      const doneParts = Object.values(p.homeworkParts).filter(Boolean).length;
      const scores = Object.values(getLessonScores(id));
      next[d.lesson] = {
        watched: p.videoWatch,
        hwDone: parts > 0 && doneParts >= parts,
        correct: scores.reduce((s, x) => s + x.correct, 0),
        total: scores.reduce((s, x) => s + x.total, 0),
      };
    }
    setVideo(next);
  }, [days, lessonIds]);
  useFocusEffect(useCallback(() => { void loadVideo(); }, [loadVideo]));

  const live = liveAttendance(schedule, grades);
  const avg = gradeAverage(grades);
  const missed = live.total - live.attended;
  const group = groupFromTopic(schedule?.topic);
  const subtitle = [group ? `${group} guruh` : '', tariff ? `${tariff} tarif` : ''].filter(Boolean).join(' · ');
  const time = schedule?.lessonTime ?? '';
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const end = start ? (() => { const e = new Date(start); e.setMonth(e.getMonth() + 3); return e; })() : null;
  const canPrev = !!start && weekStart > mondayOf(start);
  // Kelajak haftalar hali ochilmagan — faqat joriy haftagacha yuriladi (dizayn).
  const thisWeek = mondayOf(today);
  const canNext = !!end && weekStart < mondayOf(end) && weekStart < thisWeek;
  const shift = (n: number) => setWeekStart((w) => { const x = new Date(w); x.setDate(x.getDate() + 7 * n); return x; });

  // Joriy haftadan keyingi hafta: darslar oralig'i va jonli dars kunlari.
  const nextWeek = useMemo(() => {
    if (!start || !schedule) return null;
    const mon = new Date(thisWeek);
    mon.setDate(mon.getDate() + 7);
    const lessons = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(d.getDate() + i);
      return courseDay(d, start, schedule.schedulePattern, new Set()).lesson;
    }).filter((n): n is number => n !== null);
    if (!lessons.length) return null;
    const a = Math.min(...lessons);
    const b = Math.max(...lessons);
    return { label: weekLabel(mon), range: a === b ? `${a}` : `${a}–${b}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, start?.getTime(), thisWeek.getTime()]);
  const isThisWeek = weekStart.getTime() === thisWeek.getTime();

  const bonusIndex = (d: Date) => (start ? Math.floor((d.getTime() - start.getTime()) / (7 * 86400000)) : 0);

  return (
    <View style={st.screen}>
      <Header title="Dars jadvali" subtitle={subtitle} subtitleWeight="bold" fallback={R.profile} variant="b" />
      <ScrollView contentContainerStyle={[st.content, { paddingBottom: insets.bottom + 22 }]} showsVerticalScrollIndicator={false}>
        <Column style={st.col}>
          <View style={st.summary}>
            <Image source={designImages.a8e6d559a994195b7358a2fd3f477f6c} style={st.mascot} resizeMode="contain" />
            <View style={st.summaryText}>
              <Text style={st.summaryTitle}>{`Jonli darslar: ${live.attended} / ${live.total}`}</Text>
              <View style={st.track}>
                <View style={[st.fill, { width: `${live.total ? Math.round((live.attended / live.total) * 100) : 0}%` }]} />
              </View>
              <Text style={st.summarySub}>
                {`${live.total > 0 && missed === 0 ? 'Hammasiga qatnashdingiz' : `${missed} ta darsni qoldirdingiz`} · oʻrtacha baho ${fmtGrade(avg)}`}
              </Text>
            </View>
          </View>

          <View style={st.weekNav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Oldingi hafta"
              accessibilityState={{ disabled: !canPrev }}
              disabled={!canPrev}
              onPress={() => shift(-1)}
              style={[st.navBtn, !canPrev && st.disabled]}
            >
              <BackIcon2 size={18} color={canPrev ? '#0B1220' : '#9AA3B5'} />
            </Pressable>
            <Text style={st.weekLabel}>{weekLabel(weekStart)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={canNext ? 'Keyingi hafta' : 'Keyingi hafta (hali ochilmagan)'}
              accessibilityState={{ disabled: !canNext }}
              disabled={!canNext}
              onPress={() => shift(1)}
              style={[st.navBtn, !canNext && st.disabled]}
            >
              <NextIcon color={canNext ? '#0B1220' : '#9AA3B5'} />
            </Pressable>
          </View>

          {days.map((d) => {
            const isTomorrow = d.date.getTime() === tomorrow.getTime();
            const key = isoKey(d.date);
            const dayName = DAY_SHORT[d.date.getDay()];
            if (d.kind === 'bonus') {
              const cat = BONUS_CATEGORIES[bonusIndex(d.date) % BONUS_CATEGORIES.length];
              return (
                <View key={key} style={[st.row, { backgroundColor: '#FFF4D1' }]}>
                  <View style={[st.date, { backgroundColor: '#FFFFFF' }]}>
                    <Text style={[st.dow, { color: '#5C4300' }]}>{dayName}</Text>
                    <Text style={st.dnum}>{d.date.getDate()}</Text>
                  </View>
                  <View style={st.info}>
                    <Text style={st.title}>Bonus dars</Text>
                    <Text style={[st.sub, { color: '#5C4300' }]}>{cat.label}</Text>
                  </View>
                  {(d.isToday || isTomorrow) && (
                    <View style={[st.chip, { backgroundColor: '#FFFFFF' }]}><Text style={[st.chipText, { color: '#7A5300' }]}>{d.isToday ? 'Bugun' : 'Ertaga'}</Text></View>
                  )}
                </View>
              );
            }
            const isLive = d.kind === 'live';
            const title = `${d.lesson}-dars · ${isLive ? 'Jonli dars' : 'Videodars'}`;
            let sub = '';
            let status: 'done' | 'missed' | null = null;
            if (isLive) {
              const g = gradeByDate.get(key);
              if (d.isToday || !d.isPast) sub = [time, 'Telegram guruhda'].filter(Boolean).join(' · ');
              else if (g) {
                sub = [time, 'qatnashdingiz'].filter(Boolean).join(' · ') + ` · baho ${fmtGrade(gradeOf(g))}`;
                status = 'done';
              } else {
                sub = [time, 'qatnashmadingiz'].filter(Boolean).join(' · ');
                status = 'missed';
              }
            } else {
              const v = d.lesson !== null ? video[d.lesson] : undefined;
              if (v?.watched || v?.hwDone) {
                const hw = v.total > 0 ? `vazifa ${v.correct} / ${v.total} toʻgʻri` : v.hwDone ? 'vazifa bajarildi' : 'vazifa bajarilmagan';
                sub = `${v.watched ? 'Koʻrildi' : 'Koʻrilmadi'} · ${hw}`;
                if (v.watched && v.hwDone) status = 'done';
              } else sub = d.isPast ? 'Koʻrilmadi' : 'Videodars';
            }
            const active = d.isToday;
            const lessonId = d.lesson !== null ? lessonIds[d.lesson - 1] : undefined;
            if (active) {
              // Bugungi dars — darsga olib boradi (dizaynda Lesson'ga havola).
              return (
                <Pressable
                  key={key}
                  accessibilityRole="link"
                  accessibilityLabel={`Bugun, ${d.lesson}-dars, ${isLive ? `jonli dars${time ? ` ${time}` : ''}` : 'videodars'}`}
                  disabled={!lessonId}
                  onPress={() => lessonId && go(R.lesson(lessonId))}
                  style={({ pressed }) => [st.row, { backgroundColor: '#2F5BFF' }, pressed && { opacity: 0.9 }]}
                >
                  <View style={[st.date, { backgroundColor: '#1E3FD1' }]}>
                    <Text style={[st.dow, { color: '#FFFFFF' }]}>{dayName}</Text>
                    <Text style={[st.dnum, { color: '#FFFFFF' }]}>{d.date.getDate()}</Text>
                  </View>
                  <View style={st.info}>
                    <Text style={[st.title, { color: '#FFFFFF' }]}>{title}</Text>
                    <Text style={[st.sub, { color: '#FFFFFF' }]} numberOfLines={1}>{sub}</Text>
                  </View>
                  <View style={[st.chip, { backgroundColor: '#FFFFFF' }]}><Text style={[st.chipText, { color: '#1E3FD1' }]}>Bugun</Text></View>
                  <View style={{ marginLeft: -4 }}><ChevronIcon size={18} color="#FFFFFF" strokeWidth={2.4} /></View>
                </Pressable>
              );
            }
            return (
              <View key={key} style={[st.row, active && { backgroundColor: '#2F5BFF' }]}>
                <View style={[st.date, active && { backgroundColor: '#1E3FD1' }]}>
                  <Text style={[st.dow, active && { color: '#FFFFFF' }]}>{dayName}</Text>
                  <Text style={[st.dnum, active && { color: '#FFFFFF' }]}>{d.date.getDate()}</Text>
                </View>
                <View style={st.info}>
                  <Text style={[st.title, active && { color: '#FFFFFF' }]}>{title}</Text>
                  <Text style={[st.sub, active && { color: '#FFFFFF' }]} numberOfLines={1}>{sub}</Text>
                </View>
                {active ? (
                  <View style={[st.chip, { backgroundColor: '#FFFFFF' }]}><Text style={[st.chipText, { color: '#1E3FD1' }]}>Bugun</Text></View>
                ) : isTomorrow ? (
                  <View style={[st.chip, { backgroundColor: '#E8EEFF' }]}><Text style={[st.chipText, { color: '#1E3FD1' }]}>Ertaga</Text></View>
                ) : status === 'done' ? (
                  <View accessibilityLabel="bajarildi" style={st.ok}><CheckThinIcon /></View>
                ) : status === 'missed' ? (
                  <View accessibilityLabel="qoldirildi" style={[st.ok, { backgroundColor: '#FDECEC' }]}><CloseIcon size={14} color="#B42318" strokeWidth={3} /></View>
                ) : null}
              </View>
            );
          })}

          {isThisWeek && !!nextWeek && (
            <View style={st.nextWeek}>
              <CalendarIcon color="#4A5468" />
              <View style={st.info}>
                <Text style={st.nextTitle}>{`Keyingi hafta · ${nextWeek.label}`}</Text>
                <Text style={st.sub} numberOfLines={1}>
                  {`${nextWeek.range}-dars${schedule ? ` · jonli: ${patternLabel(schedule.schedulePattern)}${time ? ` ${time}` : ''}` : ''}`}
                </Text>
              </View>
            </View>
          )}
        </Column>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { paddingHorizontal: 20, paddingTop: 14 },
  col: { gap: 8 },
  summary: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 12, paddingRight: 14, paddingLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  mascot: { width: 76, height: 68, flexShrink: 0 },
  summaryText: { flex: 1, gap: 4 },
  summaryTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#0B1220' },
  track: { height: 6, borderRadius: 3, backgroundColor: '#E7EBF3', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: '#0FA968' },
  summarySub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  navBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  disabled: { backgroundColor: '#EEF1F7' },
  weekLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, color: '#0B1220' },
  row: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 8, paddingLeft: 8, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  date: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dow: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468' },
  dnum: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 17, lineHeight: 17, color: '#0B1220' },
  info: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#0B1220' },
  sub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  ok: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E3F7EE', alignItems: 'center', justifyContent: 'center' },
  nextWeek: { backgroundColor: '#EEF1F7', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, lineHeight: 19, color: '#0B1220' },
  chip: { height: 26, paddingHorizontal: 9, borderRadius: 9, justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12 },
});
