/**
 * "rewards" guruhining kompyuter (D_*) ekranlari uchun umumiy bloklar:
 * matn, ikonkalar (dizayndagi SVG yo'llari aynan), sarlavha matni,
 * popup ramkasi (sahifa ustida xira fon + markazdagi karta).
 */
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { fonts } from '@/constants/v2/tokens';

/**
 * Sahifa kontenti kengligi (oyna − yon menyu 248 − chekkalar 2×40). 1440 da 1112.
 * Tor oynada (1024…) yon ustunlar pastga tushadi — dizayn 1440 uchun chizilgan.
 */
export function useMainWidth() {
  const { width } = useWindowDimensions();
  return width - 248 - 80;
}
/** Shu kenglikdan torroq bo'lsa ixcham (ustma-ust) joylashuv. */
export const NARROW_MAIN = 1000;

export const webShadow = (css: string): ViewStyle => (Platform.OS === 'web' ? ({ boxShadow: css } as object) : {}) as ViewStyle;

type TP = {
  f?: keyof typeof fonts;
  size: number;
  color?: string;
  lh?: number;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
  numberOfLines?: number;
  /** 'clip' — dizayndagi white-space: nowrap + overflow: hidden (uch nuqtasiz). */
  ellipsizeMode?: 'tail' | 'clip';
  accessibilityRole?: 'header' | 'text';
};

/** Dizayndagi matn: Manrope 600/700/800 → body/bodyBold/bodyHeavy, Bricolage 800 → display. */
export function T({ f = 'bodyBold', size, color = '#0B1220', lh, style, children, numberOfLines, ellipsizeMode, accessibilityRole }: TP) {
  // Webda numberOfLines doim "…" qo'yadi — 'clip' uchun oddiy nowrap + overflow: hidden.
  const clip = ellipsizeMode === 'clip' && Platform.OS === 'web';
  return (
    <Text
      numberOfLines={clip ? undefined : numberOfLines}
      ellipsizeMode={ellipsizeMode}
      accessibilityRole={accessibilityRole}
      style={[
        { fontFamily: fonts[f], fontWeight: 'normal', fontSize: size, color },
        lh ? { lineHeight: lh } : null,
        clip ? ({ whiteSpace: 'nowrap', overflow: 'hidden' } as TextStyle) : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Katta harfli kichik sarlavha (12px, 0.08em). */
export const caps = (size = 12): TextStyle => ({
  letterSpacing: size * 0.08,
  textTransform: 'uppercase',
});

type IP = { size?: number; color?: string; sw?: number };

const St = ({ size = 18, color = '#0B1220', sw = 2.4, children }: IP & { children: ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

export const ICheck = (p: IP) => (
  <St {...p}>
    <Path d="M5 12l5 5 9-10" />
  </St>
);
export const IClose = ({ size = 20, color = '#0B1220', sw = 2.4 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Path d="M6 6l12 12M18 6 6 18" />
  </St>
);
export const IChevron = ({ size = 18, color = '#5B6478', sw = 2.4 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Path d="M9 6l6 6-6 6" />
  </St>
);
export const IChevronLeft = ({ size = 18, color = '#5B6478', sw = 2.4 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Path d="M15 6l-6 6 6 6" />
  </St>
);
export const IArrow = ({ size = 17, color = '#5B2FD6', sw = 2.4 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Path d="M5 12h14M13 6l6 6-6 6" />
  </St>
);
export const IArrowUp = ({ size = 16, color = '#087A4A', sw = 2.6 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Path d="M12 19V5M6 11l6-6 6 6" />
  </St>
);
export const IClock = ({ size = 20, color = '#B98500', sw = 2.2 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 7v5l3 2" />
  </St>
);
export const ITrophy = ({ size = 19, color = '#FFC93C', sw = 2.2 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
    <Path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5" />
  </St>
);
export const ILock = ({ size = 14, color = '#4A5468', sw = 2.4 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Rect x={5} y={11} width={14} height={10} rx={2.5} />
    <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </St>
);
export const IBag = ({ size = 19, color = '#0B1220', sw = 2 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" />
    <Path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </St>
);
export const ITruck = ({ size = 22, color = '#2F5BFF', sw = 2 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
    <Circle cx={7} cy={18} r={2} />
    <Circle cx={17} cy={18} r={2} />
  </St>
);
export const IZoom = ({ size = 18, color = '#0B1220', sw = 2.2 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Circle cx={11} cy={11} r={7} />
    <Path d="M20 20l-3.5-3.5M11 8v6M8 11h6" />
  </St>
);
export const IShield = ({ size = 14, color = '#1E3FD1', sw = 2.4 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
  </St>
);
export const IPin = ({ size = 18, color = '#4A5468', sw = 2 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <Circle cx={12} cy={9.5} r={2.5} />
  </St>
);
export const IShare = ({ size = 18, color = '#0B1220', sw = 2.2 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Circle cx={18} cy={5} r={2.5} />
    <Circle cx={6} cy={12} r={2.5} />
    <Circle cx={18} cy={19} r={2.5} />
    <Path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
  </St>
);
export const IMinus = ({ size = 20, color = '#FFFFFF', sw = 2.6 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Path d="M5 12h14" />
  </St>
);
export const IPlus = ({ size = 20, color = '#FFFFFF', sw = 2.6 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Path d="M12 5v14M5 12h14" />
  </St>
);
export const IEye = ({ size = 16, color = '#4A5468', sw = 2 }: IP) => (
  <St size={size} color={color} sw={sw}>
    <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <Circle cx={12} cy={12} r={3} />
  </St>
);

export const ICoin = ({ size = 16 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={10} fill="#F5B70A" />
    <Circle cx={12} cy={12} r={6.5} fill="none" stroke="#B98500" strokeWidth={1.8} />
  </Svg>
);
export const IBolt = ({ size = 16, color = '#7C4DFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M13 2 4 14h7l-1 8 9-12h-7z" fill={color} />
  </Svg>
);
export const IStar = ({ size = 50, color = '#F5A70A' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill={color} />
  </Svg>
);
export const IFlame = ({ size = 22 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 2c.8 3.6 5.5 5.6 5.5 11.2A5.5 5.5 0 0 1 6.5 13.2c0-2.6 1.6-4.4 2.6-6 .7 1.8 1.6 2.7 2.6 2.7C11.7 7.4 11 4.6 12 2z" fill="#FF7A1A" />
  </Svg>
);

/** Sarlavhadagi nom: ustida kichik katta harfli qator (D_Leaderboard, D_Shop). */
export function HeadTitle({ over, title }: { over: string; title: string }) {
  return (
    <View style={{ minWidth: 0, flexShrink: 1 }}>
      <T f="bodyHeavy" size={12} color="#4A5468" style={caps()}>
        {over}
      </T>
      <T f="display" size={28} lh={31} numberOfLines={1} accessibilityRole="header" style={{ letterSpacing: -0.56 }}>
        {title}
      </T>
    </View>
  );
}

/** Sarlavhadagi oq "Buyurtmalarim" tugmasi. */
export function HeaderButton({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.headBtn, hovered && { backgroundColor: '#FAFBFD' }]}>
      {icon}
      <T f="bodyHeavy" size={14}>
        {label}
      </T>
    </Pressable>
  );
}

/** Katta tugma (dizayndagi 52–56px, radius 17, ostida 5px soya). */
export function DButton({
  label,
  onPress,
  kind = 'primary',
  height = 52,
  icon,
  style,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  kind?: 'primary' | 'green' | 'white' | 'ghost';
  height?: number;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const bg = kind === 'primary' ? '#2F5BFF' : kind === 'green' ? '#087A4A' : kind === 'white' ? '#FFFFFF' : 'transparent';
  const fg = kind === 'primary' || kind === 'green' ? '#FFFFFF' : kind === 'white' ? '#0B1220' : '#4A5468';
  const sh = kind === 'primary' ? '0 5px 0 #1E3FD1' : kind === 'green' ? '0 5px 0 #075E3A' : kind === 'white' ? 'inset 0 0 0 1.5px #E2E6EE' : '';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        s.btn,
        { height, backgroundColor: bg },
        sh ? webShadow(sh) : null,
        hovered && kind === 'primary' && { backgroundColor: '#2A52EE' },
        hovered && kind === 'white' && { backgroundColor: '#FAFBFD' },
        hovered && kind === 'ghost' && { opacity: 0.75 },
        pressed && kind === 'primary' && { backgroundColor: '#1E3FD1' },
        style,
      ]}
    >
      {icon}
      <T f="bodyHeavy" size={15} color={fg} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

/** Kulrang "N coin yetishmayapti" — o'chiq tugma. */
export function LockedButton({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityRole="button" aria-disabled accessibilityState={{ disabled: true }} style={[s.locked, style]}>
      <ILock size={19} color="#4A5468" sw={2.2} />
      <T f="bodyHeavy" size={16} color="#4A5468">
        {label}
      </T>
    </View>
  );
}

/** Yopish (Esc) tugmasi — popup kartalarida 44×44. */
export function CloseBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Yopish (Esc)"
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.close, hovered && { backgroundColor: '#E4E8F0' }]}
    >
      <IClose />
    </Pressable>
  );
}

/**
 * Popup: haqiqiy sahifa ustida qoraytirilgan + xiralashtirilgan fon,
 * markazda oq karta (radius 28, padding 28, oraliq 18). Esc / fon — yopadi.
 */
export function DPopup({
  visible,
  onClose,
  width,
  label,
  children,
  overlay,
}: {
  visible: boolean;
  onClose: () => void;
  width: number;
  label?: string;
  children: ReactNode;
  overlay?: ReactNode;
}) {
  useDesktopKeys({ Escape: onClose }, visible);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.backdrop}>
        <Pressable accessibilityLabel="Yopish" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal role="dialog" aria-modal aria-label={label} style={[s.card, { width }]}>
          {children}
        </View>
      </View>
      {overlay}
    </Modal>
  );
}

/** Popup ichidagi kulrang ma'lumot qatorlari (Narxi / Balans / Holati). */
export function InfoBox({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <View style={s.info}>
      {rows.map(([label, value], i) => (
        <View key={label} style={[s.infoRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#E4E8F0' }]}>
          <T size={15} color="#4A5468">
            {label}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{value}</View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  headBtn: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 6,
  },
  btn: {
    paddingHorizontal: 22,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    flexShrink: 0,
  },
  locked: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#E2E6EE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#EEF1F7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(11,18,32,0.55)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        } as object)
      : null),
  },
  card: {
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 28,
    gap: 18,
    ...webShadow('0 30px 80px rgba(0,0,0,0.35)'),
  },
  info: {
    backgroundColor: '#F4F6FA',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
});
