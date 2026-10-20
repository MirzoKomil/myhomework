/**
 * Kompyuter: kitob rasmlarini kattalashtirish (dizayn: D_ImageViewer) — menyusiz.
 *
 * Rasmlar mobil ekrandagi kabi mahsulotning CRM rasmi(lari)dan. Masshtab
 * 100–300% (50% qadam) — tugmalar yoki sichqoncha g'ildiragi.
 * Klaviatura: Esc — yopish, ← → — rasmlar.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { goBack, productImages, useShopProducts } from '@/components/v2/rewards/parts';
import { R } from '@/constants/v2/routes';

import { IChevron, IChevronLeft, IClose, IMinus, IPlus, T, webShadow } from './ui';

const ZOOMS = [1, 1.5, 2, 2.5, 3];

function DarkKbd({ children }: { children: string }) {
  return (
    <View style={s.kbd}>
      <T f="bodyHeavy" size={12} color="#DCE2EE">
        {children}
      </T>
    </View>
  );
}

export function DImageViewer() {
  const { itemId, i: startParam } = useLocalSearchParams<{
    itemId: string;
    i?: string;
  }>();
  const products = useShopProducts();
  const p = products?.find((x) => x.id === itemId);
  const images = p ? productImages(p) : [];
  const [index, setIndex] = useState(() => Math.max(0, Number(startParam) || 0));
  const [zoomIdx, setZoomIdx] = useState(0);
  const zoom = ZOOMS[zoomIdx];
  const uri = images[Math.min(index, Math.max(0, images.length - 1))];
  const pageLabel = (i: number) => (i === 0 ? 'muqova' : `${i}-sahifa`);
  const close = () => goBack(R.shopItem(itemId ?? ''));
  const prev = () => {
    if (index > 0) {
      setIndex(index - 1);
      setZoomIdx(0);
    }
  };
  const next = () => {
    if (index < images.length - 1) {
      setIndex(index + 1);
      setZoomIdx(0);
    }
  };
  const zoomOut = () => setZoomIdx((z) => Math.max(0, z - 1));
  const zoomIn = () => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1));
  useDesktopKeys({ Escape: close, ArrowLeft: prev, ArrowRight: next });

  // Sichqoncha g'ildiragi — masshtab (dizayndagi "Sichqoncha gʻildiragi bilan kattalashtiring").
  const frameRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = frameRef.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1));
      else if (e.deltaY > 0) setZoomIdx((z) => Math.max(0, z - 1));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const canPrev = index > 0;
  const canNext = index < images.length - 1;

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Yopish (Esc)"
          onPress={close}
          style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.close, hovered && { backgroundColor: '#26304A' }]}
        >
          <IClose size={22} color="#FFFFFF" />
        </Pressable>
        <DarkKbd>Esc</DarkKbd>
        <View style={{ flex: 1, alignItems: 'center', gap: 1 }}>
          <T f="bodyHeavy" size={18} color="#FFFFFF" numberOfLines={1}>
            {p?.name ?? ''}
          </T>
          <T size={13} color="#B8C1D6">
            {images.length ? `${index + 1} / ${images.length}` : ''}
          </T>
        </View>
        <View accessibilityRole="toolbar" accessibilityLabel="Masshtab" style={s.zoom}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kichiklashtirish"
            accessibilityState={{ disabled: zoomIdx === 0 }}
            disabled={zoomIdx === 0}
            onPress={zoomOut}
            style={[s.zoomBtn, { backgroundColor: zoomIdx === 0 ? '#1B2438' : '#34405A' }]}
          >
            <IMinus color={zoomIdx === 0 ? '#5B6478' : '#FFFFFF'} />
          </Pressable>
          <T f="bodyHeavy" size={15} color="#FFFFFF" style={{ width: 58, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kattalashtirish"
            accessibilityState={{ disabled: zoomIdx === ZOOMS.length - 1 }}
            disabled={zoomIdx === ZOOMS.length - 1}
            onPress={zoomIn}
            style={[
              s.zoomBtn,
              {
                backgroundColor: zoomIdx === ZOOMS.length - 1 ? '#1B2438' : '#34405A',
              },
            ]}
          >
            <IPlus color={zoomIdx === ZOOMS.length - 1 ? '#5B6478' : '#FFFFFF'} />
          </Pressable>
        </View>
      </View>

      <View style={s.stage}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Oldingi rasm"
          accessibilityState={{ disabled: !canPrev }}
          disabled={!canPrev}
          onPress={prev}
          style={[s.nav, { backgroundColor: canPrev ? '#34405A' : '#141B2B' }]}
        >
          <IChevronLeft size={24} color={canPrev ? '#FFFFFF' : '#5B6478'} sw={2.6} />
        </Pressable>
        <View ref={frameRef} style={[s.frame, webShadow('0 30px 80px rgba(0,0,0,0.5)')]}>
          {uri ? (
            <Image
              source={{ uri }}
              accessibilityLabel={`«${p?.name}» ${index === 0 ? 'kitobining muqovasi' : pageLabel(index)}, kattalashtirilgan`}
              style={{ width: 600, height: 600, transform: [{ scale: zoom }] }}
              resizeMode="contain"
            />
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Keyingi rasm"
          accessibilityState={{ disabled: !canNext }}
          disabled={!canNext}
          onPress={next}
          style={[s.nav, { backgroundColor: canNext ? '#34405A' : '#141B2B' }]}
        >
          <IChevron size={24} color={canNext ? '#FFFFFF' : '#5B6478'} sw={2.6} />
        </Pressable>
      </View>

      <View style={s.footer}>
        <View accessibilityRole="tablist" accessibilityLabel="Rasmlar" style={{ flexDirection: 'row', gap: 10 }}>
          {images.map((src, i) => {
            const on = i === index;
            return (
              <Pressable
                key={src + i}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={i === 0 ? 'Muqova' : `Ichki sahifa ${i}`}
                onPress={() => {
                  setIndex(i);
                  setZoomIdx(0);
                }}
                style={[s.tab, on ? [{ backgroundColor: '#E9E5E0' }, webShadow('0 0 0 3px #FFFFFF')] : { backgroundColor: '#263048', opacity: 0.75 }]}
              >
                <Image source={{ uri: src }} style={{ width: 70, height: 70 }} resizeMode="contain" />
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <T f="bodyHeavy" size={16} color="#FFFFFF">
            {p ? `${p.name} · ${pageLabel(index)}` : ''}
          </T>
          <View
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#5B6478',
            }}
          />
          <T size={14} color="#B8C1D6">
            Sichqoncha gʻildiragi bilan kattalashtiring
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <DarkKbd>←</DarkKbd>
            <DarkKbd>→</DarkKbd>
            <T size={13} color="#B8C1D6">
              rasmlar
            </T>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Dizayn foni — sahifaning xira surati ustida rgba(5,8,15,0.9); ilovada bir xil to'q rang.
  screen: { flex: 1, backgroundColor: '#0E121A' },
  header: {
    height: 84,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  close: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1B2438',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kbd: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 7,
    backgroundColor: '#1B2438',
    borderWidth: 1,
    borderBottomWidth: 2,
    borderColor: '#34405A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoom: {
    height: 52,
    padding: 4,
    borderRadius: 26,
    backgroundColor: '#141B2B',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  nav: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 620,
    height: 600,
    maxHeight: '100%',
    borderRadius: 24,
    backgroundColor: '#E9E5E0',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    height: 156,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  tab: {
    width: 72,
    height: 72,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
