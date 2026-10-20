/**
 * "homework" guruhining kompyuter (D_*) ekranlari uchun umumiy bloklar:
 * ikonkalar, variant tugmasi (1/2/3 klavishli), pastki natija paneli
 * (D_Exercise/D_Test/D_MistakeReview), oq pastki panel, katta tugmalar.
 * Hammasi dizayndagi inline qiymatlar bilan.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { Txt, webShadow } from '@/components/v2/homework/ui';
import { CoinGhost, FloatUp, Pop, Shake, SlideUp } from '@/components/v2/motion';
import { playSfx, playSfxLater } from '@/services/sfx';
import { praiseAnswer } from '@/services/voicePraise';

export { Txt, webShadow };

type IP = { size?: number; color?: string; sw?: number };

const Stroke = ({ size = 18, color = '#0B1220', sw = 2.4, children }: IP & { children: ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

export const ICheck = (p: IP) => (
  <Stroke {...p}>
    <Path d="M5 12l5 5 9-10" />
  </Stroke>
);
export const IClose = (p: IP) => (
  <Stroke {...p}>
    <Path d="M6 6l12 12M18 6 6 18" />
  </Stroke>
);
export const IArrow = (p: IP) => (
  <Stroke {...p}>
    <Path d="M5 12h14M13 6l6 6-6 6" />
  </Stroke>
);
export const IChevron = (p: IP) => (
  <Stroke {...p}>
    <Path d="M9 6l6 6-6 6" />
  </Stroke>
);
export const IBack = (p: IP) => (
  <Stroke {...p}>
    <Path d="M15 6l-6 6 6 6" />
  </Stroke>
);
export const ILock = ({ size = 17, color = '#4A5468', sw = 2.2 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Rect x={5} y={11} width={14} height={10} rx={2.5} />
    <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Stroke>
);
export const IBulb = ({ size = 18, color = '#7A5300', sw = 2.2 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" />
  </Stroke>
);
export const IClock = ({ size = 17, color = '#4A5468', sw = 2.2 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 7v5l3 2" />
  </Stroke>
);
export const IKeyboard = ({ size = 18, color = '#1E3FD1', sw = 2 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Rect x={2} y={6} width={20} height={13} rx={2.5} />
    <Path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14.5h6" />
  </Stroke>
);
export const ISpeaker = ({ size = 18, color = '#FFFFFF', sw = 2.2 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Path d="M4 9v6h4l5 4V5L8 9z" />
    <Path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  </Stroke>
);
export const IRepeat = ({ size = 20, color = '#B34700', sw = 2.2 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Path d="M17 2l3 3-3 3" />
    <Path d="M4 11V9a4 4 0 0 1 4-4h12" />
    <Path d="M7 22l-3-3 3-3" />
    <Path d="M20 13v2a4 4 0 0 1-4 4H4" />
  </Stroke>
);
export const IVideo = ({ size = 19, color = '#087A4A', sw = 2.2 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Rect x={2} y={6} width={14} height={12} rx={3} />
    <Path d="M16 10l6-3v10l-6-3" />
  </Stroke>
);
export const IArrowUp = ({ size = 15, color = '#087A4A', sw = 2.6 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Path d="M12 19V5M5 12l7-7 7 7" />
  </Stroke>
);
export const ICoin = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={10} fill="#F5B70A" />
    <Circle cx={12} cy={12} r={6.5} fill="none" stroke="#B98500" strokeWidth={1.8} />
  </Svg>
);
export const IFlame = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 2c.8 3.6 5.5 5.6 5.5 11.2A5.5 5.5 0 0 1 6.5 13.2c0-2.6 1.6-4.4 2.6-6 .7 1.8 1.6 2.7 2.6 2.7C11.7 7.4 11 4.6 12 2z" fill="#FF7A1A" />
  </Svg>
);
export const IBolt = ({ size = 38 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#7C4DFF" />
  </Svg>
);

/** Dizayndagi 0.08em harf oralig'i (12px → 0.96). */
export const caps = (size: number, em = 0.08) => ({ letterSpacing: size * em, textTransform: 'uppercase' as const });

/** Oddiy <kbd> (oq, pastki chegara 2px). */
export function KbdKey({ children }: { children: string }) {
  return (
    <View style={s.kbd}>
      <Txt f="bodyHeavy" size={12} color="#34405A">
        {children}
      </Txt>
    </View>
  );
}

/** "1 2 3 tanlash" kabi klavish izohi. */
export function KeysHint({ keys, label, gap = 5 }: { keys: string[]; label: string; gap?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap, flexShrink: 0 }}>
      {keys.map((k) => (
        <KbdKey key={k}>{k}</KbdKey>
      ))}
      <Txt f="bodyBold" size={13} color="#4A5468" style={{ marginLeft: 2 }}>
        {label}
      </Txt>
    </View>
  );
}

/** Rangli tugma ichidagi kichik <kbd> (Enter, →). */
export function BtnKbd({ children, bg, fg }: { children: string; bg: string; fg: string }) {
  return (
    <View style={{ height: 24, paddingHorizontal: 7, borderRadius: 7, backgroundColor: bg, justifyContent: 'center' }}>
      <Txt f="bodyHeavy" size={12} color={fg}>
        {children}
      </Txt>
    </View>
  );
}

type BtnKind = 'primary' | 'green' | 'red' | 'disabled' | 'outline' | 'soft';
const BTN: Record<BtnKind, { bg: string; fg: string; shadow?: string; kbdBg: string; kbdFg: string; border?: string }> = {
  primary: { bg: '#2F5BFF', fg: '#FFFFFF', shadow: '#1E3FD1', kbdBg: '#1E3FD1', kbdFg: '#DCE5FF' },
  green: { bg: '#087A4A', fg: '#FFFFFF', shadow: '#075E3A', kbdBg: '#075E3A', kbdFg: '#CFF2E0' },
  red: { bg: '#B42318', fg: '#FFFFFF', shadow: '#8A1A12', kbdBg: '#8A1A12', kbdFg: '#FFD9D5' },
  disabled: { bg: '#E2E6EE', fg: '#4A5468', kbdBg: '#D3D9E4', kbdFg: '#4A5468' },
  outline: { bg: '#FFFFFF', fg: '#0B1220', kbdBg: '#FFFFFF', kbdFg: '#34405A', border: '#E2E6EE' },
  soft: { bg: '#E3F7EE', fg: '#075E3A', kbdBg: '#BFE8D3', kbdFg: '#075E3A' },
};

/** Katta tugma (58px): "Davom etish →  Enter", qulflangan "🔒 Topshirish · …". */
export function BigButton({
  label,
  kind = 'primary',
  onPress,
  arrow,
  lock,
  kbd,
  height = 58,
  pad = [26, 22],
  style,
  a11y,
  children,
  size = 16,
}: {
  /** Yozuv o'lchami (dizaynda 15–17). */
  size?: number;
  label?: string;
  kind?: BtnKind;
  onPress?: () => void;
  arrow?: boolean;
  lock?: boolean;
  kbd?: string;
  height?: number;
  /** [chap, o'ng] ichki bo'shliq. */
  pad?: [number, number];
  style?: StyleProp<ViewStyle>;
  a11y?: string;
  children?: ReactNode;
}) {
  const c = BTN[kind];
  const off = kind === 'disabled';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: off }}
      disabled={off || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        s.big,
        { height, paddingLeft: pad[0], paddingRight: pad[1], backgroundColor: c.bg },
        c.border ? { borderWidth: 2, borderColor: c.border } : null,
        c.shadow ? webShadow(`0 5px 0 ${c.shadow}`) : null,
        off && Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as object) : null,
        pressed && { opacity: 0.88 },
        style,
      ]}
    >
      {lock && <ILock color={c.fg} />}
      {!!label && (
        <Txt f="bodyHeavy" size={size} color={c.fg} numberOfLines={1}>
          {label}
        </Txt>
      )}
      {children}
      {arrow && <IArrow size={18} color={c.fg} sw={2.6} />}
      {!!kbd && (
        <BtnKbd bg={c.kbdBg} fg={c.kbdFg}>
          {kbd}
        </BtnKbd>
      )}
    </Pressable>
  );
}

export type OptState = 'idle' | 'correct' | 'wrong';

/**
 * Variant tugmasi: chapda 30px klavish raqami, o'ngda belgi.
 * `test` — D_Test/D_MistakeReview (min 92, 22px, doira ichida belgi);
 * aks holda D_Exercise (92, 24px, oddiy belgi).
 */
export function DOption({
  n,
  label,
  state,
  onPress,
  disabled,
  test,
}: {
  n: number;
  label: string;
  state: OptState;
  onPress: () => void;
  disabled?: boolean;
  test?: boolean;
}) {
  const c =
    state === 'correct'
      ? { bg: '#E3F7EE', border: '#087A4A', fg: '#075E3A', kbd: '#087A4A' }
      : state === 'wrong'
        ? { bg: '#FDECEC', border: '#D92D20', fg: '#B42318', kbd: '#B42318' }
        : { bg: '#FFFFFF', border: '#E2E6EE', fg: test ? '#0B1220' : '#4A5468', kbd: '' };
  return (
    <Shake trigger={state === 'wrong'} onlyWhenTruthy style={{ flex: 1, minWidth: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: state !== 'idle', disabled }}
        accessibilityHint={`${n}`}
        disabled={disabled}
        onPress={onPress}
        style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [
          s.opt,
          test ? { minHeight: 92, paddingVertical: 12 } : { height: 92 },
          { backgroundColor: c.bg, borderColor: state === 'idle' && hovered && !disabled ? '#C9D3F5' : c.border },
          webShadow(`0 4px 0 ${c.border}`),
        ]}
      >
        <View style={[s.optKbd, c.kbd ? { backgroundColor: c.kbd, borderWidth: 0 } : null]}>
          <Txt f="bodyHeavy" size={14} color={c.kbd ? '#FFFFFF' : '#4A5468'}>
            {String(n)}
          </Txt>
        </View>
        <Txt f="bodyHeavy" size={test ? 22 : 24} lh={test ? 28.6 : undefined} color={c.fg} lang="ru" style={{ flex: 1 }}>
          {label}
        </Txt>
        {state !== 'idle' &&
          (test ? (
            <Pop from={0.2}>
              <View style={[s.optMark, { backgroundColor: state === 'correct' ? '#087A4A' : '#B42318' }]}>
                {state === 'correct' ? <ICheck size={16} color="#FFFFFF" sw={3.2} /> : <IClose size={15} color="#FFFFFF" sw={3} />}
              </View>
            </Pop>
          ) : state === 'correct' ? (
            <Pop from={0.2}>
              <ICheck size={22} color="#087A4A" sw={3} />
            </Pop>
          ) : (
            <IClose size={20} color="#B42318" sw={3} />
          ))}
      </Pressable>
    </Shake>
  );
}

/**
 * Javobdan keyingi pastki panel (132px): yashil "To'g'ri!" yoki qizil
 * "Noto'g'ri". Mobil FeedbackSheet'dagi ovozlar (sfx + maqtov) aynan shu yerda.
 * Enter — tugma.
 */
export function FeedbackBar({
  correct,
  title,
  detail,
  coin,
  buttonLabel,
  onPress,
  width,
  gap = 16,
  arrow,
  btnPadLeft,
  btnSize,
}: {
  correct: boolean;
  title?: string;
  detail: ReactNode;
  coin: boolean;
  buttonLabel: string;
  onPress: () => void;
  width: number;
  gap?: number;
  /** Tugmada → (to'g'ri javobda doim bor). */
  arrow?: boolean;
  /** Tugmaning chap ichki bo'shlig'i (D_Exercise — 30, boshqalar — 26). */
  btnPadLeft?: number;
  /** Tugma yozuvi (D_Exercise — 17, boshqalar — 16). */
  btnSize?: number;
}) {
  useEffect(() => {
    playSfx(correct ? 'correct' : 'wrong');
    if (correct && coin) playSfxLater('coin', 220);
    praiseAnswer(correct);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Panelni ochgan Enter (masalan yozma javobni tekshirish) shu zahoti
  // "Davom etish"ni ham bosib yubormasin — tinglovchi keyingi tick'da yoqiladi.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 0);
    return () => clearTimeout(t);
  }, []);
  useDesktopKeys({ Enter: onPress }, armed);
  const c = correct
    ? { bg: '#E3F7EE', line: '#BFE8D3', icon: '#087A4A', fg: '#075E3A' }
    : { bg: '#FDECEC', line: '#F6C9C5', icon: '#B42318', fg: '#B42318' };
  return (
    <SlideUp distance={60} style={[s.fb, { backgroundColor: c.bg, borderTopColor: c.line }]}>
      <View accessibilityRole="alert" style={{ width, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap }}>
        {correct ? (
          <Pop delay={90}>
            <View style={[s.fbIcon, { backgroundColor: c.icon }]}>
              <ICheck size={30} color="#FFFFFF" sw={3.2} />
            </View>
          </Pop>
        ) : (
          <Shake>
            <View style={[s.fbIcon, { backgroundColor: c.icon }]}>
              <IClose size={28} color="#FFFFFF" sw={3.2} />
            </View>
          </Shake>
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Txt f="display" size={28} color={c.fg} style={{ letterSpacing: -0.56 }}>
            {title ?? (correct ? 'Toʻgʻri!' : 'Notoʻgʻri')}
          </Txt>
          {typeof detail === 'string' ? (
            <Txt f="bodyBold" size={16} color={c.fg} lh={22.4}>
              {detail}
            </Txt>
          ) : (
            detail
          )}
        </View>
        {coin && (
          <FloatUp delay={180}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 10 }}>
              <ICoin size={20} />
              <Txt f="bodyHeavy" size={18} color="#7A5300">
                +1
              </Txt>
              <CoinGhost play>
                <ICoin size={20} />
              </CoinGhost>
            </View>
          </FloatUp>
        )}
        <BigButton
          label={buttonLabel}
          kind={correct ? 'green' : 'red'}
          arrow={arrow ?? correct}
          kbd="Enter"
          onPress={onPress}
          pad={[btnPadLeft ?? 26, 22]}
          size={btnSize}
          style={correct ? null : webShadow('0 5px 0 #8A1A12')}
        />
      </View>
    </SlideUp>
  );
}

/** Oq pastki panel (100/112px, ustida chiziq) — ichki kenglik dizayndagidek. */
export function WhiteFooter({ height = 112, width, children }: { height?: number; width: number; children: ReactNode }) {
  return (
    <View style={[s.footer, { height }]}>
      <View style={{ width, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 0 }}>{children}</View>
    </View>
  );
}

/**
 * Fokus ekranning tanasi: o'rtada markazlashgan blok (aylantiriladi, oyna
 * past bo'lsa) va pastda doimiy panel.
 */
export function FocusBody({ children, bottom, pad = 24 }: { children: ReactNode; bottom?: ReactNode; pad?: number }) {
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: pad, paddingHorizontal: 24 }}>
        {children}
      </ScrollView>
      {bottom}
    </View>
  );
}

/** Sarlavhadagi bitta progress chizig'i (D_Match, D_Build). */
export function HeaderBar({ left, right, pct, color, width = 440, label }: { left: string; right: string; pct: number; color: string; width?: number; label?: string }) {
  return (
    <View style={{ width, maxWidth: '100%', gap: 7 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Txt f="bodyHeavy" size={13} color="#34405A">
          {left}
        </Txt>
        <Txt f="bodyHeavy" size={13} color="#4A5468" numberOfLines={1} style={{ flexShrink: 1 }}>
          {right}
        </Txt>
      </View>
      <View accessibilityRole="progressbar" accessibilityLabel={label ?? left} style={{ height: 10, borderRadius: 5, backgroundColor: '#E2E6EE', overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: 10, borderRadius: 5, backgroundColor: color }} />
      </View>
    </View>
  );
}

/** Sarlavha o'ngidagi chip: "+4 coin" (sariq) yoki "2 / 6 juftlik" (yashil). */
export function HeaderChip({ children, green }: { children: string; green?: boolean }) {
  return (
    <View style={[s.chip, { backgroundColor: green ? '#E3F7EE' : '#FFF4D1' }]}>
      {!green && <ICoin size={18} />}
      <Txt f="bodyHeavy" size={15} color={green ? '#075E3A' : '#7A5300'}>
        {children}
      </Txt>
    </View>
  );
}

/** Savollar holati → sarlavhadagi bo'laklar rangi. */
export const segColor = (r: boolean | undefined, current: boolean) => (r === true ? '#087A4A' : r === false ? '#D92D20' : current ? '#2F5BFF' : '#E2E6EE');

export function Loading({ error }: { error?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {error ? (
        <Txt f="bodyBold" size={15} color="#4A5468">
          Vazifani yuklab boʻlmadi
        </Txt>
      ) : (
        <ActivityIndicator color="#2F5BFF" accessibilityLabel="Yuklanmoqda" />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  kbd: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderBottomWidth: 2,
    borderColor: '#D5DBE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  big: { borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, flexShrink: 0 },
  opt: { borderRadius: 20, borderWidth: 2, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  optKbd: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#D5DBE7', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  optMark: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fb: { height: 132, borderTopWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  fbIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  footer: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E4E8F0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  chip: { height: 40, paddingHorizontal: 14, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
