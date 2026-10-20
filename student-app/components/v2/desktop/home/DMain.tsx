/**
 * Kompyuter: Bosh sahifa (dizayn: D_Main, D_MainNoBot, D_DarkMain).
 *
 * Ma'lumot mobil bosh sahifa (app/v2/index.tsx) bilan bir xil manbalardan:
 * joriy dars (resolveCurrentLesson) va uning 5 qadami (lessonSteps), jonli
 * dars taymeri (fetchDemoSchedule), bugungi chaqmoq (kunlik reyting),
 * seriya (fetchMyProgress), so'z takrorlash soni (buildSession), bot holati.
 * Kompyuterda qo'shimcha bloklar — boshqa mobil ekranlardagi manbalardan:
 * haftalik darslar (Jadval: courseDay), liga (Liga: haftalik reyting),
 * bonus (Bonus: BONUS_LESSONS), kurs/oylar/imtihon (Darslar va Imtihonlar),
 * grammatika va dialog mavzusi (Mashq kutubxonasi). Serverda yo'q narsa —
 * nol holatda (o'tgan kunlar seriyasi bo'sh doira, boshqalarning seriyasi 0).
 */
import { lessonGoal, tashkentNow } from '@/components/v2/home/lessonGoal';
import { Redirect, router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, useColorScheme, useWindowDimensions, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { RichText } from '@/components/RichText';
import { DesktopPage, fmtNum } from '@/components/v2/desktop/Shell';
import { DBellIcon } from '@/components/v2/desktop/icons';
import { useShellInfo } from '@/components/v2/desktop/shellData';
import { resolveCurrentLesson, type CurrentLesson } from '@/components/v2/home/currentLesson';
import { buildSession, loadReviews } from '@/components/v2/home/reviewStore';
import { BONUS_LESSONS, TOTAL as BONUS_TOTAL, UNLOCKED_COUNT, whenLabel as bonusWhen } from '@/components/v2/homework/bonusData';
import { loadGrammarRows } from '@/components/v2/library/grammar';
import { currentLesson as libCurrentLesson, titlesMatch } from '@/components/v2/library/shared';
import {
  currentStep as firstOpenStep,
  EXAM_INTERVAL,
  lessonSteps,
  loadCourseData,
  MONTH_SIZE,
  splitTitle,
  stepsDone,
  useListened,
  type CourseData,
} from '@/components/v2/lessons/data';
import { BotConnectPopup } from '@/components/v2/popups/BotConnect';
import { courseDay, DAY_SHORT, groupFromTopic, MONTHS_LOWER, parseIso, startOfDay } from '@/components/v2/profile/shared';
import { EARN_BONUS_LESSON, fallbackAvatar, timeLeftLabel, TIERS, weekEnd } from '@/components/v2/rewards/parts';
import { Loading } from '@/components/v2/states/Loading';
import { ServerError } from '@/components/v2/states/ServerError';
import { V2_BATTLE_WIN_COINS } from '@/constants/v2/battle';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getResolvedExams } from '@/data/exams';
import { useAvatarUri } from '@/services/avatarStore';
import {
  fetchDemoSchedule,
  fetchDemoStudentPayments,
  fetchDemoStudentProfile,
  fetchLeaderboard,
  fetchMobileContent,
  type DemoScheduleResponse,
  type LeaderboardEntryResponse,
} from '@/services/contentApi';
import { useExamResults } from '@/services/examStore';
import { getLessonProgress } from '@/services/lessonProgressStore';
import { fetchMyProgress } from '@/services/progressSync';
import { clearAuth, useAuth } from '@/services/studentAuthStore';
import { telegramLinkStatus } from '@/services/telegramLinkApi';
import { useCachedState } from '@/services/v2Cache';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

import {
  ArrowIcon,
  ArrowUpIcon,
  BoltIcon,
  CheckIcon,
  ChevronIcon,
  ClockIcon,
  FlagIcon,
  FlameIcon,
  MonitorIcon,
  StarIcon,
  TgIcon,
} from './icons';

/** Kunlik chaqmoq maqsadi — mobil bosh sahifadagi qiymat. */
const DAILY_GOAL = 50;
const RING_C = 2 * Math.PI * 23; // ≈144.5 — dizayndagi dasharray
const PROMOTE_TOP = 5;
const pad = (n: number) => String(n).padStart(2, '0');
const DAY_FULL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];

// Yorug' (D_Main) va qorong'u (D_DarkMain) ranglari — dizayndan aynan.
const LIGHT = {
  bg: '#F4F6FA',
  text: '#0B1220',
  card: '#FFFFFF',
  border: '#E4E8F0',
  muted: '#4A5468',
  link: '#1E3FD1',
  chipBg: '#FFFFFF',
  continueBg: '#FFFFFF',
  continueText: '#0B1220',
  continueShadow: '#1E3FD1',
  liveBg: '#0B1220',
  slidesBg: '#1B2438',
  vocabBg: '#F0EBFF',
  battleBg: '#FFF1E6',
  grammarBg: '#E3F7EE',
  dialogBg: '#E8EEFF',
  track: '#EEF1F7',
  chevron: '#5B6478',
  emptyDay: '#EEF1F7',
  todayNum: '#B34700',
  meRow: '#E8EEFF',
  promote: '#087A4A',
  bonusBg: '#FFF4D1',
  brown: '#7A5300',
  futureFill: '#E2E6EE',
  doneLabel: '#075E3A',
  starBadge: '#FFFFFF',
  avatarBg: '#FFF1E6',
};
type Pal = typeof LIGHT;
const DARK: Pal = {
  bg: '#0B1220',
  text: '#EEF2F8',
  card: '#141C2E',
  border: '#232C42',
  muted: '#A9B3C6',
  link: '#A9BCFF',
  chipBg: '#141C2E',
  continueBg: '#141C2E',
  continueText: '#EEF2F8',
  continueShadow: '#0A1640',
  liveBg: '#1A2338',
  slidesBg: '#263150',
  vocabBg: '#261D49',
  battleBg: '#2F2015',
  grammarBg: '#12301F',
  dialogBg: '#1F2D5E',
  track: '#222B40',
  chevron: '#98A2B6',
  emptyDay: '#222B40',
  todayNum: '#FF9F5A',
  meRow: '#1F2D5E',
  promote: '#4CC38A',
  bonusBg: '#2E2612',
  brown: '#F4C64E',
  futureFill: '#2A3450',
  doneLabel: '#5FD39A',
  starBadge: '#141C2E',
  avatarBg: '#2F2015',
};

type LiveInfo = { startsAt: Date; topic: string; link: string };
type Related = { grammar: { title: string; sub: string; topicId: string | null } | null; dialog: string | null; grammarCount: number; dialogCount: number };

function greeting(now: Date) {
  const h = tashkentNow(now).getHours();
  if (h >= 5 && h < 11) return 'Xayrli tong';
  if (h >= 11 && h < 17) return 'Xayrli kun';
  if (h >= 17 && h < 23) return 'Xayrli kech';
  return 'Xayrli tun';
}
function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
function spokenCountdown(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} soat ${m % 60} daqiqa` : `${m} daqiqa`;
}
function whenLabel(date: Date, now: Date) {
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(date) - day(now)) / 86400000);
  if (diff === 0) return `bugun ${time}`;
  if (diff === 1) return `ertaga ${time}`;
  return `${WEEKDAYS[date.getDay()]} ${time}`;
}
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

const go = (href: string) => router.push(href as Href);

export function DMain() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const p = dark ? DARK : LIGHT;
  const { token, student } = useAuth();
  const isEmbedded = Platform.OS === 'web' && typeof window !== 'undefined' && window.self !== window.top;
  const shell = useShellInfo();

  const [name, setName] = useCachedState('home.name', student?.name?.split(' ')[0] ?? '');
  const [lesson, setLesson] = useCachedState<CurrentLesson | null | undefined>('home.lesson', undefined);
  const [lessonError, setLessonError] = useState(false);
  const [live, setLive] = useCachedState<LiveInfo | null>('home.live', null);
  const [schedule, setSchedule] = useCachedState<DemoScheduleResponse | null>('dhome.schedule', null);
  const [now, setNow] = useState(() => new Date());
  const [botLinked, setBotLinked] = useCachedState('home.botLinked', true);
  const [botOpen, setBotOpen] = useState(false);
  const [todayLightning, setTodayLightning] = useCachedState('home.todayLightning', 0);
  const [wordCount, setWordCount] = useCachedState<number | null>('home.wordCount', null);
  const [streak, setStreak] = useCachedState('home.streak', 0);
  const [course, setCourse] = useCachedState<CourseData | null>('dhome.course', null);
  const [teacher, setTeacher] = useCachedState('dhome.teacher', '');
  const [duration, setDuration] = useCachedState('dhome.duration', 0);
  const [weekly, setWeekly] = useCachedState<LeaderboardEntryResponse[]>('dhome.weekly', []);
  const [related, setRelated] = useCachedState<Related>('dhome.related', { grammar: null, dialog: null, grammarCount: 0, dialogCount: 0 });
  const [exams, setExams] = useCachedState<{ id: string; requiredLessons: number }[]>('dhome.exams', []);
  const results = useExamResults();
  const listened = useListened(lesson?.id ?? '');
  const myAvatar = useAvatarUri();
  // Asosiy ustun kengligi (yon menyu 248, chekka 2×40, o'ng ustun 320+24). 1440 da 768 —
  // tor oynada (1024…) kartalar sig'ishi uchun ixcham joylashuv.
  const { width: winW } = useWindowDimensions();
  const mainW = winW - 248 - 80 - 344;
  const narrow = mainW < 640;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchMyProgress()
      .then((r) => {
        if (!cancelled && r) setStreak(r.streak);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token && !isEmbedded) return;
    fetchDemoStudentProfile()
      .then((pr) => {
        if (pr?.name) setName(pr.name.split(' ')[0]);
        else if (token) void clearAuth();
        setTeacher(pr?.mainTeacherName ?? '');
      })
      .catch(() => {});
    fetchDemoSchedule()
      .then((s) => {
        setSchedule(s);
        if (s.startsAt && s.telegramGroupLink) setLive({ startsAt: new Date(s.startsAt), topic: s.topic, link: s.telegramGroupLink });
      })
      .catch(() => {});
    fetchDemoStudentPayments()
      .then((pay) => pay && setDuration(pay.lessonDuration))
      .catch(() => {});
    getResolvedExams()
      .then((list) => setExams(list.filter((e) => e.exam.id !== 'final').map((e) => ({ id: e.exam.id, requiredLessons: e.exam.requiredLessons }))))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isEmbedded]);

  const loadLesson = useCallback(() => {
    setLessonError(false);
    resolveCurrentLesson().then(setLesson).catch(() => setLessonError(true));
  }, [setLesson]);

  useFocusEffect(
    useCallback(() => {
      if (!token && !isEmbedded) return;
      loadLesson();
      loadCourseData().then(setCourse).catch(() => {});
      Promise.all([getAccumulatedVocabulary(), loadReviews()])
        .then(([w, r]) => setWordCount(buildSession(w, r).length))
        .catch(() => {});
      fetchLeaderboard('country', 'daily')
        .then((entries) => setTodayLightning(entries.find((e) => e.isMe)?.lightning ?? 0))
        .catch(() => {});
      fetchLeaderboard('country', 'weekly').then(setWeekly).catch(() => {});
      // Grammatika (bugungi videodars mavzusi) va dialog (bugungi dars mavzusi) — Mashq kutubxonasidan.
      Promise.all([loadGrammarRows(), fetchMobileContent()])
        .then(async ([g, mc]) => {
          const cur = await libCurrentLesson(mc);
          const dlg = cur ? mc.library.speaking.find((t) => titlesMatch(t.title, cur.lesson.name)) : undefined;
          const rg = g.related;
          setRelated({
            grammar: rg ? { title: `Grammatika · ${rg.code}`, sub: [rg.topic.title, rg.lesson ? `${rg.lesson.number}-dars` : ''].filter(Boolean).join(' · '), topicId: rg.topic.id } : null,
            dialog: dlg ? dlg.title : null,
            grammarCount: g.rows.length,
            dialogCount: mc.library.speaking.length,
          });
        })
        .catch(() => {});
      if (token) {
        telegramLinkStatus().then((s) => setBotLinked(s.linked)).catch(() => setBotLinked(true));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, isEmbedded, loadLesson]),
  );

  const msLeft = live ? live.startsAt.getTime() - now.getTime() : -1;
  const showTimer = msLeft > 0 && msLeft < 24 * 3600 * 1000;
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), live && showTimer ? 1000 : 60000);
    return () => clearInterval(id);
  }, [live, showTimer]);

  if (!token && !isEmbedded) return <Redirect href={R.login as Href} />;
  if (lessonError) return <ServerError onRetry={loadLesson} />;
  if (lesson === undefined) return <Loading />;

  const title = name ? `${greeting(now)}, ${name}!` : `${greeting(now)}!`;
  const tn = tashkentNow(now);
  const dateLine = [`${DAY_FULL[tn.getDay()]}, ${tn.getDate()}-${MONTHS_LOWER[tn.getMonth()]}`, lesson ? `${lesson.number}-dars kuni` : ''].filter(Boolean).join(' · ');

  const body = (
    <View style={s.row}>
      <View style={s.left}>
        {lesson && <Hero p={p} lesson={lesson} listened={listened} course={course} schedule={schedule} now={now} narrow={narrow} />}
        {!!live && msLeft > -2 * 3600 * 1000 && (
          <LiveCard p={p} live={live} msLeft={msLeft} showTimer={showTimer} now={now} lesson={lesson} course={course} teacher={teacher} duration={duration} />
        )}
        <Practice p={p} wordCount={wordCount ?? 0} related={related} narrow={narrow} />
        <Week p={p} schedule={schedule} course={course} now={now} scroll={mainW < 600} />
      </View>
      <View style={s.aside}>
        {!botLinked && <BotCard onConnect={() => setBotOpen(true)} />}
        <GoalCard p={p} todayLightning={todayLightning} streak={streak} now={now} />
        <LeagueCard p={p} entries={weekly} streak={streak} myAvatar={myAvatar} now={now} />
        {botLinked && <BonusCard p={p} />}
        <CourseCard p={p} course={course} exams={exams} results={results} simple={!botLinked} />
      </View>
    </View>
  );

  return (
    <>
      {dark ? (
        <DarkPage title={title} subtitle={dateLine} unread={shell.unread} p={p}>
          {body}
        </DarkPage>
      ) : (
        <DesktopPage title={title} subtitle={dateLine} subtitleAbove>
          {body}
        </DesktopPage>
      )}
      <BotConnectPopup
        visible={botOpen}
        onClose={() => {
          setBotOpen(false);
          telegramLinkStatus().then((st) => setBotLinked(st.linked)).catch(() => {});
        }}
      />
    </>
  );
}

// ─── Qorong'u sahifa: DesktopPage'ning qorong'u nusxasi (umumiy faylda tungi rang yo'q) ──
function DarkPage({ title, subtitle, unread, p, children }: { title: string; subtitle: string; unread: number; p: Pal; children: ReactNode }) {
  const avatar = useAvatarUri();
  const shell = useShellInfo();
  return (
    <View style={{ flex: 1, minWidth: 0, backgroundColor: p.bg }}>
      <View style={s.header}>
        <View style={{ gap: 2, minWidth: 0, flexShrink: 1 }}>
          <Text style={[s.sub, { color: p.muted }]}>{subtitle}</Text>
          <Text accessibilityRole="header" numberOfLines={1} style={[s.h1, { color: p.text }]}>
            {title}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={unread ? `Bildirishnomalar, ${unread} ta yangi` : 'Bildirishnomalar'}
          onPress={() => go(R.notifications)}
          style={[s.bell, { backgroundColor: p.card, borderColor: p.border }]}
        >
          <DBellIcon color={p.text} />
          {unread > 0 && (
            <View style={[s.badge, { borderColor: p.bg }]}>
              <Text style={s.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={shell.firstName ? `Profil — ${shell.firstName}` : 'Profil'}
          onPress={() => go(R.profile)}
          style={[s.chip, { backgroundColor: p.card, borderColor: p.border }]}
        >
          <Image source={avatar ? { uri: avatar } : designImages['93faebd4826b1da6adaee5d0dcda6209']} style={[s.chipImg, { backgroundColor: p.avatarBg }]} />
          {!!shell.firstName && <Text style={[s.chipName, { color: p.text }]}>{shell.firstName}</Text>}
        </Pressable>
      </View>
      {/* DesktopPage bilan bir xil: aylantiriladigan kontent, 4/40/28 chekka. */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={s.content}>{children}</View>
      </ScrollView>
    </View>
  );
}
// ─── Bugungi dars ──────────────────────────────────────────────────────────
function Hero({
  p,
  lesson,
  listened,
  course,
  schedule,
  now,
  narrow,
}: {
  p: Pal;
  lesson: CurrentLesson;
  listened: string[];
  course: CourseData | null;
  schedule: DemoScheduleResponse | null;
  now: Date;
  narrow: boolean;
}) {
  const heard = listened.filter((x) => lesson.trackIds.includes(x)).length;
  const steps = lessonSteps({ id: lesson.id, isVideo: lesson.isVideoDay, content: lesson.content }, lesson.trackIds.length, heard);
  const total = steps.length;
  const done = stepsDone(steps);
  const cur = firstOpenStep(steps);
  const allDone = done >= total;
  const { title, phrase } = splitTitle(lesson.name);
  const konspekt = lessonGoal(course?.mc.lessonContents[lesson.id]?.konspekt);
  // Jonli dars bugun bo'lsa — vaqti ("Jonli · 19:00").
  const st = schedule?.startsAt ? new Date(schedule.startsAt) : null;
  const liveToday = !lesson.isVideoDay && st && startOfDay(st).getTime() === startOfDay(now).getTime();
  const labels = [
    'Soʻzlar',
    steps[1] && !steps[1].done && lesson.trackIds.length ? `Audio · ${heard}/${lesson.trackIds.length}` : 'Audio',
    lesson.isVideoDay ? 'Video' : liveToday ? `Jonli · ${pad(st!.getHours())}:${pad(st!.getMinutes())}` : 'Jonli',
    'Vazifa',
    'Yakun',
  ];
  return (
    <View accessibilityLabel="Bugungi dars" style={s.hero}>
      <View style={s.heroCircle1} />
      <View style={s.heroCircle2} />
      {/* Tor oynada rasm sarlavha ustiga tushmasin. */}
      {!narrow && <Image source={designImages.c04932e65803a7f5c40ff5868fd21516} style={s.heroImg} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />}
      <View style={s.heroTop}>
        <View style={[s.heroChip, { backgroundColor: p.chipBg }]}>
          <Text style={[s.heroChipText, { color: p.link }]}>Bugungi dars</Text>
        </View>
        <Text style={s.heroKind}>
          {lesson.number}-dars · {lesson.isVideoDay ? 'Videodars' : 'Jonli dars'}
        </Text>
      </View>
      <View style={s.heroText}>
        <Text style={s.heroTitle}>
          {title}
        </Text>
        {!!(phrase || lesson.phrase) && <Text style={s.heroPhrase}>{phrase || lesson.phrase}</Text>}
        {!!konspekt && (
          <Text style={s.heroGoal} numberOfLines={2}>
            Darsdan keyin: <Text style={{ fontFamily: fonts.bodyHeavy }}><RichText inline text={konspekt} /></Text>
          </Text>
        )}
      </View>
      <View style={s.steps} accessibilityLabel={`${total} qadamdan ${done} tasi bajarildi${allDone ? '' : `, ${cur + 1}-qadam davom etmoqda`}`}>
        {steps.map((st2, i) => {
          const state = st2.done ? 'done' : i === cur ? 'current' : 'todo';
          return (
            <View key={st2.key} style={s.step}>
              <View style={s.stepTrack}>
                <View style={[s.stepFill, { width: `${Math.max(0, Math.min(100, st2.fraction * 100))}%` }]} />
              </View>
              <View style={s.stepLabelRow}>
                {state === 'done' && <CheckIcon size={13} />}
                <Text numberOfLines={narrow ? 1 : undefined} style={[s.stepLabel, narrow ? null : s.nowrap, { fontFamily: state === 'current' ? fonts.bodyHeavy : state === 'done' ? fonts.bodyBold : fonts.body }]}>
                  {labels[i]}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <View style={s.ctaRow}>
        <Pressable
          accessibilityRole="link"
          onPress={() => go(R.lesson(lesson.id))}
          style={[s.cta, { backgroundColor: p.continueBg, boxShadow: `0 5px 0 ${p.continueShadow}` }]}
        >
          <Text style={[s.ctaText, { color: p.continueText }]}>{allDone ? 'Darsni koʻrish' : `Davom etish · ${cur + 1} / ${total}`}</Text>
          <ArrowIcon size={18} color={p.continueText} />
        </Pressable>
        {!!lesson.meta && <Text style={s.ctaMeta}>{lesson.meta}</Text>}
      </View>
    </View>
  );
}

// ─── Jonli dars ────────────────────────────────────────────────────────────
function LiveCard({
  p,
  live,
  msLeft,
  showTimer,
  now,
  lesson,
  course,
  teacher,
  duration,
}: {
  p: Pal;
  live: LiveInfo;
  msLeft: number;
  showTimer: boolean;
  now: Date;
  lesson: CurrentLesson | null;
  course: CourseData | null;
  teacher: string;
  duration: number;
}) {
  // Jonli dars — joriy dars jonli kun bo'lsa o'zi, aks holda keyingisi (scheduleDates qoidasi).
  const idx = lesson ? (lesson.isVideoDay ? lesson.number : lesson.number - 1) : -1;
  const liveLesson = course && idx >= 0 ? course.lessons[idx] : undefined;
  const liveId = liveLesson?.id ?? lesson?.id ?? '';
  const slides = liveLesson ? liveLesson.content.slides.length : (lesson?.slidesCount ?? 0);
  const group = groupFromTopic(live.topic);
  const line1 = [idx >= 0 ? `${idx + 1}-dars` : '', group ? `${group} guruh` : ''].filter(Boolean).join(' · ');
  const line2 = [teacher, duration ? `${duration} daq` : ''].filter(Boolean).join(' · ');
  return (
    <View accessibilityLabel="Jonli dars" style={[s.live, { backgroundColor: p.liveBg }]}>
      <View style={{ gap: 3, flexShrink: 0 }}>
        <View style={s.liveHead}>
          <View style={s.liveDot} />
          <Text style={s.liveOver}>{msLeft <= 0 ? 'Jonli dars boshlandi' : `Jonli dars · ${whenLabel(live.startsAt, now)}`}</Text>
        </View>
        {showTimer && (
          <Text accessibilityRole="timer" accessibilityLabel={`Jonli darsgacha ${spokenCountdown(msLeft)}`} style={s.timer}>
            {formatCountdown(msLeft)}
          </Text>
        )}
      </View>
      <View style={s.liveDivider} />
      {/* minWidth 150 — joy yetmasa tugmalar keyingi qatorga o'tadi (1440 da bitta qator). */}
      <View style={{ flex: 1, minWidth: 150, gap: 3 }}>
        {!!line1 && (
          <Text numberOfLines={1} style={s.liveTitle}>
            {line1}
          </Text>
        )}
        {!!line2 && (
          <Text numberOfLines={1} style={s.liveSub}>
            {line2}
          </Text>
        )}
      </View>
      {!!liveId && (
        <Pressable accessibilityRole="link" onPress={() => go(R.slides(liveId))} style={[s.slidesBtn, { backgroundColor: p.slidesBg }]}>
          <MonitorIcon size={18} />
          <Text style={s.slidesText}>Slaydlar · {slides}</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={group ? `${group} Telegram guruhiga oʻtish` : 'Telegram guruhiga oʻtish'}
        onPress={() => Linking.openURL(live.link).catch(() => {})}
        style={s.groupBtn}
      >
        <TgIcon size={18} />
        <Text style={s.groupText}>Guruhga</Text>
      </Pressable>
    </View>
  );
}

// ─── Mashq qilish ──────────────────────────────────────────────────────────
function SectionHead({ p, title, extra, link, href }: { p: Pal; title: string; extra?: string; link: string; href: string }) {
  return (
    <View style={s.sectionHead}>
      <Text accessibilityRole="header" style={[s.h2, { color: p.text }]}>
        {title}
        {!!extra && <Text style={[s.h2Extra, { color: p.muted }]}> · {extra}</Text>}
      </Text>
      <Pressable accessibilityRole="link" onPress={() => go(href)} style={s.sectionLink}>
        <Text style={[s.sectionLinkText, { color: p.link }]}>{link}</Text>
        <ChevronIcon size={16} color={p.link} />
      </Pressable>
    </View>
  );
}

function Practice({ p, wordCount, related, narrow }: { p: Pal; wordCount: number; related: Related; narrow: boolean }) {
  const cards: { bg: string; img: keyof typeof designImages; title: string; sub: string; href: string }[] = [
    { bg: p.vocabBg, img: 'f7ed25f8b468b4cb6172a58adcd09f1f', title: 'Soʻzlarni takrorlash', sub: `${wordCount} ta soʻz · bugun`, href: R.wordReview },
    { bg: p.battleBg, img: '11ac32c8e5b061e3779348e3afc56d83', title: 'Yuzma-yuz oʻyin', sub: `gʻolib +${V2_BATTLE_WIN_COINS} coin`, href: R.battle },
    {
      bg: p.grammarBg,
      img: 'f639c30e1400761df83230b833ba42b2',
      title: related.grammar?.title ?? 'Grammatika',
      sub: related.grammar?.sub ?? `${related.grammarCount} mavzu`,
      href: related.grammar?.topicId ? R.grammar(related.grammar.topicId) : R.grammarList,
    },
    { bg: p.dialogBg, img: '2770f303e2a36a9ec52c3a0b44e9b032', title: 'Dialoglar', sub: related.dialog ? `${related.dialog} · audio` : `${related.dialogCount} mavzu`, href: R.dialogList },
  ];
  return (
    <View style={{ gap: 12 }}>
      <SectionHead p={p} title="Mashq qilish" link="Barcha mashqlar" href={R.practice} />
      {/* Tor oynada 2×2. */}
      <View style={[s.practiceRow, narrow && { flexWrap: 'wrap' }]}>
        {cards.map((c) => (
          <Pressable key={c.title} accessibilityRole="link" onPress={() => go(c.href)} style={[s.practice, narrow && { flexBasis: '40%' }, { backgroundColor: p.card }]}>
            <View style={[s.practiceIcon, { backgroundColor: c.bg }]}>
              <Image source={designImages[c.img]} style={{ width: 52, height: 52 }} resizeMode="contain" />
            </View>
            <View style={{ gap: 2 }}>
              <Text style={[s.practiceTitle, { color: p.text }]}>{c.title}</Text>
              <Text style={[s.practiceSub, { color: p.muted }]}>
                {c.sub}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Bu hafta ──────────────────────────────────────────────────────────────
function Week({ p, schedule, course, now, scroll }: { p: Pal; schedule: DemoScheduleResponse | null; course: CourseData | null; now: Date; scroll: boolean }) {
  const mon = mondayOf(now);
  const start = parseIso(schedule?.courseStartDate);
  const today = startOfDay(now);
  const done = course ? course.lessons.filter((l) => l.completed).length : 0;
  const total = course?.lessons.length || 72;
  const time = schedule?.lessonTime ?? '';
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(d.getDate() + i);
    return d;
  });
  return (
    <View style={{ flex: 1, minHeight: 0, gap: 12 }}>
      <SectionHead p={p} title="Bu hafta" extra={weekLabel(mon)} link={`Barcha darslar · ${done} / ${total}`} href={R.path} />
      <WeekRow scroll={scroll}>
        {days.map((d) => {
          const cd = start && schedule ? courseDay(d, start, schedule.schedulePattern, new Set(), today) : null;
          const inCourse = !!cd && d >= start!;
          const isToday = d.getTime() === today.getTime();
          const label = `${DAY_SHORT[d.getDay()]} ${d.getDate()}`;
          const bonus = inCourse && cd!.kind === 'bonus';
          const n = inCourse && !bonus ? cd!.lesson : null;
          const info = n ? course?.lessons[n - 1] : undefined;
          const completed = !!info?.completed;
          const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
          const rel = diff === 0 ? 'Bugun' : diff === 1 ? 'Ertaga' : '';
          let badge: ReactNode = <View style={[s.badgeDot, { backgroundColor: p.emptyDay }]} />;
          if (bonus) badge = <View style={[s.badgeDot, { backgroundColor: p.starBadge }]}><StarIcon size={13} /></View>;
          else if (completed) badge = <View style={[s.badgeDot, { backgroundColor: '#087A4A' }]}><CheckIcon size={12} strokeWidth={3.4} /></View>;
          else if (isToday && n) badge = <View style={[s.badgeDot, { backgroundColor: '#2F5BFF' }]}><ClockIcon size={13} /></View>;
          const kindText = n ? (cd!.kind === 'live' ? 'Jonli dars' : 'Videodars') : '';
          const sub = bonus
            ? rel || `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`
            : n && isToday && !completed
              ? [`Bugun`, cd!.kind === 'live' ? time : ''].filter(Boolean).join(' · ')
              : kindText;
          const subColor = bonus ? p.brown : n && isToday && !completed ? p.link : p.muted;
          const cell: StyleProp<ViewStyle> = [
            s.dayCell,
            scroll && { flex: 0, width: 104, minHeight: 100 },
            { backgroundColor: bonus ? p.bonusBg : p.card },
            isToday && !bonus ? { boxShadow: 'inset 0 0 0 2px #2F5BFF' } : null,
          ];
          const content = (
            <>
              <View style={s.dayTop}>
                <Text style={[s.dayLabel, { color: p.muted }]}>{label}</Text>
                {inCourse && badge}
              </View>
              <Text style={[s.dayTitle, s.nowrap, { color: p.text }]}>
                {bonus ? 'Bonus dars' : n ? `${n}-dars` : '—'}
              </Text>
              <Text style={[s.daySub, s.nowrap, { color: subColor }]}>
                {sub}
              </Text>
            </>
          );
          const href = bonus ? R.bonus : info ? R.lesson(info.id) : null;
          return href ? (
            <Pressable key={label} accessibilityRole="link" onPress={() => go(href)} style={cell}>
              {content}
            </Pressable>
          ) : (
            <View key={label} style={cell}>
              {content}
            </View>
          );
        })}
      </WeekRow>
    </View>
  );
}

/** Hafta qatori: keng oynada 7 ta teng katak, tor oynada gorizontal aylantiriladi. */
function WeekRow({ scroll, children }: { scroll: boolean; children: ReactNode }) {
  if (!scroll) return <View style={s.weekRow}>{children}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {children}
    </ScrollView>
  );
}

// ─── O'ng ustun ────────────────────────────────────────────────────────────
function BotCard({ onConnect }: { onConnect: () => void }) {
  return (
    <View accessibilityLabel="Telegram bot ulanmagan" style={s.bot}>
      <View style={s.botCircle} />
      <View style={s.botRow}>
        <View style={s.botIcon}>
          <TgIcon size={23} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={s.botTitle}>Telegram botni ulang</Text>
          <Text style={[s.botSub, s.nowrap]}>
            Dars eslatmalari Telegramga keladi
          </Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={onConnect} style={s.botBtn}>
        <Text style={s.botBtnText}>Ulash</Text>
        <ArrowIcon size={17} />
      </Pressable>
    </View>
  );
}

function GoalCard({ p, todayLightning, streak, now }: { p: Pal; todayLightning: number; streak: number; now: Date }) {
  const goal = Math.min(todayLightning, DAILY_GOAL);
  // Oxirgi 6 kun + bugun. O'tgan kunlar holati serverda yo'q — bo'sh doira (mobil bilan bir xil).
  const days = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    return { short: DAY_SHORT[d.getDay()], full: `${DAY_FULL[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}` };
  });
  return (
    <View accessibilityLabel="Kunlik maqsad va seriya" style={[s.goal, { backgroundColor: p.card }]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Kunlik maqsad: ${todayLightning} / ${DAILY_GOAL} chaqmoq — natijalarni ochish`}
        onPress={() => go(R.progress)}
        style={s.goalRow}
      >
        <View style={{ width: 58, height: 58 }}>
          <Svg width={58} height={58} viewBox="0 0 56 56">
            <Circle cx="28" cy="28" r="23" fill="none" stroke={p.track} strokeWidth={7} />
            {goal > 0 && (
              <Circle
                cx="28"
                cy="28"
                r="23"
                fill="none"
                stroke="#7C4DFF"
                strokeWidth={7}
                strokeLinecap="round"
                strokeDasharray={`${(goal / DAILY_GOAL) * RING_C} ${RING_C}`}
                transform="rotate(-90 28 28)"
              />
            )}
          </Svg>
          <View style={{ position: 'absolute', left: 19, top: 19 }}>
            <BoltIcon size={20} />
          </View>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[s.goalTitle, { color: p.text }]}>Kunlik maqsad</Text>
          <Text style={[s.goalSub, { color: p.muted }]}>
            {todayLightning} / {DAILY_GOAL} · yana {DAILY_GOAL - goal} ta
          </Text>
        </View>
        <ChevronIcon size={18} color={p.chevron} />
      </Pressable>
      <View style={{ height: 1, backgroundColor: p.track }} />
      <View style={s.streakHead}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <FlameIcon size={18} />
          <Text style={[s.streakTitle, { color: p.text }]}>Seriya · {streak} kun</Text>
        </View>
        <Text style={[s.streakNext, { color: p.muted }]}>bugun → {streak + 1}</Text>
      </View>
      <Pressable accessibilityRole="link" accessibilityLabel={`Seriya ${streak} kun, holat`} onPress={() => go(R.streak)} style={s.days}>
        {days.map((d) => (
          <View key={d.full} accessibilityLabel={`${d.full}: bajarilmagan`} style={s.day}>
            <View style={[s.dayCircle, { backgroundColor: p.emptyDay }]} />
            <Text style={[s.dayName, { color: p.muted }]}>{d.short}</Text>
          </View>
        ))}
        <View accessibilityLabel={`Bugun, streak ${streak} kun`} style={s.day}>
          <View style={[s.dayCircle, s.today]}>
            <Text style={[s.todayNum, { color: p.todayNum }]}>{streak + 1}</Text>
          </View>
          <Text style={[s.dayName, { color: p.text, fontFamily: fonts.bodyHeavy }]}>Bugun</Text>
        </View>
      </Pressable>
    </View>
  );
}

function LeagueCard({ p, entries, streak, myAvatar, now }: { p: Pal; entries: LeaderboardEntryResponse[]; streak: number; myAvatar: string | null; now: Date }) {
  // Haftalik liga pog'onasi serverda yo'q — Liga ekranidagidek hamma Bronza.
  const tier = TIERS[0];
  const next = TIERS[1];
  const meIdx = entries.findIndex((e) => e.isMe);
  const from = meIdx < 0 ? 0 : Math.max(0, Math.min(meIdx - 1, entries.length - 3));
  const rows = entries.slice(from, from + 3);
  const me = meIdx >= 0 ? entries[meIdx] : undefined;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${tier.name} liga${me ? `, ${me.rank}-oʻrin, ${me.lightning} chaqmoq` : ''} — ligani ochish`}
      onPress={() => go(R.league)}
      style={[s.league, { backgroundColor: p.card }]}
    >
      <View style={s.leagueHead}>
        <View style={[s.leagueIcon, { backgroundColor: p.track }]}>
          <Image source={designImages.e91544c14ad5b2b62bbbe447f02474b2} style={{ width: 40, height: 40 }} resizeMode="contain" />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[s.goalTitle, { color: p.text }]}>{tier.name} liga</Text>
          <Text style={[s.leagueSub, { color: p.muted }]}>{timeLeftLabel(weekEnd(now).getTime() - now.getTime())}</Text>
        </View>
        <ChevronIcon size={18} color={p.chevron} />
      </View>
      <View style={{ gap: 2 }}>
        {rows.map((e) => {
          const mine = e.isMe;
          const first = e.name.split(' ')[0];
          const uri = mine && myAvatar ? myAvatar : e.avatarUrl;
          return (
            <View key={e.id} style={[s.leagueRow, mine && { backgroundColor: p.meRow }]}>
              <Text style={[s.rank, { color: p.muted }]}>{e.rank}</Text>
              <Image source={uri ? { uri } : fallbackAvatar(e.name)} style={s.leagueAvatar} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.leagueName, { color: mine ? p.link : p.text }, mine && { fontFamily: fonts.bodyHeavy }]}>
                  {mine ? `Siz · ${first}` : first}
                </Text>
                {/* Boshqalarning seriyasi serverda yo'q — 0 (Liga ekranidagidek). */}
                <Text style={[s.leagueStreak, { color: p.muted }]}>{mine ? streak : 0} kun ketma-ket</Text>
              </View>
              <View style={s.score}>
                <BoltIcon size={14} />
                <Text style={[s.scoreText, { color: p.text }]}>{fmtNum(e.lightning)}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <View style={s.promote}>
        <ArrowUpIcon size={15} />
        <Text style={[s.promoteText, { color: p.promote }]}>
          Top {PROMOTE_TOP} {next.name} ligaga chiqadi
        </Text>
      </View>
    </Pressable>
  );
}

function BonusCard({ p }: { p: Pal }) {
  const next = BONUS_LESSONS[UNLOCKED_COUNT];
  if (!next) return null;
  const watched = BONUS_LESSONS.filter((b) => getLessonProgress(b.id).videoWatch).length;
  return (
    <Pressable accessibilityRole="link" onPress={() => go(R.bonus)} style={[s.bonus, { backgroundColor: p.bonusBg }]}>
      <Image source={designImages['8c685006bea3b1898e962d7116efecbd']} style={{ width: 68, height: 68 }} resizeMode="contain" />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[s.bonusOver, { color: p.brown }]}>{bonusWhen(next.date)}</Text>
        <Text style={[s.bonusTitle, { color: p.text }]}>Bonus dars: {next.category.label}</Text>
        <Text style={[s.bonusSub, { color: p.brown }]}>
          {watched} / {BONUS_TOTAL} koʻrildi · +{EARN_BONUS_LESSON} coin
        </Text>
      </View>
    </Pressable>
  );
}

function CourseCard({
  p,
  course,
  exams,
  results,
  simple,
}: {
  p: Pal;
  course: CourseData | null;
  exams: { id: string; requiredLessons: number }[];
  results: Record<string, unknown>;
  simple: boolean;
}) {
  const lessons = course?.lessons ?? [];
  const total = lessons.length || 72;
  const done = lessons.filter((l) => l.completed).length;
  const pct = Math.round((done / total) * 100);
  const activeMonth = course ? Math.floor(course.activeIndex / MONTH_SIZE) : 0;
  const today = course ? course.activeIndex + 1 : 0;
  // Imtihonlar ekranidagidek: birinchi natijasiz oraliq imtihon.
  const nextIdx = exams.findIndex((e) => !results[e.id]);
  const next = nextIdx >= 0 ? exams[nextIdx] : undefined;
  const left = next ? Math.max(0, next.requiredLessons - (today || done)) : 0;
  const examText = next ? `${nextIdx + 1}-oraliq imtihon · ${done >= next.requiredLessons ? 'ochiq' : `${left} dars qoldi`}` : `Har ${EXAM_INTERVAL} darsdan keyin oraliq imtihon`;
  const months = [0, 1, 2].map((m) => {
    const slice = lessons.slice(m * MONTH_SIZE, (m + 1) * MONTH_SIZE);
    const mDone = slice.filter((l) => l.completed).length;
    const size = slice.length || MONTH_SIZE;
    const complete = slice.length > 0 && mDone >= size;
    const current = !complete && m === activeMonth;
    return {
      label: `${m + 1}-oy`,
      fill: complete ? '#087A4A' : current ? '#2F5BFF' : p.futureFill,
      width: complete ? 100 : current ? Math.round((mDone / size) * 100) : 0,
      labelColor: complete ? p.doneLabel : current ? p.link : p.muted,
      sub: complete ? `${m * MONTH_SIZE + 1}–${(m + 1) * MONTH_SIZE} ✓` : current ? `${mDone} / ${size}` : `${m * MONTH_SIZE + 1}–${(m + 1) * MONTH_SIZE}`,
    };
  });
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Kurs: ${done} / ${total} dars, ${pct}% — imtihonlar`}
      onPress={() => go(R.exams)}
      style={[s.course, { backgroundColor: p.card }]}
    >
      <View style={s.courseHead}>
        <Text style={[s.courseTitle, { color: p.text }]}>
          Kurs · {done} / {total} dars
        </Text>
        <Text style={[s.coursePct, { color: p.link }]}>{pct}%</Text>
      </View>
      {simple ? (
        <View style={[s.bar, { backgroundColor: p.track }]}>
          <View style={[s.bar, { width: `${pct}%`, backgroundColor: '#2F5BFF' }]} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {months.map((m) => (
            <View key={m.label} style={{ flex: 1, minWidth: 0, gap: 5 }}>
              <View style={[s.bar, { backgroundColor: p.track }]}>
                <View style={[s.bar, { width: `${m.width}%`, backgroundColor: m.fill }]} />
              </View>
              <Text style={[s.monthLabel, { color: m.labelColor }]}>{m.label}</Text>
              <Text style={[s.monthSub, { color: p.muted }]}>{m.sub}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={s.examRow}>
        <FlagIcon size={15} color={p.muted} />
        <Text style={[s.examText, { color: p.muted }]}>{examText}</Text>
        <ChevronIcon size={16} color={p.chevron} />
      </View>
    </Pressable>
  );
}

const T = (f: string, size: number, extra?: TextStyle): TextStyle => ({ fontFamily: f, fontWeight: 'normal', fontSize: size, ...extra });

const s = StyleSheet.create({
  header: { height: 84, paddingHorizontal: 40, flexDirection: 'row', alignItems: 'center', gap: 14 },
  h1: T(fonts.display, 30, { lineHeight: 33, letterSpacing: -0.6 }),
  sub: T(fonts.bodyBold, 14),
  bell: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#D92D20',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: T(fonts.bodyHeavy, 12, { lineHeight: 14, color: '#FFFFFF' }),
  chip: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingLeft: 3, paddingRight: 14, borderRadius: 23, borderWidth: 1 },
  chipImg: { width: 38, height: 38, borderRadius: 19 },
  chipName: T(fonts.bodyHeavy, 14),
  content: { flexGrow: 1, paddingTop: 4, paddingHorizontal: 40, paddingBottom: 28 },

  row: { flex: 1, flexDirection: 'row', gap: 24 },
  left: { flex: 1, minWidth: 0, gap: 24 },
  aside: { width: 320, flexShrink: 0, gap: 20 },

  hero: { backgroundColor: '#2F5BFF', borderRadius: 28, paddingVertical: 26, paddingHorizontal: 30, overflow: 'hidden', gap: 16 },
  heroCircle1: { position: 'absolute', right: -40, top: -70, width: 330, height: 330, borderRadius: 165, backgroundColor: '#4A71FF' },
  heroCircle2: { position: 'absolute', right: 150, bottom: -90, width: 160, height: 160, borderRadius: 80, backgroundColor: '#3F68FF' },
  heroImg: { position: 'absolute', right: 22, top: 26, width: 236, height: 219 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9 },
  heroChipText: T(fonts.bodyHeavy, 11, { letterSpacing: 0.88, textTransform: 'uppercase' }),
  heroKind: T(fonts.bodyHeavy, 14, { color: '#FFFFFF' }),
  heroText: { maxWidth: 470, gap: 4 },
  heroTitle: T(fonts.display, 40, { lineHeight: 40.8, letterSpacing: -0.8, color: '#FFFFFF' }),
  heroPhrase: T(fonts.bodyHeavy, 24, { color: '#FFFFFF' }),
  heroGoal: T(fonts.body, 14, { color: '#FFFFFF', marginTop: 4 }),
  steps: { flexDirection: 'row', gap: 8, maxWidth: 470 },
  step: { flex: 1, minWidth: 0, gap: 7 },
  stepTrack: { height: 6, borderRadius: 3, backgroundColor: '#6D8BFF', overflow: 'hidden' },
  stepFill: { height: 6, backgroundColor: '#FEFEFE' },
  stepLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepLabel: { fontWeight: 'normal', fontSize: 13, color: '#FFFFFF' },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cta: { height: 52, paddingHorizontal: 26, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ctaText: T(fonts.bodyHeavy, 16),
  ctaMeta: T(fonts.bodyBold, 14, { color: '#FFFFFF' }),

  // flexWrap — tor oynada tugmalar keyingi qatorga tushadi (1440 da bitta qator).
  live: { borderRadius: 24, paddingVertical: 18, paddingRight: 18, paddingLeft: 26, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 22, rowGap: 14 },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A5F' },
  liveOver: T(fonts.bodyHeavy, 12, { letterSpacing: 0.72, textTransform: 'uppercase', color: '#FF9A9E' }),
  timer: T(fonts.display, 34, { lineHeight: 35.7, color: '#FFFFFF', fontVariant: ['tabular-nums'] }),
  liveDivider: { width: 1, alignSelf: 'stretch', backgroundColor: '#263048' },
  liveTitle: T(fonts.bodyHeavy, 15, { color: '#FFFFFF' }),
  liveSub: T(fonts.body, 13, { color: '#B8C1D6' }),
  slidesBtn: { height: 48, paddingHorizontal: 16, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  slidesText: T(fonts.bodyHeavy, 14, { color: '#FFFFFF' }),
  groupBtn: { height: 48, paddingHorizontal: 18, borderRadius: 15, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  groupText: T(fonts.bodyHeavy, 14, { color: '#0B1220' }),

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  h2: T(fonts.bodyHeavy, 18),
  h2Extra: T(fonts.bodyBold, 14),
  sectionLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionLinkText: T(fonts.bodyHeavy, 14),
  practiceRow: { flexDirection: 'row', gap: 14 },
  practice: { flex: 1, minWidth: 0, borderRadius: 22, padding: 14, gap: 10 },
  practiceIcon: { width: 58, height: 58, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  practiceTitle: T(fonts.bodyHeavy, 15, { lineHeight: 18.75 }),
  practiceSub: T(fonts.bodyBold, 13),

  weekRow: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 8 },
  dayCell: { flex: 1, minWidth: 0, borderRadius: 18, paddingTop: 12, paddingHorizontal: 12, paddingBottom: 13, gap: 6 },
  dayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLabel: T(fonts.bodyHeavy, 13),
  badgeDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dayTitle: T(fonts.bodyHeavy, 15),
  daySub: T(fonts.bodyBold, 12, { marginTop: 'auto' }),

  bot: { backgroundColor: '#1B6FA8', borderRadius: 24, padding: 16, gap: 14, overflow: 'hidden', flexShrink: 0 },
  botCircle: { position: 'absolute', right: -40, top: -64, width: 150, height: 150, borderRadius: 75, backgroundColor: '#2384C4' },
  botRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  botIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#2AABEE', alignItems: 'center', justifyContent: 'center' },
  botTitle: T(fonts.bodyHeavy, 16, { color: '#FFFFFF' }),
  botSub: T(fonts.body, 13, { color: '#FFFFFF' }),
  botBtn: { height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  botBtnText: T(fonts.bodyHeavy, 15, { color: '#0B1220' }),

  goal: { borderRadius: 24, padding: 18, gap: 16 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  goalTitle: T(fonts.bodyHeavy, 16),
  goalSub: T(fonts.body, 14),
  streakHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  streakTitle: T(fonts.bodyHeavy, 15),
  streakNext: T(fonts.bodyBold, 13),
  days: { flexDirection: 'row', gap: 2 },
  day: { flex: 1, alignItems: 'center', gap: 5 },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 2.5, borderColor: '#FF7A1A' },
  todayNum: T(fonts.bodyHeavy, 13),
  dayName: T(fonts.bodyBold, 12),

  league: { borderRadius: 24, paddingTop: 18, paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  leagueHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  leagueIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  leagueSub: T(fonts.body, 13),
  leagueRow: { borderRadius: 14, paddingVertical: 7, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: T(fonts.bodyHeavy, 14, { width: 18, textAlign: 'center' }),
  leagueAvatar: { width: 34, height: 34, borderRadius: 17 },
  leagueName: T(fonts.bodyBold, 14),
  leagueStreak: T(fonts.body, 12),
  score: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  scoreText: T(fonts.bodyHeavy, 14),
  promote: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2, paddingHorizontal: 4 },
  promoteText: T(fonts.bodyBold, 13),

  bonus: { borderRadius: 24, paddingVertical: 14, paddingRight: 16, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bonusOver: T(fonts.bodyHeavy, 12, { letterSpacing: 0.72, textTransform: 'uppercase' }),
  bonusTitle: T(fonts.bodyHeavy, 15, { lineHeight: 18.75 }),
  bonusSub: T(fonts.bodyBold, 13),

  course: { flex: 1, minHeight: 0, borderRadius: 24, paddingVertical: 16, paddingHorizontal: 18, justifyContent: 'space-between', gap: 12 },
  courseHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  courseTitle: T(fonts.bodyHeavy, 15),
  coursePct: T(fonts.bodyHeavy, 14),
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  monthLabel: T(fonts.bodyHeavy, 12),
  monthSub: T(fonts.bodyBold, 12, { marginTop: -4 }),
  examRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  examText: T(fonts.bodyBold, 13, { flex: 1 }),
  // CSS white-space: nowrap — matn kesilmaydi, katakdan biroz chiqsa ham (dizayndagidek).
  nowrap: { whiteSpace: 'nowrap', overflow: 'visible' } as TextStyle,
});
