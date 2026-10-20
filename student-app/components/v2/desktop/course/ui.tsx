/**
 * "course" guruhi kompyuter ekranlari (Imtihonlar, Bonus, Sertifikatlar,
 * Jadval, Natijalar) uchun umumiy bo'laklar: matn, sarlavha, "Yo'l ·
 * Imtihonlar · Bonus" yorliqlari va ikonkalar (D_*.dc.html dagi SVG yo'llari aynan).
 */
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';

type F = keyof typeof fonts;

export const go = (h: string) => router.push(h as Href);

/** Qisqa matn — dizayndagi shrift/o'lcham/rang bir qatorda. */
export function T({
  f = 'bodyHeavy',
  size = 14,
  color = '#0B1220',
  lh,
  ls,
  style,
  children,
  lines,
  accessibilityRole,
  lang,
}: {
  f?: F;
  size?: number;
  color?: string;
  lh?: number;
  ls?: number;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
  lines?: number;
  accessibilityRole?: TextProps['accessibilityRole'];
  lang?: string;
}) {
  return (
    <Text
      accessibilityRole={accessibilityRole}
      numberOfLines={lines}
      {...(lang ? ({ lang } as object) : null)}
      style={[{ fontFamily: fonts[f], fontWeight: 'normal', fontSize: size, color, lineHeight: lh, letterSpacing: ls }, style]}
    >
      {children}
    </Text>
  );
}

/** Katta harfli kichik sarlavha (letter-spacing 0.08em, uppercase). */
export function Over({ children, color = '#4A5468', size = 12, em = 0.08, style }: { children: ReactNode; color?: string; size?: number; em?: number; style?: StyleProp<TextStyle> }) {
  return (
    <T size={size} color={color} ls={size * em} style={[{ textTransform: 'uppercase' }, style]}>
      {children}
    </T>
  );
}

/** Sahifa sarlavhasi: 28px Bricolage (line-height 1.1) + kulrang qator. */
export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ gap: 2, minWidth: 0, flexShrink: 1 }}>
      <T f="display" size={28} lh={30.8} ls={-0.56} lines={1} accessibilityRole="header">
        {title}
      </T>
      {!!sub && (
        <T f="bodyBold" size={14} color="#4A5468" lines={1}>
          {sub}
        </T>
      )}
    </View>
  );
}

/** D_Exams / D_Bonus: kontentdagi "Yo'l · Imtihonlar · Bonus" (420px, role=tablist). */
export function LessonTabs({ active, bonusDot }: { active: 'exams' | 'bonus'; bonusDot?: boolean }) {
  const tabs = [
    { key: 'path', label: 'Yoʻl', href: R.path },
    { key: 'exams', label: 'Imtihonlar', href: R.exams },
    { key: 'bonus', label: 'Bonus', href: R.bonus },
  ] as const;
  return (
    <View accessibilityRole="tablist" style={u.tabs}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => !on && go(t.href)}
            style={[u.tab, on && u.tabOn]}
          >
            <T f={on ? 'bodyHeavy' : 'bodyBold'} size={15} color={on ? '#0B1220' : '#34405A'}>
              {t.label}
            </T>
            {t.key === 'bonus' && bonusDot && <View accessibilityLabel="yangi" style={u.dot} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const u = StyleSheet.create({
  tabs: { width: 420, flexShrink: 0, flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: '#E6EAF2' },
  tab: { flex: 1, height: 42, paddingHorizontal: 18, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tabOn: { backgroundColor: '#FFFFFF', boxShadow: '0 2px 6px rgba(11,18,32,0.08)' } as object,
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF7A1A' },
});

/** Pastki paneldagi <kbd> + izoh (D_BonusPlayer: oraliq 6px). */
export function KeyHint({ k, label }: { k: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={u2.kbd}>
        <T size={12} color="#34405A">
          {k}
        </T>
      </View>
      <T f="bodyBold" size={13} color="#4A5468">
        {label}
      </T>
    </View>
  );
}

const u2 = StyleSheet.create({
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
});

// ─── Ikonkalar ─────────────────────────────────────────────────────────────

type P = { size?: number; color?: string; sw?: number };
const hidden = { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };
const ln = (color: string, w: number) => ({ fill: 'none', stroke: color, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const ICheck = ({ size = 16, color = '#075E3A', sw = 3 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M5 12l5 5 9-10" {...ln(color, sw)} />
  </Svg>
);
export const IChevron = ({ size = 18, color = '#5B6478', sw = 2.4 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M9 6l6 6-6 6" {...ln(color, sw)} />
  </Svg>
);
export const IChevronLeft = ({ size = 18, color = '#0B1220', sw = 2.4 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M15 6l-6 6 6 6" {...ln(color, sw)} />
  </Svg>
);
export const IArrow = ({ size = 16, color = '#FFFFFF', sw = 2.6 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M5 12h14M13 6l6 6-6 6" {...ln(color, sw)} />
  </Svg>
);
export const ILock = ({ size = 20, color = '#5B6478', sw = 2.2 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Rect x={5} y={11} width={14} height={10} rx={2.5} {...ln(color, sw)} />
    <Path d="M8 11V7a4 4 0 0 1 8 0v4" {...ln(color, sw)} />
  </Svg>
);
export const IMedal = ({ size = 28, color = '#0B1220', sw = 2.2 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Circle cx={12} cy={9} r={6} {...ln(color, sw)} />
    <Path d="M8.5 14 7 22l5-3 5 3-1.5-8" {...ln(color, sw)} />
  </Svg>
);
export const IClose = ({ size = 14, color = '#B42318', sw = 3 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M6 6l12 12M18 6 6 18" {...ln(color, sw)} />
  </Svg>
);
export const IPlay = ({ size = 22, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z" fill={color} />
  </Svg>
);
export const IBell = ({ size = 22, color = '#6A3CF0', sw = 2.2 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" {...ln(color, sw)} />
    <Path d="M10 20.5a2 2 0 0 0 4 0" {...ln(color, sw)} />
  </Svg>
);
export const IShield = ({ size = 13, color = '#FFFFFF', sw = 2.6, check }: P & { check?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" {...ln(color, sw)} />
    {check && <Path d="M9 12l2 2 4-4" {...ln(color, sw)} />}
  </Svg>
);
export const IClock = ({ size = 14, color = '#FFFFFF', sw = 2.4 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Circle cx={12} cy={12} r={9} {...ln(color, sw)} />
    <Path d="M12 7v5l3 2" {...ln(color, sw)} />
  </Svg>
);
export const IQr = ({ size = 22, color = '#1E3FD1', sw = 2 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Rect x={3} y={3} width={7} height={7} rx={1.5} {...ln(color, sw)} />
    <Rect x={14} y={3} width={7} height={7} rx={1.5} {...ln(color, sw)} />
    <Rect x={3} y={14} width={7} height={7} rx={1.5} {...ln(color, sw)} />
    <Path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4" {...ln(color, sw)} />
  </Svg>
);
export const ICopy = ({ size = 17, color = '#1E3FD1', sw = 2.2 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Rect x={8} y={8} width={12} height={12} rx={2.5} {...ln(color, sw)} />
    <Path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" {...ln(color, sw)} />
  </Svg>
);
export const IShare = ({ size = 19, color = '#0B1220', sw = 2.2 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Circle cx={18} cy={5} r={2.5} {...ln(color, sw)} />
    <Circle cx={6} cy={12} r={2.5} {...ln(color, sw)} />
    <Circle cx={18} cy={19} r={2.5} {...ln(color, sw)} />
    <Path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" {...ln(color, sw)} />
  </Svg>
);
export const IDownload = ({ size = 20, color = '#FFFFFF', sw = 2.4 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M12 4v11M7 10l5 5 5-5M5 20h14" {...ln(color, sw)} />
  </Svg>
);
export const IFullscreen = ({ size = 20, color = '#FFFFFF', sw = 2.4 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...ln(color, sw)} />
  </Svg>
);
export const IClipboard = ({ size = 26, color = '#FFFFFF', sw = 2.2 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Rect x={5} y={4} width={14} height={17} rx={2.5} {...ln(color, sw)} />
    <Path d="M9 4h6v3H9zM9 13l2 2 4-4" {...ln(color, sw)} />
  </Svg>
);
export const ITelegram = ({ size = 16, color = '#0B1220' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path
      d="M21.5 3.5 2.7 10.8c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.4 4.6 3.4c.7.5 1.7.1 1.9-.7L23 4.9c.2-1-.6-1.8-1.5-1.4zM9.6 14.2l8.2-6.9-6.6 8.3-.3 3.1z"
      fill={color}
    />
  </Svg>
);
export const ICoin = ({ size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Circle cx={12} cy={12} r={10} fill="#F5B70A" />
    <Circle cx={12} cy={12} r={6.5} fill="none" stroke="#B98500" strokeWidth={1.8} />
  </Svg>
);
export const IBolt = ({ size = 24, color = '#7C4DFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M13 2 4 14h7l-1 8 9-12h-7z" fill={color} />
  </Svg>
);
export const IFlame = ({ size = 24 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M12 2c.8 3.6 5.5 5.6 5.5 11.2A5.5 5.5 0 0 1 6.5 13.2c0-2.6 1.6-4.4 2.6-6 .7 1.8 1.6 2.7 2.6 2.7C11.7 7.4 11 4.6 12 2z" fill="#FF7A1A" />
  </Svg>
);
