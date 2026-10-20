/**
 * Kompyuter: Liga (dizayn: D_Leaderboard).
 *
 * Ma'lumot mobil Liga ekranidagi bilan bir xil: fetchLeaderboard('country',
 * 'weekly') — haftalik chaqmoq reytingi; alltime — "ko'tarildingiz"
 * bildirishnomasi uchun. Haftalik liga zinapoyasi serverda yo'q — hamma
 * Bronza'da (mobil kabi), o'tgan hafta natijasi bo'sh. Seriya — faqat
 * o'quvchining o'zi uchun (fetchMyProgress), boshqalar uchun 0 (bosh sahifadagi
 * kabi). Bugungi chaqmoq — kunlik reytingdagi o'z qatori (bosh sahifa kabi);
 * o'tgan kunlar bo'yicha taqsimot serverda yo'q — ustunlar bo'sh ("—").
 */
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { DesktopPage } from '@/components/v2/desktop/Shell';
import { useShellInfo } from '@/components/v2/desktop/shellData';
import { currentWeekLabel, fallbackAvatar, fmt, timeLeftLabel, TIERS, weekEnd } from '@/components/v2/rewards/parts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { EARN_LEAGUE_TOP5 } from '@/components/v2/rewards/parts';
import { useAvatarUri } from '@/services/avatarStore';
import { fetchLeaderboard, type LeaderboardEntryResponse } from '@/services/contentApi';
import { checkLeaderboardClimb } from '@/services/leaderboardTracker';
import { hasCached, useCachedState } from '@/services/v2Cache';

import { caps, HeadTitle, NARROW_MAIN, useMainWidth, IArrow, IArrowUp, IBolt, ICheck, IChevron, IClock, ICoin, ITrophy, T, webShadow } from './ui';

// Haftalik liga serverda yo'q — hamma Bronza (0-pog'ona) dan boshlaydi (mobil kabi).
const CURRENT_TIER = 0;
const PROMOTE_TOP = 5;
const DAILY_GOAL = 50;
// Kompyuter dizaynidagi liga ranglari (to'q fonda).
const D_TIER_COLORS = ['#E7C9A5', '#E6EAF2', '#FFC93C', '#4FD1A5', '#B9C6FF'];
const RANK_COLORS: Record<number, string> = {
  1: '#946200',
  2: '#4A5468',
  3: '#8A4B12',
};
const COLS = { rank: 48, lessons: 110, streak: 130, score: 120 };
const WEEK_DAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const BAR_MAX = 60;

const go = (href: string) => router.push(href as Href);

export function DLeaderboard() {
  const myAvatar = useAvatarUri();
  const shell = useShellInfo();
  const [entries, setEntries] = useCachedState<LeaderboardEntryResponse[]>('liga.entries', []);
  const [loading, setLoading] = useState(() => !hasCached('liga.entries'));
  const [today, setToday] = useCachedState('home.todayLightning', 0);
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      fetchLeaderboard('country', 'weekly')
        .then((e) => alive && setEntries(e))
        .catch(() => alive && setEntries([]))
        .finally(() => alive && setLoading(false));
      // Mobil ekrandagi kabi: "ko'tarildingiz" bildirishnomasi umumiy o'rin bo'yicha.
      fetchLeaderboard('country', 'alltime')
        .then((all) => {
          const me = all.find((e) => e.isMe);
          if (me) checkLeaderboardClimb(me.rank);
        })
        .catch(() => {});
      fetchLeaderboard('country', 'daily')
        .then((d) => alive && setToday(d.find((e) => e.isMe)?.lightning ?? 0))
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const end = weekEnd(now);
  // Tor oynada o'ng ustun jadval ostiga tushadi; maskot faqat joy yetsa.
  const mainW = useMainWidth();
  const narrow = mainW < NARROW_MAIN;
  const heroW = narrow ? mainW : mainW - 344;
  const railW = narrow ? (mainW - 14) / 2 : 320;
  const tier = TIERS[CURRENT_TIER];
  const next = TIERS[CURRENT_TIER + 1];
  const meIdx = entries.findIndex((e) => e.isMe);
  const me = meIdx >= 0 ? entries[meIdx] : null;

  return (
    <DesktopPage
      title={`${tier.name} liga`}
      titleSlot={<HeadTitle over={`Hafta · ${currentWeekLabel(now)}`} title={`${tier.name} liga`} />}
      actions={
        <View style={s.timer}>
          <IClock />
          <View>
            <T f="bodyHeavy" size={14} lh={16}>
              {timeLeftLabel(end.getTime() - now.getTime())}
            </T>
            <T size={12} lh={14} color="#4A5468">
              Yakshanba 23:59 gacha
            </T>
          </View>
        </View>
      }
      contentStyle={{ paddingBottom: 32 }}
    >
      <View style={{ flexDirection: narrow ? 'column' : 'row', gap: 24, alignItems: narrow ? 'stretch' : 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0, gap: 20 }}>
          {/* Liga zinapoyasi */}
          <View style={s.hero}>
            <View style={s.heroCircle} />
            <View style={{ flex: 1, minWidth: 0, gap: 18 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  gap: 12,
                }}
              >
                <T f="bodyHeavy" size={12} color="#B8C1D6" style={caps()}>
                  Ligalar zinapoyasi
                </T>
                <T size={14} color="#B8C1D6">
                  Top {PROMOTE_TOP} har hafta yuqori ligaga chiqadi
                </T>
              </View>
              <View
                accessible
                accessibilityLabel={`Ligalar zinapoyasi: ${TIERS.slice(0, CURRENT_TIER)
                  .map((t) => `${t.name} oʻtildi, `)
                  .join('')}${tier.name} hozirgi liga, keyin ${TIERS.slice(CURRENT_TIER + 1)
                  .map((t) => t.name)
                  .join(', ')}`}
                style={s.ladder}
              >
                <View style={s.ladderTrack} />
                <View style={[s.ladderFill, { width: 116 * CURRENT_TIER }]} />
                {TIERS.map((t, i) => {
                  const c = D_TIER_COLORS[i];
                  return (
                    <View key={t.name} style={s.step}>
                      <View style={{ height: 58, justifyContent: 'center' }}>
                        {i < CURRENT_TIER ? (
                          <View style={[s.dotDone, { backgroundColor: c }]}>
                            <ICheck size={18} sw={3} />
                          </View>
                        ) : i === CURRENT_TIER ? (
                          <View style={[s.dotMe, { backgroundColor: c }, webShadow('0 0 0 4px #0B1220, 0 0 0 7px #FFFFFF')]} />
                        ) : (
                          <View style={[s.dotNext, { borderColor: c }]} />
                        )}
                      </View>
                      <T f="bodyHeavy" size={14} color={i === CURRENT_TIER ? '#FFFFFF' : c} numberOfLines={1}>
                        {i === CURRENT_TIER ? `${t.name} · siz` : t.name}
                      </T>
                    </View>
                  );
                })}
              </View>
              <Pressable
                accessibilityRole="link"
                onPress={() => go(R.leagueResult)}
                style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.lastWeek, hovered && { backgroundColor: '#222C44' }]}
              >
                <ITrophy />
                {/* O'tgan hafta o'rni serverda yo'q — faqat havola matni (mobil kabi). */}
                <T f="bodyHeavy" size={15} color="#FFC93C">
                  Oʻtgan hafta natijasi
                </T>
                <IChevron color="#FFC93C" />
              </Pressable>
            </View>
            {heroW >= 760 && (
              <Image source={designImages.e91544c14ad5b2b62bbbe447f02474b2} style={s.mascot} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
            )}
          </View>

          {/* Reyting jadvali */}
          <View accessibilityLabel="Liga reytingi" style={s.table}>
            <View style={s.thead} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <T f="bodyHeavy" size={12} color="#4A5468" style={[caps(), { width: COLS.rank }]}>
                #
              </T>
              <T f="bodyHeavy" size={12} color="#4A5468" style={[caps(), { flex: 1 }]}>
                Oʻquvchi · {entries.length} nafar
              </T>
              <T f="bodyHeavy" size={12} color="#4A5468" style={[caps(), { width: COLS.lessons }]}>
                Darslar
              </T>
              <T f="bodyHeavy" size={12} color="#4A5468" style={[caps(), { width: COLS.streak }]}>
                Seriya
              </T>
              <T f="bodyHeavy" size={12} color="#4A5468" style={[caps(), { width: COLS.score, textAlign: 'right' }]}>
                Shu hafta
              </T>
            </View>
            {!loading && entries.length === 0 && (
              <View style={[s.row, { height: 'auto', paddingVertical: 18 }]}>
                <T size={15} color="#4A5468">
                  Hali reytingda hech kim yoʻq. Darslarni davom ettirib, birinchi boʻlib chaqmoq toʻplang!
                </T>
              </View>
            )}
            <View style={{ gap: 2 }}>
              {entries.map((e, i) => {
                const mine = e.isMe;
                const uri = mine && myAvatar ? myAvatar : e.avatarUrl;
                const first = e.name.split(' ')[0];
                const fg = mine ? '#FFFFFF' : '#4A5468';
                const streak = mine ? shell.streak : 0;
                return (
                  <View key={e.id}>
                    <View
                      accessible
                      accessibilityLabel={`${e.rank}-oʻrin, ${mine ? 'siz, ' : ''}${e.name}, ${e.lightning} chaqmoq`}
                      aria-current={mine ? true : undefined}
                      style={[s.row, mine && [s.rowMe, webShadow('0 8px 20px rgba(47,91,255,0.28)')]]}
                    >
                      <T f="bodyHeavy" size={18} color={mine ? '#FFFFFF' : (RANK_COLORS[e.rank] ?? '#4A5468')} style={{ width: COLS.rank }}>
                        {e.rank}
                      </T>
                      <View
                        style={{
                          flex: 1,
                          minWidth: 0,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 14,
                        }}
                      >
                        <Image source={uri ? { uri } : fallbackAvatar(e.name)} style={[s.avatar, mine && (webShadow('0 0 0 3px #FFFFFF') as object)]} />
                        <T f="bodyHeavy" size={16} color={mine ? '#FFFFFF' : '#0B1220'} numberOfLines={1}>
                          {mine ? `Siz · ${first}` : first}
                        </T>
                      </View>
                      <T size={15} color={fg} style={{ width: COLS.lessons }}>
                        {e.lessonsCompleted} dars
                      </T>
                      <T size={15} color={fg} style={{ width: COLS.streak }}>
                        {streak} kun ketma-ket
                      </T>
                      <View
                        style={{
                          width: COLS.score,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 5,
                        }}
                      >
                        <IBolt size={16} color={mine ? '#FFFFFF' : '#7C4DFF'} />
                        <T f="bodyHeavy" size={19} color={mine ? '#FFFFFF' : '#6A3CF0'}>
                          {fmt(e.lightning)}
                        </T>
                      </View>
                    </View>
                    {i === PROMOTE_TOP - 1 && entries.length > PROMOTE_TOP && next && (
                      <View style={s.promote} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                        <View style={s.promoteLine} />
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <IArrowUp />
                          <T f="bodyHeavy" size={12} color="#087A4A" style={caps()}>
                            Top {PROMOTE_TOP} {next.name} ligaga chiqadi
                          </T>
                        </View>
                        <View style={s.promoteLine} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* O'ng ustun — haftalik holat */}
        <View accessibilityLabel="Haftalik holat" style={narrow ? { flexDirection: 'row', flexWrap: 'wrap', gap: 14 } : { width: 320, gap: 14 }}>
          <View style={{ width: railW }}>
            <RankCard entries={entries} meIdx={meIdx} myAvatar={myAvatar} nextName={next?.name ?? ''} />
          </View>
          <View style={{ width: railW }}>
            <WeekCard total={me?.lightning ?? 0} today={today} now={now} />
          </View>
          <View style={[s.coinCard, { width: railW }]}>
            <View style={s.coinBox}>
              <ICoin size={30} />
            </View>
            <View style={{ gap: 2 }}>
              <T f="bodyHeavy" size={16}>
                Liga top-{PROMOTE_TOP} · +{EARN_LEAGUE_TOP5} coin
              </T>
              <T size={14} color="#7A5300">
                Hafta oxirida beriladi
              </T>
            </View>
          </View>
          <View style={{ width: railW }}>
            <GoalCard today={today} />
          </View>
        </View>
      </View>
    </DesktopPage>
  );
}

function RankCard({ entries, meIdx, myAvatar, nextName }: { entries: LeaderboardEntryResponse[]; meIdx: number; myAvatar: string | null; nextName: string }) {
  const me = meIdx >= 0 ? entries[meIdx] : null;
  const above = meIdx > 0 ? entries[meIdx - 1] : null;
  const below = meIdx >= 0 && meIdx < entries.length - 1 ? entries[meIdx + 1] : null;
  const rows: [string, string][] = [];
  if (me && above) rows.push([`${above.rank}-oʻringa`, `yana ${fmt(Math.max(0, above.lightning - me.lightning))} chaqmoq`]);
  if (me && below) rows.push([`${below.rank}-oʻrindan oldinda`, `${fmt(Math.max(0, me.lightning - below.lightning))} chaqmoq`]);
  const fifth = entries[PROMOTE_TOP - 1];
  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Image source={myAvatar ? { uri: myAvatar } : designImages['93faebd4826b1da6adaee5d0dcda6209']} style={s.meAvatar} />
        <View style={{ gap: 1 }}>
          <T f="bodyHeavy" size={13} color="#4A5468">
            Sizning oʻrningiz
          </T>
          <T f="display" size={30} lh={30} style={{ letterSpacing: -0.6 }}>
            {me ? `${me.rank}-oʻrin` : '—'}
          </T>
        </View>
        <View
          style={{
            marginLeft: 'auto',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <IBolt size={18} />
          <T f="bodyHeavy" size={20} color="#6A3CF0">
            {fmt(me?.lightning ?? 0)}
          </T>
        </View>
      </View>
      {rows.length > 0 && (
        <View style={s.gaps}>
          {rows.map(([l, v], i) => (
            <View key={l} style={[s.gapRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#E4E8F0' }]}>
              <T size={14} color="#4A5468">
                {l}
              </T>
              <T f="bodyHeavy" size={14}>
                {v}
              </T>
            </View>
          ))}
        </View>
      )}
      {me && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IArrowUp size={17} />
          <T f="bodyHeavy" size={14} color="#087A4A">
            {me.rank <= PROMOTE_TOP
              ? `Top ${PROMOTE_TOP} ichidasiz — ${nextName} ligaga yoʻl`
              : `Top ${PROMOTE_TOP} gacha yana ${fmt(Math.max(0, (fifth?.lightning ?? 0) - me.lightning + 1))} chaqmoq`}
          </T>
        </View>
      )}
    </View>
  );
}

function WeekCard({ total, today, now }: { total: number; today: number; now: Date }) {
  // Dushanbadan bugungacha (bugun — oxirgi ustun "Bugun").
  const dow = (now.getDay() + 6) % 7;
  const days = WEEK_DAYS.slice(0, dow + 1);
  const h = today > 0 ? BAR_MAX : 0;
  return (
    <View accessibilityLabel={`Shu hafta kunlar boʻyicha: ${total} chaqmoq`} style={[s.card, { paddingTop: 16, paddingBottom: 14, gap: 10 }]}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <T f="bodyHeavy" size={16}>
          Shu hafta
        </T>
        <T f="bodyHeavy" size={14} color="#6A3CF0">
          {fmt(total)} chaqmoq
        </T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 98 }}>
        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          return (
            <View key={d} style={{ flex: 1, flexBasis: 0, alignItems: 'center', gap: 6 }}>
              {/* O'tgan kunlar bo'yicha taqsimot serverda yo'q — "—". */}
              <T f="bodyHeavy" size={12} color="#4A5468">
                {isToday ? fmt(today) : '—'}
              </T>
              <View
                style={{
                  width: 26,
                  height: isToday ? Math.max(h, 0) : 0,
                  borderRadius: 8,
                  backgroundColor: '#C9B8FF',
                }}
              />
              <T f="bodyHeavy" size={12} color={isToday ? '#0B1220' : '#4A5468'}>
                {isToday ? 'Bugun' : d}
              </T>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function GoalCard({ today }: { today: number }) {
  const done = Math.min(today, DAILY_GOAL);
  return (
    <View style={[s.card, { paddingVertical: 16, gap: 10 }]}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <T f="bodyHeavy" size={16}>
          Kunlik maqsad
        </T>
        <T f="bodyHeavy" size={14} color="#6A3CF0">
          {today} / {DAILY_GOAL}
        </T>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: '#F0EBFF',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${(done / DAILY_GOAL) * 100}%`,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#7C4DFF',
          }}
        />
      </View>
      <T f="body" size={14} lh={20} color="#4A5468">
        Chaqmoq — dars, vazifa, mashq va jonli darsdan. Bugun yana {DAILY_GOAL - done} ta.
      </T>
      <Pressable
        accessibilityRole="link"
        onPress={() => go(R.practice)}
        style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.practice, hovered && { backgroundColor: '#E6DEFF' }]}
      >
        <IBolt size={17} color="#6A3CF0" />
        <T f="bodyHeavy" size={15} color="#5B2FD6">
          Mashq qilish
        </T>
        <IArrow />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  timer: {
    height: 46,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 6,
  },
  hero: {
    backgroundColor: '#0B1220',
    borderRadius: 28,
    paddingTop: 24,
    paddingHorizontal: 28,
    paddingBottom: 22,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  heroCircle: {
    position: 'absolute',
    right: -50,
    top: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#141D30',
  },
  ladder: { width: 560, flexDirection: 'row', justifyContent: 'space-between' },
  ladderTrack: {
    position: 'absolute',
    left: 48,
    right: 48,
    top: 28,
    height: 3,
    backgroundColor: '#263048',
  },
  ladderFill: {
    position: 'absolute',
    left: 48,
    top: 28,
    height: 3,
    backgroundColor: '#E6EAF2',
  },
  step: { width: 96, alignItems: 'center', gap: 10 },
  dotDone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotMe: { width: 52, height: 52, borderRadius: 26 },
  dotNext: { width: 36, height: 36, borderRadius: 18, borderWidth: 3 },
  lastWeek: {
    alignSelf: 'flex-start',
    height: 48,
    paddingLeft: 18,
    paddingRight: 16,
    borderRadius: 16,
    backgroundColor: '#1B2438',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mascot: { width: 200, height: 200, marginTop: -14, marginBottom: -18 },
  table: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 12,
  },
  thead: {
    height: 38,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    height: 62,
    paddingHorizontal: 20,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowMe: { backgroundColor: '#2F5BFF' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  promote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  promoteLine: { flex: 1, height: 2, backgroundColor: '#BFE8D3' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 12,
  },
  meAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF1E6',
  },
  gaps: {
    backgroundColor: '#F4F6FA',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  gapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  coinCard: {
    backgroundColor: '#FFF4D1',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  coinBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  practice: {
    height: 46,
    borderRadius: 15,
    backgroundColor: '#F0EBFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
