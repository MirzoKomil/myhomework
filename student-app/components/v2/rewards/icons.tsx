/**
 * Mukofotlar guruhi (Liga, Darajalar, Do'kon, Streak) ikonkalari —
 * dizayndagi inline SVG yo'llari aynan ko'chirilgan.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const hidden = { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };

type P = { size?: number; color?: string; strokeWidth?: number };

export function BackIcon({ size = 22, color = '#0B1220' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M15 6l-6 6 6 6" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 16, color = '#FFD66B', strokeWidth = 2.6 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ size = 20, color = '#0B1220', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M6 6l12 12M18 6 6 18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function TimerIcon({ size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Circle cx="12" cy="13" r="8" stroke="#FFC93C" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M12 9v4l2 2M10 2h4" stroke="#FFC93C" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export function TickIcon({ size = 12, color = '#0B1220', strokeWidth = 3.4, d = 'M5 12l5 5 9-10' }: P & { d?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Darajalar/Do'kondagi yashil belgi (boshqacha yo'l). */
export const TICK2 = 'M5 12.5l4.5 4.5L19 7.5';

export function ArrowUpIcon({ size = 14, color = '#087A4A' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M12 19V5M6 11l6-6 6 6" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ArrowRightIcon({ size = 18, color = '#7EE2B8' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BoltFill({ size = 14, color = '#7C4DFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M13 2 4 14h7l-1 8 9-12h-7z" fill={color} />
    </Svg>
  );
}

export function CoinFill({ size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Circle cx="12" cy="12" r="10" fill="#F5B70A" />
      <Circle cx="12" cy="12" r="6.5" fill="none" stroke="#B98500" strokeWidth={1.8} />
    </Svg>
  );
}

export function LockIcon({ size = 20, color = '#5B6478', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BagIcon({ size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M5 8h14l-1.2 12H6.2z" stroke="#0B1220" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="#0B1220" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function TruckIcon({ size = 18, color = '#0B1220' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="7" cy="18" r="2" stroke={color} strokeWidth={2} />
      <Circle cx="17" cy="18" r="2" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function TapIcon({ size = 18 }: P) {
  const s = { stroke: '#0B1220', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10" {...s} />
      <Path d="M12 9.5a1.5 1.5 0 0 1 3 0V11" {...s} />
      <Path d="M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.6a6 6 0 0 1-4.6-2.2L4.5 16a1.6 1.6 0 0 1 2.4-2.1L9 15.5" {...s} />
      <Path d="M4 4l2 2M3 8h2" {...s} />
    </Svg>
  );
}

export function PlusIcon({ size = 22 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export function MinusIcon({ size = 22 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M5 12h14" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export function PhoneIcon({ size = 20 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" stroke="#2F5BFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function LongArrowIcon() {
  return (
    <Svg width={28} height={10} viewBox="0 0 28 10" {...hidden}>
      <Path d="M0 5h24M20 1l4 4-4 4" fill="none" stroke="#9AA3B5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ShieldIcon({ size = 18, color = '#FFFFFF', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M12 3l7 3v5.5c0 4.3-2.9 8-7 9.5-4.1-1.5-7-5.2-7-9.5V6z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** "Namuna" belgisidagi ko'z ikonkasi. */
export function EyeIcon({ size = 14, color = '#4A5468' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** ShopItem'dagi yetkazish qatori — yopiq yuk mashinasi yo'li, kichikroq g'ildirak. */
export function TruckSmallIcon({ size = 18, color = '#1E3FD1' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="7" cy="18" r="1.8" stroke={color} strokeWidth={2} />
      <Circle cx="17" cy="18" r="1.8" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function ChevronThinIcon({ size = 16, color = '#5B6478', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M9 5l7 7-7 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ClockIcon({ size = 20, color = '#2F5BFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} />
      <Path d="M12 7v5l3 2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function StarFill({ size = 26, color = '#F5A300' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z" fill={color} />
    </Svg>
  );
}

/** Balans o'zgarishi strelkasi (16×10, viewBox 28×10). */
export function SmallArrowIcon({ width = 16, height = 10 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 28 10" {...hidden}>
      <Path d="M0 5h24M20 1l4 4-4 4" fill="none" stroke="#9AA3B5" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Seriya uzildi: 6 → 0 strelkasi (28×14). */
export function DropArrowIcon() {
  return (
    <Svg width={28} height={14} viewBox="0 0 28 14" {...hidden}>
      <Path d="M1 7h24M19 1l6 6-6 6" fill="none" stroke="#5B6478" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SearchIcon({ size = 19, color = '#5B6478' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M20 20l-3.5-3.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

/** Lug'at: xatolarni takrorlash (ikki yarim aylana). */
export function MistakeRepeatIcon({ size = 20, color = '#B42318' }: P) {
  const s = { stroke: color, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" {...s} />
      <Path d="M18 3v4h-4M6 21v-4h4" {...s} />
    </Svg>
  );
}

/** Lug'at: "Takrorlashni boshlash" tugmasidagi aylanish ikonkasi. */
export function ReviewIcon({ size = 20, color = '#FFFFFF' }: P) {
  const s = { stroke: color, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M4 12a8 8 0 0 1 13.7-5.6L20 9" {...s} />
      <Path d="M20 4v5h-5" {...s} />
      <Path d="M20 12a8 8 0 0 1-13.7 5.6L4 15" {...s} />
      <Path d="M4 20v-5h5" {...s} />
    </Svg>
  );
}

export function SpeakerIcon({ size = 20, color = '#1E3FD1' }: P) {
  const s = { stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M4 9v6h4l5 4V5L8 9z" {...s} />
      <Path d="M16.5 8.5a5 5 0 0 1 0 7" {...s} />
    </Svg>
  );
}
