/**
 * v2 Audiohikoya pleeri (dizayn: 36 Book).
 *
 * Kitob matni — CRM kutubxonasi (mc.library.books). Haqiqiy audio fayl
 * yo'q, shuning uchun eski ekrandagi kabi matn expo-speech orqali
 * o'qiladi; o'qilayotgan so'z sariq bilan belgilanadi (onBoundary).
 * Vaqt (1:12 / 4:05) — matn hajmidan taxminiy. Birinchi tinglashda
 * bookProgressStore.markBookListened (Bosh sahifadagi "Eshitish" ko'nikmasi).
 *
 * So'zga bosilganda: tarjima o'quvchining dars lug'atidan (getAccumulatedVocabulary)
 * olinadi; topilmasa — "Tarjima lug'atda yo'q" (so'zma-so'z lug'at yo'q).
 * "+ Lug'atga": shaxsiy lug'at saqlagichi hozircha yo'q.
 */
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { saveStoryPosition, getStoryPositions } from '@/components/v2/library/data';
import { BackFiveIcon, BackButton, Column, FwdFiveIcon, HandIcon, mmss, PauseIcon, PlayRounded, RepeatIcon, T } from '@/components/v2/library/shared';
import { LEVEL_CHIP, storyMinutes } from '@/components/v2/library/stories';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import type { BookStory } from '@/data/bookStories';
import type { VocabWord } from '@/data/lessonContent';
import { markBookListened } from '@/services/bookProgressStore';
import { fetchMobileContent } from '@/services/contentApi';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

type Story = BookStory & { coverUrl?: string };
type Word = { text: string; para: number; start: number }; // start — paragrafdagi belgi o'rni
type Box = { x: number; y: number; w: number; h: number };

const RATES = [0.75, 1, 1.25];
const SIZES = [20, 23, 17]; // "Aa" — matn o'lchami navbat bilan
const SECONDS_PER_WORD = 0.55; // taxminiy o'qish tezligi (1x)

const clean = (w: string) => w.toLowerCase().replace(/[^\p{L}-]/gu, '').replace(/́/g, '');

export default function BookScreen() {
  const insets = useSafeAreaInsets();
  const { storyId } = useLocalSearchParams<{ storyId: string }>();
  const [stories, setStories] = useState<Story[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [vocab, setVocab] = useState<VocabWord[]>([]);
  const [wordIdx, setWordIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [sizeIdx, setSizeIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [boxes, setBoxes] = useState<Record<number, Box>>({});
  const [textW, setTextW] = useState(350);
  const [addNote, setAddNote] = useState(false);
  const playingRef = useRef(false);
  const loopRef = useRef(false);
  loopRef.current = loop;

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

  const words = useMemo<Word[]>(() => {
    if (!story) return [];
    const out: Word[] = [];
    story.paragraphs.forEach((p, para) => {
      const re = /\S+/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(p.en))) out.push({ text: m[0], para, start: m.index });
    });
    return out;
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

  const total = Math.round(words.length * SECONDS_PER_WORD);
  const elapsed = Math.round(wordIdx * SECONDS_PER_WORD);
  const frac = words.length ? wordIdx / words.length : 0;

  const speakFrom = useCallback(
    (from: number, r: number) => {
      if (!story || from >= words.length) return;
      const para = words[from].para;
      const text = story.paragraphs[para].en;
      const offset = words[from].start;
      const paraWords = words.map((w, i) => ({ ...w, i })).filter((w) => w.para === para && w.start >= offset);
      void Speech.stop();
      Speech.speak(text.slice(offset), {
        language: 'ru-RU',
        rate: 0.95 * r,
        onBoundary: (e: { charIndex: number }) => {
          const abs = offset + e.charIndex;
          const hit = [...paraWords].reverse().find((w) => w.start <= abs);
          if (hit) setWordIdx(hit.i);
        },
        onDone: () => {
          if (!playingRef.current) return;
          const next = paraWords.length ? paraWords[paraWords.length - 1].i + 1 : from + 1;
          void saveStoryPosition(story.id, next / words.length);
          if (next < words.length) {
            setWordIdx(next);
            speakFrom(next, r);
          } else if (loopRef.current) {
            setWordIdx(0);
            speakFrom(0, r);
          } else {
            playingRef.current = false;
            setPlaying(false);
            setWordIdx(0);
          }
        },
      });
    },
    [story, words],
  );

  const play = () => {
    if (!story) return;
    void markBookListened(story.id);
    playingRef.current = true;
    setPlaying(true);
    setSelected(null);
    speakFrom(wordIdx, rate);
  };
  const pause = () => {
    playingRef.current = false;
    setPlaying(false);
    void Speech.stop();
    if (story) void saveStoryPosition(story.id, frac);
  };
  // ±5 soniya ≈ shuncha so'z oldinga/orqaga.
  const seek = (sec: number) => {
    const next = Math.max(0, Math.min(words.length - 1, wordIdx + Math.round(sec / SECONDS_PER_WORD)));
    setWordIdx(next);
    if (story) void saveStoryPosition(story.id, next / words.length);
    if (playingRef.current) speakFrom(next, rate);
  };
  const cycleRate = () => {
    const r = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(r);
    if (playingRef.current) speakFrom(wordIdx, r);
  };

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
  const lineH = Math.round(fontSize * 1.75);
  const sel = selected != null ? words[selected] : null;
  const selKey = sel ? sel.text.replace(/[^\p{L}́-]/gu, '') : '';
  const selVocab = sel ? vocab.find((v) => clean(v.english) === clean(sel.text)) : undefined;
  const selBox = selected != null ? boxes[selected] : undefined;
  const tipLeft = selBox ? Math.max(-6, Math.min(selBox.x - 6, textW - 250)) : 0;

  const onWordLayout = (i: number) => (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setBoxes((b) => (b[i] && b[i].x === x && b[i].y === y ? b : { ...b, [i]: { x, y, w: width, h: height } }));
  };

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
          <View style={styles.cover}>
            {story.coverUrl ? (
              <Image source={{ uri: story.coverUrl }} style={styles.coverImg} resizeMode="cover" accessibilityLabel={story.description || story.title} />
            ) : (
              <T w={800} size={64} style={{ textAlign: 'center', lineHeight: 196 }}>{story.emoji}</T>
            )}
          </View>
          <View style={styles.titleRow}>
            <T w={800} size={25} lh={1.1} style={{ flex: 1, letterSpacing: -0.25 }}>{story.title}</T>
            <View style={[styles.levelChip, { backgroundColor: chip.bg }]}>
              <T w={800} size={13} color={chip.fg}>{chip.label} · {storyMinutes(story)} daq</T>
            </View>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.textWrap} showsVerticalScrollIndicator={false}>
          <View style={styles.hint}>
            <HandIcon />
            <T w={700} size={12} color="#4A5468">Tarjima uchun soʻzga bosing</T>
          </View>
          <View style={styles.para} onLayout={(e) => setTextW(e.nativeEvent.layout.width)}>
            {words.map((w, i) => {
              const now = i === wordIdx && (playing || wordIdx > 0);
              const past = i < wordIdx;
              const isSel = i === selected;
              return (
                <Pressable
                  key={i}
                  onLayout={onWordLayout(i)}
                  onPress={() => setSelected(isSel ? null : i)}
                  accessibilityRole="button"
                  accessibilityLabel={`${w.text}, tarjima`}
                  style={[{ height: lineH, justifyContent: 'center' }]}
                >
                  {(() => {
                    // Tinish belgisi so'z ostidagi chiziq va rangga kirmasin.
                    const m = /^(.*?)([.,!?;:…»"')]*)$/u.exec(w.text) ?? [w.text, w.text, ''];
                    return (
                      <T w={past || now ? 700 : 600} size={fontSize} color={now || past ? '#0B1220' : '#5B6478'}>
                        <T
                          w={isSel ? 800 : past || now ? 700 : 600}
                          size={fontSize}
                          color={isSel ? '#1E3FD1' : now || past ? '#0B1220' : '#5B6478'}
                          style={[now && styles.nowWord, isSel && styles.selWord]}
                        >
                          {m[1]}
                        </T>
                        {m[2]}
                      </T>
                    );
                  })()}
                </Pressable>
              );
            })}
            {sel && selBox && (
              <View accessibilityRole="alert" style={[styles.tip, { left: tipLeft, top: selBox.y + selBox.h - 2 }]}>
                <View style={[styles.tipArrow, { left: Math.max(14, selBox.x - tipLeft + selBox.w / 2 - 7) }]} />
                <View style={{ flex: 1 }}>
                  <T w={800} size={16} color="#FFFFFF">{selVocab?.english ?? selKey}</T>
                  <T w={600} size={14} color="#B8C1D6" lh={1.3}>{selVocab?.translation ?? 'Tarjima lugʻatda yoʻq'}</T>
                </View>
                <Pressable accessibilityRole="button" onPress={() => setAddNote(true)} style={styles.addBtn}>
                  <T w={800} size={13} color="#FFFFFF">{addNote ? 'Tez orada' : '+ Lugʻatga'}</T>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[styles.player, { paddingBottom: insets.bottom + 34 }]}>
          <View style={{ gap: 6 }}>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Tinglash jarayoni"
              accessibilityValue={{ min: 0, max: total, now: elapsed }}
              style={styles.track}
            >
              <View style={[styles.fill, { width: `${frac * 100}%` }]} />
              <View style={[styles.knob, { left: `${frac * 100}%` }]} />
            </View>
            <View style={styles.times}>
              <T w={700} size={12} color="#4A5468">{mmss(elapsed)}</T>
              <T w={700} size={12} color="#4A5468">{mmss(total)}</T>
            </View>
          </View>
          <View style={styles.controls}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Tezlik: ${rate}x (0.75x / 1x / 1.25x)`} onPress={cycleRate} style={styles.sideBtn}>
              <T w={800} size={15}>{rate}x</T>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="5 soniya orqaga" onPress={() => seek(-5)} style={styles.skip}>
              <BackFiveIcon />
              <T w={800} size={11}>−5s</T>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pauza' : 'Tinglash'} onPress={playing ? pause : play} style={styles.main}>
              {playing ? <PauseIcon /> : <PlayRounded size={26} />}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="5 soniya oldinga" onPress={() => seek(5)} style={styles.skip}>
              <FwdFiveIcon />
              <T w={800} size={11}>+5s</T>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Takrorlash"
              accessibilityState={{ selected: loop }}
              onPress={() => setLoop((l) => !l)}
              style={[styles.sideBtn, loop && { borderColor: '#2F5BFF', backgroundColor: '#F0F3FF' }]}
            >
              <RepeatIcon color={loop ? '#2F5BFF' : '#0B1220'} />
            </Pressable>
          </View>
        </View>
      </Column>
    </View>
  );
}

const shadowMain = Platform.select({
  web: { boxShadow: '0 6px 16px rgba(47, 91, 255, 0.35)' } as object,
  default: { shadowColor: '#2F5BFF', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
});
const shadowTip = Platform.select({
  web: { boxShadow: '0 12px 28px rgba(11, 18, 32, 0.28)' } as object,
  default: { shadowColor: '#0B1220', shadowOpacity: 0.28, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  aa: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center' },
  top: { paddingTop: 14, paddingHorizontal: 20, gap: 12 },
  cover: { height: 196, borderRadius: 24, overflow: 'hidden', backgroundColor: '#E8EEFF' },
  coverImg: { width: '100%', height: '100%' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  levelChip: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, flexShrink: 0 },
  textWrap: { paddingTop: 12, paddingHorizontal: 20, gap: 8, paddingBottom: 140 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  para: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 5, position: 'relative' },
  nowWord: { backgroundColor: '#FFC93C', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden', ...(Platform.OS === 'web' ? ({ boxShadow: '0 2px 0 #E0A800' } as object) : {}) },
  selWord: { borderBottomWidth: 2.5, borderStyle: 'dashed', borderBottomColor: '#2F5BFF' },
  tip: { position: 'absolute', width: 250, marginTop: 10, backgroundColor: '#0B1220', borderRadius: 16, paddingVertical: 10, paddingRight: 10, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 2, ...shadowTip },
  tipArrow: { position: 'absolute', top: -6, width: 14, height: 14, backgroundColor: '#0B1220', borderRadius: 2, transform: [{ rotate: '45deg' }] },
  addBtn: { height: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  player: { paddingTop: 12, paddingHorizontal: 20, gap: 12, borderTopWidth: 1, borderTopColor: '#EEF1F7', backgroundColor: '#FFFFFF' },
  track: { height: 6, borderRadius: 3, backgroundColor: '#E7EBF3' },
  fill: { height: 6, borderRadius: 3, backgroundColor: '#2F5BFF' },
  knob: { position: 'absolute', top: -8, marginLeft: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: '#2F5BFF', borderWidth: 3, borderColor: '#FFFFFF' },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideBtn: { width: 56, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: '#D5DBE7', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  skip: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center' },
  main: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center', ...shadowMain },
});
