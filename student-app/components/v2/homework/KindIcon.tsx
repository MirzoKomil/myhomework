/**
 * Vazifa qismi turining ikonkasi (harf "A/B/C/D" o'rniga).
 * Chiziqli uslub — dizayndagi boshqa ikonkalar bilan bir xil (stroke 2.2).
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { HomeworkPart } from '@/data/lessonContent';

type Props = { kind: HomeworkPart['kind']; color: string; size?: number };

export function KindIcon({ kind, color, size = 24 }: Props) {
  const p = { fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {kind === 'reading' && (
        <>
          <Path {...p} d="M3 5.5c3-1.3 6-1.3 9 .5v13c-3-1.8-6-1.8-9-.5z" />
          <Path {...p} d="M21 5.5c-3-1.3-6-1.3-9 .5v13c3-1.8 6-1.8 9-.5z" />
        </>
      )}
      {kind === 'matching' && (
        <>
          <Circle {...p} cx={5.5} cy={6} r={2.2} />
          <Circle {...p} cx={5.5} cy={18} r={2.2} />
          <Circle {...p} cx={18.5} cy={6} r={2.2} />
          <Circle {...p} cx={18.5} cy={18} r={2.2} />
          <Path {...p} d="M7.7 6.8l8.6 10.4M7.7 17.2l8.6-10.4" />
        </>
      )}
      {kind === 'fillBlank' && (
        <>
          {/* Qalam — bo'sh joyni yozib to'ldirish */}
          <Path {...p} d="M4 20h4L19 9l-4-4L4 16z" />
          <Path {...p} d="M13.5 6.5l4 4" />
        </>
      )}
      {kind === 'multipleChoice' && (
        <>
          <Path {...p} d="M4 6.5l1.6 1.6L8.5 5" />
          <Path {...p} d="M11.5 6.8H20M11.5 12H20M11.5 17.2H20" />
          <Circle {...p} cx={6} cy={12} r={1.8} />
          <Circle {...p} cx={6} cy={17.2} r={1.8} />
        </>
      )}
      {kind === 'sentenceBuild' && (
        <>
          <Rect {...p} x={3} y={5} width={7} height={5} rx={1.5} />
          <Rect {...p} x={13} y={5} width={8} height={5} rx={1.5} />
          <Rect {...p} x={3} y={14} width={11} height={5} rx={1.5} />
          <Path {...p} d="M17.5 16.5h3M19 15v3" />
        </>
      )}
      {(kind === 'record' || kind === 'pronunciation' || kind === 'roleplay') && (
        <>
          <Rect {...p} x={9} y={3} width={6} height={11} rx={3} />
          <Path {...p} d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
        </>
      )}
      {kind === 'creative' && <Path {...p} d="M12 3l2.4 5.6L20 9.3l-4.3 3.9 1.3 5.8L12 16l-5 3 1.3-5.8L4 9.3l5.6-.7z" />}
    </Svg>
  );
}
