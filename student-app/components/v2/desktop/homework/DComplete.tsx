/**
 * Kompyuter: Dars tugadi (dizayn: D_Complete). Ma'lumot mobil tugadi.tsx
 * bilan aynan bir xil: coin — shu darsda yig'ilgani (useLessonCoins),
 * chaqmoq = coin, streak serverda yo'q — 0, kunlik maqsad va liga —
 * reyting, xatolar — scoreStore, keyingi dars sanasi — demo-schedule.
 * Sarlavhadagi "Qadam N / 5" va pastki qator — darsning qadamlari (lessonSteps).
 * Klaviatura: Enter — "Davom etish".
 */
import { lessonGoal } from '@/components/v2/home/lessonGoal';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { stripRichText } from '@/components/RichText';
import { FocusFrame, FocusProgress } from '@/components/v2/desktop/Shell';
import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { useHomeworkScores } from '@/components/v2/homework/scoreStore';
import { fullDay, getAudioTracks, lessonSteps, loadCourseData, pad, scheduleDates, splitTitle, stepsDone, useListened, type CourseData } from '@/components/v2/lessons/data';
import { AnimatedFill, Bounce, Confetti, CountUp, FadeInUp } from '@/components/v2/motion';
import { TIERS } from '@/components/v2/rewards/parts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { useLessonCoins } from '@/services/coinsStore';
import { fetchDemoSchedule, fetchLeaderboard, type LeaderboardEntryResponse } from '@/services/contentApi';
import { playSfx, playSfxLater } from '@/services/sfx';
import { speak, stopVoice } from '@/services/voicePraise';

import { BigButton, caps, IBolt, ICheck, IChevron, ICoin, IFlame, IVideo, Txt } from './dui';

/** Kunlik chaqmoq maqsadi — mobil bilan bir xil. */
const DAILY_GOAL = 50;

export function DComplete() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const id = String(lessonId);
  const [data, setData] = useState<CourseData | null>(null);
  const [schedule, setSchedule] = useState<{ startsAt: Date | null; pattern: 'mwf' | 'tts'; lessonTime: string }>({ startsAt: null, pattern: 'mwf', lessonTime: '' });
  const [today, setToday] = useState(0);
  const [week, setWeek] = useState<LeaderboardEntryResponse | null>(null);
  const coins = useLessonCoins(id);
  const scores = useHomeworkScores()[id];
  const listened = useListened(id);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadCourseData().then((d) => !cancelled && setData(d)).catch(() => {});
      fetchDemoSchedule()
        .then((s) => !cancelled && setSchedule({ startsAt: s.startsAt ? new Date(s.startsAt) : null, pattern: s.schedulePattern, lessonTime: s.lessonTime }))
        .catch(() => {});
      fetchLeaderboard('country', 'daily')
        .then((e) => !cancelled && setToday(e.find((x) => x.isMe)?.lightning ?? 0))
        .catch(() => {});
      fetchLeaderboard('country', 'weekly')
        .then((e) => !cancelled && setWeek(e.find((x) => x.isMe) ?? null))
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Bayram: fanfara + maqtov; coin bo'lsa — "jiring" (mobil kabi).
  useEffect(() => {
    playSfx('complete');
    speak('complete', 1800);
    return () => stopVoice();
  }, []);
  useEffect(() => {
    if (coins > 0) return playSfxLater('coin', 1100);
  }, [coins > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = () => router.replace(R.path as Href);
  useDesktopKeys({ Enter: go });

  const lesson = data?.lessons.find((l) => l.id === id);
  const next = lesson && data ? data.lessons[lesson.index + 1] : undefined;
  const dates = schedule.startsAt && data && next ? scheduleDates(schedule.startsAt, schedule.pattern, data.activeIndex, next.index) : {};
  const nextDate = next ? dates[next.index] : undefined;
  const { title, phrase } = splitTitle(lesson?.name ?? '');
  const konspekt = stripRichText(lessonGoal(data?.mc.lessonContents[id]?.konspekt))?.trim();
  const outcome = konspekt && title && konspekt.toLowerCase().startsWith(title.toLowerCase()) ? konspekt.slice(title.length).trim() : konspekt;
  const nextShort = next ? splitTitle(next.name).title.split(':')[0] : '';
  const ownDate = lesson && data && schedule.startsAt ? scheduleDates(schedule.startsAt, schedule.pattern, data.activeIndex, lesson.index)[lesson.index] : undefined;
  const liveTime = ownDate ? `${pad(ownDate.getHours())}:${pad(ownDate.getMinutes())}` : (schedule.lessonTime.match(/^\d{1,2}:\d{2}/)?.[0] ?? '');
  const mistakes = Object.values(scores ?? {}).reduce((a, p) => a + (p.mistakes?.length ?? 0), 0);
  const goalDone = today >= DAILY_GOAL;

  // Dars qadamlari (So'zlar · Audio · Jonli dars/Videodars · Vazifa · Yakunlash).
  const tracks = data && lesson ? getAudioTracks(data.mc, id) : [];
  const heard = listened.filter((x) => tracks.some((t) => t.id === x)).length;
  const steps = lesson ? lessonSteps(lesson, tracks.length, heard) : [];
  const allDone = steps.length > 0 && steps.every((s) => s.done);
  const summary = lesson
    ? `Yangi soʻzlar ${lesson.content.vocabulary.length} · audio dialoglar ${tracks.length} · ${lesson.isVideo ? 'videodars' : 'jonli dars'} · uyga vazifa — ${allDone ? 'hammasi bajarildi' : `${stepsDone(steps)} / ${steps.length} bajarildi`}`
    : '';
  const head = lesson ? (title && title !== `${lesson.number}-dars` ? `${lesson.number}-dars · ${title}` : `${lesson.number}-dars`) : 'Dars';

  return (
    <FocusFrame
      closeTo={R.home}
      title={head}
      subtitle="Darsni yakunlash"
      center={
        steps.length > 0 ? (
          <FocusProgress
            width={420}
            left={`Qadam ${stepsDone(steps)} / ${steps.length}`}
            right={allDone ? 'Dars tugadi' : undefined}
            rightColor="#075E3A"
            segments={steps.map((s) => (s.done ? '#087A4A' : '#E2E6EE'))}
            label={`${steps.length} qadamdan ${stepsDone(steps)} tasi bajarildi`}
          />
        ) : null
      }
      footer={
        <>
          <Txt f="bodyBold" size={15} color="#4A5468" numberOfLines={1} style={{ flexShrink: 1 }}>
            {summary}
          </Txt>
          <View style={{ flex: 1 }} />
          <BigButton label="Davom etish" kind="primary" arrow kbd="Enter" onPress={go} />
        </>
      }
      footerHeight={112}
      footerWidth={1120}
    >
      <View style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 24 }}>
        <View style={{ width: 1120, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 48 }}>
          <View style={{ width: 470, flexShrink: 0, alignItems: 'center', gap: 12 }}>
            <View style={st.hero}>
              <View style={[st.conf, { left: 22, top: 40, width: 14, height: 26, backgroundColor: '#2F5BFF', transform: [{ rotate: '-24deg' }] }]} />
              <View style={[st.conf, { right: 30, top: 30, width: 12, height: 22, backgroundColor: '#F5B70A', transform: [{ rotate: '30deg' }] }]} />
              <View style={[st.conf, { right: 14, bottom: 80, width: 12, height: 24, backgroundColor: '#FF7A1A', transform: [{ rotate: '-40deg' }] }]} />
              <View style={[st.conf, { left: 34, bottom: 60, width: 10, height: 20, backgroundColor: '#087A4A', transform: [{ rotate: '20deg' }] }]} />
              <Bounce>
                <Image source={designImages.cd192c1f07c6ae01a6b80b26d84e0ec7} style={{ width: 300, height: 300 }} resizeMode="contain" accessibilityLabel="Domik bayram qilmoqda" />
              </Bounce>
            </View>
            <Txt f="display" size={52} lh={54.6} style={{ letterSpacing: -1.04, textAlign: 'center', marginTop: 12 }} accessibilityRole="header">
              {lesson ? `${lesson.number}-dars tugadi!` : 'Dars tugadi!'}
            </Txt>
            {!!lesson && (
              <Txt f="body" size={18} color="#4A5468" style={{ textAlign: 'center' }}>
                {outcome ? `${title} — ${outcome}` : phrase ? `${title} — ${phrase}` : title}
              </Txt>
            )}
            {!!lesson && !lesson.isVideo && lesson.attendanceTaken && (
              <View style={st.attended}>
                <ICheck size={17} color="#087A4A" sw={3} />
                <Txt f="bodyHeavy" size={15} color="#075E3A">
                  Jonli dars{liveTime ? ` · ${liveTime}` : ''} · qatnashdingiz
                </Txt>
              </View>
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 18 }}>
            <FadeInUp delay={220}>
              {/* Streak serverda yo'q — 0 holatida (mobil kabi). */}
              <View accessibilityLabel="Seriya" style={st.streak}>
                <IFlame size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt f="bodyHeavy" size={20}>
                    Streak: 0 kun
                  </Txt>
                  <Txt f="bodyBold" size={15} color="#B34700">
                    Ertaga ham davom eting!
                  </Txt>
                </View>
                <Txt f="display" size={48} color="#B34700" style={{ letterSpacing: -0.96 }}>
                  0
                </Txt>
              </View>
            </FadeInUp>
            <FadeInUp delay={320}>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <View style={st.stat}>
                  <ICoin size={38} />
                  <View style={{ gap: 2 }}>
                    <CountUp value={coins} delay={450} prefix="+" suffix=" coin" style={st.statCoin} />
                    <Txt f="bodyBold" size={13} color="#4A5468">
                      +{coins} vazifa · +0 dars
                    </Txt>
                  </View>
                </View>
                <View style={st.stat}>
                  <IBolt size={38} />
                  <View style={{ gap: 2 }}>
                    <CountUp value={coins} delay={450} prefix="+" style={[st.statCoin, { color: '#6A3CF0' }]} />
                    <Txt f="bodyBold" size={13} color="#4A5468">
                      chaqmoq
                    </Txt>
                  </View>
                </View>
              </View>
            </FadeInUp>
            <FadeInUp delay={420}>
              <View accessibilityLabel="Kunlik maqsad" style={st.goal}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt f="bodyHeavy" size={16}>
                    {goalDone ? 'Kunlik maqsad bajarildi' : 'Kunlik maqsad'}
                  </Txt>
                  <Txt f="bodyHeavy" size={16} color="#075E3A">
                    {today} / {DAILY_GOAL} chaqmoq
                  </Txt>
                </View>
                <View style={{ height: 10, borderRadius: 5, backgroundColor: '#E2E6EE', overflow: 'hidden' }}>
                  <AnimatedFill pct={Math.min(100, (today / DAILY_GOAL) * 100)} color="#087A4A" height={10} radius={5} delay={520} fromZero />
                </View>
                <Txt f="bodyBold" size={14} color="#4A5468">
                  Liga: {week?.lightning ?? 0} chaqmoq · {TIERS[0].name} liga{week ? `, ${week.rank}-oʻrin` : ''}
                </Txt>
              </View>
            </FadeInUp>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Bugungi xatolar, ${mistakes} ta: takrorlandi 0 / ${mistakes}. Qayta koʻrish`}
              onPress={() => router.push(R.mistakes(id) as Href)}
              style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [st.mist, hovered && { opacity: 0.92 }]}
            >
              <View style={st.mistIcon}>
                <ICheck size={18} color="#087A4A" sw={3} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <Txt f="bodyHeavy" size={16}>
                  Bugungi xatolar · {mistakes} ta
                </Txt>
                <Txt f="bodyBold" size={13} color="#075E3A">
                  Takrorlandi 0 / {mistakes} · qayta koʻrish
                </Txt>
              </View>
              <IChevron size={18} color="#075E3A" />
            </Pressable>
            {next && (
              <Pressable accessibilityRole="link" onPress={() => router.push(R.lesson(next.id) as Href)} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [st.next, hovered && { backgroundColor: '#FAFBFD' }]}>
                <View style={st.nextIcon}>
                  <IVideo size={20} color="#2F5BFF" />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <Txt f="bodyHeavy" size={12} color="#4A5468" style={caps(12)}>
                    Keyingi{nextDate ? ` · ${fullDay(nextDate)}` : ''}
                  </Txt>
                  <Txt f="bodyHeavy" size={16} numberOfLines={1}>
                    {next.number}-dars · {nextShort}
                  </Txt>
                </View>
                <IChevron size={18} color="#5B6478" />
              </Pressable>
            )}
          </View>
        </View>
      </View>
      <Confetti />
    </FocusFrame>
  );
}

const st = StyleSheet.create({
  hero: { width: 350, height: 350, borderRadius: 175, backgroundColor: '#FFF4D1', alignItems: 'center', justifyContent: 'center' },
  conf: { position: 'absolute', borderRadius: 4 },
  attended: { height: 38, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#E3F7EE', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  streak: { backgroundColor: '#FFF1E6', borderRadius: 24, paddingVertical: 24, paddingHorizontal: 26, flexDirection: 'row', alignItems: 'center', gap: 16 },
  stat: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 22, flexDirection: 'row', alignItems: 'center', gap: 14 },
  statCoin: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 24, color: '#7A5300' },
  goal: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 20, paddingHorizontal: 22, gap: 10 },
  mist: { backgroundColor: '#E3F7EE', borderRadius: 22, paddingVertical: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  mistIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  next: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  nextIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
