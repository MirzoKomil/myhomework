/**
 * v2 Dars tugadi (dizayn: 16 Complete).
 *
 * Coin — shu darsda yig'ilgan haqiqiy coinlar (coinsStore.useLessonCoins).
 * Chaqmoq darslar bo'yicha alohida saqlanmaydi; eski ilovada har to'g'ri
 * javob uchun +1 coin va +1 chaqmoq birga beriladi, shuning uchun shu
 * darsdagi chaqmoq coin soniga teng deb ko'rsatiladi.
 * Streak serverda yo'q — dizayndagi blok 0 holatida turadi.
 * Keyingi dars — darslar ro'yxatidagi navbatdagisi, sanasi demo-schedule'dan.
 * Coin: hammasi vazifadan (har to'g'ri javob +1); dars uchun alohida bonus
 * serverda yo'q — "+0 dars". Kunlik maqsad — bosh ekrandagi kabi kunlik
 * reytingdagi o'z chaqmog'i / 50; liga qatori — haftalik reytingdagi o'rin
 * (liga pog'onasi serverda yo'q — hamma Bronza, ko'tarilish belgisi yo'q).
 * Bugungi xatolar — vazifa natijalaridagi xatolar (scoreStore); takrorlash
 * holati saqlanmaydi — 0.
 */
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { speak } from '@/services/voicePraise';

import { useHomeworkScores } from '@/components/v2/homework/scoreStore';
import { fullDay, loadCourseData, pad, scheduleDates, splitTitle, type CourseData } from '@/components/v2/lessons/data';
import { ArrowRight, BoltIcon, Check, ChevronRight, CircleCheckIcon, CoinIcon, FlameIcon, VideoBoxIcon } from '@/components/v2/lessons/icons';
import { TIERS } from '@/components/v2/rewards/parts';
import { BottomBar, Column, HeaderButton } from '@/components/v2/lessons/parts';
import { stripRichText } from '@/components/RichText';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { fetchDemoSchedule, fetchLeaderboard, type LeaderboardEntryResponse } from '@/services/contentApi';
import { useLessonCoins } from '@/services/coinsStore';
import { AnimatedFill, Bounce, Confetti, CountUp, FadeInUp, Flicker } from '@/components/v2/motion';
import { playSfx, playSfxLater } from '@/services/sfx';

/** Kunlik chaqmoq maqsadi — bosh ekrandagi bilan bir xil (sozlanadigan maqsad hali yo'q). */
const DAILY_GOAL = 50;

export default function CompleteScreen() {
  const insets = useSafeAreaInsets();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const id = String(lessonId);
  const [data, setData] = useState<CourseData | null>(null);
  const [schedule, setSchedule] = useState<{ startsAt: Date | null; pattern: 'mwf' | 'tts'; lessonTime: string }>({ startsAt: null, pattern: 'mwf', lessonTime: '' });
  const [today, setToday] = useState(0);
  const [week, setWeek] = useState<LeaderboardEntryResponse | null>(null);
  const coins = useLessonCoins(id);
  const scores = useHomeworkScores()[id];

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

  const lesson = data?.lessons.find((l) => l.id === id);
  const next = lesson && data ? data.lessons[lesson.index + 1] : undefined;
  const dates = schedule.startsAt && data && next ? scheduleDates(schedule.startsAt, schedule.pattern, data.activeIndex, next.index) : {};
  const nextDate = next ? dates[next.index] : undefined;
  const { title, phrase } = splitTitle(lesson?.name ?? '');
  // Bir qatorli kichik sarlavha — belgilash ko'rsatilmaydi, faqat toza matn.
  const konspekt = stripRichText(data?.mc.lessonContents[id]?.konspekt)?.trim();
  // Dars natijasi (dizayn: "… — endi buyurtma bera olasiz") — CRM konspekti ("Darsdan keyin" matni);
  // sarlavha bilan boshlansa takrorlanmasin deb sarlavha qismi olib tashlanadi.
  const outcome = konspekt && title && konspekt.toLowerCase().startsWith(title.toLowerCase()) ? konspekt.slice(title.length).trim() : konspekt;
  const nextShort = next ? splitTitle(next.name).title.split(':')[0] : '';
  // Jonli dars vaqti: jadvaldagi sana (bo'lsa), aks holda guruh dars vaqti.
  const ownDate = lesson && data && schedule.startsAt ? scheduleDates(schedule.startsAt, schedule.pattern, data.activeIndex, lesson.index)[lesson.index] : undefined;
  const liveTime = ownDate ? `${pad(ownDate.getHours())}:${pad(ownDate.getMinutes())}` : (schedule.lessonTime.match(/^\d{1,2}:\d{2}/)?.[0] ?? '');
  const mistakes = Object.values(scores ?? {}).reduce((a, p) => a + (p.mistakes?.length ?? 0), 0);
  const goalDone = today >= DAILY_GOAL;
  // Bayram: konfetti + fanfara; coin bo'lsa — sanash tugaganda "jiring".
  useEffect(() => {
    playSfx('complete');
    speak('complete', 1550);
  }, []);
  useEffect(() => {
    if (coins > 0) playSfxLater('coin', 1100);
  }, [coins > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.screen}>
      <Column>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 44) + 10 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.closeRow}>
            <HeaderButton kind="close" label="Yopish" fallback={R.home} />
          </View>
          <View style={styles.hero}>
            <Bounce>
              <Image source={designImages.cd192c1f07c6ae01a6b80b26d84e0ec7} style={{ width: 146, height: 136 }} resizeMode="contain" accessibilityLabel="Domik bayram qilmoqda" />
            </Bounce>
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text accessibilityRole="header" style={styles.h1}>{lesson ? `${lesson.number}-dars tugadi!` : 'Dars tugadi!'}</Text>
            {!!lesson && <Text style={styles.sub}>{outcome ? `${title} — ${outcome}` : phrase ? `${title} — ${phrase}` : title}</Text>}
            {!!lesson && !lesson.isVideo && lesson.attendanceTaken && (
              <View style={styles.attended}>
                <Check size={15} color="#087A4A" strokeWidth={3} />
                <Text style={styles.attendedText}>Jonli dars{liveTime ? ` · ${liveTime}` : ''} · qatnashdingiz</Text>
              </View>
            )}
          </View>
          <FadeInUp delay={220} style={{ alignSelf: 'stretch' }}>
          <View accessibilityLabel="Streak" style={styles.streak}>
            <Flicker>
              <FlameIcon />
            </Flicker>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.streakTitle}>Streak: 0 kun</Text>
              <Text style={styles.small}>Ertaga ham davom eting!</Text>
            </View>
            <Text style={styles.streakNum}>0</Text>
          </View>
          </FadeInUp>
          <FadeInUp delay={320} style={{ alignSelf: 'stretch' }}>
          <View style={styles.grid}>
            <View style={styles.stat}>
              <CoinIcon />
              <View style={styles.statText}>
                <CountUp value={coins} delay={450} prefix="+" suffix=" coin" style={[styles.statNum, { color: '#7A5300' }]} />
                <Text style={styles.statLabel} numberOfLines={1}>+{coins} vazifa · +0 dars</Text>
              </View>
            </View>
            <View style={styles.stat}>
              <BoltIcon />
              <View style={styles.statText}>
                <CountUp value={coins} delay={450} prefix="+" style={[styles.statNum, { color: '#5A2FD6' }]} />
                <Text style={styles.statLabel}>chaqmoq</Text>
              </View>
            </View>
          </View>
          </FadeInUp>
          <FadeInUp delay={420} style={{ alignSelf: 'stretch' }}>
          <View accessibilityLabel="Kunlik maqsad" style={styles.goal}>
            <View style={styles.goalHead}>
              <Text style={styles.goalTitle}>{goalDone ? 'Kunlik maqsad bajarildi' : 'Kunlik maqsad'}</Text>
              <Text style={styles.goalNum}>{today} / {DAILY_GOAL} chaqmoq</Text>
            </View>
            <View style={styles.goalTrack}>
              <AnimatedFill pct={Math.min(100, (today / DAILY_GOAL) * 100)} color="#12A06B" height={8} radius={4} delay={520} fromZero />
            </View>
            <Text style={styles.goalSub}>
              Liga: {week?.lightning ?? 0} chaqmoq · {TIERS[0].name} liga{week ? `, ${week.rank}-oʻrin` : ''}
            </Text>
          </View>
          </FadeInUp>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Bugungi xatolar, ${mistakes} ta: takrorlandi 0 / ${mistakes}. Qayta koʻrish`}
            onPress={() => router.push(R.mistakes(id) as Href)}
            style={({ pressed }) => [styles.mist, pressed && { opacity: 0.85 }]}
          >
            <CircleCheckIcon />
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <Text style={styles.mistTitle}>Bugungi xatolar · {mistakes} ta</Text>
              <Text style={styles.mistSub}>Takrorlandi 0 / {mistakes} · qayta koʻrish</Text>
            </View>
            <ChevronRight size={16} color="#075E3A" />
          </Pressable>
          {next && (
            <Pressable accessibilityRole="link" onPress={() => router.push(R.lesson(next.id) as Href)} style={({ pressed }) => [styles.next, pressed && { opacity: 0.85 }]}>
              <View style={styles.nextIcon}><VideoBoxIcon /></View>
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <Text style={styles.nextOver}>Keyingi{nextDate ? ` · ${fullDay(nextDate)}` : ''}</Text>
                <Text style={styles.nextTitle}>{next.number}-dars · {nextShort}</Text>
              </View>
              <ChevronRight />
            </Pressable>
          )}
        </ScrollView>
        <BottomBar style={{ paddingBottom: Math.max(insets.bottom, 0) + 28 }}>
          <Pressable accessibilityRole="link" onPress={() => router.replace(R.path as Href)} style={({ pressed }) => [styles.cta, pressed && { backgroundColor: '#1E3FD1' }]}>
            <Text style={styles.ctaText}>Davom etish</Text>
            <ArrowRight />
          </Pressable>
        </BottomBar>
      </Column>
      <Confetti />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { paddingHorizontal: 20, alignItems: 'center', gap: 14, paddingBottom: 12 },
  closeRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'flex-end' },
  hero: { width: 156, height: 128, borderRadius: 78, backgroundColor: '#FFF4D1', alignItems: 'center', justifyContent: 'center', marginTop: -30 },
  attended: { alignSelf: 'center', marginTop: 4, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#E3F7EE', flexDirection: 'row', alignItems: 'center', gap: 6 },
  attendedText: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: '#075E3A', fontWeight: 'normal' },
  h1: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40, letterSpacing: -0.64, color: '#0B1220', textAlign: 'center', fontWeight: 'normal' },
  sub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20.5, color: '#4A5468', textAlign: 'center', fontWeight: 'normal' },
  streak: { alignSelf: 'stretch', backgroundColor: '#FFF1E6', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  streakTitle: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: '#0B1220', fontWeight: 'normal' },
  small: { fontFamily: fonts.body, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  streakNum: { fontFamily: fonts.display, fontSize: 34, color: '#B34700', fontWeight: 'normal' },
  grid: { alignSelf: 'stretch', flexDirection: 'row', gap: 12 },
  // Dizayndagi "1fr 1fr" to'r: matn sig'masa ustun kengayadi (min-width: auto).
  stat: { flexGrow: 1, flexBasis: 0, minWidth: 'auto', backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statText: { minWidth: 'auto' },
  statNum: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, fontWeight: 'normal' },
  statLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#4A5468', fontWeight: 'normal' },
  goal: { alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalTitle: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#0B1220', fontWeight: 'normal' },
  goalNum: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: '#075E3A', fontWeight: 'normal' },
  goalTrack: { height: 8, borderRadius: 4, backgroundColor: '#E2E6EE', overflow: 'hidden' },
  goalFill: { height: 8, borderRadius: 4, backgroundColor: '#12A06B' },
  goalSub: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#4A5468', fontWeight: 'normal' },
  mist: { alignSelf: 'stretch', minHeight: 52, backgroundColor: '#E3F7EE', borderRadius: 18, paddingVertical: 6, paddingLeft: 14, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mistTitle: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#0B1220', fontWeight: 'normal' },
  mistSub: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#075E3A', fontWeight: 'normal' },
  next: { alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 12, paddingLeft: 16, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  nextOver: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: '#4A5468', textTransform: 'uppercase', letterSpacing: 0.48, fontWeight: 'normal' },
  nextTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, lineHeight: 21, color: '#0B1220', fontWeight: 'normal' },
  cta: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 5px 0 #1E3FD1' } as object,
  ctaText: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: '#FFFFFF', fontWeight: 'normal' },
});
