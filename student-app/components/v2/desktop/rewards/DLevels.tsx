/**
 * Kompyuter: Darajalar (dizayn: D_Levels).
 *
 * Mobil ekrandagi bilan bir xil manba: useV2Level (lightningStore + v2
 * oraliqlari, daraja pasaymaydi). "Taxminan N kun" — kunlik maqsad (50)
 * bo'yicha. "Bugun N / 50" — kunlik reytingdagi o'z qatori (bosh sahifa
 * kabi). "Darajaga chiqqanda nima bo'ladi?" — LevelUp oynasi (keyingi daraja).
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { DesktopPage } from '@/components/v2/desktop/Shell';
import { LEVEL_BADGES, LevelUpPopup, levelName } from '@/components/v2/popups/LevelUp';
import { fmt } from '@/components/v2/rewards/parts';
import { designImages } from '@/constants/v2/designImages';
import { useV2Level, V2_LEVELS, V2_TOP_LEVEL } from '@/constants/v2/levels';
import { R } from '@/constants/v2/routes';
import { useLang } from '@/i18n/LanguageContext';
import { fetchLeaderboard } from '@/services/contentApi';
import { useCachedState } from '@/services/v2Cache';

import { caps, NARROW_MAIN, useMainWidth, IBolt, ICheck, IChevron, ILock, IStar, T, webShadow } from './ui';

const PER_DAY = 50;

export function DLevels() {
  const { courseLang } = useLang();
  const progress = useV2Level();
  const { lightning } = progress;
  const curIdx = progress.index;
  const [popup, setPopup] = useState(false);
  const params = useLocalSearchParams<{ popup?: string }>();
  const [today, setToday] = useCachedState('home.todayLightning', 0);
  useEffect(() => {
    if (params.popup === 'levelup') setPopup(true);
  }, [params.popup]);
  useEffect(() => {
    fetchLeaderboard('country', 'daily')
      .then((d) => setToday(d.find((e) => e.isMe)?.lightning ?? 0))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const legendReached = curIdx === V2_TOP_LEVEL;
  const next = progress.next ? curIdx + 1 : null;
  const goal = Math.min(today, PER_DAY);
  // Tor oynada darajalar 3 tadan ikki qatorda; "Keyingi" kartasi sig'magani uchun yashiriladi.
  const mainW = useMainWidth();
  const narrow = mainW < NARROW_MAIN;
  const cardFix = narrow ? { flexGrow: 0, flexBasis: (mainW - 32) / 3 } : null;

  return (
    <DesktopPage title="Darajalar" subtitle={`Chaqmoq darajalari · jami ${fmt(lightning)}`} back={R.profile} contentStyle={{ paddingBottom: 32, gap: 26 }}>
      <View style={s.hero}>
        <View style={s.heroCircle} />
        <Image source={LEVEL_BADGES[curIdx]} accessibilityLabel={`${curIdx + 1}-daraja nishoni`} style={{ width: 150, height: 150 }} resizeMode="contain" />
        <View style={{ flex: 1, minWidth: 0, gap: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: 24, rowGap: 4 }}>
            <View style={{ gap: 2 }}>
              <T f="bodyHeavy" size={12} color="#F3EEFF" style={caps()}>
                Hozirgi daraja
              </T>
              <T f="display" size={42} lh={44} color="#FFFFFF" style={{ letterSpacing: -0.84 }}>
                {curIdx + 1} · {levelName(curIdx, courseLang)}
              </T>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingBottom: 5,
              }}
            >
              <IBolt size={22} color="#FFC93C" />
              <T f="bodyHeavy" size={22} color="#FFFFFF">
                {fmt(lightning)} chaqmoq
              </T>
            </View>
          </View>
          <View style={{ gap: 8, maxWidth: 640 }}>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: progress.progressPercent,
              }}
              style={s.track}
            >
              <View style={[s.fill, { width: `${progress.progressPercent}%` }]} />
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              {progress.next ? (
                <T size={15} color="#F3EEFF" style={{ flexShrink: 1 }}>
                  Keyingisi:{' '}
                  <T f="bodyHeavy" size={15} color="#FFFFFF">
                    {fmt(progress.remaining)} chaqmoq
                  </T>{' '}
                  · taxminan {Math.max(1, Math.ceil(progress.remaining / PER_DAY))} kun
                </T>
              ) : (
                <T size={15} color="#F3EEFF">
                  Eng yuqori darajadasiz
                </T>
              )}
              <T f="bodyHeavy" size={15} color="#F3EEFF">
                {progress.progressPercent}%
              </T>
            </View>
          </View>
        </View>
        {next !== null && !narrow && (
          <View style={s.next}>
            <Image source={LEVEL_BADGES[next]} style={{ width: 64, height: 64 }} resizeMode="contain" />
            <View style={{ flex: 1, gap: 2 }}>
              <T f="bodyHeavy" size={12} color="#F3EEFF" style={caps()}>
                Keyingi
              </T>
              <T f="bodyHeavy" size={16} lh={19} color="#FFFFFF">
                {next + 1} · {levelName(next, courseLang)}
              </T>
              <T size={13} color="#F3EEFF">
                {fmt(V2_LEVELS[next].min)} chaqmoqda
              </T>
            </View>
          </View>
        )}
      </View>

      <View style={{ gap: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <T f="bodyHeavy" size={19} accessibilityRole="header">
            Barcha darajalar
          </T>
          <T size={14} color="#4A5468">
            Chaqmoq hech qachon kamaymaydi
          </T>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: narrow ? 'wrap' : 'nowrap', gap: 16 }}>
          {V2_LEVELS.map((l, i) => {
            // Saqlangan (pasaymaydigan) daraja ham erishilgan hisoblanadi.
            const reached = i <= curIdx || lightning >= l.min;
            const current = i === curIdx;
            return (
              <View key={l.key} style={[s.card, cardFix, current && [{ backgroundColor: '#F0EBFF' }, webShadow('inset 0 0 0 2px #7C4DFF')]]}>
                <Image source={LEVEL_BADGES[i]} accessibilityLabel={`${i + 1}-daraja nishoni`} style={{ width: 120, height: 120 }} resizeMode="contain" />
                <View style={{ flex: 1, gap: 3, alignItems: 'center' }}>
                  <T f="bodyHeavy" size={16} lh={20} style={{ textAlign: 'center' }}>
                    {i + 1} · {levelName(i, courseLang)}
                  </T>
                  <T size={13} color="#4A5468" style={{ textAlign: 'center' }}>
                    {l.max ? `${fmt(l.min)}–${fmt(l.max)}` : `${fmt(l.min)}+`} chaqmoq
                  </T>
                </View>
                {current ? (
                  <View style={[s.chip, { backgroundColor: '#6A3CF0' }]}>
                    <T f="bodyHeavy" size={13} color="#FFFFFF">
                      Siz shu yerdasiz
                    </T>
                  </View>
                ) : reached ? (
                  <View style={[s.chip, { backgroundColor: '#E3F7EE' }]}>
                    <ICheck size={14} color="#087A4A" sw={3} />
                    <T f="bodyHeavy" size={13} color="#075E3A">
                      Oʻtildi
                    </T>
                  </View>
                ) : (
                  <View style={[s.chip, { backgroundColor: '#EEF1F7' }]}>
                    <ILock />
                    <T f="bodyHeavy" size={13} color="#4A5468">
                      Yopiq
                    </T>
                  </View>
                )}
              </View>
            );
          })}
          <View style={[s.card, cardFix, { backgroundColor: '#FFF4D1' }]}>
            <View
              style={{
                width: 120,
                height: 120,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={s.starDisk}>
                <IStar />
              </View>
            </View>
            <View style={{ flex: 1, gap: 3, alignItems: 'center' }}>
              <T f="bodyHeavy" size={16} lh={20} style={{ textAlign: 'center' }}>
                Afsona yulduzlari
              </T>
              <T size={13} color="#7A5300" style={{ textAlign: 'center' }}>
                Har 1 000 chaqmoqda +1 ★
              </T>
            </View>
            {legendReached ? (
              <View style={[s.chip, { backgroundColor: '#E3F7EE' }]}>
                <ICheck size={14} color="#087A4A" sw={3} />
                <T f="bodyHeavy" size={13} color="#075E3A">
                  Ochiq
                </T>
              </View>
            ) : (
              <View style={[s.chip, { backgroundColor: '#FFFFFF' }]}>
                <ILock color="#7A5300" />
                <T f="bodyHeavy" size={13} color="#7A5300">
                  Yopiq
                </T>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 18 }}>
        <View style={s.note}>
          <View style={s.noteIcon}>
            <IBolt size={26} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <T size={15} lh={21} color="#34405A">
              Chaqmoq — dars, vazifa, mashq va jonli darsdan. Kunlik maqsad: {PER_DAY} ta.
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#F0EBFF',
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${(goal / PER_DAY) * 100}%`,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#7C4DFF',
                  }}
                />
              </View>
              <T f="bodyHeavy" size={13} color="#6A3CF0">
                Bugun {today} / {PER_DAY}
              </T>
            </View>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setPopup(true)}
          style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.link, hovered && { backgroundColor: '#E8E0FF' }]}
        >
          <Image source={designImages.cd192c1f07c6ae01a6b80b26d84e0ec7} style={{ width: 60, height: 60, marginLeft: 2 }} resizeMode="contain" />
          <View style={{ flex: 1, gap: 2 }}>
            <T f="bodyHeavy" size={17} color="#5B2FD6">
              Darajaga chiqqanda nima boʻladi?
            </T>
            <T size={14} color="#4A5468">
              Yangi nishon, profil belgisi va yulduzlar
            </T>
          </View>
          <View style={{ marginRight: 2 }}>
            <IChevron size={20} color="#5B2FD6" />
          </View>
        </Pressable>
      </View>
      {/* O'quvchining keyingi darajasi (eng yuqorida — o'zi). */}
      <LevelUpPopup visible={popup} onClose={() => setPopup(false)} levelIndex={Math.min(curIdx + 1, V2_TOP_LEVEL)} />
    </DesktopPage>
  );
}

const s = StyleSheet.create({
  hero: {
    backgroundColor: '#6A3CF0',
    borderRadius: 28,
    paddingVertical: 36,
    paddingHorizontal: 34,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  heroCircle: {
    position: 'absolute',
    right: -60,
    top: -150,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: '#7C4DFF',
  },
  track: {
    height: 14,
    borderRadius: 7,
    backgroundColor: '#5229C9',
    overflow: 'hidden',
  },
  fill: { height: 14, borderRadius: 7, backgroundColor: '#FFC93C' },
  next: {
    // Dizaynda width 220 + padding (content-box) = 252.
    width: 252,
    backgroundColor: '#5229C9',
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  card: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 30,
    paddingHorizontal: 14,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 14,
  },
  chip: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starDisk: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFE59A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    flex: 1,
    flexBasis: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  noteIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F0EBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    flex: 1,
    flexBasis: 0,
    backgroundColor: '#F0EBFF',
    borderRadius: 24,
    // Chap karta bilan teng flex-basis uchun padding 22; dizayndagi 24 — ichki 2px margin.
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
});
