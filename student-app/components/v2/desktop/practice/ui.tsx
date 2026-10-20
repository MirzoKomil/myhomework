/**
 * "practice" guruhining kompyuter (D_*) ekranlari uchun umumiy bo'laklar:
 * ikonkalar (dizayndagi SVG yo'llari aynan), <kbd> yorliqlari (yorug',
 * qorong'u — D_Battle, ko'k/yashil tugma ichidagi) va matn yordamchisi.
 */
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { fonts } from '@/constants/v2/tokens';

type IP = { size?: number; color?: string; sw?: number };

const Stroke = ({ size = 18, color = '#0B1220', sw = 2.4, children }: IP & { children: ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

export const IArrow = ({ size = 18, color = '#FFFFFF', sw = 2.6 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Path d="M5 12h14M13 6l6 6-6 6" />
  </Stroke>
);
export const IChevron = ({ size = 18, color = '#5B6478', sw = 2.4 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Path d="M9 6l6 6-6 6" />
  </Stroke>
);
export const ISearch = ({ size = 19, color = '#4A5468', sw = 2.3 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Circle cx={11} cy={11} r={7} />
    <Path d="M20 20l-3.5-3.5" />
  </Stroke>
);
export const ICheck = ({ size = 15, color = '#FFFFFF', sw = 3 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Path d="M5 12l5 5 9-10" />
  </Stroke>
);
export const IStopwatch = ({ size = 15, color = '#1E3FD1', sw = 2.4 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Circle cx={12} cy={13} r={8} />
    <Path d="M12 9v4l2.5 2M9.5 2.5h5" />
  </Stroke>
);
export const IBulb = ({ size = 18, color = '#0B1220', sw = 2.2 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" />
  </Stroke>
);
export const IInfo = ({ size = 22, color = '#1E3FD1', sw = 2.2 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 11v6M12 7.5v.5" />
  </Stroke>
);
export const ILock = ({ size = 16, color = '#FFFFFF', sw = 2.4 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Rect x={5} y={11} width={14} height={10} rx={2.5} />
    <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Stroke>
);
export const ISpeaker = ({ size = 46, color = '#FFFFFF', sw = 2.2 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <Path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
  </Stroke>
);
export const IMouse = ({ size = 26, color = '#6A3CF0', sw = 2.2 }: IP) => (
  <Stroke size={size} color={color} sw={sw}>
    <Rect x={6} y={3} width={12} height={18} rx={6} />
    <Path d="M12 7v4" />
  </Stroke>
);
/** Esla-mosla yopiq kartasidagi uycha. */
export const IHouse = ({ size = 52 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 3 2.5 11h2.7v9.5h13.6V11h2.7z" fill="#FFFFFF" />
    <Rect x={10} y={14} width={4} height={6.5} rx={2} fill="#FF7A1A" />
  </Svg>
);
export const ICoin = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={10} fill="#F5B70A" />
    <Circle cx={12} cy={12} r={6.5} fill="none" stroke="#B98500" strokeWidth={1.8} />
  </Svg>
);

type KbdTone = 'light' | 'battle' | 'blue' | 'green';
const KBD: Record<KbdTone, { box: object; text: TextStyle }> = {
  light: { box: { backgroundColor: '#FFFFFF', borderWidth: 1, borderBottomWidth: 2, borderColor: '#D5DBE7', paddingHorizontal: 6 }, text: { color: '#34405A' } },
  battle: { box: { backgroundColor: '#1B2438', borderWidth: 1, borderBottomWidth: 2, borderColor: '#34405A', paddingHorizontal: 6 }, text: { color: '#DCE2EE' } },
  blue: { box: { backgroundColor: '#1E3FD1', paddingHorizontal: 7 }, text: { color: '#DCE5FF' } },
  green: { box: { backgroundColor: '#075E3A', paddingHorizontal: 7 }, text: { color: '#CFF2E0' } },
};

/** Dizayndagi <kbd> (24px). */
export function K({ children, tone = 'light' }: { children: string; tone?: KbdTone }) {
  const t = KBD[tone];
  return (
    <View style={[s.kbd, t.box]}>
      <Text style={[s.kbdText, t.text]}>{children}</Text>
    </View>
  );
}

/** Pastki "klaviatura" yorliqlari qatori: [[tugmalar], matn] … */
export function KeyHints({ items, tone = 'light', color = '#4A5468' }: { items: [string[], string][]; tone?: KbdTone; color?: string }) {
  return (
    <View accessibilityLabel="Klaviatura" style={{ flexDirection: 'row', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      {items.map(([keys, label]) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {keys.map((k) => (
            <K key={k} tone={tone}>
              {k}
            </K>
          ))}
          <Text style={[s.hint, { color }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Manrope matn — og'irlik raqami bilan (dizayndagi font-weight). */
export function T({
  w = 700,
  size,
  color = '#0B1220',
  lh,
  style,
  children,
  lines,
}: {
  w?: 500 | 600 | 700 | 800;
  size: number;
  color?: string;
  lh?: number;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  lines?: number;
}) {
  const family = w === 800 ? fonts.bodyHeavy : w === 700 ? fonts.bodyBold : w === 600 ? fonts.body : fonts.bodyMedium;
  return (
    <Text numberOfLines={lines} style={[{ fontFamily: family, fontWeight: 'normal', fontSize: size, color, lineHeight: lh ?? Math.round(size * 1.366) }, style]}>
      {children}
    </Text>
  );
}

/** Bricolage sarlavha (letter-spacing −0.02em). */
export function H({ size, color = '#0B1220', lh, children, style }: { size: number; color?: string; lh?: number; children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text
      accessibilityRole="header"
      style={[{ fontFamily: fonts.display, fontWeight: 'normal', fontSize: size, letterSpacing: -0.02 * size, color, lineHeight: lh ?? Math.round(size * 1.2) }, style]}
    >
      {children}
    </Text>
  );
}

/** Faqat webda ishlaydigan CSS (soya, gradient, dashed outline). */
export const web = (o: object) => (Platform.OS === 'web' ? o : {});

const s = StyleSheet.create({
  kbd: { minWidth: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  kbdText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16 },
  hint: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18 },
});
