/**
 * "lessons" guruhi ikonkalari — dizayndagi (Path, Lesson, Vocab,
 * AudioDialog, Slides, Video, Complete) inline SVG yo'llari aynan ko'chirilgan.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { size?: number; color?: string; strokeWidth?: number };

const hidden = { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };

const line = (color: string, strokeWidth: number, join = true) => ({
  fill: 'none',
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round' as const,
  ...(join ? { strokeLinejoin: 'round' as const } : {}),
});

export function BackIcon({ size = 20, color = '#0B1220', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M15 5l-7 7 7 7" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function ChevronRight({ size = 18, color = '#5B6478', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M9 5l7 7-7 7" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function CloseIcon({ size = 20, color = '#0B1220', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M6 6l12 12M18 6 6 18" {...line(color, strokeWidth, false)} />
    </Svg>
  );
}

export function Check({ size = 18, color = '#FFFFFF', strokeWidth = 3.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M5 12l5 5 9-10" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function PlayIcon({ size = 18, color = '#1E3FD1' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z" fill={color} />
    </Svg>
  );
}

export function PauseIcon({ size = 26, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Rect x="6" y="4" width="4.2" height="16" rx="1.5" fill={color} />
      <Rect x="13.8" y="4" width="4.2" height="16" rx="1.5" fill={color} />
    </Svg>
  );
}

export function PencilIcon({ size = 19, color = '#7A5300', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M4 20h4L19 9l-4-4L4 16z" {...line(color, strokeWidth)} />
      <Path d="M13.5 6.5l4 4" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function LockIcon({ size = 17, color = '#5B6478', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Rect x="5" y="11" width="14" height="10" rx="2.5" {...line(color, strokeWidth, false)} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" {...line(color, strokeWidth, false)} />
    </Svg>
  );
}

export function HeadphonesIcon({ size = 20, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M4 15v-3a8 8 0 0 1 16 0v3" {...line(color, 2.2, false)} />
      <Rect x="3" y="14" width="5" height="7" rx="2" fill={color} stroke={color} strokeWidth={2.2} />
      <Rect x="16" y="14" width="5" height="7" rx="2" fill={color} stroke={color} strokeWidth={2.2} />
    </Svg>
  );
}

export function CameraIcon({ size = 19, color = '#B42318' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Rect x="2" y="6" width="14" height="12" rx="3" {...line(color, 2.2)} />
      <Path d="M16 10l6-3v10l-6-3" {...line(color, 2.2)} />
    </Svg>
  );
}

export function ScreenIcon({ size = 17, color = '#0B1220' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M12 16v4M8 20h8" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
    </Svg>
  );
}

export function TelegramIcon({ size = 18, color = '#0B1220' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path
        d="M21.5 3.5 2.7 10.8c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.4 4.6 3.4c.7.5 1.7.1 1.9-.7L23 4.9c.2-1-.6-1.8-1.5-1.4zM9.6 14.2l8.2-6.9-6.6 8.3-.3 3.1z"
        fill={color}
      />
    </Svg>
  );
}

export function FlagIcon({ size = 19, color = '#5B6478' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M5 21V4h11l-2 4 2 4H5" {...line(color, 2.2)} />
    </Svg>
  );
}

export function ArrowRight({ size = 18, color = '#FFFFFF', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M5 12h14M13 6l6 6-6 6" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function SpeakerIcon({ size = 22, color = '#2F5BFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill={color} stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" {...line(color, 2.2)} />
    </Svg>
  );
}

export function QrIcon({ size = 13, color = '#4A5468' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path
        d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm10-2h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2zm2-4h2v2h-2zm0 4h2v2h-2z"
        fill={color}
      />
    </Svg>
  );
}

export function RepeatIcon({ size = 20, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M17 2l3 3-3 3" {...line(color, 2.2)} />
      <Path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3" {...line(color, 2.2)} />
      <Path d="M20 13v2a4 4 0 0 1-4 4H4" {...line(color, 2.2)} />
    </Svg>
  );
}

export function VideoBoxIcon({ size = 19, color = '#2F5BFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Rect x="3" y="4" width="18" height="16" rx="4" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M10 9v6l5-3z" fill={color} stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
    </Svg>
  );
}

export function CardsIcon({ size = 20, color = '#5A2FD6' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Rect x="3" y="6" width="13" height="15" rx="2.5" {...line(color, 2.2)} />
      <Path d="M8 3h10.5A2.5 2.5 0 0 1 21 5.5V16" {...line(color, 2.2)} />
    </Svg>
  );
}

export function FlameIcon({ size = 40, color = '#FF7A1A' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M12 2c.8 3.6 5.5 5.6 5.5 11.2A5.5 5.5 0 0 1 6.5 13.2c0-2.6 1.6-4.4 2.6-6 .7 1.8 1.6 2.7 2.6 2.7C11.7 7.4 11 4.6 12 2z" fill={color} />
    </Svg>
  );
}

export function CoinIcon({ size = 32 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Circle cx="12" cy="12" r="10" fill="#F5B70A" />
      <Circle cx="12" cy="12" r="6.5" fill="none" stroke="#B98500" strokeWidth={1.8} />
    </Svg>
  );
}

export function BoltIcon({ size = 32, color = '#7C4DFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M13 2 4 14h7l-1 8 9-12h-7z" fill={color} />
    </Svg>
  );
}

// ─── Yangilangan dizayn (2026-10-19) ikonkalari ─────────────────────────────

/** Oldingi replika (AudioDialog). */
export function SkipPrevIcon({ size = 20, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M6 5h2.4v14H6zM20 5.5v13a.8.8 0 0 1-1.2.7L9.6 12.7a.8.8 0 0 1 0-1.4l9.2-6.5a.8.8 0 0 1 1.2.7z" fill={color} />
    </Svg>
  );
}

/** Keyingi replika (AudioDialog). */
export function SkipNextIcon({ size = 20, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M15.6 5H18v14h-2.4zM4 5.5v13a.8.8 0 0 0 1.2.7l9.2-6.5a.8.8 0 0 0 0-1.4L5.2 4.8A.8.8 0 0 0 4 5.5z" fill={color} />
    </Svg>
  );
}

/** Replikani takrorlash ("1" belgili takrorlash). */
export function RepeatOneIcon({ size = 22, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M17 2l3 3-3 3" {...line(color, 2.2)} />
      <Path d="M4 11V9a4 4 0 0 1 4-4h16" {...line(color, 2.2)} />
      <Path d="M7 22l-3-3 3-3" {...line(color, 2.2)} />
      <Path d="M20 13v2a4 4 0 0 1-4 4H4" {...line(color, 2.2)} />
      <Path d="M11 10.5l1.6-1V15" {...line(color, 2)} />
    </Svg>
  );
}

/** To'liq ekran (burchaklar). */
export function FullscreenIcon({ size = 20, color = '#0B1220' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...line(color, 2.4)} />
    </Svg>
  );
}

/** "Pinch bilan kattalashtiring" belgisi. */
export function PinchIcon({ size = 16, color = '#DCE2EE' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" {...line(color, 2.2)} />
    </Svg>
  );
}

/** Kichik olov (Dars mukofoti qatori). */
export function SmallFlameIcon({ size = 15, color = '#FF7A1A' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z" fill={color} />
    </Svg>
  );
}

/** Soat (Tez tekshiruv havolasi). */
export function ClockIcon({ size = 18, color = '#1E3FD1' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Circle cx="12" cy="12" r="9" {...line(color, 2.2)} />
      <Path d="M12 7v5l3 2" {...line(color, 2.2)} />
    </Svg>
  );
}

/** Doira ichida belgi (Bugungi xatolar). */
export function CircleCheckIcon({ size = 20, color = '#087A4A' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Circle cx="12" cy="12" r="9" {...line(color, 2.4)} />
      <Path d="M8 12.5l3 3 5-6" {...line(color, 2.4)} />
    </Svg>
  );
}

/** Belgi (Tez tekshiruv, "dars yopiq" oynasi) — dizayndagi ikkinchi shakl. */
export function CheckAlt({ size = 14, color = '#FFFFFF', strokeWidth = 3.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M5 12.5l4.5 4.5L19 7.5" {...line(color, strokeWidth)} />
    </Svg>
  );
}

/** Kichik karnay — bitta to'lqin (So'zlar ro'yxati). */
export function SpeakerSmallIcon({ size = 18, color = '#2F5BFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill={color} stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M16 9a4 4 0 0 1 0 6" {...line(color, 2.2)} />
    </Svg>
  );
}

/** Ochiq karnay (Tez tekshiruv "Tinglash"). */
export function SpeakerOutlineIcon({ size = 20, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M4 9v6h4l5 4V5L8 9z" {...line(color, 2.2)} />
      <Path d="M16.5 8.5a5 5 0 0 1 0 7" {...line(color, 2.2)} />
    </Svg>
  );
}
