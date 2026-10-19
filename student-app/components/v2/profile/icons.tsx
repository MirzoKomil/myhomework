/**
 * Profil guruhi ikonkalari — dizayndagi inline SVG yo'llari aynan
 * ko'chirilgan (Profile, ProfileEdit, Teacher, Payments, Contract,
 * Expired, DebtReminder, Certificates, Schedule, Progress).
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { size?: number; color?: string; strokeWidth?: number };

const hidden = { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };

const line = (color: string, strokeWidth: number) => ({
  fill: 'none',
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function BackIcon({ size = 22, color = '#0B1220', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M15 6l-6 6 6 6" {...line(color, strokeWidth)} />
    </Svg>
  );
}

/** Sertifikat/Jadval/Natijalar sarlavhasidagi biroz boshqacha orqaga belgisi. */
export function BackIcon2({ size = 20, color = '#0B1220', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M15 5l-7 7 7 7" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function NextIcon({ size = 18, color = '#0B1220', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M9 5l7 7-7 7" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function ChevronIcon({ size = 18, color = '#6B7489', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M9 6l6 6-6 6" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function CloseIcon({ size = 20, color = '#0B1220', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M6 6l12 12M18 6 6 18" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function PencilIcon({ size = 12, color = '#FFFFFF', strokeWidth = 2.8 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M4 20h4L19 9l-4-4L4 16z" {...line(color, strokeWidth)} />
      <Path d="M13.5 6.5l4 4" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function GearIcon({ size = 21, color = '#0B1220', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Circle cx="12" cy="12" r="3" {...line(color, strokeWidth)} />
      <Path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
        {...line(color, strokeWidth)}
      />
    </Svg>
  );
}

export function BoltIcon({ size = 22, color = '#FFC93C' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M13 2 4 14h7l-1 8 9-12h-7z" fill={color} />
    </Svg>
  );
}

export function FlameIcon({ size = 20, color = '#FF7A1A' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M12 2c.8 3.6 5.5 5.6 5.5 11.2A5.5 5.5 0 0 1 6.5 13.2c0-2.6 1.6-4.4 2.6-6 .7 1.8 1.6 2.7 2.6 2.7C11.7 7.4 11 4.6 12 2z" fill={color} />
    </Svg>
  );
}

export function CoinIcon({ size = 20 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Circle cx="12" cy="12" r="10" fill="#F5B70A" />
      <Circle cx="12" cy="12" r="6.5" fill="none" stroke="#B98500" strokeWidth={1.8} />
    </Svg>
  );
}

export function ChartIcon({ size = 20, color = '#2F5BFF', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function CalendarIcon({ size = 20, color = '#2F5BFF', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Rect x="3" y="5" width="18" height="16" rx="3" {...line(color, strokeWidth)} />
      <Path d="M3 10h18M8 3v4M16 3v4" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function RibbonIcon({ size = 20, color = '#2F5BFF', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Circle cx="12" cy="9" r="6" {...line(color, strokeWidth)} />
      <Path d="M8.5 14 7 22l5-3 5 3-1.5-8" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function TeacherIcon({ size = 20, color = '#2F5BFF', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Circle cx="9" cy="8" r="4" {...line(color, strokeWidth)} />
      <Path d="M2 21a7 7 0 0 1 14 0" {...line(color, strokeWidth)} />
      <Path d="M17 4l4 2-4 2M21 6v4" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function CardIcon({ size = 20, color = '#2F5BFF', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Rect x="2.5" y="5" width="19" height="14" rx="3" {...line(color, strokeWidth)} />
      <Path d="M2.5 10h19M6.5 15h4" {...line(color, strokeWidth)} />
    </Svg>
  );
}

/** Profil "Doʻkon va buyurtmalarim" qatori — sumka. */
export function BagIcon({ size = 20, color = '#2F5BFF', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" {...line(color, strokeWidth)} />
      <Path d="M9 8V6.5a3 3 0 0 1 6 0V8" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function CheckIcon({ size = 12, color = '#FFFFFF', strokeWidth = 3.6 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M5 12.5l4.5 4.5L19 7.5" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function CheckThinIcon({ size = 14, color = '#087A4A', strokeWidth = 3 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M5 12l5 5 9-10" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function CameraIcon({ size = 20, color = '#1E3FD1', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M4 8h3l2-3h6l2 3h3v11H4z" {...line(color, strokeWidth)} />
      <Circle cx="12" cy="13" r="3.5" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function LockIcon({ size = 16, color = '#6B7489', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Rect x="5" y="11" width="14" height="10" rx="2" {...line(color, strokeWidth)} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" {...line(color, strokeWidth)} />
    </Svg>
  );
}

/** Sertifikatlardagi qulf (biroz boshqa nisbatlar). */
export function LockIcon2({ size = 16, color = '#5B6478', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Rect x="5" y="11" width="14" height="10" rx="2.5" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function EyeIcon({ size = 18, color = '#1E3FD1', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" {...line(color, strokeWidth)} />
      <Circle cx="12" cy="12" r="3" {...line(color, strokeWidth)} />
    </Svg>
  );
}

/** Telegram (to'ldirilgan) — Teacher, ProfileEdit. */
export function TelegramIcon({ size = 18, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M21.5 3.5 2.7 10.8c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.4 4.6 3.4c.7.5 1.7.1 1.9-.7L23 4.9c.2-1-.6-1.8-1.5-1.4zM9.6 14.2l8.2-6.9-6.6 8.3-.3 3.1z" fill={color} />
    </Svg>
  );
}

/** Telegram — Expired va DebtReminder'dagi variant. */
export function TelegramIcon2({ size = 20, color = '#0B1220' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M21.5 4.2 2.9 11.4c-1 .4-1 1.5 0 1.8l4.6 1.5 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.4 4.7 3.5c.6.4 1.4.1 1.6-.6l3.1-15.3c.2-1-.6-1.8-1.4-1.5zM9.6 14.3l-.4 3.9-1.3-4.2 9.6-6.3z" fill={color} />
    </Svg>
  );
}

export function ChatBubbleIcon({ size = 18, color = '#FFFFFF', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 20.5l1.4-5.2A8.5 8.5 0 1 1 21 11.5z" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </Svg>
  );
}

export function ClockIcon({ size = 16, color = '#5A2FD6', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M12 7v5l3 2" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function DocIcon({ size = 20, color = '#B42318', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...line(color, strokeWidth)} />
      <Path d="M14 3v5h5M9 13h6M9 17h4" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function DownloadIcon({ size = 20, color = '#FFFFFF', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M12 4v11M7 10l5 5 5-5M5 20h14" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function ShareIcon({ size = 20, color = '#1E3FD1', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M12 15V3M7 8l5-5 5 5" {...line(color, strokeWidth)} />
      <Path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function ShieldCheckIcon({ size = 24, color = '#087A4A', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M12 3l7 3v5.5c0 4.3-2.9 8-7 9.5-4.1-1.5-7-5.2-7-9.5V6z" {...line(color, strokeWidth)} />
      <Path d="M9 12l2 2 4-4" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function ShieldIcon({ size = 13, color = '#FFFFFF', strokeWidth = 2.6 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </Svg>
  );
}

export function BookIcon({ size = 18, color = '#2F5BFF', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" {...line(color, strokeWidth)} />
      <Path d="M4 21V5M8 7h7" {...line(color, strokeWidth)} />
    </Svg>
  );
}

/** O'ngga strelka (Payments pastki tugmasi, Contract, DebtReminder). */
export function ArrowRightIcon({ size = 18, color = '#FFFFFF', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M5 12h14M13 6l6 6-6 6" {...line(color, strokeWidth)} />
    </Svg>
  );
}

/** Expired "Yopiladi" ro'yxatidagi qulf (to'rtburchak balandligi 9). */
export function LockIcon3({ size = 16, color = '#B42318', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Rect x="5" y="11" width="14" height="9" rx="2" {...line(color, strokeWidth)} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" {...line(color, strokeWidth)} />
    </Svg>
  );
}

/** Sertifikatlar pastidagi QR belgisi (to'ldirilgan). */
export function QrIcon({ size = 18, color = '#1E3FD1' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm10-2h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2zm2-4h2v2h-2zm0 4h2v2h-2z" fill={color} />
    </Svg>
  );
}
