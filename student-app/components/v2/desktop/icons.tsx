/**
 * Kompyuter qobig'i ikonkalari — dizayndagi (D_*.dc.html) SVG yo'llari aynan.
 */
import Svg, { Circle, Path } from 'react-native-svg';

type P = { size?: number; color?: string; strokeWidth?: number };

const S = ({ size = 22, color = '#34405A', strokeWidth = 2, children }: P & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

export const DHomeIcon = (p: P) => (
  <S {...p}>
    <Path d="M3 10.3 12 3l9 7.3V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z" />
  </S>
);
export const DPathIcon = (p: P) => (
  <S {...p}>
    <Circle cx={6} cy={19} r={2} />
    <Circle cx={18} cy={5} r={2} />
    <Path d="M8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" />
  </S>
);
export const DStarIcon = (p: P) => (
  <S {...p}>
    <Path d="M12 3l2.2 5.3L20 9l-4.4 3.8L17 18.5 12 15.6 7 18.5l1.4-5.7L4 9l5.8-.7z" />
  </S>
);
export const DTrophyIcon = (p: P) => (
  <S {...p}>
    <Path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
    <Path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5" />
  </S>
);
export const DBagIcon = (p: P) => (
  <S {...p}>
    <Path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" />
    <Path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </S>
);
export const DUserIcon = (p: P) => (
  <S {...p}>
    <Circle cx={12} cy={8} r={4} />
    <Path d="M4 21a8 8 0 0 1 16 0" />
  </S>
);
export const DBellIcon = ({ size = 21, color = '#0B1220' }: P) => (
  <S size={size} color={color}>
    <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
    <Path d="M10 20.5a2 2 0 0 0 4 0" />
  </S>
);
export const DBackIcon = ({ size = 20, color = '#0B1220' }: P) => (
  <S size={size} color={color} strokeWidth={2.4}>
    <Path d="M15 6l-6 6 6 6" />
  </S>
);
export const DCloseIcon = ({ size = 20, color = '#0B1220', strokeWidth = 2.4 }: P) => (
  <S size={size} color={color} strokeWidth={strokeWidth}>
    <Path d="M6 6l12 12M18 6 6 18" />
  </S>
);
export const DArrowRightIcon = ({ size = 18, color = '#FFFFFF', strokeWidth = 2.6 }: P) => (
  <S size={size} color={color} strokeWidth={strokeWidth}>
    <Path d="M5 12h14M13 6l6 6-6 6" />
  </S>
);
export const DCoinIcon = ({ size = 16 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={10} fill="#F5B70A" />
    <Circle cx={12} cy={12} r={6.5} fill="none" stroke="#B98500" strokeWidth={1.8} />
  </Svg>
);
export const DFlameIcon = ({ size = 16 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 2c.8 3.6 5.5 5.6 5.5 11.2A5.5 5.5 0 0 1 6.5 13.2c0-2.6 1.6-4.4 2.6-6 .7 1.8 1.6 2.7 2.6 2.7C11.7 7.4 11 4.6 12 2z" fill="#FF7A1A" />
  </Svg>
);
export const DBoltIcon = ({ size = 15, color = '#7C4DFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M13 2 4 14h7l-1 8 9-12h-7z" fill={color} />
  </Svg>
);
export const DTelegramIcon = ({ size = 18, color = '#0B1220' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M21.5 3.5 2.7 10.8c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.4 4.6 3.4c.7.5 1.7.1 1.9-.7L23 4.9c.2-1-.6-1.8-1.5-1.4zM9.6 14.2l8.2-6.9-6.6 8.3-.3 3.1z" />
  </Svg>
);
