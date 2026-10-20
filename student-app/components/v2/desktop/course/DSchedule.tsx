/**
 * Kompyuter: Dars jadvali (dizayn: D_Schedule.dc.html) — oylik taqvim.
 *
 * Ma'lumot mobil Jadval ekrani bilan bir xil: jadval — fetchDemoSchedule
 * (kurs boshlangan sana, dars kunlari patterni, vaqt, Telegram guruh),
 * jonli darsga kelgani va bahosi — fetchDemoGrades, tarif —
 * fetchDemoStudentPayments, videodars holati — lessonProgressStore + v2
 * vazifa natijalari, bonus mavzusi — BONUS_CATEGORIES, bonus ko'rilgani —
 * lessonProgressStore ('bonus-N' videoWatch). Kunlar — courseDay (mobil bilan bir xil).
 * Bonus vaqti (soat) va streak himoyasi serverda yo'q — ko'rsatilmaydi.
 * Baho nishoni — eng oxirgi baholangan jonli darsda (qolganlarida ✓).
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';

import { TOTAL as BONUS_TOTAL } from '@/components/v2/homework/bonusData';
import {
  courseDay,
  DAY_SHORT,
  fmtGrade,
  gradeAverage,
  groupFromTopic,
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

import { useCountdown } from '../lessons/ui';
import { DesktopPage } from '../Shell';
import { go, ICheck, IChevron, IChevronLeft, IClose, ITelegram, Over, PageTitle, T } from './ui';

const MONTHS_CAP = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const WEEK_HEAD = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const KIND_COLOR = { live: '#2F5BFF', video: '#7C4DFF', bonus: '#F5B70A' } as const;

function mondayOf(d: Date) {
  const m = startOfDay(d);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
function weekLabel(mon: Date) {
  const sun = addDays(mon, 6);
  return mon.getMonth() === sun.getMonth()
    ? `${mon.getDate()}–${sun.getDate()} ${MONTHS_LOWER[sun.getMonth()]}`
    : `${mon.getDate()} ${MONTHS_LOWER[mon.getMonth()]} – ${sun.getDate()} ${MONTHS_LOWER[sun.getMonth()]}`;
}
const gradeOf = (g: LiveGradeEntry) => (g.scores.attendance + g.scores.activity + g.scores.speaking + g.scores.understanding + g.scores.discipline) / 5;

type VideoState = { watched: boolean; hwDone: boolean };

export function DSchedule() {
  const [schedule, setSchedule] = useState<DemoScheduleResponse | null>(null);
  const [grades, setGrades] = useState<LiveGradeEntry[]>([]);
  const [tariff, setTariff] = useState('');
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [video, setVideo] = useState<Record<number, VideoState>>({});
  const [, setTick] = useState(0);
  const [month, setMonth] = useState(() => {
    const d = startOfDay(new Date());
    d.setDate(1);
    return d;
  });

  useEffect(() => {
    fetchDemoSchedule().then(setSchedule).catch(() => {});
    fetchDemoGrades()
      .then((g) => setGrades(g.grades))
      .catch(() => {});
    fetchDemoStudentPayments()
      .then((p) => setTariff(p?.tariffLabel ?? ''))
      .catch(() => {});
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
  const latestGrade = useMemo(() => grades.reduce<string | null>((a, g) => (!a || g.date > a ? g.date : a), null), [grades]);
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const time = schedule?.lessonTime ?? '';

  // Taqvim: oyning 1-kuni turgan haftaning dushanbasidan oxirgi kun haftasining yakshanbasigacha.
  const weeks = useMemo(() => {
    const first = mondayOf(month);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const end = addDays(mondayOf(last), 6);
    const out: Date[][] = [];
    for (let w = new Date(first); w <= end; w = addDays(w, 7)) out.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)));
    return out;
  }, [month]);

  const dayOf = useCallback(
    (d: Date): CourseDay | null => {
      if (!start || !schedule) return null;
      const cd = courseDay(d, start, schedule.schedulePattern, gradeDates);
      if (cd.date < start) return null;
      if (cd.kind === 'bonus') return Math.floor((cd.date.getTime() - start.getTime()) / (7 * 86400000)) < BONUS_TOTAL ? cd : null;
      return cd.lesson !== null ? cd : null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedule, gradeDates, start?.getTime()],
  );
  const bonusIndex = (d: Date) => (start ? Math.floor((d.getTime() - start.getTime()) / (7 * 86400000)) : 0);

  // Ko'rinib turgan oydagi videodarslar holati (ko'rildi + vazifa) — mobil ekrandagi hisob.
  const loadVideo = useCallback(async () => {
    await loadLessonProgress();
    const next: Record<number, VideoState> = {};
    for (const d of weeks.flat()) {
      const cd = dayOf(d);
      if (!cd || cd.kind !== 'video' || cd.lesson === null || !cd.isPast) continue;
      const id = lessonIds[cd.lesson - 1];
      if (!id) continue;
      const p = getLessonProgress(id);
      const content = await getResolvedLessonContent(id, cd.lesson - 1).catch(() => null);
      const parts = content?.homeworkParts.length ?? 0;
      const doneParts = Object.values(p.homeworkParts).filter(Boolean).length;
      next[cd.lesson] = { watched: p.videoWatch, hwDone: parts > 0 && doneParts >= parts };
    }
    setVideo(next);
    setTick((t) => t + 1);
  }, [weeks, dayOf, lessonIds]);
  useFocusEffect(
    useCallback(() => {
      void loadVideo();
    }, [loadVideo]),
  );

  const live = liveAttendance(schedule, grades);
  const avg = gradeAverage(grades);
  const missed = live.total - live.attended;
  const group = groupFromTopic(schedule?.topic);
  const subtitle = [group ? `${group} guruh` : '', tariff ? `${tariff} tarif` : ''].filter(Boolean).join(' · ');

  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const canPrev = !!start && month > new Date(start.getFullYear(), start.getMonth(), 1);
  // Kelajak oylar hali ochilmagan — faqat joriy oygacha yuriladi (mobil jadvaldagi kabi).
  const canNext = month < thisMonth;
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const thisWeek = mondayOf(today).getTime();

  const todayDay = dayOf(today);
  const tomorrowDay = dayOf(tomorrow);
  const lessonIdOf = (cd: CourseDay | null) => (cd?.lesson ? lessonIds[cd.lesson - 1] : undefined);

  const nextMon = addDays(mondayOf(today), 7);
  const nextWeekDays = Array.from({ length: 7 }, (_, i) => dayOf(addDays(nextMon, i)));
  const nextLessons = nextWeekDays.map((d) => d?.lesson).filter((n): n is number => !!n);

  return (
    <DesktopPage title="Dars jadvali" back={R.profile} titleSlot={<PageTitle title="Dars jadvali" sub={subtitle} />} contentStyle={s.content}>
      <View style={s.body}>
        <View accessibilityLabel={`${MONTHS_CAP[month.getMonth()]} ${month.getFullYear()} taqvimi`} style={s.cal}>
          <View style={s.calHead}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Oldingi oy"
              accessibilityState={{ disabled: !canPrev }}
              disabled={!canPrev}
              onPress={() => shift(-1)}
              style={[s.navBtn, !canPrev && s.navOff]}
            >
              <IChevronLeft size={18} color={canPrev ? '#0B1220' : '#9AA3B5'} sw={2.4} />
            </Pressable>
            <T f="display" size={22} ls={-0.44} style={{ minWidth: 150, textAlign: 'center' }}>
              {MONTHS_CAP[month.getMonth()]} {month.getFullYear()}
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={canNext ? 'Keyingi oy' : 'Keyingi oy (hali ochilmagan)'}
              accessibilityState={{ disabled: !canNext }}
              disabled={!canNext}
              onPress={() => shift(1)}
              style={[s.navBtn, !canNext && s.navOff]}
            >
              <IChevron size={18} color={canNext ? '#0B1220' : '#9AA3B5'} sw={2.4} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <View style={s.legend}>
              {(
                [
                  ['#2F5BFF', 'Jonli dars'],
                  ['#7C4DFF', 'Videodars'],
                  ['#F5B70A', 'Bonus (yakshanba)'],
                ] as const
              ).map(([c, l]) => (
                <View key={l} style={s.legendItem}>
                  <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: c }} />
                  <T f="bodyBold" size={13} color="#4A5468">
                    {l}
                  </T>
                </View>
              ))}
              <View style={s.legendItem}>
                <View style={[s.okDot, { width: 16, height: 16, borderRadius: 8 }]}>
                  <ICheck size={8} color="#087A4A" sw={3} />
                </View>
                <T f="bodyBold" size={13} color="#4A5468">
                  Bajarildi
                </T>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            {WEEK_HEAD.map((d) => (
              <View key={d} style={{ flex: 1, paddingLeft: 12 }}>
                <Over>{d}</Over>
              </View>
            ))}
          </View>

          <View style={s.grid}>
            {weeks.map((w) => (
              <View key={w[0].getTime()} style={s.week}>
                {w.map((d) => {
                  const cd = dayOf(d);
                  const inMonth = d.getMonth() === month.getMonth();
                  const isToday = d.getTime() === today.getTime();
                  const isTomorrow = d.getTime() === tomorrow.getTime();
                  const curWeek = mondayOf(d).getTime() === thisWeek;
                  const kind = cd?.kind;
                  const bg = kind === 'bonus' ? (inMonth ? '#FFFBEB' : '#FFFCF2') : !inMonth ? '#F9FAFC' : curWeek ? '#F8FAFF' : '#FFFFFF';
                  const label = inMonth ? `${d.getDate()}` : `${d.getDate()} ${MONTHS_LOWER[d.getMonth()].slice(0, 3)}`;
                  const key = isoKey(d);

                  let badge: React.ReactNode = null;
                  let title = '';
                  let sub = '';
                  let subColor = '#4A5468';
                  let subFont: 'bodyHeavy' | 'bodyBold' = 'bodyHeavy';
                  if (cd && kind === 'bonus') {
                    const watched = getLessonProgress(`bonus-${bonusIndex(d) + 1}`).videoWatch;
                    const cat = BONUS_CATEGORIES[bonusIndex(d) % BONUS_CATEGORIES.length];
                    title = 'Bonus dars';
                    subFont = 'bodyBold';
                    if (cd.isPast) {
                      sub = watched ? 'Koʻrildi' : 'Koʻrilmagan';
                      subColor = watched ? '#7A5300' : '#4A5468';
                      if (watched)
                        badge = (
                          <View accessibilityLabel="koʻrildi" style={s.badge}>
                            <View style={[s.okDot, { backgroundColor: '#FFF4D1' }]}>
                              <ICheck size={12} color="#946200" sw={3} />
                            </View>
                          </View>
                        );
                    } else {
                      sub = cat.label;
                      subColor = '#7A5300';
                    }
                  } else if (cd && cd.lesson !== null) {
                    title = `${cd.lesson}-dars`;
                    if (kind === 'live') {
                      sub = time ? `Jonli · ${time}` : 'Jonli';
                      subColor = '#1E3FD1';
                      const g = gradeByDate.get(key);
                      if (cd.isPast && g) {
                        badge =
                          key === latestGrade ? (
                            <View accessibilityLabel={`bajarildi, baho ${fmtGrade(gradeOf(g))}`} style={[s.badge, s.gradePill]}>
                              <T size={12} color="#075E3A">
                                {fmtGrade(gradeOf(g))}
                              </T>
                            </View>
                          ) : (
                            <Done />
                          );
                      } else if (cd.isPast) {
                        badge = (
                          <View accessibilityLabel="qoldirildi" style={s.badge}>
                            <View style={[s.okDot, { backgroundColor: '#FDECEC' }]}>
                              <IClose size={11} color="#B42318" sw={3} />
                            </View>
                          </View>
                        );
                      }
                    } else {
                      sub = 'Videodars';
                      subColor = '#5B2FD6';
                      const v = video[cd.lesson];
                      if (cd.isPast && v?.watched && v.hwDone) badge = <Done />;
                    }
                  }
                  if (isToday && cd) badge = <Pill text="Bugun" bg="#2F5BFF" color="#FFFFFF" />;
                  else if (isTomorrow && cd) badge = kind === 'bonus' ? <Pill text="Ertaga" bg="#F5B70A" color="#0B1220" /> : <Pill text="Ertaga" bg="#E8EEFF" color="#1E3FD1" />;

                  const ring = isToday && cd ? '#2F5BFF' : isTomorrow && kind === 'bonus' ? '#F5B70A' : null;
                  const todayId = isToday && cd && kind !== 'bonus' ? lessonIdOf(cd) : undefined;
                  const href = todayId ? R.lesson(todayId) : (isToday || isTomorrow) && kind === 'bonus' ? R.bonus : null;
                  const a11y = isToday && cd
                    ? `Bugun, ${kind === 'bonus' ? 'bonus dars' : `${cd.lesson}-dars, ${kind === 'live' ? `jonli dars${time ? ` ${time}` : ''}` : 'videodars'}`}`
                    : isTomorrow && kind === 'bonus'
                      ? 'Ertaga, bonus dars'
                      : undefined;

                  return (
                    <Pressable
                      key={key}
                      accessibilityRole={href ? 'link' : undefined}
                      accessibilityLabel={a11y}
                      disabled={!href}
                      onPress={() => href && go(href)}
                      style={[s.cell, { backgroundColor: bg }, ring ? ({ boxShadow: `inset 0 0 0 2px ${ring}` } as object) : null]}
                    >
                      {cd && <View accessibilityElementsHidden style={[s.stripe, { backgroundColor: KIND_COLOR[cd.kind], opacity: inMonth ? 1 : 0.45 }]} />}
                      <T size={15} color={!inMonth ? '#5B6478' : isToday ? '#1E3FD1' : '#0B1220'}>
                        {label}
                      </T>
                      {badge}
                      {!!title && (
                        <View style={{ marginTop: 'auto', gap: 3 }}>
                          <T size={14} color={kind === 'bonus' ? '#7A5300' : inMonth ? '#0B1220' : '#4A5468'}>
                            {title}
                          </T>
                          <T f={subFont} size={12} color={subColor} lines={kind === 'bonus' ? 2 : 1}>
                            {sub}
                          </T>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <View style={s.aside}>
          <View style={s.summary}>
            <Image source={designImages.a8e6d559a994195b7358a2fd3f477f6c} style={{ width: 64, height: 64 }} resizeMode="contain" />
            <View style={{ flex: 1, gap: 3 }}>
              <T size={17}>
                Jonli darslar: {live.attended} / {live.total}
              </T>
              <T f="bodyBold" size={13} color="#34405A" lh={18.2}>
                {live.total > 0 && missed === 0 ? 'Hammasiga qatnashdingiz' : `${missed} ta darsni qoldirdingiz`} · oʻrtacha baho {fmtGrade(avg)}
              </T>
            </View>
          </View>

          {todayDay && <TodayCard day={todayDay} schedule={schedule} lessonId={lessonIdOf(todayDay)} />}

          {tomorrowDay && (
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                const id = lessonIdOf(tomorrowDay);
                if (tomorrowDay.kind === 'bonus') go(R.bonus);
                else if (id) go(R.lesson(id));
              }}
              style={({ pressed }) => [s.tomorrow, tomorrowDay.kind !== 'bonus' && { backgroundColor: '#FFFFFF' }, pressed && { opacity: 0.9 }]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Over color={tomorrowDay.kind === 'bonus' ? '#7A5300' : '#4A5468'}>
                  Ertaga · {DAY_SHORT[tomorrow.getDay()]} {tomorrow.getDate()}
                </Over>
                <IChevron size={18} color={tomorrowDay.kind === 'bonus' ? '#7A5300' : '#5B6478'} sw={2.4} />
              </View>
              <T size={17}>{tomorrowDay.kind === 'bonus' ? 'Bonus dars' : `${tomorrowDay.lesson}-dars · ${tomorrowDay.kind === 'live' ? 'Jonli dars' : 'Videodars'}`}</T>
              <T f="bodyBold" size={14} color={tomorrowDay.kind === 'bonus' ? '#7A5300' : '#4A5468'}>
                {tomorrowDay.kind === 'bonus'
                  ? BONUS_CATEGORIES[bonusIndex(tomorrow) % BONUS_CATEGORIES.length].label
                  : tomorrowDay.kind === 'live'
                    ? [time, 'Telegram guruhda'].filter(Boolean).join(' · ')
                    : 'Videodars'}
              </T>
            </Pressable>
          )}

          {nextLessons.length > 0 && schedule && (
            <View style={s.card}>
              <Over>Keyingi hafta · {weekLabel(nextMon)}</Over>
              <T size={16}>
                {Math.min(...nextLessons) === Math.max(...nextLessons) ? Math.min(...nextLessons) : `${Math.min(...nextLessons)}–${Math.max(...nextLessons)}`}-dars
              </T>
              <T f="bodyBold" size={14} color="#4A5468">
                jonli: {patternLabel(schedule.schedulePattern)}
                {time ? ` ${time}` : ''}
              </T>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {nextWeekDays.map((d, i) => {
                  const k = d?.kind;
                  const bg = k === 'live' ? '#E8EEFF' : k === 'video' ? '#F0EBFF' : k === 'bonus' ? '#FFF4D1' : '#F4F6FA';
                  const fg = k === 'live' ? '#1E3FD1' : k === 'video' ? '#5B2FD6' : k === 'bonus' ? '#7A5300' : '#5B6478';
                  return (
                    <View key={i} style={[s.dayChip, { backgroundColor: bg }]}>
                      <T size={12} color={fg}>
                        {WEEK_HEAD[i]}
                      </T>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <View style={[s.card, { flex: 1, gap: 6 }]}>
            <Over>Jadval tartibi</Over>
            <T f="bodyBold" size={14} color="#4A5468" lh={21}>
              Dushanba–shanba har kuni bitta dars: toq raqamli — videodars, juft — jonli dars{time ? ` (${time})` : ''}. Yakshanba — bonus dars.
            </T>
          </View>
        </View>
      </View>
    </DesktopPage>
  );
}

function Done() {
  return (
    <View accessibilityLabel="bajarildi" style={s.badge}>
      <View style={s.okDot}>
        <ICheck size={12} color="#087A4A" sw={3} />
      </View>
    </View>
  );
}

function Pill({ text, bg, color }: { text: string; bg: string; color: string }) {
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <T size={12} color={color}>
        {text}
      </T>
    </View>
  );
}

/** Bugungi dars kartasi (qora): jonli darsgacha qolgan vaqt va tugmalar. */
function TodayCard({ day, schedule, lessonId }: { day: CourseDay; schedule: DemoScheduleResponse | null; lessonId?: string }) {
  const time = schedule?.lessonTime ?? '';
  const startsAt = schedule?.startsAt ? new Date(schedule.startsAt) : null;
  const isLive = day.kind === 'live';
  const target = isLive && startsAt && startsAt.getTime() > Date.now() ? startsAt : null;
  const cd = useCountdown(target);
  const kind = day.kind === 'bonus' ? 'Bonus dars' : isLive ? 'Jonli dars' : 'Videodars';
  return (
    <View style={s.today}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A4E' }} />
        <Over color="#FF8A80">
          Bugun · {DAY_SHORT[day.date.getDay()]} {day.date.getDate()}
          {isLive && time ? ` · ${time}` : ''}
        </Over>
      </View>
      <T size={17} color="#FFFFFF">
        {day.kind === 'bonus' ? kind : `${day.lesson}-dars · ${kind}`}
      </T>
      <T f="bodyBold" size={14} color="#B8C1D6">
        {isLive ? [time, 'Telegram guruhda'].filter(Boolean).join(' · ') : kind}
      </T>
      {target && (
        <T f="display" size={32} lh={35.2} ls={0.64} color="#FFFFFF" style={{ marginTop: 2 }}>
          {cd.text}
        </T>
      )}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <Pressable
          accessibilityRole="link"
          disabled={!lessonId && day.kind !== 'bonus'}
          onPress={() => (day.kind === 'bonus' ? go(R.bonus) : lessonId && go(R.lesson(lessonId)))}
          style={[s.todayBtn, { backgroundColor: '#1B2438' }]}
        >
          <T size={14} color="#FFFFFF">
            Darsni ochish
          </T>
        </Pressable>
        {isLive && !!schedule?.telegramGroupLink && (
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(schedule.telegramGroupLink).catch(() => {})} style={[s.todayBtn, { backgroundColor: '#2AABEE', gap: 6 }]}>
            <ITelegram size={16} />
            <T size={14}>Guruhga</T>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 32 },
  body: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 24 },
  cal: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 24, paddingTop: 16, paddingHorizontal: 18, paddingBottom: 18, gap: 10 },
  calHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navBtn: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, borderColor: '#E4E8F0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  navOff: { backgroundColor: '#F4F6FA' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grid: { flex: 1, backgroundColor: '#EEF1F7', borderRadius: 18, padding: 6, gap: 6 },
  week: { flex: 1, minHeight: 96, flexDirection: 'row', gap: 6 },
  cell: { flex: 1, minWidth: 0, borderRadius: 16, position: 'relative', paddingTop: 9, paddingRight: 8, paddingBottom: 10, paddingLeft: 14, gap: 6, alignItems: 'flex-start' },
  stripe: { position: 'absolute', left: 5, top: 12, bottom: 12, width: 3, borderRadius: 2 },
  badge: { position: 'absolute', top: 10, right: 10 },
  okDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E3F7EE', alignItems: 'center', justifyContent: 'center' },
  gradePill: { height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: '#E3F7EE', justifyContent: 'center' },
  pill: { position: 'absolute', top: 9, right: 10, height: 24, paddingHorizontal: 9, borderRadius: 12, justifyContent: 'center' },
  aside: { width: 300, flexShrink: 0, gap: 12 },
  summary: { backgroundColor: '#E8EEFF', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  today: { backgroundColor: '#0B1220', borderRadius: 24, paddingTop: 16, paddingHorizontal: 18, paddingBottom: 18, gap: 8 },
  todayBtn: { flex: 1, height: 44, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  tomorrow: { backgroundColor: '#FFF4D1', borderRadius: 24, paddingVertical: 16, paddingHorizontal: 18, gap: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 16, paddingHorizontal: 18, gap: 10 },
  dayChip: { flex: 1, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
