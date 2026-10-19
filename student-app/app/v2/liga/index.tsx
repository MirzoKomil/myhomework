/**
 * v2 Liga (dizayn: 39 · Leaderboard).
 *
 * Reyting ro'yxati haqiqiy: eski profile/leaderboard.tsx dagi
 * fetchLeaderboard (/api/state/leaderboard), joriy hafta (weekly),
 * chaqmoq bo'yicha. Yangi dizaynda Haftalik/Doimiy tanlovi yo'q —
 * tepada joriy hafta oralig'i ("Hafta · 12–18 oktabr"). Haftalik liga
 * (Bronza→Olmos zinapoyasi, ko'tarilish, o'tgan hafta natijasi) serverda
 * YO'Q — shuning uchun hamma boshlang'ich (Bronza) holatda, o'tgan hafta
 * natijasi bo'sh. Streak ham kuzatilmaydi — 0 kun.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArrowUpIcon, BoltFill, ChevronRightIcon, TickIcon, TimerIcon } from '@/components/v2/rewards/icons';
import { currentWeekLabel, fallbackAvatar, fmt, TIERS, timeLeftLabel, weekEnd } from '@/components/v2/rewards/parts';
import { TabBar } from '@/components/v2/TabBar';
import { R } from '@/constants/v2/routes';
import { designImages } from '@/constants/v2/designImages';
import { fonts } from '@/constants/v2/tokens';
import { fetchLeaderboard, type LeaderboardEntryResponse } from '@/services/contentApi';
import { useAvatarUri } from '@/services/avatarStore';
import { checkLeaderboardClimb } from '@/services/leaderboardTracker';
import { hasCached, useCachedState } from '@/services/v2Cache';

// Haftalik liga serverda yo'q — hamma Bronza (0-pog'ona) dan boshlaydi.
const CURRENT_TIER = 0;
const PROMOTE_TOP = 5;
const RANK_COLORS: Record<number, string> = { 1: '#9A6A00', 2: '#4A5468', 3: '#8A5A2E' };

export default function V2League() {
  const insets = useSafeAreaInsets();
  const myAvatar = useAvatarUri();
  const period = 'weekly' as const;
  const [entries, setEntries] = useCachedState<LeaderboardEntryResponse[]>('liga.entries', []);
  const [loading, setLoading] = useState(() => !hasCached('liga.entries'));
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      fetchLeaderboard('country', period)
        .then((e) => alive && setEntries(e))
        .catch(() => alive && setEntries([]))
        .finally(() => alive && setLoading(false));
      // Eski ekrandagi kabi: "10 pog'ona ko'tarildingiz" bildirishnomasi faqat
      // umumiy (alltime) o'rin bo'yicha — ro'yxat ko'rinmasa ham fonda tekshiriladi.
      fetchLeaderboard('country', 'alltime')
        .then((all) => {
          const me = all.find((e) => e.isMe);
          if (me) checkLeaderboardClimb(me.rank);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [period]),
  );

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const end = weekEnd(now);
  const tier = TIERS[CURRENT_TIER];
  const next = TIERS[CURRENT_TIER + 1];

  return (
    <View style={styles.screen}>
      <View style={[styles.hero, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
        <View style={[styles.column, { gap: 12 }]}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
              <Text style={styles.week}>Hafta · {currentWeekLabel(now)}</Text>
              <Text accessibilityRole="header" style={styles.h1}>{tier.name} liga</Text>
              <View style={styles.timerRow}>
                <View style={{ marginTop: 1 }}><TimerIcon /></View>
                <View style={{ gap: 1 }}>
                  <Text style={styles.timerBig}>{timeLeftLabel(end.getTime() - now.getTime())}</Text>
                  <Text style={styles.timerSmall}>Yakshanba 23:59 gacha</Text>
                </View>
              </View>
            </View>
            <Image source={designImages.e91544c14ad5b2b62bbbe447f02474b2} style={styles.mascot} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
          </View>

          <View
            accessible
            accessibilityLabel={`Ligalar zinapoyasi: ${tier.name} hozirgi liga, keyin ${TIERS.slice(CURRENT_TIER + 1).map((t) => t.name).join(', ')}`}
            style={styles.ladder}
          >
            <View style={styles.ladderTrack} />
            <View style={[styles.ladderFill, { width: `${CURRENT_TIER * 20}%` }]} />
            {TIERS.map((t, i) => (
              <View key={t.name} style={styles.step}>
                {i < CURRENT_TIER ? (
                  <View style={[styles.dot, { backgroundColor: t.color }]}><TickIcon /></View>
                ) : i === CURRENT_TIER ? (
                  <View style={[styles.dot, { backgroundColor: t.color, boxShadow: `0 0 0 4px #0B1220, 0 0 0 6px ${t.color}` }]} />
                ) : (
                  <View style={[styles.dot, styles.dotFuture, { borderColor: t.color }]} />
                )}
                <Text style={[styles.stepText, { color: i === CURRENT_TIER ? '#FFFFFF' : t.color }, i === CURRENT_TIER && styles.stepTextMe]} numberOfLines={1}>
                  {i === CURRENT_TIER ? `${t.name} · siz` : t.name}
                </Text>
              </View>
            ))}
          </View>

          <Pressable accessibilityRole="link" onPress={() => router.push(R.leagueResult as never)} style={({ pressed }) => [styles.lastWeek, pressed && { opacity: 0.8 }]}>
            <Text style={styles.lastWeekText} numberOfLines={1}>Oʻtgan hafta natijasi</Text>
            <ChevronRightIcon />
          </Pressable>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.listWrap} showsVerticalScrollIndicator={false}>
        <View style={[styles.column, { gap: 6 }]}>
          <View style={styles.listHead} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.listHeadText}>Oʻquvchi · {entries.length} nafar</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <BoltFill />
              <Text style={styles.listHeadText}>Shu hafta</Text>
            </View>
          </View>

          {!loading && entries.length === 0 && (
            <View style={styles.row}>
              <Text style={[styles.sub, { flex: 1, paddingVertical: 10 }]}>
                Hali reytingda hech kim yoʻq. Darslarni davom ettirib, birinchi boʻlib chaqmoq toʻplang!
              </Text>
            </View>
          )}

          {entries.map((e, i) => {
            const me = e.isMe;
            const uri = me && myAvatar ? myAvatar : e.avatarUrl;
            const first = e.name.split(' ')[0];
            return (
              <View key={e.id}>
                <View
                  accessible
                  accessibilityLabel={`${e.rank}-oʻrin, ${me ? 'siz, ' : ''}${e.name}, ${e.lightning} chaqmoq`}
                  style={[styles.row, me && styles.rowMe]}
                >
                  <Text style={[styles.rank, { color: me ? '#FFFFFF' : (RANK_COLORS[e.rank] ?? '#4A5468') }]}>{e.rank}</Text>
                  <View style={[styles.avatar, me && styles.avatarMe]}><Image source={uri ? { uri } : fallbackAvatar(e.name)} style={styles.avatarImg} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.name, me && { color: '#FFFFFF' }]} numberOfLines={1}>{me ? `Siz · ${first}` : first}</Text>
                    <Text style={[styles.sub, me && { color: '#F0F3FF' }]} numberOfLines={1}>{e.lessonsCompleted} dars · 0 kun ketma-ket</Text>
                  </View>
                  <Text style={[styles.score, me && { color: '#FFFFFF' }]}>{fmt(e.lightning)}</Text>
                </View>
                {i === PROMOTE_TOP - 1 && entries.length > PROMOTE_TOP && next && (
                  <View style={styles.promote} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <View style={styles.promoteLine} />
                    <ArrowUpIcon />
                    <Text style={styles.promoteText}>Top {PROMOTE_TOP} {next.name} ligaga chiqadi</Text>
                    <View style={styles.promoteLine} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <TabBar active="league" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  hero: { backgroundColor: '#0B1220', paddingHorizontal: 20, paddingBottom: 16, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  week: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: 'uppercase', color: '#B8C1D6' },
  h1: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 30, lineHeight: 32, letterSpacing: -0.6, color: '#FFFFFF' },
  timerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  timerBig: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#FFFFFF' },
  timerSmall: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#B8C1D6' },
  mascot: { width: 112, height: 118, marginTop: -4 },
  ladder: { flexDirection: 'row', marginTop: 4, position: 'relative' },
  ladderTrack: { position: 'absolute', left: '10%', right: '10%', top: 11, height: 2, backgroundColor: '#26304A' },
  ladderFill: { position: 'absolute', left: '10%', top: 11, height: 2, backgroundColor: '#E2E7F0' },
  step: { flex: 1, alignItems: 'center', gap: 7 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dotFuture: { backgroundColor: '#1B2438', borderWidth: 2 },
  stepText: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 16 },
  // "Kumush · siz" — dizaynda white-space: nowrap (ustundan chiqib ketsa ham bir qatorda).
  stepTextMe: { fontFamily: fonts.bodyHeavy, overflow: 'visible', width: 120, textAlign: 'center' },
  lastWeek: { height: 44, borderRadius: 14, backgroundColor: '#1B2438', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  lastWeekText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, color: '#FFD66B', flexShrink: 1 },
  listWrap: { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 16 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14 },
  listHeadText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468', letterSpacing: 0.48, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 9, paddingHorizontal: 14 },
  rowMe: { backgroundColor: '#2F5BFF', boxShadow: '0 6px 16px rgba(47,91,255,0.28)' },
  rank: { width: 22, fontFamily: fonts.display, fontWeight: 'normal', fontSize: 17 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F0EBFF' },
  avatarMe: { boxShadow: '0 0 0 2px #FFFFFF' },
  avatarImg: { width: 38, height: 38, borderRadius: 19 },
  name: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#0B1220' },
  sub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468' },
  score: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, color: '#5A2FD6' },
  promote: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2, paddingHorizontal: 4, marginTop: 6 },
  promoteLine: { flex: 1, height: 2, backgroundColor: '#9FDFC0' },
  promoteText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#087A4A', letterSpacing: 0.48, textTransform: 'uppercase' },
});
