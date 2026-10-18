import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { colors, fonts, type } from '@/constants/v2/tokens';

export type TextVariant = keyof typeof type;

type V2TextProps = TextProps & {
  variant?: TextVariant;
  color?: string;
  /**
   * Display (sarlavha) shriftida kirill harflari yo'q. Native'da rus
   * tilidagi sarlavhaga `cyrillic` qo'ying — Manrope ExtraBold ishlatiladi.
   * Webda bu avtomatik (shrift ro'yxati orqali), lekin qo'yish zarar qilmaydi.
   */
  cyrillic?: boolean;
  align?: TextStyle['textAlign'];
};

const displayVariants = new Set<TextVariant>(['hero', 'title', 'heading', 'subheading']);

export function V2Text({ variant = 'body', color = colors.text, cyrillic, align, style, ...rest }: V2TextProps) {
  const base = type[variant];
  const swapFont = cyrillic && displayVariants.has(variant) ? { fontFamily: fonts.displayCyrillic } : null;
  return (
    <Text
      {...rest}
      style={[base, { color }, align ? { textAlign: align } : null, swapFont, styles.reset, style]}
    />
  );
}

const styles = StyleSheet.create({
  // React Native web brauzerning standart margin'larini olib tashlaydi,
  // lekin font-weight sintetik qalinlashmasligi uchun aniq 'normal'.
  reset: { fontWeight: 'normal' },
});
