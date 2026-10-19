/**
 * "home" guruhi ikonkalari — dizayndagi inline SVG yo'llari aynan ko'chirilgan
 * (Login, Onboarding, Main, Notifications, BotConnect, ContactSheet, holatlar).
 * Hammasi bezak: ma'noni ota elementning accessibilityLabel'i beradi.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { size?: number; color?: string; strokeWidth?: number };
const hidden = { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };

export const EyeIcon = ({ size = 20, color = '#4A5468' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} {...hidden}>
    <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <Circle cx="12" cy="12" r="3" />
  </Svg>
);

export const SendOutlineIcon = ({ size = 22, color = '#2F5BFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" {...hidden}>
    <Path d="M21 4 3 11l6 2.5L19 7l-7.5 8.5L18 20z" />
  </Svg>
);

export const BackIcon = ({ size = 22, color = '#0B1220' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M15 6l-6 6 6 6" />
  </Svg>
);

export const ArrowRight = ({ size = 18, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const CheckIcon = ({ size = 14, color = '#FFFFFF', strokeWidth = 3.2 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M5 12l5 5 9-10" />
  </Svg>
);

export const CoinIcon = ({ size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Circle cx="12" cy="12" r="10" fill="#F5B70A" />
    <Circle cx="12" cy="12" r="6.5" fill="none" stroke="#B98500" strokeWidth={1.8} />
  </Svg>
);

export const FlameIcon = ({ size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M12 2c.8 3.6 5.5 5.6 5.5 11.2A5.5 5.5 0 0 1 6.5 13.2c0-2.6 1.6-4.4 2.6-6 .7 1.8 1.6 2.7 2.6 2.7C11.7 7.4 11 4.6 12 2z" fill="#FF7A1A" />
  </Svg>
);

export const BellIcon = ({ size = 20, color = '#0B1220' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
    <Path d="M10 20.5a2 2 0 0 0 4 0" />
  </Svg>
);

export const BoltIcon = ({ size = 18, color = '#7C4DFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M13 2 4 14h7l-1 8 9-12h-7z" fill={color} />
  </Svg>
);

export const ShieldIcon = ({ size = 15, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinejoin="round" {...hidden}>
    <Path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
  </Svg>
);

const TG = 'M21.5 3.5 2.7 10.8c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.4 4.6 3.4c.7.5 1.7.1 1.9-.7L23 4.9c.2-1-.6-1.8-1.5-1.4zM9.6 14.2l8.2-6.9-6.6 8.3-.3 3.1z';
export const TelegramIcon = ({ size = 18, color = '#0B1220' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} {...hidden}>
    <Path d={TG} />
  </Svg>
);

// BotConnect'dagi "Botni ochish" tugmasida boshqacha (biroz farqli) yo'l ishlatilgan.
export const TelegramAltIcon = ({ size = 20, color = '#0B1220' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
    <Path d="M21.5 4.2 2.9 11.4c-1 .4-1 1.5 0 1.8l4.6 1.5 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.4 4.7 3.5c.6.4 1.4.1 1.6-.6l3.1-15.3c.2-1-.6-1.8-1.4-1.5zM9.6 14.3l-.4 3.9-1.3-4.2 9.6-6.3z" fill={color} />
  </Svg>
);

export const CloseIcon = ({ size = 20, color = '#0B1220' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" {...hidden}>
    <Path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const ChipBellIcon = ({ size = 14, color = '#1B5E8C' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0" />
  </Svg>
);

export const ChipVideoIcon = ({ size = 14, color = '#1B5E8C' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M15 10l5-3v10l-5-3M3 7h12v10H3z" />
  </Svg>
);

export const ChipCheckIcon = ({ size = 14, color = '#1B5E8C' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const DoubleCheckIcon = ({ size = 22, color = '#1E3FD1' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M2 12.5l4.5 4.5L15 8.5M10 16l1 1 10-10.5" />
  </Svg>
);

export const VideoIcon = ({ size = 20, color = '#B42318' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Rect x="2" y="6" width="14" height="12" rx="3" />
    <Path d="M16 10l6-3v10l-6-3" />
  </Svg>
);

export const TrophyIcon = ({ size = 20, color = '#5A2FD6', strokeWidth = 2 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
    <Path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5" />
  </Svg>
);

export const GiftIcon = ({ size = 20, color = '#B34700' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Rect x="3" y="8" width="18" height="13" rx="2" />
    <Path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1s6 1 6 1zm0 0c2-4 6-4 6-1s-6 1-6 1z" />
  </Svg>
);

export const ChatIcon = ({ size = 20, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" {...hidden}>
    <Path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 20.5l1.4-5.2A8.5 8.5 0 1 1 21 11.5z" />
  </Svg>
);

export const ClockIcon = ({ size = 16, color = '#4A5468' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" {...hidden}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 7v5l3 2" />
  </Svg>
);

export const ErrorCircleIcon = ({ size = 14, color = '#B42318' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" {...hidden}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 7.5v5.5M12 16.5v.5" />
  </Svg>
);

export const RetryIcon = ({ size = 20, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <Path d="M20 4v7h-7" />
  </Svg>
);

export const SpinnerIcon = ({ size = 14 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={3} strokeLinecap="round" {...hidden}>
    <Circle cx="12" cy="12" r="9" stroke="#E4E8F0" />
    <Path d="M12 3a9 9 0 0 1 9 9" stroke="#2F5BFF" />
  </Svg>
);

// Pastki menyu ikonkalari (Main.dc.html nav).
export const NavHomeIcon = ({ color, fill, strokeWidth = 2.4 }: { color: string; fill: string; strokeWidth?: number }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M3 10.3 12 3l9 7.3V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z" />
  </Svg>
);
export const NavPathIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Circle cx="6" cy="19" r="2" />
    <Circle cx="18" cy="5" r="2" />
    <Path d="M8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" />
  </Svg>
);
export const NavStarIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Path d="M12 3l2.2 5.3L20 9l-4.4 3.8L17 18.5 12 15.6 7 18.5l1.4-5.7L4 9l5.8-.7z" />
  </Svg>
);
export const NavUserIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    <Circle cx="12" cy="8" r="4" />
    <Path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
);
