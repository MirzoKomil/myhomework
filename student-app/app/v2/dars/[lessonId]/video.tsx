/**
 * v2 Videodars (dizayn: 12 Video).
 *
 * Video eski video/watch.tsx kabi getLessonMaterials(mc).videoUrl'dan,
 * YouTubeEmbed orqali. "Ko'rdim" bosilganda eski ekrandagi kabi
 * markDone('videoWatch'). Ko'rilgan bo'lsa tugma "Qayta ko'rish" bo'ladi.
 * Konspekt iboralari — darsning speakingPractice (gap + tarjima) ro'yxati,
 * bo'lmasa konspekt matni. Video davomiyligi serverda yo'q — ko'rsatilmaydi.
 * Dars mavzusi nomi (dizayndagi "Modal so'zlar") serverda yo'q — ko'rsatilmaydi.
 * Coin — shu darsda yig'ilgan haqiqiy coinlar (coinsStore.useLessonCoins).
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useHomeworkScores } from '@/components/v2/homework/scoreStore';
import { loadGrammarRows } from '@/components/v2/library/grammar';
import { Check, PlayIcon } from '@/components/v2/lessons/icons';
import { BottomBar, Center, Column, TitleHeader } from '@/components/v2/lessons/parts';
import { RichText } from '@/components/RichText';
import { YouTubeEmbed } from '@/components/ui/YouTubeEmbed';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getResolvedLessonContent, type LessonContent } from '@/data/lessonContent';
import { fetchMobileContent, getLessonMaterials } from '@/services/contentApi';
import { useLessonCoins } from '@/services/coinsStore';
import { markDone, useLessonProgress } from '@/services/lessonProgressStore';
import { saveLastPosition } from '@/services/progressStore';

export default function VideoScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const id = String(lessonId);
  const [content, setContent] = useState<LessonContent | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [info, setInfo] = useState<{ number: number; name: string; isVideo: boolean } | null>(null);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const progress = useLessonProgress(id);
  const scores = useHomeworkScores()[id];
  const coins = useLessonCoins(id);
  // Shu darsga nomi bo'yicha mos grammatika mavzusi (kutubxonadagi bog'lanish) — bo'lmasa ro'yxat.
  const [grammarId, setGrammarId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadGrammarRows()
      .then(({ rows }) => {
        const row = rows.find((r) => r.lessons.some((l) => l.lesson.id === id));
        if (!cancelled) setGrammarId(row?.topic.id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    fetchMobileContent()
      .then(async (mc) => {
        const l = mc.lessons.find((x) => x.id === id);
        const idx = l ? mc.lessons.filter((x) => x.courseId === l.courseId).findIndex((x) => x.id === id) : 0;
        const c = await getResolvedLessonContent(id, Math.max(0, idx));
        if (cancelled) return;
        setInfo({ number: idx + 1, name: l?.name ?? `${idx + 1}-dars`, isVideo: idx % 2 === 0 });
        setVideoUrl(getLessonMaterials(mc, id).videoUrl);
        setContent(c);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    saveLastPosition({ lessonId: id, section: 'video/watch', label: 'Video dars' });
  }, [id]);

  const watched = progress.videoWatch;
  const title = info ? `${info.number}-dars · Videodars` : 'Videodars';
  const subtitle = watched ? 'Koʻrilgan · qayta koʻrish' : videoUrl ? 'Koʻrilmagan' : 'Video hali biriktirilmagan';

  if (!content || !info) {
    return (
      <View style={styles.screen}>
        <Column>
          <TitleHeader title={title} fallback={R.path} />
          <Center>
            <Text style={styles.muted}>{error ? 'Darsni yuklab boʻlmadi.' : 'Yuklanmoqda…'}</Text>
          </Center>
        </Column>
      </View>
    );
  }

  const chips = content.vocabulary.slice(0, 3).map((w) => w.english);
  const parts = Object.values(scores ?? {});
  const correct = parts.reduce((a, p) => a + p.correct, 0);
  const total = parts.reduce((a, p) => a + p.total, 0);
  const meta = [
    content.vocabulary.length ? `${content.vocabulary.length} ta soʻz` : '',
    total ? `vazifa ${correct} / ${total}` : '',
    total || coins ? `+${coins} coin` : '',
  ].filter(Boolean).join(' · ');
  const phrases = content.speakingPractice;

  const onPrimary = async () => {
    if (!videoUrl) return;
    if (!watched) {
      await markDone(id, 'videoWatch');
      return;
    }
    setPlaying(true);
  };

  return (
    <View style={styles.screen}>
      <Column>
        <TitleHeader title={title} subtitle={subtitle} fallback={R.path} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.poster}>
            {playing && videoUrl ? (
              <YouTubeEmbed url={videoUrl} />
            ) : (
              <>
                <View style={styles.blob} />
                {chips.length > 0 && (
                  <View style={styles.chips} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    {chips.map((c, k) => (
                      <View key={k} style={[styles.chip, k === chips.length - 1 && chips.length > 1 && { backgroundColor: '#0B1220' }]}>
                        <Text style={[styles.chipText, k === chips.length - 1 && chips.length > 1 && { color: '#FFFFFF' }]}>{c}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <Image source={designImages.f639c30e1400761df83230b833ba42b2} style={styles.mascot} resizeMode="contain" />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Videoni ijro etish"
                  disabled={!videoUrl}
                  onPress={() => setPlaying(true)}
                  style={[styles.playBtn, !videoUrl && { opacity: 0.5 }]}
                >
                  <PlayIcon size={26} color="#FFFFFF" />
                </Pressable>
                {watched && (
                  <View style={styles.seen}>
                    <Check size={12} color="#087A4A" />
                    <Text style={styles.seenText}>Koʻrilgan</Text>
                  </View>
                )}
              </>
            )}
          </View>
          <View style={{ gap: 4 }}>
            <Text style={styles.name}>{info.name}</Text>
            {!!meta && <Text style={styles.meta}>{meta}</Text>}
          </View>
          <View accessibilityLabel="Konspekt" style={styles.konspekt}>
            <View style={styles.kHead}>
              <Text style={styles.kTitle}>Konspekt · asosiy iboralar</Text>
              {phrases.length > 0 && <Text style={styles.kCount}>{phrases.length} ta</Text>}
            </View>
            {phrases.length > 0 ? (
              phrases.map((p) => (
                <View key={p.id} style={styles.kRow}>
                  <RichText style={styles.kRu} text={p.sentence} />
                  <RichText style={styles.kUz} text={p.translation} />
                </View>
              ))
            ) : (
              <View style={styles.kRow}>
                <RichText style={styles.kUz} text={content.konspekt} />
              </View>
            )}
          </View>
        </ScrollView>
        <BottomBar style={styles.btns}>
          <Pressable accessibilityRole="link" onPress={() => router.push((grammarId ? R.grammar(grammarId) : R.grammarList) as Href)} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.85 }]}>
            <Text style={styles.secondaryText}>Grammatika</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={watched ? 'Videoni qayta koʻrish' : undefined}
            disabled={!videoUrl}
            onPress={onPrimary}
            style={({ pressed }) => [styles.primary, !videoUrl && { opacity: 0.5 }, pressed && { backgroundColor: '#1E3FD1' }]}
          >
            {watched ? <PlayIcon color="#FFFFFF" /> : <Check size={18} />}
            <Text style={styles.primaryText}>{watched ? 'Qayta koʻrish' : 'Koʻrdim'}</Text>
          </Pressable>
        </BottomBar>
      </Column>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  muted: { fontFamily: fonts.body, fontSize: 14, color: '#4A5468', textAlign: 'center' },
  content: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  poster: { position: 'relative', height: 196, borderRadius: 24, backgroundColor: '#FFC93C', overflow: 'hidden' },
  blob: { position: 'absolute', left: -40, bottom: -70, width: 220, height: 220, borderRadius: 110, backgroundColor: '#FFD866' },
  chips: { position: 'absolute', right: 18, top: 18, gap: 6, alignItems: 'flex-end' },
  chip: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 4, paddingHorizontal: 9 },
  chipText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#0B1220', fontWeight: 'normal' },
  mascot: { position: 'absolute', left: 14, bottom: 6, width: 176, height: 164 },
  playBtn: { position: 'absolute', left: '50%', top: '50%', marginLeft: -32, marginTop: -32, width: 64, height: 64, borderRadius: 32, backgroundColor: '#0B1220', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(11,18,32,0.3)' } as object,
  seen: { position: 'absolute', left: 14, top: 14, backgroundColor: '#FFFFFF', borderRadius: 9, paddingVertical: 4, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  seenText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: '#075E3A', fontWeight: 'normal' },
  name: { fontFamily: fonts.bodyHeavy, fontSize: 19, lineHeight: 23.75, color: '#0B1220', fontWeight: 'normal' },
  meta: { fontFamily: fonts.body, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  konspekt: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 6 },
  kHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6 },
  kTitle: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#0B1220', fontWeight: 'normal' },
  kCount: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: '#1E3FD1', fontWeight: 'normal' },
  kRow: { gap: 1, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#EEF1F7' },
  kRu: { fontFamily: fonts.bodyHeavy, fontSize: 15, lineHeight: 21, color: '#0B1220', fontWeight: 'normal' },
  kUz: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: '#4A5468', fontWeight: 'normal' },
  btns: { flexDirection: 'row', gap: 10 },
  secondary: { flexGrow: 1, flexBasis: 0, height: 56, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#0B1220', fontWeight: 'normal' },
  // Dizayndagi <button> brauzerning standart 6px yon paddingi bilan chiziladi (eni 137 : 203) — shu aynan takrorlanadi.
  primary: { flexGrow: 1.4, flexBasis: 12, paddingHorizontal: 6, height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#FFFFFF', fontWeight: 'normal' },
});
