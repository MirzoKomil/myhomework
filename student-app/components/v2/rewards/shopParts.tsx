/**
 * Do'kon ekranlari uchun umumiy bo'laklar: mahsulot rasmi (CRM rasmi
 * bo'lmasa eski do'kondagi kabi ikonka), coin progress chizig'i.
 */
import { Ionicons } from '@expo/vector-icons';
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
