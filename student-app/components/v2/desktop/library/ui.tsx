/**
 * "library" guruhi kompyuter ekranlari uchun umumiy bo'laklar: matn,
 * ikonkalar (D_*.dc.html dagi SVG yo'llari aynan), oy/qiyinlik tablari,
 * qorong'i pleer (S ← Space → R yorliqlari bilan) va dialog matni bloki.
 */
import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { RichText } from '@/components/RichText';
import { NextIcon, PrevIcon, RepeatOneIcon } from '@/components/v2/library/shared';
import { fonts } from '@/constants/v2/tokens';

import { Kbd } from '../Shell';

type F = keyof typeof fonts;
const W = { 500: 'bodyMedium', 600: 'body', 700: 'bodyBold', 800: 'bodyHeavy' } as const;

/** Qisqa matn: dizayndagi og'irlik (w) → Manrope fayli. */
export function T({
  w = 800,
  f,
  size = 14,
  color = '#0B1220',
  lh,
  ls,
  style,
  children,
  lines,
  accessibilityRole,
  accessibilityLabel,
}: {
  w?: 500 | 600 | 700 | 800;
  f?: F;
  size?: number;
  color?: string;
  lh?: number;
  ls?: number;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
  lines?: number;
  accessibilityRole?: TextProps['accessibilityRole'];
  accessibilityLabel?: string;
}) {
  return (
    <Text
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      numberOfLines={lines}
      style={[{ fontFamily: fonts[f ?? W[w]], fontWeight: 'normal', fontSize: size, color, lineHeight: lh, letterSpacing: ls }, style]}
    >
      {children}
    </Text>
  );
}

/** Ustki harfli kichik sarlavha (11px, 0.08em, uppercase). */
export function Over({ children, color = '#34405A', em = 0.08, size = 11, style }: { children: ReactNode; color?: string; em?: number; size?: number; style?: StyleProp<TextStyle> }) {
  return (
    <T size={size} color={color} ls={size * em} style={[{ textTransform: 'uppercase' }, style]}>
      {children}
    </T>
  );
}

/** Pleer ichidagi qorong'i <kbd>. */
export function DarkKbd({ children }: { children: string }) {
  return (
    <View style={s.darkKbd}>
      <T size={12} color="#DCE2EE">
        {children}
      </T>
    </View>
  );
}

/** Ko'k tugma ichidagi <kbd> ("Enter"). */
export function InKbd({ children }: { children: string }) {
  return (
    <View style={s.inKbd}>
      <T size={12} color="#DCE5FF">
        {children}
      </T>
    </View>
  );
}

/* ─── Tablar (D_AudioList / D_DialogList / D_StoryList: 42px, radius 13) ─── */

export function DTabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { key: K; label: string; disabled?: boolean; hint?: string }[];
  value: K;
  onChange: (k: K) => void;
  label: string;
}) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: 'row', gap: 8 }}>
      {tabs.map((t) => {
        const on = t.key === value;
        if (t.disabled && !on) {
          return (
            <View key={t.key} accessibilityRole="tab" accessibilityState={{ selected: false, disabled: true }} accessibilityHint={t.hint} style={[s.tab, s.tabOff]}>
              <T size={14} color="#5B6478">
                {t.label}
              </T>
            </View>
          );
        }
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.key)}
            style={[s.tab, on ? { backgroundColor: '#0B1220', borderColor: '#0B1220' } : { backgroundColor: '#FFFFFF', borderColor: '#E2E6EE' }]}
          >
            <T size={14} color={on ? '#FFFFFF' : '#34405A'}>
              {t.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Qorong'i pleer (D_AudioTrack, D_AudioDialogLib, D_Book) ─── */

export function DPlayer({
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
  fmt,
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
  unit: 'replika' | 'gap';
  onSeek?: (f: number) => void;
  disabled?: boolean;
  fmt: (sec: number) => string;
}) {
  const pct = `${Math.max(0, Math.min(1, frac)) * 100}%` as const;
  const barW = useRef(0);
  const U = unit === 'gap' ? 'gap' : 'replika';
  return (
    <View accessibilityLabel="Pleer" style={s.player}>
      <View style={{ gap: 7 }}>
        <Pressable
          accessibilityRole="progressbar"
          accessibilityLabel="Tinglash jarayoni"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(frac * 100) }}
          onLayout={(e: LayoutChangeEvent) => (barW.current = e.nativeEvent.layout.width)}
          onPress={(e) => onSeek && barW.current > 0 && onSeek(Math.max(0, Math.min(1, e.nativeEvent.locationX / barW.current)))}
          style={{ paddingVertical: 5, marginVertical: -5 }}
        >
          <View style={s.bar}>
            <View style={[s.barFill, { width: pct }]} />
            <View style={[s.knob, { left: pct }]} />
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T w={700} size={13} color="#B8C1D6" style={{ fontVariant: ['tabular-nums'] }}>
            {fmt(elapsed)}
          </T>
          <T w={700} size={13} color="#B8C1D6" style={{ fontVariant: ['tabular-nums'] }}>
            {fmt(total)}
          </T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Ctl k="S">
          <Pressable accessibilityRole="button" accessibilityLabel={`Tezlik: ${speed}× (0.75× / 1× / 1.25×), S`} onPress={onSpeed} style={s.round}>
            <T size={15} color="#FFFFFF">
              {speed}×
            </T>
          </Pressable>
        </Ctl>
        <Ctl k="←">
          <Pressable accessibilityRole="button" accessibilityLabel={`Oldingi ${U} (←)`} onPress={onPrev} style={s.round}>
            <PrevIcon />
          </Pressable>
        </Ctl>
        <Ctl k="Space">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pauza (Space)' : 'Tinglash (Space)'}
            disabled={disabled}
            onPress={onToggle}
            style={({ pressed }) => [s.play, (pressed || disabled) && { opacity: disabled ? 0.5 : 0.9 }]}
          >
            {playing ? <IPauseTall size={28} /> : <IPlay size={28} color="#FFFFFF" />}
          </Pressable>
        </Ctl>
        <Ctl k="→">
          <Pressable accessibilityRole="button" accessibilityLabel={`Keyingi ${U} (→)`} onPress={onNext} style={s.round}>
            <NextIcon />
          </Pressable>
        </Ctl>
        <Ctl k="R">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${unit === 'gap' ? 'Gapni' : 'Replikani'} takrorlash (R)`}
            accessibilityState={{ selected: repeat }}
            onPress={onRepeat}
            style={[s.round, repeat && { backgroundColor: '#2F5BFF' }]}
          >
            <RepeatOneIcon />
          </Pressable>
        </Ctl>
      </View>
    </View>
  );
}

function Ctl({ k, children }: { k: string; children: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      {children}
      <DarkKbd>{k}</DarkKbd>
    </View>
  );
}

/* ─── Matn va tarjima (D_AudioTrack / D_AudioDialogLib) ─── */

export type DLine = { speaker: string; ru: string; uz?: string };
const SPEAKER_COLORS = ['#B34700', '#0B1220', '#1E3FD1', '#087A4A'];

export function DDialogText({
  lines,
  current,
  onLine,
  empty,
  showUz,
  onToggleUz,
  style,
}: {
  lines: DLine[];
  current: number;
  onLine?: (i: number) => void;
  empty: string;
  showUz: boolean;
  onToggleUz: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const speakers = Array.from(new Set(lines.map((l) => l.speaker)));
  // Bir harfli ismlar (A/B) uchun izoh ma'nosiz — faqat to'liq ismlar (mobil bilan bir xil).
  const legend = speakers
    .filter((x) => x.length > 1)
    .map((x) => `${x.charAt(0).toUpperCase()} — ${x.toLowerCase()}`)
    .join(' · ');
  return (
    <View accessibilityLabel="Matn va tarjima" style={[s.text, style]}>
      <View style={s.textHead}>
        <View style={{ gap: 1, minWidth: 0, flexShrink: 1 }}>
          <T size={11} color="#4A5468" ls={0.66} style={{ textTransform: 'uppercase' }}>
            Matn
          </T>
          {!!legend && (
            <T w={700} size={13} color="#4A5468">
              {legend}
            </T>
          )}
        </View>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: showUz }} accessibilityLabel="UZ tarjima (T)" onPress={onToggleUz} style={s.switchBtn}>
          <T size={14}>UZ tarjima</T>
          <View style={[s.switchTrack, { backgroundColor: showUz ? '#2F5BFF' : '#C9D0DE' }]}>
            <View style={[s.switchKnob, showUz ? { right: 3 } : { left: 3 }]} />
          </View>
          <Kbd>T</Kbd>
        </Pressable>
      </View>
      {lines.length === 0 ? (
        <View style={s.line}>
          <T w={600} size={14} color="#4A5468">
            {empty}
          </T>
        </View>
      ) : (
        lines.map((l, k) => {
          const cur = k === current;
          const future = current >= 0 && k > current;
          const color = SPEAKER_COLORS[speakers.indexOf(l.speaker) % SPEAKER_COLORS.length];
          return (
            <Pressable key={k} disabled={!onLine} onPress={() => onLine?.(k)} style={[s.line, cur && s.lineCur]}>
              <View accessibilityRole="image" accessibilityLabel={l.speaker} style={[s.avatar, { backgroundColor: color }]}>
                <T size={13} color="#FFFFFF">
                  {l.speaker.charAt(0).toUpperCase()}
                </T>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <RichText text={l.ru} style={[s.ru, cur && { fontFamily: fonts.bodyHeavy }, future && { color: '#4A5468' }]} />
                {showUz && !!l.uz && <RichText text={l.uz} style={s.uz} />}
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

/** Fokus sarlavhasidagi bo'lakli progress: joriy bo'lak ichida ulush (linear-gradient 44%). */
export function SegProgress({ left, right, segments, current, frac, label }: { left: string; right: string; segments: number; current: number; frac: number; label: string }) {
  return (
    <View style={{ width: 420, gap: 7 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T size={13} color="#34405A">
          {left}
        </T>
        <T w={700} size={13} color="#4A5468">
          {right}
        </T>
      </View>
      <View accessibilityLabel={label} style={{ flexDirection: 'row', gap: 5 }}>
        {Array.from({ length: Math.max(1, segments) }, (_, k) => (
          <View key={k} style={[s.seg, { backgroundColor: k === current ? '#D4DEFF' : k < current ? '#2F5BFF' : '#E2E6EE' }]}>
            {k === current && <View style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%`, height: 8, backgroundColor: '#2F5BFF' }} />}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ─── Ikonkalar ─── */

type P = { size?: number; color?: string; sw?: number };
const hidden = { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };
const st = (color: string, w: number) => ({ fill: 'none', stroke: color, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const ICheck = ({ size = 14, color = '#FFFFFF', sw = 3 }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" {...st(color, sw)}>
    <Path d="M5 12l5 5 9-10" />
  </Svg>
);
export const IChevron = ({ size = 16, color = '#1E3FD1', sw = 2.6 }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" {...st(color, sw)}>
    <Path d="M9 6l6 6-6 6" />
  </Svg>
);
export const IChevronLeft = ({ size = 18, color = '#0B1220', sw = 2.2 }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" {...st(color, sw)}>
    <Path d="M15 6l-6 6 6 6" />
  </Svg>
);
export const IArrow = ({ size = 16, color = '#1E3FD1', sw = 2.6 }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" {...st(color, sw)}>
    <Path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const IClose = ({ size = 16, color = '#0B1220', sw = 2.4 }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" {...st(color, sw)}>
    <Path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IPlay = ({ size = 16, color = '#FFFFFF' }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24">
    <Path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z" fill={color} />
  </Svg>
);
export const IPauseTall = ({ size = 28, color = '#FFFFFF' }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24">
    <Rect x={6} y={4} width={4.2} height={16} rx={1.5} fill={color} />
    <Rect x={13.8} y={4} width={4.2} height={16} rx={1.5} fill={color} />
  </Svg>
);
export const ICamera = ({ size = 20, color = '#0B1220' }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" {...st(color, 2.2)}>
    <Path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <Circle cx={12} cy={13} r={3.5} />
  </Svg>
);
export const IQr = ({ size = 16, color = '#4A5468' }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm10-2h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2zm2-4h2v2h-2zm0 4h2v2h-2z" />
  </Svg>
);
export const ISpeaker = ({ size = 20, color = '#FFFFFF' }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" {...st(color, 2.2)}>
    <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <Path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
  </Svg>
);
export const ISwap = ({ size = 22, color = '#FFFFFF' }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" {...st(color, 2.4)}>
    <Path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4" />
  </Svg>
);
export const ISearch = ({ size = 20, color = '#2F5BFF', sw = 2.4 }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" {...st(color, sw)}>
    <Circle cx={11} cy={11} r={7} />
    <Path d="M20 20l-3.5-3.5" />
  </Svg>
);
export const IClock = ({ size = 20, color = '#5B6478' }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" {...st(color, 2.2)}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 7v5l3 2" />
  </Svg>
);
export const IHeadphones = ({ size = 20, color = '#7C4DFF' }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" {...st(color, 2.2)}>
    <Path d="M4 15v-3a8 8 0 0 1 16 0v3" />
    <Rect x={3} y={14} width={5} height={7} rx={2} />
    <Rect x={16} y={14} width={5} height={7} rx={2} />
  </Svg>
);
export const IPlus = ({ size = 20, color = '#FFFFFF' }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" {...st(color, 2.8)}>
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IRepeat = ({ size = 22, color = '#B42318', sw = 2.4 }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" {...st(color, sw)}>
    <Path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.3L20 15.5M20 20v-4.5h-4.5" />
  </Svg>
);
export const IMouse = ({ size = 18, color = '#4A5468' }: P) => (
  <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" {...st(color, 2.2)}>
    <Rect x={6} y={3} width={12} height={18} rx={6} />
    <Path d="M12 7v4" />
  </Svg>
);

const s = StyleSheet.create({
  darkKbd: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 7,
    backgroundColor: '#1B2438',
    borderWidth: 1,
    borderBottomWidth: 2,
    borderColor: '#34405A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inKbd: { height: 24, minWidth: 24, paddingHorizontal: 7, borderRadius: 7, backgroundColor: '#1E3FD1', alignItems: 'center', justifyContent: 'center' },
  tab: { height: 42, paddingHorizontal: 18, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tabOff: { backgroundColor: '#EEF1F7', borderColor: '#C9D1E0', borderStyle: 'dashed' },
  player: { backgroundColor: '#0B1220', borderRadius: 24, paddingTop: 22, paddingHorizontal: 24, paddingBottom: 20, gap: 16 },
  bar: { position: 'relative', height: 6, borderRadius: 3, backgroundColor: '#2B3550' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#6D8BFF' },
  knob: { position: 'absolute', top: -5, width: 16, height: 16, marginLeft: -8, borderRadius: 8, backgroundColor: '#FFFFFF' },
  round: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1B2438', alignItems: 'center', justifyContent: 'center' },
  play: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  text: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 12, gap: 4 },
  textHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 4, paddingRight: 4, paddingBottom: 6, paddingLeft: 14 },
  switchBtn: { height: 44, paddingLeft: 14, paddingRight: 12, borderRadius: 14, backgroundColor: '#F4F6FA', flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchTrack: { width: 38, height: 22, borderRadius: 11, position: 'relative' },
  switchKnob: { position: 'absolute', top: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF' },
  line: { borderRadius: 16, paddingVertical: 11, paddingHorizontal: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  lineCur: { backgroundColor: '#E8EEFF', boxShadow: 'inset 4px 0 0 #2F5BFF' } as object,
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ru: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 18, lineHeight: 24.3, color: '#0B1220' },
  uz: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 14, lineHeight: 18.9, color: '#4A5468' },
  seg: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
});
