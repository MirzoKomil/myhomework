/**
 * Kutubxona dialogi (mc.library.speaking) ijrosi — mobil va kompyuter
 * ekranlari uchun umumiy.
 *
 * - Mavzuga audio fayl (audioUrl) biriktirilgan bo'lsa — haqiqiy ovoz
 *   (expo-audio), joriy replika lines[].start vaqtlari bo'yicha (kitob
 *   treklaridagi lineStarts bilan bir xil).
 * - Audio bo'lmasa — avvalgidek replikalar expo-speech bilan o'qiladi,
 *   vaqt matn hajmidan taxminiy.
 *
 * Ikkala hook bir xil DialogPlayback qaytaradi — ekran qaysi biri
 * ishlayotganini bilmaydi.
 */
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { saveDialogProgress } from '@/components/v2/library/data';
import { SPEEDS, type DLine } from '@/components/v2/library/player';
import { lineStarts } from '@/components/v2/lessons/data';
import type { SpeakingTopic } from '@/data/speakingTopics';
import { speakableText } from '@/services/richText';

export type DialogTopic = SpeakingTopic & { coverUrl?: string };

export type DialogPlayback = {
  /** Joriy replika (-1 — hali boshlanmagan). */
  line: number;
  elapsed: number;
  total: number;
  frac: number;
  playing: boolean;
  speedIdx: number;
  repeat: boolean;
  toggle: () => void;
  jump: (k: number) => void;
  prev: () => void;
  cycleSpeed: () => void;
  toggleRepeat: () => void;
  /** Faqat haqiqiy audioda — progress chizig'ini bosib o'tish. */
  seek?: (f: number) => void;
};

type Args = { topic: DialogTopic; lines: DLine[]; startFrac: number; onHeard: () => void };

/** CRM replikalarini (en = ruscha matn) ekran formatiga o'tkazadi. */
export const topicLines = (topic: DialogTopic): DLine[] =>
  topic.lines.map((l) => ({ speaker: l.speaker, ru: l.en, uz: l.uz, ...(typeof l.start === 'number' ? { start: l.start } : {}) }));

export const hasAudio = (topic: DialogTopic) => !!topic.audioUrl;

const SECONDS_PER_WORD = 0.55; // taxminiy o'qish tezligi (1×), Book ekranidagi bilan bir xil
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

// ── Audio fayl yo'q: expo-speech ─────────────────────────────────────────────
export function useTtsDialog({ topic, lines, startFrac, onHeard }: Args): DialogPlayback {
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

  // Ekrandan chiqishda to'xtatamiz va joyni saqlaymiz.
  const fracRef = useRef(0);
  fracRef.current = frac;
  useEffect(
    () => () => {
      playingRef.current = false;
      void Speech.stop();
      if (fracRef.current > 0) void saveDialogProgress(topic.id, fracRef.current);
    },
    [topic.id],
  );

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
    if (!lines.length) return;
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

  return {
    line,
    elapsed,
    total,
    frac,
    playing,
    speedIdx,
    repeat,
    toggle,
    jump,
    prev: () => jump(line <= 0 ? 0 : inLine > 1 ? line : line - 1),
    cycleSpeed,
    toggleRepeat: () => setRepeat((r) => !r),
  };
}

// ── Audio fayl bor: expo-audio ───────────────────────────────────────────────
export function useAudioDialog({ topic, lines, startFrac, onHeard }: Args): DialogPlayback {
  const player = useAudioPlayer({ uri: topic.audioUrl! }, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [repeatLine, setRepeatLine] = useState<number | null>(null);
  const started = useRef(false);
  const last = useRef({ t: 0, d: 0 });

  const d = status.duration || 0;
  const t = status.currentTime || 0;
  const total = d || topic.durationSec || 0;
  const frac = d > 0 ? Math.min(1, t / d) : 0;
  const n = lines.length;
  const starts = useMemo(() => lineStarts(lines, d), [lines, d]);
  // Hali boshlanmagan bo'lsa replika belgilanmaydi.
  let line = -1;
  if (n && d > 0 && (t > 0 || status.playing)) for (let k = 0; k < n; k++) if (starts[k] <= t + 0.05) line = k;
  const lineStart = (k: number) => (d > 0 && n ? (starts[Math.max(0, Math.min(n - 1, k))] ?? 0) : 0);
  last.current = { t, d };

  // To'xtatilgan joydan davom ettiramiz.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !status.isLoaded || d <= 0) return;
    resumed.current = true;
    const at = startFrac * d;
    if (at > 0 && at < d - 0.5) void player.seekTo(at);
  }, [status.isLoaded, d, startFrac, player]);

  // Ekrandan chiqishda joyni saqlaymiz (faqat ijro boshlangan bo'lsa).
  useEffect(
    () => () => {
      const { t: lt, d: ld } = last.current;
      if (started.current && ld > 0 && lt > 0) void saveDialogProgress(topic.id, Math.min(0.999, lt / ld));
    },
    [topic.id],
  );
  useEffect(() => {
    if (status.playing) started.current = true;
    else if (started.current && d > 0 && t > 0 && t < d - 0.3) void saveDialogProgress(topic.id, t / d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.playing]);

  useEffect(() => {
    if (!status.didJustFinish) return;
    started.current = false;
    setRepeatLine(null);
    void saveDialogProgress(topic.id, 0, true);
    onHeard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  // Replikani takrorlash: tanlangan replika tugashi bilan boshiga qaytamiz.
  useEffect(() => {
    if (repeatLine === null || !status.playing || line < 0) return;
    if (line !== repeatLine) void player.seekTo(lineStart(repeatLine));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, repeatLine, status.playing]);

  const toggle = () => {
    if (status.playing) player.pause();
    else {
      if (d > 0 && t >= d - 0.2) void player.seekTo(0);
      player.play();
    }
  };
  const jump = (k: number) => {
    const target = Math.max(0, Math.min(n - 1, k));
    if (repeatLine !== null) setRepeatLine(target);
    void player.seekTo(lineStart(target));
  };
  const prev = () => {
    if (!n || d <= 0) return void player.seekTo(Math.max(0, t - 5));
    const base = line < 0 ? 0 : line;
    // Replika boshidan 1 s o'tgan bo'lsa "oldingi" — shu replika boshiga.
    jump(t - lineStart(base) > 1 ? base : base - 1);
  };
  const cycleSpeed = () => {
    const k = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(k);
    player.setPlaybackRate(SPEEDS[k]);
  };

  return {
    line,
    elapsed: t,
    total,
    frac,
    playing: status.playing,
    speedIdx,
    repeat: repeatLine !== null,
    toggle,
    jump,
    prev,
    cycleSpeed,
    toggleRepeat: () => setRepeatLine((r) => (r === null ? Math.max(0, line) : null)),
    seek: (f: number) => {
      if (d > 0) void player.seekTo(f * d);
    },
  };
}
