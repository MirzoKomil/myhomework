/**
 * v2 Do'kon — mahsulot (dizayn: 44 · ShopItem).
 *
 * Mahsulot eski do'kondagi manbadan (mobile-content `shop`). Tavsif,
 * afzalliklar va qo'shimcha rasmlar CRM'da kiritilgan bo'lsa chiqadi,
 * bo'lmasa faqat bor ma'lumot. Buyurtma Checkout ekranida eski
 * shopStore.placeOrder orqali beriladi; coin yetmaganda ham manzilni
 * "Yetkazish manzilini oldindan kiriting" qatori orqali oldindan kiritish mumkin.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BagIcon, ChevronThinIcon, CoinFill, LockIcon, TapIcon, TICK2, TickIcon, TruckSmallIcon } from '@/components/v2/rewards/icons';
import { fmt, HeaderPill, lessonsFor, productDescription, productImages, ScreenHeader, useShopProducts } from '@/components/v2/rewards/parts';
import { CoinBar, ProductCover } from '@/components/v2/rewards/shopParts';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { useCoins } from '@/services/coinsStore';

// Muqova foni — dizayndagi qiymat (rasm cheti shu rangga singib ketadi).
const HERO_BG = '#E1DAD4';

export default function V2ShopItem() {
  const insets = useSafeAreaInsets();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const products = useShopProducts();
  const coins = useCoins();
  const p = products?.find((x) => x.id === itemId);

  if (!products) return <View style={styles.screen}><ScreenHeader title="" fallback={R.shop} /></View>;
  if (!p) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Mahsulot" fallback={R.shop} />
        <Text style={[styles.desc, { padding: 22 }]}>Mahsulot topilmadi.</Text>
      </View>
    );
  }

  const images = productImages(p);
  const missing = Math.max(0, p.price - coins);
  const desc = productDescription(p);
  const openViewer = () => images.length && router.push(R.imageViewer(p.id) as never);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={p.category === 'books' ? 'Kitob' : 'Mahsulot'}
        fallback={R.shop}
        right={<HeaderPill label="Buyurtmalarim" icon={<BagIcon />} onPress={() => router.push(R.orders as never)} />}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 34 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.column, { flex: 1 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Rasmni kattalashtirish" disabled={!images.length} onPress={openViewer} style={styles.hero}>
            <ProductCover product={p} size={190} bg={HERO_BG} fade={0.14} iconSize={96} />
            {images.length > 0 && (
              <View style={styles.heroBar}>
                <View style={styles.tapPill}>
                  <TapIcon />
                  <Text style={styles.tapText}>Kattalashtirish uchun bosing</Text>
                </View>
                <View style={styles.dots}>
                  {images.map((_, i) => (
                    <View key={i} accessibilityLabel={i === 0 ? 'Muqova' : `Ichki sahifa ${i}`} style={[styles.dot, i === 0 && styles.dotActive]} />
                  ))}
                </View>
              </View>
            )}
          </Pressable>

          <View style={{ gap: 4, paddingHorizontal: 2 }}>
            <Text accessibilityRole="header" style={styles.title}>{p.name}</Text>
            {!!desc && <Text style={styles.desc}>{desc}</Text>}
          </View>

          {!!p.features?.length && (
            <View style={{ gap: 5, paddingHorizontal: 2 }}>
              {p.features.map((f) => (
                <View key={f} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <View style={styles.tick}><TickIcon size={13} color="#087A4A" strokeWidth={3.2} d={TICK2} /></View>
                  <Text style={styles.feature}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.priceCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CoinFill size={22} />
                <Text style={styles.price}>{fmt(p.price)}</Text>
              </View>
              <View style={{ flex: 1 }} />
              <Text style={styles.have}>Sizda {fmt(coins)}</Text>
            </View>
            <CoinBar value={coins / Math.max(1, p.price)} height={8} />
            <Text style={styles.need}>{missing > 0 ? `yana ${fmt(missing)} coin · ~${lessonsFor(missing)} dars` : 'Coin yetarli — buyurtma bera olasiz'}</Text>
            {missing > 0 && (
              <Pressable accessibilityRole="link" onPress={() => router.push(R.checkout(p.id) as never)} style={({ pressed }) => [styles.addr, pressed && { opacity: 0.8 }]}>
                <TruckSmallIcon />
                <Text style={styles.addrText}>Yetkazish manzilini oldindan kiriting</Text>
                <ChevronThinIcon />
              </Pressable>
            )}
          </View>

          <View style={{ flex: 1 }} />
          <View style={{ gap: 4 }}>
            {missing > 0 ? (
              <View accessibilityRole="button" accessibilityState={{ disabled: true }} style={[styles.cta, { backgroundColor: '#E4E8F0' }]}>
                <LockIcon size={18} color="#4A5468" />
                <Text style={[styles.ctaText, { color: '#4A5468' }]}>{fmt(missing)} coin yetishmayapti</Text>
              </View>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => router.push(R.checkout(p.id) as never)} style={({ pressed }) => [styles.cta, { backgroundColor: pressed ? '#1E3FD1' : '#2F5BFF' }]}>
                <Text style={[styles.ctaText, { color: '#FFFFFF' }]}>Buyurtma berish</Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="link" onPress={() => router.push(R.shop as never)} style={styles.howBtn}>
              <Text style={styles.howText}>Coin qanday yigʻiladi?</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { flexGrow: 1, paddingTop: 14, paddingHorizontal: 20 },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 11 },
  hero: { borderRadius: 26, overflow: 'hidden', backgroundColor: HERO_BG },
  heroBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  tapPill: { height: 34, paddingLeft: 10, paddingRight: 12, borderRadius: 17, backgroundColor: 'rgba(255,255,255,.94)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  tapText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#0B1220' },
  dots: { height: 34, paddingHorizontal: 10, borderRadius: 17, backgroundColor: 'rgba(255,255,255,.94)', flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#B4BCCB' },
  dotActive: { width: 20, backgroundColor: '#0B1220' },
  title: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 26, lineHeight: 29, letterSpacing: -0.52, color: '#0B1220' },
  desc: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 14, lineHeight: 20, color: '#4A5468' },
  tick: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E3F7EE', alignItems: 'center', justifyContent: 'center' },
  feature: { flex: 1, fontFamily: fonts.body, fontWeight: 'normal', fontSize: 14, lineHeight: 20, color: '#0B1220' },
  priceCard: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, gap: 8 },
  price: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 22, color: '#0B1220' },
  have: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, color: '#4A5468' },
  need: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#7A5300' },
  cta: { height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16 },
  addr: { minHeight: 44, marginHorizontal: -6, marginBottom: -6, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#F4F6FA', flexDirection: 'row', alignItems: 'center', gap: 8 },
  addrText: { flex: 1, fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#0B1220' },
  howBtn: { height: 46, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  howText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#1E3FD1' },
});
