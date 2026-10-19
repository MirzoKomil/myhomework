/**
 * v2 Do'kon — rasmni kattalashtirish (dizayn: 45 · ImageViewer).
 *
 * Rasmlar mahsulotning CRM rasmi(lari)dan. Masshtab tugmalari 100–300%
 * oralig'ida 50% qadam bilan ishlaydi; ochilganda 100% (asl o'lcham).
 */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloseIcon, MinusIcon, PlusIcon } from '@/components/v2/rewards/icons';
import { goBack, productImages, useShopProducts } from '@/components/v2/rewards/parts';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';

const ZOOMS = [1, 1.5, 2, 2.5, 3];

export default function V2ImageViewer() {
  const insets = useSafeAreaInsets();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const products = useShopProducts();
  const p = products?.find((x) => x.id === itemId);
  const images = p ? productImages(p) : [];
  const [index, setIndex] = useState(0);
  const [zoomIdx, setZoomIdx] = useState(0);
  const zoom = ZOOMS[zoomIdx];
  const uri = images[index];
  const pageLabel = (i: number) => (i === 0 ? 'muqova' : `${i}-sahifa`);

  return (
    <View style={styles.screen}>
      <View style={[styles.top, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={() => goBack(R.shopItem(itemId ?? ''))} style={styles.close}>
          <CloseIcon color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{p?.name ?? ''}</Text>
        <Text style={styles.count}>{images.length ? `${index + 1} / ${images.length}` : ''}</Text>
      </View>

      <View style={styles.stage}>
        <View style={styles.frame}>
          {uri ? (
            <Image
              source={{ uri }}
              accessibilityLabel={`«${p?.name}» ${pageLabel(index)}, kattalashtirilgan`}
              style={[{ width: '100%', height: '100%', transform: [{ scale: zoom }] }, { objectPosition: '50% 45%' } as ImageStyle]}
              resizeMode="cover"
            />
          ) : null}
        </View>
        <View accessibilityRole="toolbar" accessibilityLabel="Masshtab" style={styles.zoom}>
          <Pressable accessibilityRole="button" accessibilityLabel="Kattalashtirish" onPress={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))} style={styles.zoomBtn}>
            <PlusIcon />
          </Pressable>
          <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Kichiklashtirish" onPress={() => setZoomIdx((z) => Math.max(0, z - 1))} style={styles.zoomBtn}>
            <MinusIcon />
          </Pressable>
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 34 }]}>
        <View accessibilityRole="tablist" accessibilityLabel="Rasmlar" style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          {images.map((_, i) => (
            <Pressable
              key={i}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === index }}
              accessibilityLabel={i === 0 ? 'Muqova' : `Ichki sahifa ${i}`}
              onPress={() => setIndex(i)}
              style={styles.tab}
            >
              <View style={[styles.dot, i === index && styles.dotActive]} />
            </Pressable>
          ))}
        </View>
        <Text style={styles.caption}>{p ? `${p.name} · ${pageLabel(index)}` : ''}</Text>
        <Text style={styles.hint}>Ikki barmoq bilan kattalashtiring</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#05080F' },
  top: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', maxWidth: 480, alignSelf: 'center' },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, minWidth: 0, textAlign: 'center', fontFamily: fonts.display, fontWeight: 'normal', fontSize: 18, color: '#FFFFFF' },
  count: { width: 44, textAlign: 'center', fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, color: '#C3CAD9' },
  frame: { width: '100%', maxWidth: 480, height: 520, overflow: 'hidden' },
  stage: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  zoom: { position: 'absolute', right: 14, bottom: 18, alignItems: 'center', gap: 6, padding: 6, borderRadius: 30, backgroundColor: 'rgba(11,18,32,0.72)' },
  zoomBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  zoomText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#FFFFFF' },
  bottom: { paddingTop: 6, paddingHorizontal: 20, alignItems: 'center', gap: 12 },
  tab: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6B7489' },
  dotActive: { width: 22, backgroundColor: '#FFFFFF' },
  caption: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#FFFFFF' },
  hint: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, color: '#AEB6C8' },
});
