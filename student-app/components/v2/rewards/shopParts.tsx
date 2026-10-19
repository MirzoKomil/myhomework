/**
 * Do'kon ekranlari uchun umumiy bo'laklar: mahsulot rasmi (CRM rasmi
 * bo'lmasa eski do'kondagi kabi ikonka), coin progress chizig'i.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

import type { ShopProductV2 } from './parts';
import { productImages } from './parts';

export function ProductImage({ product, style, iconSize = 44, index = 0, position }: { product: ShopProductV2; style?: StyleProp<ViewStyle>; iconSize?: number; index?: number; position?: string }) {
  const uri = productImages(product)[index];
  if (uri) {
    return (
      <View style={[styles.box, style]}>
        <Image
          source={{ uri }}
          accessibilityLabel={`«${product.name}» rasmi`}
          style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }, position ? ({ objectPosition: position } as ImageStyle) : null]}
          resizeMode="cover"
        />
      </View>
    );
  }
  return (
    <View style={[styles.box, { backgroundColor: product.bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ionicons name={product.icon} size={iconSize} color={product.color} />
    </View>
  );
}

/**
 * Kitob muqovasi dizayndagidek: kvadrat, "contain", chap/o'ng chetlari
 * fon rangiga silliq singib ketadi (dizayndagi mask-image o'rniga — fon
 * bir xil rangli, shuning uchun ustidan fon rangidagi gradient bir xil
 * natija beradi va native'da ham ishlaydi).
 */
export function ProductCover({ product, size, bg, fade, index = 0, iconSize = 44 }: { product: ShopProductV2; size: number; bg: string; fade: number; index?: number; iconSize?: number }) {
  const uri = productImages(product)[index];
  if (!uri) {
    return (
      <View style={{ width: size, height: size, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={product.icon} size={iconSize} color={product.color} />
      </View>
    );
  }
  const edge = Math.round(size * fade);
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Image source={{ uri }} accessibilityLabel={`«${product.name}» kitobining muqovasi`} style={{ width: size, height: size }} resizeMode="contain" />
      <LinearGradient colors={[bg, `${bg}00`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: edge }} pointerEvents="none" />
      <LinearGradient colors={[`${bg}00`, bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: edge }} pointerEvents="none" />
    </View>
  );
}

export function CoinBar({ value, height = 6 }: { value: number; height?: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={{ height, borderRadius: height / 2, backgroundColor: '#EEF1F7', overflow: 'hidden' }}
    >
      <View style={{ width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: '#F5B70A' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: '#ECECEE' },
});
