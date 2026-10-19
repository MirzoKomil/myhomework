/**
 * Sozlamalar guruhi ikonkalari — dizayndagi inline SVG yo'llari aynan
 * ko'chirilgan (Settings, Devices, FAQ, Privacy, LogoutConfirm).
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

export function ChevronRightIcon({ size = 18, color = '#6B7489', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M9 6l6 6-6 6" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function ChevronDownIcon({ size = 20, color = '#4A5468', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M6 9l6 6 6-6" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function ChevronUpIcon({ size = 20, color = '#1E3FD1', strokeWidth = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M6 15l6-6 6 6" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function GlobeIcon({ size = 20, color = '#2F5BFF', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Circle cx="12" cy="12" r="9" {...line(color, strokeWidth)} />
      <Path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function MoonIcon({ size = 20, color = '#2F5BFF', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" {...line(color, strokeWidth)} />
    </Svg>
  );
}

/** Sozlamalar qatoridagi Telegram belgisi (to'ldirilgan). */
export function TelegramRowIcon({ size = 20, color = '#1B6FA8' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M21.5 4.2 2.9 11.4c-1 .4-1 1.5 0 1.8l4.6 1.5 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.4 4.7 3.5c.6.4 1.4.1 1.6-.6l3.1-15.3c.2-1-.6-1.8-1.4-1.5zM9.6 14.3l-.4 3.9-1.3-4.2 9.6-6.3z" fill={color} />
    </Svg>
  );
}

/** Ko'k "Supportga/Menejerga yozish" tugmasidagi Telegram belgisi. */
export function TelegramButtonIcon({ size = 18, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M21.5 3.5 2.7 10.8c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.4 4.6 3.4c.7.5 1.7.1 1.9-.7L23 4.9c.2-1-.6-1.8-1.5-1.4zM9.6 14.2l8.2-6.9-6.6 8.3-.3 3.1z" fill={color} />
    </Svg>
  );
}

export function CheckMarkIcon({ size = 14, color = '#087A4A', strokeWidth = 3 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M5 12.5l4.5 4.5L19 7.5" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function PhoneIcon({ size = 20, color = '#2F5BFF', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Rect x="6" y="2.5" width="12" height="19" rx="3" {...line(color, strokeWidth)} />
      <Path d="M11 18h2" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function LaptopIcon({ size = 24, color = '#4A5468', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Rect x="4" y="4.5" width="16" height="11" rx="2" {...line(color, strokeWidth)} />
      <Path d="M2 19.5h20" {...line(color, strokeWidth)} />
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

export function DownloadIcon({ size = 20, color = '#2F5BFF', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M12 4v11M7 10l5 5 5-5M5 20h14" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function QuestionIcon({ size = 20, color = '#2F5BFF', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Circle cx="12" cy="12" r="9" {...line(color, strokeWidth)} />
      <Path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14M12 17.5v.01" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function ShieldOutlineIcon({ size = 20, color = '#2F5BFF', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M12 3l7 3v5.5c0 4.3-2.9 8-7 9.5-4.1-1.5-7-5.2-7-9.5V6z" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function ShieldAlertIcon({ size = 20, color = '#7A5300', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M12 3l7 3v5.5c0 4.3-2.9 8-7 9.5-4.1-1.5-7-5.2-7-9.5V6z" {...line(color, strokeWidth)} />
      <Path d="M12 8v4M12 15.5v.01" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function LogoutIcon({ size = 20, color = '#B42318', strokeWidth = 2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function PinIcon({ size = 15, color = '#4A5468', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" {...line(color, strokeWidth)} />
      <Circle cx="12" cy="9.5" r="2.5" {...line(color, strokeWidth)} />
    </Svg>
  );
}

export function ClockIcon({ size = 15, color = '#4A5468', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>
      <Circle cx="12" cy="12" r="9" {...line(color, strokeWidth)} />
      <Path d="M12 7v5l3 2" {...line(color, strokeWidth)} />
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
