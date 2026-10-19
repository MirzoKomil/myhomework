/**
 * v2 Bonus video (dizayn: 27 · BonusPlayer).
 *
 * Ma'lumot eski homework/bonusLesson + video/watch bilan bir xil: kontent —
 * getResolvedLessonContent('bonus-N') (CRM'dagi konspekt, iboralar), video —
 * getLessonMaterials(mc, 'bonus-N').videoUrl (YouTubeEmbed), ko'rilgani —
 * lessonProgressStore videoWatch (ijro boshlanganda belgilanadi). Video
 * davomiyligi va bonus uchun coin serverda yo'q — 0 ko'rsatiladi.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { v2Back } from '@/services/v2Nav';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BONUS_LESSONS, TOTAL, isPast, weekdayDate } from '@/components/v2/homework/bonusData';
import { BackIcon, FullscreenIcon, PlayIcon } from '@/components/v2/homework/icons';
import { Txt, webShadow } from '@/components/v2/homework/ui';
import { YouTubeEmbed } from '@/components/ui/YouTubeEmbed';
import { RichText } from '@/components/RichText';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getResolvedLessonContent, type LessonContent } from '@/data/lessonContent';
import { fetchMobileContent, getLessonMaterials } from '@/services/contentApi';
import { getLessonProgress, loadLessonProgress, markDone, subscribe } from '@/services/lessonProgressStore';

export default function BonusPlayerScreen() {
  const insets = useSafeAreaInsets();
  const { bonusId } = useLocalSearchParams<{ bonusId: string }>();
  const id = String(bonusId);
  const bonus = BONUS_LESSONS.find((b) => b.id === id);
  const [content, setContent] = useState<LessonContent | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [playing, setPlaying] = useState(false);
  const [, setTick] = useState(0);

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
  // Sahnadagi iboralar — CRM'dagi speakingPractice, bo'lmasa dars lug'ati.
  const phrases = content
    ? content.speakingPractice.length
      ? content.speakingPractice.map((p) => ({ id: p.id, ru: p.sentence, uz: p.translation }))
      : content.vocabulary.map((w) => ({ id: w.id, ru: w.english, uz: w.translation }))
    : [];
  const posterTitle = phrases[0]?.ru;

  const back = () => v2Back(R.bonus);
  const play = () => {
    if (!videoUrl) return;
    setPlaying(true);
    if (!watched) void markDone(id, 'videoWatch');
  };

  return (
    <View style={st.screen}>
      <View style={[st.column, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
        <View style={st.header}>
          <Pressable accessibilityRole="link" accessibilityLabel="Bonuslarga qaytish" onPress={back} style={({ pressed }) => [st.back, pressed && st.pressed]}>
            <BackIcon />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <Txt f="display" size={24} lh={26.4} style={{ letterSpacing: -0.48 }} accessibilityRole="header">
              {bonus ? `${bonus.number}-bonus dars` : 'Bonus dars'}
            </Txt>
            {bonus && (
              <Txt f="bodyBold" size={13} color="#4A5468" numberOfLines={1}>
                {weekdayDate(bonus.date)}
                {status ? ` · ${status}` : ''}
              </Txt>
            )}
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={[st.body, { paddingBottom: Math.max(34, insets.bottom + 14) }]} showsVerticalScrollIndicator={false}>
          <View accessibilityLabel="Video pleer" style={st.player}>
            <View style={st.poster}>
              {playing && videoUrl ? (
                <YouTubeEmbed url={videoUrl} />
              ) : (
                <>
                  <View style={st.blobA} />
                  <View style={st.blobB} />
                  <Image source={designImages['8c685006bea3b1898e962d7116efecbd']} accessibilityLabel="Domik kinoda" resizeMode="contain" style={st.mascot} />
                  <View style={st.posterText}>
                    <Txt f="bodyHeavy" size={11} color="#5A2FD6" style={st.chip}>
                      {label}
                    </Txt>
                    {!!posterTitle && (
                      <Txt f="display" size={22} lh={23.1} color="#FFFFFF" lang="ru">
                        «{posterTitle}»
                      </Txt>
                    )}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Videoni ijro etish"
                    disabled={!videoUrl}
                    onPress={play}
                    style={[st.playBtn, webShadow('0 6px 18px rgba(11,18,32,0.3)'), !videoUrl && { opacity: 0.5 }]}
                  >
                    <PlayIcon size={24} color="#5A2FD6" />
                  </Pressable>
                  <Txt f="bodyHeavy" size={12} color="#FFFFFF" style={st.duration}>
                    0:00
                  </Txt>
                </>
              )}
            </View>
            <View style={st.controls}>
              <Txt f="bodyBold" size={12} color="#B8C1D6" style={st.tabular}>
                0:00
              </Txt>
              <View style={st.track}>
                <View style={st.thumb} />
              </View>
              <Txt f="bodyBold" size={12} color="#B8C1D6" style={st.tabular}>
                0:00
              </Txt>
              {/* Subtitr fayllari serverda yo'q — tugma ko'rinadi, lekin faol emas. */}
              <Pressable accessibilityRole="button" accessibilityLabel="Subtitrlar: rus + oʻzbek" accessibilityState={{ disabled: true }} disabled style={st.cc}>
                <Txt f="bodyHeavy" size={12} color="#FFFFFF">
                  CC
                </Txt>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Toʻliq ekran"
                disabled={!videoUrl}
                onPress={() => videoUrl && Linking.openURL(videoUrl)}
                style={[st.fs, !videoUrl && { opacity: 0.5 }]}
              >
                <FullscreenIcon />
              </Pressable>
            </View>
          </View>

          <View style={{ gap: 4 }}>
            <Txt f="display" size={22} lh={25.3} style={{ letterSpacing: -0.22 }}>
              {label}
            </Txt>
            {!!content?.konspekt && (
              <Txt f="body" size={14} color="#4A5468" lh={20.3}>
                <RichText inline style={{ fontFamily: fonts.body }} text={content.konspekt} />
              </Txt>
            )}
          </View>

          <View accessibilityLabel="Sahnadagi iboralar" style={st.phrases}>
            <Txt f="bodyHeavy" size={13} color="#4A5468" style={{ textTransform: 'uppercase', letterSpacing: 0.78, paddingBottom: 4 }}>
              Sahnadagi iboralar
            </Txt>
            {phrases.map((p) => (
              <View key={p.id} style={st.phraseRow}>
                <Txt f="bodyHeavy" size={15} lang="ru" style={{ flexShrink: 1 }}>
                  {p.ru}
                </Txt>
                <Txt f="body" size={13} color="#4A5468" style={{ textAlign: 'right', flexShrink: 1 }}>
                  {p.uz}
                </Txt>
              </View>
            ))}
          </View>

          <View style={st.reward}>
            <View style={[st.coinDot, webShadow('inset 0 -2px 0 #C98F00')]} />
            <Txt f="bodyHeavy" size={14} color="#7A5300" style={{ flex: 1 }}>
              {watched ? `Koʻrildi ✓ · ${watchedCount} / ${TOTAL}` : `Koʻrsangiz: +0 coin · ${watchedCount + 1} / ${TOTAL} boʻladi`}
            </Txt>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  pressed: { opacity: 0.85 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  body: { paddingTop: 16, paddingHorizontal: 20, gap: 14 },
  player: { borderRadius: 24, overflow: 'hidden', backgroundColor: '#0B1220' },
  poster: { position: 'relative', height: 224, backgroundColor: '#7C4DFF', overflow: 'hidden' },
  blobA: { position: 'absolute', right: -50, top: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: '#8F66FF' },
  blobB: { position: 'absolute', left: -30, bottom: -80, width: 180, height: 180, borderRadius: 90, backgroundColor: '#6A3CF0' },
  mascot: { position: 'absolute', right: 14, bottom: 8, width: 190, height: 190 },
  posterText: { position: 'absolute', left: 16, top: 16, gap: 6, maxWidth: 170 },
  chip: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 9, paddingVertical: 4, paddingHorizontal: 8, letterSpacing: 0.66, textTransform: 'uppercase', overflow: 'hidden' },
  playBtn: { position: 'absolute', left: 16, bottom: 16, width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  duration: { position: 'absolute', left: 86, bottom: 34, backgroundColor: '#0B1220', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, overflow: 'hidden' },
  controls: { paddingTop: 10, paddingBottom: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tabular: { fontVariant: ['tabular-nums'] },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#2B3550' },
  thumb: { position: 'absolute', left: -2, top: -5, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF' },
  cc: { height: 44, minWidth: 44, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#1B2438', alignItems: 'center', justifyContent: 'center' },
  fs: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1B2438', alignItems: 'center', justifyContent: 'center' },
  phrases: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 4 },
  phraseRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#EEF1F7' },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF4D1', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  coinDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#F5B70A', flexShrink: 0 },
});
