/**
 * Kompyuter: Bonus video (dizayn: D_BonusPlayer.dc.html).
 *
 * Ma'lumot mobil BonusPlayer bilan bir xil: kontent —
 * getResolvedLessonContent('bonus-N') (konspekt, iboralar), video —
 * getLessonMaterials(mc, 'bonus-N').videoUrl (YouTubeEmbed), ko'rilgani —
 * lessonProgressStore videoWatch (ijro boshlanganda belgilanadi).
 * Video davomiyligi va bonus coin'i serverda yo'q — "0:00" va "+0 coin".
 * Subtitr fayllari yo'q — CC tugmasi (va C tugmasi) faol emas.
 * Klaviatura: Space — ijro, F — to'liq ekran, Esc — yopish.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { RichText } from '@/components/RichText';
import { YouTubeEmbed } from '@/components/ui/YouTubeEmbed';
import { BONUS_LESSONS, isPast, TOTAL, weekdayDate } from '@/components/v2/homework/bonusData';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getResolvedLessonContent, type LessonContent } from '@/data/lessonContent';
import { fetchMobileContent, getLessonMaterials } from '@/services/contentApi';
import { getLessonProgress, loadLessonProgress, markDone, subscribe } from '@/services/lessonProgressStore';

import { FocusFrame } from '../Shell';
import { useDesktopKeys } from '../useDesktop';
import { ICoin, IFullscreen, IPlay, KeyHint, Over, T } from './ui';

export function DBonusPlayer() {
  const { bonusId } = useLocalSearchParams<{ bonusId: string }>();
  const id = String(bonusId);
  const bonus = BONUS_LESSONS.find((b) => b.id === id);
  const [content, setContent] = useState<LessonContent | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [playing, setPlaying] = useState(false);
  const [, setTick] = useState(0);
  const playerRef = useRef<View>(null);

  useEffect(() => {
    let cancelled = false;
    getResolvedLessonContent(id, bonus?.index ?? 0)
      .then((c) => !cancelled && setContent(c))
      .catch(() => {});
    fetchMobileContent()
      .then((mc) => !cancelled && setVideoUrl(getLessonMaterials(mc, id).videoUrl))
      .catch(() => {});
    loadLessonProgress().then(() => setTick((t) => t + 1));
    const unsub = subscribe(() => setTick((t) => t + 1));
    return () => {
      cancelled = true;
      unsub();
    };
  }, [id, bonus?.index]);

  const watched = getLessonProgress(id).videoWatch;
  const watchedCount = BONUS_LESSONS.filter((b) => getLessonProgress(b.id).videoWatch).length;
  const status = watched ? 'koʻrildi' : bonus && isPast(bonus.date) ? 'oʻtkazib yuborilgan' : '';
  const label = bonus?.category.label ?? '';
  // Sahnadagi iboralar — CRM'dagi speakingPractice, bo'lmasa dars lug'ati (mobildagi kabi).
  const phrases = content
    ? content.speakingPractice.length
      ? content.speakingPractice.map((p) => ({ id: p.id, ru: p.sentence, uz: p.translation }))
      : content.vocabulary.map((w) => ({ id: w.id, ru: w.english, uz: w.translation }))
    : [];
  const posterTitle = phrases[0]?.ru;

  const play = () => {
    if (!videoUrl) return;
    setPlaying(true);
    if (!watched) void markDone(id, 'videoWatch');
  };
  // F — videoni ijro etib, pleer blokini brauzerning to'liq ekraniga chiqaradi.
  const fullscreen = () => {
    if (!videoUrl) return;
    play();
    if (Platform.OS === 'web') {
      const el = playerRef.current as unknown as HTMLElement | null;
      el?.requestFullscreen?.().catch(() => {});
    }
  };
  useDesktopKeys({ ' ': play, f: fullscreen });

  return (
    <FocusFrame
      closeTo={R.bonus}
      closeLabel="Bonuslarga qaytish (Esc)"
      title={bonus ? `${bonus.number}-bonus dars` : 'Bonus dars'}
      subtitle={bonus ? `${weekdayDate(bonus.date)}${status ? ` · ${status}` : ''}` : undefined}
      center={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {!!label && (
            <View style={[s.chip, { backgroundColor: '#F0EBFF' }]}>
              <Over size={12} em={0.06} color="#6A3CF0">
                {label}
              </Over>
            </View>
          )}
          <T size={14} color="#34405A">
            Video · 0:00
          </T>
        </View>
      }
      right={
        <View style={s.coinPill}>
          <ICoin size={18} />
          <T size={15} color="#7A5300">
            +0 coin
          </T>
        </View>
      }
      footerHeight={100}
      footerWidth={1100}
      footer={
        <>
          <View style={s.reward}>
            <ICoin size={22} />
            <T size={16} color="#7A5300">
              {watched ? `Koʻrildi ✓ · ${watchedCount} / ${TOTAL}` : `Koʻrsangiz: +0 coin · ${watchedCount + 1} / ${TOTAL} boʻladi`}
            </T>
          </View>
          <View style={{ flex: 1 }} />
          <View accessibilityLabel="Klaviatura" style={{ flexDirection: 'row', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <KeyHint k="Space" label="ijro / pauza" />
            <KeyHint k="C" label="subtitr" />
            <KeyHint k="F" label="toʻliq ekran" />
            <KeyHint k="Esc" label="yopish" />
          </View>
        </>
      }
    >
      <View style={s.body}>
        <View style={s.inner}>
          <View style={{ gap: 6 }}>
            <T f="display" size={30} lh={33} ls={-0.6} accessibilityRole="header">
              {label}
            </T>
            {!!content?.konspekt && (
              <T f="body" size={16} color="#4A5468" lh={24} style={{ maxWidth: 900 }}>
                <RichText inline style={{ fontFamily: fonts.body }} text={content.konspekt} />
              </T>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 28, alignItems: 'stretch' }}>
            <View ref={playerRef} accessibilityLabel="Video pleer" style={s.player}>
              <View style={s.poster}>
                {playing && videoUrl ? (
                  <YouTubeEmbed url={videoUrl} />
                ) : (
                  <>
                    <View accessibilityElementsHidden style={s.blobA} />
                    <View accessibilityElementsHidden style={s.blobB} />
                    <Image source={designImages['8c685006bea3b1898e962d7116efecbd']} accessibilityLabel="Domik kinoda" style={s.mascot} resizeMode="contain" />
                    <View style={s.posterText}>
                      {!!label && (
                        <View style={[s.chip, { backgroundColor: '#FFFFFF' }]}>
                          <Over size={12} em={0.06} color="#6A3CF0">
                            {label}
                          </Over>
                        </View>
                      )}
                      {!!posterTitle && (
                        <T f="display" size={44} lh={46.2} ls={-0.88} color="#FFFFFF" lang="ru">
                          «{posterTitle}»
                        </T>
                      )}
                    </View>
                    <View style={s.playRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Videoni ijro etish (Space)"
                        disabled={!videoUrl}
                        onPress={play}
                        style={[s.playBtn, !videoUrl && { opacity: 0.5 }]}
                      >
                        <IPlay size={38} color="#6A3CF0" />
                      </Pressable>
                      <View style={s.duration}>
                        <T size={17} color="#FFFFFF">
                          0:00
                        </T>
                      </View>
                    </View>
                  </>
                )}
              </View>
              <View style={s.controls}>
                <T f="bodyBold" size={14} color="#B8C1D6" style={s.tab}>
                  0:00
                </T>
                <View accessibilityRole="progressbar" accessibilityLabel="Video jarayoni" style={s.track}>
                  <View style={s.thumb} />
                </View>
                <T f="bodyBold" size={14} color="#B8C1D6" style={s.tab}>
                  0:00
                </T>
                <Pressable accessibilityRole="button" accessibilityLabel="Subtitrlar: rus + oʻzbek (C)" accessibilityState={{ disabled: true }} disabled style={s.ctl}>
                  <T size={15} color="#FFFFFF">
                    CC
                  </T>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Toʻliq ekran (F)" disabled={!videoUrl} onPress={fullscreen} style={[s.ctl, !videoUrl && { opacity: 0.5 }]}>
                  <IFullscreen />
                </Pressable>
              </View>
            </View>
            <View accessibilityLabel="Sahnadagi iboralar" style={s.phrases}>
              <View style={{ paddingBottom: 8 }}>
                <Over size={11}>Sahnadagi iboralar</Over>
              </View>
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {phrases.map((p) => (
                  <View key={p.id} style={s.phrase}>
                    <T size={19} lang="ru">
                      {p.ru}
                    </T>
                    <T f="body" size={15} color="#4A5468">
                      {p.uz}
                    </T>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </View>
    </FocusFrame>
  );
}

const s = StyleSheet.create({
  chip: { height: 30, paddingHorizontal: 11, borderRadius: 10, justifyContent: 'center', alignSelf: 'flex-start' },
  coinPill: { height: 40, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#FFF4D1', flexDirection: 'row', alignItems: 'center', gap: 6 },
  reward: { height: 54, paddingHorizontal: 20, borderRadius: 17, backgroundColor: '#FFF4D1', flexDirection: 'row', alignItems: 'center', gap: 10 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  inner: { width: 1100, maxWidth: '100%', gap: 22 },
  player: { width: 760, flexShrink: 0, borderRadius: 28, overflow: 'hidden', backgroundColor: '#0B1220' },
  poster: { position: 'relative', height: 428, backgroundColor: '#7C4DFF', overflow: 'hidden' },
  blobA: { position: 'absolute', right: -80, top: -90, width: 420, height: 420, borderRadius: 210, backgroundColor: '#8F66FF' },
  blobB: { position: 'absolute', left: -70, bottom: -150, width: 360, height: 360, borderRadius: 180, backgroundColor: '#6A3CF0' },
  mascot: { position: 'absolute', right: 40, bottom: 30, width: 340, height: 320 },
  posterText: { position: 'absolute', left: 36, top: 32, gap: 12, alignItems: 'flex-start', maxWidth: 380 },
  playRow: { position: 'absolute', left: 36, bottom: 34, flexDirection: 'row', alignItems: 'center', gap: 16 },
  playBtn: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  duration: { height: 36, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#0B1220', justifyContent: 'center' },
  controls: { paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  tab: { fontVariant: ['tabular-nums'] },
  track: { position: 'relative', flex: 1, height: 6, borderRadius: 3, backgroundColor: '#2B3550' },
  thumb: { position: 'absolute', left: 0, top: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF' },
  ctl: { width: 52, height: 44, borderRadius: 14, backgroundColor: '#1B2438', alignItems: 'center', justifyContent: 'center' },
  phrases: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 24, paddingTop: 18, paddingHorizontal: 20, paddingBottom: 16 },
  phrase: { gap: 4, paddingVertical: 22, borderTopWidth: 1, borderTopColor: '#EEF1F7' },
});
