/**
 * v2 Bosh sahifa (dizayn: 02 · Bosh sahifa).
 *
 * Faqat haqiqiy ma'lumot ko'rsatiladi. Dizayndagi streak va kunlik
 * chaqmoq maqsadi hozircha serverda yo'q (xarita: "Server tomonda kerak
 * bo'ladigan ishlar"), shuning uchun ular o'rniga soxta raqam
 * ko'rsatilmaydi — kurs progressi kartasi turibdi.
 */
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ArrowRightIcon,
  BellIcon,
  BoltOutlineIcon,
  Button,
  Card,
  CardsIcon,
  Chip,
  IconCircleButton,
  ProgressRing,
  SegmentedProgress,
  StatPill,
  TelegramIcon,
  V2Text,
} from '@/components/v2';
import { TabBar } from '@/components/v2/TabBar';
import { colors, fonts, radius, space } from '@/constants/v2/tokens';
import { getCourseOverallProgress, getResolvedLessonContent } from '@/data/lessonContent';
import { fetchDemoNotifications, fetchDemoSchedule, fetchDemoStudentProfile, fetchMobileContent } from '@/services/contentApi';
import { useCoins } from '@/services/coinsStore';
import { getCategoryProgress, loadLessonProgress } from '@/services/lessonProgressStore';
import { getLastPosition } from '@/services/progressStore';
import { clearAuth, useAuth } from '@/services/studentAuthStore';

const domik = require('@/assets/images/v2/domik-wave.png');

type CurrentLesson = { id: string; name: string; number: number; stepsDone: number; stepsTotal: number; resumePath: string };
type LiveLesson = { startsAt: Date; topic: string; link: string };

function greeting(now: Date) {
  const h = now.getHours();
  if (h >= 5 && h < 11) return 'Xayrli tong';
  if (h >= 11 && h < 17) return 'Xayrli kun';
  if (h >= 17 && h < 23) return 'Xayrli kech';
  return 'Xayrli tun';
}

const pad = (n: number) => String(n).padStart(2, '0');

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
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - day.getTime()) / 86400000);
  if (diffDays === 0) return `bugun ${time}`;
  if (diffDays === 1) return `ertaga ${time}`;
  return `${WEEKDAYS[date.getDay()]} ${time}`;
}

async function resolveCurrentLesson(): Promise<CurrentLesson | null> {
  const mc = await fetchMobileContent();
  const course = mc.courses[0];
  if (!course) return null;
  const lessons = mc.lessons.filter((l) => l.courseId === course.id);
  if (!lessons.length) return null;
  const last = await getLastPosition();
  let idx = last ? lessons.findIndex((l) => l.id === last.lessonId) : -1;
  if (idx < 0) idx = lessons.findIndex((l) => l.isActive);
  if (idx < 0) idx = 0;
  const lesson = lessons[idx];

  await loadLessonProgress();
  const content = await getResolvedLessonContent(lesson.id, idx);
  const isVideoDay = idx % 2 === 0;
  const parts = [
    getCategoryProgress(lesson.id, isVideoDay ? 'video' : 'speaking'),
    getCategoryProgress(lesson.id, 'vocabulary'),
    getCategoryProgress(lesson.id, 'homework', content.homeworkParts.length),
  ];
  return {
    id: lesson.id,
    name: lesson.name,
    number: idx + 1,
    stepsDone: parts.filter((p) => p >= 100).length,
    stepsTotal: parts.length,
    resumePath: last && last.lessonId === lesson.id ? `/homework/lesson/${lesson.id}/${last.section}` : `/homework/lesson/${lesson.id}`,
  };
}

export default function V2Home() {
  const insets = useSafeAreaInsets();
  const { token, student } = useAuth();
  const coins = useCoins();
  const isEmbedded = Platform.OS === 'web' && typeof window !== 'undefined' && window.self !== window.top;

  const [name, setName] = useState(student?.name?.split(' ')[0] ?? '');
  const [unread, setUnread] = useState(0);
  const [lesson, setLesson] = useState<CurrentLesson | null>(null);
  const [lessonError, setLessonError] = useState(false);
  const [course, setCourse] = useState<{ done: number; total: number; percent: number } | null>(null);
  const [live, setLive] = useState<LiveLesson | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!token && !isEmbedded) return;
    fetchDemoStudentProfile()
      .then((p) => {
        if (p?.name) setName(p.name.split(' ')[0]);
        else if (token) void clearAuth();
      })
      .catch(() => {});
    fetchDemoNotifications()
      .then((list) => setUnread(list.filter((n) => n.unread).length))
      .catch(() => {});
    fetchDemoSchedule()
      .then((s) => {
        if (s.startsAt && s.telegramGroupLink) setLive({ startsAt: new Date(s.startsAt), topic: s.topic, link: s.telegramGroupLink });
      })
      .catch(() => {});
  }, [token, isEmbedded]);

  useFocusEffect(
    useCallback(() => {
      if (!token && !isEmbedded) return;
      setLessonError(false);
      resolveCurrentLesson().then(setLesson).catch(() => setLessonError(true));
      getCourseOverallProgress().then(setCourse).catch(() => {});
    }, [token, isEmbedded]),
  );

  // Jonli dars taymeri faqat dars 24 soatdan kam qolganda yangilanadi.
  const msLeft = live ? live.startsAt.getTime() - now.getTime() : -1;
  const showTimer = msLeft > 0 && msLeft < 24 * 3600 * 1000;
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(new Date()), showTimer ? 1000 : 60000);
    return () => clearInterval(id);
  }, [live, showTimer]);

  if (!token && !isEmbedded) return <Redirect href="/v2/login" />;

  const liveVisible = live && msLeft > -2 * 3600 * 1000; // dars boshlangach 2 soat ko'rinib turadi

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 14 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <View style={styles.header}>
            <Button
              label={name ? name[0].toUpperCase() : '?'}
              accessibilityLabel="Profil"
              onPress={() => router.push('/profile')}
              style={styles.avatar}
            />
            <View style={styles.hello}>
              <V2Text variant="caption" color={colors.textMuted}>{greeting(now)}</V2Text>
              <V2Text variant="subheading" numberOfLines={1}>{name || ' '}</V2Text>
            </View>
            <StatPill kind="coin" value={coins} onPress={() => router.push('/shop')} />
            <IconCircleButton accessibilityLabel="Bildirishnomalar" badge={unread} onPress={() => router.push('/notifications')}>
              <BellIcon />
            </IconCircleButton>
          </View>

          <Card tone="cobalt" rounded="hero" padding={20} style={styles.hero}>
            <Image source={domik} style={styles.heroMascot} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
            <View style={styles.row}>
              <Chip label="Bugungi dars" tone="onCobalt" />
              {lesson && <V2Text variant="caption" color={colors.cobaltSoft}>{lesson.number}-dars</V2Text>}
            </View>
            {lesson ? (
              <>
                <View style={{ gap: 10 }}>
                  <V2Text variant="heading" color={colors.textOnDark} style={styles.heroTitle} numberOfLines={3}>
                    {lesson.name}
                  </V2Text>
                  <View style={styles.heroSteps}>
                    <SegmentedProgress
                      total={lesson.stepsTotal}
                      done={lesson.stepsDone}
                      color={colors.successBright}
                      accessibilityLabel={`Dars bosqichlari: ${lesson.stepsTotal} dan ${lesson.stepsDone}`}
                    />
                  </View>
                </View>
                <Button
                  label={lesson.stepsDone >= lesson.stepsTotal ? "Darsni ko'rish" : `Davom etish · ${lesson.stepsDone} / ${lesson.stepsTotal}`}
                  variant="inverse"
                  trailing={<ArrowRightIcon />}
                  onPress={() => router.push(lesson.resumePath as never)}
                />
              </>
            ) : (
              <View style={{ gap: 12 }}>
                <V2Text variant="bodySmall" color={colors.cobaltSoft} style={styles.heroTitle}>
                  {lessonError ? "Darsni yuklab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring." : 'Dars yuklanmoqda…'}
                </V2Text>
                {lessonError && (
                  <Button label="Darslar ro'yxati" variant="inverse" onPress={() => router.push('/homework')} />
                )}
              </View>
            )}
          </Card>

          {liveVisible && live && (
            <Card tone="ink" padding={14} style={styles.liveCard}>
              <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                <View style={styles.row}>
                  <View style={styles.liveDot} />
                  <V2Text variant="overline" color={colors.liveText}>
                    {msLeft <= 0
                      ? 'Jonli dars boshlandi'
                      : showTimer
                        ? `Jonli dars · ${pad(live.startsAt.getHours())}:${pad(live.startsAt.getMinutes())}`
                        : `Jonli dars · ${whenLabel(live.startsAt, now)}`}
                  </V2Text>
                </View>
                {showTimer && (
                  <V2Text
                    variant="title"
                    color={colors.textOnDark}
                    accessibilityLabel={`Jonli darsgacha ${spokenCountdown(msLeft)}`}
                    style={styles.timer}
                  >
                    {formatCountdown(msLeft)}
                  </V2Text>
                )}
                {!!live.topic && (
                  <V2Text variant="caption" color={colors.textOnDarkMuted} numberOfLines={1}>{live.topic}</V2Text>
                )}
              </View>
              <Button
                label="Guruhga"
                accessibilityLabel="Telegram guruhiga o'tish"
                size="md"
                variant="telegram"
                leading={<TelegramIcon />}
                onPress={() => Linking.openURL(live.link)}
                style={styles.telegram}
              />
            </Card>
          )}

          {course && (
            <Card style={styles.row}>
              <ProgressRing value={course.percent / 100} color={colors.cobalt} accessibilityLabel={`Kurs: ${course.percent} foiz`}>
                <V2Text variant="caption" style={{ fontFamily: fonts.bodyHeavy }}>{course.percent}%</V2Text>
              </ProgressRing>
              <View style={{ flex: 1, gap: 2 }}>
                <V2Text variant="bodyStrong">Kurs yo'li</V2Text>
                <V2Text variant="bodySmall" color={colors.textMuted}>{course.done} / {course.total} dars ochilgan</V2Text>
              </View>
            </Card>
          )}

          <View style={styles.quickGrid}>
            <Card onPress={() => router.push('/vocabulary')} accessibilityLabel="So'zlarni takrorlash" rounded="xl" style={styles.quick}>
              <View style={[styles.quickIcon, { backgroundColor: colors.lightningSoft }]}><CardsIcon /></View>
              <V2Text variant="bodyStrong" style={{ fontSize: 15 }}>So'zlarni takrorlash</V2Text>
              <V2Text variant="caption" color={colors.textMuted}>O'tilgan darslar so'zlari</V2Text>
            </Card>
            <Card onPress={() => router.push('/battle')} accessibilityLabel="Yuzma-yuz o'yin" rounded="xl" style={styles.quick}>
              <View style={[styles.quickIcon, { backgroundColor: colors.successSoft }]}><BoltOutlineIcon /></View>
              <V2Text variant="bodyStrong" style={{ fontSize: 15 }}>Yuzma-yuz o'yin</V2Text>
              <V2Text variant="caption" color={colors.textMuted}>Boshqa o'quvchi bilan bellash</V2Text>
            </Card>
          </View>
        </View>
      </ScrollView>
      <TabBar active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, paddingBottom: 24 },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 44, height: 44, minHeight: 44, paddingHorizontal: 0, borderRadius: 22, backgroundColor: colors.ink },
  hello: { flex: 1, minWidth: 0 },
  hero: { gap: 14, overflow: 'hidden', position: 'relative' },
  heroMascot: { position: 'absolute', right: 2, top: 6, width: 118, height: 118 },
  heroTitle: { maxWidth: 220 },
  heroSteps: { maxWidth: 200 },
  liveCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.xxl },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.live },
  timer: { fontVariant: ['tabular-nums'] },
  telegram: { height: 52 },
  quickGrid: { flexDirection: 'row', gap: 12 },
  quick: { flex: 1, gap: 10 },
  quickIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
