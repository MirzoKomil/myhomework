/**
 * v2 Bosh sahifa (dizayn: Main.dc.html, MainNoBot.dc.html, DarkMain.dc.html).
 *
 * - Telegram bot ulanmagan bo'lsa (telegramLinkStatus().linked === false)
 *   "Telegram botni ulang" kartasi chiqadi va BotConnect oynasi ochiladi.
 * - Qurilma qorong'u rejimda bo'lsa DarkMain ranglari ishlatiladi.
 * - Faqat haqiqiy ma'lumot: joriy dars va bosqichlari, jonli dars taymeri,
 *   coin (qurilmada), bugungi chaqmoq (kunlik reyting), bildirishnomalar.
 *   Streak va haftalik kunlar uchun serverda ma'lumot yo'q — nol holat.
 */
import { tashkentNow } from '@/components/v2/home/lessonGoal';
import { Redirect, router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { CountUp, FadeInUp, Flicker } from '@/components/v2/motion';
import { playSfxLater } from '@/services/sfx';

import { HomeNav } from '@/components/v2/home/HomeNav';
import { ArrowRight, BellIcon, BoltIcon, ChevronRightIcon, CoinIcon, FlameIcon, TelegramIcon } from '@/components/v2/home/icons';
import { darkHome, lightHome, type HomePalette } from '@/components/v2/home/palette';
import { resolveCurrentLesson, type CurrentLesson } from '@/components/v2/home/currentLesson';
import { buildSession, loadReviews } from '@/components/v2/home/reviewStore';
import { currentStep as firstOpenStep, lessonSteps, stepsDone, useListened } from '@/components/v2/lessons/data';
import { displayFont, getReadIds } from '@/components/v2/home/shared';
import { groupFromTopic } from '@/components/v2/profile/shared';
import { BotConnectPopup } from '@/components/v2/popups/BotConnect';
import { DMain } from '@/components/v2/desktop/home/DMain';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';
import { Loading } from '@/components/v2/states/Loading';
import { ServerError } from '@/components/v2/states/ServerError';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { V2_BATTLE_WIN_COINS } from '@/constants/v2/battle';
import { useAvatarUri } from '@/services/avatarStore';
import { getTotalCoins, useCoins } from '@/services/coinsStore';
import { fetchMyProgress } from '@/services/progressSync';
import {
  fetchDemoNotifications,
  fetchDemoSchedule,
  fetchDemoStudentProfile,
  fetchLeaderboard,
} from '@/services/contentApi';
import { clearAuth, useAuth } from '@/services/studentAuthStore';
import { telegramLinkStatus } from '@/services/telegramLinkApi';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';
import { useCachedState } from '@/services/v2Cache';

/** Kunlik chaqmoq maqsadi — dizayndagi qiymat (sozlanadigan maqsad hali yo'q). */
const DAILY_GOAL = 50;
/** Bosh ekrandan oxirgi chiqilgandagi coin — qaytganda o'sgan bo'lsa pill sanab ko'rsatadi. */
let coinsSeenOnHome: number | null = null;
const RING_C = 2 * Math.PI * 23; // ≈144.5, dizayndagi dasharray

type LiveLesson = { startsAt: Date; topic: string; link: string };

const pad = (n: number) => String(n).padStart(2, '0');
const DAY_SHORT = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
const DAY_FULL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

function greeting(now: Date) {
  const h = tashkentNow(now).getHours();
  if (h >= 5 && h < 11) return 'Xayrli tong';
  if (h >= 11 && h < 17) return 'Xayrli kun';
  if (h >= 17 && h < 23) return 'Xayrli kech';
  return 'Xayrli tun';
}

/** Jadval mavzusidagi guruh nomi ("32-dars · R-14 guruh" → "R-14"); topilmasa ''. */
function groupName(topic: string) {
  return topic.match(/\b([A-Za-zА-Яа-я]{1,4}-\d+)\b/)?.[1] ?? '';
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

const WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
function whenLabel(date: Date, now: Date) {
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(date) - day(now)) / 86400000);
  if (diff === 0) return `bugun ${time}`;
  if (diff === 1) return `ertaga ${time}`;
  return `${WEEKDAYS[date.getDay()]} ${time}`;
}

export default function V2Home() {
  return useIsDesktop() ? <DMain /> : <V2HomeMobile />;
}

function V2HomeMobile() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const p: HomePalette = scheme === 'dark' ? darkHome : lightHome;
  const { token, student } = useAuth();
  const coins = useCoins();
  const [coinFrom, setCoinFrom] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      const seen = coinsSeenOnHome;
      setCoinFrom(seen);
      const cancelCoin = seen !== null && getTotalCoins() > seen ? playSfxLater('coin', 450) : undefined;
      return () => {
        cancelCoin?.();
        coinsSeenOnHome = getTotalCoins();
      };
    }, []),
  );
  const avatarUri = useAvatarUri();
  const isEmbedded = Platform.OS === 'web' && typeof window !== 'undefined' && window.self !== window.top;

  const [name, setName] = useCachedState('home.name', student?.name?.split(' ')[0] ?? '');
  const [unread, setUnread] = useCachedState('home.unread', 0);
  const [lesson, setLesson] = useCachedState<CurrentLesson | null | undefined>('home.lesson', undefined);
  const [lessonError, setLessonError] = useState(false);
  const [live, setLive] = useCachedState<LiveLesson | null>('home.live', null);
  const [now, setNow] = useState(() => new Date());
  const [botLinked, setBotLinked] = useCachedState('home.botLinked', true);
  const [botOpen, setBotOpen] = useState(false);
  const [botMandatory, setBotMandatory] = useState(false);
  const [todayLightning, setTodayLightning] = useCachedState('home.todayLightning', 0);
  const [wordCount, setWordCount] = useCachedState<number | null>('home.wordCount', null);
  // Lesson ekrani bilan bir xil 5 qadam uchun tinglangan dialoglar.
  const listened = useListened(lesson?.id ?? '');
  // Streak — serverdagi kunlik tanga/chaqmoq tarixidan (ketma-ket faol kunlar).
  const [streak, setStreak] = useCachedState('home.streak', 0);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchMyProgress()
      .then((p) => {
        if (!cancelled && p) setStreak(p.streak);
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
      })
      .catch(() => {});
    fetchDemoSchedule()
      .then((s) => {
        if (s.startsAt && s.telegramGroupLink) setLive({ startsAt: new Date(s.startsAt), topic: s.topic, link: s.telegramGroupLink });
      })
      .catch(() => {});
  }, [token, isEmbedded]);

  const loadLesson = useCallback(() => {
    setLessonError(false);
    resolveCurrentLesson().then(setLesson).catch(() => setLessonError(true));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!token && !isEmbedded) return;
      loadLesson();
      // "N ta soʻz" — WordReview seansining o'zi (muddati kelgan + yangi, ko'pi bilan 12).
      Promise.all([getAccumulatedVocabulary(), loadReviews()])
        .then(([w, r]) => setWordCount(buildSession(w, r).length))
        .catch(() => {});
      Promise.all([fetchDemoNotifications(), getReadIds()])
        .then(([list, read]) => setUnread(list.filter((n) => n.unread && !read.has(n.id)).length))
        .catch(() => {});
      // Bugungi chaqmoq — kunlik reytingdagi o'quvchining o'z qatori.
      fetchLeaderboard('country', 'daily')
        .then((entries) => setTodayLightning(entries.find((e) => e.isMe)?.lightning ?? 0))
        .catch(() => {});
      // Bot holati: faqat aniq "ulanmagan" javobi kelganda karta ko'rsatiladi.
      if (token) {
        telegramLinkStatus().then((s) => {
          setBotLinked(s.linked);
          // Admin kampaniyasi: ulanmagan o'quvchiga yopilmaydigan oyna.
          setBotMandatory(!!s.mandatory && !s.linked);
          if (s.mandatory && !s.linked) setBotOpen(true);
        }).catch(() => setBotLinked(true));
      }
    }, [token, isEmbedded, loadLesson]),
  );

  const msLeft = live ? live.startsAt.getTime() - now.getTime() : -1;
  const showTimer = msLeft > 0 && msLeft < 24 * 3600 * 1000;
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(new Date()), showTimer ? 1000 : 60000);
    return () => clearInterval(id);
  }, [live, showTimer]);

  if (!token && !isEmbedded) return <Redirect href={R.login as Href} />;
  if (lessonError) return <ServerError onRetry={loadLesson} />;
  if (lesson === undefined) return <Loading />;

  const liveVisible = !!live && msLeft > -2 * 3600 * 1000;
  const goal = Math.min(todayLightning, DAILY_GOAL);
  // Qadamlar — Lesson ekranidagi lessonSteps bilan aynan bir xil (5 ta).
  const steps = lesson
    ? lessonSteps(
        { id: lesson.id, isVideo: lesson.isVideoDay, content: lesson.content },
        lesson.trackIds.length,
        listened.filter((x) => lesson.trackIds.includes(x)).length,
      )
    : [];
  const totalSteps = steps.length;
  const doneSteps = stepsDone(steps);
  const currentStep = firstOpenStep(steps) + 1;

  // Haftalik qator: oxirgi 6 kun + bugun (dizayndagi tartib).
  const days = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    return { short: DAY_SHORT[d.getDay()], full: `${DAY_FULL[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}` };
  });

  return (
    <View style={[styles.screen, { backgroundColor: p.bg }]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 44) + 10 }]} showsVerticalScrollIndicator={false}>
        <FadeInUp style={styles.column} distance={8} duration={320}>
          {/* Sarlavha */}
          <View style={styles.header}>
            <Pressable accessibilityRole="link" accessibilityLabel="Profil" onPress={() => router.push(R.profile as Href)} style={[styles.avatar, { backgroundColor: p.avatarBg }]}>
              <Image source={avatarUri ? { uri: avatarUri } : designImages['93faebd4826b1da6adaee5d0dcda6209']} style={styles.avatarImg} />
            </Pressable>
            <View style={styles.hello}>
              <Text style={[styles.greet, { color: p.muted }]}>{greeting(now)}</Text>
              <Text style={[styles.name, { color: p.text }]} numberOfLines={1}>{name || ' '}</Text>
            </View>
            <Pressable accessibilityRole="link" accessibilityLabel={`${coins} coin, doʻkon`} onPress={() => router.push(R.shop as Href)} style={[styles.pill, { backgroundColor: p.pillBg, gap: 4 }]}>
              <CoinIcon />
              {coinFrom !== null && coins > coinFrom ? (
                <CountUp key={coinFrom} value={coins} from={coinFrom} duration={700} delay={350} style={[styles.pillText, { color: p.coinText }]} />
              ) : (
                <Text style={[styles.pillText, { color: p.coinText }]}>{coins}</Text>
              )}
            </Pressable>
            <Pressable accessibilityRole="link" accessibilityLabel={`Seriya ${streak} kun, holat`} onPress={() => router.push(R.streak as Href)} style={[styles.pill, { backgroundColor: p.pillBg, gap: 3 }]}>
              {streak > 0 ? (
                <Flicker>
                  <FlameIcon />
                </Flicker>
              ) : (
                <FlameIcon />
              )}
              <Text style={[styles.pillText, { color: p.streakText }]}>{streak}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={unread ? `Bildirishnomalar, ${unread} ta yangi` : 'Bildirishnomalar'}
              onPress={() => router.push(R.notifications as Href)}
              style={[styles.bell, { backgroundColor: p.pillBg }]}
            >
              <BellIcon color={p.bellStroke} />
              {unread > 0 && (
                <View style={[styles.badge, { borderColor: p.badgeBorder }]}>
                  <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Telegram bot ulanmagan (MainNoBot) */}
          {!botLinked && (
            <View accessibilityLabel="Telegram bot ulanmagan" style={styles.bot}>
              {/* Bezak doira alohida qatlamda kesiladi — karta o'zi kesilmaydi (dizayn). */}
              <View style={styles.botDeco} pointerEvents="none">
                <View style={styles.botCircle} />
              </View>
              <View style={styles.botIcon}>
                <TelegramIcon size={24} color="#FFFFFF" />
              </View>
              <View style={styles.botText}>
                <Text style={styles.botTitle}>Telegram botni ulang</Text>
                <Text style={styles.botSub}>Dars eslatmalari Telegramga keladi</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setBotOpen(true)} style={styles.botBtn}>
                <Text style={styles.botBtnText}>Ulash</Text>
              </Pressable>
            </View>
          )}

          {/* Bugungi dars */}
          {lesson && (
            <View accessibilityLabel="Bugungi dars" style={styles.hero}>
              <View style={styles.heroCircle} />
              <Image source={designImages.c04932e65803a7f5c40ff5868fd21516} style={styles.heroImg} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
              <View style={styles.heroTop}>
                <View style={[styles.chip, { backgroundColor: p.chipBg }]}>
                  <Text style={[styles.chipText, { color: p.chipText }]}>Bugungi dars</Text>
                </View>
                <Text style={styles.heroLabel}>{lesson.number}-dars · {lesson.isVideoDay ? 'Videodars' : 'Jonli dars'}</Text>
              </View>
              <View style={styles.heroBody}>
                <Text style={[styles.heroTitle, { fontFamily: displayFont(lesson.name) }]} numberOfLines={3}>{lesson.name}</Text>
                {!!lesson.phrase && <Text style={styles.heroPhrase} numberOfLines={2}>{lesson.phrase}</Text>}
                {!!lesson.meta && <Text style={styles.heroMeta}>{lesson.meta}</Text>}
              </View>
              <View style={styles.segments} accessibilityLabel={`${totalSteps} qadamdan ${doneSteps} tasi bajarildi`}>
                {steps.map((s, i) => (
                  <View key={i} style={styles.segment}>
                    <View style={[styles.segmentFill, { width: `${Math.max(0, Math.min(100, s.fraction * 100))}%` }]} />
                  </View>
                ))}
              </View>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push(R.lesson(lesson.id) as Href)}
                style={[styles.continue, { backgroundColor: p.continueBg }]}
              >
                <Text style={[styles.continueText, { color: p.continueText }]}>
                  {doneSteps >= totalSteps ? 'Darsni koʻrish' : `Davom etish · ${currentStep} / ${totalSteps}`}
                </Text>
                <ArrowRight color={p.continueText} />
              </Pressable>
            </View>
          )}

          {/* Jonli dars */}
          {liveVisible && live && (
            <View accessibilityLabel="Jonli dars" style={[styles.live, { backgroundColor: p.liveBg }]}>
              <View style={styles.liveInfo}>
                <View style={styles.liveHead}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveOver}>
                    {msLeft <= 0 ? 'Jonli dars boshlandi' : `Jonli dars · ${whenLabel(live.startsAt, now)}`}
                  </Text>
                </View>
                {showTimer && (
                  <Text accessibilityRole="timer" accessibilityLabel={`Jonli darsgacha ${spokenCountdown(msLeft)}`} style={styles.timer}>
                    {formatCountdown(msLeft)}
                  </Text>
                )}
                {/* Server guruhsiz o'quvchiga "Speaking Club" deb beradi — u ma'nosiz;
                    faqat haqiqiy guruh nomi bo'lsa ko'rsatiladi. */}
                {!!groupFromTopic(live.topic) && <Text style={styles.liveTopic} numberOfLines={1}>Guruh: {groupFromTopic(live.topic)}</Text>}
              </View>
              <Pressable accessibilityRole="link" accessibilityLabel={groupName(live.topic) ? `${groupName(live.topic)} Telegram guruhiga oʻtish` : 'Telegram guruhiga oʻtish'} onPress={() => Linking.openURL(live.link)} style={styles.group}>
                <TelegramIcon color={p.telegramText} />
                <Text style={[styles.groupText, { color: p.telegramText }]}>Guruhga</Text>
              </Pressable>
            </View>
          )}

          {/* Kunlik maqsad va streak */}
          {/* Butun karta natijalarga olib boradi (dizayndagi ustki havola qatlami). */}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Kunlik maqsad: ${todayLightning} / ${DAILY_GOAL} chaqmoq — natijalarni ochish`}
            onPress={() => router.push(R.progress as Href)}
            style={[styles.goalCard, { backgroundColor: p.card }]}
          >
            <View style={styles.goalRow}>
              <View style={styles.ring}>
                <Svg width={52} height={52} viewBox="0 0 56 56" accessibilityRole="image" accessibilityLabel={`Kunlik maqsad: ${DAILY_GOAL} dan ${goal} chaqmoq`}>
                  <Circle cx="28" cy="28" r="23" fill="none" stroke="#EEF1F7" strokeWidth={7} />
                  {goal > 0 && (
                    <Circle
                      cx="28" cy="28" r="23" fill="none" stroke="#7C4DFF" strokeWidth={7} strokeLinecap="round"
                      strokeDasharray={`${(goal / DAILY_GOAL) * RING_C} ${RING_C}`}
                      transform="rotate(-90 28 28)"
                    />
                  )}
                </Svg>
                <View style={styles.ringBolt}><BoltIcon /></View>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.goalTitle, { color: p.text }]}>Kunlik maqsad</Text>
                <Text style={[styles.goalSub, { color: p.muted }]}>{todayLightning} / {DAILY_GOAL} chaqmoq · yana {DAILY_GOAL - goal} ta</Text>
              </View>
              <ChevronRightIcon size={20} color={p.goalChevron} strokeWidth={2.4} />
            </View>
            <View style={styles.days}>
              {days.map((d) => (
                <View key={d.full} accessibilityLabel={`${d.full}: bajarilmagan`} style={styles.day}>
                  <View style={[styles.dayCircle, { backgroundColor: p.emptyDay }]} />
                  <Text style={[styles.dayLabel, { color: p.dayLabel }]}>{d.short}</Text>
                </View>
              ))}
              <View style={styles.day} accessibilityLabel={`Bugun, streak ${streak} kun`}>
                <View style={[styles.dayCircle, styles.today, { backgroundColor: p.todayBg }]}>
                  <Text style={[styles.todayNum, { color: p.todayNum }]}>{streak + 1}</Text>
                </View>
                <Text style={[styles.dayLabel, { color: p.todayLabel, fontFamily: fonts.bodyHeavy }]}>Bugun</Text>
              </View>
            </View>
          </Pressable>

          {/* Mashqlar */}
          {botLinked && (
            <View accessibilityLabel="Mashqlar" style={styles.quickRow}>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push(R.wordReview as Href)}
                style={[styles.quick, { backgroundColor: p.card }]}
              >
                <View style={[styles.quickIcon, { backgroundColor: p.vocabIconBg }]}>
                  <Image source={designImages.f7ed25f8b468b4cb6172a58adcd09f1f} style={styles.quickImg} resizeMode="contain" />
                </View>
                <View style={styles.quickText}>
                  <Text style={[styles.quickTitle, { color: p.text }]}>Soʻzlarni takrorlash</Text>
                  <Text style={[styles.quickSub, { color: p.muted }]}>{wordCount ?? 0} ta soʻz</Text>
                </View>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => router.push(R.battle as Href)} style={[styles.quick, { backgroundColor: p.card }]}>
                <View style={[styles.quickIcon, { backgroundColor: p.battleIconBg }]}>
                  <Image source={designImages['11ac32c8e5b061e3779348e3afc56d83']} style={styles.quickImg} resizeMode="contain" />
                </View>
                <View style={styles.quickText}>
                  <Text style={[styles.quickTitle, { color: p.text }]}>Yuzma-yuz oʻyin</Text>
                  <Text style={[styles.quickSub, { color: p.muted }]}>+{V2_BATTLE_WIN_COINS} coin</Text>
                </View>
              </Pressable>
            </View>
          )}
        </FadeInUp>
      </ScrollView>
      <HomeNav p={p} />
      <BotConnectPopup
        visible={botOpen}
        mandatory={botMandatory}
        onClose={() => {
          setBotOpen(false);
          setBotMandatory(false);
          telegramLinkStatus().then((s) => setBotLinked(s.linked)).catch(() => {});
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 12 },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  hello: { flex: 1, minWidth: 0 },
  greet: { fontFamily: fonts.body, fontSize: 13, fontWeight: 'normal' },
  name: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.4, fontWeight: 'normal' },
  pill: { flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 10, borderRadius: 22 },
  pillText: { fontFamily: fonts.bodyHeavy, fontSize: 15, fontWeight: 'normal' },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 2,
    borderRadius: 10,
    backgroundColor: '#D92D20',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bodyHeavy, fontSize: 12, lineHeight: 14, color: '#FFFFFF', fontWeight: 'normal' },

  bot: {
    backgroundColor: '#1B6FA8',
    borderRadius: 24,
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  botDeco: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 24, overflow: 'hidden' },
  botCircle: { position: 'absolute', right: -30, bottom: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: '#2380BF' },
  botIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#2AABEE', alignItems: 'center', justifyContent: 'center' },
  botText: { flex: 1, minWidth: 0, gap: 3 },
  botTitle: { fontFamily: fonts.bodyHeavy, fontSize: 16, lineHeight: 19.2, color: '#FFFFFF', fontWeight: 'normal' },
  botSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17.55, color: '#FFFFFF', fontWeight: 'normal' },
  botBtn: { height: 48, paddingHorizontal: 16, borderRadius: 15, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  botBtnText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#155A8A', fontWeight: 'normal' },

  hero: { backgroundColor: '#2F5BFF', borderRadius: 28, paddingTop: 18, paddingHorizontal: 20, paddingBottom: 20, overflow: 'hidden', gap: 12 },
  heroCircle: { position: 'absolute', right: -36, top: -40, width: 190, height: 190, borderRadius: 95, backgroundColor: '#4A71FF' },
  heroImg: { position: 'absolute', right: 6, top: 34, width: 120, height: 112 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 9 },
  chipText: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 0.88, textTransform: 'uppercase', fontWeight: 'normal' },
  heroLabel: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: '#FFFFFF', fontWeight: 'normal', flexShrink: 1 },
  heroBody: { maxWidth: 214, gap: 2 },
  heroTitle: { fontSize: 25, lineHeight: 26.25, letterSpacing: -0.5, color: '#FFFFFF', fontWeight: 'normal' },
  heroPhrase: { fontFamily: fonts.bodyHeavy, fontSize: 18, color: '#FFFFFF', fontWeight: 'normal' },
  heroMeta: { marginTop: 4, fontFamily: fonts.body, fontSize: 13, color: '#F0F3FF', fontWeight: 'normal' },
  segments: { flexDirection: 'row', gap: 5 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#6D8BFF', overflow: 'hidden' },
  segmentFill: { height: 6, backgroundColor: '#FFFFFF' },
  continue: { height: 54, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  continueText: { fontFamily: fonts.bodyHeavy, fontSize: 17, fontWeight: 'normal' },

  live: { borderRadius: 24, paddingVertical: 14, paddingRight: 14, paddingLeft: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  liveInfo: { flex: 1, minWidth: 0, gap: 3 },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A5F' },
  liveOver: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase', color: '#FF9A9E', fontWeight: 'normal', flexShrink: 1 },
  timer: { fontFamily: fonts.display, fontSize: 30, lineHeight: 31.5, color: '#FFFFFF', fontVariant: ['tabular-nums'], fontWeight: 'normal' },
  liveTopic: { fontFamily: fonts.body, fontSize: 13, color: '#B8C1D6', fontWeight: 'normal' },
  group: { height: 52, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', gap: 7 },
  groupText: { fontFamily: fonts.bodyHeavy, fontSize: 14, fontWeight: 'normal' },

  goalCard: { borderRadius: 24, paddingVertical: 14, paddingHorizontal: 12, gap: 12 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 4 },
  ring: { width: 52, height: 52 },
  ringBolt: { position: 'absolute', left: 17, top: 17 },
  goalTitle: { fontFamily: fonts.bodyHeavy, fontSize: 16, fontWeight: 'normal' },
  goalSub: { fontFamily: fonts.body, fontSize: 14, fontWeight: 'normal' },
  days: { flexDirection: 'row', gap: 2 },
  day: { flex: 1, alignItems: 'center', gap: 6, minHeight: 44 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 2.5, borderColor: '#FF7A1A' },
  todayNum: { fontFamily: fonts.bodyHeavy, fontSize: 13, fontWeight: 'normal' },
  dayLabel: { fontFamily: fonts.bodyBold, fontSize: 12, fontWeight: 'normal' },

  quickRow: { flexDirection: 'row', gap: 12 },
  quick: { flex: 1, minWidth: 0, borderRadius: 22, paddingVertical: 12, paddingRight: 12, paddingLeft: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickIcon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickImg: { width: 50, height: 50 },
  quickText: { flex: 1, minWidth: 0, gap: 2 },
  quickTitle: { fontFamily: fonts.bodyHeavy, fontSize: 14, lineHeight: 16.8, fontWeight: 'normal' },
  quickSub: { fontFamily: fonts.bodyBold, fontSize: 12, fontWeight: 'normal' },
});

