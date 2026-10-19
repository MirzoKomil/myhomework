/**
 * "homework" guruhi ikonkalari — dizayndagi inline SVG yo'llari aynan
 * ko'chirilgan (Homework, Exercise, Test, Reading, Match, Build,
 * HomeworkSent, Exams, Bonus). Hammasi bezak: ma'noni ota elementning
 * accessibilityLabel'i beradi.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { size?: number; color?: string; strokeWidth?: number };
const hidden = { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };

export const BackIcon = ({ size = 20, color = '#0B1220' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M15 5l-7 7 7 7" />
  </Svg>
);

export const CloseIcon = ({ size = 20, color = '#0B1220', strokeWidth = 2.4 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" {...hidden}>
    <Path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const ChevronRight = ({ size = 18, color = '#5B6478', strokeWidth = 2.4 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M9 5l7 7-7 7" />
  </Svg>
);

export const Check = ({ size = 20, color = '#087A4A', strokeWidth = 3 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M5 12l5 5 9-10" />
  </Svg>
);

// Reading dizaynidagi biroz boshqacha belgi yo'li.
export const CheckAlt = ({ size = 20, color = '#075E3A' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const Coin = ({ size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Circle cx="12" cy="12" r="10" fill="#F5B70A" />
    <Circle cx="12" cy="12" r="6.5" fill="none" stroke="#B98500" strokeWidth={1.8} />
  </Svg>
);

export const ArrowRight = ({ size = 18, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const SpeakerIcon = ({ size = 20, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M4 9v6h4l5 4V5L8 9z" />
    <Path d="M16.5 8.5a5 5 0 0 1 0 7" />
  </Svg>
);

export const BulbIcon = ({ size = 20, color = '#7A5300' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" />
  </Svg>
);

export const LockIcon = ({ size = 17, color = '#5B6478' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" {...hidden}>
    <Rect x="5" y="11" width="14" height="10" rx="2.5" />
    <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);

export const MedalIcon = ({ size = 20, color = '#0B1220' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Circle cx="12" cy="9" r="6" />
    <Path d="M8.5 14 7 22l5-3 5 3-1.5-8" />
  </Svg>
);

export const PlayIcon = ({ size = 18, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z" fill={color} />
  </Svg>
);

export const BellIcon = ({ size = 18, color = '#5A2FD6' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
    <Path d="M10 20.5a2 2 0 0 0 4 0" />
  </Svg>
);

// Pastki menyu (Exams/Bonus dizaynidagi nav) ikonkalari.
export const NavHome = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M3 10.3 12 3l9 7.3V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z" />
  </Svg>
);
export const NavPath = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Circle cx="6" cy="19" r="2" />
    <Circle cx="18" cy="5" r="2" />
    <Path d="M8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" />
  </Svg>
);
export const NavStar = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M12 3l2.2 5.3L20 9l-4.4 3.8L17 18.5 12 15.6 7 18.5l1.4-5.7L4 9l5.8-.7z" />
  </Svg>
);
export const NavTrophy = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
    <Path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5" />
  </Svg>
);
export const NavUser = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Circle cx="12" cy="8" r="4" />
    <Path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
);
