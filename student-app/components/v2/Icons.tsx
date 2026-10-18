/**
 * v2 ikonkalari — dizayn kanvasidagi chiziqli SVG ikonkalar.
 * Hammasi bezak sifatida belgilangan (ekran o'quvchilari o'tkazib
 * yuboradi); ma'noni yonidagi matn yoki ota elementning
 * accessibilityLabel'i beradi.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/constants/v2/tokens';

type IconProps = { size?: number; color?: string; strokeWidth?: number };

const hidden = { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };

export function FlameIcon({ size = 18, color = colors.streak }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M12 2c.8 3.6 5.5 5.6 5.5 11.2A5.5 5.5 0 0 1 6.5 13.2c0-2.6 1.6-4.4 2.6-6 .7 1.8 1.6 2.7 2.6 2.7C11.7 7.4 11 4.6 12 2z" fill={color} />
    </Svg>
  );
}

export function CoinIcon({ size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Circle cx="12" cy="12" r="10" fill={colors.coin} />
      <Circle cx="12" cy="12" r="6.5" fill="none" stroke={colors.coinRim} strokeWidth={1.8} />
    </Svg>
  );
}

export function BoltIcon({ size = 18, color = colors.lightning }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M13 2 4 14h7l-1 8 9-12h-7z" fill={color} />
    </Svg>
  );
}

export function CheckIcon({ size = 14, color = colors.textOnDark, strokeWidth = 3.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M5 12l5 5 9-10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ArrowRightIcon({ size = 18, color = colors.ink, strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ShieldIcon({ size = 15, color = colors.textOnDark, strokeWidth = 2.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </Svg>
  );
}

export function ChatIcon({ size = 19, color = colors.ink, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 20.5l1.4-5.2A8.5 8.5 0 1 1 21 11.5z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </Svg>
  );
}

export function LockIcon({ size = 17, color = colors.textSubtle, strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Rect x="5" y="11" width="14" height="10" rx="2.5" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function EyeIcon({ size = 20, color = colors.textMuted, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}
