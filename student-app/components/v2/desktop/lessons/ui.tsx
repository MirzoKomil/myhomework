/**
 * "lessons" guruhi kompyuter ekranlari uchun umumiy bo'laklar: matn,
 * ikonkalar (D_*.dc.html dagi SVG yo'llari aynan), qorong'i <kbd>,
 * jonli darsgacha qolgan vaqt hisoblagichi.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Text, View, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { fonts } from '@/constants/v2/tokens';

type F = keyof typeof fonts;

/** Qisqa matn komponenti — dizayndagi shrift/o'lcham/rang bir qatorda. */
export function T({
  f = 'bodyHeavy',
  size = 14,
  color = '#0B1220',
  lh,
  ls,
  style,
  children,
  lines,
  sel,
  accessibilityRole,
}: {
  f?: F;
  size?: number;
  color?: string;
  lh?: number;
  ls?: number;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
  lines?: number;
  sel?: boolean;
  accessibilityRole?: TextProps['accessibilityRole'];
}) {
  return (
    <Text
      accessibilityRole={accessibilityRole}
      numberOfLines={lines}
      selectable={sel}
      style={[{ fontFamily: fonts[f], fontWeight: 'normal', fontSize: size, color, lineHeight: lh, letterSpacing: ls }, style]}
    >
      {children}
    </Text>
  );
}

/** Ustki harfli kichik sarlavha (letter-spacing: 0.08em, uppercase). */
export function Over({ children, color = '#4A5468', em = 0.08, size = 12, style }: { children: ReactNode; color?: string; em?: number; size?: number; style?: StyleProp<TextStyle> }) {
  return (
    <T size={size} color={color} ls={size * em} style={[{ textTransform: 'uppercase' }, style]}>
      {children}
    </T>
  );
}

/** Pleer ichidagi qorong'i <kbd> (D_AudioDialog, D_Video, D_SlideViewer). */
export function DarkKbd({ children }: { children: string }) {
  return (
    <View
      style={{
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
      }}
    >
      <T size={12} color="#DCE2EE">
        {children}
      </T>
    </View>
  );
}

/** Rangli tugma ichidagi <kbd> ("Enter", "Space"). */
export function InKbd({ children, bg = '#1E3FD1', color = '#DCE5FF' }: { children: string; bg?: string; color?: string }) {
  return (
    <View style={{ height: 24, paddingHorizontal: 7, borderRadius: 7, backgroundColor: bg, justifyContent: 'center' }}>
      <T size={12} color={color}>
        {children}
      </T>
    </View>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Jonli darsgacha qolgan vaqt "02:14:36" — har soniyada yangilanadi. */
export function useCountdown(target: Date | null): { text: string; label: string } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!target) return { text: '00:00:00', label: '' };
  const left = Math.max(0, Math.floor((target.getTime() - now) / 1000));
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return { text: `${pad(h)}:${pad(m)}:${pad(s)}`, label: `Jonli darsgacha ${h} soat ${m} daqiqa` };
}

// ─── Ikonkalar ─────────────────────────────────────────────────────────────

type P = { size?: number; color?: string; strokeWidth?: number };
const hidden = { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };
const st = (color: string, w: number) => ({ fill: 'none', stroke: color, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const ICheck = ({ size = 20, color = '#FFFFFF', strokeWidth = 3 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M5 12l5 5 9-10" {...st(color, strokeWidth)} />
  </Svg>
);
export const IChevron = ({ size = 18, color = '#5B6478', strokeWidth = 2.4 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M9 6l6 6-6 6" {...st(color, strokeWidth)} />
  </Svg>
);
export const IChevronLeft = ({ size = 22, color = '#0B1220', strokeWidth = 2.6 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M15 6l-6 6 6 6" {...st(color, strokeWidth)} />
  </Svg>
);
export const IArrow = ({ size = 17, color = '#FFFFFF', strokeWidth = 2.6 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M5 12h14M13 6l6 6-6 6" {...st(color, strokeWidth)} />
  </Svg>
);
export const IClose = ({ size = 20, color = '#0B1220', strokeWidth = 2.4 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M6 6l12 12M18 6 6 18" {...st(color, strokeWidth)} />
  </Svg>
);
export const IPlay = ({ size = 14, color = '#2F5BFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z" fill={color} />
  </Svg>
);
export const IPause = ({ size = 14, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Rect x={6} y={4} width={4.2} height={16} rx={1.5} fill={color} />
    <Rect x={13.8} y={4} width={4.2} height={16} rx={1.5} fill={color} />
  </Svg>
);
export const ILock = ({ size = 17, color = '#5B6478', strokeWidth = 2.2 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Rect x={5} y={11} width={14} height={10} rx={2.5} {...st(color, strokeWidth)} />
    <Path d="M8 11V7a4 4 0 0 1 8 0v4" {...st(color, strokeWidth)} />
  </Svg>
);
export const IFlag = ({ size = 18, color = '#7A5300', strokeWidth = 2.4 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M5 21V4h11l-2 4 2 4H5" {...st(color, strokeWidth)} />
  </Svg>
);
export const IPencil = ({ size = 17, color = '#7A5300', strokeWidth = 2.2 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M4 20h4L19 9l-4-4L4 16z" {...st(color, strokeWidth)} />
    <Path d="M13.5 6.5l4 4" {...st(color, strokeWidth)} />
  </Svg>
);
export const IHeadphones = ({ size = 20, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M4 15v-3a8 8 0 0 1 16 0v3" {...st(color, 2.2)} />
    <Rect x={3} y={14} width={5} height={7} rx={2} {...st(color, 2.2)} />
    <Rect x={16} y={14} width={5} height={7} rx={2} {...st(color, 2.2)} />
  </Svg>
);
export const ICamera = ({ size = 19, color = '#B42318' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Rect x={2} y={6} width={14} height={12} rx={3} {...st(color, 2.2)} />
    <Path d="M16 10l6-3v10l-6-3" {...st(color, 2.2)} />
  </Svg>
);
export const IScreen = ({ size = 17, color = '#0B1220' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Rect x={3} y={4} width={18} height={12} rx={2} {...st(color, 2.2)} />
    <Path d="M12 16v4M8 20h8" {...st(color, 2.2)} />
  </Svg>
);
export const ITelegram = ({ size = 17, color = '#0B1220' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path
      d="M21.5 3.5 2.7 10.8c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.4 4.6 3.4c.7.5 1.7.1 1.9-.7L23 4.9c.2-1-.6-1.8-1.5-1.4zM9.6 14.2l8.2-6.9-6.6 8.3-.3 3.1z"
      fill={color}
    />
  </Svg>
);
export const ISpeaker = ({ size = 24, color = '#2F5BFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M4 9v6h4l5 4V5L8 9z" {...st(color, 2.2)} />
    <Path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" {...st(color, 2.2)} />
  </Svg>
);
export const IBulb = ({ size = 20, color = '#7A5300' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" {...st(color, 2.2)} />
  </Svg>
);
export const IClock = ({ size = 20, color = '#1E3FD1' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Circle cx={12} cy={12} r={9} {...st(color, 2.2)} />
    <Path d="M12 7v5l3 2" {...st(color, 2.2)} />
  </Svg>
);
export const IFullscreen = ({ size = 19, color = '#0B1220' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...st(color, 2.4)} />
  </Svg>
);
export const ISkipPrev = ({ size = 20, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M6 5h2.4v14H6zM20 5.5v13a.8.8 0 0 1-1.2.7L9.6 12.7a.8.8 0 0 1 0-1.4l9.2-6.5a.8.8 0 0 1 1.2.7z" fill={color} />
  </Svg>
);
export const ISkipNext = ({ size = 20, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M15.6 5H18v14h-2.4zM4 5.5v13a.8.8 0 0 0 1.2.7l9.2-6.5a.8.8 0 0 0 0-1.4L5.2 4.8A.8.8 0 0 0 4 5.5z" fill={color} />
  </Svg>
);
export const IRepeatOne = ({ size = 22, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M17 2l3 3-3 3" {...st(color, 2.2)} />
    <Path d="M4 11V9a4 4 0 0 1 4-4h16" {...st(color, 2.2)} />
    <Path d="M7 22l-3-3 3-3" {...st(color, 2.2)} />
    <Path d="M20 13v2a4 4 0 0 1-4 4H4" {...st(color, 2.2)} />
    <Path d="M11 10.5l1.6-1V15" {...st(color, 2)} />
  </Svg>
);
export const IQr = ({ size = 14, color = '#4A5468' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path
      d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm10-2h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2zm2-4h2v2h-2zm0 4h2v2h-2z"
      fill={color}
    />
  </Svg>
);
export const ICoin = ({ size = 16 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Circle cx={12} cy={12} r={10} fill="#F5B70A" />
    <Circle cx={12} cy={12} r={6.5} fill="none" stroke="#B98500" strokeWidth={1.8} />
  </Svg>
);
export const IBolt = ({ size = 15, color = '#7C4DFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M13 2 4 14h7l-1 8 9-12h-7z" fill={color} />
  </Svg>
);
export const IFlame = ({ size = 15, color = '#FF7A1A' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M12 2c.8 3.6 5.5 5.6 5.5 11.2A5.5 5.5 0 0 1 6.5 13.2c0-2.6 1.6-4.4 2.6-6 .7 1.8 1.6 2.7 2.6 2.7C11.7 7.4 11 4.6 12 2z" fill={color} />
  </Svg>
);
