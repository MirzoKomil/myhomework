/**
 * Admin matnini (konspekt, dialog replikasi, grammatika izohi…) belgilash
 * bilan ko'rsatadi: qalin, kursiv, tagiga chizilgan, sariq fon, rangli matn,
 * "# " sarlavha va "- " ro'yxat. Faqat ichma-ich <Text> bo'laklari —
 * HTML kiritilmaydi, web va native'da bir xil ishlaydi.
 *
 * Belgilash bo'lmasa matn avvalgidek bitta <Text> bilan chiqadi — eski
 * ekranlarning ko'rinishi o'zgarmaydi.
 *
 * inline — tashqi <Text> qaytarmaydi, faqat bo'laklar: ota <Text> ichida
 * ishlatiladi va uning uslubini meros oladi ("Darsdan keyin: …" kabi).
 */
import { Fragment, type ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { theme } from '@/constants/theme';
import { fonts } from '@/constants/v2/tokens';
import { BULLET, hasRichText, parseRichText, RICH_COLORS, RICH_HIGHLIGHT, type RichSpan } from '@/services/richText';

export { stripRichText, speakableText, hasRichText } from '@/services/richText';

type Props = Omit<TextProps, 'children' | 'style'> & {
  text: string | null | undefined;
  style?: StyleProp<TextStyle>;
  /** Ota <Text> ichida ishlatish uchun — tashqi <Text> qo'yilmaydi. */
  inline?: boolean;
  /** Qalin bo'lak uslubi; berilmasa shrift oilasiga qarab tanlanadi. */
  boldStyle?: TextStyle;
};

// Ilova shriftlari og'irlikni fontFamily orqali beradi (native'da fontWeight
// maxsus shriftni qalin qilmaydi), shuning uchun qalin oilaga o'tamiz:
// v2 — Manrope 800, eski ilova — Onest 700/800; boshqalarda — fontWeight.
function defaultBold(style: StyleProp<TextStyle>): TextStyle {
  const fam = StyleSheet.flatten(style)?.fontFamily ?? '';
  if (/Manrope|Bricolage/i.test(fam)) return { fontFamily: fonts.bodyHeavy, fontWeight: 'normal' };
  if (/Onest/i.test(fam)) return { fontFamily: /[78]00/.test(fam) ? theme.fonts.extraBold : theme.fonts.bold };
  return { fontWeight: '700' };
}

function spanStyle(s: RichSpan, bold: TextStyle): StyleProp<TextStyle> {
  const st: TextStyle[] = [];
  if (s.bold) st.push(bold);
  if (s.italic) st.push({ fontStyle: 'italic' });
  if (s.underline) st.push({ textDecorationLine: 'underline' });
  if (s.highlight) st.push({ backgroundColor: RICH_HIGHLIGHT });
  if (s.color) st.push({ color: RICH_COLORS[s.color] });
  return st;
}

function renderSpans(spans: RichSpan[], bold: TextStyle, keyBase: string): ReactNode[] {
  return spans.map((s, i) => {
    const st = spanStyle(s, bold);
    return Array.isArray(st) && st.length === 0 ? (
      <Fragment key={`${keyBase}-${i}`}>{s.text}</Fragment>
    ) : (
      <Text key={`${keyBase}-${i}`} style={st}>
        {s.text}
      </Text>
    );
  });
}

export function RichText({ text, style, inline, boldStyle, ...rest }: Props) {
  const value = text ?? '';
  if (!hasRichText(value)) {
    if (inline) return <>{value}</>;
    return (
      <Text style={style} {...rest}>
        {value}
      </Text>
    );
  }
  const bold = boldStyle ?? defaultBold(style);
  const size = StyleSheet.flatten(style)?.fontSize;
  // Sarlavha — qalin va biroz kattaroq (asosiy o'lchamdan 15%).
  const heading: TextStyle = { ...bold, ...(size ? { fontSize: Math.round(size * 1.15) } : null) };
  const children: ReactNode[] = [];
  parseRichText(value).forEach((b, k) => {
    if (k > 0) children.push('\n');
    const spans = renderSpans(b.spans, bold, String(k));
    if (b.kind === 'h') {
      children.push(
        <Text key={`h${k}`} style={heading}>
          {spans}
        </Text>,
      );
    } else if (b.kind === 'li') {
      children.push(<Fragment key={`l${k}`}>{BULLET}{spans}</Fragment>);
    } else children.push(<Fragment key={`p${k}`}>{spans}</Fragment>);
  });
  if (inline) return <>{children}</>;
  return (
    <Text style={style} {...rest}>
      {children}
    </Text>
  );
}

export default RichText;
