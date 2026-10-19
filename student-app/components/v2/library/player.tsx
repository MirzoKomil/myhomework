/**
 * Kutubxona pleerlari (AudioTrack, AudioDialogLib, Book) uchun umumiy
 * qorong'u pleer va dialog matni bloki. Qiymatlar dizayndagi
 * <section aria-label="Pleer"> va "Matn va tarjima" bo'limlaridan.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { fonts } from '@/constants/v2/tokens';

import { RichText } from '@/components/RichText';
import { parseDialog, type DialogLine } from '@/components/v2/lessons/data';

import { NextIcon, PauseTall, PlayRounded, PrevIcon, RepeatOneIcon, T, mmss } from './shared';

export const SPEEDS = [0.75, 1, 1.25];
export const speedLabel = (s: number) => `${s}×`;

export function DarkPlayer({
  frac,
  elapsed,
  total,
  speed,
  onSpeed,
  playing,
  onToggle,
  onPrev,
  onNext,
  repeat,
  onRepeat,
  unit,
  onSeek,
  disabled,
}: {
  frac: number;
  elapsed: number;
  total: number;
  speed: number;
  onSpeed: () => void;
  playing: boolean;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  repeat: boolean;
  onRepeat: () => void;
  /** "replika" (dialog) yoki "gap" (hikoya) — tugma yorliqlari uchun. */
  unit: 'replika' | 'gap';
  onSeek?: (f: number) => void;
  disabled?: boolean;
}) {
  const [w, setW] = useState(0);
  const pct = `${Math.max(0, Math.min(1, frac)) * 100}%` as const;
  const Unit = unit === 'gap' ? 'Gapni' : 'Replikani';
  return (
    <View accessibilityLabel="Pleer" style={s.player}>
      <View style={{ gap: 5 }}>
        <Pressable
          accessibilityRole="progressbar"
          accessibilityLabel="Tinglash jarayoni"
          accessibilityValue={{ min: 0, max: Math.round(total), now: Math.round(elapsed) }}
          onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
          onPress={(e) => onSeek && w > 0 && onSeek(Math.max(0, Math.min(1, e.nativeEvent.locationX / w)))}
          style={{ paddingVertical: 5, marginVertical: -5 }}
        >
          <View style={s.bar}>
            <View style={[s.fill, { width: pct }]} />
            <View style={[s.knob, { left: pct }]} />
          </View>
        </Pressable>
        <View style={s.times}>
          <T w={700} size={12} color="#B8C1D6" style={s.tab}>{mmss(elapsed)}</T>
          <T w={700} size={12} color="#B8C1D6" style={s.tab}>{mmss(total)}</T>
        </View>
      </View>
      <View style={s.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Tezlik: ${speedLabel(speed)} (0.75× / 1× / 1.25×)`} onPress={onSpeed} style={s.side}>
          <T w={800} size={15} color="#FFFFFF">{speedLabel(speed)}</T>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={unit === 'gap' ? 'Oldingi gap' : 'Oldingi replika'} onPress={onPrev} style={s.round}>
          <PrevIcon />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pauza' : 'Tinglash'}
          disabled={disabled}
          onPress={onToggle}
          style={({ pressed }) => [s.main, (pressed || disabled) && { opacity: disabled ? 0.5 : 0.9 }]}
        >
          {playing ? <PauseTall /> : <PlayRounded size={26} />}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={unit === 'gap' ? 'Keyingi gap' : 'Keyingi replika'} onPress={onNext} style={s.round}>
          <NextIcon />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${Unit} takrorlash`}
          accessibilityState={{ selected: repeat }}
          onPress={onRepeat}
          style={[s.side, repeat && { backgroundColor: '#2F5BFF' }]}
        >
          <RepeatOneIcon />
        </Pressable>
      </View>
    </View>
  );
}

/* ---------- Dialog matni (M — mehmon · O — ofitsiant) ---------- */

// Darsdagi audio dialog bilan bitta tur va bitta tahlilchi — ikki joyda farq qilmasin.
export type DLine = DialogLine;
export { parseDialog };
const SPEAKER_COLORS = ['#B34700', '#0B1220', '#1E3FD1', '#087A4A'];

export function DialogText({ lines, current, onLine, empty }: { lines: DLine[]; current: number; onLine?: (i: number) => void; empty: string }) {
  const [uz, setUz] = useState(true);
  const speakers = Array.from(new Set(lines.map((l) => l.speaker)));
  // Bir harfli ismlar (A/B) uchun izoh ma'nosiz — faqat to'liq ismlar.
  const legend = speakers.filter((x) => x.length > 1).map((x) => `${x.charAt(0).toUpperCase()} — ${x.toLowerCase()}`).join(' · ');
  return (
    <View accessibilityLabel="Matn va tarjima" style={s.text}>
      <View style={s.textHead}>
        <View style={{ gap: 1, minWidth: 0, flexShrink: 1 }}>
          <T w={800} size={11} color="#4A5468" style={s.upper}>Matn</T>
          {!!legend && <T w={700} size={12} color="#4A5468">{legend}</T>}
        </View>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: uz }} accessibilityLabel="UZ tarjima" onPress={() => setUz((v) => !v)} style={s.switchBtn}>
          <T w={800} size={13}>UZ tarjima</T>
          <View style={[s.switchTrack, !uz && { backgroundColor: '#C9D0DE' }]}>
            <View style={[s.switchKnob, uz ? { right: 3 } : { left: 3 }]} />
          </View>
        </Pressable>
      </View>
      {lines.length === 0 ? (
        <View style={s.line}>
          <T w={600} size={13} color="#4A5468" lh={1.3}>{empty}</T>
        </View>
      ) : (
        lines.map((l, k) => {
          const cur = k === current;
          const color = SPEAKER_COLORS[speakers.indexOf(l.speaker) % SPEAKER_COLORS.length];
          return (
            <Pressable key={k} disabled={!onLine} onPress={() => onLine?.(k)} style={[s.line, cur && s.lineCur]}>
              <View accessibilityRole="image" accessibilityLabel={l.speaker} style={[s.avatar, { backgroundColor: color }]}>
                <T w={800} size={12} color="#FFFFFF">{l.speaker.charAt(0).toUpperCase()}</T>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <T w={cur ? 800 : 700} size={15} lh={1.3}><RichText inline style={{ fontFamily: fonts.bodyBold }} text={l.ru} /></T>
                {uz && !!l.uz && <T w={600} size={13} color="#4A5468" lh={1.3}><RichText inline style={{ fontFamily: fonts.body }} text={l.uz} /></T>}
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const s = StyleSheet.create({
  player: { backgroundColor: '#0B1220', borderRadius: 22, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  bar: { position: 'relative', height: 6, borderRadius: 3, backgroundColor: '#2B3550' },
  fill: { height: 6, borderRadius: 3, backgroundColor: '#6D8BFF' },
  knob: { position: 'absolute', top: -5, width: 16, height: 16, marginLeft: -8, borderRadius: 8, backgroundColor: '#FFFFFF' },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  tab: { fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { height: 44, minWidth: 56, paddingHorizontal: 8, borderRadius: 14, backgroundColor: '#1B2438', alignItems: 'center', justifyContent: 'center' },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1B2438', alignItems: 'center', justifyContent: 'center' },
  main: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  text: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 8, gap: 2 },
  textHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 4, paddingRight: 4, paddingLeft: 12 },
  upper: { textTransform: 'uppercase', letterSpacing: 0.66 },
  switchBtn: { height: 44, paddingLeft: 12, paddingRight: 10, borderRadius: 14, backgroundColor: '#F4F6FA', flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  switchTrack: { width: 36, height: 22, borderRadius: 11, backgroundColor: '#2F5BFF', position: 'relative', flexShrink: 0 },
  switchKnob: { position: 'absolute', top: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF' },
  line: { borderRadius: 14, paddingVertical: 7, paddingRight: 10, paddingLeft: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  lineCur: { backgroundColor: '#E8EEFF', boxShadow: 'inset 4px 0 0 #2F5BFF' } as object,
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
});
