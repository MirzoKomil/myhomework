/**
 * "home" guruhining kompyuter ikonkalari — D_*.dc.html dagi SVG yo'llari aynan.
 */
import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { size?: number; color?: string; strokeWidth?: number };

const Stroke = ({ size, color, strokeWidth, children }: Required<P> & { children: ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

const TG = 'M21.5 3.5 2.7 10.8c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.4 4.6 3.4c.7.5 1.7.1 1.9-.7L23 4.9c.2-1-.6-1.8-1.5-1.4zM9.6 14.2l8.2-6.9-6.6 8.3-.3 3.1z';

export const TgIcon = ({ size = 18, color = '#0B1220' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d={TG} />
  </Svg>
);
export const ArrowIcon = ({ size = 18, color = '#0B1220', strokeWidth = 2.4 }: P) => (
  <Stroke size={size} color={color} strokeWidth={strokeWidth}>
    <Path d="M5 12h14M13 6l6 6-6 6" />
  </Stroke>
);
export const CheckIcon = ({ size = 13, color = '#FFFFFF', strokeWidth = 3.2 }: P) => (
  <Stroke size={size} color={color} strokeWidth={strokeWidth}>
    <Path d="M5 12l5 5 9-10" />
  </Stroke>
);
export const ChevronIcon = ({ size = 18, color = '#5B6478', strokeWidth = 2.4 }: P) => (
  <Stroke size={size} color={color} strokeWidth={strokeWidth}>
    <Path d="M9 6l6 6-6 6" />
  </Stroke>
);
export const BackIcon = ({ size = 20, color = '#0B1220' }: P) => (
  <Stroke size={size} color={color} strokeWidth={2.4}>
    <Path d="M15 6l-6 6 6 6" />
  </Stroke>
);
export const CloseIcon = ({ size = 20, color = '#0B1220' }: P) => (
  <Stroke size={size} color={color} strokeWidth={2.4}>
    <Path d="M6 6l12 12M18 6 6 18" />
  </Stroke>
);
export const MonitorIcon = ({ size = 18, color = '#FFFFFF', strokeWidth = 2.2 }: P) => (
  <Stroke size={size} color={color} strokeWidth={strokeWidth}>
    <Rect x={3} y={4} width={18} height={12} rx={2} />
    <Path d="M12 16v4M8 20h8" />
  </Stroke>
);
export const ClockIcon = ({ size = 13, color = '#FFFFFF', strokeWidth = 2.6 }: P) => (
  <Stroke size={size} color={color} strokeWidth={strokeWidth}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 7v5l3 2" />
  </Stroke>
);
export const StarIcon = ({ size = 13, color = '#B98500', strokeWidth = 2.4 }: P) => (
  <Stroke size={size} color={color} strokeWidth={strokeWidth}>
    <Path d="M12 3l2.2 5.3L20 9l-4.4 3.8L17 18.5 12 15.6 7 18.5l1.4-5.7L4 9l5.8-.7z" />
  </Stroke>
);
export const ShieldIcon = ({ size = 14, color = '#FFFFFF', strokeWidth = 2.6 }: P) => (
  <Stroke size={size} color={color} strokeWidth={strokeWidth}>
    <Path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
  </Stroke>
);
export const ArrowUpIcon = ({ size = 15, color = '#087A4A', strokeWidth = 2.6 }: P) => (
  <Stroke size={size} color={color} strokeWidth={strokeWidth}>
    <Path d="M12 19V5M5 12l7-7 7 7" />
  </Stroke>
);
export const FlagIcon = ({ size = 15, color = '#4A5468', strokeWidth = 2.2 }: P) => (
  <Stroke size={size} color={color} strokeWidth={strokeWidth}>
    <Path d="M5 21V4h11l-2 4 2 4H5" />
  </Stroke>
);
export const FlameIcon = ({ size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 2c.8 3.6 5.5 5.6 5.5 11.2A5.5 5.5 0 0 1 6.5 13.2c0-2.6 1.6-4.4 2.6-6 .7 1.8 1.6 2.7 2.6 2.7C11.7 7.4 11 4.6 12 2z" fill="#FF7A1A" />
  </Svg>
);
export const BoltIcon = ({ size = 14, color = '#7C4DFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M13 2 4 14h7l-1 8 9-12h-7z" fill={color} />
  </Svg>
);
// Bildirishnomalar
export const VideoIcon = ({ size = 26, color = '#B42318', strokeWidth = 2.2 }: P) => (
  <Stroke size={size} color={color} strokeWidth={strokeWidth}>
    <Rect x={2} y={6} width={14} height={12} rx={3} />
    <Path d="M16 10l6-3v10l-6-3" />
  </Stroke>
);
export const TrophyIcon = ({ size = 24, color = '#6A3CF0', strokeWidth = 2.2 }: P) => (
  <Stroke size={size} color={color} strokeWidth={strokeWidth}>
    <Path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
    <Path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5" />
  </Stroke>
);
export const GiftIcon = ({ size = 24, color = '#B34700', strokeWidth = 2.2 }: P) => (
  <Stroke size={size} color={color} strokeWidth={strokeWidth}>
    <Rect x={3} y={8} width={18} height={5} rx={1} />
    <Path d="M5 13v7h14v-7M12 8v12M12 8c-1.5-4-6-4-5-1 .5 1.2 3 1 5 1zM12 8c1.5-4 6-4 5-1-.5 1.2-3 1-5 1z" />
  </Stroke>
);
export const DoubleCheckIcon = ({ size = 20, color = '#2F5BFF' }: P) => (
  <Stroke size={size} color={color} strokeWidth={2.2}>
    <Path d="M2 12.5l4.5 4.5L15 8.5M10 16l1 1 9-9.5" />
  </Stroke>
);
// So'z takrorlash
export const SpeakerIcon = ({ size = 24, color = '#2F5BFF' }: P) => (
  <Stroke size={size} color={color} strokeWidth={2.2}>
    <Path d="M4 9v6h4l5 4V5L8 9z" />
    <Path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  </Stroke>
);
// Server xatosi
export const AlertIcon = ({ size = 17, color = '#B42318' }: P) => (
  <Stroke size={size} color={color} strokeWidth={2.2}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 7.5v5M12 16.2h.01" />
  </Stroke>
);
export const PulseIcon = ({ size = 20, color = '#2F5BFF' }: P) => (
  <Stroke size={size} color={color} strokeWidth={2.2}>
    <Path d="M3 12h4l3-8 4 16 3-8h4" />
  </Stroke>
);
export const RetryIcon = ({ size = 20, color = '#FFFFFF' }: P) => (
  <Stroke size={size} color={color} strokeWidth={2.4}>
    <Path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />
  </Stroke>
);
// Kirish
export const EyeIcon = ({ size = 21, color = '#4A5468', strokeWidth = 2 }: P) => (
  <Stroke size={size} color={color} strokeWidth={strokeWidth}>
    <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <Circle cx={12} cy={12} r={3} />
  </Stroke>
);
export const CalendarIcon = ({ size = 17, color = '#FFFFFF' }: P) => (
  <Stroke size={size} color={color} strokeWidth={2.2}>
    <Rect x={3} y={5} width={18} height={16} rx={3} />
    <Path d="M3 10h18M8 3v4M16 3v4" />
  </Stroke>
);
export const BellIcon = ({ size = 17, color = '#FFFFFF', strokeWidth = 2.2 }: P) => (
  <Stroke size={size} color={color} strokeWidth={strokeWidth}>
    <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
    <Path d="M10 20.5a2 2 0 0 0 4 0" />
  </Stroke>
);
// BotConnect ro'yxati
export const ChipBellIcon = ({ size = 17, color = '#1B6FA8' }: P) => (
  <Stroke size={size} color={color} strokeWidth={2}>
    <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0" />
  </Stroke>
);
export const ChipVideoIcon = ({ size = 17, color = '#1B6FA8' }: P) => (
  <Stroke size={size} color={color} strokeWidth={2}>
    <Path d="M15 10l5-3v10l-5-3M3 7h12v10H3z" />
  </Stroke>
);
export const ChipCheckIcon = ({ size = 17, color = '#1B6FA8' }: P) => (
  <Stroke size={size} color={color} strokeWidth={2}>
    <Path d="M5 12.5l4.5 4.5L19 7.5" />
  </Stroke>
);
