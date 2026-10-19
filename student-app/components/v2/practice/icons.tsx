/**
 * Mashq guruhi ikonkalari — dizayndagi inline SVG yo'llari aynan ko'chirilgan.
 * Hammasi bezak (ma'noni ota elementning accessibilityLabel'i beradi).
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const hidden = { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };

type P = { size?: number; color?: string; strokeWidth?: number };

export function SearchIcon({ size = 21, color = '#0B1220', strokeWidth = 2.3 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M20 20l-3.5-3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function ArrowIcon({ size = 15, color = '#FFFFFF', strokeWidth = 2.6 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 18, color = '#4A5468', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BackIcon({ size = 22, color = '#0B1220', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M15 6l-6 6 6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
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

export function CheckIcon({ size = 11, color = '#FFFFFF', strokeWidth = 3.6 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M5 12l5 5 9-10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function StopwatchIcon({ size = 14, color = '#1E3FD1', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Circle cx="12" cy="13" r="8" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M12 9v4l2 2M10 2h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function BulbIcon({ size = 16, color = '#0B1220', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path
        d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function LockIcon({ size = 11, color = '#FFFFFF', strokeWidth = 2.6 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function SpeakerIcon({ size = 34, color = '#FFFFFF', strokeWidth = 2, full = true }: P & { full?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M4 9v6h4l5 4V5L8 9z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d={full ? 'M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12' : 'M16.5 8.5a5 5 0 0 1 0 7'}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Circle cx="12" cy="12" r="10" fill="#F5B70A" />
      <Circle cx="12" cy="12" r="6.5" fill="none" stroke="#B98500" strokeWidth={1.8} />
    </Svg>
  );
}

export function HouseCardIcon({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M3 11.5 12 4l9 7.5" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 10.5V20h12v-9.5" fill="#FFFFFF" fillOpacity={0.92} />
      <Rect x="10" y="14" width="4" height="6" rx="2" fill="#FF7A1A" />
    </Svg>
  );
}

export function HandIcon({ size = 22, color = '#5A2FD6' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path
        d="M9 11V5a2 2 0 0 1 4 0v6M13 10V8a2 2 0 0 1 4 0v5a7 7 0 0 1-7 7H9a5 5 0 0 1-5-5v-2a2 2 0 0 1 4 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function BackspaceIcon({ size = 20, color = '#0B1220' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M21 5H8l-6 7 6 7h13z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M12 9l6 6M18 9l-6 6" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

export function SwapIcon({ size = 20, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function HeadphonesIcon({ size = 18, color = '#6A3CF0' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M3 14v-2a9 9 0 0 1 18 0v2" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="3" y="14" width="4" height="6" rx="1.5" stroke={color} strokeWidth={2.2} />
      <Rect x="17" y="14" width="4" height="6" rx="1.5" stroke={color} strokeWidth={2.2} />
    </Svg>
  );
}

export function PlusIcon({ size = 18, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

export function ClockIcon({ size = 18, color = '#5B6478' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2.2} />
      <Path d="M12 7v5l3 2" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Ma'lumot belgisi (So'nggi harf: ь/ъ/ы qoidasi).
export function InfoIcon({ size = 18, color = '#1E3FD1', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M12 11v6M12 7.5v.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

// Soʻztopar holat qatoridagi taymer (yo'li StopwatchIcon'dan farq qiladi).
export function TimerIcon({ size = 18, color = '#5A2FD6', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Circle cx="12" cy="13" r="8" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M12 9v4l2.5 2M9.5 2.5h5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Tarjimon: "Lug'atga qo'shildi" belgisi.
export function SavedCheckIcon({ size = 16, color = '#7BE0B0', strokeWidth = 3 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Pastki menyu ikonkalari (yangi dizayn: faol "Mashq" yulduzi to'ldirilmagan, chiziq 2.4).
export function NavHome({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M3 10.3 12 3l9 7.3V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
export function NavPath({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Circle cx="6" cy="19" r="2" stroke={color} strokeWidth={2} />
      <Circle cx="18" cy="5" r="2" stroke={color} strokeWidth={2} />
      <Path d="M8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
export function NavStar({ color, filled, strokeWidth = 2 }: { color: string; filled?: boolean; strokeWidth?: number }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path
        d="M12 3l2.2 5.3L20 9l-4.4 3.8L17 18.5 12 15.6 7 18.5l1.4-5.7L4 9l5.8-.7z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
export function NavTrophy({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
export function NavUser({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...hidden}>
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={2} />
      <Path d="M4 21a8 8 0 0 1 16 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
