/**
 * v2 Dialog — mashqdan (dizayn: 41 AudioDialogLib).
 *
 * Dialog — CRM kutubxonasidagi speaking mavzusi (mc.library.speaking):
 * replikalar (speaker, ruscha gap, tarjima). Audio fayl yo'q — eski
 * resources/speaking ekranidagi kabi replikalar expo-speech bilan o'qiladi.
 * Vaqt (0:21 / 0:48) — matn hajmidan taxminiy. Mavzuda bitta dialog bor,
 * shuning uchun "1 / 1" va "Mavzudagi dialoglar" ro'yxati bo'sh bo'ladi.
 * "32-dars mavzusi bilan bir xil" — mavzu nomi dars nomiga mos kelsa.
 * Progress (qayergacha / eshitilgan) qurilmada saqlanadi — DialogList'da ko'rinadi.
 */
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dialogCount, getDialogProgress, saveDialogProgress } from '@/components/v2/library/data';
import { DarkPlayer, DialogText, SPEEDS, type DLine } from '@/components/v2/library/player';
import { ChevronLeftWide, Column, Display, findLessonForTitle, goBack, mmss, T, type LessonRef } from '@/components/v2/library/shared';
import { R } from '@/constants/v2/routes';
import type { SpeakingTopic } from '@/data/speakingTopics';
import { fetchMobileContent } from '@/services/contentApi';
import { speakableText } from '@/services/richText';
import { DDialog } from '@/components/v2/desktop/library/DDialog';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';

type Topic = SpeakingTopic & { coverUrl?: string };
const SECONDS_PER_WORD = 0.55; // taxminiy o'qish tezligi (1×), Book ekranidagi bilan bir xil

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

// Kompyuterda (keng oyna) — dizayndagi D_ versiya; telefonda mobil ekran o'zgarmaydi.
export default function DialogScreen() {
  return useIsDesktop() ? <DDialog /> : <DialogScreenMobile />;
}

function DialogScreenMobile() {
  const insets = useSafeAreaInsets();
  const { dialogId } = useLocalSearchParams<{ dialogId: string }>();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [lesson, setLesson] = useState<LessonRef | null>(null);
  const [startFrac, setStartFrac] = useState(0);
  const [heard, setHeard] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const mc = await fetchMobileContent();
        const p = await getDialogProgress();
        if (!alive) return;
        const t = mc.library.speaking.find((x) => x.id === dialogId) ?? null;
        setTopic(t);
        setLesson(t ? findLessonForTitle(mc, t.title) : null);
        setStartFrac(t ? p[t.id]?.frac ?? 0 : 0);
        setHeard(!!(t && p[t.id]?.heard));
      })()
        .catch(() => {})
        .finally(() => alive && setLoaded(true));
      return () => {
        alive = false;
      };
    }, [dialogId]),
  );

  if (!topic) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
        <Column style={{ paddingHorizontal: 20, gap: 16 }}>
          <BackBtn />
          {loaded && <T w={700} size={15} color="#4A5468">Dialog topilmadi</T>}
        </Column>
      </View>
    );
  }
  return <DialogView key={topic.id} topic={topic} lesson={lesson} startFrac={startFrac} heard={heard} onHeard={() => setHeard(true)} />;
}

function BackBtn() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Dialoglarga qaytish" onPress={() => goBack(R.dialogList)} style={({ pressed }) => [styles.back, pressed && { opacity: 0.85 }]}>
      <ChevronLeftWide />
    </Pressable>
  );
}

function DialogView({ topic, lesson, startFrac, heard, onHeard }: { topic: Topic; lesson: LessonRef | null; startFrac: number; heard: boolean; onHeard: () => void }) {
  const insets = useSafeAreaInsets();
  const lines = useMemo<DLine[]>(() => topic.lines.map((l) => ({ speaker: l.speaker, ru: l.en, uz: l.uz })), [topic]);
  // Har bir replikaning taxminiy boshlanishi va davomiyligi (soniya).
  const dur = useMemo(() => lines.map((l) => Math.max(1, words(l.ru) * SECONDS_PER_WORD)), [lines]);
  const starts = useMemo(() => dur.reduce<number[]>((a, d, i) => [...a, i ? a[i - 1] + dur[i - 1] : 0], []), [dur]);
  const total = dur.reduce((a, b) => a + b, 0);

  const startLine = Math.max(0, starts.findIndex((s, i) => s + dur[i] > startFrac * total));
  const [line, setLine] = useState(startFrac > 0 ? startLine : -1);
  const [inLine, setInLine] = useState(0); // joriy replikada o'tgan soniya
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [repeat, setRepeat] = useState(false);
  const playingRef = useRef(false);
  const repeatRef = useRef(false);
  repeatRef.current = repeat;
  const speedRef = useRef(1);
  speedRef.current = SPEEDS[speedIdx];

  const elapsed = line < 0 ? 0 : Math.min(total, starts[line] + inLine);
  const frac = total ? elapsed / total : 0;
  const n = dialogCount(topic);
  const h = heard ? n : 0;
  const going = !heard && frac > 0;

  // Ekrandan chiqishda to'xtatamiz va joyni saqlaymiz.
  const fracRef = useRef(0);
  fracRef.current = frac;
  useEffect(() => () => {
    playingRef.current = false;
    void Speech.stop();
    if (fracRef.current > 0) void saveDialogProgress(topic.id, fracRef.current);
  }, [topic.id]);

  // Gapirilayotgan replika ichidagi vaqt — taxminiy taymer.
  useEffect(() => {
    if (!playing || line < 0) return;
    const iv = setInterval(() => setInLine((x) => Math.min(dur[line], x + 0.25 * speedRef.current)), 250);
    return () => clearInterval(iv);
  }, [playing, line, dur]);

  const speak = useCallback(
    (k: number) => {
      if (k >= lines.length) {
        playingRef.current = false;
        setPlaying(false);
        setLine(-1);
        setInLine(0);
        void saveDialogProgress(topic.id, 0, true);
        onHeard();
        return;
      }
      setLine(k);
      setInLine(0);
      void Speech.stop();
      Speech.speak(speakableText(lines[k].ru), {
        language: 'ru-RU',
        rate: 0.95 * speedRef.current,
        onDone: () => {
          if (!playingRef.current) return;
          speak(repeatRef.current ? k : k + 1);
        },
      });
    },
    [lines, topic.id, onHeard],
  );

  const toggle = () => {
    if (playing) {
      playingRef.current = false;
      setPlaying(false);
      void Speech.stop();
      void saveDialogProgress(topic.id, frac);
    } else {
      playingRef.current = true;
      setPlaying(true);
      speak(line < 0 ? 0 : line);
    }
  };
  const jump = (k: number) => {
    const t = Math.max(0, Math.min(lines.length - 1, k));
    if (playingRef.current) speak(t);
    else {
      setLine(t);
      setInLine(0);
    }
  };
  const cycleSpeed = () => {
    const k = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(k);
    speedRef.current = SPEEDS[k];
    if (playingRef.current && line >= 0) speak(line);
  };

  return (
    <View style={styles.root}>
      <Column style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
          <BackBtn />
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <Display size={24} lh={1.1}>
              {topic.title} <Text style={{ color: '#5B6478' }}>· 1 / {n}</Text>
            </Display>
            <T w={700} size={13} color="#4A5468" numberOfLines={1}>{h} / {n} eshitilgan{going ? ' · 1-dialog davomda' : ''}</T>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 34 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.top}>
            <View style={[styles.cover, { backgroundColor: topic.colors?.[0] ?? '#E8EEFF' }]}>
              {topic.coverUrl ? (
                <Image source={{ uri: topic.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={topic.title} />
              ) : (
                <Text style={{ fontSize: 36 }}>{topic.emoji}</Text>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <T w={800} size={12} color="#1E3FD1" style={styles.upper}>1-dialog · {mmss(total)}</T>
              {/* Dialogning alohida nomi CRM'da yo'q — mavzu nomi. */}
              <T w={800} size={23} lh={1.1} style={{ letterSpacing: -0.23 }}>«{topic.title}»</T>
              {lesson && (
                <View style={styles.same}>
                  <T w={800} size={12} color="#075E3A">{lesson.number}-dars mavzusi bilan bir xil</T>
                </View>
              )}
            </View>
          </View>

          <DarkPlayer
            frac={frac}
            elapsed={elapsed}
            total={total}
            speed={SPEEDS[speedIdx]}
            onSpeed={cycleSpeed}
            playing={playing}
            onToggle={toggle}
            onPrev={() => jump(line <= 0 ? 0 : inLine > 1 ? line : line - 1)}
            onNext={() => jump(line + 1)}
            repeat={repeat}
            onRepeat={() => setRepeat((r) => !r)}
            unit="replika"
            disabled={!lines.length}
          />

          <DialogText lines={lines} current={line} onLine={jump} empty="Bu dialogga matn qoʻshilmagan." />

          <View style={styles.secHead}>
            <T w={800} size={13} color="#4A5468" style={styles.upperH2}>Mavzudagi dialoglar</T>
            <T w={800} size={12} color="#4A5468">{h} / {n} eshitilgan</T>
          </View>
          {/* Mavzuda boshqa dialog yo'q — ro'yxat bo'sh (CRM'da mavzu = bitta dialog). */}
          <View accessibilityLabel="Mavzudagi dialoglar" style={styles.grid} />
        </ScrollView>
      </Column>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6FA' },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  content: { paddingTop: 14, paddingHorizontal: 20, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cover: { width: 72, height: 72, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  upper: { textTransform: 'uppercase', letterSpacing: 0.72 },
  upperH2: { textTransform: 'uppercase', letterSpacing: 0.78 }, // 13px × 0.06em
  same: { alignSelf: 'flex-start', backgroundColor: '#E3F7EE', borderRadius: 9, paddingVertical: 4, paddingHorizontal: 8 },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: -4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
