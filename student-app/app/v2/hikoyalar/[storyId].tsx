/**
 * v2 Audiohikoya pleeri (dizayn: 36 Book).
 *
 * Kitob matni — CRM kutubxonasi (mc.library.books). Haqiqiy audio fayl
 * yo'q, shuning uchun eski ekrandagi kabi matn expo-speech orqali gapma-gap
 * o'qiladi; o'qilayotgan so'z sariq bilan belgilanadi (onBoundary).
 * Vaqt (1:12 / 4:05) — matn hajmidan taxminiy. Birinchi tinglashda
 * bookProgressStore.markBookListened (Bosh sahifadagi "Eshitish" ko'nikmasi).
 *
 * So'zga bosilganda pastda tarjima paneli: tarjima va transkripsiya
 * o'quvchining dars lug'atidan (getAccumulatedVocabulary); topilmasa —
 * "Tarjima lugʻatda yoʻq". So'z shaxsiy lug'atga (Lugʻatim, addMyWord)
 * qo'shiladi — "Lugʻatga qoʻshildi".
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { getStoryPositions, saveStoryPosition } from '@/components/v2/library/data';
import { DarkPlayer, SPEEDS } from '@/components/v2/library/player';
import { BackButton, Check, Column, go, HandIcon, T } from '@/components/v2/library/shared';
import { LEVEL_CHIP, storyMinutes } from '@/components/v2/library/stories';
import { addMyWord } from '@/components/v2/practice/shared';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import type { BookStory } from '@/data/bookStories';
import type { VocabWord } from '@/data/lessonContent';
import { markBookListened } from '@/services/bookProgressStore';
import { fetchMobileContent } from '@/services/contentApi';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

type Story = BookStory & { coverUrl?: string };
type Word = { text: string; para: number; start: number; sent: number }; // start — paragrafdagi belgi o'rni
type Sentence = { para: number; first: number; last: number; end: number }; // end — paragrafdagi tugash o'rni

const SIZES = [20, 23, 17]; // "Aa" — matn o'lchami navbat bilan
const SECONDS_PER_WORD = 0.55; // taxminiy o'qish tezligi (1×)
const COVER_H = 150;
const COVER_POS_Y = 0.68; // dizayndagi object-position: 50% 68%

const clean = (w: string) => w.toLowerCase().replace(/[^\p{L}-]/gu, '').replace(/́/g, '');

export default function BookScreen() {
  const insets = useSafeAreaInsets();
  const { storyId } = useLocalSearchParams<{ storyId: string }>();
  const [stories, setStories] = useState<Story[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [vocab, setVocab] = useState<VocabWord[]>([]);
  const [wordIdx, setWordIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [repeat, setRepeat] = useState(false);
  const [sizeIdx, setSizeIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const playingRef = useRef(false);
  const repeatRef = useRef(false);
  repeatRef.current = repeat;
  const speedRef = useRef(1);
  speedRef.current = SPEEDS[speedIdx];

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchMobileContent()
        .then((mc) => alive && setStories(mc.library.books))
        .catch(() => {})
        .finally(() => alive && setLoaded(true));
      getAccumulatedVocabulary()
        .then((v) => alive && setVocab(v))
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  const index = stories.findIndex((s) => s.id === storyId);
  const story = index >= 0 ? stories[index] : null;

  // So'zlar va gaplar ("Oldingi / Keyingi gap" va "Gapni takrorlash" uchun).
  const { words, sentences } = useMemo(() => {
    const ws: Word[] = [];
    const ss: Sentence[] = [];
    story?.paragraphs.forEach((p, para) => {
      const re = /\S+/g;
      let m: RegExpExecArray | null;
      let first = ws.length;
      while ((m = re.exec(p.en))) {
        ws.push({ text: m[0], para, start: m.index, sent: ss.length });
        if (/[.!?…]["»)]*$/u.test(m[0])) {
          ss.push({ para, first, last: ws.length - 1, end: m.index + m[0].length });
          first = ws.length;
        }
      }
      if (first < ws.length) ss.push({ para, first, last: ws.length - 1, end: p.en.length });
    });
    return { words: ws, sentences: ss };
  }, [story]);

  // Saqlangan joydan davom etish.
  useEffect(() => {
    if (!story || !words.length) return;
    getStoryPositions().then((p) => {
      const f = p[story.id] ?? 0;
      setWordIdx(f >= 1 ? 0 : Math.min(words.length - 1, Math.floor(f * words.length)));
    });
  }, [story, words.length]);

  // Ekrandan chiqilganda ovozni to'xtatamiz.
  useEffect(() => () => {
    playingRef.current = false;
    void Speech.stop();
  }, []);

  const total = words.length * SECONDS_PER_WORD;
  const elapsed = wordIdx * SECONDS_PER_WORD;
  const frac = words.length ? wordIdx / words.length : 0;

  const speakFrom = useCallback(
    (from: number) => {
      if (!story || from >= words.length) return;
      const sn = sentences[words[from].sent];
      const text = story.paragraphs[sn.para].en;
      const offset = words[from].start;
      void Speech.stop();
      Speech.speak(text.slice(offset, sn.end), {
        language: 'ru-RU',
        rate: 0.95 * speedRef.current,
        onBoundary: (e: { charIndex: number }) => {
          const abs = offset + e.charIndex;
          for (let i = sn.last; i >= from; i--) {
            if (words[i].start <= abs) {
              setWordIdx(i);
              break;
            }
          }
        },
        onDone: () => {
          if (!playingRef.current) return;
          const next = repeatRef.current ? sn.first : sn.last + 1;
          void saveStoryPosition(story.id, next / words.length);
          if (next < words.length) {
            setWordIdx(next);
            speakFrom(next);
          } else {
            playingRef.current = false;
            setPlaying(false);
            setWordIdx(0);
          }
        },
      });
    },
    [story, words, sentences],
  );

  const toggle = () => {
    if (!story) return;
    if (playing) {
      playingRef.current = false;
      setPlaying(false);
      void Speech.stop();
      void saveStoryPosition(story.id, frac);
      return;
    }
    void markBookListened(story.id);
    playingRef.current = true;
    setPlaying(true);
    speakFrom(wordIdx);
  };
  const goSentence = (dir: -1 | 1) => {
    if (!words.length) return;
    const cur = words[wordIdx].sent;
    const sn = sentences[cur];
    // Gap boshidan uzoqlashgan bo'lsa "oldingi" — shu gap boshiga.
    const target = dir < 0 ? (wordIdx > sn.first ? cur : Math.max(0, cur - 1)) : Math.min(sentences.length - 1, cur + 1);
    const w = sentences[target].first;
    setWordIdx(w);
    if (story) void saveStoryPosition(story.id, w / words.length);
    if (playingRef.current) speakFrom(w);
  };
  const cycleSpeed = () => {
    const k = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(k);
    speedRef.current = SPEEDS[k];
    if (playingRef.current) speakFrom(wordIdx);
  };
  const seek = (f: number) => {
    const w = Math.max(0, Math.min(words.length - 1, Math.floor(f * words.length)));
    setWordIdx(w);
    if (story) void saveStoryPosition(story.id, w / words.length);
    if (playingRef.current) speakFrom(w);
  };

  const sel = selected != null ? words[selected] : null;
  const selVocab = sel ? vocab.find((v) => clean(v.english) === clean(sel.text)) : undefined;
  const selKey = sel ? sel.text.replace(/[^\p{L}́-]/gu, '') : '';

  // Bosilgan so'z shaxsiy lug'atga qo'shiladi (dizayn: "Lugʻatga qoʻshildi").
  useEffect(() => {
    if (!selKey) return;
    void addMyWord({ word: selVocab?.english ?? selKey, translation: selVocab?.translation });
  }, [selKey, selVocab]);

  if (!story) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
        <Column style={{ paddingHorizontal: 20, gap: 16 }}>
          <BackButton fallback={R.storyList} bg="#F4F6FA" />
          {loaded && <T w={700} size={15} color="#4A5468">Hikoya topilmadi</T>}
        </Column>
      </View>
    );
  }

  const chip = LEVEL_CHIP[story.level];
  const fontSize = SIZES[sizeIdx];
  const lineH = Math.round(fontSize * 1.7);

  return (
    <View style={styles.root}>
      <Column style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
          <BackButton fallback={R.storyList} bg="#F4F6FA" />
          <T w={800} size={13} color="#4A5468" style={{ flex: 1, textAlign: 'center' }}>Audiohikoya · {index + 1} / {stories.length}</T>
          <Pressable accessibilityRole="button" accessibilityLabel="Matn oʻlchami" onPress={() => setSizeIdx((i) => (i + 1) % SIZES.length)} style={styles.aa}>
            <T w={800} size={16} style={{ fontFamily: fonts.display }}>Aa</T>
          </Pressable>
        </View>

        <View style={styles.top}>
          <Cover story={story} />
          <View style={styles.titleCol}>
            <T w={800} size={24} lh={1.1} style={{ letterSpacing: -0.24 }}>{story.title}</T>
            <View style={[styles.levelChip, { backgroundColor: chip.bg }]}>
              <T w={800} size={13} color={chip.fg}>{chip.label} · {storyMinutes(story)} daq</T>
            </View>
          </View>
        </View>

        <View style={styles.textArea}>
          <View style={styles.hint}>
            <HandIcon />
            <T w={700} size={12} color="#4A5468">Tarjima uchun soʻzga bosing</T>
          </View>
          <ScrollBox>
            <View style={styles.para}>
              {words.map((w, i) => {
                const now = i === wordIdx && (playing || wordIdx > 0);
                const past = i < wordIdx;
                const isSel = i === selected;
                // Tinish belgisi so'z fonidan tashqarida qolsin.
                const m = /^(.*?)([.,!?;:…»"')]*)$/u.exec(w.text) ?? [w.text, w.text, ''];
                return (
                  <Pressable
                    key={i}
                    onPress={() => setSelected(isSel ? null : i)}
                    accessibilityRole="button"
                    accessibilityLabel={`${w.text}, tarjima`}
                    accessibilityState={{ selected: isSel }}
                    style={{ height: lineH, flexDirection: 'row', alignItems: 'center' }}
                  >
                    <T
                      w={isSel ? 800 : past || now ? 700 : 600}
                      size={fontSize}
                      color={isSel ? '#1E3FD1' : now || past ? '#0B1220' : '#5B6478'}
                      style={[now && !isSel && styles.nowWord, isSel && styles.selWord]}
                    >
                      {m[1]}
                    </T>
                    {!!m[2] && (
                      <T w={past || now ? 700 : 600} size={fontSize} color={now || past ? '#0B1220' : '#5B6478'}>{m[2]}</T>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </ScrollBox>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 34 }]}>
          {sel && (
            <View accessibilityRole="alert" accessibilityLabel={`Soʻz tarjimasi: ${selKey}`} style={styles.panel}>
              <View style={styles.panelRow}>
                <View style={styles.panelBar} />
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <T w={800} size={17}>{selVocab?.english ?? selKey}</T>
                    {!!selVocab?.transcript && <T w={700} size={12} color="#4A5468">[{selVocab.transcript.replace(/^\[|\]$/g, '')}]</T>}
                  </View>
                  <T w={600} size={14} color="#4A5468">{selVocab?.translation ?? 'Tarjima lugʻatda yoʻq'}</T>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Tarjimani yopish" onPress={() => setSelected(null)} style={styles.close}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#0B1220" strokeWidth={2.4} strokeLinecap="round">
                    <Path d="M6 6l12 12M18 6 6 18" />
                  </Svg>
                </Pressable>
              </View>
              <View style={styles.panelFoot}>
                <View accessibilityRole="text" style={styles.added}>
                  <Check size={16} color="#075E3A" sw={3} />
                  <T w={800} size={13} color="#075E3A" numberOfLines={1}>Lugʻatga qoʻshildi</T>
                </View>
                <Pressable accessibilityRole="link" onPress={() => go(R.lugat)} style={styles.openLink}>
                  <T w={800} size={13} color="#1E3FD1" numberOfLines={1}>Lugʻatimni ochish →</T>
                </Pressable>
              </View>
            </View>
          )}
          <DarkPlayer
            frac={frac}
            elapsed={elapsed}
            total={total}
            speed={SPEEDS[speedIdx]}
            onSpeed={cycleSpeed}
            playing={playing}
            onToggle={toggle}
            onPrev={() => goSentence(-1)}
            onNext={() => goSentence(1)}
            repeat={repeat}
            onRepeat={() => setRepeat((r) => !r)}
            unit="gap"
            onSeek={seek}
            disabled={!words.length}
          />
        </View>
      </Column>
    </View>
  );
}

/** Muqova: "cover" + vertikal 68% (dizayndagi object-position) — rasm o'lchamidan hisoblanadi. */
function Cover({ story }: { story: Story }) {
  const [w, setW] = useState(0);
  const [ratio, setRatio] = useState<number | null>(null); // balandlik / kenglik
  useEffect(() => {
    if (!story.coverUrl) return;
    Image.getSize(story.coverUrl, (iw, ih) => iw && setRatio(ih / iw), () => setRatio(null));
  }, [story.coverUrl]);
  let img: object = { width: '100%', height: '100%' };
  if (w && ratio) {
    const h = w * ratio;
    img = h >= COVER_H
      ? { position: 'absolute', left: 0, width: w, height: h, top: -(h - COVER_H) * COVER_POS_Y }
      : { position: 'absolute', top: 0, height: COVER_H, width: COVER_H / ratio, left: -(COVER_H / ratio - w) / 2 };
  }
  return (
    <View style={styles.cover} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {story.coverUrl ? (
        <Image source={{ uri: story.coverUrl }} style={img} resizeMode="cover" accessibilityLabel={story.description || story.title} />
      ) : (
        <T w={800} size={64} style={{ textAlign: 'center', lineHeight: COVER_H }}>{story.emoji}</T>
      )}
    </View>
  );
}

/** Matn oynasi: o'ngda ingichka aylantirish chizig'i va pastda oq soya (dizayndagidek). */
function ScrollBox({ children }: { children: ReactNode }) {
  const [view, setView] = useState(0);
  const [content, setContent] = useState(0);
  const [y, setY] = useState(0);
  const track = Math.max(0, view - 8);
  const thumb = content > view ? Math.max(24, (view / content) * track) : 0;
  const top = content > view ? (y / (content - view)) * (track - thumb) : 0;
  return (
    <View style={styles.box} onLayout={(e) => setView(e.nativeEvent.layout.height)}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_, h) => setContent(h)}
        onScroll={(e) => setY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingRight: 8, paddingBottom: 48 }}
      >
        {children}
      </ScrollView>
      {thumb > 0 && (
        <View pointerEvents="none" style={styles.sbTrack}>
          <View style={[styles.sbThumb, { top, height: thumb }]} />
        </View>
      )}
      <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)', '#FFFFFF']} style={styles.fade} />
    </View>
  );
}

const shadowPanel = Platform.select({
  web: { boxShadow: '0 8px 24px rgba(11, 18, 32, 0.12)' } as object,
  default: { shadowColor: '#0B1220', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  aa: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center' },
  top: { paddingTop: 14, paddingHorizontal: 20, gap: 10, flexShrink: 0 },
  cover: { height: COVER_H, borderRadius: 24, overflow: 'hidden', backgroundColor: '#E8EEFF' },
  titleCol: { alignItems: 'flex-start', gap: 6 },
  levelChip: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 },
  textArea: { flex: 1, minHeight: 0, paddingTop: 10, paddingHorizontal: 20, gap: 6 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  box: { flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' },
  para: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 5 },
  nowWord: { backgroundColor: '#FFC93C', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden', ...(Platform.OS === 'web' ? ({ boxShadow: '0 2px 0 #E0A800' } as object) : {}) },
  selWord: {
    backgroundColor: '#E8EEFF',
    borderRadius: 6,
    paddingHorizontal: 3,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ boxShadow: 'inset 0 -2.5px 0 #2F5BFF' } as object) : { borderBottomWidth: 2.5, borderBottomColor: '#2F5BFF' }),
  },
  sbTrack: { position: 'absolute', right: 0, top: 4, bottom: 4, width: 3, borderRadius: 2, backgroundColor: '#EEF1F7' },
  sbThumb: { position: 'absolute', left: 0, right: 0, borderRadius: 2, backgroundColor: '#C3CAD9' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 72 },
  bottom: { paddingTop: 10, paddingHorizontal: 20, gap: 10, flexShrink: 0 },
  panel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E6EE', borderRadius: 18, paddingVertical: 8, paddingRight: 8, paddingLeft: 14, gap: 6, ...shadowPanel },
  panelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelBar: { width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: '#2F5BFF', marginLeft: -6, flexShrink: 0 },
  close: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  panelFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: '#EEF1F7', paddingTop: 6 },
  added: { height: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#E3F7EE', flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  openLink: { height: 44, paddingLeft: 10, paddingRight: 4, borderRadius: 12, justifyContent: 'center', flexShrink: 0 },
});
