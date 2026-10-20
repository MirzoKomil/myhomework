/**
 * Kompyuter: Audiohikoya pleeri (dizayn: D_Book.dc.html), fokus rejim.
 *
 * Mantiq mobil hikoyalar/[storyId].tsx bilan aynan bir xil (u yerdan
 * ko'chirilgan — mobil fayl o'zgarmasligi uchun): kitob matni CRM'dan,
 * expo-speech gapma-gap o'qiydi, o'qilayotgan so'z sariq (onBoundary), vaqt —
 * matn hajmidan taxminiy, birinchi tinglashda markBookListened, joy saqlanadi.
 * So'zga bosilsa tarjima paneli (dars lug'atidan) va so'z Lugʻatimga qo'shiladi.
 * Klaviatura: Space, ← → gaplar, R takrorlash, S tezlik, Esc — panelni / ekranni yopish.
 */
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getStoryPositions, saveStoryPosition } from '@/components/v2/library/data';
import { SPEEDS } from '@/components/v2/library/player';
import { go, mmss } from '@/components/v2/library/shared';
import { storyMinutes } from '@/components/v2/library/stories';
import { addMyWord } from '@/components/v2/practice/shared';
import { R } from '@/constants/v2/routes';
import type { BookStory } from '@/data/bookStories';
import type { VocabWord } from '@/data/lessonContent';
import { markBookListened } from '@/services/bookProgressStore';
import { fetchMobileContent } from '@/services/contentApi';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

import { FocusFrame } from '../Shell';
import { useDesktopKeys } from '../useDesktop';
import { D_LEVEL } from './DStoryList';
import { DPlayer, IArrow, ICheck, IClose, IMouse, SegProgress, T } from './ui';

type Story = BookStory & { coverUrl?: string };
type Word = { text: string; para: number; start: number; sent: number };
type Sentence = { para: number; first: number; last: number; end: number };

const SIZES = [30, 34, 26]; // "Matn oʻlchami" — navbat bilan (dizayn: 30px)
const SECONDS_PER_WORD = 0.55;

const clean = (w: string) => w.toLowerCase().replace(/[^\p{L}-]/gu, '').replace(/́/g, '');

export function DBook() {
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

  const index = stories.findIndex((x) => x.id === storyId);
  const story = index >= 0 ? stories[index] : null;

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

  useEffect(() => {
    if (!story || !words.length) return;
    getStoryPositions().then((p) => {
      const f = p[story.id] ?? 0;
      setWordIdx(f >= 1 ? 0 : Math.min(words.length - 1, Math.floor(f * words.length)));
    });
  }, [story, words.length]);

  useEffect(
    () => () => {
      playingRef.current = false;
      void Speech.stop();
    },
    [],
  );

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
    if (!story || !words.length) return;
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

  useEffect(() => {
    if (!selKey) return;
    void addMyWord({ word: selVocab?.english ?? selKey, translation: selVocab?.translation }, 'story');
  }, [selKey, selVocab]);

  useDesktopKeys({
    ' ': toggle,
    ArrowLeft: () => goSentence(-1),
    ArrowRight: () => goSentence(1),
    r: () => setRepeat((r) => !r),
    s: cycleSpeed,
  });

  if (!story) {
    return (
      <FocusFrame closeTo={R.storyList} closeLabel="Orqaga (Esc)" title="Audiohikoya">
        <View style={{ padding: 32 }}>
          {loaded && (
            <T w={700} size={15} color="#4A5468">
              Hikoya topilmadi
            </T>
          )}
        </View>
      </FocusFrame>
    );
  }

  const chip = D_LEVEL[story.level];
  const fontSize = SIZES[sizeIdx];
  const lineH = Math.round(fontSize * 1.8);
  const timeText = `${mmss(elapsed)} / ${mmss(total)}`;

  return (
    <FocusFrame
      closeTo={R.storyList}
      closeLabel="Orqaga (Esc)"
      // Tarjima paneli ochiq bo'lsa Esc avval panelni yopadi.
      onClose={selected != null ? () => setSelected(null) : undefined}
      title={`Audiohikoya · ${index + 1} / ${stories.length}`}
      subtitle={`${chip.label} · ${storyMinutes(story)} daq`}
      center={<SegProgress left="Tinglash" right={timeText} segments={1} current={0} frac={frac} label={`Tinglash jarayoni ${timeText}`} />}
      right={
        <Pressable accessibilityRole="button" accessibilityLabel="Matn oʻlchami" onPress={() => setSizeIdx((i) => (i + 1) % SIZES.length)} style={s.aa}>
          <T size={17}>A</T>
          <T size={13}>a</T>
          <T size={14} style={{ marginLeft: 6 }}>
            Matn oʻlchami
          </T>
        </Pressable>
      }
      scroll={false}
    >
      <View style={s.stage}>
        <View style={s.wrap}>
          <View style={s.left}>
            <View style={[s.cover, { backgroundColor: story.coverUrl ? '#EAE4DF' : story.colors?.[0] ?? '#E8EEFF' }]}>
              {story.coverUrl ? (
                <Image source={{ uri: story.coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={story.description || story.title} />
              ) : (
                <T size={96} style={{ textAlign: 'center', lineHeight: 390 }}>
                  {story.emoji}
                </T>
              )}
              <View style={s.coverChip}>
                <T size={12} color="#1E3FD1" ls={0.72} style={{ textTransform: 'uppercase' }}>
                  Audiohikoya · {index + 1} / {stories.length}
                </T>
              </View>
            </View>
            <View style={{ gap: 10 }}>
              <T f="display" size={32} lh={35.2} ls={-0.64} accessibilityRole="header">
                {story.title}
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[s.levelChip, { backgroundColor: chip.bg }]}>
                  <T size={13} color={chip.fg}>
                    {chip.label} · {storyMinutes(story)} daq
                  </T>
                </View>
                <T w={700} size={13} color="#4A5468">
                  Kitob: Audiohikoyalar
                </T>
              </View>
            </View>
            <DPlayer
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
              fmt={mmss}
            />
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 14 }}>
            <View style={s.hintRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IMouse />
                <T w={700} size={14} color="#4A5468">
                  Tarjima uchun soʻzga bosing
                </T>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#FFC93C' }} />
                <T w={700} size={13} color="#4A5468">
                  hozir oʻqilmoqda
                </T>
              </View>
            </View>
            <View style={s.textCard}>
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                <View style={[s.para, { columnGap: Math.round(fontSize * 0.27) }]}>
                  {words.map((w, i) => {
                    const now = i === wordIdx && (playing || wordIdx > 0);
                    const past = i < wordIdx;
                    const isSel = i === selected;
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
                          style={[now && !isSel && s.nowWord, isSel && s.selWord]}
                        >
                          {m[1]}
                        </T>
                        {!!m[2] && (
                          <T w={past || now ? 700 : 600} size={fontSize} color={now || past ? '#0B1220' : '#5B6478'}>
                            {m[2]}
                          </T>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              {sel && (
                <View accessibilityRole="alert" accessibilityLabel={`Soʻz tarjimasi: ${selKey}`} style={s.panel}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={s.panelBar} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <T size={22}>{selVocab?.english ?? selKey}</T>
                        {!!selVocab?.transcript && (
                          <T w={700} size={14} color="#4A5468">
                            [{selVocab.transcript.replace(/^\[|\]$/g, '')}]
                          </T>
                        )}
                      </View>
                      <T w={600} size={16} color="#34405A">
                        {selVocab?.translation ?? 'Tarjima lugʻatda yoʻq'}
                      </T>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel="Tarjimani yopish (Esc)" onPress={() => setSelected(null)} style={s.close}>
                      <IClose />
                    </Pressable>
                  </View>
                  <View style={s.panelFoot}>
                    <View accessibilityRole="text" style={s.added}>
                      <ICheck size={16} color="#075E3A" sw={2.8} />
                      <T size={14} color="#075E3A">
                        Lugʻatga qoʻshildi
                      </T>
                    </View>
                    <Pressable accessibilityRole="link" onPress={() => go(R.lugat)} style={s.openLink}>
                      <T size={15} color="#1E3FD1">
                        Lugʻatimni ochish
                      </T>
                      <IArrow />
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </FocusFrame>
  );
}

const shadowPanel = Platform.select({
  web: { boxShadow: '0 10px 30px rgba(11,18,32,0.08)' } as object,
  default: { shadowColor: '#0B1220', shadowOpacity: 0.08, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
});

const s = StyleSheet.create({
  aa: { height: 46, paddingHorizontal: 16, borderRadius: 15, backgroundColor: '#F4F6FA', flexDirection: 'row', alignItems: 'baseline', paddingTop: 13, gap: 4 },
  stage: { flex: 1, minHeight: 0, alignItems: 'center', paddingTop: 26, paddingBottom: 32, paddingHorizontal: 16 },
  wrap: { width: 1100, maxWidth: '100%', flex: 1, minHeight: 0, flexDirection: 'row', gap: 28 },
  left: { width: 440, flexShrink: 0, gap: 18 },
  cover: { position: 'relative', height: 390, borderRadius: 26, overflow: 'hidden' },
  coverChip: { position: 'absolute', left: 14, top: 14, height: 30, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  levelChip: { height: 28, paddingHorizontal: 11, borderRadius: 10, justifyContent: 'center' },
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  textCard: { flex: 1, minHeight: 0, backgroundColor: '#FFFFFF', borderRadius: 26, paddingTop: 30, paddingHorizontal: 34, paddingBottom: 16, gap: 16 },
  para: { flexDirection: 'row', flexWrap: 'wrap' },
  nowWord: {
    backgroundColor: '#FFC93C',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 2px 0 #E0A800' } as object) : {}),
  },
  selWord: {
    backgroundColor: '#E8EEFF',
    borderRadius: 6,
    paddingHorizontal: 3,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ boxShadow: 'inset 0 -2.5px 0 #2F5BFF' } as object) : { borderBottomWidth: 2.5, borderBottomColor: '#2F5BFF' }),
  },
  panel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E6EE', borderRadius: 20, paddingTop: 14, paddingRight: 14, paddingBottom: 14, paddingLeft: 18, gap: 12, ...shadowPanel },
  panelBar: { width: 4, height: 50, borderRadius: 2, backgroundColor: '#2F5BFF', flexShrink: 0 },
  close: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  panelFoot: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#EEF1F7', paddingTop: 12 },
  added: { height: 42, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#E3F7EE', flexDirection: 'row', alignItems: 'center', gap: 7 },
  openLink: { marginLeft: 'auto', height: 42, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 5 },
});
