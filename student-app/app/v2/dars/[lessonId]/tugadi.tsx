/**
 * v2 Dars tugadi (dizayn: 16 Complete).
 *
 * Coin — shu darsda yig'ilgan haqiqiy coinlar (coinsStore.useLessonCoins).
 * Chaqmoq darslar bo'yicha alohida saqlanmaydi; eski ilovada har to'g'ri
 * javob uchun +1 coin va +1 chaqmoq birga beriladi, shuning uchun shu
 * darsdagi chaqmoq coin soniga teng deb ko'rsatiladi.
 * Streak serverda yo'q — dizayndagi blok 0 holatida turadi.
 * Keyingi dars — darslar ro'yxatidagi navbatdagisi, sanasi demo-schedule'dan.
 */
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fullDay, loadCourseData, scheduleDates, splitTitle, type CourseData } from '@/components/v2/lessons/data';
import { ArrowRight, BoltIcon, ChevronRight, CoinIcon, FlameIcon, VideoBoxIcon } from '@/components/v2/lessons/icons';
import { BottomBar, Column, HeaderButton } from '@/components/v2/lessons/parts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { fetchDemoSchedule } from '@/services/contentApi';
import { useLessonCoins } from '@/services/coinsStore';

export default function CompleteScreen() {
  const insets = useSafeAreaInsets();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const id = String(lessonId);
  const [data, setData] = useState<CourseData | null>(null);
  const [schedule, setSchedule] = useState<{ startsAt: Date | null; pattern: 'mwf' | 'tts' }>({ startsAt: null, pattern: 'mwf' });
  const coins = useLessonCoins(id);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadCourseData().then((d) => !cancelled && setData(d)).catch(() => {});
      fetchDemoSchedule()
        .then((s) => !cancelled && setSchedule({ startsAt: s.startsAt ? new Date(s.startsAt) : null, pattern: s.schedulePattern }))
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
  const konspekt = data?.mc.lessonContents[id]?.konspekt?.trim();
  const nextShort = next ? splitTitle(next.name).title.split(':')[0] : '';

  return (
    <View style={styles.screen}>
      <Column>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.closeRow}>
            <HeaderButton kind="close" label="Yopish" fallback={R.home} />
          </View>
          <View style={styles.hero}>
            <Image source={designImages.cd192c1f07c6ae01a6b80b26d84e0ec7} style={{ width: 200, height: 190 }} resizeMode="contain" accessibilityLabel="Domik bayram qilmoqda" />
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text accessibilityRole="header" style={styles.h1}>{lesson ? `${lesson.number}-dars tugadi!` : 'Dars tugadi!'}</Text>
            {!!lesson && <Text style={styles.sub}>{phrase ? `${title} — ${phrase}` : konspekt ? `${title} — ${konspekt}` : title}</Text>}
          </View>
          <View accessibilityLabel="Streak" style={styles.streak}>
            <FlameIcon />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.streakTitle}>Streak: 0 kun</Text>
              <Text style={styles.small}>Ertaga ham davom eting!</Text>
            </View>
            <Text style={styles.streakNum}>0</Text>
          </View>
          <View style={styles.grid}>
            <View style={styles.stat}>
              <CoinIcon />
              <View>
                <Text style={[styles.statNum, { color: '#7A5300' }]}>+{coins}</Text>
                <Text style={styles.statLabel}>coin</Text>
              </View>
            </View>
            <View style={styles.stat}>
              <BoltIcon />
              <View>
                <Text style={[styles.statNum, { color: '#5A2FD6' }]}>+{coins}</Text>
                <Text style={styles.statLabel}>chaqmoq</Text>
              </View>
            </View>
          </View>
          {next && (
            <Pressable accessibilityRole="link" onPress={() => router.push(R.lesson(next.id) as Href)} style={({ pressed }) => [styles.next, pressed && { opacity: 0.85 }]}>
              <View style={styles.nextIcon}><VideoBoxIcon /></View>
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <Text style={styles.nextOver}>Keyingi{nextDate ? ` · ${fullDay(nextDate)}` : ''}</Text>
                <Text style={styles.nextTitle}>{next.number}-dars · {next.isVideo ? 'Videodars' : 'Jonli dars'} · {nextShort}</Text>
              </View>
              <ChevronRight />
            </Pressable>
          )}
        </ScrollView>
        <BottomBar>
          <Pressable accessibilityRole="link" onPress={() => router.replace(R.path as Href)} style={({ pressed }) => [styles.cta, pressed && { backgroundColor: '#1E3FD1' }]}>
            <Text style={styles.ctaText}>Davom etish</Text>
            <ArrowRight />
          </Pressable>
        </BottomBar>
      </Column>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { paddingHorizontal: 20, alignItems: 'center', gap: 14, paddingBottom: 12 },
  closeRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'flex-end' },
  hero: { width: 210, height: 190, borderRadius: 105, backgroundColor: '#FFF4D1', alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.64, color: '#0B1220', textAlign: 'center', fontWeight: 'normal' },
  sub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: '#4A5468', textAlign: 'center', fontWeight: 'normal' },
  streak: { alignSelf: 'stretch', backgroundColor: '#FFF1E6', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  streakTitle: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: '#0B1220', fontWeight: 'normal' },
  small: { fontFamily: fonts.body, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  streakNum: { fontFamily: fonts.display, fontSize: 34, color: '#B34700', fontWeight: 'normal' },
  grid: { alignSelf: 'stretch', flexDirection: 'row', gap: 12 },
  stat: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statNum: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, fontWeight: 'normal' },
  statLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  next: { alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 12, paddingLeft: 16, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  nextOver: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: '#4A5468', textTransform: 'uppercase', letterSpacing: 0.48, fontWeight: 'normal' },
  nextTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, lineHeight: 21, color: '#0B1220', fontWeight: 'normal' },
  cta: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 5px 0 #1E3FD1' } as object,
  ctaText: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: '#FFFFFF', fontWeight: 'normal' },
});
